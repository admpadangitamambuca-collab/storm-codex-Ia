'use strict';
/* Diagnostic only: public endpoints, no keys, no subscriptions, no credentials.
   Never claim real-time without fresh, verified symbol-specific timestamps. */
const MAX=7_000,wait=ms=>new Promise(ok=>setTimeout(ok,ms));
const oldMs=t=>{
 if(!t)return null;let n=typeof t==='number'?(t<1e11?t*1000:t):Date.parse(String(t));
 return Number.isFinite(n)?Math.round((Date.now()-n)/1000):null;
};
async function getJson(url,opts={}){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),MAX);
 try{
  const res=await fetch(url,{...opts,signal:ctl.signal,headers:{Accept:'application/json','User-Agent':'Mozilla/5.0',...(opts.headers||{})}});
  const t=await res.text();
  let v;try{v=JSON.parse(t)}catch{v={rawPreview:t.slice(0,80)}}
  return {http:res.status,ok:res.ok,value:v};
 }catch(e){return {error:String(e.message||e).slice(0,120)}}finally{clearTimeout(timer)}
}
function unwrapItems(v){
 if(Array.isArray(v))return v;
 for(const x of [v?.items,v?.data,v?.results,v?.symbols])if(Array.isArray(x))return x;
 return [];
}
function summarizeSymbols(r){
 const a=unwrapItems(r.value),filter=a.filter(x=>/nas|ustec|us100|nasdaq|ndx|tech100/i.test(JSON.stringify(x))).slice(0,22);
 return {http:r.http,count:a.length,symbols:filter.map(x=>({name:x.name||x.symbol||x.ticker,description:String(x.description||'').slice(0,60),type:x.type,isLive:x.isLive,live:x.live,lastQuoteAt:x.lastQuoteAt,exchange:x.exchange})),error:r.error};
}
function summarizeTick(r){
 const v=r.value||{},t=v.time??v.timestamp??v.updatedAt??v.quoteTime??v.serverTime??v.lastUpdated??v.t;
 return {http:r.http,symbol:v.symbol||v.name,marketState:v.marketState,quoteStatus:v.status,mid:v.mid,bid:v.bid,ask:v.ask,
  quoteAt:t,quoteAgeSec:oldMs(t),keys:Object.keys(v).slice(0,22),error:r.error};
}
function summarizeBars(r){
 const v=r.value||{},a=unwrapItems({items:v.bars||v.data?.bars||v.data||v.items}),
 last=a.at(-1)||{},first=a[0]||{},t=last.t??last.time??last.openTime??last.timestamp;
 return {http:r.http,symbol:v.symbol||v.data?.symbol,interval:v.interval||v.data?.interval,count:a.length,
  lastTimestamp:t,lastAgeSec:oldMs(t),lastClose:last.close||last.c,lastIsOpen:last.isOpen,
  firstTimestamp:first.t??first.time??first.openTime,
  dataTopKeys:Object.keys(v).slice(0,12),error:r.error};
}
async function run(){
 console.log('SOURCE_PROBE_START',new Date().toISOString());
 const q=['nasdaq','nas100','us100','ustec','ndx'];
 for(const word of q){
  const r=await getJson('https://biquote.io/api/symbols/search?q='+word+'&limit=100');
  console.log('BIQUOTE_SEARCH',word,JSON.stringify(summarizeSymbols(r)));
 }
 const lookups=['NAS100','US100','USTEC','NAS100USD','NASDAQ100','NDX'];
 for(const symbol of lookups){
  const r=await getJson('https://biquote.io/api/'+symbol+'?allowStale=false');
  console.log('BIQUOTE_TICK',symbol,JSON.stringify(summarizeTick(r)));
  if(r.ok){
   const bar=await getJson('https://biquote.io/api/'+symbol+'/ohlc?interval=1m&limit=90');
   console.log('BIQUOTE_OHLC',symbol,JSON.stringify(summarizeBars(bar)));
  }
 }
 for(const [tag,url] of [
  ['MARKETAPI_SYMBOLS','https://api.marketapi.app/v1/free/symbols?q=NAS'],
  ['MARKETAPI_TICK','https://api.marketapi.app/v1/free/prices/latest?symbols=NAS100'],
  ['NASDAQ_OFFICIAL','https://api.nasdaq.com/api/quote/NDX/info?assetclass=index'],
  ['YAHOO_NDX','https://query1.finance.yahoo.com/v8/finance/chart/%5ENDX?interval=1m&range=1d']
 ]){
  const r=await getJson(url);
  if(tag==='MARKETAPI_SYMBOLS')console.log(tag,JSON.stringify(summarizeSymbols(r)));
  else if(tag==='MARKETAPI_TICK')console.log(tag,JSON.stringify(summarizeTick(r)));
  else if(tag==='YAHOO_NDX'){
   const v=r.value?.chart?.result?.[0];
   console.log(tag,JSON.stringify({http:r.http,ticker:v?.meta?.symbol,delay:v?.meta?.exchangeDataDelayedBy,
    last: v?.timestamp?.at(-1),ageSec:oldMs(v?.timestamp?.at(-1)),bars:v?.timestamp?.length,error:r.error}));
  }else{
   const v=r.value?.data;console.log(tag,JSON.stringify({http:r.http,message:v?.message,symbol:v?.symbol,
    primaryData:v?.primaryData,keys:v?Object.keys(v).slice(0,20):[],error:r.error}));
  }
 }
 const tvbody={symbols:{tickers:['FOREXCOM:NSXUSD','OANDA:NAS100USD','CAPITALCOM:US100','PEPPERSTONE:NAS100','FX:NAS100USD','NASDAQ:NDX']},
  columns:['name','description','close','open|1','high|1','low|1','close|1','volume|1','type']};
 for(const domain of ['cfd','america']){
  const r=await getJson('https://scanner.tradingview.com/'+domain+'/scan',
    {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(tvbody)});
  const v=r.value||{};
  console.log('TRADINGVIEW',domain,JSON.stringify({http:r.http,totalCount:v.totalCount,
   data:v.data?.map(x=>({s:x.s,d:x.d})).slice(0,10),error:r.error,
   message:String(v.error||v.message||'').slice(0,120)}));
 }
 await wait(9000);
 for(const symbol of ['NAS100','US100','USTEC']){
  const r=await getJson('https://biquote.io/api/'+symbol+'?allowStale=false');
  console.log('BIQUOTE_SECOND_TICK',symbol,JSON.stringify(summarizeTick(r)));
 }
 console.log('SOURCE_PROBE_END',new Date().toISOString());
}
run().catch(e=>{console.error('PROBE_FATAL',String(e.message||e));process.exitCode=1});
