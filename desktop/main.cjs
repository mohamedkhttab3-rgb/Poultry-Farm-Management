// Electron desktop entry. Source app is bundled, no network code downloaded.
'use strict';
const {app,BrowserWindow,protocol,net,shell,session}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const {pathToFileURL}=require('node:url');
const ROOT=path.resolve(__dirname,'..','www');
protocol.registerSchemesAsPrivileged([{scheme:'pfm',privileges:{standard:true,secure:true,supportFetchAPI:true,stream:true}}]);
function localResource(url){
 const u=new URL(url);if(u.host!=='app')throw new Error('untrusted origin');
 const rel=decodeURIComponent(u.pathname.replace(/^\//,''));
 const file=path.resolve(ROOT,rel||'index.html');
 if(file!==ROOT&&!file.startsWith(ROOT+path.sep))throw new Error('bad path');
 if(!fs.existsSync(file)||!fs.statSync(file).isFile())throw new Error('not found');
 return file;
}
app.whenReady().then(async()=>{
 protocol.handle('pfm',req=>{
  try{return net.fetch(pathToFileURL(localResource(req.url)).toString());}
  catch(_err){return new Response('Not found',{status:404});}
 });
 session.defaultSession.setPermissionRequestHandler((_contents,permission,callback)=>callback(false));
 const win=new BrowserWindow({width:1350,height:880,minWidth:390,minHeight:520,backgroundColor:'#f5f8fb',title:'Poultry Farm Management',autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
 win.webContents.setWindowOpenHandler(({url})=>{
  try{
   const u=new URL(url);const hosts=['aviagen.com','cobbgenetics.com','hubbardbreeders.com'];
   if(u.protocol==='https:'&&hosts.some(x=>u.hostname===x||u.hostname.endsWith('.'+x))){shell.openExternal(url);}
  }catch(_error){}
  return {action:'deny'};
 });
 win.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('pfm://app/'))event.preventDefault();});
 await win.loadURL('pfm://app/index.html');
});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
