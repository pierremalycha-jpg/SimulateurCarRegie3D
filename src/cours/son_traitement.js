// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import { compresseur, gainRattrapage, gate, loudnessIntegre, plageLoudness, normaliser, creteEchantillons, debitPcm, dynamiqueDb, nyquist, debitAes3, canauxMadi, debitDante, latenceTampon, deriveEchantillons } from './son_calc.js';

// ----------------------------------------------------------------------------------
// Le traitement et le numérique du chapitre « Le son » (v19.24) : la dynamique (compresseur, limiteur,
// gate : seuil, ratio, genou, attaque, relâchement, gain de rattrapage), le loudness (EBU R128 : LUFS,
// momentané, court terme, intégré avec ses portes, plage de loudness, crête vraie en dBTP) et l'audio
// numérique (48 kHz, 24 bits, AES3, MADI, Dante et AES67, latence des tampons, horloges). Les chiffres
// viennent de cours/son_calc.js.
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
const moins = (v, d = 1) => fmtNum(v, d).replace('-', '−');
/** générateur pseudo-aléatoire reproductible */
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

// ======================================================================================
// 1. La dynamique
// ======================================================================================
function figDynamique() {
  const f = figure(720, 250, 'À gauche, la courbe d\'un compresseur : en dessous du seuil, la sortie suit l\'entrée (une diagonale) ; au-dessus, la pente s\'adoucit selon le ratio (4:1 : 4 dB d\'entrée en plus ne donnent qu\'1 dB de sortie en plus), avec un genou doux ou dur ; le limiteur est la pente horizontale (ratio infini) ; le gain de rattrapage remonte ensuite toute la courbe. À droite, le temps : à l\'arrivée d\'une crête, la réduction de gain s\'installe pendant l\'attaque et disparaît pendant le relâchement ; le gate, lui, coupe ce qui passe sous son seuil.');
  f.append(txt(10, 16, 'La courbe du compresseur (entrée → sortie, en dB)', 'co-t', 'start'));
  const X = (v) => 60 + (v + 60) / 60 * 280, Y = (v) => 210 - (v + 60) / 60 * 170;
  f.append(sv('line', { x1: X(-60), y1: Y(-60), x2: X(0), y2: Y(-60), stroke: C.line }), sv('line', { x1: X(-60), y1: Y(-60), x2: X(-60), y2: Y(0), stroke: C.line }));
  f.append(sv('line', { x1: X(-60), y1: Y(-60), x2: X(0), y2: Y(0), stroke: C.grey, strokeDasharray: '4 3' }), txt(X(-10), Y(-4), '1:1', 'co-s'));
  const courbe = (ratio, col, lab) => { let d = ''; for (let v = -60; v <= 0; v += 1) d += (v === -60 ? 'M' : 'L') + X(v).toFixed(1) + ' ' + Y(compresseur(v, -20, ratio, 6)).toFixed(1); f.append(sv('path', { d, fill: 'none', stroke: col, strokeWidth: 2 }), txt(X(0) + 4, Y(compresseur(0, -20, ratio, 6)) + 4, lab, 'co-s', 'start', { fill: col })); };
  courbe(2, C.green, '2:1'); courbe(4, C.amber, '4:1'); courbe(20, C.red, '∞ limiteur');
  f.append(sv('line', { x1: X(-20), y1: Y(-60), x2: X(-20), y2: Y(-20), stroke: C.white, strokeDasharray: '2 3' }), txt(X(-20), Y(-60) + 14, 'seuil −20 dB', 'co-s'));
  f.append(txt(X(-60) - 6, Y(0) + 4, '0', 'co-s', 'end'), txt(X(-60) - 6, Y(-60) + 4, '−60', 'co-s', 'end'), txt(X(-30), Y(-60) + 28, 'entrée (dB)', 'co-s'), txt(14, Y(-30), 'sortie', 'co-s', 'start'));
  // le temps
  f.append(txt(400, 16, 'Attaque, relâchement, gate', 'co-t', 'start'));
  const x0 = 400, y0 = 120;
  f.append(sv('rect', { x: x0, y: y0 - 40, width: 60, height: 40, fill: C.line }), sv('rect', { x: x0 + 60, y: y0 - 70, width: 90, height: 70, fill: C.amber, opacity: 0.6 }), sv('rect', { x: x0 + 150, y: y0 - 30, width: 150, height: 30, fill: C.line }));
  f.append(txt(x0 + 30, y0 + 14, 'foule', 'co-s'), txt(x0 + 105, y0 + 14, 'voix', 'co-s'), txt(x0 + 225, y0 + 14, 'foule', 'co-s'));
  f.append(sv('path', { d: `M${x0} ${y0 + 30} H${x0 + 60} C ${x0 + 70} ${y0 + 30}, ${x0 + 72} ${y0 + 58}, ${x0 + 85} ${y0 + 58} H${x0 + 150} C ${x0 + 170} ${y0 + 58}, ${x0 + 180} ${y0 + 30}, ${x0 + 210} ${y0 + 30} H${x0 + 300}`, fill: 'none', stroke: C.cyan, strokeWidth: 2 }));
  f.append(txt(x0 + 72, y0 + 72, 'attaque', 'co-s'), txt(x0 + 190, y0 + 72, 'relâchement', 'co-s'), txt(x0 - 4, y0 + 34, '0', 'co-s', 'end'), txt(x0 - 4, y0 + 62, '−10', 'co-s', 'end'), txt(x0 + 150, y0 + 90, 'réduction de gain (dB)', 'co-s'));
  f.append(sv('line', { x1: x0, y1: y0 - 36, x2: x0 + 300, y2: y0 - 36, stroke: C.red, strokeDasharray: '3 3' }), txt(x0 + 300, y0 - 40, 'seuil du gate : la foule, dessous, est coupée', 'co-s', 'end', { fill: C.red }));
  f.append(box(400, 206, 300, 36, C.grey), txt(550, 222, 'limiteur du départ : plafond −1 dBTP, attaque ≈ 0', 'co-s'), txt(550, 236, 'rien ne le dépasse, quoi qu\'il arrive', 'co-s'));
  return f;
}
function demoDynamique(host) {
  let seuil = -20, ratio = 4, genou = 6, rattrap = true, gseuil = -45;
  const cv = canvas(720, 260, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Réduction de gain sur la crête la plus forte', 'Gain de rattrapage', 'Crête en sortie', 'Dynamique : avant → après', 'Le gate sur la foule']);
  const verdict = el('p', { class: 'co-verdict' });
  // un signal de test : la foule continue (−38 à −30 dB), des phrases du commentateur (−18 à −6), un cri (−2)
  const r = rng(5), N = 400, sig = new Float32Array(N);
  for (let i = 0; i < N; i++) { const t = i / N; let v = -36 + 4 * Math.sin(t * 40) + (r() - 0.5) * 3; if ((t > 0.12 && t < 0.3) || (t > 0.45 && t < 0.62) || (t > 0.75 && t < 0.9)) v = -14 + 7 * Math.sin(t * 90) + (r() - 0.5) * 4; if (t > 0.66 && t < 0.69) v = -2; sig[i] = v; }
  const draw = () => {
    let cmax = -99, omax = -99, cmin = 99, omin = 99, grmax = 0;
    const out = new Float32Array(N);
    for (let i = 0; i < N; i++) { const o = compresseur(sig[i], seuil, ratio, genou); out[i] = o; cmax = Math.max(cmax, sig[i]); omax = Math.max(omax, o); cmin = Math.min(cmin, sig[i]); omin = Math.min(omin, o); grmax = Math.min(grmax, o - sig[i]); }
    const mk = rattrap ? gainRattrapage(cmax, seuil, ratio, genou) : 0;
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 260);
    const X = (i) => 20 + i / N * 680, Y = (v) => 150 - (Math.max(-60, v) + 60) / 60 * 130;
    g.font = '11px Arial, sans-serif'; g.fillStyle = '#aab4ba'; g.fillText('entrée (gris) et sortie (ambre), en dB ; la foule, le commentateur, un cri', 20, 14);
    for (const v of [0, -20, -40, -60]) { g.strokeStyle = '#2a3238'; g.beginPath(); g.moveTo(20, Y(v)); g.lineTo(700, Y(v)); g.stroke(); g.fillStyle = '#6f7a84'; g.fillText(String(v).replace('-', '−'), 2, Y(v) + 4); }
    g.strokeStyle = C.red; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(20, Y(seuil)); g.lineTo(700, Y(seuil)); g.stroke(); g.strokeStyle = C.cyan; g.beginPath(); g.moveTo(20, Y(gseuil)); g.lineTo(700, Y(gseuil)); g.stroke(); g.setLineDash([]);
    g.fillStyle = C.red; g.fillText('seuil du compresseur', 600, Y(seuil) - 4); g.fillStyle = C.cyan; g.fillText('seuil du gate', 620, Y(gseuil) - 4);
    const tr = (arr, col, fn = (v) => v) => { g.strokeStyle = col; g.lineWidth = 1.4; g.beginPath(); for (let i = 0; i < N; i++) g[i ? 'lineTo' : 'moveTo'](X(i), Y(fn(arr[i]))); g.stroke(); };
    tr(sig, '#6f7a84'); tr(out, C.amber, (v) => v + mk);
    // la réduction de gain, en bas
    g.fillStyle = '#aab4ba'; g.fillText('réduction de gain (0 à −20 dB)', 20, 178);
    for (let i = 0; i < N; i++) { const gr = out[i] - sig[i]; g.fillStyle = gr < -0.1 ? C.red : '#1a2026'; g.fillRect(X(i), 184, 680 / N + 0.5, Math.min(20, -gr) / 20 * 50); }
    for (const v of [0, -10, -20]) { g.fillStyle = '#6f7a84'; g.fillText(String(v).replace('-', '−'), 2, 188 + (-v) / 20 * 50); }
    // le gate sur la foule
    const foule = -36, gated = gate(foule, gseuil);
    read.set('Réduction de gain sur la crête la plus forte', `${dB(grmax)} (crête d'entrée ${moins(cmax, 0)} dB, seuil ${moins(seuil, 0)} dB, ratio ${ratio >= 20 ? '∞' : ratio + ':1'})`);
    read.set('Gain de rattrapage', rattrap ? `${dB(mk)} : la crête revient à ${moins(cmax, 0)} dB` : 'aucun : le programme est plus bas');
    read.set('Crête en sortie', `${moins(omax + mk, 1)} dB`);
    read.set('Dynamique : avant → après', `${fmtNum(cmax - cmin, 0)} dB → ${fmtNum(omax - omin, 0)} dB entre la foule et le cri${rattrap ? ' ; la foule remonte de ' + dB(mk) : ''}`);
    read.set('Le gate sur la foule', gated < foule ? `la foule à ${moins(foule, 0)} dB passe sous le seuil (${moins(gseuil, 0)} dB) : coupée de 60 dB entre les phrases` : `la foule à ${moins(foule, 0)} dB reste au-dessus du seuil (${moins(gseuil, 0)} dB) : le gate ne s'ouvre pas que sur la voix`);
    const trop = grmax < -12, doux = grmax > -2;
    verdict.className = 'co-verdict ' + (trop ? 'warn' : doux ? 'warn' : 'ok');
    verdict.textContent = ratio >= 20 ? 'Ratio infini : un limiteur. Tout ce qui dépasse le seuil est écrasé, le cri comme la voix : utile au départ (plafond), brutal sur une tranche.' : trop ? `${dB(grmax)} de réduction : la voix est tassée, on entend le compresseur respirer (pompage) et la foule remonte entre les phrases avec le rattrapage.` : doux ? 'Presque aucune réduction : le compresseur ne fait rien, montez le ratio ou baissez le seuil.' : 'Une réduction de quelques décibels sur les crêtes : la voix reste vivante, les cris ne font plus sursauter.';
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Seuil', -40, 0, seuil, 1, (v) => { seuil = v; draw(); }, (v) => `${moins(v, 0)} dB`),
      slider('Ratio', 1, 20, ratio, 1, (v) => { ratio = v; draw(); }, (v) => (v >= 20 ? '∞ : limiteur' : `${v}:1`)),
      slider('Genou', 0, 12, genou, 1, (v) => { genou = v; draw(); }, (v) => (v ? `doux, ${v} dB` : 'dur')),
      choice('Gain de rattrapage', [['auto', 'automatique'], ['non', 'aucun']], 'auto', (v) => { rattrap = v === 'auto'; draw(); }),
      slider('Seuil du gate', -60, -20, gseuil, 1, (v) => { gseuil = v; draw(); }, (v) => `${moins(v, 0)} dB`)),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le commentateur sur la foule du stade : la courbe ambre est la sortie du compresseur, les barres rouges la réduction de gain à chaque instant.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 2. Le loudness
// ======================================================================================
function figLoudness() {
  const f = figure(720, 244, 'Le loudness-mètre de l\'EBU R128 : trois lectures en LUFS (momentané sur 400 ms, court terme sur 3 s, intégré sur tout le programme), la plage de loudness LRA en LU, et la crête vraie en dBTP. Les cibles : −23 LUFS intégré (±0,5 LU au PAD, ±1 LU en direct), −1 dBTP au plus. En dessous, les portes de la mesure intégrée : les blocs sous −70 LUFS (silence) sont ignorés, puis ceux qui sont plus de 10 LU sous la moyenne des autres (fond discret), si bien qu\'un silence ou une respiration ne tire pas la mesure vers le bas.');
  f.append(txt(10, 16, 'Le loudness-mètre (EBU R128, ITU-R BS.1770)', 'co-t', 'start'));
  const items = [['M', 'momentané', '400 ms', '−21,4'], ['S', 'court terme', '3 s', '−22,8'], ['I', 'intégré', 'tout le programme', '−23,1'], ['LRA', 'plage', 'centiles 10 à 95', '9,5 LU'], ['TP', 'crête vraie', 'suréch. ×4', '−1,8 dBTP']];
  items.forEach(([k, nom, sur, val], i) => { const x = 10 + i * 142; f.append(box(x, 28, 130, 70, i === 2 ? C.amber : C.grey), txt(x + 65, 48, k, 'co-t'), txt(x + 65, 64, `${nom} (${sur})`, 'co-s'), txt(x + 65, 86, val + (i < 3 ? ' LUFS' : ''), 'co-m')); });
  f.append(txt(10, 122, 'cibles : −23 LUFS intégré (±0,5 LU au PAD, ±1 LU en direct), −1 dBTP de crête vraie, LRA selon le genre (sport : 10 à 15 LU)', 'co-s', 'start'));
  // les portes
  const Y = 200, X = (i) => 60 + i * 26;
  f.append(txt(10, 148, 'Les portes de la mesure intégrée (blocs de 400 ms)', 'co-t', 'start'));
  const blocs = [-22, -20, -24, -21, -75, -78, -23, -19, -40, -42, -22, -21, -24, -20, -23, -22, -60, -21, -19, -23, -22, -24, -21, -20];
  const moy = loudnessIntegre(blocs);
  blocs.forEach((v, i) => { const h = Math.max(2, (v + 80) / 60 * 44); const garde = v > -70 && v > moy.seuilRelatif; f.append(sv('rect', { x: X(i), y: Y - h, width: 20, height: h, fill: garde ? C.amber : v > -70 ? C.grey : C.line, opacity: garde ? 0.9 : 0.6 })); });
  f.append(sv('line', { x1: 60, y1: Y - (10 / 60) * 44, x2: 690, y2: Y - (10 / 60) * 44, stroke: C.red, strokeDasharray: '3 3' }), txt(692, Y - (10 / 60) * 44 + 4, '−70 : porte absolue', 'co-s', 'start', { fill: C.red }));
  f.append(sv('line', { x1: 60, y1: Y - (moy.seuilRelatif + 80) / 60 * 44, x2: 690, y2: Y - (moy.seuilRelatif + 80) / 60 * 44, stroke: C.cyan, strokeDasharray: '3 3' }), txt(692, Y - (moy.seuilRelatif + 80) / 60 * 44 + 4, `${moins(moy.seuilRelatif, 0)} : porte relative (−10 LU)`, 'co-s', 'start', { fill: C.cyan }));
  f.append(txt(10, Y + 18, `ambre : les blocs gardés ; gris : exclus par la porte relative ; sombre : exclus par la porte absolue. Intégré : ${moins(moy.lufs, 1)} LUFS (sans porte : ${moins(moy.sansPorte, 1)}).`, 'co-s', 'start'));
  f.append(txt(10, Y + 34, 'Les portes ne gardent que ce qui compte pour l\'oreille : le programme lui-même.', 'co-s', 'start'));
  return f;
}
function demoLoudness(host) {
  // le programme : des segments avec leur loudness court terme (ordre de grandeur) et leur durée en blocs de 3 s
  const SEG = [
    { nom: 'générique', l: -19, n: 10, tp: -3 }, { nom: 'plateau', l: -24, n: 14, tp: -8 }, { nom: 'match (foule)', l: -22, n: 60, tp: -6 },
    { nom: 'silence (incident)', l: -80, n: 6, tp: -60 }, { nom: 'page de pub', l: -16, n: 10, tp: -1 }, { nom: 'interview', l: -27, n: 16, tp: -12 },
  ];
  let pub = -16, sil = -80, fTp = 1000;
  const read = readout(['Loudness intégré (avec portes)', 'Moyenne sans porte', 'Plage de loudness (LRA)', 'Gain pour viser −23 LUFS', 'Crête vraie après ce gain', 'Un crête-mètre à échantillons lirait']);
  const verdict = el('p', { class: 'co-verdict' });
  const cv = canvas(720, 170, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const draw = () => {
    const segs = SEG.map((s) => ({ ...s, l: s.nom === 'page de pub' ? pub : s.nom.startsWith('silence') ? sil : s.l, tp: s.nom === 'page de pub' ? pub + 15 : s.nom.startsWith('silence') ? sil + 20 : s.tp }));
    const blocs = segs.flatMap((s) => Array(s.n).fill(s.l));
    const I = loudnessIntegre(blocs), lra = plageLoudness(blocs);
    const tp = Math.max(...segs.map((s) => s.tp));
    const N = normaliser(I.lufs, tp);
    g.fillStyle = C.ink; g.fillRect(0, 0, 720, 170);
    const total = segs.reduce((a, s) => a + s.n, 0);
    let x = 20;
    const Y = (v) => 130 - (Math.max(-40, v) + 40) / 40 * 100;
    g.font = '11px Arial, sans-serif';
    for (const s of segs) {
      const w = s.n / total * 680;
      const garde = s.l > -70 && s.l > I.seuilRelatif;
      g.fillStyle = garde ? 'rgba(255,211,138,.75)' : 'rgba(138,148,156,.35)'; g.fillRect(x, Y(s.l), w - 2, 130 - Y(s.l));
      g.fillStyle = '#aab4ba'; g.save(); g.translate(x + 4, 146); g.fillText(s.nom, 0, 0); g.restore();
      x += w;
    }
    for (const v of [-10, -23, -30, -40]) { g.strokeStyle = v === -23 ? C.green : '#2a3238'; g.setLineDash(v === -23 ? [4, 3] : []); g.beginPath(); g.moveTo(20, Y(v)); g.lineTo(700, Y(v)); g.stroke(); g.fillStyle = '#6f7a84'; g.fillText(`${v} LUFS`.replace('-', '−'), 2, Y(v) - 2); }
    g.setLineDash([]);
    g.strokeStyle = C.white; g.beginPath(); g.moveTo(20, Y(I.lufs)); g.lineTo(700, Y(I.lufs)); g.stroke(); g.fillStyle = C.white; g.fillText(`intégré ${moins(I.lufs, 1)} LUFS`, 560, Y(I.lufs) - 4);
    read.set('Loudness intégré (avec portes)', `${moins(I.lufs, 1)} LUFS (${I.gardes} blocs gardés sur ${I.total}, porte relative à ${moins(I.seuilRelatif, 1)})`);
    read.set('Moyenne sans porte', `${moins(I.sansPorte, 1)} LUFS : le silence tire la mesure vers le bas de ${fmtNum(I.lufs - I.sansPorte, 1)} LU`);
    read.set('Plage de loudness (LRA)', `${fmtNum(lra, 1)} LU${lra > 15 ? ' : programme très contrasté' : lra < 5 ? ' : programme plat' : ''}`);
    read.set('Gain pour viser −23 LUFS', `${dB(N.gain)}`);
    read.set('Crête vraie après ce gain', `${moins(N.crete, 1)} dBTP${N.ok ? ' : sous −1 dBTP' : ` : dépasse de ${fmtNum(N.limiter, 1)} dB, le limiteur du départ devra intervenir`}`);
    read.set('Un crête-mètre à échantillons lirait', `${moins(creteEchantillons(fTp), 2)} dBFS pour une sinusoïde à ${fTp >= 1000 ? fmtNum(fTp / 1000, 1) + ' kHz' : fTp + ' Hz'} dont la crête vraie est à 0 dBTP (pire cas à 12 kHz : −3 dB)`);
    const ecart = I.lufs + 23;
    verdict.className = 'co-verdict ' + (Math.abs(ecart) <= 1 ? 'ok' : Math.abs(ecart) <= 3 ? 'warn' : 'ko');
    verdict.textContent = Math.abs(ecart) <= 1 ? `Le programme est à ${dB(ecart)} de la cible : dans la tolérance du direct (±1 LU).` : `Le programme est ${fmtNum(Math.abs(ecart), 1)} LU ${ecart > 0 ? 'trop fort' : 'trop bas'} : ${ecart > 0 ? 'la pub ou le générique poussent la moyenne' : 'un plateau et une interview trop discrets'}. ${Math.abs(ecart) > 3 ? 'Un PAD serait refusé.' : ''}`;
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Loudness de la page de pub', -30, -10, pub, 1, (v) => { pub = v; draw(); }, (v) => `${moins(v, 0)} LUFS`),
      slider('Le silence de l\'incident', -80, -50, sil, 1, (v) => { sil = v; draw(); }, (v) => `${moins(v, 0)} LUFS`),
      slider('Fréquence pour la crête vraie', 100, 20000, fTp, 100, (v) => { fTp = v; draw(); }, (v) => (v >= 1000 ? `${fmtNum(v / 1000, 1)} kHz` : `${v} Hz`))),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le programme, segment par segment, avec son loudness court terme ; en ambre, ce que les portes gardent ; la ligne blanche est l\'intégré, la verte la cible −23 LUFS.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 3. L'audio numérique
// ======================================================================================
function figNumerique() {
  const f = figure(720, 250, 'La chaîne audio numérique du car : le micro et son préamplificateur, le convertisseur analogique-numérique (48 kHz, 24 bits : 1,152 Mb/s par canal), puis les liaisons numériques : AES3 (deux canaux sur un XLR 110 Ω ou un BNC 75 Ω, 3,072 Mb/s), MADI (64 canaux à 48 kHz dans un coaxial ou une fibre, 125 Mb/s) entre la stagebox et la console, Dante ou AES67 et ST 2110-30 (des canaux dans des paquets IP). Tout bat à la même horloge (word clock, ou le PTP en IP). En dessous, l\'échantillonnage : à 48 kHz, 48 000 valeurs par seconde, et rien au-dessus de 24 kHz (Nyquist).');
  f.append(txt(10, 16, 'De la membrane au paquet', 'co-t', 'start'));
  const row = [['Micro', 'quelques mV'], ['Préampli', '+40 à +60 dB'], ['CAN', '48 kHz · 24 bits'], ['AES3', '2 canaux · 3,072 Mb/s'], ['MADI', '64 canaux · 125 Mb/s'], ['IP', 'Dante · AES67 · 2110-30']];
  row.forEach(([a, b], i) => { const x = 10 + i * 118; f.append(box(x, 30, 104, 44, i === 2 ? C.amber : i >= 3 ? C.cyan : C.grey), txt(x + 52, 48, a, 'co-t'), txt(x + 52, 64, b, 'co-s')); if (i < row.length - 1) f.append(arrow(x + 106, 52, x + 116, 52)); });
  f.append(sv('path', { d: 'M300 76 V92 H660 V76', fill: 'none', stroke: C.green, strokeDasharray: '4 3' }), txt(480, 106, 'une seule horloge pour tous : word clock (ou AES), PTP en IP', 'co-s', 'middle', { fill: C.green }));
  // l'échantillonnage
  const x0 = 60, y0 = 190, w = 400;
  f.append(txt(10, 134, 'L\'échantillonnage : 48 000 valeurs par seconde, chacune sur 24 bits', 'co-t', 'start'));
  let d = ''; for (let i = 0; i <= 200; i++) { const t = i / 200; d += (i ? 'L' : 'M') + (x0 + t * w).toFixed(1) + ' ' + (y0 - 36 * Math.sin(t * 2 * Math.PI * 2.5)).toFixed(1); }
  f.append(sv('path', { d, fill: 'none', stroke: C.grey, strokeWidth: 1.2 }));
  for (let i = 0; i <= 24; i++) { const t = i / 24; const y = y0 - 36 * Math.sin(t * 2 * Math.PI * 2.5); f.append(sv('line', { x1: x0 + t * w, y1: y0, x2: x0 + t * w, y2: y, stroke: C.amber }), sv('circle', { cx: x0 + t * w, cy: y, r: 2.5, fill: C.amber })); }
  f.append(sv('line', { x1: x0, y1: y0, x2: x0 + w, y2: y0, stroke: C.line }), txt(x0 + w / 2, y0 + 44, 'un échantillon toutes les 20,8 µs ; 48 échantillons = 1 ms', 'co-s'));
  f.append(box(490, 150, 220, 84, C.grey), txt(600, 168, 'Nyquist : f max = fs ÷ 2', 'co-t'), txt(600, 184, '48 kHz → 24 kHz portés', 'co-s'), txt(600, 198, '24 bits → 146 dB de dynamique théorique', 'co-s'), txt(600, 212, '16 bits (CD) → 98 dB', 'co-s'), txt(600, 226, 'latence = échantillons ÷ fs', 'co-s'));
  return f;
}
function demoNumerique(host) {
  let fs = 48000, bits = 24, canaux = 2, tampon = 64, ppm = 50;
  const read = readout(['Débit du flux PCM', 'Fréquence la plus haute portée', 'Dynamique théorique', 'AES3 à cette fréquence', 'MADI à cette fréquence', 'Dante pour ces canaux', 'Latence du tampon', 'Deux horloges non verrouillées']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const d = debitPcm(fs, bits, canaux);
    read.set('Débit du flux PCM', `${fmtNum(fs / 1000, fs % 1000 ? 1 : 0)} kHz × ${bits} bits × ${canaux} canal${canaux > 1 ? 'aux' : ''} = ${fmtNum(d / 1e6, 3)} Mb/s`);
    read.set('Fréquence la plus haute portée', `${fmtNum(nyquist(fs) / 1000, 1)} kHz (Nyquist)${fs >= 88200 ? ' : au-delà de l\'oreille, utile seulement en production musicale' : ''}`);
    read.set('Dynamique théorique', `${fmtNum(dynamiqueDb(bits), 0)} dB (6,02 × ${bits} + 1,76)${bits >= 24 ? ' : bien plus que le micro et le préampli (120 dB au mieux)' : bits <= 16 ? ' : il faut travailler haut dans l\'échelle' : ''}`);
    read.set('AES3 à cette fréquence', `${fmtNum(debitAes3(fs) / 1e6, 3)} Mb/s pour 2 canaux (64 bits par trame)`);
    read.set('MADI à cette fréquence', `${canauxMadi(fs)} canaux dans un seul coaxial ou une fibre`);
    read.set('Dante pour ces canaux', `${Math.ceil(canaux / 4)} flux de 4 canaux au plus, ≈ ${fmtNum(debitDante(canaux) / 1e6, 1)} Mb/s en-têtes compris`);
    read.set('Latence du tampon', `${tampon} échantillons = ${fmtNum(latenceTampon(tampon, fs), 2)} ms à ${fmtNum(fs / 1000, fs % 1000 ? 1 : 0)} kHz`);
    const der = deriveEchantillons(ppm, fs);
    read.set('Deux horloges non verrouillées', `${ppm} ppm d'écart : ${fmtNum(der, 1)} échantillons de décalage par seconde, un clic ${der >= 1 ? `toutes les ${fmtNum(1 / der, 2)} s` : `toutes les ${fmtNum(1 / der, 1)} s`}`);
    verdict.className = 'co-verdict ' + (fs === 48000 && bits === 24 ? 'ok' : 'warn');
    verdict.textContent = fs === 48000 && bits === 24 ? '48 kHz, 24 bits : le format de la télévision (EBU, SMPTE, ST 2110-30 niveau A). Tout le car y bat.' : fs === 44100 ? '44,1 kHz : le CD. Un convertisseur de fréquence (SRC) sera nécessaire pour entrer dans un car à 48 kHz, avec sa latence.' : bits === 16 ? '16 bits : 98 dB de dynamique, il faut viser haut ; le car travaille en 24 bits pour garder de la marge.' : '96 kHz : deux fois plus de débit et deux fois moins de canaux par MADI, pour un gain que la diffusion ne porte pas.';
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Fréquence d\'échantillonnage', [['44100', '44,1 kHz'], ['48000', '48 kHz'], ['96000', '96 kHz']], '48000', (v) => { fs = +v; draw(); }),
      choice('Quantification', [['16', '16 bits'], ['24', '24 bits']], '24', (v) => { bits = +v; draw(); }),
      slider('Canaux', 1, 64, canaux, 1, (v) => { canaux = v; draw(); }),
      slider('Tampon', 16, 1024, tampon, 16, (v) => { tampon = v; draw(); }, (v) => `${v} éch.`),
      slider('Écart entre deux horloges', 1, 200, ppm, 1, (v) => { ppm = v; draw(); }, (v) => `${v} ppm`)),
    verdict, read.el);
  draw();
}

// ======================================================================================
// les leçons
// ======================================================================================
/** @type {import('./index.js').Lesson[]} */
export const SON_TRAITEMENT = [
  {
    id: 'son-dynamique', title: 'Compresseur, limiteur, gate', minutes: '8 min',
    essentials: [
      'Un **compresseur** réduit le gain au-dessus d\'un **seuil** : au-delà, 1 dB d\'entrée en plus ne donne que 1/**ratio** dB (4:1 : 4 dB d\'entrée → 1 dB de sortie) ; le **gain de rattrapage** remonte ensuite le tout.',
      'Le **limiteur** est un compresseur à ratio infini et attaque très courte : un plafond que rien ne dépasse (**−1 dBTP** au départ) ; le **gate** coupe sous un seuil (la foule entre deux phrases).',
      '**Attaque** et **relâchement** se règlent à l\'oreille : attaque courte pour les crêtes, plus longue pour garder le mordant ; relâchement trop court = pompage.',
    ],
    figure: figDynamique,
    demoTitle: 'Baissez le seuil et montez le ratio : regardez la réduction de gain sur les phrases, puis sur le cri. Mettez le ratio à l\'infini. Montez le seuil du gate jusqu\'à couper la foule.',
    demo: demoDynamique,
    body: `La **dynamique** d'une source est l'écart entre ses passages les plus faibles et ses crêtes. Un commentateur chuchote puis crie ; un canon reçoit la foule puis une frappe : 40 dB d'écart, trop pour l'antenne, où tout doit rester intelligible à volume constant. Les processeurs de dynamique **changent le gain au fil du temps**, automatiquement.

Le **compresseur** regarde le niveau d'entrée. Sous le **seuil** (threshold), il ne fait rien. Au-dessus, il réduit le gain selon le **ratio** : à 4:1, 4 dB d'entrée en plus ne donnent qu'1 dB de sortie en plus ; à 2:1, la moitié ; à ∞:1, plus rien ne monte (c'est le limiteur). Un **genou** (knee) dur bascule net au seuil, un genou doux arrondit la transition sur quelques décibels, plus discret sur une voix. La **réduction de gain** s'affiche sur un galvanomètre ou une barre (GR) : quelques décibels sur les crêtes, c'est du contrôle ; 12 dB en continu, c'est de l'écrasement. Comme tout est plus bas, un **gain de rattrapage** (make-up) remonte la sortie : les crêtes reviennent où elles étaient, et ce sont les passages faibles qui ont monté. C'est le prix du compresseur : il remonte aussi la foule, la salle, le souffle.

Le temps compte autant que la courbe. L'**attaque** est le temps que met la réduction à s'installer à l'arrivée d'une crête : courte (1 à 5 ms), elle rattrape les transitoires (un tir, une plosive) mais ternit l'impact ; longue (20 à 50 ms), elle laisse passer l'attaque de chaque mot, le mordant, et ne tient que le corps du son. Le **relâchement** (release) est le temps pour revenir au gain normal après la crête : trop court, le gain remonte et redescend à chaque syllabe et l'on entend le niveau « pomper » ; trop long, la phrase suivante arrive encore tassée. Sur une voix, 50 à 300 ms ; sur une ambiance, plus. Le **limiteur** est un compresseur à ratio infini, attaque quasi nulle (souvent avec un regard en avance, look-ahead) : un **plafond** absolu. Au départ du car, il protège la chaîne et garantit la crête vraie sous **−1 dBTP** (leçon suivante) ; il ne doit presque jamais travailler, sinon c'est le mélange qui est trop fort.

Le **gate** (noise gate) fait l'inverse : sous son seuil, il **coupe** (ou atténue d'une plage réglable, range). Sur le micro-casque d'un commentateur, il ferme la voie entre deux phrases : la foule qui entrait par son micro disparaît du mélange, et l'ambiance reste celle des couples, propre. Il faut un seuil au-dessus de la foule et sous la voix la plus douce, et un relâchement assez long pour ne pas couper la fin des mots. L'**expandeur** est un gate progressif (ratio 1:2, 1:4), plus naturel. Le **dé-esseur** est un compresseur qui n'écoute que les sifflantes.

- Ordre dans la tranche : gate avant compresseur (on ne compresse pas le bruit), égaliseur selon le cas, limiteur en dernier, sur les bus.
- On règle en écoutant la réduction de gain : elle doit bouger avec la musique du son, pas rester allumée.`,
    car: { text: 'En cabine son, la molette verte (dynamique) des écrans Vistonics ouvre le gate et le compresseur de chaque tranche ; le Control Bay montre la réduction de gain. Le limiteur du départ veille sur la crête vraie.', station: 'son' },
    terms: ['compresseur', 'dbfs'],
    competences: ['C23', 'C32'], savoirs: ['I5', 'I11', 'I6'],
    quiz: [
      { q: 'Un compresseur 4:1, seuil −20 dB. Une crête entre à −8 dB. Elle sort à…', choices: ['−17 dB', ['−2 dB', 'Ce serait 4 fois moins de réduction : 12 dB au-dessus du seuil divisés par 4 font 3 dB, pas 18.'], ['−32 dB', 'Le ratio ne divise que ce qui dépasse le seuil (12 dB → 3 dB), pas le niveau entier.']], answer: 0, why: 'La crête dépasse le seuil de 12 dB ; à 4:1, il n\'en reste que 3 : −20 + 3 = −17 dB, soit 9 dB de réduction de gain.' },
      { q: 'À quoi sert le gain de rattrapage ?', choices: ['À remonter la sortie compressée pour retrouver le niveau des crêtes', ['À augmenter le ratio', 'Le ratio est un réglage à part ; le rattrapage ne touche qu\'au niveau de sortie.'], ['À couper le bruit entre les phrases', 'C\'est le rôle du gate. Le rattrapage remonte tout, bruit compris.']], answer: 0, why: 'Après compression, tout est plus bas ; le make-up remonte la sortie. Résultat : les crêtes reviennent, et ce sont les passages faibles (et le fond) qui ont monté.' },
      { q: 'Quel réglage distingue un limiteur d\'un compresseur ?', choices: ['Un ratio infini et une attaque quasi nulle', ['Un seuil plus bas', 'Le seuil d\'un limiteur est au contraire haut, près du plafond ; c\'est son ratio infini qui en fait un plafond.'], ['Un gain de rattrapage plus fort', 'Le limiteur se place en fin de chaîne pour plafonner, pas pour remonter.']], answer: 0, why: 'Ratio ∞:1 : rien ne dépasse le seuil ; attaque nulle (souvent avec look-ahead) : même un transitoire est rattrapé. Au départ, il garantit la crête vraie sous −1 dBTP.' },
      { q: 'Sur la voix du commentateur, le niveau monte et descend à chaque syllabe : on entend « pomper ». Que régler ?', choices: ['Allonger le relâchement', ['Raccourcir l\'attaque', 'L\'attaque règle l\'arrivée de la réduction ; le pompage vient du gain qui remonte trop vite entre les syllabes : c\'est le relâchement.'], ['Monter le seuil du gate', 'Le gate coupe sous un seuil ; il ne fait pas respirer le gain au rythme des syllabes.']], answer: 0, why: 'Un relâchement trop court laisse le gain remonter entre chaque syllabe, puis redescendre à la suivante : le niveau respire. On l\'allonge (100 à 300 ms sur une voix).' },
      { q: 'Où règle-t-on le seuil du gate du micro-casque d\'un commentateur ?', choices: ['Au-dessus de la foule qui entre par son micro, sous sa voix la plus douce', ['Au-dessus de sa voix', 'Le gate serait fermé pendant qu\'il parle : la voix serait coupée.'], ['Le plus bas possible', 'Un seuil sous la foule ne ferme jamais : le gate ne sert à rien.']], answer: 0, why: 'Le gate doit s\'ouvrir sur la voix et se fermer sur la foule : seuil entre les deux, relâchement assez long pour ne pas couper les fins de mots.' },
      { q: 'Dans quel ordre placer gate et compresseur sur une tranche ?', choices: ['Le gate avant le compresseur', ['Le compresseur avant le gate', 'Compressé d\'abord, le bruit de fond remonte avec le rattrapage et le gate a plus de mal à le distinguer de la voix.'], ['Peu importe', 'L\'ordre change le résultat : on ne compresse pas ce qu\'on va couper.']], answer: 0, why: 'On coupe d\'abord ce qui ne doit pas passer, puis on compresse la voix seule : le compresseur ne remonte pas la foule entre les phrases.' },
    ],
  },
  {
    id: 'son-loudness', title: 'Le loudness : EBU R128, LUFS et crête vraie', minutes: '9 min',
    essentials: [
      'On ne norme plus les crêtes mais la **sonie** : le programme vise **−23 LUFS** intégré (±1 LU en direct, ±0,5 au PAD), mesuré sur tout le programme avec des **portes** (−70 LUFS absolue, −10 LU relative) qui ignorent les silences.',
      'La **crête vraie** (dBTP) se lit entre les échantillons (suréchantillonnage ×4) : plafond **−1 dBTP** ; un crête-mètre à échantillons peut lire jusqu\'à 3 dB de moins.',
      'Trois lectures : **momentané** (400 ms), **court terme** (3 s), **intégré** ; la **plage de loudness** (LRA) dit si le programme est plat ou contrasté.',
    ],
    figure: figLoudness,
    demoTitle: 'Montez la page de pub à −10 LUFS : l\'intégré dérive. Remontez le silence de −80 à −50 : il passe les portes et pèse. Cherchez la fréquence où un crête-mètre à échantillons se trompe le plus.',
    demo: demoLoudness,
    body: `Pendant des décennies, on a normé les **crêtes** (le PPM à −9 dBFS, le 1 kHz à −18 dBFS). Résultat : des pubs compressées à mort, aussi fortes qu'un cri et perçues bien plus fort que le film. L'EBU R128 (2010) a changé la règle : on norme la **sonie** perçue, le **loudness**, et l'on laisse les crêtes libres sous un plafond. La mesure (ITU-R BS.1770) pondère le signal comme l'oreille (filtre **K** : moins de grave, un peu plus d'aigu), additionne les canaux et intègre dans le temps ; l'unité est le **LUFS** (loudness unit, full scale), et une différence se dit en **LU** (1 LU = 1 dB).

Le mètre donne trois lectures. Le **momentané** (M, fenêtre de 400 ms) suit le mélange en direct ; le **court terme** (S, 3 s) lisse ; l'**intégré** (I) est la moyenne de **tout le programme**, du début à la fin. Pour que les silences et les respirations ne tirent pas cette moyenne vers le bas, elle passe par deux **portes** : une porte **absolue** à −70 LUFS (le silence ne compte pas), puis une porte **relative** 10 LU sous la moyenne de ce qui reste (le fond discret ne compte pas non plus). Et la moyenne se fait en puissance, pas en décibels. La cible : **−23 LUFS** intégré, avec ±0,5 LU de tolérance pour un PAD et ±1 LU pour le direct. La **plage de loudness** (LRA, en LU) mesure l'étendue entre les passages discrets et forts (centiles 10 à 95 du court terme) : 5 LU, c'est plat ; 10 à 15 LU, un match avec ses temps forts ; 20 LU, un film qu'on ne pourra pas suivre dans un salon bruyant.

Les crêtes, elles, ne sont pas lues sur les échantillons mais entre eux : une sinusoïde aiguë peut passer entre deux échantillons sans qu'aucun ne touche sa crête, et le vrai signal analogique reconstruit dépasse ce que l'on a lu, jusqu'à 3 dB. La **crête vraie** (true peak, en **dBTP**) est mesurée en suréchantillonnant ×4 (ou plus) : le plafond est **−1 dBTP**, pour que le convertisseur, le codeur et le limiteur de la chaîne ne saturent pas. Un programme à −23 LUFS a en général des crêtes vers −8 à −3 dBTP : les crêtes ne sont plus ce qui limite.

Dans le car, le mélange se fait à l'oreille et au loudness-mètre du Control Bay : on vise −23 LUFS court terme en régime de croisière, on surveille l'intégré sur la période, et le **limiteur du départ** garantit la crête vraie. Une page de pub plus forte que le programme n'est plus un argument de vente : à −23 LUFS, elle sonne comme le reste. Au **PAD** (prêt à diffuser), le fichier livré est mesuré sur sa durée : intégré, LRA, crête vraie, et refusé hors tolérance ; un fichier à −20 LUFS est simplement baissé de 3 dB, à condition que ses crêtes restent sous −1 dBTP après coup.

- Pour un programme de moins d'une minute, la lecture momentanée ou court terme fait foi (le R128 s3 détaille les programmes courts).
- Pour les plateformes et la radio, d'autres cibles (−16 à −14 LUFS) : on ne mélange pas pour elles, on normalise après.`,
    car: { text: 'En cabine son, le loudness-mètre du Control Bay (M, S, I, LRA, crête vraie) suit le programme ; au départ, le limiteur tient la crête vraie sous −1 dBTP. La leçon Le PAD reprend la conformité du fichier livré.', station: 'son' },
    terms: ['lufs', 'dbtp', 'compresseur'],
    competences: ['C32', 'C10', 'C33'], savoirs: ['C12', 'C10', 'I13'],
    quiz: [
      { q: 'Quelle est la cible de loudness intégré d\'un programme de télévision en Europe (EBU R128) ?', choices: ['−23 LUFS', ['−18 LUFS', '−18 dBFS est le niveau d\'alignement du 1 kHz, une crête ; le loudness intégré vise −23 LUFS.'], ['−1 LUFS', '−1 dBTP est le plafond des crêtes vraies, pas une cible de loudness.']], answer: 0, why: 'L\'EBU R128 norme la sonie : −23 LUFS intégré sur tout le programme (±0,5 LU au PAD, ±1 LU en direct), crête vraie sous −1 dBTP.' },
      { q: 'À quoi servent les portes de la mesure intégrée ?', choices: ['À ne pas compter les silences et les passages très discrets dans la moyenne', ['À limiter les crêtes', 'Les portes ne touchent pas au signal : elles choisissent ce qui entre dans la moyenne.'], ['À mesurer seulement les 400 dernières millisecondes', 'C\'est la lecture momentanée. L\'intégré couvre tout le programme, portes comprises.']], answer: 0, why: 'Porte absolue à −70 LUFS (le silence), porte relative 10 LU sous la moyenne (le fond discret) : la moyenne ne représente que le programme lui-même.' },
      { q: 'Pourquoi mesurer une crête « vraie » plutôt que la crête des échantillons ?', choices: ['Le signal reconstruit entre deux échantillons peut dépasser le plus haut d\'entre eux, jusqu\'à 3 dB', ['Parce que le dBTP est plus précis au dixième', 'Ce n\'est pas une question de précision d\'affichage : les échantillons ratent la crête qui passe entre eux.'], ['Parce que les crêtes vraies sont toujours plus basses', 'C\'est l\'inverse : la crête vraie est toujours supérieure ou égale à la crête des échantillons.']], answer: 0, why: 'Une sinusoïde aiguë peut n\'avoir aucun échantillon sur sa crête ; le signal analogique reconstruit la dépasse. Le suréchantillonnage ×4 la retrouve : plafond −1 dBTP.' },
      { q: 'Un PAD mesure −20 LUFS intégré, crête vraie −4 dBTP. Que fait-on ?', choices: ['On le baisse de 3 dB : −23 LUFS, crête −7 dBTP, conforme', ['On le compresse davantage', 'Il n\'est pas trop dynamique, il est trop fort. Baisser le gain suffit, sans toucher au mélange.'], ['On le monte de 3 dB', '−20 est au-dessus de −23 : le programme est trop fort, il faut le baisser.']], answer: 0, why: 'Le loudness se corrige par un gain global : −3 dB ramène l\'intégré à −23 LUFS et la crête vraie à −7 dBTP, sous le plafond. Rien d\'autre à changer.' },
      { q: 'Que mesure la plage de loudness (LRA) ?', choices: ['L\'étendue entre les passages discrets et forts du programme (centiles 10 à 95 du court terme)', ['L\'écart entre la crête vraie et le loudness intégré', 'Cet écart existe, mais il n\'a pas de nom normalisé ; la LRA décrit la variation du loudness dans le temps.'], ['La durée du programme', 'La LRA est en LU, pas en secondes : c\'est une étendue de niveaux.']], answer: 0, why: 'LRA : la distribution du loudness court terme, portes comprises, entre les centiles 10 et 95. Un match : 10 à 15 LU ; un film contrasté : 20 LU.' },
      { q: 'Le loudness-mètre court terme est à −23 LUFS, mais l\'intégré de la période affiche −26 LUFS. Pourquoi ?', choices: ['Les passages précédents ont été trop discrets : la moyenne sur tout le programme traîne', ['Le court terme est faux', 'Les deux lectures sont justes : elles ne regardent pas la même durée (3 s contre tout le programme).'], ['Les crêtes dépassent −1 dBTP', 'Les crêtes vraies ne changent rien au loudness ; c\'est une mesure à part.']], answer: 0, why: 'L\'intégré moyenne toute la période : un plateau trop bas pèse longtemps. On tient la croisière à −23 et l\'on surveille l\'intégré, sans pousser pour rattraper d\'un coup.' },
    ],
  },
  {
    id: 'son-numerique', title: 'L\'audio numérique : 48 kHz, 24 bits, AES3, MADI, Dante', minutes: '9 min',
    essentials: [
      'Le son numérique du car : **48 kHz** (rien au-dessus de 24 kHz, Nyquist), **24 bits** (146 dB de dynamique théorique), 1,152 Mb/s par canal ; tout bat à la même **horloge** (word clock, ou le PTP en IP).',
      '**AES3** : deux canaux dans un câble (XLR 110 Ω ou BNC 75 Ω), 3,072 Mb/s ; **MADI** : 64 canaux dans un coaxial ou une fibre ; **Dante**, **AES67** et **ST 2110-30** : des canaux dans des paquets IP.',
      'Une **latence** se compte en échantillons (48 = 1 ms) ; une horloge non verrouillée **dérive** et fait des clics.',
    ],
    figure: figNumerique,
    demoTitle: 'Passez de 48 à 96 kHz : le débit double, le MADI perd la moitié de ses canaux. Comparez 16 et 24 bits. Montez le tampon à 1 024 échantillons. Écartez deux horloges de 200 ppm.',
    demo: demoNumerique,
    body: `Le convertisseur analogique-numérique (**CAN**) mesure la tension du micro à intervalles réguliers. La **fréquence d'échantillonnage** fixe combien de fois par seconde : **48 kHz** en télévision (44,1 kHz pour le CD, 96 kHz en production musicale). Le théorème de Nyquist dit qu'on ne porte rien au-dessus de la moitié : **24 kHz**, au-delà de l'oreille ; un filtre anti-repliement coupe ce qui dépasse avant la conversion. La **quantification** fixe la précision de chaque mesure : **24 bits**, soit 16,7 millions de valeurs, une dynamique théorique de 146 dB (6,02 × bits + 1,76) : bien plus que le préampli et le micro (120 dB au mieux), ce qui laisse de la marge pour régler bas sans souffle ; en 16 bits (CD), 98 dB, il faut viser plus haut. Le débit d'un canal : 48 000 × 24 = **1,152 Mb/s**, sans compression (le son de la télévision n'en a pas besoin, à l'inverse de l'image).

Une fois numérique, le son voyage sans perte, à condition de passer d'une machine à l'autre dans un format commun. **AES3** (aussi AES/EBU) porte **deux canaux** dans un câble : symétrique sur XLR en 110 Ω, ou asymétrique sur BNC en 75 Ω (AES3id, le format des grilles vidéo, qui ne tolère pas le câble micro ordinaire) ; chaque trame vaut 64 bits, soit **3,072 Mb/s** à 48 kHz ; les deux canaux s'y rangent dans des sous-trames avec leurs bits d'état. **MADI** (AES10) multiplexe **64 canaux** à 48 kHz (32 à 96 kHz) sur un coaxial 75 Ω ou une fibre, à 125 Mb/s : c'est le lien entre la **stagebox** (les préamplis et convertisseurs au plus près des micros, dans le car ou sur le bord du terrain) et la console. Le SDI embarque aussi le son (ST 299-1 : 16 canaux en HD), lu plus loin dans ce Cours.

Sur IP, le son devient des paquets. **Dante** (Audinate) est le réseau audio le plus répandu en sonorisation et en studio : un contrôleur logiciel relie les canaux, un flux porte jusqu'à 4 canaux (ordre de grandeur de 1,5 Mb/s par canal avec les en-têtes), le tout sur un réseau Gigabit ordinaire avec PTP pour l'horloge ; **AES67** est la norme d'interopérabilité (RTP, 48 kHz, paquets de 1 ms) que Dante et les autres savent parler ; **ST 2110-30** l'adopte pour le car IP, où chaque départ est un flux séparé de l'image, horodaté par le PTP. Dans tous les cas, une seule **horloge** commande tous les convertisseurs : le **word clock** (une impulsion par échantillon, BNC 75 Ω) ou un signal AES de référence dans un car SDI, le **PTP** sur IP. Deux appareils qui tournent chacun sur leur horloge, même « à 48 kHz », s'écartent de quelques ppm : le récepteur manque ou double un échantillon par seconde, un **clic**, puis un autre. Un convertisseur de fréquence (SRC) l'évite au prix d'un peu de latence.

La **latence** se compte en échantillons : chaque étage (convertisseur, traitement, réseau) travaille sur un **tampon**, 48 échantillons = 1 ms à 48 kHz, 256 = 5,3 ms. Les tampons s'additionnent le long de la chaîne : un commentateur qui s'entend dans son casque avec 10 ms de retard se trouble ; d'où les retours en direct, avant les traitements lourds, et la synchro labiale (leçon N-1) qui compense le reste.

- Sur la liste de câblage : AES (110 Ω XLR ou 75 Ω BNC), MADI (coax ou fibre, et son mode 56 ou 64 canaux), Dante (le réseau et son VLAN), word clock (qui est maître).
- Un câble micro sur une liaison AES3 marche « souvent » et casse un jour : l'impédance compte.`,
    car: { text: 'En cabine son, les cartes D21m de la stagebox convertissent les micros et renvoient le tout en MADI vers la console ; la page E/S montre chaque entrée. Au poste synchro, le word clock de référence ; en car IP, les flux ST 2110-30 et le PTP.', station: 'son' },
    terms: ['aes3', 'madi', 'dante', 'st2110-30'],
    competences: ['C25', 'C32', 'C14'], savoirs: ['C2', 'C9', 'I14', 'K3'],
    quiz: [
      { q: 'Quelle est la fréquence la plus haute qu\'un échantillonnage à 48 kHz peut porter ?', choices: ['24 kHz', ['48 kHz', 'Il faut au moins deux échantillons par période : la limite est la moitié de la fréquence d\'échantillonnage.'], ['20 kHz', '20 kHz est la limite de l\'oreille, pas celle du 48 kHz, qui porte jusqu\'à 24 kHz.']], answer: 0, why: 'Nyquist : f max = fs ÷ 2. À 48 kHz, 24 kHz ; un filtre anti-repliement coupe au-dessus avant la conversion.' },
      { q: 'Combien de canaux porte une liaison AES3 ?', choices: ['Deux', ['Un', 'AES3 range deux canaux dans chaque trame (deux sous-trames) : un couple stéréo par câble.'], ['Soixante-quatre', 'Soixante-quatre canaux, c\'est le MADI (AES10), sur coaxial ou fibre.']], answer: 0, why: 'Une trame AES3 (64 bits, 3,072 Mb/s à 48 kHz) contient deux sous-trames : deux canaux, sur XLR 110 Ω ou BNC 75 Ω.' },
      { q: 'Un MADI à 96 kHz porte combien de canaux ?', choices: ['32', ['64', '64, c\'est à 48 kHz. Le débit du MADI est fixe : doubler la fréquence d\'échantillonnage divise les canaux par deux.'], ['128', 'Le lien ne grossit pas avec la fréquence d\'échantillonnage : il porte moins de canaux, pas plus.']], answer: 0, why: 'Le MADI a un débit fixe (125 Mb/s) : 64 canaux à 48 kHz, 32 à 96 kHz, 16 à 192 kHz.' },
      { q: 'Un tampon de 256 échantillons à 48 kHz ajoute une latence de…', choices: ['5,3 ms', ['256 ms', 'Les échantillons ne sont pas des millisecondes : 48 échantillons font 1 ms.'], ['0,5 ms', '0,5 ms, ce serait 24 échantillons. 256 ÷ 48 000 = 5,3 ms.']], answer: 0, why: '256 ÷ 48 000 = 0,00533 s. Les tampons s\'additionnent le long de la chaîne : d\'où les retours en direct, avant les traitements.' },
      { q: 'Deux convertisseurs à 48 kHz, chacun sur sa propre horloge, se parlent en AES3. Qu\'entend-on ?', choices: ['Des clics réguliers : les horloges dérivent, un échantillon est manqué ou doublé', ['Rien d\'anormal : ils sont tous deux à 48 kHz', '« 48 kHz » à quelques ppm près : l\'écart s\'accumule et finit par sauter un échantillon.'], ['Un son plus aigu', 'La hauteur ne change pas de façon audible pour quelques ppm ; c\'est la perte d\'échantillons qui s\'entend.']], answer: 0, why: 'Sans horloge commune (word clock, AES de référence, PTP), les deux dérivent de quelques ppm : à 50 ppm, 2,4 échantillons par seconde, un clic toutes les 0,4 s. Un SRC l\'évite.' },
      { q: 'Quelle norme assure l\'interopérabilité de l\'audio sur IP entre Dante, les consoles et le ST 2110-30 ?', choices: ['AES67', ['AES3', 'AES3 est la liaison deux canaux sur câble, pas un protocole IP.'], ['MADI', 'MADI est un multiplex 64 canaux sur coaxial ou fibre, pas un réseau.']], answer: 0, why: 'AES67 (RTP, 48 kHz, paquets de 1 ms, PTP) est le dénominateur commun : Dante la parle, et ST 2110-30 la reprend pour le car IP.' },
    ],
  },
];
