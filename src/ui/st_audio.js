// @ts-check
import { S, on } from '../state.js';
import { el, clamp, fmt } from '../util.js';
import { hwBtn, selectEl, intercom } from './common.js';
import { explain } from './widgets.js';
import { AU, GROUPS, PLUG, MONO_PORTS, ST_PORTS, CANON_POS, MONITORS, voiceGain, startAudio, applyStrip, applyBuses, applyAll, setMonitor, setLineDelay, setFollow, setSend, setPatch, portsOf, portInfo, talkback, storeSnap, recallSnap, resetLoudness, avOffsetMs, avOk, AV_TOL, videoLatencyMs, EMB_OPTIONS, SOUND_PLAN, soundPlanOk, embLabel, faderLin, afvOpen, effMonitor, vcaDb } from '../audio.js';
import { CMT, SPK, setCommentary } from '../commentary.js';
import { sourceLabel } from '../pipeline.js';
import { openDevice } from '../equipment/viewer.js';
import { M } from '../match.js';

// ----------------------------------------------------------------------------------
// Poste son : console inspirée de la Studer Vista 1 (simulation pédagogique, non officielle).
//  · deux baies « Vistonics » de 10 tranches : l'écran au-dessus de chaque tranche porte ses commandes
//    (rouge = égaliseur, vert = dynamique, jaune = panoramique), FaderGlow le long des faders ;
//  · la Control Bay : vumètres, écoutes, talkback, et l'écran de la tranche sélectionnée (SEL) ;
//  · pages E/S et patch, bus et N-1, snapshots, commentaires, et « Comprendre la Vista 1 ».
// ----------------------------------------------------------------------------------
const SEC = { in: '#cbd5e1', eq: '#ef4444', dyn: '#22c55e', pan: '#facc15', aux: '#38bdf8' };
const BANDS = ['BAS', 'BAS-MÉD', 'HAUT-MÉD', 'HAUT'];
const BAND_TXT = ['corps et grave (le « sourd » d\'une foule, le coffre d\'une voix)', 'zone de « carton » et de boue (250 à 500 Hz) : on y creuse souvent un peu', 'présence et intelligibilité (2 à 4 kHz) : l\'impact du ballon, la diction', 'air et brillance (8 à 12 kHz)'];
const VIEW_TXT = {
  in: 'Écrans en vue ENTRÉE : sur chaque tranche, la molette du haut règle le GAIN d\'entrée, celle du bas un RETARD ; touches 48 V et Ø (polarité). C\'est par là que commence tout réglage : un bon niveau d\'entrée.',
  eq: 'Écrans en vue ÉGALISEUR (rouge) : les molettes règlent la fréquence et le gain de la bande choisie (1 à 4) sur toutes les tranches à la fois ; la courbe s\'affiche au-dessus. Touches EQ (en service) et HPF (passe-haut).',
  dyn: 'Écrans en vue DYNAMIQUE (vert) : seuil et ratio du compresseur, touches COMP et GATE. La courbe de transfert montre entrée → sortie, le point blanc le niveau actuel.',
  pan: 'Écrans en vue PAN · DÉPARTS (jaune) : panoramique ou balance, départs vers l\'international et les N-1 (rouge = erreur), AFV (audio suit la vidéo).',
};
const fdb = (v) => (v <= -59.5 ? '−∞' : (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), 1));
const fhz = (f) => (f >= 1000 ? fmt(f / 1000, f >= 10000 ? 0 : 1) + 'k' : Math.round(f) + '');
const sgn = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d);

// ---------------- molette Vistonics ----------------
function vknob(o) {
  const dial = el('div', { class: 'vk-dial' }, el('i'));
  const val = el('div', { class: 'vk-val' });
  const w = el('div', { class: 'vk', tabindex: 0, title: (o.title || o.label) + ' · glisser vers le haut / bas, molette, double-clic = valeur par défaut' }, el('div', { class: 'vk-lab' }, o.label), dial, val);
  w.style.setProperty('--c', o.color || '#cbd5e1');
  const toN = (v) => (o.log ? Math.log(v / o.min) / Math.log(o.max / o.min) : (v - o.min) / (o.max - o.min));
  const fromN = (n) => { n = clamp(n, 0, 1); let v = o.log ? o.min * Math.pow(o.max / o.min, n) : o.min + n * (o.max - o.min); if (o.step) v = Math.round(v / o.step) * o.step; if (o.log) v = Math.round(v); return clamp(v, o.min, o.max); };
  let last = null;
  w.sync = () => { const v = o.get(); if (v === last) return; last = v; dial.style.setProperty('--a', (clamp(toN(v), 0, 1) * 270) + 'deg'); val.textContent = o.fmt ? o.fmt(v) : String(v); };
  const change = (v) => { if (v === o.get()) return; o.set(v); w.sync(); if (o.after) o.after(v); };
  let drag = null;
  dial.addEventListener('pointerdown', (e) => { drag = { y: e.clientY, n: toN(o.get()) }; try { dial.setPointerCapture(e.pointerId); } catch (err) { /* rien */ } e.preventDefault(); w.focus(); });
  dial.addEventListener('pointermove', (e) => { if (drag) change(fromN(drag.n + (drag.y - e.clientY) / (e.shiftKey ? 600 : 160))); });
  const end = () => { drag = null; }; dial.addEventListener('pointerup', end); dial.addEventListener('pointercancel', end);
  w.addEventListener('wheel', (e) => { e.preventDefault(); change(fromN(toN(o.get()) - Math.sign(e.deltaY) * (e.shiftKey ? 0.005 : 0.025))); }, { passive: false });
  w.addEventListener('dblclick', () => { if (o.def != null) change(typeof o.def === 'function' ? o.def() : o.def); });
  w.addEventListener('keydown', (e) => {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
    if (d) { change(fromN(toN(o.get()) + d * 0.02)); e.preventDefault(); e.stopPropagation(); }
  });
  w.sync();
  return w;
}
// petite touche d'écran (allumée selon get())
function vbtn(label, color, get, onclick, title) {
  const b = el('button', { class: 'vb', title: title || label, onclick }, label);
  b.style.setProperty('--c', color);
  b.sync = () => b.classList.toggle('on', !!get());
  b.sync();
  return b;
}
// fader vertical avec bande FaderGlow
function vfader(get, set, color, label, min = -60, max = 10) {
  const f = el('input', { type: 'range', min, max, step: 0.5, class: 'vx-fader', 'aria-label': 'Fader ' + label });
  const glow = el('div', { class: 'vx-glow' }); glow.style.setProperty('--g', color);
  const scale = el('div', { class: 'vx-scale' }, ...['+10', '0', '−10', '−20', '−30', '−40', '−∞'].map((s) => el('span', {}, s)));
  const box = el('div', { class: 'vx-fbox' }, scale, f, glow);
  f.value = get();
  f.addEventListener('input', () => set(+f.value));
  box.sync = (lit) => { if (document.activeElement !== f) f.value = get(); glow.classList.toggle('lit', !!lit); };
  box.input = f; box.glow = glow;
  return box;
}

// ---------------- dessins (vumètres, courbes) ----------------
function meterDraw(cv, db, gr = 0, ovl = false) {
  const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
  g.fillStyle = '#05080a'; g.fillRect(0, 0, W, H);
  const y = (d) => H - clamp((d + 60) / 60, 0, 1) * H;
  const wIn = gr != null ? W - 4 : W;
  for (let i = 0; i < 30; i++) {
    const d0 = -60 + i * 2; if (d0 > db) break;
    g.fillStyle = d0 >= -3 ? '#ff3b30' : d0 >= -12 ? '#facc15' : '#22c55e';
    g.fillRect(1, y(d0 + 2) + 1, wIn - 2, Math.max(1, y(d0) - y(d0 + 2) - 1));
  }
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(0, y(-18), wIn, 1);
  if (gr != null) { g.fillStyle = '#05080a'; g.fillRect(W - 3, 0, 3, H); if (gr > 0.2) { g.fillStyle = '#22c55e'; g.fillRect(W - 3, 0, 3, clamp(gr / 20, 0, 1) * H); } }
  if (ovl) { g.fillStyle = '#ff3b30'; g.fillRect(0, 0, W, 5); }
}
const FREQS = new Float32Array(48).map((_, i) => 20 * Math.pow(1000, i / 47));
const MAG = new Float32Array(48), PH = new Float32Array(48), ACC = new Float32Array(48);
function eqCurve(cv, c, big = false) {
  const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H); g.fillStyle = '#070a0d'; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke();
  if (big) { for (const f of [100, 1000, 10000]) { const x = Math.log(f / 20) / Math.log(1000) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } g.fillStyle = '#7b8792'; g.font = '10px system-ui'; g.fillText('100 Hz', Math.log(5) / Math.log(1000) * W + 3, H - 4); g.fillText('1 kHz', Math.log(50) / Math.log(1000) * W + 3, H - 4); g.fillText('10 kHz', Math.log(500) / Math.log(1000) * W + 3, H - 4); g.fillText('+15', 2, 10); g.fillText('−15', 2, H - 14); }
  ACC.fill(1);
  if (c.N) {
    c.N.hpf.getFrequencyResponse(FREQS, MAG, PH); for (let i = 0; i < 48; i++) ACC[i] *= MAG[i];
    if (c.eq.on) for (const f of c.N.eq) { f.getFrequencyResponse(FREQS, MAG, PH); for (let i = 0; i < 48; i++) ACC[i] *= MAG[i]; }
  }
  g.strokeStyle = c.eq.on ? SEC.eq : '#7f1d1d'; g.lineWidth = big ? 2.5 : 1.5;
  g.beginPath();
  for (let i = 0; i < 48; i++) { const db = 20 * Math.log10(Math.max(1e-4, ACC[i])); const x = i / 47 * W, yy = H / 2 - clamp(db / 15, -1, 1) * (H / 2 - 2); if (i) g.lineTo(x, yy); else g.moveTo(x, yy); }
  g.stroke();
  if (big && c.eq.on) c.eq.b.forEach((b, i) => { const x = Math.log(b.f / 20) / Math.log(1000) * W; const yy = H / 2 - clamp(b.g / 15, -1, 1) * (H / 2 - 2); g.fillStyle = SEC.eq; g.beginPath(); g.arc(x, yy, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = '10px system-ui'; g.fillText(String(i + 1), x - 3, yy + 3.5); });
}
function dynCurve(cv, c, big = false) {
  const g = cv.getContext('2d'); const W = cv.width, H = cv.height;
  g.clearRect(0, 0, W, H); g.fillStyle = '#070a0d'; g.fillRect(0, 0, W, H);
  const X = (d) => (d + 60) / 60 * W, Y = (d) => H - (d + 60) / 60 * H;
  g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(0, H); g.lineTo(W, 0); g.stroke();
  g.strokeStyle = c.dyn.on || c.gate.on ? SEC.dyn : '#14532d'; g.lineWidth = big ? 2.5 : 1.5; g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const inp = -60 + i; let out = inp;
    if (c.gate.on && inp < c.gate.thr) out = inp - c.gate.range;
    if (c.dyn.on && inp > c.dyn.thr) out = c.dyn.thr + (inp - c.dyn.thr) / c.dyn.ratio;
    if (c.dyn.on) out += c.dyn.mk;
    if (i) g.lineTo(X(inp), Y(out)); else g.moveTo(X(inp), Y(out));
  }
  g.stroke();
  const p = clamp(c.peak, -60, 0); g.fillStyle = '#fff'; g.beginPath(); g.arc(X(p), Y(clamp(p - c.gr + (c.dyn.on ? c.dyn.mk : 0), -60, 0)), big ? 4 : 2.5, 0, Math.PI * 2); g.fill();
  if (big) { g.fillStyle = '#7b8792'; g.font = '10px system-ui'; g.fillText('entrée →', W - 52, H - 4); g.fillText('sortie', 3, 11); }
}

// ---------------- textes pédagogiques ----------------
function tGain(c) { const mic = c.kind === 'mic'; return `Gain d'entrée de ${c.short} : ${mic ? '+' + c.gain + ' dB (préampli micro)' : sgn(c.gain - c.defGain, 0) + ' dB (gain numérique)'}. Il règle le niveau AVANT tout traitement : vise des crêtes entre −18 et −10 dBFS sur le vumètre d'entrée, sans jamais allumer l'OVL rouge. Trop bas, le bruit de fond remonte quand on pousse le fader ; trop haut, la saturation est gravée dans le signal et aucun fader ne la retire.`; }
function t48(c) { const cond = portsOf(c.src).some((p) => PLUG[p] && PLUG[p].cond); return `Alimentation fantôme 48 V ${c.ph48 ? 'active' : 'coupée'} sur ${c.src}. ${cond ? (c.ph48 ? 'Le micro statique branché ici (' + portInfo(c.src) + ') est alimenté.' : 'ATTENTION : le micro statique branché ici n\'est plus alimenté, il ne délivre plus rien (vumètre à zéro).') : 'La source branchée ici (' + portInfo(c.src) + ') n\'en a pas besoin : on laisse le 48 V coupé sur les sources ligne et les micros dynamiques.'}`; }
function tPhase(c) { return c.st ? `Polarité du côté droit de ${c.short} ${c.phase ? 'INVERSÉE' : 'normale'}. Les deux micros d'un couple captent la même foule : si un côté est inversé, le corrélateur devient négatif et l'ambiance s'annule quand le programme est écouté en mono (récepteurs mono, smartphones). Touche MONO de l'écoute pour l'entendre.` : `Polarité de ${c.short} ${c.phase ? 'inversée' : 'normale'} : utile quand un câble ou un micro est câblé à l'envers, ou quand deux micros proches captent la même source.`; }
function tHpf(c) { return `Filtre passe-haut ${c.hpf.on ? 'actif à ' + c.hpf.f + ' Hz' : 'hors service'} sur ${c.short} : il coupe les graves inutiles (vent, vibrations, grondement de la foule, manipulations). Repères : canons 100 à 150 Hz, voix 80 à 120 Hz, couples d'ambiance 40 à 80 Hz.`; }
function tBand(c, i) { const b = c.eq.b[i]; return `Égaliseur de ${c.short}, bande ${i + 1} (${BANDS[i]}) : ${sgn(b.g)} dB à ${fhz(b.f)}Hz, Q ${fmt(b.q, 1)} — ${BAND_TXT[i]}. Rouge = égaliseur sur l'écran Vistonics. Corrige d'abord en coupant (−) plutôt qu'en ajoutant (+).`; }
function tComp(c) { return `Compresseur de ${c.short} ${c.dyn.on ? 'actif' : 'hors service'} : au-dessus de ${c.dyn.thr} dBFS, le niveau monte ${fmt(c.dyn.ratio, 1)} fois moins vite (ratio ${fmt(c.dyn.ratio, 1)}:1), attaque ${c.dyn.att} ms, retour ${c.dyn.rel} ms, gain de compensation ${sgn(c.dyn.mk, 0)} dB. Il resserre l'écart entre les mots forts et faibles d'un commentateur. Vert = dynamique sur l'écran Vistonics ; la barre verte du vumètre montre la réduction de gain.`; }
function tGate(c) { return `Gate / expandeur de ${c.short} ${c.gate.on ? 'actif' : 'hors service'} : sous ${c.gate.thr} dBFS, la tranche est atténuée de ${c.gate.range} dB. Sur les micros des commentateurs, il coupe la foule qui « repisse » dans le micro quand ils se taisent ; trop haut, il mange le début des mots.`; }
function tDelay(c) { return `Retard d'entrée de ${c.short} : ${c.delay} ms. Le son voyage à 343 m/s, soit environ 3 ms par mètre : on retarde une source proche pour la caler sur une source lointaine (ou sur une image en retard).`; }
function tPan(c) { const p = Math.round(c.pan * 100); return `${c.st ? 'Balance' : 'Panoramique'} de ${c.short} : ${p === 0 ? 'au centre' : Math.abs(p) + ' % à ' + (p < 0 ? 'gauche' : 'droite')}. Jaune = panoramique sur les Vistonics. Les canons se placent comme sur le plan large : but de gauche à gauche, but de droite à droite.`; }
function tFader(c) { const v = vcaDb(c); return `${c.short} à ${fdb(c.fader)} dB${v ? ` (+ VCA ${sgn(v)} dB)` : ''}. Le fader dose la source dans les bus ; 0 dB = gain unitaire. Les départs (INTL, N-1) sont pris après le fader : ils suivent le même dosage.${c.group === 'canon' && AU.autoCanon ? ' L\'assistant de suivi du jeu pilote ces faders motorisés : coupe-le (Control Bay) pour mixer les canons à la main.' : ''}`; }
const SEND_TXT = {
  pgm: (c) => `${c.short} ${c.pgm ? 'assigné au' : 'retiré du'} bus PGM (le son à l'antenne).`,
  intl: (c) => (c.intl ? (c.voice ? `${c.short} envoyé dans l'international : ERREUR, les diffuseurs étrangers entendraient une voix française par-dessus leurs commentateurs.` : `${c.short} envoyé dans l'international : correct, c'est un son d'ambiance ou d'effet.`) : `${c.short} retiré de l'international.${c.voice ? ' Correct : l\'international ne porte jamais de voix.' : ' Attention : l\'international doit garder toute l\'ambiance du stade.'}`),
  n1: (c) => (c.n1 ? (c.comm ? `${c.short} envoyé dans le N-1 COMMENTAIRE : ERREUR. Le commentateur s'entendrait dans son casque avec le retard de la liaison (écho, larsen). N-1 = « tout moins un ».` : `${c.short} envoyé dans le N-1 COMMENTAIRE : les commentateurs l'entendent dans leur casque.`) : `${c.short} retiré du N-1 COMMENTAIRE.${c.comm ? ' Correct.' : ''}`),
  nxs: (c) => (c.nxs ? (c.id === 'duplex' ? `Le retour studio envoyé dans le N-1 STUDIO : ERREUR, le présentateur s'entendrait en écho dans son oreillette.` : `${c.short} envoyé vers le studio (N-1 STUDIO).`) : `${c.short} retiré du N-1 STUDIO.${c.id === 'duplex' ? ' Correct : le studio ne doit pas recevoir sa propre voix.' : ''}`),
  nxb: (c) => (c.nxb ? (c.id === 'bt' ? 'La journaliste bord terrain envoyée dans son propre N-1 : ERREUR (écho dans son oreillette).' : `${c.short} envoyé dans l'oreillette du bord terrain (N-1 BT).`) : `${c.short} retiré du N-1 BORD TERRAIN.${c.id === 'bt' ? ' Correct.' : ''}`),
};
const sendBad = (c, b) => (b === 'intl' && c.voice && c.intl) || (b === 'n1' && c.comm && c.n1) || (b === 'nxs' && c.id === 'duplex' && c.nxs) || (b === 'nxb' && c.id === 'bt' && c.nxb);

// ---------------- poste ----------------
function monTxt(k) { return `Écoute sur ${AU.bus[k].label} : ${{ pgm: 'le programme, ce qui part à l\'antenne.', intl: 'l\'international : ambiance et effets, aucune voix.', n1: 'le N-1 des commentateurs : ce qu\'ils ont dans leur casque. Leurs voix ne doivent pas y être.', nxs: 'le N-1 du studio : ce que le présentateur entend dans son oreillette (tout sauf lui-même).', nxb: 'le N-1 du bord terrain : l\'oreillette de la journaliste.' }[k]}`; }

// ----------------------------------------------------------------------------------
// Les gestes de la console, communs à la vue 2D (ci-dessous) et à la console en 3D (poste3d/son.js) :
// chaque geste agit sur le son et s'explique dans le fil « Ce qui se passe ».
// ----------------------------------------------------------------------------------
export const AUACT = {
  fader(c, v) { c.fader = v; if (c.group === 'canon' && AU.autoCanon) { AU.autoCanon = false; explain('Tu as pris la main sur un canon : l\'assistant de suivi du jeu est coupé.', 'son:auto'); } applyStrip(c); explain(tFader(c), 'son:f' + c.id); },
  mute(c) { c.mute = !c.mute; applyStrip(c); explain(`${c.short} ${c.mute ? 'coupé (MUTE) : il disparaît du programme et de tous les départs.' : 'rétabli.'}`, 'son:mute'); },
  pfl(c) { startAudio(); c.pfl = !c.pfl; applyStrip(c); applyBuses(); explain(c.pfl ? `PFL ${c.short} : tu écoutes la tranche seule, avant son fader, sans rien changer à l'antenne. L'écoute bascule sur le bus PFL tant qu'une touche PFL est allumée.` : 'PFL relâché : l\'écoute revient sur le bus choisi.', 'son:pfl'); },
  sel(c) { AU.sel = c.id; explain(`SEL : ${c.label} s'affiche sur l'écran de la Control Bay, avec toutes ses commandes (patch, égaliseur 4 bandes, dynamique, départs, VCA).`, 'son:sel'); },
  /** plage du gain d'entrée : préampli micro 0 à +70 dB, sinon ±30 dB autour du gain nominal */
  gainRange(c) { return c.kind === 'mic' ? [0, 70] : [c.defGain - 30, c.defGain + 30]; },
  gain(c, v) { c.gain = v; applyStrip(c); explain(tGain(c), 'son:' + c.id + 'in'); },
  pan(c, v) { c.pan = v; applyStrip(c); explain(tPan(c), 'son:' + c.id + 'pan'); },
  master(v) { AU.master.fader = v; applyAll(); explain(`Master PGM à ${fdb(v)} dB : il agit sur tout le programme. Surveille la loudness intégrée (cible −23 LUFS).`, 'son:mpgm'); },
  vca(k, v) { const o = AU.vca[k]; o.fader = v; applyAll(); explain(`${o.label} à ${fdb(v)} dB : toutes ses tranches bougent ensemble (le VCA agit sur leurs gains, il ne mélange pas le son). Leurs faders ne bougent pas : l'écran montre « V » à côté de leur valeur.`, 'son:m' + k); },
  monitor(k) { startAudio(); setMonitor(k); explain(monTxt(k), 'son:mon'); },
  dim() { AU.dim = !AU.dim; applyBuses(); explain(AU.dim ? 'DIM : l\'écoute baisse de 20 dB (pour parler dans la cabine ou répondre à l\'intercom) sans toucher à l\'antenne.' : 'DIM relâché : écoute à niveau normal.', 'son:dim'); },
  mono() { AU.mono = !AU.mono; applyBuses(); explain(AU.mono ? `Écoute en MONO (G + D) : c'est ainsi que l'entendent les récepteurs mono et beaucoup de smartphones. Une ambiance en opposition de phase y disparaît. Corrélateur actuel : ${fmt(AU.corr, 2)}.` : 'Écoute stéréo rétablie.', 'son:mono'); },
  /** talkback maintenu vers un N-1 */
  talkback(k, on) { if (!on) { talkback(k, false); return; } startAudio(); talkback(k, true); explain(`Talkback (maintenu) vers ${AU.bus[k].label} : ton micro d'ordres part dans ce N-1 seulement (${AU.bus[k].dest}). Jamais dans le PGM ni l'international. Écoute ce N-1 pour entendre le « bip » simulé.`, 'son:tb'); },
  auto() { AU.autoCanon = !AU.autoCanon; explain(AU.autoCanon ? 'Assistant de suivi du jeu ACTIF (aide du simulateur) : les faders motorisés des six canons suivent le ballon, le plus proche est ouvert. Des automatismes de ce genre existent en production, mais beaucoup d\'ingénieurs du son « suivent le ballon » à la main.' : 'Assistant coupé : à toi de suivre le jeu avec les faders des canons (le canon le plus proche du ballon est indiqué au-dessus de sa tranche).', 'son:auto'); },
  lim() { AU.master.lim = !AU.master.lim; applyBuses(); explain(AU.master.lim ? 'Limiteur de sortie du PGM actif (−2 dBFS) : il protège la ligne contre les crêtes (un but, une frappe près d\'un canon). Il ne remplace pas un bon mixage : s\'il travaille en permanence, baisse le master.' : 'Limiteur du PGM contourné : une crête peut maintenant saturer le départ.', AU.master.lim ? 'son:lim' : 'warn'); },
};

/** vumètres de la Control Bay : PGM G/D, international, N-1, corrélation, loudness court terme, limiteur, écoute */
export function drawMeters(bridge) {
  const g = bridge.getContext('2d'); const W = bridge.width, H = bridge.height;
  g.fillStyle = '#05080a'; g.fillRect(0, 0, W, H);
  g.font = '600 12px system-ui'; g.textBaseline = 'middle';
  const bars = [['G', AU.master.peakL, '#22c55e'], ['D', AU.master.peakR, '#22c55e'], ['INT', AU.bus.intl.peak], ['N1C', AU.bus.n1.peak], ['N1S', AU.bus.nxs.peak], ['N1B', AU.bus.nxb.peak]];
  const bx = 6, bw = 22, bh = H - 24;
  bars.forEach(([l, dbv], i) => {
    const db = Number(dbv);
    const x = bx + i * (bw + 7) + (i >= 2 ? 8 : 0);
    g.fillStyle = '#10161b'; g.fillRect(x, 6, bw, bh);
    const lv = clamp((db + 60) / 60, 0, 1) * bh;
    const gr = g.createLinearGradient(0, 6 + bh, 0, 6); gr.addColorStop(0, '#16a34a'); gr.addColorStop(0.7, '#facc15'); gr.addColorStop(0.95, '#ff3b30');
    g.fillStyle = gr; g.fillRect(x + 2, 6 + bh - lv, bw - 4, lv);
    g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x, 6 + bh - (42 / 60) * bh, bw, 1);
    g.fillStyle = (i < 2 ? '#e5e7eb' : '#9fb0bf'); g.textAlign = 'center'; g.fillText(l, x + bw / 2, H - 8);
  });
  g.textAlign = 'left';
  // corrélateur
  const cx = 196, cw = W - cx - 10;
  g.fillStyle = '#9fb0bf'; g.fillText('CORRÉLATION G/D', cx, 12);
  g.fillStyle = '#10161b'; g.fillRect(cx, 20, cw, 14);
  const pos = cx + (AU.corr + 1) / 2 * cw;
  g.fillStyle = AU.corr < 0 ? '#ff3b30' : AU.corr < 0.3 ? '#facc15' : '#22c55e'; g.fillRect(Math.min(pos, cx + cw / 2), 22, Math.abs(pos - (cx + cw / 2)), 10);
  g.fillStyle = '#fff'; g.fillRect(cx + cw / 2, 18, 1, 18);
  g.fillStyle = '#7b8792'; g.fillText('−1', cx, 42); g.fillText('0', cx + cw / 2 - 3, 42); g.fillText('+1', cx + cw - 14, 42);
  // loudness court terme vs cible
  g.fillStyle = '#9fb0bf'; g.fillText('LOUDNESS S (cible −23)', cx, 60);
  g.fillStyle = '#10161b'; g.fillRect(cx, 68, cw, 14);
  const lx = (v) => cx + clamp((v + 40) / 30, 0, 1) * cw;
  g.fillStyle = Math.abs(AU.lufs.s + 23) < 2 ? '#22c55e' : AU.lufs.s > -21 ? '#ff3b30' : '#38bdf8'; g.fillRect(cx, 70, lx(AU.lufs.s) - cx, 10);
  g.fillStyle = '#fff'; g.fillRect(lx(-23), 66, 2, 18);
  // limiteur et écoute
  g.fillStyle = '#9fb0bf'; g.fillText(`LIMITEUR ${AU.master.lim ? '−' + fmt(AU.master.gr, 1) + ' dB' : 'OFF'}`, cx, 102);
  g.fillText(`ÉCOUTE ${AU.pflActive ? 'PFL' : (MONITORS.find((m) => m[0] === AU.monitor) || [0, AU.monitor])[1]}${AU.mono ? ' · MONO' : ''}${AU.dim ? ' · DIM' : ''}`, cx, 124);
  g.fillStyle = AU.redLight ? '#ff3b30' : '#3a2222'; g.beginPath(); g.arc(W - 14, 102, 7, 0, Math.PI * 2); g.fill();
}

export function buildAudio(body, arg, ctx) {
  const ui = { view: 'in', band: 2, layer: 'A', tab: 'console', strips: [], knobs: [], cvs: [] };
  AU.sel = AU.sel || 'amb1';
  const dmon = (src, label) => el('div', { class: 'monwrap', style: { flex: '0 1 300px', minWidth: '200px' } }, el('div', { class: 'lab' }, label), el('div', { class: 'mon fill', 'data-gl': src }));
  // ---------- Control Bay (dock) : vumètres, écoute, talkback ----------
  const bridge = el('canvas', { width: 440, height: 150, class: 'vx-bridge' });
  const monBtns = {};
  const monRow = el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Écoute'));
  for (const [k, l] of MONITORS) { monBtns[k] = hwBtn(l, { cls: 'small', onclick: () => AUACT.monitor(k) }); monRow.appendChild(monBtns[k]); }
  const dim = hwBtn('DIM', { cls: 'small', onclick: () => AUACT.dim() });
  const mono = hwBtn('MONO', { cls: 'small', onclick: () => AUACT.mono() });
  const pflInd = el('span', { class: 'vx-pfl' }, 'PFL');
  monRow.append(dim, mono, pflInd);
  const tbRow = el('div', { class: 'hwrow' }, el('span', { class: 'rl' }, 'Talkback'));
  const tbBtns = {};
  for (const [k, l] of [['n1', 'TB COMM'], ['nxs', 'TB STUDIO'], ['nxb', 'TB BORD T.']]) {
    const b = hwBtn(l, { cls: 'small' });
    const down = (e) => { e.preventDefault(); AUACT.talkback(k, true); };
    const up = () => AUACT.talkback(k, false);
    b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up);
    tbBtns[k] = b; tbRow.appendChild(b);
  }
  const red = el('div', { class: 'vx-red', title: 'Lampe rouge de la cabine commentateurs (GPO de la console)' }, 'MICRO OUVERT');
  tbRow.appendChild(red);
  const auto = hwBtn('SUIVI DU JEU', { cls: 'small', sub: 'canons', onclick: () => AUACT.auto() });
  const lufsL = el('div', { class: 'lcd amber vx-lufs' });
  const startBtn = el('button', { class: 'btn primary small', onclick: () => { startAudio(); startBtn.hidden = true; } }, 'Activer le son');
  const cbay = el('div', { class: 'hwpanel vx-cbay' }, el('h3', {}, 'Control Bay · vumètres, écoute, ordres'),
    el('div', { class: 'vx-cbgrid' }, el('div', { class: 'list' }, bridge, lufsL),
      el('div', { class: 'list' }, monRow, tbRow, el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => { resetLoudness(); explain('Loudness intégrée remise à zéro : on la relance au début du programme pour mesurer toute l\'émission (cible −23 LUFS, EBU R128).', 'son:lufs'); } }, 'Remettre l\'intégré à 0'), auto, startBtn))));
  ctx.dock.append(el('div', { class: 'dockrow' }, dmon('PGM', 'Programme (image à l\'antenne)'), cbay));

  // ---------- onglets ----------
  const tabs = el('div', { class: 'vx-tabs' });
  const pane = el('div', { class: 'vx-pane' });
  const TABS = [['console', 'Console (Vistonics)'], ['io', 'E/S et patch'], ['bus', 'Bus, N-1, départ'], ['snap', 'Snapshots'], ['comm', 'Commentaires'], ['vista', 'Comprendre la Vista 1']];
  const tabBtns = {};
  for (const [k, l] of TABS) { tabBtns[k] = el('button', { class: 'vx-tab', onclick: () => show(k) }, l); tabs.appendChild(tabBtns[k]); }
  body.append(tabs, pane);
  let cur = null;
  function show(k) { ui.tab = k; for (const t in tabBtns) tabBtns[t].classList.toggle('on', t === k); pane.innerHTML = ''; ui.knobs = []; ui.strips = []; ui.cvs = []; cur = { console: tabConsole, io: tabIO, bus: tabBus, snap: tabSnap, comm: tabComm, vista: tabVista }[k](); }

  // ---------- console ----------
  function tabConsole() {
    const bar = el('div', { class: 'vx-bar' });
    const lay = {}; for (const [k, l] of [['A', 'COUCHE A · SOURCES'], ['B', 'COUCHE B · BUS ET VCA']]) { lay[k] = hwBtn(l, { cls: 'small', onclick: () => { ui.layer = k; AU.spill = null; rebuild(); explain(k === 'A' ? 'Couche A : les tranches des sources (micros, EVS, commentaires…). Une couche (layer) remplace d\'un geste les tranches affichées sous les mêmes faders : on garde un pupitre compact.' : 'Couche B : les masters des bus (PGM, international, N-1) et les VCA. Les faders motorisés se déplacent pour reprendre la position de chaque master.', 'son:layer'); } }); bar.appendChild(lay[k]); }
    bar.appendChild(el('span', { class: 'rl', style: { marginLeft: '12px' } }, 'Écrans'));
    const vw = {};
    for (const [k, l, col] of [['in', 'ENTRÉE', SEC.in], ['eq', 'ÉGALISEUR', SEC.eq], ['dyn', 'DYNAMIQUE', SEC.dyn], ['pan', 'PAN · DÉPARTS', SEC.pan]]) {
      const b = hwBtn(l, { cls: 'small', onclick: () => { ui.view = k; rebuild(); explain(VIEW_TXT[k], 'son:view'); } }); b.style.borderBottom = '3px solid ' + col; vw[k] = b; bar.appendChild(b);
    }
    const bandRow = el('span', { class: 'vx-bands' });
    BANDS.forEach((b, i) => { const x = hwBtn(String(i + 1), { cls: 'small', title: 'Bande ' + b, onclick: () => { ui.band = i; rebuild(); explain(`Les molettes des écrans règlent maintenant la bande ${i + 1} (${b}) de chaque tranche : ${BAND_TXT[i]}.`, 'son:band'); } }); bandRow.appendChild(x); });
    bar.appendChild(bandRow);
    const bays = el('div', { class: 'vx-bays' });
    const detail = el('div', { class: 'vx-detail' });
    pane.append(bar, bays, detail);
    function rebuild() {
      for (const k in lay) lay[k].classList.toggle('lit', ui.layer === k);
      for (const k in vw) vw[k].classList.toggle('lit', ui.view === k);
      bandRow.hidden = ui.view !== 'eq' || ui.layer !== 'A';
      [...bandRow.children].forEach((b, i) => b.classList.toggle('lit2', ui.band === i));
      bays.innerHTML = ''; ui.strips = []; ui.knobs = ui.knobs.filter((k) => k._detail);
      /** @type {any[]} tranches (couche A) ou bus et VCA (couche B), complétés par des emplacements vides */
      const items = ui.layer === 'A' ? AU.order.map((k) => ({ t: 'ch', c: AU.ch[k] })) : [{ t: 'pgm' }, ...['intl', 'n1', 'nxs', 'nxb'].map((k) => ({ t: 'bus', k })), ...Object.keys(AU.vca).map((k) => ({ t: 'vca', k }))];
      while (items.length < 20) items.push({ t: 'empty', n: items.length + 1 });
      for (let b = 0; b < 2; b++) {
        const bay = el('div', { class: 'vx-bay' }, el('div', { class: 'vx-bayh' }, `VISTONICS ${b + 1} · tranches ${b * 10 + 1} à ${b * 10 + 10}`));
        const row = el('div', { class: 'vx-row' });
        for (const it of items.slice(b * 10, b * 10 + 10)) { const s = it.t === 'ch' ? chStrip(it.c) : it.t === 'empty' ? emptyStrip(it.n) : masterStrip(it); row.appendChild(s); ui.strips.push(s); }
        bay.appendChild(row); bays.appendChild(bay);
      }
    }
    function chStrip(c) {
      const col = GROUPS[c.group].color;
      const scrib = el('div', { class: 'vx-scrib', title: c.label + ' · ' + c.src + ' : ' + portInfo(c.src) }, el('b', {}, String(c.n)), el('span', {}, c.short), el('small', {}, c.src));
      scrib.style.setProperty('--g', col);
      const hint = el('small', { class: 'vx-hint' });
      const ico = el('div', { class: 'vx-ico' });
      const icos = /** @type {Array<[string, () => any, string]>} */ ([['48V', () => c.ph48, SEC.in], ['Ø', () => c.phase, SEC.in], ['EQ', () => c.eq.on, SEC.eq], ['DYN', () => c.dyn.on || c.gate.on, SEC.dyn], ['AFV', () => c.afv, SEC.pan]]).map(([l, g, cc]) => { const i = el('i', {}, l); i.style.setProperty('--c', cc); i.sync = () => i.classList.toggle('on', !!g()); ico.appendChild(i); return i; });
      const scr = el('div', { class: 'vx-screen' });
      scr.style.setProperty('--sec', SEC[ui.view]);
      const syncs = [];
      const K = (o) => { const k = vknob(o); ui.knobs.push(k); return k; };
      const upd = (txt) => () => { applyStrip(c); explain(txt(), 'son:' + c.id + ui.view); };
      let mini = null;
      if (ui.view === 'in') {
        scr.append(K({ label: 'GAIN', color: SEC.in, min: c.kind === 'mic' ? 0 : c.defGain - 30, max: c.kind === 'mic' ? 70 : c.defGain + 30, step: 1, get: () => c.gain, set: (v) => { c.gain = v; }, fmt: (v) => (c.kind === 'mic' ? '+' + v : sgn(v - c.defGain, 0)), def: c.defGain, after: upd(() => tGain(c)) }),
          K({ label: 'RETARD', color: SEC.in, min: 0, max: 200, step: 1, get: () => c.delay, set: (v) => { c.delay = v; }, fmt: (v) => v + ' ms', def: 0, after: upd(() => tDelay(c)) }));
        const b1 = vbtn('48V', '#ef4444', () => c.ph48, () => { c.ph48 = !c.ph48; applyStrip(c); explain(t48(c), portsOf(c.src).some((p) => PLUG[p] && PLUG[p].cond) && !c.ph48 ? 'warn' : 'son:48'); }, 'Alimentation fantôme');
        const b2 = vbtn(c.st ? 'Ø R' : 'Ø', SEC.in, () => c.phase, () => { c.phase = !c.phase; applyStrip(c); explain(tPhase(c), c.phase ? 'warn' : 'son:phase'); }, 'Inversion de polarité');
        syncs.push(b1, b2); scr.append(el('div', { class: 'vx-b2' }, b1, b2));
      } else if (ui.view === 'eq') {
        const i = ui.band;
        mini = el('canvas', { width: 56, height: 30, class: 'vx-mini' }); scr.append(mini);
        scr.append(K({ label: 'FRÉQ ' + (i + 1), color: SEC.eq, log: true, min: i === 0 ? 30 : i === 3 ? 2000 : 80, max: i === 0 ? 500 : i === 3 ? 18000 : 12000, get: () => c.eq.b[i].f, set: (v) => { c.eq.b[i].f = v; }, fmt: (v) => fhz(v), def: [100, 400, 2500, 10000][i], after: upd(() => tBand(c, i)) }),
          K({ label: 'GAIN ' + (i + 1), color: SEC.eq, min: -15, max: 15, step: 0.5, get: () => c.eq.b[i].g, set: (v) => { c.eq.b[i].g = v; }, fmt: (v) => sgn(v), def: 0, after: upd(() => tBand(c, i)) }));
        const b1 = vbtn('EQ', SEC.eq, () => c.eq.on, () => { c.eq.on = !c.eq.on; applyStrip(c); explain(`Égaliseur de ${c.short} ${c.eq.on ? 'en service' : 'contourné (bypass)'} : compare avec et sans, c'est le meilleur juge.`, 'son:eqon'); });
        const b2 = vbtn('HPF', SEC.eq, () => c.hpf.on, () => { c.hpf.on = !c.hpf.on; applyStrip(c); explain(tHpf(c), 'son:hpf'); }, 'Filtre passe-haut');
        syncs.push(b1, b2); scr.append(el('div', { class: 'vx-b2' }, b1, b2));
      } else if (ui.view === 'dyn') {
        mini = el('canvas', { width: 56, height: 30, class: 'vx-mini' }); scr.append(mini);
        scr.append(K({ label: 'SEUIL', color: SEC.dyn, min: -50, max: 0, step: 1, get: () => c.dyn.thr, set: (v) => { c.dyn.thr = v; }, fmt: (v) => v + ' dB', def: -18, after: upd(() => tComp(c)) }),
          K({ label: 'RATIO', color: SEC.dyn, min: 1, max: 20, step: 0.5, get: () => c.dyn.ratio, set: (v) => { c.dyn.ratio = v; }, fmt: (v) => fmt(v, 1) + ':1', def: 3, after: upd(() => tComp(c)) }));
        const b1 = vbtn('COMP', SEC.dyn, () => c.dyn.on, () => { c.dyn.on = !c.dyn.on; applyStrip(c); explain(tComp(c), 'son:comp'); });
        const b2 = vbtn('GATE', SEC.dyn, () => c.gate.on, () => { c.gate.on = !c.gate.on; applyStrip(c); explain(tGate(c), 'son:gate'); });
        syncs.push(b1, b2); scr.append(el('div', { class: 'vx-b2' }, b1, b2));
      } else {
        scr.append(K({ label: c.st ? 'BAL' : 'PAN', color: SEC.pan, min: -1, max: 1, step: 0.05, get: () => c.pan, set: (v) => { c.pan = v; }, fmt: (v) => (Math.abs(v) < 0.01 ? 'C' : (v < 0 ? 'G' : 'D') + Math.round(Math.abs(v) * 100)), def: 0, after: upd(() => tPan(c)) }));
        const sends = el('div', { class: 'vx-sends' });
        for (const [b, l] of [['intl', 'INTL'], ['n1', 'N-1'], ['nxs', 'STU'], ['nxb', 'BT']]) {
          const x = vbtn(l, SEC.aux, () => c[b], () => { setSend(c.id, b, !c[b]); explain(SEND_TXT[b](c), sendBad(c, b) ? 'warn' : 'son:send'); }, 'Départ vers ' + AU.bus[b].label);
          x.sync2 = () => x.classList.toggle('bad', sendBad(c, b)); syncs.push(x); sends.appendChild(x);
        }
        const af = vbtn('AFV', SEC.pan, () => c.afv, () => { c.afv = !c.afv; applyStrip(c); explain(`AFV (audio follow video) ${c.afv ? 'actif' : 'coupé'} sur ${c.short} : le mélangeur signale par tally quelle source est à l'antenne et la tranche ne s'ouvre que quand son image passe.${c.id === 'hfmic' ? ' Ici : le micro de la caméra HF.' : c.id.startsWith('evs') ? ' Ici : le son des ralentis, ouvert seulement quand le ralenti est à l\'antenne.' : ' Sur cette source, l\'AFV n\'a pas d\'image associée : il reste ouvert.'}`, 'son:afv'); });
        syncs.push(af); sends.appendChild(af);
        scr.append(sends);
      }
      const sel = vbtn('SEL', '#e5e7eb', () => AU.sel === c.id, () => { AUACT.sel(c); drawDetail(); });
      const pfl = vbtn('PFL', '#facc15', () => c.pfl, () => AUACT.pfl(c));
      syncs.push(sel, pfl);
      const meter = el('canvas', { width: 14, height: 150, class: 'vx-meter' });
      const fd = vfader(() => c.fader, (v) => AUACT.fader(c, v), col, c.short);
      const lcd = el('div', { class: 'vx-lcd' });
      const mute = el('button', { class: 'vx-mute', 'aria-label': 'MUTE ' + c.short, title: 'Couper ' + c.short, onclick: () => AUACT.mute(c) }, 'MUTE');
      const s = el('div', { class: 'vx-strip' }, scrib, hint, ico, scr, el('div', { class: 'vx-b2' }, sel, pfl), el('div', { class: 'vx-fsec' }, meter, fd), lcd, mute);
      s.style.setProperty('--g', col);
      s.sync = () => {
        for (const i of icos) i.sync();
        for (const b of syncs) { b.sync(); if (b.sync2) b.sync2(); }
        const on = faderLin(c) > 0 && c.pgm;
        fd.sync(on); lcd.textContent = fdb(c.fader) + (vcaDb(c) ? ' V' : '');
        mute.classList.toggle('on', c.mute);
        s.classList.toggle('sel', AU.sel === c.id); s.classList.toggle('spill', !!AU.spill && c.vca === AU.spill); s.classList.toggle('netlost', !!c.netLost);
        s.classList.toggle('afvoff', c.afv && !afvOpen(c));
        if (c.group === 'canon') { const i = +c.id.slice(1) - 1; const d = Math.hypot(M.ball.x - CANON_POS[i][0], M.ball.z - CANON_POS[i][1]); hint.textContent = `ballon ${Math.round(d)} m`; const best = CANON_POS.map((p) => Math.hypot(M.ball.x - p[0], M.ball.z - p[1])); hint.classList.toggle('near', d === Math.min(...best)); }
        else hint.textContent = c.netLost ? 'PERTE FLUX IP' : c.afv ? (afvOpen(c) ? 'AFV ouvert' : 'AFV fermé') : c.voice && AU.voiceLvl[portVoice(c)] > -80 ? 'parle' : '';
        if (mini) { const key = JSON.stringify([c.eq, c.hpf, c.dyn, c.gate, Math.round(c.peak / 3)]); if (mini._k !== key) { mini._k = key; (ui.view === 'eq' ? eqCurve : dynCurve)(mini, c); } }
      };
      // on ne redessine le vumètre que si son affichage change (à 1 dB près)
      let mk = '';
      s.meter = () => { const k = Math.round(c.peak) + '|' + Math.round(c.gr) + '|' + (c.ovl > 0); if (k !== mk) { mk = k; meterDraw(meter, c.peak, c.gr, c.ovl > 0); } };
      s.sync();
      return s;
    }
    function masterStrip(it) {
      const isV = it.t === 'vca', isP = it.t === 'pgm';
      const o = isP ? { short: 'PGM', label: 'Master PGM', fader: () => AU.master.fader, set: (v) => { AU.master.fader = v; }, mute: null } : isV ? AU.vca[it.k] : AU.bus[it.k];
      const col = isV ? '#94a3b8' : '#fbbf24';
      const scrib = el('div', { class: 'vx-scrib' }, el('b', {}, isV ? 'VCA' : 'BUS'), el('span', {}, o.short), el('small', {}, isP ? 'master' : isV ? 'groupe' : 'N-x / aux'));
      scrib.style.setProperty('--g', col);
      const scr = el('div', { class: 'vx-screen master' });
      const syncs = [];
      if (isP) {
        const lim = vbtn('LIMIT', SEC.dyn, () => AU.master.lim, () => AUACT.lim());
        syncs.push(lim);
        scr.append(el('p', {}, 'Bus principal : embedder paire 1-2, loudness.'), lim);
      } else if (isV) {
        const mem = AU.order.filter((k) => AU.ch[k].vca === it.k).map((k) => AU.ch[k].short);
        const spill = vbtn('SPILL', '#e5e7eb', () => AU.spill === it.k, () => { AU.spill = it.k; ui.layer = 'A'; rebuild(); explain(`SPILL : les tranches du ${o.label} (${mem.join(', ')}) clignotent sur la couche A. On garde le VCA sous la main et on retouche une tranche du groupe.`, 'son:spill'); });
        syncs.push(spill);
        scr.append(el('p', {}, mem.join(' · ')), spill);
      } else {
        const lis = vbtn('ÉCOUTE', '#facc15', () => AU.monitor === it.k, () => { startAudio(); setMonitor(it.k); explain(monTxt(it.k), 'son:mon'); });
        syncs.push(lis);
        scr.append(el('p', {}, o.dest), lis);
      }
      const meter = el('canvas', { width: 14, height: 150, class: 'vx-meter' });
      const get = isP ? o.fader : () => o.fader;
      const set = isP ? o.set : (v) => { o.fader = v; };
      const fd = vfader(get, (v) => { set(v); applyAll(); explain(isP ? `Master PGM à ${fdb(v)} dB : il agit sur tout le programme. Surveille la loudness intégrée (cible −23 LUFS).` : isV ? `${o.label} à ${fdb(v)} dB : toutes ses tranches bougent ensemble (le VCA agit sur leurs gains, il ne mélange pas le son). Leurs faders ne bougent pas : l'écran montre « V » à côté de leur valeur.` : `Master ${o.label} à ${fdb(v)} dB : niveau envoyé vers ${o.dest}.`, 'son:m' + (it.k || 'pgm')); }, col, o.short);
      const lcd = el('div', { class: 'vx-lcd' });
      const mute = isP ? el('div', { class: 'vx-mute ghost' }, '—') : el('button', { class: 'vx-mute', 'aria-label': 'MUTE ' + o.label, title: 'Couper ' + o.label, onclick: () => { o.mute = !o.mute; applyAll(); explain(`${o.label} ${o.mute ? 'coupé : ' + (isV ? 'toutes ses tranches sont muettes (mute de groupe).' : 'plus rien n\'est envoyé vers ' + o.dest + '.') : 'rétabli.'}`, o.mute ? 'warn' : 'son:mmute'); } }, 'MUTE');
      const s = el('div', { class: 'vx-strip m' }, scrib, el('small', { class: 'vx-hint' }), scr, el('div', { class: 'vx-fsec' }, meter, fd), lcd, mute);
      s.style.setProperty('--g', col);
      s.sync = () => { for (const b of syncs) b.sync(); fd.sync(isP ? true : !o.mute); lcd.textContent = fdb(get()); if (!isP) mute.classList.toggle('on', !!o.mute); };
      let mk = '';
      s.meter = () => { const v = isP ? Math.max(AU.master.peakL, AU.master.peakR) : isV ? Math.max(-90, ...AU.order.filter((k) => AU.ch[k].vca === it.k).map((k) => AU.ch[k].peak)) : o.peak; const g = isP ? AU.master.gr : null; const k = Math.round(v) + '|' + Math.round(g || 0); if (k !== mk) { mk = k; meterDraw(meter, v, g, false); } };
      s.sync();
      return s;
    }
    function emptyStrip(n) { const s = el('div', { class: 'vx-strip empty' }, el('div', { class: 'vx-scrib' }, el('b', {}, String(n)), el('span', {}, '—'), el('small', {}, 'libre'))); s.sync = () => {}; s.meter = () => {}; return s; }
    // ----- écran de la Control Bay : la tranche sélectionnée -----
    function drawDetail() {
      detail.innerHTML = ''; ui.knobs = ui.knobs.filter((k) => !k._detail);
      const c = AU.ch[AU.sel]; if (!c) return;
      const K = (o) => { const k = vknob(o); k._detail = true; ui.knobs.push(k); return k; };
      const ap = (t, kind = '') => () => { applyStrip(c); explain(t(), kind || 'son:d' + c.id); };
      const head = el('div', { class: 'vx-dh' }, el('b', {}, `${c.n} · ${c.label}`), el('span', {}, `${c.src} — ${portInfo(c.src)}`));
      head.style.setProperty('--g', GROUPS[c.group].color);
      const patch = selectEl((c.st ? ST_PORTS : MONO_PORTS).map((p) => [p, p + (PLUG[p] ? ' · ' + PLUG[p].what : portsOf(p).some((x) => PLUG[x]) ? ' · ' + portInfo(p) : '')]), c.src, (v) => { setPatch(c.id, v); drawDetail(); explain(`Patch d'entrée : ${c.short} reçoit maintenant ${v} (${portInfo(v)}).${v === c.home ? ' C\'est l\'entrée prévue par la feuille de patch.' : ' ATTENTION : ce n\'est pas l\'entrée prévue (' + c.home + ').'}`, v === c.home ? 'son:patch' : 'warn'); });
      const inp = el('div', { class: 'vx-dsec' }, el('h4', { style: { color: SEC.in } }, 'ENTRÉE'), el('div', { class: 'field' }, el('label', { for: patch.id }, 'Patch'), patch),
        el('div', { class: 'vx-kr' }, K({ label: 'GAIN', color: SEC.in, min: c.kind === 'mic' ? 0 : c.defGain - 30, max: c.kind === 'mic' ? 70 : c.defGain + 30, step: 1, get: () => c.gain, set: (v) => { c.gain = v; }, fmt: (v) => (c.kind === 'mic' ? '+' + v : sgn(v - c.defGain, 0)), def: c.defGain, after: ap(() => tGain(c)) }),
          K({ label: 'RETARD', color: SEC.in, min: 0, max: 200, step: 1, get: () => c.delay, set: (v) => { c.delay = v; }, fmt: (v) => v + ' ms', def: 0, after: ap(() => tDelay(c)) })),
        el('div', { class: 'vx-b2' }, ...[vbtn('48V', '#ef4444', () => c.ph48, () => { c.ph48 = !c.ph48; applyStrip(c); explain(t48(c), 'son:48'); }), vbtn(c.st ? 'Ø R' : 'Ø', SEC.in, () => c.phase, () => { c.phase = !c.phase; applyStrip(c); explain(tPhase(c), c.phase ? 'warn' : 'son:phase'); })].map((b) => { ui.knobs.push(Object.assign(b, { _detail: true })); return b; })));
      const eqc = el('canvas', { width: 300, height: 120, class: 'vx-eqbig' });
      const eqk = el('div', { class: 'vx-kr' });
      c.eq.b.forEach((b, i) => {
        eqk.append(el('div', { class: 'vx-band' }, el('small', {}, `${i + 1} · ${BANDS[i]}`),
          K({ label: 'FRÉQ', color: SEC.eq, log: true, min: i === 0 ? 30 : i === 3 ? 2000 : 80, max: i === 0 ? 500 : i === 3 ? 18000 : 12000, get: () => b.f, set: (v) => { b.f = v; }, fmt: (v) => fhz(v), def: [100, 400, 2500, 10000][i], after: ap(() => tBand(c, i)) }),
          K({ label: 'GAIN', color: SEC.eq, min: -15, max: 15, step: 0.5, get: () => b.g, set: (v) => { b.g = v; }, fmt: (v) => sgn(v), def: 0, after: ap(() => tBand(c, i)) }),
          i === 1 || i === 2 ? K({ label: 'Q', color: SEC.eq, min: 0.3, max: 8, step: 0.1, get: () => b.q, set: (v) => { b.q = v; }, fmt: (v) => fmt(v, 1), def: 1, after: ap(() => tBand(c, i)) }) : el('div', { class: 'vk ghost' }, el('div', { class: 'vk-lab' }, b.t === 'lowshelf' ? 'PLATEAU' : 'PLATEAU'))));
      });
      const eqb = [vbtn('EQ', SEC.eq, () => c.eq.on, () => { c.eq.on = !c.eq.on; applyStrip(c); explain(`Égaliseur de ${c.short} ${c.eq.on ? 'en service' : 'contourné'}.`, 'son:eqon'); }), vbtn('HPF', SEC.eq, () => c.hpf.on, () => { c.hpf.on = !c.hpf.on; applyStrip(c); explain(tHpf(c), 'son:hpf'); })];
      eqb.forEach((b) => ui.knobs.push(Object.assign(b, { _detail: true })));
      const eq = el('div', { class: 'vx-dsec wide' }, el('h4', { style: { color: SEC.eq } }, 'FILTRE ET ÉGALISEUR 4 BANDES'), el('div', { class: 'hwrow' }, eqc, el('div', { class: 'list' }, el('div', { class: 'vx-b2' }, ...eqb), K({ label: 'HPF', color: SEC.eq, log: true, min: 20, max: 400, get: () => c.hpf.f, set: (v) => { c.hpf.f = v; }, fmt: (v) => v + ' Hz', def: 80, after: ap(() => tHpf(c)) }))), eqk);
      const dyc = el('canvas', { width: 130, height: 130, class: 'vx-dynbig' });
      const dynb = [vbtn('COMP', SEC.dyn, () => c.dyn.on, () => { c.dyn.on = !c.dyn.on; applyStrip(c); explain(tComp(c), 'son:comp'); }), vbtn('GATE', SEC.dyn, () => c.gate.on, () => { c.gate.on = !c.gate.on; applyStrip(c); explain(tGate(c), 'son:gate'); })];
      dynb.forEach((b) => ui.knobs.push(Object.assign(b, { _detail: true })));
      const dyn = el('div', { class: 'vx-dsec' }, el('h4', { style: { color: SEC.dyn } }, 'DYNAMIQUE'), el('div', { class: 'hwrow' }, dyc, el('div', { class: 'vx-b2 col' }, ...dynb)),
        el('div', { class: 'vx-kr' }, K({ label: 'SEUIL', color: SEC.dyn, min: -50, max: 0, step: 1, get: () => c.dyn.thr, set: (v) => { c.dyn.thr = v; }, fmt: (v) => v + ' dB', def: -18, after: ap(() => tComp(c)) }),
          K({ label: 'RATIO', color: SEC.dyn, min: 1, max: 20, step: 0.5, get: () => c.dyn.ratio, set: (v) => { c.dyn.ratio = v; }, fmt: (v) => fmt(v, 1) + ':1', def: 3, after: ap(() => tComp(c)) }),
          K({ label: 'ATTAQUE', color: SEC.dyn, min: 1, max: 100, step: 1, get: () => c.dyn.att, set: (v) => { c.dyn.att = v; }, fmt: (v) => v + ' ms', def: 10, after: ap(() => tComp(c)) }),
          K({ label: 'RETOUR', color: SEC.dyn, min: 20, max: 1000, step: 10, get: () => c.dyn.rel, set: (v) => { c.dyn.rel = v; }, fmt: (v) => v + ' ms', def: 150, after: ap(() => tComp(c)) }),
          K({ label: 'GAIN +', color: SEC.dyn, min: 0, max: 20, step: 0.5, get: () => c.dyn.mk, set: (v) => { c.dyn.mk = v; }, fmt: (v) => '+' + fmt(v, 1), def: 0, after: ap(() => tComp(c)) }),
          K({ label: 'GATE', color: SEC.dyn, min: -70, max: -10, step: 1, get: () => c.gate.thr, set: (v) => { c.gate.thr = v; }, fmt: (v) => v + ' dB', def: -50, after: ap(() => tGate(c)) }),
          K({ label: 'PROF.', color: SEC.dyn, min: 3, max: 60, step: 1, get: () => c.gate.range, set: (v) => { c.gate.range = v; }, fmt: (v) => v + ' dB', def: 20, after: ap(() => tGate(c)) })));
      const outs = el('div', { class: 'vx-b2 wrap' });
      for (const [b, l] of [['pgm', 'PGM'], ['intl', 'INTL'], ['n1', 'N-1 COM'], ['nxs', 'N-1 STU'], ['nxb', 'N-1 BT']]) { const x = vbtn(l, SEC.aux, () => c[b], () => { setSend(c.id, b, !c[b]); explain(SEND_TXT[b](c), sendBad(c, b) ? 'warn' : 'son:send'); }); x.sync2 = () => x.classList.toggle('bad', sendBad(c, b)); x._detail = true; ui.knobs.push(x); outs.appendChild(x); }
      const vcaSel = selectEl([['', 'aucun'], ...Object.entries(AU.vca).map(([k, v]) => [k, v.label])], c.vca || '', (v) => { c.vca = v || null; applyStrip(c); explain(`${c.short} ${c.vca ? 'est commandé par ' + AU.vca[c.vca].label : 'n\'est plus dans un VCA'}. Un VCA (« voltage controlled amplifier », hérité de l'analogique) est un fader de commande : il agit sur le gain de ses tranches sans créer de bus.`, 'son:vca'); });
      const out = el('div', { class: 'vx-dsec' }, el('h4', { style: { color: SEC.pan } }, 'PANORAMIQUE ET DÉPARTS'),
        el('div', { class: 'vx-kr' }, K({ label: c.st ? 'BAL' : 'PAN', color: SEC.pan, min: -1, max: 1, step: 0.05, get: () => c.pan, set: (v) => { c.pan = v; }, fmt: (v) => (Math.abs(v) < 0.01 ? 'C' : (v < 0 ? 'G' : 'D') + Math.round(Math.abs(v) * 100)), def: 0, after: ap(() => tPan(c)) })),
        outs, el('div', { class: 'field' }, el('label', { for: vcaSel.id }, 'VCA'), vcaSel),
        el('p', { class: 'note' }, stripNote(c)));
      detail.append(head, el('div', { class: 'vx-dgrid' }, inp, eq, dyn, out));
      detail._draw = () => { const key = JSON.stringify([c.eq, c.hpf]); if (eqc._k !== key) { eqc._k = key; eqCurve(eqc, c, true); } dynCurve(dyc, c, true); };
      detail._draw();
    }
    rebuild(); drawDetail();
    return {
      update() { for (const s of ui.strips) s.sync(); for (const k of ui.knobs) { k.sync(); if (k.sync2) k.sync2(); } if (detail._draw) detail._draw(); },
      frame() { for (const s of ui.strips) s.meter(); },
    };
  }

  // ---------- E/S et patch ----------
  function tabIO() {
    const used = {}; for (const k of AU.order) for (const p of portsOf(AU.ch[k].src)) (used[p] = used[p] || []).push(AU.ch[k].short);
    const rear = el('div', { class: 'vx-rear' });
    const grp = (title, ports, cls) => { const g = el('div', { class: 'vx-rg' }, el('h4', {}, title)); const r = el('div', { class: 'vx-rp ' + cls }); for (const p of ports) { const u = used[p]; const x = el('span', { class: 'vx-jack' + (PLUG[p] ? ' plug' : '') + (u ? ' used' : ''), title: `${p} · ${PLUG[p] ? PLUG[p].what : 'libre'}${u ? ' → tranche ' + u.join(', ') : ''}` }, p.replace(/^(MIC|MADI|AES|SDI) /, '')); r.appendChild(x); } g.appendChild(r); return g; };
    rear.append(grp('Entrées micro / ligne 1-32 (XLR, préamplis, 48 V)', [...Array(32).keys()].map((i) => 'MIC ' + (i + 1)), 'xlr'),
      grp('Sorties ligne 1-16 (XLR)', [...Array(16).keys()].map((i) => 'OUT ' + (i + 1)), 'xlr out'),
      grp('AES/EBU 1-8 (paires, D-sub)', [...Array(8).keys()].map((i) => 'AES ' + (i + 1)), 'aes'),
      grp('Carte D21m · MADI (64 canaux, extrait)', [...Array(8).keys()].map((i) => 'MADI ' + (i + 1)), 'madi'),
      grp('Carte D21m · SDI (désembedding)', [...Array(4).keys()].map((i) => 'SDI 1/' + (i + 1)), 'sdi'),
      grp('Interne', ['GEN'], 'gen'));
    const tb = el('tbody');
    for (const k of AU.order) {
      const c = AU.ch[k];
      const status = el('td');
      const sel = selectEl((c.st ? ST_PORTS : MONO_PORTS).map((p) => [p, p]), c.src, (v) => { setPatch(k, v); explain(`Patch : ${c.short} ← ${v} (${portInfo(v)}).${v === c.home ? ' Conforme à la feuille de patch.' : ' Différent de la feuille de patch (' + c.home + ') : vérifie que c\'est voulu.'}`, v === c.home ? 'son:patch' : 'warn'); upd(); });
      sel.setAttribute('aria-label', 'Patch de ' + c.short);
      const what = el('td', { class: 'note' });
      const ph = el('td');
      const upd = () => { what.textContent = portInfo(c.src); const cond = portsOf(c.src).some((p) => PLUG[p] && PLUG[p].cond); ph.textContent = cond ? (c.ph48 ? '48 V' : '48 V COUPÉ') : '—'; ph.className = cond && !c.ph48 ? 'err' : ''; status.textContent = c.src === c.home ? 'conforme' : 'à vérifier (prévu : ' + c.home + ')'; status.className = c.src === c.home ? 'ok' : 'err'; };
      upd();
      tb.appendChild(el('tr', {}, el('td', {}, String(c.n)), el('td', {}, el('b', {}, c.short), el('br'), el('small', {}, c.label)), el('td', {}, sel), what, ph, status));
    }
    const outs = el('tbody');
    for (const [b, phys] of [['pgm', 'Embedder SDI paire 1-2 · OUT 1-2 (secours analogique TX)'], ['intl', 'Embedder SDI paire 3-4 · OUT 3-4'], ['n1', 'MADI 33-34 vers l\'unité de commentaire (casques)'], ['nxs', 'OUT 5-6 → codec 4 fils de la transmission'], ['nxb', 'OUT 7 → émetteur IFB (oreillette)']]) outs.appendChild(el('tr', {}, el('td', {}, el('b', {}, AU.bus[b].label)), el('td', {}, phys), el('td', { class: 'note' }, AU.bus[b].dest)));
    pane.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Face arrière du cœur (inspiration Vista 1) et cartes d\'extension'), rear,
      el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => openDevice('audio', 1) }, 'Voir la face arrière détaillée (Matériel)'), el('span', { class: 'note' }, `Vert = branché et utilisé · jaune = branché, non utilisé · gris = libre.${S.ipMode ? ' Car IP : les sources du stade arrivent aussi en ST 2110-30 (AES67) par la carte réseau ; une perte de flux rend la tranche muette.' : ''}`))),
      el('div', { class: 'hwpanel' }, el('h3', {}, 'Patch d\'entrée (feuille de patch)'), el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, ...['Tr.', 'Tranche', 'Entrée', 'Ce qui y est branché', '48 V', 'État'].map((h) => el('th', {}, h)))), tb),
        el('p', { class: 'note' }, 'Le patch relie une entrée physique (connecteur) à une tranche (traitement). Sur une console numérique, il se fait à l\'écran : on peut donc se tromper d\'entrée sans toucher un câble. On prépare une feuille de patch avant le match et on vérifie chaque source en PFL.')),
      el('div', { class: 'hwpanel' }, el('h3', {}, 'Patch de sortie'), el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th', {}, 'Bus'), el('th', {}, 'Sortie physique'), el('th', {}, 'Destination'))), outs)));
    return {};
  }

  // ---------- bus, N-1, embedder, retard ----------
  function tabBus() {
    const SEND_NAME = { pgm: 'PGM', intl: 'INTL', n1: 'N-1 COMM', nxs: 'N-1 STUDIO', nxb: 'N-1 BT' };
    const tb = el('tbody');
    const cells = [];
    for (const k of AU.order) {
      const c = AU.ch[k];
      const tr = el('tr', {}, el('td', {}, el('b', {}, c.short)));
      for (const b of ['pgm', 'intl', 'n1', 'nxs', 'nxb']) {
        const x = el('button', { class: 'vx-cell', 'aria-label': `${c.short} → ${SEND_NAME[b]}`, title: `Départ de ${c.short} vers ${SEND_NAME[b]}`, onclick: () => { setSend(k, b, !c[b]); explain(SEND_TXT[b](c), sendBad(c, b) ? 'warn' : 'son:send'); } });
        x.sync = () => { x.setAttribute('aria-pressed', String(!!c[b])); x.classList.toggle('on', !!c[b]); x.classList.toggle('bad', sendBad(c, b)); x.textContent = c[b] ? '●' : ''; };
        cells.push(x); tr.appendChild(el('td', {}, x));
      }
      tb.appendChild(tr);
    }
    const matrix = el('table', { class: 'tbl vx-matrix' }, el('thead', {}, el('tr', {}, el('th', {}, 'Tranche'), ...['PGM', 'INTL', 'N-1 COMM', 'N-1 STUDIO', 'N-1 BT'].map((h) => el('th', {}, h)))), tb);
    // retard de ligne
    const dl = el('input', { type: 'range', min: 0, max: 400, step: 20, value: AU.lineDelay, style: { width: '100%' }, 'aria-label': 'Retard de ligne' });
    const dlv = el('div', { class: 'lcd' });
    const sayDelay = () => { const off = avOffsetMs(); explain(`Retard de ligne : ${AU.lineDelay} ms (${AU.lineDelay / 20} image${AU.lineDelay > 20 ? 's' : ''} à 50 Hz). Décalage avec l'image à l'antenne : ${off > 0 ? `son ${off} ms en retard` : off < 0 ? `son ${-off} ms en avance` : 'aucun'}. ${avOk(off) ? 'Dans la tolérance.' : 'HORS TOLÉRANCE : les spectateurs voient les lèvres décalées.'}`, avOk(off) ? 'son:delay' : 'warn'); };
    dl.addEventListener('input', () => { setLineDelay(+dl.value); sayDelay(); });
    const step = (d) => { setLineDelay(AU.lineDelay + d); dl.value = AU.lineDelay; sayDelay(); };
    const follow = hwBtn('ASSERVI AU TALLY', { sub: 'suit la source', onclick: () => { setFollow(!AU.follow); explain(AU.follow ? 'Retard asservi : le mélangeur indique (par tally ou GPI) quelle source est à l\'antenne, et la console ajoute automatiquement sa latence. Le son reste calé même quand on passe sur la caméra HF.' : 'Retard fixe : il ne change plus avec la source. Les caméras filaires n\'ont pas de latence ; la caméra HF a celle de son codec.', 'son:follow'); } });
    const dkv = el('div', { class: 'kv' });
    const avLcd = el('div', { class: 'lcd' });
    // embedder
    const embSel = AU.emb.map((v, i) => selectEl(EMB_OPTIONS, v, (nv) => { AU.emb[i] = nv; explain(`Paire ${2 * i + 1}-${2 * i + 2} du départ SDI : ${embLabel(nv)}. ${nv === SOUND_PLAN[i] ? 'Conforme au plan de son de la chaîne.' : `Le plan de son demande « ${embLabel(SOUND_PLAN[i])} » sur cette paire.`}`, nv === SOUND_PLAN[i] ? 'son:emb' : 'warn'); }));
    embSel.forEach((s, i) => s.setAttribute('aria-label', `Paire ${2 * i + 1}-${2 * i + 2} du départ`));
    const embBody = el('tbody'); const embState = [];
    AU.emb.forEach((v, i) => { const plan = el('td'); const ok = el('td'); embState.push([plan, ok]); embBody.appendChild(el('tr', {}, el('td', {}, `${2 * i + 1}-${2 * i + 2}`), el('td', {}, embSel[i]), plan, ok)); });
    const embStatus = el('p', { class: 'note' });
    pane.append(el('div', { class: 'panelgrid' },
      el('div', { class: 'hwpanel' }, el('h3', {}, 'Matrice des départs (bus et N-x)'), matrix,
        el('p', { class: 'note' }, 'Rouge = erreur classique : une voix dans l\'international, ou une personne qui reçoit sa propre voix dans son N-1. Sur la Vista, la fonction N-x construit automatiquement ces « tout moins un » : on désigne la source à retirer et le bus suit le mélange.')),
      el('div', { class: 'list' },
        el('div', { class: 'hwpanel' }, el('h3', {}, 'Retard de ligne (synchro labiale)'),
          el('div', { class: 'hwrow' }, el('button', { class: 'btn small', onclick: () => step(-20) }, '− 1 image'), dlv, el('button', { class: 'btn small', onclick: () => step(20) }, '+ 1 image'), follow), dl, avLcd, dkv,
          el('p', { class: 'note' }, `Tolérance de bout en bout (EBU R37, sortie vers l'émission) : son en avance de ${AV_TOL.early} ms au plus, en retard de ${AV_TOL.late} ms au plus ; à chaque étape (dont le car), R37 demande de rester entre 5 ms d'avance et 15 ms de retard : vise 0 ms. L'image des caméras filaires arrive sans retard ; celle de la caméra HF arrive avec la latence du codec. Le micro de la caméra HF voyage avec son image : il est déjà calé sur elle.`)),
        el('div', { class: 'hwpanel' }, el('h3', {}, 'Embedder du départ (SDI, paires 1 à 8)'), el('table', { class: 'tbl' }, el('thead', {}, el('tr', {}, el('th', {}, 'Paire'), el('th', {}, 'Embeddé dans le départ'), el('th', {}, 'Plan de son demandé'), el('th', {}, ''))), embBody), embStatus,
          el('p', { class: 'note' }, 'L\'embedder insère le son dans les espaces de suppression du signal SDI du départ (jusqu\'à 16 canaux en HD ; le simulateur montre les 4 premières paires). La chaîne envoie un plan de son : quel son sur quelle paire.')))));
    return {
      update() {
        for (const x of cells) x.sync();
        dlv.textContent = `${AU.lineDelay} ms`; if (document.activeElement !== dl) dl.value = AU.lineDelay;
        follow.classList.toggle('lit', AU.follow);
        const off = avOffsetMs(); const ok = avOk(off);
        avLcd.textContent = off === 0 ? 'Son calé sur l\'image' : `Son ${off > 0 ? 'en retard' : 'en avance'} de ${Math.abs(off)} ms`; avLcd.classList.toggle('red', !ok); avLcd.classList.toggle('green', ok);
        const src = AU.pgmSrc; const lat = videoLatencyMs(src);
        dkv.innerHTML = '';
        for (const [k, v, cls] of [['Source à l\'antenne', src ? sourceLabel(src) : '—'], ['Latence de son image', lat ? `${lat} ms (codec HF)` : '0 ms (liaison filaire)'], ['Retard appliqué au son', `${AU.effDelay} ms${AU.follow ? ' (asservi)' : ''}`], ['Décalage', off === 0 ? '0 ms' : `${off > 0 ? '+' : '−'}${Math.abs(off)} ms (son ${off > 0 ? 'en retard' : 'en avance'})`, ok ? 'ok' : 'err']]) dkv.append(el('dt', {}, k), el('dd', { class: cls || '' }, v));
        AU.emb.forEach((v, i) => { if (embSel[i].value !== v) embSel[i].value = v; const [plan, okc] = embState[i]; plan.textContent = embLabel(SOUND_PLAN[i]); okc.textContent = v === SOUND_PLAN[i] ? 'OK' : 'à corriger'; okc.className = v === SOUND_PLAN[i] ? 'ok' : 'err'; });
        embStatus.textContent = soundPlanOk() ? 'Embedder conforme au plan de son.' : 'Embedder NON conforme au plan de son : à corriger avant le test de ligne.';
        embStatus.className = 'note ' + (soundPlanOk() ? '' : 'warn');
      },
    };
  }

  // ---------- snapshots ----------
  function tabSnap() {
    const list = el('div', { class: 'list' });
    const draw = () => {
      list.innerHTML = '';
      AU.snaps.forEach((s, i) => list.append(el('div', { class: 'vx-snap' + (AU.lastSnap === i ? ' on' : '') }, el('b', {}, `${i + 1} · ${s.name}`), el('span', { class: 'note' }, s.desc),
        el('button', { class: 'btn small primary', onclick: () => { startAudio(); recallSnap(i); draw(); explain(`Snapshot « ${s.name} » rappelé : tous les réglages mémorisés (patch, gains, égaliseurs, dynamiques, faders, départs, VCA) reviennent d'un coup, les faders motorisés se replacent. ${s.desc}`, 'son:snap'); } }, 'Rappeler'),
        el('button', { class: 'btn small', onclick: () => { storeSnap(i); draw(); explain(`Snapshot « ${s.name} » mis à jour avec l'état actuel de la console.`, 'son:snap'); } }, 'Mémoriser'))));
      list.append(el('button', { class: 'btn small', onclick: () => { storeSnap(AU.snaps.length, 'SNAP ' + (AU.snaps.length + 1)); draw(); explain('Nouveau snapshot mémorisé.', 'son:snap'); } }, '+ Nouveau snapshot'));
    };
    draw();
    pane.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Snapshots (mémoires de la console)'), list,
      el('p', { class: 'note' }, 'Un snapshot fige l\'état complet de la console. En direct, on enchaîne des « scènes » préparées : avant-match, match, mi-temps avec duplex, test de ligne. La Vista permet aussi d\'« isoler » des tranches qui ne doivent pas bouger au rappel (le commentaire, par exemple), et une automation dynamique pour les post-productions.')));
    return {};
  }

  // ---------- commentaires ----------
  function tabComm() {
    const tog = hwBtn('COMMENTAIRES', { sub: 'fil écrit', onclick: () => { setCommentary(!CMT.on); explain(CMT.on ? 'Fil des commentaires activé : les interventions du commentateur, du consultant, du bord terrain et du plateau s\'affichent ici pendant le match.' : 'Fil des commentaires coupé (côté simulateur : les commentateurs se taisent, leurs vumètres aussi).', 'son:cmt'); } });
    const feed = el('div', { class: 'vx-feed' });
    let n = -1;
    const kv = el('div', { class: 'kv' });
    pane.append(el('div', { class: 'panelgrid' },
      el('div', { class: 'hwpanel' }, el('h3', {}, 'En direct de la cabine commentateurs'), el('div', { class: 'hwrow' }, tog, el('span', { class: 'note' }, 'Les interventions s\'affichent ici en texte, sans voix ; leurs niveaux sont simulés sur les tranches.')), feed),
      el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Comment les voix passent par la console'), kv,
        el('p', {}, `${SPK.comm1.name} (commentateur) arrive sur MADI 1, ${SPK.comm2.name} (consultant) sur MADI 2, par l'unité de commentaire de la cabine. ${SPK.bt.name}, au bord du terrain, parle dans un micro HF dont le récepteur entre en MIC 11. Le plateau revient par la transmission (AES 3).`),
        el('p', {}, 'Ce qu\'on entendrait de chaque voix suit vraiment la console : patch, gain, fader, VCA, mute, assignation au bus écouté, master, DIM. Ferme COMM 1 : les phrases du commentateur passent en « non entendu » et son vumètre tombe ; écoute le N-1 COMM : les commentateurs n\'y sont pas (normal).'),
        el('p', { class: 'note' }, 'Limite du simulateur : les voix ne sont pas dites (la synthèse vocale du navigateur sonnait trop robotique). Leur niveau est simulé : il fait bouger les vumètres, la loudness et la lampe rouge de la cabine ; l\'égaliseur et la dynamique agissent sur les vumètres et sur la « repisse » de foule dans les micros.'),
        el('p', {}, 'Quand le commentateur « lance » le bord terrain, ouvre la tranche BORD T. : sinon personne ne l\'entend à l\'antenne.'))));
    return {
      update() {
        tog.classList.toggle('lit', CMT.on);
        if (CMT.log.length !== n || (CMT.log.length && feed.children.length === 0)) {
          n = CMT.log.length; feed.innerHTML = '';
          for (const l of CMT.log.slice(-14).reverse()) { const sp = SPK[l.spk]; const r = el('div', { class: 'vx-line' + (l.heard ? '' : ' muted') }, el('b', {}, sp.name), el('span', { class: 'note' }, sp.role + (l.heard ? '' : ' · non entendu (tranche fermée ou bus non écouté)')), el('p', {}, l.text)); r.style.setProperty('--g', GROUPS[l.spk === 'duplex' ? 'ext' : 'comm'].color); feed.appendChild(r); }
        }
        kv.innerHTML = '';
        for (const v of ['comm1', 'comm2', 'bt', 'duplex']) { const g = AU.ctx ? Math.round(20 * Math.log10(Math.max(1e-4, voiceGain(v))) * 10) / 10 : null; kv.append(el('dt', {}, `${SPK[v].name} (${SPK[v].role})`), el('dd', { class: g > -40 ? 'ok' : '' }, g == null ? '—' : g > -40 ? `${fmt(g, 1)} dB à l'écoute (${effMonitor().toUpperCase()})` : 'inaudible à l\'écoute actuelle')); }
      },
    };
  }

  // ---------- comprendre la Vista 1 ----------
  function tabVista() {
    pane.append(el('div', { class: 'panelgrid' },
      el('div', { class: 'hwpanel prose' }, el('h3', {}, 'La Studer Vista 1 en quelques lignes'),
        el('p', {}, 'Console de mixage numérique compacte de Studer (marque aujourd\'hui chez Evertz), pensée pour les espaces réduits : régies de car, petits studios, radio filmée. Elle reprend l\'ergonomie des grandes Vista avec les écrans Vistonics.'),
        el('ul', {}, el('li', {}, 'Surfaces : version 22 faders (environ 1 m de large, idéale en car) ou 32 faders.'), el('li', {}, 'Moteur DSP intégré annoncé à 96 canaux de traitement (mono, stéréo ou 5.1), bus de sortie, N-x, auxiliaires.'), el('li', {}, 'E/S intégrées : entrées micro/ligne avec préamplis, sorties ligne, AES ; extension par cartes D21m (MADI, AES, SDI, réseau audio AoIP) ; selon la version et les options, les nombres varient : se référer à la fiche du constructeur.'), el('li', {}, 'Fonctions broadcast : talkback, lampes rouges et GPIO, N-x (mix-minus), snapshots, automation, retards, surround.')),
        el('p', { class: 'note' }, 'Simulation pédagogique non officielle : interface et chiffres simplifiés, sans lien avec le constructeur.')),
      el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Vistonics : « là où tu regardes, tu agis »'),
        el('p', {}, 'Les molettes et les touches sont montées directement sur l\'écran tactile, au-dessus de chaque tranche : la valeur réglée s\'affiche sous la molette, sans menu caché. Un écran porte 10 tranches.'),
        el('p', {}, 'Code couleur : égaliseur en rouge, dynamique en vert, panoramique en jaune. On reconnaît d\'un coup d\'œil ce qui est actif.'),
        el('p', {}, 'Dans le simulateur, les touches ENTRÉE / ÉGALISEUR / DYNAMIQUE / PAN · DÉPARTS changent ce que portent les molettes des écrans, et SEL envoie la tranche sur l\'écran de la Control Bay avec toutes ses commandes.')),
      el('div', { class: 'hwpanel prose' }, el('h3', {}, 'FaderGlow et faders motorisés'),
        el('p', {}, 'FaderGlow : une bande lumineuse le long de chaque fader, de la couleur de la tranche (ici : bleu ambiances, cyan canons, violet sons des images, orange commentaires, rose duplex et habillage). Sur la vraie console, sa couleur reprend celle de la fonction affichée sur les Vistonics (tranche, auxiliaire, égaliseur graphique…) ou une couleur choisie par l\'utilisateur ; dans le simulateur, elle s\'allume quand la tranche est ouverte à l\'antenne.'),
        el('p', {}, 'Les faders sont motorisés : ils se replacent au changement de couche (layer), au rappel d\'un snapshot, ou quand un automatisme les pilote (ici, l\'assistant de suivi du jeu sur les canons).')),
      el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Le mixage d\'un match de football'),
        el('ol', {}, el('li', {}, 'Ambiances : deux couples (tribune principale, kop) donnent la « largeur » et l\'émotion. Ils ne quittent jamais l\'antenne.'), el('li', {}, 'Canons : souvent une douzaine de micros canons autour du terrain (bien plus sur les grands événements ; 6 dans le simulateur). On ouvre celui qui est près du ballon : frappes, contacts, appels des joueurs.'), el('li', {}, 'Commentaires : compresseur léger, gate ou expandeur contre la foule qui repisse, jamais dans l\'international ni dans leur propre N-1.'), el('li', {}, 'Sons des images : micro de la caméra HF et son des ralentis, ouverts quand leur image passe (AFV).'), el('li', {}, 'Contrôle : loudness intégrée à −23 LUFS, corrélation positive, plan de son respecté, synchro labiale.'))),
      el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Vocabulaire'),
        el('dl', { class: 'kv' }, ...[['N-x / N-1', 'Mélange « tout sauf moi » renvoyé à un intervenant (commentateur, studio, bord terrain).'], ['PFL / AFL', 'Écoute d\'une tranche seule, avant (PFL) ou après (AFL) le fader, sans toucher à l\'antenne.'], ['VCA', 'Fader de commande d\'un groupe de tranches : il agit sur leurs gains, sans créer de bus.'], ['AFV', 'Audio follow video : la tranche s\'ouvre quand l\'image associée passe à l\'antenne.'], ['Talkback', 'Micro d\'ordres de l\'ingénieur du son vers les casques (N-1), jamais vers l\'antenne.'], ['Snapshot', 'Mémoire de l\'état complet de la console, rappelée d\'une touche.'], ['D21m', 'Système d\'E/S modulaire de Studer : cartes MADI, AES, SDI, analogiques, réseau.']].flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])))));
    return {};
  }

  // ---------- boucle ----------
  show('console');
  let fT = 0;
  return {
    frame(dt) { fT += dt || 0.016; if (fT < 0.033) return; fT = 0; drawBridge(); if (cur && cur.frame) cur.frame(); },
    update() {
      for (const k in monBtns) monBtns[k].classList.toggle('lit', AU.monitor === k && !AU.pflActive);
      dim.classList.toggle('lit', AU.dim); mono.classList.toggle('lit', AU.mono); pflInd.classList.toggle('on', AU.pflActive);
      for (const k in tbBtns) tbBtns[k].classList.toggle('pgm', AU.tb === k);
      red.classList.toggle('on', AU.redLight);
      auto.classList.toggle('lit', AU.autoCanon);
      const L = AU.lufs; lufsL.textContent = AU.ctx ? `M ${fmt(L.m, 1)} · S ${fmt(L.s, 1)} · I ${fmt(L.i, 1)} LUFS` : 'Son désactivé';
      startBtn.hidden = !!AU.ctx;
      if (cur && cur.update) cur.update();
    },
  };

  function drawBridge() { drawMeters(bridge); }

}
// relance du bord terrain : prévenir l'ingénieur du son (au poste) ou par l'intercom
on('audio', (e) => {
  if (!e || e.type !== 'cue' || e.k !== 'bt') return;
  const c = AU.ch.bt; if (faderLin(c) > 0.05) return;
  if (S.station === 'son') explain(`Le commentateur lance ${SPK.bt.name} au bord du terrain : ouvre la tranche BORD T. (n° ${c.n}), sinon on ne l'entendra pas à l'antenne !`, 'warn');
  else intercom('RÉAL', `Son : on part au bord terrain avec ${SPK.bt.name}, ouvre-la !`);
});
// voix présente sur l'entrée d'une tranche
function portVoice(c) { return portsOf(c.src).map((p) => PLUG[p] && PLUG[p].voice).find(Boolean); }
function stripNote(c) {
  const t = {
    amb1: 'Couple ORTF (deux cardioïdes à 110°, 17 cm) en tribune principale : l\'image stéréo de la foule. Il reste ouvert tout le match.',
    amb2: 'Couple dans le kop : chants, tambours, l\'émotion. Plus fort, on le dose un peu en dessous de la tribune principale.',
    hfmic: 'Le micro de la caméra HF arrive avec son image (même latence) : on l\'ouvre quand la Steadicam est à l\'antenne (AFV).',
    evsA: 'Son enregistré avec l\'image par l\'EVS : ouvert au ralenti (AFV), souvent baissé pour laisser parler le consultant.',
    evsB: 'Deuxième canal de lecture EVS, même principe.',
    comm1: 'Unité de commentaire en cabine : micro-casque du commentateur. Compresseur léger, gate contre la foule, jamais dans l\'INTL ni dans le N-1 COMMENTAIRE.',
    comm2: 'Micro-casque du consultant : mêmes réglages que le commentateur.',
    bt: 'Récepteur HF du micro main de la journaliste : fermé tant qu\'on ne la « lance » pas. Elle reçoit le N-1 BORD TERRAIN dans son oreillette.',
    duplex: 'Retour du studio par la transmission. Le studio reçoit le N-1 STUDIO (tout sauf lui-même).',
    jingle: 'Lecteur d\'habillage : la virgule sonore part avec le volet logo des ralentis.',
    tone: 'Générateur 1 kHz à −18 dBFS (EBU R68) pour le test de ligne avec la chaîne.',
  }[c.id];
  return t || (c.group === 'canon' ? 'Micro canon (statique, très directif, 48 V) au bord du terrain. Passe-haut vers 120 Hz, un peu de présence vers 3 kHz pour l\'impact du ballon.' : '');
}
