// Auditoria regressiva sem dependências externas: node --test tests/auditoria.test.cjs
'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const blocks=[...html.matchAll(/<script\\b[^>]*>([\\s\\S]*?)<\\/script>/gi)].map(m=>m[1]);
const part=(i,a,b)=>{const s=blocks[i],start=s.indexOf(a),end=s.indexOf(b,start);assert.ok(start>=0&&end>start,'Trecho não encontrado: '+a);return s.slice(start,end);};

test('Todos os scripts inline possuem sintaxe JavaScript válida',()=>{
 assert.ok(blocks.length>=23);
 blocks.forEach((s,i)=>assert.doesNotThrow(()=>new vm.Script(s,{filename:'inline-'+i+'.js'})));
});
test('OHLC aceita timestamps ISO, Unix segundos e milissegundos e rejeita vela aberta',()=>{
 const root={};vm.runInNewContext(blocks[8],{window:root,globalThis:root,Date,Number,Map,AbortController,setTimeout,clearTimeout});
 const parse=root.SGV78Data.normalOHLC,now=Date.UTC(2026,10,11,15,0,30);
 const bar=(openTime,extra={})=>({openTime,open:100,high:102,low:99,close:101,...extra});
 for(const t of ['2026-11-11T14:59:00Z',String((now-90000)/1000),String(now-90000)]){
  assert.equal(parse([bar(t)],'M1',now).length,1,'timestamp '+t);
 }
 assert.equal(parse([bar('2026-11-11T14:59:00Z',{isOpen:true})],'M1',now).length,0);
 assert.equal(parse([bar('2026-11-11T14:59:00Z',{high:98})],'M1',now).length,0);
});
test('H1 só reconstrói com quatro M15 completos',()=>{
 const root={};vm.runInNewContext(blocks[9],{window:root,globalThis:root,Date,Map,Math,Number,Error});
 const a=root.SGV931H1Recovery.aggregateClosedM15,hour=Date.UTC(2026,10,11,14),quarter=900000;
 const bars=Array.from({length:4},(_,i)=>({t:hour+i*quarter,open:100+i,high:105+i,low:99+i,close:101+i,volume:2,tickVolume:3}));
 assert.equal(a(bars,hour+3600000+1000).length,1);
 assert.equal(a(bars.slice(0,3),hour+3600000+1000).length,0);
});
test('MTF não usa um timeframe fechado depois do candle analisado',()=>{
 const src=part(17,'function planFor(','function detectAndSave(');
 const fn=new Function('data', 'const FRAMES={M1:60000,M5:300000,M15:900000,H1:3600000};const finite=Number.isFinite;const quote=()=>"USD";'+src+';return planFor(data,{},{danger:false});');
 const t=Date.now()-120000, data={asset:'EURUSD',tf:'M5',state:{mode:'live',closedAt:t,analysis:{side:'buy',price:1.1,atr:.001,stopDist:.002,targetDist:.003},candles:Array.from({length:45},()=>({close:1.1}))},snapshots:{M1:{mode:'live',candles:[{}],closedAt:t+60000,analysis:{side:'buy'}},M15:{mode:'live',candles:[{}],closedAt:t-900000,analysis:{side:'buy'}}}};
 const p=fn(data);
 assert.equal(p.mtf.find(x=>x.tf==='M1').fresh,false);
 assert.equal(p.mtf.find(x=>x.tf==='M15').fresh,false); // dado excessivamente antigo
});
test('Copy Trade: take, stop ambíguo, histórico incompleto e pendência coerentes',()=>{
 const src=part(20,'function settleOne(','function settleTrades(');
 const run=new Function('r','bars','const FRAMES={M1:60000};const lotPnl=()=>20;const realizedR=()=>2;'+src+';return settleOne(r,bars);');
 const r={asset:'XAUUSD',tf:'M1',t:1000000,side:'buy',status:'pending',entry:100,stop:99,tp:102,lot:.1};
 const b=t=>({t,open:100,high:101,low:99.5,close:100});
 assert.equal(run(r,[b(r.t)]).status,'pending');
 assert.equal(run(r,[b(r.t),{...b(r.t+60000),high:103}]).status,'take');
 assert.equal(run(r,[b(r.t),{...b(r.t+60000),high:103,low:98}]).status,'ambiguo');
 assert.equal(run(r,[b(r.t),b(r.t+120000)]).status,'incompleto');
 assert.equal(run(r,[b(r.t+7*60000)]).status,'incompleto');
});
test('Turbo: histórico sem vela de origem não fica pendente indefinidamente',()=>{
 const src=part(17,'function outcome(','function settle(data)');
 const run=new Function('r','bars','const FRAMES={M1:60000};const MAX_HORIZON=6;const finite=Number.isFinite;'+src+';return outcome(r,bars,"M1");');
 const r={t:1000000,side:'buy',status:'pending',stop:99,targets:[101,102,103],maxBars:6};
 assert.equal(run(r,[{t:r.t+7*60000}]).status,'incompleto');
});
test('Clássico Precision: histórico expirado sem vela de origem é inconclusivo',()=>{
 const src=part(10,'function resolve(rows,c,tf)','function track(');
 const run=new Function('rows','bars','const FRAMES={M1:60000};'+src+';return resolve(rows,bars,"M1");');
 const rows=[{t:1000000,horizon:3,status:'pending'}];
 assert.equal(run(rows,[{t:1000000+4*60000}]),1);
 assert.equal(rows[0].status,'incomplete');
});
test('Fonte com falha marca o último snapshot como atrasado',()=>{
 assert.match(blocks[11],/snapshots\\.set\\(key,\\{\\.\\.\\.prior,providerStale:true,error:msg/);
});
test('Copy Trade exige score estritamente superior a 83 e sem gap',()=>{
 assert.match(blocks[20],/const COPY_TURBO_THRESHOLD_EXCLUSIVE=83/);
 assert.match(blocks[20],/turboScore>COPY_TURBO_THRESHOLD_EXCLUSIVE/);
 assert.match(blocks[20],/quality\\?\\.fresh&&quality\\?\\.valid&&!quality\\?\\.gaps/);
 assert.doesNotMatch(blocks[20].slice(blocks[20].indexOf('function computeForCopy('),blocks[20].indexOf('function settleOne(')),/classicScore\\s*[<>]=?\\s*65/);
});
test('Exportação Copy protege fórmulas de planilha',()=>{
 const start=blocks[20].indexOf('function exportCSV()'),frag=blocks[20].slice(start);
 assert.match(frag,/\\/\\^\\[=\\+\\\\-@/);
});
test('Service worker opcional não cacheia cotações',()=>{
 const sw=fs.readFileSync(path.join(__dirname,'..','sw.js'),'utf8');
 assert.doesNotThrow(()=>new vm.Script(sw));
 assert.doesNotMatch(sw,/\\bcaches\\.open\\(/);
});
