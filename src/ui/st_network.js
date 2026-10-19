// @ts-check
import { S, emit } from '../state.js';
import { el, fmt } from '../util.js';
import { toast, modal, selectEl, ask } from './common.js';
import { explain } from './widgets.js';
import { FAB, COLORS, CLABEL, LEAVES, vlanOf, subnetOf, sviIp, p2p, gmNet, PTP_REF, DSCP_REF, QUERIER_TIMEOUT, markDirty, evaluate, setSwitchPower, writeMemory, loadReference, loadFactory, portState, sdpOf, clockId, ipToInt, inSubnet, videoGbps, resetFabric, buildFabric, topoKey } from '../net/fabric.js';
import { cliSession, runCli, cliPrompt, cliComplete, runningConfig, ptpPorts, ifShort } from '../net/cli.js';
import { FAULTS, injectFault } from '../faults.js';
import { tabMeasure, setMeasureSub } from './net_tools.js';
import { tabCourse, missionCard } from './net_course.js';
import { NC, NET_MISSIONS, objectivesOf } from '../net/course.js';
import { selectRx, sdpExplain } from '../net/analyzer.js';
import { offerDownload } from '../shared.js';
import { OPS, tabOps, opsDock, opsKey } from './net_ops.js';
import { q, qify, openLexique } from './term.js';
import { TERMS } from '../content/netterms.js';

// ----------------------------------------------------------------------------------
// Poste « Réseau IP », en deux onglets :
//   · Technique : les deux fabrics ST 2110 (rouge / bleu) en spine-leaf, leurs commutateurs
//     configurables (interface graphique + ligne de commande), le plan d'adressage, les flux
//     NMOS / SDP, PTP, les mesures, le diagnostic et la formation ;
//   · Exploitation (net_ops.js) : l'interface épurée d'un contrôleur et des appareils.
// Les termes techniques des intitulés ont leur bouton « ? » (term.js) ; « Lexique » les regroupe.
// ----------------------------------------------------------------------------------
const NSV = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NSV, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); for (const c of kids) if (c != null) e.append(c); return e; };
const V = { mode: 'tech', tab: 'topo', sw: 'LEAF-R1', port: 'Ethernet1', sub: 'ports', term: {}, gui: {}, sel: null, rx: 'ME1', onlyConn: true };
const host = (id) => (FAB.switches[id] ? FAB.switches[id].running.hostname : id);
const fmtG = (x) => (x >= 1 ? fmt(x, 1) + ' Gb/s' : x > 0 ? fmt(x * 1000, 0) + ' Mb/s' : '0');
const dotCls = (lv) => 'dot ' + (lv === 'err' ? 'red' : lv === 'warn' ? 'amber' : lv === 'off' ? '' : 'green');
const TABS = [['topo', 'Topologie'], ['switch', 'Commutateurs'], ['addr', 'Plan d\'adressage'], ['flows', 'Flux NMOS · SDP'], ['ptp', 'PTP'], ['meas', 'Mesures'], ['diag', 'Diagnostic'], ['learn', 'Formation']];
const MODES = [['tech', 'Technique', 'Schémas, commutateurs, configuration'], ['ops', 'Exploitation', 'Connexions, appareils, PTP, NMOS']];
const log = (type, o = {}) => emit('netlog', { type, ...o });

export function buildNetwork(body, arg, ctx) {
  const mvMon = el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'Multiview (les flux reçus par le multiviewer)'), el('div', { class: 'mon fill', 'data-gl': 'mv' }));
  ctx.dock.append(mvMon);
  if (!S.ipMode) {
    body.append(el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Car en SDI'),
      el('p', {}, 'Ce car est câblé en SDI (coaxial, grille de commutation). Le réseau média ST 2110 n\'existe que dans le car IP : revenez à l\'écran d\'accueil et choisissez « Infrastructure : car IP (ST 2110) ».'),
      el('p', {}, 'Vous pouvez quand même consulter le chapitre « Réseau ST 2110 spine-leaf » du guide.'),
      el('button', { class: 'btn', onclick: () => emit('openGuide', 'reseau') }, 'Ouvrir le chapitre du guide')));
    return {};
  }
  if (!FAB.res || FAB.key !== topoKey()) buildFabric();
  if (arg && FAB.switches[arg]) { V.sw = arg; V.tab = 'switch'; V.mode = 'tech'; }
  // bandeau d'écrans : le multiview en Technique, la source et la destination en Exploitation
  const OD = opsDock();
  const setDock = () => { const want = V.mode === 'ops' ? OD.nodes : [mvMon]; if (ctx.dock.firstChild !== want[0]) ctx.dock.replaceChildren(...want, ctx.explainBox); };
  const modes = el('div', { class: 'net-modes', role: 'tablist', 'aria-label': 'Vue du poste' });
  const summary = el('div', { class: 'net-sum' });
  const mbox = el('div', { class: 'list' });
  const tabs = el('div', { class: 'tabs net-tabs' });
  const content = el('div', { class: 'list net' });
  body.append(modes, summary, mbox, tabs, content);
  const setMode = (m) => { V.mode = m; log('mode', { mode: m }); render(true); };
  for (const [k, l, sub] of MODES) modes.append(el('button', { class: 'net-mode', role: 'tab', 'data-mode': k, onclick: () => setMode(k) }, el('b', {}, l), el('span', {}, sub)));
  const lexBtn = el('button', { class: 'net-lex', title: 'Toutes les explications des termes techniques (boutons « ? »)', onclick: () => openLexique(lexBtn) }, el('b', {}, '?'), el('span', {}, 'Lexique'));
  modes.append(lexBtn);
  const show = (k) => { V.mode = 'tech'; V.tab = k; log('tab', { tab: k }); render(true); };
  for (const [k, l] of TABS) tabs.append(el('button', { class: 'tab', 'data-k': k, onclick: () => show(k) }, l));
  let lastKey = '';
  const R = { content, show, refresh: () => render(true), applyCli, live: null, openSdp };
  function render(force) {
    const key = stateKey() + (V.mode === 'ops' ? '§' + opsKey() : '');
    if (!force && key === lastKey) return;
    lastKey = key;
    for (const b of modes.querySelectorAll('.net-mode')) { const on = /** @type {HTMLElement} */ (b).dataset.mode === V.mode; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.k === V.tab);
    tabs.hidden = V.mode !== 'tech';
    setDock(); OD.update();
    drawSummary(summary); qify(summary);
    mbox.innerHTML = '';
    if (V.mode === 'ops') {
      const a = document.activeElement;
      if (!force && a && content.contains(a) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName)) { lastKey = ''; return; }
      content.innerHTML = ''; R.live = null;
      tabOps(content, R); qify(content);
      return;
    }
    if (V.tab !== 'learn' && (NC.active || NC.exam)) { if (NC.active) missionCard(mbox, R, true); else mbox.append(el('div', { class: 'hwpanel net-mission compact' }, el('div', { class: 'hwrow' }, el('h3', {}, NC.exam.over ? 'Examen terminé' : 'Examen réseau en cours'), el('button', { class: 'btn small', onclick: () => show('learn') }, 'Voir')))); }
    const a = document.activeElement;
    const typing = a && content.contains(a) && ['INPUT', 'SELECT', 'TEXTAREA'].includes(a.tagName);
    if (V.tab === 'switch' && V.sub === 'term' && !force) { refreshSwitchFrame(R); return; }
    if (typing && !force) { lastKey = ''; return; }
    content.innerHTML = ''; R.live = null;
    ({ learn: tabCourse, topo: tabTopo, switch: tabSwitch, addr: tabAddr, flows: tabFlows, meas: tabMeasure, ptp: tabPtp, diag: tabDiag })[V.tab](content, R);
    qify(content); qify(mbox);
  }
  R.go = (tab, o = {}) => { const { msub, keepCourse: _keep, ...rest } = o; for (const k in rest) if (rest[k] !== undefined) V[k] = rest[k]; if (msub) setMeasureSub(msub); show(tab); };
  R.ops = (o = {}) => { for (const k of ['view', 'dev', 'rx', 'src']) if (o[k] !== undefined) OPS[k] = o[k]; if (o.rx !== undefined) { OPS.mode = null; OPS.man = null; } if (o.dev !== undefined) OPS.draft = null; setMode('ops'); };
  render(true);
  CUR = R;
  return { update() { render(false); if (R.live) R.live(); OD.update(); }, close() { if (CUR === R) CUR = null; } };
}
// ---------------- pour le chef de car : où en est l'écran, y aller, taper des commandes ----------------
let CUR = null;
export const netView = () => ({ mode: V.mode, tab: V.tab, sub: V.sub, sw: V.sw, port: V.port, rx: V.rx, opsView: OPS.view, opsDev: OPS.dev, opsRx: OPS.rx, opsSrc: OPS.src, opsMode: OPS.mode });
export function netGo(tab, o = {}) { if (!CUR) return; if (tab === 'ops') CUR.ops(o); else CUR.go(tab || V.tab, o); }
// tape des commandes dans le terminal du commutateur, comme le stagiaire (elles restent dans l'historique)
export function netType(id, lines) {
  if (!FAB.switches[id]) return;
  const T = termLog(id);
  for (const c of lines) {
    T.lines.push({ t: 'cmd', s: cliPrompt(T.s) + ' ' + c });
    T.s.lastCmd = null;
    const r = runCli(T.s, c); if (r) T.lines.push({ t: r.startsWith('%') ? 'err' : 'out', s: r });
    log('cli', { sw: id, pat: T.s.lastCmd, raw: c, ok: !!T.s.lastCmd && !(r || '').startsWith('%') });
  }
  if (CUR) CUR.refresh();
}
function courseKey() {
  let k = (NC.active || '') + '|' + Object.keys(NC.answers).length + '|' + (NC.done ? NC.done.id : '') + '|' + (NC.hints[NC.active] || 0);
  if (NC.active) { const m = NET_MISSIONS.find((x) => x.id === NC.active); if (m) k += objectivesOf(m).map((o) => (o.ok ? 1 : 0)).join(''); }
  if (NC.exam) k += '|exam' + (NC.exam.over ? 'o' : 'r') + NC.exam.faults.length + NC.exam.faults.filter((f) => f.entry && f.entry.done).length;
  return k;
}
function stateKey() { return [V.mode, FAB.ver, FAB.lastMap, FAB.mode, FAB.registryUp, JSON.stringify(FAB.gm), FAB.issues.map((i) => i.title + i.detail).join('|'), V.tab, V.sw, V.port, V.sub, V.sel && V.sel.id, V.rx, V.onlyConn, courseKey()].join('§'); }

// ---------------- bandeau d'état (une ligne, commun aux deux onglets) ----------------
function drawSummary(box) {
  box.innerHTML = '';
  const R = FAB.res; if (!R) return;
  const errs = FAB.issues.filter((i) => i.sev === 'err').length, warns = FAB.issues.filter((i) => i.sev === 'warn').length;
  const rx = Object.values(R.rxState);
  const lost = rx.filter((s) => !s.ok || s.loss > 0).length, unp = rx.filter((s) => s.ok && !s.protected).length;
  const item = (lv, label, value, cls = '') => el('span', { class: 'net-st ' + cls }, el('i', { class: 'ops-dot ' + lv }), el('b', {}, label), value);
  for (const c of COLORS) {
    const sws = Object.values(FAB.switches).filter((s) => s.color === c);
    const on = sws.filter((s) => s.power).length; const gm = R.gmActive[c];
    const bad = FAB.issues.some((i) => i.color === c && i.sev === 'err');
    box.append(item(on < sws.length || !gm || gm.rogue || bad ? 'err' : FAB.issues.some((i) => i.color === c && i.sev === 'warn') ? 'warn' : 'ok', CLABEL[c][0].toUpperCase() + CLABEL[c].slice(1), `${on}/${sws.length} · PTP ${gm ? gm.name.replace('Grand maître ', 'GM') + (gm.rogue ? ' (!)' : '') : 'aucun'}`, c));
  }
  const devs = Object.values(FAB.devices).filter((d) => d.kind !== 'gm' && d.kind !== 'nmos'); const reg = devs.filter((d) => R.reg[d.id]).length;
  box.append(item(!R.regOk ? 'err' : reg < devs.length ? 'warn' : 'ok', 'NMOS', R.regOk ? `${reg}/${devs.length} nœuds` : 'registre injoignable'),
    item(lost ? 'err' : unp ? 'warn' : 'ok', 'Réceptions', `${rx.length}${lost ? ` · ${lost} en défaut` : ''}${unp ? ` · ${unp} sans 2022-7` : ''}`),
    item('off', FAB.mode === 'sdn' ? 'SDN' : 'PIM-SSM', FAB.mode === 'sdn' ? 'contrôleur' : 'IGMPv3', 'mode'),
    item(errs ? 'err' : warns ? 'warn' : 'ok', 'Alarmes', `${errs}${warns ? ` · ${warns} avert.` : ''}`));
}

// ---------------- topologie ----------------
const LX = (k) => 170 + (k - 1) * 180, LW = 160, SX = (s) => (s === 1 ? 470 : 770), SW = 160;
function linkStyle(l) {
  const st = FAB.res.up[l.id]; const L = FAB.res.linkLoad;
  if (!st.up) return { stroke: '#7a2a24', dash: '4 4', w: 1.2, u: 0, t: 'coupé : ' + st.reason };
  const u = Math.max((L[l.id + ':up'] || {}).load || 0, (L[l.id + ':down'] || {}).load || 0) / st.speed;
  if (st.ospf !== 'FULL') return { stroke: '#ffb020', dash: '2 4', w: 1.4, u, t: 'OSPF : ' + st.ospf };
  if (!st.pim) return { stroke: '#c77dff', dash: '6 3', w: 1.4, u, t: 'pas de voisin PIM' };
  return { stroke: u > 1 ? '#ff3b30' : u > 0.8 ? '#ffb020' : u > 0.005 ? '#2fd25a' : '#4a5560', w: 1.3 + Math.min(1, u) * 3, u, t: `${fmt(u * 100, 0)} % · ↑ ${fmtG((L[l.id + ':up'] || {}).load || 0)} · ↓ ${fmtG((L[l.id + ':down'] || {}).load || 0)}` };
}
function nicLevel(d, c) {
  const n = FAB.res.nic[d.id + ':' + c]; if (!n) return 'off';
  if (!n.up) return 'err'; if (!n.reach || n.conflict) return 'warn';
  const L = FAB.res.linkLoad[`${d.id}:${c}:down`]; if (L && L.load > L.cap) return 'err';
  return 'ok';
}
const LV_COL = { ok: '#2fd25a', warn: '#ffb020', err: '#ff3b30', off: '#3a4652' };
function swLevel(sw) {
  if (!sw.power) return 'err';
  const is = FAB.issues.filter((i) => i.sw === sw.id && i.sev !== 'info');
  return is.some((i) => i.sev === 'err') ? 'err' : is.length ? 'warn' : 'ok';
}
function tabTopo(box, R) {
  const devs = LEAVES.map((L) => Object.values(FAB.devices).filter((d) => d.leaf === L.k));
  const two = devs.map((d) => d.length > 7);
  const rows = Math.max(...devs.map((d, i) => (two[i] ? Math.ceil(d.length / 2) : d.length)));
  const Y = { rs: 24, rl: 150, dv: 236, bl: 0, bs: 0 };
  Y.bl = Y.dv + rows * 30 + 26; Y.bs = Y.bl + 126;
  const H = Y.bs + 70, mid = (Y.dv + Y.bl) / 2;
  const svg = sv('svg', { viewBox: `0 0 1400 ${H}`, class: 'net-topo', role: 'img', 'aria-label': 'Topologie spine-leaf des réseaux rouge et bleu' });
  svg.append(sv('rect', { x: 0, y: 0, width: 1400, height: H, fill: '#0b0e11' }));
  svg.append(sv('text', { x: 14, y: 18, class: 'nt-h red' }, 'RÉSEAU ROUGE (A)'), sv('text', { x: 14, y: H - 10, class: 'nt-h blue' }, 'RÉSEAU BLEU (B)'));
  const click = (g, sel) => { g.setAttribute('data-tut', sel.kind === 'sw' ? 'sw:' + FAB.switches[sel.id].role : sel.kind); g.style.cursor = 'pointer'; g.addEventListener('click', () => { if (sel.kind === 'sw' && V.sel && V.sel.id === sel.id) { R.go('switch', { sw: sel.id }); return; } V.sel = sel; log('sel', { kind: sel.kind, id: sel.id, role: sel.kind === 'sw' ? FAB.switches[sel.id].role : null }); R.refresh(); }); };
  // uplinks
  for (const l of FAB.links) {
    const red = l.color === 'red'; const st = linkStyle(l);
    const lx = LX(l.k) + 30 + (l.s - 1) * 90 + l.j * 12, sx = SX(l.s) + 18 + (l.k - 1) * 22 + l.j * 6;
    const y1 = red ? Y.rl : Y.bl + 46, y2 = red ? Y.rs + 46 : Y.bs;
    const g = sv('g', {}, sv('line', { x1: lx, y1, x2: sx, y2, stroke: st.stroke, 'stroke-width': st.w, 'stroke-dasharray': st.dash || null }), sv('line', { x1: lx, y1, x2: sx, y2, stroke: 'transparent', 'stroke-width': 8 }), sv('title', {}, `${host(l.a.sw)} ${ifShort(l.a.port)} ↔ ${host(l.b.sw)} ${ifShort(l.b.port)} · 100 GbE · ${st.t}`));
    click(g, { kind: 'link', id: l.id }); svg.append(g);
  }
  // grands maîtres
  for (const g of [1, 2]) {
    const x = g === 1 ? 12 : 1258, w = 130, y = mid - 30;
    const gm = FAB.gm['gm' + g];
    const act = COLORS.map((c) => FAB.res.gmActive[c] && FAB.res.gmActive[c].id === 'gm' + g);
    for (const c of COLORS) {
      const sy = c === 'red' ? Y.rs + 23 : Y.bs + 23; const sx = g === 1 ? SX(1) : SX(2) + SW;
      svg.append(sv('path', { d: `M${x + w / 2},${c === 'red' ? y : y + 60} V${sy} H${sx}`, fill: 'none', stroke: gm.up ? (c === 'red' ? '#ff6b5e' : '#5ea8ff') : '#7a2a24', 'stroke-width': 1.4, 'stroke-dasharray': gm.up ? '1 0' : '4 4', opacity: 0.8 }));
    }
    const grp = sv('g', {}, sv('rect', { x, y, width: w, height: 60, rx: 5, class: 'nt-box ' + (!gm.up ? 'err' : act.some(Boolean) ? 'ok' : '') }),
      sv('text', { x: x + w / 2, y: y + 18, class: 'nt-t', 'text-anchor': 'middle' }, `GRAND MAÎTRE ${g}`),
      sv('text', { x: x + w / 2, y: y + 34, class: 'nt-s', 'text-anchor': 'middle' }, gm.up ? (gm.gps ? 'GPS · classe 6' : 'holdover · classe 7') : 'HORS SERVICE'),
      sv('text', { x: x + w / 2, y: y + 49, class: 'nt-s', 'text-anchor': 'middle' }, act.every(Boolean) ? 'élu rouge + bleu' : act[0] ? 'élu rouge' : act[1] ? 'élu bleu' : `priority1 ${gm.priority1}`),
      sv('title', {}, `Grand maître PTP ${g} (ST 2059-2, domaine ${PTP_REF.domain}) raccordé aux spines ${g} rouge et bleue, port Ethernet31.`));
    click(grp, { kind: 'gm', id: 'gm' + g }); svg.append(grp);
  }
  // réseau de contrôle
  const ctl = FAB.switches['SW-CTRL'];
  const cg = sv('g', {}, sv('rect', { x: 1258, y: mid + 44, width: 130, height: 52, rx: 5, class: 'nt-box ' + (swLevel(ctl) === 'ok' ? '' : swLevel(ctl)) }), sv('text', { x: 1323, y: mid + 63, class: 'nt-t', 'text-anchor': 'middle' }, 'SW-CTRL'), sv('text', { x: 1323, y: mid + 78, class: 'nt-s', 'text-anchor': 'middle' }, FAB.res.regOk ? 'NMOS OK' : 'NMOS HS'), sv('text', { x: 1323, y: mid + 91, class: 'nt-s', 'text-anchor': 'middle' }, 'VLAN 10 / 20'), sv('title', {}, 'Commutateur de contrôle et de gestion (hors réseau média) : registre NMOS, ports de contrôle des appareils, gestion hors bande des commutateurs.'));
  click(cg, { kind: 'sw', id: 'SW-CTRL' }); svg.append(cg);
  // commutateurs
  const swBox = (sw, x, y, w, h, title, sub) => {
    const lv = swLevel(sw);
    const g = sv('g', {}, sv('rect', { x, y, width: w, height: h, rx: 5, class: `nt-box sw ${sw.color} ${lv === 'ok' ? '' : lv}` + (V.sel && V.sel.id === sw.id ? ' sel' : '') }),
      sv('text', { x: x + w / 2, y: y + 19, class: 'nt-t', 'text-anchor': 'middle' }, title), sv('text', { x: x + w / 2, y: y + 35, class: 'nt-s', 'text-anchor': 'middle' }, sub),
      sv('title', {}, `${sw.running.hostname} · ${sw.model} · loopback ${sw.loopback} · gestion ${sw.mgmt}${sw.power ? '' : ' · HORS TENSION'}`));
    click(g, { kind: 'sw', id: sw.id }); svg.append(g);
  };
  for (const c of COLORS) for (const s of [1, 2]) { const sw = FAB.switches[`SPINE-${c === 'red' ? 'R' : 'B'}${s}`]; swBox(sw, SX(s), c === 'red' ? Y.rs : Y.bs, SW, 46, sw.running.hostname.toUpperCase(), sw.power ? `spine · ${sw.loopback}` : 'HORS TENSION'); }
  for (const c of COLORS) for (const L of LEAVES) { const sw = FAB.switches[`LEAF-${c === 'red' ? 'R' : 'B'}${L.k}`]; swBox(sw, LX(L.k), c === 'red' ? Y.rl : Y.bl, LW, 46, sw.running.hostname.toUpperCase(), sw.power ? `VLAN ${vlanOf(c, L.k)} · ${subnetOf(c, L.k)}` : 'HORS TENSION'); }
  // appareils (pastilles : lien rouge à gauche, bleu à droite)
  LEAVES.forEach((L, i) => {
    const list = devs[i]; const cw = two[i] ? (LW - 4) / 2 : LW;
    const colTop = Y.dv - 8, colBot = Y.dv + (two[i] ? Math.ceil(list.length / 2) : list.length) * 30 - 2;
    svg.append(sv('line', { x1: LX(L.k) + LW / 2, y1: Y.rl + 46, x2: LX(L.k) + LW / 2, y2: colTop, stroke: '#ff6b5e', 'stroke-width': 1, opacity: 0.6 }));
    svg.append(sv('line', { x1: LX(L.k) + LW / 2, y1: colBot, x2: LX(L.k) + LW / 2, y2: Y.bl, stroke: '#5ea8ff', 'stroke-width': 1, opacity: 0.6 }));
    svg.append(sv('text', { x: LX(L.k) + LW / 2, y: Y.rl + 62, class: 'nt-z', 'text-anchor': 'middle' }, L.name));
    list.forEach((d, j) => {
      const col = two[i] ? j % 2 : 0, row = two[i] ? Math.floor(j / 2) : j;
      const x = LX(L.k) + col * (cw + 4), y = Y.dv + row * 30;
      const pt = FAB.res.devPtp[d.id];
      const ptpBad = pt && !['locked', 'noisy'].includes(pt.state);
      const g = sv('g', {}, sv('rect', { x, y, width: cw, height: 24, rx: 3, class: 'nt-dev' + (ptpBad ? ' ptp' : '') + (V.sel && V.sel.id === d.id ? ' sel' : '') }),
        sv('circle', { cx: x + 8, cy: y + 12, r: 4, fill: LV_COL[nicLevel(d, 'red')] }), sv('circle', { cx: x + cw - 8, cy: y + 12, r: 4, fill: LV_COL[nicLevel(d, 'blue')] }),
        sv('text', { x: x + cw / 2, y: y + 16, class: 'nt-d', 'text-anchor': 'middle' }, shortName(d, cw)),
        sv('title', {}, `${d.name} · ${ifShort(d.nics.red.port)} · rouge ${d.nics.red.ip} · bleu ${d.nics.blue.ip}${pt ? ' · PTP ' + pt.state : ''}`));
      click(g, { kind: 'dev', id: d.id }); svg.append(g);
    });
  });
  const legend = el('div', { class: 'net-legend' }, ...[['#2fd25a', 'lien utilisé'], ['#ffb020', '> 80 % ou OSPF bloqué'], ['#ff3b30', 'saturé (pertes)'], ['#c77dff', 'sans PIM'], ['#7a2a24', 'coupé'], ['#4a5560', 'sans trafic']].map(([c, t]) => el('span', {}, el('i', { style: { background: c } }), t)), el('span', {}, 'Pastilles d\'un appareil : carte rouge à gauche, carte bleue à droite. Cliquez un élément pour voir son état ; cliquez de nouveau un commutateur sélectionné pour le configurer.'));
  const terms = el('div', { class: 'net-terms' }, el('span', { class: 'note' }, 'Sur ce schéma :'), ...TOPO_TERMS.map((id) => el('span', { class: 'net-term', 'data-qterm': id }, TERMS[id].t)));
  box.append(el('div', { class: 'synwrap net-svgwrap' }, svg), legend, terms, selPanel(R));
  box.append(el('p', { class: 'note' }, `Chaque réseau est une fabric « spine-leaf » : les leaves (commutateurs de haut de baie) reçoivent les appareils en 25 GbE (100 GbE pour les gros flux), et chacune est reliée aux deux spines par 2 × 100 GbE. Tout appareil émet chaque flux deux fois, une fois par réseau (ST 2022-7) : les deux réseaux sont totalement indépendants (pas de lien entre eux). Un flux vidéo ${S.format === 'UHD' ? 'UHD 2160p50' : S.format === 'HD' ? 'HD 1080p50' : 'HD 1080i50'} fait ≈ ${fmt(videoGbps(), 2)} Gb/s.`));
}
const TOPO_TERMS = ['spine-leaf', 'spine', 'leaf', 'uplink', 'reseaux-ab', 'st2022-7', 'grand-maitre', 'bc', 'reseau-ctl', 'interface-media', 'ecmp'];
function shortName(d, w) { const n = d.name.replace('Passerelle ', 'Pass. ').replace('Multiviewer', 'MV').replace('Encodeur ', '').replace(' (cœur DSP)', '').replace('Grade 1 + scopes', 'Grade 1').replace('Décodeurs retour / duplex', 'Décodeurs').replace('Générateur de test', 'Générateur').replace('Unité de commentaire', 'Commentaire').replace('Stagebox terrain', 'Stagebox').replace(' caméras HF / POV / PTZ', ' HF/POV/PTZ').replace(' écrans d\'angle', ' écrans'); const max = Math.floor(w / 6.6); return n.length > max ? n.slice(0, max - 1) + '…' : n; }
function selPanel(R) {
  const s = V.sel; const p = el('div', { class: 'hwpanel' });
  if (!s) { p.append(el('h3', {}, 'Sélection'), el('p', { class: 'note' }, 'Cliquez un commutateur, un lien, un appareil ou un grand maître pour voir son état.')); return p; }
  const kv = el('dl', { class: 'kv' }); const add = (k, v, cls) => kv.append(el('dt', {}, k), el('dd', { class: cls || '' }, v));
  if (s.kind === 'sw') {
    const sw = FAB.switches[s.id];
    p.append(el('h3', {}, `${sw.running.hostname} · ${sw.model}`));
    add('Rôle', sw.role === 'spine' ? 'spine (cœur de la fabric)' : sw.role === 'leaf' ? `leaf ${sw.zoneName} (haut de baie)` : 'contrôle / gestion');
    add('Alimentation', sw.power ? 'sous tension' : 'HORS TENSION', sw.power ? '' : 'err');
    if (sw.loopback) add('Loopback / router-id', sw.loopback); add('Gestion (OOB)', sw.mgmt);
    if (sw.role === 'leaf') add('VLAN média', `${vlanOf(sw.color, sw.k)} · ${subnetOf(sw.color, sw.k)} · passerelle ${sviIp(sw.color, sw.k)}`);
    const is = FAB.issues.filter((i) => i.sw === s.id);
    add('Alarmes', is.length ? is.map((i) => i.title).join(' · ') : 'aucune', is.some((i) => i.sev === 'err') ? 'err' : is.length ? 'warn' : '');
    p.append(kv, el('div', { class: 'hwrow' }, el('button', { class: 'btn small primary', onclick: () => R.go('switch', { sw: s.id }) }, 'Configurer ce commutateur'), el('button', { class: 'btn small', onclick: () => R.go('switch', { sw: s.id, sub: 'term' }) }, 'Terminal (CLI)')));
  } else if (s.kind === 'link') {
    const l = FAB.links.find((x) => x.id === s.id); const st = FAB.res.up[l.id]; const L = FAB.res.linkLoad;
    p.append(el('h3', {}, `Uplink ${host(l.a.sw)} ${ifShort(l.a.port)} ↔ ${host(l.b.sw)} ${ifShort(l.b.port)}`));
    add('Couche 1', st.up ? `${st.speed} GbE · FEC ${st.pa.fec === 'auto' ? 'RS (auto)' : st.pa.fec}` : 'COUPÉ : ' + st.reason, st.up ? '' : 'err');
    if (st.up) { add('OSPF', st.ospf, st.ospf === 'FULL' ? '' : 'warn'); add('PIM', st.pim ? 'voisin établi' : 'aucun voisin', st.pim ? '' : 'warn'); add('PTP', st.ptp ? 'actif' : 'inactif', st.ptp ? '' : 'warn'); }
    add('Adresses /31', `${(st.pa || FAB.switches[l.a.sw].running.ports[l.a.port]).ip || '—'} ↔ ${(st.pb || FAB.switches[l.b.sw].running.ports[l.b.port]).ip || '—'}`);
    add('Charge leaf → spine', `${fmtG((L[l.id + ':up'] || {}).load || 0)} (${(L[l.id + ':up'] || {}).n || 0} flux)`); add('Charge spine → leaf', `${fmtG((L[l.id + ':down'] || {}).load || 0)} (${(L[l.id + ':down'] || {}).n || 0} flux)`);
    p.append(kv, el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => R.go('switch', { sw: l.a.sw, port: l.a.port, sub: 'ports' }) }, `Port ${ifShort(l.a.port)} de ${host(l.a.sw)}`), el('button', { class: 'btn small', onclick: () => R.go('switch', { sw: l.b.sw, port: l.b.port, sub: 'ports' }) }, `Port ${ifShort(l.b.port)} de ${host(l.b.sw)}`)));
  } else if (s.kind === 'dev' || s.kind === 'gm') {
    const d = FAB.devices[s.id];
    p.append(el('h3', {}, d.name));
    for (const c of COLORS) { const n = d.nics[c]; if (!n) continue; const st = FAB.res.nic[d.id + ':' + c] || {}; add(`Carte ${CLABEL[c]}`, `${host(n.sw)} ${ifShort(n.port)} · ${n.ip}/${n.mask} · passerelle ${n.gw} · ${!st.up ? 'LIEN COUPÉ' : st.reach ? 'joignable' : 'injoignable'}${st.why ? ' — ' + st.why : ''}${st.conflict ? ' — CONFLIT D\'ADRESSE' : ''}`, !st.up ? 'err' : !st.reach || st.conflict ? 'warn' : ''); }
    if (s.kind === 'gm') { const gm = FAB.gm[s.id]; add('État', gm.up ? (gm.gps ? 'GPS verrouillé (classe 6)' : 'GPS perdu, holdover (classe 7)') : 'hors service', gm.up ? '' : 'err'); add('priority1 / priority2', `${gm.priority1} / ${gm.priority2}`); add('Identité', clockId(s.id)); }
    else {
      const pt = FAB.res.devPtp[d.id];
      if (pt) add('PTP', `${pt.state === 'locked' ? 'verrouillé' : pt.state === 'noisy' ? 'verrouillé mais bruité' : pt.state === 'free' ? 'horloge non traçable' : 'non verrouillé'}${pt.offset != null ? ` · offset ≈ ${pt.offset} ns · ${pt.hops} sauts` : ''}${pt.why ? ' — ' + pt.why : ''}`, pt.state === 'locked' ? '' : pt.state === 'noisy' ? 'warn' : 'err');
      add('Contrôle', `${d.ctlIp} · SW-CTRL ${d.ctl.port} · NMOS ${FAB.res.reg[d.id] ? 'enregistré (IS-04)' : 'NON ENREGISTRÉ'}`, FAB.res.reg[d.id] ? '' : 'warn');
      add('Émetteurs', (d.senders || []).map((f) => FAB.flows[f].label).join(' · ') || '—');
      add('Récepteurs', (d.receivers || []).length ? `${d.receivers.length} (${d.receivers.slice(0, 4).map((r) => FAB.rx[r].label).join(', ')}${d.receivers.length > 4 ? '…' : ''})` : '—');
    }
    p.append(kv, el('div', { class: 'hwrow' }, ...COLORS.filter((c) => d.nics[c]).map((c) => el('button', { class: 'btn small', onclick: () => R.go('switch', { sw: d.nics[c].sw, port: d.nics[c].port, sub: 'ports' }) }, `Port ${CLABEL[c]} (${host(d.nics[c].sw)} ${ifShort(d.nics[c].port)})`)), s.kind === 'dev' && (d.receivers || []).length ? el('button', { class: 'btn small', onclick: () => R.go('flows', { rx: d.receivers[0] }) }, 'Ses réceptions') : null));
  }
  return p;
}

// ---------------- commutateurs ----------------
function guiSess(id) { return (V.gui[id] = V.gui[id] || cliSession(id)); }
function termLog(id) { return (V.term[id] = V.term[id] || { s: cliSession(id), lines: [{ t: 'out', s: `Connecté à ${host(id)} (${FAB.switches[id].mgmt}) — tapez « ? » pour la liste des commandes, Tab pour compléter.` }], hi: -1 }); }
// applique une modification par la ligne de commande (même moteur que le terminal)
function applyCli(id, lines, why) {
  const sw = FAB.switches[id]; if (!sw.power) { toast('Commutateur hors tension : allumez-le d\'abord', 'bad'); return false; }
  const s = guiSess(id); s.mode = 'exec'; s.ctx = null;
  const errs = [];
  for (const l of ['configure terminal', ...lines, 'end']) { const r = runCli(s, l); if (r && r.startsWith('%')) errs.push(`${l} → ${r}`); }
  const T = termLog(id); T.lines.push({ t: 'gui', s: `! interface graphique :\n${lines.join('\n')}` });
  if (errs.length) { toast(errs[0], 'bad'); explain(errs[0], 'warn'); return false; }
  log('gui', { sw: id, lines });
  explain(`${host(id)} : ${why} Équivalent CLI : configure terminal ⏎ ${lines.join(' ⏎ ')} ⏎ end (non enregistré tant que « write memory » n'est pas fait).`);
  return true;
}
function refreshSwitchFrame(R) { const f = R.content.querySelector('.net-swframe'); if (f) { const n = switchFrame(R); f.replaceWith(n); qify(n); } }
function tabSwitch(box, R) {
  if (!FAB.switches[V.sw]) V.sw = 'LEAF-R1';
  const list = el('div', { class: 'net-swlist' });
  for (const [t, ids] of [['Rouge', Object.keys(FAB.switches).filter((k) => FAB.switches[k].color === 'red')], ['Bleu', Object.keys(FAB.switches).filter((k) => FAB.switches[k].color === 'blue')], ['Contrôle', ['SW-CTRL']]]) {
    list.append(el('div', { class: 'net-swgrp ' + String(t).toLowerCase() }, t));
    for (const id of ids) {
      const sw = FAB.switches[id]; const dirty = JSON.stringify(sw.running) !== JSON.stringify(sw.startup);
      list.append(el('button', { class: 'net-swbtn' + (id === V.sw ? ' on' : ''), 'data-sw': id, onclick: () => { V.sw = id; V.port = sw.hw[0].name; log('swsel', { sw: id }); R.refresh(); } }, el('span', { class: dotCls(swLevel(sw)) }), sw.running.hostname, dirty ? el('i', { title: 'Configuration non enregistrée' }, '●') : null));
    }
  }
  const main = el('div', { class: 'net-swmain' }, switchFrame(R));
  const subs = [['ports', 'Interfaces'], ['vlan', 'VLAN · SVI'], ['route', 'Routage'], ['mcast', 'Multicast'], ['ptpc', 'PTP'], ['qos', 'QoS'], ['cfg', 'Configuration'], ['term', 'Terminal (CLI)']];
  const st = el('div', { class: 'tabs' }, ...subs.map(([k, l]) => el('button', { class: 'tab' + (V.sub === k ? ' on' : ''), 'data-sub': k, onclick: () => { V.sub = k; log('sub', { sub: k }); R.refresh(); } }, l)));
  const sub = el('div', { class: 'list' });
  main.append(st, sub);
  ({ ports: subPorts, vlan: subVlan, route: subRoute, mcast: subMcast, ptpc: subPtp, qos: subQos, cfg: subCfg, term: subTerm })[V.sub](sub, R);
  box.append(el('div', { class: 'net-swgrid' }, list, main));
}
function switchFrame(R) {
  const sw = FAB.switches[V.sw]; const dirty = JSON.stringify(sw.running) !== JSON.stringify(sw.startup);
  const head = el('div', { class: 'hwpanel net-swhead' },
    el('div', { class: 'hwrow' }, el('b', { class: 'net-host' }, sw.running.hostname), el('span', { class: 'note' }, `${sw.model} · gestion ${sw.mgmt}${sw.loopback ? ' · loopback ' + sw.loopback : ''}`), el('span', { class: 'pill ' + (sw.power ? 'ok' : 'err') }, sw.power ? 'SOUS TENSION' : 'HORS TENSION'), dirty ? el('span', { class: 'pill warn' }, 'running ≠ startup') : el('span', { class: 'pill ok' }, 'configuration enregistrée')),
    el('div', { class: 'hwrow' },
      el('button', { class: 'btn small', onclick: () => { setSwitchPower(sw.id, !sw.power); explain(sw.power ? `${sw.running.hostname} rallumé : il redémarre sur sa configuration de démarrage (startup-config). Ce qui n'avait pas été enregistré par « write memory » est perdu.` : `${sw.running.hostname} hors tension. ${sw.role === 'ctl' ? 'Le contrôle NMOS est perdu.' : `Les flux qui passaient par lui ne passent plus que par le réseau ${sw.color === 'red' ? 'bleu' : 'rouge'} : à l'image rien ne change (ST 2022-7), mais il n'y a plus de secours.`}`, sw.power ? 'warn' : ''); R.refresh(); } }, sw.power ? 'Couper l\'alimentation' : 'Rallumer'),
      el('button', { class: 'btn small' + (dirty ? ' primary' : ''), onclick: () => { writeMemory(sw.id); termLog(sw.id).lines.push({ t: 'gui', s: '! interface graphique :\nwrite memory' }); explain(`write memory : la configuration active (running-config) de ${sw.running.hostname} est copiée dans la configuration de démarrage (startup-config). Elle survivra à un redémarrage.`); R.refresh(); } }, 'Enregistrer (write memory)'),
      el('button', { class: 'btn small', onclick: () => { loadReference(sw.id); log('refload', { sw: sw.id }); explain(`Configuration de référence chargée dans la running-config de ${sw.running.hostname} (pensez à « write memory »).`); R.refresh(); } }, 'Charger la config de référence'),
      el('button', { class: 'btn small danger', onclick: async () => { if (!(await ask(`Remettre ${sw.running.hostname} en configuration usine ? (running-config seulement)`, { ok: 'Config usine', danger: true }))) return; loadFactory(sw.id); explain(`${sw.running.hostname} en configuration usine : plus de routage, de VLAN média, de PTP… Tout ce qui passait par lui est perdu. Exercice : reconstruire la configuration (ou recharger la référence).`, 'warn'); R.refresh(); } }, 'Config usine'),
      el('button', { class: 'btn small', onclick: () => offerDownload(`${sw.running.hostname}-running-config.txt`, runningConfig(sw)) }, 'Télécharger la config')));
  return el('div', { class: 'net-swframe' }, head, frontPanel(sw, R));
}
function ledOf(sw, n) {
  const st = portState(sw.id, n);
  if (st.status === 'down') return ['#1d2228', 'hors tension'];
  if (st.status === 'disabled') return ['#3a3f46', 'shutdown'];
  if (st.status === 'notconnect') return st.peer ? ['#7a2a24', 'lien coupé : ' + st.reason] : ['#12161a', 'libre'];
  if (st.outL.cap && st.outL.load > st.outL.cap) return ['#ff3b30', 'saturé'];
  if (st.reason) return ['#ffb020', st.reason];
  return ['#2fd25a', 'connecté'];
}
function frontPanel(sw, R) {
  const hw = sw.hw; const q = hw.filter((h) => h.type === 'QSFP28'); const s = hw.filter((h) => h.type !== 'QSFP28');
  const pw = 24, gap = 4, qw = 34;
  const W = 76 + Math.ceil(s.length / 2) * (pw + gap) + (s.length ? 30 : 0) + Math.ceil(q.length / 2) * (qw + gap) + 20;
  const svg = sv('svg', { viewBox: `0 0 ${W} 92`, class: 'net-front', role: 'img', 'aria-label': 'Face avant du commutateur' });
  svg.append(sv('rect', { x: 0, y: 0, width: W, height: 92, rx: 4, fill: '#1a1f25', stroke: '#3a4652' }), sv('text', { x: 10, y: 15, class: 'nt-xs' }, sw.running.hostname + ' · ' + sw.model), sv('circle', { cx: 18, cy: 52, r: 4, fill: sw.power ? '#2fd25a' : '#333' }), sv('text', { x: 28, y: 55, class: 'nt-xs' }, 'PWR'));
  const port = (h, x, y, w) => {
    const [col, t] = sw.power ? ledOf(sw, h.name) : ['#1d2228', 'hors tension'];
    const n = +h.name.slice(8); const sel = V.port === h.name;
    const g = sv('g', { class: 'nt-port' }, sv('rect', { x, y, width: w, height: 22, rx: 2, fill: '#0b0e11', stroke: sel ? '#ffb020' : '#4a5560', 'stroke-width': sel ? 2 : 1 }), sv('rect', { x: x + 3, y: y + 3, width: w - 6, height: 4, fill: col }), sv('text', { x: x + w / 2, y: y + 18, class: 'nt-xs', 'text-anchor': 'middle' }, n), sv('title', {}, `${h.name} (${h.type}) — ${t}${sw.running.ports[h.name].desc ? ' — ' + sw.running.ports[h.name].desc : ''}`));
    g.addEventListener('click', () => { V.port = h.name; V.sub = 'ports'; R.refresh(); });
    svg.append(g);
  };
  let x = 76;
  for (let i = 0; i < s.length; i += 2) { port(s[i], x, 22, pw); if (s[i + 1]) port(s[i + 1], x, 58, pw); x += pw + gap; }
  if (s.length) x += 26;
  for (let i = 0; i < q.length; i += 2) { port(q[i], x, 22, qw); if (q[i + 1]) port(q[i + 1], x, 58, qw); x += qw + gap; }
  return el('div', { class: 'net-frontwrap' }, svg);
}
const PEER = (st) => { const p = st.peer; if (!p) return '—'; if (p.kind === 'link') return `${host(p.other.sw)} ${ifShort(p.other.port)}`; return p.dev.name + (p.kind === 'ctl' ? ' (contrôle)' : ''); };
function subPorts(box, R) {
  const sw = FAB.switches[V.sw]; const c = sw.running;
  if (!c.ports[V.port]) V.port = sw.hw[0].name;
  const n = V.port; const p = c.ports[n]; const h = sw.hw.find((x) => x.name === n); const st = portState(sw.id, n);
  const cmd = (lines, why) => {
    if (!applyCli(sw.id, lines, why)) return;
    evaluate();
    const r = portState(sw.id, n);
    explain(`Résultat sur ${n} : ${r.status === 'connected' ? (r.reason ? 'lien monté, mais ' + r.reason : 'lien monté, tout est normal') : r.status === 'disabled' ? 'port coupé (shutdown)' : r.peer ? 'LIEN COUPÉ — ' + r.reason : 'rien de raccordé'}.`, r.status === 'connected' && !r.reason ? 'ok' : r.peer ? 'warn' : '');
    R.refresh();
  };
  const I = (l) => [`interface ${n}`, ...l];
  const ed = el('div', { class: 'hwpanel' }, el('h3', {}, `Interface ${n} · ${h.type}`));
  const kv = el('dl', { class: 'kv' }); const add = (k, v, cls) => kv.append(el('dt', {}, k), el('dd', { class: cls || '' }, v));
  add('Raccordé à', PEER(st)); add('État', `${st.status}${st.reason ? ' — ' + st.reason : ''}`, st.status === 'connected' ? (st.reason ? 'warn' : '') : st.peer ? 'err' : '');
  add('Débit entrant / sortant', `${fmtG(st.inL.load)} / ${fmtG(st.outL.load)}${st.outL.cap ? ` (capacité ${st.outL.cap} Gb/s${st.outL.load > st.outL.cap ? ' — SATURÉ' : ''})` : ''}`, st.outL.cap && st.outL.load > st.outL.cap ? 'err' : '');
  if (st.peer && st.peer.kind === 'dev') add('Carte de l\'appareil', `${st.peer.dev.nics[st.peer.color].speeds.join(' / ')} · IP ${st.peer.dev.nics[st.peer.color].ip} · MTU 1500`);
  const ptpSt = sw.running.ptp.mode !== 'disabled' && FAB.res ? ptpPorts(sw)[n] : null; if (ptpSt && ptpSt !== '—') add('État PTP', ptpSt);
  const desc = el('input', { type: 'text', value: p.desc, 'aria-label': 'Description' }); desc.addEventListener('change', () => cmd(I([desc.value ? `description ${desc.value}` : 'no description']), 'description modifiée.'));
  const f = el('div', { class: 'grid2 net-form' },
    fld('Description', desc),
    fld('Administratif', selectEl([['up', 'no shutdown (actif)'], ['down', 'shutdown (coupé)']], p.shutdown ? 'down' : 'up', (v) => cmd(I([v === 'down' ? 'shutdown' : 'no shutdown']), v === 'down' ? 'port coupé administrativement : le lien tombe, l\'appareil ou la spine en face voit « link down ».' : 'port réactivé.'))),
    fld('Mode', selectEl([['access', 'accès (niveau 2)'], ['routed', 'routé (no switchport)'], ['trunk', 'trunk 802.1Q']], p.mode, (v) => cmd(I([v === 'routed' ? 'no switchport' : v === 'trunk' ? 'switchport mode trunk' : 'switchport mode access']), v === 'routed' ? 'port routé : il n\'appartient plus à aucun VLAN, il porte sa propre adresse IP (liens leaf ↔ spine en /31).' : v === 'trunk' ? 'port trunk : il transporte plusieurs VLAN étiquetés. Les appareils ST 2110 de ce car attendent un port d\'accès non étiqueté.' : 'port d\'accès : l\'appareil est dans un seul VLAN, sans étiquette.'))),
    p.mode === 'access' ? fld('VLAN d\'accès', selectEl(Object.entries(c.vlans).map(([id, v]) => [id, `${id} · ${v.name}`]).concat(c.vlans[p.vlan] ? [] : [[p.vlan, `${p.vlan} (inexistant)`]]), p.vlan, (v) => cmd(I([`switchport access vlan ${v}`]), `port placé dans le VLAN ${v}. ${sw.role === 'leaf' ? `L'appareil n'atteint sa passerelle que dans le VLAN média de cette leaf (${vlanOf(sw.color, sw.k)}).` : ''}`))) : null,
    fld('Vitesse', selectEl(h.speeds.map((s) => [s, s.toUpperCase()]), p.speed, (v) => cmd(I([`speed ${v}`]), `vitesse forcée à ${v.toUpperCase()}. Le lien ne monte que si l'autre extrémité (carte de l'appareil, optique, port de la spine) fonctionne à la même vitesse.`))),
    fld('FEC', selectEl([['auto', 'auto'], ['rs', 'Reed-Solomon (RS-FEC)'], ['fc', 'Fire-code (BASE-R)'], ['none', 'aucune']], p.fec, (v) => cmd(I([v === 'auto' ? 'default error-correction encoding' : v === 'none' ? 'no error-correction encoding' : `error-correction encoding ${v === 'rs' ? 'reed-solomon' : 'fire-code'}`]), 'correction d\'erreurs modifiée. À 25G et 100G, les optiques courtes (SR) attendent la RS-FEC : une FEC différente aux deux bouts empêche le lien de monter.'))),
    fld('MTU (octets)', numIn(p.mtu, 68, 9214, (v) => cmd(I([`mtu ${v}`]), `MTU ${v}. Les paquets RTP ST 2110 font ≈ 1 400 à 1 500 octets : en dessous de 1 500 ils sont jetés. Sur un uplink, la MTU doit être identique des deux côtés, sinon OSPF reste bloqué en EXSTART.`))),
    p.mode === 'routed' ? fld('Adresse IP', ipIn(p.ip, true, (v) => cmd(I([v ? `ip address ${v}` : 'no ip address']), 'adresse du port routé modifiée. Un lien point à point leaf ↔ spine utilise un /31 : les deux adresses doivent être dans le même /31.'))) : null,
    p.mode === 'routed' ? chk('PIM sparse-mode', p.pim, (v) => cmd(I([v ? 'pim ipv4 sparse-mode' : 'no pim ipv4 sparse-mode']), v ? 'PIM activé : le port établit un voisinage PIM et peut porter des jonctions (S,G).' : 'PIM retiré : aucun flux multicast ne passera par ce lien.')) : null,
    p.mode === 'routed' ? chk('OSPF area 0', p.ospf, (v) => cmd(I([v ? 'ip ospf area 0.0.0.0' : 'no ip ospf area']), v ? 'interface annoncée dans OSPF.' : 'interface retirée d\'OSPF : plus de voisin sur ce lien, le trafic passe par les autres uplinks (ECMP).')) : null,
    chk('PTP (ptp enable)', p.ptp, (v) => cmd(I([v ? 'ptp enable' : 'no ptp enable']), v ? 'PTP actif sur le port : le commutateur (horloge frontière) y échange Announce / Sync / Delay_Req.' : 'PTP désactivé sur ce port : l\'appareil raccordé ne reçoit plus l\'heure PTP de ce réseau.')),
    fld('Rôle PTP', selectEl([['dynamic', 'dynamique (BMCA)'], ['master', 'maître forcé (ptp role master)']], p.ptpRole, (v) => cmd(I([v === 'master' ? 'ptp role master' : 'no ptp role']), v === 'master' ? 'port maître forcé : il ignore les annonces de l\'appareil raccordé. Protection contre un appareil qui se prendrait pour un grand maître. À ne jamais mettre sur le port d\'un vrai grand maître !' : 'rôle PTP dynamique : l\'algorithme BMCA décide de l\'état du port.'))));
  ed.append(kv, f);
  // tableau des ports
  const tb = el('tbody');
  for (const hh of sw.hw) {
    const pp = c.ports[hh.name]; const s2 = portState(sw.id, hh.name);
    if (V.onlyConn && !s2.peer && hh.name !== n) continue;
    const [col] = sw.power ? ledOf(sw, hh.name) : ['#1d2228'];
    tb.append(el('tr', { class: hh.name === n ? 'sel' : '', onclick: () => { V.port = hh.name; R.refresh(); } },
      el('td', { class: 'mono' }, el('i', { class: 'net-led', style: { background: col } }), ifShort(hh.name)), el('td', {}, pp.desc || '—'), el('td', {}, PEER(s2)), el('td', { class: s2.status === 'connected' ? (s2.reason ? 'warn' : 'ok') : s2.peer ? 'err' : '' }, s2.status + (s2.reason ? ' · ' + s2.reason : '')),
      el('td', { class: 'mono' }, pp.mode === 'routed' ? 'routé ' + (pp.ip || '') : pp.mode === 'trunk' ? 'trunk' : 'VLAN ' + pp.vlan), el('td', { class: 'mono' }, pp.speed.toUpperCase()), el('td', { class: 'mono' }, pp.fec), el('td', { class: 'mono' }, pp.mtu), el('td', { class: 'mono' }, pp.ptp ? (pp.ptpRole === 'master' ? 'M' : 'dyn') : '—'), el('td', { class: 'mono' }, fmtG(s2.inL.load)), el('td', { class: 'mono' + (s2.outL.cap && s2.outL.load > s2.outL.cap ? ' err' : '') }, fmtG(s2.outL.load))));
  }
  const only = el('input', { type: 'checkbox' }); only.checked = V.onlyConn; only.addEventListener('change', () => { V.onlyConn = only.checked; R.refresh(); });
  box.append(ed, el('div', { class: 'hwpanel' }, el('div', { class: 'hwrow' }, el('h3', {}, 'Ports'), el('label', { class: 'note' }, only, ' ports raccordés seulement')),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact net-tbl' }, el('thead', {}, el('tr', {}, ...['Port', 'Description', 'Raccordé à', 'État', 'Mode', 'Vitesse', 'FEC', 'MTU', 'PTP', 'Entrée', 'Sortie'].map((x) => el('th', {}, x)))), tb))));
}
function fld(label, input) { const id = 'n' + Math.random().toString(36).slice(2, 8); input.id = id; return el('div', { class: 'field' }, el('label', { for: id }, label), input); }
function chk(label, v, on) { const id = 'n' + Math.random().toString(36).slice(2, 8); const c = el('input', { type: 'checkbox', id }); c.checked = !!v; c.addEventListener('change', () => on(c.checked)); return el('label', { class: 'item net-chk', for: id }, c, el('span', {}, label)); }
function numIn(v, min, max, on) { const i = el('input', { type: 'number', value: v, min, max }); i.addEventListener('change', () => { const x = Math.round(+i.value); if (!(x >= min && x <= max)) { toast(`Valeur entre ${min} et ${max}`, 'bad'); i.value = v; return; } on(x); }); return i; }
function ipIn(v, cidr, on, ph) { const i = el('input', { type: 'text', value: v, placeholder: ph || (cidr ? 'a.b.c.d/len' : 'a.b.c.d'), spellcheck: 'false' }); i.addEventListener('change', () => { const x = i.value.trim(); if (x && !(cidr ? /^\d+\.\d+\.\d+\.\d+\/\d+$/.test(x) && ipToInt(x.split('/')[0]) != null && +x.split('/')[1] <= 32 : ipToInt(x) != null)) { toast('Adresse invalide', 'bad'); i.value = v; return; } on(x); }); return i; }
function pre(text) { return el('pre', { class: 'net-pre' }, text); }
const showOut = (id, c) => { const s = cliSession(id); return runCli(s, c); };
function subVlan(box, R) {
  const sw = FAB.switches[V.sw]; const c = sw.running;
  const cmd = (lines, why) => { if (applyCli(sw.id, lines, why)) R.refresh(); };
  const tb = el('tbody');
  for (const [id, v] of Object.entries(c.vlans)) {
    const name = el('input', { type: 'text', value: v.name, 'aria-label': 'Nom du VLAN ' + id }); name.addEventListener('change', () => cmd([`vlan ${id}`, `name ${name.value.replace(/\s+/g, '-')}`], `VLAN ${id} renommé.`));
    const ports = Object.values(c.ports).filter((p) => p.mode === 'access' && p.vlan === +id).length;
    tb.append(el('tr', {}, el('td', { class: 'mono' }, id), el('td', {}, name), el('td', {}, ports), el('td', {}, chk('snooping', v.snooping, (x) => cmd([`${x ? '' : 'no '}ip igmp snooping vlan ${id}`], x ? 'snooping IGMP actif : chaque flux ne sort que sur les ports qui l\'ont demandé (jonction IGMP).' : 'snooping IGMP désactivé sur ce VLAN : tout flux multicast y est inondé sur tous les ports !'))),
      el('td', {}, chk('querier L2', v.querier, (x) => cmd([`${x ? '' : 'no '}ip igmp snooping vlan ${id} querier`], x ? 'querier IGMP de niveau 2 : il envoie les « General Query » qui entretiennent les abonnements, même sans SVI.' : 'querier L2 retiré.'))),
      el('td', {}, +id === 1 ? '' : el('button', { class: 'btn small danger', onclick: () => cmd([`no vlan ${id}`], `VLAN ${id} supprimé : les ports qui y étaient affectés deviennent inactifs.`) }, 'Supprimer'))));
  }
  const nid = el('input', { type: 'number', min: 2, max: 4094, placeholder: 'ID', style: { width: '90px' } }); const nname = el('input', { type: 'text', placeholder: 'nom' });
  const tb2 = el('tbody');
  for (const [id, v] of Object.entries(c.svis)) {
    tb2.append(el('tr', {}, el('td', { class: 'mono' }, 'Vlan' + id), el('td', {}, ipIn(v.ip, true, (x) => cmd([`interface Vlan${id}`, x ? `ip address ${x}` : 'no ip address'], 'adresse de la passerelle (SVI) modifiée : les appareils du VLAN doivent l\'avoir comme passerelle et être dans le même sous-réseau.'))),
      el('td', {}, selectEl([['0', 'désactivé'], ['2', 'IGMPv2'], ['3', 'IGMPv3']], v.igmp, (x) => cmd([`interface Vlan${id}`, +x ? `ip igmp version ${x}` : 'no ip igmp'], +x === 3 ? 'IGMPv3 : les récepteurs peuvent demander un flux (S,G) précis — indispensable en SSM.' : +x === 2 ? 'IGMPv2 : les jonctions (S,G) des récepteurs ST 2110 sont refusées, la SVI ne connaît que (*,G).' : `plus d'IGMP sur la SVI : plus de querier. Les abonnements vont expirer (${QUERIER_TIMEOUT} s ici, ≈ 260 s en réalité).`))),
      el('td', {}, chk('PIM', v.pim, (x) => cmd([`interface Vlan${id}`, x ? 'pim ipv4 sparse-mode' : 'no pim ipv4 sparse-mode'], x ? 'PIM actif sur la SVI : les sources de ce VLAN peuvent être jointes depuis les autres leaves.' : 'PIM retiré de la SVI : les flux de ce VLAN ne sortent plus de la leaf (échec RPF ailleurs).'))),
      el('td', {}, chk('OSPF', v.ospf, (x) => cmd([`interface Vlan${id}`, x ? 'ip ospf area 0.0.0.0' : 'no ip ospf area'], x ? 'sous-réseau annoncé en OSPF.' : 'sous-réseau retiré d\'OSPF : les autres leaves n\'ont plus de route vers ces sources (échec RPF).'))),
      el('td', {}, chk('shutdown', v.shutdown, (x) => cmd([`interface Vlan${id}`, x ? 'shutdown' : 'no shutdown'], x ? 'SVI coupée : les appareils perdent leur passerelle.' : 'SVI réactivée.')))));
  }
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'VLAN'), el('p', { class: 'note' }, sw.role === 'leaf' ? `Règle du car : VLAN média = 100 × réseau (1 rouge, 2 bleu) + numéro de leaf → ici ${vlanOf(sw.color, sw.k)}. Un VLAN par leaf : le domaine de diffusion reste local, tout ce qui sort de la leaf est routé (couche 3).` : sw.role === 'ctl' ? 'VLAN 10 : gestion hors bande (OOB) des commutateurs et des grands maîtres. VLAN 20 : contrôle (NMOS, RCP, panneaux).' : 'Les spines n\'ont aucun VLAN média : tous leurs ports sont routés.'),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact net-tbl' }, el('thead', {}, el('tr', {}, ...['ID', 'Nom', 'Ports', 'Snooping IGMP', 'Querier', ''].map((x) => el('th', {}, x)))), tb)),
    el('div', { class: 'hwrow' }, nid, nname, el('button', { class: 'btn small', onclick: () => { const id = +nid.value; if (!(id >= 2 && id <= 4094)) { toast('ID de VLAN entre 2 et 4094', 'bad'); return; } cmd([`vlan ${id}`, ...(nname.value ? [`name ${nname.value.replace(/\s+/g, '-')}`] : [])], `VLAN ${id} créé.`); } }, 'Créer le VLAN'))),
  el('div', { class: 'hwpanel' }, el('h3', {}, 'Interfaces VLAN (SVI = passerelle des appareils)'), Object.keys(c.svis).length ? el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact net-tbl' }, el('thead', {}, el('tr', {}, ...['Interface', 'Adresse', 'IGMP (querier)', 'PIM', 'OSPF', 'État'].map((x) => el('th', {}, x)))), tb2)) : el('p', { class: 'note' }, 'Aucune SVI.'), sw.role === 'leaf' ? el('button', { class: 'btn small', onclick: () => cmd([`interface Vlan${vlanOf(sw.color, sw.k)}`, `ip address ${sviIp(sw.color, sw.k)}/24`, 'ip igmp version 3', 'pim ipv4 sparse-mode', 'ip ospf area 0.0.0.0', 'no shutdown'], 'SVI média reconstruite selon la référence.') }, `Recréer la SVI Vlan${vlanOf(sw.color, sw.k)} de référence`) : null));
}
function subRoute(box, R) {
  const sw = FAB.switches[V.sw]; const c = sw.running;
  const cmd = (lines, why) => { if (applyCli(sw.id, lines, why)) R.refresh(); };
  const rid = ipIn(c.ospf.routerId, false, (x) => cmd(['router ospf 1', `router-id ${x}`], 'router-id OSPF modifié (on prend la loopback : unique et toujours active).'));
  const lo = ipIn(c.loopback, false, (x) => cmd(['interface Loopback0', x ? `ip address ${x}/32` : 'no ip address'], 'adresse de loopback modifiée.'));
  const ssm = ipIn(c.ssmRange, true, (x) => cmd([x ? `ip pim ssm range ${x}` : 'no ip pim ssm range'], `plage SSM = ${x || '232.0.0.0/8 (défaut)'}. Les groupes ST 2110 du car sont en 239.x.y.z : hors de la plage SSM ils sont traités en ASM, qui demande un point de rendez-vous (RP) absent ici.`));
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Routage (underlay)'),
    el('div', { class: 'grid2 net-form' }, chk('ip routing', c.ipRouting, (x) => cmd([x ? 'ip routing' : 'no ip routing'], x ? 'routage IP actif.' : 'routage IP désactivé : le commutateur ne route plus rien, plus de voisins OSPF.')),
      chk('OSPF (router ospf 1)', c.ospf.enabled, (x) => cmd([x ? 'router ospf 1' : 'no router ospf 1'], x ? 'OSPF actif.' : 'OSPF supprimé : plus de routes vers les autres leaves.')), fld('Router-ID', rid), fld('Loopback0', lo),
      chk('ip multicast-routing', c.mcastRouting, (x) => cmd([x ? 'ip multicast-routing' : 'no ip multicast-routing'], x ? 'routage multicast actif (PIM).' : 'routage multicast désactivé : plus aucun flux ne traverse ce commutateur.')), fld('Plage PIM-SSM', ssm)),
    el('p', { class: 'note' }, 'Underlay : chaque lien leaf ↔ spine est un sous-réseau /31 routé, OSPF zone 0 annonce les loopbacks et les sous-réseaux média, et répartit le trafic sur les 4 uplinks (ECMP). Le multicast est routé en PIM-SSM : le récepteur demande « tel flux de telle source » (S,G), sans point de rendez-vous.')),
  el('div', { class: 'hwpanel' }, el('h3', {}, 'show ip ospf neighbor'), pre(showOut(sw.id, 'show ip ospf neighbor'))),
  el('div', { class: 'hwpanel' }, el('h3', {}, 'show ip route'), pre(showOut(sw.id, 'show ip route'))));
}
function subMcast(box, R) {
  const sw = FAB.switches[V.sw]; const c = sw.running;
  const cmd = (lines, why) => { if (applyCli(sw.id, lines, why)) R.refresh(); };
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'IGMP snooping et querier'),
    chk('ip igmp snooping (global)', c.igmpSnooping, (x) => cmd([x ? 'ip igmp snooping' : 'no ip igmp snooping'], x ? 'snooping IGMP actif.' : 'snooping désactivé : chaque flux multicast est inondé sur tous les ports du VLAN. Les cartes 25 GbE débordent !')),
    pre(showOut(sw.id, 'show ip igmp snooping querier')), el('p', { class: 'note' }, `Le querier envoie régulièrement des « General Query » ; les récepteurs y répondent par leurs rapports IGMPv3 (S,G). Sans querier, les entrées du snooping expirent (≈ 260 s en réalité, ${QUERIER_TIMEOUT} s dans le simulateur) et les flux s'arrêtent… plusieurs minutes après la vraie cause.`)),
  el('div', { class: 'hwpanel' }, el('h3', {}, 'show ip igmp snooping groups'), pre(showOut(sw.id, 'show ip igmp snooping groups'))),
  el('div', { class: 'hwpanel' }, el('h3', {}, 'show ip mroute'), pre(showOut(sw.id, 'show ip mroute'))));
}
function subPtp(box, R) {
  const sw = FAB.switches[V.sw]; const c = sw.running; const P = c.ptp;
  const cmd = (lines, why) => { if (applyCli(sw.id, lines, why)) R.refresh(); };
  const iv = (k, label, cliK) => fld(label, selectEl([-4, -3, -2, -1, 0, 1].map((x) => [x, `${x} (${x < 0 ? '1/' + 2 ** -x : 2 ** x} s)`]), P[k], (x) => cmd([`ptp ${cliK} interval ${x}`], `${label} = 2^${x} s.${+x !== PTP_REF[k] ? ` ST 2059-2 recommande ${PTP_REF[k]}.` : ''}`)));
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'PTP (IEEE 1588 · SMPTE ST 2059-2)'),
    el('div', { class: 'grid2 net-form' },
      fld('Mode', selectEl([['boundary', 'horloge frontière (BC)'], ['transparent', 'transparente (E2E TC)'], ['disabled', 'désactivé']], P.mode, (x) => cmd([x === 'disabled' ? 'no ptp mode' : `ptp mode ${x === 'transparent' ? 'e2etransparent' : x}`], x === 'boundary' ? 'horloge frontière : le commutateur se cale sur son maître (port esclave) et redistribue l\'heure sur ses autres ports (maître). Il isole les appareils des variations du réseau.' : x === 'transparent' ? 'horloge transparente : le commutateur corrige le temps de traversée dans les messages, sans se caler lui-même.' : 'PTP désactivé : les appareils raccordés perdent leur référence sur ce réseau.'))),
      fld('Profil', selectEl([['smpte2059-2', 'SMPTE ST 2059-2'], ['aes67', 'AES67 media'], ['default', 'IEEE 1588 par défaut']], P.profile, (x) => cmd([`ptp profile ${x}`], x === 'smpte2059-2' ? 'profil ST 2059-2 : domaine 127, Announce 2^-2 s, Sync 2^-3 s.' : 'profil changé : les intervalles par défaut ne sont plus ceux attendus par les appareils ST 2110.'))),
      fld('Domaine', numIn(P.domain, 0, 255, (x) => cmd([`ptp domain ${x}`], `domaine ${x}. ${x !== PTP_REF.domain ? 'Les appareils et les autres commutateurs sont en 127 : ce commutateur n\'entend plus le grand maître et devient sa propre horloge.' : 'Domaine ST 2059-2 standard.'}`))),
      fld('priority1', numIn(P.priority1, 0, 255, (x) => cmd([`ptp priority1 ${x}`], 'priority1 du commutateur (utile seulement s\'il pouvait devenir grand maître).'))),
      iv('announce', 'Announce', 'announce'), iv('sync', 'Sync', 'sync-message'), iv('delayReq', 'Delay_Req', 'delay-req'))),
  el('div', { class: 'hwpanel' }, el('h3', {}, 'show ptp'), pre(showOut(sw.id, 'show ptp')), el('h3', {}, 'show ptp interface brief'), pre(showOut(sw.id, 'show ptp interface brief'))));
}
function subQos(box, R) {
  const sw = FAB.switches[V.sw]; const q = sw.running.qos;
  const cmd = (lines, why) => { if (applyCli(sw.id, lines, why)) R.refresh(); };
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Qualité de service'),
    chk('qos trust dscp', q.trust === 'dscp', (x) => cmd([x ? 'qos trust dscp' : 'no qos trust'], x ? 'le commutateur respecte le marquage DSCP posé par les appareils.' : 'DSCP ignoré : PTP, audio et vidéo partagent la même file.')),
    chk('PTP (DSCP 46) en file prioritaire', q.ptpPriority, (x) => cmd([x ? 'qos map dscp 46 to traffic-class 7' : 'no qos map dscp 46'], x ? 'PTP passe avant la vidéo dans chaque file de sortie : sa latence reste constante.' : 'PTP dans la file par défaut : derrière des rafales de paquets vidéo, son temps de traversée varie (gigue de plusieurs centaines de ns).')),
    pre(showOut(sw.id, 'show qos maps')),
    el('p', { class: 'note' }, `Plan DSCP du car (à vérifier avec votre intégrateur) : PTP ${DSCP_REF.ptp} (EF), audio ${DSCP_REF.audio} (AF41), vidéo ${DSCP_REF.video} (AF31), données ${DSCP_REF.anc} (AF21), contrôle ${DSCP_REF.ctl} (CS2). AES67 recommande EF pour PTP et AF41 pour l'audio.`)));
}
function lcsDiff(a, b) {
  const n = a.length, m = b.length; const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { out.push([' ', a[i]]); i++; j++; } else if (dp[i + 1][j] >= dp[i][j + 1]) out.push(['-', a[i++]]); else out.push(['+', b[j++]]); }
  while (i < n) out.push(['-', a[i++]]); while (j < m) out.push(['+', b[j++]]);
  return out;
}
function subCfg(box) {
  const sw = FAB.switches[V.sw];
  const run = runningConfig(sw), start = runningConfig(sw, null, true);
  const d = lcsDiff(start.split('\n'), run.split('\n'));
  const ctx = []; d.forEach((x, i) => { if (x[0] !== ' ') for (let k = Math.max(0, i - 2); k <= Math.min(d.length - 1, i + 2); k++) ctx[k] = true; });
  const diff = el('pre', { class: 'net-pre net-diff' });
  let gap = false;
  d.forEach((x, i) => { if (!ctx[i]) { if (!gap) { diff.append('   …\n'); gap = true; } return; } gap = false; diff.append(el('span', { class: x[0] === '+' ? 'add' : x[0] === '-' ? 'del' : '' }, `${x[0]} ${x[1]}\n`)); });
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Différences running ↔ startup'), d.some((x) => x[0] !== ' ') ? diff : el('p', { class: 'note' }, 'Aucune : la configuration active est enregistrée.')),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'show running-config'), pre(run)));
}
function subTerm(box, R) {
  const T = termLog(V.sw);
  const out = el('pre', { class: 'net-term', 'aria-live': 'polite' });
  const prompt = el('span', { class: 'net-prompt' });
  const inp = el('input', { type: 'text', class: 'net-cmd', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Commande' });
  const draw = () => {
    out.innerHTML = '';
    for (const l of T.lines.slice(-400)) out.append(el('span', { class: 'tl-' + l.t }, l.s + '\n'));
    prompt.textContent = cliPrompt(T.s) + ' ';
    out.scrollTop = out.scrollHeight;
  };
  const run = (c) => {
    T.lines.push({ t: 'cmd', s: cliPrompt(T.s) + ' ' + c });
    T.s.lastCmd = null;
    const r = runCli(T.s, c); if (r) T.lines.push({ t: r.startsWith('%') ? 'err' : 'out', s: r });
    log('cli', { sw: V.sw, pat: T.s.lastCmd, raw: c, ok: !!T.s.lastCmd && !(r || '').startsWith('%') });
    T.hi = -1; draw(); drawSummary(R.content.parentNode.querySelector('.net-sum')); refreshSwitchFrame(R);
  };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const c = inp.value; inp.value = ''; if (c.trim() === 'clear') { T.lines = []; draw(); return; } run(c); }
    else if (e.key === 'Tab') { e.preventDefault(); inp.value = cliComplete(T.s, inp.value); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const h = T.s.hist; if (!h.length) return; T.hi = T.hi < 0 ? h.length - 1 : Math.max(0, T.hi - 1); inp.value = h[T.hi]; }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const h = T.s.hist; if (T.hi < 0) return; T.hi++; if (T.hi >= h.length) { T.hi = -1; inp.value = ''; } else inp.value = h[T.hi]; }
    else if (e.key === '?' && !e.ctrlKey) { e.preventDefault(); run(inp.value + '?'); }
    e.stopPropagation();
  });
  const quick = ['show interfaces status', 'show ip interface brief', 'show vlan', 'show ip ospf neighbor', 'show ip pim neighbor', 'show ip route', 'show ip mroute', 'show ip igmp snooping groups', 'show ptp', 'show ptp parent', 'show lldp neighbors', 'show logging', 'show running-config | section Vlan', 'write memory'];
  box.append(el('div', { class: 'hwpanel net-termbox' }, out, el('div', { class: 'net-cmdrow' }, prompt, inp),
    el('div', { class: 'hwrow' }, ...quick.map((q) => el('button', { class: 'btn small net-q', onclick: () => { run(q); inp.focus(); } }, q))),
    el('p', { class: 'note' }, 'Syntaxe proche d\'Arista EOS / Cisco NX-OS, simplifiée. Mots abrégés acceptés (sh int st, conf t, int e1, wr). « ? » liste les suites possibles, Tab complète, ↑ ↓ rappellent l\'historique, « | include », « | section » filtrent la sortie, « do » exécute une commande exec en mode config. Exemple : conf t ⏎ int e5 ⏎ speed 10g ⏎ end ⏎ wr'), cheatSheet()));
  draw();
  setTimeout(() => inp.focus(), 30);
}

// antisèche : mêmes opérations chez trois constructeurs courants
const CHEAT = [
  ['État des ports', 'show interfaces status', 'show interface status', 'show interfaces status'],
  ['Voisins OSPF', 'show ip ospf neighbor', 'show ip ospf neighbors', 'show ip ospf neighbor'],
  ['Voisins PIM', 'show ip pim neighbor', 'show ip pim neighbor', 'show ip pim neighbor'],
  ['Routes multicast (S,G)', 'show ip mroute', 'show ip mroute', 'show ip mroute'],
  ['Abonnements IGMP', 'show ip igmp snooping groups', 'show ip igmp snooping groups', 'show ip igmp snooping groups'],
  ['PTP : maître et grand maître', 'show ptp parent', 'show ptp parent', 'show ptp parent'],
  ['Voisins LLDP', 'show lldp neighbors', 'show lldp neighbors', 'show lldp neighbors'],
  ['Enregistrer', 'write memory', 'copy running-config startup-config', 'write memory'],
  ['Port routé', 'no switchport', 'no switchport', 'no switchport'],
  ['PIM sur une interface', 'pim ipv4 sparse-mode', 'ip pim sparse-mode', 'ip pim sparse-mode'],
  ['OSPF sur une interface', 'ip ospf area 0.0.0.0', 'ip router ospf 1 area 0.0.0.0', 'ip ospf 1 area 0'],
  ['Version IGMP', 'ip igmp version 3', 'ip igmp version 3', 'ip igmp version 3'],
  ['Port miroir (SPAN)', 'monitor session 1 source Ethernet53', 'monitor session 1 ⏎ source interface ethernet1/53', 'monitor session 1 source interface Te1/0/53'],
];
function cheatSheet() {
  const tb = el('tbody'); for (const r of CHEAT) tb.append(el('tr', {}, el('td', {}, r[0]), ...r.slice(1).map((c) => el('td', { class: 'mono' }, c))));
  return el('details', { class: 'net-cheat' }, el('summary', {}, 'Antisèche : la même commande chez Arista (EOS), Cisco NX-OS et Cisco IOS-XE'),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact net-tbl' }, el('thead', {}, el('tr', {}, ...['Opération', 'Arista EOS', 'Cisco NX-OS', 'Cisco IOS-XE'].map((h) => el('th', {}, h)))), tb)),
    el('p', { class: 'note' }, 'Le simulateur accepte la syntaxe EOS et plusieurs variantes NX-OS (ip pim sparse-mode, ip router ospf 1 area…, show ip ospf neighbors, copy running-config startup-config). Les noms d\'interfaces et certains détails varient selon les modèles et les versions : vérifiez toujours dans la documentation de votre constructeur.'));
}

// ---------------- plan d'adressage ----------------
function tabAddr(box) {
  const t1 = el('tbody');
  for (const L of LEAVES) t1.append(el('tr', {}, el('td', {}, `leaf ${L.k} · ${L.name}`), el('td', { class: 'mono red' }, vlanOf('red', L.k)), el('td', { class: 'mono' }, subnetOf('red', L.k)), el('td', { class: 'mono' }, sviIp('red', L.k)), el('td', { class: 'mono blue' }, vlanOf('blue', L.k)), el('td', { class: 'mono' }, subnetOf('blue', L.k)), el('td', { class: 'mono' }, sviIp('blue', L.k)), el('td', { class: 'mono' }, `239.1.${L.k}.x / 239.2.${L.k}.x`)));
  const t2 = el('tbody');
  for (const sw of Object.values(FAB.switches)) t2.append(el('tr', {}, el('td', { class: 'mono' }, sw.running.hostname), el('td', {}, sw.role === 'ctl' ? 'contrôle' : `${sw.role} ${CLABEL[sw.color]}`), el('td', { class: 'mono' }, sw.loopback || '—'), el('td', { class: 'mono' }, sw.mgmt), el('td', {}, sw.model)));
  const t3 = el('tbody');
  for (const c of COLORS) for (const L of LEAVES) for (const s of [1, 2]) for (const j of [0, 1]) { const a = p2p(c, L.k, s, j); t3.append(el('tr', {}, el('td', { class: 'mono' }, `leaf-${c[0]}${L.k} Et${49 + (s - 1) * 2 + j}`), el('td', { class: 'mono' }, a.leaf + '/31'), el('td', { class: 'mono' }, `spine-${c[0]}${s} Et${(L.k - 1) * 2 + j + 1}`), el('td', { class: 'mono' }, a.spine + '/31'))); }
  for (const c of COLORS) for (const s of [1, 2]) { const g = gmNet(c, s); t3.append(el('tr', {}, el('td', { class: 'mono' }, `spine-${c[0]}${s} Et31`), el('td', { class: 'mono' }, g.sw + '/30'), el('td', { class: 'mono' }, `grand maître ${s} (${CLABEL[c]})`), el('td', { class: 'mono' }, g.gm + '/30'))); }
  const t4 = el('tbody');
  for (const d of Object.values(FAB.devices)) {
    if (d.kind === 'gm' || d.kind === 'nmos') continue;
    const cell = (c) => {
      const n = d.nics[c]; const st = FAB.res.nic[d.id + ':' + c] || {};
      const ip = ipIn(n.ip, false, (x) => { if (!x) return; n.ip = x; markDirty(); explain(`${d.name} (${CLABEL[c]}) : adresse ${x}. ${inSubnet(x, subnetOf(c, d.leaf)) ? 'Elle est dans le sous-réseau de la leaf.' : `Hors du sous-réseau ${subnetOf(c, d.leaf)} : l'appareil ne joint plus sa passerelle.`} Deux appareils avec la même adresse se volent le trafic (conflit ARP).`); });
      const gw = ipIn(n.gw, false, (x) => { if (!x) return; n.gw = x; markDirty(); explain(`${d.name} (${CLABEL[c]}) : passerelle ${x}${x !== sviIp(c, d.leaf) ? ` — la bonne passerelle est la SVI ${sviIp(c, d.leaf)}` : ''}.`); });
      ip.classList.add('net-ip'); gw.classList.add('net-ip');
      return el('td', { class: st.reach && !st.conflict ? '' : 'err' }, ip, el('span', { class: 'note' }, ' /24 gw '), gw);
    };
    t4.append(el('tr', {}, el('td', {}, d.name), el('td', { class: 'mono' }, `leaf ${d.leaf} · ${ifShort(d.nics.red.port)}`), cell('red'), cell('blue'), el('td', { class: 'mono' }, `${d.ctlIp} · ${ifShort(d.ctl.port)}`), el('td', { class: FAB.res.reg[d.id] ? 'ok' : 'err' }, FAB.res.reg[d.id] ? 'enregistré' : 'absent')));
  }
  const t5 = el('tbody');
  for (const f of Object.values(FAB.flows)) t5.append(el('tr', {}, el('td', {}, f.label), el('td', {}, FAB.devices[f.dev].name), el('td', {}, f.kind === 'video' ? 'ST 2110-20' : f.kind === 'audio' ? 'ST 2110-30' : f.kind === 'anc' ? 'ST 2110-40' : 'ST 2110-22'), el('td', { class: 'mono' }, f.groups.red), el('td', { class: 'mono' }, f.groups.blue), el('td', { class: 'mono' }, f.udp), el('td', { class: 'mono' }, f.pt), el('td', { class: 'mono' }, fmtG(f.gbps)), el('td', {}, el('button', { class: 'btn small', onclick: () => openSdp(f.id) }, 'SDP'))));
  const csv = () => ['Appareil;Leaf;Port;IP rouge;IP bleu;Contrôle', ...Object.values(FAB.devices).filter((d) => d.nics.red && d.kind !== 'gm').map((d) => [d.name, d.leaf, d.nics.red.port, d.nics.red.ip, d.nics.blue.ip, d.ctlIp].join(';'))].join('\n');
  const T = (head, tb) => el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact net-tbl' }, el('thead', {}, el('tr', {}, ...head.map((x) => el('th', {}, x)))), tb));
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'VLAN et sous-réseaux média (un /24 par leaf et par réseau)'), T(['Leaf', 'VLAN rouge', 'Sous-réseau', 'Passerelle', 'VLAN bleu', 'Sous-réseau', 'Passerelle', 'Groupes multicast'], t1),
    el('p', { class: 'note' }, 'Convention : 10.<réseau>.<leaf>.0/24, réseau 1 = rouge, 2 = bleu ; passerelle .1, appareils à partir de .20. Le même appareil a la même fin d\'adresse sur les deux réseaux. Loopbacks en 10.0.x.y/32, liens leaf ↔ spine en 10.255.x.y/31, gestion en 10.10.0.0/24 (VLAN 10), contrôle en 10.20.0.0/22 (VLAN 20).')),
  el('div', { class: 'hwpanel' }, el('h3', {}, 'Équipements (adresses modifiables)'), T(['Appareil', 'Raccordement', 'Rouge (IP · passerelle)', 'Bleu (IP · passerelle)', 'Contrôle', 'NMOS'], t4), el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => offerDownload('plan-adressage-st2110.csv', csv()) }, 'Exporter (CSV)'))),
  el('div', { class: 'hwpanel' }, el('h3', {}, 'Plan multicast (émetteurs)'), T(['Flux', 'Émetteur', 'Norme', 'Groupe rouge', 'Groupe bleu', 'UDP', 'PT', 'Débit', ''], t5)),
  el('div', { class: 'hwpanel' }, el('h3', {}, 'Commutateurs'), T(['Hostname', 'Rôle', 'Loopback', 'Gestion', 'Modèle'], t2)),
  el('details', { class: 'hwpanel' }, el('summary', {}, 'Liens point à point de l\'underlay (/31) et grands maîtres (/30)'), T(['Côté leaf', 'Adresse', 'Côté spine', 'Adresse'], t3)));
}
function openSdp(fid) {
  const f = FAB.flows[fid]; const txt = sdpOf(fid);
  log('sdp', { fid });
  const ann = el('div', { class: 'net-sdp' });
  for (const line of txt.split('\n')) { const ex = sdpExplain(line); ann.append(el('div', { class: 'net-sdpl' + (/^m=/.test(line) ? ' m' : '') }, el('code', {}, line), el('span', { class: 'note' }, ex))); }
  modal.open('SDP · ' + f.label, el('div', { class: 'list' }, el('p', { class: 'note' }, 'Le fichier SDP décrit le flux : adresses multicast des deux jambes (rouge = primary, bleu = secondary, regroupées par « a=group:DUP » pour ST 2022-7), format de l\'image ou du son, horloge PTP de référence. Le contrôleur NMOS le transmet au récepteur lors de la connexion IS-05. Chaque ligne est commentée à droite.'), ann, el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => offerDownload(fid.replace(/[^a-z0-9]+/gi, '_') + '.sdp', txt) }, 'Télécharger le .sdp'))), { width: 820, headerExtra: [q('sdp')] });
}

// ---------------- flux NMOS ----------------
function tabFlows(box, R) {
  const res = FAB.res;
  const ctl = el('div', { class: 'hwpanel' }, el('h3', {}, 'Contrôleur'),
    el('div', { class: 'grid2 net-form' },
      fld('Mode de commutation', selectEl([['pim', 'PIM-SSM / IGMPv3 (le réseau décide)'], ['sdn', 'SDN : contrôleur avec réservation de bande passante']], FAB.mode, (v) => { FAB.mode = v; markDirty(); explain(v === 'sdn' ? 'Mode SDN : le contrôleur connaît la topologie et la capacité de chaque lien. Il n\'accepte une connexion que s\'il reste assez de bande passante sur tout le chemin, sinon il la refuse (au lieu de saturer le lien et de dégrader tous les flux).' : 'Mode PIM-SSM : chaque récepteur s\'abonne par IGMPv3 et le réseau construit l\'arbre de diffusion. Simple et standard, mais personne ne vérifie la bande passante : un lien peut saturer.'); R.refresh(); })),
      chk('Registre NMOS en service', FAB.registryUp, (v) => { FAB.registryUp = v; markDirty(); explain(v ? 'Registre NMOS redémarré : les appareils se réenregistrent (IS-04) et le contrôleur peut de nouveau connecter (IS-05).' : 'Registre NMOS arrêté : les flux en cours continuent (le réseau ne dépend pas du registre), mais plus aucune connexion n\'est possible.', v ? '' : 'warn'); R.refresh(); })),
    el('p', { class: 'note' }, 'NMOS IS-04 : chaque appareil s\'enregistre (nœud, émetteurs, récepteurs) dans le registre via le réseau de contrôle. IS-05 : le contrôleur (ici la « grille » IP) envoie à un récepteur le SDP de l\'émetteur choisi ; le récepteur s\'abonne alors en IGMPv3 aux deux groupes (rouge et bleu).'));
  const tb = el('tbody');
  const rxs = Object.values(FAB.rx);
  for (const rx of rxs) {
    const s = res.rxState[rx.id]; const f = s && FAB.flows[s.flow];
    const cell = (c) => { if (!s) return el('td', {}, '—'); const p = s.per[c]; return el('td', { class: p.ok ? (p.loss > 0 ? 'err' : 'ok') : 'err', title: p.reason || '' }, p.ok ? (p.loss > 0 ? `pertes ${fmt(p.loss * 100, 0)} %` : 'OK') : p.refused ? 'refusé' : 'NON'); };
    const state = !s ? ['', 'non connecté'] : !s.ok ? ['err', 'RIEN REÇU'] : s.loss > 0 ? ['err', `pertes ${fmt(s.loss * 100, 0)} %`] : !s.protected ? ['warn', 'sans protection'] : ['ok', 'protégé 2022-7'];
    tb.append(el('tr', { class: V.rx === rx.id ? 'sel' : '', 'data-rx': rx.id, onclick: () => { V.rx = rx.id; log('rx', { rx: rx.id }); R.refresh(); } }, el('td', {}, rx.label), el('td', {}, f ? f.label : '—'), el('td', { class: 'mono' }, f ? f.groups.red : ''), cell('red'), cell('blue'), el('td', { class: state[0] }, state[1]), el('td', { class: res.reg[rx.dev] ? '' : 'err' }, res.reg[rx.dev] ? 'IS-04' : 'absent')));
  }
  const det = el('div', { class: 'hwpanel' });
  const s = V.rx && res.rxState[V.rx];
  if (V.rx && FAB.rx[V.rx]) {
    const rx = FAB.rx[V.rx]; det.append(el('h3', {}, 'Réception · ' + rx.label));
    if (!s) det.append(el('p', { class: 'note' }, 'Ce récepteur n\'est abonné à aucun flux.'));
    else if (!FAB.flows[s.flow]) det.append(el('p', { class: 'note err' }, `Paramètres saisis à la main (onglet Exploitation) : rien ne correspond. ${s.reason}`));
    else {
      const f = FAB.flows[s.flow]; const sd = FAB.devices[f.dev], rd = FAB.devices[rx.dev];
      const kv = el('dl', { class: 'kv' }); kv.append(el('dt', {}, 'Émetteur'), el('dd', {}, `${f.label} · ${sd.name} · ${fmtG(f.gbps)}`));
      for (const c of COLORS) {
        const p = s.per[c]; let path;
        if (p.ok) {
          const lu = p.lu && FAB.links.find((l) => l.id === p.lu), ld = p.ld && FAB.links.find((l) => l.id === p.ld);
          path = `${sd.name} → ${host(sd.nics[c].sw)} ${ifShort(sd.nics[c].port)}` + (lu ? ` → ${ifShort(lu.a.port)} ⇒ ${host(lu.b.sw)} ${ifShort(lu.b.port)} → ${ifShort(ld.b.port)} ⇒ ${host(ld.a.sw)} ${ifShort(ld.a.port)}` : ' (même leaf)') + ` → ${ifShort(rd.nics[c].port)} → ${rd.name}` + (p.loss > 0 ? ` — PERTES ${fmt(p.loss * 100, 0)} %` : '');
        } else path = 'ÉCHEC : ' + p.reason;
        kv.append(el('dt', {}, `Chemin ${CLABEL[c]} (${p.group || f.groups[c]})`), el('dd', { class: p.ok && !(p.loss > 0) ? '' : 'err' }, path));
      }
      kv.append(el('dt', {}, 'Bilan'), el('dd', { class: !s.ok || s.loss > 0 ? 'err' : !s.protected ? 'warn' : '' }, s.reason || 'reçu sur les deux réseaux : le récepteur fusionne les deux flux paquet par paquet (ST 2022-7), une perte sur l\'un est comblée par l\'autre.'));
      det.append(kv, el('div', { class: 'hwrow' }, el('button', { class: 'btn small primary', 'data-tut': 'analyze', onclick: () => { selectRx(V.rx); log('analyzer', { rx: V.rx }); R.go('meas', { msub: 'stream' }); } }, 'Analyser ce flux'), el('button', { class: 'btn small', 'data-tut': 'sdp', onclick: () => openSdp(f.id) }, 'Voir le SDP de l\'émetteur'), ...COLORS.map((c) => el('button', { class: 'btn small', onclick: () => R.go('switch', { sw: rd.nics[c].sw, port: rd.nics[c].port, sub: 'mcast' }) }, `Multicast sur ${host(rd.nics[c].sw)}`))));
    }
  } else det.append(el('h3', {}, 'Détail'), el('p', { class: 'note' }, 'Cliquez une réception pour voir le chemin suivi sur chaque réseau.'));
  const tot = COLORS.map((c) => { let l = 0, cap = 0; for (const x of FAB.links) if (x.color === c && res.up[x.id].up) { l += ((res.linkLoad[x.id + ':up'] || {}).load || 0); cap += res.up[x.id].speed; } return `${CLABEL[c]} : ${fmtG(l)} montants sur ${cap} Gb/s d'uplinks`; });
  box.append(ctl, det, el('div', { class: 'hwpanel' }, el('h3', {}, 'Récepteurs (connexions IS-05)'), el('p', { class: 'note' }, 'Bande passante des uplinks — ' + tot.join(' · ') + '. Les connexions se font depuis la grille (contrôleur IP) : ce tableau montre ce que le réseau en a fait.'),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact net-tbl' }, el('thead', {}, el('tr', {}, ...['Récepteur', 'Flux', 'Groupe (rouge)', 'Rouge', 'Bleu', 'État', 'NMOS'].map((x) => el('th', {}, x)))), tb))));
}

// ---------------- PTP ----------------
const tutMark = (node, id) => { node.setAttribute('data-tut', id); return node; };
function tabPtp(box, R) {
  const res = FAB.res;
  const gms = el('div', { class: 'panelgrid' });
  for (const g of [1, 2]) {
    const gm = FAB.gm['gm' + g];
    const set = (o, why) => { Object.assign(gm, o); markDirty(); explain(why); R.refresh(); };
    gms.append(el('div', { class: 'hwpanel' }, el('h3', {}, `Grand maître ${g} · ${clockId('gm' + g)}`),
      tutMark(chk('En service', gm.up, (v) => set({ up: v }, v ? `Grand maître ${g} en service : il annonce sa qualité ; le BMCA le réélit s'il est le meilleur.` : `Grand maître ${g} coupé : après 3 Announce manqués (≈ 0,75 s en ST 2059-2), les horloges frontières élisent le meilleur grand maître restant.`)), 'gm' + g + '-up'),
      chk('GPS verrouillé', gm.gps, (v) => set({ gps: v }, v ? 'GPS retrouvé : clockClass 6.' : 'GPS perdu : le grand maître passe en holdover (clockClass 7). Il reste utilisable, mais un grand maître encore verrouillé GPS (classe 6) sera préféré à priority1 égal.')),
      fld('priority1', numIn(gm.priority1, 0, 255, (v) => set({ priority1: v }, `priority1 = ${v}. C'est le premier critère du BMCA : le plus petit gagne, avant même la qualité d'horloge.`))),
      fld('priority2', numIn(gm.priority2, 0, 255, (v) => set({ priority2: v }, `priority2 = ${v} (départage à qualité égale).`)))));
  }
  const cand = el('tbody');
  for (const c of COLORS) {
    const gm = res.gmActive[c];
    cand.append(el('tr', {}, el('td', { class: c }, CLABEL[c]), el('td', { class: gm ? (gm.rogue ? 'err' : 'ok') : 'err' }, gm ? gm.name : 'aucun'), el('td', { class: 'mono' }, gm ? gm.p1 : '—'), el('td', { class: 'mono' }, gm ? gm.cls : '—'), el('td', { class: 'mono' }, gm ? gm.p2 : '—'), el('td', { class: 'mono' }, gm ? clockId(gm.id) : '—')));
  }
  const swt = el('tbody');
  for (const sw of Object.values(FAB.switches)) {
    if (sw.role === 'ctl') continue;
    const P = res.ptp[sw.color]; const h = P && P.synced[sw.id];
    const ports = sw.power && sw.running.ptp.mode !== 'disabled' ? ptpPorts(sw) : {}; const sl = Object.entries(ports).find(([, v]) => v === 'Slave');
    swt.append(el('tr', { onclick: () => R.go('switch', { sw: sw.id, sub: 'ptpc' }) }, el('td', { class: 'mono' }, sw.running.hostname), el('td', {}, sw.running.ptp.mode), el('td', { class: 'mono' + (sw.running.ptp.domain !== PTP_REF.domain ? ' err' : '') }, sw.running.ptp.domain), el('td', { class: h != null ? 'ok' : 'err' }, !sw.power ? 'hors tension' : h != null ? `synchronisé · ${h} saut(s)` : 'NON SYNCHRONISÉ'), el('td', { class: 'mono' }, sl ? ifShort(sl[0]) : '—'), el('td', { class: 'mono' }, h != null ? `${h * 7 + 3} ns` : '—')));
  }
  const dvt = el('tbody');
  for (const d of Object.values(FAB.devices)) {
    if (d.kind === 'gm' || d.kind === 'nmos') continue;
    const pt = res.devPtp[d.id] || {};
    const so = el('input', { type: 'checkbox' }); so.checked = d.ptp.slaveOnly !== false;
    so.addEventListener('change', () => { d.ptp.slaveOnly = so.checked; if (!so.checked) { d.ptp.priority1 = d.ptp.priority1 === 255 ? 128 : d.ptp.priority1; d.ptp.clockClass = 248; } markDirty(); explain(so.checked ? `${d.name} en « slave only » : il ne peut jamais devenir maître. C'est le réglage attendu sur tous les appareils.` : `${d.name} n'est plus « slave only » : avec un priority1 inférieur à celui des grands maîtres, il peut se faire élire et entraîner tout un réseau sur son horloge libre.`, so.checked ? '' : 'warn'); R.refresh(); });
    dvt.append(el('tr', {}, el('td', {}, d.name), el('td', { class: pt.state === 'locked' ? 'ok' : pt.state === 'noisy' ? 'warn' : 'err' }, (pt.state || '—') + (pt.why ? ' · ' + pt.why : '')), el('td', { class: 'mono' }, pt.color ? CLABEL[pt.color] : '—'), el('td', { class: 'mono' }, pt.offset != null ? pt.offset + ' ns' : '—'),
      el('td', {}, so), el('td', {}, numIn(d.ptp.priority1 ?? 255, 0, 255, (v) => { d.ptp.priority1 = v; markDirty(); explain(`${d.name} : priority1 ${v}${d.ptp.slaveOnly !== false ? ' (sans effet tant qu\'il est « slave only »)' : ''}.`); R.refresh(); })), el('td', {}, numIn(d.ptp.domain, 0, 255, (v) => { d.ptp.domain = v; markDirty(); explain(`${d.name} : domaine PTP ${v}${v !== PTP_REF.domain ? ' — il n\'écoute plus le domaine 127 du car : non verrouillé.' : ''}.`); R.refresh(); }))));
  }
  const T = (head, tb) => el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact net-tbl' }, el('thead', {}, el('tr', {}, ...head.map((x) => el('th', {}, x)))), tb));
  box.append(el('div', { class: 'hwpanel prose' }, el('h3', {}, 'PTP dans le car (SMPTE ST 2059-2)'), el('p', {}, 'Deux grands maîtres GPS, chacun raccordé aux spines rouge et bleue de même numéro. Tous les commutateurs sont des horloges frontières (BC) : chacun se cale sur le meilleur maître (port esclave) et redistribue l\'heure à ses voisins. Les appareils, en « slave only », se calent sur leur leaf par leurs deux cartes et gardent la meilleure.'), el('p', {}, 'Élection BMCA, critère par critère : priority1 (le plus petit) → clockClass (6 = GPS, 7 = holdover, 248 = horloge libre) → précision → variance → priority2 → identité. Domaine 127, Announce 2^-2 s, Sync 2^-3 s, DSCP 46 en file prioritaire.')),
    gms, el('div', { class: 'hwpanel' }, el('h3', {}, 'Grand maître élu par réseau'), T(['Réseau', 'Élu', 'priority1', 'clockClass', 'priority2', 'Identité'], cand)),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Commutateurs (horloges frontières)'), T(['Commutateur', 'Mode', 'Domaine', 'État', 'Port esclave', 'Offset'], swt)),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Appareils'), T(['Appareil', 'État', 'Réseau utilisé', 'Offset', 'Slave only', 'priority1', 'Domaine'], dvt)));
}

// ---------------- diagnostic ----------------
function tabDiag(box, R) {
  const list = el('div', { class: 'list' });
  if (!FAB.issues.length) list.append(el('div', { class: 'item' }, el('span', { class: 'dot green' }), el('div', { class: 'grow' }, el('div', { class: 't' }, 'Aucune anomalie'), el('div', { class: 's' }, 'Tous les flux arrivent par les deux réseaux, PTP verrouillé, configurations enregistrées.'))));
  for (const i of FAB.issues.slice(0, 80)) {
    list.append(el('div', { class: 'item' }, el('span', { class: dotCls(i.sev === 'info' ? 'off' : i.sev) }), el('div', { class: 'grow' }, el('div', { class: 't' }, i.title), el('div', { class: 's' }, i.detail)),
      i.sw ? el('button', { class: 'btn small', onclick: () => R.go('switch', { sw: i.sw, port: i.port || V.port, sub: i.port ? 'ports' : V.sub === 'term' ? 'term' : 'ports' }) }, i.port ? `${host(i.sw)} ${ifShort(i.port)}` : host(i.sw)) : i.dev ? el('button', { class: 'btn small', onclick: () => R.go('topo', { sel: { kind: 'dev', id: i.dev } }) }, 'Voir') : null));
  }
  const netFaults = FAULTS.filter((f) => f.net);
  box.append(el('div', { class: 'hwpanel' }, el('h3', {}, `Anomalies (${FAB.issues.length})`), list),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Actions'), el('div', { class: 'hwrow' },
      el('button', { class: 'btn small primary', onclick: () => { const pool = netFaults.filter((f) => f.can()); if (!pool.length) { toast('Aucune panne réseau possible maintenant', 'bad'); return; } injectFault(pool[Math.floor(Math.random() * pool.length)].id, true); R.refresh(); } }, 'Panne réseau surprise'),
      el('button', { class: 'btn small', onclick: () => { for (const id of Object.keys(FAB.switches)) if (FAB.switches[id].power) writeMemory(id); explain('write memory sur tous les commutateurs.'); R.refresh(); } }, 'write memory partout'),
      el('button', { class: 'btn small', onclick: () => { resetFabric(); log('reset'); explain('Réseau remis en état de référence : commutateurs rallumés et reconfigurés (running = startup), adresses des appareils, grands maîtres et registre NMOS rétablis.'); R.refresh(); } }, 'Tout remettre en configuration de référence')),
    el('div', { class: 'list' }, ...netFaults.map((f) => el('div', { class: 'item' }, el('div', { class: 'grow' }, el('div', { class: 't' }, f.label), el('div', { class: 's' }, f.hint)), el('button', { class: 'btn small', onclick: () => { injectFault(f.id); R.refresh(); } }, 'Injecter'))))),
    el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Méthode de dépannage'), el('ol', { class: 'steps' },
      el('li', {}, el('b', {}, 'Constater et délimiter : '), 'une seule réception ou toutes ? un seul réseau (rouge ou bleu) ou les deux ? À l\'image, une panne d\'un seul réseau ne se voit pas (2022-7) : seul ce poste et les alarmes la montrent.'),
      el('li', {}, el('b', {}, 'Couche 1 : '), 'le port est-il « connected » ? vitesse identique aux deux bouts ? FEC RS à 25G / 100G ? optique, jarretière, shutdown ?'),
      el('li', {}, el('b', {}, 'Couche 2 : '), 'bon VLAN d\'accès ? VLAN existant ? snooping IGMP actif et querier présent ? MTU ≥ 1 500 ?'),
      el('li', {}, el('b', {}, 'Couche 3 : '), 'adresse et passerelle de l\'appareil cohérentes avec la SVI ? pas de conflit ? voisins OSPF en FULL sur les uplinks (MTU identique) ? sous-réseaux annoncés ?'),
      el('li', {}, el('b', {}, 'Multicast : '), 'groupe dans la plage SSM partout (239.0.0.0/8 ici) ? IGMPv3 sur la SVI ? PIM sur les SVI et les uplinks ? « show ip mroute » le long du chemin.'),
      el('li', {}, el('b', {}, 'Bande passante : '), 'lien saturé = pertes pour tous les flux qui le traversent (en PIM). Un contrôleur SDN refuse plutôt la connexion.'),
      el('li', {}, el('b', {}, 'PTP : '), 'quel grand maître est élu (show ptp parent) ? domaine 127 partout ? un appareil qui n\'est pas « slave only » ?'),
      el('li', {}, el('b', {}, 'NMOS et enregistrement : '), 'l\'appareil est-il enregistré (réseau de contrôle, VLAN 20) ? Après réparation : « write memory ».'))));
}
