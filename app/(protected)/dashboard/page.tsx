import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ConsultationList } from '@/components/dashboard/consultation-list'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: consultations } = await supabase
    .from('consultations')
    .select('id, status, created_at, specialist:specialists(name, icon)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Minhas Consultas</h1>
        <Button asChild>
          <Link href="/consultas/nova">Nova Consulta</Link>
        </Button>
      </div>
      <ConsultationList consultations={consultations ?? []} />
    </div>
  )
}
