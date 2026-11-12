/* Storm Códex IA 11.3 — cotação brapi EOD + diagnóstico WIN/WDO.
   Um fechamento diário nunca autoriza leitura técnica intradiária. */
(function(root,factory){const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.StormB3Quote113=api;
})(typeof window!=='undefined'?window:globalThis,function(root){'use strict';
 const FORMAT='pt-BR',CODE=/^(WIN|WDO)[FGHJKMNQUVXZ]\d{2}$/;
 const url='https://brapi.dev/api/v2/futures/quote?symbols=';
 function verify(x,symbol){
  if(!CODE.test(symbol)||x?.symbol!==symbol||x?.asset!==symbol.slice(0,3)||x?.feedVerified!==true)
   throw Error('Ticker divergente; cotação rejeitada');
  if(x.isIntraday!==false||x.allowIntradaySignals!==false)throw Error('Resposta sem classificação EOD');
  if(!Number.isFinite(x.price)||x.price<=0||!Number.isFinite(x.quotedAt)||x.quotedAt<1500000000000||x.quotedAt>Date.now()+86400000)
   throw Error('Sem valor/data do último pregão verificável');
  return x;
 }
 function decodeDirect(data,symbol){
  const q=data?.quotes?.find(x=>String(x.symbol||'').toUpperCase()===symbol);
  if(!q)throw Error('Contrato não encontrado na lista brapi');
  const price=Number(q.close)>0&&q.close!==null?Number(q.close):Number(q.settlement)>0&&q.settlement!==null?Number(q.settlement):NaN;
  const date=Number(q.date);return verify({asset:symbol.slice(0,3),symbol,price,
   quotedAt:date<1e11?date*1000:date,priceKind:q.close===null?'Ajuste':'Fechamento',
   source:'brapi.dev · último pregão',feedVerified:true,isIntraday:false,allowIntradaySignals:false},symbol);
 }
 async function get(url){
  const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),8500);
  try{const r=await root.fetch(url,{cache:'no-store',signal:ctl.signal,credentials:'omit',headers:{Accept:'application/json'}});
   if(!r.ok)throw Error('HTTP '+r.status);return await r.json();
  }finally{clearTimeout(timer)}
 }
 async function load(symbol){
  if(!CODE.test(symbol))throw Error('Contrato WIN/WDO inválido');
  let errors=[];
  try{return verify(await get('/.netlify/functions/b3-quote?symbol='+symbol),symbol)}catch(e){errors.push('Netlify: '+e.message)}
  try{return decodeDirect(await get(url+symbol),symbol)}catch(e){errors.push('Brapi: '+e.message)}
  const curve='https://brapi.dev/api/v2/futures/term-structure?asset='+symbol.slice(0,3);
  try{return {...decodeDirect({quotes:(await get(curve))?.contracts},symbol),source:'brapi.dev curva de vencimentos · EOD'}}
  catch(e){errors.push('Curva EOD: '+e.message)}
  try{return {...decodeDirect(await get('https://proxy.cors.dev/'+url+symbol),symbol),source:'brapi.dev via proxy cors.dev (terceiros)'}}
  catch(e){errors.push('Proxy: '+e.message)}
  throw Error(errors.join(' | ').slice(0,300));
 }
 let last=null,assetStamp='',busy=false,lastCheck=0;
 const fmt=x=>Number(x).toLocaleString(FORMAT,{minimumFractionDigits:0,maximumFractionDigits:2});
 const date=x=>new Date(x).toLocaleDateString(FORMAT,{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric'});
 const d=()=>root.document;
 const by=id=>d()?.getElementById(id);
 const symbol=asset=>root.StormB3Indices111?.contractFor?.(asset)?.symbol||null;
 function addPanel(){
  if(!d()||by('stormB3QuotePane'))return;
  const feed=by('stormIndexFeed');if(!feed)return;
  const panel=d().createElement('section');panel.id='stormB3QuotePane';
  panel.setAttribute('aria-label','Minicontratos B3: cotação e estado do feed');
  panel.innerHTML='<div class="storm-b3-eod-head"><div><small>WIN / WDO · REFERÊNCIA B3</small><strong id="stormB3QuotePrice">—</strong><span id="stormB3QuoteWhen">Consultando último pregão</span></div><div><small>CONTRATO VIGENTE</small><strong id="stormB3QuoteSymbol">—</strong><span id="stormB3QuoteSource">brapi.dev sem login</span></div></div>'+
  '<p class="storm-b3-quote-status" id="stormB3QuoteDiagnostic" role="status" aria-live="polite">Verificando disponibilidade…</p>'+
  '<div class="storm-b3-eod-actions"><button id="stormB3QuoteReload" type="button">↻ Atualizar preço</button><a id="stormB3QuoteChart" href="https://br.tradingview.com/" target="_blank" rel="noopener noreferrer">Ver gráfico WIN/WDO no TradingView</a></div>'+
  '<p class="storm-b3-quote-foot">Fechamento/ajuste diário não é tempo real. O gráfico público pode ter 15 minutos de atraso. A geração de sinais intradiários exige candles M1/M5/M15/H1 reais e atuais do contrato exato.</p>';
  feed.before(panel);
  by('stormB3QuoteReload')?.addEventListener('click',()=>refresh(true));
 }
 function display(){
  const asset=by('assetSelect')?.value,el=by('stormB3QuotePane');if(!el)return;
  const isB3=asset==='WIN'||asset==='WDO';el.hidden=!isB3;
  if(!isB3)return;
  const contract=symbol(asset),set=(id,text)=>{const n=by(id);if(n)n.textContent=text;};
  set('stormB3QuoteSymbol',contract||asset);
  const link=by('stormB3QuoteChart');if(link)link.href='https://br.tradingview.com/symbols/BMFBOVESPA-'+asset+'1%21/';
  if(last?.symbol===contract){
   set('stormB3QuotePrice',fmt(last.price)+' pts');
   set('stormB3QuoteWhen',last.priceKind+' · '+date(last.quotedAt));
   set('stormB3QuoteSource',last.source||'brapi.dev');
   set('stormB3QuoteDiagnostic','Último fechamento validado; não é preço ao vivo. Sem OHLC M1/M5/M15/H1 recente, os sinais permanecem em AGUARDAR.');
  }else{set('stormB3QuotePrice','—');set('stormB3QuoteWhen','Último preço ainda não validado');}
 }
 async function refresh(force=false){
  const asset=by('assetSelect')?.value;if(asset!=='WIN'&&asset!=='WDO'){display();return}
  const contract=symbol(asset);display();
  if(!CODE.test(contract||'')||busy)return;
  if(!force&&assetStamp===contract&&Date.now()-lastCheck<180000)return;
  busy=true;assetStamp=contract;lastCheck=Date.now();
  try{last=await load(contract);if(symbol(asset)===contract)display();}
  catch(e){last=null;display();const t=by('stormB3QuoteDiagnostic');if(t)t.textContent='Último fechamento indisponível: '+String(e?.message||e).slice(0,230)+'. O status intradiário é independente.'}
  finally{busy=false}
 }
 function init(){
  addPanel();if(!by('stormB3QuotePane'))return;
  by('assetSelect')?.addEventListener('change',()=>{display();refresh()});
  by('stormIndexRefresh')?.addEventListener('click',()=>refresh(true));
  d().addEventListener('visibilitychange',()=>{if(!d().hidden)refresh()});
  root.addEventListener?.('focus',()=>refresh());
  root.setInterval?.(()=>{if(!d().hidden)refresh()},180000);
  display();refresh();
 }
 if(root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',()=>root.setTimeout?.(init,100),{once:true});
  else root.setTimeout?.(init,100);
 }
 return Object.freeze({version:'11.3',verify,decodeDirect,load});
});
