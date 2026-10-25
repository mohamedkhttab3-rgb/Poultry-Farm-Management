'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const nativeCss=fs.readFileSync('www/pfm-v7314-native-print.css','utf8');
const native=fs.readFileSync('native-assets/android/PFMNativeExportPlugin.java','utf8');
const shared=fs.readFileSync('www/pfm-v59-print-results.js','utf8');
const desktop=fs.readFileSync('desktop/main.cjs','utf8');
// All screens use PFMPrintResults59; build the identity into that shared print document.
assert(shared.includes('const identityFooter='),'Shared footer missing');
assert(shared.includes('<span>Poultry Farm Management M.K™</span>'),'Approved text missing');
assert(shared.includes('sourceLogoAsDataURI()') && shared.includes('brandLogo||new URL'), 'Original logo must be embedded for print isolation');
assert(shared.includes("printCopy.outerHTML+identityFooter+'</body></html>'"),'Shared footer not appended to each print document');
assert(shared.includes('body.pfm59-printing > .pfm-native-a4-footer:not(#pfm59PrintRoot)'), 'Legacy print hide rule still hides the shared footer');
assert(shared.includes('@bottom-center{'),'Android fallback footer must retain original margin rule');
assert(shared.includes('const marginBoxFooter=android;'),'Windows must use fixed real image, not unsupported margin-box background');
assert(shared.includes('margin:11mm 11mm 24mm;'),'Printable footer strip not reserved');
// Native WebView uses this same HTML and allows the footer style at the page bottom.
const footer=nativeCss.match(/\.pfm-native-a4-footer\{position:fixed[^}]*\}/)?.[0]||'';
assert(footer,'Native A4 footer position missing');
assert(footer.includes('bottom:0!important'),'Footer must be within printable A4 page bounds');
assert(footer.includes('height:7mm!important'),'Footer must fit in a small safe band');
assert(nativeCss.includes('font-size:8pt!important'),'Footer brand font must be smaller');
assert(nativeCss.includes('height:7mm!important;width:7mm!important'),'Original footer logo must be reduced');
assert(native.includes('web.createPrintDocumentAdapter(filename)'),'Android print adapter missing');
assert(native.includes('writePaginatedA4('),'Android PDF Save and Share must paginate');
assert(native.includes('paper.drawBitmap(logo,null,rect,footerPaint);'),'Android must stamp the original centered logo on each saved/shared page');
assert(!native.includes('writeSingleA4('),'Old compressed single-sheet renderer still present');
assert(!native.includes('safe=safe.replaceFirst("(?i)</body>"'),'Native duplicate footer insertion must remain removed');
assert(desktop.includes('printToPDF(') && desktop.includes("pageSize:'A4'"),'Desktop PDF path missing');
// Execute the ACTUAL shared document builder using lightweight DOM stubs.
const begin=shared.indexOf(' function standalone(root,brandLogo){');
const end=shared.indexOf(' // Use a full-sized printable document',begin);
assert(begin>=0&&end>begin,'Cannot locate standalone printable HTML generator');
const produce=new Function('document','window','e','stylesheetText',
 shared.slice(begin,end)+
 'return standalone({cloneNode(){return this},querySelector(sel){'+
 'if(sel===\'.pfm59-print-brand strong\')return {textContent:\'Dashboard\'};'+
 'return null},outerHTML:\'<article id="pfm59PrintRoot"><p>Report</p></article>\'});');
for(const mode of ['android','windows']){
 const html=produce({baseURI:'pfm://app/index.html',documentElement:{dir:'rtl',lang:'ar'}},
   {Capacitor:{isNativePlatform:()=>mode==='android',getPlatform:()=> 'android'}},
   String,()=>'.pfm59-print-footer{display:none!important}');
 assert(html.includes('<span>Poultry Farm Management M.K™</span>'),mode+' footer text absent');
 assert(html.includes('<img src="pfm://app/pfm-logo.png"'),mode+' original logo source absent');
 assert(html.includes('</article><div class="pfm-native-a4-footer"'),mode+' footer is hidden inside report root');
 assert(html.includes('body.pfm59-printing > .pfm-native-a4-footer:not(#pfm59PrintRoot)'),mode+' legacy hide-rule override absent');
 if(mode==='android')assert(html.includes('@bottom-center{'),'Android source margin logo CSS missing');
 else assert(!html.includes('@bottom-center{'),'Windows must use real image element, not background-only print margin');
 assert(html.includes('margin:11mm 11mm 24mm;'),mode+' footer margin absent');
 if(mode==='android')assert(html.includes('background-image:url("./pfm-logo.png")'),'Android margin fallback image missing');
 else assert(html.includes('bottom:-10mm!important'),'Windows original image must fit in protected page margin');
 assert(html.includes('bottom:'+(mode==='android'?'0':'-10mm')+'!important'),mode+' reserved footer-band placement missing');
 assert(html.includes('font:600 8pt Arial'),mode+' footer brand font is not reduced');
 assert(html.includes('width:7mm!important;height:7mm!important'),mode+' footer logo is not reduced');
 assert.equal(html.split('class="pfm-native-a4-footer"').length,2,mode+' footer duplicated');
}
console.log('PASS: Original logo and approved text in repeated A4 footer of shared Android + Windows reports.');
console.log('LIMIT: Actual device render/preview still requires Android/Windows UI verification.');
