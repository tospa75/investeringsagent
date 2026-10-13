begin;

-- Discovery must preserve unknown source fields as NULL rather than inventing values.
alter table public.funds alter column manager drop not null;
alter table public.funds alter column share_class drop not null;
alter table public.funds alter column currency drop not null;
alter table public.funds alter column fund_type drop not null;
alter table public.funds drop constraint funds_isin_share_class_unique;
alter table public.funds add constraint funds_isin_unique unique (isin);

-- Deduplicate the same payload from the same source; identical content from another source remains valid.
alter table public.raw_source_snapshots drop constraint raw_source_snapshots_hash_unique;
alter table public.raw_source_snapshots
  add constraint raw_source_snapshots_source_hash_unique unique (source_type, source_url, content_hash);

commit;
