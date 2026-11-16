/* Storm 11.6: transparent real spot and closed OHLC diagnostics.
 * Every request is read-only; no brokerage orders, no synthesized candles.
 */
import health from '../../storm-xau-health-v116.js';
const reply=(code,obj)=>new Response(JSON.stringify(obj),{status:code,headers:{
 'content-type':'application/json; charset=utf-8',
 'cache-control':'no-store',
 'x-content-type-options':'nosniff'
}});
export default async function handler(request){
 if(request.method!=='GET')return reply(405,{error:'Método indisponível'});
 const tf=new URL(request.url).searchParams.get('tf')||'M5';
 if(!health.FRAME[tf])return reply(400,{error:'Timeframe inválido',allowed:Object.keys(health.FRAME)});
 try{return reply(200,await health.run({tf}))}
 catch(e){return reply(503,{version:'11.6',asset:'XAUUSD',tf,status:'UNAVAILABLE',
  error:String(e?.message||e).slice(0,130)})}
}
