// @ts-check
import { el } from '../util.js';
import { S, on } from '../state.js';
import { intercom } from './common.js';
import { explain } from './widgets.js';
import { q, qify, openLexique } from './term.js';
import { rich } from './rich.js';
import { FAULTS } from '../faults.js';
import { FIGS } from './term_figs.js';
import { LESSON_FIGS, VCOL } from './figs_ctrlnet.js';
import * as N from '../net/ctrlnet.js';

// ----------------------------------------------------------------------------------
// Réseau de contrôle Gigabit du car SDI : switchs, machines, adresses IP, masques, VLAN, QoS.
// Poste « Réseau » quand le car est en SDI (le car IP garde son poste ST 2110, ui/st_network.js).
// Six onglets : Topologie (switchs, ports, machines), Machines (tableau et fiche modifiable),
// Switchs (ports, VLAN, câbles, QoS), Plan d'adressage, Outils (ping, balayage, tables ARP et
// MAC, charge des liens) et Formation (les bases, simplement). Tout agit sur le modèle
// net/ctrlnet.js ; les autres postes lisent son état (ctrlFunc, ctrlCam, événement « ctrlnet »).
// ----------------------------------------------------------------------------------
N.addCtrlFaults(FAULTS);
const V = N.CN.view;
const TABS = [['topo', 'Topologie'], ['machines', 'Machines'], ['switchs', 'Switchs'], ['plan', 'Plan d\'adressage'], ['outils', 'Outils'], ['formation', 'Formation']];
const LVL = { ok: 'en état', warn: 'à vérifier', err: 'en défaut' };
const STATE_TXT = { ok: 'OK', degrade: 'dégradé', instable: 'instable', coupe: 'coupé' };
const name = (id) => (id === 'chaine' ? N.CHAINE.name : N.devById(id) ? N.devById(id).name : id);
const led = (lv, label = '') => el('i', { class: 'cn-led ' + lv, 'aria-hidden': 'true', title: label || null });
const vstyle = (v) => ({ borderLeftColor: VCOL[v] || VCOL[1] });
const fmtMb = (x) => (x >= 100 ? Math.round(x) : Math.round(x * 10) / 10).toString().replace('.', ',') + ' Mb/s';
/** @type {{ dev: string, f: Record<string, string> } | null} */
let DRAFT = null;
/** @type {any} */ let CUR = null;
/** @type {any} */ let FICHE_PING = null;

// l'opérateur concerné signale à l'intercom la fonction qu'il perd (ou qui revient)
on('ctrlnet', (e) => {
  if (S.ipMode || S.mode === 'start' || e.quiet) return;
  if (e.type === 'lost') intercom(e.who, e.msg, 'bad');
  else if (e.type === 'back') intercom(e.who, 'C\'est revenu, merci !', 'good');
});
on('ctrlnet', (e) => { if (CUR && (e.type === 'change' || e.type === 'go')) CUR.render(e.type === 'go'); });

/** @param {HTMLElement} body @param {any} arg machine à ouvrir (identifiant) @param {any} ctx */
export function buildCtrlNet(body, arg, ctx) {
  void ctx;
  const dbg = /** @type {any} */ (window).__dbg; if (dbg && !dbg.CTRL) dbg.CTRL = N; // tests de bout en bout
  const a = typeof arg === 'string' ? arg : arg && arg.dev;
  if (a && N.devById(a)) { V.tab = 'machines'; V.dev = a; }
  const head = el('div', { class: 'cn-head' });
  const alarms = el('div', { class: 'cn-alarms' });
  const tabs = el('div', { class: 'tabs cn-tabs' });
  const content = el('div', { class: 'cn-content' });
  body.append(head, alarms, tabs, content);
  for (const [k, l] of TABS) tabs.append(el('button', { class: 'tab', 'data-k': k, onclick: () => { N.ctrlGo({ tab: k }); } }, l));
  let lastKey = '';
  const R = {
    render(force = false) {
      const key = renderKey();
      if (!force && key === lastKey) return;
      const act = document.activeElement;
      if (!force && act && content.contains(act) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(act.tagName)) return; // on tape : on attend
      lastKey = key;
      drawHead(head); drawAlarms(alarms);
      for (const b of tabs.children) { const on = /** @type {HTMLElement} */ (b).dataset.k === V.tab; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
      const sc = content.scrollTop;
      content.replaceChildren();
      ({ topo: tabTopo, machines: tabMachines, switchs: tabSwitchs, plan: tabPlan, outils: tabOutils, formation: tabFormation })[V.tab](content);
      qify(content); qify(head);
      if (!force) content.scrollTop = sc;
    },
  };
  CUR = R;
  R.render(true);
  return { update() { R.render(false); }, close() { if (CUR === R) CUR = null; DRAFT = null; } };
}
function renderKey() {
  const p = N.CN.lastPing, s = N.CN.lastSweep;
  return [N.CN.ver, V.tab, V.dev, V.sw, V.filter, V.arpVlan, V.macSw, V.src, V.dst, p ? p.t : 0, s ? s.t : 0, FICHE_PING ? FICHE_PING.t : 0].join('|');
}

// ---------------- bandeau d'état ----------------
function drawHead(box) {
  const R = N.evaluate();
  const funcs = N.FUNCS.filter((f) => f.key !== 'wifi');
  const fbad = funcs.filter((f) => !R.funcs[f.key].ok);
  const ups = N.UPLINKS.map((u) => R.load[u.id]);
  const maxLoad = Math.max(...ups.map((L) => Math.max(L.up.demand, L.down.demand) / L.cap));
  const swUp = N.SWITCHES.filter((s) => N.swLinked('core', s.id, 10)).length;
  const item = (lv, label, value) => el('span', { class: 'cn-st' }, led(lv), el('b', {}, label), value);
  box.replaceChildren(
    el('span', { class: 'cn-title' }, 'Réseau de contrôle du car', q('ctrl-sdi')),
    item(swUp < 3 ? 'err' : 'ok', 'Switchs', `${swUp}/3`),
    item(R.err ? 'err' : R.warn ? 'warn' : 'ok', 'Machines', `${R.ok} en état${R.warn ? ` · ${R.warn} à vérifier` : ''}${R.err ? ` · ${R.err} en défaut` : ''}`),
    item(fbad.length ? (fbad.some((f) => R.funcs[f.key].state !== 'degrade') ? 'err' : 'warn') : 'ok', 'Fonctions du car', `${funcs.length - fbad.length}/${funcs.length}`),
    item(maxLoad > 1 ? 'err' : maxLoad > 0.8 ? 'warn' : 'ok', 'Liens montants', `${Math.round(Math.min(maxLoad, 1) * 100)} %`),
    el('button', { class: 'cn-lex', type: 'button', title: 'Toutes les fiches des boutons « ? »', onclick: (e) => openLexique(/** @type {HTMLElement} */ (e.currentTarget)) }, el('b', {}, '?'), 'Lexique'));
}
// fonctions du car en défaut : ce que les opérateurs perdent
function drawAlarms(box) {
  const R = N.evaluate();
  const bad = N.FUNCS.filter((f) => !R.funcs[f.key].ok);
  box.replaceChildren();
  if (!bad.length) return;
  box.append(el('div', { class: 'cn-alarm-h' }, `${bad.length} fonction${bad.length > 1 ? 's' : ''} du car touchée${bad.length > 1 ? 's' : ''}`));
  for (const f of bad.slice(0, 4)) {
    const s = R.funcs[f.key];
    box.append(el('div', { class: 'cn-alarm ' + (s.state === 'degrade' ? 'warn' : 'err') }, led(s.state === 'degrade' ? 'warn' : 'err'),
      el('span', { class: 'grow' }, el('b', {}, `${f.who} · ${f.label}`), ` — ${STATE_TXT[s.state]}`),
      el('button', { class: 'btn small', onclick: () => N.ctrlGo({ tab: 'machines', dev: f.a }) }, 'Voir la machine')));
  }
  if (bad.length > 4) box.append(el('div', { class: 'note' }, `et ${bad.length - 4} autre${bad.length > 5 ? 's' : ''}…`));
}

// ---------------- face avant d'un switch (ports, voyants, couleur du VLAN) ----------------
const NSV = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NSV, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); for (const c of kids) if (c != null) e.append(c); return e; };
function portLevel(sw, n) {
  const p = N.portOf(sw, n), u = N.portUse(sw, n);
  if (!u) return 'off';
  if (!p.cable || !p.enabled) return u.dev || u.uplink ? 'err' : 'off';
  if (u.dev) return N.devState(u.dev).level;
  return 'ok';
}
function faceplate(sw, big = false) {
  const S2 = N.swById(sw); const rj = S2.ports - S2.sfp;
  const cols = rj / 2, W = 16 + cols * 22 + 18 + S2.sfp * 26 + 10, H = 66;
  const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cn-face' + (big ? ' big' : ''), role: 'img', 'aria-label': `Face avant de ${S2.name} : ${S2.ports} ports, couleur du VLAN de chaque port, voyant allumé quand le lien est monté` });
  svg.append(sv('rect', { x: 0, y: 0, width: W, height: H, rx: 4, class: 'cn-face-bg' }), sv('text', { x: 8, y: 11, class: 'cn-face-t' }, S2.name));
  const port = (n, x, y, w) => {
    const p = N.portOf(sw, n), u = N.portUse(sw, n), lv = portLevel(sw, n);
    const fill = !u ? '#20262b' : p.mode === 'trunk' ? '#8ccdf2' : VCOL[p.vlan] || VCOL[1];
    const g = sv('g', { class: 'cn-port' + (V.sw === sw && V.dev && u && u.dev === V.dev ? ' sel' : ''), 'data-port': `${sw}:${n}` },
      sv('title', {}, `Port ${n}${u ? ' · ' + (u.dev ? name(u.dev) : 'lien montant vers ' + N.swById(u.peer.sw).name) : ' · libre'} · ${p.mode === 'trunk' ? 'trunk ' + p.allowed.join(',') : 'VLAN ' + p.vlan}${u ? (p.cable ? (p.enabled ? ' · lien 1 Gb/s' : ' · désactivé') : ' · câble débranché') : ''}`),
      sv('rect', { x, y, width: w, height: 16, rx: 2, fill, opacity: u && p.cable ? 1 : 0.35 }),
      sv('rect', { x: x + 3, y: y + 4, width: w - 6, height: 8, rx: 1, fill: '#0b0e11' }),
      sv('circle', { cx: x + w / 2, cy: y + (y < 30 ? -4 : 21), r: 2.4, class: 'cn-pled ' + lv }),
      sv('text', { x: x + w / 2, y: y + (y < 30 ? -8 : 31), class: 'cn-pn' }, String(n)));
    g.addEventListener('click', () => N.ctrlGo({ tab: 'switchs', sw, dev: u && u.dev ? u.dev : V.dev }));
    return g;
  };
  for (let n = 1; n <= rj; n++) { const c = Math.floor((n - 1) / 2), top = n % 2 === 1; svg.append(port(n, 12 + c * 22, top ? 24 : 42, 18)); }
  for (let k = 0; k < S2.sfp; k++) svg.append(port(rj + 1 + k, 16 + cols * 22 + 14 + k * 26, 32, 22));
  return svg;
}
function chip(id) {
  const d = N.devById(id), st = N.devState(id), at = N.attachPort(id), v = N.vlanOfDev(id);
  const where = d.wifi ? 'Wi-Fi' : at ? `port ${at.n}` : 'admin.';
  return el('button', { class: 'cn-chip' + (V.dev === id ? ' on' : ''), type: 'button', 'data-dev': id, style: vstyle(v), 'aria-label': `${d.name}, ${where}, VLAN ${v}, ${LVL[st.level]}`, onclick: () => N.ctrlGo({ tab: 'machines', dev: id }) },
    led(st.level), el('span', { class: 'cn-chip-n' }, d.name), el('small', {}, `${where} · ${N.ipOf(id) || '—'}`));
}

// ---------------- onglet Topologie ----------------
function tabTopo(box) {
  const R = N.evaluate();
  const card = (sw) => {
    const S2 = N.swById(sw);
    const devs = N.DEVS.filter((d) => d.kind !== 'switch' && N.swOf(d.id) === sw).sort((x, y) => (N.attachPort(x.id) ? N.attachPort(x.id).n : 0) - (N.attachPort(y.id) ? N.attachPort(y.id).n : 0) || (x.wifi ? 1 : 0) - (y.wifi ? 1 : 0));
    return el('section', { class: 'cn-swcard', 'data-sw': sw },
      el('header', {}, led(N.devState(S2.mgmt).level), el('h3', {}, S2.name), el('span', { class: 'cn-sub' }, `${S2.l3 ? 'niveau 3 · ' : ''}${S2.poe ? 'PoE · ' : ''}${N.ipOf(S2.mgmt)} · ${S2.where}`)),
      el('div', { class: 'cn-facewrap' }, faceplate(sw)),
      el('div', { class: 'cn-chips' }, ...devs.map((d) => chip(d.id))));
  };
  const up = (u) => {
    const L = R.load[u.id], pa = N.portOf(u.a.sw, u.a.n), pb = N.portOf(u.b.sw, u.b.n);
    const ok = pa.cable && pb.cable && pa.enabled && pb.enabled;
    const load = Math.max(L.up.demand, L.down.demand) / L.cap;
    const lv = !ok ? 'err' : load > 1 ? 'err' : load > 0.8 ? 'warn' : 'ok';
    return el('button', { class: 'cn-up ' + lv, type: 'button', onclick: () => N.ctrlGo({ tab: 'switchs', sw: u.b.sw }) }, led(lv),
      el('b', {}, u.label), el('span', {}, ok ? `trunk 802.1Q · 1 Gb/s · ${Math.round(Math.min(load, 1) * 100)} %${load > 1 ? ' (saturé)' : ''}` : 'lien coupé'));
  };
  box.append(
    el('p', { class: 'cn-intro' }, 'Les images passent par la grille SDI ; ce réseau transporte tout ce qui se pilote. Chaque pastille est une machine (couleur : son VLAN ; voyant : son état). Un clic ouvre sa fiche, un clic sur un port ouvre le switch.'),
    card('core'),
    el('div', { class: 'cn-uplinks' }, ...N.UPLINKS.map(up)),
    el('div', { class: 'cn-row' }, card('prod'), card('vision')),
    legend());
}
function legend() {
  return el('div', { class: 'cn-legend', 'aria-label': 'Couleurs des VLAN' },
    ...N.VLANS.map((v) => el('span', {}, el('i', { style: { background: VCOL[v.id] } }), `VLAN ${v.id} · ${v.name}`)),
    el('span', {}, el('i', { style: { background: '#8ccdf2' } }), 'trunk (plusieurs VLAN)'),
    el('span', {}, led('ok'), 'en état'), el('span', {}, led('warn'), 'à vérifier'), el('span', {}, led('err'), 'en défaut'));
}

// ---------------- onglet Machines ----------------
function tabMachines(box) {
  const R = N.evaluate();
  const seg = el('div', { class: 'seg cn-filter', role: 'group', 'aria-label': 'Filtrer les machines' },
    ...[['all', 'Toutes'], ['err', 'En défaut'], ['warn', 'À vérifier']].map(([k, l]) => el('button', { type: 'button', 'aria-pressed': String(V.filter === k), onclick: () => N.ctrlGo({ filter: k }) }, l + (k === 'all' ? '' : ` (${k === 'err' ? R.err : R.warn})`))));
  const list = N.DEVS.filter((d) => V.filter === 'all' || N.devState(d.id).level === V.filter);
  const tb = el('tbody');
  for (const d of list) {
    const c = N.CN.m[d.id], st = N.devState(d.id), at = N.attachPort(d.id), v = N.vlanOfDev(d.id);
    tb.append(el('tr', { class: 'cn-mrow' + (V.dev === d.id ? ' on' : ''), 'data-dev': d.id },
      el('td', {}, led(st.level), el('span', { class: 'sr' }, LVL[st.level])),
      el('td', { style: vstyle(v), class: 'cn-vcell' }, el('button', { class: 'cn-link', type: 'button', onclick: () => N.ctrlGo({ dev: d.id }) }, d.name)),
      el('td', {}, d.wifi ? `Wi-Fi (${name(d.wifi)})` : at ? `${N.swById(at.sw).name} · ${at.n}` : N.swById(c.sw).name),
      el('td', {}, String(v)),
      el('td', { class: 'mono' }, d.ifaces ? d.ifaces.map((f) => f.ip).join(' · ') : (c.dhcp ? 'DHCP · ' : '') + (N.ipOf(d.id) || '—')),
      el('td', { class: 'mono' }, d.ifaces ? '/24' : '/' + (c.dhcp ? N.leaseOf(d.id).prefix : c.prefix)),
      el('td', { class: 'mono' }, d.ifaces ? '—' : (c.dhcp ? N.leaseOf(d.id).gw : c.gw) || '—'),
      el('td', {}, N.QOS[c.qos] ? N.QOS[c.qos].name : c.qos)));
  }
  const table = el('div', { class: 'tblwrap cn-mwrap' }, el('table', { class: 'tbl cn-mtbl' },
    el('thead', {}, el('tr', {}, el('th', {}, el('span', { class: 'sr' }, 'État')), el('th', {}, 'Machine'), el('th', {}, 'Branchée sur'), el('th', { 'data-qterm': 'vlan' }, 'VLAN'),
      el('th', { 'data-qterm': 'sous-reseau' }, 'Adresse IP'), el('th', { 'data-qterm': 'sous-reseau' }, 'Masque'), el('th', { 'data-qterm': 'passerelle' }, 'Passerelle'), el('th', { 'data-qterm': 'cos' }, 'Classe QoS'))),
    tb));
  if (!list.length) table.append(el('p', { class: 'note' }, 'Aucune machine dans ce cas.'));
  box.append(el('div', { class: 'cn-split' }, el('div', { class: 'cn-left' }, el('div', { class: 'hwrow' }, seg), table), fiche(V.dev)));
}

// fiche d'une machine : réglages modifiables, explication de chaque champ, diagnostic, tests
function fiche(id) {
  const d = N.devById(id); if (!d) return el('div', { class: 'hwpanel cn-fiche' }, el('p', { class: 'note' }, 'Choisissez une machine dans le tableau.'));
  const c = N.CN.m[id], st = N.devState(id), at = N.attachPort(id), port = at ? N.portOf(at.sw, at.n) : null;
  const panel = el('aside', { class: 'hwpanel cn-fiche', 'aria-label': 'Fiche de ' + d.name });
  panel.append(el('header', { class: 'cn-fh' }, led(st.level), el('h3', {}, d.name), el('span', { class: 'cn-badge ' + st.level }, LVL[st.level])),
    el('p', { class: 'cn-role' }, d.role),
    el('dl', { class: 'kv cn-kv' },
      el('dt', {}, 'Emplacement'), el('dd', {}, d.zone),
      el('dt', { 'data-qterm': 'mac' }, 'Adresse MAC'), el('dd', {}, N.macOf(id)),
      el('dt', { 'data-qterm': 'rj45' }, 'Raccordement'), el('dd', {}, d.wifi ? `Wi-Fi, par ${name(d.wifi)}` : at ? `${N.swById(at.sw).name}, port ${at.n} · ${port.cable ? (port.enabled ? 'lien 1 Gb/s' : 'port désactivé') : 'câble débranché'}${d.poe ? ' · alimentée par le câble (PoE)' : ''}` : 'processeur du switch')));
  if (d.ro) {
    panel.append(el('p', { class: 'note' }, d.ifaces ? `Interfaces : ${d.ifaces.map((f) => `${f.ip}/24 dans le VLAN ${f.vlan}`).join(' ; ')}. Réglé par l'ingénieur réseau du prestataire : non modifiable ici.` : `Adresse d'administration ${c.ip}/24 dans le VLAN 10${id === 'core' ? ' ; il porte aussi la passerelle .1 de chaque VLAN (onglet Switchs)' : ''}. Non modifiable ici.`));
  } else panel.append(form(d, c, port, at));
  // diagnostic
  const iss = st.issues;
  panel.append(el('h4', {}, 'Diagnostic'), iss.length ? el('ul', { class: 'cn-issues' }, ...iss.map((i) => el('li', { class: i.sev }, led(i.sev), el('span', {}, i.text)))) : el('p', { class: 'cn-okline' }, led('ok'), 'Réglages conformes au plan, toutes ses liaisons répondent.'));
  // fonctions du car et tests
  const fs = N.funcsOf(id);
  const peers = [...fs.map((f) => (f.a === id ? f.b : f.a))];
  const gw = c.dhcp ? N.leaseOf(id).gw : c.gw;
  const tests = el('div', { class: 'hwrow cn-tests' },
    ...peers.map((p) => el('button', { class: 'btn small cn-fping', 'data-dst': p, onclick: () => fichePing(id, p) }, `Ping vers ${name(p)}`)),
    gw && !d.ifaces ? el('button', { class: 'btn small cn-fping', 'data-dst': 'gw', onclick: () => fichePing(id, gw) }, `Ping vers la passerelle (${gw})`) : null,
    id !== 'supv' && d.vlan !== 90 ? el('button', { class: 'btn small cn-fping', 'data-dst': 'supv', onclick: () => fichePing('supv', id) }, 'Ping depuis la supervision') : null);
  if (fs.length) panel.append(el('h4', {}, 'Ce qu\'elle fait dans le car'), el('ul', { class: 'cn-funcs' }, ...fs.map((f) => { const s = N.evaluate().funcs[f.key]; return el('li', {}, led(s.ok ? 'ok' : s.state === 'degrade' ? 'warn' : 'err'), el('span', {}, `${f.label} : ${STATE_TXT[s.state]}`)); })));
  panel.append(el('h4', { 'data-qterm': 'ping' }, 'Tester'), tests);
  if (FICHE_PING && (FICHE_PING.a === id || FICHE_PING.b === id)) panel.append(pingBox(FICHE_PING));
  return panel;
}
function fichePing(a, b) {
  const r = N.doPing(a, b); FICHE_PING = { ...r, t: Date.now() };
  explain(N.explainPing(r), r.ok ? 'ok:cnping' : 'warn:cnping');
  if (CUR) CUR.render(true);
}
const FIELD_HELP = {
  mode: 'Adresse fixe : vous saisissez l\'adresse notée au plan. DHCP : la machine demande son adresse à un serveur ; dans ce car, seul le VLAN des invités (90) en a un.',
  ip: 'Quatre nombres de 0 à 255. Plan du car : 10.1.<VLAN>.<machine> ; la .1 est réservée à la passerelle.',
  mask: 'Il dit quelle partie de l\'adresse désigne le réseau : 255.255.255.0 (ou /24) = les trois premiers nombres. Toutes les machines d\'un VLAN ont le même.',
  gw: 'L\'adresse à qui la machine confie ce qui sort de son sous-réseau : la .1 de son VLAN (interface du SW-CŒUR). Une passerelle fausse coupe la supervision, pas le VLAN.',
  vlan: 'Le VLAN ne se règle pas dans la machine : c\'est celui du port du switch où elle est branchée (port access).',
  qos: 'La priorité de ses paquets quand un lien est plein : la voix (intercom) d\'abord, les fichiers en dernier.',
};
function form(d, c, port, at) {
  const id = d.id;
  if (!DRAFT || DRAFT.dev !== id) DRAFT = { dev: id, f: { mode: c.dhcp ? 'dhcp' : 'fixe', ip: c.ip, mask: N.maskStr(c.prefix), gw: c.gw, vlan: String(port ? port.vlan : d.vlan), qos: c.qos } };
  const F = DRAFT.f;
  const msgs = {};
  const fld = (k, label, input, term) => {
    msgs[k] = el('div', { class: 'cn-msg', 'aria-live': 'polite' });
    input.setAttribute('data-f', k);
    const iid = `cn-${k}-${id}`; input.id = iid;
    return el('div', { class: 'field cn-field', 'data-field': k }, el('label', { for: iid, 'data-qterm': term }, label), input, el('div', { class: 'cn-help' }, FIELD_HELP[k] + (k === 'vlan' && at ? (d.wifi ? ` En Wi-Fi : celui du port du point d'accès (${N.swById(at.sw).name}, port ${at.n}).` : ` Ici : ${N.swById(at.sw).name}, port ${at.n}.`) : '')), msgs[k]);
  };
  const inp = (k) => { const i = /** @type {HTMLInputElement} */ (el('input', { type: 'text', value: F[k] || '', spellcheck: 'false', autocomplete: 'off' })); i.addEventListener('input', () => { F[k] = i.value; live(); }); return i; };
  const sel = (k, opts) => { const s = /** @type {HTMLSelectElement} */ (el('select', {}, ...opts.map(([v, l]) => el('option', { value: v, selected: String(F[k]) === String(v) }, l)))); s.addEventListener('change', () => { F[k] = s.value; live(); syncMode(); }); return s; };
  const ipI = inp('ip'), maskI = inp('mask'), gwI = inp('gw');
  const vlanOpts0 = [['1', 'VLAN 1 (par défaut, inutilisé)'], ...N.VLANS.map((v) => [String(v.id), `VLAN ${v.id} · ${v.name}`])];
  if (!vlanOpts0.some(([v]) => v === F.vlan)) vlanOpts0.push([F.vlan, `VLAN ${F.vlan} (hors plan)`]);
  const vlanSel = sel('vlan', vlanOpts0);
  // en Wi-Fi, le VLAN est celui du port du point d'accès : il ne se règle pas depuis la machine
  if (d.wifi) vlanSel.disabled = true;
  const fields = el('div', { class: 'cn-form', 'data-dev': id },
    fld('mode', 'Mode d\'adressage', sel('mode', [['fixe', 'Adresse fixe'], ['dhcp', 'DHCP (automatique)']]), 'dhcp'),
    fld('ip', 'Adresse IP', ipI, 'sous-reseau'), fld('mask', 'Masque de sous-réseau', maskI, 'sous-reseau'), fld('gw', 'Passerelle', gwI, 'passerelle'),
    fld('vlan', 'VLAN (port du switch)', vlanSel, 'vlan'),
    fld('qos', 'Classe QoS', sel('qos', N.QOS_ORDER.map((k) => [k, `${N.QOS[k].name} · CoS ${N.QOS[k].cos} · DSCP ${N.QOS[k].dscp}`])), 'cos'));
  const result = el('div', { class: 'cn-result', 'aria-live': 'polite' });
  const syncMode = () => { const dh = F.mode === 'dhcp'; for (const i of [ipI, maskI, gwI]) i.disabled = dh; };
  syncMode();
  const live = () => {
    const m = liveMsgs(d, F);
    for (const k in msgs) { const x = m[k]; msgs[k].className = 'cn-msg' + (x ? ' ' + x[0] : ''); msgs[k].textContent = x ? x[1] : ''; }
  };
  live();
  const apply = () => {
    const dh = F.mode === 'dhcp';
    const err = N.checkFields({ ip: F.ip, mask: F.mask, gw: F.gw }, dh);
    if (Object.keys(err).length) { result.className = 'cn-result err'; result.textContent = 'Réglage refusé : ' + Object.values(err).join(' '); return; }
    const before = N.devState(id).level;
    const cfg = dh ? { dhcp: true, qos: F.qos } : { dhcp: false, ip: F.ip.trim(), prefix: N.parseMask(F.mask), gw: (F.gw || '').trim(), qos: F.qos };
    N.setDevice(id, cfg);
    if (at && !d.wifi && +F.vlan !== N.portOf(at.sw, at.n).vlan) N.setDeviceVlan(id, +F.vlan);
    DRAFT = null;
    const st = N.devState(id);
    explain(`${d.name} : ${dh ? 'en DHCP' : `${F.ip.trim()} / ${N.parseMask(F.mask)}, passerelle ${(F.gw || '').trim() || 'aucune'}`}, VLAN ${N.vlanOfDev(id)}, classe ${N.QOS[F.qos].name}. ${st.level === 'ok' ? 'Tout répond : réglages conformes au plan.' : st.issues[0].text}${before !== st.level && st.level === 'ok' ? ' La machine est revenue.' : ''}`, st.level === 'ok' ? 'ok:cnfiche' : 'warn:cnfiche');
    if (CUR) CUR.render(true);
  };
  const btns = el('div', { class: 'hwrow cn-btns' },
    el('button', { class: 'btn primary cn-apply', type: 'button', onclick: apply }, 'Appliquer'),
    el('button', { class: 'btn cn-cancel', type: 'button', onclick: () => { DRAFT = null; if (CUR) CUR.render(true); } }, 'Annuler'),
    el('button', { class: 'btn cn-planbtn', type: 'button', title: 'Reprendre l\'adresse, le masque, la passerelle, le VLAN et la classe du plan d\'adressage', onclick: () => { const p = N.planOf(id); DRAFT = { dev: id, f: { mode: p.dhcp ? 'dhcp' : 'fixe', ip: p.ip, mask: N.maskStr(p.prefix), gw: p.gw, vlan: String(d.vlan), qos: p.qos } }; if (CUR) CUR.render(true); } }, 'Valeurs du plan'));
  return el('div', {}, el('h4', {}, 'Réglages'), fields, btns, result);
}
/** messages de saisie en direct : [niveau, texte] par champ */
function liveMsgs(d, F) {
  const m = {}; const dh = F.mode === 'dhcp';
  const v = +F.vlan;
  if (dh) {
    m.mode = vlanHasDhcp(v) ? ['ok', 'Le routeur prêtera une adresse dans le VLAN ' + v + '.'] : ['warn', `Aucun serveur DHCP dans le VLAN ${v} : la machine prendra une adresse 169.254.x.x et ne joindra personne.`];
  } else if (d.dhcp) m.mode = ['warn', 'Le plan prévoit le DHCP pour cette machine.'];
  if (!dh) {
    const e = N.checkFields({ ip: F.ip, mask: F.mask, gw: F.gw });
    const ip = N.parseIp(F.ip), p = N.parseMask(F.mask);
    if (e.ip) m.ip = ['err', e.ip];
    else if (ip != null) {
      const other = N.DEVS.find((x) => x.id !== d.id && x.id !== 'core' && N.ipOf(x.id) === F.ip.trim() && N.vlanOfDev(x.id) === v);
      const svi = N.VLANS.some((x) => x.gw === F.ip.trim());
      const own = N.VLANS.find((x) => N.sameNet(ip, N.parseIp(`${N.BASE}.${x.id}.0`), 24));
      if (other || svi) m.ip = ['err', `Attention : ${F.ip.trim()} est déjà l'adresse de ${other ? other.name : 'la passerelle du VLAN'} (conflit d'adresse IP).`];
      else if (own && own.id !== v) m.ip = ['warn', `Cette adresse est celle du VLAN ${own.id} (${own.name}), mais le port est dans le VLAN ${v}.`];
      else if (own) m.ip = ['ok', `Dans le sous-réseau ${N.vlanNet(own.id)} (VLAN ${own.id} · ${own.name}).`];
      else m.ip = ['warn', 'Adresse hors du plan du car (10.1.<VLAN>.<machine>).'];
    }
    if (e.mask) m.mask = ['err', e.mask];
    else if (p != null) m.mask = p === 24 ? ['ok', '/24 : 256 adresses, dont 254 pour les machines. C\'est le masque du plan.'] : ['warn', `/${p} : ${2 ** (32 - p)} adresses. Le plan du car utilise /24 (255.255.255.0) : avec un autre masque, la machine se trompe sur qui est « chez elle ».`];
    if (e.gw) m.gw = ['err', e.gw];
    else if (!F.gw || !F.gw.trim()) m.gw = ['warn', 'Sans passerelle, la machine ne sort pas de son sous-réseau (ni supervision, ni heure, ni Internet).'];
    else if (ip != null && p != null && !N.sameNet(N.parseIp(F.gw), ip, p)) m.gw = ['err', 'Hors du sous-réseau de la machine : elle ne pourra pas la joindre.'];
    else if (N.vlanById(v) && F.gw.trim() === N.vlanById(v).gw) m.gw = ['ok', `La .1 du VLAN ${v} : correct.`];
    else m.gw = ['warn', `Le plan donne ${N.vlanById(v) ? N.vlanById(v).gw : 'la .1 du VLAN'} comme passerelle.`];
  }
  m.vlan = v === d.vlan ? ['ok', `VLAN ${v} : celui du plan pour cette machine.`] : ['warn', `Le plan range cette machine dans le VLAN ${d.vlan} (${N.vlanById(d.vlan) ? N.vlanById(d.vlan).name : ''}).`];
  m.qos = F.qos === d.qos ? ['ok', N.QOS[F.qos].what] : ['warn', `Le plan donne « ${N.QOS[d.qos].name} » à cette machine. ${N.QOS[F.qos].what}`];
  return m;
}
const vlanHasDhcp = (v) => !!(N.vlanById(v) && N.vlanById(v).dhcp);

// ---------------- onglet Switchs ----------------
function tabSwitchs(box) {
  const S2 = N.swById(V.sw) || N.SWITCHES[0];
  const seg = el('div', { class: 'seg cn-swseg', role: 'group', 'aria-label': 'Switch affiché' }, ...N.SWITCHES.map((s) => el('button', { type: 'button', 'data-sw': s.id, 'aria-pressed': String(s.id === S2.id), onclick: () => N.ctrlGo({ sw: s.id }) }, s.name)));
  const qosOn = N.CN.sw[S2.id].qos;
  const head = el('div', { class: 'hwpanel cn-swhead' },
    el('div', { class: 'hwrow' }, el('h3', {}, S2.name), el('span', { class: 'cn-sub' }, `${S2.model} · ${S2.where} · administration ${N.ipOf(S2.mgmt)}`)),
    el('div', { class: 'cn-facewrap big' }, faceplate(S2.id, true)),
    el('div', { class: 'hwrow' }, el('span', { class: 'cn-qlab', 'data-qterm': 'cos' }, 'QoS du switch'),
      el('button', { class: 'btn small toggle cn-qostoggle', type: 'button', 'aria-pressed': String(qosOn), onclick: () => { N.setSwitchQos(S2.id, !qosOn); explain(!qosOn ? `${S2.name} : QoS activée. Le switch lit la CoS et le DSCP de chaque paquet et sert d'abord la voix, puis la commande, la gestion, les données et enfin les fichiers.` : `${S2.name} : QoS désactivée. Une seule file d'attente : quand un lien sature, l'intercom et les commandes attendent derrière les fichiers.`, 'cn:qos'); } }, qosOn ? 'Activée (files prioritaires)' : 'Désactivée (une seule file)')));
  // ports
  const tb = el('tbody');
  const free = [];
  for (let n = 1; n <= S2.ports; n++) {
    const p = N.portOf(S2.id, n), u = N.portUse(S2.id, n);
    if (!u && !p.cable && p.mode === 'access' && p.vlan === 1) { free.push(n); continue; }
    tb.append(portRow(S2.id, n, p, u));
  }
  const table = el('div', { class: 'tblwrap' }, el('table', { class: 'tbl cn-ptbl' },
    el('thead', {}, el('tr', {}, el('th', {}, 'Port'), el('th', {}, 'Branché sur'), el('th', { 'data-qterm': 'trunk' }, 'Mode du port'), el('th', { 'data-qterm': 'vlan' }, 'VLAN'), el('th', { 'data-qterm': 'rj45' }, 'Câble et lien'), el('th', { 'data-qterm': 'charge' }, 'Charge'), el('th', {}, el('span', { class: 'sr' }, 'Actions')))), tb));
  box.append(el('div', { class: 'hwrow' }, seg), head,
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Ports'), table, free.length ? el('p', { class: 'note' }, `Ports libres (rien de branché, VLAN 1 par défaut) : ${ranges(free)}.`) : null));
  if (S2.l3) box.append(sviPanel());
  box.append(qosPanel());
}
function portRow(sw, n, p, u) {
  const d = u && u.dev ? N.devById(u.dev) : null;
  const lv = portLevel(sw, n);
  const mode = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': `Mode du port ${n}`, 'data-f': 'mode' }, el('option', { value: 'access', selected: p.mode === 'access' }, 'access'), el('option', { value: 'trunk', selected: p.mode === 'trunk' }, 'trunk')));
  mode.addEventListener('change', () => { N.setPort(sw, n, { mode: /** @type {any} */ (mode.value), allowed: mode.value === 'trunk' ? (p.allowed.length ? p.allowed : [p.vlan]) : p.allowed }); explain(`Port ${n} de ${N.swById(sw).name} en ${mode.value} : ${mode.value === 'trunk' ? 'il transporte plusieurs VLAN, chaque trame étiquetée (802.1Q). On le réserve aux liens entre switchs et vers un routeur.' : 'un seul VLAN, sans étiquette : c\'est le mode des ports où l\'on branche une machine.'}`, 'cn:port'); });
  let vlanCtl;
  if (p.mode === 'trunk') {
    const i = /** @type {HTMLInputElement} */ (el('input', { type: 'text', value: p.allowed.join(','), 'aria-label': `VLAN autorisés sur le port ${n}`, 'data-f': 'allowed', size: '14', spellcheck: 'false' }));
    i.addEventListener('change', () => { const list = i.value.split(/[ ,;]+/).map(Number).filter((x) => x >= 1 && x <= 4094); N.setPort(sw, n, { allowed: list }); explain(`Port ${n} : VLAN autorisés ${list.join(', ') || 'aucun'}. Un VLAN absent de la liste ne passe plus par ce trunk : ses machines de l'autre côté sont coupées.`, 'cn:port'); });
    vlanCtl = el('span', { class: 'cn-allowed' }, 'autorisés ', i);
  } else {
    const s = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': `VLAN du port ${n}`, 'data-f': 'vlan' }, ...[1, ...N.VLANS.map((v) => v.id)].map((v) => el('option', { value: v, selected: v === p.vlan }, `${v}${N.vlanById(v) ? ' · ' + N.vlanById(v).name : ' · défaut'}`))));
    s.addEventListener('change', () => { N.setPort(sw, n, { vlan: +s.value }); const st = d ? N.devState(d.id) : null; explain(`Port ${n} de ${N.swById(sw).name} dans le VLAN ${s.value}${d ? ` : ${d.name} change de réseau virtuel. ${st.level === 'err' ? st.issues[0].text : 'Son adresse correspond : tout répond.'}` : '.'}`, st && st.level === 'err' ? 'warn:port' : 'ok:port'); });
    vlanCtl = s;
  }
  const cable = el('button', { class: 'btn small cn-cable', type: 'button', onclick: () => { N.setPort(sw, n, { cable: !p.cable }); explain(p.cable ? `Câble du port ${n} débranché : voyant éteint, ${d ? d.name + ' disparaît du réseau' + (d.poe ? ' (et s\'éteint : elle était alimentée par le câble)' : '') : 'le lien montant tombe : tout le switch d\'accès est coupé du cœur'}.` : `Câble du port ${n} rebranché : le lien remonte en 1 Gb/s (auto-négociation), le voyant se rallume.`, 'cn:cable'); } }, p.cable ? 'Débrancher' : 'Rebrancher');
  const shut = el('button', { class: 'btn small cn-shut', type: 'button', onclick: () => { N.setPort(sw, n, { enabled: !p.enabled }); explain(p.enabled ? `Port ${n} désactivé (shutdown) : même câble branché, plus rien ne passe.` : `Port ${n} réactivé (no shutdown).`, 'cn:shut'); } }, p.enabled ? 'Désactiver' : 'Activer');
  const linkTxt = !p.cable ? 'câble débranché' : !p.enabled ? 'port désactivé' : '1 Gb/s';
  return el('tr', { class: 'cn-prow' + (d && V.dev === d.id ? ' on' : ''), 'data-port': `${sw}:${n}` },
    el('td', {}, String(n), n > N.swById(sw).ports - N.swById(sw).sfp ? el('small', {}, ' SFP') : null),
    el('td', {}, d ? el('button', { class: 'cn-link', type: 'button', onclick: () => N.ctrlGo({ tab: 'machines', dev: d.id }) }, d.name) : u && u.uplink ? `lien montant ↔ ${N.swById(u.peer.sw).name} (port ${u.peer.n})` : el('span', { class: 'note' }, 'rien de branché')),
    el('td', {}, mode), el('td', {}, vlanCtl),
    el('td', {}, led(lv), ' ', linkTxt),
    el('td', { class: 'mono' }, fmtMb(N.portLoad(sw, n))),
    el('td', {}, el('div', { class: 'hwrow' }, cable, shut)));
}
const ranges = (l) => { const out = []; let a = l[0], b = l[0]; for (const x of [...l.slice(1), NaN]) { if (x === b + 1) { b = x; continue; } out.push(a === b ? String(a) : `${a} à ${b}`); a = b = x; } return out.join(', '); };
function sviPanel() {
  return el('div', { class: 'hwpanel' }, el('h3', { 'data-qterm': 'svi' }, 'Interfaces VLAN du cœur (passerelles)'),
    el('p', { class: 'note' }, 'Le SW-CŒUR est un switch de niveau 3 : il a une adresse dans chaque VLAN, la .1, qui sert de passerelle aux machines de ce VLAN. Il route entre ces VLAN et envoie le reste au routeur (route par défaut 10.1.10.254). Le VLAN 90 des invités n\'en a pas : il ne sort que par le routeur.'),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th', {}, 'Interface'), el('th', {}, 'Adresse (passerelle)'), el('th', {}, 'Sous-réseau'))),
      el('tbody', {}, ...N.VLANS.filter((v) => v.gwOn === 'core').map((v) => el('tr', {}, el('td', {}, `Vlan${v.id} · ${v.name}`), el('td', { class: 'mono' }, v.gw), el('td', { class: 'mono' }, N.vlanNet(v.id))))))));
}
function qosPanel() {
  return el('div', { class: 'hwpanel' }, el('h3', { 'data-qterm': 'cos' }, 'Classes de QoS du car'),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th', {}, 'File'), el('th', {}, 'Classe'), el('th', { 'data-qterm': 'cos' }, 'CoS (802.1p)'), el('th', { 'data-qterm': 'qos' }, 'DSCP'), el('th', {}, 'Pour quoi'))),
      el('tbody', {}, ...N.QOS_ORDER.map((k, i) => { const Q = N.QOS[k]; return el('tr', {}, el('td', {}, String(i + 1)), el('td', {}, Q.name), el('td', { class: 'mono' }, String(Q.cos)), el('td', { class: 'mono' }, `${Q.dscp} (${Q.phb})`), el('td', {}, Q.what)); })))),
    el('p', { class: 'note' }, 'File 1 = servie en premier. Attention : la CoS 1 passe après la CoS 0. Les valeurs DSCP suivent les classes de service de la RFC 4594.'));
}

// ---------------- onglet Plan d'adressage ----------------
function tabPlan(box) {
  const count = (v) => N.DEVS.filter((d) => d.vlan === v || (d.ifaces && d.ifaces.some((f) => f.vlan === v))).length;
  box.append(
    el('div', { class: 'hwpanel prose cn-rules' }, el('h3', { 'data-qterm': 'sous-reseau' }, 'La règle du car'),
      rich('Toutes les adresses suivent le même modèle : **10.1.<VLAN>.<machine>**, avec le masque **255.255.255.0 (/24)**.\n- **10.1** : le réseau de contrôle de ce car ;\n- le **troisième nombre** est le numéro du VLAN : 10.1.20.33 est dans le VLAN 20 (caméras) ;\n- le **dernier** désigne la machine : **.1** la passerelle (le SW-CŒUR), **.2 à .9** les switchs et l\'infrastructure, **.10 à .99** les machines en adresse fixe, **.100 à .199** les adresses prêtées par DHCP (invités), **.254** le routeur.\n\nAinsi, en lisant une adresse, on sait tout de suite dans quel VLAN doit être la machine et quelle est sa passerelle.', 'cn-rich')),
    el('div', { class: 'hwpanel' }, el('h3', { 'data-qterm': 'vlan' }, 'VLAN et sous-réseaux'),
      el('div', { class: 'tblwrap' }, el('table', { class: 'tbl cn-vtbl' },
        el('thead', {}, el('tr', {}, el('th', {}, 'VLAN'), el('th', {}, 'Usage'), el('th', { 'data-qterm': 'sous-reseau' }, 'Sous-réseau'), el('th', { 'data-qterm': 'sous-reseau' }, 'Masque'), el('th', { 'data-qterm': 'passerelle' }, 'Passerelle'), el('th', { 'data-qterm': 'cos' }, 'Classe QoS'), el('th', {}, 'Machines'))),
        el('tbody', {}, ...N.VLANS.map((v) => el('tr', {}, el('td', { class: 'cn-vcell', style: vstyle(v.id) }, el('b', {}, String(v.id)), ` · ${v.name}`), el('td', {}, v.use), el('td', { class: 'mono' }, N.vlanNet(v.id)), el('td', { class: 'mono' }, '255.255.255.0'), el('td', { class: 'mono' }, `${v.gw}${v.gwOn === 'router' ? ' (routeur)' : ''}`), el('td', {}, N.QOS[v.qos].name), el('td', {}, String(count(v.id))))))))),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Adresses des machines'),
      el('div', { class: 'cn-plangrid q-none' }, ...N.VLANS.map((v) => el('div', { class: 'cn-planv', style: vstyle(v.id) }, el('h4', {}, `VLAN ${v.id} · ${v.name}`),
        el('ul', {}, ...N.DEVS.filter((d) => d.vlan === v.id || (d.ifaces && d.ifaces.some((f) => f.vlan === v.id))).map((d) => el('li', {}, el('span', { class: 'mono' }, d.ifaces ? d.ifaces.find((f) => f.vlan === v.id).ip : d.dhcp ? 'DHCP' : d.ip), ' ', d.name)))))),
      el('p', { class: 'note' }, 'Le VLAN 1 est le VLAN par défaut des ports libres : aucune machine du car n\'y est. Une machine qui s\'y retrouve est isolée.')));
}

// ---------------- onglet Outils ----------------
const devOptions = (withChaine) => [...N.DEVS.map((d) => [d.id, `${d.name} (${N.ipOf(d.id) || 'sans adresse'})`]), ...(withChaine ? [['chaine', `${N.CHAINE.name} (${N.CHAINE.ip})`]] : [])];
function selectOf(opts, value, onChange, label, f) {
  const s = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': label, 'data-f': f }, ...opts.map(([v, l]) => el('option', { value: v, selected: String(v) === String(value) }, l))));
  s.addEventListener('change', () => onChange(s.value));
  return s;
}
function tabOutils(box) {
  // ping
  const src = selectOf(devOptions(false), V.src, (v) => { V.src = v; }, 'Machine qui envoie le ping', 'src');
  const dst = selectOf(devOptions(true), V.dst, (v) => { V.dst = v; }, 'Machine visée', 'dst');
  const go = el('button', { class: 'btn primary cn-go', type: 'button', onclick: () => { V.src = src.value; V.dst = dst.value; const r = N.doPing(V.src, V.dst); explain(N.explainPing(r), r.ok ? 'ok:cnping' : 'warn:cnping'); if (CUR) CUR.render(true); } }, 'Lancer le ping');
  const P = N.CN.lastPing;
  box.append(el('div', { class: 'hwpanel cn-ping' }, el('h3', { 'data-qterm': 'ping' }, 'Ping entre deux machines'),
    el('div', { class: 'cn-pingrow' }, el('div', { class: 'field' }, el('label', { for: 'cn-src' }, 'Depuis'), Object.assign(src, { id: 'cn-src' })), el('div', { class: 'field' }, el('label', { for: 'cn-dst' }, 'Vers'), Object.assign(dst, { id: 'cn-dst' })), go),
    P ? pingBox(P) : el('p', { class: 'note' }, 'Choisissez deux machines et lancez le ping : le résultat dit si la demande et la réponse passent, par quel chemin, et pourquoi.')));
  // balayage
  const SW = N.CN.lastSweep;
  const sweepBox = el('div', { class: 'hwpanel cn-sweepbox' }, el('h3', { 'data-qterm': 'ping' }, 'Balayage depuis le PC de supervision'),
    el('p', { class: 'note' }, 'Le PC du chef de car envoie un ping à chaque machine du car (hors invités) : la méthode la plus rapide pour trouver qui ne répond plus.'),
    el('div', { class: 'hwrow' }, el('button', { class: 'btn cn-sweep', type: 'button', onclick: () => { const s = N.sweep(); const bad = s.rows.filter((r) => r.state !== 'ok'); explain(bad.length ? `Balayage : ${bad.length} machine${bad.length > 1 ? 's' : ''} ne répond${bad.length > 1 ? 'ent' : ''} pas bien (${bad.map((r) => name(r.id)).join(', ')}). Ouvrez sa fiche : diagnostic et tests.` : `Balayage : les ${s.rows.length} machines répondent.`, bad.length ? 'warn:cnsweep' : 'ok:cnsweep'); if (CUR) CUR.render(true); } }, 'Lancer le balayage')));
  if (SW) {
    const bad = SW.rows.filter((r) => r.state !== 'ok');
    sweepBox.append(el('p', { class: 'cn-okline' }, led(bad.length ? 'err' : 'ok'), `${SW.rows.length - bad.length} sur ${SW.rows.length} répondent.`),
      el('div', { class: 'cn-sweep-l' }, ...SW.rows.map((r) => el('button', { type: 'button', class: 'cn-sw-i ' + (r.state === 'ok' ? 'ok' : 'err'), title: r.why || 'répond', onclick: () => N.ctrlGo({ tab: 'machines', dev: r.id }) }, led(r.state === 'ok' ? 'ok' : r.state === 'instable' ? 'warn' : 'err'), name(r.id)))),
      bad.length ? el('ul', { class: 'cn-issues' }, ...bad.map((r) => el('li', { class: 'err' }, led('err'), el('span', {}, el('b', {}, name(r.id) + ' : '), r.why)))) : null);
  }
  box.append(sweepBox);
  // tables ARP et MAC
  const arpSel = selectOf(N.VLANS.filter((v) => v.gwOn === 'core').map((v) => [v.id, `VLAN ${v.id} · ${v.name}`]), V.arpVlan, (v) => N.ctrlGo({ arpVlan: +v }), 'VLAN de la table ARP', 'arpvlan');
  const arp = N.arpTable(V.arpVlan);
  const macSel = selectOf(N.SWITCHES.map((s) => [s.id, s.name]), V.macSw, (v) => N.ctrlGo({ macSw: v }), 'Switch de la table MAC', 'macsw');
  const mac = N.macTable(V.macSw);
  box.append(el('div', { class: 'cn-tables' },
    el('div', { class: 'hwpanel' }, el('h3', { 'data-qterm': 'arp' }, 'Table ARP du SW-CŒUR'), el('div', { class: 'hwrow' }, arpSel),
      el('p', { class: 'note' }, 'Adresse IP → adresse MAC, apprises par l\'interface VLAN du cœur. Deux MAC pour la même adresse : conflit.'),
      el('div', { class: 'tblwrap cn-scroll' }, el('table', { class: 'tbl cn-small' }, el('thead', {}, el('tr', {}, el('th', {}, 'Adresse IP'), el('th', {}, 'Adresse MAC'), el('th', {}, 'Machine'), el('th', {}, 'Port'))),
        el('tbody', {}, ...arp.map((r) => el('tr', { class: r.dup ? 'cn-dup' : '' }, el('td', { class: 'mono' }, r.ip, r.dup ? el('b', {}, ' conflit !') : null), el('td', { class: 'mono' }, r.mac), el('td', {}, name(r.dev)), el('td', {}, r.port))))))),
    el('div', { class: 'hwpanel' }, el('h3', { 'data-qterm': 'table-mac' }, 'Table MAC d\'un switch'), el('div', { class: 'hwrow' }, macSel),
      el('p', { class: 'note' }, 'Adresse MAC → port et VLAN. Une machine absente n\'envoie rien : câble, port désactivé ?'),
      el('div', { class: 'tblwrap cn-scroll' }, el('table', { class: 'tbl cn-small' }, el('thead', {}, el('tr', {}, el('th', {}, 'VLAN'), el('th', {}, 'Adresse MAC'), el('th', {}, 'Port'), el('th', {}, 'Machine'))),
        el('tbody', {}, ...mac.map((r) => el('tr', {}, el('td', {}, String(r.vlan)), el('td', { class: 'mono' }, r.mac), el('td', {}, String(r.port) + (r.via ? ' (lien montant)' : '')), el('td', {}, name(r.dev))))))))));
  box.append(loadPanel());
}
function pingBox(P) {
  const lines = [];
  const A = name(P.a), B = name(P.b);
  lines.push(`ping ${P.dstIp} depuis ${A} (${N.ipOf(P.a) || '—'})`);
  if (P.state === 'ok') for (let i = 0; i < 4; i++) lines.push(`Réponse de ${P.dstIp} : temps ${P.b === 'chaine' ? 12 + i : '< 1'} ms`);
  else if (P.state === 'instable') { lines.push(`Réponse de ${P.dstIp} : MAC ${N.macOf((P.answered || [])[0]) || '?'}`, 'Délai d\'attente dépassé', `Réponse de ${P.dstIp} : MAC ${N.macOf((P.answered || [])[1]) || N.macOf((P.answered || [])[0]) || '?'}`, 'Délai d\'attente dépassé'); }
  else for (let i = 0; i < 4; i++) lines.push('Délai d\'attente dépassé');
  lines.push(`4 paquets envoyés, ${P.state === 'ok' ? 4 : P.state === 'instable' ? 2 : 0} reçus, ${P.state === 'ok' ? 0 : P.state === 'instable' ? 50 : 100} % de perte`);
  return el('div', { class: 'cn-pingres ' + P.state, 'data-state': P.state },
    el('div', { class: 'cn-term', role: 'log', 'aria-label': `Résultat du ping de ${A} vers ${B}` }, ...lines.map((l) => el('div', {}, l))),
    el('p', { class: 'cn-why' }, led(P.state === 'ok' ? 'ok' : P.state === 'instable' ? 'warn' : 'err'), el('span', {}, N.explainPing(P))),
    P.hops && P.hops.length > 1 ? el('ol', { class: 'cn-hops', 'aria-label': 'Chemin de la demande' }, ...P.hops.map((h) => el('li', {}, h))) : null);
}
function loadPanel() {
  const R = N.evaluate();
  const bar = (D, cap, label) => {
    const tot = D.demand; const wrap = el('div', { class: 'cn-bar', role: 'img', 'aria-label': `${label} : ${Math.round(tot)} Mb/s demandés pour ${cap} Mb/s` });
    for (const k of N.QOS_ORDER) { const x = D.by[k] || 0; if (!x) continue; wrap.append(el('i', { class: 'q-' + k, style: { width: Math.min(100, (x / Math.max(cap, tot)) * 100) + '%' }, title: `${N.QOS[k].name} : ${fmtMb(x)}${D.loss[k] ? ` · ${Math.round(D.loss[k] * 100)} % perdus` : ''}` })); }
    const lost = N.QOS_ORDER.filter((k) => D.loss[k] > 0.001).map((k) => `${N.QOS[k].name} ${Math.round(D.loss[k] * 100)} %`).join(', ');
    return el('div', { class: 'cn-barrow' }, el('span', { class: 'cn-barl' }, label), wrap, el('span', { class: 'mono cn-barv' }, `${fmtMb(Math.min(tot, cap))}${tot > cap ? ` (demandé ${fmtMb(tot)})` : ''}`), lost ? el('span', { class: 'cn-lost' }, 'pertes : ' + lost) : null);
  };
  const copy = el('button', { class: 'btn toggle cn-copy', type: 'button', 'aria-pressed': String(N.CN.copy), onclick: () => { N.setCopy(!N.CN.copy); explain(N.CN.copy ? 'Copie de fichiers lancée (NAS → PC d\'habillage) : TCP prend tout le débit qu\'on lui laisse. Le lien montant du SW-PROD sature. Avec la QoS, l\'intercom et les commandes passent devant ; désactivez la QoS du SW-CŒUR pour entendre la différence.' : 'Copie terminée : le lien montant respire.', 'cn:copy'); } }, N.CN.copy ? 'Arrêter la copie de fichiers' : 'Lancer une copie de fichiers (NAS → habillage)');
  return el('div', { class: 'hwpanel cn-load' }, el('h3', { 'data-qterm': 'charge' }, 'Charge des liens montants (1 Gb/s)'),
    el('p', { class: 'note' }, 'Chaque couleur est une classe de QoS. Quand un lien sature, le switch sert d\'abord la classe la plus prioritaire, si sa QoS est activée.'),
    ...N.UPLINKS.flatMap((u) => [bar(R.load[u.id].down, R.load[u.id].cap, `${u.label} · vers ${N.swById(u.b.sw).name}`), bar(R.load[u.id].up, R.load[u.id].cap, `${u.label} · vers SW-CŒUR`)]),
    el('div', { class: 'cn-legend' }, ...N.QOS_ORDER.map((k) => el('span', {}, el('i', { class: 'q-' + k }), N.QOS[k].name))),
    el('div', { class: 'hwrow' }, copy));
}

// ---------------- onglet Formation : les bases, simplement ----------------
const fig = (svg) => el('figure', { class: 'cn-fig', html: svg });
function learn(title, ids, figSvg, text, car, go) {
  const h = el('h3', {}, title, ...ids.map((i) => q(i)));
  return el('section', { class: 'hwpanel cn-learn' }, h, figSvg ? fig(figSvg) : null, rich(text, 'cn-rich'),
    car ? el('p', { class: 'cn-car' }, el('b', {}, 'Dans ce car : '), car) : null,
    go ? el('div', { class: 'hwrow' }, el('button', { class: 'btn small', type: 'button', onclick: () => N.ctrlGo(go[1]) }, go[0])) : null);
}
function tabFormation(box) {
  const rcp = N.CN.m.rcp3;
  box.append(el('div', { class: 'hwpanel prose cn-intro2' }, el('h3', {}, 'Le réseau du car, en douze idées'),
    el('p', {}, 'Un car SDI fait passer ses images dans des câbles coaxiaux. Mais pour régler une caméra, commuter le mélangeur, commander la grille ou parler à l\'intercom, les appareils s\'envoient des messages sur un réseau informatique ordinaire, en Ethernet Gigabit. Voici ce qu\'il faut savoir pour le configurer et le dépanner. Les boutons « ? » ouvrent la fiche détaillée de chaque terme.')),
  el('div', { class: 'cn-learngrid' },
    learn('1. L\'adresse IP', ['sous-reseau'], LESSON_FIGS.ip(), 'Chaque machine a une **adresse IP** : quatre nombres de 0 à 255, comme 10.1.20.33. C\'est son adresse sur le réseau, celle que les autres utilisent pour lui écrire.\n\nDeux machines ne doivent **jamais** avoir la même adresse : sinon, les messages arrivent tantôt à l\'une, tantôt à l\'autre.', `le RCP 3 est en ${rcp.ip}, sa CCU en ${N.CN.m.ccu3.ip}.`, ['Voir le plan d\'adressage', { tab: 'plan' }]),
    learn('2. Le masque et le /24', ['sous-reseau'], null, 'Le **masque** dit quelle partie de l\'adresse désigne le **réseau** et quelle partie désigne la **machine**. 255.255.255.0, qu\'on écrit aussi **/24**, veut dire : les trois premiers nombres sont le réseau, le dernier est la machine.\n\nDeux machines dont les trois premiers nombres sont identiques sont « chez elles » : elles se parlent directement. Un masque faux, et la machine se trompe sur qui est chez elle.\n- /24 = 255.255.255.0 : 254 machines ;\n- /16 = 255.255.0.0 : 65 534 machines ;\n- /28 = 255.255.255.240 : 14 machines.', 'toutes les machines sont en /24.', null),
    learn('3. La passerelle', ['passerelle'], LESSON_FIGS.gw(), 'Pour écrire à une machine qui n\'est **pas** dans son sous-réseau, une machine passe par sa **passerelle** : l\'adresse du routeur de son réseau. C\'est la porte de sortie.\n\nUne passerelle fausse ne gêne pas les échanges dans le sous-réseau, mais coupe tout le reste : supervision, heure, Internet.', 'la passerelle de chaque VLAN est sa .1 (10.1.20.1 pour les caméras), portée par le SW-CŒUR.', ['Faire un ping par la passerelle', { tab: 'outils', src: 'supv', dst: 'ccu1' }]),
    learn('4. L\'adresse MAC et ARP', ['mac', 'arp'], FIGS['cn-arp'](), 'L\'adresse IP se choisit ; l\'**adresse MAC** est le numéro gravé dans la carte réseau. Avant d\'envoyer un message dans son réseau, la machine demande à tous : « qui a l\'adresse 10.1.20.13 ? » (c\'est **ARP**). La bonne machine répond avec sa MAC.', 'onglet Outils → table ARP : adresse IP et MAC de chaque machine.', ['Voir la table ARP', { tab: 'outils' }]),
    learn('5. Switch et routeur', ['commutateur', 'table-mac'], FIGS['cn-switch'](), 'Le **switch** relie les machines d\'un même réseau : il apprend sur quel port est chaque MAC et envoie chaque message au bon port. Le **routeur** relie des réseaux différents : il lit l\'adresse IP et choisit la route.', 'SW-PROD et SW-VISION sont des switchs ; le SW-CŒUR est un switch de niveau 3 qui route aussi entre les VLAN.', ['Voir la topologie', { tab: 'topo' }]),
    learn('6. Les VLAN', ['vlan', 'ctrl-sdi'], FIGS['cn-plan'](), 'Un **VLAN** découpe un switch en plusieurs réseaux séparés, comme s\'il y avait plusieurs switchs. On range les machines par usage : caméras ensemble, intercom ensemble, invités à part. Deux VLAN ne se parlent que par un routeur.', 'sept VLAN : 10 gestion, 20 caméras, 30 production, 40 ralentis, 50 intercom et son, 60 fichiers, 90 invités.', ['Voir le plan d\'adressage', { tab: 'plan' }]),
    learn('7. Port access, port trunk', ['trunk'], FIGS['cn-trunk'](), 'On branche une machine sur un port **access** : il appartient à un seul VLAN, et c\'est sur le switch qu\'on le règle. Entre deux switchs, un port **trunk** transporte plusieurs VLAN : chaque message porte une petite **étiquette 802.1Q** avec son numéro de VLAN.', 'les deux liens montants vers le SW-CŒUR sont des trunks.', ['Voir les ports du SW-VISION', { tab: 'switchs', sw: 'vision' }]),
    learn('8. La QoS : qui passe en premier', ['cos', 'qos'], FIGS['cn-qos'](), 'Quand un lien est plein, les messages font la queue. La **QoS** donne une priorité à chacun (la **CoS** dans l\'étiquette VLAN, le **DSCP** dans l\'adresse IP) : l\'intercom passe d\'abord, les commandes ensuite, les fichiers en dernier. Sans QoS, une grosse copie de fichiers fait hacher l\'intercom.', 'voix CoS 5 / DSCP 46, commande CoS 4 / DSCP 32, gestion CoS 2 / DSCP 16, données 0, fichiers CoS 1 / DSCP 8.', ['Essayer avec une copie de fichiers', { tab: 'outils' }]),
    learn('9. DHCP ou adresse fixe', ['dhcp'], FIGS['cn-dhcp'](), 'Avec le **DHCP**, la machine demande son adresse à un serveur ; avec une **adresse fixe**, on la saisit à la main. En production, on veut retrouver chaque machine toujours à la même adresse : adresses fixes, notées au plan. Le DHCP est pour les invités.', 'seul le VLAN 90 (invités) a un serveur DHCP : le routeur.', null),
    learn('10. Le câble : RJ45, Cat6, Gigabit', ['rj45', 'poe'], FIGS['cn-rj45'](), 'Le câble réseau a **4 paires** de fils torsadés et une prise **RJ45**. En Gigabit (1 Gb/s), les 4 paires servent, sur **100 m** au plus. Le **voyant** du port s\'allume quand le lien monte : c\'est la première chose à regarder. Certains switchs alimentent l\'appareil par le câble (**PoE**).', 'câbles de catégorie 6 ; les RCP et les panneaux d\'intercom sont alimentés en PoE.', ['Voir les voyants des ports', { tab: 'switchs', sw: 'core' }]),
    learn('11. Le ping', ['ping'], FIGS['cn-ping'](), 'Le **ping** envoie une demande d\'écho ; la machine visée répond. S\'il y a une réponse, le chemin marche dans les **deux sens**. Sinon : « délai d\'attente dépassé », et il faut chercher où ça casse.', 'onglet Outils : ping entre deux machines, et balayage de tout le car depuis le PC de supervision.', ['Faire un ping', { tab: 'outils', src: 'rcp1', dst: 'ccu1' }]),
    learn('12. Dépanner avec méthode', ['conflit-ip'], LESSON_FIGS.method(), 'Une machine ne répond plus ? On vérifie dans l\'ordre :\n1. le **câble** et le voyant du port ;\n2. le **VLAN** du port ;\n3. l\'**adresse**, le **masque**, et l\'absence de **conflit** ;\n4. la **passerelle**.\n\nÀ chaque étape, un ping confirme.', 'onglet Machines : le diagnostic de chaque machine dit ce qui ne va pas.', ['Voir les machines en défaut', { tab: 'machines', filter: 'err' }])));
}
