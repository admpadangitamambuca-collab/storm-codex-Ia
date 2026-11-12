/* Storm Codex IA 11.2 — camada causal de qualidade e setups.
 * Não usa candles futuros, parâmetros otimizados em retrospectiva nem ML fictício.
 * Clássico do ouro continua condicionado à projeção mínima de US$4 em UMA vela.
 * Turbo avalia de forma INDEPENDENTE setups XAU menores que US$4. */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.StormPrecision112=api;
})(typeof window!=='undefined'?window:globalThis,function(){'use strict';
 const MS={M1:60000,M5:300000,M15:900000,H1:3600000};
 const num=x=>typeof x==='number'&&Number.isFinite(x),clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 function ema(values,n){let v=values[0];const k=2/(n+1);return values.map((p,i)=>(v=i?v+k*(p-v):p));}
 function rsi(values,n=14){
  if(values.length<n+3)return null;
  let gain=0,loss=0;
  for(let i=1;i<=n;i++){const d=values[i]-values[i-1];gain+=Math.max(0,d);loss+=Math.max(0,-d)}
  gain/=n;loss/=n;
  for(let i=n+1;i<values.length;i++){
   const d=values[i]-values[i-1];gain=(gain*(n-1)+Math.max(0,d))/n;loss=(loss*(n-1)+Math.max(0,-d))/n;
  }
  return loss===0?(gain===0?50:100):100-100/(1+gain/loss);
 }
 function inspect(bars,tf,side,asset,{mode='live',providerStale=false}={}){
  const ms=MS[tf],empty={ready:false,scoreDelta:0,hardBlocks:['OHLC não validado'],notes:[],bias:'wait'};
  if(!ms||!Array.isArray(bars)||bars.length<70||!['buy','sell'].includes(side))return empty;
  const c=bars.slice(-160);
  for(let i=0;i<c.length;i++){
   const b=c[i];if(!b||![b.t,b.open,b.high,b.low,b.close].every(num)||b.t<=0||b.open<=0||b.low<=0||
    b.high<Math.max(b.open,b.close)||b.low>Math.min(b.open,b.close)||b.high<b.low||(i&&b.t<=c[i-1].t))return empty;
  }
  const last=c.at(-1),prev=c.at(-2),closedAt=last.t+ms,validClose=closedAt<=Date.now()+1200;
  if(!validClose)return {...empty,hardBlocks:['Última vela ainda não está fechada']};
  const closes=c.map(b=>b.close),e9=ema(closes,9),e21=ema(closes,21),e50=ema(closes,50),r=rsi(closes);
  const tr=c.map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-(c[i-1]?.close??b.open)),Math.abs(b.low-(c[i-1]?.close??b.open))));
  const atr=tr.slice(-14).reduce((a,b)=>a+b,0)/14;
  const median=tr.slice(-56).reduce((a,b)=>a+b,0)/56,atrRatio=median>0?atr/median:0;
  const dir=side==='buy'?1:-1;
  const efficiency=Math.abs(last.close-c.at(-21).close)/
   Math.max(1e-8,c.slice(-20).reduce((sum,b,i,a)=>sum+Math.abs(b.close-(i?a[i-1].close:c.at(-21).close)),0));
  const high14=Math.max(...c.slice(-14).map(b=>b.high)),low14=Math.min(...c.slice(-14).map(b=>b.low));
  const sum14=tr.slice(-14).reduce((a,b)=>a+b,0);
  const chop=high14>low14?100*Math.log10(Math.max(1,sum14/(high14-low14)))/Math.log10(14):100;
  const closePower=(last.close-last.low)/Math.max(1e-9,last.high-last.low);
  const power=side==='buy'?closePower:1-closePower;
  const body=dir*(last.close-last.open)/Math.max(atr,1e-9);
  const emaTrend=dir*(e9.at(-1)-e21.at(-1))/Math.max(atr,1e-9);
  const slowTrend=dir*(e21.at(-1)-e50.at(-1))/Math.max(atr,1e-9);
  const slope=dir*(e9.at(-1)-e9.at(-5))/Math.max(atr,1e-9);
  const stretch=Math.abs(last.close-e21.at(-1))/Math.max(atr,1e-9);
  const recent=c.slice(-22,-1),high=Math.max(...recent.map(b=>b.high)),low=Math.min(...recent.map(b=>b.low));
  const breakout=dir>0?last.close>high:last.close<low;
  const sweepAgainst=dir>0?(last.high>high+atr*.06&&last.close<high-atr*.06):(last.low<low-atr*.06&&last.close>low+atr*.06);
  const counterWick=dir>0?(last.high-last.close)/Math.max(atr,1e-9):(last.close-last.low)/Math.max(atr,1e-9);
  const fast=ema(closes,12),slow=ema(closes,26),macd=fast.map((x,i)=>x-slow[i]);
  const hist=macd.at(-1)-ema(macd,9).at(-1);
  let scoreDelta=0;
  scoreDelta+=emaTrend>.10?2:emaTrend<-.13?-3:0;
  scoreDelta+=slowTrend>.10?1:slowTrend<-.25?-2:0;
  scoreDelta+=slope>.15?1:slope<-.20?-2:0;
  scoreDelta+=efficiency>.42&&chop<55?1:chop>65?-2:0;
  scoreDelta+=breakout&&power>.64?1:0;
  scoreDelta+=power<.35||body<-.12?-2:power>.67&&body>.28?1:0;
  scoreDelta+=dir*hist>0?1:-1;
  if(num(r)&&(dir>0&&r>77||dir<0&&r<23))scoreDelta-=1;
  scoreDelta=Math.round(clamp(scoreDelta,-6,4));
  const hardBlocks=[];
  if(mode!=='live'||providerStale)hardBlocks.push('Fonte simulada ou atrasada; sinal operacional bloqueado');
  if(atrRatio>2.7||atrRatio<.32)hardBlocks.push('Volatilidade extrema ou liquidez/variação insuficiente');
  if(stretch>2.65)hardBlocks.push('Preço esticado além de 2,65 ATR da EMA21');
  if(sweepAgainst&&counterWick>.50)hardBlocks.push('Varredura com rejeição contrária ao viés');
  if(body>2.35)hardBlocks.push('Candle impulsivo excessivo; risco de perseguir a entrada');
  const notes=[
   'EMA9/21 '+(emaTrend>0?'a favor':'contra')+' · EMA21/50 '+(slowTrend>0?'a favor':'contra'),
   'Força direcional '+Math.round(efficiency*100)+'% · Choppiness '+Math.round(chop),
   'ATR14 '+atr.toFixed(asset==='XAUUSD'?2:5)+' · regime '+atrRatio.toFixed(2)+'×',
   'RSI14 '+(r===null?'—':r.toFixed(1))+' · momentum MACD '+(dir*hist>0?'favorável':'contrário'),
   breakout?'Rompimento de 21 candles confirmado':'Sem rompimento de 21 candles'
  ];
  return {ready:true,scoreDelta,hardBlocks,notes,atr,atrRatio,efficiency,chop,
   power,body,emaTrend,slowTrend,slope,stretch,breakout,sweepAgainst,rsi:r,macdHistogram:hist,
   bias:side,closedAt,sourceEngine:'precision-11.2'};
 }
 function enhanceClassic(analysis,bars,tf,asset,meta={}){
  if(!analysis||!['buy','sell'].includes(analysis.side))return analysis;
  const q=inspect(bars,tf,analysis.side,asset,meta);
  if(!q.ready)return analysis;
  const original=Number(analysis.score)||0,score=clamp(Math.round(original+q.scoreDelta),0,95);
  const block=q.hardBlocks.length>0;
  return {...analysis,score,precision112:q,
   reasons:[...(analysis.reasons||[]),'Precision 11.2: '+q.notes.join(' · ')+' · ajuste '+(q.scoreDelta>=0?'+':'')+q.scoreDelta],
   quality:block?'EVITAR':analysis.quality,
   operationalReason:block?'Precision 11.2: '+q.hardBlocks.join(' | '):analysis.operationalReason,
   v93:analysis.v93?{...analysis.v93,operational:block?false:analysis.v93.operational}:analysis.v93};
 }
 function turboGold(data,legacy){
  const bars=data?.state?.candles||[],tf=data?.tf;
  const base=legacy?.turboBase||{};
  const side=['buy','sell'].includes(base.side)?base.side:
   ['buy','sell'].includes(legacy?.candidateSide)?legacy.candidateSide:
   ['buy','sell'].includes(legacy?.oneCandleGate?.originalSide)?legacy.oneCandleGate.originalSide:null;
  if(!side)return {ready:false,reason:'Sem direção de price action válida',hardBlocks:[]};
  const q=inspect(bars,tf,side,'XAUUSD',{mode:data.state?.mode,providerStale:data.state?.providerStale});
  if(!q.ready)return {ready:false,reason:'OHLC do ouro insuficiente para avaliação independente',hardBlocks:q.hardBlocks||[]};
  const last=bars.at(-1),entry=last.close,dir=side==='buy'?1:-1,atr=q.atr;
  const pivot=bars.slice(-22,-1),hi=Math.max(...pivot.map(b=>b.high)),lo=Math.min(...pivot.map(b=>b.low));
  const room=dir>0?hi-entry:entry-lo;
  // O alvo usa ATR/estrutura do período, NÃO o filtro de uma vela/US$4 do Clássico.
  // Respeita 1.25R de razão nominal, e pode perfeitamente ficar ABAIXO de US$4.
  const stopDist=Math.max(.02,Number((atr*(q.chop>62?1.10:.86)).toFixed(2)));
  const minimum=stopDist*1.30;
  const preferred=atr*(q.breakout?1.50:q.efficiency>.44?1.35:1.22);
  const cappedRoom=room>atr*.15?Math.min(preferred,room+atr*.30):preferred;
  const targetDist=Math.max(.02,Number(Math.max(minimum,cappedRoom).toFixed(2)));
  const netRR=targetDist/stopDist;
  const baseBad=base.quality==='EVITAR';
  const hardBlocks=[...q.hardBlocks];
  if(baseBad)hardBlocks.push('Motor de base já identificou risco técnico (não ligado exclusivamente aos US$4)');
  if(netRR<1.2)hardBlocks.push('Risco/recompensa insuficiente');
  if(q.emaTrend<-.22&&q.slowTrend<-.20)hardBlocks.push('EMAs 9/21/50 contra a direção');
  const ready=hardBlocks.length===0;
  const context=targetDist<4?'PROJEÇÃO MENOR QUE US$4 — Turbo independente':'PROJEÇÃO ≥ US$4 — Turbo independente';
  return {ready,side,entry,stopDist,targetDist,netRR,
   stop:entry-dir*stopDist,tp1:entry+dir*targetDist,reference:'OHLC fechado · volatilidade/estrutura',
   independent:true,context,classicGate:legacy?.oneCandleGate?.accepted===true,
   quality:ready?'ALTA':'EVITAR',reason:hardBlocks.join(' | ')||'Leitura independente dos US$4',
   hardBlocks,scoreDelta:q.scoreDelta,precision:q};
 }
 return Object.freeze({version:'11.2',MS,inspect,enhanceClassic,turboGold});
});
