// @ts-check
import { PROG, saveProgressSoon } from '../shared.js';
import { emit } from '../state.js';
import { livret } from '../livret.js';
import { COMPETENCES, blocOf } from '../content/referentiel.js';
import { allLessons } from '../cours/index.js';
import { fait as carriereFaite } from '../carriere/index.js';
import { episodeById } from '../carriere/mails.js';

// ----------------------------------------------------------------------------------
// La progression du joueur : des points d'expérience (XP) pour chaque activité réussie, des
// niveaux de technicien (stagiaire → directeur technique) et des badges. Tout est relié au
// référentiel TIEE : les badges de compétence suivent le livret (src/livret.js), les points
// viennent des mêmes activités (missions, exercices d'Olivier, quiz, pannes, jour de match,
// caméra en 3D, réseau, atelier, brassage, entrepôt). Calcul pur, sans interface : enregistré
// dans PROG.game avec le reste de la progression ; l'affichage est dans game/hud.js.
//   keys    : récompenses données une seule fois (clé → points), ex. « mission:m1 »
//   extra   : points des récompenses répétables (une panne résolue, un exercice refait)
//   badges  : badge → date d'obtention
//   count   : compteurs (pannes résolues, exercices terminés…)
// ----------------------------------------------------------------------------------
/** @typedef {{ keys: Record<string, { at: number, pts: number, label: string }>, extra: number, badges: Record<string, number>, count: Record<string, number>, log: Array<{ at: number, pts: number, label: string }> }} Game */

export const LEVELS = [
  { n: 1, title: 'Stagiaire', xp: 0 },
  { n: 2, title: 'Assistant technique', xp: 120 },
  { n: 3, title: 'Technicien', xp: 320 },
  { n: 4, title: 'Technicien confirmé', xp: 650 },
  { n: 5, title: 'Ingénieur d\'exploitation', xp: 1100 },
  { n: 6, title: 'Chef de car', xp: 1700 },
  { n: 7, title: 'Directeur technique', xp: 2500 },
];
/** barème (points) : ce que rapporte chaque activité réussie */
export const BAREME = {
  mission: 25,          // une mission du mode « Tout à faire »
  exercice: 60,         // un exercice d'Olivier terminé (première fois), moins l'aide demandée
  exerciceRefait: 15,
  aide: 8,              // retenue par « Fais-le pour moi »
  indice: 3,            // retenue par indice
  exerciceMin: 20,
  presentation: 20,     // la présentation d'un poste (visite guidée)
  quiz: 30,             // quiz d'une leçon du Cours réussi (3/3)
  notion: 15,           // notion de la caméra en 3D acquise
  quizChapitre: 40,     // quiz d'un chapitre de la caméra en 3D réussi
  mes: 100,             // mise en service de la caméra réussie (≥ 60/100)
  mesRefaite: 25,
  reseau: 40,           // mission de la formation réseau ST 2110
  reseauAidee: 25,
  panne: 20,            // panne cachée résolue, la première fois pour cette panne
  panneRapide: 35,      // en moins d'une minute
  panneRefaite: 5,      // une panne déjà résolue, de nouveau
  atelier: 80,          // montage à l'atelier terminé
  atelierRefait: 25,
  brassage: 80,         // car vide brassé à 100 %
  entrepot: 100,        // mission de l'entrepôt réussie (≥ 60/100)
  entrepotRefait: 25,
  poste: 5,             // un poste découvert
  lieu: 5,              // un endroit du stade découvert
};

/** le niveau atteint pour un total d'XP */
export function levelOf(xp) {
  let L = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.xp) L = l;
  const next = LEVELS.find((l) => l.xp > L.xp) || null;
  const span = next ? next.xp - L.xp : 1;
  return { n: L.n, title: L.title, from: L.xp, next: next ? next.xp : null, pct: next ? (xp - L.xp) / span : 1, remaining: next ? next.xp - xp : 0 };
}

/** @param {any} [P] @returns {Game} */
export function game(P = PROG) {
  const G = /** @type {any} */ (P);
  if (!G.game || typeof G.game !== 'object') G.game = {};
  const g = G.game;
  g.keys = g.keys || {}; g.extra = g.extra || 0; g.badges = g.badges || {}; g.count = g.count || {}; g.log = g.log || [];
  return g;
}
/** le total d'XP @param {any} [P] */
export function xpOf(P = PROG) { const g = game(P); return Object.values(g.keys).reduce((s, k) => s + (k.pts || 0), 0) + (g.extra || 0); }

/**
 * Donne des points. Une clé donnée (ex. « mission:m1 ») ne rapporte qu'une fois ; sans clé, la
 * récompense est répétable. Renvoie ce qui a été gagné (null si déjà donné), et prévient (« xp »).
 * @param {{ key?: string, pts: number, label: string, P?: any, silent?: boolean }} o
 */
export function award(o) {
  const P = o.P || PROG; const g = game(P);
  const pts = Math.max(0, Math.round(o.pts)); if (!pts) return null;
  if (o.key && g.keys[o.key]) return null;
  const before = levelOf(xpOf(P));
  const at = Date.now();
  if (o.key) g.keys[o.key] = { at, pts, label: o.label }; else g.extra += pts;
  g.log.push({ at, pts, label: o.label }); if (g.log.length > 120) g.log.splice(0, g.log.length - 120);
  const total = xpOf(P), level = levelOf(total);
  const r = { pts, total, label: o.label, level, leveled: level.n > before.n, at };
  if (P === PROG) { saveProgressSoon(); if (!o.silent) emit('xp', r); checkBadges(P); }
  return r;
}
export function bump(name, by = 1, P = PROG) { const g = game(P); g.count[name] = (g.count[name] || 0) + by; return g.count[name]; }

// ---------------- badges ----------------
/** @typedef {{ id: string, title: string, desc: string, ico: string, tier: 'bronze' | 'argent' | 'or', test: (ctx: { P: any, g: Game, L: ReturnType<typeof livret> }) => boolean, comp?: string }} Badge */
const doneTutor = (P, pred = (/** @type {string} */ id) => true) => Object.entries(P.tutor || {}).filter(([id, p]) => p && p.done && pred(id));
/** @type {Badge[]} */
export const BADGES = [
  { id: 'premier-pas', title: 'Premiers pas', desc: 'Un premier poste du car ouvert.', ico: 'porte', tier: 'bronze', test: ({ P }) => Object.keys(P.visited || {}).length >= 1 },
  { id: 'explorateur', title: 'Explorateur', desc: 'Dix postes du car découverts.', ico: 'boussole', tier: 'argent', test: ({ P }) => Object.keys(P.visited || {}).length >= 10 },
  { id: 'tour-du-car', title: 'Le tour du car', desc: 'La visite guidée d\'Olivier terminée : tous les postes présentés.', ico: 'drapeau', tier: 'argent', test: ({ P }) => doneTutor(P, (id) => id.startsWith('poste-')).length >= 10 },
  { id: 'premier-exercice', title: 'Premier exercice', desc: 'Un exercice pratique d\'Olivier terminé.', ico: 'etoile', tier: 'bronze', test: ({ P }) => doneTutor(P, (id) => !id.startsWith('poste-')).length >= 1 },
  { id: 'sans-aide', title: 'Sans filet', desc: 'Un exercice terminé sans indice ni « Fais-le pour moi ».', ico: 'bouclier', tier: 'argent', test: ({ P }) => doneTutor(P, (id) => !id.startsWith('poste-')).some(([, p]) => !p.aided && !p.hints) },
  { id: 'cinq-exercices', title: 'Entraîné', desc: 'Cinq exercices différents terminés.', ico: 'medaille', tier: 'argent', test: ({ P }) => doneTutor(P, (id) => !id.startsWith('poste-')).length >= 5 },
  { id: 'quinze-exercices', title: 'Polyvalent', desc: 'Quinze exercices différents terminés.', ico: 'trophee', tier: 'or', test: ({ P }) => doneTutor(P, (id) => !id.startsWith('poste-')).length >= 15 },
  { id: 'installateur', title: 'Installateur', desc: 'Toutes les missions du mode « Tout à faire » réussies.', ico: 'plan', tier: 'or', test: ({ P }) => Object.keys(P.missions || {}).length >= 22 },
  { id: 'sang-froid', title: 'Sang-froid', desc: 'Une panne cachée résolue en moins d\'une minute.', ico: 'eclair', tier: 'argent', test: ({ g }) => (g.count.panneRapide || 0) >= 1 },
  { id: 'depanneur', title: 'Dépanneur', desc: 'Cinq pannes cachées différentes résolues.', ico: 'alarme', tier: 'or', test: ({ g }) => (g.count.panne || 0) >= 5 },
  { id: 'brasseur', title: 'Brasseur', desc: 'Le car vide brassé à 100 %.', ico: 'brassage', tier: 'argent', test: ({ P }) => (P.patchBest || 0) >= 100 },
  { id: 'monteur', title: 'Monteur', desc: 'Une caméra montée à l\'atelier.', ico: 'ccu', tier: 'bronze', test: ({ P }) => (P.rigs || []).length >= 1 },
  { id: 'jour-de-match', title: 'Jour de match', desc: 'Un jour de match joué à 60 % au moins.', ico: 'antenne', tier: 'or', test: ({ P }) => (P.scenarios || []).some((s) => (s.score || 0) >= 60) },
  { id: 'reseau', title: 'Ingénieur réseau', desc: 'Les 14 missions de la formation ST 2110 réussies.', ico: 'reseau', tier: 'or', test: ({ P }) => Object.keys((P.net || {}).missions || {}).length >= 14 },
  { id: 'cameraman', title: 'Mise en service', desc: 'La caméra de plateau mise en service (60/100 au moins).', ico: 'vision', tier: 'argent', test: ({ P }) => !!(P.camera && P.camera.mes && P.camera.mes.best && P.camera.mes.best.score >= 60) },
  { id: 'entrepot', title: 'Régie mobile', desc: 'Une mission de l\'entrepôt réussie.', ico: 'materiel', tier: 'or', test: ({ P }) => Object.values((P.entrepot || {}).missions || {}).some((m) => m && m.best && (m.best.score ?? m.best) >= 60) },
  { id: 'embauche', title: 'Embauché', desc: 'La mission de stagiaire de la Carrière réussie : le tour du car et ses six postes.', ico: 'chef', tier: 'bronze', test: ({ P }) => { const ep = episodeById('stagiaire'); return !!ep && !!P.carriere && carriereFaite(ep, P); } },
  { id: 'curieux', title: 'Curieux', desc: 'Dix leçons du Cours acquises (quiz 3/3).', ico: 'cours', tier: 'bronze', test: ({ P }) => Object.values(P.cours || {}).filter((c) => c && c.quiz && c.quiz.total && c.quiz.score === c.quiz.total).length >= 10 },
  { id: 'erudit', title: 'Érudit', desc: 'Toutes les leçons du Cours acquises.', ico: 'livret', tier: 'or', test: ({ P }) => { const ids = allLessons().map((x) => x.lesson.id); const C = P.cours || {}; return ids.length > 0 && ids.every((id) => C[id] && C[id].quiz && C[id].quiz.total && C[id].quiz.score === C[id].quiz.total); } },
  { id: 'opticien', title: 'Opticien', desc: 'Vingt notions de la caméra en 3D acquises.', ico: 'ccu', tier: 'argent', test: ({ P }) => Object.values(((P.camera || {}).notions) || {}).filter((n) => n && n.total && n.score === n.total).length >= 20 },
  // une compétence du référentiel travaillée (bronze), consolidée (or) : le livret décide
  ...COMPETENCES.flatMap((c) => /** @type {Badge[]} */ ([
    { id: 'comp-' + c.code, comp: c.code, title: `Compétence ${c.code}`, desc: `${c.titre} : travaillée (une activité réussie).`, ico: 'livret', tier: 'bronze', test: ({ L }) => { const x = L.comps.find((k) => k.code === c.code); return !!x && (x.niveau === 'travaillee' || x.niveau === 'consolidee'); } },
    { id: 'comp-' + c.code + '-or', comp: c.code, title: `Compétence ${c.code}, consolidée`, desc: `${c.titre} : consolidée (trois activités différentes réussies).`, ico: 'livret', tier: 'or', test: ({ L }) => { const x = L.comps.find((k) => k.code === c.code); return !!x && x.niveau === 'consolidee'; } },
  ])),
];
export const badgeById = (id) => BADGES.find((b) => b.id === id) || null;
export const badgeBloc = (b) => (b.comp ? blocOf(b.comp) : null);

/** vérifie tous les badges ; renvoie ceux qui viennent d'être obtenus (et prévient, « badge ») */
export function checkBadges(P = PROG) {
  const g = game(P); let L = null;
  const won = [];
  for (const b of BADGES) {
    if (g.badges[b.id]) continue;
    let ok;
    try { if (b.comp) L = L || livret(P); ok = b.test({ P, g, L: L || livret(P) }); } catch (e) { ok = false; }
    if (ok) { g.badges[b.id] = Date.now(); won.push(b); }
  }
  if (won.length && P === PROG) { saveProgressSoon(); for (const b of won) emit('badge', b); }
  return won;
}
export const badgesWon = (P = PROG) => BADGES.filter((b) => game(P).badges[b.id]);

/** fusion de deux progressions (shared.js) : une récompense donnée sur l'un des deux appareils l'est pour de bon */
export function mergeGame(mine, theirs) {
  if (!theirs) return mine;
  const g = game({ game: mine }), t = game({ game: theirs });
  for (const [k, v] of Object.entries(t.keys)) if (!g.keys[k]) g.keys[k] = v;
  g.extra = Math.max(g.extra, t.extra);
  for (const [k, v] of Object.entries(t.badges)) if (!g.badges[k]) g.badges[k] = v;
  for (const [k, v] of Object.entries(t.count)) g.count[k] = Math.max(g.count[k] || 0, v);
  const seen = new Set(g.log.map((l) => l.at)); for (const l of t.log) if (!seen.has(l.at)) g.log.push(l);
  g.log.sort((a, b) => a.at - b.at); g.log = g.log.slice(-120);
  return g;
}
