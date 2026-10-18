'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const java=fs.readFileSync('native-assets/android/PFMNativeExportPlugin.java','utf8');
const report=fs.readFileSync('www/pfm-v59-print-results.js','utf8');
const bridge=fs.readFileSync('www/pfm-v72-android-export.js','utf8');
const version=fs.readFileSync('scripts/set-android-version.cjs','utf8');
for(const token of [
 'void writeSingleA4(',
 'void measureFullScreen(',
 'Bitmap.createBitmap(pixelsWide,pixelsHigh,Bitmap.Config.ARGB_8888)',
 'float ratio=Math.min(1f,Math.min(printableWidth/RENDER_WIDTH,',
 'web.draw(capture)',
 'paper.drawBitmap(image,null,new RectF(',
 'new PdfDocument.PageInfo.Builder(PAGE_W,PAGE_H,1)',
 'paper.drawBitmap(logo,null,rect,paint)',
 'new PdfRenderer(fd)',
 'Intent.ACTION_SEND',
 'Intent.EXTRA_STREAM',
 'Intent.FLAG_GRANT_READ_URI_PERMISSION',
 'Intent.createChooser(send,',
 'Intent.ACTION_CREATE_DOCUMENT',
 'saveAs(call,file,filename,PDF)',
 'printPdf(call,file,filename)',
 'checkWorkbook(bytes)'
])assert(java.includes(token),'A4/export contract missing: '+token);
assert(!java.includes('window.PFM739Pages'),'Old page compositor retained');
assert(!java.includes('composePages('),'Legacy pagination retained');
assert(!java.includes('Double.parseDouble(encoded)'),'Old null parse retained');
for(const method of ['printHTML','savePDF','sharePDF'])
 assert(bridge.includes('async '+method+'(html,name)'),method+' missing');
assert(report.includes("action==='save'?'savePDF':action==='share'?'sharePDF':'printHTML'"),
 'Original print/save/share picker flow altered');
assert(version.includes('versionName "7.3.12"'));
assert(version.includes('versionCode 7312'));
console.log('PASS: One A4 image, no magnification/cropping, M.K footer, native share/save/print and Excel unchanged');
console.log('LIMIT: Actual phone print preview and readability still require device test');
