#!/usr/bin/env node
'use strict';
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const results=[],errors=[];
 async function check(label,fn) {
  try{const output=await fn();results.push({label,pass:!!output,output:typeof output==='string'?output:null});}
  catch(e){results.push({label,pass:false,error:String(e.message||e).slice(0,350)})}
 }
 async function setup(viewport){
  const context=await browser.newContext({viewport,locale:'pt-BR',ignoreHTTPSErrors:false});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push('PAGE '+e.message.slice(0,250)));
  page.on('console',msg=>{if(msg.type()==='error')errors.push('CONSOLE '+msg.text().slice(0,250))});
  await page.goto('https://codextrading.netlify.app/',{waitUntil:'domcontentloaded',timeout:40000});
  await page.waitForTimeout(1500);
  return {page,context};
 }
 try{
  const {page,context}=await setup({width:1440,height:900});
  await check('HTML version 11.5 loaded',()=>page.title().then(x=>x.includes('11.5')));
  await check('Production engine globals are instantiated',()=>page.evaluate(()=>!!(window.SGEngine&&window.Vortex91Core&&window.StormB3Indices111&&window.StormPrecision112)));
  await check('Copy button rendered',()=>page.locator('#stormCopyBtn').isVisible());
  await check('Turbo button rendered',()=>page.locator('#v83TurboBtn').isVisible());
  await check('Indices button rendered',()=>page.locator('#stormIndicesBtn').isVisible());
  await check('Main refresh control present',()=>page.locator('#refreshBtn').isVisible());
  await check('Copy tab opens and simulator visible',async()=>{
   await page.locator('#stormCopyBtn').click();
   await page.waitForTimeout(600);
   return page.evaluate(()=>document.body.classList.contains('storm-copy-active')
    && !!document.getElementById('stormCopyTrade')&&getComputedStyle(document.getElementById('stormCopyTrade')).display!=='none');
  });
  await check('Cloud status appears inside Copy tab',async()=>{
   await page.waitForTimeout(1600);
   return page.evaluate(()=>({exists:!!document.getElementById('stormCloud115'),
    text:document.getElementById('stormCloudText')?.textContent?.slice(0,220)})).then(v=>v.exists?v.text||true:false);
  });
  await check('Copy status button refreshes without crashing',async()=>{
   const button=page.locator('#stormCloudRefresh');
   if(await button.count()===0)return false;
   await button.click();await page.waitForTimeout(1400);
   return !!(await page.locator('#stormCloudText').textContent());
  });
  await check('Switch to Turbo / toggle mode',async()=>{
   if(await page.locator('#stormCopyBtn').getAttribute('aria-pressed')==='true')await page.locator('#stormCopyBtn').click();
   await page.locator('#v83TurboBtn').click();
   await page.waitForTimeout(600);
   return page.locator('#v83TurboBtn').getAttribute('aria-pressed').then(v=>v==='true');
  });
  await check('Indices tab and emerald pane open',async()=>{
   const btn=page.locator('#stormIndicesBtn');
   await btn.click();await page.waitForTimeout(400);
   return page.evaluate(()=>document.body.classList.contains('storm-indices-on')
     && !!document.getElementById('stormIndicesPane'));
  });
  await context.close();
  const {page:mobile,context:mobileContext}=await setup({width:390,height:844});
  await check('Mobile site loads without a blank page',async()=>(await mobile.locator('body').innerText()).length>200);
  await check('Mobile Copy tab accessible',async()=>{
   const btn=mobile.locator('#stormCopyBtn');
   if(!(await btn.isVisible()))return false;
   await btn.click();await mobile.waitForTimeout(300);
   return mobile.evaluate(()=>document.body.classList.contains('storm-copy-active'));
  });
  await mobileContext.close();
 }finally{await browser.close()}
 console.log(JSON.stringify({at:new Date().toISOString(),browser:'Playwright Chromium',
  passed:results.filter(x=>x.pass).length,total:results.length,
  results,scriptErrors:errors.slice(0,30)},null,2));
 if(results.some(x=>!x.pass))process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
