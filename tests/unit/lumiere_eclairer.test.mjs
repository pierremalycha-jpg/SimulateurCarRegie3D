// Le chapitre « La lumière », partie « Éclairer pour la caméra » (v19.29) : les calculs purs des leçons
// (cours/lumiere_eclairer_calc.js : projecteurs, ombre, visage au plateau, débouchage, scintillement vu à
// l'image, éclairement d'un stade) et la forme des trois leçons (compétences, savoirs, six questions à
// trois choix dont chaque choix faux est expliqué, fiches « ? » de la partie).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import '../../src/cours/liens.js';
import { lessonById } from '../../src/cours/index.js';
import { TERMS } from '../../src/content/netterms.js';
import { SOURCES, eclairage, intensiteAxe, contraste } from '../../src/labo/calc/photometrie.js';
import { angleChampDe, diametre, STADE_TV } from '../../src/labo/calc/lumiere.js';
import {
  intensiteDuFlux, fluxDuFaisceau, PROJECTEURS, projecteurById, eclairageProjecteur, eclairementHorsAxe, tailleApparente, penombre, durete,
  incidenceVisage, debouchagePour, distancePour, SOURCES_STADE, scintillementVu, imageMoyenne, frequenceLumiere, POINTS, IMPLANTATIONS, eclairementStade,
} from '../../src/cours/lumiere_eclairer_calc.js';

const pres = (a, b, tol = 0.05) => assert.ok(Math.abs(a - b) <= tol, `${a} ≠ ${b} (±${tol})`);

test('flux et intensité : I₀ = Φ ln 2 ÷ Ω, et retour ; les projecteurs du Labo gardent leurs chiffres', () => {
  pres(fluxDuFaisceau(intensiteDuFlux(10000, 20), 20), 10000, 1e-6);
  // une intégration numérique du profil en cloche retrouve le flux (petits angles)
  const th = 10, I0 = 50000; let phi = 0;
  for (let a = 0; a < 40; a += 0.01) { const r = a * Math.PI / 180; phi += I0 * Math.pow(2, -((2 * a / th) ** 2)) * 2 * Math.PI * Math.sin(r) * (0.01 * Math.PI / 180); }
  pres(phi / fluxDuFaisceau(I0, th), 1, 0.01);
  // le Fresnel et le panneau sont ceux du Labo : mêmes éclairements
  const f = eclairageProjecteur({ id: 'fresnel', angle: 30, d: 4 });
  pres(f.E, eclairage({ source: 'fresnel', angle: 30, niveau: 1, d: 4 }).E, 1e-9);
  pres(f.E, intensiteAxe(SOURCES.fresnel, 30) / 16, 1e-6);
  assert.equal(projecteurById('panneau').s, SOURCES.led);
  // le champ vaut ≈ 1,82 × le faisceau, le diamètre 2 d tan(θ/2)
  pres(f.champ / f.theta, angleChampDe(1), 1e-9); pres(angleChampDe(1), 1.82, 0.01);
  pres(f.diametre, 2 * 4 * Math.tan(15 * Math.PI / 180), 1e-9); pres(diametre(4, 30), 2.14, 0.01);
  // serrer concentre ; un angle fixe ne bouge pas ; le gradateur à 0 éteint
  for (const P of PROJECTEURS) {
    const s = eclairageProjecteur({ id: P.id, angle: P.s.angles[0], d: 5 }), l = eclairageProjecteur({ id: P.id, angle: P.s.angles[1], d: 5 });
    assert.ok(s.E >= l.E && s.E > 0 && Number.isFinite(s.E), P.id);
    assert.equal(eclairageProjecteur({ id: P.id, angle: 30, d: 5, niveau: 0 }).E, 0, `${P.id} éteint`);
  }
  // la boîte à lumière perd la moitié du flux du panneau, étalé sur 90°
  pres(fluxDuFaisceau(projecteurById('boite').s.I[0], 90), fluxDuFaisceau(SOURCES.led.I[0], 50) / 2, 1e-6);
  // distance nulle : pas de division par zéro
  assert.equal(eclairageProjecteur({ id: 'decoupe', angle: 20, d: 0 }).E, 0);
  // hors de l'axe, au bord du faisceau : à peu près la moitié (et le cos³ du plan)
  pres(eclairementHorsAxe(100, 30, 4, 4 * Math.tan(15 * Math.PI / 180)) / 100, 0.5 * Math.cos(15 * Math.PI / 180) ** 3, 1e-6);
});

test('ombre et visage : taille apparente, pénombre, incidence, débouchage, inverse du carré', () => {
  pres(tailleApparente(0.15, 3), 2.86, 0.01); pres(tailleApparente(0.9, 1.5), 33.4, 0.1);
  assert.equal(durete(tailleApparente(0.15, 3)), 'dure'); assert.equal(durete(tailleApparente(0.9, 1.5)), 'douce');
  pres(penombre(0.9, 1.5, 1), 0.6, 1e-9); assert.equal(penombre(1, 0, 1), Infinity);
  pres(incidenceVisage(0, 0), 0, 1e-9); pres(incidenceVisage(90, 0), 90, 1e-9); pres(incidenceVisage(60, 0), 60, 1e-9);
  pres(Math.cos(incidenceVisage(40, 35) * Math.PI / 180), Math.cos(40 * Math.PI / 180) * Math.cos(35 * Math.PI / 180), 1e-9);
  // débouchage pour un rapport : on retrouve le rapport
  for (const r of [2, 3, 4, 8]) pres(contraste(1200, debouchagePour(1200, r)).rapport, r, 1e-9);
  assert.equal(debouchagePour(1000, 1), Infinity);
  pres(distancePour(250, 1000, 2), 4, 1e-9);
});

test('scintillement : 100 Hz sur le 50 Hz, poses sûres, super ralentis, sources lissées', () => {
  assert.equal(frequenceLumiere(50), 100); assert.equal(frequenceLumiere(60), 120);
  const hmi = SOURCES_STADE.find((s) => s.id === 'hmi-mag').m;
  // 50 images/s : 1/50 et 1/100 s effacent l'ondulation ; 1/250 la laisse, sans battement rapide (pompage lent)
  for (const t of [1 / 50, 1 / 100]) { const r = scintillementVu(hmi, t, 50); assert.ok(!r.visible && !r.pompage && r.ondulation < 1e-6, `pose ${t}`); }
  const p = scintillementVu(hmi, 1 / 250, 50); assert.ok(!p.visible && p.pompage && p.ondulation > 0.3);
  // 150 images/s : battement de 50 Hz, 16,7 Hz relu à 50 images/s ; 300 images/s : 100 Hz, 16,7 Hz relu
  const r150 = scintillementVu(hmi, 1 / 150, 150); assert.ok(r150.visible); pres(r150.apparente, 50, 1e-9); pres(r150.auRalenti, 16.67, 0.01); assert.equal(r150.ralenti, 3);
  const r300 = scintillementVu(hmi, 1 / 300, 300); assert.ok(r300.visible); pres(r300.apparente, 100, 1e-9); pres(r300.auRalenti, 16.67, 0.01);
  // une source sans scintillement ne scintille jamais
  const sans = SOURCES_STADE.find((s) => s.id === 'sans').m;
  for (const c of [50, 100, 150, 300]) for (const t of [1 / 100, 1 / 250, 1 / c]) { const r = scintillementVu(sans, Math.min(t, 1 / c), c); assert.ok(!r.visible && !r.pompage, `sans scintillement ${c} ${t}`); }
  // la lumière moyenne d'une image : 1 sur une période entière, et son écart suit m × |sinc|
  pres(imageMoyenne(0.5, 100, 0.0013, 0.01), 1, 1e-9);
  const t = 1 / 300; let mx = 0;
  for (let a = 0; a < 0.01; a += 0.0001) mx = Math.max(mx, Math.abs(imageMoyenne(0.5, 100, a, t) - 1));
  pres(mx, scintillementVu(0.5, t, 300).ondulation, 0.002);
});

test('le stade : l\'anneau de toit tient les repères, la tribune d\'en face laisse les joueurs à contre-jour', () => {
  assert.equal(POINTS.length, 15);
  const toit = eclairementStade({ implantation: 'toit', n: 300 });
  assert.ok(toit.ev.moy >= STADE_TV.evMin && toit.ev.moy <= STADE_TV.evMax * 1.2, `Ev moyen ${toit.ev.moy}`);
  assert.ok(toit.ev.u1 >= STADE_TV.u1 && toit.ev.u2 >= STADE_TV.u2, `U1 ${toit.ev.u1}, U2 ${toit.ev.u2}`);
  // symétrie gauche-droite de l'implantation : mêmes éclairements de part et d'autre de la ligne médiane
  for (const p of toit.points) { const q = toit.points.find((x) => x.x === -p.x && x.y === p.y); pres(p.ev, q.ev, 1e-6); pres(p.eh, q.eh, 1e-6); }
  // deux fois plus de projecteurs : deux fois plus de lumière, même uniformité
  const double = eclairementStade({ implantation: 'toit', n: 600 });
  pres(double.ev.moy / toit.ev.moy, 2, 1e-9); pres(double.ev.u1, toit.ev.u1, 1e-9);
  // la tribune d'en face : un gazon éclairé, des joueurs à contre-jour pour la caméra principale
  const face = eclairementStade({ implantation: 'face', n: 300 });
  assert.ok(face.eh.moy > 1500 && face.ev.moy < 200, `Eh ${face.eh.moy}, Ev ${face.ev.moy}`);
  // quatre mâts : moins régulier que le toit ; une panne fait chuter l'uniformité
  const mats = eclairementStade({ implantation: 'mats', n: 300 }), panne = eclairementStade({ implantation: 'mats', n: 300, panne: 0 });
  assert.ok(mats.ev.u1 < toit.ev.u1 && panne.ev.u1 < mats.ev.u1);
  for (const I of IMPLANTATIONS) for (const r of [eclairementStade({ implantation: I.id, n: 50 }), eclairementStade({ implantation: I.id, n: 400, panne: 0 })]) {
    for (const p of r.points) assert.ok(Number.isFinite(p.ev) && Number.isFinite(p.eh) && p.ev >= 0 && p.eh >= 0, I.id);
    assert.ok(r.ev.u1 <= 1 && r.ev.u2 <= 1 && r.eh.u1 <= 1);
  }
});

test('les trois leçons : compétences et savoirs imposés, six questions expliquées, fiches de la partie', () => {
  const attendu = {
    'lumiere-projecteurs': [['C17', 'C31'], ['D1', 'G2', 'G3']],
    'lumiere-plateau': [['C31', 'C17', 'C23'], ['G2', 'G3', 'G4']],
    'lumiere-stade': [['C21', 'C17', 'C6'], ['G2', 'G4']],
  };
  for (const [id, [comp, sav]] of Object.entries(attendu)) {
    const f = lessonById(id); assert.ok(f, id);
    const L = f.lesson;
    assert.deepEqual(L.competences, comp, id); assert.deepEqual(L.savoirs, sav, id);
    assert.equal(L.essentials.length, 3); assert.ok(L.figure && L.demo && L.demoTitle && L.plus && L.car && L.car.text, id);
    assert.equal(L.quiz.length, 6, `${id} : six questions`);
    for (const q of L.quiz) q.choices.forEach((c, i) => { if (i !== q.answer) assert.ok(Array.isArray(c) && c[1].length > 10, `${id} : choix faux sans explication (« ${q.q} »)`); });
    for (const t of L.terms) assert.ok(TERMS[t], `${id} : fiche ${t}`);
  }
  for (const k of ['angle-faisceau', 'scintillement', 'projecteur-fresnel', 'projecteur-decoupe', 'lumiere-douce', 'eclairement-vertical', 'uniformite']) {
    const t = TERMS[k]; assert.ok(t && t.t && t.short && t.body && t.cat, k);
    for (const s of t.see || []) assert.ok(TERMS[s], `${k} → ${s}`);
  }
});
