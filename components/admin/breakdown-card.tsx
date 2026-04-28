import { cn } from '@/lib/cn'
import { getSpecialistIcon } from '@/lib/specialist-icons'
import type { SpecialistBreakdown } from '@/lib/admin/dashboard-stats'

type Props = {
  label: string
  items?: SpecialistBreakdown[]
  placeholder?: boolean
  className?: string
}

export function BreakdownCard({ label, items, placeholder, className }: Props) {
  return (
    <div
      className={cn(
        'relative bg-surface border border-border rounded-lg p-5',
        placeholder && 'opacity-70',
        className,
      )}
    >
      {placeholder && (
        <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
          Em breve
        </span>
      )}
      <p className="text-sm text-muted-foreground mb-4">{label}</p>

      {placeholder || !items?.length ? (
        <p className="text-sm text-muted-foreground italic">
          {placeholder ? 'Disponível em breve' : 'Sem dados'}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = getSpecialistIcon(item.icon)
            return (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{item.name}</span>
                </span>
                <span className="font-heading font-semibold">
                  {item.count.toLocaleString('pt-BR')}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
