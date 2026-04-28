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
