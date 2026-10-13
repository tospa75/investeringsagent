begin;

create extension if not exists pgcrypto;

create type public.data_quality as enum ('HIGH', 'MEDIUM', 'LOW', 'UNKNOWN');
create type public.data_validity as enum ('VALID', 'STALE', 'CONFLICT', 'MISSING');
create type public.holding_type as enum ('equity', 'bond', 'fund', 'cash', 'other');
create type public.document_type as enum ('KID', 'PRIIP', 'factsheet', 'prospectus', 'SFDR', 'other');
create type public.ingestion_status as enum ('SUCCESS', 'PARTIAL', 'FAILED');
create type public.active_passive_type as enum ('active', 'passive', 'unknown');

create table public.funds (
  id uuid primary key default gen_random_uuid(),
  isin text not null check (isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  name text not null check (length(trim(name)) > 0),
  manager text not null check (length(trim(manager)) > 0),
  share_class text not null check (length(trim(share_class)) > 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  fund_type text not null,
  category text,
  active_passive public.active_passive_type not null default 'unknown',
  benchmark text,
  inception_date date,
  kron_url text,
  available_on_kron boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint funds_isin_share_class_unique unique (isin, share_class)
);
create index funds_isin_idx on public.funds (isin);

create table public.fund_costs (
  id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
  management_fee numeric(10,6), platform_fee numeric(10,6), transaction_cost numeric(10,6),
  performance_fee numeric(10,6), entry_fee numeric(10,6), exit_fee numeric(10,6), total_annual_cost numeric(10,6),
  source_url text, source_date date, retrieved_at timestamptz not null default now(), created_at timestamptz not null default now(),
  check (management_fee is null or management_fee >= 0), check (total_annual_cost is null or total_annual_cost >= 0)
);
create index fund_costs_fund_id_idx on public.fund_costs (fund_id);

create table public.fund_risk (
  id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
  priip_risk_score smallint check (priip_risk_score between 1 and 7), recommended_holding_period_years numeric(6,2),
  volatility numeric(10,6), max_drawdown numeric(10,6), recovery_time_days integer check (recovery_time_days is null or recovery_time_days >= 0),
  source_url text, source_date date, retrieved_at timestamptz not null default now(), created_at timestamptz not null default now()
);
create index fund_risk_fund_id_idx on public.fund_risk (fund_id);

create table public.fund_geography (
  id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
  region text, country text, weight numeric(10,6) not null check (weight between 0 and 100), source_date date,
  retrieved_at timestamptz not null default now(), check (region is not null or country is not null)
);
create index fund_geography_fund_id_idx on public.fund_geography (fund_id);

create table public.fund_sectors (
  id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
  sector text not null, weight numeric(10,6) not null check (weight between 0 and 100), source_date date, retrieved_at timestamptz not null default now()
);
create index fund_sectors_fund_id_idx on public.fund_sectors (fund_id);

create table public.fund_holdings (
  id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
  holding_name text not null, holding_identifier text, holding_type public.holding_type not null,
  weight numeric(10,6) not null check (weight between 0 and 100), source_date date, retrieved_at timestamptz not null default now()
);
create index fund_holdings_fund_id_idx on public.fund_holdings (fund_id);

create table public.fund_documents (
  id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
  document_type public.document_type not null, source_url text not null, publication_date date, retrieved_at timestamptz not null default now(),
  isin_verified boolean not null default false, share_class_verified boolean not null default false,
  document_status public.data_validity not null default 'MISSING', created_at timestamptz not null default now()
);
create index fund_documents_fund_id_idx on public.fund_documents (fund_id);

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(), fund_id uuid references public.funds(id) on delete set null,
  started_at timestamptz not null default now(), finished_at timestamptz, status public.ingestion_status not null,
  data_quality_score numeric(5,2) check (data_quality_score is null or data_quality_score between 0 and 100),
  warnings jsonb not null default '[]'::jsonb, errors jsonb not null default '[]'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb, created_at timestamptz not null default now(),
  check (finished_at is null or finished_at >= started_at)
);
create index ingestion_runs_fund_id_idx on public.ingestion_runs (fund_id);

create table public.raw_source_snapshots (
  id uuid primary key default gen_random_uuid(), fund_id uuid references public.funds(id) on delete set null,
  source_type text not null, source_url text not null, content_hash text not null,
  raw_content jsonb not null, retrieved_at timestamptz not null default now(), created_at timestamptz not null default now(),
  constraint raw_source_snapshots_hash_unique unique (content_hash)
);
create index raw_source_snapshots_fund_id_idx on public.raw_source_snapshots (fund_id);

create function public.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
create trigger funds_set_updated_at before update on public.funds for each row execute function public.set_updated_at();

alter table public.funds enable row level security;
alter table public.fund_costs enable row level security;
alter table public.fund_risk enable row level security;
alter table public.fund_geography enable row level security;
alter table public.fund_sectors enable row level security;
alter table public.fund_holdings enable row level security;
alter table public.fund_documents enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.raw_source_snapshots enable row level security;

-- Public catalogue data is readable through the anon client. All writes remain backend-only.
create policy "Public can read funds" on public.funds for select to anon, authenticated using (true);
create policy "Public can read fund costs" on public.fund_costs for select to anon, authenticated using (true);
create policy "Public can read fund risk" on public.fund_risk for select to anon, authenticated using (true);
create policy "Public can read fund geography" on public.fund_geography for select to anon, authenticated using (true);
create policy "Public can read fund sectors" on public.fund_sectors for select to anon, authenticated using (true);
create policy "Public can read fund holdings" on public.fund_holdings for select to anon, authenticated using (true);
create policy "Public can read fund documents" on public.fund_documents for select to anon, authenticated using (true);

commit;
