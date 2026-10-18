// @ts-check
import { S, camById } from './state.js';
import { evsLayout } from './equip.js';

// ----------------------------------------------------------------------------------
// Baie de brassage (jackfield) : exercice « car vide ».
// Quand S.patch.on est vrai, les liaisons ne sont plus « normalées » : chaque signal
// doit être brassé à la main avec un cordon. Trois champs :
//   1. sources → entrées de la grille
//   2. sorties de la grille → destinations (EVS, départs, écran géant, Grade 1)
//   3. distributeur de référence → entrée REF des CCU
// ----------------------------------------------------------------------------------
const isSys = (c) => c && c.link !== 'hf' && !['pov', 'ptz', 'drone'].includes(c.type);

// numéro d'entrée de grille attendu pour chaque source logique
export const ROUTER_IN = { EVSA: 17, EVSB: 18, GFX: 19, GFXK: 20, STUDIO: 21, BARS: 22, PGM: 24, CLEAN: 25, PVW: 26, RETANT: 27 };
export function routerInOf(logical) {
  if (!logical) return null;
  if (logical.startsWith('CAM')) return +logical.slice(3);
  return ROUTER_IN[logical] ?? null;
}
// source physique → source logique (ce que l'image montrera réellement)
export function physToLogical(p) {
  if (!p) return null;
  if (p.startsWith('CAM:')) return 'CAM' + p.slice(4);
  return { EVS1: 'EVSA', EVS2: 'EVSB', GFXF: 'GFX', GFXK: 'GFXK', STUDIO: 'STUDIO', SPGBARS: 'BARS', MIXPGM: 'PGM', MIXCLN: 'CLEAN', MIXPVW: 'PVW', RXRET: 'RETANT' }[p] ?? null;
}
export function physLabel(p) {
  if (p.startsWith('CAM:')) {
    const c = camById(+p.slice(4)); const n = p.slice(4);
    if (!c) return `CAM ${n}`;
    return c.link === 'hf' ? `RX HF ${n}` : isSys(c) ? `CCU ${n}` : `CONV ${n}`;
  }
  return { EVS1: 'EVS PGM1', EVS2: 'EVS PGM2', GFXF: 'GFX FILL', GFXK: 'GFX KEY', STUDIO: 'DUPLEX', SPGBARS: 'SPG MIRE', MIXPGM: 'MÉL. PGM', MIXCLN: 'MÉL. CLEAN', MIXPVW: 'MÉL. PVW', RXRET: 'RX RETOUR' }[p] || p;
}
// sorties de grille brassables et leur clé de routage
export const OUT_KEY = (o) => (o >= 41 && o <= 48 ? 'REC' + (o - 40) : { 49: 'AUX_TX1', 50: 'AUX_TX2', 51: 'AUX_GIANT', 52: 'AUX_VISION' }[o]);
export const DEST_LABEL = (d) => (d.startsWith('EVSREC') ? `EVS REC ${d.slice(6)}` : { TX1: 'CODEUR TX1', TX2: 'CODEUR TX2', GIANT: 'ÉCRAN GÉANT', GRADE1: 'GRADE 1' }[d] || d);

export function fields() {
  const L = evsLayout();
  const cams = [...S.cams].sort((a, b) => a.id - b.id);
  const srcTop = [...cams.map((c) => 'CAM:' + c.id), 'EVS1', ...(L.plays > 1 ? ['EVS2'] : []), 'GFXF', 'GFXK', 'STUDIO', 'SPGBARS', 'MIXPGM', 'MIXCLN', 'MIXPVW', 'RXRET'];
  const inBottom = [...Array(16).keys()].map((i) => i + 1).concat([17, 18, 19, 20, 21, 22, 24, 25, 26, 27]);
  const outTop = [...Array(L.rec).keys()].map((i) => 41 + i).concat([49, 50, 51, 52]);
  const destBottom = [...Array(L.rec).keys()].map((i) => 'EVSREC' + (i + 1)).concat(['TX1', 'TX2', 'GIANT', 'GRADE1']);
  const sysCams = cams.filter(isSys);
  return {
    inputs: { title: 'Sources → entrées de la grille', top: srcTop, bottom: inBottom, color: '#46c6f2' },
    outputs: { title: 'Sorties de la grille → destinations', top: outTop, bottom: destBottom, color: '#ffd23f' },
    refs: { title: 'Distributeur de référence → CCU', top: [...Array(16).keys()].map((i) => i + 1), bottom: sysCams.map((c) => c.id), color: '#c77dff' },
  };
}

// plan de brassage attendu (identique à la liste de câblage du car)
export function expected() {
  const F = fields(); const e = { inputs: {}, outputs: {}, refs: {} };
  for (const p of F.inputs.top) { const n = routerInOf(physToLogical(p)); if (n) e.inputs[n] = p; }
  for (const o of F.outputs.top) e.outputs[o] = o <= 48 ? 'EVSREC' + (o - 40) : { 49: 'TX1', 50: 'TX2', 51: 'GIANT', 52: 'GRADE1' }[o];
  for (const id of F.refs.bottom) e.refs[id] = id;
  return e;
}
export function patchScore() {
  const e = expected(); const P = S.patch;
  let ok = 0, total = 0; const wrong = [];
  for (const k in e.inputs) { total++; if (P.inputs[k] === e.inputs[k]) ok++; else if (P.inputs[k]) wrong.push(`IN ${k}`); }
  for (const k in e.outputs) { total++; if (P.outputs[k] === e.outputs[k]) ok++; else if (P.outputs[k]) wrong.push(`OUT ${k}`); }
  for (const k in e.refs) { total++; if (P.refs[k]) ok++; }
  return { ok, total, pct: total ? Math.round(ok / total * 100) : 0, wrong };
}
export function patchNormal() { const e = expected(); S.patch.inputs = { ...e.inputs }; S.patch.outputs = { ...e.outputs }; S.patch.refs = { ...e.refs }; }
export function patchEmpty() { S.patch.inputs = {}; S.patch.outputs = {}; S.patch.refs = {}; }

// ce que reçoit réellement une destination (EVSREC n, TX1, TX2, GIANT, GRADE1)
export function destFeed(dest, ROUTER) {
  const P = S.patch;
  if (!P.on) {
    if (dest.startsWith('EVSREC')) return ROUTER.map['REC' + dest.slice(6)];
    return ROUTER.map[{ TX1: 'AUX_TX1', TX2: 'AUX_TX2', GIANT: 'AUX_GIANT', GRADE1: 'AUX_VISION' }[dest]];
  }
  const o = Object.keys(P.outputs).find((k) => P.outputs[k] === dest);
  return o ? ROUTER.map[OUT_KEY(+o)] : null;
}
export function refPatched(camId) { return !S.patch.on || !!S.patch.refs[camId]; }
