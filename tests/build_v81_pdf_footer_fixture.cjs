'use strict';
// Build the same isolated HTML used by Windows/Android/iOS print flows, but
// with enough real table rows to check footer placement on EVERY A4 page.
const fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync('www/pfm-v59-print-results.js','utf8');
const start=source.indexOf(' function standalone(root,brandLogo){');
const end=source.indexOf(' // Use a full-sized printable document',start);
if(start<0||end<start)throw Error('Cannot isolate real standalone HTML print builder');
const output=process.argv[2]||'/tmp/pfm-pdf-footer-smoke.html';
const root=path.resolve('www')+path.sep;
const base='file://'+root+'index.html';
const css=fs.readFileSync('www/pfm-v59-print-results.css','utf8');
const rows=Array.from({length:125},(_,i)=>'<tr><td>ROW-'+String(i+1).padStart(3,'0')+'</td><td>Sample monthly farm accounting entry '+(i+1)+'</td><td>'+(i+1)*10+'.00</td></tr>').join('');
const htmlRoot='<article id="pfm59PrintRoot"><div class="pfm59-print-head"><div class="pfm59-print-brand"><img src="./pfm-logo.png"/><div><strong>Broiler cycle</strong><small>Poultry Farm Manager M.K™</small></div></div></div><div class="pfm59-print-scopes">Two-house test farm — cycle costing</div><section class="pfm59-table-section"><h3>Expense ledger</h3><table><thead><tr><th>Reference</th><th>Item</th><th>Cost</th></tr></thead><tbody>'+rows+'</tbody></table></section></article>';
const standalone=new Function('document','window','e','stylesheetText','logo',source.slice(start,end)+
 'return standalone({cloneNode(){return this},querySelector(sel){'+
 'if(sel===".pfm59-print-brand strong")return {textContent:"Broiler cycle"};'+
 'return null},outerHTML:'+JSON.stringify(htmlRoot)+'},logo);');
const finalHtml=standalone({baseURI:base,documentElement:{dir:'ltr',lang:'en'}},{Capacitor:{isNativePlatform:()=>false,getPlatform:()=> 'windows'}},
 s=>s,()=>css, 'data:image/png;base64,'+fs.readFileSync('www/pfm-logo.png').toString('base64'));
fs.writeFileSync(output,finalHtml);
console.log('PASS: Actual V8.1 standalone PDF document fixture with 125 rows: '+output);
