// Set the generated native Android package version. Does not change the web application.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const target=path.resolve(__dirname,'..','android','app','build.gradle');
if(!fs.existsSync(target))throw Error('Missing generated android/app/build.gradle');
let body=fs.readFileSync(target,'utf8');
if(!/versionName\s+"[^"]+"/.test(body))throw Error('Android versionName was not found');
body=body.replace(/versionName\s+"[^"]+"/,'versionName "7.3.10"');
if(!/versionCode\s+\d+/.test(body))throw Error('Android versionCode was not found');
body=body.replace(/versionCode\s+\d+/,'versionCode 740');
fs.writeFileSync(target,body);
console.log('PASS: Android versionCode 740 and versionName 7.3.10');
