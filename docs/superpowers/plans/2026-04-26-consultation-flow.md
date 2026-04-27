# Consultation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **IMPORTANT:** Tasks 1–19 only write code and `git commit`. **Do NOT run `npm`, `npx`, `next`, `jest`, `supabase`, or `mastra` commands during these tasks.** All execution (deps install, tests, builds, dev servers, migrations, smoke test) is consolidated into **Task 20 (Execução & Verificação)**, which the project owner runs in a separate session. Subagent execution stops after Task 19.

**Goal:** Build the complete user experience for creating a medical second opinion — PDF upload, optional patient context, specialist selection, processing by a Mastra workflow with Claude Sonnet 4.6, real-time status tracking, structured result, and retry on failure.

**Architecture:** Single-page form at `/consultas/nova` (drag-and-drop PDFs + optional context textarea + specialist cards). Server Actions create DB records, generate signed upload URLs, then trigger a Mastra Cloud workflow. Workflow runs `loadContext → downloadPdfs → runSpecialist → persistResult`. Status page at `/consultas/[id]` subscribes to Supabase Realtime and renders structured result or failure card with retry button.

**Tech Stack:** Next.js 16, Supabase (PostgreSQL + Storage + RLS + Realtime), React 19, Tailwind CSS 4, Lucide React icons, Server Actions, Mastra (Cloud), `@ai-sdk/anthropic` (Claude Sonnet 4.6), Zod.

**Spec:** `docs/superpowers/specs/2026-04-26-consultation-flow-design.md`

**Next.js 16 notes:**
- `cookies()`, `headers()` are async (already used correctly in codebase)
- `params` and `searchParams` are Promises — must be awaited in page components
- `middleware.ts` is deprecated (→ `proxy.ts`) but still functional; migration is out of scope for this plan

---

## File Structure

### New files (Next.js side)

| File | Responsibility |
|---|---|
| `supabase/migrations/20260426000000_create_consultation_tables.sql` | Tables, RLS, trigger, storage bucket, Realtime publication, seed data (with `agent_key`) |
| `actions/consultation.ts` | Server Actions: `createConsultation`, `confirmConsultationUpload`, `retryConsultation` |
| `lib/mastra/client.ts` | Typed HTTP client to call Mastra (`startConsultationWorkflow`) |
| `components/consultation/pdf-dropzone.tsx` | Drag & drop + button, file preview, validation, remove |
| `components/consultation/patient-context-input.tsx` | Optional textarea (max 2000 chars) with counter |
| `components/consultation/specialist-picker.tsx` | Grid of specialist cards, single-select |
| `components/consultation/consultation-form.tsx` | Orchestrates dropzone + context + picker + submit + upload flow |
| `components/consultation/consultation-status-live.tsx` | Client wrapper subscribing to Supabase Realtime |
| `components/consultation/consultation-result.tsx` | Renders structured result (summary/findings/assessment/etc.) |
| `components/consultation/consultation-failed.tsx` | Failure card + retry button |
| `components/dashboard/consultation-list.tsx` | Lists user consultations with status badges (incl. `failed`) |
| `app/(protected)/consultas/nova/page.tsx` | New consultation page |
| `app/(protected)/consultas/[id]/page.tsx` | Consultation status page |
| `.vercelignore` | Ignore `mastra/` so Vercel doesn't ship it |

### New files (Mastra side — `mastra/` directory, deployed to Mastra Cloud)

| File | Responsibility |
|---|---|
| `mastra/index.ts` | Exports the `Mastra` instance with agents + workflow + auth middleware |
| `mastra/lib/supabase-admin.ts` | Service-role Supabase client |
| `mastra/schemas/consultation-result.ts` | Zod schema for structured output |
| `mastra/agents/shared.ts` | Shared agent config (model factory, defaults) |
| `mastra/agents/cardiology.ts` | Cardiology specialist agent |
| `mastra/agents/oncology.ts` | Oncology specialist agent |
| `mastra/agents/neurology.ts` | Neurology specialist agent |
| `mastra/agents/orthopedics.ts` | Orthopedics specialist agent |
| `mastra/agents/dermatology.ts` | Dermatology specialist agent |
| `mastra/agents/general-practice.ts` | General practice specialist agent |
| `mastra/agents/index.ts` | Re-exports all agents and the keyed registry |
| `mastra/workflows/consultation-workflow.ts` | Workflow definition |
| `mastra/workflows/steps/load-context.ts` | Step: load consultation, files, specialist |
| `mastra/workflows/steps/download-pdfs.ts` | Step: download PDFs from Storage |
| `mastra/workflows/steps/run-specialist.ts` | Step: invoke specialist agent with structured output |
| `mastra/workflows/steps/persist-result.ts` | Step: persist result, set status to completed |
| `mastra/lib/mark-failed.ts` | Helper `markConsultationFailed(id, message)` used by every step's catch |

### Modified files

| File | Change |
|---|---|
| `lib/auth/route-access.ts:2` | Add `/consultas` to `PROTECTED_PREFIXES` |
| `app/(protected)/layout.tsx` | Update branding, add nav link, translate logout |
| `app/(protected)/dashboard/page.tsx` | Replace placeholder with `ConsultationList` |
| `package.json` / `package-lock.json` | Add Mastra + Anthropic deps (during Task 20) |

### Test files

| File | Tests |
|---|---|
| `__tests__/lib/auth/route-access.test.ts` | Add `/consultas` protection tests |
| `__tests__/lib/mastra/client.test.ts` | HTTP client builds request correctly, propagates errors |
| `__tests__/actions/consultation.test.ts` | Server Action unit tests including patient_context, workflow trigger, retry |
| `__tests__/components/consultation/pdf-dropzone.test.tsx` | Dropzone behavior tests |
| `__tests__/components/consultation/patient-context-input.test.tsx` | Counter, max length |
| `__tests__/components/consultation/specialist-picker.test.tsx` | Picker selection tests |
| `__tests__/components/consultation/consultation-result.test.tsx` | Renders all sections, hides empty redFlags |
| `__tests__/mastra/agents/instructions.test.ts` | Snapshot of each agent's `instructions` |
| `__tests__/mastra/workflows/steps/run-specialist.test.ts` | Message construction, schema validation, missing agent_key |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260426000000_create_consultation_tables.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- specialists table
create table public.specialists (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  icon text not null,
  agent_key text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.specialists enable row level security;

create policy "Anyone can read active specialists"
  on public.specialists for select
  using (active = true);

-- consultations table
create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  specialist_id uuid not null references public.specialists(id),
  patient_context text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed')),
  result jsonb,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.consultations enable row level security;

create policy "Users can read own consultations"
  on public.consultations for select
  using (auth.uid() = user_id);

create policy "Users can create own consultations"
  on public.consultations for insert
  with check (auth.uid() = user_id);

create policy "Users can update own consultations"
  on public.consultations for update
  using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_consultations_updated_at
  before update on public.consultations
  for each row execute function public.update_updated_at();

-- enable Realtime on consultations
alter publication supabase_realtime add table public.consultations;

-- consultation_files table
create table public.consultation_files (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  file_name text not null,
  file_size integer not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

alter table public.consultation_files enable row level security;

create policy "Users can read own consultation files"
  on public.consultation_files for select
  using (
    exists (
      select 1 from public.consultations
      where public.consultations.id = consultation_files.consultation_id
      and public.consultations.user_id = auth.uid()
    )
  );

create policy "Users can create files for own consultations"
  on public.consultation_files for insert
  with check (
    exists (
      select 1 from public.consultations
      where public.consultations.id = consultation_files.consultation_id
      and public.consultations.user_id = auth.uid()
    )
  );

-- storage bucket
insert into storage.buckets (id, name, public)
values ('consultation-files', 'consultation-files', false);

create policy "Users can upload own consultation files"
  on storage.objects for insert
  with check (
    bucket_id = 'consultation-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "Users can read own consultation files storage"
  on storage.objects for select
  using (
    bucket_id = 'consultation-files'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- seed specialists
insert into public.specialists (name, description, icon, agent_key) values
  ('Cardiologista',  'Especialista em doenças do coração e sistema cardiovascular',     'heart-pulse', 'cardiology'),
  ('Oncologista',    'Especialista em diagnóstico e tratamento de câncer',              'ribbon',      'oncology'),
  ('Neurologista',   'Especialista em doenças do sistema nervoso e cérebro',            'brain',       'neurology'),
  ('Ortopedista',    'Especialista em ossos, articulações e sistema musculoesquelético','bone',        'orthopedics'),
  ('Dermatologista', 'Especialista em doenças da pele, cabelo e unhas',                 'scan-face',   'dermatology'),
  ('Clínico Geral',  'Avaliação médica abrangente e orientação diagnóstica',            'stethoscope', 'general_practice');
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260426000000_create_consultation_tables.sql
git commit -m "feat: add consultation tables, RLS, storage, Realtime, and seed data"
```

> Migration application/reset happens in **Task 20 (Execução & Verificação)**.

---

## Task 2: Route Protection for `/consultas`

**Files:**
- Modify: `lib/auth/route-access.ts:2`
- Modify: `__tests__/lib/auth/route-access.test.ts`

- [ ] **Step 1: Write failing tests for `/consultas` routes**

Add to `__tests__/lib/auth/route-access.test.ts`, inside the `describe('protected paths')` block:

```ts
it('redirects unauthenticated user from /consultas/nova to /login', () => {
  expect(determineAccess('/consultas/nova', null, null)).toEqual({
    action: 'redirect',
    destination: '/login',
  })
})

it('allows authenticated user to access /consultas/nova', () => {
  expect(determineAccess('/consultas/nova', user, 'user')).toEqual({ action: 'allow' })
})

it('redirects unauthenticated user from /consultas/some-id to /login', () => {
  expect(determineAccess('/consultas/some-id', null, null)).toEqual({
    action: 'redirect',
    destination: '/login',
  })
})
```

- [ ] **Step 2: Update route-access.ts**

```ts
const PROTECTED_PREFIXES = ['/dashboard', '/consultas']
```

- [ ] **Step 3: Commit**

```bash
git add lib/auth/route-access.ts __tests__/lib/auth/route-access.test.ts
git commit -m "feat: protect /consultas routes behind authentication"
```

---

## Task 3: Sidebar and Layout Update

**Files:**
- Modify: `app/(protected)/layout.tsx`

- [ ] **Step 1: Update the protected layout**

Replace the full content of `app/(protected)/layout.tsx`:

```tsx
import Link from 'next/link'
import { logout } from '@/actions/auth'

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex">
      <aside className="w-56 border-r bg-gray-50 flex flex-col p-6">
        <Link href="/dashboard" className="font-semibold text-lg mb-8 block">
          Segunda Opinião
        </Link>
        <nav className="space-y-1 flex-1">
          <Link
            href="/dashboard"
            className="block text-sm px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            Minhas Consultas
          </Link>
          <Link
            href="/consultas/nova"
            className="block text-sm px-3 py-2 rounded-lg hover:bg-gray-100"
          >
            Nova Consulta
          </Link>
        </nav>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-black w-full text-left"
          >
            Sair
          </button>
        </form>
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(protected\)/layout.tsx
git commit -m "feat: update sidebar with branding, navigation, and Portuguese labels"
```

---

## Task 4: Mastra Project Bootstrap

**Files:**
- Create: `.vercelignore`
- Create: `mastra/index.ts`
- Create: `mastra/lib/supabase-admin.ts`

> Dependency installation (`@mastra/core`, `@ai-sdk/anthropic`, `zod`) happens in **Task 20 (Execução & Verificação)**.

- [ ] **Step 1: Create `.vercelignore`**

```
mastra/
```

This prevents Vercel from including the Mastra service code in the Next.js build.

- [ ] **Step 2: Create `mastra/lib/supabase-admin.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
})
```

- [ ] **Step 3: Create `mastra/index.ts` (skeleton — agents/workflow added in later tasks)**

```ts
import { Mastra } from '@mastra/core'

export const mastra = new Mastra({
  agents: {},
  workflows: {},
  server: {
    middleware: [
      {
        handler: async (c, next) => {
          const auth = c.req.header('authorization')
          if (auth !== `Bearer ${process.env.MASTRA_API_KEY}`) {
            return new Response('Unauthorized', { status: 401 })
          }
          return next()
        },
        path: '/api/workflows/*',
      },
    ],
  },
})
```

- [ ] **Step 4: Commit**

```bash
git add .vercelignore mastra/
git commit -m "feat: bootstrap Mastra service with auth middleware"
```

> Note: `package.json` / `package-lock.json` will be committed in Task 20 after `npm install`.

---

## Task 5: Output Schema (Zod)

**Files:**
- Create: `mastra/schemas/consultation-result.ts`

- [ ] **Step 1: Create the schema**

```ts
import { z } from 'zod'

export const consultationResultSchema = z.object({
  summary: z.string(),
  findings: z.array(z.object({
    title: z.string(),
    detail: z.string(),
    severity: z.enum(['info', 'attention', 'urgent']),
  })),
  assessment: z.string(),
  recommendations: z.array(z.string()),
  questionsForDoctor: z.array(z.string()),
  redFlags: z.array(z.string()),
  confidence: z.enum(['low', 'medium', 'high']),
  disclaimer: z.string(),
})

export type ConsultationResult = z.infer<typeof consultationResultSchema>
```

- [ ] **Step 2: Commit**

```bash
git add mastra/schemas/
git commit -m "feat: add Zod schema for structured consultation result"
```

---

## Task 6: Specialist Agents

**Files:**
- Create: `mastra/agents/shared.ts`
- Create: `mastra/agents/cardiology.ts`
- Create: `mastra/agents/oncology.ts`
- Create: `mastra/agents/neurology.ts`
- Create: `mastra/agents/orthopedics.ts`
- Create: `mastra/agents/dermatology.ts`
- Create: `mastra/agents/general-practice.ts`
- Create: `mastra/agents/index.ts`
- Create: `__tests__/mastra/agents/instructions.test.ts`
- Modify: `mastra/index.ts` (register agents)

- [ ] **Step 1: Create `mastra/agents/shared.ts`**

```ts
import { anthropic } from '@ai-sdk/anthropic'

export const specialistModel = anthropic('claude-sonnet-4-6')

export const sharedGuidelines = `
Você está fornecendo uma SEGUNDA OPINIÃO médica, não um diagnóstico definitivo.
Limites:
- Não substitui consulta presencial nem exame físico.
- Sempre incluir disclaimer no campo \`disclaimer\`.
- Se identificar red flag (sinal de alerta urgente), preencher \`redFlags\` com clareza.
- Tom técnico mas acessível ao paciente leigo.
- Sempre preencher todos os campos do schema, mesmo que com lista vazia.
- Citar trechos do exame ao fazer afirmações fortes.
- Se algum exame estiver ilegível ou ausente, mencionar em \`assessment\` e ajustar \`confidence\`.
`.trim()
```

- [ ] **Step 2: Create each specialist agent**

Pattern (`mastra/agents/cardiology.ts`):

```ts
import { Agent } from '@mastra/core/agent'
import { specialistModel, sharedGuidelines } from './shared'

export const cardiology = new Agent({
  name: 'cardiology',
  instructions: `${sharedGuidelines}

Você é um cardiologista experiente.

Áreas de atenção típicas: ECG, ecocardiograma, holter, MAPA, perfil lipídico, troponina,
sinais de IAM, IC, arritmias, HAS, valvopatias.

Ao analisar exames cardiológicos, considere comorbidades comuns
(diabetes, dislipidemia, tabagismo) ao calibrar recomendações.`,
  model: specialistModel,
})
```

Repetir para os outros 5 (oncology, neurology, orthopedics, dermatology, general-practice) com instruções específicas da especialidade.

- [ ] **Step 3: Create `mastra/agents/index.ts`**

```ts
export { cardiology } from './cardiology'
export { oncology } from './oncology'
export { neurology } from './neurology'
export { orthopedics } from './orthopedics'
export { dermatology } from './dermatology'
export { generalPractice } from './general-practice'

import { cardiology } from './cardiology'
import { oncology } from './oncology'
import { neurology } from './neurology'
import { orthopedics } from './orthopedics'
import { dermatology } from './dermatology'
import { generalPractice } from './general-practice'

export const agentsByKey = {
  cardiology,
  oncology,
  neurology,
  orthopedics,
  dermatology,
  general_practice: generalPractice,
}
```

- [ ] **Step 4: Register agents in `mastra/index.ts`**

Replace the full content of `mastra/index.ts`:

```ts
import { Mastra } from '@mastra/core'
import { agentsByKey } from './agents'

export const mastra = new Mastra({
  agents: agentsByKey,
  workflows: {},
  server: {
    middleware: [
      {
        handler: async (c, next) => {
          const auth = c.req.header('authorization')
          if (auth !== `Bearer ${process.env.MASTRA_API_KEY}`) {
            return new Response('Unauthorized', { status: 401 })
          }
          return next()
        },
        path: '/api/workflows/*',
      },
    ],
  },
})
```

- [ ] **Step 5: Write snapshot test for instructions**

Create `__tests__/mastra/agents/instructions.test.ts`:

```ts
import { agentsByKey } from '@/mastra/agents'

describe('specialist agent instructions', () => {
  for (const [key, agent] of Object.entries(agentsByKey)) {
    it(`${key} instructions match snapshot`, () => {
      expect(agent.instructions).toMatchSnapshot()
    })
  }
})
```

- [ ] **Step 6: Commit**

```bash
git add mastra/agents/ __tests__/mastra/agents/ mastra/index.ts
git commit -m "feat: add 6 specialist Mastra agents with instructions snapshots"
```

---

## Task 7: Workflow Steps

**Files:**
- Create: `mastra/lib/mark-failed.ts`
- Create: `mastra/workflows/steps/load-context.ts`
- Create: `mastra/workflows/steps/download-pdfs.ts`
- Create: `mastra/workflows/steps/run-specialist.ts`
- Create: `mastra/workflows/steps/persist-result.ts`
- Create: `__tests__/mastra/workflows/steps/run-specialist.test.ts`

- [ ] **Step 1: Create the failure helper**

`mastra/lib/mark-failed.ts`:

```ts
import { supabaseAdmin } from './supabase-admin'

export async function markConsultationFailed(consultationId: string, message: string) {
  await supabaseAdmin
    .from('consultations')
    .update({ status: 'failed', failure_reason: message })
    .eq('id', consultationId)
}
```

- [ ] **Step 2: Implement `loadContext`**

```ts
import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { markConsultationFailed } from '../../lib/mark-failed'

export const loadContext = createStep({
  id: 'loadContext',
  inputSchema: z.object({ consultationId: z.string().uuid() }),
  outputSchema: z.object({
    consultationId: z.string(),
    userId: z.string(),
    agentKey: z.string(),
    patientContext: z.string().nullable(),
    files: z.array(z.object({
      id: z.string(),
      file_name: z.string(),
      storage_path: z.string(),
      file_size: z.number(),
    })),
  }),
  execute: async ({ inputData }) => {
    const { consultationId } = inputData
    try {
      const { data: consultation, error: cErr } = await supabaseAdmin
        .from('consultations')
        .select('id, user_id, status, patient_context, specialist:specialists(agent_key)')
        .eq('id', consultationId)
        .single()
      if (cErr || !consultation) throw new Error('Consulta não encontrada')
      if (consultation.status !== 'processing') {
        throw new Error(`Consulta em estado inesperado: ${consultation.status}`)
      }
      const specialist = Array.isArray(consultation.specialist)
        ? consultation.specialist[0]
        : consultation.specialist
      if (!specialist?.agent_key) throw new Error('Especialista sem agent_key')

      const { data: files, error: fErr } = await supabaseAdmin
        .from('consultation_files')
        .select('id, file_name, storage_path, file_size')
        .eq('consultation_id', consultationId)
      if (fErr || !files?.length) throw new Error('Nenhum arquivo associado à consulta')

      return {
        consultationId,
        userId: consultation.user_id,
        agentKey: specialist.agent_key,
        patientContext: consultation.patient_context,
        files,
      }
    } catch (err) {
      await markConsultationFailed(consultationId, 'Não conseguimos carregar a consulta. Tente novamente.')
      throw err
    }
  },
})
```

- [ ] **Step 3: Implement `downloadPdfs`**

```ts
import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { supabaseAdmin } from '../../lib/supabase-admin'
import { markConsultationFailed } from '../../lib/mark-failed'

const fileWithBytes = z.object({
  id: z.string(),
  file_name: z.string(),
  storage_path: z.string(),
  file_size: z.number(),
  pdfBytes: z.instanceof(Uint8Array),
})

export const downloadPdfs = createStep({
  id: 'downloadPdfs',
  inputSchema: z.object({
    consultationId: z.string(),
    userId: z.string(),
    agentKey: z.string(),
    patientContext: z.string().nullable(),
    files: z.array(z.object({
      id: z.string(),
      file_name: z.string(),
      storage_path: z.string(),
      file_size: z.number(),
    })),
  }),
  outputSchema: z.object({
    consultationId: z.string(),
    agentKey: z.string(),
    patientContext: z.string().nullable(),
    files: z.array(fileWithBytes),
  }),
  execute: async ({ inputData }) => {
    try {
      const filesWithBytes = await Promise.all(
        inputData.files.map(async (f) => {
          const { data, error } = await supabaseAdmin.storage
            .from('consultation-files')
            .download(f.storage_path)
          if (error || !data) throw new Error(`Arquivo ausente: ${f.file_name}`)
          const buffer = await data.arrayBuffer()
          return { ...f, pdfBytes: new Uint8Array(buffer) }
        })
      )
      return {
        consultationId: inputData.consultationId,
        agentKey: inputData.agentKey,
        patientContext: inputData.patientContext,
        files: filesWithBytes,
      }
    } catch (err) {
      await markConsultationFailed(inputData.consultationId, 'Não conseguimos ler seus arquivos. Tente novamente.')
      throw err
    }
  },
})
```

- [ ] **Step 4: Implement `runSpecialist`**

```ts
import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { agentsByKey } from '../../agents'
import { consultationResultSchema } from '../../schemas/consultation-result'
import { markConsultationFailed } from '../../lib/mark-failed'

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
  }),
  execute: async ({ inputData }) => {
    try {
      // Imported from agents registry directly to avoid circular dep with mastra/index.ts
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

      const { object } = await agent.generate(messages, {
        output: consultationResultSchema,
      })

      return { consultationId: inputData.consultationId, result: object }
    } catch (err) {
      await markConsultationFailed(inputData.consultationId, 'Não conseguimos analisar seus exames. Tente novamente.')
      throw err
    }
  },
})
```

- [ ] **Step 5: Implement `persistResult`**

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
  }),
  outputSchema: z.object({ status: z.enum(['completed', 'failed']) }),
  execute: async ({ inputData }) => {
    try {
      const { error } = await supabaseAdmin
        .from('consultations')
        .update({ status: 'completed', result: inputData.result })
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

- [ ] **Step 6: Write tests for `runSpecialist`**

`__tests__/mastra/workflows/steps/run-specialist.test.ts` covers:
- Constructs `messages` with one `file` part per PDF
- Includes patient context when present, omits prefix when null
- Calls `agent.generate` with `experimental_output: consultationResultSchema`
- Throws and marks failed when `agentKey` doesn't resolve
- Throws and marks failed when `agent.generate` rejects

Use mocks for `mastra.getAgent` and `supabaseAdmin`.

- [ ] **Step 7: Commit**

```bash
git add mastra/lib/ mastra/workflows/steps/ __tests__/mastra/
git commit -m "feat: add Mastra workflow steps for consultation processing"
```

---

## Task 8: Workflow Definition

**Files:**
- Create: `mastra/workflows/consultation-workflow.ts`
- Modify: `mastra/index.ts` (register workflow)

- [ ] **Step 1: Define the workflow**

```ts
import { createWorkflow } from '@mastra/core/workflows'
import { z } from 'zod'
import { loadContext } from './steps/load-context'
import { downloadPdfs } from './steps/download-pdfs'
import { runSpecialist } from './steps/run-specialist'
import { persistResult } from './steps/persist-result'

export const consultationWorkflow = createWorkflow({
  id: 'consultationWorkflow',
  inputSchema: z.object({ consultationId: z.string().uuid() }),
  outputSchema: z.object({ status: z.enum(['completed', 'failed']) }),
})
  .then(loadContext)
  .then(downloadPdfs)
  .then(runSpecialist)
  .then(persistResult)
  .commit()
```

- [ ] **Step 2: Register in `mastra/index.ts`**

Replace the full content of `mastra/index.ts`:

```ts
import { Mastra } from '@mastra/core'
import { agentsByKey } from './agents'
import { consultationWorkflow } from './workflows/consultation-workflow'

export const mastra = new Mastra({
  agents: agentsByKey,
  workflows: { consultationWorkflow },
  server: {
    middleware: [
      {
        handler: async (c, next) => {
          const auth = c.req.header('authorization')
          if (auth !== `Bearer ${process.env.MASTRA_API_KEY}`) {
            return new Response('Unauthorized', { status: 401 })
          }
          return next()
        },
        path: '/api/workflows/*',
      },
    ],
  },
})
```

- [ ] **Step 3: Commit**

```bash
git add mastra/workflows/consultation-workflow.ts mastra/index.ts
git commit -m "feat: define Mastra consultation workflow"
```

---

## Task 9: Mastra HTTP Client (Next.js side)

**Files:**
- Create: `lib/mastra/client.ts`
- Create: `__tests__/lib/mastra/client.test.ts`

- [ ] **Step 1: Write failing tests**

`__tests__/lib/mastra/client.test.ts`:

```ts
import { startConsultationWorkflow } from '@/lib/mastra/client'

const fetchMock = jest.fn()
global.fetch = fetchMock as unknown as typeof fetch

beforeEach(() => {
  jest.clearAllMocks()
  process.env.MASTRA_URL = 'https://mastra.test'
  process.env.MASTRA_API_KEY = 'test-key'
})

describe('startConsultationWorkflow', () => {
  it('posts consultationId with bearer auth', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ runId: 'run-1' }),
    })
    const out = await startConsultationWorkflow('cid-1')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://mastra.test/api/workflows/consultationWorkflow/start-async',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ inputData: { consultationId: 'cid-1' } }),
      })
    )
    expect(out).toEqual({ runId: 'run-1' })
  })

  it('throws when response not ok', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 })
    await expect(startConsultationWorkflow('cid-1')).rejects.toThrow(/500/)
  })
})
```

- [ ] **Step 2: Implement the client**

```ts
const MASTRA_URL = process.env.MASTRA_URL!
const MASTRA_API_KEY = process.env.MASTRA_API_KEY!

export async function startConsultationWorkflow(consultationId: string) {
  const res = await fetch(
    `${MASTRA_URL}/api/workflows/consultationWorkflow/start-async`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${MASTRA_API_KEY}`,
      },
      body: JSON.stringify({ inputData: { consultationId } }),
    }
  )
  if (!res.ok) throw new Error(`Mastra start failed: ${res.status}`)
  return res.json() as Promise<{ runId: string }>
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/mastra/ __tests__/lib/mastra/
git commit -m "feat: add typed HTTP client for Mastra workflow trigger"
```

---

## Task 10: Server Actions (`createConsultation`, `confirmConsultationUpload`, `retryConsultation`)

**Files:**
- Create: `actions/consultation.ts`
- Create: `__tests__/actions/consultation.test.ts`

- [ ] **Step 1: Write failing tests**

Cover at minimum:
- `createConsultation`: unauthenticated → error; empty files → error; >5 files → error; >10MB file → error; specialist not active → error; `patient_context` >2000 chars → error; happy path inserts and returns signed URLs.
- `confirmConsultationUpload`: unauthenticated → error; consultation not pending → error; missing files in storage → error; happy path updates to `processing` and calls `startConsultationWorkflow`; if `startConsultationWorkflow` throws, status is reverted to `failed` with `failure_reason`.
- `retryConsultation`: unauthenticated → error; consultation not in `failed` state → error; happy path resets fields and calls `startConsultationWorkflow`.

Mock `@/lib/supabase/server`, `@/lib/mastra/client`, and `next/navigation`.

- [ ] **Step 2: Implement**

```ts
'use server'

import { createClient } from '@/lib/supabase/server'
import { startConsultationWorkflow } from '@/lib/mastra/client'

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_CONTEXT = 2000

type FileMetadata = { name: string; size: number }

type CreateInput = {
  specialistId: string
  patientContext?: string
  files: FileMetadata[]
}

type CreateResult =
  | { error: string }
  | { consultationId: string; uploadUrls: { fileName: string; url: string }[] }

export async function createConsultation(input: CreateInput): Promise<CreateResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado' }

  if (!input.files.length) return { error: 'Envie pelo menos 1 arquivo PDF' }
  if (input.files.length > MAX_FILES) return { error: 'Máximo de 5 arquivos permitidos' }
  if (input.files.some(f => f.size > MAX_FILE_SIZE)) return { error: 'Cada arquivo deve ter no máximo 10MB' }
  if (input.patientContext && input.patientContext.length > MAX_CONTEXT) {
    return { error: `Contexto deve ter no máximo ${MAX_CONTEXT} caracteres` }
  }

  const { data: specialist } = await supabase
    .from('specialists')
    .select('id')
    .eq('id', input.specialistId)
    .eq('active', true)
    .single()
  if (!specialist) return { error: 'Especialista não encontrado' }

  const { data: consultation, error: cErr } = await supabase
    .from('consultations')
    .insert({
      user_id: user.id,
      specialist_id: input.specialistId,
      patient_context: input.patientContext ?? null,
      status: 'pending',
    })
    .select('id')
    .single()
  if (cErr || !consultation) return { error: 'Erro ao criar consulta. Tente novamente.' }

  const uploadUrls: { fileName: string; url: string }[] = []
  for (const file of input.files) {
    const storagePath = `${user.id}/${consultation.id}/${file.name}`
    const { error: fErr } = await supabase.from('consultation_files').insert({
      consultation_id: consultation.id,
      file_name: file.name,
      file_size: file.size,
      storage_path: storagePath,
    })
    if (fErr) return { error: 'Erro ao registrar arquivo. Tente novamente.' }

    const { data: signed, error: uErr } = await supabase.storage
      .from('consultation-files')
      .createSignedUploadUrl(storagePath, { upsert: false })
    if (uErr || !signed) return { error: 'Erro ao gerar URL de upload. Tente novamente.' }

    uploadUrls.push({ fileName: file.name, url: signed.signedUrl })
  }

  return { consultationId: consultation.id, uploadUrls }
}

type ConfirmResult = { error: string } | { success: true }

export async function confirmConsultationUpload(consultationId: string): Promise<ConfirmResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado' }

  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status')
    .eq('id', consultationId)
    .eq('user_id', user.id)
    .single()
  if (!consultation) return { error: 'Consulta não encontrada' }
  if (consultation.status !== 'pending') return { error: 'Esta consulta já foi confirmada' }

  const { data: files } = await supabase
    .from('consultation_files')
    .select('storage_path, file_name')
    .eq('consultation_id', consultationId)
  if (!files?.length) return { error: 'Nenhum arquivo registrado' }

  const missing: string[] = []
  for (const file of files) {
    const dir = file.storage_path.substring(0, file.storage_path.lastIndexOf('/'))
    const fileName = file.storage_path.substring(file.storage_path.lastIndexOf('/') + 1)
    const { data: listed } = await supabase.storage.from('consultation-files').list(dir)
    if (!listed?.some(i => i.name === fileName)) missing.push(file.file_name)
  }
  if (missing.length) return { error: `Arquivos não enviados: ${missing.join(', ')}` }

  const { error: upErr } = await supabase
    .from('consultations')
    .update({ status: 'processing' })
    .eq('id', consultationId)
  if (upErr) return { error: 'Erro ao atualizar status' }

  try {
    await startConsultationWorkflow(consultationId)
  } catch {
    await supabase
      .from('consultations')
      .update({ status: 'failed', failure_reason: 'Não foi possível iniciar a análise. Tente novamente.' })
      .eq('id', consultationId)
    return { error: 'Não foi possível iniciar a análise. Tente novamente em instantes.' }
  }

  return { success: true }
}

export async function retryConsultation(consultationId: string): Promise<ConfirmResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Usuário não autenticado' }

  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status')
    .eq('id', consultationId)
    .eq('user_id', user.id)
    .single()
  if (!consultation) return { error: 'Consulta não encontrada' }
  if (consultation.status !== 'failed') return { error: 'Só é possível reenviar consultas com falha' }

  const { error: upErr } = await supabase
    .from('consultations')
    .update({ status: 'processing', failure_reason: null, result: null })
    .eq('id', consultationId)
  if (upErr) return { error: 'Erro ao atualizar status' }

  try {
    await startConsultationWorkflow(consultationId)
  } catch {
    await supabase
      .from('consultations')
      .update({ status: 'failed', failure_reason: 'Não foi possível iniciar a análise. Tente novamente.' })
      .eq('id', consultationId)
    return { error: 'Não foi possível iniciar a análise. Tente novamente em instantes.' }
  }

  return { success: true }
}
```

- [ ] **Step 3: Commit**

```bash
git add actions/consultation.ts __tests__/actions/consultation.test.ts
git commit -m "feat: add server actions for consultation lifecycle and Mastra trigger"
```

---

## Task 11: PDF Dropzone Component

**Files:**
- Create: `components/consultation/pdf-dropzone.tsx`
- Create: `__tests__/components/consultation/pdf-dropzone.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/consultation/pdf-dropzone.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { PdfDropzone } from '@/components/consultation/pdf-dropzone'

describe('PdfDropzone', () => {
  const mockOnChange = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the dropzone with instructions', () => {
    render(<PdfDropzone files={[]} onChange={mockOnChange} />)
    expect(screen.getByText(/arraste seus arquivos PDF/i)).toBeInTheDocument()
  })

  it('shows file list when files are added', () => {
    const files = [new File(['content'], 'exam1.pdf', { type: 'application/pdf' })]
    render(<PdfDropzone files={files} onChange={mockOnChange} />)
    expect(screen.getByText('exam1.pdf')).toBeInTheDocument()
  })

  it('calls onChange when remove button is clicked', () => {
    const files = [
      new File(['content'], 'exam1.pdf', { type: 'application/pdf' }),
      new File(['content'], 'exam2.pdf', { type: 'application/pdf' }),
    ]
    render(<PdfDropzone files={files} onChange={mockOnChange} />)
    const removeButtons = screen.getAllByRole('button', { name: /remover/i })
    fireEvent.click(removeButtons[0])
    expect(mockOnChange).toHaveBeenCalledWith([files[1]])
  })

  it('shows error when non-PDF file is added', () => {
    render(<PdfDropzone files={[]} onChange={mockOnChange} />)
    const input = screen.getByTestId('file-input')
    const invalidFile = new File(['content'], 'photo.png', { type: 'image/png' })
    fireEvent.change(input, { target: { files: [invalidFile] } })
    expect(screen.getByText(/apenas arquivos PDF/i)).toBeInTheDocument()
    expect(mockOnChange).not.toHaveBeenCalled()
  })

  it('shows error when more than 5 files total', () => {
    const existingFiles = Array.from({ length: 5 }, (_, i) =>
      new File(['content'], `exam${i}.pdf`, { type: 'application/pdf' })
    )
    render(<PdfDropzone files={existingFiles} onChange={mockOnChange} />)
    const input = screen.getByTestId('file-input')
    const newFile = new File(['content'], 'extra.pdf', { type: 'application/pdf' })
    fireEvent.change(input, { target: { files: [newFile] } })
    expect(screen.getByText(/máximo de 5 arquivos/i)).toBeInTheDocument()
    expect(mockOnChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Implement the component**

Create `components/consultation/pdf-dropzone.tsx`:

```tsx
'use client'

import { useCallback, useRef, useState } from 'react'
import { FileUp, X } from 'lucide-react'

const MAX_FILES = 5
const MAX_FILE_SIZE = 10 * 1024 * 1024

type Props = {
  files: File[]
  onChange: (files: File[]) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function PdfDropzone({ files, onChange }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const validateAndAdd = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles || newFiles.length === 0) return
      setError(null)
      const incoming = Array.from(newFiles)

      const nonPdf = incoming.find(
        (f) => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')
      )
      if (nonPdf) {
        setError('Apenas arquivos PDF são aceitos')
        return
      }

      const tooBig = incoming.find((f) => f.size > MAX_FILE_SIZE)
      if (tooBig) {
        setError(`"${tooBig.name}" excede o limite de 10MB`)
        return
      }

      if (files.length + incoming.length > MAX_FILES) {
        setError(`Máximo de ${MAX_FILES} arquivos permitidos`)
        return
      }

      onChange([...files, ...incoming])
    },
    [files, onChange]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      validateAndAdd(e.dataTransfer.files)
    },
    [validateAndAdd]
  )

  const handleRemove = useCallback(
    (index: number) => {
      onChange(files.filter((_, i) => i !== index))
      setError(null)
    },
    [files, onChange]
  )

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragging
            ? 'border-primary bg-primary/5'
            : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <FileUp className="mx-auto h-10 w-10 text-gray-400 mb-3" />
        <p className="text-sm text-gray-600">
          Arraste seus arquivos PDF aqui ou{' '}
          <span className="text-primary font-medium">clique para selecionar</span>
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Máximo {MAX_FILES} arquivos, até 10MB cada
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          data-testid="file-input"
          onChange={(e) => {
            validateAndAdd(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 bg-red-50 rounded flex items-center justify-center">
                  <span className="text-xs font-medium text-red-600">PDF</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-gray-400">{formatFileSize(file.size)}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRemove(index)}
                aria-label="Remover"
                className="flex-shrink-0 p-1 text-gray-400 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/consultation/pdf-dropzone.tsx __tests__/components/consultation/pdf-dropzone.test.tsx
git commit -m "feat: add PdfDropzone component with drag-and-drop and validation"
```

---

## Task 12: Patient Context Input Component

**Files:**
- Create: `components/consultation/patient-context-input.tsx`
- Create: `__tests__/components/consultation/patient-context-input.test.tsx`

- [ ] **Step 1: Write failing tests**

Tests cover: renders with placeholder; calls `onChange` on input; shows live counter `N / 2000`; counter color changes when within 100 chars of limit; doesn't accept input beyond 2000 chars (or truncates).

- [ ] **Step 2: Implement**

```tsx
'use client'

const MAX = 2000

type Props = {
  value: string
  onChange: (v: string) => void
}

export function PatientContextInput({ value, onChange }: Props) {
  const remaining = MAX - value.length
  return (
    <div>
      <label htmlFor="patient-context" className="block text-sm font-medium mb-2">
        Conte sobre sua dúvida ou sintomas (opcional)
      </label>
      <textarea
        id="patient-context"
        value={value}
        maxLength={MAX}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        className="w-full rounded-lg border p-3 text-sm"
        placeholder="Ex.: tenho sentido falta de ar e meu médico pediu esses exames…"
      />
      <p className={`text-xs mt-1 ${remaining < 100 ? 'text-orange-600' : 'text-gray-400'}`}>
        {value.length} / {MAX}
      </p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/consultation/patient-context-input.tsx __tests__/components/consultation/patient-context-input.test.tsx
git commit -m "feat: add optional patient context textarea with counter"
```

---

## Task 13: Specialist Picker Component

**Files:**
- Create: `components/consultation/specialist-picker.tsx`
- Create: `__tests__/components/consultation/specialist-picker.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `__tests__/components/consultation/specialist-picker.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { SpecialistPicker } from '@/components/consultation/specialist-picker'

const specialists = [
  { id: '1', name: 'Cardiologista', description: 'Coração', icon: 'heart-pulse' },
  { id: '2', name: 'Neurologista', description: 'Cérebro', icon: 'brain' },
]

describe('SpecialistPicker', () => {
  const mockOnSelect = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders all specialists as cards', () => {
    render(
      <SpecialistPicker
        specialists={specialists}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    )
    expect(screen.getByText('Cardiologista')).toBeInTheDocument()
    expect(screen.getByText('Neurologista')).toBeInTheDocument()
  })

  it('calls onSelect when a card is clicked', () => {
    render(
      <SpecialistPicker
        specialists={specialists}
        selectedId={null}
        onSelect={mockOnSelect}
      />
    )
    fireEvent.click(screen.getByText('Cardiologista'))
    expect(mockOnSelect).toHaveBeenCalledWith('1')
  })

  it('highlights the selected card', () => {
    render(
      <SpecialistPicker
        specialists={specialists}
        selectedId="1"
        onSelect={mockOnSelect}
      />
    )
    const card = screen.getByText('Cardiologista').closest('button')
    expect(card?.className).toContain('border-primary')
  })
})
```

- [ ] **Step 2: Implement the component**

Create `components/consultation/specialist-picker.tsx`:

```tsx
'use client'

import {
  HeartPulse,
  Ribbon,
  Brain,
  Bone,
  ScanFace,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react'

const iconMap: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  ribbon: Ribbon,
  brain: Brain,
  bone: Bone,
  'scan-face': ScanFace,
  stethoscope: Stethoscope,
}

export type Specialist = {
  id: string
  name: string
  description: string
  icon: string
}

type Props = {
  specialists: Specialist[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function SpecialistPicker({ specialists, selectedId, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
      {specialists.map((specialist) => {
        const Icon = iconMap[specialist.icon] ?? Stethoscope
        const isSelected = selectedId === specialist.id

        return (
          <button
            key={specialist.id}
            type="button"
            onClick={() => onSelect(specialist.id)}
            className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-colors ${
              isSelected
                ? 'border-primary bg-primary/5'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Icon className={`h-8 w-8 ${isSelected ? 'text-primary' : 'text-gray-400'}`} />
            <div>
              <p className="text-sm font-medium">{specialist.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{specialist.description}</p>
            </div>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/consultation/specialist-picker.tsx __tests__/components/consultation/specialist-picker.test.tsx
git commit -m "feat: add SpecialistPicker component with card selection"
```

---

## Task 14: Consultation Form (Orchestrator)

**Files:**
- Create: `components/consultation/consultation-form.tsx`

- [ ] **Step 1: Implement the form**

Create `components/consultation/consultation-form.tsx`:

```tsx
'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { PdfDropzone } from './pdf-dropzone'
import { PatientContextInput } from './patient-context-input'
import { SpecialistPicker, type Specialist } from './specialist-picker'
import {
  createConsultation,
  confirmConsultationUpload,
} from '@/actions/consultation'
import { Button } from '@/components/ui/button'

type UploadProgress = {
  fileName: string
  status: 'pending' | 'uploading' | 'done' | 'error'
}

type Props = {
  specialists: Specialist[]
}

export function ConsultationForm({ specialists }: Props) {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [patientContext, setPatientContext] = useState('')
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([])

  const canSubmit = files.length > 0 && selectedSpecialistId && !isSubmitting

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    setIsSubmitting(true)
    setError(null)
    setUploadProgress([])

    const result = await createConsultation({
      specialistId: selectedSpecialistId!,
      patientContext: patientContext.trim() || undefined,
      files: files.map((f) => ({ name: f.name, size: f.size })),
    })

    if ('error' in result) {
      setError(result.error)
      setIsSubmitting(false)
      return
    }

    const progress: UploadProgress[] = files.map((f) => ({
      fileName: f.name,
      status: 'pending',
    }))
    setUploadProgress([...progress])

    let allUploaded = true

    for (let i = 0; i < files.length; i++) {
      progress[i].status = 'uploading'
      setUploadProgress([...progress])

      const uploadUrl = result.uploadUrls.find((u) => u.fileName === files[i].name)
      if (!uploadUrl) {
        progress[i].status = 'error'
        allUploaded = false
        continue
      }

      try {
        const response = await fetch(uploadUrl.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/pdf' },
          body: files[i],
        })
        if (!response.ok) throw new Error('Upload failed')
        progress[i].status = 'done'
      } catch {
        progress[i].status = 'error'
        allUploaded = false
      }

      setUploadProgress([...progress])
    }

    if (!allUploaded) {
      setError('Falha no upload de alguns arquivos. Tente novamente.')
      setIsSubmitting(false)
      return
    }

    const confirmResult = await confirmConsultationUpload(result.consultationId)

    if ('error' in confirmResult) {
      setError(confirmResult.error)
      setIsSubmitting(false)
      return
    }

    router.push(`/consultas/${result.consultationId}`)
  }, [canSubmit, selectedSpecialistId, patientContext, files, router])

  return (
    <div className="max-w-2xl space-y-8">
      <section>
        <h2 className="text-lg font-semibold mb-3">1. Envie seus exames</h2>
        <PdfDropzone files={files} onChange={setFiles} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">2. Conte sobre seu caso</h2>
        <PatientContextInput value={patientContext} onChange={setPatientContext} />
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">3. Escolha o especialista</h2>
        <SpecialistPicker
          specialists={specialists}
          selectedId={selectedSpecialistId}
          onSelect={setSelectedSpecialistId}
        />
      </section>

      {uploadProgress.length > 0 && (
        <div className="space-y-1">
          {uploadProgress.map((p) => (
            <div key={p.fileName} className="flex items-center gap-2 text-sm">
              <span
                className={
                  p.status === 'done'
                    ? 'text-success'
                    : p.status === 'error'
                      ? 'text-destructive'
                      : 'text-gray-400'
                }
              >
                {p.status === 'done'
                  ? '✓'
                  : p.status === 'error'
                    ? '✗'
                    : p.status === 'uploading'
                      ? '↑'
                      : '·'}
              </span>
              <span>{p.fileName}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
        {isSubmitting ? 'Enviando...' : 'Solicitar Segunda Opinião'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/consultation/consultation-form.tsx
git commit -m "feat: add ConsultationForm with patient context and Mastra-aware flow"
```

---

## Task 15: New Consultation Page

**Files:**
- Create: `app/(protected)/consultas/nova/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
import { createClient } from '@/lib/supabase/server'
import { ConsultationForm } from '@/components/consultation/consultation-form'

export default async function NovaConsultaPage() {
  const supabase = await createClient()

  const { data: specialists } = await supabase
    .from('specialists')
    .select('id, name, description, icon')
    .eq('active', true)
    .order('name')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Nova Consulta</h1>
      <ConsultationForm specialists={specialists ?? []} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(protected\)/consultas/nova/page.tsx
git commit -m "feat: add new consultation page at /consultas/nova"
```

---

## Task 16: Consultation Result and Live Status Components

**Files:**
- Create: `components/consultation/consultation-result.tsx`
- Create: `components/consultation/consultation-failed.tsx`
- Create: `components/consultation/consultation-status-live.tsx`
- Create: `__tests__/components/consultation/consultation-result.test.tsx`

- [ ] **Step 1: Implement `ConsultationResult`**

Create `components/consultation/consultation-result.tsx`:

```tsx
import type { ConsultationResult as Result } from '@/mastra/schemas/consultation-result'

const severityStyle: Record<Result['findings'][number]['severity'], string> = {
  info: 'bg-gray-100 text-gray-700',
  attention: 'bg-yellow-100 text-yellow-800',
  urgent: 'bg-red-100 text-red-800',
}

const severityLabel: Record<Result['findings'][number]['severity'], string> = {
  info: 'Informativo',
  attention: 'Atenção',
  urgent: 'Urgente',
}

const confidenceStyle: Record<Result['confidence'], string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-green-100 text-green-800',
}

const confidenceLabel: Record<Result['confidence'], string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
}

export function ConsultationResult({ result }: { result: Result }) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">Resumo</h2>
        <p className="whitespace-pre-wrap text-sm">{result.summary}</p>
      </section>

      {result.findings.length > 0 && (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Achados</h2>
          <ul className="space-y-3">
            {result.findings.map((f, i) => (
              <li key={i} className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{f.title}</p>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${severityStyle[f.severity]}`}
                  >
                    {severityLabel[f.severity]}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{f.detail}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">Análise</h2>
        <p className="whitespace-pre-wrap text-sm">{result.assessment}</p>
      </section>

      {result.recommendations.length > 0 && (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Recomendações</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </section>
      )}

      {result.questionsForDoctor.length > 0 && (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-3">Perguntas para o médico</h2>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {result.questionsForDoctor.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </section>
      )}

      {result.redFlags.length > 0 && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-sm font-medium text-red-800 mb-3">Sinais de alerta</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-red-900">
            {result.redFlags.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </section>
      )}

      <section className="flex items-center gap-2">
        <span className="text-sm text-gray-500">Confiança da análise:</span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${confidenceStyle[result.confidence]}`}>
          {confidenceLabel[result.confidence]}
        </span>
      </section>

      <p className="text-xs text-gray-500">{result.disclaimer}</p>
    </div>
  )
}
```

- [ ] **Step 2: Implement `ConsultationFailed`**

Create `components/consultation/consultation-failed.tsx`:

```tsx
'use client'

import { useTransition } from 'react'
import { AlertTriangle, RefreshCcw } from 'lucide-react'
import { retryConsultation } from '@/actions/consultation'
import { Button } from '@/components/ui/button'

type Props = {
  consultationId: string
  failureReason: string | null
}

export function ConsultationFailed({ consultationId, failureReason }: Props) {
  const [isPending, startTransition] = useTransition()

  const handleRetry = () => {
    startTransition(async () => {
      await retryConsultation(consultationId)
    })
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-red-700 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-red-900">Não conseguimos concluir a análise</p>
          <p className="text-sm text-red-800 mt-1">
            {failureReason ?? 'Algo deu errado durante o processamento.'}
          </p>
        </div>
      </div>
      <Button onClick={handleRetry} disabled={isPending} variant="outline">
        <RefreshCcw className="h-4 w-4 mr-2" />
        {isPending ? 'Reenviando...' : 'Tentar novamente'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 3: Implement `ConsultationStatusLive`** (Client Component)

Create `components/consultation/consultation-status-live.tsx`:

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { FileText, Loader2 } from 'lucide-react'
import {
  HeartPulse, Ribbon, Brain, Bone, ScanFace, Stethoscope, type LucideIcon,
} from 'lucide-react'
import { ConsultationResult } from './consultation-result'
import { ConsultationFailed } from './consultation-failed'
import type { ConsultationResult as Result } from '@/mastra/schemas/consultation-result'

const iconMap: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  ribbon: Ribbon,
  brain: Brain,
  bone: Bone,
  'scan-face': ScanFace,
  stethoscope: Stethoscope,
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguardando upload', color: 'bg-gray-100 text-gray-700' },
  processing: { label: 'Analisando seus exames…', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Concluída', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-800' },
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

  useEffect(() => {
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
          setConsultation((prev) => ({ ...prev, ...payload.new as Partial<ConsultationRow> }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initial.id])

  const specialist = Array.isArray(consultation.specialist)
    ? consultation.specialist[0]
    : consultation.specialist
  const Icon = iconMap[specialist?.icon ?? ''] ?? Stethoscope
  const status = statusConfig[consultation.status] ?? statusConfig.pending
  const date = new Date(consultation.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Consulta</h1>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${status.color}`}>
          {status.label}
        </span>
      </div>
      <p className="text-sm text-gray-500">{date}</p>

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">Especialista</h2>
        <div className="flex items-center gap-3">
          <Icon className="h-6 w-6 text-primary" />
          <span className="font-medium">{specialist?.name}</span>
        </div>
      </section>

      <section className="rounded-xl border p-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">
          Arquivos enviados ({consultation.files.length})
        </h2>
        <ul className="space-y-2">
          {consultation.files.map((file) => (
            <li key={file.id} className="flex items-center gap-3">
              <FileText className="h-4 w-4 text-gray-400" />
              <span className="text-sm">{file.file_name}</span>
              <span className="text-xs text-gray-400">{formatFileSize(file.file_size)}</span>
            </li>
          ))}
        </ul>
      </section>

      {consultation.patient_context && (
        <section className="rounded-xl border p-4">
          <h2 className="text-sm font-medium text-gray-500 mb-2">Contexto compartilhado</h2>
          <p className="text-sm whitespace-pre-wrap">{consultation.patient_context}</p>
        </section>
      )}

      {consultation.status === 'processing' && (
        <div className="flex items-center gap-3 rounded-xl border bg-blue-50 p-4 text-sm text-blue-900">
          <Loader2 className="h-4 w-4 animate-spin" />
          Analisando seus exames…
        </div>
      )}

      {consultation.status === 'completed' && consultation.result && (
        <ConsultationResult result={consultation.result} />
      )}

      {consultation.status === 'failed' && (
        <ConsultationFailed
          consultationId={consultation.id}
          failureReason={consultation.failure_reason}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 4: Tests for `ConsultationResult`**

Cover: each section renders; redFlags section hidden when empty; severity badges by class; confidence badge color.

- [ ] **Step 5: Commit**

```bash
git add components/consultation/ __tests__/components/consultation/consultation-result.test.tsx
git commit -m "feat: add live status, structured result, and failure components"
```

---

## Task 17: Consultation Status Page

**Files:**
- Create: `app/(protected)/consultas/[id]/page.tsx`

- [ ] **Step 1: Implement**

Server Component fetches the consultation + files via authenticated Supabase client (RLS), 404 on not found, then passes to `ConsultationStatusLive`.

```tsx
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { ConsultationStatusLive } from '@/components/consultation/consultation-status-live'

export default async function ConsultationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: consultation } = await supabase
    .from('consultations')
    .select('id, status, result, failure_reason, patient_context, created_at, specialist:specialists(name, icon)')
    .eq('id', id)
    .single()
  if (!consultation) notFound()

  const { data: files } = await supabase
    .from('consultation_files')
    .select('id, file_name, file_size')
    .eq('consultation_id', id)

  return (
    <div>
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>
      <ConsultationStatusLive initial={{ ...consultation, files: files ?? [] }} />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(protected\)/consultas/\[id\]/page.tsx
git commit -m "feat: add consultation status page with live updates"
```

---

## Task 18: Dashboard Consultation List

**Files:**
- Create: `components/dashboard/consultation-list.tsx`
- Modify: `app/(protected)/dashboard/page.tsx`

- [ ] **Step 1: Create the `ConsultationList` component**

```tsx
import Link from 'next/link'
import {
  HeartPulse, Ribbon, Brain, Bone, ScanFace, Stethoscope, ClipboardPlus,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const iconMap: Record<string, LucideIcon> = {
  'heart-pulse': HeartPulse,
  ribbon: Ribbon,
  brain: Brain,
  bone: Bone,
  'scan-face': ScanFace,
  stethoscope: Stethoscope,
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguardando upload', color: 'bg-gray-100 text-gray-700' },
  processing: { label: 'Em processamento', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Concluída', color: 'bg-green-100 text-green-800' },
  failed: { label: 'Falhou', color: 'bg-red-100 text-red-800' },
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
        <ClipboardPlus className="mx-auto h-12 w-12 text-gray-300 mb-4" />
        <p className="text-gray-500 mb-4">Você ainda não tem consultas</p>
        <Button asChild>
          <Link href="/consultas/nova">Criar sua primeira consulta</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {consultations.map((consultation) => {
        const specialist = Array.isArray(consultation.specialist)
          ? consultation.specialist[0]
          : consultation.specialist
        const Icon = iconMap[specialist?.icon ?? ''] ?? Stethoscope
        const status = statusConfig[consultation.status] ?? statusConfig.pending
        const date = new Date(consultation.created_at).toLocaleDateString('pt-BR')

        return (
          <Link
            key={consultation.id}
            href={`/consultas/${consultation.id}`}
            className="flex items-center gap-4 rounded-xl border p-4 hover:bg-gray-50 transition-colors"
          >
            <Icon className="h-6 w-6 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium">{specialist?.name}</p>
              <p className="text-xs text-gray-400">{date}</p>
            </div>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0 ${status.color}`}
            >
              {status.label}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Update the dashboard page**

Replace `app/(protected)/dashboard/page.tsx`:

```tsx
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ConsultationList } from '@/components/dashboard/consultation-list'
import { Button } from '@/components/ui/button'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: consultations } = await supabase
    .from('consultations')
    .select('id, status, created_at, specialist:specialists(name, icon)')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Minhas Consultas</h1>
        <Button asChild>
          <Link href="/consultas/nova">Nova Consulta</Link>
        </Button>
      </div>
      <ConsultationList consultations={consultations ?? []} />
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/consultation-list.tsx app/\(protected\)/dashboard/page.tsx
git commit -m "feat: add consultation list with failed status to dashboard"
```

---

## Task 19: Mastra Cloud Deployment Setup

**Files:**
- (Configuration only; no source files)

- [ ] **Step 1: Provision Mastra Cloud project**

- Connect the repo and point Mastra Cloud at the `mastra/` directory.
- Set env vars: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MASTRA_API_KEY`.

- [ ] **Step 2: Configure Vercel env vars**

- `MASTRA_URL` (the Mastra Cloud URL)
- `MASTRA_API_KEY` (same value as in Mastra)

- [ ] **Step 3: Verify auth middleware**

`curl -i ${MASTRA_URL}/api/workflows/consultationWorkflow/start-async -X POST` without bearer → expect `401`.

- [ ] **Step 4: Verify Mastra → Supabase write path**

Trigger a real workflow against staging Supabase and confirm `consultations.status` updates from `processing` → `completed` (or `failed`) via service-role.

---

## Task 20: Execução & Verificação

> **Esta task agrupa TODOS os comandos `npm`/`npx`/dev-server do plano.** Tasks anteriores (1–19) só escrevem código e fazem commits. Esta task será executada pelo dono em uma sessão separada (terminal próprio), não por agente automatizado.
>
> Pré-condições antes de começar: tasks 1–19 estão concluídas e commitadas; `.env.local` existe com `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `MASTRA_URL=http://localhost:4111`, `MASTRA_API_KEY=<dev-secret>`; `mastra/.env` existe com `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `MASTRA_API_KEY=<mesmo-dev-secret>`.

### Step 1: Instalar dependências

```bash
npm install @mastra/core @ai-sdk/anthropic zod
```

Esperado: `package.json` e `package-lock.json` atualizados.

### Step 2: Commit do lockfile

```bash
git add package.json package-lock.json
git commit -m "chore: add Mastra and Anthropic SDK dependencies"
```

### Step 3: Subir Supabase local e aplicar migration

```bash
npx supabase start
npx supabase migration up
```

Esperado: serviços do Supabase rodando localmente; migration `20260426000000_create_consultation_tables.sql` aplicada com tabelas, RLS, trigger, bucket `consultation-files`, publicação Realtime e seed data.

### Step 4: Reset do banco para validar idempotência da migration

```bash
npx supabase db reset
```

Esperado: banco resetado, migration reaplicada do zero, sem erro.

### Step 5: Rodar a suite completa de testes unitários

```bash
npx jest --verbose
```

Esperado: todos os testes passam — `route-access`, `lib/mastra/client`, `actions/consultation`, `mastra/agents/instructions` (snapshots criados na primeira rodada), `mastra/workflows/steps/run-specialist`, `pdf-dropzone`, `patient-context-input`, `specialist-picker`, `consultation-result`.

> Se `instructions` snapshots forem criados na primeira rodada, comitar:
> ```bash
> git add __tests__/mastra/agents/__snapshots__/
> git commit -m "test: snapshot specialist agent instructions"
> ```

### Step 6: Build do Next.js para validar compilação

```bash
npx next build
```

Esperado: build conclui sem erros TypeScript, lint warnings ou errors de Server/Client Components.

### Step 7: Iniciar o stack de dev em três terminais

Terminal 1 (Supabase, se ainda não estiver rodando do Step 3):
```bash
npx supabase start
```

Terminal 2 (Mastra):
```bash
npx mastra dev
```
Esperado: serviço sobe em `http://localhost:4111` com agentes e workflow registrados.

Terminal 3 (Next.js):
```bash
npx next dev
```
Esperado: app sobe em `http://localhost:3000`.

### Step 8: Smoke test manual end-to-end

Com os três processos rodando, executar o checklist abaixo no navegador:

1. Acessar `http://localhost:3000` → entrar com Google → dashboard mostra estado vazio
2. Clicar em "Criar sua primeira consulta"
3. Arrastar um PDF de exame de teste; remover e re-adicionar para validar
4. Digitar um contexto curto (ex.: "tenho sentido falta de ar")
5. Selecionar um especialista → clicar "Solicitar Segunda Opinião"
6. Verificar redirecionamento para `/consultas/[id]` com status `processing` e spinner azul
7. Aguardar 30–90s — status muda para `completed` via Realtime sem refresh; seções renderizam (Resumo, Achados com badges de severity, Análise, Recomendações, Perguntas, Sinais de alerta se houver, Confiança, Aviso)
8. Refresh manual da página — conteúdo persiste (lido do DB)
9. Voltar ao dashboard — consulta aparece na lista com badge verde
10. Forçar falha: parar o processo Mastra (Ctrl+C no terminal 2), criar nova consulta — verificar card vermelho com `failure_reason` + botão "Tentar novamente"
11. Reiniciar Mastra (`npx mastra dev`) e clicar "Tentar novamente" — fluxo recupera, status volta a `processing` e completa
12. Conferir sidebar: branding "Segunda Opinião", links "Minhas Consultas" + "Nova Consulta", botão "Sair"

### Step 9: Verificar Mastra Cloud (se já provisionado pela Task 19)

```bash
curl -i ${MASTRA_URL}/api/workflows/consultationWorkflow/start-async -X POST
```
Esperado: `HTTP/1.1 401 Unauthorized` (sem bearer).

```bash
curl -i ${MASTRA_URL}/api/workflows/consultationWorkflow/start-async \
  -X POST \
  -H "Authorization: Bearer ${MASTRA_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"inputData":{"consultationId":"<uuid-de-consulta-em-processing>"}}'
```
Esperado: `200 OK` com `{ "runId": "..." }` e workflow disparado.

### Step 10: Commit final se houver fixes do smoke test

```bash
git add -A
git commit -m "fix: smoke-test findings"
```

(Pular se nada foi ajustado.)
