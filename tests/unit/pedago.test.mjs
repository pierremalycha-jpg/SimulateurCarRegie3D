// La démarche de chaque leçon (v19.30) : le point de départ (une situation dans le car, les objectifs, les leçons à
// connaître avant), « En clair » pour le débutant, « À retenir » et « Les pièges », « Pour aller plus loin » pour celui qui
// va vite ; un quiz gradué (questions de niveau 1 et 2 pour tous, un défi de niveau 3 facultatif) ; un exercice qui se
// retire à l'identique à partir de sa graine (le carnet de notes la garde). Le fil rouge passe par chaque leçon une fois.
// PEDAGO_CHAPITRES=camera,son limite la vérification de la forme des leçons à ces chapitres (pendant la rédaction).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { CHAPTERS, allLessons, lessonById, nivQ, indicesBase, indicesDefi, drawQuiz, QUIZ_N } from '../../src/cours/index.js';
import { exoOf } from '../../src/cours/exo.js';
import { filRouge, niveauxDe, suivante, PARCOURS } from '../../src/cours/parcours.js';
import { TOURS } from '../../src/cours/fil_rouge.js';
import { mulberry32 } from '../../src/util.js';

const FILTRE = (process.env.PEDAGO_CHAPITRES || '').split(',').map((s) => s.trim()).filter(Boolean);
const vise = ({ chapter }) => !FILTRE.length || FILTRE.includes(chapter.id);
const texte = (s, min = 1) => typeof s === 'string' && s.trim().length >= min && !/undefined|NaN|TODO/.test(s);

test('le fil rouge : chaque leçon une fois, tour après tour ; chaque étape a son récit', () => {
  const F = filRouge();
  const vus = F.flatMap((x) => x.lecons);
  assert.equal(new Set(vus).size, vus.length, 'une leçon dans deux étapes');
  assert.deepEqual([...vus].sort(), allLessons().map(({ lesson }) => lesson.id).sort(), 'toutes les leçons sont sur le fil');
  // une étape par chapitre et par tour ; les tours dans l'ordre des niveaux
  for (const ch of CHAPTERS) for (const n of niveauxDe(ch.id)) assert.equal(F.filter((x) => x.etape.chapitre === ch.id && x.tour.niveau === n.niveau.id).length, 1, `${ch.id} ${n.niveau.id}`);
  assert.deepEqual(F.map((x) => x.t), [...F.map((x) => x.t)].sort((a, b) => a - b));
  for (const x of F) assert.ok(texte(x.etape.titre, 4) && texte(x.etape.recit, 30), `${x.tour.niveau} ${x.etape.chapitre} : titre et récit`);
  // le premier tour commence par l'arrivée au car ; les autres finissent par l'exploitation
  assert.equal(TOURS[0].etapes[0].chapitre, 'exploitation');
  for (const t of TOURS.slice(1)) assert.equal(t.etapes[t.etapes.length - 1].chapitre, 'exploitation');
  // la première leçon conseillée est la première du fil
  assert.equal(suivante({}).id, F[0].lecons[0]);
});

test('chaque leçon : le point de départ, en clair, à retenir, les pièges, pour aller plus loin', () => {
  const ordre = filRouge().flatMap((x) => x.lecons);
  for (const f of allLessons().filter(vise)) {
    const L = f.lesson, w = L.id;
    assert.ok(Array.isArray(L.objectifs) && L.objectifs.length >= 2 && L.objectifs.length <= 4 && L.objectifs.every((t) => texte(t, 12)), `${w} : deux à quatre objectifs`);
    assert.ok(L.situation && texte(L.situation.texte, 60) && L.situation.texte.includes('?') && texte(L.situation.reponse, 60), `${w} : une situation qui pose une question, et sa réponse`);
    assert.ok(texte(L.analogie, 80), `${w} : « En clair », une image pour entrer dans la notion`);
    assert.ok(Array.isArray(L.retenir) && L.retenir.length >= 3 && L.retenir.length <= 5 && L.retenir.every((t) => texte(t, 10)), `${w} : trois à cinq points à retenir`);
    assert.ok(Array.isArray(L.pieges) && L.pieges.length >= 2 && L.pieges.length <= 3 && L.pieges.every((t) => texte(t, 20)), `${w} : deux ou trois pièges`);
    assert.ok(texte(L.plus, 200), `${w} : « Pour aller plus loin »`);
    assert.ok(Array.isArray(L.prerequis), `${w} : la liste des prérequis (vide pour une toute première leçon)`);
    for (const p of L.prerequis) {
      assert.ok(lessonById(p), `${w} : prérequis inconnu ${p}`);
      assert.ok(ordre.indexOf(p) < ordre.indexOf(w), `${w} : le prérequis ${p} vient plus tôt dans le fil rouge`);
    }
  }
});

test('chaque quiz est gradué : cinq questions de base au moins (deux de niveau 1), un défi de deux questions au moins', () => {
  for (const f of allLessons().filter(vise)) {
    const Q = f.lesson.quiz, w = f.lesson.id;
    for (const q of Q) assert.ok([1, 2, 3].includes(q.niv), `${w} : niveau de la question « ${q.q.slice(0, 60)} »`);
    const base = indicesBase(Q), defi = indicesDefi(Q);
    assert.ok(base.length >= 5, `${w} : cinq questions de base au moins (${base.length})`);
    assert.ok(base.filter((i) => nivQ(Q[i]) === 1).length >= 2, `${w} : deux questions de niveau 1 au moins`);
    assert.ok(defi.length >= 2, `${w} : un défi d'au moins deux questions (${defi.length})`);
    // le quiz ne pose que des questions de base, dont une de niveau 1 ; le défi, celles de niveau 3
    const rnd = mulberry32(3);
    for (let k = 0; k < 12; k++) {
      const d = drawQuiz(Q, [], rnd);
      assert.equal(d.length, QUIZ_N);
      assert.ok(d.every((x) => nivQ(Q[x.i]) <= 2) && d.some((x) => nivQ(Q[x.i]) === 1), `${w} : tirage du quiz`);
      assert.ok(drawQuiz(Q, [], rnd, { niv: 'defi' }).every((x) => nivQ(Q[x.i]) === 3), `${w} : tirage du défi`);
    }
  }
});

test('chaque exercice se retire à l\'identique à partir de sa graine', () => {
  const sansFn = (items) => JSON.stringify(items, (k, v) => (typeof v === 'function' ? undefined : v));
  for (const f of allLessons()) {
    const X = exoOf(f.lesson.id); if (!X) continue;
    for (const g of [1, 7, 123456789]) assert.equal(sansFn(X.gen(mulberry32(g))), sansFn(X.gen(mulberry32(g))), `${f.lesson.id} : graine ${g}`);
  }
});

test('le niveau Débutant de chaque chapitre est rangé dans PARCOURS', () => {
  for (const ch of CHAPTERS) assert.ok((PARCOURS[ch.id] || {}).debutant, `${ch.id} : niveau Débutant`);
});
