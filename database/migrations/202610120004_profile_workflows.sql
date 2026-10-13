begin;

alter table public.user_constraints
  add column if not exists profile_version integer not null default 1 check (profile_version > 0);

update public.user_constraints c
set profile_version = p.profile_version
from public.user_profiles p
where p.id = c.user_profile_id;

create index if not exists user_constraints_profile_version_idx
  on public.user_constraints(user_profile_id, profile_version);

create table public.profile_workflows (
  id uuid primary key default gen_random_uuid(),
  user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
  profile_version integer not null check (profile_version > 0),
  preference_version integer not null check (preference_version > 0),
  deterministic_key text not null,
  status text not null check (status in ('PROFILE_SAVED','FILTERING','SCORING','BUILDING_PORTFOLIO','COMPLETED','PARTIAL','FAILED')),
  current_stage text not null check (current_stage in ('PROFILE','FILTER','SCORE','PORTFOLIO','COMPLETE')),
  failed_stage text check (failed_stage is null or failed_stage in ('FILTER','SCORE','PORTFOLIO')),
  last_error text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  data_version jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_profile_id, profile_version),
  unique(deterministic_key)
);

create index profile_workflows_profile_version_idx
  on public.profile_workflows(user_profile_id, profile_version desc);

create trigger profile_workflows_set_updated_at
  before update on public.profile_workflows
  for each row execute function public.set_updated_at();

alter table public.profile_workflows enable row level security;

create policy "Users read own profile workflows"
  on public.profile_workflows for select to authenticated
  using (exists (
    select 1 from public.user_profiles p
    where p.id = user_profile_id and p.user_id = auth.uid()
  ));

commit;
