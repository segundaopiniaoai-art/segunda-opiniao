import Link from 'next/link'
import {
  HeartPulse, Ribbon, Brain, Bone, ScanFace, Stethoscope, ClipboardPlus,
  type LucideIcon,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'

const iconMap: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  ribbon: Ribbon,
  brain: Brain,
  bone: Bone,
  'scan-face': ScanFace,
  stethoscope: Stethoscope,
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguardando upload', color: 'bg-gray-100 text-gray-700' },
  processing: { label: 'Em processamento', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Concluída', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-800' },
}

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
        <ClipboardPlus className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500 mb-4">Você ainda não tem consultas</p>
        <Link href="/consultas/nova" className={buttonVariants()}>Criar sua primeira consulta</Link>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {consultations.map((consultation) => {
        const specialist = Array.isArray(consultation.specialist)
          ? consultation.specialist[0]
          : consultation.specialist
        const Icon = iconMap[specialist?.icon ?? ''] ?? Stethoscope
        const status = statusConfig[consultation.status] ?? statusConfig.pending
        const date = new Date(consultation.created_at).toLocaleDateString('pt-BR')

        return (
          <Link
            key={consultation.id}
            href={`/consultas/${consultation.id}`}
            className="flex items-center gap-4 rounded-xl border p-4 hover:bg-gray-50 transition-colors"
          >
            <Icon className="h-6 w-6 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{specialist?.name}</p>
              <p className="text-xs text-gray-400">{date}</p>
            </div>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${status.color}`}
            >
              {status.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
