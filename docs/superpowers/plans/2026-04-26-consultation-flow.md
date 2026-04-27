# Consultation Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

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
| `package.json` | Add Mastra + Anthropic deps; add `mastra` script for local dev |
| `.vercelignore` | Add `mastra/` so Vercel doesn't ship it |

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

- [ ] **Step 2: Apply the migration locally**

Run: `npx supabase migration up` (requires local Supabase running via `npx supabase start`)
Expected: Migration applied successfully, tables created, Realtime publication updated.

- [ ] **Step 3: Verify**

Run: `npx supabase db reset` (full reset to verify migration from scratch)
Expected: All tables, policies, triggers, bucket, Realtime publication, and seed data created.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260426000000_create_consultation_tables.sql
git commit -m "feat: add consultation tables, RLS, storage, Realtime, and seed data"
```

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

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest __tests__/lib/auth/route-access.test.ts --verbose`
Expected: 3 new tests FAIL.

- [ ] **Step 3: Update route-access.ts**

```ts
const PROTECTED_PREFIXES = ['/dashboard', '/consultas']
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest __tests__/lib/auth/route-access.test.ts --verbose`
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth/route-access.ts __tests__/lib/auth/route-access.test.ts
git commit -m "feat: protect /consultas routes behind authentication"
```

---

## Task 3: Sidebar and Layout Update

**Files:**
- Modify: `app/(protected)/layout.tsx`

- [ ] **Step 1: Update the protected layout**

Replace `app/(protected)/layout.tsx` with branding "Segunda Opinião", nav links "Minhas Consultas" + "Nova Consulta", logout button labeled "Sair". (See spec for exact markup; identical to the previous version of this plan.)

- [ ] **Step 2: Verify the app compiles**

Run: `npx next build`
Expected: No build errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/layout.tsx
git commit -m "feat: update sidebar with branding, navigation, and Portuguese labels"
```

---

## Task 4: Mastra Project Bootstrap

**Files:**
- Modify: `package.json` (add deps)
- Create: `.vercelignore`
- Create: `mastra/index.ts`
- Create: `mastra/lib/supabase-admin.ts`

- [ ] **Step 1: Install dependencies**

```bash
npm install @mastra/core @ai-sdk/anthropic zod
```

- [ ] **Step 2: Create `.vercelignore`**

```
mastra/
```

This prevents Vercel from including the Mastra service code in the Next.js build.

- [ ] **Step 3: Create `mastra/lib/supabase-admin.ts`**

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

- [ ] **Step 4: Create `mastra/index.ts` (skeleton — agents/workflow added in later tasks)**

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

- [ ] **Step 5: Verify Mastra dev server starts**

Run: `npx mastra dev`
Expected: Server starts on port 4111 (default), no agents/workflows registered yet (empty).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .vercelignore mastra/
git commit -m "feat: bootstrap Mastra service with auth middleware"
```

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

```ts
import { Mastra } from '@mastra/core'
import { agentsByKey } from './agents'

export const mastra = new Mastra({
  agents: agentsByKey,
  workflows: {},
  server: { /* same middleware as before */ },
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

- [ ] **Step 6: Run tests**

Run: `npx jest __tests__/mastra/agents/instructions.test.ts`
Expected: All snapshots created on first run.

- [ ] **Step 7: Commit**

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

- [ ] **Step 7: Run tests**

Run: `npx jest __tests__/mastra/workflows/steps/`
Expected: All tests PASS.

- [ ] **Step 8: Commit**

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

```ts
import { consultationWorkflow } from './workflows/consultation-workflow'

export const mastra = new Mastra({
  agents: agentsByKey,
  workflows: { consultationWorkflow },
  server: { /* unchanged */ },
})
```

- [ ] **Step 3: Smoke test the workflow locally**

Start `npx mastra dev` and POST manually (or via Mastra Playground) with a `consultationId` from a `processing` row in local Supabase. Confirm the workflow runs all 4 steps.

- [ ] **Step 4: Commit**

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

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/lib/mastra/client.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

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

- [ ] **Step 3: Run tests**

Run: `npx jest __tests__/actions/consultation.test.ts --verbose`
Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add actions/consultation.ts __tests__/actions/consultation.test.ts
git commit -m "feat: add server actions for consultation lifecycle and Mastra trigger"
```

---

## Task 11: PDF Dropzone Component

(Identical to the previous version of this plan — no Mastra-related changes.)

**Files:**
- Create: `components/consultation/pdf-dropzone.tsx`
- Create: `__tests__/components/consultation/pdf-dropzone.test.tsx`

Steps: write failing tests, implement, run tests, commit. (See spec for component contract.)

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

- [ ] **Step 3: Run tests, commit.**

```bash
git add components/consultation/patient-context-input.tsx __tests__/components/consultation/patient-context-input.test.tsx
git commit -m "feat: add optional patient context textarea with counter"
```

---

## Task 13: Specialist Picker Component

(Identical to the previous version of this plan — no Mastra-related changes.)

---

## Task 14: Consultation Form (Orchestrator)

**Files:**
- Create: `components/consultation/consultation-form.tsx`

The form now also wires `PatientContextInput` and forwards `patientContext` to `createConsultation`.

- [ ] **Step 1: Implement**

Compose `PdfDropzone`, `PatientContextInput`, `SpecialistPicker`. State: `files`, `patientContext`, `selectedSpecialistId`, `isSubmitting`, `error`, `uploadProgress`.

`handleSubmit` flow:
1. Call `createConsultation({ specialistId, patientContext: patientContext || undefined, files: files.map(f => ({ name: f.name, size: f.size })) })`
2. On error: surface message
3. Upload files to signed URLs (PUT, `Content-Type: application/pdf`)
4. Call `confirmConsultationUpload(consultationId)` — this also triggers Mastra
5. On error: surface message (failure_reason will already be set by the action)
6. `router.push(/consultas/${consultationId})`

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add components/consultation/consultation-form.tsx
git commit -m "feat: add ConsultationForm with patient context and Mastra-aware flow"
```

---

## Task 15: New Consultation Page

(Identical to previous version — `/consultas/nova` server component fetching specialists and rendering `<ConsultationForm specialists={...} />`.)

---

## Task 16: Consultation Result and Live Status Components

**Files:**
- Create: `components/consultation/consultation-result.tsx`
- Create: `components/consultation/consultation-failed.tsx`
- Create: `components/consultation/consultation-status-live.tsx`
- Create: `__tests__/components/consultation/consultation-result.test.tsx`

- [ ] **Step 1: Implement `ConsultationResult`**

Renders all sections of `ConsultationResult` schema:
- **Resumo:** `summary` (markdown — start with simple `whitespace-pre-wrap`, upgrade to a markdown component later)
- **Achados:** map `findings` to cards with severity badge (info=cinza, attention=amarelo, urgent=vermelho)
- **Análise:** `assessment` (markdown)
- **Recomendações:** `<ul>` of `recommendations`
- **Perguntas para o médico:** `<ul>` of `questionsForDoctor`
- **Sinais de alerta:** `<ul>` red of `redFlags` — hide section entirely if empty
- **Confiança:** `confidence` badge (low=cinza, medium=azul, high=verde)
- **Aviso:** `disclaimer` em `text-xs text-gray-500`

- [ ] **Step 2: Implement `ConsultationFailed`**

Card vermelho com `failure_reason` + botão "Tentar novamente" que invoca `retryConsultation` via Server Action e gerencia `isPending`.

- [ ] **Step 3: Implement `ConsultationStatusLive`** (Client Component)

```tsx
'use client'

import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
// types omitted for brevity

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
          setConsultation((prev) => ({ ...prev, ...payload.new }))
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [initial.id])

  // render branches by consultation.status: pending / processing / completed / failed
  // ...
}
```

- [ ] **Step 4: Tests for `ConsultationResult`**

Cover: each section renders; redFlags section hidden when empty; severity badges by class; confidence badge color.

- [ ] **Step 5: Run tests, commit.**

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

- [ ] **Step 2: Verify build**

Run: `npx next build`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add app/\(protected\)/consultas/\[id\]/page.tsx
git commit -m "feat: add consultation status page with live updates"
```

---

## Task 18: Dashboard Consultation List

**Files:**
- Create: `components/dashboard/consultation-list.tsx`
- Modify: `app/(protected)/dashboard/page.tsx`

Largely the same as the previous version of this plan, **plus** add `'failed'` to `statusConfig` (badge vermelho, "Falhou").

- [ ] Steps as before. Commit:

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

- [ ] **Step 4: Document the runbook in `docs/runbooks/mastra.md`** (out of scope to write here; placeholder note)

---

## Task 20: End-to-End Smoke Test

- [ ] **Step 1: Start local Supabase, Mastra, and Next.js**

```bash
npx supabase start
npx mastra dev    # in second terminal — uses .env with local Supabase service role
npx next dev       # in third terminal — uses .env with MASTRA_URL=http://localhost:4111
```

- [ ] **Step 2: Manual smoke checklist**

1. Sign in with Google → dashboard empty state
2. Click "Criar sua primeira consulta"
3. Drag/drop a sample medical PDF; remove and re-add to validate
4. Type a short context message
5. Select a specialist → submit
6. Watch the page redirect to `/consultas/[id]` with `processing` status
7. Within ~30–90s, status flips to `completed` via Realtime — result sections render
8. Refresh the page — content persists (read from DB)
9. Force a failure (e.g., set `MASTRA_URL` to a wrong port temporarily, retry) — verify `failed` card + retry button
10. Click "Tentar novamente" with proper Mastra running — flow recovers
11. Sidebar shows "Segunda Opinião", "Nova Consulta", "Sair"

- [ ] **Step 3: Fix issues; final commit if needed.**

```bash
git add -A
git commit -m "fix: smoke-test findings"
```
