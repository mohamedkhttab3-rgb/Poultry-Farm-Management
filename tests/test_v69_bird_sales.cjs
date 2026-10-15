const fs=require('fs'),path=require('path'),assert=require('assert'),vm=require('vm');
const root=path.resolve(__dirname,'..');
const prev=JSON.parse(fs.readFileSync(path.join(root,'tests','V6_4_REGRESSION_RESULTS.json'),'utf8'));
const data=JSON.parse(fs.readFileSync(path.join(root,'demo-data','SAUDI_2026_2_ROUNDS_COMPLETE.json'),'utf8')).data;
const smry=JSON.parse(fs.readFileSync(path.join(root,'demo-data','SAUDI_2026_SUMMARY.json'),'utf8')).summary;
assert.equal(data.settings.demoDataset,true);
assert.deepStrictEqual(data.settings.demoSalesRangeSAR,[8,8.5]);
assert.equal(data.farms.length,2);assert.equal(data.houses.length,4);assert.equal(data.cycles.length,8);
assert.equal(data.sales.length,16);assert.equal(data.daily.length,312);assert.equal(data.weights.length,48);
assert.equal(data.cycles.reduce((sum,c)=>sum+c.birds,0),240000);
const birds=data.sales.reduce((n,s)=>n+s.birds,0);assert.equal(birds,231736);
const sum=x=>Math.round(x.reduce((s,r)=>s+r.total,0)*100)/100;
const revenue=sum(data.sales);assert.equal(revenue,1932147.00);assert.equal(revenue,smry.totalRevenue);
for(const s of data.sales){
  assert(s.demo===true);assert(s.weightUnit==='bird');assert(s.price>=8&&s.price<=8.5);
  assert.equal(s.weightQty,s.birds);assert(s.avgWeight>0);
  assert.equal(s.total,Math.round(s.birds*s.price*100)/100);assert.equal(s.revenue,s.total);
}
assert.equal(smry.totalCost,2954624);
assert.equal(smry.profit,Math.round((revenue-smry.totalCost)*100)/100);
for(const c of data.cycles){const sold=data.sales.filter(s=>s.cycleId===c.id).reduce((n,s)=>n+s.birds,0);const dead=data.daily.filter(d=>d.cycleId===c.id).reduce((n,s)=>n+s.dead,0);const cull=data.daily.filter(d=>d.cycleId===c.id).reduce((n,s)=>n+s.cull,0);assert.equal(sold+dead+cull,c.birds);}
const code=fs.readFileSync(path.join(root,'www','index.html'),'utf8');
const start=code.indexOf('function saleRowRevenue(x){'),end=code.indexOf('\nfunction soldBirdsAtDate',start);
assert(start>=0&&end>start);
const rowRevenue=vm.runInNewContext('('+code.slice(start,end).trim()+')');
assert.equal(rowRevenue({birds:200,weightUnit:'bird',weightQty:200,price:8.25}),1650);
assert.equal(rowRevenue({birds:200,weightUnit:'kg',weightQty:500,price:7.0}),3500); // previous records retained
assert.equal(rowRevenue({birds:200,weightUnit:'kg',weightQty:500,price:7.0,total:3500}),3500);
assert.equal(rowRevenue({birds:200,weightUnit:'bird',price:8.25,total:1650}),1650);
assert(code.includes('option value="kg"') && code.includes('option value="bird"'));
assert(code.includes('const cur=getCycleCurrency(c),unit=saleWeightUnit.value||\'kg\''));
assert(code.includes('const price=+salePrice.value||0,total=unit===\'bird\'?birds*price:qty*price;'));
assert(code.includes('if(unit===\'kg\'&&!qty)'));
assert(code.includes('سعر الوحدة'));
const js=fs.readFileSync(path.join(root,'www','pfm-v68-sa-training.js'),'utf8');
const match=js.match(/const seeded=(\{.*\});\n const \$=/s);assert(match);
const embedded=JSON.parse(match[1]);assert.deepStrictEqual(embedded,data);
assert(js.includes('updateExistingDemoSales'));assert(js.includes('if(!db?.settings?.demoDataset)'));
assert(js.includes('db.sales.some(s=>!s.demo)'));
console.log('PASS V6.9.1 — 16 per-bird sales at SAR 8.00–8.50, 231736 birds, revenue',revenue.toFixed(2),'cost',smry.totalCost.toFixed(2),'result',smry.profit.toFixed(2),'kg and bird user options preserved');
