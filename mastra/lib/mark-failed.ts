import { supabaseAdmin } from './supabase-admin'

export async function markConsultationFailed(consultationId: string, message: string) {
  await supabaseAdmin
    .from('consultations')
    .update({ status: 'failed', failure_reason: message })
    .eq('id', consultationId)
}
