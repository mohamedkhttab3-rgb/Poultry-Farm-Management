-- Poultry Farm Manager
-- Finance expense categories: one reusable expense ledger per cycle.
alter table public.finance_entries add column if not exists expenses_json jsonb not null default '[]'::jsonb;
