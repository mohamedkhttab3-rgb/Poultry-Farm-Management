'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const source=fs.readFileSync(process.argv[2]||'/tmp/pfm-v81-layout.xml','utf8');
const pages=[...source.matchAll(/<page\b[^>]*>([\s\S]*?)<\/page>/g)];
assert(pages.length>=2,'The real print fixture must paginate over at least two A4 pages');
for(const [i,page] of pages.entries()){
 const words=[...page[1].matchAll(/<word\b([^>]*)>([\s\S]*?)<\/word>/g)].map(m=>{
 const y=m[1].match(/\byMin="([^"]+)"/)?.[1],last=m[1].match(/\byMax="([^"]+)"/)?.[1];
 return {text:m[2].replace(/&[^;]+;/g,'').trim(),top:Number(y),bottom:Number(last)};
 });
 const branding=words.filter(w=>w.text==='Management');
 const rows=words.filter(w=>w.text.startsWith('ROW-'));
 assert(branding.length===1,'Page '+(i+1)+': expected one branded footer, got '+branding.length);
 assert(rows.length>0,'Page '+(i+1)+': missing sample ledger table rows');
 const lowestRow=Math.max(...rows.map(w=>w.bottom));
 assert(branding[0].top>lowestRow+2,'Page '+(i+1)+': brand overlaps last table row (rowY='+lowestRow+', footerY='+branding[0].top+')');
 console.log('PASS A4 page '+(i+1)+': '+rows.length+' ledger rows stop at '+lowestRow.toFixed(1)+'pt; repeating brand begins at '+branding[0].top.toFixed(1)+'pt');
}
if(process.argv[3]){
 const imageList=fs.readFileSync(process.argv[3],'utf8');
 const visibleImages=[...imageList.matchAll(/^\s*(\d+)\s+\d+\s+image\s+/gm)].map(m=>Number(m[1]));
 for(let page=1;page<=pages.length;page++){
  const count=visibleImages.filter(n=>n===page).length;
  assert(count>=1,'Page '+page+': original poultry logo missing from physical A4 footer');
  if(page>1)assert.equal(count,1,'Page '+page+': duplicate footer logo(s) found');
 }
 console.log('PASS: original 512x512 poultry logo rendered on every A4 page (no duplicates after cover page).');
}
console.log('PASS: actual shared PDF document places repeating footer below ledger rows on every physical Chrome A4 page.');
