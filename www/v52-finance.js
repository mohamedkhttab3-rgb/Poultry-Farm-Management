/* Poultry Farm Management V5.2 — simplified financial workspace.
   Presentation layer only: original V4.10 ledgers and posting/closing functions remain the sources of truth.
   All charts/drilldowns derive from current saved operational data; no invented financial entries. */
(function(){'use strict';
 const $=id=>document.getElementById(id);
 const T=(ar,en)=>typeof uiLanguage==='function'&&uiLanguage()==='en'?en:ar;
 const n=x=>Number(x)||0;
 const m=x=>Math.round((n(x)+Number.EPSILON)*100)/100;
 const text=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const f=x=>m(x).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
 const lbl=(ar,en)=>`<span data-v410-ar="${text(ar)}" data-v410-en="${text(en)}">${text(T(ar,en))}</span>`;
 const palette={chicks:'#4779be',feed:'#eca34a',meds:'#27a6a5',other:'#9876c6',income:'#36a86d',alert:'#c75f69'};
 let active='summary',expanded='',ready=false,lastCycle='';
 const cSelected=()=>typeof cyc==='function'?cyc($('finCycle')?.value):null;
 const cycleRows=(source,c)=>Array.isArray(db[source])?db[source].filter(r=>r.cycleId===c.id):[];
 const ledger=()=>db.v410||{};
 const categoryExpenses=c=>typeof financeExpensesForCycle==='function'?financeExpensesForCycle(c.id):((db.finance[c.id]||{}).expenses||[]);
 function rowsFor(c,x){
  const feed=cycleRows('feed',c).filter(r=>isPastOrToday(r.date)).map(r=>{
    const move=(ledger().movements||[]).find(v=>v.sourceType==='feed'&&v.sourceId===r.id&&v.kind==='issue');
    const lot=(ledger().lots||[]).find(l=>l.id===move?.lotId);
    return {date:r.date||'',title:r.type||T('علف','Feed'),detail:[lot?.invoice||lot?.id?.slice(0,8),`${n(r.qty)} ${T('كجم','kg')} × ${f(r.price)}`].filter(Boolean).join(' · '),amount:m(n(r.qty)*n(r.price)),source:'feed'};
  });
  const meds=cycleRows('meds',c).filter(r=>isPastOrToday(r.date)).map(r=>{
    const move=(ledger().movements||[]).find(v=>v.sourceType==='med'&&v.sourceId===r.id&&v.kind==='issue');
    const lot=(ledger().lots||[]).find(l=>l.id===move?.lotId);
    return {date:r.date||'',title:r.name||T('دواء / تحصين','Medicine / vaccine'),detail:[lot?.invoice,n(r.qty)>0?`${n(r.qty)} ${r.unit||''}`:null].filter(Boolean).join(' · '),amount:m(r.cost),source:'meds'};
  });
  const expenses=categoryExpenses(c).map(row=>{
    const d=(ledger().expenses||{})[row.id];return {date:d?.date||'',title:row.category||row.name||T('مصروف','Expense'),detail:[d?.invoice,d?.supplier,d?.note].filter(Boolean).join(' · '),amount:m(row.amount),source:'other'};
  });
  const chick=(db.finance[c.id]?.chicks||0)>0?[{date:c.date||'',title:T('شراء الكتاكيت وتكاليف الاستقبال','Chick purchase and reception'),detail:ledger().chicks?.[c.id]?T('فاتورة التكلفة المسجلة','Recorded invoice cost'):T('قيمة مسجلة بالإصدار السابق','Legacy recorded value'),amount:m(db.finance[c.id].chicks),source:'chicks'}]:[];
  const sales=cycleRows('sales',c).filter(r=>isPastOrToday(r.date)).map(r=>({date:r.date||'',title:T('عملية بيع','Sale'),detail:`${typeof saleRowBirds==='function'?saleRowBirds(c,r):n(r.birds)} ${T('طائر','birds')} · ${f(typeof saleWeightKg==='function'?saleWeightKg(c,r):n(r.weightKg))} ${T('كجم','kg')}`,amount:m(typeof saleRowRevenue==='function'?saleRowRevenue(r):r.total),source:'sales',frozen:r.v410Snapshot}));
  const otherRev=n(db.finance[c.id]?.otherRevenue)>0?[{date:'',title:T('إيرادات أخرى للدورة','Other cycle revenue'),detail:T('غير مرتبط بتاريخ مستقل','No separate date recorded'),amount:m(db.finance[c.id].otherRevenue),source:'revenue'}]:[];
  return {chicks:chick,feed,meds,other:expenses,sales,revenue:otherRev};
 }
 function parts(c,x){return {chicks:m(n(db.finance[c.id]?.chicks)),feed:m(x.fc),meds:m(x.meds),other:m(x.expenseTotal)};}
 function sum(arr){return m(arr.reduce((z,r)=>z+n(r.amount),0));}
 function card(key,title,value,help,tone=''){return `<button class="v52-stat ${tone}" type="button" data-v52-drill="${key}" aria-expanded="${expanded===key?'true':'false'}"><span>${title}</span><strong>${value}</strong><small>${help||''} <b class="v52-see">${T('التفاصيل ←','Details →')}</b></small></button>`;}
 function pie(values){const keys=['feed','chicks','meds','other'],total=keys.reduce((s,k)=>s+Math.max(0,values[k]),0);if(!total)return `<div class="v52-empty">${T('لا توجد تكاليف مسجلة للدورة.','No cycle costs have been recorded.')}</div>`;
  let pct=0;const steps=keys.map(k=>{const start=pct;pct+=Math.max(0,values[k])/total*100;return `${palette[k]} ${start.toFixed(4)}% ${pct.toFixed(4)}%`});
  const names={feed:T('الأعلاف','Feed'),chicks:T('الكتاكيت','Chicks'),meds:T('الأدوية والتحصينات','Medicines & vaccines'),other:T('التشغيل','Operations')};
  return `<div class="v52-pie-wrap"><div class="v52-pie" style="background:conic-gradient(${steps.join(',')})" role="img" aria-label="${text(T('رسم توزيع تكاليف الدورة','Cycle cost distribution chart'))}"><div class="v52-pie-hole"><b>${f(total)}</b><small>${T('إجمالي التكاليف','Total costs')}</small></div></div><div class="v52-legend">${keys.map(k=>`<button type="button" data-v52-drill="${k}"><i style="background:${palette[k]}"></i><span>${names[k]}</span><b>${(values[k]/total*100).toFixed(1)}%</b></button>`).join('')}</div></div>`;
 }
 function bars(vals,x){const max=Math.max(x.cost,x.rev,1);const data=[['cost',T('التكاليف','Costs'),x.cost,'#e59c44'],['revenue',T('الإيرادات','Revenues'),x.rev,'#249d7f']];return `<div class="v52-bars">${data.map(([key,title,val,color])=>`<div class="v52-bar-col"><b>${f(val)}</b><div class="v52-bar-track"><div class="v52-bar" style="height:${Math.max(0,val/max*100)}%;background:${color}"></div></div><span>${title}</span></div>`).join('')}</div>`;}
 function timeline(c,x,rs){
  // Daily movements are plotted at their recorded dates. Undated legacy items are shown as a separate terminal adjustment.
  const events=[];for(const k of ['chicks','feed','meds','other','sales','revenue'])for(const r of rs[k])events.push({day:r.date,delta:k==='sales'||k==='revenue'?'income':'cost',amount:r.amount});
  const daily=new Map(),undated={cost:0,income:0};for(const e of events){if(!/^\d{4}-\d{2}-\d{2}$/.test(e.day||'')){undated[e.delta]+=e.amount;continue}const r=daily.get(e.day)||{day:e.day,cost:0,income:0};r[e.delta]+=e.amount;daily.set(e.day,r)}
  let items=[...daily.values()].sort((a,b)=>a.day.localeCompare(b.day));let runningCost=0,runningIncome=0;items=items.map(a=>{runningCost+=a.cost;runningIncome+=a.income;return {label:a.day,cost:m(runningCost),income:m(runningIncome)}});
  // Last terminal point is an accounting balance, never presented as a dated event.
  if(!items.length)items=[{label:T('البداية','Start'),cost:0,income:0}];
  if(Math.abs(x.cost-runningCost)>0.009||Math.abs(x.rev-runningIncome)>0.009)items.push({label:T('رصيد إجمالي','Balance'),cost:m(x.cost),income:m(x.rev),undated:true});
  if(items.length===1)items.push({label:T('الإجمالي','Total'),cost:m(x.cost),income:m(x.rev)});
  if(items.length>14){const first=items[0],last=items[items.length-1];items=[first,...items.slice(1,-1).filter((_,i)=>i%Math.ceil((items.length-2)/11)===0),last]}
  const W=640,H=224,left=46,right=20,top=20,bottom=38,dx=W-left-right,dy=H-top-bottom,denom=Math.max(...items.flatMap(a=>[a.cost,a.income]),1);
  const xy=(i,v)=>`${(left+i*dx/Math.max(items.length-1,1)).toFixed(1)},${(top+dy-(Math.max(0,v)/denom)*dy).toFixed(1)}`;
  const paths=['cost','income'].map((key,i)=>`<polyline fill="none" stroke="${i?'#249d7f':'#e59c44'}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round" points="${items.map((r,j)=>xy(j,r[key])).join(' ')}"/>`).join('');
  const dots=items.map((r,j)=>`<circle cx="${xy(j,r.cost).split(',')[0]}" cy="${xy(j,r.cost).split(',')[1]}" r="3.2" fill="#e59c44"><title>${text(r.label)} · ${T('التكاليف','Costs')}: ${f(r.cost)}</title></circle><circle cx="${xy(j,r.income).split(',')[0]}" cy="${xy(j,r.income).split(',')[1]}" r="3.2" fill="#249d7f"><title>${text(r.label)} · ${T('الإيرادات','Revenue')}: ${f(r.income)}</title></circle>`).join('');
  return `<div class="v52-line-key"><span><i style="background:#e59c44"></i>${T('التكاليف','Costs')}</span><span><i style="background:#249d7f"></i>${T('الإيرادات','Revenue')}</span></div><svg class="v52-line" viewBox="0 0 ${W} ${H}" role="img" aria-label="${text(T('تطور التكاليف والإيرادات الفعلية','Actual cost and revenue progression'))}"><line x1="${left}" x2="${W-right}" y1="${top+dy}" y2="${top+dy}" stroke="#b9cad5"/><line x1="${left}" x2="${left}" y1="${top}" y2="${top+dy}" stroke="#b9cad5"/>${[0,.5,1].map(k=>`<line x1="${left}" x2="${W-right}" y1="${top+(1-k)*dy}" y2="${top+(1-k)*dy}" stroke="#dce6ec" stroke-dasharray="4 4"/><text x="${left-7}" y="${top+(1-k)*dy+5}" font-size="11" text-anchor="end" fill="#547088">${(denom*k).toFixed(0)}</text>`).join('')}${paths}${dots}<text x="${left}" y="${H-13}" fill="#547088" font-size="10" text-anchor="start">${text(items[0].label)}</text><text x="${W-right}" y="${H-13}" fill="#547088" font-size="10" text-anchor="end">${text(items[items.length-1].label)}</text></svg><p class="v52-footnote">${T('النقاط حسب تواريخ الحركات المسجلة. إن كانت هناك مبالغ بدون تاريخ مستقل، تظهر في رصيد إجمالي منفصل ولا ننسبها إلى يوم غير معروف.','Points use actual recorded transaction dates. Undated legacy amounts appear only in a separate balance, not as a fabricated daily transaction.')}</p>`;
 }
 function detailTable(rows,currency){return rows.length?`<div class="v52-table-overflow"><table><thead><tr><th>${T('التاريخ','Date')}</th><th>${T('المصدر / البند','Source / item')}</th><th>${T('التفاصيل','Details')}</th><th>${T('التكلفة / الإيراد','Amount')} (${text(currency)})</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${text(r.date||'—')}</td><td data-no-translate>${text(r.title)}</td><td data-no-translate>${text(r.detail||'—')}</td><td class="v52-num">${f(r.amount)}</td></tr>`).join('')}</tbody><tfoot><tr><th colspan="3">${T('المجموع','Total')}</th><th class="v52-num">${f(sum(rows))}</th></tr></tfoot></table></div>`:`<p class="v52-empty">${T('لا توجد حركات مسجلة لهذا البند في الدورة المختارة.','No recorded transactions for this item in the selected cycle.')}</p>`;}
 function draw(){if(!ready||!$('v52-main')||!$('finance'))return;const c=cSelected(),frame=$('v52-main');if(!c){const summary=$('v52-pane-summary')?.querySelector('.v52-summary-content');if(summary)summary.innerHTML=`<p class="v52-empty">${T('اختر المزرعة والعنبر والدورة لعرض الحسابات.','Choose a farm, house and cycle to view the accounts.')}</p>`;return;}
  const x=calc(c),rs=rowsFor(c,x),p=parts(c,x),cc=text(getCycleCurrency(c)),ended=ledger().close?.[c.id]?.status==='closed',soldBirds=n(x.soldBirds),soldKg=n(x.soldKg),position=m(x.rev-x.cost),frozen=typeof PFM_V410==='object'&&PFM_V410.totalFrozen?PFM_V410.totalFrozen(c.id):0,lockedSale=cycleRows('sales',c).filter(s=>s.v410Snapshot).reduce((z,s)=>z+n(s.v410Snapshot.margin),0);
  const status=ended?T('الدورة مغلقة ماليًا — نتائج نهائية','Financially closed — final results'):T('الدورة مفتوحة — الأرقام مرحلية وليست ربحًا نهائيًا','Cycle open — interim figures, not final profit');
  const root=(key)=>$('v52-pane-'+key);
  const label={chicks:T('الكتاكيت','Chicks'),feed:T('الأعلاف','Feed'),meds:T('الأدوية والتحصينات','Medicines / vaccination'),other:T('المصروفات التشغيلية','Operating expenses'),sales:T('مبيعات الطيور','Bird sales'),revenue:T('الإيرادات الأخرى','Other revenue')};
  root('summary').querySelector('.v52-summary-content').innerHTML=`<div class="v52-status">${text(status)} · ${text(getFarmName(c.farmId))} / ${text(getHouseName(c.houseId))}</div><div class="v52-stats">${card('allcost',T('إجمالي تكاليف الدورة','Total cycle costs'),f(x.cost)+' '+cc,T('انقر لعرض المصادر','View sources'),'v52-orange')}${card('income',T('الإيرادات الفعلية','Recorded revenues'),f(x.rev)+' '+cc,T('المبيعات + الإيرادات الأخرى','Sales + other revenue'),'v52-green')}${card('position',ended?T('صافي الربح النهائي','Final net profit'):T('الموقف المالي الحالي','Current financial position'),f(position)+' '+cc,ended?T('معتمد بعد الإغلاق','After financial close'):T('ليس الربح النهائي','Not final profit'),position>=0?'v52-green':'v52-red')}${card('perbird',T('تكلفة الحبة المستقبلة','Cost per received chick'),n(c.birds)?f(x.cost/n(c.birds))+' '+cc:'—',T('من الاستقبال إلى التربية','Reception through rearing'),'v52-blue')}</div><div id="v52-drill-panel" class="v52-drill" ${expanded?'':'hidden'}></div><div class="v52-cost-section"><h3>${T('مصادر التكلفة — اضغط لعرض كل حركة','Cost sources — click to see the entries')}</h3><div class="v52-source-list">${['chicks','feed','meds','other'].map(k=>`<button type="button" data-v52-drill="${k}"><i style="background:${palette[k]}"></i><span>${label[k]}</span><b>${f(p[k])} ${cc}</b><span class="v52-arrow">›</span></button>`).join('')}</div></div><div class="v52-chart-grid"><section class="v52-chart"><h3>${T('توزيع التكاليف','Cost breakdown')}</h3>${pie(p)}</section><section class="v52-chart"><h3>${T('مقارنة التكاليف والإيرادات','Costs vs revenues')}</h3>${bars(p,x)}</section></div><details class="v56-optional-timeline"><summary>${T('عرض الرسم التفصيلي لحركة المصروفات والإيرادات','Show detailed cost and revenue timeline')}</summary><section class="v52-chart v52-line-wrap"><h3>${T('تطور التكاليف والإيرادات حسب تاريخ التسجيل','Costs and revenues by recorded date')}</h3>${timeline(c,x,rs)}</section></details>`;
  const detailsPanel=$('v52-drill-panel');if(expanded&&detailsPanel){let group=expanded==='income'?[...rs.sales,...rs.revenue]:expanded==='allcost'?[...rs.chicks,...rs.feed,...rs.meds,...rs.other]:rs[expanded]||[];let heading=label[expanded]||({allcost:T('جميع بنود التكلفة','All cost sources'),income:T('مصادر الإيرادات','Revenue sources'),margin:T('هامش البيع الجزئي','Partial sale margin'),position:T('النتيجة المالية للدورة','Cycle financial position'),perbird:T('تكلفة الحبة','Cost per received chick'),perkg:T('تكلفة الكيلو','Cost per kg')})[expanded]||'';
   if(['margin','position','perbird','perkg'].includes(expanded)){group=expanded==='margin'?rs.sales:[...rs.chicks,...rs.feed,...rs.meds,...rs.other];}
   detailsPanel.innerHTML=`<div class="v52-drill-header"><h3>${text(heading)}</h3><button type="button" data-v52-close="1" aria-label="${T('إغلاق التفاصيل','Close details')}">×</button></div>${expanded==='margin'?`<p>${T('الهامش من لقطات تكلفة البيع المثبتة فقط؛ المبيعات التاريخية بلا لقطة لا يُختلق لها هامش.','Margin uses only frozen cost snapshots; legacy sales without snapshots receive no invented margin.')}</p>`:''}${detailTable(group,cc)}${sum(group)>0&&Math.abs(sum(group)-(expanded==='allcost'?x.cost:expanded==='feed'?x.fc:expanded==='meds'?x.meds:expanded==='other'?x.expenseTotal:sum(group)))>.01?`<p class="v52-footnote">${T('تنبيه: هناك فرق مع الرصيد المحاسبي؛ راجع الحركات غير المؤرخة أو غير المحفوظة.','Note: source rows differ from accounting totals; check undated or unsaved transactions.')}</p>`:''}`;
  }
  root('expenses').querySelector('.v52-cost-brief').innerHTML=`<div class="v52-mini-grid">${['chicks','feed','meds','other'].map(k=>`<div><span>${label[k]}</span><b>${f(p[k])} ${cc}</b></div>`).join('')}</div>`;
  root('sales').querySelector('.v52-sales-table').innerHTML=`<h3>${T('عمليات البيع من شاشة المبيعات والحصاد','Sales from Sales & Harvest')}</h3>${detailTable(rs.sales,cc)}${detailTable(rs.revenue,cc)}<p class="v52-footnote">${T('تكلفة كل عملية بيع مثبتة في سجلها وقت البيع ولا يعاد تعديلها هنا.','Each sale retains its frozen cost snapshot from the sale date.')}</p>`;
  root('analysis').querySelector('.v52-analysis-note').innerHTML=`<div class="v52-status">${text(status)}</div>`;
  root('closing').querySelector('.v52-closing-note').innerHTML=`<div class="v52-status">${text(status)}</div>`;
  root('closing').querySelector('.v52-report-actions').innerHTML=`<button type="button" class="btn primary" id="v52-open-report">${T('فتح التقرير النهائي للدورة','Open this cycle final report')}</button>`;
  for(const key of ['summary','expenses','sales','analysis','closing'])root(key).hidden=key!==active;
  document.querySelectorAll('#v52-tabs button').forEach(b=>{const selected=b.dataset.v52Tab===active;b.classList.toggle('active',selected);b.setAttribute('aria-selected',String(selected));});
  if(window.translateDOM)try{translateDOM()}catch(_e){}
 }
 function install(){if(ready||!$('finance')||!$('v410-financial-dashboard'))return false;
  const section=$('finance'),first=section.querySelector(':scope > .panel'),oldDashboard=$('v410-financial-dashboard');if(!first||!oldDashboard)return false;
  const workspace=document.createElement('div');workspace.id='v52-workspace';workspace.className='v52-workspace';workspace.innerHTML=`<div class="v52-pickers panel"><h3>${lbl('اختر دورة التربية','Select rearing cycle')}</h3><div class="v52-picker-fields"></div></div><div class="v52-header"><h2>${lbl('الملخص المالي وإدارة مصروفات الدورة','Cycle financial summary and expenses')}</h2><p>${lbl('معلومات بسيطة في الواجهة، مع كشف مصدر كل رقم عند الضغط عليه.','Simple overview with traceable source entries behind every figure.')}</p></div><div class="v52-tabs" id="v52-tabs" role="tablist">${[['summary','الملخص المالي','Financial summary'],['expenses','المصروفات','Expenses'],['sales','المبيعات','Sales'],['analysis','تحليل الربحية','Profitability'],['closing','التقرير والإغلاق','Report & closing']].map(([key,ar,en])=>`<button type="button" role="tab" data-v52-tab="${key}">${lbl(ar,en)}</button>`).join('')}</div><div id="v52-main"><div class="v52-pane" id="v52-pane-summary"><div class="v52-summary-content"></div></div><div class="v52-pane" id="v52-pane-expenses" hidden><div class="v52-cost-brief"></div><div class="v52-quick-panel panel"><h3>${lbl('إضافة مصروف للدورة','Add a cycle expense')}</h3><p class="v52-footnote">${lbl('الأعلاف والأدوية تُسحب تلقائيًا من شاشاتها؛ لا تدخل نفس المبلغ مرة ثانية.','Feed and medicines are included from their own screens; do not re-enter the same costs.')}</p><div class="v52-quick-grid"><label>${lbl('تاريخ المصروف','Expense date')}<input type="date" id="v52-expense-date"></label><label>${lbl('بند المصروف','Expense category')}<select id="v52-expense-category"></select></label><label>${lbl('المبلغ (قبل الضريبة أو دون ضريبة)','Amount (before VAT / no VAT)')}<input type="number" id="v52-expense-amount" min="0" step="0.01" placeholder="0.00"></label><label>${lbl('ملاحظة اختيارية','Optional note')}<input type="text" id="v52-expense-note"></label></div><button class="btn primary" type="button" id="v52-add-expense">${lbl('إضافة المصروف','Add expense')}</button></div><details class="v52-advanced panel"><summary>${lbl('تكلفة الكتاكيت — الفاتورة والكتاكيت المجانية','Chick invoice and free chicks')}</summary><div id="v52-chick-root"></div></details><details class="v52-advanced panel"><summary>${lbl('خيارات المصروفات المتقدمة: الضريبة، الكمية، المورد','Advanced expense fields: VAT, quantity, supplier')}</summary><div id="v52-detailed-root"></div></details><details class="v52-advanced panel"><summary>${lbl('سجلات مصروفات الإصدار السابق وتعديلها','Legacy expense records and editing')}</summary><div id="v52-legacy-root"></div></details></div><div class="v52-pane" id="v52-pane-sales" hidden><div class="v52-sales-table"></div><details class="v52-advanced panel"><summary>${lbl('إيرادات أخرى — تعديل وحفظ','Other revenues — edit and save')}</summary><div id="v52-other-rev"></div></details></div><div class="v52-pane" id="v52-pane-analysis" hidden><div class="v52-analysis-note"></div><div id="v52-analysis-root"></div><details class="v52-advanced panel"><summary>${lbl('تقرير الضريبة وتوزيع التكاليف التفصيلي','VAT and detailed cost distribution')}</summary><div id="v52-vat-root"></div></details></div><div class="v52-pane" id="v52-pane-closing" hidden><div class="v52-closing-note"></div><div class="v52-report-actions"></div><div id="v52-close-root"></div><details class="v52-advanced panel"><summary>${lbl('جدول السجلات المالية القديم','Historical finance table')}</summary><div id="v52-history-root"></div></details></div></div>`;
  section.querySelector('h2')?.after(workspace);
  for(const id of ['finFarm','finHouse','finCycle']){const el=$(id);const wrapper=el?.closest('.field');if(wrapper)workspace.querySelector('.v52-picker-fields').appendChild(wrapper);}
  const chuck=oldDashboard.querySelector('details');const allDetails=[...oldDashboard.querySelectorAll(':scope > details')];
  if(allDetails[0])$('v52-chick-root').appendChild(allDetails[0]);
  if(allDetails[1])$('v52-detailed-root').appendChild(allDetails[1]);
  if(allDetails[2]){$('v52-analysis-root').appendChild(allDetails[2]);allDetails[2].open=false;}
  if(allDetails[3]){$('v52-close-root').appendChild(allDetails[3]);allDetails[3].open=false;}
  const vat=$('v410FinanceDistribution');if(vat)$('v52-vat-root').appendChild(vat);
  const parent=first;const other=$('otherRevenue')?.closest('.field');const save=$('financeSaveBtn');if(other)$('v52-other-rev').appendChild(other);if(save)$('v52-other-rev').appendChild(save);
  $('v52-legacy-root').appendChild(parent);
  // Legacy finance summary and old ledger table stay in the DOM for compatibility, but are tucked away.
  $('financeBox')?.classList.add('v52-legacy-hide');
  const siblingPanels=[...section.querySelectorAll(':scope > .panel')];const history=siblingPanels.filter(p=>p!==parent&&!p.id&&!p.contains($('financeTable')));for(const p of history)$('v52-history-root').appendChild(p);
  // Existing financeTable panel, if present, is also moved to the historical ledger.
  const ft=$('financeTable')?.closest('.panel');if(ft)$('v52-history-root').appendChild(ft);
  // Main V4.10 technical summary must remain in the document as a render target, not a visible duplicate.
  oldDashboard.classList.add('v52-engine');
  const options=$('v410ExpenseCategory')?.options||[];$('v52-expense-category').innerHTML=[...options].map(o=>`<option value="${text(o.value)}">${text(o.textContent)}</option>`).join('');
  $('v52-expense-date').value=typeof today==='function'?today():new Date().toISOString().slice(0,10);
  section.addEventListener('click',e=>{const b=e.target.closest('[data-v52-tab],[data-v52-drill],[data-v52-close]');if(!b)return;
   if(b.dataset.v52Tab){active=b.dataset.v52Tab;expanded='';draw();return}
   if(b.hasAttribute('data-v52-close')){expanded='';draw();return}
   if(b.dataset.v52Drill){expanded=expanded===b.dataset.v52Drill?'':b.dataset.v52Drill;active='summary';draw();return}
  });
  $('v52-add-expense').addEventListener('click',()=>{const c=cSelected();if(!c)return alert(T('اختر الدورة أولًا.','Select a cycle first.'));const val=n($('v52-expense-amount').value);if(!(val>0))return alert(T('أدخل مبلغ مصروف أكبر من الصفر.','Enter a positive expense amount.'));
   const cat=$('v52-expense-category').value;if(!cat)return alert(T('اختر بند المصروف.','Select an expense category.'));
   $('v410ExpenseCategory').value=cat;$('v410ExpenseDate').value=$('v52-expense-date').value;
   $('v410ExpenseQty').value='1';$('v410ExpensePrice').value=String(val);$('v410ExpenseNote').value=$('v52-expense-note').value;
   $('v410ExpenseMode').value='excluded';$('v410ExpenseRate').value='0';$('v410ExpenseReclaim').value='100';
   const before=(ledger().audit||[]).length;$('v410SaveExpense').click();if((ledger().audit||[]).length>before){$('v52-expense-amount').value='';$('v52-expense-note').value='';renderFinance();}
  });
  section.addEventListener('click',e=>{if(e.target.id!=='v52-open-report')return;const c=cSelected();if(!c)return;show('reports');if($('reportCycle')){$('reportCycle').value=c.id;renderReport();}});
  const original=renderFinance;renderFinance=function(){const result=original.apply(this,arguments);if(ready)draw();return result;};
  const originalShow=show;show=function(id,btn){if(id==='finance'&&document.querySelector('.view.active')?.id!=='finance'){active='summary';expanded='';}const result=originalShow.apply(this,arguments);if(id==='finance'&&ready)draw();return result;};
  section.addEventListener('click',e=>{if(['v410SaveExpense','v410SaveChicks','v410CloseCycle','v410ReopenCycle'].includes(e.target?.id)){setTimeout(()=>{if(ready)renderFinance()},0);}});
  const langSetter=setLanguage;setLanguage=function(){const result=langSetter.apply(this,arguments);if(ready){$('v52-expense-category').innerHTML=[...$('v410ExpenseCategory').options].map(o=>`<option value="${text(o.value)}">${text(o.textContent)}</option>`).join('');draw()}return result;};
  ready=true;draw();return true;
 }
 function initialize(){if(!install())setTimeout(initialize,120)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
 // V6.7: A read-only complete finance print snapshot. Never change live tabs,
 // form fields, stored records, ledger amounts, or original scientific calculations.
 function buildPrintSnapshot(){
   const cycle=cSelected();
   if(!cycle)return `<div id="finance" class="pfm67-print-finance"><p class="v52-empty">${T('اختر دورة التربية من شاشة التكاليف والأرباح لعرض التقرير الكامل.','Select a rearing cycle in Costs & Profits to print its full report.')}</p></div>`;
   const x=calc(cycle),rs=rowsFor(cycle,x),p=parts(cycle,x),cc=text(getCycleCurrency(cycle));
   const closed=ledger().close?.[cycle.id]?.status==='closed';
   const pos=m(x.rev-x.cost),status=closed?T('الدورة مغلقة ماليًا — نتائج نهائية','Financially closed — final figures'):T('الدورة مفتوحة — الأرقام مرحلية وليست ربحًا نهائيًا','Cycle open — interim figures');
   const label={chicks:T('تكلفة الكتاكيت','Chick costs'),feed:T('تكلفة الأعلاف','Feed costs'),meds:T('الأدوية والتحصينات','Medicines and vaccination'),other:T('المصروفات التشغيلية','Operating expenses')};
   const block=(name,html)=>`<section class="pfm67-print-section"><h2 class="pfm67-print-section-title">${text(name)}</h2>${html}</section>`;
   const tile=(name,value,kind='')=>`<div class="v52-stat ${kind}"><span>${text(name)}</span><strong>${text(value)}</strong></div>`;
   const statusLine=`<div class="v52-status">${text(status)} · ${text(getFarmName(cycle.farmId))} / ${text(getHouseName(cycle.houseId))} · ${text(T('الدورة','Cycle'))} ${text(typeof cycleOrdinal==='function'?cycleOrdinal(cycle):cycle.cycleNumber||'')} · ${text(cycle.date||'')}</div>`;
   const chart=`<div class="v52-chart-grid"><section class="v52-chart"><h3>${T('توزيع التكاليف','Cost breakdown')}</h3>${pie(p)}</section><section class="v52-chart"><h3>${T('مقارنة التكاليف والإيرادات','Costs vs revenues')}</h3>${bars(p,x)}</section></div>`;
   const basic=`<div class="v52-stats">${tile(T('إجمالي تكاليف الدورة','Total cycle costs'),f(x.cost)+' '+cc,'v52-orange')}${tile(T('إجمالي إيرادات الدورة','Total cycle revenues'),f(x.rev)+' '+cc,'v52-green')}${tile(closed?T('الربح/الخسارة النهائية','Final profit/loss'):T('الموقف المالي الحالي','Current financial position'),f(pos)+' '+cc,pos<0?'v52-red':'v52-green')}${tile(T('تكلفة الكتكوت المستلم','Cost per received chick'),n(cycle.birds)?f(x.cost/n(cycle.birds))+' '+cc:'—','v52-blue')}${tile(T('إجمالي مبيعات الطيور','Bird sales'),f(x.saleRevenue)+' '+cc,'v52-green')}${tile(T('الربح/الخسارة المسجلة','Recorded profit/loss'),f(x.profit)+' '+cc,'v52-blue')}</div>`;
   const costTiles=`<div class="v52-mini-grid">${['chicks','feed','meds','other'].map(k=>`<div><span>${text(label[k])}</span><b>${f(p[k])} ${cc}</b></div>`).join('')}</div>`;
   const expenses=['chicks','feed','meds','other'].map(k=>`<div class="pfm67-print-subsection"><h3>${text(label[k])}</h3>${detailTable(rs[k],cc)}</div>`).join('');
   const revenueDetails=`<div class="pfm67-print-subsection"><h3>${T('المبيعات والحصاد الجزئي','Sales and partial harvest')}</h3>${detailTable(rs.sales,cc)}</div><div class="pfm67-print-subsection"><h3>${T('الإيرادات الأخرى','Other revenue')}</h3>${detailTable(rs.revenue,cc)}</div>`;
   const analysis=`<div class="v52-mini-grid">${[['إجمالي التكلفة','Total costs',x.cost],['إجمالي الإيرادات','Total revenue',x.rev],['نتيجة الدورة','Cycle result',pos],['تكلفة الكيلو الحي','Cost per live kg',x.costPerKg]].map(([a,b,v])=>`<div><span>${text(T(a,b))}</span><b>${f(v)} ${cc}</b></div>`).join('')}</div><section class="v52-chart v52-line-wrap"><h3>${T('تطور التكاليف والإيرادات حسب تاريخ التسجيل','Costs and revenues over time')}</h3>${timeline(cycle,x,rs)}</section>`;
   const tableCols=[T('المزرعة','Farm'),T('العنبر','House'),T('الدورة','Cycle'),T('التكاليف','Costs'),T('المبيعات','Sales'),T('الإيرادات','Revenues'),T('النتيجة','Result')];
   const scopes=typeof window.PFMGlobalCycleScope==='function'?window.PFMGlobalCycleScope:()=>true;
   const farmId=document.getElementById('finFilterFarm')?.value||'';
   const houseEl=document.getElementById('finFilterHouse');
   const selectedHouses=houseEl?.multiple?[...houseEl.selectedOptions].map(o=>o.value).filter(Boolean):[];
   const allCycles=(db.cycles||[]).filter(c=>scopes(c)&&(!farmId||c.farmId===farmId)&&(!selectedHouses.length||selectedHouses.includes(c.houseId)));
   const history=allCycles.map(c=>{const y=calc(c),money=getCycleCurrency(c);return `<tr><td>${text(getFarmName(c.farmId))}</td><td>${text(getHouseName(c.houseId))}</td><td>${text(c.date)} · ${text(typeof cycleOrdinal==='function'?cycleOrdinal(c):c.cycleNumber||'')}</td><td>${f(y.cost)} ${text(money)}</td><td>${f(y.saleRevenue)} ${text(money)}</td><td>${f(y.rev)} ${text(money)}</td><td>${f(y.profit)} ${text(money)}</td></tr>`}).join('');
   const ledgerTable=`<div class="v52-table-overflow"><table><thead><tr>${tableCols.map(col=>`<th>${text(col)}</th>`).join('')}</tr></thead><tbody>${history||`<tr><td colspan="7">${T('لا توجد دورات مالية في نطاق العرض','No financial cycles in the selected scope')}</td></tr>`}</tbody></table></div>`;
   return `<div id="finance" class="pfm67-print-finance">${statusLine}`+
     block(T('الملخص المالي','Financial summary'),basic+chart)+
     block(T('المصروفات — كل البنود والحركات','Expenses — all categories and transactions'),costTiles+expenses)+
     block(T('المبيعات والإيرادات','Sales and revenues'),revenueDetails)+
     block(T('تحليل الربحية','Profitability analysis'),analysis)+
     block(T('التقرير والإغلاق','Report and close'),`<p class="v52-status">${text(status)}</p><p class="v52-footnote">${T('تُحسب الأرقام من السجلات الحالية للدورة، وتظل الحالة النهائية مرتبطة بإغلاق الدورة ماليًا.','Figures are derived from current cycle records; final status depends on financial closing.')}</p>`)+
     block(T('السجل المالي ضمن نطاق المزرعة والعنبر والدورة','Financial ledger within the selected farm/house/cycle scope'),ledgerTable)+`</div>`;
 }

 window.PFM_V52={get activeTab(){return active},openTab:key=>{active=key;expanded='';draw()},refresh:draw,buildPrintSnapshot};
})();
