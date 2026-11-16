/* Modern Netlify Function v2: platform injects Blobs context.
 * Scheduled executions run only on published deploys.
 */
import { getStore } from '@netlify/blobs';
import observer from '../../storm-monitor-core-v115.js';
export const config={schedule:'* * * * *'};
export default async function handler(request,context){
 const store=getStore('storm-codex-monitor-v115');
 try{
  const now=Date.now(),fullCycle=new Date(now).getUTCMinutes()%5===0;
  // Every M1 close for Forex/gold; monitor 24 asset/timeframes every five minutes.
  // This avoids 24 costly Netlify requests on every minute of the month.
  const pairs=fullCycle?observer.activePairs():
   observer.activePairs().filter(p=>p.tf==='M1'&&
    ['XAUUSD','EURUSD','USDJPY','AUDUSD'].includes(p.asset));
  const status=await observer.runCycle({store,now,pairs,mergeStatus:true});
  console.log('Storm 11.6 scheduled cycle',JSON.stringify({
   checkedAt:status.checkedAt,healthy:status.healthy,
   failed:status.failed,persisted:status.persisted
  }));
  return new Response('OK',{status:200});
 }catch(error){
  console.error('Storm 11.5 scheduled error',String(error?.message||error).slice(0,250));
  return new Response('Monitor cycle failed',{status:503});
 }
}
