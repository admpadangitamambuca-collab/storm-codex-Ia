'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const monitor=require('../storm-monitor-core-v115.js');
const b3live=require('../netlify/functions/b3-live-ohlc.js');
const B3=require('../b3-indices-v111.js'),fs=require('node:fs');
function mockStore(){
 const map=new Map();return {
  async getWithMetadata(k){const v=map.get(k);return v?{data:structuredClone(v.data),etag:String(v.version)}:null;},
  async setJSON(k,v,opts={}){
   const old=map.get(k);
   if(opts.onlyIfNew&&old)return {modified:false};
   if(opts.onlyIfMatch&&(!old||String(old.version)!==opts.onlyIfMatch))return {modified:false};
   const version=(old?.version||0)+1;map.set(k,{version,data:structuredClone(v)});
   return {modified:true,etag:String(version)};
  },
  async get(k){return map.get(k)?.data||null;}
 };
}
function fakeFetcher(getNow){
 return async url=>{
  if(url.includes('/news/market'))return {ok:true,json:async()=>({news:[]})};
  if(url.includes('/calendar/upcoming'))return {ok:true,json:async()=>({events:[]})};
  if(url.includes('/XAUUSD/ohlc')){
   const now=getNow(),ms=300000,last=Math.floor(now/ms)*ms-ms;
   const bars=Array.from({length:120},(_,i)=>{const open=4000+i*.1,close=open+.1;return {
    t:last-(119-i)*ms,open,high:close+.3,low:open-.3,close,volume:60};});
   return {ok:true,json:async()=>({symbol:'XAUUSD',interval:'5m',bars})};
  }
  return {ok:false,status:503};
 };
}
test('scheduled monitor first arms, next observes, persists across runs without retroactive fill',async()=>{
 let now=Date.parse('2026-11-16T17:15:12Z');
 const store=mockStore(),fetcher=fakeFetcher(()=>now);
 const pairs=[{asset:'XAUUSD',tf:'M5'}];
 const first=await monitor.runCycle({store,fetcher,now,pairs});
 assert.equal(first.persisted,1);
 const snapshot=await store.get('research-v115-XAUUSD-M5');
 assert.equal(snapshot.signals.length,0,'initial history must not generate retroactive trades');
 assert.equal(snapshot.latestStatus,'RECENT');
 now+=300000;
 const second=await monitor.runCycle({store,fetcher,now,pairs});
 assert.equal(second.persisted,1);
 const after=await store.get('research-v115-XAUUSD-M5');
 assert.ok(after.lastClosedAt>snapshot.lastClosedAt);
 assert.ok(after.lastScore!==null);
 assert.ok(Array.isArray(after.signals));
 const third=await monitor.runCycle({store,fetcher,now,pairs});
 assert.equal(third.persisted,1);
 const duplicate=await store.get('research-v115-XAUUSD-M5');
 assert.equal(duplicate.signals.length,after.signals.length,'same candle must not generate new signals');
});
test('failed data provider is recorded and never turns into successful signal',async()=>{
 const pairs=[{asset:'XAUUSD',tf:'M5'}],store=mockStore();
 const failed=await monitor.runCycle({store,pairs,fetcher:async()=>({ok:false,status:503})});
 assert.equal(failed.failed,1);
 const state=await store.get('research-v115-XAUUSD-M5');
 assert.equal(state.signals.length,0);
 assert.equal(state.latestStatus,'ERROR');
});
test('no B3 signal after rollovers is settled with next contract',async()=>{
 const state={...({version:'11.5',asset:'WIN',tf:'M1',lastClosedAt:Date.parse('2026-11-12T14:00:00Z'),
   feedSymbol:'WINZ26',signals:[{id:'x',engine:'indices',result:'pending',t:Date.parse('2026-11-12T13:00:00Z')}]})};
 const next=Date.parse('2026-12-17T13:04:15Z'),ms=60000,last=Math.floor(next/ms)*ms-ms;
 const bars=Array.from({length:120},(_,i)=>({t:last-(119-i)*ms,open:180000,high:180010,low:179990,close:180000,volume:10}));
 const out=await monitor.advance({asset:'WIN',tf:'M1'},{asset:'WIN',tf:'M1',source:'test',
  feedSymbol:'WING27',bars,closedAt:last+ms,fetchedAt:next,fresh:true},state,
  {sandbox:{},setNow:()=>{}},{},{});
 assert.equal(out.signals[0].result,'incomplete');
 assert.equal(out.signals[0].reason.includes('Rolagem'),true);
});
test('licensed live endpoint fails closed without exact ticker, no delayed data relabeling',()=>{
 const now=Date.parse('2026-11-16T16:30:20Z'),tf='M1',ms=60000;
 const contract=B3.contractFor('WIN',now),last=Math.floor(now/ms)*ms-ms;
 const bars=Array.from({length:65},(_,i)=>({t:last-(64-i)*ms,
  open:160000,high:160010,low:159990,close:160000}));
 const source={symbol:contract.symbol,interval:'1m',exchange:'B3',realtime:true,delayMinutes:0,
  quotedAt:now,bars};
 assert.equal(b3live.parseProvider(source,'WIN',tf,contract,now).feedVerified,true);
 assert.throws(()=>b3live.parseProvider({...source,symbol:'WDOZ26'},'WIN',tf,contract,now),/Ticker/);
 assert.throws(()=>b3live.parseProvider({...source,realtime:false},'WIN',tf,contract,now),/atraso|tempo real/);
 assert.throws(()=>b3live.parseProvider({...source,delayMinutes:15},'WIN',tf,contract,now),/atraso|tempo real/);
 assert.throws(()=>b3live.parseProvider({...source,quotedAt:0},'WIN',tf,contract,now),/timestamp/);
});
test('Netlify schedule is declared, status is read-only',()=>{
 const config=fs.readFileSync('netlify.toml','utf8');
 assert.match(config,/storm-monitor-scheduled/);
 assert.match(config,/schedule = "\*\/5 \* \* \* \*"/);
 const source=fs.readFileSync('netlify/functions/b3-live-ohlc.js','utf8');
 assert.match(source,/STORM_B3_REDISTRIBUTION_ALLOWED/);
});
