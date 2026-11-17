'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const api = require('../storm-traders-v117.js');

test('public external setup parser extracts XAU buy prices, not imaginary data', () => {
 const v = api.parseSignal('XAUUSD BUY 4200.00\nSL 4195\nTP1 4210\nTP2 4215');
 assert.equal(v.asset,'XAUUSD');assert.equal(v.side,'buy');
 assert.equal(v.entry,4200);assert.equal(v.stop,4195);
 assert.deepEqual(v.targets,[4210,4215]);assert.equal(v.complete,true);
});
test('range prices are explicitly ambiguous and require manual price selection', () => {
 const v = api.parseSignal('XAUUSD SELL 4178 - 4181\nSL 4188\nTP 4172');
 assert.equal(v.ambiguousRange,true);assert.equal(v.complete,false);
});
test('parser supports EUR/USD format and decimal prices', () => {
 const v=api.parseSignal('EURUSD BUY @ 1.100\nSL 1.090\nTP1 1.110');
 assert.equal(v.asset,'EURUSD');assert.equal(v.entry,1.1);
 assert.equal(v.stop,1.09);assert.deepEqual(v.targets,[1.11]);
});
test('manual imports reject wrong-side stop and target', () => {
 const a={trader:'Trader teste',source:'Outra fonte',asset:'XAUUSD',side:'buy',entry:'4200',stop:'4210',tp1:'4220'};
 assert.match(api.validate(a).error,/stop/i);
 a.stop='4190';a.tp1='4180';
 assert.match(api.validate(a).error,/alvo/i);
});
test('valid import is persisted only as non-audited manually imported data', () => {
 const x=api.validate({trader:'Trader teste',source:'Global Traders Hub',asset:'XAUUSD',
  side:'sell',entry:'4200',stop:'4210',tp1:'4180',url:'https://hubglobaltraders.com/traders'});
 assert.ok(x.record);assert.equal(x.record.rr,2);
 assert.equal(x.record.origin,'user_import');assert.equal(x.record.verification,'nao_auditado');
});
test('malicious URL schemes are rejected', () => {
 const x=api.validate({trader:'Trader teste',source:'Outra fonte',asset:'XAUUSD',side:'buy',
  entry:'4200',stop:'4190',tp1:'4215',url:'javascript:alert(1)'});
 assert.match(x.error,/https?:\/\//);
});
test('XAU comparison never promotes stale OHLC to verified confluence', () => {
 const now=Date.now(),signal={asset:'XAUUSD',side:'buy'};
 const snap={asset:'XAUUSD',tf:'M5',lagging:false,state:{
  mode:'live',providerStale:true,closedAt:now-20000,classicAnalysis:{side:'buy'}}};
 const turbo={data:{asset:'XAUUSD',tf:'M5'},plan:{side:'buy',score:89,hasData:true,closedAt:now-20000}};
 const c=api.engineComparison(signal,snap,turbo,now);
 assert.equal(c.status,'OHLC ATRASADO');assert.equal(c.score,null);
});
test('only independent fresh engine readings create dual agreement', () => {
 const now=Date.now(),signal={asset:'XAUUSD',side:'buy'};
 const snap={asset:'XAUUSD',tf:'M5',lagging:false,state:{
  mode:'live',providerStale:false,closedAt:now-20000,classicAnalysis:{side:'buy'}}};
 const turbo={data:{asset:'XAUUSD',tf:'M5'},plan:{side:'buy',score:87,hasData:true,closedAt:now-20000}};
 assert.equal(api.engineComparison(signal,snap,turbo,now).status,'CONFLUÊNCIA 2/2');
 assert.equal(api.engineComparison({...signal,side:'sell'},snap,turbo,now).status,'DIVERGÊNCIA');
});
test('new UI assets are present in main HTML; no auto-trading or fake external feed', () => {
 const base=path.resolve(__dirname,'..');
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
 const src=fs.readFileSync(path.join(base,'storm-traders-v117.js'),'utf8');
 assert.match(html,/<script src="storm-traders-v117\.js"><\/script>/);
 assert.match(html,/<link rel="stylesheet" href="storm-traders-v117\.css">/);
 assert.match(src,/Sem API oficial conectada/);
 assert.match(src,/user_import/);
 assert.doesNotMatch(src,/fetch\s*\(\s*['"]https:\/\/hubglobaltraders/);
});
