import {
  HeartPulse, Ribbon, Brain, Bone, ScanFace, Stethoscope,
  type LucideIcon,
} from 'lucide-react'

export const specialistIconMap: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  ribbon: Ribbon,
  brain: Brain,
  bone: Bone,
  'scan-face': ScanFace,
  stethoscope: Stethoscope,
}

export function getSpecialistIcon(icon: string): LucideIcon {
  return specialistIconMap[icon] ?? Stethoscope
}
