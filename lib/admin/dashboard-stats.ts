import type { SupabaseClient } from '@supabase/supabase-js'
import { getDateBoundaries } from '@/lib/admin/date-boundaries'

export type SpecialistBreakdown = {
  id: string
  name: string
  icon: string
  count: number
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
}

const safeCount = (label: string, res: { count: number | null; error: unknown }) => {
  if (res.error) console.error(`[admin-dashboard] ${label}`, res.error)
  return res.count ?? 0
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
      .select('id, name, icon, count')
      .order('count', { ascending: false }),
  ])

  return {
    totalUsers: safeCount('totalUsers', totalUsersRes),
    newUsers7d: safeCount('newUsers7d', newUsers7dRes),
    newUsers30d: safeCount('newUsers30d', newUsers30dRes),
    totalConsultations: safeCount('totalConsultations', totalConsultationsRes),
    consultationsToday: safeCount('consultationsToday', consultationsTodayRes),
    consultations7d: safeCount('consultations7d', consultations7dRes),
    consultations30d: safeCount('consultations30d', consultations30dRes),
    consultationsBySpecialist: bySpecialistRes.error
      ? (console.error('[admin-dashboard] bySpecialist', bySpecialistRes.error), [])
      : (bySpecialistRes.data ?? []),
  }
}
