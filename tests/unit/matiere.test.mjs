// Matières procédurales et géométrie : tuilage des cartes, boîtes arrondies, occlusion cuite
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { noise, fbm, normalsFromHeight, RECETTES, cartes, matiere, MATIERE } from '../../src/matiere.js';
import { roundedBox, bakeAO, Builder } from '../../src/geo.js';

test('le bruit périodique se referme sur lui-même (tuilable)', () => {
  for (const p of [8, 24, 96]) {
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * p, y = Math.random() * p;
      assert.ok(Math.abs(noise(x, y, p, 3) - noise(x + p, y, p, 3)) < 1e-9);
      assert.ok(Math.abs(noise(x, y, p, 3) - noise(x, y + 2 * p, p, 3)) < 1e-9);
    }
  }
  const a = fbm(0.17, 0.42, 16, 4, 2), b = fbm(1.17, 0.42, 16, 4, 2);
  assert.ok(Math.abs(a - b) < 1e-9);
  for (let i = 0; i < 50; i++) { const v = fbm(Math.random(), Math.random(), 12, 5, 1); assert.ok(v >= 0 && v <= 1); }
});

test('chaque recette donne un relief borné et tuilable, des cartes 8 bits', () => {
  for (const key of Object.keys(RECETTES)) {
    const R = RECETTES[key](1);
    assert.ok(R.k > 0 && R.scale > 0, key);
    for (let i = 0; i < 30; i++) { const h = R.h(Math.random(), Math.random()); assert.ok(Number.isFinite(h) && Math.abs(h) < 10, key + ' ' + h); }
    // tuilage : h(u, v) = h(u + 1, v) à l'échantillonnage près (recettes définies sur [0,1[ périodique)
    const u = 0.3137, v = 0.7721;
    assert.ok(Math.abs(R.h(u, v) - R.h(u + 1, v)) < 1e-6, key + ' tuilage u');
    assert.ok(Math.abs(R.h(u, v) - R.h(u, v + 1)) < 1e-6, key + ' tuilage v');
  }
  const c = cartes('tole', 1, 32);
  assert.equal(c.nrm.image.width, 32); assert.equal(c.srf.image.data.length, 32 * 32 * 4);
  assert.strictEqual(cartes('tole', 1, 32), c, 'mise en cache');
});

test('les normales d\'un champ plat pointent vers le haut, une pente les incline', () => {
  const n = 8; const flat = new Float32Array(n * n);
  const N = normalsFromHeight(flat, n, 2);
  assert.deepEqual([N[0], N[1], N[2]], [128, 128, 255]);
  const slope = new Float32Array(n * n); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) slope[y * n + x] = Math.sin(x / n * 2 * Math.PI);
  const M = normalsFromHeight(slope, n, 2);
  assert.ok(M[0] < 128, 'pente montante en x : composante x négative');
});

test('matiere() : matériau physique à couleurs par sommet, relief débrayable sans recompiler la scène', () => {
  const m = matiere('alu', { color: 0x808080 });
  assert.ok(m.isMeshStandardMaterial && m.vertexColors);
  assert.equal(m.metalness, 0.9);
  assert.ok(MATIERE.all.has(m));
  MATIERE.setDetail(false); assert.equal(m.userData.detailOn, false);
  MATIERE.setDetail(true); assert.equal(m.userData.detailOn, true);
  assert.notEqual(matiere('tole').customProgramCacheKey(), undefined);
});

test('roundedBox : dimensions respectées, arêtes creusées, normales unitaires', () => {
  const g = roundedBox(1, 0.5, 0.3, 0.05, 4);
  g.computeBoundingBox();
  const b = g.boundingBox;
  assert.ok(Math.abs(b.max.x - 0.5) < 1e-6 && Math.abs(b.min.y + 0.25) < 1e-6 && Math.abs(b.max.z - 0.15) < 1e-6);
  const p = g.attributes.position, n = g.attributes.normal;
  let corner = 0;
  for (let i = 0; i < p.count; i++) {
    const l = Math.hypot(n.getX(i), n.getY(i), n.getZ(i)); assert.ok(Math.abs(l - 1) < 1e-5);
    // aucun sommet au coin vif de la boîte pleine
    if (Math.abs(p.getX(i)) > 0.5 - 1e-6 && Math.abs(p.getY(i)) > 0.25 - 1e-6) corner++;
  }
  assert.equal(corner, 0);
  // avec une subdivision par axe
  const g2 = roundedBox(2, 0.1, 0.5, 0.01, 4, [16, 4, 6]);
  assert.ok(g2.attributes.position.count > g.attributes.position.count);
});

test('bakeAO : un sommet sous une boîte est plus sombre qu\'un sommet à découvert', () => {
  const geo = new THREE.PlaneGeometry(4, 4, 8, 8).toNonIndexed(); geo.rotateX(-Math.PI / 2);
  const n = geo.attributes.position.count;
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  // une boîte posée au-dessus du coin (x, z) ∈ [1, 2] à 10 cm du sol
  bakeAO(geo, [[1, 0.1, 1, 2, 1.1, 2]], { dist: 1.2 });
  const c = geo.attributes.color, p = geo.attributes.position;
  let under = 1, open = 1;
  for (let i = 0; i < n; i++) { const x = p.getX(i), z = p.getZ(i); if (x > 1.2 && x < 1.8 && z > 1.2 && z < 1.8) under = Math.min(under, c.getX(i)); if (x < -1.5 && z < -1.5) open = Math.min(open, c.getX(i)); }
  assert.ok(under < 0.6, 'sous la boîte : ' + under);
  assert.ok(open > 0.98, 'à découvert : ' + open);
});

test('Builder en mode ao : grandes faces subdivisées, occulteurs enregistrés, propre boîte ignorée', () => {
  const B = new Builder({ ao: 0.25 });
  B.box(2, 0.05, 2, 0, 0, 0, 0xffffff); // sol
  B.cbox(0.4, 0.4, 0.4, 0, 0.225, 0, 0xffffff, 0.02); // cube posé dessus
  assert.equal(B.occluders.length, 2);
  const g = B.build();
  assert.ok(g.attributes.position.count > 36 * 2);
  const c = g.attributes.color, p = g.attributes.position;
  let under = 1, far = 1, cubeTop = 1;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    if (Math.abs(y - 0.025) < 1e-3 && Math.abs(x) < 0.1 && Math.abs(z) < 0.1) under = Math.min(under, c.getX(i));
    if (Math.abs(y - 0.025) < 1e-3 && x > 0.85 && z > 0.85) far = Math.min(far, c.getX(i));
    if (y > 0.42 && Math.abs(x) < 0.05 && Math.abs(z) < 0.05) cubeTop = Math.min(cubeTop, c.getX(i));
  }
  assert.ok(under < 0.5, 'sous le cube : ' + under);
  assert.ok(far > 0.9, 'coin éloigné : ' + far);
  assert.ok(cubeTop > 0.97, 'dessus du cube non assombri par lui-même : ' + cubeTop);
});
