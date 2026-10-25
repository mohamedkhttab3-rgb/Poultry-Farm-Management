/* QA V8.1 only: real 80,000-bird fixture in a separate, local test profile.
 * This module NEVER merges synthetic invoices into the owner's dataset.
 * QA is always reset from its canonical fixtures on entry; the owner's dataset is untouched. */
(function(){
 'use strict';
 const QA_ID='pfm-v81-qa-80k-local';
 const ORIGIN='pfm-v81-qa80k-origin-session';
 const KEY='poultry_farm_management_v34_'+QA_ID;
 const SESSION='poultry_farm_manager_session_v32';
 const $=id=>document.getElementById(id);
 const tr=(a,e)=>document.documentElement.lang==='en'?e:a;
 const demo=()=>typeof currentUser!=='undefined'&&currentUser?.id===QA_ID;
 function safeSandbox(){
  return typeof currentUser!=='undefined'&&!!currentUser&&
   !!window.PFMV63?.available?.()&&
   (typeof syncBusy==='undefined'||!syncBusy);
 }
 async function enter(){
  if(demo())return;
  if(!safeSandbox())return alert(tr(
   'لا يمكن تبديل الحساب أثناء المزامنة أو عند تعذر التخزين الدائم. أوقف المزامنة ثم حاول.',
   'Switching is disabled during active sync or when durable storage is unavailable.'));
  if(!confirm(tr('فتح حساب الاختبار الأساسي بـ80,000 صوص؟ ستُستبدل أي إدخالات يدوية سابقة في حساب الاختبار فقط، ولن تمس بيانات حسابك الحقيقي.',
   'Open the canonical 80k test? Previous manual edits in the QA profile ONLY will reset; your real account stays intact.')))return;
  const button=$('pfm81-qa-enter');if(button)button.disabled=true;
  try{
   const res=await fetch('./pfm-v81-qa80k.json',{cache:'no-store'});
   if(!res.ok)throw Error('QA dataset not bundled in this build: HTTP '+res.status);
   const fixture=await res.json();
   if(fixture.scenario!=='FICTIONAL_TWO_FARMS_80K_DOC'||fixture.farms?.length!==2||fixture.houses?.length!==4||
    fixture.cycles?.length!==4||fixture.cycles.reduce((n,c)=>n+Number(c.birds||0),0)!==80000||
    fixture.v410?.purchaseDocuments?.length!==34||fixture.v410?.movements?.length!==32||
    fixture.sales?.length!==8)throw Error('80K dataset integrity verification failed');
   if(!window.PFMV63?.available?.())throw Error('Persistent storage not available');
   // Preserve the current local account under its own key before any switch.
   if(typeof persistLocal!=='function')throw Error('Safe account persistence unavailable');
   persistLocal();
   // Stop cloud watchers and pending writes BEFORE leaving the owner's
   // session. On next launch bootAuth skips Supabase entirely in the QA ID.
   if(typeof stopV8Realtime==='function')stopV8Realtime();
   if(typeof syncTimer!=='undefined')clearTimeout(syncTimer);
   const original=JSON.stringify(currentUser);
   if(!JSON.parse(original)?.id)throw Error('Could not identify current account');
   // Reset ONLY this isolated QA key on every entry. No mixing in manual
   // entries from the owner's farms and no cumulative test edits across runs.
   // Persist and verify BEFORE switching user session.
   const data=structuredClone(fixture);
   data.farms.forEach(f=>f.ownerId=QA_ID);
   data.qaOnly=true;
   data.settings={...data.settings,qaOnly:true,localOnly:true,qa80k:true};
   const baseline=JSON.stringify(data);
   window.PFMV63.persist(QA_ID,KEY,baseline);
   if(localStorage.getItem(KEY)!==baseline)throw Error('QA dataset persistence verification failed');
   localStorage.setItem(ORIGIN,original);
   localStorage.setItem(SESSION,JSON.stringify({id:QA_ID,name:'PFM 80K — DEMO ONLY',email:'',role:'owner',qaOnly:true}));
   location.reload();
  }catch(e){alert(tr('تعذر فتح اختبار المزرعتين: ','Could not open two-farm QA profile: ')+e.message)}
  finally{if(button)button.disabled=false}
 }
 async function reset(){
  if(!demo())return alert(tr('افتح ملف الاختبار أولًا.','Enter the QA profile first.'));
  if(!confirm(tr('إعادة ضبط المزرعتين إلى بيانات الـ80,000 صوص الأساسية؟ ستحذف الإدخالات اليدوية التي أجريتها داخل الاختبار فقط.',
    'Reset the two test farms to the canonical 80k dataset? Your QA-only edits will be erased.')))return;
  try{
   const res=await fetch('./pfm-v81-qa80k.json',{cache:'no-store'});
   if(!res.ok)throw Error('QA fixture unavailable');
   const data=await res.json();
   if(data.scenario!=='FICTIONAL_TWO_FARMS_80K_DOC'||data.farms?.length!==2||data.houses?.length!==4||
      data.cycles?.length!==4||data.cycles.reduce((v,c)=>v+Number(c.birds||0),0)!==80000||
      data.v410?.purchaseDocuments?.length!==34||data.v410?.movements?.length!==32||data.sales?.length!==8)
    throw Error('Canonical 80K fixture invalid');
   data.farms.forEach(f=>f.ownerId=QA_ID);
   data.qaOnly=true;data.settings={...data.settings,qaOnly:true,qa80k:true,localOnly:true};
   window.PFMV63.persist(QA_ID,KEY,JSON.stringify(data));
   location.reload();
  }catch(err){alert(tr('تعذر إعادة اختبار الـ80 ألف: ','QA reset failed: ')+err.message)}
 }
 function exit(){
  if(!demo())return;
  const raw=localStorage.getItem(ORIGIN);
  let origin=null;
  try{origin=raw?JSON.parse(raw):null}catch(_){}
  if(!origin?.id||origin.id===QA_ID)return alert(tr('جلسة الحساب الأصلي غير متاحة. سجّل خروج ثم ادخل بحسابك المحلي السابق.','Original profile session is missing. Sign out and log in with your original local account.'));
  if(!confirm(tr('العودة إلى حسابك الأصلي؟ ستبقى المزارع التجريبية في حساب اختبار مستقل.',
   'Return to your original account? Synthetic records remain stored separately.')))return;
  if(typeof persistLocal==='function')persistLocal();
  localStorage.setItem(SESSION,JSON.stringify(origin));
  localStorage.removeItem(ORIGIN);
  location.reload();
 }
 function install(){
  const settings=$('settings');if(!settings||!window.PFMV63)return;
  // Disable the old destructive Saudi demo insertion, even if a stale script
  // was left in a cached build.
  $('pfm68SaudiDemoPanel')?.remove();
  if(!$('pfm81-qa80k-panel')){
   const panel=document.createElement('section');panel.className='panel';panel.id='pfm81-qa80k-panel';
   panel.innerHTML='<h3>مشروع اختبار مستقل — مزرعتان / 80,000 صوص</h3>'+
    '<p>2 مزرعة × 2 عنبر × 20,000 صوص لكل عنبر. 34 فاتورة، 32 حركة صرف، 168 متابعة، 8 مبيعات، وأرصدة وتكاليف مترابطة. جميعها بيانات محاكاة غير حقيقية.</p>'+
    '<p class="muted">عند فتح الاختبار تنتقل إلى حساب محلي مستقل. بيانات مزرعتك الأصلية لا تُستبدل ولا تُدمج أو تُزامن مع الاختبار.</p>'+
    '<div class="actions"><button class="btn primary" type="button" id="pfm81-qa-enter">فتح المزرعتين التجريبيتين بالبيانات الأساسية</button>'+
    '<button class="btn" type="button" id="pfm81-qa-reset">إعادة ضبط بيانات اختبار الـ80 ألف</button>'+ 
    '<button class="btn" type="button" id="pfm81-qa-exit">العودة إلى حسابي الأصلي</button></div>'+
    '<div id="pfm81-qa-status" class="note"></div>';
   settings.querySelector('h2')?.insertAdjacentElement('afterend',panel);
   $('pfm81-qa-enter').addEventListener('click',enter);
   $('pfm81-qa-reset').addEventListener('click',reset);
   $('pfm81-qa-exit').addEventListener('click',exit);
  }
  const entered=demo(),online=typeof supabaseClient!=='undefined'&&!!supabaseClient;
  $('pfm81-qa-enter').hidden=entered;
  $('pfm81-qa-exit').hidden=!entered;
  $('pfm81-qa-reset').hidden=!entered;
  $('pfm81-qa-status').textContent=entered?
   tr('أنت داخل ملف الاختبار المنفصل: جميع المزارع والفواتير هنا تجريبية فقط.','You are in the separate QA profile. All farms and invoices are fictional.'):
   online?tr('يمكن الانتقال من الحساب السحابي أيضًا؛ تُعلّق المزامنة أثناء التجربة ولا تُرفع بيانات الاختبار.','Cloud users may enter too; sync stops while the fictional profile is active.'):
   tr('اضغط فتح المزرعتين، ثم جرّب الفواتير والصرف والربحية والتقارير من الشاشات المعتادة.','Open the two farms and use the normal purchases, inventory, financial and reporting screens.');
  if(entered&&!$('pfm81-qa-exit-fixed')){
   const fixed=document.createElement('div');fixed.id='pfm81-qa-exit-fixed';
   fixed.style.cssText='position:fixed;bottom:10px;left:10px;z-index:9000;max-width:260px;background:#173e62;color:white;padding:8px;border-radius:10px;box-shadow:0 3px 20px #1235;font:12px Arial';
   fixed.innerHTML='<strong>QA — 80,000 صوص (محاكاة)</strong><button type="button" style="display:block;margin-top:5px;padding:7px;border-radius:6px;cursor:pointer">العودة إلى حسابي الأصلي</button>';
   fixed.querySelector('button').onclick=exit;document.body.appendChild(fixed);
  }
 }
 const timer=setInterval(()=>{if($('settings')&&window.PFMV63){install();clearInterval(timer)}},300);
 document.addEventListener('click',event=>{if(event.target.closest('#v53-nav button[onclick*="settings"]'))setTimeout(install,50)});
 window.PFMV81QA80K={enter,exit,reset,install,QA_ID};
})();
