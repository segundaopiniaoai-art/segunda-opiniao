'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { retryConsultation } from '@/actions/consultation'
import { Button } from '@/components/ui/button'

type Props = {
  consultationId: string
  failureReason: string | null
}

export function ConsultationFailed({ consultationId, failureReason }: Props) {
  const [isPending, startTransition] = useTransition()
  const [retryError, setRetryError] = useState<string | null>(null)

  const handleRetry = () => {
    setRetryError(null)
    startTransition(async () => {
      const result = await retryConsultation(consultationId)
      if ('error' in result) {
        setRetryError(result.error)
      }
    })
  }

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-heading font-medium text-destructive">
            Nao conseguimos concluir a analise
          </p>
          <p className="text-sm text-destructive/80 mt-1">
            {failureReason ?? 'Algo deu errado durante o processamento.'}
          </p>
        </div>
      </div>
      <Button onClick={handleRetry} disabled={isPending} variant="outline">
        <RefreshCcw className="h-4 w-4 mr-2" />
        {isPending ? 'Reenviando...' : 'Tentar novamente'}
      </Button>
      {retryError && <p className="text-sm text-destructive">{retryError}</p>}
    </div>
  )
}
