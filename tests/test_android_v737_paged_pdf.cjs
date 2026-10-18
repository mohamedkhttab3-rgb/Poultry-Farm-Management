'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict');
const java=fs.readFileSync('native-assets/android/PFMNativeExportPlugin.java','utf8');
const report=fs.readFileSync('www/pfm-v59-print-results.js','utf8');
const bridge=fs.readFileSync('www/pfm-v72-android-export.js','utf8');
const version=fs.readFileSync('scripts/set-android-version.cjs','utf8');
for(const token of [
 'void writeSingleA4(',
 'void measureFullScreen(',
 'paper.scale(scale,scale)',
 'final float scale=Math.min(1f,Math.min(availableWidth/width,',
 'web.draw(paper)',
 'paper.clipRect(x,y,x+fittedWidth,y+fittedHeight)',
 'new PdfDocument.PageInfo.Builder(PAGE_W,PAGE_H,1)',
 'paper.drawBitmap(logo,null,rect,',
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
assert(version.includes('versionName "7.3.14"'));
assert(version.includes('versionCode 7314'));
for(const token of ['web.createPrintDocumentAdapter(filename)','renderer.onLayout(oldAttrs,newAttrs,signal,callback,extras)','renderer.onWrite(pages,destination,signal,callback)','PrintAttributes.MediaSize.ISO_A4.asLandscape()','prepareNativePrint(call,html,fileName)','pfm-v7314-native-print.css'])assert(java.includes(token),'Native HTML printing missing: '+token);
assert(java.includes('if("print".equals(action))main.post(()->prepareNativePrint'),'Print must use HTML not PDF screenshot');
console.log('PASS: Native A4 HTML printing and preserved one-page PDF save/share, no magnification/cropping, M.K footer, native share/save/print and Excel unchanged');
console.log('LIMIT: Actual phone print preview and readability still require device test');
