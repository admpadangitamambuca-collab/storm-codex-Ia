'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const yahoo=require('../netlify/functions/nasdaq-ohlc.js');
const nasdaq=require('../storm-nasdaq-v112.js');
const precision=require('../storm-precision-v112.js');
const fs=require('node:fs'),path=require('node:path');
const now=()=>Date.now();
function yahooResponse(tf='M5',symbol='^NDX'){
 const ms=nasdaq.SPEC[tf];
 const t0=Math.floor(now()/ms)*ms-ms*100;
 const timestamp=Array.from({length:100},(_,i)=>(t0+i*ms)/1000);
 const values=timestamp.map((_,i)=>28000+i*1.5);
 const quoted={open:values,high:values.map(x=>x+3),low:values.map(x=>x-3),close:values.map(x=>x+1),volume:values.map(()=>null)};
 return {chart:{result:[{meta:{symbol,instrumentType:'INDEX',exchangeDataDelayedBy:15},
  timestamp,indicators:{quote:[quoted]}}]}};
}
test('Yahoo ^NDX retorna OHLC fechados e metadados do feed',async()=>{
 const response=await yahoo.pull('M5',async()=>({ok:true,json:async()=>yahooResponse('M5')}),now());
 assert.equal(response.feedSymbol,'^NDX');
 assert.equal(response.feedVerified,true);
 assert.equal(response.candles.length,100);
 assert.ok(response.candles.at(-1).t+nasdaq.SPEC.M5<now());
 assert.equal(nasdaq.validate(response,'M5').candles.length,100);
});
test('Não confundir Nasdaq100 com futuro NQ=F, ETF ou ticker alternativo',async()=>{
 await assert.rejects(yahoo.pull('M5',async()=>({ok:true,json:async()=>yahooResponse('M5','NQ=F')}),now()),/outro ticker/);
 assert.throws(()=>nasdaq.validate({...yahooResponse('M5'),requestedAsset:'NASDAQ',requestedTf:'M5',feedSymbol:'NQ=F',feedVerified:true,candles:[]},'M5'),/ticker/);
});
test('Nasdaq não aceita vela ainda aberta ou retorno de outro período',()=>{
 const ms=nasdaq.SPEC.M5,t0=Math.floor(now()/ms)*ms-ms*100;
 const candles=Array.from({length:100},(_,i)=>({t:t0+i*ms,open:28000,high:28004,low:27998,close:28002}));
 const answer={requestedAsset:'NASDAQ',requestedTf:'M5',feedSymbol:'^NDX',feedVerified:true,candles:[...candles,{...candles.at(-1),t:Math.floor(now()/ms)*ms}]};
 assert.equal(nasdaq.validate(answer,'M5').candles.length,100);
 assert.throws(()=>nasdaq.validate(answer,'M1'),/ticker\/período/);
});
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
 assert.match(html,/if\(asset==='NASDAQ'\)return window\.StormNasdaq112\.load/);
 assert.match(html,/storm-precision-v112\.js/);
 assert.match(html,/storm-nasdaq-v112\.js/);
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
