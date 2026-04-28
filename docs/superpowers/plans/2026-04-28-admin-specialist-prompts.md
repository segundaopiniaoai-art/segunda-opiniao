# Admin Specialist Prompts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que admins editem o system prompt específico de cada especialista pela UI, com versionamento append-only, rollback fácil e registro de qual versão foi usada em cada consulta.

**Architecture:** Três migrations adicionam `specialist_prompt_versions` (append-only), `specialists.current_prompt_version_id` (ponteiro) e `consultations.prompt_version_id` (qual versão rodou). Uma RPC SQL atômica cria nova versão e atualiza o ponteiro em transação. Mastra constrói cada `Agent` com `instructions: async () => resolveSpecialistInstructions(key)` que lê `sharedGuidelines + content` do banco a cada `agent.generate()`. UI admin em `/admin/especialistas` lista especialistas e expõe editor com histórico e botão "Restaurar".

**Tech Stack:** Next.js 16 (App Router, Server Components + Server Actions), React 19, Supabase Postgres + Auth, Mastra `@mastra/core`, Jest, TypeScript.

**Spec:** `docs/superpowers/specs/2026-04-28-admin-specialist-prompts-design.md`

---

## File Structure

**Create:**
- `supabase/migrations/20260428200000_specialist_prompts.sql` — tabela de versões + colunas FK + policies
- `supabase/migrations/20260428210000_seed_specialist_prompts.sql` — seed com prompts atuais e ponteiro inicial
- `supabase/migrations/20260428220000_specialist_prompt_rpc.sql` — função `create_specialist_prompt_version`
- `mastra/src/mastra/agents/resolve-instructions.ts` — lê prompt do banco e concatena com `sharedGuidelines`
- `lib/admin/specialist-prompts.ts` — helpers de listagem/editor para a UI admin
- `app/(protected)/admin/especialistas/page.tsx` — lista
- `app/(protected)/admin/especialistas/[id]/page.tsx` — editor (server component)
- `app/(protected)/admin/especialistas/[id]/prompt-editor.tsx` — client component
- `app/(protected)/admin/especialistas/actions.ts` — server actions
- `__tests__/mastra/agents/resolve-instructions.test.ts`
- `__tests__/lib/admin/specialist-prompts.test.ts`
- `__tests__/app/admin/especialistas/actions.test.ts`
- `__tests__/admin/specialist-prompts.integration.test.ts`

**Modify:**
- `mastra/src/mastra/agents/cardiology.ts` — `instructions` vira função
- `mastra/src/mastra/agents/oncology.ts` — idem
- `mastra/src/mastra/agents/neurology.ts` — idem
- `mastra/src/mastra/agents/orthopedics.ts` — idem
- `mastra/src/mastra/agents/dermatology.ts` — idem
- `mastra/src/mastra/agents/general-practice.ts` — idem
- `mastra/src/mastra/workflows/steps/run-specialist.ts` — adiciona `promptVersionId` no output
- `mastra/src/mastra/workflows/steps/persist-result.ts` — escreve `prompt_version_id`
- `__tests__/mastra/agents/instructions.test.ts` — refeito (sem snapshot estático; agora valida estrutura e mock de DB)
- `__tests__/mastra/agents/__snapshots__/instructions.test.ts.snap` — deletar
- `__tests__/mastra/workflows/steps/run-specialist.test.ts` — adiciona caso para `promptVersionId`
- `__tests__/mastra/workflows/steps/persist-result.test.ts` — adiciona caso para `prompt_version_id`
- `components/layout/collapsible-sidebar.tsx` — sub-item "Especialistas"

**Notas globais:**
- Reutilizamos o helper SQL `is_admin()` que já existe (migration `20260428000000_admin_read_policies.sql`) em vez de inlinear `select 1 from profiles where role='admin'`. A spec usa o inline; o plano prefere `is_admin()` para coerência com o resto do projeto.
- O Next.js side usa o cliente autenticado por usuário (`@/lib/supabase/server`); RLS gera o gate de admin. Service role só é usado pelo Mastra.
- A spec menciona exibir o autor (email) na UI. Verificado: `profiles` não tem coluna `email` (vive em `auth.users`). Para evitar uma migration extra, **v1 não exibe autor** — `created_by` é gravado no banco normalmente, mas a UI mostra só data/hora. Exibição do autor fica como follow-up (junto com adicionar `profiles.email` ou view).

---

## Task 1: Migration — schema + colunas FK + policies

**Files:**
- Create: `supabase/migrations/20260428200000_specialist_prompts.sql`

- [ ] **Step 1: Criar a migration**

Conteúdo exato:

```sql
-- specialist_prompt_versions: tabela append-only
create table public.specialist_prompt_versions (
  id uuid primary key default gen_random_uuid(),
  specialist_id uuid not null references public.specialists(id) on delete cascade,
  version_number integer not null,
  content text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (specialist_id, version_number)
);

create index specialist_prompt_versions_specialist_idx
  on public.specialist_prompt_versions (specialist_id, version_number desc);

alter table public.specialist_prompt_versions enable row level security;

create policy "Admins read prompt versions"
  on public.specialist_prompt_versions for select
  using (public.is_admin());

create policy "Admins insert prompt versions"
  on public.specialist_prompt_versions for insert
  with check (public.is_admin());

-- ponteiro para a versão ativa em specialists
alter table public.specialists
  add column current_prompt_version_id uuid
  references public.specialist_prompt_versions(id) on delete restrict;

create policy "Admins update specialists"
  on public.specialists for update
  using (public.is_admin());

-- consultations registra a versão usada
alter table public.consultations
  add column prompt_version_id uuid
  references public.specialist_prompt_versions(id) on delete restrict;
```

- [ ] **Step 2: Aplicar localmente**

Run: `npx supabase db reset`
Expected: termina com "Finished supabase db reset". Sem erros. (Inicie o Supabase com `npx supabase start` se necessário.)

- [ ] **Step 3: Verificar manualmente no Studio**

Abra `http://localhost:54323` → SQL editor:

```sql
-- deve listar a nova tabela e a coluna FK em specialists
select column_name from information_schema.columns
  where table_name = 'specialists' and column_name = 'current_prompt_version_id';
select column_name from information_schema.columns
  where table_name = 'consultations' and column_name = 'prompt_version_id';
```

Expected: cada query devolve uma linha.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428200000_specialist_prompts.sql
git commit -m "feat(supabase): add specialist_prompt_versions schema"
```

---

## Task 2: Migration — seed dos prompts atuais

**Files:**
- Create: `supabase/migrations/20260428210000_seed_specialist_prompts.sql`

- [ ] **Step 1: Criar a migration com o conteúdo dos prompts existentes**

Texto copiado verbatim de `mastra/src/mastra/agents/<specialty>.ts` (sem o `sharedGuidelines`).

```sql
insert into public.specialist_prompt_versions (specialist_id, version_number, content)
select s.id, 1, v.content
from public.specialists s
join (values
  ('cardiology', $$Você é um cardiologista experiente.

Áreas de atenção típicas: ECG, ecocardiograma, holter, MAPA, perfil lipídico, troponina,
sinais de IAM, IC, arritmias, HAS, valvopatias.

Ao analisar exames cardiológicos, considere comorbidades comuns
(diabetes, dislipidemia, tabagismo) ao calibrar recomendações.$$),
  ('oncology', $$Você é um oncologista experiente.

Áreas de atenção típicas: biópsia, imuno-histoquímica, PET-CT, TC de tórax/abdome/pelve,
marcadores tumorais (CEA, CA-125, CA 19-9, PSA), hemograma completo, estadiamento TNM.

Ao avaliar resultados oncológicos, considere o estadiamento atual e possíveis interações
entre quimioterápicos e comorbidades como insuficiência renal ou hepática.
Alertar para sinais de progressão ou toxicidade ao tratamento.$$),
  ('neurology', $$Você é um neurologista experiente.

Áreas de atenção típicas: RM de crânio, TC de crânio, EEG, EMG, velocidade de condução nervosa,
líquor (LCR), AVC, epilepsia, cefaleia, demência, esclerose múltipla, neuropatias periféricas.

Ao analisar exames neurológicos, diferencie achados agudos (AVC, crise epiléptica) de crônicos
(desmielinização, atrofia cortical) e ajuste a urgência da recomendação conforme o quadro clínico.$$),
  ('orthopedics', $$Você é um ortopedista experiente.

Áreas de atenção típicas: radiografia óssea, RM de coluna e articulações, TC de coluna,
densitometria óssea, ultrassom musculoesquelético, fraturas, osteoartrite, hérnia de disco,
lesões ligamentares e meniscais, osteoporose.

Ao interpretar exames ortopédicos, correlacione achados de imagem com a funcionalidade
relatada pelo paciente e considere a progressão natural da doença ao recomendar intervenção
conservadora ou cirúrgica.$$),
  ('dermatology', $$Você é um dermatologista experiente.

Áreas de atenção típicas: biópsia de pele, dermatoscopia, histopatológico cutâneo,
VDRL, FAN, exame micológico direto, melanoma, carcinoma basocelular, psoríase, dermatite atópica.

Ao avaliar lesões cutâneas, aplique critérios ABCDE para suspeita de malignidade e considere
fotótipos de Fitzpatrick e exposição solar crônica ao estratificar risco oncológico.
Mencionar limitações quando laudos descrevem lesões sem imagem disponível.$$),
  ('general_practice', $$Você é um clínico geral experiente.

Áreas de atenção típicas: hemograma, glicemia, HbA1c, perfil lipídico, função renal (creatinina, ureia),
função hepática (TGO, TGP), TSH, T4 livre, urina tipo I, pressão arterial, rastreamento preventivo.

Ao sintetizar múltiplos exames laboratoriais, priorize alterações que representem risco cardiovascular,
metabólico ou infeccioso imediato e indique encaminhamento para especialista quando um achado
ultrapassar o escopo da atenção primária.$$)
) as v(agent_key, content) on v.agent_key = s.agent_key;

update public.specialists s
set current_prompt_version_id = (
  select id from public.specialist_prompt_versions
  where specialist_id = s.id and version_number = 1
);

alter table public.specialists
  alter column current_prompt_version_id set not null;
```

⚠️ **Antes de salvar:** abra cada `mastra/src/mastra/agents/<specialty>.ts` e confira que o texto entre `$$...$$` é idêntico à parte que vem **depois** do `sharedGuidelines` no template literal (sem `${sharedGuidelines}\n\n`). Pequenas diferenças causam regressão silenciosa.

- [ ] **Step 2: Aplicar e validar**

Run: `npx supabase db reset`
Expected: sucesso. Em seguida no Studio:

```sql
select s.agent_key, v.version_number, length(v.content) as content_len
from public.specialists s
join public.specialist_prompt_versions v on v.id = s.current_prompt_version_id
order by s.agent_key;
```

Expected: 6 linhas, todas com `version_number = 1` e `content_len > 200`.

- [ ] **Step 3: Verificar a invariante NOT NULL**

```sql
select count(*) from public.specialists where current_prompt_version_id is null;
```

Expected: `0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260428210000_seed_specialist_prompts.sql
git commit -m "feat(supabase): seed specialist prompt versions from agent files"
```

---

## Task 3: Migration — RPC `create_specialist_prompt_version`

**Files:**
- Create: `supabase/migrations/20260428220000_specialist_prompt_rpc.sql`

- [ ] **Step 1: Criar a migration**

```sql
create or replace function public.create_specialist_prompt_version(
  p_specialist_id uuid,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next_version int;
  v_new_id uuid;
begin
  if not public.is_admin() then
    raise exception 'unauthorized';
  end if;

  if p_content is null or length(trim(p_content)) = 0 then
    raise exception 'content is required';
  end if;

  select coalesce(max(version_number), 0) + 1
    into v_next_version
    from public.specialist_prompt_versions
   where specialist_id = p_specialist_id;

  insert into public.specialist_prompt_versions
    (specialist_id, version_number, content, created_by)
    values (p_specialist_id, v_next_version, p_content, auth.uid())
  returning id into v_new_id;

  update public.specialists
     set current_prompt_version_id = v_new_id
   where id = p_specialist_id;

  return v_new_id;
end;
$$;
```

- [ ] **Step 2: Aplicar e validar**

Run: `npx supabase db reset`
Expected: sucesso.

No Studio (sem auth context, deve falhar com 'unauthorized'):

```sql
select public.create_specialist_prompt_version(
  (select id from public.specialists where agent_key = 'cardiology'),
  'teste'
);
```

Expected: `ERROR: unauthorized`. (Confirma o guard. O caminho feliz é coberto pelo integration test.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260428220000_specialist_prompt_rpc.sql
git commit -m "feat(supabase): add create_specialist_prompt_version RPC"
```

---

## Task 4: Mastra — `resolveSpecialistInstructions`

**Files:**
- Create: `mastra/src/mastra/agents/resolve-instructions.ts`
- Test: `__tests__/mastra/agents/resolve-instructions.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

Arquivo: `__tests__/mastra/agents/resolve-instructions.test.ts`

```ts
const mockSingle = jest.fn()
const mockEq = jest.fn(() => ({ single: mockSingle }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))

jest.mock('@/mastra/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { resolveSpecialistInstructions } from '@/mastra/agents/resolve-instructions'
import { sharedGuidelines } from '@/mastra/agents/shared'

describe('resolveSpecialistInstructions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('concatena sharedGuidelines + conteúdo da versão atual', async () => {
    mockSingle.mockResolvedValue({
      data: { current_prompt_version: { content: 'Você é um cardiologista de teste.' } },
      error: null,
    })

    const result = await resolveSpecialistInstructions('cardiology')

    expect(result).toBe(`${sharedGuidelines}\n\nVocê é um cardiologista de teste.`)
    expect(mockFrom).toHaveBeenCalledWith('specialists')
    expect(mockEq).toHaveBeenCalledWith('agent_key', 'cardiology')
  })

  it('lança erro descritivo quando o especialista não existe', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } })

    await expect(resolveSpecialistInstructions('unknown')).rejects.toThrow(
      /Falha ao carregar prompt do especialista unknown/,
    )
  })

  it('lança erro quando current_prompt_version_id é nulo (regressão)', async () => {
    mockSingle.mockResolvedValue({ data: { current_prompt_version: null }, error: null })

    await expect(resolveSpecialistInstructions('cardiology')).rejects.toThrow(
      /sem versão ativa/,
    )
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- resolve-instructions`
Expected: FAIL ("Cannot find module" do `resolve-instructions`).

- [ ] **Step 3: Implementar o módulo**

Arquivo: `mastra/src/mastra/agents/resolve-instructions.ts`

```ts
import { supabaseAdmin } from '../lib/supabase-admin'
import { sharedGuidelines } from './shared'

export async function resolveSpecialistInstructions(agentKey: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('specialists')
    .select('current_prompt_version:specialist_prompt_versions!current_prompt_version_id(content)')
    .eq('agent_key', agentKey)
    .single()

  if (error || !data?.current_prompt_version?.content) {
    throw new Error(
      `Falha ao carregar prompt do especialista ${agentKey}: ${error?.message ?? 'sem versão ativa'}`,
    )
  }

  return `${sharedGuidelines}\n\n${data.current_prompt_version.content}`
}
```

- [ ] **Step 4: Rodar e confirmar passar**

Run: `npm test -- resolve-instructions`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add mastra/src/mastra/agents/resolve-instructions.ts __tests__/mastra/agents/resolve-instructions.test.ts
git commit -m "feat(mastra): add resolveSpecialistInstructions DB loader"
```

---

## Task 5: Refatorar os 6 agentes para usar `resolveSpecialistInstructions`

**Files:**
- Modify: `mastra/src/mastra/agents/cardiology.ts`
- Modify: `mastra/src/mastra/agents/oncology.ts`
- Modify: `mastra/src/mastra/agents/neurology.ts`
- Modify: `mastra/src/mastra/agents/orthopedics.ts`
- Modify: `mastra/src/mastra/agents/dermatology.ts`
- Modify: `mastra/src/mastra/agents/general-practice.ts`
- Delete: `__tests__/mastra/agents/__snapshots__/instructions.test.ts.snap`
- Modify: `__tests__/mastra/agents/instructions.test.ts`

- [ ] **Step 1: Refatorar `cardiology.ts`**

Conteúdo final:

```ts
import { Agent } from '@mastra/core/agent'
import { specialistModel } from './shared'
import { resolveSpecialistInstructions } from './resolve-instructions'

export const cardiology = new Agent({
  id: 'cardiology',
  name: 'cardiology',
  instructions: async () => resolveSpecialistInstructions('cardiology'),
  model: specialistModel,
})
```

- [ ] **Step 2: Repetir o mesmo padrão para os outros 5**

`oncology.ts`, `neurology.ts`, `orthopedics.ts`, `dermatology.ts`, `general-practice.ts`. Cada um troca o template literal de `instructions` por `async () => resolveSpecialistInstructions('<agent_key>')`. O `id`/`name` não muda. Para `general-practice.ts` o agent_key continua `'general_practice'` (note o underline; bate com `agent_key` no banco).

- [ ] **Step 3: Reescrever `instructions.test.ts`**

O snapshot estático não funciona mais (instructions vão ao banco). Substituir por teste que valida a estrutura — usando o mesmo mock do Task 4.

```ts
const mockSingle = jest.fn()
const mockEq = jest.fn(() => ({ single: mockSingle }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))

jest.mock('@/mastra/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}))

import { agentsByKey } from '@/mastra/agents'
import { sharedGuidelines } from '@/mastra/agents/shared'

describe('cada agente especialista resolve instructions via DB', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSingle.mockResolvedValue({
      data: { current_prompt_version: { content: 'TEST PROMPT' } },
      error: null,
    })
  })

  for (const [key, agent] of Object.entries(agentsByKey)) {
    it(`${key} concatena sharedGuidelines com conteúdo do banco`, async () => {
      const instructions = await agent.getInstructions()
      expect(instructions).toBe(`${sharedGuidelines}\n\nTEST PROMPT`)
      expect(mockEq).toHaveBeenCalledWith('agent_key', key)
    })
  }
})
```

- [ ] **Step 4: Apagar a pasta de snapshot**

Run: `rm -rf __tests__/mastra/agents/__snapshots__`
Expected: pasta removida (Windows: `rm -r -fo` no PowerShell ou via Explorer).

- [ ] **Step 5: Rodar a suíte de agents**

Run: `npm test -- mastra/agents`
Expected: PASS para `resolve-instructions.test.ts` e `instructions.test.ts` (6 casos no segundo).

- [ ] **Step 6: Commit**

```bash
git add mastra/src/mastra/agents/ __tests__/mastra/agents/
git commit -m "refactor(mastra): load specialist prompts from DB at runtime"
```

---

## Task 6: `runSpecialist` — adicionar `promptVersionId` ao output

**Files:**
- Modify: `mastra/src/mastra/workflows/steps/run-specialist.ts`
- Test: `__tests__/mastra/workflows/steps/run-specialist.test.ts`

- [ ] **Step 1: Atualizar o teste — adicionar mock do supabaseAdmin e caso novo**

Adicionar no topo de `run-specialist.test.ts`:

```ts
const mockSingle = jest.fn()
const mockEq = jest.fn(() => ({ single: mockSingle }))
const mockSelect = jest.fn(() => ({ eq: mockEq }))
const mockFrom = jest.fn(() => ({ select: mockSelect }))
jest.mock('@/mastra/lib/supabase-admin', () => ({
  supabaseAdmin: { from: (...args: unknown[]) => mockFrom(...args) },
}))
```

Em `beforeEach`:

```ts
mockSingle.mockResolvedValue({
  data: { current_prompt_version_id: 'pv-123' },
  error: null,
})
```

E novo caso:

```ts
it('inclui promptVersionId no output, lido do specialists pelo agent_key', async () => {
  mockGenerate.mockResolvedValue({ object: minimalResult, usage: { inputTokens: 100, outputTokens: 50 } })

  const result = await execute(baseInput)

  expect(mockFrom).toHaveBeenCalledWith('specialists')
  expect(mockEq).toHaveBeenCalledWith('agent_key', 'cardiology')
  expect(result.promptVersionId).toBe('pv-123')
})
```

Atualizar os asserts existentes em `result` (linha que usa `toEqual(...)`) para incluir `promptVersionId: 'pv-123'`.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- run-specialist`
Expected: FAIL (sem `promptVersionId` no output).

- [ ] **Step 3: Modificar `run-specialist.ts`**

No `outputSchema`, adicionar:

```ts
promptVersionId: z.string().uuid(),
```

Antes do `agent.generate(...)`, adicionar:

```ts
const { data: specialist, error: specialistErr } = await supabaseAdmin
  .from('specialists')
  .select('current_prompt_version_id')
  .eq('agent_key', inputData.agentKey)
  .single()
if (specialistErr || !specialist?.current_prompt_version_id) {
  throw new Error(`Especialista não encontrado ou sem versão ativa: ${inputData.agentKey}`)
}
```

E adicionar ao `return`:

```ts
promptVersionId: specialist.current_prompt_version_id,
```

Adicionar o import no topo:

```ts
import { supabaseAdmin } from '../../lib/supabase-admin'
```

- [ ] **Step 4: Rodar e confirmar passar**

Run: `npm test -- run-specialist`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mastra/src/mastra/workflows/steps/run-specialist.ts __tests__/mastra/workflows/steps/run-specialist.test.ts
git commit -m "feat(mastra): track current prompt version in runSpecialist output"
```

---

## Task 7: `persistResult` — gravar `prompt_version_id` na consulta

**Files:**
- Modify: `mastra/src/mastra/workflows/steps/persist-result.ts`
- Test: `__tests__/mastra/workflows/steps/persist-result.test.ts`

- [ ] **Step 1: Atualizar o teste**

Em `persist-result.test.ts`, no input usado, adicionar `promptVersionId: 'pv-123'`. No assert do `update(...)` payload, adicionar `prompt_version_id: 'pv-123'`. Adicionar (se já não existe) caso garantindo que o campo é passado adiante.

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- persist-result`
Expected: FAIL (campo não passado).

- [ ] **Step 3: Modificar `persist-result.ts`**

No `inputSchema`, adicionar:

```ts
promptVersionId: z.string().uuid(),
```

No payload do `.update({...})`, adicionar:

```ts
prompt_version_id: inputData.promptVersionId,
```

- [ ] **Step 4: Rodar e confirmar passar**

Run: `npm test -- persist-result`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mastra/src/mastra/workflows/steps/persist-result.ts __tests__/mastra/workflows/steps/persist-result.test.ts
git commit -m "feat(mastra): persist prompt_version_id on consultation"
```

---

## Task 8: Helper de leitura para a UI admin

**Files:**
- Create: `lib/admin/specialist-prompts.ts`
- Test: `__tests__/lib/admin/specialist-prompts.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

Arquivo: `__tests__/lib/admin/specialist-prompts.test.ts`

```ts
import {
  listSpecialistsWithCurrentVersion,
  getSpecialistEditorData,
} from '@/lib/admin/specialist-prompts'

type Builder = {
  select: jest.Mock
  eq: jest.Mock
  order: jest.Mock
  single: jest.Mock
}

function makeBuilder(): Builder {
  const builder: Partial<Builder> = {}
  builder.select = jest.fn(() => builder as Builder)
  builder.eq = jest.fn(() => builder as Builder)
  builder.order = jest.fn(() => builder as Builder)
  builder.single = jest.fn()
  return builder as Builder
}

describe('listSpecialistsWithCurrentVersion', () => {
  it('retorna nome, agent_key, versão atual e timestamp', async () => {
    const b = makeBuilder()
    b.order.mockResolvedValue({
      data: [
        {
          id: 's1', name: 'Cardiologista', agent_key: 'cardiology',
          current_prompt_version: {
            version_number: 3,
            created_at: '2026-04-25T10:00:00Z',
          },
        },
      ],
      error: null,
    })
    const supabase = { from: jest.fn(() => b) } as never

    const result = await listSpecialistsWithCurrentVersion(supabase)

    expect(supabase.from).toHaveBeenCalledWith('specialists')
    expect(result).toEqual([
      {
        id: 's1', name: 'Cardiologista', agentKey: 'cardiology',
        currentVersionNumber: 3,
        currentVersionCreatedAt: '2026-04-25T10:00:00Z',
      },
    ])
  })
})

describe('getSpecialistEditorData', () => {
  it('retorna especialista + lista de versões ordenada desc', async () => {
    const sBuilder = makeBuilder()
    sBuilder.single.mockResolvedValue({
      data: { id: 's1', name: 'Cardiologista', agent_key: 'cardiology', current_prompt_version_id: 'v3' },
      error: null,
    })
    const vBuilder = makeBuilder()
    vBuilder.order.mockResolvedValue({
      data: [
        { id: 'v3', version_number: 3, content: 'c3', created_at: 't3' },
        { id: 'v2', version_number: 2, content: 'c2', created_at: 't2' },
        { id: 'v1', version_number: 1, content: 'c1', created_at: 't1' },
      ],
      error: null,
    })
    const from = jest.fn().mockImplementation((table: string) => {
      if (table === 'specialists') return sBuilder
      if (table === 'specialist_prompt_versions') return vBuilder
      throw new Error(`unexpected table ${table}`)
    })
    const supabase = { from } as never

    const result = await getSpecialistEditorData(supabase, 's1')

    expect(result.specialist.id).toBe('s1')
    expect(result.specialist.currentVersionId).toBe('v3')
    expect(result.versions).toHaveLength(3)
    expect(result.versions[0]).toEqual({
      id: 'v3', versionNumber: 3, content: 'c3', createdAt: 't3',
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- specialist-prompts`
Expected: FAIL ("Cannot find module").

- [ ] **Step 3: Implementar o helper**

Arquivo: `lib/admin/specialist-prompts.ts`

```ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type SpecialistRow = {
  id: string
  name: string
  agentKey: string
  currentVersionNumber: number | null
  currentVersionCreatedAt: string | null
}

export type EditorVersion = {
  id: string
  versionNumber: number
  content: string
  createdAt: string
}

export type EditorData = {
  specialist: { id: string; name: string; agentKey: string; currentVersionId: string }
  versions: EditorVersion[]
}

export async function listSpecialistsWithCurrentVersion(
  supabase: SupabaseClient,
): Promise<SpecialistRow[]> {
  const { data, error } = await supabase
    .from('specialists')
    .select(`
      id, name, agent_key,
      current_prompt_version:specialist_prompt_versions!current_prompt_version_id(
        version_number,
        created_at
      )
    `)
    .order('name', { ascending: true })

  if (error) throw error

  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    agentKey: row.agent_key,
    currentVersionNumber: row.current_prompt_version?.version_number ?? null,
    currentVersionCreatedAt: row.current_prompt_version?.created_at ?? null,
  }))
}

export async function getSpecialistEditorData(
  supabase: SupabaseClient,
  specialistId: string,
): Promise<EditorData> {
  const { data: s, error: sErr } = await supabase
    .from('specialists')
    .select('id, name, agent_key, current_prompt_version_id')
    .eq('id', specialistId)
    .single()
  if (sErr || !s) throw sErr ?? new Error('specialist not found')

  const { data: versions, error: vErr } = await supabase
    .from('specialist_prompt_versions')
    .select('id, version_number, content, created_at')
    .eq('specialist_id', specialistId)
    .order('version_number', { ascending: false })
  if (vErr) throw vErr

  return {
    specialist: {
      id: s.id,
      name: s.name,
      agentKey: s.agent_key,
      currentVersionId: s.current_prompt_version_id,
    },
    versions: (versions ?? []).map((v: any) => ({
      id: v.id,
      versionNumber: v.version_number,
      content: v.content,
      createdAt: v.created_at,
    })),
  }
}
```

- [ ] **Step 4: Rodar e confirmar passar**

Run: `npm test -- specialist-prompts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/specialist-prompts.ts __tests__/lib/admin/specialist-prompts.test.ts
git commit -m "feat(admin): add specialist-prompts read helpers"
```

---

## Task 9: Server actions (`saveNewVersion`, `restoreVersion`)

**Files:**
- Create: `app/(protected)/admin/especialistas/actions.ts`
- Test: `__tests__/app/admin/especialistas/actions.test.ts`

- [ ] **Step 1: Escrever o teste falhando**

Arquivo: `__tests__/app/admin/especialistas/actions.test.ts`

```ts
const mockGetUser = jest.fn()
const mockProfileSingle = jest.fn()
const mockVersionSingle = jest.fn()
const mockRpc = jest.fn()

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: mockGetUser },
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'profiles') {
        return { select: () => ({ eq: () => ({ single: mockProfileSingle }) }) }
      }
      if (table === 'specialist_prompt_versions') {
        return { select: () => ({ eq: () => ({ single: mockVersionSingle }) }) }
      }
      throw new Error(`unexpected table ${table}`)
    }),
    rpc: (...args: unknown[]) => mockRpc(...args),
  }),
}))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { saveNewVersion, restoreVersion } from '@/app/(protected)/admin/especialistas/actions'

beforeEach(() => {
  jest.clearAllMocks()
  mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } } })
  mockProfileSingle.mockResolvedValue({ data: { role: 'admin' } })
  mockRpc.mockResolvedValue({ error: null })
})

describe('saveNewVersion', () => {
  it('rejeita usuário não autenticado', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } })
    await expect(saveNewVersion('s1', 'novo')).rejects.toThrow('unauthorized')
  })

  it('rejeita usuário não-admin', async () => {
    mockProfileSingle.mockResolvedValue({ data: { role: 'patient' } })
    await expect(saveNewVersion('s1', 'novo')).rejects.toThrow('unauthorized')
  })

  it('rejeita conteúdo vazio', async () => {
    await expect(saveNewVersion('s1', '   ')).rejects.toThrow('content is required')
  })

  it('chama RPC com content trimmed', async () => {
    await saveNewVersion('s1', '  novo conteúdo  ')
    expect(mockRpc).toHaveBeenCalledWith('create_specialist_prompt_version', {
      p_specialist_id: 's1',
      p_content: 'novo conteúdo',
    })
  })
})

describe('restoreVersion', () => {
  it('rejeita usuário não-admin', async () => {
    mockProfileSingle.mockResolvedValue({ data: { role: 'patient' } })
    await expect(restoreVersion('s1', 'v1')).rejects.toThrow('unauthorized')
  })

  it('rejeita versão pertencente a outro especialista', async () => {
    mockVersionSingle.mockResolvedValue({
      data: { content: 'x', specialist_id: 'OUTRO' },
      error: null,
    })
    await expect(restoreVersion('s1', 'v1')).rejects.toThrow('mismatch')
  })

  it('cria nova versão com o conteúdo da versão alvo', async () => {
    mockVersionSingle.mockResolvedValue({
      data: { content: 'velho conteúdo', specialist_id: 's1' },
      error: null,
    })
    await restoreVersion('s1', 'v1')
    expect(mockRpc).toHaveBeenCalledWith('create_specialist_prompt_version', {
      p_specialist_id: 's1',
      p_content: 'velho conteúdo',
    })
  })
})
```

- [ ] **Step 2: Rodar e confirmar falha**

Run: `npm test -- especialistas/actions`
Expected: FAIL.

- [ ] **Step 3: Implementar `actions.ts`**

Arquivo: `app/(protected)/admin/especialistas/actions.ts`

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('unauthorized')
  return supabase
}

export async function saveNewVersion(specialistId: string, content: string): Promise<void> {
  const supabase = await assertAdmin()
  const trimmed = content.trim()
  if (!trimmed) throw new Error('content is required')

  const { error } = await supabase.rpc('create_specialist_prompt_version', {
    p_specialist_id: specialistId,
    p_content: trimmed,
  })
  if (error) throw error
  revalidatePath(`/admin/especialistas/${specialistId}`)
}

export async function restoreVersion(specialistId: string, versionId: string): Promise<void> {
  const supabase = await assertAdmin()

  const { data: target, error } = await supabase
    .from('specialist_prompt_versions')
    .select('content, specialist_id')
    .eq('id', versionId)
    .single()
  if (error || !target) throw new Error('version not found')
  if (target.specialist_id !== specialistId) throw new Error('mismatch')

  const { error: rpcErr } = await supabase.rpc('create_specialist_prompt_version', {
    p_specialist_id: specialistId,
    p_content: target.content,
  })
  if (rpcErr) throw rpcErr
  revalidatePath(`/admin/especialistas/${specialistId}`)
}
```

- [ ] **Step 4: Rodar e confirmar passar**

Run: `npm test -- especialistas/actions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/(protected)/admin/especialistas/actions.ts __tests__/app/admin/especialistas/actions.test.ts
git commit -m "feat(admin): add saveNewVersion and restoreVersion server actions"
```

---

## Task 10: Página de listagem `/admin/especialistas`

**Files:**
- Create: `app/(protected)/admin/especialistas/page.tsx`

- [ ] **Step 1: Implementar a página**

```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { listSpecialistsWithCurrentVersion } from '@/lib/admin/specialist-prompts'

export default async function AdminEspecialistasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const rows = await listSpecialistsWithCurrentVersion(supabase)

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl md:text-3xl font-bold">Especialistas</h1>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3 font-medium">Especialista</th>
              <th className="text-left px-4 py-3 font-medium">Versão atual</th>
              <th className="text-left px-4 py-3 font-medium">Atualizado em</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{row.name}</td>
                <td className="px-4 py-3">v{row.currentVersionNumber ?? '?'}</td>
                <td className="px-4 py-3">
                  {row.currentVersionCreatedAt
                    ? new Date(row.currentVersionCreatedAt).toLocaleDateString('pt-BR')
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/especialistas/${row.id}`}
                    className="text-primary hover:underline"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Smoke test manual**

Run: `npm run dev`
Logue como admin, abra `http://localhost:3000/admin/especialistas`. Deve listar 6 especialistas, todos com `v1`. Logue como não-admin → redireciona para `/dashboard`.

- [ ] **Step 3: Commit**

```bash
git add app/(protected)/admin/especialistas/page.tsx
git commit -m "feat(admin): add specialists listing page"
```

---

## Task 11: Editor `/admin/especialistas/[id]` + client component

**Files:**
- Create: `app/(protected)/admin/especialistas/[id]/page.tsx`
- Create: `app/(protected)/admin/especialistas/[id]/prompt-editor.tsx`

- [ ] **Step 1: Implementar a server page**

```tsx
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSpecialistEditorData } from '@/lib/admin/specialist-prompts'
import { PromptEditor } from './prompt-editor'

export default async function AdminEspecialistaEditorPage(
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  let data
  try {
    data = await getSpecialistEditorData(supabase, id)
  } catch {
    notFound()
  }

  const current = data.versions.find((v) => v.id === data.specialist.currentVersionId)
  if (!current) notFound()

  return (
    <PromptEditor
      specialistId={data.specialist.id}
      specialistName={data.specialist.name}
      agentKey={data.specialist.agentKey}
      currentContent={current.content}
      currentVersionNumber={current.versionNumber}
      versions={data.versions}
    />
  )
}
```

- [ ] **Step 2: Implementar o client component**

Arquivo: `app/(protected)/admin/especialistas/[id]/prompt-editor.tsx`

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveNewVersion, restoreVersion } from '../actions'
import type { EditorVersion } from '@/lib/admin/specialist-prompts'

type Props = {
  specialistId: string
  specialistName: string
  agentKey: string
  currentContent: string
  currentVersionNumber: number
  versions: EditorVersion[]
}

export function PromptEditor(props: Props) {
  const router = useRouter()
  const [content, setContent] = useState(props.currentContent)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [confirmRestore, setConfirmRestore] = useState<EditorVersion | null>(null)

  const dirty = content.trim() !== props.currentContent.trim() && content.trim().length > 0

  function onSave() {
    setError(null)
    startTransition(async () => {
      try {
        await saveNewVersion(props.specialistId, content)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    })
  }

  function doRestore(version: EditorVersion) {
    setConfirmRestore(null)
    setError(null)
    startTransition(async () => {
      try {
        await restoreVersion(props.specialistId, version.id)
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao restaurar')
      }
    })
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-heading text-2xl md:text-3xl font-bold">{props.specialistName}</h1>
        <p className="text-sm text-muted-foreground">
          agent_key: <code>{props.agentKey}</code> · Versão atual: v{props.currentVersionNumber}
        </p>
      </header>

      <div className="space-y-2">
        <label htmlFor="prompt" className="block text-sm font-medium">
          System prompt (sem o sharedGuidelines, que continua em código)
        </label>
        <textarea
          id="prompt"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={16}
          className="w-full rounded-md border border-border bg-background px-3 py-2 font-mono text-sm"
          disabled={pending}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={() => setContent(props.currentContent)}
            disabled={!dirty || pending}
            className="px-4 py-2 text-sm rounded-md border border-border disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || pending}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {pending ? 'Salvando…' : 'Salvar nova versão'}
          </button>
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold">Histórico</h2>
        <ul className="rounded-lg border border-border divide-y divide-border">
          {props.versions.map((v) => {
            const isCurrent = v.versionNumber === props.currentVersionNumber
            const isOpen = expanded === v.id
            return (
              <li key={v.id} className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : v.id)}
                    className="text-left flex-1"
                  >
                    <span className="font-medium">v{v.versionNumber}</span>
                    {isCurrent && <span className="ml-2 text-xs uppercase text-primary">atual</span>}
                    <span className="ml-2 text-sm text-muted-foreground">
                      {new Date(v.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </button>
                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => setConfirmRestore(v)}
                      disabled={pending}
                      className="text-sm text-primary hover:underline disabled:opacity-50"
                    >
                      Restaurar
                    </button>
                  )}
                </div>
                {isOpen && (
                  <pre className="mt-2 whitespace-pre-wrap rounded bg-muted p-3 text-xs">
                    {v.content}
                  </pre>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      {confirmRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-card p-6 max-w-md space-y-4">
            <h3 className="font-heading text-lg font-semibold">Restaurar versão</h3>
            <p className="text-sm">
              Restaurar v{confirmRestore.versionNumber} cria uma nova versão
              v{props.versions[0].versionNumber + 1} com o conteúdo de v{confirmRestore.versionNumber}.
              Continuar?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmRestore(null)}
                className="px-4 py-2 text-sm rounded-md border border-border"
              >
                Cancelar
              </button>
              <button
                onClick={() => doRestore(confirmRestore)}
                className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground"
              >
                Restaurar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Smoke test manual**

Run: `npm run dev`
Acesse `/admin/especialistas/<id>` de um especialista. Verifique:
1. Editar o textarea, "Salvar nova versão" só fica enabled quando texto difere.
2. Após salvar, página recarrega mostrando v2 como atual; histórico mostra v2 e v1.
3. "Restaurar" em v1 abre modal de confirmação. Confirmar cria v3 com conteúdo de v1.
4. Logout e login como não-admin → redireciona.

- [ ] **Step 4: Commit**

```bash
git add app/(protected)/admin/especialistas/
git commit -m "feat(admin): add specialist prompt editor with version history"
```

---

## Task 12: Adicionar item de menu "Especialistas"

**Files:**
- Modify: `components/layout/collapsible-sidebar.tsx`

- [ ] **Step 1: Adicionar o sub-item**

Em `collapsible-sidebar.tsx`, encontrar `adminSubItems` e adicionar:

```ts
import { /* ... */, BarChart3, Stethoscope, type LucideIcon } from 'lucide-react'

const adminSubItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
  { href: '/admin/especialistas', label: 'Especialistas', icon: Stethoscope },
]
```

(Se houver `BottomNav` com link admin condicional, manter inalterado — o item admin já mostra um ícone único.)

- [ ] **Step 2: Smoke test manual**

Run: `npm run dev`. Logado como admin, abrir o accordion "Administração" na sidebar. Deve mostrar "Dashboard" e "Especialistas". Clicar em "Especialistas" navega para a listagem.

- [ ] **Step 3: Commit**

```bash
git add components/layout/collapsible-sidebar.tsx
git commit -m "feat(admin): link Especialistas in admin sub-menu"
```

---

## Task 13: Integration test (Postgres real)

**Files:**
- Create: `__tests__/admin/specialist-prompts.integration.test.ts`

- [ ] **Step 1: Escrever o teste**

Arquivo: `__tests__/admin/specialist-prompts.integration.test.ts`

```ts
/**
 * Integration test for specialist prompts.
 * Requires local Supabase: npx supabase start
 * Run with: npm run test:integration
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function authClient(email: string, password: string) {
  const c = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw error
  return c
}

jest.setTimeout(30_000)

describe('specialist_prompts (integration)', () => {
  let adminUserId: string
  let patientUserId: string
  const adminEmail = `admin-prompts-${Date.now()}@example.com`
  const patientEmail = `patient-prompts-${Date.now()}@example.com`
  const password = 'test-password-123!'
  let cardiologyId: string

  beforeAll(async () => {
    const { data: spec } = await admin
      .from('specialists').select('id').eq('agent_key', 'cardiology').single()
    cardiologyId = spec!.id

    const { data: a } = await admin.auth.admin.createUser({
      email: adminEmail, password, email_confirm: true,
    })
    adminUserId = a.user!.id
    const { data: p } = await admin.auth.admin.createUser({
      email: patientEmail, password, email_confirm: true,
    })
    patientUserId = p.user!.id
    await admin.from('profiles').update({ role: 'admin' }).eq('id', adminUserId)
  })

  afterAll(async () => {
    await admin.auth.admin.deleteUser(adminUserId).catch(() => {})
    await admin.auth.admin.deleteUser(patientUserId).catch(() => {})
  })

  it('seed garante v1 ativa para todos os especialistas', async () => {
    const { data } = await admin
      .from('specialists').select('id, current_prompt_version_id')
    expect(data).toBeTruthy()
    expect(data!.every((s) => s.current_prompt_version_id !== null)).toBe(true)
  })

  it('RPC sequencial gera v(n+1), atualiza ponteiro, registra autor', async () => {
    const c = await authClient(adminEmail, password)

    const { data: id1 } = await c.rpc('create_specialist_prompt_version', {
      p_specialist_id: cardiologyId, p_content: 'novo conteúdo A',
    })
    expect(id1).toBeTruthy()

    const { data: spec } = await admin
      .from('specialists').select('current_prompt_version_id').eq('id', cardiologyId).single()
    expect(spec!.current_prompt_version_id).toBe(id1)

    const { data: row } = await admin
      .from('specialist_prompt_versions')
      .select('version_number, content, created_by')
      .eq('id', id1!).single()
    expect(row!.version_number).toBeGreaterThanOrEqual(2)
    expect(row!.content).toBe('novo conteúdo A')
    expect(row!.created_by).toBe(adminUserId)
  })

  it('non-admin recebe unauthorized da RPC', async () => {
    const c = await authClient(patientEmail, password)
    const { error } = await c.rpc('create_specialist_prompt_version', {
      p_specialist_id: cardiologyId, p_content: 'ataque',
    })
    expect(error).toBeTruthy()
    expect(error!.message).toMatch(/unauthorized/)
  })

  it('non-admin não enxerga versions via select (RLS)', async () => {
    const c = await authClient(patientEmail, password)
    const { data, error } = await c
      .from('specialist_prompt_versions').select('id').eq('specialist_id', cardiologyId)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })

  it('FK on delete restrict impede apagar versão referenciada', async () => {
    const { data: spec } = await admin
      .from('specialists').select('current_prompt_version_id').eq('id', cardiologyId).single()
    const versionId = spec!.current_prompt_version_id

    const { error } = await admin
      .from('specialist_prompt_versions').delete().eq('id', versionId)
    expect(error).toBeTruthy() // restrict foreign key violation
  })
})
```

- [ ] **Step 2: Rodar**

```bash
npx supabase start  # se ainda não estiver rodando
npm run test:integration -- specialist-prompts
```

Expected: PASS para todos os casos.

- [ ] **Step 3: Commit**

```bash
git add __tests__/admin/specialist-prompts.integration.test.ts
git commit -m "test(admin): integration coverage for specialist prompts RPC + RLS"
```

---

## Task 14: Smoke test ponta-a-ponta (manual)

**Files:** nenhum (verificação manual antes do merge)

- [ ] **Step 1: Aplicar todas as migrations local**

```bash
npx supabase db reset
```

- [ ] **Step 2: Subir o app + Mastra**

```bash
npm run dev
# em outro terminal:
cd mastra && npm run dev
```

- [ ] **Step 3: Editar prompt do cardiologista**

Logue como admin. `/admin/especialistas` → editar Cardiologista. Adicione no fim do textarea: `\n\nCASO ESPECIAL DE TESTE: mencione "marcador-teste-XYZ" no campo summary.` Salve.

- [ ] **Step 4: Disparar uma consulta**

Logue como paciente. Crie uma consulta nova com cardiologia + qualquer PDF. Aguarde processar.

- [ ] **Step 5: Validar**

1. Abrir o resultado. O `summary` deve conter `marcador-teste-XYZ`.
2. No Studio, rodar:
   ```sql
   select id, prompt_version_id from public.consultations
     order by created_at desc limit 1;
   ```
   `prompt_version_id` deve ser não-nulo e igual ao id da v2 do cardiologista.

- [ ] **Step 6: Restaurar v1 e disparar de novo**

Voltar ao editor → "Restaurar v1". Dispara uma segunda consulta. Resultado **não** deve conter `marcador-teste-XYZ`. `prompt_version_id` da nova consulta = id da v3 (que copiou v1).

- [ ] **Step 7: Limpar checklist e marcar como pronto para PR**

Sem commit (smoke test).

---

## Out of scope — possíveis follow-ups

Listados na spec, não tratados aqui:
- Preview do prompt-em-edição contra PDF de exemplo antes de salvar.
- Diff visual entre versões.
- Apelido de versão.
- Edição do `sharedGuidelines` pela UI.
- Cache em processo no Mastra.
