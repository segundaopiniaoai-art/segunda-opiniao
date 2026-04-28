'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/cn'

const STEP_INTERVAL = 30_000

const decorativeSteps = [
  'Lendo documentos',
  'Analisando resultados',
  'Preparando relatorio',
]

export function ProcessingCard() {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= decorativeSteps.length - 1) return prev
        return prev + 1
      })
    }, STEP_INTERVAL)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-8 text-center space-y-6">
      <div className="space-y-2">
        <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
        <h3 className="font-heading text-lg font-semibold">
          Analisando seus exames...
        </h3>
        <p className="text-sm text-muted-foreground">
          Isso pode levar alguns minutos. Voce pode sair e voltar a qualquer
          momento — o resultado aparecera automaticamente.
        </p>
      </div>

      <ul className="space-y-3 text-left max-w-xs mx-auto" aria-live="polite">
        {decorativeSteps.map((step, i) => (
          <li key={step} className="flex items-center gap-3">
            <StepIcon index={i} current={currentStep} />
            <span
              className={cn(
                'text-sm transition-opacity duration-300',
                i <= currentStep ? 'opacity-100' : 'opacity-60'
              )}
            >
              {step}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StepIcon({ index, current }: { index: number; current: number }) {
  if (index < current) {
    return <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
  }
  if (index === current) {
    return <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
  }
  return <Circle className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />
}
