# Cost Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Capture real Anthropic API cost (USD) per completed consultation, persist as a frozen snapshot on `consultations`, and surface it in the admin consultation detail and admin dashboard aggregations.

**Architecture:** `runSpecialist` reads `usage` from `agent.generate()`, calls a pure `calculateCostUsd` helper, and propagates `{ usage, costUsd }` to `persistResult`, which writes them in the same `update` that sets `status='completed'`. Admin UI: a new `<ConsultationCostCard>` rendered conditionally on `/consultas/[id]` for admins; the existing "Custos" placeholder section in `/admin/dashboard` is wired to real data via a new `get_dashboard_costs()` Postgres RPC.

**Tech Stack:** Next.js 16 (App Router), Supabase (Postgres + RLS), Mastra workflows, `@ai-sdk/anthropic`, Jest.

**Spec:** `docs/superpowers/specs/2026-04-28-cost-tracking-design.md`

---

## File Map

**Create:**
- `supabase/migrations/20260428100000_consultation_cost_tracking.sql` — DB schema (cols + view replace + RPC)
- `lib/pricing.ts` — pure `MODEL_PRICING` table + `calculateCostUsd` + `formatCostUsd`
- `__tests__/lib/pricing.test.ts` — unit tests
- `components/admin/consultation-cost-card.tsx` — UI card for admin detail view
- `__tests__/components/admin/consultation-cost-card.test.tsx` — RTL test
- `components/admin/cost-breakdown-card.tsx` — UI list of cost-per-specialist
- `__tests__/components/admin/cost-breakdown-card.test.tsx` — RTL test
- `__tests__/mastra/workflows/steps/persist-result.test.ts` — unit tests for the modified step

**Modify:**
- `mastra/src/mastra/workflows/steps/run-specialist.ts` — capture `usage`, call `calculateCostUsd`, propagate
- `__tests__/mastra/workflows/steps/run-specialist.test.ts` — assert new output shape
- `mastra/src/mastra/workflows/steps/persist-result.ts` — accept new fields, write all in single `update`
- `components/admin/metric-card.tsx` — add optional `formattedValue` prop
- `app/(protected)/consultas/[id]/page.tsx` — detect `isAdmin`, expand select, render `<ConsultationCostCard>`
- `lib/admin/dashboard-stats.ts` — extend `DashboardStats` type, call RPC, surface `costBySpecialist`
- `__tests__/admin/dashboard-stats.integration.test.ts` — seed cost values, assert cost aggregates
- `app/(protected)/admin/dashboard/page.tsx` — replace "Em breve" placeholders with real cost data

---

## Task 1: DB migration — columns, view, RPC

**Files:**
- Create: `supabase/migrations/20260428100000_consultation_cost_tracking.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Add cost-tracking columns to consultations.
-- All nullable: NULL means "not measured" (pending/processing/failed
-- consultations, and any historical row from before this migration).
-- A value of 0 would mean "ran and cost zero" — semantically different.
alter table public.consultations
  add column input_tokens  integer,
  add column output_tokens integer,
  add column cost_usd      numeric(10, 6);

-- Replace the existing breakdown view to also expose cost per specialist.
-- `count` keeps existing semantics (all consultations of any status, used by
-- the consultations-per-specialist card). `measured_count` and `cost_usd` are
-- restricted to completed consultations with a recorded cost — paired metrics
-- for the cost-per-specialist card.
drop view if exists public.consultation_counts_by_specialist;

create view public.consultation_counts_by_specialist
  with (security_invoker = true) as
  select
    s.id,
    s.name,
    s.icon,
    count(c.id)::bigint as count,
    coalesce(count(c.id) filter (where c.status = 'completed' and c.cost_usd is not null), 0)::bigint as measured_count,
    coalesce(sum(c.cost_usd) filter (where c.status = 'completed' and c.cost_usd is not null), 0)::numeric(12, 6) as cost_usd
  from public.specialists s
  left join public.consultations c on c.specialist_id = s.id
  group by s.id, s.name, s.icon;

-- Aggregate dashboard cost metrics in a single round-trip.
-- security_invoker via SECURITY INVOKER + RLS on consultations: callers
-- without admin role see zeros (RLS filters out other users' rows).
create or replace function public.get_dashboard_costs()
returns json
language sql
security invoker
set search_path = ''
stable
as $$
  with measured as (
    select cost_usd, created_at
    from public.consultations
    where status = 'completed' and cost_usd is not null
  )
  select json_build_object(
    'totalCostUsd',         coalesce(sum(cost_usd), 0),
    'costToday',            coalesce(sum(cost_usd) filter (where created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo')), 0),
    'cost7d',               coalesce(sum(cost_usd) filter (where created_at >= now() - interval '7 days'), 0),
    'cost30d',              coalesce(sum(cost_usd) filter (where created_at >= now() - interval '30 days'), 0),
    'measuredCount',        count(*),
    'costMeasurementSince', min(created_at)
  )
  from measured;
$$;
```

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase db reset` (in `/Users/iduarte/segunda-opiniao`)
Expected: migrations replay cleanly, no errors, `consultations` recreated with new columns.

- [ ] **Step 3: Verify schema with psql**

Run: `npx supabase db dump --local --schema public --data-only=false | grep -E '(input_tokens|output_tokens|cost_usd|get_dashboard_costs)'`
Expected: prints lines containing the three new columns and the function definition.

- [ ] **Step 4: Verify RPC returns correct shape on empty DB**

Run:
```bash
npx supabase db reset
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "select public.get_dashboard_costs();"
```
Expected output JSON contains:
```
{"totalCostUsd":0,"costToday":0,"cost7d":0,"cost30d":0,"measuredCount":0,"costMeasurementSince":null}
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260428100000_consultation_cost_tracking.sql
git commit -m "feat(db): add cost tracking columns, view, and RPC"
```

---

## Task 2: Pricing module — pure helpers (TDD)

**Files:**
- Create: `lib/pricing.ts`
- Test: `__tests__/lib/pricing.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/pricing.test.ts`:

```ts
import { calculateCostUsd, formatCostUsd, MODEL_PRICING } from '@/lib/pricing'

describe('MODEL_PRICING', () => {
  it('contains claude-sonnet-4-6 with non-zero rates', () => {
    expect(MODEL_PRICING['claude-sonnet-4-6']).toEqual({
      inputPerMTok: 3.0,
      outputPerMTok: 15.0,
    })
  })
})

describe('calculateCostUsd', () => {
  it('costs 18 USD for 1M input + 1M output on sonnet-4-6', () => {
    const cost = calculateCostUsd('claude-sonnet-4-6', {
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
    })
    expect(cost).toBe(18)
  })

  it('returns 0 when both token counts are 0', () => {
    expect(calculateCostUsd('claude-sonnet-4-6', { inputTokens: 0, outputTokens: 0 })).toBe(0)
  })

  it('rounds to 6 decimals', () => {
    // 1 input + 1 output = 3/1e6 + 15/1e6 = 0.000018 — exactly representable
    const cost = calculateCostUsd('claude-sonnet-4-6', { inputTokens: 1, outputTokens: 1 })
    expect(cost).toBe(0.000018)
  })

  it('throws on unknown model', () => {
    expect(() =>
      calculateCostUsd('unknown-model-x', { inputTokens: 1, outputTokens: 1 }),
    ).toThrow('Pricing not configured for model: unknown-model-x')
  })
})

describe('formatCostUsd', () => {
  it('formats with $ prefix and 4 decimals', () => {
    expect(formatCostUsd(0.0123456)).toBe('$0.0123')
  })

  it('formats zero as $0.0000', () => {
    expect(formatCostUsd(0)).toBe('$0.0000')
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/pricing.test.ts`
Expected: FAIL with module not found error for `@/lib/pricing`.

- [ ] **Step 3: Implement the module**

Create `lib/pricing.ts`:

```ts
export type ModelPricing = {
  inputPerMTok: number  // USD per 1M input tokens
  outputPerMTok: number // USD per 1M output tokens
}

// Source: anthropic.com/pricing (snapshot 2026-04-28).
// Update this table when Anthropic publishes new pricing; cost snapshots
// already stored on consultations remain unchanged.
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-6': { inputPerMTok: 3.0, outputPerMTok: 15.0 },
}

export type Usage = {
  inputTokens: number
  outputTokens: number
}

export function calculateCostUsd(model: string, usage: Usage): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) {
    throw new Error(`Pricing not configured for model: ${model}`)
  }
  const cost =
    (usage.inputTokens / 1_000_000) * pricing.inputPerMTok +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMTok
  return Math.round(cost * 1_000_000) / 1_000_000
}

export function formatCostUsd(cost: number): string {
  return `$${cost.toFixed(4)}`
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/pricing.test.ts`
Expected: all 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/pricing.ts __tests__/lib/pricing.test.ts
git commit -m "feat(pricing): add model pricing table and cost helpers"
```

---

## Task 3: `runSpecialist` — capture usage and compute cost (TDD)

**Files:**
- Modify: `mastra/src/mastra/workflows/steps/run-specialist.ts`
- Modify: `__tests__/mastra/workflows/steps/run-specialist.test.ts`

- [ ] **Step 1: Update the existing tests to expect the new output shape**

In `__tests__/mastra/workflows/steps/run-specialist.test.ts`, replace the test named `calls agent.generate with output: consultationResultSchema and returns wrapped result` with two tests, and add two new ones at the end of the `describe` block:

```ts
  it('calls agent.generate with structuredOutput and returns wrapped result with usage and cost', async () => {
    mockGenerate.mockResolvedValue({
      object: minimalResult,
      usage: { inputTokens: 12_430, outputTokens: 1_892 },
    })

    const result = await execute(baseInput)

    const [, options] = mockGenerate.mock.calls[0]
    expect(options).toEqual({ structuredOutput: { schema: consultationResultSchema } })
    expect(result).toEqual({
      consultationId: 'consultation-1',
      result: minimalResult,
      usage: { inputTokens: 12_430, outputTokens: 1_892 },
      // 12430 * 3 / 1e6 + 1892 * 15 / 1e6 = 0.03729 + 0.02838 = 0.06567
      costUsd: 0.06567,
    })
  })

  it('falls back to promptTokens/completionTokens when only legacy field names are present', async () => {
    mockGenerate.mockResolvedValue({
      object: minimalResult,
      usage: { promptTokens: 1000, completionTokens: 500 },
    })

    const result = await execute(baseInput)

    expect(result.usage).toEqual({ inputTokens: 1000, outputTokens: 500 })
    // 1000 * 3 / 1e6 + 500 * 15 / 1e6 = 0.003 + 0.0075 = 0.0105
    expect(result.costUsd).toBe(0.0105)
  })

  it('defaults usage to zero when SDK returns no usage object', async () => {
    mockGenerate.mockResolvedValue({ object: minimalResult })

    const result = await execute(baseInput)

    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 })
    expect(result.costUsd).toBe(0)
  })
```

Then update the existing two tests that mock `mockGenerate.mockResolvedValue({ object: minimalResult })` (the message-shape and patient-context ones at lines covering "builds messages..." and "uses patient context...") to also include a `usage` field so they don't trigger the zero-default warning:

```ts
mockGenerate.mockResolvedValue({
  object: minimalResult,
  usage: { inputTokens: 100, outputTokens: 50 },
})
```

(Apply this change to all four `mockResolvedValue({ object: minimalResult })` call sites in the file — but NOT to the two tests added above which set their own usage values.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/mastra/workflows/steps/run-specialist.test.ts`
Expected: FAIL on the new assertions (`Cannot read properties of undefined (reading 'inputTokens')` or output mismatch).

- [ ] **Step 3: Update `runSpecialist` to capture usage and compute cost**

Replace the entire body of `mastra/src/mastra/workflows/steps/run-specialist.ts` with:

```ts
import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { agentsByKey } from '../../agents'
import { consultationResultSchema } from '../../schemas/consultation-result'
import { markConsultationFailed } from '../../lib/mark-failed'
import { calculateCostUsd } from '../../../../../lib/pricing'

const SPECIALIST_MODEL = 'claude-sonnet-4-6'

export const runSpecialist = createStep({
  id: 'runSpecialist',
  inputSchema: z.object({
    consultationId: z.string(),
    agentKey: z.string(),
    patientContext: z.string().nullable(),
    files: z.array(z.object({
      file_name: z.string(),
      pdfBytes: z.instanceof(Uint8Array),
    }).passthrough()),
  }),
  outputSchema: z.object({
    consultationId: z.string(),
    result: consultationResultSchema,
    usage: z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    }),
    costUsd: z.number().nonnegative(),
  }),
  execute: async ({ inputData }) => {
    try {
      const agent = agentsByKey[inputData.agentKey as keyof typeof agentsByKey]
      if (!agent) throw new Error(`Agent não encontrado: ${inputData.agentKey}`)

      const userText = inputData.patientContext
        ? `Contexto do paciente:\n${inputData.patientContext}\n\nAnalise os exames acima e gere uma segunda opinião.`
        : 'Analise os exames acima e gere uma segunda opinião.'

      const messages = [
        {
          role: 'user' as const,
          content: [
            ...inputData.files.map((f) => ({
              type: 'file' as const,
              mimeType: 'application/pdf',
              data: f.pdfBytes,
            })),
            { type: 'text' as const, text: userText },
          ],
        },
      ]

      const { object, usage } = await agent.generate(messages, {
        structuredOutput: { schema: consultationResultSchema },
      }) as { object: z.infer<typeof consultationResultSchema>; usage?: Record<string, number> }

      const tokens = {
        inputTokens:  usage?.inputTokens  ?? usage?.promptTokens     ?? 0,
        outputTokens: usage?.outputTokens ?? usage?.completionTokens ?? 0,
      }
      if (tokens.inputTokens === 0 && tokens.outputTokens === 0) {
        console.warn(`[runSpecialist] usage missing or zero for consultation=${inputData.consultationId}`)
      }
      const costUsd = calculateCostUsd(SPECIALIST_MODEL, tokens)

      return {
        consultationId: inputData.consultationId,
        result: object,
        usage: tokens,
        costUsd,
      }
    } catch (err) {
      await markConsultationFailed(inputData.consultationId, 'Não conseguimos analisar seus exames. Tente novamente.')
      throw err
    }
  },
})
```

Note on the import path `../../../../../lib/pricing`: from `mastra/src/mastra/workflows/steps/` that is `../` → `workflows/`, `../../` → `mastra/`, `../../../` → `src/`, `../../../../` → `mastra/`, `../../../../../` → repo root. The path `lib/pricing` resolves under the repo root. The Jest moduleNameMapper handles `@/`, but Mastra's own bundler resolves relative paths — keep it relative to be portable.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/mastra/workflows/steps/run-specialist.test.ts`
Expected: all tests PASS (original 5 + 3 new). The "throws and marks failed" tests should still pass because the failure path is unchanged.

- [ ] **Step 5: Commit**

```bash
git add mastra/src/mastra/workflows/steps/run-specialist.ts __tests__/mastra/workflows/steps/run-specialist.test.ts
git commit -m "feat(workflow): capture usage and compute cost in runSpecialist"
```

---

## Task 4: `persistResult` — write tokens and cost (TDD)

**Files:**
- Create: `__tests__/mastra/workflows/steps/persist-result.test.ts`
- Modify: `mastra/src/mastra/workflows/steps/persist-result.ts`

- [ ] **Step 1: Write the failing test**

Create `__tests__/mastra/workflows/steps/persist-result.test.ts`:

```ts
import { persistResult } from '@/mastra/workflows/steps/persist-result'

const mockUpdate = jest.fn()
const mockEq = jest.fn()
const mockFrom = jest.fn()

jest.mock('@/mastra/lib/supabase-admin', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}))

const mockMarkFailed = jest.fn()
jest.mock('@/mastra/lib/mark-failed', () => ({
  markConsultationFailed: (...args: unknown[]) => mockMarkFailed(...args),
}))

const minimalResult = {
  summary: 'ok',
  findings: [],
  assessment: 'ok',
  recommendations: [],
  questionsForDoctor: [],
  redFlags: [],
  confidence: 'medium' as const,
  disclaimer: 'aviso',
}

const baseInput = {
  consultationId: 'consultation-42',
  result: minimalResult,
  usage: { inputTokens: 12_430, outputTokens: 1_892 },
  costUsd: 0.06567,
}

const execute = (input: Record<string, unknown>) =>
  persistResult.execute({ inputData: input } as Parameters<typeof persistResult.execute>[0])

describe('persistResult step', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockEq.mockResolvedValue({ error: null })
    mockUpdate.mockReturnValue({ eq: mockEq })
    mockFrom.mockReturnValue({ update: mockUpdate })
  })

  it('writes result, status, tokens, and cost in a single update', async () => {
    const out = await execute(baseInput)

    expect(mockFrom).toHaveBeenCalledWith('consultations')
    expect(mockUpdate).toHaveBeenCalledWith({
      status: 'completed',
      result: minimalResult,
      input_tokens: 12_430,
      output_tokens: 1_892,
      cost_usd: 0.06567,
    })
    expect(mockEq).toHaveBeenCalledWith('id', 'consultation-42')
    expect(out).toEqual({ status: 'completed' })
  })

  it('marks failed and rethrows when supabase returns an error', async () => {
    mockEq.mockResolvedValue({ error: new Error('db down') })

    await expect(execute(baseInput)).rejects.toThrow('db down')
    expect(mockMarkFailed).toHaveBeenCalledWith(
      'consultation-42',
      'Falha ao salvar o resultado.',
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/mastra/workflows/steps/persist-result.test.ts`
Expected: FAIL — current `persistResult` doesn't accept `usage`/`costUsd`, won't include `input_tokens`/`output_tokens`/`cost_usd` in the update payload.

- [ ] **Step 3: Update `persistResult` to accept and write the new fields**

Replace the entire body of `mastra/src/mastra/workflows/steps/persist-result.ts` with:

```ts
import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { consultationResultSchema } from '../../schemas/consultation-result'
import { markConsultationFailed } from '../../lib/mark-failed'

export const persistResult = createStep({
  id: 'persistResult',
  inputSchema: z.object({
    consultationId: z.string(),
    result: consultationResultSchema,
    usage: z.object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    }),
    costUsd: z.number().nonnegative(),
  }),
  outputSchema: z.object({ status: z.enum(['completed', 'failed']) }),
  execute: async ({ inputData }) => {
    try {
      const { error } = await supabaseAdmin
        .from('consultations')
        .update({
          status: 'completed',
          result: inputData.result,
          input_tokens: inputData.usage.inputTokens,
          output_tokens: inputData.usage.outputTokens,
          cost_usd: inputData.costUsd,
        })
        .eq('id', inputData.consultationId)
      if (error) throw error
      return { status: 'completed' as const }
    } catch (err) {
      await markConsultationFailed(inputData.consultationId, 'Falha ao salvar o resultado.')
      throw err
    }
  },
})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/mastra/workflows/steps/persist-result.test.ts`
Expected: both tests PASS.

- [ ] **Step 5: Run the full Mastra test suite to confirm no regressions in workflow tests**

Run: `npx jest __tests__/mastra/`
Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add mastra/src/mastra/workflows/steps/persist-result.ts __tests__/mastra/workflows/steps/persist-result.test.ts
git commit -m "feat(workflow): persist tokens and cost on completed consultation"
```

---

## Task 5: `<ConsultationCostCard>` component (TDD)

**Files:**
- Create: `components/admin/consultation-cost-card.tsx`
- Test: `__tests__/components/admin/consultation-cost-card.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/admin/consultation-cost-card.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { ConsultationCostCard } from '@/components/admin/consultation-cost-card'

describe('ConsultationCostCard', () => {
  it('renders formatted cost and tokens when costUsd is provided', () => {
    render(
      <ConsultationCostCard
        costUsd={0.0432}
        inputTokens={12_430}
        outputTokens={1_892}
      />,
    )

    expect(screen.getByText('Custo da consulta')).toBeInTheDocument()
    expect(screen.getByText('$0.0432')).toBeInTheDocument()
    expect(screen.getByText(/12\.430/)).toBeInTheDocument()
    expect(screen.getByText(/1\.892/)).toBeInTheDocument()
    expect(screen.getByText(/input/)).toBeInTheDocument()
    expect(screen.getByText(/output/)).toBeInTheDocument()
  })

  it('renders "Custo não medido" when costUsd is null', () => {
    render(<ConsultationCostCard costUsd={null} inputTokens={null} outputTokens={null} />)

    expect(screen.getByText('Custo da consulta')).toBeInTheDocument()
    expect(screen.getByText('Custo não medido')).toBeInTheDocument()
    expect(screen.queryByText(/\$/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/admin/consultation-cost-card.test.tsx`
Expected: FAIL with module not found for `@/components/admin/consultation-cost-card`.

- [ ] **Step 3: Implement the component**

Create `components/admin/consultation-cost-card.tsx`:

```tsx
import { formatCostUsd } from '@/lib/pricing'

type Props = {
  costUsd: number | null
  inputTokens: number | null
  outputTokens: number | null
}

export function ConsultationCostCard({ costUsd, inputTokens, outputTokens }: Props) {
  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <h2 className="text-sm font-medium text-muted-foreground mb-2">
        Custo da consulta
      </h2>
      {costUsd == null ? (
        <p className="text-sm text-muted-foreground italic">Custo não medido</p>
      ) : (
        <div>
          <p className="font-heading text-2xl font-bold">{formatCostUsd(costUsd)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {(inputTokens ?? 0).toLocaleString('pt-BR')} input
            {' · '}
            {(outputTokens ?? 0).toLocaleString('pt-BR')} output tokens
          </p>
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/components/admin/consultation-cost-card.test.tsx`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/consultation-cost-card.tsx __tests__/components/admin/consultation-cost-card.test.tsx
git commit -m "feat(admin): add ConsultationCostCard component"
```

---

## Task 6: Page `/consultas/[id]` — render cost card for admins

**Files:**
- Modify: `app/(protected)/consultas/[id]/page.tsx`

This page is a Server Component. We detect `isAdmin` server-side, expand the select to include the cost columns, and render `<ConsultationCostCard>` above `<ConsultationStatusLive>`. The cost card is intentionally NOT inside `ConsultationStatusLive` (no live updates needed — cost is set once, when status flips to completed; if an admin opens a consultation mid-run, a refresh after completion shows the cost).

- [ ] **Step 1: Replace the entire page file**

Replace `app/(protected)/consultas/[id]/page.tsx` with:

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ConsultationStatusLive } from '@/components/consultation/consultation-status-live'
import { ConsultationCostCard } from '@/components/admin/consultation-cost-card'

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.role === 'admin'
  }

  // RLS handles authorization: owner sees own consultations via existing policy;
  // admin sees any consultation via "Admins can read all consultations" policy.
  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status, result, failure_reason, patient_context, created_at, input_tokens, output_tokens, cost_usd, specialist:specialists(name, icon)')
    .eq('id', id)
    .single()
  if (!consultation) notFound()

  const { data: files } = await supabase
    .from('consultation_files')
    .select('id, file_name, file_size')
    .eq('consultation_id', id)

  return (
    <div>
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      {isAdmin && (
        <div className="max-w-2xl mb-6">
          <ConsultationCostCard
            costUsd={consultation.cost_usd}
            inputTokens={consultation.input_tokens}
            outputTokens={consultation.output_tokens}
          />
        </div>
      )}

      <ConsultationStatusLive
        initial={{
          id: consultation.id,
          status: consultation.status,
          result: consultation.result,
          failure_reason: consultation.failure_reason,
          patient_context: consultation.patient_context,
          created_at: consultation.created_at,
          specialist: consultation.specialist,
          files: files ?? [],
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Type-check the change**

Run: `npx tsc --noEmit`
Expected: no errors. (If TS complains about extra fields on the `select` returning a wider type, that's expected — the spread into `initial` filters down to the shape `ConsultationStatusLive` expects.)

- [ ] **Step 3: Smoke-test in dev mode**

Run: `npm run dev` (in another terminal)
Then visit a completed consultation as an admin user.
Expected: cost card appears above the status section, showing "$X.XXXX" + tokens.
Visit as a non-admin user — cost card does NOT appear, page renders identically to before.
Stop the dev server when done (`Ctrl+C`).

- [ ] **Step 4: Commit**

```bash
git add app/(protected)/consultas/[id]/page.tsx
git commit -m "feat(consultations): show cost card on detail page for admins"
```

---

## Task 7: Extend `<MetricCard>` with `formattedValue` prop

**Files:**
- Modify: `components/admin/metric-card.tsx`

We add an optional `formattedValue?: string` that, when set, overrides the default pt-BR number formatting. This lets the dashboard show `$1.2345` for cost cards without touching count cards.

- [ ] **Step 1: Update the component**

Replace `components/admin/metric-card.tsx` with:

```tsx
import { cn } from '@/lib/cn'

type Props = {
  label: string
  value?: number
  formattedValue?: string
  placeholder?: boolean
  className?: string
}

export function MetricCard({ label, value, formattedValue, placeholder, className }: Props) {
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
        {placeholder ? '—' : (formattedValue ?? (value ?? 0).toLocaleString('pt-BR'))}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Type-check and run UI tests**

Run: `npx tsc --noEmit && npx jest __tests__/components`
Expected: no TS errors; all UI tests pass (the change is additive — no existing usage breaks).

- [ ] **Step 3: Commit**

```bash
git add components/admin/metric-card.tsx
git commit -m "feat(admin): support pre-formatted values in MetricCard"
```

---

## Task 8: `<CostBreakdownCard>` component (TDD)

A new component dedicated to "cost per specialist" rows. We do NOT generalize `BreakdownCard` because counts and costs format differently (pt-BR integers vs `$X.XXXX`), and the existing component stays focused on its single responsibility.

**Files:**
- Create: `components/admin/cost-breakdown-card.tsx`
- Test: `__tests__/components/admin/cost-breakdown-card.test.tsx`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/components/admin/cost-breakdown-card.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { CostBreakdownCard } from '@/components/admin/cost-breakdown-card'

describe('CostBreakdownCard', () => {
  it('renders specialist rows with count and formatted cost', () => {
    render(
      <CostBreakdownCard
        label="Por especialista"
        items={[
          { id: 'a', name: 'Cardiologista', icon: 'heart-pulse', count: 12, costUsd: 1.2345 },
          { id: 'b', name: 'Oncologista',   icon: 'ribbon',      count: 5,  costUsd: 0.5 },
        ]}
      />,
    )

    expect(screen.getByText('Por especialista')).toBeInTheDocument()
    expect(screen.getByText('Cardiologista')).toBeInTheDocument()
    expect(screen.getByText('Oncologista')).toBeInTheDocument()
    expect(screen.getByText(/12 consultas/)).toBeInTheDocument()
    expect(screen.getByText('$1.2345')).toBeInTheDocument()
    expect(screen.getByText(/5 consultas/)).toBeInTheDocument()
    expect(screen.getByText('$0.5000')).toBeInTheDocument()
  })

  it('renders empty state when items is empty', () => {
    render(<CostBreakdownCard label="Por especialista" items={[]} />)

    expect(screen.getByText('Sem dados')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest __tests__/components/admin/cost-breakdown-card.test.tsx`
Expected: FAIL with module not found.

- [ ] **Step 3: Implement the component**

Create `components/admin/cost-breakdown-card.tsx`:

```tsx
import { cn } from '@/lib/cn'
import { getSpecialistIcon } from '@/lib/specialist-icons'
import { formatCostUsd } from '@/lib/pricing'

// Row shape declared inline (structural typing). The `CostBySpecialist` type
// in `lib/admin/dashboard-stats.ts` matches this shape, so consumers can pass
// `stats.costBySpecialist` directly.
type Item = {
  id: string
  name: string
  icon: string
  count: number
  costUsd: number
}

type Props = {
  label: string
  items: Item[]
  className?: string
}

export function CostBreakdownCard({ label, items, className }: Props) {
  return (
    <div className={cn('relative bg-surface border border-border rounded-lg p-5', className)}>
      <p className="text-sm text-muted-foreground mb-4">{label}</p>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Sem dados</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const Icon = getSpecialistIcon(item.icon)
            return (
              <li key={item.id} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground">
                    · {item.count.toLocaleString('pt-BR')} consultas
                  </span>
                </span>
                <span className="font-heading font-semibold">
                  {formatCostUsd(item.costUsd)}
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/components/admin/cost-breakdown-card.test.tsx`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/admin/cost-breakdown-card.tsx __tests__/components/admin/cost-breakdown-card.test.tsx
git commit -m "feat(admin): add CostBreakdownCard component"
```

---

## Task 9: Extend `getDashboardStats` with cost aggregates

**Files:**
- Modify: `lib/admin/dashboard-stats.ts`

- [ ] **Step 1: Update the file**

Replace `lib/admin/dashboard-stats.ts` with:

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { getDateBoundaries } from '@/lib/admin/date-boundaries'

export type SpecialistBreakdown = {
  id: string
  name: string
  icon: string
  count: number
}

export type CostBySpecialist = {
  id: string
  name: string
  icon: string
  count: number
  costUsd: number
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
  totalCostUsd: number
  costToday: number
  cost7d: number
  cost30d: number
  avgCostPerConsultation: number
  costBySpecialist: CostBySpecialist[]
  costMeasurementSince: string | null
}

type DashboardCostsRpc = {
  totalCostUsd: number
  costToday: number
  cost7d: number
  cost30d: number
  measuredCount: number
  costMeasurementSince: string | null
}

const safeCount = (label: string, res: { count: number | null; error: unknown }) => {
  if (res.error) console.error(`[admin-dashboard] ${label}`, res.error)
  return res.count ?? 0
}

const EMPTY_COSTS: DashboardCostsRpc = {
  totalCostUsd: 0,
  costToday: 0,
  cost7d: 0,
  cost30d: 0,
  measuredCount: 0,
  costMeasurementSince: null,
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
    costsRes,
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
      .select('id, name, icon, count, measured_count, cost_usd')
      .order('count', { ascending: false }),
    supabase.rpc('get_dashboard_costs'),
  ])

  const breakdownRows = bySpecialistRes.error
    ? (console.error('[admin-dashboard] bySpecialist', bySpecialistRes.error), [])
    : (bySpecialistRes.data ?? [])

  const consultationsBySpecialist: SpecialistBreakdown[] = breakdownRows.map((r) => ({
    id: r.id, name: r.name, icon: r.icon, count: r.count,
  }))

  const costBySpecialist: CostBySpecialist[] = breakdownRows
    .map((r) => ({
      id: r.id, name: r.name, icon: r.icon, count: r.measured_count, costUsd: Number(r.cost_usd ?? 0),
    }))
    .filter((r) => r.costUsd > 0)
    .sort((a, b) => b.costUsd - a.costUsd)

  const costsRaw: DashboardCostsRpc = costsRes.error
    ? (console.error('[admin-dashboard] costs', costsRes.error), EMPTY_COSTS)
    : { ...EMPTY_COSTS, ...(costsRes.data as Partial<DashboardCostsRpc>) }

  const costs: DashboardCostsRpc = {
    totalCostUsd: Number(costsRaw.totalCostUsd ?? 0),
    costToday: Number(costsRaw.costToday ?? 0),
    cost7d: Number(costsRaw.cost7d ?? 0),
    cost30d: Number(costsRaw.cost30d ?? 0),
    measuredCount: Number(costsRaw.measuredCount ?? 0),
    costMeasurementSince: costsRaw.costMeasurementSince ?? null,
  }
  const avgCostPerConsultation = costs.measuredCount > 0
    ? costs.totalCostUsd / costs.measuredCount
    : 0

  return {
    totalUsers: safeCount('totalUsers', totalUsersRes),
    newUsers7d: safeCount('newUsers7d', newUsers7dRes),
    newUsers30d: safeCount('newUsers30d', newUsers30dRes),
    totalConsultations: safeCount('totalConsultations', totalConsultationsRes),
    consultationsToday: safeCount('consultationsToday', consultationsTodayRes),
    consultations7d: safeCount('consultations7d', consultations7dRes),
    consultations30d: safeCount('consultations30d', consultations30dRes),
    consultationsBySpecialist,
    totalCostUsd: costs.totalCostUsd,
    costToday: costs.costToday,
    cost7d: costs.cost7d,
    cost30d: costs.cost30d,
    avgCostPerConsultation,
    costBySpecialist,
    costMeasurementSince: costs.costMeasurementSince,
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/admin/dashboard-stats.ts
git commit -m "feat(admin): aggregate cost metrics in getDashboardStats"
```

---

## Task 10: Extend the integration test for cost aggregates

**Files:**
- Modify: `__tests__/admin/dashboard-stats.integration.test.ts`

- [ ] **Step 1: Update the seed and add cost assertions**

In `__tests__/admin/dashboard-stats.integration.test.ts`:

Replace the seed insert (the `await admin.from('consultations').insert([...])` block in `beforeAll`) with:

```ts
    await admin.from('consultations').insert([
      { user_id: patient1Id, specialist_id: cardiologyId, status: 'completed', created_at: today,         input_tokens: 1000, output_tokens: 500, cost_usd: 0.0105 },
      { user_id: patient1Id, specialist_id: cardiologyId, status: 'completed', created_at: fiveDaysAgo,   input_tokens: 2000, output_tokens: 800, cost_usd: 0.0180 },
      { user_id: patient2Id, specialist_id: cardiologyId, status: 'pending',   created_at: twentyDaysAgo },
      { user_id: patient2Id, specialist_id: oncologyId,   status: 'completed', created_at: twentyDaysAgo, input_tokens: 3000, output_tokens: 1200, cost_usd: 0.0270 },
      { user_id: patient1Id, specialist_id: oncologyId,   status: 'failed',    created_at: fortyDaysAgo },
    ])
```

Then add a new test case at the end of the `describe` block:

```ts
  it('returns correct cost aggregates when called by an admin', async () => {
    const client = await authClient(adminEmail, password)
    const stats = await getDashboardStats(client)

    // Three measured consultations seeded by us: 0.0105 + 0.0180 + 0.0270 = 0.0555
    expect(stats.totalCostUsd).toBeGreaterThanOrEqual(0.0555)
    expect(stats.costToday).toBeGreaterThanOrEqual(0.0105)
    expect(stats.cost7d).toBeGreaterThanOrEqual(0.0105 + 0.0180)
    expect(stats.cost30d).toBeGreaterThanOrEqual(0.0555)

    // avg = total / measuredCount; with our 3 measured, avg ≥ ~0.0185
    expect(stats.avgCostPerConsultation).toBeGreaterThan(0)
    expect(stats.costMeasurementSince).not.toBeNull()

    const cardio = stats.costBySpecialist.find((s) => s.id === cardiologyId)
    const onco = stats.costBySpecialist.find((s) => s.id === oncologyId)
    expect(cardio?.costUsd).toBeGreaterThanOrEqual(0.0285) // 0.0105 + 0.0180
    expect(onco?.costUsd).toBeGreaterThanOrEqual(0.0270)
    expect(cardio?.count).toBeGreaterThanOrEqual(2)
    expect(onco?.count).toBeGreaterThanOrEqual(1)
  })

  it('returns zero cost aggregates for non-admin (RLS hides other rows)', async () => {
    const client = await authClient(patientEmail, password)
    const stats = await getDashboardStats(client)

    // patient owns 2 completed consultations with costs 0.0105 + 0.0180 = 0.0285
    expect(stats.totalCostUsd).toBeLessThanOrEqual(0.0285 + 0.0001)
  })
```

- [ ] **Step 2: Run the integration test**

Pre-req: ensure local Supabase is running (`npx supabase start`) and the migration from Task 1 is applied (`npx supabase db reset` if needed).

Run: `npm run test:integration -- __tests__/admin/dashboard-stats.integration.test.ts`
Expected: all tests PASS, including the two new ones.

- [ ] **Step 3: Commit**

```bash
git add __tests__/admin/dashboard-stats.integration.test.ts
git commit -m "test(admin): cover cost aggregates in dashboard-stats integration"
```

---

## Task 11: Wire admin dashboard "Custos" section to real data

**Files:**
- Modify: `app/(protected)/admin/dashboard/page.tsx`

The page already has a placeholder "Custos" section. Replace placeholders with real values, drop the "Top 10 por usuário" placeholder card (out of scope per spec), and add the `costMeasurementSince` footnote.

- [ ] **Step 1: Update the page**

Replace `app/(protected)/admin/dashboard/page.tsx` with:

```tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardStats } from '@/lib/admin/dashboard-stats'
import { DashboardSection } from '@/components/admin/dashboard-section'
import { MetricCard } from '@/components/admin/metric-card'
import { BreakdownCard } from '@/components/admin/breakdown-card'
import { CostBreakdownCard } from '@/components/admin/cost-breakdown-card'
import { formatCostUsd } from '@/lib/pricing'

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

  const sinceLabel = stats.costMeasurementSince
    ? new Date(stats.costMeasurementSince).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

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

      <section>
        <header className="flex items-center gap-2 mb-4">
          <h2 className="font-heading text-lg font-semibold">Custos</h2>
        </header>
        {sinceLabel === null ? (
          <p className="text-sm text-muted-foreground italic">
            Nenhuma consulta medida ainda.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <MetricCard label="Total de custo" formattedValue={formatCostUsd(stats.totalCostUsd)} />
              <MetricCard label="Hoje" formattedValue={formatCostUsd(stats.costToday)} />
              <MetricCard label="Últimos 7 dias" formattedValue={formatCostUsd(stats.cost7d)} />
              <MetricCard label="Últimos 30 dias" formattedValue={formatCostUsd(stats.cost30d)} />
              <MetricCard label="Médio por consulta" formattedValue={formatCostUsd(stats.avgCostPerConsultation)} />
              <CostBreakdownCard
                label="Por especialista"
                items={stats.costBySpecialist}
                className="md:col-span-2 lg:col-span-3"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Medindo custos desde {sinceLabel}.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Smoke-test in dev mode**

Run: `npm run dev` (in another terminal)
Visit `/admin/dashboard` as an admin user.
Expected:
  - "Custos" section no longer says "Em breve".
  - With no measured consultations: shows "Nenhuma consulta medida ainda".
  - With measured consultations: shows real numbers in `$X.XXXX` format and the "Medindo custos desde {data}" footer.

Stop the dev server (`Ctrl+C`).

- [ ] **Step 4: Commit**

```bash
git add app/(protected)/admin/dashboard/page.tsx
git commit -m "feat(admin): wire dashboard cost section to real data"
```

---

## Task 12: Final verification

- [ ] **Step 1: Run the unit test suite**

Run: `npx jest`
Expected: all tests PASS.

- [ ] **Step 2: Run the integration test suite**

Pre-req: local Supabase running.

Run: `npm run test:integration`
Expected: all integration tests PASS.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: build succeeds, no TS errors, no build warnings related to the new code.

- [ ] **Step 5: Manual end-to-end smoke (optional but recommended)**

If a Mastra dev environment is available (or a deployed staging), run a real consultation end-to-end:
  1. Submit a new consultation as a normal user.
  2. Wait for it to complete.
  3. Verify in psql: `select id, status, input_tokens, output_tokens, cost_usd from consultations order by created_at desc limit 1;` — all three new columns populated, `cost_usd > 0`.
  4. Open the consultation as an admin → see cost card.
  5. Open `/admin/dashboard` → see real costs in the Custos section.

If this isn't feasible without a live Anthropic key + Mastra env, skip this step — the unit/integration tests cover the contract.

- [ ] **Step 6: Final commit (if anything trivial fell out of the smoke test)**

If no changes: nothing to commit. If any small fix was needed (formatting, missing import), commit it standalone:

```bash
git add -p
git commit -m "fix: <specific issue from smoke test>"
```

---

## Self-Review Notes

- **Spec coverage check:** Migration (spec §4) → Task 1. Pricing module (spec §5) → Task 2. Workflow changes (spec §6) → Tasks 3 + 4. Admin detail (spec §7) → Tasks 5 + 6. Admin dashboard aggregations (spec §8) → Tasks 7, 8, 9, 11. Edge cases (spec §9) → covered by tests in Tasks 2, 3, 5, 10. Testing plan (spec §10) → Tasks 2, 3, 4, 5, 8, 10. Rollout (spec §11) → task ordering matches.
- **Dashboard placeholder reuse:** The spec said "add new DashboardSection 'Custos'", but the page already has a placeholder section. Plan reuses it (Task 11), which is simpler than creating a new section and removing the old placeholder.
- **`BreakdownCard` vs new component:** Spec said "adapt BreakdownCard". Plan creates dedicated `CostBreakdownCard` (Task 8) — count and cost format differently and the existing component stays single-responsibility. Documented in Task 8.
- **RLS:** Spec §7.3 said "verify policy admin existing in `20260428000000_admin_read_policies.sql`". Verified during exploration: `Admins can read all consultations` already exists. No RLS changes needed.
- **Top 10 por usuário placeholder:** Existing dashboard has this placeholder card; spec doesn't include it. Task 11 drops it. If you want to keep it, add the card back in Task 11 with `placeholder` prop on `BreakdownCard`.
