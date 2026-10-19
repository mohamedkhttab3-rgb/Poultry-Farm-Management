-- V8: enable Realtime notification for the isolated synchronization table.
-- Run ONLY after 20261019_pfm_unified_sync_v1.sql and RLS review.
-- Supabase Realtime publication delivers signals; payload reads remain protected by RLS.
do $$
begin
 if to_regclass('public.pfm_sync_records') is null then
   raise exception 'Apply the pfm_sync_records migration first';
 end if;
 if exists (select 1 from pg_publication where pubname='supabase_realtime')
   and not exists (
     select 1 from pg_publication_tables
     where pubname='supabase_realtime' and schemaname='public' and tablename='pfm_sync_records'
   ) then
   alter publication supabase_realtime add table public.pfm_sync_records;
 end if;
end $$;
