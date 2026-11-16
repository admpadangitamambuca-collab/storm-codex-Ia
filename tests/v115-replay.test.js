'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const replay=require('../storm-replay-v115.js'),{createRuntime}=require('../storm-runtime-v115.js');
const B3=require('../b3-indices-v111.js');
function bars(n,tf='M5',start=Date.parse('2026-11-11T12:00:00Z'),base=1.1,step=.0002){
 const ms=replay.FRAME[tf],items=[];
 for(let i=0;i<n;i++){
  const v=base+Math.sin(i/11)*step*9+i*step*.35;
  const open=i?items.at(-1).close:v;
  const close=v,wide=Math.abs(step)*2;
  items.push({t:start+i*ms,open,close,high:Math.max(open,close)+wide,low:Math.min(open,close)-wide,volume:15});
 }
 return items;
}
test('causal historical replay invokes production Classic, no market fetch or localStorage',()=>{
 const data={asset:'EURUSD',tf:'M5',feedSymbol:'EURUSD',candles:bars(160)};
 const result=replay.runReplay({engine:'classic',data,now:Date.parse('2026-11-17T12:00:00Z')});
 assert.equal(result.engine,'classic');
 assert.equal(result.rawCandles,160);
 assert.ok(result.overall&&result.validation&&result.train);
 assert.ok(result.assessedFrom<result.assessedTo);
 assert.equal(result.errors.length,0,JSON.stringify(result.errors.slice(0,4)));
});
test('Turbo real engine runs under historical macro guard; never fabricates verification',()=>{
 const data={asset:'EURUSD',tf:'M5',feedSymbol:'EURUSD',candles:bars(160)};
 const result=replay.runReplay({engine:'turbo',data,now:Date.parse('2026-11-17T12:00:00Z')});
 assert.equal(result.engine,'turbo');
 assert.equal(result.errors.length,0,JSON.stringify(result.errors.slice(0,4)));
 assert.equal(result.overall.resolved,0,'sem notícia/calendário causal não há TP/SL elegível');
 assert.ok(Object.keys(result.blocked).some(x=>x.includes('macro'))||result.overall.signals===0);
});
test('B3 replay calls its original engine with fixed as-of clock and exact contract',()=>{
 const start=Date.parse('2026-11-12T12:00:00Z'),ms=60000,ohlc=[];
 for(let i=0;i<125;i++){
  const close=160000+Math.round((i*3+Math.sin(i/9)*10)/5)*5;
  ohlc.push({t:start+i*ms,open:close,high:close+10,low:close-10,close,volume:100});
 }
 const r=replay.runReplay({engine:'indices',data:{asset:'WIN',tf:'M1',feedSymbol:'WINZ26',candles:ohlc},
  now:Date.parse('2026-11-17T12:00:00Z')});
 assert.equal(r.engine,'indices');
 assert.equal(r.feedSymbol,'WINZ26');
 assert.equal(r.errors.length,0,JSON.stringify(r.errors.slice(0,2)));
 assert.throws(()=>replay.runReplay({engine:'indices',data:{asset:'WIN',tf:'M1',feedSymbol:'WDOZ26',candles:ohlc}}),/ticker/);
 assert.equal(B3.contractFor('WIN',start).symbol,'WINZ26');
});
test('no future candles can be evaluated at time t or counted as a closed signal',()=>{
 const rows=bars(120);
 assert.throws(()=>replay.parseBars([...rows,{...rows.at(-1),t:rows.at(-1).t}], 'M5'),/duplicado|ordem/);
 assert.throws(()=>replay.parseBars([...rows,{...rows.at(-1),t:Date.now()+600000}], 'M5'),/aberta|inválida/);
 const opened={...rows.at(-1),isOpen:true};
 assert.throws(()=>replay.parseBars([...rows.slice(0,-1),opened], 'M5'),/aberta/);
});
test('settlement keeps pending until six future bars are seen, no same-candle win fabrication',()=>{
 const c=bars(68),i=60,b=c[i];
 const signal={side:'buy',entry:b.close,stop:b.close-.05,target:b.close+.05,
  stopDist:.05,targetDist:.05};
 const until=c.slice(0,i+2);
 const first=replay.settlement(until,i,signal,'M5',0);
 assert.ok(['pending','win','loss','ambiguous','incomplete'].includes(first.result));
 const forced={...signal,stop:0.5,target:2}; // neither can be reached
 const short=replay.settlement(until,i,forced,'M5',0);
 assert.equal(short.result,'pending');
 const complete=replay.settlement(c,i,forced,'M5',0);
 assert.equal(complete.result,'expired');
 const both=[...c];both[i+1]={...c[i+1],high:3,low:.4};
 assert.equal(replay.settlement(both,i,forced,'M5',0).result,'ambiguous');
});
test('backtest requires real identity and never equates ETF with Nasdaq or spot with B3',()=>{
 assert.throws(()=>replay.checkIdentity('NASDAQ','NQ=F','M5',bars(80)),/Nasdaq/);
 assert.throws(()=>replay.checkIdentity('WDO','USD/BRL','M5',bars(80)),/ticker/);
});
