-- Poultry Farm Management unified cloud sync V1 (staging / opt-in).
-- Separate schema, never modifies legacy farms, finance, cycles or user data.
-- Run in a dedicated Supabase project after reviewing a backup.
create table if not exists public.pfm_sync_records (
  owner_id uuid not null references auth.users(id) on delete cascade,
  collection text not null check (collection in (
    'farms','houses','cycles','daily','weights','feed','meds','inventory',
    'sales','finance','performanceRules','auditLog','invitations','tombstones',
    'settings','v410','extras'
  )),
  record_id text not null check (length(record_id) between 1 and 160),
  payload jsonb not null check (jsonb_typeof(payload) in ('object','array')),
  version bigint not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  primary key (owner_id,collection,record_id)
);
alter table public.pfm_sync_records enable row level security;
revoke all on public.pfm_sync_records from anon, public;
revoke insert,update,delete on public.pfm_sync_records from authenticated;
grant select on public.pfm_sync_records to authenticated;
do $$
begin
 if not exists (
   select 1 from pg_policies
   where schemaname='public' and tablename='pfm_sync_records'
      and policyname='pfm_sync_read_own'
 ) then
   create policy pfm_sync_read_own on public.pfm_sync_records
     for select to authenticated using (owner_id = (select auth.uid()));
 end if;
end $$;

-- Atomic compare-and-swap: concurrent writes to the same record cannot overwrite.
-- Service role/secret keys must NEVER be included in the app.
create or replace function public.pfm_sync_cas_write(
  p_collection text, p_record_id text, p_payload jsonb, p_expected_version bigint
) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  new_version bigint;
begin
  if caller is null then raise exception 'Login required'; end if;
  if p_collection is null or p_collection not in (
    'farms','houses','cycles','daily','weights','feed','meds','inventory',
    'sales','finance','performanceRules','auditLog','invitations','tombstones',
    'settings','v410','extras'
  ) then raise exception 'Invalid collection'; end if;
  if p_record_id is null or length(p_record_id) not between 1 and 160
     or p_payload is null or jsonb_typeof(p_payload) not in ('object','array')
     or length(p_payload::text) > 1000000
     or p_expected_version is null or p_expected_version < 0
  then raise exception 'Invalid sync document'; end if;
  if p_expected_version = 0 then
    insert into public.pfm_sync_records(owner_id,collection,record_id,payload,version)
    values(caller,p_collection,p_record_id,p_payload,1)
    on conflict do nothing returning version into new_version;
  else
    update public.pfm_sync_records set payload=p_payload,
      version=version+1,updated_at=now()
    where owner_id=caller and collection=p_collection and record_id=p_record_id
      and version=p_expected_version
    returning version into new_version;
  end if;
  if new_version is null then
    raise exception 'Concurrent sync change; refresh before retry'
      using errcode='40001';
  end if;
  return new_version;
end $$;
revoke all on function public.pfm_sync_cas_write(text,text,jsonb,bigint) from public, anon;
grant execute on function public.pfm_sync_cas_write(text,text,jsonb,bigint) to authenticated;
