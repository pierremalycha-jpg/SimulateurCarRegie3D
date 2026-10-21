// @ts-check
import { el, clamp } from '../../util.js';
import { MIRE_D, ND, zoomPos, exposureOf, fr, castOf, fieldHeight, sharp } from '../optics.js';
import { makeViewfinder, whiteLevels, drawScope, cnv } from '../vf.js';
import { slider, seg, toggle, btnRow, linkBtn, lensRings, lensState, shell, scopeCanvas, irisPos, pointPos } from '../controls.js';

// ----------------------------------------------------------------------------------
// Manipulations des chapitres 5 et 6 (le corps de la caméra, le viseur et le cadreur) : les
// commandes du corps et ce que le RCP reprend, l'alimentation et son budget, le tally, le CALL et
// l'intercom, les retours vidéo et le MIX VF, le viseur et ses aides, l'équilibrage sur la tête.
// Chacune reçoit ctx = { lens(état) } et renvoie { node, dispose } (voir ../labs.js).
//
// Les chiffres viennent du mode d'emploi et de la fiche technique Sony HXC-FB80 et HXCU-FB80 :
//   · GAIN L, M, H = 0, 6 et 12 dB d'usine (GAIN, page SWITCH ASSIGN1), de −6 à +12 dB par pas de 3 ;
//     reliée à une CCU ou à un RCP, SHUTTER, WHT/BLK, OUTPUT/AUTO KNEE, WHITE BAL, GAIN et FILTER
//     sont commandés par l'appareil relié, les commutateurs de la caméra ne font plus rien ;
//     ASSIGN 1 à 3 : sans fonction d'usine, ASSIGNABLE 1/2/3 de la page SWITCH ASSIGN1 ;
//   · consommation ≈ 19 W (corps seul), ≈ 32 W avec le viseur fourni ; DC IN (XLR 4) 10,5 à 17 V,
//     5,4 A au plus ; DC OUT 1,5 A au plus ; alimentation par la fibre hybride CCFN jusqu'à 600 m
//     (objectif portable, HXCU-FB80), fibre monomode (LC) jusqu'à 10 km avec alimentation locale ;
//   · tally : le voyant du corps (commutateur TALLY ON) ne s'allume qu'en rouge, et aussi au CALL ;
//     CALL allume le tally rouge de la CCU et du RCP ; viseur : voyants R TALLY et G TALLY,
//     commutateur TALLY HIGH / LOW / OFF de la lampe ; INTERCOM MIC (PANEL TYPE CE) : PROD, OFF, ENG ;
//   · retours : RET 1 montre le retour 1 tant qu'on appuie ; RET2 SEL choisit le retour 2, 3 ou 4
//     de la touche qui a la fonction « retour 2 » ; page VF OUT : RET MIX VF, MIX VF MODE
//     (Y-MIX, WIRE (W), WIRE (B)), MIX VF LEVEL 0 à 80 % ; CCU, page RETURN SET : RET-1 à RET-4 ;
//   · viseur 7" 1920 × 1080 ; BRIGHT, CONTRAST et PEAKING ne changent pas la sortie ; zébras page
//     ZEBRA (70 % ± 5, 100 %) ; marqueurs page VF MARKER (zone de sécurité 80 à 95 %, centre) ;
//     extender numérique D.EXTENDER ×2 ou ×4, assignable à une touche ASSIGN, qui agrandit l'image.
// Les ordres de grandeur (objectif, lampe, viseur, prompteur, tête) sont signalés comme tels.
// ----------------------------------------------------------------------------------

const send = (ctx, s) => { if (ctx && ctx.lens) ctx.lens(s); };
const readout = () => el('p', { class: 'cl-read' });
const grp = (t) => el('p', { class: 'c56-grp' }, t);
const G = 9.81;
const W = 640, H = 360;

// =================================================================================
// Les calculs (exportés pour les tests)
// =================================================================================
export const FB80 = {
  gain: { L: 0, M: 6, H: 12 },
  remote: ['SHUTTER', 'WHT/BLK', 'OUTPUT/AUTO KNEE', 'WHITE BAL', 'GAIN', 'FILTER'],
  pBody: 19, pVf: 13, hybMax: 600, smfMax: 10000,
  dcIn: { vmin: 10.5, vmax: 17, imax: 5.4 }, dcOutMax: 1.5,
};

/** ce qui commande l'image : la caméra seule, ou le RCP quand elle est reliée à la CCU */
export function effective(mode, cam, rcp) {
  const s = mode === 'ccu' ? { gain: rcp.gain, filter: rcp.filter, bars: rcp.bars } : { gain: cam.gain, filter: cam.filter, bars: cam.output === 'BARS' };
  return { gainDb: FB80.gain[s.gain], nd: ND[s.filter - 1][1], ndName: ND[s.filter - 1][0], bars: s.bars, by: mode === 'ccu' ? 'rcp' : 'camera' };
}

/** ce que consomme la tête (W) : corps, viseur 7", objectif (ordre de grandeur), lampe sur DC OUT (ordre de grandeur) */
export const CHARGES = { corps: 19, viseur: 13, objectif: 5, lampe: 12 };
/** les sources possibles sur DC IN */
export const SOURCES = { aucune: null, secteur: { V: 12, Wh: Infinity, nom: 'bloc secteur 12 V' }, batterie: { V: 14.4, Wh: 95, nom: 'batterie 14,4 V de 95 Wh' } };
/**
 * Le budget d'énergie de la tête. link : 'hybride' (la CCU alimente par le cuivre du câble),
 * 'smf' (fibre monomode : pas d'énergie dans le câble) ou 'seule' (pas de CCU) ; L : longueur (m) ;
 * src : 'aucune', 'secteur' ou 'batterie' sur DC IN ; loads : viseur, objectif, lampe.
 */
export function powerBudget({ link, L, src, loads }) {
  const P = CHARGES.corps + (loads.viseur ? CHARGES.viseur : 0) + (loads.objectif ? CHARGES.objectif : 0) + (loads.lampe ? CHARGES.lampe : 0);
  const s = SOURCES[src] || null;
  const ccuOk = link === 'hybride' && L <= FB80.hybMax;
  const by = ccuOk ? 'ccu' : s ? 'dcin' : null;
  const V = by === 'dcin' ? s.V : 12;
  const I = by === 'dcin' ? P / V : 0;
  const iLamp = loads.lampe ? CHARGES.lampe / V : 0;
  const powered = by != null && I <= FB80.dcIn.imax && iLamp <= FB80.dcOutMax;
  // la liaison avec la CCU : hybride jusqu'à 600 m (au-delà, montage hors mode d'emploi), monomode jusqu'à 10 km
  const linkOk = link === 'seule' ? null : link === 'hybride' ? L <= FB80.hybMax : L <= FB80.smfMax;
  const hours = by === 'dcin' && isFinite(s.Wh) ? s.Wh / P : Infinity;
  return { P, by, V, I, iLamp, powered, linkOk, hours, spec: link !== 'hybride' || L <= FB80.hybMax };
}

/** le tally d'une caméra : à l'antenne (programme), prête (preview) ou rien */
export const tallyOf = (cam, pgm, pvw) => (pgm === cam ? 'pgm' : pvw === cam ? 'pvw' : 'off');
/** les voyants d'une tête : lampe du viseur (pour le plateau), R TALLY et G TALLY (pour le cadreur), voyant du corps */
export function lampsOf({ tally, call, rear, vfSw }) {
  const red = tally === 'pgm' || !!call;
  const green = !red && tally === 'pvw';
  return { front: vfSw !== 'OFF' && red, frontLevel: vfSw === 'HIGH' ? 1 : vfSw === 'LOW' ? 0.45 : 0, r: red, g: green, rear: rear === 'ON' && red };
}
/** qui entend le cadreur, selon le commutateur INTERCOM MIC */
export const HEARS = { PROD: 'la réalisation', ENG: 'la vision et la technique', OFF: null };

/** ce que montre le viseur pour un signal v (0 à 1) : BRIGHT décale, CONTRAST amplifie ; la sortie n'y voit rien */
export const vfShow = (v, bright, contrast) => clamp((v + bright) * contrast, 0, 1);
/** viseur réglé sur les barres : noir noir, +4 % visible, blanc lumineux mais pas écrêté */
export function barsOk(b, k) {
  const d0 = vfShow(0, b, k), d4 = vfShow(0.04, b, k), d1 = (1 + b) * k;
  return d0 <= 0.02 && d4 - d0 >= 0.025 && d1 >= 0.88 && d1 <= 1.02;
}

/** bas de la mire de 60 cm dans l'image (fraction de la hauteur) à la focale f */
export const mireBottom = (f) => 0.5 + 0.3 / fieldHeight(MIRE_D, f);
/** haut du titre incrusté, en fraction de la hauteur de l'image */
export const TITLE_TOP = 0.74;

/**
 * L'équilibrage sur la tête : masses (kg) et centres de gravité (m) dans le repère de la caméra
 * (X vers l'avant depuis la monture, Y vers le haut depuis l'axe optique). Corps 3,4 kg (fiche
 * Sony), objectif 2,07 kg (fiche Fujinon, version RD) ; viseur et prompteur : ordres de grandeur.
 */
export const MASSES = { corps: [3.4, -0.165, -0.025], objectif: [2.07, 0.11, 0], viseur: [1.4, -0.35, 0.25], prompteur: [5, 0.15, -0.06] };
/** l'axe d'inclinaison de la tête : sous la caméra, plaque au neutre à 10 cm derrière la monture, 21 cm sous l'axe optique */
export const AXE = { xn: -0.10, h: 0.21, cran: 2, hold: 0.6 };
/** plate (m, positif : caméra avancée), cb (couple du contrepoids, N·m), prompteur (oui ou non) */
export function balanceOf({ plate, cb, prompteur }) {
  const parts = Object.entries(MASSES).filter(([k]) => k !== 'prompteur' || prompteur).map(([, v]) => v);
  const m = parts.reduce((a, p) => a + p[0], 0);
  const xg = parts.reduce((a, p) => a + p[0] * p[1], 0) / m, yg = parts.reduce((a, p) => a + p[0] * p[2], 0) / m;
  const X = xg - AXE.xn + plate, Y = yg + AXE.h;
  // couple autour de l'axe (positif : vers le haut) à l'inclinaison th : le poids, puis les ressorts du contrepoids
  const tau = (th) => -m * G * X * Math.cos(th) + (m * G * Y - cb) * Math.sin(th);
  return { m, xg, yg, X, Y, need: m * G * Y, tau, plateOk: -(xg - AXE.xn) };
}

// =================================================================================
// Le viseur du cadreur : l'image de la caméra (vf.js), puis ce que le viseur y ajoute
// =================================================================================
/** luminance (0 à 255) d'une image */
function lumaOf(img) {
  const d = img.data, L = new Float32Array(W * H);
  for (let p = 0, i = 0; p < W * H; p++, i += 4) L[p] = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
  return L;
}
/** l'extender numérique : le centre de l'image agrandi k fois (la sortie aussi) */
function magnify(img, k) {
  const o = new ImageData(W, H), s = img.data, d = o.data;
  for (let y = 0; y < H; y++) {
    const sy = Math.min(H - 1, Math.floor(H / 2 + (y - H / 2) / k));
    for (let x = 0; x < W; x++) {
      const sx = Math.min(W - 1, Math.floor(W / 2 + (x - W / 2) / k)), i = (y * W + x) * 4, j = (sy * W + sx) * 4;
      d[i] = s[j]; d[i + 1] = s[j + 1]; d[i + 2] = s[j + 2]; d[i + 3] = 255;
    }
  }
  return o;
}
/** une image de retour prête pour le viseur : ses pixels, sa luminance, ses contours (modes WIRE) */
function retImage(img) {
  const luma = lumaOf(img), edge = new Uint8Array(W * H);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const p = y * W + x, gx = luma[p + 1] - luma[p - 1], gy = luma[p + W] - luma[p - W];
    if (gx * gx + gy * gy > 2500) edge[p] = 1;
  }
  return { img, luma, edge };
}
/** un plan d'une autre caméra du plateau, rendu une fois (même plateau, même mire) */
function renderShot(o, deco = null) {
  const v = makeViewfinder(W, H); v.now({ f: 20, dF: MIRE_D, N: 5.6, light: 0.5, osd: false, ...o });
  const c = cnv(W, H), g = c.getContext('2d'); g.putImageData(/** @type {ImageData} */ (v.image()), 0, 0); v.dispose();
  if (deco) deco(g);
  return retImage(g.getImageData(0, 0, W, H));
}
/** l'habillage du programme : un titre en bas à gauche, le « DIRECT » en haut à droite */
function habillage(g, bug) {
  const x = W * 0.06, y = H * TITLE_TOP, w = W * 0.6, h = H * 0.15;
  g.fillStyle = 'rgba(14,26,62,0.94)'; g.fillRect(x, y, w, h); g.fillStyle = '#ffb020'; g.fillRect(x, y, 8, h);
  g.textAlign = 'left'; g.fillStyle = '#ffffff'; g.font = '700 23px "Archivo Narrow", sans-serif'; g.fillText('Olivier', x + 22, y + h * 0.5);
  g.fillStyle = '#cdd5e6'; g.font = '500 16px "Archivo", sans-serif'; g.fillText('chef de car', x + 22, y + h * 0.84);
  if (bug) { g.fillStyle = '#c8102e'; g.fillRect(W - 112, 18, 88, 26); g.fillStyle = '#fff'; g.font = '700 16px "Archivo Narrow", sans-serif'; g.textAlign = 'center'; g.fillText('DIRECT', W - 68, 37); }
}
/** les barres de la caméra (OUTPUT sur BARS) avec un bandeau de réglage à la manière des barres SMPTE RP 219 : blanc 100 %, noir 0 %, +2 %, +4 % */
let BARS = null;
function barsImage() {
  if (BARS) return BARS;
  const c = cnv(W, H), g = c.getContext('2d'), top = Math.round(H * 0.62);
  ['#bfbfbf', '#bfbf00', '#00bfbf', '#00bf00', '#bf00bf', '#bf0000', '#0000bf'].forEach((col, i) => { g.fillStyle = col; g.fillRect(Math.round(i * W / 7), 0, Math.ceil(W / 7) + 1, top); });
  [[0, 0.22, 100], [0.22, 0.42, 0], [0.42, 0.52, 2], [0.52, 0.62, 0], [0.62, 0.72, 4], [0.72, 1, 0]].forEach(([a, b, p]) => {
    const n = Math.round(255 * p / 100); g.fillStyle = `rgb(${n},${n},${n})`; g.fillRect(Math.round(a * W), top, Math.ceil((b - a) * W) + 1, H - top);
  });
  BARS = g.getImageData(0, 0, W, H);
  return BARS;
}

/**
 * Le viseur : draw(cam, disp) avec cam l'état de la caméra (vf.js, sans zébras) et disp ce que
 * le viseur ajoute : bright, contrast, peak (0 à 1), zebra1 { level, width }, zebra2 (niveau),
 * safety (zone), center, dext (×2, ×4 : agrandit aussi la sortie), ret (image de retour),
 * mix { mode, level }, osd, osdR, msg, overlay(g, W, H). La sortie (output) ne voit que l'image
 * de la caméra et l'extender ; tout le reste n'existe que dans le viseur.
 */
function viseur56(label = 'Le viseur du cadreur') {
  const vf = makeViewfinder(W, H);
  const view = cnv(W, H); view.className = 'cl-vfc c56-vfc'; view.setAttribute('role', 'img'); view.setAttribute('aria-label', label);
  let raw = /** @type {ImageData | null} */ (null), out = null, luma = null, key = '', bars = false, d = /** @type {any} */ ({});
  const outs = [];
  vf.onFrame((img) => { if (bars) return; raw = img; refresh(); });
  function refresh() {
    if (!raw) return;
    out = d.dext ? magnify(raw, d.dext) : raw; luma = lumaOf(out);
    for (const fn of outs) fn(out);
    paint();
  }
  function paint() {
    if (!out) return;
    const g = view.getContext('2d');
    const id = g.createImageData(W, H), o = id.data, s = out.data;
    const lut = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) lut[i] = Math.round(255 * vfShow(i / 255, d.bright || 0, d.contrast == null ? 1 : d.contrast));
    const ret = d.ret || null, mix = ret && d.mix ? d.mix : null, lv = mix ? mix.level / 100 : 0;
    const z1 = d.zebra1 ? [d.zebra1.level - d.zebra1.width / 2, d.zebra1.level + d.zebra1.width / 2] : null, z2 = d.zebra2 != null ? d.zebra2 : null;
    const pk = d.peak || 0, thr = 95 - 65 * pk;
    for (let y = 0, p = 0; y < H; y++) {
      for (let x = 0; x < W; x++, p++) {
        const i = p * 4; let r, gg, bb;
        if (ret && !mix) { r = ret.img.data[i]; gg = ret.img.data[i + 1]; bb = ret.img.data[i + 2]; }
        else {
          r = s[i]; gg = s[i + 1]; bb = s[i + 2];
          const L = luma[p];
          if ((z1 || z2 != null) && ((x + y) % 10) < 4) { const pc = L / 2.55; if ((z1 && pc >= z1[0] && pc <= z1[1]) || (z2 != null && pc >= z2)) r = gg = bb = 235; }
          if (pk > 0 && x > 0 && y > 0 && x < W - 1 && y < H - 1 && Math.abs(4 * L - luma[p - 1] - luma[p + 1] - luma[p - W] - luma[p + W]) > thr) r = gg = bb = 255;
          if (mix) {
            if (mix.mode === 'Y-MIX') { const Y = ret.luma[p]; r = r * (1 - lv) + Y * lv; gg = gg * (1 - lv) + Y * lv; bb = bb * (1 - lv) + Y * lv; }
            else if (ret.edge[p]) r = gg = bb = mix.mode === 'WIRE (W)' ? 235 : 16;
          }
        }
        o[i] = lut[r | 0]; o[i + 1] = lut[gg | 0]; o[i + 2] = lut[bb | 0]; o[i + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0);
    g.save(); g.shadowColor = 'rgba(0,0,0,0.75)'; g.shadowBlur = 3; g.font = '600 15px "B612 Mono", monospace'; g.fillStyle = 'rgba(240,240,232,0.92)';
    g.textAlign = 'left'; (d.osd || []).forEach((t, i) => g.fillText(t, 12, 22 + i * 20));
    g.textAlign = 'right'; (d.osdR || []).forEach((t, i) => g.fillText(t, W - 12, 22 + i * 20));
    if (d.msg) { g.font = '700 17px "B612 Mono", monospace'; g.textAlign = 'center'; g.fillText(d.msg, W / 2, H * 0.8); }
    g.shadowBlur = 0; g.strokeStyle = 'rgba(240,240,232,0.75)'; g.lineWidth = 1.5;
    if (d.safety) g.strokeRect(W * (1 - d.safety) / 2, H * (1 - d.safety) / 2, W * d.safety, H * d.safety);
    if (d.center) { g.beginPath(); g.moveTo(W / 2 - 12, H / 2); g.lineTo(W / 2 + 12, H / 2); g.moveTo(W / 2, H / 2 - 12); g.lineTo(W / 2, H / 2 + 12); g.stroke(); }
    if (d.overlay) d.overlay(g, W, H);
    g.restore();
  }
  return {
    canvas: view,
    draw(cam, disp = {}) {
      d = disp;
      const k = JSON.stringify(cam);
      if (k === key && raw) { refresh(); return; }
      key = k; bars = cam.scene === 'bars';
      if (bars) { raw = barsImage(); refresh(); return; }
      vf.draw({ ...cam, osd: false });
    },
    output: () => out,
    onOutput(fn) { outs.push(fn); },
    dispose() { vf.dispose(); outs.length = 0; },
  };
}
/** la sortie de la caméra en petit, à côté de la forme d'onde */
function outMonitor(v, sc, title = 'La sortie, vers le car') {
  const mon = cnv(320, 180); mon.className = 'c56-monc'; mon.setAttribute('role', 'img'); mon.setAttribute('aria-label', title);
  const tmp = cnv(W, H);
  v.onOutput((img) => { tmp.getContext('2d').putImageData(img, 0, 0); mon.getContext('2d').drawImage(tmp, 0, 0, 320, 180); drawScope(sc, img); });
  return el('div', { class: 'c56-out' }, el('figure', { class: 'c56-mon' }, mon, el('figcaption', {}, title)), sc);
}

/** une touche qu'on maintient enfoncée (RET, CALL) : souris, doigt, ou Entrée et Espace au clavier */
function holdBtn(label, onHold, cls = 'btn small') {
  const b = el('button', { type: 'button', class: cls, 'aria-pressed': 'false', title: 'Maintenir enfoncé (Entrée ou Espace au clavier)' }, label);
  let on = false;
  const set = (v) => { if (v === on) return; on = v; b.setAttribute('aria-pressed', String(v)); b.classList.toggle('on', v); onHold(v); };
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (er) { /* évènement de test */ } set(true); });
  for (const t of ['pointerup', 'pointercancel', 'blur']) b.addEventListener(t, () => set(false));
  b.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault(); set(true); } });
  b.addEventListener('keyup', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(false); } });
  return { btn: b, set, isOn: () => on };
}
/** un schéma SVG vivant, redessiné à chaque changement */
function liveSvg(h, label, cls = '') {
  const box = el('div', { class: 'c56-live ' + cls });
  return { node: box, set(body) { box.innerHTML = `<svg class="cf" viewBox="0 0 440 ${h}" role="img" aria-label="${label}">${body}</svg>`; } };
}
const T = (x, y, t, cls = 'cf-s') => `<text class="${cls}" x="${x}" y="${y}">${t}</text>`;

export const LABS_CH56 = {
  // =================================================================================
  /** les commandes du corps : caméra seule, puis reliée à la CCU (le RCP reprend la main) */
  commandes(ctx) {
    const FUNCS = ['OFF', 'ZEBRA', 'VF DETAIL', 'RETURN1 SW'];
    const LIGHT = 1 / 32; // un plateau très sombre : à f/2,8 et 0 dB, le blanc de la mire vers 45 %
    const init = () => ({ mode: 'seule', filter: 1, ctemp: false, gain: 'L', output: 'CAM', assign: ['OFF', 'OFF', 'OFF'], on: { ZEBRA: false, 'VF DETAIL': false }, ret: false, rcp: { gain: 'L', filter: 1, bars: false }, tried: '', none: false });
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(2.8), nd: 1, ...init() };
    const defis = [false, false, false];
    const v = viseur56(); const sc = scopeCanvas();
    const rings = lensRings(st, () => up(), []);
    let pgm = null;
    const camOnly = (name, fn) => (val) => { fn(val); st.tried = st.mode === 'ccu' ? name : ''; up(); };
    const mode = seg('Liaison', [['seule', 'Caméra seule'], ['ccu', 'Reliée à la CCU']], 'seule', (val) => { st.mode = val; st.tried = ''; rcpBox.hidden = val !== 'ccu'; up(); });
    const filter = seg('FILTER', [[1, '1 CLEAR'], [2, '2 · 1/4'], [3, '3 · 1/16'], [4, '4 · 1/64']], 1, camOnly('FILTER', (val) => { st.filter = Number(val); }));
    const gain = seg('GAIN', [['L', 'L'], ['M', 'M'], ['H', 'H']], 'L', camOnly('GAIN', (val) => { st.gain = val; }));
    const output = seg('OUTPUT', [['BARS', 'BARS'], ['CAM', 'CAM']], 'CAM', camOnly('OUTPUT/AUTO KNEE', (val) => { st.output = val; }));
    const ctemp = toggle('COLOR TEMP. (5600K)', false, (val) => { st.ctemp = val; st.tried = ''; up(); });
    const assignBtns = [0, 1, 2].map((i) => holdBtn(`ASSIGN ${i + 1}`, (on) => {
      const f = st.assign[i]; st.none = false;
      if (f === 'RETURN1 SW') st.ret = on;
      else if (on && f !== 'OFF') st.on[f] = !st.on[f];
      else if (on) st.none = true;
      up();
    }));
    const assignSegs = [0, 1, 2].map((i) => seg(`ASSIGNABLE${i + 1}`, FUNCS.map((f) => [f, f]), 'OFF', (val) => {
      st.assign[i] = val; st.none = false;
      for (const f of ['ZEBRA', 'VF DETAIL']) if (!st.assign.includes(f)) st.on[f] = false;
      if (val === 'RETURN1 SW' && !pgm) pgm = renderShot({ f: 6 }, (g) => habillage(g, true));
      up();
    }, 'c56-seg4'));
    const page = el('details', { class: 'c56-page' }, el('summary', {}, 'Menu OPERATION, page 09 SWITCH ASSIGN1'), ...assignSegs.map((s) => s.row));
    const rGain = seg('GAIN', [['L', '0 dB'], ['M', '6 dB'], ['H', '12 dB']], 'L', (val) => { st.rcp.gain = val; up(); });
    const rNd = seg('ND', ND.map(([nm], i) => [i + 1, String(i + 1)]), 1, (val) => { st.rcp.filter = Number(val); up(); });
    const rBars = toggle('BARS', false, (val) => { st.rcp.bars = val; up(); });
    const rcpBox = el('div', { class: 'cl-ctrls c56-rcp', hidden: true }, grp('Au RCP de la vision'), rGain.row, rNd.row, btnRow(rBars.btn));
    const read = readout();
    const sh = shell({ vf: v, scope: outMonitor(v, sc), ctrls: [mode.row, grp('Sur la caméra'), filter.row, gain.row, output.row, btnRow(ctemp.btn), btnRow(...assignBtns.map((b) => b.btn)), page, rcpBox, read], defis: [
      'Caméra seule, plateau très sombre, iris déjà ouvert à f/2,8 : avec le sélecteur GAIN, amène le blanc de la mire entre 80 et 98 %.',
      'Donne la fonction ZEBRA à la touche ASSIGN 1 (page SWITCH ASSIGN1), puis allume les zébras avec elle.',
      'Relie la caméra à la CCU. La vision demande des barres pour le line-up : envoie-les.',
    ] });
    const white = (e) => whiteLevels(exposureOf(rings.read().N, e.nd, e.gainDb) * LIGHT, castOf(3200, st.ctemp ? 5600 : 3200))[1];
    function olivier(e, w) {
      if (st.tried) return `${st.tried} ne répond plus : reliée à la CCU, SHUTTER, WHT/BLK, OUTPUT/AUTO KNEE, WHITE BAL, GAIN et FILTER obéissent au RCP (mode d'emploi). C'est la vision qui les règle.`;
      if (st.none) return 'Cette touche n\'a pas de fonction : d\'usine, ASSIGN 1 à 3 ne font rien. On leur en donne une dans la page SWITCH ASSIGN1 du menu OPERATION.';
      if (defis[2]) return 'Les barres partent du RCP : la caméra les fabrique, mais c\'est la vision qui les demande. Pour le cadreur, il reste le cadre, le viseur, les touches ASSIGN, l\'intercom et le CALL.';
      if (defis[1]) return st.mode !== 'ccu' ? 'Bascule la liaison sur « Reliée à la CCU » : la caméra prend alors les réglages du RCP.' : (e.gainDb !== 12 ? `La vision a repris la main : le gain est maintenant celui du RCP (${e.gainDb} dB), plus celui du sélecteur. Envoie les barres depuis le RCP.` : 'Envoie les barres depuis le RCP, pas avec le commutateur OUTPUT de la caméra.');
      if (defis[0]) {
        if (st.ret) return 'RETURN1 SW : tant que la touche est enfoncée, le viseur montre le retour 1, ici le programme. C\'est une autre fonction : il faut ZEBRA.';
        if (st.assign[0] !== 'ZEBRA') return 'Ouvre la page SWITCH ASSIGN1 et donne ZEBRA à ASSIGNABLE1.';
        return 'Appuie sur ASSIGN 1 : les zébras se posent sur ce qui est autour de 70 % (réglage d\'usine de la page ZEBRA).';
      }
      if (st.ctemp) return 'COLOR TEMP. a basculé la caméra sur 5600K : sous les projecteurs tungstène (3200 K), l\'image vire à l\'orange. Relâche-le pour ce plateau.';
      if (e.bars) return 'OUTPUT sur BARS : la caméra envoie des barres de couleur au lieu de l\'image. Repasse sur CAM.';
      if (st.filter > 1) return `Le filtre ${e.ndName} retire de la lumière : sur un plateau sombre, FILTER revient sur 1 (CLEAR).`;
      if (w < 80) return `Blanc à ${fr(w, 0)} % avec ${e.gainDb} dB. Chaque cran de 6 dB double le signal, comme un diaphragme de plus. Monte d'un cran.`;
      if (w >= 99.6) return 'Écrêté : c\'est trop.';
      return 'Exposé.';
    }
    function up() {
      const o = rings.read();
      const e = effective(st.mode, { gain: st.gain, filter: st.filter, output: st.output }, st.rcp);
      const w = e.bars ? 75 : white(e);
      if (!defis[0] && st.mode === 'seule' && !e.bars && !st.ctemp && w >= 80 && w < 99.6) defis[0] = true;
      if (defis[0] && !defis[1] && st.assign[0] === 'ZEBRA' && st.on.ZEBRA) defis[1] = true;
      if (defis[1] && !defis[2] && st.mode === 'ccu' && st.rcp.bars) defis[2] = true;
      for (const [i, b] of assignBtns.entries()) b.btn.textContent = `ASSIGN ${i + 1} · ${st.assign[i] === 'OFF' ? '—' : st.assign[i]}`;
      read.textContent = `Sortie : ${e.bars ? 'barres' : `blanc ${fr(w, 0)} %`} · gain ${e.gainDb} dB · ${e.ndName} · ${st.ctemp ? '5600K' : '3200K (PRST)'} · réglé par ${e.by === 'rcp' ? 'le RCP' : 'la caméra'}`;
      sh.done(defis); sh.say(olivier(e, w));
      const wb = /** @type {[number, number, number]} */ (castOf(3200, st.ctemp ? 5600 : 3200));
      const zebraOn = st.on.ZEBRA;
      v.draw({ f: o.f, dF: o.dF, N: o.N, nd: e.nd, gain: e.gainDb, light: LIGHT, wb, scene: e.bars ? 'bars' : 'mire' }, {
        zebra1: zebraOn ? { level: 70, width: 10 } : null, peak: st.on['VF DETAIL'] ? 0.55 : 0, ret: st.ret && pgm ? pgm : null,
        osd: [`Z ${fr(o.f, 0)} mm`, `F${fr(o.N, 1)}`, ...(e.gainDb ? [`+${e.gainDb}dB`] : [])], osdR: [e.ndName, ...(st.ctemp ? ['5600K'] : []), ...(st.ret ? ['RET 1'] : [])],
      });
      st.nd = e.nd;
      send(ctx, lensState(st, o, { light: LIGHT, gain: e.gainDb, wb, bars: e.bars, zebra: zebraOn ? [65, 75] : null }));
    }
    sh.node.classList.add('c56-lab');
    sh.node.append(btnRow(linkBtn('Recommencer', () => {
      Object.assign(st, init()); defis.fill(false);
      mode.mark('seule'); filter.mark(1); gain.mark('L'); output.mark('CAM'); ctemp.set(false); rGain.mark('L'); rNd.mark(1); rBars.set(false); rcpBox.hidden = true;
      assignSegs.forEach((s) => s.mark('OFF')); assignBtns.forEach((b) => b.set(false)); up();
    })));
    up();
    return { node: sh.node, dispose: () => v.dispose() };
  },

  // =================================================================================
  /** l'alimentation : par la fibre hybride depuis la CCU, ou sur place par DC IN ; le budget d'énergie */
  alimentation(ctx) {
    /** longueur (m) lue sur un curseur logarithmique 0 à 1 : 50 m à 12 km */
    const lenOf = (u) => { const L = 50 * Math.pow(240, u); return L < 1000 ? Math.round(L / 10) * 10 : Math.round(L / 50) * 50; };
    const lenPos = (L) => Math.log(L / 50) / Math.log(240);
    const fmtLen = (L) => (L < 1000 ? `${L} m` : `${fr(L / 1000, L < 10000 ? 2 : 1)} km`);
    const init = () => ({ link: 'hybride', u: lenPos(150), src: 'aucune', loads: { viseur: true, objectif: true, lampe: false } });
    const st = init();
    const defis = [false, false, false];
    const pic = liveSvg(176, 'La liaison entre la CCU et la caméra, la source sur DC IN et le budget d\'énergie de la tête', 'c56-alim');
    const link = seg('Liaison', [['hybride', 'Fibre hybride'], ['smf', 'Fibre monomode'], ['seule', 'Sans CCU']], 'hybride', (val) => { st.link = val; up(); });
    const len = slider('Longueur', 0, 1, 0.001, st.u, (val) => { st.u = val; up(); });
    const src = seg('Sur DC IN', [['aucune', 'Rien'], ['secteur', 'Bloc 12 V'], ['batterie', 'Batterie']], 'aucune', (val) => { st.src = val; up(); });
    const loads = [['viseur', 'Viseur 7" (13 W)'], ['objectif', 'Objectif (≈ 5 W)'], ['lampe', 'Lampe sur DC OUT (≈ 12 W)']].map(([k, label]) => toggle(label, st.loads[k], (val) => { st.loads[k] = val; up(); }));
    const read = readout();
    const sh = shell({ vf: { canvas: pic.node }, ctrls: [link.row, len.row, src.row, btnRow(...loads.map((l) => l.btn)), read], vfClass: 'cl-vf-plate', defis: [
      'Le plateau extérieur est à 450 m du car : relie la caméra en fibre hybride, la CCU doit l\'alimenter.',
      'La scène du parvis est à 1,5 km : la fibre hybride ne suffit plus. Trouve une liaison qui marche jusque-là.',
      'Sans secteur, sur batterie (14,4 V, 95 Wh) : la caméra doit tenir 2 heures avec son viseur et son objectif.',
    ] });
    function olivier(b, L) {
      if (defis[2]) return `≈ ${fr(b.P, 0)} W pour ${fr(SOURCES.batterie.Wh, 0)} Wh : ${fr(b.hours, 1)} h, en négligeant les pertes. La lampe de 12 W coûtait près d'une demi-heure : sur batterie, chaque watt compte.`;
      if (defis[1]) {
        if (st.src !== 'batterie') return 'Passe la source de DC IN sur la batterie.';
        if (b.by !== 'dcin') return 'Ici, c\'est la CCU qui alimente la caméra : la batterie ne sert pas. Pour l\'essai, passe en fibre monomode ou sans CCU.';
        if (!st.loads.viseur || !st.loads.objectif) return 'Le cadreur a besoin de son viseur et de son objectif : garde-les.';
        return b.hours < 2 ? `Autonomie ≈ ${fr(b.hours, 1)} h : il manque du temps. Que peut-on débrancher sans gêner le cadreur ?` : 'Ça tient.';
      }
      if (defis[0]) {
        if (L < 1400) return 'Allonge la liaison jusqu\'à la scène du parvis, vers 1,5 km.';
        if (st.link === 'hybride') return `À ${fmtLen(L)}, la CCU n'alimente plus la caméra : le cuivre du câble ne porte l'énergie que sur 600 m (mode d'emploi, avec un objectif portable). Il faut une fibre monomode et une alimentation sur place.`;
        if (st.link === 'smf' && !b.by) return 'La fibre monomode ne porte que de la lumière, aucune énergie : branche une source sur DC IN.';
        if (st.link === 'seule') return 'Sans CCU, pas d\'image au car. Il faut la fibre monomode, jusqu\'à 10 km.';
        return b.linkOk ? 'Ça marche.' : 'Au-delà de 10 km, même la fibre monomode ne suffit plus.';
      }
      if (st.link !== 'hybride') return 'Commence avec la fibre hybride : c\'est le câble de la CCU, qui porte l\'image et l\'énergie.';
      if (L < 400) return `${fmtLen(L)} : allonge jusqu'au plateau extérieur, vers 450 m.`;
      if (L > 600) return `${fmtLen(L)} : trop long, la CCU ne peut plus alimenter la caméra au-delà de 600 m. Le plateau est à 450 m.`;
      return 'La CCU alimente.';
    }
    function draw(b, L) {
      const on = b.powered, cab = st.link === 'hybride' ? 'c56-cab-h' : st.link === 'smf' ? 'c56-cab-s' : '';
      const s = SOURCES[st.src];
      /** @type {[string, number, string][]} */
      const segs = [['corps', CHARGES.corps, 'corps'], ['viseur', CHARGES.viseur, 'viseur'], ['objectif', CHARGES.objectif, 'obj.'], ['lampe', CHARGES.lampe, 'lampe']];
      const used = segs.filter(([id]) => id === 'corps' || st.loads[id]);
      let x = 16; const k = 3.4; // 1 W = 3,4 px
      const bar = used.map(([id, p, t]) => { const w = p * k, r = `<rect class="c56-ld ${id}" x="${x}" y="134" width="${w}" height="20"/>${w > 26 ? T(x + w / 2, 148, t, 'cf-tick ink') : ''}`; x += w; return r; }).join('');
      const ccuTxt = st.link === 'seule' ? T(50, 72, 'pas de CCU', 'cf-s') : `<rect class="cf-box" x="12" y="38" width="80" height="54" rx="4"/>${T(52, 58, 'CCU', 'cf-bb mid')}${T(52, 74, 'HXCU-FB80', 'cf-tick')}<circle class="c56-led${b.by === 'ccu' && on ? ' on' : ''}" cx="52" cy="84" r="4"/>`;
      const cable = st.link === 'seule' ? '' : `<line class="c56-cab ${cab}" x1="92" y1="64" x2="300" y2="64"/>${T(196, 54, `${st.link === 'hybride' ? 'fibre hybride' : 'fibre monomode (LC)'} · ${fmtLen(L)}`, 'cf-lbl')}${T(196, 82, st.link === 'hybride' ? (b.by === 'ccu' ? 'énergie et signaux' : 'signaux, mais plus d\'énergie') : 'signaux seulement, pas d\'énergie', 'cf-tick')}${b.linkOk === false ? T(196, 98, 'liaison hors des limites', 'cf-tick c56-bad') : ''}`;
      const cam = `<rect class="c56-cam${on ? ' on' : ''}" x="300" y="38" width="112" height="54" rx="5"/><rect class="cf-vf" x="372" y="22" width="34" height="18" rx="2"/>${T(342, 60, 'HXC-FB80', 'cf-bb mid')}${T(342, 78, on ? `allumée · ≈ ${fr(b.P, 0)} W` : 'éteinte', on ? 'cf-tick c56-ok' : 'cf-tick c56-bad')}`;
      const dcin = s ? `<line class="c56-dc" x1="356" y1="92" x2="356" y2="112"/><rect class="cf-box" x="304" y="112" width="104" height="22" rx="3"/>${T(356, 127, s.nom.replace(' de 95 Wh', ''), 'cf-tick')}${T(356, 148, `DC IN ${b.by === 'dcin' ? fr(b.I, 1) + ' A' : '(inutile)'}`, 'cf-tick')}` : T(356, 120, 'DC IN libre', 'cf-tick');
      const max = CHARGES.corps + CHARGES.viseur + CHARGES.objectif + CHARGES.lampe;
      return `${T(16, 16, 'La liaison et l\'énergie', 'cf-t')}${ccuTxt}${cable}${cam}${dcin}
        ${T(16, 126, `Budget de la tête : ≈ ${fr(b.P, 0)} W`, 'cf-lbl l')}<rect class="cf-box" x="16" y="134" width="${max * k}" height="20"/>${bar}
        ${T(16, 170, b.by === 'dcin' && isFinite(b.hours) ? `autonomie ≈ ${fr(b.hours, 1)} h` : b.by === 'ccu' ? 'la CCU fournit' : '', 'cf-tick l')}`;
    }
    function up() {
      const L = lenOf(st.u);
      const b = powerBudget({ link: st.link, L, src: st.src, loads: st.loads });
      if (!defis[0] && st.link === 'hybride' && L >= 400 && L <= 600 && b.by === 'ccu') defis[0] = true;
      if (defis[0] && !defis[1] && st.link === 'smf' && L >= 1400 && b.linkOk && b.powered) defis[1] = true;
      if (defis[1] && !defis[2] && st.src === 'batterie' && b.by === 'dcin' && b.powered && st.loads.viseur && st.loads.objectif && b.hours >= 2) defis[2] = true;
      len.out.textContent = fmtLen(L);
      read.textContent = `≈ ${fr(b.P, 0)} W · ${b.by === 'ccu' ? 'alimentée par la CCU' : b.by === 'dcin' ? `DC IN : ${fr(b.I, 2)} A sous ${fr(b.V, 1)} V (5,4 A au plus)` : 'pas d\'alimentation'}${st.loads.lampe ? ` · DC OUT ${fr(b.iLamp, 2)} A (1,5 A au plus)` : ''}${b.by === 'dcin' && isFinite(b.hours) ? ` · autonomie ≈ ${fr(b.hours, 1)} h` : ''}${b.spec ? '' : ' · montage hors du mode d\'emploi'}`;
      pic.set(draw(b, L));
      sh.done(defis); sh.say(olivier(b, L));
      send(ctx, { light: b.powered ? 0.5 : 0 });
    }
    sh.node.classList.add('c56-lab');
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, init()); link.mark('hybride'); src.mark('aucune'); len.set(st.u); loads[0].set(true); loads[1].set(true); loads[2].set(false); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose() {} };
  },

  // =================================================================================
  /** tally, CALL et intercom : un mini-mélangeur, la caméra 2, le RCP de la vision */
  tally(ctx) {
    const CAM = 2;
    const init = () => ({ pgm: 1, pvw: 3, rear: 'ON', vfSw: 'HIGH', mic: 'OFF', camCall: false, rcpCall: false, seenPvw: false, spokeEng: false, log: ['Réalisation (PROD) : « Attention la 2, je vais venir sur toi. »'] });
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, ...init() };
    const defis = [false, false, false];
    const v = viseur56('Le viseur de la caméra 2');
    const rings = lensRings(st, () => up(), []);
    const pic = liveSvg(150, 'La caméra 2 vue du plateau et vue du cadreur : lampe de tally, voyants R TALLY et G TALLY, voyant du corps, CALL, commutateur INTERCOM MIC', 'c56-tal');
    const cams = [1, 2, 3].map((n) => [n, `CAM ${n}`]);
    const pgm = seg('Programme', cams, 1, (val) => { st.pgm = Number(val); up(); });
    const pvw = seg('Preview', cams, 3, (val) => { st.pvw = Number(val); up(); });
    const cut = el('button', { type: 'button', class: 'btn small', onclick: () => { [st.pgm, st.pvw] = [st.pvw, st.pgm]; pgm.mark(st.pgm); pvw.mark(st.pvw); up(); } }, 'CUT');
    const rear = seg('TALLY (corps)', [['ON', 'ON'], ['OFF', 'OFF']], 'ON', (val) => { st.rear = val; up(); });
    const vfSw = seg('TALLY (viseur)', [['HIGH', 'HIGH'], ['LOW', 'LOW'], ['OFF', 'OFF']], 'HIGH', (val) => { st.vfSw = val; up(); });
    const mic = seg('INTERCOM MIC', [['PROD', 'PROD'], ['OFF', 'OFF'], ['ENG', 'ENG']], 'OFF', (val) => { st.mic = val; up(); });
    const call = holdBtn('CALL (caméra)', (on) => { st.camCall = on; up(); });
    const rcall = holdBtn('CALL (RCP de la vision)', (on) => { st.rcpCall = on; up(); });
    const talk = el('button', { type: 'button', class: 'btn small', onclick: () => speak() }, 'Le cadreur parle');
    const log = el('ol', { class: 'c56-log', 'aria-live': 'polite', 'aria-label': 'Ce qui passe dans l\'intercom' });
    const sh = shell({ vf: v, scope: pic.node, ctrls: [grp('Au mélangeur (la réalisation)'), pgm.row, pvw.row, btnRow(cut), grp('Sur la caméra 2'), rear.row, vfSw.row, mic.row, btnRow(call.btn, talk), grp('Au RCP'), btnRow(rcall.btn), log], defis: [
      'Tu es la caméra 2. Fais ce que fait le réalisateur : prépare-la en preview, puis prends-la à l\'antenne. Regarde le tally passer du vert au rouge.',
      'Rends l\'antenne à une autre caméra. Puis, hors antenne, appelle la vision sans parler à toute la régie : CALL.',
      'La vision te répond sur ENG : réponds-lui sans que la réalisation t\'entende, puis coupe ton micro.',
    ] });
    let note = '';
    function speak() {
      const who = HEARS[st.mic];
      st.log.push(who ? `Toi (${st.mic}) : « Mon retour programme est noir. » Entendu par ${who}.` : 'Toi : « Mon retour programme est noir. » Micro sur OFF : personne ne t\'entend.');
      if (st.mic === 'ENG' && defis[1]) { st.spokeEng = true; st.log.push('Vision (ENG) : « Bien reçu la 2, je regarde ta voie. »'); }
      note = st.mic === 'PROD' ? 'Sur PROD, ta voix part dans le casque du réalisateur et de toute la production. Pour la vision, c\'est ENG.' : '';
      up();
    }
    function olivier(t) {
      if (note) return note;
      if (defis[2]) return 'Micro coupé. Sur PROD, ce que dit le cadreur s\'entend dans toute la production : on y répond aux ordres, on ne discute pas. La technique, c\'est ENG.';
      if (defis[1]) return st.spokeEng ? 'La vision a compris. Coupe maintenant ton micro (INTERCOM MIC sur OFF).' : (st.mic === 'ENG' ? 'Micro sur ENG : parle.' : 'Mets INTERCOM MIC sur ENG, la ligne de la technique, puis parle.');
      if (defis[0]) {
        if (t === 'pgm') return 'Tu es à l\'antenne (rouge). Rends l\'antenne : la réalisation passe sur une autre caméra (CUT ou PROGRAMME).';
        return 'Hors antenne : appuie sur CALL. Le tally rouge de la CCU et du RCP s\'allume, la vision sait que la 2 l\'appelle.';
      }
      if (st.rcpCall) return 'Le CALL du RCP : la vision appelle la caméra, son tally rouge s\'allume. On répond sur l\'intercom ENG.';
      if (t === 'pvw') return 'Vert : ta caméra est en preview, la prochaine à passer. Le cadre doit être prêt. Maintenant, CUT.';
      if (t === 'pgm') return st.seenPvw ? 'Rouge.' : 'Rouge : à l\'antenne, mais sans passer par le preview. Remets une autre caméra au programme et prépare d\'abord la 2.';
      return 'Mets la caméra 2 en preview : elle sera la prochaine.';
    }
    function draw(lamps) {
      const lv = lamps.frontLevel;
      const front = `<rect class="cf-body" x="34" y="26" width="92" height="46" rx="4"/><rect class="c56-lamp${lamps.front ? ' red' : ''}" x="64" y="30" width="32" height="12" rx="2" style="opacity:${lamps.front ? 0.35 + 0.65 * lv : 1}"/>
        <rect class="cf-body" x="44" y="76" width="72" height="40" rx="4"/><circle class="cf-lens" cx="80" cy="96" r="17"/><circle class="c56-glass" cx="80" cy="96" r="10"/>${T(80, 132, 'vue du plateau', 'cf-tick')}${T(80, 146, 'la lampe de tally du viseur', 'cf-tick')}`;
      const back = `<rect class="cf-body" x="166" y="20" width="140" height="82" rx="4"/><rect class="cf-vf" x="178" y="36" width="116" height="60" rx="2"/>
        <circle class="c56-led${lamps.r ? ' red' : ''}" cx="190" cy="28" r="4"/>${T(198, 31, 'R TALLY', 'cf-tick l')}<circle class="c56-led${lamps.g ? ' green' : ''}" cx="252" cy="28" r="4"/>${T(260, 31, 'G', 'cf-tick l')}
        ${T(236, 70, 'le viseur', 'cf-tick')}${T(236, 120, 'vue du cadreur', 'cf-tick')}`;
      const micY = { PROD: 92, OFF: 106, ENG: 120 }[st.mic];
      const rearP = `<rect class="cf-plate" x="322" y="20" width="108" height="124" rx="5"/><circle class="c56-led big${lamps.rear ? ' red' : ''}" cx="342" cy="40" r="7"/>${T(354, 44, 'TALLY ' + st.rear, 'cf-tick l')}
        <circle class="c56-btn${st.camCall ? ' on' : ''}" cx="342" cy="66" r="7"/>${T(354, 70, 'CALL', 'cf-tick l')}
        ${T(370, 86, 'INTERCOM MIC', 'cf-tick')}<rect class="cf-sw" x="336" y="88" width="12" height="38" rx="2"/><rect class="c56-knob" x="334" y="${micY - 5}" width="16" height="10" rx="2"/>
        ${['PROD', 'OFF', 'ENG'].map((t) => T(356, { PROD: 95, OFF: 109, ENG: 123 }[t], t, 'cf-tick l' + (t === st.mic ? ' c56-hi' : ''))).join('')}`;
      return front + back + rearP;
    }
    function up() {
      const t = tallyOf(CAM, st.pgm, st.pvw);
      if (t === 'pvw') st.seenPvw = true;
      if (!defis[0] && st.seenPvw && t === 'pgm') { defis[0] = true; st.log.push('Réalisation (PROD) : « Merci la 2. »'); }
      if (defis[0] && !defis[1] && st.camCall && t !== 'pgm') { defis[1] = true; st.log.push('Vision (ENG) : « Oui la 2, je t\'écoute ? »'); }
      if (defis[1] && !defis[2] && st.spokeEng && st.mic === 'OFF') defis[2] = true;
      if (st.mic !== 'PROD' && note && note.startsWith('Sur PROD')) note = '';
      const lamps = lampsOf({ tally: t, call: st.camCall || st.rcpCall, rear: st.rear, vfSw: st.vfSw });
      pic.set(draw(lamps));
      rcall.btn.classList.toggle('c56-red', t === 'pgm' || st.camCall);
      rcall.btn.title = t === 'pgm' || st.camCall ? 'Le tally rouge du RCP est allumé' : 'Maintenir enfoncé';
      log.replaceChildren(...st.log.slice(-4).map((m) => el('li', {}, m)));
      sh.done(defis); sh.say(olivier(t));
      const o = rings.read();
      v.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5 }, {
        osd: [`Z ${fr(o.f, 0)} mm`, `F${fr(o.N, 1)}`], osdR: ['CAM 2'],
        overlay: (g) => { if (lamps.r || lamps.g) { g.fillStyle = lamps.r ? '#ff2a1a' : '#22d65a'; g.fillRect(W / 2 - 34, 8, 68, 14); g.fillStyle = '#05070a'; g.font = '700 11px "B612 Mono", monospace'; g.textAlign = 'center'; g.fillText(lamps.r ? 'TALLY' : 'PVW', W / 2, 19); } },
      });
      send(ctx, lensState(st, o, { light: 0.5 }));
    }
    sh.node.classList.add('c56-lab');
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, init()); note = ''; pgm.mark(1); pvw.mark(3); rear.mark('ON'); vfSw.mark('HIGH'); mic.mark('OFF'); call.set(false); rcall.set(false); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => v.dispose() };
  },

  // =================================================================================
  /** les retours vidéo dans le viseur : RET 1, RET2 SEL et la touche de l'objectif, MIX VF */
  retours(ctx) {
    const init = () => ({ z: zoomPos(40), ret1: false, lens: false, sel: 2, mixOn: false, mode: 'Y-MIX', level: 50, seen3: false });
    const st = { s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, ...init() };
    const defis = [false, false, false];
    // les quatre retours de ce car (page RETURN SET de la CCU) : programme, preview, caméra 1, habillage
    const R = {
      1: renderShot({ f: 6 }, (g) => habillage(g, true)),
      2: renderShot({ f: 50 }),
      3: renderShot({ f: 24 }),
      4: (() => { const c = cnv(W, H), g = c.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, W, H); habillage(g, false); return retImage(g.getImageData(0, 0, W, H)); })(),
    };
    const NAMES = { 1: 'le programme', 2: 'le preview', 3: 'la caméra 1', 4: 'l\'habillage seul' };
    const v = viseur56('Le viseur : l\'image de la caméra ou un retour');
    const sc = scopeCanvas();
    const rings = lensRings(st, () => up(), ['zoom']);
    let t1 = 0, timer = 0;
    const ret1 = holdBtn('RET 1 (arrière)', (on) => { st.ret1 = on; t1 = performance.now(); clearTimeout(timer); if (on) timer = window.setTimeout(up, 1050); up(); });
    const lensRet = holdBtn('RET (poignée de l\'objectif)', (on) => { st.lens = on; up(); });
    const sel = seg('RET2 SEL', [[2, '2'], [3, '3'], [4, '4']], 2, (val) => { st.sel = Number(val); up(); });
    const mixOn = seg('RET MIX VF', [['ON', 'ON'], ['OFF', 'OFF']], 'OFF', (val) => { st.mixOn = val === 'ON'; up(); });
    const mode = seg('MIX VF MODE', [['Y-MIX', 'Y-MIX'], ['WIRE (W)', 'WIRE (W)'], ['WIRE (B)', 'WIRE (B)']], 'Y-MIX', (val) => { st.mode = val; up(); });
    const level = slider('MIX VF LEVEL', 0, 80, 10, 50, (val) => { st.level = val; up(); });
    const read = readout();
    const sh = shell({ vf: v, scope: outMonitor(v, sc), ctrls: [...rings.rows, btnRow(ret1.btn, lensRet.btn), sel.row, grp('Menu OPERATION, page 08 VF OUT'), mixOn.row, mode.row, level.row, read], defis: [
      '« La 2, regarde l\'antenne » : montre le programme dans ton viseur (RET 1) et garde-le une seconde.',
      'Raccorde ton cadre sur celui de la caméra 1 : choisis-la avec RET2 SEL, regarde-la avec la touche RET de l\'objectif, puis cadre aussi serré qu\'elle.',
      'Un titre va s\'incruster en bas de ton image : superpose l\'habillage (RET 4) à ton image en MIX VF (Y-MIX), et élargis jusqu\'à ce que toute la mire passe au-dessus du titre.',
    ] });
    const shown = () => (st.ret1 ? 1 : st.lens ? st.sel : 0);
    function olivier(f, n) {
      if (defis[2]) return 'Le titre et la mire ne se chevauchent plus : quand la réalisation lancera l\'habillage, rien d\'important ne sera dessous. Le MIX VF ne change que le viseur : la sortie de la caméra reste propre.';
      if (defis[1]) {
        if (!st.mixOn) return 'Passe RET MIX VF sur ON : en appuyant sur RET, le viseur mélangera le retour à ton image au lieu de la remplacer.';
        if (st.sel !== 4) return 'Choisis le retour 4 (l\'habillage) avec RET2 SEL.';
        if (n !== 4) return 'Maintiens la touche RET de l\'objectif pour voir le mélange.';
        if (st.mode !== 'Y-MIX') return `${st.mode} : seuls les contours du retour se posent sur ton image. Pour un titre plein, Y-MIX est plus lisible.`;
        return mireBottom(f) > TITLE_TOP - 0.02 ? 'Le bas de la mire passe sous le titre : élargis (zoom vers le grand angle).' : 'Bien.';
      }
      if (defis[0]) {
        if (!st.seen3) return st.sel === 3 ? 'Maintiens la touche RET de l\'objectif : elle montre le retour choisi par RET2 SEL.' : 'Avec RET2 SEL, choisis le retour 3 : la caméra 1.';
        return `La caméra 1 est à 24 mm. Tu es à ${fr(f, 0)} mm : ${f < 24 ? 'serre' : 'élargis'} un peu.`;
      }
      if (n === 1) return `Le programme, avec son titre et le DIRECT : ce qui part à l'antenne. Tiens ${fr(Math.min(1, (performance.now() - t1) / 1000), 1)} s.`;
      if (n) return `RET ${n} : ${NAMES[n]}. La touche RET 1 de l'arrière montre toujours le retour 1.`;
      return 'Maintiens RET 1 : tant que la touche est enfoncée, le viseur montre le retour 1 au lieu de ton image.';
    }
    function up() {
      const o = rings.read(); rings.show();
      const n = shown();
      if (!defis[0] && st.ret1 && performance.now() - t1 >= 1000) defis[0] = true;
      if (defis[0] && st.lens && st.sel === 3) st.seen3 = true;
      if (defis[0] && !defis[1] && st.seen3 && Math.abs(o.f - 24) <= 2) defis[1] = true;
      if (defis[1] && !defis[2] && st.mixOn && st.mode === 'Y-MIX' && n === 4 && mireBottom(o.f) <= TITLE_TOP - 0.02) defis[2] = true;
      level.out.textContent = `${st.level} %`;
      read.textContent = `Retours de ce car (CCU, page RETURN SET) : 1 programme · 2 preview · 3 caméra 1 · 4 habillage. Le viseur montre : ${n ? `RET ${n}${st.mixOn ? ' mélangé à ton image' : ''}` : 'ton image'}.`;
      sh.done(defis); sh.say(olivier(o.f, n));
      v.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5 }, {
        ret: n ? R[n] : null, mix: n && st.mixOn ? { mode: st.mode, level: st.level } : null,
        osd: [`Z ${fr(o.f, 0)} mm`, `F${fr(o.N, 1)}`], osdR: n ? [`RET ${n}`] : [],
      });
      send(ctx, lensState(st, o, { light: 0.5 }));
    }
    sh.node.classList.add('c56-lab');
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, init()); rings.sync(); sel.mark(2); mixOn.mark('OFF'); mode.mark('Y-MIX'); level.set(50); ret1.set(false); lensRet.set(false); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => { clearTimeout(timer); v.dispose(); } };
  },

  // =================================================================================
  /** le viseur et ses aides : BRIGHT, CONTRAST, PEAKING, zébras, marqueurs, D.EXTENDER */
  viseur(ctx) {
    const init = () => ({ z: zoomPos(20), s: pointPos(1.6), n: irisPos(5.6), bright: 0.1, contrast: 0.75, peak: 0, z1: false, z2: false, safety: false, center: true, dext: 0, bars: true, light: 0.5, usedDext: false });
    const st = { nd: 1, ...init() };
    const defis = [false, false, false];
    const v = viseur56(); const sc = scopeCanvas();
    const rings = lensRings(st, () => up(), ['zoom', 'point', 'iris']);
    const bright = slider('BRIGHT', -0.2, 0.2, 0.005, st.bright, (val) => { st.bright = val; up(); });
    const contrast = slider('CONTRAST', 0.5, 1.5, 0.01, st.contrast, (val) => { st.contrast = val; up(); });
    const peak = slider('PEAKING', 0, 1, 0.05, 0, (val) => { st.peak = val; up(); });
    const z1 = toggle('ZEBRA1 70 %', false, (val) => { st.z1 = val; up(); });
    const z2 = toggle('ZEBRA2 100 %', false, (val) => { st.z2 = val; up(); });
    const safety = toggle('SAFETY ZONE 90 %', false, (val) => { st.safety = val; up(); });
    const center = toggle('CENTER', true, (val) => { st.center = val; up(); });
    const dext = seg('D.EXTENDER', [[0, 'OFF'], [2, '×2'], [4, '×4']], 0, (val) => { st.dext = Number(val); up(); });
    const read = readout();
    const sh = shell({ vf: v, scope: outMonitor(v, sc), ctrls: [grp('Les boutons du viseur'), bright.row, contrast.row, peak.row, grp('Menu OPERATION : ZEBRA et VF MARKER'), btnRow(z1.btn, z2.btn), btnRow(safety.btn, center.btn), grp('L\'objectif, et une touche ASSIGN'), ...rings.rows, dext.row, read], defis: [
      'La vision envoie les barres : règle BRIGHT et CONTRAST pour que le noir soit noir, le +4 % à peine visible, le blanc lumineux sans être écrêté.',
      'Serre à fond et fais le point sur l\'étoile avec le PEAKING ; vérifie avec le D.EXTENDER, puis coupe-le.',
      'Le soleil entre par la verrière : allume ZEBRA2 (100 %) et règle l\'iris pour que le blanc reste juste sous l\'écrêtage, au-dessus de 90 %.',
    ] });
    const isSharp = (o) => sharp(o.f, MIRE_D, o.dF, 0, o.N);
    function olivier(o, w) {
      if (defis[2]) return 'Les zébras de 100 % montrent ce qui est écrêté, ceux de 70 % ce qui est au niveau d\'un visage. Ni eux, ni BRIGHT, ni le PEAKING ne sortent de la caméra : regarde la forme d\'onde, elle ne bouge que pour l\'iris.';
      if (defis[1]) {
        if (!st.z2) return 'Allume ZEBRA2 : des hachures sur tout ce qui atteint 100 %.';
        if (w >= 99.6) return 'Les zébras hachurent le blanc de la mire : il est écrêté. Ferme l\'iris jusqu\'à ce qu\'ils disparaissent.';
        return w < 90 ? `Plus de zébras, mais le blanc n'est qu'à ${fr(w, 0)} % : rouvre un peu.` : 'Bien.';
      }
      if (defis[0]) {
        if (st.dext && !isSharp(o)) return 'L\'extender grossit le centre : le flou se voit mieux. Fais le point.';
        if (st.dext) return `D.EXTENDER ×${st.dext} : l'image agrandie part aussi vers le car, regarde la sortie. On s'en sert pour vérifier, pas à l'antenne : coupe-le.`;
        if (o.f < 50) return 'Le point se fait en serré : zoome à fond.';
        if (!isSharp(o)) return st.peak < 0.3 ? 'Monte le PEAKING : les contours nets se soulignent de blanc. Tourne la bague de point jusqu\'à ce qu\'ils s\'allument sur l\'étoile.' : 'Tourne la bague de point jusqu\'à ce que le peaking s\'allume sur les branches de l\'étoile.';
        return st.usedDext ? 'Net, et l\'extender est coupé.' : 'Net d\'après le peaking. Vérifie avec le D.EXTENDER.';
      }
      if (!barsOk(st.bright, st.contrast)) {
        const d0 = vfShow(0, st.bright, st.contrast), d4 = vfShow(0.04, st.bright, st.contrast), d1 = (1 + st.bright) * st.contrast;
        if (d0 > 0.02) return 'Le noir des barres est gris : baisse BRIGHT. Ce bouton décale tout l\'affichage, comme le noir d\'un moniteur.';
        if (d4 - d0 < 0.025) return 'Le +4 % du bandeau a disparu dans le noir : BRIGHT est trop bas, ou CONTRAST trop faible.';
        if (d1 < 0.88) return 'Le blanc est terne : monte CONTRAST.';
        return 'Le blanc est écrêté dans le viseur : baisse un peu CONTRAST.';
      }
      return 'Réglé.';
    }
    function up() {
      const o = rings.read(); rings.show();
      const w = st.bars ? 75 : whiteLevels(exposureOf(o.N) * st.light)[1];
      if (!defis[0] && st.bars && barsOk(st.bright, st.contrast)) { defis[0] = true; st.bars = false; }
      if (defis[0] && st.dext && isSharp(o) && o.f >= 50) st.usedDext = true;
      if (defis[0] && !defis[1] && o.f >= 50 && isSharp(o) && st.usedDext && !st.dext) { defis[1] = true; st.light = 1; }
      if (defis[1] && !defis[2] && st.z2 && w >= 90 && w < 99.6) defis[2] = true;
      bright.out.textContent = (st.bright >= 0 ? '+' : '−') + fr(Math.abs(st.bright) * 100, 1);
      contrast.out.textContent = '×' + fr(st.contrast, 2);
      peak.out.textContent = st.peak ? fr(st.peak * 100, 0) + ' %' : 'OFF';
      read.textContent = st.bars ? `Viseur : noir à ${fr(vfShow(0, st.bright, st.contrast) * 100, 1)} %, +4 % à ${fr(vfShow(0.04, st.bright, st.contrast) * 100, 1)} %, blanc à ${fr(Math.min(1, (1 + st.bright) * st.contrast) * 100, 0)} % de l'écran. La sortie, elle, ne change pas.`
        : `Sortie : blanc de la mire ${fr(w, 0)} % · point ${isSharp(o) ? 'net' : 'flou'}${st.dext ? ` · D.EXTENDER ×${st.dext} (la sortie est agrandie)` : ''}`;
      sh.done(defis); sh.say(olivier(o, w));
      v.draw({ f: o.f, dF: o.dF, N: o.N, light: st.light, scene: st.bars ? 'bars' : 'mire' }, {
        bright: st.bright, contrast: st.contrast, peak: st.peak, zebra1: st.z1 ? { level: 70, width: 10 } : null, zebra2: st.z2 ? 100 : null,
        safety: st.safety ? 0.9 : 0, center: st.center, dext: st.dext,
        osd: st.bars ? [] : [`Z ${fr(o.f, 0)} mm`, isFinite(o.N) ? `F${fr(o.N, 1)}` : 'C'], osdR: st.dext ? [`D.EX ×${st.dext}`] : [],
      });
      send(ctx, lensState(st, o, { light: st.light, bars: st.bars, zebra: st.z1 ? [65, 75] : st.z2 ? [100, 999] : null }));
    }
    sh.node.classList.add('c56-lab');
    sh.node.append(btnRow(linkBtn('Recommencer', () => {
      Object.assign(st, init()); defis.fill(false); rings.sync(); bright.set(st.bright); contrast.set(st.contrast); peak.set(0); z1.set(false); z2.set(false); safety.set(false); center.set(true); dext.mark(0); up();
    })));
    up();
    return { node: sh.node, dispose: () => v.dispose() };
  },

  // =================================================================================
  /** le poste du cadreur : équilibrer la caméra sur la tête, plaque et contrepoids, puis le prompteur */
  cadreur(ctx) {
    const init = () => ({ plate: 0, cran: 0, prompteur: false, prompteurSeen: false, lock: true, th: 0, drag: false, test: null, held: { up: false, down: false } });
    const st = init();
    const defis = [false, false, false];
    const S = 430, ax = 220, ay = 252; // 1 m = 430 px ; l'axe d'inclinaison de la tête
    const deg = (r) => r * 180 / Math.PI;
    const pic = liveSvg(300, 'La caméra sur la tête fluide, vue de côté : l\'axe d\'inclinaison, le centre de gravité et sa verticale, la plaque, le contrepoids', 'c56-bal');
    const plate = slider('Plaque', -12, 8, 0.1, 0, (val) => { if (!st.lock) { plate.set(st.plate * 100); msg = 'Verrouille d\'abord l\'inclinaison : on ne fait pas glisser la plaque d\'une caméra libre.'; up(); return; } st.plate = val / 100; st.held = { up: false, down: false }; msg = ''; up(); });
    const cb = slider('Contrepoids', 0, 24, 1, 0, (val) => { st.cran = val; st.held = { up: false, down: false }; msg = ''; up(); });
    const tilt = slider('Inclinaison', -45, 45, 1, 0, (val) => { if (st.lock) { tilt.set(0); msg = 'L\'inclinaison est verrouillée.'; up(); return; } st.th = val * Math.PI / 180; st.test = null; msg = ''; kick(); up(); });
    tilt.input.addEventListener('pointerdown', () => { st.drag = true; });
    for (const t of ['pointerup', 'pointercancel', 'blur']) tilt.input.addEventListener(t, () => { st.drag = false; kick(); });
    const lock = toggle('Verrou d\'inclinaison', true, (val) => { st.lock = val; if (val) { st.th = 0; tilt.set(0); } st.test = null; msg = ''; kick(); up(); });
    const prom = toggle('Prompteur (≈ 5 kg)', false, (val) => { if (!st.lock) { prom.set(st.prompteur); msg = 'Jamais de charge sur une tête libre : verrouille l\'inclinaison avant de poser le prompteur.'; up(); return; } st.prompteur = val; msg = ''; up(); });
    const testUp = el('button', { type: 'button', class: 'btn small', onclick: () => test(1) }, 'Lâcher à +30°');
    const testDown = el('button', { type: 'button', class: 'btn small', onclick: () => test(-1) }, 'Lâcher à −30°');
    const read = readout();
    const sh = shell({ vf: { canvas: pic.node }, ctrls: [btnRow(lock.btn, prom.btn), plate.row, cb.row, tilt.row, btnRow(testUp, testDown), read], vfClass: 'cl-vf-plate', defis: [
      'Inclinaison verrouillée, fais glisser la plaque jusqu\'à ce que la caméra tienne seule à l\'horizontale, verrou ouvert.',
      'Règle le contrepoids : lâchée à +30° puis à −30°, la caméra doit rester où on la laisse.',
      'On pose le prompteur : verrou fermé d\'abord, puis rééquilibre la plaque et le contrepoids, et refais les deux essais.',
    ] });
    let msg = '', raf = 0, last = 0;
    function test(sgn) {
      if (st.lock) { msg = 'Ouvre d\'abord le verrou d\'inclinaison.'; up(); return; }
      st.th = sgn * Math.PI / 6; st.test = { sgn, t: 0, th0: st.th }; tilt.set(30 * sgn); msg = ''; kick(); up();
    }
    const bal = () => balanceOf({ plate: st.plate, cb: st.cran * AXE.cran, prompteur: st.prompteur });
    /** la tête libre : le couple fait tourner la caméra, freinée par le fluide (ordre de grandeur) */
    function kick() { if (!raf && !st.lock) { last = performance.now(); raf = requestAnimationFrame(step); } }
    function step(now) {
      raf = 0; const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (st.lock) return;
      const b = bal(), tau = b.tau(st.th);
      let moving = false;
      if (!st.drag && Math.abs(tau) > AXE.hold) {
        const th = clamp(st.th + tau / 4 * dt, -Math.PI / 3, Math.PI / 3);
        moving = Math.abs(th - st.th) > 1e-5; st.th = th; tilt.set(Math.round(deg(th)));
      }
      if (st.test) {
        st.test.t += dt;
        if (Math.abs(st.th - st.test.th0) > 2 * Math.PI / 180) { st.test = null; msg = tau < 0 ? 'Elle redescend : le contrepoids est trop fort, ou le centre de gravité en avant.' : 'Elle continue de monter… ou de partir : le contrepoids ne compense pas le poids.'; }
        else if (st.test.t >= 1) { st.held[st.test.sgn > 0 ? 'up' : 'down'] = true; msg = `Elle reste à ${st.test.sgn > 0 ? '+' : '−'}30°.`; st.test = null; }
      }
      up();
      if (moving || st.test) raf = requestAnimationFrame(step);
    }
    function draw(b) {
      const c = Math.cos(st.th), s = Math.sin(st.th), xa = AXE.xn - st.plate;
      // un point de la caméra (repère de la caméra) à l'écran, après l'inclinaison
      const P = (x, y) => { const X = x - xa, Y = y + AXE.h; return [ax + (X * c - Y * s) * S, ay - (X * s + Y * c) * S]; };
      const poly = (pts, cls) => `<polygon class="${cls}" points="${pts.map(([x, y]) => P(x, y).map((v) => v.toFixed(1)).join(',')).join(' ')}"/>`;
      const box = (x0, y0, x1, y1, cls) => poly([[x0, y0], [x1, y0], [x1, y1], [x0, y1]], cls);
      const cam = box(-0.314, -0.123, -0.016, 0.074, 'cf-body') + box(0, -0.0475, 0.2375, 0.0475, 'cf-lens') + box(0.2375, -0.06, 0.29, 0.06, 'cf-lens')
        + box(-0.405, 0.172, -0.30, 0.322, 'cf-body') + box(-0.36, 0.074, -0.33, 0.172, 'c56-brk') + box(-0.30, -0.19, -0.03, -0.165, 'c56-plt')
        + (st.prompteur ? box(0.05, -0.2, 0.33, 0.09, 'c56-prom') : '');
      const bar = poly([[-0.30, -0.18], [-0.68, -0.30], [-0.68, -0.27], [-0.30, -0.165]], 'c56-bar');
      const [gx, gy] = P(b.xg, b.yg);
      const off = gx - ax;
      const verdict = Math.abs(b.tau(st.th)) <= AXE.hold ? 'elle reste' : b.tau(st.th) < 0 ? 'elle pique du nez' : 'elle part en arrière';
      return `<rect class="c56-head" x="${ax - 36}" y="${ay - 6}" width="72" height="34" rx="6"/><rect class="c56-leg" x="${ax - 20}" y="${ay + 28}" width="40" height="14"/>
        ${bar}${cam}<circle class="c56-axis" cx="${ax}" cy="${ay}" r="6"/>
        <line class="cf-dash" x1="${gx.toFixed(1)}" y1="${gy.toFixed(1)}" x2="${gx.toFixed(1)}" y2="${ay + 30}"/>
        <circle class="c56-cg" cx="${gx.toFixed(1)}" cy="${gy.toFixed(1)}" r="7"/><path class="c56-cgx" d="M${(gx - 7).toFixed(1)} ${gy.toFixed(1)} h14 M${gx.toFixed(1)} ${(gy - 7).toFixed(1)} v14"/>
        ${T(16, 18, `Masse ≈ ${fr(b.m, 1)} kg · ${verdict}`, 'cf-t')}
        ${T(16, 36, `Centre de gravité ${Math.abs(off) < 1 ? 'au-dessus de l\'axe' : `${fr(Math.abs(off) / S * 100, 1)} cm ${off > 0 ? 'en avant' : 'en arrière'} de l'axe`}, ${fr(b.Y * 100, 0)} cm au-dessus`, 'cf-sub')}
        ${T(ax, ay + 22, 'tête fluide', 'cf-tick')}${T(ax + 44, ay + 4, st.lock ? 'verrou fermé' : 'tête libre', 'cf-tick l')}`;
    }
    function up() {
      const b = bal(), plateCm = st.plate * 100;
      const flatOk = Math.abs(b.m * G * (b.X)) <= AXE.hold, cbOk = Math.abs(b.need - st.cran * AXE.cran) * 0.5 <= AXE.hold;
      if (!defis[0] && !st.lock && flatOk && Math.abs(st.th) < 2 * Math.PI / 180 && !st.prompteur) defis[0] = true;
      if (defis[0] && !defis[1] && !st.prompteur && st.held.up && st.held.down && flatOk && cbOk) { defis[1] = true; st.held = { up: false, down: false }; }
      if (defis[1] && !defis[2] && st.prompteur && st.held.up && st.held.down && flatOk && cbOk) defis[2] = true;
      if (st.prompteur !== st.prompteurSeen) { st.held = { up: false, down: false }; st.prompteurSeen = st.prompteur; }
      plate.out.textContent = `${plateCm >= 0 ? '+' : '−'}${fr(Math.abs(plateCm), 1)} cm`;
      cb.out.textContent = `cran ${st.cran} · ${st.cran * AXE.cran} N·m`;
      tilt.out.textContent = `${Math.round(deg(st.th))}°`;
      plate.input.disabled = !st.lock; tilt.input.disabled = st.lock; testUp.disabled = testDown.disabled = st.lock;
      read.textContent = `Couple du poids à l'horizontale : ${fr(Math.abs(b.m * G * b.X), 2)} N·m ${b.X > 0 ? 'vers l\'avant' : 'vers l\'arrière'} · à 30° il faudrait ${fr(b.need, 1)} N·m de contrepoids, la tête en donne ${st.cran * AXE.cran}.`;
      pic.set(draw(b));
      sh.done(defis); sh.say(msg || olivier(b, flatOk, cbOk));
      send(ctx, {});
    }
    function olivier(b, flatOk, cbOk) {
      if (defis[2]) return 'Avec le prompteur, la caméra pèse presque deux fois plus et son centre de gravité a avancé : nouvelle plaque, nouveau contrepoids. Toute charge ajoutée (pare-soleil, housse, prompteur) se rééquilibre, verrou fermé.';
      if (defis[1]) {
        if (!st.prompteur) return st.lock ? 'Pose le prompteur.' : 'Ferme le verrou d\'inclinaison avant de poser le prompteur.';
        if (!flatOk) return st.lock ? (b.X > 0 ? 'Le prompteur tire vers l\'avant : recule la plaque.' : 'Trop loin : avance un peu la plaque.') : 'Ferme le verrou pour déplacer la plaque.';
        if (!cbOk) return 'La caméra est plus lourde : il faut plus de contrepoids. Essaie à +30° et à −30°.';
        return 'Refais les deux essais : +30° et −30°.';
      }
      if (defis[0]) {
        if (!cbOk) return b.need > st.cran * AXE.cran ? 'Lâchée inclinée, elle continue de basculer : son centre de gravité est au-dessus de l\'axe, il faut des ressorts. Monte le contrepoids.' : 'Lâchée inclinée, elle revient vers l\'horizontale : trop de contrepoids. Baisse-le.';
        return st.held.up ? 'Essaie maintenant à −30°.' : 'Lâche-la à +30°, puis à −30°.';
      }
      if (st.lock) return flatOk ? 'Ouvre le verrou d\'inclinaison et regarde si elle tient.' : 'Le centre de gravité n\'est pas au-dessus de l\'axe : fais glisser la plaque, verrou fermé, puis ouvre le verrou pour essayer.';
      if (!flatOk) return b.X > 0 ? 'Elle pique du nez : verrouille et recule la plaque.' : 'Elle part en arrière : verrouille et avance la plaque.';
      return 'Remets-la à l\'horizontale.';
    }
    sh.node.classList.add('c56-lab');
    sh.node.append(btnRow(linkBtn('Recommencer', () => { if (raf) cancelAnimationFrame(raf); raf = 0; Object.assign(st, init()); msg = ''; plate.set(0); cb.set(0); tilt.set(0); lock.set(true); prom.set(false); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => { if (raf) cancelAnimationFrame(raf); raf = 0; } };
  },
};
