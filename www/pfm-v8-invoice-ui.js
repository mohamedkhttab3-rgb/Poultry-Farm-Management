/* Single V8 purchase intake for Android, Windows and iOS.
 * Does not change old ledgers or calculations. Uses PFMV8InvoiceCore.commit. */
(function(){'use strict';
const $=id=>document.getElementById(id);
const tr=(ar,en)=>document.documentElement.lang==='en'?en:ar;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds=[['feed','أعلاف','Feed'],['chicks','صيصان','Chicks'],['med','أدوية','Medicines'],['vaccine','تحصينات','Vaccines'],['disinfectant','مطهرات','Disinfectants'],['bedding','نشارة','Bedding'],['rent','إيجار','Rent'],['diesel','ديزل','Diesel'],['electricity','كهرباء','Electricity'],['water','مياه','Water'],['labor','عمال','Labor'],['transport','نقل','Transport'],['loading','تحميل','Loading'],['equipment_rent','إيجار معدات','Equipment rental'],['other','أخرى','Other'],['shared','مصروف مشترك','Shared farm expense'],['asset','أصل ثابت','Fixed asset']];
const stocked=new Set(['feed','med','vaccine','disinfectant','bedding']);
const opts=a=>a.map(v=>'<option value="'+esc(v[0])+'">'+esc(tr(v[1],v[2]))+'</option>').join('');
const inp=(key,ar,en,type='text',value='')=>'<label><span>'+esc(tr(ar,en))+'</span><input data-k="'+key+'" type="'+type+'" value="'+esc(value)+'"></label>';
const sel=(key,ar,en,options)=>'<label><span>'+esc(tr(ar,en))+'</span><select data-k="'+key+'">'+opts(options)+'</select></label>';
const field=(el,key)=>el.querySelector('[data-k="'+key+'"]');
const farm=()=>$('pfm-v8-farm')?.value||'';
const farmCycles=()=>Array.isArray(db?.cycles)?db.cycles.filter(x=>x.farmId===farm()):[];
const ordinal=c=>typeof cycleOrdinal==='function'?Number(cycleOrdinal(c)):Number(c.cycleNumber||1);
let ready=false,busy=false;
function scope(el){
 const kind=field(el,'kind').value,chick=kind==='chicks',shared=kind==='shared',asset=kind==='asset',direct=!chick&&!shared&&!asset&&!stocked.has(kind);
 const feed=kind==='feed';
 el.querySelector('.v8-feed').hidden=!feed;
 if(feed){
  field(el,'unit').value='كجم';
  const stage=field(el,'feedStage');
  if(stage.value)field(el,'item').value=stage.value;
  field(el,'item').readOnly=true;
 }else field(el,'item').readOnly=false;
 el.querySelector('.v8-chick').hidden=!chick;
 el.querySelector('.v8-direct').hidden=!direct;
 el.querySelector('.v8-free').hidden=!chick;
 el.querySelector('.v8-freight').hidden=!chick;
 el.querySelector('.v81-shared').hidden=!shared;
 el.querySelector('.v81-asset').hidden=!asset;
 if(shared){
  const target=el.querySelector('.v81-shared-cycles'),checked=new Set([...target.querySelectorAll('[data-cycle]')].filter(x=>x.checked).map(x=>x.value));
  target.innerHTML=farmCycles().map(c=>'<label><input type="checkbox" data-cycle value="'+esc(c.id)+'" '+(checked.has(c.id)?'checked':'')+'><span>'+esc((typeof getHouseName==='function'?getHouseName(c.houseId):c.houseId)+' — '+c.date)+'</span></label>').join('');
 }
 const nums=[...new Set(farmCycles().map(ordinal))].filter(Number.isInteger).sort((a,b)=>a-b);
 const n=field(el,'cycleNumber'),prior=n.value;
 n.innerHTML=nums.map(x=>'<option value="'+x+'">'+esc(tr('دورة ','Cycle '))+x+'</option>').join('');
 if(nums.includes(Number(prior)))n.value=prior;
 const c=field(el,'cycleId'),old=c.value;
 c.innerHTML=farmCycles().map(x=>'<option value="'+esc(x.id)+'">'+esc((typeof getHouseName==='function'?getHouseName(x.houseId):x.houseId)+' — '+x.date)+'</option>').join('');
 if([...c.options].some(x=>x.value===old))c.value=old;
 field(el,'quantity').readOnly=chick;
 if(chick)chickQty(el);
}
function chickQty(el){
 const num=Number(field(el,'cycleNumber').value);
 const qty=farmCycles().filter(c=>ordinal(c)===num).reduce((sum,c)=>sum+Number(c.birds||0),0);
 if(qty>0)field(el,'quantity').value=String(qty);
}
function line(){
 const el=document.createElement('div');el.className='pfm-v8-line';
 el.innerHTML='<div class="pfm-v8-linehead"><b>'+tr('بند مشتريات','Purchase item')+'</b><div class="pfm-v8-line-actions"><button type="button" data-line-save>'+tr('حفظ','Save')+'</button><button type="button" data-remove>'+tr('حذف','Remove')+'</button></div></div><div class="pfm-v8-fields">'+
 sel('kind','نوع البند','Type',kinds)+
 '<label class="v8-feed" hidden><span>'+tr('مرحلة العلف','Feed stage')+'</span><select data-k="feedStage"><option value="">'+tr('اختر المرحلة','Select stage')+'</option><option value="بادي">'+tr('بادي','Starter')+'</option><option value="نامي">'+tr('نامي','Grower')+'</option><option value="ناهي">'+tr('ناهي','Finisher')+'</option></select></label>'+
 inp('item','اسم الصنف','Item name')+
 inp('quantity','الكمية','Quantity','number','1')+inp('unit','الوحدة','Unit','text','وحدة')+
 sel('priceMode','طريقة التسعير','Pricing',[['total','إجمالي البند','Line total'],['unit','سعر الوحدة','Unit price']])+
 inp('amount','السعر / إجمالي البند','Price / line total','number')+
 inp('discount','الخصم','Discount','number','0')+
 sel('vatMode','الفاتورة','VAT pricing',[['excluded','غير شاملة للضريبة','VAT excluded'],['included','شاملة للضريبة','VAT included']])+
 inp('vatRate','الضريبة %','VAT %','number','15')+
 inp('reclaim','الضريبة المستردة %','Recoverable VAT %','number','100')+
 '<label class="v8-chick" hidden><span>'+tr('رقم دورة استقبال الصيصان','Chick reception cycle')+'</span><select data-k="cycleNumber"></select></label>'+
 '<label class="v8-direct" hidden><span>'+tr('الدورة المحمل عليها','Charge to cycle')+'</span><select data-k="cycleId"></select></label>'+
 '<label class="v8-free" hidden><span>'+tr('صيصان مجانية','Free chicks')+'</span><input data-k="free" type="number" value="0"></label>'+
 '<label class="v8-freight" hidden><span>'+tr('نقل إضافي للصيصان','Extra chick freight')+'</span><input data-k="freight" type="number" value="0"></label>'+ 
 '<div class="v81-shared" hidden><label><span>'+tr('أساس التوزيع','Allocation basis')+'</span><select data-k="method"><option value="equal">'+tr('بالتساوي','Equal')+'</option><option value="birds">'+tr('حسب عدد الطيور','By birds')+'</option></select></label><p>'+tr('اختر العنابر المستفيدة — تسجّل الفاتورة مرة واحدة فقط','Select beneficiary houses; invoice is stored only once')+'</p><div class="v81-shared-cycles"></div></div>'+ 
 '<div class="v81-asset" hidden>'+inp('startDate','تاريخ بدء تشغيل الأصل','Asset service date','date')+inp('lifeMonths','العمر الإنتاجي بالشهور','Useful life (months)','number','60')+inp('residual','القيمة المتبقية','Residual value','number','0')+'</div>'+
 inp('note','ملاحظات','Notes')+'</div>';
 el.querySelector('[data-line-save]').addEventListener('click',()=>saveDraftLine(el));
 el.querySelector('[data-remove]').addEventListener('click',()=>{
  if(el.dataset.editDraftId){
   el.remove();status(tr('تم إغلاق تعديل البند دون تغيير السجل المحفوظ.','Edit canceled; saved draft line unchanged.'),true);
  }else el.remove();
 });
 field(el,'kind').addEventListener('change',()=>{
  field(el,'item').value='';
  field(el,'quantity').value='1';
  field(el,'unit').value='وحدة';
  field(el,'feedStage').value='';
  scope(el);
 });
 field(el,'feedStage').addEventListener('change',()=>scope(el));
 field(el,'cycleNumber').addEventListener('change',()=>chickQty(el));
 scope(el);return el;
}
function refresh(){
 const f=$('pfm-v8-farm');if(!f)return;
 const old=f.value;
 f.innerHTML=(db.farms||[]).map(x=>'<option value="'+esc(x.id)+'">'+esc(x.name)+'</option>').join('');
 if(db.farms.some(x=>x.id===old))f.value=old;
 else if(db.farms.some(x=>x.id===$('pfm75-farm')?.value))f.value=$('pfm75-farm').value;
 $('pfm-v8-lines').querySelectorAll('.pfm-v8-line').forEach(scope);
 const draft=currentDraft();
 if(draft){
  for(const [key,id] of [['invoice','pfm-v8-invoice-no'],['supplier','pfm-v8-supplier']]){
   if(draft[key]&&!$(id).value)$(id).value=draft[key];
  }
  if(draft.date&&$('pfm-v8-date')&&!$('pfm-v8-date').value)$('pfm-v8-date').value=draft.date;
 }
 renderSaved();
 history();
}
function header(){
 return {farmId:farm(),supplier:$('pfm-v8-supplier')?.value?.trim()||'',
  invoice:$('pfm-v8-invoice-no')?.value?.trim()||'',
  date:$('pfm-v8-date')?.value||''};
}
function readLine(el){
 const o={};
 for(const key of ['kind','item','quantity','unit','priceMode','amount','discount','vatMode','vatRate','reclaim','cycleId','cycleNumber','free','freight','note','method','startDate','lifeMonths','residual'])
  o[key]=field(el,key)?.value??'';
 o.cycleIds=[...el.querySelectorAll('.v81-shared-cycles [data-cycle]:checked')].map(c=>c.value);
 return o;
}
function currentDraft(){return window.PFMV81PurchaseDrafts?.read(db,farm())||null;}
function draftContext(){return {uuid:()=>uuid(),persist:()=>save(),
 prepare:window.PFMV8InvoiceCore.prepare,accounting};}
function input(){
 const d=currentDraft();
 return {...header(),draftId:d?.id||null,lines:(d?.lines||[]).map(({draftLineId,...line})=>line)};
}
function renderSaved(){
 const host=$('pfm-v8-saved-lines');if(!host)return;
 const d=currentDraft(),lines=d?.lines||[];
 host.hidden=!lines.length;
 const list=$('pfm-v8-draft-rows');
 list.innerHTML=lines.map((line,i)=>'<tr><td>'+String(i+1)+'</td><td>'+esc(line.item)+'</td><td>'+esc(line.quantity+' '+line.unit)+'</td><td>'+
  esc(line.amount)+'</td><td>'+esc(tr('قيد اعتماد الفاتورة','Pending invoice approval'))+'</td>'+
  '<td><button type="button" class="btn" data-v8-edit-draft="'+esc(line.draftLineId)+'">'+tr('تعديل','Edit')+'</button> '+
  '<button type="button" class="btn danger" data-v8-remove-draft="'+esc(line.draftLineId)+'">'+tr('حذف','Delete')+'</button></td></tr>').join('');
 const count=$('pfm-v8-draft-count');
 if(count)count.textContent=tr('بنود محفوظة: ','Saved lines: ')+lines.length;
}
function saveDraftLine(el){
 try{
  if(!window.PFMV81PurchaseDrafts)throw Error('Purchase draft module unavailable');
  const record=window.PFMV81PurchaseDrafts.saveLine(db,{
   farmId:farm(),lineId:el.dataset.editDraftId||null,header:header(),line:readLine(el)
  },draftContext());
  el.remove();
  renderSaved();
  status(tr('تم حفظ البند في السجل أدناه. سيُرحّل للمصروفات والمخزون مرة واحدة عند اعتماد الفاتورة: ',
   'Saved below. Inventory and expenses post once when invoice is approved: ')+record.draft.lines.length,true);
 }catch(e){status(tr('تعذر حفظ البند: ','Line save failed: ')+e.message,false)}
}
function editDraft(id){
 const saved=currentDraft()?.lines.find(l=>l.draftLineId===id);
 if(!saved)return;
 const kind=saved.kind;
 const group=kind==='feed'?'feed':kind==='chicks'?'chicks':
  ['med','vaccine','disinfectant','bedding'].includes(kind)?'health':
  kind==='shared'?'shared':kind==='asset'?'assets':'expenses';
 const original=$('pfm-v8-lines');
 const before=new Set(original.querySelectorAll('.pfm-v8-line'));
 const btn=original.querySelector('[data-pfm-v8-add-group="'+group+'"]');
 if(!btn)throw Error('Purchase category unavailable');
 btn.click();
 const el=[...original.querySelectorAll('.pfm-v8-line')].find(x=>!before.has(x));
 if(!el)throw Error('Could not reopen purchase line');
 field(el,'kind').value=kind;
 field(el,'kind').dispatchEvent(new Event('change',{bubbles:true}));
 for(const [key,value] of Object.entries(saved)){
  if(key==='draftLineId'||key==='cycleIds'||key==='weights')continue;
  const item=field(el,key);if(item)item.value=value??'';
 }
 scope(el);
 // Scope refresh populates selected farm cycles and feed stages; reapply the
 // stored values after the update, keeping each line's financial basis intact.
 for(const key of ['cycleId','cycleNumber','feedStage','quantity','item']){
  const item=field(el,key);if(item&&saved[key]!==undefined)item.value=saved[key];
 }
 if(Array.isArray(saved.cycleIds))el.querySelectorAll('.v81-shared-cycles [data-cycle]').forEach(x=>x.checked=saved.cycleIds.includes(x.value));
 el.dataset.editDraftId=id;
 el.scrollIntoView?.({behavior:'smooth',block:'center'});
 status(tr('عدّل البيانات ثم اضغط حفظ. لن تتغير المسودة حتى تحفظ التعديل.','Edit this line and save; the stored draft is unchanged until saved.'),true);
}
function deleteDraft(id){
 if(!confirm(tr('هل تريد حذف البند من مسودة الفاتورة؟','Remove this draft line?')))return;
 try{
  window.PFMV81PurchaseDrafts.removeLine(db,{farmId:farm(),lineId:id},draftContext());
  renderSaved();
  status(tr('تم حذف البند من المسودة دون المساس بالحسابات.','Draft line removed; posted finances are unchanged.'),true);
 }catch(e){status(e.message,false)}
}
function accounting(){
 const core=window.PFM74PurchaseCore;
 return {uuid:()=>uuid(),price:core.price,shares:core.shares,
   allocate:window.PFMV81Accounting?.allocate,
  normalizeExpenses:normalizeFinanceExpenses,
  canFinance:id=>!!currentUser&&can('finance',id),
  cycleOrdinal:ordinal,userId:currentUser?.id||null,
  currency:id=>typeof getCycleCurrency==='function'?getCycleCurrency(db.cycles.find(c=>c.id===id)):db.settings?.currency,
  persist:()=>{if(typeof save!=='function')throw Error('Save unavailable');save();}};
}
function status(message,ok){const el=$('pfm-v8-invoice-status');el.textContent=message;el.dataset.valid=ok?'true':'false'}
function preview(){
 try{
  const values=input();if(!values.lines.length)throw Error(tr('احفظ بندًا واحدًا على الأقل أولًا.','Save at least one line first.'));
  const doc=window.PFMV8InvoiceCore.prepare(db,values,accounting()).document;
  status(tr('بنود: ','Lines: ')+doc.lines.length+tr(' — التكلفة المحاسبية: ',' — accounting cost: ')+doc.totals.accountingCost.toFixed(2)+' '+(db.settings?.currency||'SAR'),true);
 }catch(e){status(tr('خطأ: ','Error: ')+e.message,false)}
}
function history(){
 const el=$('pfm-v8-history');if(!el)return;
 const rows=(db?.v410?.purchaseDocuments||[]).slice(-30).reverse();
 el.innerHTML=rows.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+esc(r.invoice)+'</td><td>'+esc(r.supplier)+'</td><td>'+esc(r.lines?.length||0)+'</td><td>'+esc(r.totals?.accountingCost?.toFixed?.(2)||0)+'</td></tr>').join('')||
 '<tr><td colspan="5">'+tr('لا توجد فواتير موحدة','No unified invoices')+'</td></tr>';
}
function submit(){
 if(busy)return;
 busy=true;const btn=$('pfm-v8-submit');btn.disabled=true;
 try{
  const values=input();
  if(!values.lines.length)throw Error(tr('احفظ بندًا واحدًا على الأقل قبل الاعتماد.','Save at least one line before approval.'));
  for(const [key,id,name] of [['supplier','pfm-v8-supplier',tr('المورد','Supplier')],['invoice','pfm-v8-invoice-no',tr('رقم الفاتورة','Invoice number')]]){
   if(!values[key]){
    $(id).focus?.();
    $(id).scrollIntoView?.({behavior:'smooth',block:'center'});
    throw Error(name+tr(' مطلوب لاعتماد الفاتورة.',' is required for invoice approval.'));
   }
  }
  const doc=window.PFMV8InvoiceCore.commit(db,values,accounting());
  // Clear financial form cache after successful commit; never mutate sales snapshots.
  if(typeof financeDraftExpenses!=='undefined'){
   for(const c of db.cycles||[]){
    if(doc.lines.some(l=>l.cycleId===c.id||l.allocatedCycles?.some(x=>x.cycleId===c.id)))
     financeDraftExpenses[c.id]=normalizeFinanceExpenses(db.finance[c.id]||{});
   }
  }
  status(tr('تم الحفظ بنجاح: ','Saved successfully: ')+doc.invoice,true);
  $('pfm-v8-invoice-no').value='';$('pfm-v8-supplier').value='';$('pfm-v8-lines').querySelectorAll('.pfm-v8-line').forEach(el=>el.remove());renderSaved();history();
  window.PFM_V410?.refresh?.();
 }catch(e){status(tr('لم يتم الحفظ: ','Not saved: ')+e.message,false)}
 finally{busy=false;btn.disabled=false}
}
function install(){
 if(ready||!window.PFMV8InvoiceCore||!window.PFM74PurchaseCore||!$('pfm75-expenses')||!$('v410-lot-panel'))return false;
 const div=document.createElement('section');div.id='pfm-v8-invoice';
 div.className='panel';
 div.innerHTML='<h3>'+tr('فاتورة المشتريات الموحدة','Unified purchase invoice')+'</h3>'+
 '<p class="muted">'+tr('فاتورة واحدة بمورد ورقم وتاريخ ثابت، وبنود متعددة. مشتريات المخزون لا تُحسب تكلفة دورة إلا عند الصرف.', 'One invoice header and multiple lines. Stock purchases charge cycles only when issued.')+'</p>'+
 '<div class="pfm-v8-fields"><label><span>'+tr('المزرعة *','Farm *')+'</span><select id="pfm-v8-farm"></select></label>'+
 '<label><span>'+tr('رقم الفاتورة *','Invoice number *')+'</span><input id="pfm-v8-invoice-no" autocomplete="off"></label>'+
 '<label><span>'+tr('المورد *','Supplier *')+'</span><input id="pfm-v8-supplier" autocomplete="off"></label>'+
 '<label><span>'+tr('تاريخ الفاتورة *','Invoice date *')+'</span><input id="pfm-v8-date" type="date"></label></div>'+
 '<div id="pfm-v8-lines"></div><div class="actions"><button type="button" class="btn" id="pfm-v8-add">'+tr('إضافة بند','Add line')+'</button>'+
 '<button type="button" class="btn" id="pfm-v8-preview">'+tr('مراجعة الفاتورة','Preview')+'</button>'+
 '<button type="button" class="btn primary" id="pfm-v8-submit">'+tr('اعتماد الفاتورة مرة واحدة','Save once')+'</button></div>'+
 '<p class="muted" id="pfm-v8-invoice-status" aria-live="polite"></p>'+
 '<div id="pfm-v8-saved-lines" class="panel" hidden><h4>'+tr('البنود والمصروفات المحفوظة بانتظار اعتماد الفاتورة','Saved purchase lines / pending cycle expenses')+'</h4>'+
 '<p class="muted">'+tr('هنا تظهر البنود بعد الضغط على حفظ. لا تدخل هذه التكاليف في أرباح الدورة ولا يُنشأ المخزون حتى اعتماد الفاتورة مرة واحدة.','Saved lines appear here. No stock or financial posting until a single final invoice approval.')+'</p>'+
 '<p id="pfm-v8-draft-count"></p><div class="table-scroll"><table><thead><tr><th>#</th><th>'+tr('الصنف','Item')+'</th><th>'+tr('الكمية','Quantity')+'</th><th>'+tr('القيمة','Amount')+'</th><th>'+tr('الحالة','Status')+'</th><th>'+tr('الإجراءات','Actions')+'</th></tr></thead><tbody id="pfm-v8-draft-rows"></tbody></table></div></div>'+
 '<details><summary>'+tr('سجل الفواتير الموحدة','Unified invoice register')+'</summary><div class="table-scroll"><table><thead><tr><th>'+tr('التاريخ','Date')+'</th><th>'+tr('الرقم','Number')+'</th><th>'+tr('المورد','Supplier')+'</th><th>'+tr('البنود','Lines')+'</th><th>'+tr('التكلفة','Cost')+'</th></tr></thead><tbody id="pfm-v8-history"></tbody></table></div></details>';
 $('pfm75-expenses').prepend(div);
 const sheet=document.createElement('style');sheet.id='pfm-v8-invoice-style';
 sheet.textContent=[
 '#pfm-v8-invoice{display:block!important;max-width:100%}',
 '#pfm-v8-invoice .pfm-v8-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:12px 0}',
 '#pfm-v8-invoice .pfm-v8-fields label{display:flex;flex-direction:column;gap:5px;min-width:0;font-size:12px;font-weight:650}',
 '#pfm-v8-invoice input,#pfm-v8-invoice select{width:100%;max-width:100%;min-height:39px;min-width:0}',
 '#pfm-v8-invoice .pfm-v8-line{border:1px solid #bfd5e6;border-radius:10px;padding:12px;margin:12px 0;background:#f6faff}',
 '#pfm-v8-invoice .pfm-v8-linehead{display:flex;align-items:center;justify-content:space-between}',
 '#pfm-v8-invoice .pfm-v8-line-actions{display:flex;align-items:center;gap:8px}',
 '#pfm-v8-invoice .pfm-v8-line[data-draft-saved="true"]{border-color:#258168}',
 '#pfm-v8-invoice [hidden]{display:none!important}',
 '#pfm-v8-invoice .v81-shared,#pfm-v8-invoice .v81-asset{grid-column:1/-1;padding:10px;border:1px solid #c5d6e2;border-radius:8px}',
 '#pfm-v8-invoice .v81-shared-cycles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}',
 '#pfm-v8-invoice .v81-shared-cycles label{display:flex;flex-direction:row;align-items:center}',
 '#pfm-v8-invoice .v81-shared-cycles input{min-height:0;width:auto}',
 '#pfm-v8-invoice-status[data-valid="false"]{color:#b91c1c}',
 '#pfm-v8-saved-lines{margin-top:12px;border:1px solid #b4d9cf;background:#f6fcfa}',
 '#pfm-v8-invoice-status[data-valid="true"]{color:#047857}',
 '@media(max-width:620px){#pfm-v8-invoice .pfm-v8-fields{grid-template-columns:1fr}}',
 // Hide duplicate entry forms only. Existing stock movement and reports are retained.
 '#pfm75-expenses > .panel:not(#pfm-v8-invoice),#pfm75-lots-form > #v410-lot-panel > .v410-grid,#pfm75-lots-form > #v410-lot-panel > .actions,#pfm75-cycle-expenses{display:none!important}',
 '#v410SaveChicks,#v410SaveExpense,#v410CreateLot,#finance [onclick="addFinanceExpense()"],#finance .field:has(> #financeExpenseType),#finance .field:has(> #financeExpenseAmount){display:none!important}'
 ].join('\n');document.head.appendChild(sheet);
 $('pfm-v8-date').value=new Date().toISOString().slice(0,10);
 $('pfm-v8-lines').appendChild(line());refresh();
 $('pfm-v8-farm').addEventListener('change',()=>{$('pfm-v8-lines').querySelectorAll('.pfm-v8-line').forEach(scope)});
 $('pfm-v8-add').addEventListener('click',()=>{if($('pfm-v8-lines').querySelectorAll('.pfm-v8-line').length<60)$('pfm-v8-lines').appendChild(line())});
 $('pfm-v8-preview').addEventListener('click',preview);
 $('pfm-v8-submit').addEventListener('click',submit);
 $('pfm-v8-saved-lines').addEventListener('click',e=>{
  const edit=e.target.closest('[data-v8-edit-draft]'),remove=e.target.closest('[data-v8-remove-draft]');
  try{if(edit)editDraft(edit.dataset.v8EditDraft);else if(remove)deleteDraft(remove.dataset.v8RemoveDraft)}
  catch(err){status(err.message,false)}
 });
 $('v53-nav')?.addEventListener('click',e=>{if(e.target?.closest('[onclick*="inventory"]'))refresh()});
 // Dashboard shortcuts can open Purchases without a navigation click.
 // Refresh farm/cycle options when the already-existing screen becomes active.
 const inventory=$('inventory');
 if(inventory&&typeof MutationObserver==='function'){
  new MutationObserver(()=>{if(inventory.classList.contains('active'))refresh()})
   .observe(inventory,{attributes:true,attributeFilter:['class']});
 }
 // Activate only after every unified-entry dependency and control is mounted.
 window.PFMV8SingleEntryActive=true;
 // The new unified farm sections extend the approved one-invoice UI without
 // changing its financial commit, validation or existing source records.
 if(!document.getElementById('pfm-v8-workspace-loader')){
  const script=document.createElement('script');
  script.id='pfm-v8-workspace-loader';
  script.src='./pfm-v8-purchases-workspace.js';
  document.head.appendChild(script);
 }
 ready=true;return true;
}
let attempts=0;const timer=setInterval(()=>{if(install()||++attempts>=100)clearInterval(timer)},300);
})();