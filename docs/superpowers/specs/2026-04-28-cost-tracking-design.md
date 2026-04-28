# Cost Tracking — Design Spec

**Data:** 2026-04-28
**Status:** Proposto
**Escopo:** rastreamento de custo real (USD) por consulta concluída, com persistência no banco, exibição no detalhe da consulta para admins e agregações no admin dashboard.

---

## 1. Motivação

O processo de nova consulta executa um agente Mastra que chama um modelo Anthropic (`claude-sonnet-4-6` via `@ai-sdk/anthropic`) com PDFs do paciente como input. Cada execução consome tokens cobrados em USD pela Anthropic. Hoje não há nenhum rastreamento de custo: não sabemos quanto cada consulta custou, qual o custo total, nem o custo médio por consulta.

Esta feature adiciona captura, persistência, e exibição admin do custo real de cada consulta, permitindo monitoramento operacional e análise de margem.

## 2. Decisões de escopo

| Decisão | Valor | Motivação |
|---|---|---|
| Quando medir | **Pós-consulta (custo real)** | Captura `usage` do `agent.generate()`; estimativa preditiva fica fora. |
| Audiência | **Admin apenas** (detalhe + agregações) | Operacional/interno; usuário final não vê. |
| Estratégia de armazenamento | **Snapshot congelado** | Grava `input_tokens`, `output_tokens`, `cost_usd` por consulta no momento da chamada. Custo histórico imutável. |
| Pricing source | **Constante TS hardcoded** (`MODEL_PRICING` em `lib/pricing.ts`) | 1 modelo em uso; tabela DB versionada é YAGNI. |
| Moeda exibida | **Apenas USD** | Anthropic factura em USD; sem conversão BRL para evitar dependência de cotação. |
| Captura no workflow | **Estender `runSpecialist` + `persistResult`** | Sem step novo; uma única escrita no DB com result + cost. Util `lib/pricing.ts` reusável. |

### Fora de escopo

- Estimativa pré-consulta (predição antes do envio).
- Exibição de custo ao usuário final.
- Conversão para BRL.
- Tabela `model_pricing` no banco.
- Cache de prompt (`cache_creation_input_tokens` / `cache_read_input_tokens`) — agente atual não usa caching.
- Backfill de consultas antigas — Anthropic não expõe usage histórico.
- Alertas de custo, quotas, ou enforcement de limites.

## 3. Arquitetura

```
┌─────────────────┐    ┌──────────────┐    ┌───────────────┐    ┌────────────────┐
│  loadContext    │───▶│ downloadPdfs │───▶│ runSpecialist │───▶│ persistResult  │
└─────────────────┘    └──────────────┘    └───────┬───────┘    └────────┬───────┘
                                                   │                     │
                                          calculateCostUsd        UPDATE consultations
                                          (lib/pricing.ts)        SET result, status,
                                                                  input_tokens, output_tokens,
                                                                  cost_usd
```

Captura: `runSpecialist` lê `usage` do retorno do `agent.generate()`, calcula `costUsd` via `lib/pricing.ts`, propaga `{ result, usage, costUsd }` para `persistResult`. Persistência: `persistResult` faz um único `update` na linha de `consultations` incluindo result + tokens + cost.

Leitura admin:
- `app/(protected)/consultas/[id]/page.tsx` renderiza `<ConsultationCostCard>` quando viewer for admin.
- `lib/admin/dashboard-stats.ts` agrega sums (total, hoje, 7d, 30d, médio, por especialista) e expõe via dashboard.

## 4. Schema (DB)

### 4.1 Migration

Adicionar 3 colunas em `public.consultations`:

```sql
alter table public.consultations
  add column input_tokens  integer,
  add column output_tokens integer,
  add column cost_usd      numeric(10, 6);
```

- `numeric(10, 6)`: cobre custos até $9.999,999999 com precisão de microcents.
- Todas nullable. Consultas `pending`/`processing`/`failed` não têm custo. Só `completed` preenche.
- Sem default. `NULL` significa "não medido"; `0` significaria "rodou e gastou zero" (semanticamente diferente).
- RLS: cobertura existente já se estende às novas colunas.

### 4.2 View `consultation_counts_by_specialist` — atualizar

Estender a view existente para incluir `sum(cost_usd) as cost_usd`. A view já agrega counts por especialista; somar custo no mesmo passo evita query extra.

```sql
create or replace view public.consultation_counts_by_specialist as
select
  s.id,
  s.name,
  s.icon,
  count(c.id)::bigint as count,
  coalesce(sum(c.cost_usd), 0)::numeric(12, 6) as cost_usd
from public.specialists s
left join public.consultations c
  on c.specialist_id = s.id
  and c.status = 'completed'
  and c.cost_usd is not null
group by s.id, s.name, s.icon
order by count desc;
```

(A definição exata replica o pattern existente em `20260428000000_admin_read_policies.sql`; ajustar conforme a definição original.)

### 4.3 Função `get_dashboard_costs()`

Retorna agregados num único round-trip:

```sql
create or replace function public.get_dashboard_costs()
returns json
language sql
security invoker
stable
as $$
  with measured as (
    select cost_usd, created_at
    from public.consultations
    where status = 'completed' and cost_usd is not null
  )
  select json_build_object(
    'totalCostUsd',           coalesce(sum(cost_usd), 0),
    'costToday',              coalesce(sum(cost_usd) filter (where created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo')), 0),
    'cost7d',                 coalesce(sum(cost_usd) filter (where created_at >= now() - interval '7 days'), 0),
    'cost30d',                coalesce(sum(cost_usd) filter (where created_at >= now() - interval '30 days'), 0),
    'measuredCount',          count(*),
    'costMeasurementSince',   min(created_at)
  )
  from measured;
$$;
```

`avgCostPerConsultation` é calculado client-side (`totalCostUsd / measuredCount`) para manter a função simples.

## 5. Pricing module

`lib/pricing.ts` (novo):

```ts
export type ModelPricing = {
  inputPerMTok: number   // USD per 1M input tokens
  outputPerMTok: number  // USD per 1M output tokens
}

// Source: anthropic.com/pricing (snapshot 2026-04-28)
export const MODEL_PRICING: Record<string, ModelPricing> = {
  'claude-sonnet-4-6': { inputPerMTok: 3.00, outputPerMTok: 15.00 },
}

export type Usage = { inputTokens: number; outputTokens: number }

export function calculateCostUsd(model: string, usage: Usage): number {
  const pricing = MODEL_PRICING[model]
  if (!pricing) throw new Error(`Pricing not configured for model: ${model}`)
  const cost =
    (usage.inputTokens  / 1_000_000) * pricing.inputPerMTok +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMTok
  return Math.round(cost * 1_000_000) / 1_000_000  // 6 decimals
}

export function formatCostUsd(cost: number): string {
  return `$${cost.toFixed(4)}`
}
```

Características:
- **Pure function**: sem I/O, fácil de testar.
- **Throw em modelo desconhecido**: falha alta antes de gravar lixo. Atualizar a constante é um PR explícito quando trocar de modelo.
- **Snapshot da fonte no comentário**: rastreabilidade fica em git history.
- **`formatCostUsd` separado**: cálculo é numérico/puro; formatação é UI.

## 6. Workflow Mastra

### 6.1 `runSpecialist.ts`

Capturar `usage` e calcular `costUsd`:

```ts
outputSchema: z.object({
  consultationId: z.string(),
  result: consultationResultSchema,
  usage: z.object({
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
  }),
  costUsd: z.number().nonnegative(),
}),

// dentro de execute(), após generate:
const { object, usage } = await agent.generate(messages, {
  structuredOutput: { schema: consultationResultSchema },
})

const tokens = {
  inputTokens:  usage.inputTokens  ?? usage.promptTokens     ?? 0,
  outputTokens: usage.outputTokens ?? usage.completionTokens ?? 0,
}
const costUsd = calculateCostUsd('claude-sonnet-4-6', tokens)

return {
  consultationId: inputData.consultationId,
  result: object,
  usage: tokens,
  costUsd,
}
```

Defesa em profundidade no parsing de `usage`: o AI SDK / Mastra normalizam para `inputTokens/outputTokens`, mas alguns caminhos retornam `promptTokens/completionTokens`. O `?? 0` final blinda contra ausência.

### 6.2 `persistResult.ts`

Aceitar campos novos no input; gravar tudo num único `update`:

```ts
inputSchema: z.object({
  consultationId: z.string(),
  result: consultationResultSchema,
  usage: z.object({ inputTokens: z.number(), outputTokens: z.number() }),
  costUsd: z.number(),
}),

// execute:
const { error } = await supabaseAdmin
  .from('consultations')
  .update({
    status: 'completed',
    result: inputData.result,
    input_tokens:  inputData.usage.inputTokens,
    output_tokens: inputData.usage.outputTokens,
    cost_usd:      inputData.costUsd,
  })
  .eq('id', inputData.consultationId)
```

## 7. Admin: detalhe da consulta

Reusar `app/(protected)/consultas/[id]/page.tsx` (em vez de criar `/admin/consultas/[id]`).

### 7.1 Mudanças na página

- Detectar `isAdmin` (já disponível no layout protegido).
- Quando `isAdmin`, query de `consultations` sem filtro implícito de `user_id` (RLS admin já permite).
- Selecionar também `input_tokens, output_tokens, cost_usd, user_id`.
- Renderizar `<ConsultationCostCard>` no topo do detalhe quando `isAdmin`.

### 7.2 `components/admin/consultation-cost-card.tsx` (novo)

```tsx
type Props = {
  costUsd: number | null
  inputTokens: number | null
  outputTokens: number | null
}

export function ConsultationCostCard({ costUsd, inputTokens, outputTokens }: Props) {
  if (costUsd == null) {
    return (
      <Card>
        <CardHeader>Custo da consulta</CardHeader>
        <CardContent>Custo não medido</CardContent>
      </Card>
    )
  }
  return (
    <Card>
      <CardHeader>Custo da consulta</CardHeader>
      <CardContent>
        <div>{formatCostUsd(costUsd)}</div>
        <div>{inputTokens?.toLocaleString('pt-BR')} input · {outputTokens?.toLocaleString('pt-BR')} output tokens</div>
      </CardContent>
    </Card>
  )
}
```

- Renderizado apenas se viewer é admin (decisão na página).
- `cost_usd == null` em consulta `completed` antiga: exibe `Custo não medido` (diferencia ausência de zero).

### 7.3 RLS de `consultations` para admin

Verificar a policy admin existente em `20260428000000_admin_read_policies.sql`. Se ainda não cobre `select` de qualquer linha de `consultations` para usuários admin, ajustar a policy nessa mesma migration de cost-tracking. Não usar `supabaseAdmin` (service role) na página de detalhe — manter o caminho via RLS para reaproveitar o mesmo client/query.

## 8. Admin: agregações no dashboard

### 8.1 `lib/admin/dashboard-stats.ts`

Estender `DashboardStats`:

```ts
export type CostBySpecialist = {
  id: string
  name: string
  icon: string
  count: number
  costUsd: number
}

export type DashboardStats = {
  // ... campos existentes ...
  totalCostUsd: number
  costToday: number
  cost7d: number
  cost30d: number
  avgCostPerConsultation: number   // totalCostUsd / measuredCount; 0 se measuredCount = 0
  costBySpecialist: CostBySpecialist[]
  costMeasurementSince: string | null   // null se nenhuma consulta medida ainda
}
```

`getDashboardStats` faz mais 1 chamada em paralelo: `supabase.rpc('get_dashboard_costs')`. `costBySpecialist` vem da view `consultation_counts_by_specialist` já carregada (agora com `cost_usd` na linha).

### 8.2 UI no `/admin/dashboard`

Adicionar nova `DashboardSection` "Custos" abaixo das seções existentes. Reusa componentes:

- `MetricCard` para `Total`, `Hoje`, `7d`, `30d`, `Médio/consulta` — todos formatados via `formatCostUsd`.
- `BreakdownCard` adaptado para mostrar `count` + `costUsd` por especialista (duas colunas por linha, ou subtítulo com cost abaixo do count).
- Footer da seção: `Medindo custos desde {data formatada}` quando `costMeasurementSince != null`.

Estado vazio (`costMeasurementSince == null`): exibir `—` em vez de `$0.0000` e mensagem `Nenhuma consulta medida ainda`.

### 8.3 Performance

Sums sobre `consultations` são O(N). N atual é pequeno; quando crescer, índice em `(status, created_at) where cost_usd is not null`. Não criar agora — YAGNI.

## 9. Edge cases (comportamento definido)

| Cenário | Comportamento |
|---|---|
| Consulta `failed` (agente errou) | `cost_usd = NULL`. Excluída de sums e médias. |
| Consulta `pending`/`processing` | `cost_usd = NULL`. Excluída de sums e médias. |
| `usage` ausente do retorno do SDK | Defaults `?? 0` ⇒ `costUsd = 0`. `console.warn` com `consultationId` para auditoria. Não falha. |
| Modelo não está em `MODEL_PRICING` | `calculateCostUsd` lança. `runSpecialist` propaga; consulta marcada `failed` via `markConsultationFailed`. Sinal alto de drift. |
| Consulta antiga (pré-deploy) sem `cost_usd` | UI admin: `Custo não medido`. Dashboard: excluída de sums (`where cost_usd is not null`). |
| Sum de 0 consultas medidas | `totalCostUsd = 0`, `avgCostPerConsultation = 0`, `costMeasurementSince = null`. UI mostra `—` e mensagem de estado vazio. |

## 10. Plano de testes

### 10.1 `lib/pricing.test.ts` (puro, unit)

- `calculateCostUsd('claude-sonnet-4-6', { inputTokens: 1_000_000, outputTokens: 1_000_000 })` → `18.00`.
- Tokens zero → `0`.
- Modelo desconhecido → throws.
- `formatCostUsd(0.0123456)` → `"$0.0123"`.

### 10.2 Workflow steps (integração existente)

- `runSpecialist` com mock de `agent.generate` retornando `usage = { inputTokens: 12430, outputTokens: 1892 }` → output contém `costUsd ≈ 0.0656` (12430·3/1M + 1892·15/1M).
- `persistResult` com input completo → row tem `input_tokens`, `output_tokens`, `cost_usd` corretos.

### 10.3 `getDashboardStats` (integração)

- Seed: 3 consultations completed com costs (ex: 0.05, 0.10, 0.15), 1 failed sem cost, 1 pending sem cost.
- Asserir `totalCostUsd = 0.30`, `avgCostPerConsultation = 0.10`, `costMeasurementSince = min(created_at)` das 3 medidas, `costBySpecialist` agrega corretamente por especialista.

### 10.4 `ConsultationCostCard` (UI)

- `costUsd != null` → renderiza valor formatado + tokens.
- `costUsd == null` → renderiza "Custo não medido".

### 10.5 Página `/consultas/[id]`

- Viewer não-admin: card de custo NÃO renderiza, comportamento atual inalterado.
- Viewer admin acessando consulta de outro user: query funciona via RLS admin, card renderiza.

## 11. Rollout

1. Migration (colunas + view atualizada + função RPC + ajuste de policy admin se necessário).
2. `lib/pricing.ts` com testes.
3. Workflow steps (`runSpecialist`, `persistResult`).
4. UI: `ConsultationCostCard` + integração na página de detalhe.
5. `getDashboardStats` + UI da nova seção do dashboard.

Sem feature flag. Mudanças são aditivas (novas colunas nullable, nova UI condicional a `isAdmin`); zero impacto no fluxo do usuário final.
