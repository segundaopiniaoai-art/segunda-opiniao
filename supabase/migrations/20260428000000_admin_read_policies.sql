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

-- profiles: admin can read all rows
create policy "Admins can read all profiles"
  on public.profiles for select
  using (public.is_admin());

-- consultations: admin can read all rows
create policy "Admins can read all consultations"
  on public.consultations for select
  using (public.is_admin());

-- View for "consultas por especialista" breakdown.
-- security_invoker = true makes the view run with the caller's privileges,
-- so RLS on base tables is enforced per request. Without this flag, the view
-- runs as its owner and bypasses RLS — counts would leak to non-admins.
create view public.consultation_counts_by_specialist
  with (security_invoker = true) as
  select s.id, s.name, s.icon, count(c.id) as count
  from public.specialists s
  left join public.consultations c on c.specialist_id = s.id
  group by s.id, s.name, s.icon;
