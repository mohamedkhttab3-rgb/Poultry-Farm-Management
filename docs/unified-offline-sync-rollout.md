# Unified offline-first sync — development branch

Status: staged implementation, **not production deployment**. This branch is separated from the last stable Android build.

## Components
- Shared browser code `www/pfm-unified-sync.js` executes with the same `www/index.html` in Electron/Windows and Capacitor Android/iOS.
- `supabase/migrations/20261019_pfm_unified_sync_v1.sql` introduces a separate, per-account RLS-protected store and compare-and-swap write function.
- `tests/test_unified_sync.cjs` covers first device, second-device restore, finance ledger + frozen breed snapshots, concurrent edits, no automatic deletion.
- On reconnect, app foreground, a local save or each 60 seconds while foreground/online, attempt synchronization.

## Deployment prerequisites
1. Export JSON backups **from every existing device/account**, and verify they open. Keep existing installations.
2. Use a STAGING Supabase project first. Run the SQL migration as a database administrator, verify RLS with two distinct Supabase user accounts.
3. Configure exactly the same Supabase Project URL and publishable/anon key on each device; **never** embed service role or database secrets.
4. Sign in to the **same cloud account** on the devices. A prior local-only account is NOT automatically the cloud account.
5. Test Android + Windows with throwaway farm data: offline update and reconnect, finance extension preservation, same-record conflict, recovery after interrupted sync. Only then test iOS build and device signing.

## Safety and limitations
- Existing primary local data, calculations, printing and report templates are untouched by this engine.
- The old bulk-table sync is NOT used by the automatic sync call on this branch.
- Unknown competing versions never overwrite one another; the app reports a conflict and leaves both records unchanged until a conflict resolution UI is implemented.
- Remote deletions and local deletions are deliberately **not propagated automatically** in V1. The missing record is treated as a conflict.
- A failed or unavailable migration means cloud sync stays unavailable; local data remains available.
- Importing existing production accounts or migrating owner IDs automatically is deliberately not supported.
- Local archive is required before applying any downloaded data.
- Only new staging schema is described here. Do not execute this migration on a production project before RLS, backup, round-trip and recovery tests.
- iOS native project/build and live cross-device certification are separate release gates.
