"use strict";
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const recovery=path.join(root,'www','pfm-recovery-data.js');
const data=fs.readFileSync(recovery,'utf8');
const deny=['database/original-recovery-from-V5.6.json','demo-data/ROSS308_DEMO_BACKUP.json'];
const issues=[];
if(data.length>400||!data.includes('window.PFM_RECOVERY_BACKUP = null;'))issues.push('Private recovery payload found. Use PUBLIC_SAFE source package.');
for(const f of deny)if(fs.existsSync(path.join(root,f)))issues.push('Sensitive data in source package: '+f);
if(issues.length){console.error(issues.join('\n'));process.exit(1)}
console.log('PASS: source archive contains no embedded recovery payload or personal database backup');
