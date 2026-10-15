import { S, on, camById } from './state.js';
import { M } from './match.js';
import { clamp, dbToLin, linToDb, linToPowDb } from './util.js';
import { TEAMS } from './data.js';
import { rxOk } from './net/fabric.js';

// ----------------------------------------------------------------------------------
// Console son du car : sources, bus PGM / international / N-1, écoute, retard de ligne
// (synchro labiale), embedder SDI et mesure de loudness (EBU R128, approchée).
// ----------------------------------------------------------------------------------
export const AU = {
  ctx: null, on: false, muted: false,
  ch: {
    amb: { label: 'AMB tribunes (couples)', fader: -4, mute: false, peak: -90, intl: true, comm: false },
    canon: { label: 'Canons bord terrain', fader: -8, mute: false, peak: -90, intl: true, comm: false },
    hfmic: { label: 'Micro CAM HF (désembeddé)', fader: -60, mute: false, peak: -90, intl: true, comm: false },
    evs: { label: 'Son des ralentis (EVS)', fader: -10, mute: false, peak: -90, intl: true, comm: false },
    comm1: { label: 'Commentateur', fader: -60, mute: false, peak: -90, intl: false, comm: true },
    comm2: { label: 'Consultant', fader: -60, mute: false, peak: -90, intl: false, comm: true },
    duplex: { label: 'Duplex studio', fader: -6, mute: false, peak: -90, intl: false, comm: true },
    tone: { label: 'Mire 1 kHz', fader: 0, mute: true, peak: -90, intl: true, comm: false },
  },
  bus: { pgm: { label: 'PGM', peak: -90 }, intl: { label: 'INTERNATIONAL', peak: -90 }, n1: { label: 'N-1 commentaires', peak: -90 } },
  monitor: 'pgm', lineDelay: 0, follow: false, effDelay: 0, pgmSrc: null, // ms
  emb: ['pgm', 'intl', 'none', 'none'], // paires SDI 1-2, 3-4, 5-6, 7-8
  master: { fader: 0, peakL: -90, peakR: -90 },
  lufs: { m: -70, s: -70, i: -70, blocks: [], sBlocks: [], iSum: 0, iN: 0 },
};
export const EMB_OPTIONS = [['pgm', 'PGM stéréo'], ['intl', 'International'], ['n1', 'N-1'], ['tone', 'Mire 1 kHz'], ['none', 'Silence']];
export const SOUND_PLAN = ['pgm', 'intl', 'none', 'none']; // plan de son demandé par la chaîne (modifiable dans l'espace formateur)
export const DEFAULT_SOUND_PLAN = [...SOUND_PLAN];
export function setSoundPlan(plan) { const p = Array.isArray(plan) && plan.length === 4 ? plan : DEFAULT_SOUND_PLAN; SOUND_PLAN.splice(0, 4, ...p); }
export function soundPlanOk() { return AU.emb.every((v, i) => v === SOUND_PLAN[i]); }
export const embLabel = (v) => (EMB_OPTIONS.find((o) => o[0] === v) || [v, v])[1];
// tolérance son/image (EBU R37) : son en avance de 40 ms au plus, en retard de 60 ms au plus
export const AV_TOL = { early: 40, late: 60 };
export function avOk(off = avOffsetMs(AU.pgmSrc)) { return off >= -AV_TOL.early && off <= AV_TOL.late; }

function noiseBuffer(ctx, sec = 4) {
  const len = ctx.sampleRate * sec; const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.36 * (0.85 + 0.15 * Math.sin(i / ctx.sampleRate * 2.1 + c));
    }
  }
  return b;
}

export function startAudio() {
  if (AU.ctx) { if (AU.ctx.state === 'suspended') AU.ctx.resume(); return; }
  const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
  const ctx = new Ctx(); AU.ctx = ctx;
  const an = (n = 1024) => { const a = ctx.createAnalyser(); a.fftSize = n; return a; };
  // bus
  const pgm = ctx.createGain(); const intl = ctx.createGain(); const n1 = ctx.createGain();
  AU.pgmBus = pgm; AU.intlBus = intl; AU.n1Bus = n1;
  for (const [k, b] of [['pgm', pgm], ['intl', intl], ['n1', n1]]) { AU.bus[k].an = an(); b.connect(AU.bus[k].an); }
  // master (gain), retard de ligne, sortie d'écoute
  const master = ctx.createGain(); AU.masterGain = master; pgm.connect(master);
  const delay = ctx.createDelay(2.0); AU.delay = delay;
  const out = ctx.createGain(); AU.out = out;
  delay.connect(out); out.connect(ctx.destination);
  AU.monSrc = { pgm: master, intl, n1 };
  AU.monSrc.pgm.connect(delay);
  const split = ctx.createChannelSplitter(2); master.connect(split);
  AU.anL = an(); AU.anR = an(); split.connect(AU.anL, 0); split.connect(AU.anR, 1);
  // pondération K (approximation) pour la loudness
  const hs = ctx.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 1681; hs.gain.value = 4;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.5;
  AU.anK = an(2048); master.connect(hs); hs.connect(hp); hp.connect(AU.anK);
  // tranches : fader -> PGM, et départs vers international / N-1
  const mkCh = (k) => {
    const c = AU.ch[k]; const g = ctx.createGain(); c.an = an(512); g.connect(c.an); g.connect(pgm);
    c.sendIntl = ctx.createGain(); c.sendIntl.gain.value = c.intl ? 1 : 0; g.connect(c.sendIntl); c.sendIntl.connect(intl);
    if (c.n1 == null) c.n1 = !c.comm;
    c.sendN1 = ctx.createGain(); c.sendN1.gain.value = c.n1 ? 1 : 0; g.connect(c.sendN1); c.sendN1.connect(n1);
    c.node = g; return g;
  };
  const noise = noiseBuffer(ctx);
  const loop = (buf) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
  const filt = (type, f, q = 0.7) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b; };
  // ambiance tribunes
  const amb = mkCh('amb');
  { const s = loop(noise); const lp = filt('lowpass', 2600); const hp2 = filt('highpass', 140); const crowd = ctx.createGain(); crowd.gain.value = 0.3; AU.crowd = crowd; s.connect(lp); lp.connect(hp2); hp2.connect(crowd); crowd.connect(amb); }
  // canons bord terrain (frappes, sifflet)
  const canon = mkCh('canon'); AU.pan = ctx.createStereoPanner(); AU.pan.connect(canon);
  // micro de la caméra HF : ambiance proche, transportée avec l'image (même retard)
  const hfmic = mkCh('hfmic');
  { const s = loop(noise); const bp = filt('bandpass', 900, 0.6); const g = ctx.createGain(); g.gain.value = 0.25; AU.hfAmb = g; const d = ctx.createDelay(2.0); AU.hfDelay = d; s.connect(bp); bp.connect(g); g.connect(d); d.connect(hfmic); }
  // son des ralentis : ambiance étouffée, présente seulement quand un ralenti est lu
  const evs = mkCh('evs');
  { const s = loop(noise); const lp = filt('lowpass', 700); const g = ctx.createGain(); g.gain.value = 0; AU.evsAmb = g; s.connect(lp); lp.connect(g); g.connect(evs); }
  // voix simulées (consultant, duplex) : bruit filtré modulé au rythme des syllabes
  const voice = (k, f) => {
    const ch = mkCh(k); const s = loop(noise); const bp = filt('bandpass', f, 1.4); const env = ctx.createGain(); env.gain.value = 0;
    s.connect(bp); bp.connect(env); env.connect(ch); AU.ch[k].env = env;
  };
  voice('comm2', 650); voice('duplex', 900);
  mkCh('comm1');
  // mire 1 kHz à -18 dBFS
  const tone = mkCh('tone'); const osc = ctx.createOscillator(); osc.frequency.value = 1000; const tg = ctx.createGain(); tg.gain.value = dbToLin(-18); osc.connect(tg); tg.connect(tone); osc.start();
  AU.on = true;
  applyFaders(); setMonitor(AU.monitor); setLineDelay(AU.lineDelay);
}

export function applyFaders() {
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime;
  for (const k in AU.ch) { const c = AU.ch[k]; if (!c.node) continue; c.node.gain.setTargetAtTime(c.mute || c.netLost ? 0 : dbToLin(c.fader), t, 0.03); }
  AU.masterGain.gain.setTargetAtTime(dbToLin(AU.master.fader), t, 0.03);
  AU.out.gain.setTargetAtTime(AU.muted ? 0 : 1, t, 0.03);
}
export function setMonitor(bus) {
  AU.monitor = bus;
  if (!AU.ctx) return;
  for (const k in AU.monSrc) { try { AU.monSrc[k].disconnect(AU.delay); } catch (e) { /* pas connecté */ } }
  AU.monSrc[bus].connect(AU.delay);
}
export function setLineDelay(ms) { AU.lineDelay = clamp(Math.round(ms), 0, 1000); applyDelay(); }
// retard asservi : quand il est actif, le retard suit la latence de la source à l'antenne (tally du mélangeur)
export function setFollow(v) { AU.follow = !!v; applyDelay(); }
function applyDelay() {
  AU.effDelay = AU.lineDelay + (AU.follow ? videoLatencyMs(AU.pgmSrc) : 0);
  if (AU.delay) AU.delay.delayTime.setTargetAtTime(Math.min(1.9, AU.effDelay / 1000), AU.ctx.currentTime, 0.02);
}
export function setSend(k, bus, on_) {
  const c = AU.ch[k]; c[bus] = !!on_;
  const node = bus === 'intl' ? c.sendIntl : c.sendN1;
  if (node) node.gain.setTargetAtTime(on_ ? 1 : 0, AU.ctx.currentTime, 0.02);
}

// retard de l'image du programme (latence de la source) et décalage son/image résultant
export function videoLatencyMs(pgmSrc) {
  if (!pgmSrc || !pgmSrc.startsWith('CAM')) return 0;
  const c = camById(+pgmSrc.slice(3)); return c && c.rf ? Math.round((c.rf.latencyS || 0) * 1000) : 0;
}
// positif : le son arrive après l'image ; négatif : le son est en avance
export function avOffsetMs(pgmSrc = AU.pgmSrc) { return (AU.lineDelay + (AU.follow ? videoLatencyMs(pgmSrc) : 0)) - videoLatencyMs(pgmSrc); }

function kickSound(power = 15) {
  const ctx = AU.ctx; if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(clamp(power / 25, 0.15, 1) * 0.9, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
  o.connect(g); g.connect(AU.pan); o.start(t); o.stop(t + 0.16);
  AU.pan.pan.setValueAtTime(clamp(M.ball.x / 55, -1, 1), t);
}
function whistle(long = false) {
  const ctx = AU.ctx; if (!ctx) return;
  const t = ctx.currentTime; const d = long ? 0.9 : 0.35;
  const o = ctx.createOscillator(); o.frequency.value = 2950; o.type = 'triangle';
  const lfo = ctx.createOscillator(); lfo.frequency.value = 32; const lg = ctx.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency);
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.18, t + 0.02); g.gain.setValueAtTime(0.18, t + d - 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(AU.ch.canon.node); o.start(t); lfo.start(t); o.stop(t + d + 0.02); lfo.stop(t + d + 0.02);
}
function speak(text) {
  const c = AU.ch.comm1;
  // la synthèse vocale du navigateur ne passe pas par la console : on ne l'entend que sur l'écoute PGM
  if (!window.speechSynthesis || c.mute || c.fader <= -59 || AU.muted || AU.monitor !== 'pgm') { c.speakT = performance.now(); return; }
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = 1.12; u.volume = clamp(dbToLin(c.fader), 0, 1);
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    c.speakT = performance.now();
  } catch (e) { /* synthèse vocale indisponible */ }
}
function talk(k, dur) { const c = AU.ch[k]; c.talkUntil = performance.now() + dur * 1000; }

on('match', (e) => {
  if (!AU.ctx) return;
  if (e.type === 'kick') kickSound(e.power);
  if (e.type === 'whistle') whistle(false);
  if (e.type === 'goal') { whistle(true); speak(`But ! But pour ${TEAMS[e.team].name.toLowerCase()} ! ${e.score[0]} à ${e.score[1]}.`); talk('comm2', 4); }
  if (e.type === 'shot' && Math.random() < 0.5) { speak('Frappe !'); talk('comm2', 2); }
  if (e.type === 'save' && Math.random() < 0.7) speak('Et l\'arrêt du gardien !');
});

const tmp = new Float32Array(2048);
// car IP : sources de la console qui arrivent par le réseau ST 2110-30 (récepteur NMOS de la console)
const NET_AUDIO = { amb: 'CONS:a:AMB', canon: 'CONS:a:CANONS', evs: 'CONS:a:EVS', comm1: 'CONS:a:COMM', comm2: 'CONS:a:COMM' };
export function updateAudio(dt, ctxState = {}) {
  if (ctxState.pgmSrc !== undefined && ctxState.pgmSrc !== AU.pgmSrc) { AU.pgmSrc = ctxState.pgmSrc; applyDelay(); }
  let chg = false;
  for (const [k, rx] of Object.entries(NET_AUDIO)) { const lost = S.ipMode && !rxOk(rx); if (!!AU.ch[k].netLost !== lost) { AU.ch[k].netLost = lost; chg = true; } }
  if (chg) applyFaders();
  if (!AU.ctx) return;
  const t = AU.ctx.currentTime;
  const target = clamp(0.12 + (M.excite[0] + M.excite[1]) * 0.45, 0.1, 1.1);
  AU.crowd.gain.setTargetAtTime(target, t, 0.35);
  // micro HF : plus présent quand le jeu est près de la caméra, et retardé comme son image
  const hf = S.cams.find((c) => c.rf);
  if (hf) { const d = Math.hypot(M.ball.x - hf.cam.position.x, M.ball.z - hf.cam.position.z); AU.hfAmb.gain.setTargetAtTime(clamp(0.6 - d / 60, 0.05, 0.6), t, 0.2); AU.hfDelay.delayTime.setTargetAtTime(Math.max(0, (hf.rf.latencyS || 0) - (AU.effDelay || 0) / 1000), t, 0.05); }
  else AU.hfAmb.gain.setTargetAtTime(0, t, 0.2);
  // son des ralentis
  AU.evsAmb.gain.setTargetAtTime(ctxState.replay ? 0.35 : 0, t, 0.15);
  // voix simulées : syllabes
  const now = performance.now();
  if (ctxState.studioOnAir && !(AU.ch.duplex.talkUntil > now) && Math.random() < dt * 0.6) talk('duplex', 2 + Math.random() * 3);
  if (!(AU.ch.comm2.talkUntil > now) && Math.random() < dt * 0.04) talk('comm2', 1.5 + Math.random() * 2);
  for (const k of ['comm2', 'duplex']) {
    const c = AU.ch[k]; const active = c.talkUntil > now && !(k === 'duplex' && !ctxState.studioOnAir);
    const syl = active ? (0.35 + 0.65 * Math.abs(Math.sin(now / 1000 * 2 * Math.PI * (4 + Math.sin(now / 700) * 1.5)))) * (Math.random() < 0.12 ? 0.1 : 1) : 0;
    c.env.gain.setTargetAtTime(syl * 0.9, t, 0.03);
  }
  const peak = (an) => { an.getFloatTimeDomainData(tmp.subarray(0, an.fftSize)); let m = 0; for (let i = 0; i < an.fftSize; i++) m = Math.max(m, Math.abs(tmp[i])); return linToDb(m); };
  for (const k in AU.ch) { const c = AU.ch[k]; if (!c.an) continue; const p = peak(c.an); c.peak = Math.max(p, c.peak - dt * 24); }
  if (AU.ch.comm1.speakT && now - AU.ch.comm1.speakT < 1500 && !AU.ch.comm1.mute) AU.ch.comm1.peak = Math.max(AU.ch.comm1.peak, AU.ch.comm1.fader - 14 + Math.random() * 6);
  for (const k in AU.bus) { const b = AU.bus[k]; if (b.an) b.peak = Math.max(peak(b.an), b.peak - dt * 24); }
  const pl = peak(AU.anL), pr = peak(AU.anR);
  AU.master.peakL = Math.max(pl, AU.master.peakL - dt * 24); AU.master.peakR = Math.max(pr, AU.master.peakR - dt * 24);
  S.audioLevels = { l: AU.muted ? -90 : AU.master.peakL, r: AU.muted ? -90 : AU.master.peakR };
  // loudness (EBU R128, approx.) : moyenne quadratique pondérée K sur le bus PGM
  AU.anK.getFloatTimeDomainData(tmp);
  let ms = 0; for (let i = 0; i < 2048; i++) ms += tmp[i] * tmp[i]; ms /= 2048;
  const L = AU.lufs; const blockL = -0.691 + linToPowDb(ms * 2);
  L.blocks.push({ ms: ms * 2, t }); while (L.blocks.length && t - L.blocks[0].t > 0.4) L.blocks.shift();
  L.sBlocks.push({ ms: ms * 2, t }); while (L.sBlocks.length && t - L.sBlocks[0].t > 3) L.sBlocks.shift();
  const avg = (arr) => arr.reduce((a, b) => a + b.ms, 0) / Math.max(1, arr.length);
  L.m = -0.691 + linToPowDb(avg(L.blocks)); L.s = -0.691 + linToPowDb(avg(L.sBlocks));
  if (blockL > -70) { L.iSum += ms * 2; L.iN++; L.i = -0.691 + linToPowDb(L.iSum / L.iN); }
}
export function resetLoudness() { AU.lufs.iSum = 0; AU.lufs.iN = 0; AU.lufs.i = -70; }

// pannes de la régie son (proposées dans le panneau des pannes)
export const AUDIO_FAULTS = [
  {
    id: 'n1echo', label: 'Consultant renvoyé dans son propre N-1', where: 'Régie son',
    can: () => !AU.ch.comm2.n1, inject() { setSend('comm2', 'n1', true); AU.ch.comm2.fader = Math.max(AU.ch.comm2.fader, -6); applyFaders(); return {}; }, check: () => !AU.ch.comm2.n1,
    hint: 'Le consultant s\'entend avec un retard dans son casque (écho, risque de larsen). Régie son : couper le départ N-1 de sa tranche.',
  },
  {
    id: 'avsync', label: 'Décalage son/image (retard de ligne déréglé)', where: 'Régie son',
    can: () => avOk(), inject() { setLineDelay(AU.lineDelay + 160 + Math.round(Math.random() * 3) * 20); return {}; }, check: () => avOk(),
    hint: 'La chaîne signale que le son arrive après les lèvres. Régie son : ramener le retard de ligne dans la tolérance (son en retard de 60 ms au plus).',
  },
  {
    id: 'emb', label: 'Embedder déréglé (paires inversées)', where: 'Régie son',
    can: () => soundPlanOk(), inject() { const a = AU.emb[0]; AU.emb[0] = AU.emb[1]; AU.emb[1] = a; if (soundPlanOk()) AU.emb[0] = 'none'; return {}; }, check: () => soundPlanOk(),
    hint: 'La chaîne reçoit l\'international sur la paire 1-2. Régie son : remettre l\'embedder du départ conforme au plan de son.',
  },
];
