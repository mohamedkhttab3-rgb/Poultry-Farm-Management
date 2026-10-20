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
assert(shared.includes('<img src="./pfm-logo.png"'),'Original app logo missing');
assert(shared.includes("printCopy.outerHTML+identityFooter+'</body></html>'"),'Shared footer not appended to each print document');
assert(shared.includes('body.pfm59-printing > .pfm-native-a4-footer:not(#pfm59PrintRoot)'), 'Legacy print hide rule still hides the shared footer');
assert(shared.includes('@page{size:A4 landscape;margin:11mm 11mm 19mm;}'),'Printable footer strip not reserved');
// Native WebView uses this same HTML and allows the footer style at the page bottom.
const footer=nativeCss.match(/\.pfm-native-a4-footer\{position:fixed[^}]*\}/)?.[0]||'';
assert(footer,'Native A4 footer position missing');
assert(footer.includes('bottom:0!important'),'Footer outside A4 printable region');
assert(!/bottom:\s*-/.test(footer),'Negative offset clips print footer');
assert(native.includes('web.createPrintDocumentAdapter(filename)'),'Android print adapter missing');
assert(!native.includes('safe=safe.replaceFirst("(?i)</body>"'),'Native duplicate footer insertion must remain removed');
assert(desktop.includes('printToPDF(') && desktop.includes("pageSize:'A4'"),'Desktop PDF path missing');
console.log('PASS: Original logo and approved text in repeated A4 footer of shared Android + Windows reports.');
console.log('LIMIT: Actual device render/preview still requires Android/Windows UI verification.');
