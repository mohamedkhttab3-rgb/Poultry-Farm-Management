-- Poultry Farm Manager V3.4 Cloud Sync
-- Run after v3_3_rls.sql in Supabase SQL Editor.
-- Client uses only Project URL + Publishable/Anon key. Never ship secret/service_role.

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  item text not null,
  unit text,
  balance numeric not null default 0,
  min numeric not null default 0,
  created_at timestamptz not null default now()
);

alter table public.farms add column if not exists license_number text;
alter table public.farms add column if not exists company_name text;

create index if not exists farm_members_user_id_idx on public.farm_members(user_id);
create index if not exists houses_farm_id_idx on public.houses(farm_id);
create index if not exists cycles_farm_id_idx on public.cycles(farm_id);
create index if not exists daily_records_cycle_id_idx on public.daily_records(cycle_id);
create index if not exists weekly_weights_cycle_id_idx on public.weekly_weights(cycle_id);
create index if not exists feed_movements_cycle_id_idx on public.feed_movements(cycle_id);
create index if not exists health_records_cycle_id_idx on public.health_records(cycle_id);
create index if not exists finance_entries_cycle_id_idx on public.finance_entries(cycle_id);
create index if not exists sales_cycle_id_idx on public.sales(cycle_id);
create index if not exists inventory_items_farm_id_idx on public.inventory_items(farm_id);

alter table public.inventory_items enable row level security;

drop policy if exists inventory_select on public.inventory_items;
create policy inventory_select on public.inventory_items
for select to authenticated
using (public.user_can_access_farm(farm_id));

drop policy if exists inventory_insert on public.inventory_items;
create policy inventory_insert on public.inventory_items
for insert to authenticated
with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor','worker'));

drop policy if exists inventory_update on public.inventory_items;
create policy inventory_update on public.inventory_items
for update to authenticated
using (public.user_farm_role(farm_id) in ('owner','manager','supervisor','worker'))
with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor','worker'));

drop policy if exists inventory_delete on public.inventory_items;
create policy inventory_delete on public.inventory_items
for delete to authenticated
using (public.user_farm_role(farm_id) in ('owner','manager','supervisor'));

-- Tighten V3.3 policies by operation and role.
-- Read: all members. Create/edit: manager/supervisor/worker. Delete: manager/supervisor.
-- Farm administration remains owner/manager.

-- Child-table DELETE restrictions.
drop policy if exists daily_all on public.daily_records;
drop policy if exists daily_select on public.daily_records;
create policy daily_select on public.daily_records for select to authenticated
using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_can_access_farm(c.farm_id)));
drop policy if exists daily_insert on public.daily_records;
create policy daily_insert on public.daily_records for insert to authenticated
with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists daily_update on public.daily_records;
create policy daily_update on public.daily_records for update to authenticated
using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')))
with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists daily_delete on public.daily_records;
create policy daily_delete on public.daily_records for delete to authenticated
using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')));

drop policy if exists weights_all on public.weekly_weights;
drop policy if exists weights_select on public.weekly_weights;
create policy weights_select on public.weekly_weights for select to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_can_access_farm(c.farm_id)));
drop policy if exists weights_insert on public.weekly_weights;
create policy weights_insert on public.weekly_weights for insert to authenticated with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists weights_update on public.weekly_weights;
create policy weights_update on public.weekly_weights for update to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker'))) with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists weights_delete on public.weekly_weights;
create policy weights_delete on public.weekly_weights for delete to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')));

-- Feed / health / sales: same operational role model.
drop policy if exists feed_all on public.feed_movements;
drop policy if exists feed_select on public.feed_movements;
create policy feed_select on public.feed_movements for select to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_can_access_farm(c.farm_id)));
drop policy if exists feed_insert on public.feed_movements;
create policy feed_insert on public.feed_movements for insert to authenticated with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists feed_update on public.feed_movements;
create policy feed_update on public.feed_movements for update to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker'))) with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists feed_delete on public.feed_movements;
create policy feed_delete on public.feed_movements for delete to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')));

drop policy if exists health_all on public.health_records;
drop policy if exists health_select on public.health_records;
create policy health_select on public.health_records for select to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_can_access_farm(c.farm_id)));
drop policy if exists health_insert on public.health_records;
create policy health_insert on public.health_records for insert to authenticated with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists health_update on public.health_records;
create policy health_update on public.health_records for update to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker'))) with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists health_delete on public.health_records;
create policy health_delete on public.health_records for delete to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')));

drop policy if exists sales_all on public.sales;
drop policy if exists sales_select on public.sales;
create policy sales_select on public.sales for select to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_can_access_farm(c.farm_id)));
drop policy if exists sales_insert on public.sales;
create policy sales_insert on public.sales for insert to authenticated with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists sales_update on public.sales;
create policy sales_update on public.sales for update to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker'))) with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor','worker')));
drop policy if exists sales_delete on public.sales;
create policy sales_delete on public.sales for delete to authenticated using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')));

-- The RPC is the only supported way to manage a farm member role from the client.
-- It must also protect the owner from being overwritten.
create or replace function public.set_farm_member_role(p_farm_id uuid,p_user_id uuid,p_role text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if public.user_farm_role(p_farm_id) not in ('owner','manager') then raise exception 'not authorized'; end if;
  if p_role not in ('manager','supervisor','worker') then raise exception 'invalid role'; end if;
  if exists(select 1 from public.farms f where f.id=p_farm_id and f.owner_id=p_user_id) then raise exception 'farm owner role cannot be changed'; end if;
  insert into public.farm_members(farm_id,user_id,role) values(p_farm_id,p_user_id,p_role)
  on conflict(farm_id,user_id) do update set role=excluded.role;
end $$;
revoke all on function public.set_farm_member_role(uuid,uuid,text) from public;
grant execute on function public.set_farm_member_role(uuid,uuid,text) to authenticated;

-- Keep grants explicit for the client roles. RLS remains the row-level gate.
revoke all on table public.farms, public.farm_members, public.houses, public.cycles,
  public.daily_records, public.weekly_weights, public.feed_movements, public.health_records,
  public.finance_entries, public.sales, public.inventory_items, public.profiles from anon;
grant select,insert,update,delete on public.farms, public.farm_members, public.houses, public.cycles,
  public.daily_records, public.weekly_weights, public.feed_movements, public.health_records,
  public.finance_entries, public.sales, public.inventory_items to authenticated;
grant select,update on public.profiles to authenticated;

-- Last-write timestamps used by the client for offline conflict resolution.
alter table public.farms add column if not exists updated_at timestamptz not null default now();
alter table public.houses add column if not exists updated_at timestamptz not null default now();
alter table public.cycles add column if not exists updated_at timestamptz not null default now();
alter table public.daily_records add column if not exists updated_at timestamptz not null default now();
alter table public.weekly_weights add column if not exists updated_at timestamptz not null default now();
alter table public.feed_movements add column if not exists updated_at timestamptz not null default now();
alter table public.health_records add column if not exists updated_at timestamptz not null default now();
alter table public.finance_entries add column if not exists updated_at timestamptz not null default now();
alter table public.sales add column if not exists updated_at timestamptz not null default now();
alter table public.inventory_items add column if not exists updated_at timestamptz not null default now();

create table if not exists public.sync_tombstones (
  id bigint generated by default as identity primary key,
  farm_id uuid not null references public.farms(id) on delete cascade,
  entity text not null,
  record_id uuid not null,
  deleted_at timestamptz not null default now(),
  deleted_by uuid not null references auth.users(id) on delete cascade
);
alter table public.sync_tombstones enable row level security;
drop policy if exists sync_tombstones_select on public.sync_tombstones;
create policy sync_tombstones_select on public.sync_tombstones for select to authenticated
using (public.user_can_access_farm(farm_id));
drop policy if exists sync_tombstones_insert on public.sync_tombstones;
create policy sync_tombstones_insert on public.sync_tombstones for insert to authenticated
with check (deleted_by=(select auth.uid()) and public.user_farm_role(farm_id) in ('owner','manager','supervisor'));

-- One financial summary per cycle for the V3.4 form.
alter table public.finance_entries add column if not exists chicks numeric not null default 0;
alter table public.finance_entries add column if not exists labor numeric not null default 0;
alter table public.finance_entries add column if not exists utilities numeric not null default 0;
alter table public.finance_entries add column if not exists transport numeric not null default 0;
alter table public.finance_entries add column if not exists other numeric not null default 0;
alter table public.finance_entries add column if not exists sale_price numeric not null default 0;
alter table public.finance_entries add column if not exists other_revenue numeric not null default 0;

-- Make the RLS helper functions safe and efficient for the client.
create index if not exists farms_owner_id_idx on public.farms(owner_id);

-- Remove anonymous API access to helper RPCs.
revoke all on function public.user_can_access_farm(uuid) from public;
revoke all on function public.user_farm_role(uuid) from public;
grant execute on function public.user_can_access_farm(uuid) to authenticated;
grant execute on function public.user_farm_role(uuid) to authenticated;

-- Replace broad V3.3 child policies with explicit operation/role policies.
drop policy if exists houses_all on public.houses;
drop policy if exists houses_select on public.houses;
drop policy if exists houses_insert on public.houses;
drop policy if exists houses_update on public.houses;
drop policy if exists houses_delete on public.houses;
create policy houses_select on public.houses for select to authenticated using (public.user_can_access_farm(farm_id));
drop policy if exists houses_insert on public.houses;
create policy houses_insert on public.houses for insert to authenticated with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor','worker'));
drop policy if exists houses_update on public.houses;
create policy houses_update on public.houses for update to authenticated using (public.user_farm_role(farm_id) in ('owner','manager','supervisor')) with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor'));
drop policy if exists houses_delete on public.houses;
create policy houses_delete on public.houses for delete to authenticated using (public.user_farm_role(farm_id) in ('owner','manager','supervisor'));

drop policy if exists cycles_all on public.cycles;
drop policy if exists cycles_select on public.cycles;
drop policy if exists cycles_insert on public.cycles;
drop policy if exists cycles_update on public.cycles;
drop policy if exists cycles_delete on public.cycles;
create policy cycles_select on public.cycles for select to authenticated using (public.user_can_access_farm(farm_id));
drop policy if exists cycles_insert on public.cycles;
create policy cycles_insert on public.cycles for insert to authenticated with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor','worker'));
drop policy if exists cycles_update on public.cycles;
create policy cycles_update on public.cycles for update to authenticated using (public.user_farm_role(farm_id) in ('owner','manager','supervisor')) with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor'));
drop policy if exists cycles_delete on public.cycles;
create policy cycles_delete on public.cycles for delete to authenticated using (public.user_farm_role(farm_id) in ('owner','manager','supervisor'));

-- Users cannot change their own role from the client.
revoke update, insert, delete on public.profiles from authenticated;
grant select on public.profiles to authenticated;

-- V3.4.1 data fields: sale quantity/unit and finance currency.
alter table public.sales add column if not exists weight_qty numeric not null default 0;
alter table public.sales add column if not exists weight_unit text not null default 'kg';
do $$ begin if not exists (select 1 from pg_constraint where conname='sales_weight_unit_chk') then alter table public.sales add constraint sales_weight_unit_chk check (weight_unit in ('kg','bird')); end if; end $$;
alter table public.finance_entries add column if not exists currency text not null default 'SAR';
create index if not exists sales_weight_unit_idx on public.sales(weight_unit);

-- V3.4.3 technical metrics: true CV support
alter table if exists public.weekly_weights add column if not exists sd numeric default 0;
alter table if exists public.weekly_weights add column if not exists cv_method text;

-- V3.4.4: store individual sample weights so SD/CV can be recalculated consistently.
alter table if exists public.weekly_weights
  add column if not exists sample_weights jsonb not null default '[]'::jsonb;

create index if not exists weekly_weights_cycle_date_idx
  on public.weekly_weights(cycle_id, date);

-- V3.4.4 data-integrity helper: application treats one weekly weight record per cycle/date
-- as the canonical record and updates it instead of creating duplicates.

-- V3.4.5: production controls, currency consistency, and stronger user administration.
alter table public.cycles add column if not exists currency text not null default 'SAR';
alter table public.feed_movements add column if not exists currency text not null default 'SAR';
alter table public.health_records add column if not exists currency text not null default 'SAR';
alter table public.sales add column if not exists currency text not null default 'SAR';

do $$ begin
  if not exists (select 1 from pg_constraint where conname='cycles_currency_chk') then
    alter table public.cycles add constraint cycles_currency_chk check (currency in ('SAR','EGP','USD','AED','KWD','QAR','OMR','BHD','EUR'));
  end if;
  if not exists (select 1 from pg_constraint where conname='feed_currency_chk') then
    alter table public.feed_movements add constraint feed_currency_chk check (currency in ('SAR','EGP','USD','AED','KWD','QAR','OMR','BHD','EUR'));
  end if;
  if not exists (select 1 from pg_constraint where conname='health_currency_chk') then
    alter table public.health_records add constraint health_currency_chk check (currency in ('SAR','EGP','USD','AED','KWD','QAR','OMR','BHD','EUR'));
  end if;
  if not exists (select 1 from pg_constraint where conname='sales_currency_chk') then
    alter table public.sales add constraint sales_currency_chk check (currency in ('SAR','EGP','USD','AED','KWD','QAR','OMR','BHD','EUR'));
  end if;
end $$;

create index if not exists cycles_house_active_idx on public.cycles(house_id, active);
create index if not exists cycles_house_date_idx on public.cycles(house_id, date);
create index if not exists daily_cycle_date_idx on public.daily_records(cycle_id, date);

-- Prevent two active cycles from occupying the same house at the same time.
create or replace function public.prevent_multiple_active_cycles_per_house()
returns trigger language plpgsql as $$
begin
  if new.active = true and new.house_id is not null and exists(
    select 1 from public.cycles c
    where c.house_id = new.house_id and c.active = true and c.id <> new.id
  ) then
    raise exception 'This house already has an active cycle. Close the current cycle before opening another one.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_one_active_cycle_per_house on public.cycles;
create trigger trg_one_active_cycle_per_house
before insert or update of house_id, active on public.cycles
for each row execute function public.prevent_multiple_active_cycles_per_house();

-- Safer account model: the first registered account is the owner; later self-registered
-- accounts start as worker until the owner assigns them a farm role.
alter table public.profiles alter column role set default 'worker';
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_role text;
begin
  perform pg_advisory_xact_lock(741852963);
  if not exists(select 1 from public.profiles) then
    new_role := 'owner';
  else
    new_role := 'worker';
  end if;
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new_role)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Assign a farm role by employee email; no service-role key is needed in the app.
create or replace function public.set_farm_member_by_email(p_farm_id uuid,p_email text,p_role text)
returns void language plpgsql security definer set search_path=public,auth as $$
declare
  target_user uuid;
begin
  if public.user_farm_role(p_farm_id) not in ('owner','manager') then raise exception 'not authorized'; end if;
  if p_role not in ('manager','supervisor','worker') then raise exception 'invalid role'; end if;
  select id into target_user from auth.users where lower(email)=lower(trim(p_email)) limit 1;
  if target_user is null then raise exception 'employee account not found'; end if;
  if exists(select 1 from public.farms f where f.id=p_farm_id and f.owner_id=target_user) then raise exception 'farm owner role cannot be changed'; end if;
  insert into public.farm_members(farm_id,user_id,role) values(p_farm_id,target_user,p_role)
  on conflict(farm_id,user_id) do update set role=excluded.role;
end;
$$;
revoke all on function public.set_farm_member_by_email(uuid,text,text) from public;
grant execute on function public.set_farm_member_by_email(uuid,text,text) to authenticated;

-- Member listing is scoped to a farm and only available to its owner/manager.
create or replace function public.list_farm_members(p_farm_id uuid)
returns table(user_id uuid, role text, full_name text, email text)
language plpgsql security definer set search_path=public,auth as $$
begin
  if public.user_farm_role(p_farm_id) not in ('owner','manager') then raise exception 'not authorized'; end if;
  return query
  select m.user_id,m.role,p.full_name,u.email
  from public.farm_members m
  left join public.profiles p on p.id=m.user_id
  left join auth.users u on u.id=m.user_id
  where m.farm_id=p_farm_id
  order by p.full_name,u.email;
end;
$$;
revoke all on function public.list_farm_members(uuid) from public;
grant execute on function public.list_farm_members(uuid) to authenticated;

-- V3.4.5 role boundaries: Worker creates operational entries but cannot edit/delete,
-- and cannot create or administer farms/houses/cycles/inventory.
drop policy if exists houses_insert on public.houses;
create policy houses_insert on public.houses for insert to authenticated
with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor'));
drop policy if exists houses_update on public.houses;
create policy houses_update on public.houses for update to authenticated
using (public.user_farm_role(farm_id) in ('owner','manager','supervisor'))
with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor'));

drop policy if exists cycles_insert on public.cycles;
create policy cycles_insert on public.cycles for insert to authenticated
with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor'));
drop policy if exists cycles_update on public.cycles;
create policy cycles_update on public.cycles for update to authenticated
using (public.user_farm_role(farm_id) in ('owner','manager','supervisor'))
with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor'));

drop policy if exists inventory_insert on public.inventory_items;
create policy inventory_insert on public.inventory_items for insert to authenticated
with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor'));
drop policy if exists inventory_update on public.inventory_items;
create policy inventory_update on public.inventory_items for update to authenticated
using (public.user_farm_role(farm_id) in ('owner','manager','supervisor'))
with check (public.user_farm_role(farm_id) in ('owner','manager','supervisor'));

drop policy if exists daily_update on public.daily_records;
create policy daily_update on public.daily_records for update to authenticated
using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')))
with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')));
drop policy if exists weights_update on public.weekly_weights;
create policy weights_update on public.weekly_weights for update to authenticated
using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')))
with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')));
drop policy if exists feed_update on public.feed_movements;
create policy feed_update on public.feed_movements for update to authenticated
using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')))
with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')));
drop policy if exists health_update on public.health_records;
create policy health_update on public.health_records for update to authenticated
using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')))
with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')));
drop policy if exists sales_update on public.sales;
create policy sales_update on public.sales for update to authenticated
using (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')))
with check (exists(select 1 from public.cycles c where c.id=cycle_id and public.user_farm_role(c.farm_id) in ('owner','manager','supervisor')));
