// Progression du joueur (src/game/xp.js) : barème, niveaux, badges, fusion entre appareils.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, levelOf, award, xpOf, game, checkBadges, BADGES, mergeGame, BAREME } from '../../src/game/xp.js';
import { COMPETENCES } from '../../src/content/referentiel.js';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { allLessons } from '../../src/cours/index.js';

const fresh = () => ({ missions: {}, visited: {}, scenarios: [], reports: [], tutor: {}, cours: {} });

test('les niveaux montent avec l\'XP, le dernier n\'a pas de suivant', () => {
  assert.equal(levelOf(0).n, 1);
  assert.equal(levelOf(119).n, 1);
  assert.equal(levelOf(120).n, 2);
  assert.equal(levelOf(120).title, 'Assistant technique');
  assert.equal(levelOf(99999).next, null);
  assert.equal(levelOf(99999).pct, 1);
  for (let i = 1; i < LEVELS.length; i++) assert.ok(LEVELS[i].xp > LEVELS[i - 1].xp, 'niveaux croissants');
  const l = levelOf(200); assert.equal(l.from, 120); assert.equal(l.next, 320); assert.equal(l.remaining, 120);
});

test('une récompense à clé n\'est donnée qu\'une fois ; sans clé elle se répète', () => {
  const P = fresh();
  const a = award({ P, key: 'mission:m1', pts: BAREME.mission, label: 'Le compound' });
  assert.equal(a.pts, 25); assert.equal(a.total, 25); assert.equal(a.leveled, false);
  assert.equal(award({ P, key: 'mission:m1', pts: 25, label: 'Le compound' }), null, 'déjà donnée');
  award({ P, pts: 20, label: 'panne' }); award({ P, pts: 20, label: 'panne' });
  assert.equal(xpOf(P), 65);
  assert.equal(game(P).log.length, 3);
  assert.equal(award({ P, pts: 0, label: 'rien' }), null);
});

test('le passage de niveau est signalé', () => {
  const P = fresh();
  award({ P, pts: 100, label: 'a' });
  const r = award({ P, pts: 30, label: 'b' });
  assert.equal(r.leveled, true); assert.equal(r.level.n, 2);
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
  assert.ok(ids.includes('comp-1.4') && ids.includes('comp-2.9'), 'compétences 1.4 et 2.9 travaillées : ' + ids.join(','));
  assert.ok(!ids.includes('comp-1.4-or'), 'pas encore consolidée');
  assert.equal(BADGES.filter((b) => b.comp).length, COMPETENCES.length * 2);
  for (const b of BADGES) assert.ok(b.title && b.desc && b.ico && ['bronze', 'argent', 'or'].includes(b.tier), b.id);
  assert.equal(new Set(BADGES.map((b) => b.id)).size, BADGES.length, 'identifiants uniques');
});

test('fusion : une récompense obtenue sur l\'un des appareils reste acquise', () => {
  const A = fresh(), Bp = fresh();
  award({ P: A, key: 'mission:m1', pts: 25, label: 'a' }); award({ P: A, pts: 10, label: 'x' });
  award({ P: Bp, key: 'mission:m1', pts: 25, label: 'a' }); award({ P: Bp, key: 'mission:m2', pts: 25, label: 'b' }); award({ P: Bp, pts: 30, label: 'y' });
  game(Bp).badges['premier-pas'] = 1; game(Bp).count.panne = 3;
  const g = mergeGame(game(A), game(Bp));
  assert.equal(Object.keys(g.keys).length, 2);
  assert.equal(g.extra, 30);
  assert.equal(g.badges['premier-pas'], 1);
  assert.equal(g.count.panne, 3);
  assert.equal(xpOf({ game: g }), 80);
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
