import Link from 'next/link'
import { ClipboardPlus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/cn'
import { getSpecialistIcon } from '@/lib/specialist-icons'

type Specialist = { name: string; icon: string }

type Consultation = {
  id: string
  status: string
  created_at: string
  specialist: Specialist | Specialist[]
}

type Props = { consultations: Consultation[] }

export function ConsultationList({ consultations }: Props) {
  if (consultations.length === 0) {
    return (
      <div className="text-center py-16">
        <ClipboardPlus className="mx-auto h-16 w-16 text-primary/30 mb-4" />
        <p className="font-heading text-xl mb-2">Voce ainda nao tem consultas</p>
        <p className="text-muted-foreground mb-6">Crie sua primeira consulta para comecar.</p>
        <Link href="/consultas/nova" className={buttonVariants()}>
          Criar sua primeira consulta
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {consultations.map((consultation) => {
        const specialist = Array.isArray(consultation.specialist)
          ? consultation.specialist[0]
          : consultation.specialist
        const Icon = getSpecialistIcon(specialist?.icon ?? '')
        const date = new Date(consultation.created_at).toLocaleDateString('pt-BR')
        const status = consultation.status as 'pending' | 'processing' | 'completed' | 'failed'

        return (
          <Link
            key={consultation.id}
            href={`/consultas/${consultation.id}`}
            className={cn(
              'bg-surface rounded-lg border border-border p-5 hover:border-primary/30 hover:shadow-md transition-all duration-200 block',
              status === 'processing' && 'animate-pulse border-primary/20'
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-base truncate">
                  {specialist?.name}
                </p>
                <p className="text-sm text-muted-foreground">{date}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <StatusBadge status={status} />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
