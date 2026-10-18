/* Android V7.3.11: lossless A4 PDF paginator (offscreen export only).
 * Invariants: every source section appears once, entire chart/cards stay on a
 * single page, long tables paginate by whole rows, and no page is clipped.
 * Native save/share/print and Excel are intentionally outside this module. */
(function(){
  'use strict';
  const root=document.getElementById('pfm59PrintRoot');
  if(!root)throw Error('Printable report root not found');
  const pages=[];
  let capacity=675;
  let shown=-1;
  const copy=el=>el.cloneNode(true);
  const matches=(el,sel)=>el.nodeType===1&&el.matches(sel);
  const content=el=>Boolean((el.textContent||'').trim()||
    el.querySelector?.('img,svg,canvas,table,figure'));
  const unbreakable='img,svg,canvas,figure,tr,td,th,.pfm53-panel,.pfm53-kpi,.pfm53-mini,.report-chart-wrap,.card';
  const gridGroups='.pfm53-kpi-row,.pfm53-second-row,.pfm53-chart-row,.pfm53-bottom-row';

  function measure(){
    const rect=root.getBoundingClientRect();
    let bottom=Math.max(rect.height,root.scrollHeight);
    for(const child of root.children){
      const childRect=child.getBoundingClientRect();
      bottom=Math.max(bottom,childRect.bottom-rect.top);
    }
    return Math.ceil(bottom);
  }
  const overflow=()=>measure()>capacity;
  function clear(){root.replaceChildren();}
  function flush(){
    if(!root.children.length)return;
    if(!content(root))throw Error('Cannot make an empty PDF page');
    if(overflow())throw Error('PDF page content exceeds A4 printable height');
    if(pages.length>=160)throw Error('This report exceeds 160 PDF pages');
    pages.push(root.innerHTML);
    clear();
  }
  function chain(el,parents){
    let item=copy(el);
    for(let i=parents.length-1;i>=0;i--){
      const p=parents[i].cloneNode(false);
      p.removeAttribute('id');
      p.classList.add('pfm739-page-wrapper');
      p.appendChild(item);
      item=p;
    }
    return item;
  }
  function tryPlace(item){
    root.appendChild(item);
    if(!overflow())return true;
    root.removeChild(item);
    return false;
  }
  function placeAtomic(item){
    if(tryPlace(item))return;
    if(root.children.length)flush();
    if(tryPlace(item))return;
    // Only scale a truly indivisible diagram/card/record, never an entire report.
    const natural=(()=>{root.appendChild(item);const h=measure();root.removeChild(item);return h;})();
    let ratio=Math.min(1,(capacity-15)/Math.max(natural,1));
    for(let attempt=0;attempt<4&&ratio>=0.45;attempt++,ratio-=0.08){
      item.style.setProperty('zoom',String(ratio),'important');
      if(tryPlace(item))return;
    }
    throw Error('A single PDF element is too tall for A4 without cropping');
  }
  function addTable(table,parents){
    const sourceRows=[...table.querySelectorAll('tbody > tr')];
    if(!sourceRows.length){
      // A table containing no data rows may have explanatory content.
      placeAtomic(chain(table,parents));return;
    }
    const head=[...table.children].filter(x=>x.tagName==='THEAD'||
      x.tagName==='COLGROUP'||x.tagName==='CAPTION');
    const foot=[...table.children].filter(x=>x.tagName==='TFOOT');
    let wrapper,body;
    function startChunk(){
      const part=table.cloneNode(false);
      part.removeAttribute('id');
      head.forEach(node=>part.appendChild(copy(node)));
      body=document.createElement('tbody');
      part.appendChild(body);
      wrapper=chain(part,parents);
      if(!tryPlace(wrapper)){
        if(root.children.length)flush();
        if(!tryPlace(wrapper))throw Error('Table headings alone do not fit A4');
      }
    }
    startChunk();
    for(const source of sourceRows){
      const row=copy(source);
      body.appendChild(row);
      if(!overflow())continue;
      body.removeChild(row);
      if(body.children.length){
        flush();
        startChunk();
        body.appendChild(row);
      }else{
        body.appendChild(row);
      }
      if(overflow()){
        // Keep a long individual record together, never split it across sheets.
        const originalHeight=Math.max(1,row.getBoundingClientRect().height);
        const remaining=capacity-(measure()-originalHeight)-15;
        const ratio=remaining/originalHeight;
        if(ratio<0.45)throw Error('Table row is too tall for A4');
        row.style.setProperty('zoom',String(Math.min(1,ratio)),'important');
        if(overflow())throw Error('Table row extends beyond its PDF page');
      }
    }
    if(foot.length){
      foot.forEach(el=>body.parentElement.appendChild(copy(el)));
      if(overflow()){
        foot.forEach(()=>body.parentElement.lastElementChild.remove());
        flush();startChunk();
        foot.forEach(el=>body.parentElement.appendChild(copy(el)));
        if(overflow())throw Error('Table summary is too tall for A4');
      }
    }
  }
  function addPart(node,parents=[],depth=0){
    if(depth>24)throw Error('Too many nested printable sections');
    if(!content(node))return;
    // A4 dashboards need readable cards, not five narrow truncated columns.
    if(matches(node,gridGroups)){
      const children=[...node.children].filter(content);
      const limit=matches(node,'.pfm53-chart-row,.pfm53-bottom-row')?2:3;
      if(children.length>limit){
        for(let start=0;start<children.length;start+=limit){
          const group=node.cloneNode(false);
          group.removeAttribute('id');
          group.style.setProperty('grid-template-columns',
            'repeat('+Math.min(limit,children.length-start)+',minmax(0,1fr))','important');
          children.slice(start,start+limit).forEach(el=>group.appendChild(copy(el)));
          addPart(group,parents,depth+1);
        }
        return;
      }
    }
    const item=chain(node,parents);
    if(tryPlace(item))return;
    if(root.children.length)flush();
    if(tryPlace(item))return;
    if(matches(node,'table')){addTable(node,parents);return;}
    const children=[...node.children].filter(content);
    if(children.length&&!matches(node,unbreakable)){
      // Unlike the former paginator, descend through SINGLE-child report
      // containers too. A .pfm59-report containing one .report is often 10+
      // pages long and cannot legally be squeezed onto a single A4 sheet.
      for(const child of children)addPart(child,[...parents,node],depth+1);
      return;
    }
    placeAtomic(item);
  }
  function prepare(pageHeight){
    if(!Number.isFinite(pageHeight)||pageHeight<400||pageHeight>1000)
      throw Error('Invalid PDF page capacity');
    capacity=Math.min(pageHeight,675);
    pages.length=0;shown=-1;
    const originals=[...root.children].filter(node=>
      !matches(node,'.pfm59-print-footer')).map(copy);
    clear();
    root.style.setProperty('width','1100px','important');
    root.style.setProperty('min-width','1100px','important');
    root.style.setProperty('max-width','1100px','important');
    root.style.setProperty('height','auto','important');
    root.style.setProperty('min-height','0','important');
    root.style.setProperty('position','static','important');
    root.style.setProperty('overflow','visible','important');
    root.style.setProperty('margin','0','important');
    root.style.setProperty('padding','8px 14px 10px','important');
    for(const node of originals)addPart(node);
    flush();
    if(!pages.length)throw Error('No content available for PDF export');
    const count=pages.length;
    show(0);
    return count;
  }
  function show(index){
    if(!Number.isInteger(index)||index<0||index>=pages.length)
      throw Error('Invalid requested PDF page');
    root.innerHTML=pages[index];
    root.dataset.pfmPageIndex=String(index);
    shown=index;
    window.scrollTo(0,0);
    const height=measure();
    if(height>capacity+2)throw Error('PDF page '+(index+1)+' would be clipped');
    return {index,count:pages.length,height,text:(root.textContent||'').trim().length};
  }
  function active(){return shown>=0&&Number(root.dataset.pfmPageIndex)===shown;}
  window.PFM739Pages={prepare,show,active};
})();