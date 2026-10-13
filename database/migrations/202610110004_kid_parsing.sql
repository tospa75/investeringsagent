begin;
alter type public.ingestion_stage add value if not exists 'KID_PARSING';
create type public.parser_status as enum ('SUCCESS', 'PARTIAL', 'FAILED', 'SKIPPED');
create type public.priip_scenario_type as enum ('STRESS', 'UNFAVOURABLE', 'MODERATE', 'FAVOURABLE');
alter table public.fund_costs add column fund_document_id uuid references public.fund_documents(id) on delete cascade;
alter table public.fund_costs add column is_current boolean not null default true;
alter table public.fund_risk add column fund_document_id uuid references public.fund_documents(id) on delete cascade;
alter table public.fund_risk add column risk_text text;
alter table public.fund_risk add column is_current boolean not null default true;
create unique index fund_costs_document_unique on public.fund_costs (fund_document_id) where fund_document_id is not null;
create unique index fund_risk_document_unique on public.fund_risk (fund_document_id) where fund_document_id is not null;
create table public.fund_priip_scenarios (
 id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
 fund_document_id uuid not null references public.fund_documents(id) on delete cascade, scenario_type public.priip_scenario_type not null,
 holding_period_years numeric(6,2) not null, investment_amount numeric(16,2), ending_value numeric(16,2),
 average_return_per_year numeric(12,8), currency char(3), source_url text not null, source_date date,
 retrieved_at timestamptz not null, is_current boolean not null default true, created_at timestamptz not null default now(),
 unique (fund_document_id, scenario_type, holding_period_years));
create table public.fund_product_details (
 id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
 fund_document_id uuid not null unique references public.fund_documents(id) on delete cascade,
 investment_objective text, investment_strategy text, intended_investor text, benchmark text, currency char(3),
 source_url text not null, source_date date, retrieved_at timestamptz not null, is_current boolean not null default true,
 created_at timestamptz not null default now());
create table public.kid_parser_runs (
 id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
 fund_document_id uuid references public.fund_documents(id) on delete set null, status public.parser_status not null,
 quality_score numeric(5,2) not null check (quality_score between 0 and 100), missing_fields jsonb not null default '[]'::jsonb,
 warnings jsonb not null default '[]'::jsonb, errors jsonb not null default '[]'::jsonb, reason text,
 started_at timestamptz not null, finished_at timestamptz not null, created_at timestamptz not null default now());
create index fund_priip_scenarios_fund_idx on public.fund_priip_scenarios (fund_id, is_current);
create index fund_product_details_fund_idx on public.fund_product_details (fund_id, is_current);
create index kid_parser_runs_fund_idx on public.kid_parser_runs (fund_id, started_at desc);
alter table public.fund_priip_scenarios enable row level security;
alter table public.fund_product_details enable row level security;
alter table public.kid_parser_runs enable row level security;
create policy "Public can read PRIIP scenarios" on public.fund_priip_scenarios for select to anon, authenticated using (true);
create policy "Public can read fund product details" on public.fund_product_details for select to anon, authenticated using (true);
commit;
