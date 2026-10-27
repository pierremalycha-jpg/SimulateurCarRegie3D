// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import {
  SOURCES, sourceById, niveauEntree, gainPour, chaine, verdictNiveau, sorties, partDans, boucle, rejetCardio, vDeDbu, NOMINAL, ECRETAGE, PEAK, GAIN_XLR, GAIN_REC, EQ, COUPE_BAS,
  repliement, nyquist, dynamique, valeurs, debitPcm, debitAes3, debitMadi, canauxMadi, ALIGNEMENTS, dbuDeDbfs, latenceMs, echParImage,
  sousBlocs, blocs, integree, fenetre, mesure, conformeR128, R128,
} from './son_console_calc.js';
import { flux, emission, charge, delaiChemin, tient, latenceConseillee, LATENCES, canalUtile, ENTETES_TOTAL, DSCP } from './dante_calc.js';

// ----------------------------------------------------------------------------------
// Chapitre « Le son » (suite) : la console analogique de la section son (une console de la gamme ANT
// Antmix, simulation non officielle : la tranche, le gain staging, les sorties), puis l'audio numérique
// (échantillonnage, quantification, AES3, MADI, alignements), la mesure du programme (crête, vumètre,
// loudness EBU R128) et Dante, l'audio sur le réseau. Les manipulations calculent avec les modèles purs
// cours/son_console_calc.js et cours/dante_calc.js (testés), comme la vue 3D et les exercices.
// Les détails de la console (nombre de voies, plage de gain, coupe-bas, AUX pré ou post, USB) varient
// d'un modèle à l'autre : ils sont donnés comme ceux d'une console de ce type, à vérifier sur la face
// avant de celle de l'établissement.
// ----------------------------------------------------------------------------------
// les titres des parties du chapitre (cours/son.js, PARTIES_SON), écrits ici pour ne pas importer son.js qui importe ce fichier
const PARTIE_CONSOLE = 'Mélanger : la console', PARTIE_NUM = 'Numérique, mesure et réseau';
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', violet: '#c9a8ff', box: '#1a2026', line: '#2a3238', tally: '#f0372c', pvw: '#33c46c', dim: '#5a646c' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};
/** un niveau en dB avec son signe (vrai signe moins), −∞ pour rien */
const sdb = (v, d = 1) => (!Number.isFinite(v) ? '−∞' : Math.abs(v) < 0.5 * 10 ** -d ? fmtNum(0, d) : (v > 0 ? '+' : '') + fmtNum(v, d).replace('-', '−'));
const fdb = (v, u = 'dB', d = 1) => `${sdb(v, d)} ${u}`;

// ======================================================================================
// 1. La console analogique : de la prise au fader
// ======================================================================================
function figConsole() {
  const f = figure(720, 318, 'Une tranche micro de console analogique, de haut en bas : entrées XLR et jack, GAIN, coupe-bas, égaliseur trois bandes (12 kHz, 2,5 kHz, 80 Hz), envoi AUX pris avant le fader pour les retours, envoi FX pris après le fader pour les effets, panoramique, LED PEAK, touche PFL, fader. À droite, où va le signal : le bus principal et son master vers la sortie, l\'AUX vers les retours, le FX vers les effets intégrés dont le retour revient dans le bus, le PFL vers le casque et le vumètre. Le 48 V est un interrupteur commun à toutes les entrées XLR.');
  f.append(txt(10, 16, 'Une tranche micro, de la prise au fader', 'co-t', 'start'));
  // la tranche, verticale
  const X = 20, W = 206;
  f.append(sv('rect', { x: X, y: 24, width: W, height: 286, rx: 4, fill: '#161b20', stroke: C.line }));
  const rows = [
    ['XLR · jack', 'micro ou ligne', 'p'], ['GAIN', 'adapte le niveau', 'k'], ['coupe-bas', `${COUPE_BAS.f} Hz`, 'b'], ['HIGH', '12 kHz ±15 dB', 'k'], ['MID', '2,5 kHz ±15 dB', 'k'],
    ['LOW', '80 Hz ±15 dB', 'k'], ['AUX', 'pré-fader : retours', 'k'], ['FX', 'post-fader : effets', 'k'], ['PAN', 'gauche · droite', 'k'], ['PEAK · PFL', 'crête, écoute', 'b'],
  ];
  rows.forEach(([a, b, t], i) => {
    const y = 40 + i * 21;
    if (t === 'k') f.append(sv('circle', { cx: X + 18, cy: y, r: 7, fill: i === 1 ? '#c25a3a' : i >= 6 && i <= 7 ? '#3d6a9a' : '#3a434c', stroke: C.grey }), sv('line', { x1: X + 18, y1: y, x2: X + 18, y2: y - 6, stroke: '#fff', strokeWidth: 1.4 }));
    else if (t === 'p') f.append(sv('circle', { cx: X + 18, cy: y, r: 8, fill: '#0b0e10', stroke: C.grey }), sv('circle', { cx: X + 18, cy: y, r: 2, fill: C.grey }));
    else f.append(sv('rect', { x: X + 10, y: y - 6, width: 16, height: 11, rx: 2, fill: i === 9 ? '#5c4210' : '#2a3036', stroke: C.grey }));
    f.append(txt(X + 34, y + 4, a, 'co-m', 'start'), txt(X + W - 6, y + 4, b, 'co-s', 'end'));
  });
  // le fader
  f.append(sv('rect', { x: X + 16, y: 254, width: 4, height: 50, fill: '#0b0e10' }), sv('rect', { x: X + 8, y: 268, width: 20, height: 10, rx: 2, fill: '#c9ced3' }), txt(X + 34, 282, 'fader', 'co-m', 'start'), txt(X + W - 6, 282, '« 0 » : gain unité', 'co-s', 'end'));
  // où va le signal
  const R = 256;
  f.append(box(R, 30, 150, 34, C.green), txt(R + 75, 46, 'AUX (pré-fader)', 'co-t'), txt(R + 75, 59, 'le fader ne change rien', 'co-s'));
  f.append(box(R, 74, 150, 34, C.violet), txt(R + 75, 90, 'FX (post-fader)', 'co-t'), txt(R + 75, 103, 'suit le fader', 'co-s'));
  f.append(box(R, 118, 150, 34, C.amber), txt(R + 75, 134, 'fader · PAN → bus', 'co-t'), txt(R + 75, 147, 'gauche et droite', 'co-s'));
  f.append(box(R, 162, 150, 34, C.cyan), txt(R + 75, 178, 'PFL', 'co-t'), txt(R + 75, 191, 'la tranche seule, avant le fader', 'co-s'));
  f.append(sv('path', { d: `M${X + W + 4} 80 H${R - 18} V47 H${R - 2}`, fill: 'none', stroke: C.green }), sv('path', { d: `M${R - 18} 80 V179 H${R - 2}`, fill: 'none', stroke: C.cyan }));
  f.append(arrow(R - 18, 91, R - 2, 91, C.violet), arrow(R - 18, 135, R - 2, 135, C.amber));
  const R2 = 450;
  f.append(arrow(R + 152, 47, R2 - 4, 47, C.green), box(R2, 30, 260, 34, C.green), txt(R2 + 130, 46, 'master AUX → AUX OUT', 'co-t'), txt(R2 + 130, 59, 'les retours de scène des musiciens', 'co-s'));
  f.append(arrow(R + 152, 91, R2 - 4, 91, C.violet), box(R2, 74, 260, 34, C.violet), txt(R2 + 130, 90, 'effets intégrés (réverbération, écho)', 'co-t'), txt(R2 + 130, 103, 'leur retour revient dans le bus principal', 'co-s'));
  f.append(arrow(R + 152, 135, R2 - 4, 135, C.amber), box(R2, 118, 260, 34, C.amber), txt(R2 + 130, 134, 'master du bus principal → MAIN OUT', 'co-t'), txt(R2 + 130, 147, 'XLR symétriques, +4 dBu au « 0 »', 'co-s'));
  f.append(arrow(R + 152, 179, R2 - 4, 179, C.cyan), box(R2, 162, 260, 34, C.cyan), txt(R2 + 130, 178, 'casque, cabine et vumètres', 'co-t'), txt(R2 + 130, 191, 'on écoute et on lit la tranche seule', 'co-s'));
  f.append(arrow(R2 + 130, 108, R2 + 130, 116, C.violet));
  // le 48 V et la chaîne des gains
  f.append(box(R, 206, 454, 36, C.red), txt(R + 227, 222, '48 V : un seul interrupteur pour toutes les entrées XLR', 'co-t'), txt(R + 227, 236, 'les micros statiques en ont besoin ; on l\'allume ou le coupe master baissé', 'co-s'));
  f.append(txt(R, 262, 'La chaîne des gains : les décibels s\'additionnent', 'co-t', 'start'));
  f.append(txt(R, 279, 'micro −36 dBu + GAIN +36 dB = 0 dBu, le « 0 » du vumètre', 'co-s', 'start'));
  f.append(txt(R, 294, 'fader 0 · PAN au centre −3 dB · master 0 · sortie XLR +4 dB', 'co-s', 'start'));
  f.append(txt(R, 309, `écrêtage vers +${ECRETAGE} dBu (ordre de grandeur) : une vingtaine de dB de marge`, 'co-s', 'start', { fill: C.red }));
  return f;
}

function demoConsole(host) {
  let src = 'chant', p48 = true, gain = 36, low = 0, mid = 0, high = 0, cb = false, fader = 0, master = 0;
  const cv = canvas(720, 300, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Entrée de la tranche', 'GAIN pour viser le « 0 »', 'Le vumètre en PFL', 'LED PEAK', 'Bus principal et master', 'Sortie principale (XLR)', 'Marge avant l\'écrêtage', 'Rapport signal / souffle']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const s = sourceById(src);
    const entree = niveauEntree(s, p48);
    const c = chaine({ entree, gain, eq: { low, mid, high }, bandes: s.bandes, coupeBas: cb, fader, pan: 0, master });
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 300);
    // l'échelle : de −60 à +30 dBu
    const Y = (d) => 260 - (Math.max(-60, Math.min(30, d)) + 60) / 90 * 230;
    g.font = '11px Arial, sans-serif';
    for (const [d, col, lab] of [[ECRETAGE, C.tally, `écrêtage +${ECRETAGE} dBu`], [PEAK, '#e6c33a', `PEAK +${PEAK} dBu`], [NOMINAL, C.pvw, '« 0 » du vumètre (0 dBu)'], [-20, '#3a444c', '−20'], [-40, '#3a444c', '−40'], [-60, '#3a444c', '−60 dBu']]) {
      g.strokeStyle = /** @type {string} */ (col); g.setLineDash(d === NOMINAL || d === ECRETAGE ? [] : [4, 4]); g.beginPath(); g.moveTo(60, Y(/** @type {number} */ (d))); g.lineTo(712, Y(/** @type {number} */ (d))); g.stroke(); g.setLineDash([]);
      g.fillStyle = /** @type {string} */ (col); g.fillText(/** @type {string} */ (lab), 64, Y(/** @type {number} */ (d)) - 4);
    }
    // les étages : une marche par étage
    const st = c.etages, w = 650 / st.length;
    st.forEach((e, i) => {
      const x = 62 + i * w, ok = Number.isFinite(e.v);
      const y = ok ? Y(e.v) : Y(-60);
      const col = !ok ? '#3a444c' : e.v > ECRETAGE ? C.tally : e.v > PEAK ? '#e6c33a' : i === 0 ? C.grey : C.amber;
      g.fillStyle = col; g.fillRect(x + 6, y - 3, w - 12, 6);
      if (i) { const p = st[i - 1]; if (Number.isFinite(p.v) && ok) { g.strokeStyle = '#59646f'; g.beginPath(); g.moveTo(x + 6, Y(p.v)); g.lineTo(x + 6, y); g.stroke(); } }
      g.fillStyle = '#aab4ba'; g.fillText(e.nom, x + 6, 278); g.fillStyle = '#e8eef2'; g.fillText(ok ? `${sdb(e.v)} dBu` : 'rien', x + 6, 292);
    });
    // le souffle
    if (Number.isFinite(c.bruit)) { g.strokeStyle = '#6f5a9a'; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(62 + 4 * w, Y(c.bruit)); g.lineTo(712, Y(c.bruit)); g.stroke(); g.setLineDash([]); g.fillStyle = '#b9a2e8'; g.fillText(`souffle ${sdb(c.bruit, 0)} dBu`, 62 + 4 * w + 6, Math.min(254, Y(c.bruit) + 13)); }
    read.set('GAIN pour viser le « 0 »', Number.isFinite(entree) ? `${fdb(gainPour(entree) - (c.apresEq - c.apresGain))} (égaliseur compris ; réglé ici : ${fdb(gain)})` : '—');
    read.set('Entrée de la tranche', Number.isFinite(entree) ? `${fdb(entree, 'dBu')} (${s.micro}${s.spl ? `, crêtes vers ${s.spl} dB SPL, ordre de grandeur` : ''})` : `rien : ${s.micro} sans 48 V`);
    read.set('Le vumètre en PFL', Number.isFinite(c.vuPfl) ? `${sdb(c.vuPfl)} : ${verdictNiveau(c.vuPfl)}` : '—');
    read.set('LED PEAK', c.peak ? 'allumée : baissez le GAIN' : 'éteinte');
    read.set('Bus principal et master', Number.isFinite(c.master) ? `bus ${fdb(c.bus, 'dBu')} (PAN au centre : −3 dB), après le master ${fdb(c.master, 'dBu')}` : '—');
    read.set('Sortie principale (XLR)', Number.isFinite(c.xlr) ? `${fdb(c.xlr, 'dBu')}, soit ${fmtNum(vDeDbu(c.xlr), vDeDbu(c.xlr) < 0.1 ? 3 : 2)} V efficaces` : '—');
    read.set('Marge avant l\'écrêtage', Number.isFinite(c.marge) ? (c.ecrete ? `aucune : écrêté dès l'étage « ${c.ecrete.nom.toLowerCase()} »` : `${fmtNum(c.marge, 1)} dB`) : '—');
    read.set('Rapport signal / souffle', Number.isFinite(c.rsb) ? `${fmtNum(c.rsb, 0)} dB entre les crêtes et le souffle` : '—');
    const v = !Number.isFinite(entree) ? ['ko', `Muet : ${s.micro} a besoin du 48 V, un interrupteur commun aux entrées XLR.`]
      : c.ecrete && c.ecrete.id === 'gain' ? ['ko', 'Écrêté dès le préampli : baissez le GAIN. Le fader, plus loin, ne répare pas une forme d\'onde déjà coupée.']
        : c.ecrete ? ['ko', `Écrêté à l'étage « ${c.ecrete.nom.toLowerCase()} » : redescendez ce qui pousse le signal à cet endroit.`]
          : c.peak ? ['warn', 'La LED PEAK s\'allume : il ne reste que quelques dB avant l\'écrêtage. Baissez le GAIN.']
            : c.vuPfl < -12 ? ['warn', 'Gain trop faible : le vumètre est loin du « 0 » en PFL. Il faudra pousser le fader et le master, et le souffle montera avec.']
              : master > 6 && fader < -6 ? ['warn', 'Fader bas et master haut : le master amplifie aussi le souffle du bus. Ramenez le master vers 0 et dosez aux faders.']
                : Math.abs(fader) <= 6 && Math.abs(master) <= 6 ? ['ok', 'Bien réglé : en PFL autour du « 0 », fader et master près de 0 dB, une vingtaine de dB de marge.'] : ['warn', 'Le niveau tient, mais visez le fader et le master près de 0 : c\'est là que la console a le plus de marge et le moins de souffle.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  const db = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' dB';
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Source', SOURCES.map((s) => [s.id, s.nom, s.micro]), src, (v) => { src = v; draw(); }),
      choice('48 V', [['on', 'allumé'], ['off', 'coupé']], 'on', (v) => { p48 = v === 'on'; draw(); })),
    el('div', { class: 'co-ctl' },
      slider('GAIN', 0, 60, gain, 1, (v) => { gain = v; draw(); }, (v) => '+' + v + ' dB'),
      choice('Coupe-bas', [['off', 'non'], ['on', `${COUPE_BAS.f} Hz`]], 'off', (v) => { cb = v === 'on'; draw(); }),
      slider(`HIGH ${fmtNum(EQ.high / 1000)} kHz`, -15, 15, high, 1, (v) => { high = v; draw(); }, db),
      slider('MID 2,5 kHz', -15, 15, mid, 1, (v) => { mid = v; draw(); }, db),
      slider(`LOW ${EQ.low} Hz`, -15, 15, low, 1, (v) => { low = v; draw(); }, db)),
    el('div', { class: 'co-ctl' },
      slider('Fader', -40, 10, fader, 1, (v) => { fader = v; draw(); }, db),
      slider('Master', -40, 10, master, 1, (v) => { master = v; draw(); }, db)),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le niveau des crêtes à chaque étage d\'une tranche, en dBu, sur une console de ce type : le « 0 » du vumètre (vert), la LED PEAK (jaune) et l\'écrêtage interne (rouge), ordres de grandeur. Le pointillé violet est le souffle à la sortie.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 2. Les sorties de la console
// ======================================================================================
function figSorties() {
  const f = figure(720, 300, 'Les sorties d\'une petite console analogique et ce qu\'elles alimentent : la sortie principale en XLR symétrique vers la diffusion façade et le départ vers le car, les sorties AUX pré-fader vers les retours de scène, l\'envoi d\'effets post-fader et son retour, la sortie d\'enregistrement RCA à −10 dBV, la cabine et le casque. En dessous : un envoi pré-fader ne suit pas le fader, un envoi post-fader le suit.');
  f.append(txt(10, 16, 'La face arrière : qui reçoit quoi', 'co-t', 'start'));
  f.append(box(10, 30, 170, 166, C.amber), txt(95, 188, 'Console (type Antmix)', 'co-t'));
  const outs = [
    ['MAIN OUT L/R', 'XLR · +4 dBu', 'diffusion façade, départ vers le car', C.amber],
    ['AUX OUT', 'jack · pré-fader', 'retours de scène des musiciens', C.green],
    ['FX SEND / RETURN', 'post-fader', 'effets (intégrés ou externes)', C.violet],
    ['REC OUT', 'RCA · −10 dBV', 'enregistreur grand public', C.cyan],
    ['CTRL ROOM · PHONES', 'jack', 'écoute de la régie, casque (pas un départ)', C.grey],
  ];
  outs.forEach(([a, b, c, col], i) => {
    const y = 40 + i * 28;
    f.append(sv('circle', { cx: 170, cy: y + 8, r: 5, fill: '#0b0e10', stroke: col }), txt(160, y + 12, a, 'co-m', 'end'), arrow(176, y + 8, 300, y + 8, col), box(304, y - 4, 404, 24, col), txt(312, y + 12, `${b} → ${c}`, 'co-s', 'start'));
  });
  // pré et post
  const Y = 212;
  f.append(txt(10, Y, 'Pré ou post-fader : où l\'envoi est pris', 'co-t', 'start'));
  const chain = (y, label, at, col, what) => {
    f.append(box(10, y, 90, 24), txt(55, y + 16, 'GAIN · EQ', 'co-s'), arrow(102, y + 12, 140, y + 12), box(142, y, 70, 24, C.amber), txt(177, y + 16, 'fader', 'co-s'), arrow(214, y + 12, 250, y + 12), box(252, y, 80, 24), txt(292, y + 16, 'bus', 'co-s'));
    f.append(sv('circle', { cx: at, cy: y + 12, r: 4, fill: col }), txt(at, y - 3, label, 'co-s', 'middle', { fill: col }), txt(360, y + 16, what, 'co-s', 'start'));
  };
  chain(Y + 18, 'AUX pré', 120, C.green, 'pré : baisser le fader ne change rien au retour du musicien');
  chain(Y + 54, 'FX post', 232, C.violet, 'post : la réverbération baisse avec la voix, sans rester seule');
  return f;
}

function demoSorties(host) {
  // trois tranches réglées en PFL autour du « 0 » ; on joue sur les faders et les envois
  const T = [
    { nom: 'Chant', niveau: 0, fader: 0, pan: 0, aux: 0, fx: -8 },
    { nom: 'Guitare', niveau: -2, fader: -4, pan: -0.4, aux: -6, fx: -16 },
    { nom: 'Clavier', niveau: -1, fader: -6, pan: 0.4, aux: -40, fx: -Infinity },
  ];
  const M = { master: 0, auxMaster: 0, fxMaster: 0, fxRetour: -6, pfl: /** @type {number | undefined} */ (undefined) };
  let angle = 180, dist = 1.2;
  const tbl = el('table', { class: 'co-table', 'aria-label': 'Ce que contient chaque sortie : niveau et part de chaque source' });
  const read = readout(['Façade (MAIN OUT, XLR)', 'Retour du chanteur (AUX OUT)', 'Envoi d\'effets (FX SEND)', 'Enregistreur (REC OUT, RCA)', 'Casque (PHONES)', 'Retour : marge avant larsen']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const S = sorties(T, M);
    const ligne = (nom, parts, total) => el('tr', {}, el('th', {}, nom), ...T.map((t) => { const p = parts.find((x) => x.nom === t.nom); const d = partDans(p ? (p.v ?? Math.max(p.g, p.d)) : -Infinity, total); return el('td', {}, Number.isFinite(d) ? (d > -0.5 ? 'domine' : `${sdb(d, 0)} dB`) : '—'); }), el('td', {}, Number.isFinite(total) ? `${sdb(total)} dBu` : 'rien'));
    tbl.replaceChildren(el('tr', {}, el('th', {}, 'Sortie'), ...T.map((t) => el('th', {}, t.nom)), el('th', {}, 'Niveau')),
      ligne('Façade', S.principale.parts.map((p) => ({ nom: p.nom, g: p.g, d: p.d })), Math.max(S.principale.g, S.principale.d)),
      ligne('Retour du chanteur', S.aux.parts, S.aux.v),
      ligne('Effets', S.fx.parts, S.fx.v));
    const L = boucle({ gainSysteme: 6 + T[0].aux + M.auxMaster, distance: dist, rejet: rejetCardio(angle) });
    read.set('Façade (MAIN OUT, XLR)', Number.isFinite(S.principale.xlr) ? `${fdb(S.principale.xlr, 'dBu')} (gauche ${sdb(S.principale.g + GAIN_XLR)}, droite ${sdb(S.principale.d + GAIN_XLR)})` : 'rien');
    read.set('Retour du chanteur (AUX OUT)', Number.isFinite(S.aux.v) ? `${fdb(S.aux.v, 'dBu')} : pré-fader, il ne suit pas les faders de la façade` : 'rien');
    read.set('Envoi d\'effets (FX SEND)', Number.isFinite(S.fx.v) ? `${fdb(S.fx.v, 'dBu')} vers la réverbération ; son retour ${Number.isFinite(S.fx.retour) ? `revient à ${fdb(S.fx.retour, 'dBu')} dans le bus` : 'est fermé'}` : 'rien : aucune tranche n\'envoie à l\'effet');
    read.set('Enregistreur (REC OUT, RCA)', Number.isFinite(S.rec) ? `${fdb(S.rec, 'dBu')}, soit ${fdb(S.rec + 20 * Math.log10(0.775), 'dBV')} (niveau grand public, ${fmtNum(-GAIN_REC + GAIN_XLR, 1)} dB sous la XLR)` : 'rien');
    read.set('Casque (PHONES)', `${S.casque.quoi} (${fdb(S.casque.v, 'dBu')})`);
    read.set('Retour : marge avant larsen', !Number.isFinite(L.gain) ? 'pas de retour : aucune boucle' : L.larsen ? `aucune : gain de boucle ${fdb(L.gain)}, ça accroche` : `${fmtNum(L.marge, 1)} dB (micro à ${fmtNum(dist, 1)} m du retour, ${angle}° hors de son axe : rejet ${fmtNum(rejetCardio(angle), 0)} dB)`);
    const v = L.larsen ? ['ko', 'Larsen : le retour revient dans le micro plus fort qu\'il n\'en est parti. Placez le retour derrière le micro (dans l\'axe mort du cardioïde), éloignez-le, ou baissez l\'AUX.']
      : T[0].fader < -20 && Number.isFinite(S.aux.v) ? ['ok', 'Le chant a quitté la façade, mais le chanteur s\'entend toujours dans son retour : l\'AUX est pré-fader. Sa réverbération, post-fader, est partie avec lui.']
        : M.pfl != null ? ['warn', 'Le casque écoute une tranche seule (PFL) : rien n\'a changé à la façade ni dans les retours.']
          : ['ok', 'Chaque sortie a son mélange : la façade suit les faders, le retour suit les boutons AUX, l\'effet suit les faders et les boutons FX.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  const db = (v) => (v <= -40 ? 'fermé' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' dB');
  const knob = (t, k, label, min = -40, max = 10) => slider(label, min, max, Number.isFinite(t[k]) ? t[k] : min, 1, (v) => { t[k] = v <= -40 ? -Infinity : v; draw(); }, db);
  host.append(
    el('div', { class: 'co-ctl' }, knob(T[0], 'fader', 'Fader du chant'), knob(T[0], 'aux', 'AUX du chant (pré)'), knob(T[0], 'fx', 'FX du chant (post)')),
    el('div', { class: 'co-ctl' }, knob(T[1], 'fader', 'Fader de la guitare'), knob(T[1], 'aux', 'AUX de la guitare'), knob(T[2], 'fader', 'Fader du clavier')),
    el('div', { class: 'co-ctl' },
      slider('Master', -40, 10, 0, 1, (v) => { M.master = v <= -40 ? -Infinity : v; draw(); }, db),
      slider('Master AUX', -40, 10, 0, 1, (v) => { M.auxMaster = v <= -40 ? -Infinity : v; draw(); }, db),
      slider('Retour d\'effet', -40, 10, -6, 1, (v) => { M.fxRetour = v <= -40 ? -Infinity : v; draw(); }, db),
      choice('Casque', [['main', 'principale'], ['pfl', 'PFL guitare']], 'main', (v) => { M.pfl = v === 'pfl' ? 1 : undefined; draw(); })),
    el('div', { class: 'co-scroll' }, tbl),
    el('div', { class: 'co-ctl' },
      slider('Retour : angle avec l\'axe du micro', 0, 180, angle, 15, (v) => { angle = v; draw(); }, (v) => v + '°'),
      slider('Distance micro – retour', 0.4, 3, dist, 0.1, (v) => { dist = v; draw(); }, (v) => fmtNum(v, 1) + ' m')),
    el('p', { class: 'note' }, 'Le larsen, en modèle simplifié : avec l\'AUX du chant et son master à 0 dB, le retour rend à 1 m 6 dB de plus que ce que le micro capte (un ordre de grandeur choisi pour l\'exemple) ; la distance retire 20 log₁₀ d, le micro cardioïde rejette ce qui arrive hors de son axe.'),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 3. L'audio numérique
// ======================================================================================
function figNumerique() {
  const f = figure(720, 296, 'Du son au nombre : un sinus échantillonné à intervalles réguliers (48 000 fois par seconde), chaque échantillon arrondi à une valeur sur 24 bits ; à droite, les liaisons : AES3 (deux canaux, XLR 110 Ω ou BNC 75 Ω), MADI (64 canaux, coaxial ou fibre), l\'audio embarqué dans le SDI, l\'audio en réseau (AES67, Dante, ST 2110-30). En bas, l\'alignement : 0 dBu correspond à −18 dBFS selon l\'EBU R68.');
  f.append(txt(10, 16, 'Échantillonner, quantifier, transporter', 'co-t', 'start'));
  // le sinus échantillonné
  const x0 = 20, w = 300, y0 = 96, A = 52;
  f.append(sv('line', { x1: x0, y1: y0, x2: x0 + w, y2: y0, stroke: C.line }));
  let d = ''; for (let i = 0; i <= 120; i++) { const x = x0 + i / 120 * w, y = y0 - A * Math.sin(i / 120 * 2 * Math.PI * 1.5); d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `; }
  f.append(sv('path', { d, fill: 'none', stroke: C.grey, strokeDasharray: '3 3' }));
  for (let k = 0; k <= 18; k++) { const x = x0 + k / 18 * w, v = Math.sin(k / 18 * 2 * Math.PI * 1.5), q = Math.round(v * 4) / 4, y = y0 - A * q; f.append(sv('line', { x1: x, y1: y0, x2: x, y2: y, stroke: C.amber }), sv('circle', { cx: x, cy: y, r: 3, fill: C.amber })); }
  f.append(txt(x0, 172, 'un échantillon toutes les 20,8 µs à 48 kHz, arrondi', 'co-s', 'start'));
  f.append(txt(x0, 188, '(ici sur quelques niveaux ; en 24 bits, 16 777 216)', 'co-s', 'start'));
  f.append(txt(x0, 204, 'Nyquist : on ne rend que ce qui est sous 24 kHz', 'co-s', 'start'));
  // les liaisons
  const L = [['AES3', '2 canaux · XLR 110 Ω ou BNC 75 Ω', C.amber], ['MADI (AES10)', '64 canaux à 48 kHz · coax ou fibre', C.cyan], ['SDI embarqué', '16 canaux en HD-SDI', C.green], ['Réseau', 'AES67, Dante, ST 2110-30', C.violet]];
  L.forEach(([a, b, col], i) => { const y = 30 + i * 36; f.append(box(410, y, 300, 30, col), txt(420, y + 19, a, 'co-t', 'start'), txt(700, y + 19, b, 'co-s', 'end')); });
  // l'alignement
  const Y = 238, X = (v) => 60 + (v + 60) / 60 * 600;
  f.append(txt(10, Y - 12, 'L\'alignement EBU R68 : 0 dBu = −18 dBFS, la pleine échelle à +18 dBu', 'co-t', 'start'));
  f.append(sv('rect', { x: X(-60), y: Y, width: X(-18) - X(-60), height: 10, fill: C.pvw, opacity: 0.5 }), sv('rect', { x: X(-18), y: Y, width: X(0) - X(-18), height: 10, fill: C.amber, opacity: 0.6 }));
  for (const v of [-60, -40, -18, 0]) f.append(sv('line', { x1: X(v), y1: Y - 3, x2: X(v), y2: Y + 14, stroke: '#e8eef2' }), txt(X(v), Y + 26, `${v ? sdb(v, 0) : '0'} dBFS`, 'co-m', v === -60 ? 'start' : v === 0 ? 'end' : 'middle'), txt(X(v), Y + 40, `${v + 18 ? sdb(v + 18, 0) : '0'} dBu`, 'co-s', v === -60 ? 'start' : v === 0 ? 'end' : 'middle'));
  f.append(txt(X(-9), Y - 2, 'la marge : 18 dB', 'co-s'));
  return f;
}

function demoNumerique(host) {
  let f = 5000, fs = 48000, bits = 16, alig = 'r68', dbfs = -18, canaux = 2;
  const cv = canvas(720, 200, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Fréquence de Nyquist', 'Fréquence entendue', 'Valeurs par échantillon', 'Dynamique théorique', 'Débit brut (PCM)', 'Sur un câble AES3', 'Sur un lien MADI', 'Tension correspondante']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const fa = repliement(f, fs), rep = f > nyquist(fs);
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 200);
    const dur = Math.max(4 / Math.max(fa, 1000), 0.6e-3), np = Math.min(9000, Math.max(1400, Math.ceil(f * dur * 24))), x = (t) => 10 + t / dur * 700, y0 = 92, A = 64;
    g.strokeStyle = '#3a444c'; g.beginPath(); g.moveTo(10, y0); g.lineTo(710, y0); g.stroke();
    // le son d'origine (fin), les échantillons, la sinusoïde que le convertisseur rend
    g.strokeStyle = '#59646f'; g.lineWidth = 1; g.beginPath(); for (let i = 0; i <= np; i++) { const t = i / np * dur; g[i ? 'lineTo' : 'moveTo'](x(t), y0 - A * Math.sin(2 * Math.PI * f * t)); } g.stroke();
    const q = 2 ** Math.min(bits, 6) / 2; // l'escalier n'est visible qu'aux petites résolutions
    g.fillStyle = C.amber; g.strokeStyle = C.amber;
    for (let k = 0; k * (1 / fs) <= dur; k++) { const t = k / fs, v = Math.sin(2 * Math.PI * f * t), vq = bits <= 6 ? Math.round(v * q) / q : v; g.beginPath(); g.moveTo(x(t), y0); g.lineTo(x(t), y0 - A * vq); g.stroke(); g.fillRect(x(t) - 2, y0 - A * vq - 2, 4, 4); }
    g.strokeStyle = rep ? C.tally : C.pvw; g.lineWidth = 2; g.beginPath(); for (let i = 0; i <= 1400; i++) { const t = i / 1400 * dur; const ph = rep && Math.round(f / fs) * fs > f ? -1 : 1; g[i ? 'lineTo' : 'moveTo'](x(t), y0 - A * ph * Math.sin(2 * Math.PI * fa * t)); } g.stroke(); g.lineWidth = 1;
    g.font = '11px Arial, sans-serif'; g.fillStyle = '#aab4ba';
    g.fillText(`gris : le son (${fmtNum(f)} Hz) · ambre : les échantillons à ${fmtNum(fs)} Hz · ${rep ? 'rouge : ce que le convertisseur rend, replié' : 'vert : ce que le convertisseur rend'} (${fmtNum(fa)} Hz) · ${fmtNum(dur * 1000, 2)} ms`, 10, 190);
    const dyn = dynamique(bits), deb = debitPcm(fs, bits, canaux);
    read.set('Fréquence de Nyquist', `${fmtNum(nyquist(fs))} Hz (fs ÷ 2)`);
    read.set('Fréquence entendue', rep ? `${fmtNum(fa)} Hz : la fréquence s'est repliée (|${fmtNum(f)} − ${fmtNum(Math.round(f / fs) * fs)}|)` : `${fmtNum(fa)} Hz : rendue telle quelle`);
    read.set('Valeurs par échantillon', `2^${bits} = ${fmtNum(valeurs(bits))}`);
    read.set('Dynamique théorique', `${fmtNum(dyn, 1)} dB (6,02 × ${bits} + 1,76)`);
    read.set('Débit brut (PCM)', `${fmtNum(deb / 1e6, 3)} Mb/s pour ${canaux} ${canaux > 1 ? 'canaux' : 'canal'} (${fmtNum(fs)} × ${bits} bits${canaux > 1 ? ` × ${canaux}` : ''})`);
    read.set('Sur un câble AES3', `2 canaux par câble : ${fmtNum(Math.ceil(canaux / 2))} câble${canaux > 2 ? 's' : ''} ; ${fmtNum(debitAes3(fs) / 1e6, 3)} Mb/s par câble (64 bits par période d'échantillon)`);
    read.set('Sur un lien MADI', fs > 96000 ? 'au-delà de 96 kHz, il faut d\'autres modes du MADI (à vérifier sur les appareils)' : `${canauxMadi(fs)} canaux au plus à ${fmtNum(fs)} Hz : ${canaux <= canauxMadi(fs) ? 'un lien suffit' : `${Math.ceil(canaux / canauxMadi(fs))} liens`} (${fmtNum(debitMadi(fs, Math.min(canaux, canauxMadi(fs))) / 1e6, 1)} Mb/s utiles sur 100)`);
    const A2 = ALIGNEMENTS[alig], dbu = dbuDeDbfs(dbfs, A2);
    read.set('Tension correspondante', `${sdb(dbfs, 0)} dBFS = ${fdb(dbu, 'dBu')} selon ${A2.nom} (${fmtNum(vDeDbu(dbu), 3)} V efficaces)`);
    const v = rep ? ['ko', `Repliement : ${fmtNum(f)} Hz dépasse ${fmtNum(nyquist(fs))} Hz et revient à ${fmtNum(fa)} Hz, un son qui n'existait pas. Le filtre anti-repliement, avant le convertisseur, l'empêche.`]
      : bits <= 8 ? ['warn', `Sur ${bits} bits, l'escalier des valeurs s'entend : ${fmtNum(dyn, 0)} dB de dynamique seulement, un souffle granuleux. Le broadcast travaille en 24 bits.`]
        : ['ok', `${fmtNum(f)} Hz est sous ${fmtNum(nyquist(fs))} Hz : il est rendu tel quel. Sur ${bits} bits, ${fmtNum(dyn, 0)} dB de dynamique théorique.`];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Fréquence du son', 100, 40000, f, 100, (v) => { f = v; draw(); }, (v) => fmtNum(v) + ' Hz'),
      choice('Échantillonnage', [['44100', '44,1 kHz', 'le disque compact'], ['48000', '48 kHz', 'le broadcast'], ['96000', '96 kHz', 'la haute résolution']], '48000', (v) => { fs = +v; draw(); })),
    el('div', { class: 'co-ctl' },
      choice('Résolution', [['4', '4 bits'], ['8', '8 bits'], ['16', '16 bits'], ['24', '24 bits']], '16', (v) => { bits = +v; draw(); }),
      slider('Canaux', 1, 128, canaux, 1, (v) => { canaux = v; draw(); }, (v) => String(v))),
    el('div', { class: 'co-ctl' },
      choice('Alignement', [['r68', 'EBU R68'], ['rp155', 'SMPTE RP 155']], 'r68', (v) => { alig = v; draw(); }),
      slider('Niveau numérique', -60, 0, dbfs, 1, (v) => { dbfs = v; draw(); }, (v) => sdb(v, 0) + ' dBFS')),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Un sinus échantillonné : au-dessus de fs / 2, les échantillons décrivent une autre fréquence, plus basse. En 4 bits, l\'escalier de la quantification se voit sur les échantillons.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 4. Mesurer le programme : crête, vumètre, loudness
// ======================================================================================
function figLoudness() {
  const f = figure(720, 252, 'Trois façons de lire un niveau : le crête-mètre suit chaque crête (ce que voit le convertisseur, en dBFS), le vumètre une moyenne lente, la loudness le volume perçu (filtre K, moyenne en énergie, LUFS) sur trois fenêtres : momentanée 400 ms, court terme 3 s, intégrée sur tout le programme avec ses portes à −70 LUFS et 10 LU sous la moyenne. Cible EBU R128 : −23 LUFS, crête vraie sous −1 dBTP.');
  f.append(txt(10, 16, 'Lire un niveau : crête, vumètre, loudness', 'co-t', 'start'));
  const rows = [
    ['Crête-mètre', 'chaque crête, en dBFS', 'rien ne doit toucher 0 dBFS', C.red],
    ['Vumètre', 'moyenne lente (≈ 300 ms)', 'proche de l\'oreille, sans norme commune', C.amber],
    ['Loudness', 'BS.1770 : filtre K, énergie, LUFS', 'le volume perçu, que la chaîne contrôle', C.green],
  ];
  rows.forEach(([a, b, c, col], i) => { const y = 30 + i * 34; f.append(box(10, y, 700, 28, col), txt(20, y + 18, a, 'co-t', 'start'), txt(130, y + 18, b, 'co-m', 'start'), txt(700, y + 18, c, 'co-s', 'end')); });
  // les portes de l'intégrée
  const Y = 150, X = (t) => 40 + t / 60 * 640, L = (l) => Y + 70 - (Math.max(-50, l) + 50) / 40 * 70;
  const prog = [[0, 8, -25], [8, 12, -60], [12, 30, -24], [30, 36, -15], [36, 46, -38], [46, 60, -23]];
  f.append(txt(10, Y - 8, 'L\'intégrée : on écarte les silences (sous −70 LUFS) puis ce qui est 10 LU sous la moyenne', 'co-t', 'start'));
  f.append(sv('line', { x1: 40, y1: L(-23), x2: 680, y2: L(-23), stroke: C.pvw, strokeDasharray: '4 3' }), txt(684, L(-23) + 4, '−23', 'co-m', 'start'));
  f.append(sv('line', { x1: 40, y1: L(-33.5), x2: 680, y2: L(-33.5), stroke: C.red, strokeDasharray: '2 3' }), txt(684, L(-33.5) + 4, 'porte', 'co-s', 'start', { fill: C.red }));
  for (const [a, b, l] of prog) f.append(sv('rect', { x: X(a), y: L(l), width: X(b) - X(a) - 1, height: Y + 70 - L(l), fill: l < -33.5 ? '#3a444c' : C.green, opacity: l < -33.5 ? 0.6 : 0.55 }));
  f.append(txt(X(10), Y + 84, 'silence : écarté', 'co-s'), txt(X(41), Y + 84, 'passage calme : écarté', 'co-s'), txt(X(33), L(-15) - 4, 'but', 'co-s'));
  return f;
}

/** les programmes de la manipulation : des segments de loudness (LUFS) et de crête vraie (dBTP) */
const PROGRAMMES = {
  // réglés pour tomber vers −23 LUFS : le passage calme reste sous la porte relative, le but pèse selon son énergie
  match: { nom: 'Une minute de match', seg: (k) => [{ duree: 12, lufs: -25 + k.comm, crete: -9 }, { duree: 6, lufs: -17 + k.but, crete: -3 + k.but }, { duree: 14, lufs: -25.5 + k.comm, crete: -8 }, { duree: 8, lufs: -34 + k.calme, crete: -18 }, { duree: 20, lufs: -24.8 + k.comm, crete: -7 }] },
  magazine: { nom: 'Un sujet magazine avec une pause', seg: (k) => [{ duree: 20, lufs: -23.5 + k.comm, crete: -6 }, { duree: 10, lufs: -36 + k.calme, crete: -20 }, { duree: 6, lufs: -20 + k.but, crete: -2 + k.but }, { duree: 24, lufs: -23.8 + k.comm, crete: -7 }] },
};
function demoLoudness(host) {
  const k = { comm: 0, but: 0, calme: 0, gain: 0 };
  let prog = 'match', silence = false, direct = true;
  const cv = canvas(720, 230, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Loudness intégrée', 'Porte relative', 'Blocs écartés', 'Court terme maximal', 'Plage de loudness (LRA)', 'Crête vraie maximale', 'Pour revenir à −23 LUFS']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const seg = PROGRAMMES[prog].seg(k).concat(silence ? [{ duree: 20, lufs: -Infinity, crete: -Infinity }] : []).map((s) => ({ ...s, lufs: s.lufs + k.gain, crete: s.crete + k.gain }));
    const m = mesure(seg), sb = sousBlocs(seg), b = blocs(sb), I = integree(b);
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 230);
    const n = sb.length, X = (i) => 40 + i / n * 660, Y = (l) => 200 - (Math.max(-50, Math.min(-5, l)) + 50) / 45 * 186;
    g.font = '11px Arial, sans-serif';
    for (const [l, col, lab] of [[-23, C.pvw, '−23 LUFS'], [I.porteRel, C.tally, 'porte relative'], [-10, '#3a444c', '−10'], [-40, '#3a444c', '−40']]) {
      if (!Number.isFinite(l)) continue;
      g.strokeStyle = /** @type {string} */ (col); g.setLineDash(l === -23 ? [] : [4, 4]); g.beginPath(); g.moveTo(40, Y(/** @type {number} */ (l))); g.lineTo(700, Y(/** @type {number} */ (l))); g.stroke(); g.setLineDash([]);
      g.fillStyle = /** @type {string} */ (col); g.fillText(/** @type {string} */ (lab), 2, Y(/** @type {number} */ (l)) + 4);
    }
    // les blocs de 400 ms : gardés (vert) ou écartés (gris) ; la courbe du court terme (ambre)
    b.forEach((l, j) => { const i = j + 3; if (!Number.isFinite(l)) return; g.fillStyle = l > I.porteRel && l > R128.porteAbs ? 'rgba(51,196,108,.55)' : 'rgba(90,100,108,.55)'; g.fillRect(X(i), Y(l), Math.max(1, 660 / n), 200 - Y(l)); });
    g.strokeStyle = C.amber; g.lineWidth = 2; g.beginPath(); let on = false;
    for (let i = 0; i < n; i++) { const l = fenetre(sb, i, 30); if (!Number.isFinite(l)) { on = false; continue; } g[on ? 'lineTo' : 'moveTo'](X(i), Y(l)); on = true; } g.stroke(); g.lineWidth = 1;
    if (Number.isFinite(I.I)) { g.strokeStyle = '#fff'; g.beginPath(); g.moveTo(40, Y(I.I)); g.lineTo(700, Y(I.I)); g.stroke(); g.fillStyle = '#fff'; g.fillText(`intégrée ${sdb(I.I)}`, 610, Y(I.I) - 5); }
    g.fillStyle = '#aab4ba'; g.fillText(`blocs de 400 ms (vert : comptés, gris : écartés) · ambre : court terme (3 s) · ${fmtNum(m.duree)} s`, 40, 222);
    const C2 = conformeR128(m.I, m.crete, direct);
    read.set('Loudness intégrée', Number.isFinite(m.I) ? `${sdb(m.I)} LUFS` : '—');
    read.set('Porte relative', Number.isFinite(I.porteRel) ? `${sdb(I.porteRel)} LUFS (10 LU sous la moyenne des blocs non silencieux)` : '—');
    read.set('Blocs écartés', `${I.sousAbs} sous −70 LUFS (silences), ${I.sousRel} sous la porte relative, sur ${I.total}`);
    read.set('Court terme maximal', `${sdb(m.ctMax)} LUFS (momentanée : ${sdb(m.momMax)})`);
    read.set('Plage de loudness (LRA)', `${fmtNum(m.lra, 1)} LU`);
    read.set('Crête vraie maximale', `${sdb(m.crete)} dBTP${C2.crete ? '' : ' : au-dessus de −1 dBTP'}`);
    read.set('Pour revenir à −23 LUFS', !Number.isFinite(m.I) ? '—' : Math.abs(m.correction) < 0.05 ? 'rien : le programme est déjà à −23 LUFS' : `${fdb(m.correction)} sur tout le programme${!C2.crete || m.crete + m.correction > R128.crete ? ', puis un limiteur de crête vraie' : ''}`);
    const v = !C2.loudness ? ['ko', `Hors tolérance : ${sdb(m.I)} LUFS, à plus de ${fmtNum(C2.tol, 1).replace(',0', '')} LU de −23. ${m.I > -23 ? 'Trop fort' : 'Trop faible'} : en direct, on corrige au master en suivant le court terme.`]
      : !C2.crete ? ['warn', `La loudness tient, mais une crête vraie dépasse −1 dBTP (${sdb(m.crete)}) : il faut un limiteur, la chaîne la refuserait.`]
        : ['ok', `Conforme R128 : ${sdb(m.I)} LUFS (tolérance ±${fmtNum(C2.tol, 1).replace(',0', '')} LU${direct ? ' en direct' : ''}), crêtes vraies sous −1 dBTP. Le but monte à ${sdb(m.ctMax, 0)} LUFS au court terme : il pèse selon son énergie et sa durée.`];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  const db = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' dB';
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Programme', Object.entries(PROGRAMMES).map(([id, p]) => [id, p.nom]), prog, (v) => { prog = v; draw(); }),
      choice('Fin', [['non', 'sans silence'], ['oui', '+ 20 s de silence']], 'non', (v) => { silence = v === 'oui'; draw(); }),
      choice('Tolérance', [['direct', 'direct (±1 LU)'], ['pad', 'enregistré (±0,5 LU)']], 'direct', (v) => { direct = v === 'direct'; draw(); })),
    el('div', { class: 'co-ctl' },
      slider('Commentaires et ambiance', -8, 8, 0, 1, (v) => { k.comm = v; draw(); }, db),
      slider('Le but (la foule, le commentateur)', -6, 6, 0, 1, (v) => { k.but = v; draw(); }, db),
      slider('Le passage calme', -30, 10, 0, 1, (v) => { k.calme = v; draw(); }, db),
      slider('Master (tout le programme)', -10, 10, 0, 1, (v) => { k.gain = v; draw(); }, db)),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'La loudness d\'un programme calculée comme le fait l\'appareil (ITU-R BS.1770-4) : chaque bloc de 400 ms, un toutes les 100 ms, puis la moyenne en énergie des blocs qui passent les deux portes.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 5. Dante : l'audio sur le réseau
// ======================================================================================
function figDante() {
  const f = figure(720, 262, 'Un réseau Dante : le boîtier de scène, la console, l\'enregistreur et le PC de Dante Controller sur un commutateur Gigabit (le réseau primaire, et un second réseau en secours). Des flux unicast vont d\'un émetteur à un récepteur ; un flux multicast part une fois vers plusieurs. Un appareil est le leader de l\'horloge PTP ; celui qui reçoit le word clock du SPG peut le donner au réseau. QoS : DSCP 56 pour le PTP, 46 pour l\'audio.');
  f.append(txt(10, 16, 'Un réseau Dante : un câble à la place du multipaire', 'co-t', 'start'));
  f.append(box(280, 104, 160, 40, C.cyan), txt(360, 122, 'Commutateur Gigabit', 'co-t'), txt(360, 136, 'QoS · IGMP · EEE coupé', 'co-s'));
  const D = [
    [20, 34, 'Boîtier de scène', '32 entrées micro', C.amber], [20, 180, 'Leader d\'horloge', 'word clock du SPG → PTP', C.green],
    [560, 34, 'Console', '64 canaux en entrée', C.amber], [560, 116, 'Enregistreur', 'multipiste', C.amber], [560, 196, 'PC', 'Dante Controller', C.grey],
  ];
  for (const [x, y, a, b, col] of D) f.append(box(/** @type {number} */ (x), /** @type {number} */ (y), 150, 44, /** @type {string} */ (col)), txt(/** @type {number} */ (x) + 75, /** @type {number} */ (y) + 19, /** @type {string} */ (a), 'co-t'), txt(/** @type {number} */ (x) + 75, /** @type {number} */ (y) + 35, /** @type {string} */ (b), 'co-s'));
  f.append(arrow(172, 56, 288, 114, C.amber), txt(220, 74, 'unicast', 'co-s', 'middle', { fill: C.amber }));
  f.append(arrow(432, 114, 558, 56, C.amber), arrow(432, 128, 558, 138, C.violet), txt(500, 128, 'multicast', 'co-s', 'middle', { fill: C.violet }));
  f.append(arrow(172, 200, 288, 140, C.green), txt(206, 182, 'PTP', 'co-s', 'middle', { fill: C.green }), sv('line', { x1: 432, y1: 140, x2: 558, y2: 214, stroke: C.grey }));
  f.append(sv('rect', { x: 290, y: 160, width: 140, height: 26, rx: 3, fill: C.box, stroke: '#3f7fe6', strokeDasharray: '4 3' }), txt(360, 177, 'secondaire (secours)', 'co-s'));
  f.append(txt(10, 246, `Un canal : 48 000 × 24 bits = ${fmtNum(canalUtile() / 1e6, 3)} Mb/s utiles ; un flux de 4 canaux ≈ ${fmtNum(flux({ canaux: 4 }).debit / 1e6, 1)} Mb/s sur le fil (en-têtes comptés comme AES67, ordre de grandeur)`, 'co-s', 'start'));
  return f;
}
function demoDante(host) {
  let canaux = 32, rx = 2, multicast = false, lien = 1000, bonds = 3, autre = 20, lat = 1;
  const cv = canvas(720, 150, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Flux envoyés par le boîtier', 'Débit sur son lien', 'Charge du lien', 'Retard du paquet le plus lent', 'Latence choisie', 'Latence conseillée', 'Du micro au casque (avec les convertisseurs)']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const E = emission({ canaux, recepteurs: rx, multicast });
    const ch = charge(E.debit, lien) + autre / 100;
    const D = delaiChemin({ bonds, lienMbps: lien, octets: flux({ canaux: 4 }).fil, charge: ch });
    const T = tient(lat, D.total), cons = latenceConseillee(D.total);
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 150);
    // la charge du lien
    g.font = '11px Arial, sans-serif'; g.fillStyle = '#aab4ba'; g.fillText(`le lien du boîtier (${lien === 1000 ? '1 Gb/s' : '100 Mb/s'}) : audio Dante, autre trafic`, 10, 14);
    const W = 700, a = Math.min(1, charge(E.debit, lien)), o = Math.min(1 - a, autre / 100);
    g.fillStyle = '#1a2026'; g.fillRect(10, 22, W, 18); g.fillStyle = ch > 1 ? C.tally : C.amber; g.fillRect(10, 22, W * a, 18); g.fillStyle = '#5a646c'; g.fillRect(10 + W * a, 22, W * o, 18);
    g.fillStyle = '#fff'; g.fillText(`${fmtNum(Math.min(ch, 9.99) * 100, 0)} %`, 14 + W * Math.min(1, ch), 36);
    // la fenêtre de latence : le paquet le plus lent doit arriver avant
    g.fillStyle = '#aab4ba'; g.fillText('le paquet le plus lent et la fenêtre de latence (0 à 5 ms)', 10, 66);
    const X = (us) => 10 + Math.min(5000, us) / 5000 * W;
    g.fillStyle = 'rgba(51,196,108,.25)'; g.fillRect(10, 74, X(lat * 1000) - 10, 30);
    g.textAlign = 'center';
    for (const l of LATENCES) { g.strokeStyle = '#3a444c'; g.beginPath(); g.moveTo(X(l * 1000), 72); g.lineTo(X(l * 1000), 108); g.stroke(); g.fillStyle = '#6a747c'; g.fillText(`${fmtNum(l, 2).replace(/,?0+$/, '')}${l >= 1 ? ' ms' : ''}`, X(l * 1000), 120); }
    g.textAlign = 'start';
    g.fillStyle = T.ok ? C.pvw : C.tally; g.fillRect(X(D.total) - 2, 70, 4, 38);
    g.fillStyle = '#aab4ba'; g.fillText(`${bonds} commutateur${bonds > 1 ? 's' : ''} : sérialisation ${fmtNum(D.ser, 1)} µs et attente ${fmtNum(D.attente, 1)} µs à chacun`, 10, 142);
    read.set('Flux envoyés par le boîtier', `${E.flux} flux ${multicast ? 'multicast (une seule copie, recopiée par le réseau)' : `unicast (${Math.ceil(canaux / 4)} par récepteur, ${rx} récepteur${rx > 1 ? 's' : ''})`}`);
    read.set('Débit sur son lien', `${fmtNum(E.debit / 1e6, 1)} Mb/s pour ${canaux} canaux (${fmtNum(canaux * canalUtile() / 1e6, 1)} Mb/s utiles, ${ENTETES_TOTAL} octets d'en-têtes par paquet)`);
    read.set('Charge du lien', `${fmtNum(ch * 100, 0)} %${ch > 1 ? ' : le lien déborde, des paquets sont perdus' : ch > 0.7 ? ' : chargé, l\'attente grandit' : ''}`);
    read.set('Retard du paquet le plus lent', ch >= 0.97 ? 'sans fin : le lien est saturé' : `${fmtNum(D.total, 1)} µs`);
    read.set('Latence choisie', `${fmtNum(lat, 2).replace(/,?0+$/, '')} ms : ${T.ok ? `marge de ${fmtNum(T.marge, 0)} µs` : 'trop courte, des paquets arrivent après l\'heure'}`);
    read.set('Latence conseillée', `${fmtNum(cons, 2).replace(/,?0+$/, '')} ms (le double du retard, pour la gigue)`);
    read.set('Du micro au casque (avec les convertisseurs)', `${fmtNum(lat + 2 * latenceMs(24, 48000), 2)} ms : la latence choisie, fixe, et deux convertisseurs (≈ ${fmtNum(latenceMs(24, 48000), 2)} ms chacun, ordre de grandeur)`);
    const v = ch > 1 ? ['ko', `Le lien déborde : ${fmtNum(E.debit / 1e6, 0)} Mb/s d'audio sur un lien à ${lien} Mb/s. Passez en Gigabit, ou en multicast pour n'envoyer qu'une copie.`]
      : !T.ok ? ['ko', `Latence trop courte : le paquet le plus lent arrive en ${fmtNum(D.total / 1000, 2)} ms, après les ${fmtNum(lat, 2).replace(/,?0+$/, '')} ms choisies. Le son claque ; choisissez ${fmtNum(cons, 2).replace(/,?0+$/, '')} ms.`]
        : ch > 0.7 ? ['warn', `Ça passe, mais le lien est chargé : avec la QoS (DSCP ${DSCP.audio.valeur} pour l'audio, ${DSCP.ptp.valeur} pour le PTP), l'audio passe devant les copies de fichiers.`]
          : ['ok', `Tout arrive à temps : ${fmtNum(D.total, 0)} µs de trajet dans une fenêtre de ${fmtNum(lat * 1000, 0)} µs. Le son sort exactement ${fmtNum(lat, 2).replace(/,?0+$/, '')} ms après son entrée, sur tous les appareils.`];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Canaux du boîtier de scène', 4, 64, canaux, 4, (v) => { canaux = v; draw(); }, (v) => String(v)),
      slider('Récepteurs', 1, 4, rx, 1, (v) => { rx = v; draw(); }, (v) => String(v)),
      choice('Flux', [['uni', 'unicast'], ['multi', 'multicast']], 'uni', (v) => { multicast = v === 'multi'; draw(); })),
    el('div', { class: 'co-ctl' },
      choice('Lien', [['1000', '1 Gb/s'], ['100', '100 Mb/s']], '1000', (v) => { lien = +v; draw(); }),
      slider('Commutateurs traversés', 1, 8, bonds, 1, (v) => { bonds = v; draw(); }, (v) => String(v)),
      slider('Autre trafic sur le lien', 0, 80, autre, 5, (v) => { autre = v; draw(); }, (v) => v + ' %'),
      choice('Latence (Dante Controller)', LATENCES.map((l) => [String(l), `${fmtNum(l, 2).replace(/,?0+$/, '')} ms`]), String(lat), (v) => { lat = +v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'En haut, la charge du lien du boîtier de scène ; en bas, le retard du paquet le plus lent (trait) face à la latence choisie (vert) : il doit arriver avant.')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// les leçons
// ======================================================================================
/** @type {import('./index.js').Lesson[]} */
export const SON_CONSOLE = [
  {
    id: 'son-console', title: 'La console analogique : de la prise au fader', minutes: '10 min', partie: PARTIE_CONSOLE,
    essentials: [
      'Une tranche se lit de haut en bas : **entrée** (XLR micro, jack ligne), **GAIN**, coupe-bas, **égaliseur** trois bandes, envois **AUX** et **FX**, **PAN**, puis le **fader** qui dose la source dans le mélange.',
      'Le **gain staging** : régler le GAIN en **PFL** pour que le vumètre tourne autour du **« 0 »** sur les passages forts, sans allumer **PEAK** ; fader et master vers **0 dB**.',
      'Les décibels s\'**additionnent** d\'étage en étage ; trop bas, le souffle monte ; trop haut, le préampli **écrête**, et aucun fader ne le répare. Le **48 V** est un interrupteur commun aux entrées XLR.',
    ],
    figure: figConsole,
    demoTitle: 'Réglez le GAIN pour que le vumètre en PFL tourne autour du « 0 ». Poussez-le à +60 dB : la LED PEAK, puis l\'écrêtage, que le fader ne rattrape pas. Prenez la guitare et coupez le 48 V. Enfin, baissez le fader de 20 dB et montez le master d\'autant : regardez le souffle.',
    demo: demoConsole,
    body: `La section son de l'établissement travaille sur de petites **consoles analogiques** de la gamme Antmix d'ANT (simulation non officielle) : quelques voies micro, des voies stéréo pour les claviers et les lecteurs, des effets numériques intégrés. Le signal y reste une **tension** du début à la fin : chaque bouton l'amplifie ou l'atténue, et chaque étage a un plafond. Les détails changent d'un modèle à l'autre (nombre de voies, plage du GAIN, compresseur à un bouton sur certaines voies, interface USB sur d'autres) : ce qui suit décrit une console de ce type, à comparer avec la face avant de la vôtre.

**La tranche, de haut en bas.** L'**entrée** : une prise **XLR** pour un micro (symétrique, quelques millivolts) et une prise **jack** pour une source ligne (clavier, lecteur, quelques centaines de millivolts). Le **GAIN** (préampli) adapte ce niveau à celui de la console : de l'ordre de 0 à +50 dB. Le **coupe-bas** (vers ${COUPE_BAS.f} Hz) retire le grondement de la scène et les chocs sur le pied. L'**égaliseur** fixe à trois bandes corrige le timbre : **HIGH** vers 12 kHz, **MID** vers 2,5 kHz, **LOW** vers 80 Hz, ±15 dB chacun. Viennent ensuite les **envois** : **AUX**, pris **avant le fader** (pré-fader), pour les retours de scène, et **FX**, pris **après** (post-fader), vers les effets. Le **PAN** place la source entre gauche et droite, la LED **PEAK** prévient d'une crête trop forte, la touche **PFL** (ou SOLO) envoie la tranche seule au casque et au vumètre. Le **fader** enfin, de 60 mm sur la plupart des modèles, dose la source dans le mélange ; son repère **0** (ou U) est le **gain unité** : il ne change rien au niveau.

**La section master.** Le **bus principal** (gauche et droite) additionne toutes les tranches ; son **master** règle la sortie. À côté : les **effets intégrés** (réverbérations, échos, choisis par un numéro) et leur **retour** dans le mélange, le master **AUX**, le niveau de l'écoute **casque et cabine**, et les **vumètres à LED**, qui lisent le bus principal, ou la tranche en PFL. Et le **48 V** : sur ces consoles, c'est souvent **un seul interrupteur** pour toutes les entrées XLR (ou pour un groupe de voies). Les micros statiques en ont besoin, les dynamiques le supportent ; on l'allume et on le coupe **master baissé** (le claquement passe sinon dans la diffusion), et l'on vérifie ce qui est branché en XLR avant de l'allumer.

**Le gain staging**, c'est-à-dire le réglage des gains d'un étage à l'autre, se fait toujours dans le même ordre :
- faders et master en bas, 48 V selon les micros ;
- sur chaque tranche, **PFL** enfoncé, la source joue **au plus fort** (le chanteur chante le refrain) : on monte le **GAIN** jusqu'à ce que le vumètre tourne autour du **« 0 »**, sans que PEAK s'allume ;
- on relâche le PFL, on monte le **fader vers 0** et le **master vers 0**, puis on fait le mélange aux faders, autour de 0 ;
- l'égaliseur ensuite, en revérifiant le GAIN : une bande qui pousse ajoute du niveau.

**Pourquoi cet ordre.** Les décibels **s'additionnent** : un micro dynamique type SM58 (1,85 mV/Pa) devant un chanteur dont les crêtes atteignent 110 dB SPL donne environ −36 dBu ; +36 dB de GAIN le portent à **0 dBu**, le « 0 » des vumètres (le niveau nominal interne, ordre de grandeur). Le fader à 0, le PAN au centre (−3 dB par voie, la loi de panoramique), le master à 0 : le bus est vers −3 dBu, la sortie XLR vers +1 dBu. Au-dessus du « 0 », il reste une **marge** d'une vingtaine de dB : l'écrêtage interne d'une petite console est de l'ordre de **+20 à +22 dBu**. Trop de GAIN, et le préampli écrête **avant** le fader : le baisser donne un son écrêté moins fort. Trop peu de GAIN, et il faut pousser le fader et le master : le **souffle** du préampli, puis celui du bus, monte avec le signal. Un master haut avec des faders bas amplifie le souffle du bus pour rien.

- À vérifier sur la console de l'établissement : la plage du GAIN, la fréquence du coupe-bas, si l'AUX est pré ou post-fader (souvent un sélecteur PRE/POST), les voies qui ont le 48 V, le niveau des sorties.
- Une voie stéréo n'a pas de préampli micro : un niveau (GAIN ou LEVEL), un égaliseur souvent réduit, une **balance** au lieu du PAN.`,
    car: { text: 'Au poste son du car, la console numérique (inspirée de la Studer Vista 1) suit la même logique : la vue ENTRÉE donne le gain et le 48 V de chaque tranche (là, par tranche), le PFL écoute une source seule, les crête-mètres d\'entrée allument l\'OVL rouge. Les niveaux y sont numériques (dBFS) : la leçon « L\'audio numérique » fait le lien.', station: 'son' },
    terms: ['gain-staging', 'niveau-ligne'],
    competences: ['2.9', '1.4', '2.1'],
    article: 'songuide',
    quiz: [
      { q: 'Où règle-t-on le niveau d\'un micro qui arrive à la console, avant tout le reste ?', choices: ['Au GAIN de la tranche, en PFL', ['Au fader de la tranche', 'Le fader vient après le préampli : il dose un signal déjà amplifié. Si le GAIN est faux, le fader ne fait que compenser, avec le souffle ou l\'écrêtage du préampli.'], ['Au master du bus principal', 'Le master règle la somme de toutes les tranches : il ne peut pas adapter un micro à la console.']], answer: 0, why: 'Le GAIN (préampli) adapte les quelques millivolts du micro au niveau de la console. On le règle en PFL, la source au plus fort, pour un vumètre autour du « 0 » sans PEAK ; fader et master viennent ensuite, vers 0 dB.' },
      { q: 'La LED PEAK du chant s\'allume à chaque refrain. L\'assistant baisse le fader. Le son…', choices: [['devient propre', 'La crête est déjà coupée dans le préampli, avant le fader : baisser le fader donne le même son abîmé, moins fort.'], 'reste écrêté, moins fort : il fallait baisser le GAIN', ['devient plus fort sur les retours', 'Le fader ne change rien à un AUX pré-fader, et rien au préampli : le retour reste écrêté lui aussi.']], answer: 1, why: 'La LED PEAK surveille le signal avant le fader, là où le préampli écrête. Seul le GAIN la fait s\'éteindre ; le fader, plus loin, ne répare pas une forme d\'onde déjà coupée.' },
      { q: 'Un micro donne −40 dBu sur ses crêtes. Quel GAIN pour les amener au « 0 » du vumètre, à 0 dBu ?', choices: ['+40 dB', ['−40 dB', 'Il faut amplifier, pas atténuer : un GAIN négatif enfoncerait le micro dans le souffle.'], ['+4 dB', '+4 dBu est le niveau de la sortie ligne professionnelle, pas le gain d\'un micro.']], answer: 0, why: 'Les décibels s\'additionnent : −40 dBu + 40 dB = 0 dBu. C\'est l\'ordre de grandeur d\'un micro dynamique devant une voix : quelques dizaines de dB de gain.' },
      { q: 'On branche un micro statique sur la voie 2. Le vumètre ne bouge pas, même en PFL avec le GAIN au maximum. Que vérifier ?', choices: ['Le 48 V, souvent un interrupteur commun aux entrées XLR', ['Le PAN de la voie 2', 'Le PAN répartit le signal entre gauche et droite ; il ne peut pas le faire disparaître, et le PFL ne dépend pas de lui.'], ['Le retour d\'effet', 'Le retour d\'effet ajoute la réverbération au mélange ; il n\'a rien à voir avec l\'entrée d\'un micro.']], answer: 0, why: 'Un micro statique a besoin de l\'alimentation fantôme 48 V pour fonctionner. Sur ces consoles, un seul interrupteur l\'envoie à toutes les entrées XLR : on l\'allume master baissé.' },
      { q: 'Faders à −20 dB, master à +20 dB : le niveau de sortie est le même qu\'à 0 et 0. Qu\'est-ce qui change ?', choices: [['Rien : seuls comptent les dB additionnés', 'La somme est la même pour le signal, mais le master amplifie aussi le souffle du bus de mélange, qui ne passe pas par les faders.'], 'Le souffle du bus est amplifié de 20 dB : le son est moins propre', ['La marge avant l\'écrêtage augmente', 'Au contraire : le master à +20 dB pousse le bus vers son plafond si un fader remonte.']], answer: 1, why: 'Chaque étage ajoute son souffle. Avec le master à +20 dB, celui du bus de mélange est amplifié d\'autant, sans rien apporter. On mélange donc les faders autour de 0, master vers 0.' },
      { q: 'À quoi correspond la graduation « 0 » (ou U) d\'un fader ?', choices: ['Au gain unité : le fader ne change pas le niveau', ['Au silence', 'Le silence est tout en bas (−∞). Le « 0 » est le repère où le fader laisse passer le signal tel quel.'], ['Au niveau d\'écrêtage', 'L\'écrêtage est vers +20 dBu dans la console ; le « 0 » du fader est le gain unité, pas un plafond.']], answer: 0, why: 'Au « 0 », le fader n\'amplifie ni n\'atténue : c\'est sa position de travail. Au-dessus, il reste une dizaine de dB pour remonter une source ; en dessous, il l\'atténue jusqu\'au silence.' },
      { q: 'Le chanteur a déjà réglé son GAIN ; l\'ingénieur ajoute +12 dB de MID à 2,5 kHz. Que doit-il faire ensuite ?', choices: ['Revérifier le GAIN en PFL : la bande poussée ajoute du niveau', ['Monter le master de 12 dB', 'L\'égaliseur a déjà ajouté du niveau ; monter le master le pousserait encore vers l\'écrêtage.'], ['Rien : l\'égaliseur ne change jamais le niveau', 'Une bande poussée ajoute l\'énergie de cette bande : le niveau global monte, d\'autant plus que la source est riche en médiums.']], answer: 0, why: 'Une voix porte beaucoup d\'énergie dans les médiums : +12 dB à 2,5 kHz peut ajouter plusieurs dB à ses crêtes. On revient en PFL vérifier le « 0 » et la LED PEAK.' },
    ],
  },
  {
    id: 'son-sorties', title: 'Les sorties de la console : façade, retours, effets, enregistrement', minutes: '9 min', partie: PARTIE_CONSOLE,
    essentials: [
      'La **sortie principale** (XLR symétrique, niveau ligne pro **+4 dBu**) part vers la façade ou le car ; la sortie d\'**enregistrement** (RCA) est au niveau grand public **−10 dBV**, environ 12 dB plus bas.',
      'Un envoi **AUX pré-fader** fait les **retours** de scène : le musicien garde son mélange quand on bouge la façade. Un envoi **FX post-fader** suit le fader : la réverbération part avec la voix.',
      'Le **larsen** : la boucle micro, console, retour, micro dépasse 0 dB. On place le retour dans l\'**axe mort** du micro, on l\'éloigne, on baisse l\'AUX ; le casque et la cabine ne sont jamais un départ.',
    ],
    figure: figSorties,
    demoTitle: 'Baissez le fader du chant jusqu\'en bas : la façade le perd, le retour le garde, la réverbération s\'éteint. Passez le casque en PFL guitare. Puis tournez le retour vers l\'avant du micro (angle 0°) et rapprochez-le : le larsen.',
    demo: demoSorties,
    body: `Une console ne fait pas un mélange, mais plusieurs : chaque sortie a le sien, et chacun l'écoute ailleurs. À l'arrière (ou sur le dessus) d'une console de ce type, on trouve :
- **MAIN OUT** gauche et droite, en **XLR symétriques** (souvent doublées en jack) : le mélange principal, au niveau ligne professionnel, **+4 dBu** au « 0 » des vumètres (1,23 V efficaces) ;
- **AUX OUT** : la somme des boutons AUX de toutes les tranches, avec son master ;
- **FX SEND** et **FX RETURN** : l'envoi vers un effet externe et son retour, quand on n'utilise pas les effets intégrés ;
- **CTRL ROOM** et **PHONES** : l'écoute de l'ingénieur, le mélange principal ou la tranche en PFL ;
- **REC OUT** en **RCA** : une copie du mélange principal au niveau **grand public, −10 dBV** (0,316 V), soit environ **11,8 dB** sous le niveau pro ; sur certains modèles, une interface **USB** pour enregistrer sur un ordinateur.

**Pré ou post-fader.** Un envoi **AUX pré-fader** est pris **avant** le fader : il fait les **retours de scène** (les enceintes posées au sol devant les musiciens, ou leurs écouteurs). Le chanteur entend ce qu'il demande, et le mélange de la façade peut bouger sans le gêner. Un envoi **FX post-fader** est pris **après** le fader : la réverbération suit la voix. Pris avant, elle resterait seule quand on baisse la voix. L'effet rend sa réverbération par le **retour d'effet**, qui revient dans le bus principal. Sur les consoles qui le permettent, un sélecteur PRE/POST choisit pour chaque AUX ; c'est à vérifier sur la vôtre.

**Le larsen.** Le micro capte le retour, la console l'amplifie, le retour le rend plus fort, le micro le recapte : quand le **gain de cette boucle** atteint 0 dB, le son s'emballe sur une fréquence, le larsen. Trois leviers : placer le retour **dans l'axe mort** du micro (derrière un cardioïde, à 180°, il est atténué d'une vingtaine de dB), l'**éloigner** (−6 dB à chaque doublement de la distance, en champ libre), **baisser l'AUX** ; un égaliseur peut ensuite creuser la fréquence qui accroche.

**Travailler avec la section son.** Dans une captation commune, la section son fait le mélange de la salle ; la vidéo veut un son pour l'enregistrement ou la diffusion. Trois façons de le prendre, de la plus simple à la plus propre :
- la **sortie principale** : simple, mais c'est un mélange fait pour la salle (la voix est forte parce que la batterie s'entend déjà en direct) ;
- un **AUX post-fader** dédié : un « mélange diffusion » qui suit les faders, réglé à part ;
- un **partage des micros** (split) : deux consoles, chacune son mélange.
La liaison est **symétrique**, au **niveau ligne**, jamais par la sortie casque. On convient de l'**alignement** : une sinusoïde à 1 kHz au « 0 » de la console sort à +4 dBu ; un car aligné selon l'EBU R68 attend 0 dBu pour −18 dBFS : elle y arrive à −14 dBFS, et l'on retire 4 dB à l'entrée. Un ronflement à 50 Hz trahit une **boucle de masse** entre deux alimentations : un isolateur (transformateur) la coupe.

- Les **sorties directes** (une par tranche, pour enregistrer en multipiste) et les **inserts** (un point d'envoi et de retour sur une tranche, pour un compresseur externe) n'existent que sur certaines consoles.
- Le niveau de chaque sortie, ses prises et le choix pré ou post sont à lire dans la notice de la console de l'établissement.`,
    car: { text: 'Au poste son du car, l\'onglet « Bus, N-1, départ » montre la même idée en plus grand : un bus par usage (PGM, INTL, N-1 des commentateurs, du studio, du bord terrain), chacun avec sa matrice, puis l\'embedder qui range le départ dans le SDI selon le plan de son.', station: 'son' },
    terms: ['pre-post', 'niveau-ligne'],
    competences: ['2.10', '2.9', '4.1'],
    article: 'songuide',
    quiz: [
      { q: 'Pour les retours de scène des musiciens, l\'envoi AUX est réglé…', choices: ['pré-fader : le retour ne bouge pas quand on change la façade', ['post-fader : le retour suit la façade', 'Le musicien entendrait chaque mouvement de fader de la façade, sans l\'avoir demandé : sa voix pourrait disparaître de son retour en plein morceau.'], ['ni l\'un ni l\'autre : les retours prennent la sortie casque', 'La sortie casque est l\'écoute de l\'ingénieur (et le PFL) ; ce n\'est pas un départ.']], answer: 0, why: 'Un AUX pré-fader est pris avant le fader : le mélange des retours est indépendant de celui de la façade. C\'est ce que demandent les musiciens.' },
      { q: 'Pourquoi l\'envoi vers la réverbération est-il post-fader ?', choices: [['Pour que la réverbération soit plus forte', 'Pré ou post ne change pas le niveau de l\'envoi, mais ce qu\'il suit.'], 'Pour qu\'elle suive le fader : on baisse la voix, sa réverbération baisse avec', ['Parce que les effets n\'acceptent que le niveau grand public', 'L\'envoi d\'effet est au niveau de la console ; le niveau grand public, c\'est la sortie d\'enregistrement.']], answer: 1, why: 'Pris après le fader, l\'envoi suit la source : la voix et sa réverbération gardent la même proportion. Pris avant, on entendrait la réverbération seule quand on ferme la voix.' },
      { q: 'L\'enregistreur est branché sur la sortie REC OUT (RCA). Par rapport à la sortie XLR, son niveau est…', choices: ['environ 12 dB plus bas : −10 dBV contre +4 dBu', ['identique : c\'est le même mélange', 'C\'est le même mélange, mais pas le même niveau : la sortie RCA est au niveau grand public.'], ['plus fort de 14 dB', 'C\'est l\'inverse : +4 dBu (pro) est au-dessus de −10 dBV (grand public).']], answer: 0, why: '+4 dBu vaut 1,23 V ; −10 dBV vaut 0,316 V, soit −7,8 dBu : 11,8 dB d\'écart. Un appareil grand public saturerait sur une sortie pro, un appareil pro manquerait de niveau sur une sortie grand public.' },
      { q: 'Un larsen accroche dès qu\'on monte le retour du chanteur. Quel réglage essayer d\'abord, sans rien perdre ?', choices: ['Tourner le retour vers l\'arrière du micro cardioïde, dans son axe mort', ['Monter le GAIN du chant', 'Le gain de la boucle monte d\'autant : le larsen arrive encore plus vite.'], ['Passer l\'AUX en post-fader', 'Pré ou post ne change pas le gain de la boucle ; le larsen reste.']], answer: 0, why: 'Le gain de la boucle compte aussi ce que le micro capte du retour. Un cardioïde rejette fortement ce qui vient de derrière : placé dans son axe mort, le retour regagne une vingtaine de dB de marge.' },
      { q: 'La vidéo demande le son du concert pour l\'enregistrer. Que lui donner ?', choices: [['La sortie casque, au niveau voulu', 'La sortie casque suit l\'écoute de l\'ingénieur (et le PFL) : elle change dès qu\'il écoute une tranche seule.'], 'Une sortie ligne symétrique : la principale, ou mieux un AUX post-fader dédié', ['La sortie REC OUT, car elle est symétrique', 'La sortie RCA est asymétrique, au niveau grand public : elle n\'est pas faite pour une liaison longue vers une régie.']], answer: 1, why: 'Un départ se prend sur une sortie ligne symétrique. La principale est faite pour la salle ; un AUX post-fader réglé à part donne un mélange pour la diffusion. On convient ensuite de l\'alignement avec la régie.' },
      { q: 'La console sort son 1 kHz d\'alignement à +4 dBu. Le car est aligné selon l\'EBU R68 (0 dBu = −18 dBFS). Où arrive le 1 kHz ?', choices: ['À −14 dBFS : 4 dB trop haut, on retire 4 dB à l\'entrée', ['À −18 dBFS, comme prévu', 'Ce serait vrai pour 0 dBu ; la console en sort 4 de plus.'], ['À +4 dBFS : il écrête', 'Au-delà de 0 dBFS, aucun nombre n\'existe ; ici, il reste 14 dB de marge.']], answer: 0, why: 'En R68, chaque dBu vaut un dB au-dessus de −18 dBFS : +4 dBu donnent −14 dBFS. On convient d\'un alignement commun, ou l\'on corrige l\'écart à l\'entrée du car.' },
      { q: 'Un ronflement grave et régulier apparaît dès qu\'on relie la console de la salle au car. La cause la plus probable ?', choices: ['Une boucle de masse entre les deux installations : un isolateur la coupe', ['Le 48 V de la console', 'Le 48 V alimente les micros sur les entrées ; il ne fait pas ronfler une sortie ligne.'], ['Un AUX pré-fader', 'Pré ou post ne fabrique pas de ronflement : c\'est un choix du mélange.']], answer: 0, why: 'Deux appareils sur deux alimentations différentes, reliés par leurs masses, font circuler un courant de 50 Hz dans le blindage : le ronflement. Une liaison symétrique en souffre moins, un transformateur d\'isolement le supprime.' },
    ],
  },
  {
    id: 'son-numerique', title: 'L\'audio numérique : 48 kHz, 24 bits, AES3, MADI', minutes: '9 min', partie: PARTIE_NUM,
    essentials: [
      'Le convertisseur **échantillonne** : à **48 kHz** (le broadcast), il ne capte que ce qui est sous **24 kHz** (Nyquist) ; au-dessus, une fréquence se **replie**. Chaque échantillon est **quantifié** : en 24 bits, ≈ 146 dB de dynamique théorique.',
      'Les niveaux deviennent des **dBFS** : selon l\'**EBU R68**, **0 dBu = −18 dBFS** ; selon le SMPTE RP 155, +4 dBu = −20 dBFS.',
      'On transporte : **AES3** (2 canaux, XLR 110 Ω ou BNC 75 Ω), **MADI** (64 canaux à 48 kHz), l\'audio **embarqué** du SDI, le **réseau** (AES67, Dante). Tous partagent la même **horloge**.',
    ],
    figure: figNumerique,
    demoTitle: 'Montez la fréquence au-delà de 24 kHz : elle se replie. Passez en 4 bits pour voir l\'escalier, puis comptez les canaux d\'une console de 64 entrées sur AES3 et sur MADI. En bas, passez de l\'EBU R68 au SMPTE RP 155.',
    demo: demoNumerique,
    body: `Le son numérique est une suite de nombres. Le **convertisseur analogique-numérique** mesure la tension un nombre fixe de fois par seconde (l'**échantillonnage**) et écrit chaque mesure sur un nombre fixe de bits (la **quantification**). À l'autre bout, le convertisseur numérique-analogique refait la tension.

**Échantillonner.** En broadcast, la fréquence d'échantillonnage est **48 kHz** : un échantillon toutes les 20,8 µs (44,1 kHz est celle du disque compact, 96 kHz se rencontre en production musicale). Le théorème de **Nyquist** : on ne peut rendre que les fréquences **sous la moitié** de la fréquence d'échantillonnage, 24 kHz à 48 kHz, au-dessus de ce que l'oreille entend (≈ 20 kHz). Une fréquence plus haute ne disparaît pas : elle se **replie** et revient comme une autre, plus basse (30 kHz échantillonnés à 48 kHz donnent 18 kHz). Le convertisseur est donc précédé d'un **filtre anti-repliement** qui coupe au-dessus de 20 kHz environ.

**Quantifier.** Chaque échantillon est arrondi à la valeur la plus proche parmi 2ⁿ : 65 536 en 16 bits, 16 777 216 en **24 bits**. L'erreur d'arrondi est un petit bruit ; la **dynamique** théorique, entre la pleine échelle et ce bruit, vaut **6,02 × n + 1,76 dB** : 98 dB en 16 bits, **146 dB** en 24 bits. Les vrais convertisseurs n'atteignent pas ce chiffre (leur électronique souffle avant), de l'ordre de 110 à 120 dB pour de bons convertisseurs 24 bits : c'est déjà plus que ce qu'on peut capter dans un stade.

**Les dBFS et l'alignement.** Le plus grand nombre possible est **0 dBFS** (full scale) ; tout se compte en dessous. Pour passer de l'analogique au numérique sans surprise, on s'entend sur un **alignement** : en Europe, l'**EBU R68** met **0 dBu à −18 dBFS** (le 1 kHz du line-up), donc la pleine échelle à +18 dBu ; aux États-Unis, le **SMPTE RP 155** met **+4 dBu à −20 dBFS**, la pleine échelle à +24 dBu. Deux appareils alignés différemment se décalent de 2 à 6 dB : on le vérifie au line-up.

**Transporter.** Un canal à 48 kHz sur 24 bits, c'est **1,152 Mb/s**. Plusieurs liaisons :
- **AES3** (AES/EBU) : **deux canaux** par liaison, 64 bits par période d'échantillon (deux sous-trames de 32 bits : l'audio, puis des bits d'état, de validité et de parité), soit 3,072 Mb/s à 48 kHz. En **XLR**, avec un câble **110 Ω** (un câble micro ordinaire fonctionne mal sur la distance) ; en **BNC**, sur du coaxial **75 Ω** (AES-3id), le câble de la vidéo ;
- **MADI** (AES10) : **64 canaux** à 48 kHz (56 en varispeed, 32 à 96 kHz) sur un seul coaxial 75 Ω ou une **fibre**, 125 Mb/s sur la ligne : la liaison classique entre une console et ses boîtiers de scène ;
- l'audio **embarqué** dans le SDI : 16 canaux en HD-SDI, avec l'image (leçon sur l'audio embarqué) ;
- le **réseau** : AES67, ST 2110-30 dans le car IP, Dante (dernière leçon de ce chapitre).

**Une seule horloge.** Tous les appareils numériques d'une chaîne doivent échantillonner **au même rythme**. Deux convertisseurs libres, l'un à 48 000 Hz et l'autre à 48 001 Hz (20 ppm d'écart, un quartz ordinaire), se décalent d'un échantillon par seconde : le récepteur doit en jeter ou en répéter un, un **clic**. On distribue donc une horloge commune, le word clock ou une référence AES (DARS), calée sur la synchro vidéo du car : c'est l'objet de la leçon sur le word clock, dans le chapitre La synchro. À 48 kHz et 25 images par seconde, une image contient exactement **${fmtNum(echParImage(48000, 25))} échantillons**.

- Un convertisseur ajoute un peu de **latence** (ses filtres numériques) : quelques dizaines d'échantillons, moins d'une milliseconde (ordre de grandeur). 48 échantillons font 1 ms à 48 kHz.`,
    car: { text: 'Au poste son du car, la console numérique reçoit ses sources par des cartes MADI et AES (page E/S et patch), aligne le line-up à −18 dBFS et ressort le programme embeddé dans le SDI du départ. Le PRISM du poste vision lit les mêmes canaux audio embarqués.', station: 'son' },
    terms: ['echantillonnage', 'aes3', 'madi'],
    competences: ['2.10', '1.4', '2.2'],
    article: 'vista',
    quiz: [
      { q: 'À 48 kHz, quelle est la fréquence la plus haute qu\'on peut rendre ?', choices: ['24 kHz, la moitié de la fréquence d\'échantillonnage', ['48 kHz', 'Il faut au moins deux échantillons par période : à 48 kHz, on ne rend que sous 24 kHz (Nyquist).'], ['20 kHz exactement, la limite de l\'oreille', '20 kHz est l\'ordre de grandeur de l\'oreille ; la limite du système vient de l\'échantillonnage : fs ÷ 2.']], answer: 0, why: 'Le théorème de Nyquist : on ne rend une fréquence que si elle est sous fs ÷ 2. À 48 kHz, 24 kHz, un peu au-dessus de ce que l\'oreille entend.' },
      { q: 'Un sifflement à 30 kHz entre dans un convertisseur à 48 kHz sans filtre. Qu\'entend-on ?', choices: [['Rien : l\'oreille n\'entend pas 30 kHz', 'Il ne reste pas à 30 kHz : les échantillons décrivent une autre fréquence, audible.'], 'Un son à 18 kHz qui n\'existait pas : la fréquence s\'est repliée', ['Un son à 60 kHz', 'Aucune fréquence au-delà de 24 kHz ne peut sortir d\'un convertisseur à 48 kHz.']], answer: 1, why: 'Au-delà de fs ÷ 2, une fréquence se replie : |30 000 − 48 000| = 18 000 Hz. C\'est pour cela qu\'un filtre anti-repliement coupe au-dessus de 20 kHz avant le convertisseur.' },
      { q: 'Quelle dynamique théorique donne une quantification sur 24 bits ?', choices: ['≈ 146 dB', ['≈ 24 dB', 'Chaque bit vaut environ 6 dB : 24 bits, c\'est bien plus que 24 dB.'], ['≈ 98 dB', 'C\'est la dynamique du 16 bits (le disque compact).']], answer: 0, why: '6,02 × 24 + 1,76 ≈ 146 dB. Les convertisseurs réels font moins (de l\'ordre de 110 à 120 dB), leur électronique soufflant avant.' },
      { q: 'Selon l\'EBU R68, à quoi correspond 0 dBFS ?', choices: ['À +18 dBu', ['À 0 dBu', 'C\'est −18 dBFS qui vaut 0 dBu ; 0 dBFS est 18 dB plus haut.'], ['À +24 dBu', 'C\'est l\'alignement SMPTE RP 155 (+4 dBu = −20 dBFS).']], answer: 0, why: 'L\'EBU R68 aligne 0 dBu sur −18 dBFS : la pleine échelle, 18 dB au-dessus, correspond à +18 dBu. On garde ces 18 dB de marge au-dessus du line-up.' },
      { q: 'Combien de canaux à 48 kHz passent sur un seul lien MADI ?', choices: ['64', ['2', 'C\'est l\'AES3 : une paire stéréo par liaison.'], ['16', 'C\'est l\'audio embarqué d\'un HD-SDI.']], answer: 0, why: 'MADI (AES10) porte 64 canaux à 48 kHz sur un coaxial 75 Ω ou une fibre : 56 en varispeed, 32 à 96 kHz.' },
      { q: 'Deux enregistreurs numériques tournent chacun sur leur quartz, à 48 000 et 48 001 Hz. Au bout d\'une seconde…', choices: [['rien : 1 Hz d\'écart est inaudible', 'Il ne s\'agit pas d\'une hauteur entendue, mais d\'échantillons qui manquent ou s\'accumulent : le récepteur doit en jeter ou en répéter.'], 'ils se sont décalés d\'un échantillon : un clic, si l\'un reçoit l\'autre', ['ils se sont décalés d\'une seconde', 'L\'écart est de 1 échantillon par seconde, soit 21 µs : bien loin d\'une seconde.']], answer: 1, why: '48 001 − 48 000 = un échantillon de plus chaque seconde. Un appareil qui reçoit l\'autre doit en jeter un, un clic. D\'où une horloge commune (word clock, DARS), calée sur la synchro du car.' },
      { q: 'Pourquoi brancher l\'AES3 en XLR avec un câble 110 Ω plutôt qu\'avec un câble micro ?', choices: ['Le signal monte à plusieurs mégahertz : il lui faut un câble à l\'impédance prévue', ['Parce que le câble micro porte le 48 V', 'Le 48 V n\'est pas une propriété du câble, et il n\'est pas envoyé vers une entrée AES.'], ['Parce que l\'AES3 est asymétrique', 'L\'AES3 en XLR est symétrique, comme un micro ; c\'est son impédance qui compte.']], answer: 0, why: 'L\'AES3 transporte 3 Mb/s en codage biphase : un signal rapide qui se déforme dans un câble à l\'impédance mal adaptée. Sur quelques mètres un câble micro passe ; sur la distance, il faut du 110 Ω.' },
    ],
  },
  {
    id: 'son-loudness', title: 'Mesurer le programme : crête, vumètre, loudness EBU R128', minutes: '9 min', partie: PARTIE_NUM,
    essentials: [
      'Le **crête-mètre** suit chaque crête (rien ne doit toucher 0 dBFS) ; la **loudness** mesure le volume **perçu** (ITU-R BS.1770 : filtre K, moyenne en énergie, en **LUFS**) : c\'est elle que la chaîne contrôle.',
      '**EBU R128** : **−23 LUFS** intégrés sur le programme (±0,5 LU, ±1 LU en direct), **crête vraie** sous **−1 dBTP** ; la **LRA** dit sa dynamique.',
      'L\'**intégrée** écarte les silences (porte **−70 LUFS**) puis ce qui est **10 LU** sous la moyenne ; en direct, on suit la **momentanée** (400 ms) et le **court terme** (3 s).',
    ],
    figure: figLoudness,
    demoTitle: 'Montez commentaires et ambiance de 2 dB : l\'intégrée sort de la tolérance. Montez le but de 3 dB : six secondes pèsent lourd, car la moyenne se fait en énergie. Ajoutez 20 s de silence : rien ne change. Remontez le passage calme de 10 dB : il passe la porte relative et compte.',
    demo: demoLoudness,
    body: `Trois appareils lisent un niveau, et ils ne disent pas la même chose.

**Le crête-mètre** suit chaque crête, en **dBFS** : c'est ce que voit le convertisseur, et rien ne doit toucher 0 dBFS. Mais deux sons de même crête n'ont pas le même volume : une voix compressée paraît bien plus forte qu'un coup de sifflet de même crête. **Le vumètre** fait une moyenne lente (environ 300 ms) : plus proche de l'oreille, mais sans norme commune entre un tir, une voix et une musique. C'est pour cela que les chaînes contrôlent la **loudness** depuis 2010 (EBU R128) : avant, les publicités, compressées à l'extrême, montaient d'un coup.

**La loudness** (ITU-R BS.1770) mesure le volume perçu : le signal passe par un **filtre K** (qui réduit les graves et relève un peu les aigus, comme l'oreille), on fait la **moyenne en énergie** des canaux, et l'on écrit le résultat en **LUFS** (loudness units sous la pleine échelle) ; un écart de **1 LU** vaut 1 dB. Trois fenêtres :
- la **momentanée** (M), sur **400 ms** : elle suit un mot, un tir ;
- le **court terme** (S), sur **3 s** : celle qu'on suit en mixant ;
- l'**intégrée** (I), sur tout le programme : c'est elle qui fait foi.

**Les portes de l'intégrée.** Pour qu'un silence ou un long passage très calme ne fasse pas baisser la moyenne, l'appareil découpe le programme en **blocs de 400 ms**, un toutes les 100 ms (recouvrement de 75 %). Il écarte d'abord les blocs sous **−70 LUFS** (la **porte absolue** : les silences), fait la moyenne en énergie de ceux qui restent, puis écarte ceux qui sont plus de **10 LU sous cette moyenne** (la **porte relative**), et refait la moyenne. Un but qui monte à −15 LUFS pendant six secondes ne pèse qu'à proportion de sa durée ; un générique silencieux ne pèse rien.

**La recommandation EBU R128** :
- loudness intégrée **−23 LUFS**, à ±0,5 LU près (±1 LU pour un direct, où l'on ne peut pas normaliser après coup) ;
- **crête vraie** (true peak) sous **−1 dBTP** : mesurée en suréchantillonnant, car la vraie forme d'onde peut passer au-dessus des échantillons, et dépasser 0 dBFS une fois reconvertie ou codée ;
- la **LRA** (plage de loudness, EBU Tech 3342) : l'écart, en LU, entre les passages calmes et les passages forts (du 10ᵉ au 95ᵉ centile du court terme) ; la R128 ne lui fixe pas de cible, certaines chaînes le font.

**Au poste son du car.** Le mixeur suit le **court terme** pendant le direct et garde l'œil sur l'**intégrée** depuis le début du match ; un limiteur de crête vraie protège le départ. Un programme enregistré trop fort se **normalise** : on lui applique un gain de −23 − I, puis un limiteur si les crêtes vraies remontent au-dessus de −1 dBTP. À ne pas confondre avec le line-up : le 1 kHz à −18 dBFS sur les deux voies mesure −18 LUFS, 5 LU au-dessus de la cible du programme.`,
    car: { text: 'Au poste son du car, la Control Bay affiche la loudness du programme (momentanée, court terme, intégrée) à côté des vumètres et du corrélateur ; la chaîne contrôle −23 LUFS et −1 dBTP au test de ligne et pendant le direct.', station: 'son' },
    terms: ['loudness', 'crete-vraie'],
    competences: ['1.4', '2.2', '1.2'],
    article: 'songuide',
    quiz: [
      { q: 'Quelle loudness intégrée vise l\'EBU R128 pour un programme ?', choices: ['−23 LUFS', ['−18 LUFS', '−18 dBFS est le niveau du 1 kHz de line-up ; sur les deux voies, il mesure −18 LUFS, mais la cible du programme est −23.'], ['0 LUFS', 'C\'est la pleine échelle : un programme à 0 LUFS serait écrasé et saturé.']], answer: 0, why: 'La R128 vise −23 LUFS intégrés, à ±0,5 LU (±1 LU en direct), avec des crêtes vraies sous −1 dBTP.' },
      { q: 'Le match a 20 s de silence à la fin (générique muet). Que devient la loudness intégrée ?', choices: [['Elle baisse : la moyenne compte le silence', 'Les blocs sous −70 LUFS sont écartés par la porte absolue : le silence ne compte pas.'], 'Elle ne change pas : la porte absolue écarte les blocs sous −70 LUFS', ['Elle monte', 'Le silence n\'ajoute aucune énergie, et il n\'est pas compté : rien ne peut monter.']], answer: 1, why: 'La porte absolue (−70 LUFS) écarte les silences avant de faire la moyenne. Sans elle, un programme entrecoupé de pauses paraîtrait trop calme et serait remonté à tort.' },
      { q: 'Pendant le direct, quelle fenêtre suit-on pour mixer ?', choices: ['Le court terme (3 s), et l\'intégrée depuis le début', ['La momentanée seule', 'Sur 400 ms, elle saute à chaque mot ou tir : elle aide à repérer un pic, pas à tenir un niveau.'], ['L\'intégrée seule', 'Elle bouge très lentement après quelques minutes : une erreur de 5 dB mettrait longtemps à s\'y voir.']], answer: 0, why: 'Le court terme (3 s) réagit assez vite pour corriger, sans sauter à chaque syllabe ; l\'intégrée dit si le programme tient la cible sur la durée.' },
      { q: 'Pourquoi mesurer la crête « vraie » plutôt que la plus grande valeur des échantillons ?', choices: ['La vraie forme d\'onde passe entre les échantillons, parfois au-dessus d\'eux', ['Parce que la crête vraie est toujours plus basse', 'Elle est au moins égale à la crête des échantillons, souvent plus haute.'], ['Parce que les échantillons ne sont pas en dBFS', 'Les échantillons sont bien en dBFS ; c\'est ce qui se passe entre eux qui leur échappe.']], answer: 0, why: 'Une fois reconvertie (ou codée pour la diffusion), la forme d\'onde peut dépasser les échantillons de plusieurs dixièmes de dB, jusqu\'à écrêter. La crête vraie se mesure en suréchantillonnant ; limite R128 : −1 dBTP.' },
      { q: 'Un sujet enregistré mesure −20,5 LUFS intégrés. Que faire pour le livrer ?', choices: ['Lui appliquer −2,5 dB, puis vérifier les crêtes vraies', ['Lui appliquer +2,5 dB', 'Il est déjà 2,5 LU trop fort : il faut descendre, pas monter.'], ['Rien : −20,5 est dans la tolérance de ±3 LU', 'La tolérance d\'un programme enregistré est de ±0,5 LU : 2,5 LU d\'écart sont hors tolérance.']], answer: 0, why: 'La correction vaut −23 − I = −23 − (−20,5) = −2,5 dB sur tout le programme. Les crêtes vraies descendent d\'autant ; si elles dépassaient −1 dBTP, on ajouterait un limiteur.' },
      { q: 'Un passage très calme, 15 LU sous le reste du programme, dure deux minutes. Dans l\'intégrée…', choices: ['il est écarté par la porte relative (10 LU sous la moyenne)', ['il fait baisser la moyenne de 15 LU', 'L\'intégrée est une moyenne en énergie : même compté, un passage calme pèse peu ; et à 15 LU sous la moyenne, il est écarté.'], ['il est écarté par la porte absolue', 'La porte absolue n\'écarte que ce qui est sous −70 LUFS, les silences.']], answer: 0, why: 'La porte relative écarte les blocs plus de 10 LU sous la moyenne des blocs non silencieux : l\'intégrée suit les passages qui portent le programme.' },
    ],
  },
  {
    id: 'son-dante', title: 'Dante : l\'audio sur le réseau', minutes: '10 min', partie: PARTIE_NUM,
    essentials: [
      '**Dante** (Audinate) transporte des dizaines de canaux en **IP** sur un réseau Ethernet ordinaire : un câble remplace le multipaire. **Dante Controller** liste les appareils et fait les **abonnements**.',
      'Des **flux** de quelques canaux : **unicast** (une copie par récepteur) ou **multicast** (une seule, il faut l\'**IGMP snooping**) ; une **horloge PTP** : un **leader** élu, qui peut prendre le **word clock** du car.',
      'La **latence** choisie (0,25 à 5 ms) doit couvrir le trajet ; un commutateur **Gigabit**, la **QoS** (DSCP 56 pour le PTP, 46 pour l\'audio), l\'**EEE coupé** ; un réseau **secondaire** en secours.',
    ],
    figure: figDante,
    demoTitle: 'Passez le lien en 100 Mb/s avec 64 canaux vers deux récepteurs : il déborde ; passez en multicast. Puis multipliez les commutateurs et l\'autre trafic à 0,25 ms de latence : le paquet le plus lent arrive trop tard.',
    demo: demoDante,
    body: `Avant le réseau, un boîtier de scène de 32 entrées demandait un **multipaire** : 32 paires blindées, un câble lourd et cher, un seul sens. **Dante**, d'Audinate, met ces canaux dans des **paquets IP** sur un réseau **Ethernet** ordinaire : un seul câble (un par réseau), dans les deux sens, et chaque appareil peut recevoir n'importe quel canal d'un autre. Les consoles, les boîtiers de scène, les amplificateurs, les enregistreurs et les ordinateurs (avec une carte son virtuelle) qui ont une puce Dante se branchent sur le même commutateur.

**Trouver les appareils.** Dante tourne sur IP, en UDP. Chaque appareil prend une **adresse** par DHCP ou, sans serveur, une adresse **locale 169.254.x.x** qu'il se donne lui-même (leçon sur les types d'adresses du chapitre Le réseau). Les appareils s'annoncent par **mDNS / DNS-SD** sur leur sous-réseau : **Dante Controller**, le logiciel gratuit d'Audinate, les liste avec leurs canaux, sans rien configurer d'autre. Il montre une **grille** : les émetteurs en colonnes, les récepteurs en lignes ; un clic à une croisée **abonne** un canal de réception à un canal d'émission. Les noms des appareils et des canaux sont gardés dans les appareils eux-mêmes.

**Les flux.** Les canaux voyagent par **flux** de quelques canaux (4 au plus par défaut pour un flux unicast, ordre de grandeur). En **unicast**, l'émetteur envoie une copie à chaque récepteur abonné : simple, mais le lien de l'émetteur porte autant de copies que de récepteurs. En **multicast**, il envoie une seule copie vers une adresse de groupe, et le commutateur la recopie vers les abonnés : il faut alors l'**IGMP snooping**, sinon le flux est recopié sur tous les ports (leçon sur le multicast). Un canal à 48 kHz sur 24 bits, c'est **1,152 Mb/s** de charge utile ; avec les en-têtes (IP, UDP, Ethernet), un flux de 4 canaux fait de l'ordre de **5 Mb/s** sur le fil. Un lien à 100 Mb/s suffit pour quelques dizaines de canaux, le **Gigabit** est conseillé.

**L'horloge.** Tous les appareils échantillonnent au même rythme grâce à **PTP** (IEEE 1588) : ils élisent un **leader** d'horloge, les autres le suivent (leçon sur PTP). On peut imposer le leader (**Preferred Leader** dans Dante Controller) ; et l'appareil qui reçoit le **word clock** du SPG du car peut s'en servir (**Sync to External**) et le donner à tout le réseau : le son est alors calé sur la même référence que la vidéo.

**La latence.** Chaque récepteur rend le son **exactement** après la **latence** choisie dans Dante Controller : 0,25, 0,5, 1, 2 ou 5 ms selon les appareils, **1 ms** par défaut. Elle doit couvrir le trajet du paquet le plus lent : à chaque commutateur traversé, sa sérialisation et l'attente derrière les trames déjà en file. Un paquet en retard est perdu pour la lecture : un clic, puis le canal se coupe si cela dure. Les repères d'Audinate (à faire relire) : 0,25 ms sur un petit réseau Gigabit, 1 ms pour un réseau plus grand, davantage avec des liens à 100 Mb/s.

**Le commutateur.** Un commutateur administrable, avec :
- la **QoS** : l'audio et le PTP passent devant le reste (copies de fichiers, vidéo). Audinate recommande **DSCP 56 (CS7)** pour les messages PTP qui datent et **46 (EF)** pour l'audio, dans des files à priorité stricte (leçon sur la QoS) ;
- l'**EEE** (Energy Efficient Ethernet, l'Ethernet « vert ») **coupé** : en endormant les ports entre deux paquets, il dérègle l'horloge ;
- l'**IGMP snooping** si l'on utilise le multicast.

**La redondance.** Les appareils qui ont deux ports Dante peuvent les mettre sur deux réseaux séparés, **primaire** et **secondaire** : chaque paquet part sur les deux (comme le ST 2022-7 des réseaux rouge et bleu du car IP), et une coupure ne s'entend pas.

**Vers le car IP.** Dante a un mode **AES67** (multicast, PTP version 2) : un flux AES67 se reçoit en ST 2110-30, l'audio du car IP. C'est le pont entre le réseau de la section son et celui du car.`,
    car: { text: 'Le car du simulateur transporte l\'audio embarqué dans le SDI, ou en ST 2110-30 dans le car IP : au poste Réseau IP, on retrouve le multicast, IGMP, PTP et la QoS qui font tourner Dante. Le passage d\'un réseau Dante au car IP se fait en AES67.', station: 'reseau' },
    terms: ['dante', 'aes67', 'st2110-30', 'igmp', 'ptp'],
    competences: ['3.6', '2.10', '2.11'],
    quiz: [
      { q: 'Dans Dante Controller, que fait un clic à la croisée d\'un émetteur et d\'un récepteur ?', choices: ['Il abonne ce canal de réception à ce canal d\'émission', ['Il donne une adresse IP au récepteur', 'Les adresses viennent du DHCP ou de l\'auto-adressage 169.254 ; la grille sert aux abonnements.'], ['Il choisit le leader d\'horloge', 'Le leader se règle dans l\'onglet de l\'horloge (Preferred Leader), pas dans la grille.']], answer: 0, why: 'La grille de Dante Controller montre les émetteurs en colonnes et les récepteurs en lignes : un clic abonne, et le flux se met en place tout seul.' },
      { q: 'Un boîtier de 64 canaux envoie tout à deux consoles en unicast, sur un lien à 100 Mb/s. Que se passe-t-il ?', choices: [['Rien : 64 canaux à 1,15 Mb/s tiennent dans 100 Mb/s', 'Une copie oui (≈ 84 Mb/s avec les en-têtes) ; en unicast, il en part une par console : environ 170 Mb/s.'], 'Le lien déborde : passer en Gigabit, ou en multicast pour une seule copie', ['Le boîtier passe tout seul en AES67', 'AES67 est un mode d\'interopérabilité à choisir ; il ne règle pas un débordement.']], answer: 1, why: 'En unicast, chaque récepteur reçoit sa copie : deux copies de 64 canaux dépassent 100 Mb/s. Le Gigabit ou le multicast (une copie recopiée par le commutateur) règlent le problème.' },
      { q: 'Le réseau passe en multicast et, soudain, tous les ports du commutateur sont chargés. Que manque-t-il ?', choices: ['L\'IGMP snooping sur le commutateur', ['Le Preferred Leader', 'Le leader d\'horloge ne décide pas où vont les flux.'], ['Une latence plus longue', 'La latence ne change rien à l\'endroit où le commutateur recopie un flux.']], answer: 0, why: 'Sans IGMP snooping, le commutateur traite le multicast comme une diffusion et le recopie partout. Avec, il ne l\'envoie qu\'aux ports abonnés.' },
      { q: 'Quelle QoS Audinate recommande-t-elle pour Dante ?', choices: ['DSCP 56 (CS7) pour les messages PTP, 46 (EF) pour l\'audio', ['Aucune : Dante n\'en a pas besoin', 'Sur un réseau partagé, une copie de fichiers ferait attendre l\'audio et l\'horloge : la QoS les fait passer devant.'], ['DSCP 0 pour tout', 'DSCP 0 est le « au mieux » : aucune priorité, l\'audio attendrait derrière le reste.']], answer: 0, why: 'Les messages PTP qui datent passent en premier (CS7, 56), l\'audio ensuite (EF, 46), dans des files à priorité stricte. En mode AES67, d\'autres valeurs sont d\'usage.' },
      { q: 'Le son claque par moments sur un récepteur réglé à 0,25 ms, à travers six commutateurs. Que faire ?', choices: ['Allonger la latence (1 ms) : des paquets arrivent après l\'heure', ['Raccourcir la latence', 'Plus courte, encore plus de paquets arriveraient en retard.'], ['Passer le leader d\'horloge sur ce récepteur', 'L\'horloge n\'y est pour rien : le son claque parce que des paquets ratent leur fenêtre.']], answer: 0, why: 'La latence doit couvrir le trajet du paquet le plus lent, avec de la marge pour la gigue. Six commutateurs, c\'est un réseau où 1 ms (la valeur par défaut) est plus sûre.' },
      { q: 'Comment caler l\'horloge du réseau Dante sur la synchro vidéo du car ?', choices: ['Un appareil reçoit le word clock du SPG, en Sync to External, et devient le leader', ['En réglant la même latence partout', 'La latence règle le moment où le son sort, pas la fréquence à laquelle il est échantillonné.'], ['En branchant le SPG sur le commutateur', 'Un SPG vidéo classique ne parle pas l\'horloge Dante ; il faut un appareil Dante qui reçoit son word clock.']], answer: 0, why: 'L\'appareil Dante qui a une entrée word clock la reçoit du SPG (Sync to External) et, élu leader (Preferred Leader), la donne à tout le réseau par PTP : son et vidéo sur la même référence.' },
      { q: 'Pourquoi couper l\'EEE (l\'Ethernet économe en énergie) sur les ports d\'un réseau Dante ?', choices: ['En endormant les ports entre deux paquets, il dérègle l\'horloge PTP', ['Parce qu\'il chiffre les paquets', 'L\'EEE ne chiffre rien : il met le lien en veille quand il n\'a rien à transmettre.'], ['Parce qu\'il limite le lien à 100 Mb/s', 'L\'EEE ne change pas la vitesse du lien ; il ajoute des réveils qui retardent irrégulièrement les paquets.']], answer: 0, why: 'Le réveil d\'un port en veille retarde le paquet de façon irrégulière : les messages PTP arrivent avec une gigue qui dérègle l\'horloge. Audinate recommande de couper l\'EEE.' },
    ],
  },
];
