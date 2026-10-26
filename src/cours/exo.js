// @ts-check
import { shuffled } from '../util.js';

// ----------------------------------------------------------------------------------
// L'exercice en autonomie d'une leçon (v19.18) : après le quiz, on résout seul un petit problème
// du car, avec des valeurs tirées à chaque essai (refaire, c'est refaire avec d'autres chiffres).
// Un exercice est fait de trois à cinq questions, posées une à une : un nombre à calculer, un choix
// à faire dans une situation, une réponse à écrire (une adresse, un mot), des étapes à remettre
// dans l'ordre. Chaque question a deux aides graduées (un indice, puis la méthode) qui coûtent des
// points, et sa solution, qu'on peut demander (la question ne rapporte alors rien) ; une réponse
// fausse coûte aussi des points, et une erreur prévue (piège) est expliquée. Le score est sur 100 ;
// l'exercice est réussi à SEUIL_EXO. Calcul pur, sans interface : ui/cours_exo.js l'affiche, les
// exercices sont écrits chapitre par chapitre dans cours/exos/ et rangés par leçon (registerExos).
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} ExoItem une question de l'exercice
 * @property {'nombre' | 'choix' | 'texte' | 'ordre'} type
 * @property {string} q l'énoncé (texte riche : **gras**, `code`, listes « - »)
 * @property {number} [answer] nombre : la valeur juste ; choix : l'indice du bon choix
 * @property {number} [tol] nombre : écart accepté (absolu) ; par défaut, exact pour un entier, 0,5 % de la valeur sinon
 * @property {string} [unite] nombre : l'unité attendue, affichée à côté de la case (« Gb/s »)
 * @property {boolean} [brut] nombre : écrit sans espace des milliers dans le corrigé (un numéro de port, un code)
 * @property {Array<string | [string, string]>} [choices] choix : trois choix au moins, un choix faux peut porter son explication [texte, pourquoi]
 * @property {string | string[]} [accept] texte : la ou les réponses acceptées
 * @property {'ip' | 'mot'} [forme] texte : comparaison sans espaces ni casse (ip), ou sans accents ni casse (mot, par défaut)
 * @property {string} [placeholder] texte : exemple de forme attendue (« 192.168.1.0 »)
 * @property {string[]} [items] ordre : les étapes, dans le bon ordre (affichées mélangées)
 * @property {Array<{ v: number | string, why: string }>} [pieges] nombre ou texte : une erreur prévue et son explication
 * @property {[string, string]} aides deux aides graduées : un indice, puis la méthode (sans donner le résultat)
 * @property {string} solution la réponse expliquée, affichée quand la question est résolue ou à la demande
 */
/**
 * @typedef {object} Exo
 * @property {string} titre ce qu'on fait, en quelques mots
 * @property {string} consigne la situation, une ou deux phrases (dans le car, au poste…)
 * @property {(rnd: () => number) => ExoItem[]} gen les questions d'un essai, valeurs tirées avec rnd
 */
/** @typedef {{ ok: boolean, erreurs: number, aides: number, solution: boolean }} EtatItem où en est une question */

/** réussi à partir de… (sur 100) ; trois étoiles à partir de… */
export const SEUIL_EXO = 60, SEUIL_PARFAIT = 90;
/** ce que coûte une aide, une erreur (une erreur sur un choix coûte plus : il y a peu de choix) */
export const COUT = { aide: 0.25, erreur: 0.25, erreurChoix: 0.5 };

/** les exercices, par leçon */
/** @type {Record<string, Exo>} */
export const EXOS = {};
/** range les exercices d'un chapitre (cours/exos/<chapitre>.js) */
export function registerExos(/** @type {Record<string, Exo>} */ list) { Object.assign(EXOS, list); }
export const exoOf = (/** @type {string} */ id) => EXOS[id] || null;

// ---------------- tirages ----------------
/** un entier de a à b compris */
export const entre = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1));
/** un élément au hasard */
export const pick = (rnd, arr) => arr[Math.floor(rnd() * arr.length)];
/** n éléments différents au hasard, dans l'ordre du tirage */
export const tirer = (rnd, arr, n) => shuffled(arr, rnd).slice(0, n);
/** « de » devant un nom : du RCP, des caméras, d'un panneau, de la CCU */
export const de = (/** @type {string} */ nom) => (nom.startsWith('le ') ? 'du ' + nom.slice(3) : nom.startsWith('les ') ? 'des ' + nom.slice(4) : /^[aeiouyéèêàâîôû]/i.test(nom) ? 'd\'' + nom : 'de ' + nom);
/** un nombre écrit à la française (virgule, espaces fines des milliers) */
export const fr = (v, d = 0) => Number(v).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/\u202f/g, '\u00a0');

// ---------------- vérifier une réponse ----------------
const sans = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '\'').replace(/\s+/g, ' ').trim();
const norme = (s, forme) => (forme === 'ip' ? String(s).replace(/\s/g, '').toLowerCase() : sans(s));
/** lit un nombre écrit à la française ou à l'anglaise (« 2,07 », « 1 485 », « 2.97 Gb/s ») ; NaN si ce n'en est pas un */
export function lireNombre(s) {
  const t = String(s).replace(/\s/g, '').replace(',', '.');
  const m = /^[-+−]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i.exec(t.replace('−', '-'));
  return m ? Number(m[0].replace('−', '-')) : NaN;
}
/** écart accepté pour une question « nombre » */
export const tolerance = (/** @type {ExoItem} */ it) => it.tol ?? (Number.isInteger(it.answer) ? 1e-9 : Math.max(1e-9, Math.abs(it.answer ?? 0) * 0.005));
/**
 * Vérifie une réponse. valeur : le texte tapé (nombre, texte), l'indice du choix (choix), l'ordre
 * proposé, en indices des étapes justes (ordre).
 * @returns {{ ok: boolean, vide?: boolean, why?: string }} vide : rien d'exploitable (ce n'est pas compté comme une erreur)
 */
export function verifier(/** @type {ExoItem} */ it, valeur) {
  if (it.type === 'nombre') {
    const v = lireNombre(valeur);
    if (!Number.isFinite(v)) return { ok: false, vide: true };
    if (Math.abs(v - Number(it.answer)) <= tolerance(it)) return { ok: true };
    const p = (it.pieges || []).find((x) => typeof x.v === 'number' && Math.abs(v - x.v) <= tolerance(it));
    return { ok: false, why: p ? p.why : '' };
  }
  if (it.type === 'texte') {
    if (!String(valeur ?? '').trim()) return { ok: false, vide: true };
    const v = norme(valeur, it.forme);
    if ([].concat(it.accept || []).some((a) => norme(a, it.forme) === v)) return { ok: true };
    const p = (it.pieges || []).find((x) => norme(x.v, it.forme) === v);
    return { ok: false, why: p ? p.why : '' };
  }
  if (it.type === 'choix') {
    if (valeur == null || valeur === '') return { ok: false, vide: true };
    const k = Number(valeur);
    if (k === it.answer) return { ok: true };
    const c = (it.choices || [])[k];
    return { ok: false, why: Array.isArray(c) ? c[1] : '' };
  }
  if (it.type === 'ordre') {
    const a = /** @type {number[]} */ (valeur || []);
    const n = (it.items || []).length;
    if (a.length !== n) return { ok: false, vide: true };
    const ok = a.every((x, k) => x === k);
    // la première étape mal placée, pour l'explication
    const k = a.findIndex((x, i) => x !== i);
    return ok ? { ok: true } : { ok: false, why: k >= 0 ? `L'étape ${k + 1} n'est pas à sa place.` : '' };
  }
  return { ok: false, vide: true };
}
/** la réponse juste, écrite (pour le corrigé) */
export function reponse(/** @type {ExoItem} */ it) {
  if (it.type === 'nombre') return `${it.brut ? String(it.answer) : fr(Number(it.answer), decimales(Number(it.answer)))}${it.unite ? ' ' + it.unite : ''}`;
  if (it.type === 'texte') return [].concat(it.accept || [])[0] || '';
  if (it.type === 'choix') { const c = (it.choices || [])[it.answer ?? 0]; return Array.isArray(c) ? c[0] : String(c); }
  if (it.type === 'ordre') return (it.items || []).map((s, k) => `${k + 1}. ${s}`).join(' ; ');
  return '';
}
const decimales = (v) => { if (Number.isInteger(v)) return 0; const s = String(Math.abs(v)); const d = (s.split('.')[1] || '').length; return Math.min(3, d); };

// ---------------- les points ----------------
/** les points d'une question, de 0 à 1 : une solution demandée ne rapporte rien ; chaque aide et chaque erreur coûtent */
export function pointsItem(/** @type {ExoItem} */ it, /** @type {EtatItem} */ st) {
  if (!st || !st.ok || st.solution) return 0;
  const err = it.type === 'choix' ? COUT.erreurChoix : COUT.erreur;
  return Math.max(0, 1 - st.aides * COUT.aide - st.erreurs * err);
}
/** le score d'un essai, sur 100 */
export function scoreExo(/** @type {ExoItem[]} */ items, /** @type {EtatItem[]} */ etats) {
  if (!items.length) return 0;
  return Math.round(100 * items.reduce((s, it, k) => s + pointsItem(it, etats[k]), 0) / items.length);
}
/** un essai fait seul : aucune solution demandée (les aides sont permises, elles coûtent déjà des points) */
export const seul = (/** @type {EtatItem[]} */ etats) => etats.every((e) => !e.solution);
export const etatVide = () => /** @type {EtatItem} */ ({ ok: false, erreurs: 0, aides: 0, solution: false });

/** un essai : les questions tirées et, pour un choix ou un ordre, l'ordre d'affichage mélangé */
export function tirage(/** @type {Exo} */ exo, rnd = Math.random) {
  const items = exo.gen(rnd);
  const vues = items.map((it) => (it.type === 'choix' ? shuffled((it.choices || []).map((_, k) => k), rnd) : it.type === 'ordre' ? melangeOrdre((it.items || []).length, rnd) : null));
  return { items, vues };
}
/** un ordre mélangé qui n'est pas déjà le bon */
function melangeOrdre(n, rnd) {
  const id = [...Array(n).keys()];
  for (let k = 0; k < 8; k++) { const s = shuffled(id, rnd); if (s.some((x, i) => x !== i)) return s; }
  return id.slice().reverse();
}
