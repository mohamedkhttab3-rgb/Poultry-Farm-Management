'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const java=fs.readFileSync('native-assets/android/PFMNativeExportPlugin.java','utf8');
const src=fs.readFileSync('www/pfm-v737-pdf-pages.js','utf8');
const bridge=fs.readFileSync('www/pfm-v72-android-export.js','utf8');
const excel=fs.readFileSync('www/pfm-excel-transfer.js','utf8');
const report=fs.readFileSync('www/pfm-v59-print-results.js','utf8');
new vm.Script(src);
for(const expected of ['window.PFMPages={prepare,show}',"flush();","appendTable(node)","appendDashboard(node)"]){
 assert(src.includes(expected),'Missing independent-page rendering: '+expected);
}
assert(java.includes("pfm-v737-pdf-pages.js"),'Missing native composer load');
assert(java.includes('window.PFMPages.prepare(695)'),'No precomposition');
assert(java.includes('window.PFMPages.show('),'Missing page selection');
assert(!java.includes('web.scrollTo('),'Legacy scrolling-based rendering persists');
assert(!java.includes('PAGE_MARGIN-segment[0]*scale'),'Legacy clipping persists');
assert(java.includes('canvas.drawBitmap(logo,null,rect'),'Per-page logo absent');
for(const method of ['printHTML','savePDF','sharePDF'])assert(bridge.includes('async '+method+'(html,name)'));
assert(java.includes('Intent.ACTION_CREATE_DOCUMENT'),'Save As required');
assert(java.includes('Intent.ACTION_SEND'),'External app share required');
assert(java.includes('new PdfRenderer(fd)'),'PDF integrity verification required');
assert(excel.includes('.xlsx'),'True XLSX export path');
assert(report.includes('pfm-v736-android-print.css'),'Export CSS must load');
console.log('PASS: 7.3.7 paginated isolated PDF file, share/print/save and XLSX contracts.');
console.log('LIMIT: screen/device content test required before user acceptance.');
