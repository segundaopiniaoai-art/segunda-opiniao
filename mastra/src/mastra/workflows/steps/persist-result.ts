import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { consultationResultSchema } from '../../schemas/consultation-result'
import { markConsultationFailed } from '../../lib/mark-failed'

export const persistResult = createStep({
  id: 'persistResult',
  inputSchema: z.object({
    consultationId: z.string(),
    result: consultationResultSchema,
    usage: z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    }),
    costUsd: z.number().nonnegative(),
    promptVersionId: z.string().uuid(),
  }),
  outputSchema: z.object({ status: z.enum(['completed', 'failed']) }),
  execute: async ({ inputData }) => {
    // Mastra validates inputSchema before execute runs; only errors thrown
    // *inside* this block (e.g., Supabase failures) reach the catch.
    try {
      const { error } = await supabaseAdmin
        .from('consultations')
        .update({
          status: 'completed',
          result: inputData.result,
          input_tokens: inputData.usage.inputTokens,
          output_tokens: inputData.usage.outputTokens,
          cost_usd: inputData.costUsd,
          prompt_version_id: inputData.promptVersionId,
        })
        .eq('id', inputData.consultationId)
      if (error) throw error
      return { status: 'completed' as const }
    } catch (err) {
      await markConsultationFailed(inputData.consultationId, 'Falha ao salvar o resultado.')
      throw err
    }
  },
})
