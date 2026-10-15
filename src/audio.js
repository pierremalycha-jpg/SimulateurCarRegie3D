import { S, on } from './state.js';
import { M } from './match.js';
import { clamp, dbToLin, linToDb, linToPowDb } from './util.js';
import { TEAMS } from './data.js';

// Son du programme : ambiance, micros bord terrain, commentaires (synthèse vocale), mire 1 kHz
export const AU = {
  ctx: null, on: false, muted: false,
  ch: {
    amb: { label: 'AMB tribunes (couples)', fader: -4, mute: false, peak: -90 },
    canon: { label: 'Canons bord terrain', fader: -8, mute: false, peak: -90 },
    comm: { label: 'Commentaires', fader: -60, mute: false, peak: -90 },
    tone: { label: 'Mire 1 kHz', fader: 0, mute: true, peak: -90 },
  },
  master: { fader: 0, peakL: -90, peakR: -90 },
  lufs: { m: -70, s: -70, i: -70, blocks: [], sBlocks: [], iSum: 0, iN: 0 },
};

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
  const master = ctx.createGain(); AU.masterGain = master;
  const out = ctx.createGain(); AU.out = out; master.connect(out); out.connect(ctx.destination);
  const split = ctx.createChannelSplitter(2); master.connect(split);
  AU.anL = ctx.createAnalyser(); AU.anR = ctx.createAnalyser(); AU.anL.fftSize = AU.anR.fftSize = 1024;
  split.connect(AU.anL, 0); split.connect(AU.anR, 1);
  // pondération K (approximation) pour la loudness
  const hs = ctx.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 1681; hs.gain.value = 4;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.5;
  AU.anK = ctx.createAnalyser(); AU.anK.fftSize = 2048;
  master.connect(hs); hs.connect(hp); hp.connect(AU.anK);
  const mkCh = (k) => { const g = ctx.createGain(); const an = ctx.createAnalyser(); an.fftSize = 512; g.connect(an); g.connect(master); AU.ch[k].node = g; AU.ch[k].an = an; return g; };
  // ambiance
  const amb = mkCh('amb');
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(ctx); src.loop = true;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
  const hp2 = ctx.createBiquadFilter(); hp2.type = 'highpass'; hp2.frequency.value = 140;
  const crowd = ctx.createGain(); crowd.gain.value = 0.3; AU.crowd = crowd;
  src.connect(lp); lp.connect(hp2); hp2.connect(crowd); crowd.connect(amb); src.start();
  // effets
  const canon = mkCh('canon'); AU.pan = ctx.createStereoPanner(); AU.pan.connect(canon);
  // mire
  const tone = mkCh('tone'); const osc = ctx.createOscillator(); osc.frequency.value = 1000; const tg = ctx.createGain(); tg.gain.value = dbToLin(-18); osc.connect(tg); tg.connect(tone); osc.start();
  mkCh('comm');
  AU.on = true;
  applyFaders();
}

export function applyFaders() {
  if (!AU.ctx) return;
  for (const k in AU.ch) { const c = AU.ch[k]; if (!c.node) continue; c.node.gain.setTargetAtTime(c.mute ? 0 : dbToLin(c.fader), AU.ctx.currentTime, 0.03); }
  AU.masterGain.gain.setTargetAtTime(dbToLin(AU.master.fader), AU.ctx.currentTime, 0.03);
  AU.out.gain.setTargetAtTime(AU.muted ? 0 : 1, AU.ctx.currentTime, 0.03);
}

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
  const c = AU.ch.comm;
  if (!window.speechSynthesis || c.mute || c.fader <= -59 || AU.muted) return;
  try {
    const u = new SpeechSynthesisUtterance(text); u.lang = 'fr-FR'; u.rate = 1.12; u.volume = clamp(dbToLin(c.fader), 0, 1);
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    c.speakT = performance.now();
  } catch (e) { /* synthèse vocale indisponible */ }
}

on('match', (e) => {
  if (!AU.ctx) return;
  if (e.type === 'kick') kickSound(e.power);
  if (e.type === 'whistle') whistle(false);
  if (e.type === 'goal') { whistle(true); speak(`But ! But pour ${TEAMS[e.team].name.toLowerCase()} ! ${e.score[0]} à ${e.score[1]}.`); }
  if (e.type === 'shot' && Math.random() < 0.5) speak('Frappe !');
  if (e.type === 'save' && Math.random() < 0.7) speak('Et l\'arrêt du gardien !');
});

const tmp = new Float32Array(2048);
export function updateAudio(dt) {
  if (!AU.ctx) return;
  const target = clamp(0.12 + (M.excite[0] + M.excite[1]) * 0.45, 0.1, 1.1);
  AU.crowd.gain.setTargetAtTime(target, AU.ctx.currentTime, 0.35);
  const peak = (an) => { an.getFloatTimeDomainData(tmp.subarray(0, an.fftSize)); let m = 0; for (let i = 0; i < an.fftSize; i++) m = Math.max(m, Math.abs(tmp[i])); return linToDb(m); };
  for (const k in AU.ch) { const c = AU.ch[k]; if (!c.an) continue; const p = peak(c.an); c.peak = Math.max(p, c.peak - dt * 24); }
  if (AU.ch.comm.speakT && performance.now() - AU.ch.comm.speakT < 1500 && !AU.ch.comm.mute) AU.ch.comm.peak = Math.max(AU.ch.comm.peak, AU.ch.comm.fader - 14 + Math.random() * 6);
  const pl = peak(AU.anL), pr = peak(AU.anR);
  AU.master.peakL = Math.max(pl, AU.master.peakL - dt * 24); AU.master.peakR = Math.max(pr, AU.master.peakR - dt * 24);
  S.audioLevels = { l: AU.muted ? -90 : AU.master.peakL, r: AU.muted ? -90 : AU.master.peakR };
  // loudness (EBU R128, approx.) : moyenne quadratique pondérée K
  AU.anK.getFloatTimeDomainData(tmp);
  let ms = 0; for (let i = 0; i < 2048; i++) ms += tmp[i] * tmp[i]; ms /= 2048;
  const L = AU.lufs; const blockL = -0.691 + linToPowDb(ms * 2);
  L.blocks.push({ ms: ms * 2, t: AU.ctx.currentTime });
  while (L.blocks.length && AU.ctx.currentTime - L.blocks[0].t > 0.4) L.blocks.shift();
  L.sBlocks.push({ ms: ms * 2, t: AU.ctx.currentTime });
  while (L.sBlocks.length && AU.ctx.currentTime - L.sBlocks[0].t > 3) L.sBlocks.shift();
  const avg = (arr) => arr.reduce((a, b) => a + b.ms, 0) / Math.max(1, arr.length);
  L.m = -0.691 + linToPowDb(avg(L.blocks)); L.s = -0.691 + linToPowDb(avg(L.sBlocks));
  if (blockL > -70) { L.iSum += ms * 2; L.iN++; L.i = -0.691 + linToPowDb(L.iSum / L.iN); }
}
export function resetLoudness() { AU.lufs.iSum = 0; AU.lufs.iN = 0; AU.lufs.i = -70; }
