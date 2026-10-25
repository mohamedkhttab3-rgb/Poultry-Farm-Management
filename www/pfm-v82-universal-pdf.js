/* PFM V8.2 — universal read-only report document for TOP toolbar PDF.
 * No canvas snapshots, no copying hundreds of computed styles, no ledger writes.
 * Shared semantic HTML on Windows, Android, iOS and web; OS output is delegated
 * to the existing validated native printer/save/share bridges.
 * The separately approved Cycle Report button remains unchanged.
 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const en=()=>document.documentElement.lang==='en';
 const tr=(ar,eng)=>en()?eng:ar;
 const txt=x=>String(x??'').replace(/\s+/g,' ').trim();
 const money=x=>Number.isFinite(Number(x))?new Intl.NumberFormat(en()?'en-US':'en-US',{maximumFractionDigits:3}).format(+x):'—';
 const date=x=>String(x||'—').slice(0,10);
 let exporting=false,modal=null;
 function env(){
  const view=document.querySelector('main > section.view.active');
  if(!view)throw Error('No active application screen');
  const dbNow=typeof db!=='undefined'?db:null;
  if(!dbNow)throw Error('Application data unavailable');
  const bar=view.querySelector(':scope > .pfm57-toolbar'),sel=k=>bar?.querySelector('[data-pfm57-role="'+k+'"]');
  const filters={cycle:sel('cycle')?.value||'',farm:sel('farm')?.value||'',house:sel('house')?.value||'',search:txt(sel('search')?.value).toLowerCase()};
  const farms=new Map((dbNow.farms||[]).map(x=>[x.id,x]));
  const houses=new Map((dbNow.houses||[]).map(x=>[x.id,x]));
  const ordinal=c=>typeof cycleOrdinal==='function'?String(cycleOrdinal(c)):String(c.cycleNumber||'');
  const cycles=(dbNow.cycles||[]).filter(c=>{
   if(typeof window.PFMGlobalCycleScope==='function'&&!window.PFMGlobalCycleScope(c))return false;
   return (!filters.cycle||ordinal(c)===filters.cycle)&&(!filters.farm||c.farmId===filters.farm)&&(!filters.house||c.houseId===filters.house);
  });
  const ids=new Set(cycles.map(c=>c.id));
  const refs={farms,houses,cycles,ids,cycle:id=>(dbNow.cycles||[]).find(c=>c.id===id),
   farm:id=>farms.get(id)?.name||'—',house:id=>houses.get(id)?.name||'—'};
  return {view,db:dbNow,filters,refs,bar};
 }
 function item(value){return value==null||value===''?'—':typeof value==='number'?money(value):String(value)}
 function line(fields){return fields.map(x=>item(x))}
 function dataset(ctx){
  const {view,db:d,refs:r}=ctx,perCycle=arr=>(arr||[]).filter(x=>r.ids.has(x.cycleId));
  const byFarm=arr=>(arr||[]).filter(x=>!ctx.filters.farm||x.farmId===ctx.filters.farm);
  const cols=(ar,enLabels)=>en()?enLabels:ar;
  const fam=c=>r.farm(c?.farmId),hom=c=>r.house(c?.houseId);
  const common=(key,colsAr,colsEn,rows,note)=>({key,headers:cols(colsAr,colsEn),rows,note});
  switch(view.id){
   case 'dash':{
    const farmIds=new Set(r.cycles.map(c=>c.farmId));
    const farmRows=(d.farms||[]).filter(f=>farmIds.has(f.id)).map(f=>{
     const fc=r.cycles.filter(c=>c.farmId===f.id);
     const ids=new Set(fc.map(c=>c.id));
     const received=fc.reduce((n,c)=>n+(+c.birds||0),0);
     const dead=(d.daily||[]).filter(x=>ids.has(x.cycleId)).reduce((n,x)=>n+(+x.dead||0),0);
     const culled=(d.daily||[]).filter(x=>ids.has(x.cycleId)).reduce((n,x)=>n+(+x.cull||0),0);
     const sold=(d.sales||[]).filter(x=>ids.has(x.cycleId)).reduce((n,x)=>n+(+x.birds||0),0);
     return line([f.name,fc.length,received,dead,culled,sold,Math.max(0,received-dead-culled-sold)]);
    });
    const timeline=new Map();
    for(const x of (d.daily||[]).filter(x=>r.ids.has(x.cycleId))){
     const dt=date(x.date),val=timeline.get(dt)||{dead:0,cull:0,feed:0,water:0};
     val.dead+=+x.dead||0;val.cull+=+x.cull||0;
     val.feed+=+x.feed||0;val.water+=+x.water||0;timeline.set(dt,val);
    }
    return [
     common('farm-status',
      ['المزرعة','عدد العنابر','الصيصان المستلمة','النافق','الفرز','المباع','الرصيد الحسابي'],
      ['Farm','Houses','Received DOC','Mortality','Culls','Sold','Reconciled birds'],farmRows),
     common('daily-trends',['التاريخ','النافق','الفرز','العلف (كجم)','المياه (لتر)'],
      ['Date','Mortality','Culls','Feed kg','Water L'],
      [...timeline].sort((a,b)=>a[0].localeCompare(b[0])).map(([dt,v])=>line([dt,v.dead,v.cull,v.feed,v.water])))
    ];
   }
   case 'farms':return [common('farms',['المزرعة','الشركة','الموقع','المدير'],['Farm','Company','Location','Manager'],
    byFarm(d.farms).map(f=>line([f.name,f.companyName||f.company,f.location,f.manager])))];
   case 'houses':return [common('houses',['المزرعة','العنبر','السعة'],['Farm','House','Capacity'],
    (d.houses||[]).filter(h=>!ctx.filters.farm||h.farmId===ctx.filters.farm).map(h=>line([r.farm(h.farmId),h.name,h.capacity])))];
   case 'cycles':return [common('cycles',['المزرعة','العنبر','بداية الدورة','السلالة','الصيصان'],['Farm','House','Start','Breed','Chicks'],
    r.cycles.map(c=>line([fam(c),hom(c),date(c.date),c.breed,c.birds])))];
   case 'daily':return [common('daily',['التاريخ','المزرعة','العنبر','النافق','الفرز','العلف (كجم)','المياه (لتر)','ملاحظات'],['Date','Farm','House','Mortality','Culls','Feed kg','Water L','Notes'],
    perCycle(d.daily).map(x=>{const c=r.cycle(x.cycleId);return line([date(x.date),fam(c),hom(c),x.dead,x.cull,x.feed,x.water,x.notes]);}))];
   case 'weights':return [common('weights',['التاريخ','المزرعة','العنبر','العينة','متوسط الوزن (كجم)','CV %'],['Date','Farm','House','Sample','Average kg','CV %'],
    perCycle(d.weights).map(x=>{const c=r.cycle(x.cycleId);return line([date(x.date),fam(c),hom(c),x.sample,x.avg,x.cv]);}))];
   case 'feed':return [common('feed',['التاريخ','المزرعة','العنبر','نوع العلف','الكمية (كجم)'],['Date','Farm','House','Feed Type','Quantity kg'],
    perCycle(d.feed).map(x=>{const c=r.cycle(x.cycleId);return line([date(x.date),fam(c),hom(c),x.type,x.qty]);}),
    tr('هذا جدول استهلاك فقط؛ الشراء والتكلفة مثبتان في فواتير المشتريات والصرف من الدفعات.','Consumption only; purchase cost belongs to unified invoices and stock-lot issues.'))];
   case 'meds':return [common('meds',['التاريخ','المزرعة','العنبر','الصنف','الاسم','الكمية','السحب (يوم)'],['Date','Farm','House','Type','Name','Quantity','Withdrawal days'],
    perCycle(d.meds).map(x=>{const c=r.cycle(x.cycleId);return line([date(x.date),fam(c),hom(c),x.type,x.name,x.qty,x.withdrawal]);}),
    tr('السجل الفني لا يُنشئ فاتورة شراء ثانية.','Technical record does not create a duplicate purchase invoice.'))];
   case 'inventory':{
    const docs=byFarm(d.v410?.purchaseDocuments).filter(x=>!ctx.filters.cycle&&!ctx.filters.house||
       (x.lines||[]).some(line=>!line.cycleId||r.ids.has(line.cycleId)));
    const lots=byFarm(d.v410?.lots).filter(x=>!ctx.filters.cycle&&!ctx.filters.house||
       (d.v410?.movements||[]).some(m=>m.lotId===x.id&&r.ids.has(m.cycleId)));
    const movements=(d.v410?.movements||[]).filter(x=>{
     if(x.cycleId)return r.ids.has(x.cycleId);
     const lot=(d.v410?.lots||[]).find(y=>y.id===x.lotId);
     return !ctx.filters.farm||lot?.farmId===ctx.filters.farm;
    });
    return [
     common('invoices',['المزرعة','التاريخ','المورد','رقم الفاتورة','الإجمالي'],['Farm','Date','Supplier','Invoice','Total'],
      docs.map(x=>line([r.farm(x.farmId),date(x.date),x.supplier||x.vendor,x.invoice||x.invoiceNo||x.number,x.totals?.gross||x.totals?.total||x.total||x.grossTotal]))),
     common('lots',['المزرعة','الصنف','الكمية','المتبقي','التكلفة للوحدة'],['Farm','Stock Item','Quantity','Remaining','Unit Cost'],
      lots.map(x=>line([r.farm(x.farmId),x.item||x.name||x.itemName||x.type,x.qty??x.quantity,x.remaining??x.balance,x.unitCost]))),
     common('issues',['التاريخ','دفعة المخزون','الدورة','الكمية','النوع'],['Date','Stock Lot','Cycle','Quantity','Type'],
      movements.map(x=>line([date(x.date),String(x.lotId||'').slice(0,12),r.cycle(x.cycleId)?.breed||'',x.qty||x.quantity,x.type])) )
    ];
   }
   case 'sales':return [common('sales',['التاريخ','المزرعة','العنبر','العدد المباع','الوزن (كجم)','سعر الوحدة'],['Date','Farm','House','Birds Sold','Weight kg','Unit Price'],
    perCycle(d.sales).map(x=>{const c=r.cycle(x.cycleId);return line([date(x.date),fam(c),hom(c),x.birds,x.weightKg,x.price]);}))];
   default:return [];
  }
 }
 function semanticTables(ctx){
  const {view,filters}=ctx;
  const source=view.id==='finance'&&typeof window.PFM_V52?.buildPrintSnapshot==='function'?
   (()=>{const div=document.createElement('div');div.innerHTML=window.PFM_V52.buildPrintSnapshot();return div})():view;
  const result=[];
  for(const table of source.querySelectorAll('table')){
   if(table.closest('.pfm57-toolbar,.no-print,.pfm57-settings-panel'))continue;
   const headings=[...table.querySelectorAll('thead th')].map(x=>txt(x.textContent));
   const remove=new Set(headings.map((x,i)=>/^(الإجراءات|الإجراء|حذف|تعديل|Actions?|Delete|Edit)$/i.test(x)?i:-1).filter(x=>x>=0));
   const keep=headings.map((_,i)=>i).filter(i=>!remove.has(i));
   const headers=keep.map(i=>headings[i]||tr('العمود '+(i+1),'Column '+(i+1)));
   if(!headers.length)continue;
   const rows=[];
   for(const trEl of table.querySelectorAll('tbody tr')){
    if(trEl.hidden||trEl.classList.contains('pfm57-filtered-out'))continue;
    const cells=[...trEl.children];
    const values=keep.map(i=>{
     const cell=cells[i];
     if(!cell)return '';
     const c=cell.cloneNode(true);c.querySelectorAll('button,input,select,textarea,[onclick]').forEach(n=>n.remove());
     return txt(c.textContent);
    });
    if(filters.search&&!values.join(' ').toLowerCase().includes(filters.search))continue;
    if(values.some(Boolean))rows.push(values);
   }
   const heading=table.closest('.panel')?.querySelector('h3')?.textContent||table.getAttribute('aria-label')||tr('بيانات الشاشة','Screen data');
   result.push({key:txt(heading),headers,rows});
  }
  return result;
 }
 function summary(ctx){
  const view=ctx.view;
  const cards=[];
  if(view.id==='dash'){
   const root=$('v53-overview')||view;
   for(const el of root.querySelectorAll('.pfm53-kpi,.pfm53-mini')){
    const name=txt(el.querySelector('.pfm53-kpi-title,.pfm53-mini-title')?.textContent);
    const val=txt(el.querySelector('.pfm53-kpi-value,.pfm53-mini-value')?.textContent);
    if(name&&val)cards.push([name,val]);
   }
  }else for(const el of view.querySelectorAll('.pfm53-kpi,.v53-kpi,.v52-summary-card')){
   if(cards.length>=12)break;
   const v=txt(el.textContent);
   if(v&&v.length<125)cards.push([v,'']);
  }
  return cards;
 }
 function readableSummary(ctx){
  // Scientific performance/finance/standard reports use purpose-built panels
  // rather than ordinary tables. Export concise TEXT results, never editable
  // forms or the layout/card screenshot.
  const ids={performance:'performanceBox',compare:'comparisonBox',
   reports:'printReport',finance:'financeBox',settings:'globalStandardPanel',
   users:'membersBox'};
  const source=$(ids[ctx.view.id]||'');
  if(!source)return [];
  const elements=[...source.querySelectorAll('h2,h3,h4,.report-meta p,.summary-value,.pfm53-kpi-title,.pfm53-kpi-value,.v52-indicator')];
  const unique=new Set(),out=[];
  for(const el of elements){
   if(el.closest('.no-print,form,.actions,.pfm57-toolbar'))continue;
   if(el.querySelector('button,input,select,textarea'))continue;
   const text=txt(el.textContent);
   if(text.length<3||text.length>200||unique.has(text))continue;
   unique.add(text);out.push(text);
   if(out.length>=65)break;
  }
  return out;
 }
 function named(ctx){
  const heading=ctx.view.querySelector(':scope > h2')?.textContent;
  return txt(heading)||({dash:tr('لوحة التحكم الرئيسية','Main Dashboard'),inventory:tr('المشتريات والمخزون','Purchases & Inventory')}[ctx.view.id]||ctx.view.id);
 }

 function render(ctx,logo){
  // Physically paginated A4 sheets, NOT a CSS fixed footer: every page has
  // a real original image + brand IN its own protected bottom area.
  // This also avoids Chrome/Android/Windows page-margin footers disappearing.
  const e=escape,rtl=en()?'ltr':'rtl';
  const data=dataset(ctx);if(!data.length)data.push(...semanticTables(ctx));
  const stats=summary(ctx),notes=readableSummary(ctx),bar=ctx.bar;
  const scope=k=>txt(bar?.querySelector('[data-pfm57-role="'+k+'"]')?.selectedOptions?.[0]?.textContent);
  const scopeText=[tr('الدورة','Cycle')+': '+(scope('cycle')||tr('الكل','All')),
    tr('المزرعة','Farm')+': '+(scope('farm')||tr('الكل','All')),
    tr('العنبر','House')+': '+(scope('house')||tr('الكل','All'))].join(' • ');
  const filtered=data.map(tab=>({...tab,rows:ctx.filters.search?tab.rows.filter(
    row=>row.join(' ').toLocaleLowerCase().includes(ctx.filters.search)):tab.rows}));
  const count=filtered.reduce((n,x)=>n+x.rows.length,0);
  const formatDate=new Date().toLocaleString(en()?'en-GB':'ar-EG');
  const brandFooter='<footer class="pfm82-footer">'+
   '<img src="'+e(logo)+'" alt="M.K™"/><strong>Poultry Farm Management M.K™</strong></footer>';
  const tables={
   'farm-status':tr('ملخص الإنتاج حسب المزرعة','Farm Production Overview'),
   'daily-trends':tr('ملخص المتابعة اليومية','Daily Monitoring Summary'),
   farms:tr('المزارع','Farms'),houses:tr('العنابر','Houses'),
   cycles:tr('دورات التربية','Cycles'),daily:tr('المتابعة اليومية','Daily Records'),
   weights:tr('الأوزان الأسبوعية','Weekly Weights'),feed:tr('استهلاك العلف','Feed Consumption'),
   meds:tr('العلاج والتحصينات','Health Records'),invoices:tr('فواتير المشتريات','Purchase Invoices'),
   lots:tr('دفعات المخزون','Stock Lots'),issues:tr('حركات صرف المخزون','Stock Issues'),
   sales:tr('المبيعات','Sales')
  };
  const cover='<div class="pfm82-head"><div class="pfm82-title"><img src="'+e(logo)+
   '" alt="M.K™"/><div><h1>'+e(named(ctx))+'</h1><small>Poultry Farm Management · M.K™ — '+
   e(tr('تقرير بيانات','Data Report'))+'</small></div></div><span>'+e(formatDate)+'</span></div>'+
   '<div class="pfm82-scope">'+e(scopeText)+' • '+e(tr('إجمالي السجلات: ','Records: '))+count+'</div>'+
   (stats.length?'<div class="pfm82-metrics">'+stats.slice(0,8).map(([k,v])=>
    '<div class="pfm82-metric"><small>'+e(k)+'</small><strong>'+e(v)+'</strong></div>').join('')+'</div>':'');
  const pages=[];
  function appendPage(content,first=false){
   if(pages.length>=160)throw Error(tr('تقرير أكبر من 160 صفحة؛ يرجى تحديد نطاق المزرعة أو الدورة.','Report exceeds 160 pages; filter by farm or cycle.'));
   pages.push('<section class="pfm82-page" data-page="'+(pages.length+1)+'">'+
    '<div class="pfm82-page-body">'+(first?cover:'<div class="pfm82-running">'+
      '<strong>'+e(named(ctx))+'</strong><span>'+e(scopeText)+'</span></div>')+
     content+'</div>'+brandFooter+'</section>');
  }
  // First sheet is the visual summary. Tables start on their own sheets so
  // blank/partial table pages never collide with the header/metrics.
  appendPage('',true);
  if(notes.length){
   for(let i=0;i<notes.length;i+=16){
    const n=notes.slice(i,i+16);
    appendPage('<div class="pfm82-section"><h2>'+e(tr('المؤشرات والملخصات','Indicators and summaries'))+
     (i?' — '+e(tr('تابع','Continued')):'')+'</h2><div class="pfm82-notes">'+
     n.map(x=>'<p>'+e(x)+'</p>').join('')+'</div></div>');
   }
  }
  for(const tab of filtered){
   const title=tables[tab.key]||tab.key;
   const headers='<thead><tr>'+tab.headers.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead>';
   const lines=tab.rows.length?tab.rows:[[tr('لا توجد بيانات في النطاق المحدد','No records in selected scope')]];
   // Compact row caps plus tighter cell padding reduce unnecessary pages.
   // The dedicated 22mm page footer zone remains outside the content body.
   const perPage=tab.headers.length>=8?16:tab.headers.length>=6?18:22;
   for(let start=0;start<lines.length;start+=perPage){
    const slice=lines.slice(start,start+perPage);
    const rows=slice.map(row=>'<tr>'+tab.headers.map((_,i)=>'<td>'+e(row[i]??'')+'</td>').join('')+'</tr>').join('');
    const label=start?' · '+e(tr('تابع','Continued')):'';
    const note=start===0&&tab.note?'<p class="pfm82-note">'+e(tab.note)+'</p>':'';
    appendPage('<div class="pfm82-section"><div class="pfm82-section-title"><h2>'+e(title)+label+'</h2>'+
     '<span>'+Math.min(start+perPage,tab.rows.length)+' / '+tab.rows.length+'</span></div>'+note+
     '<table>'+headers+'<tbody>'+rows+'</tbody></table></div>');
   }
  }
  if(!filtered.length&&!notes.length&&!stats.length){
   appendPage('<p class="pfm82-empty">'+tr('لا توجد بيانات قابلة للتصدير في هذه الشاشة.','No exportable records for this screen.')+'</p>');
  }
  const css='@page{size:A4 landscape;margin:0}'+
   '*{box-sizing:border-box}html,body{margin:0;padding:0;color:#153a5c;background:#fff;direction:'+rtl+';font:10pt/1.38 Arial,Tahoma,sans-serif}'+
   '.pfm82-page{width:297mm;height:210mm;padding:10mm 12mm 22mm;margin:0;position:relative;page-break-after:always;break-after:page;overflow:hidden;background:#fff}'+
   '.pfm82-page:last-child{page-break-after:auto;break-after:auto}'+
   '.pfm82-page-body{width:100%;height:100%;overflow:hidden}'+
   '.pfm82-head{display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:2px solid #1c466c;padding-bottom:12px}'+
   '.pfm82-title{display:flex;align-items:center;gap:12px}.pfm82-title img{width:40px;height:40px;object-fit:contain}.pfm82-title h1{font-size:19pt;margin:0;color:#13395c}.pfm82-title small,.pfm82-head span{font-size:8pt;color:#5c7082}'+
   '.pfm82-scope{margin:7px 0 9px;padding:6px 9px;background:#f1f6fb;border:1px solid #dce8f2;border-radius:5px}'+
   '.pfm82-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.pfm82-metric{border:1px solid #d6e4ee;border-top:3px solid #25547b;padding:8px;border-radius:6px;min-width:0}.pfm82-metric small{color:#6b8194;display:block;font-size:9pt}.pfm82-metric strong{font-size:13pt;display:block;overflow-wrap:anywhere}'+
   '.pfm82-running{display:flex;justify-content:space-between;gap:12px;border-bottom:1px solid #cedeea;padding-bottom:5px;margin-bottom:8px;font-size:8pt;color:#586e84}'+
   '.pfm82-section-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:0 0 6px}.pfm82-section-title h2,.pfm82-section h2{font-size:12.5pt;margin:0;color:#1b456b}.pfm82-section-title span{font-size:9pt;color:#73889a}'+
   '.pfm82-note{color:#536c81;font-size:8.5pt;margin:0 0 9px}'+
   '.pfm82-notes{display:grid;grid-template-columns:1fr 1fr;gap:5px}.pfm82-notes p{border:1px solid #d9e6f0;border-radius:5px;padding:7px;margin:0;break-inside:avoid;min-height:24px;font-size:9pt}'+
   'table{border-collapse:collapse;width:100%;table-layout:fixed;font-size:8.5pt;line-height:1.22}th,td{border:1px solid #d8e3ed;padding:3px 5px;overflow-wrap:anywhere;word-break:break-word;vertical-align:top}th{background:#e9f2f9;color:#173d61;text-align:start}tr{break-inside:avoid}tbody tr:nth-child(even){background:#f8fbff}'+
   '.pfm82-footer{position:absolute;bottom:9mm;left:12mm;right:12mm;height:7mm;display:flex;align-items:center;justify-content:center;gap:2mm;direction:ltr;color:#1b436b;font-size:8.4pt;border-top:1px solid #e4ecf4;padding-top:2mm}'+
   '.pfm82-footer img{width:6.5mm;height:6.5mm;object-fit:contain}.pfm82-empty{padding:20px;text-align:center;color:#65798b}'+
   '@media screen{html,body{background:#eef2f5}.pfm82-page{margin:14px auto;box-shadow:0 2px 18px #0002}}';
  return '<!DOCTYPE html><html dir="'+rtl+'" lang="'+(en()?'en':'ar')+'"><head><meta charset="utf-8"/>'+
   '<meta name="viewport" content="width=device-width, initial-scale=1"/>'+
   '<meta name="pfm-report-engine" content="V8.2-semantic"/>'+
   '<title>'+e(named(ctx))+' — Poultry Farm Management</title><style>'+css+'</style></head>'+
   '<body class="pfm82-modern"><article id="pfm59PrintRoot">'+pages.join('')+'</article></body></html>';
 }
 async function logoData(){
  const src=new URL('./pfm-logo.png',document.baseURI).href;
  const response=await fetch(src);
  if(!response.ok)throw Error(tr('الشعار الأصلي غير متاح؛ أُلغي تصدير PDF لمنع ملف ناقص.','Original logo unavailable; PDF export cancelled.'));
  const blob=await response.blob();
  if(blob.size<100||blob.size>3000000)throw Error('Invalid approved logo');
  return new Promise((resolve,reject)=>{
   const reader=new FileReader();
   reader.onload=()=>resolve(reader.result);
   reader.onerror=()=>reject(reader.error||Error('Logo encoding failed'));
   reader.readAsDataURL(blob);
  });
 }
 function printInWeb(html){
  return new Promise((resolve,reject)=>{
   const frame=document.createElement('iframe');
   frame.style.cssText='position:fixed;width:1px;height:1px;left:-10000px;top:0;border:0';
   frame.setAttribute('aria-hidden','true');document.body.appendChild(frame);
   frame.onload=()=>{
    try{
     const win=frame.contentWindow;
     let done=false;
     const finish=()=>{if(done)return;done=true;setTimeout(()=>frame.remove(),1000);resolve({ok:true,printDialog:true})};
     win.addEventListener('afterprint',finish,{once:true});
     win.focus();win.print();
     // Some iOS print previews never fire afterprint; do not remove the
     // iframe before the OS has had a chance to read document contents.
     setTimeout(finish,30000);
    }catch(err){frame.remove();reject(err)}
   };
   frame.srcdoc=html;
  });
 }
 async function exportPDF(action){
  if(exporting)throw Error(tr('عملية PDF قيد التنفيذ بالفعل.','Another PDF export is running.'));
  exporting=true;
  try{
   const ctx=env();
   const originalLogo=await logoData();
   const html=render(ctx,originalLogo);
   const name='PFM-'+ctx.view.id+'-'+new Date().toISOString().slice(0,10)+'.pdf';
   if(window.Capacitor?.isNativePlatform?.()&&window.Capacitor?.getPlatform?.()==='android'){
    const native=window.PFMAndroidExport;
    if(!native)throw Error('Android native PDF bridge missing');
    const fn=action==='save'?'savePDF':action==='share'?'sharePDF':'printHTML';
    return await native[fn](html,name);
   }
   if(typeof window.PFMDesktopPrint?.savePDF==='function')
    return await window.PFMDesktopPrint.savePDF(html,name,action);
   if(action!=='print'){
    alert(tr('في إصدار iOS/المتصفح، استخدم نافذة الطباعة ثم حفظ كـPDF أو المشاركة من نافذة النظام. لم يتم إرسال الملف تلقائيًا.',
     'On iOS/browser, use system print preview to save/share as PDF. Nothing has been sent automatically.'));
   }
   return await printInWeb(html);
  }finally{exporting=false;}
 }
 function close(){if(modal)modal.hidden=true}
 function open(){
  if(!modal){
   modal=document.createElement('div');
   modal.id='pfm82-pdf-options';modal.hidden=true;
   modal.innerHTML='<div class="pfm82-sheet" role="dialog" aria-modal="true"><h3>'+tr('تقرير PDF احترافي','Professional PDF report')+'</h3>'+
    '<p>'+tr('تقرير A4 من البيانات مباشرة، بدون تصوير شاشة البرنامج. اختر العملية:',
     'Structured A4 report from records, not a screenshot. Choose an action:')+'</p>'+
    '<div class="pfm82-choices"><button data-choice="print">'+tr('طباعة','Print')+'</button>'+
    '<button data-choice="save">'+tr('حفظ PDF','Save PDF')+'</button>'+
    '<button data-choice="share">'+tr('مشاركة PDF','Share PDF')+'</button>'+
    '<button data-choice="cancel">'+tr('إلغاء','Cancel')+'</button></div></div>';
   const style=document.createElement('style');style.id='pfm82-pdf-options-style';
   style.textContent='#pfm82-pdf-options[hidden]{display:none!important}#pfm82-pdf-options{position:fixed;inset:0;background:#0b253d99;display:grid;place-items:center;z-index:999999;padding:16px}'+
    '.pfm82-sheet{max-width:460px;width:100%;background:white;border-radius:14px;padding:20px;box-shadow:0 10px 36px #1124;direction:rtl;color:#163b62}'+
    '.pfm82-sheet h3{margin:0 0 8px}.pfm82-sheet p{font-size:13px;line-height:1.6}.pfm82-choices{display:grid;grid-template-columns:1fr 1fr;gap:9px}'+
    '.pfm82-choices button{border:1px solid #b4cde1;border-radius:8px;padding:13px;background:#eef6fd;color:#153b62;font-weight:bold;cursor:pointer}'+
    '.pfm82-choices button:hover{background:#d8eafa}';
   document.head.appendChild(style);document.body.appendChild(modal);
   modal.addEventListener('click',async event=>{
    const value=event.target.closest('[data-choice]')?.dataset.choice;
    if(!value){if(event.target===modal)close();return;}
    close();
    if(value==='cancel')return;
    try{
     const result=await exportPDF(value);
     if(result&&!result.ok&&!result.canceled)throw Error(result.error||'PDF export unsuccessful');
    }catch(err){
     console.error('Universal PDF:',err);
     alert(tr('تعذر إنشاء PDF: ','Unable to export PDF: ')+err.message);
    }
   });
   document.addEventListener('keydown',ev=>{if(ev.key==='Escape')close()});
  }
  modal.hidden=false;modal.querySelector('button')?.focus();
 }
 window.PFMModernPDF={open,exportPDF,buildHTML:async()=>render(env(),await logoData()),version:'8.2-semantic'};
})();
