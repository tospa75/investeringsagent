begin;
create table public.fund_management_styles(
 id uuid primary key default gen_random_uuid(), fund_id uuid not null references public.funds(id) on delete cascade,
 active_passive public.active_passive_type not null, source_type text not null, source_url text not null,
 source_date date, retrieved_at timestamptz not null, content_hash text not null,
 data_quality public.data_quality not null, evidence text, created_at timestamptz not null default now(),
 unique(fund_id,source_type,content_hash)
);
create index fund_management_styles_fund_id_idx on public.fund_management_styles(fund_id);
alter table public.fund_management_styles enable row level security;
create policy "Public can read fund management styles" on public.fund_management_styles for select to anon,authenticated using(true);
commit;
