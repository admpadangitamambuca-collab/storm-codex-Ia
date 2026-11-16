#!/usr/bin/env node
'use strict';
/* Post-Netlify Blobs v2 migration re-check 16 Nov 2026.
 * Read-only verification of Storm Codex Netlify production.  Does not
 * invoke any scheduled workers, modify storage, or disclose secrets. */
const TARGET='https://codextrading.netlify.app';
const probes=[
  {name:'site',path:'/',kind:'html'},
  {name:'v115-js',path:'/storm-monitor-status-v115.js',kind:'js'},
  {name:'v114-js',path:'/storm-lab-v114.js',kind:'js'},
  {name:'status',path:'/.netlify/functions/storm-status',kind:'json'},
  {name:'b3-live',path:'/.netlify/functions/b3-live-ohlc?asset=WIN&tf=M5',kind:'json'},
  {name:'b3-reference',path:'/.netlify/functions/b3-quote?asset=WIN',kind:'json'},
  {name:'nasdaq',path:'/.netlify/functions/nasdaq-ohlc?tf=M5',kind:'json'},
];
async function probe(item){
  const url=TARGET+item.path, ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),14000);
  const started=Date.now();let r,body;
  try{
    r=await fetch(url,{signal:ctl.signal,redirect:'follow',headers:{accept:item.kind==='json'?'application/json':'text/html,*/*','user-agent':'StormCodex-Live-Audit/11.5'}});
    body=await r.text();
  }catch(e){return {name:item.name,url,networkError:String(e.message||e).slice(0,220),ms:Date.now()-started}}
  finally{clearTimeout(timer)}
  const result={name:item.name,url,status:r.status,contentType:r.headers.get('content-type'),ms:Date.now()-started,
    bytes:Buffer.byteLength(body),redirected:r.redirected,finalUrl:r.url};
  if(item.kind==='html'){
    result.hasV115=body.includes('Storm Códex IA 11.5')||body.includes('storm-monitor-status-v115.js');
    result.hasV114=body.includes('storm-lab-v114.js');
    result.hasWorkerClient=body.includes('storm-monitor-status-v115.js');
    result.hasB3Module=body.includes('b3-indices-v111.js');
    result.title=(body.match(/<title>([^<]*)<\/title>/i)||[])[1]||null;
    result.head=body.slice(0,120).replace(/\s+/g,' ');
  }else if(item.kind==='js'){
    result.validJS=r.ok&&(/javascript|ecmascript|text\/plain/.test(result.contentType||'')||body.includes('Storm Codex'))&&!body.includes('<!doctype html>');
    result.beginning=body.slice(0,100).replace(/\s+/g,' ');
  }else{
    try{
      const json=JSON.parse(body);
      result.body=Object.fromEntries(Object.entries(json).filter(([k])=>!/(secret|token|password|authorization)/i.test(k))
        .map(([k,v])=>[k,JSON.stringify(v).slice(0,k==='feeds'?1200:300)]));
      if(item.name==='status'){
        result.workerState=json.status||null;
        result.lastCycle=json.checkedAt||null;
        result.ageMs=Number.isFinite(json.ageMs)?json.ageMs:null;
        result.feeds=Array.isArray(json.feeds)?json.feeds.length:null;
      }
    }catch(e){result.textPrefix=body.slice(0,250).replace(/\s+/g,' ')}
  }
  return result;
}
async function run(){
 const results=await Promise.all(probes.map(probe));
 const by=Object.fromEntries(results.map(r=>[r.name,r]));
 const verdict={
  inspectedAt:new Date().toISOString(),site:TARGET,
  siteReachable:by.site.status===200&&by.site.bytes>4000,
  v115Deployed:by.site.status===200&&by.site.hasV115&&by['v115-js'].validJS,
  monitorFunctionPublished:by.status.status===200&&by.status.workerState!==null,
  monitorHasCompletedCycle:by.status.workerState==='OBSERVING'&&Number.isFinite(by.status.ageMs)&&by.status.ageMs>=0,
  monitorRecent:by.status.workerState==='OBSERVING'&&Number.isFinite(by.status.ageMs)&&by.status.ageMs<16*60000,
  b3RealtimeAvailable:by['b3-live'].status===200&&by['b3-live'].body?.feedVerified==='true',
  results
 };
 console.log(JSON.stringify(verdict,null,2));
}
run().catch(e=>{console.error(e);process.exitCode=1});
