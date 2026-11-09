/* Storm Códex IA v10.0: comparativo prospectivo dos dois motores.
 * Apenas ledgers observados; sem backfill e sem probabilidade alegada.
 */
(function(){
'use strict';
const ASSETS=['XAUUSD','EURUSD','USDJPY','AUDUSD','BTCUSD','BTCUSDT','USDCAD','USDCHF','NASDAQ'];
const TFS=['M1','M5','M15','H1'], $=id=>document.getElementById(id);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const fmt=(x,d=2)=>Number.isFinite(x)?x.toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
const pct=x=>Number.isFinite(x)?fmt(x*100,1)+'%':'—';
const multiple=x=>x===Infinity?'∞':Number.isFinite(x)?fmt(x,2)+'×':'—';
const COLS=['Clássico Precision v10','Turbo Equilibrado v10'];
let timer=0,lastData=[];
function getRows(asset,tf){
 const classic=window.SGClassicPrecision93?.load?.(asset,tf)||[];
 const turbo=window.Vortex91Core?.getSelectiveLedger?.(asset,tf)||[];
 return [classic,turbo];
}
function allRows(){
 let a=[],b=[];
 for(const asset of ASSETS)for(const tf of TFS){
  const pair=getRows(asset,tf);
  a.push(...pair[0]);b.push(...pair[1]);
 }
 return [a,b];
}
function selected(){
 const asset=$('stormV100Asset')?.value||'XAUUSD',tf=$('stormV100Tf')?.value||'M5';
 return asset==='ALL'?allRows():getRows(asset,tf);
}
function row(label,values){
 return '<tr><th scope="row">'+esc(label)+'</th>'+values.map(v=>'<td>'+v+'</td>').join('')+'</tr>';
}
function render(){
 const api=window.StormDualCore100,table=$('stormV100Table'),status=$('stormV100Status');
 if(!api||!table)return;
 lastData=selected();
 const costR=Math.max(0,Math.min(2,Number($('stormV100Cost')?.value)||0));
 const a=api.summarize(lastData[0],'classic',{costR}),b=api.summarize(lastData[1],'turbo',{costR}),both=[a,b];
 const vals=fn=>both.map((v,i)=>fn(v,i));
 table.innerHTML='<thead><tr><th>Métrica</th>'+COLS.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+
 row('Encerradas, válidas',vals(v=>'<b>'+v.n+'</b>'))+
 row('Pendentes',vals(v=>String(v.pending)))+
 row('Excluídas / ambíguas / expiradas',vals(v=>String(v.excluded)))+
 row('Acerto observado',vals(v=>v.validSample?pct(v.winRate):'Amostra insuficiente'))+
 row(costR?'Expectativa média após custo estimado':'Expectativa média bruta (R)',vals(v=>v.validSample?fmt(v.meanR,2)+' R':'—'))+
 row('Fator de lucro em R',vals(v=>v.validSample?multiple(v.profitFactor):'—'))+
 row('Validação cronológica 70/30',vals(v=>v.validSample
  ?'Treino '+v.trainN+' ('+fmt(v.trainR,2)+' R) / Teste '+v.testN+' ('+fmt(v.testR,2)+' R)'
  :'Aguardando 30 encerramentos válidos'))+
 row('Setup selecionado no treino',vals(v=>v.validSample&&v.best?esc(v.best.name)+' · treino '+fmt(v.best.meanR,2)+' R ('+v.best.n+') · teste '+(v.best.holdoutN?fmt(v.best.holdoutR,2)+' R ('+v.best.holdoutN+')':'sem amostra'):'—'))+
 row('Regime com melhor média no treino',vals(v=>v.validSample&&v.bestRegime?esc(v.bestRegime.name)+' · treino '+fmt(v.bestRegime.meanR,2)+' R · teste '+(v.bestRegime.holdoutN?fmt(v.bestRegime.holdoutR,2)+' R':'sem amostra'):'—'))+
 row('Timeframe com melhor média no treino',vals(v=>v.validSample&&v.bestTF?esc(v.bestTF.name)+' · treino '+fmt(v.bestTF.meanR,2)+' R · teste '+(v.bestTF.holdoutN?fmt(v.bestTF.holdoutR,2)+' R':'sem amostra'):'—'))+
 '</tbody>';
 const total=both.reduce((s,x)=>s+x.n,0);
 if(status)status.textContent=total?'Indicadores calculados apenas com observações locais encerradas.':'Nenhuma amostra prospectiva encerrada nesta seleção.';
 const self=$('stormV100SelfTest');
 if(self){const result=api.selfTest();self.textContent=result.ok?'Testes causais locais: OK':'Testes causais locais: FALHA — não confiar no módulo';self.style.color=result.ok?'#8adcb9':'#ff8ca0';}
}
function exportCsv(){
 const [classic,turbo]=lastData;
 const rows=[['motor','ativo','timeframe','data_utc','direcao','score','setup','regime','status','entrada','stop','alvo_1']];
 for(const [i,data] of [classic,turbo].entries())for(const r of data){
  rows.push([i?'Turbo':'Clássico',r.asset,r.tf,new Date(r.closedAt||r.t).toISOString(),r.side,r.score,
    r.setup||r.strategy||'',r.regime||'',r.status,r.entry??r.price??'',r.stop??r.stopDist??'',
    r.targets?.[0]??r.target??'']);
 }
 const cell=x=>{const s=String(x??''),safe=/^[=+\-@\t\r]/.test(s)?"'"+s:s;return '"'+safe.replace(/"/g,'""')+'"';};
 const txt='\ufeff'+rows.map(r=>r.map(cell).join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([txt],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');
 link.href=url;link.download='STORM_CODEX_v10_comparativo_observado.csv';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function init(){
 if($('stormV100Panel')||!document.querySelector('.shell'))return;
 const style=document.createElement('style');
 style.id='stormV100Style';
 style.textContent='#stormV100Panel{margin:22px 0;padding:21px;border-color:#4e6374;background:linear-gradient(140deg,#111d2c,#111722)}'+
 '#stormV100Panel h2{font-size:19px;margin:0 0 6px}#stormV100Panel p{color:#b9c8db;line-height:1.6;font-size:12px}'+
 '#stormV100Panel .controls{display:flex;flex-wrap:wrap;align-items:center;gap:9px;margin:15px 0}'+
 '#stormV100Panel select,#stormV100Panel input{padding:10px;border:1px solid #46566a;border-radius:9px;background:#152338;color:#f0f4fa}#stormV100Cost{width:82px}'+
 '#stormV100Panel .tablewrap{overflow:auto;width:100%}#stormV100Panel table{border-collapse:collapse;width:100%;min-width:610px;font-size:12px}'+
 '#stormV100Panel th,#stormV100Panel td{border-bottom:1px solid #2a3647;padding:11px;text-align:left;vertical-align:middle}'+
 '#stormV100Panel thead th{color:#f0c679}#stormV100Panel tbody th{color:#cbd5e3;font-weight:600;width:33%}'+
 '#stormV100Panel td{font-variant-numeric:tabular-nums}#stormV100SelfTest{font-size:11px;margin-top:9px}';
 document.head.appendChild(style);
 const panel=document.createElement('section');
 panel.id='stormV100Panel';panel.className='panel';panel.setAttribute('aria-label','Comparativo prospectivo Clássico versus Turbo');
 panel.innerHTML='<h2>◎ Storm Códex IA v10.0 · Evolução dos dois motores</h2>'+
 '<p>Comparação técnica entre Clássico Precision e Turbo Equilibrado. Apenas operações observadas após o sinal, por motor, neste navegador. Os motores mantêm regras e históricos separados.</p>'+
 '<div class="controls"><label for="stormV100Asset">Ativo</label><select id="stormV100Asset">'+
 '<option value="ALL">Todos os ativos</option>'+ASSETS.map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select>'+
 '<label for="stormV100Tf">Período</label><select id="stormV100Tf">'+TFS.map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select>'+ '<label for="stormV100Cost">Custo estimado por operação (R)</label><input id="stormV100Cost" type="number" min="0" max="2" step="0.01" value="0.00" inputmode="decimal" aria-label="Custo estimado, ida e volta, em unidades de risco R">'+
 '<button id="stormV100Refresh" type="button" class="btn tiny">Atualizar métricas</button>'+
 '<button id="stormV100Export" type="button" class="btn tiny">Exportar CSV</button></div>'+
 '<p id="stormV100Status" role="status"></p><div class="tablewrap"><table id="stormV100Table"></table></div>'+
 '<div id="stormV100SelfTest"></div>'+
 '<p><b>Leitura crítica:</b> scores são heurísticos, não probabilidades calibradas. Win rate e R dependem do critério de resultado simulado por OHLC. O custo opcional é uma hipótese por operação em R, não spread efetivo, comissão ou slippage comprovados. Uma mesma vela que toca stop e alvo é ambígua e não conta como acerto. A divisão 70/30 é temporal e descritiva; o teste não deve ser usado para escolher parâmetros com informação futura. Amostras pequenas não autorizam inferência estatística.</p>';
 document.querySelector('.shell').appendChild(panel);
 $('stormV100Asset').addEventListener('change',()=>{
   $('stormV100Tf').disabled=$('stormV100Asset').value==='ALL';render();});
 $('stormV100Tf').addEventListener('change',render);
 $('stormV100Cost').addEventListener('input',render);
 $('stormV100Refresh').addEventListener('click',render);
 $('stormV100Export').addEventListener('click',exportCsv);
 window.addEventListener('vortex83-data',render);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});
 timer=setInterval(()=>{if(!document.hidden)render()},30000);
 render();
}
window.StormDualComparison100={version:'10.0',render,getRows,allRows,exportCsv};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();