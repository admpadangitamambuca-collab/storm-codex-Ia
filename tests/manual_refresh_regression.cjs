'use strict';
/* Storm Códex IA v10.4 — verificações de integridade estrutural do refresh manual */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
for(const match of scripts)if(match[2].trim())new Function(match[2]);
for(const required of [
 'if(unchanged&&!manual)',
 'if(!manualSameCandle)emitEveryClosedCandle(asset,tf,snap,prior)',
 '||data.state?.manualReadSameCandle',
 'Promise.allSettled(probes)',
 'const frames=[mainTF,...Object.keys(TF).filter(tf=>tf!==mainTF)]',
 'fetchCalendar(true)',
 'function rereadCachedSnapshot(asset,tf,sequence)',
 'const next=computeSnapshot(old.candles,old.mode,meta);',
 'if(sequence!==manualReadSequence'
])assert.ok(html.includes(required),'Integridade ausente: '+required);
assert.match(html,/const meta=\{asset,tf,source:old\.source/);
assert.doesNotMatch(html,/computeSnapshot\(old\.candles,old\.mode,\{\.\.\.old/);
console.log('Refresh manual 10.4: sintaxe e invariantes OK ('+scripts.length+' scripts)');
