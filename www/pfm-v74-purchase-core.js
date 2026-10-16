/* Pure purchase accounting. Shared arithmetic only; injected by Android V7.4 UI.
   Never edits the existing Windows calculations or a user's database. */
(function (root, factory) {
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.PFM74PurchaseCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const round=x=>Math.round((x+Number.EPSILON)*100)/100;
 function price(input){
   const qty=Number(input.quantity),amount=Number(input.amount),rate=Number(input.vatRate||0),
         reclaim=Number(input.reclaimPercent??100),unit=input.unit||'kg',mode=input.mode||'excluded';
   if(![qty,amount,rate,reclaim].every(Number.isFinite)||qty<=0||amount<=0||rate<0||rate>100||reclaim<0||reclaim>100||!['included','excluded'].includes(mode))
     throw Error('Invalid purchase quantity, invoice amount, VAT or VAT mode');
   const quantityBase=unit==='ton'?qty*1000:qty;
   if(!Number.isFinite(quantityBase)||quantityBase<=0)throw Error('Invalid converted quantity');
   const net=round(mode==='included'?amount/(1+rate/100):amount);
   const tax=round(net*rate/100);
   const gross=round(net+tax);
   const recoverable=round(tax*reclaim/100);
   const accountingCost=round(gross-recoverable);
   return {quantityBase,baseUnit:unit==='ton'?'kg':unit,net,tax,gross,recoverable,
           nonRecoverable:round(tax-recoverable),accountingCost,unitCost:accountingCost/quantityBase};
 }
 function shares(total,records,weight){
   if(!Number.isFinite(total)||total<0||!Array.isArray(records)||!records.length)throw Error('Invalid cost allocation');
   const cents=Math.round(total*100),w=records.map(r=>Math.max(0,Number(weight(r))||0));
   const den=w.reduce((a,b)=>a+b,0),weights=den>0?w:records.map(()=>1),sum=weights.reduce((a,b)=>a+b,0);
   let used=0;
   return records.map((r,i)=>{
      const part=i===records.length-1?cents-used:Math.floor(cents*weights[i]/sum);
      used+=part;
      return {record:r,amount:part/100};
   });
 }
 function cycleGroup(cycles,farmId,ordinal,cycleOrdinal){
   return cycles.filter(c=>c.farmId===farmId&&Number(cycleOrdinal(c))===Number(ordinal));
 }
 return {price,shares,cycleGroup};
});