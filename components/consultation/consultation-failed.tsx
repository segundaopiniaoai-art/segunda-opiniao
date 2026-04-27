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
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-700 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-red-900">Não conseguimos concluir a análise</p>
          <p className="text-sm text-red-800 mt-1">
            {failureReason ?? 'Algo deu errado durante o processamento.'}
          </p>
        </div>
      </div>
      <Button onClick={handleRetry} disabled={isPending} variant="outline">
        <RefreshCcw className="h-4 w-4 mr-2" />
        {isPending ? 'Reenviando...' : 'Tentar novamente'}
      </Button>
      {retryError && <p className="text-sm text-red-700">{retryError}</p>}
    </div>
  )
}
