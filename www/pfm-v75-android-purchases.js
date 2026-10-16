/* Android only: approved unified Purchases > Expenses / Stock.
   Uses the existing V4.10 purchase, issue and financial ledgers; no shadow charges. */
(function(){
'use strict';
if(!window.Capacitor?.isNativePlatform?.()||window.Capacitor.getPlatform?.()!=='android')return;
const $=id=>document.getElementById(id);
const core=()=>window.PFM74PurchaseCore;
const dbNow=()=>typeof db==='undefined'?null:db;
const numbered=c=>typeof cycleOrdinal==='function'?Number(cycleOrdinal(c)):Number(c.cycleNumber||1);
const money=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
const option=(value,label)=>{const o=document.createElement('option');o.value=String(value);o.textContent=String(label);return o};
const field=(label,id,type='text',defaultValue='')=>'<label class="pfm75-field"><span>'+label+'</span><input id="'+id+'" type="'+type+'" value="'+defaultValue+'"/></label>';
let ready=false,tab='expenses';
function alertError(t){window.alert(t)}
function html(){
 const inv=$('inventory');if(!inv||!$('v410-lot-panel')||!$('v52-chick-root')||!$('v52-detailed-root')||!core())return false;
 const n=inv.querySelector(':scope > h2');if(n){n.textContent='المشتريات';n.dataset.v410Ar='المشتريات';n.dataset.v410En='Purchases';}
 const nav=document.querySelector('#v53-nav button[onclick*="inventory"]');if(nav){nav.textContent='المشتريات';nav.title='المشتريات — المصروفات والمخزون';}
 const originals=[...inv.children].filter(x=>x.classList?.contains('panel')&&x.id!=='v410-lot-panel');
 const host=document.createElement('section');host.id='pfm75-purchases';
 host.innerHTML='<div class="pfm75-top panel"><h3>المشتريات — الدورة والمزرعة</h3><div class="pfm75-grid"><label>الدورة <select id="pfm75-cycle"></select></label><label>المزرعة <select id="pfm75-farm"></select></label></div><p class="muted">تسجيل الفاتورة مرة واحدة؛ التكلفة تُربط بعنبرها عند الاستهلاك أو استقبال الكتاكيت.</p></div>'+
 '<div class="pfm75-tabs"><button type="button" data-pfm75-tab="expenses">المصروفات</button><button type="button" data-pfm75-tab="stock">المخزون</button></div>'+
 '<div id="pfm75-expenses"><div class="panel"><h3>شراء الكتاكيت واستقبالها — فاتورة واحدة للمزرعة</h3>'+
 '<div class="pfm75-grid">'+field('رقم الفاتورة *','pfm75-chick-invoice')+field('المورد','pfm75-chick-supplier')+
 field('تاريخ الاستلام','pfm75-chick-date','date')+field('عدد الكتاكيت المجانية','pfm75-chick-free','number','0')+
 '<label>التسعير<select id="pfm75-chick-pricing"><option value="invoice">إجمالي الفاتورة</option><option value="unit">سعر الكتكوت المدفوع</option></select></label>'+
 field('إجمالي الفاتورة أو سعر الوحدة *','pfm75-chick-amount','number')+
 '<label>السعر<select id="pfm75-chick-vatmode"><option value="excluded">غير شامل الضريبة</option><option value="included">شامل الضريبة</option></select></label>'+
 field('ضريبة المشتريات %','pfm75-chick-rate','number','15')+field('ضريبة قابلة للاسترداد %','pfm75-chick-reclaim','number','100')+
 field('خصم الفاتورة','pfm75-chick-discount','number','0')+field('تكلفة نقل إضافية','pfm75-chick-freight','number','0')+
 '</div><p class="muted" id="pfm75-chick-preview"></p><div class="actions"><button type="button" class="btn primary" id="pfm75-chick-save">تسجيل الفاتورة وتوزيع التكلفة على العنابر</button></div></div>'+
 '<div id="pfm75-lots-form"></div><div id="pfm75-cycle-expenses"></div></div>'+
 '<div id="pfm75-stock"><div id="pfm75-stock-lots"></div><div id="pfm75-stock-old"></div></div>';
 inv.querySelector(':scope > h2')?.after(host);
 const lots=$('v410-lot-panel'),table=lots.querySelector(':scope > .v410-table-scroll'),issue=lots.querySelector(':scope > .panel');
 if(table)$('pfm75-stock-lots').appendChild(table);
 if(issue)$('pfm75-stock-lots').appendChild(issue);
 $('pfm75-lots-form').appendChild(lots);
 for(const p of originals)$('pfm75-stock-old').appendChild(p);
 // Move the actual bound V4.10 forms, not clones, to preserve all listeners/calculations.
 for(const id of ['v52-chick-root','v52-detailed-root']){
   const wrapper=$(id)?.querySelector('details');
   if(wrapper){wrapper.open=false;$('pfm75-cycle-expenses').appendChild(wrapper);}
 }
 const label=document.createElement('label');
 label.className='pfm75-field';
 label.innerHTML='<span>طريقة إدخال قيمة مشتريات المخزون</span><select id="pfm75-lot-price-mode"><option value="total">إجمالي الفاتورة</option><option value="unit">سعر الوحدة</option></select>';
 const grid=lots.querySelector(':scope > .v410-grid');
 if(grid)grid.prepend(label);
 const saveLot=$('v410CreateLot');
 saveLot?.addEventListener('click',()=>{
  const mode=$('pfm75-lot-price-mode')?.value;
  if(mode==='unit'){const qty=Number($('v410LotQty').value),unit=Number($('v410LotAmount').value);if(qty>0&&unit>0)$('v410LotAmount').value=String(money(qty*unit));}
 },true);
 const priceInput=$('v410LotAmount');
 if(priceInput)priceInput.closest('label')?.querySelector('span')?.append(' (إجمالي أو سعر الوحدة حسب الاختيار)');
 host.querySelectorAll('[data-pfm75-tab]').forEach(b=>b.addEventListener('click',()=>selectTab(b.dataset.pfm75Tab)));
 $('pfm75-farm').addEventListener('change',()=>refresh(true));
 $('pfm75-cycle').addEventListener('change',()=>refresh(false));
 $('pfm75-chick-save').addEventListener('click',saveChicksInvoice);
 // The top global strip remains the report/search filter; recording selectors
 // choose one farm/cycle when 'all' is selected for reports.
 $('pfm57Toolbar-inventory')?.addEventListener('change',e=>{
   if(['cycle','farm'].includes(e.target?.dataset?.pfm57Role))setTimeout(()=>refresh(true),0);
 });
 for(const id of ['pfm75-chick-free','pfm75-chick-pricing','pfm75-chick-amount','pfm75-chick-rate','pfm75-chick-reclaim','pfm75-chick-discount','pfm75-chick-freight','pfm75-chick-vatmode'])
  $(id)?.addEventListener('input',preview);
 document.addEventListener('click',guardIssues,true);
 const css=document.createElement('style');css.id='pfm75-style';css.textContent=[
 'html.pfm72-android-native #inventory #pfm75-purchases{display:block!important}',
 'html.pfm72-android-native #inventory .pfm57-field:has([data-pfm57-role="house"]){display:none!important}',
 'html.pfm72-android-native .pfm75-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
 'html.pfm72-android-native .pfm75-grid label,html.pfm72-android-native .pfm75-field{display:flex;flex-direction:column;gap:5px;min-width:0;font-size:12px;font-weight:600}',
 'html.pfm72-android-native .pfm75-grid input,html.pfm72-android-native .pfm75-grid select,html.pfm72-android-native .pfm75-field select{max-width:100%;width:100%;min-width:0;min-height:42px;border:1px solid #b9d0e0;border-radius:8px;background:white;padding:7px;font:inherit}',
 'html.pfm72-android-native .pfm75-tabs{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:12px 0}',
 'html.pfm72-android-native .pfm75-tabs button{padding:12px 6px;border-radius:10px;border:1px solid #9bb8c9;background:#eef5fa;color:#234b66;font-weight:700}',
 'html.pfm72-android-native .pfm75-tabs button[aria-selected="true"]{background:#205e83;color:white}',
 'html.pfm72-android-native #pfm75-expenses[hidden],html.pfm72-android-native #pfm75-stock[hidden]{display:none!important}',
 'html.pfm72-android-native #pfm75-purchases .v410-panel{max-width:100%;min-width:0}',
 'html.pfm72-android-native #pfm75-purchases .v410-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}',
 'html.pfm72-android-native #pfm75-purchases details{display:block;margin:12px 0}',
 '@media(max-width:410px){html.pfm72-android-native .pfm75-grid,html.pfm72-android-native #pfm75-purchases .v410-grid{grid-template-columns:1fr}}'
 ].join('\n');document.head.appendChild(css);
 $('pfm75-chick-date').value=new Date().toISOString().slice(0,10);
 inv.addEventListener('click',()=>{if($('inventory')?.classList.contains('active'))setTimeout(refreshStock,0)});
 selectTab('expenses');refresh(true);return true;
}
function cycleGroup(){const d=dbNow(),f=$('pfm75-farm')?.value,num=Number($('pfm75-cycle')?.value);return (!f||!num||!d)?[]:core().cycleGroup(d.cycles,f,num,numbered);}
function refresh(fromFarm){
 const d=dbNow();if(!d)return;
 const farm=$('pfm75-farm'),cy=$('pfm75-cycle'),oldFarm=farm.value,oldCycle=cy.value;
 farm.replaceChildren();
 for(const f of d.farms)farm.add(option(f.id,f.name));
 const globalFarm=$('pfm57Toolbar-inventory')?.querySelector('[data-pfm57-role="farm"]')?.value;
 const selectedFarm=!fromFarm&&oldFarm?oldFarm:(globalFarm||oldFarm);
 if(d.farms.some(f=>f.id===selectedFarm))farm.value=selectedFarm;
 const numbers=[...new Set(d.cycles.filter(c=>c.farmId===farm.value).map(numbered))].filter(x=>x>0).sort((a,b)=>a-b);
 cy.replaceChildren();for(const n of numbers)cy.add(option(n,'الدورة '+n));
 const globalCycle=$('pfm57Toolbar-inventory')?.querySelector('[data-pfm57-role="cycle"]')?.value;
 if(numbers.some(n=>String(n)===(fromFarm?globalCycle:oldCycle)))cy.value=String(fromFarm?globalCycle:oldCycle);
 const lotFarm=$('v410LotFarm');if(lotFarm&&[...lotFarm.options].some(o=>o.value===farm.value))lotFarm.value=farm.value;
 const cycle=cycleGroup()[0];
 if(cycle){const fa=$('finFarm'),ho=$('finHouse'),ci=$('finCycle');
  if(fa&&[...fa.options].some(o=>o.value===cycle.farmId)){fa.value=cycle.farmId;if(typeof fillFinanceHouse==='function')fillFinanceHouse(false);}
  if(ho&&[...ho.options].some(o=>o.value===cycle.houseId)){ho.value=cycle.houseId;if(typeof fillFinanceCycle==='function')fillFinanceCycle(false);}
  if(ci&&[...ci.options].some(o=>o.value===cycle.id)){ci.value=cycle.id;if(typeof renderFinance==='function')renderFinance();}
 }
 preview();refreshStock();
}
function refreshStock(){if(typeof window.PFM_V410?.refresh==='function'&&$('inventory')?.classList.contains('active'))try{window.PFM_V410.refresh()}catch(e){console.warn('Inventory refresh:',e)}}
function selectTab(next){tab=next;for(const key of ['expenses','stock']){const div=$('pfm75-'+key);if(div)div.hidden=key!==next;const btn=document.querySelector('[data-pfm75-tab="'+key+'"]');if(btn)btn.setAttribute('aria-selected',String(key===next));}refreshStock();}
function chickQuote(){
 const cycles=cycleGroup();if(!cycles.length)throw Error('اختر دورة ومزرعة بها عنابر مسجلة.');
 const total=cycles.reduce((n,c)=>n+Number(c.birds||0),0),free=Number($('pfm75-chick-free').value||0);
 const price=Number($('pfm75-chick-amount').value),discount=Number($('pfm75-chick-discount').value||0),freight=Number($('pfm75-chick-freight').value||0);
 if(!Number.isInteger(total)||!Number.isInteger(free)||total<=0||free<0||free>=total)throw Error('أعداد الكتاكيت غير متطابقة.');
 const billed=total-free,amount=$('pfm75-chick-pricing').value==='unit'?money(price*billed):price;
 if(!(amount>0)||discount<0||discount>=amount||freight<0)throw Error('راجع السعر والخصم وتكلفة النقل.');
 const rate=Number($('pfm75-chick-rate').value),reclaim=Number($('pfm75-chick-reclaim').value),mode=$('pfm75-chick-vatmode').value;
 const cost=core().price({quantity:billed,unit:'bird',amount:money(amount-discount),vatRate:rate,reclaimPercent:reclaim,mode});
 return {cycles,total,billed,free,amount:money(amount),discount,freight,vat:cost,cost:money(cost.accountingCost+freight),rate,reclaim,mode};
}
function preview(){const el=$('pfm75-chick-preview');if(!el)return;try{const q=chickQuote();el.textContent='عدد الكتاكيت: '+q.total+' | تكلفة الفاتورة المحاسبية: '+q.cost.toFixed(2)+' | عدد العنابر: '+q.cycles.length;}catch(e){el.textContent=e.message;}}
function integerSplit(value,cycles){
 let allocated=0;const total=cycles.reduce((a,c)=>a+Number(c.birds||0),0);
 return cycles.map((c,i)=>{const x=i===cycles.length-1?value-allocated:Math.floor(value*Number(c.birds||0)/total);allocated+=x;return x});
}
function saveChicksInvoice(){
 try{
  const d=dbNow(),q=chickQuote(),farm=$('pfm75-farm').value,number=Number($('pfm75-cycle').value),no=$('pfm75-chick-invoice').value.trim();
  if(!no)throw Error('أدخل رقم الفاتورة.');
  if(typeof currentUser==='undefined'||!currentUser||typeof can!=='function'||!can('finance',farm))throw Error('ليس لديك صلاحية تسجيل المشتريات.');
  const ledger=d.v410||{};const previous=ledger.purchaseInvoices||[];
  if(previous.some(x=>x.farmId===farm&&x.invoice===no))throw Error('هذه الفاتورة مسجلة بالفعل، لن يتم تكرارها.');
  for(const c of q.cycles)if(ledger.close?.[c.id]?.status==='closed'||ledger.chicks?.[c.id]||Number(d.finance?.[c.id]?.chicks||0)>0)
   throw Error('يوجد عنبر بدورة مغلقة أو تكلفة كتاكيت مسجلة سابقًا؛ لم يتم تعديل أي بيانات.');
  const prices=core().shares(q.cost,q.cycles,c=>c.birds);
  const net=core().shares(q.vat.net,q.cycles,c=>c.birds),tax=core().shares(q.vat.tax,q.cycles,c=>c.birds),gross=core().shares(q.vat.gross,q.cycles,c=>c.birds),rec=core().shares(q.vat.recoverable,q.cycles,c=>c.birds);
  const discount=core().shares(q.discount,q.cycles,c=>c.birds),freight=core().shares(q.freight,q.cycles,c=>c.birds),amount=core().shares(q.amount,q.cycles,c=>c.birds);
  const frees=integerSplit(q.free,q.cycles),now=new Date().toISOString();
  const purchases=previous.slice(),chicks={...(ledger.chicks||{})},finance={...(d.finance||{})};
  const allocated=[];
  for(let i=0;i<q.cycles.length;i++){
    const c=q.cycles[i],item={
      mode:'invoice',billed:Number(c.birds)-frees[i],free:frees[i],unitPrice:null,invoiceAmount:amount[i].amount,
      discount:discount[i].amount,freight:freight[i].amount,
      vat:{net:net[i].amount,tax:tax[i].amount,gross:gross[i].amount,recoverable:rec[i].amount,
        nonRecoverable:money(tax[i].amount-rec[i].amount),accountingCost:money(gross[i].amount-rec[i].amount),
        mode:q.mode,rate:q.rate,reclaim:q.reclaim},
      cost:prices[i].amount,invoiceNo:no,supplier:$('pfm75-chick-supplier').value.trim(),
      date:$('pfm75-chick-date').value,createdAt:now
    };
    chicks[c.id]=item;finance[c.id]={...(finance[c.id]||{}),chicks:item.cost};
    allocated.push({cycleId:c.id,houseId:c.houseId,birds:c.birds,cost:item.cost});
  }
  purchases.push({id:'pfm75-'+now+'-'+Math.random().toString(36).slice(2,8),farmId:farm,cycleNumber:number,invoice:no,
    supplier:$('pfm75-chick-supplier').value.trim(),date:$('pfm75-chick-date').value,
    amount:q.amount,discount:q.discount,freight:q.freight,vat:q.vat,cost:q.cost,birds:q.total,allocations:allocated,createdAt:now});
  // Atomic in-memory stage; the existing financial engine reads the same finance.chicks fields.
  const oldFinance=d.finance,oldChicks=ledger.chicks,oldInvoices=ledger.purchaseInvoices;
  try{
    ledger.chicks=chicks;ledger.purchaseInvoices=purchases;d.v410=ledger;d.finance=finance;
    if(typeof save!=='function')throw Error('Storage is unavailable');
    save();
  }catch(error){d.finance=oldFinance;ledger.chicks=oldChicks;ledger.purchaseInvoices=oldInvoices;throw error}
  if(typeof renderAll==='function')renderAll();
  alert('تم تسجيل فاتورة الكتاكيت مرة واحدة وتوزيع تكلفتها على '+q.cycles.length+' عنبر.');
 }catch(e){alertError('تعذر تسجيل الكتاكيت: '+e.message);}
}
function guardIssues(event){
 const t=event.target?.closest?.('#feedSaveBtn,#medSaveBtn,#v410IssueExpense');
 if(!t)return;
 const key=t.id==='feedSaveBtn'?'feed':t.id==='medSaveBtn'?'med':'expense';
 const id=key==='feed'?$('v410FeedLot')?.value:key==='med'?$('v410MedLot')?.value:$('v410IssueLot')?.value;
 if(!id)return;
 const lot=dbNow()?.v410?.lots?.find(l=>l.id===id);if(!lot?.linkedCycleIds?.length)return;
 const cycleId=key==='feed'?$('feedCycle')?.value:key==='med'?$('medCycle')?.value:$('v410IssueCycle')?.value;
 if(lot.linkedCycleIds.includes(cycleId))return;
 event.preventDefault();event.stopImmediatePropagation();alertError('هذه الدفعة مرتبطة بدورة أخرى. اختر الدفعة الصحيحة.');
}
function connectLotToCycle(){
 const button=$('v410CreateLot');if(!button)return;
 let before=null;
 button.addEventListener('pointerdown',()=>{before=new Set((dbNow()?.v410?.lots||[]).map(x=>x.id))},true);
 button.addEventListener('click',()=>{const f=$('pfm75-farm')?.value,group=cycleGroup();if(!f||!group.length||!before)return;
  const ledger=dbNow()?.v410,created=(ledger?.lots||[]).find(l=>l.farmId===f&&!before.has(l.id));
  if(created){created.linkedCycleIds=group.map(c=>c.id);created.cycleNumber=Number($('pfm75-cycle').value);if(typeof save==='function')save();}
  before=null;
 },false);
}
const iv=setInterval(()=>{if(ready){clearInterval(iv);return}try{ready=html();if(ready){clearInterval(iv);connectLotToCycle();}}catch(e){console.warn('PFM purchases initialization',e);clearInterval(iv)}},350);
})();