'use strict';
/* Storm Codex IA v11.5 - causal historical replay using the production engines.
 * Only offline historical research. Does NOT change live modes or simulate broker fills.
 * When no historical macro input exists, Turbo will stay blocked by its real macro gate.
 */
const FRAME=Object.freeze({M1:60000,M5:300000,M15:900000,H1:3600000});
const B3=require('./b3-indices-v111.js');
const {createRuntime}=require('./storm-runtime-v115.js');
const good=x=>typeof x==='number'&&Number.isFinite(x);
const real=x=>Number.isFinite(Number(x))?Number(x):NaN;
const asObject=o=>o&&typeof o==='object'&&!Array.isArray(o)?o:{};
function parseBars(rows,tf,now=Date.now()) {
 const ms=FRAME[tf];if(!ms)throw Error('Período inválido');
 if(!Array.isArray(rows)||rows.length<60)throw Error('Histórico com menos de 60 candles fechados');
 const out=[];
 for(const x of rows) {
  const t=real(x?.t),open=real(x?.open),high=real(x?.high),low=real(x?.low),close=real(x?.close);
  if(![t,open,high,low,close].every(good)||t<=0||t%ms||t+ms>now+1000
   ||open<=0||low<=0||high<Math.max(open,close)||low>Math.min(open,close)
   ||x.isOpen===true)throw Error('OHLC contém vela aberta, divergente ou inválida');
  if(out.length&&t<=out.at(-1).t)throw Error('OHLC duplicado ou fora de ordem');
  out.push({t,open,high,low,close,volume:good(Number(x.volume))?Number(x.volume):0});
 }
 return out;
}
function checkIdentity(asset,feedSymbol,tf,bars) {
 if(!['XAUUSD','EURUSD','USDJPY','AUDUSD','USDCAD','USDCHF','BTCUSD','BTCUSDT','NASDAQ','SP500','WIN','WDO'].includes(asset))
  throw Error('Ativo não suportado');
 if(!FRAME[tf]||!bars?.length)throw Error('Ativo/TF sem candles');
 if(asset==='NASDAQ'&&feedSymbol!=='^NDX')throw Error('Nasdaq exige índice real ^NDX, não CFD/ETF');
 if(['WIN','WDO'].includes(asset)){
  if(!new RegExp('^'+asset+'[FGHJKMNQUVXZ]\\d{2}$').test(String(feedSymbol||'')))
   throw Error('B3 exige ticker do vencimento explícito');
  for(const b of [bars[0],bars.at(-1)]){
   if(B3.contractFor(asset,b.t+FRAME[tf]).symbol!==feedSymbol)
    throw Error('Série histórica abrange outro vencimento B3; separe por contrato');
  }
  if(!bars.every(b=> Math.abs(b.close/(asset==='WIN'?5:.5)-Math.round(b.close/(asset==='WIN'?5:.5)))<1e-5))
   throw Error('B3 contém preços incompatíveis com a grade mínima de ticks');
 }
}
function wilson(win,n){if(!n)return null;const z=1.96,z2=z*z,p=win/n,d=1+z2/n;
 const mid=(p+z2/(2*n))/d,rad=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/d;
 return {lower:Math.max(0,mid-rad),upper:Math.min(1,mid+rad)};
}
function summarize(all){
 let peak=0,pnl=0,maxDD=0;
 const settled=all.filter(t=>['win','loss'].includes(t.result));
 let wins=0,totalR=0;
 for(const t of settled){
  if(t.result==='win')wins++;
  pnl+=t.R;totalR+=t.R;peak=Math.max(peak,pnl);maxDD=Math.max(maxDD,peak-pnl);
 }
 return {signals:all.length,resolved:settled.length,wins,losses:settled.length-wins,
  winRate:settled.length?wins/settled.length:null,totalR:totalR,
  meanR:settled.length?totalR/settled.length:null,maxDrawdownR:maxDD,
  ambiguous:all.filter(x=>x.result==='ambiguous').length,
  incomplete:all.filter(x=>x.result==='incomplete').length,
  expired:all.filter(x=>x.result==='expired').length,
  wilson:wilson(wins,settled.length)};
}
function makeClassic(runtime,asset,tf,c,asOf,opts={}) {
 const w=runtime.sandbox,ms=FRAME[tf];
 const e9=w.SGEngine.ema(c,9),e21=w.SGEngine.ema(c,21),aa=w.SGEngine.atr(c);
 const context={asset,tf,mode:'live',e9,e21,aa,rsi:w.SGV6Core.rsi(c),
  adx:w.SGV72Core.adx(c),snapshots:new Map(),spread:opts.spread||0,
  slippage:opts.slippage||0,commission:opts.commission||0,
  lot:opts.lot||.01,multiplier:opts.multiplier||100};
 const result=w.SGEngine.evaluateLegacy(c,c.length-1,context);
 const enhanced=w.SGClassicPrecision93?.enhance?.(result,c,c.length-1,context,{learning:false})||result;
 const final=w.StormPrecision112?.enhanceClassic?.(enhanced,c,tf,asset,{mode:'live',providerStale:false})||enhanced;
 return {final,legacy:result,context,closedAt:asOf};
}
function analyzePoint(input,ctx,opts={}){
 const {asset,tf,feedSymbol,bars,clock,engine}=input,w=ctx.runtime.sandbox,ms=FRAME[tf];
 ctx.runtime.setNow(clock);
 const classic = engine==='indices'&&['WIN','WDO'].includes(asset)
  ?{final:B3.analyze(bars,tf,{asset,mode:'live',providerStale:false,asOf:clock}),legacy:null}
  :makeClassic(ctx.runtime,asset,tf,bars,clock,opts);
 if(engine==='classic'||engine==='indices'){
  const a=classic.final||{},side=a.side,valid=['buy','sell'].includes(side);
  const operational=a.v93?.operational!==false&&a.quality!=='EVITAR'&&!a.preliminary;
  return {side,score:Number(a.score)||0,entry:a.price,stopDist:a.stopDist,
   targetDist:a.targetDist,accepted:valid&&operational&&good(a.stopDist)&&a.stopDist>0
    &&good(a.targetDist)&&a.targetDist>0,
   reason:operational?'':String(a.operationalReason||'Filtro técnico bloqueou'),raw:a};
 }
 const macro=asObject(opts.macroForClose?.(clock,asset,tf));
 const snapshots={};
 for(const [otherTf,otherBars] of Object.entries(ctx.mtf||{})){
  const unit=FRAME[otherTf];
  if(!unit||!Array.isArray(otherBars))continue;
  // No lookahead: only candles that CLOSED by the evaluated bar close.
  const past=otherBars.filter(b=>b.t+unit<=clock).slice(-180);
  if(past.length<45){snapshots[otherTf]=null;continue;}
  const reading=makeClassic(ctx.runtime,asset,otherTf,past,past.at(-1).t+unit,opts);
  snapshots[otherTf]={asset,tf:otherTf,mode:'live',candles:past,closedAt:past.at(-1).t+unit,
   analysis:reading.legacy,providerStale:false,source:'historical'};
 }
 const data={asset,tf,snapshots,lagging:false,
  settings:{lot:opts.lot||.01,multiplier:opts.multiplier||100,spread:opts.spread||0,
   slippage:opts.slippage||0,commission:opts.commission||0},
  state:{mode:'live',candles:bars,analysis:classic.legacy,closedAt:clock,providerStale:false,
   source:'historical audited',news:Array.isArray(macro.news)?macro.news:[],
   newsReady:macro.verified===true,calendar:Array.isArray(macro.calendar)?macro.calendar:[],
   calendarAt:macro.verified===true?Math.min(clock,Number(macro.calendarAt)||clock):0}};
 const turboCtx=w.Vortex83Turbo.contextForCopy(data);
 if(!turboCtx?.plan)return {side:'wait',score:null,accepted:false,reason:'Contexto Turbo indisponível'};
 const report=w.Vortex91Core.analyze(data,turboCtx,[]);
 const p=turboCtx.plan,side=p.side,valid=['buy','sell'].includes(side);
 const approved=Boolean(report?.ready&&p?.hasLevels&&report?.qualityCheck?.valid&&report.qualityCheck.fresh
  &&!report.qualityCheck.gaps&&valid);
 // A macro is never silently made "verified" for historical replay.
 return {side,score:good(report?.score)?report.score:null,entry:p.entry,
  stop:p.stop,target:p.targets?.[0],accepted:approved,
  reason:approved?'':(report?.brakes||report?.reasons||[turboCtx.macro?.reason||'Aguardando macro']).join(' · ').slice(0,300),
  macroVerified:macro.verified===true,raw:report};
}
function settlement(bars,start,signal,tf,cost){
 const ms=FRAME[tf],side=signal.side==='buy'?1:-1,prev=bars[start],next=bars[start+1];
 if(!next||next.t!==prev.t+ms)return {result:'incomplete',reason:'Próxima vela ausente',lastIndex:start};
 const open=next.open,base=real(signal.entry),stopDist=real(signal.stopDist),targetDist=real(signal.targetDist);
 let stop=good(signal.stop)?signal.stop:base-side*stopDist;
 let target=good(signal.target)?signal.target:base+side*targetDist;
 const risk=Math.abs(open-stop);
 if(!good(base)||!good(stop)||!good(target)||!good(risk)||risk<=0||open<=0
   ||(side>0?(stop>=open||target<=open):(stop<=open||target>=open)))
  return {result:'incomplete',reason:'Gap ou níveis incoerentes na abertura seguinte',lastIndex:start+1};
 const max=Math.min(bars.length-1,start+6);let last=start,exit=null,result='expired';
 for(let j=start+1;j<=max;j++){
  const b=bars[j];
  if(j>start+1&&b.t!==bars[j-1].t+ms){result='incomplete';last=j;break;}
  const touchStop=side>0?b.low<=stop:b.high>=stop;
  const touchTarget=side>0?b.high>=target:b.low<=target;
  last=j;
  if(touchStop&&touchTarget){result='ambiguous';break;}
  if(touchStop||touchTarget){result=touchTarget?'win':'loss';exit=touchTarget?target:stop;break;}
 }
 if(result==='expired'&&max<start+6)result='pending';
 return {result,reason:result==='ambiguous'?'TP e SL na mesma vela; ordem desconhecida':null,
  lastIndex:last,open,stop,target,R:exit===null?null:((exit-open)*side-cost)/risk};
}
/* options.data: {asset,tf,feedSymbol,candles,mtf?,historicalMacro?}
 * Requires a verified historical series for the exact symbol/TF.
 * Never runs a market broker or uploads user's P&L. */
function runReplay(options={}) {
 const data=asObject(options.data),asset=String(data.asset||''),tf=String(data.tf||''),engine=String(options.engine||'classic');
 if(!['classic','turbo','indices'].includes(engine))throw Error('Motor inválido');
 if(engine==='indices'&&!['WIN','WDO','NASDAQ','SP500'].includes(asset))
  throw Error('Índices usa apenas WIN, WDO, NASDAQ e SP500');
 if(engine!=='indices'&&['WIN','WDO','NASDAQ','SP500'].includes(asset))
  throw Error('Use o motor Índices para o ativo solicitado');
 const bars=parseBars(data.candles,tf,options.now||Date.now());
 checkIdentity(asset,data.feedSymbol,tf,bars);
 const mtf={};
 for(const [k,rows] of Object.entries(asObject(data.mtf))){
  if(!FRAME[k]||k===tf)continue;
  mtf[k]=parseBars(rows,k,options.now||Date.now());
 }
 const runtime=options.runtime||createRuntime(),ms=FRAME[tf],start=Math.max(60,Math.max(0,bars.length-380));
 const all=[],blocked={},errors=[],sample=[];
 const n=bars.length;let endOfLast=-1;
 for(let i=start;i<n-1;i++){
  const current=bars.slice(Math.max(0,i-220),i+1);
  if(current.length<60)continue;
  let gap=false;
  for(let k=Math.max(1,current.length-22);k<current.length;k++)
   if(current[k].t-current[k-1].t!==ms){gap=true;break;}
  if(gap){blocked.candles_gap=(blocked.candles_gap||0)+1;continue;}
  const close=bars[i].t+ms;
  let reading;
  try{reading=analyzePoint({asset,tf,feedSymbol:data.feedSymbol,bars:current,clock:close,engine},
    {runtime,mtf},{...options,macroForClose:options.macroForClose});}
  catch(e){errors.push({closedAt:close,message:String(e?.message||e).slice(0,170)});continue;}
  if(!reading.accepted){
   const why=engine==='turbo'&&!reading.macroVerified?'macro_unverified':reading.reason?.slice(0,65)||'technical';
   blocked[why]=(blocked[why]||0)+1;continue;
  }
  if(i<=endOfLast){blocked.overlap=(blocked.overlap||0)+1;continue;}
  const result=settlement(bars,i,reading,tf,Math.max(0,Number(options.costPrice)||0));
  all.push({asset,tf,engine,score:reading.score,side:reading.side,t:bars[i].t,
   closedAt:close,entryAt:bars[i+1].t,...result});
  endOfLast=result.lastIndex;
  if(sample.length<5)sample.push({t:bars[i].t,score:reading.score,side:reading.side,source:engine});
 }
 const cutoff=bars[Math.floor(bars.length*.7)]?.t||Infinity,embargo=ms*6;
 const train=all.filter(x=>x.t<cutoff-embargo);
 const validation=all.filter(x=>x.t>=cutoff+embargo);
 return {version:'11.5',engine,asset,tf,feedSymbol:data.feedSymbol,
  assessedFrom:bars[start]?.t,assessedTo:bars.at(-1).t+ms,
  rawCandles:bars.length,metadata:'Cálculos dos motores efetivos em VM isolado, tempo histórico fixado e leitura causal',
  overall:summarize(all),train:summarize(train),validation:summarize(validation),
  blocked,errors:errors.slice(0,25),sample,
  limitations:['Macro histórica não fornecida mantém o Turbo bloqueado',
  'Ajustes por memória e notícias futuras não são reconstruídos',
  'Preenchimento no próximo candle aberto, sem modelagem de book/liquidez da corretora',
  'Simulação histórica é diferente de observação prospectiva e não comprova lucro']};
}
module.exports={runReplay,parseBars,checkIdentity,settlement,summarize,analyzePoint,FRAME};
