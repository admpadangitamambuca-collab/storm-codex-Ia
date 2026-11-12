/* Storm Códex IA v11.0
 * Aprendizado prospectivo local por motor/ativo/timeframe.
 * V10.8 localStorage records permanecem legíveis e migram sem backfill.
 * Esta memória aprende de OHLC realmente observado, não executa ordens.
 * Score técnico 0–100 não é taxa calibrada nem promessa de acerto.
 */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.StormOutcomeLearning108=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 const TF=Object.freeze({M1:60000,M5:300000,M15:900000,H1:3600000});
 const ENGINES=['classic','indices','turbo'];
 const ASSETS=Object.freeze(['XAUUSD','BTCUSD','BTCUSDT','EURUSD','USDJPY','USDCAD','USDCHF','AUDUSD','NASDAQ','SP500','WIN','WDO']);
 const THRESHOLD=78,HORIZON=6,MAX_ROWS=700,KEY_PREFIX='storm_v108_outcome_';
 const armed=new Map(),lastModels=new Map(),reconcileCursor={next:0,last:0,busy:false,completed:0,error:''};
 let storageError='',renderQueued=false,importMessage='';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const valid=b=>b&&[b.t,b.open,b.high,b.low,b.close].every(finite)
  &&b.open>0&&b.low>0&&b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close);
 const profile=()=>String(root.SGUserHistoryKey||'usuario_local').replace(/[^a-zA-Z0-9_-]/g,'').slice(0,60);
 const key=(engine,asset,tf)=>KEY_PREFIX+profile()+'_'+engine+'_'+asset+'_'+tf;
 function rowValid(r,engine,asset,tf){
  return r&&r.engine===engine&&r.asset===asset&&r.tf===tf
   &&finite(r.t)&&r.t>0&&['pending','win','loss','expired','ambiguous','incomplete'].includes(r.status)
   &&['buy','sell'].includes(r.side)&&finite(r.entry)&&r.entry>0&&finite(r.tp)&&finite(r.stop)
   &&(r.side==='buy'?r.stop<r.entry&&r.tp>r.entry:r.stop>r.entry&&r.tp<r.entry);
 }
 function rowsOf(engine,asset,tf){
  if(!ENGINES.includes(engine)||!TF[tf]||!asset)return [];
  try{
   const raw=JSON.parse(root.localStorage?.getItem(key(engine,asset,tf))||'[]');
   return Array.isArray(raw)?raw.filter(r=>rowValid(r,engine,asset,tf)).slice(0,MAX_ROWS):[];
  }catch(e){return []}
 }
 function save(engine,asset,tf,rows){
  try{
   root.localStorage?.setItem(key(engine,asset,tf),JSON.stringify(rows.slice(0,MAX_ROWS)));
   storageError='';
  }catch(e){storageError='Armazenamento local cheio ou bloqueado: exporte um backup da memória.';}
 }
 const mean=arr=>arr.length?arr.reduce((a,b)=>a+b,0)/arr.length:0;
 function ema(closes,n){
  const k=2/(n+1);let e=closes[0];for(let i=1;i<closes.length;i++)e=k*closes[i]+(1-k)*e;return e;
 }
 function rsi(bars){
  let up=0,down=0;
  for(let i=bars.length-14;i<bars.length;i++){
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

 function settle(rows,bars,tf,contract=null){
  const ms=TF[tf];if(!ms||!Array.isArray(bars)||bars.length<2)return false;
  let modified=false;
  const map=new Map(bars.map((b,i)=>[b.t,i]));
  for(const r of rows){
   if(r.status!=='pending')continue;
   // Não resolver um contrato vencido com preços do novo vencimento.
   if(contract&&r.contract&&r.contract!==contract){
    r.status='incomplete';r.reason='Rolagem '+r.contract+' → '+contract+': desfecho não verificável';modified=true;continue;
   }
   if(contract&&['NASDAQ','WIN','WDO'].includes(r.asset)&&!r.contract){
    r.status='incomplete';r.reason='Registro sem identificação da fonte/contrato; liquidação cruzada bloqueada';modified=true;continue;
   }
   const idx=map.get(r.t);
   if(idx===undefined){
    if(bars[0].t>r.t){r.status='incomplete';r.reason='Vela de origem ausente; nenhum resultado inferido';modified=true}
    continue;
   }
   let count=0,prev=r.t;
   for(let i=idx+1;i<bars.length&&count<HORIZON;i++){
    const b=bars[i];
    if(!valid(b)||b.t!==prev+ms){
     r.status='incomplete';r.reason='Gap de sessão / candle indisponível';modified=true;break;
    }
    if(count===0&&Math.abs(b.open-r.entry)>Math.max(Math.abs(r.entry-r.stop),r.atr||0)){
     r.status='incomplete';r.reason='Gap na abertura sem entrada verificável';modified=true;break;
    }
    prev=b.t;count++;
    const stopHit=r.side==='buy'?b.low<=r.stop:b.high>=r.stop;
    const takeHit=r.side==='buy'?b.high>=r.tp:b.low<=r.tp;
    if(stopHit&&takeHit){r.status='ambiguous';r.reason='Take e stop no mesmo candle: sequência desconhecida';}
    else if(stopHit){r.status='loss';r.R=-1;}
    else if(takeHit){r.status='win';r.R=clamp(Math.abs((r.tp-r.entry)/(r.entry-r.stop)),0,4);}
    if(r.status!=='pending'){r.closedAtResult=b.t+ms;r.seenBars=count;modified=true;break;}
   }
   if(r.status==='pending'&&count===HORIZON){
    r.status='expired';r.closedAtResult=prev+ms;r.seenBars=count;modified=true;
   }
  }
  return modified;
 }
 function aggregate(rows){
  const n=rows.length,wins=rows.filter(r=>r.status==='win').length,losses=n-wins;
  return {n,wins,losses,rate:n?wins/n:null,expectancy:n?mean(rows.map(r=>clamp(r.R,-1,4))):null};
 }
 function decorrelate(rows,tf){
  // Uma amostra independente por janela de saída de 6 velas, no máximo.
  // Resultados sobrepostos permanecem no log, mas não inflam confiança estatística.
  const minGap=(TF[tf]||60000)*HORIZON;
  const ordered=rows.slice().sort((a,b)=>a.t-b.t);
  const chosen=[];let eligible=-Infinity;
  for(const r of ordered){if(r.t>=eligible){chosen.push(r);eligible=r.t+minGap;}}
  return chosen;
 }
 function wilson(wins,n){
  if(!n)return {low:null,high:null};
  const z=1.96,p=wins/n,z2=z*z,d=1+z2/n;
  const center=(p+z2/(2*n))/d;
  const width=z*Math.sqrt(p*(1-p)/n+z2/(4*n*n))/d;
  return {low:clamp(center-width,0,1),high:clamp(center+width,0,1)};
 }
 function weightedR(rows){
  if(!rows.length)return 0;
  // Recência ponderada em ordem cronológica, com prior neutro em 0R (regularização).
  const ageDecay=.97,priorMass=10;
  let sum=0,mass=0;
  rows.forEach((r,i)=>{
   const w=Math.pow(ageDecay,rows.length-1-i);
   sum+=w*clamp(r.R,-1,4);mass+=w;
  });
  return sum/(mass+priorMass);
 }
 function calibrate(rows,nowClose,context){
  const observed=rows.filter(r=>(!context.contract||r.contract===context.contract)&&['win','loss'].includes(r.status)
   &&finite(r.closedAtResult)&&r.closedAtResult<=nowClose&&finite(r.R)&&r.t<nowClose)
   .sort((a,b)=>a.t-b.t);
  const overall=aggregate(observed);
  const tf=String(context.tf||'M5');
  const effective=decorrelate(observed,tf);
  const cutoff=Math.floor(effective.length*.7);
  const split=effective[cutoff]?.t??Infinity;
  const train=effective.slice(0,cutoff).filter(r=>r.closedAtResult<=split);
  const validate=effective.slice(cutoff);
  let tr=train,va=validate,scope='amostra geral';
  for(const group of [
    {name:'regime e direção',test:r=>r.regime===context.regime&&r.side===context.side},
    {name:'regime de mercado',test:r=>r.regime===context.regime}
  ]){
   const t=train.filter(group.test),v=validate.filter(group.test);
   if(t.length>=13&&v.length>=6){tr=t;va=v;scope=group.name;break;}
  }
  const a=aggregate(tr),b=aggregate(va);
  const quality=wilson(b.wins,b.n);
  const enough=effective.length>=20&&a.n>=12&&b.n>=6;
  const trainingR=weightedR(tr),validationR=weightedR(va);
  const recent=aggregate(effective.slice(-Math.min(14,effective.length)));
  const older=aggregate(effective.slice(-Math.min(28,effective.length),-Math.min(14,effective.length)));
  const drift=recent.n>=10&&recent.expectancy<-0.2
    &&(!older.n||recent.expectancy<(older.expectancy??0)-.22);
  let adjustment=0;
  // Bônus somente se TREINO E VALIDAÇÃO cronológicos estiverem positivos.
  if(enough&&trainingR>.09&&validationR>.07&&b.rate>=.46){
   adjustment=effective.length>=65?3:effective.length>=38?2:1;
  }else if(enough&&trainingR<-.07&&validationR<-.06){
   adjustment=effective.length>=65?-4:effective.length>=38?-3:-2;
  }
  if(drift)adjustment=Math.max(-4,adjustment-1);
  return {...overall,train:a.n,validation:b.n,independent:effective.length,
   trainingR,validationR,validationWilson:quality,validationRate:b.rate,
   recentR:recent.expectancy,priorR:older.expectancy,drift,adjustment,
   active:enough,scope,
   note:enough?'Amostra independente, janela temporal 70/30 e regularização de recência':
    'Memória em observação: exige pelo menos 20 janelas independentes (12 treino, 6 validação)'};
 }
 function levels(p){
  const {side,entry,stop,tp}=p;
  return ['buy','sell'].includes(side)&&[entry,stop,tp].every(x=>finite(x)&&x>0)
   &&(side==='buy'?stop<entry&&tp>entry:stop>entry&&tp<entry)
   &&Math.abs(tp-entry)/Math.abs(entry-stop)<=8;
 }
 function assess(engine,input){
  const p=input||{},asset=String(p.asset||''),tf=String(p.tf||''),bars=p.candles;
  const base=finite(Number(p.baseScore))?clamp(Number(p.baseScore),0,100):0;
  if(!ENGINES.includes(engine)||!TF[tf]||!asset||!Array.isArray(bars)||bars.length<2)
   return {score:base,technical:0,learned:0,active:false,reason:'Sem amostra suficiente'};
  const last=bars.at(-1),closedAt=last.t+TF[tf];
  const f=features(bars,p.side),seenKey=engine+'|'+asset+'|'+tf;
  const live=p.mode==='live'&&!p.providerStale&&bars.slice(-2).every(valid)
   &&!root.document?.hidden&&Number.isFinite(closedAt)
   &&closedAt<=Date.now()+1500&&Date.now()-closedAt<=TF[tf]+90000;
  const rows=rowsOf(engine,asset,tf);
  const changed=live?settle(rows,bars,tf,p.contract||null):false;
  const stats=calibrate(rows,closedAt,{...f,tf,side:p.side,contract:p.contract||null});
  const technical=live&&f.ready?f.technical:0;
  const learned=live&&stats.active?stats.adjustment:0;
  const score=clamp(Math.round(base+technical+learned),0,100);
  let tracked=false;
  if(live&&f.ready){
   const previous=armed.get(seenKey);
   if(previous===undefined)armed.set(seenKey,closedAt);
   else if(closedAt>previous){
    armed.set(seenKey,closedAt);
    // Capturar todos os NOVOS sinais >78, inclusive com operações pendentes.
    // Sobreposição é neutralizada em calibrate() pela amostragem independente.
    if(p.trackAllowed!==false&&score>THRESHOLD&&levels(p)){
     const record={id:seenKey+'|'+last.t,engine,asset,tf,contract:p.contract||null,t:last.t,closedAt,
      capturedAt:Date.now(),side:p.side,score,baseScore:base,technical,learned,
      entry:p.entry,stop:p.stop,tp:p.tp,atr:f.atr,regime:f.regime,session:f.session,
      efficiency:f.efficiency,atrRatio:f.atrRatio,source:'OHLC prospectivo',
      status:'pending',seenBars:0};
     if(!rows.some(r=>r.id===record.id)){
      rows.unshift(record);tracked=true;
     }
    }
   }
  }
  if(changed||tracked)save(engine,asset,tf,rows);
  const result={score,baseScore:base,technical,learned,active:live,tracked,
   sample:stats.n,independent:stats.independent,wins:stats.wins,losses:stats.losses,
   hitRate:stats.rate,expectancyR:stats.expectancy,
   train:stats.train,validation:stats.validation,adjustmentActive:stats.active,
   validationWilson:stats.validationWilson,validationRate:stats.validationRate,
   drift:stats.drift,scope:stats.scope,feature:f,message:stats.note,
   threshold:THRESHOLD,localOnly:true};
  lastModels.set(seenKey,result);renderSoon();return result;
 }
 function allEntries(){
  const storage=root.localStorage,entries=[];
  try{
   if(!storage)return entries;
   const prefix=KEY_PREFIX+profile()+'_';
   for(let i=0;i<storage.length;i++){
    const k=storage.key(i);if(!k||!k.startsWith(prefix))continue;
    for(const engine of ENGINES){
     for(const tf of Object.keys(TF)){
      const end='_'+engine+'_',suffix='_'+tf;
      const part=k.slice(prefix.length);
      if(!part.startsWith(engine+'_')||!part.endsWith(suffix))continue;
      const asset=part.slice(engine.length+1,-suffix.length);
      if(asset&&!entries.some(e=>e.engine===engine&&e.asset===asset&&e.tf===tf)){
       const rows=rowsOf(engine,asset,tf);
       if(rows.length)entries.push({engine,asset,tf,rows});
      }
     }
    }
   }
  }catch(e){storageError='Não foi possível consultar o armazenamento local.';}
  return entries;
 }
 function exportBackup(){
  const doc=root.document;if(!doc)return null;
  const payload={format:'storm-codex-outcomes',version:2,
   account:profile(),exportedAt:new Date().toISOString(),entries:allEntries()};
  const json=JSON.stringify(payload);
  const blob=new Blob([json],{type:'application/json'});
  const href=URL.createObjectURL(blob),a=doc.createElement('a');
  a.href=href;a.download='storm-codex-memoria-'+new Date().toISOString().slice(0,10)+'.json';
  doc.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);
  return payload.entries.reduce((n,e)=>n+e.rows.length,0);
 }
 function importObject(payload){
  if(!payload||payload.format!=='storm-codex-outcomes'||![1,2].includes(payload.version)
   ||!Array.isArray(payload.entries))throw Error('Arquivo de memória inválido');
  if(payload.entries.length>250)throw Error('Arquivo contém conjuntos demais');
  let added=0;
  for(const set of payload.entries){
   const {engine,asset,tf}=set;
   if(!ENGINES.includes(engine)||typeof asset!=='string'||!/^[A-Z0-9]{3,16}$/.test(asset)
    ||!TF[tf]||!Array.isArray(set.rows))continue;
   const prev=rowsOf(engine,asset,tf),ids=new Set(prev.map(r=>r.id));
   for(const r of set.rows.slice(0,MAX_ROWS)){
    if(!rowValid(r,engine,asset,tf)||!finite(r.closedAt)||r.closedAt<=r.t||
      !finite(r.capturedAt)||r.capturedAt<r.closedAt||
      !finite(r.score)||r.score<=THRESHOLD||r.score>100||
      ['win','loss'].includes(r.status)&&(!finite(r.R)||!finite(r.closedAtResult)||
      r.closedAtResult<=r.closedAt))continue;
    const id=engine+'|'+asset+'|'+tf+'|'+r.t;
    if(ids.has(id))continue;
    prev.push({...r,id});ids.add(id);added++;
   }
   prev.sort((a,b)=>b.t-a.t);save(engine,asset,tf,prev);
  }
  renderSoon();return added;
 }

 // Reconciliador: acompanha a liquidação de cada sinal REAL já capturado,
 // mesmo quando outra aba ou ativo está selecionado.
 // Não registra sinais retroativos nem reinterpreta ordens inexistentes.
 async function reconcilePending(batchSize=6){
  if(reconcileCursor.busy||root.document?.hidden)return {busy:true};
  const feed=root.SGV78Data;
  if(!feed?.load)return {error:'Feed OHLC indisponível'};
  const open=allEntries().filter(set=>ASSETS.includes(set.asset)&&
   set.rows.some(r=>r.status==='pending'));
  if(!open.length)return {checked:0,pending:0};
  const max=Math.min(8,Math.max(1,Math.floor(Number(batchSize)||6)));
  const groups=Array.from({length:Math.min(max,open.length)},(_,i)=>
   open[(reconcileCursor.next+i)%open.length]);
  reconcileCursor.next=(reconcileCursor.next+groups.length)%open.length;
  reconcileCursor.busy=true;
  let checked=0,resolved=0,errors=[];
  // Uma consulta por ativo/período; resultados separados por motor.
  const unique=[...new Map(groups.map(g=>[g.asset+'|'+g.tf,{asset:g.asset,tf:g.tf}])).values()];
  try{
   await Promise.all(unique.map(async ({asset,tf})=>{
    try{
     const data=asset==='NASDAQ'&&root.StormNasdaqLive113?.load
       ?await root.StormNasdaqLive113.load(tf,null)
       :(asset==='WIN'||asset==='WDO')&&root.StormB3Indices111?.load
       ?await root.StormB3Indices111.load(asset,tf,null)
       :asset==='XAUUSD'&&tf==='H1'&&root.SGV931H1Recovery?.load
       ?await root.SGV931H1Recovery.load(asset,tf,null,feed)
       :await feed.load(asset,tf,null);
     if(data?.mode!=='live'||!Array.isArray(data.candles)||data.candles.length<2)return;
     checked++;
     // Settlement usa somente barras reais fechadas validadas pela fonte.
     for(const engine of ENGINES){
      const rows=rowsOf(engine,asset,tf);
      if(!rows.some(r=>r.status==='pending'))continue;
      const previous=rows.filter(r=>r.status==='pending').length;
      if(settle(rows,data.candles,tf,['NASDAQ','WIN','WDO'].includes(asset)?data.feedSymbol:null)){
       const remaining=rows.filter(r=>r.status==='pending').length;
       resolved+=Math.max(0,previous-remaining);
       save(engine,asset,tf,rows);
      }
     }
    }catch(e){errors.push(asset+'/'+tf+': '+String(e?.message||e).slice(0,100));}
   }));
  }finally{
   reconcileCursor.busy=false;reconcileCursor.last=Date.now();
   reconcileCursor.completed+=resolved;reconcileCursor.error=errors.slice(0,2).join(' | ');
   if(resolved)renderSoon();
  }
  return {checked,resolved,errors,pending:open.length};
 }
 function summaryAll(){
  return ASSETS.map(asset=>{
   const rows=ENGINES.flatMap(engine=>Object.keys(TF).flatMap(tf=>rowsOf(engine,asset,tf)));
   const solved=rows.filter(r=>['win','loss'].includes(r.status));
   const indep=ENGINES.reduce((total,engine)=>
    total+Object.keys(TF).reduce((sum,tf)=>
     sum+decorrelate(rowsOf(engine,asset,tf).filter(r=>['win','loss'].includes(r.status)),tf).length,0),0);
   return {asset,observations:rows.length,completed:solved.length,independent:indep,
     wins:solved.filter(r=>r.status==='win').length,
     losses:solved.filter(r=>r.status==='loss').length,
     pending:rows.filter(r=>r.status==='pending').length};
  });
 }
 function startReconciler(){
  if(!root.document||!root.setInterval||startReconciler.started)return;
  startReconciler.started=true;
  // Backoff implícito: seis conjuntos por ciclo de 95 segundos, sem corrida paralela.
  root.setInterval(()=>{if(!root.document.hidden)reconcilePending().catch(()=>{})},95000);
  root.document.addEventListener('visibilitychange',()=>{
   if(!root.document.hidden)reconcilePending().catch(()=>{});
  });
  // Ao abrir a sessão, recuperar pendências capturadas em dias anteriores.
  root.setTimeout?.(()=>reconcilePending().catch(()=>{}),15000);
 }
 function renderSoon(){
  if(!root.document||renderQueued)return;
  renderQueued=true;
  if(root.requestAnimationFrame)root.requestAnimationFrame(()=>{renderQueued=false;render()});
  else{renderQueued=false;render()}
 }
 function render(){
  const doc=root.document,host=doc?.querySelector('.shell');
  if(!host)return;
  let panel=doc.getElementById('stormLearning108');
  if(!panel){
   panel=doc.createElement('section');panel.id='stormLearning108';
   panel.className='panel storm-learning-v110';
   panel.style.cssText='margin:16px 0;padding:20px;background:linear-gradient(140deg,#122735,#0d1e2b);border:1px solid #396d67;border-radius:17px;color:#e4f4ee';
   panel.innerHTML='<div class="panel-title"><h2>◈ Memória adaptativa · v11.0</h2></div>'+
    '<p class="v7-caption">Resultados prospectivos de sinais com score &gt;78/100, separados por motor, ativo e período. Treino e validação cronológicos, correção por sobreposição e recência. Score técnico não é probabilidade de acerto.</p>'+
    '<div id="stormLearning108Body"></div>'+
    '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:12px">'+
    '<button type="button" class="btn tiny" id="stormMemoryExport">↓ Backup JSON</button>'+
    '<button type="button" class="btn tiny" id="stormMemoryImport">↑ Restaurar backup</button>'+
    '<input type="file" id="stormMemoryFile" accept="application/json,.json" hidden>'+
    '</div><p id="stormMemoryMessage" class="v7-caption" role="status"></p>';
   host.append(panel);
   doc.getElementById('stormMemoryExport')?.addEventListener('click',()=>{
    try{const n=exportBackup();importMessage=n+' observações incluídas no arquivo de backup.';}
    catch(e){importMessage='Falha no backup: '+e.message;}renderSoon();
   });
   doc.getElementById('stormMemoryImport')?.addEventListener('click',()=>doc.getElementById('stormMemoryFile')?.click());
   doc.getElementById('stormMemoryFile')?.addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
     if(file.size>6*1024*1024)throw Error('Arquivo acima de 6 MB');
     const n=importObject(JSON.parse(await file.text()));
     importMessage='Restauração concluída: '+n+' observações novas, sem duplicatas.';
    }catch(err){importMessage='Importação não aplicada: '+err.message;}
    e.target.value='';renderSoon();
   });
  }
  const area=doc.getElementById('stormLearning108Body');if(!area)return;
  const asset=doc.getElementById('assetSelect')?.value||'XAUUSD',tf=doc.querySelector('.tf-btn.active')?.dataset.tf||'M5';
  const lines=ENGINES.map(engine=>{
   const relevant=engine==='indices'?['NASDAQ','SP500','WIN','WDO'].includes(asset):engine==='classic'?!['NASDAQ','SP500','WIN','WDO'].includes(asset):true;
   const current=lastModels.get(engine+'|'+asset+'|'+tf);
   const storage=rowsOf(engine,asset,tf);
   const total=storage.filter(r=>['win','loss'].includes(r.status));
   const wins=total.filter(r=>r.status==='win').length;
   const pending=storage.filter(r=>r.status==='pending').length;
   const effective=decorrelate(total,tf).length;
   const name={classic:'Clássico',indices:'Índices',turbo:'Turbo'}[engine];
   const learned=current&&relevant?(current.learned>=0?'+':'')+current.learned+' pts':'—';
   const recent=current&&relevant?current.message:'Amostra deste motor/ativo/período ainda não avaliada';
   return '<div style="padding:12px 0;border-bottom:1px solid #325a5c;font-size:12px">'+
    '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between;flex-wrap:wrap"><strong>'+name+'</strong>'+
    '<span>Δ aprendizado: <b>'+learned+'</b></span></div>'+
    '<div style="color:#bad8cc;margin-top:6px">'+total.length+' resolvidos ('+wins+' TP / '+(total.length-wins)+' stops) · '+
    pending+' pendentes · '+effective+' janelas independentes</div>'+
    '<div style="color:#8cacaa;font-size:11px;margin-top:4px">'+recent+'</div></div>';
  });
  area.innerHTML=lines.join('');
  // Resumo permanente para todos os ativos, inclusive os que não estão na tela.
  let matrix=doc.getElementById('stormMemoryAllAssets');
  if(!matrix){
   matrix=doc.createElement('details');matrix.id='stormMemoryAllAssets';
   matrix.style.cssText='margin:13px 0 0;border:1px solid #41645f;border-radius:12px;padding:11px;background:#10282a';
   const summary=doc.createElement('summary');summary.textContent='Memória dos 12 ativos · visão geral';summary.style.cssText='cursor:pointer;font-weight:800;color:#bcebd6';
   const table=doc.createElement('div');table.id='stormMemoryAllTable';
   table.style.cssText='display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px;margin-top:12px';
   matrix.append(summary,table);area.after(matrix);
  }
  const table=doc.getElementById('stormMemoryAllTable');
  if(table){
   table.textContent='';
   for(const v of summaryAll()){
    const div=doc.createElement('div');div.style.cssText='border:1px solid #365f52;border-radius:10px;padding:10px;color:#c6e7dc;font-size:11px;background:#12312d';
    const h=doc.createElement('strong');h.textContent=v.asset;
    const info=doc.createElement('div');info.style.cssText='margin-top:5px;color:#9db8ae';
    info.textContent=v.completed+' resolvidos · '+v.pending+' pendentes · '+v.independent+' independentes';
    div.append(h,info);table.append(div);
   }
  }

  const msg=doc.getElementById('stormMemoryMessage');
  if(msg)msg.textContent=(storageError?storageError+' ':'')+importMessage+
   ' Armazenamento local neste navegador; backups podem ser transferidos manualmente. Resultados brutos em R, sem spread e comissão. Reconciliação geral: '+(reconcileCursor.last?new Date(reconcileCursor.last).toLocaleTimeString('pt-BR'):'aguardando')+'. '+reconcileCursor.error;
 }
 if(root.document){
  root.document.addEventListener('change',renderSoon);
  if(root.document.readyState==='loading')
   root.document.addEventListener('DOMContentLoaded',renderSoon,{once:true});
  else renderSoon();
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',startReconciler,{once:true});
  else startReconciler();
 }
 return Object.freeze({version:'11.0',THRESHOLD,HORIZON,ASSETS,
  features,settle,calibrate,decorrelate,assess,rowsOf,importObject,allEntries,summaryAll,reconcilePending,exportBackup,render});
});
