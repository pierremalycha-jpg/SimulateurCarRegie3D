// Livret de compétences : le référentiel officiel (39 compétences C1 à C39 en 4 blocs et 5 unités, 112
// savoir-faire, savoirs et épreuves), le rattachement des activités (chaque parcours, mission, phase et mission
// réseau citée existe ; seules les compétences absentes du car n'ont pas d'activité) et le calcul des niveaux.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import { BLOCS, COMPETENCES, MODULES, RATTACHEMENT, blocOf, EPREUVES, SAVOIR_FAIRE, SAVOIRS, TMO, ANCIEN, codeOfficiel, competencesDe, epreuveDe } from '../../src/content/referentiel.js';
import { livret, niveauOf, activityState, codesOf, ACTIVITES, estPratique } from '../../src/livret.js';
import { ALL_STATION_LESSONS } from '../../src/tutor/lessons/index.js';
import { NET_LESSONS } from '../../src/tutor/lessons/reseau.js';
import { NET_MISSIONS } from '../../src/net/course.js';
import { PHASES } from '../../src/scenario.js';

// missions du guide : import à l'exécution (chemin calculé), pour que la vérification de types
// des tests ne suive pas toute l'interface que le guide importe
const { MISSIONS } = await import(String(new URL('../../src/ui/guide.js', import.meta.url)));

test('référentiel : 39 compétences C1 à C39 dans l\'ordre officiel, 4 blocs (4 / 14 / 16 / 5) et 5 unités', () => {
  assert.equal(COMPETENCES.length, 39);
  COMPETENCES.forEach((c, i) => { assert.equal(c.code, `C${i + 1}`); assert.equal(c.n, i + 1); });
  assert.deepEqual(BLOCS.map((b) => COMPETENCES.filter((c) => blocOf(c.code) === b).length), [4, 14, 16, 5]);
  // les unités du référentiel (page 190) : U3 et la TMO (U4) telles que les sujets les cochent, U51, U52, U6
  assert.deepEqual(competencesDe('U3').map((c) => c.code), ['C6', 'C21', 'C27', 'C32']);
  assert.deepEqual(TMO, ['C8', 'C10', 'C11', 'C14', 'C15', 'C17', 'C20', 'C22', 'C23', 'C25', 'C26', 'C31', 'C36', 'C38']);
  assert.deepEqual(competencesDe('U51').map((c) => c.code), ['C1', 'C3', 'C4', 'C7', 'C12', 'C13', 'C19', 'C24', 'C29', 'C30', 'C33', 'C34', 'C37']);
  assert.deepEqual(competencesDe('U52').map((c) => c.code), ['C2', 'C18', 'C39']);
  assert.deepEqual(competencesDe('U6').map((c) => c.code), ['C5', 'C9', 'C16', 'C28', 'C35']);
  for (const b of BLOCS) for (const c of COMPETENCES.filter((x) => blocOf(x.code) === b)) assert.ok(b.unites.includes(c.unite), `${c.code} : unité ${c.unite} dans le bloc ${b.id}`);
  for (const c of COMPETENCES) {
    assert.ok(c.titre.length > 10 && ['bien', 'partie', 'absent'].includes(c.couverture), c.code);
    assert.ok(epreuveDe(c.unite) && epreuveDe(c.unite).competences, `${c.code} : unité ${c.unite}`);
    assert.ok(c.sf.length >= 1 && c.sf.every((k) => SAVOIR_FAIRE[k]), `${c.code} : savoir-faire`);
    assert.ok(c.savoirs.length >= 1 && c.savoirs.every((k) => SAVOIRS[k]), `${c.code} : savoirs`);
    assert.ok(c.attendu.length > 20 && /^T\d/.test(c.taches), `${c.code} : résultat attendu et tâches`);
    for (const m of c.prevu) assert.ok(MODULES[m], `${c.code} : module ${m}`);
    if (c.couverture === 'absent') assert.ok(c.prevu.length, `${c.code} : une compétence absente dit quel module la comblera`);
  }
  // les 112 savoir-faire, chacun porté par une compétence et une seule ; les savoirs A1 à L12
  assert.equal(Object.keys(SAVOIR_FAIRE).length, 112);
  const portes = COMPETENCES.flatMap((c) => c.sf);
  assert.equal(new Set(portes).size, 112); assert.equal(portes.length, 112);
  assert.ok(Object.keys(SAVOIRS).length >= 140 && SAVOIRS.L12 && SAVOIRS.A1 && SAVOIRS.C9.niveau === 4);
  // les épreuves de l'option : coefficients du règlement d'examen (page 201)
  assert.deepEqual(EPREUVES.map((e) => [e.id, e.coef]), [['E1', 2], ['E2', 1], ['E3', 4], ['E4', 4], ['E51', 4], ['E52', 1], ['E6', 1]]);
  // l'ancienne numérotation du simulateur (1.1 à 4.5) se convertit
  assert.equal(Object.keys(ANCIEN).length, 39);
  assert.equal(new Set(Object.values(ANCIEN)).size, 39);
  assert.equal(ANCIEN['1.4'], 'C32'); assert.equal(ANCIEN['2.1'], 'C8'); assert.equal(ANCIEN['4.5'], 'C35');
  assert.equal(codeOfficiel('1.4'), 'C32'); assert.equal(codeOfficiel('C32'), 'C32'); assert.equal(codeOfficiel('9.9'), '');
  const n = (k) => COMPETENCES.filter((c) => c.couverture === k).length;
  assert.deepEqual([n('bien'), n('partie'), n('absent')], [12, 24, 3]);
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
  assert.deepEqual(codesOf('parcours', 'chef-depannage'), ['C36', 'C24']);
  assert.ok(Object.keys(RATTACHEMENT.cours).length >= 19, 'leçons du Cours rattachées');
  assert.deepEqual(codesOf('parcours', 'inconnu'), []);
});

test('rattachement : exactement les 3 compétences absentes du simulateur sont sans activité', () => {
  const sans = COMPETENCES.filter((c) => !ACTIVITES[c.code].length).map((c) => c.code);
  assert.deepEqual(sans, COMPETENCES.filter((c) => c.couverture === 'absent').map((c) => c.code));
  assert.deepEqual(sans, ['C7', 'C37', 'C39']);
  // les leçons de la TMO (v19.23) font entrer dans le simulateur le dossier initial, le PAD, la réception et la maintenance préventive
  for (const c of ['C1', 'C2', 'C3', 'C33', 'C16', 'C35']) assert.ok(ACTIVITES[c].some((a) => a.kind === 'cours'), `${c} : une leçon`);
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
  // C32 (mettre en conformité les signaux) consolidée par des quiz seuls ? non : il faut un de ses exercices pratiques
  const cours = Object.fromEntries(Object.entries(RATTACHEMENT.cours).filter(([, c]) => c.includes('C32')).map(([id]) => [id, { seen: true, quiz: { score: 3, total: 3 } }]));
  const c14 = (p) => livret(p).comps.find((x) => x.code === 'C32');
  assert.equal(c14({ cours }).niveau, 'travaillee');
  assert.equal(c14({ cours, tutor: { 'vision-exposition': { done: true, aided: 1 } } }).niveau, 'travaillee', 'fait avec aide : ne consolide pas');
  assert.equal(c14({ cours, tutor: { 'vision-exposition': { done: true, aided: 0 } } }).niveau, 'consolidee');
});

test('livret vide : rien de travaillé, 36 compétences à travailler, 3 hors simulateur', () => {
  const L = livret({});
  assert.equal(L.total, 39);
  assert.deepEqual(L.count, { consolidee: 0, travaillee: 0, a_faire: 36, absent: 3 });
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
  // C36 dépannage : ccu-depannage, m16, air, examen réseau (chef-depannage et n9 aidés ne comptent pas)
  assert.equal(c('C36').niveau, 'consolidee');
  assert.equal(c('C36').done, 4);
  // C24 : ccu-depannage, air (chef-depannage aidé)
  assert.equal(c('C24').niveau, 'travaillee');
  // C25 : brassage seul parmi ses activités
  assert.equal(c('C25').niveau, 'travaillee');
  assert.equal(c('C12').niveau, 'travaillee', 'examen réseau');
  assert.ok(c('C32').acts.some((a) => a.kind === 'cours' && a.ref === 'signal-422' && a.done), 'la leçon 4:2:2 compte pour C32');
  assert.equal(c('C6').niveau, 'a_faire');
  assert.equal(c('C1').niveau, 'a_faire', 'le dossier initial : la leçon du synoptique, pas encore faite');
  assert.equal(c('C7').niveau, 'absent');
  const b2 = L.blocs.find((b) => b.id === 'BC02');
  assert.equal(b2.count.consolidee + b2.count.travaillee + b2.count.a_faire + b2.count.absent, 14);
});
