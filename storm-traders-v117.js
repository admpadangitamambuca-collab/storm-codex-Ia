/* Storm Codex IA 11.7 - External Traders Intelligence.
   Separates external, manually imported trade setups from proprietary engine readings.
   No private endpoint scraping, fabricated provider trades, broker execution or paywall bypass. */
(function(root,factory){
 'use strict';
 var api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.StormTraders117=api;
 if(root&&root.document){
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',api.init,{once:true});
  else api.init();
 }
})(typeof window!=='undefined'?window:globalThis,function(root){
 'use strict';
 var KEY='storm_traders_imports_v117';
 var ASSETS=['XAUUSD','EURUSD','USDJPY','AUDUSD','BTCUSD','BTCUSDT','USDCAD','USDCHF','NASDAQ','SP500'];
 var TFMS={M1:60000,M5:300000,M15:900000,H1:3600000};
 var rows=[],open=false,ready=false;
 var $=function(id){return root.document&&root.document.getElementById(id);};
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function number(v){
  if(typeof v==='number')return Number.isFinite(v)?v:NaN;
  var s=String(v==null?'':v).trim().replace(/[\s$]/g,'');
  if(s.includes(',')&&s.includes('.'))s=s.lastIndexOf(',')>s.lastIndexOf('.')?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(s.includes(','))s=s.replace(',','.');
  return s&&/^\d+(?:\.\d+)?$/.test(s)?Number(s):NaN;
 }
 function httpsUrl(value){
  try{var u=new URL(String(value||''));return u.protocol==='https:'||u.protocol==='http:'?u.toString():'';}catch(e){return '';}
 }
 function normalizeSide(s){
  s=String(s||'').toUpperCase().trim();
  if(/^(BUY|COMPRA|LONG)$/.test(s))return 'buy';
  if(/^(SELL|VENDA|SHORT)$/.test(s))return 'sell';
  return '';
 }
 function normalizeAsset(s){
  s=String(s||'').trim().toUpperCase().replace(/[\s/]/g,'');
  if(s==='GOLD'||s==='OURO'||s==='XAU')return 'XAUUSD';
  if(s==='NAS100'||s==='US100'||s==='NDX')return 'NASDAQ';
  if(s==='SPX'||s==='US500')return 'SP500';
  return ASSETS.includes(s)?s:'';
 }
 function parseSignal(input){
  var text=String(input||'').slice(0,6000),upper=text.toUpperCase().replace(/\u00a0/g,' ');
  var m=upper.match(/\b(XAU\s*\/?\s*USD|XAUUSD|GOLD|OURO|EUR\s*\/?\s*USD|EURUSD|USDJPY|AUDUSD|BTCUSDT|BTCUSD|USDCAD|USDCHF|NAS100|NASDAQ|SP500|US500)\b/);
  var asset=m?normalizeAsset(m[1]):'';
  var sd=upper.match(/\b(BUY|COMPRA|LONG|SELL|VENDA|SHORT)\b/);
  var side=sd?normalizeSide(sd[1]):'';
  var num='(\d[\d.,]*)';
  function capture(re){var hit=upper.match(re);return hit?number(hit[1]):NaN;}
  var entry=capture(new RegExp('(?:ENTRY|ENTRADA|PRICE|PREÇO|PRECO|@)\\s*[:=\\-]?\\s*'+num,'i'));
  if(!Number.isFinite(entry))entry=capture(new RegExp('\\b(?:BUY|COMPRA|LONG|SELL|VENDA|SHORT)\\b\\s*[:@\\-]?\\s*'+num,'i'));
  var stop=capture(new RegExp('\\b(?:SL|STOP\\s*LOSS|STOP)\\b\\s*[:=@\\-]?\\s*'+num,'i'));
  var targets=[];
  ['TP1','TP2','TP3'].forEach(function(label){
   var p=capture(new RegExp('\\b'+label+'\\b\\s*[:=@\\-]?\\s*'+num,'i'));
   if(Number.isFinite(p))targets.push(p);
  });
  if(!targets.length){
   var simple=capture(new RegExp('\\b(?:TP|TAKE\\s*PROFIT|ALVO)\\b\\s*[:=@\\-]?\\s*'+num,'i'));
   if(Number.isFinite(simple))targets.push(simple);
  }
  var range=/\b(?:ENTRY|ENTRADA|BUY|SELL|COMPRA|VENDA)\s*[:@]?\s*\d[\d.,]*\s*[-–]\s*\d[\d.,]*/i.test(upper);
  return {asset:asset,side:side,entry:Number.isFinite(entry)?entry:null,
   stop:Number.isFinite(stop)?stop:null,targets:targets.slice(0,3),
   ambiguousRange:range,complete:!!(asset&&side&&Number.isFinite(entry)&&Number.isFinite(stop)&&targets.length&&!range)};
 }
 function validate(raw){
  var x=raw||{},side=normalizeSide(x.side),asset=normalizeAsset(x.asset);
  var entry=number(x.entry),stop=number(x.stop),target=number(x.tp1);
  var trader=String(x.trader||'').trim().slice(0,90),source=String(x.source||'').trim();
  var url=String(x.url||'').trim(),publishedAt=String(x.publishedAt||'').trim();
  if(!trader||trader.length<2)return {error:'Informe o nome do trader ou estratégia de origem.'};
  if(!asset||!side)return {error:'Informe um ativo e uma direção válidos.'};
  if(![entry,stop,target].every(Number.isFinite)||Math.min(entry,stop,target)<=0)
   return {error:'Entrada, stop e primeiro alvo devem ser preços numéricos positivos.'};
  var dir=side==='buy'?1:-1;
  if(dir*(entry-stop)<=0)return {error:'O stop precisa ficar do lado contrário à entrada.'};
  if(dir*(target-entry)<=0)return {error:'O primeiro alvo precisa ficar na direção da operação.'};
  var r=(target-entry)*dir/Math.abs(entry-stop);
  if(!Number.isFinite(r)||r<=0)return {error:'Risco/retorno inválido.'};
  var targets=[target];
  ['tp2','tp3'].forEach(function(k){if(String(x[k]||'').trim()){var p=number(x[k]);if(Number.isFinite(p)&&dir*(p-entry)>0)targets.push(p);}});
  if(url&&!httpsUrl(url))return {error:'O link da fonte deve começar com https:// ou http://.'};
  var published=publishedAt?Date.parse(publishedAt):null;
  if(publishedAt&&(!Number.isFinite(published)||published>Date.now()+60000))return {error:'Horário de publicação inválido ou no futuro.'};
  var record={id:String(Date.now())+'-'+Math.random().toString(36).slice(2,9),trader:trader,source:source||'Outra fonte',
   url:httpsUrl(url),asset:asset,side:side,entry:entry,stop:stop,targets:targets,
   rr:Number(r.toFixed(2)),publishedAt:published,importedAt:Date.now(),
   origin:'user_import',verification:'nao_auditado',status:'observacao'};
  return {record:record};
 }
 function load(){
  try{var saved=JSON.parse(root.localStorage.getItem(KEY)||'[]');return Array.isArray(saved)?saved.filter(function(s){
    return s&&s.origin==='user_import'&&s.verification==='nao_auditado'&&ASSETS.includes(s.asset)&&normalizeSide(s.side)&&Number.isFinite(s.entry);
   }).slice(0,200):[];}catch(e){return [];}
 }
 function persist(){
  try{root.localStorage.setItem(KEY,JSON.stringify(rows.slice(0,200)));return true;}
  catch(e){setMessage('Falha ao salvar no navegador. Verifique o armazenamento local.',true);return false;}
 }
 function snapshot(){
  try{return root.Vortex83Bridge&&root.Vortex83Bridge.read?root.Vortex83Bridge.read():null;}catch(e){return null;}
 }
 function engineComparison(record,snap,turbo,now){
  var result={classic:'SEM LEITURA',turbo:'SEM LEITURA',status:'SEM COMPARAÇÃO',score:null,reason:'Sem validação de mercado recente.'};
  if(!record||!snap||snap.asset!==record.asset)return Object.assign(result,{reason:'Selecione '+(record&&record.asset||'o ativo')+' no painel principal para comparar.'});
  var tf=TFMS[snap.tf]?snap.tf:'M5',ms=TFMS[tf],state=snap.state||{};
  var recent=state.mode==='live'&&!state.providerStale&&!snap.lagging&&Number.isFinite(state.closedAt)&&
    (now||Date.now())>=state.closedAt&&(now||Date.now())-state.closedAt<=ms+90000;
  if(!recent)return Object.assign(result,{status:'OHLC ATRASADO',reason:'Candles não estão recentes/validados. Não autoriza entrada.'});
  var classical=state.classicAnalysis||state.analysis||{};
  var classicSide=normalizeSide(classical.side);
  var turboPlan=turbo&&turbo.data&&turbo.data.asset===record.asset&&turbo.data.tf===tf?turbo.plan:null;
  var turboFresh=turboPlan&&turboPlan.hasData&&Number.isFinite(turboPlan.closedAt)&&
    Math.abs(turboPlan.closedAt-state.closedAt)<1000;
  var turboSide=turboFresh?normalizeSide(turboPlan.side):'';
  result.classic=classicSide?(classicSide===record.side?'ALINHADO':'CONTRÁRIO'):'AGUARDAR';
  result.turbo=turboSide?(turboSide===record.side?'ALINHADO':'CONTRÁRIO'):'SEM TURBO RECENTE';
  result.score=Number.isFinite(turboPlan&&turboPlan.score)&&turboFresh?turboPlan.score:null;
  var aligned=[classicSide,turboSide].filter(function(s){return s&&s===record.side;}).length;
  var contrary=[classicSide,turboSide].filter(function(s){return s&&s!==record.side;}).length;
  result.status=contrary?'DIVERGÊNCIA':aligned===2?'CONFLUÊNCIA 2/2':aligned===1?'CONFLUÊNCIA 1/2':'SEM CONFIRMAÇÃO';
  result.reason='Comparação técnica, não auditoria do sinal externo. '+tf+' fechado; a nota dos motores não é probabilidade.';
  return result;
 }
 function setMessage(s,bad){var el=$('stormTradersMessage');if(el){el.textContent=s;el.dataset.bad=bad?'1':'0';}}
 function fillParsed(){
  var x=parseSignal($('stormTradersPaste').value),ids={asset:'stormTAsset',side:'stormTSide',entry:'stormTEntry',
   stop:'stormTStop',tp1:'stormTTP1',tp2:'stormTTP2',tp3:'stormTTP3'};
  Object.keys(ids).forEach(function(k){if(x[k]!=null&&x[k]!=='')$(ids[k]).value=x[k];});
  if(x.targets.length){$('stormTTP1').value=x.targets[0];$('stormTTP2').value=x.targets[1]||'';$('stormTTP3').value=x.targets[2]||'';}
  setMessage(x.ambiguousRange?'Faixa de entrada identificada: escolha manualmente o preço exato. Não foi importado nenhum sinal.':
    x.complete?'Campos identificados. Revise preços, horário e fonte antes de importar.':
    'Preenchimento parcial. Complete os campos antes de importar.',!x.complete);
 }
 function importOne(){
  var x=validate({trader:$('stormTTrader').value,source:$('stormTSource').value,asset:$('stormTAsset').value,
   side:$('stormTSide').value,entry:$('stormTEntry').value,stop:$('stormTStop').value,
   tp1:$('stormTTP1').value,tp2:$('stormTTP2').value,tp3:$('stormTTP3').value,
   url:$('stormTUrl').value,publishedAt:$('stormTPublished').value});
  if(x.error){setMessage(x.error,true);return;}
  var r=x.record;
  var duplicate=rows.some(function(i){return i.trader.toLowerCase()===r.trader.toLowerCase()&&i.asset===r.asset&&
    i.side===r.side&&i.entry===r.entry&&i.stop===r.stop&&i.targets[0]===r.targets[0]&&
    Math.abs((i.publishedAt||i.importedAt)-(r.publishedAt||r.importedAt))<3600000;});
  if(duplicate){setMessage('Sinal semelhante já importado há menos de uma hora.',true);return;}
  rows.unshift(r);rows=rows.slice(0,200);persist();setMessage('Sinal registrado localmente. Origem não auditada — confira no provedor antes de operar.',false);
  $('stormTPaste').value='';$('stormTEntry').value='';$('stormTStop').value='';
  $('stormTTP1').value='';$('stormTTP2').value='';$('stormTTP3').value='';
  paint();
 }
 function fmt(n){return Number(n).toLocaleString('pt-BR',{maximumFractionDigits:5});}
 function when(t){return Number.isFinite(t)?new Date(t).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Não informado';}
 function activeComparison(item){
  var bridge=snapshot(),turbo=null;try{turbo=root.Vortex83Turbo&&root.Vortex83Turbo.current?root.Vortex83Turbo.current():null;}catch(e){}
  return engineComparison(item,bridge,turbo,Date.now());
 }
 function paint(){
  if(!$('stormTradersPane'))return;
  $('stormTCount').textContent=String(rows.length);
  $('stormTGold').textContent=String(rows.filter(function(r){return r.asset==='XAUUSD';}).length);
  $('stormTSourceStatus').textContent='Sem API oficial conectada · '+rows.length+' sinal(is) importado(s) pelo usuário';
  var list=$('stormTradersCards'),filter=$('stormTFilter').value;
  var visible=rows.filter(function(r){return filter==='ALL'||r.asset===filter;});
  if(!visible.length){list.innerHTML='<div class="st-empty"><strong>Nenhum sinal externo importado</strong><span>Abra a arena, confira um sinal ao qual você tem acesso e importe os seus dados. A aba nunca inventa entradas de traders.</span></div>';return;}
  list.innerHTML=visible.map(function(r){
   var c=activeComparison(r),level=c.status==='CONFLUÊNCIA 2/2'?'match':c.status==='DIVERGÊNCIA'||c.status==='OHLC ATRASADO'?'danger':'neutral';
   var side=r.side==='buy'?'COMPRA':'VENDA';
   var url=r.url?'<a class="st-link" target="_blank" rel="noopener noreferrer" href="'+esc(httpsUrl(r.url))+'">Conferir origem ↗</a>':'<span class="st-muted">Sem link de origem</span>';
   return '<article class="st-card" data-record="'+esc(r.id)+'"><div class="st-card-head"><div><small>'+esc(r.source)+' · IMPORTADO MANUALMENTE</small><h3>'+esc(r.trader)+'</h3></div><span class="st-side '+r.side+'">'+side+'</span></div>'+
    '<div class="st-card-meta">'+esc(r.asset)+' · Publicado: '+esc(when(r.publishedAt))+' · Importado: '+esc(when(r.importedAt))+'</div>'+
    '<div class="st-levels"><div><small>ENTRADA</small><b>'+fmt(r.entry)+'</b></div><div><small>STOP</small><b>'+fmt(r.stop)+'</b></div><div><small>TP1</small><b>'+fmt(r.targets[0])+'</b></div><div><small>R/R TEÓRICO</small><b>1:'+fmt(r.rr)+'</b></div></div>'+
    '<div class="st-compare"><span class="st-state '+level+'">'+esc(c.status)+'</span><span>Clássico: '+esc(c.classic)+' · Turbo: '+esc(c.turbo)+(c.score!==null?' ('+fmt(c.score)+'/100)':'')+'</span></div>'+
    '<p class="st-reason">'+esc(c.reason)+'</p><div class="st-card-foot">'+url+'<span>Não auditado · sem execução automática</span><button type="button" data-delete="'+esc(r.id)+'" class="st-remove">Excluir</button></div></article>';
  }).join('');
 }
 function toggle(force){
  var next=typeof force==='boolean'?force:!open,btn=$('stormTradersBtn');if(!btn)return;
  if(next){
   ['stormIndicesBtn','stormCopyBtn','v83TurboBtn'].forEach(function(id){
    var other=$(id);if(other&&other.getAttribute('aria-pressed')==='true')other.click();
   });
  }
  open=next;root.document.body.classList.toggle('storm-traders-on',open);
  btn.setAttribute('aria-pressed',String(open));btn.setAttribute('aria-expanded',String(open));
  $('stormTradersPane').hidden=!open;if(open){paint();$('stormTradersPane').scrollIntoView({block:'start',behavior:'smooth'});}
 }
 function exportCsv(){
  var cols=['trader','source','url','asset','side','entry','stop','tp1','tp2','tp3','rr','publishedAt','importedAt','verification'];
  var content=[cols.join(';')].concat(rows.map(function(r){return cols.map(function(k){
    var val=k==='tp1'?r.targets[0]:k==='tp2'?r.targets[1]:k==='tp3'?r.targets[2]:r[k];
    return '"'+String(val==null?'':val).replace(/"/g,'""')+'"';
   }).join(';');})).join('\r\n');
  var blob=new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=root.document.createElement('a');
  a.href=url;a.download='storm-traders-sinais-importados.csv';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);
 }
 function init(){
  if(ready||!root.document)return;
  var bar=root.document.querySelector('.header-right'),header=root.document.querySelector('.shell>.header');
  if(!bar||!header)return;
  ready=true;rows=load();
  var btn=root.document.createElement('button');btn.id='stormTradersBtn';btn.type='button';btn.className='btn tiny';
  btn.setAttribute('aria-pressed','false');btn.setAttribute('aria-expanded','false');btn.setAttribute('aria-controls','stormTradersPane');
  btn.innerHTML='<span aria-hidden="true" class="st-nav-icon">♧</span><span>Traders</span>';
  ( $('stormIndicesBtn')||$('stormCopyBtn')||$('v83TurboBtn')||bar.lastElementChild).after(btn);
  var pane=root.document.createElement('section');pane.id='stormTradersPane';pane.className='st-panel';pane.hidden=true;
  pane.setAttribute('aria-label','Sinais externos, validação técnica e comparação independente dos motores');
  pane.innerHTML='<div class="st-hero"><div class="st-hero-title"><div class="st-emblem" aria-hidden="true">♧</div><div><small>STORM CÓDEX IA · DESK DE SINAIS EXTERNOS</small><h2>Traders <span>Intelligence</span></h2><p>Observe estratégias externas e compare com o Clássico Precision e o Turbo. Sinais de terceiros não são gerados pelos nossos motores.</p></div></div><span id="stormTSourceStatus" class="st-origin">Sem API oficial conectada</span></div>'+
   '<div class="st-kpis"><div><small>SINAIS IMPORTADOS</small><strong id="stormTCount">0</strong></div><div><small>OURO · XAUUSD</small><strong id="stormTGold">0</strong></div><div><small>ORIGEM</small><strong>MANUAL</strong></div></div>'+
   '<section class="st-provider"><div><span class="st-provider-kicker">FONTE EXTERNA · TRADERS IA</span><h3>Global Traders Hub</h3><p>O site publica uma arena/ranking e oferece sinais mediante desbloqueio. Não existe integração oficial de API comprovada nesta versão; nenhuma operação ou estatística do provedor é reproduzida automaticamente.</p></div><div class="st-provider-actions"><a href="https://hubglobaltraders.com/arena" target="_blank" rel="noopener noreferrer">Ver arena ↗</a><a href="https://hubglobaltraders.com/traders" target="_blank" rel="noopener noreferrer">Meus Traders ↗</a></div></section>'+
   '<div class="st-columns"><section class="st-editor"><div class="st-section-title"><div><small>01 / ADICIONAR SETUP EXTERNO</small><h3>Importar sinal autorizado</h3></div><span class="st-status-chip">Sem execução real</span></div>'+
   '<p class="st-hint">Copie de um sinal ao qual você tenha acesso. A interpretação automática apenas preenche os campos; confirme todos os números.</p>'+
   '<label for="stormTradersPaste">Texto do sinal (opcional)</label><textarea id="stormTradersPaste" rows="4" placeholder="XAUUSD BUY 4200&#10;SL 4195&#10;TP1 4210&#10;TP2 4215"></textarea><button type="button" class="st-ghost" id="stormTParse">Identificar campos no texto</button>'+
   '<form id="stormTForm" novalidate><div class="st-form-grid"><label>Trader/estratégia<input id="stormTTrader" maxlength="90" placeholder="Nome do provedor" required></label>'+
   '<label>Origem<select id="stormTSource"><option>Global Traders Hub</option><option>TradingView</option><option>Telegram público</option><option>Outra fonte</option></select></label>'+
   '<label>Ativo<select id="stormTAsset">'+ASSETS.map(function(a){return '<option value="'+a+'">'+a+'</option>';}).join('')+'</select></label>'+
   '<label>Direção<select id="stormTSide"><option value="buy">COMPRA</option><option value="sell">VENDA</option></select></label>'+
   '<label>Entrada<input id="stormTEntry" inputmode="decimal" placeholder="4200.00" required></label>'+
   '<label>Stop Loss<input id="stormTStop" inputmode="decimal" placeholder="4195.00" required></label>'+
   '<label>Take Profit 1<input id="stormTTP1" inputmode="decimal" placeholder="4210.00" required></label>'+
   '<label>Take Profit 2<input id="stormTTP2" inputmode="decimal" placeholder="opcional"></label>'+
   '<label>Take Profit 3<input id="stormTTP3" inputmode="decimal" placeholder="opcional"></label>'+
   '<label>Publicado em (BRT)<input id="stormTPublished" type="datetime-local"></label></div>'+
   '<label>Link original para conferência<input id="stormTUrl" type="url" placeholder="https://..." autocomplete="off"></label>'+
   '<button type="submit" class="st-primary">＋ Registrar sinal para análise manual</button></form>'+
   '<p class="st-message" role="status" aria-live="polite" id="stormTradersMessage">Atenção: um sinal importado não é validado como desempenho real.</p></section>'+
   '<section class="st-archive"><div class="st-section-title"><div><small>02 / CONFLUÊNCIA INDEPENDENTE</small><h3>Observatório de sinais</h3></div><button type="button" class="st-ghost" id="stormTExport">↓ CSV</button></div>'+
   '<div class="st-filter"><label for="stormTFilter">Filtrar por ativo</label><select id="stormTFilter"><option value="ALL">Todos</option>'+ASSETS.map(function(a){return '<option value="'+a+'">'+a+'</option>';}).join('')+'</select><button type="button" class="st-ghost" id="stormTCompare">↻ Comparar motores</button></div>'+
   '<div class="st-card-list" id="stormTradersCards"></div>'+
   '<p class="st-disclaimer"><b>Regras de integridade:</b> sem acesso a sinais pagos sem autorização; sem inventar resultados, probabilidade, ranking ou cotações. Dados digitados ficam neste navegador. Confluência não garante acerto. No ouro, candles desatualizados bloqueiam a classificação técnica.</p></section></div>';
  header.after(pane);
  btn.addEventListener('click',function(){toggle();});
  ['v83TurboBtn','stormCopyBtn','stormIndicesBtn'].forEach(function(id){$(id)?.addEventListener('click',function(){if(open)toggle(false);});});
  $('stormTParse').addEventListener('click',fillParsed);
  $('stormTForm').addEventListener('submit',function(e){e.preventDefault();importOne();});
  $('stormTExport').addEventListener('click',exportCsv);
  $('stormTCompare').addEventListener('click',paint);
  $('stormTFilter').addEventListener('change',paint);
  $('stormTradersCards').addEventListener('click',function(e){
   var button=e.target.closest('[data-delete]');if(!button)return;
   rows=rows.filter(function(r){return r.id!==button.getAttribute('data-delete');});
   persist();paint();setMessage('Registro local excluído.',false);
  });
  root.addEventListener('vortex83-data',function(){if(open)paint();});
  root.document.querySelectorAll('.tf-btn').forEach(function(b){b.addEventListener('click',function(){if(open)setTimeout(paint,100);});});
  $('assetSelect')?.addEventListener('change',function(){if(open)setTimeout(paint,100);});
  root.setInterval(function(){if(open&&!root.document.hidden)paint();},60000);
  paint();
 }
 return Object.freeze({version:'11.7',parseSignal:parseSignal,validate:validate,engineComparison:engineComparison,init:init});
});
