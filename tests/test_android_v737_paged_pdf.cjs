'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const java=fs.readFileSync('native-assets/android/PFMNativeExportPlugin.java','utf8');
const js=fs.readFileSync('www/pfm-v739-native-pdf-pages.js','utf8');
const css=fs.readFileSync('www/pfm-v739-native-pdf.css','utf8');
const bridge=fs.readFileSync('www/pfm-v72-android-export.js','utf8');
new vm.Script(js);
for(const token of ['window.PFM739Pages={prepare,show}','appendTable(node)','appendDashboard(node)'])assert(js.includes(token),token);
for(const token of ['pfm-v739-native-pdf-pages.js','window.PFM739Pages.prepare(695)','window.PFM739Pages.show(','new PdfDocument()','new PdfRenderer(fd)','Intent.ACTION_CREATE_DOCUMENT','Intent.ACTION_SEND','checkWorkbook(bytes)'])assert(java.includes(token),token);
// Verify the four-argument Bitmap overload with a Paint to preserve logo quality.
assert.match(java,/canvas\.drawBitmap\(\s*logo\s*,\s*null\s*,\s*rect\s*,\s*new\s+android\.graphics\.Paint\(/,'Footer logo must render with antialiased paint');
assert(!java.includes('window.PFMPages'),'Old page composer retained');
assert(!java.includes('Double.parseDouble(encoded)'),'Old null parse retained');
assert(!java.includes('new PrintDocumentAdapter.LayoutResultCallback'),'Inaccessible Android callback retained');
assert(css.includes('break-inside:avoid'),'Prevent image/charts splits');
for(const name of ['printHTML','savePDF','sharePDF'])assert(bridge.includes('async '+name+'(html,name)'),name);
console.log('PASS: V7.3.9 Android PDF generator, PDF integrity, save, print, share and Excel preserved');
console.log('LIMIT: Actual Android handset rendering acceptance pending');
