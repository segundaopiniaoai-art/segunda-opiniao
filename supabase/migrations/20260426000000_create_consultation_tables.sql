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
