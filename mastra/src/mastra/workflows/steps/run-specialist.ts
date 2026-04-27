import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { agentsByKey } from '../../agents'
import { consultationResultSchema } from '../../schemas/consultation-result'
import { markConsultationFailed } from '../../lib/mark-failed'

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
  }),
  execute: async ({ inputData }) => {
    try {
      // Imported from agents registry directly to avoid circular dep with mastra/index.ts
      const agent = agentsByKey[inputData.agentKey as keyof typeof agentsByKey]
      if (!agent) throw new Error(`Agent não encontrado: ${inputData.agentKey}`)

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

      const { object } = await agent.generate(messages, {
        output: consultationResultSchema,
      })

      return { consultationId: inputData.consultationId, result: object }
    } catch (err) {
      await markConsultationFailed(inputData.consultationId, 'Não conseguimos analisar seus exames. Tente novamente.')
      throw err
    }
  },
})
