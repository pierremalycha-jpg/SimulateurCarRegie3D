// Session à plusieurs : les « tranches » d'état (src/multi/slices.js) diffusées par le titulaire
// d'un rôle doivent se réappliquer à l'identique chez les autres, et les objectifs de rôle
// (src/multi/roles.js) se calculer sans erreur.
import '../helpers/scene.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { S, camById } from '../../src/state.js';
import { loadPreset, clearCameras } from '../../src/bcam.js';
import { MIX, EVS, ROUTER } from '../../src/pipeline.js';
import { AU } from '../../src/audio.js';
import { SLICES, sliceKey, allKeys } from '../../src/multi/slices.js';
import { ROLES_S } from '../../src/multi/session.js';
import { objectives, ROLE_BRIEF } from '../../src/multi/roles.js';

loadPreset('standard', true);

// ce que reçoit un autre joueur : du JSON
const wire = (v) => JSON.parse(JSON.stringify(v));
const snap = (id, part) => wire(SLICES[id].multi ? SLICES[id].getPart(part) : SLICES[id].get());
const put = (id, v, part) => (SLICES[id].multi ? SLICES[id].applyPart(part, v) : SLICES[id].apply(v));

test('dispositif prédéfini posé', () => {
  assert.equal(S.cams.length, 12);
  assert.ok(S.cams.every((c) => c.slotId && c.lens));
});

test('chaque tranche se réapplique sans rien changer (idempotence)', () => {
  const before = allKeys();
  assert.ok(Object.keys(before).length > 20);
  for (const k of Object.keys(before)) {
    const [id, part] = k.split('/');
    put(id, JSON.parse(before[k]), part);
  }
  assert.deepEqual(allKeys(), before);
});

test('mélangeur : l\'état reçu remplace l\'état local', () => {
  const host = snap('mix');
  MIX.pgm = 5; MIX.pst = 6; MIX.dsk1.on = !MIX.dsk1.on;
  assert.notEqual(sliceKey('mix'), JSON.stringify(host));
  put('mix', host);
  assert.equal(sliceKey('mix'), JSON.stringify(host));
});

test('EVS : canaux de lecture et enregistrement', () => {
  const host = snap('evs');
  EVS.ch[0].speed = 0.33; EVS.ch[0].in = 12.5; EVS.ch[1].mode = 'play';
  put('evs', host);
  assert.equal(sliceKey('evs'), JSON.stringify(host));
});

test('grille, vision et son', () => {
  ROUTER.map.AUX_TX1 = 'PGM';
  const r = snap('router');
  ROUTER.map.AUX_TX1 = 'BARS'; put('router', r); assert.equal(sliceKey('router'), JSON.stringify(r));
  const c = S.cams[0], p = snap('cams', String(c.id));
  c.paint.iris = 16; c.paint.mblack = 12; c.paint.wbR = -30; put('cams', p, String(c.id));
  assert.equal(sliceKey('cams', String(c.id)), JSON.stringify(p));
  const ch = AU.order[0], a = snap('audio', ch);
  AU.ch[ch].fader = -40; AU.ch[ch].mute = !AU.ch[ch].mute; put('audio', a, ch);
  assert.equal(sliceKey('audio', ch), JSON.stringify(a));
  const bus = snap('audio', 'bus');
  AU.master.fader = -12; put('audio', bus, 'bus'); assert.equal(sliceKey('audio', 'bus'), JSON.stringify(bus));
});

test('dispositif caméras : un suivant reconstruit celui de l\'hôte', () => {
  const host = snap('rig');
  clearCameras();
  assert.equal(S.cams.length, 0);
  put('rig', host);
  assert.equal(sliceKey('rig'), JSON.stringify(host));
  // une caméra changée chez l'hôte (autre objectif) est remplacée, les autres restent
  const keep = camById(1);
  const moved = wire(host); moved.c[1][3] = 'UA125';
  put('rig', moved);
  assert.equal(camById(1), keep);
  assert.equal(camById(moved.c[1][0]).lens, 'UA125');
});

test('objectifs de chaque rôle : libellé, valeur, état', () => {
  for (const r of Object.keys(ROLES_S)) {
    const list = objectives(r);
    assert.ok(Array.isArray(list), r);
    for (const o of list) {
      assert.ok(o.label && typeof o.value === 'string', `${r} : ${JSON.stringify(o)}`);
      assert.ok([true, false, null].includes(o.ok), `${r} : ok = ${o.ok}`);
    }
    if (r !== 'observateur') assert.ok(list.length > 0 || r === 'cadreur', `${r} : au moins un objectif`);
    assert.ok(ROLE_BRIEF[r]);
  }
});
