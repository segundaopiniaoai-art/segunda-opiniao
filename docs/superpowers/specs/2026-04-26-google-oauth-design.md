# Google OAuth via Supabase — Design Spec

## Overview

Replace email/password authentication with Google OAuth as the sole login method, using Supabase as the auth provider with the PKCE flow (server-side).

## Flow

1. User clicks "Entrar com Google" on `/login`
2. Server Action `loginWithGoogle` calls `supabase.auth.signInWithOAuth({ provider: 'google' })` with PKCE flow and `redirectTo` pointing to `/auth/callback`
3. Action redirects the browser to the Google authorization URL returned by Supabase
4. User authorizes on Google
5. Google redirects to `/auth/callback?code=...`
6. Route handler `app/auth/callback/route.ts` calls `supabase.auth.exchangeCodeForSession(code)`
7. On success, redirects to `/dashboard`; on error, redirects to `/login?error=auth_failed`

First-time users are automatically registered (Supabase default behavior for OAuth).

## File changes

### Modified

- **`actions/auth.ts`** — Remove `login` and `register`. Keep `logout`. Add `loginWithGoogle` server action that creates a server-side Supabase client, calls `signInWithOAuth`, and redirects to the returned URL.
- **`components/auth/login-form.tsx`** — Replace email/password form with a single "Entrar com Google" button that calls `loginWithGoogle`.
- **`app/(public)/login/page.tsx`** — Remove link to `/register`. Add handling for `error=auth_failed` query param. Keep `session_expired` handling.
- **`lib/auth/route-access.ts`** — Remove `/register` from `PUBLIC_ONLY_PATHS`.

### New

- **`app/auth/callback/route.ts`** — GET route handler that extracts `code` from search params, exchanges it for a session via `exchangeCodeForSession`, and redirects accordingly.

### Removed

- **`components/auth/register-form.tsx`** — No longer needed.
- **`app/(public)/register/page.tsx`** — No longer needed.

## Middleware

No changes. The existing middleware already handles session refresh and route protection correctly. The `/auth/callback` path is not in any protected prefix, so it will be accessible without authentication.

## External configuration (not in code)

- **Google Cloud Console:** Create OAuth 2.0 credentials (Client ID + Secret)
- **Supabase Dashboard:** Enable Google provider with the credentials above; add `<site-url>/auth/callback` to allowed redirect URLs
- **Production `.env.local`:** Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` point to the production Supabase project

No changes to `supabase/config.toml` — OAuth runs only in production.

## Tests

### Modified

- **`__tests__/auth.integration.test.ts`** — Remove email/password tests. Add test for `loginWithGoogle` (verifies it returns a redirect URL). Keep `logout` tests.
- **`__tests__/lib/auth/route-access.test.ts`** — Remove test cases for `/register`.

### New

- **`__tests__/auth/callback/route.test.ts`** — Test redirect to `/dashboard` on valid code. Test redirect to `/login?error=auth_failed` on missing code. Test redirect to `/login?error=auth_failed` on `exchangeCodeForSession` failure.

## Error handling

- Missing or invalid `code` in callback: redirect to `/login?error=auth_failed`
- `exchangeCodeForSession` failure: redirect to `/login?error=auth_failed`
- `signInWithOAuth` failure: return error from server action, displayed on login page
- Session expiry: existing middleware behavior (redirect to `/login?reason=session_expired`)
