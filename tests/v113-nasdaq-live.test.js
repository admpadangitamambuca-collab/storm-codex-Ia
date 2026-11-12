'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const api=require('../storm-nasdaq-live-v113.js');
const memory=require('../learning-v108.js');
const fs=require('node:fs'),path=require('node:path');
const FRAME=api.MS;
const now=()=>Date.now();
function fixture(tf,opts={}){
 const ms=FRAME[tf],base=Math.floor(now()/ms)*ms,price=28400;
 const bars=Array.from({length:100},(_,i)=>{
  const t=base-(100-i)*ms,v=price+i*.09;
  return {openTime:new Date(t).toISOString(),open:v,high:v+2,low:v-2,close:v+.4,
   tickVolume:200+i,volume:0,isOpen:false};
 });
 bars.unshift({...bars.at(-1),openTime:new Date(base).toISOString(),isOpen:true});
 return {symbol:opts.symbol||'USTEC',interval:opts.interval||api.PERIOD[tf],bars};
}
function tick(overrides={}){
 return {symbol:'USTEC',marketState:'open',mid:28409.5,bid:28409.1,ask:28409.9,
  quoteAgeSeconds:0,stale:false,source:'MetaTrader5',...overrides};
}
test('Todos TF: OHLC legítimo USTEC separado da vela aberta',()=>{
 for(const tf of Object.keys(FRAME)){
  const data=api.validateResponse(fixture(tf),api.validateTick(tick()),tf);
  assert.equal(data.feedSymbol,'USTEC');assert.equal(data.feedVerified,true);
  assert.equal(data.candles.length,100);
  assert.ok(data.candles.every(x=>x.t+FRAME[tf]<=Date.now()));
  assert.equal(data.candles.at(-1).close,28409.31);
  assert.ok(data.candles.at(-1).tickVolume>0&&data.candles.at(-1).volume>0);
  assert.equal(data.providerStale,false);
 }
});
test('Não substituir USTEC por NAS100, ETF, ^NDX ou ticker inexistente',()=>{
 for(const bad of ['NAS100','QQQ','^NDX','US100']){
  assert.throws(()=>api.validateResponse(fixture('M1',{symbol:bad}),api.validateTick(tick()),'M1'),/ticker/);
  assert.throws(()=>api.validateTick(tick({symbol:bad})),/não corresponde/);
 }
});
test('Timeframe e tick verificáveis; mercado fechado bloqueia',()=>{
 assert.throws(()=>api.validateResponse(fixture('M1',{interval:'15m'}),api.validateTick(tick()),'M1'),/período/);
 assert.throws(()=>api.validateTick(tick({quoteAgeSeconds:50})),/desatualizado/);
 assert.throws(()=>api.validateTick(tick({marketState:'closed'})),/não está aberto/);
 assert.throws(()=>api.validateTick(tick({stale:true})),/desatualizado/);
 assert.throws(()=>api.validateResponse(fixture('M1'),api.validateTick(tick()),
  'M1',Date.now()+120000),/não acompanham/);
});
test('Captura tick REST e valida barra somente depois de fechada',async()=>{
 const previous=global.fetch;
 global.fetch=async url=>({ok:true,status:200,json:async()=>url.includes('/ohlc')
  ?fixture('M1'):tick()});
 try{
  const data=await api.load('M1');
  assert.equal(data.mode,'live');assert.equal(data.feedType,'CFD');
  assert.ok(api.getLiveTick()?.quoteAgeMs<5000);
 }finally{global.fetch=previous}
});
test('Memória v11.3 não resolve ^NDX usando candles USTEC',()=>{
 const t=Math.floor(now()/60000)*60000-3600000;
 const bars=[{t,open:28400,high:28401,low:28399,close:28400},
  {t:t+60000,open:28400,high:28500,low:28390,close:28450}];
 const row=contract=>({id:'sample',asset:'NASDAQ',tf:'M1',engine:'indices',t,side:'buy',
  status:'pending',entry:28400,stop:28350,tp:28450,contract});
 const old=[row('^NDX')];assert.equal(memory.settle(old,bars,'M1','USTEC'),true);
 assert.equal(old[0].status,'incomplete');
 const ambiguous=[row(null)];memory.settle(ambiguous,bars,'M1','USTEC');
 assert.equal(ambiguous[0].status,'incomplete');
 const live=[row('USTEC')];memory.settle(live,bars,'M1','USTEC');
 assert.equal(live[0].status,'win');
});
test('Somente aba Nasdaq usa feed USTEC; outros provedores continuam',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.match(html,/if\(asset==='NASDAQ'\)return window\.StormNasdaqLive113\.load/);
 assert.match(html,/if\(asset==='WIN'\|\|asset==='WDO'\)return window\.StormB3Indices111\.load/);
 assert.match(html,/window\.SGV78Data\.load\(asset,tf,signal\)/);
 assert.doesNotMatch(html,/if\(asset==='NASDAQ'\)return window\.StormNasdaq112\.load/);
 assert.match(html,/stormNasdaqLiveTick/);
 assert.match(html,/storm-nasdaq-live-v113\.js/);
});
