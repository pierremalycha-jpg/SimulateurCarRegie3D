// Section Cours : les chapitres et leurs leçons (forme d'une leçon, quiz de trois questions), les
// liens avec le reste (glossaire → leçon ou fiche « ? », poste → leçon) et le rattachement des
// leçons aux compétences du référentiel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { CHAPTERS, allLessons, lessonById } from '../../src/cours/index.js';
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
  for (const { chapter, lesson } of allLessons()) {
    assert.ok(!ids.has(lesson.id), `${lesson.id} : identifiant en double`); ids.add(lesson.id);
    assert.ok(lesson.id.startsWith(chapter.id + '-'), `${lesson.id} : préfixe du chapitre ${chapter.id}`);
    assert.ok(lesson.title && lesson.body && lesson.essentials.length >= 1 && lesson.essentials.length <= 3, `${lesson.id} : titre, explication, essentiel en 3 lignes`);
    assert.equal(lesson.quiz.length, 3, `${lesson.id} : trois questions`);
    for (const q of lesson.quiz) {
      assert.ok(q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length && q.q && q.why, `${lesson.id} : question « ${q.q} »`);
    }
    for (const t of lesson.terms || []) assert.ok(TERMS[t], `${lesson.id} : fiche « ? » inconnue ${t}`);
    assert.ok(typeof lesson.figure === 'function' || typeof lesson.demo === 'function', `${lesson.id} : un schéma ou une manipulation`);
  }
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
  assert.equal(posteCible('cadreur'), '');
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
