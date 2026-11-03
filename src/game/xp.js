// @ts-check
import { PROG, saveProgressSoon } from '../shared.js';
import { emit } from '../state.js';
import { livret } from '../livret.js';
import { COMPETENCES, blocOf } from '../content/referentiel.js';
import { allLessons, CHAPTERS } from '../cours/index.js';
import { etatNiveaux } from '../cours/parcours.js';
import { fait as carriereFaite } from '../carriere/index.js';
import { episodeById } from '../carriere/mails.js';
import { jourDe, serie, bonusSerie, etatDefis, sorteDe, BONUS_DEFIS } from './defis.js';

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
/** @typedef {{ keys: Record<string, { at: number, pts: number, label: string }>, extra: number, badges: Record<string, number>, count: Record<string, number>, log: Array<{ at: number, pts: number, label: string, k?: string }>, jours: string[], defis: Record<string, string[]> }} Game */

/**
 * Les niveaux (v19.25) : 60, comme les paliers d'un pass de saison ; chaque niveau donne une récompense
 * (game/pass.js). Les premiers viennent vite (65 XP pour le niveau 2), puis l'écart grandit de 10 XP par
 * niveau : XP cumulée du niveau n = 5 (n − 1)² + 60 (n − 1) (945 au niveau 10, 5 945 au 30, 20 945 au 60).
 * Les grades (stagiaire → directeur technique) regroupent les niveaux.
 */
export const NIVEAU_MAX = 60;
export const xpPourNiveau = (n) => { const k = Math.max(0, Math.min(NIVEAU_MAX, n) - 1); return 5 * k * k + 60 * k; };
export const GRADES = [
  { des: 1, title: 'Stagiaire' },
  { des: 5, title: 'Assistant technique' },
  { des: 10, title: 'Technicien' },
  { des: 18, title: 'Technicien confirmé' },
  { des: 27, title: 'Ingénieur d\'exploitation' },
  { des: 37, title: 'Chef de car' },
  { des: 48, title: 'Directeur technique' },
];
/** le grade d'un niveau */
export const gradeOf = (n) => { let g = GRADES[0]; for (const x of GRADES) if (n >= x.des) g = x; return g.title; };
export const LEVELS = Array.from({ length: NIVEAU_MAX }, (_, i) => ({ n: i + 1, title: gradeOf(i + 1), xp: xpPourNiveau(i + 1) }));
/** barème (points) : ce que rapporte chaque activité réussie */
export const BAREME = {
  mission: 25,          // une tâche du car vide (Jouer → Car régie → Car vide)
  exercice: 60,         // un exercice d'Olivier terminé (première fois), moins l'aide demandée
  exerciceRefait: 15,
  aide: 8,              // retenue par « Fais-le pour moi »
  indice: 3,            // retenue par indice
  exerciceMin: 20,
  presentation: 20,     // la présentation d'un poste (visite guidée)
  quiz: 30,             // quiz d'une leçon du Cours réussi (3/3)
  exoCours: 30,         // exercice en autonomie d'une leçon réussi (≥ 60/100), la première fois
  exoParfait: 15,       // le même à 90/100 au moins, sans solution demandée (trois étoiles)
  niveau: 60,           // un niveau d'un chapitre du Cours validé (Débutant, Intermédiaire…)
  testNiveau: 40,       // un test de niveau réussi (un niveau sauté)
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
  emission: 100,        // une émission en direct conduite jusqu'au générique de fin (≥ 60/100, médias lancés soi-même)
  emissionRefaite: 25,
  poste: 5,             // un poste découvert
  lieu: 5,              // un endroit du stade découvert
};

/** le niveau atteint pour un total d'XP */
export function levelOf(xp) {
  let L = LEVELS[0];
  for (const l of LEVELS) if (xp >= l.xp) L = l;
  const next = LEVELS.find((l) => l.xp > L.xp) || null;
  const span = next ? next.xp - L.xp : 1;
  return { n: L.n, title: L.title, grade: L.title, from: L.xp, next: next ? next.xp : null, pct: next ? (xp - L.xp) / span : 1, remaining: next ? next.xp - xp : 0 };
}

/** @param {any} [P] @returns {Game} */
export function game(P = PROG) {
  const G = /** @type {any} */ (P);
  if (!G.game || typeof G.game !== 'object') G.game = {};
  const g = G.game;
  g.keys = g.keys || {}; g.extra = g.extra || 0; g.badges = g.badges || {}; g.count = g.count || {}; g.log = g.log || [];
  if (!Array.isArray(g.jours)) g.jours = []; if (!g.defis || typeof g.defis !== 'object') g.defis = {};
  return g;
}
/** le total d'XP @param {any} [P] */
export function xpOf(P = PROG) { const g = game(P); return Object.values(g.keys).reduce((s, k) => s + (k.pts || 0), 0) + (g.extra || 0); }

/**
 * Donne des points. Une clé donnée (ex. « mission:m1 ») ne rapporte qu'une fois ; sans clé, la
 * récompense est répétable. Renvoie ce qui a été gagné (null si déjà donné), et prévient (« xp »).
 * Le premier gain du jour ajoute le bonus de la série ; un gain qui achève un défi du jour ajoute
 * celui du défi (game/defis.js). La sorte (« quiz », « panne »…) vient de la clé, ou de o.sorte.
 * @param {{ key?: string, pts: number, label: string, sorte?: string, P?: any, silent?: boolean, at?: number }} o
 */
export function award(o) {
  const P = o.P || PROG; const g = game(P);
  const pts = Math.max(0, Math.round(o.pts)); if (!pts) return null;
  if (o.key && g.keys[o.key]) return null;
  const before = levelOf(xpOf(P));
  const at = o.at || Date.now();
  const k = o.sorte || sorteDe(o.key);
  if (o.key) g.keys[o.key] = { at, pts, label: o.label }; else g.extra += pts;
  g.log.push({ at, pts, label: o.label, k }); if (g.log.length > 200) g.log.splice(0, g.log.length - 200);
  // la série et les défis du jour (sauf pour leurs propres récompenses)
  const bonus = /** @type {Array<{ pts: number, label: string, sorte: string }>} */ ([]);
  if (k !== 'serie' && k !== 'defi') {
    const j = jourDe(at);
    if (!g.jours.includes(j)) {
      g.jours.push(j); g.jours.sort(); if (g.jours.length > 400) g.jours.splice(0, g.jours.length - 400);
      const sr = serie(g.jours, j);
      bonus.push({ pts: bonusSerie(sr.n), label: sr.n > 1 ? `Série de ${sr.n} jours : bonus de régularité` : 'Premier gain du jour : bonus de régularité', sorte: 'serie' });
    }
    const faits = g.defis[j] = g.defis[j] || [];
    const etat = etatDefis(g, j);
    for (const d of etat) if (d.fini && !faits.includes(d.defi.id)) { faits.push(d.defi.id); bonus.push({ pts: d.defi.pts, label: 'Défi du jour réussi : ' + d.defi.t, sorte: 'defi' }); }
    if (etat.every((d) => d.fini) && !faits.includes('tous')) { faits.push('tous'); bonus.push({ pts: BONUS_DEFIS, label: 'Les trois défis du jour réussis', sorte: 'defi' }); }
    const garder = Object.keys(g.defis).sort().slice(-14); for (const x of Object.keys(g.defis)) if (!garder.includes(x)) delete g.defis[x];
  }
  for (const b of bonus) { g.extra += b.pts; g.log.push({ at, pts: b.pts, label: b.label, k: b.sorte }); }
  const total = xpOf(P), level = levelOf(total);
  const r = { pts, total, label: o.label, level, leveled: level.n > before.n, from: before.n, at, bonus };
  if (P === PROG) { saveProgressSoon(); if (!o.silent) { emit('xp', r); for (const b of bonus) emit('xpBonus', b); } checkBadges(P); }
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
  { id: 'installateur', title: 'Installateur', desc: 'Toutes les tâches du car vide réussies.', ico: 'plan', tier: 'or', test: ({ P }) => Object.keys(P.missions || {}).length >= 22 },
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
  // le parcours du Cours (v19.18) : un niveau validé par ses leçons (pas sauté par un test), les fondamentaux de tous les chapitres, un niveau Expert
  { id: 'premier-niveau', title: 'Premier niveau', desc: 'Un niveau d\'un chapitre du Cours validé : toutes ses leçons terminées, quiz et exercices.', ico: 'cours', tier: 'bronze', test: ({ P }) => CHAPTERS.some((c) => etatNiveaux(c.id, P).some((n) => n.ok)) },
  { id: 'fondamentaux', title: 'Les fondamentaux', desc: 'Le niveau Débutant validé dans tous les chapitres du Cours.', ico: 'livret', tier: 'argent', test: ({ P }) => CHAPTERS.length > 0 && CHAPTERS.every((c) => { const n = etatNiveaux(c.id, P)[0]; return !!n && n.ok; }) },
  { id: 'expert', title: 'Expert', desc: 'Un niveau Expert du Cours validé (le réseau du car IP, le SDI bit à bit, le jour de match).', ico: 'trophee', tier: 'or', test: ({ P }) => CHAPTERS.some((c) => etatNiveaux(c.id, P).some((n) => n.niveau.id === 'expert' && n.ok)) },
  // revenir : la série de jours d'activité, les défis du jour
  { id: 'serie-3', title: 'Régulier', desc: 'Trois jours d\'activité d\'affilée.', ico: 'serie', tier: 'bronze', test: ({ g }) => serie(g.jours).best >= 3 },
  { id: 'serie-7', title: 'Une semaine au car', desc: 'Sept jours d\'activité d\'affilée.', ico: 'serie', tier: 'argent', test: ({ g }) => serie(g.jours).best >= 7 },
  { id: 'serie-30', title: 'Titulaire du poste', desc: 'Trente jours d\'activité d\'affilée.', ico: 'serie', tier: 'or', test: ({ g }) => serie(g.jours).best >= 30 },
  { id: 'defis', title: 'Journée parfaite', desc: 'Les trois défis du jour réussis le même jour.', ico: 'defis', tier: 'argent', test: ({ g }) => Object.values(g.defis || {}).some((l) => l.includes('tous')) },
  { id: 'niveau-10', title: 'Technicien', desc: 'Le niveau 10 atteint.', ico: 'couronne', tier: 'bronze', test: ({ P }) => levelOf(xpOf(P)).n >= 10 },
  { id: 'niveau-30', title: 'Mi-saison', desc: 'Le niveau 30 atteint.', ico: 'couronne', tier: 'argent', test: ({ P }) => levelOf(xpOf(P)).n >= 30 },
  { id: 'niveau-60', title: 'Pass complet', desc: 'Le niveau 60 atteint : toutes les récompenses du pass.', ico: 'couronne', tier: 'or', test: ({ P }) => levelOf(xpOf(P)).n >= 60 },
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
  g.log.sort((a, b) => a.at - b.at); g.log = g.log.slice(-200);
  g.jours = [...new Set([...g.jours, ...t.jours])].sort().slice(-400);
  for (const [j, l] of Object.entries(t.defis)) g.defis[j] = [...new Set([...(g.defis[j] || []), ...(l || [])])];
  return g;
}
