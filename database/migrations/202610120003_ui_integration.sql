begin;
create table public.user_profile_revisions(
 id uuid primary key default gen_random_uuid(),user_profile_id uuid not null references public.user_profiles(id) on delete cascade,
 profile_version integer not null,mutation_key text not null,snapshot jsonb not null,created_at timestamptz not null default now(),
 unique(user_profile_id,profile_version),unique(user_profile_id,mutation_key));
alter table public.user_profile_revisions enable row level security;
create policy "Users read own profile revisions" on public.user_profile_revisions for select to authenticated using(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid()));
create policy "Users create own profile revisions" on public.user_profile_revisions for insert to authenticated with check(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid()));

alter table public.portfolios add column if not exists client_portfolio_id text;
create unique index if not exists portfolios_user_client_unique on public.portfolios(user_id,client_portfolio_id) where client_portfolio_id is not null;

create policy "Users read own preferences" on public.user_preferences for select to authenticated using(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid()));
create policy "Users create own preferences" on public.user_preferences for insert to authenticated with check(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid()));
create policy "Users read own portfolio preferences" on public.portfolio_preferences for select to authenticated using(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid()));
create policy "Users create own portfolio preferences" on public.portfolio_preferences for insert to authenticated with check(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid()));
create policy "Users read own fund scores" on public.fund_scores for select to authenticated using(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid()));
create policy "Users read own proposals" on public.portfolio_proposals for select to authenticated using(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid()));
create policy "Users read own proposal funds" on public.portfolio_proposal_funds for select to authenticated using(exists(select 1 from public.portfolio_proposals pp join public.user_profiles p on p.id=pp.user_profile_id where pp.id=proposal_id and p.user_id=auth.uid()));
commit;
