// Section Cours : les chapitres et leurs leçons (forme d'une leçon, banque de questions du quiz et tirage), les
// liens avec le reste (glossaire → leçon ou fiche « ? », poste → leçon) et le rattachement des
// leçons aux compétences du référentiel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { CHAPTERS, allLessons, lessonById, drawQuiz, QUIZ_N } from '../../src/cours/index.js';
import { mulberry32 } from '../../src/util.js';
import { GLOSSAIRE, POSTES, premiere, cibleDuTerme, posteCible, titreDe, estLecon } from '../../src/cours/liens.js';
import { TERMS } from '../../src/content/netterms.js';
import { GLOSSARY } from '../../src/content/glossary.js';
import { STATION_LIST } from '../../src/content/stations.js';
import { RATTACHEMENT, COMPETENCES } from '../../src/content/referentiel.js';

// une cible peut être une leçon déjà écrite, une leçon annoncée (rattachée au référentiel) ou une fiche « ? »
const planned = new Set(Object.keys(RATTACHEMENT.cours));
const cible = (id) => !!(lessonById(id) || planned.has(id) || TERMS[id]);

test('chapitres dans l\'ordre pédagogique ; chaque leçon a sa forme', () => {
  assert.deepEqual(CHAPTERS.map((c) => c.id), ['signal', 'sdi', 'synchro', 'camera', 'realisation', 'ralentis', 'son', 'reseau', 'hf', 'exploitation']);
  const ids = new Set();
  // préfixe des leçons : l'id du chapitre, abrégé pour les plus longs
  const PREFIX = { realisation: 'real', exploitation: 'expl' };
  for (const { chapter, lesson } of allLessons()) {
    assert.ok(!ids.has(lesson.id), `${lesson.id} : identifiant en double`); ids.add(lesson.id);
    assert.ok(lesson.id.startsWith((PREFIX[chapter.id] || chapter.id) + '-'), `${lesson.id} : préfixe du chapitre ${chapter.id}`);
    assert.ok(lesson.title && lesson.body && lesson.essentials.length >= 1 && lesson.essentials.length <= 3, `${lesson.id} : titre, explication, essentiel en 3 lignes`);
    // une banque d'au moins cinq questions : le quiz en tire trois à chaque essai (QUIZ_N)
    assert.ok(lesson.quiz.length >= 5, `${lesson.id} : au moins cinq questions dans la banque`);
    assert.equal(new Set(lesson.quiz.map((q) => q.q)).size, lesson.quiz.length, `${lesson.id} : questions en double`);
    for (const q of lesson.quiz) {
      assert.ok(q.choices.length === 3 && q.answer >= 0 && q.answer < q.choices.length && q.q && q.why, `${lesson.id} : question « ${q.q} »`);
      const texts = q.choices.map((c) => (Array.isArray(c) ? c[0] : c));
      assert.equal(new Set(texts).size, texts.length, `${lesson.id} : choix en double dans « ${q.q} »`);
    }
    for (const t of lesson.terms || []) assert.ok(TERMS[t], `${lesson.id} : fiche « ? » inconnue ${t}`);
    assert.ok(typeof lesson.figure === 'function' || typeof lesson.demo === 'function', `${lesson.id} : un schéma ou une manipulation`);
  }
});

test('quiz : trois questions tirées, d\'autres au nouvel essai, réponses mélangées', () => {
  const bank = allLessons()[0].lesson.quiz;
  const rnd = mulberry32(7);
  const d1 = drawQuiz(bank, [], rnd);
  assert.equal(d1.length, QUIZ_N);
  assert.equal(new Set(d1.map((d) => d.i)).size, QUIZ_N, 'pas deux fois la même question');
  for (const d of d1) assert.deepEqual([...d.order].sort(), bank[d.i].choices.map((_, k) => k), 'l\'ordre des réponses est une permutation');
  // refaire : les questions pas encore posées passent d'abord
  const prev = d1.map((d) => d.i), d2 = drawQuiz(bank, prev, rnd);
  const fresh = bank.map((_, i) => i).filter((i) => !prev.includes(i));
  for (const i of fresh.slice(0, QUIZ_N)) assert.ok(d2.some((d) => d.i === i), `question ${i} pas encore posée`);
  // sur de nombreux tirages, la bonne réponse occupe chacun des trois rangs
  const rangs = new Set();
  for (let k = 0; k < 60; k++) for (const d of drawQuiz(bank, [], rnd)) rangs.add(d.order.indexOf(bank[d.i].answer));
  assert.deepEqual([...rangs].sort(), [0, 1, 2]);
  // une banque plus courte que QUIZ_N : toutes ses questions
  assert.equal(drawQuiz(bank.slice(0, 2), [], rnd).length, 2);
});

test('liens : glossaire → leçon ou fiche, poste → leçon, cibles existantes', () => {
  const terms = new Set(GLOSSARY.map(([t]) => t));
  for (const [t, ids] of Object.entries(GLOSSAIRE)) {
    if (!terms.has(t)) continue; // un terme du glossaire peut changer d'écriture : le lien dort
    for (const id of [].concat(ids)) assert.ok(cible(id), `${t} → ${id}`);
  }
  assert.ok(Object.keys(GLOSSAIRE).filter((t) => terms.has(t)).length >= 55, 'liens du glossaire');
  const stations = new Set(STATION_LIST.map(([id]) => id));
  for (const [id, p] of Object.entries(POSTES)) {
    assert.ok(stations.has(id), id);
    for (const k of Array.isArray(p) ? p : [...p.sdi, ...p.ip]) assert.ok(cible(k), `${id} → ${k}`);
  }
  assert.equal(cibleDuTerme('Truquiste'), '');
  assert.equal(cibleDuTerme('4:2:2'), 'signal-422');
  assert.ok(estLecon('signal-422') && !estLecon('ptp'));
  assert.equal(titreDe('signal-422'), 'L\'échantillonnage 4:2:2');
  assert.equal(premiere(['leçon-inconnue', 'ptp']), 'ptp');
  assert.ok(posteCible('vision') === 'signal-422');
  assert.equal(posteCible('cadreur'), 'camera-systeme');
  assert.equal(posteCible('truquiste-inconnu'), '');
  // seules des cibles existantes sont proposées
  for (const [t] of GLOSSARY) { const f = cibleDuTerme(t); if (f) assert.ok(lessonById(f) || TERMS[f], `${t} → ${f}`); }
});

test('référentiel : chaque leçon écrite est rattachée à des compétences connues', () => {
  const codes = new Set(COMPETENCES.map((c) => c.code));
  for (const { lesson } of allLessons()) {
    const list = RATTACHEMENT.cours[lesson.id];
    assert.ok(list && list.length, `${lesson.id} : sans compétence`);
    for (const c of list) assert.ok(codes.has(c), `${lesson.id} : compétence inconnue ${c}`);
  }
});

test('exercices pratiques : ids connus, chacun rangé une seule fois', async () => {
  const { allExercises, exerciseInfo, SPECIAL } = await import('../../src/cours/exercices.js');
  // les parcours d'Olivier s'enregistrent dans le moteur (comme le fait ui/tutor_ui.js au chargement)
  const { registerLessons } = await import('../../src/tutor/engine.js');
  const { ALL_STATION_LESSONS } = await import('../../src/tutor/lessons/index.js');
  const { NET_LESSONS } = await import('../../src/tutor/lessons/reseau.js');
  registerLessons([...NET_LESSONS, ...ALL_STATION_LESSONS]);
  const all = allExercises();
  const seen = new Map();
  for (const x of all) { assert.ok(exerciseInfo(x.id), `${x.lesson.id} : exercice inconnu ${x.id}`); seen.set(x.id, (seen.get(x.id) || 0) + 1); }
  for (const [id, n] of seen) assert.equal(n, 1, `${id} rangé ${n} fois`);
  for (const id of Object.keys(SPECIAL)) assert.ok(id.startsWith('x-'));
});
