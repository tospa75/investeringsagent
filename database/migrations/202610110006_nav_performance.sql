begin;
create type public.performance_quality as enum ('HIGH','MEDIUM','LOW','INSUFFICIENT');
create table public.fund_nav_history(
 id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
 nav_date date not null, nav numeric(20,8) not null check(nav>0), currency char(3) not null check(currency~'^[A-Z]{3}$'),
 value_basis text not null default 'NAV' check(value_basis in ('NAV','TOTAL_RETURN_INDEX')),
 source_type text not null, source_url text not null, retrieved_at timestamptz not null, content_hash text not null,
 quality_status public.performance_quality not null, data_anomaly boolean not null default false, created_at timestamptz not null default now(),
 unique(fund_id,nav_date,source_type)
);
create table public.fund_performance_metrics(
 id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
 as_of_date date not null, return_1m numeric(16,10), return_3m numeric(16,10), return_ytd numeric(16,10), return_1y numeric(16,10),
 return_3y_annualized numeric(16,10), return_5y_annualized numeric(16,10), return_10y_annualized numeric(16,10), return_since_inception numeric(16,10),
 volatility_1y numeric(16,10), volatility_3y numeric(16,10), volatility_5y numeric(16,10), max_drawdown numeric(16,10),
 drawdown_peak_date date, drawdown_trough_date date, recovery_date date, recovery_time_days integer,
 sharpe_ratio numeric(16,8), sortino_ratio numeric(16,8), calmar_ratio numeric(16,8),
 benchmark_excess_return numeric(16,10), tracking_error numeric(16,10), tracking_difference numeric(16,10),
 risk_free_rate_annual numeric(12,8) not null, minimum_acceptable_return numeric(12,8) not null,
 quality_status public.performance_quality not null, source_version text not null, calculated_at timestamptz not null default now(), warnings jsonb not null default '[]'::jsonb,
 unique(fund_id,as_of_date,source_version)
);
create index fund_nav_history_fund_date_idx on public.fund_nav_history(fund_id,nav_date);
create index fund_performance_metrics_fund_date_idx on public.fund_performance_metrics(fund_id,as_of_date desc);
alter table public.fund_nav_history enable row level security;alter table public.fund_performance_metrics enable row level security;
create policy "Public can read fund NAV history" on public.fund_nav_history for select to anon,authenticated using(true);
create policy "Public can read performance metrics" on public.fund_performance_metrics for select to anon,authenticated using(true);
commit;
