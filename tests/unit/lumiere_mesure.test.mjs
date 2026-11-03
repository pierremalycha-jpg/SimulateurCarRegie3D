// Le chapitre « La lumière », partie « La lumière et sa mesure » (v19.29) : les calculs qui s'ajoutent à ceux du Labo
// (cours/lumiere_mesure_calc.js : la ligne de 16 A, l'éclairement d'un point, la limite de l'inverse du carré, la
// gélatine la plus proche, la cellule incidente et le spotmètre, la caméra de car, le gain), la forme des cinq leçons
// (compétences et savoirs du référentiel, six questions au moins, chaque choix faux expliqué, fiches « ? » connues),
// les fiches ajoutées, et les schémas et manipulations montés dans le faux DOM sans erreur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import '../../src/cours/liens.js';
import { lessonById } from '../../src/cours/index.js';
import { TERMS } from '../../src/content/netterms.js';
import { LUMIERE_MESURE } from '../../src/cours/lumiere_mesure.js';
import { mired, kelvin, ouverture } from '../../src/labo/calc/photometrie.js';
import {
  surLigne, LIGNE, eclairementPonctuel, ecartDisque, distanceSure, correction, gelPour, GELS_COULEUR, ouvertureIncidente, ouvertureSpot,
  luminancePour, grisVise, erreurSpot, C_PLATE, C_DOME, K_SPOT, ouvertureCamera, diaphsEntre, dbPourDiaphs, diaphProche,
} from '../../src/cours/lumiere_mesure_calc.js';

const pres = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);
const IDS = ['lumiere-sources', 'lumiere-grandeurs', 'lumiere-distance', 'lumiere-couleur', 'lumiere-mesure'];

test('le secteur : 1 kW sous 230 V tire 4,35 A, une ligne de 16 A porte trois projecteurs de 1 kW', () => {
  const l = surLigne(1000, 'halogene');
  pres(l.I, 4.348, 0.001); assert.equal(l.n, 3); pres(l.total, 13.04, 0.01);
  assert.equal(surLigne(2000, 'halogene').n, 1);
  assert.equal(surLigne(4000, 'halogene').n, 0, 'un projecteur de 4 kW dépasse seul la ligne');
  assert.equal(surLigne(3680, 'halogene').n, 1, '16 A × 230 V = 3 680 W, tout juste');
  assert.ok(surLigne(575, 'hmi').I > 575 / 230, 'cos φ < 1 : plus de courant pour la même puissance');
  assert.equal(LIGNE.A * LIGNE.U, 3680);
  assert.deepEqual(surLigne(0, 'led'), { I: 0, n: 0, total: 0 });
});

test('l\'éclairement d\'un point, et la limite de l\'inverse du carré près d\'une grande source', () => {
  assert.equal(eclairementPonctuel(10000, 5), 400);
  pres(eclairementPonctuel(10000, 5, 60), 200, 1e-9);
  assert.equal(eclairementPonctuel(10000, 0), 0, 'pas de division par zéro');
  pres(ecartDisque(1, 1), 0.2, 1e-9); // 20 % à une distance égale à la taille
  pres(ecartDisque(5, 1), 0.0099, 1e-4); // environ 1 % à cinq fois la taille
  pres(distanceSure(1), 4.97, 0.01); // la règle des cinq fois la taille
  assert.equal(ecartDisque(0, 1), 1);
});

test('la couleur : mireds, correction et gélatine la plus proche', () => {
  pres(mired(3200), 312.5, 1e-9); pres(kelvin(mired(3200) - 137), 5698, 1);
  pres(correction(3200, 5600), -133.9, 0.1);
  assert.equal(gelPour(3200, 5600).id, 'ctb');
  assert.equal(gelPour(5600, 3200).id, 'cto');
  assert.equal(gelPour(4300, 3200).id, 'demi-cto');
  assert.equal(gelPour(3300, 3200).id, 'aucune');
  assert.ok(GELS_COULEUR.every((g) => !g.id.startsWith('nd')), 'pas de neutres parmi les gélatines de couleur');
  for (let k = 1; k < GELS_COULEUR.length; k++) assert.ok(GELS_COULEUR[k].mired >= GELS_COULEUR[k - 1].mired, 'du froid au chaud');
});

test('la mesure : cellule incidente, spotmètre, gris visé, caméra de car, gain', () => {
  // 1 000 lx, ISO 800, 1/50 s : f/8 (même résultat que le Labo)
  pres(ouvertureIncidente(1000, 800, 1 / 50), 8, 1e-9); pres(ouverture(1000, 800, 1 / 50), 8, 1e-9);
  assert.equal(C_PLATE, 250); assert.equal(C_DOME, 330); assert.equal(K_SPOT, 12.5);
  // le spotmètre et sa réciproque
  pres(ouvertureSpot(luminancePour(5.6, 400, 1 / 50), 400, 1 / 50), 5.6, 1e-9);
  assert.equal(ouvertureSpot(0, 400, 1 / 50), 0); assert.equal(ouvertureIncidente(1000, 0, 1 / 50), 0);
  // le gris que vise le spotmètre : π K ÷ C ≈ 16 %
  pres(grisVise(), 0.157, 0.001);
  // une chemise blanche (90 %) sous-exposée d'environ 2,5 diaphs, une veste noire (4 %) surexposée d'environ 2
  pres(erreurSpot(0.9), -2.52, 0.01); pres(erreurSpot(0.04), 1.97, 0.01); assert.ok(Math.abs(erreurSpot(0.18)) < 0.25);
  // la caméra de car : f/13 à 2 000 lx (Sony HXC-FB80, 50 Hz), un diaph de moins à 1 000 lx
  pres(ouvertureCamera(2000), 13, 1e-9); pres(diaphsEntre(ouvertureCamera(1000), ouvertureCamera(2000)), 1, 1e-9);
  assert.equal(ouvertureCamera(0), 0);
  pres(dbPourDiaphs(1), 6.02, 0.01); pres(dbPourDiaphs(2), 12.04, 0.01);
  assert.equal(diaphProche(7.9), 8); assert.equal(diaphProche(5.5), 5.6); assert.equal(diaphProche(0), 1.4);
});

test('les cinq leçons : dans le chapitre, compétences et savoirs du référentiel, six questions, chaque choix faux expliqué', () => {
  assert.deepEqual(LUMIERE_MESURE.map((l) => l.id), IDS);
  const REF = {
    'lumiere-sources': [['C17', 'C23'], ['D1', 'G2']], 'lumiere-grandeurs': [['C23', 'C17'], ['G4', 'G2']], 'lumiere-distance': [['C17', 'C23'], ['G4', 'G2']],
    'lumiere-couleur': [['C32', 'C17', 'C23'], ['G4', 'D1', 'G9']], 'lumiere-mesure': [['C23', 'C32', 'C10'], ['G4', 'G9', 'C11']],
  };
  for (const L of LUMIERE_MESURE) {
    const f = lessonById(L.id); assert.ok(f && f.chapter.id === 'lumiere', L.id);
    assert.equal(L.partie, 'La lumière et sa mesure', `${L.id} : sa partie`);
    assert.deepEqual(L.competences, REF[L.id][0], `${L.id} : compétences`); assert.deepEqual(L.savoirs, REF[L.id][1], `${L.id} : savoirs`);
    assert.equal(L.essentials.length, 3); assert.ok(L.essentials.every((e) => e.includes('**')), `${L.id} : le gras sur l'essentiel`);
    assert.ok(typeof L.figure === 'function' && typeof L.demo === 'function' && L.demoTitle && L.plus && L.car && L.car.text, `${L.id} : schéma, manipulation, plus, car`);
    assert.ok(!('exercises' in L) && !('article' in L), `${L.id} : ni exercises ni article`);
    assert.ok(!/NaN|undefined|Infinity/.test(L.body + L.essentials.join('') + L.plus), `${L.id} : un nombre mal calculé dans le texte`);
    assert.ok(L.quiz.length >= 6, `${L.id} : six questions`);
    for (const q of L.quiz) {
      assert.ok(!/NaN|undefined/.test(q.q + q.why), `${L.id} : « ${q.q} »`);
      q.choices.forEach((c, k) => { if (k !== q.answer) assert.ok(Array.isArray(c) && c[1].length > 10, `${L.id} : choix faux sans explication dans « ${q.q} »`); });
    }
    for (const t of L.terms) assert.ok(TERMS[t], `${L.id} : fiche « ? » ${t}`);
  }
});

test('les fiches « ? » de la partie : l\'IRC et le TLCI, l\'efficacité, l\'angle solide, les posemètres', () => {
  for (const id of ['irc', 'efficacite-lumineuse', 'angle-solide', 'angle-faisceau', 'gelatine', 'balance-blancs', 'posemetre', 'spotmetre']) {
    const t = TERMS[id]; assert.ok(t && t.t && t.short && t.body && t.cat, id);
    for (const s of t.see || []) assert.ok(TERMS[s], `${id} → ${s}`);
  }
  assert.ok(/CIE 13\.3/.test(TERMS.irc.ref) && /3355/.test(TERMS.irc.ref) && /TLCI/.test(TERMS.irc.body));
});

test('chaque schéma et chaque manipulation se montent dans le faux DOM, sans erreur ni nombre perdu', () => {
  const d = /** @type {any} */ (globalThis.document);
  if (!d.createTextNode) d.createTextNode = (t) => ({ textContent: String(t) });
  // les curseurs et les touches : on garde leurs écouteurs pour les actionner
  const made = [];
  const create = d.createElement, createNS = d.createElementNS;
  const wrap = (e) => { e.h = {}; e.addEventListener = (k, f) => { (e.h[k] = e.h[k] || []).push(f); }; e.setAttribute = (k, v) => { e[k] = String(v); }; made.push(e); return e; };
  d.createElement = (tag) => wrap(create(tag)); d.createElementNS = (ns, tag) => wrap(createNS(ns, tag));
  const errs = []; const ce = console.error; console.error = (...a) => { errs.push(a.join(' ')); };
  try {
    for (const L of LUMIERE_MESURE) {
      made.length = 0;
      assert.ok(L.figure(), `${L.id} : schéma`);
      const host = d.createElement('div'); L.demo(host);
      const els = made.slice(), fire = (e, k) => { for (const f of e.h[k] || []) f({ target: e }); };
      const inputs = els.filter((e) => e.tagName === 'INPUT'), buttons = els.filter((e) => e.tagName === 'BUTTON');
      for (const b of [null, ...buttons]) for (const inp of inputs) for (const v of [inp.min, inp.max]) { if (b) fire(b, 'click'); inp.value = v; fire(inp, 'input'); }
      for (const e of els) assert.ok(!/NaN|undefined|Infinity/.test(String(e.textContent ?? '')), `${L.id} : « ${e.textContent} »`);
    }
  } finally { d.createElement = create; d.createElementNS = createNS; console.error = ce; }
  assert.deepEqual(errs, [], 'aucune erreur dans les manipulations');
});
