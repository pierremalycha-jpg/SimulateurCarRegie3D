// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';
import { rythmes, referenceSpg, verrou, nomSortie, decalage, avancePour, ltcVerdict, wordclock, WC_SORTIES, RECEPTEURS, audioParImage, TAI_UTC, ptpDeUtc, imagePtp, echantillonPtp, timecodePtp, FS_AUDIO } from './synchro_calc.js';

// ----------------------------------------------------------------------------------
// Chapitre « La synchro », trois leçons du générateur et des horloges : régler un générateur type Tektronix
// SPG700 (référence d'entrée, Stay GenLock, trois sorties BLACK, décalages, word clock, LTC) pour le car ou le
// plateau de l'établissement ; le word clock pour travailler avec l'option son (48 kHz, 1 920 échantillons
// par image, niveau 5 V, une seule terminaison) ; SMPTE ST 2059 (l'heure PTP qui donne la phase de chaque
// image) et le car hybride. Chiffres : cours/synchro_calc.js. Le SPG700 d'après sa documentation commerciale
// (trois sorties black burst ou tri-level, word clock 48 kHz et DARS, trois LTC et un quatrième en entrée ou
// sortie, entrée genlock bouclée, Stay GenLock, option SDI) ; les noms des menus et la disposition des
// connecteurs sont à vérifier sur l'appareil.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', violet: '#c9a8ff', box: '#1a2026', fg: '#e8eef2' };
const txt = (x, y, s, cls = 'co-s', anchor = 'start', fill = '') => sv('text', { x, y, textAnchor: anchor, class: cls, ...(fill ? { style: `fill: ${fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const ln = (x1, y1, x2, y2, col = C.grey, w = 1.3, dash = '') => sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: w, ...(dash ? { 'stroke-dasharray': dash } : {}) });
const signe = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmtNum(Math.abs(v), d);
/** une liste de verdicts : ✓ ou ✗, puis le texte */
const verdicts = (/** @type {Array<[boolean, string]>} */ rows) => rows.map(([ok, t]) => el('li', {}, el('b', { style: { color: ok ? C.green : C.red } }, ok ? '✓' : '✗'), el('span', {}, t)));
/** la fenêtre du mélangeur 1080p50 : ± ½ ligne */
const FEN = rythmes('1080p50').ligneUs / 2;
/** le retard de traitement du serveur ralenti (µs), celui de la vue 3D du genlock */
const RETARD_SERVEUR = 14.5;

// ======================================================================================
// 1. Régler un SPG700
// ======================================================================================
function bnc(f, x, y, label, col = C.amber) {
  f.append(sv('circle', { cx: x, cy: y, r: 9, fill: '#c9ced3', stroke: '#59646f' }), sv('circle', { cx: x, cy: y, r: 3.4, fill: '#2a3036' }), txt(x, y + 22, label, 'co-s', 'middle', col));
}
function figSpg() {
  const f = figure(720, 300, 'Le générateur de synchro type SPG700, face arrière (disposition indicative) : l\'entrée genlock bouclée, les trois sorties BLACK (chacune black burst ou tri-level), le word clock 48 kHz et le DARS, le timecode LTC, les deux sorties SDI de l\'option, le réseau ; en dessous, une répartition type pour le car ou le plateau : BLACK 1 en tri-level 1080i50 vers le DA des CCU, BLACK 2 en black burst vers le mélangeur et la PTZ, BLACK 3 en black burst avancé pour le serveur ralenti, le word clock en 5 V vers la console son, le LTC à 25 i/s vers les enregistreurs.');
  f.append(txt(10, 16, 'Un générateur type SPG700, face arrière (disposition indicative)', 'co-t'));
  f.append(sv('rect', { x: 10, y: 26, width: 700, height: 78, rx: 4, fill: '#20262c', stroke: '#59646f' }));
  bnc(f, 44, 52, 'GENLOCK', C.cyan); bnc(f, 74, 52, '(boucle)', C.cyan);
  f.append(txt(59, 92, 'BB, tri-level ou 10 MHz', 'co-s', 'middle'));
  [['BLACK 1', 150], ['BLACK 2', 196], ['BLACK 3', 242]].forEach(([l, x]) => bnc(f, /** @type {number} */ (x), 52, /** @type {string} */ (l)));
  f.append(txt(196, 92, 'BB PAL / NTSC ou tri-level', 'co-s', 'middle'));
  bnc(f, 320, 52, 'WORD CLK', C.violet); bnc(f, 368, 52, 'DARS', C.violet);
  f.append(txt(344, 92, '48 kHz', 'co-s', 'middle'));
  f.append(sv('rect', { x: 412, y: 40, width: 80, height: 22, rx: 3, fill: '#2a3036', stroke: '#59646f' }), txt(452, 76, 'LTC 1 à 4', 'co-s', 'middle', C.green), txt(452, 92, '3 sorties + 1 E/S', 'co-s', 'middle'));
  bnc(f, 528, 52, 'SDI 1', C.grey); bnc(f, 568, 52, 'SDI 2', C.grey);
  f.append(txt(548, 92, 'option SDI : mires', 'co-s', 'middle'));
  f.append(sv('rect', { x: 606, y: 42, width: 26, height: 20, rx: 2, fill: '#2a3036', stroke: '#59646f' }), txt(619, 76, 'réseau', 'co-s', 'middle'));
  f.append(sv('rect', { x: 650, y: 40, width: 46, height: 26, rx: 3, fill: '#15191d', stroke: '#59646f' }), txt(673, 82, 'secteur', 'co-s', 'middle'));
  // la répartition type
  f.append(txt(10, 132, 'Une répartition type, sur le plateau ou dans le car', 'co-t'));
  const rows = [
    ['BLACK 1', 'tri-level 1080i50', 'DA → CCU 1 à 6', C.amber],
    ['BLACK 2', 'black burst PAL', 'mélangeur (REF IN bouclée) → caméra PTZ 720p50, bouchon', C.amber],
    ['BLACK 3', 'black burst PAL, avancé de 14,5 µs', 'serveur ralenti (ses traitements le retardent)', C.amber],
    ['WORD CLOCK', '48 kHz, niveau 5 V', 'console son, convertisseurs de l\'option son (une terminaison au bout)', C.violet],
    ['LTC 1', '25 i/s, heure du jour, UTC+1 ou +2', 'enregistreurs, serveur ralenti, scripte', C.green],
    ['SDI 1 (option)', 'mire et son de test', 'une entrée de la grille, pour le line-up', C.grey],
  ];
  rows.forEach(([o, fmt, dest, col], i) => {
    const y = 152 + i * 23;
    f.append(box(10, y - 13, 100, 19, /** @type {string} */ (col)), txt(60, y + 1, /** @type {string} */ (o), 'co-m', 'middle'));
    f.append(txt(122, y + 1, /** @type {string} */ (fmt), 'co-s', 'start', C.fg), ln(330, y - 3, 350, y - 3, /** @type {string} */ (col)), txt(356, y + 1, /** @type {string} */ (dest), 'co-s'));
  });
  f.append(txt(10, 294, 'Avant tout : la référence d\'entrée (interne ou genlock), puis les formats des sorties, puis les décalages, puis l\'audio et le timecode.', 'co-s'));
  return f;
}
const FMT_OPTS = /** @type {[string, string, string][]} */ ([['pal', 'BB PAL', 'Black burst 625 lignes'], ['ntsc', 'BB NTSC', 'Black burst 525 lignes'], ['1080i50', 'TRI 1080i50', 'Tri-level 1080i50'], ['1080p25', 'TRI 1080p25', 'Tri-level 1080p25'], ['720p50', 'TRI 720p50', 'Tri-level 720p50'], ['1080i59', 'TRI 1080i59,94', 'Tri-level 1080i59,94']]);
function demoSpg(host) {
  // un départ avec trois erreurs à corriger : le serveur hors fenêtre, le word clock en 1 V, le LTC à 30 i/s
  const S = { mode: 'genlock', entree: 'pal', stay: true, perdue: false, b1: '1080i50', b2: 'pal', b3: 'pal', off3: 0, wc: '1V', rx: 'ttl', ltc: '30', src: 'heure', fuseau: 1 };
  const etat = el('p', { class: 'co-verdict' });
  const list = el('ul', { class: 'co-rules' });
  const read = readout(['Référence d\'entrée', 'BLACK 3 (serveur ralenti)', 'Word clock à la console', 'LTC 1']);
  const lost = el('button', { type: 'button', class: 'btn small', onclick: () => { S.perdue = !S.perdue; lost.textContent = S.perdue ? 'Rendre la référence d\'entrée' : 'Débrancher la référence d\'entrée'; draw(); } }, 'Débrancher la référence d\'entrée');
  const draw = () => {
    const R = referenceSpg({ mode: /** @type {any} */ (S.mode), entree: S.entree, stay: S.stay, perdue: S.perdue });
    const v1 = verrou('ccu', S.b1), v2a = verrou('melangeur', S.b2), v2b = verrou('ptz', S.b2), v3 = verrou('serveur', S.b3);
    const phase = RETARD_SERVEUR + S.off3, okPh = Math.abs(phase) <= FEN;
    const W = wordclock({ sortie: S.wc, terminees: 1, recepteur: S.rx });
    const L = ltcVerdict({ cadence: S.ltc, source: /** @type {any} */ (S.src), fuseau: S.fuseau }, { cadence: '25', fuseau: 1 });
    const saut = R.etat === 'libre';
    list.replaceChildren(...verdicts([
      [v1.ok && !saut, `CCU 1 à 6 (BLACK 1, par le DA) : ${v1.texte}`],
      [v2a.ok && !saut, `Mélangeur 1080p50 (BLACK 2) : ${v2a.texte}`],
      [v2b.ok && !saut, `Caméra PTZ 720p50 (BLACK 2, après le mélangeur) : ${v2b.texte}`],
      [v3.ok && okPh && !saut, `Serveur ralenti (BLACK 3) : ${v3.ok ? (okPh ? `verrouillé, et ses images arrivent au mélangeur à ${signe(phase, 1)} µs, dans la fenêtre (± ${fmtNum(FEN, 1)} µs)` : `verrouillé, mais ses images arrivent au mélangeur à ${signe(phase, 1)} µs, hors de la fenêtre (± ${fmtNum(FEN, 1)} µs) : la coupe vers lui saute`) : v3.texte}`],
      [W.ok, `Console son (word clock, ${RECEPTEURS[S.rx].nom}) : ${W.raison}`],
      [L.ok, `Enregistreur (LTC 1) : ${L.texte}`],
    ]));
    const d3 = decalage(S.off3, S.b3);
    read.set('Référence d\'entrée', R.texte);
    read.set('BLACK 3 (serveur ralenti)', `${nomSortie(S.b3)}, décalage ${signe(S.off3, 1) || '0'} µs (${d3.lignes ? `${d3.lignes} ligne${Math.abs(d3.lignes) > 1 ? 's' : ''} et ` : ''}${signe(d3.us, 2) || '0'} µs dans la ligne) ; pour compenser ses ${fmtNum(RETARD_SERVEUR, 1)} µs de traitement : ${signe(avancePour(RETARD_SERVEUR), 1)} µs`);
    read.set('Word clock à la console', `${WC_SORTIES[S.wc].nom} : ${fmtNum(W.vpp, 2)} V crête à crête sur l'entrée terminée, haut ${fmtNum(W.haut, 2)} V, bas ${fmtNum(W.bas, 2).replace('-', '−')} V`);
    read.set('LTC 1', `${S.ltc.replace('.', ',')} i/s, ${S.src === 'heure' ? 'heure du jour' : 'heure programme'}, UTC${S.fuseau >= 0 ? '+' : '−'}${Math.abs(S.fuseau)}`);
    const ko = list.querySelectorAll('b').length - [...list.querySelectorAll('b')].filter((b) => b.textContent === '✓').length;
    etat.className = 'co-verdict ' + (saut ? 'ko' : ko ? 'warn' : 'ok');
    etat.textContent = saut ? 'Référence d\'entrée perdue sans Stay GenLock : le générateur repasse sur son oscillateur et sautera au retour de la référence. Activez Stay GenLock.'
      : ko ? `${ko} appareil${ko > 1 ? 's' : ''} à corriger : lisez la ligne rouge, changez le réglage de la sortie qui le nourrit.`
        : 'Tout le plateau suit le générateur : références acceptées, serveur dans la fenêtre, horloge audio et timecode justes.';
  };
  const ch = (label, opts, v, k) => choice(label, opts, v, (x) => { S[k] = x; draw(); });
  host.append(
    el('h5', { class: 'co-h5' }, '1. La référence d\'entrée'),
    el('div', { class: 'co-ctl' },
      choice('Référence', [['interne', 'interne (oscillateur)'], ['genlock', 'genlock (entrée bouclée)']], S.mode, (v) => { S.mode = v; draw(); }),
      ch('Entrée genlock', [['pal', 'BB PAL'], ['1080i50', 'TRI 1080i50'], ['10mhz', '10 MHz']], S.entree, 'entree'),
      choice('Stay GenLock', [['on', 'activé'], ['off', 'désactivé']], 'on', (v) => { S.stay = v === 'on'; draw(); }),
      el('div', { class: 'co-btns' }, lost)),
    el('h5', { class: 'co-h5' }, '2. Les sorties BLACK'),
    el('div', { class: 'co-ctl' }, ch('BLACK 1 → DA des CCU', FMT_OPTS, S.b1, 'b1')),
    el('div', { class: 'co-ctl' }, ch('BLACK 2 → mélangeur et PTZ', FMT_OPTS, S.b2, 'b2')),
    el('div', { class: 'co-ctl' }, ch('BLACK 3 → serveur ralenti', FMT_OPTS, S.b3, 'b3'),
      slider('Décalage de BLACK 3', -20, 20, S.off3, 0.5, (v) => { S.off3 = v; draw(); }, (v) => `${signe(v, 1) || '0'} µs`)),
    el('h5', { class: 'co-h5' }, '3. L\'audio et le timecode (on tourne en hiver : UTC+1)'),
    el('div', { class: 'co-ctl' },
      ch('Word clock', [['5V', '5 V'], ['1V', '1 V sur 75 Ω']], S.wc, 'wc'),
      ch('Entrée de la console', [['ttl', 'TTL'], ['large', 'large plage'], ['exigeant', '4 V au moins'], ['fragile', '3 V au plus']], S.rx, 'rx')),
    el('div', { class: 'co-ctl' },
      ch('LTC 1 : cadence', [['25', '25'], ['30', '30'], ['29.97', '29,97 DF'], ['24', '24']], S.ltc, 'ltc'),
      ch('Source', [['heure', 'heure du jour'], ['programme', 'heure programme']], S.src, 'src'),
      choice('Fuseau', [['1', 'UTC+1 (hiver)'], ['2', 'UTC+2 (été)'], ['0', 'UTC']], '1', (v) => { S.fuseau = +v; draw(); })),
    etat, list, read.el);
  draw();
}

// ======================================================================================
// 2. Le word clock et l'option son
// ======================================================================================
function figWordclock() {
  const W5 = wordclock({ sortie: '5V', terminees: 1 }), W1 = wordclock({ sortie: '1V', terminees: 1 }), A = audioParImage(FS_AUDIO, 25), B = audioParImage(FS_AUDIO, 30000, 1001);
  const f = figure(720, 268, `Le word clock : un signal carré à 48 kHz, un front par échantillon (20,8 µs). En 5 V, l'entrée TTL voit un haut de ${fmtNum(W5.haut, 1)} V au-dessus du seuil de 2,4 V ; en 1 V centré sur 0, le haut n'atteint que ${fmtNum(W1.haut, 1)} V. En bas : la chaîne en T, un seul bouchon au bout ; ${fmtNum(A.moyen)} échantillons par image à 25 i/s, ${fmtNum(B.total)} sur ${B.sequence} images en 29,97.`);
  f.append(txt(10, 16, 'Un carré à 48 kHz : un front montant par échantillon', 'co-t'));
  const X0 = 40, Y0 = 130, K = 18; // px par volt
  f.append(ln(X0, Y0, 400, Y0, '#3a4650', 1), txt(X0 - 6, Y0 + 4, '0 V', 'co-s', 'end'));
  for (const [v, l, col] of [[2.4, 'haut TTL ≥ 2,4 V', C.green], [0.4, 'bas ≤ 0,4 V', C.green]]) f.append(ln(X0, Y0 - /** @type {number} */ (v) * K, 400, Y0 - /** @type {number} */ (v) * K, /** @type {string} */ (col), 1, '4 3'), txt(404, Y0 - /** @type {number} */ (v) * K + 4, /** @type {string} */ (l), 'co-s', 'start', /** @type {string} */ (col)));
  const sq = (hi, lo, col) => { let d = `M${X0} ${Y0 - lo * K}`; for (let i = 0; i < 4; i++) { const x = X0 + i * 88; d += ` L${x} ${Y0 - hi * K} L${x + 44} ${Y0 - hi * K} L${x + 44} ${Y0 - lo * K} L${x + 88} ${Y0 - lo * K}`; } f.append(sv('path', { d, fill: 'none', stroke: col, strokeWidth: 1.8 })); };
  sq(W5.haut, W5.bas, C.violet); sq(W1.haut, W1.bas, C.red);
  f.append(txt(X0, 44, `5 V : ${fmtNum(W5.vpp, 1)} V crête à crête sur 75 Ω, de 0 à ${fmtNum(W5.haut, 1)} V`, 'co-s', 'start', C.violet));
  f.append(txt(X0, 150 + 2, `1 V sur 75 Ω : de −0,5 à +0,5 V, sous le seuil TTL`, 'co-s', 'start', C.red));
  f.append(ln(X0, 160, X0 + 88, 160, C.grey, 1), txt(X0 + 44, 174, '20,83 µs : un échantillon', 'co-s', 'middle'));
  // la chaîne en T
  f.append(txt(10, 198, 'La chaîne : des T, un bouchon au bout', 'co-t'));
  f.append(box(10, 210, 54, 26, C.amber), txt(37, 227, 'SPG', 'co-s', 'middle'), ln(64, 223, 96, 223, C.violet));
  ['Console', 'Conv. A/N', 'Enreg.'].forEach((d, i) => { const x = 96 + i * 92; f.append(box(x, 210, 70, 26), txt(x + 35, 227, d, 'co-s', 'middle'), ln(x + 70, 223, x + 92, 223, C.violet)); });
  f.append(sv('rect', { x: 372, y: 216, width: 14, height: 14, rx: 2, fill: '#3a4650', stroke: C.green }), txt(379, 252, '75 Ω', 'co-s', 'middle', C.green));
  f.append(txt(10, 262, 'Entrées en haute impédance (boucle) ; une seule charge de 75 Ω. Mieux : une sortie de DA par appareil.', 'co-s'));
  // échantillons par image
  const X1 = 470;
  f.append(txt(X1, 198, 'Échantillons à 48 kHz par image', 'co-t'));
  f.append(txt(X1, 218, `25 i/s : ${fmtNum(A.moyen)} (entier)`, 'co-m'), txt(X1, 234, `50 i/s : ${fmtNum(audioParImage(FS_AUDIO, 50).moyen)}`, 'co-m'));
  f.append(txt(X1, 250, `29,97 : ${fmtNum(B.moyen, 1)} → ${B.motif.map((x) => fmtNum(x)).join(' · ')}`, 'co-m'), txt(X1, 264, `soit ${fmtNum(B.total)} sur ${B.sequence} images`, 'co-s'));
  return f;
}
function demoWordclock(host) {
  let sortie = '5V', term = 0, bouchon = true, rx = 'ttl', fs = 48000, cad = '25';
  const cv = canvas(720, 220, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Charges sur la ligne', 'Signal reçu', 'Réflexions', 'L\'entrée']);
  const verdict = el('p', { class: 'co-verdict' });
  const read2 = readout(['Échantillons par image', 'La séquence', 'Une période du word clock']);
  const draw = () => {
    const W = wordclock({ sortie, terminees: term, bouchon, recepteur: rx }), R = RECEPTEURS[rx];
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 220);
    const Y = (v) => 150 - v * 22, X0 = 60, per = 140;
    g.strokeStyle = '#1f2a31'; for (let v = -1; v <= 6; v++) { g.beginPath(); g.moveTo(X0, Y(v)); g.lineTo(690, Y(v)); g.stroke(); }
    g.fillStyle = '#6a747c'; g.font = '11px Arial, sans-serif'; for (let v = -1; v <= 6; v++) g.fillText(`${v < 0 ? '−' : ''}${Math.abs(v)} V`, 14, Y(v) + 4);
    // les seuils de l'entrée choisie
    const seuils = R.ttl ? [[R.min, `haut ≥ ${fmtNum(R.min, 1)} V`], [0.4, 'bas ≤ 0,4 V']] : [];
    g.setLineDash([4, 3]); g.strokeStyle = C.green; for (const [v] of seuils) { g.beginPath(); g.moveTo(X0, Y(+v)); g.lineTo(690, Y(+v)); g.stroke(); } g.setLineDash([]);
    g.fillStyle = C.green; for (const [v, l] of seuils) g.fillText(String(l), 590, Y(+v) - 4);
    if (Number.isFinite(R.max)) { g.setLineDash([4, 3]); g.strokeStyle = C.red; g.beginPath(); g.moveTo(X0, Y(R.max)); g.lineTo(690, Y(R.max)); g.stroke(); g.setLineDash([]); g.fillStyle = C.red; g.fillText(`${fmtNum(R.max, 1)} V crête à crête au plus`, 540, Y(R.max) - 4); }
    // le carré reçu, et ses rebonds si la ligne est mal fermée
    g.strokeStyle = W.ok ? C.violet : C.red; g.lineWidth = 2; g.beginPath();
    const ring = W.reflexions ? Math.min(0.35, Math.abs(W.gamma)) * W.vpp : 0;
    for (let i = 0; i <= 900; i++) {
      const x = X0 + i * (630 / 900), ph = ((x - X0) % per) / per, haut = ph < 0.5;
      const dt = haut ? ph : ph - 0.5, sgn = haut ? 1 : -1;
      const v = (haut ? W.haut : W.bas) + sgn * ring * Math.exp(-dt * 30) * Math.cos(dt * 90);
      if (i) g.lineTo(x, Y(v)); else g.moveTo(x, Y(v));
    }
    g.stroke(); g.lineWidth = 1;
    g.fillStyle = '#aab4ba'; g.fillText('une période = un échantillon (20,8 µs à 48 kHz)', X0, 212);
    read.set('Charges sur la ligne', W.n ? `${W.n} × 75 Ω = ${fmtNum(W.RL, 1)} Ω (${term} entrée${term > 1 ? 's' : ''} terminée${term > 1 ? 's' : ''} en interne${bouchon ? ' et le bouchon' : ''})` : 'aucune : la ligne est ouverte');
    read.set('Signal reçu', `${fmtNum(W.vpp, 2)} V crête à crête, de ${fmtNum(W.bas, 2).replace('-', '−')} à ${fmtNum(W.haut, 2)} V (${WC_SORTIES[sortie].nom})`);
    read.set('Réflexions', !W.reflexions ? 'aucune : une seule charge de 75 Ω au bout' : `Γ = ${W.gamma === 1 ? '+1' : fmtNum(W.gamma, 2).replace('-', '−')} : des rebonds sur chaque front, de la gigue, parfois un faux front compté`);
    read.set('L\'entrée', `${R.nom} : ${W.raison}`);
    verdict.className = 'co-verdict ' + (W.ok && !W.reflexions ? 'ok' : W.ok ? 'warn' : 'ko');
    verdict.textContent = !W.ok ? `L'appareil ne se cale pas : ${W.raison}. Il repasse sur son horloge interne, et ses échantillons glissent par rapport au reste : des clics.`
      : W.reflexions ? 'L\'appareil se cale, mais la ligne n\'est pas fermée sur une seule charge de 75 Ω : les rebonds peuvent le faire décrocher par moments. Une seule terminaison, au bout.'
        : 'L\'appareil se cale : niveau accepté, une seule charge de 75 Ω au bout, pas de rebond.';
    // les échantillons par image
    const [num, den] = cad === '29.97' ? [30000, 1001] : cad === '59.94' ? [60000, 1001] : [+cad, 1];
    const A = audioParImage(fs, num, den);
    read2.set('Échantillons par image', `${fmtNum(A.moyen, Number.isInteger(A.moyen) ? 0 : 2)} en moyenne à ${fmtNum(fs / 1000, 1)} kHz et ${cad.replace('.', ',')} i/s`);
    read2.set('La séquence', A.sequence === 1 ? 'une image : le compte tombe juste à chaque image' : `${fmtNum(A.sequence)} images pour ${fmtNum(A.total)} échantillons${A.motif.length <= 5 ? ` : ${A.motif.map((x) => fmtNum(x)).join(', ')}` : ''} ; l'audio ne retombe sur le début d'une image qu'au bout de la séquence`);
    read2.set('Une période du word clock', `${fmtNum(1e6 / fs, 2)} µs`);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Sortie du SPG', [['5V', '5 V'], ['1V', '1 V sur 75 Ω']], sortie, (v) => { sortie = v; draw(); }),
      choice('Entrée de l\'appareil', [['ttl', 'TTL'], ['large', 'large plage'], ['exigeant', '4 V au moins'], ['fragile', '3 V au plus']], rx, (v) => { rx = v; draw(); })),
    el('div', { class: 'co-ctl' },
      slider('Entrées terminées en interne', 0, 4, term, 1, (v) => { term = v; draw(); }, (v) => String(v)),
      choice('Bouchon au bout', [['oui', 'mis'], ['non', 'retiré']], 'oui', (v) => { bouchon = v === 'oui'; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le word clock reçu par le dernier appareil de la chaîne, couplé en continu : en pointillés verts, les seuils d\'une entrée TTL ; en rouge, le maximum d\'une entrée fragile.')),
    verdict, read.el,
    el('h5', { class: 'co-h5' }, 'Des échantillons et des images'),
    el('div', { class: 'co-ctl' },
      choice('Fréquence d\'échantillonnage', [['44100', '44,1 kHz'], ['48000', '48 kHz'], ['96000', '96 kHz']], '48000', (v) => { fs = +v; draw(); }),
      choice('Cadence', [['25', '25'], ['50', '50'], ['24', '24'], ['29.97', '29,97'], ['59.94', '59,94']], cad, (v) => { cad = v; draw(); })),
    read2.el);
  draw();
}

// ======================================================================================
// 3. ST 2059 : l'heure PTP donne la phase de chaque image
// ======================================================================================
function figSt2059() {
  const f = figure(720, 240, 'En haut, l\'origine SMPTE : le 1er janvier 1970 à 0 h TAI ; depuis, les images de chaque cadence se succèdent sans interruption, la n-ième commence à n fois la durée d\'une image. En bas, le car hybride : le GPS cale un générateur qui sort à la fois du black burst, du tri-level et l\'heure PTP de grand maître ; les appareils SDI et les appareils IP sont donc en phase.');
  f.append(txt(10, 16, 'ST 2059-1 : toutes les images sont calées sur une même origine des temps', 'co-t'));
  f.append(ln(20, 60, 700, 60, C.grey, 1.4));
  f.append(sv('circle', { cx: 30, cy: 60, r: 5, fill: C.amber }), txt(30, 44, '1970-01-01 00:00:00 TAI', 'co-s', 'start', C.amber), txt(30, 82, 'origine SMPTE (image 0 de toutes les cadences)', 'co-s'));
  for (let i = 0; i < 18; i++) f.append(ln(400 + i * 16, 52, 400 + i * 16, 68, C.cyan, 1.2));
  f.append(txt(400, 44, '… puis des images de 40 ms à 25 i/s, sans fin', 'co-s', 'start', C.cyan));
  f.append(txt(400, 84, 'n = partie entière de (t × cadence) : la phase se calcule', 'co-s'));
  f.append(txt(240, 64, '≈ 56 ans', 'co-s', 'middle'));
  f.append(txt(10, 112, `L'heure PTP compte en TAI : UTC = TAI − ${TAI_UTC} s (secondes intercalaires, depuis 2017) ; l'heure légale ajoute le fuseau.`, 'co-s'));
  // le car hybride
  f.append(txt(10, 140, 'Le car hybride : une seule horloge pour le SDI et pour l\'IP', 'co-t'));
  f.append(box(10, 156, 50, 30, C.cyan), txt(35, 175, 'GPS', 'co-s', 'middle'), ln(60, 171, 90, 171, C.cyan));
  f.append(box(90, 150, 130, 42, C.amber), txt(155, 168, 'Générateur', 'co-t', 'middle'), txt(155, 184, 'BB, tri-level, PTP (GM)', 'co-s', 'middle'));
  f.append(ln(220, 162, 270, 162, C.amber), box(270, 150, 190, 24, C.amber), txt(365, 166, 'SDI : CCU, mélangeur, serveur', 'co-s', 'middle'));
  f.append(ln(220, 182, 270, 196, C.violet), box(270, 184, 190, 24, C.violet), txt(365, 200, 'IP : PTP (ST 2059-2), domaine 127', 'co-s', 'middle'));
  f.append(txt(480, 166, 'genlock : phase des images', 'co-s'), txt(480, 200, 'PTP + ST 2059-1 : la même phase', 'co-s'));
  f.append(txt(10, 226, 'Une passerelle SDI ↔ IP et un mélangeur hybride voient ainsi les mêmes débuts d\'image, sans câble de référence entre les deux mondes.', 'co-s'));
  return f;
}
const CAD = { 25: [25, 1, '25 i/s'], 50: [50, 1, '50 i/s'], 29.97: [30000, 1001, '29,97 i/s'] };
const deux = (v) => String(v).padStart(2, '0');
/** l'heure légale à partir d'un texte « AAAA-MM-JJ HH:MM:SS,mmm » (ou d'un point) et du fuseau → ms UTC */
function lireHeure(s, fuseau) {
  const m = /^\s*(\d{4})-(\d{1,2})-(\d{1,2})[ T]+(\d{1,2}):(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?\s*$/.exec(s);
  if (!m) return NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6], +(m[7] || '0').padEnd(3, '0')) - fuseau * 3600000;
}
const ecrireHeure = (msUtc, fuseau) => { const d = new Date(msUtc + fuseau * 3600000); return `${d.getUTCFullYear()}-${deux(d.getUTCMonth() + 1)}-${deux(d.getUTCDate())} ${deux(d.getUTCHours())}:${deux(d.getUTCMinutes())}:${deux(d.getUTCSeconds())},${String(d.getUTCMilliseconds()).padStart(3, '0')}`; };
function demoSt2059(host) {
  let fuseau = 1, cad = '25', live = false, ms = Date.UTC(2026, 9, 27, 19, 45, 0, 500) - 3600000;
  const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'text', spellcheck: 'false', value: ecrireHeure(ms, fuseau), 'aria-label': 'Heure légale, AAAA-MM-JJ HH:MM:SS,mmm', style: { width: '26ch' } }));
  const cv = canvas(720, 170, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const read = readout(['Heure PTP (TAI depuis 1970)', 'Image en cours', 'Dans l\'image', 'Prochain top image', 'Timecode de l\'heure du jour', 'Audio à 48 kHz']);
  const note = el('p', { class: 'co-note' });
  const draw = () => {
    const t = ptpDeUtc(ms), [num, den, nom] = CAD[cad], I = imagePtp(t, num, den);
    read.set('Heure PTP (TAI depuis 1970)', `${fmtNum(Math.floor(t))},${String(Math.round((t % 1) * 1000)).padStart(3, '0')} s (UTC + ${TAI_UTC} s)`);
    read.set('Image en cours', `n° ${fmtNum(I.n)} depuis l'origine, à ${nom}`);
    read.set('Dans l\'image', `${fmtNum(I.phaseMs, 3)} ms sur ${fmtNum(I.imageMs, 3)} ms`);
    read.set('Prochain top image', `dans ${fmtNum(I.prochainMs, 3)} ms`);
    read.set('Timecode de l\'heure du jour', cad === '29.97' ? 'en 29,97, le timecode se recale chaque jour à une heure convenue (le « daily jam » de ST 2059-1) : il n\'est pas calculé ici' : `${timecodePtp(t, num, fuseau)}${cad === '50' ? ' (images de 00 à 49)' : ''}, UTC${fuseau >= 0 ? '+' : '−'}${Math.abs(fuseau)}`);
    const E = echantillonPtp(t, FS_AUDIO, cad === '50' ? 50 : 25);
    read.set('Audio à 48 kHz', cad === '29.97' ? `échantillon n° ${fmtNum(E.n)} ; en 29,97, l'audio ne retombe sur un début d'image que toutes les 5 images` : `échantillon n° ${fmtNum(E.n)}, le ${fmtNum(E.dansImage + 1)}e de son image (${fmtNum(FS_AUDIO / (cad === '50' ? 50 : 25))} par image)`);
    // les tops des trois cadences autour de t (± 60 ms)
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 170);
    const X = (dt) => 360 + dt / 60 * 320;
    [['25', 30, C.amber], ['50', 75, C.cyan], ['29.97', 120, C.violet]].forEach(([k, y, col]) => {
      const [nu, de, no] = CAD[k], J = imagePtp(t, nu, de);
      g.strokeStyle = '#3a4650'; g.beginPath(); g.moveTo(40, +y); g.lineTo(680, +y); g.stroke();
      g.fillStyle = '#aab4ba'; g.font = '11px Arial, sans-serif'; g.fillText(String(no), 4, +y + 4);
      for (let k2 = -3; k2 <= 3; k2++) { const dt = -J.phaseMs + k2 * J.imageMs; if (Math.abs(dt) > 60) continue; g.fillStyle = String(col); g.fillRect(X(dt) - 1.5, +y - 12, 3, 24); }
    });
    g.strokeStyle = '#e8eef2'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(0), 10); g.lineTo(X(0), 140); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#e8eef2'; g.fillText('l\'instant choisi', X(0) + 4, 152); g.fillStyle = '#6a747c'; g.fillText('−60 ms', 40, 164); g.fillText('+60 ms', 636, 164);
    note.textContent = `Deux cars, un studio, une passerelle IP : n'importe quel appareil qui connaît cette heure à quelques microsecondes près trouve la même image n° ${fmtNum(I.n)}, et son début au même instant.`;
  };
  let raf = 0;
  const tick = () => { if (live) { ms = Date.now(); inp.value = ecrireHeure(ms, fuseau); draw(); } raf = requestAnimationFrame(tick); };
  inp.addEventListener('input', () => { const v = lireHeure(inp.value, fuseau); if (Number.isFinite(v)) { live = false; ms = v; inp.setAttribute('aria-invalid', 'false'); draw(); } else inp.setAttribute('aria-invalid', 'true'); });
  host.append(
    el('div', { class: 'co-ctl' },
      el('label', { class: 'co-field' }, el('span', {}, 'Heure légale'), inp),
      el('div', { class: 'co-btns' }, el('button', { type: 'button', class: 'btn small primary', onclick: () => { live = !live; draw(); } }, 'Maintenant (en direct) / figer'))),
    el('div', { class: 'co-ctl' },
      choice('Fuseau', [['1', 'UTC+1 (hiver)'], ['2', 'UTC+2 (été)']], '1', (v) => { const old = fuseau; fuseau = +v; const x = lireHeure(inp.value, old); if (Number.isFinite(x)) inp.value = ecrireHeure(x, fuseau); ms = lireHeure(inp.value, fuseau); draw(); }),
      choice('Cadence', [['25', '25 i/s'], ['50', '50 i/s'], ['29.97', '29,97 i/s']], cad, (v) => { cad = v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Les tops image des trois cadences autour de l\'instant choisi : 25 et 50 i/s tombent ensemble toutes les 40 ms, 29,97 suit son propre rythme. Tous partent de la même origine.')),
    read.el, note);
  draw(); raf = requestAnimationFrame(tick);
  return { destroy: () => cancelAnimationFrame(raf) };
}

// ======================================================================================
// Les leçons
// ======================================================================================
/** @type {import('./index.js').Lesson[]} */
export const SYNCHRO_SPG = [
  {
    id: 'synchro-spg', title: 'Régler un SPG700 de Tektronix', minutes: '10 min',
    essentials: [
      'D\'abord la **référence d\'entrée** : **interne** (son oscillateur thermostaté, le générateur est le maître) ou **genlock** sur une référence extérieure (black burst, tri-level ou 10 MHz) par l\'entrée bouclée ; **Stay GenLock** évite un saut si elle disparaît.',
      'Puis les **trois sorties BLACK** : chacune en **black burst** (PAL, NTSC) ou en **tri-level** d\'un format HD, avec son propre **décalage** de phase, pour un groupe d\'appareils.',
      'Enfin l\'audio et l\'heure : **word clock 48 kHz** (en **5 V** pour l\'option son) et DARS, **LTC** à 25 i/s en heure du jour et au bon fuseau ; en option, deux sorties **SDI** de mires.',
    ],
    figure: figSpg,
    demoTitle: 'Trois appareils sont en rouge : avancez BLACK 3 pour ramener le serveur dans la fenêtre, passez le word clock en 5 V, le LTC à 25 i/s. Puis mettez BLACK 2 en BB NTSC, et débranchez la référence d\'entrée avec et sans Stay GenLock.',
    demo: demoSpg,
    body: `Le **SPG700** de Tektronix (aujourd'hui vendu par Telestream) est un générateur de synchronisation multiformat d'une unité de baie : c'est le cœur d'un plateau ou d'une petite régie, et le petit frère du **SPG8000A** qu'on trouve dans les cars (lui sait en plus se caler sur le GPS et servir de grand maître PTP ; pour le SPG700, une option GPS n'est pas confirmée ici : voir sa fiche). On le règle en façade (afficheur et touches) ou à distance ; les noms des menus ci-dessous décrivent la fonction, pas l'intitulé exact, à vérifier sur l'appareil. L'ordre compte :

**1. La référence d'entrée.** Un générateur est soit le **maître** du site, soit l'**esclave** d'une référence plus haute.
- **Interne** : il tourne sur son **oscillateur thermostaté** (OCXO) ; tout le plateau se cale sur lui. C'est le réglage d'un plateau isolé.
- **Genlock** : il suit une référence arrivant sur son **entrée bouclée** (deux BNC) : un black burst, un tri-level ou un **10 MHz** (onde sinusoïdale d'une horloge de laboratoire ou d'un récepteur GPS). C'est le réglage d'un générateur de secours ou d'une régie qui doit être en phase avec le reste du bâtiment. Sur l'entrée bouclée, le **bouchon 75 Ω** se met sur la seconde BNC si rien n'en repart.
- **Stay GenLock** : si la référence d'entrée disparaît, les sorties gardent leur fréquence et leur phase ; à son retour, le générateur rattrape l'écart **en douceur**. Sans lui, il se recalerait d'un coup, et tout ce qui le suit décrocherait.

**2. Les trois sorties BLACK.** Chacune se règle séparément : un **format** (black burst PAL ou NTSC, ou tri-level 1080i, 1080p à 25 ou 30, 720p…) et un **décalage** (timing offset) en lignes et en fractions de ligne, à quelques nanosecondes près en tri-level. On donne une sortie à un **groupe** d'appareils qui demandent le même format et la même phase : le tri-level 1080i50 au DA des CCU, un black burst au mélangeur et à ce qui le suit, une autre sortie **avancée** pour un appareil dont les traitements retardent l'image (un serveur ralenti qui sort ses images 14,5 µs trop tard reçoit une référence avancée de 14,5 µs, et ses images retombent dans la fenêtre du mélangeur, ± ½ ligne, 8,9 µs en 1080p50). Une sortie de la famille 59,94 Hz (NTSC, 1080i59,94) ne sert à rien à un plateau européen : aucun appareil 50 Hz ne s'y verrouille. Le black burst peut porter le timecode en **VITC**.

**3. L'audio.** Un **word clock à 48 kHz** et un **DARS** (signal AES de référence, AES11), calés sur la même horloge que la vidéo : 1 920 échantillons par image à 25 i/s. Pour les appareils de la section son (consoles, convertisseurs, interfaces), on règle la sortie word clock en **5 V** (niveau CMOS, compatible TTL), sauf si la notice de l'appareil demande moins ; le réglage **1 V sur 75 Ω** ne convient qu'aux entrées qui l'acceptent. C'est l'objet de la leçon suivante.

**4. Le timecode.** Trois **sorties LTC**, et une quatrième qui sert d'entrée ou de sortie (pour se caler sur un LTC extérieur). Chacune a sa **cadence** (25 i/s en Europe), sa **source** (l'**heure du jour**, pour un car ou un plateau en direct, ou une **heure programme** qui part d'un instant choisi) et son **décalage de fuseau** : UTC+1 l'hiver, UTC+2 l'été en France.

**5. L'option SDI** ajoute deux sorties de **mires** (barres, rampes, damier…) en SD, HD ou 3G, avec du son embarqué (tonalités) : la mire du line-up et du test de ligne, envoyée à une entrée de la grille.

Les erreurs classiques : une sortie au mauvais format (un tri-level 720p à une caméra 1080i), une famille 59,94 Hz laissée par défaut, un serveur oublié dans le décalage, le word clock laissé en 1 V, le LTC à 30 i/s ou en heure d'été au mois de janvier, une entrée genlock bouclée sans bouchon. On termine par une vérification : chaque appareil affiche « REF LOCK », la tuile Timing du PRISM place chaque source au centre, la console son est « EXT » ou « WCLK », le serveur affiche l'heure de la scripte.`,
    plus: `- **Maître ou esclave** : dans un car, le SPG principal est calé sur le GPS et le SPG de secours est en genlock sur lui ; un inverseur bascule de l'un à l'autre en gardant la phase.
- **Les préréglages** : un générateur garde plusieurs configurations complètes (formats, décalages, timecode) ; on rappelle celle du plateau ou du car selon le tournage. Nommez-les et notez-les dans le classeur du plateau.
- **Le 10 MHz** : une horloge de laboratoire ou un récepteur GPS délivre souvent un 10 MHz très stable ; un générateur s'y cale pour la fréquence, mais un 10 MHz ne dit pas où commence l'image : la phase vient alors de l'heure du générateur.
- **À faire relire** : la disposition des connecteurs et les intitulés des menus du SPG700 de l'établissement, l'existence d'une option GPS sur ce modèle.`,
    car: { text: 'Au poste Synchro : le SPG du car (type SPG8000A), verrouillé sur le GPS, ses sorties black burst et tri-level, le LTC 25 i/s en heure locale, le word clock 48 kHz, le PTP et le secours. Dans la visionneuse de matériel, l\'arrière du SPG et du distributeur, connecteur par connecteur.', station: 'synchro' },
    terms: ['black-burst', 'tri-level', 'stay-genlock', 'word-clock', 'dars'],
    competences: ['2.9', '1.2', '2.10', '3.12'],
    article: 'timing',
    exercises: [
      { id: 'materiel-synchro', intro: 'Dans la visionneuse de matériel, vous ouvrez l\'arrière du générateur de synchro du car, puis celui du distributeur, connecteur par connecteur : GPS, tri-level, LTC, entrée du DA. Retrouvez ce que la leçon règle sur le SPG700 : quelle sortie part vers quel groupe d\'appareils, et ce que le DA recopie.' },
    ],
    quiz: [
      { q: 'Un plateau isolé, sans autre référence dans le bâtiment. Quelle référence d\'entrée pour son SPG700 ?', choices: ['Interne : son oscillateur thermostaté donne le rythme, tout le plateau le suit', ['Genlock sur son propre black burst, bouclé', 'Un générateur ne se cale pas sur lui-même : il n\'y aurait aucune référence plus haute à suivre.'], ['Genlock sur le word clock de la console son', 'Le word clock n\'est pas une entrée de référence d\'un générateur vidéo, et la console doit suivre le SPG, pas l\'inverse.']], answer: 0, why: 'Sans référence plus haute, le générateur est le maître : référence interne. Le genlock sert à suivre une référence de bâtiment, un GPS ou un autre générateur.' },
      { q: 'Le DA des CCU (caméras 1080i50) est branché sur BLACK 1. Quel format lui donner ?', choices: [['Tri-level 720p50', 'Un tri-level a un format : des lignes de 26,7 µs en 720p, pas celles du 1080i50.'], 'Tri-level 1080i50 (ou un black burst PAL si les CCU le prennent)', ['Black burst NTSC', 'Famille 59,94 Hz : une CCU 50 Hz ne peut pas s\'y verrouiller.']], answer: 1, why: 'On donne à chaque groupe d\'appareils une référence de son format ou de sa famille que son entrée accepte : ici le tri-level 1080i50, ou le black burst PAL.' },
      { q: 'Le serveur ralenti sort ses images 14,5 µs après la référence, hors de la fenêtre du mélangeur. Quel réglage sur sa sortie BLACK ?', choices: ['Un décalage de −14,5 µs : la référence est avancée d\'autant', ['Un décalage de +14,5 µs', 'Retarder sa référence le retarderait encore : 29 µs au mélangeur.'], ['Aucun : c\'est au mélangeur de rattraper', 'La fenêtre du mélangeur ne fait que ± 8,9 µs en 1080p50 : 14,5 µs sont dehors.']], answer: 0, why: 'Avancer la référence du serveur de son temps de traitement fait arriver ses images au mélangeur en même temps que les autres. Chaque sortie BLACK a son décalage : un groupe d\'appareils par sortie.' },
      { q: 'La référence d\'entrée du SPG700 en genlock est débranchée un instant. À quoi sert Stay GenLock ?', choices: [['À couper toutes les sorties pour ne pas envoyer une référence fausse', 'Couper les sorties ferait décrocher tout le plateau : c\'est l\'inverse du but.'], 'À garder fréquence et phase, puis à rattraper l\'écart en douceur au retour de la référence', ['À passer les sorties en NTSC', 'Le format des sorties ne change pas.']], answer: 1, why: 'Sans maintien, le générateur se recalerait d\'un coup au retour de la référence : un saut de toutes ses sorties, et tout ce qui le suit décroche. Avec Stay GenLock, il rattrape lentement, sans saut.' },
      { q: 'Les élèves de l\'option son branchent leur console sur la sortie word clock. À quel niveau la régler ?', choices: ['5 V (CMOS, compatible TTL), sauf notice contraire', ['1 V sur 75 Ω', 'Centré sur 0 V, ce signal ne monte qu\'à +0,5 V : une entrée TTL, la plus courante, ne voit aucun front.'], ['Peu importe, le niveau d\'un word clock ne compte pas', 'Une entrée word clock a des seuils : sous eux, elle ne se cale pas ; certaines décrochent aussi au-dessus de 3 V. On lit la notice.']], answer: 0, why: 'La plupart des entrées word clock attendent des niveaux TTL (haut au-dessus de 2,4 V) : un pilote 5 V capable de 75 Ω est ce qui marche presque partout (AES11, annexe B). Une entrée qui demande moins le dit dans sa notice.' },
      { q: 'Le serveur ralenti affiche une heure décalée d\'une heure sur celle de la scripte, en janvier. Que vérifier sur le SPG ?', choices: ['Le décalage de fuseau de la sortie LTC : UTC+1 l\'hiver, UTC+2 l\'été', ['La cadence du LTC', 'Une mauvaise cadence fausse le compte des images, elle ne décale pas l\'heure d\'une heure pile.'], ['Le format de BLACK 3', 'Le format de la référence ne touche pas à l\'heure.']], answer: 0, why: 'Chaque sortie LTC a sa source (heure du jour ou programme), sa cadence et son fuseau. Une heure pile d\'écart, c\'est le fuseau : l\'heure d\'été laissée en hiver.' },
    ],
  },
  {
    id: 'synchro-wordclock', title: 'Le word clock : travailler avec l\'option son', minutes: '8 min',
    essentials: [
      'Le **word clock** est l\'horloge commune de l\'audio : un carré à **48 kHz**, un front par échantillon, sur BNC 75 Ω. Calé sur la référence vidéo, il donne exactement **1 920 échantillons par image** à 25 i/s.',
      'Le niveau : les entrées attendent en général du **TTL** (haut au-dessus de 2,4 V, bas sous 0,4 V) ; sur le SPG700, on règle la sortie en **5 V** pour les appareils de la section son, sauf si leur notice demande moins.',
      'Une seule horloge maître (le SPG), une seule **terminaison 75 Ω** au bout de chaque ligne ; une horloge fausse s\'entend : **clics**, craquements, son qui glisse.',
    ],
    figure: figWordclock,
    demoTitle: 'Passez la sortie en 1 V, puis revenez en 5 V et choisissez l\'entrée « 4 V au moins » ; ajoutez des entrées terminées en interne ; retirez le bouchon. Plus bas, comptez les échantillons d\'une image en 29,97.',
    demo: demoWordclock,
    body: `Quand les étudiants de l'option **Métiers du son** viennent travailler avec ceux de l'option TIEE (une captation, un plateau, un concert), leurs appareils (console, convertisseurs, enregistreur multipiste, interface de l'ordinateur) doivent échantillonner **au même rythme** que le reste. Chaque appareil audio numérique a sa propre horloge interne ; deux horloges libres ne battent jamais exactement ensemble : à 10 ppm d'écart, il y a un échantillon de trop ou de moins toutes les 2 s environ à 48 kHz, et le convertisseur qui reçoit doit en jeter ou en inventer un. On l'entend : des **clics** réguliers, des craquements, parfois un son qui glisse par rapport à l'image.

Le remède est le même qu'en vidéo : une **seule horloge maître**, et tous les autres en **esclave**. Dans un plateau qui fait aussi de la vidéo, le maître est le **SPG** : son word clock est dérivé de la même horloge que la référence vidéo, si bien qu'une image de 40 ms contient exactement **1 920 échantillons** à 48 kHz (960 à 50 i/s). En 29,97 i/s, ce n'est pas un nombre entier (1 601,6) : il faut une **séquence de 5 images** pour retomber sur 8 008 échantillons (1 602, 1 601, 1 602, 1 601, 1 602). La console son se règle en **horloge externe** (EXT, WCLK) : c'est elle qui suit le SPG, jamais l'inverse.

Le **word clock** est un signal carré à la fréquence d'échantillonnage : un front montant par échantillon, 20,83 µs de période à 48 kHz, sur un câble coaxial **75 Ω** en BNC. Son **niveau** est défini par l'usage (AES11, annexe B) : les entrées attendent en général des niveaux **TTL**, un haut au-dessus de 2,4 V et un bas sous 0,4 V. Selon les appareils, elles acceptent de 1 à 5 V crête à crête ; certaines décrochent au-delà de 3 V, d'autres demandent au moins 4 V. Un pilote **5 V** couplé en continu, capable de débiter dans 75 Ω, est ce qui marche avec le plus d'appareils. D'où le réglage du **SPG700** : sa sortie word clock propose **5 V** (CMOS) ou **1 V sur 75 Ω** ; pour la section son, on met **5 V**, et l'on ne passe en 1 V que si la notice de l'appareil le demande. En 1 V, le signal est centré sur 0 V : il ne monte qu'à +0,5 V, et une entrée TTL n'y voit aucun front.

La **distribution** suit les règles de la référence vidéo. Le mieux est une **étoile** (un DA word clock, une sortie par appareil). En chaîne, avec des **T** sur des entrées à haute impédance, on met **un seul bouchon 75 Ω** au bout : sans lui, les fronts rebondissent (de la gigue, parfois un faux front compté) ; avec des entrées **terminées en interne** au milieu de la chaîne, le signal **faiblit** à chaque appareil. On regarde l'arrière de chaque appareil : beaucoup ont un commutateur 75 Ω / haute impédance.

Il existe une autre référence audio, le **DARS** (AES11) : un signal AES3, souvent silencieux, dont chaque trame marque un échantillon ; le SPG700 en sort un aussi. Une entrée prend soit un word clock, soit un DARS : la notice dit lequel. En réseau audio (Dante, AES67), l'horloge voyage par le réseau ; un appareil Dante muni d'une entrée word clock peut caler tout le réseau Dante sur le SPG (« Sync to External », voir la leçon sur Dante dans Le son).

- Avant de brancher : même **fréquence d'échantillonnage** partout (48 kHz en télévision), un seul maître, tous les autres en externe.
- Le signe d'une horloge fausse : un compteur d'erreurs ou un voyant « unlock » sur la console, des clics à l'écoute au casque.`,
    plus: `- **Grade 1 et Grade 2** : l'AES11 classe les références audio, ± 1 ppm (Grade 1, pour une installation qui en cale d'autres) et ± 10 ppm (Grade 2). Un SPG calé sur le GPS fait bien mieux.
- **44,1 kHz** : la fréquence du CD ne tombe juste qu'à 25 i/s (1 764 échantillons par image) ; en 29,97, il faut 100 images. La télévision travaille en 48 kHz.
- **Pourquoi pas le black burst pour l'audio ?** Beaucoup de consoles et de convertisseurs savent se caler sur une référence vidéo (« video sync ») et en tirer leur 48 kHz ; d'autres non. Le word clock est le langage commun du son.
- **À faire relire** : les niveaux et l'impédance exacts de la sortie word clock du SPG700, et les entrées word clock des appareils de la section son de l'établissement.`,
    car: { text: 'Au poste Synchro : « Horloge audio, word clock 48 kHz ». Dans la visionneuse de matériel, la console son a une entrée WORD CLOCK IN reliée au SPG : toute la chaîne audio du car est verrouillée dessus.', station: 'synchro' },
    terms: ['word-clock', 'dars', 'terminaison-75'],
    competences: ['2.10', '1.4', '4.1'],
    article: 'timing',
    quiz: [
      { q: 'Combien d\'échantillons à 48 kHz dans une image en 29,97 i/s ?', choices: [['1 920 exactement', 'C\'est à 25 i/s ; en 29,97, 48 000 ÷ 29,97 ne tombe pas juste.'], '1 601,6 en moyenne : une séquence de 5 images en compte 8 008', ['1 600 exactement', 'Ce serait à 30 i/s pile ; la cadence américaine est 30 000 / 1 001.']], answer: 1, why: '48 000 × 1 001 / 30 000 = 1 601,6 : il faut 5 images pour un nombre entier, 8 008 échantillons, répartis 1 602, 1 601, 1 602, 1 601, 1 602.' },
      { q: 'Sur le SPG700, le word clock est réglé en 1 V sur 75 Ω, et la console de l\'option son (entrée TTL) ne se cale pas. Pourquoi ?', choices: ['Centré sur 0 V, le signal ne monte qu\'à +0,5 V : il ne franchit jamais le seuil haut d\'une entrée TTL', ['Parce qu\'1 V est trop fort pour une console', 'Une entrée TTL attend un haut au-dessus de 2,4 V : 1 V crête à crête est trop faible, pas trop fort.'], ['Parce que le word clock doit être à 44,1 kHz', 'La télévision travaille à 48 kHz, et la fréquence ne dépend pas du niveau.']], answer: 0, why: 'Une entrée TTL attend un bas sous 0,4 V et un haut au-dessus de 2,4 V. En 5 V, la console voit ses fronts ; en 1 V, non.' },
      { q: 'Trois appareils de l\'option son sont chaînés en T sur une sortie word clock. Où se met la terminaison ?', choices: [['Sur chaque appareil', 'Chaque charge de 75 Ω en plus fait baisser le niveau : à trois, il s\'effondre.'], 'Un seul bouchon 75 Ω, au bout de la chaîne, les entrées du milieu en haute impédance', ['Nulle part : un word clock n\'a pas besoin de terminaison', 'Sans terminaison, chaque front rebondit au bout de la ligne : de la gigue, parfois des faux fronts.']], answer: 1, why: 'Comme une référence vidéo : une ligne 75 Ω se ferme une fois, au bout. Si une entrée est terminée en interne, elle ne se met qu\'en bout de chaîne. Une étoile par un DA évite le problème.' },
      { q: 'L\'enregistreur multipiste de l\'option son fait entendre des clics réguliers sur une prise synchronisée avec la vidéo. Que vérifier d\'abord ?', choices: ['Qu\'il est bien en horloge externe, calé sur le word clock du SPG, et non sur son horloge interne', ['Le gain de ses préamplis', 'Un gain trop fort sature (un son dur, continu), il ne fait pas des clics réguliers.'], ['Le format de la référence vidéo des caméras', 'Les caméras peuvent être parfaitement verrouillées : les clics viennent de l\'horloge audio.']], answer: 0, why: 'Deux horloges audio libres glissent l\'une par rapport à l\'autre : le convertisseur jette ou invente un échantillon de temps en temps, et chaque fois, un clic. Un seul maître (le SPG), tous les autres en externe.' },
      { q: 'Qui doit être le maître de l\'horloge audio quand la section son travaille avec la vidéo ?', choices: [['La console son, parce qu\'elle est au centre de l\'audio', 'Si la console était maître, son 48 kHz ne serait pas calé sur la vidéo : l\'audio glisserait par rapport aux images.'], 'Le SPG : son word clock est calé sur la même horloge que la référence vidéo', ['Chaque appareil, sur sa propre horloge', 'Deux horloges libres dérivent : clics et glissements garantis.']], answer: 1, why: 'Calé sur la même horloge que la vidéo, le word clock du SPG donne 1 920 échantillons par image : le son reste sur l\'image, et tous les appareils audio sont entre eux au même rythme.' },
      { q: 'Une entrée word clock est donnée pour « 3 V crête à crête au plus ». Que faire avec la sortie 5 V du SPG ?', choices: ['Suivre la notice : la passer en 1 V si l\'entrée l\'accepte, ou atténuer', ['Rien : 5 V conviennent à toutes les entrées', 'Certaines entrées décrochent au-delà de 3 V : c\'est le cas où la notice l\'emporte sur le 5 V habituel.'], ['Retirer la terminaison pour baisser le niveau', 'Sans terminaison, le niveau ne baisse pas (il monte plutôt) et les fronts rebondissent.']], answer: 0, why: 'Le 5 V est le réglage qui marche le plus souvent, pas une loi : une entrée qui demande moins le dit, et la notice fait foi.' },
    ],
  },
  {
    id: 'synchro-2059', title: 'Du black burst au PTP : SMPTE ST 2059 et le car hybride', minutes: '8 min',
    essentials: [
      'En IP, plus de câble de référence : chaque appareil connaît l\'**heure PTP**, des secondes **TAI** comptées depuis l\'**origine SMPTE** (1er janvier 1970, 0 h TAI).',
      '**ST 2059-1** cale toutes les images sur cette origine : la n-ième image commence à n fois la durée d\'une image ; la phase de n\'importe quelle image **se calcule** à partir de l\'heure. **ST 2059-2** est le profil PTP du broadcast.',
      'Dans un **car hybride** (SDI et IP), un même générateur calé sur le GPS sort le black burst, le tri-level et l\'heure PTP de **grand maître** : les deux mondes sont en phase sans être reliés par un câble.',
    ],
    figure: figSt2059,
    demoTitle: 'Gardez l\'heure proposée et changez la cadence ; passez en heure d\'été ; lancez « Maintenant » et regardez les tops défiler, puis figez.',
    demo: demoSt2059,
    body: `Dans un car SDI, chaque appareil apprend où commence l'image par un **câble** : la référence black burst ou tri-level. Dans un car IP (ST 2110), il n'y en a plus : chaque appareil reçoit par le réseau l'**heure** du **grand maître PTP** (IEEE 1588, voir la leçon « PTP » du chapitre Le réseau pour le protocole), à quelques centaines de nanosecondes près. Reste à transformer une heure en début d'image : c'est le rôle de **SMPTE ST 2059-1**.

**L'origine SMPTE.** ST 2059-1 fixe une origine des temps : le **1er janvier 1970 à 0 h TAI** (le temps atomique international, sans secondes intercalaires), qui est aussi l'origine de PTP. Tous les signaux sont réputés avoir commencé ensemble à cet instant, et s'être succédé sans interruption depuis : à 25 i/s, l'image n commence à n × 40 ms. Un appareil qui lit l'heure PTP t sait donc tout seul quelle image est en cours (n = partie entière de t × 25), depuis combien de temps elle a commencé, et quand viendra la suivante. Deux cars, un studio, une passerelle à l'autre bout du pays trouvent **le même début d'image**, sans être reliés. La règle vaut pour toutes les cadences (en 29,97, une image dure 1 001 / 30 000 s), pour l'audio (l'échantillon n à 48 kHz commence à n / 48 000 s : 1 920 échantillons par image à 25 i/s, chaque image commençant avec un échantillon) et pour le timecode.

**L'heure et le timecode.** PTP compte en **TAI** ; l'heure civile (UTC) a des **secondes intercalaires** : TAI − UTC = **37 s** depuis le 1er janvier 2017, une valeur que le grand maître annonce. Le timecode de l'**heure du jour** se déduit donc de l'heure PTP en retirant 37 s, puis en ajoutant le fuseau (UTC+1 l'hiver, UTC+2 l'été en France). En 29,97, le timecode se recale chaque jour à une heure convenue (le « daily jam » de ST 2059-1).

**ST 2059-2** est le **profil** PTP du broadcast : les réglages communs (domaine 127 par défaut, quatre messages Announce et huit Sync par seconde…), pour que tous les appareils et commutateurs se comprennent.

**Le car hybride.** Beaucoup de cars sont aujourd'hui **hybrides** : des caméras et des serveurs en SDI, un cœur IP, des passerelles entre les deux. Il faut alors que les deux mondes aient la **même phase**. On s'y prend avec un générateur (type SPG8000A) qui sort à la fois les références analogiques (black burst, tri-level, word clock) et l'heure PTP de **grand maître**, toutes tirées de la même horloge, elle-même calée sur le **GPS**. ST 2059-1 garantit que le début d'image calculé par un appareil IP tombe sur le top de la référence black burst du même générateur. Le **secours** est un second générateur, lui aussi calé sur le GPS : s'il prend la main (élection BMCA), la phase ne bouge pas.

- Heure PTP = secondes UTC depuis 1970 + 37 s ; image n = partie entière de (t × cadence).
- GPS → générateur → black burst, tri-level, word clock, DARS, LTC et PTP : une seule horloge pour tout le car.`,
    plus: `- **Pourquoi le TAI** : une seconde intercalaire ajoutée à l'UTC ferait sauter l'heure d'une seconde, donc la phase de toutes les images ; le TAI, lui, avance sans jamais sauter.
- **Le temps GPS** : les satellites comptent leur propre temps, en retard de 19 s sur le TAI ; le récepteur du générateur fait la conversion.
- **Les décalages de phase en IP** : une passerelle IP vers SDI a, comme un appareil SDI, un réglage de décalage de sa sortie par rapport à l'heure PTP, pour compenser ses traitements.`,
    car: { text: 'Au poste Synchro du car IP : le SPG est le grand maître PTP (ST 2059-2, domaine 127), calé sur le GPS ; au poste Réseau IP, onglet PTP, l\'élection du grand maître et l\'offset de chaque appareil.', station: 'synchro' },
    terms: ['st2059', 'ptp', 'grand-maitre', 'black-burst'],
    competences: ['3.6', '1.2', '2.10'],
    article: 'timing',
    quiz: [
      { q: 'Quelle est l\'origine des temps de SMPTE ST 2059-1 ?', choices: ['Le 1er janvier 1970 à 0 h TAI', ['Le 1er janvier 2000 à minuit UTC', 'C\'est une origine informatique courante, pas celle de PTP et de ST 2059.'], ['La mise sous tension du grand maître', 'Une origine qui dépendrait d\'un appareil ne permettrait pas à deux cars de trouver la même phase.']], answer: 0, why: 'L\'origine SMPTE est celle de PTP : 1970-01-01 00:00:00 TAI. Tous les signaux sont réputés avoir commencé ensemble à cet instant : chaque appareil en déduit la phase de ses images.' },
      { q: 'Un appareil IP lit l\'heure PTP t = 1 000,03 s. En 25 i/s, quelle image est en cours ?', choices: ['L\'image n° 25 000, commencée il y a 30 ms', ['L\'image n° 1 000', 'C\'est le nombre de secondes, pas d\'images : à 25 i/s, il y en a 25 par seconde.'], ['L\'image n° 25 001, commencée il y a 10 ms', 'L\'image 25 001 commence à 1 000,04 s, après l\'instant lu.']], answer: 0, why: 'n = partie entière de (1 000,03 × 25) = 25 000 ; elle a commencé à 1 000,00 s, il y a 30 ms, et la suivante viendra dans 10 ms.' },
      { q: 'Pourquoi le timecode de l\'heure du jour retire-t-il 37 s à l\'heure PTP ?', choices: ['Parce que PTP compte en TAI, et que l\'UTC a 37 s de secondes intercalaires de retard (depuis 2017)', ['Pour compenser le retard du réseau', 'Le retard du réseau se mesure et se corrige par PTP lui-même, à quelques nanosecondes près.'], ['Parce que le GPS est en avance de 37 s', 'Le temps GPS a 19 s de retard sur le TAI ; ce n\'est pas l\'écart en jeu ici.']], answer: 0, why: 'Le TAI avance sans sauter ; l\'UTC ajoute des secondes intercalaires : TAI − UTC = 37 s, valeur annoncée par le grand maître. On ajoute ensuite le fuseau horaire.' },
      { q: 'Dans un car hybride, comment les appareils SDI et les appareils IP sont-ils en phase ?', choices: ['Un même générateur, calé sur le GPS, sort la référence black burst ou tri-level et l\'heure PTP de grand maître', ['Par un câble de black burst tiré vers chaque appareil IP', 'Les appareils IP n\'ont pas d\'entrée de référence : ils prennent l\'heure par le réseau.'], ['Ils ne peuvent pas l\'être : il faut des synchroniseurs partout', 'ST 2059-1 garantit justement que le début d\'image calculé en IP tombe sur le top de la référence du même générateur.']], answer: 0, why: 'Toutes les références (analogiques et PTP) viennent de la même horloge ; ST 2059-1 relie l\'heure PTP à la phase des images. Les passerelles SDI ↔ IP voient les mêmes débuts d\'image.' },
      { q: 'En 25 i/s, combien d\'échantillons à 48 kHz séparent deux débuts d\'image, d\'après ST 2059-1 ?', choices: ['1 920, et chaque image commence avec un échantillon', ['1 601,6', 'C\'est en 29,97 i/s : il faut alors 5 images pour retomber juste.'], ['48 000', 'C\'est une seconde entière, 25 images.']], answer: 0, why: 'Image et échantillon partent de la même origine : à 48 kHz et 25 i/s, l\'image n commence à l\'échantillon 1 920 × n. L\'audio et la vidéo restent alignés.' },
      { q: 'Que fixe ST 2059-2, par rapport à ST 2059-1 ?', choices: [['L\'origine des temps', 'C\'est ST 2059-1 qui la fixe, avec la règle qui donne la phase des images.'], 'Le profil PTP du broadcast : domaine, cadence des messages Announce et Sync, réglages communs', ['Le format des paquets vidéo', 'C\'est le rôle de ST 2110-20.']], answer: 1, why: 'ST 2059-1 : l\'origine et le calcul de la phase des signaux ; ST 2059-2 : le profil PTP (domaine 127 par défaut, 4 Announce et 8 Sync par seconde…).' },
    ],
  },
];
