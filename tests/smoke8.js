require('./smoke_base.js');
const assert=require('assert');
const g=rt.globalVars={Year:2010,Budget:1000,ResearchCoins:10,DayTotal:800,GameSpeedTime:1.2,GameplayPause:0,CompanyName:'X'};
rt.layout.name='BOSS OFFICE';listeners.beforeanylayoutstart({layout:{name:'BOSS OFFICE'}});
const D=window.DTMod;
const _now=Date.now.bind(Date); let off=0; Date.now=()=>_now()+off;
const tick=()=>{off+=10000;intervals.forEach(f=>{try{f()}catch(e){console.log('ERR',e)}})};
const ev=o=>handler({data:{type:'extension-message',componentId:'dtmod',messageId:'evt',params:{json:JSON.stringify(o)},asyncId:-1}});
function mkArray(W,H){const cells={};return {width:W,height:H,depth:1,getAt:(x,y,z)=>cells[x+','+y]===undefined?0:cells[x+','+y],setAt:(v,x,y,z)=>{if(x<0||x>=W||y<0||y>=H)return;cells[x+','+y]=v},cells}}
const N=91,H=52;
function world(seed,order){const inv=mkArray(N,20),px=mkArray(N,H);let r=seed;const rnd=()=>{r=(r*1103515245+12345)&0x7fffffff;return r/0x7fffffff};
  for(let x=0;x<N;x++){inv.cells[x+',0']=order?order[x]:10+x;inv.cells[x+',7']=0;let p=5+rnd()*35;for(let y=0;y<H;y++){p=Math.max(1,p+(rnd()-0.5)*(y===20?900:1.2));px.cells[x+','+y]=Math.floor(p*100)/100}}
  px.cells['7,30']=655.35;px.cells['8,10']=1234.56;       // large values/jumps must survive too
  return {inv,px}}
const calls=[];rt.callFunction=n=>calls.push(n);
const setW=w=>{rt.objects={ArrayInvesting:{getFirstInstance:()=>w.inv},ArrayInvestingStocks:{getFirstInstance:()=>w.px}}};
const lobby=(owner,data)=>({t:'lobby',id:'9',owner,me:'1',data:data||{},members:[{id:'1',name:'Me',data:{state:'play'}},{id:'2',name:'Bob',data:{state:'play'}}]});
const lastLD=k=>{const a=sent.filter(s=>s.messageId==='set-lobby-data'&&s.params[0]===k);return a.length?a[a.length-1].params[1]:null};
// ---- host publishes
const HW=world(1); setW(HW); ev(lobby('1'));
tick(); const hdr=lastLD('stk'); assert.ok(hdr,'host published header'); const h=JSON.parse(hdr);
assert.strictEqual(h.n,N); assert.strictEqual(h.h,H); assert.ok(h.c>=1&&h.c<=3,'chunks '+h.c); assert.strictEqual(h.ids.length,N); assert.strictEqual(h.d,800);
const chunks=[];for(let i=0;i<h.c;i++){chunks.push(lastLD('stk'+i));assert.ok(chunks[i].length<7800,'chunk fits');assert.ok(chunks[i].startsWith(h.q+'|'))}
console.log('stocks payload chars',chunks.reduce((a,c)=>a+c.length,0),'chunks',h.c);
// the host's price update (weekly) -> new publish with new u
g.DayTotal=807; for(let x=0;x<N;x++){const y=H-1;for(let k=0;k<y;k++)HW.px.cells[x+','+k]=HW.px.cells[x+','+(k+1)];HW.px.cells[x+','+y]=Math.round((10+x*0.31)*100)/100}
tick(); const h2=JSON.parse(lastLD('stk')); assert.ok(h2.q>h.q); assert.strictEqual(h2.u,807,'update day recorded'); assert.strictEqual(h2.d,807);
const data={stk:lastLD('stk')};for(let i=0;i<h2.c;i++)data['stk'+i]=lastLD('stk'+i);
// ---- follower: own world (other random history, same stock ids, one stock taken over by the local player)
const FW=world(2); FW.inv.cells['3,7']=1; const ownedBefore=[];for(let y=0;y<H;y++)ownedBefore.push(FW.px.cells['3,'+y]); setW(FW);
g.DayTotal=806;                                        // we are one day behind the host: our own weekly update has not run yet
ev(lobby('2',data)); tick(); assert.strictEqual(D.stocks.st,'wait'); assert.notStrictEqual(FW.px.cells['0,51'],HW.px.cells['0,51']);
g.DayTotal=808; calls.length=0; tick(); assert.strictEqual(D.stocks.st,'ok');
for(let x=0;x<N;x++){if(x===3)continue;for(let y=0;y<H;y++)assert.strictEqual(FW.px.cells[x+','+y],HW.px.cells[x+','+y],'cell '+x+','+y)}
for(let y=0;y<H;y++)assert.strictEqual(FW.px.cells['3,'+y],ownedBefore[y],'taken-over stock stays local');
assert.ok(calls.includes('InvestingUpdate'),'game recalculates values'); 
// same data again: nothing to do
calls.length=0; tick(); assert.strictEqual(calls.length,0);
// ---- ids in another order are matched by id
const FW2=world(3,Array.from({length:N},(_,i)=>10+(N-1-i))); setW(FW2); D.stocks.raw=''; g.DayTotal=808; ev(lobby('2',data)); tick();
for(let i=0;i<N;i++){const hx=i, fx=N-1-i; for(let y=0;y<H;y+=17)assert.strictEqual(FW2.px.cells[fx+','+y],HW.px.cells[hx+','+y],'by id '+i)}
// ---- far ahead of the host: not applied
const FW3=world(4); setW(FW3); D.stocks.raw=''; g.DayTotal=900; ev(lobby('2',data)); tick(); assert.strictEqual(D.stocks.st,'far'); assert.notStrictEqual(FW3.px.cells['0,51'],HW.px.cells['0,51']);
// ---- incomplete / mismatching chunk is ignored
const FW4=world(5); setW(FW4); D.stocks.raw=''; D.stocks.pend=null; g.DayTotal=808; const bad=Object.assign({},data,{stk0:'999|'+data.stk0.split('|')[1]}); ev(lobby('2',bad)); tick(); assert.notStrictEqual(FW4.px.cells['0,51'],HW.px.cells['0,51'],'mismatching chunk not applied');
// corrupted base64 -> bad
const bad2=Object.assign({},data,{stk0:h2.q+'|'+'AAAA'}); ev(lobby('2',bad2)); tick(); assert.strictEqual(D.stocks.st,'bad');
console.log('SHARED STOCKS JS OK');
