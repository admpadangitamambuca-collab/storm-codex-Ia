'use strict';
/* Live provider probe: no credentials, no orders, no fabricated bars.
 * A failing provider is reported, not promoted to "working".
 */
const B3=require('../b3-indices-v111.js');
const {parseBars}=require('../storm-replay-v115.js');
const frame={M1:['1m',60000],M5:['5m',300000],M15:['15m',900000],H1:['1h',3600000]};
async function runProbe(fetcher=fetch,now=Date.now()){
 const products=['XAUUSD','EURUSD','WIN','WDO'],results=[];
 for(const asset of products){
  const tf='M5',symbol=asset==='WIN'||asset==='WDO'?B3.contractFor(asset,now).symbol:asset;
  const url='https://biquote.io/api/'+encodeURIComponent(symbol)+'/ohlc?interval='+frame[tf][0]+'&limit=100';
  const ctl=new AbortController(),time=setTimeout(()=>ctl.abort(),6500);
  try{
   const r=await fetcher(url,{signal:ctl.signal,headers:{Accept:'application/json'}});
   if(!r.ok)throw Error('HTTP '+r.status);
   const d=await r.json();
   const returned=String(d.symbol||d.data?.symbol||'').toUpperCase();
   if(returned!==symbol)throw Error('Símbolo ausente/divergente');
   const raw=Array.isArray(d.bars)?d.bars:d.data?.bars;
   if(!Array.isArray(raw))throw Error('Provedor não enviou candles');
   const ticks=raw.map(x=>{
    let t=x.t??x.openTime??x.time??x.timestamp;
    if(typeof t==='string'&&!/^\d{10,13}$/.test(t))t=Date.parse(t);
    t=Number(t);if(t<1e11)t*=1000;
    return {t,open:Number(x.open??x.o),high:Number(x.high??x.h),
     low:Number(x.low??x.l),close:Number(x.close??x.c),isOpen:x.isOpen===true};
   });
   const unique=new Map();
   for(const x of ticks)if(Number.isFinite(x.t)&&x.t+frame[tf][1]<=now-400&&!x.isOpen)unique.set(x.t,x);
   const closed=[...unique.values()].sort((a,b)=>a.t-b.t);
   const candles=parseBars(closed,tf,now),age=now-(candles.at(-1).t+frame[tf][1]);
   results.push({asset,tf,requested:symbol,returned,ok:true,bars:candles.length,
    lastClosedAt:candles.at(-1).t+frame[tf][1],ageMs:age,currentlyFresh:age>=0&&age<frame[tf][1]+45000});
  }catch(e){results.push({asset,tf,requested:symbol,ok:false,error:String(e.message||e).slice(0,160)})}
  finally{clearTimeout(time)}
 }
 return {checkedAt:now,results,disclaimer:'Provider network probe, not site Netlify test; freshness depends on market hours.'};
}
if(require.main===module){runProbe().then(x=>console.log(JSON.stringify(x,null,2))).catch(e=>{console.error(e);process.exitCode=1})}
module.exports={runProbe};
