# Landing Page — Segunda Opinião — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Portuguese-language clinical-sober landing page for the "Segunda Opinião" health-tech product with header, footer, six content sections, two legal stub pages, dynamic OG image, and smoke tests — all in Next.js 16 + Tailwind v4 + shadcn/ui.

**Architecture:** Server components by default; only `faq.tsx` is a client component (Radix Accordion). Each landing section lives in its own file under `components/landing/`. shadcn primitives (`button`, `accordion`) are added by hand under `components/ui/`. Design tokens (colors + font CSS variables) flow through Tailwind v4's `@theme inline` block in `app/globals.css`. Fonts are self-hosted via `next/font/google` and exposed as CSS variables (`--font-figtree`, `--font-noto-sans`). The OG image is generated at build time by `app/opengraph-image.tsx` using `next/og`.

**Tech Stack:** Next.js 16.2.4, React 19.2.4, Tailwind CSS v4, TypeScript 5, Jest 30 (with `next/jest`), shadcn/ui (button + accordion only), `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-accordion`, `@testing-library/react`, `@testing-library/jest-dom`, `jest-environment-jsdom`.

**Reference spec:** `docs/superpowers/specs/2026-04-26-landing-page-segunda-opiniao-design.md`

---

## File Structure (final state)

```
app/
  layout.tsx                              ← MODIFY: lang="pt-BR", next/font, root metadata
  globals.css                             ← MODIFY: @theme inline tokens
  opengraph-image.tsx                     ← NEW: dynamic OG image (next/og)
  (public)/
    layout.tsx                            ← MODIFY: SiteHeader + SiteFooter
    page.tsx                              ← MODIFY: compose landing sections
    privacidade/page.tsx                  ← NEW: stub LGPD
    termos/page.tsx                       ← NEW: stub
components/
  ui/
    button.tsx                            ← NEW: shadcn Button (cva)
    accordion.tsx                         ← NEW: shadcn Accordion (Radix)
  layout/
    site-header.tsx                       ← NEW: brand + nav + CTA
    site-footer.tsx                       ← NEW: 4-column footer
  landing/
    hero.tsx                              ← NEW
    how-it-works.tsx                      ← NEW
    benefits.tsx                          ← NEW
    reliability.tsx                       ← NEW
    faq.tsx                               ← NEW (client)
    final-cta.tsx                         ← NEW
lib/
  cn.ts                                   ← NEW: clsx + tailwind-merge helper
__tests__/
  landing/page.test.tsx                   ← NEW
  legal/privacidade.test.tsx              ← NEW
  legal/termos.test.tsx                   ← NEW
jest.config.ts                            ← MODIFY: include .test.tsx
jest.setup.ts                             ← MODIFY: import jest-dom matchers
package.json                              ← MODIFY: deps and devDeps
```

**Untouched:** `middleware.ts`, `lib/auth/**`, `lib/supabase/**`, `actions/**`, `app/(protected)/**`, `app/(admin)/**`, `components/auth/**`, `__tests__/lib/**`, `__tests__/auth.integration.test.ts`.

---

## Phase 1 — Foundation

### Task 1: Install runtime dependencies

**Files:**
- Modify: `package.json` (dependencies block)
- Modify: `package-lock.json` (auto)

- [ ] **Step 1: Install runtime packages**

Run:

```bash
npm install clsx tailwind-merge class-variance-authority lucide-react @radix-ui/react-accordion
```

Expected: command completes without `EACCES` or `ERESOLVE` errors. New entries appear in `package.json` `dependencies`.

- [ ] **Step 2: Verify versions resolved**

Run:

```bash
node -e "const p=require('./package.json'); console.log(['clsx','tailwind-merge','class-variance-authority','lucide-react','@radix-ui/react-accordion'].map(d=>d+': '+p.dependencies[d]).join('\n'))"
```

Expected: all five packages print with a version (no `undefined`).

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add UI runtime dependencies for landing page"
```

---

### Task 2: Install dev/test dependencies and configure Jest for React

**Files:**
- Modify: `package.json` (devDependencies)
- Modify: `jest.config.ts:1-23`
- Modify: `jest.setup.ts:1-1`

- [ ] **Step 1: Install dev packages**

Run:

```bash
npm install -D @testing-library/react @testing-library/jest-dom jest-environment-jsdom
```

Expected: command completes; three packages added to `devDependencies`.

- [ ] **Step 2: Update `jest.setup.ts` to load jest-dom matchers**

Replace the entire file contents with:

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Update `jest.config.ts` to match `.test.tsx` files**

Replace the entire file contents with:

```ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const isIntegration = process.env.INTEGRATION === 'true'

const config: Config = {
  testEnvironment: 'node',
  globalSetup: '<rootDir>/jest.global-setup.ts',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: isIntegration
    ? ['**/__tests__/auth.integration.test.ts']
    : ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  testPathIgnorePatterns: isIntegration
    ? ['/node_modules/']
    : ['/node_modules/', '<rootDir>/__tests__/auth.integration.test.ts'],
}

export default createJestConfig(config)
```

> Note: `testEnvironment` stays `node` so the existing server-side `auth.integration.test.ts` keeps working. Each React component test enables `jsdom` per-file via the `@jest-environment jsdom` docblock at the top of the file (used in Tasks 11, 19, 20).

- [ ] **Step 4: Verify existing tests still pass**

Run:

```bash
npm test
```

Expected: all current tests pass (the existing `__tests__/lib/**` suite). No regressions.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json jest.config.ts jest.setup.ts
git commit -m "Configure Jest for React component testing"
```

---

### Task 3: Create `lib/cn.ts`

**Files:**
- Create: `lib/cn.ts`

- [ ] **Step 1: Write `lib/cn.ts`**

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/cn.ts
git commit -m "Add cn() helper for class composition"
```

---

### Task 4: Configure `next/font` in root layout

This task only loads the fonts and applies the variables. Metadata is updated in Task 21.

**Files:**
- Modify: `app/layout.tsx:1-19`

- [ ] **Step 1: Replace `app/layout.tsx` contents**

Full new contents:

```tsx
import type { Metadata } from 'next'
import { Figtree, Noto_Sans } from 'next/font/google'
import './globals.css'

const figtree = Figtree({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-figtree',
})

const notoSans = Noto_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-noto-sans',
  preload: false,
})

export const metadata: Metadata = {
  title: 'Segunda Opinião',
  description: 'Uma segunda opinião médica baseada em ciência.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="pt-BR"
      className={`${figtree.variable} ${notoSans.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 2: Verify dev server boots**

Run (in another terminal or background):

```bash
npm run dev
```

Wait until it prints `Ready in <ms>`. Then verify no font errors. Stop the server (Ctrl+C).

Expected: no error output. (Page may render unstyled because tokens are not yet in `globals.css` — that's Task 5.)

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "Load Figtree and Noto Sans via next/font"
```

---

### Task 5: Add `@theme inline` tokens to `globals.css`

**Files:**
- Modify: `app/globals.css:1-1`

- [ ] **Step 1: Replace `app/globals.css` contents**

Full new contents:

```css
@import "tailwindcss";

@theme inline {
  --color-primary: #0284C7;
  --color-primary-foreground: #FFFFFF;
  --color-primary-hover: #0369A1;
  --color-secondary: #0891B2;
  --color-success: #16A34A;
  --color-destructive: #DC2626;
  --color-background: #F8FAFC;
  --color-surface: #FFFFFF;
  --color-foreground: #0F172A;
  --color-muted-foreground: #475569;
  --color-border: #E2E8F0;
  --color-ring: #0284C7;

  --font-heading: var(--font-figtree);
  --font-sans: var(--font-noto-sans);
}

html {
  scroll-behavior: smooth;
}

@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Verify build succeeds**

Run:

```bash
npm run build
```

Expected: exits successfully (status 0). Tailwind compiles without "unknown utility" errors.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "Define design tokens in Tailwind v4 @theme block"
```

---

## Phase 2 — shadcn primitives

### Task 6: Add `components/ui/button.tsx`

**Files:**
- Create: `components/ui/button.tsx`

- [ ] **Step 1: Write the Button component**

```tsx
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium font-heading transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary-hover',
        outline:
          'border border-border bg-surface text-foreground hover:bg-background',
        ghost: 'text-foreground hover:bg-background',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
)
Button.displayName = 'Button'
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add components/ui/button.tsx
git commit -m "Add Button primitive (cva + buttonVariants)"
```

---

### Task 7: Add `components/ui/accordion.tsx`

**Files:**
- Create: `components/ui/accordion.tsx`

- [ ] **Step 1: Write the Accordion component**

```tsx
'use client'

import * as React from 'react'
import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export const Accordion = AccordionPrimitive.Root

export const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item
    ref={ref}
    className={cn('border-b border-border', className)}
    {...props}
  />
))
AccordionItem.displayName = 'AccordionItem'

export const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        'flex flex-1 items-center justify-between py-4 text-left font-heading text-base font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&[data-state=open]>svg]:rotate-180',
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown
        className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200"
        aria-hidden="true"
      />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = 'AccordionTrigger'

export const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-base text-muted-foreground data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn('pb-4 pt-0 leading-relaxed', className)}>{children}</div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = 'AccordionContent'
```

- [ ] **Step 2: Verify TypeScript compiles**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add components/ui/accordion.tsx
git commit -m "Add Accordion primitive (Radix-based)"
```

---

## Phase 3 — Layout chrome

### Task 8: Create `components/layout/site-header.tsx`

**Files:**
- Create: `components/layout/site-header.tsx`

- [ ] **Step 1: Write the header**

```tsx
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-6 md:px-8">
        <Link
          href="/"
          className="font-heading text-lg font-bold text-foreground"
          aria-label="Segunda Opinião — página inicial"
        >
          Segunda <span className="text-primary">Opinião</span>
        </Link>
        <nav className="flex items-center gap-3 sm:gap-5">
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            Entrar
          </Link>
          <Link
            href="/register"
            className={cn(buttonVariants({ size: 'sm' }))}
          >
            Comece agora
          </Link>
        </nav>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/site-header.tsx
git commit -m "Add SiteHeader with brand and CTA"
```

---

### Task 9: Create `components/layout/site-footer.tsx`

**Files:**
- Create: `components/layout/site-footer.tsx`

- [ ] **Step 1: Write the footer**

```tsx
import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-border bg-surface">
      <div className="mx-auto max-w-[1120px] px-6 py-12 md:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="font-heading text-base font-bold text-foreground">
              Segunda <span className="text-primary">Opinião</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Uma segunda opinião baseada em ciência.
            </p>
          </div>
          <div>
            <h2 className="font-heading text-sm font-semibold text-foreground">
              Produto
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a href="/#como-funciona" className="hover:text-foreground">
                  Como funciona
                </a>
              </li>
              <li>
                <a href="/#beneficios" className="hover:text-foreground">
                  Benefícios
                </a>
              </li>
              <li>
                <a href="/#confiabilidade" className="hover:text-foreground">
                  Confiabilidade
                </a>
              </li>
              <li>
                <a href="/#faq" className="hover:text-foreground">
                  FAQ
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-heading text-sm font-semibold text-foreground">
              Empresa
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <a
                  href="mailto:contato@segundaopiniao.com.br"
                  className="hover:text-foreground"
                >
                  Contato
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h2 className="font-heading text-sm font-semibold text-foreground">
              Legal
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/privacidade" className="hover:text-foreground">
                  Política de Privacidade
                </Link>
              </li>
              <li>
                <Link href="/termos" className="hover:text-foreground">
                  Termos de Uso
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
          © 2026 Segunda Opinião · A Segunda Opinião é uma ferramenta de apoio
          à decisão e não substitui a avaliação de um médico habilitado.
        </p>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/site-footer.tsx
git commit -m "Add SiteFooter with 4-column grid"
```

---

### Task 10: Wire `SiteHeader` and `SiteFooter` into `app/(public)/layout.tsx`

**Files:**
- Modify: `app/(public)/layout.tsx:1-22`

- [ ] **Step 1: Replace the file contents**

Full new contents:

```tsx
import { SiteHeader } from '@/components/layout/site-header'
import { SiteFooter } from '@/components/layout/site-footer'

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
```

- [ ] **Step 2: Boot dev server and confirm header/footer render**

Run:

```bash
npm run dev
```

Open `http://localhost:3000`. Confirm: header shows "Segunda Opinião" with "Comece agora" button; footer shows 4 columns. Header/footer link colors use the new tokens. Stop the server.

Expected: page renders without console errors.

- [ ] **Step 3: Commit**

```bash
git add app/(public)/layout.tsx
git commit -m "Use SiteHeader and SiteFooter in public layout"
```

---

## Phase 4 — Landing sections (TDD-driven)

### Task 11: Write failing smoke test for the landing page

**Files:**
- Create: `__tests__/landing/page.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, within } from '@testing-library/react'
import LandingPage from '@/app/(public)/page'

describe('Landing page', () => {
  beforeEach(() => {
    render(<LandingPage />)
  })

  it('renders an h1 with non-empty text', () => {
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1).toBeInTheDocument()
    expect(h1.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  })

  it('mounts all six landing sections', () => {
    for (const id of [
      'hero',
      'how-it-works',
      'benefits',
      'reliability',
      'faq',
      'final-cta',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
  })

  it('hero has a primary CTA to /register', () => {
    const hero = screen.getByTestId('hero')
    const cta = within(hero).getByRole('link', { name: /comece agora/i })
    expect(cta).toHaveAttribute('href', '/register')
  })

  it('hero has a secondary CTA anchored to #como-funciona', () => {
    const hero = screen.getByTestId('hero')
    const link = within(hero).getByRole('link', { name: /como funciona/i })
    expect(link).toHaveAttribute('href', '#como-funciona')
  })

  it('renders multiple Comece agora CTAs that all point to /register', () => {
    const allCtas = screen.getAllByRole('link', { name: /comece agora/i })
    expect(allCtas.length).toBeGreaterThanOrEqual(2)
    for (const cta of allCtas) {
      expect(cta).toHaveAttribute('href', '/register')
    }
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
npm test -- __tests__/landing/page.test.tsx
```

Expected: test fails. The current `app/(public)/page.tsx` is the placeholder ("AI Agent Platform") so it has an h1 but no `data-testid="hero"` etc. — the "mounts all six landing sections" test will fail with `Unable to find an element by: [data-testid="hero"]`.

- [ ] **Step 3: Commit the failing test**

```bash
git add __tests__/landing/page.test.tsx
git commit -m "Add failing smoke test for landing page"
```

---

### Task 12: Create `components/landing/hero.tsx`

**Files:**
- Create: `components/landing/hero.tsx`

- [ ] **Step 1: Write the Hero component**

```tsx
import Link from 'next/link'
import { ShieldCheck } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function Hero() {
  return (
    <section
      data-testid="hero"
      className="border-b border-border bg-surface"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="font-heading text-4xl font-bold leading-tight text-foreground sm:text-5xl md:text-6xl">
            Uma segunda opinião médica em minutos, baseada em evidências
            científicas.
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground md:text-xl">
            Envie seus exames e receba uma análise probabilística feita por uma
            IA especializada, fundamentada em milhares de artigos científicos.
            Para você decidir os próximos passos com mais segurança — junto com
            o seu médico.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'w-full sm:w-auto'
              )}
            >
              Comece agora
            </Link>
            <Link
              href="#como-funciona"
              className={cn(
                buttonVariants({ variant: 'outline', size: 'lg' }),
                'w-full sm:w-auto'
              )}
            >
              Como funciona
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck
              className="h-4 w-4 text-secondary"
              aria-hidden="true"
            />
            Cadastro gratuito · Dados protegidos pela LGPD · Sua segunda opinião
            complementa, não substitui, seu médico.
          </p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/hero.tsx
git commit -m "Add Hero section"
```

---

### Task 13: Create `components/landing/how-it-works.tsx`

**Files:**
- Create: `components/landing/how-it-works.tsx`

- [ ] **Step 1: Write the section**

```tsx
import { UserPlus, FileUp, Sparkles, FileText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Step = {
  icon: LucideIcon
  title: string
  description: string
}

const steps: Step[] = [
  {
    icon: UserPlus,
    title: 'Crie sua conta',
    description:
      'Em menos de dois minutos, com o mínimo de informação.',
  },
  {
    icon: FileUp,
    title: 'Envie seus exames',
    description:
      'Laudos em PDF ou imagem. Tudo criptografado de ponta a ponta.',
  },
  {
    icon: Sparkles,
    title: 'Análise por IA especialista',
    description:
      'Um agente treinado em medicina cruza seus dados com milhares de estudos.',
  },
  {
    icon: FileText,
    title: 'Receba o relatório',
    description:
      'Hipóteses probabilísticas, justificadas, com referências à literatura.',
  },
]

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      data-testid="how-it-works"
      className="bg-background"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-heading text-sm font-semibold uppercase tracking-wide text-primary">
            Como funciona
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">
            Quatro passos simples para mais clareza
          </h2>
        </div>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <li
                key={step.title}
                className="rounded-lg border border-border bg-surface p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-heading text-sm font-bold text-primary-foreground">
                    {index + 1}
                  </span>
                  <Icon
                    className="h-8 w-8 text-secondary"
                    strokeWidth={1.75}
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/how-it-works.tsx
git commit -m "Add HowItWorks section"
```

---

### Task 14: Create `components/landing/benefits.tsx`

**Files:**
- Create: `components/landing/benefits.tsx`

- [ ] **Step 1: Write the section**

```tsx
import { BookOpen, Brain, Clock, Lock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Benefit = {
  icon: LucideIcon
  title: string
  description: string
}

const benefits: Benefit[] = [
  {
    icon: BookOpen,
    title: 'Baseado em evidência científica',
    description:
      'Cada hipótese é justificada com referências a artigos revisados por pares. Não é uma opinião — é o consenso da literatura aplicado ao seu caso.',
  },
  {
    icon: Brain,
    title: 'IA especialista, não generalista',
    description:
      'Treinada para análise médica. As respostas chegam estruturadas como um relatório clínico, não como uma conversa de chat.',
  },
  {
    icon: Clock,
    title: 'Acessível e rápido',
    description:
      'Sem agendamento, sem deslocamento. Em minutos, a qualquer hora.',
  },
  {
    icon: Lock,
    title: 'Privacidade desde o design',
    description:
      'Criptografia ponta a ponta. Seus dados nunca são usados para treinar modelos públicos. Em conformidade total com a LGPD.',
  },
]

export function Benefits() {
  return (
    <section
      id="beneficios"
      data-testid="benefits"
      className="bg-surface"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-heading text-sm font-semibold uppercase tracking-wide text-primary">
            Por que uma segunda opinião com IA
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">
            Mais ciência, menos espera.
          </h2>
        </div>
        <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => {
            const Icon = b.icon
            return (
              <li key={b.title} className="rounded-lg p-6">
                <Icon
                  className="h-7 w-7 text-primary"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
                  {b.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {b.description}
                </p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/benefits.tsx
git commit -m "Add Benefits section"
```

---

### Task 15: Create `components/landing/reliability.tsx`

**Files:**
- Create: `components/landing/reliability.tsx`

- [ ] **Step 1: Write the section**

```tsx
import { Database, ShieldCheck, Stethoscope, Scale } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type Pillar = {
  icon: LucideIcon
  title: string
  description: string
}

const pillars: Pillar[] = [
  {
    icon: Database,
    title: 'Base científica viva',
    description:
      'Nossa IA consulta continuamente bases de artigos revisados por pares — incluindo PubMed, Cochrane, NEJM, The Lancet e JAMA. Cada conclusão do relatório cita as referências consultadas, para você (ou seu médico) verificar.',
  },
  {
    icon: ShieldCheck,
    title: 'Privacidade e LGPD',
    description:
      'Criptografia em trânsito (TLS 1.3) e em repouso (AES-256). Sua equipe médica não tem acesso à sua conta. Você pode excluir todos os seus dados a qualquer momento, com efeito imediato. Sem venda, sem compartilhamento.',
  },
  {
    icon: Stethoscope,
    title: 'Posicionamento ético',
    description:
      'A Segunda Opinião é uma ferramenta de apoio à decisão clínica. Não emitimos prescrições, atestados ou laudos oficiais. Toda conduta deve ser validada com um médico habilitado.',
  },
]

export function Reliability() {
  return (
    <section
      id="confiabilidade"
      data-testid="reliability"
      className="bg-background"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-heading text-sm font-semibold uppercase tracking-wide text-primary">
            Confiabilidade
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">
            Confiabilidade não é opcional.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Uma segunda opinião sobre saúde precisa ser tão rigorosa quanto a
            primeira. Eis como construímos isso.
          </p>
        </div>
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {pillars.map((p) => {
            const Icon = p.icon
            return (
              <li
                key={p.title}
                className="rounded-lg border border-border bg-surface p-6"
              >
                <Icon
                  className="h-8 w-8 text-primary"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {p.description}
                </p>
              </li>
            )
          })}
        </ul>
        <div className="mt-10 flex items-start gap-3 rounded-lg border border-border bg-surface px-5 py-4">
          <Scale
            className="mt-0.5 h-5 w-5 shrink-0 text-secondary"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            Em conformidade com a LGPD (Lei nº 13.709/2018) e alinhada às
            orientações do CFM (Resolução nº 2.314/2022) e da ANVISA sobre uso
            de IA em saúde.
          </p>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/reliability.tsx
git commit -m "Add Reliability section"
```

---

### Task 16: Create `components/landing/faq.tsx`

**Files:**
- Create: `components/landing/faq.tsx`

- [ ] **Step 1: Write the FAQ component (client)**

```tsx
'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

type Entry = {
  id: string
  question: string
  answer: string
}

const entries: Entry[] = [
  {
    id: 'precisao',
    question: 'A análise da IA é precisa?',
    answer:
      'A precisão depende da qualidade e completude dos exames enviados. Para casos bem documentados, nossos modelos atingem alta concordância com a literatura médica. Mesmo assim, sempre apresentamos as conclusões como probabilidades e hipóteses — nunca como diagnóstico fechado. Use o relatório como insumo da conversa com o seu médico.',
  },
  {
    id: 'acesso',
    question: 'Quem tem acesso aos meus exames?',
    answer:
      'Apenas você. Arquivos são criptografados em trânsito (TLS 1.3) e em repouso (AES-256). Nossa equipe não acessa documentos individuais de pacientes. Você pode apagar todos os seus dados a qualquer momento, com efeito imediato.',
  },
  {
    id: 'substitui-medico',
    question: 'A Segunda Opinião substitui meu médico?',
    answer:
      'Não — e essa é uma escolha consciente. A ferramenta foi projetada para complementar a avaliação clínica, oferecendo uma leitura adicional fundamentada em literatura científica. Decisões sobre tratamento, medicação ou cirurgia devem ser tomadas com um médico habilitado.',
  },
  {
    id: 'tipos-exame',
    question: 'Que tipos de exame posso enviar?',
    answer:
      'Laudos em PDF, imagens (JPG, PNG) e exames de imagem em formato DICOM. Aceitamos hemograma, bioquímica, ultrassom, ressonância, tomografia, raio-X, biópsias e laudos especializados. Caso um formato não seja suportado, avisamos antes do upload.',
  },
  {
    id: 'preco',
    question: 'Quanto custa?',
    answer:
      'Você cria sua conta gratuitamente. As condições comerciais — planos, créditos ou pagamento por análise — são apresentadas dentro da plataforma após o cadastro, com total transparência antes de qualquer cobrança.',
  },
  {
    id: 'normas-brasileiras',
    question: 'A ferramenta segue as normas brasileiras?',
    answer:
      'Sim. Operamos em conformidade com a LGPD (Lei nº 13.709/2018) e seguimos as orientações do CFM (Resolução nº 2.314/2022 sobre telemedicina) e da ANVISA sobre uso de IA em saúde. Nosso posicionamento é o de ferramenta de apoio à decisão, não de dispositivo médico autônomo.',
  },
]

export function Faq() {
  return (
    <section
      id="faq"
      data-testid="faq"
      className="bg-surface"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-20 md:px-8 md:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-heading text-sm font-semibold uppercase tracking-wide text-primary">
            Perguntas frequentes
          </p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-foreground md:text-4xl">
            Tire suas dúvidas
          </h2>
        </div>
        <div className="mx-auto mt-10 max-w-3xl">
          <Accordion type="single" collapsible className="w-full">
            {entries.map((e) => (
              <AccordionItem key={e.id} value={e.id}>
                <AccordionTrigger>{e.question}</AccordionTrigger>
                <AccordionContent>{e.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/faq.tsx
git commit -m "Add FAQ section with Radix Accordion"
```

---

### Task 17: Create `components/landing/final-cta.tsx`

**Files:**
- Create: `components/landing/final-cta.tsx`

- [ ] **Step 1: Write the section**

```tsx
import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/cn'

export function FinalCta() {
  return (
    <section
      data-testid="final-cta"
      className="bg-background"
    >
      <div className="mx-auto max-w-[1120px] px-6 py-16 md:px-8 md:py-20">
        <div className="rounded-2xl bg-primary px-8 py-14 text-center text-primary-foreground md:px-16">
          <h2 className="mx-auto max-w-2xl font-heading text-3xl font-bold md:text-4xl">
            Pronto para uma segunda opinião com base em ciência?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-primary-foreground/90 md:text-lg">
            Crie sua conta em dois minutos e envie seus exames. Sem cartão de
            crédito, sem compromisso.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/register"
              className={cn(
                buttonVariants({ size: 'lg' }),
                'w-full bg-surface text-primary hover:bg-background sm:w-auto'
              )}
            >
              Comece agora
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-primary-foreground/90 underline-offset-4 hover:underline"
            >
              Já tenho conta
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/landing/final-cta.tsx
git commit -m "Add FinalCta section"
```

---

### Task 18: Compose sections in `app/(public)/page.tsx` and pass smoke test

**Files:**
- Modify: `app/(public)/page.tsx:1-23`

- [ ] **Step 1: Replace `app/(public)/page.tsx` with the composition**

Full new contents:

```tsx
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { Benefits } from '@/components/landing/benefits'
import { Reliability } from '@/components/landing/reliability'
import { Faq } from '@/components/landing/faq'
import { FinalCta } from '@/components/landing/final-cta'

export default function LandingPage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Benefits />
      <Reliability />
      <Faq />
      <FinalCta />
    </>
  )
}
```

- [ ] **Step 2: Run the smoke test**

Run:

```bash
npm test -- __tests__/landing/page.test.tsx
```

Expected: all five assertions in `Landing page` pass.

- [ ] **Step 3: Boot dev server and visually confirm**

Run:

```bash
npm run dev
```

Open `http://localhost:3000`. Confirm visually: hero with headline, two CTAs, microcopy with shield icon; "Como funciona" with four numbered cards; "Benefícios" with four icons; "Confiabilidade" with three pillars + LGPD callout; FAQ accordion (click to open); final CTA in primary-blue card. Press Tab repeatedly — focus ring is visible on every interactive element. Stop the server.

Expected: no console errors. All sections render. Keyboard nav works.

- [ ] **Step 4: Commit**

```bash
git add app/(public)/page.tsx
git commit -m "Compose landing sections in public page"
```

---

## Phase 5 — Legal stub pages

### Task 19: Create `/privacidade` stub with smoke test

**Files:**
- Create: `app/(public)/privacidade/page.tsx`
- Create: `__tests__/legal/privacidade.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import PrivacyPage from '@/app/(public)/privacidade/page'

describe('Privacy stub page', () => {
  beforeEach(() => {
    render(<PrivacyPage />)
  })

  it('has an h1 with non-empty text', () => {
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  })

  it('shows the preliminary-version banner', () => {
    expect(screen.getByText(/versão preliminar/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
npm test -- __tests__/legal/privacidade.test.tsx
```

Expected: fails because `app/(public)/privacidade/page.tsx` does not exist (`Cannot find module`).

- [ ] **Step 3: Implement the page**

Create `app/(public)/privacidade/page.tsx` with full contents:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade',
}

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-20">
      <p
        role="status"
        className="mb-8 rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground"
      >
        Versão preliminar. Texto final em revisão jurídica.
      </p>
      <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
        Política de Privacidade
      </h1>
      <div className="mt-8 space-y-6 text-base leading-relaxed text-foreground">
        <p>
          A Segunda Opinião valoriza a sua privacidade. Esta política descreve
          como coletamos, usamos e protegemos seus dados pessoais e médicos, em
          conformidade com a Lei Geral de Proteção de Dados (LGPD, Lei nº
          13.709/2018).
        </p>
        <p>
          <strong className="font-semibold">Dados coletados.</strong> Para o
          cadastro, coletamos e-mail e senha (armazenada apenas com hash). Para
          a análise, coletamos os exames enviados por você (laudos, imagens) e
          metadados associados.
        </p>
        <p>
          <strong className="font-semibold">Bases legais.</strong> Tratamos
          seus dados com base no seu consentimento e na execução do contrato
          de prestação do serviço.
        </p>
        <p>
          <strong className="font-semibold">Segurança.</strong> Aplicamos
          criptografia em trânsito (TLS 1.3) e em repouso (AES-256). O acesso é
          restrito a sistemas automatizados; ninguém da nossa equipe lê seus
          documentos individualmente.
        </p>
        <p>
          <strong className="font-semibold">
            Direitos do titular.
          </strong>{' '}
          Você pode solicitar a qualquer momento acesso, correção,
          portabilidade, anonimização ou exclusão dos seus dados. A exclusão
          tem efeito imediato.
        </p>
        <p>
          <strong className="font-semibold">Contato do encarregado.</strong>{' '}
          Para exercer seus direitos ou esclarecer dúvidas, escreva para{' '}
          <a
            href="mailto:dpo@segundaopiniao.com.br"
            className="text-primary underline-offset-4 hover:underline"
          >
            dpo@segundaopiniao.com.br
          </a>
          .
        </p>
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run:

```bash
npm test -- __tests__/legal/privacidade.test.tsx
```

Expected: both assertions pass.

- [ ] **Step 5: Commit**

```bash
git add app/(public)/privacidade/page.tsx __tests__/legal/privacidade.test.tsx
git commit -m "Add /privacidade stub page with banner"
```

---

### Task 20: Create `/termos` stub with smoke test

**Files:**
- Create: `app/(public)/termos/page.tsx`
- Create: `__tests__/legal/termos.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import TermsPage from '@/app/(public)/termos/page'

describe('Terms stub page', () => {
  beforeEach(() => {
    render(<TermsPage />)
  })

  it('has an h1 with non-empty text', () => {
    const h1 = screen.getByRole('heading', { level: 1 })
    expect(h1.textContent?.trim().length ?? 0).toBeGreaterThan(0)
  })

  it('shows the preliminary-version banner', () => {
    expect(screen.getByText(/versão preliminar/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test and confirm it fails**

Run:

```bash
npm test -- __tests__/legal/termos.test.tsx
```

Expected: fails — page module not found.

- [ ] **Step 3: Implement the page**

Create `app/(public)/termos/page.tsx` with full contents:

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Uso',
}

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16 md:px-8 md:py-20">
      <p
        role="status"
        className="mb-8 rounded-md border border-border bg-surface px-4 py-3 text-sm text-muted-foreground"
      >
        Versão preliminar. Texto final em revisão jurídica.
      </p>
      <h1 className="font-heading text-3xl font-bold text-foreground md:text-4xl">
        Termos de Uso
      </h1>
      <div className="mt-8 space-y-6 text-base leading-relaxed text-foreground">
        <p>
          Ao usar a Segunda Opinião, você concorda com estes termos. Eles
          descrevem o que oferecemos, suas responsabilidades e os limites do
          serviço.
        </p>
        <p>
          <strong className="font-semibold">Natureza do serviço.</strong> A
          Segunda Opinião é uma ferramenta de apoio à decisão clínica baseada
          em inteligência artificial. Não é dispositivo médico, não emite
          prescrições, atestados ou laudos oficiais.
        </p>
        <p>
          <strong className="font-semibold">
            Validação por médico habilitado.
          </strong>{' '}
          Toda decisão clínica — diagnóstico, tratamento, medicação,
          procedimento — deve ser tomada em conjunto com um médico
          regularmente habilitado.
        </p>
        <p>
          <strong className="font-semibold">
            Limitação de responsabilidade.
          </strong>{' '}
          O conteúdo gerado é apresentado em forma probabilística e tem caráter
          informativo. Não nos responsabilizamos por decisões clínicas tomadas
          sem o devido acompanhamento médico.
        </p>
        <p>
          <strong className="font-semibold">
            Propriedade intelectual.
          </strong>{' '}
          O software, a marca e os relatórios produzidos são propriedade da
          Segunda Opinião. Você mantém a titularidade dos seus dados pessoais
          e exames.
        </p>
        <p>
          <strong className="font-semibold">Foro.</strong> Eventuais
          controvérsias serão dirimidas no foro da Comarca de São Paulo (SP).
        </p>
      </div>
    </article>
  )
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run:

```bash
npm test -- __tests__/legal/termos.test.tsx
```

Expected: both assertions pass.

- [ ] **Step 5: Commit**

```bash
git add app/(public)/termos/page.tsx __tests__/legal/termos.test.tsx
git commit -m "Add /termos stub page with banner"
```

---

## Phase 6 — Metadata and OG image

### Task 21: Update root metadata in `app/layout.tsx`

**Files:**
- Modify: `app/layout.tsx:18-21`

- [ ] **Step 1: Replace the `metadata` export only**

Locate the current `export const metadata` (added in Task 4) and replace with:

```tsx
export const metadata: Metadata = {
  metadataBase: new URL('https://segundaopiniao.com.br'),
  title: {
    default: 'Segunda Opinião — Uma segunda opinião médica baseada em ciência',
    template: '%s · Segunda Opinião',
  },
  description:
    'Envie seus exames e receba uma segunda opinião médica em minutos, com análise probabilística feita por uma IA especializada e fundamentada em evidências científicas.',
  applicationName: 'Segunda Opinião',
  authors: [{ name: 'Segunda Opinião' }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Segunda Opinião',
    title: 'Segunda Opinião — Uma segunda opinião médica baseada em ciência',
    description:
      'Envie seus exames e receba uma análise probabilística feita por uma IA especializada, fundamentada em milhares de artigos científicos.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Segunda Opinião',
    description:
      'Uma segunda opinião médica em minutos, baseada em evidências científicas.',
  },
  robots: { index: true, follow: true },
}
```

> Note: `openGraph.images` and `twitter.images` are not set explicitly; the file convention `app/opengraph-image.tsx` (Task 22) auto-fills these.

- [ ] **Step 2: Run the build and verify metadata**

Run:

```bash
npm run build
```

Expected: build succeeds. No "metadataBase missing" warnings.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "Set root metadata with brand title, OG/Twitter, robots"
```

---

### Task 22: Create dynamic OG image at `app/opengraph-image.tsx`

**Files:**
- Create: `app/opengraph-image.tsx`

- [ ] **Step 1: Write the OG image route**

```tsx
import { ImageResponse } from 'next/og'

export const alt =
  'Segunda Opinião — Uma segunda opinião médica baseada em ciência.'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#FFFFFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '64px',
          color: '#0F172A',
        }}
      >
        <div
          style={{
            fontSize: 96,
            fontWeight: 700,
            letterSpacing: -2,
            display: 'flex',
            gap: 16,
          }}
        >
          <span>Segunda</span>
          <span style={{ color: '#0284C7' }}>Opinião</span>
        </div>
        <div
          style={{
            marginTop: 32,
            fontSize: 36,
            color: '#475569',
            textAlign: 'center',
            maxWidth: 900,
            lineHeight: 1.3,
          }}
        >
          Uma segunda opinião médica em minutos, baseada em evidências
          científicas.
        </div>
        <div
          style={{
            position: 'absolute',
            bottom: 48,
            left: 64,
            right: 64,
            height: 6,
            background: '#0284C7',
            borderRadius: 3,
          }}
        />
      </div>
    ),
    { ...size }
  )
}
```

> Note: this uses the default `next/og` font fallback. Embedding the brand font (Figtree Bold) would require checking in a TTF binary to the repo — out of scope for this MVP. The image is statically optimized at build time.

- [ ] **Step 2: Run the build to confirm OG image generates**

Run:

```bash
npm run build
```

Expected: build succeeds. Output mentions a generated route or asset for `/opengraph-image`.

- [ ] **Step 3: Commit**

```bash
git add app/opengraph-image.tsx
git commit -m "Add dynamic OG image via next/og"
```

---

## Phase 7 — Final QA

### Task 23: Run all checks and verify acceptance criteria

**Files:** none (read-only verification)

- [ ] **Step 1: Lint**

Run:

```bash
npm run lint
```

Expected: exits successfully. No errors. Warnings (if any) are read and acknowledged.

- [ ] **Step 2: Type check**

Run:

```bash
npx tsc --noEmit
```

Expected: exit code 0, zero errors.

- [ ] **Step 3: Run all tests**

Run:

```bash
npm test
```

Expected: all suites pass — `__tests__/lib/**`, `__tests__/landing/page.test.tsx`, `__tests__/legal/privacidade.test.tsx`, `__tests__/legal/termos.test.tsx`.

- [ ] **Step 4: Production build**

Run:

```bash
npm run build
```

Expected: build succeeds; static pages generated for `/`, `/privacidade`, `/termos`, `/login`, `/register`. No metadata warnings.

- [ ] **Step 5: Visual smoke (manual)**

Run:

```bash
npm run dev
```

In a browser:
1. Open `http://localhost:3000` — verify all six sections render in order: Hero, Como funciona, Benefícios, Confiabilidade, FAQ, CTA Final.
2. Click "Comece agora" in hero — confirm it navigates to `/register`.
3. Click "Como funciona" in hero — confirm it scrolls smoothly to the "Como funciona" section.
4. Click each FAQ question — confirm it expands/collapses with chevron rotation.
5. Click footer link "Política de Privacidade" — confirm `/privacidade` opens with the "Versão preliminar" banner.
6. Click browser back, then footer link "Termos de Uso" — confirm `/termos` opens.
7. Click footer anchor "Como funciona" — confirm it returns to landing and scrolls to section.
8. Press Tab repeatedly through the page — confirm focus ring is visible on every link/button (header CTA, hero CTAs, FAQ triggers, footer links).
9. Resize the browser to 375px width — confirm: no horizontal scroll, hero CTAs full-width and stacked, grids collapse to one column.
10. Resize to 768px and 1024px — confirm: grids transition to 2 and 4 columns respectively.
11. In DevTools, enable "Emulate prefers-reduced-motion: reduce" — confirm scroll animation is disabled when clicking "Como funciona".

Stop the server.

Expected: every step passes. No console errors during the session.

- [ ] **Step 6: Lighthouse audit (manual)**

In the same dev server (or a fresh `npm run build && npm run start`), open Chrome DevTools → Lighthouse → Desktop → "Analyze page load" on `http://localhost:3000`.

Expected: scores ≥ 95 on Performance, Accessibility, Best Practices, SEO. If any score is below 95, capture the failing audit name and address it before proceeding.

- [ ] **Step 7: Final commit (only if any tweak was made during QA)**

If any small fix was made in steps 1-6 (e.g., an alt text correction, a contrast tweak):

```bash
git add -A
git commit -m "Address final QA findings"
```

If no changes were needed, skip this commit.

- [ ] **Step 8: Verify git history**

Run:

```bash
git log --oneline -25
```

Expected: a clean sequence of commits from "Add UI runtime dependencies for landing page" through (optionally) "Address final QA findings". No "WIP" or fixup commits.

---

## Acceptance Criteria Mapping

| Spec criterion | Implemented in |
|---|---|
| 1. Landing PT-BR with six sections | Tasks 12–18 |
| 2. `/privacidade` and `/termos` stubs with banner | Tasks 19, 20 |
| 3. Header and footer in `(public)` | Tasks 8, 9, 10 |
| 4. Tokens via `@theme inline` | Task 5 |
| 5. CTAs to `/register` and section anchors | Tasks 8, 12, 17 |
| 6. Lighthouse ≥ 95 | Task 23, Step 6 |
| 7. Smoke tests pass | Tasks 11, 18, 19, 20, 23 |
| 8. Keyboard nav with focus ring | Tasks 5, 6, 23 |
| 9. Responsive 375/768/1024/1440 | Tasks 8, 9, 12–17, 23 |
| 10. `prefers-reduced-motion` respected | Task 5, Task 23 Step 5 |

---

## Out of Scope (deferred)

- Brand-font (Figtree) inside the OG image — would require committing a TTF binary
- Real legal text in `/privacidade` and `/termos` — needs lawyer review
- About page and CNPJ in footer — pending business confirmation
- Cookie banner / analytics — explicitly excluded by spec
- i18n — only PT-BR for now
- Logo gráfico (visual mark) — wordmark only
