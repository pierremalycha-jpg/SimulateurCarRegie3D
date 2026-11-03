// @ts-check
import { verifier as verifierExo, scoreExo, seul, etatVide, tirage as tirageExo } from '../cours/exo.js';
import { noterEssai, SEUIL_DEFI } from './suivi.js';

// ----------------------------------------------------------------------------------
// Les défis notés du Labo. Un défi est un petit problème posé dans un atelier, avec des valeurs
// tirées à chaque essai, en trois questions posées une à une. Les questions sont celles de
// l'exercice en autonomie du Cours (cours/exo.js : un nombre, un choix, un texte, un ordre), plus
// une sorte propre au Labo : le réglage (« reglage »), où l'on agit sur l'atelier puis on fait
// vérifier ; c'est le modèle de l'atelier (labo/calc/) qui juge. Les mêmes règles de points : deux
// aides qui coûtent, une erreur qui coûte, la solution qui ne rapporte rien (pour un réglage, elle
// règle l'atelier à la place de l'élève). Réussi à SEUIL_DEFI (60 sur 100) ; réussi seul s'il n'a
// demandé aucune solution : c'est ce que comptent le livret, l'XP et le tableau de bord.
// Les défis sont écrits atelier par atelier dans labo/defis/ et rangés ici (registerDefis).
// ----------------------------------------------------------------------------------
export { SEUIL_DEFI };
/**
 * @typedef {object} ReglageItem une question « réglage » : agir sur l'atelier, puis vérifier
 * @property {'reglage'} type
 * @property {string} q l'énoncé
 * @property {Record<string, any>} [fixe] des réglages imposés (posés au début de la question, leurs commandes verrouillées)
 * @property {(st: any, m: any) => { ok: boolean, mesure?: string, why?: string }} check juge le réglage (st : l'état de l'atelier, m : ses mesures)
 * @property {Record<string, any>} [corrige] un réglage juste, posé quand l'élève demande la solution
 * @property {[string, string]} aides
 * @property {string} solution
 */
/** @typedef {import('../cours/exo.js').ExoItem | ReglageItem} ItemDefi */
/**
 * @typedef {object} DefiGen
 * @property {(rnd: () => number) => { scene?: Record<string, any>, items: ItemDefi[] }} gen la scène de l'essai (posée dans l'atelier) et ses questions
 * @property {string} consigne la situation, une ou deux phrases
 */
/** @type {Record<string, DefiGen>} */
export const DEFIS = {};
export function registerDefis(/** @type {Record<string, DefiGen>} */ list) { Object.assign(DEFIS, list); }

/** un essai : la scène, les questions tirées, l'ordre d'affichage des choix */
export function tirageDefi(/** @type {string} */ id, rnd = Math.random) {
  const D = DEFIS[id]; if (!D) return null;
  const { scene, items } = D.gen(rnd);
  const t = tirageExo({ titre: '', consigne: '', gen: () => /** @type {any} */ (items) }, rnd);
  return { scene: scene || {}, items, vues: t.vues };
}
/**
 * Vérifie une réponse. Pour un réglage, ctx porte l'état de l'atelier et ses mesures.
 * @returns {{ ok: boolean, vide?: boolean, why?: string, mesure?: string }}
 */
export function verifierItem(/** @type {ItemDefi} */ it, valeur, ctx = { st: {}, m: {} }) {
  if (it.type === 'reglage') {
    const r = it.check(ctx.st, ctx.m) || { ok: false };
    return { ok: !!r.ok, why: r.why || '', mesure: r.mesure || '' };
  }
  return verifierExo(/** @type {any} */ (it), valeur);
}
/** le score d'un essai, sur 100 (une erreur sur un réglage coûte comme une erreur de calcul) */
export const scoreDefi = (/** @type {ItemDefi[]} */ items, etats) => scoreExo(/** @type {any} */ (items.map((it) => (it.type === 'reglage' ? { ...it, type: 'nombre' } : it))), etats);
export { seul, etatVide };
/**
 * Enregistre un essai terminé dans la progression P (P.labo) ; rend ce qu'il faut annoncer.
 * @returns {{ score: number, seul: boolean, reussi: boolean, premier: boolean }}
 */
export function noterDefi(P, /** @type {string} */ id, /** @type {ItemDefi[]} */ items, etats, at = Date.now()) {
  const score = scoreDefi(items, etats), s = seul(etats);
  const r = noterEssai(P.labo, id, score, s, at);
  P.labo = r.L;
  return { score, seul: s, reussi: score >= SEUIL_DEFI, premier: r.premier };
}
