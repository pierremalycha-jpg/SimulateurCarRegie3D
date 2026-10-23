// Ce que le joueur entend selon l'endroit (src/audio.js : ecoute, volumeLin) : la foule reste dans le
// stade, l'écoute de la console au poste son, presque rien ailleurs dans le car, silence à l'accueil.
import '../helpers/scene.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ecoute, EAR, volumeLin } from '../../src/audio.js';

const OFF = EAR.off;

test('écran d\'accueil : silence', () => {
  const e = ecoute({ mode: 'start' });
  assert.equal(e.mon, OFF); assert.equal(e.stade, OFF);
});

test('poste son : l\'écoute de la console seule, pas la foule en direct', () => {
  const e = ecoute({ mode: 'station', station: 'son', inTruck: true, cabin: true });
  assert.equal(e.mon, EAR.mon); assert.equal(e.monHz, 20000); assert.equal(e.stade, OFF);
});

test('dans le car : la cabine son de loin, presque rien ailleurs', () => {
  const cab = ecoute({ mode: 'fps', inTruck: true, cabin: true });
  const autre = ecoute({ mode: 'station', station: 'vision', inTruck: true });
  assert.ok(cab.mon < EAR.mon - 6 && cab.mon > EAR.mon - 20, 'la cabine : les haut-parleurs du son, plus loin');
  assert.ok(autre.mon <= EAR.mon - 25, 'un autre poste : l\'écoute du son à travers la cloison');
  assert.ok(autre.monHz < 1500, 'la cloison coupe les aigus');
  assert.ok(autre.stade <= EAR.stade - 30, 'la foule ne traverse pas l\'isolation du car');
});

test('dehors : la foule entière dans la cuvette, masquée derrière les tribunes, plus faible avec la distance', () => {
  const pelouse = ecoute({ mode: 'fps', o: -30 }), gradins = ecoute({ mode: 'fps', o: 20 });
  const devantCar = ecoute({ mode: 'fps', o: 67 }), parking = ecoute({ mode: 'fps', o: 160 });
  assert.equal(pelouse.stade, EAR.stade); assert.equal(gradins.stade, EAR.stade);
  assert.equal(pelouse.mon, OFF, 'dans le stade, on n\'entend pas la console du car');
  assert.ok(devantCar.stade <= EAR.stade - 12, 'derrière la tribune, au moins 12 dB de moins');
  assert.ok(devantCar.stadeHz < 1000, 'derrière la tribune, une rumeur grave');
  assert.ok(parking.stade < devantCar.stade - 10, 'plus loin, encore moins');
  // pas de marche brusque en sortant des gradins
  let prev = ecoute({ mode: 'fps', o: 30 }).stade;
  for (let o = 31; o <= 60; o++) { const v = ecoute({ mode: 'fps', o }).stade; assert.ok(prev - v <= 1.5, `saut de ${prev - v} dB à o = ${o}`); prev = v; }
});

test('le cadreur écoute depuis sa caméra (dehors, même au poste)', () => {
  assert.equal(ecoute({ mode: 'camop', o: -5 }).stade, EAR.stade);
});

test('volume des Réglages : 0,7 = référence, 0 = silence, 30 dB de course', () => {
  assert.equal(volumeLin(0.7), 1);
  assert.equal(volumeLin(0), 0);
  assert.ok(Math.abs(20 * Math.log10(volumeLin(1)) - 9) < 1e-9);
  assert.ok(Math.abs(20 * Math.log10(volumeLin(0.2)) + 15) < 1e-9);
});
