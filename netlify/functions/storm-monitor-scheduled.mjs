/* Modern Netlify Function v2: platform injects Blobs context.
 * Scheduled executions run only on published deploys.
 */
import { getStore } from '@netlify/blobs';
import observer from '../../storm-monitor-core-v115.js';
export const config={schedule:'*/5 * * * *'};
export default async function handler(request,context){
 const store=getStore('storm-codex-monitor-v115');
 try{
  const status=await observer.runCycle({store});
  console.log('Storm 11.5 scheduled cycle',JSON.stringify({
   checkedAt:status.checkedAt,healthy:status.healthy,
   failed:status.failed,persisted:status.persisted
  }));
  return new Response('OK',{status:200});
 }catch(error){
  console.error('Storm 11.5 scheduled error',String(error?.message||error).slice(0,250));
  return new Response('Monitor cycle failed',{status:503});
 }
}
