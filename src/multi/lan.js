// ----------------------------------------------------------------------------------
// Client du serveur réseau local (lan/serveur.mjs). Il expose la même interface que la salle
// temps réel de claude.ai (join → salle nommée : presence, onPeers, emit, on, onConnection,
// leave) : la session à plusieurs fonctionne à l'identique sur les deux transports.
// La connexion se rétablit seule (Wi-Fi qui décroche, serveur relancé) : on rejoint la même
// partie avec la même présence.
// ----------------------------------------------------------------------------------
export const lanAvailable = () => typeof window !== 'undefined' && !!window.CARREGIE_LAN;
const wsUrl = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;

// identifiant stable de ce navigateur (pour reconnaître un joueur qui se reconnecte)
export function browserId() {
  let id = null;
  try { id = localStorage.getItem('carregie.bid'); } catch (e) { /* stockage indisponible */ }
  if (!id) { id = 'b' + Math.random().toString(36).slice(2, 10); try { localStorage.setItem('carregie.bid', id); } catch (e) { /* idem */ } }
  return id;
}

// identifiant de cet onglet (survit à un rechargement) : le serveur remplace l'ancienne connexion
// d'un onglet qui se reconnecte au lieu de laisser un « fantôme » jusqu'au délai de ping
function tabId() {
  let id = null;
  try { id = sessionStorage.getItem('carregie.tid'); } catch (e) { /* stockage indisponible */ }
  if (!id) { id = 't' + Math.random().toString(36).slice(2, 10); try { sessionStorage.setItem('carregie.tid', id); } catch (e) { /* idem */ } }
  return id;
}
export async function lanParties() {
  try { const r = await fetch('/api/parties', { cache: 'no-store' }); if (!r.ok) return null; return await r.json(); } catch (e) { return null; }
}
export async function lanSaveReport(id, data, html) {
  try {
    const r = await fetch('/api/rapport', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, data, html }) });
    return await r.json();
  } catch (e) { return { ok: false, message: e.message }; }
}

export function lanRoom() {
  return { kind: 'lan', join: (name) => joinNamed(name) };
}

function joinNamed(name) {
  const by = tabId();
  const H = { peers: [], msg: {}, conn: [] };
  let ws = null, me = null, connected = false, left = false, retry = 0, pingT = 0;
  let myPres = {};
  const peers = new Map(); // id -> objet figé (comme la salle claude.ai)
  const freeze = (p) => Object.freeze({ peer: p.peer, by: p.by || null, presence: Object.freeze({ ...(p.presence || {}) }), updatedAt: p.updatedAt || Date.now(), isMe: p.peer === me, sameTab: p.peer === me, kind: 'viewer', guest: false });
  // les changements arrivant dans la même tâche sont regroupés en une seule notification
  let pend = null;
  const notify = (kind, p) => {
    if (!pend) { pend = { joined: new Map(), left: new Map(), updated: new Map() }; queueMicrotask(flush); }
    pend[kind].set(p.peer, p);
  };
  function flush() {
    const c = pend; pend = null; if (!c) return;
    const list = [...peers.values()];
    const ch = { peers: list, joined: [...c.joined.values()], left: [...c.left.values()], updated: [...c.updated.values()] };
    for (const h of H.peers) { try { h(ch); } catch (e) { console.error(e); } }
  }
  const setConn = (v) => { if (connected === v) return; connected = v; for (const h of H.conn) { try { h(v); } catch (e) { console.error(e); } } };
  let firstResolve, firstReject;
  const first = new Promise((res, rej) => { firstResolve = res; firstReject = rej; });

  function open() {
    if (left) return;
    try { ws = new WebSocket(wsUrl()); } catch (e) { schedule(); return; }
    ws.onopen = () => { retry = 0; ws.send(JSON.stringify({ t: 'join', room: name, by, presence: myPres })); };
    ws.onmessage = (ev) => {
      let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
      if (m.t === 'welcome') {
        // nouvelle connexion : les anciens identifiants ne valent plus rien
        for (const p of peers.values()) notify('left', p);
        peers.clear(); me = m.you;
        for (const p of m.peers) { const f = freeze(p); peers.set(f.peer, f); notify('joined', f); }
        setConn(true);
        clearInterval(pingT); pingT = setInterval(() => { if (ws && ws.readyState === 1) ws.send('{"t":"ping"}'); }, 10000);
        if (firstResolve) { firstResolve(); firstResolve = null; }
        return;
      }
      if (m.t === 'join') { const f = freeze(m.peer); peers.set(f.peer, f); notify('joined', f); return; }
      if (m.t === 'left') { const p = peers.get(m.peer); if (p) { peers.delete(m.peer); notify('left', p); } return; }
      if (m.t === 'pres') {
        const p = peers.get(m.peer); if (!p) return;
        const pr = { ...p.presence };
        for (const k in m.patch) { if (m.patch[k] === null) delete pr[k]; else pr[k] = m.patch[k]; }
        const f = freeze({ peer: p.peer, by: p.by, presence: pr, updatedAt: m.at });
        peers.set(f.peer, f); notify('updated', f); return;
      }
      if (m.t === 'msg') {
        const hs = H.msg[m.topic]; if (!hs) return;
        const msg = { topic: m.topic, data: m.data, peer: m.peer, by: m.by || null, isMe: false, sameTab: false, kind: 'viewer', guest: false };
        for (const h of hs) { try { h(msg); } catch (e) { console.error(e); } }
        return;
      }
      if (m.t === 'error' && firstReject) { const e = new Error(m.message || m.code); e.code = m.code; firstReject(e); firstReject = null; firstResolve = null; left = true; try { ws.close(); } catch (er) { /* rien */ } }
    };
    ws.onclose = () => { clearInterval(pingT); setConn(false); schedule(); };
    ws.onerror = () => { /* onclose suit */ };
  }
  function schedule() {
    if (left) return;
    retry++;
    if (firstReject && retry > 3) { const e = new Error('Serveur réseau local injoignable'); e.code = 'unreachable'; firstReject(e); firstReject = null; firstResolve = null; }
    setTimeout(open, Math.min(5000, 400 * 2 ** Math.min(retry, 4)));
  }
  const sendRaw = (o) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); };

  const named = {
    name,
    async emit(topic, data) { sendRaw({ t: 'emit', topic, data: data ?? null }); },
    on(topic, h) { (H.msg[topic] = H.msg[topic] || []).push(h); return () => { H.msg[topic] = H.msg[topic].filter((x) => x !== h); }; },
    async presence(patch) {
      for (const k in patch) { if (patch[k] === null) delete myPres[k]; else myPres[k] = patch[k]; }
      const p = peers.get(me);
      if (p) { const f = freeze({ peer: me, by, presence: myPres, updatedAt: Date.now() }); peers.set(me, f); notify('updated', f); }
      sendRaw({ t: 'pres', patch });
    },
    peers: () => [...peers.values()],
    onPeers(h) {
      H.peers.push(h);
      // un abonné tardif reçoit tout de suite la liste courante (comme si tous venaient d'arriver)
      setTimeout(() => { if (H.peers.includes(h) && peers.size) { const list = [...peers.values()]; try { h({ peers: list, joined: list, left: [], updated: [] }); } catch (e) { console.error(e); } } }, 0);
      return () => { H.peers = H.peers.filter((x) => x !== h); };
    },
    connected: () => connected,
    onConnection(h) { H.conn.push(h); setTimeout(() => h(connected), 0); return () => { H.conn = H.conn.filter((x) => x !== h); }; },
    async leave() { left = true; clearInterval(pingT); sendRaw({ t: 'leave' }); try { ws && ws.close(); } catch (e) { /* rien */ } peers.clear(); setConn(false); },
  };
  open();
  return first.then(() => named);
}
