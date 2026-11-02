// @ts-check
import { pt, pe } from './app/profiler.js';
import { makeReader } from './readback.js';
import * as THREE from 'three';
import { S, emit, on, camById } from './state.js';
import { W } from './world.js';
import { T as TR } from './truck.js';
import { SNAP, LIVE, sampleRec, applySnapshot, captureLive, recRange } from './match.js';
import { GFX, stingerLogo } from './gfx.js';
import { rtSize, lineupStep } from './bcam.js';
import { makeCanvas, tc, clamp, roundRect } from './util.js';
import { EQUIP, mixInputs, evsLayout } from './equip.js';
import { routerInOf, physToLogical, destFeed } from './patch.js';
import { FORMATS } from './data/cameras.js';
import { NET, netOk, ptpLocked } from './ipnet.js';
import { FAB, delivery, setRxManual } from './net/fabric.js';
import { textureMedia } from './emission/video.js';
import { MEDIAS } from './emission/medias.js';

const FONT = '"Barlow Condensed", "Arial Narrow", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const SC = 1 / 1.1; // échelle des textures "canvas" vers le domaine stocké (100 % = 1/1.1)

// ----------------------------------------------------------------------------------
// Textures fixes : mire, pas de signal, noir, studio
// ----------------------------------------------------------------------------------
function canvasTex(c) { const t = new THREE.CanvasTexture(c); t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; return t; }
function drawBars(g, w, h, label) {
  const cols = ['#ffffff', '#bfbf00', '#00bfbf', '#00bf00', '#bf00bf', '#bf0000', '#0000bf', '#000000'];
  const bw = w / 8;
  cols.forEach((c, i) => { g.fillStyle = c; g.fillRect(i * bw, 0, bw + 1, h * 0.72); });
  // pluge
  const y = h * 0.72; g.fillStyle = '#101010'; g.fillRect(0, y, w, h - y);
  g.fillStyle = '#000'; g.fillRect(w * 0.1, y + 8, w * 0.1, h - y - 16); g.fillStyle = '#1c1c1c'; g.fillRect(w * 0.22, y + 8, w * 0.1, h - y - 16);
  g.fillStyle = '#ebebeb'; g.fillRect(w * 0.7, y + 8, w * 0.2, h - y - 16);
  if (label) { g.fillStyle = 'rgba(0,0,0,0.85)'; g.fillRect(w * 0.33, y + 6, w * 0.34, h - y - 12); g.fillStyle = '#fff'; g.font = `600 ${Math.round(h * 0.11)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w / 2, y + (h - y) / 2); }
}
export const TEX = {};
function initTextures() {
  { const c = makeCanvas(480, 270); drawBars(c.getContext('2d'), 480, 270, 'MIRE 100/75 · 1 kHz -18 dBFS'); TEX.bars = canvasTex(c); }
  { const c = makeCanvas(480, 270); const g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, 480, 270); TEX.black = canvasTex(c); }
  { const c = makeCanvas(480, 270); const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, 270); gr.addColorStop(0, '#1d2b45'); gr.addColorStop(1, '#0c1220'); g.fillStyle = gr; g.fillRect(0, 0, 480, 270);
    for (let i = 0; i < 12; i++) { g.fillStyle = `rgba(80,140,255,${0.08 + (i % 3) * 0.04})`; g.fillRect(i * 42, 20, 30, 120); }
    g.fillStyle = '#2b3a55'; g.fillRect(0, 190, 480, 80); g.fillStyle = '#d8d8d8'; g.fillRect(120, 170, 240, 26);
    for (const x of [175, 305]) { g.fillStyle = '#1b1f2a'; g.fillRect(x - 24, 112, 48, 64); g.fillStyle = '#c99a7a'; g.beginPath(); g.arc(x, 98, 17, 0, 7); g.fill(); g.fillStyle = '#2a1a10'; g.beginPath(); g.arc(x, 92, 17, Math.PI, 0); g.fill(); }
    g.fillStyle = '#ffd23f'; g.font = `700 22px ${FONT}`; g.fillText('STUDIO · DUPLEX', 16, 250);
    TEX.studio = canvasTex(c); }
  TEX.noSig = {};
  TEX.logo = stingerLogo();
}
function noSignalTex(text = 'PAS DE SIGNAL', sub = '') {
  const key = text + sub;
  if (TEX.noSig[key]) return TEX.noSig[key];
  const c = makeCanvas(480, 270); const g = c.getContext('2d');
  g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 480, 270);
  g.strokeStyle = '#3a1b1b'; g.lineWidth = 3; g.strokeRect(6, 6, 468, 258);
  g.fillStyle = '#ff4d4d'; g.font = `700 34px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 240, 120);
  g.fillStyle = '#9aa4ad'; g.font = `500 20px ${FONT}`; g.fillText(sub, 240, 160);
  return (TEX.noSig[key] = canvasTex(c));
}
const camBarsCache = {};
function camBarsTex(id) {
  if (camBarsCache[id]) return camBarsCache[id];
  const c = makeCanvas(480, 270); drawBars(c.getContext('2d'), 480, 270, `BARRES CAM ${id}`);
  return (camBarsCache[id] = canvasTex(c));
}

// ----------------------------------------------------------------------------------
// Sources et grille
// ----------------------------------------------------------------------------------
export const EXTRA_SOURCES = [
  { id: 'EVSA', label: 'EVS A', short: 'EVS A' }, { id: 'EVSB', label: 'EVS B', short: 'EVS B' },
  { id: 'GFX', label: 'HABILLAGE', short: 'GFX' }, { id: 'STUDIO', label: 'STUDIO', short: 'STU' },
  { id: 'BARS', label: 'MIRE', short: 'BARS' }, { id: 'BLACK', label: 'NOIR', short: 'BLK' },
  { id: 'PGM', label: 'PGM', short: 'PGM' }, { id: 'CLEAN', label: 'CLEAN FEED', short: 'CLN' }, { id: 'PVW', label: 'PVW', short: 'PVW' }, { id: 'RETANT', label: 'RETOUR ANT.', short: 'RET' },
];
export function allSources() {
  const l = [];
  for (let i = 1; i <= S.maxCams; i++) { const c = camById(i); l.push({ id: 'CAM' + i, label: `CAM ${i}`, short: String(i), cam: c, exists: !!c }); }
  return l.concat(EXTRA_SOURCES.map((s) => ({ ...s, cam: null, exists: true })));
}
export function sourceLabel(id) {
  if (!id) return '—';
  if (id.startsWith('CAM')) return `CAM ${id.slice(3)}`;
  // entrées de la grille du car SDI sans source du simulateur (Videohub : entrée libre, copie SDR, découpe)
  if (id === 'GFXK') return 'GFX KEY';
  if (/^VH\d+$/.test(id)) return 'GRILLE IN ' + id.slice(2);
  const s = EXTRA_SOURCES.find((x) => x.id === id); return s ? s.label : id;
}

// vh : état propre à la Videohub du car SDI (étiquettes, verrous, ui/st_videohub.js et videohub.js) ;
// guard(dest) : refus éventuel d'une commutation (sortie verrouillée), installé par videohub.js
export const ROUTER = { map: {}, phase: {}, customMV: false, customREC: false, lastTake: null, vh: null, guard: null };
export const DESTS = [];
for (let i = 1; i <= 22; i++) DESTS.push({ id: 'ME' + i, group: 'Mélangeur', label: `Entrée ${i}` });
for (let i = 1; i <= 18; i++) DESTS.push({ id: 'MV' + i, group: 'Multiview', label: `Tuile ${i}` });
for (let i = 1; i <= 8; i++) DESTS.push({ id: 'REC' + i, group: 'EVS (enregistrement)', label: `Entrée REC ${i}` });
DESTS.push({ id: 'AUX_TX1', group: 'Départs et AUX', label: 'Départ TX1 (fibre)' }, { id: 'AUX_TX2', group: 'Départs et AUX', label: 'Départ TX2 (satellite)' }, { id: 'AUX_GIANT', group: 'Départs et AUX', label: 'Écran géant du stade' }, { id: 'AUX_VISION', group: 'Départs et AUX', label: 'Moniteur Grade 1 (vision)' });

export function defaultRouting(full = true) {
  const m = ROUTER.map;
  if (full) {
    const nIn = mixInputs();
    // les 6 sources « fixes » occupent les dernières entrées du mélangeur
    const extras = ['EVSA', 'EVSB', 'GFX', 'STUDIO', 'BARS', 'BLACK'];
    for (let i = 1; i <= 22; i++) delete m['ME' + i];
    for (let i = 1; i <= nIn - extras.length; i++) m['ME' + i] = 'CAM' + i;
    extras.forEach((s, k) => { m['ME' + (nIn - extras.length + 1 + k)] = s; });
    m.AUX_TX1 = 'PGM'; m.AUX_TX2 = 'PGM'; m.AUX_GIANT = 'CLEAN'; m.AUX_VISION = 'CAM1';
  }
  if (!ROUTER.customMV) {
    const list = S.cams.map((c) => 'CAM' + c.id).concat(['EVSA', 'EVSB', 'GFX', 'RETANT', 'CLEAN', 'STUDIO', 'BARS', 'BLACK']);
    for (let i = 1; i <= 18; i++) m['MV' + i] = list[i - 1] || 'BLACK';
  }
  if (!ROUTER.customREC) {
    for (let i = 1; i <= 8; i++) { delete m['REC' + i]; delete ROUTER.phase['REC' + i]; }
    // priorité : super ralentis, puis les autres (dans la limite des canaux du ou des serveurs)
    const order = [...S.cams].sort((a, b) => (b.hfr - a.hfr) || (a.id - b.id));
    const free = (k, n) => { for (let j = k; j < k + n; j++) if (m['REC' + j]) return false; return true; };
    for (const c of order) {
      for (let k = 1; k <= 8; k++) {
        if (!free(k, c.hfr) || routeRec(k, 'CAM' + c.id, true, true)) continue;
        routeRec(k, 'CAM' + c.id, true); break;
      }
    }
  }
  syncRecStarts();
}

export function routeRec(ch, src, silent = false, dryRun = false) {
  const m = ROUTER.map;
  const L = evsLayout();
  const cam0 = src && src.startsWith('CAM') ? camById(+src.slice(3)) : null;
  const n0 = cam0 ? cam0.hfr : 1;
  if (ch > L.rec) return `Entrée REC ${ch} indisponible : ${L.label}.`;
  if (ch + n0 - 1 > L.rec) return `Pas assez d'entrées : ${src} est une caméra ${n0}x qui demande ${n0} canaux d'enregistrement (${L.label}).`;
  if (n0 > 1 && L.recServer(ch) !== L.recServer(ch + n0 - 1)) return `Les ${n0} phases d'une caméra super ralenti doivent être enregistrées sur le même serveur XT4K.`;
  if (dryRun) return null;
  // libère les phases de l'ancienne source
  const old = m['REC' + ch];
  if (old) for (let i = 1; i <= 8; i++) if (m['REC' + i] === old) { delete m['REC' + i]; delete ROUTER.phase['REC' + i]; }
  const cam = src && src.startsWith('CAM') ? camById(+src.slice(3)) : null;
  const n = cam ? cam.hfr : 1;
  if (ch + n - 1 > 8) return `Pas assez d'entrées : ${src} est une caméra ${n}x qui demande ${n} entrées d'enregistrement.`;
  for (let k = 0; k < n; k++) {
    const prev = m['REC' + (ch + k)];
    if (prev && prev !== src) for (let i = 1; i <= 8; i++) if (m['REC' + i] === prev) { delete m['REC' + i]; delete ROUTER.phase['REC' + i]; }
    m['REC' + (ch + k)] = src; ROUTER.phase['REC' + (ch + k)] = k;
  }
  if (!silent) { ROUTER.customREC = true; syncRecStarts(); }
  return null;
}

export function route(dest, src) {
  if (S.ipMode && !NET.nmos) return 'Registre NMOS injoignable : le contrôleur ne peut plus établir de connexion (IS-05). Les flux déjà établis continuent.';
  if (S.ipMode && FAB.res) {
    const rx = FAB.rx[dest.startsWith('EVSREC') ? 'REC' + dest.slice(6) : dest]; const f = src && FAB.flows['v:' + src];
    if (rx && !FAB.res.reg[rx.dev]) return `Récepteur « ${rx.label} » absent du registre NMOS (${(FAB.res.regWhy && FAB.res.regWhy[rx.dev]) || 'port de contrôle coupé ou mauvais VLAN'}) : le contrôleur ne le voit pas.`;
    if (f && FAB.res.reg[f.dev] === false) return `Émetteur « ${f.label} » absent du registre NMOS : le contrôleur ne connaît pas son SDP.`;
    // la connexion IS-05 remplace les paramètres de transport saisis à la main sur le récepteur
    if (rx && FAB.rxManual[rx.id]) setRxManual(rx.id, null);
  }
  if (ROUTER.guard) { const g = ROUTER.guard(dest); if (g) return g; }
  if (dest.startsWith('ME') && +dest.slice(2) > mixInputs()) return `Entrée ${dest.slice(2)} indisponible : en 4K, le ${EQUIP.mixer} n'a que ${mixInputs()} entrées dans cette configuration.`;
  if (dest.startsWith('REC')) { const err = routeRec(+dest.slice(3), src); if (!err) emit('router', { dest, src }); return err; }
  ROUTER.map[dest] = src;
  if (dest.startsWith('MV')) ROUTER.customMV = true;
  ROUTER.lastTake = { dest, src, t: S.time };
  emit('router', { dest, src });
  return null;
}

// ----------------------------------------------------------------------------------
// EVS
// ----------------------------------------------------------------------------------
export const EVS = {
  recording: true, recStopT: Infinity, recStart: {},
  // media : un média de l'émission chargé sur le canal (générique, pub : src/emission/) ; { id, pos, playing, by }
  ch: [0, 1].map((i) => ({ name: i ? 'B' : 'A', mode: 'live', cam: i ? 2 : 1, t: 0, speed: 0, lever: 0.5, playing: false, in: null, out: null, rt: null, lastTq: -1, ok: true, msg: '', pl: null, dirty: false, lastCam: null, media: /** @type {{ id: string, pos: number, playing: boolean, by: string } | null} */ (null) })),
  clips: [], playlist: [], fastJog: false, page: 1, lsmCh: 0, logs: [], browse: false,
};
// nom d'un clip façon Multicam : page · banque · touche · angle (ex. 111A)
export function clipName(idx) {
  const cl = EVS.clips[idx]; const page = Math.floor(idx / 10) + 1, key = (idx % 10) + 1;
  const rec = recordedCams(); const k = cl ? rec.indexOf(cl.cam) : -1;
  return `${page}1${key % 10}${k >= 0 ? 'ABCDEFGH'[k] : ''}`;
}
function syncRecStarts() {
  const recorded = recordedCams();
  for (const id of recorded) if (EVS.recStart[id] == null) EVS.recStart[id] = S.simTime;
  for (const id of Object.keys(EVS.recStart)) if (!recorded.includes(+id)) delete EVS.recStart[id];
}
// source réellement reçue par l'entrée d'enregistrement k (tient compte du brassage)
export function recSource(k) { return destFeed('EVSREC' + k, ROUTER); }
// source logique reçue par une destination de la grille (tient compte du brassage)
export function feedOf(dest) { return destFeed(dest, ROUTER); }
export function recordedCams() {
  const set = new Set();
  for (let i = 1; i <= evsLayout().rec; i++) { const s = recSource(i); if (s && s.startsWith('CAM') && camById(+s.slice(3)) && (!S.ipMode || delivery(s, 'REC' + i).ok)) set.add(+s.slice(3)); }
  return [...set].sort((a, b) => a - b);
}
export function canReplay(camId, t) {
  if (EVS.recStart[camId] == null) return 'Cette caméra n\'est pas enregistrée par l\'EVS (voir la grille, entrées REC).';
  if (t < EVS.recStart[camId]) return 'Pas d\'enregistrement à ce timecode pour cette caméra.';
  if (!EVS.recording && t > EVS.recStopT) return 'Enregistrement arrêté : rien après ' + tc(EVS.recStopT + S.tcOffset) + '.';
  const [t0] = recRange();
  if (t < t0) return 'Hors de la mémoire du serveur (boucle).';
  return null;
}
export function evsSetRecording(onoff) {
  EVS.recording = onoff;
  if (!onoff) EVS.recStopT = S.simTime; else EVS.recStopT = Infinity;
  emit('evs');
}
/** le canal de lecture qui diffuse les médias de l'émission : PGM2 (EVS B) s'il existe, sinon PGM1 (UHD) */
export const canalMedias = () => (evsLayout().plays > 1 ? 1 : 0);
export function evsAction(chIdx, action, arg) {
  const c = EVS.ch[chIdx];
  if (chIdx === 1 && evsLayout().plays < 2) { c.ok = false; c.msg = 'Pas de second canal de lecture dans cette configuration.'; emit('evs', { ch: chIdx, action: 'refused' }); return; }
  // les médias de l'émission (IPDirector) : charger (au début, en pause), lancer, arrêter, éjecter ;
  // by : qui l'a fait ('vous', 'ia' ou le pseudo d'un participant)
  if (action === 'media') { const m = MEDIAS[arg && arg.id ? arg.id : arg]; if (!m) return; c.media = { id: m.id, pos: 0, playing: false, by: (arg && arg.by) || 'vous' }; c.mode = 'pause'; c.playing = false; c.pl = null; emit('evs', { ch: chIdx, action }); return; }
  if (action === 'mediaplay') { if (!c.media) return; if (c.media.pos >= MEDIAS[c.media.id].duree - 0.05) c.media.pos = 0; c.media.playing = true; if (arg) c.media.by = arg; emit('evs', { ch: chIdx, action }); return; }
  if (action === 'mediastop') { if (c.media) c.media.playing = false; emit('evs', { ch: chIdx, action }); return; }
  if (action === 'mediarewind') { if (c.media) { c.media.pos = 0; c.media.playing = false; } emit('evs', { ch: chIdx, action }); return; }
  if (action === 'mediaeject') { if (c.media) { c.media = null; c.mode = 'live'; c.playing = false; } emit('evs', { ch: chIdx, action }); return; }
  // toute autre commande reprend le canal pour les ralentis : le média est éjecté
  if (c.media) { c.media = null; c.mode = 'live'; c.playing = false; }
  const now = S.simTime;
  const [t0] = recRange();
  const goPause = () => { if (c.mode === 'live') { c.t = now - 0.04; } c.mode = 'pause'; c.playing = false; };
  switch (action) {
    case 'live': c.mode = 'live'; c.playing = false; break;
    case 'markin': c.in = c.mode === 'live' ? now : c.t; break;
    case 'markout': c.out = c.mode === 'live' ? now : c.t; if (c.in != null && c.out < c.in) { const x = c.in; c.in = c.out; c.out = x; } break;
    case 'gotoin': if (c.in != null) { c.t = c.in; c.mode = 'pause'; c.playing = false; } break;
    case 'gotoout': if (c.out != null) { c.t = c.out; c.mode = 'pause'; c.playing = false; } break;
    case 'play': if (c.mode === 'live') goPause(); c.mode = 'play'; c.playing = true; c.speed = arg ?? 1; break;
    case 'playvar': if (c.mode === 'live') goPause(); c.mode = 'play'; c.playing = true; c.speed = c.lever; break;
    case 'pause': goPause(); c.speed = 0; break;
    case 'toggle': if (c.playing) { c.playing = false; c.mode = 'pause'; } else { if (c.mode === 'live') goPause(); c.mode = 'play'; c.playing = true; c.speed = c.lever; } break;
    case 'jog': goPause(); c.pl = null; c.t = clamp(c.t + arg * (EVS.fastJog ? 10 : 1) / 50, t0, now - 0.02); break;
    case 'lever': {
      c.lever = clamp(arg, 0, 1);
      if (c.playing) c.speed = c.lever;
      else if (c.mode === 'pause' && c.lever > 0.03 && !c.pl) { c.mode = 'play'; c.playing = true; c.speed = c.lever; } // comme sur un LSM : pousser le levier lance la lecture
      break;
    }
    case 'cam': c.cam = arg; break;
    case 'back': goPause(); c.t = clamp(c.t - arg, t0, now); break;
    case 'lastaction': {
      const ev = S.lastAction; if (!ev) break;
      goPause(); c.t = Math.max(t0, ev.t - 3.0); c.in = c.t; c.out = Math.min(now, ev.t + 2.5);
      break;
    }
    case 'save': { if (c.in != null) { const out = c.out ?? Math.min(now, c.in + 6); const old = EVS.clips[arg]; EVS.clips[arg] = { in: c.in, out, cam: c.cam, name: old ? old.name : '', kw: old ? old.kw : [], rating: old ? old.rating : 0, savedT: now }; } break; }
    case 'take': {
      // mode 2 PGM : échange le contenu des deux sorties
      const o = EVS.ch[1 - chIdx]; const keys = ['mode', 'cam', 't', 'speed', 'lever', 'playing', 'in', 'out', 'pl'];
      const tmp = {}; for (const k of keys) tmp[k] = c[k]; for (const k of keys) c[k] = o[k]; for (const k of keys) o[k] = tmp[k];
      c.dirty = o.dirty = true; break;
    }
    case 'return': goPause(); c.out = null; c.pl = null; break;
    case 'browse': {
      const idxs = EVS.clips.map((cl, i) => (cl ? i : -1)).filter((i) => i >= 0); if (!idxs.length) break;
      EVS.browseIdx = idxs[(Math.max(0, idxs.indexOf(EVS.browseIdx ?? idxs[0])) + (arg > 0 ? 1 : idxs.length - 1)) % idxs.length];
      const cl = EVS.clips[EVS.browseIdx]; c.in = cl.in; c.out = cl.out; c.cam = cl.cam; c.t = cl.in; c.mode = 'pause'; c.playing = false; c.pl = null; break;
    }
    case 'recall': { const cl = EVS.clips[arg]; if (cl) { c.in = cl.in; c.out = cl.out; c.cam = cl.cam; c.t = cl.in; c.mode = 'pause'; c.playing = false; c.pl = null; } break; }
    case 'plstadd': if (EVS.clips[arg]) EVS.playlist.push(arg); break;
    case 'plstclear': EVS.playlist = []; break;
    case 'plstplay': {
      if (!EVS.playlist.length) break;
      const cl = EVS.clips[EVS.playlist[0]];
      Object.assign(c, { cam: cl.cam, in: cl.in, out: cl.out, t: cl.in, mode: 'play', playing: true, speed: Math.max(0.25, c.lever), pl: { i: 0 } });
      break;
    }
  }
  emit('evs', { ch: chIdx, action });
}
function updateEVS(dt) {
  const now = S.simTime;
  for (const c of EVS.ch) {
    // média de l'émission : il avance au temps réel, puis s'arrête sur sa dernière image
    if (c.media) {
      if (c.media.playing) { const d = MEDIAS[c.media.id].duree; c.media.pos = Math.min(d, c.media.pos + dt); if (c.media.pos >= d) { c.media.playing = false; emit('evs', { action: 'mediaend', id: c.media.id }); } }
      continue;
    }
    if (c.mode === 'play' && c.playing) {
      c.t += dt * c.speed;
      if (c.out != null && c.t >= c.out && c.in != null && c.t - dt * c.speed < c.out) {
        if (c.pl && c.pl.i + 1 < EVS.playlist.length) {
          c.pl.i++; const cl = EVS.clips[EVS.playlist[c.pl.i]];
          if (cl) { c.cam = cl.cam; c.in = cl.in; c.out = cl.out; c.t = cl.in; emit('evs', { action: 'plnext' }); continue; }
        }
        c.t = c.out; c.playing = false; c.mode = 'pause'; c.pl = null; emit('evs', { action: 'end' });
      }
      if (c.t >= now - 0.02) { c.mode = 'live'; c.playing = false; }
    }
  }
}

// ----------------------------------------------------------------------------------
// Mélangeur
// ----------------------------------------------------------------------------------
export const MIX = {
  pgm: 1, pst: 2, trans: 'mix', wipe: 0, rate: 20, pos: 0, auto: false, tbar: 0, tbarDir: 1, tbarActive: false, snapStore: false,
  next: { bkgd: true, key1: false },
  key1: { on: false, src: 20, corner: 'tr', size: 0.32 },
  dsk1: { on: false, level: 0, auto: 0, rate: 12 },
  dsk2: { on: false, level: 0, auto: 0, rate: 12 },
  ftb: { on: false, level: 0, auto: 0 },
  lastTrans: null,
};
export const TRANS = { mix: 'MIX', wipe: 'WIPE', dip: 'DIP', dve: 'DME', stinger: 'CLIP' };
export const WIPES = ['Horizontal', 'Vertical', 'Diagonal', 'Iris (cercle)', 'Boîte', 'Horloge'];
const TYPE_N = { mix: 0, wipe: 1, dip: 2, dve: 3, stinger: 4 };

export function meSource(n) { return ROUTER.map['ME' + n]; }
export function mixSetPst(n) { MIX.pst = n; emit('mixer', { type: 'pst' }); }
export function mixSetPgm(n) { MIX.pgm = n; MIX.pos = 0; MIX.auto = false; emit('mixer', { type: 'pgm' }); S.stats.cuts++; S.lastCutT = S.time; }
export function mixCut() {
  if (MIX.auto) return;
  if (MIX.next.bkgd) { const p = MIX.pgm; MIX.pgm = MIX.pst; MIX.pst = p; }
  if (MIX.next.key1) MIX.key1.on = !MIX.key1.on;
  MIX.pos = 0; S.stats.cuts++; S.lastCutT = S.time;
  MIX.lastTrans = { type: 'cut', t: S.time, to: meSource(MIX.pgm) };
  emit('mixer', { type: 'cut', to: meSource(MIX.pgm) });
}
export function mixAuto() {
  if (MIX.auto) return;
  MIX.auto = true; MIX.autoFrom = MIX.pos;
  emit('mixer', { type: 'autostart' });
}
function completeTransition() {
  if (MIX.next.bkgd) { const p = MIX.pgm; MIX.pgm = MIX.pst; MIX.pst = p; }
  if (MIX.next.key1) MIX.key1.on = !MIX.key1.on;
  MIX.pos = 0; MIX.auto = false;
  S.stats[MIX.trans === 'stinger' ? 'stingers' : 'mixes']++;
  MIX.lastTrans = { type: MIX.trans, t: S.time, to: meSource(MIX.pgm) };
  emit('mixer', { type: 'transition', trans: MIX.trans, to: meSource(MIX.pgm) });
}
export function mixTbar(v) {
  // la barre T : le sens s'inverse après chaque transition complète
  MIX.tbar = v;
  const p = MIX.tbarDir > 0 ? v : 1 - v;
  if (MIX.auto) return;
  if (p >= 0.999) { completeTransition(); MIX.tbarDir *= -1; }
  else MIX.pos = p;
}
export function dskToggle(n, auto) {
  const d = n === 1 ? MIX.dsk1 : MIX.dsk2;
  if (auto) { d.auto = d.on ? -1 : 1; d.on = !d.on; }
  else { d.on = !d.on; d.level = d.on ? 1 : 0; d.auto = 0; }
  emit('mixer', { type: 'dsk', n, on: d.on });
}
export function ftbToggle() { MIX.ftb.on = !MIX.ftb.on; MIX.ftb.auto = MIX.ftb.on ? 1 : -1; emit('mixer', { type: 'ftb', on: MIX.ftb.on }); }
export function keyToggle(auto) {
  if (auto) { MIX.next.key1 = true; MIX.next.bkgd = false; mixAuto(); MIX._restoreNext = true; }
  else { MIX.key1.on = !MIX.key1.on; emit('mixer', { type: 'key' }); }
}
// cadence image du format en cours : les durées de transition se comptent en images
export const frameRate = () => (FORMATS[S.format] && FORMATS[S.format].fps) || 50;
export function updateMixer(dt) {
  if (MIX.auto) {
    const dur = MIX.trans === 'stinger' ? Math.max(MIX.rate, 30) : MIX.rate;
    MIX.pos += dt * frameRate() / Math.max(1, dur); // durée en images du format (25 en 1080i50, 50 en 1080p50 et UHD)
    if (MIX.pos >= 1) { completeTransition(); if (MIX._restoreNext) { MIX.next.key1 = false; MIX.next.bkgd = true; MIX._restoreNext = false; } }
  }
  for (const d of [MIX.dsk1, MIX.dsk2, MIX.ftb]) {
    if (d.auto) { d.level = clamp(d.level + d.auto * dt * frameRate() / (d.rate || 12), 0, 1); if (d.level <= 0 || d.level >= 1) d.auto = 0; }
    else if (d !== MIX.ftb) d.level = d.on ? 1 : 0;
  }
  // ralenti à l'antenne -> tag "RALENTI"
  const pgmSrc = meSource(MIX.pgm);
  GFX.replayOnAir = MIX.dsk1.on && (pgmSrc === 'EVSA' || pgmSrc === 'EVSB') && EVS.ch[pgmSrc === 'EVSA' ? 0 : 1].mode !== 'live' && !EVS.ch[pgmSrc === 'EVSA' ? 0 : 1].media;
}

const mixMat = new THREE.ShaderMaterial({
  uniforms: {
    tA: { value: null }, tB: { value: null }, tK: { value: null }, tD1: { value: null }, tD2: { value: null }, tLogo: { value: null },
    sA: { value: 1 }, sB: { value: 1 }, sK: { value: 1 },
    uPos: { value: 0 }, uType: { value: 0 }, uWipe: { value: 0 }, uSoft: { value: 0.04 }, uBg: { value: 1 },
    uKeyA: { value: 0 }, uKeyB: { value: 0 }, uKeyRect: { value: new THREE.Vector4(0.62, 0.6, 0.95, 0.93) },
    uD1: { value: 0 }, uD2: { value: 0 }, uFtb: { value: 0 }, uMode: { value: 0 }, uKeyPos: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tA, tB, tK, tD1, tD2, tLogo; uniform float sA, sB, sK, uPos, uSoft, uBg, uKeyA, uKeyB, uD1, uD2, uFtb, uKeyPos;
    uniform int uType, uWipe, uMode; uniform vec4 uKeyRect; varying vec2 vUv;
    float edge(vec2 uv){
      if (uWipe == 0) return uv.x;
      if (uWipe == 1) return 1.0 - uv.y;
      if (uWipe == 2) return (uv.x + 1.0 - uv.y) * 0.5;
      if (uWipe == 3) return length((uv - 0.5) * vec2(1.7778, 1.0)) / 1.02;
      if (uWipe == 4) return max(abs(uv.x - 0.5), abs(uv.y - 0.5)) * 2.0;
      return fract(atan(uv.x - 0.5, uv.y - 0.5) / 6.28318 + 0.5);
    }
    vec3 A(vec2 uv){ return texture2D(tA, uv).rgb * sA; }
    vec3 Bs(vec2 uv){ return texture2D(tB, uv).rgb * sB; }
    vec3 bg(vec2 uv, float p){
      if (uBg < 0.5 || p <= 0.0) return A(uv);
      if (uType == 0) return mix(A(uv), Bs(uv), p);
      if (uType == 1) { float e = edge(uv); float ps = p * (1.0 + uSoft); float m = 1.0 - smoothstep(ps - uSoft, ps, e);
        vec3 c = mix(A(uv), Bs(uv), m); float bd = 1.0 - smoothstep(0.0, 0.006, abs(e - (ps - uSoft*0.5)));
        return mix(c, vec3(0.9, 0.72, 0.15) / 1.1, bd * 0.85); }
      if (uType == 2) return p < 0.5 ? A(uv) * (1.0 - p * 2.0) : Bs(uv) * (p * 2.0 - 1.0);
      if (uType == 3) { if (uv.x < p) return Bs(vec2(uv.x - p + 1.0, uv.y)); return A(vec2(uv.x - p, uv.y)); }
      // volet logo
      vec3 c = p < 0.5 ? A(uv) : Bs(uv);
      float bp = mix(-0.7, 1.7, p);
      float d = uv.x + (uv.y - 0.5) * 0.4 - bp;
      float band = 1.0 - smoothstep(0.43, 0.46, abs(d));
      vec3 col = mix(vec3(0.06, 0.08, 0.12), vec3(1.0, 0.82, 0.25), smoothstep(0.33, 0.35, abs(d)));
      vec2 luv = vec2((uv.x - bp + (uv.y - 0.5) * 0.4) * 1.7778 / 0.62 + 0.5, (uv.y - 0.5) / 0.62 + 0.5);
      vec4 lg = texture2D(tLogo, clamp(luv, 0.0, 1.0)) * step(0.0, luv.x) * step(luv.x, 1.0) * step(0.0, luv.y) * step(luv.y, 1.0);
      col = mix(col, lg.rgb, lg.a);
      return mix(c, col / 1.1, band);
    }
    void main(){
      vec2 uv = vUv;
      float p = uMode == 2 ? 1.0 : uPos;
      vec3 c = uMode == 2 ? (uBg > 0.5 ? Bs(uv) : A(uv)) : bg(uv, p);
      float kv = uMode == 2 ? uKeyB : mix(uKeyA, uKeyB, uKeyPos);
      if (kv > 0.001 && uv.x > uKeyRect.x && uv.x < uKeyRect.z && uv.y > uKeyRect.y && uv.y < uKeyRect.w) {
        vec2 kuv = (uv - uKeyRect.xy) / (uKeyRect.zw - uKeyRect.xy);
        vec3 k = texture2D(tK, kuv).rgb * sK;
        float b = step(min(min(kuv.x, 1.0 - kuv.x) * 1.7778, min(kuv.y, 1.0 - kuv.y)), 0.012);
        k = mix(k, vec3(0.86), b);
        c = mix(c, k, kv);
      }
      if (uMode != 1) {
        vec4 d1 = texture2D(tD1, uv); c = mix(c, d1.rgb / 1.1, d1.a * uD1);
        vec4 d2 = texture2D(tD2, uv); c = mix(c, d2.rgb / 1.1, d2.a * uD2);
      }
      if (uMode == 0) c *= 1.0 - uFtb;
      gl_FragColor = vec4(c, 1.0);
    }`,
  depthTest: false, depthWrite: false,
});
const gfxFillMat = new THREE.ShaderMaterial({
  uniforms: { tD: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D tD; varying vec2 vUv; void main(){ vec4 d = texture2D(tD, vUv); gl_FragColor = vec4(d.rgb * d.a / 1.1, 1.0); }`,
  depthTest: false, depthWrite: false,
});
const copyMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, uGain: { value: 1 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D map; uniform float uGain; varying vec2 vUv; void main(){ gl_FragColor = vec4(clamp(texture2D(map, vUv).rgb * uGain, 0.0, 1.0), 1.0); }`,
  depthTest: false, depthWrite: false,
});
const fsScene = new THREE.Scene(); const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mixMat); fsQuad.frustumCulled = false; fsScene.add(fsQuad);
const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
function blit(renderer, mat, target) { fsQuad.material = mat; renderer.setRenderTarget(target); renderer.render(fsScene, fsCam); }

// ----------------------------------------------------------------------------------
// Résolution d'une source vers une texture
// ----------------------------------------------------------------------------------
export const P = { rts: {}, delay: { rts: [], times: [], idx: 0, n: 44, k: 0, delay: 1.35 }, mvDirty: true };
// car IP : ce que reçoit réellement le récepteur « dest » (réseaux rouge + bleu, ST 2022-7)
function ipWhy(r = '') {
  return /filtre de source/.test(r) ? 'Mauvaise adresse source (SSM)' : /aucun émetteur n'envoie/.test(r) ? 'Aucun émetteur sur ce groupe' : /port UDP/.test(r) ? 'Mauvais port UDP' : /non multicast|pas une adresse multicast/.test(r) ? 'Adresse non multicast' : /aucun groupe|adresse source absente|désactivée|aucune adresse IP/.test(r) ? 'Paramètres incomplets' : /SDN/.test(r) ? 'Refusé par le contrôleur SDN' : /querier|expirée/.test(r) ? 'Abonnement IGMP expiré' : /SSM/.test(r) ? 'Groupe hors plage SSM' : /IGMPv2/.test(r) ? 'IGMPv2 : jonction (S,G) refusée' : /VLAN/.test(r) ? 'Erreur de VLAN' : /conflit/i.test(r) ? 'Conflit d\'adresse IP' : /FEC|vitesse|shutdown|hors tension|non raccordé|pas de carte/.test(r) ? 'Lien réseau coupé' : /PIM|OSPF|spine|RPF|multicast/.test(r) ? 'Routage multicast' : /MTU/.test(r) ? 'MTU trop petite' : /passerelle|adresse/.test(r) ? 'Erreur d\'adressage IP' : 'Voir le poste Réseau IP';
}
const LOSS_TEX = [];
function lossTex(k) {
  if (LOSS_TEX[k]) return LOSS_TEX[k];
  const c = makeCanvas(480, 270); const g = c.getContext('2d');
  g.fillStyle = '#101214'; g.fillRect(0, 0, 480, 270);
  let seed = 17 + k * 101; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let y = 0; y < 270; y += 3) if (rnd() < 0.55) { g.fillStyle = `hsl(${rnd() * 360},${30 + rnd() * 40}%,${20 + rnd() * 45}%)`; const x = rnd() * 400; g.fillRect(x, y, 40 + rnd() * 300, 2 + Math.floor(rnd() * 3)); }
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(70, 112, 340, 46);
  g.fillStyle = '#ffb020'; g.font = `700 28px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('PERTES DE PAQUETS', 240, 135);
  return (LOSS_TEX[k] = canvasTex(c));
}
export function resolve(id, depth = 0, direct = false, dest = null) {
  if (!id) return { tex: TEX.black, scale: SC, alarm: '' };
  if (S.ipMode && depth === 0 && !direct && !netOk()) return { tex: noSignalTex('PERTE RÉSEAU', 'Réseaux rouge et bleu coupés'), scale: SC, alarm: 'NO FLOW' };
  if (S.ipMode && depth === 0 && dest) {
    const d = delivery(id, dest);
    if (!d.ok) return { tex: noSignalTex(d.reason && /SDN/.test(d.reason) ? 'FLUX REFUSÉ' : 'FLUX PERDU', ipWhy(d.reason)), scale: SC, alarm: 'NO FLOW', none: true };
    // récepteur réglé à la main sur un autre émetteur : il montre ce qu'il reçoit vraiment
    if (d.src && d.src !== id) id = d.src;
    if (d.loss > 0.001) {
      const r = resolve(id, depth, direct);
      if (Math.random() < Math.min(0.85, 0.15 + d.loss)) return { tex: lossTex(S.frame % 3), scale: SC, alarm: 'PERTES IP', cam: r.cam };
      return { ...r, alarm: 'PERTES IP' };
    }
  }
  // exercice de brassage : ce qui arrive réellement sur l'entrée de grille de cette source
  if (S.patch.on && depth === 0 && !direct) {
    const n = routerInOf(id);
    if (n != null) {
      const phys = S.patch.inputs[n];
      if (!phys) return { tex: noSignalTex('ENTRÉE VIDE', `Grille IN ${n} non brassée`), scale: SC, alarm: 'NO SIG', none: true };
      const lg = physToLogical(phys);
      if (lg === 'GFXK') return { tex: noSignalTex('SIGNAL DE DÉCOUPE', 'GFX KEY brassé sur IN ' + n), scale: SC, alarm: 'KEY ?' };
      if (lg !== id) { const r = resolve(lg, 1); return { ...r, alarm: r.alarm || 'SOURCE ?' }; }
    }
  }
  if (id.startsWith('CAM')) {
    const n = +id.slice(3); const c = camById(n);
    if (!c) return { tex: noSignalTex('PAS DE SIGNAL', `CCU ${n} non câblée`), scale: SC, alarm: 'NO SIG', none: true };
    if (!c.status.ok) return { tex: noSignalTex('PAS DE SIGNAL', c.status.power ? 'Liaison coupée' : 'Caméra non alimentée'), scale: SC, alarm: 'PAS DE SIGNAL' };
    if (c.paint.bars) return { tex: camBarsTex(n), scale: SC, alarm: 'BARRES', cam: c };
    if (c.rf && c.rf.state === 'lost') {
      if (c.rf.lostT < 1.5) return { tex: c.outRT.texture, scale: 1, alarm: 'IMAGE FIGÉE', cam: c };
      return { tex: noSignalTex('PERTE HF', 'Récepteur déverrouillé'), scale: SC, alarm: 'PERTE HF' };
    }
    return { tex: c.outRT.texture, scale: 1, cam: c, alarm: c.genlock ? '' : 'RÉF.' };
  }
  switch (id) {
    case 'EVSA': case 'EVSB': {
      const ch = EVS.ch[id === 'EVSA' ? 0 : 1];
      if (id === 'EVSB' && evsLayout().plays < 2) return { tex: noSignalTex('EVS B · PAS DE CANAL', 'Un seul canal de lecture en UHD'), scale: SC, alarm: 'NO SIG' };
      if (ch.media) return { tex: textureMedia(id === 'EVSA' ? 0 : 1, ch.media), scale: SC, alarm: '' };
      if (ch.mode === 'live') { const r = resolve('CAM' + ch.cam, depth + 1); return { ...r, alarm: r.alarm }; }
      if (!ch.ok) return { tex: noSignalTex('EVS ' + ch.name, ch.msg.slice(0, 40)), scale: SC, alarm: '' };
      return { tex: ch.rt.texture, scale: 1, alarm: '' };
    }
    case 'GFX': return { tex: P.rts.gfx.texture, scale: 1 };
    case 'GFXK': return { tex: noSignalTex('GFX KEY', 'Signal de découpe de l\'habillage'), scale: SC };
    case 'STUDIO': return { tex: TEX.studio, scale: SC };
    case 'BARS': return { tex: TEX.bars, scale: SC, alarm: 'MIRE' };
    case 'BLACK': return { tex: TEX.black, scale: SC };
    case 'PGM': return { tex: P.rts.pgm.texture, scale: 1, out: true };
    case 'CLEAN': return { tex: P.rts.clean.texture, scale: 1, out: true };
    case 'PVW': return { tex: P.rts.pvw.texture, scale: 1, out: true };
    case 'RETANT': {
      if (S.faults.tx && S.txPath === 1) return { tex: noSignalTex('PERTE RETOUR', 'Liaison TX1 coupée'), scale: SC, alarm: 'PERTE' };
      const r = retTexture(); return { tex: r || TEX.black, scale: 1 };
    }
  }
  // Videohub du car SDI : entrée sans source du simulateur (copie SDR d'une caméra en UHD, sinon rien de câblé)
  if (/^VH\d+$/.test(id)) {
    const n = +id.slice(2), k = n - 32;
    if (S.format === 'UHD' && k >= 1 && k <= 8 && camById(k)) return resolve('CAM' + k, depth + 1);
    return { tex: noSignalTex('PAS DE SIGNAL', `Grille IN ${n} : rien n'est câblé`), scale: SC, alarm: 'NO SIG', none: true };
  }
  return { tex: TEX.black, scale: SC };
}
function retTexture() {
  const D = P.delay; let best = null, bt = -1;
  const target = S.time - D.delay;
  for (let i = 0; i < D.rts.length; i++) { const t = D.times[i]; if (t != null && t <= target && t > bt) { bt = t; best = D.rts[i]; } }
  return best ? best.texture : null;
}

// ----------------------------------------------------------------------------------
// Multiview
// ----------------------------------------------------------------------------------
const MV = { scene: new THREE.Scene(), cam: null, tiles: [], overlay: null, dyn: null, w: 1920, h: 1080, lastDraw: 0, lastKey: '', lastRender: 0 };
function tileMat() {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: null }, uGain: { value: 1.1 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform float uGain; varying vec2 vUv; void main(){ gl_FragColor = vec4(clamp(texture2D(map, vUv).rgb * uGain, 0.0, 1.0), 1.0); }`,
    depthTest: false, depthWrite: false,
  });
}
function initMV() {
  MV.cam = new THREE.OrthographicCamera(0, MV.w, MV.h, 0, -10, 10);
  const add = (x, y, w, h, role) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), tileMat());
    m.position.set(x + w / 2, MV.h - y - h / 2, 0); m.renderOrder = 0; MV.scene.add(m);
    MV.tiles.push({ x, y, w, h, role, mesh: m });
  };
  add(0, 0, 960, 540, 'PVW'); add(960, 0, 960, 540, 'PGM');
  for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) add(c * 320 + 2, 540 + r * 180 + 2, 316, 176, 'MV' + (r * 6 + c + 1));
  const oc = makeCanvas(1920, 1080); MV.overlay = { canvas: oc, ctx: oc.getContext('2d'), tex: canvasTex(oc) };
  const om = new THREE.Mesh(new THREE.PlaneGeometry(MV.w, MV.h), new THREE.MeshBasicMaterial({ map: MV.overlay.tex, transparent: true, depthTest: false, toneMapped: false }));
  om.position.set(MV.w / 2, MV.h / 2, 1); om.renderOrder = 5; MV.scene.add(om);
  const dc = makeCanvas(64, 512); MV.dyn = { canvas: dc, ctx: dc.getContext('2d'), tex: canvasTex(dc) };
  const dm = new THREE.Mesh(new THREE.PlaneGeometry(36, 460), new THREE.MeshBasicMaterial({ map: MV.dyn.tex, transparent: true, depthTest: false, toneMapped: false }));
  dm.position.set(MV.w - 30, MV.h - 30 - 230, 2); dm.renderOrder = 6; MV.scene.add(dm);
}

export function tallyOf(src) {
  // 2 = à l'antenne (rouge), 1 = preset (vert)
  const pgm = meSource(MIX.pgm), pst = meSource(MIX.pst);
  const keySrc = meSource(MIX.key1.src);
  let t = 0;
  if (src === pst) t = 1;
  if (src === pgm) t = 2;
  if ((MIX.auto || MIX.pos > 0) && src === pst && MIX.next.bkgd) t = 2;
  if (MIX.key1.on && src === keySrc) t = 2;
  return t;
}

// récepteur du multiviewer correspondant à une tuile
const mvDest = (role) => (role === 'PGM' ? 'MVPGM' : role === 'PVW' ? 'MVPVW' : role);
function drawOverlay() {
  const g = MV.overlay.ctx; const W_ = MV.w;
  g.clearRect(0, 0, W_, MV.h);
  g.textBaseline = 'middle';
  for (const t of MV.tiles) {
    let src, label;
    if (t.role === 'PGM') { src = meSource(MIX.pgm); label = 'PGM · ' + sourceLabel(src); }
    else if (t.role === 'PVW') { src = meSource(MIX.pst); label = 'PVW · ' + sourceLabel(src); }
    else { src = ROUTER.map[t.role]; label = sourceLabel(src); }
    const r = resolve(src, 0, t.role === 'PGM' || t.role === 'PVW', mvDest(t.role));
    const tal = t.role === 'PGM' ? 2 : t.role === 'PVW' ? 1 : tallyOf(src);
    const big = t.w > 500;
    // bordure
    g.lineWidth = tal ? (big ? 8 : 5) : 2;
    g.strokeStyle = tal === 2 ? '#ff2a2a' : tal === 1 ? '#25d55a' : '#2b3036';
    g.strokeRect(t.x + g.lineWidth / 2, t.y + g.lineWidth / 2, t.w - g.lineWidth, t.h - g.lineWidth);
    // UMD
    const uh = big ? 40 : 26;
    g.fillStyle = 'rgba(0,0,0,0.72)'; g.fillRect(t.x + 8, t.y + t.h - uh - 8, t.w - 16, uh);
    g.fillStyle = tal === 2 ? '#ff2a2a' : tal === 1 ? '#25d55a' : '#2b3036'; g.fillRect(t.x + 8, t.y + t.h - uh - 8, big ? 14 : 9, uh);
    g.fillStyle = '#f2f5f7'; g.font = `600 ${big ? 26 : 19}px ${FONT}`; g.textAlign = 'center';
    let extra = '';
    if (r.cam) extra = '  ' + r.cam.descr();
    if (src === 'EVSA' || src === 'EVSB') {
      const ch = EVS.ch[src === 'EVSA' ? 0 : 1];
      extra = ch.media ? `  ${ch.media.playing ? '▶' : '❚❚'} ${MEDIAS[ch.media.id].titre} −${Math.ceil(MEDIAS[ch.media.id].duree - ch.media.pos)} s` : ch.mode === 'live' ? `  E/E CAM ${ch.cam}` : `  ${ch.playing ? '▶ ' + Math.round(ch.speed * 100) + ' %' : '❚❚'} CAM ${ch.cam}`;
    }
    g.fillText(label + (big ? extra : ''), t.x + t.w / 2, t.y + t.h - uh / 2 - 8, t.w - 44); // jamais plus large que l'UMD
    if (!big && extra) { g.font = `500 14px ${FONT}`; g.fillStyle = '#aab4bd'; g.fillText(extra.trim(), t.x + t.w / 2, t.y + 16, t.w - 24); }
    // alarmes
    if (r.alarm && r.alarm !== 'MIRE' && r.alarm !== 'BARRES') {
      g.fillStyle = 'rgba(220,30,30,0.9)'; const aw = big ? 260 : 150; g.fillRect(t.x + t.w - aw - 10, t.y + 10, aw, big ? 36 : 24);
      g.fillStyle = '#fff'; g.font = `700 ${big ? 24 : 16}px ${FONT}`; g.fillText(r.alarm, t.x + t.w - aw / 2 - 10, t.y + (big ? 28 : 22), aw - 12);
    }
    if (t.role === 'PVW') {
      g.setLineDash([10, 10]); g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5;
      g.strokeRect(t.x + t.w * 0.05, t.y + t.h * 0.05, t.w * 0.9, t.h * 0.9); g.setLineDash([]);
    }
    if (t.role === 'PGM' && MIX.ftb.level > 0.5) { g.fillStyle = 'rgba(220,30,30,0.9)'; g.fillRect(t.x + 20, t.y + 20, 110, 34); g.fillStyle = '#fff'; g.font = `700 22px ${FONT}`; g.fillText('FTB', t.x + 75, t.y + 38); }
  }
  // horloge et timecode
  const tod = S.tcOffset + S.simTime;
  g.fillStyle = 'rgba(0,0,0,0.85)'; roundRect(g, 960 - 170, 540 - 80, 340, 64, 6); g.fill();
  g.strokeStyle = '#3a4048'; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#ffd23f'; g.font = `600 34px ${MONO}`; g.textAlign = 'center'; g.fillText(tc(tod), 960, 540 - 48);
  g.fillStyle = '#9aa4ad'; g.font = `500 16px ${FONT}`; g.fillText(`TC · ${S.format === 'UHD' ? '2160p50 HDR' : S.format === 'HD' ? '1080p50' : '1080i50'} · ${S.ipMode ? 'ST 2110 · PTP ' + (ptpLocked() ? (NET.gmActive === 2 ? 'GM2' : 'GM1') : NET.rogue ? 'NON TRAÇABLE' : 'PERDU') + (NET.redState === 'ok' && NET.blueState === 'ok' ? '' : ' · 2022-7 DÉGRADÉ') : 'RÉF. GPS ' + (S.faults.gps ? 'HOLDOVER' : 'OK')}`, 960, 540 - 22);
  MV.overlay.tex.needsUpdate = true;
}
function drawDyn() {
  const g = MV.dyn.ctx; g.clearRect(0, 0, 64, 512);
  const lv = S.audioLevels || { l: -60, r: -60 };
  const bar = (x, db) => {
    const h = clamp((db + 60) / 60, 0, 1) * 500;
    g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillRect(x, 6, 24, 500);
    const gr = g.createLinearGradient(0, 506, 0, 6); gr.addColorStop(0, '#20c040'); gr.addColorStop(0.7, '#e0e020'); gr.addColorStop(0.85, '#ff3030');
    g.fillStyle = gr; g.fillRect(x + 3, 506 - h, 18, h);
    g.fillStyle = '#ffffff'; g.fillRect(x, 506 - (42 / 60) * 500, 24, 2); // -18 dBFS
  };
  bar(4, lv.l); bar(34, lv.r);
  MV.dyn.tex.needsUpdate = true;
}

// ----------------------------------------------------------------------------------
// Mesures : mesureur d'exposition et oscilloscope
// ----------------------------------------------------------------------------------
const meterMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, uOff: { value: new THREE.Vector2() } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D map; varying vec2 vUv;
    void main(){ vec2 cell = vec2(1.0/8.0, 1.0/4.0); vec2 base = floor(vUv / cell) * cell; float s = 0.0; float mx = 0.0;
      for (int i = 0; i < 5; i++) for (int j = 0; j < 5; j++) { vec2 u = base + cell * (vec2(float(i), float(j)) + 0.5) / 5.0;
        vec3 c = texture2D(map, u).rgb * 1.1; float y = dot(c, vec3(0.2126,0.7152,0.0722)); s += y; mx = max(mx, y); }
      gl_FragColor = vec4(s / 25.0 / 1.2, mx / 1.2, 0.0, 1.0); }`,
  depthTest: false, depthWrite: false,
});
export const SCOPE = { src: 'CAM1', w: 192, h: 108, buf: null, rt: null, last: 0, canvas: null, tex: null, mode: 'luma', active: false, data: null, reader: null, req: null };
const METER = { rt: null, buf: null, last: 0, reader: null, req: null };

function updateMeters(renderer) {
  // résultat de la mesure précédente, lu sans attendre la carte graphique
  if (METER.req && METER.reader.poll(METER.buf)) { applyMeters(METER.req); METER.req = null; }
  if (S.time - METER.last < 0.25 || METER.req) return;
  METER.last = S.time;
  const rt = METER.rt;
  for (const c of S.cams) {
    if (!c.signalOK || c.paint.bars) continue;
    rt.viewport.set((c.id - 1) * 8, 0, 8, 4); rt.scissor.set((c.id - 1) * 8, 0, 8, 4); rt.scissorTest = true;
    meterMat.uniforms.map.value = c.outRT.texture;
    blit(renderer, meterMat, rt);
  }
  rt.viewport.set(0, 0, 128, 4); rt.scissorTest = false;
  // caméras mesurées et heure de l'image mesurée de chacune (pour le line-up)
  const req = { t: S.time, rendered: new Map(S.cams.map((c) => [c.id, c.lastRender])) };
  METER.reader ||= makeReader(renderer, 128, 4);
  if (METER.reader.request(rt)) METER.req = req;
}
function applyMeters(req) {
  for (const c of S.cams) {
    const rendered = req.rendered.get(c.id);
    if (rendered === undefined) continue; // caméra posée depuis la mesure
    let s = 0, mx = 0;
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { const k = (y * 128 + (c.id - 1) * 8 + x) * 4; s += METER.buf[k]; mx = Math.max(mx, METER.buf[k + 1]); }
    c.meter.mean = s / 32 / 255 * 1.2; c.meter.peak = mx / 255 * 1.2; c.meter.t = req.t;
    // line-up en cours : l'iris est affiné tant que la mesure n'est pas dans la cible (sur une image prise après le dernier réglage)
    if (c.lineup && c.signalOK && rendered > (c.lineup.t || 0)) { lineupStep(c); if (c.lineup) c.lineup.t = S.time; }
    // iris automatique
    if (c.paint.autoIris && c.signalOK) {
      const target = 0.42; const ratio = c.meter.mean / target;
      if (ratio > 0.01) {
        let n = c.paint.iris * Math.pow(ratio, 0.25);
        c.paint.iris = clamp(n, 1.4, 22);
      }
    }
  }
}

function updateScope(renderer) {
  // image demandée à la mesure précédente : waveform et vecteurscope dessinés quand elle arrive
  if (SCOPE.req && SCOPE.reader.poll(SCOPE.buf)) {
    SCOPE.data = SCOPE.buf;
    drawScopes(SCOPE.canvas.getContext('2d'), 512, 288, SCOPE.buf, SCOPE.mode, SCOPE.req.title);
    SCOPE.tex.needsUpdate = true;
    SCOPE.req = null;
    emit('scope');
  }
  const interval = SCOPE.active ? 0.12 : 0.5;
  if (S.time - SCOPE.last < interval || SCOPE.req) return;
  SCOPE.last = S.time;
  const r = SCOPE.hdr && S.hdrView ? { tex: P.rts.hdr.texture, scale: 1 } : resolve(SCOPE.src);
  copyMat.uniforms.map.value = r.tex; copyMat.uniforms.uGain.value = r.scale; // reste dans le domaine stocké (/1.1)
  blit(renderer, copyMat, SCOPE.rt);
  SCOPE.reader ||= makeReader(renderer, SCOPE.w, SCOPE.h);
  if (SCOPE.reader.request(SCOPE.rt)) SCOPE.req = { title: sourceLabel(SCOPE.src) + (SCOPE.hdr && S.hdrView ? ' · HLG' : '') };
}

// Dessin du waveform + vecteurscope dans un contexte 2D
export function drawScopes(g, w, h, buf, mode = 'luma', title = '') {
  const half = Math.round(w * 0.6);
  g.fillStyle = '#05080a'; g.fillRect(0, 0, w, h);
  if (!buf) return;
  // --- waveform ---
  const pad = 26; const ww = half - pad - 6, wh = h - 28;
  const yOf = (v) => 8 + wh * (1 - (v + 0.05) / 1.16);
  const img = g.createImageData(ww, wh); const d = img.data;
  const SW = SCOPE.w, SH = SCOPE.h;
  const plot = (px, v, r, gg, b) => {
    const y = Math.round(yOf(v) - 8); if (y < 0 || y >= wh) return;
    const k = (y * ww + px) * 4; d[k] = Math.min(255, d[k] + r); d[k + 1] = Math.min(255, d[k + 1] + gg); d[k + 2] = Math.min(255, d[k + 2] + b); d[k + 3] = 255;
  };
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
    const k = (y * SW + x) * 4;
    const R = buf[k] / 255 * 1.1, G = buf[k + 1] / 255 * 1.1, B = buf[k + 2] / 255 * 1.1;
    if (mode === 'parade') {
      const pw = ww / 3;
      plot(Math.floor(x / SW * pw), R, 90, 18, 18); plot(Math.floor(pw + x / SW * pw), G, 18, 90, 18); plot(Math.floor(2 * pw + x / SW * pw), B, 30, 40, 110);
    } else {
      const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      plot(Math.floor(x / SW * ww), Y, 40, 110, 50);
    }
  }
  g.putImageData(img, pad, 8);
  g.strokeStyle = 'rgba(255,200,60,0.35)'; g.fillStyle = '#c8a040'; g.font = `500 11px ${MONO}`; g.lineWidth = 1; g.textAlign = 'right';
  for (const v of [0, 0.25, 0.5, 0.75, 1.0]) { const y = yOf(v); g.beginPath(); g.moveTo(pad, y); g.lineTo(pad + ww, y); g.stroke(); g.fillText(String(Math.round(v * 100)), pad - 3, y + 4); }
  g.strokeStyle = 'rgba(255,80,80,0.6)'; const y109 = yOf(1.09); g.setLineDash([4, 4]); g.beginPath(); g.moveTo(pad, y109); g.lineTo(pad + ww, y109); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#ff7070'; g.fillText('109', pad - 3, y109 + 4);
  if (SCOPE.hdr && S.hdrView) { const y75 = yOf(0.75); g.strokeStyle = 'rgba(70,198,242,0.8)'; g.setLineDash([6, 4]); g.beginPath(); g.moveTo(pad, y75); g.lineTo(pad + ww, y75); g.stroke(); g.setLineDash([]); g.fillStyle = '#46c6f2'; g.textAlign = 'left'; g.fillText('blanc réf. HLG 75 %', pad + 4, y75 - 4); g.textAlign = 'right'; }
  g.textAlign = 'left'; g.fillStyle = '#9aa4ad'; g.font = `500 12px ${FONT}`;
  g.fillText(mode === 'parade' ? 'PARADE R G B (%)' : 'WAVEFORM LUMINANCE (%)', pad, h - 8);
  if (title) { g.textAlign = 'right'; g.fillStyle = '#ffd23f'; g.fillText(title, pad + ww, h - 8); }
  // --- vecteurscope ---
  const vs = Math.min(w - half - 10, h - 20); const cx = half + 4 + vs / 2, cy = h / 2; const rad = vs / 2 - 4;
  g.strokeStyle = 'rgba(255,200,60,0.35)'; g.beginPath(); g.arc(cx, cy, rad, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(cx - rad, cy); g.lineTo(cx + rad, cy); g.moveTo(cx, cy - rad); g.lineTo(cx, cy + rad); g.stroke();
  const scl = rad / 0.62;
  const vec = (R, G, B) => { const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B; return [(B - Y) / 1.8556, (R - Y) / 1.5748]; };
  const targets = [['R', 0.75, 0, 0], ['Mg', 0.75, 0, 0.75], ['B', 0, 0, 0.75], ['Cy', 0, 0.75, 0.75], ['G', 0, 0.75, 0], ['Yl', 0.75, 0.75, 0]];
  g.font = `500 11px ${FONT}`; g.textAlign = 'center';
  for (const [n, R, G, B] of targets) { const [cb, cr] = vec(R, G, B); const x = cx + cb * scl, y = cy - cr * scl; g.strokeRect(x - 6, y - 6, 12, 12); g.fillStyle = '#c8a040'; g.fillText(n, x, y - 10); }
  // ligne des tons chair
  g.strokeStyle = 'rgba(255,200,60,0.25)'; g.beginPath(); g.moveTo(cx, cy); const sk = vec(0.8, 0.6, 0.45); const sl = Math.hypot(sk[0], sk[1]); g.lineTo(cx + sk[0] / sl * rad, cy - sk[1] / sl * rad); g.stroke();
  const vimg = g.getImageData(Math.floor(cx - rad), Math.floor(cy - rad), Math.ceil(rad * 2), Math.ceil(rad * 2)); const vd = vimg.data; const vw = vimg.width;
  for (let i = 0; i < SW * SH; i += 1) {
    const k = i * 4; const R = buf[k] / 255 * 1.1, G = buf[k + 1] / 255 * 1.1, B = buf[k + 2] / 255 * 1.1;
    const [cb, cr] = vec(R, G, B);
    const x = Math.round(rad + cb * scl), y = Math.round(rad - cr * scl);
    if (x < 0 || y < 0 || x >= vw || y >= vimg.height) continue;
    const q = (y * vw + x) * 4; vd[q] = Math.min(255, vd[q] + 25); vd[q + 1] = Math.min(255, vd[q + 1] + 70); vd[q + 2] = Math.min(255, vd[q + 2] + 30); vd[q + 3] = 255;
  }
  g.putImageData(vimg, Math.floor(cx - rad), Math.floor(cy - rad));
  g.fillStyle = '#9aa4ad'; g.font = `500 12px ${FONT}`; g.textAlign = 'center'; g.fillText('VECTEURSCOPE', cx, h - 4);
}

// ----------------------------------------------------------------------------------
// Initialisation et rendu par image
// ----------------------------------------------------------------------------------
export function initPipeline() {
  initTextures();
  const mk = (w, h) => new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: false });
  P.rts.pgm = mk(960, 540); P.rts.clean = mk(960, 540); P.rts.pvw = mk(960, 540); P.rts.gfx = mk(960, 540);
  const mvw = S.quality === 'basse' ? 1280 : 1920;
  P.rts.mv = mk(mvw, Math.round(mvw * 9 / 16));
  { const [hw, hh] = rtSize(); P.rts.hdr = mk(hw, hh); }
  const [w, h] = rtSize();
  for (const c of EVS.ch) c.rt = mk(w, h);
  for (let i = 0; i < P.delay.n; i++) { P.delay.rts.push(mk(320, 180)); P.delay.times.push(null); }
  SCOPE.rt = mk(SCOPE.w, SCOPE.h); SCOPE.buf = new Uint8Array(SCOPE.w * SCOPE.h * 4);
  SCOPE.canvas = makeCanvas(512, 288); SCOPE.tex = canvasTex(SCOPE.canvas);
  METER.rt = mk(128, 4); METER.buf = new Uint8Array(128 * 4 * 4);
  initMV();
  defaultRouting(true);
  on('cams', () => { defaultRouting(false); P.mvDirty = true; });
  on('router', () => { P.mvDirty = true; syncRecStarts(); });
  on('mixer', () => { P.mvDirty = true; });
  on('evs', () => { P.mvDirty = true; });
  // écrans du car
  const sc = TR.screens;
  sc.mv.uniforms.uGain.value = 1; sc.mv2.uniforms.uGain.value = 1; sc.audioMv.uniforms.uGain.value = 1;
  sc.scope.uniforms.uGain.value = 1; sc.scope.uniforms.map.value = SCOPE.tex;
  sc.hfspec.uniforms.uGain.value = 1;
}

let camCursor = 0;
// le multiview (et ses vignettes) n'est visible que dans le car, à un poste ou sur le plan des caméras
export const mvWatched = () => S.inTruck || S.mode === 'station' || S.mode === 'plan';
function scheduleCams(mvSeen) {
  // caméras prioritaires : PGM, PST, clé, poste ouvert, opérateur
  const pri = new Set();
  const srcs = [meSource(MIX.pgm), meSource(MIX.pst), MIX.key1.on ? meSource(MIX.key1.src) : null, ROUTER.map.AUX_VISION, SCOPE.src, ROUTER.map.AUX_GIANT];
  for (const s of srcs) if (s && s.startsWith('CAM')) pri.add(+s.slice(3));
  for (const ch of EVS.ch) if (ch.mode === 'live') { const s = ch.cam; if (meSource(MIX.pgm) === (ch.name === 'A' ? 'EVSA' : 'EVSB') || meSource(MIX.pst) === (ch.name === 'A' ? 'EVSA' : 'EVSB')) pri.add(s); }
  if (S.camop) pri.add(S.camop.id);
  if (S.selCam) pri.add(S.selCam);
  // les autres tournent, quelques-unes par image, pour les vignettes du multiview et les mesures
  // d'exposition ; quand personne ne regarde le multiview, une seule suffit aux mesures
  const budget = !mvSeen ? 1 : S.lite ? 2 : S.quality === 'haute' ? 12 : S.quality === 'basse' ? 3 : 6;
  const list = [];
  for (const c of S.cams) if (pri.has(c.id)) list.push(c);
  const others = S.cams.filter((c) => !pri.has(c.id));
  for (let k = 0; k < Math.min(budget, others.length); k++) { list.push(others[(camCursor + k) % others.length]); }
  camCursor = (camCursor + budget) % Math.max(1, others.length);
  return list;
}

const SNAPBUF = new Float32Array(SNAP.size);
export function renderPipeline(renderer, dt) {
  updateMixer(dt);
  updateEVS(dt);
  const scene = W.scene;
  for (const m of W.screens) m.uniforms.uLin.value = 1;
  // écran géant
  const giant = resolve(feedOf('GIANT'), 0, false, 'AUX_GIANT');
  W.giantScreen.material.uniforms.map.value = giant.tex; W.giantScreen.material.uniforms.uGain.value = 1.1 * giant.scale;
  captureLive(S.cams);
  applySnapshot(LIVE);
  let tp = pt(); // profileur (?perf)
  const mvSeen = mvWatched();
  // --- caméras ---
  const list = scheduleCams(mvSeen);
  const delayed = [];
  for (const c of list) {
    if (!c.status.ok) continue;
    if (c.rf) { if (c.rf.state === 'lost') continue; delayed.push(c); continue; }
    c.render(renderer, scene);
  }
  let restored = true;
  for (const c of delayed) {
    // latence de la liaison HF : l'image affichée a quelques images de retard
    const t = S.simTime - c.rf.latencyS;
    if (sampleRec(t, SNAPBUF)) { applySnapshot(SNAPBUF); restored = false; }
    c.render(renderer, scene);
  }
  tp = pe('· caméras', tp);
  // --- EVS ---
  for (const ch of EVS.ch) {
    if (ch.mode === 'live' || ch.media) { ch.ok = true; continue; }
    const cam = camById(ch.cam);
    if (!cam) { ch.ok = false; ch.msg = 'Caméra absente'; continue; }
    const fps = 50 * cam.hfr;
    const tq = Math.floor(ch.t * fps + 1e-6) / fps;
    const err = canReplay(cam.id, tq);
    if (err) { ch.ok = false; ch.msg = err; continue; }
    ch.ok = true; ch.msg = '';
    if (tq === ch.lastTq && ch.lastCam === cam.id && !ch.dirty) continue;
    if (!sampleRec(tq, SNAPBUF)) { ch.ok = false; ch.msg = 'Hors mémoire'; continue; }
    applySnapshot(SNAPBUF); restored = false;
    const k = SNAP.cams + (cam.id - 1) * 6;
    const pose = [SNAPBUF[k], SNAPBUF[k + 1], SNAPBUF[k + 2], SNAPBUF[k + 3], SNAPBUF[k + 4], SNAPBUF[k + 5]];
    cam.render(renderer, scene, pose, ch.rt, tq);
    ch.lastTq = tq; ch.lastCam = cam.id; ch.dirty = false;
  }
  if (!restored) applySnapshot(LIVE);
  for (const m of W.screens) m.uniforms.uLin.value = 0;
  tp = pe('· ralentis', tp);

  // --- sortie HDR (HLG) de la CCU de la caméra au moniteur de référence ---
  if (S.hdrView) { const src = feedOf('GRADE1'); const cam = src && src.startsWith('CAM') ? camById(+src.slice(3)) : null; if (cam && cam.signalOK) cam.paintTo(renderer, P.rts.hdr, true); }
  // --- habillage (source GFX) ---
  gfxFillMat.uniforms.tD.value = GFX.main.tex; blit(renderer, gfxFillMat, P.rts.gfx);

  // --- mélangeur ---
  const a = resolve(meSource(MIX.pgm), 0, false, 'ME' + MIX.pgm), b = resolve(meSource(MIX.pst), 0, false, 'ME' + MIX.pst), k = resolve(meSource(MIX.key1.src), 0, false, 'ME' + MIX.key1.src);
  const u = mixMat.uniforms;
  const safe = (r) => (r.out ? { tex: TEX.black, scale: SC } : r); // pas de boucle de retour
  const A = safe(a), B = safe(b), Kk = safe(k);
  u.tA.value = A.tex; u.sA.value = A.scale; u.tB.value = B.tex; u.sB.value = B.scale; u.tK.value = Kk.tex; u.sK.value = Kk.scale;
  u.tD1.value = GFX.bug.tex; u.tD2.value = GFX.main.tex; u.tLogo.value = TEX.logo;
  u.uType.value = TYPE_N[MIX.trans]; u.uWipe.value = MIX.wipe; u.uPos.value = MIX.pos; u.uBg.value = MIX.next.bkgd ? 1 : 0;
  const kOn = MIX.key1.on ? 1 : 0;
  u.uKeyA.value = kOn; u.uKeyB.value = MIX.next.key1 ? 1 - kOn : kOn; u.uKeyPos.value = MIX.next.key1 ? (MIX.trans === 'stinger' ? (MIX.pos > 0.5 ? 1 : 0) : MIX.pos) : 0;
  const s = MIX.key1.size, cr = MIX.key1.corner, m = 0.05;
  const x0 = cr.includes('l') ? m : 1 - m - s, y0 = cr.includes('b') ? m * 1.7778 : 1 - m * 1.7778 - s;
  u.uKeyRect.value.set(x0, y0, x0 + s, y0 + s);
  u.uD1.value = MIX.dsk1.level; u.uD2.value = MIX.dsk2.level; u.uFtb.value = MIX.ftb.level;
  u.uMode.value = 0; blit(renderer, mixMat, P.rts.pgm);
  u.uMode.value = 1; blit(renderer, mixMat, P.rts.clean);
  u.uMode.value = 2; blit(renderer, mixMat, P.rts.pvw);

  // --- retour antenne (délai) ---
  const D = P.delay; D.k++;
  if (D.k % 2 === 0) {
    const txSrc = feedOf(S.txPath === 2 ? 'TX2' : 'TX1');
    const tx = txSrc ? resolve(txSrc, 0, false, S.txPath === 2 ? 'AUX_TX2' : 'AUX_TX1') : { tex: noSignalTex('PAS DE DÉPART', 'Sortie de grille non brassée'), scale: SC };
    copyMat.uniforms.map.value = tx.tex;
    copyMat.uniforms.uGain.value = tx.scale;
    blit(renderer, copyMat, D.rts[D.idx]); D.times[D.idx] = S.time; D.idx = (D.idx + 1) % D.n;
  }

  tp = pe('· mélangeur', tp);
  // --- multiview ---
  for (const t of MV.tiles) {
    let src = t.role === 'PGM' ? 'PGM' : t.role === 'PVW' ? 'PVW' : ROUTER.map[t.role];
    const r = resolve(src, 0, t.role === 'PGM' || t.role === 'PVW', mvDest(t.role));
    t.mesh.material.uniforms.map.value = r.tex; t.mesh.material.uniforms.uGain.value = 1.1 * r.scale;
  }
  // hors de vue, le multiview n'est redessiné que deux fois par seconde (il reste prêt quand on entre dans le car)
  if (mvSeen || S.time - MV.lastRender > 0.5) {
    MV.lastRender = S.time;
    const key = `${MIX.pgm}|${MIX.pst}|${MIX.key1.on}|${MIX.auto}|${MIX.pos > 0}|${MIX.ftb.on}|${S.cams.map((c) => c.id + (c.signalOK ? 'o' : 'x') + (c.paint.bars ? 'b' : '') + (c.rf ? c.rf.state : '') + c.lens).join(',')}|${EVS.ch.map((c) => c.mode + c.cam + c.playing + Math.round(c.speed * 100) + (c.media ? c.media.id + c.media.playing : '')).join(',')}`;
    if (P.mvDirty || key !== MV.lastKey || S.time - MV.lastDraw > 0.25) { drawOverlay(); MV.lastKey = key; MV.lastDraw = S.time; P.mvDirty = false; }
    if (!mvSeen || S.frame % 3 === 0) drawDyn();
    renderer.setRenderTarget(P.rts.mv); renderer.render(MV.scene, MV.cam);
  }
  tp = pe('· multiview', tp);

  // --- mesures ---
  updateMeters(renderer);
  updateScope(renderer);
  pe('· mesures', tp);

  // --- tally des caméras ---
  for (const c of S.cams) c.setTally(tallyOf('CAM' + c.id));

  // --- écrans du car ---
  const sc = TR.screens;
  const setS = (mat, id) => { const r = resolve(id, 0, ['PGM', 'PVW', 'CLEAN', 'RETANT', 'EVSA', 'EVSB'].includes(id)); mat.uniforms.map.value = r.tex; mat.uniforms.uGain.value = 1.1 * r.scale; };
  sc.mv.uniforms.map.value = P.rts.mv.texture; sc.mv2.uniforms.map.value = P.rts.mv.texture; sc.audioMv.uniforms.map.value = P.rts.mv.texture;
  setS(sc.pgm, 'PGM'); setS(sc.pvw, 'PVW'); setS(sc.clean, 'CLEAN'); setS(sc.retant, 'RETANT');
  setS(sc.ref, feedOf('GRADE1')); setS(sc.evsA, 'EVSA'); setS(sc.evsB, 'EVSB');
  const hfc = S.cams.find((c) => c.rf); setS(sc.hfmon, hfc ? 'CAM' + hfc.id : 'BLACK');
  if (S.hfSpecTex) { sc.hfspec.uniforms.map.value = S.hfSpecTex; }
  renderer.setRenderTarget(null);
}

// ----------------------------------------------------------------------------------
// "Slots" : zones HTML dans lesquelles on dessine une texture vidéo (multiview, moniteurs)
// ----------------------------------------------------------------------------------
const slotMat = new THREE.ShaderMaterial({
  uniforms: { map: { value: null }, uGain: { value: 1 }, uHDR: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `uniform sampler2D map; uniform float uGain; uniform float uHDR; varying vec2 vUv;
    vec3 hlgInv(vec3 E){ vec3 lo = E * E / 3.0; vec3 hi = (exp((E - 0.55991073) / 0.17883277) + 0.28466892) / 12.0; return mix(lo, hi, step(0.5, E)); }
    void main(){
      vec3 c = clamp(texture2D(map, vUv).rgb * uGain, 0.0, 1.0);
      if (uHDR > 0.5) {
        // signal HLG -> lumière de scène -> écran HDR 1000 cd/m² (OOTF gamma 1,2) -> écran SDR avec compression douce des hautes lumières
        vec3 L = hlgInv(c); float Y = dot(L, vec3(0.2627, 0.6780, 0.0593));
        vec3 D = L * pow(max(Y, 1e-6), 0.2) * 1000.0;
        vec3 n = D / 203.0 * 0.75; c = n / (1.0 + n * 0.28);
        c = pow(clamp(c * 1.12, 0.0, 1.0), vec3(1.0 / 2.2));
      }
      gl_FragColor = vec4(c, 1.0); }`,
  depthTest: false, depthWrite: false,
});
const slotScene = new THREE.Scene(); const slotQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), slotMat); slotQuad.frustumCulled = false; slotScene.add(slotQuad);
// écrans ajoutés par un poste (monitoring de la Videohub…) : id → () => ({ tex, gain })
export const EXTRA_SLOTS = {};
export function slotTexture(id) {
  if (EXTRA_SLOTS[id]) return EXTRA_SLOTS[id]();
  if (id === 'mv') return { tex: P.rts.mv.texture, gain: 1 };
  if (id === 'HDR') return { tex: P.rts.hdr.texture, gain: 1.1, hdr: 1 };
  if (id === 'HLGRAW') return { tex: P.rts.hdr.texture, gain: 1.1 };
  if (id === 'scope') return { tex: SCOPE.tex, gain: 1 };
  if (id === 'camop' && P.rts.camop) return { tex: P.rts.camop.texture, gain: 1.1 };
  // moniteurs de l'onglet Exploitation : sortie d'un émetteur, image reçue par un récepteur
  if (id.startsWith('TX:')) { const f = FAB.flows[id.slice(3)]; const r = f && f.src ? resolve(f.src, 0, true) : { tex: noSignalTex('PAS D\'IMAGE', f ? 'Flux audio ou de données' : 'Aucune source choisie'), scale: SC }; return { tex: r.tex, gain: 1.1 * r.scale }; }
  if (id.startsWith('RX:')) { const r = rxPicture(id.slice(3)); return { tex: r.tex, gain: 1.1 * r.scale }; }
  if (id.startsWith('AUX_')) { const d = { AUX_TX1: 'TX1', AUX_TX2: 'TX2', AUX_GIANT: 'GIANT', AUX_VISION: 'GRADE1' }[id]; const r = resolve(feedOf(d), 0, false, id); return { tex: r.tex, gain: 1.1 * r.scale }; }
  const r = resolve(id, 0, true); return { tex: r.tex, gain: 1.1 * r.scale };
}
// ce qu'affiche la sortie d'un récepteur ST 2110 (vidéo) : l'image reçue, des pertes, ou rien
function rxPicture(rxId) {
  const s = FAB.res && FAB.res.rxState[rxId];
  if (!s) return { tex: noSignalTex('NON CONNECTÉ', 'Aucun abonnement'), scale: SC };
  if (!s.ok) return { tex: noSignalTex('PAS DE FLUX', ipWhy(s.reason)), scale: SC };
  const f = FAB.flows[s.flow];
  if (!f.src) return { tex: noSignalTex('FLUX AUDIO', f.label), scale: SC };
  if (s.loss > 0.001 && Math.random() < Math.min(0.85, 0.15 + s.loss)) return { tex: lossTex(S.frame % 3), scale: SC };
  return resolve(f.src, 0, true);
}
export function drawSlots(renderer, list) {
  const els = list || document.querySelectorAll('[data-gl]');
  const H = renderer.domElement.clientHeight;
  renderer.setRenderTarget(null);
  renderer.setScissorTest(true);
  for (const el of els) {
    if (!el.isConnected || el.offsetParent === null) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > H) continue;
    // découpe à la zone défilante qui contient l'écran (sinon il déborderait sur l'en-tête)
    let cl = r.left, ct = r.top, cr = r.right, cb = r.bottom;
    const box = el.closest('.st-body, .st-dock');
    if (box) { const b = box.getBoundingClientRect(); cl = Math.max(cl, b.left); ct = Math.max(ct, b.top); cr = Math.min(cr, b.right); cb = Math.min(cb, b.bottom); }
    if (cr - cl < 2 || cb - ct < 2) continue;
    const s = slotTexture(el.dataset.gl);
    slotQuad.material.uniforms.map.value = s.tex; slotQuad.material.uniforms.uGain.value = s.gain; slotQuad.material.uniforms.uHDR.value = s.hdr || 0;
    const y = H - r.bottom;
    renderer.setViewport(r.left, y, r.width, r.height); renderer.setScissor(cl, H - cb, cr - cl, cb - ct);
    renderer.render(slotScene, fsCam);
  }
  renderer.setScissorTest(false);
  renderer.setViewport(0, 0, renderer.domElement.clientWidth, H);
}
