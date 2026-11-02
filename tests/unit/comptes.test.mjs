// Les comptes (v19.24) : identifiants et mots de passe des élèves, lecture d'une liste collée, bilan
// d'un élève et d'une classe pour le tableau de bord du professeur (difficultés : essais manqués),
// temps de travail, progression v7 (essais du quiz, minutes par jour) et sa fusion entre appareils.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { allLessons } from '../../src/cours/index.js';
import { SEUIL_EXO } from '../../src/cours/exo.js';
import { identifiantDe, identifiantValide, adresseDe, identifiantDeAdresse, motDePasse, motDePasseRefuse, lireListe, nomComplet, nettoyer, MDP_MIN } from '../../src/comptes/identifiants.js';
import { DOMAINE_ELEVES, FIREBASE } from '../../src/comptes/config.js';
import { bilanEleve, bilanClasse, difficultes, minutesSur, duree, ESSAIS_DIFFICULTE } from '../../src/comptes/bilan.js';
import { compterMinute, cleJour, PAUSE_MS } from '../../src/comptes/activite.js';
import { PROG, PROG_VERSION, migrateProgress, mergeProgress } from '../../src/shared.js';
import { mulberry32 } from '../../src/util.js';

test('identifiant : prénom.nom sans accent ni espace, homonymes numérotés, longueur bornée', () => {
  assert.equal(identifiantDe('Léa', 'Martin'), 'lea.martin');
  assert.equal(identifiantDe('Léa', 'Martin', 2), 'lea.martin2');
  assert.equal(identifiantDe('Jean-Éric', "D'Alembert du Château"), 'jean-eric.d-alembert-du-chateau');
  assert.equal(identifiantDe('Chloë', 'Œuvray'), 'chloe.oeuvray');
  assert.equal(identifiantDe('', ''), 'eleve');
  const long = identifiantDe('Maximilien-Alexandre', 'De La Tour Saint-Exupéry-Montmorency', 12);
  assert.ok(long.length <= 40 && long.endsWith('12'), long);
  for (const s of ['lea.martin', 'lea.martin2', 'jean-eric.d-alembert', 'a1']) assert.ok(identifiantValide(s), s);
  for (const s of ['', 'Lea', 'lea..martin', '.lea', 'lea martin', 'léa']) assert.ok(!identifiantValide(s), s);
  assert.equal(nettoyer('  Ça  va ! '), 'ca-va');
});
test('adresse de connexion : un identifiant d\'élève prend le domaine réservé, une adresse reste une adresse', () => {
  assert.equal(adresseDe(' Lea.Martin '), `lea.martin@${DOMAINE_ELEVES}`);
  assert.equal(adresseDe('Prof@Lycee.fr'), 'prof@lycee.fr');
  assert.equal(identifiantDeAdresse(`lea.martin@${DOMAINE_ELEVES}`), 'lea.martin');
  assert.equal(identifiantDeAdresse('prof@lycee.fr'), null);
  assert.ok(DOMAINE_ELEVES.endsWith('.invalid'), 'domaine réservé : aucun courrier ne part vers les élèves');
});
test('le projet Firebase n\'est pas écrit en dur ailleurs que dans config.js, et la configuration a ses clés', () => {
  assert.deepEqual(Object.keys(FIREBASE).sort(), ['apiKey', 'appId', 'authDomain', 'messagingSenderId', 'projectId', 'storageBucket']);
});
test('mot de passe provisoire : lisible, sans lettre ambiguë, assez long, varié', () => {
  const rnd = mulberry32(7); const vus = new Set();
  for (let i = 0; i < 500; i++) { const m = motDePasse(rnd); assert.match(m, /^[bcdfgjkmnprstvz][aeiou][bcdfgjkmnprstvz][aeiou][bcdfgjkmnprstvz][aeiou][bcdfgjkmnprstvz][1-9]\d$/); vus.add(m); }
  assert.ok(vus.size > 490, 'presque jamais deux fois le même');
  assert.ok(motDePasse().length >= MDP_MIN, 'avec le générateur du navigateur (crypto)');
  assert.equal(motDePasseRefuse('abc'), `Au moins ${MDP_MIN} caractères.`);
  assert.equal(motDePasseRefuse('avec espace'), 'Pas d\'espace.');
  assert.equal(motDePasseRefuse('choisi1'), '');
});
test('liste collée : « Prénom Nom », « NOM Prénom », colonnes de tableur, lignes vides', () => {
  assert.deepEqual(lireListe('Léa Martin\n\nMARTIN Tom\nDurand;Zoé\nDE LA TOUR Anne-Marie\nPaul\tLEROY\n'), [
    { prenom: 'Léa', nom: 'Martin' }, { prenom: 'Tom', nom: 'MARTIN' }, { prenom: 'Zoé', nom: 'Durand' }, { prenom: 'Anne-Marie', nom: 'DE LA TOUR' }, { prenom: 'LEROY', nom: 'Paul' },
  ]);
  assert.equal(nomComplet({ prenom: 'Anne-Marie', nom: 'DE LA TOUR' }), 'Anne-Marie De La Tour');
  assert.equal(lireListe(Array.from({ length: 80 }, (_, i) => `Élève ${i}`).join('\n')).length, 60, 'au plus 60 à la fois');
});

const L = allLessons().map((x) => x.lesson.id);
test('bilan : un élève qui n\'a rien fait', () => {
  const b = bilanEleve(null);
  assert.equal(b.jamais, true); assert.equal(b.terminees, 0); assert.ok(b.lecons >= 50); assert.equal(b.moyenneExos, null);
  assert.deepEqual(b.difficultes, []); assert.equal(b.minutes.total, 0);
});
test('difficultés : quiz manqué plusieurs fois, exercice jamais réussi, réussi avec la solution, épreuve ratée', () => {
  const P = { updatedAt: Date.now(), cours: {
    [L[0]]: { seen: true, qn: 10, quiz: { score: 2, total: 3 } }, // 10 essais : forte
    [L[1]]: { seen: true, qn: ESSAIS_DIFFICULTE, quiz: { score: 1, total: 3 }, exo: { best: 40, n: 4, seul: false } }, // quiz et exo
    [L[2]]: { seen: true, qn: 9, quiz: { score: 3, total: 3 }, exo: { best: 80, n: 2, seul: false } }, // réussi (rien) mais aidé
    [L[3]]: { seen: true, qn: 2, quiz: { score: 0, total: 3 } }, // 2 essais : pas encore une difficulté
  }, emissions: [{ score: 20 }, { score: 35 }, { score: 41 }], scenarios: [{ score: 20 }, { score: 30 }, { score: 70 }] };
  const D = difficultes(P);
  const ids = D.map((d) => `${d.type}:${d.id}:${d.gravite}`);
  assert.deepEqual(ids.slice(0, 1), [`quiz:${L[0]}:forte`]);
  assert.ok(ids.includes(`quiz:${L[1]}:moyenne`) && ids.includes(`exo:${L[1]}:moyenne`), ids.join(' '));
  assert.ok(ids.includes(`aide:${L[2]}:aide`), 'exercice réussi avec la solution');
  assert.ok(ids.includes('epreuve:emission:moyenne'), 'trois émissions ratées');
  assert.ok(!ids.some((x) => x.includes(L[3])), 'deux essais ne suffisent pas');
  assert.ok(!ids.some((x) => x.includes('scenario')), 'un jour de match réussi efface les échecs');
  assert.equal(D[D.length - 1].gravite, 'aide', 'les aides en dernier');
  assert.match(D.find((d) => d.type === 'exo').texte, new RegExp(`4 essais, meilleur score 40 / 100 \\(${SEUIL_EXO} demandés\\)`));
  const b = bilanEleve(P);
  assert.equal(b.alertes, D.filter((d) => d.gravite !== 'aide').length);
  assert.equal(b.quizReussis, 1); assert.equal(b.vues, 4); assert.equal(b.moyenneExos, 60);
});
test('bilan de classe : moyennes des actifs, élèves à suivre, leçons où plusieurs bloquent', () => {
  const now = Date.now();
  const bloque = { updatedAt: now, cours: { [L[0]]: { qn: 5, quiz: { score: 1, total: 3 } } }, jours: { [cleJour(now)]: 30 } };
  const C = bilanClasse([
    { uid: 'a', nom: 'Léa', prog: bloque }, { uid: 'b', nom: 'Tom', prog: bloque },
    { uid: 'c', nom: 'Zoé', prog: { updatedAt: now - 30 * 864e5, cours: { [L[0]]: { seen: true, quiz: { score: 3, total: 3 }, exo: { best: 90, seul: true, n: 1 } } } } },
    { uid: 'd', nom: 'Max', prog: null },
  ], now);
  assert.equal(C.effectif, 4); assert.equal(C.actifs, 3);
  assert.deepEqual(C.jamais, ['Max']); assert.deepEqual(C.inactifs, ['Zoé']);
  assert.deepEqual(C.aSuivre.map((x) => x.nom), ['Léa', 'Tom']);
  assert.equal(C.leconsDifficiles[0].id, L[0]); assert.deepEqual(C.leconsDifficiles[0].eleves, ['Léa', 'Tom']);
  assert.equal(C.minutesSemaine, 20, '(30 + 30 + 0) / 3 actifs');
});
test('temps de travail : une minute comptée seulement si la page est vue et la personne active', () => {
  const P = {}; const t = new Date(2026, 10, 2, 10, 0).getTime();
  assert.equal(compterMinute(P, t, true, t - 1000), true);
  assert.equal(compterMinute(P, t, false, t - 1000), false, 'onglet caché');
  assert.equal(compterMinute(P, t, true, t - PAUSE_MS - 1), false, 'personne devant');
  assert.deepEqual(P.jours, { '2026-11-02': 1 });
  assert.equal(minutesSur({ jours: { '2026-11-02': 25, '2026-10-30': 10, '2026-10-01': 99 } }, 7, t), 35);
  assert.equal(duree(0), '—'); assert.equal(duree(35), '35 min'); assert.equal(duree(125), '2 h 05');
});
test('progression v7 : essais du quiz et minutes par jour, migrés, fusionnés entre appareils', () => {
  assert.ok(PROG_VERSION >= 7);
  const m = migrateProgress({ v: 6, cours: { a: { qn: -2 }, b: { qn: 3 } }, jours: { '2026-11-02': 12, 'hier': 3, '2026-11-01': 'x' } });
  assert.equal(m.v, PROG_VERSION); assert.equal('qn' in m.cours.a, false); assert.equal(m.cours.b.qn, 3);
  assert.deepEqual(m.jours, { '2026-11-02': 12 });
  for (const k of Object.keys(PROG)) delete PROG[k];
  Object.assign(PROG, { v: PROG_VERSION, missions: {}, visited: {}, scenarios: [], reports: [], cours: { x: { seen: true, quiz: null, qn: 2 } }, jours: { '2026-11-02': 10 } });
  mergeProgress({ cours: { x: { seen: true, quiz: { score: 1, total: 3 }, qn: 5 } }, jours: { '2026-11-02': 4, '2026-11-01': 7 } });
  assert.equal(PROG.cours.x.qn, 5); assert.deepEqual(PROG.jours, { '2026-11-02': 10, '2026-11-01': 7 });
});

// ---------------- le car régie (v19.25) ----------------
import { car, carVide, compterSeconde, mergeCar, ACTIF_MS, MANIP_MS } from '../../src/comptes/car.js';
import { bilanCar, joursRecents, dureeS } from '../../src/comptes/bilan.js';

test('car régie : chaque seconde active compte au bon endroit (poste, manipulation, dans le car, dans le stade)', () => {
  const c = carVide(); const t = 1_000_000;
  c.sessions.push({ at: t, s: 0, p: 'standard', postes: [] });
  assert.equal(compterSeconde(c, { mode: 'station', station: 'son' }, t, t - 1000, t - 1000), true);
  compterSeconde(c, { mode: 'station', station: 'son' }, t + 6000, t + 5000, t - 1000); // assis, sans geste depuis 7 s
  compterSeconde(c, { mode: 'fps', inTruck: true }, t, t, 0);
  compterSeconde(c, { mode: 'fps', inTruck: false }, t, t, 0);
  compterSeconde(c, { mode: 'camop' }, t, t, 0);
  assert.equal(compterSeconde(c, { mode: 'fps' }, t, t - ACTIF_MS - 1, 0), false, 'élève absent');
  assert.equal(compterSeconde(c, { mode: 'fps' }, t, t, 0, false), false, 'onglet caché');
  assert.equal(compterSeconde(c, { mode: 'start' }, t, t, 0), false, 'écran titre');
  assert.deepEqual({ ...c.t }, { jeu: 5, poste: 2, car: 1, stade: 1, cadreur: 1 });
  assert.deepEqual({ s: c.postes.son.s, m: c.postes.son.m }, { s: 2, m: 1 }, `manipulation : un geste il y a moins de ${MANIP_MS / 1000} s`);
  assert.equal(c.sessions[0].s, 5);
});
test('car régie : forme remise en état, fusion entre deux appareils (le plus grand compte, les sessions des deux)', () => {
  assert.deepEqual(car({ car: { t: 3, postes: [], sessions: {} } }), carVide());
  const a = { ...carVide(), t: { jeu: 100 }, postes: { son: { n: 2, s: 50, m: 10, a: 30 } }, sessions: [{ at: 1, s: 40, postes: ['son'] }] };
  const b = { ...carVide(), t: { jeu: 80, car: 20 }, postes: { son: { n: 3, s: 40, m: 12, a: 5 }, vision: { n: 1, s: 9, m: 2, a: 1 } }, exos: { 'p-son': { n: 1, f: 1 } }, sessions: [{ at: 1, s: 60, postes: ['vision'] }, { at: 2, s: 5, postes: [] }] };
  const m = mergeCar(a, b);
  assert.deepEqual(m.t, { jeu: 100, car: 20 });
  assert.deepEqual(m.postes.son, { n: 3, s: 50, m: 12, a: 30 });
  assert.equal(m.postes.vision.s, 9); assert.equal(m.exos['p-son'].f, 1);
  assert.equal(m.sessions.length, 2); assert.equal(m.sessions[0].s, 60); assert.deepEqual(m.sessions[0].postes, ['son', 'vision']);
  assert.equal(a.t.jeu, 100, 'pure : a n\'est pas modifié'); assert.equal(Object.keys(a.postes).length, 1);
});
test('progression v8 : PROG.car migré et fusionné', () => {
  assert.ok(PROG_VERSION >= 8);
  const p = migrateProgress({ v: 7, car: { postes: 'abîmé', t: { jeu: 12 } } });
  assert.deepEqual(p.car.postes, {}); assert.equal(p.car.t.jeu, 12);
  for (const k of Object.keys(PROG)) delete PROG[k];
  Object.assign(PROG, { v: PROG_VERSION, missions: {}, visited: {}, scenarios: [], reports: [], car: { ...carVide(), t: { jeu: 5 } } });
  mergeProgress({ car: { t: { jeu: 50, poste: 30 }, postes: { son: { n: 1, s: 30, m: 20, a: 9 } } } });
  assert.equal(PROG.car.t.jeu, 50); assert.equal(PROG.car.postes.son.m, 20);
});
test('bilan du car régie : postes (pratiqués d\'abord), exercices et épreuves avec leur état, tâches, ce qui a été vu', () => {
  const cat = {
    postes: [{ id: 'son', titre: 'Son', zone: 'Car' }, { id: 'vision', titre: 'Vision', zone: 'Car' }, { id: 'evs', titre: 'EVS', zone: 'Car' }],
    exos: [
      { id: 'o-seul', titre: 'Seul', groupe: 'Le son', famille: 'postes' }, { id: 'o-aide', titre: 'Aidé', groupe: 'Le son', famille: 'postes' },
      { id: 'o-ab', titre: 'Abandonné', groupe: 'Le son', famille: 'postes' }, { id: 'o-rien', titre: 'Rien', groupe: 'Le son', famille: 'postes' },
      { id: 'i-cam', titre: 'Installer', groupe: 'Installer', famille: 'installer', taches: ['m1', 'm2'] },
      { id: 'x-match', titre: 'Jour de match', groupe: 'Épreuves', famille: 'epreuves' },
    ],
    missionsCar: [{ id: 'm1', titre: 'Le compound' }, { id: 'm2', titre: 'Le plan' }],
    lieux: ['Compound', 'Toit'], appareils: { ccu: 'CCU' },
    epreuve: (id, P) => ({ done: (P.scenarios || []).some((s) => s.score >= 60), text: (P.scenarios || []).length ? 'meilleur score 40 %' : 'pas encore joué' }),
  };
  const P = {
    missions: { m1: true }, scenarios: [{ score: 40 }],
    tutor: { 'o-seul': { done: true, clean: true, hints: 1, wrong: 0 }, 'o-aide': { done: true, aided: 2, clean: false } },
    car: { t: { jeu: 600, poste: 300 }, postes: { vision: { n: 2, s: 200, m: 80, a: 40 }, son: { n: 1, s: 100, m: 90, a: 12 } },
      exos: { 'o-ab': { n: 2, f: 0, ab: 2, s: 120 } }, vus: { app: { ccu: 3 }, lieux: { 1: 2 }, fen: { 'Fiche : Son': 1 } }, pannes: { n: 3, ok: 2 }, sessions: [{ at: 5, s: 600, p: 'standard', mode: 'libre', postes: ['son'] }] },
  };
  const c = bilanCar(P, cat);
  assert.deepEqual(c.postes.map((p) => p.id), ['vision', 'son', 'evs']);
  assert.equal(c.postes[0].part, 0.4); assert.equal(c.postesVus, 2); assert.equal(c.manip.s, 170);
  const st = Object.fromEntries(c.exos.map((e) => [e.id, e.statut]));
  assert.deepEqual(st, { 'o-seul': 'seul', 'o-aide': 'aide', 'o-ab': 'abandon', 'o-rien': 'afaire', 'i-cam': 'commence', 'x-match': 'commence' });
  assert.deepEqual(c.exercices, { total: 4, seul: 1, aide: 1, commence: 1 });
  assert.equal(c.missionsCar.faites, 1);
  assert.equal(c.vus.app[0].nom, 'CCU'); assert.equal(c.vus.lieux[0].nom, 'Toit');
  assert.equal(c.sessions[0].mode, 'libre'); assert.deepEqual(c.pannes, { n: 3, ok: 2 });
  assert.equal(bilanCar(null, cat).temps.jeu, 0, 'un élève qui n\'a rien fait');
  assert.equal(joursRecents({ jours: {} }, 14).length, 14);
  assert.equal(dureeS(30), '30 s'); assert.equal(dureeS(3900), '1 h 05');
});
