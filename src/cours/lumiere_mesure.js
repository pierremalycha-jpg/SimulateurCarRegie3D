// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import { FAMILLES, familleById, flux, puissancePour, angleSolide, intensiteMoyenne, angleChampDe, diametre } from '../labo/calc/lumiere.js';
import { SOURCES, GELS, gelById, eclairage, profil, gradateur, mired, kelvin, melange, dominante, ouverture, diaphs, luminance } from '../labo/calc/photometrie.js';
import { signal } from '../labo/calc/sensito.js';
import { surLigne, COS_PHI, LIGNE, eclairementPonctuel, ecartDisque, distanceSure, TOL_MIRED, correction, gelPour, C_PLATE, K_SPOT, ouvertureSpot, erreurSpot, grisVise, ouvertureCamera, diaphsEntre, dbPourDiaphs, diaphProche } from './lumiere_mesure_calc.js';

// ----------------------------------------------------------------------------------
// Chapitre « La lumière » (v19.29), première partie : la lumière et sa mesure. Les sources (halogène,
// HMI, LED : couleur, rendu des couleurs, efficacité, courant, gradation), les grandeurs (flux,
// intensité, éclairement, luminance), la distance et l'angle (inverse du carré, cosinus, profil du
// faisceau), la couleur (kelvins, mireds, gélatines, gradateur), la mesure et l'exposition (cellule
// incidente, spotmètre, gain, forme d'onde). Les chiffres viennent des calculs du Labo
// (labo/calc/lumiere.js, photometrie.js, sensito.js) et de cours/lumiere_mesure_calc.js.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238', white: '#e8eef2', ink: '#0b1013' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};
const FONT = '11px Arial, sans-serif';
/** un nombre de lux, de candelas ou de lumens lisible */
const nb = (v) => (v >= 100 ? fmtNum(v, 0) : v >= 10 ? fmtNum(v, 1) : fmtNum(v, 2));
/** un nombre f */
const fN = (N) => `f/${fmtNum(N, N < 10 && Math.abs(N - Math.round(N)) > 0.05 ? 1 : 0)}`;
/** un écart signé, avec le moins typographique */
const signe = (v, d = 1) => (v > 0.005 ? '+' : '') + fmtNum(v, d).replace('-', '−');
const K = (T) => `${fmtNum(Math.round(T / 10) * 10, 0)} K`;
const borne = (v, a, b) => Math.min(Math.max(v, a), b);

// ======================================================================================
// 1. Les sources
// ======================================================================================
const NOTES_FAMILLE = {
  halogene: ['Rougit au gradateur', 'Plus de 90 % en chaleur', 'Allumage immédiat', 'Spectre continu'],
  hmi: ['Se gradue peu (50 à 100 %)', 'Ballast, arc sous haute tension', 'Une à deux minutes à l\'allumage', 'Spectre de raies corrigé'],
  led: ['Se gradue sans changer de couleur', 'Peu de chaleur vers le sujet', 'Allumage immédiat', 'Bleu + luminophore : des creux'],
};
function figSources() {
  const l1 = surLigne(1000, 'halogene');
  const f = figure(720, 262, `Trois familles de sources comparées. L'halogène : 3 200 K, indice de rendu des couleurs 99 à 100, 18 à 25 lumens par watt, plus de 90 % de la puissance part en chaleur, il rougit au gradateur. La HMI : 5 600 K, indice 90 à 95, 75 à 100 lumens par watt, un ballast, une à deux minutes pour s'allumer, elle se gradue peu. La LED : de 2 700 à 6 500 K en bicolore, indice 90 à 98, 60 à 130 lumens par watt, elle se gradue de 0 à 100 % sans changer de couleur. En bas : 1 kW sous 230 V tire ${fmtNum(l1.I, 2)} A, une ligne de 16 A porte ${l1.n} projecteurs de 1 kW.`);
  f.append(txt(10, 16, 'Trois familles de sources : couleur, rendu, rendement, gradation', 'co-t', 'start'));
  const cols = { halogene: C.amber, hmi: C.cyan, led: C.green };
  ['halogene', 'hmi', 'led'].forEach((id, i) => {
    const F = familleById(id), x0 = 12 + i * 236, w = 224, col = cols[id];
    const T = Array.isArray(F.T) ? `${fmtNum(F.T[0], 0)} à ${fmtNum(F.T[1], 0)} K (bicolore)` : `${fmtNum(F.T, 0)} K`;
    f.append(box(x0, 28, w, 202, col), txt(x0 + w / 2, 48, id === 'halogene' ? 'Halogène' : id === 'hmi' ? 'HMI' : 'LED', 'co-t'));
    f.append(txt(x0 + 12, 68, T, 'co-s', 'start', { fill: col }), txt(x0 + 12, 86, `IRC (Ra) : ${F.irc[0]} à ${F.irc[1]}`, 'co-s', 'start'));
    f.append(txt(x0 + 12, 104, `Efficacité : ${F.efficacite[0]} à ${F.efficacite[1]} lm/W`, 'co-s', 'start'));
    const X = (e) => x0 + 12 + e / 130 * (w - 24);
    f.append(sv('rect', { x: x0 + 12, y: 110, width: w - 24, height: 8, fill: C.line }), sv('rect', { x: X(F.efficacite[0]), y: 110, width: X(F.efficacite[1]) - X(F.efficacite[0]), height: 8, fill: col }));
    f.append(txt(x0 + 12, 138, `1 kW donne ≈ ${fmtNum(flux(1000, id), 0)} lm`, 'co-s', 'start', { fill: C.white }));
    NOTES_FAMILLE[id].forEach((s, k) => f.append(txt(x0 + 12, 158 + k * 18, s, 'co-s', 'start')));
  });
  f.append(txt(10, 250, `Sur le secteur : 1 kW ÷ 230 V = ${fmtNum(l1.I, 2)} A. Une ligne de 16 A porte ${l1.n} projecteurs de 1 kW (${fmtNum(l1.total, 1)} A), pas ${l1.n + 1}.`, 'co-s', 'start'));
  return f;
}
function demoSources(host) {
  let fam = 'halogene', P = 1000;
  const read = readout(['Flux lumineux', 'Courant sur le secteur', 'Sur une ligne de 16 A', 'Une LED pour le même flux', 'Couleur et gradation', 'Chaleur']);
  const verdict = el('p', { class: 'co-verdict' });
  const cv = canvas(720, 170, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const draw = () => {
    const F = familleById(fam), phi = flux(P, fam), L = surLigne(P, fam);
    read.set('Flux lumineux', `≈ ${fmtNum(phi, 0)} lm (de ${fmtNum(P * F.efficacite[0], 0)} à ${fmtNum(P * F.efficacite[1], 0)} lm selon le modèle)`);
    read.set('Courant sur le secteur', `${fmtNum(L.I, 2)} A sous ${LIGNE.U} V (cos φ ≈ ${fmtNum(COS_PHI[fam] || 1, 2)})`);
    read.set('Sur une ligne de 16 A', L.n > 0 ? `${L.n} projecteur${L.n > 1 ? 's' : ''} : ${fmtNum(L.total, 1)} A sur ${LIGNE.A}` : 'aucun : un seul dépasse 16 A');
    read.set('Une LED pour le même flux', fam === 'led' ? 'c\'est déjà une LED' : `≈ ${fmtNum(puissancePour(phi, 'led'), 0)} W au lieu de ${fmtNum(P, 0)} W`);
    read.set('Couleur et gradation', `${Array.isArray(F.T) ? `${fmtNum(F.T[0], 0)} à ${fmtNum(F.T[1], 0)} K` : `${fmtNum(F.T, 0)} K`} ; ${F.gradation}`);
    read.set('Chaleur', F.chaleur);
    verdict.className = 'co-verdict ' + (L.n === 0 ? 'ko' : fam === 'hmi' ? 'warn' : 'ok');
    verdict.textContent = L.n === 0 ? `À ${fmtNum(L.I, 1)} A, ce projecteur dépasse à lui seul une ligne de 16 A : il lui faut une ligne de 32 A ou du triphasé.`
      : fam === 'hmi' ? `${L.n} HMI de ${fmtNum(P, 0)} W tiennent sur la ligne. Allumez-les avant la répétition : une à deux minutes pour leur pleine lumière et leur couleur.`
        : fam === 'halogene' ? `${L.n} projecteur${L.n > 1 ? 's' : ''} sur la ligne ; ${fmtNum(P * 0.9, 0)} W au moins partent en chaleur dans chacun.`
          : `${L.n} projecteur${L.n > 1 ? 's' : ''} sur la ligne, pour la lumière d'un halogène de ${fmtNum(puissancePour(phi, 'halogene'), 0)} W.`;
    // la ligne de 16 A, remplie projecteur par projecteur
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 170); g.font = FONT;
    const X = (a) => 40 + a / 20 * 640;
    g.fillStyle = '#aab4ba'; g.fillText(`La ligne de ${LIGNE.A} A : chaque projecteur y prend ${fmtNum(L.I, 2)} A`, 40, 16);
    g.fillStyle = C.box; g.fillRect(X(0), 26, X(LIGNE.A) - X(0), 24);
    const n = Math.min(L.n + 1, 40);
    for (let k = 0; k < n; k++) {
      const a0 = k * L.I, a1 = (k + 1) * L.I; if (a0 >= 20) break;
      g.fillStyle = a1 > LIGNE.A ? C.red : k % 2 ? '#d9b36a' : C.amber;
      g.fillRect(X(a0) + 1, 28, Math.max(1, X(Math.min(a1, 20)) - X(a0) - 2), 20);
    }
    g.strokeStyle = C.red; g.lineWidth = 2; g.beginPath(); g.moveTo(X(LIGNE.A), 20); g.lineTo(X(LIGNE.A), 56); g.stroke(); g.lineWidth = 1;
    g.fillStyle = C.red; g.fillText('16 A : le disjoncteur', X(LIGNE.A) + 4, 66);
    for (const a of [0, 4, 8, 12, 16, 20]) { g.fillStyle = '#6f7a84'; g.fillText(`${a} A`, X(a) - 8, 66); }
    // le même flux, famille par famille
    g.fillStyle = '#aab4ba'; g.fillText(`Pour le même flux (≈ ${fmtNum(phi, 0)} lm), la puissance de chaque famille`, 40, 92);
    const Pm = Math.max(...FAMILLES.map((x) => puissancePour(phi, x.id)));
    FAMILLES.forEach((x, k) => {
      const p = puissancePour(phi, x.id), y = 102 + k * 16, w = Pm > 0 ? p / Pm * 460 : 0;
      g.fillStyle = x.id === fam ? C.white : '#6f7a84'; g.fillText(x.nom, 40, y + 10);
      g.fillStyle = x.id === fam ? C.amber : '#3a444c'; g.fillRect(210, y + 1, w, 11);
      g.fillStyle = x.id === fam ? C.white : '#aab4ba'; g.fillText(`${fmtNum(p, 0)} W`, 216 + w, y + 10);
    });
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Famille', FAMILLES.map((x) => [x.id, x.nom]), fam, (v) => { fam = v; draw(); }),
      slider('Puissance', 100, 4000, P, 50, (v) => { P = v; draw(); }, (v) => (v >= 1000 ? `${fmtNum(v / 1000, v % 1000 ? 2 : 0)} kW` : `${v} W`))),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'En haut, la ligne de 16 A remplie projecteur par projecteur (en rouge, celui qui la ferait déclencher). En bas, la puissance qu\'il faut à chaque famille pour donner la même lumière.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 2. Flux, intensité, éclairement, luminance
// ======================================================================================
function figGrandeurs() {
  const f = figure(720, 250, 'Les quatre grandeurs de la lumière, de la source à la caméra. Le flux, en lumens, est toute la lumière qui sort du projecteur. L\'intensité, en candelas, est la lumière envoyée dans une direction : le flux divisé par l\'angle solide du faisceau, en stéradians. L\'éclairement, en lux, est la lumière reçue par chaque mètre carré du sujet : l\'intensité divisée par le carré de la distance, c\'est ce que lit le luxmètre. La luminance, en candelas par mètre carré, est la lumière que le sujet renvoie vers la caméra : pour une surface mate, le facteur de réflexion fois l\'éclairement, divisé par pi.');
  f.append(txt(10, 16, 'De la source à la caméra : quatre grandeurs, quatre unités', 'co-t', 'start'));
  // le projecteur et son cône
  f.append(box(20, 96, 46, 34, C.amber), txt(43, 146, 'projecteur', 'co-s'));
  f.append(sv('path', { d: 'M66 104 L360 52 L360 176 L66 122 Z', fill: C.amber, 'fill-opacity': 0.12, stroke: C.amber, strokeWidth: 1 }));
  f.append(sv('path', { d: 'M110 96 A 50 50 0 0 1 110 130', fill: 'none', stroke: C.white, strokeDasharray: '3 2' }), txt(130, 90, 'Ω (sr)', 'co-s', 'start', { fill: C.white }));
  // le sujet (une carte) et la caméra
  f.append(sv('rect', { x: 360, y: 52, width: 10, height: 124, fill: '#9aa3a8' }), txt(365, 194, 'sujet', 'co-s'));
  f.append(arrow(220, 113, 352, 113, C.white), txt(286, 128, 'distance d', 'co-s', 'middle', { fill: C.white }));
  f.append(box(560, 150, 60, 34, C.cyan), sv('rect', { x: 532, y: 158, width: 28, height: 18, fill: C.box, stroke: C.cyan }), txt(590, 200, 'caméra', 'co-s'));
  f.append(arrow(374, 120, 528, 164, C.cyan));
  // les quatre étiquettes
  const lab = [
    [80, 210, 'Flux Φ (lumen, lm)', 'tout ce qui sort', C.amber],
    [250, 210, 'Intensité I (candela)', 'I = Φ ÷ Ω (lm/sr)', C.amber],
    [420, 40, 'Éclairement E (lux)', 'E = I ÷ d² (lm/m²) : le luxmètre', C.white],
    [560, 124, 'Luminance L (cd/m²)', 'L = ρ E ÷ π : la caméra', C.cyan],
  ];
  for (const [x, y, a, b, col] of lab) f.append(txt(/** @type {number} */ (x), /** @type {number} */ (y), /** @type {string} */ (a), 'co-t', 'start', { fill: /** @type {string} */ (col) }), txt(/** @type {number} */ (x), /** @type {number} */ (y) + 14, /** @type {string} */ (b), 'co-s', 'start'));
  f.append(txt(10, 242, 'Carte grise : 18 % de la lumière renvoyée ; carte blanche : 90 %. Même éclairement, cinq fois plus de luminance.', 'co-s', 'start'));
  return f;
}
function demoGrandeurs(host) {
  let phi = 20000, theta = 30, d = 10;
  const read = readout(['Angle solide du faisceau', 'Intensité moyenne dans le faisceau', 'Éclairement dans l\'axe', 'Diamètre éclairé', 'Luminance d\'une carte grise 18 %', 'Luminance d\'une carte blanche 90 %']);
  const verdict = el('p', { class: 'co-verdict' });
  const cv = canvas(720, 180, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const draw = () => {
    const om = angleSolide(theta), I = intensiteMoyenne(phi, theta), E = eclairementPonctuel(I, d), D = diametre(d, theta);
    const Lg = luminance(E, 0.18), Lb = luminance(E, 0.9);
    read.set('Angle solide du faisceau', `${fmtNum(om, 3)} sr, soit ${fmtNum(om / (4 * Math.PI) * 100, 1)} % de la sphère (4π ≈ 12,57 sr)`);
    read.set('Intensité moyenne dans le faisceau', `${nb(I)} cd (Φ ÷ Ω)`);
    read.set('Éclairement dans l\'axe', `${nb(E)} lx à ${fmtNum(d, 0)} m (I ÷ d²)`);
    read.set('Diamètre éclairé', `${fmtNum(D, D < 10 ? 2 : 1)} m, soit ${fmtNum(Math.PI * D * D / 4, 1)} m² (le flux s'y répartit : ${nb(phi / (Math.PI * D * D / 4))} lx en moyenne)`);
    read.set('Luminance d\'une carte grise 18 %', `${nb(Lg)} cd/m²`);
    read.set('Luminance d\'une carte blanche 90 %', `${nb(Lb)} cd/m², cinq fois la grise`);
    verdict.className = 'co-verdict ' + (E < 200 ? 'ko' : E < 800 ? 'warn' : E <= 3000 ? 'ok' : 'warn');
    verdict.textContent = E < 200 ? `${nb(E)} lx : bien trop peu pour une caméra de car sans gain. Rapprochez, serrez le faisceau ou prenez une source plus puissante.`
      : E < 800 ? `${nb(E)} lx : sous le niveau habituel d'un plateau de télévision (800 à 2 000 lx, ordre de grandeur).`
        : E <= 3000 ? `${nb(E)} lx : le niveau d'un plateau de télévision ou d'un stade éclairé pour la télévision.`
          : `${nb(E)} lx : beaucoup de lumière ; la caméra fermera l'iris ou passera un filtre neutre.`;
    // le faisceau vu de côté, à l'échelle
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 180); g.font = FONT;
    const s = 620 / 30, x0 = 50, y0 = 92, xs = x0 + d * s, h = Math.min(86, D / 2 * s);
    g.fillStyle = 'rgba(255,211,138,.16)'; g.strokeStyle = C.amber;
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(xs, y0 - h); g.lineTo(xs, y0 + h); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = C.amber; g.fillRect(x0 - 16, y0 - 9, 16, 18);
    g.strokeStyle = C.white; g.beginPath(); g.moveTo(xs, 6); g.lineTo(xs, 174); g.stroke();
    g.fillStyle = '#aab4ba'; g.fillText('vue de côté, à l\'échelle (0 à 30 m)', 50, 14);
    g.fillStyle = C.white; g.fillText(`${fmtNum(d, 0)} m · ${nb(E)} lx`, Math.min(xs + 6, 600), 30);
    if (D / 2 * s > 86) g.fillText('le faisceau déborde du cadre', Math.min(xs + 6, 560), 172);
    // les deux cartes, rendues à une exposition fixe (1 000 lx sur la grise donnent le gris moyen)
    const ton = (rho) => { const x = borne(rho * E / 1000 / 0.9, 0, 1); return Math.round(255 * Math.pow(x, 1 / 2.2)); };
    for (const [k, rho, nom] of [[0, 0.18, 'grise 18 %'], [1, 0.9, 'blanche 90 %']]) {
      const v = ton(/** @type {number} */ (rho)), x = 620, y = 44 + /** @type {number} */ (k) * 64;
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x, y, 80, 40);
      g.fillStyle = '#aab4ba'; g.fillText(/** @type {string} */ (nom), x, y + 54);
    }
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Flux du projecteur', 1000, 60000, phi, 500, (v) => { phi = v; draw(); }, (v) => `${fmtNum(v, 0)} lm`),
      slider('Angle du faisceau', 5, 90, theta, 1, (v) => { theta = v; draw(); }, (v) => `${v}°`),
      slider('Distance au sujet', 1, 30, d, 1, (v) => { d = v; draw(); }, (v) => `${v} m`)),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le faisceau vu de côté et les deux cartes vues par une caméra réglée pour 1 000 lx : la grise et la blanche reçoivent le même éclairement, mais n\'en renvoient pas la même part.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 3. La distance et l'angle
// ======================================================================================
/** de combien l'éclairement d'un disque de diamètre D baisse quand on passe de d1 à d2 (la loi du point donnerait (d2 ÷ d1)²) */
const baisseDisque = (d1, d2, D) => ((1 - ecartDisque(d1, D)) / (d1 * d1)) / ((1 - ecartDisque(d2, D)) / (d2 * d2));
/** taille de la surface qui émet (m), ordre de grandeur : lentille d'un Fresnel, panneau LED */
const TAILLE = { fresnel: 0.2, hmi: 0.2, led: 0.6 };
function figDistance() {
  const f = figure(720, 262, 'Trois effets de la géométrie sur l\'éclairement. À gauche, l\'inverse du carré : la même lumière qui couvre un carré à la distance d en couvre quatre à 2 d, l\'éclairement est divisé par quatre, soit deux diaphs. Au milieu, le cosinus : une surface éclairée de biais, à l\'angle i, reçoit l\'éclairement de face multiplié par cos i, la moitié à 60 degrés. À droite, le profil du faisceau : l\'intensité tombe à 50 % de l\'axe au bord de l\'angle de faisceau, et à 10 % au bord de l\'angle de champ, environ 1,8 fois plus large. En bas : la loi vaut loin de la source, au-delà d\'environ cinq fois sa taille.');
  f.append(txt(10, 16, 'La distance, l\'incidence, le bord du faisceau', 'co-t', 'start'));
  // l'inverse du carré
  f.append(sv('circle', { cx: 30, cy: 120, r: 6, fill: C.amber }));
  f.append(sv('path', { d: 'M30 120 L230 40 L230 200 Z', fill: C.amber, 'fill-opacity': 0.08, stroke: C.amber, strokeWidth: 0.8 }));
  f.append(sv('rect', { x: 126, y: 80, width: 6, height: 80, fill: C.white }), txt(129, 176, 'd', 'co-s'), txt(129, 72, '1 carré', 'co-s'));
  f.append(sv('rect', { x: 226, y: 40, width: 6, height: 160, fill: C.white }), sv('line', { x1: 226, y1: 120, x2: 232, y2: 120, stroke: C.ink }), txt(229, 216, '2 d', 'co-s'), txt(229, 32, '4 carrés', 'co-s'));
  f.append(txt(130, 236, 'E ÷ 4 : deux diaphs de moins', 'co-s', 'middle', { fill: C.amber }));
  // le cosinus
  f.append(sv('line', { x1: 300, y1: 190, x2: 460, y2: 110, stroke: C.white, strokeWidth: 3 }));
  f.append(arrow(380, 60, 380, 148, C.amber), arrow(410, 60, 410, 133, C.amber));
  f.append(sv('line', { x1: 380, y1: 150, x2: 416, y2: 222, stroke: C.grey, strokeDasharray: '3 2' }), txt(424, 214, 'normale', 'co-s', 'start'));
  f.append(txt(392, 48, 'lumière', 'co-s'), txt(392, 244, 'E = E de face × cos i', 'co-s', 'middle', { fill: C.amber }));
  // le profil du faisceau
  const cx = 600, base = 200, W = 100, th = 30;
  let d = '';
  for (let a = -55; a <= 55; a += 1) { const x = cx + a / 55 * W, y = base - profil(th, Math.abs(a)) * 150; d += (a === -55 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1); }
  f.append(sv('line', { x1: cx - W, y1: base, x2: cx + W, y2: base, stroke: C.line }), sv('path', { d, fill: 'none', stroke: C.cyan, strokeWidth: 1.6 }));
  const xb = th / 2 / 55 * W, xc = angleChampDe(th) / 2 / 55 * W;
  f.append(sv('line', { x1: cx - xb, y1: base - 75, x2: cx + xb, y2: base - 75, stroke: C.white, strokeDasharray: '3 2' }), txt(cx, base - 80, `faisceau ${th}° : 50 %`, 'co-s'));
  f.append(sv('line', { x1: cx - xc, y1: base - 15, x2: cx + xc, y2: base - 15, stroke: C.grey, strokeDasharray: '3 2' }), txt(cx, base - 20, `champ ≈ ${fmtNum(angleChampDe(th), 0)}° : 10 %`, 'co-s'));
  f.append(txt(cx, 214, 'intensité selon l\'écart à l\'axe', 'co-s'));
  f.append(txt(10, 256, 'La loi vaut pour une source ponctuelle : au-delà d\'environ cinq fois sa taille (ordre de grandeur).', 'co-s', 'start'));
  return f;
}
function demoDistance(host) {
  let src = 'fresnel', angle = 30, d = 4, inc = 0, alpha = 0;
  const read = readout(['Faisceau réglé', 'Intensité dans l\'axe', 'Part de l\'axe à cet écart', 'Éclairement au sujet', 'Deux fois plus loin', 'Diamètre du faisceau', 'La loi à cette distance']);
  const verdict = el('p', { class: 'co-verdict' });
  const cv = canvas(720, 210, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const calc = (dd) => eclairage({ source: src, angle, niveau: 1, d: dd, alpha, incidence: inc });
  const draw = () => {
    const r = calc(d), r2 = calc(2 * d), S = SOURCES[src];
    const ec = ecartDisque(d, TAILLE[src]);
    read.set('Faisceau réglé', `${fmtNum(r.theta, 0)}° (ce projecteur va de ${S.angles[0]}° à ${S.angles[1]}°) ; angle de champ ≈ ${fmtNum(angleChampDe(r.theta), 0)}°`);
    read.set('Intensité dans l\'axe', `${nb(r.I0)} cd`);
    read.set('Part de l\'axe à cet écart', `${fmtNum(profil(r.theta, alpha) * 100, 0)} % à ${alpha}° de l'axe`);
    read.set('Éclairement au sujet', `${nb(r.E)} lx (incidence ${inc}° : × ${fmtNum(Math.cos(inc * Math.PI / 180), 2)})`);
    read.set('Deux fois plus loin', `${nb(r2.E)} lx à ${fmtNum(2 * d, 1)} m : ÷ ${fmtNum(r2.E > 0 ? r.E / r2.E : 0, 1)}, ${fmtNum(r2.E > 0 ? diaphs(r.E, r2.E) : 0, 1)} diaphs`);
    read.set('Diamètre du faisceau', `${fmtNum(r.diametre, 2)} m à ${fmtNum(d, 1)} m`);
    read.set('La loi à cette distance', `source de ${fmtNum(TAILLE[src] * 100, 0)} cm : la loi surestime de ${fmtNum(ec * 100, ec < 0.01 ? 1 : 0)} % (sous 1 % au-delà de ${fmtNum(distanceSure(TAILLE[src]), 1)} m)`);
    verdict.className = 'co-verdict ' + (ec > 0.05 ? 'warn' : profil(r.theta, alpha) < 0.5 ? 'ko' : 'ok');
    verdict.textContent = ec > 0.05 ? `Si près d'une source de ${fmtNum(TAILLE[src] * 100, 0)} cm, la source n'est plus « un point » : reculer de deux fois divise l'éclairement par moins de quatre.`
      : profil(r.theta, alpha) < 0.5 ? `Le sujet est hors du faisceau (au-delà de ${fmtNum(r.theta / 2, 0)}° de l'axe) : il ne reçoit que ${fmtNum(profil(r.theta, alpha) * 100, 0)} % de l'axe. Repointez le projecteur.`
        : `La loi s'applique : deux fois plus loin, quatre fois moins de lumière, deux diaphs.`;
    // la courbe E(d), en échelle logarithmique
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 210); g.font = FONT;
    const X = (x) => 60 + (x - 1) / 19 * 620, Y = (e) => 180 - (Math.log10(borne(e, 10, 1e5)) - 1) / 4 * 160;
    g.strokeStyle = '#2a3238';
    for (const e of [10, 100, 1000, 10000, 100000]) { g.beginPath(); g.moveTo(60, Y(e)); g.lineTo(680, Y(e)); g.stroke(); g.fillStyle = '#6f7a84'; g.fillText(fmtNum(e, 0), 6, Y(e) + 4); }
    for (const x of [1, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20]) { g.fillStyle = '#6f7a84'; g.fillText(`${x} m`, X(x) - 8, 198); }
    g.fillStyle = '#aab4ba'; g.fillText('éclairement (lx, échelle logarithmique) selon la distance', 60, 14);
    g.strokeStyle = C.amber; g.lineWidth = 1.8; g.beginPath();
    for (let x = 1; x <= 20; x += 0.1) { const e = calc(x).E; g[x === 1 ? 'moveTo' : 'lineTo'](X(x), Y(Math.max(e, 10))); }
    g.stroke(); g.lineWidth = 1;
    for (const [x, e, col] of [[d, r.E, C.white], [2 * d, r2.E, C.cyan]]) {
      if (/** @type {number} */ (x) > 20) continue;
      g.fillStyle = /** @type {string} */ (col); g.beginPath(); g.arc(X(/** @type {number} */ (x)), Y(/** @type {number} */ (e)), 4, 0, 7); g.fill();
      g.fillText(`${nb(/** @type {number} */ (e))} lx`, X(/** @type {number} */ (x)) + 6, Y(/** @type {number} */ (e)) - 6);
    }
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Projecteur', Object.values(SOURCES).map((S) => [S.id, S.nom]), src, (v) => { src = v; draw(); }),
      slider('Angle de faisceau', 12, 60, angle, 1, (v) => { angle = v; draw(); }, (v) => `${v}°`),
      slider('Distance au sujet', 0.5, 20, d, 0.5, (v) => { d = v; draw(); }, (v) => `${fmtNum(v, 1)} m`),
      slider('Incidence sur la surface', 0, 80, inc, 5, (v) => { inc = v; draw(); }, (v) => `${v}°`),
      slider('Écart du sujet à l\'axe', 0, 40, alpha, 1, (v) => { alpha = v; draw(); }, (v) => `${v}°`)),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'L\'éclairement selon la distance, en échelle logarithmique : chaque doublement de distance fait descendre la courbe du même écart (÷ 4). Le point blanc est le sujet, le bleu le même sujet deux fois plus loin.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 4. La couleur de la lumière
// ======================================================================================
function figCouleur() {
  const f = figure(720, 236, 'Une échelle des températures de couleur, de 2 000 à 10 000 K, tracée en mireds (un million divisé par les kelvins) : en mireds, les écarts se lisent à égalité. Repères : l\'halogène gradué à moitié vers 2 400 K, l\'halogène à 3 200 K, la lumière mêlée à 4 300 K, le jour et la HMI à 5 600 K, le ciel couvert à 6 500 K. Une gélatine décale toujours du même nombre de mireds : la CTB pleine, environ moins 137, fait passer l\'halogène de 3 200 à environ 5 700 K ; la CTO pleine, environ plus 159, fait passer la lumière du jour de 5 600 à environ 3 200 K. En bas, les 500 K entre 2 700 et 3 200 K valent 58 mireds, les 500 K entre 6 000 et 6 500 K seulement 13.');
  f.append(txt(10, 16, 'Les kelvins et les mireds : la même échelle, lue autrement', 'co-t', 'start'));
  // de 100 mireds (10 000 K, le froid, à gauche) à 500 mireds (2 000 K, le chaud, à droite)
  const Xm = (m) => 40 + (m - 100) / 400 * 640, Xr = (T) => Xm(mired(T));
  // le dégradé du froid au chaud
  for (let m = 100; m < 500; m += 5) {
    const t = (m - 100) / 400;
    f.append(sv('rect', { x: Xm(m), y: 40, width: 8.5, height: 16, fill: `rgb(${Math.round(150 + 105 * t)},${Math.round(190 + 20 * (1 - Math.abs(t - 0.5) * 2) - 30 * t)},${Math.round(255 - 160 * t)})` }));
  }
  const rep = [[2400, 'halogène à 50 %'], [3200, 'halogène'], [4300, 'lumière mêlée'], [5600, 'jour, HMI'], [6500, 'ciel couvert']];
  rep.forEach(([T, nom], i) => f.append(sv('line', { x1: Xr(/** @type {number} */ (T)), y1: 36, x2: Xr(/** @type {number} */ (T)), y2: 62, stroke: C.white }), txt(Xr(/** @type {number} */ (T)), 76 + (i % 2) * 13, `${fmtNum(/** @type {number} */ (T), 0)} K`, 'co-s'), txt(Xr(/** @type {number} */ (T)), 102 + (i % 2) * 13, /** @type {string} */ (nom), 'co-s')));
  f.append(txt(40, 34, 'froid', 'co-s', 'start'), txt(680, 34, 'chaud', 'co-s', 'end'));
  // les gélatines : CTB et CTO
  const ctb = gelById('ctb'), cto = gelById('cto');
  const t1 = kelvin(mired(3200) + ctb.mired), t2 = kelvin(mired(5600) + cto.mired);
  f.append(arrow(Xr(3200), 140, Xr(t1), 140, C.cyan), txt((Xr(3200) + Xr(t1)) / 2, 134, `CTB pleine ${fmtNum(ctb.mired, 0).replace('-', '−')} mireds : 3 200 → ${K(t1)}`, 'co-s', 'middle', { fill: C.cyan }));
  f.append(arrow(Xr(5600), 170, Xr(t2), 170, C.amber), txt((Xr(5600) + Xr(t2)) / 2, 186, `CTO pleine +${fmtNum(cto.mired, 0)} mireds : 5 600 → ${K(t2)}`, 'co-s', 'middle', { fill: C.amber }));
  f.append(txt(10, 214, `Mireds = 10⁶ ÷ K. De 2 700 à 3 200 K : ${fmtNum(mired(2700) - mired(3200), 0)} mireds ; de 6 000 à 6 500 K : ${fmtNum(mired(6000) - mired(6500), 0)}. Les mêmes 500 K ne se voient pas pareil.`, 'co-s', 'start'));
  f.append(txt(10, 230, 'L\'écart toléré entre la lumière et la balance de la caméra : une vingtaine de mireds (ordre de grandeur).', 'co-s', 'start'));
  return f;
}
/** un aperçu de la dominante : la couleur d'une surface neutre vue par la caméra (indicatif) */
function teinte(dm, base) {
  const s = borne(dm / 150, -1, 1); let [r, g, b] = base;
  if (s > 0) { g *= 1 - 0.18 * s; b *= 1 - 0.55 * s; } else { r *= 1 + 0.5 * s; g *= 1 + 0.15 * s; }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}
function demoCouleur(host) {
  let src = 'fresnel', niveau = 100, Tled = 5600, gel = 'aucune', Tcam = 3200, jour = 0;
  const read = readout(['Température de la lumière', 'Balance de la caméra', 'Écart (dominante)', 'Gélatine la plus proche de la correction', 'Lumière perdue dans la gélatine']);
  const verdict = el('p', { class: 'co-verdict' });
  const cv = canvas(720, 170, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const draw = () => {
    const r = eclairage({ source: src, angle: 30, niveau: niveau / 100, Tled, gel, d: 3 });
    // la lumière du jour d'une fenêtre (5 600 K), une part de l'éclairement du projecteur
    const m = jour > 0 && r.E > 0 ? melange([{ E: r.E, T: r.T }, { E: r.E * jour, T: 5600 }]) : { E: r.E, T: r.T };
    const T = m.T > 0 ? m.T : SOURCES[src].T, dm = dominante(T, Tcam), G = gelById(gel), best = gelPour(T, Tcam);
    const lum = gradateur(SOURCES[src], niveau / 100, Tled);
    read.set('Température de la lumière', `${K(T)}, ${fmtNum(mired(T), 0)} mireds${src === 'fresnel' && niveau < 100 ? ` (gradateur à ${niveau} % : ${fmtNum(lum.flux * 100, 0)} % du flux)` : ''}${jour > 0 ? ' ; mélange avec le jour' : ''}`);
    read.set('Balance de la caméra', `${fmtNum(Tcam, 0)} K, ${fmtNum(mired(Tcam), 0)} mireds`);
    read.set('Écart (dominante)', `${signe(dm, 0)} mireds : ${Math.abs(dm) <= TOL_MIRED ? 'neutre à l\'œil' : dm > 0 ? 'l\'image tire vers l\'orange' : 'l\'image tire vers le bleu'}`);
    read.set('Gélatine la plus proche de la correction', `${best.nom} (il faudrait ${signe(correction(T, Tcam), 0)} mireds)`);
    read.set('Lumière perdue dans la gélatine', G.trans < 1 ? `${fmtNum(G.trans * 100, 0)} % transmis : ${fmtNum(Math.log2(1 / G.trans), 1)} diaph de moins` : 'aucune');
    verdict.className = 'co-verdict ' + (Math.abs(dm) <= TOL_MIRED ? 'ok' : Math.abs(dm) <= 60 ? 'warn' : 'ko');
    verdict.textContent = Math.abs(dm) <= TOL_MIRED ? `Accordé : ${signe(dm, 0)} mireds, moins d'une vingtaine, passe presque inaperçu.`
      : `${Math.abs(dm) <= 60 ? 'Une dominante visible' : 'Une forte dominante'} : ${signe(dm, 0)} mireds. ${best.id !== 'aucune' ? `Une ${best.nom} sur la source, ou une` : 'Une'} balance de la caméra à ${K(T)}.`;
    // l'échelle des mireds, la lumière et la caméra
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 170); g.font = FONT;
    const X = (mm) => 40 + (borne(mm, 100, 500) - 100) / 400 * 400;
    g.fillStyle = '#1a2026'; g.fillRect(40, 30, 400, 14);
    g.fillStyle = 'rgba(127,209,160,.35)'; g.fillRect(X(mired(Tcam) - TOL_MIRED), 30, X(mired(Tcam) + TOL_MIRED) - X(mired(Tcam) - TOL_MIRED), 14);
    g.fillStyle = '#aab4ba'; g.fillText('mireds : 100 (froid) à 500 (chaud) ; en vert, ± 20 autour de la balance', 40, 18);
    for (const mm of [100, 200, 300, 400, 500]) { g.fillStyle = '#6f7a84'; g.fillText(`${mm}`, X(mm) - 8, 58); }
    g.fillStyle = C.white; g.fillRect(X(mired(Tcam)) - 1, 24, 3, 26); g.fillText('caméra', X(mired(Tcam)) - 18, 72);
    g.fillStyle = C.amber; g.beginPath(); g.arc(X(mired(T)), 37, 6, 0, 7); g.fill(); g.fillText('lumière', X(mired(T)) - 18, 88);
    // ce que voit la caméra : trois surfaces neutres ou connues (aperçu indicatif)
    const patch = [['blanc', [236, 236, 236]], ['gris 18 %', [118, 118, 118]], ['peau', [214, 168, 140]]];
    patch.forEach(([nom, base], k) => {
      const x = 470 + k * 82;
      g.fillStyle = teinte(dm, base); g.fillRect(x, 24, 70, 70);
      g.fillStyle = '#aab4ba'; g.fillText(/** @type {string} */ (nom), x, 108);
    });
    g.fillStyle = '#6f7a84'; g.fillText('ce que voit la caméra (aperçu indicatif)', 470, 126);
    g.fillStyle = '#aab4ba'; g.fillText('L\'axe vert / magenta se règle à part (gélatines « plus vert », « moins vert »).', 40, 156);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Source', Object.values(SOURCES).map((S) => [S.id, S.nom]), src, (v) => { src = v; draw(); }),
      slider('Niveau du gradateur', 10, 100, niveau, 5, (v) => { niveau = v; draw(); }, (v) => `${v} %`),
      slider('Couleur du panneau LED', 2800, 6500, Tled, 100, (v) => { Tled = v; draw(); }, (v) => `${fmtNum(v, 0)} K`),
      choice('Gélatine', GELS.map((x) => [x.id, x.nom]), gel, (v) => { gel = v; draw(); }),
      slider('Balance de la caméra', 2500, 7500, Tcam, 100, (v) => { Tcam = v; draw(); }, (v) => `${fmtNum(v, 0)} K`),
      choice('Lumière du jour par une fenêtre', [['0', 'aucune'], ['0.25', 'un peu (25 %)'], ['1', 'autant que le projecteur']], '0', (v) => { jour = +v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'La lumière et la balance de la caméra sur l\'échelle des mireds, et l\'aperçu de la dominante sur trois surfaces. Le gradateur ne change la couleur que de l\'halogène ; la couleur du panneau ne compte que pour la LED.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 5. Mesurer la lumière et exposer
// ======================================================================================
const SUJETS = { clair: { nom: 'clair (chemise blanche, 90 %)', rho: 0.9 }, moyen: { nom: 'moyen (gris 18 %)', rho: 0.18 }, sombre: { nom: 'sombre (veste noire, 4 %)', rho: 0.04 } };
function figMesure() {
  const f = figure(720, 262, 'Deux façons de mesurer la lumière. À gauche, la mesure incidente : la cellule (un luxmètre, une cellule plate ou un dôme) est posée au sujet, tournée vers la caméra ; elle mesure la lumière qui arrive, l\'éclairement en lux, et ne dépend pas du sujet ; N² ÷ t = E × S ÷ C, avec C = 250 pour une cellule plate. À droite, la mesure réfléchie : le spotmètre vise le sujet depuis la caméra et mesure sa luminance en candelas par mètre carré ; N² ÷ t = L × S ÷ K, avec K = 12,5 ; il suppose un sujet gris moyen et se trompe sur un sujet clair (sous-exposé) ou sombre (surexposé). En bas, un diaph vaut un facteur deux de lumière, et 6 dB de gain valent environ un diaph.');
  f.append(txt(10, 16, 'Mesurer la lumière qui arrive, ou celle qui repart', 'co-t', 'start'));
  // incidente
  f.append(box(14, 28, 336, 188, C.amber), txt(182, 48, 'Mesure incidente', 'co-t'));
  f.append(sv('circle', { cx: 60, cy: 92, r: 8, fill: C.amber }), arrow(70, 96, 150, 120, C.amber), txt(52, 76, 'projecteur', 'co-s'));
  f.append(sv('rect', { x: 150, y: 100, width: 34, height: 54, rx: 6, fill: C.box, stroke: C.white }), sv('path', { d: 'M184 112 A 12 12 0 0 1 184 136', fill: C.white }), txt(167, 170, 'cellule au sujet', 'co-s'));
  f.append(arrow(200, 124, 290, 124, C.grey), sv('rect', { x: 292, y: 112, width: 34, height: 24, fill: C.box, stroke: C.cyan }), txt(309, 150, 'caméra', 'co-s'));
  f.append(txt(30, 190, 'mesure E (lx) : ne dépend pas du sujet', 'co-s', 'start', { fill: C.white }), txt(30, 206, `N² ÷ t = E × S ÷ C · C = ${C_PLATE} (plate), vers 330 (dôme)`, 'co-s', 'start'));
  // réfléchie
  f.append(box(370, 28, 336, 188, C.cyan), txt(538, 48, 'Mesure réfléchie (spotmètre)', 'co-t'));
  const ys = [76, 112, 148], gris = ['#e8e8e8', '#777', '#1d1d1d'];
  ys.forEach((y, k) => f.append(sv('rect', { x: 392, y: y - 12, width: 30, height: 24, fill: gris[k], stroke: C.grey })));
  f.append(txt(436, 80, 'clair : sous-exposé', 'co-s', 'start'), txt(436, 116, 'moyen : juste', 'co-s', 'start'), txt(436, 152, 'sombre : surexposé', 'co-s', 'start'));
  f.append(sv('rect', { x: 640, y: 102, width: 40, height: 22, rx: 4, fill: C.box, stroke: C.white }), sv('path', { d: 'M640 113 L560 112', stroke: C.white, strokeDasharray: '3 2' }), txt(660, 140, 'spotmètre', 'co-s'));
  f.append(txt(386, 190, 'mesure L (cd/m²) : suppose un gris moyen', 'co-s', 'start', { fill: C.white }), txt(386, 206, `N² ÷ t = L × S ÷ K · K = ${fmtNum(K_SPOT, 1)}`, 'co-s', 'start'));
  f.append(txt(10, 238, 'Un diaph = un facteur 2 de lumière (f/4 → f/5,6 : moitié moins). Gain : 6 dB ≈ un diaph, et du bruit en plus.', 'co-s', 'start'));
  f.append(txt(10, 254, 'Au car, l\'iris se règle sur la forme d\'onde : gris 18 % vers 41 % (BT.709), blancs sous 100 %.', 'co-s', 'start'));
  return f;
}
function demoMesure(host) {
  let E = 1000, S = 800, t = 1 / 50, sujet = 'clair', mode = 'incidente';
  const read = readout(['Cellule incidente (plate, C = 250)', 'Spotmètre sur le sujet (K = 12,5)', 'Erreur du spotmètre sur ce sujet', 'Caméra du car (f/13 à 2 000 lx)', 'Le gris 18 % sur la forme d\'onde']);
  const verdict = el('p', { class: 'co-verdict' });
  const cv = canvas(720, 200, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const draw = () => {
    const rho = SUJETS[sujet].rho, L = luminance(E, rho);
    const Ni = ouverture(E, S, t), Ns = ouvertureSpot(L, S, t), err = erreurSpot(rho);
    const expo = mode === 'spot' ? err : 0;
    const Nc = ouvertureCamera(E), manque = Nc < 1.8 ? diaphsEntre(Nc, 1.8) : 0;
    read.set('Cellule incidente (plate, C = 250)', `${fN(Ni)} (gravé le plus proche : ${fN(diaphProche(Ni))})`);
    read.set('Spotmètre sur le sujet (K = 12,5)', `${nb(L)} cd/m² → ${fN(Ns)}`);
    read.set('Erreur du spotmètre sur ce sujet', `${signe(err, 1)} diaph${Math.abs(err) >= 2 ? 's' : ''} (il vise un gris de ${fmtNum(grisVise() * 100, 0)} %)`);
    read.set('Caméra du car (f/13 à 2 000 lx)', manque > 0 ? `il faudrait ${fN(Nc)} : l'objectif n'ouvre qu'à f/1,8, il manque ${fmtNum(manque, 1)} diaph${manque >= 2 ? 's' : ''}, soit +${fmtNum(dbPourDiaphs(manque), 0)} dB de gain` : `${fN(Nc)} sans gain`);
    const v = (r) => signal('bt709', r, expo).V * 100;
    read.set('Le gris 18 % sur la forme d\'onde', `${fmtNum(v(0.18), 0)} % (juste : vers 41 %) ; le sujet ${sujet} à ${fmtNum(v(rho), 0)} %`);
    verdict.className = 'co-verdict ' + (mode === 'incidente' || Math.abs(err) < 0.5 ? 'ok' : Math.abs(err) < 1.5 ? 'warn' : 'ko');
    verdict.textContent = mode === 'incidente' ? 'La cellule incidente mesure la lumière qui arrive : le clair reste clair, le sombre reste sombre, le gris tombe à sa place.'
      : Math.abs(err) < 0.5 ? 'Sur un sujet moyen, le spotmètre et la cellule incidente s\'accordent.'
        : err < 0 ? `Le spotmètre rend le sujet clair gris : l'image est sous-exposée de ${fmtNum(-err, 1)} diaphs. Ouvrez d'autant, ou mesurez un gris.`
          : `Le spotmètre rend le sujet sombre gris : l'image est surexposée de ${fmtNum(err, 1)} diaphs, les blancs écrêtent. Fermez d'autant.`;
    // la forme d'onde : trois plages vues par la caméra (BT.709), avec l'exposition qu'a donnée la mesure
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 200); g.font = FONT;
    const Y = (p) => 176 - p / 110 * 160;
    for (const p of [0, 20, 41, 60, 80, 100, 109]) { g.strokeStyle = p === 100 ? '#6b3a3a' : p === 41 ? '#2f5240' : '#2a3238'; g.beginPath(); g.moveTo(60, Y(p)); g.lineTo(460, Y(p)); g.stroke(); g.fillStyle = '#6f7a84'; g.fillText(`${p} %`, 18, Y(p) + 4); }
    Object.entries(SUJETS).forEach(([id, s], k) => {
      const x0 = 80 + k * 130, V = v(s.rho);
      g.strokeStyle = id === sujet ? C.white : C.green; g.lineWidth = 3; g.beginPath(); g.moveTo(x0, Y(V)); g.lineTo(x0 + 100, Y(V)); g.stroke(); g.lineWidth = 1;
      g.fillStyle = id === sujet ? C.white : '#aab4ba'; g.fillText(id, x0 + 30, 194);
    });
    g.fillStyle = '#aab4ba'; g.fillText(`forme d'onde (BT.709) : exposition ${mode === 'spot' ? `du spotmètre (${signe(expo, 1)} diaph)` : 'de la cellule incidente'}`, 60, 14);
    // les deux nombres f
    g.fillStyle = C.amber; g.fillText(`incidente : ${fN(Ni)}`, 500, 60); g.fillStyle = C.cyan; g.fillText(`spotmètre : ${fN(Ns)}`, 500, 84);
    g.fillStyle = '#aab4ba'; g.fillText(`écart : ${fmtNum(Math.abs(diaphsEntre(Ni, Ns)), 1)} diaph`, 500, 108);
    g.fillText(`ISO ${S}, 1/${fmtNum(1 / t, 0)} s, ${nb(E)} lx`, 500, 132);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Mesure suivie', [['incidente', 'cellule incidente'], ['spot', 'spotmètre sur le sujet']], mode, (v) => { mode = v; draw(); }),
      choice('Sujet', Object.entries(SUJETS).map(([id, s]) => [id, s.nom]), sujet, (v) => { sujet = v; draw(); }),
      slider('Éclairement au sujet', 10, 5000, E, 10, (v) => { E = v; draw(); }, (v) => `${fmtNum(v, 0)} lx`),
      choice('Sensibilité', [['200', 'ISO 200'], ['400', 'ISO 400'], ['800', 'ISO 800'], ['1600', 'ISO 1600']], String(S), (v) => { S = +v; draw(); }),
      choice('Temps de pose', [['25', '1/25 s'], ['50', '1/50 s'], ['100', '1/100 s'], ['250', '1/250 s']], '50', (v) => { t = 1 / +v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Trois plages (clair, moyen, sombre) sous le même éclairement, vues par une caméra BT.709 exposée d\'après la mesure choisie. Avec la cellule incidente, chacune est à sa place ; avec le spotmètre, c\'est le sujet visé qui tombe au gris.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// Les leçons
// ======================================================================================
const l1 = surLigne(1000, 'halogene');
/** une HMI à 5 600 K sous une demi-CTO */
const T_HMI_DEMI_CTO = kelvin(mired(5600) + gelById('demi-cto').mired);
const phi1k = flux(1000, 'halogene');
/** @type {import('./index.js').Lesson[]} */
export const LUMIERE_MESURE = [
  {
    id: 'lumiere-sources', title: 'Les sources : halogène, HMI, LED', minutes: '8 min',
    essentials: [
      'Une source se choisit sur sa **couleur** (**3 200 K** l\'halogène, **5 600 K** la HMI et le jour), son **rendu des couleurs** (**IRC** pour l\'œil, **TLCI** pour la caméra) et son **efficacité** en **lumens par watt**.',
      `**Flux = puissance × efficacité** : un halogène donne environ 20 lm/W, une HMI ou une LED quatre à cinq fois plus ; **1 kW sous 230 V tire ${fmtNum(l1.I, 2)} A**, une ligne de **16 A** en porte **${l1.n}**.`,
      'Au gradateur, l\'**halogène rougit**, la **LED** garde sa couleur, la **HMI** se gradue peu et met **une à deux minutes** à s\'allumer.',
    ],
    figure: figSources,
    demoTitle: 'Choisissez une famille et une puissance : lisez le flux, le courant, le nombre de projecteurs sur une ligne de 16 A, et la puissance d\'une LED pour la même lumière. Passez de 1 kW à 2 kW en halogène.',
    demo: demoSources,
    body: `Une source de lumière pour la caméra se juge sur quatre points : sa **couleur** (la température de couleur, en kelvins), la **fidélité** de ses couleurs, son **rendement** (la lumière qu'elle donne pour un watt) et sa façon de se **graduer** (baisser sans changer le reste). Trois familles se partagent les plateaux de télévision.

**L'halogène** est une lampe à incandescence : un filament de tungstène chauffé dans une ampoule remplie d'un gaz halogène, qui le fait durer. Sa lumière est à **3 200 K**, la référence « tungstène » des caméras. Son spectre est continu, comme celui du soleil : il rend toutes les couleurs (IRC de 99 à 100). Mais il ne donne que **18 à 25 lm/W** : plus de 90 % de la puissance part en chaleur (en infrarouge). Au gradateur, le filament refroidit et la lumière **rougit** : à mi-tension, elle n'est plus qu'à 2 400 K environ.

**La HMI** (hydrargyrum medium-arc iodide : un arc électrique dans de la vapeur de mercure et d'iodures métalliques) donne une lumière à **5 600 K**, celle du jour, avec **75 à 100 lm/W**. Son spectre est fait de raies, corrigées par les iodures : IRC de 90 à 95. Elle a besoin d'un **ballast**, qui amorce l'arc sous haute tension puis limite le courant. Elle met **une à deux minutes** à atteindre sa pleine lumière et sa couleur, et une lampe chaude coupée par erreur ne se rallume pas toujours aussitôt. Elle se gradue peu (entre 50 et 100 % selon le ballast) : on la règle par la distance, les volets, les diffuseurs, les filtres. Un vieux ballast magnétique la fait scintiller à 100 Hz ; un ballast électronique l'évite.

**La LED** (diode électroluminescente) donne **60 à 130 lm/W**. Une LED blanche est le plus souvent une diode bleue couverte d'un luminophore jaune : son spectre a des creux (dans le cyan, dans le rouge profond), et deux LED de même température peuvent rendre une peau différemment. Les projecteurs **bicolores** mélangent deux séries de diodes, de 2 700 à 6 500 K environ. La LED se gradue **de 0 à 100 % sans changer de couleur** et chauffe peu vers le sujet, mais son électronique doit être refroidie (ventilateur, radiateur).

**Le rendu des couleurs.** L'**IRC** (indice de rendu des couleurs, noté **Ra**, CIE 13.3) compare huit échantillons de couleurs pastel éclairés par la source et par une lumière de référence de même température : 100, c'est identique. Il a été pensé pour l'œil, et il ignore le rouge saturé (l'échantillon R9), là où pèchent beaucoup de LED. Le **TLCI** (Television Lighting Consistency Index, EBU Tech 3355) remplace l'œil par une caméra type et dit ce que l'étalonneur aura à corriger : au-dessus de 85 environ, rien ou presque ; en dessous de 50, la source est déconseillée (ordres de grandeur de la grille de l'EBU). Pour la télévision, c'est le TLCI qu'on lit.

**La puissance et le secteur.** Le flux est la puissance multipliée par l'efficacité : un Fresnel halogène de 1 kW donne environ **${fmtNum(phi1k, 0)} lm** (au milieu de 18 à 25 lm/W) ; une LED de ${fmtNum(puissancePour(phi1k, 'led'), 0)} W donne à peu près autant. Le courant tiré sur le secteur vaut **I = P ÷ (U × cos φ)** : **1 000 W ÷ 230 V = ${fmtNum(l1.I, 2)} A**. Une ligne monophasée de **16 A** porte donc **${l1.n} projecteurs de 1 kW** (${fmtNum(l1.total, 1)} A) ; le quatrième la ferait déclencher (${fmtNum(4 * l1.I, 1)} A).

- Le **cos φ** (facteur de puissance) vaut 1 pour une lampe à incandescence, qui est une simple résistance ; une alimentation électronique avec correction est vers 0,95 ; un vieux ballast magnétique sans correction tombe bien plus bas (de l'ordre de 0,6) et tire d'autant plus de courant pour la même puissance (ordres de grandeur).
- La chaleur compte : un plateau éclairé en halogène se climatise, et un projecteur chaud se manipule avec des gants.
- En pratique, on ne charge pas une ligne à 100 % en continu : on garde une marge.`,
    plus: `Pourquoi 3 200 K et 5 600 K ? Ce sont des conventions de la prise de vue : 3 200 K, la lampe halogène de studio ; 5 600 K, une lumière du jour moyenne (soleil et ciel). Une caméra de car a des préréglages et des filtres de conversion pour ces températures. Le TLCI a un cousin pour les projecteurs qui doivent s'accorder entre eux, le TLMF (Television Luminaire Matching Factor, même document de l'EBU). Les LED les plus fidèles ajoutent des diodes de couleur (rouge, ambre, vert, cyan) au blanc pour combler les creux du spectre. Les chiffres d'efficacité sont des ordres de grandeur : ils progressent chaque année pour les LED.`,
    car: { text: 'Le car n\'éclaire pas le stade, mais le plateau du présentateur, le bord terrain et l\'interview d\'après-match se montent avec ces sources. Au Labo (Jouer → Le Labo), l\'atelier Photométrie fait comparer un Fresnel halogène, une HMI et un panneau LED : flux, couleur, gradation.' },
    terms: ['irc', 'efficacite-lumineuse', 'temperature-couleur', 'flux-lumineux'],
    competences: ['C17', 'C23'], savoirs: ['D1', 'G2'],
    quiz: [
      { q: 'Le réalisateur demande de baisser de moitié la lumière principale d\'une interview éclairée en halogène, au gradateur. La caméra est balancée à 3 200 K. Que voit-elle ?', choices: ['Un visage plus sombre et plus orangé', ['Un visage plus sombre, de la même couleur', 'C\'est ce que ferait une LED. Un filament moins chaud émet une lumière plus rouge : l\'halogène rougit au gradateur.'], ['Un visage plus sombre et plus bleu', 'C\'est l\'inverse : en baissant, le filament refroidit, la température de couleur baisse, la lumière tire vers l\'orange.']], answer: 0, why: 'La température de couleur d\'un halogène suit à peu près la tension à la puissance 0,42 : à mi-tension, il descend vers 2 400 K. Pour baisser sans changer la couleur, on recule le projecteur, on le diffuse ou on pose un filtre neutre.' },
      { q: 'Pendant la répétition, une HMI est coupée par erreur. On la rallume aussitôt. À quoi faut-il s\'attendre ?', choices: ['Elle peut refuser de se rallumer à chaud, et met une à deux minutes à retrouver sa lumière et sa couleur', ['Elle repart aussitôt à pleine lumière', 'Une HMI est une lampe à arc : il faut réamorcer l\'arc sous haute tension, puis attendre que la lampe chauffe pour qu\'elle donne tout son flux et sa couleur.'], ['Elle repart, mais à 3 200 K', 'Une HMI ne change pas de famille : elle reste vers 5 600 K une fois chaude ; c\'est sa montée en température qui prend du temps.']], answer: 0, why: 'L\'arc d\'une HMI s\'amorce par le ballast sous haute tension ; une lampe chaude ne se réamorce pas toujours tout de suite (sauf ballast prévu pour), et la pleine lumière demande une à deux minutes. On allume les HMI avant l\'antenne et on ne les coupe pas entre deux prises.' },
      { q: `Sur une ligne monophasée de 16 A sous 230 V, combien de Fresnel halogène de 1 kW peut-on brancher ?`, choices: [`${l1.n}`, [`${l1.n + 1}`, `${l1.n + 1} projecteurs tirent ${fmtNum((l1.n + 1) * l1.I, 1)} A : plus que les 16 A de la ligne, le disjoncteur déclenche.`], ['16', 'Un projecteur ne tire pas 1 A : 1 000 W ÷ 230 V = 4,35 A chacun.']], answer: 0, why: `Chaque projecteur tire 1 000 ÷ 230 = ${fmtNum(l1.I, 2)} A : ${l1.n} en tirent ${fmtNum(l1.total, 1)} A, un de plus dépasserait 16 A. En pratique, on garde même une marge.` },
      { q: 'Deux panneaux LED donnent le même flux et affichent tous les deux un IRC de 95. L\'un a un TLCI de 92, l\'autre de 68. Lequel prendre pour le plateau ?', choices: ['Celui à 92 de TLCI', ['L\'un ou l\'autre : leur IRC est le même', 'L\'IRC est pensé pour l\'œil, sur huit couleurs pastel ; une caméra ne voit pas le spectre comme l\'œil. Le TLCI la simule.'], ['Celui à 68, il est sans doute plus économique', 'Le TLCI ne mesure pas la consommation : il dit ce que l\'étalonneur aura à corriger. À 68, il y aura des corrections.']], answer: 0, why: 'Le TLCI (EBU Tech 3355) simule une caméra et dit à quel point l\'image s\'écarte d\'une lumière de référence : au-dessus de 85 environ, presque rien à corriger. Deux sources de même IRC peuvent avoir des TLCI très différents.' },
      { q: `On remplace un Fresnel halogène de 2 kW par un projecteur LED qui donne autant de lumière, à 100 lm/W environ. Quelle puissance pour la LED ?`, choices: [`Environ ${fmtNum(flux(2000, 'halogene') / 100, 0)} W`, ['2 kW : même lumière, même puissance', 'La lumière dépend de l\'efficacité : une LED donne quatre à cinq fois plus de lumens par watt qu\'un halogène.'], ['Environ 20 W', 'Le calcul a perdu un facteur : 2 000 W × 21,5 lm/W ≈ 43 000 lm, et 43 000 ÷ 100 ≈ 430 W.']], answer: 0, why: `Flux de l'halogène : 2 000 W × 21,5 lm/W ≈ ${fmtNum(flux(2000, 'halogene'), 0)} lm. À 100 lm/W, la LED en demande ${fmtNum(flux(2000, 'halogene') / 100, 0)} W, cinq fois moins : moins de courant, moins de chaleur.` },
      { q: 'En extérieur de jour, il faut déboucher un visage à contre-jour avec une source puissante, sur une alimentation limitée. Laquelle choisir ?', choices: ['Une HMI (5 600 K)', ['Un Fresnel halogène, sans correction', 'À 3 200 K sous la lumière du jour, le visage tirerait nettement vers l\'orange.'], ['Un halogène avec une CTB pleine : cela revient au même', 'La CTB pleine ne laisse passer qu\'un tiers environ de la lumière (36 %) : l\'halogène, déjà quatre fois moins efficace, perd encore plus d\'un diaph.']], answer: 0, why: 'La HMI est à la température du jour et donne quatre fois plus de lumière par watt qu\'un halogène. Un halogène bleui à la CTB pleine perd les deux tiers de sa lumière dans la gélatine.' },
    ],
  },
  {
    id: 'lumiere-grandeurs', title: 'Flux, intensité, éclairement, luminance', minutes: '8 min',
    essentials: [
      'Le **flux** (lumen) est toute la lumière qui sort ; l\'**intensité** (candela = lumen par stéradian) est la lumière envoyée dans une direction : **I = Φ ÷ Ω**.',
      'L\'**éclairement** (lux = lumen par m²) est la lumière **reçue** par le sujet : **E = I ÷ d²** dans l\'axe ; c\'est ce que lit le **luxmètre**.',
      'La **luminance** (cd/m²) est la lumière que le sujet **renvoie** vers la caméra : **L = ρ E ÷ π** pour une surface mate (carte grise 18 %, carte blanche 90 %).',
    ],
    figure: figGrandeurs,
    demoTitle: 'Réglez le flux, l\'angle du faisceau et la distance. Serrez le faisceau de 60° à 15° : le flux ne change pas, l\'intensité et l\'éclairement montent. Comparez la luminance des deux cartes.',
    demo: demoGrandeurs,
    body: `Quatre grandeurs décrivent la lumière, de la source à la caméra. Elles se confondent dans la conversation (« il y a beaucoup de lumière »), mais elles ne se mesurent pas de la même façon et ne servent pas aux mêmes réglages.

**Le flux lumineux** (Φ, en **lumens**, lm) est toute la lumière qui sort de la source, pondérée par la sensibilité de l'œil (on ne compte pas l'infrarouge ni l'ultraviolet). C'est un bilan : il ne dit pas où va la lumière. Il dépend de la lampe, pas du réglage du projecteur.

**L'intensité lumineuse** (I, en **candelas**, cd) est la lumière envoyée dans une direction. Elle se compte par **stéradian** (sr), l'unité d'**angle solide** : la portion d'espace d'un cône, mesurée comme la surface qu'il découpe sur une sphère de 1 m de rayon. La sphère entière fait 4π ≈ 12,57 sr ; un cône d'angle au sommet θ fait **Ω = 2π (1 − cos θ/2)** : ${fmtNum(angleSolide(60), 2)} sr pour 60°, ${fmtNum(angleSolide(20), 3)} sr pour 20°. Une candela, c'est **un lumen par stéradian** : **I = Φ ÷ Ω**. Le même flux, serré dans un faisceau étroit, donne une intensité bien plus forte dans l'axe : c'est tout l'intérêt d'un projecteur à lentille.

**L'éclairement** (E, en **lux**, lx) est la lumière **reçue** par chaque mètre carré du sujet : un lux, c'est un lumen par mètre carré. Dans l'axe d'une source et face à elle, **E = I ÷ d²** (la leçon suivante ajoute l'angle). C'est ce que lit le **luxmètre** posé au sujet. Ordres de grandeur : un bureau, 500 lx ; un plateau de télévision, 800 à 2 000 lx ; un stade de haut niveau éclairé pour la télévision, 1 400 à 2 000 lx vers les caméras ; le plein soleil, 100 000 lx.

**La luminance** (L, en **candelas par mètre carré**, cd/m², qu'on appelle aussi nit) est la lumière qu'une surface **renvoie** vers l'œil ou la caméra. C'est elle que voit le capteur. Pour une surface mate, qui renvoie la lumière également dans toutes les directions (on la dit lambertienne), **L = ρ × E ÷ π**, où ρ est le **facteur de réflexion** : la part de la lumière renvoyée.

- Sous 1 000 lx, une **carte grise 18 %** a une luminance de ${fmtNum(luminance(1000, 0.18), 0)} cd/m², une **carte blanche 90 %** de ${fmtNum(luminance(1000, 0.9), 0)} cd/m² : même éclairement, cinq fois plus de lumière renvoyée.
- Exemple complet : ${fmtNum(20000, 0)} lm dans un faisceau de 30° (${fmtNum(angleSolide(30), 3)} sr) donnent environ ${fmtNum(intensiteMoyenne(20000, 30), 0)} cd ; à 10 m, ${fmtNum(eclairementPonctuel(intensiteMoyenne(20000, 30), 10), 0)} lx sur un disque de ${fmtNum(diametre(10, 30), 1)} m de diamètre.
- L'intensité moyenne Φ ÷ Ω suppose le flux réparti également dans le cône : en vrai, l'axe est plus fort que le bord, et une partie du flux sort du faisceau. C'est un ordre de grandeur ; les fiches des projecteurs donnent l'intensité mesurée dans l'axe.`,
    plus: `La candela est une unité de base du Système international : l'intensité d'une source qui émet, dans une direction, une lumière verte de 540 THz (555 nm, là où l'œil est le plus sensible) avec 1/683 W par stéradian. Le lumen et le lux en dérivent. Les écrans s'annoncent en cd/m² : environ 100 cd/m² pour le blanc d'un moniteur de référence en SDR, 1 000 et plus en HDR. Un luxmètre ne mesure qu'un plan (sa cellule plate) : pour un visage, on le tourne vers la caméra, pas vers le projecteur, sauf si l'on veut l'éclairement d'une seule source.`,
    car: { text: 'Au Labo (Jouer → Le Labo), l\'atelier Photométrie affiche l\'intensité dans l\'axe de chaque projecteur selon son faisceau, et un luxmètre posé sur le visage du sujet. Au poste vision du car, c\'est la luminance que voit la caméra : la carte grise et la charte du line-up se règlent d\'après elle.', station: 'vision' },
    terms: ['flux-lumineux', 'angle-solide', 'intensite-lumineuse', 'eclairement', 'luminance', 'gris-18'],
    competences: ['C23', 'C17'], savoirs: ['G4', 'G2'],
    quiz: [
      { q: 'On fait passer un Fresnel du large (60°) au serré (20°), sans toucher au gradateur. Qu\'est-ce qui change ?', choices: ['L\'intensité dans l\'axe augmente ; le flux reste le même', ['Le flux augmente', 'Le flux dépend de la lampe : le serré ne crée pas de lumière, il la concentre.'], ['L\'éclairement au centre diminue', 'C\'est l\'inverse : la même lumière dans un angle solide plus petit donne plus d\'intensité, donc plus d\'éclairement au centre.']], answer: 0, why: `Le flux est le même, l'angle solide passe de ${fmtNum(angleSolide(60), 2)} à ${fmtNum(angleSolide(20), 3)} sr : l'intensité moyenne est multipliée par près de neuf. Le disque éclairé, lui, rétrécit.` },
      { q: 'Le luxmètre, posé sur le visage du présentateur, lit 1 000 lx. Que mesure-t-il ?', choices: ['La lumière reçue par chaque mètre carré du visage', ['La lumière que renvoie le visage vers la caméra', 'C\'est la luminance, que mesure un spotmètre depuis la caméra. Le luxmètre mesure ce qui arrive, pas ce qui repart.'], ['Toute la lumière émise par le projecteur', 'C\'est le flux, en lumens. Le luxmètre ne voit que ce qui arrive sur sa cellule.']], answer: 0, why: 'Le lux est un lumen par mètre carré : l\'éclairement, la lumière reçue. Il ne dépend pas de la couleur du visage, ce qui en fait une mesure sûre pour exposer.' },
      { q: 'Une carte grise 18 % est éclairée à 1 000 lx. Quelle est sa luminance ?', choices: [`Environ ${fmtNum(luminance(1000, 0.18), 0)} cd/m²`, ['180 cd/m²', 'Il manque la division par π : une surface mate renvoie sa lumière dans tout un demi-espace, L = ρ E ÷ π.'], ['1 000 cd/m²', 'Les lux et les cd/m² ne sont pas la même grandeur : l\'un ce qui arrive, l\'autre ce qui repart, et la carte n\'en renvoie que 18 %.']], answer: 0, why: `L = ρ E ÷ π = 0,18 × 1 000 ÷ π ≈ ${fmtNum(luminance(1000, 0.18), 1)} cd/m². Une carte blanche 90 % donnerait cinq fois plus, ${fmtNum(luminance(1000, 0.9), 0)} cd/m².` },
      { q: 'Un projecteur a une intensité de 10 000 cd dans son axe. Le sujet est à 5 m, face à lui. Quel éclairement reçoit-il ?', choices: [`${fmtNum(eclairementPonctuel(10000, 5), 0)} lx`, ['2 000 lx', 'C\'est I ÷ d : l\'éclairement baisse comme le carré de la distance, I ÷ d² = 10 000 ÷ 25.'], ['10 000 lx', 'Ce serait l\'éclairement à 1 m : à 5 m, la lumière s\'étale sur une surface 25 fois plus grande.']], answer: 0, why: 'E = I ÷ d² = 10 000 ÷ 25 = 400 lx. Le même projecteur à 2,5 m en donnerait 1 600.' },
      { q: 'Sous le même projecteur, une chemise blanche et une veste noire sont côte à côte. On pose le luxmètre sur l\'une, puis sur l\'autre. Il lit…', choices: ['la même valeur', ['plus sur la chemise', 'C\'est la luminance qui diffère : la chemise renvoie plus de lumière. Le luxmètre mesure ce qui arrive, et il arrive la même chose sur les deux.'], ['plus sur la veste', 'La veste absorbe la lumière, mais elle en reçoit autant que la chemise : l\'éclairement est le même.']], answer: 0, why: 'Le luxmètre mesure l\'éclairement, la lumière reçue : elle est la même pour les deux. La caméra, elle, voit des luminances très différentes, d\'où le contraste entre la chemise et la veste.' },
      { q: 'Un projecteur a un faisceau de 60°. Quelle part de la sphère éclaire-t-il ?', choices: [`Environ ${fmtNum(angleSolide(60) / (4 * Math.PI) * 100, 0)} %`, ['Un sixième (60° sur 360°)', 'Un angle solide ne se compte pas comme un angle plan : Ω = 2π (1 − cos 30°) ≈ 0,84 sr sur les 12,57 sr de la sphère.'], ['La moitié', 'La moitié de la sphère, ce serait un cône de 180° (2π sr) : une ampoule nue contre un mur.']], answer: 0, why: `Ω = 2π (1 − cos 30°) ≈ ${fmtNum(angleSolide(60), 2)} sr, sur 4π ≈ 12,57 sr : environ ${fmtNum(angleSolide(60) / (4 * Math.PI) * 100, 1)} %. C'est pour cela qu'un projecteur à lentille donne une forte intensité dans son axe.` },
    ],
  },
  {
    id: 'lumiere-distance', title: 'La distance et l\'angle : l\'inverse du carré, le cosinus', minutes: '9 min',
    essentials: [
      '**E = I × cos i ÷ d²** : **deux fois plus loin, quatre fois moins** de lumière (**deux diaphs**) ; ×1,41 sur la distance, un diaph.',
      'De **biais**, la surface reçoit moins : × **cos i** (la moitié à 60°). **Hors de l\'axe**, l\'intensité tombe à **50 %** au bord de l\'**angle de faisceau**, à **10 %** au bord de l\'**angle de champ** (environ 1,8 fois plus large).',
      'La loi suppose une source ponctuelle : elle vaut **loin** de la source, au-delà d\'environ **cinq fois sa taille** (ordre de grandeur) ; tout près d\'un grand panneau, elle se vérifie moins.',
    ],
    figure: figDistance,
    demoTitle: 'Reculez le projecteur de 2 à 4 m et lisez l\'éclairement : divisé par quatre. Tournez la surface (incidence), écartez le sujet de l\'axe, puis approchez le panneau LED à moins de 1 m.',
    demo: demoDistance,
    body: `La lumière d'une source ponctuelle s'étale sur une sphère dont la surface grandit comme le carré du rayon. Le même flux, à une distance double, couvre une surface **quatre fois** plus grande : l'éclairement est divisé par quatre. C'est la **loi de l'inverse du carré** : **E = I ÷ d²**, ou, entre deux distances, **E₂ = E₁ × (d₁ ÷ d₂)²**.

En diaphs (un diaph = un facteur 2 de lumière), deux fois plus loin, c'est **deux diaphs** de moins. Pour perdre exactement un diaph, on multiplie la distance par √2 ≈ 1,41 : de 2 m à 2,8 m, de 4 m à 5,6 m (la suite des diaphragmes, et ce n'est pas un hasard). C'est l'outil le plus simple pour doser une lumière qui ne se gradue pas, comme une HMI, ou un halogène qu'on ne veut pas voir rougir.

**L'incidence.** Une surface éclairée de biais reçoit moins : la même lumière s'étale sur une surface plus grande. L'éclairement est multiplié par le **cosinus de l'angle d'incidence** i, l'angle entre la direction de la lumière et la perpendiculaire à la surface (la **normale**) : **E = I × cos i ÷ d²**. À 60°, cos i = 0,5 : la moitié. C'est pour cela qu'on tourne la cellule du luxmètre vers la caméra (on mesure ce qui éclaire le visage vu de la caméra), et qu'un décor éclairé en rasant prend du relief.

**Le profil du faisceau.** Un projecteur n'éclaire pas uniformément : l'intensité est la plus forte dans l'axe et baisse vers le bord. Les fiches donnent deux angles :
- l'**angle de faisceau** (beam angle) : là où l'intensité tombe à **50 %** de l'axe ;
- l'**angle de champ** (field angle) : là où elle tombe à **10 %**. Avec le profil du Labo, il vaut ${fmtNum(angleChampDe(1), 2)} fois l'angle de faisceau (ordre de grandeur : le rapport change d'une optique à l'autre).

Un sujet placé au bord du faisceau reçoit donc la moitié de ce que reçoit le centre : un diaph de moins. Pour éclairer une zone régulièrement, on recouvre les faisceaux à leur bord, de sorte que les moitiés s'additionnent.

**Les limites de la loi.** Elle suppose une source **ponctuelle**, vue de loin. Près d'une grande source (un panneau LED, une boîte à lumière), le sujet voit une surface étendue, et reculer de deux fois divise l'éclairement par moins de quatre. Pour un disque qui émet également, la loi surestime de a² ÷ (a² + d²) (a son rayon) : environ 20 % à une distance égale à sa taille, 1 % vers **cinq fois sa taille**. D'où la règle d'usage, un ordre de grandeur : au-delà de cinq fois la taille de la source, on peut appliquer l'inverse du carré.

- Le diamètre éclairé vaut 2 d tan(θ/2) : un faisceau de 20° fait ${fmtNum(diametre(10, 20), 1)} m de diamètre à 10 m.
- Une gélatine diffusante agrandit la source vue du sujet : la lumière devient plus douce, les ombres plus floues, et la loi s'applique plus loin.`,
    plus: `Pourquoi les grandes sources sont douces : une source large, vue du sujet, éclaire chaque point sous de nombreux angles ; les ombres ont un bord flou (la pénombre). Une source petite et lointaine, comme le soleil ou un Fresnel serré, fait des ombres nettes. La loi de l'inverse du carré a une conséquence pratique au stade : les projecteurs placés très haut sur les toits éclairent la pelouse de façon plus égale que des projecteurs bas, parce que l'écart de distance entre le centre et le bord du terrain compte moins en proportion.`,
    car: { text: 'Au Labo (Jouer → Le Labo), l\'atelier Photométrie : déplacez la principale, changez son faisceau, tournez le sujet, et regardez le luxmètre. L\'exercice pratique de la leçon y demande un niveau précis au sujet, obtenu par la distance et le faisceau.' },
    terms: ['inverse-carre', 'eclairement', 'angle-faisceau', 'intensite-lumineuse', 'diaphragme'],
    competences: ['C17', 'C23'], savoirs: ['G4', 'G2'],
    quiz: [
      { q: 'La lumière principale, à 2 m, donne 1 600 lx sur le visage. On la recule à 4 m. Que lit le luxmètre ?', choices: ['400 lx', ['800 lx', 'L\'éclairement ne suit pas la distance, mais son carré : deux fois plus loin, quatre fois moins.'], ['1 600 lx : la lampe n\'a pas changé', 'L\'intensité de la lampe est la même, mais elle s\'étale sur une surface quatre fois plus grande.']], answer: 0, why: 'E₂ = E₁ × (d₁ ÷ d₂)² = 1 600 × (2 ÷ 4)² = 400 lx : deux diaphs de moins.' },
      { q: 'Il faut exactement un diaph de plus sur le sujet. Le projecteur est à 4 m. À quelle distance le rapprocher ?', choices: ['Environ 2,8 m', ['2 m', 'À 2 m, l\'éclairement serait multiplié par quatre : deux diaphs.'], ['3 m', 'À 3 m, l\'éclairement est multiplié par (4 ÷ 3)² ≈ 1,8 : un peu moins d\'un diaph.']], answer: 0, why: 'Un diaph, c\'est un facteur 2 de lumière, donc un facteur √2 sur la distance : 4 ÷ 1,41 ≈ 2,8 m.' },
      { q: 'Un projecteur éclaire un mur de biais : sa lumière arrive à 60° de la perpendiculaire du mur. Par rapport à un éclairage de face, à la même distance, l\'éclairement du mur est…', choices: ['divisé par deux', ['le même', 'De biais, la même lumière s\'étale sur une surface plus grande : elle est multipliée par le cosinus de l\'incidence.'], ['divisé par quatre', 'Le carré, c\'est pour la distance. Pour l\'incidence, c\'est le cosinus : cos 60° = 0,5.']], answer: 0, why: 'E = I × cos i ÷ d² : à 60°, cos i = 0,5. Un éclairage rasant, à 80°, ne donnerait plus que 17 %.' },
      { q: 'Un Fresnel réglé à 30° de faisceau est pointé sur le centre d\'une table. Le présentateur est assis à 15° de l\'axe. Quelle part de l\'intensité de l\'axe reçoit-il ?', choices: ['La moitié', ['10 %', 'C\'est la valeur au bord de l\'angle de champ, environ 1,8 fois plus large que le faisceau.'], ['Autant que dans l\'axe', 'L\'intensité baisse vers le bord du faisceau : c\'est même ainsi qu\'on définit l\'angle de faisceau.']], answer: 0, why: 'L\'angle de faisceau est, par définition, celui où l\'intensité tombe à 50 % de l\'axe : 15° de part et d\'autre d\'un faisceau de 30°. Le présentateur perd un diaph : on repointe le projecteur sur lui.' },
      { q: 'Un panneau LED de 60 cm éclaire un visage à 50 cm. On le recule à 1 m. L\'éclairement baisse…', choices: ['un peu moins que quatre fois', ['exactement quatre fois', 'Si près d\'une source de 60 cm, ce n\'est plus « un point » : la loi de l\'inverse du carré surestime la baisse.'], ['à peine : une source douce ne suit aucune loi', 'Elle suit une loi, celle d\'une surface étendue ; elle rejoint l\'inverse du carré dès qu\'on s\'éloigne à quelques fois sa taille.']], answer: 0, why: `À 50 cm d'une source de 60 cm, la loi de l'inverse du carré surestime de ${fmtNum(ecartDisque(0.5, 0.6) * 100, 0)} %. L'éclairement baisse d'environ ${fmtNum(baisseDisque(0.5, 1, 0.6), 1)} fois, pas 4. La loi vaut au-delà d'environ cinq fois la taille de la source (ordre de grandeur).` },
      { q: 'Un projecteur réglé à 20° de faisceau est à 10 m du décor. Quel diamètre le faisceau éclaire-t-il ?', choices: [`Environ ${fmtNum(diametre(10, 20), 1)} m`, ['20 m', 'L\'angle n\'est pas une longueur : le diamètre vaut 2 d tan(θ/2) = 2 × 10 × tan 10°.'], ['0,35 m', 'Une virgule de trop : 2 × 10 × tan 10° ≈ 3,5 m.']], answer: 0, why: `D = 2 d tan(θ/2) = 2 × 10 × tan 10° ≈ ${fmtNum(diametre(10, 20), 2)} m. L'angle de champ, environ ${fmtNum(angleChampDe(20), 0)}°, déborde au-delà, à 10 % de l'axe.` },
    ],
  },
  {
    id: 'lumiere-couleur', title: 'La couleur de la lumière : kelvins, mireds, gélatines', minutes: '9 min',
    essentials: [
      'La caméra se règle sur la lumière par sa **balance des blancs** ; une lumière plus chaude ou plus froide que la balance donne une **dominante** orange ou bleue.',
      'Les corrections se comptent en **mireds** (**10⁶ ÷ K**) : une gélatine décale toujours du même nombre de mireds (**CTB pleine ≈ −137**, **CTO pleine ≈ +159**) ; un écart d\'une **vingtaine de mireds** passe presque inaperçu (ordre de grandeur).',
      'Le **gradateur rougit l\'halogène** (T ∝ V^0,42 : 2 400 K à mi-tension) ; deux sources de couleurs différentes se **mélangent** sur le sujet ; l\'axe **vert / magenta** se corrige à part.',
    ],
    figure: figCouleur,
    demoTitle: 'Halogène à 3 200 K, caméra à 5 600 K : lisez la dominante, posez une CTB pleine. Puis baissez le gradateur, ou faites entrer la lumière du jour, et voyez la couleur bouger.',
    demo: demoCouleur,
    body: `Une lumière « blanche » a une couleur : on la repère par sa **température de couleur**, en **kelvins** (K), la température à laquelle un corps chauffé émettrait une lumière de même teinte. Plus le nombre est bas, plus la lumière est chaude (orangée) : une bougie vers 1 900 K, l'halogène de studio à **3 200 K**, la lumière du jour moyenne à **5 600 K**, un ciel couvert à 6 500 K et plus.

**La balance des blancs.** L'œil s'adapte tout seul ; la caméra, non. Elle se règle sur la lumière : on lui montre une surface blanche (une charte, une feuille) et elle ajuste les gains de ses voies rouge et bleue pour que ce blanc sorte neutre. Une caméra de car a aussi des **filtres de conversion** optiques et des préréglages (3 200 K, 5 600 K). Si la lumière est plus chaude que la balance, l'image tire vers l'orange ; plus froide, vers le bleu : c'est la **dominante**.

**Les mireds.** Les kelvins trompent : 500 K d'écart entre 2 700 et 3 200 K se voient beaucoup, entre 6 000 et 6 500 K à peine. On compte donc en **mireds** (micro reciprocal degrees) : **mireds = 10⁶ ÷ K**. Sur cette échelle, les écarts se voient à égalité, et une gélatine décale toujours du **même nombre de mireds**, quelle que soit la source :
- **CTB** (color temperature blue) **pleine**, environ ${fmtNum(gelById('ctb').mired, 0).replace('-', '−')} mireds : un halogène à 3 200 K passe vers ${K(kelvin(mired(3200) + gelById('ctb').mired))}, la lumière du jour ; elle ne laisse passer que ${fmtNum(gelById('ctb').trans * 100, 0)} % de la lumière (${fmtNum(Math.log2(1 / gelById('ctb').trans), 1)} diaph) ;
- **CTO** (color temperature orange) **pleine**, environ +${fmtNum(gelById('cto').mired, 0)} mireds : une HMI à 5 600 K passe vers ${K(kelvin(mired(5600) + gelById('cto').mired))} ;
- les **demi** (½ CTB ${fmtNum(gelById('demi-ctb').mired, 0).replace('-', '−')}, ½ CTO +${fmtNum(gelById('demi-cto').mired, 0)}) et les quarts règlent un écart plus petit (ordres de grandeur des nuanciers).

Un écart d'une **vingtaine de mireds** entre la lumière et la balance passe presque inaperçu (ordre de grandeur) ; au-delà, la dominante se voit, surtout sur les peaux et les blancs.

**Le gradateur.** L'halogène sur gradateur **rougit** : sa température suit à peu près la tension à la puissance 0,42. À mi-tension, il descend vers ${K(gradateur(SOURCES.fresnel, 0.5).T)}, soit ${fmtNum(mired(gradateur(SOURCES.fresnel, 0.5).T) - mired(3200), 0)} mireds de plus : une dominante nette. Pour baisser un halogène sans changer sa couleur, on le recule, on le diffuse ou on pose un **filtre neutre** (ND, neutral density : ND 0,3 = un diaph). Une LED garde sa couleur en baissant ; une HMI se gradue peu.

**Le mélange.** Deux sources de couleurs différentes sur le même sujet se mélangent : la couleur résultante est entre les deux, plus proche de la plus forte (le Labo la calcule en moyenne des mireds pondérée par l'éclairement, un ordre de grandeur). Le cas classique : un visage éclairé à l'halogène près d'une fenêtre. On accorde les sources entre elles (CTB sur les projecteurs, ou CTO sur la fenêtre), puis la caméra sur l'ensemble.

**L'autre axe.** La température de couleur ne dit que l'axe orange / bleu. Certaines sources (tubes fluorescents, LED bas de gamme, HMI vieillissantes) tirent aussi vers le **vert** ou le **magenta**. Cet axe se corrige à part : gélatines **« moins vert »** (magenta) ou **« plus vert »**, en fractions (huitième, quart, demi, plein), ou réglage de teinte de la caméra.`,
    plus: `Pourquoi les mireds s'additionnent : une gélatine absorbe une part de chaque couleur du spectre qui ne dépend pas de la source. Son effet sur l'inverse de la température est à peu près constant, d'où une valeur unique en mireds sur le nuancier. Les fabricants donnent aussi des gélatines de correction partielle, pour accorder une source à une autre sans aller jusqu'à la lumière du jour. Une caméra de car mémorise sa balance par fichier de scène ; au stade, la balance se fait sur une charte à la lumière du match, et la balance d'une caméra ne se touche plus pendant l'antenne.`,
    car: { text: 'Au poste vision du car, chaque RCP (le pupitre de réglage d\'une caméra) a sa balance des blancs (AWB) et ses gains rouge et bleu ; les caméras doivent s\'accorder entre elles. Au Labo (Jouer → Le Labo), l\'atelier Photométrie fait accorder une source à la balance de la caméra, à la gélatine et au gradateur.', station: 'vision' },
    terms: ['temperature-couleur', 'mired', 'gelatine', 'balance-blancs'],
    competences: ['C32', 'C17', 'C23'], savoirs: ['G4', 'D1', 'G9'],
    quiz: [
      { q: 'La caméra est balancée à 5 600 K. On filme un plateau éclairé en halogène à 3 200 K, sans correction. Comment sort l\'image ?', choices: ['Orangée', ['Bleutée', 'La lumière est plus chaude que la balance : l\'image tire vers l\'orange. Elle tirerait vers le bleu dans le cas inverse.'], ['Juste : la caméra s\'adapte seule', 'Une caméra balancée à une valeur fixe ne s\'adapte pas : il faut refaire la balance ou corriger la lumière.']], answer: 0, why: `Lumière à ${fmtNum(mired(3200), 0)} mireds, balance à ${fmtNum(mired(5600), 0)} : ${fmtNum(dominante(3200, 5600), 0)} mireds plus chaud. On refait la balance à 3 200 K, ou l'on bleuit les projecteurs.` },
      { q: 'Un plateau d\'interview est éclairé en halogène près d\'une grande fenêtre (lumière du jour). Que poser sur les projecteurs pour les accorder à la fenêtre ?', choices: ['Une CTB pleine', ['Une CTO pleine', 'La CTO réchauffe : elle éloignerait encore l\'halogène de la lumière du jour.'], ['Un ND 0,3', 'Un filtre neutre baisse la lumière d\'un diaph sans changer sa couleur.']], answer: 0, why: `La CTB pleine (environ ${fmtNum(gelById('ctb').mired, 0).replace('-', '−')} mireds) fait passer l'halogène de 3 200 K vers ${K(kelvin(mired(3200) + gelById('ctb').mired))}. Elle coûte environ un diaph et demi de lumière : on peut aussi poser de la CTO sur la fenêtre.` },
      { q: `Une demi-CTO fait passer une HMI de 5 600 K à environ ${K(T_HMI_DEMI_CTO)}. Posée sur un halogène à 3 200 K, elle donne environ…`, choices: [`${K(kelvin(mired(3200) + gelById('demi-cto').mired))}`, [`${K(3200 - (5600 - T_HMI_DEMI_CTO))} : autant de kelvins en moins que sur la HMI`, 'Une gélatine ne décale pas d\'un nombre fixe de kelvins, mais d\'un nombre fixe de mireds.'], ['3 200 K : elle ne change rien à un halogène', 'Une gélatine agit sur toute lumière qui la traverse.']], answer: 0, why: `La demi-CTO ajoute environ ${fmtNum(gelById('demi-cto').mired, 0)} mireds : 312,5 + ${fmtNum(gelById('demi-cto').mired, 0)} ≈ ${fmtNum(mired(3200) + gelById('demi-cto').mired, 0)} mireds, soit ${K(kelvin(mired(3200) + gelById('demi-cto').mired))}. Sur la HMI, les mêmes mireds font environ ${K(5600 - T_HMI_DEMI_CTO)} de moins ; sur l'halogène, environ ${K(3200 - kelvin(mired(3200) + gelById('demi-cto').mired))}.` },
      { q: 'On veut baisser d\'un diaph un halogène sur un visage sans changer sa couleur. Que faire ?', choices: ['Poser un ND 0,3, ou reculer le projecteur d\'un facteur 1,4', ['Baisser le gradateur à 50 %', 'Le gradateur rougit l\'halogène ; et à 50 % de tension, il ne reste qu\'environ 10 % du flux, plus de trois diaphs.'], ['Poser une demi-CTB', 'Une demi-CTB baisse un peu la lumière, mais elle la bleuit.']], answer: 0, why: 'Un ND 0,3 transmet 50 % de la lumière sans la teinter ; reculer de √2 divise l\'éclairement par deux. Le gradateur, lui, rougit l\'halogène.' },
      { q: 'La lumière est à 3 400 K, la caméra balancée à 3 200 K. Faut-il corriger ?', choices: ['Non : l\'écart, environ 18 mireds, passe presque inaperçu', ['Oui : 200 K, c\'est beaucoup', 'Les kelvins trompent : vers 3 200 K, 200 K ne font qu\'environ 18 mireds, sous la vingtaine qu\'on tolère.'], ['Oui, avec une CTB pleine', 'Une CTB pleine décale de 137 mireds environ : elle créerait une forte dominante bleue.']], answer: 0, why: `${fmtNum(mired(3200), 1)} − ${fmtNum(mired(3400), 1)} ≈ ${fmtNum(mired(3200) - mired(3400), 0)} mireds : moins d'une vingtaine, presque invisible. À 5 600 K, le même écart en mireds ferait plus de 600 K.` },
      { q: 'Sous des tubes fluorescents, les visages tirent vers le vert, alors que la température de couleur est juste. Que corriger ?', choices: ['L\'axe vert / magenta : une gélatine « moins vert » sur les tubes, ou la teinte de la caméra', ['Une CTO sur les tubes', 'La CTO agit sur l\'axe orange / bleu ; le vert est un autre axe, que la température de couleur ne décrit pas.'], ['Le gain de la caméra', 'Le gain monte tout le signal, sans changer sa couleur.']], answer: 0, why: 'La température de couleur ne repère que l\'axe orange / bleu. Le vert se corrige avec des gélatines magenta (« moins vert ») ou par le réglage de teinte de la caméra.' },
    ],
  },
  {
    id: 'lumiere-mesure', title: 'Mesurer la lumière et exposer la caméra', minutes: '10 min',
    essentials: [
      'La **cellule incidente** (luxmètre, au sujet) mesure la lumière qui **arrive** : **N² ÷ t = E × S ÷ C** (**C = 250** pour une cellule plate, vers **330** pour un dôme) ; elle ne dépend pas du sujet.',
      'Le **spotmètre** (depuis la caméra) mesure la **luminance** : **N² ÷ t = L × S ÷ K** (**K = 12,5**) ; il suppose un **gris moyen** et se trompe sur un sujet **très clair** (sous-exposé) ou **très sombre** (surexposé).',
      '**Un diaph = un facteur 2** de lumière ; le **gain** rattrape ce qui manque (**6 dB ≈ un diaph**) ; à la caméra du car, on vérifie l\'exposition sur la **forme d\'onde**.',
    ],
    figure: figMesure,
    demoTitle: 'Exposez d\'abord à la cellule incidente, puis passez au spotmètre et visez la chemise blanche : regardez où tombe le gris. Baissez l\'éclairement à 20 lx et lisez le gain qu\'il faut à la caméra du car.',
    demo: demoMesure,
    body: `Exposer, c'est faire entrer dans la caméra la bonne quantité de lumière : celle qui place les gris au milieu de la courbe, sans écrêter les blancs ni noyer les noirs. Trois réglages la dosent : le **diaphragme** (l'iris, nombre f), le **temps de pose** et la **sensibilité** (ISO, ou le gain). Pour les choisir, on mesure la lumière, de deux façons.

**La mesure incidente** se fait **au sujet**, cellule tournée vers la caméra : un **luxmètre** ou une **cellule** (posemètre). Elle mesure l'**éclairement**, la lumière qui arrive, et ne dépend donc pas du sujet : une chemise blanche et une veste noire reçoivent la même lumière. La relation d'exposition est **N² ÷ t = E × S ÷ C**, où N est le nombre f, t le temps de pose (s), E l'éclairement (lx), S la sensibilité (ISO) et **C** la constante d'étalonnage de la cellule : **250** pour une **cellule plate**, vers **330** pour un **dôme** (ordre de grandeur, selon le fabricant ; la norme ISO 2720 donne une plage). Le dôme, une demi-sphère blanche, reçoit la lumière de tout un demi-espace, comme un visage en relief ; la cellule plate mesure un plan. Exemple : ${fmtNum(1000, 0)} lx, ISO 800, 1/50 s donnent **${fN(ouverture(1000, 800, 1 / 50))}**.

**La mesure réfléchie** se fait **depuis la caméra** : le **spotmètre** vise le sujet dans un angle étroit (de l'ordre de 1°) et mesure sa **luminance**, la lumière qu'il renvoie. La relation devient **N² ÷ t = L × S ÷ K**, avec **K = 12,5** chez la plupart des fabricants. Le spotmètre ne sait pas ce qu'il regarde : il donne le réglage qui rendrait la surface visée **grise**, d'un gris moyen (ρ = π K ÷ C, environ ${fmtNum(grisVise() * 100, 0)} % avec ces constantes ; on parle couramment de gris 18 %).
- Visé sur une **chemise blanche** (90 %), il fait fermer : l'image est **sous-exposée** d'environ ${fmtNum(-erreurSpot(0.9), 1)} diaphs.
- Visé sur une **veste noire** (4 %), il fait ouvrir : l'image est **surexposée** d'environ ${fmtNum(erreurSpot(0.04), 1)} diaphs.
- Visé sur une **carte grise**, il s'accorde avec la cellule incidente (à ${fmtNum(Math.abs(erreurSpot(0.18)), 1)} diaph près).
On s'en sert pour lire un contraste (le ciel, une fenêtre, un visage) plutôt que pour exposer directement.

**Les diaphs.** La lumière qui traverse l'objectif suit **1 ÷ N²** : la suite f/1,4, 2, 2,8, 4, 5,6, 8, 11, 16 avance d'un facteur √2, et chaque cran divise la lumière par deux. **Un diaph = un facteur 2** : on compte en diaphs l'iris, le temps de pose, les filtres neutres (ND 0,3 = un diaph), l'écart entre deux éclairements.

**Le gain.** Une caméra de car a un temps de pose d'ordinaire fixé (1/50 s en 50 Hz) : on expose par l'iris et les filtres neutres. Quand l'iris est grand ouvert et qu'il manque encore de la lumière, on monte le **gain** : **6 dB ≈ un diaph** (20 log₁₀ 2 ≈ 6,02 dB), 12 dB deux diaphs. Le gain n'ajoute aucune lumière : il amplifie aussi le bruit. Sa sensibilité, une caméra de car l'annonce comme le diaphragme qui met une charte blanche (89,9 %) à 100 % sous 2 000 lx : **f/13** pour la Sony HXC-FB80 en 50 Hz (fiche technique). D'où N ≈ 13 × √(E ÷ 2 000) : ${fN(ouvertureCamera(1000))} sous 1 000 lx ; sous 100 lx, ${fN(ouvertureCamera(100))}.

**La forme d'onde.** Au poste vision, l'exposition se vérifie sur le moniteur de forme d'onde (waveform), qui trace le niveau de chaque point de l'image : en BT.709, une carte grise 18 % bien exposée tombe vers **${fmtNum(signal('bt709', 0.18).V * 100, 0)} %**, une carte blanche 90 % vers ${fmtNum(signal('bt709', 0.9).V * 100, 0)} %, et les blancs restent **sous 100 %**. C'est la mesure qui tranche, parce qu'elle voit ce que voit la caméra.`,
    plus: `Les constantes C et K ne sont pas des lois de la physique, mais des conventions d'étalonnage choisies par les fabricants dans les plages de la norme ISO 2720 ; une cellule et un spotmètre de marques différentes peuvent donc différer d'un tiers de diaph. Pour la vidéo, on étalonne une fois pour toutes la cellule sur la caméra : on filme une carte grise, on règle l'iris pour qu'elle tombe à sa place sur la forme d'onde, et l'on note ce que dit la cellule. Le zébra du viseur marque les zones au-dessus d'un seuil (souvent 70 % pour les peaux, 95 à 100 % pour les blancs) : c'est la forme d'onde du cadreur.`,
    car: { text: 'Au poste vision du car, chaque RCP règle l\'iris, le gain et les filtres neutres de sa caméra ; le moniteur de mesure (waveform, vecteurscope) montre où tombent les gris et les blancs. Au Labo (Jouer → Le Labo), l\'atelier Photométrie fait exposer la caméra d\'après le luxmètre, et l\'atelier Sensitométrie place la carte grise sur la courbe.', station: 'vision' },
    terms: ['posemetre', 'spotmetre', 'diaphragme', 'gris-18', 'waveform', 'plage-dynamique'],
    competences: ['C23', 'C32', 'C10'], savoirs: ['G4', 'G9', 'C11'],
    quiz: [
      { q: 'Au spotmètre, vous visez la chemise blanche du présentateur et réglez l\'iris d\'après la lecture. Comment sera l\'image ?', choices: ['Sous-exposée, d\'environ deux diaphs et demi', ['Juste : le spotmètre mesure exactement la chemise', 'Il la mesure, mais il la rend grise : il suppose que tout sujet est un gris moyen.'], ['Surexposée', 'C\'est ce qui arriverait sur une veste noire : le spotmètre ferait ouvrir pour la rendre grise.']], answer: 0, why: `Le spotmètre donne le réglage qui rend la surface visée grise : une chemise à 90 % sort grise, l'image est sous-exposée d'environ ${fmtNum(-erreurSpot(0.9), 1)} diaphs. Mesurez une carte grise, ou la lumière incidente.` },
      { q: 'Le luxmètre lit 1 000 lx au sujet. Sensibilité ISO 800, pose 1/50 s, cellule plate (C = 250). Quel diaphragme ?', choices: [fN(ouverture(1000, 800, 1 / 50)), [fN(ouverture(1000, 800, 1 / 50) / 2), 'C\'est deux diaphs trop ouvert : N² = E × t × S ÷ C = 1 000 × 0,02 × 800 ÷ 250 = 64, N = 8.'], [fN(ouverture(1000, 800, 1 / 50) * 2), 'C\'est deux diaphs trop fermé : N² = 64, donc N = 8, pas 16.']], answer: 0, why: `N² = E × t × S ÷ C = 1 000 × 0,02 × 800 ÷ 250 = 64 : ${fN(ouverture(1000, 800, 1 / 50))}.` },
      { q: 'L\'iris de la caméra est grand ouvert, et il manque encore deux diaphs. Quel gain faut-il ?', choices: ['+12 dB', ['+6 dB', '+6 dB ne rattrape qu\'un diaph.'], ['+2 dB', 'Le gain se compte en décibels, pas en diaphs : environ 6 dB par diaph.']], answer: 0, why: `Un diaph ≈ 6 dB (20 log₁₀ 2 ≈ 6,02) : deux diaphs ≈ ${fmtNum(dbPourDiaphs(2), 0)} dB. Le bruit monte d'autant : on cherche d'abord de la lumière.` },
      { q: 'Pourquoi la cellule incidente expose-t-elle juste à la fois une veste noire et une chemise blanche ?', choices: ['Elle mesure la lumière qui arrive, pas ce que renvoie le sujet', ['Elle reconnaît la couleur du sujet et corrige', 'Une cellule ne voit pas le sujet : elle est posée devant lui, tournée vers la caméra.'], ['Elle fait la moyenne des deux', 'Elle ne voit aucun des deux : elle mesure l\'éclairement, le même pour la veste et la chemise.']], answer: 0, why: 'La cellule incidente mesure l\'éclairement : la caméra réglée d\'après elle rend le blanc blanc et le noir noir, chacun à sa place.' },
      { q: 'Le cadreur passe de f/4 à f/5,6. Qu\'arrive-t-il à la lumière qui entre ?', choices: ['Elle est divisée par deux : un diaph', ['Elle est divisée par 1,4', 'Le nombre f est multiplié par 1,4, mais la lumière suit 1 ÷ N² : (5,6 ÷ 4)² ≈ 2.'], ['Elle double', 'Un nombre f plus grand, c\'est une pupille plus petite : moins de lumière.']], answer: 0, why: 'La lumière suit 1 ÷ N² : (5,6 ÷ 4)² ≈ 2. Chaque cran de la suite des diaphragmes divise la lumière par deux.' },
      { q: 'Au poste vision, comment vérifier qu\'une caméra est bien exposée ?', choices: ['Sur la forme d\'onde : la carte grise vers 41 %, les blancs sous 100 %', ['Sur le moniteur, à l\'œil', 'L\'œil s\'adapte et le moniteur peut être mal réglé : la forme d\'onde mesure ce que sort la caméra.'], ['Sur le vecteurscope', 'Le vecteurscope montre la couleur (teinte, saturation), pas le niveau.']], answer: 0, why: 'La forme d\'onde trace le niveau de chaque point : en BT.709, une carte grise 18 % bien exposée tombe vers 41 %, et les blancs restent sous 100 %.' },
      { q: 'Une caméra de car annonce f/13 à 2 000 lx. Le stade est éclairé à 1 000 lx vers les caméras. Quel diaphragme environ ?', choices: [fN(ouvertureCamera(1000)), ['f/6,5', 'Moitié moins de lumière, c\'est un diaph, soit un facteur √2 sur le nombre f, pas 2.'], ['f/26', 'Moins de lumière demande d\'ouvrir (un nombre f plus petit), pas de fermer.']], answer: 0, why: `Moitié moins de lumière, un diaph de plus à ouvrir : 13 ÷ √2 ≈ ${fmtNum(ouvertureCamera(1000), 1)}. C'est N = 13 × √(E ÷ 2 000).` },
    ],
  },
];
