'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const core=require('../engine/v10_dual_core.js');
assert.equal(core.VERSION,'10.0-dual-engine');
assert.equal(core.selfTest().ok,true,'selfTest causal/regression');
const bars=Array.from({length:85},(_,i)=>{
 const p=100+i*.2+Math.sin(i*2.1)*1.1;
 return {t:1700000000000+i*300000,open:p-.15,close:p+.15,high:p+.75,low:p-.75};
});
const snapshot=core.structure(bars,65,1,'buy','M5');
const other=bars.map(x=>({...x}));
other.slice(66).forEach((x,i)=>{x.high+=200+i;x.low-=200+i;x.close+=200+i;});
assert.deepEqual(core.structure(other,65,1,'buy','M5'),snapshot,'No lookahead from candles after signal');
const score=[
 {name:'Estrutura e price action',earned:23,max:23,note:'estrutura'},
 {name:'Médias e momentum',earned:13,max:13,note:'EMA'},
 {name:'Order Block e FVG',earned:15,max:15,note:'zona'},
 {name:'Fibonacci e padrões',earned:9,max:9,note:'fib'}
];
const pristine=JSON.stringify(score);
const revised=core.turboReview({bars,side:'buy',tf:'M1',atr:1,components:score,regime:{kind:'range'}});
assert.equal(JSON.stringify(score),pristine,'No mutation of original components');
assert.ok(revised.scoreDelta<=-4,'Duplicate evidence discounted');
const rows=Array.from({length:45},(_,i)=>({
 origin:'observed_precision',approved:true,status:i%3===0?'loss':'win',closedAt:1000+i,
 t:1000+i,target:1.5,stop:1,setup:i<31?(i%4===0?'B':'A'):'B'
}));
rows.push({origin:'observed_precision',approved:true,status:'pending',closedAt:10000,t:10000,target:1.5,stop:1});
rows.push({origin:'historical_import',approved:true,status:'win',closedAt:10001,t:10001,target:1.5,stop:1});
const result=core.summarize(rows,'classic');
assert.equal(result.n,45);
assert.equal(result.pending,1);
assert.equal(result.trainN,31);
assert.equal(result.testN,14);
assert.equal(result.validSample,true);
assert.equal(result.best?.name,'A','Training decides best setup, not holdout');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.equal(scripts.length,25);
scripts.forEach((s,i)=>assert.doesNotThrow(()=>new Function(s[1]),'script '+i));
assert.ok(html.indexOf('id="storm-v100-dual-core"')<html.indexOf('id="v93-classic-engine"'));
assert.ok(html.indexOf('id="storm-v100-comparison"')>html.indexOf('id="storm-v95-copy-trade"'));
assert.ok(html.includes('turboScore>COPY_TURBO_THRESHOLD_EXCLUSIVE'));
assert.ok(html.includes('COPY_TURBO_THRESHOLD_EXCLUSIVE=83'));
assert.ok(!html.includes('StormCodex_LocalBridge'));
assert.ok(html.includes("VERSION='classic-precision-v10.0.0'"));
assert.ok(html.includes("SELECTIVE_STORAGE='v100_dual_turbo_v1'"));
console.log('PASS: deterministic causal test, training holdout, engine regression, 25 scripts, Copy >83, MT5 excluded');
