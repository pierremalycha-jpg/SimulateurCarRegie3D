// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import { SOURCES, eclairage, contraste, melange, dominante, ouverture } from '../labo/calc/photometrie.js';
import { angleChampDe, posesSures, STADE_TV } from '../labo/calc/lumiere.js';
import {
  PROJECTEURS, projecteurById, eclairageProjecteur, eclairementHorsAxe, tailleApparente, penombre, durete, incidenceVisage,
  debouchagePour, SOURCES_STADE, sourceStadeById, scintillementVu, imageMoyenne, frequenceLumiere, PELOUSE, CAMERA_PRINCIPALE,
  IMPLANTATIONS, implantationById, eclairementStade,
} from './lumiere_eclairer_calc.js';

// ----------------------------------------------------------------------------------
// Chapitre « La lumière » (v19.29), partie « Éclairer pour la caméra » : les projecteurs (Fresnel, découpe,
// PAR, panneau et boîte à lumière, lyre ; angle de faisceau et angle de champ, diamètre éclairé, dureté de
// l'ombre), le plateau de télévision (principale, débouchage, contre-jour, décor ; rapport de contraste ; une
// seule température de couleur) et le stade (éclairement vertical vers les caméras, uniformité U1 et U2,
// scintillement à 100 Hz et super ralentis). Les chiffres viennent des calculs du Labo
// (labo/calc/photometrie.js, labo/calc/lumiere.js) et de cours/lumiere_eclairer_calc.js.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238', white: '#e8eef2', ink: '#0b1013', dim: '#6f7a84', soft: '#aab4ba' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};
const rad = (a) => a * Math.PI / 180;
/** un faisceau vers le bas, de demi-angle a (degrés), de l'apex (x, y) sur une longueur len */
const cone = (x, y, a, len, col, op) => sv('path', { d: `M${x} ${y} L${x - len * Math.tan(rad(a))} ${y + len} L${x + len * Math.tan(rad(a))} ${y + len} Z`, fill: col, 'fill-opacity': op, stroke: 'none' });
/** un nombre de mètres lisible */
const m = (v) => (v >= 10 ? `${fmtNum(v, 0)} m` : v >= 1 ? `${fmtNum(v, 1)} m` : `${fmtNum(v * 100, 0)} cm`);
const lx = (v) => `${fmtNum(v, v < 10 ? 1 : 0)} lx`;
const cd = (v) => (v >= 1e6 ? `${fmtNum(v / 1e6, 2)} million de cd` : `${fmtNum(v, 0)} cd`);
const kel = (T) => (T > 0 ? `${fmtNum(Math.round(T / 10) * 10, 0)} K` : 'éteint');
/** une fraction de seconde lisible : 1/100 s */
const pose = (t) => `1/${fmtNum(Math.round(1 / t), 0)} s`;

// ======================================================================================
// 1. Les projecteurs
// ======================================================================================
function figProjecteurs() {
  const f = figure(720, 318, 'Cinq familles de projecteurs vues de côté, la lumière vers le bas. Le Fresnel : une lampe, un réflecteur et une lentille à échelons ; on avance ou recule la lampe pour passer du faisceau serré au large ; le bord est doux et des volets coupent le flux. La découpe (projecteur à profil) : un réflecteur ellipsoïdal concentre la lumière sur une fenêtre où se placent les couteaux, l\'iris ou un gobo, que l\'objectif projette avec un bord net ; angle fixe ou zoom. Le PAR : une lampe à réflecteur parabolique, un angle fixe donné par la lampe. Le panneau LED et la boîte à lumière : une grande surface qui émet, une lumière douce. La lyre : un projecteur motorisé (pan, tilt, zoom) commandé par le DMX, en spot ou en wash. En bas, la définition des angles : l\'angle de faisceau est celui où l\'intensité tombe à 50 % de celle de l\'axe, l\'angle de champ celui où elle tombe à 10 %, environ 1,82 fois plus large ; le diamètre éclairé à la distance d vaut 2 d tan(θ/2).');
  f.append(txt(10, 16, 'Cinq familles de projecteurs, vus de côté', 'co-t', 'start'));
  const top = 44, len = 104;
  // Fresnel
  let x = 72;
  f.append(cone(x, top + 14, 30, len, C.amber, 0.12), cone(x, top + 14, 17, len, C.amber, 0.22));
  f.append(box(x - 22, top - 18, 44, 32, C.grey), sv('circle', { cx: x, cy: top - 4, r: 6, fill: C.amber }), sv('path', { d: `M${x - 16} ${top - 14} Q ${x} ${top - 24} ${x + 16} ${top - 14}`, fill: 'none', stroke: C.soft }));
  f.append(sv('path', { d: `M${x - 20} ${top + 14} l5 -4 l0 4 l5 -4 l0 4 l5 -4 l0 4 l5 -4 l0 4 l5 -4 l0 4 l5 -4 l0 4 l5 -4 l0 4 l5 -4 l0 4`, fill: 'none', stroke: C.cyan, strokeWidth: 1.2 }));
  f.append(sv('line', { x1: x - 22, y1: top + 14, x2: x - 34, y2: top + 26, stroke: C.grey, strokeWidth: 2 }), sv('line', { x1: x + 22, y1: top + 14, x2: x + 34, y2: top + 26, stroke: C.grey, strokeWidth: 2 }));
  f.append(txt(x, 186, 'Fresnel', 'co-t'), txt(x, 200, 'lentille à échelons', 'co-s'), txt(x, 213, 'serré à large, bord doux', 'co-s'), txt(x, 226, 'volets coupe-flux', 'co-s'));
  // Découpe
  x = 216;
  f.append(cone(x, top + 18, 13, len - 4, C.amber, 0.3));
  f.append(sv('line', { x1: x - len * Math.tan(rad(13)) + 1, y1: top + 18 + len - 4, x2: x, y2: top + 18, stroke: C.white, strokeWidth: 0.8 }), sv('line', { x1: x + len * Math.tan(rad(13)) - 1, y1: top + 18 + len - 4, x2: x, y2: top + 18, stroke: C.white, strokeWidth: 0.8 }));
  f.append(box(x - 14, top - 26, 28, 44, C.grey), sv('path', { d: `M${x - 12} ${top - 22} Q ${x} ${top - 34} ${x + 12} ${top - 22}`, fill: 'none', stroke: C.soft }), sv('circle', { cx: x, cy: top - 16, r: 4, fill: C.amber }));
  f.append(sv('line', { x1: x - 14, y1: top - 2, x2: x - 4, y2: top - 2, stroke: C.white, strokeWidth: 2 }), sv('line', { x1: x + 14, y1: top - 2, x2: x + 5, y2: top - 2, stroke: C.white, strokeWidth: 2 }), sv('ellipse', { cx: x, cy: top + 12, rx: 11, ry: 3, fill: 'none', stroke: C.cyan }));
  f.append(txt(x, 186, 'Découpe (profil)', 'co-t'), txt(x, 200, 'couteaux, iris, gobo', 'co-s'), txt(x, 213, 'bord net, fixe ou zoom', 'co-s'), txt(x, 226, 'projette une forme', 'co-s'));
  // PAR
  x = 360;
  f.append(cone(x, top + 10, 10, len + 4, C.amber, 0.26));
  f.append(sv('path', { d: `M${x - 20} ${top - 18} Q ${x} ${top + 2} ${x + 20} ${top - 18} L${x + 20} ${top + 10} L${x - 20} ${top + 10} Z`, fill: C.box, stroke: C.grey }), sv('path', { d: `M${x - 16} ${top - 12} Q ${x} ${top + 6} ${x + 16} ${top - 12}`, fill: 'none', stroke: C.soft }), sv('circle', { cx: x, cy: top - 4, r: 4, fill: C.amber }));
  f.append(txt(x, 186, 'PAR', 'co-t'), txt(x, 200, 'réflecteur parabolique', 'co-s'), txt(x, 213, 'angle fixe (la lampe)', 'co-s'), txt(x, 226, 'faisceau ovale, puissant', 'co-s'));
  // Panneau et boîte à lumière
  x = 504;
  f.append(cone(x, top + 6, 48, len - 10, C.white, 0.08));
  f.append(sv('rect', { x: x - 34, y: top - 8, width: 68, height: 14, rx: 2, fill: C.white, 'fill-opacity': 0.85, stroke: C.grey }));
  for (let k = -28; k <= 28; k += 8) f.append(sv('circle', { cx: x + k, cy: top - 1, r: 2, fill: C.amber }));
  f.append(txt(x, 186, 'Panneau, boîte à lumière', 'co-t'), txt(x, 200, 'grande surface qui émet', 'co-s'), txt(x, 213, 'lumière douce', 'co-s'), txt(x, 226, 'débouchage, visages', 'co-s'));
  // Lyre
  x = 648;
  f.append(cone(x + 8, top + 18, 8, len - 6, C.cyan, 0.24));
  f.append(sv('rect', { x: x - 24, y: top - 30, width: 48, height: 10, rx: 2, fill: C.box, stroke: C.grey }), sv('path', { d: `M${x - 18} ${top - 20} L${x - 18} ${top + 6} M${x + 18} ${top - 20} L${x + 18} ${top + 6}`, stroke: C.grey, strokeWidth: 3 }));
  const head = sv('rect', { x: x - 10, y: top - 12, width: 20, height: 30, rx: 6, fill: C.box, stroke: C.cyan }); head.setAttribute('transform', `rotate(-8 ${x} ${top})`); f.append(head);
  f.append(sv('path', { d: `M${x - 30} ${top - 36} A 30 8 0 0 0 ${x + 30} ${top - 36}`, fill: 'none', stroke: C.dim, strokeDasharray: '3 2' }), txt(x + 34, top - 30, 'pan', 'co-s', 'start'), txt(x + 24, top + 8, 'tilt', 'co-s', 'start'));
  f.append(txt(x, 186, 'Lyre', 'co-t'), txt(x, 200, 'motorisée, en DMX', 'co-s'), txt(x, 213, 'spot (net) ou wash (doux)', 'co-s'), txt(x, 226, 'pan, tilt, zoom, couleur', 'co-s'));
  // les angles
  f.append(sv('line', { x1: 10, y1: 240, x2: 710, y2: 240, stroke: C.line }));
  const ox = 30, oy = 282, L = 70;
  f.append(sv('path', { d: `M${ox} ${oy} L${ox + L} ${oy - L * Math.tan(rad(27.3))} L${ox + L} ${oy + L * Math.tan(rad(27.3))} Z`, fill: C.amber, 'fill-opacity': 0.1 }));
  f.append(sv('path', { d: `M${ox} ${oy} L${ox + L} ${oy - L * Math.tan(rad(15))} L${ox + L} ${oy + L * Math.tan(rad(15))} Z`, fill: C.amber, 'fill-opacity': 0.25 }));
  f.append(sv('line', { x1: ox, y1: oy, x2: ox + L + 10, y2: oy, stroke: C.white, strokeDasharray: '3 2' }), txt(ox + L + 14, oy + 4, 'axe : 100 %', 'co-s', 'start'));
  f.append(txt(200, 256, 'angle de faisceau θ : l\'intensité y tombe à 50 % de l\'axe', 'co-s', 'start', { fill: C.amber }));
  f.append(txt(200, 270, `angle de champ : 10 % de l'axe, environ ${fmtNum(angleChampDe(1), 2)} × θ`, 'co-s', 'start'));
  f.append(txt(200, 284, 'diamètre éclairé à la distance d : 2 d tan(θ/2)', 'co-s', 'start'));
  f.append(txt(200, 298, 'serrer le faisceau concentre l\'intensité dans l\'axe', 'co-s', 'start'));
  f.append(txt(200, 312, 'ombre : petite source lointaine, nette ; grande source proche, douce', 'co-s', 'start'));
  return f;
}
function demoProjecteurs(host) {
  let id = 'fresnel', pos = 40, d = 4, niveau = 100;
  const cv = canvas(720, 240, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Angle de faisceau (50 %)', 'Angle de champ (10 %)', 'Diamètre du faisceau', 'Diamètre du champ', 'Intensité dans l\'axe', 'Éclairement dans l\'axe', 'Couleur de la lumière', 'L\'ombre portée']);
  const verdict = el('p', { class: 'co-verdict' });
  const info = el('p', { class: 'co-figcap' });
  const angleDe = (P) => P.s.angles[0] + (P.s.angles[1] - P.s.angles[0]) * pos / 100;
  const draw = () => {
    const P = projecteurById(id), r = eclairageProjecteur({ id, angle: angleDe(P), d, niveau: niveau / 100 });
    const fixe = P.s.angles[0] === P.s.angles[1];
    const ta = tailleApparente(P.taille, d), dur = durete(ta);
    read.set('Angle de faisceau (50 %)', `${fmtNum(r.theta, 1)}°${fixe ? ' (fixe)' : ` (réglable de ${P.s.angles[0]} à ${P.s.angles[1]}°)`}`);
    read.set('Angle de champ (10 %)', `${fmtNum(r.champ, 1)}° : ${fmtNum(angleChampDe(1), 2)} × le faisceau`);
    read.set('Diamètre du faisceau', `${m(r.diametre)} à ${fmtNum(d, 1)} m : 2 × ${fmtNum(d, 1)} × tan(${fmtNum(r.theta / 2, 1)}°)`);
    read.set('Diamètre du champ', `${m(r.diametreChamp)} : la lumière déborde jusque-là`);
    read.set('Intensité dans l\'axe', `${cd(r.I0)}${niveau < 100 ? ` au gradateur à ${niveau} %` : ''}`);
    read.set('Éclairement dans l\'axe', `${lx(r.E)} = intensité ÷ ${fmtNum(d, 1)}²`);
    read.set('Couleur de la lumière', `${kel(r.T)}${P.s.type === 'halogene' && niveau < 100 && niveau > 0 ? ' : l\'halogène rougit au gradateur' : ''}`);
    read.set('L\'ombre portée', `source de ${m(P.taille)} vue sous ${fmtNum(ta, 1)}° : ombre ${dur === 'dure' ? 'dure' : dur === 'douce' ? 'douce' : 'mi-dure'}, pénombre de ${m(penombre(P.taille, d, 1))} sur un fond à 1 m derrière`);
    info.textContent = `${P.nom} : ${P.reglage}.`;
    const besoin = 1000;
    verdict.className = 'co-verdict ' + (r.E <= 0 ? 'ko' : r.E < besoin * 0.5 ? 'ko' : r.E < besoin * 0.8 ? 'warn' : r.E > besoin * 3 ? 'warn' : 'ok');
    verdict.textContent = r.E <= 0 ? 'Projecteur éteint : rien n\'arrive.'
      : r.E < besoin * 0.5 ? `${lx(r.E)} dans l'axe : trop peu pour un visage au plateau (de l'ordre de 1 000 lx). Rapprochez, serrez le faisceau ou prenez un projecteur plus puissant.`
        : r.E < besoin * 0.8 ? `${lx(r.E)} : un peu juste pour un visage au plateau (de l'ordre de 1 000 lx).`
          : r.E > besoin * 3 ? `${lx(r.E)} : bien plus qu'il ne faut pour un visage ; reculez, ouvrez le faisceau ou baissez le niveau${P.s.type === 'halogene' ? ' (un halogène gradué rougit : on préfère reculer ou diffuser)' : ''}.`
            : `${lx(r.E)} dans l'axe, sur ${m(r.diametre)} de faisceau : de quoi éclairer un visage au plateau.`;
    // la vue de côté, à l'échelle : le champ (10 %) et le faisceau (50 %)
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 240);
    const cy = 120, x0 = 34, half = d * Math.tan(rad(r.champ / 2)), s = Math.min(420 / d, 104 / Math.max(half, 1e-6)), xp = x0 + d * s;
    const tri = (a, col) => { const h = d * Math.tan(rad(a / 2)) * s; g.fillStyle = col; g.beginPath(); g.moveTo(x0, cy); g.lineTo(xp, cy - h); g.lineTo(xp, cy + h); g.closePath(); g.fill(); return h; };
    const on = niveau > 0;
    const hc = tri(r.champ, on ? 'rgba(255,211,138,.12)' : 'rgba(255,255,255,.03)');
    const hb = tri(r.theta, on ? 'rgba(255,211,138,.32)' : 'rgba(255,255,255,.05)');
    if (P.bord === 'net') { g.strokeStyle = C.white; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, cy); g.lineTo(xp, cy - hb); g.moveTo(x0, cy); g.lineTo(xp, cy + hb); g.stroke(); }
    g.fillStyle = C.box; g.strokeStyle = C.grey; g.fillRect(x0 - 26, cy - 12, 26, 24); g.strokeRect(x0 - 26, cy - 12, 26, 24);
    g.strokeStyle = C.white; g.lineWidth = 2; g.beginPath(); g.moveTo(xp, cy - Math.min(112, hc + 6)); g.lineTo(xp, cy + Math.min(112, hc + 6)); g.stroke(); g.lineWidth = 1;
    g.fillStyle = C.soft; g.font = '11px Arial, sans-serif';
    g.fillText(`${fmtNum(d, 1)} m`, (x0 + xp) / 2 - 12, cy + 4 + Math.min(100, hb) + 14);
    g.fillText(`faisceau ${m(r.diametre)}`, Math.min(xp + 6, 400), cy - 4);
    g.fillText(`champ ${m(r.diametreChamp)}`, Math.min(xp + 6, 400), cy + 12);
    g.fillText('vue de côté, à l\'échelle', 10, 14);
    // le profil de l'éclairement sur le plan éclairé
    const X0 = 490, X1 = 710, Y0 = 200, Y1 = 40, R = Math.max(r.diametreChamp / 2 * 1.3, 0.05);
    g.strokeStyle = '#3a444c'; g.beginPath(); g.moveTo(X0, Y0); g.lineTo(X1, Y0); g.moveTo((X0 + X1) / 2, Y0); g.lineTo((X0 + X1) / 2, Y1 - 6); g.stroke();
    const Emax = Math.max(r.E, 1e-9), Y = (e) => Y0 - e / Emax * (Y0 - Y1), Xr = (rr) => (X0 + X1) / 2 + rr / R * (X1 - X0) / 2;
    g.strokeStyle = C.amber; g.lineWidth = 1.8; g.beginPath();
    for (let k = 0; k <= 120; k++) { const rr = -R + 2 * R * k / 120; const e = eclairementHorsAxe(r.E, r.theta, d, Math.abs(rr)); g[k ? 'lineTo' : 'moveTo'](Xr(rr), Y(e)); }
    g.stroke(); g.lineWidth = 1;
    g.setLineDash([3, 3]); g.strokeStyle = '#6f7a84';
    for (const p of [0.5, 0.1]) { const lab = `${p * 100} %`; g.beginPath(); g.moveTo(X0, Y(Emax * p)); g.lineTo(X1, Y(Emax * p)); g.stroke(); g.fillStyle = '#6f7a84'; g.fillText(lab, X0 - 2, Y(Emax * p) - 3); }
    g.setLineDash([]);
    g.fillStyle = C.soft; g.fillText('l\'éclairement à travers la tache', X0, 20); g.fillText(`${lx(r.E)} au centre`, (X0 + X1) / 2 + 4, Y1 - 10);
    g.fillText(`−${m(R)}`, X0, Y0 + 14); g.fillText(`+${m(R)}`, X1 - 34, Y0 + 14);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Projecteur', PROJECTEURS.map((p) => [p.id, p.court, p.nom]), id, (v) => { id = v; draw(); }),
      slider('Faisceau, du serré au large', 0, 100, pos, 1, (v) => { pos = v; draw(); }, (v) => `${v} %`),
      slider('Distance au sujet', 1, 20, d, 0.5, (v) => { d = v; draw(); }, (v) => `${fmtNum(v, 1)} m`),
      slider('Gradateur', 0, 100, niveau, 5, (v) => { niveau = v; draw(); }, (v) => `${v} %`)),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'À gauche, le faisceau (50 % de l\'axe) et le champ (10 %) à l\'échelle ; à droite, l\'éclairement à travers la tache. Le modèle donne à tous les projecteurs le même profil en cloche : une découpe a, en vrai, un bord plus franc (trait blanc).')),
    info, verdict, read.el);
  draw();
}

// ======================================================================================
// 2. Le plateau de télévision
// ======================================================================================
function figPlateau() {
  const f = figure(720, 290, 'Un plateau de télévision vu de dessus et de côté. Vu de dessus : la caméra en bas, l\'invité au centre, le fond (le décor ou le cyclo) en haut. La lumière principale (face) est décalée de 30 à 45° sur un côté de l\'axe de la caméra ; le débouchage, une source douce, est près de l\'axe de la caméra, de l\'autre côté ; le contre-jour est derrière l\'invité, en hauteur, et détache ses cheveux et ses épaules du fond ; le décor et le cyclo ont leurs propres projecteurs. Vu de côté : la principale monte de 30 à 45° au-dessus des yeux. Le côté éclairé du visage reçoit la principale et le débouchage, le côté ombre le débouchage seul : le rapport de contraste vaut (principale + débouchage) ÷ débouchage, 2:1 (un diaph) pour l\'information, 4:1 (deux diaphs) pour un modelé marqué. Un visage au plateau reçoit de l\'ordre de 800 à 1 500 lux.');
  f.append(txt(10, 16, 'Le plateau vu de dessus', 'co-t', 'start'));
  const sx = 210, sy = 128;
  // fond, décor, cyclo
  f.append(sv('path', { d: 'M40 70 Q 210 22 380 70', fill: 'none', stroke: C.grey, strokeWidth: 3 }), txt(210, 38, 'décor ou cyclo', 'co-s'));
  f.append(sv('circle', { cx: 45, cy: 118, r: 6, fill: C.cyan }), arrow(47, 111, 57, 82, C.cyan), sv('circle', { cx: 375, cy: 118, r: 6, fill: C.cyan }), arrow(373, 111, 363, 82, C.cyan), txt(12, 138, 'lumière du décor', 'co-s', 'start'));
  // invité, caméra
  f.append(sv('circle', { cx: sx, cy: sy, r: 13, fill: '#3a444c', stroke: C.white }), sv('path', { d: `M${sx - 4} ${sy + 12} L${sx} ${sy + 18} L${sx + 4} ${sy + 12}`, fill: C.white }), txt(sx + 18, sy - 14, 'invité', 'co-s', 'start'));
  f.append(sv('rect', { x: sx - 14, y: 252, width: 28, height: 18, rx: 2, fill: C.box, stroke: C.white }), sv('path', { d: `M${sx - 6} 252 L${sx - 22} 226 M${sx + 6} 252 L${sx + 22} 226`, stroke: C.dim }), txt(sx, 284, 'caméra', 'co-s'));
  f.append(sv('line', { x1: sx, y1: sy + 16, x2: sx, y2: 250, stroke: C.dim, strokeDasharray: '3 3' }));
  // principale à 40° à gauche, débouchage à 15° à droite, contre-jour derrière
  const pos = (a, r) => [sx - r * Math.sin(rad(a)), sy + r * Math.cos(rad(a))];
  const [kx, ky] = pos(40, 108), [fx, fy] = pos(-15, 100), [bx, by] = [sx + 30, 62];
  f.append(sv('circle', { cx: kx, cy: ky, r: 8, fill: C.amber }), arrow(kx + 6, ky - 6, sx - 12, sy + 6, C.amber), txt(kx - 10, ky + 22, 'principale', 'co-t', 'end'), txt(kx - 10, ky + 36, '30 à 45° de côté', 'co-s', 'end'));
  f.append(sv('path', { d: `M${sx} ${sy + 60} A 60 60 0 0 1 ${sx - 60 * Math.sin(rad(40))} ${sy + 60 * Math.cos(rad(40))}`, fill: 'none', stroke: C.amber, strokeDasharray: '2 2' }), txt(sx - 24, sy + 76, '40°', 'co-s'));
  f.append(sv('rect', { x: fx - 12, y: fy - 6, width: 24, height: 12, rx: 2, fill: C.white, 'fill-opacity': 0.8 }), arrow(fx - 4, fy - 8, sx + 8, sy + 14, C.white), txt(fx + 18, fy + 4, 'débouchage (doux)', 'co-t', 'start'), txt(fx + 18, fy + 18, 'près de l\'axe, de l\'autre côté', 'co-s', 'start'));
  f.append(sv('circle', { cx: bx, cy: by, r: 7, fill: C.green }), arrow(bx - 3, by + 7, sx + 6, sy - 12, C.green), txt(bx + 12, by + 4, 'contre-jour', 'co-t', 'start'), txt(bx + 12, by + 18, 'derrière, en haut', 'co-s', 'start'));
  // vue de côté et rapport
  f.append(sv('line', { x1: 420, y1: 10, x2: 420, y2: 282, stroke: C.line }), txt(440, 30, 'De côté : 30 à 45° de haut', 'co-t', 'start'));
  const hx = 520, hy = 128;
  f.append(sv('circle', { cx: hx, cy: hy, r: 14, fill: '#3a444c', stroke: C.white }), sv('line', { x1: hx, y1: hy + 14, x2: hx, y2: hy + 58, stroke: C.white, strokeWidth: 3 }));
  f.append(sv('line', { x1: hx, y1: hy, x2: hx + 150, y2: hy, stroke: C.dim, strokeDasharray: '3 3' }), sv('circle', { cx: hx + 130 * Math.cos(rad(38)), cy: hy - 130 * Math.sin(rad(38)), r: 8, fill: C.amber }), arrow(hx + 120 * Math.cos(rad(38)), hy - 120 * Math.sin(rad(38)), hx + 18, hy - 10, C.amber));
  f.append(sv('path', { d: `M${hx + 60} ${hy} A 60 60 0 0 0 ${hx + 60 * Math.cos(rad(38))} ${hy - 60 * Math.sin(rad(38))}`, fill: 'none', stroke: C.amber, strokeDasharray: '2 2' }), txt(hx + 70, hy - 14, '38°', 'co-s', 'start'));
  f.append(txt(440, 214, 'Côté éclairé : principale + débouchage', 'co-s', 'start'), txt(440, 230, 'Côté ombre : débouchage seul', 'co-s', 'start'));
  f.append(txt(440, 250, 'Rapport = (P + D) ÷ D', 'co-t', 'start', { fill: C.amber }), txt(440, 266, '2:1 = un diaph (information) ; 4:1 = deux diaphs', 'co-s', 'start'), txt(440, 282, 'Un visage : de l\'ordre de 800 à 1 500 lx', 'co-s', 'start'));
  return f;
}
function demoPlateau(host) {
  let srcP = 'fresnel', dP = 3.5, azP = 40, elP = 35, nivP = 100, dD = 2.5, azD = 15, nivD = 60, TD = 3200;
  const cv = canvas(720, 230, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Principale sur le visage', 'Débouchage sur le visage', 'Côté éclairé (total)', 'Rapport de contraste', 'Débouchage pour 2:1 et pour 4:1', 'Couleur des deux sources', 'Exposition (ISO 800, 1/50 s)']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    // la cellule est sur le visage, tournée vers la caméra : incidence de chaque source
    const iP = incidenceVisage(azP, elP), iD = incidenceVisage(azD, 10);
    const P = eclairage({ source: srcP, angle: 30, niveau: nivP / 100, d: dP, incidence: iP, Tled: 5600 });
    const D = eclairage({ source: 'led', angle: 50, niveau: nivD / 100, d: dD, incidence: iD, Tled: TD });
    const tot = P.E + D.E, k = contraste(P.E, D.E), mix = melange([P, D]);
    const ecart = P.T > 0 && D.T > 0 ? Math.abs(dominante(P.T, D.T)) : 0;
    read.set('Principale sur le visage', `${lx(P.E)} (incidence ${fmtNum(iP, 0)}° : × cos ${fmtNum(iP, 0)}° = ${fmtNum(Math.cos(rad(iP)), 2)})`);
    read.set('Débouchage sur le visage', `${lx(D.E)} (panneau LED à ${fmtNum(dD, 1)} m)`);
    read.set('Côté éclairé (total)', lx(tot));
    read.set('Rapport de contraste', Number.isFinite(k.rapport) ? `${fmtNum(k.rapport, 1)}:1, soit ${fmtNum(k.diaphs, 1)} diaph${k.diaphs >= 2 ? 's' : ''} entre les deux côtés` : 'infini : le côté ombre est noir (pas de débouchage)');
    read.set('Débouchage pour 2:1 et pour 4:1', P.E > 0 ? `${lx(debouchagePour(P.E, 2))} pour 2:1, ${lx(debouchagePour(P.E, 4))} pour 4:1 (vous en avez ${lx(D.E)})` : 'principale éteinte');
    read.set('Couleur des deux sources', `principale ${kel(P.T)}, débouchage ${kel(D.T)}${ecart > 0 ? ` : écart de ${fmtNum(ecart, 0)} mireds` : ''}`);
    read.set('Exposition (ISO 800, 1/50 s)', tot > 0 ? `f/${fmtNum(ouverture(tot, 800, 1 / 50), 1)} pour le côté éclairé` : '—');
    const probs = [];
    if (tot < 800) probs.push(`le visage ne reçoit que ${lx(tot)} : il manque de lumière (de l'ordre de 800 à 1 500 lx au plateau)`);
    if (tot > 2000) probs.push(`${lx(tot)} : beaucoup pour un visage, l'invité est ébloui et la caméra ferme l'iris`);
    if (!Number.isFinite(k.rapport) || k.rapport > 4.5) probs.push('le côté ombre est trop sombre pour un plateau d\'information : montez le débouchage');
    else if (k.rapport < 1.6) probs.push('le visage est plat : le débouchage écrase le modelé de la principale');
    if (ecart > 20) probs.push(`deux couleurs sur le visage (${fmtNum(ecart, 0)} mireds d'écart) : aucune balance des blancs ne les corrige toutes les deux${srcP === 'fresnel' && nivP < 90 ? ' ; l\'halogène gradué a rougi' : ''}`);
    verdict.className = 'co-verdict ' + (probs.length === 0 ? 'ok' : probs.length === 1 ? 'warn' : 'ko');
    verdict.textContent = probs.length ? probs.map((s) => s[0].toUpperCase() + s.slice(1)).join('. ') + '.' : `Visage à ${lx(tot)}, rapport ${fmtNum(k.rapport, 1)}:1 (${fmtNum(k.diaphs, 1)} diaph), une seule couleur (${kel(mix.T)}) : un éclairage de plateau.`;
    // la vue de dessus
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 230);
    const sx = 230, sy = 70, s = 24, camY = 200;
    g.fillStyle = C.soft; g.font = '11px Arial, sans-serif'; g.fillText('vue de dessus (caméra en bas)', 10, 14);
    g.strokeStyle = C.dim; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(sx, sy + 12); g.lineTo(sx, camY); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.box; g.strokeStyle = C.white; g.fillRect(sx - 12, camY, 24, 16); g.strokeRect(sx - 12, camY, 24, 16);
    // positions au sol : la distance projetée (la principale est montée de elP, le débouchage de 10°)
    const sol = (az, dd, el, cote) => [sx + cote * dd * s * Math.sin(rad(az)) * Math.cos(rad(el)), sy + dd * s * Math.cos(rad(az)) * Math.cos(rad(el))];
    const [px, py] = sol(azP, dP, elP, -1), [qx, qy] = sol(azD, dD, 10, 1);
    g.strokeStyle = 'rgba(255,211,138,.6)'; g.beginPath(); g.moveTo(px, py); g.lineTo(sx, sy); g.stroke();
    g.strokeStyle = 'rgba(232,238,242,.5)'; g.beginPath(); g.moveTo(qx, qy); g.lineTo(sx, sy); g.stroke();
    g.fillStyle = C.amber; g.beginPath(); g.arc(px, py, 7, 0, 7); g.fill(); g.fillText('principale', px - 66, py + 4);
    g.fillStyle = C.white; g.fillRect(qx - 10, qy - 5, 20, 10); g.fillText('débouchage', qx + 14, qy + 4);
    g.fillStyle = '#3a444c'; g.beginPath(); g.arc(sx, sy, 12, 0, 7); g.fill(); g.strokeStyle = C.white; g.stroke();
    g.fillStyle = C.soft; g.fillText('(distances au sol : la principale est en hauteur)', 10, 226);
    // le visage tel que le voit la caméra : côté éclairé et côté ombre (courbe vidéo ≈ puissance 0,45)
    const vx = 560, vy = 112, R = 70, Tcol = mix.T || 5600;
    const teinte = (T) => (T < 3000 ? [255, 196, 140] : T < 4200 ? [255, 222, 190] : [235, 240, 255]);
    const niv = (e) => Math.min(1, 0.82 * Math.pow(Math.max(0, e) / Math.max(tot, 1e-9), 0.45));
    const face = (e, from, to) => { const [r, gg, b] = teinte(Tcol), v = tot > 0 ? niv(e) : 0; g.fillStyle = `rgb(${Math.round(r * v)},${Math.round(gg * v)},${Math.round(b * v)})`; g.beginPath(); g.moveTo(vx, vy); g.ellipse(vx, vy, R * 0.78, R, 0, from, to); g.closePath(); g.fill(); };
    face(tot, Math.PI / 2, Math.PI * 1.5); face(D.E, -Math.PI / 2, Math.PI / 2);
    g.strokeStyle = C.dim; g.beginPath(); g.ellipse(vx, vy, R * 0.78, R, 0, 0, 7); g.stroke();
    g.fillStyle = C.soft; g.fillText('le visage vu par la caméra', vx - 70, 22);
    g.fillText(`P + D : ${lx(tot)}`, vx - 150, vy + 4); g.fillText(`D : ${lx(D.E)}`, vx + 66, vy + 4);
    g.fillText(Number.isFinite(k.rapport) ? `rapport ${fmtNum(k.rapport, 1)}:1` : 'rapport infini', vx - 34, vy + R + 22);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Principale', [['fresnel', 'Fresnel halogène', SOURCES.fresnel.nom], ['hmi', 'Fresnel HMI', SOURCES.hmi.nom], ['led', 'Panneau LED 5 600 K', SOURCES.led.nom]], srcP, (v) => { srcP = v; draw(); }),
      slider('Principale : distance', 1.5, 6, dP, 0.1, (v) => { dP = v; draw(); }, (v) => `${fmtNum(v, 1)} m`),
      slider('Principale : de côté', 0, 90, azP, 5, (v) => { azP = v; draw(); }, (v) => `${v}°`),
      slider('Principale : en hauteur', 0, 60, elP, 5, (v) => { elP = v; draw(); }, (v) => `${v}°`),
      slider('Principale : gradateur', 0, 100, nivP, 5, (v) => { nivP = v; draw(); }, (v) => `${v} %`)),
    el('div', { class: 'co-ctl' },
      slider('Débouchage : distance', 1, 5, dD, 0.1, (v) => { dD = v; draw(); }, (v) => `${fmtNum(v, 1)} m`),
      slider('Débouchage : de côté', 0, 60, azD, 5, (v) => { azD = v; draw(); }, (v) => `${v}°`),
      slider('Débouchage : niveau', 0, 100, nivD, 5, (v) => { nivD = v; draw(); }, (v) => `${v} %`),
      choice('Débouchage : couleur', [['3200', '3 200 K'], ['5600', '5 600 K']], String(TD), (v) => { TD = +v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'La cellule est sur le visage, tournée vers la caméra : une source décalée sur le côté ou montée arrive en biais (cos de l\'incidence). Le visage est rendu avec une courbe vidéo simplifiée.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 3. Le stade
// ======================================================================================
function figStade() {
  const f = figure(720, 300, 'À gauche, un stade vu de dessus : la pelouse de 105 × 68 m, des rampes de projecteurs sous le bord du toit sur les quatre côtés et la caméra principale dans la tribune. Sur un point de la pelouse, deux mesures : l\'éclairement horizontal au sol, et l\'éclairement vertical, à 1 m du sol, sur un plan tourné vers la caméra : c\'est lui qui éclaire le visage des joueurs à l\'image. L\'uniformité se calcule sur une grille de points : U1 = Emin ÷ Emax, U2 = Emin ÷ Emoyen. À droite, le scintillement : alimentée sur le secteur à 50 Hz, une source qui n\'est pas lissée varie à 100 Hz. Une image exposée 1/100 s (ou 1/50 s) contient toujours une période entière : toutes les images ont la même lumière. Un super ralenti à 150 images par seconde expose au plus 1/150 s : d\'une image à l\'autre, la lumière change, et le ralenti pompe.');
  f.append(txt(10, 16, 'Le stade vu de dessus', 'co-t', 'start'));
  const cx = 160, cy = 150, s = 1.9;
  const X = (x) => cx + x * s, Y = (y) => cy - y * s;
  f.append(sv('rect', { x: X(-PELOUSE.L / 2), y: Y(PELOUSE.l / 2), width: PELOUSE.L * s, height: PELOUSE.l * s, fill: '#1d3a26', stroke: C.green }), sv('line', { x1: cx, y1: Y(PELOUSE.l / 2), x2: cx, y2: Y(-PELOUSE.l / 2), stroke: C.green }), sv('circle', { cx, cy, r: 9.15 * s, fill: 'none', stroke: C.green }));
  for (const gr of implantationById('toit').groupes) f.append(sv('circle', { cx: X(gr.x), cy: Y(gr.y), r: 3.5, fill: C.amber }));
  f.append(sv('rect', { x: X(-75) - 6, y: Y(60) - 6, width: 150 * s + 12, height: 120 * s + 12, rx: 10, fill: 'none', stroke: C.dim, strokeDasharray: '4 3' }), txt(cx, Y(60) - 10, 'projecteurs sous le bord du toit', 'co-s'));
  const cam = CAMERA_PRINCIPALE;
  f.append(sv('rect', { x: X(cam.x) - 8, y: Y(cam.y) - 5, width: 16, height: 10, rx: 2, fill: C.box, stroke: C.white }), txt(X(cam.x) + 14, Y(cam.y) + 4, 'caméra principale', 'co-s', 'start'));
  // un point et ses deux mesures
  const px = X(-30), py = Y(15);
  f.append(sv('circle', { cx: px, cy: py, r: 4, fill: C.white }), arrow(X(-30), Y(60), px, py - 4, C.amber));
  f.append(sv('line', { x1: px - 10, y1: py + 6, x2: px + 10, y2: py + 14, stroke: C.cyan, strokeWidth: 3 }), arrow(px, py + 10, px + 22, py + 36, C.cyan), txt(px + 26, py + 46, 'Ev : vers la caméra', 'co-s', 'start', { fill: C.cyan }));
  f.append(txt(px - 6, py - 10, 'Eh : au sol', 'co-s', 'end', { fill: C.amber }));
  f.append(txt(10, 288, 'U1 = Emin ÷ Emax ; U2 = Emin ÷ Emoyen', 'co-s', 'start'));
  // le scintillement
  f.append(sv('line', { x1: 330, y1: 10, x2: 330, y2: 292, stroke: C.line }), txt(346, 30, 'Le scintillement : une lumière qui varie à 100 Hz', 'co-t', 'start'));
  const t0 = 346, t1 = 706, dur = 0.04, T = (t) => t0 + t / dur * (t1 - t0), mm = 0.5, f100 = frequenceLumiere(50);
  const courbe = (y0, h) => { let d = ''; for (let k = 0; k <= 200; k++) { const t = k / 200 * dur; d += (k ? 'L' : 'M') + T(t).toFixed(1) + ' ' + (y0 - h * (1 + mm * Math.sin(2 * Math.PI * f100 * t))).toFixed(1); } return sv('path', { d, fill: 'none', stroke: C.amber, strokeWidth: 1.4 }); };
  const rangee = (y0, c, t, lab) => {
    const gg = sv('g', {});
    gg.append(txt(346, y0 - 52, lab, 'co-s', 'start'));
    for (let k = 0; k * (1 / c) + t <= dur + 1e-9; k++) {
      const a = k / c, v = imageMoyenne(mm, f100, a, t);
      gg.append(sv('rect', { x: T(a), y: y0 - 40, width: Math.max(1.5, T(a + t) - T(a)), height: 40, fill: C.cyan, 'fill-opacity': 0.14 }));
      gg.append(sv('rect', { x: T(a), y: y0 + 8, width: Math.max(4, T(a + t) - T(a)), height: v * 12, fill: C.white, 'fill-opacity': 0.8 }));
    }
    gg.append(courbe(y0, 26), txt(706, y0 + 34, 'lumière de chaque image', 'co-s', 'end'));
    return gg;
  };
  f.append(rangee(110, 50, 0.01, '50 images/s, pose 1/100 s : toutes les images pareilles'));
  f.append(rangee(230, 150, 1 / 150, '150 images/s, pose 1/150 s : les images changent'));
  f.append(txt(346, 292, '40 ms de temps réel ; en bleu, le temps de pose de chaque image', 'co-s', 'start'));
  return f;
}
const CADENCES = [50, 100, 150, 300];
const POSES = [1 / 50, 1 / 100, 1 / 150, 1 / 200, 1 / 250, 1 / 300, 1 / 500, 1 / 1000];
function demoStade(host) {
  let src = 'hmi-mag', c = 150, iPose = 2, imp = 'toit', n = 300, panne = -1, vue = 'ev';
  const cv = canvas(720, 190, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Temps de pose', 'Ondulation d\'une image à l\'autre', 'Battement à la prise de vue', 'Vu par le téléspectateur', 'Les poses sûres à cette cadence']);
  const verdict = el('p', { class: 'co-verdict' });
  const cv2 = canvas(720, 260, 'co-canvas co-smooth'), h = cv2.getContext('2d');
  const read2 = readout(['Éclairement vertical vers la caméra', 'Uniformité de l\'éclairement vertical', 'Éclairement horizontal', 'Uniformité de l\'éclairement horizontal']);
  const verdict2 = el('p', { class: 'co-verdict' });
  const drawFlicker = () => {
    const S = sourceStadeById(src), t = Math.min(POSES[iPose], 1 / c), r = scintillementVu(S.m, t, c), f100 = frequenceLumiere(50);
    const sures = posesSures(f100, 1 / c);
    read.set('Temps de pose', `${pose(t)}${POSES[iPose] > 1 / c + 1e-9 ? ` (une image dure ${pose(1 / c)} : la pose ne peut pas être plus longue)` : ''}`);
    read.set('Ondulation d\'une image à l\'autre', `± ${fmtNum(r.ondulation * 100, 1)} % (la source ondule de ± ${fmtNum(S.m * 100, 1)} %, la pose en laisse passer ${fmtNum(r.residu * 100, 0)} %)`);
    read.set('Battement à la prise de vue', r.apparente > 0.01 ? `${fmtNum(r.apparente, 0)} Hz : écart entre 100 Hz et le multiple de ${c} le plus proche` : `aucun : ${c} images/s tombe juste sur les 100 Hz`);
    read.set('Vu par le téléspectateur', c > 50 ? `ralenti × ${fmtNum(r.ralenti, 0)} relu à 50 images/s : ${r.apparente > 0.01 ? `${fmtNum(r.auRalenti, 1)} Hz de pompage` : 'pas de battement'}` : 'en direct, à 50 images/s');
    read.set('Les poses sûres à cette cadence', sures.length ? sures.map(pose).join(', ') : `aucune : une image dure ${pose(1 / c)}, moins qu'une période de la lumière (1/100 s)`);
    verdict.className = 'co-verdict ' + (r.visible ? 'ko' : r.pompage ? 'warn' : 'ok');
    verdict.textContent = r.visible ? `Le ${c > 50 ? 'ralenti' : 'direct'} scintille : la lumière change de ± ${fmtNum(r.ondulation * 100, 0)} % d'une image à l'autre, ${fmtNum(r.auRalenti, 1)} fois par seconde à l'écran. Il faut des projecteurs sans scintillement${c <= 100 ? ' ou une pose multiple de 1/100 s' : ''}.`
      : r.pompage ? `Pas de battement rapide (${c} images/s tombe juste sur les 100 Hz), mais la pose n'efface pas l'ondulation (± ${fmtNum(r.ondulation * 100, 0)} %) : le secteur n'est jamais exactement à 50 Hz, l'image pompe lentement. Une pose de 1/100 s règle le problème.`
        : r.ondulation <= 0.02 && S.m > 0.02 ? `La pose (${pose(t)}) contient un nombre entier de périodes de 1/100 s : chaque image reçoit la même lumière.` : `${S.court} : la lumière ne varie presque pas, aucune pose ne la fait scintiller.`;
    // la lumière, les poses, la lumière de chaque image
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 190);
    const dur = 0.04, t0 = 40, t1 = 700, T = (x) => t0 + x / dur * (t1 - t0), y0 = 86, amp = 30;
    g.fillStyle = C.soft; g.font = '11px Arial, sans-serif'; g.fillText(`la lumière de la source (± ${fmtNum(S.m * 100, 0)} % à 100 Hz) et la pose de chaque image, sur 40 ms`, t0, 14);
    for (let k = 0; k * (1 / c) <= dur + 1e-9; k++) { const a = k / c; g.fillStyle = 'rgba(127,211,243,.16)'; g.fillRect(T(a), y0 - 64, Math.max(1.5, T(a + t) - T(a)), 72); }
    g.strokeStyle = C.amber; g.lineWidth = 1.6; g.beginPath();
    for (let k = 0; k <= 400; k++) { const x = k / 400 * dur; g[k ? 'lineTo' : 'moveTo'](T(x), y0 - amp * (1 + S.m * Math.sin(2 * Math.PI * f100 * x))); }
    g.stroke(); g.lineWidth = 1;
    g.strokeStyle = '#3a444c'; g.beginPath(); g.moveTo(t0, y0); g.lineTo(t1, y0); g.stroke();
    g.fillStyle = C.soft; g.fillText('la lumière reçue par chaque image', t0, 118);
    for (let k = 0; k * (1 / c) <= dur + 1e-9; k++) {
      const a = k / c, v = imageMoyenne(S.m, f100, a, t), w = Math.max(3, Math.min(30, (T(a + 1 / c) - T(a)) * 0.7));
      g.fillStyle = C.white; g.fillRect(T(a), 180 - v * 26, w, v * 26);
    }
  };
  const drawGrille = () => {
    const R = eclairementStade({ implantation: imp, n, panne }), I = implantationById(imp);
    const okEv = R.ev.moy >= STADE_TV.evMin, okU = R.ev.u1 >= STADE_TV.u1 && R.ev.u2 >= STADE_TV.u2;
    read2.set('Éclairement vertical vers la caméra', `moyen ${lx(R.ev.moy)}, de ${lx(R.ev.min)} à ${lx(R.ev.max)} (repère : ${fmtNum(STADE_TV.evMin, 0)} à ${fmtNum(STADE_TV.evMax, 0)} lx)`);
    read2.set('Uniformité de l\'éclairement vertical', `U1 = ${fmtNum(R.ev.u1, 2)} · U2 = ${fmtNum(R.ev.u2, 2)} (repères : U1 ≥ ${fmtNum(STADE_TV.u1, 1)}, U2 ≥ ${fmtNum(STADE_TV.u2, 1)})`);
    read2.set('Éclairement horizontal', `moyen ${lx(R.eh.moy)}, de ${lx(R.eh.min)} à ${lx(R.eh.max)}`);
    read2.set('Uniformité de l\'éclairement horizontal', `U1 = ${fmtNum(R.eh.u1, 2)} · U2 = ${fmtNum(R.eh.u2, 2)}`);
    verdict2.className = 'co-verdict ' + (okEv && okU ? 'ok' : R.ev.moy < STADE_TV.evMin * 0.5 || R.ev.u1 < 0.2 ? 'ko' : 'warn');
    verdict2.textContent = okEv && okU ? `Assez de lumière tournée vers la caméra (${lx(R.ev.moy)}) et une pelouse régulière : l'iris de la vision ne bougera pas d'un bout à l'autre du terrain.`
      : R.ev.u1 < 0.2 ? `Des zones presque noires vers la caméra (Emin ${lx(R.ev.min)}) : les joueurs y sont à contre-jour, alors que le sol, lui, reçoit ${lx(R.eh.moy)} en moyenne. L'éclairement horizontal ne suffit pas à juger.`
        : !okEv ? `Trop peu de lumière tournée vers la caméra (${lx(R.ev.moy)} en moyenne) : ajoutez des projecteurs, ou une rampe côté caméra.`
          : `Assez de lumière en moyenne, mais une pelouse irrégulière (U1 ${fmtNum(R.ev.u1, 2)}, U2 ${fmtNum(R.ev.u2, 2)}) : en suivant le ballon, la vision corrigerait l'iris sans cesse.`;
    // la carte
    h.fillStyle = C.ink; h.fillRect(0, 0, 720, 260);
    const cx = 230, cy = 130, s = 2, X = (x) => cx + x * s, Y = (y) => cy - y * s;
    h.fillStyle = '#1d3a26'; h.fillRect(X(-PELOUSE.L / 2), Y(PELOUSE.l / 2), PELOUSE.L * s, PELOUSE.l * s);
    h.strokeStyle = C.green; h.strokeRect(X(-PELOUSE.L / 2), Y(PELOUSE.l / 2), PELOUSE.L * s, PELOUSE.l * s);
    I.groupes.forEach((gr, k) => { h.fillStyle = k === panne ? '#3a444c' : C.amber; h.beginPath(); h.arc(X(gr.x), Y(gr.y), 4, 0, 7); h.fill(); });
    h.fillStyle = C.box; h.strokeStyle = C.white; h.fillRect(X(CAMERA_PRINCIPALE.x) - 8, Y(CAMERA_PRINCIPALE.y) - 5, 16, 10); h.strokeRect(X(CAMERA_PRINCIPALE.x) - 8, Y(CAMERA_PRINCIPALE.y) - 5, 16, 10);
    const vals = R.points.map((p) => (vue === 'ev' ? p.ev : p.eh)), max = Math.max(...vals, 1);
    R.points.forEach((p, k) => {
      const v = vals[k] / max, col = `rgb(${Math.round(40 + 215 * v)},${Math.round(50 + 161 * v)},${Math.round(80 + 58 * v)})`;
      h.fillStyle = col; h.beginPath(); h.arc(X(p.x), Y(p.y), 15, 0, 7); h.fill();
      h.fillStyle = v > 0.55 ? C.ink : C.white; h.font = '10px Arial, sans-serif'; h.textAlign = 'center'; h.fillText(fmtNum(vals[k], 0), X(p.x), Y(p.y) + 3);
    });
    h.textAlign = 'left'; h.fillStyle = C.soft; h.font = '11px Arial, sans-serif';
    h.fillText(vue === 'ev' ? 'éclairement vertical vers la caméra (lx)' : 'éclairement horizontal au sol (lx)', 470, 40);
    h.fillText('caméra principale', X(CAMERA_PRINCIPALE.x) + 12, Y(CAMERA_PRINCIPALE.y) + 4);
    const u = vue === 'ev' ? R.ev : R.eh;
    h.fillStyle = C.white; h.font = '12px Arial, sans-serif';
    h.fillText(`Emin ${fmtNum(u.min, 0)} lx`, 470, 70); h.fillText(`Emax ${fmtNum(u.max, 0)} lx`, 470, 90); h.fillText(`Emoyen ${fmtNum(u.moy, 0)} lx`, 470, 110);
    h.fillStyle = C.amber; h.fillText(`U1 = ${fmtNum(u.min, 0)} ÷ ${fmtNum(u.max, 0)} = ${fmtNum(u.u1, 2)}`, 470, 140); h.fillText(`U2 = ${fmtNum(u.min, 0)} ÷ ${fmtNum(u.moy, 0)} = ${fmtNum(u.u2, 2)}`, 470, 160);
    h.fillStyle = C.soft; h.font = '11px Arial, sans-serif'; h.fillText(`${n} projecteurs LED, ${fmtNum(R.parGroupe, 0)} par groupe`, 470, 190); h.fillText(I.nom, 470, 206);
    if (panne >= 0) h.fillText('un groupe éteint (en gris)', 470, 222);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Source', SOURCES_STADE.map((S) => [S.id, S.court, `${S.nom} : ${S.note}`]), src, (v) => { src = v; drawFlicker(); }),
      choice('Cadence de la caméra', CADENCES.map((x) => [String(x), `${x} images/s`]), String(c), (v) => { c = +v; drawFlicker(); }),
      slider('Temps de pose', 0, POSES.length - 1, iPose, 1, (v) => { iPose = v; drawFlicker(); }, (v) => pose(POSES[v]))),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'En haut, la lumière de la source et, en bleu, le temps de pose de chaque image ; en bas, la lumière que reçoit chaque image. Quand les barres changent de hauteur, l\'image scintille.')),
    verdict, read.el,
    el('div', { class: 'co-ctl' },
      choice('Les projecteurs', IMPLANTATIONS.map((I) => [I.id, I.court, I.nom]), imp, (v) => { imp = v; panne = -1; drawGrille(); }),
      slider('Nombre de projecteurs LED', 50, 400, n, 10, (v) => { n = v; drawGrille(); }, (v) => `${v}`),
      choice('Une panne', [['non', 'Tout allumé'], ['oui', 'Un groupe éteint côté caméra']], 'non', (v) => { panne = v === 'oui' ? 0 : -1; drawGrille(); }),
      choice('Carte', [['ev', 'Vertical vers la caméra'], ['eh', 'Horizontal au sol']], vue, (v) => { vue = v; drawGrille(); })),
    el('figure', { class: 'co-figc' }, cv2, el('figcaption', {}, 'Quinze points de mesure sur la pelouse (une étude réelle en prend un tous les 10 m environ). Les projecteurs sont un modèle simple : des LED de 1 500 W à faisceau de 30°, qui se partagent des points visés. Ordres de grandeur.')),
    verdict2, read2.el);
  drawFlicker(); drawGrille();
}

// ======================================================================================
// Les leçons
// ======================================================================================
/** @type {import('./index.js').Lesson[]} */
export const LUMIERE_ECLAIRER = [
  {
    id: 'lumiere-projecteurs', title: 'Les projecteurs : Fresnel, découpe, PAR, panneau, lyre', minutes: '8 min',
    essentials: [
      'Chaque projecteur a sa lumière : le **Fresnel** (bord doux, du serré au large), la **découpe** (bord net, couteaux, gobo), le **PAR** (angle fixe), le **panneau LED** ou la **boîte à lumière** (lumière douce), la **lyre** (motorisée, commandée en DMX).',
      'L\'**angle de faisceau** est celui où l\'intensité tombe à **50 %** de l\'axe, l\'**angle de champ** à **10 %** ; le diamètre éclairé vaut **2 d tan(θ/2)**, et **serrer** le faisceau **concentre l\'intensité** dans l\'axe.',
      'La **taille apparente** de la source vue du sujet fait la **dureté de l\'ombre** : petite et loin, ombre nette ; grande et proche, ombre douce.',
    ],
    figure: figProjecteurs,
    demoTitle: 'Prenez le Fresnel à 4 m et passez du serré au large : lisez le diamètre et l\'éclairement. Reculez à 8 m. Comparez avec le panneau LED, puis la boîte à lumière : regardez l\'ombre.',
    demo: demoProjecteurs,
    body: `Un **projecteur** est fait d'une source (lampe halogène, HMI ou LED), d'un réflecteur qui renvoie vers l'avant la lumière partie vers l'arrière, et souvent d'une optique qui façonne le faisceau. C'est l'optique qui fait la différence entre les familles.

Le **Fresnel** porte une **lentille à échelons** : une lentille convexe découpée en anneaux concentriques, mince et légère (l'idée vient des phares, au XIXᵉ siècle). En avançant ou en reculant la lampe et son réflecteur derrière la lentille, on passe du faisceau **serré** (*spot*, une douzaine de degrés) au faisceau **large** (*flood*, une soixantaine de degrés). Le bord de la tache est **doux** : la lumière décroît progressivement. Des **volets coupe-flux** (quatre volets articulés devant la lentille) rognent les bords pour éviter d'éclairer le décor ou l'objectif d'une caméra. C'est le projecteur de base des plateaux, en halogène 650 W à 2 kW, en HMI ou en LED.

La **découpe** (ou projecteur à **profil**) concentre la lumière sur une petite fenêtre, le **plan focal**, puis un objectif la projette comme une image : ce qu'on place dans la fenêtre se dessine net sur le décor. On y glisse des **couteaux** (quatre lames qui découpent un trapèze), un **iris** (qui réduit un rond), un **gobo** (un disque de métal ou de verre gravé : un logo, des feuillages). Le bord est **net**, ou adouci en déréglant l'objectif. L'angle est fixe (on change d'objectif) ou réglable par un **zoom**.

Le **PAR** (*parabolic aluminized reflector*) est une lampe qui contient son propre réflecteur parabolique et sa lentille : l'angle est celui de la lampe, du très serré au large, et ne se règle pas (on change de lampe). Faisceau puissant, souvent ovale, peu de réglages : la lumière de spectacle par excellence. Le PAR LED l'a largement remplacé.

Le **panneau LED** répartit des dizaines de diodes sur une grande surface ; la **boîte à lumière** (*softbox*) place une toile diffusante devant une source et en fait une surface de 60 cm à plus d'un mètre. Ce sont des sources **larges** : lumière **douce**, ombres floues. Elles servent au **débouchage** et à la face des visages. Une grille en nid d'abeille limite les débords.

La **lyre** (*moving head*) est un projecteur **motorisé** : la tête tourne en **pan** (autour de l'axe vertical) et en **tilt** (de haut en bas), et tout se commande à distance par le **DMX** (le protocole des projecteurs) : position, zoom, couleur, gobos, intensité. Une lyre **spot** a un bord net et des gobos, comme une découpe ; une lyre **wash** a un bord doux, comme un Fresnel.

Pour comparer des projecteurs, il faut leurs angles. L'**angle de faisceau** est celui où l'intensité tombe à **50 %** de celle de l'axe ; l'**angle de champ**, celui où elle tombe à **10 %** : c'est là que la lumière s'arrête vraiment. Avec un profil en cloche (celui du Labo), l'angle de champ vaut environ **1,82 fois** l'angle de faisceau. À la distance d, le diamètre éclairé vaut **2 × d × tan(θ ÷ 2)** : un faisceau de 30° à 4 m fait une tache de 2,1 m.

**Serrer concentre.** Le même flux (la lumière totale, en lumens) envoyé dans un cône plus étroit donne une **intensité** (en candelas) plus forte dans l'axe, donc plus de lux sur le sujet. Le Fresnel 1 kW du Labo passe de 5 500 cd au large (60°) à 80 000 cd au serré (12°), ordres de grandeur de fiches : quatorze fois plus de lumière au centre, sur une tache cinq fois plus étroite. L'éclairement suit ensuite l'inverse du carré : **E = I ÷ d²**.

Enfin, la **dureté de l'ombre** ne dépend pas de la puissance mais de la **taille apparente** de la source vue du sujet : 2 × arctan(taille ÷ 2d). Une lentille de 15 cm à 3 m est vue sous 3° : ombre nette. Une boîte à lumière de 90 cm à 1,5 m est vue sous plus de 30° : ombre douce, aux bords fondus. Le soleil, immense mais très loin, est vu sous un demi-degré : ses ombres sont dures. Rapprocher une source large l'adoucit ; la reculer la durcit.`,
    plus: `- Les chiffres des projecteurs du Labo et de la manipulation sont des ordres de grandeur de fiches constructeur (Fresnel 1 kW halogène, HMI 575 W, panneau LED 100 W) ; ceux de la découpe, du PAR, de la lyre et de la boîte à lumière sont calculés depuis leur puissance, l'efficacité de leur famille et la part de lumière qui sort de l'optique. Une fiche réelle donne souvent un tableau : diamètre et éclairement à 5, 10, 15 m.
- Le flux d'un faisceau en cloche vaut environ l'intensité dans l'axe × l'angle solide du cône ÷ ln 2 : on passe des lumens aux candelas, et retour.
- Un Fresnel au serré a un rendement plus faible qu'au large : une partie de la lumière de la lampe n'entre pas dans la lentille.
- Une lyre se règle comme un projecteur fixe, mais depuis la console : la leçon sur les lyres et la console, dans la partie « Commander la lumière ».`,
    car: { text: 'Dans le Labo (Jouer → Le Labo), l\'atelier Photométrie : le Fresnel halogène, le Fresnel HMI et le panneau LED, réglés du serré au large, à distance variable, avec le luxmètre sur le visage du sujet. Au car, le stade est éclairé par des rampes de projecteurs LED sous le bord du toit.' },
    terms: ['angle-faisceau', 'intensite-lumineuse', 'eclairement', 'inverse-carre', 'projecteur-fresnel', 'projecteur-decoupe', 'lumiere-douce'],
    competences: ['C17', 'C31'], savoirs: ['D1', 'G2', 'G3'],
    quiz: [
      { q: 'Au plateau, il faut projeter le logo de l\'émission, net, sur le fond du décor. Quel projecteur prenez-vous ?', choices: ['Une découpe, avec un gobo du logo', ['Un Fresnel serré', 'Le Fresnel a un bord doux et n\'a pas de plan focal : il ne peut pas projeter une image nette.'], ['Une boîte à lumière', 'Une source large donne une lumière douce, sans forme : c\'est l\'inverse d\'une projection nette.']], answer: 0, why: 'La découpe concentre la lumière sur un plan focal et son objectif le projette : un gobo placé là se dessine net sur le décor. Une lyre spot avec un gobo ferait aussi l\'affaire.' },
      { q: 'Un Fresnel a un angle de faisceau de 30°. Quel diamètre éclaire-t-il à 4 m ?', choices: ['Environ 2,1 m', ['Environ 1,1 m', 'C\'est le rayon : le diamètre vaut 2 × 4 × tan(15°) ≈ 2,1 m.'], ['Environ 120 m', 'On ne multiplie pas les degrés par la distance : diamètre = 2 d tan(θ ÷ 2).']], answer: 0, why: 'Diamètre = 2 × d × tan(θ ÷ 2) = 2 × 4 × tan 15° ≈ 2,14 m. C\'est le diamètre à 50 % de l\'axe ; la lumière déborde jusqu\'à l\'angle de champ, environ 1,8 fois plus large.' },
      { q: 'Le présentateur manque de lumière. Sans changer de projecteur ni de place, que faites-vous sur le Fresnel qui l\'éclaire ?', choices: ['Je serre le faisceau : la même lumière est concentrée sur une tache plus petite', ['J\'ouvre le faisceau au large', 'Au large, le même flux s\'étale sur une plus grande tache : l\'intensité dans l\'axe baisse, le présentateur reçoit moins.'], ['Je ferme les volets coupe-flux', 'Les volets coupent les bords du faisceau ; ils n\'ajoutent rien au centre.']], answer: 0, why: 'Serrer concentre le flux dans un cône plus étroit : l\'intensité dans l\'axe monte (de 5 500 à 80 000 cd entre 60° et 12° pour le Fresnel 1 kW du Labo, ordres de grandeur), donc l\'éclairement aussi. Attention à garder une tache assez large pour les mouvements de l\'invité.' },
      { q: 'L\'invitée trouve que la lumière marque trop les rides et que l\'ombre de son nez est très nette. Que changez-vous ?', choices: ['Une source plus large et plus proche : une boîte à lumière', ['Un Fresnel plus puissant, plus loin', 'Plus loin, la source paraît plus petite : l\'ombre devient encore plus nette.'], ['La même source, au gradateur à 50 %', 'Baisser la lumière ne change pas la forme de l\'ombre, seulement son niveau (et un halogène rougit).']], answer: 0, why: 'La dureté de l\'ombre dépend de la taille apparente de la source vue du sujet. Une boîte à lumière de 90 cm à 1,5 m est vue sous plus de 30° : ombres fondues, peau adoucie.' },
      { q: 'Qu\'est-ce que l\'angle de champ d\'un projecteur ?', choices: ['L\'angle où l\'intensité tombe à 10 % de celle de l\'axe', ['L\'angle où l\'intensité tombe à 50 % de l\'axe', 'C\'est l\'angle de faisceau. L\'angle de champ, à 10 %, est plus large : environ 1,8 fois.'], ['L\'angle que voit la caméra', 'Le même mot sert en optique (le champ de l\'objectif), mais pour un projecteur, c\'est la limite à 10 % de l\'axe.']], answer: 0, why: 'Angle de faisceau : 50 % de l\'axe ; angle de champ : 10 %. Avec un profil en cloche, le champ vaut environ 1,82 fois le faisceau. Au-delà du champ, il ne reste presque rien.' },
      { q: 'Pour une émission de variétés, il faut des faisceaux qui changent de couleur, de position et de forme pendant le direct. Que faut-il ?', choices: ['Des lyres, commandées par le DMX depuis la console', ['Des PAR', 'Le PAR a un angle fixe et ne bouge pas : il faudrait monter le voir pour le repointer.'], ['Des Fresnels avec des gélatines', 'Une gélatine se change à la main, et un Fresnel ne se repointe pas seul.']], answer: 0, why: 'Une lyre est motorisée : pan, tilt, zoom, couleur et gobos se commandent à distance par le DMX, et la console enchaîne les états pendant le direct.' },
    ],
  },
  {
    id: 'lumiere-plateau', title: 'Éclairer un plateau de télévision', minutes: '8 min',
    essentials: [
      'Trois lumières par personne : la **principale** (vers **30 à 45°** de côté et de haut), le **débouchage** (doux, près de la caméra) qui éclaircit l\'ombre, le **contre-jour** qui **détache** du fond ; le décor et le cyclo ont les leurs.',
      'Le **rapport de contraste** = **(principale + débouchage) ÷ débouchage** : **2:1** (un diaph) pour l\'information, **4:1** (deux diaphs) pour un modelé marqué ; un visage reçoit de l\'ordre de **800 à 1 500 lx**.',
      '**Une seule température de couleur** sur le plateau : la caméra ne fait qu\'une balance des blancs. Et l\'on traque les **reflets** dans les lunettes et les **ombres multiples**.',
    ],
    figure: figPlateau,
    demoTitle: 'Réglez la principale à 40° de côté et 35° de haut, puis montez le débouchage jusqu\'à un rapport de 2:1. Passez le débouchage à 5 600 K. Descendez le gradateur de la principale halogène à 60 % : lisez sa couleur.',
    demo: demoPlateau,
    body: `Au plateau, chaque personne filmée reçoit au moins trois lumières, chacune avec son rôle.

La **lumière principale** (la **face**, *key light*) dessine le visage. On la place sur un côté de l'axe de la caméra, vers **30 à 45°**, et au-dessus des yeux, vers **30 à 45°** de hauteur : l'ombre du nez tombe en biais vers la commissure des lèvres, le visage prend du relief. Trop de face (dans l'axe de la caméra) écrase le relief ; trop de côté coupe le visage en deux. C'est souvent un Fresnel ou une source LED à faisceau réglable.

Le **débouchage** (*fill light*) éclaircit l'ombre laissée par la principale. On le place près de l'axe de la caméra, de l'autre côté, avec une source **douce** (panneau LED, boîte à lumière, réflecteur) pour ne pas créer une seconde ombre. Il ne dessine rien : il dose le contraste.

Le **contre-jour** (*back light*) est derrière la personne, en hauteur : il dessine un liseré lumineux sur les cheveux et les épaules et la **détache du fond**. Sans lui, des cheveux bruns sur un décor sombre disparaissent.

Le **décor** et le **cyclo** (le fond tendu, courbe, sans angle visible) ont leurs propres projecteurs, réglés à part : on les garde un peu en dessous des visages pour que le regard aille aux personnes.

Le **rapport de contraste** dit l'écart entre les deux côtés du visage. Le côté éclairé reçoit la principale **et** le débouchage ; le côté ombre, le débouchage seul : **rapport = (E principale + E débouchage) ÷ E débouchage**. On le compte aussi en **diaphs** (un diaph = un facteur 2) : log₂ du rapport. **2:1**, un diaph, donne un visage doux et lisible : c'est la télévision d'information, le journal, le plateau d'avant-match. **4:1**, deux diaphs, donne un modelé marqué : le magazine, la fiction. Au-delà de 8:1, c'est le clair-obscur. Exemple : principale 900 lx, débouchage 450 lx : (900 + 450) ÷ 450 = 3:1, soit 1,6 diaph.

Les niveaux : un visage au plateau reçoit **de l'ordre de 800 à 1 500 lx** (ordre de grandeur, selon la caméra, l'ouverture voulue et le décor). Plus de lumière permet de fermer l'iris (plus de profondeur de champ) mais éblouit les invités et chauffe le plateau ; moins oblige à ouvrir, ou à monter le gain (et le bruit). On mesure au **luxmètre**, la cellule sur le visage, tournée vers la caméra : une source décalée sur le côté arrive en biais et compte moins (cosinus de l'incidence).

**Une seule température de couleur.** La caméra ne fait qu'une **balance des blancs** pour toute l'image. Si la principale est un halogène à 3 200 K et le débouchage une LED à 5 600 K, un côté du visage est orange et l'autre bleu, et aucun réglage ne corrige les deux. On choisit une température pour tout le plateau, on règle les LED bicolores dessus, on corrige les autres par des **gélatines** (CTB pour bleuir, CTO pour réchauffer). Attention : un halogène **rougit** au gradateur (à mi-tension, environ 2 400 K au lieu de 3 200 K) ; on préfère le reculer ou le diffuser.

Deux pièges classiques :
- les **reflets dans les lunettes** : la lumière se réfléchit comme sur un miroir, avec le même angle ; on monte la principale ou on l'écarte davantage sur le côté, ou l'on incline légèrement les branches ;
- les **ombres multiples** : deux principales sur le même visage font deux ombres de nez. Une seule source dure par visage et par axe de caméra ; les autres sont douces.`,
    plus: `- Sur un plateau à plusieurs caméras, la principale de l'une est le contre-jour de l'autre : on éclaire pour les axes les plus utilisés, et l'on croise les lumières (la principale d'un invité vient du côté de la caméra qui le filme de face).
- Les projecteurs sont accrochés à un **gril** au plafond, sur des perches ou des pantographes, et commandés en DMX par la console du plateau.
- La caméra se règle sur la lumière, pas l'inverse : on éclaire d'abord, on aligne les caméras sur une charte ensuite (la vision égalise iris, noirs et couleurs).
- Une fiche de caméra de plateau donne sa sensibilité à 2 000 lx (de l'ordre de f/10 pour une caméra 2/3", ordre de grandeur) : de quoi estimer l'iris qu'on aura à 1 000 lx, un diaph plus ouvert.`,
    car: { text: 'Dans le Labo (Jouer → Le Labo), l\'atelier Photométrie : la principale, le débouchage et la cellule sur le visage du sujet ; le rapport de contraste et l\'écart en mireds sont affichés. Au car, la vision égalise iris et couleurs des caméras ; le plateau d\'avant-match de l\'émission en direct demande le même éclairage.', station: 'vision' },
    terms: ['rapport-contraste', 'eclairement', 'temperature-couleur', 'mired', 'diaphragme', 'lumiere-douce'],
    competences: ['C31', 'C17', 'C23'], savoirs: ['G2', 'G3', 'G4'],
    quiz: [
      { q: 'Sur le visage du présentateur, la principale donne 1 000 lx et le débouchage 500 lx. Quel est le rapport de contraste ?', choices: ['3:1', ['2:1', '1 000 ÷ 500 = 2, mais le côté éclairé reçoit aussi le débouchage : (1 000 + 500) ÷ 500 = 3.'], ['1,5:1', 'Le rapport compare le côté éclairé (principale + débouchage) au côté ombre (débouchage seul), pas le total à la principale.']], answer: 0, why: 'Rapport = (E principale + E débouchage) ÷ E débouchage = 1 500 ÷ 500 = 3:1, soit log₂ 3 ≈ 1,6 diaph entre les deux côtés du visage.' },
      { q: 'Au journal, le visage de la présentatrice paraît coupé en deux, un côté presque noir. Que faites-vous ?', choices: ['Je monte le débouchage, jusqu\'à un rapport vers 2:1', ['Je baisse la principale à 10 %', 'Le visage serait sous-exposé : il faudrait ouvrir l\'iris, et l\'on retrouverait le même écart entre les deux côtés.'], ['J\'ajoute un contre-jour', 'Le contre-jour détache la personne du fond ; il n\'éclaire pas le côté ombre du visage.']], answer: 0, why: 'Le débouchage éclaircit le côté ombre : en le montant, le rapport baisse vers 2:1, un diaph, le contraste d\'un plateau d\'information.' },
      { q: 'La principale est un Fresnel halogène à 3 200 K, le débouchage un panneau LED réglé à 5 600 K. Que verra-t-on à l\'image ?', choices: ['Un côté du visage orangé, l\'autre bleuté, quelle que soit la balance des blancs', ['Rien : la balance des blancs corrige', 'La caméra ne fait qu\'une balance pour toute l\'image : elle ne peut pas corriger deux couleurs à la fois.'], ['Un visage plus contrasté', 'La couleur ne change pas le rapport de contraste ; elle ajoute une dominante différente de chaque côté.']], answer: 0, why: '3 200 et 5 600 K diffèrent d\'environ 130 mireds : bien plus que la vingtaine qui passe inaperçue. On règle le panneau bicolore à 3 200 K, ou l\'on corrige par une gélatine.' },
      { q: 'L\'invité porte des lunettes et l\'on voit le projecteur briller dans ses verres. Que faites-vous ?', choices: ['Je monte la principale ou je l\'écarte davantage sur le côté', ['Je baisse la principale au gradateur', 'Le reflet garde la même place : il est seulement moins fort, et le visage aussi.'], ['J\'ouvre le faisceau du projecteur', 'Le reflet vient de la direction de la source, pas de la largeur du faisceau.']], answer: 0, why: 'Un verre réfléchit comme un miroir, avec le même angle. En montant ou en écartant la source, le reflet sort de l\'axe de la caméra ; on peut aussi incliner légèrement les branches.' },
      { q: 'Sur un décor sombre, les cheveux bruns de l\'invitée se confondent avec le fond. Quelle lumière manque ?', choices: ['Le contre-jour, derrière et en hauteur', ['Le débouchage', 'Le débouchage éclaire le visage depuis l\'avant ; il ne dessine pas le contour des cheveux sur le fond.'], ['Plus de lumière sur le décor', 'Éclairer le fond aide, mais c\'est le contre-jour qui dessine le liseré sur les cheveux et les épaules.']], answer: 0, why: 'Le contre-jour, placé derrière la personne et en hauteur, pose un liseré lumineux sur les cheveux et les épaules : elle se détache du fond.' },
      { q: 'Le visage montre deux ombres de nez. Pourquoi ?', choices: ['Deux sources dures l\'éclairent de deux directions', ['Le débouchage est trop doux', 'Une source douce ne fait pas d\'ombre nette : c\'est justement pour cela qu\'on l\'emploie en débouchage.'], ['La caméra est trop loin', 'La distance de la caméra ne crée pas d\'ombre : ce sont les sources qui en font.']], answer: 0, why: 'Chaque source dure fait sa propre ombre. Une seule principale par visage et par axe de caméra ; les autres lumières sont douces.' },
    ],
  },
  {
    id: 'lumiere-stade', title: 'Éclairer un stade pour la télévision', minutes: '9 min',
    essentials: [
      'Pour la télévision compte l\'**éclairement vertical vers les caméras** (le visage des joueurs), pas seulement l\'horizontal au sol ; et l\'**uniformité** : **U1 = Emin ÷ Emax**, **U2 = Emin ÷ Emoy**, avec un bon **rendu des couleurs** et **une seule température**.',
      'Sur le secteur à 50 Hz, une source non lissée **varie à 100 Hz** : une image exposée un **multiple de 1/100 s** ne le voit pas, un **super ralenti** (150, 300 images/s) le montre.',
      'D\'où les projecteurs **LED sans scintillement** et les HMI à **ballast électronique** ; au car, la vision règle **shutter et iris**, le serveur de ralentis relit les caméras rapides.',
    ],
    figure: figStade,
    demoTitle: 'Source HMI à ballast magnétique : à 50 images/s, passez la pose de 1/250 à 1/100 s. Montez à 150 images/s. Changez de source. Puis, sur la pelouse, comparez l\'anneau de toit, les quatre mâts et la tribune d\'en face, en vertical puis en horizontal.',
    demo: demoStade,
    body: `Éclairer un stade pour les spectateurs et l'éclairer pour la télévision, ce n'est pas la même chose. La télévision ajoute trois exigences : de la lumière **tournée vers les caméras**, une pelouse **régulière**, et une lumière **stable** pour les ralentis.

**L'éclairement vertical.** Le luxmètre posé à plat sur la pelouse mesure l'**éclairement horizontal** (Eh) : la lumière qui tombe sur le gazon. Mais la caméra filme des joueurs debout : ce qui compte est l'**éclairement vertical** (Ev), mesuré à environ 1 m du sol sur un plan **tourné vers la caméra**. Un stade éclairé seulement depuis la tribune d'en face aurait un gazon très lumineux et des joueurs à **contre-jour** pour la caméra principale. Les guides d'éclairage des stades (UEFA, FIFA) fixent l'éclairement vertical vers les caméras fixes : de l'ordre de **1 400 à 2 000 lx** pour un stade de haut niveau, ordre de grandeur selon le niveau de la compétition. C'est pourquoi les projecteurs modernes sont répartis tout autour, sous le bord du toit, plutôt que sur quatre mâts.

**L'uniformité.** Quand le ballon traverse le terrain, la caméra le suit ; si la pelouse est inégale, l'image s'assombrit et s'éclaircit, et la vision doit corriger l'iris sans cesse. On mesure une **grille de points** (un tous les 10 m environ) et l'on calcule :
- **U1 = Emin ÷ Emax** : le point le plus sombre comparé au plus clair ;
- **U2 = Emin ÷ Emoyen** : le point le plus sombre comparé à la moyenne.

Les repères d'un stade de haut niveau sont de l'ordre de **U1 ≥ 0,5 à 0,7** et **U2 ≥ 0,7 à 0,8** (ordres de grandeur des guides). Exemple : des points entre 1 200 et 2 100 lx, moyenne 1 700 lx : U1 = 1 200 ÷ 2 100 ≈ 0,57, U2 = 1 200 ÷ 1 700 ≈ 0,71.

**Les couleurs.** L'**indice de rendu des couleurs** (IRC, ou Ra) dit si une source restitue fidèlement les couleurs : 100 pour un halogène, 80 au moins exigé dans un stade télévisé, souvent 90 au plus haut niveau (ordre de grandeur) ; la télévision a son propre indice, le **TLCI** de l'UER. La **température de couleur** doit être homogène sur tout le stade, de l'ordre de **4 000 à 6 500 K** : une tribune plus chaude que l'autre et le maillot change de couleur d'un plan à l'autre.

**Le scintillement.** Le secteur alterne à **50 Hz** : le courant passe par zéro **100 fois par seconde**. Une source qui n'est pas lissée (une lampe à iodures métalliques sur un **ballast magnétique**, une LED à l'alimentation bas de gamme) **varie donc à 100 Hz**. L'œil ne le voit pas ; la caméra, elle, découpe le temps en images. Une image exposée **1/100 s**, ou **1/50 s**, contient toujours une ou deux périodes entières : toutes les images reçoivent la même lumière. Une pose plus courte qui n'est pas un multiple de 1/100 s (1/250, 1/500) en garde une partie. Le pire arrive avec les **super ralentis** : à **150 images/s** (ralenti × 3), une image dure au plus 1/150 s, moins qu'une période. D'une image à l'autre, la lumière change, et le battement (50 Hz à la prise de vue) devient, relu à 50 images/s, un **pompage de 16,7 Hz** à l'écran. À 300 images/s, même chose.

D'où les **projecteurs LED sans scintillement** (alimentation lissée ou découpage à très haute fréquence) et les HMI sur **ballast électronique** (dit *flicker free*), exigés par les guides avec un taux de scintillement maximal, d'autant plus bas que les ralentis sont rapides. Les LED ont aussi changé le stade : allumage instantané (une lampe à iodures chaude met de l'ordre de dix minutes à se rallumer après une coupure), gradation, et **éclairage spectacle** à l'entrée des joueurs ou après un but, en couleurs, commandé comme un concert.`,
    plus: `- Répartir les projecteurs à décharge sur les **trois phases** du réseau décale leurs ondulations d'un tiers de période : là où leurs faisceaux se recouvrent, le scintillement se compense en partie. C'était la parade avant les ballasts électroniques.
- Le secteur n'est jamais exactement à 50,000 Hz : même à 50 images/s avec une pose courte, l'ondulation non effacée fait lentement pomper l'image. La pose de 1/100 s règle les deux cas.
- Un capteur CMOS à obturation déroulante (*rolling shutter*) lit les lignes l'une après l'autre : sous une lumière qui scintille, des bandes sombres défilent dans l'image au lieu d'un pompage global.
- L'étude d'éclairage d'un stade calcule chaque point de la grille, pour chaque position de caméra, avant de poser un projecteur ; les chiffres de la manipulation sont un modèle simple, des ordres de grandeur.`,
    car: { text: 'Au car, à la vision : le RCP de chaque caméra règle le shutter (OFF, 1/100, 1/250…) et l\'iris ; une pose qui n\'est pas un multiple de 1/100 s peut faire scintiller l\'image. Les caméras super ralenti sont enregistrées et relues par le serveur de ralentis (EVS). Le stade du simulateur est éclairé par des rampes LED sous le bord du toit. Dans le Labo, l\'atelier Photométrie.', station: 'vision' },
    terms: ['scintillement', 'eclairement-vertical', 'uniformite', 'eclairement', 'temperature-couleur'],
    competences: ['C21', 'C17', 'C6'], savoirs: ['G2', 'G4'],
    quiz: [
      { q: 'Le luxmètre posé à plat sur la pelouse lit 2 500 lx partout. Le réalisateur se plaint pourtant de joueurs sombres sur la caméra principale. Que s\'est-il passé ?', choices: ['L\'éclairement vertical vers la caméra est faible : la lumière vient surtout de l\'autre côté', ['La caméra est mal réglée : 2 500 lx suffisent toujours', 'L\'éclairement horizontal dit ce qui tombe sur le gazon, pas ce qui éclaire un joueur debout vu par la caméra.'], ['Le luxmètre est en panne', 'Il mesure juste : simplement, à plat, il ne mesure pas ce qui compte pour la caméra.']], answer: 0, why: 'Pour la télévision, on mesure l\'éclairement vertical, à 1 m du sol, sur un plan tourné vers la caméra. Si les projecteurs sont surtout en face, les joueurs sont à contre-jour malgré un gazon très éclairé.' },
      { q: 'Sur la grille de mesure : Emin = 900 lx, Emax = 1 800 lx, Emoyen = 1 300 lx. Que vaut U1 ?', choices: ['0,5', ['0,69', 'C\'est U2 = Emin ÷ Emoyen = 900 ÷ 1 300. U1 compare le minimum au maximum.'], ['2', 'C\'est Emax ÷ Emin : l\'uniformité se calcule dans l\'autre sens, et vaut au plus 1.']], answer: 0, why: 'U1 = Emin ÷ Emax = 900 ÷ 1 800 = 0,5 ; U2 = Emin ÷ Emoyen = 900 ÷ 1 300 ≈ 0,69. Toutes deux valent au plus 1 (un éclairage parfaitement régulier).' },
      { q: 'Au ralenti × 3 (150 images/s), l\'image pompe sous les projecteurs du stade ; en direct à 50 images/s, rien. Pourquoi ?', choices: ['À 150 images/s, la pose est plus courte qu\'une période de 1/100 s : chaque image reçoit une lumière différente', ['Le serveur de ralentis est en panne', 'Le serveur relit fidèlement ce qu\'il a enregistré : c\'est la lumière, à la prise de vue, qui changeait d\'une image à l\'autre.'], ['Les projecteurs faiblissent pendant les ralentis', 'La lumière est la même ; c\'est la façon de la découper en images qui change.']], answer: 0, why: 'La source varie à 100 Hz. À 50 images/s et 1/100 s de pose, chaque image contient une période entière : toutes sont pareilles. À 150 images/s, une image dure au plus 1/150 s : elle prend un morceau de la variation, différent à chaque image.' },
      { q: 'Au RCP, quel shutter choisir à 50 images/s sous des projecteurs qui scintillent à 100 Hz ?', choices: ['1/100 s', ['1/250 s', 'Une pose de 4 ms n\'est pas un multiple de 10 ms : elle garde une partie de l\'ondulation, et l\'image pompe.'], ['1/500 s', 'Plus la pose est courte, plus elle suit l\'ondulation : 2 ms ne contiennent qu\'un cinquième de période.']], answer: 0, why: '1/100 s contient exactement une période de la lumière (10 ms) : chaque image reçoit la même quantité. Avec le shutter sur OFF (1/50 s), deux périodes : aussi sans scintillement.' },
      { q: 'Le stade change ses lampes à iodures métalliques sur ballast magnétique pour des projecteurs LED « sans scintillement ». Qu\'y gagnent les ralentis ?', choices: ['Une lumière presque constante : plus de pompage, quelle que soit la cadence', ['Rien : les LED scintillent toujours à 100 Hz', 'Une LED à alimentation lissée (ou découpée à très haute fréquence) ne suit pas le secteur : sa lumière ne varie presque pas.'], ['Des couleurs plus chaudes', 'La température de couleur se choisit à l\'achat ; le gain pour les ralentis tient à la stabilité de la lumière.']], answer: 0, why: 'Une lumière constante ne peut pas scintiller, quelle que soit la pose ou la cadence. Les LED apportent aussi l\'allumage instantané et l\'éclairage spectacle.' },
      { q: 'Une tribune est éclairée à 4 000 K et l\'autre à 6 000 K. Que voit le téléspectateur ?', choices: ['Les maillots changent de couleur selon le côté du terrain', ['Rien : la vision fait une balance des blancs', 'La balance des blancs vaut pour toute l\'image : elle ne peut pas corriger deux couleurs différentes d\'un bout à l\'autre du terrain.'], ['Une image plus contrastée', 'C\'est la couleur qui change, pas le contraste : environ 80 mireds d\'écart entre les deux côtés.']], answer: 0, why: 'Il faut une température homogène sur tout le stade (de l\'ordre de 4 000 à 6 500 K, mais la même partout) : sinon le même maillot tire au jaune d\'un côté et au bleu de l\'autre.' },
    ],
  },
];
