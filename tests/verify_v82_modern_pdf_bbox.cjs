'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const xml=fs.readFileSync(process.argv[2], 'utf8');
const images=fs.readFileSync(process.argv[3], 'utf8');
const pages=[...xml.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)];
assert(pages.length>=2,'168 daily entries must generate multiple physical A4 pages');
const imgPages=[...images.matchAll(/^\s*(\d+)\s+\d+\s+image\s+/gm)].map(x=>+x[1]);
for(const [i,p] of pages.entries()){
 const w=Number(p[1].match(/width="([^"]+)"/)?.[1]),h=Number(p[1].match(/height="([^"]+)"/)?.[1]);
 assert(Math.abs(w-842)<3&&Math.abs(h-595)<3,'All PDF pages must be A4 landscape');
 const words=[...p[2].matchAll(/<word\b([^>]*)>([\s\S]*?)<\/word>/g)].map(m=>({
  value:m[2].trim(), y:Number(m[1].match(/yMin="([^"]+)"/)?.[1]),end:Number(m[1].match(/yMax="([^"]+)"/)?.[1])
 }));
 const brand=words.filter(x=>x.value==='Management'&&x.y>490);
 assert(brand.length>=1,'Page '+(i+1)+' missing repeated bottom-centre company name');
 const anchor=brand[brand.length-1];
 const rows=words.filter(x=>x.value.includes('2026')&&x.y<anchor.y);
 if(rows.length)assert(Math.max(...rows.map(x=>x.end))<anchor.y-2,'Printed records overlap the footer on page '+(i+1));
 assert(imgPages.includes(i+1),'Original poultry logo must be drawn on physical A4 page '+(i+1));
 console.log('PASS A4 landscape page '+(i+1)+' footer begins at '+anchor.y.toFixed(1)+', image embedded');
}
console.log('PASS V8.2 modern PDF has original logo and visible M.K company identity on all '+pages.length+' physical A4 pages.');
