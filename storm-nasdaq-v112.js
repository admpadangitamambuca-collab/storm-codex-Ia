/* Storm Codex IA 11.2 — frontend para Nasdaq-100 (^NDX) via Netlify/Yahoo.
 * Exclusivo de NASDAQ: nunca altera Biquote dos demais mercados. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.StormNasdaq112=api;
})(typeof window!=='undefined'?window:globalThis,function(root){'use strict';
 const SPEC={M1:60000,M5:300000,M15:900000,H1:3600000};
 const url='/.netlify/functions/nasdaq-ohlc';
 function validate(data,tf,now=Date.now()){
  if(!SPEC[tf])throw Error('Período Nasdaq inválido');
  if(data?.requestedAsset!=='NASDAQ'||data?.requestedTf!==tf||data?.feedSymbol!=='^NDX'||data?.feedVerified!==true)
   throw Error('Fonte Nasdaq respondeu ticker/período diferente de ^NDX / '+tf);
  const ms=SPEC[tf],rows=data.candles;
  if(!Array.isArray(rows)||rows.length<60)throw Error('Fonte Nasdaq sem histórico OHLC suficiente');
  const clean=[],seen=new Set();
  for(const b of rows){
   if(!b||![b.t,b.open,b.high,b.low,b.close].every(Number.isFinite)||b.low<=0||
    b.open<=0||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||
    b.t+ms>now-350||seen.has(b.t))continue;
   clean.push({...b,volume:Number.isFinite(b.volume)?b.volume:null});seen.add(b.t);
  }
  clean.sort((a,b)=>a.t-b.t);
  if(clean.length<60)throw Error('OHLC Nasdaq inválido ou contém candles abertos');
  const last=clean.at(-1),closedAt=last.t+ms;
  if(last.close<1000||last.close>100000)throw Error('Nasdaq: preço fora da faixa plausível');
  const delay=Math.max(0,now-closedAt),delayedMinutes=Number(data.exchangeDelayedMinutes)||0;
  return {...data,candles:clean,closedAt,feedSymbol:'^NDX',feedVerified:true,feedAlias:false,
   source:'Yahoo Finance · Nasdaq-100 (^NDX)',
   providerStale:delay>ms+30000,exchangeDelayedMinutes:delayedMinutes,
   feedNote:delayedMinutes?'Cotação pode ter atraso oficial de '+delayedMinutes+' min':'Cotação sujeita ao atraso do provedor',
   transport:'Netlify Function · Yahoo Chart',providerTimestamp:closedAt,fetchedAt:now,
   mode:'live',futures:false};
 }
 const YAHOO={M1:{interval:'1m',range:'5d'},M5:{interval:'5m',range:'1mo'},
  M15:{interval:'15m',range:'1mo'},H1:{interval:'60m',range:'3mo'}};
 async function publicProxy(tf,signal){
  // Alternativa de continuidade para um ZIP estático quando Netlify Functions
  // não foi implantado. É um proxy TERCEIRIZADO e não fornece SLA.
  const spec=YAHOO[tf],path='https://query1.finance.yahoo.com/v8/finance/chart/%5ENDX?interval='+
   spec.interval+'&range='+spec.range+'&includePrePost=false';
  const response=await root.fetch('https://proxy.cors.dev/'+path,{cache:'no-store',signal,credentials:'omit'});
  if(!response.ok)throw Error('Proxy público ^NDX HTTP '+response.status);
  const raw=await response.json(),res=raw?.chart?.result?.[0],meta=res?.meta||{};
  if(String(meta.symbol||'').toUpperCase()!=='^NDX')throw Error('Proxy respondeu ativo diferente de ^NDX');
  const quote=res?.indicators?.quote?.[0]||{},ms=SPEC[tf],now=Date.now();
  const bars=(res?.timestamp||[]).map((seconds,i)=>{
   const t=Number(seconds)*1000,open=quote.open?.[i],high=quote.high?.[i],low=quote.low?.[i],close=quote.close?.[i];
   if([t,open,high,low,close].some(x=>!Number.isFinite(x))||open<=0||low<=0||
      high<Math.max(open,close)||low>Math.min(open,close)||t+ms>now-400)return null;
   return {t,open,high,low,close,volume:Number.isFinite(quote.volume?.[i])?quote.volume[i]:null};
  }).filter(Boolean).slice(-500);
  return validate({requestedAsset:'NASDAQ',requestedTf:tf,feedSymbol:'^NDX',
   feedVerified:true,source:'Yahoo Finance · proxy público cors.dev',exchangeDelayedMinutes:Number(meta.exchangeDataDelayedBy)||0,
   candles:bars},tf,now);
 }
 async function load(tf,signal){
  if(!SPEC[tf])throw Error('Timeframe não suportado: '+tf);
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),12000);
  const abort=()=>ctl.abort();
  if(signal){if(signal.aborted)ctl.abort();else signal.addEventListener('abort',abort,{once:true})}
  try{
   const response=await root.fetch(url+'?tf='+encodeURIComponent(tf),{signal:ctl.signal,cache:'no-store',headers:{Accept:'application/json'}});
   let data=null;try{data=await response.json()}catch{}
   if(!response.ok)throw Error((data?.error||'Feed Yahoo ^NDX HTTP '+response.status)+'. Netlify Functions pode não estar implantado.');
   return validate(data,tf);
  }catch(err){if(ctl.signal.aborted&&signal?.aborted)throw err;
   try{
    const fallback=await publicProxy(tf,ctl.signal);
    return {...fallback,source:'Yahoo Finance · via proxy público cors.dev',
     transport:'cors.dev · Yahoo Chart v8',feedNote:'Proxy público de terceiros, sem SLA; confirme o atraso antes de operar'};
   }catch(fallbackError){
    throw Error('Nasdaq-100 indisponível. Netlify: '+String(err?.message||err)+
     ' | Proxy público: '+String(fallbackError?.message||fallbackError));
   }
  }finally{clearTimeout(timeout);if(signal)signal.removeEventListener('abort',abort)}
 }
 return Object.freeze({version:'11.2',SPEC,validate,load});
});
