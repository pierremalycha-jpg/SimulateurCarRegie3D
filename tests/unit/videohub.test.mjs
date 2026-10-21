// Grille du car SDI (Videohub 40 × 40 12G) : plan des ports, routage par numéro, verrous qui refusent
// toute commutation (route() compris), étiquettes, protocole Ethernet numéroté à partir de 0, pannes,
// fiches « ? » et schémas, puis les parcours du chef de car rejoués sans navigateur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useHeadless, TUTOR } from '../helpers/tutor.mjs';
import { S } from '../../src/state.js';
import { loadPreset } from '../../src/bcam.js';
import { ROUTER, route, defaultRouting, updateMixer, MIX } from '../../src/pipeline.js';
import { VH, inPlan, outPlan, inOfSrc, outOfDest, xpOf, outsOfIn, vhRoute, setLock, lockState, inLabel, setInLabel, resetLabels, protocolText, vhReset } from '../../src/videohub.js';
import { FAULTS, injectFault, clearFaults, ACTIVE } from '../../src/faults.js';
import { CATS, TERMS, termFor } from '../../src/content/netterms.js';
import '../../src/content/terms_videohub.js';
import { FIGS } from '../../src/ui/term_figs.js';
import '../../src/ui/figs_videohub.js';
import { registerLessons, startLesson, step, check, next, doForMe, answer, isAction, ctx, val } from '../../src/tutor/engine.js';
import { VIDEOHUB_LESSONS } from '../../src/tutor/lessons/videohub.js';
import { ALL_STATION_LESSONS } from '../../src/tutor/lessons/index.js';
import { PROG } from '../../src/shared.js';

registerLessons(ALL_STATION_LESSONS);
useHeadless();
function sdiCar() {
  S.ipMode = false; S.mode = 'fps'; S.format = 'HD';
  if (!S.cams.length) loadPreset('standard', false);
  ROUTER.customMV = false; ROUTER.customREC = false;
  vhReset(); defaultRouting(true); clearFaults();
  S.simTime = Math.max(S.simTime || 0, 120);
}

test('plan des 40 entrées et 40 sorties : chaque destination de la grille a sa sortie', () => {
  sdiCar();
  assert.equal(inPlan(1).src, 'CAM1'); assert.equal(inPlan(24).src, 'PGM'); assert.equal(inPlan(25).def, 'CLEAN');
  assert.equal(inPlan(30).def, 'Input 30'); assert.equal(inPlan(30).live, false);
  assert.equal(outPlan(31).dest, 'AUX_TX1'); assert.equal(outPlan(33).dest, 'AUX_GIANT'); assert.equal(outPlan(35).dest, 'MV13'); assert.equal(outPlan(40).dest, 'MV18');
  assert.equal(outPlan(1).dest, 'ME1'); assert.equal(outPlan(23).dest, 'REC1');
  for (let n = 1; n <= 40; n++) { const d = outPlan(n).dest; if (d) assert.equal(outOfDest(d), n, d); const s = inPlan(n).src; assert.equal(inOfSrc(s), n, s); }
  // les tuiles 1 à 12 du multiview sont câblées en direct, hors grille
  assert.equal(outOfDest('MV5'), null);
  // en UHD, le mélangeur n'a que 16 entrées : les sorties 17 à 22 deviennent libres
  S.format = 'UHD'; assert.equal(outPlan(17).dest, null); assert.equal(outPlan(17).def, 'Output 17'); S.format = 'HD';
});

test('routage par numéro de port : une entrée vers plusieurs sorties, une seule entrée par sortie', () => {
  sdiCar();
  assert.equal(vhRoute(33, 4), null); assert.equal(ROUTER.map.AUX_GIANT, 'CAM4');
  assert.equal(vhRoute(35, 4), null); assert.equal(ROUTER.map.MV13, 'CAM4');
  assert.ok(outsOfIn(4).includes(33) && outsOfIn(4).includes(35));
  assert.equal(vhRoute(33, 25), null); assert.equal(xpOf(33), 25); assert.equal(ROUTER.map.MV13, 'CAM4');
  // entrée libre : la sortie reçoit « rien de câblé »
  assert.equal(vhRoute(35, 30), null); assert.equal(ROUTER.map.MV13, 'VH30');
  // sortie libre (UHD) : seul le point de croisement change
  S.format = 'UHD'; assert.equal(vhRoute(18, 3), null); assert.equal(xpOf(18), 3); S.format = 'HD';
});

test('verrou : la sortie refuse toute commutation, d\'où qu\'elle vienne', () => {
  sdiCar();
  setLock(31, 'O'); assert.equal(lockState(31), 'O');
  assert.match(vhRoute(31, 22), /verrouillée/);
  assert.match(route('AUX_TX1', 'BARS'), /verrouillée/);
  assert.equal(ROUTER.map.AUX_TX1, 'PGM');
  // la panne « erreur de manipulation sur la grille » ne passe plus sur un départ verrouillé
  setLock(32, 'O'); injectFault('router'); assert.equal(ROUTER.map.AUX_TX1, 'PGM'); assert.equal(ROUTER.map.AUX_TX2, 'PGM');
  setLock(31, null); setLock(32, null); clearFaults();
  assert.equal(vhRoute(31, 22), null); assert.equal(ROUTER.map.AUX_TX1, 'BARS'); vhRoute(31, 24);
  // car IP : pas de Videohub, pas de verrou
  setLock(31, 'O'); S.ipMode = true; assert.equal(ROUTER.guard('AUX_TX1'), null); S.ipMode = false; setLock(31, null);
});

test('étiquettes et protocole Ethernet (ports numérotés à partir de 0)', () => {
  sdiCar();
  setInLabel(3, 'CAM 4'); assert.equal(inLabel(3), 'CAM 4');
  setInLabel(3, '  CAM   3 '); assert.equal(inLabel(3), 'CAM 3'); assert.equal(VH.labels.in[3], undefined);
  vhRoute(31, 24); setLock(31, 'O');
  const t = protocolText();
  assert.match(t, /^PROTOCOL PREAMBLE:\nVersion: /);
  assert.match(t, /INPUT LABELS:\n0 CAM 1\n/); assert.match(t, /\n23 PGM\n/);
  assert.match(t, /VIDEO OUTPUT LOCKS:\n(?:\d+ [UOL]\n){30}30 O\n/);
  assert.match(t, /VIDEO OUTPUT ROUTING:\n(?:\d+ -?\d+\n){30}30 23\n/);
  setLock(31, null); resetLabels();
});

test('pannes de la grille : injectées, constatées, réparées', () => {
  sdiCar();
  for (const id of ['vhlock', 'vhlabel']) assert.ok(FAULTS.find((f) => f.id === id), id);
  const e1 = injectFault('vhlock');
  assert.equal(ROUTER.map.AUX_GIANT, 'BARS'); assert.equal(lockState(33), 'L'); assert.ok(!e1.f.check(e1.st));
  assert.match(vhRoute(33, 25), /autre poste/);
  setLock(33, null); vhRoute(33, 25); assert.ok(e1.f.check(e1.st));
  const e2 = injectFault('vhlabel');
  const { a, b } = e2.st;
  assert.equal(inLabel(a), 'CAM ' + b); assert.equal(ROUTER.map.MV13, 'CAM' + b); assert.ok(!e2.f.check(e2.st));
  clearFaults();
  assert.ok(e2.f.check(e2.st)); assert.equal(inLabel(a), 'CAM ' + a);
  assert.ok(ACTIVE.every((x) => x.done));
});

test('fiches « ? » et schémas de la grille', () => {
  const ids = ['grille', 'point-croisement', 'take', 'verrou-sortie', 'etiquette', '12g-sdi', 'reclocking', 'commutation-propre', 'protocole-videohub'];
  assert.ok(CATS.includes('Grille SDI'));
  for (const id of ids) {
    const T = TERMS[id]; assert.ok(T && T.t && T.short && T.body && T.car, id);
    assert.equal(T.cat, 'Grille SDI'); assert.ok(T.short.length <= 220, id);
    for (const k of T.see || []) assert.ok(TERMS[k], `${id} → ${k}`);
    if (T.fig) { const s = FIGS[T.fig](); assert.match(s, /^<svg viewBox="0 0 \d+ \d+"[^>]*role="img" aria-label="[^"]+"/); assert.ok(s.endsWith('</svg>')); assert.ok(!/NaN|undefined/.test(s)); assert.equal((s.match(/<text[ >]/g) || []).length, (s.match(/<\/text>/g) || []).length); }
  }
  assert.equal(termFor('Utiliser TAKE'), 'take'); assert.equal(termFor('Protocole Ethernet (TCP 9990)'), 'protocole-videohub');
  for (const label of ['Mode', 'État', 'Flux', 'Alarmes', 'Bilan']) assert.equal(termFor(label), null, label);
});

// parcours de la grille rejoués avec « Fais-le pour moi »
function replay(id) {
  startLesson(id);
  const texts = []; const stuck = [];
  for (let guard = 0; guard < 80 && TUTOR.lesson; guard++) {
    const s = step(); const c = ctx();
    texts.push(val(s.say, c)); if (s.do) texts.push(val(s.do, c));
    check();
    if (s.quiz) answer(s.quiz.answer);
    else if (isAction(s) && !TUTOR.done) { doForMe(); for (let k = 0; k < 4 && MIX.auto; k++) updateMixer(1); check(); }
    if (!TUTOR.done) { stuck.push(s.id); break; }
    if (s.ok && TUTOR.done) texts.push(val(s.ok, c));
    next();
  }
  return { stuck, texts };
}
for (const id of [...VIDEOHUB_LESSONS.map((l) => l.id), 'grille-routage', 'transmission-secours']) {
  test(`parcours ${id} : rejoué de bout en bout (car SDI)`, () => {
    sdiCar();
    const { stuck, texts } = replay(id);
    assert.deepEqual(stuck, [], 'étapes bloquées');
    assert.equal(TUTOR.lesson, null);
    assert.ok(PROG.tutor[id] && PROG.tutor[id].done);
    for (const t of texts) assert.ok(t && t.length > 8 && !/undefined|NaN|\[object|null\b/.test(t), `${id} : « ${t} »`);
  });
}
test('après le parcours des verrous, les départs sont libres (le parcours Transmission reste faisable)', () => {
  sdiCar();
  replay('videohub-verrou');
  assert.equal(lockState(31), 'U'); assert.equal(lockState(32), 'U');
  assert.ok(ACTIVE.every((x) => x.done));
  assert.deepEqual(replay('transmission-secours').stuck, []);
});
