// @ts-check
// ----------------------------------------------------------------------------------
// Le son des médias de l'émission, synthétisé en WebAudio (aucun fichier) : l'indicatif du générique de
// début (128 bpm, 16 mesures = 30 s : montée, thème, coup final au logo), la page de publicité (jingle
// « Publicité », trois musiques de spot, jingle de retour) et le générique de fin (le thème, plus lent).
// La partition est un calcul pur (testé) ; la lecture la joue depuis la position du média sur le canal
// de l'EVS, par petites avances (un quart de seconde) : pause, retour au début et éjection s'entendent
// tout de suite. Le son sort sur l'entrée AES de la console qui reçoit ce canal (AES 1 = PGM1, AES 2 = PGM2).
// ----------------------------------------------------------------------------------

/** @typedef {'kick' | 'snare' | 'hat' | 'clap' | 'bass' | 'stab' | 'lead' | 'pad' | 'chime' | 'pluck' | 'piano' | 'riser' | 'hit' | 'whoosh'} Inst */
/** @typedef {{ t: number, d: number, inst: Inst, f: number, v: number }} Note */
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

// accords du thème (ré majeur : I – vi – IV – V) et la mélodie d'un cycle de quatre mesures [temps, durée, note]
const ACC = { D: [62, 66, 69], Bm: [59, 62, 66], G: [55, 59, 62], A: [57, 61, 64] };
const BASSE = { D: 38, Bm: 35, G: 43, A: 45 };
const CYCLE = ['D', 'Bm', 'G', 'A'];
const THEME = [[0, 1, 69], [1, 1, 74], [2, 1.5, 78], [3.5, 0.5, 76], [4, 1, 74], [5, 1, 71], [6, 2, 66], [8, 0.5, 67], [8.5, 0.5, 69], [9, 1, 71], [10, 1, 74], [11, 1, 71], [12, 1.5, 73], [13.5, 0.5, 76], [14, 2, 69]];

function genDebut() {
  /** @type {Note[]} */ const N = [];
  const b = 60 / 128, bar = 4 * b; const add = (t, d, inst, n, v) => N.push({ t, d, inst, f: n ? midi(n) : 0, v });
  // mesures 1-2 : la montée, l'accord tenu
  add(0.35, 2 * bar - 0.35, 'riser', 0, 0.55);
  for (const n of ACC.D) add(0.4, 2 * bar - 0.5, 'pad', n, 0.22);
  add(bar, 0.4, 'kick', 0, 0.7); add(bar + 2 * b, 0.4, 'kick', 0, 0.7);
  for (let k = 0; k < 8; k++) add(bar + 2 * b + k * b / 4, 0.12, 'snare', 0, 0.12 + k * 0.05);
  // mesures 3-14 : le thème (trois cycles de quatre mesures)
  for (let m = 2; m < 14; m++) {
    const t0 = m * bar, c = CYCLE[(m - 2) % 4], cyc = Math.floor((m - 2) / 4);
    for (let k = 0; k < 4; k++) { add(t0 + k * b, 0.35, 'kick', 0, 0.85); if (k % 2) add(t0 + k * b, 0.2, 'snare', 0, 0.6); }
    for (let k = 0; k < 8; k++) add(t0 + k * b / 2, 0.05, 'hat', 0, k % 2 ? 0.25 : 0.4);
    for (let k = 0; k < 8; k++) add(t0 + k * b / 2, b / 2 * 0.9, 'bass', BASSE[c] + (k === 7 ? 12 : 0), 0.55);
    for (const n of ACC[c]) { add(t0, b * 0.9, 'stab', n, 0.3); add(t0 + 1.5 * b, b * 0.45, 'stab', n, 0.22); }
    if (cyc === 0) for (const n of ACC[c]) add(t0, bar, 'pad', n, 0.12);
    if (cyc >= 1) {
      const off = ((m - 2) % 4) * 4;
      for (const [tt, d, n] of THEME) if (tt >= off && tt < off + 4) { add(t0 + (tt - off) * b, d * b * 0.95, 'lead', n, 0.42); if (cyc === 2) add(t0 + (tt - off) * b, d * b * 0.95, 'lead', n - 12, 0.22); }
    }
  }
  // mesure 15 : sol puis la, roulement ; mesure 16 : le coup final (au logo), tenu jusqu'au noir
  const t14 = 14 * bar;
  for (const n of ACC.G) add(t14, 2 * b, 'stab', n, 0.35); for (const n of ACC.A) add(t14 + 2 * b, 2 * b, 'stab', n, 0.35);
  add(t14, 2 * b, 'bass', BASSE.G, 0.55); add(t14 + 2 * b, 2 * b, 'bass', BASSE.A, 0.55);
  for (let k = 0; k < 16; k++) add(t14 + 2 * b + k * b / 8, 0.1, 'snare', 0, 0.2 + k * 0.03);
  add(t14 + b, 3 * b, 'riser', 0, 0.4);
  const t15 = 15 * bar;
  add(t15, 1.6, 'hit', 0, 0.6); add(t15, 0.6, 'kick', 0, 0.8); add(t15, 1.7, 'bass', BASSE.D, 0.5);
  for (const n of [...ACC.D, 74]) { add(t15, 1.7, 'stab', n, 0.34); add(t15, 1.75, 'pad', n, 0.2); }
  return N;
}
function genFin() {
  /** @type {Note[]} */ const N = [];
  const b = 60 / 96, bar = 4 * b; const add = (t, d, inst, n, v) => N.push({ t, d, inst, f: n ? midi(n) : 0, v });
  for (let m = 0; m < 11; m++) {
    const t0 = m * bar, c = m === 10 ? 'D' : CYCLE[m % 4];
    for (const n of ACC[c]) add(t0, bar * (m === 10 ? 1.8 : 1), 'pad', n, 0.2);
    add(t0, bar * 0.95, 'bass', BASSE[c], 0.4);
    if (m > 0 && m < 10) { add(t0, 0.4, 'kick', 0, 0.55); add(t0 + 2 * b, 0.4, 'kick', 0, 0.45); add(t0 + b, 0.2, 'clap', 0, 0.3); add(t0 + 3 * b, 0.2, 'clap', 0, 0.3); }
    if (m >= 2 && m < 10) { const off = ((m - 2) % 4) * 4; for (const [tt, d, n] of THEME) if (tt >= off && tt < off + 4) add(t0 + (tt - off) * b, d * b * 0.95, 'piano', n, 0.4); }
  }
  add(0.3, 1.6, 'chime', 81, 0.25);
  return N;
}
// la page de publicité : jingles d'entrée et de retour, trois musiques de spot
function genPub() {
  /** @type {Note[]} */ const N = [];
  const add = (t, d, inst, n, v) => N.push({ t, d, inst, f: n ? midi(n) : 0, v });
  // jingle « Publicité » (0 à 5 s) : arpège montant, accord de cloches, souffle de sortie
  [72, 76, 79, 84].forEach((n, i) => add(0.3 + i * 0.1, 1.2, 'chime', n, 0.55));
  for (const n of [72, 76, 79, 84, 88]) add(1.0, 2.6, 'chime', n, 0.42);
  add(4.35, 0.6, 'whoosh', 0, 0.6);
  // spot 1 (5 à 25 s) : guitare piquée, 110 bpm, do – sol – la m – fa
  { const b = 60 / 110, t0 = 5.2; const ch = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
    for (let m = 0; m < 9; m++) { const c = ch[m % 4], tm = t0 + m * 4 * b; if (tm > 22) break;
      for (let k = 0; k < 8; k++) { if (k === 3 || k === 7) continue; c.forEach((n, j) => add(tm + k * b / 2 + j * 0.015, 0.35, 'pluck', n + 12, 0.24)); }
      add(tm, 0.3, 'kick', 0, 0.5); add(tm + 2 * b, 0.3, 'kick', 0, 0.5); add(tm + b, 0.2, 'clap', 0, 0.35); add(tm + 3 * b, 0.2, 'clap', 0, 0.35);
      add(tm, 4 * b * 0.9, 'bass', c[0] - 24, 0.35); }
    [[22.2, 79], [22.5, 76], [22.8, 84]].forEach(([t, n]) => add(t, 0.8, 'chime', n, 0.35)); add(23.3, 1.5, 'pluck', 72, 0.3); }
  // spot 2 (25 à 45 s) : piano doux, 80 bpm, fa – do – ré m – si bémol (un peu plus fort : les trois spots à la même sonie)
  const n2 = N.length;
  { const b = 60 / 80, t0 = 25.2; const ch = [[53, 57, 60, 65], [48, 52, 55, 60], [50, 53, 57, 62], [46, 50, 53, 58]];
    for (let m = 0; m < 6; m++) { const c = ch[m % 4], tm = t0 + m * 4 * b; if (tm > 42) break;
      c.forEach((n) => add(tm, 4 * b, 'piano', n + 12, 0.22)); add(tm, 4 * b * 0.9, 'bass', c[0] - 12, 0.25);
      [0, 1.5, 2, 3].forEach((k, i) => add(tm + k * b, 1, 'chime', c[(i + 1) % c.length] + 24, 0.14)); }
    for (const n of [65, 69, 72, 77]) add(42.3, 2.4, 'piano', n, 0.24); }
  for (let k = n2; k < N.length; k++) N[k].v *= 1.3;
  const n3 = N.length;
  // spot 3 (45 à 65 s) : basse électronique, 120 bpm, mi mineur
  { const b = 0.5, t0 = 45.2; const r = [40, 40, 43, 45, 40, 40, 47, 45];
    for (let m = 0; m < 9; m++) { const tm = t0 + m * 4 * b; if (tm > 62) break;
      for (let k = 0; k < 4; k++) { add(tm + k * b, 0.3, 'kick', 0, 0.7); add(tm + k * b + b / 2, 0.05, 'hat', 0, 0.35); }
      add(tm + b, 0.2, 'clap', 0, 0.4); add(tm + 3 * b, 0.2, 'clap', 0, 0.4);
      for (let k = 0; k < 8; k++) add(tm + k * b / 2, b * 0.4, 'bass', r[k], 0.5);
      if (m % 2) for (const n of [64, 67, 71]) add(tm, b * 1.8, 'stab', n, 0.18); }
    add(62.3, 1, 'hit', 0, 0.6); for (const n of [64, 67, 71, 76]) add(62.3, 2, 'pad', n, 0.2); }
  for (let k = n3; k < N.length; k++) N[k].v *= 0.6;
  // jingle de retour (65 à 70 s) : arpège qui descend, souffle, accord de l'émission, coup au logo
  [84, 79, 76, 72].forEach((n, i) => add(65.3 + i * 0.1, 1, 'chime', n, 0.5));
  add(67.4, 0.6, 'whoosh', 0, 0.6);
  for (const n of ACC.D) add(67.9, 1.6, 'stab', n, 0.42); add(67.9, 1.6, 'bass', BASSE.D, 0.55);
  add(69.65, 0.35, 'hit', 0, 0.55);
  return N;
}
const CACHE = {};
/** la partition d'un média : notes triées par instant (secondes depuis le début du média) */
export function partition(/** @type {string} */ id) {
  if (CACHE[id]) return CACHE[id];
  const N = id === 'gen-debut' ? genDebut() : id === 'gen-fin' ? genFin() : id === 'pub' ? genPub() : [];
  N.sort((a, b) => a.t - b.t);
  return (CACHE[id] = N);
}

// ---------------- lecture ----------------
const BRUIT = new WeakMap();
function bruit(ctx) {
  if (BRUIT.has(ctx)) return BRUIT.get(ctx);
  const len = ctx.sampleRate; const b = ctx.createBuffer(1, len, ctx.sampleRate); const d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  BRUIT.set(ctx, b);
  return b;
}
// un instrument : quelques oscillateurs et une enveloppe, vers la sortie du canal
function jouer(ctx, out, n, at) {
  const g = ctx.createGain(); g.connect(out);
  const env = (a, peak, dec) => { g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + a); g.gain.exponentialRampToValueAtTime(0.0001, at + a + dec); };
  const osc = (type, f, dest = g, det = 0) => { const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, at); o.detune.value = det; o.connect(dest); o.start(at); o.stop(at + n.d + 0.6); return o; };
  const noise = (dest) => { const s = ctx.createBufferSource(); s.buffer = bruit(ctx); s.loop = true; s.connect(dest); s.start(at, Math.random() * 0.5); s.stop(at + n.d + 0.6); return s; };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; b.connect(g); return b; };
  const v = n.v;
  switch (n.inst) {
    case 'kick': { const o = osc('sine', 150); o.frequency.exponentialRampToValueAtTime(42, at + 0.12); env(0.003, v * 0.9, 0.3); break; }
    case 'snare': { noise(filt('bandpass', 1900, 0.8)); osc('triangle', 190); env(0.002, v * 0.5, 0.16); break; }
    case 'hat': noise(filt('highpass', 7500)); env(0.001, v * 0.25, 0.045); break;
    case 'clap': noise(filt('bandpass', 1300, 1.2)); env(0.004, v * 0.5, 0.15); break;
    case 'bass': { const f = filt('lowpass', 420); osc('sawtooth', n.f, f); osc('square', n.f / 2, f); env(0.008, v * 0.32, Math.max(0.12, n.d)); break; }
    case 'stab': { const f = filt('lowpass', 2400); for (const d of [-8, 0, 8]) osc('sawtooth', n.f, f, d); env(0.01, v * 0.14, Math.max(0.15, n.d)); break; }
    case 'lead': { const f = filt('lowpass', 3200); osc('square', n.f, f); const o2 = osc('sawtooth', n.f, f, 6); const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lg = ctx.createGain(); lg.gain.value = n.f * 0.006; lfo.connect(lg); lg.connect(o2.frequency); lfo.start(at + 0.15); lfo.stop(at + n.d + 0.4); env(0.012, v * 0.13, Math.max(0.12, n.d)); break; }
    case 'pad': { const f = filt('lowpass', 1300); osc('sawtooth', n.f, f, -7); osc('sawtooth', n.f, f, 7); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v * 0.08, at + Math.min(0.4, n.d * 0.4)); g.gain.setValueAtTime(v * 0.08, at + n.d * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, at + n.d + 0.25); break; }
    case 'chime': { osc('sine', n.f); const g2 = ctx.createGain(); g2.gain.value = 0.35; g2.connect(g); osc('sine', n.f * 2.76, g2); env(0.002, v * 0.3, Math.max(0.6, n.d)); break; }
    case 'pluck': { const f = filt('lowpass', 2600); osc('triangle', n.f, f); osc('sawtooth', n.f, f, 4); env(0.003, v * 0.2, 0.32); break; }
    case 'piano': { osc('sine', n.f); const g2 = ctx.createGain(); g2.gain.value = 0.3; g2.connect(g); osc('sine', n.f * 2, g2); const g3 = ctx.createGain(); g3.gain.value = 0.12; g3.connect(g); osc('sine', n.f * 3, g3); env(0.004, v * 0.35, Math.max(0.8, n.d)); break; }
    case 'riser': { const f = filt('bandpass', 300, 2.2); f.frequency.setValueAtTime(300, at); f.frequency.exponentialRampToValueAtTime(6500, at + n.d); noise(f); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v * 0.5, at + n.d); g.gain.exponentialRampToValueAtTime(0.0001, at + n.d + 0.08); break; }
    case 'whoosh': { const f = filt('bandpass', 4000, 1.5); f.frequency.setValueAtTime(5000, at); f.frequency.exponentialRampToValueAtTime(500, at + n.d); noise(f); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(v * 0.5, at + n.d * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, at + n.d); break; }
    case 'hit': { noise(filt('lowpass', 5000)); const o = osc('sine', 70); o.frequency.exponentialRampToValueAtTime(38, at + 0.5); env(0.003, v * 0.6, n.d); break; }
    default: break;
  }
}
const AVANCE = 0.25;
// niveau de sortie de chaque média : autour de −23 dBFS efficaces à l'entrée de la console, crêtes sous −1 dBFS (EBU R128 :
// −23 LUFS, true peak −1 dBTP ; la pub à la même sonie que le reste du programme)
const GAIN = { 'gen-debut': 0.62, 'gen-fin': 1.2, pub: 1.2 };
/** @type {({ out: GainNode, id: string, curseur: number, pos: number, i: number } | null)[]} */
const VOIX = [null, null];
function couper(k) { const v = VOIX[k]; if (!v) return; VOIX[k] = null; try { const t = v.out.context.currentTime; v.out.gain.setTargetAtTime(0, t, 0.03); setTimeout(() => { try { v.out.disconnect(); } catch (e) { /* déjà débranché */ } }, 400); } catch (e) { /* contexte fermé */ } }
/**
 * Joue le son des médias en lecture sur les canaux de l'EVS (appelé à chaque image).
 * @param {AudioContext | null} ctx
 * @param {(AudioNode | null)[]} ports entrée de la console de chaque canal (AES 1, AES 2)
 * @param {({ id: string, pos: number, playing: boolean } | null)[]} medias
 */
export function sonMedias(ctx, ports, medias) {
  if (!ctx) return;
  for (let k = 0; k < medias.length; k++) {
    const m = medias[k], port = ports[k];
    if (!m || !m.playing || !port) { couper(k); continue; }
    let v = VOIX[k];
    // nouveau média, ou saut de position (retour au début) : on repart de la position du média
    if (v && (v.id !== m.id || Math.abs(m.pos - v.pos) > 0.35)) { couper(k); v = null; }
    if (!v) {
      const out = ctx.createGain(); out.gain.value = GAIN[m.id] ?? 1; out.connect(port);
      const N = partition(m.id); let i = 0; while (i < N.length && N[i].t < m.pos - 0.02) i++;
      v = VOIX[k] = { out, id: m.id, curseur: m.pos, pos: m.pos, i };
    }
    v.pos = m.pos;
    const N = partition(m.id), now = ctx.currentTime, jusque = m.pos + AVANCE;
    while (v.i < N.length && N[v.i].t < jusque) { const n = N[v.i++]; jouer(ctx, v.out, n, now + Math.max(0, n.t - m.pos)); }
    v.curseur = jusque;
  }
}
/**
 * Le niveau d'un passage d'un média, rendu hors ligne (tests, calibrage) : efficace et crête en dBFS, à l'entrée AES de la console.
 * @param {string} id
 * @param {number} de
 * @param {number} a
 */
export async function niveauMedia(id, de, a) {
  const sr = 22050; const ctx = new OfflineAudioContext(2, Math.ceil(sr * (a - de)), sr);
  const out = ctx.createGain(); out.gain.value = GAIN[id] ?? 1; out.connect(ctx.destination);
  for (const n of partition(id)) if (n.t >= de && n.t < a) jouer(ctx, out, n, n.t - de);
  const buf = await ctx.startRendering();
  let s = 0, pk = 0, len = 0;
  for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = d[i]; s += v * v; if (Math.abs(v) > pk) pk = Math.abs(v); } len += d.length; }
  const db = (x) => Math.round(20 * Math.log10(Math.max(1e-9, x)) * 10) / 10;
  return { rms: db(Math.sqrt(s / Math.max(1, len))), crete: db(pk) };
}
/** coupe tout (fin de l'émission, retour à l'accueil) */
export function silenceMedias() { for (let k = 0; k < VOIX.length; k++) couper(k); }
