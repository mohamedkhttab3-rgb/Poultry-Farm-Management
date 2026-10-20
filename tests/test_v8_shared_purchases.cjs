'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const loader=fs.readFileSync('www/pfm-v8-purchases-loader.js','utf8');
const purchases=fs.readFileSync('www/pfm-v75-android-purchases.js','utf8');
const androidLogin=fs.readFileSync('www/pfm-v72-android-login.js','utf8');
const index=fs.readFileSync('www/index.html','utf8');
const core=fs.readFileSync('www/pfm-v74-purchase-core.js','utf8');
assert(index.includes('<script src="./pfm-v8-purchases-loader.js"></script>'));
assert(index.indexOf('<script src="./v410-finance.js"></script>')<index.indexOf('<script src="./pfm-v8-purchases-loader.js"></script>'));
assert(index.indexOf('<script src="./v52-finance.js"></script>')<index.indexOf('<script src="./pfm-v8-purchases-loader.js"></script>'));
assert(!loader.includes('localStorage')&&!loader.includes('supabase'),'Purchases loader must not touch user data');
assert(purchases.includes('if(!isAndroid&&!window.PFMV8SharedPurchasesEnabled)return;'));
assert(purchases.includes('isAndroid?rule:rule.replaceAll'), 'Only non-Android style scope should change');
assert(purchases.includes("ledger.chicks=chicks;ledger.purchaseInvoices=purchases;d.v410=ledger;d.finance=finance;"),'Original financial logic must stay intact');
assert(androidLogin.includes("sidebar.src='./pfm-v732-android-navigation.js'"));
assert(androidLogin.includes("purchases.src='./pfm-v75-android-purchases.js'"));
assert(core.includes('PFM74PurchaseCore'));
for(const platform of ['android','ios','windows']){
 const resources=[],elements=new Map();
 const make=(tag)=>({tag,attrs:{},listeners:{},addEventListener(name,fn){this.listeners[name]=fn},set id(v){this._id=v;elements.set(v,this)},get id(){return this._id}});
 const document={
  getElementById:id=>elements.get(id)||null,
  createElement:make,
  head:{appendChild(el){resources.push(el)}}
 };
 const android=platform==='android',ios=platform==='ios';
 const window={Capacitor:{isNativePlatform:()=>android||ios,getPlatform:()=>platform}};
 vm.runInNewContext(loader,{window,document},{filename:'pfm-v8-purchases-loader.js'});
 vm.runInNewContext(loader,{window,document},{filename:'pfm-v8-purchases-loader.js'});
 if(android){
  assert.equal(resources.length,0,'Android must keep existing bootstrap and avoid duplicate purchases UI');
  continue;
 }
 assert.equal(resources.length,1,'Load the purchases core only once on '+platform);
 assert.equal(resources[0].src,'./pfm-v74-purchase-core.js');
 assert.equal(window.PFMV8SharedPurchasesEnabled,true);
 resources[0].listeners.load();
 resources[0].listeners.load();
 assert.equal(resources.length,2,'Load purchases UI once after core, on '+platform);
 assert.equal(resources[1].src,'./pfm-v75-android-purchases.js');
}
console.log('PASS: original Android workflow unchanged; Windows and iOS load exact same purchase forms/core once after finance dependencies.');
