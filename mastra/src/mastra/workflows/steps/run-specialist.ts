import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { agentsByKey } from '../../agents'
import { consultationResultSchema } from '../../schemas/consultation-result'
import { markConsultationFailed } from '../../lib/mark-failed'
import { supabaseAdmin } from '../../lib/supabase-admin'
// Relative path crosses the mastra/ sub-package boundary intentionally —
// the Mastra bundler follows relative imports. Cannot use @/ alias here:
// mastra/tsconfig.json maps @/ to mastra/src/mastra/*, not to the repo root.
import { calculateCostUsd } from '../../../../../lib/pricing'

const SPECIALIST_MODEL = 'claude-sonnet-4-6'

export const runSpecialist = createStep({
  id: 'runSpecialist',
  inputSchema: z.object({
    consultationId: z.string(),
    agentKey: z.string(),
    patientContext: z.string().nullable(),
    files: z.array(z.object({
      file_name: z.string(),
      pdfBytes: z.instanceof(Uint8Array),
    }).passthrough()),
  }),
  outputSchema: z.object({
    consultationId: z.string(),
    result: consultationResultSchema,
    usage: z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    }),
    costUsd: z.number().nonnegative(),
    promptVersionId: z.string().uuid(),
  }),
  execute: async ({ inputData }) => {
    try {
      const agent = agentsByKey[inputData.agentKey as keyof typeof agentsByKey]
      if (!agent) throw new Error(`Agent não encontrado: ${inputData.agentKey}`)

      const { data: specialist, error: specialistError } = await supabaseAdmin
        .from('specialists')
        .select('current_prompt_version_id')
        .eq('agent_key', inputData.agentKey)
        .single()
      if (specialistError || !specialist?.current_prompt_version_id) {
        throw new Error(`Versão de prompt não encontrada para: ${inputData.agentKey}`)
      }
      const promptVersionId = specialist.current_prompt_version_id

      const userText = inputData.patientContext
        ? `Contexto do paciente:\n${inputData.patientContext}\n\nAnalise os exames acima e gere uma segunda opinião.`
        : 'Analise os exames acima e gere uma segunda opinião.'

      const messages = [
        {
          role: 'user' as const,
          content: [
            ...inputData.files.map((f) => ({
              type: 'file' as const,
              mimeType: 'application/pdf',
              data: f.pdfBytes,
            })),
            { type: 'text' as const, text: userText },
          ],
        },
      ]

      const { object, usage } = await agent.generate(messages, {
        structuredOutput: { schema: consultationResultSchema },
      }) as {
        object: z.infer<typeof consultationResultSchema>
        usage?: {
          inputTokens?: number
          outputTokens?: number
          promptTokens?: number
          completionTokens?: number
        }
      }

      const tokens = {
        inputTokens:  usage?.inputTokens  ?? usage?.promptTokens     ?? 0,
        outputTokens: usage?.outputTokens ?? usage?.completionTokens ?? 0,
      }
      if (tokens.inputTokens === 0 && tokens.outputTokens === 0) {
        console.warn(`[runSpecialist] usage missing or zero for consultation=${inputData.consultationId}`)
      }
      const costUsd = calculateCostUsd(SPECIALIST_MODEL, tokens)

      return {
        consultationId: inputData.consultationId,
        result: object,
        usage: tokens,
        costUsd,
        promptVersionId,
      }
    } catch (err) {
      await markConsultationFailed(inputData.consultationId, 'Não conseguimos analisar seus exames. Tente novamente.')
      throw err
    }
  },
})
