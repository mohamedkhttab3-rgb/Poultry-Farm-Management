




window.PFM_SUPABASE_CONFIG = window.PFM_SUPABASE_CONFIG || { url: "", publishableKey: "", redirectTo: "" };

const PFM_LOCAL_ONLY = !(PFM_SUPABASE_CONFIG.url && PFM_SUPABASE_CONFIG.publishableKey);
let supabaseClient=null;
if(!PFM_LOCAL_ONLY && window.supabase?.createClient){
  supabaseClient=window.supabase.createClient(PFM_SUPABASE_CONFIG.url, PFM_SUPABASE_CONFIG.publishableKey, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
}
const APP_VERSION='4.1.0';
const LEGACY_KEY='poultry_farm_management_v2';
const KEY_BASE='poultry_farm_management_v34_';
const SYNC_KEY_BASE='poultry_farm_manager_sync_v34_';
const emptyDb=()=>({farms:[],houses:[],cycles:[],daily:[],weights:[],feed:[],meds:[],inventory:[],finance:{},sales:[],tombstones:[],auditLog:[],invitations:[],performanceRules:[],settings:{currency:'SAR',language:'ar',globalStandardBreed:'Ross 308'}});
let db=emptyDb();

const USERS_KEY='poultry_farm_manager_users_v32';
const SESSION_KEY='poultry_farm_manager_session_v32';
let users=JSON.parse(localStorage.getItem(USERS_KEY)||'[]');
let currentUser=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
// Explicit DOM references: do not depend on the browser's implicit window[id] behavior.
const DOM_IDS=['farmName','farmCompany','farmLicense','farmOwner','farmManager','farmLocation','farmSaveBtn','farmCancelBtn','houseFarm','houseName','houseCapacity','houseSaveBtn','houseCancelBtn','cycleFarm','cycleHouse','cycleDate','cycleBirds','cycleInitWeight','cycleBreed','cycleBreedCustom','cycleSource','cycleCurrency','cycleSaveBtn','cycleCancelBtn','dailyCycle','dailyDate','dailyDead','dailyCull','dailyFeed','dailyWater','dailyWeight','dailyTemp','dailyHumidity','dailyNotes','dailySaveBtn','dailyCancelBtn','weightCycle','weightDate','weightSample','weightTotal','weightMin','weightMax','weightSampleWeights','weightSD','weightCalcStatus','weightSaveBtn','weightCancelBtn','feedCycle','feedDate','feedType','feedQty','feedPrice','feedCurrencyLabel','medCurrencyLabel','saleCurrencyLabel','feedSaveBtn','feedCancelBtn','medCycle','medDate','medType','medName','medQty','medCost','medDose','medWithdrawal','medSaveBtn','medCancelBtn','invFarm','invItem','invUnit','invOpening','invMin','invIn','invOut','inventorySaveBtn','inventoryCancelBtn','finFarm','finCycle','financeBox','financeTable','costChicks','financeExpenseType','financeExpenseAmount','financeExpenseList','finSalePrice','finCurrency','otherRevenue','reportCycle','reportStandardBreed','reportStandardAge','reportStandardCatalog','printReport','saleCycle','saleDate','saleBirds','saleWeightUnit','saleWeight','saleWeightBox','saleAvgWeightBox','saleAvgWeight','saleAvgWeightHint','salePrice','saleBuyer','saleSaveBtn','saleCancelBtn','farmCount','houseCount','activeCycles','birdCount','deadCount','soldBirdCount','liveKgCount','dashboardFarm','dashboardHouse','dashboardSelectionBox','avgFcrCount','dashboardRevenue','dashboardProfit','dashboardCurrency2','dashboardCurrency3','dashboardCv','perfFarm','perfHouse','performanceBox','performanceTable','compareFarm','compareHouse','comparisonBox','comparisonScopeHint','feedFarmFilter','feedHouseFilter','medFarmFilter','medHouseFilter','invFilterFarm','invFilterHouse','finFilterFarm','finFilterHouse','performanceScopeHint','feedScopeHint','medScopeHint','inventoryScopeHint','financeScopeHint','feedConsumedCount','feedActualCount','alerts','farmTable','houseTable','cycleTable','dailyTable','weightTable','feedTable','medTable','inventoryTable','saleTable','memberFarm','memberEmail','memberRole','membersBox','globalCurrency','currencyLockNote','dashboardCurrency','cvStatus','auditTable','performanceRuleBreed','performanceRuleAge','performanceRuleWeight','performanceRuleFcr','performanceRuleAdg','performanceRuleCv','performanceRuleEpef','performanceRulePi','performanceRuleMortality','performanceRuleTable','inviteEmail','inviteFarm','inviteRole','inviteResult','languageSelect','settingsLanguage'];
for(const __id of DOM_IDS){ try{Object.defineProperty(window,__id,{configurable:true,get(){return document.getElementById(__id)},set(v){/* DOM elements are addressed through their id */}})}catch(__e){} }
let syncTimer=null, syncBusy=false;
let financeDraftExpenses={};
function localKey(uid=currentUser?.id){return uid?KEY_BASE+uid:null}
function syncKey(uid=currentUser?.id){return uid?SYNC_KEY_BASE+uid:null}
function uuid(){return (crypto?.randomUUID?crypto.randomUUID():id())}
function isUuid(v){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v||''))}
const PROJECT_EXPENSE_TYPES=['إيجار المشروع','تكلفة الديزل','كهرباء','ماء','عمال','نشارة','نقل','تحميل دجاج','مصاريف أخرى'];
function normalizeFinanceExpenses(f){
  const raw=Array.isArray(f?.expenses)?f.expenses:[];
  const out=raw.map((x,i)=>({id:x?.id||`exp-${i}-${Date.now().toString(36)}`,category:PROJECT_EXPENSE_TYPES.includes(String(x?.category||''))?String(x.category):'مصاريف أخرى',amount:Math.max(0,Number(x?.amount)||0),updatedAt:x?.updatedAt||new Date().toISOString()})).filter(x=>x.amount>0);
  if(out.length)return out;
  const legacy=[
    ['عمال',f?.labor],
    ['كهرباء',f?.utilities],
    ['نقل',f?.transport],
    ['مصاريف أخرى',f?.other]
  ];
  return legacy.filter(([,v])=>(+v||0)>0).map(([category,amount],i)=>({id:`legacy-${i}-${Date.now().toString(36)}`,category,amount:+amount||0,updatedAt:new Date().toISOString()}));
}
function financeExpenseTotal(fOrExpenses){
  const arr=Array.isArray(fOrExpenses)?fOrExpenses:normalizeFinanceExpenses(fOrExpenses||{});
  return arr.reduce((sum,x)=>sum+Math.max(0,Number(x?.amount)||0),0);
}
function financeLegacyTotals(expenses){
  const e=Array.isArray(expenses)?expenses:[];
  const by=cat=>e.filter(x=>x.category===cat).reduce((s,x)=>s+(+x.amount||0),0);
  const labor=by('عمال');
  const utilities=by('كهرباء')+by('ماء');
  const transport=by('نقل');
  const other=by('إيجار المشروع')+by('تكلفة الديزل')+by('نشارة')+by('تحميل دجاج')+by('مصاريف أخرى');
  return {labor,utilities,transport,other};
}
function financeExpensesForCycle(cycleId){
  if(!cycleId)return [];
  if(!Object.prototype.hasOwnProperty.call(financeDraftExpenses,cycleId)){
    financeDraftExpenses[cycleId]=normalizeFinanceExpenses(db.finance[cycleId]||{});
  }
  return financeDraftExpenses[cycleId];
}
function renderFinanceExpenseList(cycleId){
  if(!financeExpenseList)return;
  const items=financeExpensesForCycle(cycleId);
  if(!items.length){financeExpenseList.innerHTML='<div class="muted">لا توجد بنود مصروف مسجلة لهذه الدورة.</div>';return;}
  const cur=getCycleCurrency(cyc(cycleId));
  financeExpenseList.innerHTML=`<table><thead><tr><th>البند</th><th>القيمة</th><th>العملة</th><th>الإجراء</th></tr></thead><tbody>${items.map((x,i)=>`<tr><td>${esc(x.category)}</td><td>${(+x.amount||0).toFixed(2)}</td><td>${esc(cur)}</td><td><button type="button" class="btn danger" onclick="removeFinanceExpense(${i})">حذف</button></td></tr>`).join('')}</tbody><tfoot><tr><th>إجمالي مصروفات المشروع</th><th>${financeExpenseTotal(items).toFixed(2)}</th><th>${esc(cur)}</th><th></th></tr></tfoot></table>`;
}
function addFinanceExpense(){
  const cycleId=finCycle?.value;
  const c=cyc(cycleId);
  if(!c)return alert('اختر الدورة أولًا.');
  if(!requirePermission('finance',c.farmId))return;
  const category=financeExpenseType?.value||'مصاريف أخرى';
  const amount=Math.max(0,Number(financeExpenseAmount?.value)||0);
  if(!amount)return alert('أدخل قيمة المصروف.');
  financeExpensesForCycle(cycleId).push({id:uuid(),category,amount,updatedAt:new Date().toISOString()});
  if(financeExpenseAmount)financeExpenseAmount.value='';
  renderFinanceExpenseList(cycleId);
}
function removeFinanceExpense(index){
  const cycleId=finCycle?.value,c=cyc(cycleId);
  if(!c||!requirePermission('finance',c.farmId))return;
  const items=financeExpensesForCycle(cycleId);
  if(!items[index])return;
  if(!confirm('حذف بند المصروف؟'))return;
  items.splice(index,1);renderFinanceExpenseList(cycleId);
}
function normalizeDbIds(){
  const d=db; const maps={farms:new Map(),houses:new Map(),cycles:new Map()};
  d.farms.forEach(x=>{const old=x.id;if(!isUuid(old)){x.id=uuid();maps.farms.set(old,x.id)}});
  d.houses.forEach(x=>{const old=x.id;if(!isUuid(old)){x.id=uuid();maps.houses.set(old,x.id)};if(maps.farms.has(x.farmId))x.farmId=maps.farms.get(x.farmId)});
  d.cycles.forEach(x=>{x.currency=currencyCode(x.currency||'SAR');const old=x.id;if(!isUuid(old)){x.id=uuid();maps.cycles.set(old,x.id)};if(maps.farms.has(x.farmId))x.farmId=maps.farms.get(x.farmId);if(maps.houses.has(x.houseId))x.houseId=maps.houses.get(x.houseId)});
  ['daily','weights','feed','meds','sales'].forEach(k=>d[k].forEach(x=>{if(!isUuid(x.id))x.id=uuid();if(maps.cycles.has(x.cycleId))x.cycleId=maps.cycles.get(x.cycleId)}));
  d.inventory.forEach(x=>{if(!isUuid(x.id))x.id=uuid();if(maps.farms.has(x.farmId))x.farmId=maps.farms.get(x.farmId);if(!x.farmId&&d.farms[0])x.farmId=d.farms[0].id});
  const nf={};Object.entries(d.finance||{}).forEach(([k,v])=>{const nk=maps.cycles.get(k)||k;nf[nk]={...v,id:isUuid(v?.id)?v.id:uuid(),expenses:normalizeFinanceExpenses(v)}});d.finance=nf;
  if(!Array.isArray(d.tombstones))d.tombstones=[]; if(!Array.isArray(d.auditLog))d.auditLog=[]; if(!Array.isArray(d.invitations))d.invitations=[]; if(!Array.isArray(d.performanceRules))d.performanceRules=[]; if(!d.settings)d.settings={currency:'SAR',globalStandardBreed:'Ross 308'}; d.settings.globalStandardBreed=d.settings.globalStandardBreed||'Ross 308'; d.settings.currency=currencyCode(d.settings.currency||d.cycles[0]?.currency||'SAR'); d.cycles.forEach(c=>c.currency=d.settings.currency);
}
function applyRecoveredData(source,sourceTag='recovery'){
  try{
    db={...emptyDb(),...JSON.parse(JSON.stringify(source||{}))};
    if(!Array.isArray(db.farms)||!Array.isArray(db.cycles))throw new Error('invalid recovery data');
    normalizeDbIds();
    if(currentUser?.id){db.farms.forEach(f=>{f.ownerId=currentUser.id});}
    if(currentUser){localStorage.setItem(localKey(),JSON.stringify(db));}
    try{localStorage.setItem('pfm_recovery_seed_v4',sourceTag+'|'+new Date().toISOString())}catch(_){}
    return db.farms.length>0 || db.cycles.length>0;
  }catch(e){console.warn('Recovery data could not be applied:',e);return false}
}
function hasProjectData(x){return !!x && Array.isArray(x.farms) && Array.isArray(x.cycles) && (x.farms.length>0 || x.cycles.length>0)}
function projectDataScore(x){
  if(!x||!hasProjectData(x))return -1;
  return (x.farms?.length||0)*100000 + (x.cycles?.length||0)*10000 + (x.sales?.length||0)*1000 + (x.daily?.length||0)*100 + (x.weights?.length||0)*10 + (x.feed?.length||0);
}
function recoverPreviousLocalData(){
  if(!currentUser)return false;
  // 1) Prefer the current user's existing non-empty local dataset. Never overwrite it with a backup.
  const rawCurrent=localStorage.getItem(localKey());
  if(rawCurrent){try{const x=JSON.parse(rawCurrent);if(hasProjectData(x)){db={...emptyDb(),...x};normalizeDbIds();return true}}catch(e){}}

  // 2) Collect non-empty legacy datasets saved under older user/session keys.
  const candidates=[];
  for(let i=0;i<localStorage.length;i++){
    const k=localStorage.key(i);
    if(!k||!k.startsWith(KEY_BASE)||k===localKey())continue;
    try{const x=JSON.parse(localStorage.getItem(k)||'null');if(hasProjectData(x))candidates.push({k,x,score:projectDataScore(x)});}catch(e){}
  }

  // 3) Compare legacy local data with the bundled last-known-good backup and use the richer dataset.
  if(hasProjectData(window.PFM_RECOVERY_BACKUP))candidates.push({k:'bundled-backup',x:window.PFM_RECOVERY_BACKUP,score:projectDataScore(window.PFM_RECOVERY_BACKUP)});
  candidates.sort((a,b)=>b.score-a.score);
  if(candidates[0] && applyRecoveredData(candidates[0].x,candidates[0].k==='bundled-backup'?'bundled-backup':'previous-local'))return true;

  db=emptyDb();
  return false;
}
function loadLocalForUser(){
  financeDraftExpenses={};
  if(recoverPreviousLocalData())return;
  const legacy=localStorage.getItem(LEGACY_KEY);
  if(legacy&&!localStorage.getItem('poultry_farm_manager_v34_migrated')){
    try{db={...emptyDb(),...JSON.parse(legacy)};normalizeDbIds();localStorage.setItem('poultry_farm_manager_v34_migrated','1');return}catch(e){}
  }
  db=emptyDb();
}
function persistLocal(){if(currentUser)localStorage.setItem(localKey(),JSON.stringify(db));}
function normalizeEmail(v){return String(v||'').trim().toLowerCase()}
function authMode(mode){
  const isReg=mode==='register';
  document.getElementById('loginTab').className=isReg?'secondary':'primary';
  document.getElementById('registerTab').className=isReg?'primary':'secondary';
  authError('');
  document.getElementById('authForm').innerHTML=isReg?`
    <form id="registerForm" autocomplete="on" onsubmit="return false">
      <input id="regName" type="text" autocomplete="name" placeholder="الاسم الكامل" required>
      <input id="regEmail" type="email" autocomplete="email" placeholder="البريد الإلكتروني" required>
      <input id="regPass" type="password" autocomplete="new-password" placeholder="كلمة المرور (6 أحرف على الأقل)" required>
      <input id="regPass2" type="password" autocomplete="new-password" placeholder="تأكيد كلمة المرور" required>
      <button type="submit" id="registerSubmit" class="btn primary" style="width:100%;margin-top:8px" onclick="registerUser();return false;">إنشاء الحساب</button>
      <button type="button" class="btn" style="width:100%;margin-top:8px" onclick="authMode('login')">لدي حساب بالفعل</button>
    </form>`:`
    <form id="loginForm" autocomplete="on" onsubmit="return false">
      <input id="loginEmail" type="email" autocomplete="username" placeholder="البريد الإلكتروني" required>
      <input id="loginPass" type="password" autocomplete="current-password" placeholder="كلمة المرور" required>
      <button type="submit" id="loginSubmit" class="btn primary" style="width:100%;margin-top:8px" onclick="loginUser();return false;">تسجيل الدخول</button>
      <button type="button" id="forgotPasswordBtn" class="btn" style="width:100%;margin-top:8px">استعادة كلمة المرور</button>
      <button type="button" class="btn" style="width:100%;margin-top:8px" onclick="authMode('register')">إنشاء حساب جديد</button>
    </form>`;
  bindAuthButtons();
  if(window.uiLanguage&&uiLanguage()==='en')translateDOM();
}
function showRecoveryForm(){
  document.getElementById('authOverlay').style.display='flex';
  document.getElementById('loginTab').className='primary';
  document.getElementById('registerTab').className='secondary';
  document.getElementById('authForm').innerHTML=`<form id="recoveryForm" onsubmit="return false">
    <div class="note">أدخل كلمة مرور جديدة لحسابك.</div>
    <input id="newPass" type="password" autocomplete="new-password" placeholder="كلمة المرور الجديدة (6 أحرف على الأقل)" required>
    <input id="newPass2" type="password" autocomplete="new-password" placeholder="تأكيد كلمة المرور الجديدة" required>
    <button type="submit" id="saveNewPass" class="btn primary" style="width:100%;margin-top:8px">حفظ كلمة المرور</button>
  </form>`;
  authError('');
  if(window.uiLanguage&&uiLanguage()==='en')translateDOM();
  document.getElementById('recoveryForm').onsubmit=async ev=>{
    ev.preventDefault();
    const a=document.getElementById('newPass').value,b=document.getElementById('newPass2').value;
    if(a.length<6)return authError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
    if(a!==b)return authError('تأكيد كلمة المرور غير مطابق.');
    const {error}=await supabaseClient.auth.updateUser({password:a});
    if(error)return authError(error.message);
    authError('تم تغيير كلمة المرور بنجاح.');
    setTimeout(()=>bootAuth(),700);
  };
}
async function resetPassword(){
  const email=normalizeEmail(document.getElementById('loginEmail')?.value);
  if(!/^\S+@\S+\.\S+$/.test(email)) return authError('اكتب بريدك الإلكتروني أولًا ثم اضغط استعادة كلمة المرور.');
  if(supabaseClient){
    const redirect=PFM_SUPABASE_CONFIG.redirectTo || (location.origin + location.pathname);
    const {error}=await supabaseClient.auth.resetPasswordForEmail(email,{redirectTo:redirect});
    if(error)return authError(error.message);
    return authError('تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.');
  }
  const user=users.find(u=>u.email===email);
  if(!user)return authError('لا يوجد حساب محلي بهذا البريد.');
  authError('الحساب المحلي التجريبي لا يرسل بريدًا. استخدم Supabase في V3.3 لتفعيل الاستعادة الفعلية عبر البريد.');
}
function authError(msg){document.getElementById('authError').textContent=msg||''}
function importSupabaseConfigFile(input){
  const file=input?.files?.[0]; if(!file)return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const src=String(reader.result||'');
      const um=src.match(/url\s*:\s*['\"]([^'\"]+)['\"]/i);
      const km=src.match(/(?:publishableKey|anonKey)\s*:\s*['\"]([^'\"]+)['\"]/i);
      const rm=src.match(/redirectTo\s*:\s*['\"]([^'\"]*)['\"]/i);
      const url=(um?.[1]||'').trim().replace(/\/$/,''); const key=(km?.[1]||'').trim(); const redirect=(rm?.[1]||'').trim();
      if(!/^https:\/\/[A-Za-z0-9.-]+\.supabase\.co$/.test(url)||key.length<20||/YOUR_PROJECT|YOUR_SUPABASE|YOUR_APP_DOMAIN/i.test(url+' '+key)) throw new Error('الملف المحدد لا يحتوي Project URL وPublishable/Anon Key حقيقيين.');
      localStorage.setItem('pfm_supabase_config_v36',JSON.stringify({url,publishableKey:key,redirectTo:redirect}));
      authError('تم حفظ إعداد Supabase. أعد فتح البرنامج لتفعيل تسجيل الدخول السحابي.');
    }catch(e){authError(e.message||'تعذر قراءة ملف إعداد Supabase.');}
  };
  reader.readAsText(file);
}
async function registerUser(){
  try{
    const name=(document.getElementById('regName')?.value||'').trim(),email=normalizeEmail(document.getElementById('regEmail')?.value),pass=document.getElementById('regPass')?.value||'',pass2=document.getElementById('regPass2')?.value||'';
    if(name.length<2)return authError('اكتب الاسم الكامل.');
    if(!/^\S+@\S+\.\S+$/.test(email))return authError('أدخل بريدًا إلكترونيًا صحيحًا.');
    if(pass.length<6)return authError('كلمة المرور يجب أن تكون 6 أحرف على الأقل.');
    if(pass!==pass2)return authError('تأكيد كلمة المرور غير مطابق.');
    if(supabaseClient){
      setAuthBusy(true,'جارٍ إنشاء الحساب...');
      const redirect=PFM_SUPABASE_CONFIG.redirectTo || location.origin+location.pathname;
      const {data,error}=await supabaseClient.auth.signUp({email,password:pass,options:{data:{full_name:name},emailRedirectTo:redirect}});
      setAuthBusy(false); if(error)return authError(error.message||'فشل إنشاء الحساب في Supabase.');
      if(data.session){await loadCloudProfile(data.user);await unlockApp(true)}else authError('تم إنشاء الحساب. تحقق من بريدك الإلكتروني ثم سجّل الدخول.');
      return;
    }
    if(users.some(u=>u.email===email))return authError('هذا البريد مسجل بالفعل. اختر تسجيل الدخول.');
    const user={id:uuid(),name,email,password:pass,role:'owner',createdAt:new Date().toISOString()};users.push(user);localStorage.setItem(USERS_KEY,JSON.stringify(users));
    currentUser={id:user.id,name:user.name,email:user.email,role:user.role};localStorage.setItem(SESSION_KEY,JSON.stringify(currentUser));await unlockApp(false);
  }catch(e){console.error(e);setAuthBusy(false);authError('حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى.');}
}
async function loginUser(){
  try{
    const email=normalizeEmail(document.getElementById('loginEmail')?.value),pass=document.getElementById('loginPass')?.value||'';
    if(!email||!pass)return authError('أدخل البريد الإلكتروني وكلمة المرور.');
    if(supabaseClient){
      setAuthBusy(true,'جارٍ تسجيل الدخول...');
      const {data,error}=await supabaseClient.auth.signInWithPassword({email,password:pass});
      if(error){setAuthBusy(false);return authError(error.message||'فشل تسجيل الدخول إلى Supabase.');}
      if(!data?.user){setAuthBusy(false);return authError('تمت المصادقة ولكن لم يُرجع Supabase مستخدمًا.');}
      await loadCloudProfile(data.user);setAuthBusy(false);await unlockApp(true);return;
    }
    const user=users.find(u=>u.email===email&&u.password===pass);
    if(!user){
      if(!users.length) return authError('لا يوجد حساب محلي محفوظ. لإتمام تسجيل الدخول السحابي، استورد ملف Supabase الحقيقي من إعداد الاتصال.');
      return authError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    }
    if(!user)return authError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
    currentUser={id:user.id,name:user.name,email:user.email,role:user.role};localStorage.setItem(SESSION_KEY,JSON.stringify(currentUser));await unlockApp(false);
  }catch(e){console.error(e);setAuthBusy(false);authError('حدث خطأ أثناء تسجيل الدخول. افتح الصفحة مرة أخرى وحاول.');}
}
function setAuthBusy(b,msg=''){const btn=document.getElementById('loginSubmit')||document.getElementById('registerSubmit');if(btn){btn.disabled=b;btn.textContent=b?'جارٍ التنفيذ...':(btn.id==='loginSubmit'?'تسجيل الدخول':'إنشاء الحساب')}if(msg)authError(msg)}
async function unlockApp(cloud=false){
  const overlay=document.getElementById('authOverlay');if(overlay)overlay.style.display='none';
  loadLocalForUser();const restoredCount=(db.farms?.length||0)+(db.cycles?.length||0);ensureUserData();renderAll();initLanguage();
  if(localStorage.getItem('pfm_recovery_seed_v4') && restoredCount>0 && !localStorage.getItem('pfm_recovery_notice_v4')){try{localStorage.setItem('pfm_recovery_notice_v4','1')}catch(_){}setSyncStatus('تم استعادة البيانات السابقة بنجاح');}
  if(cloud&&supabaseClient){
    try{
      await syncFromCloud({pushLocal:true});
    }catch(e){
      console.warn('Cloud sync after authentication failed:',e);
      setSyncStatus('تم تسجيل الدخول — تعذرت المزامنة الآن، وتم فتح البرنامج بالبيانات المحلية');
    }
  }
}
function bindAuthButtons(){
  const f=document.getElementById('authForm'); if(!f)return;
  f.onsubmit=function(ev){
    ev.preventDefault();
    if(document.getElementById('loginForm')) return loginUser();
    if(document.getElementById('registerForm')) return registerUser();
  };
  const forgot=document.getElementById('forgotPasswordBtn');
  if(forgot) forgot.onclick=()=>resetPassword();
}
async function logoutUser(){
  persistLocal();
  if(supabaseClient){try{await supabaseClient.auth.signOut()}catch(e){console.error(e)}}
  currentUser=null;localStorage.removeItem(SESSION_KEY);db=emptyDb();financeDraftExpenses={};document.getElementById('authOverlay').style.display='flex';authMode('login');setSyncStatus('غير متصل');
}
function ensureUserData(){if(!currentUser)return;db.farms.forEach(f=>{if(!f.ownerId)f.ownerId=currentUser.id});normalizeDbIds();}
async function loadCloudProfile(user){
  let role='worker',name=user.user_metadata?.full_name||user.email||'',farmRoles={};
  if(supabaseClient){
    const p=await supabaseClient.from('profiles').select('full_name,role').eq('id',user.id).maybeSingle();
    if(!p.error&&p.data){role=p.data.role||role;name=p.data.full_name||name;}
    const m=await supabaseClient.from('farm_members').select('farm_id,role').eq('user_id',user.id);
    if(!m.error)(m.data||[]).forEach(x=>farmRoles[x.farm_id]=x.role);
  }
  currentUser={id:user.id,name,email:user.email||'',role,farmRoles};localStorage.setItem(SESSION_KEY,JSON.stringify(currentUser));
}
function setSyncStatus(msg,ok=false){const el=document.getElementById('syncStatus');if(el){el.textContent=msg;el.style.background=ok?'#ecfdf5':'#fff7ed';el.style.color=ok?'#047857':'#b45309'}}
async function acceptInviteFromHash(){if(!supabaseClient||!currentUser)return;const m=location.hash.match(/#invite=([^&]+)/);if(!m)return;const token=decodeURIComponent(m[1]);const {data,error}=await supabaseClient.rpc('accept_farm_invitation',{p_token:token});if(!error&&data){history.replaceState(null,'',location.pathname+location.search);await loadCloudProfile((await supabaseClient.auth.getUser()).data.user);alert('تم قبول الدعوة وإضافة المزرعة إلى حسابك.');}else if(error)console.warn('Invitation:',error.message)}
async function bootAuth(){
  authMode('login');
  initLanguage();
  if(supabaseClient){
    setSyncStatus('Supabase جاهز');
    const {data}=await supabaseClient.auth.getSession();
    if(data?.session?.user){await loadCloudProfile(data.session.user);await unlockApp(true);await acceptInviteFromHash()}
    else{currentUser=null;localStorage.removeItem(SESSION_KEY);document.getElementById('authOverlay').style.display='flex';}
    supabaseClient.auth.onAuthStateChange((_event,session)=>{
      if(_event==='PASSWORD_RECOVERY'){setTimeout(()=>showRecoveryForm(),0);return;}
      if(session?.user&&_event!=='SIGNED_OUT'){setTimeout(async()=>{await loadCloudProfile(session.user);await unlockApp(true);await acceptInviteFromHash()},0)}
      else if(_event==='SIGNED_OUT'){currentUser=null;localStorage.removeItem(SESSION_KEY);db=emptyDb();document.getElementById('authOverlay').style.display='flex';authMode('login');setSyncStatus('غير متصل')}
    });
  }else{
    setSyncStatus('وضع محلي — Supabase غير مربوط');
    if(currentUser){
      // Keep an existing session from the last working build; do not erase it merely because cloud config is absent.
      await unlockApp(false);
    }else if(users.length){
      document.getElementById('authOverlay').style.display='flex';
    }else{
      document.getElementById('authOverlay').style.display='flex';
    }
  }
}
const save=()=>{persistLocal();renderAll();if(supabaseClient&&currentUser){clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow(),500)}};
function showCloudSetup(){const b=document.getElementById('cloudSetupBox');if(!b)return;b.style.display='block';b.innerHTML=supabaseClient?'<b>Supabase متصل.</b> تسجيل الدخول يتم عبر Supabase، وإذا تعذرت المزامنة فسيبقى البرنامج مفتوحًا ويعمل محليًا حتى تُصلح جداول/صلاحيات قاعدة البيانات.':'<b>Supabase غير مربوط.</b> ضع Project URL + Publishable/Anon Key الحقيقيين في <code>www/supabase-config.local.js</code> أو احفظهما في إعدادات التطبيق. لا تستخدم Secret/Service Role Key.'}
function getFarmForRecord(type,x){if(!x)return null;if(type==='farms')return x.id;if(type==='houses'||type==='inventory')return x.farmId;if(type==='cycles')return x.farmId;const c=cyc(x.cycleId);return c?.farmId||null}
function markDeleted(type,x){const farmId=getFarmForRecord(type,x);if(farmId&&isUuid(x.id)){db.tombstones.push({id:uuid(),farmId,entity:type,recordId:x.id,deletedAt:new Date().toISOString()})}}
function rowUpdated(x){return x?.updatedAt||new Date().toISOString()}
function cloudRows(){
  return {
    farms:db.farms.map(f=>({id:f.id,owner_id:f.ownerId||currentUser.id,name:f.name,company_name:f.companyName||'',license_number:f.licenseNumber||'',owner_name:f.owner||'',manager:f.manager||'',location:f.location||'',updated_at:rowUpdated(f)})),
    houses:db.houses.map(x=>({id:x.id,farm_id:x.farmId,name:x.name,capacity:+x.capacity||0,updated_at:rowUpdated(x)})),
    cycles:db.cycles.map(x=>({id:x.id,farm_id:x.farmId,house_id:x.houseId||null,date:x.date,birds:+x.birds||0,init_weight:+x.initWeight||0,breed:x.breed||'',source:x.source||'',currency:currencyCode(x.currency||'SAR'),active:!!x.active,updated_at:rowUpdated(x)})),
    daily_records:db.daily.map(x=>({id:x.id,cycle_id:x.cycleId,date:x.date,dead:+x.dead||0,cull:+x.cull||0,feed:+x.feed||0,water:+x.water||0,weight:+x.weight||0,temp:+x.temp||0,humidity:+x.humidity||0,notes:x.notes||'',updated_at:rowUpdated(x)})),
    weekly_weights:db.weights.map(x=>({id:x.id,cycle_id:x.cycleId,date:x.date,sample:+x.sample||0,total:+x.total||0,avg:+x.avg||0,min:+x.min||0,max:+x.max||0,sd:+x.sd||0,cv:+x.cv||0,cv_method:x.cvMethod||null,sample_weights:Array.isArray(x.sampleWeights)?x.sampleWeights:[],updated_at:rowUpdated(x)})),
    feed_movements:db.feed.map(x=>({id:x.id,cycle_id:x.cycleId,date:x.date,type:x.type||'',qty:+x.qty||0,price:+x.price||0,currency:currencyCode(x.currency||getCycleCurrency(cyc(x.cycleId))),updated_at:rowUpdated(x)})),
    health_records:db.meds.map(x=>({id:x.id,cycle_id:x.cycleId,date:x.date,type:x.type||'',name:x.name||'',qty:+x.qty||0,cost:+x.cost||0,dose:x.dose||'',withdrawal:+x.withdrawal||0,currency:currencyCode(x.currency||getCycleCurrency(cyc(x.cycleId))),updated_at:rowUpdated(x)})),
    sales:db.sales.map(x=>({id:x.id,cycle_id:x.cycleId,date:x.date,birds:+x.birds||0,weight_kg:+x.weightKg||0,weight_qty:+(x.weightQty??x.weightKg)||0,weight_unit:x.weightUnit||'kg',price:+x.price||0,total:+x.total||0,currency:currencyCode(x.currency||getCycleCurrency(cyc(x.cycleId))),buyer:x.buyer||'',updated_at:rowUpdated(x)})),
    inventory_items:db.inventory.map(x=>({id:x.id,farm_id:x.farmId||(db.farms[0]?.id),item:x.item||'',unit:x.unit||'',balance:+x.balance||0,min:+x.min||0,updated_at:rowUpdated(x)})).filter(x=>x.farm_id),
    company_settings:[{owner_id:currentUser.id,currency:currencyCode(db.settings?.currency||'SAR'),updated_at:db.settings?.updatedAt||new Date().toISOString()}],
    performance_rules:(db.performanceRules||[]).map(x=>({id:x.id,owner_id:db.farms[0]?.ownerId||currentUser.id,breed:x.breed||'',age_day:+x.ageDay||0,target_weight:+x.targetWeight||0,target_fcr:+x.targetFcr||0,target_adg:+x.targetAdg||0,max_cv:+x.maxCv||0,min_epef:+x.minEpef||0,max_mortality:+x.maxMortality||0,updated_at:rowUpdated(x)})),
    audit_logs:(db.auditLog||[]).map(x=>({id:x.id,user_id:x.userId,farm_id:x.farmId||null,action:x.action,entity:x.entity,record_id:isUuid(x.recordId)?x.recordId:null,details:x.details||{},created_at:x.createdAt})),
    finance_entries:Object.entries(db.finance||{}).map(([cycleId,f])=>{const expenses=normalizeFinanceExpenses(f);const legacy=financeLegacyTotals(expenses);return {id:f.id||uuid(),cycle_id:cycleId,category:'cycle_finance',entry_type:'summary',amount:0,chicks:+f.chicks||0,labor:legacy.labor,utilities:legacy.utilities,transport:legacy.transport,other:legacy.other,expenses_json:expenses,sale_price:+f.salePrice||0,currency:f.currency||'SAR',other_revenue:+f.otherRevenue||0,actual_sales_revenue:+f.actualSalesRevenue||0,actual_sold_birds:+f.actualSoldBirds||0,actual_sold_kg:+f.actualSoldKg||0,total_revenue:+f.totalRevenue||0,total_cost:+f.totalCost||0,profit_loss:+f.profitLoss||0,computed_at:f.computedAt||null,updated_at:rowUpdated(f)}})
  };
}
async function upsertTable(table,rows,conflict='id',ignoreDuplicates=false){if(!rows.length)return null;const {error}=await supabaseClient.from(table).upsert(rows,{onConflict:conflict,ignoreDuplicates});if(error)throw new Error(table+': '+error.message);return true}
function farmRoleFor(farmId){if(!farmId||!currentUser)return null;const local=db.farms.find(f=>f.id===farmId);if(local?.ownerId===currentUser.id)return 'owner';return currentUser.farmRoles?.[farmId]||null}
function rowFarmId(table,row){if(['farms','houses','cycles','inventory_items'].includes(table))return row.farm_id;const c=db.cycles.find(x=>x.id===row.cycle_id);return c?.farmId||null}
async function syncMixed(table,rows,insertRoles=['owner','manager','supervisor','worker'],editRoles=['owner','manager','supervisor']){
  const editable=[],insertOnly=[];for(const row of rows){const role=farmRoleFor(rowFarmId(table,row));if(editRoles.includes(role))editable.push(row);else if(insertRoles.includes(role))insertOnly.push(row)}
  await upsertTable(table,editable,'id',false);await upsertTable(table,insertOnly,'id',true);
}
async function syncToCloud(){
  if(!supabaseClient||!currentUser)return;
  normalizeDbIds();const r=cloudRows();
  await syncMixed('farms',r.farms,['owner','manager'],['owner','manager']);await syncMixed('houses',r.houses);await syncMixed('cycles',r.cycles);await syncMixed('daily_records',r.daily_records);await syncMixed('weekly_weights',r.weekly_weights);await syncMixed('feed_movements',r.feed_movements);await syncMixed('health_records',r.health_records);await syncMixed('sales',r.sales);await syncMixed('inventory_items',r.inventory_items);if(currentUser.role==='owner') { await upsertTable('company_settings',r.company_settings,'owner_id',false); await upsertTable('performance_rules',r.performance_rules,'id',false); }await upsertTable('audit_logs',r.audit_logs,'id',true);
  const financeRows=r.finance_entries.filter(row=>['owner','manager'].includes(farmRoleFor(rowFarmId('finance_entries',row))));try{await upsertTable('finance_entries',financeRows,'id',false)}catch(e){if(/expenses_json|column .* does not exist/i.test(String(e?.message||''))){const legacyRows=financeRows.map(({expenses_json,...row})=>row);await upsertTable('finance_entries',legacyRows,'id',false)}else throw e;}
  for(const t of db.tombstones){try{if(t.entity==='farms')await supabaseClient.from('farms').delete().eq('id',t.recordId);else if(t.entity==='houses')await supabaseClient.from('houses').delete().eq('id',t.recordId);else if(t.entity==='cycles')await supabaseClient.from('cycles').delete().eq('id',t.recordId);else {const map={daily:'daily_records',weights:'weekly_weights',feed:'feed_movements',meds:'health_records',sales:'sales',inventory:'inventory_items',finance:'finance_entries'};if(map[t.entity])await supabaseClient.from(map[t.entity]).delete().eq('id',t.recordId);}}catch(e){console.warn(e)}}
  db.tombstones=[];persistLocal();
}
async function syncFromCloud({pushLocal=false}={}){
  if(!supabaseClient||!currentUser)return;
  try{
    setSyncStatus('جارٍ المزامنة...');
    if(pushLocal&&db.farms.length)await syncToCloud();
    const q=async table=>{const {data,error}=await supabaseClient.from(table).select('*');if(error)throw new Error(table+': '+error.message);return data||[]};
    const [farms,houses,cycles,daily,weights,feed,meds,sales,inventory,fin,settingsRows,ruleRows,auditRows]=await Promise.all([q('farms'),q('houses'),q('cycles'),q('daily_records'),q('weekly_weights'),q('feed_movements'),q('health_records'),q('sales'),q('inventory_items'),q('finance_entries'),q('company_settings'),q('performance_rules'),q('audit_logs')]);
    const hadLocalData=!!(db.farms?.length||db.cycles?.length||db.sales?.length);
    const nf=farms.map(x=>({id:x.id,ownerId:x.owner_id,name:x.name,companyName:x.company_name||'',licenseNumber:x.license_number||'',owner:x.owner_name||'',manager:x.manager||'',location:x.location||'',updatedAt:x.updated_at}));
    // Never replace non-empty local/recovered data with an empty remote result.
    // This is critical when RLS, schema, offline state, or a newly created Supabase user returns no rows.
    if(hadLocalData && !nf.length){
      persistLocal();renderAll();setSyncStatus('البيانات المحلية محفوظة — تعذرت قراءة بيانات السحابة الآن');return;
    }
    // If cloud access succeeds but the cloud project is genuinely empty, keep recovered/local data.
    if(!nf.length && hasProjectData(db)){
      persistLocal();renderAll();setSyncStatus('البيانات المحلية محفوظة — لا توجد بيانات سحابية بعد');return;
    }
    const ncycles=cycles.map(x=>({id:x.id,farmId:x.farm_id,houseId:x.house_id,date:x.date,birds:+x.birds||0,initWeight:+x.init_weight||0,breed:x.breed||'',source:x.source||'',currency:currencyCode(x.currency||'SAR'),active:x.active!==false,updatedAt:x.updated_at}));
    const byFarm=new Set(nf.map(x=>x.id));
    const cloudOwner=currentUser.id;const remoteSetting=settingsRows.find(x=>x.owner_id===cloudOwner);const cloudCurrency=currencyCode(remoteSetting?.currency||db.settings?.currency||ncycles[0]?.currency||'SAR');db={farms:nf.filter(x=>byFarm.has(x.id)),houses:houses.map(x=>({id:x.id,farmId:x.farm_id,name:x.name,capacity:+x.capacity||0,updatedAt:x.updated_at})),cycles:ncycles,daily:daily.map(x=>({id:x.id,cycleId:x.cycle_id,date:x.date,dead:+x.dead||0,cull:+x.cull||0,feed:+x.feed||0,water:+x.water||0,weight:+x.weight||0,temp:+x.temp||0,humidity:+x.humidity||0,notes:x.notes||'',updatedAt:x.updated_at})),weights:weights.map(x=>({id:x.id,cycleId:x.cycle_id,date:x.date,sample:+x.sample||0,total:+x.total||0,avg:+x.avg||0,min:+x.min||0,max:+x.max||0,sd:+x.sd||0,cv:+x.cv||0,cvMethod:x.cv_method||null,sampleWeights:Array.isArray(x.sample_weights)?x.sample_weights:[],updatedAt:x.updated_at})),feed:feed.map(x=>({id:x.id,cycleId:x.cycle_id,date:x.date,type:x.type||'',qty:+x.qty||0,price:+x.price||0,currency:currencyCode(x.currency||'SAR'),updatedAt:x.updated_at})),meds:meds.map(x=>({id:x.id,cycleId:x.cycle_id,date:x.date,type:x.type||'',name:x.name||'',qty:+x.qty||0,cost:+x.cost||0,dose:x.dose||'',withdrawal:+x.withdrawal||0,currency:currencyCode(x.currency||'SAR'),updatedAt:x.updated_at})),inventory:inventory.map(x=>({id:x.id,farmId:x.farm_id,item:x.item||'',unit:x.unit||'',balance:+x.balance||0,min:+x.min||0,updatedAt:x.updated_at})),sales:sales.map(x=>({id:x.id,cycleId:x.cycle_id,date:x.date,birds:+x.birds||0,weightKg:+x.weight_kg||0,weightQty:+(x.weight_qty??x.weight_kg)||0,weightUnit:x.weight_unit||'kg',price:+x.price||0,total:+x.total||0,buyer:x.buyer||'',currency:currencyCode(x.currency||'SAR'),updatedAt:x.updated_at})),finance:{},tombstones:[]};
    (fin||[]).forEach(x=>{if(x.cycle_id){let expenses=[];if(Array.isArray(x.expenses_json))expenses=x.expenses_json;else if(typeof x.expenses_json==='string'){try{expenses=JSON.parse(x.expenses_json)||[]}catch(_){expenses=[]}};const legacy={labor:+x.labor||0,utilities:+x.utilities||0,transport:+x.transport||0,other:+x.other||0};if(!expenses.length){expenses=normalizeFinanceExpenses(legacy)}db.finance[x.cycle_id]={id:x.id,chicks:+x.chicks||0,labor:legacy.labor,utilities:legacy.utilities,transport:legacy.transport,other:legacy.other,expenses,salePrice:+x.sale_price||0,currency:cloudCurrency,otherRevenue:+x.other_revenue||0,actualSalesRevenue:+x.actual_sales_revenue||0,actualSoldBirds:+x.actual_sold_birds||0,actualSoldKg:+x.actual_sold_kg||0,totalRevenue:+x.total_revenue||0,totalCost:+x.total_cost||0,profitLoss:+x.profit_loss||0,computedAt:x.computed_at||null,updatedAt:x.updated_at};financeDraftExpenses[x.cycle_id]=expenses.map(e=>({...e}))}});db.settings={...(db.settings||{}),currency:cloudCurrency,language:db.settings?.language||'ar',updatedAt:remoteSetting?.updated_at||db.settings?.updatedAt||new Date().toISOString()};db.cycles.forEach(c=>c.currency=cloudCurrency);db.feed.forEach(x=>x.currency=cloudCurrency);db.meds.forEach(x=>x.currency=cloudCurrency);db.sales.forEach(x=>x.currency=cloudCurrency);Object.values(db.finance).forEach(x=>x.currency=cloudCurrency);db.performanceRules=(ruleRows||[]).filter(x=>x.owner_id===cloudOwner).map(x=>({id:x.id,breed:x.breed||'',ageDay:+x.age_day||0,targetWeight:+x.target_weight||0,targetFcr:+x.target_fcr||0,targetAdg:+x.target_adg||0,maxCv:+x.max_cv||0,minEpef:+x.min_epef||0,maxMortality:+x.max_mortality||0,updatedAt:x.updated_at}));db.auditLog=(auditRows||[]).map(x=>({id:x.id,userId:x.user_id,userName:'',farmId:x.farm_id,action:x.action,entity:x.entity,recordId:x.record_id,details:x.details||{},createdAt:x.created_at}));db.invitations=[];
    persistLocal();renderAll();setSyncStatus('تمت المزامنة ☁️',true);
  }catch(e){console.error(e);setSyncStatus('بدون مزامنة — سيعاد المحاولة');console.warn('Cloud sync:',e.message)}
}
async function syncNow(){if(syncBusy||!supabaseClient||!currentUser)return;if(!navigator.onLine){setSyncStatus('بدون إنترنت — محفوظ محليًا');return}syncBusy=true;try{await syncToCloud();await syncFromCloud({pushLocal:false});}catch(e){console.error(e);setSyncStatus('تعذر المزامنة — البيانات محفوظة محليًا')}finally{syncBusy=false}}
window.addEventListener('online',()=>{if(currentUser&&supabaseClient)syncNow()});

const id=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const today=()=>{const d=new Date();return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh'}).format(d)};
const getFarmName=i=>db.farms.find(x=>x.id===i)?.name||'-';
const getHouseName=i=>db.houses.find(x=>x.id===i)?.name||'-';
const cyc=i=>db.cycles.find(x=>x.id===i);
const isPastOrToday=(date,d=today())=>!date||date<=d;
const deadTotal=(c,d=today())=>{if(!c)return 0;return db.daily.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date,d)).reduce((s,x)=>s+Math.max(0,+x.dead||0),0)};
const cullTotal=(c,d=today())=>{if(!c)return 0;return db.daily.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date,d)).reduce((s,x)=>s+Math.max(0,+x.cull||0),0)};
const dailyWeightAtOrBefore=(c,date=today())=>db.daily.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date,date)&&(+x.weight||0)>0).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
const weeklyWeightAtOrBefore=(c,date=today())=>db.weights.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date,date)&&(+x.avg||0)>0).sort((a,b)=>b.date.localeCompare(a.date))[0]||null;
const lastWeight=c=>weeklyWeightAtOrBefore(c,today());
const currentWeight=c=>{const d=dailyWeightAtOrBefore(c,today());if(d)return +d.weight||0;const w=weeklyWeightAtOrBefore(c,today());return +w?.avg||0};
const weightAtOrBefore=(c,date=today())=>{const d=dailyWeightAtOrBefore(c,date);if(d)return {avg:+d.weight||0,date:d.date,source:'daily'};const w=weeklyWeightAtOrBefore(c,date);if(w)return {avg:+w.avg||0,date:w.date,source:'weekly'};return null};
function saleAverageWeight(c,x){
  const explicit=Number(x?.avgWeight??x?.saleAvgWeight??0);
  if(Number.isFinite(explicit)&&explicit>0)return explicit;
  const w=weightAtOrBefore(c,x?.date||today());
  if(w?.avg>0)return w.avg;
  return currentWeight(c);
}
function saleWeightKg(c,x){
  if(!x)return 0;
  const unit=x.weightUnit||'kg';
  if(unit==='kg')return Math.max(0,Number(x.weightQty??x.weightKg??0)||Number(x.weightKg||0));
  const explicitKg=Number(x.weightKg||0);
  if(Number.isFinite(explicitKg)&&explicitKg>0)return explicitKg;
  const birds=Math.max(0,Math.floor(Number(x.birds)||0));
  const avg=saleAverageWeight(c,x);
  return birds*avg;
}
function saleRowBirds(c,x){
  const birds=Math.max(0,Math.floor(+x?.birds||0));
  if(birds>0)return birds;
  const kg=x?.weightUnit==='kg'?saleWeightKg(c,x):0;
  const w=saleAverageWeight(c,x);
  return kg>0&&w>0?Math.max(0,Math.round(kg/w)):0;
}
function saleRowRevenue(x){
  const explicit=Number(x?.total);
  if(Number.isFinite(explicit)&&explicit>0)return explicit;
  const alt=[x?.revenue,x?.amount,x?.totalAmount].map(Number).find(v=>Number.isFinite(v)&&v>0);
  if(Number.isFinite(alt))return alt;
  const qty=Math.max(0,Number(x?.weightQty??x?.weightKg??0));
  const price=Math.max(0,Number(x?.price||0));
  return qty*price;
}
function soldBirdsAtDate(c,d=today()){if(!c)return 0;return db.sales.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date,d)).reduce((s,x)=>s+saleRowBirds(c,x),0)}
function soldWeightKgAtDate(c,d=today()){if(!c)return 0;return db.sales.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date,d)).reduce((s,x)=>s+saleWeightKg(c,x),0)}
function liveBreakdown(c,d=today()){
  const received=Math.max(0,Math.floor(+c?.birds||0));
  const dailyRows=db.daily.filter(x=>x.cycleId===c?.id&&isPastOrToday(x.date,d));
  const dead=dailyRows.reduce((s,x)=>s+Math.max(0,Math.floor(+x.dead||0)),0);
  const cull=dailyRows.reduce((s,x)=>s+Math.max(0,Math.floor(+x.cull||0)),0);
  const sold=db.sales.filter(x=>x.cycleId===c?.id&&isPastOrToday(x.date,d)).reduce((s,x)=>s+saleRowBirds(c,x),0);
  const raw=received-dead-cull-sold;
  return {received,dead,cull,sold,raw,live:Math.max(0,raw),overdrawn:raw<0};
}
function liveSource(c,d=today()){
  const b=liveBreakdown(c,d);
  return {received:b.received,dead:b.dead,cull:b.cull,sold:b.sold,live:b.live,raw:b.raw};
}
function liveAtDate(c,d=today()){return liveBreakdown(c,d).live}
const saleBirdsTotal=c=>soldBirdsAtDate(c,today());
const currentLive=c=>liveAtDate(c,today());
const live=currentLive;
const feedConsumedTotal=c=>db.daily.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date)).reduce((s,x)=>s+(+x.feed||0),0);
const feedActualTotal=c=>db.feed.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date)).reduce((s,x)=>s+(+x.qty||0),0);
// FCR uses feed consumed/issued in daily monitoring; feed movements are retained for financial cost accounting.
const feedForFcr=c=>{const consumed=feedConsumedTotal(c);return consumed>0?consumed:feedActualTotal(c)};
const feedTotal=feedForFcr;
function cycleMetricDate(c,d=today()){
  const asOf=d||today();
  const b=liveBreakdown(c,asOf);
  if(!(b.received>0&&b.live===0&&b.raw<=0))return asOf;
  const dates=[...db.daily.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date,asOf)).map(x=>x.date),...db.sales.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date,asOf)).map(x=>x.date)].filter(Boolean).sort();
  return dates.at(-1)||asOf;
}
const age=(c,d)=>{const target=d||cycleMetricDate(c,today());return Math.max(0,Math.floor((new Date(target)-new Date(c.date))/86400000))};
function currentWeightAtDate(c,d=today()){const daily=dailyWeightAtOrBefore(c,d);if(daily)return +daily.weight||0;const weekly=weeklyWeightAtOrBefore(c,d);return +weekly?.avg||0}
function performanceWeight(c,d=today()){
  const liveNow=liveAtDate(c,d);
  if(liveNow>0)return currentWeightAtDate(c,d);
  const sales=db.sales.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date,d));
  const birds=sales.reduce((s,x)=>s+saleRowBirds(c,x),0),kg=sales.reduce((s,x)=>s+saleWeightKg(c,x),0);
  if(birds>0&&kg>0)return kg/birds;
  return currentWeightAtDate(c,d);
}
const CURRENCY_NAMES={ar:{SAR:'الريال السعودي',EGP:'الجنيه المصري',USD:'الدولار الأمريكي',AED:'الدرهم الإماراتي',KWD:'الدينار الكويتي',QAR:'الريال القطري',OMR:'الريال العماني',BHD:'الدينار البحريني',EUR:'اليورو'},en:{SAR:'Saudi Riyal',EGP:'Egyptian Pound',USD:'US Dollar',AED:'UAE Dirham',KWD:'Kuwaiti Dinar',QAR:'Qatari Riyal',OMR:'Omani Rial',BHD:'Bahraini Dinar',EUR:'Euro'}};
const CURRENCIES=CURRENCY_NAMES.ar;
const currencyCode=v=>CURRENCIES[v]?v:'SAR';
function currencyLabel(v){const k=currencyCode(v);return `${CURRENCY_NAMES[uiLanguage()][k]} (${k})`}
function getCycleCurrency(c){return currencyCode(c?.currency||db?.settings?.currency||'SAR')}
const LANG_KEY='pfm_language_v36';
const UI_LANGS={ar:{label:'العربية',dir:'rtl'},en:{label:'English',dir:'ltr'}};
const UI_EN={"V3.6.7 — Local-first + Supabase + المزامنة بين الأجهزة":"V3.6.7 — Local-first + Supabase + Device Sync","دخول":"Login","حساب جديد":"Create Account","🐔 إدارة مزارع الدواجن — V3.6.7":"🐔 Poultry Farm Manager — V3.6.7","إدارة متعددة المزارع • المبيعات الجزئية • FCR/EPEF • CV • التكاليف • المخزون • التقارير":"Multi-farm management • Partial sales • FCR/EPEF • CV • Costs • Inventory • Reports","غير متصل":"Offline","تمت المزامنة ☁️":"Synced ☁️","جارٍ المزامنة...":"Syncing...","بدون مزامنة — سيعاد المحاولة":"Offline sync — will retry","تعذر المزامنة — البيانات محفوظة محليًا":"Sync failed — data saved locally","وضع محلي — Supabase غير مربوط":"Local mode — Supabase not connected","Supabase جاهز":"Supabase ready","بدون إنترنت — محفوظ محليًا":"No internet — saved locally","الرئيسية":"Dashboard","المزارع":"Farms","العنابر":"Houses","الدورات":"Cycles","المتابعة":"Daily Monitoring","الأوزان الأسبوعية":"Weekly Weights","الأعلاف":"Feed","الأدوية والتحصينات":"Medications & Vaccinations","المخزون":"Inventory","المبيعات والحصاد":"Sales & Harvest","التكاليف والأرباح":"Costs & Profit","أداء العنابر":"House Performance","مقارنة الدورات":"Cycle Comparison","التقارير":"Reports","المستخدمون والصلاحيات":"Users & Permissions","الإعدادات والمعايير":"Settings & Standards","سجل التدقيق":"Audit Log","النسخ الاحتياطي":"Backup","تصحيح عرض أداء العنابر وربط عناوين الأعمدة بالبيانات الفعلية، وتحسين ملخص الأداء للدورات المغلقة دون تغيير قواعد الإنتاج والحسابات السابقة.":"Fixed House Performance column alignment and improved closed-cycle summaries without changing established production or calculation rules.","لوحة التحكم":"Dashboard","ملخص المزارع والدورات النشطة":"Farm and active-cycle summary","الدورات النشطة":"Active Cycles","الطيور الحية":"Live Birds","إجمالي النافق":"Total Mortality","طائر":"Birds","إجمالي الطيور المباعة":"Total Birds Sold","طائر — من المبيعات والحصاد":"Birds — from sales & harvest","الوزن الحي الحالي":"Current Live Weight","كجم":"kg","متوسط FCR للدورات النشطة":"Average FCR for Active Cycles","العلف المستهلك":"Feed Consumed","كجم — من المتابعة اليومية":"kg — from daily monitoring","العلف الفعلي":"Recorded Feed","كجم — من سجل الأعلاف":"kg — from feed records","إجمالي المبيعات":"Total Sales","الربح/الخسارة":"Profit / Loss","متوسط CV للدورات النشطة":"Average CV for Active Cycles","كلما انخفض كان التجانس أفضل":"Lower is better for flock uniformity","ملخص المزرعة والعنبر":"Farm & House Summary","المزرعة":"Farm","العنبر":"House","تنبيهات تشغيلية":"Operational Alerts","لا توجد تنبيهات.":"No alerts.","عملة المشروع:":"Project Currency:","— جميع المعاملات المالية تستخدم العملة الموحدة المحددة من الإعدادات.":"— All financial transactions use the project currency selected in Settings.","قاعدة احتساب الحي الحالي:":"Current Live Rule:","الاستقبال − النافق − المستبعد − المبيعات حتى تاريخ اليوم فقط. أي إدخال بتاريخ مستقبلي لا يخفض الحي الحالي، ومبيعات الكجم بدون عدد طيور تُقدّر تلقائيًا عند توفر متوسط وزن للبيع.":"Placement − mortality − culls − sales through today only. Future-dated entries do not reduce current live birds, and kg sales without bird count are estimated when a sale weight is available.","اسم المزرعة *":"Farm Name *","اسم الشركة *":"Company Name *","رقم ترخيص المزرعة *":"Farm License No. *","المالك":"Owner","المسؤول":"Manager","الموقع":"Location","إضافة مزرعة":"Add Farm","إلغاء التعديل":"Cancel Edit","الشركة":"Company","رقم الترخيص":"License No.","المزرعة *":"Farm *","رقم/اسم العنبر *":"House No./Name *","السعة":"Capacity","إضافة عنبر":"Add House","العنبر *":"House *","تاريخ الاستقبال *":"Placement Date *","عدد الكتاكيت *":"Chicks Placed *","متوسط وزن الاستقبال (جم) *":"Average Placement Weight (g) *","السلالة":"Breed","مصدر الكتاكيت":"Chick Source","عملة المشروع":"Project Currency","تُحدد مرة واحدة من الإعدادات وتطبق تلقائيًا على كل المعاملات.":"Set once in Settings and applied automatically to all transactions.","بدء دورة":"Start Cycle","الاستقبال":"Placement","العمر":"Age","الطيور":"Birds","الوزن الابتدائي":"Initial Weight","الحالة":"Status","المتابعة اليومية":"Daily Monitoring","الدورة *":"Cycle *","التاريخ *":"Date *","النافق اليوم":"Dead Today","المستبعد اليوم":"Culls Today","العلف المستهلك (كجم)":"Feed Consumed (kg)","المياه (لتر)":"Water (L)","متوسط الوزن (كجم)":"Average Weight (kg)","الحرارة °C":"Temperature °C","الرطوبة %":"Humidity %","ملاحظات / أدوية / تحصينات":"Notes / Medications / Vaccinations","حفظ المتابعة":"Save Monitoring Record","التاريخ":"Date","الدورة":"Cycle","نافق":"Dead","مستبعد":"Culls","علف":"Feed","مياه":"Water","وزن":"Weight","حرارة °C":"Temperature °C","رطوبة %":"Humidity %","نفوق تراكمي":"Cumulative Mortality","ملاحظات":"Notes","عدد الطيور في العينة":"Sample Size","إجمالي وزن العينة (كجم)":"Total Sample Weight (kg)","أقل وزن (كجم)":"Minimum Weight (kg)","أعلى وزن (كجم)":"Maximum Weight (kg)","أوزان أفراد العينة (جرام) — الحساب التلقائي":"Individual Sample Weights (g) — Automatic Calculation","عند إدخال أوزان أفراد العينة سيُحسب تلقائيًا: عدد العينة، الإجمالي، المتوسط، أقل/أعلى وزن، SD، وCV%. استخدم 10–20 طائرًا أو حسب بروتوكول المزرعة.":"When individual sample weights are entered, the app automatically calculates sample size, total, average, min/max, SD and CV%. Use 10–20 birds or your farm protocol.","SD (كجم) — تلقائي":"SD (kg) — Automatic","أدخل أوزان أفراد العينة لحساب SD الحقيقي.":"Enter individual sample weights to calculate the true SD.","حالة CV ستظهر بعد إدخال الأوزان.":"CV status will appear after entering weights.","حفظ الوزن":"Save Weight","العينة":"Sample","متوسط الوزن":"Average Weight","أقل":"Min","أعلى":"Max","العنابر — اختيار متعدد":"Houses — Multi-select","اختر «كل العنابر» أو عنبرًا أو عدة عنابر. نطاق الاختيار يتحكم في الدورات المتاحة للتسجيل.":"Select “All Houses”, one house, or multiple houses. This scope controls the cycles available for entry.","الدورات — اختيار متعدد":"Cycles — Multi-select","عند اختيار عدة دورات سيتم إنشاء سجل علف مستقل لكل دورة بنفس البيانات.":"When multiple cycles are selected, a separate feed record is created for each cycle with the same data.","نوع العلف":"Feed Type","العلف الفعلي المستخدم (كجم)":"Recorded Feed Used (kg)","سعر الكجم":"Price per kg","تسجيل علف":"Record Feed","النوع":"Type","الكمية":"Quantity","سعر/كجم":"Price/kg","التكلفة":"Cost","اختر «كل العنابر» أو عنبرًا أو عدة عنابر لتحديد نطاق التسجيل.":"Select “All Houses”, one house, or multiple houses to define the entry scope.","عند اختيار عدة دورات سيتم إنشاء سجل مستقل لكل دورة بنفس بيانات الدواء/التحصين.":"When multiple cycles are selected, a separate record is created for each cycle with the same medication/vaccination data.","الاسم":"Name","الجرعة / طريقة الاستخدام":"Dose / Administration","فترة السحب (يوم)":"Withdrawal Period (days)","حفظ":"Save","السحب":"Withdrawal","الصنف *":"Item *","الوحدة":"Unit","الرصيد الافتتاحي":"Opening Balance","حد إعادة الطلب":"Reorder Level","إضافة للمخزون":"Stock In","صرف من المخزون":"Stock Out","إضافة/تحديث الصنف":"Add / Update Item","تصفية حسب المزرعة":"Filter by Farm","تصفية حسب العنابر — للعرض فقط":"Filter by Houses — View Only","المخزون محفوظ على مستوى المزرعة في نموذج البيانات؛ اختيار العنبر هنا للتصفية والقراءة فقط.":"Inventory is stored at farm level in the data model; house selection here is for filtering and viewing only.","الصنف":"Item","الرصيد":"Balance","حد الطلب":"Reorder Level","تكلفة الكتاكيت":"Chick Cost","عمالة":"Labor","كهرباء ومياه":"Utilities","نقل":"Transport","مصاريف أخرى":"Other Expenses","سعر بيع الحي / إجمالي المبيعات الفعلية (تلقائي)":"Live Sale Price / Total Actual Sales (Automatic)","يُسحب تلقائيًا من بند المبيعات والحصاد بعد تسجيل البيع.":"Automatically pulled from Sales & Harvest after a sale is recorded.","إيرادات أخرى":"Other Revenue","حفظ البيانات المالية":"Save Financial Data","حذف السجل المالي":"Delete Financial Record","سجل التكاليف والأرباح":"Costs & Profit Ledger","تصفية السجل — المزرعة":"Ledger Filter — Farm","التصفية للعرض والتحليل فقط؛ إدخال التكلفة نفسه مرتبط بالدورة المحددة.":"Filtering is for viewing/analysis only; cost entry remains linked to the selected cycle.","العملة":"Currency","المبيعات الفعلية":"Actual Sales","الإيراد":"Revenue","الإجراء":"Action","مؤشرات أداء العنابر":"House Performance Metrics","كل عنبر مرتبط بدورته الحالية، وتظهر مؤشرات الدورة دون خلط بيانات عنبر آخر.":"Each house is linked to its cycle, and cycle metrics are shown without mixing data from another house.","المزرعة — كل المزارع أو مزرعة محددة":"Farm — All Farms or a Selected Farm","يمكن عرض كل عنابر المشروع، أو كل عنابر مزرعة، أو مجموعة عنابر. عند اختيار عدة عنابر استخدم Ctrl/⌘.":"You can view all project houses, all houses in a farm, or a group of houses. Use Ctrl/⌘ to select multiple houses.","الدورات ضمن نطاق الأداء المحدد":"Cycles in the Selected Performance Scope","ترتيب الأعمدة مطابق تمامًا للبيانات المعروضة في كل صف: المزرعة ← العنبر ← تاريخ الدورة ← السلالة ← العمر ← الاستقبال ← الحي ← النفوق% ← الوزن ← معامل التحويل الغذائي (FCR) ← معدل الزيادة اليومية (ADG) ← معامل التباين (CV%) ← مؤشر الإنتاج (PI) ← مؤشر كفاءة الإنتاج (EPEF / EPI) ← مؤشر الكفاءة الاقتصادية (EBEF) ← المعامل الاقتصادي (EC) ← المبيعات ← الربح/الخسارة.":"Column order exactly matches the data shown in each row: Farm → House → Cycle Date → Breed → Age → Placement → Live → Mortality% → Weight → FCR → ADG → CV% → PI → EPEF/EPI → EBEF → Sales → Profit/Loss.","تاريخ الدورة":"Cycle Date","الحي":"Live","النفوق%":"Mortality%","الوزن":"Weight","المبيعات":"Sales","مقارنة الدورات السابقة":"Previous Cycle Comparison","مقارنة الدورات لنفس العنبر تساعد الإدارة على معرفة الاتجاه الحقيقي للأداء عبر الزمن.":"Comparing cycles within the same house helps management see the real performance trend over time.","العنبر — كل العنابر أو عنبر محدد":"House — All Houses or a Selected House","المبيعات والحصاد الجزئي":"Partial Sales & Harvest","كل عملية بيع/حصاد تسجل كحركة مستقلة.":"Each sale/harvest is recorded as an independent transaction.","عدد الطيور إلزامي":"Bird Count Required","حتى يبقى الحي الحالي صحيحًا. الإيراد يُحسب من المبيعات الفعلية فقط، بينما خانة «إيرادات أخرى» في المالية لا تشمل المبيعات.":"To keep current live birds accurate. Revenue is calculated from actual sales only; “Other Revenue” does not include sales.","تاريخ البيع *":"Sale Date *","عدد الطيور":"Bird Count","اختر الدورة لمعرفة الحي المتاح.":"Select a cycle to see available live birds.","الوزن الحي / الكمية":"Live Weight / Quantity","وحدة الوزن/الكمية":"Weight / Quantity Unit","متوسط وزن الطائر عند البيع (كجم)":"Average Bird Sale Weight (kg)","يُملأ تلقائيًا من أحدث وزن متاح قبل تاريخ البيع ويمكن تعديله.":"Auto-filled from the latest available weight before the sale date and editable.","سعر الوحدة":"Unit Price","المشتري":"Buyer","تسجيل البيع":"Record Sale","الوزن الحي":"Live Weight","سعر/وحدة":"Price/Unit","تقرير الدورة":"Cycle Report","اختر الدورة":"Select Cycle","🖨️ طباعة / حفظ كـ PDF":"🖨️ Print / Save as PDF","أنت المالك الرئيسي (Owner). كل موظف يستخدم حسابه الشخصي بالبريد الإلكتروني وكلمة المرور، ثم تمنحه صلاحية على مزرعة محددة.":"You are the main owner (Owner). Each employee uses a personal email/password account, then receives permissions for a selected farm.","الدور ليس هو بيانات الدخول.":"The role is separate from login credentials.","مالك: تحكم كامل • مدير مزرعة: تشغيل + إدارة أعضاء مزرعته • مشرف: إدخال وتعديل التشغيل • عامل: إدخال التشغيل فقط. قاعدة البيانات RLS تمنع تجاوز الصلاحيات حتى لو حاول المستخدم الوصول مباشرة إلى البيانات.":"Owner: full control • Farm Manager: operations + manage farm members • Supervisor: enter/edit operations • Worker: operations entry only. Database RLS prevents privilege bypass even with direct data access.","بريد الموظف *":"Employee Email *","الدور":"Role","حفظ الصلاحية":"Save Permission","تحديث الأعضاء":"Refresh Members","دعوة موظف":"Invite Employee","بريد الموظف":"Employee Email","إنشاء دعوة":"Create Invitation","لا توجد بيانات أعضاء محملة.":"No member data loaded.","العملة الأساسية":"Project Currency","اختر عملة المشروع من هنا. يمكنك تغييرها في أي وقت، وتُطبَّق تلقائيًا على العلف، الأدوية، التحصينات، المبيعات، المشتريات، التكاليف، الأرباح والتقارير. لا يوجد تحويل لسعر الصرف؛ التغيير يحدد عملة المشروع فقط.":"Choose the project currency here. You can change it at any time; it applies automatically to feed, medications, vaccinations, sales, purchases, costs, profit and reports. No exchange-rate conversion is performed.","حفظ عملة المشروع":"Save Project Currency","🌐 اللغة":"🌐 Language","لغة الواجهة":"Interface Language","تم تجهيز بنية الترجمة لإضافة لغات أخرى لاحقًا بدون تغيير بيانات المزارع أو الدورات أو الحسابات.":"The translation architecture is ready for future languages without changing farm, cycle or calculation data.","معايير الأداء حسب السلالة والعمر":"Performance Standards by Breed & Age","المعايير قابلة للتخصيص حسب الشركة والسلالة والعمر، وتستخدم للتنبيه والمقارنة.":"Standards can be customized by company, breed and age and are used for alerts and comparisons.","العمر (يوم)":"Age (days)","الوزن المستهدف (كجم)":"Target Weight (kg)","FCR المستهدف":"Target FCR","ADG المستهدف (جم)":"Target ADG (g)","CV% الأقصى":"Maximum CV%","EPEF الأدنى":"Minimum EPEF","PI الأدنى":"Minimum PI","النفوق الأقصى %":"Maximum Mortality %","حفظ المعيار":"Save Standard","نفوق":"Mortality","سجل التدقيق Audit Log":"Audit Log","سجل مركزي لكل إضافة وتعديل وحذف وإعداد حساس.":"Central log for every create, update, delete and sensitive setting change.","المستخدم":"User","العملية":"Operation","السجل":"Record","التفاصيل":"Details","النسخ الاحتياطي والمزامنة السحابية":"Backup & Cloud Sync","V3.4.4 يعمل Local-first. عند ربط Supabase تتم المزامنة تلقائيًا، وتظل البيانات قابلة للإدخال بدون إنترنت ثم تُرفع عند عودة الاتصال.":"V3.4.4 is Local-first. When Supabase is connected, data syncs automatically; entries can be made offline and uploaded when connectivity returns.","☁️ مزامنة الآن":"☁️ Sync Now","إعداد الاتصال":"Connection Setup","تصدير نسخة JSON":"Export JSON Backup","استيراد نسخة JSON":"Import JSON Backup","تحميل مخطط قاعدة البيانات":"Download Database Schema","الأدوار المقترحة":"Suggested Roles","الصلاحيات":"Permissions","مالك":"Owner","إدارة المزارع والمستخدمين والتقارير المالية":"Manage farms, users and financial reports","مدير مزرعة":"Farm Manager","إدارة الدورات والتشغيل والتقارير":"Manage cycles, operations and reports","مشرف":"Supervisor","إدخال ومراجعة البيانات التشغيلية":"Enter and review operational data","عامل":"Worker","إدخال المتابعة اليومية فقط":"Daily monitoring entry only","كل المزارع":"All Farms","كل العنابر":"All Houses","كل المزارع والعنابر":"All Farms & Houses","كل المزارع — كل العنابر":"All Farms — All Houses","إلغاء":"Cancel","تعديل":"Edit","حذف":"Delete","فتح":"Open","إنهاء":"Close","نشطة":"Active","منتهية":"Closed","دورة نشطة":"Active cycle","لا توجد دورة نشطة":"No active cycle","المتاح":"Available","إعادة طلب":"Reorder","جيد":"Good","غير متاح":"Not Available","اختر مزرعة أولًا.":"Select a farm first.","تحديث السجل":"Refresh Record","دواء":"Medication","تحصين":"Vaccination","مطهر":"Disinfectant","فيتامين":"Vitamin","نشارة":"Litter / Shavings","أخرى":"Other","حبة":"bird","ممتاز":"Excellent","ضعيف":"Weak","متوسط":"Medium","ممتاز — تجانس عالٍ":"Excellent — High Uniformity","جيد — تجانس مقبول":"Good — Acceptable Uniformity","متوسط — يحتاج متابعة":"Medium — Needs Follow-up","ضعيف — تباين مرتفع":"Weak — High Variation","معيار السلالة/العمر":"Breed/Age Standard","المعيار التشغيلي الافتراضي":"Default Operational Standard","اختر المزرعة وأدخل اسم الصنف":"Select a farm and enter the item name","لا يوجد أعضاء.":"No members.","اربط Supabase أولًا.":"Connect Supabase first.","إدارة الأعضاء متاحة بعد ربط Supabase.":"Member management is available after connecting Supabase.","ليس لديك صلاحية إدارة المستخدمين في هذه المزرعة.":"You do not have permission to manage users in this farm.","ليس لديك صلاحية لتنفيذ هذا الإجراء في هذه المزرعة.":"You do not have permission to perform this action in this farm.","ليس لديك صلاحية لتنفيذ هذا الإجراء لهذا النوع من السجلات.":"You do not have permission to perform this action for this record type.","إعداد المعايير متاح للمالك الرئيسي فقط.":"Performance standards are available to the main owner only.","تغيير العملة متاح للمالك الرئيسي فقط.":"Currency changes are available to the main owner only.","إنشاء مزرعة جديدة متاح للمالك الرئيسي فقط.":"Creating a new farm is available to the main owner only.","السجل المطلوب غير موجود.":"The requested record was not found.","أكمل بيانات العنبر":"Complete the house data","أكمل بيانات الدورة":"Complete the cycle data","هذا العنبر موجود بالفعل في المزرعة.":"This house already exists in the farm.","لم يتم العثور على العنبر.":"House not found.","لم يتم العثور على الدورة.":"Cycle not found.","هذا العنبر لديه دورة نشطة بالفعل. أنهِ الدورة الحالية أولًا ثم ابدأ دورة جديدة.":"This house already has an active cycle. Close the current cycle before starting a new one.","توجد دورة بالفعل لهذا العنبر في نفس تاريخ الاستقبال.":"A cycle already exists for this house on the same placement date.","لا يمكن نقل عنبر مرتبط بدورات. أنشئ عنبرًا جديدًا للمزرعة الأخرى حفاظًا على تاريخ البيانات.":"A house linked to cycles cannot be moved. Create a new house in the other farm to preserve data history.","لا يمكن نقل دورة مرتبطة بسجلات تشغيلية إلى مزرعة/عنبر آخر. حافظ على تاريخها وأنشئ دورة جديدة عند الحاجة.":"A cycle linked to operational records cannot be moved to another farm/house. Preserve its history and create a new cycle when needed.","تم تحديث بيانات المزرعة":"Farm data updated","تم حفظ بيانات المزرعة":"Farm data saved","تم تحديث بيانات العنبر":"House data updated","تم حفظ بيانات العنبر":"House data saved","تم حفظ الدورة وربطها بالعنبر بنجاح":"Cycle saved and linked to the house successfully","يوجد سجل متابعة لهذا التاريخ بالفعل؛ استخدم تعديل السجل الموجود.":"A monitoring record already exists for this date; edit the existing record.","لم يتم العثور على سجل المتابعة.":"Monitoring record not found.","تم حفظ المتابعة اليومية":"Daily monitoring record saved","تم حفظ الوزن":"Weight saved","تم حفظ عملية البيع/الحصاد":"Sale/harvest saved","تم استيراد النسخة":"Backup imported","ملف النسخة غير صالح":"Invalid backup file","تم قبول الدعوة وإضافة المزرعة إلى حسابك.":"Invitation accepted and farm added to your account.","تم حفظ صلاحية الموظف على هذه المزرعة.":"Employee permission saved for this farm.","تم إنشاء الدعوة.":"Invitation created.","تم حفظ معيار الأداء.":"Performance standard saved.","لا توجد بيانات ضمن النطاق.":"No data in the selected scope.","لا توجد سجلات مالية ضمن النطاق.":"No financial records in the selected scope.","لا توجد مبيعات مسجلة.":"No sales recorded.","لا يوجد مخزون ضمن النطاق.":"No inventory in the selected scope.","لا توجد دورات ضمن النطاق المحدد.":"No cycles in the selected scope.","لا توجد دورات.":"No cycles.","لا توجد مزارع.":"No farms.","لا توجد عنابر.":"No houses.","لا توجد بيانات.":"No data.","لا توجد أوزان.":"No weights.","لا توجد حركات.":"No movements.","لا توجد معايير.":"No standards.","حذف السجل؟":"Delete this record?","حذف السجل المالي لهذه الدورة؟":"Delete the financial record for this cycle?","حذف معيار الأداء؟":"Delete this performance standard?","لا يمكن حذف عنبر لديه دورة نشطة.":"A house with an active cycle cannot be deleted.","لا يمكن إعادة فتح الدورة لأن العنبر لديه دورة نشطة بالفعل.":"The cycle cannot be reopened because the house already has an active cycle.","أدخل السلالة.":"Enter the breed.","أدخل وزنين أو أكثر لحساب SD الحقيقي تلقائيًا.":"Enter at least two weights to calculate the true SD automatically.","أدخل أوزان طائرين على الأقل لحساب SD الحقيقي تلقائيًا.":"Enter weights for at least two birds to calculate the true SD automatically.","السجل القديم لا يحتوي أوزان الأفراد؛ أدخلها لحساب SD الحقيقي.":"The old record has no individual weights; enter them to calculate the true SD.","في وضع التعديل يجب اختيار دورة واحدة فقط.":"Edit mode requires selecting exactly one cycle.","لم يتم العثور على الدورات المحددة.":"No selected cycles were found.","تم حفظ البيانات المالية":"Financial data saved","تم حذف السجل المالي":"Financial record deleted","النطاق المحدد":"Selected Scope","نطاق العلف:":"Feed Scope:","نطاق الأدوية والتحصينات:":"Medication/Vaccination Scope:","نطاق المخزون:":"Inventory Scope:","نطاق سجل التكاليف والأرباح:":"Costs & Profit Scope:","نطاق الأداء:":"Performance Scope:","نطاق المقارنة:":"Comparison Scope:","عبر المزارع المتاحة":"Across Available Farms","بدون مزرعة":"No Farm","طباعة / حفظ كـ PDF":"Print / Save as PDF","الوزن المرجعي التلقائي":"Automatic reference weight","لا يوجد وزن مرجعي قبل تاريخ البيع؛ أدخل متوسط وزن البيع.":"No reference weight exists before the sale date; enter the average sale weight.","الحي المتاح في":"Available live birds on","أدخل الدورة وعدد الطيور. عدد الطيور إلزامي لضمان دقة الحي الحالي.":"Enter the cycle and bird count. Bird count is required to keep current live birds accurate.","أدخل كمية البيع بالكيلو.":"Enter the sale quantity in kilograms.","أدخل متوسط وزن الطائر عند البيع بالكيلو؛ يمكن تعديل القيمة التلقائية.":"Enter the average bird sale weight in kg; the automatic value can be edited.","تم حفظ العملية":"Transaction saved","كلما انخفض CV كان تجانس القطيع أفضل.":"Lower CV means better flock uniformity.","حالة CV":"CV status","تقييم CV":"CV assessment","ضمن المعيار":"Within standard","يحتاج مراجعة":"Needs review","المخزون منخفض":"Low inventory","لا يوجد وزن مسجل للدورة":"No weight recorded for cycle","تأخر الوزن الأسبوعي في":"Weekly weighing is overdue in","CV مرتفع للمراجعة في":"High CV — review in","FCR مرتفع للمراجعة في":"High FCR — review in","النفوق المسجل يتجاوز عدد الاستقبال في":"Recorded mortality exceeds placement birds in","الحي الحالي أصبح سالبًا في":"Current live birds became negative in","يوجد أكثر من دورة نشطة على العنبر":"More than one active cycle exists on house","يجب تصحيح البيانات.":"Data correction is required.","تأكيد كلمة المرور غير مطابق.":"Password confirmation does not match.","أدخل البريد الإلكتروني وكلمة المرور.":"Enter email and password.","البريد الإلكتروني أو كلمة المرور غير صحيحة.":"Email or password is incorrect.","حدث خطأ أثناء تسجيل الدخول. افتح الصفحة مرة أخرى وحاول.":"An error occurred during login. Reload the page and try again.","أدخل الاسم الكامل.":"Enter your full name.","أدخل بريدًا إلكترونيًا صحيحًا.":"Enter a valid email address.","كلمة المرور يجب أن تكون 6 أحرف على الأقل.":"Password must be at least 6 characters.","هذا البريد مسجل بالفعل. اختر تسجيل الدخول.":"This email is already registered. Choose Login.","جارٍ إنشاء الحساب...":"Creating account...","جارٍ تسجيل الدخول...":"Signing in...","جارٍ التنفيذ...":"Processing...","تم إنشاء الحساب. تحقق من بريدك الإلكتروني ثم سجّل الدخول.":"Account created. Check your email, then sign in.","حدث خطأ أثناء إنشاء الحساب. حاول مرة أخرى.":"An error occurred while creating the account. Please try again.","تسجيل الدخول":"Sign In","إنشاء الحساب":"Create Account","لدي حساب بالفعل":"I already have an account","استعادة كلمة المرور":"Reset Password","استعادة كلمة المرور إلى بريدك الإلكتروني":"Reset password by email","أدخل كلمة مرور جديدة لحسابك.":"Enter a new password for your account.","كلمة المرور الجديدة (6 أحرف على الأقل)":"New Password (at least 6 characters)","تأكيد كلمة المرور":"Confirm Password","حفظ كلمة المرور":"Save Password","تأكيد كلمة المرور الجديدة":"Confirm New Password","اكتب بريدك الإلكتروني أولًا ثم اضغط استعادة كلمة المرور.":"Enter your email first, then click Reset Password.","تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني.":"A password reset link has been sent to your email.","لا يوجد حساب محلي بهذا البريد.":"No local account exists for this email.","الحساب المحلي التجريبي لا يرسل بريدًا. استخدم Supabase في V3.3 لتفعيل الاستعادة الفعلية عبر البريد.":"The demo local account does not send email. Connect Supabase to enable real email reset.","تم تغيير كلمة المرور بنجاح.":"Password changed successfully.","تعذر تحميل أعضاء المزرعة.":"Failed to load farm members.","أدخل بريد الموظف واختر المزرعة.":"Enter the employee email and select the farm.","اربط Supabase أولًا لإنشاء دعوة مركزية.":"Connect Supabase first to create a central invitation.","أدخل بريدًا صحيحًا واختر المزرعة.":"Enter a valid email and select a farm.","إنشاء حساب جديد":"Create New Account","اسم الشركة":"Company Name","مثال: 1450, 1510, 1480, 1550, 1490 أو كل وزن في سطر مستقل":"Example: 1450, 1510, 1480, 1550, 1490 or one weight per line","بادئ / نامي / ناهي":"Starter / Grower / Finisher","علف / دواء / مطهر...":"Feed / Medication / Disinfectant...","كجم / لتر / عبوة":"kg / liter / pack","الريال السعودي":"Saudi Riyal","الجنيه المصري":"Egyptian Pound","الدولار الأمريكي":"US Dollar","الدرهم الإماراتي":"UAE Dirham","الدينار الكويتي":"Kuwaiti Dinar","الريال القطري":"Qatari Riyal","الريال العماني":"Omani Rial","الدينار البحريني":"Bahraini Dinar","اليورو":"Euro","الريال السعودي (SAR)":"Saudi Riyal (SAR)","الجنيه المصري (EGP)":"Egyptian Pound (EGP)","الدولار الأمريكي (USD)":"US Dollar (USD)","الدرهم الإماراتي (AED)":"UAE Dirham (AED)","الدينار الكويتي (KWD)":"Kuwaiti Dinar (KWD)","الريال القطري (QAR)":"Qatari Riyal (QAR)","الريال العماني (OMR)":"Omani Rial (OMR)","الدينار البحريني (BHD)":"Bahraini Dinar (BHD)","اليورو (EUR)":"Euro (EUR)","خطاب1":"خطاب1","خطاب 2":"خطاب 2","تم حفظ سجل المخزون":"Inventory record saved","العملة المختارة:":"Selected currency:","عملة المشروع الحالية:":"Current project currency:","— اضغط «حفظ عملة المشروع» لتثبيتها على المشروع بالكامل. لا يوجد تحويل لسعر الصرف.":"— Click “Save Project Currency” to apply it to the whole project. No exchange-rate conversion is performed.","تم حذف معيار الأداء":"Performance standard deleted","تم حفظ البيانات المالية — المبيعات الفعلية":"Financial data saved — actual sales","أضف دورة لعرض التقرير.":"Add a cycle to view the report.","لا توجد بيانات نفوق يومية مسجلة لهذه الدورة.":"No daily mortality data is recorded for this cycle.","نسخ رابط الدعوة":"Copy Invitation Link","خروج":"Logout","تقييم المؤشرات:":"Indicator assessment:","يوجد وزن مسجل لهذه الدورة في نفس التاريخ. استخدم تعديل السجل الموجود.":"A weight record already exists for this cycle on the same date; edit the existing record.","تقييم بالمعيار:":"Standard assessment:","كلمة المرور":"Password","الاسم الكامل":"Full Name","البريد الإلكتروني":"Email Address","كلمة المرور (6 أحرف على الأقل)":"Password (at least 6 characters)","أدخل اسم المزرعة واسم الشركة ورقم الترخيص":"Enter farm name, company name, and license number.","اختر دورة واحدة على الأقل وأكمل بيانات الدواء/التحصين":"Select at least one cycle and complete the medication/vaccination data.","اختر دورة واحدة على الأقل وأكمل بيانات العلف":"Select at least one cycle and complete the feed data.","اكتب الاسم الكامل.":"Enter your full name.","توجد مزرعة أخرى بنفس الاسم ورقم الترخيص.":"Another farm has the same name and license number.","تم حفظ عملة المشروع:":"Project currency saved:","عمر":"Age","عمل":"Action","🌐 لغة الواجهة":"🌐 Interface Language"};
function uiLanguage(){const l=localStorage.getItem(LANG_KEY)||db.settings?.language||'ar';return UI_LANGS[l]?l:'ar'}
function uiText(ar){return uiLanguage()==='en'?(UI_EN[ar]||ar):ar}
function uiTranslateText(text){
  const raw=String(text??''); if(!raw)return raw;
  if(uiLanguage()==='ar')return raw;
  const src=raw.trim();
  if(Object.prototype.hasOwnProperty.call(UI_EN,src)) return raw.replace(src,UI_EN[src]);
  const rules=[
    [/^(\d+) دورة$/,'$1 cycle(s)'],
    [/^(\d+) طائر$/,'$1 birds'],
    [/^(\d+) يوم$/,'$1 days'],
    [/^(\d+(?:\.\d+)?) جم$/,'$1 g'],
    [/^(\d+(?:\.\d+)?) جم\/طائر\/يوم$/,'$1 g/bird/day'],
    [/^(\d+(?:\.\d+)?) كجم$/,'$1 kg'],
    [/^(\d+(?:\.\d+)?) كجم\/طائر$/,'$1 kg/bird'],
    [/^(.+) — كل العنابر$/,'$1 — All Houses'],
    [/^(.+) — عبر المزارع المتاحة$/,'$1 — Across Available Farms'],
    [/^(.+) — نشطة$/,'$1 — Active'],
    [/^دورة نشطة: (.+)$/,'Active cycle: $1'],
    [/^(.+) — $/,'$1 — '],
    [/^تم حفظ (\d+) سجل علف بنجاح\.$/,'$1 feed record(s) saved successfully.'],
    [/^تم حفظ (\d+) سجل دواء\/تحصين بنجاح\.$/,'$1 medication/vaccination record(s) saved successfully.'],
    [/^الحي المتاح في (.+): (.+) طائر$/,'Available live birds on $1: $2 birds'],
    [/^الوزن المرجعي التلقائي بتاريخ (.+): (.+) كجم\/طائر — يمكنك تعديله\.$/,'Automatic reference weight on $1: $2 kg/bird — editable.'],
    [/^تم حفظ عملية البيع\/الحصاد — الإيراد (.+)$/,'Sale/harvest saved — revenue $1'],
    [/^تم حفظ البيانات المالية — المبيعات الفعلية (.+)$/,'Financial data saved — actual sales $1'],
    [/^تم حفظ الوزن — SD (.+) كجم — CV (.+)%$/,'Weight saved — SD $1 kg — CV $2%'],
    [/^تم الحساب تلقائيًا: SD = (.+) كجم — CV = (.+)%$/,'Calculated automatically: SD = $1 kg — CV = $2%'],
    [/^توجد مزرعة أخرى بنفس الاسم ورقم الترخيص\.$/,'Another farm has the same name and license number.'],
    [/^هذا البريد مسجل بالفعل\. اختر تسجيل الدخول\.$/,'This email is already registered. Choose Login.'],
    [/^يوجد سجل متابعة لهذا التاريخ بالفعل؛ استخدم تعديل السجل الموجود\.$/,'A monitoring record already exists for this date; edit the existing record.'],
    [/^سيتم تسجيل نفس العلف على (\d+) دورات\. هل تريد المتابعة؟$/,'The same feed will be recorded on $1 cycles. Continue?'],
    [/^سيتم تسجيل نفس الدواء\/التحصين على (\d+) دورات\. هل تريد المتابعة؟$/,'The same medication/vaccination will be recorded on $1 cycles. Continue?'],
    [/^عدد الطيور للبيع \((.+)\) أكبر من الحي المتاح حاليًا \((.+)\)\.$/,'Birds for sale ($1) exceed current live birds ($2).'],
    [/^البيانات ستتجاوز عدد الاستقبال\. المتاح بعد المبيعات الحالية: (.+) طائر\.$/,'The data would exceed the placement count. Available after current sales: $1 birds.'],
    [/^المخزون منخفض: (.+)$/,'Low inventory: $1'],
    [/^لا يوجد وزن مسجل للدورة (.+) \/ (.+)\.$/,'No weight recorded for cycle $1 / $2.'],
    [/^تأخر الوزن الأسبوعي في (.+) \/ (.+)\.$/,'Weekly weighing is overdue in $1 / $2.'],
    [/^CV مرتفع للمراجعة في (.+) \/ (.+): (.+)\.$/,'High CV — review in $1 / $2: $3.'],
    [/^FCR مرتفع للمراجعة في (.+) \/ (.+): (.+)\.$/,'High FCR — review in $1 / $2: $3.'],
    [/^النفوق المسجل يتجاوز عدد الاستقبال في (.+) \/ (.+) — راجع الإدخالات\.$/,'Recorded mortality exceeds placement birds in $1 / $2 — review entries.'],
    [/^الحي الحالي أصبح سالبًا في (.+) \/ (.+) — راجع المبيعات والنفوق\.$/,'Current live birds became negative in $1 / $2 — review sales and mortality.'],
    [/^يوجد أكثر من دورة نشطة على العنبر (.+) — يجب تصحيح البيانات\.$/,'More than one active cycle exists on house $1 — data correction is required.'],
    [/^تم حفظ عملة المشروع:\s*(.+)$/,'Project currency saved: $1'],
    [/^تقييم (.+): (.+) — (.+)$/,'Assessment $1: $2 — $3'],
    [/^نطاق (.+):$/,'$1 Scope:'],
    [/^\s*(.+) خروج$/,'$1 Logout'],
  ];
  for(const [re,rep] of rules){if(re.test(raw))return raw.replace(re,rep)}
  return raw;
}
const originalTextNodes=new WeakMap();
const originalAttrs=new WeakMap();
let i18nBusy=false;
function translateElement(el){
  if(!el||el.nodeType!==1||['SCRIPT','STYLE'].includes(el.tagName))return;
  for(const attr of ['placeholder','title','aria-label']){
    if(!el.hasAttribute(attr))continue;
    let m=originalAttrs.get(el);if(!m){m={};originalAttrs.set(el,m)}
    if(m[attr]===undefined)m[attr]=el.getAttribute(attr);
    el.setAttribute(attr,uiTranslateText(m[attr]));
  }
}
function translateDOM(){
  if(i18nBusy)return;
  i18nBusy=true;
  try{
    if(uiLanguage()==='ar')return;
    const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    const nodes=[];let n;while((n=walker.nextNode()))nodes.push(n);
    for(const node of nodes){
      const parent=node.parentElement;if(!parent||['SCRIPT','STYLE'].includes(parent.tagName))continue;
      if(parent.closest('input,textarea'))continue;
      if(!originalTextNodes.has(node))originalTextNodes.set(node,node.nodeValue);
      const src=originalTextNodes.get(node);
      node.nodeValue=uiTranslateText(src);
    }
    document.querySelectorAll('input,textarea,select,button,[title],[aria-label],[placeholder]').forEach(translateElement);
    const title='Poultry Farm Manager V3.6.7 — Production Control & Farm Intelligence';
    document.title=title;
  }finally{i18nBusy=false}
}
let i18nObserverStarted=false;
const i18nObserver=new MutationObserver(()=>{if(uiLanguage()==='en')translateDOM()});
function startI18nObserver(){if(!document.body||i18nObserverStarted)return;i18nObserverStarted=true;i18nObserver.observe(document.body,{subtree:true,childList:true,characterData:true})}
function applyNavLanguage(l){
  const ar=['الرئيسية','المزارع','العنابر','الدورات','المتابعة','الأوزان الأسبوعية','الأعلاف','الأدوية والتحصينات','المخزون','المبيعات والحصاد','التكاليف والأرباح','أداء العنابر','مقارنة الدورات','التقارير','المستخدمون والصلاحيات','الإعدادات والمعايير','سجل التدقيق','النسخ الاحتياطي'];
  document.querySelectorAll('nav button').forEach((b,i)=>{if(i<ar.length)b.textContent=uiText(ar[i])});
}
function setLanguage(lang){
  const l=UI_LANGS[lang]?lang:'ar';
  document.documentElement.lang=l;
  document.documentElement.dir=UI_LANGS[l].dir;
  localStorage.setItem(LANG_KEY,l);
  db.settings={...(db.settings||{}),language:l};
  const sel=document.getElementById('languageSelect'),sel2=document.getElementById('settingsLanguage'),sel3=document.getElementById('authLanguageSelect');
  if(sel)sel.value=l;if(sel2)sel2.value=l;if(sel3)sel3.value=l;
  applyNavLanguage(l);startI18nObserver();translateDOM();persistLocal();
}
function initLanguage(){const l=localStorage.getItem(LANG_KEY)||db.settings?.language||'ar';setLanguage(UI_LANGS[l]?l:'ar')}
const nativeAlert=window.alert.bind(window),nativeConfirm=window.confirm.bind(window);
window.alert=(msg)=>nativeAlert(uiTranslateText(msg));
window.confirm=(msg)=>nativeConfirm(uiTranslateText(msg));
function roleLabel(role){const r=String(role||'');return (uiLanguage()==='en'?{owner:'Owner',manager:'Farm Manager',supervisor:'Supervisor',worker:'Worker'}:{owner:'مالك',manager:'مدير مزرعة',supervisor:'مشرف',worker:'عامل'})[r]||r}
function applyProjectCurrency(nextCurrency,{persist=true,showAlert=false}={}){
  if(!can('settings')){alert('تغيير العملة متاح للمالك الرئيسي فقط.');return false;}
  const cur=currencyCode(nextCurrency),old=currencyCode(db.settings?.currency||'SAR');
  db.settings={...(db.settings||{}),currency:cur,updatedAt:new Date().toISOString()};
  // العملة على مستوى المشروع فقط: لا يوجد تحويل لقيم المبالغ.
  db.cycles.forEach(c=>c.currency=cur);
  db.feed.forEach(x=>x.currency=cur);
  db.meds.forEach(x=>x.currency=cur);
  db.sales.forEach(x=>x.currency=cur);
  Object.values(db.finance||{}).forEach(x=>x.currency=cur);
  if(old!==cur){
    db.auditLog.unshift({id:uuid(),userId:currentUser?.id||null,userName:currentUser?.name||currentUser?.email||'',farmId:null,action:'settings',entity:'currency',recordId:null,details:{from:old,to:cur,scope:'project-wide'},createdAt:new Date().toISOString()});
  }
  if(persist)persistLocal();
  updateCurrencyUI();
  updateCurrencyLabels();
  if(finFarm?.value)fillFinanceCycle(); else renderFinance();
  if(showAlert)alert('تم حفظ عملة المشروع: '+currencyLabel(cur));
  if(supabaseClient&&currentUser){clearTimeout(syncTimer);syncTimer=setTimeout(()=>syncNow(),150)}
  return true;
}
function saveGlobalCurrency(){
  const select=document.getElementById('globalCurrency');
  const selected=select?.value||'SAR';
  if(!applyProjectCurrency(selected,{persist:true,showAlert:true}))return;
  renderAll();
}
function previewGlobalCurrency(){
  const select=document.getElementById('globalCurrency');
  if(!select)return;
  const cur=currencyCode(select.value);
  const note=document.getElementById('currencyLockNote');
  if(note)note.textContent='العملة المختارة: '+currencyLabel(cur)+' — اضغط «حفظ عملة المشروع» لتثبيتها على المشروع بالكامل. لا يوجد تحويل لسعر الصرف.';
}
function updateCurrencyUI(){
  const cur=currencyCode(db.settings?.currency||'SAR');
  const gc=document.getElementById('globalCurrency');if(gc)gc.value=cur;
  const cc=document.getElementById('cycleCurrency');if(cc)cc.value=cur;
  const fc=document.getElementById('finCurrency');if(fc)fc.value=cur;
  if(dashboardCurrency)dashboardCurrency.textContent=currencyLabel(cur);
  if(dashboardCurrency2)dashboardCurrency2.textContent=cur;
  if(dashboardCurrency3)dashboardCurrency3.textContent=cur;
  if(currencyLockNote)currencyLockNote.textContent='عملة المشروع الحالية: '+currencyLabel(cur)+' — هذه العملة هي المرجع الوحيد لكل المعاملات والتقارير. يمكنك تغييرها في أي وقت، ولا يوجد تحويل لسعر الصرف.';
}
function updateCurrencyLabels(){
  const feedId=[...(document.getElementById('feedCycle')?.selectedOptions||[])].map(o=>o.value).find(Boolean)||'';
  const medId=[...(document.getElementById('medCycle')?.selectedOptions||[])].map(o=>o.value).find(Boolean)||'';
  const saleId=document.getElementById('saleCycle')?.value||'';
  const c=cyc(feedId||medId||saleId);
  const cur=getCycleCurrency(c);
  ['feedCurrencyLabel','medCurrencyLabel','saleCurrencyLabel'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent=`(${cur})`});
  const finCur=document.getElementById('finCurrency'); if(finCur&&c)finCur.value=getCycleCurrency(c);
}
function audit(action,entity,recordId,details={}){if(!currentUser)return;const c=recordId?db.cycles.find(x=>x.id===recordId):null;const farmId=details.farmId||c?.farmId||null;db.auditLog.unshift({id:uuid(),userId:currentUser.id,userName:currentUser.name||currentUser.email||'',farmId,action,entity,recordId:recordId||null,details,createdAt:new Date().toISOString()});if(db.auditLog.length>1000)db.auditLog.length=1000}
function cvAssessment(cv){const v=+cv||0;if(v<=8)return {label:'ممتاز — تجانس عالٍ',cls:'success'};if(v<=10)return {label:'جيد — تجانس مقبول',cls:'success'};if(v<=12)return {label:'متوسط — يحتاج متابعة',cls:'warning'};return {label:'ضعيف — تباين مرتفع',cls:'danger'}}
function cvBadge(cv){const a=cvAssessment(cv);return `<span class="badge ${a.cls}">${a.label}</span>`}
function metricAssessment(metric,value,c){
  const v=+value||0;if(v<=0)return null;
  const r=performanceRuleFor(c);
  let target=0,better='higher',label=metric;
  if(metric==='fcr'){target=+(r?.targetFcr||0);better='lower';label='FCR';}
  else if(metric==='adg'){target=+(r?.targetAdg||0);better='higher';label='ADG';}
  else if(metric==='epef'){target=+(r?.minEpef||0);better='higher';label='EPEF / EPI';}
  else if(metric==='pi'){target=+(r?.minPi||0);if(target<=0&&r?.minEpef>0)target=+r.minEpef*Math.max(1,age(c));better='higher';label='PI';}
  if(target<=0){
    if(metric==='fcr')target=1.50;
    else if(metric==='adg')target=60;
    else if(metric==='epef')target=400;
    else if(metric==='pi')target=150;
  }
  const a=better==='lower'
    ?(v<=target?{label:'ممتاز',cls:'success'}:v<=target*1.07?{label:'جيد',cls:'warning'}:{label:'ضعيف',cls:'danger'})
    :(v>=target?{label:'ممتاز',cls:'success'}:v>=target*0.93?{label:'جيد',cls:'warning'}:{label:'ضعيف',cls:'danger'});
  return {...a,metric:label,target,source:r?'معيار السلالة/العمر':'المعيار التشغيلي الافتراضي'};
}
function metricBadge(metric,value,c){const a=metricAssessment(metric,value,c);return a?`<span class="badge ${a.cls}">${a.label}</span>`:'<span class="badge">غير متاح</span>'}
const saveFormFinance=()=>{const cycleId=finCycle.value;if(!cycleId)return false;const c=cyc(cycleId);if(!c)return false;const old=db.finance[cycleId]||{};const cur=getCycleCurrency(c);const actualSales=calc(c).saleRevenue;const expenses=financeExpensesForCycle(cycleId).filter(x=>(+x.amount||0)>0).map(x=>({...x,amount:+x.amount||0,updatedAt:new Date().toISOString()}));const legacy=financeLegacyTotals(expenses);db.finance[cycleId]={id:old.id||uuid(),chicks:+costChicks.value||0,labor:legacy.labor,utilities:legacy.utilities,transport:legacy.transport,other:legacy.other,expenses,salePrice:actualSales,currency:cur,otherRevenue:+otherRevenue.value||0,updatedAt:new Date().toISOString()};financeDraftExpenses[cycleId]=expenses;finSalePrice.value=actualSales.toFixed(2);return true};
function show(id,btn){document.querySelectorAll('.view').forEach(x=>x.classList.remove('active'));document.getElementById(id).classList.add('active');document.querySelectorAll('nav button').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');renderAll()}
function opts(sel,all=true){if(!sel)return;const old=sel.value;sel.innerHTML=db.cycles.map(c=>`<option value="${c.id}">${esc(getFarmName(c.farmId))} — ${esc(getHouseName(c.houseId))} — ${c.date}${c.breed?' — '+esc(c.breed):''}</option>`).join('');if(old&&[...sel.options].some(o=>o.value===old))sel.value=old;}
let editState={type:null,id:null};
function setEditUI(type,editing){
  const map={farm:'Farm',house:'House',cycle:'Cycle',daily:'Daily',weight:'Weight',feed:'Feed',med:'Med',inventory:'Inventory',sale:'Sale'};
  const n=map[type]; if(!n)return;
  const b=document.getElementById(type+'SaveBtn'); const c=document.getElementById(type+'CancelBtn');
  if(b)b.textContent=editing?'تحديث السجل':(type==='cycle'?'بدء دورة':type==='farm'?'إضافة مزرعة':type==='house'?'إضافة عنبر':type==='daily'?'حفظ المتابعة':type==='weight'?'حفظ الوزن':type==='feed'?'تسجيل علف':type==='med'?'حفظ':type==='inventory'?'إضافة/تحديث الصنف':'تسجيل البيع');
  if(c)c.style.display=editing?'':'none';
}
function clearEdit(){editState={type:null,id:null};['farm','house','cycle','daily','weight','feed','med','inventory','sale'].forEach(t=>setEditUI(t,false));}
function cancelEdit(){clearEdit();renderAll();}
function beginEdit(type,id){
  const key=type==='weight'?'weights':type==='med'?'meds':type==='inventory'?'inventory':type==='sale'?'sales':type;
  const r=db[key]?.find(v=>v.id===id);if(!r)return alert('السجل المطلوب غير موجود.');
  const farmId=getFarmForRecord(type,r);if(!requireActionForRecord('edit',type,farmId))return;
  editState={type,id,snapshot:JSON.parse(JSON.stringify(r))};setEditUI(type,true);
  const views={farm:'farms',house:'houses',cycle:'cycles',daily:'daily',weight:'weights',feed:'feed',med:'meds',inventory:'inventory',sale:'sales'};
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));const target=document.getElementById(views[type]);if(target)target.classList.add('active');
  document.querySelectorAll('nav button').forEach(v=>v.classList.remove('active'));const nav=[...document.querySelectorAll('nav button')].find(v=>(v.getAttribute('onclick')||'').includes(`show('${views[type]}'`));if(nav)nav.classList.add('active');
  if(type==='farm'){farmName.value=r.name||'';farmCompany.value=r.companyName||'';farmLicense.value=r.licenseNumber||'';farmOwner.value=r.owner||'';farmManager.value=r.manager||'';farmLocation.value=r.location||'';}
  if(type==='house'){houseFarm.value=r.farmId||'';houseName.value=r.name||'';houseCapacity.value=r.capacity??'';}
  if(type==='cycle'){cycleFarm.value=r.farmId||'';fillHouseSelect();cycleHouse.value=r.houseId||'';cycleDate.value=r.date||'';cycleBirds.value=r.birds||'';cycleInitWeight.value=((+r.initWeight||0)*1000)||'';populateCycleBreedOptions(r.breed||'');cycleSource.value=r.source||'';cycleCurrency.value=getCycleCurrency(r);}
  if(type==='daily'){dailyCycle.value=r.cycleId||'';dailyDate.value=r.date||'';dailyDead.value=r.dead||0;dailyCull.value=r.cull||0;dailyFeed.value=r.feed||0;dailyWater.value=r.water||0;dailyWeight.value=r.weight||0;dailyTemp.value=r.temp||0;dailyHumidity.value=r.humidity||0;dailyNotes.value=r.notes||'';}
  if(type==='weight'){weightCycle.value=r.cycleId||'';weightDate.value=r.date||'';weightSample.value=r.sample||'';weightTotal.value=r.total||'';weightMin.value=r.min||'';weightMax.value=r.max||'';weightSampleWeights.value=(r.sampleWeights||[]).map(v=>(+v*1000).toFixed(0)).join(', ');weightSD.value=r.sd??'';updateWeightStatsFromSample();if(!r.sampleWeights?.length&&weightCalcStatus)weightCalcStatus.textContent='السجل القديم لا يحتوي أوزان الأفراد؛ أدخلها لحساب SD الحقيقي.';}
  if(type==='feed'){feedFarmFilter.value=r?getFarmForRecord('feed',r)||'':'';updateFeedScope(true);selectSingleOption(feedCycle,r.cycleId||'');feedDate.value=r.date||'';feedType.value=r.type||'';feedQty.value=r.qty||'';feedPrice.value=r.price||'';}
  if(type==='med'){medFarmFilter.value=r?getFarmForRecord('meds',r)||'':'';updateMedScope(true);selectSingleOption(medCycle,r.cycleId||'');medDate.value=r.date||'';medType.value=r.type||'دواء';medName.value=r.name||'';medQty.value=r.qty||'';medCost.value=r.cost||'';medDose.value=r.dose||'';medWithdrawal.value=r.withdrawal||0;}
  if(type==='inventory'){invFarm.value=r.farmId||'';invItem.value=r.item||'';invUnit.value=r.unit||'';invOpening.value=r.balance||0;invMin.value=r.min||0;invIn.value=0;invOut.value=0;}
  if(type==='sale'){saleCycle.value=r.cycleId||'';saleDate.value=r.date||'';saleBirds.value=r.birds||0;saleWeightUnit.value=r.weightUnit||'kg';saleWeight.value=(r.weightQty??(r.weightUnit==='bird'?r.birds:r.weightKg))||'';saleAvgWeight.value=Number(r.avgWeight||0)>0?(+r.avgWeight).toFixed(3):'';salePrice.value=r.price||'';saleBuyer.value=r.buyer||'';updateSaleWeightUnitUI();}
  updateCurrencyLabels();window.scrollTo({top:0,behavior:'smooth'});
}
function addFarm(){
  const editing=editState.type==='farm',existing=editing?db.farms.find(x=>x.id===editState.id):null;if(editing){if(!existing||!requirePermission('edit',existing.id))return;}else if(!can('settings'))return alert('إنشاء مزرعة جديدة متاح للمالك الرئيسي فقط.');
  const n=farmName.value.trim(),company=farmCompany.value.trim(),license=farmLicense.value.trim();if(!n||!company||!license)return alert('أدخل اسم المزرعة واسم الشركة ورقم الترخيص');
  const duplicate=db.farms.find(x=>x.id!==(existing?.id||'')&&x.name.trim().toLowerCase()===n.toLowerCase()&&x.licenseNumber===license);if(duplicate)return alert('توجد مزرعة أخرى بنفس الاسم ورقم الترخيص.');
  if(editing)Object.assign(existing,{name:n,companyName:company,licenseNumber:license,owner:farmOwner.value.trim(),manager:farmManager.value.trim(),location:farmLocation.value.trim(),updatedAt:new Date().toISOString()});
  else db.farms.push({id:uuid(),ownerId:currentUser?.id||null,name:n,companyName:company,licenseNumber:license,owner:farmOwner.value.trim(),manager:farmManager.value.trim(),location:farmLocation.value.trim(),updatedAt:new Date().toISOString()});
  ['farmName','farmCompany','farmLicense','farmOwner','farmManager','farmLocation'].forEach(x=>document.getElementById(x).value='');audit(editing?'update':'create','farm',existing?.id||db.farms.at(-1)?.id,{farmId:existing?.id||db.farms.at(-1)?.id,before:editState.snapshot||null,after:existing||db.farms.at(-1)});clearEdit();save();alert(editing?'تم تحديث بيانات المزرعة':'تم حفظ بيانات المزرعة');
}
function addHouse(){
  const editing=editState.type==='house',existing=editing?db.houses.find(x=>x.id===editState.id):null,farmId=houseFarm.value||existing?.farmId;if(!farmId||!requirePermission(editing?'edit':'create',farmId))return;if(!houseName.value.trim())return alert('أكمل بيانات العنبر');
  const name=houseName.value.trim(),duplicate=db.houses.find(x=>x.id!==(existing?.id||'')&&x.farmId===farmId&&x.name.trim().toLowerCase()===name.toLowerCase());if(duplicate)return alert('هذا العنبر موجود بالفعل في المزرعة.');
  if(editing){if(!existing)return alert('لم يتم العثور على العنبر.');if(existing.farmId!==farmId&&db.cycles.some(c=>c.houseId===existing.id))return alert('لا يمكن نقل عنبر مرتبط بدورات. أنشئ عنبرًا جديدًا للمزرعة الأخرى حفاظًا على تاريخ البيانات.');Object.assign(existing,{farmId,name,capacity:+houseCapacity.value||0,updatedAt:new Date().toISOString()});}else db.houses.push({id:uuid(),farmId,name,capacity:+houseCapacity.value||0,updatedAt:new Date().toISOString()});
  audit(editing?'update':'create','house',existing?.id||db.houses.at(-1)?.id,{farmId,before:editState.snapshot||null,after:existing||db.houses.at(-1)});houseName.value='';houseCapacity.value='';clearEdit();save();alert(editing?'تم تحديث بيانات العنبر':'تم حفظ بيانات العنبر');
}
function fillHouseSelect(){cycleHouse.innerHTML=db.houses.filter(h=>h.farmId===cycleFarm.value).map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join('')}
function addCycle(){
  const editing=editState.type==='cycle';
  if(!requireActionForRecord(editing?'edit':'create','cycle',editing?cyc(editState.id)?.farmId:cycleFarm.value))return;
  if(!cycleFarm.value||!cycleHouse.value||!cycleDate.value||!+cycleBirds.value)return alert('أكمل بيانات الدورة');
  const selectedBreed=cycleBreed.value==='__CUSTOM__'?(cycleBreedCustom.value||'').trim():cycleBreed.value.trim();if(!selectedBreed)return alert('اختر السلالة أو أدخل سلالة مخصصة.');const data={farmId:cycleFarm.value,houseId:cycleHouse.value,date:cycleDate.value,birds:Math.max(1,+cycleBirds.value),initWeight:(+cycleInitWeight.value||40)/1000,breed:selectedBreed,source:cycleSource.value.trim(),currency:currencyCode(db.settings?.currency||'SAR'),active:true,updatedAt:new Date().toISOString()};
  const existingActive=db.cycles.find(x=>x.id!==editState.id&&x.houseId===data.houseId&&x.active);
  if(existingActive&&data.active)return alert('هذا العنبر لديه دورة نشطة بالفعل. أنهِ الدورة الحالية أولًا ثم ابدأ دورة جديدة.');
  const duplicate=db.cycles.find(x=>x.id!==editState.id&&x.farmId===data.farmId&&x.houseId===data.houseId&&x.date===data.date);if(duplicate)return alert('توجد دورة بالفعل لهذا العنبر في نفس تاريخ الاستقبال.');
  if(editing){const r=cyc(editState.id);if(!r)return alert('لم يتم العثور على الدورة.');if((r.farmId!==data.farmId||r.houseId!==data.houseId)&&(['daily','weights','feed','meds','sales'].some(k=>db[k].some(x=>x.cycleId===r.id))))return alert('لا يمكن نقل دورة مرتبطة بسجلات تشغيلية إلى مزرعة/عنبر آخر. حافظ على تاريخها وأنشئ دورة جديدة عند الحاجة.');Object.assign(r,data)}
  else db.cycles.push({id:uuid(),...data})
  audit(editing?'update':'create','cycle',editing?editState.id:db.cycles.at(-1)?.id,{farmId:data.farmId,before:editState.snapshot||null,after:editing?cyc(editState.id):db.cycles.at(-1)});['cycleBirds','cycleSource'].forEach(x=>document.getElementById(x).value='');cycleBreed.value='';cycleBreedCustom.value='';cycleBreedCustom.style.display='none';clearEdit();save();alert('تم حفظ الدورة وربطها بالعنبر بنجاح');
}
function addDaily(){
  const editing=editState.type==='daily',old=editing?db.daily.find(x=>x.id===editState.id):null,farmId=cyc(dailyCycle.value)?.farmId;if(!requireActionForRecord(editing?'edit':'create','daily',farmId))return;if(!dailyCycle.value)return alert('اختر الدورة');
  const data={cycleId:dailyCycle.value,date:dailyDate.value||today(),dead:Math.max(0,+dailyDead.value||0),cull:Math.max(0,+dailyCull.value||0),feed:Math.max(0,+dailyFeed.value||0),water:Math.max(0,+dailyWater.value||0),weight:Math.max(0,+dailyWeight.value||0),temp:+dailyTemp.value||0,humidity:+dailyHumidity.value||0,notes:dailyNotes.value.trim(),updatedAt:new Date().toISOString()};
  const duplicate=db.daily.find(x=>x.id!==(old?.id||'')&&x.cycleId===data.cycleId&&x.date===data.date);if(duplicate)return alert('يوجد سجل متابعة لهذا التاريخ بالفعل؛ استخدم تعديل السجل الموجود.');
  const cNow=cyc(data.cycleId);const priorDead=deadTotal(cNow,data.date)-(+old?.dead||0),priorCull=cullTotal(cNow,data.date)-(+old?.cull||0),sold=soldBirdsAtDate(cNow,data.date);if((priorDead+data.dead)+(priorCull+data.cull)+sold>(+cNow?.birds||0))return alert(`البيانات ستتجاوز عدد الاستقبال. المتاح بعد المبيعات الحالية: ${Math.max(0,(+cNow?.birds||0)-priorDead-priorCull-sold)} طائر.`);
  if(editing){if(!old)return alert('لم يتم العثور على سجل المتابعة.');Object.assign(old,data)}else db.daily.push({id:uuid(),...data});
  audit(editing?'update':'create','daily',old?.id||db.daily.at(-1)?.id,{farmId,before:editState.snapshot||null,after:old||db.daily.at(-1)});['dailyDead','dailyCull','dailyFeed','dailyWater','dailyWeight','dailyTemp','dailyHumidity','dailyNotes'].forEach(x=>document.getElementById(x).value='');clearEdit();save();alert('تم حفظ المتابعة اليومية');
}
function parseSampleWeights(raw){
  return String(raw||'').split(/[,،;\s]+/).map(v=>v.trim()).filter(Boolean).map(v=>+v).filter(v=>Number.isFinite(v)&&v>0);
}
function sampleStats(raw){
  const grams=parseSampleWeights(raw); if(grams.length<2)return null;
  const kg=grams.map(g=>g/1000), n=kg.length, total=kg.reduce((a,b)=>a+b,0), avg=total/n;
  const variance=kg.reduce((s,v)=>s+Math.pow(v-avg,2),0)/(n-1);
  const sd=Math.sqrt(variance), min=Math.min(...kg), max=Math.max(...kg), cv=avg?sd/avg*100:0;
  return {sample:n,total,avg,min,max,sd,cv,weights:kg};
}
function updateWeightStatsFromSample(){
  const st=sampleStats(weightSampleWeights?.value||'');
  if(!st){ if(weightCalcStatus)weightCalcStatus.textContent='أدخل وزنين أو أكثر لحساب SD الحقيقي تلقائيًا.'; return; }
  weightSample.value=st.sample; weightTotal.value=st.total.toFixed(3); weightMin.value=st.min.toFixed(3); weightMax.value=st.max.toFixed(3); weightSD.value=st.sd.toFixed(3);
  if(weightCalcStatus)weightCalcStatus.textContent=`تم الحساب تلقائيًا: SD = ${st.sd.toFixed(3)} كجم — CV = ${st.cv.toFixed(2)}%`;if(cvStatus)cvStatus.innerHTML=`<b>تقييم CV:</b> ${cvBadge(st.cv)} <span class="muted">كلما انخفض CV كان تجانس القطيع أفضل.</span>`;
}
function addWeight(){
  const editing=editState.type==='weight';if(!requireActionForRecord(editing?'edit':'create','weight',editing?getFarmForRecord('weights',db.weights.find(x=>x.id===editState.id)):cyc(weightCycle.value)?.farmId))return;
  const c=weightCycle.value; if(!c)return alert('اختر الدورة');
  const st=sampleStats(weightSampleWeights.value);
  let sample=st?.sample||+weightSample.value||0,total=st?.total||+weightTotal.value||0,avg=st?.avg||(sample&&total?total/sample:0),min=st?.min||+weightMin.value||0,max=st?.max||+weightMax.value||0,sd=st?.sd||0,cv=st?.cv||((sd&&avg)?sd/avg*100:0);
  if(st){weightSample.value=sample;weightTotal.value=total.toFixed(3);weightMin.value=min.toFixed(3);weightMax.value=max.toFixed(3);weightSD.value=sd.toFixed(3)}
  if(!sample||!total||sample<2)return alert('أدخل أوزان طائرين على الأقل لحساب SD الحقيقي تلقائيًا.');
  const data={cycleId:c,date:weightDate.value||today(),sample,total,avg,min,max,sd,cv,cvMethod:st?'sample_sd':'manual',sampleWeights:st?st.weights:[],updatedAt:new Date().toISOString()};
  const target=editing?db.weights.find(x=>x.id===editState.id):db.weights.find(x=>x.cycleId===data.cycleId&&x.date===data.date);const duplicate=db.weights.find(x=>x.id!==(target?.id||'')&&x.cycleId===data.cycleId&&x.date===data.date);if(duplicate)return alert('يوجد وزن مسجل لهذه الدورة في نفس التاريخ. استخدم تعديل السجل الموجود.');if(target)Object.assign(target,data);else db.weights.push({id:uuid(),...data});
  audit(editing?'update':'create','weight',target?.id||db.weights.at(-1)?.id,{farmId:getFarmForRecord('weights',target||db.weights.at(-1)),before:editState.snapshot||null,after:target||db.weights.at(-1)});clearEdit();save();alert(`تم حفظ الوزن — SD ${sd.toFixed(3)} كجم — CV ${cv.toFixed(2)}%`);
}
function addFeed(){
  const editing=editState.type==='feed',ids=[...feedCycle.selectedOptions].map(o=>o.value).filter(Boolean);if(editing&&ids.length!==1)return alert('في وضع التعديل يجب اختيار دورة واحدة فقط.');if(!ids.length||!+feedQty.value)return alert('اختر دورة واحدة على الأقل وأكمل بيانات العلف');const cycles=ids.map(cyc).filter(Boolean);if(!cycles.length)return alert('لم يتم العثور على الدورات المحددة.');if(!editing&&cycles.length>1&&!confirm(`سيتم تسجيل نفس العلف على ${cycles.length} دورات. هل تريد المتابعة؟`))return;for(const c of cycles)if(!requireActionForRecord(editing?'edit':'create','feed',c.farmId))return;const date=feedDate.value||today(),type=feedType.value.trim(),qty=+feedQty.value,price=+feedPrice.value||0;let count=0;cycles.forEach(c=>{const cur=getCycleCurrency(c),data={cycleId:c.id,date,type,qty,price,currency:cur,updatedAt:new Date().toISOString()},target=editing?db.feed.find(x=>x.id===editState.id):db.feed.find(x=>x.cycleId===c.id&&x.date===date&&x.type===type);if(target){const before=JSON.parse(JSON.stringify(target));Object.assign(target,data);audit('update','feed',target.id,{farmId:c.farmId,before,after:target});}else{const rec={id:uuid(),...data};db.feed.push(rec);audit('create','feed',rec.id,{farmId:c.farmId,before:null,after:rec});}count++});['feedType','feedQty','feedPrice'].forEach(x=>document.getElementById(x).value='');if(editing)clearEdit();save();alert(`تم حفظ ${count} سجل علف بنجاح.`);
}
function addMed(){
  const editing=editState.type==='med',ids=[...medCycle.selectedOptions].map(o=>o.value).filter(Boolean);if(editing&&ids.length!==1)return alert('في وضع التعديل يجب اختيار دورة واحدة فقط.');if(!ids.length||!medName.value.trim())return alert('اختر دورة واحدة على الأقل وأكمل بيانات الدواء/التحصين');const cycles=ids.map(cyc).filter(Boolean);if(!cycles.length)return alert('لم يتم العثور على الدورات المحددة.');if(!editing&&cycles.length>1&&!confirm(`سيتم تسجيل نفس الدواء/التحصين على ${cycles.length} دورات. هل تريد المتابعة؟`))return;for(const c of cycles)if(!requireActionForRecord(editing?'edit':'create','med',c.farmId))return;const date=medDate.value||today(),type=medType.value,name=medName.value.trim(),qty=+medQty.value||0,cost=+medCost.value||0,dose=medDose.value.trim(),withdrawal=+medWithdrawal.value||0;let count=0;cycles.forEach(c=>{const cur=getCycleCurrency(c),data={cycleId:c.id,date,type,name,qty,cost,currency:cur,dose,withdrawal,updatedAt:new Date().toISOString()},target=editing?db.meds.find(x=>x.id===editState.id):null;if(target){const before=JSON.parse(JSON.stringify(target));Object.assign(target,data);audit('update','med',target.id,{farmId:c.farmId,before,after:target});}else{const rec={id:uuid(),...data};db.meds.push(rec);audit('create','med',rec.id,{farmId:c.farmId,before:null,after:rec});}count++});['medName','medQty','medCost','medDose','medWithdrawal'].forEach(x=>document.getElementById(x).value='');if(editing)clearEdit();save();alert(`تم حفظ ${count} سجل دواء/تحصين بنجاح.`);
}

function addInventory(){const farmId=editState.type==='inventory'?db.inventory.find(x=>x.id===editState.id)?.farmId:invFarm.value;if(!requirePermission(editState.type==='inventory'?'edit':'create',farmId))return;if(!invFarm.value||!invItem.value.trim())return alert('اختر المزرعة وأدخل اسم الصنف');if(editState.type==='inventory'){const r=db.inventory.find(x=>x.id===editState.id);Object.assign(r,{farmId:invFarm.value,item:invItem.value.trim(),unit:invUnit.value,min:+invMin.value||0,balance:(+invOpening.value||0)+(+invIn.value||0)-(+invOut.value||0),updatedAt:new Date().toISOString()});}else{let old=db.inventory.find(x=>x.farmId===invFarm.value&&x.item.toLowerCase()===invItem.value.trim().toLowerCase());if(old){old.balance=(+old.balance||0)+(+invIn.value||0)-(+invOut.value||0);old.min=+invMin.value||old.min;old.unit=invUnit.value||old.unit;old.updatedAt=new Date().toISOString()}else db.inventory.push({id:uuid(),farmId:invFarm.value,item:invItem.value.trim(),unit:invUnit.value,min:+invMin.value||0,balance:(+invOpening.value||0)+(+invIn.value||0)-(+invOut.value||0),updatedAt:new Date().toISOString()});}['invItem','invUnit','invOpening','invMin','invIn','invOut'].forEach(x=>document.getElementById(x).value='');audit(editState.type==='inventory'?'update':'create','inventory',editState.type==='inventory'?editState.id:db.inventory.at(-1)?.id,{farmId,before:editState.snapshot||null,after:db.inventory.find(x=>x.id===(editState.type==='inventory'?editState.id:db.inventory.at(-1)?.id))||db.inventory.at(-1)});clearEdit();save();alert('تم حفظ سجل المخزون')}
function refreshFinancialSnapshot(c){
  if(!c)return null;
  const x=calc(c),old=db.finance[c.id]||{};
  const expenses=financeExpensesForCycle(c.id);const legacy=financeLegacyTotals(expenses);db.finance[c.id]={...old,id:old.id||uuid(),chicks:+(old.chicks||0),labor:legacy.labor,utilities:legacy.utilities,transport:legacy.transport,other:legacy.other,expenses,salePrice:x.saleRevenue,currency:getCycleCurrency(c),otherRevenue:+(old.otherRevenue||0),actualSalesRevenue:x.saleRevenue,actualSoldBirds:x.soldBirds,actualSoldKg:x.soldKg,totalRevenue:x.rev,totalCost:x.cost,profitLoss:x.profit,computedAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
  return db.finance[c.id];
}
function saveFinance(){
  const c=cyc(finCycle.value);if(!c||!requirePermission('finance',c.farmId))return;
  const before=JSON.parse(JSON.stringify(db.finance[c.id]||{}));
  saveFormFinance();
  const z=calc(c),f=db.finance[c.id]||{};
  // Persist a transparent snapshot of actual sales in the financial record; the sales ledger remains the source of truth.
  Object.assign(f,{currency:getCycleCurrency(c),actualSalesRevenue:+z.saleRevenue||0,actualSoldBirds:+z.soldBirds||0,actualSoldKg:+z.soldKg||0,totalRevenue:+z.rev||0,totalCost:+z.cost||0,profitLoss:+z.profit||0,computedAt:new Date().toISOString()});
  db.finance[c.id]=f;
  audit('update','finance',c.id,{farmId:c.farmId,before,after:db.finance[c.id]});
  save();
  alert(`تم حفظ البيانات المالية — المبيعات الفعلية ${z.saleRevenue.toFixed(2)} ${getCycleCurrency(c)}`);
}
function calc(c){
  const dead=deadTotal(c),cul=cullTotal(c),sales=db.sales.filter(s=>s.cycleId===c.id&&isPastOrToday(s.date));
  const soldBirds=saleBirdsTotal(c),soldKg=sales.reduce((sum,x)=>sum+saleWeightKg(c,x),0);
  const liv=liveAtDate(c,today()),feed=feedForFcr(c),w=performanceWeight(c,today()),liveKg=liv*Math.max(0,w);
  const birdSalesWeight=sales.reduce((sum,x)=>x.weightUnit==='bird'?sum+saleWeightKg(c,x):sum,0);
  const totalLiveWeight=soldKg+liveKg,initialKg=(+c.birds||0)*(+c.initWeight||0),gain=Math.max(0,totalLiveWeight-initialKg);
  const fcr=gain>0?feed/gain:0,livPct=c.birds?Math.max(0,(c.birds-dead-cul)/c.birds*100):0,ageDays=Math.max(age(c),1);
  const adg=ageDays>0?Math.max(0,(w-(+c.initWeight||0))*1000/ageDays):0; const pi=fcr>0?(livPct*adg)/(fcr*10):0,epef=fcr>0?(livPct*w*100)/(ageDays*fcr):0,cv=lastWeight(c)?.cv||0;
  const cur=getCycleCurrency(c);
  const meds=db.meds.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date)).reduce((sum,x)=>sum+(+x.cost||0),0);
  const fc=db.feed.filter(x=>x.cycleId===c.id&&isPastOrToday(x.date)).reduce((sum,x)=>sum+(+x.qty||0)*(+x.price||0),0);
  const fin=db.finance[c.id]||{};
  const saleRevenue=sales.reduce((sum,x)=>sum+saleRowRevenue(x),0);
  const expenseTotal=Object.prototype.hasOwnProperty.call(financeDraftExpenses,c.id)?financeExpenseTotal(financeDraftExpenses[c.id]):financeExpenseTotal(fin);
  const cost=fc+meds+(+fin.chicks||0)+expenseTotal;
  const rev=saleRevenue+(+fin.otherRevenue||0),profit=rev-cost,producedWeight=totalLiveWeight>0?totalLiveWeight:0,costPerKg=producedWeight>0?cost/producedWeight:0;
  const realizedPriceKg=soldKg>0?saleRevenue/soldKg:0;
  const economicCoefficient=costPerKg>0&&realizedPriceKg>0?realizedPriceKg/costPerKg:0,ebef=epef>0&&economicCoefficient>0?epef*economicCoefficient:0;
  const marketableBirds=soldBirds+liv,costPerBird=marketableBirds>0?cost/marketableBirds:0;
  const liveBreak=liveSource(c,today());
  return {dead,cul,liv,feed,w,gain,fcr,livPct,ageDays,pi,epef,adg,cv,ebef,economicCoefficient,meds,fc,expenseTotal,cost,rev,profit,soldBirds,soldKg,saleRevenue,liveKg,totalLiveWeight,birdSalesWeight,costPerKg,costPerBird,realizedPriceKg,currency:cur,marketableBirds,missingCurrency:false,liveBreak};
}
function fillFinanceCycle(preserve=true){
  if(!finFarm||!finCycle)return;
  const old=finCycle.value;
  const farmId=finFarm.value;
  const cycles=db.cycles.filter(c=>!farmId||c.farmId===farmId);
  finCycle.innerHTML=cycles.map(c=>`<option value="${c.id}">${esc(getHouseName(c.houseId))} — ${c.date}${c.breed?' — '+esc(c.breed):''}</option>`).join('');
  if(preserve&&old&&[...finCycle.options].some(o=>o.value===old))finCycle.value=old;
  renderFinance();
}
function renderFinance(){
  const selectedFarmId=finFarm?.value||'';
  const farmCycles=db.cycles.filter(cc=>!selectedFarmId||cc.farmId===selectedFarmId);
  const farmSales=farmCycles.reduce((sum,cc)=>sum+calc(cc).saleRevenue,0);
  const farmOther=farmCycles.reduce((sum,cc)=>sum+(+((db.finance[cc.id]||{}).otherRevenue)||0),0);
  const farmRevenue=farmSales+farmOther;
  const farmProfit=farmCycles.reduce((sum,cc)=>sum+calc(cc).profit,0);
  const c=cyc(finCycle.value);if(!c){
    if(finSalePrice)finSalePrice.value=farmSales.toFixed(2);
    if(financeBox)financeBox.innerHTML=`<div class="cards"><div class="card">المبيعات الفعلية للمزرعة<div class="kpi">${farmSales.toFixed(2)} ${currencyCode(db.settings?.currency||'SAR')}</div><div class="muted">من سجل المبيعات والحصاد</div></div><div class="card">إجمالي إيرادات المزرعة<div class="kpi">${farmRevenue.toFixed(2)} ${currencyCode(db.settings?.currency||'SAR')}</div></div><div class="card">ربح/خسارة المزرعة<div class="kpi ${farmProfit>=0?'success':'danger'}">${farmProfit.toFixed(2)} ${currencyCode(db.settings?.currency||'SAR')}</div></div></div>`;
    if(financeTable)financeTable.innerHTML='';
    return;
  }
  const cur=getCycleCurrency(c),f=db.finance[c.id]||{},x=calc(c);
  // سعر بيع الحي في المالية ليس إدخالًا يدويًا: هو إجمالي الإيراد الفعلي من سجل المبيعات والحصاد.
  finSalePrice.value=(+x.saleRevenue||0).toFixed(2);
  const vals={costChicks:f.chicks,otherRevenue:f.otherRevenue};Object.entries(vals).forEach(([k,v])=>{const el=document.getElementById(k);if(el)el.value=v??''});financeExpensesForCycle(c.id);renderFinanceExpenseList(c.id);
  finCurrency.value=cur;updateCurrencyLabels();
  financeBox.innerHTML=`<div class="cards"><div class="card">إجمالي التكلفة<div class="kpi">${x.cost.toFixed(2)} ${cur}</div></div><div class="card">المبيعات الفعلية للدورة<div class="kpi">${x.saleRevenue.toFixed(2)} ${cur}</div><div class="muted">من سجل المبيعات والحصاد مباشرة</div></div><div class="card">المبيعات الفعلية للمزرعة<div class="kpi">${farmSales.toFixed(2)} ${cur}</div><div class="muted">تلقائيًا عند اختيار المزرعة</div></div><div class="card">إجمالي إيرادات المزرعة<div class="kpi">${farmRevenue.toFixed(2)} ${cur}</div><div class="muted">المبيعات + الإيرادات الأخرى</div></div><div class="card">إجمالي الإيرادات للدورة<div class="kpi">${x.rev.toFixed(2)} ${cur}</div></div><div class="card">الربح/الخسارة للدورة<div class="kpi ${x.profit>=0?'success':'danger'}">${x.profit.toFixed(2)} ${cur}</div></div><div class="card">ربح/خسارة المزرعة<div class="kpi ${farmProfit>=0?'success':'danger'}">${farmProfit.toFixed(2)} ${cur}</div></div><div class="card">تكلفة/طائر<div class="kpi">${x.costPerBird.toFixed(2)} ${cur}</div></div><div class="card">تكلفة/كجم حي<div class="kpi">${x.costPerKg.toFixed(2)} ${cur}</div></div></div><div class="note">سعر/إجمالي بيع الحي في الأعلى يُسحب تلقائيًا من المبيعات والحصاد المسجلة. إجمالي إيرادات المزرعة يجمع المبيعات الفعلية لكل دورات المزرعة المختارة. «إيرادات أخرى» لا تشمل المبيعات. مصروفات المشروع تُجمع من البنود المسجلة في القائمة أعلاه.</div>`;
  const filterFarm=finFilterFarm?.value||'',filterHouses=getMultiValues(finFilterHouse),financeCycles=db.cycles.filter(cc=>(!filterFarm||cc.farmId===filterFarm)&&(!filterHouses.length||filterHouses.includes(cc.houseId))&&(db.finance[cc.id]||db.sales.some(ss=>ss.cycleId===cc.id)));financeTable.innerHTML=financeCycles.map(cc=>{const z=calc(cc),ccur=getCycleCurrency(cc);return `<tr><td>${esc(getFarmName(cc.farmId))}</td><td>${esc(getHouseName(cc.houseId))}</td><td>${cc.date}</td><td>${esc(ccur)}</td><td>${z.cost.toFixed(2)} ${esc(ccur)}</td><td><b>${z.saleRevenue.toFixed(2)} ${esc(ccur)}</b><div class="muted">${z.soldBirds.toLocaleString()} طائر • ${z.soldKg.toFixed(2)} كجم</div></td><td>${z.rev.toFixed(2)} ${esc(ccur)}</td><td>${z.profit.toFixed(2)} ${esc(ccur)}</td><td><button class="btn" onclick="beginFinanceEdit('${cc.id}')">تعديل</button>${db.finance[cc.id]?` <button class="btn danger" onclick="deleteFinance('${cc.id}')">حذف</button>`:''}</td></tr>`}).join('')||'<tr><td colspan="9">لا توجد سجلات مالية ضمن النطاق.</td></tr>';
}
function beginFinanceEdit(cycleId){const c=cyc(cycleId);if(!c||!requirePermission('finance',c.farmId))return;finCycle.value=cycleId;renderFinance();show('finance');window.scrollTo({top:0,behavior:'smooth'})}
function deleteFinance(cycleId=finCycle.value){const c=cyc(cycleId);if(!c||!requirePermission('finance',c.farmId))return;if(!cycleId||!db.finance[cycleId])return;if(!confirm('حذف السجل المالي لهذه الدورة؟'))return;const old=db.finance[cycleId];if(old?.id&&c?.farmId&&isUuid(old.id))db.tombstones.push({id:uuid(),farmId:c.farmId,entity:'finance',recordId:old.id,deletedAt:new Date().toISOString()});delete db.finance[cycleId];delete financeDraftExpenses[cycleId];save();alert('تم حذف السجل المالي')}
function reportSvgMortality(rows,birds){
  const W=900,H=310,PL=58,PR=28,PT=24,PB=55, iw=W-PL-PR, ih=H-PT-PB;
  if(!rows.length) return '<div class="note">لا توجد بيانات نفوق يومية مسجلة لهذه الدورة.</div>';
  const maxDead=Math.max(1,...rows.map(r=>+r.dead||0));
  const points=rows.map((r,i)=>{const x=PL+(rows.length===1?iw/2:(i/(rows.length-1))*iw); const cum=+r.cumDead||0; const y=PT+ih-(cum/Math.max(1,birds)*100)*ih; return {x,y,r};});
  const maxPct=Math.max(1,...rows.map(r=>(+r.cumDead||0)/Math.max(1,birds)*100));
  const linePts=rows.map((r,i)=>{const x=PL+(rows.length===1?iw/2:(i/(rows.length-1))*iw); const y=PT+ih-((+r.cumDead||0)/Math.max(1,birds)*100/maxPct)*ih; return `${x.toFixed(1)},${y.toFixed(1)}`}).join(' ');
  const step=iw/Math.max(1,rows.length), bw=Math.max(3,Math.min(28,step*.62));
  const bars=rows.map((r,i)=>{const x=PL+i*step+(step-bw)/2;const h=((+r.dead||0)/maxDead)*ih;const y=PT+ih-h;return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="bar"/><text x="${(x+bw/2).toFixed(1)}" y="${H-25}" text-anchor="middle">${esc(r.age)}</text>`}).join('');
  const dots=rows.map((r,i)=>{const x=PL+(rows.length===1?iw/2:(i/(rows.length-1))*iw);const y=PT+ih-((+r.cumDead||0)/Math.max(1,birds)*100/maxPct)*ih;return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3" class="dot"/>`}).join('');
  return `<div class="report-chart-wrap"><div class="chart-title"><b>منحنى النفوق التراكمي</b><span>نسبة النفوق التراكمية القصوى المعروضة: ${maxPct.toFixed(2)}%</span></div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="منحنى النفوق التراكمي"><line x1="${PL}" y1="${PT}" x2="${PL}" y2="${PT+ih}" stroke="#94a3b8"/><line x1="${PL}" y1="${PT+ih}" x2="${W-PR}" y2="${PT+ih}" stroke="#94a3b8"/><polyline points="${linePts}" class="line"/>${dots}${rows.map((r,i)=>{let pct=(+r.cumDead||0)/Math.max(1,birds)*100;const x=PL+(rows.length===1?iw/2:(i/(rows.length-1))*iw);const y=PT+ih-((+r.cumDead||0)/Math.max(1,birds)*100/maxPct)*ih-8;return `<text x="${x.toFixed(1)}" y="${Math.max(14,y).toFixed(1)}" text-anchor="middle">${pct.toFixed(2)}%</text>`}).join('')}</svg></div><div class="report-chart-wrap"><div class="chart-title"><b>النافق اليومي</b><span>الأعمدة = عدد النافق في كل يوم</span></div><svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="النافق اليومي">${bars}<text x="12" y="20">النافق</text><text x="${W-35}" y="${H-25}">العمر (يوم)</text></svg></div>`;
}
function renderReport(){
  const c=cyc(reportCycle.value);
  if(reportStandardAge&&!+reportStandardAge.value&&c)reportStandardAge.value=age(c);
  populateStandardBreedOptions();
  if(!reportStandardBreed?.value&&c?.breed){const k=standardKeyForBreed(c.breed);if(k)reportStandardBreed.value=k;}
  renderStandardCatalog();
  if(!c){printReport.innerHTML='<div class="panel">أضف دورة لعرض التقرير.</div>';return}
  const x=calc(c), liveInfo=x.liveBreak, f=db.finance[c.id]||{}, farm=db.farms.find(v=>v.id===c.farmId)||{}, house=db.houses.find(v=>v.id===c.houseId)||{};
  const daily=db.daily.filter(r=>r.cycleId===c.id).sort((a,b)=>a.date.localeCompare(b.date));
  let cumDead=0,cumCull=0;
  const rows=daily.map(r=>{cumDead+=+r.dead||0;cumCull+=+r.cull||0;const soldThroughDate=soldBirdsAtDate(c,r.date),live=liveAtDate(c,r.date),a=age(c,r.date);return {...r,cumDead,cumCull,soldThroughDate,live,age:a,dailyPct:c.birds?(+r.dead||0)/c.birds*100:0,cumPct:c.birds?cumDead/c.birds*100:0}});
  const weights=db.weights.filter(w=>w.cycleId===c.id).sort((a,b)=>a.date.localeCompare(b.date));
  const feeds=db.feed.filter(r=>r.cycleId===c.id).sort((a,b)=>a.date.localeCompare(b.date));
  const meds=db.meds.filter(r=>r.cycleId===c.id).sort((a,b)=>a.date.localeCompare(b.date));
  const sales=db.sales.filter(r=>r.cycleId===c.id).sort((a,b)=>a.date.localeCompare(b.date));
  const totalCull=rows.reduce((s,r)=>s+(+r.cull||0),0), totalDead=rows.reduce((s,r)=>s+(+r.dead||0),0);
  const last=rows[rows.length-1], reportDate=new Date().toLocaleDateString('ar-EG');
  const salesBirds=saleBirdsTotal(c), salesKg=sales.reduce((s,r)=>s+(r.weightUnit==='kg'?(+r.weightQty||+r.weightKg||0):0),0);
  const feedQty=feeds.reduce((s,r)=>s+(+r.qty||0),0), feedCost=feeds.reduce((s,r)=>s+((+r.qty||0)*(+r.price||0)),0);
  const medCost=meds.reduce((s,r)=>s+(+r.cost||0),0);
  const currency=getCycleCurrency(c);
  printReport.innerHTML=`<div class="report panel">
  <div class="report-header"><h1>تقرير دورة تربية دواجن</h1><div class="report-sub">تقرير تشغيلي وإنتاجي ومالي شامل</div><table class="report-meta"><tr><th>اسم الشركة</th><td>${esc(farm.companyName||'-')}</td><th>اسم المزرعة</th><td>${esc(farm.name||'-')}</td></tr><tr><th>المالك</th><td>${esc(farm.owner||'-')}</td><th>ترخيص المزرعة</th><td>${esc(farm.licenseNumber||'-')}</td></tr><tr><th>العنبر</th><td>${esc(house.name||getHouseName(c.houseId)||'-')}</td><th>المسؤول</th><td>${esc(farm.manager||'-')}</td></tr><tr><th>تاريخ الاستقبال</th><td>${c.date}</td><th>تاريخ التقرير</th><td>${reportDate}</td></tr><tr><th>السلالة</th><td>${esc(c.breed||'-')}</td><th>مصدر الكتاكيت</th><td>${esc(c.source||'-')}</td></tr></table></div>
  <h3>ملخص الدورة والعنبر</h3><div class="cards report-cards"><div class="card">عدد الاستقبال<div class="kpi">${(+c.birds||0).toLocaleString()}</div></div><div class="card">الحي الحالي<div class="kpi">${liveInfo.live.toLocaleString()}</div><div class="muted">الاستقبال ${liveInfo.received.toLocaleString()} − النافق ${liveInfo.dead.toLocaleString()} − المستبعد ${liveInfo.cull.toLocaleString()} − المبيعات ${liveInfo.sold.toLocaleString()}</div></div><div class="card">نافق العنبر<div class="kpi">${totalDead.toLocaleString()}</div></div><div class="card">المستبعد<div class="kpi">${totalCull.toLocaleString()}</div></div><div class="card">نسبة النفوق<div class="kpi">${(c.birds?totalDead/c.birds*100:0).toFixed(2)}%</div></div><div class="card">نسبة الاستبعاد<div class="kpi">${(c.birds?totalCull/c.birds*100:0).toFixed(2)}%</div></div><div class="card">العمر الحالي<div class="kpi">${age(c)} يوم</div></div><div class="card">وزن الاستقبال<div class="kpi">${((+c.initWeight||0)*1000).toFixed(0)} جم</div></div><div class="card">الوزن الحالي<div class="kpi">${x.w?x.w.toFixed(3):'-'} كجم</div></div><div class="card">إجمالي العلف المستهلك<div class="kpi">${x.feed.toFixed(1)} كجم</div><div class="muted">المستخدم في FCR</div></div><div class="card">معامل التحويل الغذائي (FCR)<div class="kpi">${x.fcr?x.fcr.toFixed(3):'-'}</div>${x.fcr?metricBadge('fcr',x.fcr,c):'—'}</div><div class="card">معدل الزيادة اليومية (ADG)<div class="kpi">${x.adg?x.adg.toFixed(1):'-'} جم</div>${x.adg?metricBadge('adg',x.adg,c):'—'}</div><div class="card">CV%<div class="kpi">${x.cv?x.cv.toFixed(1):'-'}%</div>${x.cv?cvBadge(x.cv):'—'}</div><div class="card">مؤشر الإنتاج (PI)<div class="kpi">${x.pi?x.pi.toFixed(1):'-'}</div>${x.pi?metricBadge('pi',x.pi,c):'—'}</div><div class="card">مؤشر كفاءة الإنتاج (EPEF / EPI)<div class="kpi">${x.epef?x.epef.toFixed(1):'-'}</div>${x.epef?metricBadge('epef',x.epef,c):'—'}</div><div class="card">مؤشر الكفاءة الاقتصادية (EBEF)<div class="kpi">${x.ebef?x.ebef.toFixed(1):'-'}</div></div></div>
  <h3>مؤشرات الأداء الفني</h3><table><thead><tr><th>المؤشر</th><th>القيمة</th><th>طريقة الحساب</th></tr></thead><tbody><tr><td>مؤشر الإنتاج (PI)</td><td>${x.pi?x.pi.toFixed(1):'-'}<br>${x.pi?metricBadge('pi',x.pi,c):'—'}</td><td>الحيوية × ADG ÷ (FCR × 10) — ADG بالجرام/طائر/يوم</td></tr><tr><td>معدل الزيادة اليومية (ADG)</td><td>${x.adg?x.adg.toFixed(1):'-'} جم/طائر/يوم<br>${x.adg?metricBadge('adg',x.adg,c):'—'}</td><td>(الوزن الحالي − وزن الاستقبال) ÷ العمر</td></tr><tr><td>معامل التحويل الغذائي (FCR)</td><td>${x.fcr?x.fcr.toFixed(3):'-'}<br>${x.fcr?metricBadge('fcr',x.fcr,c):'—'}</td><td>العلف ÷ الزيادة الحية المحسوبة</td></tr><tr><td>معامل التباين (CV%)</td><td>${x.cv?x.cv.toFixed(2):'-'}%<br>${x.cv?cvBadge(x.cv):'—'}</td><td>SD ÷ متوسط الوزن × 100</td></tr><tr><td>مؤشر كفاءة الإنتاج (EPEF / EPI)</td><td>${x.epef?x.epef.toFixed(1):'-'}<br>${x.epef?metricBadge('epef',x.epef,c):'—'}</td><td>الحيوية × الوزن × 100 ÷ (العمر × FCR)</td></tr><tr><td>مؤشر الكفاءة الاقتصادية (EBEF)</td><td>${x.ebef?x.ebef.toFixed(1):'-'}</td><td>EPEF × المعامل الاقتصادي</td></tr><tr><td>المعامل الاقتصادي</td><td>${x.economicCoefficient?x.economicCoefficient.toFixed(3):'-'}</td><td>سعر بيع الكجم الحي ÷ تكلفة إنتاج الكجم الحي</td></tr></tbody></table><div class="note">PI هنا مؤشر فني سريع بدون عامل الزمن، بينما EPEF/EPI يدخل العمر. EBEF يستخدم معاملًا اقتصاديًا شفافًا مبنيًا على سعر بيع الكجم الحي وتكلفة إنتاج الكجم الحي.</div>
  ${renderStandardAssessment(c,x)}${renderReportStandardComparison(c,x)}
  <h3>النفوق والمتابعة اليومية للعنبر</h3><div style="overflow:auto"><table><thead><tr><th>التاريخ</th><th>العمر</th><th>النافق</th><th>النفوق %</th><th>النافق التراكمي</th><th>النفوق التراكمي %</th><th>المستبعد</th><th>الحي</th><th>المياه (لتر)</th><th>الحرارة °C</th><th>الرطوبة %</th><th>الوزن (كجم)</th><th>ملاحظات</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${r.date}</td><td>${r.age}</td><td>${(+r.dead||0).toLocaleString()}</td><td>${r.dailyPct.toFixed(2)}%</td><td>${r.cumDead.toLocaleString()}</td><td>${r.cumPct.toFixed(2)}%</td><td>${(+r.cull||0).toLocaleString()}</td><td>${r.live.toLocaleString()}</td><td>${(+r.water||0).toLocaleString()}</td><td>${(+r.temp||0).toFixed(1)}</td><td>${(+r.humidity||0).toFixed(1)}</td><td>${(+r.weight||0)?(+r.weight).toFixed(3):'-'}</td><td>${esc(r.notes||'')}</td></tr>`).join('')||'<tr><td colspan="13">لا توجد متابعة يومية.</td></tr>'}</tbody></table></div>
  ${reportSvgMortality(rows,c.birds)}
  <h3>الأوزان الأسبوعية</h3><table><thead><tr><th>التاريخ</th><th>السلالة</th><th>العمر</th><th>العينة</th><th>إجمالي أوزان العينة</th><th>متوسط الوزن</th><th>أدنى</th><th>أعلى</th><th>SD</th><th>CV%</th></tr></thead><tbody>${weights.map(w=>`<tr><td>${w.date}</td><td>${esc(c.breed||'-')}</td><td>${age(c,w.date)}</td><td>${w.sample||0}</td><td>${(+w.total||0).toFixed(3)}</td><td>${(+w.avg||0).toFixed(3)} كجم</td><td>${w.min||'-'}</td><td>${w.max||'-'}</td><td>${w.sd?(+w.sd).toFixed(3):'-'}</td><td>${w.cv?(+w.cv).toFixed(2):'-'}</td></tr>`).join('')||'<tr><td colspan="10">لا توجد أوزان أسبوعية.</td></tr>'}</tbody></table>
  <h3>الأعلاف</h3><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الكمية كجم</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${feeds.map(r=>`<tr><td>${r.date}</td><td>${esc(r.type||'-')}</td><td>${(+r.qty||0).toFixed(2)}</td><td>${(+r.price||0).toFixed(2)}</td><td>${((+r.qty||0)*(+r.price||0)).toFixed(2)}</td></tr>`).join('')||'<tr><td colspan="5">لا توجد سجلات أعلاف.</td></tr>'}</tbody><tfoot><tr><th colspan="2">الإجمالي</th><th>${feedQty.toFixed(2)}</th><th></th><th>${feedCost.toFixed(2)} ${esc(currency)}</th></tr></tfoot></table>
  <h3>الأدوية والتحصينات</h3><table><thead><tr><th>التاريخ</th><th>النوع</th><th>الاسم</th><th>الكمية</th><th>التكلفة</th><th>الجرعة</th><th>سحب</th></tr></thead><tbody>${meds.map(r=>`<tr><td>${r.date}</td><td>${esc(r.type||'-')}</td><td>${esc(r.name||'-')}</td><td>${r.qty||0}</td><td>${(+r.cost||0).toFixed(2)}</td><td>${esc(r.dose||'-')}</td><td>${r.withdrawal||0}</td></tr>`).join('')||'<tr><td colspan="7">لا توجد أدوية أو تحصينات.</td></tr>'}</tbody><tfoot><tr><th colspan="4">إجمالي التكلفة</th><th>${medCost.toFixed(2)} ${esc(currency)}</th><th colspan="2"></th></tr></tfoot></table>
  <h3>المبيعات والحصاد</h3><table><thead><tr><th>التاريخ</th><th>الطيور</th><th>الوزن/الكمية</th><th>الوحدة</th><th>السعر</th><th>الإجمالي</th><th>المشتري</th></tr></thead><tbody>${sales.map(r=>`<tr><td>${r.date}</td><td>${(+r.birds||0).toLocaleString()}</td><td>${(+r.weightQty||+r.weightKg||0).toFixed(2)}</td><td>${r.weightUnit==='bird'?'حبة':'كجم'}</td><td>${(+r.price||0).toFixed(2)}</td><td>${(+r.total||0).toFixed(2)}</td><td>${esc(r.buyer||'-')}</td></tr>`).join('')||'<tr><td colspan="7">لا توجد مبيعات أو حصاد.</td></tr>'}</tbody><tfoot><tr><th>الإجمالي</th><th>${salesBirds.toLocaleString()}</th><th>${salesKg.toFixed(2)}</th><th>كجم</th><th></th><th>${x.saleRevenue.toFixed(2)} ${esc(currency)}</th><th></th></tr></tfoot></table>
  <h3>مصروفات المشروع</h3><table><thead><tr><th>البند</th><th>القيمة</th><th>العملة</th></tr></thead><tbody>${normalizeFinanceExpenses(f).map(e=>`<tr><td>${esc(e.category)}</td><td>${(+e.amount||0).toFixed(2)}</td><td>${esc(currency)}</td></tr>`).join('')||'<tr><td colspan="3">لا توجد بنود مصروف إضافية مسجلة.</td></tr>'}</tbody><tfoot><tr><th>الإجمالي</th><th>${financeExpenseTotal(f).toFixed(2)}</th><th>${esc(currency)}</th></tr></tfoot></table>
  <h3>التحليل المالي</h3><table><tr><th>العملة</th><td>${esc(currency)}</td><th>تكلفة العلف</th><td>${x.fc.toFixed(2)}</td></tr><tr><th>الأدوية والتحصينات</th><td>${x.meds.toFixed(2)}</td><th>إجمالي التكلفة</th><td>${x.cost.toFixed(2)}</td></tr><tr><th>إيرادات البيع</th><td>${x.saleRevenue.toFixed(2)}</td><th>إيرادات أخرى</th><td>${(f.otherRevenue||0).toFixed(2)}</td></tr><tr><th>إجمالي الإيرادات</th><td>${x.rev.toFixed(2)}</td><th>صافي الربح/الخسارة</th><td>${x.profit.toFixed(2)}</td></tr><tr><th>تكلفة الكجم المنتج</th><td>${x.costPerKg.toFixed(2)} ${esc(currency)}</td><th>تكلفة الطائر</th><td>${x.costPerBird.toFixed(2)} ${esc(currency)}</td></tr></table>
  <div class="note report-note"><b>قاعدة الحي الحالية:</b> الاستقبال − النافق التراكمي − المستبعد التراكمي − المبيعات حتى تاريخ التقرير = الحي الحالي.<br><b>ملاحظات:</b> الحي الحالي = الاستقبال - النافق - المستبعد - إجمالي الطيور المباعة حتى تاريخ التقرير. مصدر الرقم واحد في جميع الشاشات والتقرير. مبيعات الكجم يُفضّل أن تتضمن عدد الطيور؛ وإذا لم تُدخل يُقدّر العدد تلقائيًا من وزن البيع ومتوسط الوزن المتاح في تاريخ البيع. مبيعات الطيور بالحبة تستخدم متوسط وزن البيع المسجل، وإن لم يوجد تستخدم أولًا أحدث وزن متابعة يومية قبل تاريخ البيع ثم الوزن الأسبوعي. FCR يستخدم العلف المستهلك في المتابعة اليومية، مع الرجوع إلى حركات العلف فقط عند عدم وجود استهلاك يومي. تقرير النفوق يعتمد على سجلات المتابعة اليومية المدخلة لهذه الدورة.</div>
  <div class="signature-page"><h3>اعتماد التقرير</h3><div class="signature-grid"><div><b>مدير المزرعة</b><div class="signature-line"></div><div>الاسم: ____________________</div><div>التوقيع: __________________</div><div>التاريخ: __________________</div></div><div><b>مدير الإنتاج</b><div class="signature-line"></div><div>الاسم: ____________________</div><div>التوقيع: __________________</div><div>التاريخ: __________________</div></div><div><b>المدير العام</b><div class="signature-line"></div><div>الاسم: ____________________</div><div>التوقيع: __________________</div><div>التاريخ: __________________</div></div></div></div>
  </div>`;
}

function updateSaleWeightUnitUI(){
  const unit=saleWeightUnit?.value||'kg';
  if(saleWeightBox)saleWeightBox.style.display=unit==='kg'?'':'none';
  if(saleAvgWeightBox)saleAvgWeightBox.style.display=unit==='bird'?'':'none';
  if(unit==='bird'){
    const c=cyc(saleCycle?.value),d=saleDate?.value||today();
    const fallback=c?saleAverageWeight(c,{date:d}):0;
    if(saleAvgWeight&&(!+saleAvgWeight.value||editState.type!=='sale'))saleAvgWeight.value=fallback>0?Number(fallback).toFixed(3):'';
    if(saleWeight)saleWeight.value=saleBirds?.value||'';
    if(saleAvgWeightHint)saleAvgWeightHint.textContent=fallback>0?`الوزن المرجعي التلقائي بتاريخ ${d}: ${Number(fallback).toFixed(3)} كجم/طائر — يمكنك تعديله.`:'لا يوجد وزن مرجعي قبل تاريخ البيع؛ أدخل متوسط وزن البيع.';
  }else if(saleWeight)saleWeight.readOnly=false;
}
function updateSaleBirdsFromCycle(){
  const c=cyc(saleCycle?.value);
  if(!c||!saleBirds)return;
  const d=saleDate?.value||today();
  const available=liveAtDate(c,d);
  saleBirds.value=available;
  const el=document.getElementById('saleAvailableLive');
  if(el)el.textContent=`الحي المتاح في ${d}: ${available.toLocaleString()} طائر`;
  if((saleWeightUnit?.value||'kg')==='bird'&&saleAvgWeight){
    const w=saleAverageWeight(c,{date:d});
    if(w>0) saleAvgWeight.value=Number(w).toFixed(3);
  }
  updateSaleWeightUnitUI();
}
function addSale(){
  const editing=editState.type==='sale';const old=editing?db.sales.find(x=>x.id===editState.id):null;const farmId=editing?getFarmForRecord('sales',old):cyc(saleCycle.value)?.farmId;if(!requireActionForRecord(editing?'edit':'create','sale',farmId))return;
  if(!saleCycle.value||!+saleBirds.value)return alert('أدخل الدورة وعدد الطيور. عدد الطيور إلزامي لضمان دقة الحي الحالي.');
  const c=cyc(saleCycle.value),cur=getCycleCurrency(c),unit=saleWeightUnit.value||'kg',birds=Math.floor(+saleBirds.value),qty=unit==='kg'?+saleWeight.value:birds,avgWeight=unit==='bird'?+saleAvgWeight.value:0;
  if(unit==='kg'&&!qty)return alert('أدخل كمية البيع بالكيلو.');
  if(unit==='bird'&&!(avgWeight>0))return alert('أدخل متوسط وزن الطائر عند البيع بالكيلو؛ يمكن تعديل القيمة التلقائية.');
  const saleD=saleDate.value||today();const otherSold=old?db.sales.filter(s=>s.id!==old.id&&s.cycleId===c.id&&isPastOrToday(s.date,saleD)).reduce((s,x)=>s+saleRowBirds(c,x),0):soldBirdsAtDate(c,saleD);const available=Math.max(0,Math.floor(+c.birds||0)-deadTotal(c,saleD)-cullTotal(c,saleD)-otherSold);
  if(!editing&&birds>available)return alert(`عدد الطيور للبيع (${birds}) أكبر من الحي المتاح حاليًا (${available}).`);
  const price=+salePrice.value||0,total=unit==='bird'?birds*price:qty*price;
  const data={cycleId:saleCycle.value,date:saleD,birds,weightQty:unit==='kg'?qty:birds,weightUnit:unit,weightKg:unit==='kg'?qty:birds*avgWeight,avgWeight:unit==='bird'?avgWeight:undefined,price,total,revenue:total,currency:cur,buyer:saleBuyer.value.trim(),updatedAt:new Date().toISOString()};
  if(editing){Object.assign(old,data)}else{db.sales.push({id:uuid(),...data})}
  audit(editing?'update':'create','sales',old?.id||db.sales.at(-1)?.id,{farmId,before:editState.snapshot||null,after:old||db.sales.at(-1)});refreshFinancialSnapshot(c);clearEdit();save();updateSaleWeightUnitUI();alert(`تم حفظ عملية البيع/الحصاد — الإيراد ${data.total.toFixed(2)} ${cur}`);
}

function renderSales(){
  saleCycle.innerHTML=db.cycles.map(c=>`<option value="${c.id}">${esc(getFarmName(c.farmId))} — ${esc(getHouseName(c.houseId))} — ${c.date}${c.breed?' — '+esc(c.breed):''}</option>`).join('');
  updateCurrencyLabels();
  saleTable.innerHTML=db.sales.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(s=>{const c=cyc(s.cycleId),cur=currencyCode(s.currency||getCycleCurrency(c)),wk=s.weightUnit==='bird'?saleWeightKg(c,s):(+s.weightQty||+s.weightKg||0);return `<tr><td>${s.date}</td><td>${esc(getFarmName(c?.farmId))} — ${esc(getHouseName(c?.houseId))}</td><td>${(+s.birds||0).toLocaleString()}</td><td>${s.weightUnit==='bird'?`${Number(s.avgWeight||saleAverageWeight(c,s)||0).toFixed(3)} كجم/طائر<br><small class="muted">إجمالي ${wk.toFixed(2)} كجم</small>`:`${(+s.weightQty||+s.weightKg||0).toFixed(2)} كجم`}</td><td>${(+s.price||0).toFixed(2)} ${cur}</td><td>${saleRowRevenue(s).toFixed(2)} ${cur}</td><td>${esc(s.buyer||'')}</td><td><button class="btn" data-action="edit" data-type="sale" data-id="${s.id}">تعديل</button> <button class="btn danger" data-action="delete" data-type="sales" data-id="${s.id}">حذف</button></td></tr>`}).join('')||'<tr><td colspan="8">لا توجد مبيعات مسجلة.</td></tr>';
}
function exportBackup(){let blob=new Blob([JSON.stringify(db,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='poultry-farm-manager-v3-backup.json';a.click();URL.revokeObjectURL(a.href)}
function importBackup(inp){let f=inp.files[0];if(!f)return;let r=new FileReader();r.onload=()=>{try{let x=JSON.parse(r.result);db={farms:[],houses:[],cycles:[],daily:[],weights:[],feed:[],meds:[],inventory:[],finance:{},sales:[],tombstones:[],...x};normalizeDbIds();db.cycles.forEach(c=>c.currency=currencyCode(c.currency||db.finance?.[c.id]?.currency||'SAR'));save();alert('تم استيراد النسخة')}catch(e){alert('ملف النسخة غير صالح')}};r.readAsText(f)}
function downloadSchema(){let schema=`-- Poultry Farm Manager V3\ncreate table farms (id uuid primary key, owner_id uuid not null, name text not null, owner_name text, manager text, location text);\ncreate table houses (id uuid primary key, farm_id uuid not null references farms(id), name text not null, capacity integer);\ncreate table cycles (id uuid primary key, farm_id uuid not null references farms(id), house_id uuid references houses(id), date date not null, birds integer not null, init_weight numeric not null, breed text, source text, active boolean default true);\ncreate table daily_records (id uuid primary key, cycle_id uuid not null references cycles(id), date date not null, dead integer default 0, cull integer default 0, feed numeric default 0, water numeric default 0, weight numeric, temp numeric, humidity numeric, notes text);\ncreate table weekly_weights (id uuid primary key, cycle_id uuid not null references cycles(id), date date not null, sample integer, total numeric, avg numeric, min numeric, max numeric, cv numeric, sd numeric, cv_method text);\ncreate table sales (id uuid primary key, cycle_id uuid not null references cycles(id), date date not null, birds integer, weight_kg numeric, price numeric, total numeric, buyer text);\ncreate table feed_movements (id uuid primary key, cycle_id uuid references cycles(id), date date not null, type text, qty numeric, price numeric);\ncreate table health_records (id uuid primary key, cycle_id uuid references cycles(id), date date not null, type text, name text, qty numeric, cost numeric, dose text, withdrawal numeric);\ncreate table finance_entries (id uuid primary key, cycle_id uuid references cycles(id), category text, amount numeric, entry_type text, expenses_json jsonb not null default '[]'::jsonb);\n-- Enable RLS and policies based on owner_id before production. Never ship a service-role key in the app.`;let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([schema],{type:'text/plain'}));a.download='poultry-farm-manager-v3-schema.sql';a.click()}

const ROLE_PERMISSIONS={
 owner:['view','create','edit','delete','finance','users','settings','audit'],
 manager:['view','create','edit','delete','finance','users'],
 supervisor:['view','create','edit'],
 worker:['view','create']
};
function roleForFarm(farmId){
  if(!currentUser)return null;
  if(currentUser.role==='owner')return 'owner';
  const localFarm=farmId?db.farms.find(f=>f.id===farmId):null;if(localFarm?.ownerId===currentUser.id)return 'owner';
  if(farmId&&currentUser.farmRoles?.[farmId])return currentUser.farmRoles[farmId];
  return currentUser.role||null;
}
function can(action,farmId=null){const role=roleForFarm(farmId);return !!role&&(ROLE_PERMISSIONS[role]||[]).includes(action);}
function requirePermission(action,farmId=null){if(can(action,farmId))return true;alert('ليس لديك صلاحية لتنفيذ هذا الإجراء في هذه المزرعة.');return false;}function requireRecordPermission(action,type,farmId){
  const role=roleForFarm(farmId);if(!role)return false;
  if(role==='owner'||role==='manager')return true;
  if(role==='supervisor')return action!=='delete'&&type!=='farm'&&type!=='users'&&type!=='finance';
  if(role==='worker')return action==='create'&&['daily','weight','feed','med','sale'].includes(type);
  return false;
}
function requireActionForRecord(action,type,farmId){if(requireRecordPermission(action,type,farmId))return true;alert('ليس لديك صلاحية لتنفيذ هذا الإجراء لهذا النوع من السجلات.');return false;}

function applyRoleUI(){
  const admin=document.querySelectorAll('[data-permission="users"]');admin.forEach(x=>x.style.display=can('users')?'':'none');const settingsEls=document.querySelectorAll('[data-permission="settings"]');settingsEls.forEach(x=>x.style.display=can('settings')?'':'none');const auditEls=document.querySelectorAll('[data-permission="audit"]');auditEls.forEach(x=>x.style.display=can('audit')?'':'none');
  const finance=document.querySelectorAll('[data-permission="finance"]');finance.forEach(x=>x.style.display=can('finance')?'':'none');
}
async function loadMembers(){
  if(!supabaseClient)return membersBox.textContent='إدارة الأعضاء متاحة بعد ربط Supabase.';
  const farmId=memberFarm?.value;
  if(!requirePermission('users',farmId))return membersBox.textContent='ليس لديك صلاحية إدارة المستخدمين في هذه المزرعة.';
  if(!farmId)return membersBox.textContent='اختر مزرعة أولًا.';
  const {data,error}=await supabaseClient.rpc('list_farm_members',{p_farm_id:farmId});
  if(error)return membersBox.textContent=error.message;
  membersBox.innerHTML=data?.length?data.map(m=>`<div style="padding:7px 0;border-bottom:1px solid #eee"><b>${esc(m.full_name||m.email||m.user_id)}</b> — ${esc(m.email||'')} — <b>${esc(m.role)}</b></div>`).join(''):'لا يوجد أعضاء.';
}
async function saveMemberRole(){
  if(!supabaseClient)return alert('اربط Supabase أولًا.');
  const farmId=memberFarm.value;if(!requirePermission('users',farmId))return;
  const email=normalizeEmail(memberEmail.value),role=memberRole.value;
  if(!farmId||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('أدخل بريد الموظف واختر المزرعة.');
  const {error}=await supabaseClient.rpc('set_farm_member_by_email',{p_farm_id:farmId,p_email:email,p_role:role});
  if(error)return alert(error.message);
  memberEmail.value='';await loadMembers();alert('تم حفظ صلاحية الموظف على هذه المزرعة.');
}
function normalizeMultiScope(sel){if(!sel?.multiple)return;const all=[...sel.options].find(o=>o.value==='__ALL__');const vals=[...sel.selectedOptions].map(o=>o.value);if(all&&vals.length>1&&vals.includes('__ALL__'))all.selected=false;if(all&&!sel.selectedOptions.length)all.selected=true;}
function getMultiValues(sel){normalizeMultiScope(sel);return [...sel?.selectedOptions||[]].map(o=>o.value).filter(v=>v&&v!=='__ALL__');}
function selectSingleOption(sel,value){if(!sel)return;[...sel.options].forEach(o=>o.selected=o.value===value);if(sel.multiple)normalizeMultiScope(sel);}
function setAllFarmOptions(sel,preserve=true){if(!sel)return;const old=sel.value;sel.innerHTML='<option value="">كل المزارع</option>'+db.farms.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');if(preserve&&old&&[...sel.options].some(o=>o.value===old))sel.value=old;else sel.value='';}
function populateHouseMulti(sel,farmId,preserve=true){if(!sel)return;const old=preserve?getMultiValues(sel):[];const houses=db.houses.filter(h=>!farmId||h.farmId===farmId);sel.innerHTML='<option value="__ALL__">كل العنابر</option>'+houses.map(h=>`<option value="${h.id}">${esc(farmId?getHouseName(h.id):`${getFarmName(h.farmId)} — ${getHouseName(h.id)}`)}</option>`).join('');const valid=old.filter(id=>houses.some(h=>h.id===id));if(valid.length)valid.forEach(id=>{const o=[...sel.options].find(x=>x.value===id);if(o)o.selected=true});else if(sel.options[0])sel.options[0].selected=true;normalizeMultiScope(sel);}
function cyclesForScope(farmId,houseIds){return db.cycles.filter(c=>(!farmId||c.farmId===farmId)&&(!houseIds.length||houseIds.includes(c.houseId))).sort((a,b)=>b.date.localeCompare(a.date));}
function selectCycleDefaults(sel,cycles){if(!sel)return;const old=[...sel.selectedOptions].map(o=>o.value).filter(Boolean);sel.innerHTML=cycles.map(c=>`<option value="${c.id}">${esc(getFarmName(c.farmId))} — ${esc(getHouseName(c.houseId))} — ${c.date}${c.breed?' — '+esc(c.breed):''}${c.active?' — نشطة':''}</option>`).join('');const valid=old.filter(id=>cycles.some(c=>c.id===id));if(valid.length){valid.forEach(id=>{const o=[...sel.options].find(x=>x.value===id);if(o)o.selected=true});return;}if(cycles.length===1){sel.options[0].selected=true;return;}[...sel.options].forEach(o=>o.selected=false);}
function scopeText(farmId,houseIds){const farm=farmId?getFarmName(farmId):'كل المزارع';return houseIds.length?`${farm} — ${houseIds.map(getHouseName).join('، ')}`:`${farm} — كل العنابر`;}
function updateFeedScope(preserve=true){if(!feedFarmFilter||!feedHouseFilter)return;const fid=feedFarmFilter.value||'';populateHouseMulti(feedHouseFilter,fid,preserve);const hids=getMultiValues(feedHouseFilter),cycles=cyclesForScope(fid,hids);selectCycleDefaults(feedCycle,cycles);if(feedScopeHint)feedScopeHint.innerHTML=`<b>نطاق العلف:</b> ${esc(scopeText(fid,hids))} — <b>${cycles.length}</b> دورة متاحة.`;renderFeedTable();updateCurrencyLabels();}
function updateMedScope(preserve=true){if(!medFarmFilter||!medHouseFilter)return;const fid=medFarmFilter.value||'';populateHouseMulti(medHouseFilter,fid,preserve);const hids=getMultiValues(medHouseFilter),cycles=cyclesForScope(fid,hids);selectCycleDefaults(medCycle,cycles);if(medScopeHint)medScopeHint.innerHTML=`<b>نطاق الأدوية والتحصينات:</b> ${esc(scopeText(fid,hids))} — <b>${cycles.length}</b> دورة متاحة.`;renderMedTable();updateCurrencyLabels();}
function updateInventoryScope(preserve=true){if(!invFilterFarm||!invFilterHouse)return;const fid=invFilterFarm.value||'';populateHouseMulti(invFilterHouse,fid,preserve);const hids=getMultiValues(invFilterHouse),farms=hids.length?[...new Set(hids.map(id=>db.houses.find(h=>h.id===id)?.farmId).filter(Boolean))]:[];if(inventoryScopeHint)inventoryScopeHint.innerHTML=`<b>نطاق المخزون:</b> ${esc(scopeText(fid,hids))}. العنبر هنا للتصفية فقط لأن سجل المخزون محفوظ على مستوى المزرعة.`;renderInventoryTable(fid,farms);}
function updateFinanceScope(preserve=true){if(!finFilterFarm||!finFilterHouse)return;const fid=finFilterFarm.value||'';populateHouseMulti(finFilterHouse,fid,preserve);const hids=getMultiValues(finFilterHouse);if(financeScopeHint)financeScopeHint.innerHTML=`<b>نطاق سجل التكاليف والأرباح:</b> ${esc(scopeText(fid,hids))}.`;renderFinance();}
function setFarmOptions(sel,preserve=true){if(!sel)return;const old=sel.value;sel.innerHTML=db.farms.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');if(preserve&&old&&[...sel.options].some(o=>o.value===old))sel.value=old;}
function setCompareFarmOptions(preserve=true){if(!compareFarm)return;const old=compareFarm.value;compareFarm.innerHTML='<option value="">كل المزارع</option>'+db.farms.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');if(preserve&&old&&[...compareFarm.options].some(o=>o.value===old))compareFarm.value=old;else compareFarm.value='';}
function fillPerfHouse(preserve=true){if(!perfFarm||!perfHouse)return;populateHouseMulti(perfHouse,perfFarm.value||'',preserve);renderPerformance();}
function fillCompareHouse(preserve=true){if(!compareHouse)return;const fid=compareFarm?.value||'',old=preserve?compareHouse.value:'';const houses=db.houses.filter(h=>!fid||h.farmId===fid);compareHouse.innerHTML='<option value="">كل العنابر</option>'+houses.map(h=>{const label=fid?getHouseName(h.id):`${getFarmName(h.farmId)} — ${getHouseName(h.id)}`;return `<option value="${h.id}">${esc(label)}</option>`}).join('');if(preserve&&old&&[...compareHouse.options].some(o=>o.value===old))compareHouse.value=old;else compareHouse.value='';renderComparison();}
function cycleKpiRow(c){const x=calc(c);return `<tr><td>${esc(getFarmName(c.farmId))}</td><td>${esc(getHouseName(c.houseId))}</td><td>${c.date}</td><td>${esc(c.breed||'-')}</td><td>${age(c)} يوم</td><td>${(+c.birds||0).toLocaleString()}</td><td>${x.liv.toLocaleString()}</td><td>${((x.dead/(+c.birds||1))*100).toFixed(2)}%</td><td>${x.w?x.w.toFixed(3):'-'}</td><td>${x.fcr?x.fcr.toFixed(3):'-'}<br>${x.fcr?metricBadge('fcr',x.fcr,c):'—'}</td><td>${x.adg?x.adg.toFixed(1):'-'}<br>${x.adg?metricBadge('adg',x.adg,c):'—'}</td><td>${x.cv?x.cv.toFixed(2):'-'}<br>${x.cv?cvBadge(x.cv):'—'}</td><td>${x.pi?x.pi.toFixed(1):'-'}<br>${x.pi?metricBadge('pi',x.pi,c):'—'}</td><td>${x.epef?x.epef.toFixed(1):'-'}<br>${x.epef?metricBadge('epef',x.epef,c):'—'}</td><td>${x.ebef?x.ebef.toFixed(1):'-'}</td><td>${x.economicCoefficient?x.economicCoefficient.toFixed(3):'-'}</td><td>${x.saleRevenue.toFixed(2)} ${x.currency}</td><td>${x.profit.toFixed(2)} ${x.currency}</td></tr>`;}
function aggregatePerformanceScope(cycles){const rows=cycles.map(c=>({c,x:calc(c)})),live=rows.reduce((s,r)=>s+r.x.liv,0),dead=rows.reduce((s,r)=>s+r.x.dead,0),cull=rows.reduce((s,r)=>s+r.x.cul,0),sold=rows.reduce((s,r)=>s+r.x.soldBirds,0),feed=rows.reduce((s,r)=>s+r.x.feed,0),revenue=rows.reduce((s,r)=>s+r.x.saleRevenue,0),profit=rows.reduce((s,r)=>s+r.x.profit,0),marketable=rows.reduce((s,r)=>s+Math.max(0,r.x.marketableBirds||0),0),producedWeight=rows.reduce((s,r)=>s+Math.max(0,r.x.totalLiveWeight||0),0),gain=rows.reduce((s,r)=>s+r.x.gain,0),cvRows=rows.filter(r=>r.x.cv>0);const wBase=marketable||live;return{live,dead,cull,sold,feed,revenue,profit,weight:wBase?producedWeight/wBase:0,fcr:gain?feed/gain:0,adg:wBase?rows.reduce((s,r)=>s+(r.x.adg||0)*Math.max(0,r.x.marketableBirds||0),0)/wBase:0,cv:cvRows.length?cvRows.reduce((s,r)=>s+r.x.cv,0)/cvRows.length:0,pi:wBase?rows.reduce((s,r)=>s+(r.x.pi||0)*Math.max(0,r.x.marketableBirds||0),0)/wBase:0,epef:wBase?rows.reduce((s,r)=>s+(r.x.epef||0)*Math.max(0,r.x.marketableBirds||0),0)/wBase:0,ebef:wBase?rows.reduce((s,r)=>s+(r.x.ebef||0)*Math.max(0,r.x.marketableBirds||0),0)/wBase:0,economicCoefficient:wBase?rows.reduce((s,r)=>s+(r.x.economicCoefficient||0)*Math.max(0,r.x.marketableBirds||0),0)/wBase:0};}
function renderPerformance(){const fid=perfFarm?.value||'',hids=getMultiValues(perfHouse),cs=db.cycles.filter(c=>(!fid||c.farmId===fid)&&(!hids.length||hids.includes(c.houseId))).sort((a,b)=>b.date.localeCompare(a.date));const scope=scopeText(fid,hids);if(performanceScopeHint)performanceScopeHint.innerHTML=`<b>نطاق الأداء:</b> ${esc(scope)} — <b>${cs.length}</b> دورة`;if(!cs.length){performanceBox.innerHTML=`<div class="panel">لا توجد دورات ضمن النطاق المحدد: <b>${esc(scope)}</b>.</div>`;performanceTable.innerHTML='';return;}const current=cs.filter(c=>c.active),base=current.length?current:cs.slice(0,Math.min(cs.length,20)),a=aggregatePerformanceScope(base),cur=currencyCode(db.settings?.currency||'SAR');performanceBox.innerHTML=`<div class="cards"><div class="card">نطاق العرض<div class="kpi">${esc(scope)}</div><div class="muted">${base.length} دورة في الملخص</div></div><div class="card">الحي الحالي<div class="kpi">${a.live.toLocaleString()}</div><div class="muted">طائر</div></div><div class="card">النافق<div class="kpi">${a.dead.toLocaleString()}</div></div><div class="card">المستبعد<div class="kpi">${a.cull.toLocaleString()}</div></div><div class="card">المباع<div class="kpi">${a.sold.toLocaleString()}</div></div><div class="card">الوزن المرجح<div class="kpi">${a.weight?a.weight.toFixed(3):'-'} كجم</div></div><div class="card">معامل التحويل الغذائي (FCR)<div class="kpi">${a.fcr?a.fcr.toFixed(3):'-'}</div></div><div class="card">معدل الزيادة اليومية (ADG)<div class="kpi">${a.adg?a.adg.toFixed(1):'-'} جم</div></div><div class="card">معامل التباين (CV%)<div class="kpi">${a.cv?a.cv.toFixed(2):'-'}%</div></div><div class="card">مؤشر الإنتاج (PI)<div class="kpi">${a.pi?a.pi.toFixed(1):'-'}</div></div><div class="card">مؤشر كفاءة الإنتاج (EPEF / EPI)<div class="kpi">${a.epef?a.epef.toFixed(1):'-'}</div></div><div class="card">مؤشر الكفاءة الاقتصادية (EBEF)<div class="kpi">${a.ebef?a.ebef.toFixed(1):'-'}</div></div><div class="card">المعامل الاقتصادي (EC)<div class="kpi">${a.economicCoefficient?a.economicCoefficient.toFixed(3):'-'}</div></div><div class="card">المبيعات<div class="kpi">${a.revenue.toFixed(2)} ${cur}</div></div><div class="card">الربح/الخسارة<div class="kpi">${a.profit.toFixed(2)} ${cur}</div></div></div><div class="note">ملخص إداري للنطاق المحدد. الأولوية للدورات النشطة؛ وإذا لم توجد دورة نشطة يستخدم أحدث دورات النطاق. التفاصيل الفردية لكل دورة تبقى في الجدول.</div>`;performanceTable.innerHTML=cs.map(cycleKpiRow).join('')||'<tr><td colspan="18">لا توجد دورات.</td></tr>';}
function renderComparison(){const fid=compareFarm?.value||'',hid=compareHouse?.value||'',cs=db.cycles.filter(c=>(!fid||c.farmId===fid)&&(!hid||c.houseId===hid)).sort((a,b)=>a.date.localeCompare(b.date)),farmLabel=fid?getFarmName(fid):'كل المزارع',houseLabel=hid?getHouseName(hid):'كل العنابر',scopeLabel=fid?(hid?`${farmLabel} — ${houseLabel}`:`${farmLabel} — كل العنابر`):(hid?`${houseLabel} — عبر المزارع المتاحة`:'كل المزارع — كل العنابر');if(comparisonScopeHint)comparisonScopeHint.innerHTML=`<b>نطاق المقارنة:</b> ${esc(scopeLabel)} — <b>${cs.length}</b> دورة`;if(!cs.length){comparisonBox.innerHTML=`<div class="panel">لا توجد دورات ضمن النطاق المحدد: <b>${esc(scopeLabel)}</b>.</div>`;return;}const summary=cs.reduce((a,c)=>{const x=calc(c);a.received+=(+c.birds||0);a.live+=x.liv;a.dead+=x.dead;a.sold+=x.soldBirds;a.feed+=x.feed;a.revenue+=x.saleRevenue||0;a.profit+=x.profit||0;return a},{received:0,live:0,dead:0,sold:0,feed:0,revenue:0,profit:0});comparisonBox.innerHTML=`<div class="cards"><div class="card">الدورات<div class="num">${cs.length}</div></div><div class="card">إجمالي الاستقبال<div class="num">${summary.received.toLocaleString()}</div></div><div class="card">إجمالي الحي الحالي<div class="num">${summary.live.toLocaleString()}</div></div><div class="card">إجمالي النافق<div class="num">${summary.dead.toLocaleString()}</div></div><div class="card">إجمالي المباع<div class="num">${summary.sold.toLocaleString()}</div></div><div class="card">العلف المستخدم في FCR<div class="num">${summary.feed.toFixed(1)} كجم</div></div><div class="card">المبيعات الفعلية<div class="num">${summary.revenue.toFixed(2)}</div></div><div class="card">الربح/الخسارة<div class="num">${summary.profit.toFixed(2)}</div></div></div><div class="panel"><h3>مقارنة ${esc(scopeLabel)}</h3><div class="muted" style="margin-bottom:8px">كل صف يمثل دورة مستقلة، والمزرعة والعنبر ظاهرَان لتسهيل القراءة.</div><div style="overflow:auto"><table><thead><tr><th>المزرعة</th><th>العنبر</th><th>تاريخ الدورة</th><th>السلالة</th><th>العمر</th><th>الاستقبال</th><th>الحي</th><th>نفوق%</th><th>الوزن</th><th>معامل التحويل الغذائي (FCR)</th><th>معدل الزيادة اليومية (ADG)</th><th>معامل التباين (CV%)</th><th>مؤشر الإنتاج (PI)</th><th>مؤشر كفاءة الإنتاج (EPEF / EPI)</th><th>مؤشر الكفاءة الاقتصادية (EBEF)</th><th>المعامل الاقتصادي (EC)</th><th>المبيعات</th><th>الربح</th></tr></thead><tbody>${cs.map(c=>{const x=calc(c);return `<tr><td>${esc(getFarmName(c.farmId))}</td><td>${esc(getHouseName(c.houseId))}</td><td>${c.date}</td><td>${esc(c.breed||'-')}</td><td>${age(c)}</td><td>${(+c.birds||0).toLocaleString()}</td><td>${x.liv.toLocaleString()}</td><td>${((x.dead/(+c.birds||1))*100).toFixed(2)}%</td><td>${x.w?x.w.toFixed(3):'-'}</td><td>${x.fcr?x.fcr.toFixed(3):'-'}<br>${x.fcr?metricBadge('fcr',x.fcr,c):'—'}</td><td>${x.adg?x.adg.toFixed(1):'-'}<br>${x.adg?metricBadge('adg',x.adg,c):'—'}</td><td>${x.cv?x.cv.toFixed(2):'-'}<br>${x.cv?cvBadge(x.cv):'—'}</td><td>${x.pi?x.pi.toFixed(1):'-'}<br>${x.pi?metricBadge('pi',x.pi,c):'—'}</td><td>${x.epef?x.epef.toFixed(1):'-'}<br>${x.epef?metricBadge('epef',x.epef,c):'—'}</td><td>${x.ebef?x.ebef.toFixed(1):'-'}</td><td>${x.economicCoefficient?x.economicCoefficient.toFixed(3):'-'}</td><td>${x.saleRevenue.toFixed(2)} ${x.currency}</td><td>${x.profit.toFixed(2)} ${x.currency}</td></tr>`}).join('')}</tbody></table></div></div>`;}
function renderAudit(){if(!auditTable)return;auditTable.innerHTML=(db.auditLog||[]).slice(0,300).map(a=>`<tr><td>${new Date(a.createdAt).toLocaleString('ar-EG')}</td><td>${esc(a.userName||a.userId||'-')}</td><td>${esc(getFarmName(a.farmId))}</td><td>${esc(a.action)}</td><td>${esc(a.entity)} ${a.recordId?String(a.recordId).slice(0,8):''}</td><td><pre style="white-space:pre-wrap;margin:0">${esc(JSON.stringify(a.details||{},null,2))}</pre></td></tr>`).join('')||'<tr><td colspan="6">لا توجد حركات.</td></tr>';}
function standardStatus(actual,target,lowerIsBetter=false){if(actual==null||target==null||!isFinite(actual)||!isFinite(target)||target===0)return {label:'غير متاح',cls:'',diff:null};const pct=(actual-target)/target*100;const good=lowerIsBetter?actual<=target:actual>=target;const tolerance=7;const within=lowerIsBetter?actual<=target*(1+tolerance/100):actual>=target*(1-tolerance/100);return {label:good?'ضمن/أفضل من المعيار':within?'قريب من المعيار':'أقل من المعيار',cls:good?'standard-good':within?'standard-warn':'standard-bad',diff:pct};}
function globalStandardForCycle(c){const key=standardKeyForBreed(c?.breed)||c?.standardBreed||null;return key&&BROILER_STANDARD_CATALOG[key]?key:null;}
function saveGlobalStandardBreed(){if(!can('settings'))return alert('إعداد المعايير متاح للمالك الرئيسي فقط.');const key=globalStandardBreed?.value;if(!key)return;db.settings.globalStandardBreed=key;db.settings.updatedAt=new Date().toISOString();audit('update','global_standard_breed','settings',{breed:key});save();renderGlobalStandardPanel();}
function populateGlobalStandardSelectors(){if(!globalStandardBreed||!standardPreviewBreed)return;const keys=Object.keys(BROILER_STANDARD_CATALOG);const g=db.settings?.globalStandardBreed||'Ross 308';globalStandardBreed.innerHTML=keys.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('');standardPreviewBreed.innerHTML='<option value="">اختر سلالة</option>'+keys.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('');if(keys.includes(g))globalStandardBreed.value=g;const c=cyc(reportCycle?.value);const ck=standardKeyForBreed(c?.breed);if(ck&&keys.includes(ck))standardPreviewBreed.value=ck;else if(!standardPreviewBreed.value&&keys.includes(g))standardPreviewBreed.value=g;}
function renderGlobalStandardPanel(){if(!globalStandardPanel)return;populateGlobalStandardSelectors();const key=standardPreviewBreed?.value||globalStandardBreed?.value||'Ross 308';const day=Math.max(1,Number(standardPreviewAge?.value)||35),cat=BROILER_STANDARD_CATALOG[key],at=standardAtAge(key,day);if(!cat||!at){globalStandardPanel.innerHTML='<div class="note">لا يوجد معيار متاح.</div>';return;}const rows=cat.rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1].toLocaleString()} جم</td><td>${r[2]==null?'—':r[2].toFixed(1)+' جم/يوم'}</td><td>${r[3]==null?'—':r[3].toFixed(3)}</td><td>${r[4]==null?'—':r[4].toLocaleString()+' جم'}</td></tr>`).join('');globalStandardPanel.innerHTML=`<div class="cards"><div class="card"><div class="standard-mini"><img src="./pfm-logo.png">السلالة</div><div class="kpi">${esc(key)}</div></div><div class="card">العمر<div class="kpi">${day} يوم</div></div><div class="card">الوزن المرجعي<div class="kpi">${at.weight!=null?(at.weight/1000).toFixed(3)+' كجم':'—'}</div></div><div class="card">FCR المرجعي<div class="kpi">${at.fcr!=null?at.fcr.toFixed(3):'—'}</div></div><div class="card">ADG المرجعي<div class="kpi">${at.adg!=null?at.adg.toFixed(1)+' جم/يوم':'—'}</div></div></div><div class="standard-source">${esc(cat.source)}${at.interpolated?' • العمر غير أسبوعي: تقدير خطي بين نقطتي المرجع الأقرب.':''}</div><div style="overflow:auto"><table><thead><tr><th>العمر</th><th>الوزن</th><th>ADG</th><th>FCR</th><th>العلف التراكمي</th></tr></thead><tbody>${rows}</tbody></table></div>`;}
function renderStandardAssessment(c,x){const key=globalStandardForCycle(c);if(!key)return '<div class="note">لا توجد مطابقة تلقائية للسلالة الحالية مع كتالوج عالمي.</div>';const at=standardAtAge(key,age(c));if(!at)return '';const items=[];if(at.weight!=null){const a=standardStatus(x.w,at.weight/1000,false);items.push(`<tr><td>الوزن</td><td>${x.w.toFixed(3)} كجم</td><td>${(at.weight/1000).toFixed(3)} كجم</td><td class="${a.cls}">${a.diff==null?'—':(a.diff>=0?'+':'')+a.diff.toFixed(1)+'%'} — ${a.label}</td></tr>`);}if(at.fcr!=null&&x.fcr>0){const a=standardStatus(x.fcr,at.fcr,true);items.push(`<tr><td>FCR</td><td>${x.fcr.toFixed(3)}</td><td>${at.fcr.toFixed(3)}</td><td class="${a.cls}">${a.diff==null?'—':(a.diff>=0?'+':'')+a.diff.toFixed(1)+'%'} — ${a.label}</td></tr>`);}if(at.adg!=null&&x.adg>0){const a=standardStatus(x.adg,at.adg,false);items.push(`<tr><td>ADG</td><td>${x.adg.toFixed(1)} جم/يوم</td><td>${at.adg.toFixed(1)} جم/يوم</td><td class="${a.cls}">${a.diff==null?'—':(a.diff>=0?'+':'')+a.diff.toFixed(1)+'%'} — ${a.label}</td></tr>`);}return `<div class="panel standard-center-panel"><h3>مقارنة إنتاجية الدورة بالمعيار العالمي</h3><div class="muted">السلالة: <b>${esc(key)}</b> • العمر: <b>${age(c)} يوم</b> • المصدر: ${esc(BROILER_STANDARD_CATALOG[key].source)}</div><table><thead><tr><th>المؤشر</th><th>فعلي</th><th>مرجع السلالة</th><th>الفارق والحالة</th></tr></thead><tbody>${items.join('')}</tbody></table><div class="note">هذه المقارنة مرتبطة بالسلالة والعمر الفعلي للدورة، وتظهر في التقرير النهائي لكل دورة. إذا كان العمر بين نقطتين منشورتين يتم تقدير المرجع خطيًا.</div></div>`;}
function savePerformanceRule(){if(!can('settings'))return alert('إعداد المعايير متاح للمالك الرئيسي فقط.');const breed=performanceRuleBreed.value.trim(),ageDay=Math.max(0,+performanceRuleAge.value||0);if(!breed)return alert('أدخل السلالة.');const r={id:uuid(),breed,ageDay,targetWeight:+performanceRuleWeight.value||0,targetFcr:+performanceRuleFcr.value||0,targetAdg:+performanceRuleAdg.value||0,maxCv:+performanceRuleCv.value||0,minEpef:+performanceRuleEpef.value||0,minPi:+performanceRulePi.value||0,maxMortality:+performanceRuleMortality.value||0,updatedAt:new Date().toISOString()};const old=(db.performanceRules||[]).find(x=>x.breed.toLowerCase()===breed.toLowerCase()&&+x.ageDay===ageDay);if(old)Object.assign(old,{...r,id:old.id});else db.performanceRules.push(r);audit('create','performance_rule',r.id,{breed,ageDay});save();renderPerformanceRules();alert('تم حفظ معيار الأداء.');}
function renderPerformanceRules(){if(!performanceRuleTable)return;performanceRuleTable.innerHTML=(db.performanceRules||[]).sort((a,b)=>a.breed.localeCompare(b.breed)||a.ageDay-b.ageDay).map(r=>`<tr><td>${esc(r.breed)}</td><td>${r.ageDay}</td><td>${r.targetWeight||'-'}</td><td>${r.targetFcr||'-'}</td><td>${r.targetAdg||'-'}</td><td>${r.maxCv||'-'}</td><td>${r.minEpef||'-'}</td><td>${r.minPi||'-'}</td><td>${r.maxMortality||'-'}</td><td><button class="btn danger" onclick="deletePerformanceRule('${r.id}')">حذف</button></td></tr>`).join('')||'<tr><td colspan="10">لا توجد معايير.</td></tr>';}
function deletePerformanceRule(id){if(!can('settings'))return;const r=db.performanceRules.find(x=>x.id===id);if(!r||!confirm('حذف معيار الأداء؟'))return;db.performanceRules=db.performanceRules.filter(x=>x.id!==id);audit('delete','performance_rule',id,{before:r});save();renderPerformanceRules();}
const BROILER_STANDARD_CATALOG={
  'Ross 308':{source:'Aviagen — Ross 308/308 FF Broiler Performance Objectives (2022)',sourceUrl:'https://ross-intl.aviagen.com/assets/Tech_Center/Ross_Broiler/RossxRoss308-BroilerPerformanceObjectives2022-EN.pdf',rows:[
    [7,213,24,.780,166],[14,533,35,1.005,535],[21,1012,46,1.142,1155],[28,1616,56,1.269,2051],[35,2296,64,1.399,3211],[42,2998,70,1.531,4586],[49,3681,74,1.663,6115],[56,4318,76,1.793,7733]
  ]},
  'Cobb 500':{source:'Cobb Genetics — Cobb500 Broiler Performance & Nutrition Supplement (2022)',sourceUrl:'https://www.cobbgenetics.com/assets/Cobb-Files/2022-Cobb500-Broiler-Performance-Nutrition-Supplement.pdf',rows:[
    [7,202,22.9,.891,180],[14,570,37.7,1.029,588],[21,1116,51.1,1.182,1320],[28,1783,62.2,1.322,2359],[35,2521,70.8,1.441,3635],[42,3278,77.1,1.555,5100],[49,4001,80.8,1.686,6749],[56,4641,82.1,1.842,8549]
  ]},
  'Ross 708':{source:'Aviagen — Ross 708 Broiler Performance Objectives',sourceUrl:'https://ross-intl.aviagen.com/na/brands/ross/products/ross-708',rows:[
    [7,204,23,.770,157],[14,509,33,.992,505],[21,966,44,1.127,1089],[28,1543,54,1.254,1934],[35,2191,61,1.382,3027],[42,2862,67,1.512,4324],[49,3514,71,1.642,5765],[56,4122,73,1.771,7291]
  ]},
  'Arbor Acres Plus':{source:'Aviagen — Arbor Acres Plus Broiler Performance Objectives',sourceUrl:'https://aviagen.com/la/brands/arbor-acres/products/arbor-acres-plus',rows:[
    [7,209,24,.803,168],[14,527,34,1.021,538],[21,1006,46,1.157,1163],[28,1611,56,1.285,2069],[35,2287,64,1.416,3237],[42,2981,70,1.548,4612],[49,3649,74,1.680,6125],[56,4263,75,1.810,7708]
  ]},
  'Indian River':{source:'Aviagen — Indian River Broiler Performance Objectives',sourceUrl:'https://aviagen.com/brands/indian-river',rows:[
    [7,211,24,.788,167],[14,531,35,1.003,532],[21,1010,46,1.142,1153],[28,1616,56,1.275,2060],[35,2295,64,1.411,3238],[42,2995,70,1.549,4636],[49,3671,74,1.686,6185],[56,4297,76,1.822,7818]
  ]},
  'Hubbard Efficiency Plus':{source:'Hubbard — Efficiency Plus Broiler Performance Objectives (Metric)',sourceUrl:'https://www.hubbardbreeders.com/library',rows:[
    [28,1647,null,1.27,null],[35,2330,null,1.41,null],[42,3028,null,1.54,null],[49,3704,null,1.67,null],[56,4324,null,1.80,null]
  ]}
};
const STANDARD_BREED_ALIASES={
  'ross 308':'Ross 308','ross 308 ff':'Ross 308','روس 308':'Ross 308','روس 308 ff':'Ross 308',
  'cobb 500':'Cobb 500','cobb500':'Cobb 500','كب 500':'Cobb 500','كب 500':'Cobb 500',
  'ross 708':'Ross 708','روس 708':'Ross 708',
  'arbor acres plus':'Arbor Acres Plus','arbor acres':'Arbor Acres Plus','أربور إيكرز بلس':'Arbor Acres Plus',
  'indian river':'Indian River','إنديان ريفر':'Indian River',
  'hubbard efficiency plus':'Hubbard Efficiency Plus','hubbard':'Hubbard Efficiency Plus','هبارد إفيشنسي بلس':'Hubbard Efficiency Plus'
};
function populateCycleBreedOptions(current=''){if(!cycleBreed)return;const keys=Object.keys(BROILER_STANDARD_CATALOG);const known=new Set(keys);const cur=String(current||'').trim();let opts='<option value="">اختيار السلالة</option>'+keys.map(k=>`<option value="${esc(k)}">${esc(k)}</option>`).join('')+'<option value="__CUSTOM__">سلالة أخرى / إدخال يدوي</option>';cycleBreed.innerHTML=opts;if(cur&&known.has(cur)){cycleBreed.value=cur;cycleBreedCustom.value='';cycleBreedCustom.style.display='none';}else if(cur){cycleBreed.value='__CUSTOM__';cycleBreedCustom.value=cur;cycleBreedCustom.style.display='block';}else{cycleBreed.value='';cycleBreedCustom.value='';cycleBreedCustom.style.display='none';}}
function toggleCustomBreed(){const custom=cycleBreed?.value==='__CUSTOM__';if(cycleBreedCustom)cycleBreedCustom.style.display=custom?'block':'none';if(custom)cycleBreedCustom.focus();}
function standardKeyForBreed(breed){const raw=String(breed||'').trim().toLowerCase();if(STANDARD_BREED_ALIASES[raw])return STANDARD_BREED_ALIASES[raw];const hit=Object.keys(STANDARD_BREED_ALIASES).find(k=>raw.includes(k)||k.includes(raw));return hit?STANDARD_BREED_ALIASES[hit]:null;}
function standardAtAge(key,day){const cat=BROILER_STANDARD_CATALOG[key];if(!cat||!cat.rows.length)return null;const a=Math.max(1,Number(day)||1),rows=cat.rows;if(a<=rows[0][0]){const r=rows[0];return {age:r[0],weight:r[1],adg:r[2],fcr:r[3],feed:r[4],interpolated:false,source:cat.source,sourceUrl:cat.sourceUrl};}if(a>=rows[rows.length-1][0]){const r=rows[rows.length-1];return {age:r[0],weight:r[1],adg:r[2],fcr:r[3],feed:r[4],interpolated:a!==r[0],source:cat.source,sourceUrl:cat.sourceUrl};}let lo=rows[0],hi=rows[rows.length-1];for(let i=1;i<rows.length;i++){if(a<=rows[i][0]){lo=rows[i-1];hi=rows[i];break;}}const t=(a-lo[0])/(hi[0]-lo[0]);const lerp=(x,y)=>x==null||y==null?null:x+(y-x)*t;return {age:a,weight:lerp(lo[1],hi[1]),adg:lerp(lo[2],hi[2]),fcr:lerp(lo[3],hi[3]),feed:lerp(lo[4],hi[4]),interpolated:true,source:cat.source,sourceUrl:cat.sourceUrl};}
function populateStandardBreedOptions(){if(!reportStandardBreed)return;const cur=reportStandardBreed.value;const opts=['<option value="">اختيار السلالة / استخدام سلالة الدورة</option>',...Object.keys(BROILER_STANDARD_CATALOG).map(k=>`<option value="${esc(k)}">${esc(k)}</option>`)].join('');reportStandardBreed.innerHTML=opts;if(cur&&Object.keys(BROILER_STANDARD_CATALOG).includes(cur))reportStandardBreed.value=cur;}
function renderStandardCatalog(){
  if(!reportStandardCatalog)return;
  const c=cyc(reportCycle?.value);populateStandardBreedOptions();
  const selectedKey=reportStandardBreed?.value||standardKeyForBreed(c?.breed);
  const currentAge=Math.max(1,Number(reportStandardAge?.value||age(c)||7));
  if(reportStandardAge)reportStandardAge.value=currentAge;
  if(!selectedKey){reportStandardCatalog.innerHTML='<div class="note">اختر سلالة مرجعية أو اختر دورة تحتوي على سلالة مدعومة بالكتالوج.</div>';return;}
  const cat=BROILER_STANDARD_CATALOG[selectedKey],at=standardAtAge(selectedKey,currentAge);
  const rows=cat.rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1].toLocaleString()} جم</td><td>${r[2]==null?'غير منشور':r[2].toFixed(1)+' جم/يوم'}</td><td>${r[3].toFixed(3)}</td><td>${r[4]==null?'غير منشور':r[4].toLocaleString()+' جم'}</td></tr>`).join('');
  reportStandardCatalog.innerHTML=`<div class="panel" style="margin:10px 0 0"><div class="cards"><div class="card">السلالة<div class="kpi">${esc(selectedKey)}</div></div><div class="card">العمر المرجعي<div class="kpi">${currentAge} يوم</div></div><div class="card">الوزن المرجعي<div class="kpi">${at?.weight!=null?(at.weight/1000).toFixed(3)+' كجم':'-'}</div></div><div class="card">FCR المرجعي<div class="kpi">${at?.fcr!=null?at.fcr.toFixed(3):'-'}</div></div><div class="card">ADG المرجعي<div class="kpi">${at?.adg!=null?at.adg.toFixed(1)+' جم/يوم':'غير منشور'}</div></div></div><div class="note">المصدر: ${esc(cat.source)}. ${at?.interpolated?'القيمة عند هذا العمر تقدير خطي بين نقطتي الكتالوج الأقرب.':''} ${at?.feed==null?'الكتالوج المختصر المستخدم هنا لا ينشر استهلاكًا تراكميًا لهذه السلالة في البيانات المضافة.':''}</div><div style="overflow:auto"><table><thead><tr><th>العمر (يوم)</th><th>وزن الجسم</th><th>معدل الزيادة اليومية (ADG)</th><th>معامل التحويل الغذائي (FCR)</th><th>العلف التراكمي</th></tr></thead><tbody>${rows}</tbody></table></div><div class="muted">المعيار المرجعي هدف أداء وليس ضمانًا لنتيجة الحقل؛ راعِ إدارة المزرعة والبيئة والتغذية والصحة عند تفسير الفرق.</div></div>`;
}
function renderReportStandardComparison(c,x){
  const key=standardKeyForBreed(c.breed);if(!key)return '<div class="note">لا يوجد معيار مدمج للسلالة الحالية. استخدم كتالوج المعايير أعلى التقرير أو أضف معيارًا مخصصًا من الإعدادات.</div>';
  const at=standardAtAge(key,age(c));if(!at)return '';
  const rows=[];if(at.weight!=null)rows.push(`<tr><td>الوزن</td><td>${x.w?x.w.toFixed(3)+' كجم':'-'}</td><td>${(at.weight/1000).toFixed(3)} كجم</td><td>${x.w?((x.w-at.weight/1000)).toFixed(3)+' كجم':'-'}</td></tr>`);if(at.fcr!=null)rows.push(`<tr><td>معامل التحويل الغذائي (FCR)</td><td>${x.fcr?x.fcr.toFixed(3):'-'}</td><td>${at.fcr.toFixed(3)}</td><td>${x.fcr?(x.fcr-at.fcr).toFixed(3):'-'}</td></tr>`);if(at.adg!=null)rows.push(`<tr><td>معدل الزيادة اليومية (ADG)</td><td>${x.adg?x.adg.toFixed(1)+' جم/يوم':'-'}</td><td>${at.adg.toFixed(1)} جم/يوم</td><td>${x.adg?(x.adg-at.adg).toFixed(1)+' جم/يوم':'-'}</td></tr>`);return `<h3>معيار السلالة حسب العمر</h3><table><thead><tr><th>المؤشر</th><th>الأداء الفعلي</th><th>معيار الكتالوج</th><th>الفرق</th></tr></thead><tbody>${rows.join('')}</tbody></table><div class="note">${esc(catLabelForStandard(key))}. ${at.interpolated?'القيمة المرجعية للعمر الحالي مقدرة خطيًا بين نقاط الكتالوج الأسبوعية.':''}</div>`;
}
function catLabelForStandard(key){return BROILER_STANDARD_CATALOG[key]?.source||key;}
function performanceRuleFor(c){const a=age(c),b=String(c.breed||'').toLowerCase();return (db.performanceRules||[]).filter(r=>r.breed.toLowerCase()===b&&+r.ageDay<=a).sort((x,y)=>+y.ageDay-+x.ageDay)[0]||null;}
function performanceAssessment(c,x){const r=performanceRuleFor(c);if(!r)return `<div class="note">تقييم المؤشرات: <b>ممتاز</b> عند تحقيق الهدف، <b>جيد</b> ضمن هامش 7% من الهدف، و<b>ضعيف</b> خارج ذلك. عند وجود معيار محفوظ للسلالة والعمر يتم استخدامه أولًا.</div>`;const checks=[];if(r.targetWeight>0)checks.push(x.w>=r.targetWeight);if(r.targetFcr>0)checks.push(x.fcr>0&&x.fcr<=r.targetFcr);if(r.targetAdg>0)checks.push(x.adg>=r.targetAdg);if(r.maxCv>0)checks.push(x.cv<=r.maxCv);if(r.minEpef>0)checks.push(x.epef>=r.minEpef);if(r.maxMortality>0)checks.push(x.dead/c.birds*100<=r.maxMortality);const ok=checks.length&&checks.every(Boolean);return `<div class="note ${ok?'success':'warning'}"><b>مقارنة بالمعيار:</b> ${ok?'ضمن المعيار':'يحتاج مراجعة'} — ${esc(r.breed)} / ${r.ageDay} يوم</div>`;}
function createInvitation(){if(!supabaseClient)return alert('اربط Supabase أولًا لإنشاء دعوة مركزية.');const farmId=inviteFarm.value,email=normalizeEmail(inviteEmail.value),role=inviteRole.value;if(!farmId||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return alert('أدخل بريدًا صحيحًا واختر المزرعة.');if(!requirePermission('users',farmId))return;const token=(crypto?.randomUUID?crypto.randomUUID():uuid());supabaseClient.from('invitations').insert({farm_id:farmId,email,role,token,invited_by:currentUser.id}).then(({error})=>{if(error)return alert(error.message);const link=location.href.split('#')[0]+'#invite='+encodeURIComponent(token);inviteResult.innerHTML=`تم إنشاء الدعوة. <button class="btn" onclick="navigator.clipboard.writeText('${link}')">نسخ رابط الدعوة</button><br><small>${esc(link)}</small>`;audit('create','invitation',token,{farmId,email,role});save();});}
function updateDashboardFarmOptions(){
  if(!dashboardFarm||!dashboardHouse)return;
  const oldFarm=dashboardFarm.value;
  dashboardFarm.innerHTML='<option value="">كل المزارع</option>'+db.farms.map(f=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');
  if(oldFarm&&[...dashboardFarm.options].some(o=>o.value===oldFarm))dashboardFarm.value=oldFarm;
  updateDashboardHouseFilter(true);
}
function updateDashboardHouseFilter(preserve=true){
  if(!dashboardFarm||!dashboardHouse)return;
  const old=preserve?dashboardHouse.value:'';
  const fid=dashboardFarm.value;
  const houses=db.houses.filter(h=>!fid||h.farmId===fid);
  dashboardHouse.innerHTML='<option value="">كل العنابر</option>'+houses.map(h=>`<option value="${h.id}">${esc(h.name)}</option>`).join('');
  if(old&&[...dashboardHouse.options].some(o=>o.value===old))dashboardHouse.value=old;
  else dashboardHouse.value='';
  renderDashboardSelection();
}
function renderDashboardSelection(){
  if(!dashboardSelectionBox)return;
  const fid=dashboardFarm?.value||'',hid=dashboardHouse?.value||'';
  const cycles=db.cycles.filter(c=>(!fid||c.farmId===fid)&&(!hid||c.houseId===hid));
  const received=cycles.reduce((s,c)=>s+(+c.birds||0),0);
  const dead=cycles.reduce((s,c)=>s+deadTotal(c),0);
  const cull=cycles.reduce((s,c)=>s+cullTotal(c),0);
  const sold=cycles.reduce((s,c)=>s+saleBirdsTotal(c),0);
  const live=cycles.reduce((s,c)=>s+currentLive(c),0);
  const feed=cycles.reduce((s,c)=>s+feedTotal(c),0);
  const revenue=cycles.reduce((s,c)=>s+calc(c).saleRevenue,0);
  const label=fid?(getFarmName(fid)+(hid?' — '+getHouseName(hid):'')):(hid?getHouseName(hid):'كل المزارع والعنابر');
  dashboardSelectionBox.innerHTML=`<div class="card"><div class="muted">النطاق المحدد</div><div class="kpi">${esc(label)}</div><div class="muted">${cycles.length} دورة</div></div>
  <div class="card">الاستقبال<div class="num">${received.toLocaleString()}</div><div class="muted">طائر</div></div>
  <div class="card">الحي الحالي<div class="num">${live.toLocaleString()}</div><div class="muted">طائر</div></div>
  <div class="card">النافق<div class="num">${dead.toLocaleString()}</div><div class="muted">طائر</div></div>
  <div class="card">المستبعد<div class="num">${cull.toLocaleString()}</div><div class="muted">طائر</div></div>
  <div class="card">الطيور المباعة<div class="num">${sold.toLocaleString()}</div><div class="muted">طائر</div></div>
  <div class="card">العلف الفعلي<div class="num">${feed.toFixed(1)}</div><div class="muted">كجم</div></div>
  <div class="card">المبيعات الفعلية<div class="num">${revenue.toFixed(2)}</div><div class="muted">${currencyCode(db.settings?.currency||'SAR')}</div></div>`;
}
function renderFeedTable(){const fid=feedFarmFilter?.value||'',hids=getMultiValues(feedHouseFilter);const rows=db.feed.filter(r=>{const c=cyc(r.cycleId);return c&&(!fid||c.farmId===fid)&&(!hids.length||hids.includes(c.houseId))}).sort((a,b)=>b.date.localeCompare(a.date));feedTable.innerHTML=rows.map(r=>{const c=cyc(r.cycleId),cur=currencyCode(r.currency||getCycleCurrency(c));return `<tr><td>${r.date}</td><td>${esc(getFarmName(c?.farmId))}</td><td>${esc(getHouseName(c?.houseId))}</td><td>${c?r.date+' / '+esc(c.breed||'-'):'-'}</td><td>${esc(r.type)}</td><td>${r.qty}</td><td>${r.price} ${cur}</td><td>${(r.qty*r.price).toFixed(2)} ${cur}</td><td><button class="btn" data-action="edit" data-type="feed" data-id="${r.id}">تعديل</button> <button class="btn danger" data-action="delete" data-type="feed" data-id="${r.id}">حذف</button></td></tr>`}).join('')||'<tr><td colspan="9">لا توجد بيانات ضمن النطاق.</td></tr>';}
function renderMedTable(){const fid=medFarmFilter?.value||'',hids=getMultiValues(medHouseFilter);const rows=db.meds.filter(r=>{const c=cyc(r.cycleId);return c&&(!fid||c.farmId===fid)&&(!hids.length||hids.includes(c.houseId))}).sort((a,b)=>b.date.localeCompare(a.date));medTable.innerHTML=rows.map(r=>{const c=cyc(r.cycleId),cur=currencyCode(r.currency||getCycleCurrency(c));return `<tr><td>${r.date}</td><td>${esc(getFarmName(c?.farmId))}</td><td>${esc(getHouseName(c?.houseId))}</td><td>${c?c.date:'-'}</td><td>${esc(r.type)}</td><td>${esc(r.name)}</td><td>${r.qty}</td><td>${(+r.cost||0).toFixed(2)} ${cur}</td><td>${r.withdrawal}</td><td><button class="btn" data-action="edit" data-type="med" data-id="${r.id}">تعديل</button> <button class="btn danger" data-action="delete" data-type="meds" data-id="${r.id}">حذف</button></td></tr>`}).join('')||'<tr><td colspan="10">لا توجد بيانات ضمن النطاق.</td></tr>';}
function renderInventoryTable(fid='',allowedFarms=[]){const rows=db.inventory.filter(r=>(!fid||r.farmId===fid)&&(!allowedFarms.length||allowedFarms.includes(r.farmId)));inventoryTable.innerHTML=rows.map(r=>`<tr><td>${esc(getFarmName(r.farmId))}</td><td>${esc(r.item)}</td><td>${esc(r.unit)}</td><td>${r.balance}</td><td>${r.min}</td><td class="${r.balance<=r.min?'warning':'success'}">${r.balance<=r.min?'إعادة طلب':'جيد'}</td><td><button class="btn" data-action="edit" data-type="inventory" data-id="${r.id}">تعديل</button> <button class="btn danger" data-action="delete" data-type="inventory" data-id="${r.id}">حذف</button></td></tr>`).join('')||'<tr><td colspan="7">لا يوجد مخزون ضمن النطاق.</td></tr>';}
function renderAll(){
  applyRoleUI(); updateCurrencyUI();
  const ua=document.getElementById('userArea');if(ua)ua.innerHTML=currentUser?`${esc(currentUser.name)} — ${esc(currentUser.role)} <button class="btn" style="margin-right:6px;padding:4px 8px" onclick="logoutUser()">خروج</button>`:'';
  farmCount.textContent=db.farms.length;houseCount.textContent=db.houses.length;const activeCycles=db.cycles.filter(c=>c.active);document.getElementById('activeCycles').textContent=activeCycles.length;
  const liveCycles=db.cycles.filter(c=>liveAtDate(c,today())>0);const totalLive=liveCycles.reduce((s,c)=>s+liveAtDate(c,today()),0),totalLiveKg=liveCycles.reduce((s,c)=>s+calc(c).liveKg,0),fcrs=activeCycles.map(c=>calc(c).fcr).filter(v=>v>0);
  birdCount.textContent=totalLive.toLocaleString();
  deadCount.textContent=db.cycles.reduce((s,c)=>s+deadTotal(c),0).toLocaleString();
  soldBirdCount.textContent=db.cycles.reduce((s,c)=>s+saleBirdsTotal(c),0).toLocaleString();
  liveKgCount.textContent=totalLiveKg.toFixed(1);avgFcrCount.textContent=fcrs.length?(fcrs.reduce((a,b)=>a+b,0)/fcrs.length).toFixed(3):'-';feedConsumedCount.textContent=db.cycles.reduce((s,c)=>s+feedConsumedTotal(c),0).toFixed(1);feedActualCount.textContent=db.cycles.reduce((s,c)=>s+feedActualTotal(c),0).toFixed(1);const exec=activeCycles.reduce((a,c)=>{const z=calc(c);a.rev+=z.saleRevenue;a.profit+=z.profit;if(z.cv>0)a.cvs.push(z.cv);return a},{rev:0,profit:0,cvs:[]});dashboardRevenue.textContent=exec.rev.toFixed(2);dashboardProfit.textContent=exec.profit.toFixed(2);dashboardCurrency2.textContent=currencyCode(db.settings.currency);dashboardCurrency3.textContent=currencyCode(db.settings.currency);dashboardCv.textContent=exec.cvs.length?(exec.cvs.reduce((a,b)=>a+b,0)/exec.cvs.length).toFixed(2)+'%':'-';
  setFarmOptions(houseFarm);setFarmOptions(invFarm);setFarmOptions(memberFarm);setFarmOptions(cycleFarm);setFarmOptions(inviteFarm);setFarmOptions(finFarm);
  setAllFarmOptions(feedFarmFilter,true);updateFeedScope(true);setAllFarmOptions(medFarmFilter,true);updateMedScope(true);setAllFarmOptions(invFilterFarm,true);updateInventoryScope(true);setAllFarmOptions(finFilterFarm,true);updateFinanceScope(true);
  updateDashboardFarmOptions();
  if(finFarm.value)fillFinanceCycle();
  updateSaleBirdsFromCycle();
  fillHouseSelect();[dailyCycle,weightCycle,reportCycle].forEach(sel=>opts(sel));
  setAllFarmOptions(perfFarm,true);fillPerfHouse(true);setCompareFarmOptions(true);fillCompareHouse(true);
  farmTable.innerHTML=db.farms.map(f=>`<tr><td>${esc(f.name)}</td><td>${esc(f.companyName||'')}</td><td>${esc(f.licenseNumber||'')}</td><td>${esc(f.owner)}</td><td>${esc(f.manager)}</td><td>${esc(f.location)}</td><td><button class="btn" data-action="edit" data-type="farm" data-id="${f.id}">تعديل</button> <button class="btn danger" data-action="delete" data-type="farms" data-id="${f.id}">حذف</button></td></tr>`).join('')||'<tr><td colspan="7">لا توجد مزارع.</td></tr>';
  houseTable.innerHTML=db.houses.map(h=>{const active=db.cycles.find(c=>c.houseId===h.id&&c.active);return `<tr><td>${esc(getFarmName(h.farmId))}</td><td>${esc(h.name)}</td><td>${h.capacity}</td><td>${active?`<span class="badge">دورة نشطة: ${active.date}</span>`:'<span class="muted">لا توجد دورة نشطة</span>'}</td><td><button class="btn" data-action="edit" data-type="house" data-id="${h.id}">تعديل</button> <button class="btn danger" data-action="delete" data-type="houses" data-id="${h.id}">حذف</button></td></tr>`}).join('')||'<tr><td colspan="5">لا توجد عنابر.</td></tr>';
  cycleTable.innerHTML=db.cycles.map(c=>`<tr><td>${esc(getFarmName(c.farmId))}</td><td>${esc(getHouseName(c.houseId))}</td><td>${esc(c.breed||'-')}</td><td>${c.date}</td><td>${age(c)}</td><td>${currentLive(c).toLocaleString()}</td><td>${(c.initWeight*1000).toFixed(0)} جم</td><td>${esc(c.currency||'SAR')}</td><td><span class="badge">${c.active?'نشطة':'منتهية'}</span></td><td><button class="btn" data-action="edit" data-type="cycle" data-id="${c.id}">تعديل</button> <button class="btn" onclick="toggleCycle('${c.id}')">${c.active?'إنهاء':'فتح'}</button> <button class="btn danger" data-action="delete" data-type="cycles" data-id="${c.id}">حذف</button></td></tr>`).join('')||'<tr><td colspan="10">لا توجد دورات.</td></tr>';
  dailyTable.innerHTML=db.daily.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(r=>{const c=cyc(r.cycleId),dt=db.daily.filter(x=>x.cycleId===r.cycleId&&x.date<=r.date).reduce((s,x)=>s+(+x.dead||0),0);return `<tr><td>${r.date}</td><td>${esc(getFarmName(c?.farmId))} — ${esc(getHouseName(c?.houseId))}</td><td>${esc(c?.breed||'-')}</td><td>${c?age(c,r.date):'-'}</td><td>${r.dead}</td><td>${r.cull}</td><td>${r.feed}</td><td>${r.water||0}</td><td>${r.weight||'-'}</td><td>${r.temp??'-'}</td><td>${r.humidity??'-'}</td><td>${c?(dt/c.birds*100).toFixed(2):'-'}%</td><td>${esc(r.notes||'-')}</td><td><button class="btn" data-action="edit" data-type="daily" data-id="${r.id}">تعديل</button> <button class="btn danger" data-action="delete" data-type="daily" data-id="${r.id}">حذف</button></td></tr>`}).join('')||'<tr><td colspan="14">لا توجد بيانات.</td></tr>';
  weightTable.innerHTML=db.weights.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(w=>{const c=cyc(w.cycleId);return `<tr><td>${w.date}</td><td>${esc(getFarmName(c?.farmId))} — ${esc(getHouseName(c?.houseId))}</td><td>${esc(c?.breed||'-')}</td><td>${c?age(c,w.date):'-'}</td><td>${w.sample}</td><td>${(+w.avg||0).toFixed(3)}</td><td>${w.min?Number(w.min).toFixed(3):'-'}</td><td>${w.max?Number(w.max).toFixed(3):'-'}</td><td>${w.sd?Number(w.sd).toFixed(3):'-'}</td><td>${w.cv?Number(w.cv).toFixed(2)+'%<br>'+cvBadge(w.cv):'-'}</td><td><button class="btn" data-action="edit" data-type="weight" data-id="${w.id}">تعديل</button> <button class="btn danger" data-action="delete" data-type="weights" data-id="${w.id}">حذف</button></td></tr>`}).join('')||'<tr><td colspan="11">لا توجد أوزان.</td></tr>';
  renderFeedTable();renderMedTable();updateInventoryScope();renderFinance();populateStandardBreedOptions();renderStandardCatalog();renderReport();renderAlerts();renderSales();updateSaleBirdsFromCycle();renderPerformance();renderComparison();renderAudit();renderPerformanceRules();updateCurrencyLabels();updateCurrencyUI();renderDashboardSelection();
}
function removeItem(type,i){
  const key=type==='weights'?'weights':type==='meds'?'meds':type==='sales'?'sales':type;const item=db[key]?.find(x=>x.id===i);const farmId=getFarmForRecord(type,item);if(!requireActionForRecord('delete',type,farmId))return;if(!confirm('حذف السجل؟'))return;if(item)markDeleted(type,item);
  if(type==='farms'){db.farms=db.farms.filter(x=>x.id!==i);db.houses=db.houses.filter(x=>x.farmId!==i);const cs=db.cycles.filter(x=>x.farmId===i).map(x=>x.id);db.cycles=db.cycles.filter(x=>x.farmId!==i);['daily','weights','feed','meds','sales'].forEach(k=>db[k]=db[k].filter(x=>!cs.includes(x.cycleId)));db.inventory=db.inventory.filter(x=>x.farmId!==i);Object.keys(db.finance).filter(k=>cs.includes(k)).forEach(k=>delete db.finance[k]);}
  else if(type==='houses'){if(db.cycles.some(c=>c.houseId===i&&c.active))return alert('لا يمكن حذف عنبر لديه دورة نشطة.');db.houses=db.houses.filter(x=>x.id!==i);}
  else if(type==='cycles'){db.cycles=db.cycles.filter(x=>x.id!==i);['daily','weights','feed','meds','sales'].forEach(k=>db[k]=db[k].filter(x=>x.cycleId!==i));delete db.finance[i];}
  else if(type==='finance'){delete db.finance[i];}
  else {db[key]=db[key].filter(x=>x.id!==i);if(item?.cycleId){const rc=cyc(item.cycleId);if(rc&&(type==='sales'||type==='daily'||type==='meds'||type==='feed'))refreshFinancialSnapshot(rc);}}audit('delete',type,i,{farmId,before:item});save();
}
function toggleCycle(i){const c=cyc(i);if(!c)return;if(!requireActionForRecord('edit','cycle',c.farmId))return;if(!c.active){const other=db.cycles.find(x=>x.id!==c.id&&x.houseId===c.houseId&&x.active);if(other)return alert('لا يمكن إعادة فتح الدورة لأن العنبر لديه دورة نشطة بالفعل.');}c.active=!c.active;c.updatedAt=new Date().toISOString();save();}
function renderAlerts(){
  const a=[];db.inventory.filter(x=>x.balance<=x.min).forEach(x=>a.push(`المخزون منخفض: ${x.item} — الرصيد ${x.balance} ${x.unit}`));
  db.cycles.filter(c=>c.active).forEach(c=>{const x=calc(c),days=age(c),farm=getFarmName(c.farmId),house=getHouseName(c.houseId);if(days>0&&x.w===0)a.push(`لا يوجد وزن مسجل للدورة ${farm} / ${house}.`);const lastW=lastWeight(c);if(days>=7&&(!lastW||days-age(c,lastW.date)>7))a.push(`تأخر الوزن الأسبوعي في ${farm} / ${house}.`);if(x.cv>15)a.push(`CV مرتفع للمراجعة في ${farm} / ${house}: ${x.cv.toFixed(1)}%.`);if(days>=21&&x.fcr>2.0)a.push(`FCR مرتفع للمراجعة في ${farm} / ${house}: ${x.fcr.toFixed(3)}.`);if(x.dead>c.birds)a.push(`النفوق المسجل يتجاوز عدد الاستقبال في ${farm} / ${house} — راجع الإدخالات.`);if(x.liv<0)a.push(`الحي الحالي أصبح سالبًا في ${farm} / ${house} — راجع المبيعات والنفوق.`);});
  db.houses.forEach(h=>{const active=db.cycles.filter(c=>c.houseId===h.id&&c.active);if(active.length>1)a.push(`يوجد أكثر من دورة نشطة على العنبر ${h.name} — يجب تصحيح البيانات.`)});
  alerts.innerHTML=a.length?a.map(x=>`<div class="note warning" style="margin:5px 0">${esc(x)}</div>`).join(''):'لا توجد تنبيهات.';
}
Object.assign(UI_EN,{
  'إيجار المشروع':'Project Rent','تكلفة الديزل':'Diesel Cost','كهرباء':'Electricity','ماء':'Water','عمال':'Labor','نشارة':'Shavings/Litter','نقل':'Transport','تحميل دجاج':'Chicken Loading','مصاريف أخرى':'Other Expenses','بند مصروف المشروع':'Project Expense Item','قيمة المصروف':'Expense Amount','إضافة بند مصروف':'Add Expense Item','مصروفات المشروع المسجلة للدورة':'Project Expenses Recorded for This Cycle','لا توجد بنود مصروف مسجلة لهذه الدورة.':'No project expense items recorded for this cycle.','إجمالي مصروفات المشروع':'Total Project Expenses','حذف بند المصروف؟':'Delete expense item?','اختر الدورة أولًا.':'Select a cycle first.','أدخل قيمة المصروف.':'Enter the expense amount.','كتالوج معايير الأداء حسب السلالة والعمر':'Performance Standards Catalog by Breed and Age','السلالة المرجعية':'Reference Breed','العمر (يوم)':'Age (days)','اختيار السلالة / استخدام سلالة الدورة':'Select breed / use cycle breed','معيار الكتالوج':'Catalog Standard','المعيار المنشور':'Published Standard','الأداء الفعلي':'Actual Performance','الفرق':'Difference','المصدر:':'Source:','المصدر':'Source','جم':'g','جم/يوم':'g/day','يوم':'days','وزن الجسم':'Body Weight','العلف التراكمي':'Cumulative Feed','معامل التحويل الغذائي (FCR)':'Feed Conversion Ratio (FCR)','مؤشر الإنتاج (PI)':'Production Index (PI)','معدل الزيادة اليومية (ADG)':'Average Daily Gain (ADG)','معامل التباين (CV%)':'Coefficient of Variation (CV%)','مؤشر كفاءة الإنتاج (EPEF / EPI)':'European Production Efficiency Factor (EPEF / EPI)','مؤشر الكفاءة الاقتصادية (EBEF)':'Economic Broiler Efficiency Factor (EBEF)','المعامل الاقتصادي (EC)':'Economic Coefficient (EC)','معيار السلالة حسب العمر':'Breed Standard by Age','الوزن المرجعي':'Reference Weight','FCR المرجعي':'Reference FCR','ADG المرجعي':'Reference ADG','غير منشور':'Not published','السلالة المرجعية هدف أداء وليس ضمانًا لنتيجة الحقل؛ راعِ إدارة المزرعة والبيئة والتغذية والصحة عند تفسير الفرق.':'The reference is a performance target, not a field-performance guarantee; consider farm management, environment, nutrition, and health when interpreting differences.','معايير مرجعية منشورة من شركات وراثية. تختلف النتائج الفعلية حسب الإدارة والبيئة والتغذية والصحة. الأعمار غير الأسبوعية بين نقاط الكتالوج تُقدّر خطيًا بواسطة التطبيق.':'Reference standards published by breeding companies. Actual results vary with management, environment, nutrition, and health. Non-weekly ages between catalog points are linearly estimated by the app.','المعيار المرجعي هدف أداء وليس ضمانًا لنتيجة الحقل؛ راعِ إدارة المزرعة والبيئة والتغذية والصحة عند تفسير الفرق.':'The reference is a performance target, not a field-performance guarantee; consider farm management, environment, nutrition, and health when interpreting differences.','لا يوجد معيار مدمج للسلالة الحالية. استخدم كتالوج المعايير أعلى التقرير أو أضف معيارًا مخصصًا من الإعدادات.':'No built-in standard is available for the current breed. Use the standards catalog above the report or add a custom standard in Settings.','القيمة عند هذا العمر تقدير خطي بين نقطتي الكتالوج الأقرب.':'The value at this age is a linear estimate between the nearest catalog points.','الكتالوج المختصر المستخدم هنا لا ينشر استهلاكًا تراكميًا لهذه السلالة في البيانات المضافة.':'The concise catalog used here does not publish cumulative feed intake for this breed in the added data.','مصدر:':'Source:','إجمالي مصروفات المشروع':'Total Project Expenses','روس 308':'Ross 308','روس 708':'Ross 708','أربور إيكرز بلس':'Arbor Acres Plus','إنديان ريفر':'Indian River','هبارد إفيشنسي بلس':'Hubbard Efficiency Plus'
});
document.addEventListener('click',function(ev){const b=ev.target.closest('[data-action]');if(!b)return;const action=b.dataset.action,type=b.dataset.type,id=b.dataset.id;if(action==='edit'){ev.preventDefault();beginEdit(type,id)}else if(action==='delete'){ev.preventDefault();removeItem(type,id)}});
weightSampleWeights.addEventListener('input',updateWeightStatsFromSample);if(globalCurrency)globalCurrency.addEventListener('change',previewGlobalCurrency);
cycleDate.value=today();dailyDate.value=today();weightDate.value=today();feedDate.value=today();medDate.value=today();saleDate.value=today();bootAuth();
