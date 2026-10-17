/* Android-only V7.3: navigation, recording selectors, scope summaries.
   This script does not write app data or change shared Windows calculations. */
(function(){'use strict';
if(!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform() && window.Capacitor.getPlatform()==='android'))return;
const byId=id=>document.getElementById(id);
const data=()=>typeof db==='undefined'?null:db;
const format=n=>(Number(n)||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const scope=c=>typeof window.PFMGlobalCycleScope==='function'?window.PFMGlobalCycleScope(c):true;
const numCycle=c=>typeof cycleOrdinal==='function'?cycleOrdinal(c):(c.cycleNumber||'?');
function style(){
 if(byId('pfm73-mobile-css'))return;
 const sheet=document.createElement('style');sheet.id='pfm73-mobile-css';
 sheet.textContent=[
 'html.pfm72-android-native .pfm57-toolbar{box-sizing:border-box!important;width:100%!important;max-width:100%!important;overflow:visible!important;touch-action:auto!important}',
 'html.pfm72-android-native .pfm57-toolbar .pfm57-fields{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;direction:rtl!important;min-width:0!important;width:100%!important;gap:8px!important;align-items:end!important;white-space:normal!important}',
 'html.pfm72-android-native .pfm57-toolbar .pfm57-field{flex:none!important;min-width:0!important;width:100%!important;max-width:100%!important;overflow:visible!important}',
 'html.pfm72-android-native .pfm57-toolbar .pfm57-search{grid-column:1/-1!important;min-width:0!important;max-width:100%!important}',
 'html.pfm72-android-native .pfm57-toolbar select,html.pfm72-android-native .pfm57-toolbar input{width:100%!important;min-width:0!important;max-width:100%!important}',
 'html.pfm72-android-native .pfm57-toolbar .pfm57-fields>button{flex:none!important;min-width:0!important;width:100%!important;max-width:100%!important;white-space:nowrap!important;padding:0 3px!important;font-size:12px!important;min-height:42px!important}',
 'html.pfm72-android-native .view .panel:has(>table),html.pfm72-android-native .table-scroll,html.pfm72-android-native .v52-table-overflow,html.pfm72-android-native .v410-table-scroll{max-width:100%;overflow-x:auto!important;-webkit-overflow-scrolling:touch;touch-action:pan-x pan-y}',
 'html.pfm72-android-native .view .panel:has(>table)>table,html.pfm72-android-native .table-scroll>table,html.pfm72-android-native .v52-table-overflow>table{width:max-content!important;min-width:100%!important;max-width:none!important}',
 'html.pfm72-android-native .view .panel:has(>table)>table td,html.pfm72-android-native .view .panel:has(>table)>table th{white-space:nowrap}',
 'html.pfm72-android-native #finance #finFilterFarm,html.pfm72-android-native #finance #finFilterHouse{display:none!important}',
 'html.pfm72-android-native #finance #finFilterFarm:where(select),html.pfm72-android-native #finance #finFilterHouse:where(select){pointer-events:none}',
 'html.pfm72-android-native .pfm73-scope-summary{border:1px solid #d2e0ec;background:#fff;border-radius:13px;padding:13px;margin:12px 0 16px}',
 'html.pfm72-android-native .pfm73-scope-summary h3{font-size:16px;margin:0 0 8px;color:#15486d}',
 'html.pfm72-android-native .pfm73-scope-summary p{font-size:12px;color:#527085;line-height:1.8;margin:7px 0}',
 'html.pfm72-android-native .pfm73-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}',
 'html.pfm72-android-native .pfm73-cards>div{border:1px solid #e0eaf1;border-radius:9px;padding:10px;min-width:0}',
 'html.pfm72-android-native .pfm73-cards b{display:block;margin-top:6px;font-size:16px;overflow-wrap:anywhere}',
 'html.pfm72-android-native #pfm73-sale-selectors{display:contents}'
 ].join('\n');document.head.appendChild(sheet);
}
function nav(){
 const n=byId('v53-nav'),purchase=n?.querySelector('[data-v55-group="nutrition"]'),daily=n?.querySelector('[data-v55-group="daily"]');
 if(!n||!purchase||!daily)return;
 const pt=purchase.querySelector('.v55-group-title'),dt=daily.querySelector('.v55-group-title');
 if(pt){pt.dataset.v55Ar='المشتريات';pt.dataset.v55En='Purchases';pt.textContent=document.documentElement.lang==='en'?'Purchases':'المشتريات';}
 if(dt){dt.dataset.v55Ar='المتابعة اليومية للدورات';dt.dataset.v55En='Daily Cycle Monitoring';dt.textContent=document.documentElement.lang==='en'?'Daily Cycle Monitoring':'المتابعة اليومية للدورات';}
 const items=purchase.querySelector('.v55-nav-items'),dailyItems=daily.querySelector('.v55-nav-items');
 if(items&&dailyItems){
   // Inspect the actual onclick values rather than an escaped CSS attribute
   // selector, which was silently failing on Android WebView.
   const buttons=[...n.querySelectorAll('.v55-nav-items > button')];
   const find=screen=>buttons.find(b=>(b.getAttribute('onclick')||'').includes("show('"+screen+"'"));
   for(const screen of ['feed','meds','inventory']){const b=find(screen);if(b)items.appendChild(b);}
   for(const screen of ['daily','weights']){const b=find(screen);if(b)dailyItems.appendChild(b);}
   // Do not duplicate any screen or move financial/administrative screens.
   ['feed','meds','inventory'].forEach(screen=>{const b=find(screen);if(b&&b.parentElement===items)items.appendChild(b);});
   ['daily','weights'].forEach(screen=>{const b=find(screen);if(b&&b.parentElement===dailyItems)dailyItems.appendChild(b);});
 }
 if(purchase.nextElementSibling!==daily)n.insertBefore(purchase,daily);
}

function brand(){
 const approved='Poultry Farm Management M.K™';
 const login=document.querySelector('.pfm72-mobile-brand small');
 if(login)login.textContent=approved;
 const identity=document.querySelector('.pfm53-identity');
 if(identity){
   const smalls=[...identity.querySelectorAll('small')];
   if(smalls[0])smalls[0].textContent=approved;
   for(const extra of smalls.slice(1))if(/^\s*M\.K™\s*$/.test(extra.textContent))extra.remove();
 }
 const foot=byId('pfmLoginFootText');if(foot)foot.textContent=approved;
}

function options(sel,rows,idFn,labelFn,previous){
 if(!sel)return '';
 sel.replaceChildren();
 for(const rec of rows)sel.add(new Option(labelFn(rec),String(idFn(rec))));
 if(previous && rows.some(r=>String(idFn(r))===String(previous)))sel.value=String(previous);
 return sel.value;
}
let recordingCycle='';
function salesControls(){
 const sales=byId('sales'),cycle=byId('saleCycle'),d=data();
 if(!sales||!cycle||!d)return;
 let farm=byId('pfm73-sale-farm'),house=byId('pfm73-sale-house');
 if(!farm||!house){
  const fields=document.createElement('div');fields.id='pfm73-sale-selectors';fields.className='pfm73-sale-selectors';
  const farmField=document.createElement('div');farmField.className='field';
  const farmLabel=document.createElement('label');farmLabel.textContent='المزرعة *';
  farm=document.createElement('select');farm.id='pfm73-sale-farm';farmField.append(farmLabel,farm);
  const houseField=document.createElement('div');houseField.className='field';
  const houseLabel=document.createElement('label');houseLabel.textContent='العنبر *';
  house=document.createElement('select');house.id='pfm73-sale-house';houseField.append(houseLabel,house);
  fields.append(farmField,houseField);
  // Sales hierarchy follows the approved cycle → farm → house order.
  cycle.closest('.field')?.after(fields);
  farm.addEventListener('change',()=>refreshSalesCascade(false,true));
  house.addEventListener('change',()=>refreshSalesCascade(false,false));
  cycle.addEventListener('change',()=>{
   recordingCycle=cycle.value;
   const chosen=data()?.cycles?.find(c=>c.id===recordingCycle);
   if(chosen){
    farm.value=String(chosen.farmId);
    const d=data();
    options(house,(d?.houses||[]).filter(h=>h.farmId===farm.value),h=>h.id,h=>h.name,chosen.houseId);
   }
   if(typeof updateSaleBirdsFromCycle==='function')updateSaleBirdsFromCycle();
  },false);
 }
 const selected=recordingCycle||cycle.value;
 const active=d.cycles.find(c=>c.id===selected);
 const preserveFarm=active?.farmId||farm.value;
 options(farm,d.farms||[],f=>f.id,f=>f.name,preserveFarm);
 const chosenHouse=active?.houseId||house.value;
 options(house,(d.houses||[]).filter(h=>h.farmId===farm.value),h=>h.id,h=>h.name,chosenHouse);
 const relevant=(d.cycles||[]).filter(c=>c.farmId===farm.value&&c.houseId===house.value)
   .sort((a,b)=>Number(numCycle(a))-Number(numCycle(b))||String(a.date).localeCompare(String(b.date)));
 options(cycle,relevant,c=>c.id,c=>'الدورة '+numCycle(c)+' — '+(c.date||'')+(c.breed?' — '+c.breed:''),selected);
 recordingCycle=cycle.value;
 if(typeof updateCurrencyLabels==='function')updateCurrencyLabels();
}
function refreshSalesCascade(keepCycle,changedFarm){
 const d=data(),farm=byId('pfm73-sale-farm'),house=byId('pfm73-sale-house'),cycle=byId('saleCycle');
 if(!d||!farm||!house||!cycle)return;
 if(changedFarm)options(house,(d.houses||[]).filter(h=>h.farmId===farm.value),h=>h.id,h=>h.name,'');
 const relevant=(d.cycles||[]).filter(c=>c.farmId===farm.value&&c.houseId===house.value)
  .sort((a,b)=>Number(numCycle(a))-Number(numCycle(b))||String(a.date).localeCompare(String(b.date)));
 options(cycle,relevant,c=>c.id,c=>'الدورة '+numCycle(c)+' — '+(c.date||'')+(c.breed?' — '+c.breed:''),keepCycle?recordingCycle:'');
 recordingCycle=cycle.value;
 if(typeof updateCurrencyLabels==='function')updateCurrencyLabels();
 if(typeof updateSaleBirdsFromCycle==='function')updateSaleBirdsFromCycle();
}
function summaryNode(screen,id,title){
 let node=byId(id);
 if(!node){
  node=document.createElement('section');node.className='pfm73-scope-summary';node.id=id;
  const anchor=byId(screen)?.querySelector('.pfm57-toolbar')||byId(screen)?.querySelector('h2');
  anchor?.after(node);
 }
 const heading=document.createElement('h3');heading.textContent=title;
 node.replaceChildren(heading);
 return node;
}
function renderCards(node,entries,note){
 const p=document.createElement('p');p.textContent=note;node.appendChild(p);
 const cards=document.createElement('div');cards.className='pfm73-cards';
 for(const [k,v] of entries){
  const card=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b');
  label.textContent=k;value.textContent=String(v);card.append(label,value);cards.appendChild(card);
 }
 node.appendChild(cards);
}
function salesSummary(){
 const d=data();if(!d||!byId('sales'))return;
 const node=summaryNode('sales','pfm73-sales-summary','ملخص المبيعات حسب الشريط العلوي');
 const cycles=new Map((d.cycles||[]).filter(scope).map(c=>[c.id,c]));
 const groups=new Map();let count=0,birds=0,kilos=0;
 for(const sale of d.sales||[]){
  const c=cycles.get(sale.cycleId);if(!c)continue;
  count++;birds+=Number(sale.birds)||0;
  kilos+=Number(sale.weightKg)||(sale.weightUnit==='bird'?(Number(sale.birds)||0)*(Number(sale.avgWeight)||0):Number(sale.weightQty)||0);
  const currency=sale.currency||c.currency||'SAR';
  groups.set(currency,(groups.get(currency)||0)+(typeof saleRowRevenue==='function'?saleRowRevenue(sale):(Number(sale.total)||0)));
 }
 const values=[['عمليات البيع',count],['الطيور المباعة',birds.toLocaleString('en-US')],['الوزن المباع (كجم)',format(kilos)]];
 for(const [cur,total] of groups)values.push(['إجمالي الإيرادات ('+cur+')',format(total)]);
 if(!groups.size)values.push(['إجمالي الإيرادات','لا توجد مبيعات ضمن النطاق']);
 renderCards(node,values,'التقرير يجمع النطاق المحدد فوق؛ تسجيل بيع جديد مربوط بالمزرعة والعنبر والدورة المختارة داخل النموذج.');
}
function financeSummary(){
 const d=data();if(!d||!byId('finance')||typeof calc!=='function')return;
 const node=summaryNode('finance','pfm73-finance-summary','الإجماليات المالية حسب الشريط العلوي');
 const groups=new Map();let count=0;
 for(const c of d.cycles||[]){
  if(!scope(c))continue;count++;const z=calc(c),currency=typeof getCycleCurrency==='function'?getCycleCurrency(c):(c.currency||'SAR');
  const v=groups.get(currency)||{cost:0,rev:0,profit:0};v.cost+=Number(z.cost)||0;v.rev+=Number(z.rev)||0;v.profit+=Number(z.profit)||0;groups.set(currency,v);
 }
 const values=[['الدورات ضمن النطاق',count]];
 for(const [cur,x] of groups)values.push(['التكاليف ('+cur+')',format(x.cost)],['الإيرادات ('+cur+')',format(x.rev)],['الربح/الخسارة ('+cur+')',format(x.profit)]);
 if(!groups.size)values.push(['النتيجة','لا توجد دورات ضمن النطاق']);
 renderCards(node,values,'هذه إجماليات العرض والتقرير؛ بيانات إدخال المصروفات مرتبطة بالدورة المختارة داخل النموذج. العملات المختلفة لا تُجمع معًا.');
}
function hideLegacyFinanceScopes(){
 for(const id of ['finFilterFarm','finFilterHouse']){
  const s=byId(id);if(!s)continue;
  if(s.querySelector('option[value=""]'))s.value='';
  if(s.multiple)for(const o of s.options)o.selected=false;
  const field=s.closest('.field');if(field)field.style.display='none';
 }
 const hint=byId('financeScopeHint');if(hint)hint.style.display='none';
}
/* Android PDF draws a WebView with SCREEN media, unlike Chrome's print engine.
   Re-target print-only styles to screen for this one, isolated HTML export.
   Without this, the full-size source logo appears across pages and report
   tables/charts lose their layout. Windows and browser output stay unchanged. */
function prepareAndroidPDF(html){
 let report=String(html)
   .replace(/Poultry Farm Manager(?: · M\.K™)?/g,'Poultry Farm Management M.K™')
   .replace(/@media\s+print\b/gi,'@media screen');
 const override='<style id="pfm-android-pdf-layout">'+
  'html,body{margin:0!important;padding:0!important;background:#fff!important;height:auto!important;overflow:visible!important}'+
  'body.pfm59-printing #pfm59PrintRoot{display:block!important;position:static!important;visibility:visible!important;width:100%!important;height:auto!important;max-height:none!important;overflow:visible!important;font-family:Tahoma,Arial,sans-serif!important;color:#18314e!important}'+
  '#pfm59PrintRoot .pfm59-print-head{display:flex!important;align-items:center!important;gap:14px!important;padding:0 0 10px!important;border-bottom:2px solid #173a63!important}'+
  '#pfm59PrintRoot .pfm59-print-brand{display:flex!important;align-items:center!important;gap:12px!important}'+
  '#pfm59PrintRoot .pfm59-print-brand img{display:block!important;flex:none!important;width:48px!important;height:48px!important;max-width:48px!important;max-height:48px!important;object-fit:contain!important}'+
  '#pfm59PrintRoot .pfm59-print-footer{display:none!important}'+
  '#pfm59PrintRoot table{width:100%!important;border-collapse:collapse!important}'+
  '#pfm59PrintRoot th,#pfm59PrintRoot td{border:1px solid #dae4ed!important;padding:5px!important;font-size:10px!important;vertical-align:top!important;overflow-wrap:anywhere!important}'+
  '#pfm59PrintRoot .pfm59-print-scopes{display:flex!important;flex-wrap:wrap!important;gap:12px!important;margin:0 0 13px!important}'+
  '#pfm59PrintRoot img:not(.pfm59-print-brand img){max-width:100%!important;height:auto!important}'+
  '</style>';
 if(!/<\/head>/i.test(report))throw Error('Invalid printable document: head is missing');
 return report.replace(/<\/head>/i,override+'</head>');
}
window.PFMAndroidPrintLayout=prepareAndroidPDF;

function init(){
 document.documentElement.classList.add('pfm72-android-native');style();nav();brand();
 if(window.PFMAndroidExport && typeof window.PFMAndroidExport.printHTML==='function'){
  const originalPDF=window.PFMAndroidExport.printHTML;
  if(!originalPDF.__pfm73){
   function correctedPDF(html,name){
    return originalPDF.call(this,prepareAndroidPDF(html),name);
   }
   correctedPDF.__pfm73=true;window.PFMAndroidExport.printHTML=correctedPDF;
  }
 }
 const originalSales=window.renderSales;
 if(typeof originalSales==='function'&&!originalSales.__pfm73){
  function patchedSales(){const out=originalSales.apply(this,arguments);salesControls();salesSummary();return out;}
  patchedSales.__pfm73=true;window.renderSales=patchedSales;
 }
 const originalFinance=window.renderFinance;
 if(typeof originalFinance==='function'&&!originalFinance.__pfm73){
  function patchedFinance(){hideLegacyFinanceScopes();const out=originalFinance.apply(this,arguments);financeSummary();return out;}
  patchedFinance.__pfm73=true;window.renderFinance=patchedFinance;
 }
 salesControls();hideLegacyFinanceScopes();salesSummary();financeSummary();
 document.addEventListener('change',e=>{
  if(e.target.closest('.pfm57-toolbar')&&['cycle','farm','house'].includes(e.target.dataset.pfm57Role)){
   setTimeout(()=>{salesSummary();financeSummary();},0);
  }
 });
 setInterval(brand,3000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();