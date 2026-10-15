/* V6.5 native shell UX: no database mutations; standards preview is readable by staff. */
(function(){'use strict';
function standardsAccess(){
 const root=document.getElementById('standards');if(!root)return;
 const allowed=typeof can==='function'&&can('settings');
 const def=root.querySelector('#globalStandardBreed');if(def)def.disabled=!allowed;
 const custom=root.querySelector('#performanceRuleTable')?.closest('.panel');
 if(custom){custom.querySelectorAll('input,button,select').forEach(el=>{el.disabled=!allowed;});}
 root.classList.toggle('pfm65-readonly',!allowed);
}
window.PFM65StandardsAccess=standardsAccess;
function install(){
 if(document.getElementById('pfm65Menu'))return;
 const btn=document.createElement('button');btn.id='pfm65Menu';btn.type='button';btn.setAttribute('aria-label','فتح قائمة البرنامج');
 btn.setAttribute('aria-expanded','false');btn.textContent='☰';
 const veil=document.createElement('button');veil.id='pfm65Veil';veil.type='button';veil.setAttribute('aria-label','إغلاق القائمة');
 document.body.append(btn,veil);
 const close=()=>{document.body.classList.remove('pfm65-menu-open');btn.setAttribute('aria-expanded','false');};
 btn.addEventListener('click',()=>{const open=document.body.classList.toggle('pfm65-menu-open');btn.setAttribute('aria-expanded',String(open));});
 veil.addEventListener('click',close);
 document.getElementById('v53-nav')?.addEventListener('click',event=>{if(event.target.closest('button[data-stage]'))close();});
 addEventListener('resize',()=>{if(innerWidth>800)close();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
