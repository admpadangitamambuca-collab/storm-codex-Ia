/* Modern Netlify Function v2 automatically injects Blobs credentials.
 * Public endpoint returns only aggregate market/monitor health. */
import { getStore } from '@netlify/blobs';
const reply=(code,obj)=>new Response(JSON.stringify(obj),{status:code,headers:{
 'content-type':'application/json; charset=utf-8','cache-control':'no-store'
}});
export default async function handler(request,context){
 if(request.method!=='GET')return reply(405,{error:'GET only'});
 try{
  const store=getStore('storm-codex-monitor-v115');
  const snapshot=await store.get('status-v115',{type:'json',consistency:'strong'});
  if(!snapshot)return reply(200,{version:'11.6',status:'NOT_STARTED',
   message:'Monitor publicado mas sem ciclo agendado persistido'});
  const results=Array.isArray(snapshot.results)?snapshot.results:[];
  const ageMs=Date.now()-snapshot.checkedAt;
  const healthState=Number.isFinite(ageMs)&&ageMs>=0&&ageMs<=12*60000?'OBSERVING':'DELAYED';
  return reply(200,{version:'11.6',status:healthState,checkedAt:snapshot.checkedAt,
   cadenceMinutes:1,ageMs,healthy:snapshot.healthy,failed:snapshot.failed,
   persisted:snapshot.persisted,macroVerified:snapshot.macroVerified,
   xauReference:snapshot.xauReference||null,
   simulated:{pending:results.reduce((n,x)=>n+(x.pending||0),0),
    closed:results.reduce((n,x)=>n+(x.closed||0),0)},
   feeds:results.map(x=>({asset:x.asset,tf:x.tf,state:x.state,
    lastClosedAt:x.lastClosedAt||null,count:x.count||0,
    pending:x.pending||0,closed:x.closed||0,readings:x.readings||null,
    source:x.source||null,error:x.error||null}))});
 }catch(e){
  return reply(503,{version:'11.6',status:'UNAVAILABLE',
   message:String(e.message||e).slice(0,160)});
 }
}
