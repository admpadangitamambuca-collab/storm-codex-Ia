/* Storm Códex IA — service worker sem cache de cotações ou sinais.
 * Registro em HTTPS; notificações push exigem configuração externa.
 */
'use strict';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
  let payload={};
  try{payload=event.data?.json()||{}}catch{payload={body:event.data?.text()||''}}
  const title=String(payload.title||'Storm Códex IA').slice(0,100);
  const body=String(payload.body||'Novo alerta de mercado disponível.').slice(0,240);
  const target=typeof payload.url==='string'?payload.url:'/';
  event.waitUntil(self.registration.showNotification(title,{
    body,tag:String(payload.tag||'storm-sinal').slice(0,80),
    data:{url:target},icon:undefined
  }));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  let url;
  try{url=new URL(event.notification.data?.url||'/',self.location.origin)}catch{url=new URL('/',self.location.origin)}
  if(url.origin!==self.location.origin)url=new URL('/',self.location.origin);
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    for(const client of clients){
      if(client.url.startsWith(self.location.origin)){
        await client.focus();
        if('navigate' in client)await client.navigate(url.href);
        return;
      }
    }
    return self.clients.openWindow(url.href);
  }));
});
