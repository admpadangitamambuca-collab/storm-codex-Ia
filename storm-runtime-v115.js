'use strict';
/* Storm Codex 11.5: server-side loader of EXACT legacy engine scripts.
 * No arbitrary external code is evaluated; only the repository's own index.html.
 * No DOM timers/automatic UI or network requests run in this isolated VM.
 */
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const originalDate=Date;
function createRuntime(options={}){
 const source=options.html||fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
 const modules=[...source.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
   .map(m=>m[1]).filter(x=>x.trim());
 const inert=()=>{};
 const nodes=new Map(),registered=[];
 function node(){
  const n={id:'',hidden:false,style:{},dataset:{},classList:{add:inert,remove:inert,toggle:()=>false,contains:()=>false},
   setAttribute:inert,removeAttribute:inert,addEventListener:inert,removeEventListener:inert,
   querySelector:()=>null,querySelectorAll:()=>[],getContext:()=>null,
   appendChild(child){if(child?.id)nodes.set(child.id,child);return child;},
   append(child){if(child?.id)nodes.set(child.id,child);},
   prepend(child){if(child?.id)nodes.set(child.id,child);},
   after(child){if(child?.id)nodes.set(child.id,child);},
   before(child){if(child?.id)nodes.set(child.id,child);},
   remove:inert};
  return n;
 }
 const body=node(),header=node(),tfSwitch=node(),nav=node();
 const document={
   readyState:'loading',hidden:true,body,head:body,documentElement:body,
   addEventListener:(type,fn)=>{if(type==='DOMContentLoaded')registered.push(fn);},
   removeEventListener:inert,
   querySelector:(s)=>s==='.header-right'?header:s==='.tf-switch'?tfSwitch:s==='#v79Nav'?nav:null,
   querySelectorAll:()=>[],getElementById:(id)=>nodes.get(id)||null,
   createElement:node
 };
 const store=new Map();
 const ctx={
   console:options.console||{log:inert,warn:inert,error:inert},
   Date:originalDate,Math,Intl,Number,String,Array,Map,Set,JSON,RegExp,Promise,Object,
   URL,URLSearchParams,TextEncoder,TextDecoder,AbortController,
   setTimeout:()=>0,clearTimeout:inert,setInterval:()=>0,clearInterval:inert,
   requestAnimationFrame:()=>0,cancelAnimationFrame:inert,
   addEventListener:inert,removeEventListener:inert,document,
   localStorage:{getItem:(k)=>store.get(k)||null,setItem:(k,v)=>store.set(k,String(v)),removeItem:(k)=>store.delete(k)},
   navigator:{onLine:false,language:'pt-BR',userAgent:'StormCodexBacktest/11.5'},
   location:{hostname:'localhost',origin:'http://localhost',protocol:'http:',href:'http://localhost/'},
   fetch:async()=>{throw Error('Network disabled inside engine runtime')},
   crypto:{randomUUID:()=> 'research-only'},performance:{now:()=>0},
   CustomEvent:class CustomEvent{constructor(type,init){this.type=type;this.detail=init?.detail}},
   Event:class Event{constructor(type){this.type=type}},
   MutationObserver:class MutationObserver{observe(){} disconnect(){}},
   ResizeObserver:class ResizeObserver{observe(){} disconnect(){}},
   Image:class Image{},
   SGUserHistoryKey:'backend_research_only',
 };
 ctx.window=ctx;ctx.self=ctx;ctx.globalThis=ctx;
 const sandbox=vm.createContext(ctx,{name:'StormCodexV115'});
 const errors=[];
 modules.forEach((code,i)=>{
   try{vm.runInContext(code,sandbox,{filename:'index-inline-'+i+'.js',timeout:1500});}
   catch(e){errors.push({script:i,message:String(e.message||e).slice(0,240)})}
 });
 // The Turbo 8.3 bridge initializes after DOMContentLoaded.
 // Execute ONLY its trusted bootstrap, with inert DOM placeholders; other UI
 // callbacks remain dormant to prevent timers, network, or automatic trading.
 for(const fn of registered){
  if(String(fn).includes('window.Vortex83Turbo={')&&String(fn).includes('contextForCopy')){
   try{fn();}catch(e){errors.push({script:'turbo-bootstrap',message:String(e.message||e)})}
  }
 }
 const required=['SGEngine','SGV6Core','SGV72Core','Vortex83Turbo','Vortex91Core'];
 const missing=required.filter(k=>!sandbox[k]);
 if(missing.length)throw Error('Motor original indisponível no sandbox: '+missing.join(', ')+'; inicialização: '+JSON.stringify(errors.slice(0,8)));
 function setNow(timeMs){const n=Number(timeMs);
  if(!Number.isFinite(n))throw Error('Clock inválido');
  const Virtual=class extends originalDate{constructor(...args){super(...(args.length?args:[n]));}static now(){return n;}};
  sandbox.Date=Virtual;
 }
 return Object.freeze({sandbox,errors,scriptCount:modules.length,setNow,
  engines:{SGEngine:sandbox.SGEngine,SGV6Core:sandbox.SGV6Core,
   SGV72Core:sandbox.SGV72Core,Vortex83Turbo:sandbox.Vortex83Turbo,
   Vortex91Core:sandbox.Vortex91Core}});
}
module.exports={createRuntime};
