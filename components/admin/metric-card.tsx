import { cn } from '@/lib/cn'

type Props = {
  label: string
  value?: number
  placeholder?: boolean
  className?: string
}

export function MetricCard({ label, value, placeholder, className }: Props) {
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
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-2 font-heading text-3xl font-bold',
          placeholder ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {placeholder ? '—' : (value ?? 0).toLocaleString('pt-BR')}
      </p>
    </div>
  )
}
