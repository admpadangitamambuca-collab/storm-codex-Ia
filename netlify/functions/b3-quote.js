'use strict';
/* Storm Códex 11.3. Minicontratos: último pregão via brapi.dev sem token.
 * NÃO oferece OHLC intradiário e NÃO autoriza sinais M1/M5/M15/H1. */
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=90, s-maxage=120'};
const reply=(status,body)=>({statusCode:status,headers:HEADERS,body:JSON.stringify(body)});
const CODE=/^(WIN|WDO)[FGHJKMNQUVXZ]\d{2}$/;
const numeric=x=>x!==null&&x!==undefined&&x!==''&&typeof x!=='boolean'&&Number.isFinite(Number(x))?Number(x):null;
const sourceUrl='https://brapi.dev/api/v2/futures/quote?symbols=';
function parse(data,symbol){
 const quotes=data?.quotes;
 if(!Array.isArray(quotes))throw Error('brapi respondeu sem lista de contratos');
 const r=quotes.find(row=>String(row?.symbol||'').toUpperCase()===symbol);
 if(!r)throw Error('Contrato '+symbol+' não aparece na lista de cotações da brapi');
 if(String(r.underlyingAsset||symbol.slice(0,3)).toUpperCase()!==symbol.slice(0,3))
  throw Error('Ativo subjacente divergente');
 if(r.quotationType&&r.quotationType!=='price')throw Error('Cotação de taxa, não de preço');
 const close=numeric(r.close),settlement=numeric(r.settlement);
 const price=close!==null&&close>0?close:settlement!==null&&settlement>0?settlement:null;
 if(price===null)throw Error('Fechamento e preço de ajuste indisponíveis');
 const t=numeric(r.date);
 const quotedAt=t===null?null:(t<1e11?t*1000:t);
 if(!Number.isFinite(quotedAt)||quotedAt<1500000000000||quotedAt>Date.now()+86400000)
  throw Error('brapi sem data verificável do pregão');
 return {asset:symbol.slice(0,3),symbol,price,priceKind:close!==null&&close>0?'Fechamento do último pregão':'Ajuste do último pregão',
  close,settlement,high:numeric(r.high),low:numeric(r.low),volume:numeric(r.volume),
  quotedAt,expiration:String(r.expirationDate||''),lastTradeDate:String(r.lastTradeDate||''),
  source:'brapi.dev · B3 futuros · fim de pregão',
  feedVerified:true,delayed:true,isIntraday:false,allowIntradaySignals:false};
}
async function fetchQuote(symbol,fetcher=fetch){
 if(!CODE.test(symbol))throw Error('Código WIN/WDO inválido');
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),8500);
 const read=async url=>{
  const response=await fetcher(url,{signal:controller.signal,headers:{Accept:'application/json'}});
  if(!response.ok)throw Error('brapi HTTP '+response.status);
  return await response.json();
 };
 try{
  let previous='';
  try{return parse(await read(sourceUrl+encodeURIComponent(symbol)),symbol)}
  catch(e){previous=String(e?.message||e)}
  // Segunda rota documentada, mesma fonte e somente fechamento diário.
  const curve=await read('https://brapi.dev/api/v2/futures/term-structure?asset='+symbol.slice(0,3));
  try{return {...parse({quotes:curve?.contracts},symbol),source:'brapi.dev · curva de contratos · fim de pregão'}}
  catch(e){throw Error('Cotação: '+previous+' / curva: '+String(e?.message||e))}
 }finally{clearTimeout(timeout)}
}
exports.parse=parse;exports.fetchQuote=fetchQuote;
exports.handler=async event=>{
 const symbol=String(event.queryStringParameters?.symbol||'').toUpperCase();
 if(event.httpMethod!=='GET')return reply(405,{error:'Somente GET'});
 if(!CODE.test(symbol))return reply(400,{error:'Informe contrato WIN ou WDO com letra e ano'});
 try{return reply(200,await fetchQuote(symbol))}
 catch(e){return reply(503,{symbol,error:String(e?.message||e).slice(0,250),source:'brapi.dev fim de pregão'})}
};
