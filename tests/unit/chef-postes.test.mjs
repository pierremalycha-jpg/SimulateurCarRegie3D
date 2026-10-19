// Chef de car, parcours de tous les postes : structure de chaque parcours (étapes, textes,
// questions, « Fais-le pour moi »), puis rejeu de bout en bout sans navigateur de ceux qui ne
// dépendent que de l'état du simulateur. Les gestes purement d'interface (rendu de l'image,
// boutons de la page, atelier, intercom) sont rejoués par le test de bout en bout chef-postes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useHeadless, TUTOR } from '../helpers/tutor.mjs';
import { S } from '../../src/state.js';
import { loadPreset } from '../../src/bcam.js';
import { defaultRouting, updateMixer, MIX } from '../../src/pipeline.js';
import { registerLessons, startLesson, step, check, next, doForMe, answer, isAction, ctx, val } from '../../src/tutor/engine.js';
import { ALL_STATION_LESSONS } from '../../src/tutor/lessons/index.js';
import { clearFaults } from '../../src/faults.js';
import { PROG } from '../../src/shared.js';

registerLessons(ALL_STATION_LESSONS);
useHeadless();
const bad = (t) => !t || t.length < 8 || /undefined|NaN|\[object|null\b/.test(t);

test('chaque parcours est complet : étapes uniques, textes, actions faisables, questions valides', () => {
  if (!S.cams.length) loadPreset('standard', false);
  const ids = new Set();
  for (const l of ALL_STATION_LESSONS) {
    assert.ok(!ids.has(l.id), 'parcours en double : ' + l.id); ids.add(l.id);
    assert.ok(l.title && l.summary && l.duration && l.level && l.domain, l.id);
    assert.ok(l.steps.length >= 4, `${l.id} : au moins 4 étapes`);
    const steps = new Set();
    for (const s of l.steps) {
      assert.ok(!steps.has(s.id), `${l.id} : étape en double ${s.id}`); steps.add(s.id);
      assert.ok(s.title && s.say, `${l.id}/${s.id}`);
      if (s.done) assert.ok(s.do && s.auto, `${l.id}/${s.id} : une action a un geste demandé et un « Fais-le pour moi »`);
      if (s.quiz) { assert.ok(s.quiz.choices.length >= 2 && s.quiz.answer >= 0 && s.quiz.answer < s.quiz.choices.length && s.quiz.why, `${l.id}/${s.id} : question`); }
    }
    assert.ok(l.steps.some((s) => s.done), `${l.id} : au moins une action`);
    assert.ok(l.steps.some((s) => s.quiz), `${l.id} : au moins une question`);
  }
  assert.ok(ALL_STATION_LESSONS.length >= 25);
});

// postes couverts : chaque poste du car a au moins un parcours pratique
test('chaque poste du car a son parcours pratique', () => {
  const st = new Set(ALL_STATION_LESSONS.flatMap((l) => l.stations));
  for (const id of ['melangeur', 'realisateur', 'scripte', 'habillage', 'producteur', 'chefdecar', 'vision', 'evs', 'ipdirector', 'son', 'hf', 'grille', 'brassage', 'ccu', 'synchro', 'transmission', 'intercom']) assert.ok(st.has(id), 'poste sans parcours : ' + id);
});

// rejoue un parcours avec « Fais-le pour moi » ; les transitions du mélangeur avancent comme dans la boucle
function replay(id) {
  startLesson(id);
  const texts = []; const stuck = [];
  for (let guard = 0; guard < 80 && TUTOR.lesson; guard++) {
    const s = step();
    const c = ctx();
    texts.push(val(s.say, c)); if (s.do) texts.push(val(s.do, c));
    check();
    if (s.quiz) answer(s.quiz.answer);
    else if (isAction(s) && !TUTOR.done) { doForMe(); for (let k = 0; k < 4 && MIX.auto; k++) updateMixer(1); check(); }
    if (!TUTOR.done) { stuck.push(s.id); break; }
    if (s.ok && TUTOR.done) texts.push(val(s.ok, c));
    next();
  }
  return { stuck, texts };
}
const HEADLESS = ['melangeur-commuter', 'melangeur-incrustations', 'realisateur-ordres', 'scripte-notes', 'production-suivi', 'vision-balance', 'ccu-depannage', 'cadreur-cadrer',
  'evs-ralenti', 'evs-clips', 'ipdirector-clips', 'son-tranche', 'son-departs', 'hf-liaisons', 'synchro-reference', 'grille-routage', 'brassage-cordons', 'transmission-secours',
  'chef-depannage', 'chef-cablage', 'materiel-camera', 'materiel-synchro', 'materiel-evs', 'materiel-grille', 'materiel-pied-de-car'];
for (const id of HEADLESS) {
  test(`parcours ${id} : rejoué de bout en bout`, () => {
    S.ipMode = false; S.mode = 'fps';
    if (!S.cams.length) loadPreset('standard', false);
    defaultRouting(true); clearFaults();
    S.simTime = Math.max(S.simTime || 0, 120);
    S.sceneCCT = S.sceneCCT || 5600; // lumière du jour, comme à l'ouverture d'une partie
    const { stuck, texts } = replay(id);
    assert.deepEqual(stuck, [], 'étapes bloquées');
    assert.equal(TUTOR.lesson, null, 'parcours terminé');
    assert.ok(PROG.tutor[id] && PROG.tutor[id].done);
    for (const t of texts) assert.ok(!bad(t), `${id} : texte « ${t} »`);
  });
}
