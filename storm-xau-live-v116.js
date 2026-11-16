/* Storm 11.6: live XAUUSD reference price, independent from OHLC signal engines.
 * Never injects spot reference prices into the market candles or signal entry.
 */
(function(){'use strict';
 const $=id=>document.getElementById(id);let panel=null,inFlight=false,lastTF=null,lastAsset=null;
 const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'USD'});
 const clock=t=>Number.isFinite(t)?new Intl.DateTimeFormat('pt-BR',{
  timeZone:'America/Sao_Paulo',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(t)):'—';
 const age=t=>Number.isFinite(t)?Math.max(0,Math.round(t/60000))+' min':'—';
 const tf=()=>document.querySelector('.tf-btn.active')?.dataset.tf||'M5';
 function mount(){
  if(panel=$('stormXauLive116'))return panel;
  const anchor=document.querySelector('.asset-switch');if(!anchor)return null;
  const style=document.createElement('style');style.id='stormXauStyle116';
  style.textContent='#stormXauLive116{display:none;gap:14px;align-items:center;flex-wrap:wrap;margin:12px 0 17px;padding:16px 18px;border:1px solid #ac8a4b79;border-radius:15px;background:linear-gradient(130deg,#282018 0%,#171b25 50%,#0c181e 100%);box-shadow:0 6px 26px #09090940}'+
  '#stormXauLive116[aria-hidden="false"]{display:flex}#stormXauLive116 .xau-intro{flex:1 1 220px;min-width:180px}'+
  '#stormXauLive116 small{display:block;color:#d2bd98;letter-spacing:.045em;font-weight:750}'+
  '#stormXauLive116 .xau-price{font-weight:850;font-size:clamp(23px,3vw,31px);color:#ffe0a5;font-variant-numeric:tabular-nums}'+
  '#stormXauLive116 .xau-detail{flex:2 1 250px;min-width:180px;color:#c3d2da;font-size:12px;line-height:1.6}'+
  '#stormXauLive116 .xau-detail b{display:block;color:#f4e0bc;font-size:13px}'+
  '#stormXauLive116 button{padding:9px 12px;border:1px solid #8f7444;border-radius:9px;color:#ffe6ad;background:#342719;cursor:pointer;font-weight:750}'+
  '#stormXauLive116 [data-state="OHLC_RECENT"]{color:#80e3bb}#stormXauLive116 [data-state="SPOT_ONLY"]{color:#ffdb8c}'+
  '#stormXauLive116 [data-state="NO_RECENT_DATA"]{color:#ff95a0}';
  document.head.appendChild(style);
  const el=document.createElement('section');el.id='stormXauLive116';
  el.setAttribute('aria-label','Saúde independente do ouro spot e dos candles');el.setAttribute('aria-hidden','true');
  el.innerHTML='<div class="xau-intro"><small>OURO À VISTA · REFERÊNCIA INDEPENDENTE</small><div class="xau-price" id="stormXauPrice116">—</div><small id="stormXauQuoteTime116">Consultando cotação…</small></div>'+
   '<div class="xau-detail"><b id="stormXauStatus116">Verificando candles XAUUSD…</b><span id="stormXauCandle116">Conferindo último candle fechado</span>'+
   '<small>Spot indicativo XAUS.com: não é preço executável nem substitui velas OHLC dos motores.</small></div>'+
   '<button type="button" id="stormXauRefresh116" aria-label="Reconsultar ouro">↻ Atualizar ouro</button>';
  anchor.after(el);panel=el;
  $('stormXauRefresh116')?.addEventListener('click',()=>{lastTF=null;refresh()});
  return panel;
 }
 async function refresh(){
  if(inFlight||!panel)return;
  const asset=$('assetSelect')?.value;panel.setAttribute('aria-hidden',asset==='XAUUSD'?'false':'true');
  if(asset!=='XAUUSD')return;
  inFlight=true;const frame=tf(),btn=$('stormXauRefresh116');btn.disabled=true;
  try{
   const r=await fetch('/.netlify/functions/xau-health?tf='+encodeURIComponent(frame),
    {cache:'no-store',headers:{Accept:'application/json'}});
   if(!r.ok)throw Error('HTTP '+r.status);
   const v=await r.json();if($('assetSelect')?.value!=='XAUUSD')return;
   if(v.spot?.fresh===true&&Number.isFinite(v.spot.price)){
    $('stormXauPrice116').textContent=money.format(v.spot.price);
    $('stormXauQuoteTime116').textContent='Spot às '+clock(v.spot.quotedAt)+' · idade '+age(v.spot.ageMs);
   }else{
    $('stormXauPrice116').textContent='Cotação indisponível';
    $('stormXauQuoteTime116').textContent='Sem spot recente confirmado';
   }
   const status=$('stormXauStatus116');status.dataset.state=v.state||'NO_RECENT_DATA';
   status.textContent=v.ohlc?.fresh===true?'Candles fechados recentes · sinais elegíveis':
    v.spot?.fresh===true?'Preço spot recente; candles da análise atrasados':
    'Sem candle recente: sinais bloqueados';
   const b=v.ohlc||{};
   $('stormXauCandle116').textContent=Number.isFinite(b.closedAt)?
    'Biquote '+frame+' fechado às '+clock(b.closedAt)+' · idade '+age(b.ageMs)+' · '+(b.fresh?'atual':'atrasado'):
    'Biquote não enviou candles XAUUSD verificáveis no '+frame;
   lastTF=frame;
  }catch(e){
   $('stormXauStatus116').dataset.state='NO_RECENT_DATA';
   $('stormXauStatus116').textContent='Diagnóstico de XAUUSD indisponível';
   $('stormXauCandle116').textContent=String(e?.message||e).slice(0,110);
  }finally{inFlight=false;btn.disabled=false}
 }
 function sync(){
  mount();if(!panel)return;
  const asset=$('assetSelect')?.value||'XAUUSD',frame=tf();
  panel.setAttribute('aria-hidden',asset==='XAUUSD'?'false':'true');
  if(asset==='XAUUSD'&&(lastAsset!==asset||lastTF!==frame))refresh();
  lastAsset=asset;
 }
 function init(){
  mount();sync();
  $('assetSelect')?.addEventListener('change',()=>setTimeout(sync,50));
  document.addEventListener('click',e=>{
   if(e.target?.closest?.('.tf-btn')||e.target?.closest?.('#refreshAll')||e.target?.closest?.('#refreshBtn'))
    setTimeout(()=>{lastTF=null;sync()},100);
  });
  setInterval(()=>{if(!document.hidden&&$('assetSelect')?.value==='XAUUSD')refresh()},60000);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
 else init();
})();