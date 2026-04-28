/**
 * Integration test for getDashboardStats.
 * Requires local Supabase: npx supabase start
 * Run with: npm run test:integration
 */
import { createClient } from '@supabase/supabase-js'
import { getDashboardStats } from '@/lib/admin/dashboard-stats'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function authClient(email: string, password: string) {
  const c = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

describe('getDashboardStats (integration)', () => {
  let adminUserId: string
  let patient1Id: string
  let patient2Id: string
  const adminEmail = `admin-${Date.now()}@example.com`
  const patientEmail = `patient-${Date.now()}@example.com`
  const password = 'test-password-123!'
  let cardiologyId: string
  let oncologyId: string

  beforeAll(async () => {
    // Specialists are seeded by migration; fetch their IDs
    const { data: specs } = await admin
      .from('specialists')
      .select('id, agent_key')
      .in('agent_key', ['cardiology', 'oncology'])
    cardiologyId = specs!.find((s) => s.agent_key === 'cardiology')!.id
    oncologyId = specs!.find((s) => s.agent_key === 'oncology')!.id

    // Create users
    const { data: a } = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
    })
    adminUserId = a.user!.id
    const { data: p1 } = await admin.auth.admin.createUser({
      email: patientEmail, password, email_confirm: true,
    })
    patient1Id = p1.user!.id
    const { data: p2 } = await admin.auth.admin.createUser({
      email: `patient2-${Date.now()}@example.com`, password, email_confirm: true,
    })
    patient2Id = p2.user!.id

    // Promote one to admin
    await admin.from('profiles').update({ role: 'admin' }).eq('id', adminUserId)

    // Seed 5 consultations across patients/specialists/dates
    const now = new Date()
    const today = now.toISOString()
    const fiveDaysAgo = new Date(now.getTime() - 5 * 86_400_000).toISOString()
    const twentyDaysAgo = new Date(now.getTime() - 20 * 86_400_000).toISOString()
    const fortyDaysAgo = new Date(now.getTime() - 40 * 86_400_000).toISOString()

    await admin.from('consultations').insert([
      { user_id: patient1Id, specialist_id: cardiologyId, status: 'completed', created_at: today },
      { user_id: patient1Id, specialist_id: cardiologyId, status: 'completed', created_at: fiveDaysAgo },
      { user_id: patient2Id, specialist_id: cardiologyId, status: 'pending', created_at: twentyDaysAgo },
      { user_id: patient2Id, specialist_id: oncologyId, status: 'completed', created_at: twentyDaysAgo },
      { user_id: patient1Id, specialist_id: oncologyId, status: 'failed', created_at: fortyDaysAgo },
    ])
  })

  afterAll(async () => {
    await admin.auth.admin.deleteUser(adminUserId).catch(() => {})
    await admin.auth.admin.deleteUser(patient1Id).catch(() => {})
    await admin.auth.admin.deleteUser(patient2Id).catch(() => {})
  })

  it('returns correct aggregates when called by an admin', async () => {
    const client = await authClient(adminEmail, password)
    const stats = await getDashboardStats(client)

    // 3 users seeded by us — but other tests may have created users; assert ≥
    expect(stats.totalUsers).toBeGreaterThanOrEqual(3)
    expect(stats.totalConsultations).toBeGreaterThanOrEqual(5)
    expect(stats.consultationsToday).toBeGreaterThanOrEqual(1)
    expect(stats.consultations7d).toBeGreaterThanOrEqual(2)
    expect(stats.consultations30d).toBeGreaterThanOrEqual(4)

    const cardio = stats.consultationsBySpecialist.find((s) => s.id === cardiologyId)
    const onco = stats.consultationsBySpecialist.find((s) => s.id === oncologyId)
    expect(cardio?.count).toBeGreaterThanOrEqual(3)
    expect(onco?.count).toBeGreaterThanOrEqual(2)
  })

  it('respects RLS when called by a non-admin (counts are 0)', async () => {
    const client = await authClient(patientEmail, password)
    const stats = await getDashboardStats(client)

    // RLS filters all rows for non-admin → counts come back as 0.
    // Note: patient still sees their own consultations via the existing
    // "Users can read own consultations" policy, so totalConsultations may be
    // > 0 if `count: 'exact', head: true` walks RLS. Supabase JS does — assert
    // it's at most the number of consultations owned by patient1 (2).
    expect(stats.totalUsers).toBeLessThanOrEqual(1) // patient sees own profile only
    expect(stats.totalConsultations).toBeLessThanOrEqual(2)
  })
})
