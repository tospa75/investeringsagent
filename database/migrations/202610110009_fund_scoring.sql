begin;
create type public.score_confidence as enum ('HIGH','MEDIUM','LOW');
create table public.fund_scores(
 id uuid primary key default gen_random_uuid(), user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
 fund_id uuid not null references public.funds(id) on delete cascade,
 risk_score numeric(6,3) not null check(risk_score between 0 and 100), geography_score numeric(6,3) not null check(geography_score between 0 and 100),
 sector_score numeric(6,3) not null check(sector_score between 0 and 100), cost_score numeric(6,3) not null check(cost_score between 0 and 100),
 fund_diversification_score numeric(6,3) not null check(fund_diversification_score between 0 and 100), quality_score numeric(6,3) not null check(quality_score between 0 and 100),
 performance_score numeric(6,3) not null check(performance_score between 0 and 100), total_score numeric(6,3) not null check(total_score between 0 and 100),
 score_confidence public.score_confidence not null, score_details jsonb not null, score_model_version text not null,
 profile_version integer not null, data_version jsonb not null, data_version_hash text not null,
 calculated_at timestamptz not null, created_at timestamptz not null default now(),
 unique(user_profile_id,fund_id,score_model_version,profile_version,data_version_hash));
create index fund_scores_profile_rank_idx on public.fund_scores(user_profile_id,profile_version,total_score desc);
alter table public.fund_scores enable row level security;
-- Profile-specific scores remain backend-only until authenticated ownership exists.
commit;
