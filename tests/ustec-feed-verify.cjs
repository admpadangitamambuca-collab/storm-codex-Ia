'use strict';
const frames=[['M1','1m',60000],['M5','5m',300000],['M15','15m',900000],['H1','1h',3600000]];
async function read(url){
 const c=new AbortController(),t=setTimeout(()=>c.abort(),7000);
 try{const r=await fetch(url,{signal:c.signal});const d=await r.json();return {status:r.status,data:d}}catch(e){return {error:String(e.message||e)}}finally{clearTimeout(t)}
}
(async()=>{
 console.log('VERIFY_USTEC_START',new Date().toISOString());
 const q=await read('https://biquote.io/api/USTEC?allowStale=false'),d=q.data||{};
 console.log('TICK',JSON.stringify({http:q.status,symbol:d.symbol,marketState:d.marketState,source:d.source,stale:d.stale,
 quoteAgeSeconds:d.quoteAgeSeconds,lastQuoteAt:d.lastQuoteAt,time:d.time,timestamp:d.timestamp,mid:d.mid,
 bid:d.bid,ask:d.ask,error:q.error}));
 for(const [tf,iv,ms] of frames){
  const r=await read('https://biquote.io/api/USTEC/ohlc?interval='+iv+'&limit=150'),v=r.data||{},bars=v.bars||[];
  const sorted=bars.slice().sort((a,b)=>Date.parse(a.time||a.openTime||a.t)-Date.parse(b.time||b.openTime||b.t));
  const closed=sorted.filter(b=>b.isOpen!==true);
  const last=closed.at(-1),open=sorted.at(-1);
  const tm=x=>Date.parse(x?.time||x?.openTime||x?.t||'');
  console.log('OHLC',tf,JSON.stringify({http:r.status,symbol:v.symbol,interval:v.interval,
   count:bars.length,closed:closed.length,lastClosed:last,
   lastClosedAgeSec:Number.isFinite(tm(last))?Math.round((Date.now()-(tm(last)+ms))/1000):null,
   newest:open,keys:bars[0]?Object.keys(bars[0]):[],error:r.error}));
 }
 console.log('VERIFY_USTEC_END',new Date().toISOString());
})().catch(e=>{console.error(e);process.exitCode=1});
