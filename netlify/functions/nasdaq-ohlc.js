'use strict';
/* Storm Codex IA 11.2 · NASDAQ-100 (^NDX), leitura pública do Yahoo Chart.
   Somente Nasdaq, sem API key, sem fallback para Nasdaq futures/ETF/CFD.
   Netlify Functions executa fetch no servidor, evitando CORS do navegador. */
const FRAME=Object.freeze({
 M1:{interval:'1m',range:'5d',ms:60000},
 M5:{interval:'5m',range:'1mo',ms:300000},
 M15:{interval:'15m',range:'1mo',ms:900000},
 H1:{interval:'60m',range:'3mo',ms:3600000}
});
const RESP={"content-type":"application/json; charset=utf-8","cache-control":"public, max-age=20, s-maxage=25, stale-while-revalidate=30","access-control-allow-origin":"*"};
const format=(status,data)=>({statusCode:status,headers:RESP,body:JSON.stringify(data)});
const good=x=>typeof x==='number'&&Number.isFinite(x);
const timestamp=v=>good(v)?(v<1e11?v*1000:v):NaN;
let cache=new Map();
async function pull(tf,fetcher=fetch,now=Date.now()){
 const spec=FRAME[tf];if(!spec)throw new Error('Timeframe não suportado');
 const urls=['query1.finance.yahoo.com','query2.finance.yahoo.com'].map(domain=>
  'https://'+domain+'/v8/finance/chart/%5ENDX?interval='+spec.interval+'&range='+spec.range+'&includePrePost=false&events=false');
 let lastErr=null;
 for(const url of urls){
  const ctl=new AbortController(),time=setTimeout(()=>ctl.abort(),8500);
  try{
   const response=await fetcher(url,{signal:ctl.signal,headers:{Accept:'application/json','User-Agent':'Mozilla/5.0 (compatible; StormCodex-Indices/11.2)','Accept-Language':'en-US,en;q=0.9'}});
   if(!response.ok)throw Error('Yahoo HTTP '+response.status);
   const raw=await response.json(),answer=raw?.chart?.result?.[0],meta=answer?.meta||{},quote=answer?.indicators?.quote?.[0]||{};
   if(String(meta.symbol||'').toUpperCase()!=='^NDX')throw Error('Resposta retornou outro ticker ('+String(meta.symbol||'vazio')+')');
   if(meta.instrumentType&&meta.instrumentType!=='INDEX')throw Error('Resposta não é índice Nasdaq-100');
   const secs=answer?.timestamp||[],barMap=new Map();
   for(let i=0;i<secs.length;i++){
    const t=timestamp(secs[i]),open=Number(quote.open?.[i]),high=Number(quote.high?.[i]),low=Number(quote.low?.[i]),close=Number(quote.close?.[i]);
    if(!good(t)||!good(open)||!good(high)||!good(low)||!good(close)||open<=0||low<=0||
       high<Math.max(open,close)||low>Math.min(open,close)||high<low||t+spec.ms>now-400)continue;
    // É valor OHLC de verdade; NaN/null não deve virar zero.
    if([quote.open?.[i],quote.high?.[i],quote.low?.[i],quote.close?.[i]].some(x=>x===null||x===undefined))continue;
    barMap.set(t,{t,open,high,low,close,volume:good(Number(quote.volume?.[i]))?Number(quote.volume[i]):null});
   }
   const candles=[...barMap.values()].sort((a,b)=>a.t-b.t).slice(-500);
   if(candles.length<60)throw Error('Yahoo só retornou '+candles.length+' candles fechados');
   if(candles.at(-1).close<1000||candles.at(-1).close>100000)throw Error('Valor do Nasdaq fora da faixa plausível');
   const closedAt=candles.at(-1).t+spec.ms;
   return {requestedAsset:'NASDAQ',requestedTf:tf,feedSymbol:'^NDX',feedVerified:true,source:'Yahoo Finance · Nasdaq-100 Index (^NDX)',
    transport:'Netlify Function · Yahoo Chart v8 '+spec.interval,providerTimestamp:closedAt,
    fetchedAt:now,closedAt,providerStale:now-closedAt>spec.ms+30000,
    exchangeDelayedMinutes:Number(meta.exchangeDataDelayedBy)||0,
    exchangeTimezone:String(meta.exchangeTimezoneName||'America/New_York'),
    marketState:String(meta.marketState||'desconhecido'),
    closeDelayMs:Math.max(0,now-closedAt),candles};
  }catch(e){lastErr=e}finally{clearTimeout(time)}
 }
 throw Error('Yahoo ^NDX indisponível: '+(lastErr?.message||'sem resposta'));
}
exports.pull=pull;
exports.handler=async event=>{
 if(event.httpMethod==='OPTIONS')return {statusCode:204,headers:RESP,body:''};
 if(event.httpMethod!=='GET')return format(405,{error:'Método não permitido'});
 const tf=String(event.queryStringParameters?.tf||'M5').toUpperCase();
 if(!FRAME[tf])return format(400,{error:'Timeframe inválido: M1, M5, M15 ou H1'});
 const now=Date.now(),stored=cache.get(tf);
 if(stored&&now-stored.at<25000)return format(200,{...stored.data,cacheAgeMs:now-stored.at});
 // M1/M5/M15/H1 são requisitados simultaneamente na abertura da aba.
 // Cache por timeframe evita repetição sem bloquear as outras três leituras.
 try{
  const data=await pull(tf);
  cache.set(tf,{at:now,data});
  if(cache.size>4)cache=new Map([[tf,{at:now,data}]]);
  return format(200,data);
 }catch(e){
  return format(503,{error:String(e.message||e).slice(0,240),source:'Yahoo Finance ^NDX',tf,stale:true});
 }
};
