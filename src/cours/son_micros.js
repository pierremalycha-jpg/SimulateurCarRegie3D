// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import {
  C_SON, paDeSpl, longueurOnde, aDistance, somme, deplacementAir, vDeDbu, dbuDeDbv, DBU_DBV, LIGNE_PRO, LIGNE_GP,
  MICROS, mvParPa, sortieDbv, sortieDbu, sortieMv, gainPour, bruitEquivalent, EIN,
  DIRECTIVITES, polaire, attenuation, angleRejet, facteurQ, indiceDI, facteurDistance, proximite,
  P48, rFantome, uMicro, iCourtCircuit, puissanceMicro, fuite, liaison,
} from './son_micro_calc.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le son », partie « Capter : le son et le micro » : de la pression acoustique au signal (dB SPL,
// distance, longueur d'onde, dBV et dBu), le micro dynamique (type SM58 et SM48 : bobine mobile, induction),
// le micro statique (condensateur, électret, canon), la directivité (A + B cos θ, effet de proximité),
// l'alimentation fantôme 48 V et les liaisons symétriques (XLR, niveaux micro et ligne). Les manipulations
// calculent avec cours/son_micro_calc.js, comme les exercices (cours/exos/son_micros.js) et les vues 3D
// son-micro et son-capsules. Le titre de la partie est celui de PARTIES_SON[0] (cours/son.js), écrit ici
// pour ne pas faire tourner les imports en rond (son.js importe ce fichier).
// ----------------------------------------------------------------------------------
const PARTIE = 'Capter : le son et le micro';
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', copper: '#e0915a', box: '#1a2026', line: '#2a3238', tally: '#f0372c', pvw: '#33c46c', violet: '#c9a7ff' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};
/** un nombre signé avec le vrai signe moins */
const sgn = (v, d = 1) => (v > 1e-9 ? '+' : v < -1e-9 ? '−' : '') + fmtNum(Math.abs(v), d);
const neg = (v, d = 1) => fmtNum(v, d).replace('-', '−');
const dbTxt = (v, unit = 'dB', d = 1) => (v <= -99 ? '−∞' : sgn(v, d)) + ' ' + unit;
/** une tension lisible : µV, mV ou V */
const volts = (v) => (v >= 1 ? fmtNum(v, 2) + ' V' : v >= 0.01 ? fmtNum(v * 1000, 0) + ' mV' : v >= 0.001 ? fmtNum(v * 1000, 2) + ' mV' : fmtNum(v * 1e6, v * 1e6 >= 10 ? 0 : 1) + ' µV');
/** une pression lisible : µPa, mPa ou Pa */
const pascals = (p) => (p >= 1 ? fmtNum(p, p >= 10 ? 0 : 2) + ' Pa' : p >= 1e-3 ? fmtNum(p * 1000, p * 1000 >= 10 ? 0 : 1) + ' mPa' : fmtNum(p * 1e6, 0) + ' µPa');
const metres = (r) => (r < 1 ? fmtNum(r * 100, r < 0.1 ? 1 : 0) + ' cm' : fmtNum(r, r < 10 ? 1 : 0) + ' m');
const hertz = (f) => (f >= 1000 ? fmtNum(f / 1000, f >= 10000 ? 0 : 1) + ' kHz' : fmtNum(f, 0) + ' Hz');
/** curseur logarithmique : u de 0 à 100 parcourt [a, b] */
const logv = (u, a, b) => a * (b / a) ** (u / 100);
const logu = (v, a, b) => Math.round(100 * Math.log(v / a) / Math.log(b / a));
const deg = (v) => fmtNum(v, 0) + '°';

// ======================================================================================
// 1. Du son au signal : pression, décibels, fréquence
// ======================================================================================
const EXEMPLES = [[0, 'seuil d\'audition'], [30, 'studio calme'], [60, 'conversation à 1 m'], [94, 'calibreur : 1 Pa'], [105, 'tribune qui chante'], [120, 'voix chantée à 3 cm'], [130, 'seuil de douleur']];
function figEchelle() {
  const f = figure(720, 250, 'L\'échelle des pressions acoustiques : de 20 micropascals (0 dB SPL, le seuil d\'audition) à 63 pascals (130 dB SPL, le seuil de douleur), avec des exemples en ordre de grandeur ; 94 dB SPL vaut 1 pascal. En dessous, la chaîne : la pression, le micro et sa sensibilité, une tension de quelques millivolts, le préampli et son gain, la console en dBFS.');
  f.append(txt(10, 16, 'La pression acoustique, en pascals et en décibels (dB SPL)', 'co-t', 'start'), txt(710, 16, 'exemples : ordres de grandeur', 'co-s', 'end'));
  const X = (d) => 40 + d / 140 * 640, Y = 70;
  // la bande colorée : vert, ambre, rouge (au-delà de 85 dB, l'oreille s'use sur la durée)
  f.append(sv('rect', { x: X(0), y: Y, width: X(85) - X(0), height: 12, fill: C.pvw, opacity: 0.45 }), sv('rect', { x: X(85), y: Y, width: X(120) - X(85), height: 12, fill: C.amber, opacity: 0.6 }), sv('rect', { x: X(120), y: Y, width: X(140) - X(120), height: 12, fill: C.tally, opacity: 0.6 }));
  for (let d = 0; d <= 140; d += 20) {
    f.append(sv('line', { x1: X(d), y1: Y - 4, x2: X(d), y2: Y + 16, stroke: '#e8eef2' }), txt(X(d), Y + 28, d + ' dB', 'co-m'));
    f.append(txt(X(d), Y - 10, pascals(paDeSpl(d)), 'co-s'));
  }
  EXEMPLES.forEach(([d, t], i) => {
    const y = Y + 46 + (i % 2) * 18;
    f.append(sv('line', { x1: X(d), y1: Y + 14, x2: X(d), y2: y - 10, stroke: C.grey, strokeDasharray: '2 3' }), txt(X(d), y, t, 'co-s', i === 0 ? 'start' : i === EXEMPLES.length - 1 ? 'end' : 'middle', d === 94 ? { fill: C.amber } : {}));
  });
  f.append(txt(X(85), Y - 26, 'au-delà de 85 dB(A) sur une journée : protection obligatoire', 'co-s', 'start', { fill: C.amber }));
  // la chaîne : pression → micro → tension → préampli → console
  const Yc = 172, cells = [['Pression', 'Pa · dB SPL'], ['Micro', 'mV/Pa · dBV/Pa'], ['Tension', 'mV · dBV · dBu'], ['Préampli', 'gain en dB'], ['Console', 'dBFS']];
  f.append(txt(10, Yc - 10, 'Du son au signal', 'co-t', 'start'));
  cells.forEach(([a, b], i) => {
    const x = 10 + i * 144;
    f.append(box(x, Yc, 120, 42, i === 1 || i === 3 ? C.amber : C.grey), txt(x + 60, Yc + 18, a, 'co-t'), txt(x + 60, Yc + 34, b, 'co-m'));
    if (i < cells.length - 1) f.append(arrow(x + 122, Yc + 21, x + 142, Yc + 21));
  });
  f.append(txt(360, Yc + 62, 'Exemple : 94 dB SPL (1 Pa) × 1,88 mV/Pa (type SM58) = 1,88 mV, soit −52 dBu ; +52 dB de gain l\'amènent à 0 dBu = −18 dBFS', 'co-s'));
  return f;
}
function demoAcoustique(host) {
  let L1 = 80, r = 2, f = 1000, deux = 'non', mic = 'sm58';
  const cv = canvas(720, 250, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Pression à la distance', 'Niveau au micro', 'Avec la deuxième source', 'Longueur d\'onde', 'Mouvement de l\'air', 'Tension du micro']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const Lr = aDistance(L1, 1, r), Ltot = deux === 'non' ? Lr : somme(Lr, Lr, deux === 'coh');
    const p = paDeSpl(Ltot), lam = longueurOnde(f), M = MICROS[mic];
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 250);
    // l'onde dans l'air : trois longueurs d'onde à l'écran, les tranches d'air serrées (surpression) et écartées
    const span = 3 * lam, W0 = 680, x0 = 20;
    g.font = '11px Arial, sans-serif'; g.fillStyle = '#aab4ba';
    g.fillText(`l'air à ${hertz(f)} : 3 longueurs d'onde sur ${metres(span)} (surpressions en clair)`, x0, 14);
    for (let i = 0; i < 260; i++) {
      const u = i / 260; const ph = Math.sin(2 * Math.PI * 3 * u);
      const x = x0 + u * W0 + ph * 2.2;
      g.fillStyle = `rgba(127,211,243,${0.18 + 0.32 * (ph + 1) / 2})`; g.fillRect(x, 24, 1.6, 54);
    }
    g.strokeStyle = C.amber; g.lineWidth = 1.5; g.beginPath();
    for (let i = 0; i <= 400; i++) { const u = i / 400; const y = 120 - Math.sin(2 * Math.PI * 3 * u) * 22; if (i) g.lineTo(x0 + u * W0, y); else g.moveTo(x0 + u * W0, y); }
    g.stroke();
    g.strokeStyle = '#e8eef2'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0 + W0 / 12, 150); g.lineTo(x0 + W0 / 12 + W0 / 3, 150); g.stroke();
    g.fillStyle = '#e8eef2'; g.fillText(`λ = c ÷ f = ${metres(lam)}`, x0 + W0 / 12, 164);
    g.fillStyle = '#aab4ba'; g.fillText('pression (ambre) : au-dessus de la ligne, surpression ; en dessous, dépression', x0 + W0 / 2, 164);
    // l'échelle des niveaux : à 1 m, au micro, avec la deuxième source
    const X = (d) => 40 + Math.max(0, Math.min(140, d)) / 140 * 640, Y = 200;
    g.fillStyle = '#1f4a2c'; g.fillRect(X(0), Y, X(85) - X(0), 10); g.fillStyle = '#4a4320'; g.fillRect(X(85), Y, X(120) - X(85), 10); g.fillStyle = '#4a2420'; g.fillRect(X(120), Y, X(140) - X(120), 10);
    g.fillStyle = '#aab4ba'; for (let d = 0; d <= 140; d += 20) g.fillText(String(d), X(d) - 6, Y + 26);
    const mark = (d, col, lab, up) => { g.fillStyle = col; g.fillRect(X(d) - 1.5, Y - 8, 3, 26); g.fillText(lab, Math.min(X(d) - 10, 600), up ? Y - 12 : Y + 40); };
    mark(L1, C.grey, `à 1 m : ${fmtNum(L1, 0)} dB`, true); mark(Ltot, C.amber, `au micro : ${fmtNum(Ltot, 1)} dB SPL`, false);
    read.set('Pression à la distance', `${pascals(paDeSpl(Lr))} efficaces, soit ${neg(Lr)} dB SPL à ${metres(r)} (loi en 1/r : ${dbTxt(Lr - L1)} par rapport à 1 m)`);
    read.set('Niveau au micro', `${neg(Ltot)} dB SPL = 20 × log₁₀(${pascals(p)} ÷ 20 µPa)`);
    read.set('Avec la deuxième source', deux === 'non' ? 'pas de deuxième source' : deux === 'coh' ? `deux sources identiques et en phase : les pressions s'ajoutent, ${dbTxt(Ltot - Lr)}` : `deux sources indépendantes : les puissances s'ajoutent, ${dbTxt(Ltot - Lr)}`);
    read.set('Longueur d\'onde', `${metres(lam)} à ${hertz(f)} (c ≈ ${C_SON} m/s)`);
    read.set('Mouvement de l\'air', `± ${fmtNum(deplacementAir(p, f) * 1e6 * Math.SQRT2, deplacementAir(p, f) * 1e6 < 1 ? 2 : 1)} µm crête : la membrane du micro bouge à peu près d'autant`);
    read.set('Tension du micro', `${M.nom} (${fmtNum(mvParPa(M.sens), 2)} mV/Pa) : ${volts(sortieMv(M.sens, Ltot) / 1000)}, soit ${neg(sortieDbv(M.sens, Ltot))} dBV = ${neg(sortieDbu(M.sens, Ltot))} dBu`);
    const v = Ltot >= 120 ? ['ko', 'Au-delà de 120 dB SPL : douloureux à la longue, et le micro statique approche de sa saturation.'] : Ltot >= 85 ? ['warn', 'Au-delà de 85 dB(A) sur une journée, l\'oreille s\'use : casque à bon niveau, bouchons en tribune.'] : ['ok', 'Un niveau confortable. Chaque doublement de la distance retire 6 dB en champ libre ; en salle, la réverbération en retire moins.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Niveau de la source à 1 m', 40, 130, L1, 1, (v) => { L1 = v; draw(); }, (v) => v + ' dB SPL'),
      slider('Distance du micro', 0, 100, logu(r, 0.05, 50), 1, (v) => { r = logv(v, 0.05, 50); draw(); }, (v) => metres(logv(v, 0.05, 50))),
      slider('Fréquence', 0, 100, logu(f, 20, 20000), 1, (v) => { f = logv(v, 20, 20000); draw(); }, (v) => hertz(logv(v, 20, 20000)))),
    el('div', { class: 'co-ctl' },
      choice('Deuxième source au même niveau', [['non', 'aucune'], ['inco', 'indépendante'], ['coh', 'identique, en phase']], deux, (v) => { deux = v; draw(); }),
      choice('Micro', [['sm58', 'dynamique type SM58'], ['statique', 'statique']], mic, (v) => { mic = v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'En haut, l\'air comprimé et détendu par le son, à l\'échelle de la longueur d\'onde ; en bas, les niveaux en dB SPL (vert : sans risque ; ambre : au-delà de 85 dB, l\'oreille s\'use sur la durée ; rouge : douleur).')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 2. Le micro dynamique : le type SM58 ouvert
// ======================================================================================
function figDynamique() {
  const f = figure(720, 260, 'Un micro dynamique de type SM58 en coupe : la grille et sa mousse anti-pop, la membrane collée à une bobine de fil fin qui plonge dans l\'entrefer d\'un aimant, la suspension qui isole la capsule du corps, puis le connecteur XLR : broche 1 masse, 2 point chaud, 3 point froid. La pression pousse la membrane, la bobine se déplace dans le champ de l\'aimant, une tension apparaît à ses bornes.');
  f.append(txt(10, 16, 'Le micro dynamique : une bobine qui bouge dans un aimant', 'co-t', 'start'));
  // l'onde qui arrive
  for (let i = 0; i < 4; i++) f.append(sv('path', { d: `M${30 + i * 14} 70 Q${44 + i * 14} 130 ${30 + i * 14} 190`, fill: 'none', stroke: C.cyan, strokeWidth: 1.4, opacity: 1 - i * 0.2 }));
  f.append(txt(52, 210, 'pression', 'co-s'));
  // la grille, sa mousse
  f.append(sv('path', { d: 'M150 60 A70 70 0 0 0 150 200', fill: 'none', stroke: C.grey, strokeWidth: 3, strokeDasharray: '3 3' }), sv('path', { d: 'M160 72 A60 60 0 0 0 160 188', fill: 'none', stroke: '#59646f', strokeWidth: 8, opacity: 0.6 }));
  // la membrane et la bobine
  f.append(sv('path', { d: 'M186 84 Q176 130 186 176', fill: 'none', stroke: C.amber, strokeWidth: 3 }));
  f.append(sv('rect', { x: 186, y: 108, width: 40, height: 8, fill: C.copper }), sv('rect', { x: 186, y: 144, width: 40, height: 8, fill: C.copper }));
  // l'aimant et les pièces polaires (un U couché, l'aimant au centre)
  f.append(sv('rect', { x: 200, y: 119, width: 60, height: 22, fill: '#9aa2aa' }), txt(232, 134, 'aimant', 'co-s', 'middle', { fill: '#0b0e10' }));
  f.append(sv('path', { d: 'M196 98 H272 V162 H196 V154 H262 V106 H196 Z', fill: '#59646f', stroke: '#8a949c' }));
  f.append(sv('text', { x: 268, y: 92, textAnchor: 'middle', class: 'co-s' }, 'pièce polaire'));
  // la suspension et le corps
  f.append(sv('rect', { x: 276, y: 96, width: 16, height: 68, rx: 5, fill: '#3a434c' }), sv('rect', { x: 292, y: 108, width: 230, height: 44, rx: 6, fill: '#262c33', stroke: '#59646f' }));
  f.append(sv('path', { d: 'M226 112 C300 90 360 124 470 122', fill: 'none', stroke: C.copper, strokeWidth: 1.2 }), sv('path', { d: 'M226 148 C300 170 360 138 470 140', fill: 'none', stroke: C.copper, strokeWidth: 1.2 }));
  // le XLR
  f.append(sv('rect', { x: 522, y: 104, width: 44, height: 52, rx: 4, fill: '#30373f', stroke: '#8a949c' }));
  for (const [n, y, col] of /** @type {[number, number, string][]} */ ([[2, 118, C.red], [3, 142, C.cyan], [1, 130, C.grey]])) f.append(sv('circle', { cx: 552, cy: y, r: 4, fill: col }), txt(536, y + 4, String(n), 'co-m'));
  f.append(txt(600, 120, '2 : point chaud', 'co-s', 'start', { fill: C.red }), txt(600, 136, '1 : masse', 'co-s', 'start'), txt(600, 152, '3 : point froid', 'co-s', 'start', { fill: C.cyan }));
  // les numéros
  const num = (n, x, y, lab, ly) => { f.append(sv('circle', { cx: x, cy: y, r: 8, fill: '#5c4210', stroke: C.amber }), txt(x, y + 4, String(n), 'co-m'), txt(x, ly, lab, 'co-s')); };
  num(1, 140, 46, 'grille et mousse', 34); num(2, 186, 230, 'membrane', 250); num(3, 214, 70, 'bobine', 58); num(4, 284, 186, 'suspension', 206); num(5, 400, 186, 'corps', 206); num(6, 544, 178, 'XLR', 198);
  f.append(txt(420, 78, 'la bobine bouge dans le champ : e = B · l · v', 'co-s', 'middle', { fill: C.amber }));
  return f;
}
const VOIX = { parle: { nom: 'voix parlée', L1: 60 }, projete: { nom: 'voix projetée', L1: 70 }, chant: { nom: 'chant poussé', L1: 85 } };
function demoDynamique(host) {
  let mic = 'sm58', voix = 'projete', r = 0.05, f = 1000;
  const cv = canvas(720, 230, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Niveau au micro', 'Pression', 'Mouvement de la membrane', 'Tension de sortie', 'En dBV et en dBu', 'Gain pour 0 dBu (−18 dBFS)']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const M = MICROS[mic], spl = aDistance(VOIX[voix].L1, 1, r), mv = sortieMv(M.sens, spl), gain = gainPour(M.sens, spl);
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 230);
    // l'oscilloscope : la tension à la sortie du micro, calibre choisi pour qu'elle tienne dans l'écran
    const pk = mv * Math.SQRT2, cal = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500].find((c) => pk <= c * 3.6) || 500;
    const X0 = 20, W = 440, Y0 = 115, Hd = 25;
    g.strokeStyle = '#1f2a30'; g.lineWidth = 1;
    for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(X0 + i * W / 10, Y0 - 4 * Hd); g.lineTo(X0 + i * W / 10, Y0 + 4 * Hd); g.stroke(); }
    for (let j = -4; j <= 4; j++) { g.beginPath(); g.moveTo(X0, Y0 + j * Hd); g.lineTo(X0 + W, Y0 + j * Hd); g.stroke(); }
    g.strokeStyle = C.amber; g.lineWidth = 2; g.beginPath();
    const periods = 4;
    for (let i = 0; i <= 440; i++) { const y = Y0 - Math.sin(2 * Math.PI * periods * i / 440) * pk / cal * Hd; if (i) g.lineTo(X0 + i, y); else g.moveTo(X0, y); }
    g.stroke();
    g.font = '11px Arial, sans-serif'; g.fillStyle = '#aab4ba';
    g.fillText(`${fmtNum(cal, cal < 1 ? 1 : 0)} mV/div · ${hertz(f)} · ${fmtNum(periods / f * 1000, 1)} ms à l'écran`, X0, 222);
    // le gain : de la sortie du micro à 0 dBu
    const Xg = 520, Yg = (d) => 210 - (d + 70) / 80 * 190;
    g.fillStyle = '#aab4ba'; g.fillText('niveau (dBu)', Xg - 20, 14);
    for (const d of [0, -20, -40, -60]) { g.fillStyle = '#3a444c'; g.fillRect(Xg, Yg(d), 160, 1); g.fillStyle = '#aab4ba'; g.fillText(neg(d, 0), Xg - 30, Yg(d) + 4); }
    const dbu = sortieDbu(M.sens, spl);
    g.fillStyle = C.cyan; g.fillRect(Xg + 20, Yg(dbu), 40, 210 - Yg(dbu)); g.fillStyle = '#0b1013'; g.fillText('micro', Xg + 24, 204);
    g.fillStyle = C.pvw; g.fillRect(Xg + 100, Yg(0), 40, 210 - Yg(0)); g.fillStyle = '#0b1013'; g.fillText('0 dBu', Xg + 102, 204);
    g.strokeStyle = C.amber; g.lineWidth = 2; g.beginPath(); g.moveTo(Xg + 64, Yg(dbu)); g.lineTo(Xg + 96, Yg(0)); g.stroke();
    g.fillStyle = C.amber; g.fillText(`+${fmtNum(gain, 0)} dB`, Xg + 62, (Yg(dbu) + Yg(0)) / 2 - 4);
    read.set('Niveau au micro', `${VOIX[voix].nom} (${VOIX[voix].L1} dB SPL à 1 m) à ${metres(r)} : ${neg(spl)} dB SPL (ordre de grandeur, le champ proche d'une bouche n'est pas un champ libre)`);
    read.set('Pression', pascals(paDeSpl(spl)) + ' efficaces');
    read.set('Mouvement de la membrane', `de l'ordre de ± ${fmtNum(deplacementAir(paDeSpl(spl), f) * 1e6 * Math.SQRT2, 2)} µm à ${hertz(f)}`);
    read.set('Tension de sortie', `${volts(mv / 1000)} efficaces (${fmtNum(mvParPa(M.sens), 2)} mV par pascal)`);
    read.set('En dBV et en dBu', `${neg(sortieDbv(M.sens, spl))} dBV · ${neg(dbu)} dBu (dBu = dBV + ${fmtNum(DBU_DBV, 1)})`);
    read.set('Gain pour 0 dBu (−18 dBFS)', `${fmtNum(gain, 1)} dB`);
    const v = gain > 60 ? ['ko', `Plus de 60 dB de gain : on approche du maximum d'un préampli et de son souffle. Rapprochez le micro ou demandez à parler plus fort.`] : gain < 20 ? ['warn', 'Moins de 20 dB de gain : la source est très forte (ou très proche). Le dynamique l\'encaisse sans broncher ; vérifiez que le préampli ne sature pas.'] : ['ok', `Un gain de ${fmtNum(gain, 0)} dB, dans la course normale d'un préampli micro. Le micro n'a besoin d'aucune alimentation : la bobine produit seule sa tension.`];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Micro', [['sm58', 'type SM58'], ['sm48', 'type SM48']], mic, (v) => { mic = v; draw(); }),
      choice('Source', [['parle', 'voix parlée'], ['projete', 'voix projetée'], ['chant', 'chant poussé']], voix, (v) => { voix = v; draw(); })),
    el('div', { class: 'co-ctl' },
      slider('Distance bouche – micro', 0, 100, logu(r, 0.02, 1), 1, (v) => { r = logv(v, 0.02, 1); draw(); }, (v) => metres(logv(v, 0.02, 1))),
      slider('Fréquence', 0, 100, logu(f, 50, 15000), 1, (v) => { f = logv(v, 50, 15000); draw(); }, (v) => hertz(logv(v, 50, 15000)))),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'À gauche, l\'oscilloscope branché sur les broches 2 et 3 du micro ; à droite, le gain que la console doit ajouter pour amener ce niveau à 0 dBu, le niveau d\'alignement (−18 dBFS).')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 3. Le micro statique : condensateur, électret, canon
// ======================================================================================
function figStatique() {
  const f = figure(720, 250, 'Trois capsules. Le micro statique : une membrane métallisée très fine face à une plaque arrière percée ; la polarisation fixe la charge, la tension suit l\'écart entre les deux ; une électronique d\'adaptation, alimentée par le 48 V, la rend utilisable. L\'électret : la charge est piégée à vie dans un film, l\'électronique demande quand même une alimentation. Le canon : un statique au bout d\'un tube d\'interférence fendu, très directif dans l\'axe.');
  f.append(txt(10, 16, 'Le micro statique : un condensateur dont une armature bouge', 'co-t', 'start'));
  // 1. la capsule statique et son électronique
  const x = 20, y = 40;
  f.append(sv('line', { x1: x + 40, y1: y + 10, x2: x + 40, y2: y + 130, stroke: C.amber, strokeWidth: 2.5 }), txt(x + 40, y + 146, 'membrane (≈ 5 µm)', 'co-s'));
  f.append(sv('rect', { x: x + 52, y: y + 10, width: 12, height: 120, fill: '#59646f' }));
  for (let i = 0; i < 6; i++) f.append(sv('rect', { x: x + 52, y: y + 18 + i * 19, width: 12, height: 5, fill: '#0b1013' }));
  f.append(txt(x + 70, y + 4, 'plaque arrière percée', 'co-s', 'start'));
  f.append(txt(x + 46, y + 162, 'écart ≈ 25 µm', 'co-s'));
  f.append(box(x + 96, y + 46, 86, 48, C.cyan), txt(x + 139, y + 66, 'électronique', 'co-t'), txt(x + 139, y + 82, 'impédance ↓', 'co-s'));
  f.append(arrow(x + 64, y + 70, x + 94, y + 70, C.cyan), arrow(x + 184, y + 70, x + 206, y + 70, C.cyan));
  f.append(txt(x + 139, y + 112, '+48 V : polarisation', 'co-s', 'middle', { fill: C.red }), txt(x + 139, y + 126, 'et électronique', 'co-s', 'middle', { fill: C.red }));
  f.append(txt(x + 110, 236, 'Statique : la tension suit le déplacement', 'co-s', 'middle', { fill: C.amber }));
  // 2. l'électret
  const x2 = 270;
  f.append(sv('line', { x1: x2 + 30, y1: y + 20, x2: x2 + 30, y2: y + 120, stroke: C.amber, strokeWidth: 2.5 }), sv('rect', { x: x2 + 40, y: y + 20, width: 14, height: 100, fill: C.violet, opacity: 0.7 }));
  for (let i = 0; i < 5; i++) f.append(txt(x2 + 47, y + 36 + i * 20, '+', 'co-m', 'middle', { fill: '#0b0e10' }));
  f.append(txt(x2 + 60, y + 14, 'film électret : charge à vie', 'co-s', 'start'), box(x2 + 76, y + 50, 70, 40, C.cyan), txt(x2 + 111, y + 74, 'FET', 'co-t'));
  f.append(txt(x2 + 111, y + 112, 'pile ou 48 V', 'co-s', 'middle', { fill: C.red }), txt(x2 + 111, y + 126, 'pour l\'électronique', 'co-s', 'middle', { fill: C.red }));
  f.append(txt(x2 + 90, 236, 'Électret : micros-cravates, cravates HF', 'co-s', 'middle', { fill: C.amber }));
  // 3. le canon
  const x3 = 470;
  f.append(sv('rect', { x: x3, y: y + 50, width: 200, height: 26, rx: 6, fill: '#262c33', stroke: '#8a949c' }));
  for (let i = 0; i < 9; i++) f.append(sv('rect', { x: x3 + 14 + i * 18, y: y + 50, width: 6, height: 26, fill: '#0b1013' }));
  f.append(sv('rect', { x: x3 + 190, y: y + 44, width: 30, height: 38, rx: 4, fill: '#3a434c' }));
  f.append(arrow(x3 - 34, y + 63, x3 - 4, y + 63, C.green), txt(x3 - 20, y + 50, 'dans l\'axe', 'co-s', 'middle', { fill: C.green }));
  f.append(sv('path', { d: `M${x3 + 60} ${y + 10} L${x3 + 70} ${y + 46}`, stroke: C.red, strokeWidth: 1.4 }), sv('path', { d: `M${x3 + 100} ${y + 10} L${x3 + 108} ${y + 46}`, stroke: C.red, strokeWidth: 1.4 }));
  f.append(txt(x3 + 84, y + 4, 'de côté : les ondes entrent par les fentes et s\'annulent', 'co-s', 'middle', { fill: C.red }));
  f.append(txt(x3 + 100, y + 104, 'tube d\'interférence', 'co-s'), txt(x3 + 205, y + 104, 'capsule', 'co-s'));
  f.append(txt(x3 + 110, 236, 'Canon : le micro des bords terrain', 'co-s', 'middle', { fill: C.amber }));
  return f;
}
const COMPARE = ['sm58', 'statique', 'canon'];
function demoStatique(host) {
  let spl = 50;
  const cv = canvas(720, 220, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(COMPARE.map((k) => MICROS[k].nom));
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 220);
    const X = (d) => 150 + Math.max(0, Math.min(140, d)) / 140 * 540;
    g.font = '11px Arial, sans-serif'; g.fillStyle = '#aab4ba';
    for (let d = 0; d <= 140; d += 20) { g.fillStyle = '#26303a'; g.fillRect(X(d), 16, 1, 170); g.fillStyle = '#aab4ba'; g.fillText(d + ' dB', X(d) - 12, 200); }
    g.fillText('dB SPL au micro', 610, 214);
    COMPARE.forEach((k, i) => {
      const M = MICROS[k], y = 30 + i * 54, nf = bruitEquivalent(M), marge = spl - nf;
      g.fillStyle = '#e8eef2'; g.font = '600 12px Arial, sans-serif'; g.fillText(k === 'sm58' ? 'dynamique (SM58)' : k === 'statique' ? 'statique' : 'canon', 10, y + 16);
      g.font = '11px Arial, sans-serif';
      // le bruit (gris), le son (cyan), la saturation (rouge)
      g.fillStyle = '#4a545c'; g.fillRect(X(0), y, X(nf) - X(0), 24);
      g.fillStyle = marge > 20 ? C.pvw : marge > 0 ? C.amber : C.tally; g.fillRect(X(nf), y + 6, Math.max(0, X(spl) - X(nf)), 12);
      if (M.spMax) { g.fillStyle = 'rgba(240,55,44,0.35)'; g.fillRect(X(M.spMax), y, X(140) - X(M.spMax), 24); }
      g.fillStyle = '#fff'; g.fillRect(X(spl) - 1, y - 4, 2, 32);
      g.fillStyle = '#aab4ba'; g.fillText(`bruit ≈ ${fmtNum(nf, 0)} dB`, X(0) + 4, y + 38);
      read.set(M.nom, `${volts(sortieMv(M.sens, spl) / 1000)} (${neg(sortieDbu(M.sens, spl))} dBu) · gain pour 0 dBu : ${fmtNum(gainPour(M.sens, spl), 0)} dB · marge sur le bruit : ${neg(marge, 0)} dB${M.spMax && spl > M.spMax ? ' · SATURE' : ''}`);
    });
    const ms = COMPARE.map((k) => spl - bruitEquivalent(MICROS[k]));
    const sat = MICROS.statique.spMax != null && spl > MICROS.statique.spMax;
    const v = sat ? ['ko', 'Au-delà de 130 à 135 dB SPL (ordre de grandeur), l\'électronique du statique sature : un dynamique, ou l\'atténuateur (PAD) du statique.'] : ms[0] < 15 ? ['warn', `Un son faible : le dynamique ne garde que ${fmtNum(ms[0], 0)} dB au-dessus du souffle du préampli, le statique ${fmtNum(ms[1], 0)} dB. Plus sensible, il demande moins de gain et garde le son au-dessus du bruit.`] : ['ok', 'Un son assez fort : les trois micros le captent au-dessus du bruit. Le choix se fait sur la directivité, la couleur, la robustesse.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' }, slider('Niveau du son au micro', 20, 140, spl, 1, (v) => { spl = v; draw(); }, (v) => v + ' dB SPL')),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, `Pour chaque micro : en gris, son bruit ramené au micro (bruit propre et souffle d'un bon préampli, ${neg(EIN, 0)} dBu, ordres de grandeur) ; en couleur, ce qui dépasse ; en rouge pâle, la zone où l'électronique du statique sature ; le trait blanc, le son.`)),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 4. La directivité
// ======================================================================================
const DIR_LIST = ['omni', 'large', 'cardio', 'super', 'hyper', 'huit'];
/** le chemin d'un diagramme polaire en amplitude (rayon r pour 1), centre (cx, cy), 0° vers le haut */
function polarPath(d, cx, cy, R) {
  let s = '';
  for (let i = 0; i <= 120; i++) {
    const t = i / 120 * 2 * Math.PI, a = Math.abs(polaire(d, t * 180 / Math.PI)) * R;
    s += `${i ? 'L' : 'M'}${(cx + a * Math.sin(t)).toFixed(1)} ${(cy - a * Math.cos(t)).toFixed(1)}`;
  }
  return s + 'Z';
}
function figDirectivites() {
  const f = figure(720, 210, 'Quatre directivités dessinées par A + B cos θ, la source en haut : l\'omnidirectionnel (un cercle), le cardioïde (rien à l\'arrière), l\'hypercardioïde (plus serré, un petit lobe arrière, deux trous à 110°), la figure en 8 (deux faces en opposition de polarité, rien sur les côtés).');
  f.append(txt(10, 16, 'La directivité : A + B · cos θ (la source est en haut)', 'co-t', 'start'));
  ['omni', 'cardio', 'hyper', 'huit'].forEach((k, i) => {
    const d = DIRECTIVITES[k], cx = 90 + i * 180, cy = 104, R = 62;
    for (const rr of [1, 0.5]) f.append(sv('circle', { cx, cy, r: R * rr, fill: 'none', stroke: '#2a3238' }));
    f.append(sv('line', { x1: cx - R, y1: cy, x2: cx + R, y2: cy, stroke: '#2a3238' }), sv('line', { x1: cx, y1: cy - R, x2: cx, y2: cy + R, stroke: '#2a3238' }));
    f.append(sv('path', { d: polarPath(d, cx, cy, R), fill: 'rgba(255,211,138,.18)', stroke: C.amber, strokeWidth: 1.8 }));
    const rej = angleRejet(d);
    f.append(txt(cx, 186, d.nom.split(' (')[0], 'co-t'), txt(cx, 202, `90° : ${dbTxt(attenuation(d, 90), 'dB', 0)} · 180° : ${attenuation(d, 180) < -60 ? '−∞' : dbTxt(attenuation(d, 180), 'dB', 0)}${rej && rej < 180 ? ` · trou ${fmtNum(rej, 0)}°` : ''}`, 'co-s'));
  });
  return f;
}
function demoDirectivite(host) {
  let dir = 'cardio', src = 0, ret = 180, r = 0.3, f = 100;
  const cv = canvas(720, 300, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['La source', 'Le retour de scène', 'Écart source – retour', 'Angle de rejet', 'Facteur de directivité', 'Effet de proximité']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const d = DIRECTIVITES[dir];
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 300);
    // le diagramme en dB : 0 dB au bord, −30 dB au centre
    const cx = 170, cy = 150, R = 128, rad = (db) => Math.max(0, (db + 30) / 30) * R;
    g.strokeStyle = '#22303a'; g.lineWidth = 1;
    for (const db of [0, -6, -12, -18, -24]) { g.beginPath(); g.arc(cx, cy, rad(db), 0, 2 * Math.PI); g.stroke(); }
    g.fillStyle = '#6a747c'; g.font = '10px Arial, sans-serif';
    for (const db of [0, -6, -12, -18, -24]) g.fillText(db ? neg(db, 0) : '0 dB', cx + 3, cy - rad(db) + 11);
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    g.fillStyle = 'rgba(255,211,138,0.16)'; g.strokeStyle = C.amber; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 180; i++) { const t = i / 180 * 360, a = rad(attenuation(d, t)), q = t * Math.PI / 180; const x = cx + a * Math.sin(q), y = cy - a * Math.cos(q); if (i) g.lineTo(x, y); else g.moveTo(x, y); }
    g.closePath(); g.fill(); g.stroke();
    // le micro au centre, la source et le retour
    g.fillStyle = '#e8eef2'; g.beginPath(); g.arc(cx, cy, 5, 0, 2 * Math.PI); g.fill();
    const at = (t, rr) => [cx + rr * Math.sin(t * Math.PI / 180), cy - rr * Math.cos(t * Math.PI / 180)];
    const [sx, sy] = at(src, R + 14), [wx, wy] = at(ret, R + 14);
    g.fillStyle = C.cyan; g.beginPath(); g.arc(sx, sy, 8, 0, 2 * Math.PI); g.fill(); g.fillStyle = '#0b1013'; g.font = '600 10px Arial, sans-serif'; g.fillText('S', sx - 3, sy + 4);
    g.fillStyle = C.red; g.fillRect(wx - 9, wy - 6, 18, 12); g.fillStyle = '#0b1013'; g.fillText('R', wx - 3, wy + 4);
    g.font = '11px Arial, sans-serif'; g.fillStyle = '#aab4ba'; g.fillText('S : la source · R : le retour de scène', 12, 292);
    // à droite : l'effet de proximité, gain des graves selon la distance, à la fréquence choisie
    const X0 = 360, X1 = 700, Y0 = 250, Y1 = 40, xr = (rr) => X0 + Math.log(rr / 0.01) / Math.log(100) * (X1 - X0), yv = (v) => Y0 - Math.min(25, Math.max(0, v)) / 25 * (Y0 - Y1);
    g.strokeStyle = '#22303a'; for (const v of [0, 5, 10, 15, 20, 25]) { g.beginPath(); g.moveTo(X0, yv(v)); g.lineTo(X1, yv(v)); g.stroke(); g.fillStyle = '#6a747c'; g.fillText('+' + v + ' dB', X0 - 40, yv(v) + 4); }
    for (const rr of [0.01, 0.03, 0.1, 0.3, 1]) { g.fillStyle = '#6a747c'; g.fillText(metres(rr), xr(rr) - 10, Y0 + 16); }
    g.strokeStyle = C.violet; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 100; i++) { const rr = 0.01 * 100 ** (i / 100); const y = yv(proximite(d, f, rr)); if (i) g.lineTo(xr(rr), y); else g.moveTo(xr(rr), y); }
    g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(xr(r), yv(proximite(d, f, r)), 4, 0, 2 * Math.PI); g.fill();
    g.fillStyle = '#aab4ba'; g.fillText(`effet de proximité à ${hertz(f)} (modèle idéal), selon la distance`, X0, 24);
    const as = attenuation(d, src), ar = attenuation(d, ret), rej = angleRejet(d);
    read.set('La source', `à ${deg(src)} de l'axe : ${as < -60 ? '−∞' : dbTxt(as)}`);
    read.set('Le retour de scène', `à ${deg(ret)} : ${ar < -60 ? '−∞ (dans le trou)' : dbTxt(ar)}`);
    read.set('Écart source – retour', ar < -60 ? 'le retour tombe dans le trou de la courbe' : `${fmtNum(as - ar, 1)} dB de plus pour la source`);
    read.set('Angle de rejet', rej == null ? 'aucun : pas de trou' : rej >= 180 ? '180° : tout à l\'arrière' : `${fmtNum(rej, 0)}° (de chaque côté)`);
    read.set('Facteur de directivité', `Q = ${fmtNum(facteurQ(d), 2)} (DI ${fmtNum(indiceDI(d), 1)} dB) : même rapport son direct / salle qu'un omni ${fmtNum(facteurDistance(d), 2)} fois plus près`);
    read.set('Effet de proximité', d.B === 0 ? 'aucun : un omni capte la pression, pas son gradient' : `${dbTxt(proximite(d, f, r))} de graves à ${hertz(f)} à ${metres(r)}`);
    const v = ar - as < -20 || ar < -60 ? ['ok', 'Le retour est loin dans la courbe : le larsen aura de la marge. Placez le retour dans le trou du micro, pas seulement « derrière ».'] : ar - as < -9 ? ['warn', 'Le retour est atténué, mais pas au fond du trou : tournez le micro ou le retour.'] : ['ko', 'Le retour est presque aussi bien capté que la source : le larsen viendra vite. Changez d\'angle ou de directivité.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' }, choice('Directivité', DIR_LIST.map((k) => [k, DIRECTIVITES[k].nom.split(' (')[0]]), dir, (v) => { dir = v; draw(); })),
    el('div', { class: 'co-ctl' },
      slider('Angle de la source', 0, 180, src, 5, (v) => { src = v; draw(); }, deg),
      slider('Angle du retour de scène', 0, 180, ret, 5, (v) => { ret = v; draw(); }, deg)),
    el('div', { class: 'co-ctl' },
      slider('Distance de la source', 0, 100, logu(r, 0.01, 1), 1, (v) => { r = logv(v, 0.01, 1); draw(); }, (v) => metres(logv(v, 0.01, 1))),
      slider('Fréquence (graves)', 0, 100, logu(f, 50, 1000), 1, (v) => { f = logv(v, 50, 1000); draw(); }, (v) => hertz(logv(v, 50, 1000)))),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'À gauche, la courbe de directivité en décibels (0 dB au bord, −30 dB au centre) ; à droite, l\'effet de proximité : ce que gagnent les graves quand la source se rapproche (gradient de pression idéal : un vrai micro le compense en partie).')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 5. L'alimentation fantôme 48 V
// ======================================================================================
function figFantome() {
  const f = figure(720, 240, 'L\'alimentation fantôme P48 : dans la console, le +48 V passe par deux résistances de 6,81 kilohms vers les broches 2 et 3 du XLR ; des condensateurs empêchent la tension continue d\'entrer dans le préampli. Le courant descend par les deux conducteurs de modulation vers le micro statique et revient par la broche 1, la masse. Le signal, la différence entre 2 et 3, n\'en est pas gêné.');
  f.append(txt(10, 16, 'Le 48 V voyage dans le câble micro, sur les deux conducteurs du signal', 'co-t', 'start'));
  // la console
  f.append(box(10, 30, 250, 190, C.grey), txt(135, 48, 'Console (entrée micro)', 'co-t'));
  f.append(box(26, 64, 54, 30, C.red), txt(53, 84, '+48 V', 'co-m', 'middle', { fill: C.red }));
  const R = (x, y, lab) => { f.append(sv('rect', { x, y: y - 7, width: 50, height: 14, fill: '#262c33', stroke: C.amber }), txt(x + 25, y + 4, lab, 'co-m')); };
  f.append(sv('path', { d: 'M80 79 H96 V100 M96 79 V140', stroke: C.red, fill: 'none', strokeWidth: 1.4 }));
  R(100, 100, '6,81 kΩ'); R(100, 140, '6,81 kΩ');
  f.append(sv('path', { d: 'M96 100 H100 M96 140 H100', stroke: C.red, fill: 'none', strokeWidth: 1.4 }));
  f.append(sv('path', { d: 'M150 100 H180 M150 140 H180', stroke: C.red, fill: 'none', strokeWidth: 1.4 }));
  // condensateurs vers le préampli
  for (const y of [100, 140]) f.append(sv('line', { x1: 180, y1: y - 30, x2: 180, y2: y + 6, stroke: C.grey }), sv('line', { x1: 196, y1: y - 30, x2: 196, y2: y - 14, stroke: C.grey }));
  f.append(box(204, 66, 48, 34, C.cyan), txt(228, 87, 'préampli', 'co-s'), txt(135, 200, 'les condensateurs arrêtent le continu', 'co-s'));
  // le câble XLR : broches 2, 3, 1
  const L = (y, col, lab) => { f.append(sv('line', { x1: 180, y1: y, x2: 560, y2: y, stroke: col, strokeWidth: 2.2 }), txt(370, y - 6, lab, 'co-s', 'middle', { fill: col })); };
  L(100, C.red, 'broche 2 : point chaud + 48 V'); L(140, C.cyan, 'broche 3 : point froid + 48 V'); L(180, C.grey, 'broche 1 : masse, retour du courant');
  f.append(sv('line', { x1: 60, y1: 94, x2: 60, y2: 180, stroke: C.grey, strokeDasharray: '3 3' }), sv('line', { x1: 60, y1: 180, x2: 180, y2: 180, stroke: C.grey, strokeWidth: 2.2 }));
  // le micro statique
  f.append(box(560, 70, 150, 130, C.amber), txt(635, 90, 'Micro statique', 'co-t'), txt(635, 112, 'polarisation', 'co-s'), txt(635, 128, '+ électronique', 'co-s'), txt(635, 150, 'quelques mA', 'co-m'), txt(635, 170, 'U = 48 − I × 3,4 kΩ', 'co-m', 'middle', { fill: C.amber }));
  f.append(arrow(520, 112, 556, 112, C.red), arrow(520, 152, 556, 152, C.cyan), arrow(556, 192, 520, 192, C.grey));
  return f;
}
const CHARGE = { statique: { nom: 'micro statique', i: 3 }, canon: { nom: 'micro canon', i: 2 }, dynamique: { nom: 'micro dynamique (bobine de 300 Ω)', i: 0, rb: 300 }, ruban: { nom: 'micro à ruban (transformateur ≈ 300 Ω)', i: 0, rb: 300 } };
function demoFantome(host) {
  let on = true, charge = 'statique', i = 3, defaut = false;
  const svgBox = el('div', { class: 'co-scroll' });
  const read = readout(['Tension au micro', 'Courant par broche', 'Puissance disponible', 'Courant dans la bobine', 'Court-circuit (maximum)']);
  const verdict = el('p', { class: 'co-verdict' });
  const iSlider = slider('Courant demandé par le micro', 0, 12, i, 0.5, (v) => { i = v; draw(); }, (v) => fmtNum(v, 1) + ' mA');
  const draw = () => {
    const C0 = CHARGE[charge], stat = C0.i > 0 || charge === 'statique' || charge === 'canon';
    const I = on && stat ? i : 0, U = on ? uMicro(I) : 0, fu = on && !stat ? fuite(C0.rb || 300, defaut) : 0;
    const fig = figure(720, 170, `Le circuit en ce moment : 48 V ${on ? 'allumé' : 'éteint'}, ${C0.nom}${defaut ? ', broche 3 en court-circuit avec la masse' : ''}.`);
    const lineCol = on ? C.red : '#3a434c';
    fig.append(box(10, 20, 140, 120, on ? C.red : C.grey), txt(80, 40, on ? '+48 V allumé' : '48 V éteint', 'co-t'), txt(80, 62, '2 × 6,81 kΩ', 'co-m'), txt(80, 82, `vu du micro : ${fmtNum(rFantome() / 1000, 3)} kΩ`, 'co-s'));
    fig.append(sv('line', { x1: 150, y1: 60, x2: 520, y2: 60, stroke: lineCol, strokeWidth: 2.2 }), sv('line', { x1: 150, y1: 90, x2: 520, y2: 90, stroke: defaut ? C.tally : lineCol, strokeWidth: 2.2, strokeDasharray: defaut ? '6 4' : '' }), sv('line', { x1: 150, y1: 120, x2: 520, y2: 120, stroke: C.grey, strokeWidth: 2.2 }));
    fig.append(txt(330, 54, `broche 2 : ${on ? fmtNum(I / 2, 2) + ' mA' : '0'}`, 'co-m'), txt(330, 84, defaut ? 'broche 3 touche la masse !' : `broche 3 : ${on ? fmtNum(I / 2, 2) + ' mA' : '0'}`, 'co-m', 'middle', defaut ? { fill: C.red } : {}), txt(330, 114, `broche 1 : retour ${on ? fmtNum(I + fu, 2) + ' mA' : '0'}`, 'co-m'));
    if (defaut) fig.append(sv('line', { x1: 430, y1: 90, x2: 430, y2: 120, stroke: C.tally, strokeWidth: 3 }));
    fig.append(box(520, 20, 190, 120, stat ? C.amber : C.cyan), txt(615, 42, C0.nom.split(' (')[0], 'co-t'), txt(615, 70, stat ? `U = ${fmtNum(U, 1)} V` : `bobine : ${fmtNum(fu, 2)} mA`, 'co-m', 'middle', { fill: stat ? C.amber : fu ? C.red : C.green }), txt(615, 92, stat ? `${fmtNum(I, 1)} mA demandés` : defaut ? 'un courant traverse la bobine' : 'rien ne la traverse', 'co-s'));
    fig.append(txt(360, 160, 'U au micro = 48 V − I × 3,405 kΩ (les deux résistances en parallèle)', 'co-s'));
    svgBox.replaceChildren(fig);
    read.set('Tension au micro', stat ? (on ? `${fmtNum(U, 1)} V` : '0 V : le statique est muet') : on ? '48 V sur les broches 2 et 3, mais 0 V entre elles' : '0 V');
    read.set('Courant par broche', on && stat ? `${fmtNum(I / 2, 2)} mA sur la 2, autant sur la 3, ${fmtNum(I, 1)} mA au retour par la 1` : '0');
    read.set('Puissance disponible', on && stat ? `${fmtNum(puissanceMicro(I), 0)} mW` : '—');
    read.set('Courant dans la bobine', stat ? '—' : fu ? `${fmtNum(fu, 2)} mA continus = 48 V ÷ (6,81 kΩ + ${C0.rb} Ω)` : '0 : les broches 2 et 3 sont au même potentiel');
    read.set('Court-circuit (maximum)', `${fmtNum(iCourtCircuit(), 1)} mA : la P48 ne peut pas faire plus (10 mA au plus prévus pour un micro)`);
    const v = !on && stat ? ['ko', 'Le statique est muet sans 48 V : ni crête ni souffle sur sa tranche. C\'est la panne « micro muet » la plus fréquente.'] : stat && i > P48.imax ? ['ko', `Plus de ${P48.imax} mA : au-delà de ce que prévoit la P48, la tension s'effondre au micro (${fmtNum(U, 1)} V).`] : stat && U < 30 ? ['warn', `Il ne reste que ${fmtNum(U, 1)} V : vérifiez sur la fiche du micro la tension minimale dont il a besoin.`] : fu ? ['ko', charge === 'ruban' ? 'Un courant continu traverse le ruban et son transformateur : un ruban ancien peut y laisser son ruban. Câble à réparer, 48 V à couper.' : 'Un courant continu traverse la bobine : bruit, déformation, membrane décentrée. Le câble est défectueux : on le change.'] : on && !stat ? ['ok', 'Liaison symétrique saine : 48 V sur la 2 et sur la 3, aucune différence entre elles, rien ne traverse la bobine du dynamique. Il fonctionne avec ou sans 48 V.'] : ['ok', `Le statique reçoit ${fmtNum(U, 1)} V et ${fmtNum(I, 1)} mA : il polarise sa capsule et alimente son électronique.`];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Touche 48 V', [['on', 'allumée'], ['off', 'éteinte']], 'on', (v) => { on = v === 'on'; draw(); }),
      choice('Micro branché', Object.entries(CHARGE).map(([k, c]) => [k, c.nom.split(' (')[0].replace('micro ', '')]), charge, (v) => { charge = v; i = CHARGE[v].i || i; const inp = /** @type {HTMLInputElement} */ (iSlider.querySelector('input')); if (CHARGE[v].i) { inp.value = String(i); inp.dispatchEvent(new Event('input')); } draw(); }),
      choice('Câble', [['ok', 'sain'], ['def', 'broche 3 à la masse']], 'ok', (v) => { defaut = v === 'def'; draw(); })),
    el('div', { class: 'co-ctl' }, iSlider),
    svgBox, verdict, read.el);
  draw();
}

// ======================================================================================
// 6. Liaisons symétriques, niveaux micro et ligne
// ======================================================================================
function figLiaisons() {
  const f = figure(720, 250, 'À gauche, les connecteurs : le XLR (broche 1 masse, 2 point chaud, 3 point froid), le jack TRS symétrique (pointe point chaud, bague point froid, corps masse), le jack TS et le RCA, asymétriques. À droite, la liaison symétrique : le signal part en opposition sur les deux conducteurs, un parasite arrive pareil sur les deux, l\'entrée garde la différence : le signal double, le parasite disparaît.');
  f.append(txt(10, 16, 'Les connecteurs, et pourquoi la liaison symétrique annule les parasites', 'co-t', 'start'));
  // XLR femelle vue de face
  const cx = 70, cy = 90;
  f.append(sv('circle', { cx, cy, r: 40, fill: '#262c33', stroke: '#8a949c', strokeWidth: 2 }));
  for (const [n, x, y, col] of /** @type {[number, number, number, string][]} */ ([[1, cx + 18, cy - 12, C.grey], [2, cx - 18, cy - 12, C.red], [3, cx, cy + 20, C.cyan]])) f.append(sv('circle', { cx: x, cy: y, r: 7, fill: '#0b1013', stroke: col, strokeWidth: 2 }), txt(x, y + 4, String(n), 'co-m'));
  f.append(txt(cx, cy + 58, 'XLR femelle, vu de face', 'co-t'), txt(cx, cy + 74, '1 masse · 2 chaud · 3 froid', 'co-s'));
  // jacks
  const jack = (x, y, rings, lab, sub) => {
    f.append(sv('rect', { x, y, width: 90, height: 14, rx: 7, fill: '#9aa2aa' }));
    if (rings > 2) f.append(sv('rect', { x: x + 52, y, width: 4, height: 14, fill: '#0b1013' }));
    f.append(sv('rect', { x: x + 70, y, width: 4, height: 14, fill: '#0b1013' }), sv('rect', { x: x - 40, y: y - 6, width: 40, height: 26, rx: 4, fill: '#30373f' }));
    f.append(txt(x + 25, y + 32, lab, 'co-t'), txt(x + 25, y + 46, sub, 'co-s'));
  };
  jack(180, 46, 3, 'Jack TRS', 'pointe chaud · bague froid · corps masse');
  jack(180, 130, 2, 'Jack TS · RCA', 'asymétriques : signal + masse');
  // la liaison symétrique
  const X0 = 400;
  f.append(txt(X0 + 150, 40, 'La liaison symétrique', 'co-t'));
  const wave = (y, k, col, noise) => { let d = ''; for (let i = 0; i <= 60; i++) { const u = i / 60; const v = k * Math.sin(2 * Math.PI * 2 * u) * 12 + (noise ? Math.sin(2 * Math.PI * 7 * u + 1) * 6 : 0); d += `${i ? 'L' : 'M'}${(X0 + u * 110).toFixed(1)} ${(y - v).toFixed(1)}`; } f.append(sv('path', { d, fill: 'none', stroke: col, strokeWidth: 1.6 })); };
  wave(80, 1, C.red, true); wave(130, -1, C.cyan, true);
  f.append(txt(X0 + 55, 104, '+ parasite', 'co-s'), txt(X0 + 55, 158, '+ le même parasite', 'co-s'));
  f.append(box(X0 + 128, 76, 70, 60, C.amber), txt(X0 + 163, 102, '2 − 3', 'co-t'), txt(X0 + 163, 120, 'différence', 'co-s'));
  f.append(arrow(X0 + 112, 80, X0 + 126, 92, C.red), arrow(X0 + 112, 130, X0 + 126, 120, C.cyan), arrow(X0 + 200, 106, X0 + 214, 106, C.amber));
  let d = ''; for (let i = 0; i <= 60; i++) { const u = i / 60; d += `${i ? 'L' : 'M'}${(X0 + 216 + u * 84).toFixed(1)} ${(106 - Math.sin(2 * Math.PI * 2 * u) * 20).toFixed(1)}`; }
  f.append(sv('path', { d, fill: 'none', stroke: C.green, strokeWidth: 2 }), txt(X0 + 258, 150, 'signal ×2, parasite annulé', 'co-s', 'middle', { fill: C.green }));
  // les niveaux
  const Y = 214, Xl = (db) => 400 + (db + 70) / 90 * 300;
  f.append(txt(400, Y - 18, 'Les niveaux (dBu)', 'co-t', 'start'));
  f.append(sv('rect', { x: Xl(-60), y: Y, width: Xl(-30) - Xl(-60), height: 10, fill: C.cyan, opacity: 0.6 }), sv('rect', { x: Xl(-10 + DBU_DBV) - 3, y: Y, width: 6, height: 10, fill: C.violet }), sv('rect', { x: Xl(4) - 3, y: Y, width: 6, height: 10, fill: C.amber }));
  f.append(txt((Xl(-60) + Xl(-30)) / 2, Y + 24, 'micro', 'co-s'), txt(Xl(-10 + DBU_DBV), Y + 24, '−10 dBV', 'co-s'), txt(Xl(4) + 8, Y + 24, '+4 dBu', 'co-s'));
  for (const db of [-60, -40, -20, 0, 20]) f.append(txt(Xl(db), Y - 4, neg(db, 0), 'co-m'));
  return f;
}
function demoLiaisons(host) {
  let sym = true, src = 'micro', par = 20, deseqPct = 0.1;
  const cv = canvas(720, 260, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Signal utile', 'Parasite capté sur le câble', 'Parasite restant à l\'arrivée', 'Réjection', 'Rapport signal / parasite']);
  const conv = readout(['+4 dBu', '−10 dBV', '0 dBu', 'Écart entre les deux lignes']);
  const verdict = el('p', { class: 'co-verdict' });
  const SRC = { micro: { nom: 'micro dynamique, voix à 5 cm (−40 dBu)', dbu: -40 }, ligne: { nom: 'ligne professionnelle (+4 dBu)', dbu: LIGNE_PRO }, gp: { nom: 'ligne grand public (−10 dBV)', dbu: dbuDeDbv(LIGNE_GP) } };
  const draw = () => {
    const s = SRC[src], sigMv = vDeDbu(s.dbu) * 1000, L = liaison(sigMv, par, sym, deseqPct / 100);
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 260);
    // trois traces : conducteur 2, conducteur 3 (ou masse), à l'arrivée ; même échelle pour les deux premières
    const full = Math.max(sigMv, par) * 1.35, n = 360, X = (i) => 70 + i / n * 630;
    const sig = (i) => Math.sin(2 * Math.PI * 6 * i / n), hum = (i) => Math.sin(2 * Math.PI * 1.2 * i / n) + 0.35 * Math.sin(2 * Math.PI * 3.6 * i / n + 0.7);
    const tr = (y0, h, fn, col, scale) => { g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); for (let i = 0; i <= n; i++) { const y = y0 - Math.max(-1.2, Math.min(1.2, fn(i) / scale)) * h; if (i) g.lineTo(X(i), y); else g.moveTo(X(i), y); } g.stroke(); };
    g.font = '11px Arial, sans-serif'; g.fillStyle = '#aab4ba';
    g.fillText(sym ? 'broche 2' : 'conducteur', 6, 46); g.fillText(sym ? 'broche 3' : 'masse', 6, 116); g.fillText('à l\'arrivée', 6, 196);
    for (const y of [42, 112, 192]) { g.fillStyle = '#1f2a30'; g.fillRect(70, y, 630, 1); }
    tr(42, 28, (i) => sigMv * sig(i) / (sym ? 2 : 1) + par * hum(i), C.red, full);
    tr(112, 28, (i) => (sym ? -sigMv * sig(i) / 2 : 0) + par * hum(i) * (sym ? 1 + deseqPct / 100 : 0), C.cyan, full);
    // à l'arrivée : le signal et le parasite restant, à l'échelle du signal
    tr(192, 40, (i) => sigMv * sig(i) + L.reste * hum(i), C.green, sigMv * 1.3);
    g.fillStyle = '#aab4ba'; g.fillText(`échelle des deux premières traces : ± ${volts(full / 1000)} · à l'arrivée : ± ${volts(sigMv * 1.3 / 1000)}`, 70, 252);
    read.set('Signal utile', `${s.nom} : ${volts(sigMv / 1000)}`);
    read.set('Parasite capté sur le câble', `${volts(par / 1000)} (ronflement du secteur, 50 Hz et harmoniques)`);
    read.set('Parasite restant à l\'arrivée', sym ? `${volts(L.reste / 1000)} : seule la part due au déséquilibre (${fmtNum(deseqPct, 2)} %) reste` : `${volts(L.reste / 1000)} : tout entier, l'entrée ne peut pas le distinguer du signal`);
    read.set('Réjection', sym ? `${fmtNum(L.rejection, 0)} dB (réjection du mode commun)` : '0 dB : rien n\'est rejeté');
    read.set('Rapport signal / parasite', `${neg(L.rapport, 1)} dB`);
    conv.set('+4 dBu', `${fmtNum(vDeDbu(4), 3)} V (0,775 V × 10^(4 ÷ 20))`);
    conv.set('−10 dBV', `${fmtNum(10 ** (-10 / 20), 3)} V = ${neg(dbuDeDbv(-10), 1)} dBu`);
    conv.set('0 dBu', `${fmtNum(vDeDbu(0), 4)} V (1 mW dans 600 Ω)`);
    conv.set('Écart entre les deux lignes', `${fmtNum(LIGNE_PRO - dbuDeDbv(LIGNE_GP), 1)} dB : une source grand public arrive ≈ 12 dB trop bas dans une entrée pro`);
    const v = L.rapport < 20 ? ['ko', 'Le ronflement s\'entend presque autant que le signal : un niveau micro sur une liaison asymétrique longue, c\'est inutilisable. Liaison symétrique, ou boîte de direct (DI) au plus près de la source.'] : L.rapport < 50 ? ['warn', 'Le ronflement reste audible sous le signal : raccourcissez le câble, éloignez-le du secteur, passez en symétrique.'] : ['ok', `Le parasite reste ${fmtNum(L.rapport, 0)} dB sous le signal : inaudible.`];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Liaison', [['sym', 'symétrique (XLR)'], ['asym', 'asymétrique (jack TS)']], 'sym', (v) => { sym = v === 'sym'; draw(); }),
      choice('Source', [['micro', 'micro'], ['ligne', 'ligne +4 dBu'], ['gp', 'ligne −10 dBV']], src, (v) => { src = v; draw(); })),
    el('div', { class: 'co-ctl' },
      slider('Parasite capté sur le câble', 1, 100, par, 1, (v) => { par = v; draw(); }, (v) => v + ' mV'),
      slider('Déséquilibre de la liaison', 0, 100, logu(deseqPct, 0.01, 10), 1, (v) => { deseqPct = logv(v, 0.01, 10); draw(); }, (v) => fmtNum(logv(v, 0.01, 10), 2) + ' %')),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Un câble de plusieurs dizaines de mètres, le long d\'un câble secteur : le parasite capté est une hypothèse que vous réglez. En symétrique, l\'entrée soustrait les deux conducteurs : ne reste que ce que le déséquilibre laisse passer.')),
    verdict, read.el, el('h5', {}, 'Les niveaux de ligne'), conv.el);
  draw();
}

// ======================================================================================
// Les leçons
// ======================================================================================
/** @type {import('./index.js').Lesson[]} */
export const SON_MICROS = [
  {
    id: 'son-acoustique', title: 'Du son au signal : pression, décibels, fréquence', minutes: '8 min', partie: PARTIE,
    essentials: [
      'Le son est une petite variation de la pression de l\'air : de **20 µPa** (0 dB SPL, le seuil d\'audition) à plus de 20 Pa (120 dB SPL) ; **94 dB SPL = 1 Pa**, le niveau des calibreurs.',
      'En champ libre, **doubler la distance retire 6 dB** ; deux sources égales et indépendantes donnent **+3 dB**, deux sources identiques et en phase **+6 dB**.',
      'Le micro change les pascals en volts selon sa **sensibilité** (mV/Pa) : quelques millivolts, comptés en **dBV** (par rapport à 1 V) ou en **dBu** (0,775 V), que le préampli remonte.',
    ],
    figure: figEchelle,
    demoTitle: 'Éloignez le micro de 1 m à 2 m, puis à 4 m : 6 dB chaque fois. Ajoutez une deuxième source indépendante, puis identique et en phase. Descendez la fréquence à 50 Hz : la longueur d\'onde dépasse 6 m.',
    demo: demoAcoustique,
    body: `Un son, c'est l'air qui se comprime et se détend autour de la pression atmosphérique (environ 100 000 Pa). Ces variations sont minuscules : l'oreille entend à partir de **20 µPa** (vingt millionièmes de pascal), et une pression de quelques dizaines de pascals est déjà douloureuse. Pour ranger un rapport d'un million entre le plus faible et le plus fort, on compte en **décibels** : le niveau de pression acoustique vaut **20 × log₁₀(p ÷ 20 µPa)**, en **dB SPL** (sound pressure level). 0 dB SPL est le seuil d'audition, **94 dB SPL vaut exactement 1 Pa** (c'est le niveau d'un calibreur acoustique), 120 dB SPL vaut 20 Pa.

Le facteur **20** vient de ce qu'une pression, comme une tension, est une amplitude : multiplier la pression par 2 ajoute 6 dB, par 10 ajoute 20 dB. Une puissance (ce qu'on additionne quand deux sons indépendants se mélangent) se compte avec un facteur 10 : deux sources de même niveau et **indépendantes** (deux supporters, deux enceintes qui ne jouent pas la même chose) donnent **+3 dB** ; deux sources **identiques et en phase** (deux enceintes qui jouent le même signal, au même point) donnent **+6 dB**, et deux sources identiques en opposition s'annulent.

Le son s'affaiblit avec la distance. En **champ libre** (dehors, loin des murs), la pression baisse comme 1/r : **chaque doublement de la distance retire 6 dB**. Dans une salle, la réverbération en retire moins ; dans un stade, la tribune et le toit renvoient le son : la règle reste un bon ordre de grandeur pour placer un micro. C'est elle qui fait tout l'intérêt d'un micro proche de la source : à 5 cm d'une bouche, la voix arrive 26 dB plus fort qu'à 1 m, la foule pas.

Le son a aussi une **fréquence** (de 20 Hz à 20 kHz pour l'oreille) et donc une **longueur d'onde** λ = c ÷ f, avec c ≈ **343 m/s** dans l'air à 20 °C : 17 m à 20 Hz, 34 cm à 1 kHz, 1,7 cm à 20 kHz. Les graves contournent les obstacles, les aigus s'arrêtent sur une tête ou un pied de micro. À 1 Pa et 1 kHz, l'air ne bouge que d'un demi-micromètre : c'est ce mouvement que la membrane du micro doit suivre.

Le **micro** est le premier maillon : il change la pression en tension, selon sa **sensibilité**, donnée en mV/Pa ou en dBV/Pa. Un micro dynamique de type SM58 donne environ 1,9 mV sous 1 Pa ; un statique, une dizaine de fois plus. Les tensions se comptent aussi en décibels : le **dBV** par rapport à 1 V, le **dBu** par rapport à 0,775 V (1 mW dans 600 Ω, la référence historique des lignes téléphoniques) ; dBu = dBV + 2,2. Le préampli de la console ajoute ensuite son **gain** pour amener ce signal au niveau d'alignement, 0 dBu, qui correspond à −18 dBFS dans la console numérique (EBU R68).

- 94 dB SPL : 1 Pa ; 114 dB SPL : 10 Pa ; un écart de 20 dB, c'est 10 fois la pression.
- Au-delà de 85 dB(A) sur une journée de travail, la protection auditive est obligatoire (valeurs d'exposition de la directive européenne 2003/10/CE).`,
    car: { text: 'En cabine son, chaque micro arrive sur une entrée MIC de la console : les couples d\'ambiance en tribune (MIC 1 à 4), les canons du bord terrain (MIC 5 à 10). Le crête-mètre d\'entrée montre en dBFS ce que la pression devient après le micro et le gain ; un canon loin du ballon reçoit la frappe 20 dB plus bas qu\'un canon proche.', station: 'son' },
    terms: ['db-spl', 'dbu-dbv'],
    competences: ['1.4', '2.9'],
    article: 'songuide',
    quiz: [
      { q: 'Combien vaut une pression de 1 Pa en dB SPL ?', choices: ['94 dB SPL', ['0 dB SPL', '0 dB SPL, c\'est 20 µPa, le seuil d\'audition : 1 Pa est 50 000 fois plus fort.'], ['120 dB SPL', '120 dB SPL, c\'est 20 Pa : vingt fois plus de pression, 26 dB de plus.']], answer: 0, why: '20 × log₁₀(1 Pa ÷ 20 µPa) = 20 × log₁₀(50 000) ≈ 94 dB. C\'est le niveau des calibreurs acoustiques, et celui auquel on donne la sensibilité des micros.' },
      { q: 'Un micro capte une source à 1 m. On l\'éloigne à 4 m, en plein air. Le niveau reçu…', choices: ['baisse de 12 dB', ['baisse de 6 dB', 'C\'est la baisse pour un seul doublement (1 m → 2 m) ; de 1 à 4 m, la distance double deux fois.'], ['est divisé par quatre, soit −6 dB', 'La pression est bien divisée par quatre, mais une pression divisée par 4 perd 20 × log₁₀(4) = 12 dB : c\'est une amplitude, pas une puissance.']], answer: 0, why: 'En champ libre, la pression baisse comme 1/r : −6 dB par doublement de la distance. De 1 à 4 m, deux doublements : −12 dB.' },
      { q: 'Deux supporters crient chacun à 90 dB SPL au niveau du micro, chacun à sa façon. Ensemble, le micro reçoit environ…', choices: [['180 dB SPL', 'Les décibels ne s\'additionnent pas : ce sont des logarithmes. Deux sources égales ajoutent 3 ou 6 dB, jamais le double.'], '93 dB SPL', ['96 dB SPL', '+6 dB, c\'est pour deux sources identiques et en phase, dont les pressions s\'ajoutent. Deux voix différentes sont indépendantes : leurs puissances s\'ajoutent.']], answer: 1, why: 'Deux sources indépendantes de même niveau : la puissance double, 10 × log₁₀(2) ≈ +3 dB. Il faudrait dix supporters pour gagner 10 dB.' },
      { q: 'Quelle est la longueur d\'onde d\'un son de 100 Hz dans l\'air ?', choices: ['3,4 m', ['34 cm', 'C\'est la longueur d\'onde à 1 kHz : λ = c ÷ f = 343 ÷ 1 000.'], ['34 km', 'Ce serait vrai à 0,01 Hz : λ = 343 m/s ÷ 100 Hz = 3,43 m.']], answer: 0, why: 'λ = c ÷ f = 343 m/s ÷ 100 Hz ≈ 3,4 m. Les graves ont des longueurs d\'onde de plusieurs mètres : ils contournent les obstacles et traversent les cloisons.' },
      { q: 'Un niveau de ligne de 0 dBu correspond à quelle tension ?', choices: ['0,775 V', ['1 V', '1 V, c\'est 0 dBV. Le dBu prend 0,775 V pour référence : 0 dBV = +2,2 dBu.'], ['0 V', 'Un niveau en décibels de 0 ne veut pas dire « rien » : il veut dire « égal à la référence ».']], answer: 0, why: '0 dBu = 0,775 V (la tension qui dissipe 1 mW dans 600 Ω, référence historique). Le niveau d\'alignement de la console, 0 dBu, correspond à −18 dBFS (EBU R68).' },
      { q: 'Pourquoi la pression se compte-t-elle en 20 × log₁₀ et non en 10 × log₁₀ ?', choices: ['Parce qu\'une pression est une amplitude : la puissance du son varie comme son carré', ['Par convention, pour avoir de plus grands nombres', 'Ce n\'est pas une convention : 20 log₁₀(p) = 10 log₁₀(p²), et la puissance acoustique varie comme le carré de la pression.'], ['Parce que l\'oreille entend deux fois mieux que le micro', 'Le facteur ne dit rien de l\'oreille : il vient de la relation entre amplitude et puissance.']], answer: 0, why: 'La puissance (ou l\'intensité) d\'un son varie comme le carré de sa pression : 10 log₁₀(p²) = 20 log₁₀(p). Il en va de même pour une tension : doubler la tension, c\'est +6 dB ; doubler la puissance, +3 dB.' },
    ],
  },
  {
    id: 'son-dynamique', title: 'Le micro dynamique : le SM58 ouvert', minutes: '9 min', partie: PARTIE,
    essentials: [
      'Une **membrane** porte une **bobine** plongée dans le champ d\'un **aimant** : la pression la fait bouger, le mouvement **induit** une tension (e = B·l·v). Aucune alimentation : il fonctionne avec ou sans 48 V.',
      'Peu sensible mais robuste, sans saturation aux fortes pressions : type SM58, **−54,5 dBV/Pa** (≈ 1,9 mV/Pa), 50 Hz – 15 kHz ; type SM48, −57,5 dBV/Pa (1,3 mV/Pa), **3 dB de moins**.',
      'À 94 dB SPL, le type SM58 donne ≈ **−52 dBu** : il faut **52 dB de gain** pour l\'amener à 0 dBu (−18 dBFS) ; une voix forte tout près en demande 20 de moins.',
    ],
    figure: figDynamique,
    demoTitle: 'Voix projetée à 5 cm : lisez la tension et le gain demandé. Reculez à 50 cm : le gain dépasse 60 dB. Passez du type SM58 au type SM48 : 3 dB de gain en plus pour le même son.',
    demo: demoDynamique,
    body: `Le **micro dynamique** est le micro le plus simple et le plus robuste. Sous la **grille** (une sphère de fil d'acier doublée d'une **mousse** qui arrête les plosives, le souffle des « p » et des « b ») se trouve la **capsule** : une **membrane** de plastique très fin, collée à une **bobine** de fil de cuivre, elle-même plongée dans l'**entrefer** d'un **aimant** (une fente circulaire où le champ magnétique est intense, entre l'aimant et ses **pièces polaires**).

Quand la pression pousse la membrane, la bobine se déplace dans le champ : une tension apparaît à ses bornes, c'est l'**induction** (e = B·l·v : le champ, la longueur du fil, la vitesse de la bobine). La tension suit la **vitesse** de la membrane, pas sa position : le micro « parle » tout seul, sans aucune alimentation. Sous la capsule, une **suspension** élastique l'isole des chocs et des bruits de manipulation ; dans le corps, deux fils mènent la tension au connecteur **XLR** : broche 2 point chaud, broche 3 point froid, broche 1 masse et blindage.

Le micro type **SM58** est celui des voix sur scène depuis des décennies. Ses chiffres (fiche Shure) : réponse **50 Hz à 15 kHz**, directivité **cardioïde** (il capte devant, peu derrière), sensibilité **−54,5 dBV/Pa** (la fiche l'arrondit à 1,85 mV ; le calcul exact donne 1,88 mV par pascal), impédance nominale **150 Ω** (300 Ω réels). Le type **SM48**, plus économique, annonce 55 Hz à 14 kHz, −57,5 dBV/Pa (1,3 mV/Pa) et 150 Ω (270 Ω réels) : **3 dB de moins** que le SM58, donc 3 dB de gain de plus à la console pour le même son.

Faible sensibilité veut dire **beaucoup de gain** : à 94 dB SPL (1 Pa), un type SM58 donne 1,88 mV, soit −54,5 dBV = −52,3 dBu ; pour l'amener à 0 dBu, il faut **52 dB de gain**. Une voix projetée à 5 cm (≈ 96 dB SPL, ordre de grandeur) demande à peu près autant ; un chanteur qui pousse, 20 dB de moins ; la même voix à 50 cm, 20 dB de plus, et l'on approche des 60 dB où le souffle du préampli s'entend. D'où la règle des micros dynamiques : **tout près de la source**. En contrepartie, le dynamique encaisse des pressions énormes (une grosse caisse, un ampli de guitare, un cri) sans saturer, et ne craint ni les chocs, ni l'humidité, ni le 48 V.

- Un dynamique n'a pas besoin du 48 V, et une liaison symétrique saine ne le lui fait pas sentir : on peut le brancher sur une tranche où le 48 V est allumé.
- La membrane, la bobine et l'aimant ont une masse : le dynamique suit moins bien les aigus et les transitoires très rapides qu'un statique.`,
    car: { text: 'Dans le car, les commentateurs parlent dans les micros-casques de leur unité de commentaire, souvent des dynamiques, tout près de la bouche : leur voix arrive par la MADI (COMM 1, COMM 2). En cabine son, la vue ENTRÉE donne le gain de chaque tranche ; un micro dynamique y fonctionne que la touche 48V soit allumée ou non.', station: 'son' },
    terms: ['micro-dynamique', 'db-spl'],
    competences: ['2.7', '2.9'],
    article: 'songuide',
    quiz: [
      { q: 'Dans un micro dynamique, qu\'est-ce qui produit la tension ?', choices: ['Une bobine qui se déplace dans le champ d\'un aimant', ['La charge d\'un condensateur dont la membrane bouge', 'C\'est le micro statique : sa membrane est une armature de condensateur polarisée.'], ['Une pile logée dans le corps', 'Le dynamique ne contient aucune source d\'énergie : il change le mouvement en tension par induction.']], answer: 0, why: 'La membrane est collée à une bobine plongée dans l\'entrefer d\'un aimant : la bobine qui bouge dans le champ produit une tension (induction). Le micro n\'a besoin d\'aucune alimentation.' },
      { q: 'Un type SM58 est sous 94 dB SPL. Il donne environ…', choices: ['1,9 mV, soit −52 dBu', ['1,9 V, soit +8 dBu', 'C\'est mille fois trop : un micro donne des millivolts, un niveau de ligne des volts.'], ['19 mV, soit −32 dBu', 'C\'est l\'ordre de grandeur d\'un micro statique, dix fois plus sensible (+20 dB).']], answer: 0, why: '−54,5 dBV/Pa à 1 Pa (94 dB SPL) : 10^(−54,5 ÷ 20) ≈ 1,88 mV, soit −54,5 dBV ou −52,3 dBu. Pour 0 dBu, le préampli doit ajouter 52 dB.' },
      { q: 'On remplace un type SM58 par un type SM48 sur le même chanteur, à la même distance. Que faire sur la tranche ?', choices: ['Monter le gain d\'environ 3 dB', ['Allumer le 48 V', 'Le SM48 est aussi un dynamique : il n\'en a pas besoin.'], ['Baisser le gain de 3 dB', 'Le SM48 est moins sensible (−57,5 contre −54,5 dBV/Pa) : il donne moins de tension, il faut plus de gain.']], answer: 0, why: '−54,5 − (−57,5) = 3 dB : le type SM48 donne 3 dB de moins pour la même pression ; on rattrape au gain, pas au fader.' },
      { q: 'Pourquoi un chanteur garde-t-il son micro dynamique à quelques centimètres de la bouche ?', choices: ['Le micro est peu sensible : près de la source, il faut moins de gain et la salle s\'entend moins', ['Parce que sinon le micro sature', 'C\'est l\'inverse : le dynamique encaisse de très fortes pressions. De loin, il manque de niveau, pas de marge.'], ['Parce que la bobine ne fonctionne qu\'au-dessus de 120 dB SPL', 'La bobine produit une tension pour toute pression, même faible : elle est seulement petite.']], answer: 0, why: 'Chaque doublement de distance coûte 6 dB. Un dynamique éloigné demande plus de 60 dB de gain : le souffle du préampli et la salle (retours, foule) remontent avec la voix.' },
      { q: 'Le 48 V est allumé sur la tranche d\'un micro dynamique, branché par un câble XLR sain. Que se passe-t-il ?', choices: [['La bobine grille', 'Le 48 V est présent sur les broches 2 et 3 en même temps : aucune différence entre elles, aucun courant ne traverse la bobine.'], 'Rien : il fonctionne normalement', ['Le micro devient plus sensible', 'Le dynamique ne se sert pas du 48 V : sa sensibilité ne change pas.']], answer: 1, why: 'En liaison symétrique, la P48 met les deux broches de modulation au même potentiel : la bobine, branchée entre elles, ne voit aucune tension continue. Le dynamique fonctionne avec ou sans 48 V.' },
      { q: 'À quoi sert la mousse placée sous la grille d\'un type SM58 ?', choices: ['À arrêter les plosives et le souffle de la voix', ['À alimenter la capsule', 'La mousse ne conduit rien : c\'est un filtre mécanique contre les coups de vent et les « p ».'], ['À rendre le micro omnidirectionnel', 'La directivité vient de la capsule et de ses ouïes arrière, pas de la mousse.']], answer: 0, why: 'Les « p » et les « b » envoient une bouffée d\'air qui fait claquer la membrane (plosive). La grille et sa mousse la cassent avant la capsule ; dehors, on ajoute une bonnette.' },
    ],
  },
  {
    id: 'son-statique', title: 'Le micro statique : condensateur, électret, canon', minutes: '9 min', partie: PARTIE,
    essentials: [
      'La capsule est un **condensateur** : une membrane métallisée de quelques µm face à une **plaque arrière** ; polarisée, elle garde sa charge, et sa tension suit le **déplacement** de la membrane.',
      'Plus sensible qu\'un dynamique (ordre de grandeur **10 à 40 mV/Pa**, 15 à 25 dB de plus) et plus fin dans les aigus, il a besoin d\'une **électronique** d\'adaptation, donc du **48 V** (même l\'électret, chargé à vie, ou d\'une pile).',
      'Le **canon** des bords terrain est un statique très directif (tube d\'interférence) ; le **ruban**, figure en 8, est fragile : pas de 48 V sur une liaison douteuse.',
    ],
    figure: figStatique,
    demoTitle: 'Descendez le son à 40 dB SPL : le dynamique s\'approche de son bruit, le statique et le canon gardent de la marge. Montez à 135 dB SPL : c\'est l\'électronique du statique qui sature.',
    demo: demoStatique,
    body: `Le **micro statique** (on dit aussi « à condensateur ») remplace la bobine et l'aimant par un **condensateur**. Une **membrane** très fine (quelques micromètres, en plastique métallisé à l'or) est tendue à quelques dizaines de micromètres d'une **plaque arrière** percée. Les deux forment les armatures d'un condensateur. On leur donne une charge fixe, la **polarisation** ; quand la pression rapproche ou écarte la membrane, la capacité change, et comme la charge ne peut pas suivre assez vite, c'est la **tension** entre les armatures qui varie : elle suit le **déplacement** de la membrane.

Cette membrane est beaucoup plus légère que l'ensemble membrane-bobine d'un dynamique : elle suit les **aigus** et les **transitoires** (une frappe de balle, un claquement de mains) avec finesse, et elle réagit aux sons faibles. La capsule a en revanche une impédance énorme : sans électronique, le moindre câble la court-circuiterait. Le micro contient donc un **convertisseur d'impédance** (un transistor à effet de champ, parfois un transformateur) qui fournit une sortie basse impédance, et un fort niveau : la sensibilité d'un statique est de l'ordre de **10 à 40 mV/Pa** selon les modèles (à lire sur sa fiche), soit 15 à 25 dB de plus qu'un dynamique. Il faut moins de gain, et le son reste plus loin au-dessus du **souffle** du préampli.

Cette électronique doit être alimentée : c'est le rôle de l'**alimentation fantôme 48 V** envoyée par la console dans le câble (voir la leçon suivante), qui sert aussi souvent à polariser la capsule. Le micro **électret** a une capsule dont la charge est piégée à vie dans un film plastique : plus besoin de polarisation, mais son petit transistor demande quand même une tension (pile, 48 V, ou l'alimentation d'un émetteur HF) ; c'est la technologie des micros-cravates et des micros de téléphone. Les statiques ont aussi un **bruit propre** (de l'ordre de 10 à 20 dB SPL pondérés A pour un bon modèle) et une **pression maximale** (de l'ordre de 130 à 140 dB SPL) au-delà de laquelle l'électronique sature : un atténuateur (PAD) de 10 ou 20 dB, sur le micro, repousse la limite.

On distingue les **petites membranes** (environ 1,3 cm de diamètre : précises, régulières hors de l'axe, pour les ambiances et les instruments) et les **grandes membranes** (2,5 cm et plus : le son « de studio » des voix). Le **canon** des bords terrain est un statique placé au fond d'un **tube d'interférence** fendu : le son qui arrive dans l'axe parcourt le tube et atteint la capsule ; celui qui arrive de côté entre par les fentes à des distances différentes et s'annule en partie. Il devient très directif dans les aigus et les médiums, moins dans les graves. Le **micro à ruban**, enfin, est un dynamique à part : un ruban d'aluminium très fin dans un champ magnétique, en figure en 8, au son doux ; il est fragile (un souffle, un choc, et un ruban ancien n'aime pas un 48 V mal appliqué).

- Statique : sensible, précis, mais alimenté, plus fragile, et il sature à très forte pression. Dynamique : robuste, sans alimentation, mais peu sensible.
- Avant de chercher plus loin, un statique muet, c'est presque toujours le 48 V.`,
    car: { text: 'En cabine son, les couples d\'ambiance en tribune (MIC 1 à 4) et les six canons du bord terrain (MIC 5 à 10) sont des statiques : la vue ENTRÉE de la console allume pour eux la touche 48V. Leur gain nominal (autour de 40 à 48 dB) est plus faible que celui qu\'il faudrait à un dynamique au même endroit ; le chef de car peut couper le 48 V d\'un couple en panne cachée.', station: 'son' },
    terms: ['micro-statique', 'p48'],
    competences: ['2.7', '2.9', '3.4'],
    article: 'songuide',
    quiz: [
      { q: 'Dans une capsule statique, qu\'est-ce qui fait varier la tension ?', choices: ['L\'écart entre la membrane et la plaque arrière, à charge fixe', ['Une bobine qui se déplace dans un aimant', 'C\'est le micro dynamique, ou le ruban : le statique n\'a ni bobine ni aimant.'], ['La température de la membrane', 'La capsule réagit à la pression qui déplace la membrane, pas à la chaleur.']], answer: 0, why: 'La membrane et la plaque arrière forment un condensateur polarisé : à charge constante, la tension varie quand l\'écart change. C\'est le déplacement de la membrane qui donne le signal.' },
      { q: 'Un micro électret a une charge permanente. A-t-il besoin d\'une alimentation ?', choices: ['Oui, pour son électronique (pile, 48 V ou alimentation de l\'émetteur HF)', ['Non, jamais : l\'électret remplace l\'alimentation', 'L\'électret remplace la polarisation de la capsule, pas l\'alimentation du transistor d\'adaptation.'], ['Seulement s\'il est branché en asymétrique', 'Le besoin vient de l\'électronique interne, quelle que soit la liaison.']], answer: 0, why: 'Le film électret garde sa charge à vie : la capsule n\'a plus besoin d\'être polarisée. Mais sa très haute impédance demande un convertisseur (un petit transistor) qui, lui, doit être alimenté.' },
      { q: 'Pourquoi un statique demande-t-il moins de gain qu\'un dynamique pour le même son ?', choices: ['Parce que son électronique lui donne une sensibilité bien plus élevée (ordre de 10 à 40 mV/Pa)', ['Parce que le 48 V amplifie le son dans le câble', 'Le 48 V est une tension continue qui alimente le micro : il n\'amplifie pas le signal.'], ['Il en demande autant : seul le timbre change', 'La différence est mesurable : 15 à 25 dB de sensibilité en plus, à lire sur les fiches.']], answer: 0, why: 'Un dynamique type SM58 donne ≈ 1,9 mV/Pa ; un statique, de l\'ordre de 10 à 40 mV/Pa, soit 15 à 25 dB de plus. Moins de gain, et le son reste plus loin au-dessus du souffle du préampli.' },
      { q: 'Un canon du bord terrain, micro statique, ne donne rien du tout sur sa tranche. Première vérification ?', choices: ['La touche 48 V de la tranche', ['Le fader de la tranche', 'Le fader dose un signal qui existe : ici, le crête-mètre d\'entrée est vide.'], ['La polarité (Ø)', 'Une polarité inversée change le signe du signal, elle ne le fait pas disparaître.']], answer: 0, why: 'Sans alimentation fantôme, l\'électronique du statique n\'est pas alimentée : rien ne sort, ni crête ni souffle. C\'est la cause la plus fréquente d\'un statique muet.' },
      { q: 'Comment le canon devient-il si directif ?', choices: ['Le son latéral entre par les fentes d\'un tube et s\'annule en partie', ['Grâce à une capsule plus grosse que celle des autres micros', 'La capsule d\'un canon est petite : c\'est le tube d\'interférence devant elle qui fait la directivité.'], ['Grâce à un filtre électronique qui supprime les côtés', 'La directivité est acoustique : aucune électronique ne sait d\'où vient un son.']], answer: 0, why: 'Le tube fendu fait parcourir au son latéral des chemins de longueurs différentes jusqu\'à la capsule : les ondes arrivent décalées et s\'annulent en partie. Dans l\'axe, elles s\'ajoutent. L\'effet est fort dans les aigus et les médiums, faible dans les graves.' },
      { q: 'Une grosse caisse donne 140 dB SPL au micro. Lequel prendre ?', choices: ['Un dynamique, ou un statique avec son atténuateur (PAD)', ['Un statique sans atténuateur : il est plus précis', 'Vers 130 à 140 dB SPL (ordre de grandeur), l\'électronique d\'un statique sature : la précision ne sert plus à rien.'], ['Un ruban, le plus doux', 'Le ruban est le plus fragile : une forte pression et un souffle d\'air peuvent l\'abîmer.']], answer: 0, why: 'Un dynamique encaisse ces pressions sans saturer. Un statique peut le faire avec son PAD (−10 ou −20 dB à l\'entrée de l\'électronique), en vérifiant sa pression maximale sur sa fiche.' },
    ],
  },
  {
    id: 'son-directivite', title: 'La directivité : omni, cardioïde, canon, effet de proximité', minutes: '9 min', partie: PARTIE,
    essentials: [
      'Un micro du premier ordre répond comme **A + B·cos θ** : omni (le même partout), **cardioïde** (−6 dB à 90°, rien à l\'arrière), super et hypercardioïde (plus serrés, un lobe arrière), **figure en 8** (rien sur les côtés).',
      'Un micro directif capte la source de plus loin sans prendre la salle : un cardioïde garde le rapport son direct / salle d\'un omni **1,7 fois plus près** (Q = 3) ; le canon va plus loin dans l\'axe.',
      'Tout micro directif mesure un **gradient** de pression : de près, ses graves montent (**effet de proximité**). On met le **trou** de sa courbe face aux retours.',
    ],
    figure: figDirectivites,
    demoTitle: 'En cardioïde, mettez le retour de scène à 180° : il tombe dans le trou. Passez en hypercardioïde : le trou est à 110°, le retour à 180° revient (−6 dB). Rapprochez la source à 2 cm en 100 Hz : les graves montent de plus de 20 dB (modèle idéal).',
    demo: demoDirectivite,
    body: `Un micro ne capte pas pareil dans toutes les directions : sa **directivité** se dessine en **diagramme polaire**, la sensibilité selon l'angle d'arrivée du son. Les micros courants sont du **premier ordre** : leur réponse s'écrit **A + B × cos θ**, avec A + B = 1. La part **A** vient de la **pression** (la capsule fermée à l'arrière, qui reçoit la pression d'où qu'elle vienne) ; la part **B** vient du **gradient de pression** (la capsule ouverte des deux côtés, qui ne réagit qu'à la différence de pression entre l'avant et l'arrière, maximale dans l'axe, nulle sur le côté).

- **Omnidirectionnel** (A = 1, B = 0) : le même niveau partout. Naturel, sans effet de proximité, mais il capte autant la salle que la source.
- **Cardioïde** (0,5 et 0,5) : −6 dB à 90°, **rien à 180°**. Le micro de la voix sur scène et des commentateurs.
- **Supercardioïde** (≈ 0,37 et 0,63) et **hypercardioïde** (0,25 et 0,75) : plus serrés devant (−8,6 et −12 dB à 90°) mais avec un petit **lobe arrière** (−11,7 et −6 dB à 180°) et deux **trous** sur les côtés arrière, vers **126°** et **110°**.
- **Figure en 8** (0 et 1) : deux faces égales, en polarité opposée, et **rien sur les côtés** (90°). Le ruban, et le micro latéral d'un couple MS.

Pourquoi choisir un micro directif ? Pour capter la source **de plus loin** sans prendre la salle : le **facteur de directivité** Q compare ce que le micro capte de face à ce qu'il prend du son diffus qui arrive de partout. Un cardioïde a Q = 3 : il garde le même rapport son direct / réverbération qu'un omni placé **√3 ≈ 1,7 fois plus près** ; un hypercardioïde, Q = 4, deux fois plus près. Le **canon** va plus loin encore, mais seulement dans les aigus et les médiums.

Le prix des micros directifs est l'**effet de proximité** : le gradient de pression grandit aux basses fréquences quand la source est tout près (l'onde y est encore sphérique). Plus la source est proche, plus les graves montent : c'est la voix « chaude » du chanteur qui mange son micro, ou le grondement d'un commentateur qui colle le sien. Le modèle idéal donne plus de 15 dB à 100 Hz à 5 cm pour un cardioïde ; un vrai micro est réglé pour en compenser une partie (ordre de grandeur). Un omni n'en a pas. On corrige au **passe-haut** de la tranche, ou en gardant une distance constante.

**Le placement face aux retours** : sur scène, le chanteur entend ses **retours** (des enceintes posées au sol, face à lui). Si le micro les capte, le son tourne en rond : c'est le **larsen**. On place le retour dans le **trou** de la courbe du micro : **derrière** un cardioïde (180°), mais **de biais** (vers 110 à 126°) pour un super ou un hypercardioïde, dont l'arrière n'est pas muet. Pour l'ambiance d'un stade, on prend des cardioïdes en couple (ORTF, XY) ; pour une frappe de balle à 20 m, des canons.`,
    car: { text: 'Au stade, les canons du bord terrain (MIC 5 à 10) visent le jeu à plusieurs dizaines de mètres ; les couples d\'ambiance (ORTF en tribune Lepagnot, XY dans le kop Marek) sont faits de deux cardioïdes. En cabine son, le passe-haut de chaque tranche (vers 80 à 150 Hz) retire le grondement que l\'effet de proximité ou le vent ajoutent.', station: 'son' },
    terms: ['directivite', 'effet-proximite'],
    competences: ['3.4', '2.9'],
    article: 'songuide',
    quiz: [
      { q: 'Un cardioïde reçoit un son qui arrive à 90° de son axe. Il est atténué de…', choices: ['6 dB', ['3 dB', 'À 90°, cos θ = 0 : il ne reste que A = 0,5, soit 20 × log₁₀(0,5) = −6 dB (une amplitude divisée par deux).'], ['Il ne le capte pas du tout', 'Le cardioïde ne s\'annule qu\'à l\'arrière (180°) ; sur le côté, il capte encore la moitié de l\'amplitude.']], answer: 0, why: 'Cardioïde : 0,5 + 0,5 × cos θ. À 90°, 0,5, soit −6 dB ; à 180°, 0 : le trou est à l\'arrière.' },
      { q: 'Où placer le retour de scène d\'un chanteur qui chante dans un micro hypercardioïde ?', choices: [['Juste derrière le micro, à 180°', 'L\'hypercardioïde a un lobe arrière : à 180°, il ne perd que 6 dB. Le retour serait bien capté.'], 'De biais, vers 110° de l\'axe, dans le trou de sa courbe', ['Devant le chanteur, dans l\'axe du micro', 'Dans l\'axe, le micro capte le retour à plein niveau : le larsen arrive aussitôt.']], answer: 1, why: 'L\'hypercardioïde (0,25 + 0,75 cos θ) s\'annule quand cos θ = −1/3, vers 110°. C\'est là qu\'on met le retour ; un cardioïde, lui, a son trou à 180°.' },
      { q: 'Un chanteur colle son micro cardioïde contre sa bouche. Sa voix devient plus grave. Pourquoi ?', choices: ['L\'effet de proximité : de près, le gradient de pression renforce les graves', ['Le micro sature dans les graves', 'Une saturation déforme et durcit le son ; elle ne renforce pas les graves de façon régulière.'], ['La mousse de la grille filtre les aigus', 'La mousse est presque transparente au son ; elle arrête le souffle des plosives.']], answer: 0, why: 'Les micros directifs mesurent en partie le gradient de pression, qui grandit aux basses fréquences quand la source est très proche. Un omni n\'a pas d\'effet de proximité. On compense au passe-haut ou en gardant la distance.' },
      { q: 'Quel micro garde, à 1,7 m de la source, le même rapport son direct / salle qu\'un omni à 1 m ?', choices: ['Un cardioïde', ['Un omni', 'Un omni capte autant la salle que la source : à 1,7 m, il en prendrait plus qu\'à 1 m.'], ['Une figure en 8 placée de côté', 'Sur le côté, la figure en 8 ne capte rien de la source : elle n\'a de sens que source dans l\'axe.']], answer: 0, why: 'Le facteur de directivité d\'un cardioïde est Q = 3 : il capte trois fois moins de son diffus qu\'un omni ; il garde le même rapport à √3 ≈ 1,7 fois la distance.' },
      { q: 'Pour un couple MS (milieu-côté), quel micro pour la voie « côté » ?', choices: ['Une figure en 8, tournée vers les côtés', ['Un omni', 'L\'omni ne sait pas distinguer la gauche de la droite : il ne donne pas la différence entre les côtés.'], ['Un canon', 'Le canon est fait pour une source lointaine dans son axe, pas pour une image stéréo.']], answer: 0, why: 'La figure en 8 tournée de côté capte la gauche et la droite en polarité opposée : c\'est la différence G − D. Le micro « milieu » (cardioïde ou omni) donne la somme ; une matrice reconstruit G et D.' },
      { q: 'Quelle directivité n\'a ni trou ni effet de proximité ?', choices: ['L\'omnidirectionnel', ['Le cardioïde', 'Le cardioïde a un trou à 180° et, comme tout micro qui mesure un gradient, un effet de proximité.'], ['La figure en 8', 'La figure en 8 est le gradient pur : trous à 90°, et l\'effet de proximité le plus fort.']], answer: 0, why: 'L\'omni (A = 1, B = 0) ne mesure que la pression : même niveau partout, aucun trou, aucun effet de proximité. Il capte en revanche toute la salle.' },
    ],
  },
  {
    id: 'son-48v', title: 'L\'alimentation fantôme 48 V', minutes: '8 min', partie: PARTIE,
    essentials: [
      'La console envoie **+48 V** sur les broches **2 et 3** du XLR par deux résistances de **6,81 kΩ** ; le courant revient par la broche **1** (masse). Le signal, la différence entre 2 et 3, n\'en est pas gêné.',
      'Le statique y prend quelques mA (**10 mA au plus** en P48) : il lui reste **48 − I × 3,4 kΩ**. Un dynamique en liaison symétrique ne voit aucune différence entre 2 et 3 : rien ne le traverse.',
      'On allume ou coupe le 48 V **fader baissé**, on ne branche pas à chaud ; jamais sur un **ruban** ancien, un câble défectueux ou une liaison **asymétrique** : un courant passe alors dans la bobine.',
    ],
    figure: figFantome,
    demoTitle: 'Montez le courant demandé de 3 à 10 mA : la tension au micro descend vers 14 V. Branchez un dynamique : 0 mA dans la bobine. Choisissez « broche 3 à la masse » : 6,8 mA la traversent.',
    demo: demoFantome,
    body: `Un micro statique a besoin d'énergie pour son électronique, et souvent pour polariser sa capsule. Plutôt que d'ajouter un câble, on l'envoie **dans le câble micro lui-même** : c'est l'**alimentation fantôme** (phantom power), dite **P48** (norme IEC 61938). « Fantôme », parce qu'elle voyage sur les conducteurs du signal sans le gêner, invisible pour lui.

Le principe : dans la console, une source de **+48 V** alimente les broches **2 et 3** du XLR à travers **deux résistances égales de 6,81 kΩ** ; le courant revient par la broche **1**, la masse (le blindage). Des **condensateurs** empêchent ce continu d'entrer dans le préampli. Les deux conducteurs de modulation portent ainsi le même +48 V : le **signal**, qui est la **différence** entre la broche 2 et la broche 3, n'est pas touché. Dans le micro, le même montage à l'envers récupère la tension.

Vu du micro, les deux résistances sont **en parallèle** : 3,405 kΩ. Quand le micro demande un courant I, la tension qui lui reste est **U = 48 V − I × 3,405 kΩ** : 37,8 V pour 3 mA, 14 V pour 10 mA. La norme P48 prévoit **10 mA au plus** par micro ; en court-circuit, la console ne peut pas fournir plus de 48 ÷ 3,405 = 14 mA. Chaque micro annonce sur sa fiche le courant qu'il consomme et la tension dont il a besoin : un micro gourmand sur une console à l'alimentation faible peut perdre de la marge (il sature plus tôt) sans s'éteindre. Sur les petites consoles, une seule touche 48 V sert souvent toutes les entrées, ou un groupe d'entrées : on vérifie ce qui est branché sur les autres.

**Le micro dynamique** est branché entre les broches 2 et 3. En liaison symétrique saine, ces deux broches sont au même potentiel (+48 V toutes les deux) : **aucun courant ne traverse la bobine**. On peut donc laisser le 48 V allumé sur une tranche où l'on branche un dynamique. Mais si une broche touche la masse (câble abîmé, adaptateur XLR vers jack TS, liaison asymétrique), un courant continu de l'ordre de 7 mA traverse la bobine : bruit, déformation, membrane décentrée. Un **ruban** ancien, dont le ruban d'aluminium est très fragile, peut y laisser sa peau.

**Les précautions** : on allume et on coupe le 48 V **fader baissé et écoute coupée** (la charge des condensateurs fait un « pop » violent dans les enceintes) ; on ne branche ni ne débranche un micro à chaud ; on attend quelques secondes après l'allumage que l'électronique se stabilise ; on coupe le 48 V d'une entrée qui reçoit un niveau de ligne asymétrique ou une boîte de direct passive. Et une tranche de statique muette se vérifie d'abord à la touche 48 V.

- Le 48 V ne sert qu'aux micros statiques, électrets (selon le modèle) et aux boîtiers actifs (DI active, certains préamplis) ; un dynamique s'en passe.
- Il existe des fantômes 12 V et 24 V (P12, P24), plus rares, sur du matériel léger.`,
    car: { text: 'En cabine son, la vue ENTRÉE de la console : la touche 48V de chaque tranche est allumée pour les statiques (couples d\'ambiance, canons). La panne « alimentation fantôme 48 V coupée sur un couple d\'ambiance » du chef de car rend l\'ambiance muette ; l\'exercice d\'Olivier « Corriger une tranche » la fait réparer.', station: 'son' },
    terms: ['p48', 'liaison-symetrique'],
    competences: ['2.7', '2.13', '4.2'],
    article: 'vista',
    quiz: [
      { q: 'Sur quelles broches du XLR la console envoie-t-elle le +48 V ?', choices: ['Sur les broches 2 et 3, le retour par la 1', ['Sur la broche 1 seule', 'La broche 1 est la masse : c\'est par elle que le courant revient.'], ['Sur la broche 2 seule', 'Sur une seule broche, le 48 V apparaîtrait entre 2 et 3 : il traverserait le signal et la bobine d\'un dynamique.']], answer: 0, why: 'Le +48 V arrive à égalité sur les deux conducteurs de modulation (2 et 3), par deux résistances de 6,81 kΩ ; la masse (1) fait le retour. Le signal, différence entre 2 et 3, n\'est pas touché.' },
      { q: 'Un statique demande 4 mA sur la P48. Quelle tension lui reste-t-il ?', choices: ['Environ 34 V', ['48 V', 'Le courant traverse les résistances de 6,81 kΩ : il y a forcément une chute de tension.'], ['Environ 21 V', 'C\'est ce qu\'on obtiendrait avec une seule résistance de 6,81 kΩ ; vu du micro, les deux sont en parallèle (3,405 kΩ).']], answer: 0, why: 'U = 48 − 0,004 × 3 405 ≈ 34,4 V. Les deux résistances de 6,81 kΩ, en parallèle, font 3,405 kΩ.' },
      { q: 'Peut-on brancher un micro dynamique sur une tranche où le 48 V est allumé ?', choices: ['Oui, avec un câble XLR sain : aucun courant ne traverse sa bobine', ['Non, jamais : la bobine grille aussitôt', 'Les broches 2 et 3 sont au même potentiel : la bobine, entre elles, ne voit aucune tension continue.'], ['Oui, et il devient plus sensible', 'Le dynamique ne se sert pas du 48 V : sa sensibilité ne change pas.']], answer: 0, why: 'En symétrique, la P48 ne crée aucune différence entre les broches 2 et 3. Le risque n\'existe qu\'avec un câble défectueux ou une liaison asymétrique.' },
      { q: 'Pourquoi baisse-t-on le fader avant d\'allumer le 48 V ?', choices: ['La charge des condensateurs fait un « pop » violent qui partirait dans les enceintes', ['Parce que le 48 V ne s\'allume pas fader ouvert', 'La touche fonctionne quel que soit le fader : c\'est la sécurité des oreilles et du matériel qui l\'impose.'], ['Pour ne pas abîmer le fader', 'Le fader ne voit pas le 48 V : les condensateurs l\'arrêtent avant le préampli.']], answer: 0, why: 'À l\'allumage, les condensateurs se chargent et l\'électronique du micro démarre : un claquement très fort arrive à l\'entrée. Fader baissé et écoute coupée, il ne sort pas.' },
      { q: 'Un câble micro a la broche 3 en court-circuit avec la masse. Le 48 V est allumé, un dynamique est branché. Que se passe-t-il ?', choices: ['Un courant continu de l\'ordre de 7 mA traverse la bobine : bruit et déformation', ['Rien : un dynamique ne craint jamais le 48 V', 'Il ne le craint qu\'en liaison symétrique saine. Ici, la broche 2 est à 48 V et la 3 à 0 V : la bobine est entre les deux.'], ['La console coupe le 48 V d\'elle-même', 'La P48 n\'a pas de détection de défaut : la résistance de 6,81 kΩ limite simplement le courant.']], answer: 0, why: '48 V ÷ (6 810 Ω + 300 Ω) ≈ 6,8 mA traversent la bobine. La membrane est décentrée, le son se déforme ; un ruban ancien peut être abîmé. On change le câble.' },
      { q: 'Combien de courant la norme P48 prévoit-elle au plus pour un micro ?', choices: ['10 mA', ['100 mA', 'C\'est dix fois trop : 48 V à travers 3,4 kΩ ne peuvent pas donner plus de 14 mA, même en court-circuit.'], ['1 A', 'Ce serait le courant d\'un appareil secteur : le fantôme n\'alimente que de petites électroniques.']], answer: 0, why: 'La P48 (IEC 61938) prévoit 10 mA au plus par micro. Avec 3,405 kΩ vus du micro, le court-circuit ne donne que 14 mA. Un micro qui demande 10 mA ne garde que 14 V.' },
    ],
  },
  {
    id: 'son-liaisons', title: 'Liaisons symétriques, niveaux micro et ligne', minutes: '8 min', partie: PARTIE,
    essentials: [
      'Le **XLR** : broche **1 masse**, **2 point chaud**, **3 point froid** (IEC 60268-12) ; le jack **TRS** (pointe, bague, corps) peut être symétrique, le jack **TS** et le **RCA** ne le sont jamais.',
      '**Liaison symétrique** : le signal part en opposition sur 2 et 3, un parasite arrive pareil sur les deux ; l\'entrée garde la **différence** : le signal double, le parasite s\'annule (**réjection du mode commun**).',
      'Les niveaux : micro (quelques mV, −60 à −30 dBu), **ligne pro +4 dBu** (1,23 V), grand public **−10 dBV** (0,32 V) : ≈ 12 dB d\'écart ; 0 dBu = 0,775 V.',
    ],
    figure: figLiaisons,
    demoTitle: 'Passez en asymétrique avec la source « micro » : le ronflement couvre la voix. Revenez en symétrique et poussez le déséquilibre à 10 % : la réjection tombe à 20 dB. Comparez une ligne +4 dBu : elle supporte mieux le même parasite.',
    demo: demoLiaisons,
    body: `Un câble audio traverse un monde hostile : câbles secteur, gradateurs de lumière, émetteurs, moteurs. Chacun induit dans le câble un **parasite**, surtout le ronflement du secteur (50 Hz et ses harmoniques). Sur un signal de micro de quelques millivolts, quelques millivolts de parasite suffisent à tout gâcher. La parade est la **liaison symétrique**.

Le câble symétrique a **deux conducteurs** torsadés sous un **blindage**. Le signal y part **en opposition** : +s sur le **point chaud**, −s sur le **point froid**. Un parasite, lui, est capté **pareil** par les deux conducteurs (ils sont tordus ensemble, au même endroit) : c'est un signal de **mode commun**. L'entrée symétrique ne garde que la **différence** entre les deux : (+s + n) − (−s + n) = **2s**. Le signal double, le parasite **s'annule**. La qualité de l'annulation (la **réjection du mode commun**) dépend de l'**équilibre** de la liaison : avec 0,1 % de déséquilibre (des impédances qui ne sont pas tout à fait égales), il reste un millième du parasite, 60 dB plus bas ; avec 10 %, seulement 20 dB.

**Les connecteurs.** Le **XLR** est la règle en son professionnel, verrouillé et solide : **broche 1 masse** (le blindage), **broche 2 point chaud**, **broche 3 point froid** (IEC 60268-12) ; un micro sort sur un XLR mâle, une entrée de console est un XLR femelle. Le **jack 6,35 mm TRS** (Tip, Ring, Sleeve : pointe, bague, corps) porte aussi une liaison symétrique (pointe chaud, bague froid, corps masse), ou un départ stéréo asymétrique (casque). Le **jack TS** (sans bague) et le **RCA** (cinch) sont **asymétriques** : un seul conducteur et la masse, rien ne s'annule. À ne pas confondre : un XLR peut aussi porter de l'AES3 (audio numérique, 110 Ω) ou une liaison d'intercom.

**Les niveaux.** Un **micro** donne quelques millivolts, de −60 à −30 dBu selon le micro et la source ; il passe d'abord par le préampli. Un niveau **ligne professionnel** est nominal à **+4 dBu** (1,228 V) : sortie de console, enregistreur, récepteur HF, émetteur. Le matériel **grand public** (lecteurs, ordinateurs, cartes son simples) travaille à **−10 dBV** (0,316 V) : ≈ **12 dB de moins** (11,8 dB). Une source grand public dans une entrée pro arrive trop bas ; une sortie pro dans une entrée grand public la sature. Rappel : 0 dBu = 0,775 V, 0 dBV = 1 V, dBu = dBV + 2,2.

Quand une source asymétrique doit voyager loin (un clavier, une guitare, un ordinateur en régie), on la convertit au plus près avec une **boîte de direct** (DI) : elle sort en symétrique, au niveau micro, sur XLR. Sur scène, une **stagebox** (boîtier de scène) rassemble les entrées et part vers la console par un **multipaire** analogique, ou en numérique (MADI, Dante) : un seul câble pour des dizaines de voies.

- La masse (broche 1) n'est pas un conducteur de signal : ses boucles (deux appareils reliés à la terre par deux chemins) créent un ronflement que la liaison symétrique ne rejette pas toujours ; on la coupe d'un côté (ground lift) seulement sur une DI ou un appareil prévu pour.
- Un câble micro reste symétrique de bout en bout : un seul adaptateur XLR vers jack TS sur le chemin, et la liaison perd sa protection.`,
    car: { text: 'Au stade, les canons et les couples d\'ambiance descendent jusqu\'au pied de car et à la console en liaisons symétriques ; le récepteur HF du journaliste bord terrain arrive au niveau ligne (MIC 11, gain nominal faible). En cabine son, la page E/S de la console montre les entrées MIC, MADI, AES et SDI ; la baie de brassage du car rassemble les lignes.', station: 'son' },
    terms: ['liaison-symetrique', 'dbu-dbv'],
    competences: ['2.10', '1.4', '2.13'],
    article: 'cablage',
    quiz: [
      { q: 'Sur un XLR, quelle broche porte le point chaud ?', choices: ['La broche 2', ['La broche 1', 'La broche 1 est la masse et le blindage.'], ['La broche 3', 'La broche 3 est le point froid, le signal en opposition.']], answer: 0, why: 'IEC 60268-12 : 1 masse, 2 point chaud, 3 point froid. Inverser 2 et 3 sur un seul câble inverse la polarité de la source.' },
      { q: 'Pourquoi une liaison symétrique annule-t-elle les parasites ?', choices: ['Le parasite arrive pareil sur les deux conducteurs ; l\'entrée ne garde que leur différence', ['Parce que le blindage arrête tous les parasites', 'Le blindage aide contre les parasites électriques, pas contre le champ magnétique du secteur : l\'essentiel vient de la soustraction.'], ['Parce que le signal y est plus fort', 'Le signal double bien à l\'arrivée, mais c\'est la soustraction qui fait disparaître le parasite.']], answer: 0, why: 'Signal en opposition (+s, −s), parasite en mode commun (+n, +n) : la différence vaut 2s, le parasite disparaît, au déséquilibre près.' },
      { q: 'Quel connecteur est toujours asymétrique ?', choices: ['Le jack TS (et le RCA)', ['Le jack TRS', 'Le TRS a trois contacts : il peut porter une liaison symétrique (pointe chaud, bague froid, corps masse).'], ['Le XLR 3 broches', 'Le XLR est le connecteur symétrique par excellence.']], answer: 0, why: 'Le jack TS (pointe et corps) et le RCA n\'ont que deux contacts : un conducteur et la masse. Rien ne peut s\'y soustraire.' },
      { q: 'Quelle tension correspond à +4 dBu ?', choices: ['Environ 1,23 V', ['4 V', 'Les dBu ne sont pas des volts : +4 dBu = 0,775 V × 10^(4 ÷ 20).'], ['Environ 0,32 V', 'C\'est −10 dBV, le niveau ligne grand public.']], answer: 0, why: '0,775 V × 10^(4 ÷ 20) ≈ 1,228 V. C\'est le niveau nominal des lignes professionnelles.' },
      { q: 'Un lecteur grand public (−10 dBV) est branché sur une entrée ligne pro (+4 dBu). Il arrive…', choices: ['environ 12 dB trop bas', ['au bon niveau : une ligne est une ligne', 'Les deux standards diffèrent : +4 dBu − (−10 dBV + 2,2) ≈ 11,8 dB.'], ['14 dB trop haut', 'C\'est l\'inverse : −10 dBV est plus faible que +4 dBu. Et les deux unités ne se soustraient pas directement.']], answer: 0, why: '−10 dBV = −7,8 dBu ; +4 − (−7,8) = 11,8 dB : la source grand public arrive ≈ 12 dB sous le niveau attendu. On rattrape au gain, ou avec une interface.' },
      { q: 'Une guitare (sortie asymétrique) doit rejoindre la console à 40 m. Que faire ?', choices: ['Une boîte de direct (DI) près de la guitare, puis un câble micro symétrique', ['Un long câble jack TS', 'Sur 40 m d\'asymétrique, les parasites et la capacité du câble abîment le signal.'], ['Allumer le 48 V sur l\'entrée', 'Le 48 V n\'apporte rien à une liaison asymétrique ; il ne sert qu\'à une DI active.']], answer: 0, why: 'La DI convertit la sortie asymétrique en liaison symétrique au niveau micro, sur XLR : elle voyage loin sans ronfler. Une DI active se sert du 48 V ; une passive, non.' },
    ],
  },
];
