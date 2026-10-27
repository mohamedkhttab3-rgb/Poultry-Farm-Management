'use strict';
// Physically mimic the user screenshot: wide cycle table, 12 columns, long
// Arabic/English notes, many pages and compact report metric boxes.
const fs=require('node:fs'),cp=require('node:child_process');
const dir=require('node:path').resolve('www');
const original='/tmp/pfm-v82-cycle-original.html';
const output=process.argv[2]||'/tmp/pfm-v82-cycle-compact.html';
cp.execFileSync(process.execPath,['tests/build_v81_pdf_footer_fixture.cjs',original]);
let html=fs.readFileSync(original,'utf8');
const rowCount=80;
const cells=(row,i)=>'<td>'+row+'</td><td>2026-10-'+String(i%28+1).padStart(2,'0')+'</td>'+
 '<td>'+String(i%42+1)+'</td><td>15</td><td>0.07%</td><td>420</td>'+
 '<td>1.84%</td><td>19,565</td><td>3,543.52</td><td>27.0</td>'+
 '<td>58.0</td><td>1.450</td><td>بيانات دورة اختبارية وليست سجلات مزرعة حقيقية</td>';
const rows=Array.from({length:rowCount},(_,i)=>'<tr>'+cells('ROW-'+String(i+1).padStart(3,'0'),i)+'</tr>').join('');
const header='<tr>'+['Reference','التاريخ','العمر','النافق','النفوق %','التراكمي','التراكمي %','الحي','المياه','الحرارة','الرطوبة','الوزن','ملاحظات'].map(t=>'<th>'+t+'</th>').join('')+'</tr>';
const first=html.indexOf('<section class="pfm59-table-section">');
const last=html.indexOf('</section></article>',first);
if(first<0||last<0)throw Error('Old print source did not match fixture');
const report='<section class="pfm59-table-section pfm59-report"><h3>Cycle summary</h3>'+
 '<div class="report-cards">'+Array.from({length:9},(_,i)=>'<div class="card"><b>مؤشر الإنتاج '+(i+1)+'</b><strong class="kpi">20,000</strong><span class="muted">سجل فني</span></div>').join('')+'</div>'+
 '<table><thead>'+header+'</thead><tbody>'+rows+'</tbody></table>';
html=html.slice(0,first)+report+html.slice(last);
fs.writeFileSync(output,html);
console.log('PASS: screenshot-like cycle report with '+rowCount+' rows and nine compact cards: '+output);
