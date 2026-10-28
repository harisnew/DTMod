require('./smoke_base.js');
const assert=require('assert');
const g=rt.globalVars={Year:2010,Budget:1000,ResearchCoins:10,DayTotal:40,GameSpeedTime:1.2,GameplayPause:0,CompanyName:'X'};
rt.layout.name='BOSS OFFICE';listeners.beforeanylayoutstart({layout:{name:'BOSS OFFICE'}});
const D=window.DTMod;
const _now=Date.now.bind(Date); let off=0; Date.now=()=>_now()+off;
const tick=()=>{off+=10000;intervals.forEach(f=>{try{f()}catch(e){console.log('ERR',e)}})};
const ev=o=>handler({data:{type:'extension-message',componentId:'dtmod',messageId:'evt',params:{json:JSON.stringify(o)},asyncId:-1}});
const lastSet=(k)=>{const a=sent.filter(s=>s.messageId==='set-member-data'&&s.params[0]===k);return a.length?a[a.length-1].params[1]:null};
// fake C3 array instance: x=company, y=field; setAt(value,x,y,z)
function mkArray(W,H,data){const cells={};Object.entries(data||{}).forEach(([k,v])=>cells[k]=v);
  return {width:W,height:H,depth:1,getAt:(x,y,z)=>cells[x+','+y]===undefined?0:cells[x+','+y],setAt:(v,x,y,z)=>{if(x<0||x>=W||y<0||y>=H)return;cells[x+','+y]=v},cells}}
// host world: 6 active companies with ids 10,20,30,40,50,60
const host=mkArray(427,11); const ids=[10,20,30,40,50,60];
ids.forEach((id,i)=>{host.cells[i+',0']=id;host.cells[i+',4']=50+i;host.cells[i+',6']=120+i*0.37;host.cells[i+',7']=40+i;host.cells[i+',8']=-5+i*1.1;host.cells[i+',1']=2000;host.cells[i+',2']=2026});
host.cells['6,0']=70;host.cells['6,1']=2030;host.cells['6,2']=2040;host.cells['6,4']=99;host.cells['6,6']=99;
host.cells['426,0']=-1;host.cells['426,1']=2008;host.cells['426,2']=9999;host.cells['426,4']=123;host.cells['426,6']=456;
rt.objects={ArrayRatingsCompanies:{getFirstInstance:()=>host}};
// host publishes
ev({t:'lobby',id:'9',owner:'1',me:'1',data:{},members:[{id:'1',name:'Me',data:{}},{id:'2',name:'Bob',data:{}}]});
g.DayTotal=100; tick();
const raw=lastSet('mkt'); assert.ok(raw,'host published mkt'); const o=JSON.parse(raw); assert.strictEqual(o.d,100); assert.strictEqual(o.n,6,'only active real companies are sent'); assert.ok(raw.length<7000,'fits value limit: '+raw.length); console.log('mkt bytes',raw.length);
// follower world: shuffled order + 2 extra companies the host does not have, different old values
const cli=mkArray(427,11); const cids=[60,30,99,10,50,20,40,77];
cids.forEach((id,i)=>{cli.cells[i+',1']=2000;cli.cells[i+',2']=2026;cli.cells[i+',0']=id;cli.cells[i+',4']=1;cli.cells[i+',6']=2;cli.cells[i+',7']=3;cli.cells[i+',8']=4});
cli.cells['426,0']=-1;cli.cells['426,4']=5;cli.cells['426,6']=6;cli.cells['8,0']=70;cli.cells['8,4']=7;
rt.objects.ArrayRatingsCompanies.getFirstInstance=()=>cli;
// now Bob is the host
const L2=(mkt)=>({t:'lobby',id:'9',owner:'2',me:'1',data:{},members:[{id:'1',name:'Me',data:{}},{id:'2',name:'Bob',data:{mkt,clk:JSON.stringify({d:100,s:1.2,p:0,q:1})}}]});
g.DayTotal=100; ev(L2(raw)); tick();
for(let hi=0;hi<6;hi++){const id=ids[hi];const ci=cids.indexOf(id);
  assert.strictEqual(cli.cells[ci+',4'],Math.fround(50+hi)); assert.ok(Math.abs(cli.cells[ci+',6']-(120+hi*0.37))<1e-3); assert.ok(Math.abs(cli.cells[ci+',8']-(-5+hi*1.1))<1e-5);}
assert.strictEqual(cli.cells['2,4'],1,'unknown company 99 untouched'); assert.strictEqual(cli.cells['7,6'],2,'unknown company 77 untouched');
assert.strictEqual(cli.cells['2,0'],99);
assert.strictEqual(cli.cells['426,4'],5,'player column untouched'); assert.strictEqual(cli.cells['426,6'],6); assert.strictEqual(cli.cells['8,4'],7,'inactive/unsent company untouched');
console.log('apply by id OK, status');
// repeated same raw: no rewrite; new raw: applied
host.cells['0,4']=77; const raw2=(()=>{rt.objects.ArrayRatingsCompanies.getFirstInstance=()=>host;ev({t:'lobby',id:'9',owner:'1',me:'1',data:{},members:[{id:'1',name:'Me',data:{}}]});g.DayTotal=101;tick();tick();return lastSet('mkt')})();
rt.objects.ArrayRatingsCompanies.getFirstInstance=()=>cli; g.DayTotal=101; ev(L2(raw2)); tick();
assert.strictEqual(cli.cells[cids.indexOf(10)+',4'],77);
// far apart dates: not applied
host.cells['0,4']=11; rt.objects.ArrayRatingsCompanies.getFirstInstance=()=>host; ev({t:'lobby',id:'9',owner:'1',me:'1',data:{},members:[{id:'1',name:'Me',data:{}}]}); g.DayTotal=900; tick(); tick();
const raw3=lastSet('mkt'); rt.objects.ArrayRatingsCompanies.getFirstInstance=()=>cli; g.DayTotal=101; ev(L2(raw3)); tick();
assert.strictEqual(cli.cells[cids.indexOf(10)+',4'],77,'far-away host date must not be applied');
// garbage raw: no crash
ev(L2('not json')); tick(); ev(L2(JSON.stringify({d:101,n:3,r:'AAAA'}))); tick();
// different game (no id overlap): status bad, nothing written
const other=mkArray(427,11); [1,2,3].forEach((id,i)=>{other.cells[i+',0']=500+id;other.cells[i+',4']=9;other.cells[i+',6']=9}); rt.objects.ArrayRatingsCompanies.getFirstInstance=()=>other; g.DayTotal=101;
ev(L2(raw)); tick(); assert.strictEqual(other.cells['1,4'],9);
// array missing entirely: no crash
rt.objects={}; ev(L2(raw+' ')); tick();
console.log('MARKET JS OK');
