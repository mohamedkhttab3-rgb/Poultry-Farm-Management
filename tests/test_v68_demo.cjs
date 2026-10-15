const fs=require('fs'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'demo-data/SAUDI_2026_2_ROUNDS_COMPLETE.json'),'utf8'));
const d=source.data;
const stats=JSON.parse(fs.readFileSync(path.join(root,'demo-data/SAUDI_2026_SUMMARY.json'),'utf8')).summary;
assert.equal(source.format,'PFM_BACKUP_V57');
assert.equal(d.farms.length,2);assert.equal(d.houses.length,4);assert.equal(d.cycles.length,8);
assert.equal(d.daily.length,312);assert.equal(d.weights.length,48);assert.equal(d.sales.length,16);
const ids=new Map(d.farms.map(f=>[f.id,f])); const houses=new Map(d.houses.map(h=>[h.id,h]));
const cycles=new Map(d.cycles.map(c=>[c.id,c]));
assert.equal(d.cycles.reduce((s,c)=>s+c.birds,0),240000);
for(const h of d.houses){assert(ids.has(h.farmId));assert.equal(h.capacity,30000)}
for(const c of d.cycles){
 assert(ids.has(c.farmId));assert.equal(houses.get(c.houseId).farmId,c.farmId);
 assert.equal(c.birds,30000);assert(c.standardBreed);
 const mort=d.daily.filter(r=>r.cycleId===c.id).reduce((s,x)=>s+x.dead,0);
 const cul=d.daily.filter(r=>r.cycleId===c.id).reduce((s,x)=>s+x.cull,0);
 const sold=d.sales.filter(r=>r.cycleId===c.id).reduce((s,x)=>s+x.birds,0);
 assert.equal(mort+cul+sold,30000);assert.equal(d.daily.filter(r=>r.cycleId===c.id).length,39);
 const feedDaily=d.daily.filter(r=>r.cycleId===c.id).reduce((s,x)=>s+x.feed,0);
 const feedLedger=d.feed.filter(r=>r.cycleId===c.id).reduce((s,x)=>s+x.qty,0);
 assert(Math.abs(feedDaily-feedLedger)<0.05);
 const fin=d.finance[c.id];assert(fin&&fin.chicks>0&&fin.expenses.length===9);
}
const kinds=new Set(d.v410.lots.map(l=>l.kind));for(const k of ['chicks','feed','rent','diesel','electricity','water','bedding','labor','loading','med','disinfectant','vaccine','equipment_rent','other'])assert(kinds.has(k));
for(const l of d.v410.lots){const issued=d.v410.movements.filter(x=>x.lotId===l.id).reduce((s,x)=>s+(x.kind==='return'?-x.qty:x.qty),0);assert(Math.abs(l.qty-issued)<1e-4,l.item)}
const cost=d.cycles.reduce((tot,c)=>tot+d.finance[c.id].chicks+d.finance[c.id].expenses.reduce((a,b)=>a+b.amount,0),0)+d.feed.reduce((s,x)=>s+x.qty*x.price,0)+d.meds.reduce((s,x)=>s+x.cost,0);
const revenue=d.sales.reduce((s,x)=>s+x.revenue,0);
assert(Math.abs(cost-stats.totalCost)<.005);assert(Math.abs(revenue-stats.totalRevenue)<.005);
assert.equal(d.settings.demoDataset,true);
console.log('PASS V6.8 demo — 2 farms, 4 houses, 8 cycle-house rounds, 240000 chicks, 14 cost groups, 312 daily records, 128 stock allocations, accounting reconciled');
