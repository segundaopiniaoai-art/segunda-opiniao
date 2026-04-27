'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { FileText, Loader2 } from 'lucide-react'
import {
  HeartPulse, Ribbon, Brain, Bone, ScanFace, Stethoscope, type LucideIcon,
} from 'lucide-react'
import { ConsultationResult } from './consultation-result'
import { ConsultationFailed } from './consultation-failed'
import type { ConsultationResult as Result } from '@/mastra/schemas/consultation-result'

const iconMap: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  ribbon: Ribbon,
  brain: Brain,
  bone: Bone,
  'scan-face': ScanFace,
  stethoscope: Stethoscope,
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguardando upload', color: 'bg-gray-100 text-gray-700' },
  processing: { label: 'Analisando seus exames…', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Concluída', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-800' },
}

type ConsultationFile = { id: string; file_name: string; file_size: number }

export type ConsultationRow = {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result: Result | null
  failure_reason: string | null
  patient_context: string | null
  created_at: string
  specialist: { name: string; icon: string } | { name: string; icon: string }[]
  files: ConsultationFile[]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ConsultationStatusLive({ initial }: { initial: ConsultationRow }) {
  const [consultation, setConsultation] = useState(initial)

  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const channel = supabase
      .channel(`consultation-${initial.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consultations',
          filter: `id=eq.${initial.id}`,
        },
        (payload) => {
          const next = payload.new as Partial<ConsultationRow>
          setConsultation((prev) => ({ ...prev, ...next }))
          if (next.status === 'completed' || next.status === 'failed') {
            supabase.removeChannel(channel)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initial.id])

  const specialist = Array.isArray(consultation.specialist)
    ? consultation.specialist[0]
    : consultation.specialist
  const Icon = iconMap[specialist?.icon ?? ''] ?? Stethoscope
  const status = statusConfig[consultation.status] ?? statusConfig.pending
  const date = new Date(consultation.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Consulta</h1>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
          {status.label}
        </span>
      </div>
      <p className="text-sm text-gray-500">{date}</p>

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">Especialista</h2>
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-primary" />
          <span className="font-medium">{specialist?.name}</span>
        </div>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">
          Arquivos enviados ({consultation.files.length})
        </h2>
        <ul className="space-y-2">
          {consultation.files.map((file) => (
            <li key={file.id} className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm">{file.file_name}</span>
              <span className="text-xs text-gray-400">{formatFileSize(file.file_size)}</span>
            </li>
          ))}
        </ul>
      </section>

      {consultation.patient_context && (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Contexto compartilhado</h2>
          <p className="text-sm whitespace-pre-wrap">{consultation.patient_context}</p>
        </section>
      )}

      {consultation.status === 'processing' && (
        <div className="flex items-center gap-3 rounded-xl border bg-blue-50 p-4 text-sm text-blue-900">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analisando seus exames…
        </div>
      )}

      {consultation.status === 'completed' && consultation.result && (
        <ConsultationResult result={consultation.result} />
      )}

      {consultation.status === 'failed' && (
        <ConsultationFailed
          consultationId={consultation.id}
          failureReason={consultation.failure_reason}
        />
      )}
    </div>
  )
}
