// Module « La caméra », chapitres 5 et 6 : les calculs des manipulations (qui commande l'image,
// budget d'énergie, tally, affichage du viseur, retours, équilibrage), les défis atteignables avec
// les chiffres du mode d'emploi HXC-FB80, les six fiches et leurs schémas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIONS } from '../../src/camlab/notions/index.js';
import { FIGS } from '../../src/camlab/figs.js';
import { LABS } from '../../src/camlab/labs.js';
import { exposureOf, castOf } from '../../src/camlab/optics.js';
import { whiteLevels } from '../../src/camlab/vf.js';
import { FB80, effective, powerBudget, CHARGES, tallyOf, lampsOf, HEARS, vfShow, barsOk, mireBottom, TITLE_TOP, balanceOf, AXE } from '../../src/camlab/labs/ch56.js';

const IDS = ['commandes', 'alimentation', 'tally', 'retours', 'viseur', 'cadreur'];
const G = 9.81;

test('les six fiches des chapitres 5 et 6 sont écrites, avec leur schéma et leur manipulation', () => {
  for (const id of IDS) {
    const f = NOTIONS[id];
    assert.ok(f && !f.prevu, `${id} : écrite`);
    assert.ok([5, 6].includes(f.chap), id);
    assert.equal(typeof LABS[f.lab], 'function', `${id} : manipulation`);
    const s = FIGS[f.fig]();
    assert.match(s, /<svg[^>]+aria-label="[^"]{40,}"/, `${id} : schéma décrit`);
    assert.ok(!/NaN|undefined|null/.test(s), `${id} : schéma sans valeur manquante`);
  }
  // lot et pastille d'origine conservés
  assert.deepEqual(IDS.map((id) => NOTIONS[id].lot), [2, 2, 2, 2, 2, 3]);
  assert.deepEqual(IDS.map((id) => NOTIONS[id].point), ['commandes', 'connectique', 'intercom', 'intercom', 'viseur', 'manches']);
});

test('commandes : reliée à la CCU, le RCP commande gain, filtre et barres ; le gain au sélecteur rattrape le plateau sombre', () => {
  const cam = { gain: 'H', filter: 3, output: 'BARS' }, rcp = { gain: 'L', filter: 1, bars: false };
  assert.deepEqual(effective('seule', cam, rcp), { gainDb: 12, nd: 1 / 16, ndName: '1/16ND', bars: true, by: 'camera' });
  assert.deepEqual(effective('ccu', cam, rcp), { gainDb: 0, nd: 1, ndName: 'CLEAR', bars: false, by: 'rcp' });
  assert.deepEqual(FB80.gain, { L: 0, M: 6, H: 12 });
  // le premier défi : à f/2,8 sur le plateau très sombre (1/32), seul H amène le blanc entre 80 et 98 %
  const w = (db) => whiteLevels(exposureOf(2.8, 1, db) / 32, castOf(3200, 3200))[1];
  assert.ok(w(0) < 80 && w(6) < 80, `${w(0)} ${w(6)}`);
  assert.ok(w(12) >= 80 && w(12) < 99.6, String(w(12)));
  // +6 dB double le signal, comme un diaphragme
  assert.ok(Math.abs(exposureOf(8, 1, 6) / exposureOf(8) - 2) < 0.01);
});

test('alimentation : 600 m par la fibre hybride, 10 km en monomode avec DC IN, et le budget d\'énergie', () => {
  const loads = { viseur: true, objectif: true, lampe: false };
  assert.equal(CHARGES.corps + CHARGES.viseur, 32, '≈ 32 W avec le viseur fourni');
  const a = powerBudget({ link: 'hybride', L: 450, src: 'aucune', loads });
  assert.equal(a.by, 'ccu'); assert.ok(a.powered && a.linkOk);
  const b = powerBudget({ link: 'hybride', L: 700, src: 'aucune', loads });
  assert.equal(b.by, null); assert.ok(!b.powered, 'au-delà de 600 m, la CCU n\'alimente plus');
  const c = powerBudget({ link: 'smf', L: 1500, src: 'aucune', loads });
  assert.ok(!c.powered, 'une fibre monomode ne porte pas d\'énergie');
  const d = powerBudget({ link: 'smf', L: 1500, src: 'secteur', loads });
  assert.ok(d.powered && d.linkOk && d.by === 'dcin');
  assert.ok(Math.abs(d.I - 37 / 12) < 1e-9 && d.I <= FB80.dcIn.imax);
  assert.equal(powerBudget({ link: 'smf', L: 12000, src: 'secteur', loads }).linkOk, false, 'plus de 10 km');
  // le troisième défi : 95 Wh pour 37 W tient 2 h ; avec la lampe de 12 W, non
  const e = powerBudget({ link: 'seule', L: 0, src: 'batterie', loads });
  assert.ok(e.hours >= 2 && Math.abs(e.hours - 95 / 37) < 1e-9);
  const f = powerBudget({ link: 'seule', L: 0, src: 'batterie', loads: { ...loads, lampe: true } });
  assert.ok(f.hours < 2 && f.iLamp <= FB80.dcOutMax, `${f.hours} h, ${f.iLamp} A`);
});

test('tally : rouge au programme (et pendant un CALL), vert au preview, voyant du corps en rouge seulement', () => {
  assert.equal(tallyOf(2, 2, 3), 'pgm'); assert.equal(tallyOf(2, 1, 2), 'pvw'); assert.equal(tallyOf(2, 1, 3), 'off');
  const pgm = lampsOf({ tally: 'pgm', call: false, rear: 'ON', vfSw: 'HIGH' });
  assert.ok(pgm.front && pgm.r && !pgm.g && pgm.rear);
  const pvw = lampsOf({ tally: 'pvw', call: false, rear: 'ON', vfSw: 'HIGH' });
  assert.ok(!pvw.front && !pvw.r && pvw.g && !pvw.rear, 'le voyant du corps ne s\'allume pas en vert');
  assert.ok(lampsOf({ tally: 'off', call: true, rear: 'ON', vfSw: 'LOW' }).rear, 'le CALL allume le rouge');
  assert.ok(!lampsOf({ tally: 'pgm', call: false, rear: 'OFF', vfSw: 'OFF' }).rear);
  assert.equal(lampsOf({ tally: 'pgm', call: false, rear: 'ON', vfSw: 'OFF' }).front, false);
  assert.equal(HEARS.OFF, null); assert.match(HEARS.ENG, /vision/); assert.match(HEARS.PROD, /réalisation/);
});

test('viseur : BRIGHT et CONTRAST ne règlent que l\'écran ; un réglage juste sur les barres existe', () => {
  assert.ok(!barsOk(0.1, 0.75), 'réglage de départ : noir gris, blanc terne');
  assert.ok(barsOk(0, 0.95));
  assert.ok(!barsOk(0, 1.1), 'blanc écrêté dans le viseur');
  assert.ok(!barsOk(-0.03, 1), '+4 % perdu dans le noir');
  assert.equal(vfShow(1.2, 0, 1), 1); assert.equal(vfShow(-0.1, 0, 1), 0);
  // le troisième défi : le soleil (lumière 1) écrête à f/5,6, f/8 garde le blanc au-dessus de 90 %
  assert.ok(whiteLevels(exposureOf(5.6))[1] >= 99.6);
  const w8 = whiteLevels(exposureOf(8))[1]; assert.ok(w8 >= 90 && w8 < 99.6, String(w8));
});

test('retours : la mire passe au-dessus du titre en grand angle, pas à 24 mm', () => {
  assert.ok(mireBottom(6) < TITLE_TOP - 0.02);
  assert.ok(mireBottom(24) > TITLE_TOP);
});

test('cadreur : la plaque ramène le centre de gravité sur l\'axe, le contrepoids compense m·g·h', () => {
  const sans = balanceOf({ plate: 0, cb: 0, prompteur: false });
  assert.ok(Math.abs(sans.m - 6.87) < 1e-9, 'corps 3,4 kg, objectif 2,07 kg, viseur 1,4 kg');
  assert.ok(sans.tau(0) > 0, 'plaque au neutre : elle part en arrière');
  const p = sans.plateOk;
  const eq = balanceOf({ plate: p, cb: 0, prompteur: false });
  assert.ok(Math.abs(eq.tau(0)) < 1e-9 && p > 0 && p < 0.08, String(p));
  // à 30°, le cran le plus proche du besoin tient, le suivant non (tolérance de la tête : 0,6 N·m)
  const need = eq.need, best = Math.round(need / AXE.cran);
  assert.ok(Math.abs(need - eq.m * G * eq.Y) < 1e-9 && need > 10 && need < 25, String(need));
  const holds = (cran, b) => Math.abs(b.tau(Math.PI / 6)) <= AXE.hold && Math.abs(b.tau(-Math.PI / 6)) <= AXE.hold && cran >= 0;
  assert.ok(holds(best, balanceOf({ plate: p, cb: best * AXE.cran, prompteur: false })));
  assert.ok(!holds(best + 2, balanceOf({ plate: p, cb: (best + 2) * AXE.cran, prompteur: false })));
  // avec le prompteur : plus lourd, centre de gravité en avant, plaque reculée et plus de contrepoids
  const pr = balanceOf({ plate: 0, cb: 0, prompteur: true });
  assert.ok(pr.m > sans.m + 4 && pr.plateOk < -0.05 && pr.plateOk > -0.12, String(pr.plateOk));
  const prEq = balanceOf({ plate: pr.plateOk, cb: Math.round(pr.need / AXE.cran) * AXE.cran, prompteur: true });
  assert.ok(prEq.need > need && Math.abs(prEq.tau(Math.PI / 6)) <= AXE.hold && Math.abs(prEq.tau(0)) < 1e-9);
  assert.ok(Math.round(prEq.need / AXE.cran) <= 24, 'le contrepoids de la manipulation va jusqu\'au cran 24');
});
