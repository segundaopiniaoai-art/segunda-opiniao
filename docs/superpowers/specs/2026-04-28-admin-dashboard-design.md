# Admin Dashboard Design

**Date:** 2026-04-28
**Feature:** Área administrativa — primeiro sub-menu (Dashboard) com cards agregados de sistema
**Status:** Approved

## Overview

A aplicação já distingue dois perfis (`profiles.role` ∈ `{user, admin}`), com middleware bloqueando rotas `/admin/*` para não-admins. Hoje o admin tem um layout próprio (`app/(admin)/layout.tsx`) com sidebar separada e duas páginas placeholder (`/admin/users`, `/admin/costs`).

Esta feature unifica a experiência: o admin passa a usar o mesmo layout do paciente (`(protected)`), com um item adicional **"Administração"** colapsável na sidebar. O primeiro sub-menu desse colapse é um **Dashboard** com cards agregados de usuários, consultas e custos. Os cards de **custo** são exibidos como "em breve" — o tracking real de custos é uma feature separada que será construída depois.

## Architecture

```
Request /admin/dashboard
  → middleware.ts                            (existing — busca profile.role para /admin/*)
       role !== 'admin' → redirect /dashboard
       role === 'admin' → segue
  → (protected)/layout.tsx                   (modificado — busca role e passa isAdmin)
       renderiza CollapsibleSidebar(isAdmin) + BottomNav(isAdmin)
  → admin/dashboard/page.tsx                 (novo — Server Component)
       defesa em profundidade: re-checa role
       getDashboardStats(supabase) → 8 queries em paralelo
       renderiza DashboardSection × 3 (Usuários / Consultas / Custos)
```

### Decisões arquiteturais principais

- **Layout unificado.** Admin usa o mesmo layout `(protected)` do paciente, ganhando a Administração como item extra. O grupo de rotas `(admin)` é deletado.
- **RLS aberta para admin** (em vez de RPC com `SECURITY DEFINER` ou service role). Novas policies "Admins can read all ..." em `profiles` e `consultations`. Server Components fazem queries diretas — N round-trips por dashboard, mas idiomático em Supabase e prepara terreno para `/admin/users` futuro.
- **Sidebar estendida** com `Accordion` Radix (já instalado e usado no FAQ). O componente atual `CollapsibleSidebar` cresce com um grupo colapsável condicionalmente renderizado.
- **Cards de custo placeholder** com badge "Em breve" + "—" no valor. Visual coerente com o layout final — quando o tracking real chegar, basta plugar dados.

## Folder Structure

```
DELETAR:
  app/(admin)/                              # grupo inteiro
    ├── layout.tsx                          # sidebar antiga separada
    ├── error.tsx
    └── admin/
        ├── users/page.tsx                  # placeholder
        └── costs/page.tsx                  # placeholder

CRIAR:
  app/(protected)/admin/dashboard/
    └── page.tsx                            # nova página, Server Component
  components/admin/
    ├── dashboard-section.tsx
    ├── metric-card.tsx
    └── breakdown-card.tsx
  lib/admin/
    ├── dashboard-stats.ts                  # fetch helper + tipos
    └── date-boundaries.ts                  # cálculo de janelas com timezone
  supabase/migrations/
    └── 20260428000000_admin_read_policies.sql

MODIFICAR:
  app/(protected)/layout.tsx                # busca role, passa isAdmin
  components/layout/collapsible-sidebar.tsx # +grupo Administração
  components/layout/bottom-nav.tsx          # +3º item para admin
```

## Routing & Access Control

A lógica de `lib/auth/route-access.ts` já cobre `/admin/dashboard` via `ADMIN_PREFIXES = ['/admin']` — nenhuma mudança necessária.

| Rota                  | No session         | Session, role=user        | Session, role=admin |
|-----------------------|--------------------|---------------------------|---------------------|
| `/dashboard`          | redirect `/login`  | allow                     | allow               |
| `/consultas/*`        | redirect `/login`  | allow                     | allow               |
| `/admin/dashboard`    | redirect `/login`  | redirect `/dashboard`     | allow               |

Defesa em profundidade na página: o Server Component re-busca o role e re-redireciona se não for admin (cobre o caso de role mudar mid-session, antes de o middleware revalidar).

## Database

### Migração `20260428000000_admin_read_policies.sql`

```sql
-- Helper to check admin role (avoids recursion in RLS policies)
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  )
$$;

-- profiles: admin can read all
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- consultations: admin can read all
create policy "Admins can read all consultations"
  on public.consultations for select
  using (public.is_admin());

-- View for "consultas por especialista" breakdown
-- security_invoker = true makes the view run with the *invoker's* privileges,
-- so RLS on base tables is enforced per caller. Without this flag, the view
-- runs as its owner and bypasses RLS — all rows would leak to non-admins.
create view public.consultation_counts_by_specialist
  with (security_invoker = true) as
  select s.id, s.name, s.icon, count(c.id) as count
  from public.specialists s
  left join public.consultations c on c.specialist_id = s.id
  group by s.id, s.name, s.icon;
```

**Por que `is_admin()` em vez de subquery inline?** Uma policy em `profiles` que faz `EXISTS (SELECT 1 FROM profiles ...)` causa recursão de policies. A função `SECURITY DEFINER` quebra a recursão e fica reutilizável para policies futuras (`/admin/users`, `/admin/costs`, etc.).

## Data Layer

### `lib/admin/date-boundaries.ts`

Calcula limites para "hoje", "últimos 7 dias", "últimos 30 dias" considerando o timezone oficial **`America/Sao_Paulo`**.

```ts
export function getDateBoundaries() {
  const now = new Date()

  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now)

  // Dynamic SP offset (DST-safe — Brazil currently has no DST, but if reinstated this still works)
  const offsetParts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Sao_Paulo',
    timeZoneName: 'longOffset',
    hour: 'numeric',
  }).formatToParts(now)
  const offset = offsetParts.find(p => p.type === 'timeZoneName')!.value.replace('GMT', '') || '-03:00'

  const startOfToday = new Date(`${ymd}T00:00:00${offset}`).toISOString()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString()

  return { startOfToday, sevenDaysAgo, thirtyDaysAgo }
}
```

**Convenções:**
- "Hoje" = a partir da meia-noite em SP (calendário)
- "Últimos 7 / 30 dias" = janela rolante (168h / 720h a partir de `now()`)

### `lib/admin/dashboard-stats.ts`

```ts
export type SpecialistBreakdown = {
  id: string
  name: string
  icon: string
  count: number
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
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    supabase.from('consultations').select('*', { count: 'exact', head: true }),
    supabase.from('consultations').select('*', { count: 'exact', head: true }).gte('created_at', startOfToday),
    supabase.from('consultations').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
    supabase.from('consultations').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
    supabase.from('consultation_counts_by_specialist').select('*').order('count', { ascending: false }),
  ])

  // Falhas individuais não derrubam o dashboard inteiro: log + zero
  const safeCount = (res: { count: number | null; error: unknown | null }) => {
    if (res.error) console.error('[admin-dashboard]', res.error)
    return res.count ?? 0
  }

  return {
    totalUsers: safeCount(totalUsersRes),
    newUsers7d: safeCount(newUsers7dRes),
    newUsers30d: safeCount(newUsers30dRes),
    totalConsultations: safeCount(totalConsultationsRes),
    consultationsToday: safeCount(consultationsTodayRes),
    consultations7d: safeCount(consultations7dRes),
    consultations30d: safeCount(consultations30dRes),
    consultationsBySpecialist: bySpecialistRes.error
      ? (console.error('[admin-dashboard]', bySpecialistRes.error), [])
      : (bySpecialistRes.data ?? []),
  }
}
```

## Layout & Navigation

### `(protected)/layout.tsx`

Busca o `role` server-side e passa `isAdmin` para os componentes de navegação:

```tsx
const { data: { user } } = await supabase.auth.getUser()
const { data: profile } = user
  ? await supabase.from('profiles').select('role').eq('id', user.id).single()
  : { data: null }
const isAdmin = profile?.role === 'admin'

return (
  <div className="min-h-screen flex bg-background text-foreground">
    <CollapsibleSidebar isAdmin={isAdmin} />
    <div className="flex-1 flex flex-col min-w-0">
      <MobileHeader />
      <main className="flex-1 px-6 py-8 pb-20 lg:pb-8 md:px-8">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
      <BottomNav isAdmin={isAdmin} />
    </div>
  </div>
)
```

Custo: 1 query extra por navegação no `(protected)`. Aceitável.

**Fail-closed:** se a query do `profiles` falhar, `isAdmin = false`. O admin perde temporariamente acesso ao menu, mas a app não quebra para o paciente.

### `CollapsibleSidebar`

Estendido com um grupo Administração colapsável (Radix `Accordion`) renderizado condicionalmente quando `isAdmin === true`:

```
┌─────────────────────┐
│ Segunda Opiniao  ◀  │
├─────────────────────┤
│ 📋  Minhas Consultas│
│ ➕  Nova Consulta   │
│                     │
│ ▼ Administração     │  ← novo, só se isAdmin
│    📊  Dashboard    │  ← sub-item indentado
│                     │
├─────────────────────┤
│ 🚪 Sair             │
└─────────────────────┘
```

- Trigger: ícone `ShieldCheck` (lucide) + label "Administração" + chevron do `AccordionTrigger`
- Sub-itens compartilham o mesmo estilo dos itens top-level (estado ativo, hover); indentados via `pl-8`
- Estado expandido persistido em `localStorage` (chave `sidebar-admin-expanded`); default fechado
- **Sidebar collapsed (`w-16`):** o accordion não pode abrir inline — clicar no item Administração primeiro expande a sidebar (`setCollapsed(false)`) e abre o accordion. Idiomático com IDEs.
- Sub-item ativo: classe `text-primary bg-primary/5 font-semibold` (consistente com itens existentes)

### `BottomNav`

Mobile (`<lg`) ganha um terceiro item para admins:

```tsx
const baseItems = [
  { href: '/dashboard',       label: 'Consultas',     icon: ClipboardList },
  { href: '/consultas/nova',  label: 'Nova Consulta', icon: Plus },
]
const adminItem = { href: '/admin/dashboard', label: 'Admin', icon: ShieldCheck }

export function BottomNav({ isAdmin }: { isAdmin: boolean }) {
  const items = isAdmin ? [...baseItems, adminItem] : baseItems
  // ... resto igual
}
```

3 itens cabem confortavelmente na altura `h-16` atual. `isActive` casa em `pathname.startsWith('/admin/dashboard')` para suportar sub-rotas no futuro.

`MobileHeader` não muda.

## Dashboard Page

```tsx
// app/(protected)/admin/dashboard/page.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getDashboardStats } from '@/lib/admin/dashboard-stats'
import { DashboardSection } from '@/components/admin/dashboard-section'
import { MetricCard } from '@/components/admin/metric-card'
import { BreakdownCard } from '@/components/admin/breakdown-card'

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const stats = await getDashboardStats(supabase)

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

      <DashboardSection title="Custos" comingSoon>
        <MetricCard label="Total de custo" placeholder />
        <MetricCard label="Hoje" placeholder />
        <MetricCard label="Últimos 7 dias" placeholder />
        <MetricCard label="Últimos 30 dias" placeholder />
        <BreakdownCard label="Por especialista" placeholder
          className="md:col-span-2 lg:col-span-3" />
        <BreakdownCard label="Top 10 por usuário" placeholder
          className="md:col-span-2 lg:col-span-3" />
      </DashboardSection>
    </div>
  )
}
```

## Components

### `<DashboardSection>`

```tsx
type Props = {
  title: string
  comingSoon?: boolean
  children: React.ReactNode
}

export function DashboardSection({ title, comingSoon, children }: Props) {
  return (
    <section>
      <header className="flex items-center gap-2 mb-4">
        <h2 className="font-heading text-lg font-semibold">{title}</h2>
        {comingSoon && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            Em breve
          </span>
        )}
      </header>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {children}
      </div>
    </section>
  )
}
```

### `<MetricCard>`

- Props: `label: string`, `value?: number`, `placeholder?: boolean`
- Real: caixa `bg-surface border border-border rounded-lg p-5`; label em `text-sm text-muted-foreground`; valor em `font-heading text-3xl font-bold`
- Placeholder: mesma caixa com `opacity-70`; valor `—` em `text-muted-foreground`; badge "Em breve" no canto superior direito

### `<BreakdownCard>`

- Props: `label: string`, `items?: SpecialistBreakdown[]`, `placeholder?: boolean`, `className?: string`
- Real: lista vertical, cada linha `flex justify-between items-center` com ícone (lucide via map de `icon` string → componente) + nome à esquerda, count à direita; ordenado pelo backend
- Placeholder: caixa estática com texto "Em breve" centralizado e badge

## Error Handling

| Cenário | Comportamento |
|---|---|
| Não-admin acessa `/admin/dashboard` direto | Middleware redireciona para `/dashboard` (existente) |
| Role muda mid-session | Page re-checa e redireciona para `/dashboard` |
| Query individual falha (ex.: count timeout) | `getDashboardStats` retorna `0` ou `[]` para aquele campo, log em `console.error`, demais cards renderizam |
| Todas as queries falham | Erro propagado → `app/(protected)/error.tsx` renderiza fallback genérico |
| Query do `profiles` no layout falha | `isAdmin = false` (fail-closed); paciente segue normal, admin perde menu temporariamente |
| Tabelas vazias | Cards mostram `0` (estado válido, não erro) |

## Testing

Escopo enxuto — focar em código não-óbvio e quebrável.

**Unit (Jest):**

1. `lib/admin/date-boundaries.test.ts`
   - Mock de `Date` (`jest.useFakeTimers().setSystemTime(...)`)
   - Casos: meio-dia em SP; horário em que dia em UTC e SP diferem; virada de mês; virada de ano
   - Asserções: `startOfToday` é `YYYY-MM-DDT00:00:00-03:00` (ISO em UTC equivalente); `sevenDaysAgo` é exatamente 168h antes de `now()`
   - Confirma offset dinâmico `-03:00` para datas pós-2019

**Integration (Jest, `INTEGRATION=true`, com `supabase start`):**

2. `__tests__/admin/dashboard-stats.integration.test.ts`
   - Setup: seed 1 admin + 2 pacientes em `profiles`; 5 consultas em datas variadas (hoje, 5 dias atrás, 20 dias atrás, etc.) com especialistas variados
   - Asserções:
     - `getDashboardStats` (chamado com client autenticado como admin) retorna contagens corretas em todos os campos
     - Mesma chamada com client autenticado como paciente respeita RLS — counts vêm como `0` ou erro (RLS bloqueia)

**Não testar:**
- Componentes visuais (`MetricCard`, `BreakdownCard`, `DashboardSection`) — markup com props simples
- Layout `(protected)/layout.tsx` — composição
- Sidebar accordion / BottomNav — comportamento visual, baixa lógica condicional
- Middleware — já testado em `__tests__/lib/auth/route-access.test.ts`

## Out of Scope

- Tracking real de custos (precisa feature dedicada antes dos cards "em breve" ganharem dados reais — captura de tokens Mastra/Anthropic, tabela de cost events, configuração de pricing por modelo)
- Páginas `/admin/users` e `/admin/costs` (deletadas; serão recriadas como features separadas)
- Filtros de período no dashboard (datepicker, comparação MoM)
- Gráficos / visualizações (charts) além de listas
- Realtime updates dos cards
- Export de dados (CSV/PDF)
- Mobile drawer com a sidebar full (BottomNav + 3º item resolvem por ora)
- Logging/audit trail de ações admin
- Múltiplos níveis de admin (super-admin, etc.)
