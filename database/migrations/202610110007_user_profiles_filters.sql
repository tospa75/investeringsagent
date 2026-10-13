begin;
create type public.filter_status as enum('PASS','FAIL','UNKNOWN');
create table public.user_profiles(
 id uuid primary key default gen_random_uuid(), profile_name text not null unique, investment_horizon_years numeric(6,2) not null check(investment_horizon_years>0),
 investment_goal text not null, goal_flexibility smallint not null check(goal_flexibility between 1 and 5),
 risk_willingness_score smallint not null check(risk_willingness_score between 1 and 7), risk_capacity_score smallint not null check(risk_capacity_score between 1 and 7),
 liquidity_need_score smallint not null check(liquidity_need_score between 1 and 5), initial_amount numeric(18,2) not null default 0 check(initial_amount>=0), monthly_contribution numeric(18,2) not null default 0 check(monthly_contribution>=0),
 investment_mode text not null, account_type text not null, management_style_preference text not null check(management_style_preference in('ONLY_PASSIVE','PREFER_PASSIVE','ANY','PREFER_ACTIVE','ONLY_ACTIVE')),
 cost_sensitivity smallint not null check(cost_sensitivity between 1 and 5), currency_hedging_preference text not null, esg_importance smallint not null check(esg_importance between 1 and 5),
 target_fund_count integer not null check(target_fund_count>0), max_fund_count integer not null check(max_fund_count>=target_fund_count),
 max_weight_per_fund numeric(8,6) not null check(max_weight_per_fund between 0 and 1), min_weight_per_fund numeric(8,6) not null check(min_weight_per_fund between 0 and 1),
 target_annual_return numeric(10,8), target_end_value numeric(18,2), tactical_view_enabled boolean not null default false,
 profile_version integer not null default 1 check(profile_version>0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(min_weight_per_fund<=max_weight_per_fund)
);
create table public.user_constraints(
 id uuid primary key default gen_random_uuid(), user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
 constraint_type text not null, dimension text, operator text not null check(operator in('<=','>=','=','EXCLUDE','IN','NOT_IN')),
 value_numeric numeric(12,8), value_text text, is_hard boolean not null default true, priority integer not null default 100, created_at timestamptz not null default now()
);
create table public.fund_filter_results(
 id uuid primary key default gen_random_uuid(), user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
 fund_id uuid not null references public.funds(id) on delete cascade, overall_status public.filter_status not null,
 reasons jsonb not null, evaluated_at timestamptz not null default now(), profile_version integer not null, data_version jsonb not null, data_version_hash text not null,
 unique(user_profile_id,fund_id,profile_version,data_version_hash)
);
create index user_constraints_profile_idx on public.user_constraints(user_profile_id);
create index fund_filter_results_profile_idx on public.fund_filter_results(user_profile_id,profile_version);
alter table public.user_profiles enable row level security;alter table public.user_constraints enable row level security;alter table public.fund_filter_results enable row level security;
-- Profiles contain personal financial inputs: no public policies. Access is backend-only until authentication ownership is introduced.
commit;
