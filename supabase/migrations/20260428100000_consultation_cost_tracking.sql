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
    count(c.id) as count,
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
  -- "today" is midnight São Paulo time; 7d/30d are rolling 168h/720h windows.
  -- This matches lib/admin/date-boundaries.ts which uses the same convention.
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
