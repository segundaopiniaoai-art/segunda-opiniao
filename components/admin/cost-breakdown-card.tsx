import { cn } from '@/lib/cn'
import { getSpecialistIcon } from '@/lib/specialist-icons'
import { formatCostUsd } from '@/lib/pricing'

// Row shape declared inline (structural typing). The `CostBySpecialist` type
// in `lib/admin/dashboard-stats.ts` matches this shape, so consumers can pass
// `stats.costBySpecialist` directly.
type Item = {
  id: string
  name: string
  icon: string
  count: number
  costUsd: number
}

type Props = {
  label: string
  items: Item[]
  className?: string
}

export function CostBreakdownCard({ label, items, className }: Props) {
  return (
    <div className={cn('relative bg-surface border border-border rounded-lg p-5', className)}>
      <p className="text-sm text-muted-foreground mb-4">{label}</p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Sem dados</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = getSpecialistIcon(item.icon)
            return (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    · {item.count.toLocaleString('pt-BR')} consultas
                  </span>
                </span>
                <span className="font-heading font-semibold">
                  {formatCostUsd(item.costUsd)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
