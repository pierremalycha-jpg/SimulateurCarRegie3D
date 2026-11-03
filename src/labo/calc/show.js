// @ts-check
// ----------------------------------------------------------------------------------
// La console lumière, en calcul pur : lire un show de la console dot2 du Labo (labo/dot2/, le show que
// la console enregistre dans le navigateur sous « simdot2.session »), et les notions du chapitre « La
// lumière » qui s'y rattachent.
//   - Le show : des projecteurs (fixtures : id, type, univers, adresse), des groupes, des presets, une
//     séquence principale (main) et des exécuteurs (executors, « page.numéro »), chacun une liste de cues.
//     Une cue garde, par projecteur et par attribut, une valeur de 0 à 1 ({ v }), ou un renvoi à un
//     preset ({ p: « type.numéro » }), et éventuellement un effet ({ fx : forme, amplitude, vitesse en
//     battements par minute, phase en degrés }).
//   - Le tracking : une cue n'enregistre que ce qui change ; l'état à la cue n est la somme des cues 1 à
//     n, la plus récente l'emporte. En « Cue Only », une modification ne se propage pas aux suivantes.
//   - Les lyres de la console : spot (roue de couleurs, roue de gobos, pan 540°, tilt 270°) et wash LED
//     RGBW (mélange de couleurs). Pan et tilt sur 16 bits (grossier, fin).
//   - Un effet de position : pan et tilt en sinus de même vitesse ; déphasés de 90°, la tache décrit un
//     cercle ; de 0° ou 180°, une droite ; entre les deux, une ellipse ; tilt deux fois plus vite : un huit sans
//     déphasage, un arc à 90°.
// ----------------------------------------------------------------------------------
/** les plages de la roue de couleurs de la lyre spot (valeurs DMX) et leur nom */
export const ROUE_COULEURS = /** @type {Array<[string, number, number]>} */ ([['blanc', 0, 9], ['rouge', 10, 19], ['orange', 20, 29], ['jaune', 30, 39], ['vert', 40, 49], ['cyan', 50, 59], ['bleu', 60, 69], ['magenta', 70, 79], ['rose', 80, 89], ['ambre', 90, 99], ['lavande', 100, 109], ['uv', 110, 127]]);
/** la roue de gobos de la lyre spot */
export const ROUE_GOBOS = /** @type {Array<[string, number, number]>} */ ([['ouvert', 0, 9], ['gobo 1', 10, 19], ['gobo 2', 20, 29], ['gobo 3', 30, 39], ['gobo 4', 40, 49], ['gobo 5', 50, 59], ['gobo 6', 60, 69], ['gobo 7', 70, 79]]);
/** les lyres de la console et leurs courses (degrés) */
/** @type {Record<string, { nom: string, pan: [number, number], tilt: [number, number], couleur: string }>} */
export const LYRES = { 'gen-spot': { nom: 'Lyre spot', pan: [-270, 270], tilt: [-135, 135], couleur: 'roue' }, 'gen-wash': { nom: 'Lyre wash RGBW', pan: [-270, 270], tilt: [-135, 135], couleur: 'rgbw' } };
/** valeurs par défaut d'un attribut absent de la cue (comme la bibliothèque de la console) */
const DEFAUT = { DIM: 0, COLORRGB1: 1, COLORRGB2: 1, COLORRGB3: 1, COLORRGB5: 0, PAN: 0.5, TILT: 0.5, COLOR1: 4.5 / 255, GOBO1: 4.5 / 255 };
/** le milieu d'une plage de roue, en valeur 0 à 1 */
export const milieuPlage = (/** @type {Array<[string, number, number]>} */ roue, /** @type {string} */ nom) => { const r = roue.find((x) => x[0] === nom); return r ? (r[1] + r[2]) / 2 / 255 : 0; };
/** le nom de la plage d'une roue pour une valeur 0 à 1 */
export const plageDe = (/** @type {Array<[string, number, number]>} */ roue, v) => { const n = Math.round(v * 255); const r = roue.find((x) => n >= x[1] && n <= x[2]); return r ? r[0] : 'autre'; };

// ---------------- pan, tilt, 16 bits ----------------
/** degrés → valeur 0 à 1 sur une course [min, max] */
export const versV = (deg, /** @type {[number, number]} */ course) => (deg - course[0]) / (course[1] - course[0]);
/** valeur 0 à 1 → degrés */
export const versDeg = (v, /** @type {[number, number]} */ course) => course[0] + v * (course[1] - course[0]);
/** une position sur 16 bits : la valeur (0 à 65 535), l'octet grossier et l'octet fin */
export function position16(deg, /** @type {[number, number]} */ course) {
  const v16 = Math.round(Math.min(1, Math.max(0, versV(deg, course))) * 65535);
  return { v16, grossier: v16 >> 8, fin: v16 & 255 };
}
/** le pas (degrés) d'une position sur 8 bits et sur 16 bits pour une course donnée */
export const pas = (/** @type {[number, number]} */ course) => ({ huit: (course[1] - course[0]) / 255, seize: (course[1] - course[0]) / 65535 });

// ---------------- les effets de position ----------------
/** la forme que décrit la tache quand pan et tilt suivent des sinus (déphasage en degrés, tilt mult fois plus vite) */
export function formeEffet(dephasage, mult = 1) {
  const d = ((dephasage % 180) + 180) % 180;
  // tilt deux fois plus vite : un huit sans déphasage (y = sin 2t), un arc à 90° (y = cos 2t = 1 − 2 sin² t)
  if (mult === 2) return d < 10 || d > 170 ? 'huit' : Math.abs(d - 90) <= 10 ? 'arc' : 'courbe de Lissajous';
  if (mult !== 1) return 'courbe de Lissajous';
  if (d < 10 || d > 170) return 'droite';
  if (Math.abs(d - 90) <= 10) return 'cercle';
  return 'ellipse';
}
/** les points de la trajectoire (n points sur un tour), amplitudes ap et at, déphasage en degrés */
export function trajectoire(dephasage, mult = 1, ap = 1, at = 1, n = 120) {
  return Array.from({ length: n + 1 }, (_, k) => { const t = k / n * 2 * Math.PI; return [ap * Math.sin(t), at * Math.sin(mult * t + dephasage * Math.PI / 180)]; });
}
/** durée d'un tour (s) d'un effet à b battements par minute ; d'un tour de chaser à b pas par minute et n pas */
export const tourEffet = (bpm) => 60 / bpm;
export const tourChaser = (bpm, n) => n * 60 / bpm;

// ---------------- le tracking ----------------
/**
 * L'état de sortie après chaque cue d'une liste, en tracking (par défaut) : chaque cue ajoute ses valeurs à
 * celles d'avant. cues : [{ no, values: { fid: { attr: v } } }] (valeurs simples, pour la leçon).
 * @returns {Array<Record<string, Record<string, number>>>}
 */
export function suivre(/** @type {{ no: number, values: Record<string, Record<string, number>> }[]} */ cues) {
  /** @type {Array<Record<string, Record<string, number>>>} */
  const out = [];
  /** @type {Record<string, Record<string, number>>} */
  let cur = {};
  for (const c of cues) {
    cur = JSON.parse(JSON.stringify(cur));
    for (const [f, attrs] of Object.entries(c.values)) cur[f] = { ...(cur[f] || {}), .../** @type {Record<string, number>} */ (attrs) };
    out.push(cur);
  }
  return out;
}
/**
 * Modifier une cue : en tracking, la nouvelle valeur se propage aux cues suivantes tant qu'elles ne la
 * changent pas ; en « Cue Only », la cue suivante reçoit l'ancienne valeur, pour rester comme avant.
 * Rend la nouvelle liste (la liste donnée n'est pas modifiée).
 */
export function modifier(/** @type {{ no: number, values: Record<string, Record<string, number>> }[]} */ cues, k, /** @type {string} */ f, /** @type {string} */ attr, v, cueOnly = false) {
  const L = JSON.parse(JSON.stringify(cues)); const avant = suivre(cues);
  L[k].values[f] = { ...(L[k].values[f] || {}), [attr]: v };
  if (cueOnly && k + 1 < L.length && !(L[k + 1].values[f] && attr in L[k + 1].values[f])) {
    const ancien = avant[k][f] ? avant[k][f][attr] : undefined;
    if (ancien !== undefined) L[k + 1].values[f] = { ...(L[k + 1].values[f] || {}), [attr]: ancien };
  }
  return L;
}

// ---------------- lire un show de la console ----------------
/** le type (libId) d'un projecteur du show */
export function typeDe(show, fid) {
  const F = (show.fixtures || []).find((x) => String(x.id) === String(fid)); if (!F) return '';
  const T = (show.types || []).find((t) => t.no === F.typeNo); return T ? T.libId : '';
}
/** une valeur de cue résolue : { v, fx } (un renvoi à un preset est remplacé par la valeur du preset) */
export function resoudre(show, fid, attr, /** @type {any} */ e) {
  if (!e) return null;
  let v = e.v, fx = e.fx || null;
  if (v === undefined && e.p) { const P = (show.presets || {})[e.p]; const pv = P && P.values && (P.values[fid] || P.values[String(fid)]); const x = pv && pv[attr]; v = x ? x.v : undefined; if (!fx && x && x.fx) fx = x.fx; }
  return v === undefined && !fx ? null : { v, fx };
}
/** un exécuteur du show : « main » ou « page.numéro » */
export const executeur = (show, /** @type {string} */ id) => (id === 'main' ? show.main : (show.executors || {})[id]) || null;
/** tous les exécuteurs qui ont des cues (main compris) */
export const listes = (show) => [['main', show.main], ...Object.entries(show.executors || {})].filter(([, e]) => e && Array.isArray(e.cues) && e.cues.length);
/**
 * L'état suivi (tracking) d'un exécuteur à sa cue numéro no : { fid: { attr: { v, fx } } }, ou null si la cue n'existe pas.
 * Les cues sont prises dans l'ordre de leur numéro.
 */
export function etatCue(show, /** @type {string} */ execId, no) {
  const E = executeur(show, execId); if (!E || !Array.isArray(E.cues)) return null;
  const cues = [...E.cues].sort((a, b) => a.no - b.no);
  if (!cues.some((c) => Math.abs(c.no - no) < 1e-6)) return null;
  /** @type {Record<string, Record<string, any>>} */ const st = {};
  for (const c of cues) {
    if (c.no > no + 1e-6) break;
    for (const [fid, attrs] of Object.entries(c.values || {})) for (const [a, e] of Object.entries(attrs || {})) { const r = resoudre(show, fid, a, e); if (r) (st[fid] = st[fid] || {})[a] = r; }
  }
  return st;
}
/** la valeur (0 à 1) d'un attribut dans un état, ou sa valeur par défaut */
export const valeur = (st, fid, /** @type {string} */ attr) => { const x = st && st[fid] && st[fid][attr]; return x && x.v !== undefined ? x.v : DEFAUT[attr] ?? 0; };
/** la couleur d'une lyre dans un état : le nom de la plage de la roue (spot) ou la teinte du mélange RVB + blanc (wash) */
export function couleurDe(show, st, fid) {
  const t = typeDe(show, fid);
  if (t === 'gen-spot') return plageDe(ROUE_COULEURS, valeur(st, fid, 'COLOR1'));
  const w = valeur(st, fid, 'COLORRGB5');
  return teinte(valeur(st, fid, 'COLORRGB1') + w, valeur(st, fid, 'COLORRGB2') + w, valeur(st, fid, 'COLORRGB3') + w);
}
/** le nom d'une couleur RVB (0 à 1 chacune) : blanc si peu saturée, sinon la teinte la plus proche */
export function teinte(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  if (mx <= 1e-6) return 'noir';
  if ((mx - mn) / mx < 0.35) return 'blanc';
  let h;
  if (mx === r) h = ((g - b) / (mx - mn) + 6) % 6; else if (mx === g) h = (b - r) / (mx - mn) + 2; else h = (r - g) / (mx - mn) + 4;
  h *= 60;
  const T = [[15, 'rouge'], [45, 'orange'], [70, 'jaune'], [160, 'vert'], [200, 'cyan'], [255, 'bleu'], [330, 'magenta'], [361, 'rouge']];
  return /** @type {string} */ (T.find(([lim]) => h < Number(lim))[1]);
}
/** les valeurs RVB + blanc (0 à 1) d'une couleur nommée, pour une lyre wash */
export const RVBW = { rouge: [1, 0, 0, 0], orange: [1, 0.45, 0, 0], jaune: [1, 0.9, 0, 0], vert: [0, 1, 0, 0], cyan: [0, 1, 1, 0], bleu: [0, 0.2, 1, 0], magenta: [1, 0, 1, 0], blanc: [1, 1, 1, 1] };
/** l'effet de position d'une lyre dans un état : forme, vitesse (BPM), déphasage ; null s'il n'y en a pas */
export function effetPosition(st, fid) {
  const p = st && st[fid] && st[fid].PAN && st[fid].PAN.fx, t = st && st[fid] && st[fid].TILT && st[fid].TILT.fx;
  if (!p || !t) return null;
  const amp = (x) => Math.abs((x.high ?? 0) - (x.low ?? 0));
  if (amp(p) < 1e-4 || amp(t) < 1e-4) return null;
  const mult = Math.round((t.mult || 1) / (p.mult || 1));
  const deph = (((t.phase || 0) - (p.phase || 0)) % 360 + 360) % 360;
  const memeForme = (p.form || 'sin') === (t.form || 'sin');
  return { forme: memeForme ? formeEffet(deph, mult) : 'autre', speed: p.speed || 0, dephasage: deph, formes: [p.form, t.form] };
}
/** un exécuteur est un chaser (il enchaîne ses cues tout seul, à sa vitesse) */
export const estChaser = (E) => !!(E && E.settings && E.settings.isChaser);
