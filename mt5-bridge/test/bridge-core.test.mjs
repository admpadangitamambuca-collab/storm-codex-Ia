import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {assessTrade,TradeQueue} from '../bridge-core.mjs';
const now=Date.UTC(2026,10,8,22,0,0);
const record=()=>({id:'copy_v95|XAUUSD|M5|123',origin:'observed_copy_v95',
 strategy:'confluencia_turbo_gt83',asset:'XAUUSD',tf:'M5',side:'buy',
 score:83.1,entry:4000,stop:3998,tp:4004,lot:0.1,
 closedAt:now-30000,recordedAt:now-1000,status:'pending'});
const feed=r=>({'XAUUSD|M5':{stale:false,error:'',closedAt:r.closedAt,eval:{ready:true,score:85}}});
test('somente score estritamente acima de 83 e vela valida',()=>{
 const r=record();
 assert.equal(assessTrade(r,feed(r),now)?.asset,'XAUUSD');
 r.score=83;assert.equal(assessTrade(r,feed(r),now),null);
 r.score=83.1;r.stop=4005;assert.equal(assessTrade(r,feed(r),now),null);
 r.stop=3998;assert.equal(assessTrade(r,{'XAUUSD|M5':{...feed(r)['XAUUSD|M5'],stale:true}},now),null);
});
test('bloqueia repeticao, replay antigo e fora da janela',()=>{
 const r=record();
 r.recordedAt=now-91000;assert.equal(assessTrade(r,feed(r),now),null);
 r.recordedAt=now-1000;r.closedAt=now-600000;assert.equal(assessTrade(r,feed(r),now),null);
});
test('fila persiste, nao duplica e expira de modo fechado',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'storm-mt5-'));
 try {
  const file=path.join(dir,'state.json'),r=record(),sig=assessTrade(r,feed(r),now);
  const q=new TradeQueue(file,()=>now);
  assert.equal(q.add(sig),true);assert.equal(q.add(sig),false);
  assert.equal(q.next()?.key,sig.key);
  assert.equal(new TradeQueue(file,()=>now).next()?.key,sig.key);
  assert.equal(q.ack(sig.key,'executed','10009'),true);
  assert.equal(q.ack(sig.key,'executed','10009'),false);
  const late=new TradeQueue(file,()=>now+180000);
  assert.equal(late.next(),null);
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('fila com sinal pendente expira automaticamente',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'storm-mt5-'));
 try {const file=path.join(dir,'state.json'),r=record(),sig=assessTrade(r,feed(r),now);
  const q=new TradeQueue(file,()=>now);q.add(sig);
  const after=new TradeQueue(file,()=>now+180000);
  assert.equal(after.next(),null);
  assert.equal(after.summary().counts.expired,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
