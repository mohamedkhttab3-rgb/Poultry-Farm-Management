'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const shared=fs.readFileSync('www/pfm-v59-print-results.js','utf8');
const native=fs.readFileSync('native-assets/android/PFMNativeExportPlugin.java','utf8');
const printCss=fs.readFileSync('www/pfm-v7314-native-print.css','utf8');
const androidCss=fs.readFileSync('www/pfm-v736-android-print.css','utf8');
assert(shared.includes('body.pfm59-printing #pfm59PrintRoot .pfm59-print-head .pfm59-print-brand{direction:ltr!important'));
assert(shared.includes('#pfm59PrintRoot .pfm59-print-brand img{display:block!important'));
assert(!printCss.includes('#pfm59PrintRoot .pfm59-print-brand img{display:none!important'));
assert(!androidCss.includes('#pfm59PrintRoot .pfm59-print-brand img,'));
const start=shared.indexOf(' function standalone(root){');
const end=shared.indexOf(' // Use a full-sized printable document',start);
assert(start>=0&&end>start);
const build=new Function('document','window','e','stylesheetText',
 shared.slice(start,end)+
 'return standalone({cloneNode(){return this},querySelector(sel){'+
 "if(sel==='.pfm59-print-brand strong')return {textContent:'Dashboard'};"+
 'return null},outerHTML:'+JSON.stringify('<article id="pfm59PrintRoot"><div class="pfm59-print-head"><div class="pfm59-print-brand"><img src="./pfm-logo.png"/><div><strong>Dashboard</strong><small>Poultry Farm Manager · M.K™</small></div></div></div></article>')+'});');
for(const platform of ['android','windows','ios']){
 const html=build({baseURI:'pfm://app/index.html',documentElement:{dir:'rtl',lang:'ar'}},
 {Capacitor:{isNativePlatform:()=>platform!=='windows',getPlatform:()=>platform}},String,()=>'.pfm59-print-footer{display:none!important}');
 const footer=html.match(/<div class="pfm-native-a4-footer"[^>]*>([\s\S]*?)<\/div>/);
 assert(footer,platform+' missing footer');
 assert(/^<img src="\.\/pfm-logo\.png"[^>]*><span>Poultry Farm Management M\.K™<\/span>$/.test(footer[1]),platform+' logo must appear LEFT of footer text');
 assert(html.includes('.pfm59-print-brand img{display:block!important'),platform+' top logo must be visible');
 assert(html.includes('.pfm59-print-brand{direction:ltr!important'),platform+' top logo must precede the title');
 assert(html.includes('@page{size:A4 landscape;margin:11mm 11mm 24mm;}'),platform+' footer positioning changed');
}
const leftNative=native.indexOf('paper.drawBitmap(logo,null,rect,footerPaint);');
const rightNative=native.indexOf('paper.drawText(footerText,groupLeft+logoSize+gap,footerCenterY+3f,footerPaint);');
assert(leftNative>=0&&rightNative>leftNative,'Android save/share PDF needs logo LEFT of text');
assert(native.includes('final float groupLeft=(PAGE_W-textWidth-gap-logoSize)/2f;'),'Native centered group must stay unchanged');
assert(native.includes('final float logoSize=28f,gap=6f;'),'Native footer icon and gap should be modest');
assert(native.includes('footerPaint.setTextSize(8.7f);'),'Native PDF brand text should be reduced');
assert(native.includes('final float footerCenterY=PAGE_H-29f;'),'Native footer must remain in protected page bottom');
console.log('PASS V8 logo before title and before footer text on Android, Windows, iOS.');
console.log('Note: actual packaged-device PDF visual inspection remains a release gate.');
