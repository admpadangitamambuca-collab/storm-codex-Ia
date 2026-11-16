'use strict';
const now=Date.now();
async function load(name,url){
 const c=new AbortController();const t=setTimeout(()=>c.abort(),12000);
 try{
 const r=await fetch(url,{signal:c.signal,headers:{Accept:'application/json','User-Agent':'StormCodexXAUProbe/1.0'}});
 const j=await r.json();
 const info={name,status:r.status,at:new Date().toISOString(),keys:Object.keys(j||{}).slice(0,30)};
 const rows=Array.isArray(j)?j:Array.isArray(j?.bars)?j.bars:Array.isArray(j?.data?.bars)?j.data.bars:Array.isArray(j?.ticks)?j.ticks:Array.isArray(j?.history)?j.history:Array.isArray(j?.points)?j.points:null;
 if(rows){
  info.count=rows.length;info.first=rows[0];info.last=rows.at(-1);
  for(const row of [rows[0],rows.at(-1)]){
   const stamp=row?.timestamp||row?.time||row?.openTime||row?.t||row?.date;
   if(stamp){const ts=Number(stamp);info.timestamps=(info.timestamps||[]).concat([stamp,Number.isFinite(ts)?now-(ts<1e11?ts*1000:ts):now-Date.parse(stamp)]);}
  }
 }else{
  for(const k of ['symbol','timestamp','mid','bid','ask','stale','quoteAgeSeconds','marketState','updated_at','data_state','message','error','price','source','interval','barCount'])if(j?.[k]!==undefined)info[k]=j[k];
 }
 console.log(JSON.stringify(info));
 }catch(e){console.log(JSON.stringify({name,error:String(e?.message||e)}))}
 finally{clearTimeout(t)}
}
async function run(){
 const queries=[
 ['xau-ohlc-m1','https://biquote.io/api/XAUUSD/ohlc?interval=1m&limit=350'],
 ['xau-ohlc-m5','https://biquote.io/api/XAUUSD/ohlc?interval=5m&limit=350'],
 ['xau-ohlc-m15','https://biquote.io/api/XAUUSD/ohlc?interval=15m&limit=350'],
 ['xau-ohlc-h1','https://biquote.io/api/XAUUSD/ohlc?interval=1h&limit=350'],
 ['xau-tick','https://biquote.io/api/XAUUSD?allowStale=false'],
 ['xau-history','https://biquote.io/api/XAUUSD/history?count=1000'],
 ['xau-alternate','https://xaus.com/api/v1/chart?symbol=xau&range=5d&interval=1m'],
 ['xau-spot','https://xaus.com/api/v1/spot?compact=1']
 ];
 await Promise.all(queries.map(([name,url])=>load(name,url)));
}
run().catch(e=>{console.error(e);process.exitCode=1});