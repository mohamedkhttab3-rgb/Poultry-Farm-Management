'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const java=fs.readFileSync('native-assets/android/PFMNativeExportPlugin.java','utf8');
const js=fs.readFileSync('www/pfm-v739-native-pdf-pages.js','utf8');
const css=fs.readFileSync('www/pfm-v739-native-pdf.css','utf8');
const bridge=fs.readFileSync('www/pfm-v72-android-export.js','utf8');
new vm.Script(js);
// 7.3.10 names and safeguards: do not lock this test to deleted 7.3.7 functions.
for(const token of [
 'window.PFM739Pages={prepare,show,active}',
 'function dashboard(panel)',
 'function tableSection(section)',
 'function store()',
 'function wrapped(parent,unit)',
 'function show(index)',
 'root.dataset.pfmPageIndex=String(index)',
 'if(over())throw Error',
 'break',
])assert(js.includes(token),'New PDF layout missing: '+token);
for(const token of ['pfm-v739-native-pdf-pages.js','window.PFM739Pages.prepare(695)','window.PFM739Pages.show(','new PdfDocument()','new PdfRenderer(fd)','Intent.ACTION_CREATE_DOCUMENT','Intent.ACTION_SEND','checkWorkbook(bytes)'])assert(java.includes(token),token);
// Verify the four-argument Bitmap overload with a Paint to preserve logo quality.
assert.match(java,/canvas\.drawBitmap\(\s*logo\s*,\s*null\s*,\s*rect\s*,\s*new\s+android\.graphics\.Paint\(/,'Footer logo must render with antialiased paint');
// Protect the working Android print/save/share implementation while adjusting pagination.
for(const token of [
 'FileProvider.getUriForFile(',
 'getPackageName()+".pfmexport"',
 'Intent.ACTION_SEND',
 'Intent.EXTRA_STREAM',
 'Intent.FLAG_GRANT_READ_URI_PERMISSION',
 'Intent.createChooser(send,',
 'Intent.ACTION_CREATE_DOCUMENT',
 'saveAs(call,file,filename,PDF)',
 'printPdf(call,file,filename)'
]) assert(java.includes(token),'Native PDF sharing/printing/saving changed: '+token);
assert(java.includes('main.postDelayed(()->{'),'Wait for WebView redraw before taking PDF page');
assert(java.includes('},200);'),'PDF page must allow a redraw before capture');
assert(!java.includes('window.PFMPages'),'Old page composer retained');
assert(!java.includes('Double.parseDouble(encoded)'),'Old null parse retained');
assert(!java.includes('new PrintDocumentAdapter.LayoutResultCallback'),'Inaccessible Android callback retained');
assert(css.includes('break-inside:avoid'),'Prevent image/charts splits');
for(const name of ['printHTML','savePDF','sharePDF'])assert(bridge.includes('async '+name+'(html,name)'),name);
console.log('PASS: V7.3.10 PDF pagination, no-repeat pages, logo, native print/save/share and XLSX preserved');
console.log('LIMIT: Actual Android handset rendering acceptance pending');
