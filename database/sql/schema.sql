-- Supabase/PostgreSQL production starter schema
create extension if not exists pgcrypto;
create table profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, role text default 'owner', created_at timestamptz default now());
create table farms (id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles(id), name text not null, owner_name text, manager text, location text, created_at timestamptz default now());
create table houses (id uuid primary key default gen_random_uuid(), farm_id uuid not null references farms(id) on delete cascade, name text not null, capacity integer, created_at timestamptz default now());
create table cycles (id uuid primary key default gen_random_uuid(), farm_id uuid not null references farms(id) on delete cascade, house_id uuid references houses(id) on delete set null, start_date date not null, initial_birds integer not null, initial_weight_g numeric default 40, breed text, source text, status text default 'active', created_at timestamptz default now());
create table daily_records (id uuid primary key default gen_random_uuid(), cycle_id uuid not null references cycles(id) on delete cascade, record_date date not null, mortality integer default 0, cull integer default 0, feed_kg numeric default 0, water_l numeric default 0, avg_weight_kg numeric, temp_c numeric, humidity numeric, notes text);
create table weekly_weights (id uuid primary key default gen_random_uuid(), cycle_id uuid not null references cycles(id) on delete cascade, record_date date not null, sample_size integer, total_weight_kg numeric, avg_weight_kg numeric not null, min_weight_kg numeric, max_weight_kg numeric, cv_percent numeric);
create table sales (id uuid primary key default gen_random_uuid(), cycle_id uuid not null references cycles(id) on delete cascade, sale_date date not null, birds_count integer default 0, live_weight_kg numeric not null, price_per_kg numeric default 0, total_amount numeric default 0, buyer text, notes text);
create table feed_movements (id uuid primary key default gen_random_uuid(), cycle_id uuid references cycles(id) on delete set null, movement_date date not null, movement_type text not null, feed_type text, quantity_kg numeric not null, unit_cost numeric default 0);
create table health_records (id uuid primary key default gen_random_uuid(), cycle_id uuid not null references cycles(id) on delete cascade, record_date date not null, record_type text not null, product_name text, quantity numeric, cost numeric default 0, dose text, withdrawal_days integer default 0);
create table finance_entries (id uuid primary key default gen_random_uuid(), cycle_id uuid not null references cycles(id) on delete cascade, entry_date date not null, entry_type text not null, category text, amount numeric not null, notes text);
-- Enable RLS and add policies so users can only access farms they own or are assigned to.

-- V3.2 ownership and membership layer
create table farm_members (
  farm_id uuid not null references farms(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner','manager','supervisor','worker')),
  created_at timestamptz default now(),
  primary key (farm_id,user_id)
);

alter table farms enable row level security;
alter table houses enable row level security;
alter table cycles enable row level security;
alter table daily_records enable row level security;
alter table weekly_weights enable row level security;
alter table feed_movements enable row level security;
alter table health_records enable row level security;
alter table finance_entries enable row level security;
alter table cycle_sales enable row level security;
alter table farm_members enable row level security;

-- Production policies should be created after confirming the auth schema.
-- Example ownership policy pattern:
-- create policy farms_member_select on farms for select using (
--   owner_id = auth.uid() or exists (select 1 from farm_members fm where fm.farm_id=farms.id and fm.user_id=auth.uid())
-- );
-- Never expose a service-role key in the mobile app.
