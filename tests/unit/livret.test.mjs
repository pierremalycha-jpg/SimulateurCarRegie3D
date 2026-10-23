// Livret de compétences : le référentiel (39 compétences en 4 blocs), le rattachement des
// activités (chaque parcours, mission, phase et mission réseau citée existe ; seules les
// compétences absentes du car n'ont pas d'activité) et le calcul des niveaux.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import { BLOCS, COMPETENCES, MODULES, RATTACHEMENT, blocOf } from '../../src/content/referentiel.js';
import { livret, niveauOf, activityState, codesOf, ACTIVITES, estPratique } from '../../src/livret.js';
import { ALL_STATION_LESSONS } from '../../src/tutor/lessons/index.js';
import { NET_LESSONS } from '../../src/tutor/lessons/reseau.js';
import { NET_MISSIONS } from '../../src/net/course.js';
import { PHASES } from '../../src/scenario.js';

// missions du guide : import à l'exécution (chemin calculé), pour que la vérification de types
// des tests ne suive pas toute l'interface que le guide importe
const { MISSIONS } = await import(String(new URL('../../src/ui/guide.js', import.meta.url)));

test('référentiel : 39 compétences numérotées dans l\'ordre, réparties 4 / 14 / 16 / 5', () => {
  assert.equal(COMPETENCES.length, 39);
  assert.deepEqual(BLOCS.map((b) => COMPETENCES.filter((c) => blocOf(c.code) === b).length), [4, 14, 16, 5]);
  for (const b of BLOCS) {
    const list = COMPETENCES.filter((c) => blocOf(c.code) === b);
    list.forEach((c, i) => assert.equal(c.code, `${b.n}.${i + 1}`));
  }
  for (const c of COMPETENCES) {
    assert.ok(c.titre.length > 10 && ['bien', 'partie', 'absent'].includes(c.couverture), c.code);
    for (const m of c.prevu) assert.ok(MODULES[m], `${c.code} : module ${m}`);
    if (c.couverture === 'absent') assert.ok(c.prevu.length, `${c.code} : une compétence absente dit quel module la comblera`);
  }
  const n = (k) => COMPETENCES.filter((c) => c.couverture === k).length;
  assert.deepEqual([n('bien'), n('partie'), n('absent')], [12, 18, 9]);
});

test('rattachement : chaque activité citée existe et chaque parcours pratique est rattaché', () => {
  const codes = new Set(COMPETENCES.map((c) => c.code));
  for (const table of Object.values(RATTACHEMENT)) for (const [ref, list] of Object.entries(table)) {
    assert.ok(list.length, ref);
    assert.equal(new Set(list).size, list.length, `${ref} : compétence en double`);
    for (const c of list) assert.ok(codes.has(c), `${ref} : compétence inconnue ${c}`);
  }
  const lessons = new Set([...ALL_STATION_LESSONS, ...NET_LESSONS].map((l) => l.id));
  for (const id of Object.keys(RATTACHEMENT.parcours)) assert.ok(lessons.has(id), 'parcours inconnu : ' + id);
  for (const id of lessons) assert.ok(RATTACHEMENT.parcours[id], 'parcours sans compétence : ' + id);
  for (const id of Object.keys(RATTACHEMENT.missions)) assert.ok(MISSIONS.some((m) => m.id === id), 'mission inconnue : ' + id);
  for (const id of Object.keys(RATTACHEMENT.phases)) assert.ok(PHASES.some((p) => p.id === id), 'phase inconnue : ' + id);
  for (const id of Object.keys(RATTACHEMENT.reseau)) assert.ok(NET_MISSIONS.some((m) => m.id === id), 'mission réseau inconnue : ' + id);
  assert.deepEqual(NET_MISSIONS.map((m) => m.id).filter((id) => !RATTACHEMENT.reseau[id]), [], 'mission réseau sans compétence');
  assert.deepEqual(codesOf('parcours', 'chef-depannage'), ['2.13', '3.10']);
  assert.ok(Object.keys(RATTACHEMENT.cours).length >= 19, 'leçons du Cours rattachées');
  assert.deepEqual(codesOf('parcours', 'inconnu'), []);
});

test('rattachement : exactement les 9 compétences absentes du car sont sans activité', () => {
  const sans = COMPETENCES.filter((c) => !ACTIVITES[c.code].length).map((c) => c.code);
  assert.deepEqual(sans, COMPETENCES.filter((c) => c.couverture === 'absent').map((c) => c.code));
  assert.deepEqual(sans, ['3.1', '3.2', '3.3', '3.5', '3.13', '3.15', '3.16', '4.3', '4.5']);
});

test('niveaux : à travailler, travaillée, consolidée (3 activités, ou toutes, dont un exercice pratique)', () => {
  assert.equal(niveauOf(0, 0), 'absent');
  assert.equal(niveauOf(5, 0), 'a_faire');
  assert.equal(niveauOf(5, 2), 'travaillee');
  assert.equal(niveauOf(5, 3), 'consolidee');
  assert.equal(niveauOf(2, 2), 'consolidee');
  assert.equal(niveauOf(1, 1), 'consolidee');
  // trois quiz réussis, aucun des exercices pratiques : travaillée seulement
  assert.equal(niveauOf(5, 3, { total: 2, done: 0 }), 'travaillee');
  assert.equal(niveauOf(5, 3, { total: 2, done: 1 }), 'consolidee');
  assert.equal(niveauOf(3, 3, { total: 0, done: 0 }), 'consolidee', 'sans exercice pratique rattaché, les quiz suffisent');
  assert.ok(estPratique('parcours', 'x') && estPratique('camera', 'mes') && !estPratique('cours', 'signal-422') && !estPratique('camera', 'iris'));
});

test('livret : l\'aide ne compte pas, une réussite seule reste acquise, un atelier à retravailler non plus', () => {
  // parcours terminé avec « Fais-le pour moi » : pas réussi ; refait seul (clean) : réussi, même refait ensuite avec aide
  assert.deepEqual(activityState({ tutor: { a: { done: true, aided: 2 } } }, 'parcours', 'a'), { done: false, aided: true });
  assert.deepEqual(activityState({ tutor: { a: { done: true, aided: 2, clean: true } } }, 'parcours', 'a'), { done: true, aided: false });
  assert.deepEqual(activityState({ tutor: { a: { done: true, aided: 0 } } }, 'parcours', 'a'), { done: true, aided: false });
  // mission réseau sauvée par la configuration de référence
  assert.deepEqual(activityState({ net: { missions: { n1: { pts: 5, aided: true } } } }, 'reseau', 'n1'), { done: false, aided: true });
  assert.deepEqual(activityState({ net: { missions: { n1: { pts: 5, aided: true, clean: true } } } }, 'reseau', 'n1'), { done: true, aided: false });
  // atelier : 2 erreurs au plus
  assert.equal(activityState({ rigs: [{ errs: 5 }] }, 'exercice', 'atelier').done, false, 'montage à retravailler');
  assert.equal(activityState({ rigs: [{ errs: 5 }, { errs: 2 }] }, 'exercice', 'atelier').done, true);
  // 1.4 consolidée par des quiz seuls ? non : il faut un de ses exercices pratiques
  const cours = Object.fromEntries(Object.entries(RATTACHEMENT.cours).filter(([, c]) => c.includes('1.4')).map(([id]) => [id, { seen: true, quiz: { score: 3, total: 3 } }]));
  const c14 = (p) => livret(p).comps.find((x) => x.code === '1.4');
  assert.equal(c14({ cours }).niveau, 'travaillee');
  assert.equal(c14({ cours, tutor: { 'vision-exposition': { done: true, aided: 1 } } }).niveau, 'travaillee', 'fait avec aide : ne consolide pas');
  assert.equal(c14({ cours, tutor: { 'vision-exposition': { done: true, aided: 0 } } }).niveau, 'consolidee');
});

test('livret vide : rien de travaillé, 30 compétences à travailler, 9 hors simulateur', () => {
  const L = livret({});
  assert.equal(L.total, 39);
  assert.deepEqual(L.count, { consolidee: 0, travaillee: 0, a_faire: 30, absent: 9 });
  assert.deepEqual(L.blocs.map((b) => b.comps.length), [4, 14, 16, 5]);
});

test('livret : chaque source de progression compte (parcours, missions, jour de match, réseau, exercices)', () => {
  const prog = {
    tutor: { 'chef-depannage': { done: true, aided: 1 }, 'ccu-depannage': { done: true }, 'reseau-depannage': { done: false, step: 3 } },
    missions: { m16: true },
    scenarios: [{ at: 1, score: 70, phases: [{ id: 'air', pts: 30, max: 40 }, { id: 'line', pts: 5, max: 15 }] }],
    net: { missions: { n9: { pts: 8, aided: true } }, quiz: [{ score: 40 }], exams: [{ score: 75 }] },
    patchBest: 100,
    rigs: [],
    cours: { 'signal-422': { seen: true, quiz: { score: 3, total: 3 } }, 'sdi-oeil': { seen: true, quiz: { score: 2, total: 3 } } },
  };
  assert.equal(activityState(prog, 'cours', 'signal-422').done, true, 'leçon acquise : quiz réussi en entier');
  assert.equal(activityState(prog, 'cours', 'sdi-oeil').done, false, 'quiz raté : leçon non acquise');
  assert.deepEqual(activityState(prog, 'parcours', 'chef-depannage'), { done: false, aided: true }, 'terminé avec « Fais-le pour moi » : à refaire seul');
  assert.equal(activityState(prog, 'parcours', 'reseau-depannage').done, false);
  assert.equal(activityState(prog, 'phase', 'air').done, true);
  assert.equal(activityState(prog, 'phase', 'line').done, false, 'phase sous 60 %');
  assert.deepEqual(activityState(prog, 'reseau', 'n9'), { done: false, aided: true }, 'configuration de référence chargée');
  assert.equal(activityState(prog, 'exercice', 'quiz2110').done, false);
  assert.equal(activityState(prog, 'exercice', 'examenReseau').done, true);
  assert.equal(activityState(prog, 'exercice', 'brassage').done, true);
  assert.equal(activityState(prog, 'exercice', 'atelier').done, false);

  const L = livret(prog);
  const c = (code) => L.comps.find((x) => x.code === code);
  // 2.13 dépannage : ccu-depannage, m16, air, examen réseau (chef-depannage et n9 aidés ne comptent pas)
  assert.equal(c('2.13').niveau, 'consolidee');
  assert.equal(c('2.13').done, 4);
  // 3.10 : ccu-depannage, air (chef-depannage aidé) : 2 sur 5
  assert.equal(c('3.10').niveau, 'travaillee');
  // 2.10 : brassage seul parmi ses activités
  assert.equal(c('2.10').niveau, 'travaillee');
  assert.equal(c('3.6').niveau, 'travaillee', 'examen réseau');
  assert.ok(c('1.4').acts.some((a) => a.kind === 'cours' && a.ref === 'signal-422' && a.done), 'la leçon 4:2:2 compte pour 1.4');
  assert.equal(c('1.1').niveau, 'a_faire');
  assert.equal(c('3.1').niveau, 'absent');
  const b2 = L.blocs.find((b) => b.id === 'BC02');
  assert.equal(b2.count.consolidee + b2.count.travaillee + b2.count.a_faire + b2.count.absent, 14);
});
