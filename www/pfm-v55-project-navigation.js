/* V5.5 — no financial data changes. Only expanded/collapsed stage-group state. */
(function(){
'use strict';
const nav=()=>document.getElementById('v53-nav');
function applyLanguage(){
 const en=document.documentElement.lang==='en';
 nav()?.querySelectorAll('.v55-group-title').forEach(el=>{
   const label=en?el.dataset.v55En:el.dataset.v55Ar;
   if(label && el.textContent!==label)el.textContent=label;
 });
}
function expandForActive(){
 const el=nav()?.querySelector('.v55-nav-items button[data-stage].active');
 const group=el?.closest('.v55-nav-group');
 if(group && !group.classList.contains('v55-expanded')){
   group.classList.add('v55-expanded');
   const header=group.querySelector('.v55-group-head');
   if(header)header.setAttribute('aria-expanded','true');
 }
}
window.PFM_V55={
 toggle(header){const group=header?.closest('.v55-nav-group');if(!group)return;
   const expanded=group.classList.toggle('v55-expanded');header.setAttribute('aria-expanded',String(expanded));
 },applyLanguage,expandForActive
};
function init(){const n=nav();if(!n)return;
 applyLanguage();expandForActive();
 new MutationObserver(()=>applyLanguage()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 n.addEventListener('click',e=>{if(e.target.closest('button[data-stage]'))queueMicrotask(expandForActive)});
 const old=window.setLanguage;
 if(typeof old==='function'&&!old.__pfm55){
   function patched(){const r=old.apply(this,arguments);applyLanguage();return r;}
   patched.__pfm55=true;window.setLanguage=patched;
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
