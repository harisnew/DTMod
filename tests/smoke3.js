
require('./smoke_base.js');
const assert=require('assert');
rt.globalVars={Budget:1000,ResearchCoins:10,DayTotal:40,GameSpeedTime:1.2,GameplayPause:0,CompanyName:'X'};
rt.layout.name='BOSS OFFICE';listeners.beforeanylayoutstart({layout:{name:'BOSS OFFICE'}});
const D=window.DTMod,S=D.state,g=rt.globalVars;
const tick=()=>intervals.forEach(f=>{try{f()}catch(e){console.log('ERR',e)}});
const L=(owner,mems)=>({t:'lobby',id:'9',owner,me:'1',data:{max:'4'},members:mems});
const lastSet=(k)=>{const a=sent.filter(s=>s.messageId==='set-member-data'&&s.params[0]===k);return a.length?a[a.length-1].params[1]:null};

const ev=o=>handler({data:{type:'extension-message',componentId:'dtmod',messageId:'evt',params:{json:JSON.stringify(o)},asyncId:-1}});
const mems=(bobData,meData)=>[{id:'1',name:'Me',data:meData||{}},{id:'2',name:'Bob',data:bobData||{}}];
// --- trade out
ev(L('1',mems()));
assert.strictEqual(D.sendMoney('2','c',300),'');
assert.strictEqual(g.Budget,700);
let tx=JSON.parse(lastSet('tx')); assert.strictEqual(tx.m.length,1); const seq=tx.m[0][0]; assert.deepStrictEqual(tx.m[0].slice(1),['2','c',300]);
assert.strictEqual(D.sendMoney('2','c',5000),'txmuch'); assert.strictEqual(D.sendMoney('1','c',5),'txnoone'); assert.strictEqual(D.sendMoney('2','c',-5),'txbad'); assert.strictEqual(D.sendMoney('2','x',5),'txbad');
// ack -> done, tx no longer pending
ev(L('1',mems({ack:JSON.stringify({'1':seq})})));
assert.strictEqual(D.tx.out[0].st,'done'); assert.strictEqual(g.Budget,700);
// --- trade out + receiver vanishes -> refund
assert.strictEqual(D.sendMoney('2','r',4),''); assert.strictEqual(g.ResearchCoins,6);
ev(L('1',[{id:'1',name:'Me',data:{}}])); assert.strictEqual(g.ResearchCoins,10); assert.strictEqual(D.tx.out[1].st,'refunded');
// --- trade in (+dup, +bad)
ev(L('1',mems({tx:JSON.stringify({m:[[5000,'1','c',50],[5001,'3','c',9999],[5002,'1','c',-3],[5003,'1','zz',3]]})})));
assert.strictEqual(g.Budget,750); let ack=JSON.parse(lastSet('ack')); assert.strictEqual(ack['2'],5000);
ev(L('1',mems({tx:JSON.stringify({m:[[5000,'1','c',50]]})}))); assert.strictEqual(g.Budget,750);
// not in gameplay -> no credit, retried later
rt.layout.name='MENU';listeners.beforeanylayoutstart({layout:{name:'MENU'}});
ev(L('1',mems({tx:JSON.stringify({m:[[6000,'1','c',70]]})}))); assert.strictEqual(g.Budget,750);
rt.layout.name='BOSS OFFICE';listeners.beforeanylayoutstart({layout:{name:'BOSS OFFICE'}});
ev(L('1',mems({tx:JSON.stringify({m:[[6000,'1','c',70]]})}))); assert.strictEqual(g.Budget,820);
// --- clock: host publishes
tick(); const clk=JSON.parse(lastSet('clk')); assert.strictEqual(clk.d,40); assert.strictEqual(clk.s,1.2); assert.strictEqual(clk.p,0);
// --- clock: follower (owner = Bob)
const bobClk=(d,s,p,q)=>JSON.stringify({d,s,p,q});
ev(L('2',mems({clk:bobClk(100,1.2,0,1)})));
tick(); console.log('speed catch-up',g.GameSpeedTime); assert.ok(g.GameSpeedTime<0.2);
g.DayTotal=100; ev(L('2',mems({clk:bobClk(100,1.2,0,2)}))); tick(); assert.strictEqual(g.GameSpeedTime,1.2);
// pause mirroring
ev(L('2',mems({clk:bobClk(100,1.2,1,3)}))); tick(); assert.strictEqual(g.GameplayPause,1);
ev(L('2',mems({clk:bobClk(100,1.2,0,4)}))); tick(); assert.strictEqual(g.GameplayPause,0);
// client far ahead: no freeze
g.DayTotal=500; g.GameSpeedTime=1.2; ev(L('2',mems({clk:bobClk(100,1.2,0,5)}))); tick(); assert.strictEqual(g.GameSpeedTime,1.2); assert.strictEqual(D.clock.mode,'ahead');
// own pause not released by follower
g.DayTotal=100; g.GameplayPause=1; ev(L('2',mems({clk:bobClk(100,1.2,0,6)}))); tick(); assert.strictEqual(g.GameplayPause,1);
// ranking
const r=D.ranking(); assert.strictEqual(r.length,2);
console.log('ALL OK');
D.open(); ['rank','trade','lobby','chat','friends'].forEach(k=>{S.tab=k; ev(L('1',mems({stats:JSON.stringify({Budget:5,Fans:2,DayTotal:50,CompanyName:'B'})}))); });
console.log('UI tabs rendered OK');
// speed restore when leaving follow mode
g.DayTotal=40; g.GameSpeedTime=1.2; ev(L('2',mems({clk:bobClk(100,1.2,0,9)}))); tick(); assert.ok(g.GameSpeedTime<0.2);
ev({t:'left'}); tick(); assert.strictEqual(g.GameSpeedTime,1.2); console.log('RESTORE OK');
// voice
ev(L('1',mems())); sent.length=0;
D.setMic(true); assert.deepStrictEqual(sent.filter(x=>x.messageId==='voice-mic').map(x=>x.params),[[1]]);
ev({t:'voice',mic:1,speak:['2']}); assert.ok(D.voice.speaking['2']);
D.setMic(false); assert.deepStrictEqual(sent.filter(x=>x.messageId==='voice-mic').map(x=>x.params),[[1],[0]]);
ev({t:'left'}); assert.strictEqual(D.voice.mic,false);
console.log('VOICE JS OK');
