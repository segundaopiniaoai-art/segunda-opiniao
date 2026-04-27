import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { markConsultationFailed } from '../../lib/mark-failed'

export const loadContext = createStep({
  id: 'loadContext',
  inputSchema: z.object({ consultationId: z.string().uuid() }),
  outputSchema: z.object({
    consultationId: z.string(),
    userId: z.string(),
    agentKey: z.string(),
    patientContext: z.string().nullable(),
    files: z.array(z.object({
      id: z.string(),
      file_name: z.string(),
      storage_path: z.string(),
      file_size: z.number(),
    })),
  }),
  execute: async ({ inputData }) => {
    const { consultationId } = inputData
    try {
      const { data: consultation, error: cErr } = await supabaseAdmin
        .from('consultations')
        .select('id, user_id, status, patient_context, specialist:specialists(agent_key)')
        .eq('id', consultationId)
        .single()
      if (cErr || !consultation) throw new Error('Consulta não encontrada')
      if (consultation.status !== 'processing') {
        throw new Error(`Consulta em estado inesperado: ${consultation.status}`)
      }
      const specialist = Array.isArray(consultation.specialist)
        ? consultation.specialist[0]
        : consultation.specialist
      if (!specialist?.agent_key) throw new Error('Especialista sem agent_key')

      const { data: files, error: fErr } = await supabaseAdmin
        .from('consultation_files')
        .select('id, file_name, storage_path, file_size')
        .eq('consultation_id', consultationId)
      if (fErr || !files?.length) throw new Error('Nenhum arquivo associado à consulta')

      return {
        consultationId,
        userId: consultation.user_id,
        agentKey: specialist.agent_key,
        patientContext: consultation.patient_context,
        files,
      }
    } catch (err) {
      await markConsultationFailed(consultationId, 'Não conseguimos carregar a consulta. Tente novamente.')
      throw err
    }
  },
})
