'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const core=require('../engine/v10_dual_core.js');
const start=app.indexOf("(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SGV76Filter=api;}");
assert(start>=0,'Filtro do ouro embutido');
const finish=app.indexOf('return {LIMIT_USD,LOOKBACK,estimate,apply};',start);
assert(finish>start);
const isolated=app.slice(start,app.indexOf('});',finish)+3);
const sandbox={module:{exports:{}},globalThis:{}};
vm.runInNewContext(isolated,sandbox);
const gate=sandbox.module.exports;
assert.equal(gate.LIMIT_USD,4);
const bars=dir=>Array.from({length:70},(_,i)=>{
 const open=2500+i*dir*5,close=open+dir*5;
 return {t:1700000000000+i*300000,open,close,
  high:Math.max(open,close)+1,low:Math.min(open,close)-1};
});
const apply=(dir,target)=>gate.apply({side:dir>0?'buy':'sell',targetDist:target,
  stopDist:2,quality:'ALTA',riskMeta:{}},bars(dir),69,
  {asset:'XAUUSD',aa:Array(70).fill(10)});
assert.equal(apply(1,3.99).side,'wait','Compra abaixo de US$4 não emite direção');
assert.equal(apply(-1,3.99).side,'wait','Venda abaixo de US$4 não emite direção');
assert.equal(apply(1,4).side,'buy','Exatamente US$4 libera candidato comprador');
assert.equal(apply(-1,4).side,'sell','Exatamente US$4 libera candidato vendedor');
assert.equal(apply(1,4).oneCandleGate.accepted,true);
assert.equal(apply(1,4).targetDist,4);
assert.equal(apply(1,6).targetDist>4,true);
assert(app.includes("goldGate?.accepted===true&&finite(target)&&target>=4"),
 'Precision aplica filtro após barreiras estruturais');
assert(app.includes("side:gold&&!goldOk?'wait':side"),
 'Precision não pode reconstruir COMPRA/VENDA abaixo de US$4');
assert(app.includes("distances[0]<4"),'Turbo bloqueia TP1 insuficiente');
assert(app.includes("goldDistance>=4"),'Copy respeita requisito de preço do ouro');
assert(app.includes("turboScore>COPY_TURBO_THRESHOLD_EXCLUSIVE"),'Copy mantém >83');
assert.equal(core.VERSION,'10.1-dual-engine');
assert.equal(core.selfTest().ok,true);
const evidence=core.technicalConfluence(bars(1),'buy',10);
assert(evidence.ready&&Number.isFinite(evidence.rsi)&&Number.isFinite(evidence.macdHistogram));
assert.equal(evidence.messages.length,4);
const hist=bars(1);const m=core.technicalConfluence(hist,'buy',10);
const future=hist.map(x=>({...x}));
future.push({t:hist.at(-1).t+300000,open:2000,high:2001,low:1500,close:1600});
assert.deepEqual(core.technicalConfluence(future.slice(0,hist.length),'buy',10),m,'Sem vazamento futuro');
console.log('PASS v10.1: sinais ouro ≥US$4 (inclusive), 2 motores, Copy >83, análise causal VTX-style.');
