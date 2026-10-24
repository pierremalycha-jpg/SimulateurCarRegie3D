// Les missions spécifiques du car (src/game/missions.js) : le catalogue (trois familles, chaque mission
// une fois, les tâches d'installation qui existent dans le car vide, les exercices d'Olivier qui existent),
// la préparation du car, ce qui est déjà fait, et quand on peut enchaîner sans recharger le stade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/dom.mjs';
import '../../src/cours/all.js';
import { registerLessons, lessonById } from '../../src/tutor/engine.js';
import { ALL_STATION_LESSONS } from '../../src/tutor/lessons/index.js';
import { NET_LESSONS } from '../../src/tutor/lessons/reseau.js';
import { FAMILLES, catalogue, missionById, dejaFaite, premiereAFaire, memeCar } from '../../src/game/missions.js';
import { MISSIONS } from '../../src/ui/guide.js';
import { allExercises, SPECIAL } from '../../src/cours/exercices.js';

registerLessons(ALL_STATION_LESSONS); registerLessons(NET_LESSONS);

test('le catalogue : trois familles, chaque mission une fois, rien hors du car', () => {
  const all = catalogue();
  assert.deepEqual(FAMILLES.map((f) => f.id), ['installer', 'postes', 'epreuves']);
  for (const f of FAMILLES) assert.ok(all.some((m) => m.famille === f.id), `la famille ${f.id} a des missions`);
  assert.equal(new Set(all.map((m) => m.id)).size, all.length, 'identifiants uniques');
  assert.ok(!all.some((m) => m.id === 'x-camera' || m.id === 'x-entrepot'), 'la caméra en 3D et l\'entrepôt ont leur propre écran');
  for (const m of all) assert.ok(m.titre && m.resume && m.duree && m.niveau && m.prepa && m.prepa.preset, m.id);
  assert.ok(missionById('i-reseau') && missionById('x-match') && missionById('vision-exposition'));
  assert.equal(missionById('nimporte'), null);
});

test('installer le car : chaque tâche est une mission du car vide, le car est préparé pour elle', () => {
  const ids = new Set(MISSIONS.map((m) => m.id));
  for (const m of catalogue().filter((x) => x.kind === 'install')) {
    assert.ok(m.taches && m.taches.length, m.id);
    for (const t of m.taches) assert.ok(ids.has(t), `${m.id} : la tâche ${t} existe`);
  }
  assert.equal(missionById('i-cameras').prepa.cams, 'none', 'le stade vide pour installer les caméras');
  assert.equal(missionById('i-reseau').prepa.reseauUsine, true);
  assert.equal(missionById('i-lineup').prepa.lineup, false);
  assert.equal(missionById('x-brassage').famille, 'installer', 'le brassage noté est une étape de l\'installation');
  assert.equal(missionById('x-reseau').prepa.ip, true);
});

test('aux postes : tous les exercices d\'Olivier rangés dans le Cours, groupés par chapitre, car IP si besoin', () => {
  const postes = catalogue().filter((m) => m.famille === 'postes');
  const attendus = allExercises().filter((x) => !SPECIAL[x.id]).map((x) => x.id);
  assert.deepEqual(postes.map((m) => m.id).sort(), [...new Set(attendus)].sort());
  for (const m of postes) { assert.ok(lessonById(m.id), m.id); assert.ok(m.groupe, `${m.id} : son chapitre`); }
  assert.equal(missionById('reseau-leaf').prepa.ip, true);
  assert.equal(missionById('videohub-routage').prepa.sdi, true);
});

test('déjà faite : les tâches du car vide, le parcours, l\'épreuve ; la première à proposer', () => {
  const P = { missions: {}, tutor: {} };
  assert.equal(dejaFaite(missionById('i-lineup'), P), false);
  P.missions = { m9: true, m10: true, m10b: true };
  assert.equal(dejaFaite(missionById('i-lineup'), P), true);
  assert.equal(premiereAFaire({ missions: {} }), 'i-cameras');
});

test('enchaîner sans recharger : seulement d\'un car prêt à un autre car prêt du même type', () => {
  const std = { preset: 'standard' }, ip = { preset: 'standard', ip: true }, sdi = { preset: 'standard', sdi: true };
  assert.equal(memeCar(std, std), true);
  assert.equal(memeCar(std, ip), false, 'passer en IP : on recharge');
  assert.equal(memeCar(ip, ip), true);
  assert.equal(memeCar(ip, sdi), false);
  assert.equal(memeCar(ip, std), true);
  assert.equal(memeCar(std, { preset: 'standard', lineup: false }), false);
  assert.equal(memeCar({ preset: 'standard', cams: 'none' }, std), false);
  assert.equal(memeCar(std, { preset: 'scenario' }), false);
});
