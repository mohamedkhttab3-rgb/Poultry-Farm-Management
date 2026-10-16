/* Android native export bridge. Resolve Capacitor lazily when invoked. */
(function(){'use strict';
 let registered=null;
 function bridge(){
   const cap=window.Capacitor;
   if(!cap || typeof cap.registerPlugin!=='function' || !cap.isNativePlatform?.() || cap.getPlatform?.()!=='android')
     throw Error('Android Capacitor bridge is not ready');
   if(!registered)registered=cap.registerPlugin('PFMNativeExport');
   return registered;
 }
 async function base64(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const step=0x6000;let out='';
  for(let i=0;i<bytes.length;i+=step)out+=String.fromCharCode(...bytes.subarray(i,i+step));
  return btoa(out);
 }
 window.PFMAndroidExport={
   get isAndroid(){return !!(window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform?.()==='android');},
   async saveBlob(blob,name){return bridge().saveFile({data:await base64(blob),name});},
   async printHTML(html,name){return bridge().printHTML({html,name});}
 };
})();