'use strict';
// Poultry technical / cycle economics regression tests against the actual calc(c) function.
// All inputs are synthetic; user production data and saved settings are never read or changed.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','www','index.html'),'utf8');
const calcBody=source.match(/function calc\(c\)\{[\s\S]*?(?=\nfunction cycleOrdinal\(c\))/)?.[0];
assert(calcBody,'Cannot find full calc(c) source; review application changes');
const cycle={id:'cycle-1',birds:1000,initWeight:0.04,currency:'SAR'};
const sale={id:'sale-1',cycleId:cycle.id,date:'2026-10-16',birds:100,weightKg:230,total:2760};
const context=vm.createContext({
 db:{
  sales:[sale],
  weights:[{cycleId:cycle.id,date:'2026-10-10',cv:8}],
  meds:[{cycleId:cycle.id,date:'2026-10-11',cost:100}],
  feed:[{cycleId:cycle.id,date:'2026-10-11',qty:400,price:2}],
  finance:{[cycle.id]:{chicks:1200,otherRevenue:50}}
 },
 financeDraftExpenses:{},
 today:()=> '2026-10-16',cycleMetricDate:()=> '2026-10-16',
 deadTotal:()=>20,cullTotal:()=>10,
 isPastOrToday:()=>true,
 saleRowBirds:(c,s)=>s.birds,saleWeightKg:(c,s)=>s.weightKg,
 liveAtDate:()=>870,feedForFcr:()=>3500,performanceWeight:()=>2,
 age:()=>35,getCycleCurrency:()=> 'SAR',
 saleRowRevenue:s=>s.total,financeExpenseTotal:()=>300,
 liveSource:()=>({source:'synthetic-test'})
});
vm.runInContext(calcBody+String.fromCharCode(10)+'this.calculate=calc;',context);
const approx=(actual,expected,label)=>assert(Math.abs(actual-expected)<1e-8,`${label}: ${actual} != ${expected}`);
const result=context.calculate(cycle);
assert.equal(result.liv,870,'correct live birds after mortality, culling and sales');
assert.equal(result.soldBirds,100);
assert.equal(result.soldKg,230);
assert.equal(result.dead,20);
assert.equal(result.cul,10);
assert.equal(result.fc,800);
assert.equal(result.meds,100);
assert.equal(result.expenseTotal,300);
assert.equal(result.cost,2400,'chicks + feed + meds + additional expenses');
assert.equal(result.saleRevenue,2760);
assert.equal(result.rev,2810);
assert.equal(result.profit,410);
approx(result.liveKg,1740,'live weight');
approx(result.totalLiveWeight,1970,'live + harvested weight');
approx(result.fcr,3500/1970,'cumulative FCR including harvest');
approx(result.gainFcr,3500/(1970-40),'gain-based FCR separate');
approx(result.livPct,97,'livability percentage');
approx(result.adg,56,'average daily gain grams per day');
approx(result.epef,(97*2*100)/(35*(3500/1970)),'European Production Efficiency Factor');
approx(result.costPerBird,2400/(870+100),'cost per marketable bird');
approx(result.costPerKg,2400/1970,'cost per produced live kg');
approx(result.realizedPriceKg,2760/230,'sale price per kg');
context.db.sales=[];context.db.feed=[];context.db.meds=[];context.db.weights=[];
context.db.finance[cycle.id]={chicks:0,otherRevenue:0};
const empty=context.calculate(cycle);
assert.equal(empty.soldBirds,0);
assert.equal(empty.saleRevenue,0);
assert.equal(empty.cost,300,'synthetic expense stub persists');
assert.equal(empty.profit,-300);
console.log('PASS: original cycle calc — FCR, gain FCR, EPEF, ADG, birds, harvest weight, expenses, revenue, profit, cost per bird/kg.');
console.log('LIMIT: deterministic synthetic cases only; feed/stock posting and native device behavior need integration tests.');
