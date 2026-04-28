import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardStats } from '@/lib/admin/dashboard-stats'
import { DashboardSection } from '@/components/admin/dashboard-section'
import { MetricCard } from '@/components/admin/metric-card'
import { BreakdownCard } from '@/components/admin/breakdown-card'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Defense in depth — middleware already redirects non-admins, but role can
  // change mid-session before middleware revalidates.
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const stats = await getDashboardStats(supabase)

  return (
    <div className="space-y-10">
      <h1 className="font-heading text-2xl md:text-3xl font-bold">Dashboard</h1>

      <DashboardSection title="Usuários">
        <MetricCard label="Total de usuários" value={stats.totalUsers} />
        <MetricCard label="Novos (últimos 7 dias)" value={stats.newUsers7d} />
        <MetricCard label="Novos (últimos 30 dias)" value={stats.newUsers30d} />
      </DashboardSection>

      <DashboardSection title="Consultas">
        <MetricCard label="Total" value={stats.totalConsultations} />
        <MetricCard label="Hoje" value={stats.consultationsToday} />
        <MetricCard label="Últimos 7 dias" value={stats.consultations7d} />
        <MetricCard label="Últimos 30 dias" value={stats.consultations30d} />
        <BreakdownCard
          label="Por especialista"
          items={stats.consultationsBySpecialist}
          className="md:col-span-2 lg:col-span-3"
        />
      </DashboardSection>

      <DashboardSection title="Custos" comingSoon>
        <MetricCard label="Total de custo" placeholder />
        <MetricCard label="Hoje" placeholder />
        <MetricCard label="Últimos 7 dias" placeholder />
        <MetricCard label="Últimos 30 dias" placeholder />
        <BreakdownCard
          label="Por especialista"
          placeholder
          className="md:col-span-2 lg:col-span-3"
        />
        <BreakdownCard
          label="Top 10 por usuário"
          placeholder
          className="md:col-span-2 lg:col-span-3"
        />
      </DashboardSection>
    </div>
  )
}
