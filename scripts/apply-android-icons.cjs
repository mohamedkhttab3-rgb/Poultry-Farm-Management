// Apply unchanged Poultry Farm Management identity to generated Capacitor Android project.
'use strict';
const fs=require('node:fs'), path=require('node:path');
const root=path.resolve(__dirname,'..');
const android=path.join(root,'android','app','src','main','res');
if(!fs.existsSync(android))throw new Error('Missing Android project. Run npx cap add android first.');
// Use the existing app icon; the former native-assets/android directory
// was not included in the safe GitHub source package.
const sourceIcon=path.join(root,'www','icon-512.png');
if(!fs.existsSync(sourceIcon)||fs.statSync(sourceIcon).size<2048)
 throw new Error('Missing or invalid www/icon-512.png');
let files=0;
for(const dpi of ['mdpi','hdpi','xhdpi','xxhdpi','xxxhdpi']){
 const dst=path.join(android,'mipmap-'+dpi);
 fs.mkdirSync(dst,{recursive:true});
 for(const name of ['ic_launcher.png','ic_launcher_round.png','ic_launcher_foreground.png']){
  fs.copyFileSync(sourceIcon,path.join(dst,name));files++;
 }
}
const xmlDir=path.join(android,'mipmap-anydpi-v26');fs.mkdirSync(xmlDir,{recursive:true});
for(const name of ['ic_launcher.xml','ic_launcher_round.xml']){
 const xml=`<?xml version="1.0" encoding="utf-8"?><adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android"><background android:drawable="@color/ic_launcher_background"/><foreground android:drawable="@mipmap/ic_launcher_foreground"/></adaptive-icon>`;
 fs.writeFileSync(path.join(xmlDir,name),xml+'\n');
}
const values=path.join(android,'values');fs.mkdirSync(values,{recursive:true});
fs.writeFileSync(path.join(values,'ic_launcher_background.xml'),'<resources><color name="ic_launcher_background">#0F3659</color></resources>\n');
console.log('PASS: Original PFM branding applied to Android ('+files+' icon assets).');
