// Les bruitages de l'interface (src/game/sons.js) : une palette professionnelle, courte et accordée.
// Le rendu réel (crête, énergie, pas de saturation) est vérifié dans le navigateur : tests/e2e/sons.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RECETTES, N, GAMME, dureeDe, classeDe, tenue, recetteCurseur } from '../../src/game/sons.js';

const noms = Object.keys(RECETTES);
const CLICS = ['ui', 'hover', 'tab', 'toggleOn', 'toggleOff', 'tally'];
const TOUCHES = ['press', 'tap', 'select', 'fold'];
const GRANDS = ['mission', 'levelup', 'badge', 'launch', 'onair'];

test('le vocabulaire couvre les gestes, les fenêtres, le téléphone, la progression et l\'antenne', () => {
  for (const n of ['ui', 'hover', 'press', 'tap', 'tab', 'toggleOn', 'toggleOff', 'select', 'fold', 'open', 'close', 'layer', 'poste',
    'telUp', 'telDown', 'confirm', 'notify', 'error', 'dialog', 'step', 'check', 'quizok', 'xp', 'mission', 'unlock', 'badge', 'levelup',
    'alarm', 'tally', 'intercom', 'whoosh', 'place', 'launch', 'onair', 'offair']) assert.ok(RECETTES[n], 'il manque le son ' + n);
});

test('chaque voix est bien formée : genre connu, durée, niveau et fréquences audibles', () => {
  for (const n of noms) {
    const r = RECETTES[n];
    assert.ok(r.voix.length >= 1 && r.voix.length <= 12, n + ' : 1 à 12 voix');
    assert.ok(r.rev >= 0 && r.rev <= 0.35, n + ' : réverbération discrète');
    for (const v of r.voix) {
      assert.ok(['tick', 'tone', 'bell', 'pluck', 'air', 'thump'].includes(v.k), n + ' : genre ' + v.k);
      assert.ok(v.d > 0 && v.d <= 2, n + ' : durée ' + v.d);
      assert.ok(v.g > 0 && v.g <= 0.12, n + ' : niveau ' + v.g);
      assert.ok(v.f >= 40 && v.f <= 6000 && (!v.f2 || (v.f2 >= 40 && v.f2 <= 6000)), n + ' : fréquence ' + v.f);
      assert.ok(!v.pan || Math.abs(v.pan) <= 1, n + ' : panoramique');
      assert.ok(!v.type || v.type === 'sine' || v.type === 'triangle', n + ' : pas d\'onde carrée ni en dents de scie');
    }
  }
});

test('les notes tenues (cloches, bois) restent dans ré majeur pentatonique', () => {
  assert.equal(classeDe(N.D5), 2); assert.equal(classeDe(N.Fs6), 6); assert.equal(classeDe(440), 9);
  for (const n of noms) for (const v of RECETTES[n].voix.filter(tenue)) assert.ok(GAMME.includes(classeDe(v.f)), `${n} : ${v.f} Hz hors de la gamme`);
});

test('court et discret : un clic en moins de 60 ms, une touche qui sonne en moins de 0,35 s, une notification en moins d\'une seconde', () => {
  for (const n of CLICS) assert.ok(dureeDe(RECETTES[n]) <= 0.06, n + ' : ' + dureeDe(RECETTES[n]));
  for (const n of TOUCHES) assert.ok(dureeDe(RECETTES[n]) <= 0.35, n + ' : ' + dureeDe(RECETTES[n]));
  for (const n of ['open', 'close', 'tab', 'confirm', 'notify', 'error', 'dialog', 'step', 'check', 'quizok', 'xp', 'telUp', 'telDown', 'alarm', 'intercom'])
    assert.ok(dureeDe(RECETTES[n]) <= 1, n + ' : ' + dureeDe(RECETTES[n]));
  for (const n of GRANDS) assert.ok(dureeDe(RECETTES[n]) <= 2.6, n + ' : ' + dureeDe(RECETTES[n]));
  // le survol est le plus discret de tous
  const crete = (n) => Math.max(...RECETTES[n].voix.map((v) => v.g));
  for (const n of noms.filter((x) => x !== 'hover')) assert.ok(crete('hover') <= crete(n), 'le survol plus fort que ' + n);
});

test('le curseur de volume monte avec la valeur, sans sortir de la plage', () => {
  const f = (v) => recetteCurseur(v).voix[0].f;
  assert.ok(f(0) < f(0.5) && f(0.5) < f(1));
  assert.equal(f(-1), f(0)); assert.equal(f(2), f(1));
});
