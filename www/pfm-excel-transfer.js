/* Poultry Farm Manager — self-contained offline XLSX round-trip.
   No external services; compatible with local file:// launches. */
(function(){'use strict';
const VERSION='PFM-EXCEL-1';
const META='_PFM_META', GUIDE='Instructions';
const te=new TextEncoder(), td=new TextDecoder();
const escapeXml=v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const validKey=k=>/^[A-Za-z][A-Za-z0-9_]*$/.test(k)&&k.length<=31;
const letters=n=>{let s='';for(let a=n+1;a;a=Math.floor((a-1)/26))s=String.fromCharCode(65+(a-1)%26)+s;return s;};
const packValue=v=>v===null?'__PFM_NULL__':typeof v==='object'?'__PFM_JSON__:'+JSON.stringify(v):v;
const unpackValue=v=>v==='__PFM_NULL__'?null:typeof v==='string'&&v.startsWith('__PFM_JSON__:')?JSON.parse(v.slice(13)):v;
const xmlCell=(v,row,col)=>{
  if(v===undefined)return '';
  const ref=letters(col)+row;
  if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"><v>${v}</v></c>`;
  if(typeof v==='boolean')return `<c r="${ref}" t="b"><v>${v?1:0}</v></c>`;
  const x=String(v),space=(/^\s|\s$/.test(x)?' xml:space="preserve"':'');
  return `<c r="${ref}" t="inlineStr"><is><t${space}>${escapeXml(x)}</t></is></c>`;
};
const sheetXml=rows=>{
  const parts=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="16"/><sheetData>'];
  for(let i=0;i<rows.length;i++){
    const row=rows[i];parts.push(`<row r="${i+1}">`);
    for(let j=0;j<row.length;j++)parts.push(xmlCell(row[j],i+1,j));
    parts.push('</row>');
  }
  parts.push('</sheetData></worksheet>');return te.encode(parts.join(''));
};
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
const crc=u=>{let c=0xffffffff;for(let i=0;i<u.length;i++)c=crcTable[(c^u[i])&255]^(c>>>8);return (c^0xffffffff)>>>0;};
const u16=(v,o,x)=>v.setUint16(o,x,true),u32=(v,o,x)=>v.setUint32(o,x>>>0,true);
function makeZip(entries){
  let at=0;const pieces=[],central=[];
  for(const [name,buf] of entries){
    const fn=te.encode(name),sz=buf.byteLength,ch=crc(buf);
    if(sz>0xffffffff)throw Error('حجم الورقة يتجاوز حد Excel ZIP');
    const loc=new Uint8Array(30+fn.length),dv=new DataView(loc.buffer);
    u32(dv,0,0x04034b50);u16(dv,4,20);u16(dv,6,0x0800);u16(dv,8,0);u32(dv,14,ch);u32(dv,18,sz);u32(dv,22,sz);u16(dv,26,fn.length);loc.set(fn,30);
    const cd=new Uint8Array(46+fn.length),cv=new DataView(cd.buffer);
    u32(cv,0,0x02014b50);u16(cv,4,20);u16(cv,6,20);u16(cv,8,0x0800);u16(cv,10,0);u32(cv,16,ch);u32(cv,20,sz);u32(cv,24,sz);u16(cv,28,fn.length);u32(cv,42,at);cd.set(fn,46);
    pieces.push(loc,buf);central.push(cd);at+=loc.length+sz;
  }
  const cdStart=at;for(const x of central){pieces.push(x);at+=x.length;}
  const end=new Uint8Array(22),ed=new DataView(end.buffer);u32(ed,0,0x06054b50);u16(ed,8,central.length);u16(ed,10,central.length);u32(ed,12,at-cdStart);u32(ed,16,cdStart);pieces.push(end);
  return new Blob(pieces,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function workbookFile(books){
  const types=['<?xml version="1.0" encoding="UTF-8"?>',
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
    '<Default Extension="xml" ContentType="application/xml"/>',
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'];
  const wb=['<?xml version="1.0" encoding="UTF-8"?>',
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'];
  const rel=['<?xml version="1.0" encoding="UTF-8"?>',
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'];
  const entries=[['_rels/.rels',te.encode('<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')],
    ['xl/styles.xml',te.encode('<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" xfId="0"/></cellXfs></styleSheet>')]];
  for(let i=0;i<books.length;i++){
    const name=books[i][0];types.push(`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`);
    wb.push(`<sheet name="${escapeXml(name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`);
    rel.push(`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`);
    entries.push([`xl/worksheets/sheet${i+1}.xml`,sheetXml(books[i][1])]);
  }
  types.push('</Types>');wb.push('</sheets></workbook>');rel.push('</Relationships>');
  entries.push(['[Content_Types].xml',te.encode(types.join(''))],['xl/workbook.xml',te.encode(wb.join(''))],['xl/_rels/workbook.xml.rels',te.encode(rel.join(''))]);
  return makeZip(entries);
}
function buildBooks(source){
  const books=[[GUIDE,[['Poultry Farm Manager Excel backup'],['Version',VERSION],['تنبيه','هذه البيانات تخص حسابك الحالي فقط. احتفظ بنسخة في مكان آمن.'],['طريقة التعديل','عدّل السجلات في أوراق الجداول، مع الحفاظ على IDs والعلاقات بين المزرعة والعنبر والدورة.'],['طريقة الاستيراد','من شاشة النسخ الاحتياطي اضغط استيراد Excel واختر نفس الملف ثم وافق على الاستبدال.'],['الأمان','قبل الاستيراد يتم تنزيل نسخة JSON احتياطية من بياناتك الحالية.'],['ملاحظة','لا تغيّر اسم أوراق البيانات أو ورقة _PFM_META.'],['البيانات المحفوظة','تُستعاد كذلك الإعدادات والحسابات المالية والمخزون المحاسبي من ورقة النظام.']]]];
  const meta=[['PFM_BACKUP_VERSION',VERSION],['EXPORTED_AT',new Date().toISOString()]];
  const arrayKeys=[];
  for(const [key,value] of Object.entries(source)){
    if(Array.isArray(value)&&validKey(key)){
      arrayKeys.push(key);
      const headers=[...new Set(value.flatMap(o=>Object.keys(o||{})))];
      if(!headers.length)headers.push('id');
      headers.sort((a,b)=>(a==='id'?-1:b==='id'?1:0));
      books.push([key,[headers,...value.map(row=>headers.map(k=>packValue(row[k])))] ]);
    }else{
      const data=JSON.stringify(value);if(data===undefined)continue;
      // Chunk metadata so that no cell exceeds Excel's 32767-character limit.
      for(let i=0;i<data.length;i+=24000)meta.push([key,String(i/24000),data.slice(i,i+24000)]);
      if(!data.length)meta.push([key,'0','']);
    }
  }
  meta.splice(2,0,['ARRAY_KEYS',JSON.stringify(arrayKeys)]);
  books.splice(1,0,[META,meta]);
  if(books.length>250)throw Error('عدد أنواع البيانات كبير جدًا لإنشاء ملف Excel واحد');
  return books;
}
const elText=node=>node?node.textContent||'':'';
const localNodes=(node,name)=>Array.from(node?.getElementsByTagNameNS('*',name)||[]);
const xmlDocument=bytes=>{const doc=new DOMParser().parseFromString(td.decode(bytes),'application/xml');if(doc.querySelector('parsererror'))throw Error('ملف Excel يحتوي XML غير صالح');return doc;};
async function unzipFile(buffer){
  const b=new Uint8Array(buffer),view=new DataView(buffer);let eocd=-1;
  for(let i=b.length-22;i>=Math.max(0,b.length-65558);i--){if(view.getUint32(i,true)===0x06054b50){eocd=i;break;}}
  if(eocd<0)throw Error('ملف Excel غير صالح (ZIP)');
  const num=view.getUint16(eocd+10,true),offset=view.getUint32(eocd+16,true);let pos=offset;
  const result=new Map();
  for(let j=0;j<num;j++){
    if(view.getUint32(pos,true)!==0x02014b50)throw Error('ترويسة Excel تالفة');
    const method=view.getUint16(pos+10,true),size=view.getUint32(pos+20,true),rawSize=view.getUint32(pos+24,true),nlen=view.getUint16(pos+28,true),extra=view.getUint16(pos+30,true),comment=view.getUint16(pos+32,true),local=view.getUint32(pos+42,true);
    const name=td.decode(b.subarray(pos+46,pos+46+nlen));pos+=46+nlen+extra+comment;
    if(size>100*1024*1024||rawSize>100*1024*1024)throw Error('ورقة Excel كبيرة جدًا للاستيراد');
    if(view.getUint32(local,true)!==0x04034b50)throw Error('الملف المضغوط غير صالح');
    const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
    const data=b.slice(start,start+size);let decoded;
    if(method===0)decoded=data;
    else if(method===8){
      if(typeof DecompressionStream!=='function')throw Error('المتصفح لا يدعم قراءة Excel المضغوط؛ استخدم نسخة حديثة من Chrome');
      const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      decoded=new Uint8Array(await new Response(stream).arrayBuffer());
    }else throw Error('نوع ضغط غير مدعوم لملف Excel');
    result.set(name.replace(/^\//,''),decoded);
  }
  return result;
}
function sheetRows(xml,sharedStrings){
  const doc=xmlDocument(xml),rows=[];
  for(const row of localNodes(doc,'row')){
    const out=[];
    for(const c of Array.from(row.children).filter(n=>n.localName==='c')){
      const address=c.getAttribute('r')||'',letters=address.match(/^[A-Z]+/)?.[0]||'';
      let index=0;for(const ch of letters)index=index*26+(ch.charCodeAt(0)-64);index--;
      if(index<0||index>16000)continue;
      const kind=c.getAttribute('t')||'';
      let val;
      if(kind==='inlineStr')val=localNodes(c,'t').map(elText).join('');
      else{
        const raw=elText(localNodes(c,'v')[0]);
        if(kind==='s')val=sharedStrings[Number(raw)]||'';
        else if(kind==='b')val=raw==='1';
        else if(kind==='str'||kind==='e')val=raw;
        else val=raw===''?'':Number(raw);
      }
      out[index]=val;
    }
    rows.push(out);
  }
  return rows;
}
function parseBooks(zip){
  const wb=zip.get('xl/workbook.xml'),rels=zip.get('xl/_rels/workbook.xml.rels');
  if(!wb||!rels)throw Error('هذا ليس ملف Excel صالحًا');
  const rMap=new Map();
  for(const r of localNodes(xmlDocument(rels),'Relationship'))rMap.set(r.getAttribute('Id'),r.getAttribute('Target'));
  let strings=[];if(zip.has('xl/sharedStrings.xml'))strings=localNodes(xmlDocument(zip.get('xl/sharedStrings.xml')),'si').map(si=>localNodes(si,'t').map(elText).join(''));
  const sheets=new Map();
  for(const sh of localNodes(xmlDocument(wb),'sheet')){
    const id=sh.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships','id')||sh.getAttribute('r:id');
    let target=rMap.get(id);if(!target)continue;
    target=target.startsWith('/')?target.slice(1):target.startsWith('xl/')?target:'xl/'+target;
    // Office-generated relationship targets may contain /xl/worksheets/...
    const part=zip.get(target);if(part)sheets.set(sh.getAttribute('name'),sheetRows(part,strings));
  }
  return sheets;
}
function validateData(next){
  if(!next||typeof next!=='object'||Array.isArray(next))throw Error('بيانات Excel غير صالحة');
  for(const k of ['farms','houses','cycles','daily','weights','feed','meds','inventory','sales'])if(!Array.isArray(next[k]))throw Error('ورقة '+k+' مفقودة');
  const ids={};for(const k of ['farms','houses','cycles']){
    const list=next[k],used=new Set();for(const r of list){if(!r||typeof r!=='object'||!r.id)throw Error('معرّف ناقص في '+k);if(used.has(r.id))throw Error('معرّف مكرر في '+k);used.add(r.id);}ids[k]=used;
  }
  for(const h of next.houses)if(!ids.farms.has(h.farmId))throw Error('عنبر مرتبط بمزرعة غير موجودة');
  const houseFarm=new Map(next.houses.map(h=>[h.id,h.farmId]));
  for(const c of next.cycles)if(!ids.farms.has(c.farmId)||!ids.houses.has(c.houseId)||houseFarm.get(c.houseId)!==c.farmId)throw Error('دورة مرتبطة بمزرعة أو عنبر غير صحيح');
  for(const k of ['daily','weights','feed','meds','sales'])for(const r of next[k])if(r?.cycleId&&!ids.cycles.has(r.cycleId))throw Error('سجل مرتبط بدورة غير موجودة في '+k);
  for(const r of next.inventory)if(r?.farmId&&!ids.farms.has(r.farmId))throw Error('مخزون مرتبط بمزرعة غير موجودة');
  if(next.finance&&typeof next.finance!=='object')throw Error('المالية غير صالحة');
}
function parseDb(books){
  const meta=books.get(META);if(!meta||meta[0]?.[1]!==VERSION)throw Error('لا يمكن استيراد هذا الملف: صدّر ملف Excel أولًا من نفس البرنامج واستخدمه كقالب');
  const arrayRow=meta.find(x=>x[0]==='ARRAY_KEYS');const keys=JSON.parse(arrayRow?.[1]||'[]');
  if(!Array.isArray(keys))throw Error('فهرس أوراق Excel غير صالح');
  const parts=new Map();
  for(const r of meta.slice(2))if(r[0]&&!['ARRAY_KEYS','EXPORTED_AT'].includes(r[0])){
    if(!parts.has(r[0]))parts.set(r[0],[]);parts.get(r[0]).push([Number(r[1]),String(r[2]||'')]);
  }
  const obj={};for(const [key,frags] of parts){
    frags.sort((a,b)=>a[0]-b[0]);obj[key]=JSON.parse(frags.map(x=>x[1]).join(''));
  }
  for(const key of keys){
    const sheet=books.get(key);if(!sheet)throw Error('ورقة البيانات '+key+' غير موجودة');
    const head=sheet[0]||[];const items=[];
    for(const row of sheet.slice(1)){
      if(!row.some(v=>v!==undefined&&v!==''))continue;
      const out={};for(let i=0;i<head.length;i++)if(head[i]&&row[i]!==undefined&&row[i]!=='')out[head[i]]=unpackValue(row[i]);
      if(Object.keys(out).length)items.push(out);
    }
    obj[key]=items;
  }
  validateData(obj);return obj;
}
function getDb(){if(typeof db==='undefined')throw Error('افتح البرنامج وسجّل الدخول أولاً');return db;}
function trigger(blob,filename){if(window.PFMAndroidExport?.isAndroid){window.PFMAndroidExport.saveBlob(blob,filename).catch(e=>alert('تعذر حفظ الملف: '+e.message));return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2500);}
function jsonBackup(d,filename){trigger(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}),filename);}
window.PFMExportExcel=()=>{
  try{
    if(typeof currentUser==='undefined'||!currentUser){alert('سجّل الدخول أولاً');return;}
    const d=getDb();const books=buildBooks(d);const file=workbookFile(books);
    const now=new Date().toISOString().slice(0,10);
    trigger(file,`poultry-farm-data-${now}.xlsx`);
    const status=document.getElementById('pfmExcelStatus');if(status)status.textContent=`تم إنشاء Excel من ${d.farms?.length||0} مزرعة و${d.houses?.length||0} عنبر و${d.cycles?.length||0} سجل دورة، مع بقية بيانات البرنامج.`;
  }catch(e){console.error('Excel export:',e);alert('تعذر تصدير Excel: '+e.message);}
};
window.PFMImportExcel=async input=>{
  const file=input.files?.[0];if(!file)return;
  try{
    if(typeof currentUser==='undefined'||!currentUser)throw Error('سجّل الدخول أولاً');
    const z=await unzipFile(await file.arrayBuffer());const imported=parseDb(parseBooks(z));
    const count=`${imported.farms.length} مزرعة، ${imported.houses.length} عنبر، ${imported.cycles.length} سجل دورة، ${imported.daily.length} سجل متابعة يومية`;
    if(!confirm(`تم فحص ملف Excel: ${count}.\n\nسيتم استبدال بيانات هذا الحساب فقط ببيانات ملف Excel.\nسيتم تنزيل نسخة JSON احتياطية من البيانات الحالية قبل الاستبدال.\n\nهل توافق على الاستيراد؟`))return;
    const prev=getDb(),backupName='before-excel-import-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
    jsonBackup(prev,backupName);
    // Persist only after parsing and relational validation are complete.
    db=Object.assign(emptyDb(),imported);
    normalizeDbIds();financeDraftExpenses={};persistLocal();renderAll();
    const status=document.getElementById('pfmExcelStatus');if(status)status.textContent='تم استيراد Excel بنجاح: '+count;
    alert('تم استيراد البيانات بنجاح. تم أيضًا تنزيل نسخة JSON من البيانات القديمة قبل الاستبدال.');
  }catch(e){console.error('Excel import:',e);alert('لم يتم استيراد البيانات أو استبدالها: '+e.message);}
  finally{input.value='';}
};
window.PFMExcelDiagnostics={buildBooks,workbookFile,unzipFile,parseBooks,parseDb};
})();
