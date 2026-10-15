-- Poultry Farm Manager V3.5.2 stability migration
-- Safe to run on an existing V3.5/V3.5.1 database.
-- The sales ledger remains the source of truth for actual sales revenue.
alter table if exists public.finance_entries add column if not exists actual_sales_revenue numeric not null default 0;
alter table if exists public.finance_entries add column if not exists actual_sold_birds numeric not null default 0;
alter table if exists public.finance_entries add column if not exists actual_sold_kg numeric not null default 0;
alter table if exists public.finance_entries add column if not exists total_revenue numeric not null default 0;
alter table if exists public.finance_entries add column if not exists total_cost numeric not null default 0;
alter table if exists public.finance_entries add column if not exists profit_loss numeric not null default 0;
alter table if exists public.finance_entries add column if not exists computed_at timestamptz;
