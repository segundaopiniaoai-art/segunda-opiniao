import { formatCostUsd } from '@/lib/pricing'

type Props = {
  costUsd: number | null
  inputTokens: number | null
  outputTokens: number | null
}

export function ConsultationCostCard({ costUsd, inputTokens, outputTokens }: Props) {
  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <p className="text-sm text-muted-foreground mb-2">Custo da consulta</p>
      {costUsd == null ? (
        <p className="text-sm text-muted-foreground italic">Custo não medido</p>
      ) : (
        <div>
          <p className="font-heading text-2xl font-bold">{formatCostUsd(costUsd)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(inputTokens ?? 0).toLocaleString('pt-BR')} input
            {' · '}
            {(outputTokens ?? 0).toLocaleString('pt-BR')} output tokens
          </p>
        </div>
      )}
    </section>
  )
}
