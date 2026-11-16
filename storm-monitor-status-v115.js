/* Storm 11.5 - read-only cloud monitor display.
 * Observes what the server actually reports; never implies an active worker.
 */
(function(root){'use strict';
 const $=id=>document.getElementById(id),frames=['M1','M5','M15','H1'];
 let panel=null,busy=false,ready=false,last=null;
 function mount(){
  if(panel||!$('stormCopyTrade'))return;
  panel=document.createElement('section');panel.id='stormCloud115';
  panel.style.cssText='margin:14px 0 19px;padding:16px;border:1px solid #395b57;border-radius:13px;background:linear-gradient(115deg,#102a2a,#14202c);color:#dce8e8';
  panel.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap"><div><b style="color:#93ead0">MONITOR DE MERCADO · 11.5</b><p id="stormCloudText" style="font-size:12px;line-height:1.6;color:#a9c4c9;margin:7px 0">Verificando status real do serviço agendado…</p></div><button type="button" class="storm-v95-btn" id="stormCloudRefresh">Atualizar status do servidor</button></div><details style="margin-top:9px"><summary style="cursor:pointer;color:#eed3a2;font-size:12px">Ver fontes acompanhadas</summary><div id="stormCloudFeedRows" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:7px;margin-top:10px"></div></details><p style="font-size:11px;line-height:1.5;color:#8fa6b5;margin:12px 0 0">Pesquisa agendada a cada 5 minutos quando a versão Git está publicada e o serviço está operacional. Não é streaming tick a tick, não opera na corretora e não compartilha a memória privada do navegador. WIN/WDO só serão atuais com feed intradiário válido.</p>';
  const target=$('stormLab114')||$('stormCopyTrade');
  target.before(panel);
  $('stormCloudRefresh').addEventListener('click',refresh);
  ready=true;refresh();
 }
 function item(container,row){
  const cell=document.createElement('div');
  cell.style.cssText='border:1px solid #385358;border-radius:8px;background:#10232e;padding:9px;line-height:1.45;font-size:11px';
  const title=document.createElement('b');title.textContent=String(row.asset)+' / '+String(row.tf);
  const st=document.createElement('div');st.textContent=String(row.state||'—');
  st.style.color=row.state==='RECENT'?'#7be3b2':row.state==='STALE'?'#efd197':'#ffa1ae';
  const sub=document.createElement('small');sub.style.color='#91abb8';
  sub.textContent=(row.lastClosedAt?new Date(row.lastClosedAt).toLocaleString('pt-BR'):'Sem candle recente')+
   ' · '+(Number(row.count)||0)+' sinais simulados';
  cell.append(title,st,sub);container.appendChild(cell);
 }
 async function refresh(){
  if(!ready||busy)return;
  busy=true;const info=$('stormCloudText'),rows=$('stormCloudFeedRows');
  info.textContent='Consultando status publicado…';
  try{
   const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),7000);
   let response;
   try{response=await fetch('/.netlify/functions/storm-status',{signal:ctl.signal,cache:'no-store'})}
   finally{clearTimeout(timer)}
   if(!response.ok)throw Error('Status HTTP '+response.status);
   const body=await response.json();last=body;
   if(body.status!=='OBSERVING'){
    info.textContent='Monitor ainda não ativado no deploy: '+String(body.message||body.status||'sem execução registrada');
    rows.replaceChildren();return;
   }
   const age=Date.now()-Number(body.checkedAt);
   const stale=!Number.isFinite(age)||age>16*60000;
   info.textContent=(stale?'MONITOR SEM EXECUÇÃO RECENTE':'MONITOR COM CICLO REGISTRADO')+
    ' · Último ciclo '+new Date(body.checkedAt).toLocaleString('pt-BR')+
    ' · '+Number(body.healthy||0)+' feeds recentes'+
    ' · '+Number(body.failed||0)+' falhas'+
    ' · macro '+(body.macroVerified?'verificada':'não verificada')+
    ' · cadência 5 minutos';
   rows.replaceChildren();
   (Array.isArray(body.feeds)?body.feeds:[]).forEach(row=>item(rows,row));
  }catch(err){
   info.textContent='Não foi possível confirmar o monitor no Netlify: '+String(err.message||err)+
    '. Conecte o deploy Git e verifique o painel Functions.';
   rows.replaceChildren();
  }finally{busy=false}
 }
 root.StormCloud115={refresh,getLast:()=>last};
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
 setInterval(()=>{if(!document.hidden&&document.body.classList.contains('storm-copy-active'))refresh()},60000);
})(typeof window!=='undefined'?window:globalThis);
