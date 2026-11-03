// Le chapitre « La lumière » (v19.29), partie « Commander la lumière » : les calculs purs de la partie
// (cours/lumiere_commande_calc.js : cadence d'une ligne DMX, écart de la tache d'une lyre, phases d'une vague,
// débit Art-Net, univers de console en Port-Address, commutateurs DIP), les chiffres que citent les leçons
// (calculés par labo/calc/dmx.js et labo/calc/show.js), la forme des cinq leçons et les fiches « ? » ajoutées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import '../../src/cours/liens.js';
import { lessonById } from '../../src/cours/index.js';
import { TERMS } from '../../src/content/netterms.js';
import { trame, debitArtnet, portAddress, sacnMulticast, valeur8, absolue, dip, deDip, liaison, diagLigne } from '../../src/labo/calc/dmx.js';
import { pas, position16, formeEffet, tourEffet, tourChaser, suivre, modifier, LYRES } from '../../src/labo/calc/show.js';
import { BREAK_A_BREAK_MIN_US, cadence, ecartTache, phases, debitUnivers, versPortAddress, dipLeves } from '../../src/cours/lumiere_commande_calc.js';

const pres = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);
const LECONS = ['lumiere-dmx', 'lumiere-ligne', 'lumiere-console', 'lumiere-lyres', 'lumiere-reseau'];

test('la trame DMX : 22,8 ms et 44 trames par seconde pour 512 canaux ; une trame trop courte est allongée', () => {
  const K = cadence(512);
  assert.equal(K.us, trame(512).us);
  pres(K.ms, 22.76, 0.01); pres(K.hz, 43.9, 0.1);
  assert.equal(K.allongee, false);
  pres(cadence(128).hz, 170.5, 0.2);
  // en dessous de 23 canaux, la trame ferait moins de 1 204 µs : la norme l'allonge
  assert.equal(cadence(23).allongee, false);
  assert.equal(cadence(22).allongee, true);
  assert.equal(cadence(1).us, BREAK_A_BREAK_MIN_US);
  assert.ok(cadence(1).hz < 831);
});

test('les lyres : 2,1° par pas en 8 bits sur 540°, plus de 70 cm à 20 m ; moins de 3 mm en 16 bits', () => {
  const P = pas(/** @type {[number, number]} */ (LYRES['gen-spot'].pan));
  pres(P.huit, 2.1176, 0.001);
  assert.ok(P.seize < 0.01);
  assert.ok(ecartTache(P.huit, 20) > 0.7 && ecartTache(P.huit, 20) < 0.8);
  assert.ok(ecartTache(P.seize, 20) < 0.003);
  assert.equal(ecartTache(0, 20), 0);
  const p = position16(0, [-270, 270]);
  assert.equal(p.grossier * 256 + p.fin, p.v16);
  assert.deepEqual(phases(8), [0, 45, 90, 135, 180, 225, 270, 315]);
  assert.deepEqual(phases(0), []);
  assert.equal(phases(4, 180)[1], 45);
  assert.equal(formeEffet(90), 'cercle'); assert.equal(formeEffet(0), 'droite'); assert.equal(formeEffet(180), 'droite'); assert.equal(formeEffet(45), 'ellipse'); assert.equal(formeEffet(0, 2), 'huit');
  assert.equal(tourEffet(30), 2); assert.equal(tourChaser(120, 4), 2);
});

test('Art-Net et sACN : univers de console → Port-Address, multicast, débit', () => {
  assert.deepEqual(versPortAddress(1), { pa: 0, net: 0, sub: 0, uni: 0 });
  const v = versPortAddress(18);
  assert.equal(v.pa, 17); assert.equal(portAddress(v.net, v.sub, v.uni), 17);
  assert.deepEqual([v.net, v.sub, v.uni], [0, 1, 1]);
  assert.equal(versPortAddress(257).net, 1);
  assert.equal(sacnMulticast(1), '239.255.0.1'); assert.equal(sacnMulticast(300), '239.255.1.44');
  pres(debitArtnet(44).kbps, 209.8, 0.1);
  pres(debitUnivers(16), 16 * debitArtnet(44).kbps, 1e-9);
  pres(debitUnivers(16) / 1000, 3.36, 0.01);
  // le nœud réglé Universe 1 n'entend pas l'univers 1 de la console (compté à partir de 1)
  const cons = { ip: '2.0.0.10', masque: '255.0.0.0', protocole: /** @type {'artnet'} */ ('artnet'), univers: 1 };
  const nd = { ip: '2.0.0.21', masque: '255.0.0.0', protocole: /** @type {'artnet'} */ ('artnet'), net: 0, sub: 0, uni: 1, sacn: 1 };
  assert.deepEqual(liaison(cons, nd).pb.map((p) => p.id), ['univers']);
  assert.ok(liaison(cons, { ...nd, uni: 0 }).ok);
  assert.deepEqual(liaison(cons, { ...nd, uni: 0, ip: '192.168.1.20', masque: '255.255.255.0' }).pb.map((p) => p.id), ['reseau']);
});

test('le DMX : valeurs, adresses, commutateurs DIP ; la ligne ; le tracking', () => {
  assert.equal(valeur8(40), 102); assert.equal(absolue(2, 1), 513); assert.equal(absolue(3, 17), 1041);
  assert.deepEqual(dipLeves(37), [1, 4, 32]); assert.equal(deDip(dip(37)), 37);
  for (let a = 1; a <= 511; a += 7) assert.equal(dipLeves(a).reduce((s, x) => s + x, 0), a);
  assert.deepEqual(diagLigne({ recepteurs: 45, longueur: 100, terminaison: true, y: false, splitter: 0 }).pb.map((p) => p.id), ['charge']);
  assert.ok(diagLigne({ recepteurs: 45, longueur: 100, terminaison: true, y: false, splitter: 2 }).ok);
  // la conduite de la manipulation : retoucher le contre dans la cue 2
  const L = [
    { no: 1, values: { Contre: { DIM: 60 } } }, { no: 2, values: { Face: { DIM: 100 } } }, { no: 3, values: {} }, { no: 4, values: { Contre: { DIM: 30 } } },
  ];
  const tr = suivre(modifier(L, 1, 'Contre', 'DIM', 20, false)), co = suivre(modifier(L, 1, 'Contre', 'DIM', 20, true));
  assert.deepEqual(tr.map((s) => s.Contre.DIM), [60, 20, 20, 30]);
  assert.deepEqual(co.map((s) => s.Contre.DIM), [60, 20, 60, 30]);
});

test('les cinq leçons de la partie : forme, fiches « ? », référentiel', () => {
  for (const id of LECONS) {
    const f = lessonById(id);
    assert.ok(f && f.chapter.id === 'lumiere' && f.lesson.partie === 'Commander la lumière', id);
    const L = f.lesson;
    assert.equal(L.essentials.length, 3, `${id} : l'essentiel en trois lignes`);
    assert.ok(typeof L.figure === 'function' && typeof L.demo === 'function' && L.demoTitle && L.plus && L.car && L.car.text, `${id} : schéma, manipulation, plus, car`);
    assert.ok(!('exercises' in L) && !('article' in L), `${id} : ni exercises ni article`);
    assert.ok(L.quiz.length >= 6, `${id} : six questions au moins`);
    for (const q of L.quiz) {
      assert.equal(q.choices.length, 3, `${id} : « ${q.q} »`);
      q.choices.forEach((c, k) => { if (k !== q.answer) assert.ok(Array.isArray(c) && c[1].length > 10, `${id} : choix faux expliqué dans « ${q.q} »`); });
      assert.ok(!/undefined|NaN/.test(q.why), `${id} : explication calculée`);
    }
  }
  for (const k of ['rdm', 'chaser', 'preset-lumiere', 'pan-tilt', 'cue-lumiere', 'splitter-dmx', 'gobo', 'noeud-dmx']) assert.ok(TERMS[k] && TERMS[k].cat === 'Lumière et DMX', k);
});
