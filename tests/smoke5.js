require('./smoke_base.js');
const assert=require('assert');
const g=rt.globalVars={Year:2008,Budget:1000,ResearchCoins:10,DayTotal:0,GameSpeedTime:1.2,GameplayPause:0,CompanyName:'X',LoadingType:'',CompanyCountryID:5};
let went=[]; rt.goToLayout=n=>{went.push(n)};
rt.layout.name='MENU';listeners.beforeanylayoutstart({layout:{name:'MENU'}});
const D=window.DTMod;
const _now=Date.now.bind(Date); let off=0; Date.now=()=>_now()+off;
const ev=o=>handler({data:{type:'extension-message',componentId:'dtmod',messageId:'evt',params:{json:JSON.stringify(o)},asyncId:-1}});
const lastSet=(id,k)=>{const a=sent.filter(s=>s.messageId===id&&s.params[0]===k);return a.length?a[a.length-1].params[1]:null};
// --- host presses Start
ev({t:'lobby',id:'9',owner:'1',me:'1',data:{name:'L',max:'4'},members:[{id:'1',name:'Alice',data:{}},{id:'2',name:'Bob',data:{}}]});
D.game.start();
const gm=JSON.parse(lastSet('set-lobby-data','game')); assert.ok(gm.n>0,'game key published');
assert.deepStrictEqual(went,['LOADING GAME']); assert.strictEqual(g.LoadingType,'NEW GAME'); assert.strictEqual(g.CompanyCountryID,125); assert.ok(/Alice/.test(g.CompanyName),'default company from steam name: '+g.CompanyName);
assert.ok(lastSet('set-member-data','name'),'company name published to lobby');
// --- guest in lobby: host sets game key -> countdown, then start
went=[]; g.CompanyName='X';
const G0={t:'lobby',id:'9',owner:'2',me:'1',data:{name:'L',max:'4'},members:[{id:'1',name:'Alice',data:{}},{id:'2',name:'Bob',data:{}}]};
ev({t:'left'}); ev({t:'joined'}); ev(G0);
assert.strictEqual(D.game.cd(),null,'no countdown on arrival');
const G1=JSON.parse(JSON.stringify(G0)); G1.data.game=JSON.stringify({n:12345,t:12345}); ev(G1);
const cd=D.game.cd(); assert.ok(cd&&!cd.ask,'countdown shown'); assert.strictEqual(cd.host,'Bob');
D.game.tick(); assert.deepStrictEqual(went,[],'not before 5s'); off+=5200; D.game.tick();
assert.deepStrictEqual(went,['LOADING GAME'],'auto start after countdown'); assert.strictEqual(D.game.cd(),null);
// same nonce again: no new countdown
ev(G1); assert.strictEqual(D.game.cd(),null);
// --- late joiner: game already running when arriving -> no auto start
went=[]; ev({t:'left'}); ev({t:'joined'}); ev(G1); assert.strictEqual(D.game.cd(),null,'late joiner is not auto-started'); assert.deepStrictEqual(went,[]);
D.game.join(); assert.deepStrictEqual(went,['LOADING GAME']);
// --- in a running game: confirmation instead of auto start
went=[]; rt.layout.name='BOSS OFFICE';listeners.beforeanylayoutstart({layout:{name:'BOSS OFFICE'}});
const G2=JSON.parse(JSON.stringify(G1)); G2.data.game=JSON.stringify({n:99999,t:99999}); ev(G2);
const c2=D.game.cd(); assert.ok(c2&&c2.ask,'confirm when already playing'); off+=9000; D.game.tick(); assert.deepStrictEqual(went,[],'never auto-start while playing');
// --- host announce (already playing): game key only, no restart
went=[]; ev({t:'left'}); ev({t:'created'}); ev({t:'lobby',id:'9',owner:'1',me:'1',data:{name:'L',max:'4'},members:[{id:'1',name:'Alice',data:{}}]});
D.game.announce(); assert.ok(JSON.parse(lastSet('set-lobby-data','game')).run===1); assert.deepStrictEqual(went,[]);
// company state published as 'play' in game
assert.strictEqual(lastSet('set-member-data','state'),'play');
console.log('GAME START JS OK');
