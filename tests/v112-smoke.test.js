'use strict';
// Legacy Precision 11.2 regressions; Nasdaq data adapter is now tested in v113-nasdaq-live.test.js.
const test=require('node:test'),assert=require('node:assert/strict');
const precision=require('../storm-precision-v112.js');
const fs=require('node:fs'),path=require('node:path');
const now=()=>Date.now();
function goldBars(){
 const ms=60000,end=Math.floor(now()/ms)*ms-ms;
 return Array.from({length:120},(_,i)=>{
  const price=4100+i*.15+Math.sin(i/8)*.7,prev=4100+(i-1)*.15+Math.sin((i-1)/8)*.7;
  return {t:end-(119-i)*ms,open:prev,close:price,
   high:Math.max(price,prev)+.45,low:Math.min(price,prev)-.45,volume:25+i};
 });
}
test('Turbo XAU consegue plano com menos de US$4 sem alterar gate Clássico',()=>{
 const bars=goldBars(),original={side:'wait',candidateSide:'buy',quality:'EVITAR',
  oneCandleGate:{accepted:false,originalSide:'buy',projectedOneCandle:1.6},
  turboBase:{side:'buy',quality:'ALTA',score:79,stopDist:1.9,targetDist:2.2}};
 const turbo=precision.turboGold({asset:'XAUUSD',tf:'M1',state:{candles:bars,mode:'live',providerStale:false}},original);
 assert.equal(turbo.side,'buy');assert.equal(turbo.ready,true);
 assert.ok(turbo.targetDist>0&&turbo.targetDist<4);assert.ok(turbo.netRR>=1.2);
 const classic=precision.enhanceClassic({...original,score:70},bars,'M1','XAUUSD');
 assert.equal(classic.side,'wait');assert.equal(classic.oneCandleGate.accepted,false);
});
test('Stale OHLC e veto de risco do motor base bloqueiam o Turbo',()=>{
 const bars=goldBars(),base={side:'wait',oneCandleGate:{accepted:false,originalSide:'buy'},
  turboBase:{side:'buy',quality:'ALTA',score:82}};
 const stale=precision.turboGold({asset:'XAUUSD',tf:'M1',state:{candles:bars,mode:'live',providerStale:true}},base);
 assert.equal(stale.ready,false);
 const veto=precision.turboGold({asset:'XAUUSD',tf:'M1',state:{candles:bars,mode:'live',providerStale:false}},
  {...base,turboBase:{...base.turboBase,quality:'EVITAR'}});
 assert.equal(veto.ready,false);
});
test('HTML principal referencia a fonte Nasdaq e os dois motores originais',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.match(html,/if\(asset==='NASDAQ'\)return window\.StormNasdaqLive113\.load/);
 assert.match(html,/storm-precision-v112\.js/);
 assert.match(html,/storm-nasdaq-live-v113\.js/);
 assert.match(html,/StormPrecision112\?\.enhanceClassic/);
 assert.match(html,/goldIndependent/);
 assert.match(html,/copy/i);
});

const b3=require('../b3-indices-v111.js');
const learning=require('../learning-v108.js');

test('Vencimento WIN/WDO segue B3 e nunca muda arbitrariamente a cada pregão',()=>{
 const date=t=>Date.parse(t+'T13:00:00-03:00');
 assert.equal(b3.contractFor('WIN',date('2026-11-12')).symbol,'WINZ26');
 assert.equal(b3.contractFor('WIN',date('2026-12-16')).symbol,'WINZ26');
 assert.equal(b3.contractFor('WIN',date('2026-12-17')).symbol,'WING27');
 assert.equal(b3.contractFor('WDO',date('2026-11-30')).symbol,'WDOZ26');
 assert.equal(b3.contractFor('WDO',date('2026-12-01')).symbol,'WDOF27');
 assert.equal(b3.trustedSymbol('WIN',{symbol:'WDOF27',exchange:'B3'}),null);
});
test('Memória não liquida contrato vencido com candles do próximo vencimento',()=>{
 const ms=60000,t=Date.now()-ms*4;
 const rows=[{id:'o',engine:'indices',asset:'WIN',tf:'M1',contract:'WINZ26',
   t,status:'pending',side:'buy',entry:140000,stop:139995,tp:140010}];
 const bars=[{t,open:140000,high:140002,low:139998,close:140001},
  {t:t+ms,open:140001,high:140012,low:139996,close:140007}];
 assert.equal(learning.settle(rows,bars,'M1','WING27'),true);
 assert.equal(rows[0].status,'incomplete');
});
test('Notícias rejeitam hyperlinks javascript: e data: no DOM',()=>{
 const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
 assert.match(html,/const safeNewsUrl=/);
 assert.ok(html.includes("['https:','http:'].includes(u.protocol)"));
 assert.ok(html.includes('href="${safeNewsUrl(n.url)}"'));
});
