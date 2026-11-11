/* Storm Códex IA v10.0 — auditoria causal para Clássico e Turbo.
 * Apenas candles fechados; heurísticas OHLC, nunca fluxo de ordens/LLM.
 * Funções puras e testáveis, sem dados futuros, sem APIs e sem ordem real.
 */
(function(host,factory){
  const api=factory();
  if(host)host.StormDualCore100=api;
  if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const VERSION='10.1-dual-engine',FRAME={M1:60000,M5:300000,M15:900000,H1:3600000};
const finite=x=>typeof x==='number'&&Number.isFinite(x),clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const valid=b=>b&&[b.t,b.open,b.high,b.low,b.close].every(finite)&&b.high>=Math.max(b.open,b.close,b.low)&&b.low<=Math.min(b.open,b.close,b.high);
const dir=x=>x>0?'buy':x<0?'sell':null;
function pivots(bars,at,atr){
  if(!Array.isArray(bars)||at<7||!finite(atr)||atr<=0)return [];
  const out=[];
  for(let j=Math.max(2,at-100);j<=at-2;j++){
    const a=bars.slice(j-2,j+3);if(a.length!==5||!a.every(valid))continue;
    const high=a[2].high>a[1].high&&a[2].high>=a[0].high&&a[2].high>a[3].high&&a[2].high>=a[4].high;
    const low=a[2].low<a[1].low&&a[2].low<=a[0].low&&a[2].low<a[3].low&&a[2].low<=a[4].low;
    if(high===low)continue;
    out.push({type:high?'H':'L',price:high?a[2].high:a[2].low,index:j,t:bars[j].t});
  }
  return out;
}
function zones(bars,at,atr){
  const points=pivots(bars,at,atr),groups=[];
  for(const p of points){
    let g=groups.find(z=>z.type===p.type&&Math.abs(z.price-p.price)<=atr*.48);
    if(g){g.price=(g.price*g.count+p.price)/(g.count+1);g.count++;g.last=p.index;g.first=Math.min(g.first,p.index);}
    else groups.push({type:p.type,price:p.price,count:1,last:p.index,first:p.index});
  }
  const close=bars[at]?.close;
  return groups.map(z=>({...z,age:at-z.last,grade:clamp(z.count*1.5-Math.max(0,at-z.last-22)/30,0,6),
    relation:z.price>close?'above':z.price<close?'below':'at'}))
    .filter(z=>z.grade>=1&&z.age<=75).sort((a,b)=>b.grade-a.grade||a.age-b.age);
}
function structure(bars,at,atr,side,tf='M5'){
  const neutral={direction:null,confidence:0,aligned:false,breakout:false,retest:false,trap:null,zone:null,reasons:['Estrutura OHLC insuficiente']};
  if(!Array.isArray(bars)||at<25||!finite(atr)||atr<=0||!valid(bars[at]))return neutral;
  const history=bars.slice(0,at+1),piv=pivots(history,at,atr),hs=piv.filter(x=>x.type==='H'),ls=piv.filter(x=>x.type==='L');
  const higherH=hs.length>=2?Math.sign(hs.at(-1).price-hs.at(-2).price):0;
  const higherL=ls.length>=2?Math.sign(ls.at(-1).price-ls.at(-2).price):0;
  const direction=higherH===higherL&&higherH!==0?dir(higherH):null;
  const confidence=direction?Math.min(1,(Math.abs(hs.at(-1).price-hs.at(-2).price)+Math.abs(ls.at(-1).price-ls.at(-2).price))/Math.max(atr*2,.000001)):0;
  const group=zones(history,at,atr),now=history[at],pre=history.slice(Math.max(0,at-21),at);
  const hi=Math.max(...pre.map(x=>x.high)),lo=Math.min(...pre.map(x=>x.low));
  const length=Math.max(atr*.01,now.high-now.low),body=Math.abs(now.close-now.open)/length;
  const closePower=side==='buy'?(now.close-now.low)/length:(now.high-now.close)/length;
  const breakout=side==='buy'
    ?now.close>hi+atr*.07&&now.close>now.open&&body>=.42&&closePower>=.67
    :side==='sell'&&now.close<lo-atr*.07&&now.close<now.open&&body>=.42&&closePower>=.67;
  const prev=history.slice(Math.max(0,at-4),at);
  const brokenBefore=side==='buy'
    ?prev.some(x=>x.close>hi-atr*.18)
    :prev.some(x=>x.close<lo+atr*.18);
  const candidate=group.find(z=>z.type===(side==='buy'?'H':'L')&&Math.abs(z.price-now.close)<atr*1.3);
  const retest=!!candidate&&brokenBefore&&(side==='buy'
    ?now.low<=candidate.price+atr*.2&&now.close>candidate.price+atr*.08
    :now.high>=candidate.price-atr*.2&&now.close<candidate.price-atr*.08);
  const prior=history.slice(Math.max(0,at-22),at);
  const up=Math.max(...prior.map(x=>x.high)),down=Math.min(...prior.map(x=>x.low));
  let trap=null;
  if(now.high>up+atr*.065&&now.close<up-atr*.01)trap='buy';
  else if(now.low<down-atr*.065&&now.close>down+atr*.01)trap='sell';
  else {
    const earlier=history.slice(Math.max(0,at-24),at-2),last2=history.slice(at-2,at);
    if(earlier.length>=8&&last2.length===2){
      const high=Math.max(...earlier.map(x=>x.high)),low=Math.min(...earlier.map(x=>x.low));
      if(last2.some(x=>x.close>high+atr*.07)&&now.close<high-atr*.04)trap='buy';
      if(last2.some(x=>x.close<low-atr*.07)&&now.close>low+atr*.04)trap='sell';
    }
  }
  const zone=group.find(z=>z.type===(side==='buy'?'L':'H')&&Math.abs(z.price-now.close)<atr*3)||null;
  const reasons=[];
  if(direction)reasons.push('Topos e fundos confirmados: '+(direction==='buy'?'altistas':'baixistas'));
  if(breakout)reasons.push('Fechamento rompeu faixa de 21 candles com corpo e posição favoráveis');
  if(retest)reasons.push('Reteste de pivô confirmado por fechamento');
  if(zone)reasons.push('Zona com '+zone.count+' pivô(s) confirmado(s), idade '+zone.age+' candles');
  if(trap)reasons.push('Rompimento devolvido/varredura contra '+(trap==='buy'?'compras':'vendas'));
  if(!reasons.length)reasons.push('Sem confirmação estrutural adicional');
  return {direction,confidence,aligned:side===direction,breakout,retest,trap,zone,reasons};
}
function classicReview({bars,at,atr,side,tf='M5',waves,pa,mtf,market}={}){
  const s=structure(bars,at,atr,side,tf);
  let delta=0;const messages=[...s.reasons];
  if(s.direction&&s.confidence>=.25)delta+=s.aligned?2:-3;
  if(s.breakout||s.retest)delta+=2;
  if(s.trap===side){delta-=5;messages.push('Risco contra a entrada confirmado por candle fechado');}
  if(waves?.direction&&waves.direction!==side&&waves.phase!=='NEUTRO'){delta-=2;messages.push('Elliott contradiz pivôs/Price Action; peso reduzido');}
  // Escalas curtas exigem confirmação de contexto; H1 aceita menos ruído microestrutural.
  if(tf==='M1'&&mtf?.available===0){delta-=2;messages.push('M1 sem comparações temporais válidas');}
  if(tf==='H1'&&s.breakout)delta+=1;
  if(tf==='M5'&&mtf?.available>=2&&mtf.weighted>.4)delta+=1;
  if(tf==='M15'&&s.zone?.grade>=3&&pa?.rejection)delta+=1;
  if(market?.sideways&&!s.retest&&!pa?.rejection&&s.direction!==side)delta-=1;
  return {version:VERSION,delta:clamp(delta,-9,5),structure:s,messages};
}

/* Confluências inspiradas em métodos públicos da VTX Trade IA: não reproduz seu
 * algoritmo proprietário. Todos os cálculos são OHLC causais de velas fechadas.
 * Indicadores correlacionados não contam como provas independentes. */
function technicalConfluence(bars,side,atr){
 const empty={ready:false,rsi:null,macd:null,macdSignal:null,macdHistogram:null,
  bollinger:null,wyckoff:'não identificado',session:'indisponível',confirmations:0,oppositions:0,messages:['Indicadores sem histórico fechado suficiente']};
 if(!Array.isArray(bars)||bars.length<54||!['buy','sell'].includes(side)||
   !finite(atr)||atr<=0||!bars.slice(-54).every(valid))return empty;
 const last=bars.at(-1),price=last.close,closes=bars.map(x=>x.close);
 const n=14;let gains=0,losses=0;
 for(let j=1;j<=n;j++){const d=closes[j]-closes[j-1];gains+=Math.max(0,d);losses+=Math.max(0,-d);}
 let avgUp=gains/n,avgDown=losses/n;
 for(let j=n+1;j<closes.length;j++){const d=closes[j]-closes[j-1];
   avgUp=(avgUp*(n-1)+Math.max(0,d))/n;avgDown=(avgDown*(n-1)+Math.max(0,-d))/n;}
 const rsi=avgDown===0?(avgUp===0?50:100):100-100/(1+avgUp/avgDown);
 let fast=closes[0],slow=closes[0],macdSignal=0,histPrev=0,macd=0,hist=0;
 for(let j=1;j<closes.length;j++){
   fast+=(2/13)*(closes[j]-fast);slow+=(2/27)*(closes[j]-slow);
   macd=fast-slow;histPrev=hist;macdSignal+=(2/10)*(macd-macdSignal);hist=macd-macdSignal;
 }
 const window=closes.slice(-20),mid=window.reduce((a,b)=>a+b,0)/20;
 const deviation=Math.sqrt(window.reduce((a,b)=>a+(b-mid)**2,0)/20);
 const upper=mid+2*deviation,lower=mid-2*deviation;
 const bandwidth=mid!==0?(upper-lower)/Math.abs(mid):0;
 const channel=price>=upper?'faixa superior':price<=lower?'faixa inferior':'dentro das bandas';
 const high=Math.max(...bars.slice(-21,-1).map(x=>x.high));
 const low=Math.min(...bars.slice(-21,-1).map(x=>x.low));
 const spring=last.low<low-.05*atr&&last.close>low+.03*atr&&last.close>last.open;
 const upthrust=last.high>high+.05*atr&&last.close<high-.03*atr&&last.close<last.open;
 const wyckoff=spring?'spring OHLC (reação após varredura)':upthrust?'upthrust OHLC (rejeição de topo)':'sem spring/upthrust confirmado';
 const favour=side==='buy'?1:-1;
 const rsiScore=rsi>=52&&rsi<=74?1:rsi<=48&&rsi>=26?-1:0;
 const macdScore=hist>0&&hist>=histPrev?1:hist<0&&hist<=histPrev?-1:0;
 const bandScore=price>mid&&price<upper+atr*.15?1:price<mid&&price>lower-atr*.15?-1:0;
 const votes=[rsiScore,macdScore,bandScore];
 const confirmations=votes.filter(v=>v===favour).length,oppositions=votes.filter(v=>v===-favour).length;
 const counterTrap=(side==='buy'&&upthrust)||(side==='sell'&&spring);
 const confirmTrap=(side==='buy'&&spring)||(side==='sell'&&upthrust);
 const hour=new Date(last.t).getUTCHours();
 const session=hour>=13&&hour<17?'sobreposição Londres–NY (UTC)':
  hour>=7&&hour<13?'sessão europeia (UTC)':hour>=17&&hour<22?'sessão americana tardia (UTC)':'fora da sobreposição principal (UTC)';
 const messages=[
   'RSI(14) '+rsi.toFixed(1)+'; MACD(12,26,9) hist '+hist.toFixed(5),
   'Bollinger(20,2): '+channel+'; largura '+(bandwidth*100).toFixed(2)+'%',
   'Wyckoff por OHLC: '+wyckoff+' (sem confirmação de volume institucional)',
   'Janela: '+session+' (informativa; sem taxa de acerto presumida)'
 ];
 return {ready:true,rsi,macd,macdSignal,macdHistogram:hist,bollinger:{mid,upper,lower,bandwidth,channel},
  wyckoff,session,confirmations,oppositions,counterTrap,confirmTrap,messages};
}

function turboReview({bars,tf='M5',side,atr,components,regime}={}){
  const rows=Array.isArray(components)?components.map(x=>({...x})):[];
  const s=structure(bars,Array.isArray(bars)?bars.length-1:-1,atr,side,tf);
  const mod=(name,change,why)=>{
    const r=rows.find(x=>x.name===name);if(!r)return;
    const before=r.earned;r.earned=clamp(r.earned+change,0,r.max);
    if(r.earned!==before)r.note+=' · '+why;
  };
  const evidence=[],technical=technicalConfluence(bars,side,atr);
  // Indicadores do mesmo candle/regime NÃO são evidências independentes.
  const structureScore=rows.find(x=>x.name==='Estrutura e price action')?.earned||0;
  const trendScore=rows.find(x=>x.name==='Médias e momentum')?.earned||0;
  if(structureScore>=20&&trendScore>=10){mod('Médias e momentum',-2,'correlação com estrutura');evidence.push('Correlação estrutura/médias descontada');}
  const fvg=rows.find(x=>x.name==='Order Block e FVG')?.earned||0;
  const fib=rows.find(x=>x.name==='Fibonacci e padrões')?.earned||0;
  if(fvg>=11&&fib>=7){mod('Fibonacci e padrões',-2,'mesma região OHLC');evidence.push('Sobreposição zona/Fibonacci descontada');}
  if(regime?.kind==='range'){
    mod('Médias e momentum',-2,'mercado lateral');
    if(!s.retest&&!s.breakout)mod('Estrutura e price action',-2,'sem rejeição/ruptura local');
    evidence.push('Pesos ajustados para consolidação');
  }else if(regime?.kind==='trend'||regime?.kind==='breakout'){
    if(s.breakout||s.retest)mod('Estrutura e price action',+1,'confirmação causal');
    evidence.push('Estrutura priorizada no regime direcional');
  }else if(regime?.kind==='volatile'){
    mod('Médias e momentum',-2,'volatilidade irregular');
  }
  if(s.direction&&s.confidence>=.25&&s.direction!==side){
    mod('Estrutura e price action',-3,'direção independente divergente');
    evidence.push('Direção independente '+(s.direction==='buy'?'compradora':'vendedora')+' diverge');
  }else if(s.direction&&s.confidence>=.25){
    evidence.push('Direção independente confirma '+(side==='buy'?'compra':'venda'));
  }
  if(s.trap===side){
    mod('Liquidez e armadilhas',-5,'rompimento devolvido');
    evidence.push('Armadilha adicional contra a direção detectada');
  }
  if(technical.ready){
    // Os três osciladores derivam do MESMO preço: bônus de até 1 ponto,
    // mas contradições fortes e armadilhas impactam o sinal.
    if(technical.confirmations>=2&&technical.oppositions===0)
      mod('Médias e momentum',1,'RSI/MACD/Bollinger concordantes, bônus limitado');
    if(technical.oppositions>=2)
      mod('Médias e momentum',-3,'RSI/MACD/Bollinger contraditórios');
    if(technical.counterTrap)
      mod('Liquidez e armadilhas',-4,'rejeição Wyckoff OHLC oposta');
    if(technical.confirmTrap)
      mod('Liquidez e armadilhas',1,'reação Wyckoff OHLC favorável');
    if((side==='buy'&&technical.rsi>82)||(side==='sell'&&technical.rsi<18))
      mod('Médias e momentum',-2,'oscilador estendido; risco de exaustão');
    evidence.push(...technical.messages);
  }else evidence.push('RSI/MACD/Bollinger não calculados: histórico fechado insuficiente');
  if(tf==='M1'&&rows.find(x=>x.name==='Confluência M1–H1')?.earned<=5){
    mod('Confluência M1–H1',-2,'M1 sem confirmação alta');
  }
  return {version:VERSION,components:rows,independentDirection:s.direction,directionConfidence:s.confidence,
    structure:s,technical,scoreDelta:rows.reduce((n,x)=>n+x.earned,0)-components.reduce((n,x)=>n+x.earned,0),messages:evidence};
}
function summarize(rows,engine,{costR=0}={}){
  costR=finite(costR)?clamp(costR,0,2):0;
  const relevant=(rows||[]).filter(r=>r&&r.origin===(engine==='classic'?'observed_precision':'observed_turbo_selective')&&
    (engine==='classic'?r.approved:r.mode==='live'));
  const ended=relevant.filter(r=>engine==='classic'?['win','loss'].includes(r.status):['tp1','tp2','tp3','stop'].includes(r.status))
    .sort((a,b)=>a.closedAt-b.closedAt||a.t-b.t);
  const gross=r=>{
    if(engine==='classic')return r.status==='loss'?-1:finite(r.target)&&finite(r.stop)&&r.stop>0?r.target/r.stop:NaN;
    if(r.status==='stop')return -1;
    const risk=finite(r.entry)&&finite(r.stop)?Math.abs(r.entry-r.stop):0;
    const idx=Math.max(0,['tp1','tp2','tp3'].indexOf(r.status));
    const target=finite(r.targets?.[idx])?r.targets[idx]:r.targets?.[0];
    return risk>0&&finite(target)?Math.abs(target-r.entry)/risk:NaN;
  };
  const valid=ended.map(r=>{const grossR=gross(r);return {...r,grossR,value:grossR-costR};})
    .filter(r=>finite(r.grossR)&&r.grossR>-10&&r.grossR<30);
  const n=valid.length,wins=valid.filter(x=>x.grossR>0).length;
  const pos=valid.reduce((s,x)=>s+Math.max(0,x.value),0),neg=valid.reduce((s,x)=>s+Math.min(0,x.value),0);
  const split=Math.floor(n*.7),train=valid.slice(0,split),test=valid.slice(split);
  const avg=a=>a.length?a.reduce((s,x)=>s+x.value,0)/a.length:null;
  // Grupos selecionados SOMENTE no treino; holdout permanece cronológico.
  const group=(key,minN)=>{
    const grouped=new Map();
    for(const r of train){const label=String(key(r)||'não informado'),g=grouped.get(label)||[];g.push(r);grouped.set(label,g);}
    const best=[...grouped.entries()].filter(x=>x[1].length>=minN).map(([name,a])=>({name,n:a.length,meanR:avg(a)}))
      .sort((a,b)=>b.meanR-a.meanR)[0]||null;
    if(best){const holdout=test.filter(r=>String(key(r)||'não informado')===best.name);
      best.holdoutN=holdout.length;best.holdoutR=avg(holdout);}
    return best;
  };
  const best=group(r=>r.setup||r.strategy,10),bestRegime=group(r=>r.regime,8),bestTF=group(r=>r.tf,8);
  return {n,pending:relevant.filter(x=>x.status==='pending').length,excluded:relevant.length-ended.length,
    winRate:n?wins/n:null,meanR:avg(valid),grossMeanR:n?valid.reduce((x,y)=>x+y.grossR,0)/n:null,
    costR,profitFactor:neg<0?pos/Math.abs(neg):pos>0?Infinity:null,
    trainN:train.length,testN:test.length,trainR:avg(train),testR:avg(test),
    best,bestRegime,bestTF,validSample:n>=30&&test.length>=9,
    source:'Somente registros prospectivos observados no navegador; custo em R é estimativa do usuário, não execução aferida'};
}
function selfTest(){
  const tf=300000,make=(n,s=100)=>Array.from({length:n},(_,i)=>{
    const price=s+i*.2+Math.sin(i*1.7)*1.5;
    return {t:1700000000000+i*tf,open:price-.12,high:price+.8,low:price-.8,close:price+.12};
  });
  const b=make(80),a=structure(b,60,1,'buy','M5'),future=make(80);
  for(let i=61;i<future.length;i++){future[i].high+=400;future[i].low-=400;future[i].close+=200;}
  const c=structure(future,60,1,'buy','M5');
  const causal=JSON.stringify(a)===JSON.stringify(c);
  const comps=[{name:'Estrutura e price action',earned:22,max:23,note:'a'},
    {name:'Médias e momentum',earned:13,max:13,note:'b'},
    {name:'Order Block e FVG',earned:15,max:15,note:'c'},
    {name:'Fibonacci e padrões',earned:9,max:9,note:'d'}];
  const orig=JSON.stringify(comps),res=turboReview({bars:b,tf:'M5',side:'buy',atr:1,components:comps,regime:{kind:'range'}});
  const dedup=res.components.reduce((x,y)=>x+y.earned,0)<59&&JSON.stringify(comps)===orig;
  const history=[
    {origin:'observed_precision',approved:true,status:'win',closedAt:1,t:1,target:1.8,stop:1},
    {origin:'observed_precision',approved:true,status:'loss',closedAt:2,t:2,target:1.8,stop:1},
    {origin:'observed_precision',approved:true,status:'pending',closedAt:3,t:3,target:1.8,stop:1}
  ],p=summarize(history,'classic');
  return {ok:causal&&dedup&&p.n===2&&p.pending===1&&p.meanR>.39&&p.meanR<.41,
    tests:{noFutureLeak:causal,correlationPenalty:dedup,observedOnly:p.n===2&&p.pending===1,meanR:p.meanR}};
}
return {VERSION,FRAME,valid,pivots,zones,structure,technicalConfluence,classicReview,turboReview,summarize,selfTest};
});
