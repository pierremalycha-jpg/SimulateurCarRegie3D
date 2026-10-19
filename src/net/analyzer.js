// @ts-check
import { S } from '../state.js';
import { FAB, COLORS, CLABEL, CNUM, vlanOf, DSCP_REF, clockId, portState, spanLoad } from './fabric.js';

// ----------------------------------------------------------------------------------
// Instruments de mesure du réseau ST 2110 (valeurs simulées, cohérentes avec le modèle) :
//   - analyseur de flux : débit, paquets/s, gigue, CINST / VRX (ST 2110-21), latence,
//     écart rouge / bleu (ST 2022-7), compteurs de paquets réparés / perdus ;
//   - suivi PTP : offset par rapport au maître dans le temps, transitoires au changement
//     de grand maître, dérive d'une horloge libre ;
//   - capture de paquets sur un port miroir (SPAN), décodée couche par couche.
// ----------------------------------------------------------------------------------
export const AN = { t: 0, acc: 0, rx: 'ME1', hist: [], ptp: {}, gmPrev: {}, steps: {}, drift: {}, cnt: {}, links: {} };
const HN = 240; // 60 s à 4 échantillons par seconde
const gauss = () => { let u = 0; while (!u) u = Math.random(); const v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// ---------------- géométrie d'un flux vidéo ST 2110-20 ----------------
export function videoGeom() {
  const uhd = S.format === 'UHD', hdi = S.format === 'HDi';
  const w = uhd ? 3840 : 1920, h = uhd ? 2160 : 1080;
  const lineBytes = w * 2.5; // 4:2:2 10 bits : un « pgroup » de 5 octets pour 2 pixels
  const payload = 1200; // octets de vidéo par paquet (480 pixels)
  const perLine = lineBytes / payload;
  const lines = hdi ? h / 2 : h; // trame (entrelacé) ou image
  const npackets = lines * perLine;
  const rate = 50; // images (p50) ou trames (i50) par seconde
  const tframe = 1 / rate;
  const ractive = hdi ? 540 / 562.5 : h / (uhd ? 2250 : 1125);
  // modèle de compatibilité réseau ST 2110-21, émetteur étroit (type N)
  const cmax = Math.max(4, Math.floor(npackets / (43200 * ractive * tframe)));
  const vrx = Math.max(8, Math.floor(npackets / (27000 * tframe)));
  return { w, h, hdi, payload, perLine, lines, npackets, rate, pps: npackets * rate, ractive, cmax, vrx, pkt: payload + 8 + 12 + 8 + 20 };
}
export function flowGeom(f) {
  if (f.kind === 'video') return videoGeom();
  if (f.kind === 'audio') { const ch = f.ch || 2; const payload = ch * 3 * 48; return { payload, pps: 1000, pkt: payload + 12 + 8 + 20, ch }; }
  if (f.kind === 'anc') return { payload: 120, pps: 50, pkt: 120 + 8 + 12 + 8 + 20 };
  const g = videoGeom(); return { ...g, payload: 1100, pps: Math.round(f.gbps * 1e9 / 8 / 1150), pkt: 1150 };
}

// ---------------- chemin, latence, gigue ----------------
function pathMetrics(p, f) {
  const R = FAB.res; const g = flowGeom(f);
  let lat = 0, uMax = 0;
  for (const k of p.keys) {
    const L = R.linkLoad[k] || { load: 0, cap: 25 };
    const cap = L.cap || 25; const u = L.load / cap; uMax = Math.max(uMax, u);
    lat += (g.pkt + 38) * 8 / (cap * 1e3); // sérialisation (µs)
    lat += 0.8; // traversée d'un commutateur (cut-through / store-and-forward)
    lat += (Math.min(u, 0.97) ** 3 / (1 - Math.min(u, 0.97))) * 1.5; // file d'attente
  }
  return { lat, uMax, hops: p.keys.length - 1 };
}

// ---------------- échantillonnage (4 Hz) ----------------
export function updateAnalyzer(dt) {
  if (!S.ipMode || !FAB.res) return;
  AN.acc += dt; if (AN.acc < 0.25) return;
  const step = AN.acc; AN.acc = 0; AN.t += step;
  const R = FAB.res;
  // changements de grand maître : transitoire de l'asservissement
  for (const c of COLORS) {
    const gm = R.gmActive[c]; const id = gm ? gm.id : null; const prev = AN.gmPrev[c];
    if (prev !== undefined && prev !== id && id) {
      const wasRogue = prev && !/^gm\d$/.test(prev), isRogue = gm.rogue;
      AN.steps[c] = { t: AN.t, amp: isRogue ? 2.4e5 * (Math.random() < 0.5 ? -1 : 1) : wasRogue ? -2.4e5 : 90 + Math.random() * 80 };
    }
    AN.gmPrev[c] = id;
  }
  // PTP de chaque appareil et de chaque commutateur
  const push = (id, v) => { const a = (AN.ptp[id] = AN.ptp[id] || []); a.push(v); if (a.length > HN) a.shift(); };
  for (const d of Object.values(FAB.devices)) {
    if (d.kind === 'gm' || d.kind === 'nmos') continue;
    const st = R.devPtp[d.id]; if (!st) continue;
    let off = null;
    if (st.state === 'locked' || st.state === 'noisy') {
      const sp = AN.steps[st.color];
      const tr = sp ? sp.amp * Math.exp(-(AN.t - sp.t) / 2.5) : 0;
      off = (st.hops || 1) * 3 + gauss() * (st.state === 'noisy' ? 260 : 6 + (st.hops || 1) * 3) + tr + (st.state === 'noisy' ? 300 * Math.sin(AN.t / 3) : 0);
      AN.drift[d.id] = 0;
    } else if (st.state === 'free') { AN.drift[d.id] = (AN.drift[d.id] || 0) + 120 * step + gauss() * 20; off = gauss() * 15; }
    else AN.drift[d.id] = (AN.drift[d.id] || 0) + 800 * step;
    push(d.id, { t: AN.t, off, state: st.state, drift: AN.drift[d.id] || 0 });
  }
  for (const sw of Object.values(FAB.switches)) {
    if (sw.role === 'ctl') continue;
    const P = R.ptp[sw.color]; const h = P && P.synced[sw.id];
    const sp = AN.steps[sw.color];
    const off = h != null && sw.power ? h * 2 + gauss() * (3 + h * 2) + (sp ? sp.amp * 0.8 * Math.exp(-(AN.t - sp.t) / 2) : 0) : null;
    push(sw.id, { t: AN.t, off, state: h != null ? 'locked' : 'free', drift: 0 });
  }
  // compteurs de toutes les réceptions (ST 2022-7)
  for (const [rid, s] of Object.entries(R.rxState)) {
    const f = FAB.flows[s.flow]; if (!f) continue; const g = flowGeom(f); const C = (AN.cnt[rid] = AN.cnt[rid] || { red: 0, blue: 0, lostRed: 0, lostBlue: 0, repaired: 0, lost: 0, flow: s.flow });
    if (C.flow !== s.flow) Object.assign(C, { red: 0, blue: 0, lostRed: 0, lostBlue: 0, repaired: 0, lost: 0, flow: s.flow });
    const lr = s.per.red.ok ? s.per.red.loss || 0 : 1, lb = s.per.blue.ok ? s.per.blue.loss || 0 : 1;
    const n = g.pps * step;
    C.red += n * (1 - lr); C.blue += n * (1 - lb); C.lostRed += n * lr; C.lostBlue += n * lb;
    const both = lr >= 1 || lb >= 1 ? Math.min(lr, lb) : lr * lb; // pertes indépendantes sur deux chemins
    C.lost += n * both; C.repaired += n * (Math.max(lr, lb) - both) + n * (Math.min(lr, lb) - both);
  }
  // historique de la réception suivie
  const m = streamMetrics(AN.rx);
  if (m) { AN.hist.push({ t: AN.t, ...m.sample }); if (AN.hist.length > HN) AN.hist.shift(); }
  // historique de charge des liens (uplinks et cartes des appareils)
  for (const [k, v] of Object.entries(R.linkLoad)) { const a = (AN.links[k] = AN.links[k] || []); a.push(v.cap ? v.load / v.cap : 0); if (a.length > 120) a.shift(); }
}
export function selectRx(rx) { if (AN.rx !== rx) { AN.rx = rx; AN.hist = []; } }
export function resetCounters(rx) { delete AN.cnt[rx]; }

// ---------------- mesures d'une réception ----------------
export function streamMetrics(rx) {
  const R = FAB.res; if (!R) return null;
  const s = R.rxState[rx]; if (!s || !FAB.flows[s.flow]) return null;
  const f = FAB.flows[s.flow]; const g = flowGeom(f);
  const sd = FAB.devices[f.dev]; const sdPtp = R.devPtp[sd.id];
  const out = { flow: f, geom: g, per: {}, sample: {} };
  for (const c of COLORS) {
    const p = s.per[c];
    if (!p.ok) { out.per[c] = { ok: false, reason: p.reason }; out.sample[c] = null; continue; }
    const pm = pathMetrics(p, f);
    const loss = p.loss || 0;
    const jitter = 0.04 + pm.uMax ** 2 * 1.2 + Math.abs(gauss()) * 0.03; // µs
    const cinst = f.kind === 'video' ? Math.max(1, Math.round(2 + pm.uMax * 2.5 + (pm.hops > 2 ? 0.6 : 0) + Math.abs(gauss()) * 0.6 + (loss > 0 ? g.cmax : 0))) : null;
    const vrxPeak = f.kind === 'video' ? Math.max(1, Math.round(3 + pm.uMax * 3 + Math.abs(gauss()) * 0.8 + (loss > 0 ? g.vrx : 0))) : null;
    const br = g.pps * (g.pkt) * 8 / 1e9 * (1 - loss) * (1 + gauss() * 0.0008);
    const lat = pm.lat * (1 + gauss() * 0.02);
    // décalage entre l'horodatage RTP et l'arrivée (TROffset + traversée) ; dérive si l'émetteur n'est pas verrouillé
    const trOff = f.kind === 'video' ? 1e6 * (g.hdi ? 22 : 43) / (g.rate * (g.hdi ? 562.5 : 1125)) : f.kind === 'audio' ? 1000 : 400;
    const rtpOff = trOff + lat + (sdPtp && !['locked', 'noisy'].includes(sdPtp.state) ? (AN.drift[sd.id] || 0) / 1000 : 0);
    out.per[c] = { ok: true, loss, br, pps: g.pps * (1 - loss), jitter, cinst, vrxPeak, lat, hops: pm.hops, uMax: pm.uMax, rtpOff, path: p };
    out.sample[c] = { br, jitter, cinst, vrx: vrxPeak, lat, loss };
  }
  const r = out.per.red, b = out.per.blue;
  out.skew = r.ok && b.ok ? Math.abs(r.lat - b.lat) : null;
  out.sample.skew = out.skew;
  out.cnt = AN.cnt[rx] || null;
  out.compliant = f.kind !== 'video' ? null : COLORS.every((c) => !out.per[c].ok || (out.per[c].cinst <= g.cmax && out.per[c].vrxPeak <= g.vrx));
  out.senderPtp = sdPtp;
  return out;
}

// ---------------- charge des liens ----------------
export function topLinks(n = 12) {
  const R = FAB.res; if (!R) return [];
  return Object.entries(R.linkLoad).filter(([, v]) => v.cap).map(([k, v]) => ({ k, u: v.load / v.cap, load: v.load, cap: v.cap, n: v.n, hist: AN.links[k] || [] })).sort((a, b) => b.u - a.u).slice(0, n);
}

// ---------------- capture de paquets (port miroir) ----------------
const hx = (n, w = 2) => (n >>> 0).toString(16).padStart(w, '0');
export function mcastMac(g) { const p = g.split('.').map(Number); return `01:00:5e:${hx(p[1] & 0x7f)}:${hx(p[2])}:${hx(p[3])}`; }
export function devMac(d, c) { const n = d.nics[c]; return `08:00:11:${hx(CNUM[c])}:${hx(d.leaf)}:${hx(+n.ip.split('.')[3])}`; }
const swMac = (sw, port) => `28:99:3a:${hx(CNUM[sw.color] || 3)}:${hx(sw.k || sw.s || 0)}:${hx(+port.slice(8))}`;
function ssrcOf(id) { let h = 2166136261; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; return h >>> 0; }
const seqBase = (id) => ssrcOf(id) & 0xffff;
// flux qui traversent un port, dans un sens (« in » = reçu par le commutateur, « out » = émis vers le câble)
export function flowsOnPort(swId, port) {
  const R = FAB.res; const st = portState(swId, port); const peer = st.peer; const out = { in: [], out: [], peer, st };
  if (!R || !peer) return out;
  const seen = { in: new Set(), out: new Set() };
  const add = (dir, fid, c, rx) => { if (seen[dir].has(fid)) return; seen[dir].add(fid); out[dir].push({ f: FAB.flows[fid], color: c, rx }); };
  for (const [rid, s] of Object.entries(R.rxState)) for (const c of COLORS) {
    const p = s.per[c]; if (!p.ok) continue;
    for (const k of p.keys) {
      const parts = k.split(':'); const dir = parts.pop(); const id = parts.join(':');
      if (peer.kind === 'dev' && id === `${peer.dev.id}:${c}` && peer.color === c) add(dir === 'up' ? 'in' : 'out', p.flow || s.flow, c, rid);
      if (peer.kind === 'link' && id === peer.link.id) add(peer.side === 'a' ? (dir === 'up' ? 'out' : 'in') : (dir === 'up' ? 'in' : 'out'), s.flow, c, rid);
    }
  }
  // émetteurs sans abonné : le flux arrive quand même jusqu'à la leaf
  if (peer.kind === 'dev') for (const fid of peer.dev.senders || []) add('in', fid, peer.color);
  return out;
}
export function capture(swId, port, dir = 'both') {
  const R = FAB.res; const sw = FAB.switches[swId];
  const F = flowsOnPort(swId, port); const peer = F.peer;
  const t0 = 0;
  const c = sw.color === 'ctl' ? 'red' : sw.color;
  const ptpTime = Math.floor(Date.now() / 1000) + 37; // TAI ≈ UTC + 37 s
  const swm = swMac(sw, port);
  const peerMac = peer ? (peer.kind === 'dev' || peer.kind === 'gm' ? devMac(peer.dev, peer.color) : peer.kind === 'link' ? swMac(FAB.switches[peer.other.sw], peer.other.port) : '00:1b:21:aa:bb:cc') : '—';
  const myIp = peer && (peer.kind === 'dev' || peer.kind === 'gm') ? peer.dev.nics[peer.color].ip : peer && peer.kind === 'link' ? (sw.running.ports[port].ip || '').split('/')[0] : '';
  const otherIp = peer && peer.kind === 'link' ? (FAB.switches[peer.other.sw].running.ports[peer.other.port].ip || '').split('/')[0] : sw.role === 'leaf' ? `10.${CNUM[c]}.${sw.k}.1` : '';
  const lists = [];
  const want = (d) => dir === 'both' || (dir === 'rx' && d === 'in') || (dir === 'tx' && d === 'out');
  // --- RTP : quelques paquets consécutifs de chaque flux ---
  for (const d of ['in', 'out']) {
    if (!want(d)) continue;
    for (const x of F[d].slice(0, 6)) {
      const f = x.f; const g = flowGeom(f); const sd = FAB.devices[f.dev]; const n = sd.nics[x.color];
      const s = x.rx ? R.rxState[x.rx] : null; const loss = s && s.per[x.color].ok ? s.per[x.color].loss || 0 : 0;
      const count = f.kind === 'video' ? 10 : 3;
      let seq = seqBase(f.id + x.color); let row = 540, offs = -480;
      const tsBase = Math.floor((ptpTime * (f.kind === 'audio' ? 48000 : 90000)) % 4294967296);
      for (let i = 0; i < count; i++) {
        const t = t0 + i * 1e6 / g.pps + (f.kind === 'audio' ? 3 : 0);
        const gap = loss > 0 && i === 4 ? Math.max(1, Math.round(loss * 12)) : 0;
        seq = (seq + 1 + gap) & 0xffff;
        if (f.kind === 'video') { offs += 480 * (1 + gap); while (offs >= g.w) { offs -= g.w; row++; } }
        const last = f.kind === 'video' && i === count - 1 && Math.random() < 0.5;
        const layers = [
          ['Ethernet II', [['Destination', `${mcastMac(f.groups[x.color])} (multicast : 01:00:5e + 23 bits de poids faible du groupe)`], ['Source', devMac(sd, x.color)], ['Type', '0x0800 (IPv4)']]],
          ['IPv4', [['Source', n.ip], ['Destination', f.groups[x.color]], ['DSCP', `${f.kind === 'audio' ? DSCP_REF.audio + ' (AF41)' : f.kind === 'anc' ? DSCP_REF.anc + ' (AF21)' : DSCP_REF.video + ' (AF31)'}`], ['TTL', d === 'in' && peer.kind === 'dev' ? '64' : '62'], ['Protocole', '17 (UDP)'], ['Ne pas fragmenter', 'oui (DF)'], ['Longueur totale', `${g.pkt} octets`]]],
          ['UDP', [['Port source', String(f.udp)], ['Port destination', String(f.udp)], ['Longueur', `${g.pkt - 20} octets`]]],
          ['RTP (RFC 3550)', [['Version', '2'], ['Marqueur (M)', last ? '1 — dernier paquet de l\'image' : '0'], ['Type de charge (PT)', `${f.pt} (dynamique, défini par le SDP)`], ['Numéro de séquence', `${seq}${gap ? `   [ÉCART : ${gap} paquet(s) manquant(s)]` : ''}`], ['Horodatage', `${(tsBase + (f.kind === 'audio' ? i * 48 : 0)) >>> 0} (horloge ${f.kind === 'audio' ? '48 kHz' : '90 kHz'}, alignée sur PTP)`], ['SSRC', '0x' + hx(ssrcOf(f.id), 8)]]],
        ];
        if (f.kind === 'video') layers.push(['ST 2110-20 (RFC 4175)', [['Numéro de séquence étendu', String((ssrcOf(f.id) >> 16) & 0xffff)], ['Longueur SRD', `${g.payload} octets (${g.payload / 2.5} pixels)`], ['Trame (F)', g.hdi ? '0 ou 1 selon la trame' : '0 (progressif)'], ['Ligne (SRD Row Number)', String(row)], ['Décalage (SRD Offset)', `${offs} pixels`], ['Continuation (C)', '0'], ['Charge utile', `${g.payload} octets YCbCr 4:2:2 10 bits`]]]);
        if (f.kind === 'audio') layers.push(['ST 2110-30 (AES67)', [['Format', `L24 · 48 kHz · ${g.ch} canaux`], ['Durée du paquet', '1 ms (48 échantillons)'], ['Charge utile', `${g.payload} octets`]]]);
        if (f.kind === 'anc') layers.push(['ST 2110-40 (RFC 8331)', [['Paquets ANC', '1'], ['DID / SDID', '0x60 / 0x60 (timecode ATC)']]]);
        lists.push({ t, dir: d, proto: f.kind === 'video' ? 'RTP / 2110-20' : f.kind === 'audio' ? 'RTP / 2110-30' : 'RTP / 2110-40', src: n.ip, dst: f.groups[x.color], len: g.pkt + 18, info: `PT=${f.pt} SSRC=0x${hx(ssrcOf(f.id), 8)} Seq=${seq}${f.kind === 'video' ? ` ligne ${row} +${offs}` : ''}${last ? ' [M]' : ''}${gap ? ` · ${gap} paquet(s) manquant(s)` : ''}`, flow: f, layers, warn: !!gap, cat: 'rtp' });
      }
    }
  }
  // --- PTP (ST 2059-2) : la leaf est maître sur les ports d'accès, esclave sur un uplink ---
  const P = R.ptp[c]; const gm = P && P.gm; const ptpOn = sw.running.ptp.mode !== 'disabled' && sw.running.ports[port].ptp;
  if (ptpOn && peer && peer.kind !== 'probe') {
    const seqP = 3000 + Math.floor(Math.random() * 500);
    const master = peer.kind === 'link' ? (P.synced[sw.id] != null && P.synced[peer.other.sw] != null && P.synced[peer.other.sw] > P.synced[sw.id]) : true;
    const mDst = '224.0.1.129';
    const ptpL = (type, extra) => [['Ethernet II', [['Destination', '01:00:5e:00:01:81 (224.0.1.129)'], ['Source', master ? swm : peerMac]]], ['IPv4', [['Source', master ? (sw.role === 'leaf' ? `10.${CNUM[c]}.${sw.k}.1` : myIp) : myIp], ['Destination', mDst], ['DSCP', `${DSCP_REF.ptp} (EF)`], ['TTL', '1']]], ['UDP', [['Port destination', type === 'Announce' || type === 'Follow_Up' || type === 'Delay_Resp' ? '320 (messages généraux)' : '319 (messages d\'événement)']]], ['PTP v2 (IEEE 1588)', [['Type de message', type], ['Domaine', String(sw.running.ptp.domain)], ['Identité de l\'horloge émettrice', clockId(master ? sw.id : peer.kind === 'link' ? peer.other.sw : (peer.dev ? peer.dev.id : 'x'))], ...extra]]];
    const ann = gm ? [['Grand maître', `${gm.name} · ${clockId(gm.id)}`], ['priority1 / priority2', `${gm.p1} / ${gm.p2}`], ['clockClass', `${gm.cls}${gm.cls === 6 ? ' (verrouillé GPS)' : gm.cls === 248 ? ' (horloge libre)' : ''}`], ['stepsRemoved', String(P.synced[sw.id] ?? '—')], ['logMessageInterval', String(sw.running.ptp.announce)]] : [['Grand maître', 'aucun']];
    lists.push({ t: 1250, dir: master ? 'out' : 'in', proto: 'PTPv2', src: '', dst: mDst, len: 106, info: `Announce · domaine ${sw.running.ptp.domain} · GM ${gm ? gm.name : '—'}`, layers: ptpL('Announce', ann), cat: 'ptp' });
    lists.push({ t: 1300, dir: master ? 'out' : 'in', proto: 'PTPv2', src: '', dst: mDst, len: 86, info: `Sync · seq ${seqP} · deux temps (suivi d'un Follow_Up)`, layers: ptpL('Sync', [['sequenceId', String(seqP)], ['logMessageInterval', String(sw.running.ptp.sync)], ['flagField', 'twoStepFlag']]), cat: 'ptp' });
    lists.push({ t: 1302, dir: master ? 'out' : 'in', proto: 'PTPv2', src: '', dst: mDst, len: 86, info: `Follow_Up · seq ${seqP} · preciseOriginTimestamp ${ptpTime}.${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`, layers: ptpL('Follow_Up', [['sequenceId', String(seqP)], ['preciseOriginTimestamp', `${ptpTime} s (TAI)`]]), cat: 'ptp' });
    lists.push({ t: 1340, dir: master ? 'in' : 'out', proto: 'PTPv2', src: '', dst: mDst, len: 86, info: `Delay_Req · seq ${seqP - 1500}`, layers: ptpL('Delay_Req', [['sequenceId', String(seqP - 1500)], ['logMessageInterval', String(sw.running.ptp.delayReq)]]), cat: 'ptp' });
    lists.push({ t: 1342, dir: master ? 'out' : 'in', proto: 'PTPv2', src: '', dst: mDst, len: 96, info: `Delay_Resp · seq ${seqP - 1500} · correctionField ${Math.round(20 + Math.random() * 30)} ns`, layers: ptpL('Delay_Resp', [['sequenceId', String(seqP - 1500)], ['correctionField', 'temps de résidence cumulé']]), cat: 'ptp' });
  }
  // --- IGMP : rapports IGMPv3 de l'appareil, requête générale du querier ---
  if (peer && peer.kind === 'dev' && sw.role === 'leaf') {
    const groups = Object.values(R.rxState).filter((s) => s.per[c].joined && FAB.rx[s.rx].dev === peer.dev.id).map((s) => ({ g: s.per[c].group, src: s.per[c].src })).filter((x, i, a) => a.findIndex((y) => y.g === x.g) === i);
    const v = vlanOf(c, sw.k); const svi = sw.running.svis[v];
    if (groups.length && want('in')) lists.push({ t: 2100, dir: 'in', proto: 'IGMPv3', src: peer.dev.nics[c].ip, dst: '224.0.0.22', len: 54 + groups.length * 12, info: `Membership Report · ${groups.length} enregistrement(s) MODE_IS_INCLUDE`, layers: [['IPv4', [['Source', peer.dev.nics[c].ip], ['Destination', '224.0.0.22 (routeurs IGMPv3)'], ['TTL', '1'], ['Option', 'Router Alert']]], ['IGMPv3', [['Type', '0x22 (Membership Report v3)'], ...groups.slice(0, 6).map((x) => ['Enregistrement', `MODE_IS_INCLUDE · groupe ${x.g} · source ${x.src}`])]]], cat: 'igmp' });
    if (svi && svi.igmp && want('out')) lists.push({ t: 2000, dir: 'out', proto: `IGMPv${svi.igmp}`, src: svi.ip.split('/')[0], dst: '224.0.0.1', len: 50, info: `Membership Query générale (querier ${svi.ip.split('/')[0]}) · intervalle 125 s`, layers: [['IPv4', [['Source', svi.ip.split('/')[0]], ['Destination', '224.0.0.1 (tous les hôtes)'], ['TTL', '1']]], [`IGMPv${svi.igmp}`, [['Type', '0x11 (Membership Query)'], ['Groupe', '0.0.0.0 (requête générale)'], ['Max Resp Time', '10 s'], ['QQIC', '125 s'], ['Robustesse (QRV)', '2']]]], cat: 'igmp' });
  }
  // --- contrôle des uplinks : OSPF, PIM ---
  if (peer && peer.kind === 'link') {
    const up = R.up[peer.link.id];
    if (up.ospf === 'FULL' || /EXSTART|MTU/.test(up.ospf || '')) lists.push({ t: 3000, dir: 'out', proto: 'OSPF', src: myIp, dst: '224.0.0.5', len: 82, info: `Hello · zone 0.0.0.0 · router-id ${sw.running.ospf.routerId}${/MTU/.test(up.ospf || '') ? ' · voisin bloqué : DBD refusés (MTU différente)' : ''}`, layers: [['IPv4', [['Source', myIp], ['Destination', '224.0.0.5 (tous les routeurs OSPF)'], ['TTL', '1'], ['DSCP', '48 (CS6)']]], ['OSPFv2', [['Type', '1 (Hello)'], ['Router ID', sw.running.ospf.routerId], ['Zone', '0.0.0.0'], ['Hello / Dead', '10 s / 40 s'], ['MTU de l\'interface', String(sw.running.ports[port].mtu)]]]], cat: 'ctl', warn: /MTU/.test(up.ospf || '') });
    if (up.pim) {
      lists.push({ t: 3100, dir: 'out', proto: 'PIMv2', src: myIp, dst: '224.0.0.13', len: 68, info: 'Hello · holdtime 105 s', layers: [['IPv4', [['Source', myIp], ['Destination', '224.0.0.13 (tous les routeurs PIM)'], ['TTL', '1']]], ['PIMv2', [['Type', '0 (Hello)'], ['Holdtime', '105 s'], ['DR priority', '1']]]], cat: 'ctl' });
      const jflows = (peer.side === 'a' ? F.in : F.out).slice(0, 4);
      if (jflows.length) lists.push({ t: 3200, dir: peer.side === 'a' ? 'out' : 'in', proto: 'PIMv2', src: peer.side === 'a' ? myIp : otherIp, dst: '224.0.0.13', len: 54 + jflows.length * 20, info: `Join/Prune · ${jflows.length} jonction(s) (S,G)`, layers: [['PIMv2', [['Type', '3 (Join/Prune)'], ['Voisin amont', peer.side === 'a' ? otherIp : myIp], ...jflows.map((x) => ['Join', `(${FAB.devices[x.f.dev].nics[x.color].ip}, ${x.f.groups[x.color]}) · SPT`])]]], cat: 'ctl' });
    }
  }
  lists.sort((a, b) => a.t - b.t);
  lists.forEach((p, i) => { /** @type {any} */ (p).no = i + 1; }); // numéro de trame, comme dans un analyseur
  // débordement du port miroir
  const mon = Object.values(sw.running.monitor || {}).find((m) => m.src === port);
  const span = mon && mon.dest ? spanLoad(sw.id, mon) : null;
  const streams = [];
  for (const d of ['in', 'out']) for (const x of F[d]) { const g = flowGeom(x.f); streams.push({ dir: d, f: x.f, color: x.color, src: FAB.devices[x.f.dev].nics[x.color].ip, group: x.f.groups[x.color], pps: g.pps, mbps: x.f.gbps * 1000, dscp: x.f.kind === 'audio' ? DSCP_REF.audio : x.f.kind === 'anc' ? DSCP_REF.anc : DSCP_REF.video, mac: mcastMac(x.f.groups[x.color]) }); }
  return { packets: lists, streams, span, peer, flows: F };
}

// ---------------- SDP commenté ----------------
export function sdpExplain(line) {
  const k = line.slice(0, 2);
  if (k === 'v=') return 'Version du protocole SDP (toujours 0).';
  if (k === 'o=') return 'Origine : identifiant et version de la session, adresse de l\'émetteur. La version change quand le flux est modifié.';
  if (k === 's=') return 'Nom de la session (libellé du flux).';
  if (k === 'i=') return 'Information libre : ici l\'appareil et la norme.';
  if (k === 't=') return 'Durée de validité : 0 0 = permanente.';
  if (k === 'm=') return 'Média : type (video / audio), port UDP de destination, profil RTP/AVP et numéro de type de charge (PT).';
  if (k === 'c=') return 'Adresse de destination : le groupe multicast, et le TTL (/64).';
  if (k === 'b=') return 'Débit maximal annoncé (kbit/s).';
  if (line.startsWith('a=group:DUP')) return 'ST 2022-7 (RFC 7104) : les deux médias qui suivent sont deux copies du même flux (primary = rouge, secondary = bleu).';
  if (line.startsWith('a=source-filter')) return 'Filtre de source SSM : seul ce couple (source, groupe) est accepté. Le récepteur s\'abonnera en IGMPv3 (S,G).';
  if (line.startsWith('a=rtpmap')) return 'Associe le type de charge à un format : raw (2110-20), L24/48000/n (2110-30), smpte291 (2110-40), jxsv (2110-22), et à la fréquence de l\'horloge RTP.';
  if (line.startsWith('a=fmtp') && /sampling/.test(line)) return 'Paramètres de l\'image (ST 2110-20) : échantillonnage, dimensions, cadence exacte, profondeur, courbe de transfert (TCS), colorimétrie, modèle de paquets (PM), type d\'émetteur (TP : 2110TPN = étroit).';
  if (line.startsWith('a=fmtp') && /channel-order/.test(line)) return 'Ordre des canaux audio (ST 2110-30) : ST = stéréo, SGRP = groupe de 4, U0x = canaux non définis.';
  if (line.startsWith('a=fmtp')) return 'Paramètres propres au format.';
  if (line.startsWith('a=ptime') || line.startsWith('a=maxptime')) return 'Durée de l\'audio dans un paquet : 1 ms (AES67, niveau A).';
  if (line.startsWith('a=ts-refclk')) return 'Horloge de référence des horodatages RTP : PTP IEEE 1588-2008, identité du grand maître, domaine 127.';
  if (line.startsWith('a=mediaclk')) return 'Horloge média directement dérivée de PTP, sans décalage (direct=0).';
  if (line.startsWith('a=mid')) return 'Identifiant de ce média dans le groupe DUP (primary / secondary).';
  return '';
}
export { CLABEL };
