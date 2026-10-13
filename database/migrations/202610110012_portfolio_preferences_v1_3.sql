begin;
create table public.portfolio_preferences(
 id uuid primary key default gen_random_uuid(),user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
 preference_version integer not null check(preference_version>0),target_risk_proxy numeric(8,4),preferred_core_weight numeric(8,6),preferred_satellite_weight numeric(8,6),target_region_weights jsonb not null default '{}'::jsonb,target_sector_weights jsonb not null default '{}'::jsonb,preferred_equity_weight numeric(8,6),preferred_fixed_income_weight numeric(8,6),concentration_tolerance numeric(8,6),created_at timestamptz not null default now(),unique(user_profile_id,preference_version));
alter table public.portfolio_preferences enable row level security;
alter table public.portfolio_proposals add column unmet_preferences jsonb not null default '[]'::jsonb;
alter table public.portfolio_proposals add column diagnostics jsonb not null default '[]'::jsonb;
commit;
