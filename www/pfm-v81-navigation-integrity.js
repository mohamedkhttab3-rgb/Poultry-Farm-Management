/* V8.1 canonical sidebar guard — one source of navigation truth.
 * The route/list order is a CONTRACT, not merely a cosmetic tweak.
 * Explicitly shield it from old V7/V8 scripts reparenting the buttons. */
(function(){
 'use strict';
 const routes=[
  {stage:'9',group:'nutrition',ar:'المشتريات والمخزون',en:'Purchases & Inventory',page:'inventory'},
  {stage:'5',group:'daily',ar:'المتابعة اليومية',en:'Daily Monitoring',page:'daily'},
  {stage:'6',group:'daily',ar:'الأوزان الأسبوعية',en:'Weekly Weights',page:'weights'},
  {stage:'8',group:'daily',ar:'الأدوية والتحصينات',en:'Medicines & Vaccinations',page:'meds'}
 ];
 let repairing=false,installed=false;
 function fix(){
  if(repairing)return;
  const nav=document.getElementById('v53-nav');if(!nav)return false;
  const destinations={
   nutrition:nav.querySelector('[data-v55-group="nutrition"] .v55-nav-items'),
   daily:nav.querySelector('[data-v55-group="daily"] .v55-nav-items')
  };
  if(!destinations.nutrition||!destinations.daily)return false;
  repairing=true;
  try{
   const english=document.documentElement.lang==='en';
   for(const route of routes){
    const button=nav.querySelector('button[data-stage="'+route.stage+'"]');
    if(!button)continue; // Do not create duplicate functional route buttons.
    const group=destinations[route.group];
    if(button.parentElement!==group)group.appendChild(button);
    const expected=english?route.en:route.ar;
    if(button.textContent.trim()!==expected)button.textContent=expected;
    if(button.getAttribute('title')!==expected)button.setAttribute('title',expected);
    if(button.getAttribute('aria-label')!==expected)button.setAttribute('aria-label',expected);
    button.dataset.noTranslate='1';
    button.dataset.pfmNavOwner=route.group;
    if(button.hidden)button.hidden=false;
   }
   // Keep the correct within-group order: daily, weights, medicines.
   for(const group of ['nutrition','daily']){
    const dest=destinations[group];
    const expected=routes.filter(x=>x.group===group).map(x=>x.stage);
    const actual=[...dest.querySelectorAll(':scope > button')].filter(x=>expected.includes(x.dataset.stage))
      .map(x=>x.dataset.stage);
    if(actual.join('|')!==expected.join('|')){
     for(const stage of expected){
      const el=dest.querySelector('button[data-stage="'+stage+'"]');
      if(el)dest.appendChild(el);
     }
    }
   }
   // Old independent Feed purchasing is retired; records remain accessible
   // through invoice/lot movements, but duplicate UI entry cannot reopen.
   const obsolete=nav.querySelector('button[data-stage="7"]');
   if(obsolete){obsolete.hidden=true;obsolete.setAttribute('aria-hidden','true');}
   const stockHeading=document.querySelector('#inventory > h2');
   if(stockHeading){
    const desired=english?'Purchases & Inventory':'المشتريات والمخزون';
    if(stockHeading.textContent.trim()!==desired)stockHeading.textContent=desired;
   }
   return true;
  }finally{repairing=false;}
 }
 function boot(){
  if(installed||!fix())return false;
  installed=true;
  const nav=document.getElementById('v53-nav');
  const observer=new MutationObserver(()=>{
   if(!repairing)queueMicrotask(fix);
  });
  observer.observe(nav,{childList:true,subtree:true,characterData:true,attributes:true,
   attributeFilter:['style','class','hidden','title']});
  new MutationObserver(fix).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  // Keep medication choice visible even if an old one-page layout injected
  // a CSS rule hiding stage 8. Only the legacy independent feed is hidden.
  if(!document.getElementById('pfm-v81-nav-stability-style')){
   const style=document.createElement('style');
   style.id='pfm-v81-nav-stability-style';
   style.textContent='#v53-nav [data-v55-group="daily"] button[data-stage="8"]{display:block!important}'+
    '#v53-nav button[data-stage="7"]{display:none!important}'+
    '#v53-nav [data-v55-group="nutrition"] button[data-stage="9"]::after{content:none!important}';
   document.head.appendChild(style);
  }
  window.PFMV81NavigationIntegrity={fix,routes};
  return true;
 }
 let attempts=0;
 const timer=setInterval(()=>{if(boot()||++attempts>=100)clearInterval(timer)},150);
})();
