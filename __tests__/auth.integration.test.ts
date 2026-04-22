/**
 * Integration tests for Supabase auth.
 * Requires local Supabase running: npx supabase start
 * Run with: npm run test:integration
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const TEST_EMAIL = `integration-test-${Date.now()}@example.com`
const TEST_PASSWORD = 'IntegrationTest123!'

describe('auth integration', () => {
  let createdUserId: string

  beforeAll(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    })
    expect(error).toBeNull()
    createdUserId = data.user!.id
  })

  afterAll(async () => {
    await supabase.auth.admin.deleteUser(createdUserId)
  })

  it('auto-inserts profile row with role=user via trigger on registration', async () => {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', createdUserId)
      .single()

    expect(profileError).toBeNull()
    expect(profile?.role).toBe('user')
    expect(profile?.id).toBe(createdUserId)
  })

  it('allows signing in with valid credentials', async () => {
    const anonClient = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await anonClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })

    expect(error).toBeNull()
    expect(data.user?.email).toBe(TEST_EMAIL)
  })

  it('returns error for invalid credentials', async () => {
    const anonClient = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data, error } = await anonClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: 'wrong-password',
    })

    expect(error).not.toBeNull()
    expect(data.user).toBeNull()
  })
})
