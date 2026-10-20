// V8.1 iOS version stamping after Capacitor generates Xcode source.
// No Apple signing keys or credentials are required for this source-only step.
'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..','ios','App','App');
const info=path.join(root,'Info.plist');
const project=path.resolve(root,'..','App.xcodeproj','project.pbxproj');
if(!fs.existsSync(info)||!fs.existsSync(project))throw Error('Generated iOS source missing');
let plist=fs.readFileSync(info,'utf8');
if(!plist.includes('CFBundleShortVersionString')||!plist.includes('CFBundleVersion'))
  throw Error('iOS Info.plist version keys missing');
function setValue(text,key,value){
 const re=new RegExp('(<key>'+key+'</key>\\s*<string>)[^<]*(</string>)');
 if(re.test(text))return text.replace(re,'$1'+value+'$2');
 // Capacitor default might inherit Xcode build settings; preserve them.
 return text;
}
plist=setValue(plist,'CFBundleShortVersionString','8.1.0');
plist=setValue(plist,'CFBundleVersion','8100');
fs.writeFileSync(info,plist);
let pbx=fs.readFileSync(project,'utf8');
if(!/MARKETING_VERSION\s*=/.test(pbx)||!/CURRENT_PROJECT_VERSION\s*=/.test(pbx))
 throw Error('iOS project version settings missing');
pbx=pbx.replace(/MARKETING_VERSION\s*=\s*[^;]+;/g,'MARKETING_VERSION = 8.1.0;')
 .replace(/CURRENT_PROJECT_VERSION\s*=\s*[^;]+;/g,'CURRENT_PROJECT_VERSION = 8100;');
fs.writeFileSync(project,pbx);
console.log('PASS: iOS V8.1.0 source version (8100); signed IPA remains separate.');
