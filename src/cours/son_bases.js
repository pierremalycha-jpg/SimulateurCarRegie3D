// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import { ratioDb, dbRatio, dbuVolt, dbuDbv, ECART_PRO_CONSO, sommeDb, splA, splPa, DIRECTIVITES, directivite, rho, attenuationDb, canonDb, facteurDistance, COUPLES, couple, angleEnregistrement, msVersXY, premierCreuxHz, PLEIN_DL, PLEIN_DT, residuModeCommun, perteAdaptation } from './son_calc.js';

// ----------------------------------------------------------------------------------
// Les bases du chapitre « Le son » (v19.24), avant la console : le décibel et ses références (dBu, dBV, dBFS,
// dB SPL), les micros (dynamique, statique, directivités, le canon), les couples stéréo (XY, ORTF, NOS, DIN,
// AB, Blumlein, MS : écarts de niveau et de temps, angle d'enregistrement, mono), les niveaux et les
// liaisons (micro, ligne, symétrique, XLR, impédances). Les chiffres viennent de cours/son_calc.js.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238', tally: '#f0372c', pvw: '#33c46c', white: '#e8eef2', ink: '#0b1013' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};
const signe = (v, d = 1) => (v > 0.04 ? '+' : '') + fmtNum(v, d).replace('-', '−');
const dB = (v, d = 1) => (v <= -99 ? '−∞' : signe(v, d)) + ' dB';
const polaire = (a, cx, cy, r, col, n = 120) => {
  let d = '';
  for (let i = 0; i <= n; i++) { const t = i / n * 360; const v = Math.abs(rho(a, t)) * r; const x = cx + v * Math.sin(t * Math.PI / 180), y = cy - v * Math.cos(t * Math.PI / 180); d += (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }
  return sv('path', { d: d + 'Z', fill: col, 'fill-opacity': 0.18, stroke: col, strokeWidth: 1.6 });
};

// ======================================================================================
// 1. Le décibel
// ======================================================================================
function figDecibel() {
  const f = figure(720, 250, 'Trois échelles en décibels, chacune avec sa référence : les dB SPL dans l\'air (0 dB = 20 µPa : le seuil d\'audition ; 60 une conversation ; 100 à 110 la foule d\'un stade ; 130 la douleur), les dBu sur un câble (0 dBu = 0,775 V : le niveau micro vers −50, le niveau ligne grand public −10 dBV soit −7,8 dBu, le niveau ligne professionnel +4 dBu) et les dBFS dans la console numérique (0 dBFS = la pleine échelle, l\'alignement à −18 dBFS). Le pont entre les deux dernières : 1 kHz à 0 dBu donne −18 dBFS (EBU R68).');
  f.append(txt(10, 16, 'Trois échelles, trois références', 'co-t', 'start'));
  const rows = [
    { y: 48, nom: 'dB SPL (dans l\'air, 0 dB = 20 µPa)', min: 0, max: 130, col: C.green, reperes: [[0, 'seuil'], [60, 'conversation'], [94, '1 Pa'], [105, 'foule du stade'], [130, 'douleur']] },
    { y: 118, nom: 'dBu (sur le câble, 0 dBu = 0,775 V)', min: -70, max: 30, col: C.amber, reperes: [[-50, 'micro'], [-7.8, '−10 dBV'], [0, '0,775 V'], [4, '+4 ligne pro'], [18, '0 dBFS (EBU)'], [24, '0 dBFS (SMPTE)']] },
    { y: 188, nom: 'dBFS (dans le numérique, 0 = pleine échelle)', min: -70, max: 10, col: C.cyan, reperes: [[-60, ''], [-18, 'alignement'], [-10, 'crêtes'], [-1, '−1 dBTP'], [0, 'écrêtage']] },
  ];
  for (const r of rows) {
    const X = (v) => 60 + (v - r.min) / (r.max - r.min) * 600;
    f.append(txt(60, r.y - 12, r.nom, 'co-t', 'start'), sv('line', { x1: X(r.min), y1: r.y, x2: X(r.max), y2: r.y, stroke: r.col, strokeWidth: 3 }));
    r.reperes.forEach(([v, lab], i) => f.append(sv('line', { x1: X(/** @type {number} */ (v)), y1: r.y - 6, x2: X(/** @type {number} */ (v)), y2: r.y + 6, stroke: C.white }), txt(X(/** @type {number} */ (v)), r.y + (i % 2 ? 32 : 20), `${fmtNum(/** @type {number} */ (v), v === -7.8 ? 1 : 0).replace('-', '−')}${lab ? ' · ' + lab : ''}`, 'co-s')));
  }
  // le pont EBU R68 entre dBu et dBFS
  f.append(sv('path', { d: 'M420 118 C 420 150, 380 160, 384 188', fill: 'none', stroke: C.white, strokeDasharray: '4 3' }), txt(470, 150, '1 kHz à 0 dBu = −18 dBFS (EBU R68)', 'co-s', 'start', { fill: C.white }));
  return f;
}
function demoDecibel(host) {
  let dbu = 4, n = 2, corr = false, dist = 8, spl1 = 100;
  const read = readout(['Tension', 'En dBV', 'Écart avec le niveau ligne pro (+4 dBu)', 'Rapport de tension avec 0 dBu']);
  const read2 = readout(['Somme des sources', 'Gain de la somme', 'Pression à cette distance', 'Perte par rapport à 1 m']);
  const verdict = el('p', { class: 'co-verdict' });
  const cv = canvas(720, 120, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const draw = () => {
    const v = dbuVolt(dbu);
    read.set('Tension', v >= 1 ? `${fmtNum(v, 2)} V` : `${fmtNum(v * 1000, v < 0.01 ? 2 : 0)} mV`);
    read.set('En dBV', `${signe(dbuDbv(dbu))} dBV`);
    read.set('Écart avec le niveau ligne pro (+4 dBu)', `${dB(dbu - 4)}${Math.abs(dbu + 7.8) < 0.3 ? ' : le niveau grand public (−10 dBV)' : ''}`);
    read.set('Rapport de tension avec 0 dBu', `× ${fmtNum(dbRatio(dbu), dbu < -20 ? 4 : 2)}`);
    const s = sommeDb(Array(n).fill(spl1), corr);
    read2.set('Somme des sources', `${n} source${n > 1 ? 's' : ''} à ${spl1} dB SPL → ${fmtNum(s, 1)} dB SPL`);
    read2.set('Gain de la somme', `${dB(s - spl1)} (${corr ? 'amplitudes additionnées, 20 log' : 'puissances additionnées, 10 log'})`);
    const sd = splA(spl1, 1, dist);
    read2.set('Pression à cette distance', `${fmtNum(sd, 1)} dB SPL à ${dist} m, soit ${fmtNum(splPa(sd) * 1000, 1)} mPa`);
    read2.set('Perte par rapport à 1 m', `${dB(sd - spl1)} : −6 dB par doublement de distance`);
    verdict.className = 'co-verdict ' + (dbu > 24 ? 'ko' : dbu > 18 ? 'warn' : 'ok');
    verdict.textContent = dbu > 24 ? 'Au-delà de +24 dBu : aucune entrée ligne ne tient, le convertisseur écrête.' : dbu > 18 ? 'Entre +18 et +24 dBu : c\'est 0 dBFS pour une console alignée EBU (−18 dBFS = 0 dBu) ; il reste de la marge sur une console alignée SMPTE (−20 dBFS = +4 dBu).' : dbu >= -20 ? 'Un niveau ligne : il entre sur une entrée ligne, sans préampli.' : 'Un niveau micro : il faut un préamplificateur (40 à 60 dB de gain) pour arriver au niveau ligne.';
    // la courbe 20 log : la tension en fonction des dB
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 120);
    g.strokeStyle = '#3a444c'; g.beginPath(); g.moveTo(40, 100); g.lineTo(700, 100); g.moveTo(40, 10); g.lineTo(40, 100); g.stroke();
    g.fillStyle = '#aab4ba'; g.font = '11px Arial, sans-serif'; g.fillText('tension (V) en fonction du niveau en dBu : chaque +6 dB double la tension, chaque +20 dB la multiplie par 10', 46, 12);
    const X = (d) => 40 + (d + 70) / 100 * 660, Y = (v) => 100 - Math.min(1, v / 12.3) * 84;
    g.strokeStyle = C.amber; g.lineWidth = 1.6; g.beginPath(); for (let d = -70; d <= 30; d += 0.5) g[d === -70 ? 'moveTo' : 'lineTo'](X(d), Y(dbuVolt(d))); g.stroke();
    for (const d of [-60, -40, -20, 0, 4, 20]) { g.fillStyle = '#6f7a84'; g.fillText(`${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}`, X(d) - 8, 114); }
    g.fillStyle = C.white; g.beginPath(); g.arc(X(dbu), Y(dbuVolt(dbu)), 4, 0, 7); g.fill();
    g.fillText(`${signe(dbu, 0)} dBu = ${fmtNum(dbuVolt(dbu), 3)} V`, Math.min(X(dbu) + 8, 560), Y(dbuVolt(dbu)) - 6);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Niveau sur le câble', -70, 30, dbu, 1, (v) => { dbu = v; draw(); }, (v) => `${signe(v, 0)} dBu`)),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'La courbe du 20 log : les décibels compriment des rapports de tension de 1 à 10 000 sur une échelle lisible.')),
    verdict, read.el,
    el('div', { class: 'co-ctl' },
      slider('Sources identiques additionnées', 1, 8, n, 1, (v) => { n = v; draw(); }),
      choice('Les sources sont', [['non', 'indépendantes (deux micros)'], ['oui', 'le même signal (corrélées)']], 'non', (v) => { corr = v === 'oui'; draw(); }),
      slider('Distance à la source', 1, 64, dist, 1, (v) => { dist = v; draw(); }, (v) => `${v} m`),
      slider('Niveau à 1 m', 70, 120, spl1, 1, (v) => { spl1 = v; draw(); }, (v) => `${v} dB SPL`)),
    read2.el);
  draw();
}

// ======================================================================================
// 2. Les micros
// ======================================================================================
function figMicros() {
  const f = figure(720, 250, 'Les diagrammes de directivité des micros, vus de dessus (le micro regarde vers le haut) : l\'omnidirectionnel capte tout autour ; le cardioïde perd 6 dB à 90° et presque tout à l\'arrière ; l\'hypercardioïde est plus étroit devant mais reprend un petit lobe arrière ; le bidirectionnel (en 8) capte devant et derrière, rien sur les côtés. Le canon ajoute à une capsule hypercardioïde un tube à fentes qui resserre encore l\'aigu. À droite, les deux familles de transducteurs : le dynamique (bobine mobile dans un aimant, pas d\'alimentation) et le statique (condensateur, alimentation fantôme 48 V, plus sensible).');
  f.append(txt(10, 16, 'La directivité : d\'où le micro écoute', 'co-t', 'start'));
  const pats = [['omni', C.grey], ['cardio', C.amber], ['hyper', C.cyan], ['bidir', C.green]];
  pats.forEach(([id, col], i) => {
    const cx = 70 + i * 120, cy = 126, r = 44, d = directivite(id);
    for (const rr of [r, r * dbRatio(-6), r * dbRatio(-12)]) f.append(sv('circle', { cx, cy, r: rr, fill: 'none', stroke: C.line }));
    f.append(sv('line', { x1: cx, y1: cy - r, x2: cx, y2: cy + r, stroke: C.line }), sv('line', { x1: cx - r, y1: cy, x2: cx + r, y2: cy, stroke: C.line }));
    f.append(polaire(d.a, cx, cy, r, col), txt(cx, cy + r + 20, d.nom, 'co-t'), txt(cx, cy + r + 34, `−6 dB à ${id === 'omni' ? 'nulle part' : id === 'cardio' ? '90°' : id === 'hyper' ? '70°' : '60°'}`, 'co-s'));
  });
  f.append(txt(70, 70, '0° (devant)', 'co-s'), txt(310, 70, 'cercles : 0, −6, −12 dB', 'co-s'));
  // les deux transducteurs
  f.append(box(520, 36, 190, 86, C.grey), txt(615, 54, 'Dynamique', 'co-t'), txt(615, 70, 'bobine mobile + aimant', 'co-s'), txt(615, 84, 'sans alimentation · 1 à 3 mV/Pa', 'co-s'), txt(615, 98, 'robuste, micro-casques, reporter', 'co-s'), txt(615, 112, 'moins fin dans l\'aigu', 'co-s'));
  f.append(box(520, 134, 190, 86, C.amber), txt(615, 152, 'Statique (condensateur)', 'co-t'), txt(615, 168, 'membrane + électronique', 'co-s'), txt(615, 182, 'alimentation 48 V · 10 à 40 mV/Pa', 'co-s'), txt(615, 196, 'canons, couples d\'ambiance', 'co-s'), txt(615, 210, 'fin, sensible, craint l\'humidité', 'co-s'));
  return f;
}
function demoMicros(host) {
  let pat = 'cardio', theta = 90, f = 1000, mode = 'simple';
  const cv = canvas(720, 230, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Atténuation à cet angle', 'Le canon à cet angle, selon la fréquence', 'Efficacité en champ diffus', 'Facteur de distance']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const d = directivite(pat);
    const att = mode === 'canon' ? canonDb(theta, f) : attenuationDb(d.a, theta);
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 230);
    const cx = 150, cy = 118, r = 90;
    g.strokeStyle = '#2a3238'; for (const rr of [r, r * dbRatio(-6), r * dbRatio(-12), r * dbRatio(-20)]) { g.beginPath(); g.arc(cx, cy, rr, 0, 7); g.stroke(); }
    g.beginPath(); g.moveTo(cx, cy - r); g.lineTo(cx, cy + r); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.stroke();
    g.fillStyle = '#6f7a84'; g.font = '11px Arial, sans-serif'; g.fillText('0°', cx - 6, cy - r - 4); g.fillText('90°', cx + r + 4, cy + 4); g.fillText('180°', cx - 14, cy + r + 14); g.fillText('−6', cx + 2, cy - r * dbRatio(-6) + 10); g.fillText('−12', cx + 2, cy - r * dbRatio(-12) + 10);
    const trace = (fn, col) => { g.strokeStyle = col; g.lineWidth = 1.8; g.beginPath(); for (let t = 0; t <= 360; t += 2) { const v = Math.max(0, 1 + fn(t) / 40) * r; const x = cx + v * Math.sin(t * Math.PI / 180), y = cy - v * Math.cos(t * Math.PI / 180); g[t ? 'lineTo' : 'moveTo'](x, y); } g.closePath(); g.stroke(); };
    if (mode === 'canon') { trace((t) => canonDb(t, 200), '#6f7a84'); trace((t) => canonDb(t, f), C.amber); } else trace((t) => attenuationDb(d.a, t), C.amber);
    // la source
    const sx = cx + (r + 14) * Math.sin(theta * Math.PI / 180), sy = cy - (r + 14) * Math.cos(theta * Math.PI / 180);
    g.fillStyle = C.white; g.beginPath(); g.arc(sx, sy, 5, 0, 7); g.fill();
    g.strokeStyle = C.white; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(cx, cy); g.lineTo(sx, sy); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#aab4ba'; g.fillText(mode === 'canon' ? `canon (hypercardioïde + tube de 25 cm) : gris à 200 Hz, ambre à ${f >= 1000 ? fmtNum(f / 1000, f % 1000 ? 1 : 0) + ' kHz' : f + ' Hz'}` : d.nom, 300, 30);
    g.fillText('échelle : 0 dB au bord, −40 dB au centre', 300, 48);
    // la réponse en fonction de l'angle, en barres
    const X = (t) => 300 + t / 180 * 400;
    g.strokeStyle = '#3a444c'; g.beginPath(); g.moveTo(300, 200); g.lineTo(700, 200); g.stroke();
    for (let t = 0; t <= 180; t += 3) { const v = mode === 'canon' ? canonDb(t, f) : attenuationDb(d.a, t); const h = Math.max(0, 40 + v) / 40 * 120; g.fillStyle = Math.abs(t - theta) < 2 ? C.white : C.amber; g.fillRect(X(t), 200 - h, 5, h); }
    for (const t of [0, 45, 90, 135, 180]) g.fillText(`${t}°`, X(t) - 6, 214);
    g.fillStyle = '#aab4ba'; g.fillText('atténuation de 0° à 180° (0 à −40 dB)', 300, 80);
    read.set('Atténuation à cet angle', `${dB(att)} à ${theta}°${att <= -40 ? ' : presque rien' : ''}`);
    read.set('Le canon à cet angle, selon la fréquence', `200 Hz : ${dB(canonDb(theta, 200))} · 1 kHz : ${dB(canonDb(theta, 1000))} · 8 kHz : ${dB(canonDb(theta, 8000))}`);
    const fd = facteurDistance(d.a);
    read.set('Efficacité en champ diffus', mode === 'canon' ? 'plus étroit encore que l\'hypercardioïde dans l\'aigu' : `${fmtNum(fd.ree * 100, 0)} % de ce que capte un omni (${dB(fd.reeDb)})`);
    read.set('Facteur de distance', mode === 'canon' ? '≥ 2 (l\'hypercardioïde de sa capsule)' : `× ${fmtNum(fd.facteur, 1)} : à ${fmtNum(fd.facteur, 1)} m, autant de réverbération qu'un omni à 1 m`);
    verdict.className = 'co-verdict ' + (att > -3 ? 'ok' : att > -12 ? 'warn' : 'ok');
    verdict.textContent = theta === 0 ? 'Dans l\'axe : le micro donne tout.' : att > -3 ? 'Presque dans l\'axe : à peine atténué.' : att > -12 ? `Hors axe : ${dB(att)}, la source reste présente mais plus sourde (le timbre change hors axe, surtout sur un canon).` : `Bien rejeté : ${dB(att)}. ${mode === 'canon' ? 'Dans le grave, le tube ne sert à rien : regardez le 200 Hz.' : pat === 'cardio' && theta > 150 ? 'C\'est l\'arrière du cardioïde : là où l\'on met le retour, ou la foule.' : ''}`;
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Micro', [['simple', 'une capsule'], ['canon', 'un canon (tube)']], 'simple', (v) => { mode = v; draw(); }),
      choice('Diagramme', DIRECTIVITES.filter((d) => d.id !== 'large').map((d) => [d.id, d.nom]), 'cardio', (v) => { pat = v; draw(); }),
      slider('Angle de la source', 0, 180, theta, 1, (v) => { theta = v; draw(); }, (v) => `${v}°`),
      slider('Fréquence (canon)', 100, 12000, f, 100, (v) => { f = v; draw(); }, (v) => (v >= 1000 ? `${fmtNum(v / 1000, v % 1000 ? 1 : 0)} kHz` : `${v} Hz`))),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le diagramme polaire (vue de dessus, 0° devant) et l\'atténuation angle par angle. Pour le canon, la courbe grise est sa directivité à 200 Hz : dans le grave, le tube n\'agit pas.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 3. Les couples stéréo
// ======================================================================================
function figStereo() {
  const f = figure(720, 262, 'Quatre couples stéréo vus de dessus, la scène vers le haut. XY : deux cardioïdes coïncidents à 90°, l\'image ne tient qu\'aux écarts de niveau. ORTF : deux cardioïdes écartés de 17 cm et ouverts à 110°, comme deux oreilles : écarts de niveau et de temps. AB : deux omnis parallèles écartés de 40 à 60 cm, l\'image ne tient qu\'aux écarts de temps. MS : un cardioïde M vers la scène et un micro en 8 S tourné vers les côtés ; la matrice fabrique L = M + S et R = M − S, et la largeur se règle avec le niveau du S. En dessous, la règle : vers 15 dB d\'écart de niveau ou 1,1 ms d\'écart de temps, la source est entièrement sur un haut-parleur.');
  f.append(txt(10, 16, 'Quatre couples, vus de dessus (la scène est en haut)', 'co-t', 'start'));
  const caps = (cx, cy, ang, dx, a, col) => {
    const g = sv('g', {});
    for (const s of [-1, 1]) {
      const x = cx + s * dx, t = s * ang / 2;
      const p = polaire(a, x, cy, 30, col); p.setAttribute('transform', `rotate(${t} ${x} ${cy})`); g.append(p);
      g.append(sv('line', { x1: x, y1: cy, x2: x + 36 * Math.sin(t * Math.PI / 180), y2: cy - 36 * Math.cos(t * Math.PI / 180), stroke: C.white, strokeWidth: 1.2 }));
      g.append(sv('circle', { cx: x, cy, r: 4, fill: C.white }));
    }
    return g;
  };
  const items = [
    { x: 90, nom: 'XY 90°', sous: 'coïncident, cardioïdes', ang: 90, dx: 0, a: 0.5, col: C.amber, note: 'niveau seul' },
    { x: 270, nom: 'ORTF', sous: '17 cm, 110°, cardioïdes', ang: 110, dx: 14, a: 0.5, col: C.cyan, note: 'niveau + temps' },
    { x: 450, nom: 'AB 50 cm', sous: 'omnis parallèles', ang: 0, dx: 40, a: 1, col: C.green, note: 'temps seul' },
  ];
  for (const it of items) {
    f.append(caps(it.x, 112, it.ang, it.dx, it.a, it.col), txt(it.x, 170, it.nom, 'co-t'), txt(it.x, 184, it.sous, 'co-s'), txt(it.x, 198, it.note, 'co-s', 'middle', { fill: it.col }));
    if (it.dx) f.append(sv('line', { x1: it.x - it.dx, y1: 150, x2: it.x + it.dx, y2: 150, stroke: C.grey, strokeDasharray: '3 2' }), txt(it.x, 160, it.dx === 14 ? '17 cm' : '50 cm', 'co-s'));
  }
  // MS
  const mx = 630, my = 112;
  const m = polaire(0.5, mx, my, 30, C.amber); f.append(m);
  const s8 = polaire(0, mx, my, 30, C.red); s8.setAttribute('transform', `rotate(90 ${mx} ${my})`); f.append(s8);
  f.append(sv('circle', { cx: mx, cy: my, r: 4, fill: C.white }), txt(mx, 170, 'MS', 'co-t'), txt(mx, 184, 'M cardioïde + S en 8', 'co-s'), txt(mx, 198, 'L = M + S · R = M − S', 'co-s', 'middle', { fill: C.amber }));
  f.append(txt(10, 236, `La règle : vers ${PLEIN_DL} dB d'écart de niveau, ou ${fmtNum(PLEIN_DT, 1)} ms d'écart de temps, la source est sur un seul haut-parleur ; en dessous, elle se place entre les deux.`, 'co-s', 'start'));
  f.append(txt(10, 252, 'Un couple espacé qui s\'écarte, ou un couple coïncident qui s\'ouvre, resserre son angle d\'enregistrement : la scène s\'étale davantage entre les enceintes.', 'co-s', 'start'));
  return f;
}
function demoStereo(host) {
  let id = 'ortf', phi = 30, gS = 1;
  const cv = canvas(720, 250, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Écart de niveau entre les voies', 'Écart de temps entre les voies', 'Position de l\'image', 'Angle d\'enregistrement du couple', 'En mono (L + R)', 'MS décodé : l\'équivalent XY']);
  const verdict = el('p', { class: 'co-verdict' });
  const cfg = () => { const c = /** @type {any} */ (COUPLES.find((x) => x.id === id)); return c.genre === 'ms' ? { ...c, gS } : c; };
  const draw = () => {
    const c = cfg(), r = couple(c, phi), sra = angleEnregistrement(c);
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 250);
    // vue de dessus : les capsules et la source
    const cx = 170, cy = 150, R = 60, a = directivite(c.a).a;
    g.strokeStyle = '#2a3238'; g.beginPath(); g.arc(cx, cy, R + 50, 0, 7); g.stroke();
    const dx = c.genre === 'ms' ? 0 : c.d / 0.6 * 70;
    const pat = (x, ang, aa, col) => { g.strokeStyle = col; g.lineWidth = 1.6; g.beginPath(); for (let t = 0; t <= 360; t += 3) { const v = Math.abs(rho(aa, t)) * R * 0.5; const tt = (t + ang) * Math.PI / 180; g[t ? 'lineTo' : 'moveTo'](x + v * Math.sin(tt), cy - v * Math.cos(tt)); } g.closePath(); g.stroke(); };
    if (c.genre === 'ms') { pat(cx, 0, a, C.amber); pat(cx, 90, 0, C.red); } else { pat(cx - dx, -c.angle / 2, a, C.amber); pat(cx + dx, c.angle / 2, a, C.cyan); }
    const sx = cx - (R + 40) * Math.sin(phi * Math.PI / 180), sy = cy - (R + 40) * Math.cos(phi * Math.PI / 180); // positif à gauche
    g.fillStyle = C.white; g.beginPath(); g.arc(sx, sy, 6, 0, 7); g.fill(); g.font = '11px Arial, sans-serif'; g.fillText(`source à ${Math.abs(phi)}° ${phi > 0 ? 'à gauche' : phi < 0 ? 'à droite' : 'dans l\'axe'}`, 10, 16);
    if (sra) { g.strokeStyle = 'rgba(127,209,160,.6)'; g.setLineDash([4, 3]); for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - s * 118 * Math.sin(sra / 2 * Math.PI / 180), cy - 118 * Math.cos(sra / 2 * Math.PI / 180)); g.stroke(); } g.setLineDash([]); g.fillStyle = C.green; g.fillText(`angle d'enregistrement ${fmtNum(sra, 0)}°`, 10, 34); }
    // l'image entre les enceintes
    const lx = 380, rx = 680, y = 110;
    g.fillStyle = '#aab4ba'; g.fillText('l\'image entre les deux haut-parleurs', 380, 60);
    g.fillStyle = '#1a2026'; g.fillRect(lx, y - 10, rx - lx, 20); g.fillStyle = '#6f7a84'; g.fillText('G', lx - 14, y + 4); g.fillText('D', rx + 6, y + 4);
    const ix = lx + (1 - (r.pos + 100) / 200) * (rx - lx);
    g.fillStyle = C.white; g.beginPath(); g.arc(ix, y, 7, 0, 7); g.fill();
    g.fillStyle = '#aab4ba'; g.fillText(`${fmtNum(Math.abs(r.pos), 0)} % ${r.pos > 0 ? 'à gauche' : r.pos < 0 ? 'à droite' : 'au centre'}`, ix - 30, y + 28);
    // les deux contributions
    const bar = (yy, lab, v, full, col) => { g.fillStyle = '#aab4ba'; g.fillText(lab, 380, yy - 4); g.fillStyle = '#1a2026'; g.fillRect(380, yy, 300, 10); g.fillStyle = col; const w = Math.min(1, Math.abs(v) / full) * 300; g.fillRect(380, yy, w, 10); };
    bar(166, `écart de niveau : ${dB(r.dL)} (plein à ${PLEIN_DL} dB)`, r.dL, PLEIN_DL, C.amber);
    bar(206, `écart de temps : ${fmtNum(Math.abs(r.dt), 2)} ms (plein à ${fmtNum(PLEIN_DT, 1)} ms)`, r.dt, PLEIN_DT, C.cyan);
    read.set('Écart de niveau entre les voies', `${dB(r.dL)} ${c.genre === 'espace' && c.a === 'omni' ? '(deux omnis : aucun)' : ''}`);
    read.set('Écart de temps entre les voies', c.genre === 'espace' ? `${fmtNum(Math.abs(r.dt), 2)} ms : ${fmtNum(c.d * 100, 0)} cm × sin ${Math.abs(phi)}° / 343 m/s` : 'aucun : capsules coïncidentes');
    read.set('Position de l\'image', `${fmtNum(Math.abs(r.pos), 0)} % ${r.pos > 0 ? 'vers la gauche' : r.pos < 0 ? 'vers la droite' : ''}${Math.abs(r.pos) >= 100 ? ' : sur un seul haut-parleur' : ''}`);
    read.set('Angle d\'enregistrement du couple', sra ? `${fmtNum(sra, 0)}° : une source à ±${fmtNum(sra / 2, 0)}° est sur un seul haut-parleur` : 'plus de 180° : même une source de côté reste entre les enceintes (image resserrée)');
    const creux = premierCreuxHz(r.dt);
    read.set('En mono (L + R)', c.genre === 'espace' ? (Number.isFinite(creux) ? `filtre en peigne : premier creux à ${creux >= 1000 ? fmtNum(creux / 1000, 1) + ' kHz' : fmtNum(creux, 0) + ' Hz'} pour cette source` : 'source dans l\'axe : pas de creux') : c.genre === 'ms' ? 'parfait : le S s\'annule, il reste le M' : 'parfait : capsules coïncidentes, aucun déphasage');
    const eq = msVersXY(gS, directivite(c.a).a);
    read.set('MS décodé : l\'équivalent XY', c.genre === 'ms' ? `deux ${eq.nom.toLowerCase()}s virtuels ouverts à ${fmtNum(eq.angle, 0)}° (S à ${dB(ratioDb(gS))} du M)` : '—');
    verdict.className = 'co-verdict ' + (Math.abs(r.pos) >= 100 ? 'warn' : 'ok');
    verdict.textContent = Math.abs(r.pos) >= 100 ? 'Cette source sort de l\'angle d\'enregistrement : elle est collée sur un haut-parleur. Un couple moins espacé ou moins ouvert l\'y ramènerait.' : c.genre === 'coincident' ? 'Un couple coïncident : l\'image ne tient qu\'aux écarts de niveau ; en mono, rien ne se creuse.' : c.genre === 'ms' ? 'Le MS : la largeur se règle après coup avec le niveau du S, et le mono est le M tel quel.' : c.a === 'omni' ? 'Deux omnis espacés : l\'image ne tient qu\'aux écarts de temps ; ample, mais le mono se creuse (peigne).' : 'Niveau et temps à la fois : l\'image est stable et naturelle, comme deux oreilles.';
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Couple', COUPLES.map((c) => [c.id, c.nom, c.sous]), id, (v) => { id = v; draw(); }),
      slider('Azimut de la source', -90, 90, phi, 1, (v) => { phi = v; draw(); }, (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}°`),
      slider('Niveau du S (couple MS)', 0, 2, gS, 0.1, (v) => { gS = v; draw(); }, (v) => (v ? dB(ratioDb(v)) + ' du M' : 'coupé (mono)'))),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'À gauche, le couple vu de dessus (la scène en haut), la source et l\'angle d\'enregistrement en pointillés ; à droite, où l\'image se place entre les haut-parleurs, et la part de l\'écart de niveau et de l\'écart de temps.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 4. Niveaux et liaisons
// ======================================================================================
function figLiaisons() {
  const f = figure(720, 236, 'Une liaison symétrique : le signal part en opposition sur deux conducteurs (point chaud, point froid) entourés d\'un blindage à la masse ; un parasite capté en route est identique sur les deux fils, et l\'entrée différentielle, qui soustrait un fil à l\'autre, le rejette. Le connecteur XLR : broche 1 masse, 2 point chaud, 3 point froid. En dessous, les trois niveaux : micro (quelques millivolts), ligne grand public −10 dBV (0,32 V), ligne professionnelle +4 dBu (1,23 V), séparés de 11,8 dB.');
  f.append(txt(10, 16, 'La liaison symétrique : le parasite se retire de lui-même', 'co-t', 'start'));
  f.append(box(10, 34, 90, 54, C.grey), txt(55, 56, 'Source', 'co-t'), txt(55, 72, 'micro, console', 'co-s'));
  f.append(box(560, 34, 150, 54, C.amber), txt(635, 52, 'Entrée différentielle', 'co-t'), txt(635, 68, 'sortie = chaud − froid', 'co-s'), txt(635, 82, 'réjection 60 à 80 dB', 'co-s'));
  f.append(sv('line', { x1: 100, y1: 48, x2: 560, y2: 48, stroke: C.amber, strokeWidth: 2 }), txt(330, 44, '2 · point chaud : +signal + parasite', 'co-s'));
  f.append(sv('line', { x1: 100, y1: 74, x2: 560, y2: 74, stroke: C.cyan, strokeWidth: 2 }), txt(330, 88, '3 · point froid : −signal + parasite', 'co-s'));
  f.append(sv('rect', { x: 100, y: 38, width: 460, height: 46, fill: 'none', stroke: C.grey, strokeDasharray: '4 3' }), txt(330, 104, '1 · blindage à la masse', 'co-s'));
  f.append(arrow(330, 128, 330, 100, C.red), txt(330, 142, 'parasite (50 Hz, gradateurs, émetteur) : le même sur les deux fils', 'co-s', 'middle', { fill: C.red }));
  f.append(txt(635, 110, '(+s + p) − (−s + p) = 2 s', 'co-m'));
  // les niveaux
  const Y = 196, X = (d) => 60 + (d + 70) / 100 * 640;
  f.append(txt(10, Y - 26, 'Les trois niveaux sur un câble (en dBu)', 'co-t', 'start'));
  f.append(sv('line', { x1: X(-70), y1: Y, x2: X(30), y2: Y, stroke: C.grey, strokeWidth: 3 }));
  for (const [v, lab, col] of [[-50, 'micro : −60 à −40 dBu, quelques mV', C.cyan], [-7.8, '−10 dBV grand public (0,32 V)', C.amber], [4, '+4 dBu pro (1,23 V)', C.green], [24, '+24 dBu : le maximum des sorties pro', C.red]]) {
    f.append(sv('line', { x1: X(/** @type {number} */ (v)), y1: Y - 8, x2: X(/** @type {number} */ (v)), y2: Y + 8, stroke: /** @type {string} */ (col), strokeWidth: 2 }), txt(X(/** @type {number} */ (v)), Y + (v === 4 ? 34 : 22), /** @type {string} */ (lab), 'co-s', v === 24 ? 'end' : v === -50 ? 'start' : 'middle'));
  }
  f.append(sv('path', { d: `M${X(-7.8)} ${Y - 12} V${Y - 18} H${X(4)} V${Y - 12}`, fill: 'none', stroke: C.white }), txt((X(-7.8) + X(4)) / 2, Y - 22, '11,8 dB', 'co-s', 'middle', { fill: C.white }));
  return f;
}
function demoLiaisons(host) {
  let niveau = 4, longueur = 30, sym = true, cmrr = 70, zs = 150, zc = 1500;
  const read = readout(['Signal utile', 'Parasite capté sur le câble', 'Parasite après l\'entrée', 'Rapport signal / parasite', 'Adaptation : perte sur la charge', 'Grand public → entrée pro']);
  const verdict = el('p', { class: 'co-verdict' });
  const cv = canvas(720, 110, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const draw = () => {
    const sV = dbuVolt(niveau) * 1000; // mV
    const pMv = 0.6 * longueur; // ordre de grandeur : 0,6 mV de ronflette captée par mètre de câble non blindé près d'un gradateur
    const residu = sym ? residuModeCommun(pMv, cmrr) : pMv;
    const snr = ratioDb(sV / residu);
    read.set('Signal utile', `${signe(niveau, 0)} dBu = ${sV >= 1000 ? fmtNum(sV / 1000, 2) + ' V' : fmtNum(sV, 1) + ' mV'}`);
    read.set('Parasite capté sur le câble', `${fmtNum(pMv, 1)} mV sur ${longueur} m (ordre de grandeur, à côté d'un gradateur)`);
    read.set('Parasite après l\'entrée', sym ? `${fmtNum(residu, residu < 0.01 ? 4 : 2)} mV : rejeté de ${cmrr} dB` : `${fmtNum(residu, 1)} mV : rien ne le rejette`);
    read.set('Rapport signal / parasite', `${fmtNum(snr, 0)} dB${snr < 40 ? ' : audible' : snr < 60 ? ' : juste' : ' : inaudible'}`);
    read.set('Adaptation : perte sur la charge', `source ${zs} Ω sur ${zc} Ω : ${dB(perteAdaptation(zs, zc))}${zc >= 10 * zs ? ' (pontage : charge ≥ 10 × source)' : zc <= zs ? ' : la moitié de la tension est perdue' : ''}`);
    read.set('Grand public → entrée pro', `−10 dBV arrive ${fmtNum(ECART_PRO_CONSO, 1)} dB sous +4 dBu : à rattraper par le gain de l'entrée, pas par le câble`);
    verdict.className = 'co-verdict ' + (snr >= 60 ? 'ok' : snr >= 40 ? 'warn' : 'ko');
    verdict.textContent = snr >= 60 ? 'Propre : le parasite est sous le bruit de fond.' : snr >= 40 ? 'Limite : on entend la ronflette dans les silences.' : `Ronflette audible. ${sym ? 'Montez le niveau à la source (préampli au plus près du micro) ou raccourcissez le câble.' : 'Passez en symétrique : le même câble rejetterait le parasite.'}`;
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 110);
    const n = 600, X = (i) => 20 + i / n * 680;
    const trace = (fn, y0, amp, col) => { g.strokeStyle = col; g.lineWidth = 1.3; g.beginPath(); for (let i = 0; i < n; i++) g[i ? 'lineTo' : 'moveTo'](X(i), y0 - fn(i / n) * amp); g.stroke(); };
    const sig = (t) => Math.sin(2 * Math.PI * 24 * t) * 0.7;
    const hum = (t) => Math.sin(2 * Math.PI * 3 * t);
    g.font = '11px Arial, sans-serif'; g.fillStyle = '#aab4ba'; g.fillText('sur le câble : signal + ronflette 50 Hz', 20, 14); g.fillText('après l\'entrée', 380, 14);
    const k = Math.min(1.2, pMv / sV);
    trace((t) => sig(t) + hum(t) * k * 0.8, 60, 30, C.amber);
    const k2 = Math.min(1.2, residu / sV);
    g.save(); g.beginPath(); g.rect(360, 0, 360, 110); g.clip(); trace((t) => sig(t) + hum(t) * k2 * 0.8, 60, 30, sym ? C.green : C.red); g.restore();
    g.fillStyle = '#3a444c'; g.fillRect(358, 20, 2, 80);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Niveau à la source', [['-50', 'micro (−50 dBu)'], ['-7.8', 'grand public (−10 dBV)'], ['4', 'ligne pro (+4 dBu)']], '4', (v) => { niveau = +v; draw(); }),
      slider('Longueur du câble', 1, 100, longueur, 1, (v) => { longueur = v; draw(); }, (v) => `${v} m`),
      choice('Liaison', [['sym', 'symétrique (XLR)'], ['asym', 'asymétrique (RCA, jack mono)']], 'sym', (v) => { sym = v === 'sym'; draw(); }),
      slider('Réjection de mode commun de l\'entrée', 40, 90, cmrr, 1, (v) => { cmrr = v; draw(); }, (v) => `${v} dB`),
      choice('Impédances source → charge', [['150-1500', '150 Ω → 1,5 kΩ'], ['150-10000', '150 Ω → 10 kΩ'], ['600-600', '600 Ω → 600 Ω'], ['150-150', '150 Ω → 150 Ω']], '150-1500', (v) => { [zs, zc] = v.split('-').map(Number); draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le même câble, avant et après l\'entrée : en symétrique, la ronflette (la grande ondulation lente) disparaît ; en asymétrique, elle reste.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// les leçons
// ======================================================================================
/** @type {import('./index.js').Lesson[]} */
export const SON_BASES = [
  {
    id: 'son-decibel', title: 'Le décibel : dBu, dBFS, dB SPL', minutes: '7 min',
    essentials: [
      'Le **décibel** compare deux grandeurs : **20 log** du rapport des tensions ou des pressions, **10 log** du rapport des puissances ; **+6 dB** = tension doublée, **+3 dB** = puissance doublée (deux sources indépendantes).',
      'Un niveau en dB a toujours une **référence** : **dBu** (0,775 V sur le câble), **dBV** (1 V), **dBFS** (la pleine échelle du numérique), **dB SPL** (20 µPa dans l\'air).',
      'Le car passe d\'une échelle à l\'autre : **+4 dBu** en ligne, **−18 dBFS** à l\'alignement (1 kHz à 0 dBu = −18 dBFS, EBU R68), la foule du stade vers 100 à 110 dB SPL.',
    ],
    figure: figDecibel,
    demoTitle: 'Montez le niveau sur le câble jusqu\'à +4 dBu, puis à −50 dBu (un micro) et lisez la tension. Additionnez deux sources, indépendantes puis identiques. Éloignez-vous de la source : −6 dB par doublement.',
    demo: demoDecibel,
    body: `L'oreille entend des rapports, pas des différences : passer de 1 à 2 V se perçoit comme passer de 2 à 4 V. Le **décibel** suit cette logique. C'est un **rapport** écrit en logarithme, et il n'a de sens qu'entre deux grandeurs : 20 × log₁₀ (V₁ ÷ V₂) pour des **tensions** ou des **pressions** (ce que donnent un micro et un câble), 10 × log₁₀ (P₁ ÷ P₂) pour des **puissances**. Les deux disent la même chose, parce qu'une puissance est le carré d'une tension : doubler la tension, c'est +6 dB, et c'est aussi quadrupler la puissance, +6 dB encore. À retenir : **+6 dB = × 2** en tension, **+20 dB = × 10**, **+3 dB** = la puissance doublée (deux sources indépendantes de même niveau, deux micros d'ambiance par exemple), **+6 dB** = le même signal deux fois (deux voies identiques additionnées en mono).

Un nombre de dB tout seul ne dit rien : il faut sa **référence**. Sur un câble, le **dBu** prend 0,775 V pour 0 (la tension qui dissipe 1 mW dans 600 Ω, héritage du téléphone) : le niveau ligne professionnel est **+4 dBu** (1,23 V), un micro donne de −60 à −40 dBu (quelques millivolts). Le **dBV** prend 1 V pour 0 : le niveau ligne grand public est **−10 dBV** (0,316 V, soit −7,8 dBu), 11,8 dB sous le niveau pro. Dans la console numérique, le **dBFS** compte vers le bas depuis la **pleine échelle** (0 dBFS, le plus grand nombre que le convertisseur sait écrire) : l'alignement est à **−18 dBFS** en Europe (EBU R68 : 1 kHz à 0 dBu donne −18 dBFS, et 0 dBFS vaut donc +18 dBu) et à −20 dBFS aux États-Unis (SMPTE RP 155 : +4 dBu à −20 dBFS, 0 dBFS vaut +24 dBu). Dans l'air, le **dB SPL** (sound pressure level) prend 20 µPa pour 0, le seuil d'audition : 60 dB SPL une conversation, **94 dB SPL = 1 Pa** (le calibreur des sonomètres), 100 à 110 dB SPL la foule d'un stade, 130 la douleur. La sensibilité d'un micro se donne en **mV/Pa** : 2 mV/Pa pour un dynamique, 20 mV/Pa pour un statique ; à 94 dB SPL, ils délivrent 2 et 20 mV, qu'un préamplificateur remonte au niveau ligne.

En champ libre, la pression décroît avec la distance : **−6 dB par doublement** (l'énergie se répartit sur une sphère quatre fois plus grande). Un canon de bord terrain à 8 m du joueur reçoit 18 dB de moins qu'à 1 m ; à 30 m, 30 dB de moins : d'où les micros nombreux, et le suivi du jeu. Dans un stade, la foule, elle, ne décroît pas : elle est partout.

- Pour additionner des niveaux, on repasse en linéaire : 10^(dB ÷ 10) pour les puissances, 10^(dB ÷ 20) pour les tensions, on additionne, on revient en dB.
- Un écart de 1 dB s'entend à peine ; 3 dB est un petit changement net ; 10 dB semble « deux fois plus fort ».`,
    car: { text: 'En cabine son, tout se lit en dBFS : les crête-mètres des tranches, le niveau d\'alignement à −18 dBFS envoyé au test de ligne (1 kHz), le loudness en LUFS. Les pages E/S disent le niveau attendu sur chaque entrée (micro ou ligne).', station: 'son' },
    terms: ['decibel', 'dbu', 'dbfs'],
    competences: ['C32', 'C10'], savoirs: ['C1', 'C10', 'I6'],
    quiz: [
      { q: 'Une tension passe de 0,5 V à 1 V. De combien de dB a-t-elle monté ?', choices: ['6 dB', ['3 dB', '+3 dB, c\'est la puissance doublée (deux sources indépendantes). Une tension doublée, c\'est 20 log 2 = 6 dB.'], ['2 dB', 'Le décibel n\'est pas un rapport linéaire : × 2 en tension vaut 20 × log₁₀ 2 ≈ 6 dB.']], answer: 0, why: 'Pour une tension, 20 log₁₀ (1 ÷ 0,5) = 20 log₁₀ 2 ≈ 6 dB. Pour une puissance doublée, ce serait 10 log₁₀ 2 ≈ 3 dB : les deux disent la même chose, puisqu\'une puissance est le carré d\'une tension.' },
      { q: 'Que vaut 0 dBu ?', choices: ['0,775 V', ['1 V', '1 V, c\'est 0 dBV. Le dBu prend 0,775 V pour référence, la tension qui dissipe 1 mW dans 600 Ω.'], ['Aucune tension : c\'est le silence', 'Le 0 d\'une échelle en dB n\'est pas le silence, c\'est la référence. 0 dBu est une tension bien réelle, 0,775 V.']], answer: 0, why: '0 dBu = 0,775 V (1 mW dans 600 Ω, héritage du téléphone). Le niveau ligne professionnel est à +4 dBu, soit 1,23 V ; 0 dBV = 1 V est une autre référence.' },
      { q: 'Deux micros d\'ambiance captent chacun la foule à 100 dB SPL, de façon indépendante. Additionnés, ils donnent…', choices: ['103 dB SPL', ['106 dB SPL', '+6 dB, c\'est l\'addition de deux signaux identiques (corrélés). Deux micros indépendants additionnent leurs puissances : +3 dB.'], ['200 dB SPL', 'Les décibels ne s\'additionnent pas : ce sont des logarithmes. On repasse en puissance, on additionne, on revient en dB.']], answer: 0, why: 'Deux sources indépendantes de même niveau additionnent leurs puissances : 10 log₁₀ 2 = +3 dB, soit 103 dB SPL. Si c\'était deux fois le même signal, les tensions s\'ajouteraient : +6 dB.' },
      { q: 'Au test de ligne, la console aligne le 1 kHz à −18 dBFS. À quoi cela correspond-il sur le câble, en Europe (EBU R68) ?', choices: ['0 dBu', ['+4 dBu', '+4 dBu est le niveau ligne nominal ; l\'EBU R68 aligne 0 dBu, pas +4, sur −18 dBFS. Aux États-Unis, la SMPTE RP 155 aligne +4 dBu sur −20 dBFS.'], ['0 dBFS', '−18 dBFS et 0 dBFS ne sont pas la même chose : 0 dBFS est la pleine échelle, 18 dB plus haut, soit +18 dBu en alignement EBU.']], answer: 0, why: 'L\'EBU R68 fait correspondre 0 dBu (0,775 V) à −18 dBFS : la pleine échelle est donc à +18 dBu. Cette marge de 18 dB entre l\'alignement et l\'écrêtage absorbe les crêtes.' },
      { q: 'Un canon capte un joueur à 8 m. On le recule à 16 m. Le niveau du joueur…', choices: ['baisse de 6 dB', ['baisse de 3 dB', '−3 dB, c\'est une puissance divisée par deux. Doubler la distance divise la pression par deux (la puissance par quatre) : −6 dB.'], ['est divisé par 16', 'Doubler la distance divise la pression par 2 et la puissance par 4, pas par 16 : c\'est −6 dB.']], answer: 0, why: 'En champ libre, la pression décroît de 6 dB par doublement de distance (loi en 1/d). D\'où l\'intérêt des canons nombreux et du suivi du jeu.' },
      { q: 'Un lecteur grand public (−10 dBV) est branché sur une entrée ligne professionnelle réglée pour +4 dBu. Que se passe-t-il ?', choices: ['Le signal arrive 11,8 dB trop bas : on remonte le gain de l\'entrée', ['Le signal arrive 14 dB trop fort', 'On ne soustrait pas des dBV et des dBu directement : −10 dBV vaut −7,8 dBu, soit 11,8 dB sous +4 dBu. Le signal est trop bas, pas trop fort.'], ['Rien : −10 dBV et +4 dBu sont le même niveau', 'Deux références différentes : −10 dBV = 0,316 V, +4 dBu = 1,23 V. Il manque 11,8 dB.']], answer: 0, why: '−10 dBV = 0,316 V = −7,8 dBu, soit 11,8 dB sous +4 dBu (1,23 V). Le câble n\'y change rien : c\'est le gain de l\'entrée (ou un adaptateur de niveau) qui rattrape.' },
    ],
  },
  {
    id: 'son-micros', title: 'Les micros : dynamique, statique, directivité', minutes: '8 min',
    essentials: [
      'Un micro **dynamique** produit son signal seul (bobine dans un aimant) ; un **statique** (condensateur) a besoin du **48 V**, donne dix fois plus de tension et plus de finesse dans l\'aigu.',
      'La **directivité** dit d\'où le micro écoute : **omni**, **cardioïde** (−6 dB à 90°, presque rien derrière), **hypercardioïde**, **en 8** ; le **canon** ajoute un tube qui ne resserre que l\'aigu.',
      'Choisir un micro, c\'est choisir ce qu\'on ne veut pas entendre : la foule derrière le canon du bord terrain, la salle autour du commentateur.',
    ],
    figure: figMicros,
    demoTitle: 'Tournez la source autour d\'un cardioïde, puis d\'un micro en 8. Passez au canon : à 90°, comparez l\'atténuation à 200 Hz et à 8 kHz.',
    demo: demoMicros,
    body: `Un micro transforme une **pression** acoustique en **tension**. Deux familles font tout le travail du car. Le **dynamique** (à bobine mobile) : une membrane entraîne une bobine dans le champ d'un aimant, qui produit le signal par induction. Il n'a besoin d'aucune alimentation, encaisse les niveaux forts et les chocs, mais délivre peu (1 à 3 mV/Pa) et manque de finesse dans l'aigu : c'est le micro main du reporter, souvent celui des micro-casques. Le **statique** (à condensateur) : la membrane est l'une des deux armatures d'un condensateur polarisé ; sa vibration change la capacité, et une électronique interne transforme cette variation en tension. Il lui faut l'**alimentation fantôme 48 V** (ou une pile) ; il donne 10 à 40 mV/Pa, répond jusqu'à 20 kHz, capte le détail, et craint l'humidité et les chocs. Ce sont les canons du bord terrain, les couples d'ambiance, les micros de studio. (Le micro à **ruban**, un dynamique à ruban d'aluminium, bidirectionnel et fragile, reste rare en extérieur ; certains ne supportent pas le 48 V.)

La **directivité** est le diagramme de ce que le micro capte selon l'angle, vu de dessus. L'**omnidirectionnel** capte tout, à égalité, et supporte le vent et la proximité : micro-cravate, ambiance large. Le **cardioïde** (en forme de cœur) perd 6 dB à 90° et presque tout à 180° : la voix devant, la salle derrière rejetée. Le **supercardioïde** et l'**hypercardioïde** sont plus étroits devant (−6 dB vers 60 à 70°) mais reprennent un petit lobe arrière (−12 dB pour l'hyper) : les retours de scène se placent dans leurs angles morts, à 110 à 125°, pas derrière. Le **bidirectionnel** (en 8) capte devant et derrière, rien sur les côtés : la base des couples MS et Blumlein. Tous ces diagrammes du premier ordre s'écrivent a + (1 − a) cos θ : a = 1 omni, 0,5 cardioïde, 0,25 hypercardioïde, 0 en 8. Un micro directif capte moins de réverbération : le cardioïde ne prend qu'un tiers du champ diffus d'un omni (**facteur de distance** 1,7 : à 1,7 m, il donne la même proportion de salle qu'un omni à 1 m), l'hypercardioïde un quart (facteur 2).

Le **canon** (micro à tube d'interférence) place devant une capsule hypercardioïde un tube à fentes de 20 à 40 cm. Un son qui arrive hors axe entre par plusieurs fentes avec des retards différents et s'annule en partie : le canon devient très étroit, mais seulement pour les longueurs d'onde courtes devant le tube. **Dans le grave, le tube n'agit pas** : à 200 Hz (1,7 m de longueur d'onde), un canon de 25 cm n'est qu'un hypercardioïde ; à 8 kHz, il rejette 30 dB à 60°. La foule grave du stade entre donc dans les canons du bord terrain ; ce sont les frappes et les cris, dans l'aigu, qui ressortent. Et hors axe, le timbre change (plus sourd) : un canon mal pointé donne un son éteint plus qu'un son faible. Autres pièges : l'**effet de proximité** (un micro directif, très près de la bouche, gonfle le grave : le passe-haut de la tranche y remédie), le **vent** (bonnette, puis cage à poils sur les canons extérieurs), les **plosives**.

- Bord terrain : canons statiques sur perche ou pied, bonnettes à poils, vers le jeu ; la foule arrive quand même par le grave.
- Ambiance : couples statiques en tribune (cardioïdes ou omnis) ; commentateurs : micro-casque, souvent dynamique, cardioïde, à 2 cm de la bouche.
- Reporter bord terrain : micro main dynamique cardioïde sur émetteur HF, robuste et peu sensible au bruit de manipulation.`,
    car: { text: 'En cabine son, les tranches CANON 1 à 6 (statiques, 48 V), les couples AMB (ambiance de tribune) et les micro-casques COMM. L\'assistant de suivi du jeu monte le canon le plus proche du ballon, ce que ne ferait aucun micro omni.', station: 'son' },
    terms: ['directivite', 'micro-statique'],
    competences: ['C23', 'C32'], savoirs: ['I3', 'I9', 'D2'],
    quiz: [
      { q: 'Quel micro fonctionne sans aucune alimentation ?', choices: ['Le dynamique à bobine mobile', ['Le statique à condensateur', 'Le statique a besoin du 48 V fantôme (ou d\'une pile) pour polariser sa capsule et alimenter son électronique.'], ['Tous les micros en ont besoin', 'Le dynamique produit son signal par induction, comme une dynamo : il n\'a rien à recevoir de la console.']], answer: 0, why: 'La bobine du dynamique bouge dans le champ d\'un aimant et produit le signal par induction. Le statique, lui, doit polariser son condensateur et alimenter son électronique : 48 V.' },
      { q: 'De combien un cardioïde atténue-t-il une source placée à 90° ?', choices: ['6 dB', ['Rien : le cardioïde ne rejette que l\'arrière', 'À 90°, le cardioïde vaut 0,5 + 0,5 cos 90° = 0,5 : la moitié de la tension, soit −6 dB. Le rejet total est à 180°.'], ['20 dB', '−20 dB serait presque le rejet de l\'arrière. À 90°, le cardioïde ne perd que 6 dB.']], answer: 0, why: 'Le cardioïde s\'écrit 0,5 + 0,5 cos θ : 1 à 0°, 0,5 à 90° (−6 dB), 0 à 180°. C\'est le micro qui sépare le mieux l\'avant de l\'arrière.' },
      { q: 'Un canon de 25 cm pointé sur le jeu reçoit la foule de côté. Que rejette-t-il le mieux ?', choices: ['Les cris et les frappes, dans l\'aigu', ['Le grondement grave de la foule', 'Dans le grave, la longueur d\'onde (1,7 m à 200 Hz) est longue devant le tube : il n\'agit pas, et le canon n\'est qu\'un hypercardioïde.'], ['Tout, également', 'Le tube à interférence n\'est directif que pour les longueurs d\'onde courtes devant lui : l\'aigu, pas le grave.']], answer: 0, why: 'Le tube à fentes annule les sons hors axe quand leur longueur d\'onde est courte devant lui : dans l\'aigu, 30 dB de rejet à 60° ; dans le grave, rien de plus qu\'un hypercardioïde. La foule grave entre quand même.' },
      { q: 'Où placer un retour de scène devant un chanteur au micro hypercardioïde ?', choices: ['Dans ses angles morts, vers 110 à 125°, pas juste derrière', ['Juste derrière le micro, à 180°', 'L\'hypercardioïde reprend un petit lobe arrière (−12 dB) : derrière, ce n\'est pas son angle mort, qui est vers 110 à 125°.'], ['N\'importe où : il est directif', 'Directif ne veut pas dire sourd partout ailleurs : chaque diagramme a ses angles morts, et l\'hypercardioïde n\'a pas le sien à l\'arrière.']], answer: 0, why: 'Le cardioïde a son angle mort à 180° ; l\'hypercardioïde, plus étroit devant, reprend un lobe arrière et ses angles morts sont vers 110 à 125°. On y place les retours.' },
      { q: 'Le commentateur colle son micro-casque cardioïde à sa bouche et sa voix devient lourde, gonflée dans le grave. C\'est…', choices: ['l\'effet de proximité : passe-haut sur la tranche, ou micro un peu plus loin', ['un défaut du 48 V', 'Le 48 V alimente un statique ; il ne change pas le timbre. Et un micro-casque dynamique n\'en a même pas besoin.'], ['une polarité inversée', 'La polarité change le signe du signal, pas son timbre : elle ne s\'entend que sur une somme de deux voies.']], answer: 0, why: 'Tout micro directif gonfle le grave quand la source est très proche (effet de proximité). On coupe avec le passe-haut (80 à 150 Hz) ou l\'on éloigne un peu le micro.' },
      { q: 'Quel micro pour le reporter qui court le long de la touche, sur un émetteur HF ?', choices: ['Un micro main dynamique cardioïde', ['Un canon statique', 'Trop long, trop fragile, et sa directivité dans l\'aigu rend le pointage critique en courant.'], ['Un omni statique de studio', 'L\'omni prend la foule de partout, et le statique craint les chocs et l\'humidité.']], answer: 0, why: 'Le dynamique encaisse les chocs et les niveaux forts, n\'a pas besoin d\'alimentation et fait peu de bruit de manipulation ; cardioïde, il rejette la foule derrière le reporter.' },
    ],
  },
  {
    id: 'son-stereo', title: 'Les couples stéréo : XY, ORTF, AB, MS', minutes: '10 min',
    essentials: [
      'Un **couple stéréo** place une source entre les deux haut-parleurs par des écarts de **niveau** (couples coïncidents XY, Blumlein, MS), de **temps** (AB espacé) ou les deux (**ORTF**, NOS, DIN) ; vers **15 dB** ou **1,1 ms**, la source est sur un seul haut-parleur.',
      'L\'**angle d\'enregistrement** du couple doit couvrir la scène : XY 90° ≈ 180°, ORTF ≈ 100°, AB 60 cm ≈ 80° ; un couple plus espacé ou plus ouvert étale davantage la scène.',
      'Un couple coïncident reste parfait en **mono** (L + R) ; un couple espacé y fait un filtre en peigne ; le **MS** se décode L = M + S, R = M − S et sa largeur se règle après coup.',
    ],
    figure: figStereo,
    demoTitle: 'Déplacez la source devant un ORTF : lisez l\'écart de niveau et l\'écart de temps, et où l\'image se place. Passez en XY, puis en AB 60 cm : regardez l\'angle d\'enregistrement. En MS, baissez le S jusqu\'à zéro.',
    demo: demoStereo,
    body: `Deux oreilles localisent une source par ce qui diffère entre elles : un peu plus fort d'un côté, un peu plus tôt de l'autre. La stéréo sur deux haut-parleurs rejoue ces écarts : une source est perçue **entre** les enceintes selon l'**écart de niveau** (ΔL) et l'**écart de temps** (Δt) entre les deux voies. Les mesures de Williams (1987) donnent les ordres de grandeur : vers **15 dB** d'écart de niveau, ou **1,1 ms** d'écart de temps, la source est entièrement sur un haut-parleur ; en dessous, elle glisse entre les deux, et les deux écarts s'additionnent. Un **couple** stéréo est une façon de fabriquer ces écarts avec deux micros.

Les **couples coïncidents** ne font que des écarts de niveau : deux capsules au même point, tournées l'une vers la gauche, l'autre vers la droite. **XY** : deux cardioïdes à 90° (ou 120°) ; une source à 45° à gauche est dans l'axe du micro gauche et à 90° du droit, qui la capte 6 dB plus bas. **Blumlein** : deux micros en 8 à 90°, très précis, mais qui captent autant l'arrière (la salle) que l'avant. **MS** (mid-side) : un micro **M** vers la scène (cardioïde, ou omni) et un micro en 8 **S** tourné vers les côtés ; la **matrice** fabrique **L = M + S** et **R = M − S**. Son intérêt : le M seul est un mono parfait, et le niveau du S règle la **largeur** après coup, en régie ou au montage ; un MS décodé équivaut à un XY dont l'angle et la directivité dépendent du S (S au niveau du M : deux supercardioïdes virtuels à 127°). Les couples coïncidents sont **compatibles mono** : L + R n'a aucun déphasage, rien ne se creuse.

Les **couples espacés** font des écarts de temps : deux micros à distance d, et une source de côté arrive plus tôt sur le plus proche, Δt = d × sin φ ÷ 343 m/s. **AB** : deux omnis parallèles écartés de 40 à 60 cm (et bien plus pour un orchestre) ; l'image est ample, l'ambiance enveloppante, mais une source franche se localise moins précisément, et la somme mono fait un **filtre en peigne** (des creux à 1 ÷ 2Δt, 2 kHz pour 0,25 ms, puis tous les multiples). Les **couples mixtes** combinent les deux : **ORTF** (deux cardioïdes écartés de 17 cm, ouverts à 110° : l'écartement de deux oreilles) donne des images stables et naturelles et reste le couple d'ambiance le plus courant ; **NOS** (30 cm, 90°) et **DIN** (20 cm, 90°) sont ses variantes.

Chaque couple a son **angle d'enregistrement** : l'ouverture, devant lui, dans laquelle les sources se répartissent entre les deux enceintes ; au-delà, elles se collent sur une seule. Le XY 90° cardioïde couvre environ 180°, l'ORTF une centaine de degrés, un AB de 60 cm environ 80° : plus le couple est **espacé ou ouvert**, plus l'angle est **étroit**, et plus la scène s'**étale** entre les enceintes. On choisit donc le couple d'après la scène : un couple au bord de la tribune, face au terrain, avec un angle d'enregistrement large pour que le stade ne se tasse pas au centre. À l'écoute, le **corrélateur** de la console suit le couple : vers +1, les deux voies vont ensemble (une source centrale, ou un couple coïncident) ; vers 0, elles sont indépendantes (un AB large, une foule diffuse) ; sous 0, une opposition de phase, à corriger (leçon suivante : la tranche).

- Un couple se repère par ses bonnettes, son angle et son écartement ; on note sur la liste de câblage laquelle des deux voies est la gauche.
- Pour plusieurs micros sur une même scène, la règle des **3 pour 1** limite les effets de peigne : la distance entre deux micros au moins trois fois la distance micro-source.`,
    car: { text: 'En cabine son, les tranches AMB G et AMB D sont les deux voies d\'un couple en tribune : le corrélateur du Control Bay suit leur cohérence, la touche MONO fait entendre leur somme, le panoramique les écarte. L\'exercice de la tranche fait retrouver une voie en opposition de phase.', station: 'son' },
    terms: ['couple-stereo', 'ms', 'ortf', 'directivite'],
    competences: ['C23', 'C32', 'C10'], savoirs: ['I9', 'I3', 'I13'],
    quiz: [
      { q: 'Sur quoi repose l\'image stéréo d\'un couple XY ?', choices: ['Sur les écarts de niveau entre les deux capsules', ['Sur les écarts de temps', 'Les deux capsules d\'un XY sont au même point : le son leur arrive en même temps. Seul leur angle fait une différence, de niveau.'], ['Sur l\'écartement des micros', 'Un XY n\'a pas d\'écartement : ses capsules sont coïncidentes.']], answer: 0, why: 'Coïncident, le XY ne fait que des écarts de niveau : une source dans l\'axe d\'une capsule est hors axe de l\'autre, qui la capte plus bas. C\'est pourquoi il reste parfait en mono.' },
      { q: 'Un couple AB de 60 cm, une source à 30° à gauche. L\'écart de temps entre les voies vaut environ…', choices: ['0,9 ms', ['0,3 ms', '0,6 m × sin 30° = 0,3 m, divisé par 343 m/s : 0,87 ms. 0,3, c\'est le trajet en mètres, pas en millisecondes.'], ['1,75 ms', 'Ce serait 0,6 m ÷ 343 m/s, le trajet entier : mais seule la projection sur l\'axe du couple compte, 0,6 × sin 30°.']], answer: 0, why: 'Δt = d × sin φ ÷ c = 0,6 × 0,5 ÷ 343 = 0,87 ms : presque la pleine latéralisation (1,1 ms). Un AB de 60 cm a un angle d\'enregistrement d\'environ 80°.' },
      { q: 'Comment décode-t-on un couple MS ?', choices: ['L = M + S et R = M − S', ['L = M et R = S', 'Le S est un micro en 8 tourné vers les côtés : il ne contient pas la voie droite, mais la différence gauche − droite. Il faut l\'ajouter puis le soustraire au M.'], ['L = S + M et R = S − M', 'C\'est le M qui porte la scène et le mono : on ajoute ou retire le S au M, pas l\'inverse (sinon la voie droite est en opposition de phase).']], answer: 0, why: 'La matrice additionne le S d\'un côté et le soustrait de l\'autre : L = M + S, R = M − S. Le mono (L + R) redonne 2 M : le S s\'annule, et le niveau du S règle la largeur.' },
      { q: 'Quel couple garde une somme mono sans aucun creux ?', choices: ['Un couple coïncident (XY, MS, Blumlein)', ['Un couple AB espacé', 'Espacé, les deux voies reçoivent la source avec un retard : additionnées, elles font un filtre en peigne, des creux à 1 ÷ 2Δt et ses multiples.'], ['Un ORTF', 'L\'ORTF est espacé de 17 cm : ses écarts de temps creusent un peu la somme mono, moins qu\'un AB, mais ce n\'est pas parfait.']], answer: 0, why: 'Capsules au même point : aucun retard entre les voies, la somme n\'a pas de déphasage. Le MS va plus loin : son mono est le M tel quel.' },
      { q: 'On écarte un couple AB de 40 à 80 cm. Son angle d\'enregistrement…', choices: ['se resserre : la scène s\'étale davantage entre les enceintes', ['s\'élargit : on capte plus large', 'Plus l\'écartement est grand, plus vite les écarts de temps atteignent 1,1 ms : une source de côté se colle sur un haut-parleur plus tôt. L\'angle est plus étroit.'], ['ne change pas : seule la directivité compte', 'Pour deux omnis, seul l\'écartement fait l\'image : il change tout.']], answer: 0, why: 'Plus espacé ou plus ouvert, un couple atteint plus tôt ses écarts de pleine latéralisation : son angle d\'enregistrement se resserre, et la même scène s\'étale davantage entre les enceintes.' },
      { q: 'Le corrélateur d\'un couple d\'ambiance lit −0,7. Qu\'en conclure ?', choices: ['Une voie est en opposition de phase : à corriger', ['Un couple AB très large, c\'est normal', 'Un AB large et une foule diffuse donnent un corrélateur vers 0, pas franchement négatif.'], ['Une image bien large', 'Une image large se lit vers 0. Sous 0, les deux voies vont en sens opposés : une inversion de polarité, qui creuse le mono.']], answer: 0, why: 'Sous 0, les deux voies sont en opposition : un câble inversé ou une touche Ø oubliée. On inverse une seule voie et le corrélateur remonte vers +1 (leçon La tranche).' },
    ],
  },
  {
    id: 'son-liaisons', title: 'Niveaux et liaisons : micro, ligne, symétrique', minutes: '8 min',
    essentials: [
      'Trois niveaux : **micro** (quelques mV, −60 à −40 dBu), **ligne pro +4 dBu** (1,23 V), **ligne grand public −10 dBV** (0,32 V) : 11,8 dB d\'écart, qu\'un câble ne rattrape pas, mais le gain de l\'entrée si.',
      'Une liaison **symétrique** (XLR : 1 masse, 2 point chaud, 3 point froid) porte le signal en opposition sur deux fils ; le parasite, identique sur les deux, s\'annule à l\'entrée différentielle (**réjection de mode commun**, 60 à 80 dB).',
      'L\'**impédance** : on **ponte** (charge ≥ 10 × la source) ; 150 Ω vers 1,5 kΩ ne perd que 0,8 dB, 600 Ω sur 600 Ω en perd 6.',
    ],
    figure: figLiaisons,
    demoTitle: 'Allongez le câble d\'un micro à 100 m en asymétrique, puis repassez en symétrique. Baissez la réjection de l\'entrée. Essayez 600 Ω sur 600 Ω.',
    demo: demoLiaisons,
    body: `Un signal audio voyage sur un câble à l'un de trois **niveaux**. Le **niveau micro** : quelques millivolts (−60 à −40 dBu), fragile, qu'un préamplificateur (40 à 60 dB de gain) remonte dès l'entrée de la console ou de la stagebox. Le **niveau ligne** : professionnel à **+4 dBu** (1,23 V, jusqu'à +24 dBu en crête sur les sorties pro), grand public à **−10 dBV** (0,316 V), soit **11,8 dB** plus bas. Brancher un lecteur grand public sur une entrée pro donne un signal trop faible ; une sortie pro sur une entrée grand public la sature. On adapte par le **gain de l'entrée**, un **pad** (−20 dB sur une entrée micro qui reçoit de la ligne) ou un boîtier d'adaptation, jamais par le câble. Le niveau haut-parleur (des volts, des ampères) ne se mélange à rien de tout cela.

Un câble capte des **parasites** : le 50 Hz des alimentations et des gradateurs de lumière, les émetteurs, les moteurs. La liaison **asymétrique** (RCA, jack mono, un conducteur et un blindage) n'y peut rien : le parasite s'ajoute au signal. La liaison **symétrique** porte le signal sur deux conducteurs, en **opposition** : le point chaud (+s) et le point froid (−s), dans un blindage à la masse. Un parasite capté en route est le même sur les deux fils (+p). À l'arrivée, l'**entrée différentielle** fait chaud − froid : (s + p) − (−s + p) = 2s, le parasite disparaît. La qualité de cette annulation est la **réjection de mode commun** (CMRR), 60 à 80 dB sur une bonne entrée. Connecteur **XLR** à trois broches : **1 masse, 2 chaud, 3 froid** ; le jack **TRS** (pointe chaud, anneau froid, corps masse) sert en symétrique sur les patchs et les sorties ligne. Une erreur de câblage (2 et 3 inversés) n'atténue rien, elle inverse la **polarité** : elle ne s'entend qu'avec une autre voie (couple creusé en mono). Le **48 V** ne se transmet qu'en symétrique (sur les deux conducteurs, contre la masse), et une sortie **asymétrique** branchée sur une entrée au 48 V peut souffrir. Les **boucles de masse** (deux appareils reliés par le câble audio et par la terre du secteur) ronflent à 50 Hz : on lève la masse d'un côté (ground lift) ou l'on isole par un transformateur.

L'**impédance** d'une source et celle de la charge forment un pont diviseur. En audio, on ne cherche pas l'adaptation 600 Ω sur 600 Ω du téléphone (qui perd la moitié de la tension, −6 dB) mais le **pontage** : une charge d'au moins **dix fois** l'impédance de la source. Un micro de 150 à 200 Ω sur une entrée de 1,5 à 2 kΩ perd moins de 1 dB ; une sortie ligne de 100 Ω sur une entrée de 10 kΩ, rien. Une charge trop basse (un micro branché sur une entrée de 150 Ω, deux entrées en parallèle sur un micro) fait chuter le niveau et abîme le grave. L'impédance élevée (une guitare, 1 MΩ) ne supporte ni les câbles longs ni la console : une boîte de direct la convertit en symétrique basse impédance.

- Les câbles micro symétriques tiennent 100 m et plus ; l'asymétrique, quelques mètres.
- Sur la liste de câblage : le niveau (micro ou ligne), le type (sym. ou asym.), la présence du 48 V, le repère de chaque extrémité.`,
    car: { text: 'En cabine son, les pages E/S et patch : chaque entrée de la stagebox est micro ou ligne, avec son pad, son 48 V et son gain ; la face arrière montre les XLR. Au test de ligne, un départ envoyé au mauvais niveau arrive trop bas ou saturé chez la chaîne.', station: 'son' },
    terms: ['symetrique', 'dbu', 'decibel'],
    competences: ['C25', 'C19', 'C32'], savoirs: ['C7', 'L5', 'I6'],
    quiz: [
      { q: 'Sur un XLR audio, quelle broche porte le point chaud ?', choices: ['La broche 2', ['La broche 1', 'La broche 1 est la masse, reliée au blindage.'], ['La broche 3', 'La broche 3 est le point froid, le signal en opposition. Inverser 2 et 3 inverse la polarité.']], answer: 0, why: '1 masse, 2 chaud, 3 froid : « un, masse ; deux, chaud ; trois, froid ». Une inversion 2-3 n\'atténue rien, elle inverse la polarité de la voie.' },
      { q: 'Pourquoi une liaison symétrique rejette-t-elle les parasites ?', choices: ['Le parasite est identique sur les deux fils et l\'entrée différentielle le soustrait', ['Le blindage arrête tout', 'Le blindage aide, mais il ne suffit pas sur 100 m : l\'asymétrique a un blindage et ronfle quand même.'], ['Le signal y est plus fort', 'Le niveau ne change pas ; c\'est la différence entre les deux fils qui élimine ce qu\'ils ont en commun.']], answer: 0, why: 'Le signal part en opposition (+s, −s), le parasite arrive en commun (+p, +p). Chaud − froid donne 2s : le mode commun est rejeté de 60 à 80 dB.' },
      { q: 'Une sortie −10 dBV vers une entrée +4 dBu. Comment rattraper l\'écart ?', choices: ['Par le gain de l\'entrée (ou un boîtier d\'adaptation) : il manque 11,8 dB', ['Par un câble plus court', 'Un câble ne change pas un niveau : −10 dBV reste 0,316 V, 11,8 dB sous +4 dBu.'], ['Il n\'y a rien à rattraper', '−10 dBV = −7,8 dBu : 11,8 dB sous le niveau pro. Le signal arrive trop bas.']], answer: 0, why: 'Les niveaux s\'adaptent à l\'entrée (gain, pad) ou par un boîtier d\'adaptation ; le câble n\'y est pour rien.' },
      { q: 'Un micro de 150 Ω sur une entrée de 150 Ω. Qu\'arrive-t-il au signal ?', choices: ['Il perd 6 dB : la moitié de la tension', ['Rien : c\'est l\'adaptation parfaite', 'L\'adaptation 600/600 est un héritage du téléphone. En audio, on ponte : la charge doit valoir au moins dix fois la source.'], ['Il double', 'Un pont diviseur ne peut que baisser la tension : à impédances égales, elle est divisée par deux.']], answer: 0, why: 'Pont diviseur : 150 ÷ (150 + 150) = 0,5, soit −6 dB, et le grave souffre. On ponte avec une charge d\'au moins 1,5 kΩ : −0,8 dB.' },
      { q: 'Deux appareils reliés par un câble audio et tous deux à la terre du secteur ronflent à 50 Hz. C\'est…', choices: ['une boucle de masse : on lève la masse d\'un côté ou l\'on isole par transformateur', ['un défaut de 48 V', 'Le 48 V n\'a rien à voir avec une ronflette entre deux appareils de ligne.'], ['un câble trop long', 'Même court, un câble ferme une boucle de masse si les deux appareils sont à la terre : le courant de boucle passe dans le blindage.']], answer: 0, why: 'Le blindage et la terre forment une boucle où circule un courant à 50 Hz. On la casse (ground lift sur un côté) ou l\'on isole galvaniquement (transformateur, boîte de direct).' },
      { q: 'Le câblage inverse les broches 2 et 3 d\'un seul micro d\'un couple d\'ambiance. Qu\'entend-on ?', choices: ['Rien en stéréo, mais la somme mono se creuse : polarité inversée', ['Le micro est muet', 'Inverser chaud et froid ne coupe rien : le signal passe, juste de signe opposé.'], ['Le micro est 6 dB trop bas', 'Le niveau ne bouge pas : seul le signe change, invisible sur une voie seule.']], answer: 0, why: 'Chaud et froid inversés = polarité inversée. Seule, la voie semble normale ; avec l\'autre voie du couple, la partie commune s\'annule en mono et le corrélateur passe sous 0.' },
    ],
  },
];
