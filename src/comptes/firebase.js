// @ts-check
import { initializeApp, deleteApp } from 'firebase/app';
import {
  initializeAuth, inMemoryPersistence, indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, connectAuthEmulator, onIdTokenChanged, signInWithEmailAndPassword, signOut,
  createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail, updatePassword, deleteUser, updateProfile,
  applyActionCode, confirmPasswordReset,
} from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where,
  documentId, serverTimestamp, arrayUnion, arrayRemove, addDoc, getDocs, orderBy, limit,
} from 'firebase/firestore';
import { FIREBASE } from './config.js';
import { adresseDe, identifiantDe, identifiantDeAdresse, motDePasse } from './identifiants.js';

// ----------------------------------------------------------------------------------
// Les comptes dans Firebase (v19.24) : Authentication (adresse et mot de passe ; un élève a une adresse
// fabriquée à partir de son identifiant, identifiants.js) et Firestore. Les documents :
//   admin/profs        { emails: [...] }  adresses autorisées à ouvrir un compte professeur (créé dans la console)
//   comptes/<uid>      { role: 'prof' | 'eleve', prenom, nom, identifiant?, classe?, email?, creePar, creeLe }
//   classes/<id>       { nom, creePar, creeLe }
//   secrets/<uid>      { identifiant, mdp }   mot de passe provisoire d'un élève, lu par les professeurs seulement
//   progress/<uid>     { json, v, updatedAt } la progression (PROG de src/shared.js), en JSON
//   config/<partie>    configuration du car écrite par un professeur (Réglages → Espace formateur)
// Qui lit et écrit quoi : firestore.rules (à déployer avec la console ou « firebase deploy »).
// Un professeur crée le compte d'un élève avec une seconde instance de l'application (sa propre session
// ne change pas) : Firebase n'a pas, côté navigateur, de quoi créer un compte sans s'y connecter.
// ----------------------------------------------------------------------------------

/** configuration : celle de config.js, ou celle des tests (window.__TIEE_FIREBASE__ : projet de démonstration et émulateurs) */
function reglages() {
  const o = /** @type {any} */ (globalThis).__TIEE_FIREBASE__;
  if (o && o.config) return { config: o.config, emu: o.emulateurs || null };
  return { config: FIREBASE, emu: null };
}
/** le projet Firebase est-il renseigné ? (sinon : pas de compte, tout reste dans le navigateur) */
export const comptesDisponibles = () => { const { config } = reglages(); return !!(config && config.apiKey && config.projectId); };

const FB = { app: /** @type {any} */ (null), auth: /** @type {any} */ (null), db: /** @type {any} */ (null), n: 0 };
function demarrer() {
  if (FB.app) return FB;
  const { config, emu } = reglages();
  FB.app = initializeApp(config);
  // la session gardée comme getAuth() (IndexedDB, puis stockage local, puis de session), mais sans le module des
  // connexions par fenêtre surgissante ou redirection (inutile : adresse et mot de passe seulement) : il ouvre une
  // iframe de Firebase et lui écrit, ce que Safari (WebKit) refuse sur une page ouverte en fichier (origine null)
  FB.auth = initializeAuth(FB.app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence] });
  FB.db = getFirestore(FB.app);
  if (emu) {
    connectAuthEmulator(FB.auth, emu.auth, { disableWarnings: true });
    connectFirestoreEmulator(FB.db, emu.firestore.host, emu.firestore.port);
  }
  return FB;
}

// ---------------- la session ----------------
/**
 * @typedef {object} Compte
 * @property {'deconnecte' | 'connecte' | 'verifier' | 'refuse'} etat verifier : adresse de professeur à confirmer ; refuse : compte non reconnu
 * @property {string} [uid] @property {'prof' | 'eleve'} [role] @property {string} [prenom] @property {string} [nom]
 * @property {string} [identifiant] @property {string} [email] @property {string | null} [classe] @property {string} [classeNom] @property {string} [message]
 */
/**
 * Suit la session : appelé à l'ouverture (session gardée par le navigateur) et à chaque connexion ou
 * déconnexion, avec le compte lu dans Firestore. Un professeur autorisé (admin/profs) dont l'adresse est
 * vérifiée et qui n'a pas encore de compte l'obtient ici.
 * @param {(c: Compte) => void} cb
 */
export function suivreSession(cb) {
  const { auth, db } = demarrer();
  // onIdTokenChanged plutôt que onAuthStateChanged : relancé aussi quand le jeton change (adresse confirmée).
  // Les rappels se traitent l'un après l'autre (deux jetons coup sur coup ne créent pas deux fois la fiche) ;
  // un compte déjà reconnu ne se relit pas à chaque renouvellement du jeton (toutes les heures)
  let file = Promise.resolve(), reconnu = '';
  return onIdTokenChanged(auth, (u) => { file = file.then(() => traiter(u)).catch((e) => console.error(e)); });
  async function traiter(u) {
    if (!u) { reconnu = ''; cb({ etat: 'deconnecte' }); return; }
    if (u.uid === reconnu) return;
    try {
      const ref = doc(db, 'comptes', u.uid);
      let snap = await getDoc(ref);
      if (!snap.exists()) {
        if (identifiantDeAdresse(u.email || '')) { cb({ etat: 'refuse', uid: u.uid, message: 'Ce compte d\'élève a été supprimé : demande à ton professeur.' }); await signOut(auth); return; }
        if (!u.emailVerified) { cb({ etat: 'verifier', uid: u.uid, email: u.email || '', message: `Confirmez votre adresse ${u.email} : copiez le lien reçu par courriel et collez-le ci-dessous.` }); return; }
        const [prenom, ...nom] = String(u.displayName || '').split(' ');
        try { await setDoc(ref, { role: 'prof', prenom: prenom || '', nom: nom.join(' '), email: (u.email || '').toLowerCase(), creeLe: serverTimestamp() }); }
        catch (e) { cb({ etat: 'refuse', uid: u.uid, email: u.email || '', message: `L'adresse ${u.email} n'est pas dans la liste des professeurs : demandez à un collègue de l'ajouter (Tableau de bord → Professeurs).` }); await signOut(auth); return; }
        snap = await getDoc(ref);
      }
      const d = snap.data() || {};
      // le nom de la classe de l'élève (les règles lui permettent de lire la sienne)
      let classeNom = '';
      if (d.classe) { try { const c = await getDoc(doc(db, 'classes', d.classe)); classeNom = c.exists() ? String(c.data().nom || '') : ''; } catch (e) { /* sans nom */ } }
      reconnu = u.uid;
      cb({ etat: 'connecte', classeNom, uid: u.uid, role: d.role === 'prof' ? 'prof' : 'eleve', prenom: d.prenom || '', nom: d.nom || '', identifiant: d.identifiant || identifiantDeAdresse(u.email || '') || '', email: u.email || '', classe: d.classe || null });
    } catch (e) {
      cb({ etat: 'refuse', uid: u.uid, message: 'Le serveur des comptes ne répond pas (' + texteErreur(e) + ').' });
    }
  }
}
/** se connecter avec un identifiant d'élève ou une adresse de professeur */
export async function connecter(/** @type {string} */ saisie, /** @type {string} */ mdp) {
  const { auth } = demarrer();
  await signInWithEmailAndPassword(auth, adresseDe(saisie), mdp);
}
export async function deconnecter() { const { auth } = demarrer(); await signOut(auth); }
/** un professeur ouvre son compte (son adresse doit être dans admin/profs) ; un lien de confirmation part par courriel */
export async function inscrireProf(/** @type {{ email: string, mdp: string, prenom: string, nom: string }} */ o) {
  const { auth } = demarrer();
  const r = await createUserWithEmailAndPassword(auth, o.email.trim().toLowerCase(), o.mdp);
  await updateProfile(r.user, { displayName: `${o.prenom.trim()} ${o.nom.trim()}`.trim() });
  await sendEmailVerification(r.user);
}
export async function renvoyerConfirmation() { const { auth } = demarrer(); if (auth.currentUser) await sendEmailVerification(auth.currentUser); }
/** relit l'état de l'adresse (après avoir cliqué le lien de confirmation) */
export async function relireSession() {
  const { auth } = demarrer(); const u = auth.currentUser; if (!u) return false;
  // un nouveau jeton, qui porte maintenant email_verified : suivreSession est relancé
  await u.reload(); await u.getIdToken(true);
  return !!(auth.currentUser && auth.currentUser.emailVerified);
}
/**
 * Le code d'un lien reçu par courriel (confirmation d'adresse, nouveau mot de passe), collé tel quel : l'adresse
 * entière, ou ce qu'un logiciel de messagerie en a fait (« &amp; », lien réécrit par un filtre qui garde l'original
 * encodé dans un paramètre). La page de Firebase qui traite normalement ces liens n'est alors plus nécessaire.
 * @returns {{ mode: string, code: string } | null}
 */
export function codeDuLien(/** @type {string} */ texte) {
  let t = String(texte || '').trim().replace(/&amp;/g, '&');
  for (let i = 0; i < 3 && /%26|%3D/i.test(t) && !/[?&]oobCode=/.test(t); i++) { try { t = decodeURIComponent(t); } catch (e) { break; } }
  const code = (t.match(/[?&]oobCode=([A-Za-z0-9_-]{10,})/) || [])[1];
  if (!code) return null;
  return { mode: (t.match(/[?&]mode=([A-Za-z]+)/) || [])[1] || '', code };
}
/** confirme l'adresse du compte connecté avec le lien reçu, sans passer par la page de Firebase */
export async function confirmerAvecLien(/** @type {string} */ lien) {
  const c = codeDuLien(lien);
  if (!c) throw Object.assign(new Error('Ce n\'est pas le lien reçu par courriel (il contient « oobCode= »).'), { code: 'lien-invalide' });
  if (c.mode && c.mode !== 'verifyEmail') throw Object.assign(new Error('Ce lien ne sert pas à confirmer une adresse.'), { code: 'lien-invalide' });
  const { auth } = demarrer();
  await applyActionCode(auth, c.code);
  return relireSession();
}
/** choisit un nouveau mot de passe avec le lien « mot de passe oublié » reçu, sans passer par la page de Firebase */
export async function nouveauMdpAvecLien(/** @type {string} */ lien, /** @type {string} */ mdp) {
  const c = codeDuLien(lien);
  if (!c || (c.mode && c.mode !== 'resetPassword')) throw Object.assign(new Error('Ce n\'est pas le lien « mot de passe oublié » reçu par courriel.'), { code: 'lien-invalide' });
  const { auth } = demarrer();
  await confirmPasswordReset(auth, c.code, mdp);
}
export async function mdpOublie(/** @type {string} */ email) { const { auth } = demarrer(); await sendPasswordResetEmail(auth, email.trim().toLowerCase()); }

/** un message d'erreur Firebase en français */
export function texteErreur(/** @type {any} */ e) {
  const c = String((e && e.code) || '');
  const M = {
    'auth/invalid-credential': 'Identifiant ou mot de passe incorrect.', 'auth/wrong-password': 'Identifiant ou mot de passe incorrect.', 'auth/user-not-found': 'Identifiant ou mot de passe incorrect.',
    'auth/invalid-email': 'Identifiant ou adresse mal écrit.', 'auth/too-many-requests': 'Trop d\'essais : attendez quelques minutes avant de réessayer.',
    'auth/network-request-failed': 'Pas de connexion à Internet (ou le réseau bloque Firebase).', 'auth/email-already-in-use': 'Un compte existe déjà avec cette adresse.',
    'auth/weak-password': 'Mot de passe trop court (6 caractères au moins).', 'auth/user-disabled': 'Ce compte est désactivé.',
    'auth/invalid-action-code': 'Ce lien a déjà servi ou n\'est plus valable : demandez-en un nouveau.', 'auth/expired-action-code': 'Ce lien a expiré : demandez-en un nouveau.',
    'lien-invalide': '', 'permission-denied': 'Action refusée par les règles de la base (droits insuffisants).', unavailable: 'Le serveur des comptes ne répond pas (connexion ?).',
  };
  return M[c] || (e && e.message ? String(e.message).replace(/^Firebase: /, '') : 'Erreur inconnue.');
}

// ---------------- la base, vue comme celle de la page publiée (src/shared.js : doc, collection) ----------------
// Firestore refuse les tableaux dans des tableaux et les valeurs undefined : la progression est rangée en JSON
const versDoc = (data) => { const j = JSON.stringify(data ?? null); return { json: j, v: Number(data && data.v) || 0, updatedAt: Number(data && data.updatedAt) || 0 }; };
const depuisDoc = (d) => { try { return d && typeof d.json === 'string' ? JSON.parse(d.json) : d; } catch (e) { return null; } };
const snapDoc = (s) => ({ exists: s.exists(), id: s.id, data: () => depuisDoc(s.data()) });
/** la base Firestore avec l'interface qu'attend src/shared.js (progression, configuration du car) */
export function base() {
  const { db } = demarrer();
  return {
    doc: (/** @type {string} */ p) => ({
      get: async () => snapDoc(await getDoc(doc(db, p))),
      set: (data) => setDoc(doc(db, p), versDoc(data)),
      onSnapshot: (ok, ko) => onSnapshot(doc(db, p), (s) => ok(snapDoc(s)), ko),
    }),
    collection: (/** @type {string} */ p) => ({
      onSnapshot: (ok, ko) => onSnapshot(collection(db, p), (q) => ok({ docs: q.docs.map((d) => ({ id: d.id, data: () => depuisDoc(d.data()) })) }), ko),
    }),
  };
}

// ---------------- le tableau de bord du professeur ----------------
/** les classes, à jour en direct : [{ id, nom }] triées par nom */
export function suivreClasses(/** @type {(l: any[]) => void} */ cb, /** @type {(e: any) => void} */ ko = () => {}) {
  const { db } = demarrer();
  return onSnapshot(collection(db, 'classes'), (q) => cb(q.docs.map((d) => /** @type {any} */ ({ id: d.id, ...d.data() })).sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'))), ko);
}
/** tous les comptes d'élèves, à jour en direct : [{ uid, prenom, nom, identifiant, classe }] */
export function suivreEleves(/** @type {(l: any[]) => void} */ cb, /** @type {(e: any) => void} */ ko = () => {}) {
  const { db } = demarrer();
  return onSnapshot(query(collection(db, 'comptes'), where('role', '==', 'eleve')), (q) => cb(q.docs.map((d) => ({ uid: d.id, ...d.data() }))), ko);
}
/** les progressions de ces élèves, à jour en direct : cb({ uid: progression }) (par paquets de 30, limite de Firestore) */
export function suivreProgressions(/** @type {string[]} */ uids, /** @type {(m: Record<string, any>) => void} */ cb) {
  const { db } = demarrer();
  const M = {}; const unsubs = [];
  for (let i = 0; i < uids.length; i += 30) {
    const lot = uids.slice(i, i + 30);
    unsubs.push(onSnapshot(query(collection(db, 'progress'), where(documentId(), 'in', lot)), (q) => { for (const d of q.docs) M[d.id] = depuisDoc(d.data()); cb({ ...M }); }, () => cb({ ...M })));
  }
  if (!uids.length) cb({});
  return () => { for (const u of unsubs) u(); };
}
/** les mots de passe provisoires (professeurs seulement) : { uid: { identifiant, mdp } } */
export async function secretsDe(/** @type {string[]} */ uids) {
  const { db } = demarrer(); const out = {};
  for (let i = 0; i < uids.length; i += 30) {
    const lot = uids.slice(i, i + 30);
    await new Promise((res) => { const u = onSnapshot(query(collection(db, 'secrets'), where(documentId(), 'in', lot)), (q) => { for (const d of q.docs) out[d.id] = d.data(); u(); res(undefined); }, () => res(undefined)); });
  }
  return out;
}
export async function creerClasse(/** @type {string} */ nom, /** @type {string} */ profUid) {
  const { db } = demarrer();
  const r = await addDoc(collection(db, 'classes'), { nom: nom.trim().slice(0, 60), creePar: profUid, creeLe: serverTimestamp() });
  return r.id;
}
export async function renommerClasse(/** @type {string} */ id, /** @type {string} */ nom) { const { db } = demarrer(); await updateDoc(doc(db, 'classes', id), { nom: nom.trim().slice(0, 60) }); }
export async function supprimerClasse(/** @type {string} */ id) { const { db } = demarrer(); await deleteDoc(doc(db, 'classes', id)); }

/** une seconde instance de Firebase Authentication, sans mémoire : créer, modifier ou supprimer un compte d'élève sans quitter sa session */
async function avecAuthAnnexe(/** @type {(a: any) => Promise<any>} */ fn) {
  const { config, emu } = reglages();
  const app2 = initializeApp(config, 'gestion-' + (++FB.n) + '-' + Date.now());
  const a2 = initializeAuth(app2, { persistence: inMemoryPersistence });
  if (emu) connectAuthEmulator(a2, emu.auth, { disableWarnings: true });
  try { return await fn(a2); } finally { try { await signOut(a2); } catch (e) { /* déjà sorti */ } await deleteApp(app2).catch(() => {}); }
}
/**
 * Crée le compte d'un élève : identifiant tiré du prénom et du nom (« lea.martin », « lea.martin2 » pour un
 * homonyme), mot de passe provisoire tiré au hasard sauf s'il est donné.
 * @returns {Promise<{ uid: string, identifiant: string, mdp: string }>}
 */
export async function creerEleve(/** @type {{ prenom: string, nom: string, classe: string, mdp?: string, profUid: string }} */ o) {
  const { db } = demarrer();
  const mdp = o.mdp || motDePasse();
  const cree = await avecAuthAnnexe(async (a2) => {
    for (let k = 1; k <= 30; k++) {
      const identifiant = identifiantDe(o.prenom, o.nom, k);
      try { const r = await createUserWithEmailAndPassword(a2, adresseDe(identifiant), mdp); return { uid: r.user.uid, identifiant, user: r.user }; }
      catch (e) { if (!e || e.code !== 'auth/email-already-in-use') throw e; }
    }
    throw new Error('Trop d\'homonymes : changez le prénom ou le nom.');
  });
  try {
    await setDoc(doc(db, 'comptes', cree.uid), { role: 'eleve', prenom: o.prenom.trim(), nom: o.nom.trim(), identifiant: cree.identifiant, classe: o.classe || null, creePar: o.profUid, creeLe: serverTimestamp() });
    await setDoc(doc(db, 'secrets', cree.uid), { identifiant: cree.identifiant, mdp, maj: serverTimestamp() });
  } catch (e) {
    // la fiche n'a pas pu s'écrire : on retire le compte tout juste créé, pour ne pas laisser d'orphelin
    await avecAuthAnnexe(async (a2) => { const r = await signInWithEmailAndPassword(a2, adresseDe(cree.identifiant), mdp); await deleteUser(r.user); }).catch(() => {});
    throw e;
  }
  return { uid: cree.uid, identifiant: cree.identifiant, mdp };
}
/** nouveau mot de passe d'un élève (tiré au hasard sauf s'il est donné) : il faut connaître l'actuel, gardé dans secrets/<uid> */
export async function changerMdp(/** @type {string} */ uid, /** @type {string} */ nouveau = '') {
  const { db } = demarrer();
  const s = (await getDoc(doc(db, 'secrets', uid))).data();
  if (!s || !s.identifiant || !s.mdp) throw new Error('Mot de passe actuel inconnu : supprimez le compte et recréez-le.');
  const mdp = nouveau || motDePasse();
  await avecAuthAnnexe(async (a2) => { const r = await signInWithEmailAndPassword(a2, adresseDe(s.identifiant), s.mdp); await updatePassword(r.user, mdp); });
  await setDoc(doc(db, 'secrets', uid), { identifiant: s.identifiant, mdp, maj: serverTimestamp() });
  return mdp;
}
export async function changerClasse(/** @type {string} */ uid, /** @type {string | null} */ classe) { const { db } = demarrer(); await updateDoc(doc(db, 'comptes', uid), { classe: classe || null }); }
export async function renommerEleve(/** @type {string} */ uid, /** @type {string} */ prenom, /** @type {string} */ nom) { const { db } = demarrer(); await updateDoc(doc(db, 'comptes', uid), { prenom: prenom.trim(), nom: nom.trim() }); }
/** supprime le compte d'un élève, sa progression et son mot de passe enregistré */
export async function supprimerEleve(/** @type {string} */ uid) {
  const { db } = demarrer();
  const s = (await getDoc(doc(db, 'secrets', uid))).data();
  // le compte de connexion : supprimé si le mot de passe enregistré marche encore (sinon, sans fiche, il ne sert plus à rien)
  if (s && s.identifiant && s.mdp) await avecAuthAnnexe(async (a2) => { const r = await signInWithEmailAndPassword(a2, adresseDe(s.identifiant), s.mdp); await deleteUser(r.user); }).catch(() => {});
  await deleteDoc(doc(db, 'progress', uid)).catch(() => {});
  await deleteDoc(doc(db, 'secrets', uid)).catch(() => {});
  await deleteDoc(doc(db, 'comptes', uid));
}
/** les adresses autorisées à ouvrir un compte professeur */
export async function listeProfs() { const { db } = demarrer(); const s = await getDoc(doc(db, 'admin', 'profs')); return s.exists() ? (s.data().emails || []).slice().sort() : []; }
export async function ajouterProf(/** @type {string} */ email) { const { db } = demarrer(); await updateDoc(doc(db, 'admin', 'profs'), { emails: arrayUnion(email.trim().toLowerCase()) }); }
export async function retirerProf(/** @type {string} */ email) { const { db } = demarrer(); await updateDoc(doc(db, 'admin', 'profs'), { emails: arrayRemove(email.trim().toLowerCase()) }); }

// ---------------- le profil public et le classement (v19.27, comptes/profils.js, ui/profil_ui.js) ----------------
/** écrit (remplace) le profil public d'un compte : profils/<uid> */
export async function ecrireProfil(/** @type {string} */ uid, /** @type {Record<string, any>} */ data) { const { db } = demarrer(); await setDoc(doc(db, 'profils', uid), data); }
/** retire le profil public (caché du classement) */
export async function effacerProfil(/** @type {string} */ uid) { const { db } = demarrer(); await deleteDoc(doc(db, 'profils', uid)); }
/** le profil public d'un compte, ou null */
export async function lireProfil(/** @type {string} */ uid) { const { db } = demarrer(); const s = await getDoc(doc(db, 'profils', uid)); return s.exists() ? s.data() : null; }
/** le classement : les profils publics, du plus d'XP au moins, n au plus @returns {Promise<Array<{ id: string, data: any }>>} */
export async function lireClassement(n = 100) {
  const { db } = demarrer();
  const q = await getDocs(query(collection(db, 'profils'), orderBy('xp', 'desc'), limit(n)));
  return q.docs.map((d) => ({ id: d.id, data: d.data() }));
}
