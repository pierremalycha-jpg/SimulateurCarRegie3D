// Exercices en autonomie du Cours (v19.18) : chaque leçon a le sien ; chaque tirage donne des questions bien
// formées (énoncé, deux aides, solution, réponse juste acceptée par la vérification) ; les points (aides,
// erreurs, solution), le score sur 100, la lecture des nombres à la française.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { allLessons } from '../../src/cours/index.js';
import { EXOS, exoOf, verifier, pointsItem, scoreExo, tirage, lireNombre, reponse, seul, SEUIL_EXO, etatVide } from '../../src/cours/exo.js';
import { mulberry32 } from '../../src/util.js';

const texte = (c) => (Array.isArray(c) ? c[0] : c);

test('chaque leçon a son exercice en autonomie, et chaque exercice une leçon', () => {
  const ids = new Set(allLessons().map(({ lesson }) => lesson.id));
  const sans = [...ids].filter((id) => !exoOf(id));
  assert.deepEqual(sans, [], 'leçons sans exercice');
  for (const id of Object.keys(EXOS)) assert.ok(ids.has(id), `exercice sans leçon : ${id}`);
});

test('chaque tirage : trois à cinq questions bien formées, la réponse juste est acceptée', () => {
  for (const [id, X] of Object.entries(EXOS)) {
    assert.ok(X.titre && X.consigne && typeof X.gen === 'function', `${id} : titre, consigne, gen`);
    const vus = new Set();
    for (let s = 1; s <= 40; s++) {
      const { items, vues } = tirage(X, mulberry32(s * 7919 + id.length));
      assert.ok(items.length >= 3 && items.length <= 5, `${id} : ${items.length} questions`);
      items.forEach((it, k) => {
        const where = `${id} (tirage ${s}, question ${k + 1})`;
        assert.ok(['nombre', 'choix', 'texte', 'ordre'].includes(it.type), `${where} : type ${it.type}`);
        assert.ok(typeof it.q === 'string' && it.q.length > 10 && !/undefined|NaN/.test(it.q), `${where} : énoncé « ${it.q} »`);
        assert.ok(Array.isArray(it.aides) && it.aides.length === 2 && it.aides.every((a) => typeof a === 'string' && a.length > 8 && !/undefined|NaN/.test(a)), `${where} : deux aides`);
        assert.ok(typeof it.solution === 'string' && it.solution.length > 8 && !/undefined|NaN/.test(it.solution), `${where} : solution`);
        vus.add(it.q);
        if (it.type === 'nombre') {
          assert.ok(Number.isFinite(it.answer), `${where} : réponse numérique`);
          assert.ok(verifier(it, String(it.answer)).ok, `${where} : la valeur juste est acceptée`);
          assert.ok(verifier(it, String(it.answer).replace('.', ',')).ok, `${where} : écrite à la française`);
          for (const p of it.pieges || []) assert.ok(!verifier(it, String(p.v)).ok, `${where} : le piège ${p.v} n'est pas la bonne réponse`);
        }
        if (it.type === 'choix') {
          assert.ok(it.choices.length >= 3 && it.answer >= 0 && it.answer < it.choices.length, `${where} : trois choix au moins`);
          assert.equal(new Set(it.choices.map(texte)).size, it.choices.length, `${where} : choix en double`);
          assert.ok(verifier(it, it.answer).ok && !verifier(it, (it.answer + 1) % it.choices.length).ok, `${where} : vérification`);
          assert.deepEqual([...vues[k]].sort(), it.choices.map((_, c) => c), `${where} : ordre d'affichage`);
        }
        if (it.type === 'texte') {
          const acc = [].concat(it.accept || []);
          assert.ok(acc.length && acc.every((a) => verifier(it, a).ok), `${where} : réponses acceptées`);
          for (const p of it.pieges || []) assert.ok(!verifier(it, String(p.v)).ok, `${where} : le piège ${p.v} n'est pas accepté`);
        }
        if (it.type === 'ordre') {
          assert.ok(it.items.length >= 3 && new Set(it.items).size === it.items.length, `${where} : trois étapes au moins, différentes`);
          assert.ok(verifier(it, it.items.map((_, j) => j)).ok, `${where} : le bon ordre`);
          assert.ok(vues[k].some((x, j) => x !== j), `${where} : affiché mélangé`);
        }
        assert.ok(reponse(it).length > 0, `${where} : réponse écrite`);
      });
    }
    // refaire, c'est refaire avec d'autres valeurs ou d'autres situations
    assert.ok(vus.size >= 6, `${id} : ${vus.size} énoncés différents sur 40 tirages`);
  }
});

test('points : aides, erreurs, solution ; score sur 100', () => {
  const n = { type: 'nombre', q: 'question', answer: 2.97, aides: ['a', 'b'], solution: 's' };
  const c = { type: 'choix', q: 'question', choices: ['a', 'b', 'c'], answer: 0, aides: ['a', 'b'], solution: 's' };
  assert.equal(pointsItem(n, { ok: true, erreurs: 0, aides: 0, solution: false }), 1);
  assert.equal(pointsItem(n, { ok: true, erreurs: 1, aides: 1, solution: false }), 0.5);
  assert.equal(pointsItem(n, { ok: true, erreurs: 0, aides: 2, solution: true }), 0, 'solution demandée : rien');
  assert.equal(pointsItem(c, { ok: true, erreurs: 1, aides: 0, solution: false }), 0.5, 'une erreur sur un choix coûte la moitié');
  assert.equal(pointsItem(c, { ok: true, erreurs: 2, aides: 0, solution: false }), 0);
  assert.equal(pointsItem(n, etatVide()), 0, 'pas encore résolue');
  // au hasard sur trois choix, on ne réussit pas en moyenne
  const auHasard = (pointsItem(c, { ok: true, erreurs: 0, aides: 0, solution: false }) + pointsItem(c, { ok: true, erreurs: 1, aides: 0, solution: false }) + pointsItem(c, { ok: true, erreurs: 2, aides: 0, solution: false })) / 3;
  assert.ok(auHasard * 100 < SEUIL_EXO);
  const items = [n, n, c, n];
  const etats = [{ ok: true, erreurs: 0, aides: 0, solution: false }, { ok: true, erreurs: 0, aides: 1, solution: false }, { ok: true, erreurs: 0, aides: 0, solution: false }, { ok: true, erreurs: 0, aides: 2, solution: true }];
  assert.equal(scoreExo(items, etats), Math.round(100 * (1 + 0.75 + 1 + 0) / 4));
  assert.ok(!seul(etats) && seul(etats.slice(0, 3)));
});

test('vérification : nombres à la française, textes sans casse ni accents, ordre', () => {
  assert.equal(lireNombre('2,97'), 2.97); assert.equal(lireNombre('1 485'), 1485); assert.equal(lireNombre('2.97 Gb/s'), 2.97); assert.ok(Number.isNaN(lireNombre('beaucoup')));
  const n = { type: 'nombre', q: 'q', answer: 1.485, tol: 0.01, aides: ['', ''], solution: '', pieges: [{ v: 2.97, why: 'le 3G' }] };
  assert.ok(verifier(n, '1,49').ok && !verifier(n, '1,6').ok);
  assert.deepEqual(verifier(n, '2,97'), { ok: false, why: 'le 3G' });
  assert.ok(verifier(n, '').vide, 'rien d\'écrit : pas une erreur');
  const t = { type: 'texte', q: 'q', accept: ['192.168.1.255'], forme: 'ip', aides: ['', ''], solution: '' };
  assert.ok(verifier(t, ' 192.168.1.255 ').ok && !verifier(t, '192.168.1.0').ok);
  const m = { type: 'texte', q: 'q', accept: ['Préampli'], aides: ['', ''], solution: '' };
  assert.ok(verifier(m, 'preampli').ok && verifier(m, '  PRÉAMPLI ').ok);
  const o = { type: 'ordre', q: 'q', items: ['a', 'b', 'c'], aides: ['', ''], solution: '' };
  assert.ok(verifier(o, [0, 1, 2]).ok && !verifier(o, [1, 0, 2]).ok);
});
