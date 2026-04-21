# Project Structure Design

**Date:** 2026-04-21
**Feature:** Initial project scaffolding — Next.js + Supabase + Vercel
**Status:** Approved

## Overview

SaaS B2C application that uses Claude Managed Agents to route user flows through AI agent processing. This spec covers the initial project structure: scaffold, authentication, and route protection across three access tiers.

## Architecture

Next.js 14+ with App Router, deployed to Vercel. Supabase provides Auth (sessions, JWT) and Database (PostgreSQL). All Supabase communication from the server side uses `@supabase/ssr` with HttpOnly cookies — credentials are never exposed to the browser.

```
Request → Vercel Edge → middleware.ts → validates Supabase session
                                       ↓
                          (public)    no token → OK
                          (protected) no token → redirect /login
                          (admin)     no token → redirect /login
                          (admin)     role != admin → redirect /dashboard
                                       ↓
                          Next.js App Router → Server Component → page
```

The middleware runs on the Vercel Edge Runtime before any page is served. It reads the Supabase session cookie, validates the token, and enforces access control. Session refresh is handled automatically by `@supabase/ssr` via `supabase.auth.getUser()` on every request.

Admin role is stored in a `profiles` table (field: `role`, default: `user`). A Postgres trigger on `auth.users` automatically inserts a row into `profiles` on user registration.

## Folder Structure

```
/
├── app/
│   ├── (public)/
│   │   ├── layout.tsx          # public layout (no auth, simple navbar)
│   │   ├── page.tsx            # landing page
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (protected)/
│   │   ├── layout.tsx          # authenticated layout (sidebar, user header)
│   │   └── dashboard/
│   │       └── page.tsx        # main user page placeholder
│   ├── (admin)/
│   │   ├── layout.tsx          # admin layout
│   │   └── admin/
│   │       ├── users/
│   │       │   └── page.tsx    # user list placeholder
│   │       └── costs/
│   │           └── page.tsx    # costs page placeholder
│   ├── layout.tsx              # root layout (providers, fonts)
│   └── globals.css
├── components/
│   └── ui/                     # shared UI components
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # browser Supabase client
│   │   └── server.ts           # server Supabase client (SSR, cookie-based)
│   └── utils.ts
├── middleware.ts                # route protection
├── .env.local
├── next.config.ts
└── package.json
```

`lib/supabase/server.ts` exports a function (not a singleton) because the SSR client must read cookies fresh on each request. `SUPABASE_SERVICE_ROLE_KEY` is server-only and never exposed to the browser.

## Authentication Flow

**Register / Login:**
User submits form at `/register` or `/login`. A Server Action calls `supabase.auth.signUp()` or `supabase.auth.signInWithPassword()`. The Supabase JWT is written to HttpOnly cookies by `@supabase/ssr`. The browser never accesses the token directly.

**Logout:**
Server Action calls `supabase.auth.signOut()`, clears cookies, redirects to `/`.

**Middleware access rules:**

| Route group   | No session        | Session, role=user        | Session, role=admin       |
|---------------|-------------------|---------------------------|---------------------------|
| `(public)`    | allow             | `/login` `/register` → redirect `/dashboard`; other public pages → allow | same as role=user |
| `(protected)` | redirect `/login` | allow                     | allow                     |
| `(admin)`     | redirect `/login` | redirect `/dashboard`     | allow                     |

## Database

**`profiles` table:**

| Column       | Type        | Notes                          |
|--------------|-------------|--------------------------------|
| `id`         | uuid        | FK → `auth.users.id`, PK       |
| `role`       | text        | default `user`; allowed: `user`, `admin` |
| `created_at` | timestamptz | set by trigger                 |

A Postgres trigger on `auth.users` INSERT automatically creates the corresponding `profiles` row.

## Error Handling

- **Auth errors** (invalid credentials, duplicate email): returned from Server Action, displayed inline in the form — no redirect, no generic toast
- **Expired session**: middleware redirects to `/login?reason=session_expired` so the page can display a contextual message
- **Unauthorized admin access**: silent redirect to `/dashboard` — no explicit error page in this scope
- **Unexpected server errors**: Next.js `error.tsx` per route group, showing a generic message without exposing internals

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

## Testing

Scope is limited to auth and middleware — placeholder pages are not tested.

- **Middleware unit tests** (Jest): simulate requests with and without session cookies, assert correct redirects for each access tier
- **Auth Server Actions integration tests**: use a local Supabase instance (`supabase start`) to validate register, login, and logout end-to-end

## Out of Scope

- AI agent flows and Claude Managed Agents integration
- User-facing features beyond placeholder pages
- Email templates, OAuth providers, password reset flow
- UI component library setup (shadcn/ui or similar)
