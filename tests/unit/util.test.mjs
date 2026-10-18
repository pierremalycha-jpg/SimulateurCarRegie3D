// Fonctions utilitaires pures (src/util.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clamp, lerp, smoothstep, wrapAngle, lerpAngle, dbToLin, linToDb, powDbToLin, linToPowDb, spring, mulberry32, tc, clockStr, mmss, fmt, kelvinRGBNorm } from '../../src/util.js';

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b} (±${eps})`);

test('clamp, lerp, smoothstep', () => {
  assert.equal(clamp(5, 0, 1), 1); assert.equal(clamp(-5, 0, 1), 0); assert.equal(clamp(0.4, 0, 1), 0.4);
  assert.equal(lerp(10, 20, 0.25), 12.5);
  assert.equal(smoothstep(0, 1, -1), 0); assert.equal(smoothstep(0, 1, 2), 1); assert.equal(smoothstep(0, 1, 0.5), 0.5);
});

test('angles : repli dans ]-π, π] et interpolation par le plus court chemin', () => {
  for (const a of [0, 1, -1, 3 * Math.PI, -7.5, 100]) { const w = wrapAngle(a); assert.ok(w >= -Math.PI && w <= Math.PI); near(Math.cos(w), Math.cos(a), 1e-9); }
  // de 170° à -170° : on passe par 180°, pas par 0°
  const d = Math.PI / 180;
  near(lerpAngle(170 * d, -170 * d, 0.5), 180 * d, 1e-9);
});

test('décibels : conversions inverses', () => {
  near(dbToLin(-6), 0.501187, 1e-6); near(linToDb(dbToLin(-23)), -23, 1e-9);
  near(powDbToLin(3), 1.995262, 1e-6); near(linToPowDb(powDbToLin(-10)), -10, 1e-9);
  assert.ok(Number.isFinite(linToDb(0)), 'silence : valeur finie (plancher), pas -Infinity');
});

test('ressort des mouvements de caméra : converge, léger dépassement seulement', () => {
  const st = { v: 0, vel: 0 };
  let max = 0;
  for (let i = 0; i < 600; i++) { spring(st, 1, 8, 1 / 60); max = Math.max(max, st.v); }
  near(st.v, 1, 1e-3);
  assert.ok(max < 1.2, `dépassement ${max}`); // un peu d'inertie, comme une tête fluide
});

test('générateur pseudo-aléatoire déterministe dans [0, 1[', () => {
  const a = mulberry32(42), b = mulberry32(42);
  const xs = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(xs.slice(0, 5), Array.from({ length: 5 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  const mean = xs.reduce((s, x) => s + x, 0) / xs.length;
  assert.ok(Math.abs(mean - 0.5) < 0.05, `moyenne ${mean}`);
});

test('timecode 25 i/s et horloges', () => {
  assert.equal(tc(0), '00:00:00:00');
  assert.equal(tc(3661 + 12 / 25), '01:01:01:12');
  assert.equal(tc(1 - 1 / 25), '00:00:00:24');
  assert.equal(tc(NaN), '--:--:--:--');
  assert.equal(tc(-3), '00:00:00:00');
  assert.equal(clockStr(3600 * 21 + 5 * 60 + 9.9), '21:05:09');
  assert.equal(mmss(125.7), '02:05');
});

test('format français : virgule décimale', () => {
  assert.equal(fmt(3.14159, 2), '3,14'); assert.equal(fmt(-23), '-23,0');
});

test('température de couleur : 5 600 K = référence neutre, tungstène plus chaud', () => {
  const ref = kelvinRGBNorm(5600); near(ref[0], 1, 1e-9); near(ref[2], 1, 1e-9);
  const tung = kelvinRGBNorm(3200); assert.ok(tung[0] > 1 && tung[2] < 1, 'à 3 200 K : plus de rouge, moins de bleu');
});
