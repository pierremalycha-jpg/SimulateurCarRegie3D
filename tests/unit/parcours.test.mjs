// Le parcours du Cours (v19.18) : chaque leçon rangée une fois dans un niveau de son chapitre ; au départ,
// seuls les Débutant sont ouverts ; un niveau s'ouvre quand le précédent est validé (leçons terminées,
// moyenne des exercices) ou sauté par un test de niveau ; la suite conseillée passe par les fondamentaux
// de tous les chapitres avant les niveaux plus hauts ; au profil Formateur, tout est ouvert.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { CHAPTERS, allLessons, lessonById } from '../../src/cours/index.js';
import { PARCOURS, NIVEAUX, niveauxDe, niveauDe, etatLecon, etatNiveaux, leconOuverte, suivante, bilanChapitre, leconsDuTest, tirerTest, testPasse, aReussir, conditions, ordreParcours, SEUIL_MOYENNE, TEST_MIN, TEST_MAX } from '../../src/cours/parcours.js';
import { mulberry32 } from '../../src/util.js';

/** une progression où ces leçons ont leur quiz réussi et cet exercice */
const prog = (lecons = {}, niveaux = {}) => ({ cours: Object.fromEntries(Object.entries(lecons).map(([id, exo]) => [id, { seen: true, quiz: { score: 3, total: 3 }, exo: exo == null ? undefined : { best: exo, seul: true, n: 1 } }])), niveaux });
const tout = (ids, score) => Object.fromEntries(ids.map((id) => [id, score]));

test('chaque leçon est rangée une fois, dans un niveau de son chapitre ; chaque chapitre commence au niveau Débutant', () => {
  const vus = new Map();
  for (const [ch, niv] of Object.entries(PARCOURS)) {
    assert.ok(CHAPTERS.some((c) => c.id === ch), `chapitre inconnu ${ch}`);
    assert.ok((niv.debutant || []).length, `${ch} : des leçons Débutant`);
    for (const [n, ids] of Object.entries(niv)) {
      assert.ok(NIVEAUX.some((x) => x.id === n), `${ch} : niveau inconnu ${n}`);
      for (const id of ids) {
        assert.ok(!vus.has(id), `${id} rangée deux fois`); vus.set(id, ch);
        assert.equal(niveauDe(id)?.chapter.id, ch, `${id} : rangée dans son chapitre`);
      }
    }
    // pas de trou : un niveau rempli n'en saute pas un
    const k = NIVEAUX.map((x) => (niv[x.id] || []).length > 0);
    assert.ok(k.indexOf(false) < 0 || k.slice(k.indexOf(false)).every((x) => !x), `${ch} : niveaux sans trou`);
  }
  for (const { chapter, lesson } of allLessons()) assert.equal(vus.get(lesson.id), chapter.id, `${lesson.id} : pas rangée dans le parcours`);
  assert.equal(ordreParcours().length, allLessons().length);
  // le réseau, chapitre le plus long, a ses quatre niveaux
  assert.deepEqual(niveauxDe('reseau').map((x) => x.niveau.id), ['debutant', 'intermediaire', 'avance', 'expert']);
});

test('au départ : les Débutant ouverts, le reste fermé ; au profil Formateur tout est ouvert', () => {
  const P = prog();
  for (const ch of CHAPTERS) {
    const N = etatNiveaux(ch.id, P);
    assert.ok(N[0].ouvert && N.slice(1).every((x) => !x.ouvert), `${ch.id} : seul le premier niveau est ouvert`);
    assert.ok(etatNiveaux(ch.id, P, { libre: true }).every((x) => x.ouvert), `${ch.id} : libre`);
  }
  assert.ok(leconOuverte('reseau-modele', P) && !leconOuverte('reseau-nmos', P) && leconOuverte('reseau-nmos', P, { libre: true }));
  // les fondamentaux d'abord : la première leçon Débutant du premier chapitre
  assert.deepEqual(suivante(P), { id: PARCOURS.signal.debutant[0], raison: 'commencer' });
});

test('une leçon : étoiles (quiz, exercice réussi, exercice presque parfait) et terminée', () => {
  const id = 'signal-422';
  assert.deepEqual(etatLecon(id, prog()), { quiz: false, exo: null, seul: false, etoiles: 0, terminee: false, aExo: true });
  assert.equal(etatLecon(id, prog({ [id]: null })).etoiles, 1, 'quiz seul');
  assert.equal(etatLecon(id, prog({ [id]: 59 })).terminee, false, 'exercice sous le seuil');
  assert.equal(etatLecon(id, prog({ [id]: 60 })).etoiles, 2);
  assert.equal(etatLecon(id, prog({ [id]: 95 })).etoiles, 3);
  // un exercice réussi sans le quiz : pas terminée
  const p = prog(); p.cours[id] = { seen: true, quiz: { score: 2, total: 3 }, exo: { best: 100, seul: true, n: 1 } };
  assert.ok(!etatLecon(id, p).terminee && etatLecon(id, p).etoiles === 2);
});

test('un niveau s\'ouvre quand le précédent est validé : leçons terminées et moyenne des exercices', () => {
  const deb = PARCOURS.signal.debutant;
  // tout terminé, mais avec beaucoup d'aide : la moyenne manque, le niveau suivant reste fermé
  const faible = prog(tout(deb, 62));
  let N = etatNiveaux('signal', faible);
  assert.ok(N[0].terminees === deb.length && N[0].moyenne < SEUIL_MOYENNE && !N[0].valide && !N[1].ouvert);
  assert.deepEqual(conditions(N[0]).map((c) => c.ok), [true, false]);
  assert.equal(suivante(faible).raison, 'ameliorer', 'refaire l\'exercice le plus faible');
  // un exercice refait sans aide fait passer la moyenne
  const bon = prog({ ...tout(deb, 62), [deb[0]]: 100, [deb[1]]: 90 });
  N = etatNiveaux('signal', bon);
  assert.ok(N[0].valide && N[1].ouvert && !N[2].ouvert);
  assert.ok(leconOuverte(PARCOURS.signal.intermediaire[0], bon));
  // les fondamentaux d'abord : le Débutant du chapitre suivant passe avant l'Intermédiaire du signal
  const s = suivante(bon);
  assert.equal(niveauDe(s.id).niveau.id, 'debutant');
  assert.equal(niveauDe(s.id).chapter.id, 'sdi');
  const b = bilanChapitre('signal', bon);
  assert.equal(b.courant.niveau.id, 'intermediaire');
  assert.equal(b.terminees, deb.length);
});

test('test de niveau : couvre les niveaux sautés, 6 à 12 questions, réussi à 80 %, ouvre le niveau', () => {
  const P = prog();
  assert.deepEqual(leconsDuTest('reseau', 'intermediaire', P), PARCOURS.reseau.debutant);
  const tous = leconsDuTest('reseau', 'expert', P);
  assert.equal(tous.length, PARCOURS.reseau.debutant.length + PARCOURS.reseau.intermediaire.length + PARCOURS.reseau.avance.length);
  const rnd = mulberry32(3);
  const t1 = tirerTest(PARCOURS.reseau.debutant, rnd);
  assert.ok(t1.length >= TEST_MIN && t1.length <= TEST_MAX);
  assert.equal(new Set(t1.map((q) => q.lesson + ':' + q.i)).size, t1.length, 'pas deux fois la même question');
  assert.ok(PARCOURS.reseau.debutant.every((id) => t1.some((q) => q.lesson === id)), 'chaque leçon sautée est interrogée');
  assert.equal(tirerTest(tous, rnd).length, TEST_MAX);
  assert.equal(tirerTest(['synchro-timecode'], rnd).length, Math.min(TEST_MIN, lessonById('synchro-timecode').lesson.quiz.length), 'une seule leçon : six questions de sa banque au plus');
  assert.ok(testPasse(8, 10) && !testPasse(7, 10) && aReussir(10) === 8 && aReussir(6) === 5);
  // le test réussi pour l'Avancé du réseau valide (par le test) le Débutant et l'Intermédiaire
  const T = prog({}, { reseau: { avance: { score: 10, total: 12 } } });
  const N = etatNiveaux('reseau', T);
  assert.ok(N[0].parTest && N[1].parTest && N[0].valide && N[1].valide && N[2].ouvert && !N[3].ouvert);
  assert.deepEqual(leconsDuTest('reseau', 'expert', T), PARCOURS.reseau.avance, 'les niveaux déjà validés ne sont plus interrogés');
  // un test raté n'ouvre rien
  const R = prog({}, { reseau: { intermediaire: { score: 6, total: 10 } } });
  assert.ok(!etatNiveaux('reseau', R)[1].ouvert);
});
