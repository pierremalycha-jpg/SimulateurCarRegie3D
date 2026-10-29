// @ts-check
// Grille du car SDI façon Blackmagic Smart Videohub 40×40 12G : façade, logiciel Videohub Control,
// monitoring des sources et des destinations. Le car IP garde son contrôleur NMOS (ui/stations.js).
import * as THREE from 'three';
import { S, emit } from '../state.js';
import { el, clamp } from '../util.js';
import { toast, ask } from './common.js';
import { explain } from './widgets.js';
import { q } from './term.js';
import { renderer } from '../app/view.js';
import { ROUTER, EXTRA_SLOTS, resolve, tallyOf, defaultRouting } from '../pipeline.js';
import { ctrlFunc } from '../net/ctrlnet.js';
import {
  VH, VH_N, VH_MODEL, VH_NET, VH_PANEL as FP, VH_MON, inPlan, outPlan, inLabel, outLabel, setInLabel, setOutLabel, resetLabels,
  xpOf, outsOfIn, srcOfIn, lockState, setLock, vhRoute, protocolText,
} from '../videohub.js';

// ----------------------------------------------------------------------------------
// Le poste « Grille » du car SDI :
//   · dans le bandeau d'écrans, la façade de la Videohub (écran LCD avec la vidéo, touches
//     numérotées, OUT / IN / CLEAR / TAKE / LOCK / MENU / SET, molette, voyants) ;
//   · onglet Videohub Control : les boutons des 40 destinations et des 40 sources, TAKE, verrou ;
//   · onglet Monitoring : deux mosaïques vivantes (40 entrées, 40 sorties) rendues dans une texture,
//     une rangée de vignettes par image (rafraîchissement tournant), seulement quand on les voit ;
//   · onglet Matrice : les 1 600 points de croisement ;
//   · onglet Videohub Setup : étiquettes, verrous, réseau, protocole Ethernet en direct.
// Le modèle (plan des ports, étiquettes, verrous, routage) est dans videohub.js.
// ----------------------------------------------------------------------------------
const SW = { out: 1, pend: /** @type {number | null} */ (null), tab: 'control', mon: 'both' };
const DIG = { s: '', t: 0 };
const SEEN = { mon: false, setup: false, mx: false };
const FMT = () => (S.format === 'UHD' ? '2160p50 · 12G-SDI' : S.format === 'HD' ? '1080p50 · 3G-SDI' : '1080i50 · HD-SDI');
const wrap = (n) => ((n - 1 + VH_N * 10) % VH_N) + 1;
const LOCK_SVG = '<svg viewBox="0 0 12 14" aria-hidden="true" focusable="false"><path d="M3 6.2V4.3a3 3 0 0 1 6 0v1.9" fill="none" stroke="currentColor" stroke-width="1.9"/><rect x="1" y="6" width="10" height="7.6" rx="1.6" fill="currentColor"/></svg>';
const lockIcon = (cls = '') => el('span', { class: 'vh-lk ' + cls, html: LOCK_SVG });

// ---------------- images : ce qu'apporte une entrée, ce que reçoit une sortie ----------------
const BLACK = () => resolve(null);
function inRes(n) { return n ? resolve(srcOfIn(n), 0, false) : BLACK(); }
function outRes(n) {
  const x = xpOf(n); if (!x) return BLACK();
  const p = outPlan(n);
  return p.dest ? resolve(ROUTER.map[p.dest], 0, false, p.dest) : inRes(x);
}
const slot = (r) => ({ tex: r.tex, gain: 1.1 * r.scale });
const sigOf = (n) => { const p = inPlan(n); if (!p.live) return 'aucun signal'; const r = inRes(n); return r.none || r.alarm === 'PAS DE SIGNAL' || r.alarm === 'NO SIG' ? 'aucun signal' : r.alarm && !['MIRE', 'BARRES'].includes(r.alarm) ? 'alarme ' + r.alarm : 'signal présent'; };
const descIn = (n) => `entrée ${n} « ${inLabel(n)} »`;
const descOut = (n) => `sortie ${n} « ${outLabel(n)} »`;
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// ---------------- explications ----------------
function explainSel(n) {
  const p = outPlan(n), x = xpOf(n), lk = lockState(n);
  explain(`Destination : ${descOut(n)}${p.dest ? ` (${p.to})` : ' : sortie libre, rien n\'y est câblé'}. Elle reçoit ${x ? descIn(x) : 'aucune entrée'}. Choisis la source${VH.take ? ', puis TAKE' : ' : la commutation sera immédiate (TAKE désactivé)'}.${lk !== 'U' ? ' Cette sortie est verrouillée : il faudra d\'abord la déverrouiller.' : ''}`, 'vh:sel');
}
function explainTake(n, m, prev) {
  const outs = outsOfIn(m).filter((o) => o !== n);
  const p = outPlan(n), ip = inPlan(m);
  const tail = { tx: ' C\'est un départ vers la chaîne : vérifie le retour antenne, puis verrouille la sortie.', mel: ` Le bouton ${n} du mélangeur montre maintenant cette source.`, mv: ` La tuile ${n - 22} du multiview change d'image.`, evs: ` L'EVS enregistre maintenant cette source sur REC ${n - 22}.`, aux: ' Vérifie l\'image sur l\'écran concerné.', free: ' Rien n\'est câblé sur cette sortie : la commutation est faite, mais aucune destination ne la reçoit.' }[p.group] || '';
  explain(`Point de croisement établi : ${descIn(m)} → ${descOut(n)}${prev && prev !== m ? ` (au lieu de l'entrée ${prev})` : ''}. Une sortie ne reçoit qu'une source à la fois.${outs.length ? ` L'entrée ${m} alimente aussi ${outs.length === 1 ? 'la sortie ' + outs[0] : outs.length + ' autres sorties (' + outs.slice(0, 6).join(', ') + (outs.length > 6 ? '…' : '') + ')'} : une source peut partir vers autant de destinations qu'on veut.` : ''}${!ip.live ? ` Attention : rien n'est câblé sur l'entrée ${m}, la destination ne reçoit aucune image.` : ''}${tail}`, 'grille:take');
}
function doRoute(n, m) {
  // en car SDI, la prise part en Ethernet vers la carte de contrôle de la grille
  const k = ctrlFunc('grille');
  if (!k.ok) { SW.pend = null; toast('Grille injoignable par le réseau de contrôle.', 'bad'); explain(`Prise refusée : le logiciel ne joint plus la grille (${k.why}). Les points de croisement en place restent, mais aucune nouvelle prise ne passe : vois le poste Réseau.`, 'warn:ctrl'); return false; }
  const prev = xpOf(n);
  const err = vhRoute(n, m);
  SW.pend = null;
  if (err) { explain(err + (lockState(n) !== 'U' ? ' Le verrou joue son rôle : personne ne peut changer cette sortie par erreur.' : ''), 'warn:take'); toast(err, 'bad'); return false; }
  explainTake(n, m, prev);
  toast(`OUT ${n} ${outLabel(n)} ← IN ${m} ${inLabel(m)}`, 'good');
  return true;
}
async function toggleLock(n) {
  const l = lockState(n);
  if (l === 'U') {
    setLock(n, 'O');
    explain(`${cap(descOut(n))} verrouillée (cadenas ambre, état O : verrouillée par ce poste). Plus personne ne peut la commuter : ni ce logiciel, ni la façade, ni un autre poste du réseau. On verrouille les sorties dont dépend l'antenne (départs TX1 et TX2) : une fausse manœuvre ne peut plus envoyer une autre image à la chaîne.`, 'vh:lock');
    return;
  }
  if (l === 'L') {
    const by = VH.lockedBy[n] || 'un autre client du réseau';
    const ok = await ask(`La ${descOut(n)} a été verrouillée depuis un autre poste (${by}).\n\nLa déverrouiller d'ici retire son verrou sans le prévenir. On appelle d'abord ce poste à l'intercom pour savoir pourquoi la sortie est figée.`, { title: 'Sortie verrouillée par un autre poste', ok: 'Forcer le déverrouillage', danger: true });
    if (!ok) { explain(`Verrou de la sortie ${n} conservé. Une sortie verrouillée par un autre poste (état L) l'est souvent pour une bonne raison : demande avant de forcer.`, 'vh:lock'); return; }
  }
  setLock(n, null);
  explain(`${cap(descOut(n))} déverrouillée (état U) : tous les postes peuvent de nouveau la commuter. Fais ton changement, puis reverrouille-la si c'est une sortie critique.`, 'vh:lock');
}

// ---------------- façade ----------------
function fpSet(mode) {
  if (mode === 'out') { FP.mode = 'out'; FP.pending = false; FP.inp = null; explain(`Façade, touche OUT : la molette et les touches numérotées choisissent la destination. Sortie ${FP.out} « ${outLabel(FP.out)} » : l'écran montre l'image qu'elle reçoit.`, 'vh:fp'); }
  if (mode === 'in') { FP.mode = 'in'; FP.inp = FP.inp || xpOf(FP.out) || 1; FP.pending = FP.inp !== xpOf(FP.out); explain(`Façade, touche IN : la molette parcourt les sources. L'écran montre l'image de chaque entrée avant toute commutation : on regarde avant de prendre. Dès qu'une autre source est choisie, CLEAR et TAKE clignotent.`, 'vh:fp'); }
}
function fpPick(n) {
  if (FP.mode === 'menu') return;
  if (FP.mode === 'out') { FP.out = n; FP.pending = false; FP.inp = null; explainSel(n); return; }
  FP.inp = n; FP.pending = n !== xpOf(FP.out);
  explain(FP.pending ? `Source préparée sur la façade : ${descIn(n)} pour la ${descOut(FP.out)}. L'écran montre déjà son image ; TAKE valide, CLEAR annule. Rien n'est commuté pour l'instant.` : `${cap(descIn(n))} est déjà la source de la sortie ${FP.out} : rien à valider.`, 'vh:fp');
}
function fpDigit(d) {
  const now = performance.now();
  if (now - DIG.t > 3000) DIG.s = '';
  DIG.t = now;
  let s = DIG.s + d, n = +s;
  if (s.length === 2 && (n < 1 || n > VH_N)) { s = String(d); n = d; }
  if (n < 1) { DIG.s = ''; explain('Touche 0 : tape le numéro de la sortie ou de la source sur deux chiffres (0 seul ne désigne aucun port, 10 = 1 puis 0).', 'vh:fp'); return; }
  DIG.s = s.length >= 2 || n > 4 ? '' : s;
  fpPick(n);
}
function fpTurn(d) {
  if (FP.mode === 'menu') { FP.menu = clamp(FP.menu + d, 0, MENU.length - 1); return; }
  if (FP.mode === 'out') fpPick(wrap(FP.out + d));
  else fpPick(wrap((FP.inp || xpOf(FP.out) || 1) + d));
}
function fpTake() {
  if (!FP.pending || !FP.inp) { explain('TAKE : rien à valider. Touche IN, choisis une source (molette ou touches numérotées), puis TAKE.', 'vh:fp'); return; }
  const n = FP.out, m = FP.inp;
  FP.pending = false; FP.inp = null; FP.mode = 'out';
  doRoute(n, m);
}
function fpClear() {
  if (FP.mode === 'menu') { FP.mode = 'out'; return; }
  const had = FP.pending; FP.pending = false; FP.inp = null; FP.mode = 'out';
  explain(had ? `CLEAR : source préparée abandonnée, la sortie ${FP.out} garde sa source. C'est la porte de sortie en cas de doute.` : 'CLEAR : rien à annuler.', 'vh:fp');
}
/** @type {[string, () => string][]} */
const MENU = [
  ['Réseau', () => `IP ${VH_NET.ip} · masque ${VH_NET.mask} · passerelle ${VH_NET.gw} · ${VH_NET.dhcp ? 'DHCP' : 'adresse fixe'}`],
  ['Vidéo sur l\'écran', () => (FP.video ? 'oui (SET : non)' : 'non (SET : oui)')],
  ['Langue', () => 'Français'],
  ['Appareil', () => `${VH_MODEL} · 40 entrées, 40 sorties`],
  ['Quitter le menu', () => 'SET ou MENU'],
];
function fpMenu() {
  if (FP.mode === 'menu') { FP.mode = 'out'; return; }
  FP.mode = 'menu'; FP.menu = 0; FP.pending = false; FP.inp = null;
  explain('MENU : les réglages de la grille sur l\'écran de façade. La molette parcourt les rubriques, SET valide. Le réseau se règle aussi dans Videohub Setup, par USB ou Ethernet.', 'vh:fp');
}
function fpSet2() {
  if (FP.mode !== 'menu') { explain('SET valide un réglage dans le menu (touche MENU d\'abord).', 'vh:fp'); return; }
  const k = MENU[FP.menu][0];
  if (k.startsWith('Vidéo')) { FP.video = !FP.video; explain(FP.video ? 'L\'écran de façade montre de nouveau la vidéo de la source.' : 'Écran de façade sans vidéo : seulement les numéros et les étiquettes.', 'vh:fp'); }
  else if (k.startsWith('Réseau')) explain(`Réseau de contrôle de la grille : ${VH_NET.ip}, masque ${VH_NET.mask}, passerelle ${VH_NET.gw}. Le logiciel Videohub Control s'y connecte sur le port TCP ${VH_NET.port}.`, 'vh:fp');
  else if (k.startsWith('Quitter')) FP.mode = 'out';
}

function buildFace() {
  const key = (l, k, aria, fn) => el('button', { type: 'button', class: 'vh-key', 'data-fp': k, 'aria-label': aria, onclick: fn }, l);
  const topNum = el('b', { class: 'vh-num' }), topLab = el('span', { class: 'vh-lab' }), topLk = lockIcon();
  const botNum = el('b', { class: 'vh-num' }), botLab = el('span', { class: 'vh-lab' }), botFmt = el('small', { class: 'vh-fmt' });
  const vid = el('div', { class: 'mon vh-lcdvid', 'data-gl': 'VH:LCD', title: 'Écran de la façade' });
  const menu = el('div', { class: 'vh-lcdmenu', hidden: true });
  const lcd = el('div', { class: 'vh-lcd', 'aria-live': 'polite' },
    el('div', { class: 'vh-lcdrow' }, el('span', { class: 'vh-tag' }, 'OUT'), topNum, topLab, topLk), vid, menu,
    el('div', { class: 'vh-lcdrow' }, el('span', { class: 'vh-tag' }, 'IN'), botNum, botLab, botFmt));
  const digits = el('div', { class: 'vh-digits', role: 'group', 'aria-label': 'Touches numérotées' },
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => key(String(d), 'd' + d, 'Touche ' + d, () => fpDigit(d))));
  const K = {
    out: key('OUT', 'out', 'OUT : choisir la destination', () => fpSet('out')), in: key('IN', 'in', 'IN : choisir la source', () => fpSet('in')),
    clear: key('CLEAR', 'clear', 'CLEAR : annuler', fpClear), take: key('TAKE', 'take', 'TAKE : valider la commutation', fpTake),
    lock: key('LOCK', 'lock', 'LOCK : verrouiller ou déverrouiller la sortie', () => toggleLock(FP.out)),
    menu: key('MENU', 'menu', 'MENU : réglages', fpMenu), set: key('SET', 'set', 'SET : valider le réglage', fpSet2),
  };
  const fn = el('div', { class: 'vh-fn', role: 'group', 'aria-label': 'Touches de commande' }, K.out, K.in, K.clear, K.take, K.lock, K.menu, K.set);
  // molette : glisser, molette de la souris ou flèches ; un cran = un port
  const cap = el('div', { class: 'vh-knobcap' }, el('i'));
  const knob = el('div', { class: 'vh-knob', tabindex: 0, role: 'slider', 'aria-label': 'Molette', 'aria-valuemin': 1, 'aria-valuemax': VH_N, 'data-fp': 'knob' }, cap);
  let ang = 0, drag = null;
  const turn = (d) => { ang += d * 15; cap.style.transform = `rotate(${ang}deg)`; fpTurn(d); };
  knob.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, acc: 0 }; knob.setPointerCapture(e.pointerId); e.preventDefault(); });
  knob.addEventListener('pointermove', (e) => { if (!drag) return; const d = (e.clientX - drag.x) - (e.clientY - drag.y); drag.x = e.clientX; drag.y = e.clientY; drag.acc += d; while (Math.abs(drag.acc) >= 16) { const s = Math.sign(drag.acc); drag.acc -= s * 16; turn(s); } });
  knob.addEventListener('pointerup', () => { drag = null; });
  knob.addEventListener('wheel', (e) => { e.preventDefault(); turn(e.deltaY < 0 ? 1 : -1); }, { passive: false });
  knob.addEventListener('keydown', (e) => { const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[e.key]; if (d) { e.preventDefault(); for (let i = 0; i < Math.abs(d); i++) turn(Math.sign(d)); } });
  const led = (l) => el('span', { class: 'vh-led on' }, el('i'), l);
  const leds = el('div', { class: 'vh-leds' }, led('PSU 1'), led('PSU 2'), led('REF'), led('LAN'));
  const ear = (side) => el('div', { class: 'vh-ear ' + side, 'aria-hidden': 'true' }, el('i'), el('i'));
  const face = el('div', { class: 'vh-face', role: 'group', 'aria-label': `Façade de la ${VH_MODEL}` }, ear('l'),
    el('div', { class: 'vh-main' },
      el('div', { class: 'vh-brand' }, el('span', {}, 'Videohub'), el('span', { class: 'vh-model' }, '40×40 12G'), leds),
      lcd, digits, fn, el('div', { class: 'vh-knobwrap' }, knob, el('span', { class: 'vh-cap' }, 'Molette'))), ear('r'));
  return {
    face,
    update() {
      const menuOn = FP.mode === 'menu';
      vid.hidden = menuOn || !FP.video; menu.hidden = !menuOn;
      const o = FP.out, x = FP.mode === 'in' && FP.inp ? FP.inp : xpOf(o);
      const txt = (n, t) => { if (n.textContent !== t) n.textContent = t; };
      txt(topNum, String(o).padStart(2, '0')); txt(topLab, outLabel(o));
      topLk.className = 'vh-lk ' + ({ U: 'off', O: 'own', L: 'other' }[lockState(o)]);
      txt(botNum, x ? String(x).padStart(2, '0') : '--'); txt(botLab, x ? inLabel(x) : 'aucune'); txt(botFmt, FP.pending ? 'TAKE ?' : FMT());
      if (menuOn) {
        const k = MENU.map(([l, v], i) => (i === FP.menu ? '› ' : '  ') + l + ' : ' + v()).join('|');
        if (menu.dataset.k !== k) { menu.dataset.k = k; menu.replaceChildren(...MENU.map(([l, v], i) => el('div', { class: i === FP.menu ? 'on' : '' }, el('b', {}, l), el('span', {}, v())))); }
      }
      K.out.className = 'vh-key' + (FP.mode === 'out' ? ' lit-a' : '');
      K.in.className = 'vh-key' + (FP.mode === 'in' ? ' lit-w' : '');
      K.take.className = 'vh-key' + (FP.pending ? ' lit-r blink' : '');
      K.clear.className = 'vh-key' + (FP.pending ? ' lit-w blink' : '');
      K.lock.className = 'vh-key' + (lockState(o) !== 'U' ? ' lit-r' : '');
      K.menu.className = 'vh-key' + (menuOn ? ' lit-a' : '');
      knob.setAttribute('aria-valuenow', String(menuOn ? FP.menu + 1 : FP.mode === 'in' ? (FP.inp || 1) : o));
      knob.setAttribute('aria-valuetext', menuOn ? 'Menu : ' + MENU[FP.menu][0] : FP.mode === 'in' ? `Source ${FP.inp || ''} ${FP.inp ? inLabel(FP.inp) : ''}` : `Sortie ${o} ${outLabel(o)}`);
    },
  };
}

// ---------------- logiciel Videohub Control ----------------
function buildControl() {
  const dests = el('div', { class: 'vh-grid vh-dest', role: 'group', 'aria-label': 'Destinations (sorties)' });
  const srcs = el('div', { class: 'vh-grid vh-src', role: 'group', 'aria-label': 'Sources (entrées)' });
  const DB = [], SB = [];
  for (let n = 1; n <= VH_N; n++) {
    const b = el('button', { type: 'button', class: 'vh-b', 'data-out': n, onclick: () => { SW.out = n; SW.pend = null; explainSel(n); } }, el('span', { class: 'n' }, String(n)), el('span', { class: 'l' }), el('span', { class: 's' }), lockIcon('off'));
    DB.push(b); dests.append(b);
    const s = el('button', { type: 'button', class: 'vh-b', 'data-in': n, onclick: () => swSource(n) }, el('span', { class: 'n' }, String(n)), el('span', { class: 'l' }), el('span', { class: 's' }), el('span', { class: 'vh-t', 'aria-hidden': 'true' }));
    SB.push(s); srcs.append(s);
  }
  const takeChk = el('input', { type: 'checkbox', id: 'vh-usetake' });
  takeChk.addEventListener('change', () => { VH.take = takeChk.checked; SW.pend = null; explain(VH.take ? 'Utiliser TAKE : un clic sur une source la prépare seulement (elle clignote en rouge), TAKE la commute. C\'est le réglage du car : une erreur de clic ne part pas à l\'antenne.' : 'TAKE désactivé (réglage d\'origine du logiciel) : un clic sur une source la commute tout de suite. Verrouille au moins les départs vers la chaîne.', 'vh:take'); });
  const take = el('button', { type: 'button', class: 'vh-take', onclick: () => { if (SW.pend) doRoute(SW.out, SW.pend); else explain(VH.take ? 'TAKE : choisis d\'abord une source (elle clignote), puis TAKE.' : 'TAKE n\'est pas utilisé : chaque clic sur une source commute directement (case « Utiliser TAKE »).', 'vh:take'); } }, 'TAKE');
  const cancel = el('button', { type: 'button', class: 'btn small', onclick: () => { if (SW.pend) explain(`Source préparée abandonnée : la sortie ${SW.out} garde sa source.`, 'vh:take'); SW.pend = null; } }, 'Annuler');
  const lockBtn = el('button', { type: 'button', class: 'btn small vh-lockbtn', onclick: () => toggleLock(SW.out) }, lockIcon(), el('span', {}, 'Verrouiller'));
  const status = el('div', { class: 'vh-status lcd amber' });
  const labOut = el('div', { class: 'lab' }), labIn = el('div', { class: 'lab' });
  const monOut = el('div', { class: 'monwrap vh-monw' }, labOut, el('div', { class: 'mon vh-smon', 'data-gl': 'VH:OUTSEL' }));
  const monIn = el('div', { class: 'monwrap vh-monw' }, labIn, el('div', { class: 'mon vh-smon', 'data-gl': 'VH:INSEL' }));
  const root = el('div', { class: 'vh-app vh-ctl', role: 'region', 'aria-label': 'Logiciel Videohub Control' },
    el('div', { class: 'vh-title' }, el('span', { class: 'vh-dots', 'aria-hidden': 'true' }, el('i'), el('i'), el('i')), el('b', {}, 'Videohub Control'), el('span', { class: 'vh-conn' }, el('i', { class: 'dot green' }), `${VH_MODEL} · ${VH_NET.ip} · connecté`)),
    el('div', { class: 'vh-body' },
      el('div', { class: 'vh-top' }, monOut, monIn,
        el('div', { class: 'vh-acts' }, status, el('div', { class: 'hwrow' }, take, cancel, lockBtn),
          el('label', { class: 'vh-chk', for: 'vh-usetake' }, takeChk, el('span', {}, 'Utiliser TAKE'), q('take')))),
      el('h3', { class: 'vh-h' }, 'Destinations (sorties)', q('point-croisement'), el('small', {}, 'choisir d\'abord la sortie')), dests,
      el('h3', { class: 'vh-h' }, 'Sources (entrées)', q('etiquette'), el('small', {}, 'puis la source qu\'elle doit recevoir')), srcs));
  const last = new Map();
  const set = (node, cls, l, s, title, pressed = null) => {
    const k = cls + '|' + l + '|' + s + '|' + title; if (last.get(node) === k) return; last.set(node, k);
    node.className = cls; node.children[1].textContent = l; node.children[2].textContent = s; node.title = title;
    if (pressed != null) node.setAttribute('aria-pressed', String(pressed));
    const lk = node.querySelector('.vh-lk'); if (lk) lk.className = 'vh-lk ' + (/ lk-O/.test(cls) ? 'own' : / lk-L/.test(cls) ? 'other' : 'off');
  };
  return {
    root,
    update() {
      takeChk.checked = VH.take;
      const o = SW.out, xps = Array.from({ length: VH_N }, (_, i) => xpOf(i + 1)), cur = xps[o - 1], lk = lockState(o);
      const uses = new Array(VH_N + 1).fill(0); for (const x of xps) if (x) uses[x]++;
      for (let n = 1; n <= VH_N; n++) {
        const p = outPlan(n), x = xps[n - 1], l = lockState(n);
        set(DB[n - 1], 'vh-b' + (n === o ? ' sel' : '') + (p.dest ? '' : ' free') + (l !== 'U' ? ' locked lk-' + l : ''), outLabel(n), x ? '← ' + inLabel(x) : '—', `Sortie ${n} ${outLabel(n)}, reçoit ${x ? 'entrée ' + x + ' ' + inLabel(x) : 'rien'}${l !== 'U' ? ', verrouillée' : ''}`, n === o);
        const ip = inPlan(n), t = ip.live ? tallyOf(ip.src) : 0, nsig = sigOf(n) === 'aucun signal', u = uses[n];
        set(SB[n - 1], 'vh-b' + (n === cur ? ' cur' : '') + (n === SW.pend ? ' pend' : '') + (nsig ? ' nosig' : '') + (t === 2 ? ' t-pgm' : t === 1 ? ' t-pvw' : ''), inLabel(n), nsig ? 'pas de signal' : u ? u + ' sortie' + (u > 1 ? 's' : '') : '', `Entrée ${n} ${inLabel(n)}${nsig ? ', pas de signal' : ''}${n === cur ? ', source actuelle de la sortie choisie' : ''}${n === SW.pend ? ', préparée : TAKE pour valider' : ''}`);
      }
      const st = `OUT ${o} ${outLabel(o)} ← IN ${cur || '--'} ${cur ? inLabel(cur) : ''}${SW.pend ? `   ⇒  IN ${SW.pend} ${inLabel(SW.pend)} : TAKE ?` : ''}`;
      if (status.textContent !== st) status.textContent = st;
      take.className = 'vh-take' + (SW.pend ? ' armed' : '');
      take.disabled = !VH.take; cancel.disabled = !SW.pend;
      const lt = lk === 'U' ? 'Verrouiller la sortie ' + o : lk === 'O' ? 'Déverrouiller la sortie ' + o : 'Forcer le déverrouillage ' + o;
      if (lockBtn.lastChild.textContent !== lt) lockBtn.lastChild.textContent = lt;
      lockBtn.firstChild.className = 'vh-lk ' + ({ U: 'off', O: 'own', L: 'other' }[lk]);
      const a = `Sortie ${o} · ${outLabel(o)} reçoit`, b = SW.pend ? `Source préparée : IN ${SW.pend} · ${inLabel(SW.pend)}` : `Source actuelle : IN ${cur || '--'} · ${cur ? inLabel(cur) : 'aucune'}`;
      if (labOut.textContent !== a) labOut.textContent = a;
      if (labIn.textContent !== b) labIn.textContent = b;
    },
  };
}
function swSource(m) {
  const n = SW.out;
  if (lockState(n) !== 'U' || !VH.take) { doRoute(n, m); return; }
  if (m === xpOf(n)) { SW.pend = null; explain(`${cap(descIn(m))} est déjà la source de la sortie ${n} : rien à commuter.`, 'vh:take'); return; }
  SW.pend = m;
  explain(`Source préparée : ${descIn(m)} pour la ${descOut(n)}. Elle clignote, TAKE aussi : rien n'est commuté tant que tu ne valides pas (Annuler pour renoncer). C'est la sécurité contre les fausses manœuvres.`, 'vh:take');
}

// ---------------- monitoring : mosaïques rendues dans une texture ----------------
const MW = 1024, MH = 520, COLS = 8, ROWS = 5, CW = 128, CH = 104;
const FONT = '"Archivo Narrow", "Arial Narrow", sans-serif', MONO = '"B612 Mono", ui-monospace, monospace';
const tileMat = () => new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, uGain: { value: 1.1 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform sampler2D map; uniform float uGain; varying vec2 vUv; void main(){ gl_FragColor = vec4(clamp(texture2D(map, vUv).rgb * uGain, 0.0, 1.0), 1.0); }',
  depthTest: false, depthWrite: false,
});
function drawLock(g, x, y, c) {
  g.fillStyle = c; g.strokeStyle = c; g.lineWidth = 2.4;
  g.beginPath(); g.arc(x + 6, y + 6, 4, Math.PI, 0); g.stroke();
  g.fillRect(x, y + 6, 12, 9);
}
function makeMosaic(kind) {
  const rt = new THREE.WebGLRenderTarget(MW, MH, { type: THREE.UnsignedByteType, depthBuffer: false });
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(0, MW, MH, 0, -10, 10);
  const geo = new THREE.PlaneGeometry(CW - 4, 70);
  const tiles = [];
  for (let i = 0; i < VH_N; i++) {
    const c = i % COLS, r = Math.floor(i / COLS), x = c * CW, y = r * CH;
    const m = new THREE.Mesh(geo, tileMat()); m.position.set(x + CW / 2, MH - y - 2 - 35, 0); scene.add(m);
    tiles.push({ n: i + 1, x, y, r, m });
  }
  const canvas = document.createElement('canvas'); canvas.width = MW; canvas.height = MH;
  const tex = new THREE.CanvasTexture(canvas); tex.generateMipmaps = false; tex.minFilter = THREE.LinearFilter;
  const ovGeo = new THREE.PlaneGeometry(MW, MH);
  const ov = new THREE.Mesh(ovGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
  ov.position.set(MW / 2, MH / 2, 1); ov.renderOrder = 5; scene.add(ov);
  return { kind, rt, scene, cam, geo, ovGeo, tiles, canvas, g: canvas.getContext('2d'), tex, ov, row: 0, key: '', inited: false, el: /** @type {HTMLElement | null} */ (null), hit: /** @type {HTMLElement | null} */ (null) };
}
// état d'une vignette : image, étiquette, tally, alarme, verrou, sélection
function tileInfo(M, n) {
  if (M.kind === 'in') {
    const p = inPlan(n), r = inRes(n), t = p.live ? tallyOf(p.src) : 0;
    return { r, num: n, lab: inLabel(n), sub: '', t, alarm: !p.live ? 'PAS DE SIGNAL' : r.none ? 'PAS DE SIGNAL' : r.alarm && !['MIRE', 'BARRES'].includes(r.alarm) ? r.alarm : '', lk: 'U', sel: n === SW.pend ? 'pend' : n === xpOf(SW.out) ? 'cur' : '' };
  }
  const x = xpOf(n), r = outRes(n), p = outPlan(n);
  const src = x ? srcOfIn(x) : null;
  return { r, num: n, lab: outLabel(n), sub: x ? '← ' + x : '—', t: src && x && inPlan(x).live ? tallyOf(src) : 0, alarm: !x ? 'AUCUNE SOURCE' : r.none || !inPlan(x).live ? 'PAS DE SIGNAL' : r.alarm && !['MIRE', 'BARRES'].includes(r.alarm) ? r.alarm : '', lk: lockState(n), sel: n === SW.out ? 'sel' : '', free: !p.dest };
}
function drawOverlay(M, infos, focus) {
  const g = M.g; g.clearRect(0, 0, MW, MH);
  g.textBaseline = 'middle';
  for (const T of M.tiles) {
    const I = infos[T.n - 1]; const x = T.x, y = T.y;
    // bandeau d'étiquette (opaque : il ne s'accumule pas d'une image à l'autre)
    g.fillStyle = '#0b0e11'; g.fillRect(x, y + 72, CW, 32);
    g.fillStyle = I.free ? '#5d666e' : M.kind === 'in' ? '#3a4a58' : '#4a3e22'; g.fillRect(x + 3, y + 75, 26, 24);
    g.fillStyle = '#ffffff'; g.font = `400 13px ${MONO}`; g.textAlign = 'center'; g.fillText(String(T.n), x + 16, y + 88);
    g.textAlign = 'left'; g.font = `700 15px ${FONT}`; g.fillStyle = I.free ? '#aeb6bd' : '#f2f5f7';
    let lab = I.lab; while (g.measureText(lab).width > (M.kind === 'out' ? 62 : 90) && lab.length > 3) lab = lab.slice(0, -1);
    g.fillText(lab, x + 33, y + 88);
    if (M.kind === 'out') { g.font = `400 11px ${MONO}`; g.fillStyle = '#c6ced4'; g.textAlign = 'right'; g.fillText(I.sub, x + CW - (I.lk !== 'U' ? 20 : 4), y + 88); g.textAlign = 'left'; }
    if (I.lk !== 'U') drawLock(g, x + CW - 16, y + 79, I.lk === 'L' ? '#ff5a4f' : '#ffb020');
    // tally sur l'image
    if (I.t) { g.strokeStyle = I.t === 2 ? '#ff2a2a' : '#25d55a'; g.lineWidth = 4; g.strokeRect(x + 4, y + 4, CW - 8, 66); }
    // alarme
    if (I.alarm) { g.font = `700 11px ${FONT}`; const w = Math.min(CW - 10, g.measureText(I.alarm).width + 10); g.fillStyle = '#c4161c'; g.fillRect(x + CW - w - 5, y + 6, w, 16); g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.fillText(I.alarm, x + CW - w / 2 - 5, y + 14.5); g.textAlign = 'left'; }
    // sélection : destination choisie (ambre), source actuelle (blanc), source préparée (rouge)
    if (I.sel) { g.strokeStyle = I.sel === 'sel' ? '#ffb020' : I.sel === 'pend' ? '#ff3b30' : '#f3f1e8'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, CW - 3, CH - 3); }
    if (focus === T.n) { g.setLineDash([6, 4]); g.strokeStyle = '#4cc3e6'; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, CW - 8, CH - 8); g.setLineDash([]); }
  }
  M.tex.needsUpdate = true;
}
// une rangée par appel (rafraîchissement tournant) ; toute la mosaïque quand l'habillage change
function renderMosaic(M) {
  if (!M.el || !renderer) return;
  if (!M.el.isConnected || M.el.offsetParent === null) return;
  const b = M.el.getBoundingClientRect(); if (b.bottom < 0 || b.top > window.innerHeight || b.width < 8) return;
  const infos = M.tiles.map((T) => tileInfo(M, T.n));
  const fe = /** @type {HTMLElement | null} */ (document.activeElement);
  const focus = fe && M.hit && M.hit.contains(fe) ? +(fe.dataset.out || fe.dataset.in || 0) : 0;
  const key = infos.map((I) => `${I.lab}|${I.sub}|${I.t}|${I.alarm}|${I.lk}|${I.sel}`).join(';') + '|' + focus;
  const full = !M.inited || key !== M.key;
  if (full) { drawOverlay(M, infos, focus); M.key = key; }
  const rows = full ? [0, 1, 2, 3, 4] : [M.row];
  for (const T of M.tiles) if (rows.includes(T.r)) { const r = infos[T.n - 1].r; T.m.material.uniforms.map.value = r.tex; T.m.material.uniforms.uGain.value = 1.1 * r.scale; }
  M.rt.scissorTest = !full;
  if (!full) M.rt.scissor.set(0, MH - (M.row + 1) * CH, MW, CH);
  renderer.setRenderTarget(M.rt); renderer.render(M.scene, M.cam); renderer.setRenderTarget(null);
  M.rt.scissorTest = false;
  M.inited = true; M.row = (M.row + 1) % ROWS;
}
function disposeMosaic(M) {
  M.rt.dispose(); M.geo.dispose(); M.ovGeo.dispose(); M.tex.dispose(); M.ov.material.dispose();
  for (const T of M.tiles) T.m.material.dispose();
}
function buildMonitoring(MIN, MOUT) {
  const mos = (M, title, sub) => {
    const mon = el('div', { class: 'mon vh-mosmon', 'data-gl': 'VH:MON:' + M.kind });
    const hit = el('div', { class: 'vh-hit ' + M.kind, role: 'group', 'aria-label': title });
    for (let n = 1; n <= VH_N; n++) {
      const b = el('button', { type: 'button', ['data-' + (M.kind === 'in' ? 'in' : 'out')]: n, 'aria-label': `${M.kind === 'in' ? 'Entrée' : 'Sortie'} ${n}`, onclick: () => monPick(M.kind, n) });
      b.addEventListener('focus', () => { M.key = ''; }); b.addEventListener('blur', () => { M.key = ''; });
      hit.append(b);
    }
    M.el = mon; M.hit = hit;
    return el('section', { class: 'vh-mos ' + M.kind }, el('h3', { class: 'vh-h' }, title, el('small', {}, sub)), el('div', { class: 'vh-mosbox' }, mon, hit));
  };
  const secIn = mos(MIN, 'Entrées 1 à 40 (sources)', 'ce qui arrive sur chaque entrée de la grille');
  const secOut = mos(MOUT, 'Sorties 1 à 40 (destinations)', 'ce que reçoit chaque sortie ; « ← 24 » : l\'entrée routée');
  const segBtn = (k, l) => el('button', { type: 'button', 'aria-pressed': String(SW.mon === k), onclick: () => { SW.mon = k; apply(); } }, l);
  const seg = el('div', { class: 'seg vh-seg', role: 'group', 'aria-label': 'Mosaïques affichées' }, segBtn('both', 'Entrées et sorties'), segBtn('in', 'Entrées'), segBtn('out', 'Sorties'));
  const apply = () => { secIn.hidden = SW.mon === 'out'; secOut.hidden = SW.mon === 'in'; for (const b of seg.children) b.setAttribute('aria-pressed', String(b.textContent === { both: 'Entrées et sorties', in: 'Entrées', out: 'Sorties' }[SW.mon])); };
  apply();
  const legend = el('p', { class: 'note vh-legend' }, el('span', { class: 'vh-sw red' }), 'à l\'antenne (PGM) ', el('span', { class: 'vh-sw green' }), 'en preview (PVW) ', el('span', { class: 'vh-sw amber' }), 'destination choisie ', el('span', { class: 'vh-sw white' }), 'sa source ', el('span', { class: 'vh-sw alarm' }), 'alarme · cadenas : sortie verrouillée. Les vignettes se rafraîchissent une rangée à la fois.');
  return el('div', { class: 'vh-monitor' }, el('div', { class: 'hwrow' }, seg, q('grille')), legend, secIn, secOut);
}
function monPick(kind, n) {
  if (kind === 'in') {
    VH_MON.pickIn = n;
    const outs = outsOfIn(n), p = inPlan(n);
    explain(`Monitoring, ${descIn(n)} : ${sigOf(n)}${p.from ? ` (câblée depuis : ${p.from})` : ''}. ${outs.length ? `Elle alimente ${outs.length} sortie${outs.length > 1 ? 's' : ''} : ${outs.slice(0, 8).join(', ')}${outs.length > 8 ? '…' : ''}.` : 'Elle n\'est routée sur aucune sortie.'} L'étiquette doit correspondre à l'image : sinon, on route la mauvaise source en croyant bien faire.`, 'vh:mon');
  } else {
    VH_MON.pickOut = n; SW.out = n; SW.pend = null;
    const x = xpOf(n), p = outPlan(n);
    explain(`Monitoring, ${descOut(n)}${p.dest ? ` (${p.to})` : ' (libre)'} : elle reçoit ${x ? descIn(x) : 'rien'}${lockState(n) !== 'U' ? ', et elle est verrouillée' : ''}. Elle est maintenant la destination choisie dans Videohub Control.`, 'vh:mon');
  }
}

// ---------------- matrice des points de croisement ----------------
function buildMatrix() {
  const L = 150, TOP = 96, C = 13;
  const cv = el('canvas', { class: 'vh-mx', width: L + VH_N * C + 8, height: TOP + VH_N * C + 8, role: 'img', 'aria-label': 'Matrice des points de croisement : une ligne par sortie, une colonne par entrée ; un point = l\'entrée que reçoit la sortie' });
  const g = cv.getContext('2d');
  let key = '';
  cv.addEventListener('click', (e) => {
    const b = cv.getBoundingClientRect(); const sx = cv.width / b.width, sy = cv.height / b.height;
    const col = Math.floor(((e.clientX - b.left) * sx - L) / C) + 1, row = Math.floor(((e.clientY - b.top) * sy - TOP) / C) + 1;
    if (col < 1 || col > VH_N || row < 1 || row > VH_N) return;
    SW.out = row; SW.pend = null; swSource(col);
  });
  const draw = () => {
    g.clearRect(0, 0, cv.width, cv.height);
    g.fillStyle = '#101418'; g.fillRect(0, 0, cv.width, cv.height);
    g.textBaseline = 'middle';
    for (let i = 1; i <= VH_N; i++) {
      const y = TOP + (i - 1) * C, x = L + (i - 1) * C;
      if (i === SW.out) { g.fillStyle = 'rgba(255,176,32,.16)'; g.fillRect(0, y, cv.width, C); }
      if (lockState(i) !== 'U') { g.fillStyle = 'rgba(240,55,44,.16)'; g.fillRect(L, y, VH_N * C, C); }
      if (i === SW.pend) { g.fillStyle = 'rgba(240,55,44,.22)'; g.fillRect(x, TOP, C, VH_N * C); }
      g.fillStyle = i === SW.out ? '#ffd38a' : outPlan(i).dest ? '#d9dee2' : '#8f99a2'; g.font = `600 11px ${FONT}`; g.textAlign = 'right';
      g.fillText(`${outLabel(i)}  ${i}`, L - 6, y + C / 2 + 0.5);
      g.save(); g.translate(x + C / 2 + 1, TOP - 6); g.rotate(-Math.PI / 2); g.textAlign = 'left'; g.fillStyle = inPlan(i).live ? '#d9dee2' : '#8f99a2'; g.fillText(`${i}  ${inLabel(i)}`, 0, 0); g.restore();
    }
    g.strokeStyle = '#2b333b'; g.lineWidth = 1;
    for (let i = 0; i <= VH_N; i++) { g.globalAlpha = i % 5 === 0 ? 1 : 0.45; g.beginPath(); g.moveTo(L + i * C + 0.5, TOP); g.lineTo(L + i * C + 0.5, TOP + VH_N * C); g.moveTo(L, TOP + i * C + 0.5); g.lineTo(L + VH_N * C, TOP + i * C + 0.5); g.stroke(); }
    g.globalAlpha = 1;
    for (let o = 1; o <= VH_N; o++) {
      const x = xpOf(o); if (!x) continue;
      g.fillStyle = lockState(o) !== 'U' ? '#ff5a4f' : o === SW.out ? '#ffb020' : '#4cc3e6';
      g.beginPath(); g.arc(L + (x - 1) * C + C / 2 + 0.5, TOP + (o - 1) * C + C / 2 + 0.5, 4.2, 0, 7); g.fill();
    }
  };
  const root = el('div', { class: 'vh-matrix' },
    el('p', { class: 'note' }, 'Vue pédagogique de la grille : une ligne par sortie, une colonne par entrée. Chaque ligne a un seul point (une sortie ne reçoit qu\'une source) ; une colonne peut en avoir plusieurs (une source vers plusieurs destinations). Un clic sur une case choisit la sortie et la source (avec TAKE si l\'option est active).', q('point-croisement')),
    el('div', { class: 'vh-mxwrap', tabindex: 0, role: 'region', 'aria-label': 'Matrice 40 × 40 (défilante)' }, cv));
  return { root, update(k) { if (k !== key && cv.offsetParent !== null) { key = k; draw(); } } };
}

// ---------------- Videohub Setup ----------------
function buildSetup() {
  const inRows = [], outRows = [];
  const inBody = el('tbody'), outBody = el('tbody');
  for (let n = 1; n <= VH_N; n++) {
    const inp = el('input', { type: 'text', maxlength: 20, 'aria-label': `Étiquette de l'entrée ${n}`, spellcheck: 'false' });
    inp.addEventListener('change', () => { const before = inLabel(n); setInLabel(n, inp.value); inp.value = inLabel(n); explain(`Étiquette de l'entrée ${n} : « ${before} » → « ${inLabel(n)} ». L'étiquette n'est qu'un nom enregistré dans la grille : elle ne change ni le câblage ni l'image. Une étiquette fausse fait router la mauvaise source : compare-la avec le câblage et le monitoring.`, 'vh:label'); });
    const from = el('td', { class: 'note' }), sig = el('td');
    inRows.push({ inp, from, sig }); inBody.append(el('tr', {}, el('th', { scope: 'row' }, String(n)), el('td', {}, inp), from, sig));
    const outp = el('input', { type: 'text', maxlength: 20, 'aria-label': `Étiquette de la sortie ${n}`, spellcheck: 'false' });
    outp.addEventListener('change', () => { const before = outLabel(n); setOutLabel(n, outp.value); outp.value = outLabel(n); explain(`Étiquette de la sortie ${n} : « ${before} » → « ${outLabel(n)} ». Elle apparaît sur la façade, dans Videohub Control et chez tous les clients du réseau.`, 'vh:label'); });
    const to = el('td', { class: 'note' }), lk = el('button', { type: 'button', class: 'btn small vh-lkcell', onclick: () => toggleLock(n) });
    outRows.push({ outp, to, lk }); outBody.append(el('tr', {}, el('th', { scope: 'row' }, String(n)), el('td', {}, outp), to, el('td', {}, lk)));
  }
  const pre = el('pre', { class: 'vh-proto', tabindex: 0, role: 'region', 'aria-label': 'Blocs du protocole Ethernet envoyés par la grille' });
  const net = el('dl', { class: 'kv' });
  // liaisons : format, reclocking, référence (chacun avec sa fiche « ? »)
  const fmtDd = el('dd');
  const link = el('dl', { class: 'kv' },
    el('dt', {}, 'Format des liaisons', q('12g-sdi')), fmtDd,
    el('dt', {}, 'Sorties', q('reclocking')), el('dd', {}, '40, reclockées (signal régénéré)'),
    el('dt', {}, 'Référence', q('commutation-propre')), el('dd', {}, 'REF IN : tri-level du générateur de synchro, commutation au top image'));
  for (const [k, v] of [['Nom', VH_NET.name], ['Adresse IP', VH_NET.ip], ['Masque', VH_NET.mask], ['Passerelle', VH_NET.gw], ['DHCP', VH_NET.dhcp ? 'oui' : 'non (adresse fixe)'], ['Port de contrôle', `TCP ${VH_NET.port} (protocole Videohub)`], ['Clients', 'Videohub Control (ce poste), façade']]) net.append(el('dt', {}, k), el('dd', {}, v));
  const root = el('div', { class: 'vh-setup' },
    el('div', { class: 'panelgrid' },
      el('div', { class: 'hwpanel' }, el('h3', {}, 'Réseau', q('protocole-videohub')), net, el('p', { class: 'note' }, 'Valeurs du simulateur : à aligner sur le plan d\'adressage du réseau de contrôle du car.')),
      el('div', { class: 'hwpanel' }, el('h3', {}, 'Liaisons'), link),
      el('div', { class: 'hwpanel' }, el('h3', {}, 'Configuration du car'),
        el('p', { class: 'note' }, 'Étiquettes d\'origine et routage enregistré du car (les sorties verrouillées ne bougent pas).'),
        el('div', { class: 'hwrow' },
          el('button', { type: 'button', class: 'btn small', onclick: () => { resetLabels(); explain('Étiquettes du car rétablies : chaque entrée et chaque sortie porte le nom de ce qui y est câblé, comme sur la liste de câblage.', 'vh:label'); } }, 'Rétablir les étiquettes du car'),
          el('button', { type: 'button', class: 'btn small', onclick: recallCar }, 'Rappeler le routage du car')))),
    el('div', { class: 'panelgrid vh-tables' },
      el('div', { class: 'hwpanel' }, el('h3', {}, 'Entrées', q('etiquette'), el('small', {}, ' étiquette, câblage, signal')), el('div', { class: 'vh-tblwrap', tabindex: 0, role: 'region', 'aria-label': 'Étiquettes des entrées' }, el('table', { class: 'tbl vh-tbl' }, el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'N°'), el('th', { scope: 'col' }, 'Étiquette'), el('th', { scope: 'col' }, 'Câblée depuis'), el('th', { scope: 'col' }, 'Signal'))), inBody))),
      el('div', { class: 'hwpanel' }, el('h3', {}, 'Sorties', q('verrou-sortie'), el('small', {}, ' étiquette, destination, verrou')), el('div', { class: 'vh-tblwrap', tabindex: 0, role: 'region', 'aria-label': 'Étiquettes et verrous des sorties' }, el('table', { class: 'tbl vh-tbl' }, el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'N°'), el('th', { scope: 'col' }, 'Étiquette'), el('th', { scope: 'col' }, 'Câblée vers'), el('th', { scope: 'col' }, 'Verrou'))), outBody)))),
    el('div', { class: 'hwpanel' }, el('h3', {}, 'Protocole Ethernet (TCP 9990)', q('protocole-videohub')),
      el('p', { class: 'note' }, 'Ce que la grille envoie à un client qui se connecte, puis à chaque changement. Ports numérotés à partir de 0 : « 30 23 » = sortie 31 ← entrée 24. Verrous : U libre, O verrouillée par ce client, L par un autre.'), pre));
  let lastSig = 0;
  return {
    root,
    update(force) {
      if (root.offsetParent === null) return;
      const now = performance.now(); if (!force && now - lastSig < 500) return; lastSig = now;
      for (let n = 1; n <= VH_N; n++) {
        const R = inRows[n - 1], O = outRows[n - 1], p = inPlan(n), o = outPlan(n), l = lockState(n);
        if (document.activeElement !== R.inp && R.inp.value !== inLabel(n)) R.inp.value = inLabel(n);
        R.inp.classList.toggle('changed', !!VH.labels.in[n]);
        const f = p.from || 'rien de câblé'; if (R.from.textContent !== f) R.from.textContent = f;
        const s = sigOf(n), st = s === 'signal présent' ? FMT() : s; if (R.sig.textContent !== st) { R.sig.textContent = st; R.sig.className = s === 'signal présent' ? '' : 'err'; }
        if (document.activeElement !== O.outp && O.outp.value !== outLabel(n)) O.outp.value = outLabel(n);
        O.outp.classList.toggle('changed', !!VH.labels.out[n]);
        const t = o.to || 'rien de câblé'; if (O.to.textContent !== t) O.to.textContent = t;
        const lt = l === 'U' ? 'U · verrouiller' : l === 'O' ? 'O · déverrouiller' : 'L · forcer'; if (O.lk.textContent !== lt) { O.lk.textContent = lt; O.lk.className = 'btn small vh-lkcell lk-' + l; O.lk.title = `Sortie ${n} : ${l === 'U' ? 'libre (U), la verrouiller' : l === 'O' ? 'verrouillée par ce poste (O), la déverrouiller' : 'verrouillée par un autre poste (L), forcer le déverrouillage'}`; }
      }
      const txt = protocolText(); if (pre.textContent !== txt) pre.textContent = txt;
      const f = S.format === 'UHD' ? '2160p50 en 12G-SDI (11,88 Gb/s)' : S.format === 'HD' ? '1080p50 en 3G-SDI (2,97 Gb/s) ; 12G-SDI en UHD' : '1080i50 en HD-SDI (1,485 Gb/s) ; 12G-SDI en UHD'; if (fmtDd.textContent !== f) fmtDd.textContent = f;
    },
  };
}
function recallCar() {
  // le routage enregistré du car, sauf sur les sorties verrouillées
  const keep = {};
  for (const n in VH.locks) { const p = outPlan(+n); if (p.dest) keep[p.dest] = ROUTER.map[p.dest]; }
  ROUTER.customMV = false; ROUTER.customREC = false; defaultRouting(true);
  for (const d in keep) { if (keep[d]) ROUTER.map[d] = keep[d]; else delete ROUTER.map[d]; }
  VH.xp = {}; emit('router', {});
  explain(`Routage du car rappelé : chaque sortie reprend la source prévue (caméras sur le mélangeur, PGM sur les départs, clean feed sur l'écran géant…).${Object.keys(keep).length ? ' Les sorties verrouillées n\'ont pas bougé.' : ''} Sur une Videohub, on enregistre et on recharge ces configurations avec Videohub Setup.`, 'vh:set');
  toast('Routage du car rappelé', 'good');
}

// ---------------- le poste ----------------
/** @param {HTMLElement} body @param {any} arg @param {any} ctx */
export function buildVideohubStation(body, arg, ctx) {
  const F = buildFace();
  ctx.dock.append(F.face);
  const MIN = makeMosaic('in'), MOUT = makeMosaic('out');
  EXTRA_SLOTS['VH:LCD'] = () => slot(FP.mode === 'menu' ? BLACK() : FP.mode === 'in' && FP.inp ? inRes(FP.inp) : outRes(FP.out));
  EXTRA_SLOTS['VH:OUTSEL'] = () => slot(outRes(SW.out));
  EXTRA_SLOTS['VH:INSEL'] = () => slot(SW.pend ? inRes(SW.pend) : inRes(xpOf(SW.out)));
  EXTRA_SLOTS['VH:MON:in'] = () => ({ tex: MIN.rt.texture, gain: 1 });
  EXTRA_SLOTS['VH:MON:out'] = () => ({ tex: MOUT.rt.texture, gain: 1 });
  const CTL = buildControl(), MX = buildMatrix(), SET = buildSetup();
  const MON = buildMonitoring(MIN, MOUT);
  const PAGES = { control: CTL.root, mon: MON, mx: MX.root, setup: SET.root };
  const TABS = [['control', 'Videohub Control'], ['mon', 'Monitoring'], ['mx', 'Matrice 40 × 40'], ['setup', 'Videohub Setup']];
  const tabs = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Grille Videohub' });
  const show = (k) => {
    SW.tab = k;
    for (const b of tabs.children) { const on = /** @type {HTMLElement} */ (b).dataset.k === k; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); }
    for (const p in PAGES) PAGES[p].hidden = p !== k;
    if (k === 'mon' && !SEEN.mon) { SEEN.mon = true; explain('Monitoring : les 40 entrées et les 40 sorties en vignettes vivantes, avec leur numéro et leur étiquette. Bord rouge : à l\'antenne ; vert : en preview ; bandeau rouge : alarme (pas de signal) ; cadenas : sortie verrouillée. C\'est ici qu\'on vérifie qu\'une étiquette correspond bien à l\'image.', 'vh:mon'); }
    if (k === 'setup' && !SEEN.setup) { SEEN.setup = true; explain(`Videohub Setup : étiquettes, verrous et réseau de la grille. Chaque liaison est un coaxial ${S.format === 'UHD' ? '12G-SDI (11,88 Gb/s : une image UHD sur un seul câble)' : S.format === 'HD' ? '3G-SDI (2,97 Gb/s pour le 1080p50)' : 'HD-SDI (1,485 Gb/s)'} ; chaque entrée détecte le format reçu et chaque sortie est reclockée : le signal est régénéré avant de repartir.`, 'vh:set'); }
    if (k === 'mx' && !SEEN.mx) { SEEN.mx = true; explain('Matrice : chaque point est un point de croisement (une sortie reliée à une entrée). Une ligne n\'a jamais qu\'un point ; une colonne peut en avoir plusieurs.', 'vh:mx'); }
    SET.update(true);
  };
  for (const [k, l] of TABS) tabs.append(el('button', { type: 'button', class: 'tab', role: 'tab', 'data-k': k, onclick: () => show(k) }, l));
  body.append(tabs, CTL.root, MON, MX.root, SET.root);
  if (arg && arg.tab && PAGES[arg.tab]) SW.tab = arg.tab;
  show(SW.tab);
  let mxKey = '', hello = false;
  return {
    update() {
      // le fil d'explications n'est branché qu'après la construction du poste
      if (!hello) { hello = true; explain(`Grille du car SDI : une ${VH_MODEL}, 40 entrées (les sources) et 40 sorties (les destinations), en ${S.format === 'UHD' ? '12G-SDI' : S.format === 'HD' ? '3G-SDI' : 'HD-SDI'}. Façade : OUT et une sortie, IN et une source (l'écran montre son image avant la commutation), puis TAKE. Ou le logiciel Videohub Control, sous la façade. Toujours la destination d'abord, la source ensuite.`, 'muted'); }
      F.update(); CTL.update(); SET.update(false);
      if (SW.tab === 'mx') {
        const k = Array.from({ length: VH_N }, (_, i) => xpOf(i + 1) + lockState(i + 1)).join(',') + SW.out + ',' + SW.pend + JSON.stringify(VH.labels) + S.format + S.cams.length;
        if (k !== mxKey) mxKey = k;
        MX.update(mxKey);
      }
      if (DIG.s && performance.now() - DIG.t > 3000) DIG.s = '';
      if (SW.tab === 'mon') for (const M of [MIN, MOUT]) M.hit.childNodes.forEach((b, i) => { const n = i + 1; const a = M.kind === 'in' ? `Entrée ${n} ${inLabel(n)}, ${sigOf(n)}` : `Sortie ${n} ${outLabel(n)}, reçoit ${xpOf(n) ? 'entrée ' + xpOf(n) + ' ' + inLabel(xpOf(n)) : 'rien'}`; const e = /** @type {HTMLElement} */ (b); if (e.getAttribute('aria-label') !== a) e.setAttribute('aria-label', a); });
    },
    frame() { if (SW.tab === 'mon') { renderMosaic(MIN); renderMosaic(MOUT); } },
    key(e) {
      const a = /** @type {HTMLElement | null} */ (document.activeElement);
      if (!a || !a.closest('.vh-face')) return false;
      const m = /^Digit(\d)$|^Numpad(\d)$/.exec(e.code); if (m) { fpDigit(+(m[1] ?? m[2])); return true; }
      return false;
    },
    close() {
      for (const k of ['VH:LCD', 'VH:OUTSEL', 'VH:INSEL', 'VH:MON:in', 'VH:MON:out']) delete EXTRA_SLOTS[k];
      disposeMosaic(MIN); disposeMosaic(MOUT);
    },
  };
}
// branché par ui/stations.js : le poste « grille » du car SDI
/** @type {null | ((body: HTMLElement, arg: any, ctx: any) => any)} */
export const buildVideohub = buildVideohubStation;
