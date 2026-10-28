/* DTMod co-op lobby UI. Injected after the game's modernjscheck.js. Talks to zz-dtmod-x64.ext.dll (component "dtmod").
   All data coming from other players is untrusted: it is only ever inserted with textContent. */
(function () {
  'use strict';
  if (window.__DTMOD__) return;
  var VER = '1.0';
  var wv = window.chrome && window.chrome.webview;
  if (!wv) { try { console.warn('[DTMod] no WebView2 bridge; disabled'); } catch (e) {} return; }

  // ---------- i18n ----------
  var LANG = (/^ru/i.test(navigator.language || '') ? 'ru' : 'en');
  try { var _l = localStorage.getItem('dtmod.lang'); if (_l === 'ru' || _l === 'en') LANG = _l; } catch (e) {}
  function setLang(l) { LANG = l; try { localStorage.setItem('dtmod.lang', l); } catch (e) {} }
  var T = {
    title: ['Co-op (Steam)', 'Кооператив (Steam)'],
    create: ['Create', 'Создать'], search: ['Search', 'Поиск'], lobby: ['Lobby', 'Лобби'], friends: ['Friends', 'Друзья'],
    lname: ['Lobby name', 'Название лобби'], vis: ['Who can join', 'Кто может войти'],
    v0: ['Invite only', 'Только по приглашению'], v1: ['Friends', 'Друзья'], v2: ['Public (searchable)', 'Публичное (виден в поиске)'],
    maxp: ['Players', 'Игроков'], createbtn: ['Create lobby', 'Создать лобби'],
    refresh: ['Refresh', 'Обновить'], join: ['Join', 'Войти'], none: ['Nothing found', 'Ничего не найдено'],
    leave: ['Leave', 'Выйти'], invdlg: ['Invite via Steam…', 'Пригласить через Steam…'], invite: ['Invite', 'Позвать'],
    host: ['host', 'хост'], you: ['you', 'вы'], ready: ['ready', 'готов'], notready: ['not ready', 'не готов'],
    toggleReady: ['Toggle ready', 'Готов / не готов'], notin: ['You are not in a lobby', 'Вы не в лобби'],
    wait: ['Waiting for Steam…', 'Ожидание Steam…'], connected: ['Steam connected as', 'Steam: вы вошли как'],
    ingame: ['in game', 'в игре'], online: ['online', 'онлайн'], offline: ['offline', 'не в сети'],
    close: ['Close', 'Закрыть'], btn: ['Co-op', 'Кооп'], joining: ['Joining…', 'Входим…'], creating: ['Creating…', 'Создаём…'],
    chat: ['Chat', 'Чат'], chatph: ['Type a message and press Enter…', 'Введите сообщение и нажмите Enter…'], send: ['Send', 'Отправить'],
    sysjoin: ['joined the lobby', 'вошёл(а) в лобби'], sysleft: ['left the lobby', 'вышел(а) из лобби'], sysme: ['You joined the lobby', 'Вы вошли в лобби'],
    chatnone: ['No messages yet. Say hi!', 'Пока нет сообщений. Поздоровайтесь!'], chatlobby: ['Join or create a lobby to chat', 'Войдите в лобби или создайте своё, чтобы общаться'],
    players: ['Players', 'Игроки'], networth: ['net worth', 'капитал'], budget: ['Cash', 'Деньги'], fans: ['Fans', 'Фанаты'], nostats: ['no game running yet', 'игра ещё не начата'],
    rank: ['Ranking', 'Рейтинг'], trade: ['Trade', 'Торговля'], place: ['#', '№'], company: ['Company', 'Компания'],
    cash: ['Cash', 'Деньги'], rcoins: ['Research coins', 'Монеты исследований'], to: ['To player', 'Кому'], amount: ['Amount', 'Сумма'],
    cur: ['Resource', 'Ресурс'], sendmoney: ['Send', 'Отправить'], txlog: ['Transfers', 'Переводы'], txnone: ['No transfers yet', 'Переводов пока нет'],
    txin: ['received from', 'получено от'], txout: ['sent to', 'отправлено'], txpend: ['waiting…', 'ожидание…'], txdone: ['delivered', 'доставлено'], txrefund: ['refunded', 'возвращено'],
    txnoplay: ['Start or load a game first (you must be in your office)', 'Сначала начните или загрузите игру (нужно быть в офисе)'],
    txnoone: ['No other players in the lobby', 'В лобби нет других игроков'], txbad: ['Enter a valid amount', 'Введите корректную сумму'],
    txmuch: ['Not enough funds', 'Недостаточно средств'], clocksync: ['Clock', 'Часы'], clkhost: ['you are the host: your clock is the lobby clock', 'вы хост: ваши часы — общие для лобби'],
    clkfollow: ['following the host', 'синхронизация с хостом'], clkahead: ['your date is far ahead of the host; start all players from the same save/new game', 'ваша дата сильно опережает хоста; начните всем с одного сохранения/новой игры'],
    skhost: ['stocks: you publish the lobby stock prices', 'акции: вы задаёте общие цены'], skok: ['stocks: synced with host', 'акции: синхронизированы с хостом'], skwait: ['stocks: waiting for host data', 'акции: ждём данные хоста'], skfar: ['stocks: dates too far apart, not applied', 'акции: даты слишком далеко, не применяется'], skbad: ['stocks: host data does not match this game', 'акции: данные хоста не подходят к этой игре'],
    mkhost: ['market: you publish the lobby market', 'рынок: вы задаёте общий рынок'], mkok: ['market: synced with host', 'рынок: синхронизирован с хостом'], mkwait: ['market: waiting for host data', 'рынок: ждём данные хоста'], mkfar: ['market: dates too far apart, not applied', 'рынок: даты слишком далеко, не применяется'], mkbad: ['market: host data does not match this game', 'рынок: данные хоста не подходят к этой игре'],
    clkdrift: ['days behind/ahead of host', 'дн. разница с хостом'], dayshort: ['d', 'дн.'], hud: ['Ranking', 'Рейтинг'],
    voice: ['Voice chat', 'Голосовой чат'], voiceon: ['Voice chat enabled', 'Голосовой чат включён'], vmode: ['Microphone', 'Микрофон'],
    vptt: ['Push-to-talk', 'По кнопке (push-to-talk)'], vopen: ['Always on', 'Всегда включён'], vkey: ['Key', 'Клавиша'], vchange: ['Change', 'Изменить'], vpress: ['press a key…', 'нажмите клавишу…'],
    vvol: ['Volume', 'Громкость'], vmute: ['mute', 'выкл. звук'], vunmute: ['unmute', 'вкл. звук'], vspeak: ['speaking', 'говорит'], vmic: ['mic on', 'микрофон включён'],
    vecho: ['Hear myself (test)', 'Слышать себя (тест)'], vhint: ['Hold the key to talk. Voice uses your Steam microphone settings.', 'Удерживайте клавишу, чтобы говорить. Микрофон берётся из настроек Steam.'],
    sales30: ['Sales, 30 days', 'Продажи за 30 дней'], units: ['pcs', 'шт.'], share: ['market share', 'доля рынка'],
    back: ['Back', 'Назад'], cancel: ['Cancel', 'Отмена'],
    hcreate: ['Create game', 'Создать игру'], hcreated: ['You are the host: set up the lobby, invite friends and press Start.', 'Вы — хост: настройте лобби, позовите друзей и нажмите «Начать игру».'],
    hjoin: ['Join game', 'Присоединиться'], hjoind: ['Find a public lobby or accept a friend invite. You can join a game that is already running.', 'Найдите открытое лобби или примите приглашение друга. Можно войти и в уже идущую игру.'],
    hhow: ['Everyone plays in their own company on a shared calendar and market. Friends can also invite you through the Steam overlay.', 'Каждый играет за свою компанию в общем календаре и на общем рынке. Друзья также могут пригласить вас через оверлей Steam.'],
    lsettings: ['Lobby settings', 'Настройки лобби'], v2s: ['Public', 'Открытое'], v0s: ['Invite only', 'По приглашению'],
    v0d: ['Only invited players can join.', 'Войти можно только по приглашению.'], v1d: ['Your Steam friends can join.', 'Могут войти друзья из Steam.'], v2d: ['Anyone can find the lobby in the search.', 'Лобби видно всем в поиске.'],
    mycompany: ['Your company name', 'Название вашей компании'], mycountry: ['Home country', 'Страна компании'], myslot: ['Save slot for the co-op game', 'Слот сохранения для кооп-игры'], slothint: ['The game autosaves here. Slot 3 keeps your single-player saves safe.', 'Игра автосохраняется сюда. Слот 3 не затрагивает ваши одиночные сохранения.'], publiclobbies: ['Public lobbies', 'Открытые лобби'], invhint: ['Invited by a friend? Accept the invite in Steam — the lobby opens here automatically.', 'Вас пригласил друг? Примите приглашение в Steam — лобби откроется здесь само.'],
    nocompany: ['no company yet', 'компания ещё не создана'], waitplayer: ['Waiting for a player…', 'Ожидание игрока…'],
    startgame: ['Start game', 'Начать игру'], restart: ['New game for everyone', 'Новая игра для всех'], joingame: ['Create company and join', 'Создать компанию и войти'],
    imready: ['I am ready', 'Я готов'], waithost: ['Waiting for the host to start…', 'Ждём, пока хост начнёт игру…'],
    runon: ['A game has been started in this lobby', 'В лобби уже запущена игра'], runlive: ['The host is playing — you can join with your own company', 'Хост уже играет — можно войти со своей компанией'],
    announce: ['Open game for others', 'Открыть игру для других'], announced: ['Others in the lobby will start their own company in your world.', 'Остальные игроки лобби создадут свои компании в вашем мире.'],
    cdhost: ['Game starts — host', 'Запуск игры — хост'], cdask: ['Start a new game and join? Your current unsaved progress will be lost.', 'Начать новую игру и присоединиться? Несохранённый прогресс будет потерян.'],
    cdyes: ['Join', 'Войти'], cdno: ['Stay', 'Остаться'], cdstart: ['Your company is being created…', 'Создаём вашу компанию…'],
    err: ['Error', 'Ошибка'], hint: ['F8 toggles this window', 'F8 — открыть/закрыть окно'], menu: ['Co-op', 'Кооператив'], mods: ['mod', 'мод']
  };
  function t(k) { var v = T[k]; return v ? v[LANG === 'ru' ? 1 : 0] : k; }

  // ---------- state ----------
  var T0 = Date.now();
  var S = { chat: [], unread: 0, ready: false, me: '', name: '', lobby: null, lobbies: null, friends: null, tab: 'lobby', busy: '', error: '', open: false };
  var listeners = {};
  var dom = {};

  // ---------- bridge ----------
  function send(id, params) {
    try {
      wv.postMessage(JSON.stringify({ type: 'extension-message', componentId: 'dtmod', messageId: id, params: params || [], asyncId: -1 }));
    } catch (e) { try { console.warn('[DTMod] send failed', e); } catch (e2) {} }
  }
  window.addEventListener('error', function (e) { try { blog('JS error: ' + e.message + ' @' + (e.filename || '') + ':' + e.lineno); } catch (x) {} });
  window.addEventListener('unhandledrejection', function (e) { try { blog('JS rejection: ' + e.reason); } catch (x) {} });
  function blog(s) { send('log', [String(s).slice(0, 500)]); }

  var firstRaw = true;
  wv.addEventListener('message', function (ev) {
    var d = ev && ev.data;
    if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { return; } }
    if (!d || d.type !== 'extension-message' || d.componentId !== 'dtmod') return;
    if (firstRaw) { firstRaw = false; blog('first raw event: ' + JSON.stringify(d)); }
    var p = d.params, js = null;
    if (Array.isArray(p)) {
      for (var i = 0; i < p.length; i++) {
        if (typeof p[i] === 'string') { js = p[i]; break; }
        if (p[i] && typeof p[i] === 'object') { if (typeof p[i].json === 'string') { js = p[i].json; break; } if (typeof p[i].value === 'string') { js = p[i].value; break; } }
      }
    } else if (p && typeof p === 'object') js = typeof p.json === 'string' ? p.json : null;
    if (!js) { blog('event without json: ' + JSON.stringify(d).slice(0, 300)); return; }
    var e2;
    try { e2 = JSON.parse(js); } catch (e) { blog('bad json: ' + js.slice(0, 200)); return; }
    onEvent(e2);
  });

  var labLobby = function (e) {};
  // ---------- events from the native module ----------
  function onEvent(e) {
    switch (e.t) {
      case 'ready': S.ready = true; S.me = e.me; S.name = e.name; send('get-friends'); voiceCfg(); break;
      case 'created': S.busy = ''; S.tab = 'lobby'; LB.init = false; LB.n = 0; pm.st = ''; pm.co = ''; break;
      case 'joining': S.busy = 'joining'; S.open = true; break;
      case 'joined': S.busy = ''; S.tab = 'lobby'; S.open = true; LB.init = false; LB.n = 0; pm.st = ''; pm.co = ''; break;
      case 'lobby':
        labLobby(e);
        processChat(e);
        S.lobby = e;
        CK.host = hostClockFrom(e);
        try { processTx(e); } catch (x) { blog('tx error ' + x); }
        if (S.busy) S.busy = '';
        try { pubMember(false); gameSync(e); } catch (x) { blog('lobby hook error ' + x); }
        break;
      case 'left': try { pcRestore(); pcSetIds([]); } catch (x) {} VC.mic = false; VC.echo = false; VC.speaking = {}; S.lobby = null; CK.host = null; CK.ignore = ''; STK.raw = ''; STK.pend = null; STK.st = ''; STK.mem = ''; CK.forced = 0; CK.mode = ''; chatSeen = null; chatMembers = null; S.chat = []; S.unread = 0; S.busy = ''; S.scr = 'home'; CD = null; LB.init = false; LB.n = 0; pm.st = ''; pm.co = ''; break;
      case 'voice': VC.speaking = {}; (e.speak || []).forEach(function (i) { VC.speaking[i] = 1; }); break;
      case 'lobbies': S.lobbies = e.list || []; break;
      case 'friends': S.friends = e.list || []; break;
      case 'error': S.busy = ''; S.error = (e.where || '') + ': ' + (e.msg || '') + (e.code ? ' (' + e.code + ')' : ''); break;
    }
    var l = listeners[e.t];
    if (l) l.forEach(function (f) { try { f(e); } catch (x) { blog('listener error ' + x); } });
    (listeners['*'] || []).forEach(function (f) { try { f(e); } catch (x) {} });
    render();
  }


  // ---------- text chat (rides on Steam lobby member data, key "chat"; no native callbacks needed) ----------
  var chatSeen = null;        // memberId -> highest message seq already shown
  var chatMembers = null;     // memberId -> true, for join/leave notices
  var mySeq = Date.now(), lastSend = 0, outbox = [];
  function cleanText(x) { return String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 300); }
  function pushChat(m) {
    S.chat.push(m); if (S.chat.length > 200) S.chat.shift();
    if (!m.mine && !(S.open && S.tab === 'chat')) { S.unread++; toast(m); }
  }
  function processChat(L) {
    if (!L || !L.members) return;
    var first = chatSeen === null;
    if (first) { chatSeen = {}; chatMembers = {}; }
    var present = {};
    L.members.forEach(function (m) {
      present[m.id] = true;
      var name = cleanText(m.name || m.id).slice(0, 40);
      var raw = m.data && m.data.chat, msgs = null;
      if (raw) { try { var o = JSON.parse(raw); if (o && Array.isArray(o.m)) msgs = o.m; } catch (x) {} }
      var mx = chatSeen[m.id] || 0;
      if (msgs) {
        msgs.slice(-8).forEach(function (q) {
          if (!Array.isArray(q)) return;
          var sq = +q[0]; if (!(sq > 0)) return;
          if (first) { if (sq > mx) mx = sq; return; }            // history from before we arrived: skip
          if (sq > (chatSeen[m.id] || 0)) {
            pushChat({ id: m.id, name: name, text: cleanText(q[1]), mine: m.id === S.me, ts: Date.now() });
            if (sq > mx) mx = sq;
          }
        });
      }
      chatSeen[m.id] = mx;
      if (!chatMembers[m.id]) {
        chatMembers[m.id] = name;
        if (!first) pushChat({ sys: 'sysjoin', name: name, ts: Date.now(), mine: m.id === S.me });
      }
    });
    if (first) S.chat.push({ sys: 'sysme', ts: Date.now(), mine: true });
    Object.keys(chatMembers).forEach(function (id) {
      if (!present[id]) { var nm = chatMembers[id]; delete chatMembers[id]; pushChat({ sys: 'sysleft', name: String(nm), ts: Date.now(), mine: false }); }
    });
  }
  function sendChat(text) {
    text = cleanText(text).trim(); if (!text || !S.lobby) return false;
    var now = Date.now(); if (now - lastSend < 600) return false; lastSend = now;
    mySeq = Math.max(mySeq + 1, now);
    outbox.push([mySeq, text]); if (outbox.length > 6) outbox.shift();
    send('set-member-data', ['chat', JSON.stringify({ m: outbox })]);
    if (chatSeen) chatSeen[S.me] = mySeq;
    pushChat({ id: S.me, name: S.name, text: text, mine: true, ts: now });
    return true;
  }
  var toastEl = null, toastTimer = 0;
  function toast(m) {
    if (!document.body || (S.open && S.tab === 'chat')) return;
    if (!toastEl) {
      toastEl = el('div'); toastEl.id = 'dtm-toast';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = '';
    toastEl.appendChild(el('b', null, (m.sys ? '' : (m.name + ': '))));
    toastEl.appendChild(document.createTextNode(m.sys ? (m.name ? m.name + ' ' : '') + t(m.sys) : m.text.slice(0, 120)));
    toastEl.style.display = 'block';
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { toastEl.style.display = 'none'; }, 6000);
  }


  // ---------- game state access / publishing (stage 3) ----------
  var STAT_KEYS = ['CompanyName', 'Budget', 'Fans', 'Bank_TotalLoan', 'InvestingStock_TotalPrice', 'DayTotal', 'ResearchCoins', 'MyOS_TotalUsers', 'MyShopsTotal', 'Presentation_TotalVisitors', 'BankruptcyStatus'];
  function gv() { return RT.rt && RT.rt.globalVars ? RT.rt.globalVars : null; }

  // game-native sales record: ArrayCompanyStats[0] holds a JSON with daily arrays d.un (units) / d.rev (revenue) and share price px
  var salesCache = { raw: '', v: null };
  function readSales() {
    try {
      var rt = RT.rt; if (!rt || !rt.objects || !rt.objects.ArrayCompanyStats) return null;
      var arr = rt.objects.ArrayCompanyStats.getFirstInstance(); if (!arr) return null;
      var raw = arr.getAt(0, 0, 0);
      if (typeof raw !== 'string' || raw.length < 10) return null;
      if (raw === salesCache.raw) return salesCache.v;
      var o = JSON.parse(raw), d = o && o.d, v = { u: 0, r: 0, px: +o.px || 0 };
      if (d && Array.isArray(d.un) && Array.isArray(d.rev)) {
        var n = Math.min(30, d.un.length);
        for (var i = d.un.length - n; i < d.un.length; i++) v.u += +d.un[i] || 0;
        n = Math.min(30, d.rev.length);
        for (i = d.rev.length - n; i < d.rev.length; i++) v.r += +d.rev[i] || 0;
      }
      salesCache.raw = raw; salesCache.v = v; return v;
    } catch (e) { return null; }
  }
  function readStats() {
    var g = gv(); if (!g) return null;
    var o = {};
    try {
      STAT_KEYS.forEach(function (k) { var v = g[k]; if (v !== undefined) o[k] = v; });
      var sl = readSales(); if (sl) { o.u30 = Math.round(sl.u); o.r30 = Math.round(sl.r); o.px = Math.round(sl.px * 1000) / 1000; }
      var pr = myRatings(); if (pr) o.pr = pr;
    } catch (e) { return null; }
    return o;
  }
  function netWorth(st) { return (+st.Budget || 0) + (+st.InvestingStock_TotalPrice || 0) - (+st.Bank_TotalLoan || 0); }
  var lastStatsJson = '', lastStatsSend = 0;
  function publishStats() {
    if (!S.lobby) return;
    if (!inGame()) return;
    var st = readStats(); if (!st || st.Budget === undefined) return;
    var j = JSON.stringify(st), now = Date.now();
    if (j === lastStatsJson || now - lastStatsSend < 3000) return;
    lastStatsJson = j; lastStatsSend = now;
    send('set-member-data', ['stats', j]);
  }
  function memberStats(m) {
    var o = null;
    if (m.data && m.data.stats) { try { o = JSON.parse(m.data.stats); } catch (e) {} }
    return o && typeof o === 'object' ? o : null;
  }
  function fmtNum(n) { n = Math.round(+n || 0); var s = String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return (n < 0 ? '-' : '') + s; }
  function dumpVars(tag) {
    var g = gv(); if (!g) { blog('dump: no runtime'); return; }
    var o = {};
    try { Object.keys(g).forEach(function (k) { try { var v = g[k]; if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') o[k] = v; } catch (e) {} }); } catch (e) { blog('dump keys failed ' + e); }
    send('dump', [tag || 'vars', JSON.stringify(o)]);
    blog('dumped ' + Object.keys(o).length + ' globals as ' + (tag || 'vars'));
  }

  // ---------- shared clock (host = lobby owner is authoritative; others follow its speed/pause and catch up) ----------
  // The game advances ~1/GameSpeedTime days per second; GameplayPause != 0 stops time. Writing these globals is safe (verified in game).
  function inGame() { return RT.layout === 'BOSS OFFICE' && !!gv(); }
  var CK = { following: false, lastS: 0, host: null, fake: null, forced: 0, err: 0, mode: '', lastPub: 0, lastPubJson: '', q: 0 };
  function hostClockFrom(L) {
    if (!L) return null;
    var om = null; L.members.forEach(function (m) { if (m.id === L.owner) om = m; });
    if (!om || !om.data || !om.data.clk) return null;
    var raw = om.data.clk;
    if (CK.ignore && raw === CK.ignore) return null;        // clock left over from the host's previous game
    if (CK.host && CK.host.raw === raw) return CK.host;
    var o = null; try { o = JSON.parse(raw); } catch (e) { return null; }
    if (!o || !(+o.s > 0)) return null;
    return { raw: raw, d: +o.d || 0, s: +o.s, p: +o.p || 0, recv: Date.now() };
  }
  function clockTick() {
    var L = S.lobby, g = gv();
    if (g && CK.forced && !L && !CK.fake) { if ((+g.GameplayPause || 0) === 1) g.GameplayPause = 0; CK.forced = 0; }
    if (!g || !inGame()) { CK.mode = ''; return; }
    if (GM.jump) joinTick(g);
    var now = Date.now(), c = null;
    if (CK.fake) c = CK.fake; else if (L && L.owner !== S.me) c = CK.host;
    if (L && !CK.fake && L.owner === S.me) {            // host: publish clock
      var j = JSON.stringify({ d: g.DayTotal | 0, s: +g.GameSpeedTime || 1, p: +g.GameplayPause ? 1 : 0 });
      var key = j.replace(/"d":\d+,/, '');
      if (key !== CK.lastPubJson || now - CK.lastPub > 2000) {
        CK.lastPubJson = key; CK.lastPub = now; CK.q++;
        send('set-member-data', ['clk', j.replace('}', ',"q":' + CK.q + '}')]);
      }
      mkHostTick(g);
      try { stkHostTick(g); } catch (e) { if (STK.err++ < 3) blog('stk host err ' + e); }
      CK.mode = 'host'; return;
    }
    if (L && !CK.fake && L.owner !== S.me) {
      try { mkFollowTick(g, L); } catch (e) { blog('mkt err ' + e); }
      try { stkFollowTick(g, L); } catch (e) { if (STK.err++ < 3) blog('stk follow err ' + e); }
    }
    if (!c) {
      if (CK.following) { CK.following = false; if (CK.lastS > 0 && Math.abs((+g.GameSpeedTime || 0) - CK.lastS) > 0.01) g.GameSpeedTime = CK.lastS; }
      CK.mode = ''; return;
    }
    CK.following = true; CK.lastS = c.s;
    var rateH = c.p ? 0 : 1 / c.s;
    var hd = c.d + ((now - c.recv) / 1000) * rateH;
    var e = hd - (+g.DayTotal || 0);
    CK.drift = e;
    // pause mirroring: only release what we paused ourselves
    var gp = +g.GameplayPause || 0;
    if (c.p && !gp) { g.GameplayPause = 1; CK.forced = 1; }
    else if (!c.p && CK.forced) { if (gp === 1) g.GameplayPause = 0; CK.forced = 0; }
    if (c.p) { CK.mode = 'follow'; return; }
    var sp;
    if (Math.abs(e) <= 1.5) { sp = c.s; CK.mode = 'follow'; }
    else if (e > 0) { sp = 1 / Math.min(8, rateH + e / 3); CK.mode = 'follow'; }
    else if (e > -60) { sp = 1 / Math.max(0.05, rateH + e / 3); CK.mode = 'follow'; }
    else { CK.mode = 'ahead'; if (Math.abs((+g.GameSpeedTime || 0) - c.s) > 0.01) g.GameSpeedTime = c.s; return; }                  // far ahead: do not freeze the game for months
    sp = Math.max(0.12, Math.min(20, sp));
    if (Math.abs((+g.GameSpeedTime || 0) - sp) > 0.01) g.GameSpeedTime = sp;
  }


  // ---------- joining a running world: start directly at the host's date ----------
  // The game calendar has no leap years; DayTotal counts days from 01.01.2008 (= 1). Day = day of month, DayInMonth = length of the month.
  var MLEN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  function dateParts(total) {
    var n = Math.max(0, (total | 0) - 1), y = 2008 + Math.floor(n / 365), r = n % 365, m = 0;
    while (r >= MLEN[m]) { r -= MLEN[m]; m++; }
    return { DayTotal: Math.max(1, total | 0), Year: y, Month: m + 1, Day: r + 1, DayInMonth: MLEN[m] };
  }
  // the host's day right now (estimated from its last clock message), or null
  function hostDayNow() {
    var L = S.lobby, c = CK.fake || (L && L.owner !== S.me ? CK.host : null);
    if (!c || !(c.d > 0)) return null;
    return Math.round(c.d + (c.p ? 0 : ((Date.now() - c.recv) / 1000) / c.s));
  }
  // Sets only the calendar; the timeline scan is reset to its new-game defaults so it looks forward from the new date
  // (nothing between 2008 and then is replayed: no events, rewards or temporary effects of the skipped period).
  function applyDate(g, total) {
    var p = dateParts(total);
    g.Year = p.Year; g.Month = p.Month; g.Day = p.Day; g.DayInMonth = p.DayInMonth; g.DayTotal = p.DayTotal;
    g.TimelineNextDay = -1; g.TimelineNearestNextDay = 0; g.TimelineID = 0; g.TimelineCheckingTheme = '';
    // The game fires its tech/news events only when the day is exactly the scheduled one, so after a jump it must
    // look up the next one itself (the same function the game calls when a new game finishes loading).
    try { RT.rt.callFunction('TimelineChecking'); } catch (e) { blog('timeline check failed ' + e); }
    return p;
  }
  function joinTick(g) {                               // runs from clockTick while GM.jump is pending
    if (!GM.jump) return;
    if (Date.now() - GM.jump > 40000) { GM.jump = 0; blog('join: host clock never arrived, catching up by speed'); return; }
    if ((+g.DayTotal || 0) > 8 || (+g.Year || 2008) !== 2008) { GM.jump = 0; return; }       // not a fresh game any more
    var hd = hostDayNow(); if (hd === null) return;
    if (hd <= (+g.DayTotal || 0) + 1) { GM.jump = 0; return; }
    var p = applyDate(g, hd + 1); GM.jump = 0;
    CK.jumped = Date.now();
    blog('join: started directly at host date ' + p.Day + '.' + p.Month + '.' + p.Year + ' (day ' + p.DayTotal + ')');
  }

  // ---------- shared market (host-authoritative) ----------
  // The AI-company market lives in ArrayRatingsCompanies (x = company, y = field). Fields 4,6,7,8 evolve daily
  // (verified: writes are accepted and the game continues from the written values). The host publishes them as
  // float32/base64 keyed by company id (row 0); followers write them into their own array.
  var MK = { lastPub: 0, lastDay: -999, q: 0, raw: '', st: '', day: 0, cnt: 0, miss: 0 };
  var MK_ROWS = [4, 6, 7, 8];
  function mkArr() { try { var rt = RT.rt; return rt && rt.objects.ArrayRatingsCompanies ? rt.objects.ArrayRatingsCompanies.getFirstInstance() : null; } catch (e) { return null; } }
  // columns that the game updates: real companies (id >= 0) that exist in the current year; the player's own record (id -1) is never synced
  function mkCols(a, year) { var out = []; for (var x = 0; x < a.width; x++) { var id = +a.getAt(x, 0, 0); if (!(id >= 0) || PC.res[id]) continue; var y0 = +a.getAt(x, 1, 0), y1 = +a.getAt(x, 2, 0); if (y0 <= year && year <= y1) out.push(x); } return out; }
  function b64enc(f) { var u = new Uint8Array(f.buffer), s = ''; for (var i = 0; i < u.length; i += 1024) s += String.fromCharCode.apply(null, u.subarray(i, i + 1024)); return btoa(s); }
  function b64dec(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Float32Array(u.buffer); }
  function mkEncode() {
    var a = mkArr(), g = gv(); if (!a || !g || a.width < 2 || a.height < 9) return null;
    var cols = mkCols(a, +g.Year || 0), n = cols.length; if (n < 1 || n > 600) return null;
    var f = new Float32Array(n * 5);
    for (var i = 0; i < n; i++) { var x = cols[i]; f[i] = +a.getAt(x, 0, 0); for (var r = 0; r < 4; r++) f[n * (r + 1) + i] = +a.getAt(x, MK_ROWS[r], 0) || 0; }
    return JSON.stringify({ d: g.DayTotal | 0, n: n, r: b64enc(f) });
  }
  // returns { cnt, miss, day } or null when the data cannot be used
  function mkApply(raw) {
    var o; try { o = JSON.parse(raw); } catch (e) { return null; }
    var a = mkArr(); if (!a || !o || typeof o.r !== 'string' || !(o.n > 0) || o.n > 600 || a.height < 9) return null;
    var f; try { f = b64dec(o.r); } catch (e) { return null; }
    var n = o.n | 0; if (f.length !== n * 5) return null;
    var map = {}; for (var x = 0; x < a.width; x++) { var id = +a.getAt(x, 0, 0); if (id >= 0 && !PC.res[id]) map[id] = x; }
    var cnt = 0, miss = 0;
    for (var i = 0; i < n; i++) {
      var lx = f[i] >= 0 ? map[f[i]] : undefined; if (lx === undefined) { miss++; continue; }
      for (var r = 0; r < 4; r++) {
        var v = f[n * (r + 1) + i], y = MK_ROWS[r];
        if (Math.fround(+a.getAt(lx, y, 0)) !== v) { try { a.setAt(v, lx, y, 0); cnt++; } catch (e) {} }
      }
    }
    return { cnt: cnt, miss: miss, day: o.d | 0, n: n };
  }
  function mkHostTick(g) {                      // host: publish
    var now = Date.now(), d = g.DayTotal | 0;
    if (now - MK.lastPub < 1500 || (d === MK.lastDay && now - MK.lastPub < 6000)) return;
    var j = mkEncode(); if (!j) return;
    MK.lastPub = now; MK.lastDay = d; MK.q++;
    send('set-member-data', ['mkt', j.replace('}', ',"q":' + MK.q + '}')]);
    MK.st = 'host'; if (MK.q === 1 || MK.q % 40 === 0) blog('mkt published #' + MK.q + ' day ' + d + ' ' + j.length + ' bytes');
  }
  function mkFollowTick(g, L) {                 // follower: apply
    var om = null; L.members.forEach(function (m) { if (m.id === L.owner) om = m; });
    var raw = om && om.data && om.data.mkt; if (!raw) { MK.st = 'wait'; return; }
    if (raw === MK.raw) return;
    var hd = 0; try { hd = JSON.parse(raw).d | 0; } catch (e) { MK.st = 'bad'; return; }
    if (Math.abs(hd - (g.DayTotal | 0)) > 60) { MK.raw = raw; MK.st = 'far'; return; }
    var r = mkApply(raw); MK.raw = raw;
    if (!r) { MK.st = 'bad'; return; }
    MK.st = r.miss > r.n / 2 ? 'bad' : 'ok'; MK.day = r.day; MK.cnt = r.cnt; MK.miss = r.miss; MK.n = (MK.n || 0) + 1; if (MK.n === 1 || MK.n % 40 === 0) blog('mkt applied #' + MK.n + ' day ' + r.day + ' cells ' + r.cnt + ' miss ' + r.miss);
  }


  // ---------- shared stock market (host-authoritative) ----------
  // ArrayInvestingStocks: x = stock (91), y = 52 price points (shifted by the game on its weekly update days, prices in cents),
  // ArrayInvesting: x = stock, row 0 = company id, row 7 = 1 when the local player has taken the company over (its price then follows the
  // player's own strategy and is not overwritten). The host publishes the whole price table as lobby data
  // (stk = header, stk0..stk2 = delta/varint/base64 chunks); followers replace their table once their own weekly update for the same
  // period has run (so the game's own shift never double-counts) and recompute value/dividend rows with the game's own InvestingUpdate.
  var STK = { sig: 0, u: 0, dirty: true, lastPub: 0, q: 0, mem: '', raw: '', pend: null, st: '', n: 0, cnt: 0, err: 0 };
  function stkArrs() {
    try {
      var rt = RT.rt; if (!rt || !rt.objects.ArrayInvesting || !rt.objects.ArrayInvestingStocks) return null;
      var inv = rt.objects.ArrayInvesting.getFirstInstance(), px = rt.objects.ArrayInvestingStocks.getFirstInstance();
      if (!inv || !px || px.width < 1 || px.height < 2 || inv.width < 1) return null;
      return { inv: inv, px: px, n: Math.min(inv.width, px.width), h: px.height };
    } catch (e) { return null; }
  }
  function stkSig(a) { var s = 0, y = a.h - 1; for (var x = 0; x < a.n; x++) s = (s * 31 + Math.round((+a.px.getAt(x, y, 0) || 0) * 100)) | 0; return s; }
  function stkEncode(a) {
    var bytes = [];
    for (var x = 0; x < a.n; x++) {
      var prev = 0;
      for (var y = 0; y < a.h; y++) {
        var c = Math.round((+a.px.getAt(x, y, 0) || 0) * 100), d = c - prev, z = d < 0 ? -d * 2 - 1 : d * 2; prev = c;
        while (z > 127) { bytes.push((z % 128) | 128); z = Math.floor(z / 128); }
        bytes.push(z);
      }
    }
    var s = ''; for (var i = 0; i < bytes.length; i += 4096) s += String.fromCharCode.apply(null, bytes.slice(i, i + 4096));
    return btoa(s);
  }
  function stkDecode(b64, n, h) {
    var bin; try { bin = atob(b64); } catch (e) { return null; }
    var out = new Array(n * h), p = 0;
    for (var x = 0; x < n; x++) {
      var prev = 0;
      for (var y = 0; y < h; y++) {
        var z = 0, mul = 1, b;
        do { if (p >= bin.length) return null; b = bin.charCodeAt(p++); z += (b & 127) * mul; mul *= 128; } while (b & 128);
        prev += (z % 2) ? -(z + 1) / 2 : z / 2; out[x * h + y] = prev;
      }
    }
    return p === bin.length ? out : null;
  }
  function stkPublish(g, a) {
    var data = stkEncode(a), CH = 7000, parts = Math.ceil(data.length / CH);
    if (parts > 3) { STK.st = 'toobig'; return; }
    STK.q++; var ids = []; for (var x = 0; x < a.n; x++) ids.push(+a.inv.getAt(x, 0, 0) | 0);
    for (var i = 0; i < parts; i++) send('set-lobby-data', ['stk' + i, STK.q + '|' + data.slice(i * CH, (i + 1) * CH)]);
    send('set-lobby-data', ['stk', JSON.stringify({ q: STK.q, u: STK.u, d: g.DayTotal | 0, n: a.n, h: a.h, c: parts, ids: ids })]);
    STK.lastPub = Date.now(); STK.dirty = false; STK.st = 'host';
    if (STK.q === 1 || STK.q % 20 === 0) blog('stocks published #' + STK.q + ' day ' + (g.DayTotal | 0) + ' u=' + STK.u + ' ' + data.length + ' chars');
  }
  function stkHostTick(g) {
    var a = stkArrs(); if (!a) return;
    var now = Date.now(), day = g.DayTotal | 0, sig = stkSig(a);
    if (sig !== STK.sig) { STK.sig = sig; STK.u = day; STK.dirty = true; }
    var L = S.lobby, mem = ''; if (L) L.members.forEach(function (m) { mem += m.id + (m.data && m.data.state === 'play' ? 'p' : '-') + ','; });
    if (mem !== STK.mem) { STK.mem = mem; STK.dirty = true; }          // somebody joined or started playing: send now
    if ((STK.dirty && now - STK.lastPub >= 3000) || now - STK.lastPub >= 20000) stkPublish(g, a);
    if (!STK.rb && STK.q > 1 && L && L.data && L.data.stk) { STK.rb = 1; var rp = stkRead(L); blog('stocks read back from lobby data: ' + (rp ? 'ok q=' + rp.q + ' chars=' + rp.data.length : 'INCOMPLETE')); }
  }
  // follower: header + chunks -> pending payload (or null while incomplete)
  function stkRead(L) {
    var raw = L && L.data && L.data.stk; if (!raw) return null;
    var h; try { h = JSON.parse(raw); } catch (e) { return null; }
    if (!h || !(h.n > 0) || !(h.h > 1) || !(h.c >= 1 && h.c <= 3) || !Array.isArray(h.ids) || h.ids.length !== h.n) return null;
    var data = '';
    for (var i = 0; i < h.c; i++) {
      var ch = L.data['stk' + i]; if (typeof ch !== 'string') return null;
      var k = ch.indexOf('|'); if (k < 0 || ch.slice(0, k) !== String(h.q)) return null;
      data += ch.slice(k + 1);
    }
    return { raw: raw, q: h.q, u: h.u | 0, d: h.d | 0, n: h.n | 0, h: h.h | 0, ids: h.ids, data: data };
  }
  // returns number of changed cells, -1 when the data does not fit
  function stkApply(a, p) {
    if (p.h !== a.h || p.n > 200) return -1;
    var v = stkDecode(p.data, p.n, p.h); if (!v) return -1;
    var map = {}; for (var x = 0; x < a.n; x++) map[+a.inv.getAt(x, 0, 0) | 0] = x;
    var cnt = 0, miss = 0;
    for (var i = 0; i < p.n; i++) {
      var lx = map[p.ids[i]]; if (lx === undefined) { miss++; continue; }
      if (+a.inv.getAt(lx, 7, 0) === 1) continue;                                // taken over by this player: local strategy
      for (var y = 0; y < p.h; y++) {
        var val = v[i * p.h + y] / 100;
        if (Math.abs((+a.px.getAt(lx, y, 0) || 0) - val) > 0.004) { try { a.px.setAt(val, lx, y, 0); cnt++; } catch (e) {} }
      }
    }
    if (miss > p.n / 2) return -1;
    return cnt;
  }
  function stkFollowTick(g, L) {
    var a = stkArrs(); if (!a) return;
    var p = stkRead(L);
    if (p && p.raw !== STK.raw) { STK.raw = p.raw; STK.pend = p; }
    var P = STK.pend; if (!P) { if (!STK.st) STK.st = 'wait'; return; }
    var day = g.DayTotal | 0;
    if (day - P.u > 14) { STK.pend = null; STK.st = 'far'; return; }               // we are far ahead of the host
    if (day < P.u + 1) { STK.st = 'wait'; return; }                                // our own weekly update for that period has not run yet
    STK.pend = null;
    var c = stkApply(a, P);
    if (c < 0) { STK.st = 'bad'; return; }
    STK.st = 'ok'; STK.n++; STK.cnt = c; STK.sig = stkSig(a);
    if (c > 0) { try { RT.rt.callFunction('InvestingUpdate'); } catch (e) {} }
    if (STK.n === 1 || STK.n % 20 === 0) blog('stocks applied #' + STK.n + ' host day ' + P.d + ' u=' + P.u + ' cells ' + c);
  }


  // ---------- other players' companies in the game's own company list ----------
  // The game's "Statistics -> Market" page (and its monthly share chart) is built from ArrayRatingsCompanies:
  // x = company, row 0 id (-1 = the player), 1/2 = first/last year, 4 = yearly revenue ($B), 6 = value ($B), 7 = fans (M), 8 = growth (%);
  // names come from ArrayCompanyNames[id]. Each remote player takes over one AI column that does not exist yet (latest start year);
  // the host publishes the chosen ids in lobby data "pc". Originals are restored when the player leaves.
  var PC = { res: {}, orig: {}, ids: [], pickT: 0, tick: 0 };
  function pcNames() { try { var rt = RT.rt; return rt && rt.objects.ArrayCompanyNames ? rt.objects.ArrayCompanyNames.getFirstInstance() : null; } catch (e) { return null; } }
  function pcFindCol(a, id) { for (var x = 0; x < a.width; x++) if (+a.getAt(x, 0, 0) === id) return x; return -1; }
  function pcPick(a) {
    var c = [];
    for (var x = 0; x < a.width; x++) {
      var id = +a.getAt(x, 0, 0); if (!(id >= 0) || id >= 600) continue;
      var y0 = +a.getAt(x, 1, 0) || 0, y1 = +a.getAt(x, 2, 0) || 9999;
      if (y1 < y0) continue;
      c.push({ id: id, y0: y0 });
    }
    c.sort(function (p, q) { return (q.y0 - p.y0) || (q.id - p.id); });
    return c.slice(0, 4).map(function (z) { return z.id; });
  }
  function pcIdsFrom(L) {
    var raw = L && L.data && L.data.pc, out = [];
    if (raw) String(raw).split(',').forEach(function (v) { var n = parseInt(v, 10); if (n >= 0 && n < 600 && out.indexOf(n) < 0 && out.length < 4) out.push(n); });
    return out;
  }
  function pcSetIds(ids) { PC.ids = ids; PC.res = {}; ids.forEach(function (i) { PC.res[i] = 1; }); }
  function pcRestore() {
    var a = mkArr(), nm = pcNames();
    Object.keys(PC.orig).forEach(function (k) {
      var o = PC.orig[k];
      try {
        if (a) { var x = pcFindCol(a, +k); if (x >= 0) { a.setAt(o.y1, x, 1, 0); a.setAt(o.y2, x, 2, 0); [4, 6, 7, 8].forEach(function (r, i) { a.setAt(o.r[i], x, r, 0); }); } }
        if (nm) { nm.setAt(o.n0, +k, 0, 0); nm.setAt(o.n1, +k, 1, 0); }
      } catch (e) {}
    });
    PC.orig = {};
  }
  function memberLess(a, b) { a = String(a); b = String(b); return a.length !== b.length ? a.length - b.length : (a < b ? -1 : a > b ? 1 : 0); }
  function pcTick() {
    var L = S.lobby, g = gv();
    if (!L || !g || !inGame()) { if (Object.keys(PC.orig).length && !L) pcRestore(); return; }
    var a = mkArr(), nm = pcNames(); if (!a || !nm || a.height < 9) return;
    var ids = pcIdsFrom(L);
    if (!ids.length) {                           // host chooses the columns once per lobby
      if (L.owner === S.me && Date.now() - PC.pickT > 3000) {
        PC.pickT = Date.now(); var p = pcPick(a);
        if (p.length) { send('set-lobby-data', ['pc', p.join(',')]); blog('pc slots picked ' + p.join(',')); }
      }
      return;
    }
    if (ids.join() !== PC.ids.join()) { pcRestore(); pcSetIds(ids); }
    var mem = L.members.slice().sort(function (x, y) { return memberLess(x.id, y.id); });
    var used = {}; PC.view = [];
    mem.forEach(function (m, i) {
      if (i >= ids.length) return;
      var id = ids[i];
      if (m.id === S.me) return;                  // my own company is the game's own "player" column
      var st = memberStats(m);
      if (!st || !st.CompanyName || !(m.data && m.data.state === 'play')) return;
      var x = pcFindCol(a, id); if (x < 0) return;
      used[id] = 1; PC.view.push(id);
      if (!PC.orig[id]) PC.orig[id] = { y1: a.getAt(x, 1, 0), y2: a.getAt(x, 2, 0), r: [4, 6, 7, 8].map(function (r) { return a.getAt(x, r, 0); }), n0: nm.getAt(id, 0, 0), n1: nm.getAt(id, 1, 0) };
      var nmv = cleanCo(st.CompanyName) || cleanText(m.name).slice(0, 24) || 'Player';
      if (+a.getAt(x, 1, 0) !== 0) a.setAt(0, x, 1, 0);
      if (+a.getAt(x, 2, 0) !== 9999) a.setAt(9999, x, 2, 0);
      var pr = Array.isArray(st.pr) ? st.pr : null;
      [4, 6, 7, 8].forEach(function (r, i) { var v = pr ? +pr[i] || 0 : 0; if (+a.getAt(x, r, 0) !== v) a.setAt(v, x, r, 0); });
      if (nm.getAt(id, 0, 0) !== nmv) nm.setAt(nmv, id, 0, 0);
      if (nm.getAt(id, 1, 0) !== nmv) nm.setAt(nmv, id, 1, 0);
    });
    Object.keys(PC.orig).forEach(function (k) {   // player gone / not in a game: give the slot back
      if (used[k]) return;
      var o = PC.orig[k], x = pcFindCol(a, +k);
      try {
        if (x >= 0) { a.setAt(o.y1, x, 1, 0); a.setAt(o.y2, x, 2, 0); [4, 6, 7, 8].forEach(function (r, i) { a.setAt(o.r[i], x, r, 0); }); }
        nm.setAt(o.n0, +k, 0, 0); nm.setAt(o.n1, +k, 1, 0);
      } catch (e) {}
      delete PC.orig[k];
    });
  }

  // The game's market page lists only the top 10 companies plus the player. Remote players are real rows of the ratings
  // array (they count in "position #n / total"), but when they are outside the top 10 we add their rows to the page.
  var SI = { timer: 0, sig: '' };
  function fmtMoneyB(b) {                       // b = billions of dollars
    var v = b * 1e9, a = Math.abs(v);
    function f(x, u) { return '$' + (x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '') + u; }
    return a >= 1e12 ? f(v / 1e12, 'T') : a >= 1e9 ? f(v / 1e9, 'B') : a >= 1e6 ? f(v / 1e6, 'M') : a >= 1e3 ? f(v / 1e3, 'K') : '$' + Math.round(v);
  }
  function statsInject() {
    if (!S.lobby || !PC.view || !PC.view.length) return;
    var me = document.querySelector('.st-comp-me'); if (!me || !me.parentNode) return;
    var box = me.parentNode, a = mkArr(), nm = pcNames(), g = gv(); if (!a || !nm || !g) return;
    var year = +g.Year || 2008, rows = [], total = 0;
    for (var x = 0; x < a.width; x++) {
      var id = +a.getAt(x, 0, 0);
      if (id !== -1) { var y0 = +a.getAt(x, 1, 0) || 0, y1 = +a.getAt(x, 2, 0) || 9999; if (y1 >= 2026) y1 = 9999; if (year < y0 || year > y1) continue; }
      var earn = +a.getAt(x, 4, 0) || 0; if (earn > 0) total += earn;
      rows.push({ id: id, earn: earn });
    }
    rows.sort(function (p, q) { return q.earn - p.earn; });
    var top = rows.length ? Math.max(1e-4, rows[0].earn) : 1;
    var want = [];
    PC.view.forEach(function (id) {
      var k = -1; for (var i = 0; i < rows.length; i++) if (rows[i].id === id) { k = i; break; }
      if (k < 10) return;                         // already shown natively (or not active)
      var name = (nm.getAt(id, 1, 0) || nm.getAt(id, 0, 0) || '#' + id);
      want.push({ place: k + 1, name: String(name), earn: rows[k].earn });
    });
    var sig = want.map(function (w) { return w.place + '|' + w.name + '|' + w.earn; }).join(';') + '#' + box.querySelectorAll('.st-comp-row').length;
    if (box.getAttribute('data-dtm') === sig) return;
    Array.prototype.slice.call(box.querySelectorAll('[data-dtmrow]')).forEach(function (n) { n.parentNode.removeChild(n); });
    var items = [];
    var mePlace = parseInt((me.querySelector('.st-comp-place') || {}).textContent, 10) || 1e9;
    items.push({ place: mePlace, node: me });
    want.forEach(function (w, i) {
      var n = me.cloneNode(true); n.classList.remove('st-comp-me'); n.setAttribute('data-dtmrow', '1');
      var q = function (c) { return n.querySelector(c); };
      if (q('.st-comp-place')) q('.st-comp-place').textContent = String(w.place);
      if (q('.st-comp-name')) q('.st-comp-name').textContent = w.name;
      if (q('.st-fill')) q('.st-fill').style.width = Math.max(3, w.earn / top * 100).toFixed(1) + '%';
      if (q('.st-geo-pct')) q('.st-geo-pct').textContent = (total > 0 ? w.earn / total * 100 : 0).toFixed(2) + '%';
      if (q('.st-geo-val')) q('.st-geo-val').textContent = fmtMoneyB(w.earn);
      items.push({ place: w.place, node: n });
    });
    items.sort(function (p, q) { return p.place - q.place; });
    items.forEach(function (it) { box.appendChild(it.node); });
    box.setAttribute('data-dtm', sig.replace(/#\d+$/, '#' + box.querySelectorAll('.st-comp-row').length));
  }
  function statsSoon() { if (SI.timer) return; SI.timer = setTimeout(function () { SI.timer = 0; try { statsInject(); } catch (e) { if ((SI.err = (SI.err || 0) + 1) < 3) blog('stats inject error ' + e); } }, 150); }
  try { new MutationObserver(function () { if (S.lobby && PC.view && PC.view.length) statsSoon(); }).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}

  function myRatings() {                         // the game's own numbers for my company: [revenue $B, value $B, fans M, growth %]
    var a = mkArr(); if (!a || a.height < 9) return null;
    if (PC.meX === undefined || +a.getAt(PC.meX, 0, 0) !== -1) { PC.meX = pcFindCol(a, -1); }
    if (PC.meX < 0) return null;
    return [4, 6, 7, 8].map(function (r) { var v = +a.getAt(PC.meX, r, 0) || 0; return +v.toPrecision(6); });
  }

  // ---------- trading: money / research coins between players ----------
  // sender: deducts, publishes member key "tx" (last 6 entries); receiver: credits once per (sender, seq), then publishes "ack".
  var TX = { out: [], log: [], seen: {}, seq: Date.now(), acks: {} };
  try { var _s = JSON.parse(localStorage.getItem('dtmod.txseen') || '{}'); if (_s && typeof _s === 'object') TX.seen = _s; } catch (e) {}
  function saveSeen() { try { localStorage.setItem('dtmod.txseen', JSON.stringify(TX.seen)); } catch (e) {} }
  var CURS = { c: 'Budget', r: 'ResearchCoins' };
  function pubTx() { send('set-member-data', ['tx', JSON.stringify({ m: TX.out.filter(function (x) { return x.st === 'pending'; }).slice(-6).map(function (x) { return [x.seq, x.to, x.cur, x.amt]; }) })]); }
  function sendMoney(toId, cur, amt) {
    var g = gv(), L = S.lobby;
    if (!L || !g || !inGame()) return 'txnoplay';
    amt = Math.floor(+amt);
    if (!(amt >= 1) || !(amt <= 1e12) || !CURS[cur]) return 'txbad';
    var ok = false, nm = ''; L.members.forEach(function (m) { if (m.id === toId && m.id !== S.me) { ok = true; nm = cleanText(m.name || m.id).slice(0, 40); } });
    if (!ok) return 'txnoone';
    var k = CURS[cur];
    if (!(+g[k] >= amt)) return 'txmuch';
    g[k] = +g[k] - amt;
    TX.seq = Math.max(TX.seq + 1, Date.now());
    var e = { seq: TX.seq, to: toId, cur: cur, amt: amt, st: 'pending', who: nm, dir: 'out', ts: Date.now() };
    TX.out.push(e); TX.log.push(e); pubTx();
    return '';
  }
  function processTx(L) {
    if (!L) return;
    var g = gv(), present = {}, changed = false;
    L.members.forEach(function (m) { present[m.id] = true; });
    // incoming
    if (g && inGame()) L.members.forEach(function (m) {
      if (m.id === S.me || !m.data || !m.data.tx) return;
      var o = null; try { o = JSON.parse(m.data.tx); } catch (e) { return; }
      if (!o || !Array.isArray(o.m)) return;
      o.m.slice(-8).forEach(function (q) {
        if (!Array.isArray(q) || q[1] !== S.me) return;
        var seq = +q[0], cur = q[2], amt = Math.floor(+q[3]);
        if (!(seq > (TX.seen[m.id] || 0)) || !CURS[cur] || !(amt >= 1) || !(amt <= 1e12)) return;
        g[CURS[cur]] = (+g[CURS[cur]] || 0) + amt;
        TX.seen[m.id] = seq; saveSeen(); changed = true;
        var nm = cleanText(m.name || m.id).slice(0, 40);
        var le = { dir: 'in', who: nm, cur: cur, amt: amt, st: 'done', ts: Date.now() };
        TX.log.push(le);
        toast({ sys: null, name: nm, text: '+' + fmtNum(amt) + ' ' + (cur === 'c' ? '$' : t('rcoins')) });
      });
    });
    if (changed) { var a = {}; Object.keys(TX.seen).forEach(function (k) { if (present[k]) a[k] = TX.seen[k]; }); send('set-member-data', ['ack', JSON.stringify(a)]); }
    // outgoing: acknowledged or refunded
    var mine = TX.out.filter(function (x) { return x.st === 'pending'; });
    if (mine.length) {
      var ch2 = false;
      mine.forEach(function (x) {
        var rm = null; L.members.forEach(function (m) { if (m.id === x.to) rm = m; });
        if (!rm) { if (g) { g[CURS[x.cur]] = (+g[CURS[x.cur]] || 0) + x.amt; x.st = 'refunded'; ch2 = true; } return; }
        var ak = null; try { ak = rm.data && rm.data.ack ? JSON.parse(rm.data.ack) : null; } catch (e) {}
        if (ak && +ak[S.me] >= x.seq) { x.st = 'done'; ch2 = true; }
      });
      if (ch2) pubTx();
    }
  }

  // ---------- voice chat (native module does capture/compress/send/play; JS = controls) ----------
  var VC = { on: true, mode: 'ptt', key: 'KeyV', vol: 100, muted: {}, speaking: {}, mic: false, pttDown: 0, binding: false };
  try { var _v = JSON.parse(localStorage.getItem('dtmod.voice') || 'null'); if (_v && typeof _v === 'object') { if (typeof _v.on === 'boolean') VC.on = _v.on; if (_v.mode === 'ptt' || _v.mode === 'open') VC.mode = _v.mode; if (typeof _v.key === 'string' && /^[A-Za-z0-9]{1,16}$/.test(_v.key)) VC.key = _v.key; if (_v.vol >= 0 && _v.vol <= 200) VC.vol = +_v.vol; } } catch (e) {}
  function saveVoice() { try { localStorage.setItem('dtmod.voice', JSON.stringify({ on: VC.on, mode: VC.mode, key: VC.key, vol: VC.vol })); } catch (e) {} }
  function keyLabel(c) { return String(c).replace(/^Key/, '').replace(/^Digit/, ''); }
  function voiceCfg() { send('voice-cfg', [VC.vol, VC.on ? 0 : 1]); }
  function setMic(on) {
    on = !!on && VC.on && !!S.lobby;
    if (on === VC.mic) return;
    VC.mic = on; send('voice-mic', [on ? 1 : 0]);
  }
  function voiceSync() {            // called often: apply mode, release stuck PTT
    if (!S.lobby || !VC.on) { if (VC.mic) setMic(false); return; }
    if (VC.mode === 'open') setMic(true);
    else if (VC.mic && Date.now() - VC.pttDown > 1300) setMic(false);
  }
  function setMuted(id, on) { if (on) VC.muted[id] = 1; else delete VC.muted[id]; send('voice-mute', [String(id), on ? 1 : 0]); }
  function isSpeaking(id) { return !!VC.speaking[id]; }

  // ---------- ranking ----------
  function ranking() {
    var L = S.lobby; if (!L) return [];
    var rows = L.members.map(function (m) {
      var st = memberStats(m);
      return { id: m.id, name: cleanText(m.name || m.id).slice(0, 40), st: st, nw: st ? netWorth(st) : -Infinity, me: m.id === S.me };
    });
    rows.sort(function (a, b) { return b.nw - a.nw; });
    return rows;
  }


  function dumpObjects() {
    var rt = RT.rt; if (!rt || !rt.objects) { blog('objdump: no rt.objects'); return; }
    var out = {}, names = [];
    try { names = Object.keys(rt.objects); } catch (e) { blog('objdump keys failed ' + e); }
    blog('objdump: ' + names.length + ' object classes');
    names.forEach(function (n) {
      var o = {};
      try {
        var cls = rt.objects[n]; if (!cls) return;
        var inst = cls.getAllInstances ? cls.getAllInstances() : [];
        o.n = inst.length;
        if (inst.length) {
          var i0 = inst[0];
          if (typeof i0.width === 'number' && typeof i0.getAt === 'function' && /^Array/i.test(n)) {
            o.dim = [i0.width, i0.height, i0.depth];
            var rows = [];
            for (var y = 0; y < Math.min(i0.height, 4); y++) { var r = []; for (var x = 0; x < Math.min(i0.width, 40); x++) { try { r.push(i0.getAt(x, y, 0)); } catch (e) { r.push(null); } } rows.push(r); }
            o.rows = rows;
          } else if (i0.instVars) {
            var iv = {}; try { Object.keys(i0.instVars).slice(0, 40).forEach(function (k) { var v = i0.instVars[k]; if (typeof v !== 'object') iv[k] = v; }); } catch (e) {}
            o.iv = iv;
          }
        }
      } catch (e) { o.err = String(e).slice(0, 60); }
      out[n] = o;
    });
    send('dump', ['objs', JSON.stringify(out)]);
    blog('objdump written');
  }

  // ---------- public API for later gameplay-sync stages ----------
  window.DTMod = window.__DTMOD__ = {
    version: VER,
    state: S,
    send: send,
    on: function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    setMemberData: function (k, v) { send('set-member-data', [k, typeof v === 'string' ? v : JSON.stringify(v)]); },
    setLobbyData: function (k, v) { send('set-lobby-data', [k, typeof v === 'string' ? v : JSON.stringify(v)]); },
    isHost: function () { return !!(S.lobby && S.lobby.owner === S.me); },
    voice: VC, voiceLoop: function (on) { send('voice-loop', [on ? 1 : 0]); }, setMic: setMic,
    sendMoney: sendMoney, tx: TX, clock: CK, stocks: STK, ranking: ranking, fakeHost: function (d, sp, p) { var g = gv(); CK.fake = d == null ? null : { d: d, s: sp || 1.2, p: p ? 1 : 0, recv: Date.now() }; },
    readStats: function () { return readStats(); }, dump: function (t) { dumpVars(t); },
    open: function () { S.open = true; render(); }, close: function () { S.open = false; render(); },
    game: { start: function () { return hostStart(); }, announce: function () { return hostAnnounce(); }, join: function () { return startNewGame('api', true); }, cd: function () { return CD; }, tick: function () { return cdTick(); }, date: function (n) { return dateParts(n); } }
  };


  // ---------- game runtime access (runtime runs on the main thread: useWorker=false) ----------
  var RT = { rt: null, layout: '' };
  var onLayout = function () {};
  (function hookRunOnStartup() {
    try {
      var real = null;
      Object.defineProperty(self, 'runOnStartup', {
        configurable: true, enumerable: true,
        get: function () { return real; },
        set: function (f) {
          real = f;
          try {
            f(function (rt) {
              RT.rt = rt; window.DTMod && (window.DTMod.rt = rt);
              var upd = function (e) {
                var n = '';
                try { n = (e && e.layout && e.layout.name) || (rt.layout ? rt.layout.name : ''); } catch (x) { n = ''; }
                if (n !== RT.layout) { RT.layout = n; blog('layout -> ' + n); if (n === 'LOADING GAME') { try { PC.orig = {}; PC.meX = undefined; } catch (x) {} }
                if (n === 'LOADING GAME' || n === 'BOSS OFFICE') { try { STK.raw = ''; STK.pend = null; STK.sig = 0; STK.dirty = true; } catch (x) {} }
                if (n === 'BOSS OFFICE' && GM.fresh && Date.now() - GM.fresh < 60000) { try { var gg = rt.globalVars; if (gg) { gg.TutorialStage = 999; blog('tutorial skipped, stage=' + gg.TutorialStage + ' slot=' + gg.SaveSlot + ' day=' + gg.DayTotal); } } catch (x) {} GM.fresh = 0; GM.jump = GM.want ? Date.now() : 0; GM.want = false; } onLayout(n); }
              };
              rt.addEventListener('beforeanylayoutstart', upd);
              rt.addEventListener('afteranylayoutstart', upd);
              RT.poll = function () { upd(null); };
              upd(); blog('runtime hooked, layout=' + RT.layout);
            });
          } catch (e) { blog('runOnStartup hook failed: ' + e); }
        }
      });
    } catch (e) { blog('hook setup failed: ' + e); }
  })();


  // ---------- DOM helpers ----------
  function el(tag, cls, text, kids) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    if (kids) kids.forEach(function (k) { if (k) n.appendChild(k); });
    return n;
  }
  function btn(label, fn, cls) {
    var b = el('button', 'dtm-btn ' + (cls || ''), label);
    b.addEventListener('click', function (ev) { ev.stopPropagation(); fn(); });
    return b;
  }

  var CSS = '@font-face{font-family:"DTM Oswald";src:url("fonts/Oswald.ttf");font-weight:100 900}' +
    ':root{--dtm-gold:#f5a623;--dtm-gold2:#ffc86b;--dtm-ink:#e9eef5;--dtm-mute:#8f9db0;--dtm-bg:rgba(10,17,29,.93);--dtm-line:rgba(255,255,255,.10)}' +
    '#dtm-win,#dtm-win *,#dtm-hud,#dtm-toast,#dtm-fab,#dtm-menu{font-family:"DTM Oswald",Oswald,"Arial Narrow",Arial,sans-serif}' +
    '#dtm-menu{box-sizing:border-box;position:fixed;z-index:2147482000;display:none;align-items:center;gap:14px;padding:0 0 0 22px;color:#fff;background:rgba(255,255,255,.22);backdrop-filter:blur(6px);border-radius:8px;cursor:pointer;user-select:none;font-weight:400;letter-spacing:.3px;text-transform:uppercase;transition:background .15s;box-shadow:0 2px 10px #0004}' +
    '#dtm-menu:hover{background:linear-gradient(90deg,#b9801f,#e2a63f)}#dtm-menu svg{flex:none;fill:#fff}#dtm-menu small{opacity:.8;font-size:.6em;margin-left:6px}' +
    '#dtm-fab{position:fixed;right:12px;top:12px;z-index:2147483000;background:rgba(14,52,84,.72);backdrop-filter:blur(6px);color:#fff;border:1px solid rgba(120,200,255,.45);border-radius:20px;padding:5px 14px;font-size:14px;font-weight:400;letter-spacing:.4px;text-transform:uppercase;cursor:pointer;box-shadow:0 2px 10px #0006;display:none}' +
    '#dtm-fab:hover{border-color:var(--dtm-gold);color:var(--dtm-gold2)}' +
    '#dtm-win{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:600px;max-width:94vw;max-height:86vh;overflow:auto;z-index:2147483001;background:linear-gradient(180deg,rgba(18,28,46,.94),var(--dtm-bg));backdrop-filter:blur(12px);color:var(--dtm-ink);border:1px solid rgba(245,166,35,.45);border-radius:16px;font-size:16px;font-weight:300;letter-spacing:.2px;line-height:1.4;box-shadow:0 18px 60px #000c,0 0 0 1px #0006,0 0 26px rgba(245,166,35,.10);display:none;color-scheme:dark;scrollbar-width:thin;scrollbar-color:#f5a62366 transparent}' +
    '#dtm-win *{box-sizing:border-box}' +
    '.dtm-h{display:flex;align-items:center;justify-content:space-between;padding:14px 18px 12px;border-bottom:1px solid transparent;border-image:linear-gradient(90deg,rgba(245,166,35,.7),rgba(245,166,35,0)) 1;font-size:24px;font-weight:500;line-height:1;text-transform:uppercase;letter-spacing:1px;color:var(--dtm-gold2)}' +
    '.dtm-x{background:none;border:0;color:var(--dtm-mute);font-size:24px;cursor:pointer;line-height:1;padding:0 4px}.dtm-x:hover{color:#fff}' +
    '.dtm-tabs{display:flex;gap:4px;padding:8px 12px 0;border-bottom:1px solid var(--dtm-line)}' +
    '.dtm-tab{flex:1;padding:8px 2px 9px;background:none;border:0;border-bottom:2px solid transparent;border-radius:8px 8px 0 0;color:var(--dtm-mute);cursor:pointer;font:inherit;font-size:14px;font-weight:400;text-transform:uppercase;letter-spacing:.6px;transition:color .12s,background .12s}' +
    '.dtm-tab:hover{color:#fff;background:rgba(255,255,255,.05)}.dtm-tab.on{color:var(--dtm-gold2);border-bottom-color:var(--dtm-gold);background:rgba(245,166,35,.09)}' +
    '.dtm-b{padding:14px 18px}.dtm-row{display:flex;align-items:center;gap:8px;margin:8px 0}.dtm-row>.grow{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.dtm-btn{background:linear-gradient(180deg,#ffd08a,#f59a31);color:#2a1700;border:0;border-radius:11px;padding:8px 18px;font:inherit;font-size:15px;font-weight:500;text-transform:uppercase;letter-spacing:.6px;cursor:pointer;box-shadow:0 2px 8px #0005;transition:filter .12s,transform .05s}' +
    '.dtm-btn:hover{filter:brightness(1.08)}.dtm-btn:active{transform:translateY(1px)}' +
    '.dtm-btn.sec{background:rgba(255,255,255,.09);color:var(--dtm-ink);border:1px solid rgba(255,255,255,.16);box-shadow:none}.dtm-btn.sec:hover{background:rgba(255,255,255,.16);filter:none}' +
    '.dtm-btn.red{background:rgba(190,52,52,.28);color:#ff9d9d;border:1px solid rgba(220,80,80,.55);box-shadow:none}.dtm-btn.red:hover{background:rgba(190,52,52,.45);filter:none}' +
    '.dtm-btn:disabled{opacity:.45;cursor:default;filter:grayscale(.4)}' +
    '.dtm-in,.dtm-sel{width:100%;background:rgba(0,0,0,.35);color:var(--dtm-ink);border:1px solid rgba(255,255,255,.14);border-radius:10px;padding:8px 11px;font:inherit;font-size:16px;font-weight:300;outline:none;transition:border-color .12s}' +
    '.dtm-in:focus,.dtm-sel:focus{border-color:var(--dtm-gold)}.dtm-sel option{background:#121c2e}' +
    '.dtm-lbl{color:var(--dtm-mute);font-size:12px;font-weight:400;text-transform:uppercase;letter-spacing:1px;margin-top:11px}.dtm-muted{color:var(--dtm-mute);font-size:15px}.dtm-err{color:#ff8d8d;margin:8px 0}' +
    '#dtm-win input[type=checkbox],#dtm-win input[type=range]{accent-color:var(--dtm-gold)}' +
    '#dtm-toast{position:fixed;left:14px;bottom:14px;max-width:420px;z-index:2147482500;background:rgba(14,52,84,.82);backdrop-filter:blur(8px);color:#fff;border:1px solid rgba(120,200,255,.4);border-radius:12px;padding:9px 14px;font-size:15px;font-weight:300;line-height:1.3;display:none;pointer-events:none;box-shadow:0 4px 18px #0007}' +
    '#dtm-toast b{color:var(--dtm-gold2);font-weight:500}' +
    '.dtm-log{height:250px;overflow-y:auto;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:9px 11px;font-size:15px;word-wrap:break-word;scrollbar-width:thin;scrollbar-color:#f5a62366 transparent}.dtm-log div{margin:3px 0}.dtm-log .sys{color:var(--dtm-mute);font-style:italic}.dtm-log b{color:#6cc6ff;font-weight:500}.dtm-log b.me{color:var(--dtm-gold2)}' +
    '.dtm-lang{display:flex;gap:0;margin-right:12px;border:1px solid rgba(255,255,255,.16);border-radius:8px;overflow:hidden}.dtm-lang button{background:transparent;border:0;color:var(--dtm-mute);padding:4px 10px;font:inherit;font-size:13px;font-weight:500;letter-spacing:.8px;cursor:pointer}.dtm-lang button.on{background:linear-gradient(180deg,#ffd08a,#f59a31);color:#2a1700}' +
    '.dtm-badge{display:inline-block;min-width:17px;padding:0 5px;margin-left:5px;border-radius:9px;background:#e5484d;color:#fff;font-size:11px;line-height:17px;text-align:center}' +
    '#dtm-hud{position:fixed;left:12px;top:92px;z-index:2147482400;background:rgba(14,52,84,.7);backdrop-filter:blur(6px);color:#fff;border:1px solid rgba(120,200,255,.35);border-radius:12px;padding:6px 12px;font-size:14px;font-weight:300;line-height:1.4;display:none;cursor:pointer;max-width:260px;box-shadow:0 2px 12px #0006}#dtm-hud:hover{border-color:var(--dtm-gold)}#dtm-hud div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#dtm-hud .me{color:var(--dtm-gold2)}#dtm-hud .h{color:#9fd2f5;font-size:12px;text-transform:uppercase;letter-spacing:1px}' +
    '#dtm-win.scene{left:0;top:0;transform:none;max-width:none;max-height:none;border-radius:0;border:0;overflow:auto;background:radial-gradient(ellipse at 20% -10%,rgba(36,62,104,.97),rgba(8,13,24,.985) 62%);backdrop-filter:blur(16px);box-shadow:none}' +
    '.dtm-scene{min-height:100%;display:flex;flex-direction:column}' +
    '.dtm-top{display:flex;align-items:center;gap:16px;padding:26px 56px 12px;border-bottom:1px solid transparent;border-image:linear-gradient(90deg,rgba(245,166,35,.7),rgba(245,166,35,0)) 1;margin:0 0 6px}' +
    '.dtm-title{flex:1;font-size:46px;font-weight:600;line-height:1;text-transform:uppercase;letter-spacing:3px;color:#fff}.dtm-title small{display:block;margin-top:8px;font-size:15px;font-weight:400;letter-spacing:2px;color:var(--dtm-gold2)}' +
    '.dtm-back{width:46px;height:46px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-size:30px;line-height:1;cursor:pointer;padding:0 0 4px}.dtm-back:hover{border-color:var(--dtm-gold);color:var(--dtm-gold2)}' +
    '.dtm-x.big{font-size:38px;margin-left:8px}' +
    '.dtm-stage{width:100%;max-width:1240px;margin:0 auto;padding:18px 56px 20px;flex:1}.dtm-stage.dtm-narrow{max-width:760px}' +
    '.dtm-cards{display:grid;grid-template-columns:1fr 1fr;gap:34px;margin:46px 0 26px}' +
    '.dtm-bigcard{cursor:pointer;padding:44px 40px 40px;border-radius:20px;border:1px solid rgba(255,255,255,.12);background:linear-gradient(160deg,rgba(255,255,255,.09),rgba(255,255,255,.03));box-shadow:0 10px 40px #0007;transition:transform .12s,border-color .12s,background .12s}' +
    '.dtm-bigcard:hover{transform:translateY(-3px);border-color:var(--dtm-gold);background:linear-gradient(160deg,rgba(245,166,35,.22),rgba(245,166,35,.05))}.dtm-bigcard.off{opacity:.45;cursor:default}.dtm-bigcard.off:hover{transform:none;border-color:rgba(255,255,255,.12)}' +
    '.dtm-bigcard .ic{width:76px;height:76px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:44px;background:linear-gradient(180deg,#ffd08a,#f59a31);color:#2a1700;margin-bottom:22px}' +
    '.dtm-bigcard .ch{font-size:34px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:#fff}.dtm-bigcard .cp{margin-top:10px;font-size:18px;font-weight:300;color:var(--dtm-mute);line-height:1.45}' +
    '.dtm-c{text-align:center}.dtm-sm{font-size:13px}' +
    '.dtm-pn{background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.10);border-radius:16px;padding:16px 20px 18px;margin:0 0 16px}.dtm-pn .ph{font-size:13px;font-weight:500;text-transform:uppercase;letter-spacing:1.5px;color:var(--dtm-gold2);margin-bottom:10px}' +
    '.dtm-seg{display:flex;gap:6px;margin-top:6px}.dtm-seg button{flex:1;padding:10px 6px;border-radius:11px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:var(--dtm-ink);font:inherit;font-size:16px;font-weight:400;text-transform:uppercase;letter-spacing:.6px;cursor:pointer}' +
    '.dtm-seg button:hover{border-color:var(--dtm-gold)}.dtm-seg button.on{background:linear-gradient(180deg,#ffd08a,#f59a31);color:#2a1700;border-color:transparent;font-weight:500}' +
    '.dtm-bar{display:flex;align-items:center;gap:12px;margin:18px 0 6px}.dtm-bar .grow{flex:1}' +
    '.dtm-btn.big{font-size:22px;padding:15px 40px;border-radius:14px;letter-spacing:1.2px}.dtm-btn.big:disabled{filter:grayscale(.6)}' +
    '.dtm-lrow{display:flex;align-items:center;gap:12px;padding:10px 4px;border-bottom:1px solid var(--dtm-line)}.dtm-lrow:last-child{border-bottom:0}.dtm-lrow .grow{flex:1;min-width:0}.dtm-lrow .ln{font-size:19px;font-weight:400;color:#fff}' +
    '.dtm-cols{display:grid;grid-template-columns:1.15fr 1fr;gap:22px;align-items:start}.dtm-rcol{min-width:0}' +
    '.dtm-slot{display:flex;align-items:center;gap:14px;padding:12px 14px;margin:0 0 10px;border-radius:14px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.09)}.dtm-slot.me{border-color:rgba(245,166,35,.55);background:rgba(245,166,35,.08)}.dtm-slot.empty{border-style:dashed;background:transparent;opacity:.65}' +
    '.dtm-slot .grow{flex:1;min-width:0}.dtm-slot .av{flex:none;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:600;color:#2a1700;background:linear-gradient(180deg,#ffd08a,#f59a31);border:2px solid transparent}.dtm-slot.empty .av{background:rgba(255,255,255,.1);color:var(--dtm-mute)}.dtm-slot .av.sp{border-color:#6be38f;box-shadow:0 0 12px #6be38f99}' +
    '.dtm-slot .sn{font-size:19px;font-weight:500;color:#fff;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.dtm-slot .sc{font-size:16px;color:var(--dtm-gold2);font-weight:300;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.dtm-slot .st{display:flex;flex-direction:column;align-items:flex-end;gap:5px}' +
    '.dtm-kv{display:flex;justify-content:space-between;padding:4px 0;color:var(--dtm-mute)}.dtm-kv b{color:#fff;font-weight:400}.dtm-run{margin-top:12px;padding:8px 12px;border-radius:10px;background:rgba(52,168,83,.18);color:#8be3a5;font-size:15px}' +
    '.dtm-bar.sticky{position:sticky;bottom:0;z-index:2;margin:10px -20px 0;padding:16px 20px 14px;background:linear-gradient(180deg,rgba(8,13,24,0),rgba(8,13,24,.96) 32%)}.dtm-chatp .dtm-log{height:120px}.dtm-foot{padding:6px 56px 18px;text-align:center;font-size:13px}' +
    '#dtm-cd{position:fixed;inset:0;z-index:2147483200;display:none;align-items:center;justify-content:center;background:rgba(5,9,16,.72);backdrop-filter:blur(8px);color:var(--dtm-ink);font-family:"DTM Oswald",Oswald,"Arial Narrow",Arial,sans-serif}' +
    '#dtm-cd .box{min-width:420px;max-width:90vw;text-align:center;padding:34px 46px 30px;border-radius:20px;border:1px solid rgba(245,166,35,.55);background:linear-gradient(180deg,rgba(24,38,62,.97),rgba(10,17,29,.97));box-shadow:0 18px 70px #000c}' +
    '#dtm-cd .k{font-size:14px;letter-spacing:2px;text-transform:uppercase;color:var(--dtm-mute)}#dtm-cd .h{font-size:34px;font-weight:600;text-transform:uppercase;letter-spacing:1.5px;color:var(--dtm-gold2);margin:4px 0 10px}#dtm-cd .n{font-size:96px;font-weight:600;line-height:1;color:#fff}#dtm-cd .m{font-size:17px;font-weight:300;color:var(--dtm-mute);margin:8px 0 16px}#dtm-cd .r{display:flex;gap:12px;justify-content:center}' +
    '.dtm-tag{font-size:12px;font-weight:400;padding:1px 9px;border-radius:10px;background:rgba(255,255,255,.1);color:#cfd8e3;text-transform:uppercase;letter-spacing:.5px}.dtm-tag.g{background:rgba(52,168,83,.28);color:#8be3a5}.dtm-tag.b{background:rgba(245,166,35,.22);color:var(--dtm-gold2)}';

  function build() {
    var st = el('style', null, CSS);
    document.head.appendChild(st);
    dom.fab = el('button'); dom.fab.id = 'dtm-fab';
    dom.fab.addEventListener('click', function () { S.open = !S.open; render(); });
    dom.win = el('div'); dom.win.id = 'dtm-win';
    dom.win.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.id === 'dtm-chat-in' && window.__dtmChatGo) { e.preventDefault(); window.__dtmChatGo(); }
      e.stopPropagation();
    }, true);
    dom.win.addEventListener('keyup', function (e) { e.stopPropagation(); }, true);
    dom.win.addEventListener('keypress', function (e) { e.stopPropagation(); }, true);
    dom.menu = el('div'); dom.menu.id = 'dtm-menu';
    dom.menu.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>';
    dom.menuLabel = el('span'); dom.menu.appendChild(dom.menuLabel);
    dom.menu.addEventListener('click', function (e) { e.stopPropagation(); S.open = !S.open; render(); });
    ['mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart'].forEach(function (n) { dom.menu.addEventListener(n, function (e) { e.stopPropagation(); }); });
    dom.hud = el('div'); dom.hud.id = 'dtm-hud';
    dom.hud.addEventListener('click', function (e) { e.stopPropagation(); S.open = true; S.tab = 'rank'; render(); });
    dom.cd = el('div'); dom.cd.id = 'dtm-cd'; document.body.appendChild(dom.cd);
    document.body.appendChild(dom.hud);
    document.body.appendChild(dom.menu);
    document.body.appendChild(dom.fab);
    document.body.appendChild(dom.win);
  }

  // ---------- main-menu button placement (design space 1920x1080, items are 357x76 at x=71, pitch 95) ----------
  var MENU_LAYOUT = 'MENU';
  function placeMenu() {
    if (!dom.menu) return;
    if (RT.poll) RT.poll();
    var inMenu = RT.layout === MENU_LAYOUT;
    var c = document.querySelector('canvas');
    if (!inMenu || !c) { dom.menu.style.display = 'none'; return; }
    var r = c.getBoundingClientRect();
    var k = Math.min(r.width / 1920, r.height / 1080);
    var ox = r.left + (r.width - 1920 * k) / 2, oy = r.top + (r.height - 1080 * k) / 2;
    var st = dom.menu.style;
    st.display = 'flex';
    st.left = (ox + 71 * k) + 'px'; st.top = (oy + 641 * k) + 'px';
    st.width = (357 * k) + 'px'; st.height = (76 * k) + 'px';
    st.fontSize = (29 * k) + 'px';
    var svg = dom.menu.firstChild; svg.setAttribute('width', 34 * k); svg.setAttribute('height', 34 * k);
    st.gap = (18 * k) + 'px'; st.paddingLeft = (28 * k) + 'px';
  }
  onLayout = function () { placeMenu(); render(); };

  // ---------- game start / join: host presses "Start" -> everybody in the lobby starts a new game ----------
  var CO = ''; try { CO = localStorage.getItem('dtmod.co') || ''; } catch (e) {}
  var CC_NAMES = ["Afghanistan","Albania","Algeria","Andorra","Angola","Argentina","Armenia","Australia","Austria","Azerbaijan","Bahrain","Bangladesh","Belarus","Belgium","Bosnia and H.","Botswana","Brazil","Bulgaria","Cameroon","Canada","Chile","China","Colombia","Costa Rica","Cote-d'Ivoire","Croatia","Cuba","Cyprus","Czech Republic","Denmark","Dominican Republic","Ecuador","Egypt","England","Estonia","Finland","France","Georgia","Germany","Ghana","Gibraltar","Greece","Greenland","Guatemala","Guinea","Haiti","Honduras","Hong Kong","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy","Jamaica","Japan","Kazakhstan","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Liberia","Lithuania","Luxembourg","Macedonia","Madagascar","Malaysia","Maldives","Mali","Malta","Mexico","Moldova","Monaco","Mongolia","Montenegro","Morocco","Nepal","Netherlands","New Zealand","Nicaragua","Nigeria","North Korea","Norway","Pakistan","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Puerto Rico","Qatar","Romania","Russia","San Marino","Saudi Arabia","Scotland","Senegal","Serbia","Singapore","Slovakia","Slovenia","South Africa","South Korea","Spain","Sri Lanka","Sudan","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Thailand","Togo","Tunisia","Turkey","Turkmenistan","Ukraine","UAE","USA","United Kingdom","Uruguay","Uzbekistan","Venezuela","Vietnam","Wales","Yemen","Zambia","Zimbabwe"];   // = ArrayCountries rows, CompanyCountryID is the index
  var SL = 2; try { var _sl = parseInt(localStorage.getItem('dtmod.slot'), 10); if (_sl >= 0 && _sl < 3) SL = _sl; } catch (e) {}
  var CC = 125; try { var _cc = parseInt(localStorage.getItem('dtmod.cc'), 10); if (_cc >= 0 && _cc < CC_NAMES.length) CC = _cc; } catch (e) {}
  function cleanCo(x) { return String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f<>"\\{}]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24); }
  function myCo() { return cleanCo(CO) || cleanCo((S.name || 'Player').slice(0, 14) + ' Corp') || 'Company'; }
  var pm = { st: '', co: '' }, coT = 0;
  function pubMember(force) {                       // member keys: state = online|play, name = company name
    if (!S.lobby) return;
    if (force) { pm.st = ''; pm.co = ''; }
    var st = inGame() ? 'play' : 'online', co = myCo();
    if (st !== pm.st) { pm.st = st; send('set-member-data', ['state', st]); }
    if (co !== pm.co) { pm.co = co; send('set-member-data', ['name', co]); }
  }
  var LB = { init: false, n: 0 }, CD = null, GM = { fresh: 0, want: false, jump: 0 };
  function lobbyGame(L) { var raw = L && L.data && L.data.game; if (!raw) return null; try { var o = JSON.parse(raw); if (o && +o.n > 0) return o; } catch (e) {} return null; }
  function memberOf(L, id) { var r = null; if (L) L.members.forEach(function (m) { if (m.id === id) r = m; }); return r; }
  function hostName(L) { var m = memberOf(L, L && L.owner); return m ? cleanText(m.name || m.id).slice(0, 30) : ''; }
  function gameSync(L) {                            // called on every lobby update
    var g = lobbyGame(L), n = g ? +g.n : 0;
    if (!LB.init) { LB.init = true; LB.n = n; return; }       // state at the moment we arrived: never auto-start from it
    if (n && n !== LB.n) {
      LB.n = n;
      if (!g.run) { var om = memberOf(L, L.owner); CK.ignore = om && om.data && om.data.clk || ''; CK.host = null; }     // host restarts the world: its old clock is stale
      if (L.owner !== S.me) offerStart(L, !!g.run);
    }
    else if (!n) LB.n = 0;
  }
  // The same thing the game's own "New game" screens do: set the answers, then go to the loading layout.
  // join = true: the host's world is already running, so the new company starts directly at the host's date
  function startNewGame(why, join) {
    var rt = RT.rt, g = gv();
    if (!rt || !g || typeof rt.goToLayout !== 'function') return 'no runtime';
    GM.want = !!join;
    var co = myCo();
    try {
      g.CompanyName = co; g.PlayerName = cleanCo(S.name || 'Player').slice(0, 20) || 'Player';
      // the game derives the start date from these; a previous game in this session (or a join jump) would leave its date behind
      g.Year = 2008; g.Month = 1; g.Day = 1; g.DayTotal = 0; g.DayInMonth = 0;
      g.LoadingType = 'NEW GAME'; g.SandboxMode = 0; g.CompanyCountryID = CC; g.CompanyCountryAddBudget = 0; g.SaveSlot = SL; g.PlayerRace = 0; g.PlayerSex = 0;
      blog('start new game (' + why + ') company=' + co + ' from layout ' + RT.layout);
      GM.fresh = Date.now(); g.TutorialStage = 999;
      S.open = false; CD = null; render(); renderCd();
      rt.goToLayout('LOADING GAME');
    } catch (e) { blog('start failed ' + e); return String(e); }
    return '';
  }
  function hostStart() {                            // host: new game for everybody (host included)
    var L = S.lobby; if (!L || L.owner !== S.me) return;
    var n = Date.now();
    send('set-lobby-data', ['game', JSON.stringify({ n: n, t: n })]); LB.n = n; LB.init = true;
    startNewGame('host');
  }
  function hostAnnounce() {                         // host already plays a save: let the others open their own companies in this world
    var L = S.lobby; if (!L || L.owner !== S.me) return;
    var n = Date.now();
    send('set-lobby-data', ['game', JSON.stringify({ n: n, t: n, run: 1 })]); LB.n = n; LB.init = true;
    S.open = false; render();
  }
  function joinRunning() { startNewGame('join', true); }
  function offerStart(L, run) {
    if (RT.layout === 'LOADING GAME') return;
    CD = { host: hostName(L), t0: Date.now(), ask: inGame(), shown: -1, run: !!run };
    S.open = false; render(); renderCd();
  }
  function renderCd() {
    if (!dom.cd) return;
    if (!CD) { dom.cd.style.display = 'none'; return; }
    var left = Math.max(0, Math.ceil((CD.t0 + 5000 - Date.now()) / 1000));
    if (!CD.ask && CD.shown === left) return;
    CD.shown = left;
    dom.cd.textContent = '';
    var box = el('div', 'box');
    box.appendChild(el('div', 'k', t('cdhost')));
    box.appendChild(el('div', 'h', CD.host || '…'));
    if (CD.ask) {
      box.appendChild(el('div', 'm', t('cdask')));
      var row = el('div', 'r');
      row.appendChild(btn(t('cdyes'), function () { startNewGame('confirm', CD && CD.run); }));
      row.appendChild(btn(t('cdno'), function () { CD = null; renderCd(); }, 'sec'));
      box.appendChild(row);
    } else {
      box.appendChild(el('div', 'n', String(left)));
      box.appendChild(el('div', 'm', t('cdstart')));
      var r2 = el('div', 'r'); r2.appendChild(btn(t('cancel'), function () { CD = null; renderCd(); }, 'sec')); box.appendChild(r2);
    }
    dom.cd.appendChild(box); dom.cd.style.display = 'flex';
  }
  function cdTick() {
    if (!CD) return;
    if (!CD.ask && Date.now() - CD.t0 >= 5000) { startNewGame('lobby', CD.run); return; }
    renderCd();
  }

  // ---------- views: full-screen "scene" (menu / lobby room) ----------
  var form = { name: '', vis: '1', max: '4' };
  S.scr = 'home';
  function seg(opts, val, fn) {
    var d = el('div', 'dtm-seg');
    opts.forEach(function (o) { var b = el('button', o[0] === val ? 'on' : '', o[1]); b.addEventListener('click', function (e) { e.stopPropagation(); fn(o[0]); }); d.appendChild(b); });
    return d;
  }
  function coField() {
    var w = el('div');
    w.appendChild(el('div', 'dtm-lbl', t('mycompany')));
    var inp = el('input', 'dtm-in'); inp.maxLength = 24; inp.value = CO; inp.placeholder = myCo();
    inp.addEventListener('input', function () {
      CO = inp.value; try { localStorage.setItem('dtmod.co', CO); } catch (e) {}
      clearTimeout(coT); coT = setTimeout(function () { pubMember(false); }, 400);
    });
    w.appendChild(inp);
    w.appendChild(el('div', 'dtm-lbl', t('mycountry')));
    var sel = el('select', 'dtm-sel');
    CC_NAMES.forEach(function (n, i) { var o = el('option', null, n); o.value = String(i); if (i === CC) o.selected = true; sel.appendChild(o); });
    sel.addEventListener('change', function () { CC = parseInt(sel.value, 10) || 0; try { localStorage.setItem('dtmod.cc', String(CC)); } catch (e) {} });
    w.appendChild(sel);
    w.appendChild(el('div', 'dtm-lbl', t('myslot')));
    w.appendChild(seg([['0', '1'], ['1', '2'], ['2', '3']], String(SL), function (v) { SL = parseInt(v, 10) || 0; try { localStorage.setItem('dtmod.slot', String(SL)); } catch (e) {} render(); }));
    w.appendChild(el('div', 'dtm-muted dtm-sm', t('slothint')));
    return w;
  }
  function panel(title, kids) { var p = el('div', 'dtm-pn'); if (title) p.appendChild(el('div', 'ph', title)); (kids || []).forEach(function (k) { if (k) p.appendChild(k); }); return p; }
  function sceneTop(title, sub, back) {
    var top = el('div', 'dtm-top');
    if (back) { var bb = el('button', 'dtm-back', '‹'); bb.title = t('back'); bb.addEventListener('click', function (e) { e.stopPropagation(); back(); }); top.appendChild(bb); }
    var tt = el('div', 'dtm-title', title); if (sub) tt.appendChild(el('small', null, sub)); top.appendChild(tt);
    var lang = el('div', 'dtm-lang');
    ['ru', 'en'].forEach(function (l) {
      var lb = el('button', LANG === l ? 'on' : '', l.toUpperCase());
      lb.addEventListener('click', function (ev) { ev.stopPropagation(); setLang(l); render(); });
      lang.appendChild(lb);
    });
    top.appendChild(lang);
    var x = el('button', 'dtm-x big', '×'); x.title = t('close'); x.addEventListener('click', function () { S.open = false; render(); });
    top.appendChild(x);
    return top;
  }
  function errBox() { return S.error ? el('div', 'dtm-err', t('err') + ': ' + S.error) : null; }

  function sceneHome() {
    var f = el('div', 'dtm-stage');
    var cards = el('div', 'dtm-cards');
    function card(ic, h, p, fn, dis) {
      var c = el('div', 'dtm-bigcard' + (dis ? ' off' : ''));
      c.appendChild(el('div', 'ic', ic)); c.appendChild(el('div', 'ch', h)); c.appendChild(el('div', 'cp', p));
      if (!dis) c.addEventListener('click', function (e) { e.stopPropagation(); fn(); });
      return c;
    }
    cards.appendChild(card('＋', t('hcreate'), t('hcreated'), function () { S.error = ''; S.scr = 'create'; render(); }, !S.ready));
    cards.appendChild(card('⌕', t('hjoin'), t('hjoind'), function () { S.error = ''; S.scr = 'browse'; send('list-lobbies'); render(); }, !S.ready));
    f.appendChild(cards);
    if (!S.ready) f.appendChild(el('div', 'dtm-muted dtm-c', t('wait')));
    var e = errBox(); if (e) f.appendChild(e);
    f.appendChild(el('div', 'dtm-muted dtm-c dtm-sm', t('hhow')));
    return f;
  }

  function sceneCreate() {
    var f = el('div', 'dtm-stage dtm-narrow');
    var p = panel(t('lsettings'), []);
    p.appendChild(el('div', 'dtm-lbl', t('lname')));
    var nm = el('input', 'dtm-in'); nm.maxLength = 60; nm.value = form.name || ((S.name || 'Player') + (LANG === 'ru' ? ': лобби' : "'s lobby"));
    nm.addEventListener('input', function () { form.name = nm.value; });
    p.appendChild(nm);
    p.appendChild(el('div', 'dtm-lbl', t('maxp')));
    p.appendChild(seg([['2', '2'], ['3', '3'], ['4', '4']], form.max, function (v) { form.max = v; render(); }));
    p.appendChild(el('div', 'dtm-lbl', t('vis')));
    p.appendChild(seg([['2', t('v2s')], ['1', t('v1')], ['0', t('v0s')]], form.vis, function (v) { form.vis = v; render(); }));
    p.appendChild(el('div', 'dtm-muted dtm-sm', t('v' + form.vis + 'd')));
    p.appendChild(coField());
    f.appendChild(p);
    var e = errBox(); if (e) f.appendChild(e);
    var row = el('div', 'dtm-bar');
    var cb = btn(S.busy === 'creating' ? t('creating') : t('createbtn'), function () {
      S.error = ''; S.busy = 'creating';
      send('create-lobby', [parseInt(form.vis, 10), parseInt(form.max, 10), (form.name || nm.value || '').slice(0, 60)]);
      render();
    }, 'big');
    cb.disabled = !!S.busy || !S.ready || !!S.lobby;
    row.appendChild(cb); f.appendChild(row);
    return f;
  }

  function sceneBrowse() {
    var f = el('div', 'dtm-stage dtm-narrow');
    var head = el('div', 'dtm-row');
    head.appendChild(el('div', 'grow dtm-lbl', t('publiclobbies')));
    head.appendChild(btn(t('refresh'), function () { S.error = ''; send('list-lobbies'); }, 'sec'));
    f.appendChild(head);
    var p = panel('', []);
    if (S.lobbies == null) p.appendChild(el('div', 'dtm-muted', '…'));
    else if (!S.lobbies.length) p.appendChild(el('div', 'dtm-muted', t('none')));
    else S.lobbies.forEach(function (l) {
      var r = el('div', 'dtm-lrow');
      var info = el('div', 'grow');
      info.appendChild(el('div', 'ln', l.name || '?'));
      info.appendChild(el('div', 'dtm-muted', (l.host || '') + ' · ' + l.n + '/' + (l.max || '?')));
      r.appendChild(info);
      var jb = btn(t('join'), function () { S.error = ''; send('join-lobby', [String(l.id)]); });
      jb.disabled = !!S.busy || (l.max && l.n >= +l.max); r.appendChild(jb);
      p.appendChild(r);
    });
    f.appendChild(p);
    f.appendChild(el('div', 'dtm-muted dtm-sm', t('invhint')));
    f.appendChild(coField());
    var e = errBox(); if (e) f.appendChild(e);
    return f;
  }

  function slotCard(m, L) {
    var ms = m.data && m.data.state === 'play' ? memberStats(m) : null, c = el('div', 'dtm-slot' + (m.id === S.me ? ' me' : ''));
    var nm = cleanText(m.name || m.id).slice(0, 40);
    var av = el('div', 'av' + (isSpeaking(m.id) ? ' sp' : ''), (nm.charAt(0) || '?').toUpperCase()); c.appendChild(av);
    var info = el('div', 'grow');
    var l1 = el('div', 'sn', nm);
    if (m.id === L.owner) l1.appendChild(el('span', 'dtm-tag b', t('host')));
    if (m.id === S.me) l1.appendChild(el('span', 'dtm-tag', t('you')));
    info.appendChild(l1);
    var co = ms && ms.CompanyName ? cleanText(ms.CompanyName) : cleanText(m.data && m.data.name);
    info.appendChild(el('div', 'sc', co ? '🏢 ' + co.slice(0, 30) : t('nocompany')));
    if (ms) info.appendChild(el('div', 'dtm-muted dtm-sm', t('budget') + ' ' + fmtNum(ms.Budget) + ' · ' + t('fans') + ' ' + fmtNum(ms.Fans)));
    c.appendChild(info);
    var st = el('div', 'st');
    var play = m.data && m.data.state === 'play', rd = m.data && m.data.ready === '1';
    if (isSpeaking(m.id)) st.appendChild(el('span', 'dtm-tag g', '🔊'));
    st.appendChild(el('span', 'dtm-tag' + (play ? ' g' : rd ? ' g' : ''), play ? t('ingame') : rd ? t('ready') : t('notready')));
    if (m.id !== S.me) {
      var mb = btn(VC.muted[m.id] ? t('vunmute') : t('vmute'), (function (id) { return function () { setMuted(id, !VC.muted[id]); render(); }; })(m.id), 'sec');
      mb.style.padding = '2px 9px'; mb.style.fontSize = '12px'; st.appendChild(mb);
    }
    c.appendChild(st);
    return c;
  }

  function voiceBlock(b) {
    b.appendChild(el('div', 'dtm-lbl', t('voice') + (VC.mic ? ' — ' + t('vmic') : '')));
    var vr = el('div', 'dtm-row');
    var vc = el('input'); vc.type = 'checkbox'; vc.checked = VC.on; vc.style.width = '18px'; vc.style.height = '18px';
    vc.addEventListener('change', function () { VC.on = vc.checked; saveVoice(); voiceCfg(); voiceSync(); render(); });
    vr.appendChild(vc); vr.appendChild(el('div', 'grow', t('voiceon'))); b.appendChild(vr);
    if (!VC.on) return;
    var mr = el('div', 'dtm-row');
    var ms2 = el('select', 'dtm-sel');
    [['ptt', t('vptt')], ['open', t('vopen')]].forEach(function (o) { var op = el('option', null, o[1]); op.value = o[0]; if (VC.mode === o[0]) op.selected = true; ms2.appendChild(op); });
    ms2.addEventListener('change', function () { VC.mode = ms2.value; saveVoice(); if (VC.mode === 'ptt') setMic(false); voiceSync(); render(); });
    mr.appendChild(ms2);
    if (VC.mode === 'ptt') mr.appendChild(btn(t('vkey') + ': ' + (VC.binding ? t('vpress') : keyLabel(VC.key)) + ' · ' + t('vchange'), function () { VC.binding = true; render(); }, 'sec'));
    b.appendChild(mr);
    var vl = el('div', 'dtm-row'); vl.appendChild(el('div', null, t('vvol')));
    var sl = el('input'); sl.type = 'range'; sl.min = 0; sl.max = 200; sl.value = VC.vol; sl.style.flex = '1';
    sl.addEventListener('input', function () { VC.vol = +sl.value; saveVoice(); voiceCfg(); });
    vl.appendChild(sl); b.appendChild(vl);
    var er = el('div', 'dtm-row');
    var ec = el('input'); ec.type = 'checkbox'; ec.checked = !!VC.echo; ec.style.width = '18px'; ec.style.height = '18px';
    ec.addEventListener('change', function () { VC.echo = ec.checked; send('voice-loop', [VC.echo ? 1 : 0]); });
    er.appendChild(ec); er.appendChild(el('div', 'grow', t('vecho'))); b.appendChild(er);
    b.appendChild(el('div', 'dtm-muted dtm-sm', t('vhint')));
  }

  function sceneRoom() {
    var L = S.lobby, isHost = L.owner === S.me, g = lobbyGame(L);
    var max = +(L.data && L.data.max) || 4;
    var f = el('div', 'dtm-stage');
    var cols = el('div', 'dtm-cols');
    // left: players
    var left = panel(t('players') + ' ' + L.members.length + '/' + max, []);
    L.members.forEach(function (m) { left.appendChild(slotCard(m, L)); });
    for (var i = L.members.length; i < max; i++) {
      var es = el('div', 'dtm-slot empty'); es.appendChild(el('div', 'av', '?')); es.appendChild(el('div', 'grow dtm-muted', t('waitplayer'))); left.appendChild(es);
    }
    cols.appendChild(left);
    // right: settings, voice, chat
    var right = el('div', 'dtm-rcol');
    var sp = panel(t('lsettings'), []);
    sp.appendChild(el('div', 'dtm-kv', null, [el('span', null, t('lname')), el('b', null, (L.data && L.data.name) || 'Lobby')]));
    sp.appendChild(el('div', 'dtm-kv', null, [el('span', null, t('maxp')), el('b', null, String(max))]));
    sp.appendChild(coField());
    if (g) sp.appendChild(el('div', 'dtm-run', '● ' + t(g.run ? 'runlive' : 'runon')));
    right.appendChild(sp);
    var vp = panel('', []); voiceBlock(vp); right.appendChild(vp);
    var cp = panel(t('chat'), []); cp.appendChild(viewChat(true)); right.appendChild(cp);
    cols.appendChild(right);
    f.appendChild(cols);
    var e = errBox(); if (e) f.appendChild(e);
    // bottom bar
    var bar = el('div', 'dtm-bar sticky');
    bar.appendChild(btn(t('invdlg'), function () { send('invite-dialog'); }, 'sec'));
    bar.appendChild(btn(t('leave'), function () { send('leave-lobby'); }, 'red'));
    bar.appendChild(el('div', 'grow'));
    var me = memberOf(L, S.me);
    if (isHost) {
      var nrd = 0; L.members.forEach(function (m) { if (m.id !== L.owner && m.data && m.data.ready === '1') nrd++; });
      if (L.members.length > 1) bar.appendChild(el('div', 'dtm-muted', t('ready') + ': ' + nrd + '/' + (L.members.length - 1)));
      bar.appendChild(btn(g ? t('restart') : t('startgame'), hostStart, 'big'));
    } else if (g) {
      bar.appendChild(btn(t('joingame'), joinRunning, 'big'));
    } else {
      var cur = me && me.data && me.data.ready === '1';
      bar.appendChild(el('div', 'dtm-muted', t('waithost')));
      bar.appendChild(btn(cur ? t('notready') : t('imready'), function () { send('set-member-data', ['ready', cur ? '0' : '1']); }, cur ? 'sec' : 'big'));
    }
    f.appendChild(bar);
    return f;
  }

  function viewScene() {
    var wrap = el('div', 'dtm-scene');
    var scr = S.lobby ? 'room' : (S.scr === 'room' ? 'home' : S.scr);
    var body;
    if (scr === 'create') { wrap.appendChild(sceneTop(t('hcreate'), t('title'), function () { S.scr = 'home'; S.error = ''; render(); })); body = sceneCreate(); }
    else if (scr === 'browse') { wrap.appendChild(sceneTop(t('hjoin'), t('title'), function () { S.scr = 'home'; S.error = ''; render(); })); body = sceneBrowse(); }
    else if (scr === 'room') { var L = S.lobby; wrap.appendChild(sceneTop(t('menu'), (L.data && L.data.name) || t('lobby'), null)); body = sceneRoom(); }
    else { wrap.appendChild(sceneTop(t('menu'), 'Devices Tycoon · Steam', null)); body = sceneHome(); }
    wrap.appendChild(body);
    wrap.appendChild(el('div', 'dtm-foot dtm-muted', (S.ready ? t('connected') + ' ' + S.name + ' · ' : '') + t('hint') + ' · DTMod ' + VER));
    return wrap;
  }

  // ---------- compact window (while playing) ----------
  function viewLobby() {                           // compact lobby tab
    var b = el('div', 'dtm-b'), L = S.lobby;
    if (!L) { b.appendChild(el('div', 'dtm-muted', S.busy === 'joining' ? t('joining') : t('notin'))); return b; }
    var g = lobbyGame(L);
    b.appendChild(el('div', null, (L.data && L.data.name) || 'Lobby'));
    L.members.forEach(function (m) {
      var r = el('div', 'dtm-row');
      var info = el('div', 'grow'); info.appendChild(el('div', null, m.name || m.id));
      var ms = memberStats(m);
      if (ms) info.appendChild(el('div', 'dtm-muted', cleanText(ms.CompanyName).slice(0, 30) + ' · ' + t('budget') + ' ' + fmtNum(ms.Budget) + ' · ' + t('fans') + ' ' + fmtNum(ms.Fans)));
      else info.appendChild(el('div', 'dtm-muted', cleanText(m.data && m.data.name) || t('nostats')));
      r.appendChild(info);
      if (isSpeaking(m.id)) r.appendChild(el('span', 'dtm-tag g', '🔊'));
      if (m.id !== S.me) { var mb = btn(VC.muted[m.id] ? t('vunmute') : t('vmute'), (function (id) { return function () { setMuted(id, !VC.muted[id]); render(); }; })(m.id), 'sec'); mb.style.padding = '2px 8px'; mb.style.fontSize = '12px'; r.appendChild(mb); }
      if (m.id === L.owner) r.appendChild(el('span', 'dtm-tag b', t('host')));
      if (m.id === S.me) r.appendChild(el('span', 'dtm-tag', t('you')));
      b.appendChild(r);
    });
    var row = el('div', 'dtm-row');
    row.appendChild(btn(t('invdlg'), function () { send('invite-dialog'); }));
    if (L.owner === S.me && !g) row.appendChild(btn(t('announce'), hostAnnounce, 'sec'));
    b.appendChild(row);
    if (L.owner === S.me && !g) b.appendChild(el('div', 'dtm-muted dtm-sm', t('announced')));
    voiceBlock(b);
    var r2 = el('div', 'dtm-row');
    r2.appendChild(btn(t('leave'), function () { send('leave-lobby'); }, 'red'));
    b.appendChild(r2);
    return b;
  }



  function viewRank() {
    var b = el('div', 'dtm-b');
    if (!S.lobby) { b.appendChild(el('div', 'dtm-muted', t('notin'))); return b; }
    var rows = ranking(), g = gv(), myDay = g ? (+g.DayTotal || 0) : 0;
    rows.forEach(function (r, i) {
      var row = el('div', 'dtm-row');
      row.appendChild(el('span', 'dtm-tag' + (i === 0 ? ' g' : ''), String(i + 1)));
      var info = el('div', 'grow');
      info.appendChild(el('div', null, r.name + (r.st && r.st.CompanyName ? ' — ' + cleanText(r.st.CompanyName).slice(0, 30) : '') + (r.me ? ' (' + t('you') + ')' : '')));
      if (r.st) {
        var dd = (+r.st.DayTotal || 0) - myDay;
        info.appendChild(el('div', 'dtm-muted', t('networth') + ' ' + fmtNum(r.nw) + ' · ' + t('budget') + ' ' + fmtNum(r.st.Budget) + ' · ' + t('fans') + ' ' + fmtNum(r.st.Fans) + (r.me || !g ? '' : ' · ' + (dd > 0 ? '+' : '') + dd + ' ' + t('dayshort'))));
        if (r.st.u30 !== undefined) {
          var tot = 0; rows.forEach(function (q) { if (q.st && q.st.u30 > 0) tot += q.st.u30; });
          var sh = tot > 0 ? Math.round(100 * r.st.u30 / tot) : 0;
          info.appendChild(el('div', 'dtm-muted', t('sales30') + ': ' + fmtNum(r.st.u30) + ' ' + t('units') + ' · ' + fmtNum(r.st.r30) + ' $ · ' + t('share') + ' ' + sh + '%'));
        }
      } else info.appendChild(el('div', 'dtm-muted', t('nostats')));
      row.appendChild(info); b.appendChild(row);
    });
    var cm = CK.mode === 'host' ? t('clkhost') : CK.mode === 'follow' ? t('clkfollow') : CK.mode === 'ahead' ? t('clkahead') : '';
    var mk = MK.st === 'host' ? t('mkhost') : MK.st === 'ok' ? t('mkok') + ' (' + t('dayshort') + ' ' + MK.day + ')' : MK.st === 'wait' ? t('mkwait') : MK.st === 'far' ? t('mkfar') : MK.st === 'bad' ? t('mkbad') : '';
    if (mk && CK.mode) b.appendChild(el('div', 'dtm-lbl', mk));
    var sk = STK.st === 'host' ? t('skhost') : STK.st === 'ok' ? t('skok') : STK.st === 'wait' ? t('skwait') : STK.st === 'far' ? t('skfar') : STK.st === 'bad' ? t('skbad') : '';
    if (sk && CK.mode) b.appendChild(el('div', 'dtm-lbl', sk));
    if (cm) b.appendChild(el('div', 'dtm-lbl', t('clocksync') + ': ' + cm + (CK.mode === 'follow' && CK.drift != null ? ' (' + (CK.drift > 0 ? '+' : '') + Math.round(CK.drift) + ' ' + t('dayshort') + ')' : '')));
    return b;
  }

  var tradeForm = { to: '', cur: 'c', amt: '', msg: '' };
  function viewTrade() {
    var b = el('div', 'dtm-b'), L = S.lobby;
    if (!L) { b.appendChild(el('div', 'dtm-muted', t('notin'))); return b; }
    var g = gv();
    if (!g || !inGame()) b.appendChild(el('div', 'dtm-muted', t('txnoplay')));
    var others = L.members.filter(function (m) { return m.id !== S.me; });
    if (!others.length) b.appendChild(el('div', 'dtm-muted', t('txnoone')));
    else {
      if (!others.some(function (m) { return m.id === tradeForm.to; })) tradeForm.to = others[0].id;
      b.appendChild(el('div', 'dtm-lbl', t('to')));
      var ps = el('select', 'dtm-sel');
      others.forEach(function (m) { var o = el('option', null, cleanText(m.name || m.id).slice(0, 40)); o.value = m.id; if (m.id === tradeForm.to) o.selected = true; ps.appendChild(o); });
      ps.addEventListener('change', function () { tradeForm.to = ps.value; });
      b.appendChild(ps);
      b.appendChild(el('div', 'dtm-lbl', t('cur')));
      var cs = el('select', 'dtm-sel');
      [['c', t('cash') + (g ? ' (' + fmtNum(g.Budget) + ')' : '')], ['r', t('rcoins') + (g ? ' (' + fmtNum(g.ResearchCoins) + ')' : '')]].forEach(function (c) { var o = el('option', null, c[1]); o.value = c[0]; if (tradeForm.cur === c[0]) o.selected = true; cs.appendChild(o); });
      cs.addEventListener('change', function () { tradeForm.cur = cs.value; });
      b.appendChild(cs);
      b.appendChild(el('div', 'dtm-lbl', t('amount')));
      var ai = el('input', 'dtm-in'); ai.value = tradeForm.amt; ai.inputMode = 'numeric'; ai.maxLength = 13;
      ai.addEventListener('input', function () { tradeForm.amt = ai.value.replace(/[^0-9]/g, ''); if (ai.value !== tradeForm.amt) ai.value = tradeForm.amt; });
      b.appendChild(ai);
      var msg = el('div', 'dtm-err'); msg.style.display = 'none';
      var row = el('div', 'dtm-row');
      row.appendChild(btn(t('sendmoney'), function () {
        var r = sendMoney(tradeForm.to, tradeForm.cur, tradeForm.amt);
        if (r) { msg.textContent = t(r); msg.style.display = 'block'; } else { tradeForm.amt = ''; ai.value = ''; msg.style.display = 'none'; render(); }
      }));
      b.appendChild(row); b.appendChild(msg);
    }
    b.appendChild(el('div', 'dtm-lbl', t('txlog')));
    if (!TX.log.length) b.appendChild(el('div', 'dtm-muted', t('txnone')));
    TX.log.slice(-8).reverse().forEach(function (x) {
      var cu = x.cur === 'c' ? '$' : t('rcoins');
      var txt = (x.dir === 'in' ? t('txin') + ' ' : t('txout') + ' ') + x.who + ': ' + fmtNum(x.amt) + ' ' + cu + ' — ' + (x.st === 'pending' ? t('txpend') : x.st === 'refunded' ? t('txrefund') : t('txdone'));
      b.appendChild(el('div', 'dtm-muted', txt));
    });
    return b;
  }

  var chatLogEl = null, chatInputVal = '';
  function updateChatLog() {
    if (!chatLogEl) return;
    var atEnd = chatLogEl.scrollTop + chatLogEl.clientHeight >= chatLogEl.scrollHeight - 30;
    chatLogEl.textContent = '';
    if (!S.chat.length) chatLogEl.appendChild(el('div', 'sys', t('chatnone')));
    S.chat.forEach(function (m) {
      var d = el('div', m.sys ? 'sys' : '');
      if (m.sys) d.textContent = (m.name ? m.name + ' ' : '') + t(m.sys);
      else { d.appendChild(el('b', m.mine ? 'me' : '', m.name + ': ')); d.appendChild(document.createTextNode(m.text)); }
      chatLogEl.appendChild(d);
    });
    if (atEnd) chatLogEl.scrollTop = chatLogEl.scrollHeight;
  }
  function viewChat(inPanel) {
    var b = el('div', inPanel ? 'dtm-chatp' : 'dtm-b');
    if (!S.lobby) { b.appendChild(el('div', 'dtm-muted', t('chatlobby'))); chatLogEl = null; return b; }
    chatLogEl = el('div', 'dtm-log'); b.appendChild(chatLogEl);
    var row = el('div', 'dtm-row');
    var inp = el('input', 'dtm-in'); inp.maxLength = 200; inp.placeholder = t('chatph'); inp.value = chatInputVal; inp.id = 'dtm-chat-in';
    inp.addEventListener('input', function () { chatInputVal = inp.value; });
    var go = function () { if (sendChat(inp.value)) { inp.value = ''; chatInputVal = ''; updateChatLog(); chatLogEl.scrollTop = chatLogEl.scrollHeight; } };
    window.__dtmChatGo = go;
    row.appendChild(inp); row.appendChild(btn(t('send'), go));
    b.appendChild(row);
    updateChatLog(); chatLogEl.scrollTop = chatLogEl.scrollHeight;
    if (!inPanel) setTimeout(function () { try { inp.focus(); } catch (e) {} }, 0);
    return b;
  }

  function viewFriends() {
    var b = el('div', 'dtm-b');
    b.appendChild(btn(t('refresh'), function () { send('get-friends'); }, 'sec'));
    var list = (S.friends || []).slice().sort(function (a, c) {
      return (c.inGame - a.inGame) || ((c.state > 0) - (a.state > 0)) || String(a.name).localeCompare(String(c.name));
    });
    list.forEach(function (f) {
      if (f.state === 0 && !f.inGame) return;      // hide offline
      var r = el('div', 'dtm-row');
      r.appendChild(el('div', 'grow', f.name || f.id));
      r.appendChild(el('span', 'dtm-tag' + (f.inGame ? ' g' : ''), f.inGame ? t('ingame') : t('online')));
      var ib = btn(t('invite'), function () { send('invite-friend', [String(f.id)]); });
      ib.disabled = !S.lobby; r.appendChild(ib);
      b.appendChild(r);
    });
    if (S.friends && !list.some(function (f) { return f.state || f.inGame; })) b.appendChild(el('div', 'dtm-muted', t('none')));
    return b;
  }

  function applyZoom() {
    var z = Math.max(0.65, Math.min(1.5, Math.min(window.innerWidth / 1600, window.innerHeight / 880)));
    dom.win.style.zoom = z; dom.win.style.width = (100 / z) + 'vw'; dom.win.style.height = (100 / z) + 'vh';
  }
  function render() {
    if (!dom.win) return;
    var inLobby = !!S.lobby;
    var cnt = inLobby ? ' ' + S.lobby.members.length + '/' + ((S.lobby.data && S.lobby.data.max) || '?') : '';
    dom.fab.textContent = '● ' + t('btn') + cnt + (S.unread > 0 ? '  ✉ ' + S.unread : '');
    dom.menuLabel.textContent = '';
    dom.menuLabel.appendChild(document.createTextNode(t('menu')));
    if (inLobby) dom.menuLabel.appendChild(el('small', null, cnt));
    if (S.unread > 0) dom.menuLabel.appendChild(el('span', 'dtm-badge', String(S.unread)));
    var inMenu = RT.layout === MENU_LAYOUT;
    var noHook = !RT.rt && (Date.now() - T0 > 8000);        // hook failed: keep the always-visible fallback button
    dom.fab.style.display = ((inLobby && !inMenu) || noHook) ? 'block' : 'none';
    placeMenu();
    dom.win.style.display = S.open ? 'block' : 'none';
    if (!S.open) return;
    if (S.tab === 'chat') S.unread = 0;
    var focus = document.activeElement && dom.win.contains(document.activeElement) && document.activeElement.tagName === 'INPUT';
    if (focus) { if (S.tab === 'chat' || !(inGame() && inLobby)) updateChatLog(); return; }   // do not rebuild while typing
    var compact = inGame() && inLobby;
    dom.win.textContent = '';
    if (!compact) {
      dom.win.className = 'scene'; applyZoom();
      dom.win.appendChild(viewScene());
      updateChatLog();
      return;
    }
    dom.win.className = ''; dom.win.style.zoom = ''; dom.win.style.width = ''; dom.win.style.height = '';
    var lang = el('div', 'dtm-lang');
    ['ru', 'en'].forEach(function (l) {
      var lb = el('button', LANG === l ? 'on' : '', l.toUpperCase());
      lb.addEventListener('click', function (ev) { ev.stopPropagation(); setLang(l); render(); });
      lang.appendChild(lb);
    });
    var h = el('div', 'dtm-h', null, [el('span', null, t('title') + (S.ready ? '' : ' — ' + t('wait')))]);
    var x = el('button', 'dtm-x', '×'); x.title = t('close'); x.addEventListener('click', function () { S.open = false; render(); });
    var rt_ = el('div', null, null, [lang, x]); rt_.style.display = 'flex'; rt_.style.alignItems = 'center';
    h.appendChild(rt_); dom.win.appendChild(h);
    var tabs = el('div', 'dtm-tabs');
    var TABS = ['lobby', 'rank', 'trade', 'chat', 'friends'];
    if (TABS.indexOf(S.tab) < 0) S.tab = 'lobby';
    TABS.forEach(function (k) {
      var tb = el('button', 'dtm-tab' + (S.tab === k ? ' on' : ''), t(k));
      if (k === 'chat' && S.unread > 0 && S.tab !== 'chat') tb.appendChild(el('span', 'dtm-badge', String(S.unread)));
      tb.addEventListener('click', function () {
        S.tab = k; S.error = '';
        if (k === 'friends' && S.ready) send('get-friends');
        render();
      });
      tabs.appendChild(tb);
    });
    dom.win.appendChild(tabs);
    if (S.error) dom.win.appendChild(el('div', 'dtm-err dtm-b', t('err') + ': ' + S.error));
    var body = S.tab === 'lobby' ? viewLobby() : S.tab === 'rank' ? viewRank() : S.tab === 'trade' ? viewTrade() : S.tab === 'chat' ? viewChat() : viewFriends();
    dom.win.appendChild(body);
    dom.win.appendChild(el('div', 'dtm-b dtm-muted', (S.ready ? t('connected') + ' ' + S.name + ' · ' : '') + t('hint') + ' · DTMod ' + VER));
  }



  /*LAB*/
  // test helper: F4 toggles a fake remote player (shows up in the lobby and in the game's company list), F5 changes its numbers
  var FAKE = { on: false, n: 0 };
  labLobby = function (e) {
    if (!FAKE.on) return;
    var st = { CompanyName: 'TestBob Inc', Budget: 1500000, Fans: 120, DayTotal: 0, pr: [3.2 + FAKE.n, 8.5 + FAKE.n, 12, 4.1] };
    e.members = e.members.concat([{ id: '99999', name: 'TestBob', data: { state: 'play', ready: '1', stats: JSON.stringify(st) } }]);
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'F4') { FAKE.on = !FAKE.on; blog('fake peer ' + FAKE.on); if (S.lobby) onEvent(Object.assign({}, S.lobby, { members: S.lobby.members.filter(function (m) { return m.id !== '99999'; }) })); e.preventDefault(); }
    else if (e.key === 'F6') { var g6 = gv(); if (g6) { var on6 = !!CK.fake; CK.fake = on6 ? null : { d: (+g6.DayTotal || 0) + 300, s: 1.2, p: 0, recv: Date.now() }; blog('fake host clock ' + (CK.fake ? 'on d=' + CK.fake.d : 'off')); } e.preventDefault(); }
    else if (e.key === 'F10') {                                   // stocks loopback: encode a +10% table, restore, apply it back through the follower path
      try {
        var sa = stkArrs(), orig = [], last = sa.h - 1;
        for (var sx = 0; sx < sa.n; sx++) { orig.push([]); for (var sy = 0; sy < sa.h; sy++) { var ov = +sa.px.getAt(sx, sy, 0); orig[sx].push(ov); sa.px.setAt(Math.round(ov * 110) / 100, sx, sy, 0); } }
        var enc = stkEncode(sa), ids = [], want = Math.round(orig[0][last] * 110) / 100, v5 = +sa.inv.getAt(0, 5, 0);
        for (var si = 0; si < sa.n; si++) ids.push(+sa.inv.getAt(si, 0, 0) | 0);
        for (sx = 0; sx < sa.n; sx++) for (sy = 0; sy < sa.h; sy++) sa.px.setAt(orig[sx][sy], sx, sy, 0);
        var cnt = stkApply(sa, { n: sa.n, h: sa.h, ids: ids, data: enc });
        var got = +sa.px.getAt(0, last, 0);
        try { RT.rt.callFunction('InvestingUpdate'); } catch (x) { blog('LAB InvestingUpdate failed ' + x); }
        blog('LAB stocks loopback: n=' + sa.n + ' h=' + sa.h + ' bytes=' + enc.length + ' changed=' + cnt + ' want=' + want + ' got=' + got + ' value row5 ' + v5 + ' -> ' + (+sa.inv.getAt(0, 5, 0)) + ' owned0=' + sa.inv.getAt(0, 7, 0));
      } catch (x) { blog('LAB stocks loopback failed ' + x); }
      e.preventDefault();
    }
    else if (e.key === 'F2' && !e.shiftKey) { startNewGame('lab-plain', false); e.preventDefault(); }
    else if (e.key === 'F2' && e.shiftKey) { var g2 = gv(); if (g2) { g2.GameSpeedTime = 0.1; blog('LAB speed 0.1'); } e.preventDefault(); }
    else if (e.key === 'F3' && e.shiftKey) { var g3s = gv(); try { RT.rt.callFunction('TimelineChecking'); blog('LAB TimelineChecking called: next=' + g3s.TimelineNextDay + ' nearest=' + g3s.TimelineNearestNextDay + ' id=' + g3s.TimelineID + ' day=' + g3s.DayTotal); } catch (x) { blog('LAB callFunction failed ' + x); } e.preventDefault(); }
    else if (e.key === 'F3') { CK.fake = { d: 790, s: 1.2, p: 0, recv: Date.now() }; blog('LAB join test: fake host day 790, starting new game'); startNewGame('lab', true); e.preventDefault(); }
    else if (e.key === 'F5') { FAKE.n += 1; blog('fake peer n=' + FAKE.n); if (S.lobby) onEvent(Object.assign({}, S.lobby, { members: S.lobby.members.filter(function (m) { return m.id !== '99999'; }) })); e.preventDefault(); }
  }, true);
  /*ENDLAB*/

  // ---------- in-game HUD (compact ranking) ----------
  var hudOn = true;
  try { if (localStorage.getItem('dtmod.hud') === '0') hudOn = false; } catch (e) {}
  function updateHud() {
    if (!dom.hud) return;
    var L = S.lobby;
    if (!hudOn || !L || L.members.length < 2 || !inGame() || S.open) { dom.hud.style.display = 'none'; return; }
    var rows = ranking();
    dom.hud.textContent = '';
    dom.hud.appendChild(el('div', 'h', t('hud') + (CK.mode === 'follow' ? ' · ⏱' : '')));
    rows.slice(0, 4).forEach(function (r, i) {
      dom.hud.appendChild(el('div', r.me ? 'me' : '', (isSpeaking(r.id) ? '🔊 ' : '') + (i + 1) + '. ' + r.name + ' — ' + (r.st ? fmtNum(r.nw) : '…')));
    });
    dom.hud.style.display = 'block';
  }

  // ---------- boot ----------
  function boot() {
    build(); render();
    function typing(e) { var tg = e.target && e.target.tagName; return tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT'; }
    document.addEventListener('keydown', function (e) {
      if (VC.binding) { e.preventDefault(); e.stopPropagation(); if (e.code !== 'Escape' && /^[A-Za-z0-9]{1,16}$/.test(e.code)) { VC.key = e.code; saveVoice(); } VC.binding = false; render(); return; }
      if (VC.on && VC.mode === 'ptt' && S.lobby && e.code === VC.key && !typing(e) && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault(); e.stopPropagation(); VC.pttDown = Date.now(); setMic(true); return;
      }
    }, true);
    document.addEventListener('keyup', function (e) {
      if (VC.mode === 'ptt' && e.code === VC.key && VC.mic) { e.preventDefault(); e.stopPropagation(); setMic(false); }
    }, true);
    window.addEventListener('blur', function () { if (VC.mode === 'ptt') setMic(false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'F8') { S.open = !S.open; render(); e.preventDefault(); }
      else if (e.key === 'Escape' && S.open) { S.open = false; render(); }
      else if (e.key === 'F9') { dumpVars('vars'); }
      else if (e.key === 'F7') { hudOn = !hudOn; try { localStorage.setItem('dtmod.hud', hudOn ? '1' : '0'); } catch (x) {} updateHud(); }
    }, true);
    // handshake + heartbeat: `tick` drives Steam callbacks in the native module
    var helloTries = 0;
    setInterval(function () {
      if (!S.ready) { if (helloTries++ % 4 === 0) send('hello'); }
      send('tick');
    }, 250);
    setInterval(publishStats, 1000);
    setInterval(function () { try { voiceSync(); if (S.lobby && VC.on) send('vtick'); } catch (e) {} }, 70);
    setInterval(function () { try { clockTick(); } catch (e) { if (CK.err++ < 3) blog('clock error ' + e); } }, 500);
    setInterval(function () { try { updateHud(); } catch (e) {} }, 1000);
    setInterval(function () { try { cdTick(); } catch (e) {} }, 250);
    setInterval(function () { try { pcTick(); } catch (e) { if (PC.tick++ < 3) blog('pc error ' + e); } }, 1000);
    setInterval(function () { try { pubMember(false); } catch (e) {} }, 2000);
    setInterval(placeMenu, 400); window.addEventListener('resize', placeMenu);
    setTimeout(render, 8200);
    send('hello');
    blog('JS loaded v' + VER + ' lang=' + navigator.language);
  }
  if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);
})();
