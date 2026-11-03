// Le compte en ligne (v19.25) : les valeurs de Firestore (src/compte/firestore.js), la configuration
// (src/compte/config.js), le client REST (src/compte/firebase.js) et le compte lui-même
// (src/compte/index.js : connexion, fusion des progressions, propriétaire, déconnexion), sur un faux
// Firebase en mémoire (tests/helpers/faux-firebase.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/dom.mjs';
import { fauxFirebase } from '../helpers/faux-firebase.mjs';

// un stockage de navigateur, avant de charger les modules qui le lisent
const MEM = new Map();
globalThis.localStorage = /** @type {any} */ ({ getItem: (k) => (MEM.has(k) ? MEM.get(k) : null), setItem: (k, v) => MEM.set(k, String(v)), removeItem: (k) => MEM.delete(k), clear: () => MEM.clear() });
const FAUX = fauxFirebase();
globalThis.fetch = FAUX.fetch;
const CFG = { apiKey: 'AIzaSyTEST-tiee-simulator-0000000000', projectId: 'tiee-test' };

const { versValeur, depuisValeur, versDocument, depuisDocument } = await import('../../src/compte/firestore.js');
const { configValide, lireConfig, poserConfig, configFirebase } = await import('../../src/compte/config.js');
const { clientFirebase, erreur } = await import('../../src/compte/firebase.js');
const { PROG, NUAGE, saveProgressNow } = await import('../../src/shared.js');
const { COMPTE, initCompte, creerCompte, seConnecter, seDeconnecter, classement, publierProfil, profilDe, supprimerCompte } = await import('../../src/compte/index.js');
const { profil } = await import('../../src/game/pass.js');

test('les valeurs de Firestore : aller et retour', () => {
  const o = { s: 'été', n: 42, d: 1.5, b: true, z: null, l: [1, 'a', { x: 2 }], m: { 'clé:avec-points.et/barres': { y: [] } }, big: 2 ** 60, inf: Infinity, u: undefined };
  const d = versDocument(o);
  assert.deepEqual(d.fields.n, { integerValue: '42' });
  assert.deepEqual(d.fields.d, { doubleValue: 1.5 });
  assert.ok(!('inf' in d.fields) && !('u' in d.fields), 'ni infini ni undefined');
  const back = depuisDocument({ name: 'projects/p/databases/(default)/documents/progress/u1', fields: d.fields });
  assert.equal(back.id, 'u1');
  const { inf, u, ...attendu } = o; void inf; void u;
  assert.deepEqual(back.data, attendu);
  assert.equal(depuisValeur({ timestampValue: '2026-11-03T10:00:00Z' }), Date.parse('2026-11-03T10:00:00Z'));
  assert.deepEqual(versValeur([undefined]), { arrayValue: { values: [{ nullValue: null }] } });
});

test('la configuration : valide, collée depuis la console Firebase, posée dans ce navigateur', () => {
  assert.equal(configValide({ apiKey: 'x', projectId: 'p' }), null);
  assert.equal(configValide(CFG).projectId, 'tiee-test');
  assert.equal(configValide(CFG).authDomain, 'tiee-test.firebaseapp.com');
  const collee = `const firebaseConfig = {\n  apiKey: "${CFG.apiKey}",\n  authDomain: "tiee-test.firebaseapp.com",\n  projectId: "tiee-test",\n};`;
  assert.equal(lireConfig(collee).apiKey, CFG.apiKey);
  assert.equal(lireConfig(JSON.stringify(CFG)).projectId, 'tiee-test');
  assert.equal(lireConfig('n\'importe quoi'), null);
  assert.equal(configFirebase(), null, 'sans construction ni navigateur : pas de compte');
  assert.ok(poserConfig(CFG)); assert.equal(configFirebase().projectId, 'tiee-test');
});

test('le client REST : inscription, connexion, documents, requête triée, erreurs en français', async () => {
  const F = clientFirebase(CFG, FAUX.fetch);
  const s = await F.inscrire('a@test.fr', 'secret1');
  assert.ok(s.uid && s.idToken && s.refreshToken && s.exp > Date.now());
  await assert.rejects(F.inscrire('a@test.fr', 'secret1'), (e) => e.code === 'EMAIL_EXISTS' && /déjà un compte/.test(e.message));
  await assert.rejects(F.inscrire('b@test.fr', '123'), (e) => e.code === 'WEAK_PASSWORD' && /6 caractères/.test(e.message));
  await assert.rejects(F.connecter('a@test.fr', 'faux'), (e) => /incorrect/.test(e.message));
  assert.equal(await F.lire(s, 'progress/' + s.uid), null, 'pas encore de document');
  await F.ecrire(s, 'progress/' + s.uid, { data: '{"v":7}', v: 7, maj: 5 });
  assert.deepEqual(await F.lire(s, 'progress/' + s.uid), { data: '{"v":7}', v: 7, maj: 5 });
  await assert.rejects(F.ecrire(s, 'progress/autre', { v: 1 }), (e) => e.code === 'PERMISSION_DENIED' && /règles de sécurité/.test(e.message));
  // le jeton expiré se renouvelle tout seul
  s.exp = Date.now() - 1; const avant = s.idToken;
  await F.ecrire(s, 'profils/' + s.uid, { pseudo: 'A', xp: 10 });
  assert.notEqual(s.idToken, avant);
  const s2 = await F.inscrire('c@test.fr', 'secret2');
  await F.ecrire(s2, 'profils/' + s2.uid, { pseudo: 'C', xp: 300 });
  const q = await F.requete(s, 'profils', { tri: 'xp', desc: true, limite: 10 });
  assert.deepEqual(q.map((x) => x.data.pseudo), ['C', 'A']);
  assert.deepEqual(await F.requete(s, 'profils', { tri: 'xp', desc: true, limite: 1 }).then((r) => r.length), 1);
  await F.effacer(s, 'profils/' + s.uid); await F.effacer(s, 'profils/' + s.uid);
  assert.equal(await F.lire(s, 'profils/' + s.uid), null);
  const hors = clientFirebase(CFG, async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(hors.connecter('a@test.fr', 'x'), (e) => e.code === 'RESEAU' && /Internet/.test(e.message));
  assert.match(erreur('QUELQUE_CHOSE').message, /QUELQUE_CHOSE/);
});

test('le compte : créer, la progression de l\'ordinateur rejoint le compte, profil public, classement', async () => {
  poserConfig(CFG);
  await initCompte();
  assert.equal(COMPTE.etat, 'deconnecte');
  // progression faite sans compte sur cet ordinateur
  PROG.cours = { 'son-n1': { seen: true, quiz: { score: 3, total: 3 } } };
  const r = await creerCompte('eleve@test.fr', 'motdepasse', 'Léa');
  assert.ok(r.ok, r.error); assert.equal(COMPTE.etat, 'connecte'); assert.ok(NUAGE.actif);
  assert.equal(profil().pseudo, 'Léa');
  const enLigne = JSON.parse(FAUX.lire('progress/' + COMPTE.uid).data);
  assert.equal(enLigne.cours['son-n1'].quiz.score, 3, 'la progression de l\'ordinateur est dans le compte');
  assert.equal(localStorage.getItem('carregie.progress.owner'), JSON.stringify(COMPTE.uid));
  assert.ok(await publierProfil());
  const pub = FAUX.lire('profils/' + COMPTE.uid);
  assert.equal(pub.pseudo, 'Léa'); assert.ok(!('email' in pub));
  const cl = await classement(); assert.ok(cl.ok); assert.ok(cl.liste.some((x) => x.data.pseudo === 'Léa'));
  assert.equal((await profilDe(COMPTE.uid)).pseudo, 'Léa');
  // caché : le profil public est effacé
  profil().visible = false; await publierProfil(); assert.equal(FAUX.lire('profils/' + COMPTE.uid), null);
  profil().visible = true;
});

test('sur un autre ordinateur : se connecter retrouve la progression ; se déconnecter la retire ; un autre compte ne la mélange pas', async () => {
  const uid = COMPTE.uid;
  await seDeconnecter();
  assert.equal(COMPTE.etat, 'deconnecte'); assert.equal(NUAGE.actif, false);
  assert.equal(Object.keys(PROG.cours || {}).length, 0, 'déconnecté : plus rien sur l\'ordinateur');
  assert.equal(localStorage.getItem('carregie.compte'), null);
  // « autre ordinateur » : un stockage vide, on se connecte
  MEM.delete('carregie.progress'); MEM.delete('carregie.progress.owner');
  const r = await seConnecter('eleve@test.fr', 'motdepasse');
  assert.ok(r.ok, r.error); assert.equal(COMPTE.uid, uid);
  assert.equal(PROG.cours['son-n1'].quiz.score, 3, 'progression retrouvée');
  assert.equal(profil().pseudo, 'Léa');
  // la session est gardée : au prochain lancement, on est reconnecté sans rien demander
  const garde = JSON.parse(localStorage.getItem('carregie.compte'));
  assert.equal(garde.uid, uid); assert.ok(garde.refreshToken); assert.ok(!('mdp' in garde));
  // un deuxième élève se connecte sur le même ordinateur sans que le premier se soit déconnecté
  const autre = await creerCompte('autre@test.fr', 'motdepasse2', 'Tom');
  assert.ok(autre.ok, autre.error);
  assert.equal(Object.keys(PROG.cours || {}).length, 0, 'la progression du premier compte ne passe pas dans le second');
  assert.equal(JSON.parse(FAUX.lire('progress/' + uid).data).cours['son-n1'].quiz.score, 3, 'celle du premier est intacte');
  await saveProgressNow();
  // supprimer le compte : ses documents et le compte
  const id2 = COMPTE.uid;
  assert.ok((await supprimerCompte()).ok);
  assert.equal(FAUX.lire('progress/' + id2), null); assert.equal(COMPTE.etat, 'deconnecte');
  assert.ok(!FAUX.comptes.has('autre@test.fr'));
});

test('au démarrage : la session gardée reprend la progression du compte', async () => {
  const r = await seConnecter('eleve@test.fr', 'motdepasse'); assert.ok(r.ok, r.error);
  // relance : la page repart de la session gardée
  NUAGE.actif = false; COMPTE.etat = 'deconnecte';
  await initCompte();
  assert.equal(COMPTE.etat, 'connecte'); assert.ok(NUAGE.actif);
  assert.equal(PROG.cours['son-n1'].quiz.score, 3);
});
