/* Android V7.3.10 - isolated PDF layout (never touches application data).
 * Each PDF page is a separate, measured DOM snapshot. Dashboard cards/charts
 * and complete table rows are never broken between sheets. */
(function(){
  'use strict';
  const root=document.getElementById('pfm59PrintRoot');
  if(!root)throw Error('PDF report root missing');
  const deepClone=node=>node.cloneNode(true);
  const isNode=(node,selector)=>node.nodeType===1&&node.matches(selector);
  const meaningful=node=>!!(node.textContent||'').trim()||
    !!node.querySelector?.('svg,img,canvas,table');
  const pages=[];
  let capacity=675;
  let shown=-1;

  function extent(){
    const base=root.getBoundingClientRect();
    let bottom=Math.max(base.height,root.scrollHeight);
    for(const child of root.children)
      bottom=Math.max(bottom,child.getBoundingClientRect().bottom-base.top);
    return Math.ceil(bottom);
  }
  function over(){return extent()>capacity;}
  function store(){
    if(!root.children.length)return;
    if(!meaningful(root))throw Error('Empty PDF page');
    if(over())throw Error('PDF section extends beyond its page');
    if(pages.length>=160)throw Error('PDF is longer than 160 pages');
    pages.push(root.innerHTML);
    root.replaceChildren();
  }
  function tryAppend(node){
    root.appendChild(node);
    if(!over())return true;
    root.removeChild(node);
    return false;
  }
  function fitOnBlank(node){
    if(tryAppend(node))return;
    node.style.setProperty('max-width','100%','important');
    node.style.setProperty('height','auto','important');
    node.style.setProperty('max-height','none','important');
    root.appendChild(node);
    let natural=extent();
    root.removeChild(node);
    let ratio=Math.min(1,(capacity-15)/Math.max(natural,1));
    for(let attempt=0;attempt<3;attempt++){
      if(ratio<0.58)break;
      node.style.setProperty('zoom',String(ratio),'important');
      if(tryAppend(node))return;
      ratio-=0.08;
    }
    throw Error('A report block is too tall for A4; it must be split instead of clipped');
  }
  function add(node){
    if(tryAppend(node))return;
    if(root.children.length)store();
    fitOnBlank(node);
  }
  function wrapped(parent,unit){
    const shell=parent.cloneNode(false);
    shell.removeAttribute('id');
    shell.classList.add('pfm739-page-wrapper');
    shell.appendChild(deepClone(unit));
    // Keep the source panel and its content together whenever possible.
    if(tryAppend(shell))return;
    if(root.children.length)store();
    if(tryAppend(shell))return;
    // Split a tall multi-panel group into its own measured sections.
    if(unit.children.length>1&&!isNode(unit,'table,tbody,tr,svg,figure')){
      for(const child of [...unit.children])wrapped(unit,child);
      return;
    }
    fitOnBlank(shell);
  }
  function dashboard(panel){
    const groups='.pfm53-kpi-row,.pfm53-second-row,.pfm53-chart-row,.pfm53-bottom-row';
    function blocks(parent,node){
      if(isNode(node,groups)){
        const entries=[...node.children].filter(meaningful);
        const max=isNode(node,'.pfm53-chart-row,.pfm53-bottom-row')?2:3;
        if(entries.length>max){
          for(let offset=0;offset<entries.length;offset+=max){
            const part=node.cloneNode(false);
            part.style.setProperty('grid-template-columns',
              'repeat('+Math.min(max,entries.length-offset)+',minmax(0,1fr))','important');
            for(const child of entries.slice(offset,offset+max))part.appendChild(deepClone(child));
            wrapped(parent,part);
          }
          return;
        }
      }
      wrapped(parent,node);
    }
    for(const child of [...panel.children])if(meaningful(child))blocks(panel,child);
  }
  function tableSection(section){
    const source=section.querySelector('table');
    const rows=[...source?.querySelectorAll('tbody > tr')||[]];
    if(!source||!rows.length){add(deepClone(section));return;}
    const titles=[...section.children].filter(e=>e!==source&&!e.querySelector('table'));
    const header=source.querySelector('thead');
    let chunk;
    function start(){
      const wrap=section.cloneNode(false);
      wrap.removeAttribute('id');
      titles.forEach(x=>wrap.appendChild(deepClone(x)));
      const table=source.cloneNode(false);
      table.removeAttribute('id');
      if(header)table.appendChild(deepClone(header));
      const body=document.createElement('tbody');
      table.appendChild(body);wrap.appendChild(table);
      if(!tryAppend(wrap)){
        if(root.children.length)store();
        if(!tryAppend(wrap))throw Error('Table heading is taller than A4');
      }
      chunk={wrap,body};
    }
    start();
    for(const original of rows){
      const row=deepClone(original);
      chunk.body.appendChild(row);
      if(over()){
        chunk.body.removeChild(row);
        if(chunk.body.children.length){
          store();start();chunk.body.appendChild(row);
        }else chunk.body.appendChild(row);
        if(over()){
          // Only exceptionally tall records are allowed to shrink, never split.
          const h=Math.max(1,row.getBoundingClientRect().height);
          const spare=Math.max(1,capacity-(extent()-h)-16);
          const zoom=Math.min(1,spare/h);
          if(zoom<0.58)throw Error('A table record is too tall for a PDF page');
          row.style.setProperty('zoom',String(zoom),'important');
          if(over())throw Error('A table record still crosses the page edge');
        }
      }
    }
  }
  function prepare(pageHeight){
    if(!Number.isFinite(pageHeight)||pageHeight<400||pageHeight>1000)
      throw Error('Unsupported PDF page height');
    capacity=Math.min(pageHeight,675);
    pages.length=0;shown=-1;
    const snapshot=[...root.children].map(deepClone);
    root.replaceChildren();
    root.style.setProperty('width','1100px','important');
    root.style.setProperty('max-width','1100px','important');
    root.style.setProperty('min-height','0','important');
    root.style.setProperty('height','auto','important');
    root.style.setProperty('position','static','important');
    root.style.setProperty('margin','0','important');
    root.style.setProperty('padding','8px 14px 10px','important');
    for(const node of snapshot){
      if(isNode(node,'.pfm59-print-footer'))continue;
      if(isNode(node,'.pfm59-dashboard'))dashboard(node);
      else if(isNode(node,'.pfm59-table-section'))tableSection(node);
      else if(isNode(node,'.pfm59-report')&&node.children.length>1){
        for(const part of [...node.children])wrapped(node,part);
      }else add(deepClone(node));
    }
    store();
    if(!pages.length)throw Error('Nothing to include in PDF');
    const count=pages.length;
    show(0);
    return count;
  }
  function show(index){
    if(!Number.isInteger(index)||index<0||index>=pages.length)
      throw Error('Invalid PDF page index');
    root.innerHTML=pages[index];
    root.dataset.pfmPageIndex=String(index);
    shown=index;
    // Force layout now; Android must wait for the next paint frame before drawing.
    const height=extent();
    if(height>capacity+2)throw Error('Page '+(index+1)+' would be clipped');
    return {index,count:pages.length,height,text:(root.textContent||'').trim().length};
  }
  function active(){return Number(root.dataset.pfmPageIndex)===shown;}
  window.PFM739Pages={prepare,show,active};
})();