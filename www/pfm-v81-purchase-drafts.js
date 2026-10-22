/* V8.1: persistent purchase line drafts, never a second expense ledger. */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.PFMV81PurchaseDrafts=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clone=v=>JSON.parse(JSON.stringify(v));
 const list=db=>Array.isArray(db?.v410?.purchaseDrafts)?db.v410.purchaseDrafts:[];
 const read=(db,farmId)=>list(db).find(d=>d.farmId===farmId)||null;
 function store(db,next,ctx){
  const previous=db.v410;
  db.v410={...previous,purchaseDrafts:next};
  try{
   if(typeof ctx.persist!=='function')throw Error('Draft persistence unavailable');
   ctx.persist();
  }catch(e){db.v410=previous;throw e}
 }
 function validate(db,draft,ctx){
  const supplier=String(draft.supplier||'').trim()||'DRAFT_VENDOR_ONLY';
  const invoice=String(draft.invoice||'').trim()||('UNPOSTED_DRAFT_'+draft.id);
  const safeInput={farmId:draft.farmId,date:draft.date,
   supplier,invoice,lines:draft.lines.map(({draftLineId,...line})=>line)};
  // Preflight through the SAME invoice accounting planner that will post final
  // records. Its prepare stage is read-only and neither books an expense nor
  // creates a stock lot.
  const prepare=ctx?.prepare;
  if(typeof prepare!=='function')throw Error('Invoice validation unavailable');
  return prepare(db,safeInput,ctx.accounting()).document;
 }
 function saveLine(db,request,ctx){
  const farmId=String(request.farmId||''),old=read(db,farmId);
  if(!db.farms?.some(f=>f.id===farmId))throw Error('Select registered farm');
  if(!request.line||typeof request.line!=='object')throw Error('Purchase line required');
  const d=old?clone(old):{id:ctx.uuid(),farmId,invoice:'',supplier:'',date:request.header?.date||'',lines:[]};
  const id=String(request.lineId||ctx.uuid());
  const item={draftLineId:id,...clone(request.line)};
  const index=d.lines.findIndex(l=>l.draftLineId===id);
  if(index>=0)d.lines[index]=item;
  else d.lines.push(item);
  if(d.lines.length>60)throw Error('Maximum 60 purchase lines');
  d.supplier=String(request.header?.supplier||d.supplier||'').trim();
  d.invoice=String(request.header?.invoice||d.invoice||'').trim();
  d.date=String(request.header?.date||d.date||'').trim();
  d.updatedAt=new Date().toISOString();
  const preview=validate(db,d,ctx);
  const next=list(db).filter(x=>x.farmId!==farmId).concat(d);
  store(db,next,ctx);
  return {draft:d,lineId:id,preview};
 }
 function removeLine(db,{farmId,lineId},ctx){
  const old=read(db,farmId);if(!old)throw Error('No saved purchase draft');
  const d=clone(old);d.lines=d.lines.filter(l=>l.draftLineId!==lineId);
  if(d.lines.length===old.lines.length)throw Error('Saved line not found');
  const next=list(db).filter(x=>x.farmId!==farmId);
  if(d.lines.length){d.updatedAt=new Date().toISOString();next.push(d);}
  store(db,next,ctx);return d.lines.length?d:null;
 }
 return {read,list,saveLine,removeLine,validate};
});
