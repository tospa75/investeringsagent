begin;
create table public.user_preferences(
 id uuid primary key default gen_random_uuid(), user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
 preference_version integer not null check(preference_version>0), preference_type text not null,
 dimension text, target_value numeric(12,8), preference_value text, strength numeric(6,5) not null check(strength between 0 and 1),
 created_at timestamptz not null default now(),
 constraint user_preferences_version_unique unique nulls not distinct(user_profile_id,preference_version,preference_type,dimension)
);
create index user_preferences_profile_version_idx on public.user_preferences(user_profile_id,preference_version);
alter table public.user_preferences enable row level security;
alter table public.fund_scores add column preference_version integer not null default 1 check(preference_version>0);
alter table public.fund_scores drop constraint if exists fund_scores_user_profile_id_fund_id_score_model_version_pro_key;
alter table public.fund_scores add constraint fund_scores_version_unique unique(user_profile_id,fund_id,score_model_version,profile_version,preference_version,data_version_hash);
commit;
