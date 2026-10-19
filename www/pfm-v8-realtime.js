/* Poultry Farm Management V8 — realtime changes from the existing Supabase project.
 * The channel is account-scoped. Row Level Security is always enforced server-side.
 * No writes, data migrations, or local data replacement are performed here.
 * REST/CAS sync remains the sole transport for durable document content. */
(function(root){'use strict';
 function create(options){
  const {client,onChange,onStatus}=options||{};
  if(!client||typeof client.channel!=='function'||typeof client.removeChannel!=='function')
   throw Error('Supabase Realtime is unavailable');
  if(typeof onChange!=='function')throw Error('Missing Realtime sync callback');
  let channel=null, userId=null, stopped=true, retry=null, attempt=0, generation=0;
  function status(value){
   if(typeof onStatus==='function')onStatus(value);
  }
  function cancelRetry(){
   if(retry!==null){clearTimeout(retry);retry=null;}
  }
  function detach(){
   const previous=channel;channel=null;
   if(previous)try{Promise.resolve(client.removeChannel(previous)).catch(()=>{});}catch(_){}
  }
  function reconnect(){
   if(stopped||retry!==null)return;
   const delay=Math.min(30000,1000*Math.pow(2,Math.min(attempt++,5)));
   retry=setTimeout(()=>{retry=null;if(!stopped)connect()},delay);
  }
  function connect(){
   if(stopped||!userId)return;
   cancelRetry();detach();
   const token=++generation,owner=userId;
   const label='pfm-v8-'+owner+'-'+token;
   try{
    const next=client.channel(label,{config:{private:false}});
    channel=next;
    next.on('postgres_changes',{
     event:'*',schema:'public',table:'pfm_sync_records',filter:'owner_id=eq.'+owner
    },event=>{
     if(stopped||generation!==token||userId!==owner)return;
     if(event?.eventType==='INSERT'||event?.eventType==='UPDATE'||event?.eventType==='DELETE')
      onChange();
    });
    next.subscribe(state=>{
     if(stopped||generation!==token)return;
     if(state==='SUBSCRIBED'){attempt=0;status('connected');onChange();}
     else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT'||state==='CLOSED'){
      status('disconnected');reconnect();
     }
    });
   }catch(e){status('disconnected');reconnect();}
  }
  function start(id){
   if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))
    throw Error('Expected authenticated Supabase user id');
   if(!stopped&&userId===id)return;
   stop();userId=id;stopped=false;attempt=0;connect();
  }
  function stop(){
   stopped=true;userId=null;generation++;cancelRetry();detach();
  }
  function reconnectNow(){
   if(stopped||!userId)return;
   attempt=0;connect();
  }
  return {start,stop,reconnectNow,get active(){return !stopped&&!!channel;},get userId(){return userId;}};
 }
 root.PFMV8Realtime={create};
})(typeof window!=='undefined'?window:globalThis);
