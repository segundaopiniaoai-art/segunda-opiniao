# Design: Fluxo de Criação de Segunda Opinião Médica

**Data:** 2026-04-26
**Atualizado em:** 2026-04-27 (integração com Mastra AI)
**Status:** Aprovado

## Objetivo

Criar a experiência completa para o usuário solicitar uma segunda opinião médica: upload de exames em PDF, contexto opcional do paciente, seleção de agente especialista, processamento por agentes Mastra com Claude Sonnet 4.6, e acompanhamento em tempo real do status até a entrega de um resultado estruturado.

## Decisões de Design

- Página única (sem wizard/stepper) para criação da consulta
- Upload com drag & drop + botão, preview dos arquivos, possibilidade de remover
- Máximo 5 PDFs, 10MB por arquivo
- Campo de texto opcional para o paciente compartilhar dúvida/contexto (até 2000 caracteres)
- Seleção de especialista via cards visuais (ícone, nome, descrição)
- Upload direto ao Supabase Storage via signed URLs (não passa pelo servidor Next.js)
- Lista de especialistas vem de tabela no Supabase (populada com seed data)
- Cada especialista mapeia para um Mastra Agent (chave em `specialists.agent_key`)
- Server Actions usam o Supabase client autenticado do usuário (via `@supabase/ssr`), não service role
- Processamento da consulta é feito por um workflow Mastra rodando em **Mastra Cloud** (serviço separado), invocado via HTTP a partir do Next.js
- Output do agente é JSON estruturado validado por Zod e persistido em `consultations.result` (jsonb)
- UI da página de status usa **Supabase Realtime** para refletir mudanças sem refresh
- Estratégia de falha: **fail fast** — qualquer erro vira `status='failed'` com `failure_reason`; usuário pode disparar de novo pelo botão "Tentar novamente"

## Integração com Mastra AI

### Visão geral

```
┌───────────────────────────┐         ┌─────────────────────────┐
│   Next.js (Vercel)        │         │  Mastra Cloud           │
│                           │         │                         │
│  • UI / Server Actions    │  HTTP   │  • Workflow             │
│  • Supabase auth (user)   ├────────►│    consultationWorkflow │
│  • Realtime subscription  │ Bearer  │  • 6 Agents (especialid)│
│                           │ APIKEY  │  • Claude Sonnet 4.6    │
└────────┬──────────────────┘         └────────────┬────────────┘
         │                                         │
         │  Auth (RLS)            Service-role     │
         ▼                                         ▼
   ┌─────────────────────────────────────────────────────┐
   │  Supabase Postgres + Storage                        │
   └─────────────────────────────────────────────────────┘
```

- O serviço Mastra **não conhece o usuário**. Recebe `consultationId` e lê tudo do DB com service-role.
- Toda a segurança user-facing fica no Next.js (RLS + auth Supabase).
- "Fonte da verdade" do estado é a tabela `consultations`, não o estado interno do workflow Mastra.
- Auth Next→Mastra: bearer token compartilhado (`MASTRA_API_KEY`), validado por `serverMiddleware` no Mastra que cobre `/api/workflows/*`.

### Estrutura de pastas

A pasta `mastra/` mora no mesmo repositório do Next.js mas é deployada separadamente em Mastra Cloud (Vercel ignora ela; Mastra Cloud aponta apenas para essa pasta).

```
segunda-opiniao/
├── app/                              # Next.js (Vercel)
├── components/
├── actions/
│   └── consultation.ts               # ATUALIZADO — dispara Mastra
├── lib/
│   ├── supabase/
│   └── mastra/
│       └── client.ts                 # NOVO — cliente HTTP tipado p/ Mastra
├── mastra/                           # NOVO — deploy em Mastra Cloud
│   ├── index.ts                      # exporta { mastra }
│   ├── schemas/
│   │   └── consultation-result.ts    # Zod do output estruturado
│   ├── agents/
│   │   ├── shared.ts                 # config comum (model, defaults)
│   │   ├── cardiology.ts
│   │   ├── oncology.ts
│   │   ├── neurology.ts
│   │   ├── orthopedics.ts
│   │   ├── dermatology.ts
│   │   └── general-practice.ts
│   ├── lib/
│   │   └── supabase-admin.ts         # cliente service-role
│   └── workflows/
│       ├── consultation-workflow.ts  # workflow principal
│       └── steps/
│           ├── load-context.ts
│           ├── download-pdfs.ts
│           ├── run-specialist.ts
│           └── persist-result.ts
└── package.json
```

### Dependências novas

```
@mastra/core
@ai-sdk/anthropic
zod                       # já vem como peerDep do Mastra; explicitar
```

### Schema do output estruturado

`mastra/schemas/consultation-result.ts`:

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

### Agents (1 por especialista)

Cada agente é um `new Agent({ name, instructions, model })` exportado do seu próprio arquivo. Todas as instruções (system prompts) ficam **versionadas em código** — edição passa por PR. As `agent_key`s seguem snake_case e batem com a chave registrada em `mastra/index.ts`:

| `agent_key` | Arquivo | Especialidade |
|---|---|---|
| `cardiology` | `mastra/agents/cardiology.ts` | Cardiologista |
| `oncology` | `mastra/agents/oncology.ts` | Oncologista |
| `neurology` | `mastra/agents/neurology.ts` | Neurologista |
| `orthopedics` | `mastra/agents/orthopedics.ts` | Ortopedista |
| `dermatology` | `mastra/agents/dermatology.ts` | Dermatologista |
| `general_practice` | `mastra/agents/general-practice.ts` | Clínico Geral |

Esqueleto comum (cardiologia como exemplo):

```ts
import { Agent } from '@mastra/core/agent'
import { anthropic } from '@ai-sdk/anthropic'

export const cardiology = new Agent({
  name: 'cardiology',
  instructions: `Você é um cardiologista experiente fornecendo uma SEGUNDA OPINIÃO.
Limites: não substitui consulta presencial; se houver red flag, sinalize claramente.
Tom: técnico mas acessível ao paciente leigo.
Sempre preencha todos os campos do schema, mesmo que com lista vazia.
[...prompt completo com diretrizes específicas da especialidade...]`,
  model: anthropic('claude-sonnet-4-6'),
})
```

O schema de output **não** é fixado no Agent — é passado por chamada via `experimental_output` no step do workflow, mantendo o agente reusável.

### Workflow

`mastra/workflows/consultation-workflow.ts`:

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

**Steps:**

| Step | Entrada | Saída | Falha quando |
|---|---|---|---|
| `loadContext` | `{ consultationId }` | `{ consultationId, userId, agentKey, patientContext, files: [{ id, file_name, storage_path, file_size }] }` | consulta não existe; status ≠ `processing` |
| `downloadPdfs` | saída anterior | mesmo objeto + `pdfBytes: Uint8Array` em cada item de `files` | algum arquivo ausente no Storage |
| `runSpecialist` | saída anterior | `{ result: ConsultationResult }` | `agent_key` inexistente; modelo retorna JSON inválido pelo Zod; erro de API |
| `persistResult` | `{ result, consultationId }` | `{ status: 'completed' }` | falha ao escrever no DB |

**Mensagem para o agente** (montada no step `runSpecialist`): conteúdo `user` com array de parts — uma `file` por PDF (`mimeType: 'application/pdf'`) seguida de `text` com `patientContext` (se presente) e a instrução base "Analise os exames acima e gere uma segunda opinião." A chamada é `agent.generate(messages, { output: consultationResultSchema })`, retornando `{ object }` validado.

> O step **não** usa `mastra.getAgent(agentKey)` para evitar import circular com `mastra/index.ts` (que registra o workflow). Em vez disso, importa `agentsByKey` direto de `mastra/agents`.

**Tratamento de erro:** **fail fast** sem retry automático. Cada step usa `try/catch` próprio e, ao capturar erro, chama um helper `markConsultationFailed(consultationId, message)` (UPDATE em `consultations` para `status='failed'` + `failure_reason`) **antes** de re-lançar. A mensagem persistida é amigável ("Não conseguimos analisar seus exames. Tente novamente."), não a stack técnica.

### Cliente HTTP no Next.js

`lib/mastra/client.ts`:

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
  if (!res.ok) {
    throw new Error(`Mastra start failed: ${res.status}`)
  }
  return res.json() as Promise<{ runId: string }>
}
```

### Variáveis de ambiente

| Lado | Var | Conteúdo |
|---|---|---|
| Vercel (Next.js) | `MASTRA_URL` | URL do serviço Mastra |
| Vercel (Next.js) | `MASTRA_API_KEY` | Bearer compartilhado |
| Mastra Cloud | `ANTHROPIC_API_KEY` | Chave Anthropic |
| Mastra Cloud | `SUPABASE_URL` | URL do Supabase |
| Mastra Cloud | `SUPABASE_SERVICE_ROLE_KEY` | Service role key |
| Mastra Cloud | `MASTRA_API_KEY` | Mesmo bearer; validado em middleware |

## Estrutura de Dados

### Tabela `specialists`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | gen_random_uuid() |
| name | text | Ex: "Cardiologista" |
| description | text | Breve descrição da especialidade |
| icon | text | Emoji ou nome de ícone Lucide |
| `agent_key` | text NOT NULL UNIQUE | Mapeia para a chave do Agent no Mastra (snake_case) |
| active | boolean | Default true, filtra no frontend |
| created_at | timestamptz | Default now() |

### Tabela `consultations`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | gen_random_uuid() |
| user_id | uuid (FK profiles.id) | Quem criou |
| specialist_id | uuid (FK specialists.id) | Agente selecionado |
| `patient_context` | text NULL | Contexto livre opcional do paciente (máx 2000 chars) |
| status | text | `'pending' \| 'processing' \| 'completed' \| 'failed'` |
| `result` | jsonb NULL | Output estruturado do agente (schema acima) |
| `failure_reason` | text NULL | Mensagem amigável quando `status='failed'` |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | Default now(), atualizado via trigger on UPDATE |

### Tabela `consultation_files`

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid (PK) | gen_random_uuid() |
| consultation_id | uuid (FK consultations.id) | ON DELETE CASCADE |
| file_name | text | Nome original do arquivo |
| file_size | integer | Tamanho em bytes |
| storage_path | text | Caminho no Storage bucket |
| created_at | timestamptz | Default now() |

### Trigger `updated_at`

```sql
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_consultations_updated_at
  before update on consultations
  for each row execute function update_updated_at();
```

### Realtime

```sql
alter publication supabase_realtime add table public.consultations;
```

Sem isso, a UI não recebe eventos das mudanças de `status` e `result`.

### Políticas RLS

**`specialists` — leitura pública (ativos):**
```sql
create policy "Anyone can read active specialists"
  on specialists for select
  using (active = true);
```

**`consultations` — SELECT:**
```sql
create policy "Users can read own consultations"
  on consultations for select
  using (auth.uid() = user_id);
```

**`consultations` — INSERT:**
```sql
create policy "Users can create own consultations"
  on consultations for insert
  with check (auth.uid() = user_id);
```

**`consultations` — UPDATE (status para 'processing' no confirm; reset para retry):**
```sql
create policy "Users can update own consultations"
  on consultations for update
  using (auth.uid() = user_id);
```

A escrita de `result`, `failure_reason` e `status='completed'|'failed'` é feita pelo Mastra com **service-role**, que bypassa RLS — o usuário continua sem permissão de gravar esses campos diretamente.

**`consultation_files` — SELECT:**
```sql
create policy "Users can read own consultation files"
  on consultation_files for select
  using (
    exists (
      select 1 from consultations
      where consultations.id = consultation_files.consultation_id
      and consultations.user_id = auth.uid()
    )
  );
```

**`consultation_files` — INSERT:**
```sql
create policy "Users can create files for own consultations"
  on consultation_files for insert
  with check (
    exists (
      select 1 from consultations
      where consultations.id = consultation_files.consultation_id
      and consultations.user_id = auth.uid()
    )
  );
```

### Storage

- **Bucket:** `consultation-files` (privado) — criado via migration SQL (`insert into storage.buckets`)
- Estrutura: `{user_id}/{consultation_id}/{file_name}`
- Signed upload URLs com expiração de 5 minutos e `content-type: application/pdf` obrigatório
- Políticas de storage: usuário só faz upload/leitura em paths que começam com seu próprio `auth.uid()`
- O Mastra acessa o bucket via service-role (sem signed URL), pois roda fora da sessão do usuário

### Seed Data

```sql
insert into public.specialists (name, description, icon, agent_key) values
  ('Cardiologista',  'Especialista em doenças do coração e sistema cardiovascular',     'heart-pulse', 'cardiology'),
  ('Oncologista',    'Especialista em diagnóstico e tratamento de câncer',              'ribbon',      'oncology'),
  ('Neurologista',   'Especialista em doenças do sistema nervoso e cérebro',            'brain',       'neurology'),
  ('Ortopedista',    'Especialista em ossos, articulações e sistema musculoesquelético','bone',        'orthopedics'),
  ('Dermatologista', 'Especialista em doenças da pele, cabelo e unhas',                 'scan-face',   'dermatology'),
  ('Clínico Geral',  'Avaliação médica abrangente e orientação diagnóstica',            'stethoscope', 'general_practice');
```

## Rotas e Middleware

### Novas rotas

| Rota | Grupo | Propósito |
|---|---|---|
| `/consultas/nova` | (protected) | Criação — upload de PDFs + contexto + seleção de especialista |
| `/consultas/[id]` | (protected) | Status/resultado de uma consulta (com Realtime) |
| `/dashboard` | (protected) | Atualizado com lista de consultas |

### Atualização do middleware

Adicionar `/consultas` ao `PROTECTED_PREFIXES` em `lib/auth/route-access.ts`:

```ts
const PROTECTED_PREFIXES = ['/dashboard', '/consultas']
```

### Atualização do sidebar

Atualizar `app/(protected)/layout.tsx`:
- Trocar "SaaS App" por "Segunda Opinião"
- Adicionar link "Nova Consulta" na navegação
- Traduzir "Sign out" para "Sair"

## Componentes

| Componente | Responsabilidade |
|---|---|
| `components/consultation/pdf-dropzone.tsx` | Drag & drop + botão, preview dos PDFs, validação (máx 5, 10MB, só PDF), remover arquivo |
| `components/consultation/patient-context-input.tsx` | `<textarea>` opcional (máx 2000 chars), com contador de caracteres |
| `components/consultation/specialist-picker.tsx` | Grid de cards dos especialistas, seleção single-select |
| `components/consultation/consultation-form.tsx` | Orquestra dropzone + context + picker + botão enviar |
| `components/consultation/consultation-status-live.tsx` | Client wrapper que assina Supabase Realtime e mantém o estado da consulta |
| `components/consultation/consultation-result.tsx` | Renderiza o resultado estruturado (summary, findings, assessment, recommendations, questions, red flags, confidence, disclaimer) |
| `components/consultation/consultation-failed.tsx` | Card de erro com `failure_reason` + botão "Tentar novamente" |
| `components/dashboard/consultation-list.tsx` | Lista de consultas no dashboard |

## Fluxo de Upload e Criação

### Fluxo do usuário

1. Usuário arrasta/seleciona PDFs no dropzone (validação client-side)
2. (Opcional) Escreve dúvida/contexto no `<textarea>`
3. Seleciona um especialista nos cards
4. Clica em "Solicitar Segunda Opinião"
5. Botão entra em estado de loading
6. É redirecionado para `/consultas/[id]` com status `processing` e Realtime ligado

### Fluxo técnico

1. **Client** chama Server Action `createConsultation({ specialistId, patientContext?, filesMetadata })`
2. **Server Action `createConsultation`:**
   - Valida sessão do usuário
   - Valida `patientContext` (≤2000 chars se fornecido)
   - Valida `specialist_id` existe e está ativo
   - Cria registro em `consultations` (status: `'pending'`, `patient_context` se houver)
   - Cria registros em `consultation_files` com `storage_path`s esperados
   - Gera signed upload URLs para cada arquivo via Supabase Storage, com `content-type: application/pdf` obrigatório
   - Retorna `{ consultationId, uploadUrls[] }`
3. **Client** faz upload direto ao Storage para cada arquivo (com progress tracking)
4. **Client** chama Server Action `confirmConsultationUpload(consultationId)` após todos os uploads
5. **Server Action `confirmConsultationUpload`:**
   - Valida sessão e ownership
   - Verifica que a consulta está em `status='pending'`
   - Para cada arquivo em `consultation_files`: verifica existência no Storage via `supabase.storage.from('consultation-files').list()` no path esperado
   - Se todos os arquivos existem: atualiza `status='processing'`
   - Chama `startConsultationWorkflow(consultationId)` (HTTP para Mastra)
   - Se a chamada do Mastra falhar: reverte para `status='failed'` com `failure_reason='Não foi possível iniciar a análise. Tente novamente.'` e retorna erro ao cliente
6. **Client** redireciona para `/consultas/[id]`
7. **Mastra workflow (em background):** roda steps `loadContext → downloadPdfs → runSpecialist → persistResult`. Em sucesso: `status='completed'` + `result` preenchido. Em falha: `status='failed'` + `failure_reason`.
8. **UI** recebe evento de Realtime e re-renderiza com o resultado ou estado de erro.

### Retry após falha

`retryConsultation(consultationId)` — Server Action:
- Valida sessão e ownership
- Só prossegue se `status='failed'`
- UPDATE: `status='processing'`, `failure_reason=null`, `result=null`
- Chama `startConsultationWorkflow(consultationId)`
- Mesmo tratamento de erro de Mastra inacessível (reverte para `failed`)

### Tratamento de erros

- Upload falha em arquivo específico: mostra erro naquele arquivo, permite retry individual (UI client-side, sem mudar `consultations`)
- Criação no banco falha: mensagem genérica de erro, formulário preserva estado
- Mastra inacessível na hora do disparo: consulta vai para `failed` imediatamente e usuário vê o card de erro com retry
- Workflow Mastra falha em qualquer step: cada step marca `failed` antes de re-lançar (helper `markConsultationFailed`)
- Consulta que crashou no meio do workflow (Mastra Cloud caiu): fica em `processing` indefinidamente — limpeza por job futuro (fora de escopo)
- Usuário fecha a página no meio: workflow continua rodando; ao voltar, vê o estado atual

## Página de Status (`/consultas/[id]`)

- Server Component carrega o estado inicial via Supabase autenticado (RLS) e passa para um Client Component `ConsultationStatusLive` que mantém uma subscription via Supabase Realtime
- **Header:** título com data + badge de status colorido
  - `pending` → cinza, "Aguardando upload"
  - `processing` → azul (com animação de pulso), "Analisando seus exames…"
  - `completed` → verde, "Concluída"
  - `failed` → vermelho, "Falhou"
- **Seção Especialista:** card com ícone e nome
- **Seção Arquivos:** lista dos PDFs enviados (nome, tamanho)
- **Seção Contexto** (se `patient_context` não nulo): bloco com o texto fornecido pelo paciente
- **Seção Resultado** (apenas quando `status='completed'`):
  - **Resumo** — `summary` em markdown
  - **Achados** — lista de `findings`, com badge colorido por `severity` (info/atenção/urgente)
  - **Análise** — `assessment` em markdown
  - **Recomendações** — bullets de `recommendations`
  - **Perguntas para o médico** — bullets de `questionsForDoctor`
  - **Sinais de alerta** — bullets em vermelho de `redFlags` (oculta a seção se array vazio)
  - **Confiança** — badge `low/medium/high`
  - **Aviso** — `disclaimer` em texto pequeno e cinza no rodapé
- **Estado falha** (`status='failed'`): card vermelho com `failure_reason` + botão "Tentar novamente" (chama `retryConsultation`)
- **Botão voltar:** link para `/dashboard`
- **Acesso:** RLS garante que só o dono acessa. Outros recebem 404.

## Dashboard Atualizado

- **Header:** "Minhas Consultas" + botão "Nova Consulta"
- **Lista:** cards com especialidade (ícone + nome), status (badge incluindo `failed`), data. Clicável → `/consultas/[id]`
- **Estado vazio:** ícone + "Você ainda não tem consultas" + botão "Criar sua primeira consulta"
- **Ordenação:** mais recentes primeiro

## Validações

| Camada | Validação |
|---|---|
| Client | Tipo PDF (extensão + MIME), máx 5 arquivos, 10MB por arquivo, pelo menos 1 arquivo, especialista selecionado, `patient_context` ≤2000 chars |
| Server Action `createConsultation` | Sessão válida, `specialist_id` existe e ativo, re-valida limites de quantidade, tamanho e tamanho do contexto |
| Signed URL | Content-type restrito a `application/pdf` |
| Server Action `confirmConsultationUpload` | Verifica existência de todos os arquivos no Storage; verifica que `status='pending'` antes de prosseguir |
| Server Action `retryConsultation` | Verifica que `status='failed'` antes de prosseguir |
| Mastra middleware | `Authorization: Bearer ${MASTRA_API_KEY}` em `/api/workflows/*` |
| Workflow `loadContext` | `status='processing'` (evita reprocessar consulta concluída ou falhada) |
| Workflow `runSpecialist` | Output do modelo passa pelo `consultationResultSchema` (Zod) |
| RLS | User só acessa próprias consultas e arquivos |
| Storage | Signed URLs com expiração curta (~5 min), path restrito ao user_id |

## Estratégia de Testes

| Camada | O que testar | Como |
|---|---|---|
| `actions/consultation.ts` | `createConsultation` com `patient_context`, `confirmConsultationUpload` dispara workflow, `retryConsultation` respeita estado | Mock de `startConsultationWorkflow`, mock de Supabase |
| `lib/mastra/client.ts` | Monta request correto, propaga erro HTTP | Mock de `fetch` |
| `mastra/workflows/steps/*.ts` | Cada step isolado; Supabase admin mockado | Unit tests sem rede |
| `mastra/workflows/steps/run-specialist.ts` | Mensagens montadas corretamente, schema validado, `agent_key` inexistente lança | Mock de `mastra.getAgent` |
| `mastra/agents/*.ts` | Snapshot das `instructions` (regressão de prompts) | `expect(agent.instructions).toMatchSnapshot()` |
| `components/consultation/consultation-status-live.tsx` | Subscribe/unsubscribe; atualiza ao receber evento | Mock do Supabase channel |
| `components/consultation/consultation-result.tsx` | Renderização correta de cada status, severity styling, seções condicionais | RTL com fixtures |
| Smoke test E2E manual | Criação → workflow → status → retry | Checklist na Task final do plano |

## Riscos Conhecidos

- **Tamanho de PDFs:** próximo ao limite de 10MB por arquivo × 5 arquivos pode exceder context window mesmo do Sonnet. O step `runSpecialist` deve falhar com mensagem clara se o input total ficar acima do limite seguro.
- **Custo:** Claude Sonnet 4.6 com PDFs como input é caro. Logar tokens consumidos por consulta para observabilidade futura.
- **Privacidade:** dados médicos transitam por Mastra Cloud + Anthropic. Mencionar em `/privacidade`.
- **Crash de workflow:** se Mastra Cloud cair durante o run, a consulta fica em `processing` indefinidamente (não há mecanismo de resumption). Tratar via job de cleanup futuro.

## Fora de Escopo

- Criação/edição de agentes especialistas via UI (feature futura — hoje é via PR)
- Tools (function calling) para os agentes — busca de literatura, drug interactions, etc. (v2)
- Memory entre consultas do mesmo usuário (v2)
- RAG sobre literatura médica (v2)
- Streaming token-a-token na UI durante o processamento (v2)
- Avaliação automatizada de qualidade dos outputs (Mastra evals — v2)
- Notificações por email
- Histórico de versões de resultado
- Rate limiting na criação de consultas (adicionar se necessário)
- Limpeza automática de consultas `pending`/`processing` abandonadas (job futuro)
- Resumption de workflows interrompidos (job/recovery futuro)
