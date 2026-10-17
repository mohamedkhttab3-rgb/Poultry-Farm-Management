/* Android V7.3.2 — standalone navigation and branding.
   The older sidebar remapping is retired. Keep original view buttons/handlers and
   application data intact. No PDF, Excel, finance or Windows changes here. */
(function () {
 'use strict';
 const cap=window.Capacitor;
 if(!(cap && typeof cap.isNativePlatform==='function' && cap.isNativePlatform() && cap.getPlatform?.()==='android'))return;
 const definitions=[
  {id:'project',ar:'مدخلات المشاريع',en:'Project Setup',screens:[
   ['2','farms','المزارع','Farms'],['3','houses','العنابر','Houses'],['4','cycles','الدورات','Cycles']]},
  {id:'nutrition',ar:'المشتريات',en:'Purchases',screens:[
   ['7','feed','الأعلاف','Feed'],['8','meds','الأدوية والتحصينات','Medications & Vaccinations'],['9','inventory','المخزون','Inventory']]},
  {id:'daily',ar:'المتابعة اليومية للدورات',en:'Daily Cycle Monitoring',screens:[
   ['5','daily','المتابعة اليومية','Daily Follow-up'],['6','weights','الأوزان الأسبوعية','Weekly Weights']]},
  {id:'finance',ar:'المبيعات والمالية',en:'Sales & Finance',screens:[
   ['10','sales','المبيعات والحصاد','Sales & Harvest'],['11','finance','التكاليف والأرباح','Costs & Profits']]}
 ];
 const $=(sel,base=document)=>base.querySelector(sel);
 const lang=()=>document.documentElement.lang==='en'?'en':'ar';
 function style(){
  if(document.getElementById('pfm-v732-nav-style'))return;
  const sheet=document.createElement('style');sheet.id='pfm-v732-nav-style';
  sheet.textContent=[
   'html.pfm72-android-native nav#v53-nav .pfm-side-brand.pfm-v732-brand{box-sizing:border-box!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:8px!important;width:100%!important;min-width:0!important;max-width:100%!important;padding:16px 12px 18px!important;text-align:center!important;direction:ltr!important}',
   'html.pfm72-android-native nav#v53-nav .pfm-v732-brand img{width:72px!important;height:72px!important;min-width:72px!important;flex:0 0 72px!important;object-fit:contain!important;object-position:center!important;border-radius:50%!important;margin:0 auto!important}',
   'html.pfm72-android-native nav#v53-nav .pfm-v732-brand .pfm-v732-name{display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;color:#f5faff!important;font-size:16px!important;font-weight:800!important;line-height:1.35!important;text-align:center!important;overflow-wrap:normal!important}',
   'html.pfm72-android-native nav#v53-nav .pfm-v732-brand .pfm-v732-mark{display:block!important;margin:0 auto!important;direction:ltr!important;unicode-bidi:isolate!important;text-align:center!important;white-space:nowrap!important;letter-spacing:.08em!important;font:800 13px/1.5 Arial,sans-serif!important;color:#dceeff!important}',
   'html.pfm72-android-native nav#v53-nav .v55-nav-group .v55-group-title{font-size:14px!important;line-height:1.4!important;white-space:normal!important}',
   'html.pfm72-android-native nav#v53-nav .v55-nav-items>button[data-stage]{font-size:13px!important;min-height:38px!important;text-align:start!important;line-height:1.5!important}',
   'html.pfm72-android-native nav#v53-nav .v55-nav-items{min-width:0!important;max-width:100%!important;box-sizing:border-box!important}',
   'html.pfm72-android-native nav#v53-nav .v55-nav-items>button[data-stage]{max-width:100%!important;box-sizing:border-box!important}'
  ].join('\n');
  document.head.appendChild(sheet);
 }
 function brand(){
  const nav=$('#v53-nav');
  const holder=nav && $('.pfm-side-brand',nav);
  if(!holder)return false;
  if(!holder.classList.contains('pfm-v732-brand')){
   // Replace ONLY the obsolete sidebar brand DOM, never the navigation or data.
   const img=document.createElement('img');
   img.src='./pfm-logo-96.png';img.alt='Poultry Farm Management';img.width=72;img.height=72;
   const title=document.createElement('strong');title.className='pfm-v732-name';title.textContent='Poultry Farm Management';title.dir='ltr';
   const mark=document.createElement('small');mark.className='pfm-v732-mark';mark.textContent='M.K™';mark.dir='ltr';
   holder.replaceChildren(img,title,mark);
   holder.classList.add('pfm-v732-brand');
  }
  holder.dir='ltr';
  const mark=$('.pfm-v732-mark',holder);
  if(mark){mark.textContent='M.K™';mark.dir='ltr';}
  return true;
 }
 function collect(nav){
  const found=new Map();
  for(const button of nav.querySelectorAll('.v55-nav-items > button[data-stage]')){
   if(!found.has(button.dataset.stage))found.set(button.dataset.stage,button);
  }
  return found;
 }
 function validate(groups,buttons){
  for(const group of definitions){
   const g=groups.get(group.id);
   if(!g||!$('.v55-nav-items',g)||!$('.v55-group-title',g))return 'Missing group '+group.id;
   for(const [stage,screen] of group.screens){
    const button=buttons.get(stage),click=button?.getAttribute('onclick')||'';
    if(!button||!new RegExp("show\\(\\s*['\"]"+screen+"['\"]").test(click))
     return 'Missing or unexpected navigation button '+screen;
   }
  }
  return '';
 }
 let snapshot=null;
 function repair(){
  const nav=$('#v53-nav');
  if(!nav)return false;
  style();
  brand();
  const groups=new Map([...nav.querySelectorAll(':scope > .v55-nav-group[data-v55-group]')]
   .map(x=>[x.dataset.v55Group,x]));
  const buttons=collect(nav);
  const error=validate(groups,buttons);
  if(error){console.error('PFM V7.3.2 navigation:',error);return false;}
  // Preserve original buttons, onclick handlers and active styles. No copies.
  for(const def of definitions){
   const group=groups.get(def.id);
   const container=$('.v55-nav-items',group);
   for(const [stage] of def.screens)container.appendChild(buttons.get(stage));
   const title=$('.v55-group-title',group);
   title.dataset.v55Ar=def.ar;title.dataset.v55En=def.en;
   title.dataset.noTranslate='1';
  }
  // Normalize workflow order as siblings so CSS does not hide original screens.
  const original=groups.get('project');
  let cursor=original;
  for(const id of ['nutrition','daily','finance']){
   const target=groups.get(id);
   if(cursor.nextElementSibling!==target)cursor.after(target);
   cursor=target;
  }
  if(!nav.dataset.pfmV732Nav){
   nav.dataset.pfmV732Nav='1';
  }
  translate();
  snapshot=inspect();
  if(!snapshot.valid)console.error('PFM V7.3.2 unexpected final navigation:',snapshot);
  return snapshot.valid;
 }
 function translate(){
  const nav=$('#v53-nav');if(!nav)return;
  const chosen=lang();
  for(const def of definitions){
   const group=nav.querySelector('.v55-nav-group[data-v55-group="'+def.id+'"]');
   if(!group)continue;
   const title=$('.v55-group-title',group);
   if(title)title.textContent=def[chosen];
   for(const [stage,screen,ar,en] of def.screens){
    const button=group.querySelector('.v55-nav-items > button[data-stage="'+stage+'"]');
    if(!button)continue;
    button.textContent=chosen==='ar'?ar:en;
    button.dataset.pfmV732Screen=screen;
    button.dataset.noTranslate='1';
   }
  }
 }
 function inspect(){
  const nav=$('#v53-nav');
  if(!nav)return {valid:false,reason:'nav missing'};
  const actual=[];
  for(const el of nav.querySelectorAll(':scope > .v55-nav-group')){
   if(!['project','nutrition','daily','finance'].includes(el.dataset.v55Group))continue;
   actual.push({id:el.dataset.v55Group,stages:[...el.querySelectorAll('.v55-nav-items > button[data-stage]')].map(b=>b.dataset.stage)});
  }
  const valid=definitions.every((def,index)=>actual[index]?.id===def.id &&
   actual[index]?.stages.join(',')===def.screens.map(x=>x[0]).join(',')) && actual.length===definitions.length;
  const mark=$('#v53-nav .pfm-v732-mark');
  return {valid:valid && !!mark && mark.textContent==='M.K™',groups:actual,brand:mark?.textContent||null,version:'7.3.2'};
 }
 function boot(){
  document.documentElement.classList.add('pfm72-android-native');
  // Sidebar brand is inserted by the legacy startup script on DOMContentLoaded.
  // A few bounded retries cover variable Android WebView script-load ordering.
  if(repair())return;
  for(const delay of [100,400,1200]){
   window.setTimeout(()=>{if(!inspect().valid)repair();},delay);
  }
 }
 const observer=new MutationObserver(changes=>{
  if(changes.some(e=>e.attributeName==='lang'))translate();
 });
 observer.observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 window.PFMAndroidNavigationV732={repair,inspect,translate};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})();