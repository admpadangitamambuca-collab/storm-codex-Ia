'use strict';
/* Storm Codex IA 11.5: scheduled market observer, 100% SIMULATED.
 * Published deploy only. Keeps site-scoped research memory in Netlify Blobs.
 * No broker connection, no credentials in UI, no historical signal fabrication.
 */
const B3=require('./b3-indices-v111.js');
const {createRuntime}=require('./storm-runtime-v115.js');
const replay=require('./storm-replay-v115.js');
const xauHealth=require('./storm-xau-health-v116.js');
const TIMEFRAMES={M1:{ms:60000,p:'1m'},M5:{ms:300000,p:'5m'},M15:{ms:900000,p:'15m'},H1:{ms:3600000,p:'1h'}};
const ASSETS=['XAUUSD','EURUSD','USDJPY','AUDUSD','WIN','WDO'];
const bounded=s=>String(s??'').slice(0,240);
const number=x=>typeof x==='number'&&Number.isFinite(x);
const safeJson=x=>JSON.parse(JSON.stringify(x));
function boolEnv(name){return String(process.env[name]||'').toLowerCase()==='true';}
function activePairs(){
 const list=[];
 for(const asset of ASSETS)for(const tf of Object.keys(TIMEFRAMES))list.push({asset,tf});
 return list;
}
async function getJson(url,fetcher=fetch,options={}){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),options.timeout||6500);
 try{
  const response=await fetcher(url,{signal:ctl.signal,cache:'no-store',headers:{
    Accept:'application/json',...(options.headers||{})}});
  if(!response?.ok)throw Error('HTTP '+response?.status);
  return await response.json();
 }finally{clearTimeout(timer);}
}
async function pull(pair,now=Date.now(),fetcher=fetch){
 const {asset,tf}=pair,spec=TIMEFRAMES[tf];
 const b3=asset==='WIN'||asset==='WDO';
 const contract=b3?B3.contractFor(asset,now).symbol:null;
 const symbol=contract||asset;
 const providerURL=process.env.STORM_B3_PROVIDER_URL;
 const authorized=b3&&boolEnv('STORM_B3_PROVIDER_AUTHORIZED')&&providerURL&&
  process.env.STORM_B3_PROVIDER_TOKEN;
 let data,source,explicitRealtime=false;
 if(authorized){
  const base=new URL(providerURL);
  if(base.protocol!=='https:'||!base.hostname||base.username||base.password)
   throw Error('B3 provider exige HTTPS válido');
  base.searchParams.set('symbol',symbol);
  base.searchParams.set('interval',spec.p);
  base.searchParams.set('limit','350');
  data=await getJson(base.toString(),fetcher,{timeout:7000,headers:{
   Authorization:'Bearer '+process.env.STORM_B3_PROVIDER_TOKEN}});
  if(data.realtime!==true||Number(data.delayMinutes)!==0)
   throw Error('Fonte B3 não confirmou tempo real sem atraso');
  explicitRealtime=true;
  source='B3 autorizado';
 }else{
  data=await getJson('https://biquote.io/api/'+encodeURIComponent(symbol)+
   '/ohlc?interval='+spec.p+'&limit=350',fetcher);
  source='Biquote';
 }
 const actual=String(data?.symbol||data?.data?.symbol||'').trim().toUpperCase();
 if(actual!==symbol)throw Error('Ticker retornado divergente: '+(actual||'sem identificação'));
 const interval=String(data?.interval||data?.data?.interval||spec.p).toLowerCase();
 if(interval!==spec.p)throw Error('Timeframe divergente');
 const rows=Array.isArray(data.bars)?data.bars:Array.isArray(data?.data?.bars)?data.data.bars:null;
 if(!rows||rows.length<60)throw Error('Candles fechados insuficientes');
 const converted=rows.map(b=>{
   const rt=b.openTime??b.time??b.t??b.timestamp;
   let t=typeof rt==='number'?rt:Number(rt);
   if(Number.isNaN(t))t=Date.parse(String(rt));
   else if(t<1e11)t*=1000;
   return {t,open:Number(b.open??b.o),high:Number(b.high??b.h),
    low:Number(b.low??b.l),close:Number(b.close??b.c),
    volume:Number(b.volume??b.vol??0),isOpen:b.isOpen===true};
 });
 const bars=converted.filter(b=>!b.isOpen&&Number.isFinite(b.t)&&b.t+spec.ms<=now-400)
  .sort((a,b)=>a.t-b.t).filter((b,i,a)=>!i||a[i-1].t!==b.t).slice(-320);
 // Exact validation, tick grid, and B3 contract turnover must match.
 const checked=replay.parseBars(bars,tf,now);
 replay.checkIdentity(asset,symbol,tf,checked);
 const closedAt=checked.at(-1).t+spec.ms,ageMs=now-closedAt;
 const fresh=ageMs>=0&&ageMs<=spec.ms+45000;
 return {asset,tf,feedSymbol:symbol,source,bars:checked,closedAt,ageMs,fresh,
  quoteType:b3?'B3 future':'spot/CFD',explicitRealtime:explicitRealtime||!b3,
  fetchedAt:now};
}
function memoryKey(asset,tf){return 'research-v115-'+asset+'-'+tf;}
function emptyState(pair){return {version:'11.5',asset:pair.asset,tf:pair.tf,
 lastClosedAt:0,latestStatus:'UNINITIALIZED',source:null,feedSymbol:null,
 lastSuccessAt:0,lastAttemptAt:0,error:null,signals:[],lastScore:null,
 lastScoreAt:null,calibration:null};}
function categoryScore(engine,score){
 if(engine==='turbo')return Number.isFinite(score)&&score>83;
 return Number.isFinite(score)&&score>78;
}
function calibration(rows,engine,tf) {
 const closed=rows.filter(x=>x.engine===engine&&['win','loss'].includes(x.result))
  .sort((a,b)=>a.t-b.t);
 const gap=TIMEFRAMES[tf].ms*6,used=[];let next=0;
 for(const r of closed)if(r.t>=next){used.push(r);next=r.t+gap;}
 const n=used.length,cut=Math.floor(n*.7);
 const train=used.slice(0,Math.max(0,cut-1)),validation=used.slice(Math.min(n,cut+1));
 const stats=replay.summarize(validation);
 let adjustment=0;
 if(n>=40&&train.length>=25&&validation.length>=10){
  if(stats.meanR>0&&stats.wilson?.lower>.40)adjustment=Math.min(3,Math.max(1,Math.round(stats.meanR*2)));
  else if(stats.meanR<0)adjustment=-Math.min(4,Math.max(1,Math.ceil(-stats.meanR*3)));
 }
 return {independent:n,train:train.length,validation:validation.length,
  validationMeanR:stats.meanR,validationWilson:stats.wilson,adjustment,
  appliedToLiveSignals:false}; // Research only; no silent strategy mutation.
}
function settlePending(state,bars,tf){
 const byT=new Map(bars.map((b,i)=>[b.t,i]));
 for(const e of state.signals){
  if(e.result!=='pending')continue;
  const idx=byT.get(e.t);
  if(idx===undefined){if(bars[0]?.t>e.t){e.result='incomplete';e.reason='Vela de origem ausente'}continue;}
  const result=replay.settlement(bars,idx,e,tf,0);
  if(result.result!=='pending'){
   e.result=result.result;e.R=result.R??null;e.reason=result.reason||null;
   e.resolvedAt=bars[result.lastIndex]?.t+TIMEFRAMES[tf].ms;
  }
 }
}
async function advance(pair,quote,stored,runtime,otherTf={},macro=null){
 const prev=stored||emptyState(pair),now=quote.fetchedAt,ms=TIMEFRAMES[pair.tf].ms;
 const state=safeJson(prev);state.asset=pair.asset;state.tf=pair.tf;
 // Never settle a previous expiration's positions with a new B3 contract.
 if(['WIN','WDO'].includes(pair.asset)&&state.feedSymbol&&state.feedSymbol!==quote.feedSymbol){
  for(const e of state.signals)if(e.result==='pending'){
   e.result='incomplete';e.reason='Rolagem do contrato: desfecho não verificável';
  }
  state.lastClosedAt=0; // arm new contract rather than importing old candles
 }
 state.lastAttemptAt=now;state.lastSuccessAt=now;state.source=quote.source;
 state.feedSymbol=quote.feedSymbol;state.closedAt=quote.closedAt;
 state.latestStatus=quote.fresh?'RECENT':'STALE';state.error=null;
 if(!quote.fresh){state.lastScore={classic:{accepted:false,reason:'Candles OHLC atrasados',score:null},
  turbo:{accepted:false,reason:'Candles OHLC atrasados',score:null}};}
 settlePending(state,quote.bars,pair.tf);
 if(!state.lastClosedAt){
  // First sight of existing candle arms monitoring; NEVER backfill a trade.
  state.lastClosedAt=quote.closedAt;
  state.calibration=['classic','turbo','indices'].reduce((m,n)=>(m[n]=calibration(state.signals,n,pair.tf),m),{});
  return state;
 }
 if(quote.closedAt<=state.lastClosedAt||!quote.fresh){
  state.lastClosedAt=Math.max(state.lastClosedAt,quote.closedAt);
  return state;
 }
 const primary=pair.asset==='WIN'||pair.asset==='WDO'?'indices':'classic';
 const engines=primary==='indices'?['indices']:['classic','turbo'];
 for(const engine of engines){
  try{
   const current=quote.bars.slice(-220),ctx={runtime,mtf:otherTf};
   const p=replay.analyzePoint({asset:pair.asset,tf:pair.tf,bars:current,
    clock:quote.closedAt,engine,feedSymbol:quote.feedSymbol},
    ctx,{macroForClose:()=>macro||{},lot:pair.asset==='XAUUSD'?.1:.15});
   const note={engine,score:p.score,side:p.side,accepted:p.accepted,reason:p.reason};
   state.lastScore=state.lastScore||{};state.lastScore[engine]=note;
   state.lastScoreAt=quote.closedAt;
   if(!p.accepted||!categoryScore(engine,p.score))continue;
   const id=[engine,pair.asset,pair.tf,quote.feedSymbol,quote.closedAt].join('|');
   if(state.signals.some(x=>x.id===id))continue;
   state.signals.unshift({id,engine,asset:pair.asset,tf:pair.tf,feedSymbol:quote.feedSymbol,
    t:quote.bars.at(-1).t,closedAt:quote.closedAt,recordedAt:now,
    side:p.side,score:p.score,entry:p.entry,stop:p.stop??(p.entry+(p.side==='buy'?-1:1)*p.stopDist),
    target:p.target??(p.entry+(p.side==='buy'?1:-1)*p.targetDist),
    stopDist:p.stopDist,targetDist:p.targetDist,result:'pending',R:null,
    source:'scheduled_observed',brokerExecuted:false});
  }catch(e){
   state.lastScore=state.lastScore||{};
   state.lastScore[engine]={accepted:false,reason:bounded(e?.message||e),error:true};
  }
 }
 state.lastClosedAt=quote.closedAt;
 state.signals=state.signals.slice(0,180);
 state.calibration=engines.reduce((acc,e)=>(acc[e]=calibration(state.signals,e,pair.tf),acc),{});
 return state;
}
async function macroData(fetcher=fetch){
 try{
  const [news,calendar]=await Promise.all([
   getJson('https://biquote.io/api/news/market?symbol=XAUUSD&language=en&country=US&maxResults=15',fetcher,{timeout:4000}),
   getJson('https://biquote.io/api/calendar/upcoming?countries=US,EU&importance=high&limit=50',fetcher,{timeout:4000})
  ]);
  const n=Array.isArray(news)?news:Array.isArray(news?.news)?news.news:null;
  const c=Array.isArray(calendar)?calendar:Array.isArray(calendar?.events)?calendar.events:null;
  if(!n||!c)throw Error('Macro sem listas verificáveis');
  return {verified:true,news:n,calendar:c,calendarAt:Date.now()};
 }catch{return {verified:false,news:[],calendar:[],calendarAt:0};}
}
/* Any missing feed stays failed; never generates a synthetic replacement. */
async function runCycle({store,fetcher=fetch,now=Date.now(),pairs=activePairs(),runtime=null}={}){
 if(!store||typeof store.getWithMetadata!=='function'||typeof store.setJSON!=='function')
  throw Error('Armazenamento persistente não configurado');
 const results=[],quotes=[];
 const [macro,xauReference]=await Promise.all([
  macroData(fetcher),
  getJson('https://xaus.com/api/v1/spot?compact=1',fetcher,{timeout:4500})
   .then(data=>xauHealth.spot(data,now))
   .catch(e=>({fresh:false,price:null,priceType:'spot_reference_only',
    eligibleForSignals:false,reason:bounded(e?.message||e)}))
 ]);
 // Poll in parallel, but evaluate sequentially with one isolated historical clock.
 await Promise.all(pairs.map(async pair=>{
  try{quotes.push({pair,quote:await pull(pair,now,fetcher)})}
  catch(e){quotes.push({pair,error:bounded(e?.message||e)})}
 }));
 const engineRuntime=runtime||createRuntime();
 for(const row of quotes) {
  const {pair}=row,key=memoryKey(pair.asset,pair.tf);
  const prior=await store.getWithMetadata(key,{type:'json',consistency:'strong'});
  const current=prior?.data||emptyState(pair),etag=prior?.etag;
  let next;
  if(row.error){
   next={...current,lastAttemptAt:now,error:row.error,latestStatus:'ERROR'};
  }else{
   const mtf={};
   for(const related of quotes){
    if(related.quote&&related.pair.asset===pair.asset&&related.pair.tf!==pair.tf)
     mtf[related.pair.tf]=related.quote.bars;
   }
   next=await advance(pair,row.quote,current,engineRuntime,mtf,macro);
  }
  try{
   const write=await store.setJSON(key,next,prior?{onlyIfMatch:etag}:{onlyIfNew:true});
   results.push({asset:pair.asset,tf:pair.tf,state:next.latestStatus,source:next.source,
    error:next.error,count:next.signals.length,lastClosedAt:next.lastClosedAt,
    persisted:!!write?.modified,readings:next.lastScore||null,
    pending:next.signals.filter(e=>e.result==='pending').length,
    closed:next.signals.filter(e=>e.result==='win'||e.result==='loss').length});
  }catch(e){results.push({asset:pair.asset,tf:pair.tf,state:'STORAGE_ERROR',error:bounded(e?.message||e),persisted:false});}
 }
 const status={version:'11.5',checkedAt:now,macroVerified:macro.verified,pairs:results.length,
  xauReference:{source:xauReference.source||'XAUS.com',fresh:xauReference.fresh===true,
   price:xauReference.fresh?xauReference.price:null,quotedAt:xauReference.quotedAt||null,
   ageMs:xauReference.ageMs??null,eligibleForSignals:false},
  healthy:results.filter(x=>x.state==='RECENT').length,
  failed:results.filter(x=>x.state==='ERROR'||x.state==='STORAGE_ERROR').length,
  persisted:results.filter(x=>x.persisted).length,results};
 await store.setJSON('status-v115',status);
 return status;
}
exports.activePairs=activePairs;exports.pull=pull;exports.advance=advance;
exports.calibration=calibration;exports.runCycle=runCycle;
// Invoked only from modern Netlify Functions wrapper, never directly by HTTP.
