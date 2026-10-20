/* V5.9: print a clean, results-only report for the current screen.
   This module does not read/write persistent storage or change data calculations. */
(function(){'use strict';
 const $=id=>document.getElementById(id);
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const en=()=>document.documentElement.lang==='en';
 const tr=(ar,english)=>en()?english:ar;
 const isVisible=el=>{if(!el)return false;for(let n=el;n&&n!==document.body;n=n.parentElement){if(n.hidden||n.classList?.contains('pfm57-filtered-out'))return false; const v=getComputedStyle(n);if(v.display==='none'||v.visibility==='hidden')return false;}return true;};
 function title(view){return view.querySelector(':scope > h2')?.textContent.trim() || (view.id==='dash'?tr('لوحة التحكم الرئيسية','Main Dashboard'):view.id);}
 function heading(root,view){
   const tool=view.querySelector(':scope > .pfm57-toolbar'),val=role=>{
     const el=tool?.querySelector('[data-pfm57-role="'+role+'"]');
     if(role==='search')return el?.value?.trim()||'';
     return el?.selectedOptions?.[0]?.textContent?.trim()||tr('الكل','All');
   };
   const stamp=new Date().toLocaleString(en()?'en-GB':'ar-EG',{dateStyle:'medium',timeStyle:'short'});
   root.innerHTML='<div class="pfm59-print-head">'+
    '<div class="pfm59-print-brand"><img src="./pfm-logo.png" alt="M.K™"/><div><strong>'+e(title(view))+'</strong><small>Poultry Farm Manager · M.K™</small></div></div>'+
    '<div class="pfm59-print-time">'+e(stamp)+'</div></div>'+
    '<div class="pfm59-print-scopes"><span>'+tr('الدورة','Cycle')+': <b>'+e(val('cycle'))+'</b></span><span>'+tr('المزرعة','Farm')+': <b>'+e(val('farm'))+'</b></span><span>'+tr('العنبر','House')+': <b>'+e(val('house'))+'</b></span>'+
    (val('search')?'<span>'+tr('البحث','Search')+': <b>'+e(val('search'))+'</b></span>':'')+'</div>';
 }
 // Preserve the actual onscreen palette, borders and accent colors in printable clones.
 // Layout dimensions are deliberately NOT frozen so rows can paginate across paper.
 const visualProperties=['background-color','background-image','color','border-top-color','border-right-color','border-bottom-color','border-left-color','border-radius'];
 function cloneVisual(node){
   const c=node.cloneNode(true),source=[node,...node.querySelectorAll('*')],target=[c,...c.querySelectorAll('*')];
   source.forEach((el,i)=>{
     if(!(el instanceof Element)||!(target[i] instanceof Element))return;
     const style=getComputedStyle(el),dst=target[i];
     for(const key of visualProperties){const val=style.getPropertyValue(key);
       if(val&&val!=='none'&&val!=='rgba(0, 0, 0, 0)'&&val!=='transparent')dst.style.setProperty(key,val,'important');}
   });
   return c;
 }
 // Print all filtered records, including rows omitted by the on-screen 150-row pager.
 // Generate the missing rows directly from read-only DB state; do not re-render
 // the live form (which could discard the user's unsaved field values).
 function completePagedRows(original,copy){
  const key={dailyTable:'daily',weightTable:'weights',feedTable:'feed',medTable:'meds'}[original.tBodies?.[0]?.id];
  const data=typeof db!=='undefined'?db:null;
  if(!key||!data||!Array.isArray(data[key])||data[key].length<=150)return;
  const state=window.PFM57Diagnostics?.state||{};
  const cycles=new Map((data.cycles||[]).map(c=>[c.id,c]));
  const farms=new Map((data.farms||[]).map(f=>[f.id,f.name]));
  const houses=new Map((data.houses||[]).map(h=>[h.id,h.name]));
  const norm=v=>String(v??'').toLocaleLowerCase(),fm=c=>farms.get(c?.farmId)||'',hm=c=>houses.get(c?.houseId)||'';
  const name=c=>fm(c)+' — '+hm(c);
  const ordinal=c=>typeof cycleOrdinal==='function'?cycleOrdinal(c):c?.cycleNumber||'';
  const current=new Set([...original.tBodies[0].querySelectorAll('[data-id]')].map(el=>el.dataset.id));
  let selected=[...data[key]].sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
  const farmPicker=document.getElementById(key==='feed'?'feedFarmFilter':key==='meds'?'medFarmFilter':null);
  const housePicker=document.getElementById(key==='feed'?'feedHouseFilter':key==='meds'?'medHouseFilter':null);
  const fid=(key==='feed'||key==='meds')?farmPicker?.value||'':'';
  const hids=(key==='feed'||key==='meds')&&housePicker?[...housePicker.selectedOptions].map(o=>o.value).filter(v=>v&&v!=='__ALL__'):[];
  const needle=norm(state.search||'').trim();
  selected=selected.filter(r=>{
    const c=cycles.get(r.cycleId);if(!c)return false;
    if(window.PFMGlobalCycleScope&&!window.PFMGlobalCycleScope(c))return false;
    if(fid&&c.farmId!==fid)return false;
    if(hids.length&&!hids.includes(c.houseId))return false;
    const hay=norm([JSON.stringify(r),c.date,c.breed,fm(c),hm(c),'الدورة '+ordinal(c)].join(' '));
    return !needle||hay.includes(needle);
  });
  if(selected.length<=current.size)return;
  const totalDeaths=new Map(),prefix=new Map();
  if(key==='daily')for(const r of [...data.daily].sort((a,b)=>String(a.date||'').localeCompare(String(b.date||'')))){
     const x=(totalDeaths.get(r.cycleId)||0)+(+r.dead||0);totalDeaths.set(r.cycleId,x);prefix.set(r.id,x);
  }
  const cur=r=>String(r.currency||data.settings?.currency||'SAR');
  const num=(v,n=0)=>Number.isFinite(+v)?Number(v).toFixed(n):'-';
  const rowValues=r=>{
    const c=cycles.get(r.cycleId),a=typeof age==='function'?age(c,r.date):'-';
    if(key==='daily')return [r.date,name(c),c.breed||'-',a,r.dead,r.cull,r.feed,r.water||0,r.weight||'-',r.temp??'-',r.humidity??'-',c.birds?num((prefix.get(r.id)||0)/c.birds*100,2)+'%':'-',r.notes||'-'];
    if(key==='weights')return [r.date,name(c),c.breed||'-',a,r.sample,num(r.avg,3),r.min?num(r.min,3):'-',r.max?num(r.max,3):'-',r.sd?num(r.sd,3):'-',r.cv?num(r.cv,2)+'%':'-'];
    if(key==='feed')return [r.date,fm(c),hm(c),r.date+' / '+(c.breed||'-'),r.type,r.qty,r.price+' '+cur(r),num((+r.qty||0)*(+r.price||0),2)+' '+cur(r)];
    return [r.date,fm(c),hm(c),c.date,r.type,r.name,r.qty,num(r.cost,2)+' '+cur(r),r.withdrawal];
  };
  const body=copy.tBodies[0];if(!body)return;
  const first=body.querySelector('tr');
  for(const r of selected){if(current.has(r.id))continue;
    const tr=document.createElement('tr');tr.className='pfm60-complete-row';
    for(const val of rowValues(r)){const td=document.createElement('td');td.textContent=String(val??'');tr.appendChild(td);}
    body.appendChild(tr);
  }
 }
 function completeAuditRows(original,copy){
   if(original.tBodies?.[0]?.id!=='auditTable'||typeof db==='undefined'||!Array.isArray(db.auditLog))return;
   const records=db.auditLog.slice(300),body=copy.tBodies?.[0];if(!body||!records.length)return;
   for(const a of records){
     const c=document.createElement('tr');
     const fields=[new Date(a.createdAt).toLocaleString('ar-EG'),a.userName||a.userId||'-',
       (db.farms||[]).find(f=>f.id===a.farmId)?.name||'',a.action||'',
       (a.entity||'')+' '+(a.recordId?String(a.recordId).slice(0,8):''),JSON.stringify(a.details||{},null,2)];
     for(const value of fields){const td=document.createElement('td');td.textContent=String(value);c.appendChild(td);}
     body.appendChild(c);
   }
 }
 function cleanTable(table){
   if(!isVisible(table))return null;
   const clone=cloneVisual(table);clone.removeAttribute('id');
   const oldRows=[...table.querySelectorAll('tr')],newRows=[...clone.querySelectorAll('tr')];
   oldRows.forEach((r,i)=>{if(!isVisible(r))newRows[i]?.remove();});
   // Remove action cells everywhere, including unlabeled columns with edit/delete buttons.
   const headers=[...table.querySelectorAll('thead tr:last-child th')];
   const actions=new Set(headers.flatMap((h,i)=>/^(الإجراءات|الإجراء|Actions?|Edit|حذف|تعديل)$/i.test(h.textContent.trim())?[i]:[]));
   const trs=[...table.querySelectorAll('tbody tr')];
   if(trs.some(r=>r.lastElementChild?.querySelector('button,[onclick]'))&&headers.length)actions.add(headers.length-1);
   if(headers.length&&headers.at(-1).textContent.trim()==='')actions.add(headers.length-1);
   [...actions].sort((a,b)=>b-a).forEach(idx=>clone.querySelectorAll('tr').forEach(r=>r.children[idx]?.remove()));
   clone.querySelectorAll('button,input,select,textarea,[contenteditable],.pfm-perf-more,.actions,.no-print').forEach(x=>x.remove());
   clone.querySelectorAll('tr').forEach(r=>{r.classList.remove('pfm57-filtered-out');r.removeAttribute('hidden');});
   if(!clone.querySelector('tbody tr')){const tbody=clone.querySelector('tbody');if(tbody){const count=clone.querySelectorAll('thead th').length||1;tbody.innerHTML='<tr><td colspan="'+count+'">'+tr('لا توجد نتائج في النطاق المحدد.','No results within the selected scope.')+'</td></tr>';}}
   clone.classList.add('pfm59-result-table');
   completePagedRows(table,clone);
   completeAuditRows(table,clone);
   return clone;
 }
 function addBlock(root,el,cls){if(!el||!isVisible(el))return false;const c=cloneVisual(el);c.removeAttribute('id');if(cls)c.classList.add(cls);c.querySelectorAll('button,input,select,textarea,.pfm57-toolbar,.no-print,.screen-footer,.pfm-perf-more').forEach(x=>x.remove());root.appendChild(c);return true;}
 function addTables(root,view){
  let count=0;const seen=new Set();
  for(const table of view.querySelectorAll('table')){
    if(table.closest('.pfm57-toolbar,.pfm57-settings-panel,.no-print,.v53-legacy-dash,.v53-old-dashboard-title'))continue;
    if(!isVisible(table))continue;
    const original=table.closest('.panel,.v410-table-scroll')||table.parentElement;
    const key=original?.classList.contains('panel')?original:table;
    if(seen.has(table))continue;seen.add(table);
    const clone=cleanTable(table);if(!clone)continue;
    const box=document.createElement('section');box.className='pfm59-table-section panel';
    if(original){const comp=getComputedStyle(original);['background-color','color','border-color','border-radius'].forEach(prop=>{
      const value=comp.getPropertyValue(prop);if(value&&value!=='rgba(0, 0, 0, 0)')box.style.setProperty(prop,value,'important');
    });}
    const nearby=table.closest('.panel')?.querySelector('h3');
    if(nearby){const h=cloneVisual(nearby);h.removeAttribute('id');box.appendChild(h);}
    box.appendChild(clone);root.appendChild(box);count++;
  }
  return count;
 }
 function content(root,view){
   if(view.id==='dash'){
     const overview=$('v53-overview');if(overview&&overview.children.length){
       const clone=cloneVisual(overview);clone.removeAttribute('id');clone.classList.add('pfm59-dashboard');
       clone.querySelectorAll('button,input,select,textarea,.no-print').forEach(n=>n.remove());
       root.appendChild(clone);return;
     }
   }
   if(view.id==='reports'){
     const report=$('printReport');if(report?.textContent.trim()){addBlock(root,report,'pfm59-report');return;}
   }
   if(view.id==='compare'){
     if(addBlock(root,$('comparisonBox'),'pfm59-comparison'))return;
   }
   if(view.id==='performance'){
     if(addBlock(root,$('performanceBox'),'pfm59-performance'))return;
   }
   // The financial screen is a five-tab workspace. A complete PDF must include
   // all five tabs and the full ledger, not only the one visible when Print is clicked.
   // Build it read-only from the same V5.2 source functions; do not mutate live tabs.
   if(view.id==='finance'&&typeof window.PFM_V52?.buildPrintSnapshot==='function'){
     const section=document.createElement('section');
     section.className='pfm67-print-all-finance';
     section.innerHTML=window.PFM_V52.buildPrintSnapshot();
     root.appendChild(section);
     return;
   }
   if(view.id==='finance')addBlock(root,$('financeBox'),'pfm59-finance');
   if(view.id==='settings'){
     for(const id of ['globalStandardPanel','reportStandardCatalog']){const element=$(id);if(element&&isVisible(element))addBlock(root,element,'pfm59-summary');}
   }
   if(view.id==='users'){const element=$('membersBox');if(element&&isVisible(element))addBlock(root,element,'pfm59-summary');}
   if(view.id==='backup'){
     const status=view.querySelector('.note:not(.no-print)');if(status)addBlock(root,status,'pfm59-summary');
   }
   const tables=addTables(root,view);
   if(tables===0&&root.children.length<=2){
     for(const selector of ['.cards','.pfm53-overview','.v52-chart','.v410-table-scroll','.report']){
       const blocks=[...view.querySelectorAll(selector)].filter(x=>!x.closest('.no-print,.pfm57-toolbar')&&isVisible(x)&&!x.querySelector('input,select,textarea'));
       for(const x of blocks.slice(0,15))addBlock(root,x,'pfm59-summary');
     }
   }
   if(root.children.length<=2){const p=document.createElement('p');p.className='pfm59-empty';p.textContent=tr('لا توجد نتائج قابلة للطباعة في النطاق المحدد.','No printable results within the selected scope.');root.appendChild(p);}
 }
let activePrint=null,activeFrame=null;
 function clean(){
   if(activePrint?.isConnected)activePrint.remove();activePrint=null;
   if(activeFrame?.isConnected)activeFrame.remove();activeFrame=null;
   document.body.classList.remove('pfm59-printing');
 }
 function build(){const view=document.querySelector('main > section.view.active');if(!view)throw Error('No active screen');clean();
  const root=document.createElement('article');root.id='pfm59PrintRoot';root.setAttribute('dir',document.documentElement.dir||'rtl');root.lang=document.documentElement.lang||'ar';
  heading(root,view);content(root,view);
  const footer=document.createElement('footer');footer.className='pfm59-print-footer';footer.textContent='Poultry Farm Manager · M.K™';root.appendChild(footer);
  document.body.appendChild(root);activePrint=root;document.body.classList.add('pfm59-printing');
  return root;
 }
 // Print from an isolated document, without the application's old @media print
 // directives that hide the main dashboard and restrict output to #reports.
 function stylesheetText(){
   const s=[...document.styleSheets].find(sheet=> (sheet.href&&/pfm-v59-print-results\.css(?:[?#]|$)/.test(sheet.href)) || (sheet.ownerNode?.textContent?.includes('V5.9 clean, results-only print styling')));
   try{return s?[...s.cssRules].map(r=>r.cssText).join('\n'):'';}catch(_){return '';}
 }
 function standalone(root){
   const base=e(document.baseURI||'about:blank');
   const css=stylesheetText();
   const android=window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform?.()==='android';
   const printCopy=android?root.cloneNode(true):root;
   // Unified V8 A4 footer, owned by the printable document itself.
   // Chromium repeats fixed elements on each physical print page.
   // Uses the app's ORIGINAL pfm-logo.png; never a generated substitute.
   const identityFooter='<div class="pfm-native-a4-footer" aria-label="Poultry Farm Management M.K™">'+
     '<span>Poultry Farm Management M.K™</span>'+
     '<img src="./pfm-logo.png" alt="Poultry Farm Management"/></div>';
   const identityCss='<style>@page{size:A4 landscape;margin:11mm 11mm 19mm;}@media print{'+
     'body.pfm59-printing > .pfm-native-a4-footer:not(#pfm59PrintRoot){position:fixed!important;display:flex!important;bottom:0!important;left:50%!important;right:auto!important;'+
     'transform:translateX(-50%)!important;display:flex!important;align-items:center!important;'+
     'justify-content:center!important;gap:2.5mm!important;direction:ltr!important;'+
     'width:max-content!important;max-width:95%!important;height:12mm!important;'+
     'color:#193a5d!important;font:600 10pt Arial,sans-serif!important;white-space:nowrap!important;'+
     'visibility:visible!important;z-index:999999!important;}'+
     '.pfm-native-a4-footer img{width:10mm!important;height:10mm!important;object-fit:contain!important;display:block!important;}'+
     '}@media screen{.pfm-native-a4-footer{display:none!important}}</style>';
   if(android){const foot=printCopy.querySelector('.pfm59-print-footer');if(foot){foot.replaceChildren();const img=document.createElement('img');img.src='./pfm-logo.png';img.alt='M.K™';foot.appendChild(img);}}
   const cssLink=css?'<style>'+css.replace(/<\/style/gi,'<\\/style')+'</style>':'<link rel="stylesheet" href="./pfm-v59-print-results.css"/>';
   const safeTitle=e(root.querySelector('.pfm59-print-brand strong')?.textContent||'Poultry Farm Manager');
   return '<!DOCTYPE html><html dir="'+(document.documentElement.dir||'rtl')+'" lang="'+(document.documentElement.lang||'ar')+'"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><base href="'+base+'"/><title>'+safeTitle+'</title>'+cssLink+identityCss+(root.querySelector('.pfm67-print-all-finance')?'<link rel="stylesheet" href="./v52-finance.css"/><link rel="stylesheet" href="./pfm-v67-finance-print.css"/>':'')+(android?'<link rel="stylesheet" href="./pfm-v736-android-print.css"/>':'')+'<style>html,body{background:#fff!important;margin:0!important;padding:0!important;}body.pfm59-printing #pfm59PrintRoot{display:block!important;}@media print{html,body{height:auto!important;overflow:visible!important;}}@media screen{body.pfm59-printing #pfm59PrintRoot{display:block!important;}}</style></head><body class="pfm59-printing">'+printCopy.outerHTML+identityFooter+'</body></html>';
 }
 // Use a full-sized printable document; a 1px iframe can clip print pages in Chrome.
 function waitForReady(doc){return Promise.all([
    doc.fonts?.ready?.catch?.(()=>{})||Promise.resolve(),
    Promise.all([...doc.images].map(im=>im.complete?Promise.resolve():new Promise(done=>{im.addEventListener('load',done,{once:true});im.addEventListener('error',done,{once:true});setTimeout(done,2500);})))
   ]);}
 // Print directly through an isolated full-size iframe in the same tab.
 // Do not use window.open: Chrome otherwise leaves an unwanted about:blank tab
 // behind its print dialog. Keep the frame mounted until afterprint so Chrome
 // can complete long-page pagination before the document is released.
 let printPending=false;
 window.PFMPrintResults59=function(action='print'){
  if(printPending)return;
  try{
    const root=build(),html=standalone(root);
    // Electron has no Chromium-style print preview: generate a real multi-page
    // PDF from this exact result-only snapshot, then show a native Save dialog.
    // Browser/Chrome continues using the original iframe printing path below.
    if(window.Capacitor?.isNativePlatform?.() && window.Capacitor.getPlatform()==='android'){
      if(!window.PFMAndroidExport)throw Error('Android PDF export module unavailable');
      const name='PFM-Report-'+new Date().toISOString().slice(0,10)+'.pdf';
      if(activePrint?.isConnected)activePrint.remove();activePrint=null;
      document.body.classList.remove('pfm59-printing');
      const method=action==='save'?'savePDF':action==='share'?'sharePDF':'printHTML';
      printPending=true;
      window.PFMAndroidExport[method](html,name).catch(err=>{
        console.error('Android PDF '+method,err);
        alert(tr('تعذر إعداد PDF: ','Could not create PDF: ')+err.message);
      }).finally(()=>{printPending=false;clean();});
      return;
    }
    if(typeof window.PFMDesktopPrint?.savePDF==='function'){
      const screenTitle=root.querySelector('.pfm59-print-brand strong')?.textContent?.trim()||'Report';
      const fileName='PFM-'+screenTitle+'-'+new Date().toISOString().slice(0,10)+'.pdf';
      if(activePrint?.isConnected)activePrint.remove();activePrint=null;
      document.body.classList.remove('pfm59-printing');
      printPending=true;
      window.PFMDesktopPrint.savePDF(html,fileName).then(result=>{
        if(!result?.ok&&!result?.canceled)alert(tr('تعذّر حفظ PDF: ','Could not save PDF: ')+(result?.error||'Unknown error'));
      }).catch(err=>{console.error('PFM desktop PDF:',err);alert(tr('تعذّر حفظ PDF: ','Could not save PDF: ')+err.message);})
      .finally(()=>{printPending=false;clean();});
      return;
    }
    // This browser document is independent of the application's old @media print
    // directives. It therefore keeps the coloured dashboard, all results and
    // multi-page report layout without opening an extra browser tab.
    const frame=document.createElement('iframe');frame.id='pfm59PrintableFrame';
    frame.title=tr('طباعة نتائج الشاشة','Print screen results');
    frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
    // Unlike a display:none or 1px frame, a full-size rendered frame
    // permits Chromium to paginate arbitrarily long tables correctly.
    frame.style.cssText='position:fixed;left:-13000px;top:0;width:1120px;height:820px;border:0;opacity:0;pointer-events:none;';
    document.body.appendChild(frame);activeFrame=frame;
    const doc=frame.contentDocument;
    if(!doc)throw Error('Print frame document is unavailable');
    doc.open();doc.write(html);doc.close();
    // The original root is a source snapshot only. Keep the isolated document.
    if(activePrint?.isConnected)activePrint.remove();activePrint=null;
    document.body.classList.remove('pfm59-printing');
    printPending=true;
    let completed=false;
    const finish=()=>{
      if(completed)return;
      completed=true;printPending=false;
      if(activeFrame===frame)clean();
    };
    frame.contentWindow.addEventListener('afterprint',()=>setTimeout(finish,450),{once:true});
    waitForReady(doc).then(()=>{
      if(activeFrame!==frame){printPending=false;return;}
      // Allow layout to finish after fonts/images are ready, particularly SVG
      // charts and summary cards with print-specific grid rules.
      return new Promise(resolve=>frame.contentWindow.requestAnimationFrame(()=>frame.contentWindow.requestAnimationFrame(resolve)));
    }).then(()=>{
      if(activeFrame!==frame)return;
      try{printPending=false;frame.contentWindow.focus();frame.contentWindow.print();}
      catch(err){finish();console.error('PFM iframe print:',err);alert(tr('تعذّرت الطباعة: ','Print failed: ')+err.message);}
    }).catch(err=>{
      console.error('PFM print ready:',err);finish();alert(tr('تعذّر تجهيز الطباعة: ','Could not prepare print: ')+err.message);
    });
  }catch(err){console.error('PFM print:',err);printPending=false;clean();alert(tr('تعذّر إعداد الطباعة: ','Could not prepare print: ')+err.message);}
 };
 window.PFM59PrintDiagnostics={build,clean,standalone,stylesheetText};
})();
