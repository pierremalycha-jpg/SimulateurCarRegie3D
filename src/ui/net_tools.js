// @ts-check
import { emit } from '../state.js';
import { el, fmt } from '../util.js';
import { toast, selectEl } from './common.js';
import { explain } from './widgets.js';
import { FAB, COLORS, CLABEL, PROBE_PORT, markDirty, linkName, portState } from '../net/fabric.js';
import { ifShort } from '../net/cli.js';
import { liveKv, qify } from './term.js';
import { AN, streamMetrics, selectRx, resetCounters, topLinks, capture, videoGeom, flowGeom, mcastMac } from '../net/analyzer.js';

// ----------------------------------------------------------------------------------
// Onglet « Mesures » du poste Réseau IP : analyseur de flux ST 2110 (ST 2110-21, 2022-7),
// suivi PTP, capture sur port miroir (SPAN) décodée, charge des liens.
// ----------------------------------------------------------------------------------
export const MS = { sub: 'stream', ptpDev: null, cap: { sw: 'LEAF-R1', port: 'Ethernet1', dir: 'both', res: null, filter: 'all', sel: null } };
const log = (type, o = {}) => emit('netlog', { type, ...o });
const host = (id) => (FAB.switches[id] ? FAB.switches[id].running.hostname : id);
const COL = { red: '#ff6b5e', blue: '#5ea8ff' };
const fmtG = (x) => (x >= 1 ? fmt(x, 2) + ' Gb/s' : fmt(x * 1000, 1) + ' Mb/s');
const fmtN = (x) => Math.round(x).toLocaleString('fr-FR');

// ---------------- graphique simple (canvas) ----------------
function chart(h = 150) {
  const c = el('canvas', { class: 'net-chart', height: h });
  c.draw = (series, o = {}) => {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = c.clientWidth || 600, H = h;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = '#07090b'; g.fillRect(0, 0, W, H);
    const vals = series.flatMap((s) => s.data.filter((v) => v != null && isFinite(v)));
    let lo = o.min ?? (vals.length ? Math.min(...vals) : 0), hi = o.max ?? (vals.length ? Math.max(...vals) : 1);
    for (const r of o.refs || []) { lo = Math.min(lo, r.v); hi = Math.max(hi, r.v); }
    if (o.sym) { const m = Math.max(Math.abs(lo), Math.abs(hi), o.symMin || 1); lo = -m; hi = m; }
    if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
    const pad = (hi - lo) * 0.08; lo -= o.min != null ? 0 : pad; hi += o.max != null ? 0 : pad;
    const X = (i, n) => 46 + (i / Math.max(1, n - 1)) * (W - 56), Y = (v) => 8 + (1 - (v - lo) / (hi - lo)) * (H - 24);
    g.strokeStyle = '#1f2830'; g.lineWidth = 1; g.font = '10px ui-monospace, monospace'; g.fillStyle = '#7d8a96';
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; const y = Y(v); g.beginPath(); g.moveTo(46, y); g.lineTo(W - 10, y); g.stroke(); g.fillText((o.fmt || ((x) => fmt(x, 1)))(v), 2, y + 3); }
    for (const r of o.refs || []) { g.strokeStyle = r.color || '#ffb020'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(46, Y(r.v)); g.lineTo(W - 10, Y(r.v)); g.stroke(); g.setLineDash([]); g.fillStyle = r.color || '#ffb020'; g.fillText(r.label, W - 10 - r.label.length * 6, Y(r.v) - 3); }
    for (const s of series) {
      g.strokeStyle = s.color; g.lineWidth = 1.6; g.beginPath(); let pen = false;
      s.data.forEach((v, i) => { if (v == null || !isFinite(v)) { pen = false; return; } const x = X(i, s.data.length), y = Y(Math.max(lo, Math.min(hi, v))); if (pen) g.lineTo(x, y); else g.moveTo(x, y); pen = true; });
      g.stroke();
    }
    g.fillStyle = '#7d8a96'; g.fillText(o.title || '', 50, H - 4);
    let lx = W - 10; for (const s of series.slice().reverse()) { const w = s.label.length * 6 + 16; lx -= w; g.fillStyle = s.color; g.fillRect(lx, H - 10, 10, 3); g.fillStyle = '#b8c4ce'; g.fillText(s.label, lx + 13, H - 6); }
  };
  return c;
}

export function tabMeasure(box, R) {
  const subs = [['stream', 'Analyseur de flux'], ['ptpm', 'Suivi PTP'], ['cap', 'Capture (port miroir)'], ['load', 'Charge des liens']];
  const tabs = el('div', { class: 'tabs' }, ...subs.map(([k, l]) => el('button', { class: 'tab' + (MS.sub === k ? ' on' : ''), onclick: () => { MS.sub = k; log('tool', { tool: k }); R.refresh(); } }, l)));
  const body = el('div', { class: 'list' });
  box.append(el('p', { class: 'note' }, 'Instruments de mesure branchés sur le réseau : un analyseur de flux ST 2110 (comme ceux que l\'on raccorde à une leaf ou en sortie de récepteur), un suivi PTP et une capture de paquets sur port miroir. Les valeurs sont simulées mais suivent l\'état réel du réseau.'), tabs, body);
  log('tool', { tool: MS.sub });
  ({ stream: subStream, ptpm: subPtp, cap: subCapture, load: subLoad })[MS.sub](body, R);
}
export function setMeasureSub(k) { if (k) MS.sub = k; }

// ---------------- analyseur de flux ----------------
function subStream(box, R) {
  const rxs = Object.values(FAB.rx).filter((r) => FAB.res && FAB.res.rxState[r.id] && FAB.flows[FAB.res.rxState[r.id].flow]);
  if (!rxs.find((r) => r.id === AN.rx) && rxs.length) selectRx(rxs[0].id);
  const sel = selectEl(rxs.map((r) => [r.id, `${r.label} ← ${FAB.flows[FAB.res.rxState[r.id].flow].label}`]), AN.rx, (v) => { selectRx(v); log('analyzer', { rx: v }); R.refresh(); });
  log('analyzer', { rx: AN.rx });
  const head = el('div', { class: 'grid2' });
  const tb = el('tbody'); const cells = {};
  const ROWS = [['state', 'État'], ['br', 'Débit (couche IP)'], ['pps', 'Paquets / s'], ['loss', 'Pertes'], ['jit', 'Gigue (écart-type IAT)'], ['cinst', 'CINST max / CMAX'], ['vrx', 'VRX max / VRX_FULL'], ['lat', 'Latence réseau'], ['rtp', 'Décalage RTP → arrivée'], ['hops', 'Chemin']];
  for (const [k, l] of ROWS) { const tr = el('tr', {}, el('th', {}, l)); cells[k] = {}; for (const c of COLORS) { const td = el('td', { class: 'mono' }); cells[k][c] = td; tr.append(td); } tb.append(tr); }
  const tbl = el('table', { class: 'tbl compact net-tbl net-an' }, el('thead', {}, el('tr', {}, el('th', {}, 'Mesure'), el('th', { class: 'red' }, 'Réseau rouge (primary)'), el('th', { class: 'blue' }, 'Réseau bleu (secondary)'))), tb);
  const dup = el('dl', { class: 'kv' }); const setDup = liveKv(dup);
  const c1 = chart(140), c2 = chart(140), c3 = chart(120);
  box.append(el('div', { class: 'hwpanel' }, el('div', { class: 'hwrow' }, el('h3', {}, 'Réception analysée'), sel, el('button', { class: 'btn small', onclick: () => { resetCounters(AN.rx); toast('Compteurs remis à zéro'); } }, 'Remettre les compteurs à zéro')), head),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Mesures par réseau'), el('div', { class: 'tblwrap' }, tbl)),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Fusion ST 2022-7 (récepteur)'), dup),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Historique (60 s)'), c1, c2, c3),
    el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Lire ces mesures'), el('ul', { class: 'steps' },
      el('li', {}, el('b', {}, 'CINST / CMAX : '), 'nombre de paquets arrivés « en avance » dans le modèle de réseau de ST 2110-21. Un émetteur étroit (type N) doit rester sous CMAX ; au-delà, ses rafales risquent de saturer les files d\'attente des commutateurs (le tampon du récepteur, lui, est couvert par VRX / VRX_FULL).'),
      el('li', {}, el('b', {}, 'VRX / VRX_FULL : '), 'remplissage du tampon du récepteur virtuel. Dépassement = paquets jetés chez le récepteur, même si le réseau ne perd rien.'),
      el('li', {}, el('b', {}, 'Gigue : '), 'irrégularité des arrivées. Elle augmente avec la charge des liens traversés (files d\'attente).'),
      el('li', {}, el('b', {}, 'Écart rouge / bleu : '), 'différence de temps de traversée des deux réseaux. Le récepteur 2022-7 doit l\'absorber dans son tampon ; ici quelques microsecondes, très en deçà de ce qu\'il tolère.'),
      el('li', {}, el('b', {}, 'Décalage RTP → arrivée : '), 'temps entre l\'horodatage RTP (heure PTP de l\'image) et l\'arrivée du paquet. Il dérive si l\'émetteur n\'est plus verrouillé en PTP.'))));
  const drawHead = (m) => {
    head.innerHTML = '';
    const f = m.flow, g = m.geom;
    const kv1 = el('dl', { class: 'kv' }); const add = (dl, k, v, cls) => dl.append(el('dt', {}, k), el('dd', { class: cls || '' }, v));
    add(kv1, 'Flux', `${f.label} · ${f.kind === 'video' ? 'ST 2110-20' : f.kind === 'audio' ? 'ST 2110-30' : 'ST 2110-40'}`);
    add(kv1, 'Émetteur', `${FAB.devices[f.dev].name} · ${FAB.devices[f.dev].nics.red.ip}`);
    add(kv1, 'Groupes', `${f.groups.red} · ${f.groups.blue} (UDP ${f.udp}, PT ${f.pt})`);
    add(kv1, 'MAC multicast', `${mcastMac(f.groups.red)} · ${mcastMac(f.groups.blue)}`);
    const kv2 = el('dl', { class: 'kv' });
    if (f.kind === 'video') {
      add(kv2, 'Format', `${g.w} × ${g.h}${g.hdi ? 'i' : 'p'}50 · 4:2:2 10 bits · paquets de ${g.payload} octets`);
      add(kv2, 'Paquets', `${g.perLine} par ligne · ${fmtN(g.npackets)} par ${g.hdi ? 'trame' : 'image'} · ${fmtN(g.pps)} par seconde`);
      add(kv2, 'ST 2110-21', `émetteur étroit (TPN) · CMAX ${g.cmax} · VRX_FULL ${g.vrx}`);
      add(kv2, 'Conformité', m.compliant ? 'CONFORME' : 'NON CONFORME (rafales ou tampon dépassés)', m.compliant ? 'ok' : 'err');
    } else { add(kv2, 'Format', f.kind === 'audio' ? `L24 · 48 kHz · ${g.ch} canaux · paquets de 1 ms` : 'données ANC'); add(kv2, 'Paquets / s', fmtN(g.pps)); }
    if (m.senderPtp) add(kv2, 'PTP de l\'émetteur', m.senderPtp.state === 'locked' ? 'verrouillé' : m.senderPtp.state === 'noisy' ? 'verrouillé, bruité' : 'NON verrouillé : horodatages faux', m.senderPtp.state === 'locked' ? '' : 'warn');
    head.append(kv1, kv2); qify(head);
  };
  let lastFlow = '';
  R.live = () => {
    const m = streamMetrics(AN.rx); if (!m) return;
    if (m.flow.id !== lastFlow) { lastFlow = m.flow.id; drawHead(m); }
    const g = m.geom;
    for (const c of COLORS) {
      const p = m.per[c]; const C = cells;
      if (!p.ok) { C.state[c].textContent = 'RIEN REÇU'; C.state[c].className = 'mono err'; C.state[c].title = p.reason; for (const k of ['br', 'pps', 'loss', 'jit', 'cinst', 'vrx', 'lat', 'rtp']) C[k][c].textContent = '—'; C.hops[c].textContent = p.reason.slice(0, 80); continue; }
      C.state[c].textContent = p.loss > 0 ? `PERTES ${fmt(p.loss * 100, 1)} %` : 'reçu'; C.state[c].className = 'mono ' + (p.loss > 0 ? 'err' : 'ok');
      C.br[c].textContent = fmtG(p.br); C.pps[c].textContent = fmtN(p.pps);
      C.loss[c].textContent = p.loss > 0 ? `${fmtN(g.pps * p.loss)} paquets/s` : '0'; C.loss[c].className = 'mono ' + (p.loss > 0 ? 'err' : '');
      C.jit[c].textContent = `${fmt(p.jitter, 2)} µs`;
      C.cinst[c].textContent = p.cinst != null ? `${p.cinst} / ${g.cmax}` : '—'; C.cinst[c].className = 'mono ' + (p.cinst != null && p.cinst > g.cmax ? 'err' : '');
      C.vrx[c].textContent = p.vrxPeak != null ? `${p.vrxPeak} / ${g.vrx}` : '—'; C.vrx[c].className = 'mono ' + (p.vrxPeak != null && p.vrxPeak > g.vrx ? 'err' : '');
      C.lat[c].textContent = `${fmt(p.lat, 1)} µs`; C.rtp[c].textContent = `${fmt(p.rtpOff, 0)} µs`; C.rtp[c].className = 'mono ' + (p.rtpOff > 5000 ? 'warn' : '');
      C.hops[c].textContent = `${p.hops + 1} commutateur(s) · charge max ${fmt(p.uMax * 100, 0)} %${p.path.spine ? ' · ' + host(p.path.spine) : ''}`;
    }
    const cnt = m.cnt || {};
    setDup([['Écart rouge / bleu', m.skew != null ? `${fmt(m.skew, 2)} µs` : 'une seule jambe reçue', m.skew == null ? 'warn' : ''],
      ['Paquets reçus', `rouge ${fmtN(cnt.red || 0)} · bleu ${fmtN(cnt.blue || 0)}`],
      ['Paquets réparés par l\'autre réseau', fmtN(cnt.repaired || 0), (cnt.repaired || 0) > 0 ? 'warn' : ''],
      ['Paquets perdus définitivement', fmtN(cnt.lost || 0), (cnt.lost || 0) > 0 ? 'err' : 'ok']]);
    const H = AN.hist;
    c1.draw(COLORS.map((c) => ({ label: CLABEL[c], color: COL[c], data: H.map((x) => (x[c] ? x[c].br : null)) })), { title: 'Débit (Gb/s)', min: 0, fmt: (v) => fmt(v, 2) });
    if (m.flow.kind === 'video') c2.draw([...COLORS.map((c) => ({ label: 'CINST ' + CLABEL[c], color: COL[c], data: H.map((x) => (x[c] ? x[c].cinst : null)) }))], { title: 'CINST (paquets)', min: 0, refs: [{ v: g.cmax, label: 'CMAX ' + g.cmax }], fmt: (v) => fmt(v, 0) });
    else c2.draw(COLORS.map((c) => ({ label: CLABEL[c], color: COL[c], data: H.map((x) => (x[c] ? x[c].jitter : null)) })), { title: 'Gigue (µs)', min: 0, fmt: (v) => fmt(v, 2) });
    c3.draw([...COLORS.map((c) => ({ label: 'latence ' + CLABEL[c], color: COL[c], data: H.map((x) => (x[c] ? x[c].lat : null)) })), { label: 'écart', color: '#ffb020', data: H.map((x) => x.skew) }], { title: 'Latence réseau et écart rouge / bleu (µs)', min: 0, fmt: (v) => fmt(v, 1) });
  };
}

// ---------------- suivi PTP ----------------
function subPtp(box, R) {
  const devs = Object.values(FAB.devices).filter((d) => d.kind !== 'gm' && d.kind !== 'nmos');
  if (!MS.ptpDev || (!FAB.devices[MS.ptpDev] && !FAB.switches[MS.ptpDev])) MS.ptpDev = (devs.find((d) => d.kind === 'ccu') || devs[0]).id;
  const opts = [...devs.map((d) => [d.id, d.name]), ...Object.values(FAB.switches).filter((s) => s.role !== 'ctl').map((s) => [s.id, s.running.hostname + ' (horloge frontière)'])];
  const sel = selectEl(opts, MS.ptpDev, (v) => { MS.ptpDev = v; R.refresh(); });
  const kv = el('dl', { class: 'kv' }); const setKv = liveKv(kv);
  const c1 = chart(180), c2 = chart(120);
  const gmBtn = el('button', { class: 'btn small', onclick: () => { FAB.gm.gm1.up = !FAB.gm.gm1.up; markDirty(); explain(FAB.gm.gm1.up ? 'Grand maître 1 rétabli : avec priority1 100, il est réélu. Observez le petit transitoire de l\'offset.' : 'Grand maître 1 coupé : après 3 Announce manqués, le BMCA élit le grand maître 2. Observez l\'offset : un saut de quelques centaines de ns, rattrapé par l\'asservissement en quelques secondes.'); R.refresh(); } }, FAB.gm.gm1.up ? 'Couper le grand maître 1' : 'Rétablir le grand maître 1');
  box.append(el('div', { class: 'hwpanel' }, el('div', { class: 'hwrow' }, el('h3', {}, 'Horloge suivie'), sel, gmBtn), kv, c1, c2),
    el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Lire la courbe'), el('p', {}, 'L\'offset est l\'écart entre l\'horloge de l\'appareil et celle de son maître, mesuré à chaque message Sync (8 par seconde en ST 2059-2). Verrouillé : quelques dizaines de ns. Au changement de grand maître : un saut, puis la convergence de l\'asservissement. Sans priorité PTP dans les commutateurs (QoS) et avec des liens chargés : bruit de plusieurs centaines de ns. Horloge non traçable : l\'appareil suit un maître qui dérive par rapport au GPS (courbe du bas).')));
  R.live = () => {
    const id = MS.ptpDev; const H = AN.ptp[id] || [];
    const d = FAB.devices[id]; const st = d ? FAB.res.devPtp[id] : null; const sw = FAB.switches[id];
    const rows = []; const add = (k, v, cls) => rows.push([k, v, cls]);
    const last = H[H.length - 1];
    if (d && st) { add('État', { locked: 'verrouillé', noisy: 'verrouillé, bruité', free: 'non traçable (horloge libre)', unlocked: 'NON verrouillé' }[st.state] + (st.why ? ' — ' + st.why : ''), st.state === 'locked' ? 'ok' : st.state === 'noisy' ? 'warn' : 'err'); add('Réseau utilisé', st.color ? CLABEL[st.color] : '—'); add('Sauts jusqu\'au grand maître', st.hops != null ? String(st.hops) : '—'); }
    if (sw) { const P = FAB.res.ptp[sw.color]; const h = P && P.synced[sw.id]; add('État', h != null ? `synchronisé · ${h} saut(s) du grand maître` : 'NON synchronisé', h != null ? 'ok' : 'err'); }
    const c = d && st ? st.color || 'red' : sw ? sw.color : 'red'; const gm = FAB.res.gmActive[c];
    add('Grand maître', gm ? `${gm.name}${gm.rogue ? ' — NON GPS !' : ''}` : 'aucun', gm && !gm.rogue ? '' : 'err');
    add('Offset actuel', last && last.off != null ? `${fmt(last.off, 0)} ns` : '—');
    setKv(rows);
    c1.draw([{ label: 'offset', color: '#46c6f2', data: H.map((x) => x.off) }], { title: 'Offset par rapport au maître (ns)', sym: true, symMin: 120, refs: [{ v: 100, label: '+100 ns', color: '#3a4652' }, { v: -100, label: '−100 ns', color: '#3a4652' }], fmt: (v) => fmt(v, 0) });
    c2.draw([{ label: 'écart au temps GPS', color: '#ffb020', data: H.map((x) => x.drift / 1000) }], { title: 'Dérive cumulée par rapport au GPS (µs)', fmt: (v) => fmt(v, 1) });
  };
}

// ---------------- capture ----------------
function subCapture(box, R) {
  const C = MS.cap;
  if (!FAB.switches[C.sw]) C.sw = 'LEAF-R1';
  const sw = FAB.switches[C.sw];
  const ports = sw.hw.map((h) => h.name).filter((n) => { const st = portState(sw.id, n); return st.peer && st.peer.kind !== 'probe'; });
  if (!ports.includes(C.port)) C.port = ports[0];
  const swSel = selectEl(Object.values(FAB.switches).filter((s) => s.role !== 'ctl').map((s) => [s.id, s.running.hostname]), C.sw, (v) => { C.sw = v; C.res = null; R.refresh(); });
  const pSel = selectEl(ports.map((n) => { const st = portState(sw.id, n); return [n, `${ifShort(n)} · ${st.peer.kind === 'link' ? host(st.peer.other.sw) : st.peer.dev.name}`]; }), C.port, (v) => { C.port = v; C.res = null; R.refresh(); });
  const dSel = selectEl([['both', 'entrée + sortie'], ['rx', 'reçu par le commutateur (rx)'], ['tx', 'émis vers le câble (tx)']], C.dir, (v) => { C.dir = v; });
  const probe = PROBE_PORT[sw.role];
  const run = () => {
    const ok = R.applyCli(sw.id, [`monitor session 1 source ${C.port}${C.dir === 'both' ? '' : ' ' + C.dir}`, `monitor session 1 destination ${probe}`], `session miroir : ${C.port} recopié vers ${probe}, où est branché le PC de mesure.`);
    if (!ok) return;
    C.res = capture(sw.id, C.port, C.dir); C.sel = null; C.filter = 'all';
    log('capture', { sw: sw.id, port: C.port });
    R.refresh();
  };
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Port à observer'),
    el('div', { class: 'hwrow' }, swSel, pSel, dSel, el('button', { class: 'btn small primary', onclick: run }, 'Créer la session miroir et capturer'),
      el('button', { class: 'btn small', onclick: () => { if (R.applyCli(sw.id, ['no monitor session 1'], 'session miroir supprimée.')) { C.res = null; R.refresh(); } } }, 'Supprimer la session miroir')),
    el('p', { class: 'note' }, `Le PC de mesure est branché sur ${probe} de chaque ${sw.role === 'spine' ? 'spine' : 'leaf'}. Une session miroir (SPAN) recopie le trafic du port choisi vers ce port : « monitor session 1 source ${C.port} » puis « monitor session 1 destination ${probe} ». Attention : si ${probe} est plus lent que le trafic recopié, c'est la capture qui perd des paquets, pas le réseau.`)));
  const r = C.res;
  if (!r) { box.append(el('p', { class: 'note' }, 'Aucune capture pour l\'instant.')); return; }
  if (r.span && r.span.load > r.span.cap) box.append(el('div', { class: 'item' }, el('span', { class: 'dot amber' }), el('div', { class: 'grow' }, el('div', { class: 't' }, `Port miroir saturé : ${fmt(r.span.load, 1)} Gb/s recopiés vers un port de ${r.span.cap} Gb/s`), el('div', { class: 's' }, 'La capture est incomplète (paquets manquants côté analyseur) ; les flux, eux, ne sont pas affectés. Capturez dans un seul sens (rx ou tx) ou utilisez un port plus rapide.'))));
  // flux observés
  const st = el('tbody');
  for (const x of r.streams) st.append(el('tr', {}, el('td', {}, x.dir === 'in' ? 'entrant' : 'sortant'), el('td', {}, x.f.label), el('td', { class: 'mono' }, x.src), el('td', { class: 'mono' }, x.group), el('td', { class: 'mono' }, x.mac), el('td', { class: 'mono' }, x.f.kind === 'video' ? '2110-20' : x.f.kind === 'audio' ? '2110-30' : '2110-40'), el('td', { class: 'mono' }, x.dscp), el('td', { class: 'mono' }, fmtN(x.pps)), el('td', { class: 'mono' }, x.mbps >= 1000 ? fmt(x.mbps / 1000, 2) + ' Gb/s' : fmt(x.mbps, 1) + ' Mb/s')));
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, `Flux multicast observés sur ${host(sw.id)} ${ifShort(C.port)}`), r.streams.length ? el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact net-tbl' }, el('thead', {}, el('tr', {}, ...['Sens', 'Flux', 'Source', 'Groupe', 'MAC de destination', 'Norme', 'DSCP', 'Paquets/s', 'Débit'].map((h) => el('th', {}, h)))), st)) : el('p', { class: 'note' }, 'Aucun flux média sur ce port.')));
  // liste des paquets
  const filt = el('div', { class: 'tabs' }, ...[['all', 'Tous'], ['rtp', 'RTP'], ['ptp', 'PTP'], ['igmp', 'IGMP'], ['ctl', 'OSPF / PIM']].map(([k, l]) => el('button', { class: 'tab' + (C.filter === k ? ' on' : ''), onclick: () => { C.filter = k; C.sel = null; R.refresh(); } }, l)));
  const list = r.packets.filter((p) => C.filter === 'all' || p.cat === C.filter);
  const tb = el('tbody');
  for (const p of list) tb.append(el('tr', { class: (C.sel === p.no ? 'sel ' : '') + (p.warn ? 'warnrow' : ''), onclick: () => { C.sel = p.no; R.refresh(); } }, el('td', { class: 'mono' }, p.no), el('td', { class: 'mono' }, fmt(p.t, 1)), el('td', {}, p.dir === 'in' ? '→ commutateur' : '→ câble'), el('td', { class: 'mono' }, p.src || '—'), el('td', { class: 'mono' }, p.dst), el('td', { class: 'mono' }, p.proto), el('td', { class: 'mono' }, p.len), el('td', { class: 'mono' + (p.warn ? ' err' : '') }, p.info)));
  const det = el('div', { class: 'net-decode' });
  const pk = r.packets.find((p) => p.no === C.sel);
  if (pk) for (const [layer, fields] of pk.layers) det.append(el('details', { open: true }, el('summary', {}, layer), el('dl', { class: 'kv' }, ...fields.flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)]))));
  else det.append(el('p', { class: 'note' }, 'Cliquez un paquet pour le décoder couche par couche.'));
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, `Paquets (${list.length})`), filt, el('div', { class: 'tblwrap net-pk' }, el('table', { class: 'tbl compact net-tbl' }, el('thead', {}, el('tr', {}, ...['N°', 'Temps (µs)', 'Sens', 'Source', 'Destination', 'Protocole', 'Long.', 'Info'].map((h) => el('th', {}, h)))), tb)), det,
    el('p', { class: 'note' }, 'Extrait représentatif : quelques paquets consécutifs de chaque flux, puis les messages de contrôle (PTP, IGMP, OSPF, PIM) avec leurs vrais intervalles. Un « ÉCART » dans les numéros de séquence RTP signale des paquets perdus.')));
}

// ---------------- charge des liens ----------------
function subLoad(box, R) {
  const tb = el('tbody'); const sp = [];
  for (const L of topLinks(14)) {
    const c = el('canvas', { class: 'net-spark', width: 160, height: 28 });
    sp.push([c, L]);
    const parts = L.k.split(':'); parts.pop(); const id = parts.join(':'); // dernier segment : sens du lien
    const link = FAB.links.find((x) => x.id === id);
    const go = () => { if (link) R.go('switch', { sw: link.a.sw, port: link.a.port, sub: 'ports' }); else { const d = FAB.devices[parts[0]]; if (d) { const n = d.nics[parts[1]]; R.go('switch', { sw: n.sw, port: n.port, sub: 'ports' }); } } };
    tb.append(el('tr', { onclick: go }, el('td', {}, linkName(L.k)), el('td', { class: 'mono ' + (L.u > 1 ? 'err' : L.u > 0.8 ? 'warn' : '') }, fmt(L.u * 100, 0) + ' %'), el('td', { class: 'mono' }, `${fmt(L.load, 1)} / ${L.cap} Gb/s`), el('td', { class: 'mono' }, L.n), el('td', {}, c)));
  }
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Liens les plus chargés (par sens)'), el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact net-tbl' }, el('thead', {}, el('tr', {}, ...['Lien', 'Charge', 'Débit', 'Flux', 'Historique (30 s)'].map((h) => el('th', {}, h)))), tb)),
    el('p', { class: 'note' }, 'Au-delà de 100 %, les paquets en trop sont jetés pour tous les flux du lien (mode PIM). Au-delà de 80 %, la gigue augmente et PTP devient bruité si sa priorité n\'est pas configurée. Cliquez une ligne pour ouvrir le port.')));
  R.live = () => {
    for (const [c, L] of sp) {
      const h = AN.links[L.k] || []; const g = c.getContext('2d'); g.fillStyle = '#07090b'; g.fillRect(0, 0, 160, 28);
      g.strokeStyle = '#2c3640'; g.beginPath(); g.moveTo(0, 6); g.lineTo(160, 6); g.stroke();
      g.strokeStyle = L.u > 1 ? '#ff3b30' : L.u > 0.8 ? '#ffb020' : '#2fd25a'; g.beginPath();
      h.forEach((v, i) => { const x = (i / Math.max(1, h.length - 1)) * 158 + 1, y = 26 - Math.min(1.2, v) / 1.2 * 22; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
    }
  };
}
export { videoGeom, flowGeom };
