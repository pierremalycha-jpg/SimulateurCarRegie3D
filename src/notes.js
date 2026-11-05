// @ts-check
// ----------------------------------------------------------------------------------
// Le carnet de notes (v19.30) : chaque essai d'une activité notée y laisse une ligne, avec sa note sur 20
// et le détail de ce qui a été répondu. Le quiz d'une leçon, son défi, son exercice en autonomie, un test de
// niveau, un défi du Labo, un quiz de la caméra en 3D, la mise en service, le quiz et l'examen du réseau,
// l'émission en direct, le jour de match, le montage de la caméra, un exercice pratique d'Olivier. Rangé dans la
// progression (PROG.notes, src/shared.js : addNote) ; le tableau de bord du professeur le lit et retrouve les
// questions dans le code de l'application (comptes/notes.js), d'où un détail compact :
//   q  les questions d'un QCM : [i, c, h] (question de la banque, choix fait, empreinte de la question telle qu'elle
//      était posée : si la banque change, la question n'est pas confondue avec une autre), [leçon, i, c, h] pour un
//      test de niveau qui mêle les leçons ;
//   g  la graine du tirage d'un exercice à valeurs tirées (on le retire à l'identique pour relire les énoncés), h
//      l'empreinte de ses énoncés ;
//   r  chaque question d'un exercice : [points sur 100, erreurs, aides, solution (1 ou 0), réponses essayées] ;
//   m  un résumé propre à l'activité (les pannes d'un examen, les erreurs d'un montage…).
// Calcul pur : ce module ne touche à aucune progression qu'on ne lui passe pas.
// ----------------------------------------------------------------------------------
/**
 * @typedef {'quiz' | 'defi' | 'exo' | 'test' | 'labo' | 'camquiz' | 'mes' | 'netquiz' | 'netexam' | 'emission' | 'match' | 'atelier' | 'pratique'} SorteNote
 */
/**
 * @typedef {object} Note un essai noté
 * @property {SorteNote} k la sorte d'activité
 * @property {string} id l'activité (une leçon, un défi, « chapitre/niveau » pour un test…)
 * @property {number} at quand (ms)
 * @property {number} s les points obtenus
 * @property {number} t les points possibles : la note sur 20 vaut 20 × s ÷ t
 * @property {number} [sec] la durée de l'essai, en secondes
 * @property {boolean} [seul] fait seul : sans solution demandée ni « Fais-le pour moi »
 * @property {any[]} [q] QCM : les questions posées et les choix faits
 * @property {number} [g] exercice : la graine du tirage
 * @property {string} [h] exercice : l'empreinte des énoncés tirés
 * @property {any[]} [r] exercice : le détail de chaque question
 * @property {any} [m] un résumé propre à l'activité
 */
/** au plus tant d'essais gardés (les plus anciens partent ; les meilleurs scores restent dans le reste de la progression) */
export const NOTES_MAX = 600;
/** une réponse écrite gardée : tant de caractères au plus, tant de réponses par question */
export const REPONSE_MAX = 40, REPONSES_MAX = 4;
export const SORTES = /** @type {SorteNote[]} */ (['quiz', 'defi', 'exo', 'test', 'labo', 'camquiz', 'mes', 'netquiz', 'netexam', 'emission', 'match', 'atelier', 'pratique']);

/** la note sur 20, au dixième */
export const note20 = (/** @type {number} */ s, /** @type {number} */ t) => (t > 0 ? Math.round((200 * Math.max(0, Math.min(s, t))) / t) / 10 : 0);
/** « 13,3 / 20 » */
export const noteTexte = (/** @type {number} */ n) => `${String(Math.round(n * 10) / 10).replace('.', ',')} / 20`;
/** la mention d'une note, pour la dire avec des mots */
export const mention = (/** @type {number} */ n) => (n >= 16 ? 'très bien' : n >= 14 ? 'bien' : n >= 12 ? 'assez bien' : n >= 10 ? 'passable' : 'à reprendre');

/** une empreinte courte d'un texte (FNV-1a sur 32 bits, en base 36) */
export function empreinte(/** @type {string} */ s) {
  let h = 0x811c9dc5;
  const t = String(s);
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
}
const texteChoix = (c) => (Array.isArray(c) ? c[0] : c);
/** l'empreinte d'une question de QCM : l'énoncé, les choix dans l'ordre de la banque et la bonne réponse */
export const empreinteQ = (/** @type {{ q: string, choices: any[], answer?: number, ok?: number }} */ Q) => empreinte(`${Q.q}|${(Q.choices || []).map(texteChoix).join('|')}|${Q.answer ?? Q.ok ?? ''}`);
/** l'empreinte des énoncés d'un exercice tiré */
export const empreinteItems = (/** @type {{ q: string }[]} */ items) => empreinte(items.map((it) => it.q).join('|'));

const fini = (x) => Number.isFinite(Number(x));
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
/** une ligne remise en forme, ou null si elle n'est pas exploitable */
export function normaliserNote(/** @type {any} */ n) {
  if (!isObj(n) || !SORTES.includes(n.k) || typeof n.id !== 'string' || !n.id || !fini(n.at) || !fini(n.s) || !(Number(n.t) > 0)) return null;
  /** @type {Note} */
  const o = { k: n.k, id: n.id.slice(0, 80), at: Number(n.at), s: Math.max(0, Number(n.s)), t: Number(n.t) };
  if (fini(n.sec) && n.sec >= 0) o.sec = Math.round(Number(n.sec));
  if (typeof n.seul === 'boolean') o.seul = n.seul;
  if (Array.isArray(n.q)) o.q = n.q.filter(Array.isArray).slice(0, 20);
  if (fini(n.g)) o.g = Number(n.g) >>> 0;
  if (typeof n.h === 'string') o.h = n.h.slice(0, 12);
  if (Array.isArray(n.r)) o.r = n.r.filter(Array.isArray).slice(0, 12);
  if (n.m != null) o.m = n.m;
  return o;
}
const cle = (/** @type {Note} */ n) => `${n.k}|${n.id}|${n.at}`;
/** le carnet remis en forme : lignes exploitables, sans doublon, dans l'ordre des dates, NOTES_MAX au plus */
export function normaliserNotes(/** @type {any} */ a) {
  if (!Array.isArray(a)) return [];
  const vu = new Set(); const out = [];
  for (const x of a) { const n = normaliserNote(x); if (!n || vu.has(cle(n))) continue; vu.add(cle(n)); out.push(n); }
  return out.sort((x, y) => x.at - y.at).slice(-NOTES_MAX);
}
/** les carnets de deux appareils réunis : rien ne se perd, rien n'est compté deux fois */
export const mergeNotes = (/** @type {any} */ a, /** @type {any} */ b) => normaliserNotes([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]);
/** ajoute un essai au carnet d'une progression (P.notes) ; renvoie la ligne gardée */
export function ajouterNote(/** @type {any} */ P, /** @type {any} */ n) {
  const o = normaliserNote({ at: Date.now(), ...n });
  if (!o) return null;
  const L = Array.isArray(P.notes) ? P.notes : (P.notes = []);
  L.push(o);
  if (L.length > NOTES_MAX) L.splice(0, L.length - NOTES_MAX);
  return o;
}
/** une réponse écrite, raccourcie pour le carnet */
export const reponseCourte = (/** @type {any} */ v) => (v == null ? '' : typeof v === 'string' ? v.trim().slice(0, REPONSE_MAX) : Array.isArray(v) ? v.join(',').slice(0, REPONSE_MAX) : String(v).slice(0, REPONSE_MAX));

/** une graine de tirage nouvelle (32 bits) */
export const nouvelleGraine = () => (Math.floor(Math.random() * 0x100000000) >>> 0);
