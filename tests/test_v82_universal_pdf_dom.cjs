'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const fixture=JSON.parse(fs.readFileSync('www/pfm-v81-qa80k.json','utf8'));
const logo=fs.readFileSync('www/pfm-logo.png');
const doc=`<!doctype html><html lang="ar" dir="rtl"><body><main>
<section class="view active" id="dash"><h2>لوحة التحكم الرئيسية</h2>
<div class="pfm57-toolbar">
<select data-pfm57-role="cycle"><option value="">كل الدورات</option><option value="1">الدورة 1</option></select>
<select data-pfm57-role="farm"><option value="">كل المزارع</option>
<option value="${fixture.farms[0].id}">المزرعة الأولى</option><option value="${fixture.farms[1].id}">المزرعة الثانية</option></select>
<select data-pfm57-role="house"><option value="">كل العنابر</option><option value="${fixture.houses[0].id}">عنبر 1</option></select>
<input data-pfm57-role="search" value=""></div>
<div id="v53-overview"><div class="pfm53-kpi"><span class="pfm53-kpi-title">الصيصان</span><b class="pfm53-kpi-value">80,000</b></div></div>
</section></main></body></html>`;
const dom=new JSDOM(doc,{runScripts:'outside-only',url:'https://qa.local/index.html',pretendToBeVisual:true});
const w=dom.window;
w.db=fixture;w.PFMGlobalCycleScope=()=>true;w.cycleOrdinal=c=>c.cycleNumber;
w.fetch=async()=>({ok:true,blob:async()=>new w.Blob([logo],{type:'image/png'})});
w.eval(fs.readFileSync('www/pfm-v82-universal-pdf.js','utf8'));
const write=async(screen)=>{
 const html=await w.PFMModernPDF.buildHTML();
 assert(html.startsWith('<!DOCTYPE html>'));
 assert(html.includes('name="pfm-report-engine" content="V8.2-semantic"'));
 assert(html.includes('data:image/png;base64,'),'Original PNG must be embedded');
 assert(html.includes('Poultry Farm Management M.K™'));
 assert(html.includes('size:A4 landscape'));
 assert(html.includes('class="footer"'),'All pages must include PDF footer');
 assert(!html.includes('<canvas'),'Do not copy dashboard canvas');
 assert(!html.includes('pfm53-chart'),'Do not export screenshot dashboard CSS');
 fs.mkdirSync('/tmp',{recursive:true});
 fs.writeFileSync('/tmp/pfm82-'+screen+'.html',html);
 return html;
};
(async()=>{
 let html=await write('dashboard');
 assert(html.includes('ملخص الإنتاج حسب المزرعة'));
 assert(fixture.farms.every(f=>html.includes(f.name)),'both fixture farm names must appear in report');
 assert(html.includes('40,000')&&html.includes('80,000'));
 const select=w.document.querySelector('[data-pfm57-role="farm"]');
 select.value=fixture.farms[0].id;
 html=await write('farm');
 assert(html.includes(fixture.farms[0].name));
 assert(!html.includes(fixture.farms[1].name),'farm scope must not leak records');
 select.value='';
 const view=w.document.querySelector('main>section');
 view.id='daily';view.querySelector('#v53-overview')?.remove();
 html=await write('daily');
 assert.equal((html.match(/<tr>/g)||[]).length,169,'168 daily rows plus one table header');
 view.querySelector('[data-pfm57-role="search"]').value='NoSuchDate-ABC';
 html=await write('search');
 assert(!html.includes('بيانات دورة اختبارية وليست سجلات مزرعة حقيقية'));
 assert(html.includes('لا توجد سجلات'));
 view.querySelector('[data-pfm57-role="search"]').value='';
 view.id='inventory';html=await write('purchases');
 assert(html.includes('34 سجل'),'34 original source purchase documents');
 assert(html.includes('32 سجل'),'32 actual purchased-lot issues');
 assert(html.includes('دفعات المخزون'),'lot balances section');
 assert(html.includes('INV-')||html.includes('QA-RENT'),'purchase invoice numbers present');
 w.document.documentElement.lang='en';
 view.id='cycles';html=await write('english');
 assert(html.includes('Farm')&&html.includes('Cycle')&&html.includes('20,000'));
 assert(html.includes('dir="ltr"'));
 // Neither printing nor reading records may alter immutable financial data.
 assert.equal(fixture.cycles.length,4);
 assert.equal(fixture.v410.purchaseDocuments.length,34);
 assert.equal(fixture.v410.movements.length,32);
 w.close();
 console.log('PASS V8.2 global semantic PDF — real 80K data, farm scope, all 168 daily rows, invoice/lot issue count, bilingual rendering and original logo');
})().catch(e=>{console.error(e);w.close();process.exitCode=1});
