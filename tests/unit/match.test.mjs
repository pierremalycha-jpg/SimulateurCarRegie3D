// Le match simulé (src/match.js) : plus de ballon abandonné au milieu de joueurs qui tournent autour, un tirage
// différent à chaque partie (forme du jour, style, temps forts), les adversaires de Ligue 1 (data/clubs.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { M, initMatch, stepMatch, avantMatch, coupDEnvoi, nouveauMatchEnContinu, tirerMatch, forceEquipe, STYLES } from '../../src/match.js';
import { TEAMS, PLAYER_NAMES, setAdversaire } from '../../src/data/match.js';
import { CLUBS, clubById, effectif, clubAuHasard, NIVEAU_LENS } from '../../src/data/clubs.js';

initMatch();
/** joue `duree` secondes de jeu ; renvoie le plus long arrêt d'un ballon libre et immobile en jeu */
function joue(duree) {
  let libre = 0, pire = 0;
  for (let t = 0; t < duree; t += 0.05) {
    stepMatch(0.05);
    if (M.state === 'play' && M.owner < 0 && Math.hypot(M.ball.vx, M.ball.vz) < 0.5) { libre += 0.05; pire = Math.max(pire, libre); } else libre = 0;
  }
  return pire;
}

// un match réellement figé par l'ancienne IA (relevé dans une série de simulations) : ballon arrêté, deux
// Lensois et un adversaire autour, à 0,6 à 0,8 m, qui se repoussent (moins de 1,2 m) sans jamais entrer dans le
// rayon de contrôle (0,6 m) ; le receveur d'une passe ratée court vers une cible lointaine. L'ancien code y restait.
const FIGE = { b: [2.427, -20.521], lastTeam: 0, passTarget: 9, pt2: [3.259, -3.414], attackDir: [1, -1], clock: 254.85,
  h: [[-51.3, -2.59, 0, 0, 1.8929], [-25.6644, -25.1723, 0, 0, -17.4429], [-27.6644, -13.1723, 0, 0, 1.8103], [-27.6644, -1.1723, 0, 0, 8.4254], [-25.6644, 10.8277, 0, 0, -22.7218], [2.6645, -21.1616, -0.4836, -0.1957, -6.7243], [-9.6637, -14.1724, 0, 0, -16.7953], [-9.6644, -0.1723, 0, 0, -16.2441], [-7.6644, 14.8277, 0, 0, -9.7029], [3.2492, -3.4116, 0, 0, 3.1896], [6.3358, 0.8276, 0, 0, 3.3227], [51.3, -2.59, 0, 0, -1.9224], [37.3356, -25.1723, 0, 0, 4.8449], [39.3356, -13.1723, 0, 0, 4.5159], [39.3356, -1.1723, 0, 0, -2.0536], [37.3356, 10.8277, 0, 0, 10.2639], [19.3356, -29.1723, 0, 0, 42.8844], [21.3356, -14.1723, 0, 0, 42.0876], [21.3356, -0.1723, 0, 0, -14.9592], [19.3356, 14.8277, 0, 0, 3.5878], [2.8645, -19.9958, 0.3467, -0.3435, 16.3166], [1.7535, -20.4024, 0.0751, 0.5156, -10.908], [-3.5721, -11.5109, 0, 0, 2.5542], [2.4369, 34.8, 0, 0, -3.1414], [-0.0099, -34.8, 0, 0, 0.169]] };
test('le ballon libre ne reste jamais abandonné : le match figé de l\'ancienne IA repart', () => {
  nouveauMatchEnContinu(11); joue(6);
  Object.assign(M, { state: 'play', owner: -1, lastTeam: FIGE.lastTeam, passTarget: FIGE.passTarget, passTarget2: FIGE.pt2, attackDir: FIGE.attackDir, clock: FIGE.clock, noControl: 0 });
  Object.assign(M.ball, { x: FIGE.b[0], y: 0.11, z: FIGE.b[1], vx: 0, vy: 0, vz: 0 });
  FIGE.h.forEach(([x, z, vx, vz, heading], i) => Object.assign(M.humans[i], { x, z, vx, vz, heading }));
  for (let t = 0; t < 2 && M.owner < 0; t += 0.05) stepMatch(0.05);
  assert.ok(M.owner >= 0, 'un joueur a repris le ballon');
  // et sur des matchs entiers, aucun ballon abandonné
  for (const g of [1, 7, 99, 2026]) {
    nouveauMatchEnContinu(g);
    const pire = joue(240);
    assert.ok(pire < 3, `graine ${g} : ballon abandonné ${pire.toFixed(1)} s`);
  }
});

test('le coup d\'envoi : la passe arrive au milieu, le jeu s\'engage', () => {
  nouveauMatchEnContinu(42);
  joue(12);
  assert.equal(M.state, 'play');
  assert.ok(M.possession[0] + M.possession[1] > 3, 'quelqu\'un a le ballon');
});

test('le tirage : même graine, même match ; une autre graine, un autre tirage', () => {
  const run = (g) => { avantMatch(120, g); coupDEnvoi(); joue(120); return JSON.stringify([M.score, M.shots, Math.round(M.possession[0])]); };
  assert.equal(run(2024), run(2024), 'une graine donne toujours le même match');
  const a = tirerMatch(1), b = tirerMatch(2);
  assert.notDeepEqual(a.forme, b.forme);
  for (const t of [a, b]) {
    assert.ok(STYLES.includes(t.style));
    assert.ok(t.forme.every((f) => Math.abs(f) < 0.3), 'une forme du jour mesurée');
    // les temps forts couvrent deux heures de jeu, sans trou
    for (let k = 1; k < t.temps.length; k++) assert.equal(t.temps[k].de, t.temps[k - 1].a);
    assert.ok(t.temps[t.temps.length - 1].a >= 7200);
    assert.ok(t.temps.some((p) => p.equipe === 0) && t.temps.some((p) => p.equipe === 1), 'chaque équipe a ses temps forts');
  }
});

test('le résultat n\'est pas écrit d\'avance : sur dix matchs, plusieurs scores, et Lens ne gagne pas tout', () => {
  setAdversaire('lille');
  const scores = new Set(); let lensGagne = 0;
  for (let g = 0; g < 10; g++) { avantMatch(300, 300 + g); coupDEnvoi(); joue(300); scores.add(M.score.join('-')); if (M.score[0] > M.score[1]) lensGagne++; }
  assert.ok(scores.size >= 3, `scores : ${[...scores].join(', ')}`);
  assert.ok(lensGagne < 10, 'Lens a perdu ou fait match nul au moins une fois');
});

test('la force d\'une équipe : le niveau compte, l\'avantage du terrain aussi, sans tout décider', () => {
  const t = tirerMatch(5, [76, 90]);
  const f0 = forceEquipe(t, 0, 10), f1 = forceEquipe(t, 1, 10);
  assert.ok(Number.isFinite(f0) && Number.isFinite(f1));
  // à forme égale et hors temps fort, l'écart vient du niveau (×0,6) et du terrain (+0,02 pour Lens)
  const neutre = { ...t, forme: [0, 0], temps: [{ de: 0, a: 7200, equipe: 0, k: 0 }] };
  assert.ok(Math.abs(forceEquipe(neutre, 1, 0) - forceEquipe(neutre, 0, 0) - (0.14 * 0.6 - 0.02)) < 1e-9);
});

test('les adversaires : des clubs de Ligue 1, leur tenue, leurs joueurs fictifs', () => {
  assert.ok(CLUBS.length >= 15);
  const ids = new Set();
  for (const c of CLUBS) {
    assert.ok(!ids.has(c.id), `${c.id} en double`); ids.add(c.id);
    for (const k of ['shirt', 'sleeves', 'shorts', 'socks', 'gk', 'num']) assert.equal(typeof c[k], 'number', `${c.id} : ${k}`);
    assert.match(c.color, /^#[0-9a-f]{6}$/i); assert.ok(c.short.length >= 2 && c.short.length <= 4, c.short);
    assert.ok(c.niveau > 40 && c.niveau < 100); assert.ok(c.appel && c.name === c.name.toUpperCase());
    const e = effectif(c.id);
    assert.equal(e.length, 11); assert.equal(new Set(e).size, 11, `${c.id} : onze joueurs différents`);
    assert.deepEqual(effectif(c.id), e, 'toujours le même effectif pour un club');
  }
  assert.ok(clubById('psg') && clubById('om') && clubById('lille'), 'le PSG, l\'OM, Lille');
  assert.equal(clubById('lens'), null, 'Lens ne joue pas contre lui-même');
  assert.ok(NIVEAU_LENS > 0); assert.ok(CLUBS.includes(clubAuHasard(0.5)));
  // l'adversaire choisi remplace TEAMS[1] et ses joueurs, mêmes objets (tout ce qui les lit suit)
  const t1 = TEAMS[1], noms = PLAYER_NAMES[1];
  assert.equal(setAdversaire('om').id, 'om');
  assert.equal(TEAMS[1], t1); assert.equal(PLAYER_NAMES[1], noms);
  assert.equal(TEAMS[1].name, 'OLYMPIQUE DE MARSEILLE'); assert.deepEqual(PLAYER_NAMES[1], effectif('om'));
  assert.equal(setAdversaire('inconnu'), null); assert.equal(TEAMS[1].id, 'om');
  assert.equal(TEAMS[0].name, 'RC LENS');
});
