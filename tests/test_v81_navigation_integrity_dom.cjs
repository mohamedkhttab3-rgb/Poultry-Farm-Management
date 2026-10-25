'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const index=fs.readFileSync('www/index.html','utf8');
const navStart=index.indexOf('<nav id="v53-nav"');
assert(navStart>=0,'Main right-side nav not found');
const navEnd=index.indexOf('</nav>',navStart);
assert(navEnd>navStart,'End of nav not found');
const snippet=index.slice(navStart,navEnd+6);
const dom=new JSDOM('<!doctype html><html lang="ar"><body>'+snippet+
 '<section id="inventory"><h2>المخزون المشتريات والمخزون</h2></section></body></html>',
 {url:'https://qa.local/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,d=w.document;
const source=fs.readFileSync('www/pfm-v81-navigation-integrity.js','utf8');
const one=fs.readFileSync('www/pfm-v8-one-page-purchases.js','utf8');
assert(!one.includes('mountIssue(\'meds\''),'legacy one-page layout must not relocate medicines into purchases');
assert(!one.includes('button[data-stage="8"]{display:none!important}'),'no legacy CSS may hide daily medicines');
w.eval(source);
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function verify(language){
 const nutrition=d.querySelector('[data-v55-group="nutrition"] .v55-nav-items');
 const daily=d.querySelector('[data-v55-group="daily"] .v55-nav-items');
 assert.deepEqual([...nutrition.querySelectorAll('button:not([hidden])')].map(x=>x.dataset.stage),['9'],
  'Purchases contains only the unified purchases and inventory screen');
 assert.deepEqual([...daily.querySelectorAll('button')].map(x=>x.dataset.stage),['5','6','8'],
  'Daily Monitoring contains daily, weekly weights and technical medicine');
 assert.equal(nutrition.querySelector('[data-stage="9"]').textContent,
  language==='en'?'Purchases & Inventory':'المشتريات والمخزون');
 assert.equal(d.querySelector('#inventory > h2').textContent,
  language==='en'?'Purchases & Inventory':'المشتريات والمخزون');
 assert.equal(d.querySelectorAll('#v53-nav button[data-stage="8"]').length,1);
 assert.equal(d.querySelectorAll('#v53-nav button[data-stage="9"]').length,1);
 assert.equal(nutrition.querySelector('[data-stage="8"]'),null);
}
(async()=>{
 await delay(270);verify('ar');
 let changes=0;
 const observer=new w.MutationObserver(records=>{changes+=records.length});
 observer.observe(d.getElementById('v53-nav'),{subtree:true,childList:true,attributes:true,characterData:true});
 const wrong=d.querySelector('[data-stage="8"]');
 d.querySelector('[data-v55-group="nutrition"] .v55-nav-items').appendChild(wrong);
 await delay(80);verify('ar');
 d.documentElement.lang='en';await delay(80);verify('en');
 await delay(120);assert(changes<100,'Navigation observer should not continuously rewrite the DOM');
 observer.disconnect();w.close();
 console.log('PASS right menu: isolated feed purchase hidden; medicines and weights always inside Daily; duplicate labels never return; stable Arabic/English after DOM moves.');
})().catch(e=>{console.error(e);w.close();process.exitCode=1});
