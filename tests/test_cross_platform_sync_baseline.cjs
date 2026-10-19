'use strict';
// Cross-platform synchronization safety audit: read-only static checks.
// This test never reads user records or changes application storage.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const html=fs.readFileSync('www/index.html','utf8');
const storage=fs.readFileSync('www/pfm-v63-storage.js','utf8');
const capacitor=fs.readFileSync('capacitor.config.ts','utf8');
const desktop=fs.readFileSync('desktop/main.cjs','utf8');
const checks=[
 ['Offline primary storage',storage.includes('localStorage')&&storage.includes('indexedDB')],
 ['Cloud authentication',html.includes('signInWithPassword')&&html.includes('supabaseClient')],
 ['Cloud push/pull',html.includes('async function syncToCloud()')&&html.includes('async function syncFromCloud(')],
 ['Reconnect sync',html.includes("window.addEventListener('online'")],
 ['Android/iOS shared webDir',capacitor.includes("webDir: 'www'")],
 ['Windows shared web content',desktop.includes('index.html')],
 ['Account-specific local persistence',html.includes('loadLocalForUser()')],
 ['Finance sync present',html.includes('finance_entries')],
 ['Breed standards sync present',html.includes('performance_rules')],
 ['Local snapshot archive',storage.includes('readVerified')]
];
for(const [label,ok] of checks){console.log((ok?'PASS':'FAIL')+': '+label);assert(ok,label)}
// Known release blockers: audit intentionally reports, not conceals them.
const risks=[
 'Supabase URL/key and production RLS must be configured and verified separately.',
 'Offline multi-device edits need version-aware conflict resolution and durable outbox.',
 'Cloud deletion tombstones must be acknowledged before local removal.',
 'Cloud schema must round-trip every finance extension and frozen breed standard.',
 'iOS native signing and device testing are not completed by this test.'
];
console.log('BASELINE ONLY: '+checks.length+' static checks passed; this is NOT production sync certification.');
risks.forEach(r=>console.log('BLOCKER: '+r));
