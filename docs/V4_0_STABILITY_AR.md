# V4.0.0 — Stability Review

## Authentication
- Retained Supabase v2 client configuration flow.
- `signInWithPassword`, `signUp`, password reset, and session restore remain cloud-auth paths when a real Project URL + Publishable/Anon key are configured.
- A post-auth synchronization failure is non-fatal: the app opens and reports the sync state instead of presenting a false login failure.
- No service-role/secret key is accepted.

## Configuration
- `www/supabase-config.local.js` is loaded before the config bridge.
- `www/supabase-config.js` validates configuration and may fall back to the supported localStorage config keys.
- The supplied file was only a template (`YOUR_PROJECT...` / `YOUR_SUPABASE...`), so the package does not contain fabricated credentials.

## Finance and standards
- Project expenses remain grouped under one expense-item structure with selectable labels.
- Breed/age standards and performance comparison remain present.

## Language
- UI language is Arabic or English only in V4.
- User-entered farm/house/breed/customer/note data is not machine-translated.
