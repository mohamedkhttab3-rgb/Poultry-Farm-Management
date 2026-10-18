'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const read=p=>fs.readFileSync(p,'utf8');
const nav=read('www/pfm-v732-android-navigation.js');
const old=read('www/pfm-v73-android.js');
const loader=read('www/pfm-v72-android-login.js');
const version=read('scripts/set-android-version.cjs');
new vm.Script(nav,{filename:'pfm-v732-android-navigation.js'});
assert.match(loader,/sidebar\.src='\.\x2fpfm-v732-android-navigation\.js'/);
assert.doesNotMatch(old,/function nav\(\)/);
assert.doesNotMatch(old,/setInterval\(brand,3000\)/);
assert.match(version,/versionName "7\.3\.[2345]"/);
assert.match(version,/versionCode 73[2345]/);
const order=[
 "id:'project',ar:'مدخلات المشاريع'",
 "id:'nutrition',ar:'المشتريات'",
 "id:'daily',ar:'المتابعة اليومية للدورات'",
 "id:'finance',ar:'المبيعات والمالية'"
];
let at=-1;for(const x of order){let i=nav.indexOf(x);assert(i>at,'group order wrong: '+x);at=i;}
for(const [stage,name] of [['2','farms'],['3','houses'],['4','cycles'],['7','feed'],['8','meds'],['9','inventory'],['5','daily'],['6','weights'],['10','sales'],['11','finance']]){
 assert(nav.includes("['"+stage+"','"+name+"'"),'Screen missing '+name);
}
assert.match(nav,/holder\.replaceChildren\(img,title,mark\)/);
assert.match(nav,/mark\.textContent='M\.K™'/);
assert.match(nav,/button\.textContent=chosen==='ar'\?ar:en/);
assert.match(nav,/\.getAttribute\('onclick'\)/);
assert.match(nav,/window\.PFMAndroidNavigationV732=\{repair,inspect,translate\}/);
console.log('PASS: 7.3.2 menu sections, all 10 preserved routes, bilingual labels, branded image and no old menu mutation.');
console.log('LIMIT: static contract tests, not real-device visual verification.');
