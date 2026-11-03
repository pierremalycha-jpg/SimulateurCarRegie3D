// Les comptes (v19.24) contre l'émulateur Firebase (Authentication et Firestore) : le module
// src/comptes/firebase.js avec le vrai SDK, et les règles firestore.rules. Lancé par
// tools/firebase-test.mjs (qui démarre les émulateurs) ; ne touche à aucun vrai projet.
//   - un professeur autorisé ouvre son compte, doit confirmer son adresse, devient professeur ;
//     une adresse non autorisée est refusée ;
//   - le professeur crée une classe et des élèves (identifiant, homonyme, mot de passe provisoire) ;
//   - l'élève se connecte avec son identifiant, écrit sa progression, ne lit que ce qui est à lui ;
//   - le professeur lit les progressions, change un mot de passe, change de classe, supprime un compte ;
//   - le profil public et le classement (v19.27) : l'élève écrit le sien, pas celui d'un autre ni avec une adresse.
import assert from 'node:assert/strict';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, getDocs, collection, query, where, updateDoc } from 'firebase/firestore';

const PROJET = process.env.GCLOUD_PROJECT || 'demo-tiee';
const AUTH = 'http://' + (process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099');
const [FH, FP] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':');
const config = { apiKey: 'demo-cle', authDomain: `${PROJET}.firebaseapp.com`, projectId: PROJET, appId: 'demo' };
globalThis.__TIEE_FIREBASE__ = { config, emulateurs: { auth: AUTH, firestore: { host: FH, port: Number(FP) } } };
const FB = await import('../../src/comptes/firebase.js');
const { DOMAINE_ELEVES } = await import('../../src/comptes/config.js');
const { profilPourCompte } = await import('../../src/game/pass.js');

let ok = 0, ko = 0;
async function check(nom, fn) {
  try { await fn(); ok++; console.log('OK  ', nom); } catch (e) { ko++; console.log('FAIL', nom, '\n     ', e && (e.stack || e.message || e)); }
}
const refuse = async (p) => { await assert.rejects(p, (e) => /permission|PERMISSION_DENIED|insufficient/i.test(String(e && (e.code || e.message)))); };
// les appels « administrateur » de l'émulateur (sans règles) : préparer admin/profs, confirmer une adresse
const owner = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };
async function ecrireAdmin(chemin, champs) {
  const r = await fetch(`http://${FH}:${FP}/v1/projects/${PROJET}/databases/(default)/documents/${chemin}`, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: champs }) });
  assert.ok(r.ok, await r.text());
}
/** le dernier lien envoyé par courriel à cette adresse (VERIFY_EMAIL, PASSWORD_RESET) */
async function lienRecu(email, type) {
  const l = await (await fetch(`${AUTH}/emulator/v1/projects/${PROJET}/oobCodes`)).json();
  const code = l.oobCodes.filter((c) => c.email === email && c.requestType === type).pop();
  assert.ok(code, 'lien envoyé : ' + type);
  return code.oobLink;
}
async function confirmerAdresse(email) {
  const r = await fetch((await lienRecu(email, 'VERIFY_EMAIL')).replace(/^http:\/\/[^/]+/, AUTH)); assert.ok(r.ok);
}
await fetch(`http://${FH}:${FP}/emulator/v1/projects/${PROJET}/databases/(default)/documents`, { method: 'DELETE' });
await fetch(`${AUTH}/emulator/v1/projects/${PROJET}/accounts`, { method: 'DELETE' });
await ecrireAdmin('admin/profs', { emails: { arrayValue: { values: [{ stringValue: 'prof@lycee.fr' }] } } });

// la session du module : on attend l'état voulu
let etat = { etat: 'aucun' };
const attentes = [];
FB.suivreSession((c) => { etat = c; for (const a of attentes.splice(0)) a(); });
const attendre = async (pred, ms = 15000) => { const t0 = Date.now(); while (!pred(etat)) { if (Date.now() - t0 > ms) throw new Error('attente dépassée : ' + JSON.stringify(etat)); await new Promise((r) => { attentes.push(r); setTimeout(r, 200); }); } return etat; };

// une seconde application, « l'ordinateur de l'élève »
const app2 = initializeApp(config, 'eleve');
const a2 = getAuth(app2); connectAuthEmulator(a2, AUTH, { disableWarnings: true });
const d2 = getFirestore(app2); connectFirestoreEmulator(d2, FH, Number(FP));

await check('une adresse non autorisée ne devient pas professeur', async () => {
  await FB.inscrireProf({ email: 'intrus@exemple.fr', mdp: 'secret123', prenom: 'In', nom: 'Trus' });
  await attendre((c) => c.etat === 'verifier');
  await confirmerAdresse('intrus@exemple.fr'); await FB.relireSession();
  const c = await attendre((x) => x.etat === 'refuse' || x.etat === 'deconnecte');
  assert.equal(c.etat === 'refuse' || c.etat === 'deconnecte', true);
});
await check('un professeur autorisé : adresse à confirmer, puis compte professeur', async () => {
  await FB.deconnecter().catch(() => {});
  await FB.inscrireProf({ email: 'prof@lycee.fr', mdp: 'secret123', prenom: 'Pierre', nom: 'Prof' });
  const v = await attendre((c) => c.etat === 'verifier');
  assert.match(v.message, /Confirmez/);
  // le lien collé dans l'application, abîmé comme par certaines messageries (« &amp; ») : confirmé sans la page de Firebase
  await assert.rejects(FB.confirmerAvecLien('https://exemple.fr/pas-un-lien'), /oobCode/);
  const lien = (await lienRecu('prof@lycee.fr', 'VERIFY_EMAIL')).replace(/&/g, '&amp;');
  assert.equal(await FB.confirmerAvecLien(lien), true);
  const c = await attendre((x) => x.etat === 'connecte');
  assert.equal(c.role, 'prof'); assert.equal(c.prenom, 'Pierre');
});
const profUid = etat.uid;

let classe = '', lea = null, lea2 = null, tom = null;
await check('le professeur crée une classe et des élèves (identifiant, homonyme, mot de passe provisoire)', async () => {
  classe = await FB.creerClasse('BTS MAV 1', profUid);
  lea = await FB.creerEleve({ prenom: 'Léa', nom: 'Martin', classe, profUid });
  lea2 = await FB.creerEleve({ prenom: 'Léa', nom: 'Martin', classe, profUid });
  tom = await FB.creerEleve({ prenom: 'Tom', nom: 'Durand', classe, profUid, mdp: 'choisi1' });
  assert.equal(lea.identifiant, 'lea.martin'); assert.equal(lea2.identifiant, 'lea.martin2'); assert.equal(tom.mdp, 'choisi1');
  assert.match(lea.mdp, /^[a-z]{7}\d\d$/);
  const s = await FB.secretsDe([lea.uid, tom.uid]); assert.equal(s[lea.uid].mdp, lea.mdp);
  assert.equal(etat.uid, profUid, 'la session du professeur ne change pas');
});
await check('la liste des élèves et des classes, en direct', async () => {
  const l = await new Promise((r) => { const u = FB.suivreEleves((x) => { if (x.length >= 3) { u(); r(x); } }); });
  assert.deepEqual(l.map((e) => e.identifiant).sort(), ['lea.martin', 'lea.martin2', 'tom.durand']);
  const c = await new Promise((r) => { const u = FB.suivreClasses((x) => { u(); r(x); }); });
  assert.equal(c[0].nom, 'BTS MAV 1');
});

await check('l\'élève se connecte avec son identifiant, écrit sa progression, lit sa classe', async () => {
  const r = await signInWithEmailAndPassword(a2, `lea.martin@${DOMAINE_ELEVES}`, lea.mdp);
  assert.equal(r.user.uid, lea.uid);
  await setDoc(doc(d2, 'progress', lea.uid), { json: JSON.stringify({ v: 7, cours: { 'signal-422': { qn: 4, quiz: { score: 1, total: 3 } } }, updatedAt: Date.now() }), v: 7, updatedAt: Date.now() });
  assert.equal((await getDoc(doc(d2, 'comptes', lea.uid))).data().role, 'eleve');
  assert.equal((await getDoc(doc(d2, 'classes', classe))).data().nom, 'BTS MAV 1');
});
await check('l\'élève ne lit ni n\'écrit rien d\'autre (autres élèves, mots de passe, liste des comptes, rôle)', async () => {
  await refuse(getDoc(doc(d2, 'comptes', tom.uid)));
  await refuse(getDoc(doc(d2, 'progress', tom.uid)));
  await refuse(setDoc(doc(d2, 'progress', tom.uid), { json: '{}', v: 7, updatedAt: 1 }));
  await refuse(getDoc(doc(d2, 'secrets', lea.uid)));
  await refuse(getDocs(query(collection(d2, 'comptes'), where('role', '==', 'eleve'))));
  await refuse(updateDoc(doc(d2, 'comptes', lea.uid), { role: 'prof' }));
  await refuse(setDoc(doc(d2, 'comptes', 'nouveau'), { role: 'eleve', prenom: 'X', nom: 'Y', identifiant: 'x.y', classe: null }));
  await refuse(setDoc(doc(d2, 'classes', 'c2'), { nom: 'Pirate' }));
  await refuse(getDoc(doc(d2, 'admin', 'profs')));
  await refuse(setDoc(doc(d2, 'config', 'car'), { json: '{}' }));
  await refuse(setDoc(doc(d2, 'progress', lea.uid), { json: '{}', v: 7, updatedAt: 1, role: 'prof' }));
});
await check('un compte ouvert sans fiche (inscription directe) n\'a droit à rien', async () => {
  await signOut(a2);
  const r = await createUserWithEmailAndPassword(a2, `pirate@${DOMAINE_ELEVES}`, 'pirate1');
  await refuse(setDoc(doc(d2, 'progress', r.user.uid), { json: '{}', v: 7, updatedAt: 1 }));
  await refuse(setDoc(doc(d2, 'comptes', r.user.uid), { role: 'prof', prenom: 'P', nom: 'P', email: 'x' }));
  await signOut(a2);
});

await check('profil public (v19.27) : l\'élève écrit le sien, conforme aux règles ; tous les comptes le lisent ; le classement', async () => {
  await signInWithEmailAndPassword(a2, `lea.martin@${DOMAINE_ELEVES}`, lea.mdp);
  const pub = profilPourCompte({ game: { keys: { a: { at: 1, pts: 400, label: 'x' } } } }, { role: 'eleve', prenom: 'Léa', nom: 'Martin', classe, classeNom: 'BTS MAV 1' });
  await setDoc(doc(d2, 'profils', lea.uid), pub);
  assert.equal((await getDoc(doc(d2, 'profils', lea.uid))).data().pseudo, 'Léa M.');
  const l = await FB.lireClassement(10);
  assert.ok(l.some((x) => x.id === lea.uid && x.data.niveau === 5), JSON.stringify(l.map((x) => x.id)));
});
await check('profil public : ni celui d\'un autre, ni une autre classe, ni un rôle de professeur, ni un champ en plus (adresse)', async () => {
  const pub = profilPourCompte({}, { role: 'eleve', prenom: 'Léa', nom: 'Martin', classe });
  await refuse(setDoc(doc(d2, 'profils', tom.uid), pub));
  await refuse(setDoc(doc(d2, 'profils', lea.uid), { ...pub, classe: 'autre' }));
  await refuse(setDoc(doc(d2, 'profils', lea.uid), { ...pub, role: 'prof' }));
  await refuse(setDoc(doc(d2, 'profils', lea.uid), { ...pub, email: 'lea@exemple.fr' }));
  await refuse(setDoc(doc(d2, 'profils', lea.uid), { ...pub, niveau: 99 }));
});
await check('le professeur lit la progression de la classe (difficulté repérée par le bilan)', async () => {
  const m = await new Promise((r) => { const u = FB.suivreProgressions([lea.uid, tom.uid], (x) => { if (x[lea.uid]) { u(); r(x); } }); });
  assert.equal(m[lea.uid].cours['signal-422'].qn, 4);
  assert.equal(m[tom.uid], undefined);
});
await check('la progression par l\'interface de shared.js (base()) : écriture et relecture en JSON', async () => {
  const db = FB.base();
  await db.doc('config/car').set({ name: 'Car test', equip: { lsmCount: 2 }, liste: [[1, 2], [3]] });
  const s = await db.doc('config/car').get();
  assert.deepEqual(s.data().liste, [[1, 2], [3]], 'les tableaux dans des tableaux passent (JSON)');
});
await check('nouveau mot de passe : l\'ancien ne marche plus, le nouveau oui', async () => {
  const m = await FB.changerMdp(lea.uid);
  assert.notEqual(m, lea.mdp);
  await assert.rejects(signInWithEmailAndPassword(a2, `lea.martin@${DOMAINE_ELEVES}`, lea.mdp));
  await signInWithEmailAndPassword(a2, `lea.martin@${DOMAINE_ELEVES}`, m); await signOut(a2);
  assert.equal((await FB.secretsDe([lea.uid]))[lea.uid].mdp, m);
});
await check('changer de classe, autoriser un collègue', async () => {
  await FB.changerClasse(tom.uid, null);
  await FB.ajouterProf('Collegue@Lycee.fr');
  assert.deepEqual(await FB.listeProfs(), ['collegue@lycee.fr', 'prof@lycee.fr']);
});
await check('supprimer un élève : plus de connexion, plus de fiche ni de progression', async () => {
  await FB.supprimerEleve(lea2.uid);
  await assert.rejects(signInWithEmailAndPassword(a2, `lea.martin2@${DOMAINE_ELEVES}`, lea2.mdp));
  const l = await new Promise((r) => { const u = FB.suivreEleves((x) => { u(); r(x); }); });
  assert.ok(!l.some((e) => e.uid === lea2.uid));
});
await check('l\'élève : le module le reconnaît comme élève (identifiant, classe)', async () => {
  await FB.deconnecter(); await attendre((c) => c.etat === 'deconnecte');
  await FB.connecter('tom.durand', 'choisi1');
  const c = await attendre((x) => x.etat === 'connecte');
  assert.equal(c.role, 'eleve'); assert.equal(c.identifiant, 'tom.durand'); assert.equal(c.classe, null);
  await assert.rejects(FB.creerClasse('X', c.uid));
  await FB.deconnecter();
});
await check('le code d\'un lien collé : adresse entière, « &amp; », lien réécrit par un filtre de messagerie', async () => {
  const l = 'https://tieesimulatorbdd.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=AbC_123-xyzXYZ&apiKey=k&lang=fr';
  assert.deepEqual(FB.codeDuLien(l), { mode: 'verifyEmail', code: 'AbC_123-xyzXYZ' });
  assert.deepEqual(FB.codeDuLien(l.replace(/&/g, '&amp;')), { mode: 'verifyEmail', code: 'AbC_123-xyzXYZ' });
  assert.deepEqual(FB.codeDuLien('https://safelinks.protection.outlook.com/?url=' + encodeURIComponent(l) + '&data=x'), { mode: 'verifyEmail', code: 'AbC_123-xyzXYZ' });
  assert.equal(FB.codeDuLien('bonjour'), null);
});
await check('mot de passe oublié d\'un professeur : le lien collé et le nouveau mot de passe, dans l\'application', async () => {
  await FB.mdpOublie('prof@lycee.fr');
  await assert.rejects(FB.nouveauMdpAvecLien('https://x.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=AbCdEfGhIjKl', 'autre456'), /mot de passe oublié/);
  await FB.nouveauMdpAvecLien(await lienRecu('prof@lycee.fr', 'PASSWORD_RESET'), 'nouveau789');
  await FB.connecter('prof@lycee.fr', 'nouveau789');
  const c = await attendre((x) => x.etat === 'connecte' && x.role === 'prof');
  assert.equal(c.email, 'prof@lycee.fr');
  await FB.deconnecter();
});
await check('mauvais mot de passe : message en français', async () => {
  const e = await FB.connecter('tom.durand', 'faux').catch((x) => x);
  assert.match(FB.texteErreur(e), /incorrect/);
});

console.log(ko ? `ÉCHECS ${ko}/${ok + ko}` : `TOUT VA BIEN (${ok} vérifications)`);
process.exit(ko ? 1 : 0);
