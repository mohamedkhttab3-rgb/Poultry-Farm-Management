/* V7.2.1 Android-only login shell: layout and cloud connection guidance.
   Never reads or rewrites accounts/passwords, project data or reports. */
(function(){'use strict';
function nativeAndroid(){return !!(window.Capacitor?.isNativePlatform?.()&&window.Capacitor.getPlatform?.()==='android');}
function install(){
 if(!nativeAndroid())return;
 const overlay=document.getElementById('authOverlay');
 const stage=document.getElementById('pfmV5Stage');
 const box=stage?.querySelector('.authBox');
 if(!overlay||!stage||!box)return;
 document.documentElement.classList.add('pfm72-android-native');
 if(stage.querySelector('.pfm72-mobile-brand'))return;
 const branding=document.createElement('div');
 branding.className='pfm72-mobile-brand';
 branding.setAttribute('aria-label','Poultry Farm Management M.K');
 branding.innerHTML='<img src="./pfm-logo.png" alt="Poultry Farm Management" width="106" height="106"><strong>إدارة مزارع الدواجن</strong><small>Poultry Farm Management M.K™</small>';
 stage.insertBefore(branding,box);
 const section=document.createElement('section');
 section.className='pfm72-cloud-area';
 section.innerHTML='<details id="pfm72CloudSetup"><summary>☁️ ربط حساب سحابي / استعادة كلمة المرور بالبريد</summary>'+
 '<div class="pfm72-cloud-content">'+
 '<small>الدخول إلى حساب من الكمبيوتر على هذا الهاتف يحتاج مزامنة سحابية معدة مسبقًا. الحساب المحلي لا يرسل رسائل بريد ولا ينتقل بين الأجهزة تلقائيًا.</small>'+
 '<label for="pfm72CloudUrl">Supabase Project URL</label><input id="pfm72CloudUrl" type="url" placeholder="https://PROJECT.supabase.co" autocomplete="off">'+
 '<label for="pfm72CloudKey">Publishable / Anon key (ليس Secret)</label><input id="pfm72CloudKey" type="text" placeholder="sb_publishable_... أو anon" autocomplete="off" spellcheck="false">'+
 '<label for="pfm72CloudRedirect">رابط إعادة تعيين كلمة المرور HTTPS (اختياري، يتطلب ضبطه في Supabase)</label><input id="pfm72CloudRedirect" type="url" placeholder="https://your-site.example/reset" autocomplete="off">'+
 '<button id="pfm72CloudConnect" type="button">ربط الحساب السحابي</button>'+
 '<small id="pfm72CloudStatus" role="status" aria-live="polite"></small>'+
 '<small>استخدم إعداد مشروعك السحابي الحالي فقط. لا تدخل Secret أو service_role. لن يحوّل الربط الحساب المحلي إلى حساب سحابي تلقائيًا.</small>'+
 '</div></details>';
 box.appendChild(section);
 const config=window.PFM_SUPABASE_CONFIG||{};
 for(const [key,val] of [['pfm72CloudUrl',config.url],['pfm72CloudKey',config.publishableKey],['pfm72CloudRedirect',config.redirectTo]]){
  const el=document.getElementById(key);if(el&&val)el.value=String(val);
 }
 const btn=document.getElementById('pfm72CloudConnect');
 btn?.addEventListener('click',async()=>{
  const output=document.getElementById('pfm72CloudStatus');
  const url=document.getElementById('pfm72CloudUrl').value.trim().replace(/\/$/,'');
  const publishableKey=document.getElementById('pfm72CloudKey').value.trim();
  const redirectTo=document.getElementById('pfm72CloudRedirect').value.trim();
  if(!/^https:\/\/[A-Za-z0-9.-]+\.supabase\.co$/.test(url)||publishableKey.length<20
     ||/sb_secret_|service_role|YOUR_PROJECT|YOUR_SUPABASE/i.test(publishableKey)
     ||(redirectTo&&!/^https:\/\//i.test(redirectTo))){
    output.textContent='اكتب Project URL وPublishable/Anon key الحقيقيين فقط، ورابط HTTPS صالح إن استخدمته.';
    return;
  }
  btn.disabled=true;output.textContent='جارٍ محاولة الاتصال...';
  try{
   const settings={url,publishableKey,redirectTo};
   window.localStorage.setItem('pfm_supabase_config_v36',JSON.stringify(settings));
   window.PFM_SUPABASE_CONFIG=settings;
   if(typeof window.activateSupabase!=='function')throw Error('Cloud connection is unavailable');
   await window.activateSupabase();
   output.textContent='تم حفظ إعداد المشروع. تحقق من رسالة الاتصال أعلاه. عند نجاح الربط استخدم تسجيل الدخول أو نسيت كلمة المرور.';
  }catch(err){output.textContent='تعذر التفعيل: '+(err?.message||String(err));}
  finally{btn.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
function installAndroid73(){
 if(!nativeAndroid()||document.getElementById('pfm73-android-loader'))return;
 const script=document.createElement('script');script.id='pfm73-android-loader';
 script.src='./pfm-v73-android.js';document.head.appendChild(script);
 const core=document.createElement('script');core.src='./pfm-v74-purchase-core.js';
 core.addEventListener('load',()=>{
   if(document.getElementById('pfm75-purchases-loader'))return;
   const purchases=document.createElement('script');purchases.id='pfm75-purchases-loader';
   purchases.src='./pfm-v75-android-purchases.js';document.head.appendChild(purchases);
 });
 document.head.appendChild(core);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',installAndroid73,{once:true});else installAndroid73();
})();