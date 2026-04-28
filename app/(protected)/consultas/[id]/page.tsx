import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ConsultationStatusLive } from '@/components/consultation/consultation-status-live'
import { ConsultationCostCard } from '@/components/admin/consultation-cost-card'

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin'
  }

  // RLS handles authorization: owner sees own consultations via existing policy;
  // admin sees any consultation via "Admins can read all consultations" policy.
  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status, result, failure_reason, patient_context, created_at, input_tokens, output_tokens, cost_usd, specialist:specialists(name, icon)')
    .eq('id', id)
    .single()
  if (!consultation) notFound()

  const { data: files } = await supabase
    .from('consultation_files')
    .select('id, file_name, file_size')
    .eq('consultation_id', id)

  return (
    <div>
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      {/* Cost is set once when status flips to completed. No live update
          needed — admin opening mid-run sees it after refreshing. */}
      {isAdmin && (
        <div className="max-w-2xl mb-6">
          <ConsultationCostCard
            costUsd={consultation.cost_usd}
            inputTokens={consultation.input_tokens}
            outputTokens={consultation.output_tokens}
          />
        </div>
      )}

      <ConsultationStatusLive
        initial={{
          id: consultation.id,
          status: consultation.status,
          result: consultation.result,
          failure_reason: consultation.failure_reason,
          patient_context: consultation.patient_context,
          created_at: consultation.created_at,
          specialist: consultation.specialist,
          files: files ?? [],
        }}
      />
    </div>
  )
}
