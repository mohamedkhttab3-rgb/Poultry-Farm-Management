-- V3.4.5 migration for an existing V3.4.4 Supabase database.
-- Run after V3.4.4/V3.4 cloud SQL.

alter table public.cycles add column if not exists currency text not null default 'SAR';
alter table public.feed_movements add column if not exists currency text not null default 'SAR';
alter table public.health_records add column if not exists currency text not null default 'SAR';
alter table public.sales add column if not exists currency text not null default 'SAR';

alter table public.profiles alter column role set default 'worker';

create index if not exists cycles_house_active_idx on public.cycles(house_id, active);
create index if not exists cycles_house_date_idx on public.cycles(house_id, date);
create index if not exists daily_cycle_date_idx on public.daily_records(cycle_id, date);

create or replace function public.prevent_multiple_active_cycles_per_house()
returns trigger language plpgsql as $$
begin
  if new.active = true and new.house_id is not null and exists(
    select 1 from public.cycles c
    where c.house_id = new.house_id and c.active = true and c.id <> new.id
  ) then
    raise exception 'This house already has an active cycle.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_one_active_cycle_per_house on public.cycles;
create trigger trg_one_active_cycle_per_house
before insert or update of house_id, active on public.cycles
for each row execute function public.prevent_multiple_active_cycles_per_house();

-- Safer registration: first account owner, later accounts worker.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public as $$
declare new_role text;
begin
  perform pg_advisory_xact_lock(741852963);
  if not exists(select 1 from public.profiles) then new_role := 'owner'; else new_role := 'worker'; end if;
  insert into public.profiles(id,full_name,role)
  values(new.id,coalesce(new.raw_user_meta_data->>'full_name',new.email),new_role)
  on conflict(id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.set_farm_member_by_email(p_farm_id uuid,p_email text,p_role text)
returns void language plpgsql security definer set search_path=public,auth as $$
declare target_user uuid;
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

do $$ begin
  if not exists (select 1 from pg_constraint where conname='cycles_currency_chk') then alter table public.cycles add constraint cycles_currency_chk check (currency in ('SAR','EGP','USD','AED','KWD','QAR','OMR','BHD','EUR')); end if;
  if not exists (select 1 from pg_constraint where conname='feed_currency_chk') then alter table public.feed_movements add constraint feed_currency_chk check (currency in ('SAR','EGP','USD','AED','KWD','QAR','OMR','BHD','EUR')); end if;
  if not exists (select 1 from pg_constraint where conname='health_currency_chk') then alter table public.health_records add constraint health_currency_chk check (currency in ('SAR','EGP','USD','AED','KWD','QAR','OMR','BHD','EUR')); end if;
  if not exists (select 1 from pg_constraint where conname='sales_currency_chk') then alter table public.sales add constraint sales_currency_chk check (currency in ('SAR','EGP','USD','AED','KWD','QAR','OMR','BHD','EUR')); end if;
end $$;
