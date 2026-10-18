/* PFM Android 7.3.7 — finite-page report composer.
 * Build each A4 landscape page as a real DOM document at y=0.
 * No WebView scroll screenshots, giant view captures, or canvas offset slicing.
 * This is loaded only in the isolated Android export WebView. */
(function(){
  'use strict';
  const root=document.getElementById('pfm59PrintRoot');
  if(!root)throw Error('Printable report root missing');
  let pages=[];
  let capacity=695;

  const make=source=>source.cloneNode(true);
  const deepClone=source=>source.cloneNode(true);
  const shortClass=(el,value)=>el.classList && el.classList.contains(value);
  function hasContent(el){
    return !!el && (el.textContent||'').trim().length>2 ||
      !!el?.querySelector('svg,canvas,img,table,.pfm53-kpi,.pfm53-mini');
  }
  function overflow(){return root.getBoundingClientRect().height>capacity+2;}
  function clear(){root.replaceChildren();}
  function flush(){
    if(!root.children.length)return;
    if(!hasContent(root))throw Error('Refusing to create a blank report page');
    if(pages.length>=160)throw Error('Report exceeds 160 pages');
    pages.push(root.innerHTML);
    clear();
  }
  function fit(el){
    root.appendChild(el);
    if(!overflow())return true;
    root.removeChild(el);
    return false;
  }
  function minimum(el){
    // A single chart or record cannot be cut: reduce it to fit one page.
    // CSS zoom changes layout dimensions, unlike transform scaling.
    const available=Math.max(30,capacity-root.getBoundingClientRect().height-12);
    el.style.maxWidth='100%';
    el.style.overflow='visible';
    root.appendChild(el);
    const raw=el.getBoundingClientRect().height;
    if(raw>available){
      el.style.zoom=String(Math.max(0.45,Math.min(1,available/(raw+4))));
    }
    if(overflow())throw Error('A report section is too tall to print without cutting');
  }
  function appendAtomic(original){
    const node=deepClone(original);
    if(fit(node))return;
    if(root.children.length)flush();
    if(!fit(node))minimum(node);
  }
  function appendWrapped(parent,unit){
    const wrapper=parent.cloneNode(false);
    wrapper.removeAttribute('id');
    wrapper.classList.add('pfm-export-page-wrapper');
    wrapper.appendChild(deepClone(unit));
    if(fit(wrapper))return;
    if(root.children.length)flush();
    if(!fit(wrapper)){
      // If the row is taller than a page, compose its child panels on
      // separate pages, preserving the enclosing grid CSS.
      if(unit.children.length>1 && !unit.matches('table,svg,figure')){
        for(const part of Array.from(unit.children))appendWrapped(unit,part);
      }else minimum(wrapper);
    }
  }
  function appendTable(section){
    const title=Array.from(section.children).filter(x=>x.tagName!=='TABLE' && !x.querySelector('table'));
    const source=section.querySelector('table');
    if(!source){appendAtomic(section);return;}
    const rows=Array.from(source.querySelectorAll('tbody > tr'));
    if(!rows.length){appendAtomic(section);return;}
    const header=source.querySelector('thead');
    let chunk=null;
    function openChunk(){
      const wrapper=section.cloneNode(false);
      wrapper.removeAttribute('id');
      const heading=title.map(n=>deepClone(n));
      for(const item of heading)wrapper.appendChild(item);
      const table=source.cloneNode(false);
      table.removeAttribute('id');
      if(header)table.appendChild(deepClone(header));
      const body=document.createElement('tbody');
      table.appendChild(body);
      wrapper.appendChild(table);
      if(!fit(wrapper)){
        if(root.children.length)flush();
        if(!fit(wrapper))throw Error('Table header exceeds one PDF page');
      }
      chunk={wrapper,body,headingCount:heading.length};
    }
    openChunk();
    for(const record of rows){
      const row=deepClone(record);
      chunk.body.appendChild(row);
      if(overflow()){
        chunk.body.removeChild(row);
        if(!chunk.body.children.length){
          // Exceptionally tall rows must be scaled rather than split.
          chunk.body.appendChild(row);
          const current=chunk.wrapper.getBoundingClientRect().height;
          const reserved=root.getBoundingClientRect().height-current;
          row.style.zoom=String(Math.max(0.4,(capacity-reserved-15)/Math.max(current,1)));
          if(overflow())throw Error('Table record cannot fit an A4 page');
        }else{
          flush();
          openChunk();
          chunk.body.appendChild(row);
          if(overflow())throw Error('Table record cannot fit an A4 page');
        }
      }
    }
  }
  function appendDashboard(panel){
    // Sections on the dashboard are separate, atomic display groups.
    // Never split a chart, metric panel, image, or card across pages.
    for(const child of Array.from(panel.children)){
      if(!child.getBoundingClientRect().height && !child.textContent.trim())continue;
      appendWrapped(panel,child);
    }
  }
  function prepare(pageHeight){
    if(!Number.isFinite(pageHeight)||pageHeight<400||pageHeight>1000)
      throw Error('Unsupported PDF page dimensions');
    capacity=pageHeight;
    pages=[];
    const snapshot=Array.from(root.children).map(deepClone);
    // Footer is drawn natively at the same coordinates on EVERY PDF page.
    clear();
    root.style.width='1100px';
    root.style.maxWidth='1100px';
    root.style.minHeight='0';
    root.style.height='auto';
    root.style.position='static';
    root.style.margin='0';
    root.style.padding='10px 18px 15px';
    for(const node of snapshot){
      if(shortClass(node,'pfm59-print-footer'))continue;
      if(shortClass(node,'pfm59-dashboard'))appendDashboard(node);
      else if(shortClass(node,'pfm59-table-section'))appendTable(node);
      else appendAtomic(node);
    }
    flush();
    if(!pages.length)throw Error('The report has no printable results');
    root.innerHTML=pages[0];
    return pages.length;
  }
  function show(index){
    if(!Number.isInteger(index)||index<0||index>=pages.length)
      throw Error('Invalid PDF page index');
    root.innerHTML=pages[index];
    window.scrollTo(0,0);
    return {
      index:index,
      count:pages.length,
      height:Math.ceil(root.getBoundingClientRect().height),
      text:(root.textContent||'').trim().length
    };
  }
  window.PFMPages={prepare,show};
})();