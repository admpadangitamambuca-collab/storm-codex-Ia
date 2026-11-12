'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const live=require('../b3-indices-v111.js'),eod=require('../netlify/functions/b3-quote.js');
const quote=require('../storm-b3-quote-v113.js');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
test('WIN WDO must always keep exact series identification',()=>{
 assert.equal(live.contractFor('WIN',Date.parse('2026-11-12T13:00:00Z')).symbol,'WINZ26');
 assert.equal(live.contractFor('WDO',Date.parse('2026-12-01T13:00:00Z')).symbol,'WDOF27');
 assert.throws(()=>live.contractFor('PETR4'),/não suportado/);
});
test('brapi publishes EOD only with confirmed symbol and session timestamp',()=>{
 const symbol='WINZ26',timestamp=Date.parse('2026-11-12T20:00:00Z')/1000;
 const data={quotes:[{symbol,underlyingAsset:'WIN',date:timestamp,
   close:167000,settlement:167200,quotationType:'price'}]};
 const item=eod.parse(data,symbol);
 assert.equal(item.price,167000);
 assert.equal(item.isIntraday,false);
 assert.equal(item.allowIntradaySignals,false);
 assert.equal(item.feedVerified,true);
 assert.throws(()=>eod.parse(data,'WDOZ26'),/não aparece/);
 const browser=quote.decodeDirect(data,symbol);
 assert.equal(browser.isIntraday,false);
 assert.equal(browser.allowIntradaySignals,false);
 assert.equal(browser.symbol,symbol);
});
test('EOD cannot masquerade as live OHLC',()=>{
 const symbol='WDOZ26';
 assert.throws(()=>quote.verify({asset:'WDO',symbol,price:5000,quotedAt:Date.now(),feedVerified:true,
   isIntraday:true,allowIntradaySignals:true},symbol),/classificação EOD/);
 assert.throws(()=>quote.verify({asset:'WDO',symbol,price:5000,quotedAt:Date.now(),feedVerified:true,
   isIntraday:false,allowIntradaySignals:false},'WINZ26'),/Ticker divergente/);
});
test('HTML has full modules and live B3 engine never uses EOD quotes for signals',()=>{
 const required=['b3-indices-v111.js','storm-b3-quote-v113.js','storm-nasdaq-v112.js',
 'storm-precision-v112.js','learning-v108.js','StormB3Indices111.load(asset,tf,signal)'];
 for(const item of required)assert.ok(html.includes(item),item);
 assert.ok(!html.includes('StormB3Quote113.load(asset,tf'));
 const imports=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m=>m[1]);
 assert.ok(imports.includes('storm-b3-quote-v113.js'));
});
test('Full Netlify workflow contains every active module and serverless function',()=>{
 const yml=fs.readFileSync(path.join(__dirname,'..','.github/workflows/netlify-package.yml'),'utf8');
 const required=['index.html','sw.js','learning-v108.js','b3-indices-v111.js',
 'storm-b3-quote-v113.js','storm-nasdaq-v112.js','storm-precision-v112.js',
 'netlify/functions/b3-quote.js','netlify/functions/nasdaq-ohlc.js','netlify.toml'];
 for(const file of required)assert.ok(yml.includes(file),file);
 assert.doesNotMatch(yml,/Storm_Codex_IA_v10_8_APRENDIZADO_3_MOTORES_NETLIFY\.zip/);
});
