'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export type StepState = 'future' | 'current' | 'complete'

type Step = {
  label: string
  ref: React.RefObject<HTMLElement | null>
}

type Props = {
  steps: Step[]
  completionState: StepState[]
  isSending?: boolean
}

export function FormStepper({ steps, completionState, isSending }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visible.length > 0) {
          const el = visible[0].target
          const idx = steps.findIndex((s) => s.ref.current === el)
          if (idx !== -1) setActiveIndex(idx)
        }
      },
      { threshold: 0.5, rootMargin: '-10% 0px' }
    )

    steps.forEach((step) => {
      if (step.ref.current) observerRef.current?.observe(step.ref.current)
    })

    return () => observerRef.current?.disconnect()
  }, [steps])

  const handleClick = (index: number) => {
    steps[index].ref.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      role="navigation"
      aria-label="Progresso do formulario"
      className="flex items-center gap-2 py-4"
    >
      {steps.map((step, i) => {
        const state = isSending ? 'complete' : completionState[i]

        return (
          <div key={step.label} className="flex items-center gap-2 flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => handleClick(i)}
              aria-current={!isSending && activeIndex === i ? 'step' : undefined}
              className="flex items-center gap-2"
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium flex-shrink-0 transition-colors',
                  state === 'complete' && 'bg-primary text-white',
                  state === 'current' && 'border-2 border-primary text-primary',
                  state === 'future' && 'border border-border text-muted-foreground'
                )}
              >
                {state === 'complete' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  'text-sm sr-only sm:not-sr-only sm:inline whitespace-nowrap',
                  state === 'complete' && 'text-foreground font-medium',
                  state === 'current' && 'text-primary font-semibold',
                  state === 'future' && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </button>

            {i < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 rounded-full',
                  state === 'complete' ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        )
      })}

      {isSending && (
        <div className="flex items-center gap-2 ml-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-primary font-semibold hidden sm:inline">
            Enviando
          </span>
        </div>
      )}
    </nav>
  )
}
