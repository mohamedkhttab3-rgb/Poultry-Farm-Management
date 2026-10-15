// Test classification without a Git checkout. The publisher runs the same guard after git add.
'use strict';
const assert=require('node:assert/strict');
const {problem}=require('../scripts/check-staged-safe.cjs');
const allowed=[
  'database/backup-formats/V6_3_FORMAT_AR.md',
  'backups/README_AR.md',
  '.github/workflows/native-builds.yml',
  'database/empty-template.json',
  'www/pfm-recovery-data.js',
  'demo-data/SAUDI_2026_2_ROUNDS_COMPLETE.json',
  'www/icon.ico',
];
const blocked=[
  'database/backup-2026.json','backups/backup-2026-10-15.json',
  'database/original-recovery-from-V5.6.json',
  'backup-users.zip','secret.json','service-account.json',
  '.env','www/.env.local','www/supabase-config.local.js',
  'android/app/build/outputs/apk/debug/app-debug.apk',
  'dist-desktop/install.exe','certificates/signing.p12',
  'node_modules/foo.js',
];
for(const f of allowed)assert.equal(problem(f),null,`Should allow ${f}`);
for(const f of blocked)assert.ok(problem(f),`Should deny ${f}`);
console.log(`PASS: ${allowed.length} safe files allowed, ${blocked.length} sensitive/generated files denied`);
