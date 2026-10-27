// @ts-check
import { CHAPTERS, lessonById } from './index.js';
import { exoOf, SEUIL_EXO, SEUIL_PARFAIT } from './exo.js';
import { shuffled } from '../util.js';

// ----------------------------------------------------------------------------------
// Le parcours du Cours (v19.18, décidé le 26 octobre 2026), à la façon de Duolingo : chaque chapitre est
// une catégorie (la vidéo, le SDI, le réseau…) dont les leçons sont rangées en niveaux, Débutant,
// Intermédiaire, Avancé, Expert. Un niveau s'ouvre quand le précédent est validé : toutes ses leçons
// terminées (quiz réussi en entier et exercice en autonomie réussi) et une moyenne d'exercices d'au
// moins SEUIL_MOYENNE sur 100 (les aides coûtent des points : un niveau fait en demandant tout ne passe
// pas). Le test de niveau permet de sauter un niveau qu'on connaît déjà : des questions tirées des
// quiz des leçons qu'on saute, réussi à SEUIL_TEST. Le premier niveau de chaque chapitre est ouvert :
// on commence par les fondamentaux de chaque catégorie, dans l'ordre que l'on veut. Au profil Formateur
// (libre), tout est ouvert. Calcul pur sur une progression (PROG ou celle d'un stagiaire).
// ----------------------------------------------------------------------------------
export const NIVEAUX = /** @type {const} */ ([
  { id: 'debutant', titre: 'Débutant', sous: 'Les fondamentaux' },
  { id: 'intermediaire', titre: 'Intermédiaire', sous: 'Se servir des notions' },
  { id: 'avance', titre: 'Avancé', sous: 'Comprendre le détail' },
  { id: 'expert', titre: 'Expert', sous: 'Le car IP, les cas difficiles' },
]);
/** @typedef {'debutant' | 'intermediaire' | 'avance' | 'expert'} NiveauId */
/** moyenne des exercices demandée pour valider un niveau ; part de bonnes réponses au test de niveau */
export const SEUIL_MOYENNE = 70, SEUIL_TEST = 0.8;
/** questions d'un test de niveau : deux par leçon sautée, entre TEST_MIN et TEST_MAX */
export const TEST_MIN = 6, TEST_MAX = 12;

/**
 * Les leçons de chaque chapitre, niveau par niveau, dans l'ordre où on les fait. Un chapitre n'a que les
 * niveaux qu'il remplit (un petit chapitre s'arrête à Intermédiaire). Toute leçon y figure une fois
 * (test unitaire) ; c'est ici que le formateur change le niveau d'une leçon.
 * @type {Record<string, Partial<Record<NiveauId, string[]>>>}
 */
export const PARCOURS = {
  signal: {
    debutant: ['signal-formats', 'signal-bits', 'signal-422'],
    intermediaire: ['signal-niveaux'],
    avance: ['signal-couleur', 'signal-compression'],
  },
  sdi: {
    debutant: ['sdi-cest-quoi', 'sdi-cable'],
    intermediaire: ['sdi-grille', 'sdi-embedded'],
    avance: ['sdi-falaise', 'sdi-oeil'],
    expert: ['sdi-bits'],
  },
  synchro: {
    debutant: ['synchro-timecode'],
    intermediaire: ['synchro-genlock'],
  },
  camera: {
    debutant: ['camera-systeme'],
    intermediaire: ['camera-montage'],
    avance: ['camera-fibre'],
  },
  realisation: {
    debutant: ['real-melangeur', 'real-ordres'],
    intermediaire: ['real-incrustations'],
  },
  ralentis: {
    debutant: ['ralentis-evs'],
    intermediaire: ['ralentis-clips'],
  },
  son: {
    debutant: ['son-tranche'],
    intermediaire: ['son-n1'],
  },
  reseau: {
    debutant: ['reseau-modele', 'reseau-etendue', 'reseau-ethernet', 'reseau-switch', 'reseau-ip'],
    intermediaire: ['reseau-vlan', 'reseau-adresses', 'reseau-types', 'reseau-dhcp-dns', 'reseau-routage', 'reseau-tcp-udp'],
    avance: ['reseau-nat', 'reseau-streaming', 'reseau-multicast', 'reseau-mesures', 'reseau-qos', 'reseau-ptp'],
    expert: ['reseau-st2110', 'reseau-paquet', 'reseau-rythme', 'reseau-2022-7', 'reseau-spine-leaf', 'reseau-nmos'],
  },
  hf: {
    debutant: ['hf-frequences', 'hf-antennes'],
    intermediaire: ['hf-bilan'],
    avance: ['hf-cofdm'],
  },
  exploitation: {
    debutant: ['expl-intercom'],
    intermediaire: ['expl-lineup', 'expl-transmission', 'expl-depannage', 'expl-energie'],
    avance: ['expl-regie-mobile'],
    expert: ['expl-match'],
  },
};
export const niveauInfo = (/** @type {string} */ id) => NIVEAUX.find((n) => n.id === id) || NIVEAUX[0];

/** les niveaux d'un chapitre qui ont des leçons : [{ niveau, k (rang du niveau, 0 = Débutant), lecons }] */
export function niveauxDe(/** @type {string} */ chId) {
  const P = PARCOURS[chId] || {};
  const out = NIVEAUX.map((n, k) => ({ niveau: n, k, lecons: (P[n.id] || []).filter((id) => lessonById(id)) })).filter((x) => x.lecons.length);
  // une leçon écrite mais pas encore rangée : elle va au premier niveau (le test unitaire le signale)
  const ch = CHAPTERS.find((c) => c.id === chId);
  const ranges = new Set(out.flatMap((x) => x.lecons));
  const reste = ch ? ch.lessons.map((l) => l.id).filter((id) => !ranges.has(id)) : [];
  if (reste.length) { if (out.length && out[0].k === 0) out[0].lecons.push(...reste); else out.unshift({ niveau: NIVEAUX[0], k: 0, lecons: reste }); }
  return out;
}
/** le niveau d'une leçon dans son chapitre */
export function niveauDe(/** @type {string} */ id) {
  const f = lessonById(id); if (!f) return null;
  const n = niveauxDe(f.chapter.id).find((x) => x.lecons.includes(id));
  return n ? { chapter: f.chapter, ...n } : null;
}
/** les leçons d'un chapitre dans l'ordre du parcours */
export const ordreDe = (/** @type {string} */ chId) => niveauxDe(chId).flatMap((x) => x.lecons);
/** toutes les leçons dans l'ordre du parcours : chapitre par chapitre, niveau par niveau */
export const ordreParcours = () => CHAPTERS.flatMap((c) => ordreDe(c.id).map((id) => ({ chapter: c, lesson: /** @type {any} */ (lessonById(id)).lesson })));

// ---------------- l'état d'une leçon ----------------
/**
 * @param {string} id
 * @param {any} prog la progression (PROG.cours, PROG.niveaux)
 * @returns {{ quiz: boolean, exo: number | null, seul: boolean, etoiles: number, terminee: boolean, aExo: boolean }}
 *   quiz : réussi en entier ; exo : meilleur score sur 100 (null : jamais fait) ; étoiles : quiz réussi,
 *   exercice réussi, exercice à SEUIL_PARFAIT ou plus ; terminée : quiz et exercice réussis
 */
export function etatLecon(id, prog) {
  const c = ((prog || {}).cours || {})[id] || {};
  const quiz = !!(c.quiz && c.quiz.total && c.quiz.score === c.quiz.total);
  const aExo = !!exoOf(id);
  const exo = c.exo && Number.isFinite(c.exo.best) ? c.exo.best : null;
  // une leçon sans exercice (pas encore écrit) se termine par son quiz
  const exoOk = aExo ? exo != null && exo >= SEUIL_EXO : true;
  const etoiles = (quiz ? 1 : 0) + (aExo ? (exoOk ? 1 : 0) + (exo != null && exo >= SEUIL_PARFAIT ? 1 : 0) : quiz ? 2 : 0);
  return { quiz, exo, seul: !!(c.exo && c.exo.seul), etoiles, terminee: quiz && exoOk, aExo };
}

// ---------------- l'état d'un niveau ----------------
/** test de niveau réussi pour ouvrir le niveau de rang k du chapitre (PROG.niveaux[chapitre][niveau]) */
const testReussi = (prog, chId, niveauId) => { const t = (((prog || {}).niveaux || {})[chId] || {})[niveauId]; return !!(t && t.total && t.score / t.total >= SEUIL_TEST); };
/**
 * Un niveau du chapitre : ses leçons, combien sont terminées, la moyenne des exercices, les conditions
 * remplies (ok), validé par un test de niveau d'un niveau plus haut (parTest), ouvert ou non.
 * @param {string} chId @param {any} prog @param {{ libre?: boolean }} [o] libre : tout est ouvert (formateur)
 */
export function etatNiveaux(chId, prog, o = {}) {
  const list = niveauxDe(chId);
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const { niveau, k, lecons } = list[i];
    const etats = lecons.map((id) => etatLecon(id, prog));
    const terminees = etats.filter((e) => e.terminee).length;
    const scores = etats.filter((e) => e.aExo).map((e) => e.exo || 0);
    const moyenne = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 100;
    const etoiles = etats.reduce((s, e) => s + e.etoiles, 0);
    const ok = terminees === lecons.length && moyenne >= SEUIL_MOYENNE;
    // un test réussi pour un niveau plus haut valide celui-ci (on l'a sauté)
    const parTest = !ok && list.slice(i + 1).some((x) => testReussi(prog, chId, x.niveau.id));
    const ouvert = !!o.libre || i === 0 || out.every((x) => x.valide);
    out.push({ niveau, k, i, lecons, etats, terminees, moyenne, etoiles, max: lecons.length * 3, ok, parTest, valide: ok || parTest, ouvert });
  }
  return out;
}
/** la leçon est-elle ouverte (son niveau l'est) ? */
export function leconOuverte(/** @type {string} */ id, prog, o = {}) {
  if (o.libre) return true;
  const n = niveauDe(id); if (!n) return true;
  const e = etatNiveaux(n.chapter.id, prog, o).find((x) => x.niveau.id === n.niveau.id);
  return !e || e.ouvert;
}
/** le chapitre en bref : niveau atteint (le plus haut ouvert), leçons terminées, étoiles */
export function bilanChapitre(/** @type {string} */ chId, prog, o = {}) {
  const N = etatNiveaux(chId, prog, o);
  const ouverts = N.filter((x) => x.ouvert);
  const courant = ouverts.find((x) => !x.valide) || ouverts[ouverts.length - 1] || null;
  const lecons = N.reduce((s, x) => s + x.lecons.length, 0), terminees = N.reduce((s, x) => s + x.terminees, 0);
  return { niveaux: N, courant, lecons, terminees, etoiles: N.reduce((s, x) => s + x.etoiles, 0), max: lecons * 3, fini: N.length > 0 && N.every((x) => x.valide) };
}
/** ce qu'il reste à faire pour valider un niveau, en phrases courtes */
export function conditions(/** @type {ReturnType<typeof etatNiveaux>[number]} */ n) {
  return [
    { ok: n.terminees === n.lecons.length, texte: `Leçons terminées (quiz réussi et exercice réussi) : ${n.terminees} / ${n.lecons.length}` },
    { ok: n.moyenne >= SEUIL_MOYENNE, texte: `Moyenne des exercices : ${n.moyenne} / 100 (${SEUIL_MOYENNE} demandés)` },
  ];
}

/**
 * La suite conseillée : les fondamentaux d'abord. Parmi les niveaux ouverts, le plus bas de tous les
 * chapitres (tous les Débutant, puis les Intermédiaire…), dans l'ordre des chapitres ; dans ce niveau, la
 * première leçon non terminée, sinon l'exercice le plus faible si la moyenne manque.
 * @returns {{ id: string, raison: 'commencer' | 'quiz' | 'exercice' | 'ameliorer' } | null}
 */
export function suivante(prog, o = {}) {
  const cand = [];
  for (const ch of CHAPTERS) for (const n of etatNiveaux(ch.id, prog, o)) if (n.ouvert && !n.valide) cand.push({ ch, n });
  cand.sort((a, b) => a.n.k - b.n.k);
  for (const { n } of cand) {
    const k = n.etats.findIndex((e) => !e.terminee);
    if (k >= 0) { const e = n.etats[k]; return { id: n.lecons[k], raison: !e.quiz && e.exo == null ? 'commencer' : !e.quiz ? 'quiz' : 'exercice' }; }
    // tout est terminé mais la moyenne manque : l'exercice le plus faible, à refaire avec moins d'aide
    const faible = n.lecons.map((id, j) => ({ id, s: n.etats[j].exo ?? 100 })).sort((a, b) => a.s - b.s)[0];
    if (faible) return { id: faible.id, raison: 'ameliorer' };
  }
  return null;
}

// ---------------- le test de niveau ----------------
/** les leçons qu'un test pour ouvrir ce niveau couvre : celles des niveaux d'avant qui ne sont pas validés */
export function leconsDuTest(/** @type {string} */ chId, /** @type {string} */ niveauId, prog) {
  const N = etatNiveaux(chId, prog);
  const k = N.findIndex((x) => x.niveau.id === niveauId);
  return k <= 0 ? [] : N.slice(0, k).filter((x) => !x.valide).flatMap((x) => x.lecons);
}
/**
 * Tire les questions d'un test de niveau : deux par leçon couverte (une si elles sont nombreuses),
 * entre TEST_MIN et TEST_MAX, réponses mélangées.
 * @returns {{ lesson: string, i: number, order: number[] }[]}
 */
export function tirerTest(/** @type {string[]} */ lecons, rnd = Math.random) {
  const banks = lecons.map((id) => ({ id, quiz: /** @type {any} */ (lessonById(id)).lesson.quiz }));
  const total = Math.max(TEST_MIN, Math.min(TEST_MAX, 2 * lecons.length));
  const out = [];
  // tour à tour dans chaque leçon (mélangées), une question neuve à chaque passage
  const pools = shuffled(banks, rnd).map((b) => ({ id: b.id, quiz: b.quiz, rest: shuffled(b.quiz.map((_, i) => i), rnd) }));
  while (out.length < total && pools.some((p) => p.rest.length)) {
    for (const p of pools) { if (out.length >= total) break; const i = p.rest.shift(); if (i != null) out.push({ lesson: p.id, i, order: shuffled(p.quiz[i].choices.map((_, c) => c), rnd) }); }
  }
  return shuffled(out, rnd);
}
export const testPasse = (score, total) => total > 0 && score / total >= SEUIL_TEST;
/** questions à réussir pour un test de n questions */
export const aReussir = (n) => Math.ceil(n * SEUIL_TEST - 1e-9);
