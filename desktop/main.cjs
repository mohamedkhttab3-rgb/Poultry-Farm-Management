// Electron desktop entry. All app and PDF assets are bundled locally.
'use strict';
const {app,BrowserWindow,protocol,net,shell,session,ipcMain,dialog}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..','www');
const pendingPrintDocuments=new Map();
let mainWindow=null;
let pdfBusy=false;
protocol.registerSchemesAsPrivileged([{scheme:'pfm',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
function localResource(url){
 const u=new URL(url);if(u.host!=='app')throw new Error('untrusted origin');
 const rel=decodeURIComponent(u.pathname.replace(/^\//,''));
 const file=path.resolve(ROOT,rel||'index.html');
 if(file!==ROOT&&!file.startsWith(ROOT+path.sep))throw new Error('bad path');
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw new Error('not found');
 return file;
}
async function saveDesktopPDF(event,html,suggestedFileName,requestedAction='preview'){
 if(event.sender!==mainWindow?.webContents||event.sender.getURL()!=='pfm://app/index.html')throw new Error('Unauthorized PDF request');
 if(typeof html!=='string'||!/^<!doctype html>/i.test(html)||!html.includes('id="pfm59PrintRoot"')||html.length>24_000_000){
  throw new Error('Invalid printable report');
 }
 if(pdfBusy)return {ok:false,error:'Another PDF is being prepared'};
 pdfBusy=true;
 const nonce=crypto.randomUUID();
 const printURL='pfm://app/__print__/'+nonce;
 let printWindow;
 try{
  pendingPrintDocuments.set(nonce,html);
  printWindow=new BrowserWindow({show:false,width:1120,height:820,backgroundColor:'#ffffff',
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});
  printWindow.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  printWindow.webContents.on('will-navigate',(evt,url)=>{if(url!==printURL)evt.preventDefault();});
  await printWindow.loadURL(printURL);
  await printWindow.webContents.executeJavaScript(`(async()=>{
    await document.fonts.ready;
    await Promise.all([...document.images].map(img=>img.complete?Promise.resolve():new Promise(resolve=>{
      img.addEventListener('load',resolve,{once:true});img.addEventListener('error',resolve,{once:true});
      setTimeout(resolve,3000);
    })));
    return !!document.getElementById('pfm59PrintRoot');
  })()`);
  // Restore print/preview choices: do not force saving a PDF before printing.
  // Chromium-style preview is unavailable in Electron, so use the system PDF viewer.
  // The single report button already asked for an action; never force
  // the user through a second redundant four-button chooser.
  const selected=['print','save','share','preview'].includes(requestedAction)?requestedAction:'preview';
  const choice={response:selected==='print'?2:selected==='save'?1:selected==='share'?4:0};
  if(choice.response===3)return {ok:false,canceled:true};
  if(choice.response===2){
    const printed=await new Promise(resolve=>{
      printWindow.webContents.print({silent:false,printBackground:true,landscape:true,pageSize:'A4'},(success,reason)=>resolve({success,reason}));
    });
    if(!printed.success){
      if(/cancel/i.test(printed.reason||''))return {ok:false,canceled:true};
      throw new Error(printed.reason||'Failed to print report');
    }
    return {ok:true,printed:true};
  }
  const pdf=await printWindow.webContents.printToPDF({pageSize:'A4',preferCSSPageSize:true,printBackground:true,landscape:true,displayHeaderFooter:false});
  if(!Buffer.isBuffer(pdf)||pdf.length<800||pdf.subarray(0,5).toString()!=='%PDF-')throw new Error('PDF output validation failed');
  const fileName=String(suggestedFileName||'Poultry-Farm-Management-Report.pdf').replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').slice(0,140);
  if(choice.response===0||choice.response===4){
    const previewDir=path.join(app.getPath('temp'),'PoultryFarmManagement-PrintPreview');
    await fs.promises.mkdir(previewDir,{recursive:true});
    const previewPath=path.join(previewDir,nonce+'.pdf');
    await fs.promises.writeFile(previewPath,pdf);
    if(choice.response===4){
      // Invoke the Windows 10/11 Share Sheet through a bundled, per-window
      // DataTransferManagerInterop host. A file path alone is not a share.
      const helper=app.isPackaged
        ?path.join(process.resourcesPath,'windows-share','PFMWindowsShare.exe')
        :path.join(__dirname,'windows-share','publish','PFMWindowsShare.exe');
      try{
        await fs.promises.access(helper,fs.constants.R_OK);
        const child=spawn(helper,[previewPath],{
          windowsHide:false,detached:true,stdio:'ignore',shell:false
        });
        const launched=await new Promise((resolve,reject)=>{
          child.once('error',reject);
          child.once('spawn',()=>resolve(true));
        });
        if(!launched)throw Error('Windows sharing helper did not start');
        child.unref();
        return {ok:true,shareSheetRequested:true};
      }catch(shareErr){
        // Only fallback when native sharing is unavailable. Do not say the
        // document was shared or show a misleading success popup.
        shell.showItemInFolder(previewPath);
        await dialog.showMessageBox(mainWindow,{
          type:'warning',title:'مشاركة تقرير PDF',
          message:'تعذر فتح نافذة مشاركة Windows مباشرة.',
          detail:'تم تحديد ملف PDF في مستكشف الملفات حتى تتمكن من اختيار مشاركة يدويًا. السبب: '+String(shareErr.message||shareErr),
          buttons:['حسنًا']
        });
        return {ok:true,manualShareFallback:true};
      }
    }
    const viewerError=await shell.openPath(previewPath);
    if(viewerError)throw new Error('Could not open PDF viewer: '+viewerError+'; file: '+previewPath);
    return {ok:true,preview:true};
  }
  const chosen=await dialog.showSaveDialog(mainWindow,{
    title:'حفظ التقرير PDF - Poultry Farm Management',
    defaultPath:path.join(app.getPath('documents'),fileName.toLowerCase().endsWith('.pdf')?fileName:fileName+'.pdf'),
    filters:[{name:'PDF Documents',extensions:['pdf']}],properties:['createDirectory','showOverwriteConfirmation']
  });
  if(chosen.canceled||!chosen.filePath)return {ok:false,canceled:true};
  await fs.promises.writeFile(chosen.filePath,pdf);
  const reply=await dialog.showMessageBox(mainWindow,{
    type:'info',title:'Poultry Farm Management',
    message:'تم حفظ التقرير بصيغة PDF بنجاح',detail:chosen.filePath,
    buttons:['فتح PDF للطباعة','إغلاق'],defaultId:0,cancelId:1,noLink:true
  });
  if(reply.response===0){
    const viewerError=await shell.openPath(chosen.filePath);
    if(viewerError)throw new Error('PDF saved, but viewer could not open: '+viewerError);
  }
  return {ok:true,saved:true};
 }catch(err){console.error('PFM desktop PDF:',err);return {ok:false,error:String(err.message||err)};}
 finally{
  pendingPrintDocuments.delete(nonce);
  if(printWindow&&!printWindow.isDestroyed())printWindow.destroy();
  pdfBusy=false;
 }
}
app.whenReady().then(async()=>{
 protocol.handle('pfm',req=>{
  try{
   const u=new URL(req.url);
   if(u.host==='app'&&u.pathname.startsWith('/__print__/')){
    const nonce=u.pathname.slice('/__print__/'.length);
    const html=pendingPrintDocuments.get(nonce);
    if(typeof html!=='string')return new Response('Not found',{status:404});
    return new Response(html,{status:200,headers:{
      'Content-Type':'text/html; charset=utf-8',
      'Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'none'; img-src pfm: data:; style-src pfm: 'unsafe-inline'; font-src pfm: data:; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'"
    }});
   }
   return net.fetch(pathToFileURL(localResource(req.url)).toString());
  }
  catch(_err){return new Response('Not found',{status:404});}
 });
 session.defaultSession.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
 ipcMain.handle('pfm:save-report-pdf',saveDesktopPDF);
 mainWindow=new BrowserWindow({width:1350,height:880,minWidth:390,minHeight:520,backgroundColor:'#f5f8fb',title:'Poultry Farm Management',autoHideMenuBar:true,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 mainWindow.webContents.setWindowOpenHandler(({url})=>{
  try{
   const u=new URL(url);const hosts=['aviagen.com','cobbgenetics.com','hubbardbreeders.com'];
   if(u.protocol==='https:'&&hosts.some(x=>u.hostname===x||u.hostname.endsWith('.'+x))){shell.openExternal(url);}
  }catch(_error){}
  return {action:'deny'};
 });
 mainWindow.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('pfm://app/'))event.preventDefault();});
 await mainWindow.loadURL('pfm://app/index.html');
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
