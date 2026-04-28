'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { FileText, Clock } from 'lucide-react'
import {
  HeartPulse, Ribbon, Brain, Bone, ScanFace, Stethoscope, type LucideIcon,
} from 'lucide-react'
import { ConsultationResult } from './consultation-result'
import { ConsultationFailed } from './consultation-failed'
import { ProcessingCard } from './processing-card'
import { StatusBadge } from '@/components/ui/status-badge'
import type { ConsultationResult as Result } from '@/lib/schemas/consultation-result'

const iconMap: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  ribbon: Ribbon,
  brain: Brain,
  bone: Bone,
  'scan-face': ScanFace,
  stethoscope: Stethoscope,
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
  const [showResult, setShowResult] = useState(initial.status === 'completed')
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    if (initial.status === 'completed' || initial.status === 'failed') return

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

          if (next.status === 'completed') {
            setFadeOut(true)
            setTimeout(() => setShowResult(true), 500)
            supabase.removeChannel(channel)
          }
          if (next.status === 'failed') {
            setFadeOut(true)
            supabase.removeChannel(channel)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initial.id, initial.status])

  const specialist = Array.isArray(consultation.specialist)
    ? consultation.specialist[0]
    : consultation.specialist
  const Icon = iconMap[specialist?.icon ?? ''] ?? Stethoscope
  const date = new Date(consultation.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-heading text-2xl font-bold">
            Consulta com {specialist?.name}
          </h1>
          <StatusBadge status={consultation.status} />
        </div>
        <p className="text-sm text-muted-foreground">{date}</p>
      </div>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Especialista</h2>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <span className="font-heading font-semibold">{specialist?.name}</span>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          Arquivos enviados ({consultation.files.length})
        </h2>
        <ul className="space-y-2">
          {consultation.files.map((file) => (
            <li key={file.id} className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm truncate min-w-0">{file.file_name}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatFileSize(file.file_size)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {consultation.patient_context && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Contexto compartilhado</h2>
          <p className="text-sm whitespace-pre-wrap">{consultation.patient_context}</p>
        </section>
      )}

      {consultation.status === 'pending' && (
        <div className="bg-muted/30 border border-border rounded-lg p-8 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-heading text-lg font-semibold text-muted-foreground">
            Aguardando envio dos exames...
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            O upload dos seus exames ainda nao foi concluido.
          </p>
        </div>
      )}

      {consultation.status === 'processing' && !fadeOut && (
        <ProcessingCard />
      )}

      {consultation.status === 'processing' && fadeOut && !showResult && (
        <div className="transition-opacity duration-300 opacity-0">
          <ProcessingCard />
        </div>
      )}

      <div className="sr-only" aria-live="assertive">
        {consultation.status === 'completed' && 'Resultado da consulta disponivel'}
        {consultation.status === 'failed' && 'Erro na analise da consulta'}
      </div>

      {showResult && consultation.result && (
        <ConsultationResult result={consultation.result} />
      )}

      {consultation.status === 'failed' && (
        <div className={fadeOut ? 'animate-fade-in-up' : ''}>
          <ConsultationFailed
            consultationId={consultation.id}
            failureReason={consultation.failure_reason}
          />
        </div>
      )}
    </div>
  )
}
