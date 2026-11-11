/* Storm Códex IA — Precision Adaptive 10.0 (11/11/2026)
 * Camada causal de verificação de regime, risco e calibração. Não usa dados futuros
 * para criar sinais; indicadores/contagens não representam ordens executáveis.
 * É independente do Clássico e do Turbo e não altera o limiar do Copy (>83).
 */
(function(root){'use strict';
const FRAMES={M1:60000,M5:300000,M15:900000,H1:3600000};
const n=x=>typeof x==='number'&&Number.isFinite(x);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const avg=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:0;
const finiteBar=b=>b&&[b.t,b.open,b.high,b.low,b.close].every(n)&&b.open>0&&b.low>0&&b.high>=Math.max(b.open,b.close)&&b.low<=Math.min(b.open,b.close);
function atr(bars,period=14){if(!Array.isArray(bars)||bars.length<period+2)return null;
 const v=[];for(let i=bars.length-period;i<bars.length;i++){const b=bars[i],p=bars[i-1];if(!finiteBar(b)||!finiteBar(p))return null;
 v.push(Math.max(b.high-b.low,Math.abs(b.high-p.close),Math.abs(b.low-p.close)));}return avg(v);}
function audit(c,tf,atClose){const ms=FRAMES[tf],issues=[];
 if(!ms)issues.push('Período desconhecido');
 if(!Array.isArray(c)||c.length<45)issues.push('Menos de 45 velas para validar estrutura');
 else {const recent=c.slice(-5);if(!recent.every(finiteBar))issues.push('OHLC inválido');
 for(let i=1;i<recent.length;i++)if(recent[i].t-recent[i-1].t!==ms){issues.push('Lacuna nos últimos cinco candles');break;}
 if(n(atClose)&&recent.at(-1).t+ms!==atClose)issues.push('Fechamento e série não coincidem');}
 return {valid:issues.length===0,issues};}
function classify(c){const unknown={kind:'unknown',label:'Indeterminado',efficiency:null,volRatio:null,atr:null,shock:false,side:null};
 if(!Array.isArray(c)||c.length<45||!c.slice(-40).every(finiteBar))return unknown;
 const a=atr(c),old=atr(c.slice(0,-14)),tail=c.slice(-22),first=tail[0],last=tail.at(-1);
 if(!n(a)||a<=0)return unknown;
 const path=tail.slice(1).reduce((s,b,i)=>s+Math.abs(b.close-tail[i].close),0);
 const move=last.close-first.close,eff=clamp(Math.abs(move)/(path||a),0,1);
 const ratio=old>0?a/old:1,span=(last.high-last.low)/a;
 const shock=span>=2.7||ratio>=2.1,lowVol=ratio<=.56;
 const hi=Math.max(...c.slice(-17,-1).map(x=>x.high)),lo=Math.min(...c.slice(-17,-1).map(x=>x.low));
 const breakout=last.close>hi+.06*a||last.close<lo-.06*a;
 const side=move>=0?'buy':'sell';
 const kind=shock?'shock':breakout?'breakout':eff>=.39&&Math.abs(move)>=1.2*a?'trend':eff<=.24?'range':lowVol?'compression':'transition';
 const labels={shock:'Choque de volatilidade',breakout:'Rompimento confirmado',trend:'Tendência',range:'Lateralização',compression:'Compressão',transition:'Transição'};
 return {kind,label:labels[kind],efficiency:eff,volRatio:ratio,atr:a,shock,side,span,lowVol};}
function trigger(c,side,reg){const result={confirmed:false,kind:'none',against:false,reason:'Sem gatilho local confirmado'};
 if(c.length<20||!['buy','sell'].includes(side)||!n(reg.atr))return result;
 const a=reg.atr,last=c.at(-1),prev=c.at(-2),dir=side==='buy'?1:-1,range=Math.max(1e-9,last.high-last.low);
 const body=dir*(last.close-last.open),closePower=side==='buy'?(last.close-last.low)/range:(last.high-last.close)/range;
 const past=c.slice(-15,-2),top=Math.max(...past.map(x=>x.high)),bottom=Math.min(...past.map(x=>x.low));
 const level=side==='buy'?top:bottom,oldSide=side==='buy'?prev.high>=top:prev.low<=bottom;
 const breakNow=dir*(last.close-level)>a*.06&&body>a*.23&&closePower>=.65;
 const retest=oldSide&&(side==='buy'?last.low<=level+a*.25&&last.close>level+a*.04:last.high>=level-a*.25&&last.close<level-a*.04)&&body>a*.17&&closePower>=.61;
 const reclaim=side==='buy'?prev.close<prev.open&&last.close>prev.high+a*.05:prev.close>prev.open&&last.close<prev.low-a*.05;
 const continuation=dir*(prev.close-prev.open)>a*.16&&body>a*.23&&closePower>=.68&&dir*(last.close-prev.close)>a*.14&&reg.kind==='trend';
 const upper=(last.high-Math.max(last.open,last.close))/range,lower=(Math.min(last.open,last.close)-last.low)/range;
 const oppositeTrap=side==='buy'?(last.high>top+.07*a&&last.close<top&&upper>.3):(last.low<bottom-.07*a&&last.close>bottom&&lower>.3);
 const confirmed=!oppositeTrap&&(breakNow||retest||reclaim||continuation);
 return {confirmed,against:oppositeTrap,kind:breakNow?'breakout':retest?'retest':reclaim?'reclaim':continuation?'continuation':'none',
 reason:oppositeTrap?'Varredura contrária com rejeição':confirmed?'Gatilho confirmado em vela fechada':'Aguardar rompimento, reteste ou continuidade confirmada',
 closePower,bodyATR:body/a};}
function session(atClose){if(!n(atClose))return 'Sem horário';const hr=new Date(atClose).getUTCHours();return hr>=12&&hr<21?'Nova York / sobreposição':hr>=7&&hr<16?'Londres':hr<9?'Ásia':'Transição de sessão';}
function records(history,{engine,asset,tf,side,atClose,setup}){return (Array.isArray(history)?history:[]).filter(r=>{
 if(r.asset!==asset||r.tf!==tf||r.side!==side||!n(r.closedAt)||r.closedAt>=atClose)return false;
 if(engine==='classic'&&(r.origin!=='observed_precision'||r.mode!=='live'))return false;
 if(engine==='turbo'&&(r.origin!=='observed_turbo_selective'||r.mode!=='live'))return false;
 const end=engine==='classic'?r.resolvedAtCandle:r.resolvedAt;
 if(!n(end)||end>=atClose)return false;
 if(engine==='classic'&&!['win','loss'].includes(r.status))return false;
 if(engine==='turbo'&&!['stop','tp1','tp2','tp3'].includes(r.status))return false;
 if(setup&&r.setup!==setup&&r.strategy!==setup)return false;
 return true;
 }).sort((a,b)=>a.closedAt-b.closedAt);}
function rate(rows){const w=rows.filter(r=>r.status==='win'||/^tp[123]$/.test(r.status)).length;return {wins:w,n:rows.length,rate:rows.length?w/rows.length:null};}
function wilson(w,n,z=1.96){if(!n)return null;const p=w/n,den=1+z*z/n,ctr=(p+z*z/(2*n))/den,half=z*Math.sqrt((p*(1-p)+z*z/(4*n))/n)/den;return {rate:p,low:clamp(ctr-half,0,1),high:clamp(ctr+half,0,1)};}
function calibrate(rows){const n=rows.length,w=rate(rows).wins;
 if(n<40)return {available:false,n,wins:w,reason:'São necessários pelo menos 40 desfechos prospectivos comparáveis'};
 const c=wilson(w,n);return {available:true,n,wins:w,...c,source:'operações prospectivas registradas no navegador, não performance real da corretora'};}
function validateChronological(rows){const n=rows.length;
 if(n<60)return {available:false,n,reason:'Aguardando 60 desfechos para validação cronológica'};
 const cut=Math.floor(n*.7),train=rows.slice(0,cut),test=rows.slice(cut);
 const x=rate(train),y=rate(test);const variation=Math.abs(x.rate-y.rate);
 // Nenhuma bonificação baseada no conjunto usado para validação.
 return {available:true,n,train:x,test:y,stable:variation<=.16,variation,
  warning:'Divisão temporal diagnóstica; mesma base não é teste prospectivo independente de nova versão'};}
function evidence(mtf,side){if(!Array.isArray(mtf))return {available:0,againstWeight:0,alignedWeight:0};
 const w={M1:.45,M5:.85,M15:1.25,H1:1.6};let yes=0,no=0,count=0;
 for(const x of mtf){if(x?.fresh===false||!['buy','sell'].includes(x?.side)||!w[x?.tf])continue;
 const weight=w[x.tf];count++;if(x.side===side)yes+=weight;else no+=weight;}
 return {available:count,againstWeight:no,alignedWeight:yes};}
function evaluate(o={}){const {engine='classic',asset='',tf='M5',side=null,mode='live',macro=null,mtf=[],score=null,setup='',rr=null}=o;
 const candles=Array.isArray(o.candles)?o.candles:[],bar=candles.at(-1),atClose=o.atClose??(bar?.t+FRAMES[tf]);
 const check=audit(candles,tf,atClose),reg=classify(candles),entry=trigger(candles,side,reg),sync=evidence(mtf,side);
 const rows=records(o.history,{engine,asset,tf,side,atClose,setup}),fallback=rows.length<40?records(o.history,{engine,asset,tf,side,atClose}):rows;
 const calibration=calibrate(fallback),validation=validateChronological(rows),brakes=[];
 if(!check.valid)brakes.push(...check.issues);
 if(reg.kind==='shock')brakes.push('Vela/volatilidade em choque: aguardar normalização');
 if(reg.kind==='compression'&&engine==='turbo')brakes.push('Compressão: romper a faixa antes de sinalizar');
 if(reg.kind==='range'&&engine==='turbo'&&entry.kind==='continuation')brakes.push('Continuação insuficiente em lateralização');
 if(entry.against)brakes.push('Armadilha contrária ao movimento proposto');
 // O Clássico reconhece outros padrões locais (varredura, engolfo, rejeição);
 // seu gatilho próprio já os valida. O Turbo só recebe veto extra em rompimentos.
 if(engine==='turbo'&&reg.kind==='breakout'&&!entry.confirmed)brakes.push('Rompimento sem confirmação de fechamento/reteste');
 if(sync.available>=2&&sync.againstWeight>sync.alignedWeight*1.5)brakes.push('Conflito relevante com outros períodos recentes');
 if(n(rr)&&rr<1.2)brakes.push('Risco/retorno líquido abaixo de 1,20:1');
 if(macro?.danger===true)brakes.push('Risco macroeconômico confirmado pelo módulo existente');
 if(engine==='turbo'&&macro?.unverified===true)brakes.push('Calendário/notícias sem verificação suficiente');
 if(calibration.available&&validation.available&&validation.train.rate<.39&&validation.test.rate<.39){
   brakes.push('Setup com desempenho prospectivo historicamente fraco em dois intervalos; exige revisão');
 }
 const unique=[...new Set(brakes)];
 return {version:'10.0',engine,ready:unique.length===0,brakes:unique,regime:reg,trigger:entry,session:session(atClose),
  score: n(score)?score:null,scoreType:'Índice de confluência técnica; não é probabilidade',
  mtf:sync,calibration,validation,sample:rows.length,atClose,asset,tf,side};
}
/* Walk-forward sem recalibrar na validação; as avaliações recebem apenas prefixos históricos.
 * Entrada na ABERTURA da vela seguinte; choque de TP+SL na mesma vela conta como loss.
 * Índices com saída além do bloco de validação não entram nas métricas.
 */
function walkForward(candles,evaluateAt,{tf='M5',spread=0,slippage=0,commissionR=0,horizon=6}={}){
 if(!Array.isArray(candles)||candles.length<180||typeof evaluateAt!=='function')return {available:false,reason:'Exige ao menos 180 velas e um avaliador causal'};
 const ms=FRAMES[tf];if(!ms)return {available:false,reason:'Timeframe inválido'};
 const split=Math.floor(candles.length*.60),start=Math.max(50,split+Math.max(1,horizon)),last=candles.length-1-horizon,results=[];
 for(let i=start;i<=last;i++){
  if(!candles.slice(i-2,i+horizon+1).every(finiteBar))continue;
  const sig=evaluateAt(candles.slice(0,i+1),i);
  if(!sig||!['buy','sell'].includes(sig.side)||!(sig.stopDist>0&&sig.targetDist>0))continue;
  const side=sig.side==='buy'?1:-1,next=candles[i+1],entry=next.open+side*(spread/2+slippage);
  const sl=entry-side*sig.stopDist,tp=entry+side*sig.targetDist;
  let outcome='expired',R=0,valid=true;
  for(let j=i+1;j<=i+horizon;j++){
   if(candles[j].t-candles[j-1].t!==ms){valid=false;break}
   const bar=candles[j],hitSL=side===1?bar.low<=sl:bar.high>=sl,hitTP=side===1?bar.high>=tp:bar.low<=tp;
   if(hitSL){outcome='loss';R=-1;break}
   if(hitTP){outcome='win';R=sig.targetDist/sig.stopDist;break}
  }
  if(!valid)continue;
  if(outcome==='expired')R=side*(candles[i+horizon].close-entry)/sig.stopDist;
  results.push({at:candles[i].t,side:sig.side,outcome,R:R-Math.max(0,commissionR),score:sig.score});
  i+=horizon-1; // Evita resultados com janelas de saída sobrepostas.
 }
 const count=results.length,wins=results.filter(x=>x.outcome==='win').length,losses=results.filter(x=>x.outcome==='loss').length;
 let curve=0,peak=0,dd=0,pos=0,neg=0;
 for(const x of results){curve+=x.R;peak=Math.max(peak,curve);dd=Math.max(dd,peak-curve);if(x.R>0)pos+=x.R;else neg-=x.R;}
 return {available:count>=20,n:count,wins,losses,expired:count-wins-losses,winRate:count?wins/count:null,
  meanR:count?curve/count:null,totalR:curve,maxDrawdownR:dd,profitFactor:neg>0?pos/neg:null,
  validationStart:candles[start]?.t,calibrationEnd:candles[split-1]?.t,results,reason:count<20?'Menos de 20 operações no segmento de teste':null,
  note:'Walk-forward com regra congelada; dados simulados com custos estimados, sem execução real'};
}
function renderPanel(engine,data,host){if(!host||!root.document||!data)return;
 let panel=host.querySelector('.storm-adaptive-panel');
 if(!panel){panel=root.document.createElement('section');panel.className='storm-adaptive-panel';panel.style.cssText='margin-top:14px;padding:13px;border-radius:12px;background:rgba(16,27,44,.7);border:1px solid rgba(187,209,238,.2);font-size:12px;line-height:1.6';host.append(panel);}
 const c=data.calibration,v=data.validation;
 const lines=[
 'PRECISION ADAPTIVE 10.0 · '+(engine==='classic'?'CLÁSSICO':'TURBO'),
 'Regime: '+data.regime.label+' · sessão: '+data.session,
 'Checagem adicional: '+(data.ready?'SEM BLOQUEIOS ADICIONAIS':'AGUARDAR · '+data.brakes.join('; ')),
 'Gatilho causal: '+data.trigger.reason,
 c.available?'Acerto observado em amostra comparável: '+(c.rate*100).toFixed(1)+'% · IC95% '+(c.low*100).toFixed(1)+'–'+(c.high*100).toFixed(1)+'% · n='+c.n:
  'Taxa de acerto: AMOSTRA INSUFICIENTE (n='+c.n+', mínimo 40)',
 v.available?'Validação temporal 70/30: '+v.train.n+' treino, '+v.test.n+' validação · '+(v.stable?'variação moderada':'variação elevada'):
  'Validação temporal: aguardando '+Math.max(0,60-v.n)+' casos adicionais',
 'O score /100 é heurístico; histórico simulado não comprova lucro futuro.'];
 panel.replaceChildren();
 lines.forEach((s,i)=>{const el=root.document.createElement(i===0?'strong':'div');el.textContent=s;
  if(i===0)el.style.color='#e2c477';panel.append(el);});
}
root.StormAdaptive=Object.freeze({version:'10.0',atr,audit,classify,trigger,session,records,wilson,calibrate,validateChronological,evidence,evaluate,walkForward,renderPanel});
})(typeof window!=='undefined'?window:globalThis);
