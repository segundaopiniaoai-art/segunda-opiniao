import { createClient } from '@/lib/supabase/server'
import { ConsultationForm } from '@/components/consultation/consultation-form'

export default async function NovaConsultaPage() {
  const supabase = await createClient()

  const { data: specialists } = await supabase
    .from('specialists')
    .select('id, name, description, icon')
    .eq('active', true)
    .order('name')

  return (
    <div>
      <h1 className="font-heading text-2xl md:text-3xl font-bold mb-6">Nova Consulta</h1>
      <ConsultationForm specialists={specialists ?? []} />
    </div>
  )
}
