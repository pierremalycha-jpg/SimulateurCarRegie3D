// Module « La caméra », chapitres 2 et 3 : les calculs des manipulations (sensibilité de la
// HXC-FB80, gain et bruit, mireds, obturateur et scintillement, moiré, formats et débits SDI),
// et la vérification que chaque défi peut être réussi avec les commandes proposées.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIONS } from '../../src/camlab/notions/index.js';
import { FIGS } from '../../src/camlab/figs.js';
import { LABS } from '../../src/camlab/labs.js';
import { dofLimits, maxAperture, castOf, ND } from '../../src/camlab/optics.js';
import {
  PITCH, whiteLin, videoPct, okPct, nAt0dB, dbGain, stopsOfDb, snrAt, minGain, budget, GAINS, mired, wien,
  SHUTTERS_50, flicker, pwmMean, bandContrast, shutterAngle, periodPx, mtf, moire, fold, falseStripes, erasedByOlpf,
  FORMATS_FB80, sdiGbps, sdiFor, pixelsPerSecond,
} from '../../src/camlab/labs/ch23.js';

const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
const IDS = ['cc', 'olpf', 'gain', 'shutter', 'exposition', 'formats'];

test('ch23 : les six fiches sont écrites, avec leur schéma et leur manipulation', () => {
  for (const id of IDS) {
    const f = NOTIONS[id];
    assert.ok(f && !f.prevu, `${id} écrite`);
    assert.ok(FIGS[f.fig]().includes('<svg') && /aria-label="[^"]{40,}"/.test(FIGS[f.fig]()), `${id} : schéma avec sa description`);
    assert.equal(typeof LABS[f.lab], 'function', `${id} : manipulation`);
    assert.ok(!/undefined|NaN/.test(FIGS[f.fig]()), `${id} : schéma sans valeur manquante`);
  }
  assert.equal(NOTIONS.formats.cours, 'signal-formats');
  // chapitre, lot et pastille de la fiche annoncée
  assert.deepEqual(IDS.map((id) => [NOTIONS[id].chap, NOTIONS[id].lot, NOTIONS[id].point]), [[2, 2, 'filtres'], [2, 3, 'bloc'], [3, 2, 'commandes'], [3, 2, 'menu'], [3, 2, 'iris'], [3, 3, 'menu']]);
});

test('sensibilité de la FB80 : f/13 à 2000 lux, et l\'iris de n\'importe quelle scène', () => {
  assert.ok(near(whiteLin({ lux: 2000, N: 13 }), 1));
  assert.ok(near(videoPct(1), 100));
  assert.ok(near(nAt0dB(400), 5.814, 1e-3), 'plateau à 400 lux : f/5,8');
  assert.ok(near(nAt0dB(20), 1.3, 1e-3), '20 lux : f/1,3, plus ouvert que l\'objectif');
  // un ND 1/16 vaut quatre diaphragmes, un shutter à 1/100 un diaphragme
  assert.ok(near(whiteLin({ lux: 2000, N: 13, nd: 1 / 16 }), 1 / 16));
  assert.ok(near(whiteLin({ lux: 2000, N: 13, te: 1 / 100 }), 0.5));
  // le budget en diaphragmes s'additionne et redonne le niveau
  const o = { lux: 400, N: 4, nd: 1 / 4, gain: 6, te: 1 / 250 };
  const b = budget(o), sum = Object.values(b).reduce((s, v) => s + v, 0);
  assert.ok(near(sum, Math.log2(whiteLin(o)), 1e-9));
  assert.ok(near(b.nd, -2) && near(b.shutter, Math.log2(50 / 250)));
});

test('gain : +6 dB = ×2 = un diaphragme, et 6 dB de rapport signal sur bruit en moins', () => {
  assert.ok(near(dbGain(6), 1.995, 1e-3));
  assert.ok(near(stopsOfDb(6.0206), 1, 1e-4));
  assert.equal(snrAt(0), 60); assert.equal(snrAt(6), 54); assert.equal(snrAt(12), 48);
  assert.deepEqual(GAINS, [-3, 0, 3, 6, 9, 12]);
  // la manipulation du gain : 20 lux, f/1,8 → +3 dB ; +9 dB et un diaphragme d'iris donnent le même blanc
  assert.equal(minGain(20, 1.8), 3);
  const w1 = videoPct(whiteLin({ lux: 20, N: 1.8, gain: 3 }));
  const N2 = 1.8 * Math.sqrt(dbGain(6)); // un diaphragme plus fermé
  assert.ok(Math.abs(videoPct(whiteLin({ lux: 20, N: N2, gain: 9 })) - w1) < 0.01);
  assert.ok(okPct(w1) && !okPct(videoPct(whiteLin({ lux: 20, N: 1.8, gain: 0 }))));
});

test('température de couleur : mireds, CC électronique, maximum d\'une lampe', () => {
  assert.ok(near(mired(3200), 312.5) && near(mired(3200) - mired(5600), 133.93, 0.01));
  assert.ok(mired(2800) - mired(3200) > 2 * (mired(5600) - mired(6300)), 'les kelvins se tassent vers le bleu');
  const c = castOf(3200, 5600);
  assert.ok(near(c[0], 1.66, 0.01) && near(c[2], 0.41, 0.01), 'réglée 5600 K, filmée en tungstène');
  const CCS = [3200, 4300, 5600, 6300];
  const closest = (T) => CCS.reduce((b, k) => (Math.abs(mired(k) - mired(T)) < Math.abs(mired(b) - mired(T)) ? k : b));
  assert.equal(closest(3600), 3200); assert.equal(closest(6500), 6300);
  assert.ok(Math.abs(mired(3600) - mired(3200)) > 10, 'à 3600 K, le préréglage ne suffit pas : il faut la balance');
  assert.ok(near(wien(3200), 905.6, 0.1));
});

test('obturateur : vitesses de la FB80 en 50 Hz, flou, angle, scintillement et clear scan', () => {
  assert.deepEqual(SHUTTERS_50.map((s) => s[0]), ['OFF', '1/60', '1/125', '1/250', '1/500', '1/1000', '1/2000']);
  assert.equal(shutterAngle(1 / 50), 360); assert.ok(near(shutterAngle(1 / 100), 180));
  // lampes sur le secteur 50 Hz : 100 Hz ; un nombre entier de vibrations ne scintille pas
  assert.ok(flicker(100, 1 / 50, 0.5) < 1e-9 && flicker(100, 1 / 100, 0.5) < 1e-9);
  assert.ok(flicker(100, 1 / 60, 0.5) > 0.05 && flicker(100, 1 / 125, 0.5) > 0.1);
  // aucune vitesse fixe plus courte que 1/90 ne tombe juste : seul l'ECS (100 ou 200 Hz) y arrive
  for (const [l, te] of SHUTTERS_50) if (te <= 1 / 90) assert.ok(flicker(100, te, 0.5) >= 0.03, l);
  assert.ok(okPct(videoPct(whiteLin({ lux: 700, N: 5.6, te: 1 / 100 }))), 'ECS 100 Hz : l\'iris rattrape');
  // l'écran à 60 Hz : la moyenne d'une période entière ne dépend pas de l'instant
  for (const t of [0, 0.003, 0.011]) assert.ok(near(pwmMean(60, 0.5, t, 1 / 60), 0.5, 1e-9));
  assert.ok(bandContrast(60, 0.5, 1 / 60) < 1e-6, 'clear scan à 60 Hz : plus de bandes');
  assert.ok(bandContrast(60, 0.5, 1 / 50) > 0.1, 'OFF : des bandes');
  // le ballon à 5 m/s : 10 cm à 1/50, 2 cm à 1/250
  assert.ok(near(5 * (1 / 50), 0.1) && near(5 * (1 / 250), 0.02));
});

test('moiré : la limite des deux photosites, et le filtre passe-bas qui efface les franges', () => {
  assert.ok(near(PITCH, 0.004995, 1e-6));
  assert.ok(near(periodPx(2, 14.9, 3), 2, 0.01), 'chemise à 3 m : deux photosites par rayure vers 15 mm');
  assert.ok(near(periodPx(3.9, 20.4, 8), 2, 0.01), 'mur LED à 8 m : vers 20 mm');
  assert.ok(Math.abs(mtf(0.5, 0, true, 5.6)) < 1e-12, 'le filtre est nul à la limite des deux photosites');
  assert.ok(near(fold(0.7), -0.3, 1e-12));
  // juste au-delà de la limite, le filtre efface presque tout ; vers un photosite par période, il laisse passer
  assert.ok(Math.abs(mtf(0.52, 0, true, 2.8)) < 0.1 * Math.abs(mtf(0.52, 0, false, 2.8)));
  assert.ok(Math.abs(mtf(0.8, 0, true, 2.8)) > 0.7 * Math.abs(mtf(0.8, 0, false, 2.8)));
  // les défis de la manipulation (iris f/2,8, rayures inclinées de 8°), pour la chemise et pour le mur LED :
  // une plage de focales où les fausses rayures se voient, une autre où le filtre les efface
  const TH = 8 * Math.PI / 180;
  for (const [p, D] of [[2, 3], [3.9, 8]]) {
    const seen = [], gone = [];
    for (let f = 4.5; f <= 54; f += 0.02) {
      const P = periodPx(p, f, D), fx = Math.cos(TH) / P, fy = Math.sin(TH) / P;
      const off = moire(fx, fy, false, 2.8), on = moire(fx, fy, true, 2.8);
      if (falseStripes(off)) { seen.push(f); assert.ok(fold(fx) < 0, 'repliées, elles penchent de l\'autre côté'); }
      if (erasedByOlpf(on, off)) gone.push(f);
      if (!off.alias) assert.ok(P >= 2 * Math.cos(TH) - 1e-6, 'pas de repliement au-delà de deux photosites');
    }
    assert.ok(seen.length > 20 && gone.length > 20, `${p} mm à ${D} m : ${seen.length} et ${gone.length} focales`);
    assert.ok(Math.min(...gone) > Math.max(...seen), 'le filtre est le plus efficace plus près de la limite des deux photosites');
  }
});

test('formats de la FB80 : débits SDI du raster complet et liaison nécessaire', () => {
  const F = FORMATS_FB80;
  assert.ok(near(sdiGbps(F['1080/50i']), 1.485) && near(sdiGbps(F['1080/25PsF']), 1.485) && near(sdiGbps(F['720/50P']), 1.485));
  assert.ok(near(sdiGbps(F['1080/50P']), 2.97));
  assert.deepEqual(Object.keys(F).map((k) => sdiFor(F[k])), ['HD', '3G', 'HD', 'HD']);
  assert.equal(pixelsPerSecond(F['1080/50P']), 2 * pixelsPerSecond(F['1080/50i']));
  assert.ok(near(F['1080/50i'].w * F['1080/50i'].h / (F['720/50P'].w * F['720/50P'].h), 2.25));
});

test('exposition : chaque défi a une solution avec les réglages proposés', () => {
  const NDS = ND.map((x) => x[1]);
  const stops = Array.from({ length: 160 }, (_, i) => 1.8 * Math.pow(16 / 1.8, i / 159));
  const solve = (lux, f, wantDof) => {
    for (const N0 of stops) {
      const N = Math.max(N0, maxAperture(f));
      for (const nd of NDS) for (const gain of GAINS.filter((g) => g <= 0)) {
        const [a, b] = dofLimits(f, N, 3);
        if (okPct(videoPct(whiteLin({ lux, N, nd, gain }))) && (!wantDof || b - a < 0.4)) return { N, nd, gain };
      }
    }
    return null;
  };
  assert.ok(solve(400, 54, true), 'plateau, fond flou');
  assert.ok(solve(10000, 54, true), 'dehors, ciel couvert, fond flou');
  assert.equal(solve(10000, 54, true).nd, 1 / 64, 'dehors, le fond flou demande le ND 1/64');
  assert.equal(minGain(15, maxAperture(20)), 6, 'le soir : +6 dB, iris grand ouvert');
  assert.ok(near(dofLimits(54, 5.6, 3)[1] - dofLimits(54, 5.6, 3)[0], 0.375, 0.002));
});
