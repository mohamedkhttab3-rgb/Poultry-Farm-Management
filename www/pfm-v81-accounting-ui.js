/* V8.1 accounting companion to the ONE unified purchases page.
 * No duplicate expense entry: asset purchases are in the same invoice UI;
 * this panel only posts monthly depreciation by beneficiary cycle.
 */
(function(){'use strict';
const $=id=>document.getElementById(id);
const en=()=>document.documentElement.lang==='en';
const tr=(a,b)=>en()?b:a;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let ready=false,busy=false;
const core=()=>window.PFMV81Accounting;
const farm=()=>$('pfm-v8-farm')?.value||'';
function refresh(){
 if(!ready)return;
 const selected=farm(),assets=(db.v410?.assets||[]).filter(a=>a.farmId===selected);
 const select=$('pfm-v81-asset'),prior=select.value;
 select.innerHTML=assets.map(a=>'<option value="'+esc(a.id)+'">'+esc(a.item+' — '+a.invoice+' — '+a.cost+' '+a.currency)+'</option>').join('');
 if(assets.some(a=>a.id===prior))select.value=prior;
 const target=$('pfm-v81-targets'),selectedCycles=new Set([...target.querySelectorAll('[data-cycle]')].filter(x=>x.checked).map(x=>x.value));
 target.innerHTML=(db.cycles||[]).filter(c=>c.farmId===selected&&db.v410?.close?.[c.id]?.status!=='closed')
 .map(c=>'<label><input type="checkbox" data-cycle value="'+esc(c.id)+'" '+(selectedCycles.has(c.id)?'checked':'')+'><span>'+esc((typeof getHouseName==='function'?getHouseName(c.houseId):c.houseId)+' — '+c.date+' ('+c.birds+')')+'</span></label>').join('');
 render();
}
function render(){
 const target=$('pfm-v81-allocations');if(!target)return;
 const records=(db.v410?.sharedExpenses||[]).filter(x=>x.farmId===farm()),posted=(db.v410?.depreciationPostings||[]).filter(x=>x.farmId===farm());
 const rows=[...records.map(x=>({label:tr('مشترك: ','Shared: ')+x.category,date:x.date,amount:x.cost,allocations:x.allocations})),
 ...posted.map(x=>({label:tr('إهلاك: ','Depreciation: ')+(db.v410.assets||[]).find(a=>a.id===x.assetId)?.item,date:x.date,amount:x.amount,allocations:x.allocations}))];
 target.innerHTML=rows.length?'<div style="overflow:auto"><table><thead><tr><th>'+tr('البند','Item')+'</th><th>'+tr('التاريخ','Date')+'</th><th>'+tr('القيمة','Amount')+'</th><th>'+tr('حصة كل عنبر','House allocation')+'</th></tr></thead><tbody>'+
 rows.map(x=>'<tr><td>'+esc(x.label)+'</td><td>'+esc(x.date)+'</td><td>'+Number(x.amount).toFixed(2)+'</td><td>'+esc((x.allocations||[]).map(a=>((typeof getHouseName==='function'?getHouseName((db.cycles||[]).find(c=>c.id===a.cycleId)?.houseId):a.cycleId)+': '+Number(a.amount).toFixed(2))).join(' | '))+'</td></tr>').join('')+'</tbody></table></div>':
 '<p class="muted">'+tr('لا توجد تخصيصات مشتركة أو قيود إهلاك بعد.','No shared allocations or posted depreciation yet.')+'</p>';
}
function submit(){
 if(busy)return;
 busy=true;
 const btn=$('pfm-v81-post');btn.disabled=true;
 try{
  const ids=[...$('pfm-v81-targets').querySelectorAll('[data-cycle]:checked')].map(x=>x.value);
  const id=$('pfm-v81-asset').value,method=$('pfm-v81-method').value,month=$('pfm-v81-month').value;
  const entry=core().postDepreciation(db,{assetId:id,cycleIds:ids,method,month},{
   uuid:()=>uuid(),persist:()=>save(),userId:currentUser?.id||null,
   currentMonth:new Date().toISOString().slice(0,7),
   canFinance:f=>!!currentUser&&can('finance',f)
  });
  $('pfm-v81-state').textContent=tr('تم قيد إهلاك الشهر مرة واحدة: ','Depreciation posted once: ')+entry.amount.toFixed(2);
  render();
  if(typeof renderFinance==='function')renderFinance();
 }catch(err){$('pfm-v81-state').textContent=tr('لم يتم القيد: ','Not posted: ')+err.message}
 finally{busy=false;btn.disabled=false}
}
function financialReport(){
 const prev=renderReport;
 renderReport=function(){
  const result=prev.apply(this,arguments);
  const c=typeof cyc==='function'?cyc($('reportCycle')?.value):null,report=$('printReport')?.querySelector('.report');
  if(!c||!report)return result;
  const old=report.querySelector('.pfm-v81-cost-report');if(old)old.remove();
  const a=core().charges(db,c.id),x=calc(c),cur=typeof getCycleCurrency==='function'?getCycleCurrency(c):'SAR';
  const rows=[
   [tr('كتاكيت','Chicks'),Number(db.finance?.[c.id]?.chicks||0)],
   [tr('أعلاف مستهلكة','Feed issued'),x.fc],
   [tr('أدوية وتحصينات','Medicines'),x.meds],
   [tr('مصروفات مباشرة','Direct expenses'),x.expenseTotal],
   [tr('حصة المصروفات المشتركة','Shared farm allocations'),a.shared],
   [tr('الإهلاك الشهري المُحمّل','Posted depreciation'),a.depreciation]
  ];
  const panel=document.createElement('section');panel.className='pfm-v81-cost-report';
  panel.style.cssText='margin:12px 0;break-inside:avoid;page-break-inside:avoid';
  panel.innerHTML='<h3>'+tr('تفصيل تكاليف الدورة والعنبر — V8.1','House & cycle cost reconciliation — V8.1')+'</h3>'+
  '<table><thead><tr><th>'+tr('بند التكلفة','Cost category')+'</th><th>'+tr('القيمة','Amount')+' ('+esc(cur)+')</th></tr></thead><tbody>'+
  rows.map(([name,value])=>'<tr><td>'+esc(name)+'</td><td>'+Number(value).toFixed(2)+'</td></tr>').join('')+
  '<tr><th>'+tr('إجمالي التكلفة','Total cost')+'</th><th>'+x.cost.toFixed(2)+'</th></tr>'+
  '<tr><th>'+tr('إجمالي الإيراد','Total revenue')+'</th><th>'+x.rev.toFixed(2)+'</th></tr>'+
  '<tr><th>'+tr('الربح / الخسارة','Profit / loss')+'</th><th>'+x.profit.toFixed(2)+'</th></tr></tbody></table>'+
  '<p class="muted">'+tr('فواتير المشتريات لا تُحسب مرتين. الإهلاك يدخل عند ترحيل قيد الشهر فقط؛ المبيعات السابقة تظل بتكلفتها المجمدة.','Purchase invoices are counted once. Depreciation enters only when posted. Historical sales retain frozen margins.')+'</p>';
  const signature=report.querySelector('.signature-page');if(signature)signature.before(panel);else report.appendChild(panel);
  return result;
 };
}
function install(){
 if(ready||!core()||!$('pfm-v8-invoice')||!window.PFMV8SingleEntryActive)return false;
 const panel=document.createElement('details');panel.id='pfm-v81-accounting';panel.className='panel';
 panel.innerHTML='<summary>'+tr('توزيع المصروفات والإهلاك — السجل المالي','Shared allocation & depreciation ledger')+'</summary>'+
 '<p class="muted">'+tr('المصروف المشترك والأصل يُسجلان أعلاه في فاتورة واحدة. هنا ترحّل حصة الإهلاك الشهري فقط، دون تسجيل فاتورة جديدة.','Shared costs and assets are purchased through the ONE invoice above. Post only monthly depreciation here; no second invoice.')+'</p>'+
 '<div class="pfm-v8-fields"><label><span>'+tr('الأصل الثابت','Fixed asset')+'</span><select id="pfm-v81-asset"></select></label>'+
 '<label><span>'+tr('شهر الإهلاك','Depreciation month')+'</span><input id="pfm-v81-month" type="month"></label>'+
 '<label><span>'+tr('أساس التوزيع','Allocation basis')+'</span><select id="pfm-v81-method"><option value="equal">'+tr('بالتساوي','Equal')+'</option><option value="birds">'+tr('حسب الطيور','By birds')+'</option></select></label></div>'+
 '<p>'+tr('العنابر المستفيدة','Beneficiary houses')+'</p><div id="pfm-v81-targets"></div>'+
 '<div class="actions"><button type="button" class="btn primary" id="pfm-v81-post">'+tr('ترحيل إهلاك الشهر مرة واحدة','Post monthly depreciation once')+'</button></div>'+
 '<p role="status" aria-live="polite" id="pfm-v81-state"></p><h4>'+tr('التوزيعات والقيود المالية','Allocations & financial postings')+'</h4><div id="pfm-v81-allocations"></div>';
 $('pfm-v8-invoice').appendChild(panel);
 const css=document.createElement('style');css.textContent='#pfm-v81-targets{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px}#pfm-v81-targets label{display:flex;flex-direction:row;gap:7px;align-items:center}#pfm-v81-targets input{width:auto;min-height:0}@media(max-width:620px){#pfm-v81-targets{grid-template-columns:1fr}}';document.head.appendChild(css);
 $('pfm-v81-month').value=new Date().toISOString().slice(0,7);
 $('pfm-v81-post').addEventListener('click',submit);
 $('pfm-v8-farm').addEventListener('change',refresh);
 $('pfm-v81-accounting').addEventListener('toggle',()=>{if(panel.open)refresh()});
 ready=true;refresh();financialReport();return true;
}
let n=0;const task=setInterval(()=>{if(install()||++n>150)clearInterval(task)},200);
})();
