global.sent=[];global.handler=null;
const mk=()=>{const n={style:{},children:[],className:'',setAttribute(){},appendChild(c){this.children.push(c);this.firstChild=this.firstChild||c;return c},addEventListener(){},set textContent(v){this._t=v;if(v==='')this.children=[]},get textContent(){return this._t},contains(){return false}};n.firstChild=null;return n};
global.self=global;
global.window=global;
window.chrome={webview:{postMessage:m=>sent.push(JSON.parse(m)),addEventListener:(n,f)=>handler=f}};
global.addEventListener=()=>{};
global.navigator={language:'ru-RU'};
global.document={body:mk(),head:mk(),createElement:()=>{const n=mk();Object.defineProperty(n,'innerHTML',{set(v){n.firstChild=mk()}});return n},addEventListener(){},activeElement:null,createTextNode:t=>({t}),querySelector:()=>({getBoundingClientRect:()=>({left:0,top:0,width:1456,height:819})})};
global.intervals=[];global.setInterval=f=>global.intervals.push(f);global.setTimeout=()=>0;
require('../src/dtmod.js');
// simulate main.js assigning runOnStartup and the engine calling the stored function
let cbs=[];self.runOnStartup=function(f){cbs.push(f)};
// our setter invoked f(fn) -> fn was passed to the *original* function => cbs has our callback
let listeners={};const rt={layout:{name:'START PAGE'},addEventListener:(n,f)=>listeners[n]=f};
cbs.forEach(f=>f(rt));
const ev=o=>handler({data:{type:'extension-message',componentId:'dtmod',messageId:'evt',params:{json:JSON.stringify(o)},asyncId:-1}});
ev({t:'ready',v:'0.2',app:2085660,me:'1',name:'Alice'});
ev({t:'lobby',id:'9',owner:'1',me:'1',data:{name:'x',max:'4'},members:[{id:'1',name:'Alice',data:{ready:'1'}}]});

global.rt=rt; global.listeners=listeners;
