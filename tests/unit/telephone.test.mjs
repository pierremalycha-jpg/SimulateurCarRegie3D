// Le téléphone : la transformation projective qui pose l'écran HTML sur la vitre (au repos, un simple
// déplacement à l'échelle 1 ; basculé, chaque coin à sa place)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cssProjection } from '../../src/telephone/modele.js';

/** applique le matrix3d (colonnes) à un point (x, y) du plan de l'élément */
function apply(css, x, y) {
  const m = css.slice(9, -1).split(',').map(Number);
  const X = m[0] * x + m[4] * y + m[12], Y = m[1] * x + m[5] * y + m[13], W = m[3] * x + m[7] * y + m[15];
  return [X / W, Y / W];
}

test('au repos : un simple déplacement, à l\'échelle 1 (texte net)', () => {
  const css = cssProjection(340, 740, [[1000, 120], [1340, 120], [1000, 860], [1340, 860]]);
  const m = css.slice(9, -1).split(',').map(Number);
  assert.deepEqual(m.map((v) => Math.round(v * 1e6) / 1e6), [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1000, 120, 0, 1]);
});

test('téléphone basculé : chaque coin de l\'écran arrive sur l\'image du coin de la vitre', () => {
  const q = [[1012, 210], [1318, 190], [1040, 870], [1350, 905]];
  const css = cssProjection(340, 740, q);
  const src = [[0, 0], [340, 0], [0, 740], [340, 740]];
  src.forEach(([x, y], i) => { const [X, Y] = apply(css, x, y); assert.ok(Math.abs(X - q[i][0]) < 1e-3 && Math.abs(Y - q[i][1]) < 1e-3, `coin ${i} : ${X}, ${Y}`); });
});
