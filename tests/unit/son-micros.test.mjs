// Le son, partie « Capter : le son et le micro » : le modèle pur (dB SPL, distance, sommes, dBu et dBV,
// sensibilité des types SM58 et SM48, gain, bruit équivalent, directivité A + B cos θ, effet de proximité,
// P48, liaison symétrique), les six leçons (partie, quiz, fiches « ? », vue 3D) et leurs deux vues 3D.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { lessonById } from '../../src/cours/index.js';
import { PARTIES_SON } from '../../src/cours/son.js';
import { vuesDeLecon, vueById } from '../../src/vues3d/catalogue.js';
import { TERMS } from '../../src/content/netterms.js';
import '../../src/content/terms_micro.js';
import * as M from '../../src/cours/son_micro_calc.js';

const pres = (a, b, e = 0.05) => Math.abs(a - b) <= e;
const IDS = ['son-acoustique', 'son-dynamique', 'son-statique', 'son-directivite', 'son-48v', 'son-liaisons'];

test('pression et décibels : 20 µPa, 94 dB SPL = 1 Pa, distance, sommes, longueur d\'onde', () => {
  assert.ok(pres(M.splDePa(20e-6), 0) && pres(M.splDePa(1), 93.98, 0.01) && pres(M.paDeSpl(120), 20, 0.01));
  assert.ok(pres(M.aDistance(90, 1, 2), 83.98, 0.01), '−6 dB par doublement');
  assert.ok(pres(M.aDistance(90, 1, 4), 77.96, 0.01));
  assert.ok(pres(M.somme(90, 90), 93.01, 0.01) && pres(M.somme(90, 90, true), 96.02, 0.01), '+3 dB indépendantes, +6 dB en phase');
  assert.ok(pres(M.longueurOnde(1000), 0.343, 1e-6) && pres(M.longueurOnde(100), 3.43, 1e-6));
  // à 1 Pa et 1 kHz, l'air bouge d'une fraction de micromètre
  assert.ok(M.deplacementAir(1, 1000) > 3e-7 && M.deplacementAir(1, 1000) < 4e-7);
});

test('tensions : 0 dBu = 0,775 V, dBu = dBV + 2,2, +4 dBu et −10 dBV', () => {
  assert.ok(pres(M.vDeDbu(0), 0.7746, 1e-4) && pres(M.vDeDbu(4), 1.228, 1e-3) && pres(M.vDeDbv(-10), 0.3162, 1e-4));
  assert.ok(pres(M.DBU_DBV, 2.218, 1e-3) && pres(M.dbuDeDbv(-10), -7.78, 0.01) && pres(M.dbuDeV(1), 2.22, 0.01));
  assert.ok(pres(M.LIGNE_PRO - M.dbuDeDbv(M.LIGNE_GP), 11.78, 0.01), '≈ 12 dB entre les deux lignes');
});

test('micros : types SM58 et SM48, gain à la console, statique plus sensible, bruit équivalent', () => {
  const { sm58, sm48, statique } = M.MICROS;
  assert.ok(pres(M.mvParPa(sm58.sens), 1.88, 0.01) && pres(M.mvParPa(sm48.sens), 1.33, 0.01));
  assert.equal(M.ecartSens('sm58', 'sm48'), 3);
  assert.ok(pres(M.sortieDbu(sm58.sens, 94), -52.28, 0.01) && pres(M.gainPour(sm58.sens, 94), 52.28, 0.01));
  assert.ok(pres(M.sortieMv(sm58.sens, 114), 18.8, 0.1), '20 dB de plus : dix fois la tension');
  assert.ok(M.mvParPa(statique.sens) > 10 && M.mvParPa(statique.sens) < 40, 'statique : ordre de grandeur 10 à 40 mV/Pa');
  // le dynamique n'a que le souffle du préampli, le statique ajoute son bruit propre
  assert.ok(pres(M.bruitEquivalent(sm58), M.EIN - M.dbuDeDbv(sm58.sens) + 94, 1e-9));
  assert.ok(M.bruitEquivalent(statique) < M.bruitEquivalent(sm58), 'un son faible garde plus de marge sur le statique');
  assert.ok(M.margeBruit(statique, 40) > M.margeBruit(sm58, 40));
});

test('directivité : A + B cos θ, trous, facteur de directivité, effet de proximité', () => {
  const D = M.DIRECTIVITES;
  assert.ok(pres(M.attenuation(D.cardio, 90), -6.02, 0.01) && M.attenuation(D.cardio, 180) < -60);
  assert.ok(pres(M.attenuation(D.hyper, 180), -6.02, 0.01) && pres(M.attenuation(D.super, 90), -8.64, 0.01));
  assert.equal(M.angleRejet(D.omni), null); assert.equal(M.angleRejet(D.cardio), 180);
  assert.ok(pres(M.angleRejet(D.hyper), 109.47, 0.01) && pres(M.angleRejet(D.super), 125.97, 0.01) && pres(M.angleRejet(D.huit), 90, 1e-9));
  assert.ok(pres(M.facteurQ(D.cardio), 3, 1e-9) && pres(M.facteurQ(D.hyper), 4, 1e-9) && pres(M.facteurDistance(D.cardio), Math.sqrt(3), 1e-9));
  assert.equal(M.proximite(D.omni, 100, 0.05), 0, 'un omni n\'a pas d\'effet de proximité');
  assert.ok(M.proximite(D.cardio, 100, 0.05) > M.proximite(D.cardio, 100, 0.5) && M.proximite(D.cardio, 100, 0.05) > M.proximite(D.cardio, 1000, 0.05), 'plus près, plus grave : plus fort');
  assert.ok(pres(M.reponse(D.cardio, 0, 100, 0.05), M.proximite(D.cardio, 100, 0.05), 1e-9) && pres(M.reponse(D.cardio, 90, 1000, 3), -6.02, 0.02));
});

test('P48 : 48 V par deux résistances de 6,81 kΩ, tension au micro, court-circuit, bobine traversée', () => {
  assert.equal(M.rFantome(), 3405);
  assert.ok(pres(M.uMicro(3), 37.785, 1e-9) && pres(M.uMicro(10), 13.95, 1e-9));
  assert.ok(pres(M.iCourtCircuit(), 14.1, 0.01));
  assert.equal(M.fuite(300, false), 0, 'liaison saine : rien ne traverse la bobine');
  assert.ok(pres(M.fuite(300, true), 6.75, 0.01));
});

test('liaison symétrique : le parasite restant, la réjection, le rapport signal / parasite', () => {
  const s = M.liaison(10, 20, true, 0.001), a = M.liaison(10, 20, false);
  assert.ok(pres(s.reste, 0.02, 1e-12) && pres(s.rejection, 60, 1e-9));
  assert.ok(a.reste === 20 && a.rejection === 0 && a.rapport < 0, 'asymétrique : tout reste');
  assert.ok(s.rapport - a.rapport > 59);
});

test('les six leçons : partie « Capter », quiz, fiches « ? », vue 3D', () => {
  assert.equal(PARTIES_SON[0], 'Capter : le son et le micro');
  for (const id of IDS) {
    const f = lessonById(id); assert.ok(f, id);
    assert.equal(f.chapter.id, 'son');
    assert.equal(f.lesson.partie, PARTIES_SON[0], `${id} : partie`);
    assert.ok(f.lesson.quiz.length >= 6, `${id} : six questions`);
    for (const q of f.lesson.quiz) for (const [k, c] of q.choices.entries()) if (k !== q.answer) assert.ok(Array.isArray(c) || q.why, `${id} : choix faux expliqué`);
    for (const t of f.lesson.terms || []) assert.ok(TERMS[t], `${id} : fiche ${t}`);
    assert.ok(vuesDeLecon(id).length >= 1, `${id} : « Voir en 3D »`);
  }
  for (const id of ['db-spl', 'dbu-dbv', 'micro-dynamique', 'micro-statique', 'directivite', 'effet-proximite', 'p48', 'liaison-symetrique']) assert.ok(TERMS[id], id);
});

test('les vues son-micro et son-capsules : au moins six étapes, chacune rattachée à une de leurs leçons', () => {
  for (const id of ['son-micro', 'son-capsules']) {
    const v = vueById(id); assert.ok(v, id);
    assert.equal(v.chapitre, 'son');
    assert.ok(v.etapes.length >= 6, `${id} : étapes`);
    for (const E of v.etapes) assert.ok(E.lecon && v.lecons.includes(E.lecon), `${id} : ${E.t}`);
    for (const l of v.lecons) assert.ok(v.etapes.some((E) => E.lecon === l), `${id} : une étape pour ${l}`);
  }
});
