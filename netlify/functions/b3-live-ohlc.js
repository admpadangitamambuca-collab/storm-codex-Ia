'use strict';
/* Licensed B3 market data proxy, fail-closed. Never auto-redistribute a
 * provider's B3 futures feed unless user has explicitly enabled rights. */
const B3=require('../../b3-indices-v111.js');
const SPEC={M1:{ms:60000,interval:'1m'},M5:{ms:300000,interval:'5m'},
 M15:{ms:900000,interval:'15m'},H1:{ms:3600000,interval:'1h'}};
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const response=(status,body)=>({statusCode:status,headers,body:JSON.stringify(body)});
const valid=x=>typeof x==='number'&&Number.isFinite(x);
function parseProvider(data,asset,tf,contract,now=Date.now()) {
 if(!SPEC[tf]||!['WIN','WDO'].includes(asset))throw Error('Ativo ou período inválido');
 const identity=String(data?.symbol||'').toUpperCase();
 if(identity!==contract.symbol)throw Error('Ticker incorreto, esperado '+contract.symbol);
 if(String(data?.interval||'').toLowerCase()!==SPEC[tf].interval)
  throw Error('Intervalo não corresponde à requisição');
 if(data.realtime!==true||Number(data.delayMinutes)!==0)
  throw Error('Fonte não comprova preço B3 sem atraso');
 if(data.exchange&& !['B3','BMF','BM&F','BMF&BOVESPA'].includes(String(data.exchange).toUpperCase()))
  throw Error('Mercado B3 não confirmado');
 const raw=Array.isArray(data?.bars)?data.bars:[];
 const candles=B3.normalize(raw,tf,now).slice(-350);
 if(candles.length<46)throw Error('Histórico OHLC insuficiente');
 const tick=asset==='WIN'?5:.5;
 if(candles.some(x=>Math.abs(x.close/tick-Math.round(x.close/tick))>1e-5))
  throw Error('Preço fora da grade do contrato');
 const last=candles.at(-1),closedAt=last.t+SPEC[tf].ms,age=now-closedAt;
 if(!valid(age)||age<0)throw Error('Timestamp não causal');
 const quotedAt=Number(data?.quotedAt||0);
 if(!valid(quotedAt)||quotedAt<closedAt||quotedAt>now+2000)
  throw Error('Fonte sem timestamp de emissão comprovável');
 return {requestedAsset:asset,requestedTf:tf,asset,tf,mode:'live',
  feedSymbol:contract.symbol,feedVerified:true,exchange:'B3',isIntraday:true,
  candles,closedAt,providerTimestamp:closedAt,providerStale:age>SPEC[tf].ms+45000,
  source:'B3 · feed autorizado (contrato exato)',fetchedAt:now,transport:'Netlify Function · B3 licensed',
  verifiedRealtime:true,contractExpiry:contract.expiry,contractLastTrade:contract.lastTrade,
  contractPointValue:contract.pointValue,contractTick:contract.tick};
}
exports.parseProvider=parseProvider;
exports.handler=async event=>{
 if(event.httpMethod!=='GET')return response(405,{error:'GET only'});
 const asset=String(event.queryStringParameters?.asset||'').toUpperCase(),
  tf=String(event.queryStringParameters?.tf||'').toUpperCase();
 if(!['WIN','WDO'].includes(asset)||!SPEC[tf])return response(400,{error:'Ativo ou TF inválido'});
 if(process.env.STORM_B3_REDISTRIBUTION_ALLOWED!=='true')
  return response(503,{error:'B3 real-time não habilitado: direitos de redistribuição não confirmados'});
 const endpoint=process.env.STORM_B3_PROVIDER_URL,token=process.env.STORM_B3_PROVIDER_TOKEN;
 if(!endpoint||!token)return response(503,{error:'Provedor B3 licenciado ainda não configurado'});
 let u;
 try{u=new URL(endpoint);if(u.protocol!=='https:'||u.username||u.password)throw Error('HTTPS exigido')}
 catch{return response(500,{error:'Endpoint de fornecedor B3 inválido'})}
 const now=Date.now(),contract=B3.contractFor(asset,now);
 u.searchParams.set('symbol',contract.symbol);u.searchParams.set('interval',SPEC[tf].interval);
 u.searchParams.set('limit','350');
 const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),7500);
 try{
  const res=await fetch(u.toString(),{signal:ctl.signal,headers:{
   Accept:'application/json',Authorization:'Bearer '+token},cache:'no-store'});
  if(!res.ok)throw Error('Fornecedor B3 HTTP '+res.status);
  const data=await res.json();
  return response(200,parseProvider(data,asset,tf,contract,now));
 }catch(e){return response(503,{error:String(e?.message||e).slice(0,160),asset,tf,feedSymbol:contract.symbol})}
 finally{clearTimeout(timer)}
};
