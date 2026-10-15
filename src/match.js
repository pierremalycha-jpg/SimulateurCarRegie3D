import * as THREE from 'three';
import { clamp, mulberry32, wrapAngle, lerpAngle, makeCanvas } from './util.js';
import { S, emit } from './state.js';
import { TEAMS, PLAYER_NAMES } from './data.js';
import { PITCH } from './world.js';

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
};

export function playerName(i) {
  if (i >= 22) return i === 22 ? 'Arbitre' : 'Arbitre assistant';
  const team = i < 11 ? 0 : 1; const k = i % 11;
  return PLAYER_NAMES[team][k];
}
export function playerNumber(i) { const k = i % 11; return [1, 2, 4, 5, 3, 6, 8, 10, 7, 9, 11][k]; }
export function teamOf(i) { return i < 11 ? 0 : i < 22 ? 1 : -1; }

export function initMatch() {
  M.humans = [];
  for (let i = 0; i < NH; i++) {
    const team = teamOf(i);
    const k = i % 11;
    const h = { i, team, role: i >= 22 ? (i === 22 ? 'ref' : 'ast') : (k === 0 ? 'gk' : k < 5 ? 'def' : k < 9 ? 'mid' : 'fwd'), x: 0, z: 0, vx: 0, vz: 0, heading: 0, phase: Math.random() * 6, celebrate: 0, max: i >= 22 ? 6.5 : SPEED[k], tx: 0, tz: 0, skin: 0 };
    h.skin = [0xe0b090, 0xc58c64, 0x8d5a3b, 0x5e3a24, 0xf0c8a8][Math.floor(M.rng() * 5)];
    M.humans.push(h);
  }
  setupKickoff(0, true);
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

function setupKickoff(team, instant = false) {
  M.state = 'kickoff'; M.stateT = 4; M.kickoffTeam = team; M.owner = -1;
  Object.assign(M.ball, { x: 0, y: 0.11, z: 0, vx: 0, vy: 0, vz: 0 });
  for (const h of M.humans) {
    let [x, z] = h.team >= 0 ? BASE[h.i % 11] : [0, 0];
    if (h.team >= 0) {
      const dir = M.attackDir[h.team];
      x = Math.min(x, -1.2) * dir; z = z;
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
  if (dGoal < 25 && Math.abs(h.z) < 22 && r() < 0.42 && h.role !== 'gk') {
    // tir
    const tz = (r() * 2 - 1) * 4.6; const ty = r() * 2.6;
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
  M.clock += dt;
  M.exciteG = Math.max(0.12, M.exciteG - dt * 0.05);
  M.excite[0] = M.exciteG * (b.x < 0 ? 1 : 0.55) + (M.celebrateTeam === 0 ? 0.9 : 0);
  M.excite[1] = M.exciteG * (b.x > 0 ? 1 : 0.55) + (M.celebrateTeam === 1 ? 0.9 : 0);
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
        // passe en retrait
        const mate = M.humans.find((p) => p.team === taker.team && p.i % 11 === 7);
        kick(mate.x - taker.x, mate.z - taker.z, 10, 0.3, 'pass'); M.passTarget = mate.i;
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
        if (d < 0.8 && r() < dt * 1.6) { M.owner = opp; M.lastTeam = p.team; M.decision = 0.4 + r(); emit('match', { type: 'tackle' }); }
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
    // contrôle
    if (M.state === 'play' && M.noControl <= 0 && b.y < 1.0) {
      const sp = Math.hypot(b.vx, b.vz);
      for (const p of M.humans) {
        if (p.team < 0) continue;
        const d = Math.hypot(p.x - b.x, p.z - b.z);
        const reach = p.i === M.passTarget ? 0.9 : 0.6;
        if (d < reach && r() < (p.i === M.passTarget ? 0.6 : clamp(1.2 - sp / 22, 0.08, 1) * 0.3)) {
          M.owner = p.i; M.lastTeam = p.team; M.passTarget = -1; M.decision = 0.3 + r() * 0.9;
          emit('match', { type: 'control', team: p.team });
          break;
        }
      }
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
        M.gkPlan = { team: t, z: zc, y: yc, saved: M.rng() < 0.6, t0: M.lastShot?.t };
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
    } else if (st === 'kickoff') { tx = p.tx; tz = p.tz; speedCap = 4; p.celebrate = 0; }
  } else {
    // arbitres
    if (p.role === 'ref') { tx = clamp(b.x - 6, -45, 45); tz = clamp(b.z + (b.x > 0 ? 9 : -9), -28, 28); }
    else if (p.i === 23) { tx = clamp(b.x, 0, 50); tz = 34.8; }
    else { tx = clamp(b.x, -50, 0); tz = -34.8; }
  }
  // séparation
  for (const q of M.humans) {
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
  const lam = (c) => new THREE.MeshLambertMaterial({ color: 0xffffff });
  const mk = (geo, n) => { const m = new THREE.InstancedMesh(geo, lam(), n); m.castShadow = true; m.frustumCulled = false; scene.add(m); return m; };
  R.torso = mk(new THREE.BoxGeometry(0.44, 0.58, 0.25), NH);
  R.shorts = mk(new THREE.BoxGeometry(0.42, 0.26, 0.27), NH);
  R.head = mk(new THREE.SphereGeometry(0.12, 10, 8), NH);
  const leg = new THREE.BoxGeometry(0.14, 0.86, 0.15); leg.translate(0, -0.43, 0);
  R.legs = mk(leg, NH * 2);
  const arm = new THREE.BoxGeometry(0.1, 0.6, 0.1); arm.translate(0, -0.3, 0);
  R.arms = mk(arm, NH * 2);
  const c = new THREE.Color();
  M.humans.forEach((h, i) => {
    let shirt, shorts, socks, sleeves;
    if (h.team >= 0) { const T = TEAMS[h.team]; shirt = h.role === 'gk' ? T.gk : T.shirt; sleeves = h.role === 'gk' ? T.gk : (T.sleeves ?? T.shirt); shorts = T.shorts; socks = T.socks; }
    else { shirt = 0x1e1f22; sleeves = 0x1e1f22; shorts = 0x111111; socks = 0x111111; }
    R.torso.setColorAt(i, c.setHex(shirt)); R.shorts.setColorAt(i, c.setHex(shorts)); R.head.setColorAt(i, c.setHex(h.skin));
    R.legs.setColorAt(i * 2, c.setHex(socks)); R.legs.setColorAt(i * 2 + 1, c.setHex(socks));
    R.arms.setColorAt(i * 2, c.setHex(sleeves)); R.arms.setColorAt(i * 2 + 1, c.setHex(sleeves));
  });
  // ballon
  const bc = makeCanvas(128, 64); const g = bc.getContext('2d'); g.fillStyle = '#f4f4f4'; g.fillRect(0, 0, 128, 64);
  g.fillStyle = '#222'; for (let k = 0; k < 10; k++) { g.beginPath(); g.arc((k * 29) % 128, 10 + (k % 3) * 22, 7, 0, 7); g.fill(); }
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
  R.ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), new THREE.MeshLambertMaterial({ map: bt }));
  R.ball.castShadow = true; scene.add(R.ball);
}

const _m = new THREE.Matrix4(), _b = new THREE.Matrix4(), _t = new THREE.Matrix4(), _r = new THREE.Matrix4();
function placeHuman(i, x, z, heading, phase, cel, speed) {
  const sf = Math.min(1, speed / 6);
  const bob = Math.abs(Math.sin(phase)) * 0.05 * sf;
  _b.makeRotationY(heading).setPosition(x, bob, z);
  R.torso.setMatrixAt(i, _m.copy(_b).multiply(_t.makeTranslation(0, 1.17, 0)));
  R.shorts.setMatrixAt(i, _m.copy(_b).multiply(_t.makeTranslation(0, 0.87, 0)));
  R.head.setMatrixAt(i, _m.copy(_b).multiply(_t.makeTranslation(0, 1.6, 0)));
  const sw = Math.sin(phase) * Math.min(0.75, 0.15 + speed * 0.1);
  for (let s = 0; s < 2; s++) {
    const sg = s ? 1 : -1;
    R.legs.setMatrixAt(i * 2 + s, _m.copy(_b).multiply(_t.makeTranslation(sg * 0.11, 0.88, 0)).multiply(_r.makeRotationX(sw * sg)));
    if (cel) R.arms.setMatrixAt(i * 2 + s, _m.copy(_b).multiply(_t.makeTranslation(sg * 0.27, 1.42, 0)).multiply(_r.makeRotationZ(sg * 2.7 + Math.sin(phase * 2) * 0.2)));
    else R.arms.setMatrixAt(i * 2 + s, _m.copy(_b).multiply(_t.makeTranslation(sg * 0.27, 1.42, 0)).multiply(_r.makeRotationX(-sw * sg * 0.8)).multiply(_r.makeRotationZ(sg * 0.08)));
  }
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
  for (let i = 0; i < NH; i++) {
    const k = off + SNAP.hum + i * 5;
    const f = Math.round(arr[k + 4]);
    placeHuman(i, arr[k], arr[k + 1], arr[k + 2], arr[k + 3], f % 10 === 1, Math.floor(f / 10) / 10);
  }
  R.ball.position.set(arr[off + 1], arr[off + 2], arr[off + 3]);
  R.ball.rotation.x = arr[off + 1] * 3; R.ball.rotation.z = arr[off + 3] * 3;
  for (const k of ['torso', 'shorts', 'head', 'legs', 'arms']) R[k].instanceMatrix.needsUpdate = true;
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
