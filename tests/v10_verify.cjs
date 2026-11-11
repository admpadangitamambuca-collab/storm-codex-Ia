/* Storm Códex IA v10.0 — checks sem rede/feed ao vivo. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),cp=require('node:child_process');
const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const core=fs.readFileSync(path.join(__dirname,'..','engine/v10_dual_core.js'),'utf8');
const ui=fs.readFileSync(path.join(__dirname,'..','engine/v10_comparison_ui.js'),'utf8');
const modules=[...app.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];
assert.equal(modules.length,25,'25 scripts esperados, incluindo 2 novos scripts v10');
for(let i=0;i<modules.length;i++)assert.doesNotThrow(()=>new vm.Script(modules[i][1]),'Erro de sintaxe script '+i);
assert.doesNotThrow(()=>new vm.Script(core));assert.doesNotThrow(()=>new vm.Script(ui));
const api=require('../engine/v10_dual_core.js');
assert.equal(api.selfTest().ok,true,JSON.stringify(api.selfTest()));
assert(app.indexOf('id="storm-v100-dual-core"')<app.indexOf('id="v93-classic-engine"'));
assert(app.indexOf('id="storm-v100-comparison"')>app.indexOf('id="storm-v95-copy-trade"'));
assert(app.includes('classicReview?.(')&&app.includes('turboReview?.('));
assert(app.includes('const LIMIT_USD=4,LOOKBACK=40;'));
assert(app.includes('Number.isFinite(potential)&&potential>=LIMIT_USD'));
assert(app.includes("side:gold&&!goldOk?'wait':side"));
assert(app.includes('goldFourOK&&quality?.fresh'));
assert.equal(api.VERSION,'10.1-dual-engine');
assert.equal(typeof api.technicalConfluence,'function');
assert(app.includes("COPY_TURBO_THRESHOLD_EXCLUSIVE=83"));
assert(app.includes('turboScore>COPY_TURBO_THRESHOLD_EXCLUSIVE'));
assert(app.includes("const SELECTIVE_STORAGE='v100_dual_turbo_v1'"));
assert(app.includes("'_v100_precision_'"));
assert(!app.includes('StormCodex_LocalBridge'),'MT5 isolado e não importado na v10');
assert(app.includes(core)&&app.includes(ui),'arquivos-fonte externos embutidos no HTML autônomo');
const old=(()=>{
  try{return cp.execFileSync('git',['show','origin/main:index.html'],{encoding:'utf8',maxBuffer:8*1024*1024});}
  catch{return null;}
})();
function section(s,id){const start=s.indexOf('<script id="'+id+'">');assert(start>=0,'script '+id);const end=s.indexOf('</script>',start);assert(end>start);return s.slice(start,end+9);}
if(old){
 for(const id of ['storm-v97-natural-rain','storm-v99-natural-lightning']){
  assert.equal(section(app,id),section(old,id),'módulo legado modificado: '+id);
 }
}
const t0=1700000000000;
const c=Array.from({length:90},(_,i)=>({t:t0+i*300000,open:100+i*.16,high:100+i*.16+.75,low:100+i*.16-.75,close:100+i*.16+.14}));
const r0=api.classicReview({bars:c,at:60,atr:1,side:'buy',tf:'M5',waves:{phase:'NEUTRO'},pa:{},mtf:{available:2},market:{}});
const d=c.map(x=>({...x}));
for(let i=61;i<d.length;i++){d[i].open+=900;d[i].close+=900;d[i].high+=900;d[i].low+=900;}
const r1=api.classicReview({bars:d,at:60,atr:1,side:'buy',tf:'M5',waves:{phase:'NEUTRO'},pa:{},mtf:{available:2},market:{}});
assert.deepEqual(r0,r1,'futuro não pode alterar parecer do candle 60');
const sample=[
 {origin:'observed_precision',approved:true,status:'win',closedAt:1,t:1,target:1.8,stop:1},
 {origin:'observed_precision',approved:true,status:'loss',closedAt:2,t:2,target:1.8,stop:1},
 {origin:'observed_precision',approved:true,status:'ambiguous',closedAt:3,t:3,target:1.8,stop:1},
 {origin:'historical_import',approved:true,status:'win',closedAt:4,t:4,target:1.8,stop:1}
];
const stats=api.summarize(sample,'classic');
assert.equal(stats.n,2);assert.equal(stats.excluded,1);assert.equal(stats.meanR,.4);
const turbo=[
 {origin:'observed_turbo_selective',mode:'live',status:'tp1',closedAt:1,t:1,entry:10,stop:9,targets:[12]},
 {origin:'observed_turbo_selective',mode:'live',status:'stop',closedAt:2,t:2,entry:10,stop:9,targets:[12]},
 {origin:'observed_turbo_selective',mode:'live',status:'ambiguo',closedAt:3,t:3,entry:10,stop:9,targets:[12]},
];
assert.equal(api.summarize(turbo,'turbo').n,2);
console.log('PASS 25 scripts, causalidade, histórico prospectivo, Classic/Turbo separados, Copy >83, MT5 fora do pacote.');
