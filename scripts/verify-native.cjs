// Shared V8 native packaging contract with legacy V7 UI preservation checks.
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const meta=JSON.parse(fs.readFileSync(path.join(root,'V7_BASELINE.json'),'utf8'));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const data=fs.readFileSync(path.join(root,'www','index.html'));
const sha=crypto.createHash('sha256').update(data).digest('hex');
const cap=fs.readFileSync(path.join(root,'capacitor.config.ts'),'utf8');
const electron=fs.readFileSync(path.join(root,'desktop','main.cjs'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github','workflows','native-builds.yml'),'utf8');
const checks=[
 [pkg.version==='8.1.0','unified Android / Windows / iOS version 8.1.0'],
 [pkg.build?.productName==='Poultry Farm Management','Windows product name'],
 [cap.includes("appName: 'Poultry Farm Management V8.1'"),'Android and iOS V8 app name'],
 [data.includes('pfm-v72-android-export.js')&&data.includes('pfm-v65-mobile.css'),'Existing Android export and mobile UI assets preserved'],
 [data.includes('pfm-unified-sync.js')&&data.includes('pfm-v8-realtime.js'),'V8 shared sync and realtime assets linked'],
 [fs.existsSync(path.join(root,'scripts','set-ios-version.cjs')),'iOS V8.1 version script present'],
 [electron.includes("nodeIntegration:false")&&electron.includes("contextIsolation:true"),'Electron hardening preserved'],
 [workflow.includes('windows-latest')&&workflow.includes('ubuntu-latest'),'GitHub native build jobs'],
 [fs.existsSync(path.join(root,'www','icon-512.png')) && fs.statSync(path.join(root,'www','icon-512.png')).size > 2048,'Android identity'],
 [fs.existsSync(path.join(root,'www','pfm-recovery-data.js')),'app assets present'],
 [fs.existsSync(path.join(root,'native-assets','android','PFMNativeExportPlugin.java')),'Android export source present'],
];
for(const [pass,label] of checks)console.log((pass?'PASS':'FAIL')+': '+label);
if(checks.some(([pass])=>!pass))process.exit(1);
