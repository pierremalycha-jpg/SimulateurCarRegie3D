import { S, on, emit, camById } from './state.js';
import { M } from './match.js';
import { clamp, dbToLin, linToDb, linToPowDb } from './util.js';
import { rxOk } from './net/fabric.js';
import { MIX } from './pipeline.js';

// ----------------------------------------------------------------------------------
// Console son du car, inspirée de la Studer Vista 1 (simulation pédagogique, non officielle).
// Chaque tranche a sa vraie chaîne de traitement WebAudio : entrée (patch, gain, 48 V, phase),
// filtre passe-haut, égaliseur 4 bandes, gate/expandeur, compresseur, retard, panoramique, fader,
// VCA, départs vers les bus (PGM, international, N-1). Écoutes (PFL, mono, dim), talkback,
// snapshots, retard de ligne (synchro labiale), embedder SDI et loudness EBU R128 (approchée).
// ----------------------------------------------------------------------------------

// Couleurs FaderGlow par famille de sources (assignables sur la vraie console)
export const GROUPS = {
  amb: { label: 'Ambiances', color: '#3b82f6' },
  canon: { label: 'Canons', color: '#22d3ee' },
  img: { label: 'Sons des images', color: '#a855f7' },
  comm: { label: 'Commentaires', color: '#f97316' },
  ext: { label: 'Duplex et habillage', color: '#ec4899' },
  gen: { label: 'Générateur', color: '#e5e7eb' },
};
// emplacements des canons (micros canons bord terrain), en mètres (x le long du terrain, z vers la tribune opposée)
export const CANON_POS = [[-56, 0], [-30, -37], [0, -37.5], [30, -37], [56, 0], [0, 37.5]];
const CANON_NAMES = ['derrière le but Trannin', 'bord terrain Lepagnot, côté Trannin', 'bord terrain Lepagnot, centre', 'bord terrain Lepagnot, côté Marek', 'derrière le but Marek', 'bord terrain Delacourt, centre'];

// ce qui est branché sur chaque entrée physique de la console (face arrière et cartes D21m)
// cond : micro statique (a besoin du 48 V) · voice : voix dite par la synthèse vocale
export const PLUG = {
  'MIC 1': { what: 'Couple ORTF Lepagnot · gauche', cond: true }, 'MIC 2': { what: 'Couple ORTF Lepagnot · droite', cond: true },
  'MIC 3': { what: 'Couple XY kop Marek · gauche', cond: true }, 'MIC 4': { what: 'Couple XY kop Marek · droite', cond: true },
  'MIC 5': { what: 'Canon 1 · ' + CANON_NAMES[0], cond: true }, 'MIC 6': { what: 'Canon 2 · ' + CANON_NAMES[1], cond: true },
  'MIC 7': { what: 'Canon 3 · ' + CANON_NAMES[2], cond: true }, 'MIC 8': { what: 'Canon 4 · ' + CANON_NAMES[3], cond: true },
  'MIC 9': { what: 'Canon 5 · ' + CANON_NAMES[4], cond: true }, 'MIC 10': { what: 'Canon 6 · ' + CANON_NAMES[5], cond: true },
  'MIC 11': { what: 'Récepteur HF du journaliste bord terrain (niveau ligne)', voice: 'bt' },
  'MADI 1': { what: 'Unité de commentaire · micro commentateur', voice: 'comm1' }, 'MADI 2': { what: 'Unité de commentaire · micro consultant', voice: 'comm2' },
  'SDI 1/1': { what: 'Micro de la caméra HF, désembeddé (canal 1)' },
  'AES 1': { what: 'EVS XT4K · sortie PGM1 (ralentis A)', st: true }, 'AES 2': { what: 'EVS XT4K · sortie PGM2 (ralentis B)', st: true },
  'AES 3': { what: 'Décodeur de transmission · retour studio (duplex)', st: true, voice: 'duplex' }, 'AES 4': { what: 'Lecteur d\'habillage sonore (virgules, jingles)', st: true },
  GEN: { what: 'Générateur interne de la console (1 kHz)' },
};
// listes des entrées proposées au patch (tranche mono / tranche stéréo)
export const MONO_PORTS = [...Array(32).keys()].map((i) => 'MIC ' + (i + 1)).concat([...Array(8).keys()].map((i) => 'MADI ' + (i + 1)), [...Array(4).keys()].map((i) => 'SDI 1/' + (i + 1)), ['GEN']);
export const ST_PORTS = [...Array(16).keys()].map((i) => `MIC ${2 * i + 1}-${2 * i + 2}`).concat([...Array(8).keys()].map((i) => 'AES ' + (i + 1)));

// définition des tranches (couche A) : [id, scribble, libellé, entrée, stéréo, type, gain nominal (dB), groupe]
const CH_DEF = [
  ['amb1', 'AMB LEP', 'Ambiance tribune Lepagnot (couple ORTF)', 'MIC 1-2', true, 'mic', 44, 'amb'],
  ['amb2', 'AMB KOP', 'Ambiance kop Marek (couple XY)', 'MIC 3-4', true, 'mic', 38, 'amb'],
  ['c1', 'CANON 1', 'Canon 1 · ' + CANON_NAMES[0], 'MIC 5', false, 'mic', 48, 'canon'],
  ['c2', 'CANON 2', 'Canon 2 · ' + CANON_NAMES[1], 'MIC 6', false, 'mic', 48, 'canon'],
  ['c3', 'CANON 3', 'Canon 3 · ' + CANON_NAMES[2], 'MIC 7', false, 'mic', 48, 'canon'],
  ['c4', 'CANON 4', 'Canon 4 · ' + CANON_NAMES[3], 'MIC 8', false, 'mic', 48, 'canon'],
  ['c5', 'CANON 5', 'Canon 5 · ' + CANON_NAMES[4], 'MIC 9', false, 'mic', 48, 'canon'],
  ['c6', 'CANON 6', 'Canon 6 · ' + CANON_NAMES[5], 'MIC 10', false, 'mic', 48, 'canon'],
  ['hfmic', 'CAM HF', 'Micro de la caméra HF (désembeddé)', 'SDI 1/1', false, 'sdi', 0, 'img'],
  ['evsA', 'EVS A', 'Son des ralentis · EVS PGM1', 'AES 1', true, 'aes', 0, 'img'],
  ['evsB', 'EVS B', 'Son des ralentis · EVS PGM2', 'AES 2', true, 'aes', 0, 'img'],
  ['comm1', 'COMM 1', 'Commentateur', 'MADI 1', false, 'madi', 0, 'comm'],
  ['comm2', 'COMM 2', 'Consultant', 'MADI 2', false, 'madi', 0, 'comm'],
  ['bt', 'BORD T.', 'Journaliste bord terrain (HF)', 'MIC 11', false, 'line', 6, 'comm'],
  ['duplex', 'DUPLEX', 'Duplex studio (retour par la transmission)', 'AES 3', true, 'aes', 0, 'ext'],
  ['jingle', 'JINGLES', 'Habillage sonore (virgules)', 'AES 4', true, 'aes', 0, 'ext'],
  ['tone', 'MIRE', 'Mire 1 kHz (générateur)', 'GEN', false, 'gen', 0, 'gen'],
];
const flatEq = () => [{ t: 'lowshelf', f: 100, g: 0, q: 0.7 }, { t: 'peaking', f: 400, g: 0, q: 1 }, { t: 'peaking', f: 2500, g: 0, q: 1 }, { t: 'highshelf', f: 10000, g: 0, q: 0.7 }];
function defaultStrip(d, n) {
  const [id, short, label, src, st, kind, gain, group] = d;
  const voice = ['comm1', 'comm2', 'bt', 'duplex'].includes(id);
  const c = {
    id, n, short, label, src, home: src, st, kind, defGain: gain, gain, group, voice, comm: id === 'comm1' || id === 'comm2',
    ph48: kind === 'mic', phase: false, hpf: { on: kind === 'mic' || voice, f: id.startsWith('c') && kind === 'mic' ? 120 : voice ? 100 : 60 },
    eq: { on: true, b: flatEq() }, gate: { on: false, thr: -50, range: 20 }, dyn: { on: false, thr: -18, ratio: 3, att: 10, rel: 150, mk: 0 },
    delay: 0, pan: 0, fader: -60, mute: false, pfl: false, afv: false,
    pgm: true, intl: !voice && id !== 'jingle', n1: !(id === 'comm1' || id === 'comm2'), nxs: id !== 'duplex', nxb: id !== 'bt',
    vca: { amb: 'amb', canon: 'canon', img: 'img', comm: 'comm' }[group] || null,
    peak: -90, gr: 0, ovl: 0, sim: -90,
  };
  if (group === 'canon') { const i = +id.slice(1) - 1; c.pan = clamp(CANON_POS[i][0] / 60, -0.85, 0.85); c.fader = -10; c.eq.b[1].g = -3; c.eq.b[2].g = 3; c.eq.b[2].f = 3000; }
  if (group === 'amb') { c.fader = id === 'amb1' ? -6 : -4; c.eq.b[3].g = 2; }
  if (id === 'hfmic') { c.fader = -8; c.afv = true; c.hpf.on = true; c.hpf.f = 80; }
  if (id === 'evsA' || id === 'evsB') { c.fader = -6; c.afv = true; }
  if (id === 'comm1') { c.fader = 0; }
  if (id === 'comm2') { c.fader = -2; c.pan = 0; }
  if (id === 'bt') { c.fader = -60; }
  if (voice && id !== 'duplex') { c.dyn = { on: true, thr: -20, ratio: 3, att: 5, rel: 120, mk: 2 }; c.gate = { on: true, thr: -42, range: 18 }; c.eq.b[2] = { t: 'peaking', f: 3200, g: 2, q: 1.2 }; c.eq.b[0] = { t: 'lowshelf', f: 180, g: -2, q: 0.7 }; }
  if (id === 'duplex') { c.fader = -4; c.hpf.on = true; c.hpf.f = 100; }
  if (id === 'jingle') { c.fader = -8; }
  if (id === 'tone') { c.fader = 0; c.mute = true; c.eq.on = false; }
  return c;
}

export const AU = {
  ctx: null, on: false, muted: false,
  ch: {}, order: [],
  bus: {
    pgm: { label: 'PGM', short: 'PGM', peak: -90, dest: 'Embedder du départ (paire 1-2), loudness' },
    intl: { label: 'INTERNATIONAL', short: 'INTL', fader: 0, mute: false, peak: -90, dest: 'Embedder (paire 3-4) : diffuseurs étrangers' },
    n1: { label: 'N-1 COMMENTAIRE', short: 'N-1 COM', fader: 0, mute: false, peak: -90, dest: 'Unité de commentaire : casques du commentateur et du consultant' },
    nxs: { label: 'N-1 STUDIO', short: 'N-1 STU', fader: 0, mute: false, peak: -90, dest: 'Transmission (4 fils) : oreillette du présentateur en studio' },
    nxb: { label: 'N-1 BORD TERRAIN', short: 'N-1 BT', fader: 0, mute: false, peak: -90, dest: 'Émetteur IFB : oreillette du journaliste bord terrain' },
  },
  vca: {
    amb: { label: 'VCA 1 · AMBIANCES', short: 'VCA AMB', fader: 0, mute: false },
    canon: { label: 'VCA 2 · CANONS', short: 'VCA CAN', fader: 0, mute: false },
    img: { label: 'VCA 3 · SONS IMAGE', short: 'VCA IMG', fader: 0, mute: false },
    comm: { label: 'VCA 4 · COMMENTAIRES', short: 'VCA COM', fader: 0, mute: false },
  },
  monitor: 'pgm', dim: false, mono: false, pflActive: false, tb: null,
  lineDelay: 0, follow: false, effDelay: 0, pgmSrc: null, // ms
  emb: ['pgm', 'intl', 'none', 'none'], // paires SDI 1-2, 3-4, 5-6, 7-8
  master: { fader: 0, peakL: -90, peakR: -90, lim: true, gr: 0 },
  corr: 1, autoCanon: true, redLight: false,
  lufs: { m: -70, s: -70, i: -70, blocks: [], sBlocks: [], iSum: 0, iN: 0 },
  snaps: [], voiceLvl: {},
};
CH_DEF.forEach((d, i) => { const c = defaultStrip(d, i + 1); AU.ch[c.id] = c; AU.order.push(c.id); });

export const EMB_OPTIONS = [['pgm', 'PGM stéréo'], ['intl', 'International'], ['n1', 'N-1'], ['tone', 'Mire 1 kHz'], ['none', 'Silence']];
export const SOUND_PLAN = ['pgm', 'intl', 'none', 'none']; // plan de son demandé par la chaîne (modifiable dans l'espace formateur)
export const DEFAULT_SOUND_PLAN = [...SOUND_PLAN];
export function setSoundPlan(plan) { const p = Array.isArray(plan) && plan.length === 4 ? plan : DEFAULT_SOUND_PLAN; SOUND_PLAN.splice(0, 4, ...p); }
export function soundPlanOk() { return AU.emb.every((v, i) => v === SOUND_PLAN[i]); }
export const embLabel = (v) => (EMB_OPTIONS.find((o) => o[0] === v) || [v, v])[1];
// tolérance son/image de bout en bout (EBU R37, sortie vers l'émission) : son en avance de 40 ms au plus, en retard de 60 ms au plus (R37 demande 5 ms d'avance / 15 ms de retard au plus à chaque étape)
export const AV_TOL = { early: 40, late: 60 };
export function avOk(off = avOffsetMs(AU.pgmSrc)) { return off >= -AV_TOL.early && off <= AV_TOL.late; }
export const MONITORS = [['pgm', 'PGM'], ['intl', 'INTL'], ['n1', 'N-1 COM'], ['nxs', 'N-1 STU'], ['nxb', 'N-1 BT']];

// ---------------- état sauvegardable (snapshots) ----------------
const STRIP_KEYS = ['src', 'gain', 'ph48', 'phase', 'hpf', 'eq', 'gate', 'dyn', 'delay', 'pan', 'fader', 'mute', 'afv', 'pgm', 'intl', 'n1', 'nxs', 'nxb', 'vca'];
const clone = (o) => JSON.parse(JSON.stringify(o));
export function captureState() {
  const ch = {}; for (const k of AU.order) { const c = AU.ch[k]; ch[k] = {}; for (const p of STRIP_KEYS) ch[k][p] = clone(c[p]); }
  const bus = {}; for (const k in AU.bus) if (k !== 'pgm') bus[k] = { fader: AU.bus[k].fader, mute: AU.bus[k].mute };
  const vca = {}; for (const k in AU.vca) vca[k] = { fader: AU.vca[k].fader, mute: AU.vca[k].mute };
  return { ch, bus, vca, master: AU.master.fader, autoCanon: AU.autoCanon };
}
export function applyState(st, isolate = {}) {
  if (!st) return;
  for (const k in st.ch) { const c = AU.ch[k]; if (!c || isolate[k]) continue; const s = st.ch[k]; for (const p of STRIP_KEYS) if (s[p] !== undefined && p !== 'src') c[p] = clone(s[p]); if (s.src && s.src !== c.src) setPatch(k, s.src, true); }
  for (const k in st.bus || {}) Object.assign(AU.bus[k], st.bus[k]);
  for (const k in st.vca || {}) Object.assign(AU.vca[k], st.vca[k]);
  if (st.master != null) AU.master.fader = st.master;
  if (st.autoCanon != null) AU.autoCanon = st.autoCanon;
  applyAll();
}
function defaultSnaps() {
  const base = captureState();
  const mk = (name, desc, fn) => { const s = clone(base); fn(s); return { name, desc, data: s }; };
  return [
    mk('MATCH', 'Réglage du direct : ambiances, canons suivis par l\'assistant, commentaires ouverts.', () => {}),
    mk('AVANT-MATCH', 'Ambiance d\'avant-match : tribunes en avant, commentateurs prêts mais fermés, canons bas.', (s) => { s.ch.amb1.fader = -3; s.ch.amb2.fader = 0; s.ch.comm1.fader = -60; s.ch.comm2.fader = -60; s.autoCanon = false; for (let i = 1; i <= 6; i++) s.ch['c' + i].fader = -24; }),
    mk('MI-TEMPS · DUPLEX', 'Mi-temps : retour plateau, duplex ouvert, ambiance en fond.', (s) => { s.ch.amb1.fader = -16; s.ch.amb2.fader = -16; s.autoCanon = false; for (let i = 1; i <= 6; i++) s.ch['c' + i].fader = -40; s.ch.duplex.fader = 0; }),
    mk('TEST DE LIGNE', 'Mire 1 kHz seule sur tous les bus : test de ligne avec la chaîne (EBU R68 : −18 dBFS).', (s) => { for (const k in s.ch) s.ch[k].mute = k !== 'tone'; s.ch.tone.mute = false; s.ch.tone.fader = 0; s.autoCanon = false; }),
  ];
}
AU.snaps = defaultSnaps();
export function storeSnap(i, name) { const s = AU.snaps[i] || {}; AU.snaps[i] = { name: name || s.name || 'SNAP ' + (i + 1), desc: s.desc || 'Mémorisé à la console.', data: captureState() }; emit('audio', { type: 'snap' }); }
export function recallSnap(i, isolate) { const s = AU.snaps[i]; if (!s) return false; applyState(s.data, isolate); AU.lastSnap = i; emit('audio', { type: 'recall', i }); return true; }

// ---------------- synthèse des sources ----------------
function noiseBuffer(ctx, sec = 4, chans = 2) {
  const len = ctx.sampleRate * sec; const b = ctx.createBuffer(chans, len, ctx.sampleRate);
  for (let c = 0; c < chans; c++) {
    const d = b.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.36 * (0.85 + 0.15 * Math.sin(i / ctx.sampleRate * 2.1 + c));
    }
  }
  return b;
}
const CURVE = new Float32Array([-1, 1]); // écrêtage numérique à 0 dBFS (au-delà, la forme d'onde est coupée)

export function startAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
  const ctx = new Ctx(); AU.ctx = ctx;
  const an = (n = 1024) => { const a = ctx.createAnalyser(); a.fftSize = n; return a; };
  const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  const noise = noiseBuffer(ctx, 4, 2), mnoise = noiseBuffer(ctx, 3, 1);
  const loop = (buf, off = 0) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(0, off % buf.duration); return s; };
  // ---- entrées physiques (un nœud par entrée) ----
  const P = {}; AU.ports = P;
  const port = (id) => { if (!P[id]) P[id] = gain(1); return P[id]; };
  for (const id of MONO_PORTS) port(id);
  // entrées AES : paires stéréo ; une source mono qui y entre est répartie à gauche ET à droite
  for (let i = 1; i <= 8; i++) { const g = port('AES ' + i); g.channelCount = 2; g.channelCountMode = 'explicit'; g.channelInterpretation = 'speakers'; }
  // ---- foule : un fond commun par tribune (corrélé entre G et D) + une part indépendante ----
  AU.crowd = {};
  const couple = (k, l, r, off, lp, hp, w) => {
    const common = loop(mnoise, off); const f1 = filt('lowpass', lp); const f2 = filt('highpass', hp); const cg = gain(0.3);
    common.connect(f1); f1.connect(f2); f2.connect(cg);
    const ind = loop(noise, off + 1.3); const sp = ctx.createChannelSplitter(2); const f3 = filt('lowpass', lp * 1.2); ind.connect(f3); f3.connect(sp);
    const gl = gain(w), gr = gain(w); sp.connect(gl, 0); sp.connect(gr, 1);
    cg.connect(port(l)); cg.connect(port(r)); gl.connect(port(l)); gr.connect(port(r));
    AU.crowd[k] = { common: cg, l: gl, r: gr, f: f1 };
    return cg;
  };
  const lepBed = couple('lep', 'MIC 1', 'MIC 2', 0.2, 2600, 140, 0.55);
  const kopBed = couple('kop', 'MIC 3', 'MIC 4', 1.7, 3000, 120, 0.5);
  // kop : grosse caisse et clappements (rythme des supporters)
  AU.kopFx = gain(0); AU.kopFx.connect(port('MIC 3')); AU.kopFx.connect(port('MIC 4'));
  // canons : un peu de foule + les sons du jeu (frappes, sifflet, rebonds) selon la distance au ballon
  AU.canonFeed = [];
  CANON_POS.forEach((p, i) => {
    const bleed = gain(0.3); (p[1] > 0 || p[0] > 40 ? kopBed : lepBed).connect(bleed); bleed.connect(port('MIC ' + (5 + i)));
    const d = ctx.createDelay(0.5); const g = gain(0); d.connect(g); g.connect(port('MIC ' + (5 + i)));
    AU.canonFeed.push({ d, g, p });
  });
  AU.fxBus = gain(1); // sons ponctuels du jeu (avant répartition vers les micros)
  for (const cf of AU.canonFeed) AU.fxBus.connect(cf.d);
  AU.ambFx = gain(0.06); AU.fxBus.connect(AU.ambFx); AU.ambFx.connect(port('MIC 1')); AU.ambFx.connect(port('MIC 2'));
  // micro de la caméra HF : ambiance proche + jeu, retardé comme son image (même liaison HF)
  { const bp = filt('bandpass', 900, 0.6); const g = gain(0.2); AU.hfAmb = g; lepBed.connect(bp); bp.connect(g);
    const fx = gain(0); AU.hfFx = fx; AU.fxBus.connect(fx);
    const d = ctx.createDelay(2.0); AU.hfDelay = d; g.connect(d); fx.connect(d); d.connect(port('SDI 1/1')); }
  // EVS : son des ralentis (ambiance étouffée, présente quand un canal lit)
  AU.evsAmb = [];
  for (const [i, k] of [[0, 'AES 1'], [1, 'AES 2']]) { const lp = filt('lowpass', 900); const g = gain(0); lepBed.connect(lp); lp.connect(g); g.connect(port(k)); AU.evsAmb[i] = g; }
  // micros des commentateurs : la foule « repisse » dans les micros de la cabine (d'où le gate / expandeur)
  for (const k of ['MADI 1', 'MADI 2', 'MIC 11']) { const g = gain(k === 'MIC 11' ? 0.09 : 0.035); const lp = filt('lowpass', 3500); lepBed.connect(lp); lp.connect(g); g.connect(port(k)); }
  // duplex : bruit de fond de la liaison
  { const g = gain(0.004); const s = loop(noise, 2.2); const bp = filt('bandpass', 1500, 0.4); s.connect(bp); bp.connect(g); g.connect(port('AES 3')); }
  AU.jingleBus = port('AES 4');
  // générateur 1 kHz à −18 dBFS
  { const osc = ctx.createOscillator(); osc.frequency.value = 1000; const tg = gain(dbToLin(-18)); osc.connect(tg); tg.connect(port('GEN')); osc.start(); }

  // ---- bus ----
  const B = {}; AU.nodes = B;
  B.pgm = gain(1); B.intl = gain(1); B.n1 = gain(1); B.nxs = gain(1); B.nxb = gain(1); B.pfl = gain(1);
  B.lim = ctx.createDynamicsCompressor(); B.lim.threshold.value = -2; B.lim.ratio.value = 20; B.lim.knee.value = 0; B.lim.attack.value = 0.002; B.lim.release.value = 0.12;
  B.master = gain(1); B.pgm.connect(B.lim); B.lim.connect(B.master);
  B.out = { pgm: B.master, intl: gain(1), n1: gain(1), nxs: gain(1), nxb: gain(1), pfl: B.pfl };
  for (const k of ['intl', 'n1', 'nxs', 'nxb']) B[k].connect(B.out[k]);
  for (const k of ['intl', 'n1', 'nxs', 'nxb']) { AU.bus[k].an = an(); B.out[k].connect(AU.bus[k].an); }
  AU.bus.pgm.an = an(); B.master.connect(AU.bus.pgm.an);
  const split = ctx.createChannelSplitter(2); B.master.connect(split);
  AU.anL = an(2048); AU.anR = an(2048); split.connect(AU.anL, 0); split.connect(AU.anR, 1);
  // pondération K (approximation) pour la loudness
  const hs = filt('highshelf', 1681); hs.gain.value = 4; const hp = filt('highpass', 38, 0.5);
  AU.anK = an(2048); B.master.connect(hs); hs.connect(hp); hp.connect(AU.anK);
  // talkback : l'ingénieur du son parle dans les N-1 (simulé par un « bip » de 2 tons)
  B.tb = { n1: gain(0), nxs: gain(0), nxb: gain(0) };
  for (const k in B.tb) B.tb[k].connect(B[k]);
  // écoute : source choisie → stéréo ou mono → dim → retard de ligne → sortie
  B.monIn = gain(1);
  B.st = gain(1); B.monoG = gain(0); B.monoSum = gain(1); B.monoSum.channelCount = 1; B.monoSum.channelCountMode = 'explicit'; B.monoSum.channelInterpretation = 'speakers';
  B.monIn.connect(B.st); B.monIn.connect(B.monoSum); B.monoSum.connect(B.monoG);
  B.dim = gain(1); B.st.connect(B.dim); B.monoG.connect(B.dim);
  const delay = ctx.createDelay(2.0); AU.delay = delay; B.dim.connect(delay);
  const out = gain(1); AU.out = out; delay.connect(out); out.connect(ctx.destination);
  AU.monSrc = B.out;

  // ---- tranches ----
  for (const k of AU.order) buildStrip(AU.ch[k]);
  AU.on = true;
  applyAll(); setMonitor(AU.monitor); setLineDelay(AU.lineDelay);
}

function buildStrip(c) {
  const ctx = AU.ctx;
  const g = (v = 1) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const N = {}; c.N = N;
  N.inp = g(1); N.ph48 = g(1); N.trim = g(1);
  N.clip = ctx.createWaveShaper(); N.clip.curve = CURVE;
  N.an = ctx.createAnalyser(); N.an.fftSize = 512;
  N.inp.connect(N.ph48); N.ph48.connect(N.trim); N.trim.connect(N.clip); N.clip.connect(N.an);
  // phase : sur une tranche stéréo, on inverse le côté droit (Ø R)
  let x = N.clip;
  if (c.st) { const sp = ctx.createChannelSplitter(2), mg = ctx.createChannelMerger(2); N.phL = g(1); N.phR = g(1); x.connect(sp); sp.connect(N.phL, 0); sp.connect(N.phR, 1); N.phL.connect(mg, 0, 0); N.phR.connect(mg, 0, 1); x = mg; }
  else { N.phR = g(1); x.connect(N.phR); x = N.phR; }
  N.hpf = ctx.createBiquadFilter(); N.hpf.type = 'highpass'; N.hpf.Q.value = 0.7; x.connect(N.hpf); x = N.hpf;
  N.eq = c.eq.b.map((b) => { const f = ctx.createBiquadFilter(); f.type = b.t; x.connect(f); x = f; return f; });
  N.gate = g(1); x.connect(N.gate);
  N.comp = ctx.createDynamicsCompressor(); N.gate.connect(N.comp);
  N.mk = g(1); N.comp.connect(N.mk);
  N.dly = ctx.createDelay(1.0); N.mk.connect(N.dly);
  N.pan = ctx.createStereoPanner(); N.dly.connect(N.pan);
  N.fd = g(0); N.pan.connect(N.fd);
  N.pfl = g(0); N.pan.connect(N.pfl); N.pfl.connect(AU.nodes.pfl);
  N.send = {};
  for (const b of ['pgm', 'intl', 'n1', 'nxs', 'nxb']) { N.send[b] = g(0); N.fd.connect(N.send[b]); N.send[b].connect(AU.nodes[b]); }
  connectPatch(c);
}
// le port « MIC a-b » est une paire : on assemble deux entrées mono en stéréo
function portNode(id) {
  const P = AU.ports;
  if (P[id]) return P[id];
  const m = /^MIC (\d+)-(\d+)$/.exec(id);
  if (m) { const mg = AU.ctx.createChannelMerger(2); P['MIC ' + m[1]].connect(mg, 0, 0); P['MIC ' + m[2]].connect(mg, 0, 1); P[id] = mg; return mg; }
  return null;
}
function connectPatch(c) {
  if (c._srcNode) { try { c._srcNode.disconnect(c.N.inp); } catch (e) { /* déjà déconnecté */ } }
  const n = portNode(c.src); c._srcNode = n;
  if (n) n.connect(c.N.inp);
}
export function setPatch(k, port, silent) {
  const c = AU.ch[k]; if (!c) return;
  c.src = port;
  if (AU.ctx && c.N) connectPatch(c);
  if (!silent) applyStrip(c);
  emit('audio', { type: 'patch', k });
}
// entrées physiques d'une tranche (pour savoir ce qui y est branché)
export function portsOf(src) { const m = /^MIC (\d+)-(\d+)$/.exec(src); return m ? ['MIC ' + m[1], 'MIC ' + m[2]] : [src]; }
export function portInfo(src) { return portsOf(src).map((p) => PLUG[p] ? PLUG[p].what : 'rien de branché').join(' / '); }
// feuille de patch du car réel (espace formateur) : [{ n, port, short, label }]
export function applyAudioPatch(list) {
  if (!Array.isArray(list)) return;
  for (const r of list) {
    const c = AU.order.map((k) => AU.ch[k]).find((x) => x.n === +r.n || x.short === r.short);
    if (!c) continue;
    if (r.short) c.short = String(r.short).slice(0, 8); if (r.label) c.label = String(r.label).slice(0, 60);
    const ok = (c.st ? ST_PORTS : MONO_PORTS).includes(r.port);
    if (ok) { c.home = r.port; if (c.src !== r.port) setPatch(c.id, r.port, true); }
  }
  if (AU.ctx) applyAll();
}
// une tranche alimente-t-elle bien ses micros statiques ?
function phantomOk(c) { return portsOf(c.src).every((p) => !(PLUG[p] && PLUG[p].cond) || c.ph48); }

// ---------------- application des réglages ----------------
export function vcaDb(c) { const v = c.vca && AU.vca[c.vca]; return v ? v.fader : 0; }
function vcaMuted(c) { const v = c.vca && AU.vca[c.vca]; return !!(v && v.mute); }
// fader effectif (fader + VCA, AFV, mutes, perte du flux IP)
export function stripOn(c) { return !(c.mute || vcaMuted(c) || c.netLost) && afvOpen(c); }
export function afvOpen(c) {
  if (!c.afv) return true;
  const src = AU.pgmSrc || '';
  if (c.id === 'hfmic') { const hf = S.cams.find((x) => x.rf); return !!hf && src === 'CAM' + hf.id; }
  if (c.id === 'evsA') return src === 'EVSA';
  if (c.id === 'evsB') return src === 'EVSB';
  return true;
}
export function faderLin(c) { return stripOn(c) ? dbToLin(c.fader + vcaDb(c)) * (c.fader <= -59.5 ? 0 : 1) : 0; }
export function applyStrip(c) {
  if (!AU.ctx || !c.N) return;
  const t = AU.ctx.currentTime, N = c.N;
  const set = (p, v, tc = 0.03) => p.setTargetAtTime(v, t, tc);
  set(N.ph48.gain, phantomOk(c) ? 1 : 0, 0.15);
  set(N.trim.gain, dbToLin(c.gain - c.defGain));
  set(N.phR.gain, c.phase ? -1 : 1, 0.005); // stéréo : côté droit seulement (Ø R)
  set(N.hpf.frequency, c.hpf.on ? c.hpf.f : 10);
  c.eq.b.forEach((b, i) => { const f = N.eq[i]; f.type = b.t; set(f.frequency, b.f); set(f.Q, b.q); set(f.gain, c.eq.on ? b.g : 0); });
  set(N.comp.threshold, c.dyn.on ? c.dyn.thr : 0); set(N.comp.ratio, c.dyn.on ? c.dyn.ratio : 1); set(N.comp.knee, c.dyn.on ? 6 : 0);
  set(N.comp.attack, c.dyn.att / 1000); set(N.comp.release, c.dyn.rel / 1000);
  set(N.mk.gain, c.dyn.on ? dbToLin(c.dyn.mk) : 1);
  set(N.dly.delayTime, c.delay / 1000, 0.02);
  set(N.pan.pan, c.pan);
  set(N.fd.gain, faderLin(c), c.afv ? 0.12 : 0.03);
  set(N.pfl.gain, c.pfl ? 1 : 0, 0.01);
  for (const b of ['pgm', 'intl', 'n1', 'nxs', 'nxb']) set(N.send[b].gain, c[b] ? 1 : 0, 0.02);
}
export function applyBuses() {
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime, B = AU.nodes;
  B.master.gain.setTargetAtTime(dbToLin(AU.master.fader), t, 0.03);
  B.lim.threshold.setTargetAtTime(AU.master.lim ? -2 : 0, t, 0.02); B.lim.ratio.setTargetAtTime(AU.master.lim ? 20 : 1, t, 0.02);
  for (const k of ['intl', 'n1', 'nxs', 'nxb']) { const b = AU.bus[k]; B.out[k].gain.setTargetAtTime(b.mute ? 0 : dbToLin(b.fader), t, 0.03); }
  AU.pflActive = AU.order.some((k) => AU.ch[k].pfl);
  routeMonitor();
  B.dim.gain.setTargetAtTime(AU.dim ? dbToLin(-20) : 1, t, 0.03);
  B.st.gain.setTargetAtTime(AU.mono ? 0 : 1, t, 0.02); B.monoG.gain.setTargetAtTime(AU.mono ? 1 : 0, t, 0.02);
  AU.out.gain.setTargetAtTime(AU.muted ? 0 : 1, t, 0.03);
}
export function applyAll() { if (!AU.ctx) return; for (const k of AU.order) applyStrip(AU.ch[k]); applyBuses(); }
// compatibilité : ancien nom
export function applyFaders() { applyAll(); }

let routed = null;
function routeMonitor() {
  const want = AU.pflActive ? 'pfl' : AU.monitor;
  if (routed === want) return;
  for (const k in AU.monSrc) { try { AU.monSrc[k].disconnect(AU.nodes.monIn); } catch (e) { /* pas connecté */ } }
  AU.monSrc[want].connect(AU.nodes.monIn); routed = want;
}
export function setMonitor(bus) { AU.monitor = bus; if (AU.ctx) applyBuses(); emit('audio', { type: 'monitor' }); }
export function effMonitor() { return AU.pflActive ? 'pfl' : AU.monitor; }
export function setLineDelay(ms) { AU.lineDelay = clamp(Math.round(ms), 0, 1000); applyDelay(); }
// retard asservi : quand il est actif, le retard suit la latence de la source à l'antenne (tally du mélangeur)
export function setFollow(v) { AU.follow = !!v; applyDelay(); }
function applyDelay() {
  AU.effDelay = AU.lineDelay + (AU.follow ? videoLatencyMs(AU.pgmSrc) : 0);
  if (AU.delay) AU.delay.delayTime.setTargetAtTime(Math.min(1.9, AU.effDelay / 1000), AU.ctx.currentTime, 0.02);
}
export function setSend(k, bus, on_) { const c = AU.ch[k]; if (!c) return; c[bus] = !!on_; applyStrip(c); emit('audio', { type: 'send', k, bus }); }

// talkback : ordre de l'ingénieur du son vers un N-1 (jamais vers le PGM)
export function talkback(dest, onOff) {
  AU.tb = onOff ? dest : null;
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime;
  for (const k in AU.nodes.tb) AU.nodes.tb[k].gain.setTargetAtTime(0, t, 0.01);
  if (!onOff) return;
  const o = AU.ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(880, t); o.frequency.setValueAtTime(660, t + 0.18);
  const g = AU.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.setValueAtTime(0.18, t + 0.32); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
  o.connect(g); g.connect(AU.nodes.tb[dest]); AU.nodes.tb[dest].gain.setTargetAtTime(1, t, 0.005); o.start(t); o.stop(t + 0.4);
}

// retard de l'image du programme (latence de la source) et décalage son/image résultant
export function videoLatencyMs(pgmSrc) {
  if (!pgmSrc || !pgmSrc.startsWith('CAM')) return 0;
  const c = camById(+pgmSrc.slice(3)); return c && c.rf ? Math.round((c.rf.latencyS || 0) * 1000) : 0;
}
// positif : le son arrive après l'image ; négatif : le son est en avance
export function avOffsetMs(pgmSrc = AU.pgmSrc) { return (AU.lineDelay + (AU.follow ? videoLatencyMs(pgmSrc) : 0)) - videoLatencyMs(pgmSrc); }

// ---------------- voix (synthèse vocale) : volume suivant la console ----------------
// La synthèse vocale du navigateur ne passe pas par WebAudio : on calcule son volume à partir de
// la console (patch, gain, fader, VCA, mutes, départs vers le bus écouté, master, dim, écoute coupée).
export function voiceGain(v) {
  if (!AU.ctx || AU.muted) return 0;
  const mon = effMonitor(); let best = 0;
  for (const k of AU.order) {
    const c = AU.ch[k];
    if (!portsOf(c.src).some((p) => PLUG[p] && PLUG[p].voice === v)) continue;
    const pre = dbToLin(c.gain - c.defGain) * (phantomOk(c) ? 1 : 0) * (c.netLost ? 0 : 1);
    let g = 0;
    if (mon === 'pfl') g = c.pfl ? pre : 0;
    else {
      const post = pre * faderLin(c);
      if (mon === 'pgm') g = c.pgm ? post * dbToLin(AU.master.fader) : 0;
      else { const b = AU.bus[mon]; g = c[mon] && !b.mute ? post * dbToLin(b.fader) : 0; }
    }
    best = Math.max(best, g);
  }
  return best * (AU.dim ? dbToLin(-20) : 1);
}
// une voix est-elle à l'antenne (PGM) ? (pour la lampe rouge de la cabine)
export function voiceOnAir(v) {
  return AU.order.some((k) => { const c = AU.ch[k]; return c.pgm && faderLin(c) > dbToLin(-40) && portsOf(c.src).some((p) => PLUG[p] && PLUG[p].voice === v); });
}
// niveaux simulés des voix (dBFS au niveau nominal), fournis par le moteur de commentaires
export function setVoiceLevel(v, db) { AU.voiceLvl[v] = db; }

// ---------------- sons du jeu ----------------
function playFx(build, x, z, opts = {}) {
  const ctx = AU.ctx; if (!ctx) return;
  const t = ctx.currentTime;
  // chaque canon reçoit le son avec l'atténuation et le retard de sa distance (son : 343 m/s)
  for (const cf of AU.canonFeed) {
    const d = Math.hypot(x - cf.p[0], z - cf.p[1]);
    cf.d.delayTime.setValueAtTime(Math.min(0.45, d / 343), t);
    cf.g.gain.setValueAtTime(clamp(6 / (5 + d), 0.02, 0.7) * (opts.k || 1), t);
  }
  const hf = S.cams.find((c) => c.rf);
  if (hf) { const d = Math.hypot(x - hf.cam.position.x, z - hf.cam.position.z); AU.hfFx.gain.setValueAtTime(clamp(6 / (4 + d), 0.02, 1), t); }
  build(ctx, t, AU.fxBus);
}
function kickSound(power = 15, x = 0, z = 0) {
  playFx((ctx, t, out) => {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(52, t + 0.09);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(clamp(power / 25, 0.15, 1) * 0.9, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    // claquement du cuir (bruit court, aigu)
    const n = ctx.createBufferSource(); n.buffer = clickBuf(ctx); const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const gn = ctx.createGain(); gn.gain.value = clamp(power / 25, 0.1, 1) * 0.35;
    o.connect(g); g.connect(out); n.connect(hp); hp.connect(gn); gn.connect(out);
    o.start(t); o.stop(t + 0.16); n.start(t);
  }, x, z);
}
let _click = null;
function clickBuf(ctx) { if (_click) return _click; const len = Math.round(ctx.sampleRate * 0.03); _click = ctx.createBuffer(1, len, ctx.sampleRate); const d = _click.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len * 0.18)); return _click; }
function whistle(long = false) {
  const ref = M.humans[22] || { x: 0, z: 0 };
  playFx((ctx, t, out) => {
    const d = long ? 0.9 : 0.35;
    const o = ctx.createOscillator(); o.frequency.value = 2950; o.type = 'triangle';
    const lfo = ctx.createOscillator(); lfo.frequency.value = 32; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.02); g.gain.setValueAtTime(0.22, t + d - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(out); o.start(t); lfo.start(t); o.stop(t + d + 0.02); lfo.stop(t + d + 0.02);
  }, ref.x, ref.z, { k: 1.6 });
}
function thud(v, x, z) {
  playFx((ctx, t, out) => {
    const o = ctx.createOscillator(); o.frequency.setValueAtTime(95, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.08);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(clamp(v / 12, 0.05, 0.4), t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.12);
  }, x, z);
}
// virgule sonore (lecteur d'habillage) : accompagne le volet logo des ralentis
export function playJingle() {
  const ctx = AU.ctx; if (!ctx) return;
  const t = ctx.currentTime;
  const n = ctx.createBufferSource(); n.buffer = clickBuf(ctx); n.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4; bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(5000, t + 0.45);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
  n.connect(bp); bp.connect(g); g.connect(AU.jingleBus); n.start(t); n.stop(t + 0.62);
  [1318.5, 1760, 2637].forEach((f, i) => {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const og = ctx.createGain(); const t0 = t + 0.42 + i * 0.07;
    og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(0.12, t0 + 0.01); og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.7);
    o.connect(og); og.connect(AU.jingleBus); o.start(t0); o.stop(t0 + 0.72);
  });
}
// kop : grosse caisse + clappements « en rythme »
let kopBeat = 0, kopPattern = 0;
function kopRhythm(dt) {
  const ctx = AU.ctx; if (!ctx) return;
  const ex = (M.excite[0] + M.excite[1]) * 0.5;
  kopBeat -= dt; if (kopBeat > 0) return;
  const tempo = 0.48; kopBeat = tempo;
  kopPattern = (kopPattern + 1) % 16;
  if (ex < 0.18 && kopPattern % 8 !== 0) return;
  const t = ctx.currentTime;
  const accent = [0, 2, 4, 6, 8, 9, 10, 12, 14].includes(kopPattern);
  const o = ctx.createOscillator(); o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(accent ? 0.3 : 0.15, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g); g.connect(AU.kopFx); o.start(t); o.stop(t + 0.22);
  if (accent) for (let i = 0; i < 6; i++) { const n = ctx.createBufferSource(); n.buffer = clickBuf(ctx); const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 1400 + Math.random() * 900; const gn = ctx.createGain(); gn.gain.value = 0.05; n.connect(hp); hp.connect(gn); gn.connect(AU.kopFx); n.start(t + 0.24 + Math.random() * 0.03); }
  AU.kopFx.gain.setTargetAtTime(clamp(0.08 + ex * 0.2, 0.06, 0.3), t, 0.5);
}

on('match', (e) => {
  if (!AU.ctx) return;
  if (e.type === 'kick') kickSound(e.power, e.x || M.ball.x, e.z || M.ball.z);
  if (e.type === 'whistle') whistle(false);
  if (e.type === 'goal') whistle(true);
  if (e.type === 'bounce') thud(e.v || 3, M.ball.x, M.ball.z);
  if (e.type === 'tackle') thud(6, M.ball.x, M.ball.z);
});
on('mixer', (e) => { if (e && e.type === 'autostart' && AU.ctx && MIX.trans === 'stinger') playJingle(); });

// ---------------- boucle : mesures, automatismes ----------------
const tmp = new Float32Array(2048), tmp2 = new Float32Array(2048);
// car IP : sources de la console qui arrivent par le réseau ST 2110-30 (récepteur NMOS de la console)
const NET_AUDIO = { amb1: 'CONS:a:AMB', amb2: 'CONS:a:AMB', c1: 'CONS:a:CANONS', c2: 'CONS:a:CANONS', c3: 'CONS:a:CANONS', c4: 'CONS:a:CANONS', c5: 'CONS:a:CANONS', c6: 'CONS:a:CANONS', evsA: 'CONS:a:EVS', evsB: 'CONS:a:EVS', comm1: 'CONS:a:COMM', comm2: 'CONS:a:COMM' };
const peakOf = (an) => { const n = an.fftSize; an.getFloatTimeDomainData(tmp.subarray(0, n)); let m = 0; for (let i = 0; i < n; i++) { const v = Math.abs(tmp[i]); if (v > m) m = v; } return linToDb(m); };
const rmsOf = (an) => { const n = an.fftSize; an.getFloatTimeDomainData(tmp.subarray(0, n)); let s = 0; for (let i = 0; i < n; i++) s += tmp[i] * tmp[i]; return linToPowDb(s / n); };
let afvKey = '', autoT = 0;
export function updateAudio(dt, ctxState = {}) {
  if (ctxState.pgmSrc !== undefined && ctxState.pgmSrc !== AU.pgmSrc) { AU.pgmSrc = ctxState.pgmSrc; applyDelay(); }
  let chg = false;
  for (const [k, rx] of Object.entries(NET_AUDIO)) { const c = AU.ch[k]; const lost = S.ipMode && !rxOk(rx); if (!!c.netLost !== lost) { c.netLost = lost; chg = true; } }
  // AFV (audio suit la vidéo) : le micro HF et les EVS s'ouvrent quand leur image passe à l'antenne
  const ak = (AU.pgmSrc || '') + S.cams.map((c) => (c.rf ? c.id : '')).join('');
  if (ak !== afvKey) { afvKey = ak; chg = true; }
  AU.redLight = voiceOnAir('comm1') || voiceOnAir('comm2');
  if (!AU.ctx) return;
  if (chg) applyAll();
  const t = AU.ctx.currentTime;
  const ex = M.excite[0] + M.excite[1];
  // la foule monte d'environ 8 dB entre un temps faible et un but (le limiteur du PGM garde la marge)
  const crowd = 0.24 + clamp(ex, 0, 1.3) * 0.26;
  for (const k in AU.crowd) { const cr = AU.crowd[k]; const v = crowd; cr.common.gain.setTargetAtTime(v * 0.26, t, 0.35); cr.l.gain.setTargetAtTime(v * 0.165, t, 0.35); cr.r.gain.setTargetAtTime(v * 0.165, t, 0.35); }
  kopRhythm(dt);
  // micro HF : plus présent quand le jeu est près de la caméra, et retardé comme son image
  const hf = S.cams.find((c) => c.rf);
  if (hf) { const d = Math.hypot(M.ball.x - hf.cam.position.x, M.ball.z - hf.cam.position.z); AU.hfAmb.gain.setTargetAtTime(clamp(0.6 - d / 60, 0.05, 0.6), t, 0.2); AU.hfDelay.delayTime.setTargetAtTime(Math.max(0, (hf.rf.latencyS || 0) - (AU.effDelay || 0) / 1000), t, 0.05); }
  else AU.hfAmb.gain.setTargetAtTime(0, t, 0.2);
  // son des ralentis
  AU.evsAmb[0].gain.setTargetAtTime(ctxState.replayA ? 0.3 : 0, t, 0.15);
  AU.evsAmb[1].gain.setTargetAtTime(ctxState.replayB ? 0.3 : 0, t, 0.15);
  // assistant « suivi du jeu » : les faders motorisés des canons suivent le ballon
  autoT += dt;
  if (AU.autoCanon && autoT > 0.1) {
    autoT = 0;
    const dists = CANON_POS.map((p) => Math.hypot(M.ball.x - p[0], M.ball.z - p[1]));
    dists.forEach((d, i) => { const c = AU.ch['c' + (i + 1)]; const target = clamp(-4 - d * 0.42, -32, -4); c.fader += (target - c.fader) * 0.25; c.fader = Math.round(c.fader * 10) / 10; applyStrip(c); });
  }
  // mesures des tranches : niveau d'entrée, OVL, réduction de gain, gate
  for (const k of AU.order) {
    const c = AU.ch[k];
    let p = peakOf(c.N.an);
    const v = portsOf(c.src).map((x) => PLUG[x] && PLUG[x].voice).find(Boolean);
    if (v && AU.voiceLvl[v] > -80 && phantomOk(c) && !c.netLost) p = Math.max(p, AU.voiceLvl[v] + (c.gain - c.defGain));
    c.peak = Math.max(p, c.peak - dt * 24);
    if (p > -0.5) c.ovl = 1.2; else c.ovl = Math.max(0, c.ovl - dt);
    const realGr = -c.N.comp.reduction || 0;
    const simGr = c.dyn.on && v && AU.voiceLvl[v] > -80 ? Math.max(0, (p - c.dyn.thr) * (1 - 1 / c.dyn.ratio)) : 0;
    c.gr = c.dyn.on ? Math.max(realGr, simGr) : 0;
    // gate / expandeur : coupe la « repisse » quand la source se tait (clé : niveau d'entrée)
    if (c.gate.on) { const open = p > c.gate.thr; c.gateOpen = open; c.N.gate.gain.setTargetAtTime(open ? 1 : dbToLin(-c.gate.range), t, open ? 0.004 : 0.12); }
    else if (c.gateOpen === false || c.gateOpen === undefined) { c.gateOpen = true; c.N.gate.gain.setTargetAtTime(1, t, 0.01); }
  }
  for (const k in AU.bus) { const b = AU.bus[k]; if (b.an) b.peak = Math.max(peakOf(b.an), b.peak - dt * 24); }
  AU.master.gr = -AU.nodes.lim.reduction || 0;
  // corrélation de phase G/D du PGM (+1 : mono compatible ; −1 : opposition de phase)
  const n = 2048; AU.anL.getFloatTimeDomainData(tmp); AU.anR.getFloatTimeDomainData(tmp2);
  let sl = 0, sr = 0, slr = 0, ml = 0, mr = 0; for (let i = 0; i < n; i++) { const a = tmp[i], b = tmp2[i]; sl += a * a; sr += b * b; slr += a * b; if (Math.abs(a) > ml) ml = Math.abs(a); if (Math.abs(b) > mr) mr = Math.abs(b); }
  const corr = sl > 1e-9 && sr > 1e-9 ? slr / Math.sqrt(sl * sr) : 1; AU.corr += (corr - AU.corr) * Math.min(1, dt * 4);
  AU.master.peakL = Math.max(linToDb(ml), AU.master.peakL - dt * 24); AU.master.peakR = Math.max(linToDb(mr), AU.master.peakR - dt * 24);
  S.audioLevels = { l: AU.muted ? -90 : AU.master.peakL, r: AU.muted ? -90 : AU.master.peakR };
  // loudness (EBU R128, approx.) : moyenne quadratique pondérée K sur le bus PGM
  AU.anK.getFloatTimeDomainData(tmp);
  let ms = 0; for (let i = 0; i < 2048; i++) ms += tmp[i] * tmp[i]; ms /= 2048;
  // les voix de synthèse ne passent pas par WebAudio : on les ajoute à la mesure (niveau simulé)
  for (const v of ['comm1', 'comm2', 'bt', 'duplex']) { const lv = AU.voiceLvl[v]; if (lv > -80) { const g = AU.order.map((k) => AU.ch[k]).filter((c) => c.pgm && portsOf(c.src).some((p) => PLUG[p] && PLUG[p].voice === v)).reduce((m, c) => Math.max(m, faderLin(c) * dbToLin(c.gain - c.defGain)), 0); ms += Math.pow(dbToLin(lv - 6) * g * dbToLin(AU.master.fader), 2) * 0.5; } }
  const L = AU.lufs; const blockL = -0.691 + linToPowDb(ms * 2);
  L.blocks.push({ ms: ms * 2, t }); while (L.blocks.length && t - L.blocks[0].t > 0.4) L.blocks.shift();
  L.sBlocks.push({ ms: ms * 2, t }); while (L.sBlocks.length && t - L.sBlocks[0].t > 3) L.sBlocks.shift();
  const avg = (arr) => arr.reduce((a, b) => a + b.ms, 0) / Math.max(1, arr.length);
  L.m = -0.691 + linToPowDb(avg(L.blocks)); L.s = -0.691 + linToPowDb(avg(L.sBlocks));
  if (blockL > -70) { L.iSum += ms * 2; L.iN++; L.i = -0.691 + linToPowDb(L.iSum / L.iN); }
}
export function resetLoudness() { AU.lufs.iSum = 0; AU.lufs.iN = 0; AU.lufs.i = -70; }
// niveau RMS (dBFS) d'une tranche, pour les tests et les explications
export function stripRms(k) { const c = AU.ch[k]; return c && c.N ? rmsOf(c.N.an) : -90; }
// corrélation instantanée du PGM (sans lissage)
export function corrNow() { if (!AU.anL) return 1; AU.anL.getFloatTimeDomainData(tmp); AU.anR.getFloatTimeDomainData(tmp2); let sl = 0, sr = 0, slr = 0; for (let i = 0; i < 2048; i++) { sl += tmp[i] * tmp[i]; sr += tmp2[i] * tmp2[i]; slr += tmp[i] * tmp2[i]; } return sl > 1e-9 && sr > 1e-9 ? slr / Math.sqrt(sl * sr) : 1; }

// ---------------- pannes de la régie son (proposées dans le panneau des pannes) ----------------
export const AUDIO_FAULTS = [
  {
    id: 'n1echo', label: 'Consultant renvoyé dans son propre N-1', where: 'Régie son',
    can: () => !AU.ch.comm2.n1, inject() { setSend('comm2', 'n1', true); AU.ch.comm2.fader = Math.max(AU.ch.comm2.fader, -6); applyAll(); return {}; }, check: () => !AU.ch.comm2.n1,
    hint: 'Le consultant s\'entend avec un retard dans son casque (écho, risque de larsen). Régie son, page Bus et N-1 : couper le départ N-1 COMMENTAIRE de sa tranche.',
  },
  {
    id: 'avsync', label: 'Décalage son/image (retard de ligne déréglé)', where: 'Régie son',
    can: () => avOk(), inject() { setLineDelay(AU.lineDelay + 160 + Math.round(Math.random() * 3) * 20); return {}; }, check: () => avOk(),
    hint: 'La chaîne signale que le son arrive après les lèvres. Régie son : ramener le retard de ligne dans la tolérance (son en retard de 60 ms au plus de bout en bout ; dans le car, on vise 0 ms).',
  },
  {
    id: 'emb', label: 'Embedder déréglé (paires inversées)', where: 'Régie son',
    can: () => soundPlanOk(), inject() { const a = AU.emb[0]; AU.emb[0] = AU.emb[1]; AU.emb[1] = a; if (soundPlanOk()) AU.emb[0] = 'none'; return {}; }, check: () => soundPlanOk(),
    hint: 'La chaîne reçoit l\'international sur la paire 1-2. Régie son, page Bus et N-1 : remettre l\'embedder du départ conforme au plan de son.',
  },
  {
    id: 'ph48', label: 'Alimentation fantôme 48 V coupée sur un couple d\'ambiance', where: 'Régie son',
    can: () => AU.ch.amb2.ph48, inject() { AU.ch.amb2.ph48 = false; applyAll(); return {}; }, check: () => AU.ch.amb2.ph48, repair() { AU.ch.amb2.ph48 = true; applyAll(); },
    hint: 'L\'ambiance du kop a disparu : le vumètre d\'entrée de la tranche AMB KOP est à zéro. Les micros statiques ont besoin du 48 V : le réactiver sur la tranche (section ENTRÉE).',
  },
  {
    id: 'phase', label: 'Couple d\'ambiance en opposition de phase', where: 'Régie son',
    can: () => !AU.ch.amb1.phase, inject() { AU.ch.amb1.phase = true; applyAll(); return {}; }, check: () => !AU.ch.amb1.phase, repair() { AU.ch.amb1.phase = false; applyAll(); },
    hint: 'Le corrélateur du PGM passe dans le rouge (négatif) : écoutée en mono (télé de cuisine, smartphone), l\'ambiance s\'annule. Chercher la tranche stéréo dont un côté est inversé (Ø) et la remettre en phase. Astuce : touche MONO de l\'écoute.',
  },
  {
    id: 'gain', label: 'Gain d\'entrée trop fort sur un canon (saturation)', where: 'Régie son',
    can: () => AU.ch.c3.gain <= AU.ch.c3.defGain + 6, inject() { AU.ch.c3.gain = AU.ch.c3.defGain + 22; applyAll(); return {}; }, check: () => AU.ch.c3.gain <= AU.ch.c3.defGain + 8, repair() { AU.ch.c3.gain = AU.ch.c3.defGain; applyAll(); },
    hint: 'Les frappes du centre crachent et l\'OVL rouge s\'allume sur une tranche : le préampli sature avant tout traitement. Baisser le GAIN d\'entrée (pas le fader : la saturation est déjà dans le signal).',
  },
  {
    id: 'patch', label: 'Patch d\'entrée erroné (commentateur)', where: 'Régie son',
    can: () => AU.ch.comm1.src === AU.ch.comm1.home, inject() { setPatch('comm1', 'MADI 2'); return {}; }, check: () => AU.ch.comm1.src === AU.ch.comm1.home, repair() { setPatch('comm1', AU.ch.comm1.home); },
    hint: 'Le commentateur n\'est plus entendu et la voix du consultant sort sur deux tranches. Régie son, page E/S et patch : remettre COMM 1 sur son entrée (MADI 1, unité de commentaire).',
  },
];
