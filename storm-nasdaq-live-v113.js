/* Storm Codex IA 11.3 — USTEC CFD Nasdaq-100, Biquote public feed.
   Quotes near-real-time (SignalR optional); signals ONLY from closed real OHLC.
   NAS100 404 is NEVER silently replaced with ^NDX or another instrument.
   USTEC is a broker CFD reference, not the licensed NASDAQ ^NDX cash index. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.StormNasdaqLive113=api;
})(typeof window!=='undefined'?window:globalThis,function(root){'use strict';
 const SYMBOL='USTEC',MS=Object.freeze({M1:60000,M5:300000,M15:900000,H1:3600000});
 const PERIOD=Object.freeze({M1:'1m',M5:'5m',M15:'15m',H1:'1h'});
 const BASE='https://biquote.io',QUOTE_AGE_MAX=16_000;
 let lastTick=null,tickCachedAt=0,tickPromise=null,connection=null,streamStarting=null,clientPromise=null,
  pulseTimer=null,streamStatus='desconectado',lastPollAt=0,lastStreamAttempt=0,reading=false;
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function ts(raw){
  if(finite(raw))return raw<1e11?raw*1000:raw;
  const s=String(raw??'').trim();
  if(!s)return NaN;
  if(/^\d{10,13}$/.test(s)){const n=Number(s);return n<1e11?n*1000:n}
  // Biquote timestamps "YYYY.MM.DD HH:mm:ss" use UTC, as verified by ticks.
  const normalized=/^\d{4}\.\d\d\.\d\d \d\d:\d\d:\d\d$/.test(s)?
   s.replace(/^(\d{4})\.(\d\d)\.(\d\d) (\d\d:\d\d:\d\d)$/,'$1-$2-$3T$4Z'):s;
  return Date.parse(normalized);
 }
 function validCandle(b){
  return b&&[b.t,b.open,b.high,b.low,b.close].every(finite)&&
   b.t>0&&b.open>0&&b.low>0&&b.high>=Math.max(b.open,b.close)&&
   b.low<=Math.min(b.open,b.close)&&b.high>=b.low;
 }
 function normalize(raw,tf,now=Date.now()){
  const ms=MS[tf];if(!ms||!Array.isArray(raw))throw Error('Período ou lista OHLC USTEC inválidos');
  const candles=new Map();
  for(const row of raw){
   if(!row||row.isOpen===true||row.isOpen==='true')continue;
   const rawTime=row.t??row.time??row.openTime??row.timestamp;
   const b={t:ts(rawTime),open:Number(row.open??row.o),
    high:Number(row.high??row.h),low:Number(row.low??row.l),close:Number(row.close??row.c),
    volume:Number(row.volume)>0?Number(row.volume):Number(row.tickVolume)>0?Number(row.tickVolume):null,
    tickVolume:Number(row.tickVolume)||0};
   if(!validCandle(b)||b.t+ms>now-350||b.t%ms!==0)continue;
   candles.set(b.t,b);
  }
  return [...candles.values()].sort((a,b)=>a.t-b.t).slice(-500);
 }
 function age(t,now=Date.now()){return finite(t)?Math.max(0,now-t):Infinity}
 function validateTick(v,now=Date.now(),origin='rest'){
  if(!v||String(v.symbol||v.name||'').toUpperCase()!==SYMBOL)throw Error('Tick não corresponde a USTEC');
  const mid=Number(v.mid),bid=Number(v.bid),ask=Number(v.ask);
  if(![mid,bid,ask].every(finite)||mid<10000||mid>100000||bid>mid||mid>ask||bid<=0)throw Error('USTEC bid/ask inválidos');
  const market=String(v.marketState||'').toLowerCase();
  if(market!=='open'&&(origin!=='stream'||(market&&market!=='unknown')))
   throw Error('Mercado USTEC não está aberto ('+(market||'sem estado')+')');
  const quoteAge=Number.isFinite(Number(v.quoteAgeSeconds))&&v.quoteAgeSeconds!==null?
   Math.max(0,Number(v.quoteAgeSeconds)*1000):age(ts(v.lastQuoteAt??v.time??v.timestamp),now);
  if(v.stale===true||!finite(quoteAge)||quoteAge>QUOTE_AGE_MAX)
   throw Error('Tick USTEC desatualizado: '+(finite(quoteAge)?Math.round(quoteAge/1000)+'s':'sem horário'));
  return {symbol:SYMBOL,mid,bid,ask,at:now-quoteAge,quoteAgeMs:quoteAge,marketState:'open',streamed:false};
 }
 function emit(tick){
  if(!tick)return;
  lastTick=tick;
  if(root.dispatchEvent&&root.CustomEvent)root.dispatchEvent(new root.CustomEvent('storm-nasdaq-tick',{detail:tick}));
 }
 function getLiveTick(now=Date.now()){
  if(!lastTick)return null;
  const ms=age(lastTick.at,now);
  return ms<=QUOTE_AGE_MAX?{...lastTick,quoteAgeMs:ms,live:true}:null;
 }
 async function request(url,signal,timeoutMs=9500){
  if(!root.fetch)throw Error('Fetch do navegador indisponível');
  const ctl=new AbortController(),timeout=setTimeout(()=>ctl.abort(),timeoutMs),
   cancel=()=>ctl.abort();
  if(signal){if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true})}
  try{
   const response=await root.fetch(url,{signal:ctl.signal,cache:'no-store',headers:{Accept:'application/json'}});
   if(!response.ok){
    let message='';try{const j=await response.json();message=String(j.message||j.error||'').slice(0,130)}catch(e){}
    throw Error('Biquote USTEC HTTP '+response.status+(message?' · '+message:''));
   }
   return await response.json();
  }finally{clearTimeout(timeout);if(signal)signal.removeEventListener('abort',cancel)}
 }
 async function fetchTick(signal){
  if(signal?.aborted)throw Error('Consulta USTEC cancelada');
  if(tickPromise)return tickPromise;
  if(Date.now()-tickCachedAt<1500&&getLiveTick())return getLiveTick();
  tickPromise=(async()=>{
   const data=await request(BASE+'/api/'+SYMBOL+'?allowStale=false',signal,8000);
   const tick=validateTick(data);
   tickCachedAt=Date.now();
   emit(tick);return tick;
  })();
  try{return await tickPromise}finally{tickPromise=null}
 }
 function validateResponse(ohlc,tick,tf,now=Date.now()){
  const period=PERIOD[tf],ms=MS[tf];
  if(!period)throw Error('Timeframe Nasdaq não suportado');
  if(String(ohlc?.symbol||ohlc?.data?.symbol||'').toUpperCase()!==SYMBOL)
   throw Error('OHLC respondeu ticker diferente de '+SYMBOL);
  const reportedPeriod=String(ohlc?.interval||ohlc?.data?.interval||'').toLowerCase();
  if(reportedPeriod!==period)throw Error('OHLC USTEC período divergente: '+(reportedPeriod||'ausente'));
  const raw=ohlc?.bars??ohlc?.data?.bars;
  const candles=normalize(raw,tf,now);
  if(candles.length<65)throw Error('USTEC '+tf+' retornou apenas '+candles.length+' candles fechados (mínimo 65)');
  const closedAt=candles.at(-1).t+ms;
  const candleAge=age(closedAt,now);
  const current=getLiveTick(now)||tick;
  if(!current||age(current.at,now)>QUOTE_AGE_MAX)throw Error('Sem tick USTEC recente para confirmar OHLC');
  if(candleAge>ms+45000)throw Error('Candles '+tf+' não acompanham a sessão USTEC: última vela há '+Math.round(candleAge/1000)+'s');
  if(Math.abs(current.mid-candles.at(-1).close)/current.mid>.025)
   throw Error('Último candle USTEC diverge mais de 2,5% do tick atual');
  return {candles,source:'Biquote · USTEC (US Tech 100 CFD) · tick em tempo real',
   feedSymbol:SYMBOL,feedVerified:true,feedAlias:true,
   feedInstrument:'US Tech 100 CFD (não ^NDX)',feedType:'CFD',
   providerStale:false,mode:'live',futures:false,closedAt,
   providerTimestamp:closedAt,liveTickAt:current.at,liveMid:current.mid,
   transport:'Biquote REST OHLC '+period+' + tick verificado · SignalR opcional',
   fetchedAt:now};
 }
 async function load(tf,signal){
  if(!PERIOD[tf])throw Error('Timeframe NASDAQ inválido');
  try{
   const [bars,tick]=await Promise.all([
    request(BASE+'/api/'+SYMBOL+'/ohlc?interval='+PERIOD[tf]+'&limit=500',signal),
    fetchTick(signal)
   ]);
   return validateResponse(bars,tick,tf);
  }catch(e){throw Error('NASDAQ · USTEC ao vivo indisponível: '+String(e?.message||e))}
 }
 function isSelected(){return root.document?.getElementById('assetSelect')?.value==='NASDAQ'}
 function tickBadge(){
  if(!root.document)return;
  const el=root.document.getElementById('stormNasdaqLiveTick');if(!el)return;
  const selected=isSelected();
  el.hidden=!selected;
  if(!selected)return;
  const tick=getLiveTick();
  if(tick){
   el.dataset.state='live';
   el.textContent='● AO VIVO · USTEC CFD · '+tick.mid.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})+
    ' pts · tick '+Math.ceil(tick.quoteAgeMs/1000)+'s · sinais só em vela fechada';
  }else{
   el.dataset.state='stale';
   el.textContent='○ USTEC · aguardando tick em tempo real · sem liberação de sinal novo';
  }
 }
 async function loadSignalR(){
  if(root.signalR?.HubConnectionBuilder)return root.signalR;
  if(clientPromise)return clientPromise;
  if(!root.document)throw Error('Cliente SignalR indisponível');
  clientPromise=new Promise((resolve,reject)=>{
   const el=root.document.createElement('script');
   el.src='https://cdnjs.cloudflare.com/ajax/libs/microsoft-signalr/8.0.0/signalr.min.js';
   el.async=true;el.crossOrigin='anonymous';el.dataset.stormNasdaqSignalr='true';
   el.onload=()=>root.signalR?.HubConnectionBuilder?resolve(root.signalR):reject(Error('SignalR sem construtor'));
   el.onerror=()=>reject(Error('CDN SignalR indisponível'));
   root.document.head.appendChild(el);
  }).catch(e=>{clientPromise=null;throw e});
  return clientPromise;
 }
 async function connectStream(){
  if(!isSelected()||root.document?.hidden)return;
  if(connection||streamStarting)return streamStarting;
  lastStreamAttempt=Date.now();streamStarting=(async()=>{
   try{
    const signalR=await loadSignalR();
    if(!isSelected())return;
    const c=new signalR.HubConnectionBuilder()
     .withUrl(BASE+'/hubs/tick',{withCredentials:false})
     .withAutomaticReconnect([0,1000,3000,7000,15000]).build();
    c.on('ReceiveTick',v=>{
     if(!isSelected())return;
     try{
      const tick=validateTick(v,Date.now(),'stream');tick.streamed=true;emit(tick);streamStatus='streaming';
      tickBadge();
     }catch(e){/* outros símbolos, sessão encerrada ou formato errado: ignorar */}
    });
    c.onreconnected(()=>c.invoke('Subscribe',[SYMBOL]).catch(()=>{}));
    c.onclose(()=>{connection=null;streamStatus='desconectado';tickBadge()});
    await c.start();await c.invoke('Subscribe',[SYMBOL]);
    if(!isSelected()){await c.stop();return}
    connection=c;streamStatus='streaming';tickBadge();
   }catch(e){streamStatus='polling';connection=null;
   }finally{streamStarting=null}
  })();
  return streamStarting;
 }
 function disconnect(){
  const prev=connection;connection=null;
  if(prev){prev.invoke('Unsubscribe',[SYMBOL]).catch(()=>{}).finally(()=>prev.stop().catch(()=>{}));}
  streamStatus='desconectado';
 }
 async function pulse(){
  tickBadge();
  if(root.dispatchEvent&&root.Event)root.dispatchEvent(new root.Event('storm-nasdaq-pulse'));
  if(!isSelected()||root.document?.hidden){if(connection)disconnect();return}
  if(!connection&&!streamStarting&&Date.now()-lastStreamAttempt>=45000)connectStream().catch(()=>{});
  const tick=getLiveTick(),now=Date.now();
  // Contingência de baixo volume: REST apenas se SignalR cair/não entregar ticks.
  if(!tick&&now-lastPollAt>=15000&&!reading){
   reading=true;lastPollAt=now;
   try{await fetchTick()}catch(e){}finally{reading=false;tickBadge()}
  }
 }
 function start(){
  if(!root.document)return;
  if(pulseTimer)return;
  pulseTimer=setInterval(pulse,2000);
  root.document.addEventListener('visibilitychange',()=>{
   if(root.document.hidden)disconnect();else pulse().catch(()=>{});
  });
  root.addEventListener?.('vortex83-data',tickBadge);
  root.document.getElementById('assetSelect')?.addEventListener('change',()=>pulse().catch(()=>{}));
  pulse().catch(()=>{});
 }
 if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',start,{once:true});
  else setTimeout(start,0);
 }
 return Object.freeze({version:'11.3',SYMBOL,MS,PERIOD,ts,validCandle,normalize,validateTick,
  validateResponse,fetchTick,load,getLiveTick,start,disconnect,
  getStreamStatus:()=>streamStatus});
});
