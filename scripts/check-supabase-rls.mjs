/* Read-only RLS smoke test: use disposable staging accounts belonging to different farms.
   No service_role key or admin token is ever requested. */
const vars=['SUPABASE_URL','SUPABASE_ANON_KEY','PFM_TEST_USER_A_EMAIL','PFM_TEST_USER_A_PASSWORD','PFM_TEST_USER_B_EMAIL','PFM_TEST_USER_B_PASSWORD','PFM_TEST_FARM_A_ID'];
const missing=vars.filter(v=>!process.env[v]);if(missing.length){console.error('Missing env:',missing.join(', '));process.exit(2)}
const get=k=>process.env[k]; const url=get('SUPABASE_URL').replace(/\/$/,'');
if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(url)){throw Error('Expected secure Supabase hosted staging project URL')}
async function auth(which){const resp=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{'Content-Type':'application/json',apikey:get('SUPABASE_ANON_KEY')},body:JSON.stringify({email:get('PFM_TEST_USER_'+which+'_EMAIL'),password:get('PFM_TEST_USER_'+which+'_PASSWORD')})});const j=await resp.json();if(!resp.ok||!j.access_token)throw Error('Test account '+which+' login failed (HTTP '+resp.status+')');return j.access_token}
async function view(jwt,table,condition){const r=await fetch(url+'/rest/v1/'+table+'?'+condition+'&select=id',{headers:{apikey:get('SUPABASE_ANON_KEY'),Authorization:'Bearer '+jwt,'Accept':'application/json'}});if(!r.ok)throw Error(table+' query failed HTTP '+r.status+': '+(await r.text()).slice(0,200));return r.json()}
const a=await auth('A'),b=await auth('B'),fid=get('PFM_TEST_FARM_A_ID');
if(!/^[0-9a-f-]{36}$/i.test(fid))throw Error('Farm A ID must be UUID');
const scope='id=eq.'+encodeURIComponent(fid);
const aResult=await view(a,'farms',scope),bResult=await view(b,'farms',scope);
if(aResult.length!==1)throw Error('FAIL: account A cannot see its own farm');
if(bResult.length!==0)throw Error('SECURITY FAIL: account B can see farm A');
console.log('PASS (read isolation only): Owner A sees farm A; unrelated account B cannot read it.');
console.log('NOT TESTED: write/delete RLS, role changes, multi-device conflict resolution. Run destructive tests only on staging.');
