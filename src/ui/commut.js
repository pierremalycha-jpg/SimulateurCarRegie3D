// @ts-check
import { S, emit } from '../state.js';
import { el } from '../util.js';
import { MIX, mixSetPst, mixSetPgm, mixCut, mixAuto, meSource, sourceLabel } from '../pipeline.js';
import { mixInputs } from '../equip.js';
import { $, toast } from './common.js';
import { explain } from './widgets.js';
import { ctrlFunc } from '../net/ctrlnet.js';

/** en car SDI, le pupitre du mélangeur ne commande le processeur que si le réseau de contrôle le joint */
export function mixerOk() {
  const k = ctrlFunc('mixer'); if (k.ok) return true;
  toast('Pupitre du mélangeur : processeur injoignable par le réseau de contrôle.', 'bad');
  explain(`Commutation refusée : le pupitre ne joint plus le processeur du mélangeur (${k.why}). Le programme reste sur sa dernière source : vois le poste Réseau.`, 'warn:ctrl');
  return false;
}
import { canControl } from '../multi/session.js';

// ----------------------------------------------------------------------------------
// Commutation au clavier : touches 1 à 9 (et 0 = entrée 10) partout dans le simulateur.
// On lit e.code (touche physique) : la rangée du haut marche donc en AZERTY avec ou sans Maj,
// et le pavé numérique aussi. Deux modes :
//  · DIRECT : la touche commute l'entrée à l'antenne (bus A / PGM), comme un appui sur la rangée PGM ;
//  · PRESET : la touche prépare l'entrée sur le bus B (PST), Espace / Entrée = CUT, Entrée pavé = AUTO.
// B bascule d'un mode à l'autre.
// ----------------------------------------------------------------------------------
export const COMMUT = { mode: 'direct', osdT: 0 };
try { const m = localStorage.getItem('carregie.keymode'); if (m === 'direct' || m === 'preset') COMMUT.mode = m; } catch (e) { /* stockage indisponible */ }

export function digitOf(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return null;
  if (/^Digit\d$/.test(e.code)) return +e.code.slice(5);
  if (/^Numpad\d$/.test(e.code)) return +e.code.slice(6);
  return null;
}
export function setKeyMode(m) {
  COMMUT.mode = m === 'preset' ? 'preset' : 'direct';
  try { localStorage.setItem('carregie.keymode', COMMUT.mode); } catch (e) { /* stockage indisponible */ }
  emit('keymode', COMMUT.mode);
  osd(COMMUT.mode === 'direct' ? 'Touches 1-9 : commutation DIRECTE à l\'antenne' : 'Touches 1-9 : PRESET (bus B), puis Entrée = CUT', 'mode');
}
export const keyModeLabel = () => (COMMUT.mode === 'direct' ? 'DIRECT PGM' : 'PRESET + CUT');
export function keyLegend() {
  return COMMUT.mode === 'direct'
    ? '1 à 9 (0 = 10) : commuter l\'entrée à l\'antenne · B : passer en mode PRESET'
    : '1 à 9 (0 = 10) : préparer l\'entrée (PST) · Espace ou Entrée : CUT · Entrée du pavé : AUTO · B : mode DIRECT';
}

// where : 'fps' (déplacement : Espace sert au vol, on ne prend que Entrée), 'station' (Espace = CUT)
export function commutKey(e, where = 'station') {
  const d = digitOf(e);
  // session à plusieurs : seul le titulaire du mélangeur commute
  if (!canControl('mix') && (d != null || ['Enter', 'NumpadEnter'].includes(e.code) || (where === 'station' && e.code === 'Space'))) { osd('Mélangeur tenu par un autre participant : prends le rôle Truquiste pour commuter', 'warn'); return true; }
  // car SDI : une touche de commutation sans réseau de contrôle vers le processeur ne passe pas
  if ((d != null || ['Enter', 'NumpadEnter'].includes(e.code) || (where === 'station' && e.code === 'Space')) && !mixerOk()) return true;
  if (d != null) {
    const n = d === 0 ? 10 : d;
    if (n > mixInputs() || !meSource(n)) { osd(`Entrée ${n} non utilisée sur le mélangeur`, 'warn'); return true; }
    if (COMMUT.mode === 'direct') { if (MIX.auto) return true; mixSetPgm(n); osd(n, 'pgm'); }
    else { mixSetPst(n); osd(n, 'pst'); }
    return true;
  }
  if (e.code === 'KeyB' && !e.ctrlKey && !e.metaKey) { setKeyMode(COMMUT.mode === 'direct' ? 'preset' : 'direct'); return true; }
  if (e.code === 'NumpadEnter') { mixAuto(); osd(MIX.pst, 'auto'); return true; }
  if (e.code === 'Enter' || (where === 'station' && e.code === 'Space')) { mixCut(); osd(MIX.pgm, 'cut'); return true; }
  return false;
}

// bandeau de confirmation (visible hors des postes : en se déplaçant ou en vol)
function osd(v, kind) {
  if (S.mode !== 'fps') return;
  let o = $('#commut-osd');
  if (!o) { o = el('div', { id: 'commut-osd', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(o); }
  o.className = kind;
  o.innerHTML = '';
  if (typeof v === 'number') {
    const name = sourceLabel(meSource(v));
    const lab = { pgm: 'À L\'ANTENNE', pst: 'PRÉPARÉE (PST)', cut: 'CUT → ANTENNE', auto: 'AUTO TRANS' }[kind] || '';
    o.append(el('b', {}, String(v)), el('span', {}, name), el('small', {}, lab));
  } else o.append(el('span', {}, v));
  o.hidden = false;
  COMMUT.osdT = performance.now();
  clearTimeout(o._t); o._t = setTimeout(() => { o.hidden = true; }, 1800);
  // le retour PGM s'affiche à la première commutation, pour voir le résultat
  const mm = $('#minimon'); if (mm && mm.hidden && kind !== 'mode' && kind !== 'warn') mm.hidden = false;
}
