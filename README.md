# SaaS App

AI-powered agent platform built with Next.js, Supabase, and Claude.

## Getting started

```bash
npm install
npx supabase start
npm run dev
```

## Environment variables

Copy `.env.local` and fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

## Stack

- [Next.js](https://nextjs.org) — App Router, Server Actions
- [Supabase](https://supabase.com) — Auth + PostgreSQL
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [Vercel](https://vercel.com) — Hosting
