# Project Structure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Next.js 14+ SaaS project with Supabase auth, three-tier route protection (public / protected / admin), auth forms, and placeholder pages for each tier.

**Architecture:** App Router route groups `(public)`, `(protected)`, `(admin)` with a single `middleware.ts` enforcing access via `@supabase/ssr`. Route-access decision logic is extracted into a pure function (`lib/auth/route-access.ts`) that is fully unit-tested. Auth flows use Server Actions with `useActionState` for inline error display.

**Tech Stack:** Next.js 14+, TypeScript, Tailwind CSS, `@supabase/ssr`, `@supabase/supabase-js`, Supabase CLI, Jest, `next/jest`

---

## File Map

```
New files:
  lib/supabase/client.ts                          — browser Supabase client factory
  lib/supabase/server.ts                          — server Supabase client factory (SSR, cookie-based)
  lib/auth/route-access.ts                        — pure access-decision function
  actions/auth.ts                                 — Server Actions: login, register, logout
  middleware.ts                                   — route protection orchestrator
  components/auth/login-form.tsx                  — Client Component form with useActionState
  components/auth/register-form.tsx               — Client Component form with useActionState
  app/(public)/layout.tsx                         — public layout (nav, no auth)
  app/(public)/page.tsx                           — landing page
  app/(public)/login/page.tsx                     — login page shell
  app/(public)/register/page.tsx                  — register page shell
  app/(protected)/layout.tsx                      — authenticated layout (sidebar + logout)
  app/(protected)/dashboard/page.tsx              — dashboard placeholder
  app/(protected)/error.tsx                       — error boundary for protected routes
  app/(admin)/layout.tsx                          — admin layout (dark sidebar + logout)
  app/(admin)/admin/users/page.tsx                — users list placeholder
  app/(admin)/admin/costs/page.tsx                — costs placeholder
  app/(admin)/error.tsx                           — error boundary for admin routes
  supabase/migrations/20260421000000_create_profiles.sql
  __tests__/lib/auth/route-access.test.ts         — unit tests for determineAccess
  __tests__/auth.integration.test.ts              — integration tests (requires supabase start)
  jest.config.ts
  jest.setup.ts

Modified files:
  app/layout.tsx                                  — simplify root layout (keep, edit)
  app/globals.css                                 — remove create-next-app demo styles
  app/page.tsx                                    — delete (replaced by (public)/page.tsx)
  .env.local                                      — add Supabase vars
  package.json                                    — add test scripts
```

---

## Task 1: Initialize Next.js project

**Files:**
- Create: `app/layout.tsx`, `app/globals.css`, `next.config.ts`, `package.json`, `tsconfig.json`, `.env.local`

- [ ] **Step 1: Scaffold the project**

Run in `/Users/iduarte/teste-superpowers`:
```bash
npx create-next-app@latest . \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-turbopack
```

If prompted about existing files, choose to continue (the existing `.claude` files won't conflict).

- [ ] **Step 2: Create `.env.local` with placeholder variables**

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
EOF
```

`SUPABASE_SERVICE_ROLE_KEY` is used server-side only. After running `supabase start` (Task 3), replace these values with the ones printed by the CLI.

- [ ] **Step 3: Clean up generated boilerplate**

Replace `app/globals.css` content — remove all Tailwind variable declarations and demo styles, keep only the directives:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Replace `app/layout.tsx` — remove `next/font` demo and simplify:
```tsx
import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SaaS App',
  description: 'AI-powered agent platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
```

Delete `app/page.tsx` — it will be replaced by `app/(public)/page.tsx` in Task 6.

- [ ] **Step 4: Verify the app starts**

```bash
npm run dev
```

Expected: server starts at `http://localhost:3000` (will show 404 after deleting `app/page.tsx` — that's fine).

Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Initialize Next.js project with App Router and Tailwind"
```

---

## Task 2: Install Supabase packages and configure clients

**Files:**
- Create: `lib/supabase/client.ts`, `lib/supabase/server.ts`

- [ ] **Step 1: Install Supabase packages**

```bash
npm install @supabase/ssr @supabase/supabase-js
```

Expected: packages added to `node_modules` and `package.json`.

- [ ] **Step 2: Create browser client**

Create `lib/supabase/client.ts`:
```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 3: Create server client**

Create `lib/supabase/server.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component context — cookies can't be set here.
            // The middleware handles session refresh via its own setAll.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/client.ts lib/supabase/server.ts package.json package-lock.json
git commit -m "Add Supabase browser and server client factories"
```

---

## Task 3: Set up Supabase local development and create profiles migration

**Files:**
- Create: `supabase/migrations/20260421000000_create_profiles.sql`

- [ ] **Step 1: Install Supabase CLI**

```bash
npm install supabase --save-dev
```

- [ ] **Step 2: Initialize Supabase**

```bash
npx supabase init
```

Expected: creates `supabase/` directory with `config.toml`.

- [ ] **Step 3: Create the profiles migration**

Create `supabase/migrations/20260421000000_create_profiles.sql`:
```sql
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

- [ ] **Step 4: Start local Supabase and apply migration**

```bash
npx supabase start
```

Expected output includes:
```
API URL: http://localhost:54321
anon key: eyJ...
service_role key: eyJ...
```

Copy the `anon key` and `service_role key` values into `.env.local`, replacing the placeholders.

```bash
npx supabase db push
```

Expected: migration applied, `profiles` table created.

- [ ] **Step 5: Commit**

```bash
git add supabase/ package.json package-lock.json
git commit -m "Add Supabase local setup and profiles migration"
```

---

## Task 4: Implement route-access logic with TDD

**Files:**
- Create: `lib/auth/route-access.ts`, `__tests__/lib/auth/route-access.test.ts`, `jest.config.ts`, `jest.setup.ts`

- [ ] **Step 1: Install Jest dependencies**

```bash
npm install --save-dev jest jest-environment-node @types/jest ts-jest
```

- [ ] **Step 2: Create `jest.config.ts`**

```typescript
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
}

export default createJestConfig(config)
```

- [ ] **Step 3: Create `jest.setup.ts`**

```typescript
// Jest global setup — add custom matchers here if needed
```

- [ ] **Step 4: Add test script to `package.json`**

In `package.json`, add to the `"scripts"` block:
```json
"test": "jest",
"test:watch": "jest --watch",
"test:integration": "INTEGRATION=true jest --testPathPattern=integration"
```

- [ ] **Step 5: Write failing tests**

Create `__tests__/lib/auth/route-access.test.ts`:
```typescript
import { determineAccess } from '@/lib/auth/route-access'

const user = { id: 'user-123' }

describe('determineAccess', () => {
  describe('public paths', () => {
    it('allows unauthenticated access to landing page', () => {
      expect(determineAccess('/', null, null)).toEqual({ action: 'allow' })
    })

    it('allows authenticated user to access landing page', () => {
      expect(determineAccess('/', user, 'user')).toEqual({ action: 'allow' })
    })

    it('allows unauthenticated access to /login', () => {
      expect(determineAccess('/login', null, null)).toEqual({ action: 'allow' })
    })

    it('allows unauthenticated access to /register', () => {
      expect(determineAccess('/register', null, null)).toEqual({ action: 'allow' })
    })

    it('redirects authenticated user away from /login to /dashboard', () => {
      expect(determineAccess('/login', user, 'user')).toEqual({
        action: 'redirect',
        destination: '/dashboard',
      })
    })

    it('redirects authenticated admin away from /register to /dashboard', () => {
      expect(determineAccess('/register', user, 'admin')).toEqual({
        action: 'redirect',
        destination: '/dashboard',
      })
    })
  })

  describe('protected paths', () => {
    it('redirects unauthenticated user from /dashboard to /login', () => {
      expect(determineAccess('/dashboard', null, null)).toEqual({
        action: 'redirect',
        destination: '/login',
      })
    })

    it('allows authenticated user with role=user to access /dashboard', () => {
      expect(determineAccess('/dashboard', user, 'user')).toEqual({ action: 'allow' })
    })

    it('allows authenticated user with role=admin to access /dashboard', () => {
      expect(determineAccess('/dashboard', user, 'admin')).toEqual({ action: 'allow' })
    })
  })

  describe('admin paths', () => {
    it('redirects unauthenticated user from /admin/users to /login', () => {
      expect(determineAccess('/admin/users', null, null)).toEqual({
        action: 'redirect',
        destination: '/login',
      })
    })

    it('redirects user with role=user from /admin/users to /dashboard', () => {
      expect(determineAccess('/admin/users', user, 'user')).toEqual({
        action: 'redirect',
        destination: '/dashboard',
      })
    })

    it('allows user with role=admin to access /admin/users', () => {
      expect(determineAccess('/admin/users', user, 'admin')).toEqual({ action: 'allow' })
    })

    it('allows admin to access /admin/costs', () => {
      expect(determineAccess('/admin/costs', user, 'admin')).toEqual({ action: 'allow' })
    })

    it('redirects user with role=user from /admin/costs to /dashboard', () => {
      expect(determineAccess('/admin/costs', user, 'user')).toEqual({
        action: 'redirect',
        destination: '/dashboard',
      })
    })
  })
})
```

- [ ] **Step 6: Run tests — verify they fail**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/lib/auth/route-access'`

- [ ] **Step 7: Implement `lib/auth/route-access.ts`**

Create `lib/auth/route-access.ts`:
```typescript
const PUBLIC_ONLY_PATHS = ['/login', '/register']
const PROTECTED_PREFIXES = ['/dashboard']
const ADMIN_PREFIXES = ['/admin']

export type AccessDecision =
  | { action: 'allow' }
  | { action: 'redirect'; destination: string }

export function determineAccess(
  pathname: string,
  user: { id: string } | null,
  role: string | null
): AccessDecision {
  const isPublicOnly = PUBLIC_ONLY_PATHS.includes(pathname)
  const needsAuth = [...PROTECTED_PREFIXES, ...ADMIN_PREFIXES].some((prefix) =>
    pathname.startsWith(prefix)
  )
  const isAdminPath = ADMIN_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (user && isPublicOnly) {
    return { action: 'redirect', destination: '/dashboard' }
  }

  if (!user && needsAuth) {
    return { action: 'redirect', destination: '/login' }
  }

  if (user && isAdminPath && role !== 'admin') {
    return { action: 'redirect', destination: '/dashboard' }
  }

  return { action: 'allow' }
}
```

- [ ] **Step 8: Run tests — verify they pass**

```bash
npm test
```

Expected: PASS — 13 tests passing.

- [ ] **Step 9: Commit**

```bash
git add lib/auth/route-access.ts __tests__/lib/auth/route-access.test.ts jest.config.ts jest.setup.ts package.json package-lock.json
git commit -m "Add route-access logic with full unit test coverage"
```

---

## Task 5: Implement middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create `middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { determineAccess } from '@/lib/auth/route-access'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isAdminPath = pathname.startsWith('/admin')
  let role: string | null = null

  if (user && isAdminPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    role = profile?.role ?? null
  }

  const decision = determineAccess(pathname, user, role)

  if (decision.action === 'redirect') {
    const url = request.nextUrl.clone()
    url.pathname = decision.destination

    // If redirecting to /login but Supabase cookies are present, the session
    // likely expired (vs. never logged in). Add a query param so the login
    // page can show a contextual message.
    if (
      decision.destination === '/login' &&
      !user &&
      request.cookies.getAll().some((c) => c.name.startsWith('sb-'))
    ) {
      url.searchParams.set('reason', 'session_expired')
    }

    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "Add middleware with three-tier route protection"
```

---

## Task 6: Create route groups, layouts, and placeholder pages

**Files:**
- Create: `app/(public)/layout.tsx`, `app/(public)/page.tsx`, `app/(public)/login/page.tsx`, `app/(public)/register/page.tsx`, `app/(protected)/layout.tsx`, `app/(protected)/dashboard/page.tsx`, `app/(protected)/error.tsx`, `app/(admin)/layout.tsx`, `app/(admin)/admin/users/page.tsx`, `app/(admin)/admin/costs/page.tsx`, `app/(admin)/error.tsx`

- [ ] **Step 1: Create public group layout**

Create `app/(public)/layout.tsx`:
```tsx
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b px-6 py-4 flex items-center justify-between">
        <a href="/" className="font-semibold text-lg">SaaS App</a>
        <div className="flex gap-4 text-sm">
          <a href="/login" className="text-gray-600 hover:text-black">Sign in</a>
          <a href="/register" className="bg-black text-white px-4 py-1.5 rounded-lg">
            Get started
          </a>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create landing page**

Create `app/(public)/page.tsx`:
```tsx
import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="max-w-4xl mx-auto py-24 px-6 text-center">
      <h1 className="text-5xl font-bold mb-6">AI Agent Platform</h1>
      <p className="text-xl text-gray-600 mb-10">
        Automate your workflows with intelligent AI agents powered by Claude.
      </p>
      <div className="flex gap-4 justify-center">
        <Link
          href="/register"
          className="bg-black text-white px-6 py-3 rounded-lg font-medium"
        >
          Get started free
        </Link>
        <Link href="/login" className="border px-6 py-3 rounded-lg font-medium">
          Sign in
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create login page shell**

Create `app/(public)/login/page.tsx`:
```tsx
import Link from 'next/link'
import { LoginForm } from '@/components/auth/login-form'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams

  return (
    <div className="max-w-sm mx-auto py-20 px-6">
      <h1 className="text-2xl font-bold mb-8">Sign in</h1>
      {reason === 'session_expired' && (
        <p className="text-amber-700 text-sm bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          Your session expired. Please sign in again.
        </p>
      )}
      <LoginForm />
      <p className="mt-6 text-sm text-center text-gray-600">
        No account?{' '}
        <Link href="/register" className="underline text-black">
          Create one
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Create register page shell**

Create `app/(public)/register/page.tsx`:
```tsx
import Link from 'next/link'
import { RegisterForm } from '@/components/auth/register-form'

export default function RegisterPage() {
  return (
    <div className="max-w-sm mx-auto py-20 px-6">
      <h1 className="text-2xl font-bold mb-8">Create account</h1>
      <RegisterForm />
      <p className="mt-6 text-sm text-center text-gray-600">
        Already have an account?{' '}
        <Link href="/login" className="underline text-black">
          Sign in
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 5: Create protected group layout**

Create `app/(protected)/layout.tsx`:
```tsx
import { logout } from '@/actions/auth'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r bg-gray-50 flex flex-col p-6">
        <a href="/dashboard" className="font-semibold text-lg mb-8 block">
          SaaS App
        </a>
        <nav className="space-y-1 flex-1">
          <a
            href="/dashboard"
            className="block text-sm px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            Dashboard
          </a>
        </nav>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-black w-full text-left"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 6: Create dashboard placeholder**

Create `app/(protected)/dashboard/page.tsx`:
```tsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-600">Your agent workflows will appear here.</p>
    </div>
  )
}
```

- [ ] **Step 7: Create protected error boundary**

Create `app/(protected)/error.tsx`:
```tsx
'use client'

export default function ProtectedError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="text-center py-20">
      <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
      <button
        onClick={reset}
        className="bg-black text-white px-4 py-2 rounded-lg text-sm"
      >
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 8: Create admin group layout**

Create `app/(admin)/layout.tsx`:
```tsx
import { logout } from '@/actions/auth'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r bg-gray-900 text-white flex flex-col p-6">
        <a href="/dashboard" className="font-semibold text-lg mb-8 block">
          Admin
        </a>
        <nav className="space-y-1 flex-1">
          <a
            href="/admin/users"
            className="block text-sm px-3 py-2 rounded-lg hover:bg-gray-800"
          >
            Users
          </a>
          <a
            href="/admin/costs"
            className="block text-sm px-3 py-2 rounded-lg hover:bg-gray-800"
          >
            Costs
          </a>
        </nav>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-gray-400 hover:text-white w-full text-left"
          >
            Sign out
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 9: Create admin placeholder pages**

Create `app/(admin)/admin/users/page.tsx`:
```tsx
export default function AdminUsersPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Users</h1>
      <p className="text-gray-600">System user list will appear here.</p>
    </div>
  )
}
```

Create `app/(admin)/admin/costs/page.tsx`:
```tsx
export default function AdminCostsPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Costs</h1>
      <p className="text-gray-600">Agent usage costs will appear here.</p>
    </div>
  )
}
```

- [ ] **Step 10: Create admin error boundary**

Create `app/(admin)/error.tsx`:
```tsx
'use client'

export default function AdminError({
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="text-center py-20">
      <h2 className="text-xl font-semibold mb-4">Something went wrong</h2>
      <button
        onClick={reset}
        className="bg-white text-gray-900 px-4 py-2 rounded-lg text-sm"
      >
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 11: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: errors about missing `@/components/auth/login-form` and `@/actions/auth` — these are imported but not created yet. That's expected; they will be resolved in Task 7.

- [ ] **Step 12: Commit**

```bash
git add app/
git commit -m "Add route groups, layouts, and placeholder pages"
```

---

## Task 7: Implement auth Server Actions and forms

**Files:**
- Create: `actions/auth.ts`, `components/auth/login-form.tsx`, `components/auth/register-form.tsx`, `__tests__/auth.integration.test.ts`

- [ ] **Step 1: Create auth Server Actions**

Create `actions/auth.ts`:
```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function login(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function register(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient()

  const { error } = await supabase.auth.signUp({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
```

- [ ] **Step 2: Create LoginForm client component**

Create `components/auth/login-form.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { login } from '@/actions/auth'

const initialState = { error: null }

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-black text-white py-2 rounded-lg font-medium text-sm disabled:opacity-50"
      >
        {isPending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Create RegisterForm client component**

Create `components/auth/register-form.tsx`:
```tsx
'use client'

import { useActionState } from 'react'
import { register } from '@/actions/auth'

const initialState = { error: null }

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(register, initialState)

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium mb-1">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-black text-white py-2 rounded-lg font-medium text-sm disabled:opacity-50"
      >
        {isPending ? 'Creating account…' : 'Create account'}
      </button>
    </form>
  )
}
```

- [ ] **Step 4: Create integration test file**

Create `__tests__/auth.integration.test.ts`:
```typescript
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
  let createdUserId: string | null = null

  afterAll(async () => {
    if (createdUserId) {
      await supabase.auth.admin.deleteUser(createdUserId)
    }
  })

  it('creates user and auto-inserts profile row via trigger', async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    })

    expect(error).toBeNull()
    expect(data.user).toBeDefined()
    createdUserId = data.user!.id

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
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Run unit tests — verify still passing**

```bash
npm test
```

Expected: PASS — 13 tests (route-access suite).

- [ ] **Step 7: Start dev server and test manually**

```bash
npm run dev
```

Open `http://localhost:3000` and verify:

1. Landing page loads with nav links
2. `/login` shows login form; submitting with bad credentials shows inline error
3. `/register` shows register form; creating an account redirects to `/dashboard`
4. `/dashboard` without a session redirects to `/login`
5. `/admin/users` with a regular user session redirects to `/dashboard`
6. After signing in, visiting `/login` redirects to `/dashboard`

Stop the dev server.

- [ ] **Step 8: Run integration tests (requires supabase running)**

```bash
npm run test:integration
```

Expected: PASS — 3 integration tests.

- [ ] **Step 9: Commit**

```bash
git add actions/auth.ts components/auth/ __tests__/auth.integration.test.ts
git commit -m "Add auth Server Actions, login/register forms, and integration tests"
```

---

## Done

At this point the project has:

- Next.js App Router scaffold with three route groups
- Supabase clients (browser + server, cookie-based)
- `profiles` table with auto-insert trigger and RLS policy
- Middleware enforcing public / protected / admin access tiers
- `determineAccess` pure function with 13 unit tests
- Login and register forms with inline error display
- Logout in both authenticated and admin layouts
- Placeholder pages for dashboard, admin/users, admin/costs
- Error boundaries for protected and admin route groups
- Integration tests validating register → profile trigger → sign-in flow
