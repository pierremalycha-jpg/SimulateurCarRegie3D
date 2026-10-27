// Le son, la console analogique, l'audio numérique, la loudness et Dante (v19.19) : les modèles purs des leçons
// (cours/son_console_calc.js, cours/dante_calc.js), les leçons et leurs vues 3D (son-console, son-dante).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { lessonById } from '../../src/cours/index.js';
import { PARTIES_SON } from '../../src/cours/son.js';
import { vuesDeLecon, vueById } from '../../src/vues3d/catalogue.js';
import {
  dbuDeV, vDeDbu, dbuDeDbv, ECART_PRO_GP, micDbu, niveauEntree, gainPour, sourceById, gainEq, panDb, somme, sommeIdentiques, chaine, ECRETAGE,
  sorties, boucle, rejetCardio, repliement, dynamique, debitAes3, debitMadi, canauxMadi, dbuDeDbfs, dbfsDeDbu, ALIGNEMENTS, latenceMs, echParImage,
  sousBlocs, blocs, integree, lra, mesure, conformeR128, GAIN_REC,
} from '../../src/cours/son_console_calc.js';
import { canalUtile, flux, fluxPour, emission, charge, delaiChemin, tient, latenceConseillee, leader, DSCP } from '../../src/cours/dante_calc.js';

const near = (a, b, e = 0.01) => assert.ok(Math.abs(a - b) <= e, `${a} ≠ ${b}`);
const IDS = ['son-console', 'son-sorties', 'son-numerique', 'son-loudness', 'son-dante'];
// l'échantillonnage et la loudness sont des courbes et des calculs : ils restent en 2D (tableau de pertinence du README)
const AVEC_3D = ['son-console', 'son-sorties', 'son-dante'];

test('les leçons : rangées dans leurs parties, six questions au moins, une vue 3D pour la console et Dante', () => {
  for (const id of IDS) {
    const f = lessonById(id); assert.ok(f, id);
    assert.equal(f.chapter.id, 'son');
    assert.ok(PARTIES_SON.includes(f.lesson.partie), `${id} : partie`);
    assert.ok(f.lesson.quiz.length >= 6, `${id} : six questions`);
    assert.ok(typeof f.lesson.demo === 'function' && typeof f.lesson.figure === 'function', `${id} : schéma et manipulation`);
    assert.equal(vuesDeLecon(id).length >= 1, AVEC_3D.includes(id), `${id} : vue 3D`);
  }
  assert.ok(vueById('son-console') && vueById('son-dante'));
});

test('niveaux électriques : dBu, dBV, ligne pro et grand public', () => {
  near(dbuDeV(0.775), 0); near(vDeDbu(4), 1.228, 0.001); near(dbuDeDbv(-10), -7.78);
  near(ECART_PRO_GP, 11.78); near(GAIN_REC, -7.78);
  // SM58 : 1,85 mV/Pa ; à 94 dB SPL (1 Pa), −52,4 dBu ; à 110 dB SPL, 16 dB de plus
  near(micDbu(1.85, 94), -52.44); near(micDbu(1.85, 110), -36.44);
  const chant = sourceById('chant');
  near(gainPour(niveauEntree(chant)), 36.44);
  // un micro statique sans 48 V ne délivre rien
  assert.equal(niveauEntree(sourceById('guitare'), false), -Infinity);
  assert.ok(Number.isFinite(niveauEntree(sourceById('guitare'), true)));
});

test('la tranche : égaliseur, panoramique, sommes, étages et écrêtage', () => {
  near(gainEq([0.25, 0.25, 0.25, 0.25], {}), 0);
  near(gainEq([0, 0, 1, 0], { mid: 6 }), 6);
  near(gainEq([0, 0.5, 0.5, 0], { low: 15 }), 10 * Math.log10(0.5 * 10 ** 1.5 + 0.5));
  assert.ok(gainEq([0.5, 0, 0.5, 0], {}, true) < -2.9, 'le coupe-bas retire le grondement');
  near(panDb(0)[0], -3.01); near(panDb(0)[1], -3.01); near(panDb(-1)[0], 0); assert.equal(panDb(-1)[1], -Infinity);
  near(somme([0, 0]), 3.01); near(sommeIdentiques(0), 6.02); assert.equal(somme([]), -Infinity);
  const ok = chaine({ entree: -36.4, gain: 36, fader: 0, master: 0 });
  assert.equal(ok.ecrete, null); assert.ok(!ok.peak); near(ok.marge, ECRETAGE - (-0.4), 0.05);
  // gain trop fort : écrêté avant le fader, et le fader n'y change rien
  const trop = chaine({ entree: -36.4, gain: 60, fader: -20, master: 0 });
  assert.equal(trop.ecrete && trop.ecrete.id, 'gain'); assert.ok(trop.peak);
  // la sortie XLR à +4 dBu quand le master est au « 0 »
  near(chaine({ entree: 0, gain: 0, fader: 0, pan: -1, master: 0 }).xlr, 4);
});

test('les sorties : AUX pré-fader, FX post-fader, enregistrement', () => {
  const tr = [{ nom: 'Chant', niveau: 0, fader: 0, aux: 0, fx: -10 }, { nom: 'Guitare', niveau: 0, fader: 0, aux: -10, fx: -Infinity }];
  const a = sorties(tr, { fxRetour: 0 });
  const b = sorties([{ ...tr[0], fader: -Infinity }, tr[1]], { fxRetour: 0 });
  // le retour (pré-fader) ne bouge pas quand on ferme le fader du chant ; l'envoi d'effet (post-fader) s'éteint
  near(a.aux.v, b.aux.v); assert.ok(Number.isFinite(a.fx.v) && b.fx.v === -Infinity);
  assert.ok(b.principale.g < a.principale.g);
  near(a.rec, Math.max(a.principale.g, a.principale.d) + GAIN_REC);
  assert.ok(/PFL/.test(sorties(tr, { pfl: 1 }).casque.quoi));
});

test('le larsen : gain de boucle et rejet du cardioïde', () => {
  near(rejetCardio(0), 0); near(rejetCardio(90), 6.02); assert.equal(rejetCardio(180), 25);
  const b = boucle({ gainSysteme: 10, distance: 1, rejet: 0 });
  assert.ok(b.larsen && b.marge === -10);
  assert.ok(!boucle({ gainSysteme: 10, distance: 2, rejet: 25 }).larsen);
});

test('l\'audio numérique : repliement, dynamique, AES3, MADI, alignements', () => {
  assert.equal(repliement(1000, 48000), 1000); assert.equal(repliement(30000, 48000), 18000); assert.equal(repliement(47000, 48000), 1000);
  near(dynamique(16), 98.08); near(dynamique(24), 146.24);
  assert.equal(debitAes3(48000), 3072000);
  assert.equal(debitMadi(48000), 98304000); assert.equal(canauxMadi(48000), 64); assert.equal(canauxMadi(96000), 32);
  assert.equal(dbuDeDbfs(-18), 0); assert.equal(dbuDeDbfs(0), 18); assert.equal(dbuDeDbfs(0, ALIGNEMENTS.rp155), 24); assert.equal(dbfsDeDbu(4, ALIGNEMENTS.rp155), -20);
  near(latenceMs(48, 48000), 1); assert.equal(echParImage(48000, 25), 1920);
});

test('la loudness : portes de BS.1770, LRA, conformité R128', () => {
  // un programme constant à −23 LUFS : −23 ; un silence ne compte pas (porte absolue)
  near(integree(blocs(sousBlocs([{ duree: 10, lufs: -23 }]))).I, -23);
  const avecSilence = integree(blocs(sousBlocs([{ duree: 10, lufs: -23 }, { duree: 10, lufs: -Infinity }])));
  near(avecSilence.I, -23, 0.2); assert.ok(avecSilence.sousAbs >= 90);
  // un passage très calme (−45) est écarté par la porte relative
  const r = integree(blocs(sousBlocs([{ duree: 10, lufs: -20 }, { duree: 10, lufs: -45 }])));
  assert.ok(r.sousRel > 0); near(r.I, -20, 0.3);
  // deux niveaux également présents : LRA ≈ leur écart
  const L = lra(sousBlocs([{ duree: 30, lufs: -28 }, { duree: 30, lufs: -18 }]));
  assert.ok(L > 8 && L <= 10.01, `LRA ${L}`);
  const m = mesure([{ duree: 20, lufs: -25, crete: -6 }, { duree: 5, lufs: -15, crete: -0.4 }]);
  assert.ok(m.I > -25 && m.I < -15 && m.correction === -23 - m.I);
  assert.deepEqual(conformeR128(-23.4, -1.5), { loudness: true, crete: true, tol: 0.5 });
  assert.ok(!conformeR128(-21.8, -0.5, true).loudness && !conformeR128(-21.8, -0.5, true).crete);
});

test('Dante : débits, flux, latence, leader', () => {
  assert.equal(canalUtile(), 1152000);
  const f = flux({ canaux: 4 });
  assert.equal(f.ech, 48); assert.equal(f.utiles, 576); assert.equal(f.fil, 654); near(f.debit / 1e6, 5.232, 0.001);
  assert.equal(fluxPour(16), 4); assert.equal(fluxPour(17), 5);
  const uni = emission({ canaux: 16, recepteurs: 3, multicast: false }), multi = emission({ canaux: 16, recepteurs: 3, multicast: true });
  assert.equal(uni.flux, 12); assert.equal(multi.flux, 4); near(multi.debit * 3, uni.debit, 1);
  near(charge(50e6, 100), 0.5);
  const d100 = delaiChemin({ bonds: 3, lienMbps: 100, octets: 654, charge: 0.5 }), d1g = delaiChemin({ bonds: 3, lienMbps: 1000, octets: 654, charge: 0.5 });
  near(d100.ser, 52.32); assert.ok(d1g.total < d100.total / 9);
  assert.ok(tient(0.25, d1g.total).ok && !tient(0.25, d100.total).ok);
  assert.equal(latenceConseillee(40), 0.25); assert.equal(latenceConseillee(400), 1);
  assert.equal(leader([{ nom: 'a', id: '00:1d:c1:00:00:09' }, { nom: 'b', id: '00:1d:c1:00:00:02' }]).nom, 'b');
  assert.equal(leader([{ nom: 'a', id: '00:1d:c1:00:00:09', preferred: true }, { nom: 'b', id: '00:1d:c1:00:00:02' }]).nom, 'a');
  assert.equal(DSCP.ptp.valeur, 56); assert.equal(DSCP.audio.valeur, 46);
});
