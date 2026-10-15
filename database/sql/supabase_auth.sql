-- Poultry Farm Manager V3.4.5 - Supabase Auth
-- The first account becomes Owner. Later self-registered accounts start as Worker
-- until an Owner/Manager assigns them to a farm role.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'worker' check (role in ('owner','manager','supervisor','worker')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.profiles alter column role set default 'worker';

drop policy if exists "users can read own profile" on public.profiles;
create policy "users can read own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "users can insert own profile" on public.profiles;
create policy "users can insert own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "users can update own profile" on public.profiles;
create policy "users can update own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  new_role text;
begin
  perform pg_advisory_xact_lock(741852963);
  if not exists(select 1 from public.profiles) then new_role := 'owner'; else new_role := 'worker'; end if;
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

-- Never use a Service Role Key inside the client application.
