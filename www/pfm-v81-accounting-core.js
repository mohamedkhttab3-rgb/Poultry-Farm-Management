/* PFM V8.1 shared allocations and straight-line depreciation.
 * Source purchase invoices remain the single financial origin; accounting
 * postings never add parallel rows to legacy db.finance expenses.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PFMV81Accounting=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const fail=s=>{throw Error(s)};
const cents=x=>{if(x===null||x===undefined||String(x).trim()===''||!Number.isFinite(Number(x)))fail('Invalid monetary value');const n=Number(x);if(n<0)fail('Negative amount');const k=Math.round((n+Number.EPSILON)*100);if(Math.abs(n-k/100)>0.000001)fail('Amount must have two decimals');return k};
const money=x=>x/100;
const arr=x=>Array.isArray(x)?x:[];
const validDate=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!Number.isNaN(Date.parse(x+'T12:00:00Z'))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
const validMonth=x=>typeof x==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(x);
const monthIndex=s=>{if(!validMonth(s))fail('Invalid month');return Number(s.slice(0,4))*12+Number(s.slice(5,7))-1};
const monthFromIndex=i=>String(Math.floor(i/12))+'-'+String(i%12+1).padStart(2,'0');
function allocate(db,{farmId,cycleIds,amount,method='equal',weights,currency}){
 if(!db||!Array.isArray(db.cycles)||!Array.isArray(db.farms)||!db.farms.some(f=>f.id===farmId))fail('Unknown farm');
 if(!Array.isArray(cycleIds)||!cycleIds.length||cycleIds.length>200||new Set(cycleIds).size!==cycleIds.length)fail('Select distinct beneficiary cycles');
 if(!['equal','birds','manual'].includes(method))fail('Invalid allocation method');
 const cycles=cycleIds.map(id=>{const c=db.cycles.find(x=>x.id===id);if(!c||c.farmId!==farmId)fail('Cross-farm allocation forbidden');if(db.v410?.close?.[id]?.status==='closed')fail('Cannot allocate to a closed cycle');if(currency&&String(c.currency||db.settings?.currency||'SAR')!==currency)fail('CURRENCY_MISMATCH');return c});
 const total=cents(amount);if(total<=0)fail('Allocation cost must be positive');
 const weightsList=cycles.map(c=>{const n=method==='equal'?1:method==='birds'?Number(c.birds):Number(weights?.[c.id]);if(!Number.isFinite(n)||n<=0)fail('Weights must be positive');return n});
 const sum=weightsList.reduce((a,b)=>a+b,0);if(!Number.isFinite(sum)||sum<=0)fail('Invalid sum of weights');
 const quotas=weightsList.map(n=>total*n/sum),parts=quotas.map(Math.floor);
 const ranked=quotas.map((q,i)=>({i,left:q-parts[i]})).sort((a,b)=>b.left-a.left||cycles[a.i].id.localeCompare(cycles[b.i].id));
 const remainder=total-parts.reduce((a,b)=>a+b,0);for(let j=0;j<remainder;j++)parts[ranked[j%ranked.length].i]++;
 const result=cycles.map((c,i)=>({cycleId:c.id,houseId:c.houseId,amount:money(parts[i]),weight:weightsList[i]}));
 if(result.reduce((n,x)=>n+cents(x.amount),0)!==total)fail('Unbalanced allocation');
 return result;
}
function monthCharge(asset,month,postings=[]){
 if(!validMonth(month)||!validDate(asset.startDate))fail('Invalid depreciation period or start date');
 const original=cents(asset.cost),salvage=cents(asset.residual||0),life=Number(asset.lifeMonths);
 if(!Number.isInteger(life)||life<1||life>600||salvage>=original)fail('Invalid useful life or residual value');
 const first=monthIndex(asset.startDate.slice(0,7)),idx=monthIndex(month)-first;
 if(idx<0||idx>=life)fail('Month is outside asset life');
 const past=arr(postings).filter(p=>p.assetId===asset.id);
 if(past.some(p=>p.month===month))fail('DUPLICATE_DEPRECIATION');
 for(let i=0;i<idx;i++)if(!past.some(p=>p.month===monthFromIndex(first+i)))fail('Post previous month first: '+monthFromIndex(first+i));
 const basis=original-salvage,regular=Math.floor(basis/life);
 return money(idx===life-1?basis-regular*(life-1):regular);
}
function planDepreciation(db,input,ctx={}){
 const asset=arr(db?.v410?.assets).find(a=>a.id===input?.assetId);if(!asset)fail('Unknown asset');
 if(!ctx.canFinance?.(asset.farmId))fail('Finance permission required');
 const month=String(input.month||'');
 if(!validMonth(month)||month>(ctx.currentMonth||new Date().toISOString().slice(0,7)))fail('Future depreciation months forbidden');
 const amount=monthCharge(asset,month,db.v410.depreciationPostings);
 const allocations=allocate(db,{farmId:asset.farmId,cycleIds:input.cycleIds,amount,method:input.method||'equal',weights:input.weights,currency:asset.currency});
 if(typeof ctx.uuid!=='function')fail('Missing ID generator');
 return {id:ctx.uuid(),assetId:asset.id,purchaseDocumentId:asset.purchaseDocumentId||null,farmId:asset.farmId,
  month,date:month+'-01',amount,method:input.method||'equal',allocations,currency:asset.currency,
  postedAt:ctx.now?.()||new Date().toISOString(),postedBy:ctx.userId||null};
}
function postDepreciation(db,input,ctx){
 if(typeof ctx?.persist!=='function')fail('Persistent save required');
 const p=planDepreciation(db,input,ctx),old=db.v410;
 const audit={id:ctx.uuid(),date:p.postedAt,actorId:ctx.userId||null,event:'v81_depreciation_post',cycleId:null,before:null,after:{id:p.id,assetId:p.assetId,month:p.month,amount:p.amount},reason:''};
 db.v410={...old,depreciationPostings:[...arr(old.depreciationPostings),p],audit:[...arr(old.audit),audit]};
 try{ctx.persist()}catch(e){db.v410=old;throw e}
 return p;
}
function charges(db,cycleId,asOf='9999-12-31'){
 const v=db?.v410||{};
 const sum=records=>arr(records).filter(x=>!asOf||x.date<=asOf).reduce((n,r)=>
  n+arr(r.allocations).filter(a=>a.cycleId===cycleId).reduce((t,a)=>t+cents(a.amount),0),0);
 const shared=sum(v.sharedExpenses),depreciation=sum(v.depreciationPostings);
 return {shared:money(shared),depreciation:money(depreciation),total:money(shared+depreciation)};
}
function validateLedger(db,cycleId){
 const errors=[],v=db?.v410||{},cycles=arr(db?.cycles),seen=new Set();
 const related=r=>!cycleId||arr(r.allocations).some(a=>a.cycleId===cycleId);
 for(const s of arr(v.sharedExpenses))try{
  if(!related(s))continue;
  if(!validDate(s.date)||!arr(v.purchaseDocuments).some(d=>d.id===s.purchaseDocumentId))fail('Missing or invalid source invoice');
  if(arr(s.allocations).reduce((n,a)=>n+cents(a.amount),0)!==cents(s.cost))fail('Unbalanced shared allocations');
  if(s.allocations.some(a=>!cycles.some(c=>c.id===a.cycleId&&c.farmId===s.farmId)))fail('Cross-farm allocation');
 }catch(e){errors.push('SHARED:'+s.id+':'+e.message)}
 for(const p of arr(v.depreciationPostings))try{
  const key=p.assetId+'|'+p.month;if(seen.has(key))fail('Duplicate depreciation period');seen.add(key);
  if(!related(p))continue;
  const asset=arr(v.assets).find(x=>x.id===p.assetId);
  if(!asset||asset.farmId!==p.farmId)fail('Missing or foreign asset');
  if(arr(p.allocations).reduce((n,a)=>n+cents(a.amount),0)!==cents(p.amount))fail('Unbalanced depreciation');
  if(p.allocations.some(a=>!cycles.some(c=>c.id===a.cycleId&&c.farmId===p.farmId)))fail('Cross-farm depreciation');
 }catch(e){if(related(p))errors.push('DEPRECIATION:'+p.id+':'+e.message)}
 for(const asset of arr(v.assets))try{
  const posts=arr(v.depreciationPostings).filter(p=>p.assetId===asset.id);
  if(posts.reduce((n,p)=>n+cents(p.amount),0)>cents(asset.cost)-cents(asset.residual||0))fail('Depreciation exceeds depreciable base');
 }catch(e){if(!cycleId||arr(v.depreciationPostings).some(p=>p.assetId===asset.id&&related(p)))errors.push('ASSET:'+asset.id+':'+e.message)}
 return errors;
}
return {allocate,monthCharge,planDepreciation,postDepreciation,charges,validateLedger,validDate,validMonth};
});
