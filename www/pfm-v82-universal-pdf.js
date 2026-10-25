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
 function named(ctx){
  const heading=ctx.view.querySelector(':scope > h2')?.textContent;
  return txt(heading)||({dash:tr('لوحة التحكم الرئيسية','Main Dashboard'),inventory:tr('المشتريات والمخزون','Purchases & Inventory')}[ctx.view.id]||ctx.view.id);
 }
 function render(ctx,logo){
  const tables=dataset(ctx);
  if(!tables.length)tables.push(...semanticTables(ctx));
  // When a specialist page has no DB adapter or structured table, include
  // read-only brief result panels. Never inject live forms or SVG screenshots.
  const stats=summary(ctx),e=escape;
  const bar=ctx.bar;
  const scope=k=>txt(bar?.querySelector('[data-pfm57-role="'+k+'"]')?.selectedOptions?.[0]?.textContent);
  const scopeText=[tr('الدورة','Cycle')+': '+(scope('cycle')||tr('الكل','All')),
   tr('المزرعة','Farm')+': '+(scope('farm')||tr('الكل','All')),
   tr('العنبر','House')+': '+(scope('house')||tr('الكل','All'))].join(' • ');
  const count=tables.reduce((a,s)=>a+(ctx.filters.search?
   s.rows.filter(row=>row.join(' ').toLocaleLowerCase().includes(ctx.filters.search)).length:s.rows.length),0);
  const sections=tables.map(tab=>{
   const rows=ctx.filters.search?
    tab.rows.filter(row=>row.join(' ').toLocaleLowerCase().includes(ctx.filters.search)):tab.rows;
   if(rows.length>12000)throw Error(tr('عدد الصفوف كبير جدًا للتصدير مرة واحدة؛ حدد دورة أو مزرعة.','Too many rows for one PDF; filter by farm or cycle.'));
   const heading=({daily:tr('المتابعة اليومية','Daily Records'),weights:tr('الأوزان الأسبوعية','Weekly Weights'),
    farms:tr('المزارع','Farms'),houses:tr('العنابر','Houses'),cycles:tr('دورات التربية','Cycles'),
    feed:tr('استهلاك العلف','Feed Consumption'),meds:tr('العلاج والتحصينات','Health Records'),
    invoices:tr('فواتير المشتريات','Purchase Invoices'),lots:tr('دفعات المخزون','Stock Lots'),
    issues:tr('حركات صرف المخزون','Stock Issues'),sales:tr('المبيعات','Sales'),
    'farm-status':tr('ملخص الإنتاج حسب المزرعة','Farm Production Overview'),
    'daily-trends':tr('ملخص المتابعة اليومية','Daily Monitoring Summary')}[tab.key]||tab.key);
   const head='<thead><tr>'+tab.headers.map(h=>'<th>'+e(h)+'</th>').join('')+'</tr></thead>';
   const body=rows.length?rows.map(row=>'<tr>'+row.map(v=>'<td>'+e(v)+'</td>').join('')+'</tr>').join(''):
    '<tr><td colspan="'+tab.headers.length+'" class="empty">'+tr('لا توجد سجلات في النطاق المحدد.','No records in selected scope.')+'</td></tr>';
   return '<section class="report-section"><div class="section-heading"><h2>'+e(heading)+'</h2><span>'+rows.length+' '+tr('سجل','records')+'</span></div>'+
    (tab.note?'<p class="note">'+e(tab.note)+'</p>':'')+
    '<table>'+head+'<tbody>'+body+'</tbody></table></section>';
  }).join('');
  const boxes=stats.length?'<div class="metrics">'+stats.map(([name,value])=>
   '<div class="metric"><div class="metric-label">'+e(name)+'</div><div class="metric-value">'+e(value)+'</div></div>').join('')+'</div>':'';
  const issueTime=new Date().toLocaleString(en()?'en-GB':'ar-EG');
  const rtl=en()?'ltr':'rtl';
  const body=sections||(!boxes?'<p class="empty">'+tr('لا توجد نتائج قابلة للتصدير في هذا النطاق.','No exportable results for this scope.')+'</p>':'');
  const css='@page{size:A4 landscape;margin:14mm 13mm 24mm}'+
   '*{box-sizing:border-box}html,body{padding:0;margin:0;background:#fff;color:#173653;font-family:Arial,Tahoma,sans-serif;direction:'+rtl+'}'+
   'body{font-size:10pt;line-height:1.5}#pfm59PrintRoot{width:100%;padding:0;margin:0}'+
   '.cover-head{border-bottom:2px solid #20456c;padding:0 0 14px;display:flex;align-items:center;justify-content:space-between;gap:16px;break-inside:avoid}'+
   '.cover-head .brand{display:flex;align-items:center;gap:11px;min-width:0}.cover-head .brand img{width:44px;height:44px;object-fit:contain}'+
   '.cover-head h1{font-size:19pt;margin:0 0 3px;color:#123657}.cover-head .subtitle{font-size:8pt;color:#56718b}'+
   '.stamp{font-size:8pt;color:#536c83;white-space:nowrap;text-align:start}'+
   '.scopes{margin:10px 0;background:#eef4f9;border:1px solid #d8e5ef;padding:8px 11px;border-radius:5px;font-size:9pt;break-inside:avoid}'+
   '.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0 16px}.metric{min-width:0;border:1px solid #dce6ee;border-top:3px solid #20527f;border-radius:5px;padding:8px 11px;break-inside:avoid}'+
   '.metric-label{font-size:8pt;color:#597188}.metric-value{font-weight:700;font-size:12pt;color:#173d64;overflow-wrap:anywhere}'+
   '.report-section{margin:14px 0 18px;page-break-inside:auto}.section-heading{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #cddce9;padding-bottom:5px;margin-bottom:8px;break-after:avoid;break-inside:avoid}'+
   '.section-heading h2{font-size:12pt;color:#173d64;margin:0}.section-heading span{font-size:8pt;color:#667b8d}.note{font-size:8pt;color:#526c83}'+
   'table{border-collapse:collapse;width:100%;table-layout:auto;font-size:8.5pt}thead{display:table-header-group}tfoot{display:table-footer-group}'+
   'th{background:#e9f1f8;color:#173d64;font-weight:700;text-align:start}th,td{padding:5px 7px;border:1px solid #d6e1eb;vertical-align:top;overflow-wrap:anywhere}'+
   'tr{break-inside:avoid;page-break-inside:avoid}tbody tr:nth-child(even){background:#f8fbfd}.empty{text-align:center;color:#7b8794;padding:15px}'+
   '.footer{position:fixed;bottom:-2mm;left:0;right:0;height:7mm;display:flex;gap:2mm;align-items:center;justify-content:center;direction:ltr;font-size:8pt;font-weight:700;color:#1a4169}'+
   '.footer img{width:7mm;height:7mm;object-fit:contain}'+
   '@media screen{body{max-width:1100px;margin:auto;padding:18px}.footer{display:none}}';
  return '<!DOCTYPE html><html dir="'+rtl+'" lang="'+(en()?'en':'ar')+'"><head><meta charset="utf-8"/>'+
   '<meta name="viewport" content="width=device-width,initial-scale=1"/>'+
   '<meta name="pfm-report-engine" content="V8.2-semantic"/>'+
   '<title>'+e(named(ctx))+' — Poultry Farm Management</title><style>'+css+'</style></head>'+
   '<body class="pfm82-modern"><article id="pfm59PrintRoot"><div class="cover-head"><div class="brand">'+
   '<img src="'+e(logo)+'" alt="M.K"/><div><h1>'+e(named(ctx))+'</h1><div class="subtitle">Poultry Farm Management · M.K™ — '+
   e(tr('تقرير بيانات','Data Report'))+'</div></div></div><div class="stamp">'+e(issueTime)+'</div></div>'+
   '<div class="scopes">'+e(scopeText)+' · '+e(tr('عدد السجلات: ','Records: '))+count+'</div>'+
   boxes+body+'</article><div class="footer"><img src="'+e(logo)+'" alt="M.K"/><span>Poultry Farm Management M.K™</span></div></body></html>';
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
