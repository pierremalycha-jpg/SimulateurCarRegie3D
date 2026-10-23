// Mémoire 3D des caméras du stade (src/bcam.js) : une caméra retirée (relance d'une vacation, plan
// caméras, atelier, coopération) libère tout ce qu'elle a créé : géométries fusionnées, matières, texture
// de son étiquette, câble et tracé d'infrastructure, bras de grue, filins de la caméra sur câbles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import * as THREE from 'three';
import { S } from '../../src/state.js';
import { addCamera, removeCamera } from '../../src/bcam.js';
import { SLOTS } from '../../src/data/stadium.js';
import { CAMERA_TYPES } from '../../src/data/cameras.js';

/** ressources d'un objet (géométries, matières, textures), par parcours de l'arbre */
function ressources(root) {
  const out = new Set();
  root.traverse((o) => { if (o.geometry) out.add(o.geometry); for (const m of [].concat(o.material || [])) { out.add(m); if (m.map) out.add(m.map); } });
  return [...out];
}

test('une caméra retirée libère toutes ses géométries, matières et textures', () => {
  // un type de chaque modèle (caméra de stade, portable, grue, caméra sur câbles…), là où il peut se poser
  const types = Object.keys(CAMERA_TYPES);
  let n = 0;
  for (const type of types) {
    const slot = SLOTS.find((s) => !s.types || s.types.includes(type)) || SLOTS[0];
    const cam = addCamera({ type, slotId: slot.id });
    if (!cam) continue;
    n++;
    const res = [...ressources(cam.model.root), ...[cam.cable, cam.infraLine, cam.boom, cam.ropes].filter(Boolean).flatMap(ressources)];
    assert.ok(res.length >= 3, `${type} : un modèle avec ses ressources`);
    const libres = new Set();
    for (const r of res) r.addEventListener('dispose', () => libres.add(r));
    removeCamera(cam.id);
    const oubli = res.filter((r) => !libres.has(r)).map((r) => r.type || r.constructor.name);
    assert.deepEqual(oubli, [], `${type} : ressources non libérées`);
    assert.ok(!S.cams.includes(cam));
  }
  assert.ok(n >= 3, 'plusieurs modèles de caméra essayés');
  assert.ok(THREE.REVISION);
});
