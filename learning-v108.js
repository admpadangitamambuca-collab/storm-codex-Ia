/* STORM CÓDEX IA v10.8 — aprendizado prospectivo e independente dos três motores.
 * Apenas OHLC público fechado e observações feitas enquanto o navegador está ativo.
 * Não utiliza resultados futuros para gerar o sinal presente, nem aprende com demonstração,
 * importações históricas, candles faltantes ou casos TP/SL ambíguos.
 * Score /100 é heurística de confluência e NÃO é probabilidade calibrada.
 */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.StormOutcomeLearning108=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const TF=Object.freeze({M1:60000,M5:300000,M15:900000,H1:3600000});
 const ENGINES=['classic','indices','turbo'],MAX_ROWS=320,HORIZON=6,THRESHOLD=78;
 const armed=new Map(),lastModels=new Map();
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const valid=b=>b&&[b.t,b.open,b.high,b.low,b.close].every(finite)&&b.open>0&&b.low>0&&b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close);
 function key(engine,asset,tf){
  const profile=String(root.SGUserHistoryKey||'usuario_local').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60);
  return 'storm_v108_outcome_'+profile+'_'+engine+'_'+asset+'_'+tf;
 }
 function rowsOf(engine,asset,tf){
  try{
   const data=JSON.parse(root.localStorage?.getItem(key(engine,asset,tf))||'[]');
   return Array.isArray(data)?data.filter(r=>r&&r.engine===engine&&r.asset===asset&&r.tf===tf&&finite(r.t)&&['pending','win','loss','expired','ambiguous','incomplete'].includes(r.status)).slice(0,MAX_ROWS):[];
  }catch(e){return []}
 }
 function save(engine,asset,tf,rows){
  try{root.localStorage?.setItem(key(engine,asset,tf),JSON.stringify(rows.slice(0,MAX_ROWS)))}catch(e){}
 }
 function mean(xs){return xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0}
 function ema(closes,n){const k=2/(n+1);let e=closes[0];for(let i=1;i<closes.length;i++)e=k*closes[i]+(1-k)*e;return e}
 function rsi(bars){
  let up=0,down=0;for(let i=bars.length-14;i<bars.length;i++){
   const d=bars[i].close-bars[i-1].close;if(d>0)up+=d;else down-=d;
  }
  return down===0?100:100-100/(1+up/down);
 }
 function features(bars,side){
  const empty={ready:false,technical:0,regime:'indefinido',session:'indefinida',rsi:null,atr:null,efficiency:null,atrRatio:null,notes:[]};
  if(!Array.isArray(bars)||bars.length<45||!['buy','sell'].includes(side)||!bars.slice(-45).every(valid))return empty;
  const tail=bars.slice(-60),last=tail.at(-1),dir=side==='buy'?1:-1,closes=tail.map(b=>b.close);
  const tr=tail.map((b,i)=>Math.max(b.high-b.low,Math.abs(b.high-(tail[i-1]?.close??b.open)),Math.abs(b.low-(tail[i-1]?.close??b.open))));
  const atr=mean(tr.slice(-14)),previous=mean(tr.slice(-28,-14)),atrRatio=previous>0?atr/previous:1;
  if(!(atr>0))return empty;
  const gap=(ema(closes,9)-ema(closes,21))/atr;
  const sub=closes.slice(-13),efficiency=Math.abs(sub.at(-1)-sub[0])/(sub.slice(1).reduce((sum,n,i)=>sum+Math.abs(n-sub[i]),0)||1);
  const recent=closes.at(-1)-closes.at(-7),body=dir*(last.close-last.open)/atr;
  const range=last.high-last.low,pressure=range>0?(side==='buy'?(last.close-last.low)/range:(last.high-last.close)/range):.5;
  const prev=tail.slice(-13,-1);
  const broke=side==='buy'?last.close>Math.max(...prev.map(b=>b.high)):last.close<Math.min(...prev.map(b=>b.low));
  const hour=new Date(last.t).getUTCHours(),session=hour<7?'ásia':hour<13?'europa':hour<21?'eua':'fechamento';
  const regime=efficiency>=.34&&Math.abs(gap)>.19?'tendência':atrRatio>1.65?'volatilidade':'lateral';
  const notes=[];let technical=0;
  if(dir*gap>.23){technical+=1;notes.push('EMAs 9/21 alinhadas')}else if(dir*gap<-.23){technical-=1;notes.push('EMAs 9/21 contrárias')}
  if(efficiency>.33&&dir*recent>0){technical+=1;notes.push('movimento direcional eficiente')}else if(efficiency<.14){technical-=1;notes.push('movimento sem eficiência')}
  if(body>.26&&pressure>.69){technical+=1;notes.push('candle com fechamento firme')}else if(body<-.24||pressure<.29){technical-=1;notes.push('rejeição na direção do sinal')}
  if(atrRatio>1.85||atrRatio<.5){technical-=1;notes.push('volatilidade fora da faixa usual')}
  else if(broke&&atrRatio>=.78&&atrRatio<=1.6){technical+=1;notes.push('rompimento com volatilidade controlada')}
  return {ready:true,technical:clamp(technical,-3,3),regime,session,rsi:rsi(tail),atr,efficiency,atrRatio,emaGapAtr:gap,pressure,breakout:broke,notes};
 }
 function settle(rows,bars,tf){
  const ms=TF[tf];let modified=false;
  if(!ms||!Array.isArray(bars)||bars.length<2)return false;
  for(const r of rows){
   if(r.status!=='pending')continue;
   const idx=bars.findIndex(b=>b.t===r.t);
   if(idx<0){if(bars[0].t>r.t){r.status='incomplete';r.reason='Vela original fora do histórico';modified=true}continue}
   let seen=0,previous=r.t;
   for(let i=idx+1;i<bars.length&&seen<HORIZON;i++){
    const b=bars[i];
    if(!valid(b)||b.t!==previous+ms){r.status='incomplete';r.reason='OHLC ausente ou lacuna temporal';modified=true;break}
    // Se o mercado abriu com um gap muito maior que o risco, não pressupor entrada ao preço anterior.
    if(seen===0&&Math.abs(b.open-r.entry)>Math.max(Math.abs(r.entry-r.stop),r.atr||0)){
     r.status='incomplete';r.reason='Gap impediu supor entrada no preço de referência';modified=true;break;
    }
    previous=b.t;seen++;
    const hitStop=r.side==='buy'?b.low<=r.stop:b.high>=r.stop;
    const hitTake=r.side==='buy'?b.high>=r.tp:b.low<=r.tp;
    if(hitStop&&hitTake){r.status='ambiguous';r.reason='TP e stop na mesma vela; sequência desconhecida'}
    else if(hitStop){r.status='loss';r.R=-1}
    else if(hitTake){r.status='win';r.R=clamp(Math.abs((r.tp-r.entry)/(r.entry-r.stop)),0,4)}
    if(r.status!=='pending'){r.closedAtResult=b.t+ms;r.seenBars=seen;modified=true;break}
   }
   if(r.status==='pending'&&seen===HORIZON){r.status='expired';r.closedAtResult=previous+ms;r.seenBars=seen;modified=true}
  }
  return modified;
 }
 function aggregate(rows){
  const n=rows.length,win=rows.filter(r=>r.status==='win').length;
  return {n,wins:win,losses:n-win,rate:n?win/n:null,expectancy:n?mean(rows.map(r=>clamp(r.R,-1,4))):null};
 }
 function calibrate(rows,nowClose,context){
  // Critério temporal: só desfechos observados até o fechamento atual entram na conta.
  const done=rows.filter(r=>(r.status==='win'||r.status==='loss')&&finite(r.closedAtResult)&&r.closedAtResult<=nowClose&&finite(r.R)).sort((a,b)=>a.t-b.t);
  const overall=aggregate(done),cutoff=Math.floor(done.length*.7);
  const splitTime=done[cutoff]?.t||Infinity;
  // Embargo: excluir treino com saída tocando o primeiro período de validação.
  const train=done.slice(0,cutoff).filter(r=>r.closedAtResult<=splitTime);
  const validate=done.slice(cutoff);
  let chosenTrain=train,chosenValidate=validate,scope='geral';
  const contextualTrain=train.filter(r=>r.regime===context.regime);
  const contextualValidate=validate.filter(r=>r.regime===context.regime);
  if(contextualTrain.length>=22&&contextualValidate.length>=10){
   chosenTrain=contextualTrain;chosenValidate=contextualValidate;scope='regime '+context.regime;
  }
  const tr=aggregate(chosenTrain),va=aggregate(chosenValidate);
  const enough=overall.n>=40&&tr.n>=24&&va.n>=12;
  let adjustment=0;
  if(enough&&tr.expectancy>.10&&va.expectancy>.08&&tr.rate>=.46&&va.rate>=.46)
   adjustment=tr.expectancy>.35&&va.expectancy>.25?3:2;
  else if(enough&&tr.expectancy<-.12&&va.expectancy<-.08)
   adjustment=tr.expectancy<-.30&&va.expectancy<-.25?-4:-2;
  return {...overall,train:tr.n,validation:va.n,trainingR:tr.expectancy,validationR:va.expectancy,
   active:enough,adjustment,scope,note:enough?'Treino 70% / validação 30% com embargo; ajuste limitado':'Aprendizado em observação: mínimo 40 desfechos, 24 em treino e 12 em validação'};
 }
 function levels(p){
  const {side,entry,stop,tp}=p;
  return ['buy','sell'].includes(side)&&[entry,stop,tp].every(x=>finite(x)&&x>0)&&
   (side==='buy'?stop<entry&&tp>entry:stop>entry&&tp<entry)&&Math.abs(tp-entry)/Math.abs(entry-stop)<=8;
 }
 function assess(engine,input){
  const p=input||{},asset=String(p.asset||''),tf=String(p.tf||''),bars=p.candles;
  const before=Number(p.baseScore),base=finite(before)?clamp(before,0,100):0;
  const disabled=!ENGINES.includes(engine)||!TF[tf]||!asset||!Array.isArray(bars)||bars.length<2;
  if(disabled)return {score:base,technical:0,learned:0,active:false,reason:'Amostra indisponível'};
  const last=bars.at(-1),closedAt=last.t+TF[tf],f=features(bars,p.side),seenKey=engine+'|'+asset+'|'+tf;
  const live=p.mode==='live'&&!p.providerStale&&bars.slice(-2).every(valid)&&
   Number.isFinite(closedAt)&&closedAt<=Date.now()+1500&&
   Date.now()-closedAt<=TF[tf]+90000;
  const rows=rowsOf(engine,asset,tf);
  const updated=live?settle(rows,bars,tf):false;
  const stats=calibrate(rows,closedAt,f);
  const technical=live&&f.ready?f.technical:0,learned=live&&stats.active?stats.adjustment:0;
  const score=clamp(Math.round(base+technical+learned),0,100);
  let captured=false;
  if(live&&f.ready){
   const previous=armed.get(seenKey);
   if(previous===undefined)armed.set(seenKey,closedAt);
   else if(closedAt>previous){
    armed.set(seenKey,closedAt);
    // Nunca replica um mesmo fechamento, nem cria janelas de treino sobrepostas.
    const otherOpen=rows.some(r=>r.status==='pending');
    const overlap=rows.some(r=>r.t>=last.t-HORIZON*TF[tf]&&r.t<=last.t);
    if(score>THRESHOLD&&levels(p)&&!otherOpen&&!overlap){
     const record={id:seenKey+'|'+last.t,engine,asset,tf,t:last.t,closedAt,
      capturedAt:Date.now(),side:p.side,score,baseScore:base,technical,learned,
      entry:p.entry,stop:p.stop,tp:p.tp,atr:f.atr,regime:f.regime,session:f.session,
      efficiency:f.efficiency,atrRatio:f.atrRatio,source:'OHLC prospectivo',
      status:'pending',seenBars:0};
     if(!rows.some(r=>r.id===record.id)){rows.unshift(record);captured=true}
    }
   }
  }
  if(updated||captured)save(engine,asset,tf,rows);
  const result={score,baseScore:base,technical,learned,active:live,tracked:captured,
   sample:stats.n,wins:stats.wins,losses:stats.losses,hitRate:stats.rate,
   expectancyR:stats.expectancy,train:stats.train,validation:stats.validation,
   adjustmentActive:stats.active,scope:stats.scope,feature:f,
   message:stats.note,threshold:THRESHOLD,localOnly:true};
  lastModels.set(seenKey,result);renderSoon();
  return result;
 }
 let renderQueued=false;
 function renderSoon(){
  if(!root.document||renderQueued)return;
  renderQueued=true;
  if(root.requestAnimationFrame)root.requestAnimationFrame(()=>{renderQueued=false;render()});
  else{renderQueued=false;render()}
 }
 function render(){
  const d=root.document,host=d?.querySelector('.shell');
  if(!host)return;
  let panel=d.getElementById('stormLearning108');
  if(!panel){panel=d.createElement('section');panel.id='stormLearning108';panel.className='panel storm-learning-v108';
   panel.style.cssText='margin:15px 0;padding:15px 17px;background:linear-gradient(135deg,#102132,#122536);border:1px solid #466277;border-radius:14px;color:#e2eaf4';
   panel.innerHTML='<div class="panel-title"><h2>◈ Aprendizado dos 3 motores · v10.8</h2></div><p style="font-size:11px;color:#afc1d4">Somente sinais prospectivos com confluência &gt;78/100. Fechamentos TP/stop verificados por OHLC; score não é probabilidade de lucro.</p><div id="stormLearning108Body"></div>';
   host.append(panel)}
  const body=d.getElementById('stormLearning108Body');if(!body)return;
  const asset=d.getElementById('assetSelect')?.value||'XAUUSD',tf=d.querySelector('.tf-btn.active')?.dataset.tf||'M5';
  const data=ENGINES.map(engine=>{
   const selectedEngine=engine==='indices'?(asset==='NASDAQ'||asset==='SP500'):engine==='classic'?(asset!=='NASDAQ'&&asset!=='SP500'):true;
   const current=lastModels.get(engine+'|'+asset+'|'+tf);
   const storage=rowsOf(engine,asset,tf),wins=storage.filter(r=>r.status==='win').length,losses=storage.filter(r=>r.status==='loss').length;
   const all=wins+losses,pending=storage.filter(r=>r.status==='pending').length;
   const name={classic:'Clássico',indices:'Índices',turbo:'Turbo'}[engine];
   const learning=current&&selectedEngine?' · '+(current.learned>=0?'+':'')+current.learned+' pontos aprendidos':'';
   const feature=current?.feature?.ready&&selectedEngine
    ?' · ATR '+current.feature.atr.toPrecision(3)+' · RSI '+current.feature.rsi.toFixed(0)+' · eficiência '+Math.round(current.feature.efficiency*100)+'%':'';
   return '<div style="padding:8px 0;border-bottom:1px solid #3a4e6070;font-size:12px"><strong>'+name+'</strong> · '+all+' encerrados ('+wins+' acertos, '+losses+' perdas), '+pending+' pendentes'+learning+
     '<div style="color:#adc1d2;font-size:11px">Confiabilidade da amostra: '+(all>=40?'em validação temporal':'insuficiente · faltam '+Math.max(0,40-all))+
     ' · sem classificação para TP/SL na mesma vela'+feature+'</div></div>';
  });
  body.innerHTML=data.join('')+'<p style="color:#98aec6;font-size:10px;margin:10px 0 0">Aprende apenas com a página aberta e OHLC público; histórico local deste navegador. Não faz operações reais ou garantia de assertividade.</p>';
 }
 if(root.document){
  root.document.addEventListener('change',renderSoon);
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',renderSoon,{once:true});else renderSoon();
 }
 return Object.freeze({version:'10.8',THRESHOLD,features,settle,calibrate,assess,rowsOf,render});
});