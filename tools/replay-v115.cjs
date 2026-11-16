#!/usr/bin/env node
'use strict';
/* Offline OHLC replay of the actual Storm Classic, Turbo and Indices engines.
 * Usage: node tools/replay-v115.cjs <path-to-json> <classic|turbo|indices>
 * No network or broker orders. This CLI never rewrites original history.
 */
const fs=require('node:fs'),path=require('node:path');
const {runReplay}=require('../storm-replay-v115.js');
function main(argv){
 const input=argv[2],engine=argv[3]||'classic';
 if(!input)throw Error('Uso: node tools/replay-v115.cjs arquivo.json classic|turbo|indices');
 const file=path.resolve(input),data=JSON.parse(fs.readFileSync(file,'utf8'));
 const report=runReplay({data,engine,now:Date.now(),costPrice:Number(argv[4]||0)});
 const name='Storm_Backtest_RealEngines_'+report.asset+'_'+report.tf+'_'+engine+'_'+Date.now()+'.json';
 const output=path.join(path.dirname(file),name);
 fs.writeFileSync(output,JSON.stringify(report,null,2),'utf8');
 console.log(JSON.stringify({reportFile:output,engine:report.engine,asset:report.asset,
  candles:report.rawCandles,overall:report.overall,validation:report.validation,
  blocked:report.blocked,errorCount:report.errors.length},null,2));
 return output;
}
if(require.main===module){try{main(process.argv)}catch(e){console.error('Backtest NÃO realizado:',e.message);process.exitCode=1;}}
module.exports={main};
