'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const core=require('../engine/v10_dual_core.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');

assert.equal(core.VERSION,'10.2-dual-engine');
assert.equal(typeof core.signalAudit,'function');
const period=300000;
const oscillating=Array.from({length:95},(_,i)=>{
 const p=100+1.45*Math.sin(i*Math.PI/5);
 return {t:1700000000000+i*period,open:p,high:p+.5,low:p-.5,close:p+.04};
});
const buy=core.signalAudit({bars:oscillating,side:'buy',atr:1,entry:100,stop:98,tp1:106});
const sell=core.signalAudit({bars:oscillating,side:'sell',atr:1,entry:100,stop:102,tp1:94});
assert(buy.ready&&sell.ready,'Auditoria deve aceitar níveis coerentes');
assert(buy.obstacle&&sell.obstacle,'Detecta topos e fundos recorrentes entre entrada e TP1');
assert(buy.hardBlocks.length>0&&sell.hardBlocks.length>0,'Bloqueia primeira barreira próxima em ambas as direções');
assert(buy.obstacle.fraction>0&&buy.obstacle.fraction<.43,'Barreira altista antes de 43% da rota');
assert(sell.obstacle.fraction>0&&sell.obstacle.fraction<.43,'Barreira baixista antes de 43% da rota');
const trending=Array.from({length:90},(_,i)=>{
 const p=100+i*.95;
 return {t:1700000000000+i*period,open:p-.2,high:p+.55,low:p-.6,close:p};
});
const entry=trending.at(-1).close;
const stretch=core.signalAudit({bars:trending,side:'buy',atr:1,entry,stop:entry-2,tp1:entry+6});
assert(stretch.ready&&stretch.stretched&&stretch.ema21DistanceAtr>3&&stretch.impulseAtr>2.5);
assert(stretch.hardBlocks.some(x=>x.includes('EMA21')),'Entrada esticada não pode passar despercebida');
const insufficient=core.signalAudit({bars:oscillating.slice(0,20),side:'buy',atr:1,entry:100,stop:98,tp1:106});
assert(!insufficient.ready&&insufficient.hardBlocks.length===0,'Histórico insuficiente não fabrica bloqueio');
const components=[
 {name:'Estrutura e price action',earned:23,max:23,note:'forte'},
 {name:'Médias e momentum',earned:13,max:13,note:'forte'},
 {name:'Liquidez e armadilhas',earned:15,max:15,note:'limpo'},
 {name:'Order Block e FVG',earned:15,max:15,note:'zona'},
 {name:'Fibonacci e padrões',earned:9,max:9,note:'fib'},
 {name:'Confluência M1–H1',earned:14,max:15,note:'mtf'}
];
const initial=JSON.stringify(components);
const review=core.turboReview({bars:oscillating,tf:'M5',side:'buy',atr:1,entry:100,stop:98,tp1:106,components,regime:{kind:'range'}});
assert(review.audit.ready&&review.audit.hardBlocks.length>0,'O Turbo consome a auditoria');
assert(review.scoreDelta<0,'A auditoria penaliza score de estrutura quando há obstáculo');
assert.equal(JSON.stringify(components),initial,'As componentes originais não são mutadas');
const before=core.signalAudit({bars:oscillating.slice(0,85),side:'buy',atr:1,entry:100,stop:98,tp1:106});
const changed=oscillating.map(x=>({...x}));
for(let i=85;i<changed.length;i++){changed[i].high+=500;changed[i].low-=500;changed[i].close+=150}
assert.deepEqual(core.signalAudit({bars:changed.slice(0,85),side:'buy',atr:1,entry:100,stop:98,tp1:106}),before,'Futuro não altera sinal fechado');
assert(html.includes('entry:plan.entry,stop:plan.stop,tp1:plan.targets?.[0]'));
assert(html.includes('if(evolution?.audit?.hardBlocks?.length)brakes.push(...evolution.audit.hardBlocks)'));
assert(html.includes('AUDITORIA v10.2'));
assert(html.includes('turboScore>COPY_TURBO_THRESHOLD_EXCLUSIVE'),'Copy >83 inalterado');
assert(html.includes('goldFourOK&&quality?.fresh'),'Filtro XAUUSD mantido');
assert(!html.includes('StormCodex_LocalBridge'),'MT5 permanece fora');
assert(html.includes(fs.readFileSync(path.join(__dirname,'../engine/v10_dual_core.js'),'utf8')),'Código fonte embutido precisa estar sincronizado');
console.log('PASS v10.2: sinais OHLC causais, barreira estrutural, entrada tardia, painel, compatibilidade Clássico/Copy/Ouro.');
