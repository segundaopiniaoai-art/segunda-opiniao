'use client'

import {
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

export type FileUploadStatus = 'pending' | 'uploading' | 'done' | 'error'

export type FileProgress = {
  fileName: string
  fileSize: number
  status: FileUploadStatus
  error?: string
}

type UploadPhase =
  | { type: 'uploading' }
  | { type: 'success' }
  | { type: 'upload-error' }
  | { type: 'confirm-error'; message: string; retryCount: number }

type Props = {
  files: FileProgress[]
  phase: UploadPhase
  onRetryFailed: () => void
  onBackToForm: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUploadProgress({ files, phase, onRetryFailed, onBackToForm }: Props) {
  const title = (() => {
    switch (phase.type) {
      case 'uploading':
        return { text: 'Enviando seus exames...', icon: null }
      case 'success':
        return { text: 'Exames enviados! Iniciando analise...', icon: <CheckCircle className="h-5 w-5 text-success" /> }
      case 'upload-error':
        return { text: 'Erro no envio de alguns arquivos', icon: <AlertTriangle className="h-5 w-5 text-destructive" /> }
      case 'confirm-error':
        return { text: 'Erro ao iniciar analise', icon: <AlertTriangle className="h-5 w-5 text-destructive" /> }
    }
  })()

  return (
    <div
      className="bg-surface rounded-lg border border-border p-6 space-y-4"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {title.icon}
        <h3 className="font-heading font-semibold">{title.text}</h3>
      </div>

      <ul className="space-y-3">
        {files.map((file) => (
          <li key={file.fileName} className="space-y-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <StatusIcon status={file.status} />
              <span className="text-sm truncate min-w-0 flex-1">
                {file.fileName}
              </span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatSize(file.fileSize)}
              </span>
            </div>
            <div
              className="h-1.5 rounded-full bg-border overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                file.status === 'done' ? 100
                : file.status === 'uploading' ? 66
                : file.status === 'error' ? 100
                : 0
              }
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-1000',
                  file.status === 'uploading' && 'w-2/3 bg-primary',
                  file.status === 'done' && 'w-full bg-success',
                  file.status === 'error' && 'w-full bg-destructive',
                  file.status === 'pending' && 'w-0'
                )}
              />
            </div>
            {file.status === 'error' && file.error && (
              <p className="text-xs text-destructive">{file.error}</p>
            )}
          </li>
        ))}
      </ul>

      {phase.type === 'upload-error' && (
        <Button onClick={onRetryFailed} variant="outline">
          Tentar novamente
        </Button>
      )}

      {phase.type === 'confirm-error' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{phase.message}</p>
          {phase.retryCount < 2 ? (
            <Button onClick={onRetryFailed} variant="outline">
              Tentar novamente
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                Erro persistente. Tente criar uma nova consulta.
              </p>
              <Button onClick={onBackToForm} variant="outline">
                Voltar ao formulario
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: FileUploadStatus }) {
  switch (status) {
    case 'uploading':
      return <Upload className="h-4 w-4 text-primary flex-shrink-0" />
    case 'done':
      return <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
    default:
      return <div className="h-4 w-4 flex-shrink-0" />
  }
}
