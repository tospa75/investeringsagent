begin;
alter table public.user_profiles add column if not exists user_id uuid references auth.users(id) on delete cascade;
create index if not exists user_profiles_user_idx on public.user_profiles(user_id);

create policy "Users manage own profiles" on public.user_profiles for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "Users read own constraints" on public.user_constraints for select to authenticated using(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid()));
create policy "Users manage own constraints" on public.user_constraints for all to authenticated using(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid())) with check(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid()));
create policy "Users read own filter results" on public.fund_filter_results for select to authenticated using(exists(select 1 from public.user_profiles p where p.id=user_profile_id and p.user_id=auth.uid()));

create policy "Users manage own portfolios" on public.portfolios for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "Users manage own transactions" on public.transactions for all to authenticated using(exists(select 1 from public.portfolios p where p.id=portfolio_id and p.user_id=auth.uid())) with check(exists(select 1 from public.portfolios p where p.id=portfolio_id and p.user_id=auth.uid()));
create policy "Users read own transaction revisions" on public.transaction_revisions for select to authenticated using(exists(select 1 from public.transactions t join public.portfolios p on p.id=t.portfolio_id where t.id=transaction_id and p.user_id=auth.uid()));
create policy "Users read own portfolio snapshots" on public.portfolio_snapshots for select to authenticated using(exists(select 1 from public.portfolios p where p.id=portfolio_id and p.user_id=auth.uid()));
create policy "Users read own position snapshots" on public.portfolio_position_snapshots for select to authenticated using(exists(select 1 from public.portfolio_snapshots s join public.portfolios p on p.id=s.portfolio_id where s.id=portfolio_snapshot_id and p.user_id=auth.uid()));
create policy "Users read own monitoring events" on public.portfolio_monitoring_events for select to authenticated using(exists(select 1 from public.portfolios p where p.id=portfolio_id and p.user_id=auth.uid()));
create policy "Users update own monitoring events" on public.portfolio_monitoring_events for update to authenticated using(exists(select 1 from public.portfolios p where p.id=portfolio_id and p.user_id=auth.uid()));
create policy "Users read own rebalance plans" on public.rebalance_plans for select to authenticated using(exists(select 1 from public.portfolios p where p.id=portfolio_id and p.user_id=auth.uid()));
create policy "Users read own rebalance actions" on public.rebalance_plan_actions for select to authenticated using(exists(select 1 from public.rebalance_plans r join public.portfolios p on p.id=r.portfolio_id where r.id=rebalance_plan_id and p.user_id=auth.uid()));
commit;
