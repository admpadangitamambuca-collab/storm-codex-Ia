/* Storm Códex IA · extensão original de técnicas públicas para o Turbo.
 * Usa somente OHLC fechado. Não contém código interno de plataformas externas.
 * O score adicional é heurístico (±4), NÃO é probabilidade estatística.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 root.StormTurboPublicMethods=api;
})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 function validBars(bars){
  if(!Array.isArray(bars)||bars.length<55)return false;
  const b=bars.slice(-160);
  for(let i=0;i<b.length;i++){
   const c=b[i];if(!c||![c.open,c.high,c.low,c.close,c.t].every(finite)||
    c.t<=0||c.high<Math.max(c.open,c.close)||c.low>Math.min(c.open,c.close)||
    c.high<c.low||(i&&c.t<=b[i-1].t))return false;
  }
  return true;
 }
 function ema(a,n){let e=a[0],k=2/(n+1);return a.map((v,i)=>(e=i?e+(v-e)*k:v))}
 function rsi(a,p=14){
  if(a.length<p+2)return null;
  let u=0,d=0;
  for(let i=1;i<=p;i++){let v=a[i]-a[i-1];u+=Math.max(0,v);d+=Math.max(0,-v)}
  u/=p;d/=p;
  for(let i=p+1;i<a.length;i++){let v=a[i]-a[i-1];u=(u*(p-1)+Math.max(0,v))/p;d=(d*(p-1)+Math.max(0,-v))/p}
  return !u&&!d?50:!d?100:100-100/(1+u/d);
 }
 function macd(a){
  if(a.length<35)return null;
  const x=ema(a,12),y=ema(a,26),line=x.map((v,i)=>v-y[i]),signal=ema(line,9);
  return {hist:line.at(-1)-signal.at(-1),previous:line.at(-2)-signal.at(-2)};
 }
 function bollinger(a){
  if(a.length<20)return null;
  const x=a.slice(-20),avg=x.reduce((s,v)=>s+v,0)/20;
  const sd=Math.sqrt(x.reduce((s,v)=>s+(v-avg)**2,0)/20);
  return sd>0?{z:(a.at(-1)-avg)/sd,upper:avg+2*sd,lower:avg-2*sd}:null;
 }
 function atr(b){
  if(b.length<16)return null;let sum=0;
  for(let i=b.length-14;i<b.length;i++){
   const c=b[i],p=b[i-1];sum+=Math.max(c.high-c.low,Math.abs(c.high-p.close),Math.abs(c.low-p.close));
  }
  return sum/14;
 }
 function wyckoff(b,a){
  const base=b.slice(-28,-2),trigger=b.at(-2),confirmation=b.at(-1);
  if(base.length<20||!finite(a)||a<=0)return {kind:'Dados insuficientes',side:null};
  const hi=Math.max(...base.map(x=>x.high)),lo=Math.min(...base.map(x=>x.low));
  if(trigger.low<lo-.08*a&&trigger.close>lo&&confirmation.close>trigger.close&&confirmation.close>confirmation.open&&confirmation.close>lo)
   return {kind:'Spring confirmado por 2 candles (aproximação)',side:'buy'};
  if(trigger.high>hi+.08*a&&trigger.close<hi&&confirmation.close<trigger.close&&confirmation.close<confirmation.open&&confirmation.close<hi)
   return {kind:'Upthrust confirmado por 2 candles (aproximação)',side:'sell'};
  return {kind:'Não confirmado',side:null};
 }
 function pivots(b){
  const seq=[];
  for(let i=Math.max(2,b.length-120);i<b.length-2;i++){
   const l=b.slice(i-2,i),r=b.slice(i+1,i+3),c=b[i];
   if(l.length<2||r.length<2)continue;
   const h=[...l,...r].every(x=>c.high>x.high),low=[...l,...r].every(x=>c.low<x.low);
   const kind=h?'high':low?'low':null;
   if(!kind)continue;
   const p={i,kind,price:kind==='high'?c.high:c.low},prev=seq.at(-1);
   if(prev?.kind===kind){
    if((kind==='high'&&p.price>prev.price)||(kind==='low'&&p.price<prev.price))seq[seq.length-1]=p;
   }else seq.push(p);
  }
  return seq;
 }
 function harmonic(b,a){
  const seq=pivots(b);if(seq.length<5||!finite(a)||a<=0)return null;
  const [X,A,B,C,D]=seq.slice(-5);
  const xa=Math.abs(A.price-X.price),ab=Math.abs(B.price-A.price),bc=Math.abs(C.price-B.price),cd=Math.abs(D.price-C.price);
  if(xa<a*1.5||ab<a*.5||bc<a*.25||cd<a*.5)return null;
  const br=ab/xa,cr=bc/ab,dr=Math.abs(D.price-A.price)/xa,er=cd/bc;
  if(Math.abs(b.at(-1).close-D.price)>=a*2||cr<.36||cr>.9)return null;
  let type=null;
  if(br>=.56&&br<=.68&&dr>=.73&&dr<=.84&&er>=1.2&&er<=1.85)type='Gartley aproximado';
  else if(br>=.33&&br<=.55&&dr>=.83&&dr<=.94&&er>=1.5&&er<=2.7)type='Bat aproximado';
  return type?{type,side:D.kind==='low'?'buy':'sell',ratios:{B:br,C:cr,D:dr,CD:er}}:null;
 }
 function vwap(b){
  const x=b.slice(-40);if(x.length<25)return null;let weighted=0,total=0;
  for(const c of x){
   const volume=finite(c.volume)?c.volume:finite(c.v)?c.v:null;
   if(!finite(volume)||volume<=0)return null;
   weighted+=((c.high+c.low+c.close)/3)*volume;total+=volume;
  }
  return total>0?weighted/total:null;
 }
 function session(b){
  const groups=new Map();
  for(const c of b.slice(-1000)){
   if(!finite(c.t)||c.open<=0)continue;
   const dt=new Date(c.t),hour=dt.getUTCHours(),day=dt.toISOString().slice(0,10);
   if(!groups.has(hour))groups.set(hour,{count:0,days:new Set(),range:0});
   const g=groups.get(hour);g.count++;g.days.add(day);g.range+=(c.high-c.low)/c.open;
  }
  const h=new Date(b.at(-1).t).getUTCHours(),active=groups.get(h);
  const good=[...groups.values()].filter(g=>g.count>=8&&g.days.size>=2);
  if(!active||active.count<8||active.days.size<2||good.length<4)return {supported:false,text:'Amostra por hora insuficiente'};
  const average=good.reduce((s,g)=>s+g.range/g.count,0)/good.length;
  const ratio=(active.range/active.count)/(average||1);
  return {supported:true,ratio,hour:h,text:'Hora '+String(h).padStart(2,'0')+' UTC · volatilidade '+ratio.toFixed(2)+'× média observada ('+active.count+' velas)'};
 }
 function inspect(bars,side){
  if(!validBars(bars))return {ready:false,delta:0,reason:'Pelo menos 55 velas OHLC válidas e cronológicas'};
  const b=bars.slice(-1000),closes=b.map(x=>x.close),m=macd(closes),r=rsi(closes),bb=bollinger(closes),a=atr(b),
   wy=wyckoff(b,a),harm=harmonic(b,a),vw=vwap(b),sess=session(b),direction=side==='buy'?1:side==='sell'?-1:0;
  let delta=0;
  if(direction&&m)delta+=direction*m.hist>0&&direction*(m.hist-m.previous)>=0?1:direction*m.hist<0?-1:0;
  if(direction&&finite(r))delta+=(direction===1?r>=47&&r<=69:r>=31&&r<=53)?1:(direction===1?r>77:r<23)?-1:0;
  if(direction&&wy.side)delta+=wy.side===side?2:-2;
  if(direction&&harm)delta+=harm.side===side?2:-2;
  if(direction&&finite(vw))delta+=direction*(closes.at(-1)-vw)>=0?1:-1;
  if(direction&&bb&&direction*bb.z>2.4)delta--;
  return {ready:true,delta:clamp(delta,-4,4),rsi:r,macd:m,bollinger:bb,wyckoff:wy,harmonic:harm,vwap:vw,session:sess,
    reason:'Heurística complementar, sem validação estatística de acerto'};
 }
 return {version:'turbo-public-methods-20261111',validBars,inspect,rsi,macd,bollinger,wyckoff,harmonic,vwap,session};
});