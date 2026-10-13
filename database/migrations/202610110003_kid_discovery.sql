begin;

alter type public.data_validity add value if not exists 'INVALID';
alter type public.data_validity add value if not exists 'UNVERIFIED';
alter type public.data_validity add value if not exists 'FETCH_FAILED';
alter type public.document_type add value if not exists 'PRIIP_KID';
alter type public.document_type add value if not exists 'FACTSHEET';
alter type public.document_type add value if not exists 'PROSPECTUS';
alter type public.document_type add value if not exists 'OTHER';

create type public.ingestion_stage as enum ('KRON_DISCOVERY', 'KID_DISCOVERY');
alter table public.ingestion_runs add column stage public.ingestion_stage not null default 'KRON_DISCOVERY';
create index ingestion_runs_stage_idx on public.ingestion_runs (stage, started_at desc);

alter table public.fund_documents
  add column content_hash text,
  add column discovery_method text,
  add column provider_name text,
  add column http_status integer,
  add column content_type text,
  add column verification_notes jsonb not null default '[]'::jsonb;
create unique index fund_documents_fund_hash_unique
  on public.fund_documents (fund_id, content_hash) where content_hash is not null;

create unique index raw_kid_snapshots_fund_hash_unique
  on public.raw_source_snapshots (fund_id, source_type, content_hash)
  where source_type = 'KID';

commit;
