'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const pdf=fs.readFileSync('www/pfm-v59-print-results.js','utf8');
const desktop=fs.readFileSync('desktop/main.cjs','utf8');
const native=fs.readFileSync('native-assets/android/PFMNativeExportPlugin.java','utf8');
const ios=fs.readFileSync('www/pfm-v81-report-actions.js','utf8');
assert(pdf.includes("window.PFMPrintResults59=async function(action='print')"));
assert(pdf.includes('const logo=await sourceLogoAsDataURI()'),'toolbar PDF waits for logo');
assert(pdf.includes('new FileReader()')&&pdf.includes('reader.readAsDataURL(blob)'),
 'The original logo is embedded, not a broken relative remote image');
assert(pdf.includes('standalone(root,logo)'), 'every report gets the same embedded logo');
assert(pdf.includes('<span>Poultry Farm Management M.K™</span>'), 'footer brand must remain next to logo');
assert(pdf.includes("marginBoxFooter?'0':'-10mm'"), 'move footer into reserved page margin');
assert(desktop.includes('shareSheetOpened:true'),'desktop must ask native share OS');
assert(desktop.includes("status.trim()==='OPENED'"),'opening dialog must be acknowledged');
assert(native.includes('Intent.ACTION_SEND')&&native.includes('send.putExtra(Intent.EXTRA_STREAM,link)'));
assert(native.includes('send.setType(PDF)')&&native.includes('send.setClipData(ClipData.newRawUri(filename,link))'));
assert(native.includes('chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)'));
assert(native.includes('grantUriPermission(ri.activityInfo.packageName,link'),
 'actual Android receiver apps must have access to the exported file');
assert(!native.includes('share-dialog-opened",true'),'do not claim a completed share merely because a chooser opened');
assert(ios.includes('PDF report'),'single report action remains installed');
console.log('PASS share: original logo embedded in toolbar print, in-bounds footer, native Windows share acknowledgement and Android PDF URI grants');
