'use strict';
// Android-only contract checks: no changes to Windows or application data.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
(async()=>{
  const android=read('www/pfm-v72-android-export.js');
  const native=read('native-assets/android/PFMNativeExportPlugin.java');
  const installer=read('scripts/install-android-export.cjs');
  const ui=read('www/pfm-v73-android.js');
  const html=read('www/index.html');
  for(const token of ['@CapacitorPlugin(name = "PFMNativeExport")','void saveFile(PluginCall call)','void printHTML(PluginCall call)'])
    assert(native.includes(token),'Missing native export contract: '+token);
  assert(installer.includes('registerPlugin(PFMNativeExportPlugin.class)'),'Android plugin registration missing');
  assert(html.includes('pfm-v72-android-export.js'),'Android export JS not linked');
  assert(ui.includes('Poultry Farm Management M.K™'),'Approved identity missing');
  const methods=[];
  const context={window:{},Uint8Array,Blob,btoa:s=>Buffer.from(s,'binary').toString('base64')};
  vm.runInNewContext(android,context,{filename:'pfm-v72-android-export.js'});
  assert.equal(context.window.PFMAndroidExport.isAndroid,false);
  await assert.rejects(context.window.PFMAndroidExport.printHTML('<p>test</p>','test.pdf'),/bridge is not ready/);
  context.window.Capacitor={
    isNativePlatform:()=>true,getPlatform:()=> 'android',
    registerPlugin:(name)=>{
      assert.equal(name,'PFMNativeExport');
      return {
        printHTML:async payload=>{methods.push(['pdf',payload]);return {ok:true};},
        saveFile:async payload=>{methods.push(['file',payload]);return {ok:true};}
      };
    }
  };
  assert.equal(context.window.PFMAndroidExport.isAndroid,true);
  await context.window.PFMAndroidExport.printHTML('<div id="pfm59PrintRoot">report</div>','report.pdf');
  await context.window.PFMAndroidExport.saveBlob(new Blob(['xlsx test payload']),'report.xlsx');
  assert.equal(methods.length,2);
  assert.equal(methods[0][1].name,'report.pdf');
  assert.equal(methods[1][1].name,'report.xlsx');
  assert.equal(Buffer.from(methods[1][1].data,'base64').toString(),'xlsx test payload');
  console.log('PASS: Android export bridge registers lazily, forwards PDF, encodes Excel bytes, and native contract matches.');
  console.log('LIMIT: This does not establish that the XLSX is valid or that a real Android device can print/share.');
})().catch(err=>{console.error(err);process.exitCode=1});
