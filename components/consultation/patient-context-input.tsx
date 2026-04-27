'use client'

const MAX = 2000

type Props = {
  value: string
  onChange: (v: string) => void
}

export function PatientContextInput({ value, onChange }: Props) {
  const remaining = MAX - value.length
  return (
    <div>
      <label htmlFor="patient-context" className="block text-sm font-medium mb-2">
        Conte sobre sua dúvida ou sintomas (opcional)
      </label>
      <textarea
        id="patient-context"
        value={value}
        maxLength={MAX}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-lg border p-3 text-sm"
        placeholder="Ex.: tenho sentido falta de ar e meu médico pediu esses exames…"
      />
      <p className={`text-xs mt-1 ${remaining < 100 ? 'text-orange-600' : 'text-gray-400'}`}>
        {value.length} / {MAX}
      </p>
    </div>
  )
}
