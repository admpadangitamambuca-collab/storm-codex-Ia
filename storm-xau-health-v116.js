'use strict';
/* Storm 11.6: independent XAU/USD spot + OHLC freshness diagnostics.
 * Spot mid reference IS NOT a closed OHLC candle or a tradable broker quote.
 * No price synthesis, no token-gold / futures substitution.
 */
const FRAME=Object.freeze({M1:{period:'1m',ms:60000},M5:{period:'5m',ms:300000},
 M15:{period:'15m',ms:900000},H1:{period:'1h',ms:3600000}});
const URLS=Object.freeze({spot:'https://xaus.com/api/v1/spot?compact=1',
 tick:'https://biquote.io/api/XAUUSD?allowStale=false'});
const number=x=>typeof x==='number'&&Number.isFinite(x);
function stamp(value){
 if(typeof value==='number')return value<1e11?value*1000:value;
 if(typeof value!=='string')return NaN;
 const numeric=Number(value);if(value.trim()&&Number.isFinite(numeric)&&numeric>1e9)
  return numeric<1e11?numeric*1000:numeric;
 return Date.parse(value);
}
function spot(data,now=Date.now()){
 const value=data?.spot_usd_oz,asOf=stamp(data?.data_state?.as_of||data?.price_as_of||data?.updated_at);
 const status=String(data?.data_state?.status||'').toLowerCase();
 const ageMs=now-asOf;
 const fresh=number(value)&&value>100&&value<20000&&number(asOf)&&ageMs>=-5000
  &&ageMs<=180000&&status==='fresh'&&data?.stale!==true
  &&(data?.xau?.currency==='USD'||data?.xau?.currency===undefined);
 return {source:'XAUS.com · ouro à vista (preço indicativo)',price:fresh?value:null,
  quotedAt:number(asOf)?asOf:null,ageMs:number(ageMs)?ageMs:null,
  fresh,priceType:'spot_reference_only',eligibleForSignals:false,
  reason:fresh?null:'Preço spot indisponível, antigo ou não validado'};
}
function biquote(data,tf,now=Date.now()){
 const p=FRAME[tf];if(!p)throw Error('Período inválido');
 if(String(data?.symbol||data?.data?.symbol||'').toUpperCase()!=='XAUUSD')
  throw Error('Biquote respondeu instrumento diferente de XAUUSD');
 if(String(data?.interval||data?.data?.interval||'').toLowerCase()!==p.period)
  throw Error('Biquote retornou timeframe diferente');
 const input=Array.isArray(data?.bars)?data.bars:Array.isArray(data?.data?.bars)?data.data.bars:null;
 if(!input)throw Error('Biquote não enviou candles');
 const map=new Map();
 for(const b of input) {
  if(!b||b.isOpen===true||b.isOpen==='true')continue;
  const t=stamp(b.openTime??b.time??b.t??b.timestamp);
  const open=Number(b.open??b.o),high=Number(b.high??b.h),
   low=Number(b.low??b.l),close=Number(b.close??b.c);
  if(![t,open,high,low,close].every(number)||t%p.ms||t+p.ms>now-400||
   low<=0||high<Math.max(open,close)||low>Math.min(open,close))continue;
  map.set(t,{t,open,high,low,close});
 }
 const candles=[...map.values()].sort((a,b)=>a.t-b.t);
 const last=candles.at(-1),closedAt=last?last.t+p.ms:null;
 const ageMs=closedAt!==null?now-closedAt:null;
 const fresh=!!last&&candles.length>=60&&ageMs>=0&&ageMs<=p.ms+45000;
 return {source:'Biquote · XAUUSD · OHLC',tf,closedAt,ageMs,
  close:last?.close??null,candleCount:candles.length,
  fresh,eligibleForSignals:fresh,priceType:'closed_ohlc',
  reason:fresh?null:!last?'Sem candle fechado válido':candles.length<60?
   'Histórico fechado insuficiente':'Candles XAUUSD atrasados na fonte'};
}
function tick(data,now=Date.now()){
 const at=stamp(data?.timestamp||data?.lastQuoteAt);
 const ageMs=now-at;
 const valid=String(data?.symbol||'').toUpperCase()==='XAUUSD'
   &&number(data?.mid)&&data.mid>100&&data.mid<20000
   &&data?.stale!==true&&data?.marketState!=='closed'
   &&number(ageMs)&&ageMs>=-5000&&ageMs<=120000;
 return {source:'Biquote · tick XAUUSD',fresh:valid,ageMs:number(ageMs)?ageMs:null,
  price:valid?data.mid:null};
}
async function json(url,fetcher,timeout=8500){
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);
 try{
  const r=await fetcher(url,{headers:{Accept:'application/json'},signal:ctl.signal,cache:'no-store'});
  if(!r.ok)throw Error('HTTP '+r.status);
  return await r.json();
 }finally{clearTimeout(timer)}
}
async function run({tf='M5',fetcher=fetch,now=Date.now()}={}){
 if(!FRAME[tf])throw Error('Timeframe inválido');
 const queries=[
  json(URLS.spot,fetcher).then(d=>spot(d,now)),
  json('https://biquote.io/api/XAUUSD/ohlc?interval='+FRAME[tf].period+'&limit=350',fetcher)
    .then(d=>biquote(d,tf,now)),
  json(URLS.tick,fetcher,5000).then(d=>tick(d,now))
 ];
 const [price,ohlc,liveTick]=await Promise.allSettled(queries);
 const sp=price.status==='fulfilled'?price.value:{source:'XAUS.com · spot',fresh:false,
  price:null,reason:String(price.reason?.message||price.reason).slice(0,100),
  eligibleForSignals:false,priceType:'spot_reference_only'};
 const bars=ohlc.status==='fulfilled'?ohlc.value:{source:'Biquote · OHLC',tf,
  fresh:false,eligibleForSignals:false,reason:String(ohlc.reason?.message||ohlc.reason).slice(0,100)};
 const t=liveTick.status==='fulfilled'?liveTick.value:{source:'Biquote · tick XAUUSD',
  fresh:false,reason:String(liveTick.reason?.message||liveTick.reason).slice(0,100)};
 return {version:'11.6',asset:'XAUUSD',tf,checkedAt:now,spot:sp,ohlc:bars,tick:t,
  state:bars.fresh?'OHLC_RECENT':sp.fresh?'SPOT_ONLY':'NO_RECENT_DATA',
  signalsAllowed:bars.fresh===true,
  note:bars.fresh?'Candles fechados verificados para análise':
  sp.fresh?'Spot recente disponível; OHLC atrasado: NÃO usar spot como vela para sinais':
  'Spot e OHLC sem atualização verificada; aguardar fonte'};
}
module.exports={FRAME,spot,biquote,tick,run,stamp};
