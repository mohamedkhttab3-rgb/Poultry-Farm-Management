(function(){
'use strict';
const $=id=>document.getElementById(id);
const safe=t=>String(t??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
const n=v=>Math.max(0,Number(v)||0), format=(v,d=0)=>Number.isFinite(Number(v))?Number(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const src=()=>typeof db==='object'&&db?db:null;
const en=()=>document.documentElement.lang==='en';
const lang=(ar,eng)=>en()?eng:ar;
const noData=()=>lang('لا توجد سجلات كافية لهذا الرسم','Not enough data for this chart');
const color={green:'#099e58',red:'#de324a',orange:'#ef960a',blue:'#1579e8',violet:'#7a36c6',cyan:'#119dcc',navy:'#0e2b57'};
const paths={bird:'<path d="M16 7h.01M2 17a4 4 0 0 0 5 4h4a9 9 0 0 0 9-9v-2l2-2-3-1a4 4 0 0 0-7-2 7 7 0 0 1-7 6H4a4 4 0 0 0-2 6zM6 21l-2 1M11 21l2 1"/>',home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',farm:'<path d="M3 21V9l9-6 9 6v12M9 21v-7h6v7M3 10h18"/>',cycle:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 9a7 7 0 0 1 12-3l3 6M19 15a7 7 0 0 1-12 3l-3-6"/>',calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 18h2"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',weight:'<path d="M8 6a4 4 0 1 1 8 0M5 9h14l2 12H3L5 9z"/><circle cx="12" cy="13" r="2"/>',feed:'<path d="M4 19h16M6 15h12M8 11h8M10 7h4M4 19l2-4h12l2 4M8 11l2-4h4l2 4"/>',water:'<path d="M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13z"/>',money:'<path d="M9 4a3 3 0 1 0 6 0M8 7c-3 3-5 6-5 10a5 5 0 0 0 5 5h8a5 5 0 0 0 5-5c0-4-3-8-5-10H8z"/><path d="M14.8 12.5c-.8-1-4.5-1-4.5.8s4.6.6 4.6 2.4c0 1.7-3.7 1.8-5.1.6M12 10v9"/>',chart:'<path d="M3 3v18h18M6 16l5-5 4 3 6-8"/><path d="M16 6h5v5"/>',bars:'<path d="M3 21V3M3 21h18"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="7" width="3" height="11"/><rect x="16" y="4" width="3" height="14"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/><path d="M12 3v9l5-5"/>',lightning:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',settings:'<circle cx="12" cy="12" r="3"/><path d="m10 2 4 0 .7 2.5 2 1 2.5-1 2 3.5-2 2 .1 2 2 2-2 3.5-2.5-1-2 1-.8 2.5h-4l-.7-2.5-2-1-2.5 1-2-3.5 2-2v-2l-2-2 2-3.5 2.5 1 2-1z"/>',chevron:'<path d="m6 9 6 6 6-6"/>',arrow:'<path d="M7 17 17 7M8 7h9v9"/>',mort:'<circle cx="12" cy="12" r="8"/><path d="M9 9l6 6M15 9l-6 6"/>',users:'<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M17 15a4 4 0 0 1 4 4v1"/>',report:'<path d="M6 2h8l4 4v16H6zM14 2v5h5M9 11h6M9 15h6M9 19h4"/>'};
function icon(key,size=20){return `<svg class="pfm53-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[key]||paths.chart}</svg>`;}
const farmOptions=()=>{const data=src();return data?data.farms:[]};
function groupRecords(){const data=src(),fid=$('dashboardFarm')?.value||'',hid=$('dashboardHouse')?.value||'',cid=$('v53Cycle')?.value||'';return (data?.cycles||[]).filter(c=>(!fid||c.farmId===fid)&&(!hid||c.houseId===hid)&&(!cid||c.id===cid)&&(!window.PFMGlobalCycleScope||window.PFMGlobalCycleScope(c)));}
function delta(a,b,lowerGood=false){if(!(Number.isFinite(a)&&Number.isFinite(b)&&b>0))return null;const diff=(a-b)/b*100;return {num:diff,good:lowerGood?diff<=0:diff>=0};}
function marker(value,kind){if(value==null)return `<span class="pfm53-kpi-tag neutral">${lang('بدون مقارنة','No comparison')}</span>`;return `<span class="pfm53-kpi-tag ${value.good?'good':'bad'}">${value.num>=0?'↑':'↓'} ${format(Math.abs(value.num),1)}%</span>`;}
function topTile({title,english,value,unit,iconType,tone,comparison,foot}){let u=en()?english:title;
 return `<article class="pfm53-kpi pfm53-tone-${tone}"><div class="pfm53-kpi-top"><span class="pfm53-kpi-icon">${icon(iconType,30)}</span><div class="pfm53-kpi-main"><div class="pfm53-kpi-title">${safe(u)}</div><div class="pfm53-kpi-value">${value}</div><div class="pfm53-kpi-unit">${unit}</div></div></div><div class="pfm53-kpi-bottom">${comparison?marker(comparison):`<span class="pfm53-kpi-sub">${safe(foot||'')}</span>`}<span class="pfm53-minibars"><i></i><i></i><i></i></span></div></article>`;}
function secondTile({title,english,value,unit,iconType,tone,foot}){return `<article class="pfm53-mini pfm53-tone-${tone}"><div class="pfm53-mini-head"><span class="pfm53-mini-icon">${icon(iconType,27)}</span><div><div class="pfm53-mini-title">${safe(lang(title,english))}</div><div class="pfm53-mini-value">${value} <small>${unit}</small></div></div></div><div class="pfm53-mini-footer">${safe(foot||'')}</div></article>`;}
function money(v,currency){return format(v,2)+' '+safe(currency)}
function lineChart(points,standard){if(!points.length)return `<div class="pfm53-empty">${icon('chart',25)} ${noData()}</div>`;
 const width=480,height=185,L=42,R=12,T=10,B=32,plotW=width-L-R,plotH=height-T-B;
 const all=[...points.map(p=>p.val),...standard.map(p=>p.val)].filter(Number.isFinite),min=0,max=Math.max(.1,...all)*1.14;
 const ages=points.concat(standard).map(p=>p.day).filter(Number.isFinite);const minAge=Math.max(0,Math.min(...ages,0)),maxAge=Math.max(1,...ages);
 const x=day=>L+((day-minAge)/Math.max(1,maxAge-minAge))*plotW,y=val=>T+plotH-(val/max)*plotH;
 const line=arr=>arr.map((p,i)=>(i?'L':'M')+x(p.day).toFixed(1)+' '+y(p.val).toFixed(1)).join(' ');
 const tks=[0,.25,.5,.75,1].map(r=>{const py=T+(1-r)*plotH;return `<line x1="${L}" y1="${py}" x2="${width-R}" y2="${py}" stroke="#e5edf4"/><text x="${L-7}" y="${py+4}" text-anchor="end" fill="#647b95" font-size="11">${format(max*r,1)}</text>`}).join('');
 const xs=[0,.25,.5,.75,1].map(r=>`<text x="${L+r*plotW}" y="${height-8}" text-anchor="middle" fill="#647b95" font-size="11">${Math.round(minAge+r*(maxAge-minAge))}</text>`).join('');
 return `<svg class="pfm53-chartsvg" role="img" aria-label="${lang('منحنى الوزن حسب العمر','Weight growth by age')}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">${tks}${xs}${standard.length?`<path d="${line(standard)}" stroke="#12b76a" fill="none" stroke-width="2.5" stroke-dasharray="7 6"/>`:''}<path d="${line(points)}" fill="none" stroke="#2385f6" stroke-width="3" stroke-linecap="round"/>${points.map(p=>`<circle cx="${x(p.day)}" cy="${y(p.val)}" r="3.8" fill="#2385f6" stroke="#fff" stroke-width="1.4"/>`).join('')}</svg>`;}
function mortalityChart(points){if(!points.length)return `<div class="pfm53-empty">${icon('bars',25)} ${noData()}</div>`;
 const width=480,height=185,L=43,R=12,T=10,B=30,plotW=width-L-R,plotH=height-T-B;
 const mx=Math.max(.01,...points.map(p=>p.val))*1.15;const bars=points.slice(-24);
 const ticks=[0,.25,.5,.75,1].map(r=>{const yy=T+plotH*(1-r);return `<line x1="${L}" y1="${yy}" x2="${width-R}" y2="${yy}" stroke="#e5edf4"/><text x="${L-7}" y="${yy+4}" text-anchor="end" fill="#647b95" font-size="11">${format(r*mx,1)}%</text>`}).join('');
 let bb=bars.map((p,i)=>{const bw=plotW/bars.length,ht=p.val/mx*plotH;return `<rect x="${L+i*bw+bw*.17}" y="${T+plotH-ht}" width="${Math.max(4,bw*.66)}" height="${ht}" rx="1.5" fill="#ff707c"/>`}).join('');
 const labelN=Math.min(6,bars.length);let xx=Array.from({length:labelN},(_,i)=>{const idx=Math.round(i*Math.max(0,bars.length-1)/Math.max(1,labelN-1)),p=bars[idx],x=L+(idx+.5)*plotW/bars.length;return `<text x="${x}" y="${height-6}" text-anchor="middle" fill="#647b95" font-size="11">${p.day}</text>`}).join('');
 return `<svg class="pfm53-chartsvg" role="img" aria-label="${lang('نسبة النفوق اليومية','Daily mortality rate')}" viewBox="0 0 ${width} ${height}">${ticks}${bb}${xx}</svg>`;}
function donutChart(items){const valid=items.filter(x=>x.value>0);if(!valid.length)return `<div class="pfm53-empty">${noData()}</div>`;
 const total=valid.reduce((sum,x)=>sum+x.value,0);let offset=0;const palette=['#2486fd','#16b981','#ffb81b','#8b5de5','#f87171'];
 const circles=valid.map((x,i)=>{const size=x.value/total*100,part=`<circle r="64" cx="82" cy="82" fill="none" stroke="${palette[i%palette.length]}" stroke-width="25" stroke-dasharray="${size} ${100-size}" stroke-dashoffset="${-offset}" pathLength="100" transform="rotate(-90 82 82)"/>`;offset+=size;return part;}).join('');
 const legend=valid.map((x,i)=>`<div class="pfm53-donut-row"><span class="pfm53-dot" style="background:${palette[i%palette.length]}"></span><strong>${format(x.value/total*100,1)}%</strong><span>${safe(x.label)}</span></div>`).join('');
 return `<div class="pfm53-donut-wrap"><svg width="165" height="165" viewBox="0 0 164 164" role="img" aria-label="${lang('توزيع الأعلاف المسجلة','Recorded feed distribution')}"><circle r="64" cx="82" cy="82" fill="none" stroke="#eff4f9" stroke-width="25"/>${circles}<text x="82" y="78" text-anchor="middle" font-size="11" fill="#566c84">${lang('إجمالي العلف','Total feed')}</text><text x="82" y="96" text-anchor="middle" font-size="16" fill="#092c58" font-weight="800">${format(total,0)}</text><text x="82" y="109" text-anchor="middle" font-size="10" fill="#566c84">${lang('كجم','kg')}</text></svg><div class="pfm53-donut-legend">${legend}</div></div>`;}
function chartPanel(title,english,iconName,body,footer){return `<section class="pfm53-panel pfm53-chart-panel"><h3><span class="pfm53-panel-icon">${icon(iconName,20)}</span>${safe(lang(title,english))}</h3>${body}${footer?`<div class="pfm53-chart-foot">${footer}</div>`:''}</section>`;}
function finPanel(cost,revenue,profit,currency){if(currency===lang('عملات متعددة','Multiple currencies'))return `<section class="pfm53-panel pfm53-fin-panel"><h3>${lang('الملخص المالي','Financial Summary')}</h3><p class="pfm53-empty">${lang('النطاق يحتوي على دورات بعملات مختلفة. اختر دورة أو مزرعة بعملة واحدة لعرض إجماليات مالية صحيحة.','The selection includes different currencies. Choose cycles using one currency to see valid financial totals.')}</p></section>`;const rows=[['إجمالي التكاليف','Total Costs',cost,'expense'],['إجمالي المبيعات','Total Revenue',revenue,'revenue'],['الربح / الخسارة','Profit / Loss',profit,'profit']];return `<section class="pfm53-panel pfm53-fin-panel"><h3><span class="pfm53-panel-icon">${icon('money',21)}</span>${lang('الملخص المالي للدورة','Cycle Financial Summary')}</h3><div class="pfm53-fin-list">${rows.map(r=>`<div class="pfm53-fin-row ${r[3]}"><strong>${money(r[2],currency)}</strong><span>${lang(r[0],r[1])}</span></div>`).join('')}${revenue>0?`<div class="pfm53-fin-row ratio"><strong>${format(profit/revenue*100,1)}%</strong><span>${lang('هامش النتيجة المالية','Financial Margin')}</span></div>`:''}</div><p class="pfm53-tiny">${lang('النتيجة مرحلية حتى الإغلاق المالي النهائي','Figures are provisional until financial close')}</p></section>`;}
function stdPanel(arr){if(arr.length!==1)return `<section class="pfm53-panel"><h3><span class="pfm53-panel-icon">${icon('target',20)}</span>${lang('مقارنة الأداء بمعايير السلالة','Breed Standard Comparison')}</h3><div class="pfm53-empty">${lang('اختر دورة واحدة للمقارنة بمعايير سلالتها','Select a single cycle to compare with breed standards')}</div></section>`;
 const c=arr[0],z=calc(c),std=typeof standardCatalogForCycle==='function'?standardCatalogForCycle(c):null;
 let ref=std&&typeof standardAtAgeCatalog==='function'?standardAtAgeCatalog(std,Math.max(1,age(c))):null;
 const rows=[['متوسط الوزن (كجم)','Average Weight (kg)',z.w,ref?.weight!=null?ref.weight/1000:null,false],['معامل التحويل FCR','FCR',z.fcr,ref?.fcr??null,true],['الزيادة اليومية ADG','Daily Gain ADG',z.adg,ref?.adg??null,false]];
 return `<section class="pfm53-panel"><h3><span class="pfm53-panel-icon pfm53-purple">${icon('target',20)}</span>${lang('مقارنة الأداء بمعايير السلالة','Breed Standard Comparison')}</h3>${ref?`<p class="pfm53-tiny">${safe(std.key||c.breed||'')}</p>`:''}<table class="pfm53-standards"><thead><tr><th>${lang('المؤشر','Metric')}</th><th>${lang('الفعلي','Actual')}</th><th>${lang('المعيار','Target')}</th><th>${lang('الفرق','Change')}</th></tr></thead><tbody>${rows.map(r=>{let diff=r[2]>0&&r[3]!=null&&r[3]>0?(r[2]-r[3])/r[3]*100:null,good=diff==null?false:r[4]?diff<=0:diff>=0;return `<tr><td>${lang(r[0],r[1])}</td><td>${r[2]>0?format(r[2],2):'—'}</td><td>${r[3]!=null?format(r[3],2):'—'}</td><td class="${diff==null?'':good?'pfm53-good':'pfm53-bad'}">${diff==null?'—':(diff>0?'+':'')+format(diff,1)+'%'}</td></tr>`}).join('')}</tbody></table>${!ref?`<p class="pfm53-tiny">${lang('لم يتم ربط معيار عالمي بهذه الدورة','No breed standard linked to this cycle')}</p>`:''}</section>`;}
function quickPanel(cycles,arr,received,live,dead,feed,water,fcr,weight){const active=arr.filter(c=>c.active),ages=active.map(c=>age(c)).filter(Number.isFinite);const avg=ages.length?ages.reduce((s,x)=>s+x,0)/ages.length:null;const liveAvg=received?live/received*100:null;
 const data=[['عدد الدورات المحددة','Selected Cycles',arr.length,'cycle'],['العمر الحالي','Current Age',avg==null?'—':format(avg,0)+' '+lang('يوم','days'),'calendar'],['نسبة النفوق','Mortality Rate',received?format(dead/received*100,2)+'%':'—','mort'],['متوسط استهلاك العلف','Feed per Chick',received?format(feed/received,2)+' '+lang('كجم','kg'):'—','feed'],['متوسط استهلاك المياه','Water per Chick',received?format(water/received,2)+' '+lang('لتر','L'):'—','water']];
 return `<section class="pfm53-panel"><h3><span class="pfm53-panel-icon pfm53-yellow">${icon('lightning',20)}</span>${lang('أهم المؤشرات السريعة','Quick Indicators')}</h3><div class="pfm53-quick-list">${data.map(x=>`<div><span class="pfm53-quick-icon">${icon(x[3],16)}</span><strong>${x[2]}</strong><span>${lang(x[0],x[1])}</span></div>`).join('')}</div></section>`;}
function buildFeedItems(arr){const data=src();if(!data)return[];const ids=new Set(arr.map(c=>c.id));const result={};for(const item of data.feed||[]){if(!ids.has(item.cycleId)||!(typeof isPastOrToday==='function'?isPastOrToday(item.date):true))continue;const key=String(item.type||item.feedType||item.name||'غير مصنف').trim()||'غير مصنف';result[key]=(result[key]||0)+n(item.qty)}return Object.entries(result).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value);}
function cycleGraphData(c){const data=src();let start=new Date((c?.date||'').slice(0,10)+'T00:00:00');if(!Number.isFinite(+start))start=new Date();const days=d=>Math.max(0,Math.round((new Date(String(d||'').slice(0,10)+'T00:00:00')-start)/86400000));
 const ws=(data.weights||[]).filter(r=>r.cycleId===c.id&&n(r.avg)>0).map(r=>({day:days(r.date),val:n(r.avg)}));
 const dws=(data.daily||[]).filter(r=>r.cycleId===c.id&&n(r.weight)>0).map(r=>({day:days(r.date),val:n(r.weight)}));
 const byDay=new Map();[...ws,...dws].forEach(p=>byDay.set(p.day,p));const all=[...byDay.values()].sort((a,b)=>a.day-b.day);
 let standard=[];const cat=typeof standardCatalogForCycle==='function'?standardCatalogForCycle(c):null;if(cat&&typeof standardAtAgeCatalog==='function'&&all.length){for(const pt of all){const a=standardAtAgeCatalog(cat,Math.max(1,pt.day));if(a&&a.weight!=null)standard.push({day:pt.day,val:a.weight/1000})}}
 const mortality=(data.daily||[]).filter(r=>r.cycleId===c.id&&n(r.dead)>=0).map(r=>({day:days(r.date),dead:n(r.dead)})).sort((a,b)=>a.day-b.day);const received=n(c.birds);return {weights:all,standard,mortality:mortality.map(p=>({day:p.day,val:received?p.dead/received*100:0}))};}
function aggregateGraphData(arr){
 if(arr.length===1)return cycleGraphData(arr[0]);
 const collect={weights:new Map(),standard:new Map(),mortality:new Map()};
 for(const c of arr){const weight=n(c.birds)||1,g=cycleGraphData(c);
   for(const key of ['weights','standard','mortality'])for(const row of g[key]){
     const old=collect[key].get(row.day)||{sum:0,mass:0};old.sum+=row.val*weight;old.mass+=weight;collect[key].set(row.day,old);
   }
 }
 const output={};for(const key of Object.keys(collect))output[key]=[...collect[key].entries()].map(([day,v])=>({day,val:v.mass?v.sum/v.mass:0})).sort((a,b)=>a.day-b.day);
 return output;
}
/* Restore original 18 independent stage names and their original order;
   keep the existing onclick handlers, permission attributes and route IDs intact. */
function navIcons(){
  const nav=$('v53-nav'); if(!nav) return;
  const stages=[
    ['الرئيسية','Dashboard'],
    ['المزارع','Farms'],
    ['العنابر','Houses'],
    ['الدورات','Cycles'],
    ['المتابعة اليومية','Daily Monitoring'],
    ['الأوزان الأسبوعية','Weekly Weights'],
    ['الأعلاف','Feed'],
    ['الأدوية والتحصينات','Health & Vaccination'],
    ['المخزون','Inventory'],
    ['المبيعات والحصاد','Sales & Harvest'],
    ['التكاليف والأرباح','Costs & Profits'],
    ['أداء العنابر','House Performance'],
    ['معايير السلالات','Breed Standards'],
    ['مقارنة الدورات','Cycle Comparison'],
    ['التقارير','Reports'],
    ['المستخدمون والصلاحيات','Users & Permissions'],
    ['الإعدادات','Settings'],
    ['سجل التدقيق','Audit Log'],
    ['النسخ الاحتياطي','Backup']
  ];
  stages.forEach(([ar,english],i)=>{
    const b=nav.querySelector('button[data-stage="'+(i+1)+'"]');
    if(!b)return;
    const label=lang(ar,english);
    b.textContent=label;
    b.setAttribute('aria-label',label);
  });
}
function showLogo(){const root=$('pfm53-toplogo');if(!root)return;const old=document.querySelector('header .pfm-logo');if(old){root.innerHTML='';const copy=old.cloneNode(true);copy.removeAttribute('id');root.appendChild(copy)}}
function ensureLayout(){const section=$('dash'),scope=$('v53-scope');if(!section||!scope)return;section.classList.add('pfm53-reference');
 const oldHead=section.querySelector('.v53-dashboard-head');if(oldHead)oldHead.style.display='none';
 let top=$('pfm53-topbar');if(!top){top=document.createElement('div');top.id='pfm53-topbar';top.className='pfm53-topbar';top.innerHTML=`<div class="pfm53-identity"><div id="pfm53-toplogo"></div><div><strong>${lang('إدارة مزارع الدواجن','Poultry Farm Management')}</strong><small>Poultry Farm Manager</small><small>M.K™</small></div></div><div class="pfm53-top-scopes" id="pfm53-top-scopes"></div><div class="pfm53-datetime">${icon('calendar',18)}<span id="pfm53-date"></span>${icon('clock',18)}<span id="pfm53-time"></span></div>`;section.insertBefore(top,section.firstChild);}
 const container=$('pfm53-top-scopes');if(scope.parentElement!==container)container.appendChild(scope);showLogo();const identity=top.querySelector('.pfm53-identity strong');if(identity)identity.textContent=lang('إدارة مزارع الدواجن','Poultry Farm Management');
 const now=new Date(),day=Intl.DateTimeFormat(en()?'en-US':'ar-EG',{weekday:'short',day:'numeric',month:'short',year:'numeric'}).format(now);$('pfm53-date').textContent=day;$('pfm53-time').textContent=Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit'}).format(now);
 const legacy=$('dashboardFarm')?.closest('.scope-pair-grid');if(legacy){legacy.style.display='none';[['المزرعة','Farm',$('dashboardFarm'),'farm'],['العنبر','House',$('dashboardHouse'),'home']].forEach(([a,b,element,ic])=>{if(!element)return;let box=scope.querySelector('.pfm53-filter-'+ic);if(!box){box=document.createElement('div');box.className='pfm53-filter pfm53-filter-'+ic;box.innerHTML=`<label>${icon(ic,16)} ${lang(a,b)}</label>`;scope.appendChild(box)}box.appendChild(element)})}
 if(!$('v53Cycle')){const box=document.createElement('div');box.className='pfm53-filter pfm53-filter-cycle';box.innerHTML=`<label>${icon('cycle',16)} ${lang('الدورة','Cycle')}</label><select id="v53Cycle"><option value="">${lang('كل الدورات','All cycles')}</option></select>`;scope.appendChild(box)}
 for(const field of scope.querySelectorAll('.pfm53-filter')){const label=field.querySelector('label'),input=field.querySelector('select');if(label&&input){const key=input.id,kind=key==='dashboardFarm'?'farm':key==='dashboardHouse'?'home':'cycle';label.innerHTML=icon(kind,16)+' '+(key==='dashboardFarm'?lang('المزرعة','Farm'):key==='dashboardHouse'?lang('العنبر','House'):lang('الدورة','Cycle'));}}
 navIcons();
}
function render(){const data=src(),section=$('dash'),target=$('v53-overview'),farm=$('dashboardFarm'),house=$('dashboardHouse'),cycle=$('v53Cycle');if(!data||!section||!target||!farm||!house||!cycle)return;
 ensureLayout();
 const old=cycle.value,available=(data.cycles||[]).filter(c=>(!farm.value||c.farmId===farm.value)&&(!house.value||c.houseId===house.value));
 const newOptions=`<option value="">${lang('كل الدورات','All cycles')}</option>`+available.map(c=>`<option value="${safe(c.id)}">${lang('الدورة','Cycle')} ${cycleOrdinal(c)} · ${safe(getHouseName(c.houseId))}</option>`).join('');
 if(cycle.innerHTML!==newOptions){cycle.innerHTML=newOptions;if(old&&available.some(x=>x.id===old))cycle.value=old;}
 const arr=groupRecords(),ids=new Set(arr.map(c=>c.id));let rec=0,live=0,dead=0,cull=0,sold=0,feed=0,water=0,cost=0,rev=0,gain=0,weighted=0,weightedBirds=0;
 for(const c of arr){const z=calc(c),lc=n(currentLive(c));rec+=n(c.birds);live+=lc;dead+=n(deadTotal(c));cull+=n(cullTotal(c));sold+=n(saleBirdsTotal(c));feed+=n(z.feed);gain+=n(z.gain);if(z.w>0&&lc>0){weighted+=z.w*lc;weightedBirds+=lc}cost+=n(z.cost);rev+=n(z.rev)}
 const curr=[...new Set(arr.map(c=>getCycleCurrency(c)))];const currency=curr.length>1?lang('عملات متعددة','Multiple currencies'):(curr[0]||getCycleCurrency());
 for(const item of data.daily||[]){if(ids.has(item.cycleId)&&isPastOrToday(item.date))water+=n(item.water??item.waterLiters??item.waterConsumed)}
 const w=weightedBirds?weighted/weightedBirds:0,fcr=gain>0?feed/gain:0,profit=rev-cost;const active=arr.filter(c=>c.active),single=arr.length===1?arr[0]:active.length===1?active[0]:null;
 const allFarmCount=new Set(arr.map(c=>c.farmId)).size, allHouseCount=new Set(arr.map(c=>c.houseId)).size;
 const std=single&&typeof standardCatalogForCycle==='function'?standardCatalogForCycle(single):null;const expected=std&&typeof standardAtAgeCatalog==='function'?standardAtAgeCatalog(std,Math.max(1,age(single))):null;
 const livePercent=rec?live/rec*100:0;
 const tile1=[
 {title:'إجمالي الطيور الحية',english:'Live Birds',value:format(live),unit:lang('طائر','birds'),iconType:'bird',tone:'green',foot:rec?format(livePercent,1)+'% '+lang('من الاستقبال','of received'):''},
 {title:'إجمالي النافق',english:'Total Mortality',value:format(dead),unit:lang('طائر','birds'),iconType:'mort',tone:'red',foot:rec?format(dead/rec*100,2)+'% '+lang('من الاستقبال','of received'):''},
 {title:'إجمالي المستبعد',english:'Total Culled',value:format(cull),unit:lang('طائر','birds'),iconType:'bird',tone:'orange',foot:rec?format(cull/rec*100,2)+'% '+lang('من الاستقبال','of received'):''},
 {title:'متوسط الوزن الحالي',english:'Average Live Weight',value:w>0?format(w,2):'—',unit:lang('كجم','kg'),iconType:'weight',tone:'blue',comparison:w>0&&expected?.weight>0?delta(w,expected.weight/1000):null},
 {title:'معامل التحويل الغذائي',english:'Feed Conversion Ratio',value:fcr>0?format(fcr,3):'—',unit:'FCR',iconType:'feed',tone:'violet',comparison:fcr>0&&expected?.fcr>0?delta(fcr,expected.fcr,true):null}
 ];
 const refAge=single?age(single):null;
 const tile2=[
 {title:'عدد الكتاكيت المستلمة',english:'Chicks Received',value:format(rec),unit:lang('طائر','birds'),iconType:'bird',tone:'red',foot:lang('الاستقبال المسجل للدورات المختارة','Recorded cycle reception')},
 {title:'عمر الدورة الحالية',english:'Current Cycle Age',value:refAge!=null?format(refAge):'—',unit:lang('يوم','days'),iconType:'calendar',tone:'green',foot:single?`${lang('الدورة','Cycle')} ${cycleOrdinal(single)}`:lang('اختر دورة واحدة','Select one cycle')},
 {title:'المياه المستهلكة',english:'Water Consumed',value:format(water,0),unit:lang('لتر','L'),iconType:'water',tone:'blue',foot:rec?lang('لكل كتكوت','Per received chick')+' '+format(water/rec,2)+' '+lang('لتر','L'):''},
 {title:'العلف المستهلك',english:'Feed Consumed',value:format(feed,0),unit:lang('كجم','kg'),iconType:'feed',tone:'orange',foot:rec?lang('لكل كتكوت','Per received chick')+' '+format(feed/rec,2)+' '+lang('كجم','kg'):''}
 ];
 const chart=arr.length?aggregateGraphData(arr):null;
 const weightChart=chartPanel('منحنى نمو الوزن','Weight Growth Curve','chart',chart?lineChart(chart.weights,chart.standard):`<div class="pfm53-empty">${noData()}</div>`,chart?.weights?.length?`<span class="pfm53-legend-dot blue"></span>${lang('الوزن المسجل','Actual')} ${chart.standard.length?`<span class="pfm53-legend-dot green"></span>${lang('معيار السلالة','Breed standard')}`:''}`:'');
 const mortChart=chartPanel('معدل النفوق اليومي','Daily Mortality Rate','bars',chart?mortalityChart(chart.mortality):`<div class="pfm53-empty">${noData()}</div>`,chart?.mortality.length?`<span class="pfm53-legend-dot red"></span>${lang('نسبة النفوق اليومي من عدد الاستقبال','Daily mortality as % of received')}`:'');
 const feedChart=chartPanel('توزيع العلف المستخدم','Feed Distribution','bars',donutChart(buildFeedItems(arr)),'');
 target.innerHTML=`<div class="pfm53-kpi-row">${tile1.slice().reverse().map(topTile).join('')}</div><div class="pfm53-second-row">${tile2.map(secondTile).join('')}</div><div class="pfm53-chart-row">${feedChart}${mortChart}${weightChart}</div><div class="pfm53-bottom-row">${quickPanel(data.cycles||[],arr,rec,live,dead,feed,water,fcr,w)}${stdPanel(arr)}${finPanel(cost,rev,profit,currency)}</div>`;
}
function init(){const dash=$('dash');if(!dash||dash.dataset.pfm53Loaded)return;dash.dataset.pfm53Loaded='1';ensureLayout();
 const farm=$('dashboardFarm'),house=$('dashboardHouse'),cycle=$('v53Cycle');
 const reRender=()=>{try{render()}catch(e){console.warn('Dashboard refresh:',e)}};
 if(farm)farm.addEventListener('change',()=>{if(cycle)cycle.value='';queueMicrotask(reRender)});
 if(house)house.addEventListener('change',()=>{if(cycle)cycle.value='';queueMicrotask(reRender)});
 if(cycle)cycle.addEventListener('change',reRender);
 const original=window.renderAll;
 if(typeof original==='function')window.renderAll=function(){const result=original.apply(this,arguments);if($('dash')?.classList.contains('active'))reRender();return result};
 window.v53Render=reRender;
 window.v53ToggleGroup=function(button){const group=button?.closest('.v53-nav-group');if(!group)return;const open=group.classList.toggle('v53-open');button.setAttribute('aria-expanded',String(open));};
 // renderAll already refreshes the dashboard on navigation; do not draw it again.
 reRender();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,0));else setTimeout(init,0);
})();
