// @ts-check
import { DOMAINE_ELEVES } from './config.js';

// ----------------------------------------------------------------------------------
// Identifiants et mots de passe des élèves (calcul pur, sans Firebase) : l'identifiant se tire du
// prénom et du nom (« Léa Martin » → « lea.martin », sans accent ni espace), l'adresse de connexion
// s'en déduit, le mot de passe provisoire est tiré au hasard (syllabes faciles à lire et à taper,
// deux chiffres : pas de lettre ambiguë comme l, I, O ou 0).
// ----------------------------------------------------------------------------------
export const MDP_MIN = 6; // minimum de Firebase Authentication
export const IDENT_MAX = 40;

/** une partie de nom sans accent, en minuscules, lettres et chiffres seulement (tirets gardés) */
export function nettoyer(/** @type {string} */ s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[œ]/g, 'oe').replace(/[æ]/g, 'ae').replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
/** l'identifiant d'un élève : « prenom.nom » (« lea.martin »), « prenom.nom2 » pour un homonyme (n = 2, 3…) */
export function identifiantDe(/** @type {string} */ prenom, /** @type {string} */ nom, n = 1) {
  const base = [nettoyer(prenom), nettoyer(nom)].filter(Boolean).join('.') || 'eleve';
  const suff = n > 1 ? String(n) : '';
  return base.slice(0, IDENT_MAX - suff.length).replace(/[.-]$/, '') + suff;
}
/** un identifiant tapé est-il de la bonne forme ? (minuscules, chiffres, point et tiret, 2 à 40 caractères) */
export const identifiantValide = (/** @type {string} */ s) => /^[a-z0-9](?:[a-z0-9.-]{0,38}[a-z0-9])?$/.test(String(s || '')) && !/\.\.|--/.test(s);
/** ce que tape la personne au champ « Identifiant » : une adresse (professeur) ou un identifiant d'élève */
export function adresseDe(/** @type {string} */ saisie) {
  const s = String(saisie || '').trim().toLowerCase();
  return s.includes('@') ? s : `${s}@${DOMAINE_ELEVES}`;
}
/** l'identifiant d'un élève à partir de l'adresse de son compte (null : ce n'est pas un compte d'élève) */
export function identifiantDeAdresse(/** @type {string} */ email) {
  const m = String(email || '').toLowerCase().match(/^(.+)@(.+)$/);
  return m && m[2] === DOMAINE_ELEVES ? m[1] : null;
}

const CONS = 'bcdfgjkmnprstvz', VOY = 'aeiou';
/** entier au hasard dans [0, n) : générateur du navigateur (crypto), sinon celui donné (tests) */
function hasard(n, rnd) {
  if (rnd) return Math.floor(rnd() * n);
  const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return a[0] % n;
}
/**
 * Un mot de passe provisoire : trois syllabes et deux chiffres (« kavito47 » : 8 caractères, environ
 * 15⁴ × 5³ × 100 ≈ 6 × 10⁸ possibilités ; Firebase limite en plus les essais répétés).
 * @param {() => number} [rnd] générateur pour les tests ; par défaut, crypto.getRandomValues
 */
export function motDePasse(rnd) {
  let s = '';
  for (let i = 0; i < 3; i++) s += CONS[hasard(CONS.length, rnd)] + VOY[hasard(VOY.length, rnd)];
  s += CONS[hasard(CONS.length, rnd)];
  return s + String(hasard(90, rnd) + 10);
}
/** un mot de passe choisi par le professeur est-il acceptable ? (message d'erreur, ou '') */
export function motDePasseRefuse(/** @type {string} */ m) {
  if (typeof m !== 'string' || m.length < MDP_MIN) return `Au moins ${MDP_MIN} caractères.`;
  if (m.length > 64) return '64 caractères au plus.';
  if (/\s/.test(m)) return 'Pas d\'espace.';
  return '';
}

/**
 * Lit une liste d'élèves collée (une ligne par élève : « Prénom Nom », « Nom ; Prénom », « NOM Prénom »,
 * ou deux colonnes d'un tableur). Le nom écrit tout en capitales est reconnu comme nom de famille.
 * @returns {{ prenom: string, nom: string }[]}
 */
export function lireListe(/** @type {string} */ texte) {
  const out = [];
  for (const brut of String(texte || '').split(/\r?\n/)) {
    const l = brut.trim(); if (!l) continue;
    let prenom, nom;
    const cols = l.split(/\s*[;\t,]\s*/).filter(Boolean);
    if (cols.length >= 2) { nom = cols[0]; prenom = cols[1]; } else {
      const mots = l.split(/\s+/);
      // « MARTIN Léa » : les mots tout en capitales forment le nom
      const caps = mots.filter((m) => m.length > 1 && m === m.toUpperCase() && /\p{L}/u.test(m));
      if (caps.length && caps.length < mots.length) { nom = caps.join(' '); prenom = mots.filter((m) => !caps.includes(m)).join(' '); } else { prenom = mots[0]; nom = mots.slice(1).join(' '); }
    }
    const propre = (s) => s.replace(/\s+/g, ' ').trim().slice(0, 40);
    if (propre(prenom) || propre(nom)) out.push({ prenom: propre(prenom), nom: propre(nom) });
  }
  return out.slice(0, 60);
}
/** « Léa Martin », « MARTIN » → « Léa Martin » (nom de famille avec sa majuscule) */
export const nomComplet = (/** @type {{ prenom?: string, nom?: string }} */ c) => [c.prenom, c.nom ? c.nom.charAt(0).toUpperCase() + c.nom.slice(1).toLowerCase().replace(/([ -])(\p{L})/gu, (_, a, b) => a + b.toUpperCase()) : ''].filter(Boolean).join(' ');
