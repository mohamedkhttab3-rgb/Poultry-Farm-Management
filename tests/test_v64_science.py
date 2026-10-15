import asyncio, json, pathlib, threading, http.server, mimetypes, urllib.parse
from playwright.async_api import async_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]/'www'
async def main():
 results=[];errors=[]
 def test(name,ok,details=''):results.append(dict(name=name,pass_=bool(ok),details=str(details)[:240]))
 with __import__('contextlib').suppress(Exception):pass
 class Handler(http.server.SimpleHTTPRequestHandler):
  def __init__(self,*a,**kw):super().__init__(*a,directory=str(ROOT),**kw)
  def log_message(self,*a):pass
 server=http.server.ThreadingHTTPServer(('127.0.0.1',8774),Handler)
 threading.Thread(target=server.serve_forever,daemon=True).start()
 async with async_playwright() as p:
  browser=await p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1500,'height':900})
  page.on('pageerror',lambda e:errors.append(str(e)))
  page.on('dialog',lambda d:asyncio.create_task(d.accept()))
  async def route_handler(route):
   u=urllib.parse.urlsplit(route.request.url)
   file=ROOT.joinpath(urllib.parse.unquote(u.path).lstrip('/'))
   if file.is_file() and file.resolve().is_relative_to(ROOT):await route.fulfill(status=200,content_type=mimetypes.guess_type(str(file))[0] or 'application/octet-stream',body=file.read_bytes())
   else:await route.fulfill(status=404,body='Not found')
  await page.route('https://pfm.example/**',route_handler)
  await page.evaluate("""()=>{const memory={};Object.defineProperty(window,'localStorage',{configurable:true,value:{setItem(k,v){memory[k]=String(v)},getItem(k){return Object.hasOwn(memory,k)?memory[k]:null},removeItem(k){delete memory[k]},key(i){return Object.keys(memory)[i]??null},get length(){return Object.keys(memory).length}}})}""")
  await page.set_content(ROOT.joinpath('index.html').read_text(encoding='utf-8').replace('<head>','<head><base href="https://pfm.example/">',1),wait_until='domcontentloaded')
  await page.wait_for_timeout(500)
  await page.evaluate("authMode('register')")
  for id,v in [('regName','Science QA'),('regEmail','science-qa@local.test'),('regPass','testpass123'),('regPass2','testpass123')]:await page.locator('#'+id).fill(v)
  await page.locator('#registerSubmit').click()
  await page.wait_for_timeout(400)
  test('owner signed in',await page.evaluate('!!currentUser'))
  await page.evaluate('''()=>{
    db.farms=[{id:'f1',name:'Farm'}];db.houses=[{id:'h1',farmId:'f1',name:'House'}];
    db.cycles=[{id:'c1',farmId:'f1',houseId:'h1',cycleNumber:1,date:'2026-09-01',birds:1000,initWeight:.04,breed:'Ross 308',standardBreed:'Ross 308',standardSnapshot:makeStandardSnapshot('Ross 308'),active:true}];
    db.daily=[{id:'d1',cycleId:'c1',date:'2026-09-28',dead:10,cull:5,feed:2000,water:4000,weight:2}];
    db.weights=[{id:'w1',cycleId:'c1',date:'2026-09-28',avg:2,sd:.1,cv:5}];
    db.sales=[{id:'s1',cycleId:'c1',date:'2026-09-28',birds:100,weightUnit:'kg',weightQty:200,weightKg:200,total:1000,price:5}];
    save();
  }''')
  vals=await page.evaluate('''()=>{const c=db.cycles[0],x=calc(c);return {x,live:liveAtDate(c,'2026-09-28'),at35:standardAtAgeCatalog(c.standardSnapshot,35),at4:standardAtAgeCatalog(c.standardSnapshot,4),at70:standardAtAgeCatalog(c.standardSnapshot,70),at30:standardAtAgeCatalog(c.standardSnapshot,30)};}''')
  test('live = 1000 - 10 - 5 - 100',vals['live']==885,vals['live'])
  # 885*2+200=1970 kg / 2000 feed
  test('official FCR bodyweight basis',abs(vals['x']['fcr']-2000/1970)<1e-9,vals['x']['fcr'])
  test('separate gain FCR',abs(vals['x']['gainFcr']-2000/(1970-40))<1e-9,vals['x']['gainFcr'])
  test('benchmark 35 days Ross 308',vals['at35']['weight']==2296 and abs(vals['at35']['fcr']-1.399)<1e-9)
  test('no extrapolation before and after source range',vals['at4'] is None and vals['at70'] is None)
  test('interpolation within range',vals['at30']['interpolated'] and 1616<vals['at30']['weight']<2296)
  test('actual FCR badge uses historical breed',await page.evaluate("metricAssessment('fcr',1.41,db.cycles[0])?.source==='كتالوج السلالة المحفوظ'"))
  test('no invented PI/EPEF thresholds',await page.evaluate("metricAssessment('pi',140,db.cycles[0])===null&&metricAssessment('epef',400,db.cycles[0])===null"))
  test('CV missing is unknown',await page.evaluate("cvAssessment(0).label.includes('غير متاح')"))
  # Validate a closed cycle frozen to actual date of closure (not continually increasing).
  closed=await page.evaluate('''()=>{const c=db.cycles[0];c.active=false;c.endedAt='2026-09-28';const a=age(c),x=calc(c);return {a,metricDate:x.metricDate,fcr:x.fcr,report:standardCatalogForCycle(c).rows.length};}''')
  test('closed cycle age frozen',closed['a']==27 and closed['metricDate']=='2026-09-28',closed)
  snap=await page.evaluate('JSON.stringify(db.cycles[0].standardSnapshot)')
  await page.evaluate('''()=>{db.settings.globalStandardBreed='Cobb 500';normalizeCycleStandardSnapshots();}''')
  test('cycle historical standard immutable',snap==await page.evaluate('JSON.stringify(db.cycles[0].standardSnapshot)'))
  # Editing terminated cycle with breed unchanged retains the exact snapshot and date.
  await page.evaluate("show('cycles')")
  await page.evaluate('beginEdit("cycle", "c1")')
  await page.evaluate('addCycle()')
  test('closed cycle not reopened during edit',await page.evaluate("db.cycles[0].active===false && db.cycles[0].endedAt==='2026-09-28'"))
  test('edit preserves catalog snapshot',snap==await page.evaluate('JSON.stringify(db.cycles[0].standardSnapshot)'))
  await page.evaluate("show('reports')")
  await page.evaluate("reportCycle.value='c1';renderReport()")
  text=await page.locator('#printReport').inner_text()
  test('report shows both FCR formulas', 'الزيادة الوزنية' in text and 'الوزن الحي' in text)
  test('no page exceptions',not errors,errors)
  await browser.close()
 server.shutdown()
 output={'checks':results,'passed':sum(x['pass_'] for x in results),'total':len(results),'errors':errors}
 (pathlib.Path(__file__).resolve().parent/'V6_4_SCIENCE_QA_RESULTS.json').write_text(json.dumps(output,ensure_ascii=False,indent=2))
 print('PASS',output['passed'],'TOTAL',output['total']);print('FAIL',[x for x in results if not x['pass_']]);print('exceptions',errors)
if __name__=='__main__':asyncio.run(main())
