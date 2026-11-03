// Progression du joueur (src/game/xp.js) : barème, niveaux, badges, fusion entre appareils.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, levelOf, award, xpOf, game, checkBadges, BADGES, mergeGame, BAREME, xpPourNiveau } from '../../src/game/xp.js';
import { COMPETENCES } from '../../src/content/referentiel.js';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { allLessons } from '../../src/cours/index.js';

const fresh = () => ({ missions: {}, visited: {}, scenarios: [], reports: [], tutor: {}, cours: {} });

test('les niveaux montent avec l\'XP (60 niveaux, l\'écart grandit), le dernier n\'a pas de suivant', () => {
  assert.equal(LEVELS.length, 60);
  assert.equal(levelOf(0).n, 1);
  assert.equal(levelOf(64).n, 1);
  assert.equal(levelOf(65).n, 2);
  assert.equal(levelOf(65).title, 'Stagiaire');
  assert.equal(levelOf(xpPourNiveau(5)).title, 'Assistant technique');
  assert.equal(levelOf(xpPourNiveau(60)).title, 'Directeur technique');
  assert.equal(xpPourNiveau(10), 945); assert.equal(xpPourNiveau(60), 20945);
  assert.equal(levelOf(99999).n, 60);
  assert.equal(levelOf(99999).next, null);
  assert.equal(levelOf(99999).pct, 1);
  for (let i = 1; i < LEVELS.length; i++) {
    assert.ok(LEVELS[i].xp > LEVELS[i - 1].xp, 'niveaux croissants');
    if (i > 1) assert.equal((LEVELS[i].xp - LEVELS[i - 1].xp) - (LEVELS[i - 1].xp - LEVELS[i - 2].xp), 10, 'l\'écart grandit de 10 XP par niveau');
  }
  const l = levelOf(100); assert.equal(l.from, 65); assert.equal(l.next, 140); assert.equal(l.remaining, 40);
});

test('une récompense à clé n\'est donnée qu\'une fois ; sans clé elle se répète ; le premier gain du jour ajoute le bonus de régularité', () => {
  const P = fresh();
  const at = new Date(2026, 0, 1, 10).getTime(); // défis du 1er janvier 2026 : 250 XP, exercice en autonomie, réseau
  const a = award({ P, key: 'mission:m1', pts: BAREME.mission, label: 'Le compound', at });
  assert.equal(a.pts, 25); assert.equal(a.total, 35, '25 + 10 de bonus de régularité'); assert.equal(a.leveled, false);
  assert.deepEqual(a.bonus.map((x) => x.sorte), ['serie']);
  assert.equal(award({ P, key: 'mission:m1', pts: 25, label: 'Le compound', at }), null, 'déjà donnée');
  award({ P, pts: 20, label: 'panne', sorte: 'panne', at }); award({ P, pts: 20, label: 'panne', sorte: 'panne', at });
  assert.equal(xpOf(P), 75);
  assert.equal(game(P).log.length, 4);
  assert.equal(game(P).log[0].k, 'mission', 'la sorte vient de la clé');
  assert.equal(award({ P, pts: 0, label: 'rien' }), null);
});

test('le passage de niveau est signalé', () => {
  const P = fresh();
  award({ P, pts: 40, label: 'a', at: new Date(2026, 0, 5, 10).getTime() });
  const r = award({ P, pts: 30, label: 'b', at: new Date(2026, 0, 5, 11).getTime() });
  assert.equal(r.leveled, true); assert.equal(r.level.n, 2); assert.equal(r.from, 1);
});

test('les badges : premiers pas, exercices, compétences du livret', () => {
  const P = fresh();
  assert.deepEqual(checkBadges(P).map((b) => b.id), []);
  P.visited = { melangeur: true };
  assert.deepEqual(checkBadges(P).map((b) => b.id), ['premier-pas']);
  assert.deepEqual(checkBadges(P), [], 'un badge n\'est donné qu\'une fois');
  // un exercice terminé sans aide : premier exercice, sans filet, et les compétences qu'il travaille (bronze)
  P.tutor = { 'vision-exposition': { done: true, aided: 0, hints: 0 } };
  const ids = checkBadges(P).map((b) => b.id);
  assert.ok(ids.includes('premier-exercice') && ids.includes('sans-aide'), ids.join(','));
  assert.ok(ids.includes('comp-C32') && ids.includes('comp-C23'), 'compétences C32 et C23 travaillées : ' + ids.join(','));
  assert.ok(!ids.includes('comp-C32-or'), 'pas encore consolidée');
  assert.equal(BADGES.filter((b) => b.comp).length, COMPETENCES.length * 2);
  for (const b of BADGES) assert.ok(b.title && b.desc && b.ico && ['bronze', 'argent', 'or'].includes(b.tier), b.id);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length, 'identifiants uniques');
});

test('fusion : une récompense obtenue sur l\'un des appareils reste acquise ; les jours et les défis s\'additionnent', () => {
  const A = fresh(), Bp = fresh();
  const j1 = new Date(2026, 0, 5, 10).getTime(), j2 = new Date(2026, 0, 6, 10).getTime();
  award({ P: A, key: 'mission:m1', pts: 25, label: 'a', at: j1 }); award({ P: A, pts: 10, label: 'x', at: j1 });
  award({ P: Bp, key: 'mission:m1', pts: 25, label: 'a', at: j2 }); award({ P: Bp, key: 'mission:m2', pts: 25, label: 'b', at: j2 }); award({ P: Bp, pts: 30, label: 'y', at: j2 });
  game(Bp).badges['premier-pas'] = 1; game(Bp).count.panne = 3;
  const extraB = game(Bp).extra;
  const g = mergeGame(game(A), game(Bp));
  assert.equal(Object.keys(g.keys).length, 2);
  assert.equal(g.extra, Math.max(game(A).extra, extraB));
  assert.equal(g.badges['premier-pas'], 1);
  assert.equal(g.count.panne, 3);
  assert.deepEqual(g.jours, ['2026-01-05', '2026-01-06']);
});

test('Érudit : toutes les leçons du Cours acquises (et pas une de moins)', () => {
  const ids = allLessons().map((x) => x.lesson.id);
  assert.ok(ids.length >= 30, 'les chapitres du Cours sont chargés');
  const P = fresh();
  for (const id of ids.slice(1)) P.cours[id] = { seen: true, quiz: { score: 3, total: 3 } };
  P.cours[ids[0]] = { seen: true, quiz: { score: 2, total: 3 } };
  assert.ok(!checkBadges(P).some((b) => b.id === 'erudit'), 'une leçon ratée');
  P.cours[ids[0]].quiz = { score: 3, total: 3 };
  assert.ok(checkBadges(P).some((b) => b.id === 'erudit'));
});

test('barème : une panne déjà résolue rapporte peu, plus d\'XP fantôme pour la visite', () => {
  assert.ok(BAREME.panneRefaite > 0 && BAREME.panneRefaite < BAREME.panne);
  assert.ok(!('visite' in BAREME));
});
