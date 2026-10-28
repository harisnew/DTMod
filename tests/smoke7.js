require('./smoke_base.js');
const assert=require('assert');
const g=rt.globalVars={Year:2008,Month:1,Day:1,DayInMonth:31,DayTotal:0,Budget:1000,ResearchCoins:10,GameSpeedTime:1.2,GameplayPause:0,CompanyName:'X',LoadingType:'',CompanyCountryID:5,TimelineNextDay:-1,TimelineNearestNextDay:0,TimelineID:0,TimelineCheckingTheme:''};
let went=[]; rt.goToLayout=n=>{went.push(n)};
const lay=n=>{rt.layout.name=n;listeners.beforeanylayoutstart({layout:{name:n}});listeners.afteranylayoutstart&&listeners.afteranylayoutstart({layout:{name:n}})};
lay('MENU');
const D=window.DTMod;
const _now=Date.now.bind(Date); let off=0; Date.now=()=>_now()+off;
const tick=()=>intervals.forEach(f=>{try{f()}catch(e){console.log('ERR',e)}});
const ev=o=>handler({data:{type:'extension-message',componentId:'dtmod',messageId:'evt',params:{json:JSON.stringify(o)},asyncId:-1}});
const mems=(bob,me)=>[{id:'1',name:'Me',data:me||{}},{id:'2',name:'Bob',data:bob||{}}];
const L=(data,bob)=>({t:'lobby',id:'9',owner:'2',me:'1',data:Object.assign({name:'L',max:'4'},data),members:mems(bob)});
const clk=(d,q)=>JSON.stringify({d,s:1.2,p:0,q});
// calendar (no leap years, DayTotal 1 = 01.01.2008) - values taken from real game dumps
const P=D.game.date;
const exp=[[1,2008,1,1,31],[31,2008,1,31,31],[32,2008,2,1,28],[39,2008,2,8,28],[365,2008,12,31,31],[366,2009,1,1,31],[744,2010,1,14,31],[788,2010,2,27,28],[792,2010,3,3,31],[816,2010,3,27,31],[823,2010,4,3,30]];
exp.forEach(([t,y,m,d,dim])=>{const p=P(t);assert.deepStrictEqual([p.Year,p.Month,p.Day,p.DayInMonth],[y,m,d,dim],'date of day '+t);});
// --- guest arrives (host already playing, announced a running world), clicks join
ev({t:'left'}); ev({t:'joined'}); ev(L({},{clk:clk(790,1)}));
// remember: members[0] is me, host is Bob (owner 2); clk is host's member data
let lob=L({},{clk:clk(790,1)}); ev(lob);
D.game.join(); assert.deepStrictEqual(went,['LOADING GAME']);
lay('LOADING GAME'); g.DayTotal=0; lay('BOSS OFFICE'); g.DayTotal=1; g.TimelineNextDay=2; g.TimelineNearestNextDay=777;
tick();
assert.ok(g.DayTotal>=791&&g.DayTotal<=793,'joined at host date, got '+g.DayTotal);
assert.strictEqual(g.Year,2010); assert.strictEqual(g.Month,3); assert.strictEqual(g.TimelineNextDay,-1); assert.strictEqual(g.TimelineNearestNextDay,0);
assert.ok(g.GameSpeedTime>0.1&&g.GameSpeedTime<=20);
// jump happens once only
g.DayTotal=800; g.Month=3; tick(); assert.strictEqual(g.DayTotal,800);
// --- countdown start with a running world: also jumps
went=[]; g.Year=2008;g.Month=1;g.Day=1;g.DayTotal=0;g.TimelineNextDay=-1; lay('MENU');
ev({t:'left'}); ev({t:'joined'}); ev(L({},{clk:clk(500,1)}));
ev(L({game:JSON.stringify({n:5,t:5,run:1})},{clk:clk(500,2)}));
let cd=D.game.cd(); assert.ok(cd&&cd.run&&!cd.ask); off+=5200; D.game.tick(); assert.deepStrictEqual(went,['LOADING GAME']);
lay('LOADING GAME'); lay('BOSS OFFICE'); g.DayTotal=1; tick();
assert.ok(g.DayTotal>=501&&g.DayTotal<=507,'countdown join with run, got '+g.DayTotal);
// --- host starts a fresh world: stale clock is ignored and nobody jumps
went=[]; g.Year=2008;g.Month=1;g.Day=1;g.DayTotal=0; lay('MENU');
ev({t:'left'}); ev({t:'joined'}); ev(L({},{clk:clk(900,10)}));
ev(L({game:JSON.stringify({n:77,t:77})},{clk:clk(900,10)}));    // host restarts, its clk is still the old one
cd=D.game.cd(); assert.ok(cd&&!cd.run); off+=5200; D.game.tick(); assert.deepStrictEqual(went,['LOADING GAME']);
lay('LOADING GAME'); lay('BOSS OFFICE'); g.DayTotal=1; tick(); tick();
assert.ok(g.DayTotal<=8&&g.Year===2008,'fresh start keeps 2008, got '+g.DayTotal);
// new host clock after restart is accepted again
ev(L({game:JSON.stringify({n:77,t:77})},{clk:clk(3,11)})); tick(); assert.ok(D.clock.mode==='follow'||D.clock.mode==='');
// --- host clock never arrives: give up after 40s, no jump
went=[]; g.DayTotal=0; lay('MENU'); ev({t:'left'}); ev({t:'joined'}); ev(L({},{}));
D.game.join(); lay('LOADING GAME'); lay('BOSS OFFICE'); g.DayTotal=1; tick(); assert.strictEqual(g.DayTotal,1);
off+=41000; tick(); ev(L({},{clk:clk(900,1)})); tick(); assert.ok(g.DayTotal<10,'no late jump after timeout, got '+g.DayTotal);
console.log('JOIN AT HOST DATE JS OK');
