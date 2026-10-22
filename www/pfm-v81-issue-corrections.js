/* V8.1 issue corrections. Single authoritative stock movement and linked cycle cost.
   No purchase document is modified; frozen sales and closed cycles are immutable. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.PFMV81IssueCorrections=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const money=n=>Math.round((Number(n)+Number.EPSILON)*100)/100;
 const copy=x=>JSON.parse(JSON.stringify(x));
 const norm=x=>String(x||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase('en');
 const checkDate=(date,cycle)=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||
   new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date<cycle.date||
   date>new Date().toISOString().slice(0,10))throw Error('Invalid issue date or outside cycle');
 };
 const available=(ledger,lot)=>money(Number(lot.qty||0)+(ledger.movements||[]).filter(m=>m.lotId===lot.id)
  .reduce((n,m)=>n+(m.kind==='return'?Number(m.qty):-Number(m.qty)),0));
 const sourceType=lot=>lot.kind==='feed'?'feed':lot.kind==='bedding'?'expense':
  ['med','vaccine','disinfectant'].includes(lot.kind)?'med':null;
 function revise(db,opts){
  const ledger=db?.v410,existing=(ledger?.movements||[]).find(m=>m.id===opts.id&&m.kind==='issue');
  if(!existing)throw Error('Issue movement not found');
  const old=copy(existing),oldLot=(ledger.lots||[]).find(l=>l.id===old.lotId),oldCycle=(db.cycles||[]).find(c=>c.id===old.cycleId);
  if(!oldLot||!oldCycle||oldLot.farmId!==oldCycle.farmId)throw Error('Invalid original issue farm');
  if(!['feed','med','expense'].includes(old.sourceType)||!old.sourceId)throw Error('Legacy issue has no safe source link');
  const oldRecords=old.sourceType==='feed'?db.feed:old.sourceType==='med'?db.meds:null;
  const originalRecord=old.sourceType==='expense'?ledger.expenses?.[old.sourceId]:oldRecords?.find(x=>x.id===old.sourceId);
  if(!originalRecord||(old.sourceType!=='expense'&&originalRecord.v410MovementId!==old.id))
   throw Error('Linked cost record not found; refusing partial change');
  if(old.sourceType==='expense'&&!db.finance?.[old.cycleId]?.expenses?.some(e=>e.id===old.sourceId))
   throw Error('Linked finance entry missing');
  const deletion=opts.remove===true,p=opts.replacement||{},newLot=deletion?oldLot:(ledger.lots||[]).find(l=>l.id===(p.lotId||old.lotId)),
   newCycle=deletion?oldCycle:(db.cycles||[]).find(c=>c.id===(p.cycleId||old.cycleId));
  if(!newLot||!newCycle||newLot.farmId!==oldLot.farmId||newCycle.farmId!==oldLot.farmId)
   throw Error('Corrections must remain within the original farm');
  if(sourceType(newLot)!==old.sourceType)throw Error('Different cost category: delete and create a new issue');
  for(const c of [oldCycle,newCycle]){
   if(ledger.close?.[c.id]?.status==='closed')throw Error('Financially closed cycle cannot be changed');
   if((db.sales||[]).some(s=>s.cycleId===c.id&&s.v410Snapshot))
    throw Error('Frozen sale cost exists; issue correction requires a formal adjustment');
  }
  if(typeof opts.canFinance==='function'&&!opts.canFinance(oldLot.farmId))throw Error('Insufficient farm finance permission');
  const qty=deletion?0:Number(p.qty??old.qty),date=deletion?old.date:(p.date||old.date),
   operationRef=deletion?old.operationRef:String(p.operationRef??old.operationRef).trim();
  if(!deletion){
   if(!Number.isFinite(qty)||qty<=0)throw Error('Invalid quantity');
   checkDate(date,newCycle);
   if(!operationRef||operationRef.length>64)throw Error('Invalid issue reference');
   if((ledger.movements||[]).some(m=>m.id!==old.id&&m.kind==='issue'&&
     norm(m.operationRef)===norm(operationRef)&&
     (ledger.lots||[]).some(l=>l.id===m.lotId&&l.farmId===oldLot.farmId)))
    throw Error('Duplicate issue reference in this farm');
   if(!Number.isFinite(Number(newLot.unitCost))||Number(newLot.unitCost)<0)throw Error('Invalid lot unit cost');
   const room=available(ledger,newLot)+(newLot.id===oldLot.id?Number(old.qty):0);
   if(qty>room+0.0000001)throw Error('Insufficient available stock');
  }
  const restore={movements:copy(ledger.movements),feed:copy(db.feed),meds:copy(db.meds),
   finance:copy(db.finance),expenses:copy(ledger.expenses||{}),
   auditLog:copy(db.auditLog||[]),ledgerAudit:copy(ledger.audit||[])};
  try{
   const index=ledger.movements.findIndex(x=>x.id===old.id);
   if(deletion)ledger.movements.splice(index,1);
   else Object.assign(ledger.movements[index],{cycleId:newCycle.id,lotId:newLot.id,date,qty,
    unitCost:Number(newLot.unitCost),cost:money(qty*Number(newLot.unitCost)),operationRef,
    updatedAt:new Date().toISOString()});
   const next=deletion?null:ledger.movements[index],cost=next?.cost||0,stamp=new Date().toISOString();
   if(old.sourceType==='feed'){
    db.feed=db.feed.filter(x=>x.id!==old.sourceId);
    if(!deletion)db.feed.push({...originalRecord,cycleId:newCycle.id,date,type:newLot.item,qty,
     price:Number(newLot.unitCost),currency:newLot.currency||originalRecord.currency,updatedAt:stamp});
   }else if(old.sourceType==='med'){
    db.meds=db.meds.filter(x=>x.id!==old.sourceId);
    if(!deletion)db.meds.push({...originalRecord,cycleId:newCycle.id,date,
     type:newLot.kind==='med'?'دواء':newLot.kind==='vaccine'?'تحصين':'مطهر',
     name:newLot.item,qty,cost,currency:newLot.currency||originalRecord.currency,updatedAt:stamp});
   }else{
    const prior=db.finance[oldCycle.id],originalExpense=prior.expenses.find(x=>x.id===old.sourceId);
    db.finance[oldCycle.id]={...prior,expenses:prior.expenses.filter(x=>x.id!==old.sourceId)};
    delete ledger.expenses[old.sourceId];
    if(!deletion){
     const current=db.finance[newCycle.id]||{};
     db.finance[newCycle.id]={...current,expenses:[...(current.expenses||[]),
      {...originalExpense,amount:cost,updatedAt:stamp}]};
     ledger.expenses[old.sourceId]={...originalRecord,cycleId:newCycle.id,date,qty,
      price:Number(newLot.unitCost),amount:cost,lotId:newLot.id,updatedAt:stamp};
    }
   }
   const after=deletion?null:copy(next);
   if(typeof opts.audit==='function')
    opts.audit(deletion?'delete':'update','v410_issue',old.id,{farmId:oldLot.farmId,before:old,after});
   if(typeof opts.persist!=='function')throw Error('Persistence is required');
   opts.persist();
   return {before:old,after,removed:deletion};
  }catch(e){
   ledger.movements=restore.movements;db.feed=restore.feed;db.meds=restore.meds;
   db.finance=restore.finance;ledger.expenses=restore.expenses;
   db.auditLog=restore.auditLog;ledger.audit=restore.ledgerAudit;
   throw e;
  }
 }
 return {revise,available};
});
