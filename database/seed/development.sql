-- DEVELOPMENT SEED DATA ONLY. These fictional records must never be treated as production data.
insert into public.funds (isin, name, manager, share_class, currency, fund_type, category, active_passive, available_on_kron)
values
  ('NO0012345678', '[DEV] Nordic Index Test Fund', 'Development Asset Management', 'A', 'NOK', 'equity', 'Nordic equities', 'passive', true),
  ('SE0098765432', '[DEV] Global Bond Test Fund', 'Example Capital', 'B', 'SEK', 'bond', 'Global bonds', 'active', false)
on conflict (isin) do nothing;
