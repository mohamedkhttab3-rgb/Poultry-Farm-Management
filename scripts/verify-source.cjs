"use strict";
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),www=path.join(root,'www');
let errors=[];
for(const f of ['index.html','pfm-v57-data-controls.js','pfm-v59-print-results.js','pfm-v63-storage.js','pfm-v65-mobile.js','icon-512.png','manifest.json','supabase-config.js']){
 if(!fs.existsSync(path.join(www,f)))errors.push('Missing web asset: '+f);
}
const source=fs.readFileSync(path.join(www,'index.html'),'utf8');
const ids=[...source.matchAll(/<section class="view(?: active)?" id="([^"]+)"/g)].map(m=>m[1]);
if(ids.length<17)errors.push('Expected at least 17 app sections, found '+ids.length);
const expected=['dash','farms','houses','cycles','daily','weights','feed','meds','inventory','sales','finance','performance','compare','reports','settings'];
for(const s of expected)if(!ids.includes(s))errors.push('Missing view '+s);
for(const f of fs.readdirSync(www).filter(f=>f.endsWith('.js'))){try{new vm.Script(fs.readFileSync(path.join(www,f),'utf8'),{filename:f})}catch(e){errors.push('Bad JavaScript '+f+': '+e.message)}}
for(const f of ['desktop/main.cjs','capacitor.config.ts','www/icon.ico'])if(!fs.existsSync(path.join(root,f)))errors.push('Missing native build file '+f);
const pack=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if(!pack.scripts['build:win']||!pack.scripts['android:sync'])errors.push('Missing native scripts');
if(errors.length){console.error(errors.join('\n'));process.exit(1)}
console.log('PASS: '+ids.length+' app screens, source JS syntax, native packaging assets');
