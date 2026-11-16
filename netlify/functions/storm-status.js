'use strict';
/* Read-only aggregate status of scheduled research observer.
 * This endpoint never exposes customer localStorage, raw trades or credentials.
 */
const allowedHeaders={
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store',
 'access-control-allow-origin':'same-origin'
};
const reply=(code,payload)=>({statusCode:code,headers:allowedHeaders,body:JSON.stringify(payload)});
exports.handler=async(event)=>{
 if(event.httpMethod!=='GET')return reply(405,{error:'GET only'});
 try{
  const {getStore}=await import('@netlify/blobs');
  const store=getStore('storm-codex-monitor-v115');
  const snapshot=await store.get('status-v115',{type:'json',consistency:'strong'});
  if(!snapshot)return reply(200,{version:'11.5',status:'NOT_STARTED',message:'Sem ciclo agendado validado no deploy publicado'});
  const results=Array.isArray(snapshot.results)?snapshot.results:[];
  return reply(200,{version:'11.5',status:'OBSERVING',checkedAt:snapshot.checkedAt,
   ageMs:Date.now()-snapshot.checkedAt,healthy:snapshot.healthy,failed:snapshot.failed,
   persisted:snapshot.persisted,macroVerified:snapshot.macroVerified,
   feeds:results.map(x=>({asset:x.asset,tf:x.tf,state:x.state,
    lastClosedAt:x.lastClosedAt||null,count:x.count||0,
    source:x.source||null,error:x.error||null}))});
 }catch(e){return reply(503,{version:'11.5',status:'UNAVAILABLE',message:String(e.message||e).slice(0,160)})}
};
