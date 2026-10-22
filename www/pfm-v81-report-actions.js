/* V8.1: one clear PDF action, with print/save/share choices.
   Keep the shared report renderer. Never create a PDF from a screenshot. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const en=()=>document.documentElement.lang==='en';
 const tr=(ar,english)=>en()?english:ar;
 let busy=false;
 function install(){
  const view=$('reports');
  const original=view?.querySelector('button[onclick*="PFMPrintResults59"]');
  if(!original)return false;
  if(!$('pfm81-pdf-action')){
   original.id='pfm81-pdf-action';
   original.removeAttribute('onclick');
   original.textContent=tr('تقرير PDF — طباعة / حفظ / مشاركة','PDF report — Print / Save / Share');
   original.addEventListener('click',open);
  }
  // V7.3 Android used three additional buttons (plus the original).
  // These are redundant now; retain all native action handlers behind one menu.
  view.querySelectorAll('[data-pfm-android-pdf]').forEach(node=>node.remove());
  if(!$('pfm81-pdf-menu')){
   const sheet=document.createElement('div');
   sheet.id='pfm81-pdf-menu';sheet.hidden=true;sheet.setAttribute('role','dialog');
   sheet.setAttribute('aria-modal','true');
   sheet.setAttribute('aria-label',tr('إجراءات التقرير PDF','PDF report actions'));
   sheet.innerHTML='<div class="pfm81-pdf-card"><h3>'+tr('تقرير الدورة — PDF','Cycle report — PDF')+'</h3>'+
    '<p>'+tr('اختر إجراء واحدًا. يتم استخدام نفس التقرير الكامل مع جميع الطرق.',
      'Choose one action; all options use the same complete report.')+'</p>'+
    '<div class="pfm81-pdf-options">'+
     '<button class="btn" type="button" data-pfm81-pdf-choice="print">'+tr('طباعة PDF','Print PDF')+'</button>'+
     '<button class="btn" type="button" data-pfm81-pdf-choice="save">'+tr('حفظ PDF','Save PDF')+'</button>'+
     '<button class="btn" type="button" data-pfm81-pdf-choice="share">'+tr('مشاركة PDF','Share PDF')+'</button>'+
     '<button class="btn" type="button" data-pfm81-pdf-choice="cancel">'+tr('إلغاء','Cancel')+'</button></div>'+
    '<p class="muted">'+tr('على بعض الأنظمة، قد تُفتح نافذة النظام لاختيار الوجهة أو فتح الملف للمشاركة.',
     'Your device may show a system destination or file-sharing chooser.')+'</p></div>';
   const style=document.createElement('style');
   style.id='pfm81-pdf-menu-style';
   style.textContent='#pfm81-pdf-menu[hidden]{display:none!important}#pfm81-pdf-menu{position:fixed;inset:0;z-index:999999;background:rgba(8,28,51,.66);display:flex;align-items:center;justify-content:center;padding:16px}'+
    '.pfm81-pdf-card{width:min(520px,100%);background:#fff;border-radius:16px;padding:20px;color:#123451;box-shadow:0 10px 50px #102d4b66;direction:rtl}'+
    '.pfm81-pdf-options{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:15px 0}'+
    '.pfm81-pdf-options .btn{white-space:normal;min-height:54px;font-size:15px}';
   document.head.appendChild(style);document.body.appendChild(sheet);
   sheet.addEventListener('click',e=>{
    const action=e.target.closest('[data-pfm81-pdf-choice]')?.dataset.pfm81PdfChoice;
    if(!action){if(e.target===sheet)close();return;}
    if(action==='cancel'){close();return;}
    close();
    if(busy)return;
    busy=true;
    try{
     if(typeof window.PFMPrintResults59!=='function')throw Error('PDF renderer unavailable');
     const ios=window.Capacitor?.isNativePlatform?.()&&window.Capacitor?.getPlatform?.()==='ios';
     if(ios&&action==='share'){
      alert(tr('على iOS افتح معاينة الطباعة، ثم استخدم زر المشاركة في عارض PDF الخاص بالنظام. لم يتم إرسال ملف تلقائيًا.',
       'On iOS, open the system PDF print preview and use its Share option. No file has been automatically sent.'));
      window.PFMPrintResults59('print');
     }else window.PFMPrintResults59(action);
    }catch(err){alert(tr('تعذر تصدير PDF: ','PDF export failed: ')+err.message)}
    finally{busy=false}
   });
   document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!sheet.hidden)close()});
  }
  return true;
 }
 function open(){
  if(!install())return alert(tr('تقرير PDF غير متاح.','PDF report unavailable.'));
  const box=$('pfm81-pdf-menu');box.hidden=false;
  box.querySelector('button')?.focus();
 }
 function close(){$('pfm81-pdf-menu').hidden=true;$('pfm81-pdf-action')?.focus();}
 function init(){
  if(!install())return;
  // Other scripts sometimes append the legacy Android buttons on DOMReady.
  const root=$('reports');
  if(root&&typeof MutationObserver==='function'){
   new MutationObserver(()=>root.querySelectorAll('[data-pfm-android-pdf]').forEach(x=>x.remove()))
    .observe(root,{childList:true,subtree:true});
  }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
