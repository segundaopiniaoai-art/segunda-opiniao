# Dashboard & Consultation UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign protected pages (dashboard, new consultation, consultation detail) to align visually with the landing page and add rich feedback transitions during upload/processing.

**Architecture:** Component-based redesign preserving existing business logic (server actions, Supabase real-time, Mastra workflow). New layout components (CollapsibleSidebar, BottomNav, MobileHeader) replace the current static sidebar. New feedback components (FormStepper, FileUploadProgress, ProcessingCard, AnimatedSection) layer rich UX on top of existing data flows.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Supabase real-time, Lucide icons, CVA

**Spec:** `docs/superpowers/specs/2026-04-27-dashboard-consultation-ux-redesign-design.md`

---

## File Map

### New Files

| File | Responsibility |
|---|---|
| `components/layout/collapsible-sidebar.tsx` | Desktop sidebar with collapse/expand, nav items, localStorage persistence |
| `components/layout/mobile-header.tsx` | Mobile sticky header with logo + logout |
| `components/layout/bottom-nav.tsx` | Mobile fixed bottom navigation (2 items) |
| `components/consultation/form-stepper.tsx` | Horizontal stepper with 3 steps, scroll tracking, "sending" state |
| `components/consultation/file-upload-progress.tsx` | Per-file progress bars with retry logic |
| `components/consultation/processing-card.tsx` | Processing state card with decorative timed steps |
| `components/consultation/animated-section.tsx` | Wrapper for fade-in-up stagger animation |
| `components/ui/status-badge.tsx` | Reusable status badge with icon + animation |

### Modified Files

| File | Changes |
|---|---|
| `app/globals.css` | Add `--color-muted`, `@keyframes fade-in-up`, `animate-fade-in-up` utility |
| `app/(protected)/layout.tsx` | Replace static sidebar with responsive layout (sidebar desktop, header+bottom-nav mobile) |
| `app/(protected)/dashboard/page.tsx` | Add `font-heading` to title |
| `app/(protected)/consultas/nova/page.tsx` | Add `font-heading` to title |
| `app/(protected)/consultas/[id]/page.tsx` | Update styling to match design system |
| `components/dashboard/consultation-list.tsx` | Redesign cards with new StatusBadge, larger icons, hover states |
| `components/consultation/consultation-form.tsx` | Integrate FormStepper, FileUploadProgress, fixed mobile submit, beforeunload |
| `components/consultation/consultation-status-live.tsx` | Integrate ProcessingCard, pending state, animated result transition |
| `components/consultation/consultation-result.tsx` | Wrap sections in AnimatedSection for stagger |
| `components/consultation/consultation-failed.tsx` | Update styling to match design tokens |

---

## Task 1: Design Tokens & Animation Keyframes

**Files:**
- Modify: `app/globals.css:1-37`

- [ ] **Step 1: Add `--color-muted` token and animation keyframes to globals.css**

In `app/globals.css`, add `--color-muted` inside the `@theme inline` block, and add the `@keyframes fade-in-up` after the existing styles:

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
  --color-muted: #F1F5F9;
  --color-muted-foreground: #475569;
  --color-border: #E2E8F0;
  --color-ring: #0284C7;

  --font-heading: var(--font-figtree);
  --font-sans: var(--font-noto-sans);

  --animate-fade-in-up: fade-in-up 500ms ease-out both;
}

@keyframes fade-in-up {
  from {
    opacity: 0;
    transform: translateY(1rem);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
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

- [ ] **Step 2: Verify the app still builds**

Run: `npx next build 2>&1 | head -20` (or `npm run build`)
Expected: Build succeeds without errors.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat: add --color-muted token and fade-in-up animation keyframe"
```

---

## Task 2: StatusBadge Component

**Files:**
- Create: `components/ui/status-badge.tsx`

- [ ] **Step 1: Create the StatusBadge component**

```tsx
import { cn } from '@/lib/cn'
import {
  Clock,
  Loader2,
  CheckCircle,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'

type Status = 'pending' | 'processing' | 'completed' | 'failed'

const config: Record<Status, { label: string; icon: LucideIcon; classes: string; iconClasses?: string }> = {
  pending: {
    label: 'Aguardando upload',
    icon: Clock,
    classes: 'bg-muted/50 text-muted-foreground',
  },
  processing: {
    label: 'Em processamento',
    icon: Loader2,
    classes: 'bg-primary/10 text-primary',
    iconClasses: 'animate-spin',
  },
  completed: {
    label: 'Concluida',
    icon: CheckCircle,
    classes: 'bg-success/10 text-success',
  },
  failed: {
    label: 'Falhou',
    icon: AlertTriangle,
    classes: 'bg-destructive/10 text-destructive',
  },
}

export function StatusBadge({
  status,
  className,
}: {
  status: Status
  className?: string
}) {
  const { label, icon: Icon, classes, iconClasses } = config[status] ?? config.pending

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full',
        classes,
        className
      )}
    >
      <Icon className={cn('h-3 w-3', iconClasses)} />
      {label}
    </span>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors related to status-badge.

- [ ] **Step 3: Commit**

```bash
git add components/ui/status-badge.tsx
git commit -m "feat: add StatusBadge component with icon and animation support"
```

---

## Task 3: CollapsibleSidebar Component

**Files:**
- Create: `components/layout/collapsible-sidebar.tsx`

- [ ] **Step 1: Create the CollapsibleSidebar component**

```tsx
'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardList,
  Plus,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { logout } from '@/actions/auth'

const STORAGE_KEY = 'sidebar-collapsed'

const navItems = [
  { href: '/dashboard', label: 'Minhas Consultas', icon: ClipboardList },
  { href: '/consultas/nova', label: 'Nova Consulta', icon: Plus },
]

export function CollapsibleSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [labelsVisible, setLabelsVisible] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'true') {
      setCollapsed(true)
      setLabelsVisible(false)
    }
  }, [])

  const toggle = () => {
    const next = !collapsed
    localStorage.setItem(STORAGE_KEY, String(next))

    if (next) {
      // Collapsing: fade labels first, then shrink
      setLabelsVisible(false)
      setTimeout(() => setCollapsed(true), 150)
    } else {
      // Expanding: grow first, then fade labels in
      setCollapsed(false)
      setTimeout(() => setLabelsVisible(true), 200)
    }
  }

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col border-r border-border bg-surface transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-56'
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
                  : 'text-muted-foreground hover:text-foreground hover:bg-background'
              )}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              <span
                className={cn(
                  'overflow-hidden whitespace-nowrap transition-opacity duration-150',
                  labelsVisible ? 'opacity-100' : 'opacity-0'
                )}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="p-4">
        <form action={logout}>
          <button
            type="submit"
            className={cn(
              'flex items-center gap-3 text-sm text-muted-foreground hover:text-foreground w-full px-1',
              collapsed && 'justify-center'
            )}
          >
            <LogOut className="h-4 w-4 flex-shrink-0" />
            <span
              className={cn(
                'overflow-hidden whitespace-nowrap transition-opacity duration-150',
                labelsVisible ? 'opacity-100' : 'opacity-0'
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

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add components/layout/collapsible-sidebar.tsx
git commit -m "feat: add CollapsibleSidebar with two-phase animation and localStorage"
```

---

## Task 4: MobileHeader Component

**Files:**
- Create: `components/layout/mobile-header.tsx`

- [ ] **Step 1: Create the MobileHeader component**

```tsx
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { logout } from '@/actions/auth'

export function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border bg-surface px-4 lg:hidden">
      <Link
        href="/dashboard"
        className="font-heading text-lg font-bold text-foreground"
      >
        Segunda <span className="text-primary">Opiniao</span>
      </Link>
      <form action={logout}>
        <button
          type="submit"
          className="text-muted-foreground hover:text-foreground p-2"
          aria-label="Sair"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </form>
    </header>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/mobile-header.tsx
git commit -m "feat: add MobileHeader component for mobile protected layout"
```

---

## Task 5: BottomNav Component

**Files:**
- Create: `components/layout/bottom-nav.tsx`

- [ ] **Step 1: Create the BottomNav component**

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ClipboardList, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

const items = [
  { href: '/dashboard', label: 'Consultas', icon: ClipboardList },
  { href: '/consultas/nova', label: 'Nova Consulta', icon: Plus },
]

export function BottomNav() {
  const pathname = usePathname()

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

- [ ] **Step 2: Commit**

```bash
git add components/layout/bottom-nav.tsx
git commit -m "feat: add BottomNav component with safe area insets"
```

---

## Task 6: Protected Layout Redesign

**Files:**
- Modify: `app/(protected)/layout.tsx` (full rewrite, current: 42 lines)

- [ ] **Step 1: Rewrite the protected layout**

Replace the entire contents of `app/(protected)/layout.tsx`:

```tsx
import { CollapsibleSidebar } from '@/components/layout/collapsible-sidebar'
import { MobileHeader } from '@/components/layout/mobile-header'
import { BottomNav } from '@/components/layout/bottom-nav'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <CollapsibleSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <MobileHeader />

        <main className="flex-1 px-6 py-8 pb-20 lg:pb-8 md:px-8">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>

        <BottomNav />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the app still renders**

Run: `npm run dev` and navigate to `/dashboard` in the browser. Verify:
- Desktop (>1024px): sidebar visible, collapsible, nav works
- Mobile (<1024px): header visible at top, bottom nav at bottom, no sidebar

- [ ] **Step 3: Commit**

```bash
git add app/(protected)/layout.tsx
git commit -m "feat: redesign protected layout with collapsible sidebar and mobile nav"
```

---

## Task 7: Dashboard Page & Consultation Cards Redesign

**Files:**
- Modify: `app/(protected)/dashboard/page.tsx:14-23`
- Modify: `components/dashboard/consultation-list.tsx` (full rewrite, current: 78 lines)

- [ ] **Step 1: Update dashboard page title**

In `app/(protected)/dashboard/page.tsx`, change line 17:

```tsx
// Old:
<h1 className="text-2xl font-bold">Minhas Consultas</h1>

// New:
<h1 className="font-heading text-2xl md:text-3xl font-bold">Minhas Consultas</h1>
```

- [ ] **Step 2: Rewrite ConsultationList with redesigned cards**

Replace the entire contents of `components/dashboard/consultation-list.tsx`:

```tsx
import Link from 'next/link'
import {
  HeartPulse, Ribbon, Brain, Bone, ScanFace, Stethoscope, ClipboardPlus,
  type LucideIcon,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/status-badge'
import { cn } from '@/lib/cn'

const iconMap: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  ribbon: Ribbon,
  brain: Brain,
  bone: Bone,
  'scan-face': ScanFace,
  stethoscope: Stethoscope,
}

type Specialist = { name: string; icon: string }

type Consultation = {
  id: string
  status: string
  created_at: string
  specialist: Specialist | Specialist[]
}

type Props = { consultations: Consultation[] }

export function ConsultationList({ consultations }: Props) {
  if (consultations.length === 0) {
    return (
      <div className="text-center py-16">
        <ClipboardPlus className="mx-auto h-16 w-16 text-primary/30 mb-4" />
        <p className="font-heading text-xl mb-2">Voce ainda nao tem consultas</p>
        <p className="text-muted-foreground mb-6">Crie sua primeira consulta para comecar.</p>
        <Link href="/consultas/nova" className={buttonVariants()}>
          Criar sua primeira consulta
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {consultations.map((consultation) => {
        const specialist = Array.isArray(consultation.specialist)
          ? consultation.specialist[0]
          : consultation.specialist
        const Icon = iconMap[specialist?.icon ?? ''] ?? Stethoscope
        const date = new Date(consultation.created_at).toLocaleDateString('pt-BR')
        const status = consultation.status as 'pending' | 'processing' | 'completed' | 'failed'

        return (
          <Link
            key={consultation.id}
            href={`/consultas/${consultation.id}`}
            className={cn(
              'bg-surface rounded-lg border border-border p-5 hover:border-primary/30 hover:shadow-md transition-all duration-200 block',
              status === 'processing' && 'animate-pulse border-primary/20'
            )}
          >
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-heading font-semibold text-base truncate">
                  {specialist?.name}
                </p>
                <p className="text-sm text-muted-foreground">{date}</p>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <StatusBadge status={status} />
            </div>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Navigate to `/dashboard`. Verify:
- Cards display in 2-col grid on desktop, 1-col on mobile
- Hover shows shadow + border color change
- Processing cards pulse
- Empty state shows large icon + descriptive text

- [ ] **Step 4: Commit**

```bash
git add app/(protected)/dashboard/page.tsx components/dashboard/consultation-list.tsx
git commit -m "feat: redesign dashboard cards with StatusBadge, larger icons, and hover states"
```

---

## Task 8: FormStepper Component

**Files:**
- Create: `components/consultation/form-stepper.tsx`

- [ ] **Step 1: Create the FormStepper component**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

export type StepState = 'future' | 'current' | 'complete'

type Step = {
  label: string
  ref: React.RefObject<HTMLElement | null>
}

type Props = {
  steps: Step[]
  completionState: StepState[]
  isSending?: boolean
}

export function FormStepper({ steps, completionState, isSending }: Props) {
  const [activeIndex, setActiveIndex] = useState(0)
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

        if (visible.length > 0) {
          const el = visible[0].target
          const idx = steps.findIndex((s) => s.ref.current === el)
          if (idx !== -1) setActiveIndex(idx)
        }
      },
      { threshold: 0.5, rootMargin: '-10% 0px' }
    )

    steps.forEach((step) => {
      if (step.ref.current) observerRef.current?.observe(step.ref.current)
    })

    return () => observerRef.current?.disconnect()
  }, [steps])

  const handleClick = (index: number) => {
    steps[index].ref.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <nav
      role="navigation"
      aria-label="Progresso do formulario"
      className="flex items-center gap-2 py-4"
    >
      {steps.map((step, i) => {
        const state = isSending ? 'complete' : completionState[i]

        return (
          <div key={step.label} className="flex items-center gap-2 flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => handleClick(i)}
              aria-current={!isSending && activeIndex === i ? 'step' : undefined}
              className="flex items-center gap-2"
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium flex-shrink-0 transition-colors',
                  state === 'complete' && 'bg-primary text-white',
                  state === 'current' && 'border-2 border-primary text-primary',
                  state === 'future' && 'border border-border text-muted-foreground'
                )}
              >
                {state === 'complete' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span
                className={cn(
                  'text-sm sr-only sm:not-sr-only sm:inline whitespace-nowrap',
                  state === 'complete' && 'text-foreground font-medium',
                  state === 'current' && 'text-primary font-semibold',
                  state === 'future' && 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </button>

            {i < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-0.5 rounded-full',
                  state === 'complete' ? 'bg-primary' : 'bg-border'
                )}
              />
            )}
          </div>
        )
      })}

      {isSending && (
        <div className="flex items-center gap-2 ml-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <span className="text-sm text-primary font-semibold hidden sm:inline">
            Enviando
          </span>
        </div>
      )}
    </nav>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add components/consultation/form-stepper.tsx
git commit -m "feat: add FormStepper with IntersectionObserver scroll tracking"
```

---

## Task 9: FileUploadProgress Component

**Files:**
- Create: `components/consultation/file-upload-progress.tsx`

- [ ] **Step 1: Create the FileUploadProgress component**

```tsx
'use client'

import {
  Upload,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'

export type FileUploadStatus = 'pending' | 'uploading' | 'done' | 'error'

export type FileProgress = {
  fileName: string
  fileSize: number
  status: FileUploadStatus
  error?: string
}

type UploadPhase =
  | { type: 'uploading' }
  | { type: 'success' }
  | { type: 'upload-error' }
  | { type: 'confirm-error'; message: string; retryCount: number }

type Props = {
  files: FileProgress[]
  phase: UploadPhase
  onRetryFailed: () => void
  onBackToForm: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileUploadProgress({ files, phase, onRetryFailed, onBackToForm }: Props) {
  const title = (() => {
    switch (phase.type) {
      case 'uploading':
        return { text: 'Enviando seus exames...', icon: null }
      case 'success':
        return { text: 'Exames enviados! Iniciando analise...', icon: <CheckCircle className="h-5 w-5 text-success" /> }
      case 'upload-error':
        return { text: 'Erro no envio de alguns arquivos', icon: <AlertTriangle className="h-5 w-5 text-destructive" /> }
      case 'confirm-error':
        return { text: 'Erro ao iniciar analise', icon: <AlertTriangle className="h-5 w-5 text-destructive" /> }
    }
  })()

  return (
    <div
      className="bg-surface rounded-lg border border-border p-6 space-y-4"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {title.icon}
        <h3 className="font-heading font-semibold">{title.text}</h3>
      </div>

      <ul className="space-y-3">
        {files.map((file) => (
          <li key={file.fileName} className="space-y-1.5">
            <div className="flex items-center gap-2 min-w-0">
              <StatusIcon status={file.status} />
              <span className="text-sm truncate min-w-0 flex-1">
                {file.fileName}
              </span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatSize(file.fileSize)}
              </span>
            </div>
            <div
              className="h-1.5 rounded-full bg-border overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                file.status === 'done' ? 100
                : file.status === 'uploading' ? 66
                : file.status === 'error' ? 100
                : 0
              }
            >
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-1000',
                  file.status === 'uploading' && 'w-2/3 bg-primary',
                  file.status === 'done' && 'w-full bg-success',
                  file.status === 'error' && 'w-full bg-destructive',
                  file.status === 'pending' && 'w-0'
                )}
              />
            </div>
            {file.status === 'error' && file.error && (
              <p className="text-xs text-destructive">{file.error}</p>
            )}
          </li>
        ))}
      </ul>

      {phase.type === 'upload-error' && (
        <Button onClick={onRetryFailed} variant="outline">
          Tentar novamente
        </Button>
      )}

      {phase.type === 'confirm-error' && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{phase.message}</p>
          {phase.retryCount < 2 ? (
            <Button onClick={onRetryFailed} variant="outline">
              Tentar novamente
            </Button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-destructive">
                Erro persistente. Tente criar uma nova consulta.
              </p>
              <Button onClick={onBackToForm} variant="outline">
                Voltar ao formulario
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StatusIcon({ status }: { status: FileUploadStatus }) {
  switch (status) {
    case 'uploading':
      return <Upload className="h-4 w-4 text-primary flex-shrink-0" />
    case 'done':
      return <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
    case 'error':
      return <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
    default:
      return <div className="h-4 w-4 flex-shrink-0" />
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add components/consultation/file-upload-progress.tsx
git commit -m "feat: add FileUploadProgress with per-file bars and retry support"
```

---

## Task 10: AnimatedSection Component

**Files:**
- Create: `components/consultation/animated-section.tsx`

- [ ] **Step 1: Create the AnimatedSection component**

```tsx
type Props = {
  index: number
  children: React.ReactNode
  className?: string
}

export function AnimatedSection({ index, children, className }: Props) {
  return (
    <div
      className={className}
      style={{ animationDelay: `${index * 150}ms` }}
    >
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/consultation/animated-section.tsx
git commit -m "feat: add AnimatedSection wrapper for stagger animations"
```

---

## Task 11: ProcessingCard Component

**Files:**
- Create: `components/consultation/processing-card.tsx`

- [ ] **Step 1: Create the ProcessingCard component**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { Loader2, CheckCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/cn'

const STEP_INTERVAL = 30_000 // 30 seconds

const decorativeSteps = [
  'Lendo documentos',
  'Analisando resultados',
  'Preparando relatorio',
]

export function ProcessingCard() {
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= decorativeSteps.length - 1) return prev
        return prev + 1
      })
    }, STEP_INTERVAL)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-8 text-center space-y-6">
      <div className="space-y-2">
        <Loader2 className="h-12 w-12 text-primary animate-spin mx-auto" />
        <h3 className="font-heading text-lg font-semibold">
          Analisando seus exames...
        </h3>
        <p className="text-sm text-muted-foreground">
          Isso pode levar alguns minutos. Voce pode sair e voltar a qualquer
          momento — o resultado aparecera automaticamente.
        </p>
      </div>

      <ul className="space-y-3 text-left max-w-xs mx-auto" aria-live="polite">
        {decorativeSteps.map((step, i) => (
          <li key={step} className="flex items-center gap-3">
            <StepIcon index={i} current={currentStep} />
            <span
              className={cn(
                'text-sm transition-opacity duration-300',
                i <= currentStep ? 'opacity-100' : 'opacity-60'
              )}
            >
              {step}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function StepIcon({ index, current }: { index: number; current: number }) {
  if (index < current) {
    return <CheckCircle className="h-5 w-5 text-success flex-shrink-0" />
  }
  if (index === current) {
    return <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />
  }
  return <Circle className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add components/consultation/processing-card.tsx
git commit -m "feat: add ProcessingCard with decorative timed step indicator"
```

---

## Task 12: Integrate FormStepper & FileUploadProgress into ConsultationForm

**Files:**
- Modify: `components/consultation/consultation-form.tsx` (full rewrite, current: 161 lines)
- Modify: `app/(protected)/consultas/nova/page.tsx:14-19`

- [ ] **Step 1: Update nova page title**

In `app/(protected)/consultas/nova/page.tsx`, change line 15:

```tsx
// Old:
<h1 className="text-2xl font-bold mb-6">Nova Consulta</h1>

// New:
<h1 className="font-heading text-2xl md:text-3xl font-bold mb-6">Nova Consulta</h1>
```

- [ ] **Step 2: Rewrite ConsultationForm with stepper, upload progress, and beforeunload**

Replace the entire contents of `components/consultation/consultation-form.tsx`:

```tsx
'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { PdfDropzone } from './pdf-dropzone'
import { PatientContextInput } from './patient-context-input'
import { SpecialistPicker, type Specialist } from './specialist-picker'
import { FormStepper, type StepState } from './form-stepper'
import {
  FileUploadProgress,
  type FileProgress,
  type FileUploadStatus,
} from './file-upload-progress'
import {
  createConsultation,
  confirmConsultationUpload,
} from '@/actions/consultation'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

type Props = {
  specialists: Specialist[]
}

type SubmitPhase =
  | null
  | { type: 'uploading' }
  | { type: 'success' }
  | { type: 'upload-error' }
  | { type: 'confirm-error'; message: string; retryCount: number }

export function ConsultationForm({ specialists }: Props) {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [patientContext, setPatientContext] = useState('')
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([])
  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>(null)
  const consultationIdRef = useRef<string | null>(null)
  const uploadUrlsRef = useRef<{ fileName: string; url: string }[]>([])
  const confirmRetryCountRef = useRef(0)

  const ref0 = useRef<HTMLElement>(null)
  const ref1 = useRef<HTMLElement>(null)
  const ref2 = useRef<HTMLElement>(null)
  const sectionRefs = [ref0, ref1, ref2]

  const canSubmit = files.length > 0 && selectedSpecialistId && !isSubmitting

  // beforeunload protection during upload
  useEffect(() => {
    if (!isSubmitting) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isSubmitting])

  const stepperSteps = useMemo(() => [
    { label: 'Exames', ref: sectionRefs[0] },
    { label: 'Contexto', ref: sectionRefs[1] },
    { label: 'Especialista', ref: sectionRefs[2] },
  ], [])

  const completionState: StepState[] = [
    files.length > 0 ? 'complete' : 'current',
    'complete', // always complete (optional field)
    selectedSpecialistId ? 'complete' : files.length > 0 ? 'current' : 'future',
  ]

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    setIsSubmitting(true)
    setError(null)
    setSubmitPhase({ type: 'uploading' })

    const progress: FileProgress[] = files.map((f) => ({
      fileName: f.name,
      fileSize: f.size,
      status: 'pending' as FileUploadStatus,
    }))
    setFileProgress([...progress])

    const result = await createConsultation({
      specialistId: selectedSpecialistId!,
      patientContext: patientContext.trim() || undefined,
      files: files.map((f) => ({ name: f.name, size: f.size })),
    })

    if ('error' in result) {
      setError(result.error)
      setIsSubmitting(false)
      setSubmitPhase(null)
      return
    }

    consultationIdRef.current = result.consultationId
    uploadUrlsRef.current = result.uploadUrls

    await uploadFiles(files, result.uploadUrls, progress, result.consultationId)
  }, [canSubmit, selectedSpecialistId, patientContext, files])

  const uploadFiles = async (
    filesToUpload: File[],
    urls: { fileName: string; url: string }[],
    progress: FileProgress[],
    conId: string
  ) => {
    let allUploaded = true

    for (let i = 0; i < filesToUpload.length; i++) {
      if (progress[i].status === 'done') continue // skip already uploaded

      progress[i].status = 'uploading'
      setFileProgress([...progress])

      const uploadUrl = urls.find((u) => u.fileName === filesToUpload[i].name)
      if (!uploadUrl) {
        progress[i].status = 'error'
        progress[i].error = 'URL de upload nao encontrada'
        allUploaded = false
        setFileProgress([...progress])
        continue
      }

      try {
        const response = await fetch(uploadUrl.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: filesToUpload[i],
        })
        if (!response.ok) throw new Error('Upload failed')
        progress[i].status = 'done'
      } catch {
        progress[i].status = 'error'
        progress[i].error = 'Falha no envio'
        allUploaded = false
      }

      setFileProgress([...progress])
    }

    if (!allUploaded) {
      setSubmitPhase({ type: 'upload-error' })
      setIsSubmitting(false)
      return
    }

    // All uploaded — confirm
    setSubmitPhase({ type: 'success' })
    await new Promise((r) => setTimeout(r, 800))

    await confirmUpload(conId)
  }

  const confirmUpload = async (id: string) => {
    if (!id) return

    const confirmResult = await confirmConsultationUpload(id)

    if ('error' in confirmResult) {
      confirmRetryCountRef.current += 1
      setSubmitPhase({
        type: 'confirm-error',
        message: 'Seus exames foram enviados, mas houve um erro ao iniciar a analise. Tente novamente.',
        retryCount: confirmRetryCountRef.current,
      })
      setIsSubmitting(false)
      return
    }

    router.push(`/consultas/${id}`)
  }

  const handleRetryFailed = useCallback(() => {
    const conId = consultationIdRef.current
    if (!conId) return

    if (submitPhase?.type === 'confirm-error') {
      setIsSubmitting(true)
      confirmUpload(conId)
      return
    }

    // Retry failed file uploads
    setIsSubmitting(true)
    setSubmitPhase({ type: 'uploading' })
    const progress = [...fileProgress]
    progress.forEach((p) => {
      if (p.status === 'error') p.status = 'pending'
    })
    setFileProgress(progress)
    uploadFiles(files, uploadUrlsRef.current, progress, conId)
  }, [submitPhase, fileProgress, files])

  const handleBackToForm = useCallback(() => {
    setSubmitPhase(null)
    setIsSubmitting(false)
    setFileProgress([])
    consultationIdRef.current = null
    uploadUrlsRef.current = []
    confirmRetryCountRef.current = 0
    setError(null)
  }, [])

  return (
    <div className="max-w-2xl pb-36 lg:pb-0">
      <FormStepper
        steps={stepperSteps}
        completionState={completionState}
        isSending={isSubmitting}
      />

      <div
        className={cn(
          'space-y-0',
          isSubmitting && 'opacity-50 pointer-events-none'
        )}
      >
        <section ref={sectionRefs[0]} className="py-6">
          <h2 className="font-heading text-lg font-semibold mb-1">
            Envie seus exames
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Selecione os arquivos PDF dos seus exames.
          </p>
          <PdfDropzone files={files} onChange={setFiles} />
        </section>

        <div className="border-t border-border" />

        <section ref={sectionRefs[1]} className="py-6">
          <h2 className="font-heading text-lg font-semibold mb-1">
            Conte sobre seu caso
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Opcional. Compartilhe contexto que possa ajudar na analise.
          </p>
          <PatientContextInput value={patientContext} onChange={setPatientContext} />
        </section>

        <div className="border-t border-border" />

        <section ref={sectionRefs[2]} className="py-6">
          <h2 className="font-heading text-lg font-semibold mb-1">
            Escolha o especialista
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Selecione o tipo de especialista para analisar seus exames.
          </p>
          <SpecialistPicker
            specialists={specialists}
            selectedId={selectedSpecialistId}
            onSelect={setSelectedSpecialistId}
          />
        </section>
      </div>

      {submitPhase && (
        <div className="mt-6">
          <FileUploadProgress
            files={fileProgress}
            phase={submitPhase}
            onRetryFailed={handleRetryFailed}
            onBackToForm={handleBackToForm}
          />
        </div>
      )}

      {error && !submitPhase && (
        <p className="text-sm text-destructive mt-4">{error}</p>
      )}

      {!submitPhase && (
        <div className="mt-6 lg:block fixed bottom-16 inset-x-0 p-4 bg-surface border-t border-border z-30 lg:static lg:p-0 lg:border-0 lg:bg-transparent">
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full"
          >
            {isSubmitting ? 'Enviando...' : 'Solicitar Segunda Opiniao'}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify in browser**

Navigate to `/consultas/nova`. Verify:
- Stepper shows at top with 3 steps
- Steps complete as you add files and select specialist
- Sections have proper titles and dividers
- Submit button is fixed at bottom on mobile
- Upload progress appears when submitting

- [ ] **Step 4: Commit**

```bash
git add components/consultation/consultation-form.tsx app/(protected)/consultas/nova/page.tsx
git commit -m "feat: integrate FormStepper, FileUploadProgress, and mobile submit into form"
```

---

## Task 13: Redesign ConsultationStatusLive with ProcessingCard and Pending State

**Files:**
- Modify: `components/consultation/consultation-status-live.tsx` (full rewrite, current: 150 lines)

- [ ] **Step 1: Rewrite ConsultationStatusLive**

Replace the entire contents of `components/consultation/consultation-status-live.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { FileText, Clock } from 'lucide-react'
import {
  HeartPulse, Ribbon, Brain, Bone, ScanFace, Stethoscope, type LucideIcon,
} from 'lucide-react'
import { ConsultationResult } from './consultation-result'
import { ConsultationFailed } from './consultation-failed'
import { ProcessingCard } from './processing-card'
import { StatusBadge } from '@/components/ui/status-badge'
import type { ConsultationResult as Result } from '@/lib/schemas/consultation-result'

const iconMap: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  ribbon: Ribbon,
  brain: Brain,
  bone: Bone,
  'scan-face': ScanFace,
  stethoscope: Stethoscope,
}

type ConsultationFile = { id: string; file_name: string; file_size: number }

export type ConsultationRow = {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result: Result | null
  failure_reason: string | null
  patient_context: string | null
  created_at: string
  specialist: { name: string; icon: string } | { name: string; icon: string }[]
  files: ConsultationFile[]
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ConsultationStatusLive({ initial }: { initial: ConsultationRow }) {
  const [consultation, setConsultation] = useState(initial)
  const [showResult, setShowResult] = useState(initial.status === 'completed')
  const [fadeOut, setFadeOut] = useState(false)

  useEffect(() => {
    if (initial.status === 'completed' || initial.status === 'failed') return

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const channel = supabase
      .channel(`consultation-${initial.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'consultations',
          filter: `id=eq.${initial.id}`,
        },
        (payload) => {
          const next = payload.new as Partial<ConsultationRow>
          setConsultation((prev) => ({ ...prev, ...next }))

          if (next.status === 'completed') {
            // Fade out processing card, then show result
            setFadeOut(true)
            setTimeout(() => setShowResult(true), 500) // 300ms fade + 200ms pause
            supabase.removeChannel(channel)
          }
          if (next.status === 'failed') {
            setFadeOut(true)
            supabase.removeChannel(channel)
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initial.id, initial.status])

  const specialist = Array.isArray(consultation.specialist)
    ? consultation.specialist[0]
    : consultation.specialist
  const Icon = iconMap[specialist?.icon ?? ''] ?? Stethoscope
  const date = new Date(consultation.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-heading text-2xl font-bold">
            Consulta com {specialist?.name}
          </h1>
          <StatusBadge status={consultation.status} />
        </div>
        <p className="text-sm text-muted-foreground">{date}</p>
      </div>

      {/* Specialist */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Especialista</h2>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <span className="font-heading font-semibold">{specialist?.name}</span>
        </div>
      </section>

      {/* Files */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">
          Arquivos enviados ({consultation.files.length})
        </h2>
        <ul className="space-y-2">
          {consultation.files.map((file) => (
            <li key={file.id} className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm truncate min-w-0">{file.file_name}</span>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatFileSize(file.file_size)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Patient context */}
      {consultation.patient_context && (
        <section className="rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-2">Contexto compartilhado</h2>
          <p className="text-sm whitespace-pre-wrap">{consultation.patient_context}</p>
        </section>
      )}

      {/* Status-dependent content */}
      {consultation.status === 'pending' && (
        <div className="bg-muted/30 border border-border rounded-lg p-8 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-heading text-lg font-semibold text-muted-foreground">
            Aguardando envio dos exames...
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            O upload dos seus exames ainda nao foi concluido.
          </p>
        </div>
      )}

      {consultation.status === 'processing' && !fadeOut && (
        <ProcessingCard />
      )}

      {consultation.status === 'processing' && fadeOut && !showResult && (
        <div className="transition-opacity duration-300 opacity-0">
          <ProcessingCard />
        </div>
      )}

      {/* Accessible announcement for status changes */}
      <div className="sr-only" aria-live="assertive">
        {consultation.status === 'completed' && 'Resultado da consulta disponivel'}
        {consultation.status === 'failed' && 'Erro na analise da consulta'}
      </div>

      {showResult && consultation.result && (
        <ConsultationResult result={consultation.result} />
      )}

      {consultation.status === 'failed' && (
        <div
          className={fadeOut ? 'animate-fade-in-up' : ''}
        >
          <ConsultationFailed
            consultationId={consultation.id}
            failureReason={consultation.failure_reason}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify in browser**

Navigate to an existing consultation at `/consultas/[id]`. Verify:
- Header shows "Consulta com [Specialist]" with StatusBadge
- Specialist section has circular icon
- Files section matches design system
- Processing state shows ProcessingCard with timed steps

- [ ] **Step 3: Commit**

```bash
git add components/consultation/consultation-status-live.tsx
git commit -m "feat: redesign consultation detail with ProcessingCard, pending state, and transitions"
```

---

## Task 14: Add Stagger Animation to ConsultationResult

**Files:**
- Modify: `components/consultation/consultation-result.tsx` (current: 99 lines)

- [ ] **Step 1: Wrap result sections in AnimatedSection**

Replace the entire contents of `components/consultation/consultation-result.tsx`:

```tsx
import type { ConsultationResult as Result } from '@/lib/schemas/consultation-result'
import { AnimatedSection } from './animated-section'

const severityStyle: Record<Result['findings'][number]['severity'], string> = {
  info: 'bg-muted/50 text-muted-foreground',
  attention: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-destructive/10 text-destructive',
}

const severityLabel: Record<Result['findings'][number]['severity'], string> = {
  info: 'Informativo',
  attention: 'Atencao',
  urgent: 'Urgente',
}

const confidenceStyle: Record<Result['confidence'], string> = {
  low: 'bg-muted/50 text-muted-foreground',
  medium: 'bg-primary/10 text-primary',
  high: 'bg-success/10 text-success',
}

const confidenceLabel: Record<Result['confidence'], string> = {
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
}

export function ConsultationResult({ result }: { result: Result }) {
  let sectionIndex = 0

  return (
    <div className="space-y-6">
      <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Resumo</h2>
        <p className="whitespace-pre-wrap text-sm">{result.summary}</p>
      </AnimatedSection>

      {result.findings.length > 0 && (
        <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Achados</h2>
          <ul className="space-y-3">
            {result.findings.map((f, i) => (
              <li key={i} className="rounded-lg border border-border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{f.title}</p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${severityStyle[f.severity]}`}
                  >
                    {severityLabel[f.severity]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{f.detail}</p>
              </li>
            ))}
          </ul>
        </AnimatedSection>
      )}

      <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Analise</h2>
        <p className="whitespace-pre-wrap text-sm">{result.assessment}</p>
      </AnimatedSection>

      {result.recommendations.length > 0 && (
        <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Recomendacoes</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </AnimatedSection>
      )}

      {result.questionsForDoctor.length > 0 && (
        <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Perguntas para o medico</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {result.questionsForDoctor.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </AnimatedSection>
      )}

      {result.redFlags.length > 0 && (
        <AnimatedSection index={sectionIndex++} className="animate-fade-in-up rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <h2 className="text-sm font-medium text-destructive mb-3">Sinais de alerta</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-destructive">
            {result.redFlags.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </AnimatedSection>
      )}

      <AnimatedSection index={sectionIndex++} className="animate-fade-in-up flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Confianca da analise:</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${confidenceStyle[result.confidence]}`}>
          {confidenceLabel[result.confidence]}
        </span>
      </AnimatedSection>

      <AnimatedSection index={sectionIndex++} className="animate-fade-in-up">
        <p className="text-xs text-muted-foreground">{result.disclaimer}</p>
      </AnimatedSection>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/consultation/consultation-result.tsx
git commit -m "feat: add stagger fade-in-up animation to consultation result sections"
```

---

## Task 15: Update ConsultationFailed Styling

**Files:**
- Modify: `components/consultation/consultation-failed.tsx` (current: 46 lines)

- [ ] **Step 1: Update styling to use design tokens**

Replace the entire contents of `components/consultation/consultation-failed.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { retryConsultation } from '@/actions/consultation'
import { Button } from '@/components/ui/button'

type Props = {
  consultationId: string
  failureReason: string | null
}

export function ConsultationFailed({ consultationId, failureReason }: Props) {
  const [isPending, startTransition] = useTransition()
  const [retryError, setRetryError] = useState<string | null>(null)

  const handleRetry = () => {
    setRetryError(null)
    startTransition(async () => {
      const result = await retryConsultation(consultationId)
      if ('error' in result) {
        setRetryError(result.error)
      }
    })
  }

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-heading font-medium text-destructive">
            Nao conseguimos concluir a analise
          </p>
          <p className="text-sm text-destructive/80 mt-1">
            {failureReason ?? 'Algo deu errado durante o processamento.'}
          </p>
        </div>
      </div>
      <Button onClick={handleRetry} disabled={isPending} variant="outline">
        <RefreshCcw className="h-4 w-4 mr-2" />
        {isPending ? 'Reenviando...' : 'Tentar novamente'}
      </Button>
      {retryError && <p className="text-sm text-destructive">{retryError}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/consultation/consultation-failed.tsx
git commit -m "feat: update ConsultationFailed styling to use design tokens"
```

---

## Task 16: Update Consultation Detail Page Styling

**Files:**
- Modify: `app/(protected)/consultas/[id]/page.tsx:27-35`

- [ ] **Step 1: Update back link styling**

In `app/(protected)/consultas/[id]/page.tsx`, update the back link to use design tokens:

```tsx
// Old (line 29):
<Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">

// New:
<Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
```

- [ ] **Step 2: Commit**

```bash
git add "app/(protected)/consultas/[id]/page.tsx"
git commit -m "feat: update consultation detail page to use design tokens"
```

---

## Task 17: Final Verification

- [ ] **Step 1: Full build check**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Visual verification checklist**

Open the app and verify each page:

1. **Dashboard** (`/dashboard`):
   - Desktop: collapsible sidebar with correct branding and nav
   - Mobile: sticky header + bottom nav
   - Cards in 2-col grid with hover effects
   - StatusBadge with icons and animations
   - Empty state matches design

2. **Nova Consulta** (`/consultas/nova`):
   - Stepper at top tracks scroll position
   - Steps complete when files added / specialist selected
   - Sections have `font-heading` titles and dividers
   - Mobile: submit button fixed above bottom nav
   - Upload shows FileUploadProgress with per-file bars
   - beforeunload fires during upload

3. **Consulta Detail** (`/consultas/[id]`):
   - Pending state shows clock card
   - Processing shows ProcessingCard with timed steps
   - Completed: result sections fade in with stagger
   - Failed: error card with retry button
   - All sections use design tokens (no `gray-*` classes)

- [ ] **Step 3: Commit any final fixes**

```bash
git add -A
git commit -m "fix: final adjustments from visual verification"
```
