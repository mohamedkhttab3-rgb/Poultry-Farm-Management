// Poultry Farm Manager - safe Supabase configuration bridge.
// This file intentionally contains NO secret/service-role key.
// A real Project URL + Publishable/Anon key may be supplied by the user's
// existing V3.6 config file or by a previously saved local configuration.
(function(){
  // V8 shared cloud project; publishable key is intentionally public. Never add service_role/secret keys.
  const empty={url:'https://flqyqpqwnwncmrdgnocd.supabase.co',publishableKey:"sb_publishable_ObB0P7RnYBG-9JMUj6evTg__NHhLPFf",redirectTo:''};
  const isReal=(c)=>{
    const url=String(c?.url||'').trim();
    const key=String(c?.publishableKey||c?.anonKey||'').trim();
    return /^https:\/\/[A-Za-z0-9.-]+\.supabase\.co\/?$/.test(url)
      && key.length>20
      && !/YOUR_PROJECT|YOUR_SUPABASE|YOUR_APP_DOMAIN/i.test(url+' '+key);
  };
  const normal=(c)=>isReal(c)?{
    url:String(c.url).trim().replace(/\/$/,''),
    publishableKey:String(c.publishableKey||c.anonKey).trim(),
    redirectTo:String(c.redirectTo||'').trim()
  }:empty;
  let direct=null, stored=null;
  try{ direct=window.PFM_SUPABASE_CONFIG||null; }catch(_){ direct=null; }
  try{
    const keys=['pfm_supabase_config_v36','pfm_supabase_config_v1'];
    for(const k of keys){
      try{const raw=localStorage.getItem(k);if(raw){const x=JSON.parse(raw);if(isReal(x)){stored=x;break;}}}catch(_){}}
  }catch(_){ }
  window.PFM_SUPABASE_CONFIG = isReal(direct) ? normal(direct) : (stored ? normal(stored) : empty);
})();
