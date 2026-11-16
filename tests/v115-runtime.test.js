'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createRuntime}=require('../storm-runtime-v115.js');
test('isolated server loader exposes the actual Classic + Turbo engines',()=>{
 const runtime=createRuntime();
 assert.ok(runtime.scriptCount>=20);
 for(const name of ['SGEngine','SGV6Core','SGV72Core','Vortex83Turbo','Vortex91Core'])
   assert.ok(runtime.engines[name],name);
 assert.equal(typeof runtime.engines.SGEngine.evaluateLegacy,'function');
 assert.equal(typeof runtime.engines.Vortex83Turbo.contextForCopy,'function');
 assert.equal(typeof runtime.engines.Vortex91Core.analyze,'function');
 runtime.setNow(Date.parse('2026-11-16T17:00:00Z'));
 assert.equal(runtime.sandbox.Date.now(),Date.parse('2026-11-16T17:00:00Z'));
});

test('actual Classic and Turbo accept deterministic OHLC snapshots without browser network',()=>{
 const run=createRuntime();
 run.setNow(Date.parse('2026-11-16T17:00:00Z'));
 const tf='M5',ms=300000,t0=Date.parse('2026-11-14T12:00:00Z'),bars=[];
 for(let i=0;i<125;i++){
   const open=4000+i*.1,close=open+.11+Math.sin(i/6)*.25;
   bars.push({t:t0+i*ms,open,high:Math.max(open,close)+.34,low:Math.min(open,close)-.33,close,volume:100});
 }
 const w=run.sandbox,e9=w.SGEngine.ema(bars,9),e21=w.SGEngine.ema(bars,21),aa=w.SGEngine.atr(bars);
 const context={asset:'XAUUSD',tf,mode:'live',e9,e21,aa,
  rsi:w.SGV6Core.rsi(bars),adx:w.SGV72Core.adx(bars),
  snapshots:new Map(),spread:0,slippage:0,commission:0,lot:.1,multiplier:100};
 const original=w.SGEngine.evaluateLegacy(bars,bars.length-1,context);
 assert.ok(original&&Number.isFinite(original.score));
 const pctx=w.Vortex83Turbo.contextForCopy({asset:'XAUUSD',tf,snapshots:{},lagging:false,
  state:{mode:'live',candles:bars,analysis:original,closedAt:bars.at(-1).t+ms,
   source:'fixture',providerStale:false,news:[],newsReady:false,calendar:[],calendarAt:0},
  settings:{lot:.1,multiplier:100,spread:0,slippage:0,commission:0}});
 assert.ok(pctx?.plan&&pctx?.data);
 const turbo=w.Vortex91Core.analyze(pctx.data,pctx,[]);
 assert.ok(turbo&&Number.isFinite(turbo.score));
});
