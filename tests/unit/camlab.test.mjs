// Module « La caméra » : les 51 notions et leurs fiches (structure, liens, questions), les
// pastilles de la caméra 3D, et le modèle d'optique qui fait tourner les manipulations.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIONS, CHAPITRES, ORDRE, notionsDu } from '../../src/camlab/notions/index.js';
import { PASTILLES, notionsAt } from '../../src/camlab/points.js';
import { FIGS } from '../../src/camlab/figs.js';
import { LABS } from '../../src/camlab/labs.js';
import { LENS, COC, MIRE_D, ND, defocus, sharp, focusDist, focusPos, zoomFocal, zoomPos, maxAperture, effAperture, exposureOf, vfov } from '../../src/camlab/optics.js';

const bad = (t) => !t || /undefined|NaN|\[object|null\b/.test(t);

test('les 51 notions, rangées en 9 chapitres, 12 dans le premier lot', () => {
  assert.equal(ORDRE.length, 51);
  assert.deepEqual(CHAPITRES.map((c) => c.n), [1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(ORDRE.filter((id) => NOTIONS[id].lot === 1).length, 12);
  for (const c of CHAPITRES) assert.ok(notionsDu(c.n).length >= 2, `chapitre ${c.n} : au moins deux notions`);
  for (const id of ORDRE) {
    const f = NOTIONS[id];
    assert.ok(f.t && !bad(f.t), id);
    assert.ok(f.short && f.short.length > 40 && !bad(f.short), `${id} : l'essentiel en une phrase`);
    assert.ok([1, 2, 3].includes(f.lot), `${id} : lot`);
    if (f.chap < 9) assert.ok(PASTILLES.some((p) => p.id === f.point), `${id} : pastille ${f.point} inconnue`);
  }
});

test('chaque pastille ouvre au moins une notion, et ses notions existent', () => {
  const ids = new Set();
  for (const p of PASTILLES) {
    assert.ok(!ids.has(p.id), 'pastille en double : ' + p.id); ids.add(p.id);
    assert.ok(p.nom && (p.at || p.obj), p.id);
    assert.equal(p.n.length, 3); assert.equal(p.dir.length, 3); assert.ok(p.dist > 0.1 && p.dist < 3, p.id);
    const ns = notionsAt(p.id);
    assert.ok(ns.length >= 1, `${p.id} : aucune notion`);
    for (const n of ns) assert.ok(NOTIONS[n], `${p.id} : notion ${n} inconnue`);
  }
});

test('une fiche écrite suit le moule : schéma, manipulation, textes, trois questions valides, liens', () => {
  const ecrites = ORDRE.filter((id) => !NOTIONS[id].prevu);
  // le lot 1 est écrit en entier : ses douze notions ont une fiche, un schéma et une manipulation
  const lot1 = ORDRE.filter((id) => NOTIONS[id].lot === 1);
  assert.deepEqual(lot1.filter((id) => !ecrites.includes(id)), [], 'lot 1 : fiches en préparation');
  for (const id of lot1) assert.ok(NOTIONS[id].fig && NOTIONS[id].lab, `${id} : schéma et manipulation`);
  for (const id of ecrites) {
    const f = NOTIONS[id];
    for (const k of ['body', 'vraie', 'plus', 'car', 'ref']) assert.ok(f[k] && f[k].length > 60 && !bad(f[k]), `${id} : ${k}`);
    if (f.fig) assert.ok(FIGS[f.fig] && FIGS[f.fig]().includes('<svg'), `${id} : schéma ${f.fig}`);
    if (f.lab) assert.equal(typeof LABS[f.lab], 'function', `${id} : manipulation ${f.lab}`);
    assert.equal(f.quiz.length, 3, `${id} : trois questions`);
    for (const q of f.quiz) {
      assert.ok(q.q && q.a.length >= 3 && q.ok >= 0 && q.ok < q.a.length, `${id} : ${q.q}`);
      for (const [text, expl] of q.a) assert.ok(text && expl && !bad(text + expl), `${id} : réponse`);
    }
    // des bonnes réponses qui ne sont pas toujours à la même place
    if (f.quiz.length > 2) assert.ok(new Set(f.quiz.map((q) => q.ok)).size > 1, `${id} : bonnes réponses variées`);
    for (const s of f.see || []) assert.ok(NOTIONS[s] && s !== id, `${id} : voir aussi ${s}`);
    for (const c of f.competences || []) assert.match(c, /^[1-4]\.\d$/);
  }
});

test('optique : le zoom, la bague de point et le ramping du ZA12x4.5', () => {
  for (const f of [4.5, 8, 15, 30, 54]) assert.ok(Math.abs(zoomFocal(zoomPos(f)) - f) < 1e-9);
  for (const d of [0.3, 1, 3, 10]) assert.ok(Math.abs(focusDist(focusPos(d)) - d) < 1e-9);
  assert.equal(focusDist(0), Infinity);
  assert.equal(maxAperture(30), 1.8);
  assert.ok(Math.abs(maxAperture(54) - LENS.fLong) < 0.05, 'f/2,4 à 54 mm');
  assert.equal(maxAperture(30, true), 3.6, 'doubleur : deux diaphragmes');
  assert.ok(Math.abs(effAperture(1.8, 54) - maxAperture(54)) < 1e-9);
  assert.ok(vfov(4.5) > vfov(54));
  assert.equal(exposureOf(8), 1); assert.equal(exposureOf(4), 4); assert.equal(exposureOf(8, ND[2][1]), 1 / 16);
});

test('optique : le tirage se voit en large et se règle en deux passages', () => {
  const D = MIRE_D, delta = 0.09, N = 1.8;
  // point juste et tirage juste : net partout
  assert.equal(defocus(54, D, D, 0), 0);
  assert.ok(sharp(4.5, D, D, 0, N) && sharp(54, D, D, 0, N));
  // tirage faux : en serré, la bague de point rattrape l'erreur…
  const dF1 = 1 / (1 / (D * 1000) + delta / 54 ** 2) / 1000;
  assert.ok(Math.abs(defocus(54, D, dF1, delta)) < 1e-9);
  // … mais l'image décroche en large : la bague de point n'y agit presque plus (144 fois moins)
  assert.ok(!sharp(4.5, D, dF1, delta, N), 'flou en large');
  assert.ok(Math.abs(defocus(4.5, D, 5, 0) - defocus(4.5, D, 3, 0)) < COC, 'en large, la bague de point ne change presque rien');
  // premier passage en large à la bague F.f, puis retour en serré : il reste une erreur, un second passage l'annule
  const delta2 = delta - defocus(4.5, D, dF1, delta);
  assert.ok(Math.abs(defocus(4.5, D, dF1, delta2)) < 1e-12);
  assert.ok(!sharp(54, D, dF1, delta2, N), 'le serré a décroché : on recommence');
  const dF2 = 1 / (1 / (D * 1000) + delta2 / 54 ** 2) / 1000;
  const delta3 = delta2 - defocus(4.5, D, dF2, delta2);
  assert.ok(sharp(54, D, dF2, delta3, N) && sharp(4.5, D, dF2, delta3, N), 'deux passages suffisent');
  assert.ok(Math.abs(delta3) < 0.002);
});
