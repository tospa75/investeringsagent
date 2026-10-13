begin;

create type public.exposure_quality as enum ('HIGH', 'MEDIUM', 'LOW', 'MISSING', 'CONFLICT');
create type public.exposure_scope as enum ('COMPLETE', 'PARTIAL');

create table public.exposure_datasets (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  source_type text not null,
  source_url text not null,
  source_date date,
  retrieved_at timestamptz not null,
  content_hash text not null,
  quality_status public.exposure_quality not null,
  geography_scope public.exposure_scope not null default 'PARTIAL',
  sector_scope public.exposure_scope not null default 'PARTIAL',
  top_10_weight numeric(10,6),
  largest_holding_weight numeric(10,6),
  number_of_reported_holdings integer not null default 0,
  cash_weight numeric(10,6),
  equity_weight numeric(10,6),
  bond_weight numeric(10,6),
  warnings jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.fund_geography add column dataset_id uuid references public.exposure_datasets(id) on delete cascade;
alter table public.fund_geography add column source_type text;
alter table public.fund_geography add column source_url text;
alter table public.fund_geography add column content_hash text;
alter table public.fund_geography add column quality_status public.exposure_quality;
alter table public.fund_sectors add column dataset_id uuid references public.exposure_datasets(id) on delete cascade;
alter table public.fund_sectors add column source_type text;
alter table public.fund_sectors add column source_url text;
alter table public.fund_sectors add column content_hash text;
alter table public.fund_sectors add column quality_status public.exposure_quality;
alter table public.fund_holdings add column dataset_id uuid references public.exposure_datasets(id) on delete cascade;
alter table public.fund_holdings add column source_type text;
alter table public.fund_holdings add column source_url text;
alter table public.fund_holdings add column content_hash text;
alter table public.fund_holdings add column quality_status public.exposure_quality;

create table public.fund_asset_allocations (
  id uuid primary key default gen_random_uuid(),
  fund_id uuid not null references public.funds(id) on delete cascade,
  dataset_id uuid not null references public.exposure_datasets(id) on delete cascade,
  asset_class text not null,
  weight numeric(10,6) not null check (weight between 0 and 100),
  source_date date,
  retrieved_at timestamptz not null,
  source_type text not null,
  source_url text not null,
  content_hash text not null,
  quality_status public.exposure_quality not null
);

create index exposure_datasets_fund_id_idx on public.exposure_datasets(fund_id);
create unique index exposure_datasets_version_uidx on public.exposure_datasets(fund_id, source_type, coalesce(source_date, '0001-01-01'::date), content_hash);
create index fund_asset_allocations_fund_id_idx on public.fund_asset_allocations(fund_id);
create unique index fund_geography_dataset_value_uidx on public.fund_geography(dataset_id, coalesce(region, ''), coalesce(country, '')) where dataset_id is not null;
create unique index fund_sectors_dataset_value_uidx on public.fund_sectors(dataset_id, sector) where dataset_id is not null;
create unique index fund_holdings_dataset_value_uidx on public.fund_holdings(dataset_id, lower(holding_name), coalesce(holding_identifier, '')) where dataset_id is not null;
create unique index fund_asset_allocations_dataset_value_uidx on public.fund_asset_allocations(dataset_id, asset_class);

alter table public.exposure_datasets enable row level security;
alter table public.fund_asset_allocations enable row level security;
create policy "Public can read exposure datasets" on public.exposure_datasets for select to anon, authenticated using (true);
create policy "Public can read fund asset allocations" on public.fund_asset_allocations for select to anon, authenticated using (true);

commit;
