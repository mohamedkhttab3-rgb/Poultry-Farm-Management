// Native packaging contract + V6.9.3 UI preservation checks (no dependencies required).
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
 [pkg.version==='7.1.0','version 7.1.0'],
 [pkg.build?.productName==='Poultry Farm Management','Windows product name'],
 [cap.includes("appName: 'Poultry Farm Management'"),'Android app name'],
 [sha===meta.www_index_sha256,'V6.9.3 index.html unchanged'],
 [electron.includes("nodeIntegration:false")&&electron.includes("contextIsolation:true"),'Electron hardening preserved'],
 [workflow.includes('windows-latest')&&workflow.includes('ubuntu-latest'),'GitHub native build jobs'],
 [fs.existsSync(path.join(root,'native-assets','android','mipmap-xxxhdpi','ic_launcher.png')),'Android identity'],
 [fs.existsSync(path.join(root,'www','pfm-recovery-data.js')),'app assets present'],
];
for(const [pass,label] of checks)console.log((pass?'PASS':'FAIL')+': '+label);
if(checks.some(([pass])=>!pass))process.exit(1);
