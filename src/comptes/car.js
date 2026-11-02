// @ts-check

// ----------------------------------------------------------------------------------
// Ce que l'élève fait au car régie (v19.25), pour le tableau de bord du professeur : rangé dans la
// progression (PROG.car), fusionné entre appareils comme le reste (shared.js), lu par comptes/bilan.js.
//   t        secondes actives par activité : jeu (en tout), car (dans le car, à pied), stade (dehors),
//            poste (assis à un poste), cadreur (une caméra en main), plan (plan des caméras), autre
//   postes   par poste : n ouvertures, s secondes assis, m secondes de manipulation (une action il y a
//            moins de 5 s), a actions (clic, touche, molette, réglage), d dernière visite
//   exos     par exercice pratique d'Olivier : n commencés, f finis, ab abandonnés, aide (« Fais-le pour
//            moi »), ind (indices), err (mauvaises réponses), s secondes, d dernier essai
//   missions par mission spécifique : n lancées, f finies, titre, r dernier résultat, d
//   vus      ce qu'il a consulté : app (matériel de la visionneuse), lieux (destinations du stade),
//            fen (fenêtres ouvertes : fiches, synoptiques, plan…)
//   pannes   n apparues pendant ses parties, ok résolues
//   sessions les dernières parties : at, s (secondes actives), p (mode de départ), postes ouverts
// Une seconde ne compte que si la page est visible et que l'élève a agi dans les deux dernières minutes.
// Ici le calcul pur (forme, comptage d'une seconde, fusion) ; les écouteurs sont dans comptes/suivi_car.js.
// ----------------------------------------------------------------------------------
export const ACTIF_MS = 120000, MANIP_MS = 5000, SESSIONS_MAX = 40, CLES_MAX = 80;

/** la forme vide (pure) */
export const carVide = () => ({ t: {}, postes: {}, exos: {}, missions: {}, vus: { app: {}, lieux: {}, fen: {} }, pannes: { n: 0, ok: 0 }, sessions: [] });
/** PROG.car (ou celui de la progression donnée), créé et remis en forme au besoin (pur) */
export function car(P) {
  const p = /** @type {any} */ (P);
  if (!p.car || typeof p.car !== 'object') p.car = carVide();
  const c = p.car, v = carVide();
  for (const k of Object.keys(v)) if (!c[k] || typeof c[k] !== typeof v[k] || Array.isArray(c[k]) !== Array.isArray(v[k])) c[k] = v[k];
  for (const k of Object.keys(v.vus)) if (!c.vus[k] || typeof c.vus[k] !== 'object') c.vus[k] = {};
  return c;
}
const plus = (o, k, n = 1) => { o[k] = (Number(o[k]) || 0) + n; };

/**
 * Une seconde de jeu (pure, pour les tests) : où elle compte, selon l'état du simulateur.
 * @param {any} c PROG.car @param {{ mode: string, station?: string | null, inTruck?: boolean }} etat
 * @param {number} now @param {number} actif dernière action de l'élève @param {number} manip dernière action à son poste
 * @returns {boolean} la seconde a compté
 */
export function compterSeconde(c, etat, now, actif, manip, vu = true) {
  if (!vu || etat.mode === 'start' || now - actif > ACTIF_MS) return false;
  plus(c.t, 'jeu');
  const m = etat.mode;
  if (m === 'station' && etat.station) {
    plus(c.t, 'poste');
    const p = c.postes[etat.station] = c.postes[etat.station] || { n: 0, s: 0, m: 0, a: 0 };
    p.s++; p.d = now;
    if (now - manip <= MANIP_MS) p.m++;
  } else if (m === 'camop') plus(c.t, 'cadreur');
  else if (m === 'plan') plus(c.t, 'plan');
  else if (m === 'fps') plus(c.t, etat.inTruck ? 'car' : 'stade');
  else plus(c.t, 'autre');
  const se = c.sessions[c.sessions.length - 1];
  if (se && !se.fin) se.s = (se.s || 0) + 1;
  return true;
}

/** fusion de deux PROG.car (deux appareils) : le plus grand compte de chaque chose, les sessions des deux (pure) */
export function mergeCar(a, b) {
  if (!b || typeof b !== 'object') return a;
  const A = car({ car: a ? JSON.parse(JSON.stringify(a)) : null }), B = car({ car: JSON.parse(JSON.stringify(b)) });
  const max = (x, y) => { for (const [k, v] of Object.entries(y || {})) { if (typeof v === 'number') x[k] = Math.max(Number(x[k]) || 0, v); else if (typeof v === 'string' && !x[k]) x[k] = v; } return x; };
  max(A.t, B.t); max(A.pannes, B.pannes);
  for (const k of ['postes', 'exos', 'missions']) for (const [id, v] of Object.entries(B[k])) A[k][id] = max(A[k][id] || {}, v);
  for (const k of ['app', 'lieux', 'fen']) max(A.vus[k], B.vus[k]);
  const seen = new Map(A.sessions.map((s) => [s.at, s]));
  for (const s of B.sessions) { const m = seen.get(s.at); if (!m) A.sessions.push(s); else { m.s = Math.max(m.s || 0, s.s || 0); for (const p of s.postes || []) if (!m.postes.includes(p)) m.postes.push(p); } }
  A.sessions = A.sessions.sort((x, y) => x.at - y.at).slice(-SESSIONS_MAX);
  return A;
}
