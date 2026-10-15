-- Poultry Farm Manager V3.4.6 migration
-- Run after V3.4.5 migration in Supabase SQL Editor.
-- No service-role key belongs in the application.

-- 1) One project/company currency per owner.
create table if not exists public.company_settings (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'SAR',
  updated_at timestamptz not null default now()
);
alter table public.company_settings enable row level security;
drop policy if exists company_settings_select on public.company_settings;
create policy company_settings_select on public.company_settings for select to authenticated
using (exists(select 1 from public.farms f where f.owner_id=public.company_settings.owner_id and public.user_can_access_farm(f.id)) or owner_id=(select auth.uid()));
drop policy if exists company_settings_insert on public.company_settings;
create policy company_settings_insert on public.company_settings for insert to authenticated
with check (owner_id=(select auth.uid()));
drop policy if exists company_settings_update on public.company_settings;
create policy company_settings_update on public.company_settings for update to authenticated
using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));

-- 2) Performance standards by breed and age.
create table if not exists public.performance_rules (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  breed text not null,
  age_day integer not null default 0,
  target_weight numeric not null default 0,
  target_fcr numeric not null default 0,
  target_adg numeric not null default 0,
  max_cv numeric not null default 0,
  min_epef numeric not null default 0,
  max_mortality numeric not null default 0,
  updated_at timestamptz not null default now(),
  unique(owner_id,breed,age_day)
);
alter table public.performance_rules enable row level security;
drop policy if exists performance_rules_select on public.performance_rules;
create policy performance_rules_select on public.performance_rules for select to authenticated
using (owner_id=(select auth.uid()) or exists(select 1 from public.farms f where f.owner_id=public.performance_rules.owner_id and public.user_can_access_farm(f.id)));
drop policy if exists performance_rules_insert on public.performance_rules;
create policy performance_rules_insert on public.performance_rules for insert to authenticated
with check (owner_id=(select auth.uid()));
drop policy if exists performance_rules_update on public.performance_rules;
create policy performance_rules_update on public.performance_rules for update to authenticated
using (owner_id=(select auth.uid())) with check (owner_id=(select auth.uid()));
drop policy if exists performance_rules_delete on public.performance_rules;
create policy performance_rules_delete on public.performance_rules for delete to authenticated
using (owner_id=(select auth.uid()));

-- 3) Audit log. Append-only from the application; users can read only their company/farms.
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete set null,
  action text not null,
  entity text not null,
  record_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_select on public.audit_logs;
create policy audit_logs_select on public.audit_logs for select to authenticated
using (user_id=(select auth.uid()) or (farm_id is not null and public.user_can_access_farm(farm_id)));
drop policy if exists audit_logs_insert on public.audit_logs;
create policy audit_logs_insert on public.audit_logs for insert to authenticated
with check (user_id=(select auth.uid()));
revoke update,delete on public.audit_logs from authenticated;
grant select,insert on public.audit_logs to authenticated;

-- 4) Employee invitations. Recipient accepts only if the signed-in email matches.
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  email text not null,
  role text not null check(role in ('manager','supervisor','worker')),
  token text not null unique,
  invited_by uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check(status in ('pending','accepted','expired','cancelled')),
  expires_at timestamptz not null default (now()+interval '7 days'),
  created_at timestamptz not null default now()
);
alter table public.invitations enable row level security;
drop policy if exists invitations_select on public.invitations;
create policy invitations_select on public.invitations for select to authenticated
using (invited_by=(select auth.uid()) or public.user_farm_role(farm_id) in ('owner','manager') or lower(email)=lower((select email from auth.users where id=(select auth.uid()))));
drop policy if exists invitations_insert on public.invitations;
create policy invitations_insert on public.invitations for insert to authenticated
with check (public.user_farm_role(farm_id) in ('owner','manager') and invited_by=(select auth.uid()));
drop policy if exists invitations_update on public.invitations;
create policy invitations_update on public.invitations for update to authenticated
using (invited_by=(select auth.uid()) or lower(email)=lower((select email from auth.users where id=(select auth.uid()))))
with check (invited_by=(select auth.uid()) or lower(email)=lower((select email from auth.users where id=(select auth.uid()))));

create or replace function public.accept_farm_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare inv record; me text; uid uuid;
begin
  uid:=auth.uid();
  if uid is null then raise exception 'not authenticated'; end if;
  select lower(email) into me from auth.users where id=uid;
  select * into inv from public.invitations where token=p_token and status='pending' and expires_at>now() for update;
  if not found then raise exception 'invitation not found or expired'; end if;
  if lower(inv.email)<>me then raise exception 'invitation email does not match signed-in account'; end if;
  insert into public.farm_members(farm_id,user_id,role) values(inv.farm_id,uid,inv.role)
  on conflict(farm_id,user_id) do update set role=excluded.role;
  update public.invitations set status='accepted' where id=inv.id;
  return jsonb_build_object('farm_id',inv.farm_id,'role',inv.role,'status','accepted');
end $$;
revoke all on function public.accept_farm_invitation(text) from public;
grant execute on function public.accept_farm_invitation(text) to authenticated;

-- Helpful indexes.
create index if not exists performance_rules_owner_breed_age_idx on public.performance_rules(owner_id,breed,age_day);
create index if not exists audit_logs_farm_created_idx on public.audit_logs(farm_id,created_at desc);
create index if not exists invitations_farm_status_idx on public.invitations(farm_id,status);

-- 5) Keep one active cycle per house at the database level.
create unique index if not exists cycles_one_active_per_house_idx on public.cycles(house_id) where active=true;

-- 6) Optional audit trigger for direct SQL changes to core operational tables.
-- The application already writes descriptive audit entries; this trigger adds a safety net for DB-side changes.
create or replace function public.audit_core_change() returns trigger language plpgsql security definer set search_path=public as $$
declare farm uuid; rid uuid; ent text;
begin
  ent:=TG_TABLE_NAME; rid:=coalesce(NEW.id,OLD.id);
  if TG_TABLE_NAME='farms' then farm:=coalesce(NEW.id,OLD.id);
  elsif TG_TABLE_NAME='houses' then farm:=coalesce(NEW.farm_id,OLD.farm_id);
  elsif TG_TABLE_NAME='cycles' then farm:=coalesce(NEW.farm_id,OLD.farm_id);
  else farm:=(select c.farm_id from public.cycles c where c.id=coalesce(NEW.cycle_id,OLD.cycle_id)); end if;
  insert into public.audit_logs(user_id,farm_id,action,entity,record_id,details)
  values(coalesce(auth.uid(),(select owner_id from public.farms where id=farm)),farm,lower(TG_OP),ent,rid,jsonb_build_object('source','db_trigger'));
  return coalesce(NEW,OLD);
end $$;

-- Do not attach triggers automatically to every table in this migration; the application audit log remains the primary detailed history.

-- Explicit API grants.
grant select,insert,update on public.company_settings to authenticated;
grant select,insert,update,delete on public.performance_rules to authenticated;
grant select,insert,update on public.invitations to authenticated;
