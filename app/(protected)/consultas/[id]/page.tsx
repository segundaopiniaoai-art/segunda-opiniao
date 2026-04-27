import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ConsultationStatusLive } from '@/components/consultation/consultation-status-live'

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status, result, failure_reason, patient_context, created_at, specialist:specialists(name, icon)')
    .eq('id', id)
    .single()
  if (!consultation) notFound()

  const { data: files } = await supabase
    .from('consultation_files')
    .select('id, file_name, file_size')
    .eq('consultation_id', id)

  return (
    <div>
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <ConsultationStatusLive initial={{ ...consultation, files: files ?? [] }} />
    </div>
  )
}
