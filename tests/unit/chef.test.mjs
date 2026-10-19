// Chef de car : parcours rejoués de bout en bout sur le modèle réseau. Chaque action est faite
// par « fais-le pour moi » : si une commande donnée par le chef est fausse, ou si une condition
// de réussite ne peut pas être atteinte, le parcours reste bloqué et le test échoue.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshCar, useHeadless, replay, settle, TUTOR } from '../helpers/tutor.mjs';
import { FAB } from '../../src/net/fabric.js';
import { registerLessons, LESSONS, lessonById, ctx, val } from '../../src/tutor/engine.js';
import { NET_LESSONS } from '../../src/tutor/lessons/reseau.js';
import { stationLesson, stationIds } from '../../src/tutor/lessons/postes.js';
import { startLesson, goStep } from '../../src/tutor/engine.js';
import { S } from '../../src/state.js';
import { camPtpOk } from '../../src/net/fabric.js';
import { issuesOf, rxSummary, saved } from '../../src/tutor/net_helpers.js';
import { PROG } from '../../src/shared.js';

registerLessons(NET_LESSONS);
registerLessons(stationIds().map((id) => stationLesson(id, id === 'melangeur' || id === 'reseau')).filter(Boolean));
useHeadless();

test('mettre en service une leaf neuve : chaque étape se valide avec les commandes du chef', () => {
  freshCar();
  const texts = [];
  const stuck = replay('reseau-leaf', { onStep: (s) => { texts.push(val(s.say, ctx())); if (s.do) texts.push(val(s.do, ctx())); } });
  assert.deepEqual(stuck, [], 'étapes bloquées');
  assert.equal(TUTOR.lesson, null, 'parcours terminé');
  settle();
  assert.deepEqual(issuesOf('LEAF-R1').map((i) => i.title), [], 'plus aucune alarme sur la leaf');
  const r = rxSummary();
  assert.deepEqual(r.lost, []);
  assert.deepEqual(r.single, [], 'toutes les réceptions de nouveau protégées');
  assert.ok(saved('LEAF-R1'));
  assert.ok(PROG.tutor['reseau-leaf'].done);
  for (const t of texts) assert.ok(t && t.length > 10 && !/undefined|NaN|\[object/.test(t), 'texte : ' + t);
});

for (const id of ['reseau-visite', 'reseau-passerelle', 'reseau-ptp', 'reseau-depannage']) {
  test(`parcours ${id} : rejoué de bout en bout`, () => {
    freshCar();
    const texts = [];
    const stuck = replay(id, { onStep: (s) => { texts.push(val(s.say, ctx())); if (s.do) texts.push(val(s.do, ctx())); if (s.ok) texts.push(val(s.ok, ctx())); } });
    assert.deepEqual(stuck, [], 'étapes bloquées');
    assert.equal(TUTOR.lesson, null);
    settle();
    assert.deepEqual(rxSummary().lost, [], 'rien de perdu à la fin');
    assert.ok(S.cams.every((c) => camPtpOk(c.id)), 'caméras verrouillées');
    assert.ok(FAB.gm.gm1.up, 'grand maître 1 remis en service');
    for (const t of texts) assert.ok(t && t.length > 10 && !/undefined|NaN|\[object/.test(t), 'texte : ' + t);
  });
}

test('quitter en cours de route remet le réseau en état', async () => {
  const { startLesson, goStep, stopLesson } = await import('../../src/tutor/engine.js');
  freshCar();
  startLesson('reseau-ptp'); goStep(4); FAB.gm.gm1.up = false; settle();
  stopLesson(false, true); settle();
  assert.ok(FAB.gm.gm1.up);
  freshCar();
  startLesson('reseau-leaf'); goStep(1); goStep(5); settle();
  assert.ok(rxSummary().single.length > 0, 'leaf en usine');
  stopLesson(false, true); settle();
  assert.deepEqual(rxSummary().single, []);
  freshCar();
  startLesson('reseau-depannage'); goStep(1); settle();
  assert.ok(rxSummary().lost.length > 0, 'panne active');
  stopLesson(false, true); settle();
  assert.deepEqual(rxSummary().lost, []);
});

test('parcours : identifiants uniques, étapes complètes', () => {
  const ids = LESSONS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const l of LESSONS) {
    const sids = l.steps.map((s) => s.id);
    assert.equal(new Set(sids).size, sids.length, l.id + ' : étapes en double');
    for (const s of l.steps) {
      assert.ok(s.title && s.say, `${l.id}/${s.id}`);
      if (s.done) assert.ok(s.do, `${l.id}/${s.id} : une action dit ce qu'il faut faire`);
      if (s.done) assert.ok(s.auto, `${l.id}/${s.id} : une action a son « fais-le pour moi »`);
      if (s.quiz) assert.ok(s.quiz.choices[s.quiz.answer] && s.quiz.why, `${l.id}/${s.id} : question`);
    }
    assert.ok(lessonById(l.id));
  }
});

test('présentation de chaque poste : rôle, matériel, déroulé', () => {
  const ids = stationIds();
  assert.ok(ids.length >= 20);
  for (const id of ids) {
    const l = lessonById('poste-' + id);
    assert.ok(l, id);
    assert.ok(l.steps.some((s) => s.id === 'role'));
    for (const s of l.steps) assert.ok(val(s.say, ctx()).length > 20, `${id}/${s.id}`);
  }
});

test('étape « aller au poste » sautée quand on y est déjà', () => {
  const io = TUTOR.io;
  io.go({ station: 'melangeur' });
  startLesson('poste-melangeur');
  assert.equal(TUTOR.lesson.steps[TUTOR.i].id, 'role', 'on commence directement par le rôle');
  goStep(0, -1);
  assert.equal(TUTOR.lesson.steps[TUTOR.i].id, 'open', 'en revenant en arrière jusqu\'au début, l\'étape reste accessible');
  io.go({ station: 'reseau' });
});

test('passerelle : quitter en cours de route la remet dans sa configuration du car', async () => {
  const { startLesson, goStep, stopLesson } = await import('../../src/tutor/engine.js');
  freshCar();
  const ip = FAB.devices.gwstade.nics.red.ip;
  startLesson('reseau-passerelle'); goStep(3); settle();
  assert.ok(!FAB.res.reg.gwstade, 'sortie d\'usine : plus enregistrée');
  stopLesson(false, true); settle();
  assert.equal(FAB.devices.gwstade.nics.red.ip, ip);
  assert.ok(FAB.res.reg.gwstade && FAB.res.devPtp.gwstade.state === 'locked');
  assert.ok(FAB.res.rxState.AUX_GIANT.ok && !FAB.rxManual.AUX_GIANT);
});
