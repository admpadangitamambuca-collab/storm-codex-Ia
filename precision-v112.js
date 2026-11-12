/* Storm Códex IA 11.2 — leitura causal fechada; Clássico e Turbo independentes. */
(function(root,factory){
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.StormPrecision112=api;
})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
 const TF={M1:60000,M5:300000,M15:900000,H1:3600000};
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const good=x=>typeof x==='number'&&Number.isFinite(x);
 function ema(xs,n){let v=xs[0],k=2/(n+1);return xs.map((x,i)=>(v=i?v+(x-v)*k:x));}
 function inspect(bars,tf,side){
  if(!Array.isArray(bars)||bars.length<65||!TF[tf]||!['buy','sell'].includes(side))
   return {ready:false,shift:0,brakes:[],reason:'OHLC ou direção insuficiente'};
  const c=bars.slice(-160),last=c.at(-1),ms=TF[tf],dir=side==='buy'?1:-1;
  for(let i=0;i<c.length;i++){
   const b=c[i];if(!b||![b.t,b.open,b.high,b.low,b.close].every(good)||b.t<=0||
    b.open<=0||b.low<=0||b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||
    (i&&b.t<=c[i-1].t))return {ready:false,shift:0,brakes:['OHLC inválido'],reason:'OHLC inválido'};
  }
  const close=c.map(b=>b.close),e9=ema(close,9),e21=ema(close,21),e50=ema(close,50);
  const tr=c.map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-(c[i-1]?.close??b.open)),Math.abs(b.low-(c[i-1]?.close??b.open))));
  const atr=tr.slice(-14).reduce((a,b)=>a+b,0)/14,baseline=tr.slice(-64,-14).reduce((a,b)=>a+b,0)/50;
  if(!(atr>0)||!(baseline>0))return {ready:false,shift:0,brakes:['ATR inválido'],reason:'ATR inválido'};
  let up=0,down=0;
  for(let i=close.length-14;i<close.length;i++){const x=close[i]-close[i-1];up+=Math.max(0,x);down+=Math.max(0,-x);}
  const rsi=down===0?100:100-100/(1+up/down);
  const pos=(last.close-last.low)/Math.max(last.high-last.low,1e-8);
  const body=dir*(last.close-last.open)/atr;
  const trend=dir*(e9.at(-1)-e21.at(-1))/atr;
  const longTrend=dir*(e21.at(-1)-e50.at(-1))/atr;
  const slope=dir*(e9.at(-1)-e9.at(-5))/atr;
  const stretch=Math.abs(last.close-e9.at(-1))/atr;
  const regime=atr/baseline,hi=Math.max(...c.slice(-22,-1).map(b=>b.high)),lo=Math.min(...c.slice(-22,-1).map(b=>b.low));
  const breakout=dir>0?last.close>hi:last.close<lo;
  const sweep=dir>0?last.high>hi&&last.close<hi:last.low<lo&&last.close>lo;
  const wickOpposite=dir>0?last.high-last.close:last.close-last.low;
  const wickRisk=wickOpposite/Math.max(Math.abs(last.close-last.open),.12*atr);
  const impulse=dir*(last.close-c.at(-4).close)/atr;
  const gaps=c.slice(-8).some((b,i,a)=>i>0&&b.t-a[i-1].t>ms*1.01);
  const shock=regime>2.9||tr.at(-1)>atr*3.1;
  const exhaustion=stretch>2.1||impulse>3.8||(wickRisk>2.8&&sweep);
  const aligned=trend>.06&&longTrend>-.12&&slope>-.06;
  const contraTrend=trend<-.18&&longTrend<-.20;
  const poorClose=(dir>0?pos<.32:pos>.68)||body<-.15;
  let shift=0;
  shift+=aligned?2:contraTrend?-3:0;
  shift+=breakout&&body>.18?2:0;
  shift+=poorClose?-2:body>.20&&body<1.5?1:0;
  shift+=sweep?-3:0;
  shift+=exhaustion?-3:0;
  shift+=shock?-3:regime>.68&&regime<1.7?1:0;
  shift+=dir>0?rsi>81?-2:rsi>44&&rsi<72?1:0:rsi<19?-2:rsi>28&&rsi<58?1:0;
  shift=clamp(shift,-5,4);
  const brakes=[];
  if(gaps)brakes.push('Lacuna nas 8 velas fechadas mais recentes');
  if(shock)brakes.push('Expansão anormal de volatilidade');
  if(contraTrend&&poorClose)brakes.push('Tendência contrária e fechamento sem confirmação');
  if(sweep&&wickRisk>1.3)brakes.push('Possível varredura de liquidez contra o sinal');
  const explanation=[
   'EMA alinhada '+(aligned?'sim':'não')+', distância '+trend.toFixed(2)+' ATR',
   'RSI '+rsi.toFixed(1)+' · ATR '+atr.toFixed(2)+' ('+regime.toFixed(2)+'× basal)',
   'Candle '+body.toFixed(2)+' ATR · pavio contrário '+wickRisk.toFixed(2)+'× corpo',
   'Preço/EMA9 '+stretch.toFixed(2)+' ATR · impulso 3 velas '+impulse.toFixed(2)+' ATR'];
  return {ready:true,shift,brakes,atr,atrRatio:regime,rsi,trend,longTrend,slope,stretch,
   breakout,sweep,wickRisk,impulse,priceAction:body,aligned,shock,exhaustion,explanation,
   reason:'EMA 9/21/50 · RSI14 · ATR14/regime · corpo e pavio · rompimento/sweep · exaustão'};
 }
 function refineClassic(analysis,candles,tf,asset,extra={}){
  if(!analysis)return analysis;
  const met=inspect(candles,tf,analysis.side);
  if(!met.ready)return {...analysis,precision112:met};
  const blocked=met.brakes.length>0||extra.providerStale===true;
  const score=clamp(Math.round((Number(analysis.score)||0)+met.shift),0,95);
  const operational=Boolean(analysis.v93?.operational)&&!blocked&&score>=70;
  const reasons=['Precision 11.2: '+met.explanation.join(' · ')+'; ajuste '+(met.shift>0?'+':'')+met.shift,...(analysis.reasons||[])];
  if(blocked)reasons.unshift('Cautela 11.2: '+(met.brakes.join('; ')||'feed defasado')+'.');
  const gold=asset==='XAUUSD',respectsGold=!gold||(analysis.oneCandleGate?.accepted===true&&Number(analysis.targetDist)>=4);
  return {...analysis,score,quality:operational&&respectsGold?analysis.quality:'EVITAR',
   operationalReason:operational&&respectsGold?analysis.operationalReason:
    (blocked?'Precision 11.2: '+(met.brakes.join('; ')||'feed defasado'):
     (!respectsGold?'Clássico XAUUSD exige ≥ US$ 4 por vela.':analysis.operationalReason)),
   reasons,precision112:met,
   v93:analysis.v93?{...analysis.v93,operational:operational&&respectsGold}:analysis.v93};
 }
 function refineTurbo(candidate,candles,tf,asset,extra={}){
  if(!candidate)return candidate;
  const met=inspect(candles,tf,candidate.side);
  if(!met.ready)return {...candidate,precision112:met};
  const entry=candles.at(-1)?.close,atr=met.atr;
  const oldStop=Number(candidate.stopDist),oldTarget=Number(candidate.targetDist);
  const validLevels=good(entry)&&entry>0&&good(oldStop)&&oldStop>0&&
   good(oldTarget)&&oldTarget>0&&['buy','sell'].includes(candidate.side);
  // Alvo original preservado até o limite 2,3 ATR; sem piso absoluto US$4.
  const stop=validLevels?Math.min(Math.max(oldStop,.50*atr),2.4*atr):0;
  const target=validLevels?Math.min(oldTarget,2.3*atr):0;
  const costs=Math.max(0,Number(candidate.costPerUnit)||0)+2*Math.max(0,Number(extra.slippage)||0);
  const rr=validLevels&&(stop+costs)>0?(target-costs)/(stop+costs):0;
  const blocked=met.brakes.length>0||extra.providerStale===true||!validLevels||rr<1.10||met.stretch>1.75;
  const score=clamp(Math.round((Number(candidate.score)||0)+met.shift),0,95);
  const quality=blocked||candidate.quality==='EVITAR'?'EVITAR':candidate.quality;
  const reasons=['Turbo Precision 11.2: '+met.explanation.join(' · ')+'; ajuste '+(met.shift>0?'+':'')+met.shift,
   'XAU Turbo: alvo por estrutura/ATR e risco-retorno, sem piso absoluto de US$ 4 por vela.',...(candidate.reasons||[])];
  return {...candidate,price:entry,score,targetDist:target,stopDist:stop,netRR:rr,
   riskMeta:{...(candidate.riskMeta||{}),rr:stop>0?target/stop:0,netRR:rr},
   quality,operationalReason:blocked?'Turbo: '+(met.brakes.join('; ')||'risco/retorno ou dados insuficientes'):candidate.operationalReason,
   reasons,precision112:met,turboGoldUnrestricted:asset==='XAUUSD',originalGateReference:asset==='XAUUSD'?4:null};
 }
 return Object.freeze({version:'11.2',TF,inspect,refineClassic,refineTurbo});
});
