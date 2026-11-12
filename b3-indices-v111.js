/* Storm Codex IA 11.1 — motor independente B3 WIN / WDO.
   Datas e vencimentos do contrato seguem B3. Sem feed OHLC gratuito comprovado,
   o motor retorna erro e não inventa candles, sinais ou ordens. */
(function(root,factory){
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.StormB3Indices111=api;
})(typeof window!=='undefined'?window:globalThis,function(root){'use strict';
 const PERIOD={M1:{ms:60000,p:'1m'},M5:{ms:300000,p:'5m'},M15:{ms:900000,p:'15m'},H1:{ms:3600000,p:'1h'}};
 const LETTERS=['F','G','H','J','K','M','N','Q','U','V','X','Z'];
 const TYPES=['WIN','WDO'];
 const SCHEDULE_MS=20*60*1000;
 let catalogueAt=0,catalogue=new Map();
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
 function saoPauloDate(instant=Date.now()){
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(instant));
  const get=k=>Number(parts.find(x=>x.type===k)?.value);
  return {y:get('year'),m:get('month'),d:get('day')};
 }
 function asUTC(p){return Date.UTC(p.y,p.m-1,p.d);}
 function parts(ms){const d=new Date(ms);return {y:d.getUTCFullYear(),m:d.getUTCMonth()+1,d:d.getUTCDate()};}
 function addDays(p,n){return parts(asUTC(p)+n*86400000);}
 function sameDay(a,b){return asUTC(a)===asUTC(b);}
 function easter(year){
  // Calendário gregoriano; utilizado somente para feriados recorrentes.
  const a=year%19,b=Math.floor(year/100),c=year%100,d=Math.floor(b/4),e=b%4;
  const f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3);
  const h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k+7)%7;
  const m=Math.floor((a+11*h+22*l)/451),v=h+l-7*m+114;
  return {y:year,m:Math.floor(v/31),d:v%31+1};
 }
 function holiday(p){
  const fixed=new Set(['01-01','04-21','05-01','09-07','10-12','11-02','11-15','11-20','12-24','12-25','12-31']);
  if(fixed.has(String(p.m).padStart(2,'0')+'-'+String(p.d).padStart(2,'0')))return true;
  const fromEaster=(asUTC(p)-asUTC(easter(p.y)))/86400000;
  // Carnaval, Sexta-feira Santa e Corpus Christi: observados no calendário da B3.
  return [-48,-47,-2,60].includes(fromEaster);
 }
 function business(p){
  const day=new Date(asUTC(p)).getUTCDay();
  return day!==0&&day!==6&&!holiday(p);
 }
 function nextBusiness(p){let x=addDays(p,1);for(let i=0;i<15&&!business(x);i++)x=addDays(x,1);return x;}
 function prevBusiness(p){let x=addDays(p,-1);for(let i=0;i<15&&!business(x);i++)x=addDays(x,-1);return x;}
 function winExpiry(year,month){
  if(month%2!==0)throw Error('WIN só possui vencimento regular em meses pares');
  const p={y:year,m:month,d:15};
  const day=new Date(asUTC(p)).getUTCDay();
  const ahead=(3-day+7)%7,back=(day-3+7)%7;
  // Quarta-feira mais próxima ao dia 15.
  const raw=addDays(p,ahead<=back?ahead:-back);
  return business(raw)?raw:nextBusiness(raw);
 }
 function wdoExpiry(year,month){
  let p={y:year,m:month,d:1};for(let i=0;i<15&&!business(p);i++)p=addDays(p,1);return p;
 }
 function contractFor(product,instant=Date.now()){
  if(!TYPES.includes(product))throw Error('Produto B3 não suportado');
  const today=saoPauloDate(instant);
  for(let n=0;n<28;n++){
   let year=today.y,month=today.m+n;
   year+=Math.floor((month-1)/12);month=(month-1)%12+1;
   if(product==='WIN'&&month%2)continue;
   const expiry=product==='WIN'?winExpiry(year,month):wdoExpiry(year,month);
   const lastTrade=product==='WIN'?expiry:prevBusiness(expiry);
   if(asUTC(today)>asUTC(lastTrade))continue;
   return {asset:product,symbol:product+LETTERS[month-1]+String(year%100).padStart(2,'0'),
    expiry,lastTrade,nextSession:nextBusiness(today),pointValue:product==='WIN'?.2:10,
    tick:product==='WIN'?5:.5,month,year,method:'B3 calendário regular; conferir sessão extraordinária'};
  }
  throw Error('Sem vencimento B3 calculável');
 }
 function validBar(b){return b&&finite(b.t)&&b.t>0&&[b.open,b.high,b.low,b.close].every(finite)&&b.open>0&&b.low>0&&b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close);}
 function normalize(bars,tf,now=Date.now()){
  const ms=PERIOD[tf]?.ms;if(!ms)throw Error('Timeframe inválido');
  const unique=new Map();
  for(const x of bars||[]){
   if(!x||x.isOpen===true||x.isOpen==='true')continue;
   const rt=x.openTime??x.time??x.t??x.timestamp;
   const t=typeof rt==='number'?(rt<1e11?rt*1000:rt):
    /^\d{10,13}$/.test(String(rt).trim())?(Number(rt)<1e11?Number(rt)*1000:Number(rt)):Date.parse(String(rt));
   const b={t,open:Number(x.open??x.o),high:Number(x.high??x.h),low:Number(x.low??x.l),close:Number(x.close??x.c),
    volume:Number(x.volume??0)||0,tickVolume:Number(x.tickVolume??0)||0};
   if(!validBar(b)||t+ms>now-350)continue;
   unique.set(t,b);
  }
  return [...unique.values()].sort((a,b)=>a.t-b.t);
 }
 async function request(url,signal){
  const controller=new AbortController();
  const cancel=()=>controller.abort(),timer=setTimeout(cancel,10000);
  if(signal){if(signal.aborted)cancel();else signal.addEventListener('abort',cancel,{once:true});}
  try{
   const response=await root.fetch(url,{signal:controller.signal,cache:'no-store',headers:{Accept:'application/json'}});
   if(!response.ok){let msg='';try{const json=await response.json();msg=String(json.message||json.error||'').slice(0,100)}catch(e){}
    throw Error('HTTP '+response.status+(msg?' · '+msg:''));}
   return await response.json();
  }finally{
   clearTimeout(timer);
   if(signal)signal.removeEventListener('abort',cancel);
  }
 }
 function isTicker(product,s){
  return new RegExp('^'+product+'[FGHJKMNQUVXZ]\\d{2}$').test(s);
 }
 function trustedSymbol(product,item){
  const name=String(item.name||item.symbol||item.ticker||'').toUpperCase().trim();
  if(!isTicker(product,name))return null;
  const type=String(item.type||'').toLowerCase(),description=String(item.description||item.displayName||'').toLowerCase();
  const exchange=String(item.exchange||'').toUpperCase();
  if(/\b(etf|stock|equity|fund|share|option)\b/.test(type+' '+description))return null;
  if(exchange&&exchange!=='B3'&&exchange!=='BMF'&&exchange!=='BMF&BOVESPA'&&exchange!=='BM&F')return null;
  return name;
 }
 async function knownSymbols(product,signal){
  if(Date.now()-catalogueAt<SCHEDULE_MS&&catalogue.has(product))return catalogue.get(product);
  const list=[];
  try{
   const data=await request('https://biquote.io/api/symbols/search?q='+product+'&limit=200',signal);
   const items=Array.isArray(data)?data:Array.isArray(data.items)?data.items:Array.isArray(data.symbols)?data.symbols:Array.isArray(data.results)?data.results:[];
   for(const item of items){const s=trustedSymbol(product,item);if(s&&!list.includes(s))list.push(s);}
  }catch(e){if(signal?.aborted)throw e;/* O OHLC do ticker calculado ainda pode funcionar. */}
  catalogue.set(product,list);catalogueAt=Date.now();return list;
 }
 async function readSymbol(product,tf,contract,signal){
  const spec=PERIOD[tf];if(!spec)throw Error('Período inválido');
  const data=await request('https://biquote.io/api/'+encodeURIComponent(contract.symbol)+'/ohlc?interval='+spec.p+'&limit=500',signal);
  const bars=Array.isArray(data?.bars)?data.bars:Array.isArray(data?.data?.bars)?data.data.bars:null;
  if(!bars)throw Error('Resposta sem candles OHLC para '+contract.symbol);
  const returned=String(data.symbol||data.data?.symbol||'').toUpperCase().trim();
  if(returned!==contract.symbol)throw Error('Símbolo divergente: '+(returned||'não informado'));
  const period=String(data.interval||data.data?.interval||'').toLowerCase();
  if(period&&period!==spec.p)throw Error('Período divergente: '+period);
  const candles=normalize(bars,tf);
  if(candles.length<46)throw Error('Histórico insuficiente para motor B3 ('+candles.length+' velas fechadas)');
  const price=candles.at(-1).close;
  if(product==='WIN'&&(price<10000||price>500000))throw Error('Preço WIN fora da faixa plausível');
  if(product==='WDO'&&(price<1000||price>20000))throw Error('Preço WDO fora da faixa plausível');
  const closedAt=candles.at(-1).t+spec.ms;
  const stale=Date.now()-closedAt>spec.ms+45000;
  return {asset:product,candles,source:'Biquote · contrato B3 ('+contract.symbol+')',
   feedSymbol:contract.symbol,feedVerified:true,providerStale:stale,
   closedAt,contractExpiry:contract.expiry,contractLastTrade:contract.lastTrade,
   contractPointValue:contract.pointValue,contractTick:contract.tick,
   futures:false,mode:'live',fetchedAt:Date.now(),providerTimestamp:closedAt,
   transport:'Biquote OHLC '+contract.symbol+' · '+spec.p};
 }
 async function load(product,tf,signal){
  if(!TYPES.includes(product))throw Error('Motor B3 exclusivo do WIN/WDO');
  if(!PERIOD[tf])throw Error('Timeframe B3 não suportado');
  const first=contractFor(product),attempts=[];
  // Priorizar OHLC do contrato calculado: catálogo Biquote pode ficar indisponível.
  const candidate={...first};
  try{return await readSymbol(product,tf,candidate,signal);}
  catch(e){if(signal?.aborted)throw e;attempts.push(first.symbol+': '+e.message);}
  const catalog=await knownSymbols(product,signal);
  // Não usar qualquer símbolo contínuo. Só pode adiantar para outro contrato
  // listado na Biquote e do MESMO produto, desde que ainda não vencido.
  for(const symbol of catalog){
   if(symbol===first.symbol||!isTicker(product,symbol))continue;
   const month=LETTERS.indexOf(symbol[3])+1,yy=Number(symbol.slice(4)),year=2000+yy;
   if(year<first.year||(year===first.year&&month<first.month))continue;
   if(product==='WIN'&&month%2)continue;
   if(year>first.year+1)continue;
   const expiry=product==='WIN'?winExpiry(year,month):wdoExpiry(year,month);
   const lastTrade=product==='WIN'?expiry:prevBusiness(expiry);
   if(asUTC(saoPauloDate())>asUTC(lastTrade))continue;
   const c={...first,symbol,year,month,expiry,lastTrade};
   try{
    const data=await readSymbol(product,tf,c,signal);
    // Se a bolsa já oferta o próximo vencimento, sinalizar a rolagem antecipada.
    return {...data,rollNote:'Contrato futuro alternativo com OHLC válido; confirmar liquidez'};
   }catch(e){if(signal?.aborted)throw e;attempts.push(symbol+': '+e.message);}
  }
  throw Error(product+' sem candles intradiários gratuitos confirmados na Biquote. '+attempts.join(' | '));
 }
 function ema(closes,n){const k=2/(n+1),out=[];let value=closes[0];for(const c of closes){value=value+(c-value)*k;out.push(value);}return out;}
 function analyze(bars,tf,meta={}){
  const product=meta.asset;
  if(!TYPES.includes(product)||!PERIOD[tf]||bars.length<46)throw Error('Motor B3 exige ativo e histórico suficientes');
  const closes=bars.map(x=>x.close),e9=ema(closes,9),e21=ema(closes,21),last=bars.at(-1),prev=bars.at(-2),tr=[];
  for(let i=0;i<bars.length;i++){
   const b=bars[i],p=bars[i-1]?.close??b.open;
   tr.push(Math.max(b.high-b.low,Math.abs(b.high-p),Math.abs(b.low-p)));
  }
  const atr=tr.slice(-14).reduce((s,v)=>s+v,0)/14;
  const prevAtr=tr.slice(-28,-14).reduce((s,v)=>s+v,0)/14;
  const ef=e9.at(-1),es=e21.at(-1),slope=(ef-e9.at(-5))/Math.max(atr,1e-8);
  const maGap=(ef-es)/Math.max(atr,1e-8);
  const direction=maGap>=0?1:-1;
  const side=direction>0?'buy':'sell';
  const peak=Math.max(...bars.slice(-22,-1).map(b=>b.high));
  const valley=Math.min(...bars.slice(-22,-1).map(b=>b.low));
  const breakout=direction>0?last.close>peak:last.close<valley;
  const body=(last.close-last.open)*direction/Math.max(atr,1e-8);
  const pressure=(direction>0?(last.close-last.low):(last.high-last.close))/Math.max(last.high-last.low,1e-8);
  const expansion=atr/Math.max(prevAtr,1e-8);
  const localDay=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'});
  const anchor=localDay.format(new Date(last.t));
  // Não acumula candles de pregões anteriores na referência de preço médio.
  const session=bars.filter(b=>localDay.format(new Date(b.t))===anchor);
  const volumeKnown=session.length>=5&&session.some(b=>b.volume>0||b.tickVolume>0);
  const total=session.slice(-120).reduce((s,b)=>{
   const w=b.volume>0?b.volume:b.tickVolume>0?b.tickVolume:1;
   return {p:s.p+((b.high+b.low+b.close)/3)*w,w:s.w+w};
  },{p:0,w:0});
  const vwap=total.p/Math.max(total.w,1);
  const volumeBasis=volumeKnown?'Preço médio ponderado por volume informado':'Preço típico médio (sem volume informado)';
  let score=52;
  score+=clamp(Math.abs(maGap)*9,0,13);
  score+=Math.sign(direction*slope)*clamp(Math.abs(slope)*9,0,10);
  score+=breakout?12:0;
  score+=clamp(body*11,-10,12);
  score+=clamp((pressure-.5)*12,-6,6);
  score+=session.length>=5?(direction*(last.close-vwap)>0?5:-5):0;
  score+=expansion>.65&&expansion<1.85?4:-9;
  const tick=product==='WIN'?5:.5;
  const stopDist=Math.ceil(Math.max(atr*.95,tick*3)/tick)*tick;
  const targetDist=Math.ceil(stopDist*1.45/tick)*tick;
  const nowBrazil=saoPauloDate();
  const dayAllowed=localDay.format(new Date(last.t+PERIOD[tf].ms))===localDay.format(new Date());
  const todayBusiness=business(nowBrazil);
  const fresh=!meta.providerStale;
  const priceOnTick=Math.abs(last.close/tick-Math.round(last.close/tick))<0.0001;
  const operational=meta.mode==='live'&&fresh&&todayBusiness&&dayAllowed&&priceOnTick&&score>=78&&
    (Math.abs(maGap)>.10)&&(![0,Infinity].includes(atr));
  const quality=operational?'ALTA':'EVITAR';
  const reason=meta.mode!=='live'?'DEMONSTRAÇÃO: sem feed real':!fresh?'OHLC defasado':!todayBusiness?'Bolsa fechada':!dayAllowed?'Última vela não pertence à sessão de hoje':'Confluência ou níveis não autorizam operação';
  const reasons=[
   'WIN/WDO: motor brasileiro independente; score heurístico, não probabilidade',
   'EMAs 9/21 '+(direction>0?'altistas':'baixistas')+' · distância/ATR '+Math.abs(maGap).toFixed(2),
   'Referência intradiária: '+volumeBasis+' '+vwap.toFixed(2)+' · '+(last.close>vwap?'preço acima':'preço abaixo')+' · '+(breakout?'rompimento de 21 velas':'sem rompimento'),
   'ATR 14 '+atr.toFixed(2)+' · volatilidade '+expansion.toFixed(2)+'×',
   'Entrada '+last.close.toFixed(2)+' · stop '+stopDist.toFixed(2)+' · alvo '+targetDist.toFixed(2)
  ];
  return {side,score:Math.round(clamp(score,0,95)),price:last.close,e9:ef,e21:es,atr,referencePrice:vwap,referenceBasis:volumeBasis,sessionBars:session.length,
   quality,operationalReason:reason,regime:breakout?'rompimento':Math.abs(maGap)>.30?'tendencia':'lateral',
   targetDist,stopDist,netRR:targetDist/stopDist,
   reasons,parts:{'Estrutura B3':score},weights:{'Estrutura B3':100},
   v93:{operational},setup:{name:'B3 Estrutura + VWAP + volatilidade',regime:breakout?'rompimento':'tendência',fit:Math.round(clamp(score,0,100))},
   horizon:3,riskMeta:{rr:targetDist/stopDist,netRR:targetDist/stopDist},
   t:last.t,oneCandleProjection:null,sourceEngine:'B3-111',preliminary:false};
 }
 return Object.freeze({version:'11.1',TYPES,PERIOD,contractFor,winExpiry,wdoExpiry,holiday,business,normalize,analyze,load,trustedSymbol});
});
