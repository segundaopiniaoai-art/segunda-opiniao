# Google OAuth via Supabase — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace email/password auth with Google OAuth as the sole login method using Supabase PKCE flow.

**Architecture:** Server Action calls `signInWithOAuth` and redirects to Google. Google redirects back to a route handler at `/auth/callback` which exchanges the code for a session. All OAuth logic is server-side.

**Tech Stack:** Next.js App Router, Supabase Auth (`@supabase/ssr`), Server Actions, Route Handlers

**Spec:** `docs/superpowers/specs/2026-04-26-google-oauth-design.md`

---

### Task 1: Update route-access to remove /register

**Files:**
- Modify: `lib/auth/route-access.ts:1`
- Modify: `__tests__/lib/auth/route-access.test.ts:19-21,30-35`

- [ ] **Step 1: Update route-access.ts**

Remove `/register` from `PUBLIC_ONLY_PATHS`:

```ts
const PUBLIC_ONLY_PATHS = ['/login']
```

- [ ] **Step 2: Update route-access tests**

In `__tests__/lib/auth/route-access.test.ts`, remove the two test cases that reference `/register`:

- Remove `it('allows unauthenticated access to /register', ...)` (lines 19-21)
- Remove `it('redirects authenticated admin away from /register to /dashboard', ...)` (lines 30-35)

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/lib/auth/route-access.test.ts`
Expected: All remaining tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/auth/route-access.ts __tests__/lib/auth/route-access.test.ts
git commit -m "Remove /register from public-only paths"
```

---

### Task 2: Create auth callback route handler with tests

**Files:**
- Create: `app/auth/callback/route.ts`
- Create: `__tests__/auth/callback/route.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/auth/callback/route.test.ts`:

```ts
import { NextRequest } from 'next/server'

const mockExchangeCodeForSession = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() =>
    Promise.resolve({
      auth: {
        exchangeCodeForSession: mockExchangeCodeForSession,
      },
    })
  ),
}))

import { GET } from '@/app/auth/callback/route'

function makeRequest(url: string) {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('GET /auth/callback', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('redirects to /dashboard on valid code', async () => {
    mockExchangeCodeForSession.mockResolvedValue({ error: null })
    const response = await GET(makeRequest('/auth/callback?code=valid-code'))
    expect(response.status).toBe(307)
    expect(new URL(response.headers.get('location')!).pathname).toBe('/dashboard')
  })

  it('redirects to /login with error when code is missing', async () => {
    const response = await GET(makeRequest('/auth/callback'))
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('auth_failed')
  })

  it('redirects to /login with error when exchange fails', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      error: new Error('invalid code'),
    })
    const response = await GET(makeRequest('/auth/callback?code=bad-code'))
    expect(response.status).toBe(307)
    const location = new URL(response.headers.get('location')!)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('error')).toBe('auth_failed')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/auth/callback/route.test.ts`
Expected: FAIL — module `@/app/auth/callback/route` not found.

- [ ] **Step 3: Implement the route handler**

Create `app/auth/callback/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const origin = request.nextUrl.origin

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', origin))
  }

  return NextResponse.redirect(new URL('/dashboard', origin))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/auth/callback/route.test.ts`
Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/auth/callback/route.ts __tests__/auth/callback/route.test.ts
git commit -m "Add /auth/callback route handler for OAuth code exchange"
```

---

### Task 3: Replace auth actions (remove email/password, add Google OAuth)

**Files:**
- Modify: `actions/auth.ts`
- Modify: `__tests__/auth.integration.test.ts`

- [ ] **Step 1: Replace actions/auth.ts**

Replace the contents of `actions/auth.ts` with:

```ts
'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export async function loginWithGoogle() {
  const supabase = await createClient()
  const origin = (await headers()).get('origin') ?? ''

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback`,
    },
  })

  if (error || !data.url) {
    redirect('/login?error=auth_failed')
  }

  redirect(data.url)
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
```

- [ ] **Step 2: Update integration tests**

Replace the contents of `__tests__/auth.integration.test.ts` with:

```ts
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

describe('auth integration', () => {
  let createdUserId: string

  beforeAll(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: `integration-test-${Date.now()}@example.com`,
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
})
```

- [ ] **Step 3: Run unit tests**

Run: `npx jest --testPathIgnorePatterns="auth.integration"`
Expected: All tests pass (integration tests excluded from normal runs).

- [ ] **Step 4: Commit**

```bash
git add actions/auth.ts __tests__/auth.integration.test.ts
git commit -m "Replace email/password auth actions with Google OAuth"
```

---

### Task 4: Update login page and form

**Files:**
- Modify: `components/auth/login-form.tsx`
- Modify: `app/(public)/login/page.tsx`

- [ ] **Step 1: Replace login-form.tsx**

Replace the contents of `components/auth/login-form.tsx` with:

```tsx
'use client'

import { loginWithGoogle } from '@/actions/auth'

export function LoginForm() {
  return (
    <form action={loginWithGoogle}>
      <button
        type="submit"
        className="w-full bg-black text-white py-2 rounded-lg font-medium text-sm hover:bg-gray-800 transition-colors"
      >
        Entrar com Google
      </button>
    </form>
  )
}
```

- [ ] **Step 2: Update login page**

Replace the contents of `app/(public)/login/page.tsx` with:

```tsx
import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; error?: string }>
}) {
  const { reason, error } = await searchParams

  return (
    <div className="max-w-sm mx-auto py-20 px-6">
      <h1 className="text-2xl font-bold mb-8">Sign in</h1>
      {reason === 'session_expired' && (
        <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Your session expired. Please sign in again.
        </p>
      )}
      {error === 'auth_failed' && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">
          Authentication failed. Please try again.
        </p>
      )}
      <LoginForm />
    </div>
  )
}
```

- [ ] **Step 3: Run all unit tests**

Run: `npx jest --testPathIgnorePatterns="auth.integration"`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add components/auth/login-form.tsx "app/(public)/login/page.tsx"
git commit -m "Replace login form with Google OAuth button"
```

---

### Task 5: Remove register page and form

**Files:**
- Delete: `app/(public)/register/page.tsx`
- Delete: `components/auth/register-form.tsx`

- [ ] **Step 1: Delete register files**

```bash
git rm app/\(public\)/register/page.tsx components/auth/register-form.tsx
```

- [ ] **Step 2: Run all unit tests**

Run: `npx jest --testPathIgnorePatterns="auth.integration"`
Expected: All tests pass. No imports reference the deleted files.

- [ ] **Step 3: Run build check**

Run: `npx next build`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "Remove register page and form (Google OAuth only)"
```

---

### Task 6: Update all remaining /register references

**Files:**
- Modify: `components/landing/hero.tsx:26`
- Modify: `components/landing/final-cta.tsx:22`
- Modify: `components/layout/site-header.tsx:24`
- Modify: `__tests__/landing/page.test.tsx:31,34,43,47`

- [ ] **Step 1: Update component references**

In each of these files, replace `href="/register"` with `href="/login"`:
- `components/landing/hero.tsx` (line 26)
- `components/landing/final-cta.tsx` (line 22)
- `components/layout/site-header.tsx` (line 24)

- [ ] **Step 2: Update landing page test assertions**

In `__tests__/landing/page.test.tsx`, update all assertions that check for `/register` to check for `/login` instead:
- Line 31: update test description from `/register` to `/login`
- Line 34: change `expect(cta).toHaveAttribute('href', '/register')` to `expect(cta).toHaveAttribute('href', '/login')`
- Line 43: update test description from `/register` to `/login`
- Line 47: change `expect(cta).toHaveAttribute('href', '/register')` to `expect(cta).toHaveAttribute('href', '/login')`

- [ ] **Step 3: Verify no remaining /register references**

Run: `grep -r "/register" --include="*.tsx" --include="*.ts" -l`
Expected: No results.

- [ ] **Step 4: Run all unit tests**

Run: `npx jest --testPathIgnorePatterns="auth.integration"`
Expected: All tests pass, including updated landing page tests.

- [ ] **Step 5: Run build check**

Run: `npx next build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add components/landing/hero.tsx components/landing/final-cta.tsx components/layout/site-header.tsx __tests__/landing/page.test.tsx
git commit -m "Update /register references to /login"
```
