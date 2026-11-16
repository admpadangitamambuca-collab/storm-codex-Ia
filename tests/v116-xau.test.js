'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const xau=require('../storm-xau-health-v116.js');
const monitor=require('../storm-monitor-core-v115.js');
const NOW=Date.parse('2026-11-16T22:44:40Z');
const PRICE={spot_usd_oz:3858.50,xau:{currency:'USD',unit:'oz'},
 stale:false,data_state:{status:'fresh',as_of:new Date(NOW-21000).toISOString()}};
function candles(tf='M5',lastClosed=NOW-120000,quantity=120){
 const ms=xau.FRAME[tf].ms,end=Math.floor(lastClosed/ms)*ms;
 return Array.from({length:quantity},(_,i)=>{
  const t=end-ms*(quantity-i);
  return {openTime:new Date(t).toISOString(),open:3850+i/10,high:3852+i/10,
   low:3849+i/10,close:3851+i/10,isOpen:false};
 }).reverse();
}
test('spot reference fresh with source timestamp is clearly NOT a trading candle',()=>{
 const result=xau.spot(PRICE,NOW);
 assert.equal(result.price,3858.50);
 assert.equal(result.fresh,true);
 assert.equal(result.eligibleForSignals,false);
 assert.equal(result.priceType,'spot_reference_only');
});
test('fake freshness and stale XAUS cached quotes are refused',()=>{
 assert.equal(xau.spot({...PRICE,stale:true},NOW).fresh,false);
 assert.equal(xau.spot({...PRICE,data_state:{status:'stale',as_of:new Date(NOW).toISOString()}},NOW).fresh,false);
 assert.equal(xau.spot({...PRICE,data_state:{status:'fresh',as_of:new Date(NOW-9e5).toISOString()}},NOW).fresh,false);
});
test('Biquote spot XAUUSD rejects other tickers and wrong timeframes',()=>{
 assert.throws(()=>xau.biquote({symbol:'GC=F',interval:'5m',bars:candles()},'M5',NOW),/diferente/);
 assert.throws(()=>xau.biquote({symbol:'XAUUSD',interval:'1m',bars:candles()},'M5',NOW),/timeframe/);
});
test('real closed gold OHLC validated separately from price-only spot',()=>{
 const good=xau.biquote({symbol:'XAUUSD',interval:'5m',bars:candles()},'M5',NOW);
 assert.equal(good.candleCount,120);assert.equal(good.fresh,true);
 assert.equal(good.eligibleForSignals,true);
 const delayed=xau.biquote({symbol:'XAUUSD',interval:'5m',bars:candles('M5',NOW-45*60000)},'M5',NOW);
 assert.equal(delayed.fresh,false);
 assert.equal(delayed.eligibleForSignals,false);
 assert.match(delayed.reason,/atrasad/);
});
test('live 2026 outage: fresh spot + halted Biquote OHLC = SPOT_ONLY with disabled signals',async()=>{
 const fetcher=async url=>{
  if(url.includes('xaus.com'))return {ok:true,json:async()=>PRICE};
  if(url.includes('/ohlc'))return {ok:true,json:async()=>({
   symbol:'XAUUSD',interval:'5m',bars:candles('M5',NOW-45*60000)})};
  return {ok:false,status:404};
 };
 const h=await xau.run({tf:'M5',fetcher,now:NOW});
 assert.equal(h.state,'SPOT_ONLY');
 assert.equal(h.spot.fresh,true);
 assert.equal(h.ohlc.fresh,false);
 assert.equal(h.signalsAllowed,false);
 assert.equal(h.tick.fresh,false);
});
test('one-minute Netlify monitor merges fast M1 observations into 24-pair dashboard',async()=>{
 const map=new Map();
 const store={
  async get(k){return map.get(k)||null},
  async getWithMetadata(k){const v=map.get(k);return v?{data:v,etag:'0'}:null},
  async setJSON(k,v){map.set(k,v);return {modified:true}}
 };
 const response={ok:false,status:503};
 const status=await monitor.runCycle({store,fetcher:async()=>response,now:NOW,
  pairs:[{asset:'XAUUSD',tf:'M1'}],mergeStatus:true});
 assert.equal(status.pairs,24);
 assert.equal(status.processedPairs,1);
 assert.equal(status.failed,1);
 assert.equal(status.results.find(x=>x.asset==='XAUUSD'&&x.tf==='M1').state,'ERROR');
 assert.equal(status.results.find(x=>x.asset==='EURUSD'&&x.tf==='M1').state,'UNINITIALIZED');
 assert.equal((await store.get('status-v115')).results.length,24);
});
test('packaged monitor declares minute M1 sampling and full 5-minute scan',()=>{
 const cron=fs.readFileSync('netlify.toml','utf8');
 const scheduled=fs.readFileSync('netlify/functions/storm-monitor-scheduled.mjs','utf8');
 const index=fs.readFileSync('index.html','utf8');
 assert.match(cron,/schedule = "\* \* \* \* \*"/);
 assert.match(scheduled,/getUTCMinutes\(\)%5===0/);
 assert.match(scheduled,/p\.tf==='M1'/);
 assert.match(index,/storm-xau-live-v116.js/);
 assert.match(index,/Storm Códex IA 11.6/);
});
