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
  }),
  outputSchema: z.object({ status: z.enum(['completed', 'failed']) }),
  execute: async ({ inputData }) => {
    try {
      const { error } = await supabaseAdmin
        .from('consultations')
        .update({ status: 'completed', result: inputData.result })
        .eq('id', inputData.consultationId)
      if (error) throw error
      return { status: 'completed' as const }
    } catch (err) {
      await markConsultationFailed(inputData.consultationId, 'Falha ao salvar o resultado.')
      throw err
    }
  },
})
