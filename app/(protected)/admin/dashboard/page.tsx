import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardStats } from '@/lib/admin/dashboard-stats'
import { DashboardSection } from '@/components/admin/dashboard-section'
import { MetricCard } from '@/components/admin/metric-card'
import { BreakdownCard } from '@/components/admin/breakdown-card'
import { CostBreakdownCard } from '@/components/admin/cost-breakdown-card'
import { formatCostUsd } from '@/lib/pricing'

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

  const sinceLabel = stats.costMeasurementSince
    ? new Date(stats.costMeasurementSince).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

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

      <section>
        <header className="flex items-center gap-2 mb-4">
          <h2 className="font-heading text-lg font-semibold">Custos</h2>
        </header>
        {sinceLabel === null ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma consulta medida ainda.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard label="Total de custo" formattedValue={formatCostUsd(stats.totalCostUsd)} />
              <MetricCard label="Hoje" formattedValue={formatCostUsd(stats.costToday)} />
              <MetricCard label="Últimos 7 dias" formattedValue={formatCostUsd(stats.cost7d)} />
              <MetricCard label="Últimos 30 dias" formattedValue={formatCostUsd(stats.cost30d)} />
              <MetricCard label="Médio por consulta" formattedValue={formatCostUsd(stats.avgCostPerConsultation)} />
              <CostBreakdownCard
                label="Por especialista"
                items={stats.costBySpecialist}
                className="md:col-span-2 lg:col-span-3"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Medindo custos desde {sinceLabel}.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
