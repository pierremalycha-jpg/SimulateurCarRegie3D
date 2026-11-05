// Le carnet de notes (v19.30, src/notes.js) : la note sur 20, la remise en forme d'un carnet lu, la fusion de deux
// appareils, la limite de taille, l'empreinte des questions ; son passage dans la progression (migration v11, fusion).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { note20, noteTexte, mention, normaliserNotes, mergeNotes, ajouterNote, empreinte, empreinteQ, NOTES_MAX, reponseCourte } from '../../src/notes.js';

test('la note sur 20, au dixième, et sa mention', () => {
  assert.equal(note20(2, 3), 13.3);
  assert.equal(note20(3, 3), 20);
  assert.equal(note20(75, 100), 15);
  assert.equal(note20(0, 3), 0);
  assert.equal(note20(5, 0), 0);
  assert.equal(note20(9, 3), 20, 'jamais plus de 20');
  assert.equal(noteTexte(13.3), '13,3 / 20');
  assert.equal(mention(16), 'très bien'); assert.equal(mention(9.9), 'à reprendre');
});

test('un carnet lu est remis en forme : lignes exploitables, sans doublon, dans l\'ordre, limité', () => {
  const ok = { k: 'quiz', id: 'signal-422', at: 2, s: 2, t: 3, q: [[0, 1, 'ab']] };
  const L = normaliserNotes([ok, { ...ok }, { k: 'inconnu', id: 'x', at: 1, s: 1, t: 1 }, { k: 'exo', id: 'signal-bits', at: 1, s: 80, t: 100, g: 42, r: [[100, 0, 0, 0, ['3']]] }, null, 'x', { k: 'quiz', id: 'a', at: 3, s: 1, t: 0 }]);
  assert.deepEqual(L.map((n) => n.id), ['signal-bits', 'signal-422']);
  assert.equal(L[0].g, 42);
  assert.deepEqual(normaliserNotes('pas un carnet'), []);
  const beaucoup = Array.from({ length: NOTES_MAX + 50 }, (_, i) => ({ k: 'quiz', id: 'l', at: i, s: 1, t: 3 }));
  const B = normaliserNotes(beaucoup);
  assert.equal(B.length, NOTES_MAX); assert.equal(B[0].at, 50, 'les plus anciens partent');
});

test('deux appareils : rien ne se perd, rien n\'est compté deux fois', () => {
  const a = [{ k: 'quiz', id: 'l1', at: 1, s: 1, t: 3 }, { k: 'exo', id: 'l1', at: 5, s: 60, t: 100 }];
  const b = [{ k: 'quiz', id: 'l1', at: 1, s: 1, t: 3 }, { k: 'test', id: 'son/intermediaire', at: 3, s: 5, t: 6 }];
  assert.deepEqual(mergeNotes(a, b).map((n) => `${n.k}:${n.at}`), ['quiz:1', 'test:3', 'exo:5']);
});

test('ajouter un essai à une progression ; empreintes stables', () => {
  const P = {};
  const n = ajouterNote(P, { k: 'defi', id: 'son-decibel', s: 1, t: 2 });
  assert.ok(n && n.at > 0 && P.notes.length === 1);
  assert.equal(ajouterNote(P, { k: 'defi', id: '', s: 1, t: 2 }), null, 'sans activité : rien');
  assert.equal(empreinte('abc'), empreinte('abc'));
  assert.notEqual(empreinte('abc'), empreinte('abd'));
  const Q = { q: 'Combien ?', choices: ['1', ['2', 'non'], '3'], answer: 0 };
  assert.notEqual(empreinteQ(Q), empreinteQ({ ...Q, answer: 1 }), 'la bonne réponse compte dans l\'empreinte');
  assert.equal(reponseCourte('  x'.padEnd(80, 'y')).length, 40);
});

test('la progression garde le carnet : migration v11 et fusion', async () => {
  const { migrateProgress, mergeProgress, PROG, PROG_VERSION } = await import('../../src/shared.js');
  assert.ok(PROG_VERSION >= 11);
  const m = migrateProgress({ v: 10, notes: [{ k: 'quiz', id: 'l', at: 1, s: 1, t: 3 }, { k: '?', id: 'l', at: 1, s: 1, t: 3 }], cours: { a: { defi: 'abîmé' }, b: { defi: { score: 1, total: 2 } } } });
  assert.equal(m.notes.length, 1); assert.equal(m.v, PROG_VERSION);
  assert.ok(!('defi' in m.cours.a) && m.cours.b.defi.total === 2);
  for (const k of Object.keys(PROG)) delete PROG[k];
  Object.assign(PROG, { v: PROG_VERSION, missions: {}, visited: {}, scenarios: [], reports: [], notes: [{ k: 'quiz', id: 'l', at: 1, s: 1, t: 3 }] });
  mergeProgress({ v: 11, notes: [{ k: 'exo', id: 'l', at: 2, s: 50, t: 100 }], cours: { l: { seen: true, quiz: null, defi: { score: 2, total: 2 }, dn: 3 } } });
  assert.equal(PROG.notes.length, 2);
  assert.deepEqual(PROG.cours.l.defi, { score: 2, total: 2 }); assert.equal(PROG.cours.l.dn, 3);
});
