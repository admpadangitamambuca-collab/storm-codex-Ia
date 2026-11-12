'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8');
const scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
assert(scripts.length>=15,'HTML deve conter motores e scripts completos');
for(const [i,code] of scripts.entries())new vm.Script(code,{filename:'inline-script-'+i+'.js'});
const match=html.match(/<script id="storm-v95-copy-trade">([\s\S]*?)<\/script>/);
assert(match,'Simulador Copy Trade ausente');
assert(html.includes('COPY_TURBO_THRESHOLD_EXCLUSIVE=83'));
assert(!html.includes('goldFourOK'),'Filtro extra do ouro não pode anular o score >83');
assert(html.includes("window.addEventListener('load',boot"),'Auto-start não conectado');
let clock=Date.parse('2026-11-11T15:22:00Z');
let delayFeed=false,turboScore=84.2;
const nativeDate=Date;
class Clock extends nativeDate {constructor(...xs){super(...(xs.length?xs:[clock]));}static now(){return clock;}}
const store=new Map();
const prices={EURUSD:1.1,XAUUSD:3025,USDJPY:150,AUDUSD:.67};
const frame={M1:60000,M5:300000,M15:900000,H1:3600000};
function barsFor(asset,tf){
 const ms=frame[tf],latest=Math.floor(clock/ms)*ms-ms,base=prices[asset],step=base*.00002;
 return Array.from({length:60},(_,i)=>{
  const close=base+step*i;
  return {t:latest-(59-i)*ms,open:close-step*.7,high:close+step*.5,low:close-step,close,volume:1};
 });
}
const ctx={
 Date:Clock,console,setTimeout,clearTimeout,setInterval:()=>0,requestAnimationFrame:()=>0,
 localStorage:{getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)},
 document:{readyState:'loading',addEventListener:()=>{},getElementById:()=>null},
 SGUserHistoryKey:'test-user',
 SGV78Data:{load:async (asset,tf)=>({candles:barsFor(asset,tf),source:'fixture',providerStale:delayFeed&&asset==='XAUUSD'&&tf==='M5'})},
 SGEngine:{evaluateLegacy:(candles)=>{const last=candles.at(-1),base=last.close;return {side:'buy',price:base,stopDist:base*.0009,targetDist:base*.0018,atr:base*.0008,score:75};}},
 Vortex83Turbo:{contextForCopy:(data)=>{
   const a=data.state.analysis,p=data.state.candles.at(-1).close;
   return {data,plan:{side:a.side,hasLevels:true,entry:p,stop:p-a.stopDist,targets:[p+a.targetDist]}};
 }},
 Vortex91Core:{analyze:()=>({score:turboScore,qualityCheck:{valid:true,fresh:true,gaps:false},trigger:{kind:'fixture'}})}
};
ctx.window=ctx;
vm.runInNewContext(match[1],ctx,{filename:'copy-trade.js'});
(async()=>{
 const copy=ctx.StormCopyTrade95;
 assert(copy?.scanNow&&copy?.getTrades,'API do Copy Trade ausente');
 assert.equal(copy.lotPnl({asset:'XAUUSD',side:'buy',entry:3000,lot:.1},3010),100);
 assert.equal(Math.round(copy.lotPnl({asset:'USDJPY',side:'buy',entry:150,lot:.15},151)*100)/100,99.34);
 await copy.scanNow();
 assert.equal(copy.getTrades().length,0,'primeira consulta não pode importar candles anteriores');
 assert.equal(copy.getReadings().length,16,'as primeiras 16 leituras devem ser registradas mesmo sem entradas');
 assert.equal(copy.getFeeds()['XAUUSD|M5'].eval.score,84.2,'o score precisa aparecer já na primeira leitura');
 assert.equal(copy.getReadings().length,16,'a primeira varredura deve registrar 16 leituras, sem operacoes retroativas');
 turboScore=78;
 await copy.scanNow();
 assert.equal(copy.getFeeds()['XAUUSD|M5'].eval.score,78,'Refresh recalcula score no mesmo candle');
 assert.equal(copy.getReadings().length,16,'Refresh nao duplica velas avaliadas');
 assert.equal(copy.getReadings().find(x=>x.id.includes('XAUUSD|M5')).revisions,1,'alteracao do score deve ser auditada');
 assert.equal(copy.getReadings().length,16,'Refresh da mesma vela atualiza a leitura sem duplicar histórico');
 assert(copy.getReadings().some(r=>r.asset==='XAUUSD'&&r.tf==='M5'&&r.score===78),'pontuação atualizada no log');
 assert.equal(copy.getTrades().length,0,'releitura da mesma vela não pode criar registro retroativo');
 turboScore=84.2;
 await copy.scanNow();
 clock+=3600000;
 await copy.scanNow();
 assert.equal(copy.getTrades().length,16,'16 pares ativo/TF devem simular quando score>83 e OHLC for válido');
 assert.equal(copy.getReadings().length,32,'cada novo fechamento deve acrescentar uma nova leitura para os 16 pares');
 assert.equal(copy.getReadings().length,32,'nova vela de cada um dos 16 pares gera leitura independente');
 await copy.scanNow();
 assert.equal(copy.getTrades().length,16,'não duplicar operação no mesmo candle');
 assert.equal(copy.getReadings().length,32,'recalculo manual do mesmo candle nao duplica registros de leitura');
 assert.equal(copy.getReadings().find(x=>x.id.includes('XAUUSD|M5')).checks,2,'refresh identico deve contar nova verificacao');
 clock+=3600000;
 delayFeed=true;
 await copy.scanNow();
 assert.equal(copy.getTrades().length,31,'candle atrasado não pode ser registrado antes de recuperar a fonte');
 clock+=20000;delayFeed=false;
 await copy.scanNow();
 assert.equal(copy.getTrades().length,32,'candle recuperado ainda na janela válida deve ser registrado');
 const pair=copy.getTrades().filter(x=>x.asset==='XAUUSD'&&x.tf==='M5');
 assert.equal(pair.length,2);
 const r={status:'pending',t:0,tf:'M1',side:'buy',entry:100,stop:99,tp:101,lot:.1,asset:'XAUUSD'};
 const end=copy.settleOne(r,[{t:0},{t:60000,low:99.5,high:101.2}]);
 assert.equal(end.status,'take');
 const both=copy.settleOne(r,[{t:0},{t:60000,low:98.8,high:101.2}]);
 assert.equal(both.status,'ambiguo','não inventar ordem intravela');
 // O primeiro fetch pode atravessar um fechamento depois que a página foi aberta.
 // Esse fechamento deve ser contado, mas nenhuma vela anterior à abertura.
 clock=Date.parse('2026-11-11T15:23:58Z');
 let firstRequest=true;
 const second={...ctx,SGUserHistoryKey:'crossing-user',localStorage:ctx.localStorage,
  SGV78Data:{load:async(asset,tf)=>{
   if(firstRequest){firstRequest=false;clock+=3000}
   return {candles:barsFor(asset,tf),source:'fixture',providerStale:false};
  }}};
 second.window=second;
 vm.runInNewContext(match[1],second,{filename:'copy-trade-crossing.js'});
 await second.StormCopyTrade95.scanNow();
 const crossing=second.StormCopyTrade95.getTrades();
 assert.equal(crossing.length,4,'deve observar primeiro fechamento M1 durante o fetch inicial, sem backfill de M5/M15/H1');
 assert(crossing.every(r=>r.tf==='M1'),'não importar velas encerradas antes do início');
 console.log('PASS: sintaxe dos scripts; 16 leituras por ciclo; historico de refresh; entrada >83 prospectiva; recuperação, deduplicação e liquidação.');
})().catch(e=>{console.error(e);process.exitCode=1});
