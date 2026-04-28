import type { SupabaseClient } from '@supabase/supabase-js'
import { getDateBoundaries } from '@/lib/admin/date-boundaries'

export type SpecialistBreakdown = {
  id: string
  name: string
  icon: string
  count: number
}

export type CostBySpecialist = {
  id: string
  name: string
  icon: string
  count: number
  costUsd: number
}

export type DashboardStats = {
  totalUsers: number
  newUsers7d: number
  newUsers30d: number
  totalConsultations: number
  consultationsToday: number
  consultations7d: number
  consultations30d: number
  consultationsBySpecialist: SpecialistBreakdown[]
  totalCostUsd: number
  costToday: number
  cost7d: number
  cost30d: number
  avgCostPerConsultation: number
  costBySpecialist: CostBySpecialist[]
  costMeasurementSince: string | null
}

type DashboardCostsRpc = {
  totalCostUsd: number
  costToday: number
  cost7d: number
  cost30d: number
  measuredCount: number
  costMeasurementSince: string | null
}

const safeCount = (label: string, res: { count: number | null; error: unknown }) => {
  if (res.error) console.error(`[admin-dashboard] ${label}`, res.error)
  return res.count ?? 0
}

const EMPTY_COSTS: DashboardCostsRpc = {
  totalCostUsd: 0,
  costToday: 0,
  cost7d: 0,
  cost30d: 0,
  measuredCount: 0,
  costMeasurementSince: null,
}

export async function getDashboardStats(supabase: SupabaseClient): Promise<DashboardStats> {
  const { startOfToday, sevenDaysAgo, thirtyDaysAgo } = getDateBoundaries()

  const [
    totalUsersRes,
    newUsers7dRes,
    newUsers30dRes,
    totalConsultationsRes,
    consultationsTodayRes,
    consultations7dRes,
    consultations30dRes,
    bySpecialistRes,
    costsRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    supabase.from('consultations').select('*', { count: 'exact', head: true }),
    supabase.from('consultations').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday),
    supabase.from('consultations').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('consultations').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    supabase
      .from('consultation_counts_by_specialist')
      .select('id, name, icon, count, measured_count, cost_usd')
      .order('count', { ascending: false }),
    supabase.rpc('get_dashboard_costs'),
  ])

  const breakdownRows = bySpecialistRes.error
    ? (console.error('[admin-dashboard] bySpecialist', bySpecialistRes.error), [])
    : (bySpecialistRes.data ?? [])

  const consultationsBySpecialist: SpecialistBreakdown[] = breakdownRows.map((r) => ({
    id: r.id, name: r.name, icon: r.icon, count: r.count,
  }))

  const costBySpecialist: CostBySpecialist[] = breakdownRows
    .map((r) => ({
      id: r.id,
      name: r.name,
      icon: r.icon,
      count: r.measured_count,
      costUsd: Number(r.cost_usd) || 0,
    }))
    .filter((r) => r.costUsd > 0)
    .sort((a, b) => b.costUsd - a.costUsd)

  const costsRaw: DashboardCostsRpc = costsRes.error
    ? (console.error('[admin-dashboard] costs', costsRes.error), EMPTY_COSTS)
    : { ...EMPTY_COSTS, ...(costsRes.data as Partial<DashboardCostsRpc>) }

  const costs: DashboardCostsRpc = {
    totalCostUsd: Number(costsRaw.totalCostUsd) || 0,
    costToday: Number(costsRaw.costToday) || 0,
    cost7d: Number(costsRaw.cost7d) || 0,
    cost30d: Number(costsRaw.cost30d) || 0,
    measuredCount: Number(costsRaw.measuredCount) || 0,
    costMeasurementSince: costsRaw.costMeasurementSince ?? null,
  }
  const avgCostPerConsultation = costs.measuredCount > 0
    ? costs.totalCostUsd / costs.measuredCount
    : 0

  return {
    totalUsers: safeCount('totalUsers', totalUsersRes),
    newUsers7d: safeCount('newUsers7d', newUsers7dRes),
    newUsers30d: safeCount('newUsers30d', newUsers30dRes),
    totalConsultations: safeCount('totalConsultations', totalConsultationsRes),
    consultationsToday: safeCount('consultationsToday', consultationsTodayRes),
    consultations7d: safeCount('consultations7d', consultations7dRes),
    consultations30d: safeCount('consultations30d', consultations30dRes),
    consultationsBySpecialist,
    totalCostUsd: costs.totalCostUsd,
    costToday: costs.costToday,
    cost7d: costs.cost7d,
    cost30d: costs.cost30d,
    avgCostPerConsultation,
    costBySpecialist,
    costMeasurementSince: costs.costMeasurementSince,
  }
}
