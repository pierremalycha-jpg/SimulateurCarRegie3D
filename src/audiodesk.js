import * as THREE from 'three';
import { makeCanvas, clamp } from './util.js';

// ----------------------------------------------------------------------------------
// Console son en 3D dans la cabine du car, inspirée de la Studer Vista 1 (22 faders) :
// deux baies Vistonics de 10 tranches (écran incliné, molettes posées sur l'écran),
// touches SEL / PFL / MUTE, faders motorisés avec bande FaderGlow, Control Bay à droite
// (écran, molettes, 2 faders), pont de vumètres à LED. Les faders, FaderGlow, touches
// et écrans suivent l'état réel de la console du simulateur (updateAudioDesk).
// Repère local : x = largeur (gauche → droite vue de l'opérateur), z = profondeur
// (0 = bord avant, négatif vers le fond), y = hauteur au-dessus du bureau.
// ----------------------------------------------------------------------------------
export const DESK = { group: null, caps: null, glow: null, btn: null, scr: null, cb: null, bridge: null, t: 0, key: '' };
const NS = 20; // tranches dans les deux baies Vistonics
const SX = (i) => -0.56 + i * 0.04 + (i >= 10 ? 0.02 : 0) + 0.02; // centre de la tranche i
const FADE = { z0: -0.085, z1: -0.205, y: 0.074 }; // course des faders (−∞ → +10 dB)
const SLOPE = { z0: -0.30, y0: 0.085, z1: -0.50, y1: 0.255 }; // écran Vistonics incliné
const SL = Math.hypot(SLOPE.z1 - SLOPE.z0, SLOPE.y1 - SLOPE.y0), SA = Math.atan2(SLOPE.y1 - SLOPE.y0, SLOPE.z0 - SLOPE.z1);
const onSlope = (s) => [SLOPE.y0 + (SLOPE.y1 - SLOPE.y0) * s, SLOPE.z0 + (SLOPE.z1 - SLOPE.z0) * s];
const KNOB_S = [0.36, 0.66]; // position des molettes le long de l'écran (0 = bas, 1 = haut)

function tex(w, h) { const c = makeCanvas(w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return { c, g: c.getContext('2d'), t }; }

export function buildAudioDesk(scene, pos, rotY) {
  const grp = new THREE.Group(); DESK.group = grp;
  grp.position.copy(pos); grp.rotation.y = rotY;
  const M = (c) => new THREE.MeshLambertMaterial({ color: c });
  const body = M(0x23272c), dark = M(0x111316), panel = M(0x1a1d21), trim = M(0x6b737c);
  const box = (w, h, d, x, y, z, m, rx = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.rotation.x = rx; grp.add(b); return b; };
  const W = 1.18;
  // châssis, accoudoir rembourré, plans de travail
  box(W, 0.06, 0.6, 0, 0.03, -0.3, body);
  box(W + 0.02, 0.04, 0.075, 0, 0.07, -0.03, M(0x0c0d0f));
  box(W, 0.012, 0.17, 0, 0.066, -0.155, panel);
  box(W, 0.012, 0.1, 0, 0.074, -0.255, panel);
  // flancs en aluminium
  for (const sx of [-1, 1]) box(0.012, 0.3, 0.62, sx * (W / 2 + 0.006), 0.13, -0.29, trim);
  // caisson incliné des écrans Vistonics + pont de vumètres
  const slope = box(W, 0.03, SL + 0.02, 0, (SLOPE.y0 + SLOPE.y1) / 2 - 0.012, (SLOPE.z0 + SLOPE.z1) / 2, body, SA);
  slope.rotation.x = SA;
  box(W, 0.2, 0.04, 0, 0.17, -0.52, body);
  box(W, 0.085, 0.05, 0, 0.3, -0.515, dark);
  // écran Vistonics (deux baies : une seule texture) et écran de la Control Bay
  DESK.scr = tex(1024, 344);
  const sw = 0.82, sx0 = -0.58;
  const [ym, zm] = onSlope(0.5);
  const sMesh = new THREE.Mesh(new THREE.PlaneGeometry(sw, SL * 0.94), new THREE.MeshBasicMaterial({ map: DESK.scr.t, toneMapped: false }));
  const NRM = new THREE.Vector3(0, Math.cos(SA), Math.sin(SA));
  sMesh.position.set(sx0 + sw / 2, ym, zm).addScaledVector(NRM, 0.012); sMesh.rotation.x = -(Math.PI / 2 - SA); grp.add(sMesh);
  DESK.scr.x0 = sx0; DESK.scr.w = sw;
  DESK.cb = tex(512, 400);
  const cbMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.25, SL * 0.82), new THREE.MeshBasicMaterial({ map: DESK.cb.t, toneMapped: false }));
  const [yc, zc] = onSlope(0.56); cbMesh.position.set(0.44, yc, zc).addScaledVector(NRM, 0.012); cbMesh.rotation.x = -(Math.PI / 2 - SA); grp.add(cbMesh);
  DESK.bridge = tex(1024, 64);
  const brMesh = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.04, 0.07), new THREE.MeshBasicMaterial({ map: DESK.bridge.t, toneMapped: false }));
  brMesh.position.set(0, 0.3, -0.489); grp.add(brMesh);
  // molettes posées sur l'écran (2 par tranche) et 12 molettes de la Control Bay
  const knobGeo = new THREE.CylinderGeometry(0.0105, 0.0115, 0.017, 16);
  const knobs = new THREE.InstancedMesh(knobGeo, M(0x3c434a), NS * 2 + 12);
  // axe des molettes = normale de l'écran incliné
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(SA, 0, 0)), s1 = new THREE.Vector3(1, 1, 1);
  const nrm = new THREE.Vector3(0, Math.cos(SA), Math.sin(SA));
  let k = 0;
  for (let i = 0; i < NS; i++) for (const s of KNOB_S) { const [y, z] = onSlope(s); m4.compose(new THREE.Vector3(SX(i), y, z).addScaledVector(nrm, 0.02), q, s1); knobs.setMatrixAt(k++, m4); }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const [y, z] = onSlope(0.16 + r * 0.32); m4.compose(new THREE.Vector3(0.35 + c * 0.062, y, z).addScaledVector(nrm, 0.02), q, s1); knobs.setMatrixAt(k++, m4); }
  grp.add(knobs);
  // fentes et boutons de faders (22 : 20 tranches + 2 masters), bandes FaderGlow
  const fx = [...Array(NS).keys()].map(SX).concat([0.42, 0.5]);
  const slotGeo = new THREE.BoxGeometry(0.004, 0.002, FADE.z0 - FADE.z1 + 0.02);
  const slots = new THREE.InstancedMesh(slotGeo, M(0x050506), fx.length);
  fx.forEach((x, i) => { m4.makeTranslation(x, FADE.y - 0.001, (FADE.z0 + FADE.z1) / 2); slots.setMatrixAt(i, m4); });
  grp.add(slots);
  const capGeo = new THREE.BoxGeometry(0.02, 0.016, 0.012);
  DESK.caps = new THREE.InstancedMesh(capGeo, M(0xc9ced3), fx.length);
  DESK.caps.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  grp.add(DESK.caps);
  const glowGeo = new THREE.BoxGeometry(0.0035, 0.002, FADE.z0 - FADE.z1 + 0.012);
  DESK.glow = new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), fx.length);
  fx.forEach((x, i) => { m4.makeTranslation(x + 0.013, FADE.y, (FADE.z0 + FADE.z1) / 2); DESK.glow.setMatrixAt(i, m4); DESK.glow.setColorAt(i, new THREE.Color(0x222222)); });
  grp.add(DESK.glow);
  DESK.fx = fx;
  // touches SEL / PFL / MUTE (3 par tranche) + touches de la Control Bay
  const btnGeo = new THREE.BoxGeometry(0.022, 0.007, 0.013);
  DESK.btn = new THREE.InstancedMesh(btnGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), NS * 3 + 16);
  k = 0;
  for (let i = 0; i < NS; i++) for (let r = 0; r < 3; r++) { m4.makeTranslation(SX(i), 0.082, -0.225 - r * 0.02); DESK.btn.setMatrixAt(k, m4); DESK.btn.setColorAt(k++, new THREE.Color(0x2a2f35)); }
  for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) { m4.makeTranslation(0.29 + c * 0.034, 0.082, -0.225 - r * 0.026); DESK.btn.setMatrixAt(k, m4); DESK.btn.setColorAt(k++, new THREE.Color(0x2a2f35)); }
  grp.add(DESK.btn);
  // micro d'ordres (talkback) sur col de cygne
  const gm = M(0x1a1c1f);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.28, 8), gm); neck.position.set(0.56, 0.25, -0.46); neck.rotation.x = 0.5; grp.add(neck);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.007, 0.05, 10), gm); cap.position.set(0.56, 0.37, -0.39); cap.rotation.x = 1.2; grp.add(cap);
  scene.add(grp);
  drawScreens(null);
  return grp;
}

const GLOW = { amb: 0x3b82f6, canon: 0x22d3ee, img: 0xa855f7, comm: 0xf97316, ext: 0xec4899, gen: 0xe5e7eb };
const col = new THREE.Color(), m4b = new THREE.Matrix4();
// mise à jour depuis l'état de la console (AU) : faders motorisés, FaderGlow, touches, écrans
export function updateAudioDesk(AU, dt, faderLin) {
  if (!DESK.group || !AU) return;
  DESK.t += dt; if (DESK.t < 0.1) return; DESK.t = 0;
  const strips = AU.order.map((k) => AU.ch[k]);
  const pos = (db) => clamp((db + 60) / 70, 0, 1);
  DESK.fx.forEach((x, i) => {
    let p, glowC = 0x1a1a1a;
    if (i < NS) { const c = strips[i]; p = c ? pos(c.fader) : 0; if (c) { const on = faderLin(c) > 0 && c.pgm; col.setHex(GLOW[c.group] || 0xffffff); if (!on) col.multiplyScalar(0.12); DESK.glow.setColorAt(i, col); } else { col.setHex(glowC); DESK.glow.setColorAt(i, col); } }
    else { p = pos(i === NS ? AU.master.fader : AU.vca.comm.fader); col.setHex(0xfbbf24); DESK.glow.setColorAt(i, col); }
    m4b.makeTranslation(x, FADE.y + 0.008, FADE.z0 + (FADE.z1 - FADE.z0) * p); DESK.caps.setMatrixAt(i, m4b);
  });
  DESK.caps.instanceMatrix.needsUpdate = true; if (DESK.glow.instanceColor) DESK.glow.instanceColor.needsUpdate = true;
  let k = 0;
  for (let i = 0; i < NS; i++) {
    const c = strips[i];
    const st = c ? [AU.sel === c.id ? 0xe5e7eb : 0x2a2f35, c.pfl ? 0xfacc15 : 0x2a2f35, c.mute ? 0xff3b30 : 0x2a2f35] : [0x1a1d21, 0x1a1d21, 0x1a1d21];
    for (const h of st) { col.setHex(h); DESK.btn.setColorAt(k++, col); }
  }
  const cbOn = [AU.monitor === 'pgm', AU.monitor === 'intl', AU.monitor === 'n1', AU.monitor === 'nxs', AU.monitor === 'nxb', AU.dim, AU.mono, AU.pflActive, AU.tb === 'n1', AU.tb === 'nxs', AU.tb === 'nxb', AU.autoCanon, AU.master.lim, AU.redLight, false, false];
  cbOn.forEach((on, j) => { col.setHex(on ? (j === 13 ? 0xff3b30 : j < 5 ? 0xffb020 : 0x38bdf8) : 0x2a2f35); DESK.btn.setColorAt(k++, col); });
  if (DESK.btn.instanceColor) DESK.btn.instanceColor.needsUpdate = true;
  drawScreens(AU, strips);
}

const SEC = { in: '#cbd5e1', eq: '#ef4444', dyn: '#22c55e', pan: '#facc15' };
function drawScreens(AU, strips = []) {
  // --- écrans Vistonics : une colonne par tranche, molettes cerclées de la couleur de leur fonction ---
  const { c, g, t } = DESK.scr; const W = c.width, H = c.height;
  const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#0d1a2b'); bg.addColorStop(1, '#060a10');
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  const px = (x) => (x - DESK.scr.x0) / DESK.scr.w * W;
  const sy = (s) => (1 - (s - 0.03) / 0.94) * H;
  for (let i = 0; i < NS; i++) {
    const x = px(SX(i)); const ch = strips[i];
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x - 25, 4, 1, H - 8);
    // nom de la tranche (scribble) en haut
    g.fillStyle = ch ? ({ amb: '#3b82f6', canon: '#22d3ee', img: '#a855f7', comm: '#f97316', ext: '#ec4899', gen: '#e5e7eb' }[ch.group] || '#888') : '#333';
    g.fillRect(x - 22, 6, 44, 5);
    g.font = '600 14px "JetBrains Mono", monospace'; g.textAlign = 'center'; g.fillStyle = '#e8edf1';
    g.fillText(ch ? ch.short.replace('CANON ', 'CAN') : '—', x, 30);
    g.font = '11px "JetBrains Mono", monospace'; g.fillStyle = '#7b8792'; g.fillText(String(i + 1), x, 46);
    // anneaux autour des deux molettes : gain (blanc) / égaliseur (rouge) et dynamique (vert) / pan (jaune)
    const rings = ch ? [[SEC.in, (ch.gain - ch.defGain + 30) / 60], [ch.eq.on ? SEC.eq : '#4b1d1d', 0.5 + ch.eq.b[2].g / 30]] : [];
    const rings2 = ch ? [[ch.dyn.on ? SEC.dyn : '#14532d', ch.gr > 0 ? clamp(ch.gr / 12, 0, 1) : 0.05], [SEC.pan, (ch.pan + 1) / 2]] : [];
    KNOB_S.forEach((s, j) => {
      const y = sy(s); const r = j === 0 ? rings : rings2;
      if (!ch) return;
      r.forEach(([cc, v], m) => { g.strokeStyle = cc; g.lineWidth = 3.5; g.beginPath(); const a0 = Math.PI * 0.75, rad = m === 0 ? 17 : 21; g.arc(x, y, rad, a0, a0 + Math.PI * 1.5 * clamp(v, 0, 1)); g.stroke(); });
    });
    // vumètre d'entrée horizontal (bas de l'écran)
    if (ch) { const lv = clamp((ch.peak + 60) / 60, 0, 1); g.fillStyle = '#10161b'; g.fillRect(x - 20, H - 26, 40, 8); g.fillStyle = ch.ovl > 0 ? '#ff3b30' : lv > 0.8 ? '#facc15' : '#22c55e'; g.fillRect(x - 20, H - 26, 40 * lv, 8); }
  }
  g.fillStyle = 'rgba(255,255,255,.35)'; g.font = '600 11px "Saira Condensed", sans-serif'; g.textAlign = 'left'; g.fillText('VISTONICS 1', 8, H - 6); g.fillText('VISTONICS 2', px(SX(10)) - 24, H - 6);
  t.needsUpdate = true;
  // --- écran de la Control Bay : tranche sélectionnée, loudness, écoute ---
  { const { c: c2, g: h, t: t2 } = DESK.cb; const w = c2.width, hh = c2.height;
    h.fillStyle = '#0a1220'; h.fillRect(0, 0, w, hh);
    h.fillStyle = '#e8edf1'; h.font = '600 26px "Saira Condensed", sans-serif'; h.textAlign = 'left';
    const sel = AU && AU.ch[AU.sel];
    h.fillText('CONTROL BAY · ' + (sel ? sel.short : '—'), 14, 34);
    if (AU) {
      h.font = '20px "JetBrains Mono", monospace'; h.fillStyle = '#ffb020';
      h.fillText(`LUFS I ${AU.lufs.i > -69 ? AU.lufs.i.toFixed(1) : '--'}`, 14, 74);
      h.fillStyle = '#9fb0bf'; h.fillText(`ÉCOUTE ${AU.pflActive ? 'PFL' : AU.monitor.toUpperCase()}`, 14, 104);
      // courbe d'égaliseur schématique de la tranche sélectionnée
      if (sel) { h.strokeStyle = sel.eq.on ? '#ef4444' : '#4b1d1d'; h.lineWidth = 3; h.beginPath(); for (let i = 0; i <= 60; i++) { const f = i / 60; let db = 0; sel.eq.b.forEach((b, j) => { const fx = Math.log(b.f / 20) / Math.log(1000); db += b.g * Math.exp(-Math.pow((f - fx) * (j === 0 || j === 3 ? 3 : 6), 2)); }); const y = 230 - clamp(db, -15, 15) * 4; if (i) h.lineTo(14 + f * 480, y); else h.moveTo(14 + f * 480, y); } h.stroke(); h.strokeStyle = 'rgba(255,255,255,.15)'; h.lineWidth = 1; h.beginPath(); h.moveTo(14, 230); h.lineTo(494, 230); h.stroke(); }
      // vumètres PGM G/D
      [AU.master.peakL, AU.master.peakR].forEach((db, i) => { const lv = clamp((db + 60) / 60, 0, 1); h.fillStyle = '#10161b'; h.fillRect(14, 300 + i * 30, 480, 20); h.fillStyle = lv > 0.95 ? '#ff3b30' : lv > 0.8 ? '#facc15' : '#22c55e'; h.fillRect(14, 300 + i * 30, 480 * lv, 20); });
    }
    t2.needsUpdate = true; }
  // --- pont de vumètres à LED ---
  { const { c: c3, g: b, t: t3 } = DESK.bridge; const w = c3.width, hh = c3.height;
    b.fillStyle = '#050607'; b.fillRect(0, 0, w, hh);
    const bars = strips.map((x) => x.peak).concat(AU ? [AU.master.peakL, AU.master.peakR, AU.bus.intl.peak, AU.bus.n1.peak] : []);
    const n = Math.max(24, bars.length); const bw = w / n;
    for (let i = 0; i < n; i++) {
      const lv = clamp(((bars[i] ?? -90) + 60) / 60, 0, 1); const segs = 12;
      for (let s = 0; s < segs; s++) { const on = s / segs < lv; b.fillStyle = on ? (s >= 11 ? '#ff3b30' : s >= 8 ? '#facc15' : '#22c55e') : '#141a1f'; b.fillRect(i * bw + 3, hh - 6 - (s + 1) * 4.6, bw - 6, 3.4); }
    }
    t3.needsUpdate = true; }
}
