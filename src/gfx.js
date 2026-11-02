// @ts-check
import * as THREE from 'three';
import { makeCanvas, roundRect, mmss, clamp } from './util.js';
import { M, playerName, playerNumber, teamOf } from './match.js';
import { TEAMS, POSITIONS } from './data/match.js';
import { S, emit } from './state.js';

// Moteur d'habillage simplifié : deux sorties fill+key (canvas avec alpha) -> DSK 1 et DSK 2 du mélangeur
export const GFX = {
  w: 960, h: 540,
  bug: { canvas: null, ctx: null, tex: null, last: '' },
  main: { canvas: null, ctx: null, tex: null },
  template: null, cued: 'lower', player: 9, anim: 0, animDir: 0, replayTag: true, replayOnAir: false, lastDraw: 0,
  title: `${TEAMS[0].name} – ${TEAMS[1].name}`, subtitle: 'Championnat · Journée 12',
};

export function initGfx() {
  for (const k of ['bug', 'main']) {
    const c = makeCanvas(GFX.w, GFX.h);
    GFX[k].canvas = c; GFX[k].ctx = c.getContext('2d');
    const t = new THREE.CanvasTexture(c); t.premultiplyAlpha = false; t.generateMipmaps = false; t.minFilter = THREE.LinearFilter;
    GFX[k].tex = t;
  }
}

const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';

function drawBug() {
  const g = GFX.bug.ctx; const T = TEAMS;
  const clock = mmss(M.clock);
  const key = `${T[1].short}|${M.score.join('-')}|${clock}|${GFX.replayOnAir}`;
  if (key === GFX.bug.last) return;
  GFX.bug.last = key;
  g.clearRect(0, 0, GFX.w, GFX.h);
  const x = 34, y = 26, h = 30;
  g.save();
  g.fillStyle = 'rgba(12,16,24,0.92)'; roundRect(g, x, y, 250, h, 4); g.fill();
  g.fillStyle = T[0].color; g.fillRect(x, y, 6, h);
  g.fillStyle = T[1].color; g.fillRect(x + 128, y, 6, h);
  g.font = `600 19px ${FONT}`; g.fillStyle = '#f2f5f7'; g.textBaseline = 'middle';
  g.fillText(T[0].short, x + 14, y + h / 2 + 1); g.fillText(T[1].short, x + 142, y + h / 2 + 1);
  g.fillStyle = '#ffffff'; g.font = `700 21px ${FONT}`; g.textAlign = 'center';
  g.fillText(String(M.score[0]), x + 104, y + h / 2 + 1); g.fillText(String(M.score[1]), x + 232, y + h / 2 + 1);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 92, y + 4, 24, h - 8); g.fillRect(x + 220, y + 4, 24, h - 8);
  g.fillStyle = '#ffd23f'; roundRect(g, x + 256, y, 62, h, 4); g.fill();
  g.fillStyle = '#101418'; g.font = `700 19px ${FONT}`; g.fillText(clock, x + 287, y + h / 2 + 1);
  if (GFX.replayOnAir && GFX.replayTag) {
    g.fillStyle = 'rgba(12,16,24,0.9)'; roundRect(g, GFX.w - 150, y, 116, h, 4); g.fill();
    g.fillStyle = '#ff8a1f'; g.fillRect(GFX.w - 150, y, 6, h);
    g.fillStyle = '#fff'; g.font = `700 18px ${FONT}`; g.textAlign = 'center'; g.fillText('RALENTI', GFX.w - 88, y + h / 2 + 1);
  }
  g.restore();
  GFX.bug.tex.needsUpdate = true;
}

function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

function drawMain() {
  const g = GFX.main.ctx; g.clearRect(0, 0, GFX.w, GFX.h);
  const a = ease(clamp(GFX.anim, 0, 1));
  if (!GFX.template || a <= 0) { GFX.main.tex.needsUpdate = true; return; }
  g.save();
  if (GFX.template === 'lower') {
    const p = GFX.player; const team = teamOf(p); const T = TEAMS[Math.max(0, team)];
    const w = 420, h = 64, x = 70 - (1 - a) * 480, y = GFX.h - 120;
    g.globalAlpha = a;
    g.fillStyle = 'rgba(12,16,24,0.92)'; roundRect(g, x, y, w, h, 4); g.fill();
    g.fillStyle = T.color; g.fillRect(x, y, 64, h);
    g.fillStyle = '#fff'; g.font = `700 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(playerNumber(p)), x + 32, y + h / 2 + 2);
    g.textAlign = 'left'; g.font = `700 28px ${FONT}`; g.fillText(playerName(p).toUpperCase(), x + 80, y + 24, w - 96);
    g.font = `500 18px ${FONT}`; g.fillStyle = '#b9c3cc'; g.fillText(`${POSITIONS[p % 11]} · ${T.name}`, x + 80, y + 48, w - 96);
  } else if (GFX.template === 'stats') {
    const w = 520, h = 250, x = (GFX.w - w) / 2, y = (GFX.h - h) / 2 + (1 - a) * 30;
    g.globalAlpha = a;
    g.fillStyle = 'rgba(12,16,24,0.93)'; roundRect(g, x, y, w, h, 6); g.fill();
    g.fillStyle = '#fff'; g.font = `700 26px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('STATISTIQUES', x + w / 2, y + 30);
    g.fillStyle = TEAMS[0].color; g.fillRect(x, y + 52, w / 2, 4); g.fillStyle = TEAMS[1].color; g.fillRect(x + w / 2, y + 52, w / 2, 4);
    const tot = M.possession[0] + M.possession[1] || 1;
    const rows = [['Possession', Math.round(M.possession[0] / tot * 100) + ' %', Math.round(M.possession[1] / tot * 100) + ' %'], ['Tirs', M.shots[0], M.shots[1]], ['Tirs cadrés', M.onTarget[0], M.onTarget[1]], ['Corners', M.corners[0], M.corners[1]]];
    g.font = `600 22px ${FONT}`;
    rows.forEach((r, i) => {
      const yy = y + 90 + i * 40;
      g.fillStyle = '#b9c3cc'; g.fillText(r[0], x + w / 2, yy, w * 0.4);
      g.fillStyle = '#fff'; g.fillText(String(r[1]), x + 70, yy); g.fillText(String(r[2]), x + w - 70, yy);
    });
    g.font = `600 18px ${FONT}`; g.fillStyle = '#fff';
    g.fillText(TEAMS[0].short, x + 70, y + 30); g.fillText(TEAMS[1].short, x + w - 70, y + 30);
  } else if (GFX.template === 'compo') {
    const w = 360, h = 420, x = 60 - (1 - a) * 420, y = 60;
    g.globalAlpha = a;
    g.fillStyle = 'rgba(12,16,24,0.93)'; roundRect(g, x, y, w, h, 6); g.fill();
    g.fillStyle = TEAMS[0].color; g.fillRect(x, y, w, 46);
    g.fillStyle = '#fff'; g.font = `700 26px ${FONT}`; g.textBaseline = 'middle'; g.fillText(TEAMS[0].name, x + 16, y + 24, w - 32);
    g.font = `500 21px ${FONT}`;
    for (let i = 0; i < 11; i++) { g.fillStyle = '#ffd23f'; g.fillText(String(playerNumber(i)), x + 18, y + 72 + i * 31); g.fillStyle = '#f2f5f7'; g.fillText(playerName(i), x + 60, y + 72 + i * 31, w - 76); }
  } else if (GFX.template === 'titre') {
    const w = 620, h = 90, x = (GFX.w - w) / 2, y = GFX.h - 150 + (1 - a) * 40;
    g.globalAlpha = a;
    g.fillStyle = 'rgba(12,16,24,0.93)'; roundRect(g, x, y, w, h, 6); g.fill();
    g.fillStyle = '#ffd23f'; g.fillRect(x, y + h - 5, w, 5);
    g.fillStyle = '#fff'; g.font = `700 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(GFX.title, x + w / 2, y + 34, w - 40);
    g.font = `500 20px ${FONT}`; g.fillStyle = '#b9c3cc'; g.fillText(GFX.subtitle, x + w / 2, y + 66, w - 40);
  }
  g.restore();
  GFX.main.tex.needsUpdate = true;
}

export function gfxTake(template) {
  if (template) GFX.cued = template;
  if (GFX.template && GFX.anim > 0) { GFX.animDir = -1; GFX.pending = template ? GFX.cued : null; }
  else { GFX.template = GFX.cued; GFX.animDir = 1; }
  emit('gfx');
}
export function gfxOut() { GFX.animDir = -1; GFX.pending = null; emit('gfx'); }

export function updateGfx(dt) {
  drawBug();
  if (GFX.animDir !== 0) {
    GFX.anim = clamp(GFX.anim + GFX.animDir * dt * 2.5, 0, 1);
    drawMain();
    if (GFX.anim >= 1 && GFX.animDir > 0) { GFX.animDir = 0; }
    if (GFX.anim <= 0 && GFX.animDir < 0) {
      GFX.animDir = 0; GFX.template = null;
      if (GFX.pending) { GFX.template = GFX.pending; GFX.pending = null; GFX.animDir = 1; }
      drawMain();
    }
  } else if (GFX.template === 'stats' && S.frame % 30 === 0) drawMain();
}

// Logo pour la transition "volet logo"
export function stingerLogo() {
  const c = makeCanvas(512, 256); const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(256, 128, 92, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#101418'; g.beginPath(); g.arc(256, 128, 80, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffd23f'; g.font = `800 54px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('REPLAY', 256, 130);
  const t = new THREE.CanvasTexture(c); t.premultiplyAlpha = false;
  return t;
}
