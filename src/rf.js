// @ts-check
import * as THREE from 'three';
import { S } from './state.js';
import { CN_REQ, cofdmBitrate, buildChannels } from './data/rf.js';
import { ANTENNAS } from './data/stadium.js';
import { standAt, standHeightAt, inWalkZone, W } from './world.js';
import { clamp, gauss, powDbToLin, linToPowDb, rand } from './util.js';

export const RF = { channels: buildChannels(), antennas: ANTENNAS.map((a) => ({ ...a })), t: 0 };
S.antennas = RF.antennas;
const NF = 4, ENV_NOISE = 12, IMPL = 1.5;
const GI_PEN = { '1/4': 0, '1/8': 0.3, '1/16': 0.7, '1/32': 1.2 };
export const LATENCY = { normale: { frames: 3, eff: 1, label: 'Normale (≈ 60 ms)' }, basse: { frames: 2, eff: 0.9, label: 'Basse (≈ 40 ms)' }, ultra: { frames: 1, eff: 0.7, label: 'Ultra-basse (≈ 20 ms)' } };

// matière traversée par le rayon émetteur -> antenne
function solidAt(x, y, z) {
  const s = standAt(x, z, 3);
  if (!s) return false; // terrain ou angle ouvert
  const st = s.st, o = s.o;
  const yr = st.roof + (o + 3) / (st.back + 4.5) * -1.6;
  if (y > yr && y < yr + 0.5) return true; // toit (polycarbonate + charpente)
  if (o < 0) return false;
  const h = standHeightAt(x, z);
  if (inWalkZone(x, z)) return y > 4.2 && y < h;
  return y < h - 0.2 && y > -1;
}

export function obstruction(a, b) {
  const n = 80; let walls = 0, depth = 0, prev = false;
  const step = a.distanceTo(b) / n;
  for (let i = 1; i < n; i++) {
    const t = i / n;
    const s = solidAt(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);
    if (s) { depth += step; if (!prev) walls++; }
    prev = s;
  }
  return { walls, depth, loss: Math.min(95, walls * 16 + depth * 0.8) };
}

function antennaGain(ant, from) {
  if (ant.kind === 'omni') return ant.gain;
  const p = new THREE.Vector3(...ant.pos);
  const bore = new THREE.Vector3(-p.x * 0.8, -p.y, -p.z * 0.8).normalize();
  const d = from.clone().sub(p).normalize();
  const ang = Math.acos(clamp(bore.dot(d), -1, 1)) * 180 / Math.PI;
  return ant.gain - Math.min(28, 12 * (ang / 40) ** 2);
}

function interferenceAt(f, bw, self) {
  let I = -200;
  const add = (dbm) => { I = linToPowDb(powDbToLin(I) + powDbToLin(dbm)); };
  for (const ch of RF.channels) {
    if (Math.abs(ch.f - f) < (bw / 2 + 4)) {
      if (ch.status === 'occ') add(-74);
      if (ch.status === 'wifi') add(-66 + (rand() < 0.3 ? 8 : 0));
    }
  }
  if (S.faults.jam && Math.abs(S.faults.jam.f - f) < bw) add(-52);
  // nos propres liaisons sur le même canal
  for (const c of S.cams) {
    if (c === self || !c.rf) continue;
    if (Math.abs(c.rf.ch - f) < (bw + c.rf.bw) / 2) add((c.rf.bestLevel ?? -60) - 3);
  }
  return I;
}

export function updateRF(dt) {
  RF.t += dt;
  for (const cam of S.cams) {
    if (!cam.rf) continue;
    const rf = cam.rf;
    const from = cam.cam.position.clone();
    const ptx = 10 * Math.log10(rf.txmW);
    const fMHz = rf.ch;
    const noise = -174 + 10 * Math.log10(rf.bw * 1e6) + NF + ENV_NOISE;
    const I = interferenceAt(rf.ch, rf.bw, cam);
    let sum = 0; let best = -200; rf.levels = rf.levels || {}; rf.fade = rf.fade || {};
    const fwd = new THREE.Vector3(-Math.sin(cam.yaw.v), 0, -Math.cos(cam.yaw.v));
    const per = [];
    for (const ant of RF.antennas) {
      if (!ant.on) { rf.levels[ant.id] = null; continue; }
      const p = new THREE.Vector3(...ant.pos);
      const d = Math.max(1, from.distanceTo(p));
      const fspl = 20 * Math.log10(d) + 20 * Math.log10(fMHz) - 27.55;
      const ob = obstruction(from, p);
      const los = ob.walls === 0;
      // évanouissements (processus aléatoire lissé)
      const sig = los ? 2.2 : 5.5, tau = 0.45;
      let f = rf.fade[ant.id] ?? 0;
      f += -f / tau * dt + sig * Math.sqrt(2 * dt / tau) * gauss();
      rf.fade[ant.id] = f;
      const toAnt = p.clone().sub(from).setY(0).normalize();
      const body = toAnt.dot(fwd) > 0.3 ? 4 : 0; // l'émetteur est au dos de la caméra
      const lvl = ptx + 2 + antennaGain(ant, from) - fspl - ob.loss - body + Math.min(f, 6) - 3;
      const sinr = lvl - linToPowDb(powDbToLin(noise) + powDbToLin(I));
      rf.levels[ant.id] = { lvl, sinr, los, d, walls: ob.walls };
      per.push(sinr);
      best = Math.max(best, lvl);
    }
    per.sort((a, b) => b - a);
    for (let i = 0; i < Math.min(4, per.length); i++) sum += powDbToLin(per[i]);
    const snr = per.length ? linToPowDb(sum) : -30;
    rf.snr = snr; rf.bestLevel = best; rf.noise = noise; rf.I = I;
    rf.req = CN_REQ[rf.mod][rf.fec] + IMPL + GI_PEN[rf.gi];
    rf.margin = snr - rf.req;
    rf.mer = clamp(snr, -5, 33);
    rf.bitrate = cofdmBitrate(rf.mod, rf.fec, rf.gi, rf.bw);
    const lat = LATENCY[rf.lat];
    const eff = rf.bitrate * lat.eff;
    rf.block = clamp((15 - eff) / 12, 0, 1) * 0.5;
    const m = rf.margin;
    let state = 'ok', brk = 0;
    if (m < -1.5) state = 'lost';
    else if (m < 0) { state = 'err'; brk = 0.08 + (-m / 1.5) * 0.4; }
    else if (m < 2) { state = 'err'; brk = rand() < (2 - m) / 2 * 0.5 ? 0.02 + rand() * 0.06 : 0; }
    rf.brk = brk;
    if (state === 'lost') rf.lostT += dt; else rf.lostT = 0;
    rf.state = state;
    rf.ber = m > 6 ? 0 : Math.pow(10, -Math.max(2, 3 + m * 0.8));
    rf.latencyS = lat.frames / 50;
    if (state !== 'ok') rf.err += dt;
  }
  // LED des antennes
  for (const a of RF.antennas) {
    const mm = W.antennaMeshes[a.id]; if (!mm) continue;
    mm.led.material.color.setHex(a.on ? 0x30ff60 : 0x333333);
  }
}

export function channelInfo(f) { return RF.channels.find((c) => c.f === f); }
