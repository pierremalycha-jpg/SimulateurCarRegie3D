// @ts-check
import * as THREE from 'three';
import { clamp, mulberry32, wrapAngle, lerpAngle } from './util.js';
import { S, emit } from './state.js';
import { PLAYER_NAMES, TEAMS } from './data/match.js';
import { PITCH } from './world.js';
import { buildPeople, poseHuman, flushPeople, ballTexture, PEOPLE } from './people.js';

// ----------------------------------------------------------------------------------
// Simulation simplifiée d'un match de football (crédible vue des caméras)
// ----------------------------------------------------------------------------------
const NH = 25; // 22 joueurs + arbitre + 2 assistants
export const SNAP = { size: 232, ball: 1, hum: 4, exc: 4 + NH * 5, cams: 4 + NH * 5 + 2 };
const BASE = [[-50, 0], [-36, -24], [-38, -8], [-38, 8], [-36, 24], [-18, -22], [-20, -7], [-20, 7], [-18, 22], [-4, -8], [-4, 8]];
const SPEED = [5.5, 6.8, 6.6, 6.6, 6.8, 7.0, 6.9, 6.9, 7.0, 7.4, 7.4];

export const M = {
  humans: [], ball: { x: 0, y: 0.11, z: 0, vx: 0, vy: 0, vz: 0, spin: 0 },
  owner: -1, lastTeam: 0, passTarget: -1, decision: 1, state: 'kickoff', stateT: 3, restartTaker: -1,
  score: [0, 0], clock: 0, half: 1, attackDir: [1, -1], possession: [0, 0], shots: [0, 0], onTarget: [0, 0], corners: [0, 0],
  excite: [0.15, 0.15], exciteG: 0.2, rng: mulberry32(1234), lastGoal: null, lastEvent: null, kickoffTeam: 0, celebrateTeam: -1, scorer: -1,
  // le tirage du match (tirerMatch) : graine, forme du jour, style, temps forts ; av : l'ascendant de chaque équipe
  graine: 1234, tirage: /** @type {Tirage | null} */ (null), av: [0, 0], avT: -1,
  // périodes (l'émission en direct, src/emission/) : 'libre' = match en continu, sans fin (le jeu libre, les
  // exercices, les missions) ; sinon 'avant' (échauffement, horloge arrêtée), 1, 'mi-temps', 2, 'fin'
  periode: /** @type {'libre' | 'avant' | 1 | 'mi-temps' | 2 | 'fin'} */ ('libre'), dureePeriode: 600, kick1: 0,
};

export function playerName(i) {
  if (i >= 22) return i === 22 ? 'Arbitre' : 'Arbitre assistant';
  const team = i < 11 ? 0 : 1; const k = i % 11;
  return PLAYER_NAMES[team][k];
}
export function playerNumber(i) { const k = i % 11; return [1, 2, 4, 5, 3, 6, 8, 10, 7, 9, 11][k]; }
export function teamOf(i) { return i < 11 ? 0 : i < 22 ? 1 : -1; }

// ----------------------------------------------------------------------------------
// Le tirage du match : à chaque partie une graine nouvelle (avant, la graine était fixe et l'on revoyait le même
// match, gagné par Lens), la forme du jour de chaque équipe, le style de la rencontre et ses temps forts (des
// phases de une à quatre minutes de jeu où l'une des équipes pousse). Les niveaux viennent de data/clubs.js.
// Calcul pur : la même graine et les mêmes niveaux donnent le même tirage.
// ----------------------------------------------------------------------------------
/**
 * @typedef {{ graine: number, niveaux: number[], forme: number[], style: { id: string, label: string, tir: number }, temps: Array<{ de: number, a: number, equipe: number, k: number }> }} Tirage
 */
export const STYLES = [
  { id: 'ferme', label: 'match fermé', tir: 0.8 },
  { id: 'equilibre', label: 'match équilibré', tir: 1 },
  { id: 'ouvert', label: 'match ouvert', tir: 1.3 },
];
const CYCLE = 7200; // les temps forts sont tirés pour deux heures de jeu, puis reviennent (match en continu)
/** @returns {Tirage} */
export function tirerMatch(graine, niveaux = [TEAMS[0].niveau ?? 75, TEAMS[1].niveau ?? 75]) {
  const r = mulberry32(graine >>> 0);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  const forme = [gauss() * 0.045, gauss() * 0.045];
  const u = r(); const style = STYLES[u < 0.25 ? 0 : u < 0.7 ? 1 : 2];
  // l'équipe la plus forte pousse plus souvent, mais pas toujours
  const ecart = (niveaux[0] - niveaux[1]) / 100 * 0.6 + forme[0] - forme[1];
  const temps = []; let t = 0;
  while (t < CYCLE) { const d = 60 + r() * 180; temps.push({ de: t, a: t + d, equipe: r() < clamp(0.5 + ecart * 1.5, 0.2, 0.8) ? 0 : 1, k: 0.03 + r() * 0.1 }); t += d; }
  return { graine: graine >>> 0, niveaux: niveaux.slice(), forme, style, temps };
}
/** la force d'une équipe à un moment du match (niveau, forme, avantage du terrain pour Lens, temps fort) */
export function forceEquipe(tir, equipe, clock) {
  if (!tir) return 0.75;
  const c = ((clock % CYCLE) + CYCLE) % CYCLE;
  const ph = tir.temps.find((p) => c >= p.de && c < p.a);
  // l'écart de niveau compte, sans tout décider : la forme du jour et les temps forts pèsent autant
  return tir.niveaux[equipe] / 100 * 0.6 + tir.forme[equipe] + (equipe === 0 ? 0.02 : 0) + (ph && ph.equipe === equipe ? ph.k : 0);
}
/** l'ascendant d'une équipe sur l'autre, borné (−0,35 à 0,35) */
const ascendant = (equipe) => M.av[equipe] || 0;
function majAscendant() {
  if (Math.abs(M.clock - M.avT) < 0.5) return;
  M.avT = M.clock;
  const a = clamp(forceEquipe(M.tirage, 0, M.clock) - forceEquipe(M.tirage, 1, M.clock), -0.35, 0.35);
  M.av = [a, -a];
}
/**
 * Un nouveau match : nouvelle graine (au hasard si rien n'est donné), nouveau tirage, score et statistiques à
 * zéro, coup d'envoi tiré au sort. Les joueurs restent où ils sont : setupKickoff (ou avantMatch) les place.
 */
export function nouveauMatch(graine = Math.floor(Math.random() * 2 ** 32)) {
  M.graine = graine >>> 0; M.rng = mulberry32(M.graine); M.tirage = tirerMatch(M.graine ^ 0x5bd1e995);
  Object.assign(M, { clock: 0, score: [0, 0], possession: [0, 0], shots: [0, 0], onTarget: [0, 0], corners: [0, 0], attackDir: [1, -1], lastGoal: null, lastShot: null, celebrateTeam: -1, scorer: -1, passTarget: -1, owner: -1, gkPlan: null, avT: -1, av: [0, 0], libreT: 0 });
  // rien ne reste du match précédent (la même graine rejoue le même match)
  Object.assign(M, { passTarget2: null, dribbleDir: undefined, decision: 1, noControl: 0, lastTeam: 0, restartTaker: -1, exciteG: 0.2, excite: [0.15, 0.15] });
  for (const h of M.humans) { h.vx = 0; h.vz = 0; h.celebrate = 0; }
  stepAcc = 0;
  M.kick1 = M.rng() < 0.5 ? 0 : 1;
  emit('match', { type: 'tirage', tirage: M.tirage });
  return M.tirage;
}
/** le match en continu repart de zéro (début d'une partie au car pré-installé, aux exercices…) */
export function nouveauMatchEnContinu(graine) {
  nouveauMatch(graine);
  M.periode = 'libre';
  setupKickoff(M.kick1, true, 3);
}

export function initMatch() {
  M.humans = [];
  nouveauMatch();
  for (let i = 0; i < NH; i++) {
    const team = teamOf(i);
    const k = i % 11;
    const h = { i, team, role: i >= 22 ? (i === 22 ? 'ref' : 'ast') : (k === 0 ? 'gk' : k < 5 ? 'def' : k < 9 ? 'mid' : 'fwd'), x: 0, z: 0, vx: 0, vz: 0, heading: 0, phase: Math.random() * 6, celebrate: 0, max: i >= 22 ? 6.5 : SPEED[k], tx: 0, tz: 0, skin: 0 };
    h.skin = [0xe0b090, 0xc58c64, 0x8d5a3b, 0x5e3a24, 0xf0c8a8][Math.floor(Math.random() * 5)];
    M.humans.push(h);
  }
  setupKickoff(M.kick1, true);
}

function basePos(h, ballX = 0, ballZ = 0, attacking = false) {
  if (h.team < 0) return [0, 0];
  const k = h.i % 11; const dir = M.attackDir[h.team];
  let [bx, bz] = BASE[k];
  if (k === 0) return [dir * -50.5 * 1, clamp(ballZ * 0.2, -2.5, 2.5)];
  const shift = ballX * dir; // progression du bloc avec le ballon
  let x = bx + shift * 0.55 + (attacking ? 9 : 0);
  const zComp = 1 - 0.25 * (h.role === 'def' ? 1 : 0);
  let z = bz * zComp + ballZ * 0.35;
  x = clamp(x, -48, 46);
  return [x * dir, clamp(z, -32, 32)];
}

function setupKickoff(team, instant = false, wait = 4) {
  M.state = 'kickoff'; M.stateT = wait; M.kickoffTeam = team; M.owner = -1;
  Object.assign(M.ball, { x: 0, y: 0.11, z: 0, vx: 0, vy: 0, vz: 0 });
  for (const h of M.humans) {
    let [x, z] = h.team >= 0 ? BASE[h.i % 11] : [0, 0];
    if (h.team >= 0) {
      const dir = M.attackDir[h.team];
      x = Math.min(x, -1.2) * dir;
      if (h.team === team && (h.i % 11) >= 9) { x = (h.i % 11 === 9 ? -0.6 : -1.5) * dir; z = h.i % 11 === 9 ? 0.3 : 6; }
    }
    if (h.role === 'ref') { x = -6; z = -10; }
    if (h.i === 23) { x = 20; z = 34.6; }
    if (h.i === 24) { x = -20; z = -34.6; }
    h.tx = x; h.tz = z;
    if (instant) { h.x = x; h.z = z; h.heading = h.team === 0 ? Math.PI / 2 : -Math.PI / 2; }
    h.celebrate = 0;
  }
}

// ----------------------------------------------------------------------------------
// Périodes d'un match (l'émission en direct) : avant-match, deux périodes de dureePeriode secondes,
// mi-temps, fin. Le temps de jeu ne court que pendant les périodes ; en dehors, pas de ballon.
// ----------------------------------------------------------------------------------
/** l'horloge de jeu court-elle ? (le match en continu, ou une période en cours) */
export const horlogeCourt = (periode = M.periode) => periode === 'libre' || periode === 1 || periode === 2;
/** fin de la période en cours : à quel temps de jeu (secondes) ; null hors période */
export const finDePeriode = (periode = M.periode, duree = M.dureePeriode) => (periode === 1 ? duree : periode === 2 ? 2 * duree : null);
/** l'avant-match : un nouveau match (tirage, score à zéro), les joueurs à l'échauffement dans leur moitié, horloge à 0 */
export function avantMatch(duree = 600, graine = undefined) {
  nouveauMatch(graine);
  Object.assign(M, { periode: 'avant', dureePeriode: Math.max(10, duree) });
  setupKickoff(0, true);
  M.state = 'pregame';
  emit('match', { type: 'periode', periode: 'avant' });
}
/** coup d'envoi de la période suivante (1re après l'avant-match, 2e après la mi-temps : on change de côté) */
export function coupDEnvoi() {
  if (M.periode === 'avant') { M.periode = 1; M.clock = 0; setupKickoff(M.kick1, false, 5); }
  else if (M.periode === 'mi-temps') { M.periode = 2; M.clock = M.dureePeriode; M.attackDir = [-M.attackDir[0], -M.attackDir[1]]; setupKickoff(1 - M.kick1, false, 10); }
  else return false;
  emit('match', { type: 'periode', periode: M.periode });
  return true;
}
/** retour au match en continu (quitter l'émission) : le jeu reprend s'il était arrêté */
export function matchEnContinu() {
  const arrete = M.state === 'pregame' || M.state === 'break';
  M.periode = 'libre';
  if (arrete) setupKickoff(M.kickoffTeam || 0, false, 6);
}
// le temps de la période est écoulé : coup de sifflet, les joueurs quittent le jeu
function finPeriode() {
  const fin = M.periode === 2;
  M.clock = /** @type {number} */ (finDePeriode());
  M.periode = fin ? 'fin' : 'mi-temps';
  M.state = 'break'; M.owner = -1; M.passTarget = -1; M.celebrateTeam = -1;
  Object.assign(M.ball, { vx: 0, vz: 0, vy: 0, y: 0.11 });
  emit('match', { type: fin ? 'fulltime' : 'halftime', score: [...M.score] });
}

function nearest(team, x, z, exclude = -1) {
  let best = -1, bd = 1e9;
  for (const h of M.humans) {
    if (h.team !== team || h.i === exclude) continue;
    const d = (h.x - x) ** 2 + (h.z - z) ** 2;
    if (d < bd) { bd = d; best = h.i; }
  }
  return best;
}

function kick(dirx, dirz, speed, vy, type) {
  const b = M.ball;
  const n = Math.hypot(dirx, dirz) || 1;
  b.vx = dirx / n * speed; b.vz = dirz / n * speed; b.vy = vy;
  b.y = Math.max(b.y, 0.12);
  const owner = M.owner >= 0 ? M.humans[M.owner] : null;
  M.lastTeam = owner ? owner.team : M.lastTeam;
  M.owner = -1; M.noControl = 0.25;
  emit('match', { type: 'kick', power: speed, kind: type, x: b.x, z: b.z });
}

function decide(o) {
  const h = M.humans[o]; const dir = M.attackDir[h.team]; const r = M.rng;
  const gx = dir * PITCH.hl; const dGoal = Math.hypot(gx - h.x, h.z);
  // le tirage du match : l'équipe qui a l'ascendant tente plus et cadre mieux ; un match ouvert fait tirer davantage
  const av = ascendant(h.team), style = M.tirage ? M.tirage.style.tir : 1;
  if (dGoal < 25 && Math.abs(h.z) < 22 && r() < clamp(0.46 * style * (1 + av * 1.6), 0.15, 0.75) && h.role !== 'gk') {
    // tir
    const prec = clamp(1 - av * 0.9, 0.6, 1.4);
    const tz = (r() * 2 - 1) * 4.6 * prec; const ty = r() * 2.6 * prec;
    const dist = Math.hypot(gx - h.x, tz - h.z);
    const speed = 22 + r() * 8;
    const t = dist / speed;
    kick(gx - h.x, tz - h.z, speed, Math.min(9, (ty + 4.9 * t * t) / t * 0.75), 'shot');
    M.shots[h.team]++;
    M.lastShot = { team: h.team, t: S.simTime, from: o };
    if (Math.abs(tz) < 3.66 && ty < 2.44) M.onTarget[h.team]++;
    M.exciteG = Math.min(1, M.exciteG + 0.5);
    emit('match', { type: 'shot', team: h.team, player: o });
    return;
  }
  if (r() < 0.62 || h.role === 'gk') {
    // passe
    let best = -1, bs = -1e9;
    for (const m of M.humans) {
      if (m.team !== h.team || m.i === o || m.role === 'gk') continue;
      const dx = m.x - h.x, dz = m.z - h.z; const d = Math.hypot(dx, dz);
      if (d < 5 || d > (h.role === 'gk' ? 55 : 38)) continue;
      // marquage : distance au plus proche adversaire
      const opp = nearest(1 - h.team, m.x, m.z);
      const od = Math.hypot(M.humans[opp].x - m.x, M.humans[opp].z - m.z);
      const s = dx * dir * 0.35 + Math.min(od, 8) * 1.2 - d * 0.12 + r() * 4;
      if (s > bs) { bs = s; best = m.i; }
    }
    if (best >= 0) {
      const m = M.humans[best];
      const d = Math.hypot(m.x - h.x, m.z - h.z);
      const lofted = d > 26 && r() < 0.6;
      const speed = lofted ? 17 + d * 0.15 : clamp(9 + d * 0.38, 9, 22);
      const tt = d / speed;
      const lx = m.x + m.vx * tt * 0.8, lz = m.z + m.vz * tt * 0.8;
      kick(lx - h.x, lz - h.z, speed, lofted ? 4.9 * tt * 0.9 : 0.5, 'pass');
      M.passTarget = best; M.passTarget2 = [lx, lz];
      emit('match', { type: 'pass', team: h.team, from: o, to: best });
      return;
    }
  }
  // dribble
  M.dribbleDir = Math.atan2(dir * 1, (r() - 0.5) * 1.2 - h.z * 0.02);
  M.decision = 0.5 + r() * 1.2;
}

let stepAcc = 0;
export function stepMatch(dt) {
  stepAcc += Math.min(dt, 0.1);
  const h = 0.01;
  while (stepAcc >= h) { step(h); stepAcc -= h; S.simTime += h; }
}

function step(dt) {
  const b = M.ball; const r = M.rng;
  if (horlogeCourt()) M.clock += dt;
  majAscendant();
  M.exciteG = Math.max(0.12, M.exciteG - dt * 0.05);
  M.excite[0] = M.exciteG * (b.x < 0 ? 1 : 0.55) + (M.celebrateTeam === 0 ? 0.9 : 0);
  M.excite[1] = M.exciteG * (b.x > 0 ? 1 : 0.55) + (M.celebrateTeam === 1 ? 0.9 : 0);
  // hors du jeu (échauffement, mi-temps, fin) : pas de ballon, les joueurs seulement
  if (M.state === 'pregame' || M.state === 'break') { for (const p of M.humans) moveHuman(p, dt); return; }
  // fin de période : le sifflet attend la fin d'une célébration
  { const f = finDePeriode(); if (f != null && M.clock >= f && M.state !== 'celebration') { finPeriode(); return; } }
  if (M.state === 'celebration') {
    M.stateT -= dt;
    if (M.stateT <= 0) { M.celebrateTeam = -1; setupKickoff(1 - M.lastGoal.team); emit('match', { type: 'whistle' }); }
  } else if (M.state === 'kickoff' || M.state === 'restart') {
    M.stateT -= dt;
    if (M.stateT <= 0) {
      if (M.state === 'kickoff') {
        const taker = M.humans.find((p) => p.team === M.kickoffTeam && p.i % 11 === 9);
        M.owner = taker.i; emit('match', { type: 'whistle' }); emit('match', { type: 'kickoff' });
        M.state = 'play'; M.decision = 0.3;
        b.x = taker.x + 0.3 * M.attackDir[taker.team]; b.z = taker.z;
        // passe en retrait, assez appuyée pour arriver jusqu'au milieu (avant : 10 m/s, le ballon s'arrêtait en route
        // et le receveur courait vers la cible d'une passe précédente)
        const mate = M.humans.find((p) => p.team === taker.team && p.i % 11 === 7);
        const d = Math.hypot(mate.x - taker.x, mate.z - taker.z);
        kick(mate.x - taker.x, mate.z - taker.z, clamp(9 + d * 0.38, 9, 22), 0.3, 'pass'); M.passTarget = mate.i; M.passTarget2 = [mate.x, mate.z];
      } else {
        M.state = 'play'; M.owner = M.restartTaker; M.decision = 0.2;
      }
    }
  }

  // --- ballon ---
  if (M.owner >= 0) {
    const o = M.humans[M.owner];
    const fx = Math.sin(o.heading), fz = Math.cos(o.heading);
    const tx = o.x + fx * 0.55, tz = o.z + fz * 0.55;
    b.vx = (tx - b.x) * 12; b.vz = (tz - b.z) * 12; b.vy = 0;
    b.x += b.vx * dt; b.z += b.vz * dt; b.y = 0.11;
    M.possession[o.team] += dt;
    if (M.state === 'play') {
      M.decision -= dt;
      if (M.decision <= 0) decide(M.owner);
      // tacle adverse
      const opp = nearest(1 - o.team, b.x, b.z);
      if (opp >= 0) {
        const p = M.humans[opp]; const d = Math.hypot(p.x - b.x, p.z - b.z);
        if (d < 0.8 && r() < dt * 1.6 * clamp(1 + ascendant(p.team) * 2, 0.4, 2)) { M.owner = opp; M.lastTeam = p.team; M.decision = 0.4 + r(); emit('match', { type: 'tackle' }); }
      }
    }
  } else {
    b.vy -= 9.81 * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.y < 0.11) {
      b.y = 0.11;
      if (b.vy < -1.5) { b.vy = -b.vy * 0.5; emit('match', { type: 'bounce', v: -b.vy }); } else b.vy = 0;
      const sp = Math.hypot(b.vx, b.vz);
      if (sp > 0) { const ns = Math.max(0, sp - 3.2 * dt); b.vx *= ns / sp; b.vz *= ns / sp; }
    } else { b.vx *= 1 - 0.05 * dt; b.vz *= 1 - 0.05 * dt; }
    M.noControl = Math.max(0, (M.noControl || 0) - dt);
    // gardien
    if (M.state === 'play') goalkeeping(dt);
    // contrôle : un ballon lent se ramasse de plus loin (pied tendu) ; sinon, plusieurs joueurs pouvaient
    // l'entourer à 0,7 m sans jamais l'atteindre (ils se repoussent à moins de 1,2 m) et le match s'arrêtait
    const sp = Math.hypot(b.vx, b.vz);
    if (M.state === 'play' && M.noControl <= 0 && b.y < 1.0) {
      for (const p of M.humans) {
        if (p.team < 0) continue;
        const d = Math.hypot(p.x - b.x, p.z - b.z);
        const reach = p.i === M.passTarget || sp < 2.5 ? 0.95 : 0.6;
        if (d < reach && r() < (p.i === M.passTarget ? 0.6 : clamp(1.2 - sp / 22, 0.08, 1) * 0.3)) {
          M.owner = p.i; M.lastTeam = p.team; M.passTarget = -1; M.decision = 0.3 + r() * 0.9;
          emit('match', { type: 'control', team: p.team });
          break;
        }
      }
    }
    // passe ratée : le ballon s'arrête loin de sa cible, le receveur n'a plus de raison d'y courir
    if (M.passTarget >= 0 && sp < 1 && M.passTarget2 && Math.hypot(b.x - M.passTarget2[0], b.z - M.passTarget2[1]) > 2) M.passTarget = -1;
    // filet de sécurité : un ballon libre arrêté plus d'une seconde et demie revient au joueur le plus proche
    M.libreT = M.state === 'play' && M.owner < 0 && sp < 1 && b.y < 0.5 ? (M.libreT || 0) + dt : 0;
    if (M.libreT > 1.5) {
      let best = -1, bd = 1e9;
      for (const p of M.humans) { if (p.team < 0) continue; const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < bd) { bd = d; best = p.i; } }
      if (best >= 0 && bd < 3) { const p = M.humans[best]; M.owner = best; M.lastTeam = p.team; M.passTarget = -1; M.decision = 0.3 + r() * 0.6; M.libreT = 0; emit('match', { type: 'control', team: p.team }); }
    }
    // sorties et buts
    if (M.state === 'play') boundaries();
  }

  // --- joueurs ---
  for (const p of M.humans) moveHuman(p, dt);
}

function goalkeeping(dt) {
  const b = M.ball;
  for (const t of [0, 1]) {
    const gk = M.humans[t * 11];
    const gx = -M.attackDir[t] * PITCH.hl;
    const towards = (gx - b.x) * b.vx > 0 && Math.abs(gx - b.x) < 25;
    if (towards && Math.abs(b.vx) > 4) {
      const tt = (gx - b.x) / b.vx;
      const zc = b.z + b.vz * tt, yc = b.y + b.vy * tt - 4.9 * tt * tt;
      if (!M.gkPlan || M.gkPlan.team !== t || M.gkPlan.t0 !== M.lastShot?.t) {
        M.gkPlan = { team: t, z: zc, y: yc, saved: M.rng() < clamp(0.5 + ascendant(t) * 0.8, 0.3, 0.8), t0: M.lastShot?.t };
      }
      gk.tz = clamp(zc, -3.4, 3.4);
      if (Math.abs(gx - b.x) < 1.6 && Math.abs(zc) < 3.66 && yc < 2.44 && M.gkPlan.saved && Math.abs(gk.z - b.z) < 2.2) {
        // arrêt !
        b.vx = -b.vx * 0.35; b.vz = (M.rng() - 0.5) * 12; b.vy = 3 + M.rng() * 3; M.lastTeam = t; M.noControl = 0.3;
        M.gkPlan.saved = false;
        M.exciteG = Math.min(1, M.exciteG + 0.4);
        emit('match', { type: 'save', team: t });
      }
    }
  }
}

function boundaries() {
  const b = M.ball;
  if (Math.abs(b.x) > PITCH.hl) {
    const side = Math.sign(b.x);
    if (Math.abs(b.z) < 3.66 && b.y < 2.44) {
      // BUT
      const team = M.attackDir[0] === side ? 0 : 1;
      M.score[team]++;
      M.state = 'celebration'; M.stateT = 9; M.celebrateTeam = team;
      const scorer = M.lastShot && M.lastShot.team === team ? M.lastShot.from : nearest(team, b.x, b.z);
      M.scorer = scorer;
      M.lastGoal = { team, t: S.simTime, scorer, clock: M.clock };
      M.exciteG = 1;
      b.vx *= 0.05; b.vz *= 0.05; b.x = side * (PITCH.hl + 1.2); b.vy = 0;
      emit('match', { type: 'goal', team, scorer, score: [...M.score] });
      return;
    }
    // corner ou six mètres
    const defTeam = M.attackDir[0] === side ? 1 : 0;
    if (M.lastTeam === defTeam) {
      const att = 1 - defTeam; const cz = Math.sign(b.z || 1) * (PITCH.hw - 0.3);
      Object.assign(b, { x: side * (PITCH.hl - 0.3), z: cz, y: 0.11, vx: 0, vy: 0, vz: 0 });
      M.restartTaker = nearest(att, b.x, b.z); M.corners[att]++;
      emit('match', { type: 'out', kind: 'corner' });
    } else {
      Object.assign(b, { x: side * (PITCH.hl - 5.5), z: 4 * Math.sign(b.z || 1), y: 0.11, vx: 0, vy: 0, vz: 0 });
      M.restartTaker = defTeam * 11;
      emit('match', { type: 'out', kind: 'goalkick' });
    }
    M.state = 'restart'; M.stateT = 2.5; M.owner = -1;
    emit('match', { type: 'whistle' });
  } else if (Math.abs(b.z) > PITCH.hw) {
    const t = 1 - M.lastTeam;
    Object.assign(b, { z: Math.sign(b.z) * (PITCH.hw - 0.2), y: 0.11, vx: 0, vy: 0, vz: 0 });
    M.restartTaker = nearest(t, b.x, b.z);
    M.state = 'restart'; M.stateT = 2.0; M.owner = -1;
    emit('match', { type: 'out', kind: 'touche' });
  }
}

function moveHuman(p, dt) {
  const b = M.ball; let tx = p.tx, tz = p.tz; let speedCap = p.max;
  const st = M.state;
  if (p.team >= 0) {
    const attacking = M.owner >= 0 ? M.humans[M.owner].team === p.team : M.lastTeam === p.team;
    if (st === 'play') {
      [tx, tz] = basePos(p, b.x, b.z, attacking);
      if (p.i === M.owner) {
        const dir = M.attackDir[p.team];
        const a = M.dribbleDir ?? Math.atan2(dir, 0);
        tx = p.x + Math.sin(a) * 4; tz = p.z + Math.cos(a) * 4; speedCap = p.max * 0.72;
        if (Math.abs(tz) > 31) tz = Math.sign(tz) * 28;
      } else if (p.i === M.passTarget && M.passTarget2) {
        [tx, tz] = M.passTarget2;
      } else if (M.owner < 0 || !attacking) {
        // pressing : les 2 plus proches vont au ballon
        const n1 = nearest(p.team, b.x, b.z);
        const n2 = nearest(p.team, b.x, b.z, n1);
        if ((p.i === n1 || (p.i === n2 && !attacking)) && p.role !== 'gk') { tx = b.x + b.vx * 0.3; tz = b.z + b.vz * 0.3; }
      }
      if (p.role === 'gk') { const gx = -M.attackDir[p.team] * (PITCH.hl - 1.2); tx = gx; if (!(M.gkPlan && M.gkPlan.team === p.team && Math.abs(b.x - gx) < 25)) tz = clamp(b.z * 0.18, -2.6, 2.6); else tz = p.tz; }
    } else if (st === 'restart') {
      [tx, tz] = basePos(p, b.x, b.z, M.restartTaker >= 0 && M.humans[M.restartTaker].team === p.team);
      if (p.i === M.restartTaker) { tx = b.x - Math.sign(b.x) * 0.5; tz = b.z - Math.sign(b.z) * 0.6; }
    } else if (st === 'celebration') {
      if (p.team === M.celebrateTeam) {
        const sc = M.humans[M.scorer] || p;
        const cx = Math.sign(b.x) * 48, cz = sc.z > 0 ? 30 : -30;
        if (p.i === M.scorer) { tx = cx; tz = cz; } else { tx = sc.x - Math.sin(p.i) * 1.6; tz = sc.z - Math.cos(p.i) * 1.6; }
        p.celebrate = 1;
      } else { [tx, tz] = basePos(p, 0, 0, false); speedCap = 2.0; }
    } else if (st === 'kickoff') { tx = p.tx; tz = p.tz; speedCap = M.stateT > 5 ? 3 : 4; p.celebrate = 0; }
    else if (st === 'pregame') {
      // échauffement : petites courses autour de la place du coup d'envoi
      const a = S.simTime * 0.45 + p.i * 1.7;
      tx = p.tx + Math.sin(a) * 2.2; tz = p.tz + Math.cos(a * 0.8) * 1.6; speedCap = 2.6; p.celebrate = 0;
    } else if (st === 'break') {
      // mi-temps ou fin : chaque équipe rejoint son banc, le long de la touche Lepagnot
      const k = p.i % 11; tx = (p.team === 0 ? -16 : 4) + k * 1.1; tz = -31.5 - (k % 2) * 0.9; speedCap = 2.2; p.celebrate = 0;
    }
  } else if (st === 'pregame' || st === 'break') {
    // arbitres : au rond central à l'échauffement, vers le tunnel à la pause
    tx = st === 'pregame' ? (p.i - 23) * 2.5 : (p.i - 23) * 1.2; tz = st === 'pregame' ? -2 : -33.5; speedCap = 2;
  } else {
    // arbitres
    if (p.role === 'ref') { tx = clamp(b.x - 6, -45, 45); tz = clamp(b.z + (b.x > 0 ? 9 : -9), -28, 28); }
    else if (p.i === 23) { tx = clamp(b.x, 0, 50); tz = 34.8; }
    else { tx = clamp(b.x, -50, 0); tz = -34.8; }
  }
  // séparation (sauf pour qui dispute un ballon libre à moins de 2 m : il doit pouvoir l'atteindre)
  const dispute = st === 'play' && M.owner < 0 && p.team >= 0 && Math.hypot(b.x - p.x, b.z - p.z) < 2;
  if (!dispute) for (const q of M.humans) {
    if (q === p) continue;
    const dx = p.x - q.x, dz = p.z - q.z; const d2 = dx * dx + dz * dz;
    if (d2 < 1.4 && d2 > 1e-4 && st !== 'celebration') { const d = Math.sqrt(d2); tx += dx / d * 0.8; tz += dz / d * 0.8; }
  }
  const dx = tx - p.x, dz = tz - p.z; const dist = Math.hypot(dx, dz);
  const want = Math.min(speedCap, dist * 1.3);
  const dvx = (dist > 0.01 ? dx / dist * want : 0) - p.vx, dvz = (dist > 0.01 ? dz / dist * want : 0) - p.vz;
  const acc = 7 * dt; const dl = Math.hypot(dvx, dvz);
  if (dl > acc) { p.vx += dvx / dl * acc; p.vz += dvz / dl * acc; } else { p.vx += dvx; p.vz += dvz; }
  p.x += p.vx * dt; p.z += p.vz * dt;
  const sp = Math.hypot(p.vx, p.vz);
  let targetHeading;
  if (sp > 0.6) targetHeading = Math.atan2(p.vx, p.vz);
  else targetHeading = Math.atan2(b.x - p.x, b.z - p.z);
  p.heading = lerpAngle(p.heading, targetHeading, Math.min(1, dt * 8));
  p.phase += sp * dt * 1.65;
  p.speed = sp;
}

// ----------------------------------------------------------------------------------
// Rendu des joueurs (meshes instanciés)
// ----------------------------------------------------------------------------------
const R = {};
export function buildPlayers(scene) {
  buildPeople(scene, M.humans);
  R.ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.42, metalness: 0 }));
  R.ball.castShadow = true; scene.add(R.ball);
}

// --- instantanés (pour l'EVS et la latence HF) ---
export function writeSnapshot(arr, off, cams) {
  arr[off] = S.simTime;
  const b = M.ball; arr[off + 1] = b.x; arr[off + 2] = b.y; arr[off + 3] = b.z;
  for (let i = 0; i < NH; i++) {
    const h = M.humans[i]; const k = off + SNAP.hum + i * 5;
    arr[k] = h.x; arr[k + 1] = h.z; arr[k + 2] = h.heading; arr[k + 3] = h.phase; arr[k + 4] = Math.round(Math.min(h.speed || 0, 9.9) * 10) * 10 + (h.celebrate ? 1 : 0);
  }
  arr[off + SNAP.exc] = M.excite[0]; arr[off + SNAP.exc + 1] = M.excite[1];
  for (const cam of cams) {
    if (cam.id < 1 || cam.id > 16) continue;
    const k = off + SNAP.cams + (cam.id - 1) * 6;
    arr[k] = cam.cam.position.x; arr[k + 1] = cam.cam.position.y; arr[k + 2] = cam.cam.position.z; arr[k + 3] = cam.yaw.v; arr[k + 4] = cam.pitch.v; arr[k + 5] = cam.cam.fov;
  }
}

export function applySnapshot(arr, off = 0) {
  PEOPLE.ball.set(arr[off + 1], arr[off + 2], arr[off + 3]); PEOPLE.time = arr[off];
  for (let i = 0; i < NH; i++) {
    const k = off + SNAP.hum + i * 5;
    const f = Math.round(arr[k + 4]);
    poseHuman(i, arr[k], arr[k + 1], arr[k + 2], arr[k + 3], f % 10 === 1, Math.floor(f / 10) / 10);
  }
  R.ball.position.set(arr[off + 1], arr[off + 2], arr[off + 3]);
  R.ball.rotation.x = arr[off + 3] / 0.11; R.ball.rotation.z = -arr[off + 1] / 0.11;
  flushPeople();
}

// Tampon circulaire d'enregistrement (50 Hz, 150 s)
export const REC = { rate: 50, cap: 50 * 150, buf: null, count: 0, head: 0, t0: 0, nextT: 0 };
export function initRecorder() { REC.buf = new Float32Array(REC.cap * SNAP.size); }
export function record(cams) {
  while (S.simTime >= REC.nextT) {
    writeSnapshot(REC.buf, REC.head * SNAP.size, cams);
    REC.buf[REC.head * SNAP.size] = REC.nextT;
    REC.head = (REC.head + 1) % REC.cap; REC.count = Math.min(REC.cap, REC.count + 1);
    REC.nextT += 1 / REC.rate;
  }
}
export function recRange() {
  if (!REC.count) return [0, 0];
  const first = (REC.head - REC.count + REC.cap) % REC.cap;
  const last = (REC.head - 1 + REC.cap) % REC.cap;
  return [REC.buf[first * SNAP.size], REC.buf[last * SNAP.size]];
}
// interpolation entre deux images enregistrées
export function sampleRec(t, out) {
  const [t0, t1] = recRange();
  if (!REC.count || t < t0 || t > t1) return false;
  const fi = (t - t0) * REC.rate;
  const i0 = Math.floor(fi); const a = fi - i0;
  const first = (REC.head - REC.count + REC.cap) % REC.cap;
  const k0 = ((first + i0) % REC.cap) * SNAP.size;
  const k1 = ((first + Math.min(i0 + 1, REC.count - 1)) % REC.cap) * SNAP.size;
  const B = REC.buf;
  for (let j = 0; j < SNAP.size; j++) out[j] = B[k0 + j] + (B[k1 + j] - B[k0 + j]) * a;
  // angles : interpolation correcte
  for (let i = 0; i < NH; i++) {
    const k = SNAP.hum + i * 5 + 2;
    out[k] = B[k0 + k] + wrapAngle(B[k1 + k] - B[k0 + k]) * a;
    out[k + 2] = B[a < 0.5 ? k0 + k + 2 : k1 + k + 2];
  }
  for (let c = 0; c < 16; c++) {
    const k = SNAP.cams + c * 6 + 3;
    out[k] = B[k0 + k] + wrapAngle(B[k1 + k] - B[k0 + k]) * a;
  }
  out[0] = t;
  return true;
}
export const LIVE = new Float32Array(SNAP.size);
export function captureLive(cams) { writeSnapshot(LIVE, 0, cams); }
export { NH };
