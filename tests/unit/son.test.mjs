// Le chapitre « Le son » densifié (v19.26) : ses trois parties et neuf leçons ; les calculs purs des leçons
// (cours/son_calc.js : décibels, directivité, couples stéréo, liaisons, dynamique, loudness, numérique) et ceux de
// la compression vidéo (cours/video_calc.js) ; la forme des leçons ajoutées (six questions, chaque choix faux
// expliqué, fiches existantes) ; les fiches « ? » du son et de la vidéo dans le registre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import '../../src/cours/liens.js';
import { lessonById, CHAPTERS } from '../../src/cours/index.js';
import { PARTIES } from '../../src/cours/son.js';
import { TERMS, CATS } from '../../src/content/netterms.js';
import {
  ratioDb, dbRatio, dbuVolt, voltDbu, dbvDbu, ECART_PRO_CONSO, sommeDb, splA, splPa, rho, attenuationDb, canon, canonDb, facteurDistance,
  COUPLES, couple, angleEnregistrement, msVersXY, premierCreuxHz, residuModeCommun, perteAdaptation, compresseur, gainRattrapage, gate,
  loudnessIntegre, plageLoudness, normaliser, creteEchantillons, debitPcm, dynamiqueDb, nyquist, debitAes3, canauxMadi, latenceTampon, deriveEchantillons,
} from '../../src/cours/son_calc.js';
import { debitActif, taux, tailleOctets, octets, gop, gainGop, CODECS } from '../../src/cours/video_calc.js';

const pres = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);
const NOUVELLES = ['son-decibel', 'son-micros', 'son-stereo', 'son-liaisons', 'son-dynamique', 'son-loudness', 'son-numerique', 'signal-compression'];

test('le chapitre son : trois parties, neuf leçons dans l\'ordre des parties, chacune avec sa partie', () => {
  const ch = CHAPTERS.find((c) => c.id === 'son');
  const ids = PARTIES.flatMap(([, l]) => l);
  assert.equal(PARTIES.length, 3);
  assert.deepEqual(ch.lessons.map((l) => l.id), ids, 'le sommaire suit les parties');
  for (const l of ch.lessons) assert.ok(l.partie && PARTIES.some(([p, ls]) => p === l.partie && ls.includes(l.id)), l.id);
  assert.equal(ch.lessons.length, 9);
  assert.ok(lessonById('signal-compression') && lessonById('signal-compression').chapter.id === 'signal');
});

test('chaque leçon ajoutée : six questions à trois choix, chaque choix faux expliqué, fiches existantes, savoirs du son', () => {
  for (const id of NOUVELLES) {
    const f = lessonById(id); assert.ok(f, id);
    const L = f.lesson;
    assert.equal(L.quiz.length, 6, `${id} : six questions`);
    for (const q of L.quiz) {
      assert.equal(q.choices.length, 3, `${id} : trois choix`);
      q.choices.forEach((c, i) => { if (i !== q.answer) assert.ok(Array.isArray(c) && c[1].length > 10, `${id} : choix faux sans explication (« ${q.q} »)`); });
      assert.equal(typeof q.choices[q.answer], 'string', `${id} : la bonne réponse est une chaîne`);
    }
    for (const t of L.terms) assert.ok(TERMS[t], `${id} : fiche ${t}`);
    assert.ok(typeof L.figure === 'function' && typeof L.demo === 'function', `${id} : schéma et manipulation`);
    assert.ok(L.car && L.car.station, `${id} : dans le car`);
  }
});

test('fiches « ? » : les familles Son et Signal vidéo, avec leurs renvois', () => {
  assert.ok(CATS.includes('Son') && CATS.includes('Signal vidéo'));
  for (const k of ['decibel', 'dbu', 'dbfs', 'directivite', 'micro-statique', 'couple-stereo', 'ortf', 'ms', 'symetrique', 'compresseur', 'lufs', 'dbtp', 'aes3', 'madi', 'dante', 'codec', 'gop']) {
    assert.ok(TERMS[k], k); assert.ok(TERMS[k].ref && TERMS[k].car, `${k} : référence et car`);
    for (const s of TERMS[k].see) assert.ok(TERMS[s], `${k} → ${s}`);
  }
});

test('décibels : 20 log et 10 log, dBu et dBV, sommes, distance', () => {
  pres(ratioDb(2), 6.02, 0.01); pres(ratioDb(2, true), 3.01, 0.01); pres(ratioDb(10), 20, 1e-9);
  pres(dbRatio(6.02), 2, 0.01); pres(dbuVolt(0), 0.775, 1e-9); pres(dbuVolt(4), 1.228, 0.001); pres(voltDbu(1.228), 4, 0.01);
  pres(dbvDbu(-10), -7.78, 0.01); pres(ECART_PRO_CONSO, 11.79, 0.01);
  pres(sommeDb([80, 80]), 83.01, 0.01, 'deux sources indépendantes : +3 dB'); pres(sommeDb([80, 80], true), 86.02, 0.01, 'le même signal deux fois : +6 dB');
  pres(sommeDb([80, 70]), 80.41, 0.01); assert.equal(sommeDb([]), -Infinity);
  pres(splA(100, 1, 2), 93.98, 0.01); pres(splA(100, 1, 8), 81.94, 0.01); pres(splPa(94), 1, 0.01);
});

test('directivité : cardioïde −6 dB à 90°, rien derrière ; hyper −12 dB à 90° ; canon directif seulement dans l\'aigu ; facteur de distance', () => {
  pres(rho(0.5, 0), 1, 1e-9); pres(rho(0.5, 90), 0.5, 1e-9); pres(rho(0.5, 180), 0, 1e-9);
  pres(attenuationDb(0.5, 90), -6.02, 0.01); assert.equal(attenuationDb(0.5, 180), -60); pres(attenuationDb(0.25, 90), -12.04, 0.01);
  assert.equal(attenuationDb(1, 123), 0, 'un omni ne rejette rien'); pres(attenuationDb(0, 90), -60, 1e-9);
  assert.ok(canonDb(60, 8000) < canonDb(60, 200) - 15, 'le tube agit à 8 kHz, pas à 200 Hz');
  pres(canon(0, 8000), 1, 1e-9);
  const fd = facteurDistance(0.5); pres(fd.ree, 1 / 3, 1e-9); pres(fd.facteur, 1.732, 0.001); pres(facteurDistance(0.25).facteur, 2, 1e-9);
});

test('couples stéréo : XY niveau seul, AB temps seul, angle d\'enregistrement qui se resserre, MS et mono', () => {
  const xy = COUPLES.find((c) => c.id === 'xy'), ab = COUPLES.find((c) => c.id === 'ab60'), ortf = COUPLES.find((c) => c.id === 'ortf'), ms = COUPLES.find((c) => c.id === 'ms');
  const sxy = couple(xy, 45); pres(sxy.dL, 6.02, 0.01); assert.equal(sxy.dt, 0);
  const sab = couple(ab, 30); assert.equal(sab.dL, 0); pres(sab.dt, 0.875, 0.005);
  const so = couple(ortf, 30); assert.ok(so.dL > 0 && so.dt > 0 && so.pos > sxy.pos);
  assert.equal(couple(xy, 0).pos, 0, 'source dans l\'axe : au centre');
  assert.ok(couple(xy, -45).pos < 0, 'à droite');
  assert.equal(couple(ab, 90).pos, 100, 'à 90°, l\'AB 60 cm est plein à gauche');
  const sra = Object.fromEntries(COUPLES.map((c) => [c.id, angleEnregistrement(c)]));
  assert.ok(sra.xy > 170 && sra.xy <= 180);
  assert.ok(sra.ortf > 95 && sra.ortf < 115, `ORTF ≈ 100° (${sra.ortf})`);
  assert.ok(sra.ab60 > 70 && sra.ab60 < 90, `AB 60 cm ≈ 80° (${sra.ab60})`);
  assert.ok(sra.ab40 > sra.ab60, 'plus espacé : plus étroit');
  assert.ok(sra.xy120 < sra.xy, 'plus ouvert : plus étroit');
  assert.ok(sra.blumlein > 60 && sra.blumlein < 80);
  // MS : L = M + S, R = M − S ; S coupé : mono ; équivalent XY
  const m1 = couple({ ...ms, gS: 0 }, 60); pres(m1.dL, 0, 1e-9);
  const m2 = couple({ ...ms, gS: 1 }, 30); pres(m2.L, rho(0.5, 30) + 0.5, 1e-9); pres(m2.R, rho(0.5, 30) - 0.5, 1e-9);
  const eq = msVersXY(1); pres(eq.angle, 126.87, 0.01); pres(eq.a, 0.309, 0.001);
  pres(msVersXY(0.5).angle, 90, 0.01); pres(msVersXY(1, 1).angle, 180, 0.01);
  pres(premierCreuxHz(0.25), 2000, 1e-9); assert.equal(premierCreuxHz(0), Infinity);
});

test('liaisons : réjection de mode commun, pontage d\'impédance', () => {
  pres(residuModeCommun(100, 60), 0.1, 1e-9); pres(residuModeCommun(20, 40), 0.2, 1e-9);
  pres(perteAdaptation(150, 1500), -0.83, 0.01); pres(perteAdaptation(600, 600), -6.02, 0.01); pres(perteAdaptation(100, 10000), -0.09, 0.01);
});

test('dynamique : compresseur, genou doux, limiteur, rattrapage, gate', () => {
  assert.equal(compresseur(-30, -20, 4), -30, 'sous le seuil : rien');
  pres(compresseur(-8, -20, 4), -17, 1e-9); pres(compresseur(-8, -20, 2), -14, 1e-9);
  pres(compresseur(-10, -20, 20), -20, 1e-9, 'ratio ≥ 20 : limiteur');
  const doux = compresseur(-20, -20, 4, 10); assert.ok(doux < -20 && doux > -22, 'au seuil, le genou doux réduit déjà un peu');
  pres(compresseur(-15, -20, 4, 10), compresseur(-15, -20, 4), 1e-9, 'au-delà du genou, la droite du ratio');
  pres(gainRattrapage(-6, -20, 4), 10.5, 1e-9);
  assert.equal(gate(-50, -40), -110); assert.equal(gate(-30, -40), -30);
});

test('loudness : portes absolue et relative, moyenne en puissance, LRA, normalisation, crête vraie', () => {
  const I = loudnessIntegre([-20, -22, -24, -80, -60, -21]);
  pres(I.lufs, -21.51, 0.01); assert.equal(I.gardes, 4); assert.ok(I.sansPorte < I.lufs - 1, 'sans porte, le silence tire vers le bas');
  pres(loudnessIntegre([-23, -23, -23]).lufs, -23, 1e-9);
  assert.equal(loudnessIntegre([-80, -75]).lufs, -Infinity, 'que du silence');
  pres(plageLoudness([-18, -20, -22, -25, -30, -35, -60]), 12, 0.01); assert.equal(plageLoudness([-23]), 0);
  const N = normaliser(-20, -4); pres(N.gain, -3, 1e-9); pres(N.crete, -7, 1e-9); assert.ok(N.ok);
  const N2 = normaliser(-28, -3); pres(N2.gain, 5, 1e-9); assert.ok(!N2.ok && Math.abs(N2.limiter - 3) < 1e-9);
  pres(creteEchantillons(12000), -3.01, 0.01, 'à fs/4 et 45° : −3 dB'); pres(creteEchantillons(1000), 0, 0.01);
});

test('audio numérique : débit, dynamique, Nyquist, AES3, MADI, latence, dérive', () => {
  assert.equal(debitPcm(48000, 24, 1), 1152000); assert.equal(debitPcm(48000, 24, 2), 2304000);
  pres(dynamiqueDb(24), 146.24, 0.01); pres(dynamiqueDb(16), 98.08, 0.01);
  assert.equal(nyquist(48000), 24000); assert.equal(debitAes3(48000), 3072000);
  assert.equal(canauxMadi(48000), 64); assert.equal(canauxMadi(96000), 32); assert.equal(canauxMadi(48000, false), 56);
  pres(latenceTampon(48, 48000), 1, 1e-9); pres(latenceTampon(256, 48000), 5.33, 0.01);
  pres(deriveEchantillons(50), 2.4, 1e-9);
});

test('compression vidéo : débit actif, taux, taille, GOP, codecs', () => {
  pres(debitActif(1920, 1080, '422', 10, 50) / 1e9, 2.0736, 1e-6); pres(debitActif(1920, 1080, '420', 8, 25) / 1e6, 622.08, 0.01);
  pres(taux(2.0736e9, 50e6), 41.47, 0.01); assert.equal(taux(1, 0), Infinity);
  pres(tailleOctets(50e6, 5400) / 1e9, 33.75, 1e-9); assert.equal(octets(33.75e9), '33,75 Go'); assert.equal(octets(375e6), '375 Mo');
  const G = gop(12, 3); assert.deepEqual([G.I, G.P, G.B], [1, 3, 8]); pres(G.poids, 2.8, 1e-9); pres(gainGop(12, 3), 4.29, 0.01);
  assert.deepEqual([gop(1).I, gop(1).P, gop(1).B], [1, 0, 0]); assert.deepEqual([gop(12, 1).I, gop(12, 1).P, gop(12, 1).B], [1, 11, 0]);
  assert.ok(CODECS.find((c) => c.id === 'xdcam').mbs === 50 && CODECS.every((c) => c.mbs > 0 && c.usage));
});
