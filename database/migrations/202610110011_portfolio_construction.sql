begin;
create type public.portfolio_proposal_type as enum('SIMPLE','BALANCED','OFFENSIVE');
create type public.portfolio_fund_role as enum('CORE','REGION','SECTOR','THEMATIC','SMALL_CAP','EMERGING_MARKETS','FIXED_INCOME','TACTICAL');
create table public.portfolio_proposals(
 id uuid primary key default gen_random_uuid(),user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
 proposal_type public.portfolio_proposal_type not null,portfolio_score numeric(6,3) not null check(portfolio_score between 0 and 100),
 risk_score numeric(6,3) not null check(risk_score between 0 and 100),diversification_score numeric(6,3) not null check(diversification_score between 0 and 100),preference_score numeric(6,3) not null check(preference_score between 0 and 100),cost_score numeric(6,3) not null check(cost_score between 0 and 100),robustness_score numeric(6,3) not null check(robustness_score between 0 and 100),simplicity_score numeric(6,3) not null check(simplicity_score between 0 and 100),portfolio_confidence public.score_confidence not null,
 metrics jsonb not null,explanations jsonb not null,model_version text not null,score_model_version text not null,profile_version integer not null,preference_version integer not null,data_version jsonb not null,data_version_hash text not null,calculated_at timestamptz not null,created_at timestamptz not null default now(),
 unique(user_profile_id,proposal_type,model_version,score_model_version,profile_version,preference_version,data_version_hash));
create table public.portfolio_proposal_funds(id uuid primary key default gen_random_uuid(),proposal_id uuid not null references public.portfolio_proposals(id) on delete cascade,fund_id uuid not null references public.funds(id) on delete cascade,target_weight numeric(9,8) not null check(target_weight>0 and target_weight<=1),role public.portfolio_fund_role not null,fund_score numeric(6,3) not null,marginal_contribution numeric(8,4) not null,explanation text not null,unique(proposal_id,fund_id));
create index portfolio_proposals_profile_idx on public.portfolio_proposals(user_profile_id,profile_version);
create index portfolio_proposal_funds_proposal_idx on public.portfolio_proposal_funds(proposal_id);
alter table public.portfolio_proposals enable row level security;alter table public.portfolio_proposal_funds enable row level security;
-- Profile-specific proposals remain backend-only until authenticated ownership exists.
commit;
