'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),scripts=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
for(const [i,s] of scripts.entries())new vm.Script(s[1],{filename:'script-'+i});
const src=html.match(/<script id="storm-v105-asset-specialist">([\s\S]*?)<\/script>/)?.[1];assert(src);
let now=Date.parse('2026-11-12T14:00:00Z');
class D extends Date{static now(){return now}}
const ctx={Date:D};ctx.window=ctx;vm.runInNewContext(src,ctx);
const bars=(base,step,n=100)=>Array.from({length:n},(_,i)=>{const open=base+i*step,close=open+step*.7;return {t:now-(n-i)*300000,open,close,low:open-step,high:close+step}});
const f=ctx.StormAssetSpecialist105.inspect,e=f('EURUSD','M5',bars(1.1,.00002),'buy'),g=f('XAUUSD','M5',bars(3000,.2),'buy');
assert(e.ready&&g.ready);assert(e.unit==='pips'&&g.unit==='US$/oz');assert([e,g].every(v=>v.shift>=-4&&v.shift<=4));
assert(!f('EURUSD','M5',bars(1.1,.00002,20),'buy').ready);
assert(html.includes('COPY_TURBO_THRESHOLD_EXCLUSIVE=83')&&html.includes('copyDerived:true')&&html.includes('if(force)return true;'));
console.log('V10.5 specialist + Copy static regression: OK');
