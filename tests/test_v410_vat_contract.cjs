'use strict';
// Standalone read-only regression test of the existing finance VAT engine.
// Runs in an isolated VM with DOM initialization disabled. Never edits user records.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'..','www','v410-finance.js'),'utf8');
const ctx={
 window:{alert:()=>{}},
 document:{readyState:'loading',getElementById:()=>null,addEventListener:()=>{}},
 db:{v410:{},cycles:[],settings:{currency:'SAR'}},
 exportBackup:()=>{},
 currentUser:null,
 getCycleCurrency:()=> 'SAR',
 cyc:()=>null,
 uuid:()=> 'test-id',
 audit:()=>{},
 today:()=> '2026-10-16',
 save:()=>{},
 renderReport:()=>{},
 console
};
vm.runInNewContext(source,ctx,{filename:'v410-finance.js'});
const vat=ctx.window.PFM_V410?.vat;
assert.equal(typeof vat,'function','V4.10 VAT engine not exposed');
function check(amount,rate,mode,reclaim,expected){
 const result=vat(amount,rate,mode,reclaim);
 for(const [key,value] of Object.entries(expected))
   assert.equal(result[key],value,`VAT: ${mode}, ${key}, amount=${amount}`);
 assert.equal(result.accountingCost,Math.round((result.gross-result.recoverable)*100)/100);
}
check(20000,15,'excluded',100,{net:20000,tax:3000,gross:23000,recoverable:3000,accountingCost:20000});
check(23000,15,'included',100,{net:20000,tax:3000,gross:23000,recoverable:3000,accountingCost:20000});
check(20000,15,'excluded',0,{net:20000,tax:3000,gross:23000,recoverable:0,accountingCost:23000});
check(23000,15,'included',0,{net:20000,tax:3000,gross:23000,recoverable:0,accountingCost:23000});
check(100,0,'excluded',100,{net:100,tax:0,gross:100,accountingCost:100});
assert.throws(()=>vat(-1,15,'excluded',0),/Invalid amount/);
assert.throws(()=>vat(100,110,'excluded',0),/Invalid amount/);
console.log('PASS: real V4.10 VAT engine — included/excluded VAT, recoverable/nonrecoverable, zero VAT and invalid inputs.');
