/* PFM V5.7 — local-first safe backup, cascade project scoping, search & offline XLSX views.
   Existing storage keys, user data, CRUD functions, cloud config and breed calculations are unchanged. */
(function(){'use strict';
const $=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const en=()=>document.documentElement.lang==='en';
const t=(ar,eng)=>en()?eng:ar;
const today=()=>new Date().toISOString().replace(/[:.]/g,'-');
const state={cycle:'',farm:'',house:'',search:''};
// Search state is scoped per screen, not carried into the next page.
const searchByScreen=Object.create(null);
const searchOpenByScreen=Object.create(null);
const searchLimitByScreen=Object.create(null);
let lastSearchScreen='';
const backupFormat='PFM_BACKUP_V57';
function appData(){return typeof db!=='undefined'?db:null;}
function authed(){return typeof currentUser!=='undefined'&&!!currentUser;}
function copies(o){return JSON.parse(JSON.stringify(o));}
function dataCount(d){return (d?.farms?.length||0)+(d?.houses?.length||0)+(d?.cycles?.length||0);}
function cycleNo(c){return Number(typeof cycleOrdinal==='function'?cycleOrdinal(c):c.cycleNumber)||0;}
function activeCycles(){return (appData()?.cycles||[]);}
function groupMatch(c){return !state.cycle||String(cycleNo(c))===state.cycle;}
function scopeMatch(c){
 if(!c||!groupMatch(c)||(state.farm&&c.farmId!==state.farm)||(state.house&&c.houseId!==state.house))return false;
 // The dashboard keeps its KPI/cards/charts; search selects which cycles they summarize.
 // Search in any other screen never restricts these dashboard calculations.
 const term=searchByScreen.dash||'';
 if(term&&$('dash')?.classList.contains('active')){
  const farm=appData()?.farms?.find(f=>f.id===c.farmId);
  const house=appData()?.houses?.find(h=>h.id===c.houseId);
  const hay=normalizeSearchText([farm?.name,farm?.companyName,house?.name,c.date,c.breed,c.standardBreed,c.id,'الدورة '+cycleNo(c),'cycle '+cycleNo(c),JSON.stringify(c)].join(' '));
  if(!normalizeSearchText(term).trim().split(/\s+/).every(word=>hay.includes(word)))return false;
 }
 return true;
}
window.PFMGlobalCycleScope=scopeMatch;
function farmsInScope(){const d=appData()||{};if(!state.cycle)return d.farms||[];const ids=new Set(activeCycles().filter(groupMatch).map(c=>c.farmId));return (d.farms||[]).filter(f=>ids.has(f.id));}
function housesInScope(){const d=appData()||{};const eligible=new Set(farmsInScope().map(f=>f.id));const allowed=state.cycle?new Set(activeCycles().filter(c=>groupMatch(c)&&(!state.farm||c.farmId===state.farm)).map(c=>c.houseId)):null;return (d.houses||[]).filter(h=>eligible.has(h.farmId)&&(!state.farm||h.farmId===state.farm)&&(!allowed||allowed.has(h.id)));}
function fillList(sel,values,placeholder,value,display){
  if(!sel)return '';
  sel.innerHTML=`<option value="">${safe(placeholder)}</option>`+values.map(v=>`<option value="${safe(value(v))}">${safe(display(v))}</option>`).join('');
  return sel.value;
}
function updateScopeOptions(){
 const activeTool=document.querySelector('main > section.view.active > .pfm57-toolbar');
 if(!activeTool)return;
 const get=role=>activeTool.querySelector('[data-pfm57-role="'+role+'"]');
 const cycle=get('cycle'),farm=get('farm'),house=get('house');
 if(!cycle||!farm||!house)return;
 const numbers=[...new Set(activeCycles().map(cycleNo).filter(n=>n>0))].sort((a,b)=>a-b);
 fillList(cycle,numbers,t('كل الدورات','All cycles'),String,n=>t('الدورة ','Cycle ')+n);
 if(!numbers.some(x=>String(x)===state.cycle))state.cycle='';cycle.value=state.cycle;
 const fs=farmsInScope();
 if(state.farm&&!fs.some(f=>f.id===state.farm))state.farm='';
 fillList(farm,fs,t('كل المزارع','All farms'),f=>f.id,f=>f.name);farm.value=state.farm;
 const hs=housesInScope();if(state.house&&!hs.some(h=>h.id===state.house))state.house='';
 fillList(house,hs,t('كل العنابر','All houses'),h=>h.id,h=>h.name+(state.farm?'':' — '+(appData().farms.find(f=>f.id===h.farmId)?.name||'')));
 house.value=state.house;
 const count=get('count');if(count)count.textContent=t('عدد الدورات في النطاق: ','Cycles in scope: ')+activeCycles().filter(scopeMatch).length;
}
function setCycle(n){state.cycle=n;state.farm='';state.house='';refreshScope();}
function setFarm(n){state.farm=n;state.house='';refreshScope();}
function setHouse(n){state.house=n;refreshScope();}
function refreshScope(){updateScopeOptions();
  // These legacy dashboard selectors do not represent a group of numbered cycles.
  // Reset them and let the dashboard's aggregator honor PFMGlobalCycleScope.
  for(const id of ['dashboardFarm','dashboardHouse','v53Cycle']){const x=$(id);if(x&&x.querySelector('option[value=""]'))x.value='';}
  if($('dash')?.classList.contains('active')&&typeof renderDashboardSelection==='function')renderDashboardSelection();
  if($('performance')?.classList.contains('active')&&typeof renderPerformance==='function')renderPerformance();
  if($('compare')?.classList.contains('active')&&typeof renderComparison==='function')renderComparison();
  if($('finance')?.classList.contains('active')&&typeof renderFinance==='function')renderFinance();
  if(typeof window.v53Render==='function'&&$('dash')?.classList.contains('active'))window.v53Render();
  if($('reports')?.classList.contains('active')&&typeof renderReport==='function'){
    const sel=$('reportCycle');if(sel&&sel.value&&!scopeMatch(activeCycles().find(c=>c.id===sel.value))){const c=activeCycles().find(scopeMatch);if(c){sel.value=c.id;renderReport();}}
  }
  if(['daily','weights','feed','meds','sales'].includes(document.querySelector('main > section.view.active')?.id)&&typeof window.renderAll==='function')window.renderAll();
  else applySearchAndScope();
}
function getCycleForRow(row,tbody){
  const d=appData(),id=row.querySelector('[data-id]')?.dataset.id||'';
  const tableId=tbody?.id||'';
  const recordKey={cycleTable:'cycles',dailyTable:'daily',weightTable:'weights',feedTable:'feed',medTable:'meds',saleTable:'sales'}[tableId];
  if(recordKey&&id){const item=(d[recordKey]||[]).find(x=>x.id===id);return recordKey==='cycles'?item:activeCycles().find(c=>c.id===item?.cycleId);}
  if(tableId==='financeTable'){
    const cells=[...row.cells].map(c=>c.textContent.trim());
    return activeCycles().find(c=>getFarm(c.farmId)===cells[0]&&getHouse(c.houseId)===cells[1]&&String(c.date)===cells[2]);
  }
  return null;
}
function getFarm(id){return appData()?.farms?.find(x=>x.id===id)?.name||'';}
function getHouse(id){return appData()?.houses?.find(x=>x.id===id)?.name||'';}
function tableScope(row,tbody){
  if(!state.cycle&&!state.farm&&!state.house)return true;
  const d=appData(),tableId=tbody?.id||'';
  const c=getCycleForRow(row,tbody);if(c)return scopeMatch(c);
  const id=row.querySelector('[data-id]')?.dataset.id||'';
  if(tableId==='farmTable'){
    const f=d.farms.find(x=>x.id===id);if(!f)return false;
    return (!state.farm||state.farm===f.id)&&(!state.cycle||farmsInScope().some(x=>x.id===f.id))&&(!state.house||d.houses.some(h=>h.id===state.house&&h.farmId===f.id));
  }
  if(tableId==='houseTable'){
    const h=d.houses.find(x=>x.id===id);if(!h)return false;
    return (!state.farm||state.farm===h.farmId)&&(!state.house||state.house===h.id)&&(!state.cycle||housesInScope().some(x=>x.id===h.id));
  }
  if(tableId==='inventoryTable'){
    const i=d.inventory.find(x=>x.id===id);return !i || ((!state.farm||i.farmId===state.farm)&&(!state.cycle||farmsInScope().some(f=>f.id===i.farmId))&&(!state.house||d.houses.some(h=>h.id===state.house&&h.farmId===i.farmId)));
  }
  // Read-only analysis tables are matched using their displayed cycle / farm / house,
  // leaving settings, standards, permissions and logs independent of farming scope.
  if(['performance','compare'].includes(tbody.closest('section.view')?.id)){
    const cells=[...row.cells].map(cell=>cell.textContent.trim());
    const matches=activeCycles().filter(c=>cells.includes(getFarm(c.farmId))&&cells.includes(getHouse(c.houseId))&&cells.includes(c.date));
    if(matches.length)return matches.some(scopeMatch);
  }
  if(tbody.closest('#reports')){const selected=activeCycles().find(c=>c.id===$('reportCycle')?.value);return !selected||scopeMatch(selected);}
  return true;
}
function indexedRowText(row,tbody){
  let s=row.textContent||'';const c=getCycleForRow(row,tbody);
  if(c)s+=' '+getFarm(c.farmId)+' '+getHouse(c.houseId)+' '+(tbody?.id==='cycleTable'?String(c.date):'')+' '+t('الدورة ','Cycle ')+cycleNo(c)+' '+(c.breed||'');
  const id=row.querySelector('[data-id]')?.dataset.id;
  const key={farmTable:'farms',houseTable:'houses',cycleTable:'cycles',dailyTable:'daily',weightTable:'weights',feedTable:'feed',medTable:'meds',saleTable:'sales',inventoryTable:'inventory'}[tbody?.id];
  if(id&&key){const rec=(appData()?.[key]||[]).find(r=>r.id===id);if(rec)s+=' '+JSON.stringify(rec);}
  return s.toLocaleLowerCase();
}
/* Read-only complete search: indexes stored operations, not just the first 150 rendered rows.
   No change is made to CRUD, calculations, or persistent data. */
function normalizeSearchText(v){return String(v??'').toLocaleLowerCase().normalize('NFKC').replace(/[\u064b-\u065f\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');}
const searchSourceMap={
 dash:['farms','houses','cycles','daily','weights','feed','meds','inventory','sales','finance','v410.lots','v410.movements','v410.expenses','v410.chicks','v410.close'],
 farms:['farms'],houses:['houses'],cycles:['cycles'],daily:['daily'],weights:['weights'],
 feed:['feed','v410.movements'],meds:['meds','v410.movements'],
 inventory:['inventory','v410.lots','v410.movements'],
 sales:['sales'],finance:['finance','sales','v410.lots','v410.movements','v410.expenses','v410.chicks','v410.close'],
 performance:['cycles','weights','daily','feed'],standards:['performanceRules','cycles'],
 compare:['cycles','weights','daily','feed','meds','sales'],
 reports:['cycles','daily','weights','feed','meds','sales','finance'],
 settings:['settings'],users:['invitations'],audit:['auditLog'],
 backup:['farms','houses','cycles','daily','weights','feed','meds','inventory','sales','finance','performanceRules','auditLog']
};
const searchTypeNames={farms:'المزارع',houses:'العنابر',cycles:'الدورات',daily:'المتابعة اليومية',weights:'الأوزان الأسبوعية',feed:'الأعلاف',meds:'الأدوية والتحصينات',inventory:'المخزون',sales:'المبيعات والحصاد',finance:'التكاليف والأرباح',performanceRules:'معايير السلالات',auditLog:'سجل التدقيق',invitations:'المستخدمون والصلاحيات',settings:'الإعدادات','v410.lots':'دفعات الشراء','v410.movements':'حركات المخزون','v410.expenses':'تفاصيل المصروفات','v410.chicks':'تكلفة شراء الكتاكيت','v410.close':'إغلاق الدورة'};
function searchItems(key,d){
 const value=key.split('.').reduce((o,k)=>o?.[k],d);
 if(Array.isArray(value))return value.filter(r=>r&&typeof r==='object');
 if((key==='finance'||key==='v410.expenses'||key==='v410.chicks'||key==='v410.close')&&value&&typeof value==='object')return Object.entries(value).filter(([,r])=>r&&typeof r==='object').map(([recordId,record])=>({...record,cycleId:key==='finance'?recordId:(record.cycleId||recordId)}));
 if(key==='settings'&&value&&typeof value==='object')return [value];
 return [];
}
function searchContext(key,record,d){
 const c=key==='cycles'?record:(d.cycles||[]).find(x=>x.id===record.cycleId || (key==='finance'&&x.id===record.id));
 const h=key==='houses'?record:(d.houses||[]).find(x=>x.id===(c?.houseId||record.houseId));
 const f=key==='farms'?record:(d.farms||[]).find(x=>x.id===(c?.farmId||record.farmId||h?.farmId));
 return {c,h,f};
}
function searchRecordInScope(key,r,context,d){
 const {c,h,f}=context;
 if(c)return scopeMatch(c);
 if(!(state.cycle||state.farm||state.house))return true;
 if(f){if(state.farm&&state.farm!==f.id)return false;
   if(state.cycle&&!farmsInScope().some(x=>x.id===f.id))return false;
   if(state.house&&f.id!==(d.houses||[]).find(x=>x.id===state.house)?.farmId)return false;}
 if(h){if(state.house&&h.id!==state.house)return false;
   if(state.cycle&&!housesInScope().some(x=>x.id===h.id))return false;}
 if(!f&&!h&&(state.cycle||state.farm||state.house)&&['inventory','v410.lots','v410.movements','v410.expenses','v410.chicks','v410.close'].includes(key))return false;
 return true;
}
function searchRecordText(key,r,context){
 const {c,h,f}=context;
 const type=searchTypeNames[key]||key;
 return normalizeSearchText([type,JSON.stringify(r),c?'الدورة '+cycleNo(c):'',f?.name||'',h?.name||'',c?.date||'',c?.breed||''].join(' '));
}
function findAllOperations(screen,rawQuery){
 const d=appData();if(!d)return [];
 const words=normalizeSearchText(rawQuery).trim().split(/\s+/).filter(Boolean);
 const result=[];
 for(const key of searchSourceMap[screen]||[]){
  for(const r of searchItems(key,d)){
   if(key==='v410.movements'&&screen==='feed'&&r.sourceType!=='feed')continue;
   if(key==='v410.movements'&&screen==='meds'&&!['med','meds','medicine'].includes(r.sourceType))continue;
   const context=searchContext(key,r,d);
   if(!searchRecordInScope(key,r,context,d))continue;
   if(!words.every(w=>searchRecordText(key,r,context).includes(w)))continue;
   result.push({key,r,context});
  }
 }
 return result;
}
function searchSummary(r){
 const ignored=new Set(['id','farmId','houseId','cycleId','userId','createdBy','updatedAt','createdAt','sourceId','sourceType','v410MovementId']);
 return Object.entries(r).filter(([k,v])=>!ignored.has(k)&&v!=null&&v!==''&&typeof v!=='object')
  .slice(0,8).map(([k,v])=>k+': '+String(v)).join(' | ');
}
// V6.9.3: preserve the native screen. Never create a cross-table search result panel.
function showSearchResults(view){
 const panel=view?.querySelector(':scope > .pfm57-search-results');
 if(panel){panel.remove();}
}
function refreshSearchedScreen(section){
 if(!section?.classList.contains('active'))return;
 if(section.id==='dash'){
  if(typeof window.v53Render==='function')window.v53Render();
  applySearchAndScope();
 }else if(['daily','weights','feed','meds','sales'].includes(section.id)&&typeof window.renderAll==='function'){
  // Their original tables support filtering records BEFORE the 150-row rendering limit.
  // The table formatting, edit/delete actions and existing pagination stay unchanged.
  window.renderAll();
 }else applySearchAndScope();
}

function runPageSearch(section){
 if(!section)return;
 const input=section.querySelector('[data-pfm57-role="search"]');
 state.search=(input?.value||'').trim();
 searchByScreen[section.id]=state.search;
 searchOpenByScreen[section.id]=!!state.search;
 refreshSearchedScreen(section);
}

function applySearchAndScope(){
 const active=document.querySelector('main > section.view.active');if(!active)return;
 const query=normalizeSearchText(state.search).trim();
 const words=query.split(/\s+/).filter(Boolean);
 let found=0;
 if(active.id==='dash'){
  // Do not hide any card, panel, graph or table on the dashboard.
  // groupRecords() now uses the matching cycle scope to recalculate all KPI charts.
  const count=activeCycles().filter(scopeMatch).length;
  const target=active.querySelector('[data-pfm57-role="results"]');
  if(target)target.textContent=query?t('الدورات المطابقة للمؤشرات: ','Matching dashboard cycles: ')+count:'';
  return;
 }
 active.querySelectorAll('tbody').forEach(body=>{
  [...body.rows].forEach(row=>{
   const dataRow=!!row.querySelector('[data-id]')||(!/^لا توجد|^No records|^No data/i.test(row.textContent.trim()));
   const hay=normalizeSearchText(indexedRowText(row,body));
   const show=dataRow&&tableScope(row,body)&&(!words.length||words.every(w=>hay.includes(w)));
   row.classList.toggle('pfm57-filtered-out',!show);
   if(dataRow&&show)found++;
  });
 });
 const result=active.querySelector('[data-pfm57-role="results"]');
 if(result)result.textContent=query?t('السجلات المطابقة في جداول هذه الشاشة: ','Matching records in this screen: ')+found:'';
}

function toolbarAnchor(section){
 return section?.id==='dash'?(section.querySelector('#pfm53-topbar')||section.firstElementChild):section?.firstElementChild;
}
function putToolbar(section,tool){
 if(section.id==='dash'){
   const top=section.querySelector('#pfm53-topbar');
   if(top){if(top.nextElementSibling!==tool)top.insertAdjacentElement('afterend',tool);}
   else if(section.firstElementChild!==tool)section.prepend(tool);
 }else if(section.firstElementChild!==tool)section.prepend(tool);
}
function createToolbar(section){
 const tool=document.createElement('div');tool.className='pfm57-toolbar';tool.id='pfm57Toolbar-'+section.id;tool.dataset.pfm57Screen=section.id;tool.dir='rtl';
 tool.innerHTML=`<div class="pfm57-fields">
    <label class="pfm57-field"><span data-pfm57-ar="① الدورة" data-pfm57-en="① Cycle">① الدورة</span><select data-pfm57-role="cycle" aria-label="الدورة"><option value="">كل الدورات</option></select></label>
    <label class="pfm57-field"><span data-pfm57-ar="② المزرعة" data-pfm57-en="② Farm">② المزرعة</span><select data-pfm57-role="farm" aria-label="المزرعة"><option value="">كل المزارع</option></select></label>
    <label class="pfm57-field"><span data-pfm57-ar="③ العنبر" data-pfm57-en="③ House">③ العنبر</span><select data-pfm57-role="house" aria-label="العنبر"><option value="">كل العنابر</option></select></label>
    <label class="pfm57-field pfm57-search"><span data-pfm57-ar="البحث داخل هذه الشاشة" data-pfm57-en="Search this screen">البحث داخل هذه الشاشة</span><input data-pfm57-role="search" type="search" autocomplete="off" placeholder="ابحث بالاسم، التاريخ، رقم الدورة..."/></label>
    <button data-pfm57-role="start-search" class="btn primary pfm57-start-search" type="button">🔎 بحث</button>
    <button data-pfm57-role="pdf" class="btn pfm57-pdf" type="button">🖨️ PDF</button>
    <button data-pfm57-role="excel" class="btn primary pfm57-excel" type="button">📊 Export Excel</button>
  </div><div class="pfm57-small"><span data-pfm57-role="count"></span><span data-pfm57-role="results" role="status"></span></div>`;
 const get=role=>tool.querySelector('[data-pfm57-role="'+role+'"]');
 get('cycle').addEventListener('change',e=>setCycle(e.target.value));
 get('farm').addEventListener('change',e=>setFarm(e.target.value));
 get('house').addEventListener('change',e=>setHouse(e.target.value));
 get('search').addEventListener('input',e=>{
   if(!e.target.value.trim()){
    searchByScreen[section.id]='';searchOpenByScreen[section.id]=false;
    if(section.classList.contains('active')){state.search='';refreshSearchedScreen(section);}
   }
 });
 get('search').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runPageSearch(section);}});
 get('start-search').addEventListener('click',()=>runPageSearch(section));
 get('excel').addEventListener('click',exportScreenExcel);
 get('pdf').addEventListener('click',printCurrentScreen);
 putToolbar(section,tool);

 return tool;
}
function placeToolbar(){
 const section=document.querySelector('main > section.view.active');if(!section)return;
 let tool=section.querySelector(':scope > .pfm57-toolbar');
 if(!tool)tool=createToolbar(section);
 putToolbar(section,tool);
 // No secondary search-results panel: the existing screen renders matching records.
 if(lastSearchScreen!==section.id){
  state.search=searchByScreen[section.id]||'';
  lastSearchScreen=section.id;
 }
 updateScopeOptions();
 const search=tool.querySelector('[data-pfm57-role="search"]');
 if(search&&document.activeElement!==search)search.value=state.search;
 applySearchAndScope();
}
function sheetName(prefix,i){return (prefix+'_'+i).slice(0,31);}
function cleanedCell(c){const clone=c.cloneNode(true);clone.querySelectorAll('button,input,select,textarea,svg').forEach(x=>x.remove());return (clone.textContent||'').replace(/[\t\n ]+/g,' ').trim();}
function tableRows(table){
  const th=[...(table.tHead?.rows[table.tHead.rows.length-1]?.cells||[])];
  const visibleCols=th.map((h,i)=>({i,value:cleanedCell(h)})).filter(x=>x.value&&!/^(الإجراء|الإجراءات|Action|Actions)$/i.test(x.value));
  const headers=visibleCols.length?visibleCols.map(x=>x.value):null;
  const rows=[];for(const body of table.tBodies)for(const r of body.rows){if(r.classList.contains('pfm57-filtered-out')||r.hidden)continue;
    if(!r.querySelector('[data-id]')&&/^(لا توجد|No records|No data)/i.test(r.textContent.trim()))continue;
    const cells=[...r.cells];if(cells.length===1&&cells[0].colSpan>1)continue;
    rows.push(visibleCols.length?visibleCols.map(x=>cleanedCell(cells[x.i]||document.createElement('td'))):cells.map(cleanedCell));
  }
  return rows.length?[headers||rows[0].map((_,i)=>t('عمود ','Column ')+(i+1)),...rows]:null;
}
function trigger(blob,filename){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),12000);}
function appendFullScopeRecords(books,view){
  const d=appData();if(!d)return;
  const map={dash:['cycles'],farms:['farms'],houses:['houses'],cycles:['cycles'],daily:['daily'],weights:['weights'],feed:['feed'],meds:['meds'],inventory:['inventory'],sales:['sales'],finance:['cycles','finance'],performance:['cycles'],standards:['performanceRules'],compare:['cycles'],reports:['cycles','daily','weights','feed','meds','sales'],settings:['performanceRules'],audit:['auditLog'],users:['invitations'],backup:['farms','houses','cycles','daily','weights','feed','meds','inventory','sales']};
  const keys=map[view.id]||[];let idx=0;
  for(const key of keys){
    if(books.length>=45)break;
    let records=key==='finance'?Object.entries(d.finance||{}).map(([cycleId,value])=>({cycleId,...value})):Array.isArray(d[key])?d[key]:[];
    if(['performanceRules','auditLog','invitations'].includes(key)){
      records=records.filter(r=>!state.search||JSON.stringify(r).toLocaleLowerCase().includes(state.search.toLocaleLowerCase()));
    }else{
      records=records.filter(r=>{
        const c=key==='cycles'?r:r.cycleId?activeCycles().find(c=>c.id===r.cycleId):null;
        const f=key==='farms'?r:key==='houses'?d.farms.find(f=>f.id===r.farmId):key==='inventory'?d.farms.find(f=>f.id===r.farmId):c?d.farms.find(f=>f.id===c.farmId):null;
        const h=key==='houses'?r:c?d.houses.find(h=>h.id===c.houseId):null;
        if(c&&!scopeMatch(c))return false;
        if(!c&&(state.cycle||state.farm||state.house)){
          if(key==='farms'&&(!farmsInScope().some(x=>x.id===r.id)||state.house&&!d.houses.some(h=>h.id===state.house&&h.farmId===r.id)))return false;
          if(key==='houses'&&(!housesInScope().some(x=>x.id===r.id)||state.house&&state.house!==r.id))return false;
          if(key==='inventory'&&(!farmsInScope().some(x=>x.id===r.farmId)||state.farm&&state.farm!==r.farmId||state.house&&!d.houses.some(h=>h.id===state.house&&h.farmId===r.farmId)))return false;
        }
        if(view.id==='reports'&&c&&$('reportCycle')?.value&&$('reportCycle').value!==c.id)return false;
        const text=[JSON.stringify(r),c?'الدورة '+cycleNo(c):'',f?.name||'',h?.name||'',c?.breed||''].join(' ').toLocaleLowerCase();
        return !state.search||text.includes(state.search.toLocaleLowerCase());
      });
    }
    if(!records.length)continue;
    const head=[...new Set(records.flatMap(o=>Object.keys(o||{})))].sort((a,b)=>a==='id'?-1:b==='id'?1:0);
    if(head.length>100)continue;
    const rows=[['رقم الدورة','المزرعة','العنبر',...head],...records.map(r=>{
      const c=key==='cycles'?r:activeCycles().find(c=>c.id===r.cycleId),f=key==='farms'?r:d.farms.find(f=>f.id===(c?.farmId||r.farmId)),h=key==='houses'?r:d.houses.find(h=>h.id===(c?.houseId||r.houseId));
      return [c?cycleNo(c):'',f?.name||'',h?.name||'',...head.map(h=>r[h]==null?'':typeof r[h]==='object'?JSON.stringify(r[h]):r[h])];
    })];
    books.push([('All_'+(++idx)+'_'+key).slice(0,31),rows]);
  }
}
function exportScreenExcel(){try{
  if(!authed())throw Error(t('سجّل الدخول أولًا','Sign in first'));
  const diag=window.PFMExcelDiagnostics;if(!diag?.workbookFile)throw Error('Excel engine unavailable');
  applySearchAndScope();const view=document.querySelector('main > section.view.active');if(!view)throw Error('No screen');
  const screenTitle=view.querySelector('h2')?.textContent.trim()||view.id;
  const groupTitle=state.cycle?t('الدورة ','Cycle ')+state.cycle:t('كل الدورات','All cycles');
  const farmTitle=state.farm?getFarm(state.farm):t('كل المزارع','All farms');
  const houseTitle=state.house?getHouse(state.house):t('كل العنابر','All houses');
  const books=[['Selection',[[t('الشاشة','Screen'),screenTitle],[t('الدورة','Cycle'),groupTitle],[t('المزرعة','Farm'),farmTitle],[t('العنبر','House'),houseTitle],[t('البحث','Search'),state.search],[t('وقت التصدير','Exported at'),new Date().toISOString()]]]];
  let count=0;view.querySelectorAll('table').forEach(table=>{
    if(count>=24)return;
    const rows=tableRows(table);if(!rows)return;
    count++;books.push([sheetName('Table',count),rows]);
  });
  // Dashboard and report cards without tables still get a usable editable Excel summary.
  const cards=[...view.querySelectorAll('.card,.pfm53-kpi,.pfm53-second-card,.pfm53-summary-card')]
    .filter(c=>!c.closest('.pfm57-toolbar')).map(c=>(c.textContent||'').replace(/\s+/g,' ').trim()).filter(Boolean);
  if(cards.length)books.push(['KPI_Summary',[[t('مؤشر أو ملخص','KPI or summary')],...cards.map(x=>[x])]]);
  // Export every scoped record, including entries beyond the table's on-screen pagination.
  appendFullScopeRecords(books,view);
  // Include primary visible text when a report has no table and no summary cards.
  if(books.length===1){const blocks=[...view.querySelectorAll('h3,.note,.muted')].slice(0,100).map(el=>el.textContent.trim()).filter(Boolean);books.push(['Visible_Content',[[t('البيانات المعروضة','Visible content')],...blocks.map(x=>[x])]]);}
  trigger(diag.workbookFile(books),'PFM_'+view.id+'_'+new Date().toISOString().slice(0,10)+'.xlsx');
}catch(e){console.error('PFM screen XLSX:',e);alert(t('تعذر تصدير الشاشة: ','Could not export screen: ')+e.message);}}
function printCurrentScreen(){
 if(typeof window.PFMPrintResults59==='function'){
    applySearchAndScope();window.PFMPrintResults59();
 }else alert(t('وحدة طباعة النتائج غير متاحة','Print-results module is unavailable'));
}
function validateDb(next){
 if(!next||typeof next!=='object'||Array.isArray(next))throw Error('Invalid database');
 const required=['farms','houses','cycles','daily','weights','feed','meds','inventory','sales'];
 for(const k of required)if(!Array.isArray(next[k]))throw Error(t('جدول مفقود أو تالف: ','Missing table: ')+k);
 const ids={};for(const k of required){ids[k]=new Set();for(const r of next[k]){
   if(!r||typeof r!=='object'||Array.isArray(r)||typeof r.id!=='string'||!r.id)throw Error('Invalid record ID in '+k);
   if(ids[k].has(r.id))throw Error('Duplicate ID in '+k);ids[k].add(r.id);
 }}
 for(const h of next.houses)if(!ids.farms.has(h.farmId))throw Error('House without farm');
 const houseFarm=new Map(next.houses.map(h=>[h.id,h.farmId]));
 for(const c of next.cycles)if(!ids.farms.has(c.farmId)||houseFarm.get(c.houseId)!==c.farmId)throw Error('Invalid cycle farm/house relationship');
 for(const k of ['daily','weights','feed','meds','sales'])for(const r of next[k])if(r.cycleId&&!ids.cycles.has(r.cycleId))throw Error('Record without cycle in '+k);
 for(const r of next.inventory)if(r.farmId&&!ids.farms.has(r.farmId))throw Error('Inventory without farm');
 if(next.finance && (typeof next.finance!=='object'||Array.isArray(next.finance)))throw Error('Invalid finance ledger');
 if(next.settings && (typeof next.settings!=='object'||Array.isArray(next.settings)))throw Error('Invalid settings');
}
async function rawDb(source){
 const known=['PFM_BACKUP_V63',backupFormat,'PFM_BACKUP_V1'];
 if(source?.format&&!known.includes(source.format))throw Error('Unsupported backup format');
 const x=source?.format?source.data:source;
 validateDb(x);
 if(source?.format==='PFM_BACKUP_V63'){
   if(source.checksum){
     if(source.checksum.algorithm!=='SHA-256'||!source.checksum.value)throw Error('Invalid integrity manifest');
     const actual=await window.PFMV63.digest(JSON.stringify(x));
     if(actual!==source.checksum.value)throw Error(t('فشل فحص البصمة: الملف قد يكون معدلًا أو تالفًا. لم تتغير البيانات.','Backup integrity mismatch: your data was not changed.'));
   }
 }
 return x;
}
async function backupBlob(data){
 const snapshot=copies(data),raw=JSON.stringify(snapshot);
 let checksum=null;
 try{checksum={algorithm:'SHA-256',value:await window.PFMV63.digest(raw)}}catch(e){console.warn('Integrity hash unavailable, unverified backup will be exported:',e)}
 const recordCounts={};for(const key of ['farms','houses','cycles','daily','weights','feed','meds','inventory','sales'])recordCounts[key]=snapshot[key]?.length||0;
 return new Blob([JSON.stringify({format:'PFM_BACKUP_V63',schemaVersion:1,exportedAt:new Date().toISOString(),storage:'localStorage + IndexedDB snapshots (per-user)',recordCounts,checksum,data:snapshot},null,2)],{type:'application/json;charset=utf-8'});
}
async function backupNow(prefix='PFM-full-backup'){
 if(!authed())throw Error('Sign in first');
 const result=await backupBlob(appData());
 trigger(result,prefix+'_'+today()+'.json');
 const node=$('pfm57BackupStatus');if(node)node.textContent=t('بدأ تنزيل نسخة JSON كاملة من بيانات الحساب. احتفظ بها خارج المتصفح.','Full JSON backup download started. Keep it outside this browser.');
}
window.PFMExportBackup57=async()=>{try{await backupNow();}catch(e){alert(e.message);}};
function mergeArr(a,b){const set=new Set(a.filter(x=>x&&x.id).map(x=>x.id));const seen=new Set(a.filter(x=>!x?.id).map(x=>JSON.stringify(x)));
 const result=copies(a);
 for(const item of b){if(item?.id){if(!set.has(item.id)){result.push(copies(item));set.add(item.id);}}else{const key=JSON.stringify(item);if(!seen.has(key)){result.push(copies(item));seen.add(key);}}}return result;
}
function mergeObjects(current,incoming){
 if(Array.isArray(current)&&Array.isArray(incoming))return mergeArr(current,incoming);
 if(current&&incoming&&typeof current==='object'&&typeof incoming==='object'&&!Array.isArray(current)&&!Array.isArray(incoming)){
   const out=Object.create(null);for(const k of new Set([...Object.keys(incoming),...Object.keys(current)])){
     if(k==='__proto__'||k==='prototype'||k==='constructor')continue;
     out[k]=k in current&&k in incoming?mergeObjects(current[k],incoming[k]):copies(k in current?current[k]:incoming[k]);
   }return out;
 }
 return copies(current);
}
function persistSafely(next){
 const key=typeof localKey==='function'?localKey():null;if(!key)throw Error('No logged in storage key');
 const contents=JSON.stringify(next);
 // Test the *real* persistent backend. The app's in-memory fallback is not durable.
 try{window.PFMV63.verifyPrimary(key,contents);}
 catch(e){throw Error(t('المتصفح لم يحفظ البيانات على القرص. لم يتم تغيير البيانات الحالية. حرّر مساحة التخزين أو استخدم متصفحًا يسمح بالحفظ.','Browser storage is unavailable or full. Current records were not modified.'));}
}
async function restoreData(imported,filename,format){
 if(!authed())throw Error('Sign in first');validateDb(imported);const original=copies(appData());
 const mode=$('pfm57RestoreMode')?.value||'merge';
 const next=mode==='replace'?copies(imported):mergeObjects(original,imported);
 // The merged result is checked before any persistent or runtime change.
 validateDb(next);
 if(mode==='replace'){
   const response=prompt(t('تحذير: هذا سيستبدل كل بيانات الحساب الحالية بالملف المستورد. اكتب استبدال للتأكيد:','WARNING: this replaces all current data. Type REPLACE to confirm:'));
   if(response!==(en()?'REPLACE':'استبدال'))return false;
 }else if(!confirm(t('دمج البيانات من ','Merge data from ')+filename+t(' مع المحافظة على السجلات الحالية؟\nسيتم إنشاء نسخة احتياطية قبل التعديل.',' while preserving current records?\nA backup will be downloaded first.')))return false;
 // Archive original state separately before applying anything from the imported file.
 try{await window.PFMV63.snapshot(currentUser.id,JSON.stringify(original),'قبل الاستيراد');}
 catch(e){console.warn('No IndexedDB pre-import snapshot:',e);}
 await backupNow('PFM-before-restore');
 // Do not mutate the live db until storage succeeded. Never auto-delete old cycles in merge mode.
 persistSafely(next);
 try{db=Object.assign(emptyDb(),next);financeDraftExpenses={};normalizeDbIds();persistLocal();renderAll();placeToolbar();
   const status=$('pfm57BackupStatus');if(status)status.textContent=t('تم الاستيراد: ','Import completed: ')+filename+t(' — الاحتفاظ بالسجلات الحالية: ',' — preserved existing records: ')+(mode==='merge'?t('نعم','Yes'):t('استبدال بأمر صريح','Explicit replacement'));
   alert(t('تم استيراد البيانات بنجاح، مع حفظ نسخة من البيانات السابقة.','Data imported successfully. A backup of prior data was also generated.'));
 }catch(e){db=Object.assign(emptyDb(),original);try{persistSafely(original);}catch(_){}renderAll();throw e;}
 return true;
}
window.PFMImportBackup57=async input=>{
 const file=input?.files?.[0];if(!file)return;
 try{if(file.size>80*1024*1024)throw Error('Backup file too large');const imported=await rawDb(JSON.parse(await file.text()));await restoreData(imported,file.name,'json');}
 catch(e){console.error('PFM JSON restore:',e);alert(t('لم يتم الاستيراد: ','Import cancelled: ')+e.message);}finally{input.value='';}
};
window.PFMImportExcel57=async input=>{
 const file=input?.files?.[0];if(!file)return;
 try{const diag=window.PFMExcelDiagnostics;if(!diag)throw Error('Excel engine unavailable');
   const zip=await diag.unzipFile(await file.arrayBuffer());const imported=diag.parseDb(diag.parseBooks(zip));await restoreData(imported,file.name,'xlsx');}
 catch(e){console.error('PFM XLSX restore:',e);alert(t('لم يتم الاستيراد: ','Import cancelled: ')+e.message);}finally{input.value='';}
};
async function refreshLocalArchives(){
 const select=$('pfm63SnapshotSelect'),status=$('pfm63ArchiveStatus');if(!select||!authed())return;
 try{
   const all=await window.PFMV63.snapshots(currentUser.id);
   select.replaceChildren();
   for(const a of all){const op=document.createElement('option');op.value=String(a.id);op.textContent=new Date(a.createdAt).toLocaleString()+' — '+a.reason+' — '+(a.bytes/1024).toFixed(0)+' KB';select.appendChild(op);}
   status.textContent=all.length?t('النسخ المحلية المحفوظة: ','Stored local snapshots: ')+all.length:t('لا توجد نسخ محلية بعد. احفظ نسخة الآن.','No archived snapshots yet.');
 }catch(e){status.textContent=t('النسخ المحلية غير متاحة في هذا المتصفح: ','Local snapshot archive is unavailable: ')+e.message;}
}
async function manualSnapshot(){
 const status=$('pfm63ArchiveStatus');
 try{
   if(!authed())throw Error('Sign in first');
   const data=JSON.stringify(appData());
   const out=await window.PFMV63.snapshot(currentUser.id,data,'نسخة يدوية');
   await refreshLocalArchives();
   status.textContent=out.duplicate?t('النسخة المطابقة محفوظة بالفعل.','Identical snapshot already exists.'):t('تم حفظ نسخة محلية على الجهاز. احفظ JSON خارجيًا أيضًا.','Local snapshot saved. Export an external JSON backup too.');
   if(window.PFMV63.dirty)status.textContent+=' — تحذير: التخزين الأساسي لم يكتمل؛ نزّل أيضًا JSON خارجيًا.';
 }catch(e){status.textContent=t('فشل حفظ النسخة المحلية: ','Local snapshot failed: ')+e.message;}
}
async function restoreArchive(){
 const sel=$('pfm63SnapshotSelect'),status=$('pfm63ArchiveStatus');
 if(!sel?.value)return alert(t('اختر نسخة محلية أولًا','Select a snapshot first'));
 try{
   const archived=await window.PFMV63.readVerified(currentUser.id,sel.value);
   validateDb(archived.data);
   await restoreData(archived.data,'Local snapshot '+archived.meta.createdAt,'archive');
   await refreshLocalArchives();
 }catch(e){status.textContent=t('لم يتم الاسترجاع: ','Restore failed: ')+e.message;alert(status.textContent);}
}
function settingsPanel(){const settings=$('settings');if(!settings||$('pfm57BackupPanel'))return;
 const panel=document.createElement('div');panel.className='panel pfm57-settings-panel';panel.id='pfm57BackupPanel';
 panel.innerHTML=`<h3>💾 ${t('إدارة البيانات والنسخ الاحتياطية','Data management & backups')}</h3>
 <p>${t('نسخة JSON تشمل جميع السجلات، المالية، الإعدادات، وسجل معايير كل دورة؛ يمكنك الاحتفاظ بها واستعادتها بعد التحديث أو نقل الجهاز.','JSON backup includes all records, finance, settings and historical cycle breed standards.')}</p>
 <div class="actions"><button class="btn primary" type="button" id="pfm57ExportJson">⬇ ${t('تصدير نسخة احتياطية كاملة JSON','Export full JSON backup')}</button>
 <button class="btn" type="button" id="pfm57ImportJsonBtn">⬆ ${t('استيراد نسخة JSON','Import JSON backup')}</button><input hidden type="file" id="pfm57ImportJson" accept=".json,application/json"/>
 <button class="btn" type="button" id="pfm57ExportExcelAll">📊 ${t('تصدير كامل البيانات Excel','Export all data Excel')}</button>
 <button class="btn" type="button" id="pfm57ImportExcelBtn">⬆ ${t('استيراد Excel','Import Excel')}</button><input hidden type="file" id="pfm57ImportExcelFile" accept=".xlsx"/></div>
 <div class="pfm57-restore-options"><label><b>${t('طريقة استعادة البيانات','Restore mode')}:</b> <select id="pfm57RestoreMode"><option value="merge">${t('دمج آمن — الحفاظ على البيانات القديمة','Safe merge — keep old records')}</option><option value="replace">${t('استبدال كامل — يتطلب تأكيدًا مكتوبًا','Full replace — typed confirmation required')}</option></select></label></div>
 <p class="muted">${t('في وضع الدمج: البيانات المحفوظة الحالية لها الأولوية عند تطابق المعرّفات، ولا تُحذف الدورات القديمة. في وضع الاستبدال: يتم تغيير بيانات الحساب بالكامل بعد تأكيد واضح.','In merge mode the current records win on matching IDs and old cycles are retained. Full replace changes all account data only after explicit confirmation.')}</p>
 <p class="muted">${t('ملفات ZIP لا تحتوي تلقائيًا على مدخلات المتصفح الجديدة؛ استخدم تصدير نسخة احتياطية بعد كل تحديث مهم. المزامنة السحابية، إن كانت مفعّلة، تحتاج تحققًا مستقلًا.','ZIP archives do not automatically include later browser entries; export backups after important changes. Connected cloud sync must be verified separately.')}</p>
 <div class="pfm63-local-archive"><h4>${t('نسخ محلية للاستعادة — IndexedDB','Local restore points — IndexedDB')}</h4>
 <p class="muted">${t('محفوظة في نفس المتصفح والحساب فقط؛ قد تختفي إذا حذفت بيانات الموقع. احتفظ كذلك بنسخة JSON خارجية.','Saved only on this device/browser/account; clearing site data can delete them. Keep external JSON backups.')}</p>
 <div class="actions"><button class="btn" type="button" id="pfm63MakeSnapshot">💾 ${t('حفظ نسخة محلية الآن','Save local snapshot')}</button><button class="btn" type="button" id="pfm63ReloadSnapshots">↻ ${t('تحديث قائمة النسخ','Refresh snapshots')}</button></div>
 <label class="pfm63-snapshot-label">${t('اختر نقطة الاستعادة','Choose restore point')} <select id="pfm63SnapshotSelect" aria-label="Local snapshots"></select></label>
 <div class="actions"><button class="btn" type="button" id="pfm63RestoreSnapshot">↩ ${t('استعادة النسخة المختارة بالوضع المحدد أعلاه','Restore selected using the mode above')}</button></div>
 <p id="pfm63ArchiveStatus" class="muted" role="status"></p></div>
 <p class="muted" role="status" id="pfm57BackupStatus"></p>`;
 const title=settings.querySelector('h2');if(title)title.insertAdjacentElement('afterend',panel);else settings.prepend(panel);
 $('pfm57ExportJson').onclick=window.PFMExportBackup57;
 $('pfm57ImportJsonBtn').onclick=()=>$('pfm57ImportJson').click();$('pfm57ImportJson').onchange=e=>window.PFMImportBackup57(e.target);
 $('pfm57ExportExcelAll').onclick=()=>window.PFMExportExcel?.();
 $('pfm57ImportExcelBtn').onclick=()=>$('pfm57ImportExcelFile').click();$('pfm57ImportExcelFile').onchange=e=>window.PFMImportExcel57(e.target);
 $('pfm63MakeSnapshot').onclick=manualSnapshot;
 $('pfm63ReloadSnapshots').onclick=refreshLocalArchives;
 $('pfm63RestoreSnapshot').onclick=restoreArchive;
 if(authed())refreshLocalArchives();
}
function install(){settingsPanel();
 document.querySelectorAll('main > section.view').forEach(section=>{if(!section.querySelector(':scope > .pfm57-toolbar'))createToolbar(section);});
 // Preserve the original old backup buttons, but route them through the safer backup flow.
 window.exportBackup=window.PFMExportBackup57;window.importBackup=window.PFMImportBackup57;
 // Existing backup-screen Excel import must not silently replace production data.
 window.PFMImportExcel=window.PFMImportExcel57;
 const originalRender=window.renderAll;
 if(typeof originalRender==='function'&&!originalRender.__pfm57){
   function patchedRender(){
     // Switch the active screen's query BEFORE the original renderer builds its tables.
     // This prevents a search in one page leaking into another page's first render.
     const active=document.querySelector('main > section.view.active');
     if(active&&lastSearchScreen!==active.id){state.search=searchByScreen[active.id]||'';lastSearchScreen=active.id;}
     const result=originalRender.apply(this,arguments);placeToolbar();requestAnimationFrame(applySearchAndScope);return result;
   }
   patchedRender.__pfm57=true;window.renderAll=patchedRender;
 }
 updateScopeOptions();placeToolbar();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(install,30));else setTimeout(install,30);
window.PFM57Diagnostics={state,scopeMatch,groupMatch,validateDb,mergeObjects,applySearchAndScope,exportScreenExcel,rawDb,backupBlob,backupNow,restoreData,refreshLocalArchives};
})();
