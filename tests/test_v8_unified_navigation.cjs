'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('www/index.html','utf8');
const android=fs.readFileSync('www/pfm-v732-android-navigation.js','utf8');
const lang=fs.readFileSync('www/pfm-v55-project-navigation.js','utf8');
const nav=html.split('<nav id="v53-nav"')[1]?.split('</nav>')[0]||'';
assert(nav,'Common navigation missing');
const groups=[...nav.matchAll(/<section class="v55-nav-group v55-expanded" data-v55-group="([^"]+)">/g)].map(x=>x[1]);
assert.deepEqual(groups,['project','nutrition','daily','finance','analytics','admin']);
const expected={
 project:[['2','farms'],['3','houses'],['4','cycles']],
 nutrition:[['7','feed'],['8','meds'],['9','inventory']],
 daily:[['5','daily'],['6','weights']],
 finance:[['10','sales'],['11','finance']],
 analytics:[['12','performance'],['13','standards'],['14','compare'],['15','reports']],
 admin:[['16','users'],['17','settings'],['18','audit'],['19','backup']]
};
for(const [id,expectedButtons] of Object.entries(expected)){
 const part=nav.split('data-v55-group="'+id+'">')[1]?.split('</section>')[0];
 assert(part,'Missing navigation group '+id);
 const buttons=[...part.matchAll(/<button[^>]*data-stage="(\d+)"[^>]*onclick="show\('([^']+)'/g)].map(x=>[x[1],x[2]]);
 assert.deepEqual(buttons,expectedButtons,'Navigation actions must remain unchanged for '+id);
}
const headings={
 nutrition:['المشتريات','Purchases'],
 daily:['المتابعة اليومية للدورات','Daily Cycle Monitoring']
};
for(const [id,[ar,en]] of Object.entries(headings)){
 const segment=nav.split('data-v55-group="'+id+'">')[1].split('</section>')[0];
 assert(segment.includes('data-v55-ar="'+ar+'" data-v55-en="'+en+'"'),id+' translated label');
}
assert(android.includes("['nutrition','daily','finance']"),'Original Android reorder must match shared order');
assert(lang.includes('dataset.v55Ar')&&lang.includes('dataset.v55En'),'Language behavior changed');
console.log('PASS: Android/Windows/iOS use one navigation order with the same screen click handlers and Arabic/English labels.');
