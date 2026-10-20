/* Single V8 purchase intake for Android, Windows and iOS.
 * Does not change old ledgers or calculations. Uses PFMV8InvoiceCore.commit. */
(function(){'use strict';
const $=id=>document.getElementById(id);
const tr=(ar,en)=>document.documentElement.lang==='en'?en:ar;
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kinds=[['feed','أعلاف','Feed'],['chicks','صيصان','Chicks'],['med','أدوية','Medicines'],['vaccine','تحصينات','Vaccines'],['disinfectant','مطهرات','Disinfectants'],['bedding','نشارة','Bedding'],['rent','إيجار','Rent'],['diesel','ديزل','Diesel'],['electricity','كهرباء','Electricity'],['water','مياه','Water'],['labor','عمال','Labor'],['transport','نقل','Transport'],['loading','تحميل','Loading'],['equipment_rent','إيجار معدات','Equipment rental'],['other','أخرى','Other']];
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
 const kind=field(el,'kind').value,chick=kind==='chicks',direct=!chick&&!stocked.has(kind);
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
 el.innerHTML='<div class="pfm-v8-linehead"><b>'+tr('بند مشتريات','Purchase item')+'</b><button type="button" data-remove>'+tr('حذف','Remove')+'</button></div><div class="pfm-v8-fields">'+
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
 inp('note','ملاحظات','Notes')+'</div>';
 el.querySelector('[data-remove]').addEventListener('click',()=>{if($('pfm-v8-lines').children.length>1)el.remove()});
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
 history();
}
function input(){
 const get=key=>$(key)?.value||'';
 return {farmId:farm(),invoice:get('pfm-v8-invoice-no'),supplier:get('pfm-v8-supplier'),
  date:get('pfm-v8-date'),lines:[...$('pfm-v8-lines').children].map(el=>{
   const o={};for(const key of ['kind','item','quantity','unit','priceMode','amount','discount','vatMode','vatRate','reclaim','cycleId','cycleNumber','free','freight','note'])o[key]=field(el,key)?.value??'';return o;
  })};
}
function accounting(){
 const core=window.PFM74PurchaseCore;
 return {uuid:()=>uuid(),price:core.price,shares:core.shares,
  normalizeExpenses:normalizeFinanceExpenses,
  canFinance:id=>!!currentUser&&can('finance',id),
  cycleOrdinal:ordinal,userId:currentUser?.id||null,
  currency:id=>typeof getCycleCurrency==='function'?getCycleCurrency(db.cycles.find(c=>c.id===id)):db.settings?.currency,
  persist:()=>{if(typeof save!=='function')throw Error('Save unavailable');save();}};
}
function status(message,ok){const el=$('pfm-v8-invoice-status');el.textContent=message;el.dataset.valid=ok?'true':'false'}
function preview(){
 try{
  const doc=window.PFMV8InvoiceCore.prepare(db,input(),accounting()).document;
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
  const doc=window.PFMV8InvoiceCore.commit(db,input(),accounting());
  // Clear financial form cache after successful commit; never mutate sales snapshots.
  if(typeof financeDraftExpenses!=='undefined'){
   for(const c of db.cycles||[]){
    if(doc.lines.some(l=>l.cycleId===c.id||l.allocatedCycles?.some(x=>x.cycleId===c.id)))
     financeDraftExpenses[c.id]=normalizeFinanceExpenses(db.finance[c.id]||{});
   }
  }
  status(tr('تم الحفظ بنجاح: ','Saved successfully: ')+doc.invoice,true);
  $('pfm-v8-invoice-no').value='';$('pfm-v8-lines').replaceChildren(line());history();
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
 '#pfm-v8-invoice [hidden]{display:none!important}',
 '#pfm-v8-invoice-status[data-valid="false"]{color:#b91c1c}',
 '#pfm-v8-invoice-status[data-valid="true"]{color:#047857}',
 '@media(max-width:620px){#pfm-v8-invoice .pfm-v8-fields{grid-template-columns:1fr}}',
 // Hide duplicate entry forms only. Existing stock movement and reports are retained.
 '#pfm75-expenses > .panel:not(#pfm-v8-invoice),#pfm75-lots-form > #v410-lot-panel > .v410-grid,#pfm75-lots-form > #v410-lot-panel > .actions,#pfm75-cycle-expenses{display:none!important}',
 '#v410SaveChicks,#v410SaveExpense,#v410CreateLot,#finance [onclick="addFinanceExpense()"],#finance .field:has(> #financeExpenseType),#finance .field:has(> #financeExpenseAmount){display:none!important}'
 ].join('\n');document.head.appendChild(sheet);
 $('pfm-v8-date').value=new Date().toISOString().slice(0,10);
 $('pfm-v8-lines').appendChild(line());refresh();
 $('pfm-v8-farm').addEventListener('change',()=>{$('pfm-v8-lines').querySelectorAll('.pfm-v8-line').forEach(scope)});
 $('pfm-v8-add').addEventListener('click',()=>{if($('pfm-v8-lines').children.length<60)$('pfm-v8-lines').appendChild(line())});
 $('pfm-v8-preview').addEventListener('click',preview);
 $('pfm-v8-submit').addEventListener('click',submit);
 $('v53-nav')?.addEventListener('click',e=>{if(e.target?.closest('[onclick*="inventory"]'))refresh()});
 ready=true;return true;
}
let attempts=0;const timer=setInterval(()=>{if(install()||++attempts>=100)clearInterval(timer)},300);
})();