'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const html='<!doctype html><html lang="ar"><head></head><body><div id="reports">'+
 '<button class="btn" onclick="window.PFMPrintResults59()">طباعة / حفظ</button>'+
 '<button data-pfm-android-pdf="print">طباعة</button>'+
 '<button data-pfm-android-pdf="save">حفظ</button>'+
 '<button data-pfm-android-pdf="share">مشاركة</button></div></body></html>';
const dom=new JSDOM(html,{url:'https://qa.test/',runScripts:'outside-only',pretendToBeVisual:true});
const w=dom.window,doc=w.document,actions=[];
w.PFMPrintResults59=action=>actions.push(action);
w.eval(fs.readFileSync('www/pfm-v81-report-actions.js','utf8'));
doc.dispatchEvent(new w.Event('DOMContentLoaded'));
assert.equal(doc.querySelectorAll('#reports button').length,1,'only one visible PDF button should remain');
const btn=doc.getElementById('pfm81-pdf-action');
assert(btn,'one PDF button exists');
btn.click();
const menu=doc.getElementById('pfm81-pdf-menu');
assert(!menu.hidden);
menu.querySelector('[data-pfm81-pdf-choice="save"]').click();
assert.equal(actions.at(-1),'save','saves through existing validated renderer');
btn.click();menu.querySelector('[data-pfm81-pdf-choice="share"]').click();
assert.equal(actions.at(-1),'share','shares through existing native Android bridge');
btn.click();menu.querySelector('[data-pfm81-pdf-choice="print"]').click();
assert.equal(actions.at(-1),'print','prints through existing renderer');
assert.equal(actions.length,3);
w.close();
console.log('PASS: legacy four PDF controls become one accessible button; Print, Save and Share invoke proper report action');
