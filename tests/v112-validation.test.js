/* Testes Node.js 18+ sem internet: node --test tests/v112-validation.test.js */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const yahoo=require('../netlify/functions/nasdaq-ohlc.js');
const ndx=require('../storm-nasdaq-v112.js');
const precision=require('../storm-precision-v112.js');
function candles(tf='M5',length=140,bias=.03,amplitude=.28){
 const ms={M1:60000,M5:300000,M15:900000,H1:3600000}[tf],now=Date.now();
 const start=Math.floor(now/ms)*ms-ms*(length+1);let prev=4100;
 return Array.from({length},(_,i)=>{
  const open=prev,close=open+bias+amplitude*Math.sin(i/5);prev=close;
  return {t:start+i*ms,open,close,high:Math.max(open,close)+.24,low:Math.min(open,close)-.24};
 });
}
function yahooResponse(symbol='^NDX',tf='M5',raw=null){
 const bars=raw||candles(tf).map(b=>({...b,open:b.open+24000,high:b.high+24000,low:b.low+24000,close:b.close+24000}));
 return {chart:{result:[{meta:{symbol,instrumentType:'INDEX',exchangeDataDelayedBy:15},
  timestamp:bars.map(b=>b.t/1000),indicators:{quote:[{
   open:bars.map(b=>b.open),high:bars.map(b=>b.high),low:bars.map(b=>b.low),close:bars.map(b=>b.close),
   volume:bars.map(()=>null)}]}}]}};
}
test('Yahoo ^NDX M1/M5/M15/H1: somente fechados e sem autenticação',async()=>{
 for(const tf of ['M1','M5','M15','H1']){
  const value=await yahoo.pull(tf,async()=>({ok:true,json:async()=>yahooResponse('^NDX',tf)}));
  assert.equal(value.feedSymbol,'^NDX');assert.ok(value.candles.length>=60);
  assert.ok(value.candles.every(b=>b.t+({M1:60000,M5:300000,M15:900000,H1:3600000}[tf])<=Date.now()));
  assert.equal(value.feedVerified,true);
 }
});
test('Yahoo não aceita ETF QQQ, futuros NQ nem símbolo Biquote NAS100',async()=>{
 for(const bad of ['QQQ','NQ=F','NAS100']){
  await assert.rejects(yahoo.pull('M5',async()=>({ok:true,json:async()=>yahooResponse(bad)})),/ticker/i);
 }
});
test('Validação de cliente protege identidade ^NDX e período',()=>{
 const ms=300000,rows=candles('M5').map(b=>({t:b.t,open:b.open+24000,high:b.high+24000,
  low:b.low+24000,close:b.close+24000}));
 const data={requestedAsset:'NASDAQ',requestedTf:'M5',feedSymbol:'^NDX',feedVerified:true,candles:rows};
 assert.equal(ndx.validate(data,'M5').feedSymbol,'^NDX');
 assert.throws(()=>ndx.validate({...data,feedSymbol:'NAS100'},'M5'),/ticker/i);
 assert.throws(()=>ndx.validate({...data,requestedTf:'M1'},'M5'),/ticker|período/i);
});
test('XAU Turbo pode avaliar alvo menor que US$4 sem liberar o Clássico',()=>{
 const raw=candles(),last=raw.at(-1);
 const legacy={side:'wait',quality:'EVITAR',price:last.close,oneCandleGate:{accepted:false},
  turboBase:{side:'buy',quality:'MODERADA',score:82}};
 const t=precision.turboGold({tf:'M5',asset:'XAUUSD',state:{mode:'live',providerStale:false,candles:raw}},legacy);
 assert.equal(t.side,'buy');assert.equal(t.ready,true);
 assert.ok(t.targetDist>0&&t.targetDist<4);
 assert.ok(t.netRR>=1.2);assert.equal(t.classicGate,false);
 assert.equal(legacy.side,'wait');
 assert.equal(precision.enhanceClassic(legacy,raw,'M5','XAUUSD').side,'wait');
});
test('XAU Turbo bloqueia fonte atrasada e mantém direção apenas informativa',()=>{
 const raw=candles(),legacy={side:'wait',oneCandleGate:{accepted:false},
  turboBase:{side:'buy',quality:'MODERADA'}};
 const result=precision.turboGold({tf:'M5',state:{mode:'live',providerStale:true,candles:raw}},legacy);
 assert.equal(result.ready,false);assert.ok(result.hardBlocks.some(x=>/atrasad/i.test(x)));
});
