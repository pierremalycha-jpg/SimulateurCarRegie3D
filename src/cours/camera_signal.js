// @ts-check
import { el } from '../util.js';
import { canvas, slider, choice, readout } from './kit.js';
import { castOf } from '../camlab/optics.js';
import { amplitudeBoucle, triLevelUs, ycbcr, code10, codeC, RASTERS, debitSDI, signalDe, oetf709, vecteur, BARRES, CARNATIONS, plugeVisible, plugeJuste, luminanceEcran, bleuSeul, CROP_S35, pdcTotale, hlg, hlgInverse, HLG_BLANC, hfr, focalePour } from './camera_calc.js';
import { quizDe, competencesDe, figNotions, COUL, fond, ecrire, trait, nf, metres, fN } from './camera_kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « La caméra », parties « La voie caméra » (la référence, la sortie et le line-up), « Jusqu'au moniteur »
// (la forme d'onde et le vectorscope ; le moniteur de référence et les mires) et « Pour aller plus loin » (grand
// capteur, UHD et HDR, super ralenti). Notions du module « La caméra en 3D » (champ camlab) ; calculs de
// cours/camera_calc.js (tri-level SMPTE ST 274, entrée en boucle, Y'CbCr et codes BT.709, débits SDI, PLUGE
// et bleu seul, BT.1886, HLG BT.2100 et blanc de référence BT.2408, Super 35, super ralenti).
// ----------------------------------------------------------------------------------
const VOIE = 'La voie caméra', MONITEUR = 'Jusqu\'au moniteur', PLUS = 'Pour aller plus loin';

// ======================================================================================
// 1. La voie caméra : la référence, la sortie
// ======================================================================================
const COULEURS = { blanc: [1, 1, 1, 'blanc 100 %'], gris: [0.41, 0.41, 0.41, 'gris moyen'], rouge: [0.75, 0, 0, 'rouge 75 %'], pelouse: [0.2, 0.45, 0.12, 'pelouse'], peau: [0.78, 0.6, 0.5, 'visage'] };
function demoVoie(host) {
  const cv = canvas(720, 200, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let bouch = 1, ref = 'tri', col = 'rouge', fmt = '1080p50';
  const read = readout(['Amplitude reçue', 'Repère de temps', 'Verrouillage de la CCU']);
  const read2 = readout(['Y\' · Cb · Cr', 'Codes 10 bits', 'Débit de la sortie']);
  const draw = () => {
    const k = amplitudeBoucle(bouch);
    fond(g, 720, 200);
    const Y0 = 100, mvpx = 0.11; // 300 mV = 33 px
    trait(g, 20, Y0, 700, Y0, '#2a3238'); ecrire(g, '0 V', 4, Y0 - 4, { col: '#5a646c' });
    for (const mv of [-300, 300]) { trait(g, 20, Y0 - mv * mvpx, 700, Y0 - mv * mvpx, '#1c2329', 1, [3, 4]); ecrire(g, (mv > 0 ? '+' : '−') + '300 mV', 700, Y0 - mv * mvpx - 4, { align: 'right', col: '#5a646c' }); }
    g.strokeStyle = bouch === 1 ? COUL.pvw : COUL.tally; g.lineWidth = 2; g.beginPath();
    if (ref === 'tri') {
      // l'impulsion tri-level : −300 mV puis +300 mV, 44 périodes d'horloge chacune ; 1 µs = 160 px
      const us = triLevelUs(), x0 = 260, px = 160;
      g.moveTo(20, Y0); g.lineTo(x0, Y0); g.lineTo(x0 + 6, Y0 + 300 * mvpx * k); g.lineTo(x0 + us * px, Y0 + 300 * mvpx * k); g.lineTo(x0 + us * px + 8, Y0 - 300 * mvpx * k); g.lineTo(x0 + 2 * us * px, Y0 - 300 * mvpx * k); g.lineTo(x0 + 2 * us * px + 6, Y0); g.lineTo(700, Y0);
      g.stroke();
      trait(g, x0 + us * px + 4, Y0 - 50, x0 + us * px + 4, Y0 + 50, COUL.amber, 1, [3, 3]); ecrire(g, 'repère : le passage par 0 V', x0 + us * px + 10, Y0 - 52, { col: COUL.amber });
      ecrire(g, `${nf(us, 2)} µs`, x0 + us * px / 2, Y0 + 300 * mvpx * k + 16, { align: 'center' });
    } else {
      // le black burst : le top de synchro à −300 mV (4,7 µs), puis la salve de sous-porteuse ; 1 µs = 40 px
      const x0 = 120, px = 40;
      g.moveTo(20, Y0); g.lineTo(x0, Y0); g.lineTo(x0 + 3, Y0 + 300 * mvpx * k); g.lineTo(x0 + 4.7 * px, Y0 + 300 * mvpx * k); g.lineTo(x0 + 4.7 * px + 3, Y0);
      const b0 = x0 + 5.6 * px; g.lineTo(b0, Y0);
      for (let i = 0; i <= 90; i++) { const t = i / 90 * 2.25; g.lineTo(b0 + t * px, Y0 - Math.sin(2 * Math.PI * 4.43361875 * t) * 150 * mvpx * k); }
      g.lineTo(700, Y0); g.stroke();
      trait(g, x0 + 1.5, Y0 - 50, x0 + 1.5, Y0 + 50, COUL.amber, 1, [3, 3]); ecrire(g, 'repère : le front descendant, à mi-hauteur', x0 + 8, Y0 - 52, { col: COUL.amber });
      ecrire(g, '4,7 µs', x0 + 2.35 * px, Y0 + 300 * mvpx * k + 16, { align: 'center' }); ecrire(g, 'salve 4,43 MHz', b0 + 45, Y0 + 60, { align: 'center' });
    }
    ecrire(g, ref === 'tri' ? 'tri-level 1080i50 (HD), à l\'entrée REFERENCE de la CCU' : 'black burst 625 lignes (hérité de la SD), à l\'entrée REFERENCE de la CCU', 20, 16, { col: COUL.blanc });
    read.set('Amplitude reçue', `× ${nf(k, 2)} : ${ref === 'tri' ? `± ${nf(300 * k)} mV (attendu ± 300 mV, 0,6 V crête à crête)` : `top à −${nf(300 * k)} mV (attendu −300 mV)`}${bouch === 0 ? ' : sans bouchon, l\'onde se réfléchit au bout du câble et s\'ajoute à elle-même' : bouch === 2 ? ' : deux bouchons de 75 Ω en parallèle font 37,5 Ω' : ''}`);
    read.set('Repère de temps', ref === 'tri' ? 'le passage par 0 V au milieu de l\'impulsion : il ne bouge pas si l\'amplitude varie' : 'le front du top, à mi-hauteur : il se déplace un peu si l\'amplitude change');
    read.set('Verrouillage de la CCU', bouch === 1 ? 'normal : un seul bouchon de 75 Ω, sur la dernière sortie de boucle' : 'amplitude hors de ce qu\'attend l\'entrée : le verrouillage n\'est plus garanti, l\'image peut glisser ou sauter');
    // la sortie : Y'CbCr et codes
    const [r, gg, b, nom] = /** @type {any} */ (COULEURS[col]), c = ycbcr(r, gg, b);
    read2.set('Y\' · Cb · Cr', `${nom} : Y' ${nf(c.y * 100, 1)} % · Cb ${nf(c.cb, 3)} · Cr ${nf(c.cr, 3)}`);
    read2.set('Codes 10 bits', `Y' ${code10(c.y * 100)} · Cb ${codeC(c.cb)} · Cr ${codeC(c.cr)} (512 = pas de couleur)`);
    const R = RASTERS[fmt];
    read2.set('Débit de la sortie', `${fmt} : ${nf(R.ech)} × ${nf(R.lignes)} × ${R.ips} × 2 × 10 bits = ${nf(debitSDI(/** @type {any} */ (fmt)), 3)} Gb/s, en ${R.lien}`);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Référence', [['tri', 'tri-level'], ['bb', 'black burst']], ref, (v) => { ref = v; draw(); }),
      choice('Bouchons de 75 Ω au bout de la boucle', [['0', 'aucun'], ['1', 'un'], ['2', 'deux']], '1', (v) => { bouch = +v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le signal de référence tel que le reçoit la CCU : en vert, l\'amplitude attendue ; en rouge, une ligne mal terminée.')),
    read.el,
    el('div', { class: 'co-ctl' },
      choice('Ce que filme la caméra', Object.entries(COULEURS).map(([k, x]) => [k, String(x[3])]), col, (v) => { col = v; draw(); }),
      choice('Format de la CCU', Object.keys(RASTERS).map((k) => [k, k]), fmt, (v) => { fmt = v; draw(); })),
    read2.el);
  draw();
}

// ======================================================================================
// 2. La forme d'onde et le vectorscope
// ======================================================================================
/** l'image du stade, en bandes : lumière relative au blanc nominal et couleur de la scène (R, V, B linéaires) */
const SCENE = [
  ['tribune à l\'ombre', 0.04, [1, 1, 1]], ['pelouse', 0.22, [0.55, 1, 0.35]], ['maillot blanc', 1.05, [1, 1, 1]],
  ['visage', 0.6, [1, 0.72, 0.58]], ['pelouse', 0.22, [0.55, 1, 0.35]], ['ciel', 1.6, [0.75, 0.9, 1]],
];
function demoMesure(host) {
  const cv = canvas(720, 300, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let iris = 0, Tl = 5600, kon = true;
  const read = readout(['Niveaux', 'Au-dessus de 103 %', 'Le visage au vectorscope', 'Le gris de la tribune']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const cast = castOf(Tl, 5600), e = Math.pow(2, iris);
    // chaque bande : ses trois voies après la courbe, sa luminance
    const bandes = SCENE.map(([nom, L, c]) => {
      const lin = /** @type {number[]} */ (c).map((x, i) => /** @type {number} */ (L) * x * e * cast[i] / Math.max(...(/** @type {number[]} */ (c))));
      const v = lin.map((x) => signalDe(x, { kneeOn: kon, knee: 0.95, slope: 0.1, clip: 1.09 }) / 100);
      return { nom: String(nom), v, y: ycbcr(v[0], v[1], v[2]) };
    });
    fond(g, 720, 300);
    // l'image
    const W = 300, bw = W / bandes.length;
    bandes.forEach((b, i) => { g.fillStyle = `rgb(${b.v.map((x) => Math.round(255 * Math.max(0, Math.min(1, x)))).join(',')})`; g.fillRect(10 + i * bw, 30, bw, 110); });
    ecrire(g, 'l\'image', 10, 22);
    // la forme d'onde : la luminance de chaque colonne
    const WX = 10, WY0 = 280, Yw = (p) => WY0 - Math.max(-7, Math.min(109, p)) / 109 * 120;
    for (const p of [0, 50, 100]) { trait(g, WX, Yw(p), WX + W, Yw(p), '#1c2329'); ecrire(g, p + '', WX + W + 4, Yw(p) + 4, { col: '#5a646c' }); }
    trait(g, WX, Yw(103), WX + W, Yw(103), COUL.tally, 1, [3, 3]);
    bandes.forEach((b, i) => { const p = b.y.y * 100; g.fillStyle = p > 103 ? COUL.red : COUL.pvw; for (let x = 0; x < bw; x += 2) g.fillRect(WX + i * bw + x, Yw(p) + Math.sin((i * 31 + x) * 1.7) * 1.5, 2, 2); });
    ecrire(g, 'forme d\'onde (%)', WX, 154);
    // le vectorscope
    const C0x = 520, C0y = 160, R0 = 125, P = (cb, cr) => [C0x + cb / 0.5 * R0, C0y - cr / 0.5 * R0];
    g.strokeStyle = '#2a3238'; g.beginPath(); g.arc(C0x, C0y, R0, 0, Math.PI * 2); g.stroke();
    trait(g, C0x - R0, C0y, C0x + R0, C0y, '#2a3238'); trait(g, C0x, C0y - R0, C0x, C0y + R0, '#2a3238');
    const a = CARNATIONS * Math.PI / 180; trait(g, C0x, C0y, C0x + Math.cos(a) * R0, C0y - Math.sin(a) * R0, '#a07050', 1, [4, 3]);
    for (const b of BARRES.slice(1)) { const y = ycbcr(0.75 * b[1], 0.75 * b[2], 0.75 * b[3]); const [x, yy] = P(y.cb, y.cr); g.strokeStyle = COUL.grey; g.strokeRect(x - 6, yy - 6, 12, 12); }
    bandes.forEach((b) => { const [x, y] = P(b.y.cb, b.y.cr); g.fillStyle = COUL.amber; g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); });
    ecrire(g, 'vectorscope : cibles 75 %, ligne des carnations', 400, 22);
    const vis = bandes[3], vv = vecteur(vis.v[0], vis.v[1], vis.v[2]), tri = bandes[0], vt = vecteur(tri.v[0], tri.v[1], tri.v[2]);
    read.set('Niveaux', bandes.filter((b, i) => i !== 4).map((b) => `${b.nom} ${nf(b.y.y * 100, 0)} %`).join(' · '));
    read.set('Au-dessus de 103 %', bandes.filter((b) => b.y.y * 100 > 103).map((b) => b.nom).join(', ') || 'rien');
    read.set('Le visage au vectorscope', `${nf(vv.angle, 0)}° (ligne des carnations : ${CARNATIONS}°)`);
    read.set('Le gris de la tribune', vt.sat < 0.001 ? 'au centre exact : neutre, la balance est juste' : `teinte ${nf(vt.angle, 0)}°, à ${nf(vt.sat * 1000, 0)} millièmes du centre${vt.sat > 0.01 ? ' : la balance n\'est pas faite pour cette lumière' : ''}`);
    const over = bandes.some((b) => b.y.y * 100 > 103), visL = vis.y.y * 100;
    const v = Math.abs(Tl - 5600) > 400 ? ['warn', `Les gris ne sont plus au centre du vectorscope et le visage s'écarte de sa ligne : la caméra est balancée pour 5 600 K sous une lumière à ${nf(Tl)} K. Refaites la balance.`]
      : over ? ['ko', 'Des crêtes au-dessus de 103 % : fermez l\'iris, ou remettez le knee pour garder le détail du blanc sous la limite.']
        : visL < 50 ? ['warn', 'Le visage est bas : ouvrez l\'iris. Un visage clair se pose vers 60 à 70 %.'] : ['ok', 'Noirs posés, visage vers 60 à 70 %, pelouse vers 40 à 55 %, crêtes sous 103 % ; au vectorscope, les gris au centre et le visage sur sa ligne.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Iris (diaphragmes)', -2, 2, iris, 0.1, (v) => { iris = v; draw(); }, (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), 1)),
      slider('Lumière de la scène (caméra balancée à 5 600 K)', 3000, 9000, Tl, 100, (v) => { Tl = v; draw(); }, (v) => nf(v) + ' K'),
      choice('Knee', [['on', 'en service'], ['off', 'coupé']], 'on', (v) => { kon = v === 'on'; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Une image du stade, sa forme d\'onde (la luminance de chaque colonne, rouge au-dessus de 103 %) et son vectorscope (chaque zone en ambre).')),
    verdict, read.el);
  draw();
}

// ======================================================================================
// 3. Le moniteur de référence : PLUGE, contraste, bleu seul
// ======================================================================================
function demoMoniteur(host) {
  const cv = canvas(720, 220, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let b = 3, Lw = 140, k = 1.15;
  const read = readout(['La barre −2 %', 'La barre +2 %', 'Le noir de l\'écran', 'Le blanc à la sonde']);
  const read2 = readout(['En bleu seul : gris · cyan · magenta · bleu']);
  const verdict = el('p', { class: 'co-verdict' });
  // le niveau affiché par l'écran (en % du signal), en gris exagéré : 10 % du signal donnent le blanc de la vignette
  const tonal = (s) => { const t = Math.round(255 * Math.max(0, Math.min(1, s / 10))); return `rgb(${t},${t},${t})`; };
  const draw = () => {
    fond(g, 720, 220);
    // la PLUGE : le noir, et trois barres à −2, +2 et +4 %, vues sur l'écran réglé ; le décalage est amplifié pour qu'on le voie
    const show = (pct) => Math.max(0, pct + b);
    g.fillStyle = tonal(show(0)); g.fillRect(20, 30, 330, 150);
    [[-2, 60], [2, 160], [4, 260]].forEach(([p, x]) => { g.fillStyle = tonal(show(p)); g.fillRect(x, 60, 50, 90); ecrire(g, (p > 0 ? '+' : '−') + Math.abs(p) + ' %', x + 25, 172, { align: 'center' }); });
    ecrire(g, 'la PLUGE (contraste exagéré à l\'écran pour qu\'on voie)', 20, 22);
    // le bleu seul : quatre barres qui contiennent du bleu à 75 %
    const bars = [BARRES[0], BARRES[2], BARRES[4], BARRES[6]];
    const vals = bars.map((x) => bleuSeul(x, k));
    vals.forEach((v, i) => { const t = Math.round(255 * Math.max(0.08, Math.min(1, (v - 0.55) / 0.4))); g.fillStyle = `rgb(${Math.round(t * 0.3)},${Math.round(t * 0.45)},${t})`; g.fillRect(380 + i * 80, 30, 76, 150); ecrire(g, String(bars[i][0]), 418 + i * 80, 196, { align: 'center' }); });
    ecrire(g, 'en bleu seul (BLUE ONLY)', 380, 22);
    read.set('La barre −2 %', plugeVisible(-2, b) ? 'visible : la luminosité est trop haute' : 'confondue avec le noir');
    read.set('La barre +2 %', plugeVisible(2, b) ? 'juste visible' : 'invisible : la luminosité est trop basse, les ombres seront bouchées');
    read.set('Le noir de l\'écran', `${nf(luminanceEcran(Math.max(0, b / 100), Lw), 2)} cd/m²`);
    read.set('Le blanc à la sonde', `${nf(luminanceEcran(1 + b / 100, Lw), 0)} cd/m² (BT.2035 : 100 cd/m² dans une pièce sombre)`);
    read2.set('En bleu seul : gris · cyan · magenta · bleu', vals.map((v) => nf(v * 100, 0) + ' %').join(' · ') + (Math.abs(k - 1) < 0.015 ? ' : les quatre barres sont égales, la chroma est juste' : ` : les barres colorées sont ${k > 1 ? 'plus claires' : 'plus sombres'} que la grise, chroma ${k > 1 ? 'trop forte' : 'trop faible'}`));
    const blanc = luminanceEcran(1 + b / 100, Lw);
    const v = !plugeJuste(b) ? ['ko', 'Réglez d\'abord la luminosité à la PLUGE : montez jusqu\'à voir la −2 %, puis redescendez jusqu\'à ce qu\'elle disparaisse. La +2 % doit rester juste visible.']
      : Math.abs(blanc - 100) > 5 ? ['warn', 'Le noir est juste. Réglez maintenant le contraste pour que la sonde lise 100 cd/m² sur le blanc.']
        : Math.abs(k - 1) >= 0.015 ? ['warn', 'Luminosité et contraste justes. Reste la chroma : en bleu seul, les quatre barres doivent avoir la même intensité.']
          : ['ok', 'Le moniteur est réglé : noir à la PLUGE, blanc à 100 cd/m², chroma en bleu seul. On n\'y touche plus ; on règle les caméras en le regardant.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Luminosité (BRIGHTNESS)', -5, 5, b, 0.5, (v) => { b = v; draw(); }, (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf(Math.abs(v), 1) + ' %'),
      slider('Contraste (blanc de l\'écran)', 60, 160, Lw, 1, (v) => { Lw = v; draw(); }, (v) => nf(v) + ' cd/m²'),
      slider('Chroma', 0.8, 1.2, k, 0.01, (v) => { k = v; draw(); }, (v) => '× ' + nf(v, 2))),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'À gauche, la mire PLUGE sur l\'écran tel qu\'il est réglé ; à droite, quatre barres de couleur en bleu seul, qui contiennent toutes du bleu à 75 % (écarts exagérés à l\'écran).')),
    verdict, read.el, read2.el);
  draw();
}

// ======================================================================================
// 4. Pour aller plus loin : grand capteur, HDR, super ralenti
// ======================================================================================
function demoPlusLoin(host) {
  const cv = canvas(720, 230, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let w = 0.5, D = 3, N = 2.8, n = 3;
  const read = readout(['Focale pour ce cadre', 'Zone nette à la même ouverture', 'Pour la même zone nette en Super 35']);
  const read2 = readout(['Le gris 18 %', 'De 75 à 100 % en HLG']);
  const read3 = readout(['Images par seconde', 'Lumière', 'Relecture sans saccade', 'Lampes à 100 Hz']);
  const draw = () => {
    const f23 = focalePour(w, D), f35 = f23 * CROP_S35;
    const p23 = pdcTotale(f23, N, D), p35 = pdcTotale(f35, N, D, 0.011 * CROP_S35);
    read.set('Focale pour ce cadre', `2/3" : ${nf(f23, 0)} mm · Super 35 : ${nf(f35, 0)} mm (× ${nf(CROP_S35, 1)})`);
    read.set('Zone nette à la même ouverture', `à ${fN(N)} : ${metres(p23)} en 2/3", ${metres(p35)} en Super 35`);
    read.set('Pour la même zone nette en Super 35', `≈ ${fN(Math.round(N * CROP_S35 * 10) / 10)}, ${nf(2 * Math.log2(CROP_S35), 1)} diaphragmes de plus : ${nf(CROP_S35 ** 2, 1)} fois moins de lumière`);
    // HLG et SDR : la même scène, le blanc de référence à 75 % en HLG, à 100 % en SDR
    const Eref = hlgInverse(HLG_BLANC);
    fond(g, 720, 230);
    const X0 = 50, X1 = 700, Y0 = 206, Y1 = 22, Lmax = 1 / Eref;
    const X = (L) => X0 + Math.sqrt(L / Lmax) * (X1 - X0), Y = (v) => Y0 - Math.min(110, v) / 110 * (Y0 - Y1);
    for (const v of [0, 50, 75, 100]) { trait(g, X0, Y(v), X1, Y(v), '#1c2329'); ecrire(g, v + ' %', X0 - 6, Y(v) + 4, { align: 'right', col: '#5a646c' }); }
    for (const L of [0, 0.18, 1, 2, Lmax]) { trait(g, X(L), Y0, X(L), Y0 + 4, COUL.grey); ecrire(g, L >= Lmax ? nf(L, 1) + '×' : nf(L * 100) + ' %', X(L), Y0 + 16, { align: 'center' }); }
    const curve = (fn, col) => { g.strokeStyle = col; g.lineWidth = 2.2; g.beginPath(); for (let i = 0; i <= 200; i++) { const L = Lmax * (i / 200) ** 2; const y = Y(fn(L)); if (i) g.lineTo(X(L), y); else g.moveTo(X(L), y); } g.stroke(); };
    curve((L) => Math.min(109, oetf709(L) * 100), COUL.grey);
    curve((L) => hlg(L * Eref) * 100, COUL.amber);
    ecrire(g, 'SDR BT.709 (gris) : coupé au-dessus du blanc · HLG (ambre) : de la place jusqu\'à ' + nf(Lmax, 1) + ' fois le blanc', X0 + 6, Y1 - 6);
    ecrire(g, 'lumière de la scène (100 % = le blanc de référence)', X1, Y0 - 6, { align: 'right' });
    read2.set('Le gris 18 %', `HLG ${nf(hlg(0.18 * Eref) * 100, 0)} % (BT.2408 : 38 %) · SDR ${nf(oetf709(0.18) * 100, 0)} %`);
    read2.set('De 75 à 100 % en HLG', `${nf(Lmax, 1)} fois plus de lumière de scène codée au-dessus du blanc, ${nf(Math.log2(Lmax), 1)} diaphragmes`);
    const H = hfr(n);
    read3.set('Images par seconde', `${50 * n} images/s, ${H.phases} phase${H.phases > 1 ? 's' : ''} vers le serveur (une liaison à 50 images/s par phase)`);
    read3.set('Lumière', `pose de 1/${nf(50 * n)} s au plus : ${nf(H.diaph, 1)} diaphragme(s) de moins ; f/11 à 2 000 lux devient ≈ ${fN(11 / Math.sqrt(n))}`);
    read3.set('Relecture sans saccade', `jusqu'à ${nf(H.fluideJusqua * 100, 1)} % de la vitesse : chaque image montrée une seule fois`);
    read3.set('Lampes à 100 Hz', `${nf(H.battements, 2)} battement(s) par image : ${Math.abs(H.battements - Math.round(H.battements)) < 1e-9 && H.battements >= 1 ? 'un nombre entier, pas de scintillement' : 'pas un nombre entier : le ralenti clignote sous des lampes qui battent'}`);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Largeur cadrée', 0.3, 3, w, 0.05, (v) => { w = v; draw(); }, (v) => metres(v)),
      slider('Distance', 1, 60, D, 0.5, (v) => { D = v; draw(); }, (v) => metres(v)),
      choice('Iris', [['1.8', 'f/1,8'], ['2.8', 'f/2,8'], ['4', 'f/4'], ['5.6', 'f/5,6']], '2.8', (v) => { N = +v; draw(); })),
    read.el,
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'La même scène codée en SDR (BT.709, blanc à 100 %) et en HLG (BT.2100, blanc de référence à 75 %) : en HLG, les hautes lumières gardent leur place.')),
    read2.el,
    el('div', { class: 'co-ctl' }, choice('Super ralenti', [1, 2, 3, 4, 6, 8].map((x) => [String(x), x === 1 ? 'normal' : x + '×']), String(n), (v) => { n = +v; draw(); })),
    read3.el);
  draw();
}

/** @type {import('./index.js').Lesson[]} */
export const LECONS_VOIE = [
  {
    id: 'camera-voie', title: 'La référence, la sortie et le line-up de la voie caméra', minutes: '10 min', partie: VOIE,
    camlab: ['genlock', 'sortie', 'lineup'],
    essentials: [
      'La **CCU** reçoit la **référence** de la régie (**tri-level** ± 300 mV pour la HD, ou **black burst**) et cale la caméra dessus : son image commence avec celle des autres sources (le **genlock**). Une entrée en **boucle** se termine par **un seul bouchon de 75 Ω**.',
      'La **sortie** de la CCU est un SDI en **Y\'CbCr 4:2:2 sur 10 bits** : Y\' de 64 à 940, Cb et Cr autour de 512 ; **HD-SDI** (1,485 Gb/s) en 1080i50, **3G-SDI** (2,97 Gb/s) en 1080p50.',
      'Le **line-up** rend les caméras interchangeables, dans l\'ordre : fichier de référence, **barres**, **noirs**, **blancs**, **exposition**, **couleurs**, sur une caméra de référence.',
    ],
    figure: () => figNotions(['genlock', 'sortie'], 'Genlock et référence, le signal de sortie'),
    demoTitle: 'Retirez le bouchon de la boucle, puis mettez-en deux : regardez l\'amplitude. Passez en black burst. Plus bas, filmez le rouge 75 % et lisez ses codes, puis changez de format.',
    demo: demoVoie,
    body: `Le mélangeur passe d'une caméra à l'autre entre deux images : pour que la coupe ne se voie pas, toutes les sources doivent commencer leurs images, et leurs lignes, au même instant. Chaque appareil a son quartz, juste à quelques dizaines de millionièmes près : libres, deux caméras glissent l'une par rapport à l'autre. La régie distribue donc un signal de rythme commun, la **référence**, et chaque appareil s'y **verrouille** : le **genlock**. Elle arrive sur l'entrée REFERENCE de la **CCU**, qui cale sur ce rythme la caméra au bout de sa fibre ; un réglage de **phase** (en lignes et en microsecondes) avance ou retarde la sortie pour compenser traitements et câbles. Deux signaux : le **black burst**, un noir de la télévision standard (625 lignes de 64 µs, top de synchro de 4,7 µs à −300 mV, salve de sous-porteuse à 4,43 MHz), hérité de la SD et encore partout ; le **tri-level** de la HD (SMPTE ST 274), une impulsion à −300 puis +300 mV de 44 périodes d'horloge chacune (0,59 µs en 1080i50), dont le repère, le passage par 0 V, ne bouge pas si l'amplitude varie.

L'entrée REFERENCE a deux BNC : l'entrée et sa **sortie de boucle**, pour passer la référence d'une CCU à la suivante dans la baie. Le câble est une ligne de 75 Ω : le **dernier appareil porte un bouchon de 75 Ω** et lui seul. Sans bouchon, l'onde se réfléchit au bout du câble et s'ajoute à elle-même : l'amplitude double. Avec deux, elle tombe aux deux tiers. Dans les deux cas, le verrouillage n'est plus garanti.

La CCU sort l'image en **SDI**. Les trois voies R', V', B' (après le gamma) deviennent une **luminance** Y' = 0,2126 R' + 0,7152 V' + 0,0722 B' et deux **différences de couleur**, Cb = (B' − Y') ÷ 1,8556 et Cr = (R' − Y') ÷ 1,5748, nulles sur un gris. L'œil voit moins finement la couleur : un Cb et un Cr pour deux points, le **4:2:2**. En **10 bits**, Y' va de 64 à 940, Cb et Cr sont centrés sur 512 (de 64 à 960). Le débit : en 1080i50, 2 640 points par ligne (suppression comprise) × 1 125 lignes × 25 images × 2 mots × 10 bits = **1,485 Gb/s**, le HD-SDI ; en 1080p50, deux fois plus, le **3G-SDI**. La CCU est le premier point de mesure : image bonne à sa sortie, la panne est en aval ; mauvaise, en amont.

Le **line-up** rend les caméras interchangeables : au mélangeur, on coupe d'une caméra à l'autre sans que l'image change. Dans l'ordre, caméra par caméra, depuis les RCP : partir du même réglage (le **fichier de référence**) ; les **barres**, qui valident la liaison sans l'objectif ni la lumière ; les **noirs** (balance des noirs, puis master black au même niveau) ; les **blancs** (balance sur la même charte, sous la même lumière ; à la parade, les trois traces à la même hauteur) ; l'**exposition** (le même gris au même niveau partout) ; les **couleurs** (au vectorscope, chaque pastille au même endroit ; saturation ou matrice). On règle une **caméra de référence**, souvent la principale, puis on raccorde les autres sur elle sans plus la toucher, en écran partagé et à la mesure.

- Sans CCU, la caméra reçoit la référence sur sa prise PROMPTER/GENLOCK (page M13 GENLOCK du menu MAINTENANCE).
- La leçon La synchro (Le genlock) détaille la phase de chaque source et la fenêtre du mélangeur.`,
    car: { text: 'Dans le car, la référence vient du générateur de synchro du poste Synchro et part vers chaque CCU par les distributeurs ; la baie CCU affiche RÉF. LOCK ou l\'alarme RÉF. NON VERROUILLÉE pour chaque voie. Le line-up se coche au poste Chef de car et se fait au poste Vision, CAM 1 en référence, pelouse vers 40 à 55 %.', station: 'ccu' },
    terms: ['timing-ref', 'ycbcr', 'vpid'],
    competences: competencesDe(['genlock', 'sortie', 'lineup']),
    article: 'sync',
    quiz: quizDe(['genlock', 'sortie', 'lineup'], [
      { q: 'Dans la baie, la référence passe en boucle de la CCU 1 à la CCU 6. Après un recâblage, les CCU 5 et 6 décrochent par moments ; on trouve un bouchon de 75 Ω sur la CCU 4 et un autre sur la CCU 6. Que faire ?',
        choices: ['Retirer le bouchon de la CCU 4 : un seul bouchon, sur la dernière sortie de boucle',
          ['Ajouter un bouchon sur la CCU 5', 'Chaque bouchon de plus fait baisser l\'amplitude : trois bouchons en parallèle, c\'est 25 Ω, et la référence tombe encore.'],
          ['Changer le générateur de synchro', 'Le générateur va bien : les CCU 1 à 3 restent verrouillées. C\'est la terminaison de la ligne qui est fausse.']],
        answer: 0, why: 'La ligne de référence est une ligne de 75 Ω : elle se termine une fois, au bout. Deux bouchons en parallèle font 37,5 Ω et l\'amplitude tombe aux deux tiers ; le verrouillage n\'est plus garanti. On retire le bouchon du milieu de la chaîne.' },
    ]),
  },
  {
    id: 'camera-mesure', title: 'La forme d\'onde et le vectorscope', minutes: '10 min', partie: MONITEUR,
    camlab: ['waveform', 'vecto'],
    essentials: [
      'La **forme d\'onde** superpose toutes les lignes de l\'image : chaque point à sa place de gauche à droite, à la hauteur de son niveau, de **0 %** (le noir, code 64, 0 mV) à **100 %** (le blanc, code 940, 700 mV) ; la diffusion n\'accepte pas plus de **103 %**.',
      'Repères d\'usage, pas des normes : noirs entre **0 et 2 %**, visage clair vers **60 à 70 %**, pelouse vers **40 à 55 %**, blancs juste sous 100 %.',
      'Le **vectorscope** ne montre que la couleur : la **teinte** en angle, la **saturation** en distance du centre ; les barres 75 % dans leurs cibles, les gris au centre, les visages sur la **ligne des carnations** (≈ 123°).',
    ],
    figure: () => figNotions(['waveform', 'vecto'], 'Le moniteur forme d\'onde et le vectorscope'),
    demoTitle: 'Ouvrez l\'iris de deux diaphragmes et coupez le knee : que devient le maillot blanc ? Puis faites passer la lumière à 3 200 K sans refaire la balance : regardez les gris et le visage au vectorscope.',
    demo: demoMesure,
    body: `L'œil s'adapte, et un moniteur mal réglé trompe : un blanc à 95 % et un blanc à 108 % se ressemblent sur un écran. La **forme d'onde** (waveform monitor) mesure le signal qui part vers le car, quel que soit l'écran. Elle superpose toutes les lignes de l'image : chaque point garde sa place de gauche à droite, sa hauteur donne son niveau. Une chemise blanche à gauche de l'image fait une trace en haut à gauche ; un rideau sombre derrière tout le plateau, une bande basse sur toute la largeur. On ne voit plus l'image, on voit ses niveaux. L'échelle : **0 %** pour le noir (code 64 en 10 bits), **100 %** pour le blanc (code 940) ; certains appareils graduent en millivolts, de 0 à **700 mV** (7 mV pour 1 %). Le SDI porte jusqu'à 109 %, mais la diffusion n'accepte pas plus de **103 %** (EBU R 103).

Les **repères** de l'exposition sont des ordres de grandeur d'usage : les noirs posés entre 0 et 2 % ; un visage de peau claire vers 60 à 70 % (une peau mate ou foncée se pose plus bas) ; une carte grise à 18 % vers 41 % quand un blanc parfait touche 100 % (la courbe de la caméra n'est pas une règle de trois) ; une pelouse de jour vers 40 à 55 % ; les blancs juste sous 100 %, les reflets sous 103 %. Lire la trace : un trait plat sur la ligne des 100 %, un blanc écrêté ; une trace tassée contre 0 %, des noirs bouchés ; une trace épaisse et floue dans les sombres, du bruit, souvent du gain. Et c'est le sujet qui compte : un plan de nuit n'a pas à monter à 100 %. La **parade** met côte à côte les trois voies R, V, B : un gris bien balancé y a trois traces à la même hauteur.

Le **vectorscope** ne montre que la **couleur**. Pour chaque point, il calcule Cb (le bleu moins la luminance) et Cr (le rouge moins la luminance) et place le point : Cb à l'horizontale, Cr à la verticale. L'**angle** donne la teinte (en BT.709, depuis l'axe Cb : le rouge vers 103°, le jaune vers 175°, le vert vers 230°, le cyan vers 283°, le bleu vers 355°, le magenta vers 50°), la **distance au centre** la saturation ; au centre, le blanc, les gris et le noir. Les **cibles** du graticule attendent les barres : à 75 % (la mire EBU 100/0/75/0 du car), chaque tache dans sa case ; si toutes y tombent, la chaîne ne déforme pas les couleurs. Ce que la caméra y montre : la **balance** (un gris est une tache au centre exact ; décalée vers le rouge, l'image est trop chaude), la **saturation** (les points s'éloignent du centre sans tourner), la **matrice** (elle fait tourner certaines teintes), et les **visages**, qui tombent près de la **ligne des carnations**, vers 123°, quelle que soit la couleur de la peau : un visage à côté de la ligne a une teinte fausse.

- Avec les cases d'une mire 100 %, les taches d'une mire 75 % tombent à l'intérieur : ce n'est pas une panne, ce sont les mauvaises cibles.
- En HDR HLG, le blanc de référence se pose à 75 % : le PRISM du car a une ligne pour lui.`,
    car: { text: 'Au poste vision, le PRISM affiche la forme d\'onde et le vectorscope de la caméra que le RCP a sélectionnée : l\'ingénieur vision expose au manche en regardant la trace, visages et pelouse à leur niveau, crêtes sous 103 %, et vérifie au vectorscope (cibles 75 %, zoom ×5) les barres, les gris et les visages de chaque caméra.', station: 'vision' },
    terms: ['waveform', 'vecteurscope', 'parade-rvb', 'mv-pct'],
    competences: competencesDe(['waveform', 'vecto']),
    article: 'mesures',
    quiz: quizDe(['waveform', 'vecto'], [
      { q: 'Au poste vision, la forme d\'onde de la CAM 2 montre un trait plat et épais exactement sur la ligne des 100 %, à l\'endroit du maillot blanc d\'un joueur. Qu\'en concluez-vous ?',
        choices: ['Le blanc est écrêté : ses plis sont perdus ; on ferme un peu l\'iris ou on règle le knee',
          ['Tout va bien : le blanc est à 100 %', 'Un blanc bien exposé a encore du modelé : un trait plat sur la ligne dit que tout ce qui dépassait a été coupé au même niveau.'],
          ['C\'est du bruit : il faut baisser le gain', 'Le bruit épaissit la trace dans les sombres. Un plateau net au sommet, c\'est l\'écrêtage.']],
        answer: 0, why: 'Un trait plat sur la ligne des 100 %, c\'est un blanc écrêté : le détail du maillot est perdu. La vision ferme un peu l\'iris, ou laisse le knee comprimer les hautes lumières pour garder les plis sous la limite.' },
    ]),
  },
  {
    id: 'camera-moniteur', title: 'Le moniteur de référence et les mires', minutes: '9 min', partie: MONITEUR,
    camlab: ['moniteur', 'mires'],
    essentials: [
      'Le **moniteur de référence** suit la norme (primaires BT.709, blanc D65, gamma **2,4** de la BT.1886, blanc à **100 cd/m²** dans une pièce sombre) : tous les moniteurs de référence montrent la même image.',
      'Trois réglages dans l\'ordre : la **luminosité** à la **PLUGE** (la −2 % disparaît, la +2 % reste juste visible), le **contraste** à la sonde (100 cd/m²), la **chroma** en **bleu seul** ; puis on n\'y touche plus.',
      'Les **mires électroniques** (barres) testent la **chaîne** ; les **mires optiques** (étoile de Siemens, charte grise, carton blanc) testent l\'**image** : le point, le tirage, le gamma, la balance.',
    ],
    figure: () => figNotions(['moniteur', 'mires'], 'Le moniteur de référence et les mires'),
    demoTitle: 'La luminosité est trop haute : descendez jusqu\'à ce que la −2 % disparaisse, sans perdre la +2 %. Réglez le blanc à 100 cd/m², puis la chroma en bleu seul.',
    demo: demoMoniteur,
    body: `Pour juger une image, il faut un écran qui montre ce que le signal contient, ni plus ni moins. Un téléviseur de salon « embellit » : contraste poussé, couleurs saturées, netteté ajoutée. Le **moniteur de référence** suit la norme : les couleurs de la HD (primaires BT.709, blanc **D65**, autour de 6 500 K), la courbe d'affichage de la **BT.1886** (un gamma de **2,4**, qui déplie la courbe 0,45 de la caméra avec un léger surcroît de contraste voulu), le blanc à **100 cd/m²** (la candela par mètre carré mesure la lumière émise) dans une pièce sombre, avec un fond neutre d'environ 10 cd/m² derrière l'écran (BT.2035). Les moniteurs Grade 1 (EBU Tech 3320) sont ceux du contrôle de l'image.

Trois réglages, dans l'ordre. **La luminosité, à la PLUGE** : cette mire pose sur le noir trois petites barres, à **−2 %** (plus noire que le noir), **+2 %** et **+4 %**. On monte la luminosité jusqu'à voir la −2 %, puis on redescend jusqu'à ce qu'elle disparaisse : la +2 % doit rester juste visible. Le noir de l'écran est alors le noir du signal ; trop haut, l'écran montre des ombres que le signal n'a pas ; trop bas, il bouche des ombres qu'il a. **Le contraste, à la sonde** : un colorimètre posé sur le blanc 100 %, réglé à 100 cd/m². **La chroma, en bleu seul** : le moniteur n'affiche plus que sa voie bleue ; sur les barres, le gris, le cyan, le magenta et le bleu contiennent tous du bleu à 75 % : ils doivent avoir la même intensité. Des barres colorées plus claires que la grise, c'est une chroma trop forte. Puis on n'y touche plus : on règle les caméras en regardant le moniteur, jamais le moniteur sur les caméras.

Deux familles de **mires**. Les **mires électroniques** sont fabriquées par un appareil (les barres de la caméra, de la CCU, du générateur de synchro) : elles ne passent ni par l'objectif ni par la lumière, elles testent la **chaîne** (liaison, niveaux, couleurs, moniteurs) et identifient chaque source. Les **barres** à 75 % : sept bandes, dont la luminance dessine un escalier à la forme d'onde (75 · 70 · 59 · 54 · 21 · 16 · 5 %) et six taches au vectorscope ; les barres HD (SMPTE RP 219) portent en bas une PLUGE. Les **mires optiques** sont posées devant l'objectif et testent l'**image** : l'**étoile de Siemens** (des secteurs noirs et blancs qui s'affinent vers le centre ; plus l'image est floue, plus le disque gris du centre grandit) pour le point et le tirage ; la **charte grise** (onze paliers du noir au blanc) pour le noir, le gamma, le blanc et le raccord des caméras ; le **carton blanc** pour la balance.

- Quelle mire pour quel réglage : la liaison, les niveaux et le moniteur, les barres ; le point et le tirage, l'étoile ; le noir, le gamma et le raccord, la charte grise ; la balance, le carton blanc.
- Au line-up du car, chaque CCU envoie d'abord ses barres, puis chaque cadreur cadre la charte sous la lumière du stade.`,
    car: { text: 'Au poste vision, le moniteur Grade 1 montre l\'image de la caméra sélectionnée sur le RCP, à côté du PRISM, et bascule SDR | HDR : l\'ingénieur vision le contrôle à la PLUGE en début de journée, tout le line-up se juge dessus.', station: 'vision' },
    terms: ['mire-75', 'waveform'],
    competences: competencesDe(['moniteur', 'mires']),
    article: 'hdrguide',
    quiz: quizDe(['moniteur', 'mires'], [
      { q: 'En début de journée, au poste vision, on voit nettement les trois barres de la PLUGE, −2 % comprise. Que faut-il faire ?',
        choices: ['Baisser la luminosité du moniteur jusqu\'à ce que la −2 % disparaisse, la +2 % restant juste visible',
          ['Baisser le master black des caméras', 'Le moniteur se règle sur la mire, jamais les caméras sur le moniteur : la PLUGE vient d\'un générateur, pas d\'une caméra.'],
          ['Rien : plus on voit de barres, mieux c\'est', 'La −2 % est plus noire que le noir : si on la voit, l\'écran montre des ombres que le signal n\'a pas, et l\'on jugera les noirs trop clairs.']],
        answer: 0, why: 'La luminosité de l\'écran est trop haute. À la PLUGE, on monte jusqu\'à voir la −2 %, puis on redescend jusqu\'à ce qu\'elle disparaisse : la +2 % juste visible, le noir de l\'écran est le noir du signal.' },
    ]),
  },
  {
    id: 'camera-plusloin', title: 'Grand capteur, UHD et HDR, super ralenti', minutes: '11 min', partie: PLUS,
    camlab: ['grandcapteur', 'hdr', 'hfr'],
    essentials: [
      'Un **grand capteur** Super 35 (≈ 2,6 fois plus large que le 2/3") demande une focale 2,6 fois plus longue pour le même cadre, et donne 2,6 fois moins de **profondeur de champ** : le « look cinéma ». Le direct garde le **tri-capteur 2/3"** pour ses zooms, son point et sa lumière.',
      'L\'**UHD** a quatre fois plus de pixels (3 840 × 2 160, 12G-SDI) ; le **HDR HLG** (BT.2100) garde de la place au-dessus du blanc : le **blanc de référence** se pose à **75 %**, le gris 18 % à 38 % (BT.2408) ; la **BT.2020** élargit les couleurs.',
      'Le **super ralenti** filme à 150 (3×) ou 300 (6×) images par seconde, en **phases** vers le serveur : fluide relu à 33 % (3×), mais 1,6 diaphragme de lumière en moins, et le **scintillement** des lampes.',
    ],
    figure: () => figNotions(['grandcapteur', 'hdr'], 'Grand capteur ou tri-capteur, UHD et HDR'),
    demoTitle: 'Cadrez un visage de 50 cm à 3 m à f/2,8 : comparez les deux capteurs. Regardez où tombent le gris et le blanc en HLG. Passez le super ralenti de 1× à 6×.',
    demo: demoPlusLoin,
    body: `Deux façons de faire une caméra. Le **tri-capteur 2/3"** (la FB80, les caméras système du car) : un prisme et trois capteurs de 9,59 × 5,39 mm, des objectifs B4. Le **grand capteur Super 35** : un seul capteur d'environ 25 × 14 mm (ordre de grandeur, selon les caméras), à mosaïque de Bayer, avec des objectifs de cinéma à monture PL. Le Super 35 étant environ **2,6 fois plus large**, il faut une focale 2,6 fois plus longue pour le même cadre (58 mm en 2/3", 149 mm en Super 35 pour un visage de 50 cm à 3 m) ; et à la même ouverture, la **profondeur de champ** est environ 2,6 fois plus courte (16 cm contre 6 cm à f/2,8) : le sujet se détache du décor, c'est le « look cinéma ». Pour retrouver la même zone nette, il faut fermer de 2,6 fois en nombre f, près de trois diaphragmes : à image égale, les deux capteurs reçoivent la même lumière. Le direct garde le 2/3" pour ses **zooms** (8 à 1 000 mm à f/1,7 jusqu'à 340 mm, contre 25 à 1 000 mm en Super 35, de f/2,8 à f/5), pour son **point** (le cadreur suit seul un joueur qui court), pour sa **lumière** la nuit, et pour le parc existant (objectifs, fibres, CCU).

L'**UHD** (souvent dite 4K) fait **3 840 × 2 160** pixels, quatre fois la HD : en 2160p50, un **12G-SDI** (11,88 Gb/s) ou quatre liens 3G, et des capteurs qui ont vraiment ces pixels (photosites d'environ 2,5 µm sur un 2/3"). Le cercle de confusion est deux fois plus petit : une erreur de point qui passait en HD se voit ; à f/8, la diffraction couvre déjà quatre photosites. Le **HDR** élargit la plage de lumière : en SDR (BT.709), tout ce qui est plus lumineux que le blanc est écrêté ou tassé par le knee ; la courbe **HLG** (Hybrid Log-Gamma, BT.2100), racine dans les sombres et logarithme dans les hautes lumières, garde de la place au-dessus du blanc. En direct (BT.2408), le **blanc de référence** se pose à **75 %**, le gris 18 % à **38 %** ; de 75 à 100 %, il reste près de quatre fois plus de lumière de scène à coder, près de deux diaphragmes ; sur un écran HLG de 1 000 cd/m², le blanc de référence s'affiche à 203 cd/m². La **BT.2020** donne des primaires plus pures (des rouges et des verts que la HD ne sait pas coder). La HDC-5500 du car le fait d'origine ; la FB80, capteurs HD, peut sortir du HLG en HD et une image 4K agrandie (plus de pixels, pas plus de détails).

Le **super ralenti** : le serveur relit plus lentement, mais la sortie du car reste à 50 images par seconde. Une caméra normale relue à 33 % montre chaque image trois fois : le mouvement avance par à-coups. Une caméra **HFR** en prend davantage : **3×**, 150 images/s, fluide relu à 33 % ; **6×**, 300 images/s, fluide jusqu'à 16,7 %. Elle sort ses images sur plusieurs liaisons à 50 images/s, les **phases** (A : 1, 4, 7… ; B : 2, 5, 8… ; C : 3, 6, 9…), que le serveur enregistre sur autant d'entrées et recombine ; une phase oubliée, et le ralenti saute une image sur trois. Le prix : une image ne dure pas plus que l'intervalle entre deux images, 1/150 s à 3× : **1,6 diaphragme** de moins (2,6 à 6×) ; et les lampes qui battent à 100 Hz ne donnent plus la même lumière à chaque image : le ralenti **clignote**, d'où les projecteurs LED des stades.

- La règle du ralenti fluide : vitesse de relecture × cadence (en multiples de 50) ≥ 1.
- La HDC-5500 donne f/11 à 2 000 lux en 1080/50p ; à 3×, environ f/6,4.`,
    car: { text: 'Le car produit en UHD HDR (2160p50 HLG, 12G-SDI) avec ses HDC-5500 ; au poste vision, le moniteur Grade 1 bascule SDR | HDR et le PRISM a une entrée « HDR HLG » avec la ligne du blanc de référence à 75 %. Les caméras super ralenti 3× et 6× envoient leurs phases vers l\'EVS ; l\'écran du RCP affiche « HFR 3x ».', station: 'vision' },
    terms: ['hdr-hlg', 'cie1931'],
    competences: competencesDe(['grandcapteur', 'hdr', 'hfr']),
    article: 'hdrguide',
    quiz: quizDe(['grandcapteur', 'hdr', 'hfr'], [
      { q: 'Au stade, le réalisateur veut le super ralenti 3× de la CAM 6 relu à 25 % de la vitesse. Comment sera le mouvement ?',
        choices: [['Parfaitement fluide : la caméra filme en 3×', 'En 3×, la relecture est fluide jusqu\'à 33 % : à 25 %, il manque des images, certaines sont répétées.'],
          'Un peu saccadé : 25 % × 3 = 0,75, moins de 1, certaines images sont montrées deux fois',
          ['Impossible : un serveur ne relit pas un 3× sous 33 %', 'Le serveur relit à la vitesse qu\'on veut ; c\'est la fluidité qui se perd sous 33 %.']],
        answer: 1, why: 'Le ralenti reste fluide tant que la vitesse de relecture multipliée par la cadence (en multiples de 50) vaut au moins 1. En 3×, c\'est jusqu\'à 33 % ; à 25 %, il faudrait une caméra 4× ou plus.' },
    ]),
  },
];
