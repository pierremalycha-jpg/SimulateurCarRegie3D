// @ts-check
import { el, clamp } from '../../util.js';
import { MIRE_D, SENSOR, ND, zoomPos, exposureOf, fr, castOf, dofLimits, maxAperture } from '../optics.js';
import { makeViewfinder, drawScope, cnv, decode, encode, MIRE_WHITE } from '../vf.js';
import { slider, seg, toggle, btnRow, linkBtn, lensRings, lensState, shell, scopeCanvas, irisPos, pointPos, irisLabel } from '../controls.js';

// Manipulations des fiches du module caméra : les filtres, le prisme et les capteurs (chapitres 2 et 3). Chacune reçoit ctx = { lens(état) } et
// renvoie { node, dispose } (voir ../labs.js). Le viseur simulé est dans ../vf.js, les commandes
// communes dans ../controls.js, les calculs d'optique dans ../optics.js.
// ----------------------------------------------------------------------------------
// Les calculs de ces six manipulations sont en tête du fichier (fonctions pures, testées par
// tests/unit/camlab-ch23.test.mjs) :
// - la sensibilité de la HXC-FB80 (fiche technique : F13 à 2000 lx, 3200 K, réflectance 89,9 %,
//   50 Hz ; rapport signal sur bruit 60 dB) donne le niveau d'un blanc pour un éclairement, un
//   iris, un filtre ND, un gain et un temps de pose ; le budget en diaphragmes de chaque réglage ;
// - le gain en dB : ×10^(dB/20), +6 dB = ×2 = un diaphragme ; le rapport signal sur bruit, mesuré
//   objectif fermé, baisse d'autant de dB que le gain monte ;
// - les mireds (10^6 / T) de la température de couleur ;
// - l'obturateur : vitesses du commutateur SHUTTER en 50i (mode d'emploi : 1/60, 1/125, 1/250,
//   1/500, 1/1000, 1/2000), scintillement d'une lumière qui vibre (moyenne sur le temps de pose,
//   ligne par ligne pour un capteur CMOS lu de haut en bas), flou de bouger ;
// - le moiré : un motif plus fin que deux photosites (5 µm) se replie ; réponse du photosite, du
//   filtre passe-bas optique (deux lames, ± ½ photosite) et de la diffraction ;
// - les formats de sortie de la FB80 (1080/50i, 1080/50P, 1080/25PsF, 720/50P) et leur débit SDI
//   (raster complet × 20 bits : 1,485 Gb/s en HD-SDI, 2,97 Gb/s en 3G-SDI).
// Ce que la fiche technique ne donne pas (capacité d'un photosite, fuite de l'infrarouge dans
// chaque voie, profondeur de modulation d'une lampe, durée de lecture du capteur) est un ordre de
// grandeur de maquette, dit comme tel dans les textes.
// ----------------------------------------------------------------------------------

// ================================== les calculs ==================================
/** pas d'un photosite (mm) : 9,59 mm ÷ 1920 */
export const PITCH = SENSOR.w / 1920;
/** sensibilité de la HXC-FB80 : un blanc à 89,9 % éclairé à 2000 lx sort à 100 % à f/13 (50 Hz, 0 dB, sans filtre) */
export const FB80 = { lux: 2000, N: 13, snr: 60 };
/** gain en dB → amplification */
export const dbGain = (db) => 10 ** (db / 20);
/** gain en dB → diaphragmes (6,02 dB par diaphragme) */
export const stopsOfDb = (db) => db / (20 * Math.log10(2));
/** les gains du RCP et du commutateur GAIN, par pas de 3 dB (fiche technique : −3 à +12 dB) */
export const GAINS = [-3, 0, 3, 6, 9, 12];
/** niveau du blanc en lumière linéaire (1 = 100 % vidéo) : éclairement (lx), iris, gain (dB), ND, temps de pose (s) */
export function whiteLin({ lux, N, gain = 0, nd = 1, te = 1 / 50 }) {
  return (lux / FB80.lux) * (FB80.N / N) ** 2 * dbGain(gain) * nd * te * 50;
}
/** niveau vidéo (%) d'une lumière linéaire, courbe BT.709, écrêté à 100 % */
export const videoPct = (lin) => 100 * encode(lin);
/** exposé juste : le blanc entre 80 et 100 %, sans écrêter */
export const okPct = (w) => w >= 80 && w < 99.6;
/** le nombre f qui met ce blanc à 100 % à 0 dB, sans filtre, à 1/50 s */
export const nAt0dB = (lux) => FB80.N * Math.sqrt(lux / FB80.lux);
/** rapport signal sur bruit (dB) au gain g : 60 dB à 0 dB (objectif fermé) ; le gain amplifie le bruit autant que le signal */
export const snrAt = (g) => FB80.snr - g;
/** le plus petit gain qui expose juste ; null si aucun */
export function minGain(lux, N, nd = 1, te = 1 / 50) {
  for (const g of GAINS) if (okPct(videoPct(whiteLin({ lux, N, gain: g, nd, te })))) return g;
  return null;
}
/** ce que chaque réglage apporte, en diaphragmes, par rapport à 2000 lx, f/13, sans filtre, 0 dB, 1/50 s ; la somme vaut log2 du niveau */
export function budget({ lux, N, nd = 1, gain = 0, te = 1 / 50 }) {
  return { lumiere: Math.log2(lux / FB80.lux), iris: 2 * Math.log2(FB80.N / N), nd: Math.log2(nd), gain: stopsOfDb(gain), shutter: Math.log2(te * 50) };
}
/** micro-réciproque de degré (mired) d'une température de couleur (K) */
export const mired = (T) => 1e6 / T;
/** maximum d'émission d'un corps noir (nm) : loi de Wien */
export const wien = (T) => 2.898e6 / T;

/** les vitesses du commutateur SHUTTER en 50i (mode d'emploi HXC-FB80) ; OFF = toute la trame, 1/50 s */
/** @type {[string, number][]} */
export const SHUTTERS_50 = [['OFF', 1 / 50], ['1/60', 1 / 60], ['1/125', 1 / 125], ['1/250', 1 / 250], ['1/500', 1 / 500], ['1/1000', 1 / 1000], ['1/2000', 1 / 2000]];
export const sinc = (x) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x));
/** angle d'obturation équivalent (degrés) : 360° = toute la durée d'une image */
export const shutterAngle = (te, fps = 50) => 360 * te * fps;
/** scintillement d'une lumière sinusoïdale (fréquence F, modulation m) vue avec un temps de pose te : (max − min) / moyenne */
export const flicker = (F, te, m) => 2 * m * Math.abs(sinc(F * te));
/** lumière moyenne, sur [t, t + te], d'une source allumée une fraction d de chaque période (écran à LED, fréquence F) */
export function pwmMean(F, d, t, te) {
  const S = (u) => { const c = Math.floor(u * F); return (c * d + Math.min(u * F - c, d)) / F; };
  return (S(t + te) - S(t)) / te;
}
/** bandes d'un écran (F, d) dans une image lue de haut en bas en Tread : (max − min) / moyenne */
export function bandContrast(F, d, te, t0 = 0, Tread = 1 / 50, n = 160) {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) { const v = pwmMean(F, d, t0 + (i / n) * Tread, te); if (v < lo) lo = v; if (v > hi) hi = v; }
  return (hi - lo) / d;
}

/** période (en photosites) sur le capteur d'un motif de période pMm (mm) à D (m), focale f (mm) */
export const periodPx = (pMm, f, D) => pMm * f / (D * 1000 - f) / PITCH;
/** réponse de la diffraction (pupille circulaire) à une fréquence (cycles/mm), lumière verte 0,55 µm */
export function mtfDiff(cpmm, N, lambda = 0.00055) {
  const v = cpmm * lambda * N;
  return v >= 1 ? 0 : (2 / Math.PI) * (Math.acos(v) - v * Math.sqrt(1 - v * v));
}
/** réponse signée de la chaîne à une fréquence (fx, fy en cycles par photosite) : photosite, filtre passe-bas (± ½ photosite), diffraction */
export function mtf(fx, fy, olpf, N) {
  let m = sinc(fx) * sinc(fy);
  if (olpf) m *= Math.cos(Math.PI * fx) * Math.cos(Math.PI * fy);
  return m * mtfDiff(Math.hypot(fx, fy) / PITCH, N);
}
/** fréquence repliée par l'échantillonnage (un échantillon par photosite) */
export const fold = (f) => f - Math.round(f);
/** le moiré d'un motif (fx, fy) : replié ou non, contraste qui reste, distance entre deux franges (photosites) */
export function moire(fx, fy, olpf, N) {
  const alias = Math.abs(fx) > 0.5 || Math.abs(fy) > 0.5;
  const fa = Math.hypot(fold(fx), fold(fy));
  return { alias, c: Math.abs(mtf(fx, fy, olpf, N)), fringe: fa > 1e-6 ? 1 / fa : Infinity };
}

/** les formats de sortie de la HXC-FB80 montrés ici (fiche technique) : pixels, raster complet, images par seconde, balayage */
export const FORMATS_FB80 = {
  '1080/50i': { w: 1920, h: 1080, tot: 2640, lines: 1125, images: 25, scan: 'i' },
  '1080/50P': { w: 1920, h: 1080, tot: 2640, lines: 1125, images: 50, scan: 'p' },
  '1080/25PsF': { w: 1920, h: 1080, tot: 2640, lines: 1125, images: 25, scan: 'psf' },
  '720/50P': { w: 1280, h: 720, tot: 1980, lines: 750, images: 50, scan: 'p' },
};
/** débit SDI (Gb/s) : raster complet × images × 20 bits (4:2:2 sur 10 bits) */
export const sdiGbps = (F) => F.tot * F.lines * F.images * 20 / 1e9;
/** @type {[string, string, number, string][]} les liaisons : code, nom, débit (Gb/s), norme */
export const SDI = [['HD', 'HD-SDI', 1.485, 'SMPTE ST 292-1'], ['3G', '3G-SDI', 2.97, 'SMPTE ST 424']];
/** la plus petite liaison qui suffit */
export const sdiFor = (F) => (SDI.find((s) => sdiGbps(F) <= s[2] + 1e-6) || SDI[SDI.length - 1])[0];
/** pixels actifs par seconde */
export const pixelsPerSecond = (F) => F.w * F.h * F.images;

// ================================== les manipulations ==================================
const send = (ctx, s) => { if (ctx && ctx.lens) ctx.lens(s); };
const readout = () => el('p', { class: 'cl-read' });
const pct = (v) => fr(v * 100, 0) + ' %';
const sgn = (v, d = 1) => (v > 0.0001 ? '+' : v < -0.0001 ? '−' : '') + fr(Math.abs(v), d);
const dB = (g) => (g > 0 ? '+' : g < 0 ? '−' : '') + Math.abs(g) + ' dB';
/** table d'encodage BT.709 sur 8 bits, pour les images calculées pixel par pixel */
const ENC8 = (() => { const t = new Uint8ClampedArray(4097); for (let i = 0; i <= 4096; i++) t[i] = Math.round(255 * encode(i / 4096)); return t; })();
const enc8 = (l) => (l <= 0 ? 0 : l >= 1 ? 255 : ENC8[(l * 4096) | 0]);
/** lumière transmise → nom du filtre ND */
const ndName = (v) => (ND.find((x) => x[1] === v) || ND[0])[0].replace('ND', ' ND');
/** lumière à envoyer à la caméra 3D pour qu'elle montre l'exposition E du viseur simulé */
const light3d = (E, N, nd = 1, gain = 0) => (isFinite(N) ? E / exposureOf(N, nd, gain) : 0);
const msLabel = (te) => (te >= 1 / 60 - 1e-9 ? fr(te * 1000, 1) : fr(te * 1000, te < 0.001 ? 2 : 1)) + ' ms';

export const LABS_CH23 = {
  // =================================================================================
  /** température de couleur : le CC électronique de la FB80 (3200, 4300, 5600, 6300 K), puis l'AWB */
  cc(ctx) {
    /** @type {[number, string][]} */
    const CCS = [[3200, 'A · 3200K'], [4300, 'B · 4300K'], [5600, 'C · 5600K'], [6300, 'D · 6300K']];
    /** @type {[string, number][]} */
    const SCENES = [['Plateau, projecteurs tungstène', 3200], ['Dehors, plein soleil', 5600], ['Fin de journée, soleil rasant', 3600]];
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, cc: 5600, k: 0, awb: /** @type {number | null} */ (null) };
    const defis = [false, false, false];
    let msg = '', timer = 0;
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img, 'parade'));
    const rings = lensRings(st, () => up(), []);
    const ccSeg = seg('COLOR TEMP.', CCS, st.cc, (v) => { st.cc = Number(v); st.awb = null; up(); });
    const awbB = el('button', { type: 'button', class: 'btn small', onclick: () => { st.awb = SCENES[st.k][1]; msg = 'AWB: OK'; clearTimeout(timer); timer = window.setTimeout(() => { msg = ''; up(); }, 2200); up(); } }, 'WHT/BLK ▲ WHT (balance sur le carton)');
    const awbRow = btnRow(awbB); awbRow.hidden = true;
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [ccSeg.row, awbRow, read], defis: [
      'Sur le plateau, sous les projecteurs tungstène : la caméra est restée sur 5600K et l\'image est orange. Remets-la juste d\'un seul geste, sans carton.',
      'Tu sors filmer en plein soleil : un geste, toujours sans carton.',
      'Fin de journée : le thermocolorimètre lit 3600 K, aucune position ne tombe juste. Prends la plus proche, puis fais la balance des blancs sur le carton.',
    ] });
    const Tcam = () => (st.awb != null ? st.awb : st.cc);
    const closest = (T) => CCS.reduce((b, c) => (Math.abs(mired(c[0]) - mired(T)) < Math.abs(mired(b[0]) - mired(T)) ? c : b))[0];
    function olivier(T, err) {
      const a = Math.abs(err), tint = err > 0 ? 'orange' : 'bleue';
      if (defis[2]) return 'La position la plus proche d\'abord, puis la balance sur le carton : les gains rouge et bleu n\'ont plus à corriger que les derniers mireds. C\'est l\'ordre du matin, le même qu\'avec la roue de filtres CC des caméras du car.';
      if (st.k === 2) {
        if (st.cc !== closest(T)) return `3600 K, c'est ${fr(mired(3600), 0)} mired. Compare en mireds, pas en kelvins : 3200 K est à ${fr(mired(3200) - mired(3600), 0)} mired, 4300 K à ${fr(mired(3600) - mired(4300), 0)}. Choisis la plus proche.`;
        if (st.awb == null) return `Avec 3200 K, il reste ${fr(a, 0)} mired : l'image est encore un peu ${tint}. Le carton est sous le soleil, au centre : pousse WHT.`;
      }
      if (a < 10) return st.k === 0 ? 'Juste : 3200 K pour 3200 K.' : 'Juste.';
      if (st.k < 2 && st.awb != null) return 'La balance sur le carton marche aussi, mais ici on n\'a ni le temps ni le carton : un geste sur COLOR TEMP.';
      return `L'image est ${tint} : la lumière est à ${T} K, la caméra attend ${Tcam()} K, ${fr(a, 0)} mired d'écart.${a > 100 ? ' C\'est l\'écart entre le tungstène et le jour.' : ''}`;
    }
    function up() {
      const o = rings.read();
      let T = SCENES[st.k][1];
      if (!defis[st.k]) {
        const err0 = mired(T) - mired(Tcam());
        const good = Math.abs(err0) < 10 && (st.k < 2 ? st.awb == null : st.awb != null && st.cc === closest(T));
        if (good) {
          defis[st.k] = true;
          if (st.k < 2) { st.k++; st.awb = null; T = SCENES[st.k][1]; if (st.k === 2) awbRow.hidden = false; }
        }
      }
      const name = SCENES[st.k][0], err = mired(T) - mired(Tcam());
      const cast = /** @type {[number, number, number]} */ (castOf(T, Tcam()));
      read.textContent = `${name} : ${T} K au thermocolorimètre, soit ${fr(mired(T), 0)} mired · caméra : ${Tcam()} K${st.awb != null ? ' (balance AWB)' : ''}, ${fr(mired(Tcam()), 0)} mired · écart ${sgn(err, 0)} mired · le blanc sort avec R ×${fr(cast[0], 2)} et B ×${fr(cast[2], 2)}`;
      sh.done(defis); sh.say(olivier(T, err));
      vf.draw({ f: o.f, dF: o.dF, N: o.N, E: 0.95, wb: cast, scene: st.k === 2 && st.awb == null && st.cc === closest(T) ? 'card' : 'mire', msg });
      send(ctx, lensState(st, o, { light: 0.5, wb: cast }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { cc: 5600, k: 0, awb: null }); ccSeg.mark(5600); awbRow.hidden = true; defis.fill(false); msg = ''; up(); })));
    up();
    return { node: sh.node, dispose: () => { clearTimeout(timer); vf.dispose(); } };
  },

  // =================================================================================
  /** le filtre passe-bas optique contre le moiré, et le filtre infrarouge */
  olpf(ctx) {
    const W = 640, H = 360, PW = 160, PH = 90, S = W / PW, NF = 5.6, TH = 3 * Math.PI / 180;
    const SC = {
      chemise: { nom: 'une chemise à rayures de 2 mm, à 3 m', p: 2, D: 3, kind: 'stripes', hi: [0.78, 0.78, 0.76], lo: [0.02, 0.025, 0.08] },
      led: { nom: 'un mur LED au pas de 3,9 mm, à 8 m', p: 3.9, D: 8, kind: 'dots', hi: [0.95, 0.9, 0.86], lo: [0.012, 0.012, 0.014] },
      ir: { nom: 'un tissu noir, une plante et une télécommande sous les projecteurs', p: 1, D: 3, kind: 'ir', hi: [1, 1, 1], lo: [0, 0, 0] },
    };
    const st = { z: zoomPos(30), s: pointPos(MIRE_D), n: irisPos(NF), nd: 1, sc: 'chemise', olpf: true, ir: true, remote: false, sawIR: false, f1: 0 };
    const defis = [false, false, false];
    const view = cnv(W, H); view.className = 'cl-vfc'; view.setAttribute('role', 'img');
    const strip = cnv(W, 130); strip.className = 'c23-strip'; strip.setAttribute('role', 'img');
    const g = view.getContext('2d'), gs = strip.getContext('2d');
    const rings = lensRings(st, () => up(), ['zoom']);
    const scS = seg('Devant la caméra', [['chemise', 'Chemise à rayures'], ['led', 'Mur LED'], ['ir', 'Tissu noir, télécommande']], st.sc, (v) => { st.sc = String(v); st.remote = false; remote.set(false); up(); });
    const lp = toggle('Filtre passe-bas optique', true, (v) => { st.olpf = v; up(); });
    const irT = toggle('Filtre infrarouge', true, (v) => { st.ir = v; up(); });
    const remote = toggle('Appuyer sur la télécommande', false, (v) => { st.remote = v; up(); });
    const read = readout();
    const sh = shell({ vf: { canvas: view }, scope: strip, ctrls: [scS.row, ...rings.rows, btnRow(lp.btn, irT.btn), btnRow(remote.btn), el('p', { class: 'cl-hint' }, 'Retirer un filtre n\'est possible que dans la maquette : sur la caméra, ils sont collés devant les capteurs.'), read], defis: [
      'Retire le filtre passe-bas, puis cherche la focale où la chemise (ou le mur LED) se couvre de franges qu\'elle n\'a pas : le moiré.',
      'À la même focale, remets le filtre passe-bas : les franges doivent presque disparaître.',
      'Sous les projecteurs, retire le filtre infrarouge et appuie sur la télécommande : la caméra voit ce que l\'œil ne voit pas. Puis remets le filtre.',
    ] });
    // ---- le motif vu par les photosites : série de Fourier, chaque terme atténué par la chaîne ----
    function terms(kind, P) {
      const c = Math.cos(TH) / P, s = Math.sin(TH) / P, out = [];
      if (kind === 'stripes') { for (const h of [1, 3, 5, 7]) out.push([(2 / (Math.PI * h)) * (h % 4 === 1 ? 1 : -1), h * c, h * s]); return { mean: 0.5, out }; }
      const d = 0.42, ch = (h) => (h === 0 ? d : 2 * Math.sin(Math.PI * h * d) / (Math.PI * h));
      for (let h = 0; h <= 3; h++) for (let k = 0; k <= 3; k++) {
        if (!h && !k) continue;
        const a = ch(h) * ch(k);
        if (!h || !k) out.push([a, h * c - k * s, h * s + k * c]);
        else out.push([a / 2, h * c - k * s, h * s + k * c], [a / 2, h * c + k * s, h * s - k * c]);
      }
      return { mean: d * d, out };
    }
    const valueAt = (T, mean, u, v) => { let x = mean; for (const [a, fx, fy] of T) x += a * Math.cos(2 * Math.PI * (fx * u + fy * v)); return clamp(x, 0, 1); };
    function drawPattern(scn, P) {
      const { mean, out } = terms(scn.kind, P);
      const T = out.map(([a, fx, fy]) => [a * mtf(fx, fy, st.olpf, NF), fx, fy]);
      const id = g.createImageData(W, H), d = id.data;
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
        const val = valueAt(T, mean, i - PW / 2 + 0.5, j - PH / 2 + 0.5);
        const r = enc8(scn.lo[0] + (scn.hi[0] - scn.lo[0]) * val), gg = enc8(scn.lo[1] + (scn.hi[1] - scn.lo[1]) * val), b = enc8(scn.lo[2] + (scn.hi[2] - scn.lo[2]) * val);
        for (let y = j * S; y < (j + 1) * S; y++) for (let x = i * S; x < (i + 1) * S; x++) { const q = (y * W + x) * 4; d[q] = r; d[q + 1] = gg; d[q + 2] = b; d[q + 3] = 255; }
      }
      g.putImageData(id, 0, 0);
      g.font = '600 13px "B612 Mono", monospace'; g.fillStyle = 'rgba(5,7,10,.75)'; g.fillRect(8, H - 28, 330, 20); g.fillStyle = '#e8e8e2'; g.textAlign = 'left';
      g.fillText(`160 × 90 photosites au centre du capteur, ×${S}`, 14, H - 13);
      // la rangée du milieu, reprise en bas
      g.strokeStyle = 'rgba(255,176,32,.8)'; g.lineWidth = 1.5; g.strokeRect((PW / 2 - 16) * S, (PH / 2 - 1) * S, 32 * S, S);
      // la rangée : le motif sur le capteur, puis la valeur de chaque photosite
      const w = W - 40, cell = w / 32, x0 = 20;
      gs.fillStyle = '#05070a'; gs.fillRect(0, 0, W, 130);
      gs.font = '600 11px "B612 Mono", monospace'; gs.textAlign = 'left'; gs.fillStyle = 'rgba(150,210,180,.75)';
      gs.fillText('le motif sur le capteur (avant les photosites)', x0, 13);
      for (let px = 0; px < w; px++) {
        const u = (px / cell) - 16; const ph = (Math.cos(TH) * u) / P; const on = scn.kind === 'stripes' ? Math.cos(2 * Math.PI * ph) > 0 : Math.abs(ph - Math.round(ph)) < 0.21;
        gs.fillStyle = on ? '#d9d9d2' : '#1d2433'; gs.fillRect(x0 + px, 18, 1, 22);
      }
      gs.fillStyle = 'rgba(150,210,180,.75)'; gs.fillText('ce que mesure chaque photosite de la rangée', x0, 58);
      for (let i = 0; i < 32; i++) {
        const v = valueAt(T, mean, i - 16 + 0.5, 0.5), h = 4 + v * 52;
        gs.fillStyle = '#2b3036'; gs.fillRect(x0 + i * cell + 1, 64, cell - 2, 56);
        gs.fillStyle = '#4cc3e6'; gs.fillRect(x0 + i * cell + 1, 120 - h, cell - 2, h);
      }
    }
    // ---- la scène infrarouge : une image visible et une image infrarouge, mélangées sans le filtre ----
    const visC = cnv(W, H), irC = cnv(W, H);
    function paintScenes() {
      const v = visC.getContext('2d'), r = irC.getContext('2d');
      const L = (a, b, c) => `rgb(${enc8(a)},${enc8(b)},${enc8(c)})`, I = (a) => L(a, a, a);
      const both = (fv, fi, draw) => { v.fillStyle = fv; draw(v); r.fillStyle = fi; draw(r); };
      both(L(0.16, 0.15, 0.14), I(0.32), (c) => c.fillRect(0, 0, W, H));
      both(L(0.05, 0.045, 0.04), I(0.2), (c) => c.fillRect(0, H * 0.78, W, H * 0.22));
      // la carte blanche
      both(L(0.85, 0.85, 0.85), I(0.8), (c) => c.fillRect(470, 70, 120, 150));
      // le tissu noir synthétique (une veste sur un buste)
      both(L(0.03, 0.03, 0.035), I(0.5), (c) => { c.beginPath(); c.moveTo(130, 70); c.quadraticCurveTo(190, 50, 250, 70); c.lineTo(300, 120); c.lineTo(285, 290); c.lineTo(95, 290); c.lineTo(80, 120); c.closePath(); c.fill(); });
      // la plante et son pot
      both(L(0.3, 0.12, 0.06), I(0.4), (c) => { c.beginPath(); c.moveTo(340, 300); c.lineTo(430, 300); c.lineTo(420, 250); c.lineTo(350, 250); c.closePath(); c.fill(); });
      both(L(0.05, 0.19, 0.045), I(0.6), (c) => { for (const [x, y, a] of [[385, 200, 0.2], [355, 215, -0.7], [415, 215, 0.7], [370, 180, -0.3], [400, 180, 0.3]]) { c.beginPath(); c.ellipse(x, y, 16, 40, a, 0, Math.PI * 2); c.fill(); } });
      // la télécommande, tenue devant
      both(L(0.04, 0.04, 0.045), I(0.06), (c) => { c.save(); c.translate(520, 280); c.rotate(-0.5); c.fillRect(-14, -50, 28, 100); c.restore(); });
      v.fillStyle = '#e8e8e2'; v.font = '600 14px "Archivo", sans-serif'; v.textAlign = 'center'; v.fillText('carte blanche', 530, 238);
    }
    paintScenes();
    const visD = visC.getContext('2d').getImageData(0, 0, W, H).data, irD = irC.getContext('2d').getImageData(0, 0, W, H).data;
    /** fuite de l'infrarouge dans chaque voie sans le filtre (ordre de grandeur : surtout le rouge, que le prisme envoie vers les grandes longueurs d'onde) */
    const IRK = [0.6, 0.15, 0.25];
    const LED = { x: 520 - Math.sin(0.5) * 50, y: 280 - Math.cos(0.5) * 50 };
    function drawIR() {
      const id = g.createImageData(W, H), d = id.data;
      for (let y = 0, q = 0; y < H; y++) for (let x = 0; x < W; x++, q += 4) {
        const ir = decode(irD[q]) + (st.remote ? 3.5 * Math.exp(-((x - LED.x) ** 2 + (y - LED.y) ** 2) / 30) : 0);
        const k = st.ir ? 0 : 1;
        d[q] = enc8(decode(visD[q]) + k * IRK[0] * ir); d[q + 1] = enc8(decode(visD[q + 1]) + k * IRK[1] * ir); d[q + 2] = enc8(decode(visD[q + 2]) + k * IRK[2] * ir); d[q + 3] = 255;
      }
      g.putImageData(id, 0, 0);
      // le spectre : visible, infrarouge, ce que voit le silicium, le filtre
      const X = (nm) => 20 + (nm - 350) / 800 * (W - 40), base = 112, hh = 84;
      gs.fillStyle = '#05070a'; gs.fillRect(0, 0, W, 130);
      const gr = gs.createLinearGradient(X(400), 0, X(700), 0);
      [['#5b2a9a', 0], ['#2050ff', 0.2], ['#20c0e0', 0.33], ['#30d050', 0.5], ['#f0e030', 0.66], ['#ff8020', 0.82], ['#d01010', 1]].forEach(([c, o]) => gr.addColorStop(/** @type {number} */ (o), /** @type {string} */ (c)));
      gs.fillStyle = gr; gs.fillRect(X(400), base + 2, X(700) - X(400), 8);
      gs.fillStyle = 'rgba(200,80,80,.25)'; gs.fillRect(X(700), base + 2, X(1100) - X(700), 8);
      const curve = (fn, color, dash = []) => { gs.strokeStyle = color; gs.lineWidth = 2; gs.setLineDash(dash); gs.beginPath(); for (let nm = 350; nm <= 1150; nm += 5) { const y = base - fn(nm) * hh; if (nm === 350) gs.moveTo(X(nm), y); else gs.lineTo(X(nm), y); } gs.stroke(); gs.setLineDash([]); };
      const planck = (nm, T) => { const l = nm * 1e-9; return 1 / (l ** 5 * (Math.exp(0.014388 / (l * T)) - 1)); };
      const pk = planck(wien(3200), 3200);
      curve((nm) => planck(nm, 3200) / pk, '#ffb020');
      curve((nm) => (nm < 400 ? 0.15 : nm < 800 ? 0.25 + 0.75 * (nm - 400) / 400 : Math.max(0, (1100 - nm) / 300)), '#9fd8ff', [5, 4]);
      if (st.ir) curve((nm) => (nm < 640 ? 1 : nm > 720 ? 0 : 0.5 * (1 + Math.cos(Math.PI * (nm - 640) / 80))), '#ff6b5e');
      gs.fillStyle = st.remote ? '#ff6bd8' : 'rgba(255,107,216,.45)'; gs.fillRect(X(940) - 2, base - hh, 4, hh);
      gs.font = '600 10.5px "B612 Mono", monospace'; gs.textAlign = 'center'; gs.fillStyle = '#9aa3a8';
      for (const nm of [400, 500, 600, 700, 800, 900, 1000, 1100]) gs.fillText(String(nm), X(nm), 126);
      gs.textAlign = 'left'; gs.fillStyle = '#ffb020'; gs.fillText('lampe 3200 K (maximum à 906 nm)', X(360), 14);
      gs.fillStyle = '#9fd8ff'; gs.fillText('le silicium (ordre de grandeur)', X(360), 28);
      gs.fillStyle = '#ff6b5e'; gs.fillText(st.ir ? 'filtre infrarouge : coupe vers 700 nm' : 'filtre infrarouge retiré', X(360), 42);
      gs.fillStyle = '#ff6bd8'; gs.textAlign = 'right'; gs.fillText('télécommande 940 nm', X(935), 14);
      gs.fillStyle = '#9aa3a8'; gs.fillText('nm', W - 6, 126);
    }
    function up() {
      const o = rings.read(); rings.show();
      const scn = SC[st.sc];
      let info, m = null;
      if (scn.kind === 'ir') {
        drawIR();
        view.setAttribute('aria-label', 'Le viseur : une veste noire, une plante, une carte blanche et une télécommande sous les projecteurs');
        strip.setAttribute('aria-label', 'Le spectre : la lumière visible de 400 à 700 nm, l\'infrarouge au-delà ; la lampe, le silicium et le filtre infrarouge');
        if (!st.ir && st.remote) st.sawIR = true;
        if (!defis[2] && st.sawIR && st.ir) defis[2] = true;
        info = `Lampe tungstène à 3200 K : son maximum est à ${fr(wien(3200), 0)} nm, dans l'infrarouge (loi de Wien). Filtre infrarouge ${st.ir ? 'en place' : 'retiré'}${st.remote ? ' · télécommande enfoncée (940 nm)' : ''}.`;
      } else {
        const P = periodPx(scn.p, o.f, scn.D);
        const fx = Math.cos(TH) / P, fy = Math.sin(TH) / P;
        m = moire(fx, fy, st.olpf, NF);
        const off = moire(fx, fy, false, NF);
        drawPattern(scn, P);
        view.setAttribute('aria-label', `Les photosites du centre du capteur devant ${scn.nom}`);
        strip.setAttribute('aria-label', 'Une rangée de photosites : le motif sur le capteur, et la valeur mesurée par chaque photosite');
        if (!defis[0] && !st.olpf && off.alias && off.c >= 0.2) { defis[0] = true; st.f1 = o.f; }
        if (defis[0] && !defis[1] && st.olpf && m.alias && m.c < 0.12 && Math.abs(o.f - st.f1) < 0.5) defis[1] = true;
        if (defis[0] && !defis[1] && !st.olpf && off.alias && off.c >= 0.2) st.f1 = o.f;
        info = `Devant la caméra, ${scn.nom}. Focale ${fr(o.f, 1)} mm : ${fr(P, 2)} photosite par période (il en faut au moins 2). ${m.alias ? `Repliement : des franges tous les ${isFinite(m.fringe) ? fr(m.fringe, 0) : '∞'} photosites, contraste ${pct(m.c)}.` : `Pas de repliement : le motif est vu tel qu'il est (contraste ${pct(m.c)}).`} Iris f/5,6.`;
      }
      read.textContent = info;
      sh.done(defis); sh.say(olivier(scn, m));
      send(ctx, lensState(st, o, { light: 0.5 }));
    }
    function olivier(scn, m) {
      if (scn.kind === 'ir') {
        if (defis[2]) return 'Le filtre infrarouge est collé devant les capteurs : sur la vraie caméra, la LED de la télécommande reste presque invisible et le noir reste noir. Sans lui, le tissu synthétique vire au bordeaux et la plante au rose : ils renvoient beaucoup d\'infrarouge.';
        if (!st.ir) return st.remote ? 'La LED brille : 940 nm, invisible à l\'œil, mais le silicium la voit. Regarde aussi la veste noire et la plante. Remets le filtre infrarouge.' : 'Sans filtre, l\'infrarouge entre surtout dans la voie rouge : la veste noire vire au bordeaux, la plante au rose, même le blanc rosit. Appuie sur la télécommande.';
        return 'Avec le filtre infrarouge, l\'image est juste. Retire-le, pour voir ce que le capteur verrait sans lui.';
      }
      if (defis[1] && defis[0]) return defis[2] ? 'Tout est vu.' : 'Le filtre passe-bas étale chaque point sur deux photosites : ce qui est plus fin que deux photosites est effacé avant d\'être mal compté. Prix : un très léger flou. Passe au tissu noir et à la télécommande.';
      if (!m) return '';
      if (defis[0]) return st.olpf ? (m.c < 0.12 ? 'Franges effacées.' : `Avec le filtre, il en reste ${pct(m.c)} : reviens à la focale de tout à l'heure, juste au-delà de la limite des deux photosites, là où le filtre est le plus efficace.`) : 'Moiré trouvé : ces franges ne sont pas sur la chemise, elles naissent de l\'échantillonnage. Remets le filtre passe-bas sans toucher au zoom.';
      if (st.olpf) return 'Le filtre passe-bas est en place, comme sur la vraie caméra. Retire-le (maquette) pour voir ce qu\'il évite.';
      if (!m.alias) return 'Le motif fait plus de deux photosites par période : chaque rayure est bien comptée. Élargis le cadre (focale plus courte) : les rayures deviennent plus fines sur le capteur.';
      if (m.c < 0.2) return `Repliement, mais faible (${pct(m.c)}) : l'objectif à f/5,6 et le photosite lui-même adoucissent déjà les détails trop fins. Resserre un peu, juste en dessous de deux photosites par période.`;
      return 'Moiré.';
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { z: zoomPos(30), sc: 'chemise', olpf: true, ir: true, remote: false, sawIR: false }); rings.sync(); scS.mark('chemise'); lp.set(true); irT.set(true); remote.set(false); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose() {} };
  },

  // =================================================================================
  /** le gain : +6 dB = un diaphragme, le bruit qui monte, les noirs qui bougent */
  gain(ctx) {
    const LUX = 20, NOISE0 = 0.002, DRIFT = [0.004, 0.0012, 0.006];
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(1.8), nd: 1, gain: 0, gAbb: 0, g1: 0, w1: 0, N1: 1.8, abb2: false };
    const defis = [false, false, false];
    let busy = 0, msg = '', msgT = 0, timer = 0;
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img, 'parade'));
    const rings = lensRings(st, () => up(), ['iris']);
    const gS = seg('GAIN', GAINS.map((v) => [v, dB(v)]), 0, (v) => { st.gain = Number(v); up(); });
    const blk = el('button', { type: 'button', class: 'btn small', onclick: () => { if (!busy) { busy = performance.now() + 1500; tick(); } } }, 'WHT/BLK ▼ BLK (ABB)');
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [gS.row, ...rings.rows, btnRow(blk), el('p', { class: 'cl-hint' }, 'Bruit doublé à l\'écran pour rester visible sur un petit écran ; les chiffres, eux, sont ceux de la fiche technique.'), read], defis: [
      'Une salle très sombre, 20 lux, plan large : l\'iris est déjà grand ouvert. Monte le gain juste ce qu\'il faut pour un blanc entre 80 et 100 %.',
      '+6 dB, c\'est un diaphragme : ajoute 6 dB et retrouve le même blanc à l\'iris seul.',
      'Le gain a fait bouger les noirs : regarde le bas de la parade, puis refais la balance des noirs.',
    ] });
    function tick() {
      clearTimeout(timer); const now = performance.now();
      if (busy && now >= busy) { busy = 0; st.gAbb = st.gain; if (defis[1]) st.abb2 = true; msg = 'ABB: OK'; msgT = now + 2500; }
      up();
      if (busy || (msg && now < msgT)) timer = window.setTimeout(tick, 150); else if (msg) { msg = ''; up(); }
    }
    function olivier(o, w, gmin) {
      const stops = 2 * Math.log2(o.N / st.N1);
      if (defis[2]) return `Les trois noirs sont revenus à zéro. Le bruit, lui, est resté : à ${dB(st.gain)}, le rapport signal sur bruit tombe à ${snrAt(st.gain)} dB au lieu de 60. Le gain se paie toujours en bruit ; seule la lumière est gratuite.`;
      if (defis[1]) return busy ? 'Iris fermé, la caméra mesure ses trois noirs.' : 'Les noirs ont monté avec le gain, et pas autant dans les trois voies : le rouge et le bleu sont au-dessus du vert. Pousse BLK.';
      if (defis[0]) {
        if (st.gain !== st.g1 + 6) return `Le blanc est à ${fr(st.w1, 0)} % avec ${dB(st.g1)}. Passe à ${dB(st.g1 + 6)}, puis ferme l'iris pour retrouver ${fr(st.w1, 0)} %.`;
        if (w >= 99.6) return 'Écrêté : 6 dB de plus, c\'est deux fois plus de signal. Ferme l\'iris.';
        return `Iris fermé de ${fr(stops, 2)} diaphragme : continue jusqu'à retrouver ${fr(st.w1, 0)} % (tu es à ${fr(w, 0)} %).`;
      }
      if (o.N > maxAperture(o.f) + 0.05) return 'Ouvre l\'iris en grand d\'abord : la lumière avant le gain.';
      if (w >= 99.6) return 'Écrêté : trop de gain.';
      if (w < 80) return `Le blanc est à ${fr(w, 0)} % : trop sombre. À 0 dB, il faudrait f/${fr(nAt0dB(LUX), 1)}, que l'objectif n'a pas. Monte le gain.`;
      if (gmin != null && st.gain > gmin) return `Exposé, mais ${dB(gmin)} suffisent à f/1,8 : chaque dB de trop ajoute du bruit.`;
      return 'Exposé.';
    }
    function up() {
      const o = rings.read(); rings.show();
      const lin = whiteLin({ lux: LUX, N: o.N, gain: st.gain }), w = videoPct(lin);
      const G = dbGain(st.gain), black = /** @type {[number, number, number]} */ (DRIFT.map((k) => k * (G - dbGain(st.gAbb))));
      const gmin = minGain(LUX, maxAperture(o.f));
      if (!defis[0] && !busy && okPct(w) && st.gain === gmin && o.N <= maxAperture(o.f) + 0.05) { defis[0] = true; Object.assign(st, { g1: st.gain, w1: w, N1: o.N, abb2: false }); }
      if (defis[0] && !defis[1] && st.gain === st.g1 + 6 && okPct(w) && Math.abs(w - st.w1) < 4) defis[1] = true;
      if (defis[1] && !defis[2] && st.abb2 && st.gAbb === st.gain) defis[2] = true;
      read.textContent = `${LUX} lux · ${irisLabel(o.N, o.Nset)} · gain ${dB(st.gain)} (×${fr(G, 2)}, ${sgn(stopsOfDb(st.gain), 1)} diaph.) · blanc ${fr(w, 0)} % · S/N ≈ ${snrAt(st.gain)} dB · sensibilité de la FB80 : f/13 à 2000 lux, ici f/${fr(nAt0dB(LUX), 1)} à 0 dB`;
      sh.done(defis); sh.say(olivier(o, w, gmin));
      const E = busy ? 0 : lin / MIRE_WHITE;
      vf.draw({ f: o.f, dF: o.dF, N: o.N, E, gain: st.gain, black, noise: NOISE0 * G, msg: busy ? 'ABB: EXECUTING' : msg && performance.now() < msgT ? msg : '' });
      send(ctx, lensState(st, o, { gain: st.gain, light: light3d(E, o.N, 1, st.gain) }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { n: irisPos(1.8), gain: 0, gAbb: 0, g1: 0, w1: 0, N1: 1.8, abb2: false }); busy = 0; msg = ''; gS.mark(0); rings.sync(); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => { clearTimeout(timer); vf.dispose(); } };
  },

  // =================================================================================
  /** l'obturateur électronique : flou de bouger, saccade, clear scan, lampes à 100 Hz */
  shutter(ctx) {
    const W = 640, H = 360, V = 5, WIDTH_M = 4, VPX = V / WIDTH_M * W, R = 0.11 / WIDTH_M * W, BY = H * 0.78, LUX = 700;
    const SCN = [
      { nom: 'Le ballon roule à 5 m/s' },
      { nom: 'L\'écran du décor est rafraîchi à 60 Hz', screen: { F: 60, d: 0.5 } },
      { nom: 'Les lampes LED du plateau, sur le secteur 50 Hz : leur lumière vibre à 100 Hz', lamps: { F: 100, m: 0.5 } },
    ];
    const st = { z: zoomPos(12), s: pointPos(4), n: irisPos(8), nd: 1, mode: 'OFF', ecs: 50, k: 0 };
    const defis = [false, false, false];
    const view = cnv(W, H); view.className = 'cl-vfc'; view.setAttribute('role', 'img'); view.setAttribute('aria-label', 'Le viseur : le plateau, un écran du décor, une charte blanche et un ballon qui roule');
    const chrono = cnv(W, 120); chrono.className = 'c23-strip'; chrono.setAttribute('role', 'img'); chrono.setAttribute('aria-label', 'Quatre images de suite : la part de chaque image pendant laquelle le capteur reçoit la lumière, la trace du ballon, et la lumière qui vibre');
    const g = view.getContext('2d'), gc = chrono.getContext('2d');
    const rings = lensRings(st, () => up(), ['iris']);
    const shS = seg('SHUTTER', [...SHUTTERS_50.map(([l]) => [l, l]), ['ECS', 'ECS']], 'OFF', (v) => { st.mode = String(v); ecsRow.hidden = st.mode !== 'ECS'; up(); });
    const ecs = slider('ECS (clear scan)', 50, 200, 0.1, st.ecs, (v) => { st.ecs = v; up(); });
    const ecsRow = ecs.row; ecsRow.hidden = true;
    const read = readout();
    const sh = shell({ vf: { canvas: view }, scope: chrono, ctrls: [shS.row, ecsRow, ...rings.rows, read], defis: [
      'Le ballon roule à 5 m/s et laisse une traînée : rends-le net (moins de 2 cm de flou), et rattrape la lumière à l\'iris.',
      'Un écran du décor est rafraîchi à 60 Hz : des bandes sombres défilent. Fais-les disparaître avec le clear scan.',
      'Les lampes LED du plateau vibrent à 100 Hz : trouve un temps de pose deux fois plus court que 1/50 qui ne scintille pas, et expose juste.',
    ] });
    const teNow = () => (st.mode === 'ECS' ? 1 / st.ecs : (SHUTTERS_50.find((x) => x[0] === st.mode) || SHUTTERS_50[0])[1]);
    // ---- le plateau, une fois pour toutes, en lumière linéaire ----
    const bg = cnv(W, H), b = bg.getContext('2d');
    const wall = b.createLinearGradient(0, 0, 0, H * 0.66); wall.addColorStop(0, '#3a3f46'); wall.addColorStop(1, '#2a2e33'); b.fillStyle = wall; b.fillRect(0, 0, W, H * 0.66);
    b.fillStyle = '#4a4036'; b.fillRect(0, H * 0.66, W, H * 0.34);
    b.strokeStyle = '#5a4e42'; b.lineWidth = 2; for (let i = -6; i <= 6; i++) { b.beginPath(); b.moveTo(W / 2 + i * 40, H * 0.66); b.lineTo(W / 2 + i * 140, H); b.stroke(); }
    b.fillStyle = '#ececec'; b.fillRect(40, 60, 110, 80); for (let i = 0; i < 5; i++) { const v = Math.round(236 * Math.pow(1 - i / 5, 1.2)); b.fillStyle = `rgb(${v},${v},${v})`; b.fillRect(40 + i * 22, 140, 22, 22); }
    b.fillStyle = '#9aa3a8'; b.font = '600 12px "Archivo", sans-serif'; b.textAlign = 'center'; b.fillText('charte : le blanc', 95, 180);
    b.fillStyle = '#111316'; b.fillRect(352, 36, 256, 152);
    const scr = cnv(W, H), sc2 = scr.getContext('2d');
    const sg = sc2.createLinearGradient(362, 46, 598, 178); sg.addColorStop(0, '#1d5fd0'); sg.addColorStop(1, '#0b2a70'); sc2.fillStyle = sg; sc2.fillRect(362, 46, 236, 132);
    sc2.fillStyle = '#f0a020'; sc2.fillRect(380, 120, 120, 34); sc2.fillStyle = '#ffffff'; sc2.font = '700 26px "Archivo", sans-serif'; sc2.textAlign = 'left'; sc2.fillText('DIRECT', 386, 147);
    sc2.fillStyle = '#d8e4ff'; sc2.font = '600 16px "Archivo", sans-serif'; sc2.fillText('TIEE · plateau', 380, 80);
    const bgD = b.getImageData(0, 0, W, H).data, scD = sc2.getImageData(0, 0, W, H).data;
    const LR = new Float32Array(W * H), LG = new Float32Array(W * H), LB = new Float32Array(W * H), SR = new Float32Array(W * H), SG = new Float32Array(W * H), SB = new Float32Array(W * H), MASK = new Uint8Array(W * H);
    for (let i = 0, q = 0; i < W * H; i++, q += 4) {
      LR[i] = decode(bgD[q]); LG[i] = decode(bgD[q + 1]); LB[i] = decode(bgD[q + 2]);
      if (scD[q + 3] > 0) { MASK[i] = 1; SR[i] = decode(scD[q]); SG[i] = decode(scD[q + 1]); SB[i] = decode(scD[q + 2]); }
    }
    const WREF = decode(236);
    const id = g.createImageData(W, H), lampF = new Float32Array(H), scrF = new Float32Array(H);
    const ballX = (t) => ((VPX * t) % (W + 4 * R)) - 2 * R;
    function frame(n) {
      const scn = SCN[st.k], te = teNow(), t0 = n / 50, o = rings.read();
      const k = isFinite(o.N) ? whiteLin({ lux: LUX, N: o.N, te }) / WREF : 0;
      for (let y = 0; y < H; y++) {
        const ta = t0 + y / H / 50; // capteur CMOS : chaque ligne commence un peu après la précédente
        lampF[y] = scn.lamps ? 1 + scn.lamps.m * sinc(scn.lamps.F * te) * Math.cos(2 * Math.PI * scn.lamps.F * (ta + te / 2)) : 1;
        scrF[y] = scn.screen ? pwmMean(scn.screen.F, scn.screen.d, ta, te) / scn.screen.d : 0.004;
      }
      const d = id.data;
      for (let y = 0, i = 0, q = 0; y < H; y++) {
        const lf = lampF[y], sf = scrF[y], dy = y - BY, hc = Math.abs(dy) < R ? Math.sqrt(R * R - dy * dy) : -1;
        const xa = ballX(t0 + y / H / 50), xb = xa + VPX * te, len = xb - xa;
        for (let x = 0; x < W; x++, i++, q += 4) {
          let r, gg, bb;
          if (MASK[i]) { r = SR[i] * sf; gg = SG[i] * sf; bb = SB[i] * sf; } else { r = LR[i] * lf; gg = LG[i] * lf; bb = LB[i] * lf; }
          if (hc >= 0) {
            const ov = Math.min(xb, x + hc) - Math.max(xa, x - hc);
            const cov = len > 1e-3 ? clamp(ov / len, 0, 1) : (Math.abs(x - xa) <= hc ? 1 : 0);
            if (cov > 0) { const bl = 0.62 * lf; r = r * (1 - cov) + bl * cov; gg = gg * (1 - cov) + bl * cov; bb = bb * (1 - cov) + bl * 0.96 * cov; }
          }
          d[q] = enc8(r * k); d[q + 1] = enc8(gg * k); d[q + 2] = enc8(bb * k); d[q + 3] = 255;
        }
      }
      g.putImageData(id, 0, 0);
      g.font = '600 15px "B612 Mono", monospace'; g.fillStyle = 'rgba(240,240,232,.92)'; g.textAlign = 'left'; g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 3;
      g.fillText(st.mode === 'ECS' ? `ECS ${fr(st.ecs, 1)}Hz` : st.mode === 'OFF' ? 'SHUTTER OFF' : `SS ${st.mode}`, 12, 22); g.fillText(isFinite(o.N) ? `F${fr(o.N, 1)}` : 'C', 12, 42); g.shadowBlur = 0;
    }
    function drawChrono() {
      const scn = SCN[st.k], te = teNow(), Wc = W, x0 = 30, px = (Wc - 50) / 4, ratio = Math.min(1, te * 50);
      gc.fillStyle = '#05070a'; gc.fillRect(0, 0, Wc, 120);
      gc.font = '600 10.5px "B612 Mono", monospace'; gc.textAlign = 'center';
      for (let i = 0; i <= 4; i++) { const x = x0 + i * px; gc.strokeStyle = 'rgba(150,210,180,.25)'; gc.beginPath(); gc.moveTo(x + 0.5, 8); gc.lineTo(x + 0.5, 104); gc.stroke(); gc.fillStyle = '#9aa3a8'; gc.fillText(`${i * 20} ms`, x, 116); }
      // la lumière qui vibre, sur 80 ms
      if (scn.lamps || scn.screen) {
        gc.strokeStyle = '#ffb020'; gc.lineWidth = 1.5; gc.beginPath();
        for (let x = 0; x <= 4 * px; x++) { const t = x / px / 50; const v = scn.lamps ? 1 + scn.lamps.m * Math.cos(2 * Math.PI * scn.lamps.F * t) : ((t * scn.screen.F) % 1 < scn.screen.d ? 1.5 : 0.5); const y = 40 - v * 14; if (!x) gc.moveTo(x0 + x, y); else gc.lineTo(x0 + x, y); }
        gc.stroke(); gc.fillStyle = '#ffb020'; gc.textAlign = 'left'; gc.fillText(scn.lamps ? 'les lampes : 100 Hz' : 'l\'écran : 60 Hz', x0 + 4, 12);
      }
      // les fenêtres d'exposition (la ligne du haut) et la trace du ballon
      for (let i = 0; i < 4; i++) {
        const x = x0 + i * px;
        gc.fillStyle = 'rgba(76,195,230,.28)'; gc.fillRect(x + 1, 46, Math.max(2, px * ratio - 2), 16);
        gc.fillStyle = '#e8e8e2'; gc.fillRect(x + 1, 74, Math.max(4, px * ratio - 2), 14);
      }
      gc.fillStyle = '#4cc3e6'; gc.textAlign = 'left'; gc.fillText('le capteur reçoit la lumière', x0 + 4, 58);
      gc.fillStyle = '#9aa3a8'; gc.fillText(ratio > 0.99 ? 'la trace du ballon : continue d\'une image à l\'autre' : `la trace du ballon : des trous de ${fr((1 / 50 - te) * 1000, 1)} ms entre deux images`, x0 + 4, 100);
    }
    function up() {
      const o = rings.read(); rings.show();
      const te = teNow();
      const w = isFinite(o.N) ? videoPct(whiteLin({ lux: LUX, N: o.N, te })) : 0, blurCm = V * te * 100;
      const bands = bandContrast(60, 0.5, te), fl = flicker(100, te, 0.5);
      if (!defis[st.k]) {
        const good = st.k === 0 ? blurCm <= 2.0001 && okPct(w) : st.k === 1 ? st.mode === 'ECS' && bands < 0.03 : fl < 0.03 && te <= 1 / 90 && okPct(w);
        if (good) { defis[st.k] = true; if (st.k < 2) st.k++; }
      }
      const s2 = SCN[st.k];
      const stops = Math.log2(te * 50);
      ecs.out.textContent = fr(st.ecs, 1) + ' Hz';
      read.textContent = `${s2.nom} · temps de pose ${msLabel(te)} (angle ${fr(shutterAngle(te), 0)}°), ${sgn(stops, 1)} diaph. par rapport à 1/50 · flou du ballon ${fr(V * te * 100, 1)} cm · blanc ${fr(w, 0)} %${s2.screen ? ` · bandes de l'écran ${pct(bandContrast(60, 0.5, te))}` : ''}${s2.lamps ? ` · scintillement ${pct(flicker(100, te, 0.5))}` : ''}`;
      sh.done(defis); sh.say(olivier(o, te, w));
      drawChrono();
      if (!raf) frame(n);
      send(ctx, lensState(st, o, { light: light3d(isFinite(o.N) ? whiteLin({ lux: LUX, N: o.N, te }) / MIRE_WHITE : 0, o.N) }));
    }
    function olivier(o, te, w) {
      const scn = SCN[st.k];
      if (defis[2]) return `Clear scan à ${fr(st.ecs, 0)} Hz : ${msLabel(te)}, exactement ${fr(100 * te, 0)} vibration${100 * te >= 1.5 ? 's' : ''} des lampes par image, la même lumière sur toutes les lignes. Pour l'antenne, on revient à OFF : le mouvement le plus fluide, et aucun scintillement sous le secteur 50 Hz.`;
      if (st.k === 2) {
        if (te > 1 / 90) return 'Plus court : au moins deux fois plus court que 1/50, pour un ballon plus net.';
        const fl = flicker(100, te, 0.5);
        if (fl >= 0.03) return `${pct(fl)} de scintillement : ${fr(100 * te, 2)} vibration des lampes par image, ce n'est pas un nombre entier. Aucune vitesse fixe ne tombe juste : c'est un travail pour l'ECS.`;
        if (!okPct(w)) return 'Plus de scintillement. Rattrape la lumière à l\'iris.';
      }
      if (st.k === 1) {
        if (st.mode !== 'ECS') return 'L\'écran s\'allume et s\'éteint 60 fois par seconde ; la caméra en prend 50 images : chaque ligne reçoit un morceau différent de son cycle. Passe le shutter en ECS.';
        const b = bandContrast(60, 0.5, te);
        return b < 0.03 ? 'Plus de bandes.' : `ECS à ${fr(st.ecs, 1)} Hz : bandes à ${pct(b)}. Approche la fréquence de l'écran, au dixième de hertz : c'est quand le temps de pose vaut exactement une période de l'écran que les bandes s'arrêtent.`;
      }
      if (scn && st.k === 0) {
        const cm = V * te * 100;
        if (cm > 2.0001) return `À ${msLabel(te)}, le ballon avance de ${fr(cm, 1)} cm pendant que le capteur reçoit la lumière : c'est sa traînée. Raccourcis le temps de pose.`;
        if (w < 80) return `Net, mais ${fr(-Math.log2(te * 50), 1)} diaphragme de lumière en moins : ouvre l'iris.`;
        if (w >= 99.6) return 'Écrêté : ferme un peu l\'iris.';
      }
      return 'Regarde la bande du bas : entre deux images, il y a maintenant des trous. Le ballon net saute de place en place : c\'est la saccade.';
    }
    let raf = 0, last = 0, acc = 0, n = 0;
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!last) last = now; acc += Math.min(100, now - last); last = now;
      if (acc >= 20) { n += Math.floor(acc / 20); acc %= 20; frame(n); }
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { n: irisPos(8), mode: 'OFF', ecs: 50, k: 0 }); shS.mark('OFF'); ecs.set(50); ecsRow.hidden = true; rings.sync(); defis.fill(false); up(); })));
    up(); frame(0);
    raf = requestAnimationFrame(loop);
    return { node: sh.node, dispose: () => { cancelAnimationFrame(raf); raf = 0; } };
  },

  // =================================================================================
  /** l'exposition : iris, ND, gain, shutter, ce que chacun coûte, dans quel ordre */
  exposition(ctx) {
    const SCN = [
      { nom: 'Interview sur le plateau, 400 lux, serré à 54 mm', lux: 400, f: 54 },
      { nom: 'La même interview dehors, ciel couvert, 10 000 lux', lux: 10000, f: 54 },
      { nom: 'Le soir, dehors, sous les lampadaires : environ 15 lux, plan large à 20 mm', lux: 15, f: 20 },
    ];
    const st = { z: zoomPos(54), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, gain: 0, sh: 'OFF', k: 0 };
    const defis = [false, false, false];
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img));
    const rings = lensRings(st, () => up(), ['iris']);
    const ndS = seg('FILTER', ND.map(([nm, v]) => [v, nm.replace('ND', ' ND')]), 1, (v) => { st.nd = Number(v); up(); });
    const gS = seg('GAIN', GAINS.map((v) => [v, dB(v)]), 0, (v) => { st.gain = Number(v); up(); });
    const shS = seg('SHUTTER', SHUTTERS_50.map(([l]) => [l, l]), 'OFF', (v) => { st.sh = String(v); up(); });
    const LEV = [['lumiere', 'Lumière'], ['iris', 'Iris'], ['nd', 'ND'], ['gain', 'Gain'], ['shutter', 'Shutter']];
    /** @type {Record<string, { bar: HTMLElement, out: HTMLElement }>} */
    const rows = {};
    const bud = el('div', { class: 'c23-budget', role: 'img' });
    for (const [k, l] of [...LEV, ['total', 'Total']]) {
      const bar = el('i', {}), out = el('output', {});
      rows[k] = { bar, out };
      bud.append(el('div', { class: 'c23-brow' + (k === 'total' ? ' tot' : '') }, el('span', {}, l), el('b', {}, bar), out));
    }
    const prix = el('ul', { class: 'c23-prix' });
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [...rings.rows, ndS.row, gS.row, shS.row, el('p', { class: 'cl-hint' }, 'Le budget en diaphragmes, par rapport à la sensibilité de la FB80 (f/13 à 2000 lux, sans filtre, 0 dB, 1/50 s) : le total doit tomber juste sous zéro.'), bud, prix, read], defis: [
      'Interview sur le plateau à 400 lux : le réalisateur veut le fond flou (moins de 40 cm de zone nette), sans bruit ni saccade. Expose juste.',
      'La même interview dehors, sous un ciel couvert à 10 000 lux : le même fond flou, toujours sans bruit ni saccade.',
      'Le soir, sous les lampadaires (environ 15 lux) : expose juste avec le moins de bruit possible, sans saccade.',
    ] });
    const teOf = () => (SHUTTERS_50.find((x) => x[0] === st.sh) || SHUTTERS_50[0])[1];
    function prices(o, scn, te, dof) {
      const items = [
        ['Iris', `${irisLabel(o.N, o.Nset)} : zone nette ${dof < 10 ? fr(dof * 100, 0) + ' cm' : 'jusqu\'à l\'infini'} à 3 m${o.N >= 11 ? ' ; la diffraction adoucit l\'image' : o.N <= maxAperture(scn.f) + 0.05 ? ' ; grand ouvert, plus de marge' : ''}.`],
        ['ND', `${ndName(st.nd)} : ${st.nd < 1 ? `${sgn(Math.log2(st.nd), 0)} diaph., aucun prix sur l'image ; la roue tourne, on ne la change pas à l'antenne.` : 'pas de filtre.'}`],
        ['Gain', `${dB(st.gain)} : S/N ≈ ${snrAt(st.gain)} dB${st.gain > 0 ? `, le bruit est multiplié par ${fr(dbGain(st.gain), 1)}` : st.gain < 0 ? ', un peu moins de bruit' : ''}.`],
        ['Shutter', st.sh === 'OFF' ? 'OFF (1/50 s) : le mouvement le plus fluide, pas de scintillement sous le secteur 50 Hz.' : `${st.sh} : ${sgn(Math.log2(te * 50), 1)} diaph., le mouvement saccade et les lampes à 100 Hz peuvent scintiller.`],
      ];
      prix.replaceChildren(...items.map(([a, t]) => el('li', {}, el('b', {}, a), ' ', t)));
    }
    function up() {
      let scn = SCN[st.k];
      const o0 = rings.read(); rings.show();
      const te = teOf();
      const check = (o, sc0) => {
        const lin = isFinite(o.N) ? whiteLin({ lux: sc0.lux, N: o.N, gain: st.gain, nd: st.nd, te }) : 0, w = videoPct(lin);
        const [a, b] = isFinite(o.N) ? dofLimits(sc0.f, o.N, MIRE_D) : [0, Infinity];
        return { lin, w, dof: b - a };
      };
      let c = check(o0, scn);
      if (!defis[st.k]) {
        const gmin = minGain(scn.lux, maxAperture(scn.f));
        const good = st.k < 2 ? okPct(c.w) && c.dof < 0.4 && st.gain <= 0 && st.sh === 'OFF' : okPct(c.w) && st.sh === 'OFF' && gmin != null && st.gain <= gmin;
        if (good) {
          defis[st.k] = true;
          if (st.k < 2) { st.k++; scn = SCN[st.k]; st.z = zoomPos(scn.f); }
        }
      }
      const o = rings.read(); rings.show(); c = check(o, scn);
      const B = isFinite(o.N) ? budget({ lux: scn.lux, N: o.N, nd: st.nd, gain: st.gain, te }) : null;
      const vals = B ? { ...B, total: Object.values(B).reduce((s, v) => s + v, 0) } : null;
      for (const [k] of [...LEV, ['total']]) {
        const v = vals ? vals[k] : 0, wpc = Math.min(50, Math.abs(v) / 8 * 50);
        rows[k].bar.style.width = wpc + '%'; rows[k].bar.style.left = v >= 0 ? '50%' : (50 - wpc) + '%'; rows[k].bar.className = v >= 0 ? 'pos' : 'neg';
        rows[k].out.textContent = sgn(v, 1);
      }
      bud.setAttribute('aria-label', vals ? `Budget en diaphragmes : lumière ${sgn(vals.lumiere, 1)}, iris ${sgn(vals.iris, 1)}, ND ${sgn(vals.nd, 1)}, gain ${sgn(vals.gain, 1)}, shutter ${sgn(vals.shutter, 1)}, total ${sgn(vals.total, 1)}` : 'Iris fermé');
      prices(o, scn, te, c.dof);
      read.textContent = `${scn.nom} · blanc ${fr(c.w, 0)} % · zone nette ${c.dof < 10 ? fr(c.dof * 100, 0) + ' cm' : '∞'}`;
      sh.done(defis); sh.say(olivier(o, scn, c));
      vf.draw({ f: scn.f, dF: o.dF, N: o.N, E: c.lin / MIRE_WHITE, nd: st.nd, gain: st.gain, noise: 0.002 * dbGain(st.gain) });
      send(ctx, lensState(st, o, { gain: st.gain, light: light3d(c.lin / MIRE_WHITE, o.N, st.nd, st.gain) }));
    }
    function olivier(o, scn, c) {
      if (defis[2]) return 'L\'ordre : 1. l\'iris pour l\'image voulue (le fond flou, la profondeur de champ) ; 2. le ND pour la lumière en trop ; 3. le gain, et seulement lui, pour la lumière qui manque ; le shutter sert au mouvement et aux écrans, pas à l\'exposition.';
      if (st.sh !== 'OFF') return 'Le shutter n\'est pas un réglage d\'exposition : il coûte la fluidité du mouvement. Laisse-le sur OFF.';
      if (st.k < 2) {
        if (c.dof >= 0.4) return `Zone nette ${fr(c.dof * 100, 0)} cm : trop pour un fond flou. Ouvre l'iris (f/5,6 ou moins à 54 mm).`;
        if (st.gain > 0) return 'Du gain alors qu\'il y a assez de lumière : du bruit pour rien.';
        if (c.w >= 99.6) return st.k === 1 ? 'Écrêté : dehors, il y a vingt-cinq fois plus de lumière que sur le plateau, presque cinq diaphragmes. Le ND d\'abord, sans toucher à l\'iris choisi.' : 'Écrêté : l\'iris est à la bonne ouverture pour le flou, c\'est la lumière qui est en trop. Un ND, ou −3 dB.';
        if (c.w < 80) return 'Trop sombre : un ND plus clair, ou rouvre un peu l\'iris.';
      } else {
        const gmin = minGain(scn.lux, maxAperture(scn.f));
        if (st.nd < 1) return 'Un ND la nuit : il retire la lumière qui manque. FILTER sur CLEAR.';
        if (o.N > maxAperture(scn.f) + 0.05 && c.w < 80) return 'Ouvre l\'iris en grand avant de monter le gain : à 20 mm, la profondeur de champ reste confortable.';
        if (c.w < 80) return `Trop sombre, iris grand ouvert : il manque ${fr(-Math.log2(c.lin / 0.75), 1)} diaphragme. Le gain, maintenant : ${dB(gmin)} suffisent.`;
        if (gmin != null && st.gain > gmin) return `Exposé, mais ${dB(gmin)} suffisent iris grand ouvert : moins de gain, moins de bruit.`;
      }
      return 'Exposé.';
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { z: zoomPos(54), n: irisPos(5.6), nd: 1, gain: 0, sh: 'OFF', k: 0 }); ndS.mark(1); gS.mark(0); shS.mark('OFF'); rings.sync(); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** formats et cadences : le peigne de l'entrelacé, le PsF, la liaison SDI de chaque format */
  formats(ctx) {
    const W = 640, H = 360, LOUPE = 6;
    const st = { fmt: '1080/50i', sdi: '3G', freeze: false, loupe: false, seenP: false, seenPsF: false, okSdi: {} };
    const defis = [false, false, false];
    const view = cnv(W, H); view.className = 'cl-vfc'; view.setAttribute('role', 'img'); view.setAttribute('aria-label', 'L\'image de la caméra dans le format choisi : un ballon qui traverse la pelouse');
    const g = view.getContext('2d');
    const fS = seg('OUTPUT FORMAT', Object.keys(FORMATS_FB80).map((k) => [k, k]), st.fmt, (v) => { st.fmt = String(v); up(); });
    const sS = seg('Liaison SDI', SDI.map(([k, nm, gb]) => [k, `${nm} ${fr(gb, gb < 2 ? 3 : 2)} Gb/s`]), st.sdi, (v) => { st.sdi = String(v); if (st.sdi === sdiFor(FORMATS_FB80[st.fmt])) st.okSdi[st.fmt] = true; up(); });
    const frz = toggle('Arrêt sur image', false, (v) => { st.freeze = v; up(); });
    const lp = toggle(`Loupe ×${LOUPE} sur le ballon`, false, (v) => { st.loupe = v; up(); });
    const read = readout();
    const sh = shell({ vf: { canvas: view }, ctrls: [fS.row, btnRow(frz.btn, lp.btn), sS.row, el('p', { class: 'cl-hint' }, 'Obturateur court dans la maquette, pour que le ballon reste net et que le peigne se voie bien.'), read], defis: [
      'En 1080/50i, fige l\'image et prends la loupe : le ballon a des dents de peigne.',
      'Trouve les deux formats en 1 080 lignes dont l\'image figée n\'a pas de peigne : l\'un à 50 images par seconde, l\'autre à 25 images envoyées en deux segments.',
      'Pour chacun des quatre formats, choisis la plus petite liaison SDI qui suffit.',
    ] });
    // ---- la pelouse et le ballon, en coordonnées 1920 × 1080, calculés point par point ----
    const BXV = 1280, BR = 46, BYC = 640; // 4 m/s pour 6 m de champ ; rayon 11 cm
    const bx = (t) => ((t * BXV) % 2300) - 190;
    function sample(sx, sy, t) {
      const x = bx(t), dx = sx - x, dy = sy - BYC;
      if (dx * dx + dy * dy < BR * BR) { if (Math.abs(dy) < 5 || (dx - 12) ** 2 + (dy + 20) ** 2 < 140) return 40; return 236; }
      if (Math.abs(sy - 930) < 5 || Math.abs(sx - 1386) < 6) return 228;
      return -1 - (Math.floor(sx / 160) & 1);
    }
    let t = 0, raf = 0, last = 0, shown = -1;
    const imageIndex = (F) => Math.floor(t * F.images + 1e-9);
    function draw() {
      const F = FORMATS_FB80[st.fmt], idx = imageIndex(F), tI = idx / F.images;
      const d = g.createImageData(W, H), px = d.data;
      const cx = clamp(bx(tI), 160, 1760), cy = BYC;
      for (let y = 0, q = 0; y < H; y++) {
        const fy = st.loupe ? cy - 90 + y * (180 / H) : y * (1080 / H);
        const Y = Math.floor(fy * F.h / 1080), sy = (Y + 0.5) * 1080 / F.h, tl = tI + (F.scan === 'i' && (Y & 1) ? 0.02 : 0);
        for (let x = 0; x < W; x++, q += 4) {
          const fx = st.loupe ? cx - 160 + x * (320 / W) : x * (1920 / W);
          const X = Math.floor(fx * F.w / 1920), sx = (X + 0.5) * 1920 / F.w;
          const v = Y < 0 || Y >= F.h ? 0 : sample(sx, sy, tl);
          if (v >= 0) { px[q] = px[q + 1] = px[q + 2] = v; } else if (v === -1) { px[q] = 52; px[q + 1] = 118; px[q + 2] = 58; } else { px[q] = 44; px[q + 1] = 104; px[q + 2] = 50; }
          px[q + 3] = 255;
        }
      }
      g.putImageData(d, 0, 0);
      g.font = '600 15px "B612 Mono", monospace'; g.fillStyle = 'rgba(240,240,232,.94)'; g.shadowColor = 'rgba(0,0,0,.8)'; g.shadowBlur = 3; g.textAlign = 'left';
      g.fillText(st.fmt + (st.loupe ? `  ×${LOUPE}` : ''), 12, 22);
      if (F.scan === 'i') g.fillText('lignes paires : t   lignes impaires : t + 20 ms', 12, 42);
      else if (F.scan === 'psf') g.fillText('une image prise d\'un coup, envoyée en 2 segments', 12, 42);
      if (st.freeze) { g.fillStyle = '#ffb020'; g.textAlign = 'right'; g.fillText('ARRÊT SUR IMAGE', W - 12, 22); }
      g.shadowBlur = 0; shown = idx;
    }
    function loop(now) {
      raf = requestAnimationFrame(loop);
      if (!last) last = now; const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (st.freeze) return;
      t += dt; const F = FORMATS_FB80[st.fmt];
      if (imageIndex(F) !== shown) draw();
    }
    function up() {
      const F = FORMATS_FB80[st.fmt], gb = sdiGbps(F), need = sdiFor(F), link = SDI.find((s) => s[0] === st.sdi);
      if (!defis[0] && st.fmt === '1080/50i' && st.freeze && st.loupe) defis[0] = true;
      if (st.freeze && st.fmt === '1080/50P') st.seenP = true;
      if (st.freeze && st.fmt === '1080/25PsF') st.seenPsF = true;
      if (!defis[1] && st.seenP && st.seenPsF) defis[1] = true;
      if (!defis[2] && Object.keys(FORMATS_FB80).every((k) => st.okSdi[k])) defis[2] = true;
      const desc = F.scan === 'i' ? `${F.images} images par seconde, chacune en deux trames de ${F.h / 2} lignes prises à 20 ms d'écart` : F.scan === 'psf' ? `${F.images} images par seconde prises d'un coup, chacune envoyée en deux segments comme un entrelacé` : `${F.images} images entières par seconde`;
      read.textContent = `${st.fmt} : ${F.w} × ${F.h} pixels, ${desc} · ${fr(pixelsPerSecond(F) / 1e6, 1)} millions de pixels par seconde · raster ${F.tot} × ${F.lines} × ${F.images} × 20 bits = ${fr(gb, 3)} Gb/s → ${link[1]} ${gb <= link[2] + 1e-6 ? (need === link[0] ? 'suffit, et c\'est la plus petite' : 'suffit, mais une plus petite suffirait') : `ne suffit pas (${fr(link[2], 3)} Gb/s)`}`;
      sh.done(defis); sh.say(olivier(F, need));
      draw();
      send(ctx, {});
    }
    function olivier(F, need) {
      const done = Object.keys(FORMATS_FB80).filter((k) => st.okSdi[k]).length;
      if (defis[2] && defis[1] && defis[0]) return 'Le 1080/50P a besoin du 3G-SDI : deux fois plus d\'images que le 1080/50i, deux fois plus de débit. Le 720/50P a autant d\'images, mais 2,25 fois moins de pixels par image : il tient dans le HD-SDI.';
      if (!defis[0]) return st.fmt !== '1080/50i' ? 'Reviens en 1080/50i pour le premier défi.' : !st.freeze ? 'Fige l\'image pendant que le ballon traverse.' : 'Prends la loupe : les lignes paires et impaires ne montrent pas le ballon au même endroit.';
      if (!defis[1]) return F.scan === 'i' ? 'Les deux trames ont 20 ms d\'écart : en 20 ms, le ballon a fait 8 cm. Essaie les autres formats en 1 080 lignes.' : st.freeze ? (F.scan === 'psf' ? 'En PsF, l\'image est prise d\'un coup puis coupée en deux pour le transport : pas de peigne. Mais seulement 25 images par seconde : le mouvement saute davantage.' : 'Pas de peigne : chaque image est prise d\'un coup.') : 'Fige l\'image pour comparer.';
      if (st.okSdi[st.fmt]) return `${st.fmt} : ${need === 'HD' ? 'le HD-SDI suffit' : 'il faut le 3G-SDI'}, c'est réglé. ${done} format${done > 1 ? 's' : ''} sur quatre : passe au suivant.`;
      return `${done} format${done > 1 ? 's' : ''} sur quatre réglé${done > 1 ? 's' : ''}. Calcule le débit du raster complet : ${FORMATS_FB80[st.fmt].tot} × ${FORMATS_FB80[st.fmt].lines} × ${FORMATS_FB80[st.fmt].images} images × 20 bits. Choisis la liaison après le format.`;
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { fmt: '1080/50i', sdi: '3G', freeze: false, loupe: false, seenP: false, seenPsF: false, okSdi: {} }); fS.mark('1080/50i'); sS.mark('3G'); frz.set(false); lp.set(false); defis.fill(false); up(); })));
    up();
    raf = requestAnimationFrame(loop);
    return { node: sh.node, dispose: () => { cancelAnimationFrame(raf); raf = 0; } };
  },
};
