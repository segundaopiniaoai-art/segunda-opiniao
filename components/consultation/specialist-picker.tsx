'use client'

import {
  HeartPulse,
  Ribbon,
  Brain,
  Bone,
  ScanFace,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  ribbon: Ribbon,
  brain: Brain,
  bone: Bone,
  'scan-face': ScanFace,
  stethoscope: Stethoscope,
}

export type Specialist = {
  id: string
  name: string
  description: string
  icon: string
}

type Props = {
  specialists: Specialist[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function SpecialistPicker({ specialists, selectedId, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {specialists.map((specialist) => {
        const Icon = iconMap[specialist.icon] ?? Stethoscope
        const isSelected = selectedId === specialist.id

        return (
          <button
            key={specialist.id}
            type="button"
            onClick={() => onSelect(specialist.id)}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors ${
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Icon className={`h-8 w-8 ${isSelected ? 'text-primary' : 'text-gray-400'}`} />
            <div>
              <p className="text-sm font-medium">{specialist.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{specialist.description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
