// Storm Codex IA -> MetaTrader 5: ponte local no Windows, desligada por padrao.
// Requer Node >=20 e Playwright. Nunca coloca senha da corretora em site ou GitHub.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {TradeQueue,assessTrade,ASSETS} from './bridge-core.mjs';

const ROOT=path.dirname(fileURLToPath(import.meta.url));
const runtime=path.join(ROOT,'runtime');
const configPath=process.env.STORM_MT5_CONFIG || path.join(ROOT,'config.json');
let cfg;
try {cfg=JSON.parse(fs.readFileSync(configPath,'utf8'));}
catch(e) {console.error('Crie mt5-bridge/config.json a partir de config.example.json:',e.message);process.exit(1);}
if(typeof cfg.appUrl!=='string' || !/^https:\/\/|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//i.test(cfg.appUrl))
  throw Error('appUrl precisa ser URL https do seu app ou localhost. Confira config.json.');
if(typeof cfg.secret!=='string' || cfg.secret.length<32 || /CHANGE|SUBSTITUA|EXEMPLO/.test(cfg.secret))
  throw Error('Gere um token local aleatorio (32+ caracteres) em config.json. Nunca publique esse arquivo.');
cfg.port=Number.isInteger(cfg.port)&&cfg.port>=1024&&cfg.port<65536?cfg.port:8765;
cfg.executionEnabled=cfg.executionEnabled===true;
cfg.symbolMap=cfg.symbolMap&&typeof cfg.symbolMap==='object'?cfg.symbolMap:{};
const allowedOrigin=new URL(cfg.appUrl).origin;
const queue=new TradeQueue(path.join(runtime,'queue.json'));
let page=null,ctx=null,scanning=false,lastScanAt=0,lastError='',appReady=false,lastEAAt=0,lastEAType='desconhecida';
fs.mkdirSync(runtime,{recursive:true});
function log(...parts) {console.log(new Date().toISOString(),...parts);}
function reply(res,code,body='',headers={}) {
 res.writeHead(code,{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});
 res.end(body);
}
function isAuthenticated(req){return req.headers['x-storm-token']===cfg.secret;}
function handle(req,res) {
 const url=new URL(req.url||'/', 'http://127.0.0.1:'+cfg.port);
 const origin=req.headers.origin||'';
 if(origin===allowedOrigin){
  res.setHeader('Access-Control-Allow-Origin',origin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Access-Control-Allow-Private-Network','true');
 }
 if(req.method==='OPTIONS') return reply(res,origin===allowedOrigin?204:403);
 if(req.method==='GET' && url.pathname==='/status') {
  const active=appReady&&Date.now()-lastScanAt<90000;
  return reply(res,200,JSON.stringify({
   bridge:'storm-mt5-local-v1',local:true,appConnected:active,mt5Connected:Date.now()-lastEAAt<15000,
   accountType:lastEAType,executionEnabled:cfg.executionEnabled,mode:cfg.executionEnabled?'Habilitado localmente':'Desligado',
   lastScanAt,lastError:String(lastError).slice(0,180),queue:queue.summary().counts,
   note:'Estado local deste computador. Nao representa o celular nem confirma operacoes reais.'
  }),{'Content-Type':'application/json; charset=utf-8'});
 }
 if (!isAuthenticated(req)) return reply(res,401,'unauthorized\n',{'Content-Type':'text/plain'});
 if(req.method==='GET' && url.pathname==='/next') {
  if(!cfg.executionEnabled) return reply(res,204);
  const signal=queue.next();
  if(!signal) return reply(res,204);
  const symbol=String(cfg.symbolMap[signal.asset]||'');
  if(!/^[A-Za-z0-9_.#-]{3,24}$/.test(symbol) || !ASSETS.includes(signal.asset)){
   queue.ack(signal.key,'rejected','symbol_map_invalido');
   return reply(res,204);
  }
  const payload=[signal.key,symbol,signal.side,signal.entry,signal.stop,signal.tp,signal.createdAt,signal.score].join('|');
  return reply(res,200,payload+'\n',{'Content-Type':'text/plain; charset=utf-8'});
 }
 if(req.method==='POST' && (url.pathname==='/ack'||url.pathname==='/heartbeat')){
  let body='';
  req.on('data',c=>{body+=c.toString('utf8');if(body.length>512){req.destroy();}});
  req.on('end',()=>{
   if(url.pathname==='/heartbeat'){
    lastEAAt=Date.now();
    lastEAType=body.trim()==='demo'?'demo':body.trim()==='real'?'real':'desconhecida';
    return reply(res,200,'ok\n');
   }
   const [key,status,code]=body.trim().split('|');
   return reply(res,queue.ack(key,status,code)?200:409,'ack\n');
  });
  return;
 }
 reply(res,404,'not found');
}
const server=http.createServer((req,res)=>{
 try{handle(req,res);}catch(e){log('ERRO API',e.message);reply(res,500,'internal error');}
});
server.listen(cfg.port,'127.0.0.1',()=>log('Ponte local escutando somente 127.0.0.1:'+cfg.port,
 cfg.executionEnabled?'execucao habilitada em config local':'EXECUCAO DESLIGADA'));

async function collect() {
 if(scanning||!page||page.isClosed()) return;
 scanning=true;
 try {
   const data=await page.evaluate(async()=>{
     const api=window.StormCopyTrade95;
     if(!api?.scanScheduled || !api?.getTrades || !api?.getFeeds) return null;
     await api.scanScheduled();
     return {status:api.getStatus(),trades:api.getTrades(),feeds:api.getFeeds()};
   });
   if(!data) throw Error('Aplicativo sem StormCopyTrade95.scanScheduled; use a versao da ramificacao MT5.');
   lastScanAt=Date.now();appReady=!!data.status?.started&&!data.status?.scanError;
   lastError=data.status?.scanError||'';
   if(!appReady) return;
   let added=0;
   for(const trade of data.trades) {
     const sig=assessTrade(trade,data.feeds,Date.now());
     if(sig && queue.add(sig)) {added++;log('Novo candidato validado:',sig.key,sig.asset,sig.tf,sig.side,'score',sig.score);}
   }
   if(added)log('Fila:',queue.summary().counts);
 } catch(e) {appReady=false;lastError=String(e.message||e);log('Coleta indisponivel (sem ordens):',lastError);}
 finally {scanning=false;}
}
async function start() {
 try {
   const {chromium}=await import('playwright');
   ctx=await chromium.launchPersistentContext(path.join(runtime,'browser-profile'),{
     headless:cfg.headless===true,viewport:{width:1180,height:780},acceptDownloads:false
   });
   page=ctx.pages()[0]||await ctx.newPage();
   page.on('close',()=>{appReady=false;lastError='Janela da analise foi fechada; reinicie a ponte.';});
   page.on('pageerror',e=>log('Erro de pagina (nao envia ordem):',e.message));
   await page.goto(cfg.appUrl,{waitUntil:'domcontentloaded',timeout:60000});
   log('Janela aberta. Se houver login, entre manualmente com sua conta do aplicativo; MT5 e separado.');
   // A primeira leitura arma os timeframes. Nunca importa sinais anteriores ao inicio da ponte.
   await collect();
   setInterval(collect,20000).unref();
 }catch(e){appReady=false;lastError=String(e.message||e);
   log('Falha ao iniciar Chromium/Playwright:',lastError);
   log('Execute: npm install && npx playwright install chromium');}
}
process.on('SIGINT',async()=>{log('Encerrando sem abrir ordens novas.');server.close();if(ctx)await ctx.close();process.exit(0);});
process.on('SIGTERM',async()=>{server.close();if(ctx)await ctx.close();process.exit(0);});
start();
