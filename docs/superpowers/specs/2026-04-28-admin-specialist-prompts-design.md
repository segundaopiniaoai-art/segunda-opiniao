# Design: Gestão de System Prompts dos Especialistas pelo Admin

**Data:** 2026-04-28
**Status:** Aprovado

## Objetivo

Permitir que administradores editem o system prompt de cada especialista pela UI do admin, com versionamento append-only e rollback fácil. Hoje cada prompt vive hardcoded em `mastra/src/mastra/agents/<specialist>.ts` — qualquer ajuste exige deploy. A motivação é dupla: iteração rápida sem deploy, e permitir que pessoas não-engenheiras (médicas/produto) editem.

## Decisões de Design

- Admin edita **apenas a parte específica** de cada especialista. O `sharedGuidelines` (regras de segurança: disclaimer, red flags, "não substitui consulta presencial") permanece em código, intocável via UI.
- **Histórico append-only** com versão `1, 2, 3, ...` por especialista. Restaurar uma versão antiga = inserir uma nova versão copiando o conteúdo. Histórico é monotônico e nunca rebobina.
- Mudança aplica imediatamente — sem fluxo de draft/published.
- `consultations.prompt_version_id` registra qual versão foi usada em cada consulta (permite associar resultados a versões e debugar).
- v1 sem preview/teste antes de salvar. Diff visual entre versões também fica como follow-up.

## Schema (Postgres / Supabase)

### Migration `20260428200000_specialist_prompts.sql`

```sql
-- 1. tabela append-only de versões de prompt
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
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

create policy "Admins insert prompt versions"
  on public.specialist_prompt_versions for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- sem update/delete policy: versões são imutáveis

-- 2. ponteiro para a versão ativa em specialists
alter table public.specialists
  add column current_prompt_version_id uuid
  references public.specialist_prompt_versions(id) on delete restrict;

-- policy nova só para update por admin (specialists já tem select aberto)
create policy "Admins update specialists"
  on public.specialists for update
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- 3. consultations registra qual versão foi usada
alter table public.consultations
  add column prompt_version_id uuid
  references public.specialist_prompt_versions(id) on delete restrict;
```

**Pontos:**
- `version_number` é por especialista. Calculado dentro de uma RPC transacional (ver abaixo) para evitar corrida.
- `on delete restrict` em ambas as FKs para `specialist_prompt_versions` impede apagar uma versão referenciada por consulta ou apontada como atual. Versões nunca somem.
- `created_by` usa `on delete set null` — se um admin sair e seu profile for removido, a versão permanece com autoria desconhecida.

### Migration `20260428210000_seed_specialist_prompts.sql`

Seed com o texto atual de cada arquivo `.ts` (sem o `sharedGuidelines`, que continua no código). Texto é copiado verbatim dos arquivos atuais em `mastra/src/mastra/agents/`.

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

O `set not null` no fim garante a invariante "todo especialista tem versão ativa" para o código de runtime.

### Migration `20260428220000_specialist_prompt_rpc.sql`

Função SQL transacional para criar nova versão e atualizar o ponteiro de uma vez. Chamada do Next.js via `.rpc('create_specialist_prompt_version', ...)`.

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
  if not exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  ) then
    raise exception 'unauthorized';
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

`security definer` é necessário para a transação atômica abranger duas tabelas; o guard `auth.uid() role = admin` no início impede chamadas não autorizadas mesmo via RPC pública.

## Runtime: Mastra lê o prompt do banco

### Novo módulo `mastra/src/mastra/agents/resolve-instructions.ts`

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

### Cada arquivo `mastra/src/mastra/agents/<specialty>.ts` fica reduzido

```ts
// cardiology.ts (depois)
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

Mastra resolve a função em cada `agent.generate()` via `getInstructions({ requestContext })` (`DynamicArgument` no tipo, validado em `mastra/node_modules/@mastra/core/dist/agent/agent.d.ts`).

### Mudança em `runSpecialist`

`mastra/src/mastra/workflows/steps/run-specialist.ts` busca `current_prompt_version_id` antes do `generate` e devolve no output do step:

```ts
const { data: specialist, error: specialistErr } = await supabaseAdmin
  .from('specialists')
  .select('current_prompt_version_id')
  .eq('agent_key', inputData.agentKey)
  .single()
if (specialistErr || !specialist) throw new Error(`Especialista não encontrado: ${inputData.agentKey}`)

// ... agent.generate(...) inalterado ...

return {
  consultationId: inputData.consultationId,
  result: object,
  usage: tokens,
  costUsd,
  promptVersionId: specialist.current_prompt_version_id,
}
```

`outputSchema` do step ganha `promptVersionId: z.string().uuid()`.

### Mudança em `persistResult`

O step seguinte grava `prompt_version_id` na linha de `consultations` junto dos outros campos.

**Pontos:**
- Cada consulta faz uma leitura adicional do banco (especialista + versão ativa). Negligível.
- Sem cache. Mudança do admin se aplica imediatamente. Cache pode entrar depois se virar gargalo.
- Falha ao carregar prompt = falha da consulta. O try/catch existente em `runSpecialist` já chama `markConsultationFailed`.

## Admin UI

### Navegação

Adicionar item "Especialistas" no menu admin (mesmo padrão do dashboard atual).

### `app/(protected)/admin/especialistas/page.tsx` — listagem

Server component. Carrega especialistas + nome da versão atual + autor + data. Renderiza tabela:

| Especialista | Versão atual | Atualizado em | Autor | Ação |
|---|---|---|---|---|
| Cardiologista | v3 | 2026-04-25 | Bruna | [Editar] |
| ... | | | | |

"Editar" linka para `/admin/especialistas/[id]`.

Mesmo guard de admin que `dashboard/page.tsx`:

```ts
if (!user) redirect('/login')
const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
if (profile?.role !== 'admin') redirect('/dashboard')
```

### `app/(protected)/admin/especialistas/[id]/page.tsx` — editor

Server component carrega:
- Dados do especialista (`name`, `agent_key`)
- Versão ativa (`id`, `version_number`, `content`)
- Histórico (todas versões, `desc`, com email do `created_by` via join em `profiles`)

Renderiza um client component `<PromptEditor>` com:
- Cabeçalho: nome do especialista + `agent_key` + indicador da versão atual.
- Textarea pré-preenchido com `content` da versão atual. Botão "Salvar nova versão" desabilitado quando o texto não mudou.
- Lista de histórico abaixo. Cada item mostra `vN — data — autor`, expansível pra ver conteúdo. Versões não-atuais têm botão "Restaurar".
- "Restaurar v2" abre `<AlertDialog>` confirmando: "Restaurar v2 cria uma nova versão v(N+1) com o conteúdo de v2. Continuar?".

### Server actions — `app/(protected)/admin/especialistas/actions.ts`

```ts
'use server'

import { createClient } from '@/lib/supabase/server'

export async function saveNewVersion(specialistId: string, content: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('unauthorized')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('unauthorized')

  const trimmed = content.trim()
  if (!trimmed) throw new Error('content is required')

  const { error } = await supabase.rpc('create_specialist_prompt_version', {
    p_specialist_id: specialistId,
    p_content: trimmed,
  })
  if (error) throw error
}

export async function restoreVersion(specialistId: string, versionId: string): Promise<void> {
  const supabase = await createClient()
  // role check igual ao acima

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
}
```

Após cada action, `revalidatePath('/admin/especialistas/[id]')` (ou retorno seguido de redirect no client) garante que o histórico recarrega.

## Autenticação, autorização e RLS

Quatro camadas de defesa, padrão do projeto:

1. **Middleware** redireciona não-admin de `/admin/*`.
2. **Server component** revalida `profile.role === 'admin'` em cada page e faz `redirect('/dashboard')`.
3. **Server action** revalida role antes de qualquer escrita.
4. **RLS Postgres** + guard dentro da função `create_specialist_prompt_version` é a barreira final.

Resumo de policies pós-mudanças:

- `specialist_prompt_versions`: `select` e `insert` apenas para admin. Sem `update`/`delete` (versões imutáveis).
- `specialists`: `select` aberto para `active = true` (já existe). Nova policy `update` só para admin.
- `consultations`: policies de usuário inalteradas. `prompt_version_id` é gravado pelo Mastra com `supabaseAdmin` (service role), bypass RLS por design.

## Testes

### Unitários (Vitest)

- `__tests__/lib/admin/specialist-prompts.test.ts` — helper de listagem (lista versões com `created_by_email`, ordenado desc). Mock `supabaseAdmin`.
- `__tests__/app/admin/especialistas/actions.test.ts`
  - `saveNewVersion`: rejeita não-admin; chama RPC com content trimmed.
  - `restoreVersion`: rejeita versão pertencente a outro especialista; chama RPC com `content` da versão alvo.
- `__tests__/mastra/agents/resolve-instructions.test.ts`
  - Concatena `sharedGuidelines + \n\n + content`.
  - Lança erro descritivo se especialista não existe.
  - Lança se `current_prompt_version_id` for nulo (não acontece pós-migration; protege regressão).

### Integração (Postgres real, padrão `dashboard-stats`)

- `__tests__/integration/specialist-prompts.test.ts`
  - RPC `create_specialist_prompt_version`:
    - Chamadas consecutivas geram v1, v2, v3.
    - `specialists.current_prompt_version_id` aponta para a última.
    - `raise exception 'unauthorized'` para non-admin.
  - Restaurar v1 a partir de v3 cria v4 com conteúdo de v1; ponteiro vai para v4.
  - RLS: usuário comum recusado em `select` em `specialist_prompt_versions`.
  - FK `consultations.prompt_version_id` com `restrict` impede deletar versão referenciada.

### Verificação manual antes do merge

- Aplicar migrations local. Abrir `/admin/especialistas`, editar cardiologia, criar uma consulta de teste, confirmar que o resultado reflete a mudança e `consultations.prompt_version_id` está populado.

## Out of scope (v1) — possíveis follow-ups

- Preview/teste do prompt-em-edição contra um PDF de exemplo antes de salvar.
- Diff visual entre versões.
- Rótulo / nome de versão (apelido tipo "experimento mais conciso").
- Edição do `sharedGuidelines` pela UI.
- Cache em processo no Mastra com invalidação cross-process.
