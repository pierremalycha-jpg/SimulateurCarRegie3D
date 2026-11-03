// @ts-check
import { on, emit } from '../state.js';
import { NUAGE, PROG, SAVE, mergeProgress, remplacerProgression, saveProgressNow, saveProgressSoon } from '../shared.js';
import { configFirebase } from './config.js';
import { clientFirebase, erreur } from './firebase.js';
import { profil, profilPublic, regler, pseudoPropre } from '../game/pass.js';

// ----------------------------------------------------------------------------------
// Le compte en ligne (v19.25) : retrouver sa progression sur n'importe quel ordinateur. Firebase
// (Authentication par adresse et mot de passe, Cloud Firestore) :
//   progress/<uid> : la progression entière (champ data, en JSON), lisible et modifiable par soi seul ;
//   profils/<uid>  : le profil public (pseudo, apparence, niveau, badges), lisible par les joueurs
//                    connectés, pour le classement ; effacé quand on se retire du classement.
// La session (jeton de renouvellement) est gardée dans ce navigateur : on reste connecté d'une partie
// à l'autre. À la connexion, la progression du compte et celle de l'ordinateur se fusionnent (rien ne
// se perd), sauf si celle de l'ordinateur appartient à un autre compte : elle est alors remplacée. À la
// déconnexion, la progression est enregistrée puis retirée de l'ordinateur (poste partagé en classe).
// ----------------------------------------------------------------------------------
/** @typedef {import('./firebase.js').Session} Session */
export const COMPTE = {
  /** 'indisponible' (pas de projet Firebase), 'deconnecte', 'connexion' (en cours), 'connecte' */
  etat: /** @type {'indisponible' | 'deconnecte' | 'connexion' | 'connecte'} */ ('indisponible'),
  uid: '', email: '', erreur: '',
  /** dernière publication du profil public */
  publie: 0,
};
/** @type {Session | null} */ let SESSION = null;
/** @type {ReturnType<typeof clientFirebase> | null} */ let FB = null;
const CLE = 'carregie.compte', PROPRIO = 'carregie.progress.owner';
const lireLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
const ecrireLS = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } };

// avant la reprise de la session (initCompte, lancé après le chargement du stade) : ce qu'on sait déjà
COMPTE.etat = !configFirebase() ? 'indisponible' : (lireLS(CLE) || {}).refreshToken ? 'connexion' : 'deconnecte';
/** le compte en ligne est-il possible ici (projet Firebase configuré) ? */
export const compteDisponible = () => !!configFirebase();
export const connecte = () => COMPTE.etat === 'connecte' && !!SESSION;

function client() {
  const cfg = configFirebase();
  if (!cfg) { FB = null; return null; }
  FB = clientFirebase(cfg);
  return FB;
}
function changer(etat, err = '') { COMPTE.etat = etat; COMPTE.erreur = err; emit('compte', COMPTE); }

/** au démarrage (après initShared) : reprend la session gardée, sans rien demander */
export async function initCompte() {
  if (!client()) { changer('indisponible'); return; }
  if (connecte()) return; // déjà connecté pendant le chargement
  const s = lireLS(CLE);
  if (!s || !s.refreshToken || !s.uid) { changer('deconnecte'); return; }
  SESSION = { uid: s.uid, email: s.email || '', refreshToken: s.refreshToken, idToken: '', exp: 0 };
  COMPTE.uid = s.uid; COMPTE.email = s.email || '';
  changer('connexion');
  try { await brancher(SESSION); }
  catch (e) {
    // hors ligne : on reste connecté (la session est gardée), l'enregistrement en ligne reprendra plus tard
    if (e.code === 'RESEAU') { brancherHorsLigne(SESSION); return; }
    SESSION = null; ecrireLS(CLE, null); changer('deconnecte', e.message);
  }
}

/** la progression du compte (document progress/<uid>) */
async function lireProgression(s) {
  if (!FB) return null;
  const d = await FB.lire(s, 'progress/' + s.uid);
  if (!d || typeof d.data !== 'string') return null;
  try { return JSON.parse(d.data); } catch (e) { return null; }
}
async function ecrireProgression(s, P) {
  if (!FB) return;
  await FB.ecrire(s, 'progress/' + s.uid, { data: JSON.stringify(P), v: Number(P.v) || 1, maj: Date.now() });
  publierBientot();
}
function poserNuage(s) {
  NUAGE.uid = s.uid;
  NUAGE.lire = () => lireProgression(s);
  NUAGE.ecrire = (d) => ecrireProgression(s, d);
  NUAGE.actif = true;
}
/** relie la progression de cet ordinateur au compte, puis enregistre */
async function brancher(s) {
  if (!FB) throw erreur('INDISPONIBLE');
  await FB.jeton(s);
  const distante = await lireProgression(s);
  const proprio = lireLS(PROPRIO);
  // la progression de cet ordinateur est celle d'un autre compte : on ne la mélange pas
  if (proprio && proprio !== s.uid) remplacerProgression(distante || {});
  else if (distante) { mergeProgress(distante); remplacerProgression(JSON.parse(JSON.stringify(PROG))); }
  ecrireLS(PROPRIO, s.uid);
  ecrireLS(CLE, { uid: s.uid, email: s.email, refreshToken: s.refreshToken });
  COMPTE.uid = s.uid; COMPTE.email = s.email;
  poserNuage(s);
  changer('connecte');
  await saveProgressNow();
  emit('shared');
}
function brancherHorsLigne(s) {
  poserNuage(s); ecrireLS(PROPRIO, s.uid);
  changer('connecte', 'Hors ligne : la progression s\'enregistre sur cet ordinateur et rejoindra le compte au retour d\'Internet.');
  SAVE.remote = false;
}

/** crée un compte, puis s'y connecte @returns {Promise<{ ok: boolean, error?: string }>} */
export async function creerCompte(email, mdp, pseudo) {
  if (!client() || !FB) return { ok: false, error: 'Le compte en ligne n\'est pas configuré sur ce simulateur.' };
  const ps = pseudoPropre(pseudo);
  if (!ps) return { ok: false, error: 'Choisissez un pseudo de 3 à 20 caractères (lettres, chiffres, espace, tiret).' };
  changer('connexion');
  try {
    const s = await FB.inscrire(String(email).trim(), mdp);
    SESSION = s;
    await brancher(s);
    regler({ pseudo: ps });
    await saveProgressNow();
    return { ok: true };
  } catch (e) { SESSION = null; changer('deconnecte', e.message); return { ok: false, error: e.message }; }
}
/** se connecte à un compte @returns {Promise<{ ok: boolean, error?: string }>} */
export async function seConnecter(email, mdp) {
  if (!client() || !FB) return { ok: false, error: 'Le compte en ligne n\'est pas configuré sur ce simulateur.' };
  changer('connexion');
  try { const s = await FB.connecter(String(email).trim(), mdp); SESSION = s; await brancher(s); return { ok: true }; }
  catch (e) { SESSION = null; changer('deconnecte', e.message); return { ok: false, error: e.message }; }
}
/** envoie le mail de changement de mot de passe */
export async function motDePasseOublie(email) {
  if (!client() || !FB) return { ok: false, error: 'Le compte en ligne n\'est pas configuré sur ce simulateur.' };
  try { await FB.oubli(String(email).trim()); return { ok: true }; } catch (e) { return { ok: false, error: e.message }; }
}
/** se déconnecte : enregistre, puis retire la progression de cet ordinateur */
export async function seDeconnecter() {
  try { await saveProgressNow(); } catch (e) { /* hors ligne : la copie du compte date du dernier enregistrement réussi */ }
  NUAGE.actif = false; NUAGE.uid = '';
  SESSION = null; COMPTE.uid = ''; COMPTE.email = '';
  ecrireLS(CLE, null); ecrireLS(PROPRIO, null);
  remplacerProgression({});
  SAVE.remote = null;
  changer('deconnecte');
  emit('shared');
}
/** enregistre tout de suite (bouton « Synchroniser ») */
export async function synchroniser() {
  if (!connecte()) return { ok: false, error: 'Pas connecté.' };
  await saveProgressNow();
  await publierProfil();
  return SAVE.remote === false ? { ok: false, error: SAVE.error || 'Enregistrement en ligne impossible.' } : { ok: true };
}
/** efface le compte : ses documents, puis le compte lui-même ; la progression reste sur cet ordinateur */
export async function supprimerCompte() {
  if (!connecte() || !FB || !SESSION) return { ok: false, error: 'Pas connecté.' };
  const s = SESSION;
  try {
    await FB.effacer(s, 'profils/' + s.uid);
    await FB.effacer(s, 'progress/' + s.uid);
    await FB.supprimerCompte(s);
  } catch (e) { return { ok: false, error: e.message }; }
  NUAGE.actif = false; SESSION = null; COMPTE.uid = ''; COMPTE.email = '';
  ecrireLS(CLE, null); ecrireLS(PROPRIO, null);
  changer('deconnecte');
  return { ok: true };
}

// ---------------- le profil public et le classement ----------------
/** @type {ReturnType<typeof setTimeout> | undefined} */ let pubT;
export function publierBientot() { clearTimeout(pubT); pubT = setTimeout(() => { publierProfil(); }, 3000); }
/** écrit le profil public (ou l'efface si l'on s'est retiré du classement) */
export async function publierProfil() {
  if (!connecte() || !FB || !SESSION) return false;
  const p = profil();
  try {
    if (!p.visible) await FB.effacer(SESSION, 'profils/' + SESSION.uid);
    else await FB.ecrire(SESSION, 'profils/' + SESSION.uid, profilPublic(PROG));
    COMPTE.publie = Date.now(); emit('profilPublie');
    return true;
  } catch (e) { return false; }
}
/**
 * Le classement : les profils publics, du plus haut niveau au plus bas (XP), 100 au plus.
 * @returns {Promise<{ ok: boolean, liste: Array<{ id: string, data: any }>, error?: string }>}
 */
export async function classement() {
  if (!connecte() || !FB || !SESSION) return { ok: false, liste: [], error: 'Connectez-vous pour voir le classement.' };
  try { return { ok: true, liste: await FB.requete(SESSION, 'profils', { tri: 'xp', desc: true, limite: 100 }) }; }
  catch (e) { return { ok: false, liste: [], error: e.message }; }
}
/** le profil public d'un joueur (null s'il n'existe pas ou s'il s'est retiré) */
export async function profilDe(uid) {
  if (!connecte() || !FB || !SESSION) return null;
  try { return await FB.lire(SESSION, 'profils/' + uid); } catch (e) { return null; }
}
// un changement de profil, de récompense ou de niveau se publie (sans attendre l'enregistrement)
on('pass', () => { if (connecte()) publierBientot(); });
on('xp', (r) => { if (connecte() && r && r.leveled) publierBientot(); });
on('badge', () => { if (connecte()) publierBientot(); });
// quand la connexion revient, l'enregistrement en ligne reprend
if (typeof window !== 'undefined') window.addEventListener('online', () => { if (connecte()) { saveProgressSoon(); publierBientot(); } });
