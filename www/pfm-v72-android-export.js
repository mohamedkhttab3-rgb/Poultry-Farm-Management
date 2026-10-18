/* Native Android export bridge. Supports both bundled Capacitor core and the
   Android-injected Capacitor bridge without requiring global registerPlugin. */
(function(){'use strict';
 const PLUGIN='PFMNativeExport';
 let registered=null;
 function native(){
   const cap=window.Capacitor;
   return !!cap && typeof cap.isNativePlatform==='function' &&
     cap.isNativePlatform() && cap.getPlatform?.()==='android';
 }
 function invoke(method,args){
   if(!native())return Promise.reject(Error('Android Capacitor bridge is not ready'));
   const cap=window.Capacitor;
   try{
     if(typeof cap.registerPlugin==='function'){
       if(!registered)registered=cap.registerPlugin(PLUGIN);
       return Promise.resolve(registered[method](args));
     }
     // Native Capacitor injects nativePromise even when @capacitor/core is not
     // imported in this classic-script web app.
     if(typeof cap.nativePromise==='function')return Promise.resolve(cap.nativePromise(PLUGIN,method,args));
     return Promise.reject(Error('Android native export bridge unavailable: nativePromise/registerPlugin missing'));
   }catch(err){return Promise.reject(err);}
 }
 async function base64(blob){
   const bytes=new Uint8Array(await blob.arrayBuffer());
   const chunk=0x6000;let raw='';
   for(let i=0;i<bytes.length;i+=chunk)raw+=String.fromCharCode(...bytes.subarray(i,i+chunk));
   return btoa(raw);
 }
 window.PFMAndroidExport={
   get isAndroid(){return native();},
   async saveBlob(blob,name){return invoke('saveFile',{data:await base64(blob),name});},
   async printHTML(html,name){return invoke('printHTML',{html,name});},
   async savePDF(html,name){return invoke('savePDF',{html,name});},
   async sharePDF(html,name){return invoke('sharePDF',{html,name});}
 };
})();