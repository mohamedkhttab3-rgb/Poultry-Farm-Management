'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),{JSDOM}=require('jsdom');
const invoiceCore=require('../www/pfm-v8-invoice-core.js');
const draftCore=require('../www/pfm-v81-purchase-drafts.js');
const purchase=require('../www/pfm-v74-purchase-core.js');

(async()=>{
 const html='<!doctype html><html lang="ar"><head></head><body>'+
  '<nav id="v53-nav"></nav><section id="inventory"></section>'+
  '<div id="pfm75-expenses"></div><div id="v410-lot-panel"></div></body></html>';
 const dom=new JSDOM(html,{url:'https://qa.local/',runScripts:'outside-only'});
 const w=dom.window,d=w.document;
 let saved=0,serial=0;const gen=()=> 'qa-dom-'+(++serial);
 w.db={farms:[{id:'f1',name:'QA farm'}],
  cycles:[{id:'c1',farmId:'f1',houseId:'h1',cycleNumber:1,date:'2026-10-01',birds:20000}],
  finance:{c1:{expenses:[]}},sales:[],settings:{currency:'SAR'},
  v410:{lots:[],movements:[],chicks:{},expenses:{},close:{},audit:[],purchaseDocuments:[]}};
 w.currentUser={id:'owner'};w.can=()=>true;w.uuid=gen;w.cycleOrdinal=c=>c.cycleNumber;
 w.getCycleCurrency=()=> 'SAR';w.getHouseName=()=> 'House 1';
 w.normalizeFinanceExpenses=f=>f.expenses||[];w.save=()=>{saved++};
 w.PFM74PurchaseCore=purchase;w.PFMV8InvoiceCore=invoiceCore;w.PFMV81PurchaseDrafts=draftCore;
 w.PFM_V410={refresh:()=>{}};
 w.eval(fs.readFileSync('www/pfm-v8-invoice-ui.js','utf8'));
 await new Promise(resolve=>setTimeout(resolve,400));
 assert(d.getElementById('pfm-v8-invoice'),'invoice form renders in real DOM');
 const line=d.querySelector('#pfm-v8-lines .pfm-v8-line');
 assert(line,'starter line exists');
 const kind=line.querySelector('[data-k="kind"]');
 kind.value='diesel';kind.dispatchEvent(new w.Event('change',{bubbles:true}));
 const set=(key,value)=>{const el=line.querySelector('[data-k="'+key+'"]');assert(el,key);el.value=value};
 set('item','Diesel');set('quantity','1');set('unit','وحدة');set('amount','35000');
 set('vatMode','included');set('vatRate','15');set('reclaim','0');set('cycleId','c1');
 d.querySelector('#pfm-v8-lines .pfm-v8-line [data-line-save]').click();
 assert.equal(d.querySelectorAll('#pfm-v8-draft-rows tr').length,1,'Save actually shows the line underneath');
 assert(!d.querySelector('#pfm-v8-saved-lines').hidden,'saved items panel visible');
 assert.equal(w.db.finance.c1.expenses.length,0,'Save stage must not double charge financial ledger');
 assert.equal(d.querySelectorAll('.pfm-v8-line').length,0,'form clears after item saved');
 assert(w.db.v410.purchaseDrafts[0].lines[0].item==='Diesel');
 // Demonstrate meaningful feedback and focus when invoice header is missing.
 d.getElementById('pfm-v8-submit').click();
 assert.match(d.getElementById('pfm-v8-invoice-status').textContent,/المورد/);
 assert.equal(w.db.v410.purchaseDocuments.length,0);
 d.getElementById('pfm-v8-supplier').value='QA Supplier';
 d.getElementById('pfm-v8-invoice-no').value='QA-INV-1';
 d.getElementById('pfm-v8-submit').click();
 assert.equal(w.db.v410.purchaseDocuments.length,1,'final invoice is recorded from the button');
 assert.equal(w.db.finance.c1.expenses.length,1,'diesel expense is charged once on approval');
 assert.equal(w.db.finance.c1.expenses[0].amount,35000);
 assert.equal((w.db.v410.purchaseDrafts||[]).length,0,'saved draft clears on approval');
 assert.equal(d.querySelector('#pfm-v8-saved-lines').hidden,true,'approved draft is removed from list');
 assert.match(d.getElementById('pfm-v8-invoice-status').textContent,/تم الحفظ بنجاح/);
 // Real stock-entry save is a draft, and adds lot only upon second invoice approval.
 const add=d.getElementById('pfm-v8-add');add.click();
 const feed=d.querySelector('#pfm-v8-lines .pfm-v8-line');
 const stage=feed.querySelector('[data-k="feedStage"]');
 stage.value='بادي';stage.dispatchEvent(new w.Event('change',{bubbles:true}));
 feed.querySelector('[data-k="quantity"]').value='1000';
 feed.querySelector('[data-k="amount"]').value='2000';
 feed.querySelector('[data-k="unit"]').value='كجم';
 feed.querySelector('[data-line-save]').click();
 assert.equal(d.querySelectorAll('#pfm-v8-draft-rows tr').length,1);
 assert.equal(w.db.v410.lots.length,0);
 d.getElementById('pfm-v8-supplier').value='QA Feed';
 d.getElementById('pfm-v8-invoice-no').value='QA-INV-2';
 d.getElementById('pfm-v8-submit').click();
 assert.equal(w.db.v410.purchaseDocuments.length,2);
 assert.equal(w.db.v410.lots.length,1,'one purchased feed lot');
 assert.equal(w.db.finance.c1.expenses.length,1,'feed purchase not billed as direct cost');
 assert(saved>0);
 w.close();
 console.log('PASS real DOM: click Save diesel and feed, displayed draft, supplier validation, invoice approval, no double cost');
})().catch(e=>{console.error(e);process.exitCode=1});
