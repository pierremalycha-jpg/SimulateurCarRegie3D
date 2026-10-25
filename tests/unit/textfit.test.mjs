// Texte ajusté des textures du monde : la police est réduite jusqu'à tenir, jamais coupée
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fitSize, fillFit, fillLines } from '../../src/textfit.js';

// contexte factice : un caractère = 0,5 × la taille de police
function ctx() {
  const g = { font: '', calls: [], measureText(t) { const px = Number(/(\d+(?:\.\d+)?)px/.exec(g.font)[1]); return { width: t.length * px * 0.5 }; }, fillText(t, x, y, mw) { g.calls.push({ t, x, y, mw, font: g.font }); }, strokeText() {} };
  return g;
}

test('fitSize : la taille d\'origine si le texte tient, réduite sinon', () => {
  const g = ctx();
  assert.equal(fitSize(g, 'ABCD', 1000, 100), 100); // 4 × 50 = 200 ≤ 1000
  const s = fitSize(g, 'TRIBUNE MAREK-XERCÈS', 400, 100); // 20 car. × 50 = 1000 > 400
  assert.ok(s < 100 && 20 * s * 0.5 <= 400, String(s));
  assert.ok(20 * s * 0.5 > 400 * 0.9, 'pas réduite plus que nécessaire');
});

test('fillFit : écrit le texte à la taille ajustée avec un maxWidth de garde', () => {
  const g = ctx();
  const s = fillFit(g, 'STADE BOLLAERT-DELELIS', 512, 300, 960, 150);
  assert.equal(g.calls.length, 1);
  assert.equal(g.calls[0].mw, 960);
  assert.ok('STADE BOLLAERT-DELELIS'.length * s * 0.5 <= 960);
});

test('fillFit : une taille plancher (min) est respectée', () => {
  const g = ctx();
  assert.equal(fitSize(g, 'X'.repeat(500), 10, 50, 700, 'f', 12), 12);
});

test('fillLines : toutes les lignes à la même taille, tenant en largeur et en hauteur', () => {
  const g = ctx();
  const s = fillLines(g, ['LOCAL TECHNIQUE TV', 'PRÉ-CÂBLAGE'], 512, 60, 300, 100, 80);
  assert.equal(g.calls.length, 2);
  assert.ok(s * 2 * 1.1 <= 100 + 1e-9);
  assert.ok('LOCAL TECHNIQUE TV'.length * s * 0.5 <= 300);
  assert.equal(g.calls[0].font, g.calls[1].font);
});
