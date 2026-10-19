# Poultry Farm Management V8.0.0 — Android / Windows / iOS

## Current status
V8 is a separate QA branch. Shared source code, cloud project configuration and isolated sync tables are prepared. Do not replace installed production apps until device tests and backups are complete.

## Linked Supabase project
- Project: **Poultry Farm Management M.K™**
- Project ref: `flqyqpqwnwncmrdgnocd`
- App uses a PUBLIC publishable key only. Secret/service keys are never included.
- V8 stores synchronized documents in `public.pfm_sync_records`, without overwriting legacy farm, cycle or finance tables.
- Database has per-user RLS, atomic CAS writes and a Realtime publication for change notifications.

## Immediate (online) synchronization
1. Any `save()` writes locally before requesting upload immediately.
2. Supabase Realtime sends account-scoped change notifications to connected devices. Each device re-reads records using RLS and CAS synchronization.
3. On reconnect / app foreground, resubscribe and reconcile state. Background sync is not guaranteed if the OS suspends the app.
4. A 60-second foreground fallback scan still runs when realtime events are dropped.
5. Simultaneous changes to the same record create a conflict, not a silent overwrite. Conflict-resolution UI remains a release blocker.
6. Deletions are NOT propagated automatically by V8's safe-first engine. They require a controlled resolution mechanism.

## Release scope
- Shared version: `8.0.0` in package.json and web app.
- Android: versionName `8.0.0`, versionCode `8000`; existing ID remains to preserve app data.
- Windows: Electron shares the same `www` application and builds using package version `8.0.0`.
- iOS: Capacitor shared `www`, generated project versionName `8.0.0` / build `8000`. An actual signed device build still needs macOS and Apple signing.

## Important data-preservation limits
Existing non-empty cloud legacy tables are NOT automatically migrated into the separate V8 sync store. Data must be inventoried and safely migrated using a verified per-account plan. Existing device-local data must be exported as JSON before installing V8. Same email is not enough to guarantee the same user identity if an account was previously local-only. Cross-user permissions and new multi-farm sharing require another review before rollout.

## QA
Actions workflow: `.github/workflows/pfm-v8-cross-platform.yml`.
Run staging tests with two separate users, two online devices, offline changes, financial/audit/breed documents, concurrent edits, interrupted upload, and reconnect. Do not call V8 production-ready based on a build alone.
