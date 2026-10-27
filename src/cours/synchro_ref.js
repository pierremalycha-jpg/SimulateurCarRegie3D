// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import { rythmes, derive, secondesPour, phaseApres, BB, TRI, bbMv, triMv, ondeMv, mesureBB, mesureTri, APPAREILS, verrou, niveauLigne, retardCable, echoNs } from './synchro_calc.js';

// ----------------------------------------------------------------------------------
// Chapitre « La synchro », trois leçons de la référence vidéo : pourquoi synchroniser (fréquence, phase,
// dérive de deux quartz libres), les deux signaux de référence (black burst et tri-level, dessinés et mesurés
// à partir de leur définition), et la distribution de la référence (DA en étoile, entrée bouclée, bouchon
// 75 Ω, niveau doublé ou réduit, échos). Tous les chiffres viennent de cours/synchro_calc.js.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', violet: '#c9a8ff', box: '#1a2026', line: '#2a3238', fg: '#e8eef2' };
const txt = (x, y, s, cls = 'co-s', anchor = 'start', fill = '') => sv('text', { x, y, textAnchor: anchor, class: cls, ...(fill ? { style: `fill: ${fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const ln = (x1, y1, x2, y2, col = C.grey, w = 1.3, dash = '') => sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: w, ...(dash ? { 'stroke-dasharray': dash } : {}) });
const signe = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v), d);
/** une durée en secondes, écrite simplement */
export function duree(s) {
  if (!Number.isFinite(s)) return 'jamais';
  if (s < 1e-3) return `${fmtNum(s * 1e6, 1)} µs`;
  if (s < 1) return `${fmtNum(s * 1000, 1)} ms`;
  if (s < 60) return `${fmtNum(s, 1)} s`;
  if (s < 3600) { const m = Math.floor(s / 60), r = Math.round(s % 60); return `${m} min${r ? ` ${r} s` : ''}`; }
  if (s < 86400 * 2) { const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60); return `${h} h${m ? ` ${m} min` : ''}`; }
  return `${fmtNum(s / 86400, 1)} jours`;
}
/** un décalage en µs, écrit dans l'unité qui parle */
const us = (v) => (Math.abs(v) < 1 ? `${signe(v * 1000, 0)} ns` : Math.abs(v) < 1000 ? `${signe(v, 2)} µs` : `${signe(v / 1000, 2)} ms`);

// ======================================================================================
// 1. Pourquoi synchroniser
// ======================================================================================
function figBases() {
  const R = rythmes('1080i50'), f = figure(720, 250, `Trois rythmes que tout le car doit tenir ensemble : une image de ${fmtNum(R.imageMs)} ms faite de 1 125 lignes, une ligne de ${fmtNum(R.ligneUs, 1)} µs faite de ${fmtNum(R.echParLigne)} échantillons, et l'audio à 48 kHz, ${fmtNum(R.audioParImage)} échantillons par image. À droite, deux quartz libres qui diffèrent de 20 ppm : ils dérivent d'une ligne en ${duree(secondesPour(20, R.ligneUs))} et d'une image en ${duree(secondesPour(20, R.imageMs * 1000))}.`);
  f.append(txt(10, 16, 'Trois rythmes à tenir ensemble (1080i50, audio 48 kHz)', 'co-t'));
  // une image, puis une ligne agrandie, puis un échantillon audio
  const X0 = 14, W = 400;
  f.append(box(X0, 30, W, 26, C.amber), txt(X0 + 6, 47, `une image : ${fmtNum(R.imageMs)} ms`, 'co-s', 'start', C.amber));
  for (let i = 1; i < 40; i++) f.append(ln(X0 + i * W / 40, 50, X0 + i * W / 40, 56, '#5a646c', 1));
  f.append(txt(X0 + W, 70, '1 125 lignes (deux champs de 20 ms)', 'co-s', 'end'));
  f.append(ln(X0 + 120, 56, X0, 84, '#5a646c', 1, '3 3'), ln(X0 + 130, 56, X0 + W, 84, '#5a646c', 1, '3 3'));
  f.append(box(X0, 84, W, 26, C.cyan), txt(X0 + 6, 101, `une ligne : ${fmtNum(R.ligneUs, 2)} µs`, 'co-s', 'start', C.cyan));
  for (let i = 1; i < 60; i++) f.append(ln(X0 + i * W / 60, 104, X0 + i * W / 60, 110, '#5a646c', 1));
  f.append(txt(X0 + W, 124, `${fmtNum(R.echParLigne)} échantillons vidéo de ${fmtNum(R.echNs, 1)} ns (74,25 MHz)`, 'co-s', 'end'));
  f.append(box(X0, 138, W, 26, C.violet), txt(X0 + 6, 155, `l'audio : un échantillon toutes les ${fmtNum(R.audioUs, 1)} µs`, 'co-s', 'start', C.violet));
  for (let i = 1; i < 48; i++) f.append(ln(X0 + i * W / 48, 158, X0 + i * W / 48, 164, '#5a646c', 1));
  f.append(txt(X0 + W, 178, `${fmtNum(R.audioParImage)} échantillons par image, exactement`, 'co-s', 'end'));
  f.append(txt(X0, 204, 'Une source en avance d\'une demi-ligne, un convertisseur audio en retard d\'un échantillon :', 'co-s'));
  f.append(txt(X0, 218, 'la coupe saute, le son claque. Tout se cale sur une seule horloge, celle du SPG.', 'co-s'));
  // deux quartz libres
  const X1 = 450;
  f.append(txt(X1, 40, 'Deux quartz libres', 'co-t'));
  for (const [k, y, ppm, col] of /** @type {[string, number, string, string][]} */ ([['A', 62, '+15 ppm', C.amber], ['B', 96, '−5 ppm', C.cyan]])) {
    f.append(txt(X1, y + 4, `${k} : ${ppm}`, 'co-s', 'start', col));
    for (let i = 0; i < 8; i++) { const x = X1 + 70 + i * 26 + (k === 'B' ? i * 1.6 : 0); f.append(ln(x, y - 8, x, y + 8, col, 2)); }
  }
  f.append(txt(X1, 128, 'écart 20 ppm : B prend 20 µs de retard par seconde', 'co-s'));
  f.append(txt(X1, 146, `une ligne de retard au bout de ${duree(secondesPour(20, R.ligneUs))}`, 'co-s'));
  f.append(txt(X1, 162, `un échantillon audio au bout de ${duree(secondesPour(20, R.audioUs))}`, 'co-s'));
  f.append(txt(X1, 178, `une image entière au bout de ${duree(secondesPour(20, R.imageMs * 1000))}`, 'co-s'));
  f.append(box(X1, 192, 256, 40, C.green), txt(X1 + 128, 208, 'Le remède : une référence commune', 'co-t', 'middle'), txt(X1 + 128, 224, 'le SPG donne le rythme, chacun le suit (genlock)', 'co-s', 'middle'));
  return f;
}
function demoBases(host) {
  let fmt = '1080i50', ppmA = 12, ppmB = -8, tLog = 55, lock = false;
  const T = () => (tLog <= 0 ? 0 : Math.round(10 ** (tLog / 100 * 4) * 10) / 10); // de 0 à 10 000 s
  const cv = canvas(720, 250, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Écart de fréquence entre A et B', 'Dérive', 'Écart après ce temps', 'En lignes', 'En échantillons audio (48 kHz)', 'Avant la première coupe qui saute']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const R = rythmes(fmt), t = T(), dppm = lock ? 0 : ppmB - ppmA;
    const ecart = lock ? 0 : derive(dppm, t); // µs, B par rapport à A
    const phImg = phaseApres(dppm, t, R.imageMs * 1000), phLig = phaseApres(dppm, t, R.ligneUs), phAud = phaseApres(dppm, t, R.audioUs);
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 250);
    // trois règles : une image, une ligne, un échantillon audio, centrées sur le top de A
    const rule = (y, label, per, ph, col, unit) => {
      const X = (v) => 360 + v / (per / 2) * 300;
      g.fillStyle = 'rgba(127,209,160,.18)'; g.fillRect(X(-per / 2), y - 14, 600, 28);
      g.strokeStyle = '#3a4650'; g.beginPath(); g.moveTo(60, y); g.lineTo(660, y); g.stroke();
      g.fillStyle = '#aab4ba'; g.font = '12px Arial, sans-serif'; g.fillText(label, 8, y - 20);
      g.fillText(`−${unit}`, 50, y + 28); g.fillText(`+${unit}`, 640, y + 28);
      g.fillStyle = C.amber; g.fillRect(X(0) - 2, y - 16, 4, 32); g.fillText('A', X(0) - 4, y - 20);
      g.fillStyle = col; g.fillRect(X(ph) - 3, y - 12, 6, 24); g.fillText('B', X(ph) + 6, y + 4);
    };
    rule(40, `sur une image (${fmtNum(R.imageMs)} ms) : B par rapport à A`, R.imageMs * 1000, phImg, C.cyan, `${fmtNum(R.imageMs / 2)} ms`);
    rule(120, `sur une ligne (${fmtNum(R.ligneUs, 2)} µs)`, R.ligneUs, phLig, Math.abs(ecart) > R.ligneUs / 2 ? C.red : C.cyan, `${fmtNum(R.ligneUs / 2, 1)} µs`);
    rule(200, `sur un échantillon audio (${fmtNum(R.audioUs, 1)} µs)`, R.audioUs, phAud, Math.abs(ecart) > R.audioUs / 2 ? C.red : C.violet, `${fmtNum(R.audioUs / 2, 1)} µs`);
    const sLigne = secondesPour(dppm, R.ligneUs / 2);
    read.set('Écart de fréquence entre A et B', lock ? '0 ppm : les deux suivent la référence' : `${signe(dppm, 0)} ppm (A ${signe(ppmA, 0)}, B ${signe(ppmB, 0)})`);
    read.set('Dérive', lock ? 'aucune' : `${fmtNum(Math.abs(dppm), 0)} µs par seconde, ${fmtNum(Math.abs(dppm) * 3.6, 1)} ms par heure`);
    read.set('Écart après ce temps', `${duree(t)} : ${us(ecart)}${Math.abs(ecart) >= R.imageMs * 1000 ? ` (${fmtNum(Math.floor(Math.abs(ecart) / (R.imageMs * 1000)))} image${Math.abs(ecart) >= 2 * R.imageMs * 1000 ? 's' : ''} entière${Math.abs(ecart) >= 2 * R.imageMs * 1000 ? 's' : ''} et plus)` : ''}`);
    read.set('En lignes', `${fmtNum(ecart / R.ligneUs, 2).replace('-', '−')} ligne(s) de ${fmtNum(R.ligneUs, 2)} µs`);
    read.set('En échantillons audio (48 kHz)', `${fmtNum(ecart / R.audioUs, 1).replace('-', '−')} échantillon(s) de ${fmtNum(R.audioUs, 1)} µs`);
    read.set('Avant la première coupe qui saute', lock ? 'jamais : A et B sont verrouillées' : `${duree(sLigne)} : le temps de dériver d'une demi-ligne (la fenêtre du mélangeur)`);
    verdict.className = 'co-verdict ' + (lock ? 'ok' : Math.abs(ecart) > R.ligneUs / 2 ? 'ko' : 'warn');
    verdict.textContent = lock ? 'Verrouillées sur la même référence : leurs tops restent l\'un sur l\'autre, quel que soit le temps. Seul reste un écart fixe (câbles, traitements), qu\'on règle une fois avec la phase.'
      : Math.abs(ecart) > R.ligneUs / 2 ? `B est sortie de la demi-ligne : une coupe de A vers B sauterait. Il a suffi de ${duree(sLigne)} à ${fmtNum(Math.abs(dppm), 0)} ppm d'écart.`
        : `Encore dans la demi-ligne, mais B dérive toujours : dans ${duree(Math.max(0, sLigne - t))}, la coupe sautera.`;
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Format', [['1080i50', '1080i50'], ['1080p50', '1080p50'], ['625i50', '625 lignes']], fmt, (v) => { fmt = v; draw(); }),
      choice('Les deux appareils', [['libre', 'libres (quartz)'], ['lock', 'verrouillés (genlock)']], 'libre', (v) => { lock = v === 'lock'; draw(); })),
    el('div', { class: 'co-ctl' },
      slider('Quartz de A', -50, 50, ppmA, 1, (v) => { ppmA = v; draw(); }, (v) => `${signe(v, 0) || '0'} ppm`),
      slider('Quartz de B', -50, 50, ppmB, 1, (v) => { ppmB = v; draw(); }, (v) => `${signe(v, 0) || '0'} ppm`),
      slider('Temps écoulé', 0, 100, tLog, 1, (v) => { tLog = v; draw(); }, () => duree(T()))),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le top de B par rapport à celui de A, sur trois échelles : la zone verte est la période entière, son milieu le top de A. Le repère devient rouge quand B a dérivé de plus d\'une demi-période.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 2. Black burst et tri-level
// ======================================================================================
/** un tracé SVG d'une forme d'onde : de t0 à t1 µs, x0..x1 px, y0 = 0 mV, k px par mV */
function trace(fn, t0, t1, x0, x1, y0, k, n = 600) {
  let d = '';
  for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; d += `${i ? 'L' : 'M'}${(x0 + (x1 - x0) * i / n).toFixed(1)} ${(y0 - fn(t) * k).toFixed(1)} `; }
  return d;
}
function figSignaux() {
  const B = mesureBB('pal'), Tq = mesureTri('1080i50');
  const f = figure(720, 270, `À gauche, le black burst PAL dessiné d'après sa définition : top de synchronisation à −300 mV pendant ${fmtNum(B.topUs, 1)} µs, salve de ${B.cycles} cycles à ${fmtNum(B.fMHz, 2)} MHz ; le repère 0H est le milieu du front descendant. À droite, le tri-level 1080i50 : −300 mV puis +300 mV, ${Tq.demi} périodes de 74,25 MHz chacune (${fmtNum(Tq.demiNs)} ns) ; le repère est le passage à 0 V du front montant.`);
  const K = 0.12;
  // black burst : de −2 à 14 µs
  f.append(txt(10, 16, 'Black burst (PAL, 625 lignes)', 'co-t'));
  const xb0 = 20, xb1 = 350, tb0 = -2, tb1 = 14, Xb = (t) => xb0 + (t - tb0) / (tb1 - tb0) * (xb1 - xb0), yb = 110;
  f.append(ln(xb0, yb, xb1, yb, '#3a4650', 1), txt(xb1, yb - 4, '0 mV', 'co-s', 'end'));
  f.append(sv('path', { d: trace((t) => bbMv(t, 'pal'), tb0, tb1, xb0, xb1, yb, K), fill: 'none', stroke: C.amber, strokeWidth: 1.6 }));
  f.append(ln(Xb(0), 40, Xb(0), 168, C.fg, 1, '2 2'), txt(Xb(0) + 3, 46, '0H (50 %)', 'co-s'));
  f.append(ln(Xb(0), 158, Xb(B.topUs), 158, C.grey, 1), txt((Xb(0) + Xb(B.topUs)) / 2, 172, `${fmtNum(B.topUs, 1)} µs`, 'co-s', 'middle'));
  f.append(txt(Xb(0.6), yb - B.topMv * K + 14, '−300 mV', 'co-s'));
  f.append(txt(Xb(B.salveDebutUs), yb - 30, `salve : ${B.cycles} cycles à ${fmtNum(B.fMHz, 2)} MHz`, 'co-s'), txt(Xb(B.salveDebutUs), yb - 18, `${fmtNum(B.salvePpMv)} mV crête à crête`, 'co-s'));
  f.append(txt(xb0, 196, `Une ligne : ${fmtNum(B.ligneUs)} µs · 625 lignes · une image de ${fmtNum(B.imageMs)} ms`, 'co-s'));
  f.append(txt(xb0, 212, `Fronts du top : ≈ ${fmtNum(B.frontNs)} ns · le repère dépend de l'amplitude (50 %)`, 'co-s'));
  // tri-level : de −1,2 à +1,6 µs
  f.append(txt(380, 16, 'Tri-level (1080i50)', 'co-t'));
  const xt0 = 390, xt1 = 710, tt0 = -1.2, tt1 = 1.6, Xt = (t) => xt0 + (t - tt0) / (tt1 - tt0) * (xt1 - xt0), yt = 100;
  f.append(ln(xt0, yt, xt1, yt, '#3a4650', 1), txt(xt1, yt - 4, '0 mV', 'co-s', 'end'));
  f.append(sv('path', { d: trace((t) => triMv(t, '1080i50'), tt0, tt1, xt0, xt1, yt, K), fill: 'none', stroke: C.cyan, strokeWidth: 1.6 }));
  f.append(ln(Xt(0), 40, Xt(0), 168, C.fg, 1, '2 2'), txt(Xt(0) + 4, 168, '0H : passage à 0 V', 'co-s'));
  const h = Tq.demiNs / 1000;
  f.append(ln(Xt(-h), 150, Xt(0), 150, C.grey, 1), txt((Xt(-h) + Xt(0)) / 2, 146, `${Tq.demi} T`, 'co-s', 'middle'));
  f.append(ln(Xt(0), 52, Xt(h), 52, C.grey, 1), txt((Xt(0) + Xt(h)) / 2, 48, `${Tq.demi} T`, 'co-s', 'middle'));
  f.append(txt(Xt(-h) - 4, yt + 300 * K + 4, '−300 mV', 'co-s', 'end'), txt(Xt(h) + 6, yt - 300 * K + 4, '+300 mV', 'co-s'));
  f.append(txt(xt0, 196, `T = 1 / 74,25 MHz = ${fmtNum(Tq.Tns, 2)} ns · ${Tq.demi} T = ${fmtNum(Tq.demiNs)} ns · fronts ≈ ${fmtNum(Tq.monteeNs)} ns`, 'co-s'));
  f.append(txt(xt0, 212, `Une ligne : ${fmtNum(Tq.ligneUs, 2)} µs (2 640 T) · symétrique, sans composante continue`, 'co-s'));
  f.append(txt(10, 244, 'Les deux portent le même rythme d\'image en 50 Hz (40 ms) : un appareil HD accepte souvent l\'un ou l\'autre ; un tri-level a un format, un black burst non.', 'co-s'));
  f.append(txt(10, 260, 'En 720p50, la demi-impulsion fait 40 T (539 ns) et la ligne 1 980 T ; en 1080i59,94, T s\'allonge de 1,001.', 'co-s'));
  return f;
}
const SIG_OPTS = /** @type {[string, string, string][]} */ ([['pal', 'BB PAL', 'Black burst 625 lignes, 50 trames/s'], ['ntsc', 'BB NTSC', 'Black burst 525 lignes, 59,94 trames/s'], ['1080i50', 'TRI 1080i50', 'Tri-level 1080 entrelacé, 25 images/s'], ['720p50', 'TRI 720p50', 'Tri-level 720 progressif, 50 images/s'], ['1080i59', 'TRI 1080i59,94', 'Tri-level 1080 entrelacé, 29,97 images/s']]);
function demoSignaux(host) {
  let sig = '1080i50', zoom = 'top', ampl = 100;
  const cv = canvas(720, 300, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Signal', 'Une ligne', 'Le top', 'Les fronts', 'Le repère 0H', 'Rythme des images']);
  const dest = el('ul', { class: 'co-rules' });
  const draw = () => {
    const isBB = !!BB[sig], k = ampl / 100;
    const L = isBB ? BB[sig].ligneUs : TRI[sig].total / TRI[sig].horloge;
    const [t0, t1] = zoom === 'ligne' ? [-2, L - 2] : isBB ? [-1.5, 9] : [-1.0, 1.2];
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 300);
    const X = (t) => 50 + (t - t0) / (t1 - t0) * 640, Y = (mv) => 150 - mv * 0.36;
    // graticule de l'oscilloscope : 100 mV par carreau
    g.strokeStyle = '#1f2a31'; g.lineWidth = 1;
    for (let mv = -400; mv <= 400; mv += 100) { g.beginPath(); g.moveTo(50, Y(mv)); g.lineTo(690, Y(mv)); g.stroke(); }
    for (let i = 0; i <= 10; i++) { const x = 50 + i * 64; g.beginPath(); g.moveTo(x, Y(400)); g.lineTo(x, Y(-400)); g.stroke(); }
    g.strokeStyle = '#3a4650'; g.beginPath(); g.moveTo(50, Y(0)); g.lineTo(690, Y(0)); g.stroke();
    g.fillStyle = '#6a747c'; g.font = '11px Arial, sans-serif';
    for (const mv of [-300, 0, 300]) g.fillText(`${mv > 0 ? '+' : mv < 0 ? '−' : ''}${Math.abs(mv)} mV`, 4, Y(mv) + 4);
    g.fillText(`${fmtNum((t1 - t0) / 10, (t1 - t0) / 10 < 1 ? 2 : 1)} µs par carreau`, 600, 292);
    // la trace
    g.strokeStyle = isBB ? C.amber : C.cyan; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i <= 1400; i++) { const t = t0 + (t1 - t0) * i / 1400; const y = Y(ondeMv(sig, t) * k); if (i) g.lineTo(X(t), y); else g.moveTo(X(t), y); }
    g.stroke();
    // le repère 0H
    g.strokeStyle = '#e8eef2'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(0), 14); g.lineTo(X(0), 286); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#e8eef2'; g.fillText(isBB ? '0H : 50 % du front' : '0H : passage à 0 V', X(0) + 4, 24);
    if (isBB) { g.strokeStyle = C.red; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(50, Y(BB[sig].topMv * k / 2)); g.lineTo(690, Y(BB[sig].topMv * k / 2)); g.stroke(); g.setLineDash([]); g.fillStyle = C.red; g.fillText(`50 % : ${fmtNum(Math.abs(BB[sig].topMv * k / 2), 0)} mV`, 600, Y(BB[sig].topMv * k / 2) - 4); }
    if (isBB) {
      const M = mesureBB(sig);
      read.set('Signal', M.nom);
      read.set('Une ligne', `${fmtNum(M.ligneUs, 2)} µs · ${fmtNum(M.lignes)} lignes · ${fmtNum(M.lignesParSeconde, 0)} lignes par seconde`);
      read.set('Le top', `${fmtNum(M.topMv * k, 0).replace('-', '−')} mV pendant ${fmtNum(M.topUs, 1)} µs ; salve de ${M.cycles} cycles à ${fmtNum(M.fMHz, 6)} MHz (${fmtNum(M.periodeNs, 1)} ns par cycle, ${fmtNum(M.salveUs, 2)} µs), ${fmtNum(M.salvePpMv * k, 0)} mV crête à crête`);
      read.set('Les fronts', `≈ ${fmtNum(M.frontNs, 0)} ns : un repère moins précis que celui du tri-level`);
      read.set('Le repère 0H', ampl === 100 ? 'au milieu du front descendant, à mi-hauteur du top (−150 mV en PAL)' : `à mi-hauteur du top reçu : un appareil qui le cherche à −150 mV fixes le place ${ampl > 100 ? 'plus tôt' : 'plus tard'} sur le front`);
      read.set('Rythme des images', `${fmtNum(M.imageMs, 2)} ms par image, famille ${M.famille === 50 ? '50 Hz' : '59,94 Hz'}`);
    } else {
      const M = mesureTri(sig);
      read.set('Signal', M.nom);
      read.set('Une ligne', `${fmtNum(M.ligneUs, 2)} µs = ${fmtNum(M.total)} T · ${fmtNum(M.lignes)} lignes`);
      read.set('Le top', `${fmtNum(-300 * k, 0).replace('-', '−')} puis +${fmtNum(300 * k, 0)} mV, ${M.demi} T chacun (${fmtNum(M.demiNs, 1)} ns), ${fmtNum(M.impulsionNs, 0)} ns en tout ; T = ${fmtNum(M.Tns, 3)} ns`);
      read.set('Les fronts', `≈ ${fmtNum(M.monteeNs, 0)} ns (4 T) : quatre fois plus raides que ceux du black burst`);
      read.set('Le repère 0H', `le passage à 0 V du front montant : il ne bouge pas si l'amplitude change (${ampl} % ici)`);
      read.set('Rythme des images', `${fmtNum(M.imageMs, 2)} ms par image, famille ${M.famille === 50 ? '50 Hz' : '59,94 Hz'}`);
    }
    dest.replaceChildren(...APPAREILS.filter((a) => a.entree === 'ref').map((a) => { const v = verrou(a.id, sig); return el('li', {}, el('b', { style: { color: v.ok ? C.green : C.red } }, v.ok ? '✓' : '✗'), el('span', {}, `${a.nom} : ${v.texte}`)); }));
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Signal', SIG_OPTS, sig, (v) => { sig = v; draw(); }),
      choice('Base de temps', [['top', 'le top'], ['ligne', 'une ligne']], zoom, (v) => { zoom = v; draw(); })),
    el('div', { class: 'co-ctl' }, slider('Amplitude reçue', 50, 200, ampl, 1, (v) => { ampl = v; draw(); }, (v) => `${v} %`)),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'À l\'oscilloscope, couplé en continu, 100 mV par carreau. Le trait pointillé blanc est le repère 0H ; sur un black burst, la ligne rouge est la mi-hauteur du top.')),
    read.el,
    el('h5', { class: 'co-h5' }, 'À qui donner ce signal ?'), dest);
  draw();
}

// ======================================================================================
// 3. Distribuer la référence : DA, boucle, bouchon
// ======================================================================================
function figDistribution() {
  const N = [0, 1, 2].map((n) => niveauLigne(n));
  const f = figure(720, 262, `En haut, la distribution en étoile : le SPG, un DA, un câble et une charge de 75 Ω par appareil. En bas, une chaîne en boucle de trois appareils et le bouchon sur la dernière BNC ; à droite, ce que reçoit le bout de la ligne : ouverte, ${fmtNum(N[0].k * 100)} % du niveau ; une charge, ${fmtNum(N[1].k * 100)} % ; deux charges, ${fmtNum(N[2].k * 100)} %.`);
  f.append(txt(10, 16, 'En étoile : une sortie, un câble, une charge par appareil', 'co-t'));
  f.append(box(10, 30, 60, 34, C.amber), txt(40, 51, 'SPG', 'co-t', 'middle'), ln(70, 47, 100, 47, C.amber));
  f.append(box(100, 30, 50, 34, C.amber), txt(125, 51, 'DA', 'co-t', 'middle'));
  ['CCU 1', 'CCU 2', 'CCU 3', 'Mélangeur'].forEach((d, i) => { const x = 190 + i * 96; f.append(sv('path', { d: `M150 47 C 170 47, ${x - 30} ${30 + i * 2}, ${x} 40`, fill: 'none', stroke: C.amber, strokeWidth: 1.2 }), box(x, 28, 80, 26), txt(x + 40, 45, d, 'co-s', 'middle'), txt(x + 40, 68, '75 Ω interne', 'co-s', 'middle', C.green)); });
  f.append(txt(10, 100, 'En boucle : deux BNC en T par appareil, le bouchon sur la dernière', 'co-t'));
  f.append(box(10, 112, 60, 34, C.amber), txt(40, 133, 'SPG', 'co-t', 'middle'));
  [0, 1, 2].forEach((i) => { const x = 100 + i * 100; f.append(ln(i ? x - 34 : 70, 129, x, 129, C.amber), box(x, 114, 66, 30), txt(x + 33, 128, ['Mélangeur', 'Grille', 'Multiview'][i], 'co-s', 'middle'), txt(x + 33, 140, 'boucle (Hi-Z)', 'co-s', 'middle')); });
  f.append(ln(366, 129, 380, 129, C.amber), sv('rect', { x: 380, y: 122, width: 16, height: 14, rx: 2, fill: '#3a4650', stroke: C.green }), txt(388, 156, 'bouchon 75 Ω', 'co-s', 'middle', C.green));
  // les trois cas, avec la forme reçue (un top de tri-level)
  const X0 = 440;
  f.append(txt(X0, 100, 'Au bout de la ligne', 'co-t'));
  N.forEach((n, i) => {
    const y = 136 + i * 42, lab = ['ouverte (aucune charge)', 'une charge de 75 Ω', 'deux charges (37,5 Ω)'][i];
    f.append(txt(X0, y - 14, lab, 'co-s'));
    f.append(sv('path', { d: trace((t) => triMv(t, '1080i50') * n.k, -0.9, 0.9, X0 + 150, X0 + 270, y, 0.03, 120), fill: 'none', stroke: n.verdict === 'ok' ? C.green : C.red, strokeWidth: 1.5 }));
    f.append(txt(X0 + 150, y + 4, `${fmtNum(n.k * 100)} %`, 'co-m', 'end'), txt(X0 + 276, y - 4, `Γ = ${n.gamma === 1 ? '+1' : fmtNum(n.gamma, 2).replace('-', '−')}`, 'co-s'));
  });
  f.append(txt(10, 186, 'Une ligne ouverte renvoie toute l\'impulsion (écho), le niveau double ;', 'co-s'), txt(10, 200, 'une charge de trop le fait tomber aux deux tiers.', 'co-s'));
  f.append(txt(10, 226, `Retard d'un coaxial : ≈ ${fmtNum(retardCable(1))} ns par mètre (ordre de grandeur), ${fmtNum(retardCable(100) / 1000, 1)} µs pour 100 m ; une ligne 1080i50 dure 35,6 µs.`, 'co-s'));
  f.append(txt(10, 242, 'Le DA recopie, isole chaque sortie et compense un peu le câble : une sortie en court-circuit n\'éteint pas les autres.', 'co-s'));
  return f;
}
function demoDistribution(host) {
  let sig = '1080i50', m = 30, entre = 8, bouchon = true;
  /** @type {boolean[]} terminée en interne (75 Ω) ou bouclée (haute impédance) */
  const term = [false, false, false];
  const cv = canvas(720, 240, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Charges au bout', 'Niveau reçu', 'Réflexion', 'Écho au premier appareil', 'Retard du câble']);
  const verdict = el('p', { class: 'co-verdict' });
  const sw = [0, 1, 2].map((i) => choice(['Mélangeur', 'Grille', 'Multiview'][i], [['b', 'boucle'], ['t', '75 Ω interne']], 'b', (v) => { term[i] = v === 't'; draw(); }));
  const draw = () => {
    const n = term.filter(Boolean).length + (bouchon ? 1 : 0), L = niveauLigne(n);
    // l'écho : la réflexion du bout revient au premier appareil après l'aller-retour entre lui et le bout
    const eNs = echoNs(2 * entre), eUs = eNs / 1000;
    const isBB = !!BB[sig];
    const [t0, t1] = isBB ? [-1.0, 6.0] : [-1.0, 1.6];
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 240);
    const panel = (x0, titre, fn) => {
      const X = (t) => x0 + 20 + (t - t0) / (t1 - t0) * 300, Y = (mv) => 120 - mv * 0.15;
      g.strokeStyle = '#1f2a31'; for (let mv = -600; mv <= 600; mv += 200) { g.beginPath(); g.moveTo(x0 + 20, Y(mv)); g.lineTo(x0 + 320, Y(mv)); g.stroke(); }
      g.strokeStyle = '#3a4650'; g.beginPath(); g.moveTo(x0 + 20, Y(0)); g.lineTo(x0 + 320, Y(0)); g.stroke();
      g.strokeStyle = 'rgba(232,238,242,.35)'; g.setLineDash([3, 3]); g.beginPath(); for (const mv of [-300, 300]) { g.moveTo(x0 + 20, Y(isBB && mv > 0 ? -999 : mv)); g.lineTo(x0 + 320, Y(isBB && mv > 0 ? -999 : mv)); } g.stroke(); g.setLineDash([]);
      g.strokeStyle = L.verdict === 'ok' ? C.green : L.verdict === 'limite' ? C.amber : C.red; g.lineWidth = 2; g.beginPath();
      for (let i = 0; i <= 600; i++) { const t = t0 + (t1 - t0) * i / 600, y = Y(fn(t)); if (i) g.lineTo(X(t), y); else g.moveTo(X(t), y); }
      g.stroke(); g.lineWidth = 1;
      g.fillStyle = '#aab4ba'; g.font = '12px Arial, sans-serif'; g.fillText(titre, x0 + 20, 18);
      g.fillStyle = '#6a747c'; g.font = '11px Arial, sans-serif'; g.fillText('pointillés : le niveau nominal', x0 + 20, 232);
    };
    // au bout : l'onde incidente et sa réflexion confondues (k = 1 + Γ) ; au premier appareil : l'incidente, puis l'écho
    panel(0, `Au bout de la ligne (${n} charge${n > 1 ? 's' : ''})`, (t) => ondeMv(sig, t) * L.k);
    panel(360, `Au premier appareil, ${2 * entre} m avant le bout`, (t) => ondeMv(sig, t) + L.gamma * ondeMv(sig, t - eUs));
    read.set('Charges au bout', n ? `${n} × 75 Ω en parallèle = ${fmtNum(L.RL, 1)} Ω` : 'aucune : la ligne est ouverte');
    read.set('Niveau reçu', `${fmtNum(L.k * 100)} % du nominal (${signe(L.dB, 1)} dB)`);
    read.set('Réflexion', L.gamma === 0 ? 'Γ = 0 : rien ne revient' : `Γ = ${L.gamma === 1 ? '+1' : fmtNum(L.gamma, 2).replace('-', '−')} : ${fmtNum(Math.abs(L.gamma) * 100)} % de l'impulsion repart vers le générateur${L.gamma < 0 ? ', retournée' : ''}`);
    read.set('Écho au premier appareil', L.gamma === 0 ? 'aucun' : `${fmtNum(eNs)} ns après l'impulsion, pour des fronts de ${isBB ? '≈ 200' : '≈ 54'} ns : ${eNs < (isBB ? 100 : 30) ? 'confondu avec le front, il change surtout l\'amplitude' : 'un front en escalier, le repère devient flou'}`);
    read.set('Retard du câble', `${fmtNum(m)} m ≈ ${fmtNum(retardCable(m))} ns (≈ 5 ns/m) : rien à côté d'une ligne, à compenser avec la phase s'il le faut`);
    verdict.className = 'co-verdict ' + (L.verdict === 'ok' ? 'ok' : L.verdict === 'limite' ? 'warn' : 'ko');
    verdict.textContent = n === 0 ? 'Ligne ouverte : le niveau double et toute l\'impulsion revient en écho. Mettez le bouchon sur la dernière BNC.'
      : n === 1 ? 'Une seule charge, au bout : le niveau nominal, aucun écho. C\'est la règle.'
        : `${n} charges : le niveau tombe à ${fmtNum(L.k * 100)} %, hors de la tolérance d'une entrée de référence (de l'ordre de ± 3 dB). Passez les entrées du milieu en boucle, ne gardez qu'une charge au bout.`;
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Signal', [['1080i50', 'tri-level 1080i50'], ['pal', 'black burst PAL']], sig, (v) => { sig = v; draw(); }),
      choice('Bouchon au bout', [['oui', 'mis'], ['non', 'retiré']], 'oui', (v) => { bouchon = v === 'oui'; draw(); })),
    el('div', { class: 'co-ctl' }, ...sw),
    el('div', { class: 'co-ctl' },
      slider('Câble du SPG au premier appareil', 1, 300, m, 1, (v) => { m = v; draw(); }, (v) => `${v} m`),
      slider('Câble entre deux appareils', 1, 30, entre, 1, (v) => { entre = v; draw(); }, (v) => `${v} m`)),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Une sortie du SPG, trois appareils en boucle (deux BNC en T) puis la dernière BNC. Couleur : vert, niveau juste ; ambre, à la limite ; rouge, hors tolérance.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// Les leçons
// ======================================================================================
/** @type {import('./index.js').Lesson[]} */
export const SYNCHRO_REF = [
  {
    id: 'synchro-bases', title: 'Pourquoi synchroniser : fréquence, phase, référence', minutes: '7 min',
    essentials: [
      'Tout le car découpe le temps en **images**, en **lignes** et en **échantillons** : en 1080i50, une image dure 40 ms, une ligne 35,6 µs, un échantillon audio à 48 kHz 20,8 µs.',
      'Deux appareils sur leur propre **quartz** n\'ont jamais exactement la même **fréquence** : à 20 ppm d\'écart, leurs tops dérivent de 20 µs par seconde ; leur **phase** change sans cesse.',
      'D\'où une **référence** commune, le SPG, que chacun suit (genlock pour la vidéo, word clock pour l\'audio, timecode pour l\'heure) : même fréquence pour tous, puis une phase réglée une fois.',
    ],
    figure: figBases,
    demoTitle: 'Donnez 12 ppm à A et −8 ppm à B, poussez le temps écoulé : au bout de combien de temps B sort-elle de la demi-ligne ? De l\'échantillon audio ? Puis verrouillez les deux.',
    demo: demoBases,
    body: `Une caméra, un serveur ralenti, une console son ne « savent » pas l'heure : ils comptent les battements d'un **oscillateur**, un quartz qui vibre à quelques dizaines de mégahertz. C'est lui qui découpe le temps en **images** (40 ms en 1080i50, 20 ms en 1080p50), en **lignes** (1 125 par image, 35,56 µs chacune en 1080i50) et en **échantillons** (13,5 ns pour un pixel à 74,25 MHz ; 20,83 µs pour un échantillon audio à 48 kHz, soit exactement 1 920 échantillons par image à 25 images/s).

Deux mots à ne pas confondre. La **fréquence**, c'est le rythme : combien d'images, de lignes ou d'échantillons par seconde. La **phase**, c'est l'instant : où tombe le début de l'image d'un appareil par rapport à celui d'un autre. Deux appareils de même fréquence gardent la même phase ; deux appareils de fréquences un peu différentes voient leur phase glisser sans arrêt.

Or un quartz n'est jamais juste : il est précis à quelques **ppm** (parties par million) près, selon sa fabrication, sa température et son âge. Un écart de 20 ppm, c'est 20 µs gagnées ou perdues chaque seconde, 72 ms par heure. Entre deux caméras libres, le top de l'une glisse donc par rapport à l'autre : il sort de la demi-ligne que le mélangeur sait réaligner (17,8 µs en 1080i50) en moins d'une seconde, et fait le tour d'une image entière en un peu plus d'une demi-heure. À chaque coupe hors de la fenêtre, l'image **saute** ; dans l'audio, un convertisseur qui prend un échantillon d'avance sur la console en perd ou en double un de temps en temps : un **clic**.

Le remède est d'organiser le car autour d'**une seule horloge**, la **référence**, que fabrique le générateur de synchro (**SPG**, Sync Pulse Generator) et que chaque appareil suit au lieu de son propre quartz :
- pour la vidéo, le **genlock** sur un black burst ou un tri-level : même fréquence d'image et de ligne pour tous ;
- pour l'audio, le **word clock** ou le DARS à 48 kHz, dérivés de la même horloge : 1 920 échantillons par image, pas un de plus ;
- pour l'heure, le **timecode** : il ne cale rien, il date chaque image.

Une fois tout le monde à la même fréquence, il ne reste que des écarts de **phase** fixes, dus aux câbles (≈ 5 ns par mètre) et aux traitements (une mémoire d'image, un codage) : on les règle une fois pour toutes, appareil par appareil, avec ses réglages de phase V et H. C'est l'objet des leçons suivantes : les signaux de référence, leur distribution, le générateur, l'audio, puis le car IP, où l'horloge voyage par le réseau (PTP).

- 1 ppm d'écart = 1 µs par seconde = 3,6 ms par heure.
- Le SPG lui-même a un oscillateur thermostaté (OCXO), bien meilleur qu'un quartz ordinaire, et se cale si possible sur plus précis que lui : le GPS ou la référence d'un site.`,
    plus: `- **Le quartz thermostaté (OCXO)** : un quartz enfermé dans un petit four tenu à température constante ; sa fréquence ne bouge plus que de l'ordre de quelques parties par milliard par jour (ordre de grandeur selon les modèles). C'est l'oscillateur d'un générateur de synchro.
- **Pourquoi une demi-ligne** : une mémoire de ligne à l'entrée du mélangeur réaligne une source qui arrive un peu tôt ou un peu tard ; au-delà, il faudrait une mémoire d'image (un synchroniseur), qui coûte une image de retard.
- **Fréquence et phase, en musique** : deux métronomes réglés à 120 battements par minute (même fréquence) peuvent battre décalés (phase) ; réglés à 120 et 120,01, leur décalage change sans cesse et finit par faire le tour.`,
    car: { text: 'Au poste Synchro (zone technique) : le SPG et ce qu\'il distribue, référence vidéo, timecode, word clock, PTP. La panne « perte de référence » d\'une CCU montre une source qui retourne sur son quartz et dérive.', station: 'synchro' },
    terms: ['derive', 'black-burst', 'word-clock', 'timing-ref'],
    competences: ['1.2', '1.4'],
    article: 'timing',
    quiz: [
      { q: 'Deux caméras libres ont des quartz qui diffèrent de 20 ppm. De combien leurs tops s\'écartent-ils chaque seconde ?', choices: ['20 µs', ['20 ms', 'Ce serait 20 000 ppm : 20 ppm, c\'est 20 millionièmes, donc 20 µs par seconde.'], ['20 ns', 'Ce serait 0,02 ppm, la précision d\'un très bon oscillateur thermostaté, pas d\'un quartz ordinaire.']], answer: 0, why: '1 ppm, c\'est une partie par million : 1 µs d\'écart par seconde écoulée. 20 ppm donnent 20 µs par seconde, 72 ms par heure.' },
      { q: 'Quelle différence entre la fréquence et la phase de deux appareils ?', choices: [['Aucune : ce sont deux noms du même réglage', 'Deux appareils peuvent avoir exactement la même fréquence et des tops décalés : c\'est un écart de phase.'], 'La fréquence est le rythme (images par seconde), la phase l\'instant où chaque image commence', ['La fréquence concerne l\'audio, la phase la vidéo', 'Les deux notions valent pour tous les signaux : 48 kHz est une fréquence, et un convertisseur peut être en avance d\'une fraction d\'échantillon.']], answer: 1, why: 'Le genlock donne à tous la même fréquence ; il reste à chacun un écart de phase fixe (câble, traitement), qu\'on règle une fois avec la phase V et H de l\'appareil.' },
      { q: 'Combien d\'échantillons audio à 48 kHz dans une image à 25 images/s ?', choices: [['48 000', 'C\'est le nombre d\'échantillons dans une seconde entière, soit 25 images.'], '1 920', ['960', 'C\'est le nombre par image à 50 images/s (1080p50).']], answer: 1, why: '48 000 ÷ 25 = 1 920 : un nombre entier, ce qui permet de caler l\'horloge audio sur la référence vidéo sans reste.' },
      { q: 'Deux caméras libres dérivent de 20 µs par seconde. Pourquoi la première coupe qui saute arrive-t-elle en moins d\'une seconde, et pas au bout d\'une demi-heure ?', choices: [['Elle n\'arrive qu\'au bout d\'une demi-heure : il faut une image entière d\'écart', 'Une image entière de dérive (40 ms) prend bien une demi-heure, mais le mélangeur ne réaligne qu\'une demi-ligne.'], 'Parce que le mélangeur ne réaligne qu\'environ une demi-ligne (17,8 µs en 1080i50), franchie en moins d\'une seconde', ['Parce que la coupe se fait toujours sur une image sur deux', 'La coupe se fait au top image, à chaque image : ce n\'est pas ce qui décide du saut.']], answer: 1, why: 'Ce qui compte pour une coupe propre, c\'est l\'écart au mélangeur : au-delà de sa fenêtre (de l\'ordre de ± ½ ligne), l\'image saute. À 20 µs par seconde, la demi-ligne de 17,8 µs est franchie en 0,9 s.' },
      { q: 'Que fait le timecode que le genlock ne fait pas ?', choices: ['Il donne une heure à chaque image', ['Il met les appareils à la même fréquence', 'C\'est le genlock qui fait suivre la référence à chaque appareil ; le timecode n\'agit pas sur le rythme.'], ['Il règle la phase de chaque source au mélangeur', 'La phase se règle sur chaque appareil (V en lignes, H en µs) ; le timecode n\'y touche pas.']], answer: 0, why: 'La référence (genlock) et le word clock calent les rythmes ; le timecode les **date** (HH:MM:SS:II). Les trois viennent du même SPG.' },
      { q: 'Une fois tous les appareils verrouillés sur le SPG, que reste-t-il à régler ?', choices: [['Rien : verrouillés, ils sont forcément en phase', 'Chaque câble et chaque traitement ajoute un retard : verrouillés, les appareils gardent un écart fixe qu\'il faut compenser.'], 'Les écarts de phase fixes dus aux câbles et aux traitements, appareil par appareil', ['La fréquence de chaque appareil, à la main', 'Le genlock donne justement à tous la fréquence de la référence : c\'est ce qu\'on ne règle plus.']], answer: 1, why: 'Le genlock supprime la dérive (même fréquence) ; les retards fixes (≈ 5 ns par mètre de câble, une image pour un synchroniseur) se compensent avec les réglages de phase V et H.' },
    ],
  },
  {
    id: 'synchro-signaux', title: 'Black burst et tri-level', minutes: '8 min',
    essentials: [
      'Le **black burst** (SD) est un noir composite : un top de synchro à **−300 mV** pendant **4,7 µs** par ligne de 64 µs, et une salve de sous-porteuse à 4,43 MHz ; son repère 0H est à mi-hauteur du front descendant.',
      'Le **tri-level** (HD) est une impulsion **−300 mV puis +300 mV**, 44 périodes de 74,25 MHz chacune en 1080 (**0,59 µs**) ; son repère est le **passage à 0 V** : il ne bouge pas avec l\'amplitude et ses fronts sont quatre fois plus raides.',
      'Les deux portent le rythme d\'image ; un appareil de la famille 50 Hz se cale sur un black burst PAL ou sur le tri-level de son format, jamais sur un signal de la famille 59,94.',
    ],
    figure: figSignaux,
    demoTitle: 'Passez du tri-level 1080i50 au black burst PAL en base « le top », puis « une ligne » ; baissez l\'amplitude à 60 % et regardez où se trouve le repère de chacun ; essayez le BB NTSC et lisez qui l\'accepte.',
    demo: demoSignaux,
    body: `Un signal de **référence** n'a qu'un rôle : dire à chaque appareil quand commence chaque ligne et chaque image. Deux signaux existent, tous deux en coaxial 75 Ω et en BNC.

Le **black burst** vient de la télévision analogique : c'est une image noire en vidéo composite, dont il ne reste que la synchronisation. En PAL (625 lignes, 50 trames par seconde, ITU-R BT.1700), chaque ligne de **64 µs** commence par un **top de synchronisation** : le signal descend à **−300 mV** (sous le niveau de suppression, 0 mV) pendant **4,7 µs**. Vient ensuite la **salve** (burst) : une dizaine de cycles de **sous-porteuse couleur** à **4,433 618 75 MHz**, de 300 mV crête à crête, qui servait à décoder la couleur. Pendant la suppression trame, des impulsions larges marquent le début de chaque **trame** : l'appareil sait où commence l'image. Le repère de temps, **0H**, est le milieu du front descendant du top, à mi-hauteur (−150 mV).

Le **tri-level** a été défini pour la HD (SMPTE ST 274 pour le 1080, ST 296 pour le 720) : une impulsion qui descend à **−300 mV** puis monte à **+300 mV** avant de revenir à 0, chaque moitié durant **44 périodes** de l'horloge de 74,25 MHz en 1080, soit **0,593 µs** (40 périodes, 0,539 µs, en 720p). Le repère 0H est le **passage à 0 V** du front montant, au milieu. Trois avantages : l'impulsion est **symétrique** et ne déplace pas la moyenne du signal (pas de composante continue) ; le repère est un passage à zéro, qui **ne bouge pas** si le câble affaiblit le signal, alors que la mi-hauteur d'un black burst dépend de son amplitude ; et ses fronts sont rapides (4 périodes, ≈ 54 ns, contre ≈ 200 ns pour le black burst), ce qui donne un calage plus précis, à la mesure d'un pixel HD (13,5 ns).

Lequel donner à quel appareil ? Les deux portent le même **rythme d'image** en 50 Hz : 40 ms pour le 625 lignes et pour le 1080i50, et le 1080p50 en tire ses images de 20 ms. Beaucoup d'appareils HD acceptent donc l'un ou l'autre ; la notice le dit. Mais un tri-level a un **format** : un tri-level 720p50 n'est pas une référence pour une caméra 1080i50. Et la **famille** compte : un signal 59,94 Hz (NTSC, 1080i59,94) n'a pas le même rythme qu'un appareil 50 Hz, qui ne peut pas s'y verrouiller. Beaucoup de générateurs ne sortent pas de tri-level 1080p50 : les appareils 1080p50 se calent en général sur un tri-level 1080i50 ou sur un black burst.

À l'**oscilloscope** (couplé en continu, 100 mV par carreau), on vérifie l'amplitude (300 mV de top, 600 mV crête à crête pour le tri-level), la durée et la forme : un top arrondi ou dédoublé trahit un câble trop long ou mal terminé. Au **moniteur de forme d'onde**, on règle la phase d'une source par rapport à la référence (la tuile Timing du PRISM).

- Black burst PAL : ligne 64 µs, top 4,7 µs à −300 mV, salve à 4,43 MHz (ITU-R BT.1700) ; NTSC : ligne 63,56 µs, top à −286 mV (−40 IRE), salve à 3,58 MHz, noir à 7,5 IRE aux États-Unis.
- Tri-level 1080i50 : ±300 mV, 44 T de 13,47 ns par moitié, ligne de 2 640 T (35,56 µs) ; 720p50 : 40 T, ligne de 1 980 T (26,67 µs).`,
    plus: `- **Pourquoi la HD n'a pas gardé le black burst** : son top ne descend que d'un côté, ce qui déplace la moyenne du signal (l'appareil doit la restituer) ; son repère dépend de l'amplitude ; ses fronts lents limitent la précision. Le tri-level corrige les trois.
- **La séquence couleur PAL** : la phase de la salve alterne d'une ligne à l'autre et revient au même point toutes les 8 trames (la relation SCH, sous-porteuse et top de ligne). Elle comptait pour monter des sources composites ; en HD, elle n'a plus d'effet.
- **Black burst avec VITC** : un générateur peut inscrire le timecode dans la suppression trame du black burst (VITC) : un seul câble porte alors la référence et l'heure.`,
    car: { text: 'Au poste Synchro : les sorties black burst (625 lignes 50 Hz) et tri-level du SPG. À la baie de mesure, la tuile Timing du PRISM place une source par rapport à la référence. Dans la visionneuse de matériel, l\'arrière du SPG montre ses sorties TRI-LEVEL et BLACK BURST, et le mélangeur son entrée REF IN bouclée.', station: 'synchro' },
    terms: ['black-burst', 'tri-level', 'timing-ref'],
    competences: ['1.4', '2.2', '3.9'],
    article: 'timing',
    quiz: [
      { q: 'Où est le repère de temps (0H) d\'un tri-level ?', choices: ['Au passage à 0 V du front montant, au milieu de l\'impulsion', ['Au début du front descendant vers −300 mV', 'C\'est le début de l\'impulsion : le repère est au milieu, au passage par 0 V.'], ['À mi-hauteur du front descendant, comme le black burst', 'C\'est le repère du black burst ; celui du tri-level est un passage à zéro, qui ne dépend pas de l\'amplitude.']], answer: 0, why: 'Le tri-level descend à −300 mV puis monte à +300 mV : le repère est le passage à 0 V entre les deux. Comme c\'est un passage à zéro, il ne bouge pas si le câble affaiblit le signal.' },
      { q: 'Combien dure une demi-impulsion de tri-level en 1080i50 ?', choices: [['4,7 µs', 'C\'est la durée du top d\'un black burst PAL.'], '≈ 0,59 µs (44 périodes de 74,25 MHz)', ['≈ 13,5 ns', 'C\'est une seule période de l\'horloge de 74,25 MHz ; la demi-impulsion en compte 44.']], answer: 1, why: '44 × 13,47 ns = 593 ns. En 720p50, 40 périodes : 539 ns.' },
      { q: 'Une caméra 1080i50 reçoit un tri-level 720p50. Que se passe-t-il ?', choices: [['Elle se verrouille : c\'est un tri-level de la famille 50 Hz', 'Même famille, mais un tri-level a un format : ses lignes ne durent pas 35,56 µs. Son entrée attend un tri-level 1080i50 ou un black burst.'], 'Elle refuse de se verrouiller : il lui faut un tri-level 1080i50 ou un black burst PAL', ['Elle se verrouille, mais en noir et blanc', 'La référence ne porte pas la couleur de l\'image : une caméra se verrouille ou ne se verrouille pas.']], answer: 1, why: 'Le tri-level porte le rythme des lignes de son format (2 640 T en 1080i50, 1 980 T en 720p50). La notice de l\'appareil dit quelles références il prend : ici son format HD ou le black burst PAL.' },
      { q: 'Pourquoi un mélangeur 1080p50 peut-il se caler sur un black burst PAL, un signal de télévision SD ?', choices: [['Il ne le peut pas : il faut un tri-level 1080p50', 'Beaucoup d\'appareils 1080p50 acceptent justement un black burst ou un tri-level 1080i50 : beaucoup de générateurs ne sortent pas de tri-level 1080p50.'], 'Parce que le black burst porte le rythme d\'image de la famille 50 Hz (40 ms), dont le 1080p50 tire ses images de 20 ms', ['Parce que le black burst contient l\'image du programme', 'Un black burst est un noir : il ne contient que la synchronisation et la salve.']], answer: 1, why: 'Le 625 lignes, le 1080i50 et le 1080p50 ont des images alignées sur le même rythme (une image de 40 ms = deux de 20 ms) : l\'appareil retrouve ses tops à partir du black burst.' },
      { q: 'Le câble affaiblit la référence de 20 %. Lequel des deux signaux garde son repère au même instant ?', choices: ['Le tri-level, dont le repère est un passage à zéro', ['Le black burst, dont le top est plus long', 'Le repère du black burst est à mi-hauteur du top : si l\'amplitude baisse, un appareil qui le cherche à un seuil fixe le place ailleurs sur le front.'], ['Aucun des deux : l\'affaiblissement décale toujours le repère', 'Un passage à zéro reste au même instant quelle que soit l\'amplitude : c\'est l\'avantage du tri-level.']], answer: 0, why: 'Le passage à 0 V du tri-level ne dépend pas de l\'amplitude ; la mi-hauteur du black burst, si. Ajoutez des fronts quatre fois plus raides (≈ 54 ns contre ≈ 200 ns) : le tri-level cale plus précisément.' },
      { q: 'Un appareil de la famille 50 Hz reçoit un black burst NTSC. Pourquoi ne se verrouille-t-il pas ?', choices: ['Le NTSC est de la famille 59,94 Hz : ses images ne tombent pas au rythme de celles de l\'appareil', ['Parce que le NTSC n\'a pas de salve', 'Le NTSC a une salve, à 3,58 MHz ; ce qui compte ici, c\'est le rythme des images.'], ['Parce qu\'il faut toujours un tri-level en HD', 'Beaucoup d\'appareils HD acceptent un black burst, de leur famille.']], answer: 0, why: '29,97 images par seconde ne se ramènent pas à 25 : aucune image de l\'un ne retombe régulièrement sur celles de l\'autre. On donne à chaque appareil une référence de sa famille.' },
    ],
  },
  {
    id: 'synchro-distribution', title: 'Distribuer la référence : DA, boucle, terminaison 75 Ω', minutes: '7 min',
    essentials: [
      'La référence part en **étoile** : un **DA** (distributeur) recopie une sortie du SPG vers chaque appareil, un câble et une charge de **75 Ω** par appareil.',
      'Une **entrée bouclée** (deux BNC en T) ne termine pas la ligne : le **bouchon 75 Ω** se met sur la dernière, **une seule fois**. Sans bouchon, le niveau **double** et l\'impulsion revient en écho ; avec deux charges, il tombe aux **deux tiers**.',
      'Le câble retarde d\'environ **5 ns par mètre** : 0,5 µs pour 100 m, peu devant une ligne ; c\'est la phase de l\'appareil qui le compense s\'il le faut.',
    ],
    figure: figDistribution,
    demoTitle: 'Retirez le bouchon, puis remettez-le et passez la grille en « 75 Ω interne » ; allongez le câble entre deux appareils jusqu\'à voir le front en escalier.',
    demo: demoDistribution,
    body: `Une sortie de SPG ne nourrit qu'une ligne. Pour vingt appareils, on passe par des **distributeurs** (DA, distribution amplifier) : une entrée, six à huit sorties identiques, chacune isolée des autres (un court-circuit sur l'une n'éteint pas ses voisines) et souvent avec une petite égalisation du câble. La référence part ainsi **en étoile** : une sortie, un câble, un appareil. C'est la règle du car : on sait toujours d'où vient la référence de chacun, et une panne ne touche qu'un appareil.

La vidéo est en **75 Ω** de bout en bout : le générateur a une impédance interne de 75 Ω, le câble une impédance caractéristique de 75 Ω, et la ligne doit être **fermée sur 75 Ω** à son extrémité. C'est un **pont diviseur** : le générateur est réglé pour donner le niveau nominal (300 mV de top) sur **une** charge de 75 Ω.
- **Ligne ouverte** (aucune charge) : le niveau **double** (+6 dB) et, surtout, toute l'impulsion se **réfléchit** au bout (Γ = +1) et revient vers le générateur.
- **Une charge** : le niveau nominal, Γ = 0, rien ne revient.
- **Deux charges** en parallèle (37,5 Ω) : les **deux tiers** du niveau (−3,5 dB), Γ = −1/3 ; trois charges, la moitié.

Beaucoup d'appareils ont une **entrée bouclée** (loop-through) : deux BNC reliées entre elles, à haute impédance, pour passer la référence d'un appareil au suivant. Elle ne termine pas : on met un **bouchon 75 Ω** sur la BNC libre du **dernier** appareil, et sur lui seul. D'autres ont une entrée **terminée en interne** (parfois un commutateur 75 Ω / Hi-Z à l'arrière) : elle charge déjà la ligne, elle ne se met donc qu'au bout. Les deux erreurs classiques : oublier le bouchon (niveau doublé, échos, un appareil qui se verrouille mal ou « par moments ») et en mettre deux (niveau trop faible, hors de la tolérance de l'entrée, de l'ordre de ± 3 dB selon les notices).

L'**écho** d'une ligne mal terminée revient aux appareils du milieu de la chaîne après un aller-retour : à 5 ns par mètre, 10 m entre deux appareils font un écho 100 ns plus tard, de l'ordre des fronts du black burst (≈ 200 ns) et bien plus que ceux du tri-level (≈ 54 ns). Le front se dédouble en escalier, et le repère 0H devient flou : l'appareil peut se verrouiller avec un décalage, ou décrocher par moments.

Le **retard** du câble lui-même, ≈ 5 ns par mètre (pour un coaxial au facteur de vélocité ≈ 0,66 ; ordre de grandeur), est petit : 100 m font 0,5 µs, contre 35,6 µs pour une ligne 1080i50. On le compense avec la **phase** de l'appareil, ou avec le décalage de la sortie du SPG qui nourrit tout un groupe d'appareils.

- Γ = (Z − 75) / (Z + 75) : ouvert +1, 75 Ω 0, 37,5 Ω −1/3, une pièce 50 Ω −0,2.
- Une sortie de DA par appareil : la boucle ne sert que pour deux ou trois appareils côte à côte, avec un seul bouchon, au bout.`,
    plus: `- **Pourquoi un pont diviseur** : le générateur est une source de 600 mV de top à vide derrière 75 Ω ; sur 75 Ω, la moitié reste dans le générateur, la moitié arrive à l'appareil : 300 mV. Sans charge, rien ne chute dans le générateur : 600 mV.
- **Le bouchon** : une résistance de 75 Ω entre l'âme et la masse d'une BNC. Un bouchon de 50 Ω (informatique, radio) s'emboîte aussi, mais ferme mal la ligne (Γ = −0,2) : on le reconnaît à son marquage, et on le range ailleurs.
- **Le DA réhorloge-t-il ?** Un DA de référence analogique amplifie et égalise, il ne régénère pas le signal comme un DA SDI ; son retard est de l'ordre de quelques dizaines de nanosecondes (ordre de grandeur), le même sur toutes ses sorties.`,
    car: { text: 'Au poste Synchro et dans la visionneuse de matériel : le SPG, puis le distributeur de référence (une entrée, huit sorties) qui nourrit les CCU ; le mélangeur reçoit son black burst sur une entrée REF IN bouclée. La liste de câblage du car montre chaque liaison de référence, en coaxial 75 Ω.', station: 'synchro' },
    terms: ['terminaison-75', 'black-burst', 'tri-level'],
    competences: ['2.10', '3.9', '2.13'],
    article: 'timing',
    quiz: [
      { q: 'Trois appareils sont chaînés par leurs entrées bouclées sur une même sortie du SPG. Où met-on le bouchon 75 Ω ?', choices: ['Sur la BNC libre du dernier appareil, et là seulement', ['Sur chacun des trois appareils', 'Trois charges en parallèle font 25 Ω : le niveau tombe à la moitié, hors tolérance.'], ['Nulle part : les entrées bouclées se terminent seules', 'Une entrée bouclée est à haute impédance : sans bouchon, la ligne est ouverte, le niveau double et l\'impulsion revient en écho.']], answer: 0, why: 'Une ligne 75 Ω se ferme une fois, au bout. Les entrées bouclées du milieu ne chargent pas la ligne ; le bouchon sur la dernière la ferme.' },
      { q: 'On a oublié le bouchon au bout d\'une chaîne bouclée. Qu\'arrive-t-il au niveau reçu ?', choices: [['Il tombe à la moitié', 'C\'est ce que donnent trois charges en parallèle ; sans charge, il monte.'], 'Il double, et toute l\'impulsion revient en écho', ['Rien : le bouchon ne sert qu\'en SDI', 'La référence analogique est aussi une ligne 75 Ω : elle doit être fermée sur 75 Ω.']], answer: 1, why: 'Le générateur est réglé pour donner le nominal sur 75 Ω : sans charge, rien ne chute dans son impédance interne, le niveau double (+6 dB), et Γ = +1 au bout de la ligne ouverte.' },
      { q: 'Une ligne de référence est fermée par une entrée terminée en interne et, en plus, par un bouchon. Quel niveau reçoit-elle ?', choices: [['Le nominal : deux précautions valent mieux qu\'une', 'Deux charges de 75 Ω en parallèle font 37,5 Ω : le pont diviseur ne donne plus le nominal.'], 'Les deux tiers du nominal (−3,5 dB)', ['Le double du nominal', 'C\'est le cas d\'une ligne ouverte, sans aucune charge.']], answer: 1, why: '2 × 37,5 / (75 + 37,5) = 2/3 du nominal : 200 mV de top au lieu de 300. C\'est hors de la tolérance de beaucoup d\'entrées de référence (de l\'ordre de ± 3 dB).' },
      { q: 'Pourquoi distribue-t-on la référence en étoile, par des DA, plutôt qu\'en boucle d\'un appareil à l\'autre ?', choices: [['Parce qu\'une boucle coûte plus de câble', 'Une boucle coûte souvent moins de câble ; ce n\'est pas la raison.'], 'Chaque appareil a sa ligne et sa charge : pas de bouchon oublié, et une panne ne touche qu\'un appareil', ['Parce que les entrées bouclées n\'existent plus en HD', 'Beaucoup d\'appareils HD ont encore une entrée bouclée.']], answer: 1, why: 'En étoile, chaque ligne va d\'une sortie de DA à un appareil, fermée sur son entrée : rien à oublier, et un câble arraché n\'éteint qu\'un appareil. Le DA isole ses sorties les unes des autres.' },
      { q: 'Quel retard ajoutent 100 m de coaxial sur une référence ?', choices: ['≈ 0,5 µs (≈ 5 ns par mètre)', ['≈ 0,5 ms', 'Mille fois trop : il faudrait 100 km de câble.'], ['≈ 35 µs, une ligne entière', 'Une ligne 1080i50 dure 35,6 µs : il faudrait environ 7 km de câble.']], answer: 0, why: 'Dans un coaxial au facteur de vélocité ≈ 0,66, le signal parcourt ≈ 0,2 m par nanoseconde : ≈ 5 ns par mètre, 0,5 µs pour 100 m (ordre de grandeur). La phase de l\'appareil le compense.' },
      { q: 'Un appareil au milieu d\'une chaîne bouclée sans bouchon se verrouille « par moments ». Pourquoi ?', choices: ['L\'écho du bout de ligne ouvert revient et dédouble les fronts de la référence : le repère devient flou', ['Parce que le câble est trop long d\'une ligne', 'Quelques dizaines de mètres ne retardent que de quelques centaines de nanosecondes : bien moins qu\'une ligne.'], ['Parce que le SPG est en holdover', 'En holdover, le SPG sort toujours une référence stable : tous les appareils resteraient verrouillés.']], answer: 0, why: 'Sans bouchon, Γ = +1 : l\'impulsion repart du bout et repasse sur l\'appareil quelques dizaines à centaines de nanosecondes plus tard. Sur des fronts de 54 à 200 ns, cela fait un escalier : le repère 0H n\'est plus net.' },
    ],
  },
];
