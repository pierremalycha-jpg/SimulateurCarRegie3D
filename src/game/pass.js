// @ts-check
import { PROG, saveProgressSoon } from '../shared.js';
import { emit } from '../state.js';
import { xpOf, levelOf, badgesWon, BADGES, game, NIVEAU_MAX } from './xp.js';
import { PAR_DEFAUT, objet, COSMETIQUES } from './cosmetiques.js';
import { serie } from './defis.js';
import { livret } from '../livret.js';

// ----------------------------------------------------------------------------------
// Le pass du technicien (v19.25) : comme un pass de saison, un palier par niveau (2 à 60), et chaque
// palier donne un objet pour son profil (avatar, bannière, cadre, titre : game/cosmetiques.js). Les
// paliers en 5 donnent les plus beaux (cadres, bannières rares). Une récompense se récupère d'un clic
// une fois le niveau atteint, puis s'équipe. Gratuit, sans achat : seule l'XP fait avancer.
// Le profil (PROG.profil) : pseudo, objets portés, vitrine de trois badges, visibilité au classement,
// récompenses récupérées (niveau → date). Il voyage avec la progression (compte, fichier).
// ----------------------------------------------------------------------------------
/** @typedef {import('./cosmetiques.js').TypeCosmetique} TypeCosmetique */
/** @typedef {{ niveau: number, type: TypeCosmetique, id: string }} Palier */

/** @type {Array<[number, TypeCosmetique, string]>} */
const TABLE = [
  [2, 'avatar', 'camera'], [2, 'titre', 'pousse-cable'], [3, 'banniere', 'pelouse'], [4, 'avatar', 'micro'], [5, 'cadre', 'bronze'],
  [6, 'avatar', 'clap'], [7, 'titre', 'oeil-de-lynx'], [8, 'avatar', 'ballon'], [9, 'banniere', 'mire'], [10, 'banniere', 'tally'],
  [11, 'avatar', 'melangeur'], [12, 'titre', 'roi-brassage'], [13, 'avatar', 'ralenti'], [14, 'banniere', 'vumetre'], [15, 'cadre', 'argent'],
  [16, 'avatar', 'hf'], [17, 'titre', 'oreille-or'], [18, 'avatar', 'car'], [19, 'banniere', 'forme-onde'], [20, 'banniere', 'projecteurs'],
  [21, 'avatar', 'drone'], [22, 'titre', 'as-ralenti'], [23, 'avatar', 'reseau'], [24, 'banniere', 'fibre'], [25, 'cadre', 'or'],
  [26, 'avatar', 'brassage'], [27, 'titre', 'voix-intercom'], [28, 'avatar', 'mire'], [29, 'banniere', 'crepuscule'], [30, 'banniere', 'bt2020'],
  [31, 'avatar', 'diaph'], [32, 'titre', 'chasseur-pannes'], [33, 'avatar', 'onde'], [34, 'banniere', 'grille'], [35, 'cadre', 'tally'],
  [36, 'avatar', 'casque-son'], [37, 'titre', 'maitre-genlock'], [38, 'avatar', 'synchro'], [39, 'banniere', 'zebra'], [40, 'banniere', 'plateau-or'],
  [41, 'avatar', 'intercom'], [42, 'titre', 'sorcier-lineup'], [43, 'avatar', 'satellite'], [44, 'banniere', 'sang-or'], [45, 'cadre', 'mire'],
  [46, 'avatar', 'planete'], [47, 'titre', 'main-sure'], [48, 'avatar', 'fusee'], [49, 'banniere', 'aurore'], [50, 'cadre', 'platine'],
  [51, 'avatar', 'diamant'], [52, 'titre', 'gardien-ptp'], [53, 'avatar', 'filante'], [54, 'banniere', 'black-burst'], [55, 'cadre', 'diamant'],
  [56, 'titre', 'architecte-reseau'], [57, 'titre', 'zero-noir'], [58, 'avatar', 'couronne'], [59, 'titre', 'pilier'], [60, 'banniere', 'legende'], [60, 'titre', 'legende'],
];
/** @type {Palier[]} */
export const PASS = TABLE.map(([niveau, type, id]) => ({ niveau, type, id }));
/** la rareté d'un palier (couleur de la case du pass) */
export const rarete = (n) => (n >= 50 ? 'legendaire' : n >= 35 ? 'epique' : n >= 15 || n % 5 === 0 ? 'rare' : 'commun');
export const NOM_RARETE = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire' };
export const paliersDu = (n) => PASS.filter((p) => p.niveau === n);

// ---------------- le profil ----------------
/** @typedef {{ pseudo: string, avatar: string, banniere: string, cadre: string, titre: string, vitrine: string[], visible: boolean, recus: Record<string, number>, at: number }} Profil */
/** le profil (créé à la première lecture) @param {any} [P] @returns {Profil} */
export function profil(P = PROG) {
  const X = /** @type {any} */ (P);
  if (!X.profil || typeof X.profil !== 'object') X.profil = {};
  const p = X.profil;
  for (const k of /** @type {Array<keyof typeof PAR_DEFAUT>} */ (Object.keys(PAR_DEFAUT))) if (typeof p[k] !== 'string' || !p[k]) p[k] = PAR_DEFAUT[k];
  if (typeof p.pseudo !== 'string') p.pseudo = '';
  if (typeof p.visible !== 'boolean') p.visible = true;
  if (!Array.isArray(p.vitrine)) p.vitrine = [];
  if (!p.recus || typeof p.recus !== 'object') p.recus = {};
  p.at = Number(p.at) || 0;
  return p;
}
/** un pseudo propre : 3 à 20 caractères (lettres, chiffres, espace, - _ .), sans espaces en trop */
export function pseudoPropre(s) {
  const t = String(s || '').normalize('NFC').replace(/[^\p{L}\p{N} ._-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return t.length >= 3 ? t : '';
}

/** le niveau atteint @param {any} [P] */
export const niveauDe = (P = PROG) => levelOf(xpOf(P)).n;
/** un objet est-il gagné (par défaut, ou palier atteint) ? */
export function debloque(type, id, P = PROG) {
  if (PAR_DEFAUT[type] === id) return true;
  const pal = PASS.find((p) => p.type === type && p.id === id);
  return !!pal && pal.niveau <= niveauDe(P);
}
/** le niveau qui donne un objet (0 : par défaut) */
export const niveauObjet = (type, id) => { const pal = PASS.find((p) => p.type === type && p.id === id); return pal ? pal.niveau : 0; };
/** les paliers atteints mais pas encore récupérés */
export function aRecuperer(P = PROG) { const n = niveauDe(P), r = profil(P).recus; return [...new Set(PASS.filter((p) => p.niveau <= n && !r[p.niveau]).map((p) => p.niveau))]; }
/** récupère un palier (ou tous ceux qui attendent) ; renvoie les objets reçus */
export function recuperer(niveau = 0, P = PROG) {
  const p = profil(P), n = niveauDe(P);
  const lv = niveau ? [niveau] : aRecuperer(P);
  /** @type {Palier[]} */ const recus = [];
  for (const x of lv) { if (x > n || p.recus[x]) continue; p.recus[x] = Date.now(); recus.push(...paliersDu(x)); }
  if (recus.length && P === PROG) { p.at = Date.now(); saveProgressSoon(); emit('pass', { type: 'recu', recus }); }
  return recus;
}
/** porte un objet gagné ; refuse un objet verrouillé */
export function equiper(type, id, P = PROG) {
  if (!(type in PAR_DEFAUT) || !objet(type, id) || !debloque(type, id, P)) return false;
  const p = profil(P); /** @type {any} */ (p)[type] = id; p.at = Date.now();
  if (P === PROG) { saveProgressSoon(); emit('pass', { type: 'equipe', quoi: type, id }); }
  return true;
}
/** change le pseudo, la visibilité, la vitrine (champs donnés seulement) */
export function regler(o, P = PROG) {
  const p = profil(P);
  if ('pseudo' in o) p.pseudo = pseudoPropre(o.pseudo) || p.pseudo;
  if ('visible' in o) p.visible = !!o.visible;
  if ('vitrine' in o) { const won = new Set(badgesWon(P).map((b) => b.id)); p.vitrine = [...new Set((o.vitrine || []).filter((id) => won.has(id)))].slice(0, 3); }
  p.at = Date.now();
  if (P === PROG) { saveProgressSoon(); emit('pass', { type: 'profil' }); }
  return p;
}
/** fusion de deux profils (shared.js) : les récompenses récupérées des deux côtés, les réglages les plus récents */
export function mergeProfil(mine, theirs) {
  if (!theirs || typeof theirs !== 'object') return mine;
  const a = profil({ profil: mine }), b = profil({ profil: { ...theirs } });
  const recent = b.at > a.at ? b : a;
  return { ...recent, recus: { ...b.recus, ...a.recus } };
}

// ---------------- le profil public (classement, profil vu par les autres) ----------------
/**
 * Ce que les autres joueurs voient (document profils/<uid> du compte en ligne) : pas d'adresse, pas
 * de détail des réponses ; le pseudo, l'apparence, le niveau, les badges et quelques chiffres.
 * @param {any} [P]
 */
export function profilPublic(P = PROG) {
  const p = profil(P), xp = xpOf(P), L = levelOf(xp), g = game(P);
  const lecons = Object.values(P.cours || {}).filter((c) => c && c.quiz && c.quiz.total && c.quiz.score === c.quiz.total).length;
  const exercices = Object.values(P.tutor || {}).filter((t) => t && t.done).length;
  let competences = 0; try { const Lv = livret(P); competences = Lv.count.travaillee + Lv.count.consolidee; } catch (e) { /* livret incomplet */ }
  const badges = BADGES.filter((b) => g.badges[b.id]).map((b) => b.id);
  const sr = serie(g.jours);
  return {
    pseudo: p.pseudo || 'Technicien anonyme', avatar: p.avatar, banniere: p.banniere, cadre: p.cadre,
    titre: p.titre === 'grade' ? L.title : (objet('titre', p.titre) || { nom: L.title }).nom,
    niveau: L.n, grade: L.title, xp, vitrine: p.vitrine.filter((id) => badges.includes(id)).slice(0, 3),
    badges, nbBadges: badges.length, lecons, exercices, competences, serie: sr.n, meilleureSerie: sr.best, maj: Date.now(),
  };
}
/**
 * Le profil public d'un compte de l'établissement (comptes/profils.js, document profils/<uid>) : celui de
 * profilPublic, avec le pseudo par défaut (prénom et initiale du nom), le rôle et la classe du compte.
 * @param {any} P @param {{ role?: string, prenom?: string, nom?: string, classe?: string | null, classeNom?: string }} c
 */
export function profilPourCompte(P, c) {
  const pub = profilPublic(P), p = profil(P);
  const defaut = [String(c.prenom || '').trim(), c.nom ? String(c.nom).trim().charAt(0).toUpperCase() + '.' : ''].filter(Boolean).join(' ');
  return { ...pub, pseudo: p.pseudo || pseudoPropre(defaut) || 'Technicien anonyme', role: c.role === 'prof' ? 'prof' : 'eleve', classe: c.classe || null, classeNom: String(c.classeNom || '').slice(0, 60) };
}
/** le texte du titre porté @param {any} [P] */
export function titrePorte(P = PROG) { const p = profil(P); return p.titre === 'grade' ? levelOf(xpOf(P)).title : objet('titre', p.titre).nom; }
export { NIVEAU_MAX, COSMETIQUES };
