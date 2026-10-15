'use strict';
/* Study Quest: global chat (bottom-right of every screen).

   There is no game server, so messages are relayed through free public MQTT brokers over secure WebSockets.
   A tiny MQTT client is built in below (no libraries). Every player who has the game open subscribes to the same
   topic, so everyone can talk to everyone. Tabs of the same browser are also linked directly (BroadcastChannel),
   which keeps the chat working between tabs even if the internet relay is blocked.

   To make a PRIVATE chat for your class, change CHAT_ROOM to something long that only you know.
   Anyone who runs this game with the same CHAT_ROOM joins the same chat. */

const CHAT_ROOM = 'study-quest-ai-global-7f3c9a';
const CHAT_BROKERS = [
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081/'
];

/* ---------- a very small MQTT 3.1.1 client: connect, subscribe, publish (QoS 0), keep-alive ---------- */
class MiniMQTT {
  constructor(urls, onMessage, onState) {
    this.urls = urls; this.onMessage = onMessage; this.onState = onState;
    this.clientId = 'sq' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
    this.topic = ''; this.ws = null; this.ok = false; this.tryIndex = 0; this.fails = 0; this.buf = new Uint8Array(0);
    this.ping = null; this.retry = null; this.stopped = false;
  }
  static str(s) { const b = new TextEncoder().encode(s); const o = new Uint8Array(2 + b.length); o[0] = b.length >> 8; o[1] = b.length & 255; o.set(b, 2); return o; }
  static varlen(n) { const a = []; do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; a.push(d); } while (n > 0); return a; }
  static packet(first, ...parts) {
    let len = 0; parts.forEach(p => len += p.length);
    const head = [first, ...MiniMQTT.varlen(len)], out = new Uint8Array(head.length + len);
    out.set(head, 0); let o = head.length; parts.forEach(p => { out.set(p, o); o += p.length; });
    return out;
  }
  start(topic) { this.topic = topic; this.stopped = false; this.open(); }
  open() {
    if (this.stopped) return;
    const url = this.urls[this.tryIndex % this.urls.length];
    this.onState('connecting', url);
    let ws;
    try { ws = new WebSocket(url, 'mqtt'); } catch { this.failed(); return; }
    ws.binaryType = 'arraybuffer'; this.ws = ws; this.buf = new Uint8Array(0); this.ok = false;
    const guard = setTimeout(() => { if (!this.ok) { try { ws.close(); } catch { /* ignore */ } } }, 9000);
    ws.onopen = () => {
      const vh = new Uint8Array([0, 4, 77, 81, 84, 84, 4, 2, 0, 45]);              // "MQTT", level 4, clean session, keep-alive 45s
      ws.send(MiniMQTT.packet(0x10, vh, MiniMQTT.str(this.clientId)));
    };
    ws.onmessage = ev => { try { this.feed(new Uint8Array(ev.data)); } catch { /* ignore a bad packet */ } };
    ws.onerror = () => { /* onclose follows */ };
    ws.onclose = () => { clearTimeout(guard); clearInterval(this.ping); const was = this.ok; this.ok = false; if (ws === this.ws) { this.ws = null; if (was) this.fails = 0; this.failed(); } };
  }
  failed() {
    this.onState('offline');
    if (this.stopped) return;
    this.fails++; this.tryIndex++;
    clearTimeout(this.retry);
    this.retry = setTimeout(() => this.open(), Math.min(30000, 1500 * Math.pow(1.7, Math.min(this.fails, 8))));
  }
  feed(chunk) {
    const nb = new Uint8Array(this.buf.length + chunk.length); nb.set(this.buf, 0); nb.set(chunk, this.buf.length); this.buf = nb;
    for (;;) {
      const b = this.buf; if (b.length < 2) return;
      let mult = 1, len = 0, i = 1, d;
      do { if (i >= b.length) return; d = b[i++]; len += (d & 127) * mult; mult *= 128; } while ((d & 128) && i < 5);
      if (b.length < i + len) return;                       // wait for the rest of the packet
      const type = b[0] >> 4, body = b.slice(i, i + len);
      this.buf = b.slice(i + len);
      this.packetIn(type, b[0], body);
    }
  }
  packetIn(type, first, body) {
    if (type === 2) {                                        // CONNACK
      if (body[1] !== 0) { try { this.ws.close(); } catch { /* ignore */ } return; }
      this.ok = true; this.fails = 0;
      this.ws.send(MiniMQTT.packet(0x82, new Uint8Array([0, 1]), MiniMQTT.str(this.topic), new Uint8Array([0])));
      clearInterval(this.ping);
      this.ping = setInterval(() => { try { if (this.ok) this.ws.send(new Uint8Array([0xC0, 0])); } catch { /* ignore */ } }, 20000);
      this.onState('online');
    } else if (type === 3) {                                 // PUBLISH
      const tl = (body[0] << 8) | body[1], qos = (first >> 1) & 3;
      let o = 2 + tl; const topic = new TextDecoder().decode(body.slice(2, o));
      if (qos > 0) { const pid = body.slice(o, o + 2); o += 2; if (qos === 1) this.ws.send(new Uint8Array([0x40, 2, pid[0], pid[1]])); }
      this.onMessage(topic, new TextDecoder().decode(body.slice(o)));
    }
  }
  publish(text) {
    if (!this.ok || !this.ws) return false;
    try { this.ws.send(MiniMQTT.packet(0x30, MiniMQTT.str(this.topic), new TextEncoder().encode(text))); return true; } catch { return false; }
  }
}

/* ---------- the chat itself ---------- */
const Chat = (() => {
  const q = s => document.querySelector(s);
  const TOPIC = 'studyquest/' + CHAT_ROOM + '/chat';
  const MAXLEN = 200, MAXNAME = 20;
  const lsGet = k => { try { return localStorage.getItem('sq_' + k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem('sq_' + k, v); } catch { /* ignore */ } };

  const el = q('#chat'), log = q('#chatLog'), input = q('#chatInput'), statusEl = q('#chatStatus'), badge = q('#chatBadge');
  const clean = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

  let name = clean(lsGet('chatName'), MAXNAME) || 'Player' + (100 + Math.floor(Math.random() * 900));
  const seen = new Set(), peers = new Map(), flood = new Map();
  let unread = 0, lastSend = 0, connected = false, bc = null;
  const myId = 'c' + Math.random().toString(36).slice(2, 10);

  /* ---- UI ---- */
  const isOpen = () => !el.classList.contains('collapsed');
  function setOpen(open) {
    el.classList.toggle('collapsed', !open); lsSet('chatOpen', open ? '1' : '0');
    if (open) { unread = 0; showBadge(); log.scrollTop = log.scrollHeight; }
  }
  function showBadge() { badge.textContent = unread > 99 ? '99+' : unread; badge.classList.toggle('hidden', !unread); }
  function line(cls, who, text) {
    const nearBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 40;
    const d = document.createElement('div'); d.className = 'chatmsg ' + cls;
    if (who) { const b = document.createElement('b'); b.textContent = who + ':'; d.appendChild(b); }
    d.appendChild(document.createTextNode(text));
    log.appendChild(d);
    while (log.children.length > 150) log.removeChild(log.firstChild);
    if (nearBottom || cls === 'me') log.scrollTop = log.scrollHeight;
    return d;
  }
  function renderStatus() {
    const n = [...peers.values()].filter(t => Date.now() - t < 75000).length + 1;
    if (connected) { statusEl.textContent = '● online · ' + n + (n === 1 ? ' player' : ' players'); statusEl.className = 'chatstatus on'; }
    else { statusEl.textContent = bc ? '○ offline · this browser only' : '○ offline'; statusEl.className = 'chatstatus'; }
  }
  function renderName() { q('#chatName').textContent = name; }

  /* ---- sending / receiving ---- */
  const remember = id => { seen.add(id); if (seen.size > 600) seen.delete(seen.values().next().value); };
  function transmit(obj) {
    const text = JSON.stringify(obj);
    mqtt.publish(text);
    if (bc) { try { bc.postMessage(text); } catch { /* ignore */ } }
  }
  function incoming(raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== 'object' || typeof m.c !== 'string' || m.c === myId) return;
    const who = clean(m.n, MAXNAME) || 'Player';
    const isNew = !peers.has(m.c);
    peers.set(m.c, Date.now());
    if (m.k === 'p') { if (isNew && connected) announce(); renderStatus(); return; }   // say hello back to someone who just arrived
    if (m.k === 'bye') { peers.delete(m.c); renderStatus(); return; }
    if (m.k !== 'm' || typeof m.id !== 'string' || m.id.length > 40 || seen.has(m.id)) return;
    const text = clean(m.t, MAXLEN); if (!text) return;
    // ignore anybody who floods the chat
    const now = Date.now(), arr = (flood.get(m.c) || []).filter(t => now - t < 10000);
    if (arr.length >= 6) { flood.set(m.c, arr); return; }
    arr.push(now); flood.set(m.c, arr);
    remember(m.id);
    line('', who, text);
    if (!isOpen()) { unread++; showBadge(); }
    renderStatus();
  }
  function send(text) {
    text = clean(text, MAXLEN); if (!text) return;
    const now = Date.now();
    if (now - lastSend < 900) { line('sys', '', 'Slow down a little!'); return; }
    lastSend = now;
    const id = myId + '-' + now.toString(36) + Math.random().toString(36).slice(2, 5);
    remember(id);
    transmit({ k: 'm', id, c: myId, n: name, t: text, ts: now });
    line('me', name, text);
    if (!connected) line('sys', '', 'Not connected to other players right now. Trying again…');
  }
  function announce() { transmit({ k: 'p', c: myId, n: name, ts: Date.now() }); }

  /* ---- transports ---- */
  const mqtt = new MiniMQTT(CHAT_BROKERS, (topic, payload) => { if (topic === TOPIC) incoming(payload); }, (state) => {
    const was = connected; connected = state === 'online';
    if (connected && !was) { line('sys', '', 'Connected. You are chatting with everyone who is playing right now.'); announce(); }
    if (!connected && was) line('sys', '', 'Connection lost. Reconnecting…');
    if (state === 'connecting') statusEl.textContent = 'connecting…';
    else renderStatus();
  });
  mqtt.clientId = 'sq' + myId;
  try { bc = new BroadcastChannel('studyquest-chat-' + CHAT_ROOM); bc.onmessage = ev => incoming(ev.data); } catch { bc = null; }

  /* ---- wiring ---- */
  q('#chatForm').onsubmit = e => { e.preventDefault(); send(input.value); input.value = ''; };
  q('#chatMin').onclick = () => setOpen(false);
  q('#chatTab').onclick = () => { setOpen(true); setTimeout(() => input.focus(), 30); };
  q('#chatName').onclick = () => {
    const n = clean(prompt('Your chat name (up to ' + MAXNAME + ' letters):', name), MAXNAME);
    if (n) { name = n; lsSet('chatName', n); renderName(); announce(); }
  };
  input.addEventListener('keydown', e => { if (e.key === 'Escape') { input.blur(); e.stopPropagation(); } });
  window.addEventListener('beforeunload', () => { try { transmit({ k: 'bye', c: myId }); } catch { /* ignore */ } });
  setInterval(() => { if (connected) announce(); renderStatus(); }, 25000);

  // open by default on a computer, closed on a phone (the pad needs the room)
  const saved = lsGet('chatOpen');
  setOpen(saved === null ? window.innerWidth > 700 : saved === '1');
  renderName();
  line('sys', '', 'Welcome! Messages here are shared with everyone playing right now. Be kind, and never share personal details.');
  mqtt.start(TOPIC);

  return { send, _debug: { incoming, get connected() { return connected; }, peers, name: () => name } };
})();
