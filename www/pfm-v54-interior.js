/* V5.4 route guard: fixes V5.3 dashboard-on-all-pages leakage.
   Does not modify the original show(), authentication or finance logic. */
(function () {
  'use strict';
  function syncViewState() {
    var body=document.body;
    if(!body) return;
    var dash=document.getElementById('dash');
    var showingDash=!!(dash&&dash.classList.contains('active'));
    var anyInner=!!document.querySelector('main > section.view.active:not(#dash)');
    body.classList.toggle('pfm54-inner',anyInner&&!showingDash);
    body.classList.toggle('pfm54-home',showingDash);
    if(showingDash && dash) {
      dash.removeAttribute('aria-hidden');
    } else if(dash) {
      dash.setAttribute('aria-hidden','true');
    }
  }
  function begin() {
    var main=document.querySelector('main');
    if(!main) return;
    syncViewState();
    var observer=new MutationObserver(function(records){
      if(records.some(function(r){return r.attributeName==='class' && r.target.matches('section.view');})) syncViewState();
    });
    main.querySelectorAll(':scope > section.view').forEach(function(el){observer.observe(el,{attributes:true,attributeFilter:['class']});});
    document.addEventListener('click',function(event){
      if(event.target.closest('#v53-nav')) queueMicrotask(syncViewState);
    });
    window.addEventListener('pageshow',syncViewState);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',begin);else begin();
})();
