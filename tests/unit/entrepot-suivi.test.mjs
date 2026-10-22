// L'entrepôt, ce qui a été ajouté pour finir le module : les sorties affectables d'un mélangeur
// (cfg.sorties, Carbonite), le résultat d'une mission rendue (suivi.js) que lisent l'exercice
// noté x-entrepot et le livret, et sa fusion entre deux appareils (mergeProgress).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/dom.mjs';
import { CATALOGUE } from '../../src/entrepot/catalogue/index.js';
import { B, vider, sortir, relier, regler, setSaving } from '../../src/entrepot/build.js';
import { evaluate } from '../../src/entrepot/engine.js';
import { rendre, resultat } from '../../src/entrepot/suivi.js';
import { entrepotBest, specialState } from '../../src/cours/exercices.js';
import { PROG, mergeProgress } from '../../src/shared.js';

setSaving(false);
const out = (id) => { const r = sortir(id); assert.ok(r.ok, `${id} : ${r.why}`); return r.uid; };
const link = (a, pa, b, pb) => { const r = relier({ dev: a, port: pa }, { dev: b, port: pb }); assert.ok(r.ok, `${pa} ↔ ${pb} : ${r.why}`); };

test('mélangeur : une sortie affectable (cfg.sorties) donne le programme, la prévisualisation, le multiview ou une entrée', () => {
  vider('');
  const bandeau = out('bandeau'); link(bandeau, 'in', 'mur', 'prise1');
  const carb = out('carbonite-solo13'); link(carb, 'iec', bandeau, 'out1');
  const cams = [1, 2].map((n) => { const c = out('he130'); link(c, 'dc', out('bloc-12v'), 'dc'); return c; });
  // les blocs 12 V des caméras sur le bandeau
  B.appareils.filter((a) => a.modele === 'bloc-12v').forEach((b, i) => link(b.uid, 'iec', bandeau, `out${i + 2}`));
  regler(cams[0], { format: '1080p50' }); regler(cams[1], { format: '1080p50' });
  regler(carb, { format: '1080p50' });
  cams.forEach((c, i) => link(c, 'sdi-out', carb, `sdi-in-${i + 1}`));
  const mon = out('moniteur-hdmi'); link(mon, 'iec', bandeau, 'out5');
  const outPort = CATALOGUE['carbonite-solo13'].ports.find((p) => p.id === 'sdi-out-2');
  assert.ok(outPort, 'le Carbonite a une sortie OUT 2');
  link(carb, 'sdi-out-2', mon, 'sdi-in');
  let E = evaluate(B);
  assert.equal(E.video[`${mon}:sdi-in`].label, 'PGM', 'd\'usine, une sortie OUT n donne le programme');
  regler(carb, { 'sorties.sdi-out-2': 'mv' }); E = evaluate(B);
  assert.equal(E.video[`${mon}:sdi-in`].label, 'Multiview');
  regler(carb, { 'sorties.sdi-out-2': 'pvw' }); E = evaluate(B);
  assert.equal(E.video[`${mon}:sdi-in`].label, 'PVW'); assert.equal(E.video[`${mon}:sdi-in`].via.at(-1), carb);
  regler(carb, { 'sorties.sdi-out-2': 1 }); E = evaluate(B);
  assert.equal(E.video[`${mon}:sdi-in`].src, cams[0], 'une entrée affectée ressort telle quelle');
  // l'interface GPI & Tally a une clé « sorties » qui n'est pas un objet : elle ne gêne pas le moteur
  assert.equal(typeof CATALOGUE['gpi-tally'].cfg.sorties, 'string');
});

test('suivi : « Rendre le montage » enregistre l\'essai, garde le meilleur ; l\'exercice x-entrepot et le livret le lisent', () => {
  const P = /** @type {any} */ (PROG);
  delete P.entrepot;
  assert.equal(resultat('conference'), null);
  assert.deepEqual(specialState('x-entrepot'), { done: false, text: 'pas encore faite' });
  const items = [{ id: 'cameras', ok: true }, { id: 'tally', ok: false }];
  let r = rendre('conference', { score: 45, items, budget: { used: 18000 } }, 1000);
  assert.ok(r.nouveau); assert.equal(r.best.score, 45); assert.equal(r.runs.length, 1); assert.deepEqual(r.runs[0].ok, ['cameras']);
  assert.equal(specialState('x-entrepot').done, false, '45 / 100 : pas encore réussi (60 au moins)');
  r = rendre('conference', { score: 80, items, budget: null }, 2000);
  assert.ok(r.nouveau); assert.equal(r.best.score, 80); assert.equal(r.runs[1].budget, null);
  r = rendre('conference', { score: 70, items, budget: null }, 3000);
  assert.ok(!r.nouveau); assert.equal(r.best.score, 80);
  assert.equal(entrepotBest(P, 'conference'), 80);
  assert.deepEqual(specialState('x-entrepot'), { done: true, text: 'meilleur résultat 80 / 100' });
  for (let i = 0; i < 12; i++) rendre('conference', { score: 10, items: [], budget: null }, 4000 + i);
  assert.equal(resultat('conference').runs.length, 10, 'les 10 derniers essais');
  assert.equal(resultat('conference').best.score, 80);
});

test('fusion entre deux appareils : le meilleur résultat, les essais des deux, le montage le plus récent', () => {
  const P = /** @type {any} */ (PROG);
  P.entrepot = { missions: { conference: { best: { score: 60, at: 10 }, runs: [{ score: 60, at: 10, budget: null, ok: [] }] } }, build: { appareils: [], cables: [], at: 100 } };
  mergeProgress({ entrepot: { missions: { conference: { best: { score: 90, at: 20 }, runs: [{ score: 90, at: 20, budget: null, ok: [] }, { score: 60, at: 10, budget: null, ok: [] }] }, 'plateau-iso': { best: { score: 40, at: 5 }, runs: [] } }, build: { appareils: [], cables: [], at: 50 } } });
  assert.equal(P.entrepot.missions.conference.best.score, 90);
  assert.deepEqual(P.entrepot.missions.conference.runs.map((x) => x.at), [10, 20], 'un essai déjà connu n\'est pas compté deux fois');
  assert.equal(P.entrepot.missions['plateau-iso'].best.score, 40);
  assert.equal(P.entrepot.build.at, 100, 'le montage le plus récent reste');
  mergeProgress({ entrepot: { build: { appareils: [], cables: [], at: 200 } } });
  assert.equal(P.entrepot.build.at, 200);
});
