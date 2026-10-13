begin;
create type public.monitoring_event_severity as enum('INFO','WARNING','CRITICAL');
create type public.rebalance_plan_status as enum('IN_BALANCE','REBALANCE_RECOMMENDED','REBALANCE_REQUIRED','UNKNOWN');
create type public.rebalance_action_type as enum('BUY','SELL','HOLD');
create type public.rebalance_confidence as enum('HIGH','MEDIUM','LOW');

create table public.portfolio_monitoring_events(
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  event_key text not null,
  event_type text not null,
  severity public.monitoring_event_severity not null,
  fund_id uuid references public.funds(id) on delete restrict,
  message text not null,
  detected_at timestamptz not null default now(),
  data_version jsonb not null,
  resolved_at timestamptz,
  unique(portfolio_id,event_key)
);
create unique index portfolio_monitoring_events_unresolved_idx on public.portfolio_monitoring_events(portfolio_id,event_type,coalesce(fund_id,'00000000-0000-0000-0000-000000000000'::uuid)) where resolved_at is null;

create table public.rebalance_plans(
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  deterministic_key text not null,
  status public.rebalance_plan_status not null,
  confidence public.rebalance_confidence not null,
  target_model_version text not null,
  current_data_version jsonb not null,
  settings jsonb not null,
  new_cash_amount numeric(20,8) not null check(new_cash_amount>=0),
  drift_score numeric(12,10),
  total_turnover numeric(20,8) not null,
  estimated_cost numeric(20,8) not null,
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique(portfolio_id,deterministic_key)
);
create table public.rebalance_plan_actions(
  id uuid primary key default gen_random_uuid(),
  rebalance_plan_id uuid not null references public.rebalance_plans(id) on delete cascade,
  fund_id uuid not null references public.funds(id) on delete restrict,
  action_type public.rebalance_action_type not null,
  amount numeric(20,8),
  estimated_units numeric(24,10),
  reason text not null,
  priority integer not null check(priority>0),
  confidence public.rebalance_confidence not null,
  created_at timestamptz not null default now(),
  unique(rebalance_plan_id,fund_id,action_type,priority)
);
create index portfolio_monitoring_events_portfolio_idx on public.portfolio_monitoring_events(portfolio_id,detected_at desc);
create index rebalance_plans_portfolio_idx on public.rebalance_plans(portfolio_id,created_at desc);
alter table public.portfolio_monitoring_events enable row level security;
alter table public.rebalance_plans enable row level security;
alter table public.rebalance_plan_actions enable row level security;
commit;
