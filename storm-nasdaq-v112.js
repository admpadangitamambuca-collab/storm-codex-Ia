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
 async function load(tf,signal){
  if(!SPEC[tf])throw Error('Timeframe não suportado: '+tf);
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),12000);
  const abort=()=>ctl.abort();
  if(signal){if(signal.aborted)ctl.abort();else signal.addEventListener('abort',abort,{once:true})}
  try{
   const response=await root.fetch(url+'?tf='+encodeURIComponent(tf),{signal:ctl.signal,cache:'no-store',headers:{Accept:'application/json'}});
   let data=null;try{data=await response.json()}catch{}
   if(!response.ok)throw Error((data?.error||'Feed Yahoo ^NDX HTTP '+response.status)+'. Netlify Functions precisa estar implantado; um ZIP estático não executa funções.');
   return validate(data,tf);
  }catch(err){if(ctl.signal.aborted&&signal?.aborted)throw err;
   throw Error('Nasdaq-100: '+String(err?.message||err));
  }finally{clearTimeout(timeout);if(signal)signal.removeEventListener('abort',abort)}
 }
 return Object.freeze({version:'11.2',SPEC,validate,load});
});
