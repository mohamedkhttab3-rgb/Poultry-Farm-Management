/* V8 cross-platform purchase loader. The existing Android bootstrap remains
   unchanged; Windows and iOS reuse its approved UI and existing financial ledgers.
   Never load two copies of the purchases module. */
(function(){
 'use strict';
 const cap=window.Capacitor;
 const android=!!(cap?.isNativePlatform?.()&&cap.getPlatform?.()==='android');
 if(android)return;
 if(document.getElementById('pfm-v8-purchases-core-loader'))return;
 window.PFMV8SharedPurchasesEnabled=true;
 const core=document.createElement('script');
 core.id='pfm-v8-purchases-core-loader';
 core.src='./pfm-v74-purchase-core.js';
 core.addEventListener('load',()=>{
  if(document.getElementById('pfm-v8-purchases-ui-loader'))return;
  const script=document.createElement('script');
  script.id='pfm-v8-purchases-ui-loader';
  script.src='./pfm-v75-android-purchases.js';
  document.head.appendChild(script);
 });
 document.head.appendChild(core);
})();
