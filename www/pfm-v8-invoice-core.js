/* PFM V8 single purchase intake.
 * Pure planner: does not write storage, touch Supabase, or change an old record.
 * One invoice header with multiple distinct lines; existing V4.10 lots / chicks /
 * detailed expenses remain the ONLY sources of financial cost and stock movements.
 * An invoice document is metadata, NOT an additional expense.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.PFMV8InvoiceCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const STOCK=new Set(['feed','med','vaccine','disinfectant','bedding']);
 const DIRECT={
  rent:'إيجار المشروع',diesel:'تكلفة الديزل',electricity:'كهرباء',
  water:'ماء',labor:'عمال',loading:'تحميل دجاج',
  equipment_rent:'إيجار معدات',transport:'نقل',other:'مصاريف أخرى'
 };
 const KNOWN=new Set(['chicks',...STOCK,...Object.keys(DIRECT)]);
 const round=x=>Math.round((Number(x)+Number.EPSILON)*100)/100;
 const norm=x=>String(x??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
 const fail=message=>{throw Error(message)};
 const finite=(v,name,{min=0,max=Infinity,strict=false,integer=false}={})=>{
  if(v===null||v===undefined||String(v).trim()==='')fail(name+' required');
  const n=Number(v);
  if(!Number.isFinite(n)||(strict?n<=min:n<min)||n>max||(integer&&!Number.isInteger(n)))fail('Invalid '+name);
  return n;
 };
 function duplicate(db,farmId,supplier,invoice){
  const ledger=db.v410||{},number=norm(invoice),vendor=norm(supplier);
  const match=(r,ignoreVendor=false)=>{
   if(norm(r?.invoice||r?.invoiceNo)!==number)return false;
   if(ignoreVendor)return true;
   const previous=norm(r?.supplier);
   // A legacy row lacking supplier is ambiguous; block rather than risk duplication.
   return !previous||previous===vendor;
  };
  if((ledger.purchaseDocuments||[]).some(r=>r.farmId===farmId&&match(r)))return 'v8_invoice';
  if((ledger.purchaseInvoices||[]).some(r=>r.farmId===farmId&&match(r)))return 'chick_invoice';
  if((ledger.lots||[]).some(r=>r.farmId===farmId&&match(r)))return 'purchase_lot';
  if(Object.values(ledger.expenses||{}).some(r=>{
   const c=(db.cycles||[]).find(c=>c.id===r.cycleId);
   return c?.farmId===farmId&&match(r);
  }))return 'cycle_expense';
  if(Object.entries(ledger.chicks||{}).some(([cycleId,r])=>{
   const c=(db.cycles||[]).find(c=>c.id===cycleId);
   return c?.farmId===farmId&&match(r);
  }))return 'chicks_detail';
  return '';
 }
 function splitInteger(total,records){
  const sum=records.reduce((s,r)=>s+Number(r.birds),0);
  const counts=records.map(r=>Math.floor(total*Number(r.birds)/sum));
  let remaining=total-counts.reduce((s,n)=>s+n,0);
  for(const i of records.map((r,i)=>({i,left:Number(r.birds)-counts[i]}))
   .sort((a,b)=>b.left-a.left)){
   if(remaining<=0)break;
   const extra=Math.min(i.left,remaining);
   counts[i.i]+=extra;remaining-=extra;
  }
  if(remaining!==0)fail('Free chick allocation cannot be balanced');
  return counts;
 }
 function prepare(db,input,ctx){
  if(!db||!Array.isArray(db.farms)||!Array.isArray(db.cycles)||!ctx||
    typeof ctx.uuid!=='function'||typeof ctx.price!=='function'||
    typeof ctx.shares!=='function'||typeof ctx.normalizeExpenses!=='function')
    fail('Purchase accounting dependencies unavailable');
  const farmId=String(input?.farmId||'');
  const supplier=String(input?.supplier||'').trim();
  const invoice=String(input?.invoice||'').trim();
  const date=String(input?.date||'').trim();
  if(!db.farms.some(f=>f.id===farmId))fail('Select a registered farm');
  if(!supplier||!invoice||supplier.length>160||invoice.length>100)fail('Supplier and invoice number are required');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date+'T12:00:00Z')))
   fail('Valid invoice date is required');
  if(!ctx.canFinance?.(farmId))fail('Finance permission required for this farm');
  const existing=duplicate(db,farmId,supplier,invoice);
  if(existing)fail('DUPLICATE_INVOICE: '+existing+' (same farm, supplier and invoice number)');
  if(!Array.isArray(input.lines)||input.lines.length<1||input.lines.length>60)fail('Invoice needs 1–60 distinct lines');
  const ledger=db.v410||{},docs=[...(ledger.purchaseDocuments||[])];
  const nextV410={...ledger,lots:[...(ledger.lots||[])],
    chicks:{...(ledger.chicks||{})},expenses:{...(ledger.expenses||{})},
    audit:[...(ledger.audit||[])],purchaseDocuments:docs};
  const nextFinance={...(db.finance||{})};
  const seen=new Set(),lines=[],total={net:0,tax:0,gross:0,recoverable:0,accountingCost:0};
  const now=typeof ctx.now==='function'?ctx.now():new Date().toISOString();
  const lineNumber=input.lines.length;
  for(let i=0;i<lineNumber;i++){
   const x=input.lines[i]||{},kind=String(x.kind||''),item=String(x.item||'').trim();
   if(!KNOWN.has(kind))fail('Unknown purchase category at line '+(i+1));
   if(!item||item.length>180)fail('Enter item description at line '+(i+1));
   const isChicks=kind==='chicks';
   const scope=isChicks?String(x.cycleNumber||''):DIRECT[kind]?String(x.cycleId||''):'stock';
   // A second chick line would overwrite the same cycle cost in this transaction.
   if(isChicks&&lines.some(prev=>prev.kind==='chicks'&&prev.cycleNumber===Number(x.cycleNumber)))
    fail('DUPLICATE_CHICKS: reception cycle already has a line');
   const signature=kind+'|'+norm(item)+'|'+scope;
   if(seen.has(signature))fail('DUPLICATE_ITEM: identical invoice line '+(i+1));
   seen.add(signature);
   const qty=finite(x.quantity,'quantity',{min:0,strict:true});
   const unit=String(x.unit||'item').trim().slice(0,36);
   const pricing=String(x.priceMode||'total');
   if(!['unit','total'].includes(pricing))fail('Unknown price basis');
   const listed=finite(x.amount,'amount',{min:0,strict:true});
   const amount=round(pricing==='unit'?qty*listed:listed);
   const discount=finite(x.discount??0,'discount');
   const freight=finite(x.freight??0,'freight');
   const rate=finite(x.vatRate??0,'VAT rate',{max:100});
   const reclaim=finite(x.reclaim??0,'recoverable VAT',{max:100});
   const mode=String(x.vatMode||'excluded');
   if(!['included','excluded'].includes(mode)||discount>=amount)fail('Invalid VAT mode or discount');
   if(!isChicks&&freight)fail('Freight must be included in an item amount except for chicks');
   let cycles=[],free=0,cycle=null;
   if(isChicks){
    const num=finite(x.cycleNumber,'chick cycle number',{min:0,strict:true,integer:true});
    cycles=db.cycles.filter(c=>c.farmId===farmId&&Number(ctx.cycleOrdinal?.(c)??c.cycleNumber??1)===num);
    if(!cycles.length||cycles.some(c=>!Number.isInteger(Number(c.birds))||Number(c.birds)<1))
     fail('Select a farm cycle with registered house chick quantities');
    const actual=cycles.reduce((s,c)=>s+Number(c.birds),0);
    if(!Number.isInteger(qty)||qty!==actual)fail('Chick purchase quantity must equal the total received in selected houses');
    free=finite(x.free??0,'free chicks',{min:0,integer:true});
    if(free>=qty)fail('Free chicks must be less than received chicks');
    for(const c of cycles)if(ledger.close?.[c.id]?.status==='closed'||
       ledger.chicks?.[c.id]||Number(db.finance?.[c.id]?.chicks||0)>0)
       fail('Chicks already charged or cycle financially closed; no data changed');
   }else if(DIRECT[kind]){
    cycle=db.cycles.find(c=>c.id===scope&&c.farmId===farmId);
    if(!cycle)fail('Direct expense must be assigned to a cycle in the selected farm');
    if(ledger.close?.[cycle.id]?.status==='closed')fail('Cannot charge a closed financial cycle');
   }else if(!STOCK.has(kind))fail('Purchase kind cannot be allocated');
   const billed=isChicks?qty-free:qty;
   // Unit price for chicks is applied to PAID chicks only; total mode is an invoice amount.
   const effectiveAmount=round(pricing==='unit'?billed*listed:amount);
   if(discount>=effectiveAmount)fail('Discount is greater than invoice line amount');
   const unitKind=unit==='ton'?'ton':'item';
   const priced=ctx.price({quantity:billed,amount:round(effectiveAmount-discount),
    vatRate:rate,reclaimPercent:reclaim,mode,unit:unitKind});
   const tax={...priced,rate,mode,reclaim};
   const cost=round(priced.accountingCost+freight);
   const row={id:ctx.uuid(),kind,item,quantity:qty,unit:unit==='ton'?'kg':unit,
     priceMode:pricing,amount:effectiveAmount,discount,freight,vat:tax,
     cost,free,cycleNumber:isChicks?Number(x.cycleNumber):null,
     cycleId:cycle?.id||null,note:String(x.note||'').trim().slice(0,400)};
   if(STOCK.has(kind)){
    nextV410.lots.push({id:row.id,farmId,kind,item,unit:row.unit,
     qty:priced.quantityBase,amount:effectiveAmount,discount,
     accountingCost:priced.accountingCost,unitCost:priced.accountingCost/priced.quantityBase,
     vat:tax,date,supplier,invoice,createdAt:now,currency:db.settings?.currency||'SAR',
     purchaseDocumentId:null});
   }else if(isChicks){
    const weights=c=>c.birds;
    const costs=ctx.shares(cost,cycles,weights),nets=ctx.shares(tax.net,cycles,weights),
      taxes=ctx.shares(tax.tax,cycles,weights),grosses=ctx.shares(tax.gross,cycles,weights),
      recs=ctx.shares(tax.recoverable,cycles,weights),
      amounts=ctx.shares(effectiveAmount,cycles,weights),
      discounts=ctx.shares(discount,cycles,weights),freights=ctx.shares(freight,cycles,weights),
      frees=splitInteger(free,cycles);
    for(let j=0;j<cycles.length;j++){
     const c=cycles[j],vtx={
      net:nets[j].amount,tax:taxes[j].amount,gross:grosses[j].amount,
      recoverable:recs[j].amount,
      nonRecoverable:round(taxes[j].amount-recs[j].amount),
      accountingCost:round(grosses[j].amount-recs[j].amount),
      mode,rate,reclaim};
     nextV410.chicks[c.id]={mode:'invoice',billed:Number(c.birds)-frees[j],
      free:frees[j],unitPrice:null,invoiceAmount:amounts[j].amount,
      discount:discounts[j].amount,freight:freights[j].amount,
      vat:vtx,cost:costs[j].amount,invoiceNo:invoice,supplier,date,
      createdAt:now,purchaseDocumentId:null};
     nextFinance[c.id]={...(nextFinance[c.id]||{}),chicks:costs[j].amount};
    }
    row.allocatedCycles=cycles.map((c,j)=>({cycleId:c.id,houseId:c.houseId,
     birds:c.birds,cost:costs[j].amount}));
   }else{
    const existing=nextFinance[cycle.id]||{};
    // Preserve unsummarized legacy labor/utility/transport/other totals on the
    // first new detailed expense. Otherwise assigning expenses[] would hide them.
    const expenses=Array.isArray(existing.expenses)&&existing.expenses.length?
      existing.expenses.map(x=>({...x})):ctx.normalizeExpenses(existing).map(x=>({...x}));
    const financeEntry={id:row.id,category:DIRECT[kind],amount:cost,updatedAt:now};
    expenses.push(financeEntry);
    nextFinance[cycle.id]={...existing,expenses};
    nextV410.expenses[row.id]={id:row.id,cycleId:cycle.id,date,category:DIRECT[kind],
     qty,price:round(effectiveAmount/qty),supplier,invoice,note:row.note,
     tax,amount:cost,currency:ctx.currency?.(cycle.id)||db.settings?.currency||'SAR',
     purchaseDocumentId:null};
   }
   lines.push(row);
   for(const key of ['net','tax','gross','recoverable'])total[key]=round(total[key]+Number(tax[key]));
   total.accountingCost=round(total.accountingCost+cost);
  }
  const id=ctx.uuid();
  for(const row of lines){
   const lot=nextV410.lots.find(l=>l.id===row.id);
   if(lot)lot.purchaseDocumentId=id;
   const expense=nextV410.expenses[row.id];
   if(expense)expense.purchaseDocumentId=id;
   if(row.kind==='chicks')for(const c of row.allocatedCycles){
    nextV410.chicks[c.cycleId].purchaseDocumentId=id;
   }
  }
  const document={id,farmId,supplier,invoice,date,lines,totals:total,
   createdAt:now,createdBy:ctx.userId||null,currency:db.settings?.currency||'SAR'};
  docs.push(document);
  nextV410.audit.push({id:ctx.uuid(),date:now,actorId:ctx.userId||null,
   event:'v8_purchase_invoice',cycleId:null,before:null,
   after:{id,farmId,invoice,supplier,lines:lines.map(l=>l.id)},reason:''});
  return {document,nextV410,nextFinance};
 }
 function commit(db,input,ctx){
  if(typeof ctx?.persist!=='function')fail('Persistent local save is required');
  const plan=prepare(db,input,ctx),previousV410=db.v410,previousFinance=db.finance;
  try{
   db.v410=plan.nextV410;
   db.finance=plan.nextFinance;
   ctx.persist();
  }catch(err){
   db.v410=previousV410;
   db.finance=previousFinance;
   throw err;
  }
  return plan.document;
 }
 return {prepare,commit,duplicate,norm,STOCK_KINDS:[...STOCK],DIRECT_KINDS:Object.keys(DIRECT)};
});
