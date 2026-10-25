/* PFM V8 experimental: single farm purchase and issue workspace.
 * Presentation-only consolidation. Keep original V4.10 inventory movement,
 * V8 purchase invoice, operating feed/medication records and audit data.
 * The approved accounting engine is the only writer of inventory/cycle cost.
 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const tr=(ar,en)=>document.documentElement.lang==='en'?en:ar;
 const allowed=[
  {key:'feed',ar:'الأعلاف',en:'Feed purchases',note:'بادي / نامي / ناهي — يضاف إلى مخزون المزرعة مرة واحدة.',enNote:'Starter / grower / finisher; farm stock received only once.',types:['feed']},
  {key:'chicks',ar:'الصيصان',en:'Chick purchases',note:'توزيع تكلفة الصيصان على دورات وعنابر الاستقبال بدون تكرار.',enNote:'Distribute chick invoice cost to reception cycles once.',types:['chicks']},
  {key:'health',ar:'الأدوية والتحصينات',en:'Health purchases',note:'أدوية وتحـصينات ومطهرات ونشارة — رصيد مخزون قبل الصرف.',enNote:'Medicine, vaccines, disinfectants and bedding, initially in stock.',types:['med','vaccine','disinfectant','bedding']},
  {key:'expense',ar:'المصروفات الداخلية والنثرية',en:'Operating and petty expenses',note:'عمال ومياه وكهرباء وديزل وإيجار ونقل وتحميل ومعدات ومصاريف أخرى.',enNote:'Labor, utilities, diesel, rent, transport, equipment and sundries.',types:['rent','diesel','electricity','water','labor','transport','loading','equipment_rent','other']}
 ];
 let installed=false,settingScope=false;
 function synchronize(){
  if(settingScope)return;
  settingScope=true;
  try{
   const farm=$('pfm-v8-farm')?.value||'';
   for(const kind of ['feed','med']){
    const sel=$(kind==='feed'?'feedFarmFilter':'medFarmFilter');
    if(sel&&[...sel.options].some(o=>o.value===farm)){
      sel.value=farm;
      if(kind==='feed'&&typeof updateFeedScope==='function')updateFeedScope(true);
      if(kind==='med'&&typeof updateMedScope==='function')updateMedScope(true);
    }
   }
   const ledgerFarm=$('v410LotFarm');
   if(ledgerFarm&&[...ledgerFarm.options].some(o=>o.value===farm))ledgerFarm.value=farm;
   // Refresh V4.10 lot options from existing purchased batches.
   window.PFM_V410?.refresh?.();
  }finally{settingScope=false;}
 }
 function visibleOnlyStockIssue(evt){
  const target=evt.target?.closest?.('#feedSaveBtn,#medSaveBtn');
  if(!target||!window.PFMV8SingleEntryActive)return;
  const feed=target.id==='feedSaveBtn';
  const cycle=$(feed?'feedCycle':'medCycle');
  const lot=$(feed?'v410FeedLot':'v410MedLot');
  const selected=[...(cycle?.selectedOptions||[])].filter(x=>x.value).map(x=>x.value);
  const selectedCycle=selected.length===1?db.cycles.find(x=>x.id===selected[0]):null;
  const selectedLot=(db.v410?.lots||[]).find(x=>x.id===lot?.value);
  const farm=$('pfm-v8-farm')?.value;
  if(selectedCycle&&selectedCycle.farmId===farm&&selectedLot&&selectedLot.farmId===farm)return;
  evt.preventDefault();evt.stopImmediatePropagation();
  alert(tr('لازم تختار عنبر/دورة واحدة ودفعة مشتراة من نفس المزرعة. الأسعار والفواتير تتسجل في الأعلى فقط؛ الصرف هنا بالكميات.', 'Select one cycle/house and an existing purchased lot in the same farm. Purchase values belong only in the invoice above.'));
 }
 function mountIssue(viewId,ar,en){
  const view=$(viewId);
  if(!view)return;
  const container=document.createElement('details');
  container.className='pfm-v8-issue-section';
  container.innerHTML='<summary>'+tr(ar,en)+'</summary>'+
   '<p class="muted">'+tr('الصرف بالكميات فقط من دفعة مشتراة. يتم خصم المخزون واحتساب تكلفة الدورة آليًا، من غير تسجيل فاتورة أو سعر هنا.','Issue quantities from a purchased lot only. Stock and cycle expense are updated automatically, with no extra invoice or price entry.')+'</p>';
  for(const panel of [...view.children].filter(x=>x.classList?.contains('panel')))container.appendChild(panel);
  const form=container.querySelector('.scope-form-grid');
  if(form){
   const price=viewId==='feed'?'feedPrice':'medCost';
   const priceField=$(price)?.closest('.field');
   if(priceField)priceField.style.display='none';
   const vatFields=form.querySelectorAll('.v410-direct-tax');
   vatFields.forEach(x=>x.style.display='none');
   const itemField=$(viewId==='feed'?'feedType':'medName')?.closest('.field');
   if(itemField)itemField.style.display='none';
   const lot=$(viewId==='feed'?'v410FeedLot':'v410MedLot');
   if(lot){const label=lot.closest('.field,.v410-field');const span=label?.querySelector('span');if(span)span.textContent=tr('اختر دفعة المخزون *','Select stock lot *');}
  }
  const addBtn=$(viewId==='feed'?'feedSaveBtn':'medSaveBtn');
  if(addBtn)addBtn.textContent=tr('صرف الكمية للعنبر','Issue to house');
  $('pfm-v8-issues').appendChild(container);
 }
 function groupInvoice(){
  const invoice=$('pfm-v8-invoice'),host=$('pfm-v8-lines'),globalAdd=$('pfm-v8-add');
  if(!invoice||!host||!globalAdd)return;
  // The single blank initial row is only a starter; no data was persisted.
  host.querySelectorAll('.pfm-v8-line').forEach(x=>x.remove());
  for(const spec of allowed){
   const section=document.createElement('section');
   section.className='pfm-v8-group';
   section.dataset.pfmV8Group=spec.key;
   const h=document.createElement('h4');h.textContent=tr(spec.ar,spec.en);
   const hint=document.createElement('p');hint.className='muted';hint.textContent=tr(spec.note,spec.enNote);
   const content=document.createElement('div');content.className='pfm-v8-group-lines';
   const add=document.createElement('button');add.type='button';add.className='btn';add.textContent=tr('إضافة بند','Add item');
   add.addEventListener('click',()=>{
    if(host.querySelectorAll('.pfm-v8-line').length>=60)return alert(tr('الحد الأقصى 60 بندًا في الفاتورة.','Maximum 60 invoice lines.'));
    globalAdd.click();
    const row=host.querySelector(':scope > .pfm-v8-line');
    if(!row)return;
    const select=row.querySelector('[data-k="kind"]');
    [...select.options].forEach(opt=>{if(!spec.types.includes(opt.value))opt.remove();});
    select.value=spec.types[0];
    select.dispatchEvent(new Event('change',{bubbles:true}));
    content.appendChild(row);
   });
   section.append(h,hint,content,add);
   host.appendChild(section);
  }
  globalAdd.hidden=true;globalAdd.style.display='none';
  const wrapper=document.createElement('div');wrapper.id='pfm-v8-issues';wrapper.className='pfm-v8-issue-workflow';
  wrapper.innerHTML='<h3>'+tr('المخزون والصرف إلى العنابر','Inventory and house issue')+'</h3>'+
   '<p class="muted">'+tr('بعد حفظ الفاتورة، اختر الصنف والدفعة وصرف الكمية للعنبر من هنا، بنفس الصفحة. تكلفة الدورة تُحسب وقت الصرف فقط.','After saving the invoice, select the purchased lot and issue a quantity to the house here on the same page. Cycle cost is charged only on issue.')+'</p>';
  invoice.after(wrapper);
  mountIssue('feed','صرف واستهلاك الأعلاف','Feed issue and consumption');
  // Medicines and vaccination technical records stay in Daily Monitoring;
  // the unified purchase invoice remains the only purchase cost writer.
  const ledger=$('pfm75-stock-lots');
  if(ledger){
   const d=document.createElement('details');d.className='pfm-v8-issue-section';
   d.innerHTML='<summary>'+tr('أرصدة دفعات المشتريات والمرتجعات','Purchase-lot balances and returns')+'</summary>';
   for(const node of [...ledger.children])if(node.id!=='pfm75-house-consumption')d.appendChild(node);
   wrapper.appendChild(d);
   const redundant=$('pfm75-house-consumption');if(redundant)redundant.hidden=true;
  }
  const stockSection=$('pfm75-stock'),tabs=document.querySelector('.pfm75-tabs');
  if(tabs)tabs.style.display='none';
  if(stockSection)stockSection.hidden=true;
  const expenseSection=$('pfm75-expenses');if(expenseSection)expenseSection.hidden=false;
  const note=document.createElement('style');note.id='pfm-v8-onepage-style';
  note.textContent=[
    '#pfm-v8-lines{display:flex;flex-direction:column;gap:12px}',
    '#pfm-v8-lines .pfm-v8-group{background:#f9fcff;border:1px solid #c8dcea;border-radius:10px;padding:12px}',
    '#pfm-v8-lines .pfm-v8-group h4{margin:0;font-size:15px;color:#17416e}',
    '#pfm-v8-lines .pfm-v8-group .muted{margin:5px 0 10px}',
    '#pfm-v8-issues{margin-top:16px}',
    '#pfm-v8-issues .pfm-v8-issue-section{border:1px solid #c8dcea;border-radius:9px;padding:12px;margin:10px 0;background:#fff}',
    '#pfm-v8-issues summary{cursor:pointer;font-size:15px;font-weight:700}',
    '#pfm-v8-issues .panel{margin-top:12px}',
    '#v53-nav button[data-stage="7"]{display:none!important}',
    '#pfm-v8-issues .v410-direct-tax{display:none!important}',
    '#pfm75-house-consumption{display:none!important}',
    '#pfm-v8-issues .v410-lot-choice{display:block!important}'
  ].join('\n');
  document.head.appendChild(note);
 }
 function nav(){
  // Keep the original IDs and operating data intact, but route every old
  // Feed / Medication shortcut back to the one purchasing workspace.
  if(typeof show==='function'&&!show.__pfmV81Menu){
   const old=show;
   const route=function(page,button){
    // The old Feed purchase form was a duplicate writer and must not reopen;
    // technical medications stay under Daily Monitoring.
    if(page==='feed')page='inventory';
    return old.call(this,page,button);
   };
   route.__pfmV81Menu=true;show=route;
  }
  const update=()=>{
   const button=document.querySelector('#v53-nav button[data-stage="9"]');
   if(button){button.textContent=tr('المشتريات والمخزون','Purchases & Inventory');button.dataset.noTranslate='1';}
  };
  update();new MutationObserver(update).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 }
 function install(){
  if(installed||!window.PFMV8SingleEntryActive||!$('pfm-v8-invoice')||!$('v410FeedLot')||!$('v410MedLot'))return false;
  groupInvoice();
  nav();
  const farm=$('pfm-v8-farm');
  farm?.addEventListener('change',synchronize);
  document.addEventListener('click',visibleOnlyStockIssue,true);
  const inventory=$('inventory');
  if(inventory){
   new MutationObserver(()=>{if(inventory.classList.contains('active'))synchronize();}).observe(inventory,{attributes:true,attributeFilter:['class']});
  }
  synchronize();installed=true;window.PFMV8OnePagePurchases=true;
  return true;
 }
 let n=0;
 const timer=setInterval(()=>{try{if(install()||++n>100)clearInterval(timer);}catch(e){console.error('V8 one-page workspace:',e);clearInterval(timer);}},250);
})();
