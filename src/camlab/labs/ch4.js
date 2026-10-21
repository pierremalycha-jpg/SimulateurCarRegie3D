// @ts-check
import { el } from '../../util.js';
import { MIRE_D, SENSOR, zoomPos, exposureOf, fr } from '../optics.js';
import {
  makeViewfinder, drawScope, decode, oetf, blackGammaCurve, kneeCurve, paintLevels, linOf, hueSat, hueDiff,
  userMatrix, mulMatrix, code10, code8, Y709, MIRE_WHITE, OUTSIDE, SKIN, PATCHES, PORTRAIT, VMAX,
} from '../vf.js';
import { slider, seg, toggle, btnRow, linkBtn, lensRings, lensState, shell, scopeCanvas, irisPos, pointPos } from '../controls.js';

// ----------------------------------------------------------------------------------
// Manipulations des fiches du module caméra : le traitement de l'image (chapitre 4). Chacune reçoit ctx = { lens(état) } et
// renvoie { node, dispose } (voir ../labs.js). Le viseur simulé est dans ../vf.js (second chemin, en
// virgule flottante : gamma, black gamma, knee, white clip, détail, saturation, matrice), les
// commandes communes dans ../controls.js, les calculs d'optique dans ../optics.js.
// Les mesures (codes, niveaux, teintes) sont calculées par les mêmes fonctions que l'image du
// viseur (paintLevels, oetf…) : ce que dit Olivier est ce que montre la forme d'onde.
// Les noms des réglages sont ceux du menu PAINT et du menu FILE de la HXC-FB80 (pages P02 VIDEO
// LEVEL, P04 GAMMA, P05 BLACK GAMMA, P06 SATURATION, P07 KNEE, P08 WHITE CLIP, P09 DETAIL 1,
// P13 SKIN DETAIL, P14 USER MATRIX, F02 SCENE FILE, F03 REFERENCE). Sur la caméra, la plupart se
// règlent en valeurs relatives (−99 à +99) ; la maquette affiche ce qu'on lit à la forme d'onde.
// ----------------------------------------------------------------------------------

const send = (ctx, s) => { if (ctx && ctx.lens) ctx.lens(s); };
const readout = () => el('p', { class: 'cl-read' });
const pc = (v, d = 1) => fr(v * 100, d) + ' %';
const sgn = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fr(Math.abs(v), d);
const luma = (v) => Y709[0] * v[0] + Y709[1] * v[1] + Y709[2] * v[2];
/** valeur de l'image (0 à 255) d'un pavé de l'échelle de gris de la mire (0 = noir, 10 = blanc) */
const greyStep = (i) => Math.round(255 * Math.pow(i / 10, 1 / 1.1));
/** pixels par mètre à la distance D (m) pour la focale f (mm), image de hauteur H */
const ppmAt = (D, f, H) => H / (D * SENSOR.h / f);

// ---------------- les tracés (fond sombre, comme la forme d'onde) ----------------
const INK = { grid: 'rgba(120,200,160,0.18)', txt: 'rgba(175,215,195,0.85)', ref: 'rgba(205,210,215,0.55)', cur: '#ffb020', pt: '#4cc3e6', bad: '#ff6a5e', ok: '#5fe08a' };
/** un canvas de tracé, avec ce qu'il montre pour les lecteurs d'écran */
function plotCanvas(label, w = 320, h = 150) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.className = 'c4-plotc';
  c.setAttribute('role', 'img'); c.setAttribute('aria-label', label);
  return c;
}
/**
 * Trace des courbes : o = { x0, xmax, ymax, xt, yt (graduations [valeur, texte]), xl, yl (titres),
 * bands ([{ x | y : [a, b], c }]), curves ([{ f, c, dash, w }]), pts ([{ x, y, t, c, al }]) }
 */
function plot(cv, o) {
  const g = cv.getContext('2d'), w = cv.width, h = cv.height, L = 32, R = 10, T = 10, B = 22, x0 = o.x0 || 0;
  const X = (x) => L + (w - L - R) * (x - x0) / (o.xmax - x0), Y = (y) => h - B - (h - T - B) * Math.min(o.ymax, Math.max(0, y)) / o.ymax;
  g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
  g.font = '600 9px "B612 Mono", monospace'; g.lineWidth = 1;
  for (const b of o.bands || []) { g.fillStyle = b.c; if (b.y) g.fillRect(L, Y(b.y[1]), w - L - R, Y(b.y[0]) - Y(b.y[1])); else g.fillRect(X(b.x[0]), T, X(b.x[1]) - X(b.x[0]), h - B - T); }
  for (const [v, t] of o.yt) { const y = Math.round(Y(v)) + 0.5; g.strokeStyle = INK.grid; g.beginPath(); g.moveTo(L, y); g.lineTo(w - R, y); g.stroke(); g.fillStyle = INK.txt; g.textAlign = 'right'; g.fillText(t, L - 4, y + 3); }
  for (const [v, t] of o.xt) { const x = Math.round(X(v)) + 0.5; g.strokeStyle = INK.grid; g.beginPath(); g.moveTo(x, T); g.lineTo(x, h - B); g.stroke(); g.fillStyle = INK.txt; g.textAlign = 'center'; g.fillText(t, x, h - B + 11); }
  g.fillStyle = INK.txt;
  if (o.xl) { g.textAlign = 'right'; g.fillText(o.xl, w - R, h - 2); }
  if (o.yl) { g.textAlign = 'left'; g.fillText(o.yl, L + 4, T + 8); }
  for (const c of o.curves || []) {
    g.strokeStyle = c.c; g.lineWidth = c.w || 1.6; g.setLineDash(c.dash || []); g.beginPath();
    for (let i = 0; i <= 240; i++) { const x = x0 + (o.xmax - x0) * i / 240, y = c.f(x); if (i) g.lineTo(X(x), Y(y)); else g.moveTo(X(x), Y(y)); }
    g.stroke(); g.setLineDash([]);
  }
  for (const p of o.pts || []) {
    g.fillStyle = p.c || INK.pt; g.beginPath(); g.arc(X(p.x), Y(p.y), 3.5, 0, Math.PI * 2); g.fill();
    if (p.t) { g.textAlign = p.al || 'left'; g.fillText(p.t, X(p.x) + (p.al === 'right' ? -6 : 6), Y(p.y) + (p.dy || -5)); }
  }
}

export const LABS_CH4 = {
  // =================================================================================
  /** conversion et quantification : la mire devient des nombres ; noir 64, blanc 940 ; 8 bits */
  quantif(ctx) {
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(4), nd: 1, bits: 10, step: 10 };
    const defis = [false, false, false];
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame(() => drawScope(sc, vf.signal()));
    const stairs = plotCanvas('Les onze pavés de l\'échelle de gris de la mire et leur code numérique, avec les codes du noir, du blanc et du plafond');
    const rings = lensRings(st, () => up(), ['iris']);
    const bits = seg('Sortie', [[10, '10 bits'], [8, '8 bits']], 10, (v) => { st.bits = Number(v); up(); });
    const probe = slider('Pavé de gris', 0, 10, 1, 10, (v) => { st.step = v; up(); });
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [...rings.rows, bits.row, probe.row, read], defis: [
      'Le blanc de la mire (le dernier pavé de l\'échelle de gris) dépasse. Règle l\'iris pour l\'amener au code 940, le blanc à 100 %, sans le dépasser (entre 915 et 940).',
      'Ferme l\'iris jusqu\'à C : quel code pour le noir ?',
      'Rouvre l\'iris et passe la sortie en 8 bits : ramène le blanc à son code 8 bits (entre 229 et 235).',
    ] });
    sh.screen.append(el('div', { class: 'cl-scope' }, stairs));
    /** le niveau de chaque pavé à l'exposition E : lumière du pavé × E, courbe BT.709, plafond 109 % */
    const level = (i, E) => Math.min(VMAX, oetf(decode(greyStep(i)) * E));
    const code = (V) => (st.bits === 10 ? code10(V) : code8(V));
    function overlay(g, W, H) {
      const o = rings.read(), ppm = ppmAt(MIRE_D, o.f, H), cx = W / 2, cy = H / 2;
      const x = cx - 0.252 * ppm + st.step * 0.0458 * ppm, y = cy + 0.228 * ppm, w = 0.0458 * ppm, h = 0.036 * ppm;
      g.strokeStyle = '#ffb020'; g.lineWidth = 2; g.strokeRect(x - 1, y - 1, w + 2, h + 2);
      const V = isFinite(o.N) ? level(st.step, exposureOf(o.N) * 0.5) : 0;
      g.font = '700 14px "B612 Mono", monospace'; g.fillStyle = '#ffb020'; g.textAlign = 'center';
      g.fillText(String(code(V)), x + w / 2, y + h + 18);
    }
    function olivier(white, E) {
      if (defis[2]) return 'En 8 bits, le noir est au code 16 et le blanc à 235 : 219 pas pour aller du noir au blanc, contre 876 en 10 bits. Un pas de 8 bits vaut quatre pas de 10 bits : c\'est pour cela que le car travaille en 10 bits.';
      if (defis[1]) return st.bits === 8 ? `Le blanc est au code ${code8(white)} en 8 bits. Règle l'iris pour l'amener entre 229 et 235.` : 'Rouvre l\'iris, puis passe la sortie en 8 bits.';
      if (defis[0]) {
        if (E === 0) return 'Iris fermé.';
        return 'Le blanc est à 940. Maintenant, ferme l\'iris jusqu\'à C.';
      }
      if (white > 1.0005) return `Le blanc est au code ${code10(white)}, ${pc(white, 0)} : au-dessus de 940, ce sont des super-blancs. Le signal les transporte jusqu'au code 1019 (109 %), mais ce n'est plus du blanc légal. Ferme l'iris.`;
      if (white < 0.9715) return `Le blanc est au code ${code10(white)} : trop sombre. Ouvre un peu l'iris.`;
      return 'Le blanc est à 940.';
    }
    function up() {
      const o = rings.read(); rings.show();
      const E = isFinite(o.N) ? exposureOf(o.N) * 0.5 : 0;
      const white = level(10, E);
      if (!defis[0] && st.bits === 10 && code10(white) >= 915 && code10(white) <= 940) defis[0] = true;
      if (defis[0] && !defis[1] && E === 0) defis[1] = true;
      if (defis[1] && !defis[2] && st.bits === 8 && code8(white) >= 229 && code8(white) <= 235) defis[2] = true;
      const V = level(st.step, E), L = decode(greyStep(st.step));
      read.textContent = `Pavé ${st.step} : lumière ${pc(L, 1)} du blanc × exposition ${fr(E, 2)} → signal ${pc(V, 1)} → code ${st.bits} bits ${code(V)} (10 bits ${code10(V)} · 8 bits ${code8(V)})`;
      const ten = st.bits === 10, top = ten ? 1023 : 255;
      plot(stairs, {
        x0: -0.5, xmax: 10.5, ymax: top,
        yt: ten ? [[0, '0'], [64, '64'], [512, '512'], [940, '940'], [1019, '1019']] : [[0, '0'], [16, '16'], [128, '128'], [235, '235'], [254, '254']],
        xt: [[0, 'noir'], [5, 'pavé 5'], [10, 'blanc']], yl: `code ${st.bits} bits`,
        bands: [{ y: ten ? [940, 1019] : [235, 254], c: 'rgba(255,176,32,0.12)' }, { y: ten ? [1019, 1023] : [254, 255], c: 'rgba(255,90,80,0.35)' }, { y: ten ? [0, 64] : [0, 16], c: 'rgba(76,195,230,0.12)' }],
        curves: [{ f: (x) => code(level(Math.max(0, Math.min(10, Math.round(x))), E)), c: INK.cur }],
        pts: [{ x: st.step, y: code(V), t: String(code(V)), c: INK.cur, al: st.step > 6 ? 'right' : 'left' }],
      });
      sh.done(defis); sh.say(olivier(white, E));
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5, hi: true, clip: VMAX, overlay });
      send(ctx, lensState(st, o, { light: 0.5 }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { n: irisPos(4), bits: 10, step: 10 }); bits.mark(10); probe.set(10); defis.fill(false); rings.sync(); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** le niveau du noir : master black, noir délavé ou bouché, noirs R, V, B */
  noir(ctx) {
    const st = { z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, mb: 5, bR: 0, bB: 0, cast: 0, mode: 'luma' };
    const defis = [false, false, false];
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame(() => drawScope(sc, vf.signal(), st.mode));
    const rings = lensRings(st, () => up(), ['iris']);
    const mb = slider('MASTER BLACK', -8, 8, 0.1, st.mb, (v) => { st.mb = v; up(); });
    const br = slider('BLACK R', -3, 3, 0.1, 0, (v) => { st.bR = v; up(); });
    const bb = slider('BLACK B', -3, 3, 0.1, 0, (v) => { st.bB = v; up(); });
    const rgb = el('div', { class: 'cl-ctrls', hidden: true }, br.row, bb.row);
    const mode = seg('Mesure', [['luma', 'Forme d\'onde'], ['parade', 'Parade']], 'luma', (v) => { st.mode = v; up(); });
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [...rings.rows, mb.row, rgb, mode.row, read], defis: [
      'Les noirs sont délavés : le noir de la mire (le premier pavé de l\'échelle de gris) est à 5 %. Pose-le entre 0 et 2 % au MASTER BLACK.',
      'Descends le master black sous zéro : à partir de quel réglage les branches de l\'étoile (vers 7 %) se confondent-elles avec le noir ?',
      'Le noir du bleu a dérivé. Ferme l\'iris (C), puis aligne les trois noirs en parade avec BLACK R et BLACK B, le master black entre 0 et 2 %.',
    ] });
    // un décalage de p % au pied de la courbe (pente 4,5 sous 0,018) : p / 450 en lumière linéaire
    const off = (p) => p / 450;
    const blacks = () => /** @type {[number, number, number]} */ ([off(st.mb + st.bR), off(st.mb), off(st.mb + st.bB + st.cast)]);
    const lev = (L, b) => oetf(L + b);
    function olivier(E, k, star) {
      if (defis[2]) return 'Les trois noirs sont alignés : sans cela, toutes les ombres prennent une teinte, ici bleue. La balance des noirs automatique (ABB) fait ce réglage toute seule ; le master black, lui, reste le geste de la vision au manche du RCP.';
      if (defis[1]) {
        if (E > 0) return 'Ferme l\'iris (C) : l\'image entière devient le noir de la caméra, on le lit seul.';
        const d = [k[0] - k[1], k[2] - k[1]];
        if (st.mb < 0 || st.mb > 2) return 'Remets d\'abord le master black entre 0 et 2 %.';
        return `En parade, le bas du bleu est ${d[1] > 0 ? 'au-dessus' : 'au-dessous'} du vert de ${fr(Math.abs(d[1]) * 100, 1)} % : corrige-le avec BLACK B${Math.abs(d[0]) > 0.003 ? ', et le rouge avec BLACK R' : ''}.`;
      }
      if (defis[0]) {
        if (star > 0.005) return `Le noir ne descend pas sous 0 %, mais tout ce qui est plus sombre que ${fr(Math.max(0, -st.mb), 1)} % le rejoint. Les branches de l'étoile sont encore à ${pc(star)} : continue.`;
        return 'Bouché.';
      }
      if (st.mb > 2) return `Le noir est à ${pc(k[1])} : un voile gris sur toute l'image, les noirs sont délavés. Baisse le master black.`;
      if (st.mb < 0) return 'Le noir est à 0 %, mais trop bas : les ombres les plus sombres se perdent. Remonte entre 0 et 2 %.';
      return 'Le noir est posé.';
    }
    function up() {
      const o = rings.read(); rings.show();
      const E = isFinite(o.N) ? exposureOf(o.N) * 0.5 : 0;
      const bl = blacks(), k = bl.map((b) => lev(0, b)), star = lev(decode(18) * E, bl[1]), white = lev(MIRE_WHITE * E, bl[1]);
      if (!defis[0] && st.mb >= 0 && st.mb <= 2) defis[0] = true;
      if (defis[0] && !defis[1] && star <= 0.005) {
        defis[1] = true; st.cast = 2.5; rgb.hidden = false; st.mode = 'parade'; mode.mark('parade');
      }
      if (defis[1] && !defis[2] && E === 0 && st.mb >= 0 && st.mb <= 2 && Math.abs(k[0] - k[1]) <= 0.003 && Math.abs(k[2] - k[1]) <= 0.003) defis[2] = true;
      mb.out.textContent = sgn(st.mb) + ' %'; br.out.textContent = sgn(st.bR) + ' %'; bb.out.textContent = sgn(st.bB) + ' %';
      read.textContent = `Noir de la mire : R ${pc(k[0])} · V ${pc(k[1])} · B ${pc(k[2])} · étoile ${E ? pc(star) : '—'} · blanc ${E ? pc(Math.min(1, white), 0) : '—'}`;
      sh.done(defis); sh.say(olivier(E, k, star));
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5, hi: true, black: bl });
      send(ctx, lensState(st, o, { light: 0.5 }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { n: irisPos(5.6), mb: 5, bR: 0, bB: 0, cast: 0, mode: 'luma' }); mb.set(5); br.set(0); bb.set(0); mode.mark('luma'); rgb.hidden = true; defis.fill(false); rings.sync(); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** gamma et black gamma : la courbe BT.709, sans gamma, le COARSE, les ombres seules */
  gamma(ctx) {
    const st = { z: zoomPos(24), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, on: true, coarse: 0.45, bg: 0 };
    const defis = [false, false, false];
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame(() => drawScope(sc, vf.signal()));
    const cv = plotCanvas('La courbe de la caméra : la lumière en abscisse, le signal en ordonnée ; en pointillé la courbe BT.709, en orange la courbe réglée');
    const rings = lensRings(st, () => up(), []);
    const on = seg('GAMMA', [[true, 'ON'], [false, 'OFF']], true, (v) => { st.on = v === true; up(); });
    const coarse = slider('COARSE', 0.35, 0.6, 0.01, 0.45, (v) => { st.coarse = v; up(); });
    const bg = slider('BLACK GAMMA', -99, 99, 1, 0, (v) => { st.bg = v; up(); });
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [on.row, coarse.row, bg.row, read], defis: [
      'Coupe le gamma (OFF) : à quel niveau sort le gris moyen, 18 % de la lumière du blanc ?',
      'Rallume le gamma et éclaircis les tons moyens au COARSE : le gris à 18 % doit sortir à 45 % (± 1), le blanc reste à 100 %.',
      'Remets le COARSE à 0,45. Les cheveux et le rideau sont sombres : ouvre seulement les ombres au BLACK GAMMA ; l\'ombre à 2 % de lumière doit sortir à 12 % au moins, le gris à 18 % rester à 41 %.',
    ] });
    sh.screen.append(el('div', { class: 'cl-scope' }, cv));
    const g = () => (st.on ? st.coarse : 1);
    const V = (L) => blackGammaCurve(oetf(L, g()), st.bg / 99);
    function olivier(v18, v02) {
      if (defis[2]) return 'Le black gamma ne change que le bas de la courbe : le noir reste le noir, le gris moyen ne bouge pas. On l\'ouvre pour déboucher une tribune à l\'ombre, on le referme pour des noirs plus denses ; le bruit des ombres monte ou descend avec.';
      if (defis[1]) {
        if (Math.abs(st.coarse - 0.45) > 0.005 || !st.on) return 'Remets d\'abord le gamma à 0,45 (ON) : c\'est l\'exposant de la norme BT.709.';
        return `L'ombre à 2 % sort à ${pc(v02)} : monte le BLACK GAMMA jusqu'à 12 %.`;
      }
      if (defis[0]) {
        if (!st.on) return 'Sans gamma, le signal est la lumière elle-même : le gris moyen sort à 18 %. Rallume le gamma.';
        if (v18 < 0.44) return `Le gris à 18 % sort à ${pc(v18)} : baisse le COARSE, l'exposant plus petit relève les tons moyens.`;
        if (v18 > 0.46) return `${pc(v18)} : c'est trop. Remonte un peu le COARSE.`;
        return '45 %.';
      }
      if (st.on && Math.abs(st.coarse - 0.45) < 0.005 && !st.bg) return `Avec la courbe BT.709 (0,45), le gris à 18 % sort à ${pc(v18)} et l'écran le ramène vers 18 % de sa luminosité. Coupe le gamma pour voir ce qu'il apporte.`;
      return 'Coupe le gamma (GAMMA OFF).';
    }
    function up() {
      const o = rings.read();
      const v18 = V(0.18), v02 = V(0.02);
      if (!defis[0] && !st.on) defis[0] = true;
      if (defis[0] && !defis[1] && st.on && v18 >= 0.44 && v18 <= 0.46) defis[1] = true;
      if (defis[1] && !defis[2] && st.on && Math.abs(st.coarse - 0.45) < 0.005 && v02 >= 0.12 && v18 >= 0.40 && v18 <= 0.42) defis[2] = true;
      coarse.out.textContent = fr(st.coarse, 2); bg.out.textContent = sgn(st.bg, 0);
      coarse.input.disabled = !st.on;
      read.textContent = `Gris 18 % → ${pc(v18)} · ombre 2 % → ${pc(v02)} · blanc → ${pc(V(1), 0)}${st.on ? '' : ' (sans gamma)'}`;
      plot(cv, {
        xmax: 1, ymax: 1.05, xt: [[0, '0'], [0.18, '18'], [0.5, '50'], [1, '100 %']], yt: [[0, '0'], [0.41, '41'], [1, '100']],
        xl: 'lumière (% du blanc)', yl: 'signal (%)',
        bands: [{ y: [0, 0.3], c: st.bg ? 'rgba(76,195,230,0.10)' : 'rgba(0,0,0,0)' }],
        curves: [{ f: (x) => oetf(x), c: INK.ref, dash: [4, 3], w: 1.2 }, { f: (x) => x, c: 'rgba(205,210,215,0.25)', w: 1 }, { f: V, c: INK.cur, w: 2 }],
        pts: [{ x: 0.18, y: v18, t: pc(v18, 0), c: INK.cur }, { x: 0.02, y: v02, t: pc(v02, 0), c: INK.pt, dy: -8 }],
      });
      sh.done(defis); sh.say(olivier(v18, v02));
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5, scene: 'portrait', gamma: g(), blackGamma: st.bg / 99 });
      send(ctx, lensState(st, o, { light: 0.5 }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { on: true, coarse: 0.45, bg: 0 }); on.mark(true); coarse.set(0.45); bg.set(0); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** knee et white clip : garder les nuages de la fenêtre, plafonner à 103 % */
  knee(ctx) {
    const st = { z: zoomPos(12), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, on: false, point: 90, slope: 0.3, clip: 109, gain: 4 };
    const defis = [false, false, false];
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame(() => drawScope(sc, vf.signal()));
    const cv = plotCanvas('Le knee : le signal avant le coude en abscisse, après en ordonnée ; le point, la pente, le white clip, et les niveaux du blanc de la mire, du ciel et des nuages');
    const rings = lensRings(st, () => up(), ['iris']);
    const on = seg('KNEE', [[true, 'ON'], [false, 'OFF']], false, (v) => { st.on = v === true; up(); });
    const pt = slider('K POINT', 80, 100, 0.5, st.point, (v) => { st.point = v; up(); });
    const sl = slider('K SLOPE', 0.02, 1, 0.005, st.slope, (v) => { st.slope = v; up(); });
    const wc = slider('WHITE CLIP', 100, 109, 0.5, st.clip, (v) => { st.clip = v; up(); });
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [...rings.rows, on.row, pt.row, sl.row, wc.row, read], defis: [
      'Knee coupé, la fenêtre est un aplat au plafond : plus un nuage. Allume le knee et règle le point et la pente pour que les nuages repassent sous 100 %, détachés du ciel (au moins 1,5 % d\'écart).',
      'Le blanc de la mire (93 %) ne doit pas être écrasé : place le knee point au-dessus, en gardant les nuages sous 100 %.',
      'Le soleil sort : dehors, un diaphragme de plus. Le diffuseur refuse ce qui dépasse 103 % : règle le WHITE CLIP à 103 % au plus.',
    ] });
    sh.screen.append(el('div', { class: 'cl-scope' }, cv));
    const settings = () => ({ knee: st.on ? { point: st.point / 100, slope: st.slope } : null, clip: st.clip / 100 });
    function levels(E) {
      const s = settings(), pre = (lin) => luma(paintLevels(lin, { hi: true }, false)), post = (lin) => luma(paintLevels(lin, s));
      const items = { mire: [MIRE_WHITE * E, MIRE_WHITE * E, MIRE_WHITE * E], immeuble: linOf(OUTSIDE.building, E * st.gain), ciel: linOf(OUTSIDE.sky, E * st.gain), nuages: linOf(OUTSIDE.cloud, E * st.gain) };
      const out = {}; for (const [k, lin] of Object.entries(items)) out[k] = { pre: pre(lin), post: post(lin) };
      return out;
    }
    function olivier(lv) {
      const c = lv.nuages.post, gap = c - lv.ciel.post;
      if (defis[2]) return 'Le white clip coupe net : au-dessus de 103 %, tout devient le même blanc, mais rien ne sort hors limites. Le knee garde le détail des hautes lumières, le white clip garantit le plafond : on règle les deux.';
      if (defis[1]) return st.clip > 103 ? `Les nuages montent à ${pc(c)}. Baisse le WHITE CLIP à 103 %.` : `Le knee n'est plus allumé : rallume-le, sinon toute la fenêtre est un aplat.`;
      if (defis[0]) return st.point / 100 <= lv.mire.pre + 0.005 ? `Le knee point (${fr(st.point, 1)} %) est sous le blanc de la mire (${pc(lv.mire.pre, 0)}) : elle passe dans le coude et perd son contraste. Remonte le point, et adoucis la pente pour garder les nuages sous 100 %.` : `Les nuages à ${pc(c)} : baisse la pente.`;
      if (!st.on) return `Sans knee, le ciel (${pc(lv.ciel.pre, 0)}) et les nuages (${pc(lv.nuages.pre, 0)}) dépassent le plafond : ils sont écrêtés au white clip, un aplat sans détail. Allume le knee.`;
      if (c > 1.0005) return `Les nuages sortent à ${pc(c)} : baisse le knee point ou la pente.`;
      if (gap < 0.015) return `Nuages et ciel ne sont plus qu'à ${fr(gap * 100, 1)} % l'un de l'autre : la pente est si faible que la fenêtre devient un aplat gris. Adoucis.`;
      return 'Les nuages se détachent du ciel.';
    }
    function up() {
      const o = rings.read(); rings.show();
      const E = isFinite(o.N) ? exposureOf(o.N) * 0.5 : 0;
      const lv = levels(E), cl = lv.nuages.post, gap = cl - lv.ciel.post;
      const winOk = st.on && cl <= 1.0005 && gap >= 0.015;
      if (!defis[0] && winOk) defis[0] = true;
      if (defis[0] && !defis[1] && winOk && st.point / 100 > lv.mire.pre + 0.005) { defis[1] = true; st.gain = 8; }
      if (defis[1] && !defis[2] && st.on && st.clip <= 103) defis[2] = true;
      pt.out.textContent = fr(st.point, 1) + ' %'; sl.out.textContent = fr(st.slope, 3).replace(/(,\d\d)0$/, '$1'); wc.out.textContent = fr(st.clip, 1) + ' %';
      pt.input.disabled = sl.input.disabled = !st.on;
      read.textContent = `Mire ${pc(lv.mire.post, 0)} · immeuble ${pc(lv.immeuble.post, 0)} · ciel ${pc(lv.ciel.post)} · nuages ${pc(cl)} (avant le knee : ${pc(lv.nuages.pre, 0)})`;
      const k = settings(), f = (x) => Math.min(k.clip, k.knee ? kneeCurve(x, k.knee.point, k.knee.slope) : x);
      plot(cv, {
        xmax: 2.6, ymax: 1.12, xt: [[0, '0'], [0.5, '50'], [1, '100'], [1.5, '150'], [2, '200'], [2.5, '250 %']], yt: [[0, '0'], [0.5, '50'], [1, '100'], [1.03, '']],
        xl: 'avant le knee', yl: 'signal (%)',
        bands: [{ y: [1, 1.12], c: 'rgba(255,90,80,0.12)' }],
        curves: [{ f: (x) => x, c: 'rgba(205,210,215,0.3)', w: 1, dash: [3, 3] }, { f, c: INK.cur, w: 2 }],
        pts: [{ x: lv.mire.pre, y: lv.mire.post, t: 'mire', c: INK.pt, dy: 14 }, { x: lv.ciel.pre, y: lv.ciel.post, t: 'ciel', c: INK.pt, dy: 14 }, { x: Math.min(2.55, lv.nuages.pre), y: cl, t: 'nuages', c: cl > 1.0005 ? INK.bad : INK.ok, al: 'right', dy: 14 }],
      });
      sh.done(defis); sh.say(olivier(lv));
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5, scene: 'fenetre', windowGain: st.gain, ...settings() });
      send(ctx, lensState(st, o, { light: 0.5 }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { n: irisPos(5.6), on: false, point: 90, slope: 0.3, clip: 109, gain: 4 }); on.mark(false); pt.set(90); sl.set(0.3); wc.set(109); defis.fill(false); rings.sync(); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** le détail : le liseré au bord de la mire, CRISP contre le bruit, SKIN DTL sur le visage */
  detail(ctx) {
    const st = { z: zoomPos(24), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, on: false, level: 0.5, crisp: 0, skinOn: false, skin: 50, gain: 0, mag: false };
    const defis = [false, false, false];
    const W = 640, H = 360;
    const vf = makeViewfinder(W, H);
    const cv = plotCanvas('Le profil d\'une ligne de l\'image au bord gauche de la mire : en pointillé sans détail, en orange avec le détail ajouté', 320, 130);
    const rings = lensRings(st, () => up(), []);
    const on = seg('DETAIL', [[true, 'ON'], [false, 'OFF']], false, (v) => { st.on = v === true; up(); });
    const lv = slider('LEVEL', 0, 2, 0.05, st.level, (v) => { st.level = v; up(); });
    const cr = slider('CRISP', 0, 6, 0.1, 0, (v) => { st.crisp = v; up(); });
    const sk = seg('SKIN DTL', [[true, 'ON'], [false, 'OFF']], false, (v) => { st.skinOn = v === true; up(); });
    const skl = slider('Réduction peau', 0, 100, 5, st.skin, (v) => { st.skin = v; up(); });
    const skinBox = el('div', { class: 'cl-ctrls', hidden: true }, sk.row, skl.row);
    const mag = toggle('Loupe MAG ×3', false, (v) => { st.mag = v; up(); });
    const read = readout();
    const sh = shell({ vf, ctrls: [on.row, lv.row, cr.row, skinBox, btnRow(mag.btn), read], defis: [
      'Le détail est coupé, l\'image est douce. Allume-le et règle son niveau pour que le bord de la mire gagne un liseré blanc de 3 à 6 %.',
      'Le plateau s\'assombrit, la vision monte le gain à +12 dB : le détail fait grésiller le bruit. Monte CRISP pour retirer au moins 70 % du détail ajouté au bruit, en gardant un liseré d\'au moins 2 %.',
      'Le grain de la peau de la présentatrice ressort trop : allume SKIN DTL et réduis de moitié au moins le détail sur la peau, sans toucher au bord de la mire.',
    ] });
    sh.screen.append(el('div', { class: 'cl-scope' }, cv));
    // la ligne mesurée : à travers le bord gauche de la petite mire, entre ses pastilles et son échelle de gris
    const geo = () => { const ppm = ppmAt(MIRE_D, rings.read().f, H), cx = W / 2 + PORTRAIT.mire[0] * ppm, k = PORTRAIT.mireSize / 0.6; return { x: Math.round(cx - 0.3 * k * ppm), y: Math.round(H / 2 + 0.172 * k * ppm) }; };
    let meas = { over: 0, crispCut: 0, skinCut: 0, ok: false };
    /** mesure sur le signal de la caméra : liseré au bord, part du détail retirée au bruit et sur la peau */
    function measure() {
      const s = vf.signal(); if (!s) return;
      const { x: ex, y: ey } = geo(), d = s.data, pre = s.pre;
      const Ly = (x, y) => { const i = (y * W + x) * 4; return (Y709[0] * d[i] + Y709[1] * d[i + 1] + Y709[2] * d[i + 2]) / 255; };
      const prof = [], base = [];
      for (let x = ex - 24; x <= ex + 48; x++) { let a = 0, b = 0; for (let y = ey - 1; y <= ey + 1; y++) { a += Ly(x, y); b += pre ? pre[y * W + x] : Ly(x, y); } prof.push(a / 3); base.push(b / 3); }
      const plateau = prof.slice(24 + 14, 24 + 40).sort((p, q) => p - q)[13], peak = Math.max(...prof.slice(24 - 3, 24 + 9));
      const st2 = s.stats;
      meas = { over: Math.max(0, peak - plateau), crispCut: st2 && st2.flatRaw ? 1 - st2.flatAbs / st2.flatRaw : 0, skinCut: st2 && st2.skinRaw ? 1 - st2.skinAbs / st2.skinRaw : 0, ok: true };
      const fx = (arr) => (x) => arr[Math.max(0, Math.min(arr.length - 1, Math.round(x + 24)))];
      plot(cv, {
        x0: -24, xmax: 48, ymax: 1.09, xt: [[-24, '−24'], [0, 'bord'], [24, '+24'], [48, '+48 px']], yt: [[0, '0'], [0.5, '50'], [1, '100']],
        xl: 'rideau → mire', yl: 'luminance (%)',
        curves: [{ f: fx(base), c: INK.ref, dash: [4, 3], w: 1.2 }, { f: fx(prof), c: INK.cur, w: 2 }],
        pts: [{ x: prof.slice(21, 33).indexOf(peak) - 3, y: peak, t: `+${fr(meas.over * 100, 1)} %`, c: INK.cur }],
      });
      evaluate();
    }
    function olivier() {
      const m = meas;
      if (defis[2]) return 'Le détail des carnations ne touche que la teinte de la peau : le visage s\'adoucit, la mire, la veste et les cheveux restent piqués. Sur la caméra, on désigne la teinte à adoucir en la montrant au centre de l\'image.';
      if (defis[1]) return !st.skinOn ? 'Allume SKIN DTL.' : `Sur la peau, le détail n'est réduit que de ${fr(m.skinCut * 100, 0)} % : augmente la réduction.`;
      if (defis[0]) {
        if (m.over < 0.02) return `Le liseré n'est plus que de ${fr(m.over * 100, 1)} % : CRISP est trop haut, il mange aussi les vrais contours.`;
        return `Le détail ajouté au bruit n'est réduit que de ${fr(m.crispCut * 100, 0)} %. Monte CRISP : sous ce seuil, les petites variations (le bruit) ne reçoivent plus de détail.`;
      }
      if (!st.on) return 'Le détail ajoute à chaque contour un liseré clair du côté clair, sombre du côté sombre : l\'image paraît plus piquée sans être plus nette. Allume-le.';
      if (m.over < 0.03) return `Liseré de ${fr(m.over * 100, 1)} % : monte le niveau.`;
      if (m.over > 0.06) return `Liseré de ${fr(m.over * 100, 1)} % : trop. Le contour devient un trait blanc, l'image paraît « électronique ».`;
      return 'Le bord de la mire est piqué.';
    }
    function evaluate() {
      const m = meas; let changed = false;
      if (!defis[0] && st.on && m.over >= 0.03 && m.over <= 0.06) { defis[0] = true; st.gain = 12; changed = true; }
      else if (defis[0] && !defis[1] && st.gain === 12 && st.on && m.crispCut >= 0.7 && m.over >= 0.02) { defis[1] = true; skinBox.hidden = false; }
      else if (defis[1] && !defis[2] && st.on && st.skinOn && m.skinCut >= 0.5 && m.over >= 0.02) defis[2] = true;
      read.textContent = `Liseré au bord de la mire ${fr(m.over * 100, 1)} %${st.gain ? ` · gain +12 dB · détail retiré au bruit ${fr(m.crispCut * 100, 0)} %` : ''}${st.skinOn ? ` · sur la peau ${fr(m.skinCut * 100, 0)} %` : ''}`;
      sh.done(defis); sh.say(olivier());
      if (changed) up(); // le gain monte : l'image change
    }
    vf.onFrame(measure);
    function up() {
      const o = rings.read();
      lv.out.textContent = fr(st.level, 2); cr.out.textContent = fr(st.crisp, 1) + ' %'; skl.out.textContent = st.skin + ' %';
      lv.input.disabled = cr.input.disabled = !st.on; skl.input.disabled = !st.skinOn;
      // +12 dB : quatre fois le signal et le bruit ; la lumière du plateau baisse d'autant (deux diaphragmes)
      const light = st.gain ? 0.42 / Math.pow(10, 12 / 20) : 0.42;
      const detail = st.on ? { level: st.level, crisp: st.crisp / 100, limit: 0.12, skin: st.skinOn ? st.skin / 100 : 0 } : undefined;
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light, gain: st.gain, noise: st.gain ? 0.006 : 0.0008, scene: 'portrait', clip: VMAX, detail, mag: st.mag });
      send(ctx, lensState(st, o, { light, gain: st.gain }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { on: false, level: 0.5, crisp: 0, skinOn: false, skin: 50, gain: 0, mag: false }); on.mark(false); lv.set(0.5); cr.set(0); sk.mark(false); skl.set(50); mag.set(false); skinBox.hidden = true; defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },

  // =================================================================================
  /** matrice et saturation : raccorder la CAM 2 sur la CAM 1 au vectorscope */
  matrice(ctx) {
    const MIS = userMatrix({ GR: -0.1 }), MIS_SAT = 1.12; // la CAM 2 : un autre modèle, un peu de rouge dans le vert, plus saturée
    const st = { z: zoomPos(24), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, m: { RG: 0, RB: 0, GR: 0, GB: 0, BR: 0, BG: 0 }, sat: 100 };
    const defis = [false, false, false];
    const W = 400, H = 225;
    const vf1 = makeViewfinder(W, H), vf2 = makeViewfinder(W, H);
    vf1.canvas.setAttribute('aria-label', 'Viseur de la caméra 1, la référence'); vf2.canvas.setAttribute('aria-label', 'Viseur de la caméra 2, à raccorder');
    const duo = el('div', { class: 'c4-duo' }, el('figure', {}, vf1.canvas, el('figcaption', {}, 'CAM 1 · référence')), el('figure', {}, vf2.canvas, el('figcaption', {}, 'CAM 2 · à raccorder')));
    const vs = plotCanvas('Vectorscope : en cercles les couleurs de la caméra 1, en points pleins celles de la caméra 2 ; la ligne des carnations', 260, 260);
    vs.classList.add('c4-vsc');
    const rings = lensRings(st, () => up(), []);
    const keys = /** @type {const} */ (['RG', 'RB', 'GR', 'GB', 'BR', 'BG']);
    const sl = {}; for (const k of keys) sl[k] = slider(`${k[0]}-${k[1]}`, -0.3, 0.3, 0.01, 0, (v) => { st.m[k] = v; up(); });
    const sat = slider('SATURATION', 50, 150, 1, 100, (v) => { st.sat = v; up(); });
    const read = readout();
    const sh = shell({ vf: { canvas: duo }, ctrls: [el('div', { class: 'c4-mtx' }, ...keys.map((k) => sl[k].row)), sat.row, read], defis: [
      'Le rouge de la CAM 2 tire vers l\'orange. Avec la matrice (USER MATRIX), ramène sa pastille rouge sur celle de la CAM 1 : moins de 2° d\'écart de teinte.',
      'La CAM 2 est aussi plus saturée : règle sa SATURATION pour que le rouge et le jaune tombent sur leurs cibles (± 3 %).',
      'Vérifie le visage : la carnation de la CAM 2 doit se poser sur celle de la CAM 1 (teinte à 2° près, saturation à 3 % près).',
    ], vfClass: 'c4-vf-duo' });
    sh.screen.append(el('div', { class: 'cl-scope c4-vs' }, vs));
    const cam2 = () => ({ matrix: mulMatrix(userMatrix(st.m), MIS), sat: MIS_SAT * st.sat / 100 });
    const NAMES = [['R', 'rouge'], ['V', 'vert'], ['B', 'bleu'], ['Cy', 'cyan'], ['Mg', 'magenta'], ['J', 'jaune']];
    function points(E) {
      const c2 = cam2(), list = [...PATCHES.flat().map((hex, i) => ({ hex, n: NAMES[i][0], name: NAMES[i][1] })), { hex: SKIN, n: 'peau', name: 'peau' }];
      return list.map((p) => { const lin = linOf(p.hex, E); return { ...p, a: hueSat(...paintLevels(lin, {})), b: hueSat(...paintLevels(lin, c2)) }; });
    }
    function drawVs(pts) {
      const g = vs.getContext('2d'), w = vs.width, h = vs.height, cx = w / 2, cy = h / 2, k = (w / 2 - 16) / 0.42;
      const P = (hs) => [cx + Math.cos(hs.hue * Math.PI / 180) * hs.sat * k, cy - Math.sin(hs.hue * Math.PI / 180) * hs.sat * k];
      g.fillStyle = '#05070a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = INK.grid; g.lineWidth = 1; for (const r of [0.1, 0.2, 0.3, 0.4]) { g.beginPath(); g.arc(cx, cy, r * k, 0, Math.PI * 2); g.stroke(); }
      g.beginPath(); g.moveTo(cx - 0.42 * k, cy); g.lineTo(cx + 0.42 * k, cy); g.moveTo(cx, cy - 0.42 * k); g.lineTo(cx, cy + 0.42 * k); g.stroke();
      g.strokeStyle = 'rgba(255,176,32,0.45)'; g.setLineDash([4, 3]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(123 * Math.PI / 180) * 0.42 * k, cy - Math.sin(123 * Math.PI / 180) * 0.42 * k); g.stroke(); g.setLineDash([]);
      g.font = '600 9px "B612 Mono", monospace'; g.fillStyle = INK.txt; g.textAlign = 'left'; g.fillText('Cb', w - 22, cy - 4); g.fillText('Cr', cx + 4, 12); g.fillText('ligne des chairs', 6, 14);
      for (const p of pts) {
        const [ax, ay] = P(p.a), [bx, by] = P(p.b);
        g.strokeStyle = INK.ref; g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        g.strokeStyle = '#e8ece8'; g.lineWidth = 1.5; g.beginPath(); g.arc(ax, ay, 6, 0, Math.PI * 2); g.stroke(); g.lineWidth = 1;
        g.fillStyle = p.hex; g.beginPath(); g.arc(bx, by, 4, 0, Math.PI * 2); g.fill();
        g.fillStyle = INK.txt; g.textAlign = 'center'; g.fillText(p.n, ax + (ax - cx) * 0.18, ay + (ay - cy) * 0.18 + 3);
      }
    }
    function olivier(r, y, s) {
      const dh = hueDiff(r.b.hue, r.a.hue);
      if (defis[2]) return 'La matrice change la façon dont la caméra mélange ses trois voies, sans toucher au blanc ni aux gris : chaque ligne fait 1. La saturation, elle, agit sur toutes les couleurs à la fois. Au line-up, on raccorde ainsi les caméras de modèles différents.';
      if (defis[1]) return `La peau de la CAM 2 est à ${sgn(hueDiff(s.b.hue, s.a.hue), 1)}° et ${sgn((s.b.sat / s.a.sat - 1) * 100, 0)} % : le rouge est juste, mais pas le visage. La correction n'était pas la bonne : il y avait trop de rouge dans le vert. Essaie G-R.`;
      if (defis[0]) return `Le rouge est à ${sgn((r.b.sat / r.a.sat - 1) * 100, 0)} % de saturation, le jaune à ${sgn((y.b.sat / y.a.sat - 1) * 100, 0)} % : baisse la saturation de la CAM 2.`;
      if (Math.abs(dh) < 2) return 'Le rouge est sur sa cible.';
      return `La pastille rouge de la CAM 2 est décalée de ${sgn(dh, 1)}° vers ${dh > 0 ? 'le jaune' : 'le magenta'} : la caméra voit un peu trop de vert dans le rouge. Cherche quelle voie reçoit du rouge en trop : la voie verte (G-R).`;
    }
    function up() {
      const o = rings.read();
      const E = exposureOf(o.N) * 0.5, pts = points(E);
      const r = pts[0], y = pts[5], s = pts[6];
      const ok = (p, dh = 2, ds = 0.03) => Math.abs(hueDiff(p.b.hue, p.a.hue)) < dh && Math.abs(p.b.sat / p.a.sat - 1) <= ds;
      if (!defis[0] && Math.abs(hueDiff(r.b.hue, r.a.hue)) < 2) defis[0] = true;
      if (defis[0] && !defis[1] && ok(r) && Math.abs(y.b.sat / y.a.sat - 1) <= 0.03) defis[1] = true;
      if (defis[1] && !defis[2] && ok(r) && ok(s)) defis[2] = true;
      for (const k of keys) sl[k].out.textContent = sgn(st.m[k], 2);
      sat.out.textContent = st.sat + ' %';
      read.textContent = `Rouge ${sgn(hueDiff(r.b.hue, r.a.hue), 1)}° · ${sgn((r.b.sat / r.a.sat - 1) * 100, 0)} % ; jaune ${sgn((y.b.sat / y.a.sat - 1) * 100, 0)} % ; peau ${sgn(hueDiff(s.b.hue, s.a.hue), 1)}° · ${sgn((s.b.sat / s.a.sat - 1) * 100, 0)} %`;
      drawVs(pts);
      sh.done(defis); sh.say(olivier(r, y, s));
      const base = { f: o.f, dF: o.dF, N: o.N, light: 0.5, scene: /** @type {'portrait'} */ ('portrait'), osd: false };
      vf1.draw({ ...base, hi: true }); vf2.draw({ ...base, ...cam2() });
      send(ctx, lensState(st, o, { light: 0.5 }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => { for (const k of keys) { st.m[k] = 0; sl[k].set(0); } st.sat = 100; sat.set(100); defis.fill(false); up(); })));
    up();
    return { node: sh.node, dispose: () => { vf1.dispose(); vf2.dispose(); } };
  },

  // =================================================================================
  /** les fichiers de réglage : fichier de scène 1 pour le soir, 2 pour le jour, rappel en une touche */
  fichiers(ctx) {
    /** la peinture de la maquette : knee point (%), pente, détail, saturation (%) */
    const REF = { kp: 95, ks: 0.6, dl: 0.4, sat: 100 }, SOIR = { kp: 95, ks: 0.5, dl: 0.8, sat: 110 };
    const st = { z: zoomPos(12), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, cur: { ...SOIR }, files: [null, { ...REF }, { ...REF }, { ...REF }, { ...REF }, { ...REF }], ref: { ...REF }, store: false, sit: 'soir', msg: '', soir: null };
    const defis = [false, false, false];
    const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame(() => drawScope(sc, vf.signal()));
    const rings = lensRings(st, () => up(), []);
    const kp = slider('K POINT', 80, 100, 0.5, st.cur.kp, (v) => { st.cur.kp = v; up(); });
    const ks = slider('K SLOPE', 0.02, 1, 0.01, st.cur.ks, (v) => { st.cur.ks = v; up(); });
    const dl = slider('DETAIL', 0, 2, 0.05, st.cur.dl, (v) => { st.cur.dl = v; up(); });
    const sat = slider('SATURATION', 50, 150, 1, st.cur.sat, (v) => { st.cur.sat = v; up(); });
    const status = el('p', { class: 'c4-fstat', 'aria-live': 'polite' });
    const storeB = el('button', { type: 'button', class: 'btn small', 'aria-pressed': 'false', onclick: () => { st.store = !st.store; st.msg = st.store ? 'STORE : choisis le numéro du fichier.' : ''; up(); } }, 'STORE');
    const nums = [1, 2, 3, 4, 5].map((i) => el('button', { type: 'button', class: 'btn small c4-num', onclick: () => press(i) }, String(i)));
    const refB = el('button', { type: 'button', class: 'btn small', onclick: () => { st.ref = { ...st.cur }; st.msg = 'F03 REFERENCE : STORE FILE, la référence est écrasée.'; up(); } }, 'STORE FILE');
    const page = el('div', { class: 'c4-fpage' },
      el('div', { class: 'c4-fpt' }, el('b', {}, '<SCENE FILE>'), el('span', {}, 'F02')), el('div', { class: 'c4-fkeys', role: 'group', 'aria-label': 'Fichiers de scène' }, storeB, ...nums),
      el('div', { class: 'c4-fpt' }, el('b', {}, '<REFERENCE>'), el('span', {}, 'F03')), el('div', { class: 'c4-fkeys' }, refB), status);
    const cards = el('div', { class: 'c4-cards', 'aria-label': 'Contenu des fichiers' });
    const read = readout();
    const sh = shell({ vf, scope: sc, ctrls: [kp.row, ks.row, dl.row, sat.row, page, read], extra: cards, defis: [
      'J\'ai réglé le plateau du soir. Garde-le dans le fichier de scène 1 : STORE, puis 1.',
      'Le jour se lève dans la fenêtre : elle est écrêtée. Baisse le knee pour que les nuages repassent sous 100 %, puis garde ce réglage dans le fichier 2.',
      'Le soir revient : retrouve le réglage du soir en une touche.',
    ] });
    const same = (a, b) => !!a && !!b && a.kp === b.kp && a.ks === b.ks && a.dl === b.dl && a.sat === b.sat;
    const paintOf = (p) => ({ knee: { point: p.kp / 100, slope: p.ks }, sat: p.sat / 100, detail: p.dl ? { level: p.dl, limit: 0.12 } : undefined });
    const gainOf = (sit) => (sit === 'jour' ? 4 : 0.12);
    const cloudOf = (p, E, sit) => luma(paintLevels(linOf(OUTSIDE.cloud, E * gainOf(sit)), paintOf(p)));
    const sum = (p) => `knee ${fr(p.kp, 1)} % · pente ${fr(p.ks, 2)} · détail ${fr(p.dl, 2)} · sat. ${p.sat} %`;
    function press(i) {
      if (st.store) { st.files[i] = { ...st.cur }; st.store = false; st.msg = `Fichier de scène ${i} enregistré.`; if (!defis[0] && i === 1 && st.sit === 'soir') st.soir = { ...st.cur }; }
      else { st.cur = { ...st.files[i] }; kp.set(st.cur.kp); ks.set(st.cur.ks); dl.set(st.cur.dl); sat.set(st.cur.sat); st.msg = `Fichier de scène ${i} rappelé.`; }
      up();
    }
    function olivier(E) {
      if (defis[2]) return 'Un geste et la caméra reprend tout le réglage du soir. Les fichiers de scène gardent la peinture d\'une situation ; le fichier de référence reste le zéro de la caméra, réglé par la maintenance ; on ne l\'écrase pas avec un réglage du jour.';
      if (!same(st.ref, REF)) return 'Attention : STORE FILE de la page REFERENCE a remplacé la référence de la caméra. Ce fichier sert de base au line-up : on y enregistre un réglage validé par la maintenance, pas un réglage de scène.';
      if (defis[1]) return same(st.cur, st.files[2]) ? 'Le réglage du jour est en fichier 2. Pour le soir, appuie sur le numéro du fichier qui le garde (sans STORE).' : 'Appuie sur 1 (sans STORE) : le fichier 1 est rappelé.';
      if (defis[0]) {
        if (!same(st.files[1], st.soir)) return 'Le fichier 1 ne contient plus le réglage du soir : il a été écrasé par celui du jour. Recommence, et garde le jour dans un autre fichier.';
        const c = cloudOf(st.cur, E, 'jour');
        if (c > 1.0005) return `Les nuages sont à ${pc(c)} : baisse le knee point ou la pente.`;
        return st.store ? 'Choisis le fichier 2.' : 'Les nuages sont sous 100 %. STORE, puis 2.';
      }
      if (st.store) return 'Appuie sur 1.';
      return 'Un fichier de scène garde toute la peinture d\'une situation. STORE arme l\'enregistrement, le numéro choisit le fichier. Un numéro seul rappelle le fichier.';
    }
    function up() {
      const o = rings.read();
      const E = exposureOf(o.N) * 0.5;
      if (!defis[0] && st.sit === 'soir' && same(st.files[1], st.soir)) { defis[0] = true; st.sit = 'jour'; }
      if (defis[0] && !defis[1] && same(st.files[1], st.soir) && st.files[2] && cloudOf(st.files[2], E, 'jour') <= 1.0005 && same(st.cur, st.files[2])) { defis[1] = true; st.sit = 'soir'; }
      if (defis[1] && !defis[2] && st.sit === 'soir' && same(st.cur, st.files[1]) && same(st.files[1], st.soir)) defis[2] = true;
      kp.out.textContent = fr(st.cur.kp, 1) + ' %'; ks.out.textContent = fr(st.cur.ks, 2); dl.out.textContent = fr(st.cur.dl, 2); sat.out.textContent = st.cur.sat + ' %';
      storeB.setAttribute('aria-pressed', String(st.store)); storeB.classList.toggle('on', st.store);
      status.textContent = st.msg;
      cards.replaceChildren(
        ...[1, 2, 3, 4, 5].map((i) => el('div', { class: 'c4-card' + (same(st.cur, st.files[i]) ? ' cur' : '') }, el('b', {}, `Scène ${i}`), el('span', {}, same(st.files[i], REF) ? 'valeurs de la référence' : sum(st.files[i])))),
        el('div', { class: 'c4-card ref' }, el('b', {}, 'Référence · F03'), el('span', {}, same(st.ref, REF) ? 'le zéro de la caméra : ' + sum(st.ref) : 'écrasée : ' + sum(st.ref))),
        el('div', { class: 'c4-card' }, el('b', {}, 'Objectif · F04'), el('span', {}, 'Fujinon ZA12x4.5BERD : les corrections propres à cet objectif')),
        el('div', { class: 'c4-card' }, el('b', {}, 'Opérateur · F01'), el('span', {}, 'le viseur du cadreur : zebra, marqueurs, menu USER')));
      read.textContent = `${st.sit === 'jour' ? 'Le jour dans la fenêtre' : 'Le soir : dehors, il fait nuit'} · nuages ${pc(cloudOf(st.cur, E, st.sit), 0)} · ${sum(st.cur)}`;
      sh.done(defis); sh.say(olivier(E));
      vf.draw({ f: o.f, dF: o.dF, N: o.N, light: 0.5, scene: 'fenetre', windowGain: gainOf(st.sit), clip: 1.05, ...paintOf(st.cur) });
      send(ctx, lensState(st, o, { light: 0.5 }));
    }
    sh.node.append(btnRow(linkBtn('Recommencer', () => {
      Object.assign(st, { cur: { ...SOIR }, files: [null, { ...REF }, { ...REF }, { ...REF }, { ...REF }, { ...REF }], ref: { ...REF }, store: false, sit: 'soir', msg: '', soir: null });
      kp.set(SOIR.kp); ks.set(SOIR.ks); dl.set(SOIR.dl); sat.set(SOIR.sat); defis.fill(false); up();
    })));
    up();
    return { node: sh.node, dispose: () => vf.dispose() };
  },
};
