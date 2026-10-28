// L'émission en direct (src/emission/) : le conducteur (séquences, compte à rebours, médias à lancer au
// top, périodes du match), le compte rendu noté, les médias de l'IPDirector et le match découpé en
// périodes (avant-match, deux périodes, mi-temps, fin) dans match.js.
import '../helpers/dom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEGMENTS, DUREES, DUREES_DEFAUT, setDurees, nouveauConducteur, avance, antenneMaintenant, suspendre, prochain, segmentDe, bilan, SEUIL_EMISSION } from '../../src/emission/conducteur.js';
import { MEDIAS, ORDRE_MEDIAS, SPOTS, partieA, dureeTC } from '../../src/emission/medias.js';
import { M, initMatch, stepMatch, avantMatch, coupDEnvoi, matchEnContinu, horlogeCourt, finDePeriode } from '../../src/match.js';

const faits = (o = {}) => ({ media: null, periode: 'avant', clock: 0, dureePeriode: 600, ...o });

test('les médias : un générique de 30 s, une page de pub identifiée, un générique de fin', () => {
  assert.equal(MEDIAS['gen-debut'].duree, 30, 'le générique de début dure 30 s');
  assert.equal(MEDIAS['gen-fin'].duree, 30);
  assert.deepEqual(ORDRE_MEDIAS, ['gen-debut', 'pub', 'gen-fin']);
  const p = MEDIAS.pub;
  assert.equal(p.parties[0].quoi, 'ident', 'la pub commence par le jingle « Publicité »');
  assert.equal(p.parties[p.parties.length - 1].quoi, 'retour');
  assert.equal(p.parties[p.parties.length - 1].a, p.duree, 'les parties couvrent toute la page');
  for (let k = 1; k < p.parties.length; k++) assert.equal(p.parties[k].de, p.parties[k - 1].a, 'parties jointives');
  assert.equal(p.parties.filter((x) => x.quoi === 'spot').length, SPOTS.length);
  assert.equal(partieA('pub', 12).spot, 0);
  assert.equal(partieA('pub', 66).quoi, 'retour');
  assert.equal(dureeTC(30), '00:30:00');
  assert.equal(dureeTC(70.48), '01:10:12');
});

test('le conducteur : onze séquences, du compte à rebours à la fin d\'antenne', () => {
  assert.deepEqual(SEGMENTS.map((s) => s.id), ['attente', 'generique', 'presentation', 'mt1', 'mitemps', 'pub', 'reprise', 'mt2', 'finmatch', 'generiqueFin', 'fin']);
  assert.deepEqual(SEGMENTS.filter((s) => s.media).map((s) => s.media), ORDRE_MEDIAS, 'chaque média a sa séquence, dans l\'ordre');
  for (const s of SEGMENTS) { assert.ok(s.titre && s.quoi, s.id); if (s.media) assert.ok(MEDIAS[s.media], s.id); }
  assert.equal(DUREES.periode, 600, 'deux périodes de 10 minutes');
});

test('le compte à rebours : il se suspend, l\'antenne peut être prise tout de suite', () => {
  setDurees({ compte: 10 });
  const E = nouveauConducteur();
  assert.equal(E.compte, 10);
  avance(E, 4, faits());
  assert.equal(E.compte, 6);
  suspendre(E, true); avance(E, 3, faits()); assert.equal(E.compte, 6, 'suspendu : il ne bouge plus');
  suspendre(E, false);
  assert.deepEqual(prochain(E, faits()), { titre: 'Top antenne : générique de début', dans: 6 });
  antenneMaintenant(E);
  const ev = avance(E, 0.02, faits());
  assert.deepEqual(ev, [{ type: 'segment', id: 'generique', de: 'attente' }]);
  setDurees();
  assert.deepEqual({ ...DUREES }, { ...DUREES_DEFAUT });
});

test('un média passe quand il est lancé, et la séquence finit avec lui', () => {
  const E = nouveauConducteur(); E.i = 1; // le générique
  // pas encore lancé : on attend une action
  assert.equal(prochain(E, faits()).dans, null);
  avance(E, 1.5, faits({ media: { id: 'gen-debut', pos: 0, playing: false } }));
  const ev = avance(E, 0.5, faits({ media: { id: 'gen-debut', pos: 0.1, playing: true } }));
  assert.equal(ev[0].type, 'lance'); assert.ok(Math.abs(E.lance.generique - 1.9) < 0.01, 'retard : 1,9 s après le top');
  assert.equal(prochain(E, faits({ media: { id: 'gen-debut', pos: 20, playing: true } })).dans, 10);
  avance(E, 10, faits({ media: { id: 'gen-debut', pos: 20, playing: true } }));
  assert.equal(segmentDe(E).id, 'generique', 'le générique continue');
  const ev2 = avance(E, 0.1, faits({ media: { id: 'gen-debut', pos: 30, playing: false } }));
  assert.equal(ev2[0].id, 'presentation', 'fin du générique : la présentation');
  // un autre média sur le canal ne compte pas
  const F = nouveauConducteur(); F.i = 5;
  avance(F, 1, faits({ media: { id: 'gen-fin', pos: 3, playing: true } }));
  assert.equal(F.lance.pub, undefined);
});

test('le générique lancé depuis l\'IPDirector pendant le décompte : c\'est le top, l\'antenne est prise', () => {
  const E = nouveauConducteur();
  avance(E, 10, faits({ media: { id: 'gen-debut', pos: 0, playing: false } }));
  assert.equal(segmentDe(E).id, 'attente', 'chargé, pas lancé : on attend');
  const ev = avance(E, 0.05, faits({ media: { id: 'gen-debut', pos: 0.05, playing: true } }));
  assert.deepEqual(ev.map((e) => e.id), ['generique']);
  avance(E, 0.05, faits({ media: { id: 'gen-debut', pos: 0.1, playing: true } }));
  assert.ok(Math.abs(E.lance.generique) < 0.06, 'lancé au top');
  // la pub lancée à la mi-temps : on part en pub ; lancée pendant le jeu, elle ne change pas de séquence
  const F = nouveauConducteur(); F.i = 4;
  assert.equal(avance(F, 0.1, faits({ periode: 'mi-temps', media: { id: 'pub', pos: 0.1, playing: true } }))[0].id, 'pub');
  const G = nouveauConducteur(); G.i = 3;
  assert.deepEqual(avance(G, 0.1, faits({ periode: 1, clock: 100, media: { id: 'pub', pos: 0.1, playing: true } })), []);
});

test('un média jamais lancé : l\'émission continue sans lui, il est noté manqué', () => {
  const E = nouveauConducteur(); E.i = 5;
  const ev = avance(E, DUREES.attenteMedia + 0.1, faits({ periode: 'mi-temps', media: { id: 'pub', pos: 0, playing: false } }));
  assert.deepEqual(ev.map((e) => e.type), ['manque', 'segment']);
  assert.equal(E.manque.pub, true); assert.equal(segmentDe(E).id, 'reprise');
});

test('les périodes : la séquence suit le match (mi-temps, fin)', () => {
  const E = nouveauConducteur(); E.i = 3;
  avance(E, 30, faits({ periode: 1, clock: 30 }));
  assert.equal(segmentDe(E).id, 'mt1');
  assert.deepEqual(prochain(E, faits({ periode: 1, clock: 480 })), { titre: 'Mi-temps', dans: 120 });
  avance(E, 1, faits({ periode: 'mi-temps', clock: 600 }));
  assert.equal(segmentDe(E).id, 'mitemps');
  E.i = 7; E.t = 0;
  assert.deepEqual(prochain(E, faits({ periode: 2, clock: 1140 })), { titre: 'Fin du match', dans: 60 });
  avance(E, 1, faits({ periode: 'fin', clock: 1200 }));
  assert.equal(segmentDe(E).id, 'finmatch');
  E.i = 9; avance(E, 0.1, faits({ periode: 'fin', media: { id: 'gen-fin', pos: 0.1, playing: true } }));
  const ev = avance(E, 0.1, faits({ periode: 'fin', media: { id: 'gen-fin', pos: 30, playing: false } }));
  assert.equal(ev[0].id, 'fin'); assert.equal(E.fini, true);
  assert.deepEqual(avance(E, 5, faits()), [], 'fini : plus rien ne bouge');
});

test('le compte rendu : 100 quand tout est à l\'heure et à l\'antenne ; les médias lancés par soi', () => {
  const parfait = { medias: { 'gen-debut': { retard: 0.4, antenne: 1, par: 'vous' }, pub: { retard: 1, antenne: 0.98, par: 'vous' }, 'gen-fin': { retard: -0.5, antenne: 1, par: 'vous' } }, noir: 0, score: 1, retours: [1, 2] };
  const b = bilan(parfait);
  assert.equal(b.score, 100); assert.equal(b.parVous, 3);
  assert.equal(b.lignes.reduce((a, l) => a + l.max, 0), 100, 'barème sur 100');
  assert.match(b.lignes[4].detail, /avant le top/);
  const rate = bilan({ medias: { 'gen-debut': { retard: null, antenne: 0, par: '' }, pub: { retard: 7, antenne: 0.5, par: 'ia' }, 'gen-fin': { retard: 30, antenne: 1, par: 'vous' } }, noir: 12, score: 0.4, retours: [Infinity, 6] });
  assert.ok(rate.score < SEUIL_EMISSION, `score ${rate.score}`);
  assert.equal(rate.parVous, 1);
  assert.equal(rate.lignes[0].detail, 'jamais lancé');
  assert.match(rate.lignes[2].detail, /équipe virtuelle/);
});

test('le match par périodes : horloge arrêtée avant le coup d\'envoi, mi-temps et fin au bout du temps', () => {
  initMatch();
  assert.equal(M.periode, 'libre'); assert.equal(horlogeCourt(), true, 'le jeu libre : le match en continu');
  avantMatch(20);
  assert.equal(M.state, 'pregame'); assert.equal(M.clock, 0); assert.deepEqual(M.score, [0, 0]);
  for (let i = 0; i < 300; i++) stepMatch(0.05);
  assert.equal(M.clock, 0, 'avant-match : l\'horloge ne court pas');
  assert.equal(finDePeriode(), null);
  assert.equal(coupDEnvoi(), true); assert.equal(M.periode, 1); assert.equal(finDePeriode(), 20);
  for (let i = 0; i < 25 * 20 && M.periode === 1; i++) stepMatch(0.05);
  assert.equal(M.periode, 'mi-temps'); assert.equal(M.clock, 20, 'le sifflet à 20 s de jeu'); assert.equal(M.state, 'break');
  const dir = M.attackDir[0];
  for (let i = 0; i < 100; i++) stepMatch(0.05);
  assert.equal(M.clock, 20, 'mi-temps : l\'horloge ne court pas');
  assert.equal(coupDEnvoi(), true); assert.equal(M.periode, 2); assert.equal(M.attackDir[0], -dir, 'les équipes changent de côté');
  for (let i = 0; i < 25 * 20 && M.periode === 2; i++) stepMatch(0.05);
  assert.equal(M.periode, 'fin'); assert.equal(M.clock, 40);
  assert.equal(coupDEnvoi(), false, 'après la fin, pas de nouvelle période');
  matchEnContinu();
  assert.equal(M.periode, 'libre'); assert.equal(M.state, 'kickoff');
});

test('les musiques des médias : dans la durée du média, le coup final du générique au logo', async () => {
  const { partition } = await import('../../src/emission/musique.js');
  for (const id of ORDRE_MEDIAS) {
    const N = partition(id), dur = MEDIAS[id].duree;
    assert.ok(N.length > 50, `${id} : une vraie musique (${N.length} notes)`);
    for (let k = 1; k < N.length; k++) assert.ok(N[k].t >= N[k - 1].t, `${id} : notes triées`);
    for (const n of N) { assert.ok(n.t >= 0 && n.t < dur, `${id} : note à ${n.t} s`); assert.ok(n.t + n.d <= dur + 0.3, `${id} : note qui déborde (${n.inst} à ${n.t} s)`); assert.ok(n.v > 0 && n.v <= 1, `${id} : volume`); }
  }
  // l'indicatif : 128 bpm, 16 mesures = 30 s ; le coup final tombe sur le logo (28,1 s), dans le générique comme à l'image
  const hit = partition('gen-debut').filter((n) => n.inst === 'hit');
  assert.equal(hit.length, 1); assert.ok(Math.abs(hit[0].t - 16 * 4 * 60 / 128 + 60 / 128 * 4) < 0.01);
  // la page de pub : chaque partie a son son (jingle, trois spots, jingle de retour)
  const P = partition('pub');
  for (const p of MEDIAS.pub.parties) assert.ok(P.some((n) => n.t >= p.de && n.t < p.a), `${p.titre} : du son`);
});
