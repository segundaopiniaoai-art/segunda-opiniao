import { cn } from '@/lib/cn'
import {
  Clock,
  Loader2,
  CheckCircle,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

type Status = 'pending' | 'processing' | 'completed' | 'failed'

const config: Record<Status, { label: string; icon: LucideIcon; classes: string; iconClasses?: string }> = {
  pending: {
    label: 'Aguardando upload',
    icon: Clock,
    classes: 'bg-muted/50 text-muted-foreground',
  },
  processing: {
    label: 'Em processamento',
    icon: Loader2,
    classes: 'bg-primary/10 text-primary',
    iconClasses: 'animate-spin',
  },
  completed: {
    label: 'Concluida',
    icon: CheckCircle,
    classes: 'bg-success/10 text-success',
  },
  failed: {
    label: 'Falhou',
    icon: AlertTriangle,
    classes: 'bg-destructive/10 text-destructive',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: Status
  className?: string
}) {
  const { label, icon: Icon, classes, iconClasses } = config[status] ?? config.pending

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
        classes,
        className
      )}
    >
      <Icon className={cn('h-3 w-3', iconClasses)} />
      {label}
    </span>
  )
}
