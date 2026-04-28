# Admin Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar a experiência do admin no layout `(protected)`, com um item colapsável "Administração" na sidebar contendo um sub-menu Dashboard que exibe cards agregados de usuários, consultas e custos (cards de custo são placeholder "em breve").

**Architecture:** Layout `(protected)` busca `profile.role` server-side e propaga `isAdmin` para `CollapsibleSidebar` (accordion Radix com sub-itens) e `BottomNav` (3º item). Dashboard é Server Component que faz 8 queries em paralelo via helper `getDashboardStats`. Acesso admin a dados agregados é liberado por novas RLS policies em `profiles` e `consultations`, mais uma view `consultation_counts_by_specialist` com `security_invoker = true`.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (`@supabase/ssr` + `@supabase/supabase-js`), Tailwind 4, Radix Accordion, Jest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-28-admin-dashboard-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/20260428000000_admin_read_policies.sql` — `is_admin()` function, admin SELECT policies, breakdown view
- `lib/admin/date-boundaries.ts` — calcula `startOfToday` (SP), `sevenDaysAgo`, `thirtyDaysAgo`
- `lib/admin/dashboard-stats.ts` — `getDashboardStats(supabase)` retorna `DashboardStats`
- `lib/specialist-icons.ts` — extrai o `iconMap` reutilizável (hoje inline em `components/dashboard/consultation-list.tsx`)
- `components/admin/dashboard-section.tsx` — wrapper de seção (header + grid)
- `components/admin/metric-card.tsx` — card numérico com variante `placeholder`
- `components/admin/breakdown-card.tsx` — card de lista com variante `placeholder`
- `app/(protected)/admin/dashboard/page.tsx` — Server Component da página
- `__tests__/lib/admin/date-boundaries.test.ts` — unit test do utilitário
- `__tests__/admin/dashboard-stats.integration.test.ts` — integration test ponta-a-ponta

**Modify:**
- `app/(protected)/layout.tsx` — busca role, passa `isAdmin` para sidebar + bottomnav
- `components/layout/collapsible-sidebar.tsx` — `isAdmin` prop, accordion Administração
- `components/layout/bottom-nav.tsx` — `isAdmin` prop, 3º item condicional
- `components/dashboard/consultation-list.tsx` — usa `iconMap` extraído
- `jest.config.ts` — atualizar pattern de integration tests para glob (`*.integration.test.ts`)

**Delete:**
- `app/(admin)/layout.tsx`
- `app/(admin)/error.tsx`
- `app/(admin)/admin/users/page.tsx`
- `app/(admin)/admin/costs/page.tsx`
- diretório `app/(admin)/` inteiro após esvaziado

---

## Task 1: Database migration (RLS policies + breakdown view)

**Files:**
- Create: `supabase/migrations/20260428000000_admin_read_policies.sql`

- [ ] **Step 1: Create the migration file**

Conteúdo exato:

```sql
-- Helper to check admin role (avoids recursion in RLS policies)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- profiles: admin can read all rows
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- consultations: admin can read all rows
create policy "Admins can read all consultations"
  on public.consultations for select
  using (public.is_admin());

-- View for "consultas por especialista" breakdown.
-- security_invoker = true makes the view run with the caller's privileges,
-- so RLS on base tables is enforced per request. Without this flag, the view
-- runs as its owner and bypasses RLS — counts would leak to non-admins.
create view public.consultation_counts_by_specialist
  with (security_invoker = true) as
  select s.id, s.name, s.icon, count(c.id) as count
  from public.specialists s
  left join public.consultations c on c.specialist_id = s.id
  group by s.id, s.name, s.icon;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db reset` (recreates DB from all migrations + seeds)

Expected: no errors; final line "Finished supabase db reset". If `supabase` is not running, start it first: `npx supabase start`.

- [ ] **Step 3: Smoke-test the policy + view manually**

Open Supabase Studio (`http://localhost:54323`) → SQL editor and run:

```sql
-- Should succeed and return [] (no rows yet, no auth context)
select * from public.consultation_counts_by_specialist;

-- Should return TRUE/FALSE depending on session — in studio with no auth, FALSE
select public.is_admin();
```

Expected: view returns 6 rows (one per seeded specialist) with `count = 0`. `is_admin()` returns `false` in unauthenticated SQL editor.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428000000_admin_read_policies.sql
git commit -m "feat(supabase): add admin RLS policies and consultation breakdown view"
```

---

## Task 2: Delete old (admin) route group

**Files:**
- Delete: `app/(admin)/` (entire directory)

The spec replaces this layout with the unified `(protected)` layout.

- [ ] **Step 1: Verify nothing imports from `app/(admin)/`**

Run: `grep -r "(admin)" --include="*.ts" --include="*.tsx" --include="*.json" --include="*.md" .` (exclude node_modules, .next, docs)

Expected: matches only inside `docs/`, `app/(admin)/...` files themselves, and possibly the spec we just wrote. No imports from `lib/`, `components/`, or other `app/` files.

- [ ] **Step 2: Delete the directory**

```bash
rm -rf "app/(admin)"
```

- [ ] **Step 3: Run lint + typecheck + tests**

Run: `npm run lint && npx tsc --noEmit && npm test`

Expected: all green. The existing `__tests__/lib/auth/route-access.test.ts` still passes — it tests the access logic against `/admin/users` and `/admin/costs` paths, but the lib doesn't care whether routes exist.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): remove standalone (admin) route group

Replaced by unified (protected) layout with collapsible Administração
section per spec 2026-04-28-admin-dashboard-design.md"
```

---

## Task 3: TDD `getDateBoundaries` utility

**Files:**
- Create: `lib/admin/date-boundaries.ts`
- Test: `__tests__/lib/admin/date-boundaries.test.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/lib/admin/date-boundaries.test.ts`:

```ts
import { getDateBoundaries } from '@/lib/admin/date-boundaries'

describe('getDateBoundaries', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  it('startOfToday is midnight São Paulo for a noon-SP moment', () => {
    // 2026-05-15 12:00 UTC == 2026-05-15 09:00 SP (UTC-3)
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T12:00:00Z'))

    const { startOfToday } = getDateBoundaries()
    // 00:00 SP on 2026-05-15 == 03:00 UTC the same date
    expect(startOfToday).toBe('2026-05-15T03:00:00.000Z')
  })

  it('startOfToday uses SP calendar date when UTC and SP are on different days', () => {
    // 2026-05-15 02:00 UTC == 2026-05-14 23:00 SP — still "today" = 2026-05-14 in SP
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T02:00:00Z'))

    const { startOfToday } = getDateBoundaries()
    expect(startOfToday).toBe('2026-05-14T03:00:00.000Z')
  })

  it('sevenDaysAgo is exactly 168h before now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T12:00:00Z'))

    const { sevenDaysAgo } = getDateBoundaries()
    expect(sevenDaysAgo).toBe('2026-05-08T12:00:00.000Z')
  })

  it('thirtyDaysAgo is exactly 720h before now', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-15T12:00:00Z'))

    const { thirtyDaysAgo } = getDateBoundaries()
    expect(thirtyDaysAgo).toBe('2026-04-15T12:00:00.000Z')
  })

  it('handles month-end correctly for "today" in SP', () => {
    // 2026-06-01 02:30 UTC == 2026-05-31 23:30 SP — today is still 31/05 in SP
    jest.useFakeTimers().setSystemTime(new Date('2026-06-01T02:30:00Z'))

    const { startOfToday } = getDateBoundaries()
    expect(startOfToday).toBe('2026-05-31T03:00:00.000Z')
  })

  it('handles year-end correctly for "today" in SP', () => {
    // 2027-01-01 02:30 UTC == 2026-12-31 23:30 SP
    jest.useFakeTimers().setSystemTime(new Date('2027-01-01T02:30:00Z'))

    const { startOfToday } = getDateBoundaries()
    expect(startOfToday).toBe('2026-12-31T03:00:00.000Z')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- date-boundaries`

Expected: FAIL with "Cannot find module '@/lib/admin/date-boundaries'".

- [ ] **Step 3: Implement the utility**

Create `lib/admin/date-boundaries.ts`:

```ts
// "Hoje" uses the São Paulo calendar day (midnight SP).
// "Últimos 7/30 dias" use rolling windows (168h / 720h from now).
// SP offset is computed dynamically via Intl, so this stays correct if Brazil reinstates DST.
export function getDateBoundaries() {
  const now = new Date()

  // Calendar date "today" in São Paulo, formatted as YYYY-MM-DD
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)

  // Dynamic SP offset (e.g. "-03:00")
  const offsetParts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Sao_Paulo',
    timeZoneName: 'longOffset',
    hour: 'numeric',
  }).formatToParts(now)
  const offsetRaw = offsetParts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT-03:00'
  const offset = offsetRaw.replace('GMT', '') || '-03:00'

  const startOfToday = new Date(`${ymd}T00:00:00${offset}`).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString()

  return { startOfToday, sevenDaysAgo, thirtyDaysAgo }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- date-boundaries`

Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/date-boundaries.ts __tests__/lib/admin/date-boundaries.test.ts
git commit -m "feat(admin): add date-boundaries util for São Paulo timezone"
```

---

## Task 4: Update jest config for integration test glob

**Files:**
- Modify: `jest.config.ts`

Today the integration test pattern is hardcoded to a single file. Generalize to a glob so we can add new integration tests without further config changes.

- [ ] **Step 1: Update `testMatch` and `testPathIgnorePatterns`**

In `jest.config.ts`, replace lines 16-21:

```ts
  testMatch: isIntegration
    ? ['**/__tests__/**/*.integration.test.ts']
    : ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  testPathIgnorePatterns: isIntegration
    ? ['/node_modules/']
    : ['/node_modules/', '**/__tests__/**/*.integration.test.ts'],
```

- [ ] **Step 2: Verify existing integration test already matches new glob**

The existing test is `__tests__/auth.integration.test.ts` — the new pattern `**/__tests__/**/*.integration.test.ts` matches it without renaming. No `git mv` needed. Just verify it still runs:

Run: `npm run test:integration`

Expected: existing auth integration test still runs and passes (assuming local Supabase is up).

- [ ] **Step 3: Verify unit tests still skip integration tests**

Run: `npm test`

Expected: green; auth.integration.test.ts not picked up.

- [ ] **Step 4: Commit**

```bash
git add jest.config.ts
git commit -m "chore(jest): generalize integration test glob to *.integration.test.ts"
```

---

## Task 5: Integration test for `getDashboardStats`

**Files:**
- Test: `__tests__/admin/dashboard-stats.integration.test.ts`

This test seeds 1 admin + 2 patient users and 5 consultations, then verifies counts and RLS enforcement.

- [ ] **Step 1: Write the failing integration test**

Create `__tests__/admin/dashboard-stats.integration.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:integration -- dashboard-stats`

Expected: FAIL with "Cannot find module '@/lib/admin/dashboard-stats'".

- [ ] **Step 3: (No commit yet — implementation in next task)**

---

## Task 6: Implement `getDashboardStats` helper

**Files:**
- Create: `lib/admin/dashboard-stats.ts`

- [ ] **Step 1: Implement the helper**

Create `lib/admin/dashboard-stats.ts`:

```ts
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
```

- [ ] **Step 2: Run integration test to verify it passes**

Pre-condition: `npx supabase start` running locally with the migration from Task 1 applied.

Run: `npm run test:integration -- dashboard-stats`

Expected: both tests PASS.

- [ ] **Step 3: Run unit tests to ensure nothing broke**

Run: `npm test`

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add lib/admin/dashboard-stats.ts __tests__/admin/dashboard-stats.integration.test.ts
git commit -m "feat(admin): add getDashboardStats helper with integration tests"
```

---

## Task 7: Extract specialist iconMap to shared util

**Files:**
- Create: `lib/specialist-icons.ts`
- Modify: `components/dashboard/consultation-list.tsx`

The same `iconMap` will be used by `BreakdownCard`. Extract once.

- [ ] **Step 1: Create the shared util**

Create `lib/specialist-icons.ts`:

```ts
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
```

- [ ] **Step 2: Refactor `consultation-list.tsx` to use the util**

In `components/dashboard/consultation-list.tsx`:
- Remove the local `iconMap` declaration (lines 10-17) and the lucide imports for icon names (HeartPulse, Ribbon, Brain, Bone, ScanFace, Stethoscope) — keep `ClipboardPlus` and `type LucideIcon` if still needed (`Stethoscope` no longer used directly here)
- Replace `const Icon = iconMap[specialist?.icon ?? ''] ?? Stethoscope` with `const Icon = getSpecialistIcon(specialist?.icon ?? '')`
- Add: `import { getSpecialistIcon } from '@/lib/specialist-icons'`

- [ ] **Step 3: Run tests + typecheck**

Run: `npm test && npx tsc --noEmit`

Expected: all green; existing `consultation-list` test still passes (if any covers icon rendering, behavior identical).

- [ ] **Step 4: Commit**

```bash
git add lib/specialist-icons.ts components/dashboard/consultation-list.tsx
git commit -m "refactor: extract specialist iconMap to shared util"
```

---

## Task 8: `<DashboardSection>` component

**Files:**
- Create: `components/admin/dashboard-section.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { ReactNode } from 'react'

type Props = {
  title: string
  comingSoon?: boolean
  children: ReactNode
}

export function DashboardSection({ title, comingSoon, children }: Props) {
  return (
    <section>
      <header className="flex items-center gap-2 mb-4">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {comingSoon && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            Em breve
          </span>
        )}
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit at end of Task 9** (batch UI components in one commit)

---

## Task 9: `<MetricCard>` component

**Files:**
- Create: `components/admin/metric-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { cn } from '@/lib/cn'

type Props = {
  label: string
  value?: number
  placeholder?: boolean
  className?: string
}

export function MetricCard({ label, value, placeholder, className }: Props) {
  return (
    <div
      className={cn(
        'relative bg-surface border border-border rounded-lg p-5',
        placeholder && 'opacity-70',
        className,
      )}
    >
      {placeholder && (
        <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
          Em breve
        </span>
      )}
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-2 font-heading text-3xl font-bold',
          placeholder ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {placeholder ? '—' : (value ?? 0).toLocaleString('pt-BR')}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit at end of Task 10** (batch UI components in one commit)

---

## Task 10: `<BreakdownCard>` component

**Files:**
- Create: `components/admin/breakdown-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { cn } from '@/lib/cn'
import { getSpecialistIcon } from '@/lib/specialist-icons'
import type { SpecialistBreakdown } from '@/lib/admin/dashboard-stats'

type Props = {
  label: string
  items?: SpecialistBreakdown[]
  placeholder?: boolean
  className?: string
}

export function BreakdownCard({ label, items, placeholder, className }: Props) {
  return (
    <div
      className={cn(
        'relative bg-surface border border-border rounded-lg p-5',
        placeholder && 'opacity-70',
        className,
      )}
    >
      {placeholder && (
        <span className="absolute top-3 right-3 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
          Em breve
        </span>
      )}
      <p className="text-sm text-muted-foreground mb-4">{label}</p>

      {placeholder || !items?.length ? (
        <p className="text-sm text-muted-foreground italic">
          {placeholder ? 'Disponível em breve' : 'Sem dados'}
        </p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = getSpecialistIcon(item.icon)
            return (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{item.name}</span>
                </span>
                <span className="font-heading font-semibold">
                  {item.count.toLocaleString('pt-BR')}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 3: Commit the three components together**

```bash
git add components/admin/
git commit -m "feat(admin): add DashboardSection, MetricCard, BreakdownCard components"
```

---

## Task 11: Update `(protected)/layout.tsx` to fetch role

**Files:**
- Modify: `app/(protected)/layout.tsx`

- [ ] **Step 1: Replace the layout**

```tsx
import { CollapsibleSidebar } from '@/components/layout/collapsible-sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'
import { BottomNav } from '@/components/layout/bottom-nav'
import { createClient } from '@/lib/supabase/server'

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Middleware already redirects unauthenticated users — but be defensive
  // and fail-closed if profile fetch errors out.
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin'
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <CollapsibleSidebar isAdmin={isAdmin} />

      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />

        <main className="flex-1 px-6 py-8 pb-20 lg:pb-8 md:px-8">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>

        <BottomNav isAdmin={isAdmin} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: errors on `<CollapsibleSidebar isAdmin={...}>` and `<BottomNav isAdmin={...}>` because props don't exist yet — that's fine, fixed in Tasks 12–13. **Do NOT commit yet.**

---

## Task 12: Update `BottomNav` to accept `isAdmin` and show 3rd item

**Files:**
- Modify: `components/layout/bottom-nav.tsx`

- [ ] **Step 1: Update component signature and items list**

Replace the file:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Plus, ShieldCheck, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

type NavItem = { href: string; label: string; icon: LucideIcon }

const baseItems: NavItem[] = [
  { href: '/dashboard', label: 'Consultas', icon: ClipboardList },
  { href: '/consultas/nova', label: 'Nova Consulta', icon: Plus },
]
const adminItem: NavItem = { href: '/admin/dashboard', label: 'Admin', icon: ShieldCheck }

export function BottomNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const items = isAdmin ? [...baseItems, adminItem] : baseItems

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      role="navigation"
      aria-label="Navegacao principal"
    >
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center gap-0.5 px-4 py-1',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`

Expected: no errors related to BottomNav. (CollapsibleSidebar still erroring — fixed next task.)

---

## Task 13: Update `CollapsibleSidebar` with Administração accordion

**Files:**
- Modify: `components/layout/collapsible-sidebar.tsx`

- [ ] **Step 1: Replace the component**

The new version:
- Accepts `isAdmin` prop
- Renders existing top-level items unchanged
- Renders an `Accordion` (Radix) with `Administração` trigger only when `isAdmin === true`
- Sub-item "Dashboard" links to `/admin/dashboard`
- When sidebar is collapsed (`w-16`), clicking the Administração icon expands the sidebar AND opens the accordion
- Persists the accordion expanded state in `localStorage` under `sidebar-admin-expanded`

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion'
import {
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  Plus,
  LogOut,
  ShieldCheck,
  BarChart3,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { logout } from '@/actions/auth'

const COLLAPSED_KEY = 'sidebar-collapsed'
const ADMIN_OPEN_KEY = 'sidebar-admin-expanded'

type NavItem = { href: string; label: string; icon: LucideIcon }

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Minhas Consultas', icon: ClipboardList },
  { href: '/consultas/nova', label: 'Nova Consulta', icon: Plus },
]

const adminSubItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
]

export function CollapsibleSidebar({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [labelsVisible, setLabelsVisible] = useState(true)
  const [adminOpen, setAdminOpen] = useState<string>('')

  useEffect(() => {
    const storedCollapsed = localStorage.getItem(COLLAPSED_KEY)
    if (storedCollapsed === 'true') {
      setCollapsed(true)
      setLabelsVisible(false)
    }
    const storedAdminOpen = localStorage.getItem(ADMIN_OPEN_KEY)
    if (storedAdminOpen === 'true') setAdminOpen('admin')
  }, [])

  const toggle = () => {
    const next = !collapsed
    localStorage.setItem(COLLAPSED_KEY, String(next))
    if (next) {
      setLabelsVisible(false)
      setTimeout(() => setCollapsed(true), 150)
    } else {
      setCollapsed(false)
      setTimeout(() => setLabelsVisible(true), 200)
    }
  }

  const handleAdminAccordionChange = (value: string) => {
    setAdminOpen(value)
    localStorage.setItem(ADMIN_OPEN_KEY, value === 'admin' ? 'true' : 'false')
  }

  // When collapsed, clicking Administração expands the sidebar first then opens the accordion.
  const handleCollapsedAdminClick = () => {
    setCollapsed(false)
    setTimeout(() => {
      setLabelsVisible(true)
      setAdminOpen('admin')
      localStorage.setItem(COLLAPSED_KEY, 'false')
      localStorage.setItem(ADMIN_OPEN_KEY, 'true')
    }, 200)
  }

  const isAdminSubActive = adminSubItems.some(
    (i) => pathname === i.href || pathname.startsWith(i.href + '/'),
  )

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56',
      )}
      role="navigation"
      aria-label="Menu principal"
    >
      <div className="p-4 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="font-heading text-lg font-bold text-foreground overflow-hidden whitespace-nowrap"
        >
          {collapsed ? (
            <span className="text-primary">SO</span>
          ) : (
            <>
              Segunda <span className="text-primary">Opiniao</span>
            </>
          )}
        </Link>
        <button
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-background"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-heading transition-colors',
                isActive
                  ? 'text-primary bg-primary/5 font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-background',
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span
                className={cn(
                  'overflow-hidden whitespace-nowrap transition-opacity duration-150',
                  labelsVisible ? 'opacity-100' : 'opacity-0',
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        {isAdmin && (
          <div className="pt-2">
            {collapsed ? (
              <button
                onClick={handleCollapsedAdminClick}
                aria-label="Administração"
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg w-full text-sm transition-colors',
                  isAdminSubActive
                    ? 'text-primary bg-primary/5'
                    : 'text-muted-foreground hover:text-foreground hover:bg-background',
                )}
              >
                <ShieldCheck className="h-5 w-5 flex-shrink-0" />
              </button>
            ) : (
              <Accordion
                type="single"
                collapsible
                value={adminOpen}
                onValueChange={handleAdminAccordionChange}
              >
                <AccordionItem value="admin" className="border-b-0">
                  <AccordionTrigger
                    className={cn(
                      'py-2 px-3 rounded-lg text-sm font-heading hover:no-underline',
                      isAdminSubActive
                        ? 'text-primary bg-primary/5'
                        : 'text-muted-foreground hover:text-foreground hover:bg-background',
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <ShieldCheck className="h-5 w-5 flex-shrink-0" />
                      <span>Administração</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-1 pt-1">
                    <div className="space-y-1 pl-3 border-l border-border ml-5">
                      {adminSubItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-heading transition-colors',
                              isActive
                                ? 'text-primary bg-primary/5 font-semibold'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background',
                            )}
                          >
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            <span>{item.label}</span>
                          </Link>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )}
          </div>
        )}
      </nav>

      <div className="p-4">
        <form action={logout}>
          <button
            type="submit"
            className={cn(
              'flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground w-full px-1',
              collapsed && 'justify-center',
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span
              className={cn(
                'overflow-hidden whitespace-nowrap transition-opacity duration-150',
                labelsVisible ? 'opacity-100' : 'opacity-0',
              )}
            >
              Sair
            </span>
          </button>
        </form>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`

Expected: no errors. The layout, sidebar, and bottomnav now agree on `isAdmin`.

- [ ] **Step 3: Run all unit tests**

Run: `npm test`

Expected: green.

- [ ] **Step 4: Commit layout + nav changes together**

```bash
git add app/\(protected\)/layout.tsx components/layout/bottom-nav.tsx components/layout/collapsible-sidebar.tsx
git commit -m "feat(admin): wire isAdmin through (protected) layout, sidebar, bottomnav

- Layout fetches profile.role and passes isAdmin down (fail-closed)
- Sidebar renders Administração accordion (Radix) when isAdmin
- BottomNav adds third item linking to /admin/dashboard"
```

---

## Task 14: Create the dashboard page

**Files:**
- Create: `app/(protected)/admin/dashboard/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
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
```

- [ ] **Step 2: Typecheck + lint + test**

Run: `npx tsc --noEmit && npm run lint && npm test`

Expected: all green.

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/admin/dashboard/page.tsx
git commit -m "feat(admin): add /admin/dashboard page with system metrics"
```

---

## Task 15: End-to-end manual verification

**Files:** none (manual)

- [ ] **Step 1: Boot the local stack**

Two terminals:
- `npx supabase start` (if not already)
- `npm run dev`

- [ ] **Step 2: Promote a user to admin**

In Supabase Studio (`http://localhost:54323`):
- Go to Authentication → Users → create or pick a user
- Go to Table editor → `profiles` → set that user's `role` = `admin`

- [ ] **Step 3: Verify admin experience**

In a desktop browser (≥ `lg` breakpoint):
- Login as the admin user
- Sidebar shows: Minhas Consultas, Nova Consulta, **Administração** (with chevron)
- Click Administração → accordion expands, shows **Dashboard** sub-item
- Click Dashboard → navigates to `/admin/dashboard`
- Page renders three sections: Usuários (3 cards), Consultas (4 cards + breakdown), Custos (em breve, badged)
- Numbers are non-zero (or zero if no data yet) and formatted in pt-BR
- Cost cards show `—` and "Em breve" badge
- Refresh page → accordion stays expanded; on next visit the open state persists

Resize browser to mobile (< `lg`):
- BottomNav shows 3 items: Consultas, Nova Consulta, **Admin** (shield icon)
- Tap Admin → goes to `/admin/dashboard`
- Cards reflow to 1 column

Collapse the desktop sidebar (panel button):
- Administração shows as just the shield icon
- Click it → sidebar expands AND accordion opens

- [ ] **Step 4: Verify non-admin user is blocked**

Logout, login as a `role=user` profile:
- Sidebar shows only Minhas Consultas + Nova Consulta (no Administração)
- BottomNav shows only 2 items
- Manually navigate to `/admin/dashboard` → middleware redirects to `/dashboard`

- [ ] **Step 5: Verify error handling**

Stop Supabase mid-session and reload `/admin/dashboard`:
- The Next.js error boundary kicks in (`app/(protected)/error.tsx`) — page does not crash silently

- [ ] **Step 6: Final commit (if any tweaks made)**

If manual verification surfaced fixes, commit them. Otherwise, no commit needed.

---

## Verification Checklist

- [ ] Migration applied; `is_admin()` returns expected values
- [ ] `lib/admin/date-boundaries.ts` unit tests pass (6 cases)
- [ ] `lib/admin/dashboard-stats.ts` integration tests pass (admin sees correct counts; non-admin sees ≤ owned data via RLS)
- [ ] `npm test`, `npm run lint`, `npx tsc --noEmit` all green
- [ ] Admin sees Administração accordion in desktop sidebar with Dashboard sub-item
- [ ] Admin sees 3rd "Admin" item in BottomNav on mobile
- [ ] Non-admin does NOT see admin nav items and is redirected if they navigate manually
- [ ] Cost cards render as "Em breve" with `—` and badge
- [ ] Accordion expanded-state persists across reloads via localStorage
- [ ] Collapsed-sidebar Admin click expands sidebar then opens accordion
- [ ] No references to deleted `app/(admin)/` remain in code or tests

---

## Notes for the implementer

- **Skill recommendation:** Use `@superpowers:test-driven-development` for Tasks 3, 5–6 (test-first cycles). UI tasks (8–10, 14) are presentational and don't follow strict TDD — typecheck and manual verify.
- **Task ordering matters for typecheck:** Tasks 11–13 must commit together because intermediate states leave `isAdmin` prop unwired.
- **Existing `__tests__/lib/auth/route-access.test.ts`** still passes because the access lib doesn't care which `/admin/*` paths exist. Optional: add test cases for `/admin/dashboard` for clarity.
- **No breaking changes to patient experience:** All sidebar/bottomnav modifications are additive when `isAdmin === false`.
