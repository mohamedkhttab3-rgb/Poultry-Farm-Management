/* V7.2 Capacitor Android export bridge: preserve browser/desktop paths. */
(function(){'use strict';
 const isAndroid=!!(window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform?.()==='android');
 const plugin=isAndroid?window.Capacitor.registerPlugin('PFMNativeExport'):null;
 async function base64(blob){
  const bytes=new Uint8Array(await blob.arrayBuffer());
  const step=0x6000;let out='';
  for(let i=0;i<bytes.length;i+=step)out+=String.fromCharCode(...bytes.subarray(i,i+step));
  return btoa(out);
 }
 window.PFMAndroidExport={
  isAndroid,
  async saveBlob(blob,name){if(!plugin)throw Error('Android file export is unavailable');return plugin.saveFile({data:await base64(blob),name});},
  async printHTML(html,name){if(!plugin)throw Error('Android PDF export is unavailable');return plugin.printHTML({html,name});}
 };
})();