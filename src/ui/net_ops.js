// @ts-check
import { emit } from '../state.js';
import { el, fmt } from '../util.js';
import { toast, ask } from './common.js';
import { explain } from './widgets.js';
import { FAB, COLORS, CLABEL, LEAVES, PTP_REF, NMOS_REG, CTL_GW, sviIp, subnetOf, ipToInt, isMcast, clockId, nodeId, evaluate, setDeviceNet, setFlowAddr, setRxManual, rxTransport, factoryDevice } from '../net/fabric.js';
import { route, DESTS } from '../pipeline.js';

// ----------------------------------------------------------------------------------
// Onglet « Exploitation » du poste Réseau IP : l'interface d'un contrôleur de diffusion et des
// interfaces web des appareils, dans l'esprit des passerelles et contrôleurs du marché. Quatre vues :
//   · Connexions : une source, une destination, la connexion NMOS (IS-05) ou les paramètres de
//     transport saisis à la main ; les moniteurs du bandeau montrent la source et ce que reçoit
//     la destination ;
//   · Appareils : adresses des cartes média A (rouge) et B (bleu), réseau de contrôle, registre
//     NMOS, PTP, adresses des émetteurs ; sortie d'usine ;
//   · PTP et NMOS : supervision.
// Tout ce qui est saisi agit sur le même modèle que l'onglet Technique (src/net/fabric.js).
// ----------------------------------------------------------------------------------
export const OPS = { view: 'route', dev: 'gwstade', rx: 'AUX_GIANT', src: 'v:CLEAN', mode: null, man: null, draft: null, filter: '', ptpDev: null, hist: {} };
const VIEWS = [['route', 'Connexions'], ['dev', 'Appareils'], ['ptp', 'PTP'], ['nmos', 'NMOS']];
const KIND = { ccu: 'Voie caméra (CCU)', mixer: 'Mélangeur', gfx: 'Habillage', gateway: 'Passerelle IP ↔ SDI', mv: 'Multiviewer', mon: 'Moniteur de référence', audio: 'Audio ST 2110-30 / AES67', tx: 'Encodeur de contribution' };
const ESS = { video: 'ST 2110-20', audio: 'ST 2110-30', anc: 'ST 2110-40', jxs: 'ST 2110-22' };
const log = (type, o = {}) => emit('netlog', { type, ...o });
const IP_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
const validIp = (x) => !x || (IP_RE.test(x) && ipToInt(x) != null);
const led = (lv, label, title = '') => el('span', { class: 'ops-led ' + lv, title }, el('i'), label);

// ---------------- ce que l'on peut connecter ----------------
const srcList = () => Object.values(FAB.flows).filter((f) => f.kind === 'video' && !f.id.includes('#'));
const dstList = () => DESTS.filter((d) => FAB.rx[d.id]).map((d) => ({ ...d, rx: FAB.rx[d.id] }));
function rxState(rx) { return FAB.res ? FAB.res.rxState[rx] : null; }
function rxLevel(rx) { const s = rxState(rx); return !s ? 'off' : !s.ok ? 'err' : s.loss > 0 || !s.protected ? 'warn' : 'ok'; }
function rxShort(rx) { const s = rxState(rx); return !s ? 'non connecté' : !s.ok ? 'rien reçu' : s.loss > 0 ? 'pertes' : s.protected ? 'reçu A + B' : `reçu ${s.per.red.ok ? 'A' : 'B'} seul`; }
function rxSummary(rx) {
  const s = rxState(rx); if (!s) return 'Non connecté';
  if (!s.ok) return 'Rien reçu';
  if (s.loss > 0) return `Pertes ${fmt(s.loss * 100, 0)} %`;
  return s.protected ? 'Reçu · rouge + bleu (2022-7)' : `Reçu sur le seul réseau ${s.per.red.ok ? 'rouge' : 'bleu'}`;
}

// ---------------- signature de l'état affiché (pour ne redessiner que si besoin) ----------------
let sigRes = null, sig = '';
export function opsKey() {
  if (FAB.res !== sigRes) {
    sigRes = FAB.res; const R = FAB.res;
    sig = R ? [Object.values(R.reg).filter(Boolean).length, JSON.stringify(R.rxState[OPS.rx] || null), JSON.stringify(R.devPtp[OPS.dev] || null), R.regWhy && R.regWhy[OPS.dev], R.gmActive.red && R.gmActive.red.id, R.gmActive.blue && R.gmActive.blue.id, R.regOk, FAB.issues.length].join('|') : '';
  }
  return [OPS.view, OPS.dev, OPS.rx, OPS.src, OPS.mode, OPS.ptpDev, FAB.ver, sig].join('§');
}

// ---------------- moniteurs du bandeau : source et destination ----------------
export function opsDock() {
  const srcLab = el('div', { class: 'lab ops-monlab' }, el('span', {})), dstLab = el('div', { class: 'lab labrow ops-monlab' });
  const src = el('div', { class: 'mon fill', 'data-gl': 'TX:' + OPS.src }), dst = el('div', { class: 'mon fill', 'data-gl': 'RX:' + OPS.rx });
  const dstLed = el('span', { class: 'ops-led' }, el('i'), '');
  dstLab.append(el('span', {}, ''), dstLed);
  const nodes = [el('div', { class: 'monwrap grow ops-mon' }, srcLab, src), el('div', { class: 'monwrap grow ops-mon' }, dstLab, dst)];
  const update = () => {
    const f = FAB.flows[OPS.src]; const d = FAB.rx[OPS.rx];
    src.dataset.gl = 'TX:' + OPS.src; dst.dataset.gl = 'RX:' + OPS.rx;
    srcLab.firstChild.textContent = 'Source · ' + (f ? `${f.label} (${FAB.devices[f.dev].name})` : '—');
    dstLab.firstChild.textContent = 'Destination · ' + (d ? d.label : '—');
    const lv = rxLevel(OPS.rx); dstLed.className = 'ops-led ' + lv; dstLed.lastChild.textContent = rxShort(OPS.rx); dstLed.title = rxSummary(OPS.rx);
  };
  update();
  return { nodes, update };
}

// ---------------- vue principale ----------------
export function tabOps(box, R) {
  const nav = el('nav', { class: 'ops-nav', 'aria-label': 'Exploitation' });
  for (const [k, l] of VIEWS) {
    const dot = k === 'ptp' ? ptpLevel() : k === 'nmos' ? nmosLevel() : null;
    nav.append(el('button', { class: 'ops-navbtn' + (OPS.view === k ? ' on' : ''), 'data-ops': k, onclick: () => { OPS.view = k; log('ops', { view: k }); R.refresh(); } }, el('span', {}, l), dot ? el('i', { class: 'ops-dot ' + dot }) : null));
  }
  const main = el('div', { class: 'ops-main' });
  box.append(el('div', { class: 'ops' }, nav, main));
  ({ route: viewRoute, dev: viewDev, ptp: viewPtp, nmos: viewNmos })[OPS.view](main, R);
}
const card = (title, ...kids) => el('section', { class: 'ops-card' }, title ? el('h4', {}, title) : null, ...kids);
const kv = (rows) => el('dl', { class: 'ops-kv' }, ...rows.filter(Boolean).flatMap(([k, v, cls]) => [el('dt', {}, k), el('dd', { class: cls || '' }, v)]));
function ptpLevel() { const R = FAB.res; if (!R) return 'off'; const g = R.gmActive.red || R.gmActive.blue; if (!g || g.rogue) return 'err'; return Object.values(R.devPtp).some((p) => p.state !== 'locked') ? 'warn' : 'ok'; }
function nmosLevel() { const R = FAB.res; if (!R) return 'off'; if (!R.regOk) return 'err'; return Object.values(R.reg).every(Boolean) ? 'ok' : 'warn'; }

// ================= Connexions =================
function viewRoute(box, R) {
  if (!FAB.rx[OPS.rx]) OPS.rx = dstList()[0].rx.id;
  if (!FAB.flows[OPS.src]) OPS.src = srcList()[0].id;
  const rx = FAB.rx[OPS.rx]; const t = rxTransport(OPS.rx);
  if (OPS.mode == null) OPS.mode = t.manual ? 'manual' : 'nmos';
  // sources
  const srcs = el('div', { class: 'ops-list' });
  for (const f of srcList()) {
    const d = FAB.devices[f.dev];
    const ok = FAB.res && (FAB.res.nic[d.id + ':red'] || {}).reach && (FAB.res.nic[d.id + ':blue'] || {}).reach;
    srcs.append(el('button', { class: 'ops-row' + (OPS.src === f.id ? ' on' : ''), 'data-src': f.id, 'data-txt': (f.label + ' ' + d.name).toLowerCase(), onclick: () => { OPS.src = f.id; log('opssrc', { fid: f.id }); R.refresh(); } },
      el('i', { class: 'ops-dot ' + (ok ? 'ok' : 'warn') }), el('span', { class: 'ops-name' }, f.label), el('span', { class: 'ops-sub' }, d.name)));
  }
  // destinations
  const dsts = el('div', { class: 'ops-list' }); let grp = '';
  for (const d of dstList()) {
    if (d.group !== grp) { grp = d.group; dsts.append(el('div', { class: 'ops-grp' }, grp)); }
    const s = rxState(d.rx.id); const f = s && FAB.flows[s.flow];
    dsts.append(el('button', { class: 'ops-row' + (OPS.rx === d.rx.id ? ' on' : ''), 'data-dst': d.rx.id, 'data-txt': (d.rx.label + ' ' + d.group + ' ' + (f ? f.label : '')).toLowerCase(), onclick: () => { OPS.rx = d.rx.id; OPS.mode = null; OPS.man = null; log('opsdst', { rx: d.rx.id }); R.refresh(); } },
      el('i', { class: 'ops-dot ' + rxLevel(d.rx.id) }), el('span', { class: 'ops-name' }, d.rx.label), el('span', { class: 'ops-sub' }, (FAB.rxManual[d.rx.id] ? 'manuel · ' : '') + (f ? f.label : '—'))));
  }
  const search = el('input', { type: 'search', class: 'ops-search', placeholder: 'Filtrer (CAM 3, tuile, écran…)', value: OPS.filter, 'aria-label': 'Filtrer les sources et destinations' });
  // filtre sur place (sans redessiner : le champ garde le focus)
  const applyFilter = () => {
    const q = OPS.filter.trim().toLowerCase();
    for (const list of [srcs, dsts]) {
      let head = null, any = false;
      for (const n of /** @type {HTMLElement[]} */ ([...list.children])) {
        if (n.classList.contains('ops-grp')) { if (head) head.hidden = !any; head = n; any = false; continue; }
        n.hidden = !!q && !(n.dataset.txt || '').includes(q); any = any || !n.hidden;
      }
      if (head) head.hidden = !any;
    }
  };
  search.addEventListener('input', () => { OPS.filter = search.value; applyFilter(); });
  // émetteur choisi : ses adresses (à recopier en mode manuel)
  const f = FAB.flows[OPS.src]; const sd = FAB.devices[f.dev];
  const srcInfo = el('div', { class: 'ops-srcinfo' }, el('b', {}, f.label), el('span', { class: 'ops-sub' }, `${sd.name} · ${ESS[f.kind]} · ${f.gbps >= 1 ? fmt(f.gbps, 2) + ' Gb/s' : fmt(f.gbps * 1000, 1) + ' Mb/s'}`),
    ...COLORS.map((c) => el('div', { class: 'ops-addr ' + c }, el('span', {}, c === 'red' ? 'A' : 'B'), el('code', {}, `${sd.nics[c] ? sd.nics[c].ip : '—'} → ${f.groups[c] || '—'} : ${f.udp}`))),
    el('button', { class: 'btn small', onclick: () => R.openSdp(f.id) }, 'SDP'));
  box.append(el('div', { class: 'ops-route' },
    card('Sources (émetteurs)', srcs, srcInfo),
    connectCard(R, rx, t, f),
    card('Destinations (récepteurs)', dsts)));
  box.prepend(el('div', { class: 'ops-toolbar' }, search, el('span', { class: 'ops-sub' }, 'Choisis une source et une destination : les moniteurs du bandeau montrent la source et ce que reçoit vraiment la destination.')));
  applyFilter();
}
function connectCard(R, rx, t, f) {
  const s = rxState(rx.id); const lv = rxLevel(rx.id); const rd = FAB.devices[rx.dev];
  const head = el('div', { class: 'ops-conhead' }, el('span', { class: 'ops-name' }, f.label), el('span', { class: 'ops-arrow' }, '→'), el('span', { class: 'ops-name' }, rx.label));
  const status = el('div', { class: 'ops-status ' + lv }, el('b', {}, rxSummary(rx.id)), s && s.reason ? el('span', {}, s.reason) : null);
  const legs = el('div', { class: 'ops-legs' }, ...COLORS.map((c) => { const p = s && s.per[c]; return el('div', { class: 'ops-leg ' + c }, el('span', { class: 'ops-legname' }, c === 'red' ? 'A · rouge' : 'B · bleu'), led(!p ? 'off' : p.ok ? (p.loss > 0 ? 'warn' : 'ok') : 'err', !p ? 'inactif' : p.ok ? (p.loss > 0 ? `pertes ${fmt(p.loss * 100, 0)} %` : 'flux reçu') : 'rien', p && !p.ok ? p.reason : '')); }));
  const seg = el('div', { class: 'ops-seg', role: 'tablist' },
    ...[['nmos', 'NMOS (IS-05)'], ['manual', 'Saisie manuelle']].map(([k, l]) => el('button', { class: OPS.mode === k ? 'on' : '', role: 'tab', 'data-mode': k, onclick: () => { OPS.mode = k; OPS.man = null; log('opsmode', { mode: k }); R.refresh(); } }, l)));
  const body = el('div', { class: 'ops-conbody' });
  if (OPS.mode === 'nmos') {
    const sd = FAB.devices[f.dev];
    body.append(el('p', { class: 'ops-help' }, 'Le contrôleur lit le SDP de l\'émetteur dans le registre (IS-04) et l\'envoie au récepteur (IS-05) : le récepteur s\'abonne lui-même aux deux groupes, rien à saisir.'),
      paramTable(COLORS.map((c) => ({ c, src: sd.nics[c] ? sd.nics[c].ip : '', group: f.groups[c], port: f.udp, ro: true })), rd),
      el('div', { class: 'ops-actions' }, el('button', { class: 'btn primary', 'data-act': 'connect', onclick: () => connectNmos(R, rx, f) }, 'Connecter'),
        FAB.rxManual[rx.id] ? el('span', { class: 'ops-sub' }, 'Ce récepteur est en saisie manuelle : la connexion IS-05 remplacera ses paramètres.') : null));
  } else {
    if (!OPS.man || OPS.man.rx !== rx.id) { const cur = t.red ? t : { red: { on: true, src: '', group: '', port: 5004 }, blue: { on: true, src: '', group: '', port: 5004 } }; OPS.man = { rx: rx.id, red: { ...cur.red }, blue: { ...cur.blue } }; }
    body.append(el('p', { class: 'ops-help' }, 'Comme dans l\'interface web du récepteur : pour chaque réseau, l\'adresse de la source, le groupe multicast et le port UDP (IGMPv3 : abonnement au couple source + groupe). Recopie-les depuis la fiche de la source.'),
      paramTable(COLORS.map((c) => ({ c, ...OPS.man[c], ro: false })), rd),
      el('div', { class: 'ops-actions' }, el('button', { class: 'btn primary', 'data-act': 'apply-rx', onclick: () => applyManual(R, rx) }, 'Appliquer'),
        FAB.rxManual[rx.id] ? el('button', { class: 'btn', onclick: () => { setRxManual(rx.id, null); OPS.mode = null; explain(`${rx.label} : paramètres manuels retirés, le récepteur revient à la connexion NMOS décidée par le contrôleur (grille).`); R.refresh(); } }, 'Revenir en NMOS') : null));
  }
  return card('Connexion', head, status, legs, seg, body);
}
function paramTable(rows, rd) {
  const tb = el('tbody');
  for (const r of rows) {
    const inp = (k, ph, w) => {
      if (r.ro) return el('td', { class: 'mono' }, r[k] == null || r[k] === '' ? '—' : String(r[k]));
      const i = el('input', { type: k === 'port' ? 'number' : 'text', class: 'ops-in' + (w ? ' ' + w : ''), value: r[k] ?? '', placeholder: ph, spellcheck: 'false', 'data-leg': r.c + ':' + k, 'aria-label': `${k} ${CLABEL[r.c]}` });
      i.addEventListener('input', () => { OPS.man[r.c][k] = k === 'port' ? +i.value : i.value.trim(); });
      return el('td', {}, i);
    };
    const name = r.c === 'red' ? 'A · rouge' : 'B · bleu';
    const on = r.ro ? el('th', {}, name) : (() => { const c = el('input', { type: 'checkbox', 'data-leg': r.c + ':on', title: 'Jambe active' }); c.checked = r.on !== false; c.addEventListener('change', () => { OPS.man[r.c].on = c.checked; }); return el('th', {}, el('label', { class: 'ops-legon' }, c, name)); })();
    tb.append(el('tr', { class: 'ops-' + r.c }, on, inp('src', '10.x.y.z'), inp('group', '239.x.y.z'), inp('port', '5004', 'port')));
  }
  return el('div', { class: 'ops-conbody' }, el('div', { class: 'tblwrap' }, el('table', { class: 'ops-tbl' }, el('thead', {}, el('tr', {}, ...['Réseau', 'Adresse source', 'Groupe multicast', 'Port UDP'].map((x) => el('th', {}, x)))), tb)),
    el('div', { class: 'ops-sub' }, `Interfaces du récepteur : A ${rd.nics.red ? rd.nics.red.ip : '—'} · B ${rd.nics.blue ? rd.nics.blue.ip : '—'}`));
}
function connectNmos(R, rx, f) {
  const err = route(rx.id, f.src);
  log('opsconnect', { rx: rx.id, fid: f.id, mode: 'nmos', ok: !err });
  if (err) { toast(err, 'bad', 6000); explain('Connexion refusée par le contrôleur : ' + err, 'warn'); }
  else { OPS.mode = 'nmos'; explain(`${f.label} → ${rx.label} : le contrôleur a envoyé au récepteur le SDP de l'émetteur (IS-05, PATCH /staged avec activation immédiate). Le récepteur quitte l'ancien flux et s'abonne en IGMPv3 aux groupes ${f.groups.red} (rouge) et ${f.groups.blue} (bleu).`); }
  R.refresh();
}
function applyManual(R, rx) {
  const m = OPS.man;
  for (const c of COLORS) {
    const L = m[c]; if (!L.on) continue;
    if (L.src && !validIp(L.src)) { toast(`Adresse source ${CLABEL[c]} invalide : ${L.src}`, 'bad'); return; }
    if (L.group && !(validIp(L.group) && isMcast(L.group))) { toast(`Le groupe ${CLABEL[c]} doit être une adresse multicast (224.0.0.0 à 239.255.255.255)`, 'bad'); return; }
    if (!(L.port >= 1 && L.port <= 65535)) { toast(`Port UDP ${CLABEL[c]} entre 1 et 65535`, 'bad'); return; }
  }
  setRxManual(rx.id, { red: m.red, blue: m.blue }); evaluate();
  const s = rxState(rx.id); const f = s && FAB.flows[s.flow];
  log('opsconnect', { rx: rx.id, fid: s ? s.flow : null, mode: 'manual', ok: !!(s && s.ok) });
  explain(s && s.ok ? `${rx.label} : paramètres appliqués. ${s.protected ? 'Les deux jambes reçoivent le flux' : 'Une seule jambe reçoit le flux'} « ${f.label} »${s.protected ? ' : la protection ST 2022-7 est active.' : ` : ${s.reason}`}` : `${rx.label} : paramètres appliqués, mais rien n'arrive. ${s ? s.reason : ''}`, s && s.ok && s.protected ? '' : 'warn');
  R.refresh();
}

// ================= Appareils =================
const devList = () => Object.values(FAB.devices).filter((d) => d.kind !== 'gm' && d.kind !== 'nmos');
function devLevels(d) {
  const R = FAB.res; if (!R) return { a: 'off', b: 'off', p: 'off', n: 'off' };
  const nic = (c) => { const x = R.nic[d.id + ':' + c]; return !x ? 'off' : x.reach && !x.conflict ? 'ok' : x.up ? 'warn' : 'err'; };
  const p = R.devPtp[d.id]; const pl = !p ? 'off' : p.state === 'locked' ? 'ok' : p.state === 'noisy' ? 'warn' : 'err';
  return { a: nic('red'), b: nic('blue'), p: pl, n: R.reg[d.id] ? 'ok' : 'err' };
}
function newDraft(d) {
  const v = { dev: d.id, nics: {}, ctlIp: d.ctlIp, ctlMask: d.ctlMask, ctlGw: d.ctlGw, nmosReg: d.nmosReg, domain: d.ptp.domain, slaveOnly: d.ptp.slaveOnly !== false, flows: {} };
  for (const c of COLORS) if (d.nics[c]) v.nics[c] = { ip: d.nics[c].ip, mask: d.nics[c].mask, gw: d.nics[c].gw };
  for (const fid of d.senders || []) v.flows[fid] = { red: FAB.flows[fid].groups.red, blue: FAB.flows[fid].groups.blue, udp: FAB.flows[fid].udp };
  return v;
}
function viewDev(box, R) {
  if (!FAB.devices[OPS.dev] || ['gm', 'nmos'].includes(FAB.devices[OPS.dev].kind)) OPS.dev = 'gwstade';
  const d = FAB.devices[OPS.dev];
  if (!OPS.draft || OPS.draft.dev !== d.id) OPS.draft = newDraft(d);
  const list = el('div', { class: 'ops-list ops-devlist' });
  for (const L of LEAVES) {
    const ds = devList().filter((x) => x.leaf === L.k); if (!ds.length) continue;
    list.append(el('div', { class: 'ops-grp' }, L.name));
    for (const x of ds) {
      const lv = devLevels(x);
      list.append(el('button', { class: 'ops-row' + (x.id === d.id ? ' on' : ''), 'data-dev': x.id, onclick: () => { OPS.dev = x.id; OPS.draft = null; log('opsdev', { dev: x.id }); R.refresh(); } },
        el('span', { class: 'ops-name' }, x.name), el('span', { class: 'ops-leds' }, ...['a', 'b', 'p', 'n'].map((k) => el('i', { class: 'ops-dot ' + lv[k], title: { a: 'Média A', b: 'Média B', p: 'PTP', n: 'NMOS' }[k] })))));
    }
  }
  box.append(el('div', { class: 'ops-devwrap' }, card('Appareils', el('div', { class: 'ops-legend' }, 'Voyants : média A · média B · PTP · NMOS'), list), devPage(d, R)));
}
function devPage(d, R) {
  const D = OPS.draft; const res = FAB.res; const lv = devLevels(d);
  const changed = JSON.stringify(D) !== JSON.stringify(newDraft(d));
  const inp = (val, set, ph, cls = '', key = '') => { const i = el('input', { type: 'text', class: 'ops-in ' + cls, value: val ?? '', placeholder: ph, spellcheck: 'false', 'data-f': key }); i.addEventListener('input', () => { set(i.value.trim()); markChanged(); }); return i; };
  const num = (val, set, min, max, key = '') => { const i = el('input', { type: 'number', class: 'ops-in num', value: val, min, max, 'data-f': key }); i.addEventListener('input', () => { set(+i.value); markChanged(); }); return i; };
  const pending = el('span', { class: 'ops-pending', hidden: !changed }, 'Modifications non appliquées');
  const markChanged = () => { pending.hidden = false; };
  const header = el('div', { class: 'ops-devhead' },
    el('div', {}, el('h3', {}, d.name), el('div', { class: 'ops-sub' }, `${KIND[d.kind] || d.kind} · interface web · nœud NMOS ${nodeId(d.id).slice(0, 8)}…`)),
    el('div', { class: 'ops-leds big' }, led(lv.a, 'Média A'), led(lv.b, 'Média B'), led(lv.p, 'PTP'), led(lv.n, 'NMOS')));
  // cartes média
  const tb = el('tbody');
  for (const c of COLORS) {
    const n = d.nics[c]; if (!n) continue; const st = res.nic[d.id + ':' + c] || {};
    tb.append(el('tr', { class: 'ops-' + c }, el('th', {}, c === 'red' ? 'A · rouge' : 'B · bleu', el('div', { class: 'ops-sub ops-port' }, `${FAB.switches[n.sw].running.hostname} ${n.port.replace('Ethernet', 'Et')}`)),
      el('td', {}, inp(D.nics[c].ip, (x) => { D.nics[c].ip = x; }, `10.${c === 'red' ? 1 : 2}.${d.leaf}.x`, '', c + ':ip')),
      el('td', {}, num(D.nics[c].mask, (x) => { D.nics[c].mask = x; }, 1, 32, c + ':mask')),
      el('td', {}, inp(D.nics[c].gw, (x) => { D.nics[c].gw = x; }, sviIp(c, d.leaf), '', c + ':gw')),
      el('td', { class: 'nowrap' }, led(!st.up ? 'err' : st.reach && !st.conflict ? 'ok' : 'warn', !st.up ? 'lien coupé' : st.conflict ? 'conflit' : st.reach ? 'joignable' : 'injoignable', st.why || ''))));
  }
  const media = card('Interfaces média (ST 2110)', el('div', { class: 'tblwrap' }, el('table', { class: 'ops-tbl' }, el('thead', {}, el('tr', {}, ...['Port', 'Adresse IP', 'Masque', 'Passerelle', 'État'].map((x) => el('th', {}, x)))), tb)),
    el('p', { class: 'ops-help' }, `Plan du car : ${subnetOf('red', d.leaf)} (rouge) et ${subnetOf('blue', d.leaf)} (bleu), passerelle .1 (la leaf), appareils à partir de .20, même fin d'adresse sur les deux réseaux.`));
  // contrôle + NMOS
  const regLv = res.reg[d.id] ? 'ok' : 'err';
  const ctl = card('Contrôle et NMOS',
    el('div', { class: 'ops-form' },
      fieldRow('Adresse de contrôle', inp(D.ctlIp, (x) => { D.ctlIp = x; }, '10.20.0.x', '', 'ctl:ip')),
      fieldRow('Masque', num(D.ctlMask, (x) => { D.ctlMask = x; }, 1, 32, 'ctl:mask')),
      fieldRow('Passerelle', inp(D.ctlGw, (x) => { D.ctlGw = x; }, CTL_GW, '', 'ctl:gw')),
      fieldRow('Registre NMOS (IS-04)', inp(D.nmosReg, (x) => { D.nmosReg = x; }, NMOS_REG, '', 'nmos:reg'))),
    kv([['Enregistrement', led(regLv, res.reg[d.id] ? 'enregistré · battement toutes les 5 s' : 'non enregistré', res.regWhy && res.regWhy[d.id])], res.regWhy && res.regWhy[d.id] ? ['Cause', res.regWhy[d.id], 'err'] : null, ['API du nœud', `http://${d.ctlIp || '—'}/x-nmos/node/v1.3`]]),
    el('p', { class: 'ops-help' }, `Réseau de contrôle 10.20.0.0/22 (VLAN 20), passerelle ${CTL_GW}, registre ${NMOS_REG}.`));
  // PTP
  const P = res.devPtp[d.id] || {};
  const dom = num(D.domain, (x) => { D.domain = x; }, 0, 255, 'ptp:domain');
  const so = el('input', { type: 'checkbox', 'data-f': 'ptp:slave' }); so.checked = D.slaveOnly; so.addEventListener('change', () => { D.slaveOnly = so.checked; markChanged(); });
  const gm = res.gmActive[P.color || 'red'];
  const ptp = card('Synchronisation PTP (SMPTE ST 2059-2)',
    el('div', { class: 'ops-form' }, fieldRow('Domaine', dom), el('label', { class: 'ops-check' }, so, 'Esclave uniquement (ne jamais devenir maître)')),
    kv([['État', led(P.state === 'locked' ? 'ok' : P.state === 'noisy' ? 'warn' : 'err', ptpState(P), P.why || '')], P.why ? ['Cause', P.why, 'err'] : null,
      gm && (P.state === 'locked' || P.state === 'noisy') ? ['Grand maître', `${gm.name} · ${clockId(gm.id)}`] : null,
      P.offset != null ? ['Décalage / délai moyen', `${P.offset} ns · ${P.delay} ns (${P.hops} saut${P.hops > 1 ? 's' : ''})`] : null]),
    el('p', { class: 'ops-help' }, `Profil ST 2059-2 : domaine ${PTP_REF.domain}, annonces 4/s, synchronisation 8/s.`));
  // émetteurs
  const sends = (d.senders || []).map((fid) => FAB.flows[fid]);
  const tbs = el('tbody');
  for (const f of sends) {
    const v = D.flows[f.id];
    tbs.append(el('tr', {}, el('td', {}, f.label, el('div', { class: 'ops-sub' }, ESS[f.kind])),
      el('td', {}, inp(v.red, (x) => { v.red = x; }, `239.1.${d.leaf}.x`, 'ops-red', 'tx:' + f.id + ':red')),
      el('td', {}, inp(v.blue, (x) => { v.blue = x; }, `239.2.${d.leaf}.x`, 'ops-blue', 'tx:' + f.id + ':blue')),
      el('td', {}, num(v.udp, (x) => { v.udp = x; }, 1, 65535, 'tx:' + f.id + ':udp')),
      el('td', {}, el('button', { class: 'btn small', onclick: () => R.openSdp(f.id) }, 'SDP'))));
  }
  const txc = sends.length ? card('Émetteurs (destination multicast)', el('div', { class: 'tblwrap' }, el('table', { class: 'ops-tbl' }, el('thead', {}, el('tr', {}, ...['Flux', 'Groupe A (rouge)', 'Groupe B (bleu)', 'Port UDP', ''].map((x) => el('th', {}, x)))), tbs))) : null;
  // récepteurs
  const rxs = (d.receivers || []).map((r) => FAB.rx[r]);
  const rxc = rxs.length ? card('Récepteurs', el('div', { class: 'ops-list flat' }, ...rxs.map((r) => {
    const s = rxState(r.id); const f = s && FAB.flows[s.flow]; const routable = DESTS.some((x) => x.id === r.id);
    return el('div', { class: 'ops-rxrow' }, el('i', { class: 'ops-dot ' + rxLevel(r.id) }), el('span', { class: 'ops-name' }, r.label), el('span', { class: 'ops-sub' }, `${FAB.rxManual[r.id] ? 'saisie manuelle' : r.fixed ? 'connexion fixe' : 'NMOS'} · ${f ? f.label : rxSummary(r.id)}`),
      routable ? el('button', { class: 'btn small', onclick: () => { OPS.rx = r.id; OPS.mode = null; OPS.view = 'route'; log('ops', { view: 'route' }); R.refresh(); } }, 'Connecter…') : null);
  }))) : null;
  const actions = el('div', { class: 'ops-actions ops-devbar' },
    el('button', { class: 'btn primary', 'data-act': 'apply-dev', onclick: () => applyDev(R, d) }, 'Appliquer'),
    el('button', { class: 'btn', onclick: () => { OPS.draft = null; R.refresh(); } }, 'Annuler'), pending,
    el('span', { class: 'ops-spacer' }),
    el('button', { class: 'btn danger', 'data-act': 'factory', onclick: async () => { if (!(await ask(`Remettre « ${d.name} » en configuration d'usine ? Il disparaît du réseau du car jusqu'à ce qu'on le reconfigure.`, { title: 'Sortie d\'usine', ok: 'Remettre en sortie d\'usine', danger: true }))) return; factoryDevice(d.id); OPS.draft = null; evaluate(); log('opsfactory', { dev: d.id }); explain(`${d.name} remis en sortie d'usine : adresses ${'192.168.x.100'}, pas de registre NMOS, PTP en domaine 0. Il n'est plus joignable : à reconfigurer d'après le plan d'adressage.`, 'warn'); R.refresh(); } }, 'Remettre en sortie d\'usine'));
  media.classList.add('span'); if (txc) txc.classList.add('span');
  return el('div', { class: 'ops-devpage' }, header, actions, el('div', { class: 'ops-grid' }, media, ctl, ptp, txc, rxc));
}
const fieldRow = (label, input) => { const id = 'o' + Math.random().toString(36).slice(2, 8); input.id = id; return el('div', { class: 'ops-field' }, el('label', { for: id }, label), input); };
function ptpShort(P) { return P.state === 'locked' ? 'verrouillé' : P.state === 'noisy' ? 'instable' : P.state === 'free' ? 'non traçable' : 'pas de maître'; }
function ptpState(P) { return P.state === 'locked' ? 'SLAVE · verrouillé' : P.state === 'noisy' ? 'SLAVE · instable' : P.state === 'free' ? 'non traçable (horloge libre)' : 'LISTENING · pas de maître'; }
function applyDev(R, d) {
  const D = OPS.draft;
  const ips = [...COLORS.filter((c) => D.nics[c]).flatMap((c) => [[D.nics[c].ip, `adresse ${CLABEL[c]}`], [D.nics[c].gw, `passerelle ${CLABEL[c]}`]]), [D.ctlIp, 'adresse de contrôle'], [D.ctlGw, 'passerelle de contrôle'], [D.nmosReg, 'registre NMOS']];
  for (const [v, l] of ips) if (!validIp(v)) { toast(`${l} invalide : ${v}`, 'bad'); return; }
  for (const m of [...COLORS.filter((c) => D.nics[c]).map((c) => D.nics[c].mask), D.ctlMask]) if (!(m >= 1 && m <= 32)) { toast('Masque entre /1 et /32', 'bad'); return; }
  if (!(D.domain >= 0 && D.domain <= 255)) { toast('Domaine PTP entre 0 et 255', 'bad'); return; }
  for (const [fid, v] of Object.entries(D.flows)) {
    for (const c of COLORS) if (v[c] && !(validIp(v[c]) && isMcast(v[c]))) { toast(`${FAB.flows[fid].label} : groupe ${CLABEL[c]} non multicast (${v[c]})`, 'bad'); return; }
    if (!(v.udp >= 1 && v.udp <= 65535)) { toast('Port UDP entre 1 et 65535', 'bad'); return; }
  }
  setDeviceNet(d.id, { nics: D.nics, ctlIp: D.ctlIp, ctlMask: D.ctlMask, ctlGw: D.ctlGw, nmosReg: D.nmosReg, ptp: { domain: D.domain, slaveOnly: D.slaveOnly } });
  for (const [fid, v] of Object.entries(D.flows)) { const f = FAB.flows[fid]; if (f.groups.red !== v.red || f.groups.blue !== v.blue || f.udp !== v.udp) setFlowAddr(fid, { red: v.red, blue: v.blue }, v.udp); }
  const res = evaluate(); OPS.draft = null;
  const lv = devLevels(d);
  const word = (x) => (x === 'ok' ? 'OK' : x === 'warn' ? 'à vérifier' : 'en défaut');
  log('opsapply', { dev: d.id });
  explain(`${d.name} : réglages appliqués. Média A ${word(lv.a)} · média B ${word(lv.b)} · PTP ${word(lv.p)} · NMOS ${res.reg[d.id] ? 'enregistré' : 'non enregistré (' + res.regWhy[d.id] + ')'}.`, lv.a === 'ok' && lv.b === 'ok' && lv.p === 'ok' && lv.n === 'ok' ? '' : 'warn');
  R.refresh();
}

// ================= PTP =================
function viewPtp(box, R) {
  const res = FAB.res;
  const gms = el('div', { class: 'ops-grid two' });
  for (const c of COLORS) {
    const g = res.gmActive[c]; const P = res.ptp[c];
    const cands = [1, 2].map((k) => ({ k, gm: FAB.gm['gm' + k] }));
    gms.append(card(`Réseau ${CLABEL[c]} (${c === 'red' ? 'A' : 'B'})`,
      el('div', { class: 'ops-gm ' + (g ? (g.rogue ? 'err' : 'ok') : 'err') }, el('div', { class: 'ops-sub' }, 'Grand maître élu'), el('b', {}, g ? g.name : 'aucun'), g ? el('code', {}, clockId(g.id)) : null),
      kv([g ? ['Qualité', `priority1 ${g.p1} · classe ${g.cls}${g.cls === 6 ? ' (GPS verrouillé)' : g.cls === 7 ? ' (maintien)' : ''} · priority2 ${g.p2}`] : null, ['Domaine · profil', `${PTP_REF.domain} · SMPTE ST 2059-2`], ['Commutateurs synchronisés', `${Object.keys(P.synced).length} (horloges frontières)`],
        ['Grands maîtres', cands.map((x) => `GM${x.k} ${x.gm.up ? (x.gm.gps ? 'GPS' : 'sans GPS') : 'arrêté'} (p1 ${x.gm.priority1})`).join(' · ')]])));
  }
  const tb = el('tbody');
  if (!OPS.ptpDev || !FAB.devices[OPS.ptpDev]) OPS.ptpDev = 'ccu1' in FAB.devices ? 'ccu1' : devList()[0].id;
  for (const d of devList()) {
    const P = res.devPtp[d.id] || {}; const lv = P.state === 'locked' ? 'ok' : P.state === 'noisy' ? 'warn' : 'err';
    tb.append(el('tr', { class: OPS.ptpDev === d.id ? 'sel' : '', 'data-ptpdev': d.id, onclick: () => { OPS.ptpDev = d.id; R.refresh(); } }, el('td', {}, d.name), el('td', { class: 'nowrap' }, led(lv, ptpShort(P), ptpState(P) + (P.why ? ' — ' + P.why : ''))), el('td', { class: 'mono' }, P.color ? (P.color === 'red' ? 'A' : 'B') : '—'), el('td', { class: 'mono num' }, P.offset != null ? String(P.offset) : '—'), el('td', { class: 'mono num' }, P.delay != null ? String(P.delay) : '—'), el('td', { class: 'mono num' }, P.hops != null ? String(P.hops) : '—'), el('td', { class: 'mono' }, d.ptp.domain)));
  }
  const cv = el('canvas', { class: 'ops-spark', width: 640, height: 120 });
  const sel = FAB.devices[OPS.ptpDev];
  box.append(gms, el('div', { class: 'ops-grid wide' },
    card('Appareils', el('div', { class: 'tblwrap ops-scroll' }, el('table', { class: 'ops-tbl' }, el('thead', {}, el('tr', {}, ...['Appareil', 'État', 'Via', 'Décalage (ns)', 'Délai moyen (ns)', 'Sauts', 'Domaine'].map((x) => el('th', {}, x)))), tb))),
    card('Décalage au maître · ' + sel.name, cv, el('p', { class: 'ops-help' }, 'Écart entre l\'horloge de l\'appareil et celle du grand maître, mesuré à chaque message Sync. Verrouillé : quelques dizaines de ns. Au-delà de 1 µs, les images ne sont plus alignées.'))));
  R.live = () => drawSpark(cv, sel.id);
}
function drawSpark(cv, id) {
  const P = FAB.res && FAB.res.devPtp[id]; const h = (OPS.hist[id] = OPS.hist[id] || []);
  const now = performance.now();
  if (!h.length || now - h[h.length - 1].t > 250) {
    const ok = P && (P.state === 'locked' || P.state === 'noisy');
    const v = ok ? P.offset * (Math.random() * 2 - 1) * 0.6 + (P.state === 'noisy' ? (Math.random() - 0.5) * 1200 : (Math.random() - 0.5) * 14) : null;
    h.push({ t: now, v }); if (h.length > 120) h.shift();
  } else return;
  const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H);
  const span = Math.max(100, ...h.map((x) => (x.v == null ? 0 : Math.abs(x.v)))) * 1.2;
  g.strokeStyle = '#2d3338'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  g.fillStyle = '#69727a'; g.font = '12px JetBrains Mono, monospace'; g.fillText(`±${Math.round(span)} ns`, 6, 14);
  g.strokeStyle = h.some((x) => x.v == null) ? '#e8392f' : Math.max(...h.map((x) => Math.abs(x.v))) > 500 ? '#f0a61c' : '#2fbf5a'; g.lineWidth = 2; g.beginPath();
  let pen = false;
  h.forEach((x, i) => { if (x.v == null) { pen = false; return; } const X = (i / 119) * W, Y = H / 2 - (x.v / span) * (H / 2 - 6); if (pen) g.lineTo(X, Y); else g.moveTo(X, Y); pen = true; });
  g.stroke();
  if (h[h.length - 1].v == null) { g.fillStyle = '#e8392f'; g.font = '600 14px Barlow, sans-serif'; g.fillText('pas de synchronisation', W / 2 - 70, H / 2 - 10); }
}

// ================= NMOS =================
function viewNmos(box, R) {
  const res = FAB.res; const devs = devList(); const reg = devs.filter((d) => res.reg[d.id]).length;
  const nSend = devs.filter((d) => res.reg[d.id]).reduce((a, d) => a + (d.senders || []).length, 0);
  const nRecv = devs.filter((d) => res.reg[d.id]).reduce((a, d) => a + (d.receivers || []).length, 0);
  const conns = Object.values(res.rxState).filter((s) => s.flow && FAB.flows[s.flow]);
  box.append(el('div', { class: 'ops-grid two' },
    card('Registre NMOS', el('div', { class: 'ops-gm ' + (res.regOk ? 'ok' : 'err') }, el('div', { class: 'ops-sub' }, `${NMOS_REG} · VLAN 20`), el('b', {}, res.regOk ? 'En service' : 'Injoignable')),
      kv([['API', 'IS-04 v1.3 (enregistrement, requêtes) · IS-05 v1.1 (connexions)'], ['Nœuds enregistrés', `${reg} / ${devs.length}`, reg < devs.length ? 'err' : ''], ['Émetteurs · récepteurs', `${nSend} · ${nRecv}`], ['Connexions actives', String(conns.length)]])),
    card('Comment ça marche', el('p', { class: 'ops-help' }, 'Au démarrage, chaque appareil (nœud) trouve le registre (adresse saisie ou DNS-SD), y déclare ses émetteurs et récepteurs (IS-04), puis envoie un battement toutes les 5 s. Sans battement pendant 12 s, le registre l\'efface. Le contrôleur lit le registre et commande les connexions des récepteurs (IS-05).'))));
  const tb = el('tbody'); const t = Math.floor(performance.now() / 1000);
  for (const d of devs) {
    const ok = res.reg[d.id];
    tb.append(el('tr', { 'data-node': d.id, onclick: () => { OPS.dev = d.id; OPS.draft = null; OPS.view = 'dev'; R.refresh(); } }, el('td', {}, d.name), el('td', { class: 'mono' }, d.ctlIp || '—'), el('td', {}, led(ok ? 'ok' : 'err', ok ? 'enregistré' : 'absent', ok ? '' : res.regWhy[d.id])), el('td', { class: 'nowrap', 'data-hb': d.id }, ok ? `il y a ${(t + d.id.length) % 5} s` : '—'), el('td', { class: 'mono num' }, String((d.senders || []).length)), el('td', { class: 'mono num' }, String((d.receivers || []).length)), el('td', { class: 'mono ops-sub' }, nodeId(d.id).slice(0, 13) + '…')));
  }
  const ctb = el('tbody');
  for (const s of conns.filter((x) => DESTS.some((d) => d.id === x.rx)).slice(0, 60)) {
    const f = FAB.flows[s.flow];
    ctb.append(el('tr', {}, el('td', {}, FAB.rx[s.rx].label), el('td', {}, f.label), el('td', {}, s.manual ? 'manuel' : 'IS-05'), el('td', {}, led(rxLevel(s.rx), s.ok ? (s.protected ? 'A + B' : 'un réseau') : 'rien'))));
  }
  box.append(el('div', { class: 'ops-grid wide' },
    card('Nœuds', el('div', { class: 'tblwrap ops-scroll' }, el('table', { class: 'ops-tbl' }, el('thead', {}, el('tr', {}, ...['Appareil', 'Contrôle', 'Enregistrement', 'Battement', 'Émetteurs', 'Récepteurs', 'ID'].map((x) => el('th', {}, x)))), tb))),
    card('Connexions (récepteurs de la grille)', el('div', { class: 'tblwrap ops-scroll' }, el('table', { class: 'ops-tbl' }, el('thead', {}, el('tr', {}, ...['Récepteur', 'Émetteur', 'Mode', 'Réception'].map((x) => el('th', {}, x)))), ctb)))));
  let last = t;
  R.live = () => { const n = Math.floor(performance.now() / 1000); if (n === last) return; last = n; for (const c of box.querySelectorAll('[data-hb]')) { const id = /** @type {HTMLElement} */ (c).dataset.hb; if (FAB.res.reg[id]) c.textContent = `il y a ${(n + id.length) % 5} s`; } };
}
