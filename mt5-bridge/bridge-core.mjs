// Storm Codex IA - ponte local MT5. Funcoes puras e fila persistente.
// Isolado do index.html: nao altera estrategia, score, historico ou feed.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const FRAMES = Object.freeze({M1:60000,M5:300000,M15:900000,H1:3600000});
export const ASSETS = Object.freeze(['XAUUSD','EURUSD','USDJPY','AUDUSD']);
const finitePositive = x => typeof x === 'number' && Number.isFinite(x) && x > 0;
export function assessTrade(record, feeds, now=Date.now()) {
  const r = record;
  if (!r || r.origin !== 'observed_copy_v95' || r.strategy !== 'confluencia_turbo_gt83') return null;
  if (typeof r.id !== 'string' || r.id.length > 160 || !ASSETS.includes(r.asset) || !FRAMES[r.tf]) return null;
  if (r.side !== 'buy' && r.side !== 'sell') return null;
  if (!(typeof r.score === 'number' && Number.isFinite(r.score) && r.score > 83 && r.score <= 100)) return null;
  if (r.status !== 'pending' || !finitePositive(r.entry) || !finitePositive(r.stop) || !finitePositive(r.tp)) return null;
  if (!finitePositive(r.lot) || !Number.isSafeInteger(r.closedAt) || !Number.isSafeInteger(r.recordedAt)) return null;
  if (r.recordedAt > now + 1000 || now-r.recordedAt > 90000 ||
      r.closedAt > now+1000 || now-r.closedAt > Math.min(FRAMES[r.tf]+90000,390000)) return null;
  if (r.side==='buy' && !(r.stop < r.entry && r.tp > r.entry)) return null;
  if (r.side==='sell' && !(r.stop > r.entry && r.tp < r.entry)) return null;
  const f = feeds && feeds[r.asset+'|'+r.tf];
  if (!f || f.stale !== false || f.error || f.closedAt !== r.closedAt ||
      !f.eval || f.eval.ready !== true || !(Number(f.eval.score)>83)) return null;
  const key = createHash('sha256').update(r.id).digest('hex').slice(0,16);
  return Object.freeze({
    key, originalId:r.id, asset:r.asset, tf:r.tf, side:r.side,
    score:r.score, entry:r.entry, stop:r.stop, tp:r.tp,
    candleClosedAt:r.closedAt, createdAt:r.recordedAt, source:String(r.source||'public').slice(0,80)
  });
}

export class TradeQueue {
  constructor(file, clock=()=>Date.now()) {
    this.file=file; this.clock=clock; this.rows={};
    try {
      const old=JSON.parse(fs.readFileSync(file,'utf8'));
      if (old && old.version===1 && old.rows && typeof old.rows==='object' && !Array.isArray(old.rows)) {
        for (const [key,row] of Object.entries(old.rows)) {
          if (/^[0-9a-f]{16}$/.test(key) && row && typeof row==='object') this.rows[key]=row;
        }
      }
    } catch(e) {if (e.code!=='ENOENT') throw Error('Estado da fila ilegivel: '+e.message);}
  }
  persist() {
    fs.mkdirSync(path.dirname(this.file),{recursive:true});
    const tmp=this.file+'.tmp';
    fs.writeFileSync(tmp,JSON.stringify({version:1,rows:this.rows}),{mode:0o600});
    fs.renameSync(tmp,this.file);
  }
  add(sig) {
    if (!sig || !/^[0-9a-f]{16}$/.test(sig.key) || this.rows[sig.key]) return false;
    this.rows[sig.key]={...sig,status:'pending'};
    this.persist();return true;
  }
  expire() {
    const now=this.clock();let changed=false;
    for(const r of Object.values(this.rows))if(r.status==='pending' &&
      (now-r.createdAt>120000 || now-r.candleClosedAt>Math.min(FRAMES[r.tf]+90000,390000))) {
       r.status='expired';r.updatedAt=now;changed=true;
    }
    if(changed)this.persist();
  }
  next() {
    this.expire();
    return Object.values(this.rows).filter(r=>r.status==='pending')
      .sort((a,b)=>a.createdAt-b.createdAt)[0]||null;
  }
  ack(key, status, code='') {
    const r=this.rows[key];
    if(!r || r.status!=='pending' || !['executed','rejected','already'].includes(status)) return false;
    r.status=status;r.code=String(code).replace(/[\r\n|]/g,'').slice(0,70);
    r.updatedAt=this.clock();this.persist();return true;
  }
  summary() {
    this.expire();const rows=Object.values(this.rows);
    const counts={pending:0,executed:0,rejected:0,already:0,expired:0};
    for(const r of rows)if(counts[r.status]!==undefined)counts[r.status]++;
    return {counts,total:rows.length};
  }
}
