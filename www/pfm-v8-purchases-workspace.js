/* V8 consolidated farm purchases workspace.
   UI-only organization; purchased lots and actual cycle-cost records continue to
   use the approved V4.10 ledger. Never modify or delete historical transactions. */
(function(){'use strict';
const $=id=>document.getElementById(id);
const en=()=>document.documentElement.lang==='en';
const tr=(ar,english)=>en()?english:ar;
const money=v=>Math.round((Number(v)+Number.EPSILON)*100)/100;
const categories=[
 ['feed','الأعلاف','Feed','feed','أضف بادي أو نامي أو ناهي؛ فاتورة واحدة لكل مورد وتاريخ.','Add starter, grower or finisher feed on one supplier invoice.'],
 ['chicks','الصيصان','Chicks','chicks','تتوزع تكلفة الصيصان على عنابر دورة الاستقبال تلقائيًا.','Chick costs are allocated to reception houses automatically.'],
 ['health','الأدوية والتحصينات والمستلزمات','Medicines, vaccines & supplies','med','المخزون يُسجل عند الشراء، والتكلفة تتحملها الدورة عند الصرف الفعلي.','Stock is received on purchase and charged to the cycle when issued.'],
 ['expenses','المصروفات الداخلية والنثرية','Internal & petty expenses','other','إيجار، ديزل، كهرباء، مياه، عمال، نقل ومصاريف أخرى تخص دورة محددة.','Rent, diesel, electricity, water, labor, transport and other cycle expenses.'],
 ['shared','المصروفات المشتركة','Shared farm costs','shared','فاتورة واحدة مع توزيع على العنابر المستفيدة بالتساوي أو حسب الطيور.','One invoice, allocated across beneficiary houses without duplication.'],
 ['assets','الأصول الثابتة','Fixed assets','asset','قيمة الأصل تحفظ في سجل الأصول؛ يُحمَّل الإهلاك الشهري فقط.','Capital purchases enter the asset register; only depreciation charges cycles.']
];
const categoryKinds={feed:['feed'],chicks:['chicks'],health:['med','vaccine','disinfectant','bedding'],expenses:['rent','diesel','electricity','water','labor','transport','loading','equipment_rent','other'],shared:['shared'],assets:['asset']};
let installed=false,issuing=false,issueEditingId='';
const escapes=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function nativeLang(){
 for(const el of document.querySelectorAll('#pfm-v8-workspace [data-ar][data-en]'))
  el.textContent=el.getAttribute(en()?'data-en':'data-ar');
}
function tag(ar,english){return ' data-ar="'+escapes(ar)+'" data-en="'+escapes(english)+'"';}
function selectedFarm(){return $('pfm-v8-farm')?.value||'';}
function stock(){return window.PFM_V410?.state||db?.v410||{};}
function balance(lot){return typeof window.PFM_V410?.lotBalance==='function'?window.PFM_V410.lotBalance(lot):
 money(Number(lot.qty||0)+(stock().movements||[]).filter(x=>x.lotId===lot.id).reduce((sum,x)=>sum+(x.kind==='return'?Number(x.qty):-Number(x.qty)),0));}
function addLine(group,kind){
 const wrapper=$('pfm-v8-lines'),target=$('pfm-v8-group-'+group);
 if(!wrapper||!target||wrapper.querySelectorAll('.pfm-v8-line').length>=60)return;
 const original=$('pfm-v8-add');
 if(!original)return;
 const before=new Set(wrapper.querySelectorAll('.pfm-v8-line'));
 // Reuse existing approved invoice line builder, validation and save logic.
 original.click();
 const line=[...wrapper.querySelectorAll('.pfm-v8-line')].find(x=>!before.has(x));
 if(!line)return;
 target.appendChild(line);
 const picker=line.querySelector('[data-k="kind"]');
 picker.value=kind||categories.find(x=>x[0]===group)?.[3]||'other';
 picker.dispatchEvent(new Event('change',{bubbles:true}));
 const allowed=new Set(categoryKinds[group]||[]);
 [...picker.options].forEach(option=>{if(!allowed.has(option.value))option.remove()});
 if(group==='feed'||group==='chicks'||group==='shared'||group==='assets')picker.closest('label').hidden=true;
 if(group==='chicks')line.querySelector('[data-k="item"]').value='صيصان';
}
function renderIssueHistory(){
 const body=$('pfm-v8-issue-history');if(!body)return;
 const fid=selectedFarm(),ledger=stock();
 const lotById=id=>(ledger.lots||[]).find(l=>l.id===id);
 const rows=(ledger.movements||[]).filter(m=>m.kind==='issue'&&lotById(m.lotId)?.farmId===fid)
  .slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,100);
 body.innerHTML=rows.map(m=>{
  const l=lotById(m.lotId),c=(db.cycles||[]).find(x=>x.id===m.cycleId);
  return '<tr><td>'+escapes(m.date)+'</td><td>'+escapes(m.operationRef||m.id)+'</td><td>'+escapes(l?.item||'')+'</td><td>'+
   escapes((typeof getHouseName==='function'?getHouseName(c?.houseId):c?.houseId)||'')+'</td><td>'+Number(m.qty).toLocaleString()+'</td><td>'+
   money(m.cost||0).toFixed(2)+'</td><td><button type="button" class="btn" data-pfm-issue-edit="'+escapes(m.id)+'">'+tr('تعديل','Edit')+
   '</button> <button type="button" class="btn danger" data-pfm-issue-delete="'+escapes(m.id)+'">'+tr('حذف','Delete')+'</button></td></tr>';
 }).join('')||'<tr><td colspan="7">'+tr('لا توجد حركات صرف','No issue movements')+'</td></tr>';
}
function resetIssueEdit(){
 issueEditingId='';
 const btn=$('pfm-v8-issue-btn');if(btn)btn.textContent=tr('تسجيل الصرف مرة واحدة','Issue stock once');
 const cancel=$('pfm-v8-issue-cancel');if(cancel)cancel.hidden=true;
}
function editIssue(id){
 const m=(stock().movements||[]).find(x=>x.kind==='issue'&&x.id===id);
 if(!m)return;
 if(!window.PFMV81IssueCorrections)throw Error('Issue correction engine unavailable');
 issueEditingId=id;refreshIssues();
 $('pfm-v8-issue-cycle').value=m.cycleId;
 $('pfm-v8-issue-lot').value=m.lotId;
 $('pfm-v8-issue-qty').value=m.qty;
 $('pfm-v8-issue-date').value=m.date;
 $('pfm-v8-issue-ref').value=m.operationRef||'';
 $('pfm-v8-issue-btn').textContent=tr('حفظ التعديل','Save changes');
 $('pfm-v8-issue-cancel').hidden=false;
 $('pfm-v8-issue-state').textContent=tr('تعديل حركة صرف موجودة؛ لن تنشأ فاتورة أو حركة إضافية.','Correcting one existing issue; no duplicate transaction.');
}
function correctIssue(id,remove){
 if(issuing)return;
 const m=(stock().movements||[]).find(x=>x.kind==='issue'&&x.id===id);
 if(!m)return;
 if(remove&&!confirm(tr('تأكيد حذف حركة الصرف وإرجاع رصيد الدفعة وإلغاء تكلفتها؟','Delete this issue and reverse its stock and cost?')))return;
 issuing=true;
 try{
  const cycle=(db.cycles||[]).find(c=>c.id===m.cycleId);
  if(!cycle||typeof can!=='function'||!can('finance',cycle.farmId))throw Error('Insufficient farm finance permission');
  if(typeof requireActionForRecord==='function'&&!requireActionForRecord(remove?'delete':'edit','finance',cycle.farmId))return;
  const replacement=remove?null:{cycleId:$('pfm-v8-issue-cycle').value,lotId:$('pfm-v8-issue-lot').value,
   qty:Number($('pfm-v8-issue-qty').value),date:$('pfm-v8-issue-date').value,
   operationRef:$('pfm-v8-issue-ref').value};
  const result=window.PFMV81IssueCorrections.revise(db,{id,remove,replacement,
   canFinance:fid=>typeof can==='function'&&can('finance',fid),
   audit:typeof audit==='function'?audit:null,persist:save});
  for(const id of [result.before.cycleId,result.after?.cycleId].filter(Boolean)){
   if(typeof financeDraftExpenses!=='undefined')
    financeDraftExpenses[id]=normalizeFinanceExpenses(db.finance[id]||{});
  }
  resetIssueEdit();
  $('pfm-v8-issue-qty').value='';
  $('pfm-v8-issue-ref').value=uuid();
  $('pfm-v8-issue-state').textContent=tr(remove?'تم حذف حركة الصرف مع عكس المخزون والتكلفة.':'تم تعديل الحركة والمخزون والتكلفة دون تكرار.',
   remove?'Issue deleted; inventory and cycle cost reversed.':'Issue updated without duplicated stock or cost.');
  window.PFM_V410?.refresh?.();refreshIssues();
 }catch(e){
  $('pfm-v8-issue-state').textContent=tr('فشل تصحيح الصرف: ','Issue correction failed: ')+e.message;
 }finally{issuing=false;}
}
function refreshIssues(){
 const fid=selectedFarm(),cycles=(db.cycles||[]).filter(x=>x.farmId===fid);
 const c=$('pfm-v8-issue-cycle'),l=$('pfm-v8-issue-lot');
 if(!c||!l)return;
 const oldCycle=c.value,oldLot=l.value;
 c.innerHTML=cycles.map(x=>'<option value="'+escapes(x.id)+'">'+escapes((typeof getHouseName==='function'?getHouseName(x.houseId):x.houseId)+' · '+(x.cycleNumber||1)+' · '+x.date)+'</option>').join('');
 if(cycles.some(x=>x.id===oldCycle))c.value=oldCycle;
 l.innerHTML=(stock().lots||[]).filter(x=>x.farmId===fid&&['feed','med','vaccine','disinfectant','bedding'].includes(x.kind)&&(balance(x)>0||(stock().movements||[]).some(m=>m.id===issueEditingId&&m.lotId===x.id)))
  .map(x=>'<option value="'+escapes(x.id)+'">'+escapes(x.item+' · '+(x.invoice||'')+' · '+balance(x)+' '+x.unit)+'</option>').join('');
 if([...l.options].some(x=>x.value===oldLot))l.value=oldLot;
 const hint=$('pfm-v8-issue-hint');if(hint)hint.textContent=tr('الرصيد يعرض الكمية المتبقية من كل دفعة. لا توجد أسعار أو فواتير ثانية في الصرف.','Balances show remaining quantity per purchase lot; issuing does not create a second invoice.');
 renderIssueHistory();
 const original=$('v410LotFarm');if(original&&[...original.options].some(x=>x.value===fid)){
  if(original.value!==fid){original.value=fid;window.PFM_V410?.refresh?.();}
 }
}
function farmChange(){
 resetIssueEdit();
 const fid=selectedFarm(),legacy=$('pfm75-farm');
 if(legacy&&legacy.value!==fid)legacy.value=fid;
 refreshIssues();
}
function issue(override){
 if(!override&&typeof issueEditingId!=='undefined'&&issueEditingId){correctIssue(issueEditingId,false);return;}
 if(issuing)return;
 issuing=true;
 let checkpoint=null,persisted=false;
 try{
  const lot=(stock().lots||[]).find(x=>x.id===(override?.lotId||$('pfm-v8-issue-lot').value));
  const cycle=(db.cycles||[]).find(x=>x.id===(override?.cycleId||$('pfm-v8-issue-cycle').value));
  const qty=Number(override?.qty??$('pfm-v8-issue-qty').value),date=override?.date||$('pfm-v8-issue-date').value;
  const issueRef=String(override?.operationRef||$('pfm-v8-issue-ref').value||'').trim();
  if(!lot||!cycle||lot.farmId!==(override?cycle.farmId:selectedFarm())||cycle.farmId!==lot.farmId)throw Error(tr('اختر دفعة ودورة من نفس المزرعة.','Choose a lot and cycle from the same farm.'));
  if(!Number.isFinite(qty)||qty<=0||qty>balance(lot)+0.0000001)throw Error(tr('الكمية غير صحيحة أو تتجاوز الرصيد.','Quantity is invalid or exceeds available stock.'));
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||
    Number.isNaN(Date.parse(date+'T12:00:00Z'))||
    new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||
    date<cycle.date||date>new Date().toISOString().slice(0,10))
    throw Error(tr('تاريخ الصرف يجب أن يكون صحيحًا وداخل الدورة وحتى اليوم.','Issue date must be valid, within the cycle and no later than today.'));
  if(!issueRef||issueRef.length>64)throw Error(tr('أدخل رقم إذن صرف صحيحًا (حتى 64 حرفًا).','Enter a valid issue reference (up to 64 characters).'));
  if(override?.medication&&!['med','vaccine','disinfectant'].includes(lot.kind))
   throw Error(tr('اختر دفعة دواء أو تحصين أو مطهر من المشتريات.','Select a purchased medicine, vaccine or disinfectant lot.'));
  if(!['feed','med','vaccine','disinfectant','bedding'].includes(lot.kind))
    throw Error(tr('هذه الدفعة ليست من الأصناف القابلة للصرف.','This is not an issuable stock lot.'));
  if(!Number.isFinite(Number(lot.unitCost))||Number(lot.unitCost)<0)
    throw Error(tr('سعر دفعة المخزون غير صالح.','Invalid purchase lot unit cost.'));
  if(stock().close?.[cycle.id]?.status==='closed')throw Error(tr('الدورة مغلقة ماليًا، لا يمكن الصرف عليها.','The cycle is financially closed.'));
  if(typeof can!=='function'||!can('finance',cycle.farmId))throw Error(tr('ليس لديك صلاحية مالية على المزرعة.','No finance permission for this farm.'));
  const kind=lot.kind,sourceType=kind==='feed'?'feed':kind==='bedding'?'expense':'med';
  if(typeof requireActionForRecord==='function'&&!requireActionForRecord('create',sourceType==='expense'?'finance':sourceType,cycle.farmId))return;
  // Multiple genuine issues on the same day are valid (different lots, shifts
  // or quantities). An issue-reference, not date + item, is the identity.
  const ledger=stock(),normalizedRef=issueRef.normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('en');
  const alreadyIssued=(ledger.movements||[]).some(m=>{
    if(m.kind!=='issue'||!m.operationRef)return false;
    const old=String(m.operationRef).normalize('NFKC').replace(/\s+/g,' ').toLocaleLowerCase('en');
    if(old!==normalizedRef)return false;
    const previousLot=(ledger.lots||[]).find(l=>l.id===m.lotId);
    return previousLot?.farmId===cycle.farmId;
  });
  if(alreadyIssued)throw Error(tr('رقم إذن الصرف مسجل بالفعل لهذه المزرعة؛ راجع الحركة قبل التكرار.','DUPLICATE_ISSUE: This issue reference is already recorded for this farm.'));
  const cost=money(qty*Number(lot.unitCost)),now=new Date().toISOString();
  // Keep a complete in-memory checkpoint. If persisting fails, restore all
  // ledgers and avoid exposing a partial stock movement or duplicate expense.
  checkpoint={feed:db.feed.slice(),meds:db.meds.slice(),
   finance:db.finance[cycle.id],financeHad:Object.prototype.hasOwnProperty.call(db.finance,cycle.id),
   movements:Array.isArray(ledger.movements)?ledger.movements.slice():null,
   expenses:ledger.expenses?{...ledger.expenses}:null,
   ledgerAudit:Array.isArray(ledger.audit)?ledger.audit.slice():null,
   audit:Array.isArray(db.auditLog)?db.auditLog.slice():null,
   draftHad:typeof financeDraftExpenses!=='undefined'&&Object.prototype.hasOwnProperty.call(financeDraftExpenses,cycle.id),
   draft:typeof financeDraftExpenses!=='undefined'?financeDraftExpenses[cycle.id]:undefined,
   cycleId:cycle.id,ledger};
  const recId=uuid(),movement={id:uuid(),operationRef:issueRef,farmId:cycle.farmId,
    lotId:lot.id,cycleId:cycle.id,sourceType,sourceId:recId,
    kind:'issue',qty,unitCost:lot.unitCost,cost,date,createdAt:now};
  if(!Array.isArray(ledger.movements))ledger.movements=[];
  if(sourceType==='feed'){
   db.feed.push({id:recId,cycleId:cycle.id,date,type:lot.item,qty,price:Number(lot.unitCost||0),
     currency:lot.currency||db.settings?.currency||'SAR',v410MovementId:movement.id,updatedAt:now});
  }else if(sourceType==='med'){
   db.meds.push({id:recId,cycleId:cycle.id,date,type:kind==='med'?'دواء':kind==='vaccine'?'تحصين':'مطهر',
     name:lot.item,qty,cost,currency:lot.currency||db.settings?.currency||'SAR',
     dose:String(override?.medication?.dose||''),withdrawal:Number(override?.medication?.withdrawal||0),
     v410MovementId:movement.id,updatedAt:now});
  }else{
   const current=db.finance[cycle.id]||{},existing=typeof normalizeFinanceExpenses==='function'?normalizeFinanceExpenses(current):current.expenses||[];
   const entry={id:recId,category:'نشارة',amount:cost,updatedAt:now};
   db.finance[cycle.id]={...current,expenses:[...existing,entry]};
   if(!ledger.expenses)ledger.expenses={};
   ledger.expenses[recId]={id:recId,cycleId:cycle.id,date,category:'نشارة',qty,price:lot.unitCost,
    supplier:lot.supplier||'',invoice:lot.invoice||'',amount:cost,currency:lot.currency||'SAR',lotId:lot.id,note:'صرف مخزون'};
  }
  ledger.movements.push(movement);
  if(typeof audit==='function')audit('create','v410_issue',movement.id,{farmId:cycle.farmId,before:null,after:movement});
  if(typeof save!=='function')throw Error(tr('الحفظ غير متاح.','Saving is unavailable.'));
  save();
  // Persistence is a commit boundary: a failed UI refresh must not roll
  // back a transaction already saved to disk.
  persisted=true;
  if(sourceType==='expense'&&typeof financeDraftExpenses!=='undefined')
   financeDraftExpenses[cycle.id]=normalizeFinanceExpenses(db.finance[cycle.id]);
  if(override?.medication){
   for(const id of ['medQty','medDose','medWithdrawal'])if($(id))$(id).value='';
   if(typeof renderMedTable==='function')renderMedTable();
   alert(tr('تم تسجيل المتابعة الصحية وصرف المخزون، وتحميل تكلفة الدواء مرة واحدة.','Medicine record and stock issue saved; cost posted once.'));
  }else{
   $('pfm-v8-issue-qty').value='';
   $('pfm-v8-issue-ref').value=uuid(); // new draft reference only after save
   $('pfm-v8-issue-state').textContent=tr('تم صرف الكمية للعنبر وتحديث المخزون وتكلفة الدورة مرة واحدة. إذن: ','Stock issued with one inventory movement and one cycle cost. Reference: ')+issueRef;
  }
  window.PFM_V410?.refresh?.();refreshIssues();
 }catch(err){
  if(checkpoint&&!persisted){
   db.feed=checkpoint.feed;db.meds=checkpoint.meds;
   if(checkpoint.financeHad)db.finance[checkpoint.cycleId]=checkpoint.finance;
   else delete db.finance[checkpoint.cycleId];
   if(checkpoint.movements)checkpoint.ledger.movements=checkpoint.movements;
   else delete checkpoint.ledger.movements;
   if(checkpoint.expenses)checkpoint.ledger.expenses=checkpoint.expenses;
   else delete checkpoint.ledger.expenses;
   if(checkpoint.ledgerAudit)checkpoint.ledger.audit=checkpoint.ledgerAudit;
   else delete checkpoint.ledger.audit;
   if(checkpoint.audit)db.auditLog=checkpoint.audit;
   if(typeof financeDraftExpenses!=='undefined'){
     if(checkpoint.draftHad)financeDraftExpenses[checkpoint.cycleId]=checkpoint.draft;
     else delete financeDraftExpenses[checkpoint.cycleId];
   }
  }
  if(override?.medication)alert(tr('تعذر حفظ المتابعة الصحية: ','Medicine issue failed: ')+err.message);
  else $('pfm-v8-issue-state').textContent=tr(persisted?'تم حفظ حركة الصرف، لكن تعذر تحديث العرض: ':'تعذر الصرف: ',persisted?'Issue saved but screen refresh failed: ':'Issue failed: ')+err.message;
 }finally{issuing=false;}
}
function dailyMedicine(){
 const chosen=$('medCycle');
 const cycles=[...(chosen?.selectedOptions||[])].map(o=>o.value).filter(Boolean);
 if(cycles.length!==1){alert(tr('اختر دورة وعنبرًا واحدًا لتسجيل الاستخدام الفعلي.','Select exactly one house/cycle for medicine use.'));return;}
 if(typeof editState!=='undefined'&&editState.type==='med'){
  alert(tr('لتصحيح كمية أو تكلفة صرف مرتبط بالمخزون، استخدم تعديل حركة الصرف في المشتريات؛ لا تُنشأ فاتورة جديدة هنا.','Correct linked stock quantities from the inventory issue log, not the daily record.'));return;
 }
 const lotId=$('v410MedLot')?.value||'';
 const lot=(stock().lots||[]).find(l=>l.id===lotId);
 if(!lot||!['med','vaccine','disinfectant'].includes(lot.kind)){alert(tr('اختر دفعة مشتريات دواء أو تحصين أو مطهر.','Select a purchased medicine, vaccine or disinfectant lot.'));return;}
 const qty=Number($('medQty')?.value);
 const withdrawal=Number($('medWithdrawal')?.value||0);
 if(!Number.isFinite(qty)||qty<=0||!Number.isInteger(withdrawal)||withdrawal<0){
  alert(tr('أدخل كمية صحيحة موجبة وفترة سحب بالأيام.','Enter positive quantity and nonnegative withdrawal days.'));return;
 }
 issue({lotId,cycleId:cycles[0],qty,date:$('medDate')?.value||new Date().toISOString().slice(0,10),
  operationRef:uuid(),medication:{dose:$('medDose')?.value?.trim()||'',withdrawal}});
}
function configureDailyMedicines(){
 const view=$('meds'),control=$('v410MedLot');if(!view||!control)return;
 const cost=$('medCost')?.closest('.field');if(cost)cost.hidden=true;
 const medName=$('medName');if(medName)medName.readOnly=true;
 const selectLabel=control.closest('label')?.querySelector('span')||control.closest('.field')?.querySelector(':scope > span');
 if(selectLabel)selectLabel.textContent=tr('دفعة الدواء/التحصين المشتراة *','Purchased medicine/vaccine lot *');
 const instructions=document.createElement('p');
 instructions.className='note';instructions.id='pfm-v81-health-help';
 instructions.textContent=tr('المورد والفاتورة والسعر والضريبة في المشتريات فقط. سجّل هنا الكمية والجرعة وفترة السحب؛ التكلفة تُحسب تلقائيًا من دفعة المخزون.','Supplier, invoice and VAT are recorded in Purchases only. Enter quantity, dose and withdrawal; stock batch determines the cost.');
 view.querySelector('.scope-form-grid')?.after(instructions);
 const style=document.createElement('style');style.id='pfm-v81-daily-med-css';
 style.textContent='#meds .v410-direct-tax,#meds .field:has(#medCost){display:none!important}'+
  '#meds table th:nth-child(8),#meds table td:nth-child(8){display:none!important}';
 document.head.appendChild(style);
 // Replace the legacy direct-cost medicine writer while preserving the same
 // existing technical monitoring screen and its read-only historical data.
 if(typeof addMed==='function')addMed=function(){return dailyMedicine()};
 window.PFMV81DailyMedicineIssue=dailyMedicine;
}
function build(){
 if(installed||!window.PFMV8SingleEntryActive||!$('pfm-v8-lines')||!$('pfm75-stock')||!window.PFM_V410)return false;
 const host=$('pfm-v8-lines');
 // Empty the automatically supplied template line; no category is mandatory.
 host.querySelectorAll('.pfm-v8-line').forEach(el=>el.remove());
 for(const [id,ar,english,kind,helpAr,helpEn] of categories){
  const area=document.createElement('section');area.className='pfm-v8-workspace-section';
  area.innerHTML='<h4'+tag(ar,english)+'>'+tr(ar,english)+'</h4>'+
   '<p class="muted"'+tag(helpAr,helpEn)+'>'+tr(helpAr,helpEn)+'</p>'+
   '<div id="pfm-v8-group-'+id+'"></div>'+
   '<div class="actions"><button type="button" class="btn"'+tag('إضافة بند','Add item')+' data-pfm-v8-add-group="'+id+'">'+tr('إضافة بند','Add item')+'</button></div>';
  host.appendChild(area);
  area.querySelector('[data-pfm-v8-add-group]').addEventListener('click',()=>addLine(id,kind));
 }
 // One visible farm chooser; existing legacy selector is kept only for compatibility.
 const top=$('pfm75-purchases')?.querySelector('.pfm75-top');
 if(top)top.hidden=true;
 const tabs=$('pfm75-purchases')?.querySelector('.pfm75-tabs');
 if(tabs)tabs.hidden=true;
 const stockArea=$('pfm75-stock');stockArea.hidden=false;
 const holder=$('pfm75-stock-lots');
 const issuePanel=document.createElement('section');issuePanel.id='pfm-v8-workspace';issuePanel.className='panel';
 issuePanel.innerHTML='<h3'+tag('الصرف للمزرعة والعنابر','Farm & house stock issue')+'>'+tr('الصرف للمزرعة والعنابر','Farm & house stock issue')+'</h3>'+
  '<p class="muted"'+tag('من نفس صفحة المشتريات، اختر الدفعة والعنبر والكمية. لا تُكتب فاتورة جديدة ولا سعر جديد.','On the same page, choose the lot, house and quantity; no second invoice or price entry.')+'>'+
  tr('من نفس صفحة المشتريات، اختر الدفعة والعنبر والكمية. لا تُكتب فاتورة جديدة ولا سعر جديد.','On the same page, choose the lot, house and quantity; no second invoice or price entry.')+'</p>'+
  '<div class="pfm-v8-fields"><label><span'+tag('الدورة / العنبر','Cycle / house')+'>'+tr('الدورة / العنبر','Cycle / house')+'</span><select id="pfm-v8-issue-cycle"></select></label>'+
  '<label><span'+tag('دفعة المخزون','Stock lot')+'>'+tr('دفعة المخزون','Stock lot')+'</span><select id="pfm-v8-issue-lot"></select></label>'+
  '<label><span'+tag('الكمية المصروفة','Issued quantity')+'>'+tr('الكمية المصروفة','Issued quantity')+'</span><input id="pfm-v8-issue-qty" type="number" min="0.001" step="any"></label>'+
  '<label><span'+tag('تاريخ الصرف','Issue date')+'>'+tr('تاريخ الصرف','Issue date')+'</span><input id="pfm-v8-issue-date" type="date"></label>'+
  '<label><span'+tag('رقم إذن الصرف (يُنشأ تلقائيًا)','Issue reference (auto-generated)')+'>'+tr('رقم إذن الصرف (يُنشأ تلقائيًا)','Issue reference (auto-generated)')+'</span><input id="pfm-v8-issue-ref" maxlength="64" autocomplete="off"></label></div>'+
  '<div class="actions"><button type="button" class="btn primary" id="pfm-v8-issue-btn"'+tag('تسجيل الصرف مرة واحدة','Issue stock once')+'>'+tr('تسجيل الصرف مرة واحدة','Issue stock once')+'</button><button type="button" class="btn" id="pfm-v8-issue-cancel" hidden'+tag('إلغاء التعديل','Cancel edit')+'>'+tr('إلغاء التعديل','Cancel edit')+'</button></div>'+
  '<p id="pfm-v8-issue-state" role="status" aria-live="polite"></p><p class="muted" id="pfm-v8-issue-hint"></p>'+
  '<div class="table-scroll"><table><thead><tr><th>'+tr('التاريخ','Date')+'</th><th>'+tr('إذن الصرف','Issue reference')+'</th><th>'+tr('الصنف','Item')+'</th><th>'+tr('العنبر','House')+'</th><th>'+tr('الكمية','Quantity')+'</th><th>'+tr('التكلفة','Cost')+'</th><th>'+tr('الإجراءات','Actions')+'</th></tr></thead><tbody id="pfm-v8-issue-history"></tbody></table></div>';
 holder?.prepend(issuePanel);
 const style=document.createElement('style');style.id='pfm-v8-workspace-css';
 style.textContent=[
 '#pfm-v8-add{display:none!important}',
 '#pfm-v8-lines .pfm-v8-workspace-section{background:#fbfdff;border:1px solid #d0e0ec;padding:12px;border-radius:10px;margin:10px 0}',
 '#pfm-v8-lines .pfm-v8-workspace-section h4{margin:0 0 5px}',
 '#pfm75-purchases .pfm75-top,#pfm75-purchases .pfm75-tabs{display:none!important}',
 '#pfm75-purchases #pfm75-stock{display:block!important}',
 '#pfm75-stock-old,#pfm75-lots-form,#pfm75-stock-lots>.panel:not(#pfm-v8-workspace),#pfm75-house-consumption{display:none!important}',
 '#pfm-v8-workspace .pfm-v8-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}',
 '#pfm-v8-workspace label{display:flex;flex-direction:column;gap:6px}',
 '#pfm-v8-workspace input,#pfm-v8-workspace select{width:100%;min-height:40px}',
 'nav#v53-nav .v55-nav-items>button[data-stage="7"]{display:none!important}',
 'nav#v53-nav .v55-nav-items>button[data-stage="9"]{font-size:0!important}',
 'nav#v53-nav .v55-nav-items>button[data-stage="9"]::after{content:"المشتريات والمخزون";font-size:13px}',
 'html[lang="en"] nav#v53-nav .v55-nav-items>button[data-stage="9"]::after{content:"Purchases & Inventory"}',
 '@media(max-width:620px){#pfm-v8-workspace .pfm-v8-fields{grid-template-columns:1fr}}'
 ].join('\n');
 document.head.appendChild(style);
 $('pfm-v8-issue-date').value=new Date().toISOString().slice(0,10);
 $('pfm-v8-issue-ref').value=uuid();
 $('pfm-v8-issue-btn').addEventListener('click',issue);
 $('pfm-v8-issue-cancel').addEventListener('click',()=>{resetIssueEdit();refreshIssues();});
 $('pfm-v8-issue-history').addEventListener('click',e=>{
  const edit=e.target.closest('[data-pfm-issue-edit]'),del=e.target.closest('[data-pfm-issue-delete]');
  try{if(edit)editIssue(edit.getAttribute('data-pfm-issue-edit'));
   else if(del)correctIssue(del.getAttribute('data-pfm-issue-delete'),true);
  }catch(err){$('pfm-v8-issue-state').textContent=err.message;}
 });
 $('pfm-v8-farm').addEventListener('change',farmChange);
 $('pfm-v8-issue-cycle').addEventListener('change',()=>{$('pfm-v8-issue-state').textContent=''});
 // Restore business ownership of each existing navigation item even if
 // earlier runtime layouts moved buttons into the wrong group.
 const navRoot=$('v53-nav');
 if(navRoot){
  const purchases=navRoot.querySelector('[data-v55-group="nutrition"] .v55-nav-items');
  const daily=navRoot.querySelector('[data-v55-group="daily"] .v55-nav-items');
  for(const stage of ['7','9']){
   const item=navRoot.querySelector('button[data-stage="'+stage+'"]');
   if(item&&purchases)purchases.appendChild(item);
  }
  for(const stage of ['5','6','8']){
   const item=navRoot.querySelector('button[data-stage="'+stage+'"]');
   if(item&&daily)daily.appendChild(item);
  }
 }
 const nav=$('v53-nav'),syncNav=()=>{
  const btn=nav?.querySelector('.v55-nav-items>button[data-stage="9"]');
  if(btn)btn.setAttribute('aria-label',tr('المشتريات والمخزون','Purchases and inventory'));
 };
 const translate=()=>{nativeLang();syncNav();};
 new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
 translate();farmChange();configureDailyMedicines();installed=true;
 return true;
}
let tries=0;
const timer=setInterval(()=>{if(build()||++tries>=150)clearInterval(timer)},200);
})();