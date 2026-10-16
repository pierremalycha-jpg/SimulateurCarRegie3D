import { S, camById } from '../state.js';
import { MIX, EVS, ROUTER, evsSetRecording } from '../pipeline.js';
import { GFX, gfxTake, gfxOut } from '../gfx.js';
import { AU, applyAll, applyStrip, setPatch, setLineDelay, setFollow } from '../audio.js';
import { CAMERA_TYPES } from '../data.js';
import { addCamera, removeCamera, lineUpCamera } from '../bcam.js';

// ----------------------------------------------------------------------------------
// « Tranches » d'état partagées pendant une session à plusieurs. Chaque tranche appartient
// à un rôle : seul le stagiaire qui tient ce rôle la diffuse, les autres l'appliquent.
//   via 'presence' : état qui bouge vite (mélangeur, EVS, habillage) → champ de présence
//   via 'event'    : état qui change par à-coups (son, vision, grille, technique) → événement
// Une tranche « multi » est découpée en parties (une par tranche de console, une par caméra).
// ----------------------------------------------------------------------------------
const r2 = (v) => Math.round(v * 100) / 100;
const clone = (o) => JSON.parse(JSON.stringify(o));

const STRIP_KEYS = ['src', 'gain', 'ph48', 'phase', 'hpf', 'eq', 'gate', 'dyn', 'delay', 'pan', 'fader', 'mute', 'afv', 'pgm', 'intl', 'n1', 'nxs', 'nxb', 'vca'];

export const SLICES = {
  // mélangeur : bus, transition en cours, clé, DSK, FTB
  mix: {
    role: 'truquiste', via: 'presence', field: 'x',
    get: () => ({ pgm: MIX.pgm, pst: MIX.pst, tr: MIX.trans, wp: MIX.wipe, rt: MIX.rate, nb: MIX.next.bkgd, nk: MIX.next.key1, k: [MIX.key1.on, MIX.key1.src, MIX.key1.corner, MIX.key1.size], d1: MIX.dsk1.on, d2: MIX.dsk2.on, f: MIX.ftb.on, au: MIX.auto, po: r2(MIX.pos), dir: MIX.tbarDir }),
    apply(v) {
      Object.assign(MIX, { pgm: v.pgm, pst: v.pst, trans: v.tr, wipe: v.wp, rate: v.rt, auto: v.au, pos: v.po, tbarDir: v.dir });
      MIX.next.bkgd = v.nb; MIX.next.key1 = v.nk;
      [MIX.key1.on, MIX.key1.src, MIX.key1.corner, MIX.key1.size] = v.k;
      for (const [d, on] of [[MIX.dsk1, v.d1], [MIX.dsk2, v.d2]]) if (d.on !== on) { d.on = on; d.auto = on ? 1 : -1; }
      if (MIX.ftb.on !== v.f) { MIX.ftb.on = v.f; MIX.ftb.auto = v.f ? 1 : -1; }
    },
  },
  // serveur ralenti : les deux canaux de lecture et l'enregistrement
  evs: {
    role: 'evs', via: 'presence', field: 'e',
    get: () => ({ rec: EVS.recording, ch: EVS.ch.map((c) => [c.mode, c.cam, r2(c.t), r2(c.speed), r2(c.lever), c.playing ? 1 : 0, c.in == null ? null : r2(c.in), c.out == null ? null : r2(c.out)]) }),
    apply(v) {
      if (EVS.recording !== v.rec) evsSetRecording(v.rec);
      v.ch.forEach((a, i) => { const c = EVS.ch[i]; if (!c) return; [c.mode, c.cam, c.t, c.speed, c.lever] = a; c.playing = !!a[5]; c.in = a[6]; c.out = a[7]; });
    },
  },
  // habillage : graphique préparé et animation
  gfx: {
    role: 'habillage', via: 'presence', field: 'g',
    get: () => ({ c: GFX.cued, t: GFX.template, d: GFX.animDir, a: GFX.anim > 0.5 ? 1 : 0, p: GFX.player }),
    apply(v) {
      GFX.cued = v.c; GFX.player = v.p;
      const on = GFX.template && GFX.anim > 0.5 && GFX.animDir >= 0;
      if (v.a && v.d >= 0 && (!on || GFX.template !== v.t)) gfxTake(v.t);
      else if ((!v.a || v.d < 0) && on) gfxOut();
    },
  },
  // grille de commutation
  router: {
    role: 'technique', via: 'event',
    get: () => ({ m: ROUTER.map }),
    apply(v) { for (const k in v.m) ROUTER.map[k] = v.m[k]; },
  },
  // transmission, brouillage, réglages HF des caméras sans fil
  tech: {
    role: 'technique', via: 'event',
    get: () => ({ tx: S.txPath, ftx: !!S.faults.tx, jam: S.faults.jam || null, rf: S.cams.filter((c) => c.rf).map((c) => [c.id, c.rf.ch, c.rf.mod, c.rf.fec, c.rf.gi, c.rf.txmW, c.rf.bw, c.rf.lat]) }),
    apply(v) {
      S.txPath = v.tx; S.faults.tx = v.ftx; S.faults.jam = v.jam;
      for (const [id, ch, mod, fec, gi, tx, bw, lat] of v.rf || []) { const c = camById(id); if (c && c.rf) Object.assign(c.rf, { ch, mod, fec, gi, txmW: tx, bw, lat }); }
    },
  },
  // console son : une partie par tranche + une pour les bus
  audio: {
    role: 'son', via: 'event', multi: true,
    parts: () => [...AU.order, 'bus'],
    getPart(p) {
      if (p === 'bus') return { b: Object.fromEntries(['intl', 'n1', 'nxs', 'nxb'].map((k) => [k, [AU.bus[k].fader, AU.bus[k].mute]])), v: Object.fromEntries(Object.keys(AU.vca).map((k) => [k, [AU.vca[k].fader, AU.vca[k].mute]])), m: AU.master.fader, l: AU.master.lim, e: AU.emb, d: AU.lineDelay, f: AU.follow, a: AU.autoCanon };
      const c = AU.ch[p]; if (!c) return null;
      const o = {}; for (const k of STRIP_KEYS) o[k] = c[k];
      // les canons suivis par l'assistant bougent en continu : chacun les recalcule chez lui
      if (AU.autoCanon && c.group === 'canon') delete o.fader;
      return o;
    },
    applyPart(p, v) {
      if (p === 'bus') {
        for (const k in v.b) [AU.bus[k].fader, AU.bus[k].mute] = v.b[k];
        for (const k in v.v) [AU.vca[k].fader, AU.vca[k].mute] = v.v[k];
        AU.master.fader = v.m; AU.master.lim = v.l; AU.emb.splice(0, 4, ...v.e); AU.autoCanon = v.a;
        if (AU.lineDelay !== v.d) setLineDelay(v.d); if (AU.follow !== v.f) setFollow(v.f);
        applyAll(); return;
      }
      const c = AU.ch[p]; if (!c) return;
      for (const k of STRIP_KEYS) if (k in v && k !== 'src') c[k] = clone(v[k]);
      if (v.src && v.src !== c.src) setPatch(p, v.src, true);
      applyStrip(c);
    },
  },
  // vision : réglages de peinture de chaque caméra (et sa dérive « cachée », pour les pannes)
  cams: {
    role: 'vision', via: 'event', multi: true,
    parts: () => S.cams.map((c) => String(c.id)),
    getPart(p) { const c = camById(+p); return c ? { p: c.paint, h: c.hidden } : null; },
    applyPart(p, v) { const c = camById(+p); if (!c) return; Object.assign(c.paint, clone(v.p)); Object.assign(c.hidden, v.h); },
  },
  // liaisons caméra (fibre coupée, référence) : technique
  links: {
    role: 'technique', via: 'event', multi: true,
    parts: () => S.cams.map((c) => String(c.id)),
    getPart(p) { const c = camById(+p); return c ? { fc: !!c.fiberCut, gl: c._gl !== false } : null; },
    applyPart(p, v) { const c = camById(+p); if (!c) return; if (!!c.fiberCut !== v.fc) { c.fiberCut = v.fc; c.checkLink(); } c._gl = v.gl; },
  },
  // dispositif caméras (hôte) : tout le monde doit avoir les mêmes caméras aux mêmes places
  rig: {
    role: '_host', via: 'event',
    get: () => ({ c: S.cams.map((c) => [c.id, c.slotId, c.type, c.lens, c.link, c.role]) }),
    apply(v) {
      const want = new Map(v.c.map((a) => [a[0], a]));
      for (const c of [...S.cams]) { const w = want.get(c.id); if (!w || w[1] !== c.slotId || w[2] !== c.type || w[3] !== c.lens || w[4] !== c.link) removeCamera(c.id); else if (c.role !== w[5]) c.role = w[5]; }
      for (const [id, slotId, type, lens, link, role] of v.c) {
        if (camById(id) || !slotId || !CAMERA_TYPES[type]) continue;
        const c = addCamera({ id, slotId, type, lens, link, role });
        if (c) lineUpCamera(c);
      }
    },
  },
};

// postes du car → tranche qu'ils pilotent
export const STATION_SLICE = { melangeur: 'mix', habillage: 'gfx', evs: 'evs', ipdirector: 'evs', son: 'audio', vision: 'cams', ccu: 'links', grille: 'router', brassage: 'router', transmission: 'tech', hf: 'tech', synchro: 'links' };

// clé de comparaison d'une tranche (ou d'une partie)
export function sliceKey(id, part) {
  const s = SLICES[id];
  try { return JSON.stringify(s.multi ? s.getPart(part) : s.get()); } catch (e) { return ''; }
}
export function allKeys() {
  const out = {};
  for (const id in SLICES) { const s = SLICES[id]; if (s.multi) for (const p of s.parts()) out[id + '/' + p] = sliceKey(id, p); else out[id] = sliceKey(id); }
  return out;
}
