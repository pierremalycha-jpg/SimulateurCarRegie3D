// Le style graphique « dessin » (src/style.js) : rampe de lumière en paliers, morceaux de shader réécrits et rétablis
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { STYLE, celRamp, appliquerChunks, setStyle, typeOmbre } from '../../src/style.js';

test('la rampe : nulle dans l\'ombre, croissante, trois paliers (ombre, demi-teinte, lumière)', () => {
  assert.equal(celRamp(0), 0);
  let prev = -1; for (let x = 0; x <= 1.0001; x += 0.01) { const v = celRamp(x); assert.ok(v >= prev - 1e-9 && v <= 1, `croissante en ${x}`); prev = v; }
  // un palier : entre 0,1 et 0,25, la lumière varie peu (la demi-teinte), puis saute vers la pleine lumière
  assert.ok(celRamp(0.25) - celRamp(0.1) < 0.06, 'demi-teinte presque plate');
  assert.ok(celRamp(0.45) - celRamp(0.25) > 0.3, 'passage net à la lumière');
  assert.ok(celRamp(0.15) > 0.4 && celRamp(0.15) < 0.6);
  assert.ok(celRamp(0.8) > 0.9);
});

test('les morceaux de shader : la lumière directe des matières physiques et Lambert passe par la rampe, les ombres par celOmbre', () => {
  const orig = THREE.ShaderChunk.lights_physical_pars_fragment;
  const n = appliquerChunks(true);
  assert.ok(n >= 4, `remplacements faits : ${n}`);
  assert.match(THREE.ShaderChunk.lights_pars_begin, /float celRamp\(/);
  assert.match(THREE.ShaderChunk.lights_physical_pars_fragment, /celRamp\( saturate\( dot\( geometryNormal, directLight\.direction \) \) \)/);
  assert.match(THREE.ShaderChunk.lights_lambert_pars_fragment, /celRamp\(/);
  assert.equal((THREE.ShaderChunk.lights_fragment_begin.match(/celOmbre\( getShadow\(/g) || []).length, 2, 'soleil (directionnelles) et spots');
  appliquerChunks(false);
  assert.ok(!THREE.ShaderChunk.lights_pars_begin.includes('celRamp'), 'style réaliste : morceaux d\'origine rétablis');
  assert.notEqual(orig, null);
});

test('changer de style : type d\'ombre (clé des programmes) et matières à recompiler', () => {
  const sc = new THREE.Scene(); const m = new THREE.MeshStandardMaterial(); sc.add(new THREE.Mesh(new THREE.BoxGeometry(), m));
  const r = /** @type {any} */ ({ shadowMap: { type: 0, needsUpdate: false } });
  const v0 = m.version;
  setStyle(false, r, [sc]);
  assert.equal(STYLE.cel, false); assert.equal(r.shadowMap.type, THREE.PCFSoftShadowMap); assert.ok(m.version > v0);
  setStyle(true, r, [sc]);
  assert.equal(r.shadowMap.type, THREE.PCFShadowMap); assert.equal(typeOmbre(), THREE.PCFShadowMap);
  assert.match(THREE.ShaderChunk.lights_pars_begin, /celRamp/);
});
