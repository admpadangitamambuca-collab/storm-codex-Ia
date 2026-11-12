'use strict';
const assert=require('node:assert/strict');
const {features,settle,calibrate,assess,rowsOf,THRESHOLD}=require('../learning-v108.js');

const store=new Map();
global.localStorage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};
global.SGUserHistoryKey='teste_regressao_108';
const MS=60000;
const lastClose=Math.floor((Date.now()-65000)/MS)*MS;
function candles(count,offset=0){
 const end=lastClose-MS+offset*MS;
 const first=end-(count-1)*MS;
 return Array.from({length:count},(_,i)=>{
  const open=100+i*.04,close=open+.035;
  return {t:first+i*MS,open,close,high:close+.12,low:open-.12,volume:100};
 });
}
const bars=candles(55);
const f=features(bars,'buy');
assert.equal(f.ready,true);
assert.ok(Number.isFinite(f.rsi)&&Number.isFinite(f.atr)&&Number.isFinite(f.efficiency));
assert.ok(f.technical>=-3&&f.technical<=3);
assert.equal(features(bars.slice(-10),'buy').ready,false);
const base={asset:'EURUSD',tf:'M1',side:'buy',baseScore:79,mode:'live',providerStale:false,
 entry:bars.at(-1).close,stop:bars.at(-1).close-1,tp:bars.at(-1).close+1};
let first=assess('classic',{...base,candles:bars});
assert.equal(first.tracked,false,'primeiro candle apenas arma monitor');
const future=candles(56,1);
let second=assess('classic',{...base,entry:future.at(-1).close,stop:future.at(-1).close-1,tp:future.at(-1).close+1,candles:future});
assert.equal(second.tracked,true,'vela nova válida com score >78 pode ser registrada');
assert.equal(rowsOf('classic','EURUSD','M1').length,1);
second=assess('classic',{...base,entry:future.at(-1).close,stop:future.at(-1).close-1,tp:future.at(-1).close+1,candles:future});
assert.equal(second.tracked,false,'Refresh idêntico não cria duplicatas');
assert.equal(rowsOf('indices','EURUSD','M1').length,0,'motores separados');
assert.equal(rowsOf('turbo','EURUSD','M1').length,0,'Turbo separado do Clássico');
assert.equal(assess('turbo',{...base,mode:'demo',candles:bars}).tracked,false,'demo não aprende');
assert.equal(THRESHOLD,78);

const o=candles(2),t=o[0].t;
function row(){return {id:'x',engine:'turbo',asset:'EURUSD',tf:'M1',t,
 status:'pending',side:'buy',entry:100,stop:99,tp:101,atr:1}}
const both=[{...o[0],open:100,close:100,high:100.2,low:99.8},
 {t:t+MS,open:100,close:100.5,high:101.5,low:98.5}];
const ambiguous=[row()];
assert.equal(settle(ambiguous,both,'M1'),true);
assert.equal(ambiguous[0].status,'ambiguous','TP e stop na mesma vela não viram acerto');
const won=[row()];
assert.equal(settle(won,[both[0],{...both[1],low:99.5}],'M1'),true);
assert.equal(won[0].status,'win');
const lost=[row()];
assert.equal(settle(lost,[both[0],{...both[1],high:100.5}],'M1'),true);
assert.equal(lost[0].status,'loss');
const broken=[row()];
settle(broken,[both[0],{...both[1],t:t+MS*2}],'M1');
assert.equal(broken[0].status,'incomplete','lacunas não viram perda');

function sample(negative=false){
 return Array.from({length:50},(_,i)=>{
  const win=!negative&&i%10<7,R=win?1.6:-1;
  return {engine:'turbo',asset:'XAUUSD',tf:'M1',t:1+i*MS,closedAtResult:1+(i+1)*MS,
   status:win?'win':'loss',R,regime:'tendência'};
 });
}
const positive=calibrate(sample(),100000000,{regime:'tendência'});
assert.equal(positive.active,true);
assert.ok(positive.adjustment>0,'ajuste com treino e validação positivos');
const negative=calibrate(sample(true),100000000,{regime:'tendência'});
assert.ok(negative.adjustment<0,'perdas reduzem score');
const noFuture=calibrate(sample(),25*MS,{regime:'tendência'});
assert.equal(noFuture.active,false,'resultados do futuro não entram na calibração');
console.log('PASS v10.8: features, prospectividade, deduplicação, separação de motores, TP/SL ambíguo, lacunas e calibração temporal');