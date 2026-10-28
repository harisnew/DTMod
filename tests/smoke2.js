require('./smoke.js');
const D=window.DTMod, S=D.state;
const ev=o=>handler({data:{type:'extension-message',componentId:'dtmod',messageId:'evt',params:{json:JSON.stringify(o)},asyncId:-1}});
S.chat.length=0; ev({t:'left'});
const mem=(chat2)=>[{id:'1',name:'Alice',data:{}},{id:'2',name:'Bob',data:chat2?{chat:JSON.stringify({m:chat2})}:{}}];
ev({t:'lobby',id:'9',owner:'1',me:'1',data:{max:'4'},members:mem([[5,'old history']])});   // history on arrival -> skipped
ev({t:'lobby',id:'9',owner:'1',me:'1',data:{max:'4'},members:mem([[5,'old history'],[6,'hello <b>x</b>']])});
ev({t:'lobby',id:'9',owner:'1',me:'1',data:{max:'4'},members:mem([[5,'old history'],[6,'hello <b>x</b>']])}); // duplicate snapshot
ev({t:'lobby',id:'9',owner:'1',me:'1',data:{max:'4'},members:[{id:'1',name:'Alice',data:{}}]});             // Bob left
console.log(JSON.stringify(S.chat.map(m=>m.sys?('SYS:'+m.sys+':'+(m.name||'')):(m.name+': '+m.text))));
console.log('unread',S.unread);
