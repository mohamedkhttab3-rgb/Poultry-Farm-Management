-- Poultry Farm Manager V3.3
-- Supabase Auth + multi-tenant farm membership + RLS
-- Run in Supabase SQL Editor. Do NOT put the Service Role Key in the app.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'owner' check (role in ('owner','manager','supervisor','worker')),
  created_at timestamptz not null default now()
);

create table if not exists public.farms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  name text not null,
  owner_name text,
  manager text,
  location text,
  created_at timestamptz not null default now()
);

create table if not exists public.farm_members (
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','manager','supervisor','worker')),
  created_at timestamptz not null default now(),
  primary key (farm_id,user_id)
);

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(), farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null, capacity integer, created_at timestamptz not null default now()
);
create table if not exists public.cycles (
  id uuid primary key default gen_random_uuid(), farm_id uuid not null references public.farms(id) on delete cascade,
  house_id uuid references public.houses(id) on delete set null, date date not null, birds integer not null,
  init_weight numeric not null, breed text, source text, active boolean default true, created_at timestamptz not null default now()
);
create table if not exists public.daily_records (
  id uuid primary key default gen_random_uuid(), cycle_id uuid not null references public.cycles(id) on delete cascade,
  date date not null, dead integer default 0, cull integer default 0, feed numeric default 0, water numeric default 0,
  weight numeric, temp numeric, humidity numeric, notes text, created_at timestamptz not null default now()
);
create table if not exists public.weekly_weights (
  id uuid primary key default gen_random_uuid(), cycle_id uuid not null references public.cycles(id) on delete cascade,
  date date not null, sample integer, total numeric, avg numeric, min numeric, max numeric, cv numeric, created_at timestamptz not null default now()
);
create table if not exists public.feed_movements (
  id uuid primary key default gen_random_uuid(), cycle_id uuid references public.cycles(id) on delete cascade,
  date date not null, type text, qty numeric, price numeric, created_at timestamptz not null default now()
);
create table if not exists public.health_records (
  id uuid primary key default gen_random_uuid(), cycle_id uuid references public.cycles(id) on delete cascade,
  date date not null, type text, name text, qty numeric, cost numeric, dose text, withdrawal numeric, created_at timestamptz not null default now()
);
create table if not exists public.finance_entries (
  id uuid primary key default gen_random_uuid(), cycle_id uuid references public.cycles(id) on delete cascade,
  category text, amount numeric, entry_type text, created_at timestamptz not null default now()
);
create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(), cycle_id uuid not null references public.cycles(id) on delete cascade,
  date date not null, birds integer, weight_kg numeric, price numeric, total numeric, buyer text, created_at timestamptz not null default now()
);

-- New accounts get an owner profile. Farm ownership is granted explicitly below.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.profiles(id,full_name) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create or replace function public.user_can_access_farm(p_farm_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.farm_members m where m.farm_id=p_farm_id and m.user_id=auth.uid())
      or exists(select 1 from public.farms f where f.id=p_farm_id and f.owner_id=auth.uid());
$$;

create or replace function public.user_farm_role(p_farm_id uuid)
returns text language sql stable security definer set search_path=public as $$
  select coalesce(
    (select m.role from public.farm_members m where m.farm_id=p_farm_id and m.user_id=auth.uid()),
    (select 'owner' from public.farms f where f.id=p_farm_id and f.owner_id=auth.uid())
  );
$$;

create or replace function public.set_farm_member_role(p_farm_id uuid,p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if public.user_farm_role(p_farm_id) not in ('owner','manager') then raise exception 'not authorized'; end if;
  if p_role not in ('manager','supervisor','worker') then raise exception 'invalid role'; end if;
  insert into public.farm_members(farm_id,user_id,role) values(p_farm_id,p_user_id,p_role)
  on conflict(farm_id,user_id) do update set role=excluded.role;
end $$;

-- Owner automatically becomes a farm member.
create or replace function public.handle_new_farm()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  insert into public.farm_members(farm_id,user_id,role) values(new.id,new.owner_id,'owner') on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_farm_created on public.farms;
create trigger on_farm_created after insert on public.farms for each row execute procedure public.handle_new_farm();

-- RLS
alter table public.profiles enable row level security;
alter table public.farms enable row level security;
alter table public.farm_members enable row level security;
alter table public.houses enable row level security;
alter table public.cycles enable row level security;
alter table public.daily_records enable row level security;
alter table public.weekly_weights enable row level security;
alter table public.feed_movements enable row level security;
alter table public.health_records enable row level security;
alter table public.finance_entries enable row level security;
alter table public.sales enable row level security;

-- Profiles: user can read/update own profile; role changes should be done through the RPC, not direct client update.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select using(auth.uid()=id);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using(auth.uid()=id) with check(auth.uid()=id);

-- Farms and membership.
drop policy if exists farms_select_member on public.farms;
create policy farms_select_member on public.farms for select using(public.user_can_access_farm(id));
drop policy if exists farms_insert_owner on public.farms;
create policy farms_insert_owner on public.farms for insert with check(owner_id=auth.uid());
drop policy if exists farms_update_manager on public.farms;
create policy farms_update_manager on public.farms for update using(public.user_farm_role(id) in ('owner','manager')) with check(owner_id=auth.uid() or public.user_farm_role(id) in ('owner','manager'));
drop policy if exists farms_delete_owner on public.farms;
create policy farms_delete_owner on public.farms for delete using(public.user_farm_role(id)='owner');

drop policy if exists members_select_member on public.farm_members;
create policy members_select_member on public.farm_members for select using(public.user_can_access_farm(farm_id));
drop policy if exists members_insert_manager on public.farm_members;
create policy members_insert_manager on public.farm_members for insert with check(public.user_farm_role(farm_id) in ('owner','manager'));
drop policy if exists members_update_manager on public.farm_members;
create policy members_update_manager on public.farm_members for update using(public.user_farm_role(farm_id) in ('owner','manager')) with check(public.user_farm_role(farm_id) in ('owner','manager'));
drop policy if exists members_delete_manager on public.farm_members;
create policy members_delete_manager on public.farm_members for delete using(public.user_farm_role(farm_id) in ('owner','manager'));

-- Helper policies: all child tables inherit access from their farm through cycles/houses.
drop policy if exists houses_all on public.houses;
create policy houses_all on public.houses for all using(public.user_can_access_farm(farm_id)) with check(public.user_farm_role(farm_id) in ('owner','manager','supervisor','worker'));
drop policy if exists cycles_all on public.cycles;
create policy cycles_all on public.cycles for all using(public.user_can_access_farm(farm_id)) with check(public.user_farm_role(farm_id) in ('owner','manager','supervisor','worker'));

-- For operational child records, write access is limited to manager/supervisor/worker; finance deletes/changes can be restricted later.
drop policy if exists daily_all on public.daily_records;
create policy daily_all on public.daily_records for all using(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_can_access_farm(c.farm_id))) with check(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists weights_all on public.weekly_weights;
create policy weights_all on public.weekly_weights for all using(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_can_access_farm(c.farm_id))) with check(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists feed_all on public.feed_movements;
create policy feed_all on public.feed_movements for all using(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_can_access_farm(c.farm_id))) with check(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists health_all on public.health_records;
create policy health_all on public.health_records for all using(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_can_access_farm(c.farm_id))) with check(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists sales_all on public.sales;
create policy sales_all on public.sales for all using(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_can_access_farm(c.farm_id))) with check(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));

-- Finance: only owner/manager can change financial records; all farm members may read.
drop policy if exists finance_select on public.finance_entries;
create policy finance_select on public.finance_entries for select using(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_can_access_farm(c.farm_id)));
drop policy if exists finance_write on public.finance_entries;
create policy finance_write on public.finance_entries for all using(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager'))) with check(exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager')));

-- Never expose SECURITY DEFINER functions unnecessarily.
revoke all on function public.set_farm_member_role(uuid,uuid,text) from public;
grant execute on function public.set_farm_member_role(uuid,uuid,text) to authenticated;
revoke all on function public.user_can_access_farm(uuid) from public;
grant execute on function public.user_can_access_farm(uuid) to authenticated;
revoke all on function public.user_farm_role(uuid) from public;
grant execute on function public.user_farm_role(uuid) to authenticated;

-- Recommended before public launch:
-- 1) enforce email verification in Supabase Auth
-- 2) configure password reset redirect URL
-- 3) add audit_log and account deletion/export workflow
-- 4) add storage buckets with RLS if documents/photos are uploaded
-- 5) move all production writes from localStorage to these tables and add offline sync queue.
