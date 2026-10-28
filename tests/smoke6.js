require('./smoke_base.js');
const assert=require('assert');
const g=rt.globalVars={Year:2008,Budget:1000,ResearchCoins:10,DayTotal:40,GameSpeedTime:1.2,GameplayPause:0,CompanyName:'Mine'};
rt.layout.name='BOSS OFFICE';listeners.beforeanylayoutstart({layout:{name:'BOSS OFFICE'}});
const D=window.DTMod;
const _now=Date.now.bind(Date); let off=0; Date.now=()=>_now()+off;
const tick=()=>{off+=10000;intervals.forEach(f=>{try{f()}catch(e){console.log('ERR',e)}})};
const ev=o=>handler({data:{type:'extension-message',componentId:'dtmod',messageId:'evt',params:{json:JSON.stringify(o)},asyncId:-1}});
const lastSet=(id,k)=>{const a=sent.filter(s=>s.messageId===id&&s.params[0]===k);return a.length?a[a.length-1].params[1]:null};
function mkArray(W,H,data){const cells={};Object.entries(data||{}).forEach(([k,v])=>cells[k]=v);
  return {width:W,height:H,depth:1,getAt:(x,y,z)=>cells[x+','+y]===undefined?0:cells[x+','+y],setAt:(v,x,y,z)=>{if(x<0||x>=W||y<0||y>=H)return;cells[x+','+y]=v},cells}}
// world: ids 0..7, ids 5,6,7 start in future years; player column last
const R=mkArray(9,11); for(let i=0;i<8;i++){R.cells[i+',0']=i;R.cells[i+',1']=i>=5?2015+i:2000;R.cells[i+',2']=2026;R.cells[i+',4']=10+i;R.cells[i+',6']=20+i;R.cells[i+',7']=1;R.cells[i+',8']=2}
R.cells['8,0']=-1;R.cells['8,1']=2008;R.cells['8,2']=9999;R.cells['8,4']=0.25;R.cells['8,6']=1.5;R.cells['8,7']=0.5;R.cells['8,8']=3.25;
const N=mkArray(600,4); for(let i=0;i<8;i++){N.cells[i+',0']='AI'+i;N.cells[i+',1']='AI'+i}
rt.objects={ArrayRatingsCompanies:{getFirstInstance:()=>R},ArrayCompanyNames:{getFirstInstance:()=>N}};
// I am the host (id 1), Bob (id 2) is playing
const bobStats=JSON.stringify({CompanyName:'BobTech',Budget:5,Fans:1,pr:[7.5,12,3,-1.5]});
const lob=(data)=>({t:'lobby',id:'9',owner:'1',me:'1',data:data,members:[{id:'1',name:'Me',data:{state:'play'}},{id:'2',name:'Bob',data:{state:'play',stats:bobStats}}]});
ev(lob({name:'L',max:'4'})); tick(); tick();
const pc=lastSet('set-lobby-data','pc'); assert.ok(pc,'host publishes reserved ids'); console.log('pc=',pc);
const ids=pc.split(',').map(Number); assert.ok(ids.includes(7)&&ids.includes(6)&&ids.includes(5),'future companies reserved first: '+pc);
// stats include my ratings
tick(); const st=JSON.parse(lastSet('set-member-data','stats')); assert.deepStrictEqual(st.pr,[0.25,1.5,0.5,3.25]);
// now lobby data carries pc -> Bob's company appears in slot ids[1] (members sorted: 1,2 -> Bob is index 1)
ev(lob({name:'L',max:'4',pc:pc})); tick();
const bid=ids[1], bx=bid; // column index == id in this fake
assert.strictEqual(N.cells[bid+',0'],'BobTech'); assert.strictEqual(N.cells[bid+',1'],'BobTech');
assert.strictEqual(R.cells[bx+',4'],7.5); assert.strictEqual(R.cells[bx+',6'],12); assert.strictEqual(R.cells[bx+',7'],3); assert.strictEqual(R.cells[bx+',8'],-1.5);
assert.strictEqual(R.cells[bx+',1'],0); assert.strictEqual(R.cells[bx+',2'],9999);
// my own slot (ids[0]) untouched
assert.strictEqual(N.cells[ids[0]+',0'],'AI'+ids[0]);
// market sync must not touch / send reserved columns
tick(); const mk=JSON.parse(lastSet('set-member-data','mkt')||'{"n":-1}'); if(mk.n>=0){ assert.ok(mk.n<=8); }
// Bob's numbers change -> slot follows
const bob2=JSON.stringify({CompanyName:'BobTech',Budget:5,Fans:1,pr:[9,13,3.5,2]});
const L2=lob({name:'L',max:'4',pc:pc}); L2.members[1].data.stats=bob2; ev(L2); tick(); assert.strictEqual(R.cells[bx+',4'],9);
// Bob leaves -> originals restored
ev({t:'lobby',id:'9',owner:'1',me:'1',data:{name:'L',max:'4',pc:pc},members:[{id:'1',name:'Me',data:{state:'play'}}]}); tick();
assert.strictEqual(N.cells[bid+',0'],'AI'+bid); assert.strictEqual(R.cells[bx+',4'],10+bid); assert.strictEqual(R.cells[bx+',1'],bid>=5?2015+bid:2000);
// Bob back, then I leave the lobby -> restored
ev(L2); tick(); assert.strictEqual(N.cells[bid+',0'],'BobTech'); ev({t:'left'}); assert.strictEqual(N.cells[bid+',0'],'AI'+bid);
console.log('PLAYER COMPANIES JS OK');
