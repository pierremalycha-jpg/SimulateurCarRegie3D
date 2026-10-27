// @ts-check
import { el } from '../util.js';
import { canvas, slider, choice, readout } from './kit.js';
import { castOf } from '../camlab/optics.js';
import { code10, code8, mV, signalDe, oetf709, matrice, saturer, vecteur, BARRES, CARNATIONS, detail } from './camera_calc.js';
import { quizDe, competencesDe, figNotions, COUL, fond, ecrire, trait, nf } from './camera_kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « La caméra », partie « Le traitement de l'image » : du capteur aux nombres (quantification 10 bits,
// balance des blancs et des noirs, niveau du noir), les courbes (gamma, black gamma, knee, white clip, détail),
// la couleur (matrice, saturation) et les fichiers de réglage. Notions du module « La caméra en 3D » (champ
// camlab) ; calculs de cours/camera_calc.js (ITU-R BT.709 : OETF, 64–940 en 10 bits, Y'CbCr ; dominante d'une
// lumière par camlab/optics.js ; knee et white clip de la HXC-FB80, EBU R 103).
// ----------------------------------------------------------------------------------
const PARTIE = 'Le traitement de l\'image';
const rgbCss = (r, g, b) => `rgb(${[r, g, b].map((v) => Math.round(255 * Math.max(0, Math.min(1, v / 100)))).join(',')})`;

// ======================================================================================
// 1. Du capteur aux nombres : codes, balance, noir
// ======================================================================================
const BALANCES = { prst: { t: 'PRST (3 200 K)', T: 3200 }, ct: { t: 'COLOR TEMP. (5 600 K)', T: 5600 }, a: { t: 'A : balance mesurée', T: 0 } };
function demoNumerique(host) {
  const cv = canvas(720, 250, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let niv = 50, T = 5600, bal = 'prst', mb = 0, br = 0;
  const read = readout(['Code 10 bits', 'Code 8 bits', 'En millivolts', 'Zone de l\'échelle']);
  const read2 = readout(['Le noir posé à', 'Le blanc de la charte (R · V · B)', 'Le gris du milieu (R · V · B)']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const c = code10(niv);
    read.set('Code 10 bits', `${c} (64 + 876 × ${nf(niv / 100, 2)})`);
    read.set('Code 8 bits', `${code8(niv)} (16 + 219 × ${nf(niv / 100, 2)})`);
    read.set('En millivolts', `${nf(mV(niv), 0)} mV (700 mV = 100 %)`);
    read.set('Zone de l\'échelle', niv < 0 ? 'sous le noir (codes 4 à 63) : le bruit, des dépassements' : niv > 100 ? 'super-blancs (941 à 1 019) : des reflets ; la diffusion n\'accepte pas plus de 103 %' : 'l\'image, du noir (64) au blanc (940) ; 0 à 3 et 1 020 à 1 023 restent aux mots de synchronisation');
    // la charte de onze gris filmée : chaque voie reçoit la lumière × la dominante, puis le noir et la courbe
    const B = BALANCES[bal], k = B.T ? castOf(T, B.T) : [1, 1, 1];
    const steps = Array.from({ length: 11 }, (_, i) => (i === 0 ? 0.004 : 0.9 * Math.pow(i / 10, 2.2)));
    const sig = steps.map((L) => [signalDe(L * k[0], { black: mb + br, kneeOn: false, clip: 1.09 }), signalDe(L, { black: mb, kneeOn: false, clip: 1.09 }), signalDe(L * k[2], { black: mb, kneeOn: false, clip: 1.09 })]);
    fond(g, 720, 250);
    sig.forEach(([r, gg, b], i) => { g.fillStyle = rgbCss(r, gg, b); g.fillRect(20 + i * 62, 20, 60, 70); });
    ecrire(g, 'la charte de onze gris, vue par la caméra', 20, 14);
    // la parade : rouge, vert, bleu côte à côte
    const PY = (v) => 236 - Math.max(-7, Math.min(109, v)) / 109 * 120;
    for (const v of [0, 50, 100]) { trait(g, 20, PY(v), 700, PY(v), '#2a3238'); ecrire(g, v + ' %', 4, PY(v) + 4, { col: '#5a646c' }); }
    ['#ff5a4e', '#33c46c', '#4ca0ff'].forEach((col, ch) => {
      const x0 = 30 + ch * 228;
      g.strokeStyle = col; g.lineWidth = 2; g.beginPath();
      sig.forEach((s, i) => { const x = x0 + i * 20, y = PY(s[ch]); if (i) g.lineTo(x, y); else g.moveTo(x, y); g.lineTo(x + 16, y); });
      g.stroke();
    });
    ecrire(g, 'parade : R · V · B', 30, 108);
    read2.set('Le noir posé à', `${nf(sig[0][1], 1)} % (master black ${mb >= 0 ? '+' : '−'}${nf(Math.abs(mb) * 1000, 0)} ‰ de la lumière)`);
    read2.set('Le blanc de la charte (R · V · B)', sig[10].map((v) => nf(v, 0) + ' %').join(' · '));
    read2.set('Le gris du milieu (R · V · B)', sig[5].map((v) => nf(v, 0) + ' %').join(' · '));
    const ecartB = Math.abs(sig[10][0] - sig[10][2]), noir = sig[0][1];
    const v = ecartB > 3 ? ['ko', `Les trois voies ne sont pas à la même hauteur sur le blanc : dominante ${sig[10][0] > sig[10][2] ? 'orange' : 'bleue'}. Faites la balance des blancs (A), sous la lumière de la scène.`]
      : Math.abs(sig[0][0] - sig[0][1]) > 1 ? ['warn', 'Le noir rouge n\'est pas aligné sur les autres : les ombres se teintent. Iris fermé, en parade, les trois traces au même niveau.']
        : noir > 2.5 ? ['warn', 'Noir trop haut : un voile gris couvre l\'image (délavé). Posez-le entre 0 et 2 %.']
          : noir <= 0 && mb < 0 ? ['warn', 'Noir trop bas : les premiers gris rejoignent le noir (bouché), le détail des ombres est perdu.']
            : ['ok', 'Blanc neutre (R = V = B), noir posé entre 0 et 2 % : la caméra est prête à être raccordée aux autres.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' }, slider('Niveau de luminance', -7, 109, niv, 1, (v) => { niv = v; draw(); }, (v) => (v < 0 ? '−' : '') + Math.abs(v) + ' %')),
    read.el,
    el('div', { class: 'co-ctl' },
      slider('Lumière de la scène', 2500, 7000, T, 100, (v) => { T = v; draw(); }, (v) => nf(v) + ' K'),
      choice('Balance (WHITE BAL)', Object.entries(BALANCES).map(([k, b]) => [k, b.t]), bal, (v) => { bal = v; draw(); }),
      slider('Master black', -6, 10, mb * 1000, 1, (v) => { mb = v / 1000; draw(); }, (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' ‰'),
      slider('Noir rouge (BLACK R)', -4, 4, br * 1000, 1, (v) => { br = v / 1000; draw(); }, (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' ‰')),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'En haut, la charte de onze gris telle que la caméra la rend ; en bas, la parade : les trois voies, rouge, verte et bleue, côte à côte, palier par palier.')),
    verdict, read2.el);
  draw();
}

// ======================================================================================
// 2. Gamma, knee et détail : la courbe de la caméra
// ======================================================================================
const REPERES = [[0.02, 'ombre 2 %'], [0.18, 'gris 18 %'], [0.5, 'visage'], [1, 'blanc'], [4, 'fenêtre ×4']];
function demoCourbes(host) {
  const cv = canvas(720, 270, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const cv2 = canvas(720, 130, 'co-canvas co-smooth'), g2 = cv2.getContext('2d');
  let exp = 0.45, bk = 0, kp = 95, ks = 0.1, kon = true, wc = 103, dl = 0.5, cr = 0;
  const read = readout(REPERES.map(([, n]) => String(n)));
  const read2 = readout(['Liseré ajouté au contour', 'Sur le bruit des zones unies']);
  const verdict = el('p', { class: 'co-verdict' });
  const X0 = 50, X1 = 700, Y0 = 244, Y1 = 20;
  const X = (L) => X0 + Math.sqrt(Math.min(6, L) / 6) * (X1 - X0), Y = (v) => Y0 - Math.max(0, Math.min(115, v)) / 115 * (Y0 - Y1);
  const opts = () => ({ exp, bk, knee: kp / 100, slope: ks, kneeOn: kon, clip: wc / 100 });
  const draw = () => {
    fond(g, 720, 270);
    for (const v of [0, 25, 50, 75, 100]) { trait(g, X0, Y(v), X1, Y(v), '#1c2329'); ecrire(g, v + ' %', X0 - 6, Y(v) + 4, { align: 'right', col: '#5a646c' }); }
    trait(g, X0, Y(103), X1, Y(103), COUL.tally, 1, [4, 3]); ecrire(g, '103 % (EBU R 103)', X1 - 4, Y(103) - 4, { align: 'right', col: COUL.red });
    for (const L of [0, 0.18, 0.5, 1, 2, 4, 6]) { trait(g, X(L), Y0, X(L), Y0 + 4, COUL.grey); ecrire(g, nf(L * 100) + ' %', X(L), Y0 + 16, { align: 'center' }); }
    ecrire(g, 'lumière de la scène (100 % = le blanc nominal)', X1, 12, { align: 'right' });
    const curve = (fn, col, w, dash = null) => { g.strokeStyle = col; g.lineWidth = w; if (dash) g.setLineDash(dash); g.beginPath(); for (let i = 0; i <= 240; i++) { const L = 6 * (i / 240) ** 2; const y = Y(fn(L)); if (i) g.lineTo(X(L), y); else g.moveTo(X(L), y); } g.stroke(); g.setLineDash([]); };
    curve((L) => Math.min(109, oetf709(L) * 100), COUL.grey, 1.2, [5, 4]);
    curve((L) => signalDe(L, opts()), COUL.amber, 2.2);
    for (const [L, n] of REPERES) { const v = signalDe(/** @type {number} */ (L), opts()); g.fillStyle = COUL.cyan; g.beginPath(); g.arc(X(/** @type {number} */ (L)), Y(v), 4, 0, Math.PI * 2); g.fill(); read.set(/** @type {string} */ (n), `${nf(v, 1)} %${/** @type {number} */ (L) === 1 ? '' : ` (BT.709 seule : ${nf(Math.min(109, oetf709(/** @type {number} */ (L)) * 100), 1)} %)`}`); }
    ecrire(g, 'BT.709 seule (pointillés) · réglage de la caméra (ambre)', X0 + 6, Y1 + 4);
    // le détail sur un contour
    const N = 120, prof = Array.from({ length: N }, (_, i) => { const s = 1 / (1 + Math.exp(-(i - 60) / 2.2)); return 0.25 + 0.5 * s + ((Math.sin(i * 12.9898) * 43758.5453) % 1) * 0.012; });
    const out = detail(prof, dl, 0.12, cr / 100);
    fond(g2, 720, 130);
    const PX = (i) => 40 + i / (N - 1) * 640, PY = (v) => 118 - v * 110;
    g2.strokeStyle = COUL.grey; g2.lineWidth = 1; g2.beginPath(); prof.forEach((v, i) => (i ? g2.lineTo(PX(i), PY(v)) : g2.moveTo(PX(i), PY(v)))); g2.stroke();
    g2.strokeStyle = COUL.amber; g2.lineWidth = 2; g2.beginPath(); out.forEach((v, i) => (i ? g2.lineTo(PX(i), PY(v)) : g2.moveTo(PX(i), PY(v)))); g2.stroke();
    ecrire(g2, 'un contour (gris) et le même avec le détail (ambre)', 40, 14);
    const over = Math.max(...out) - Math.max(...prof), bruitIn = Math.max(...prof.slice(0, 40)) - Math.min(...prof.slice(0, 40)), bruitOut = Math.max(...out.slice(0, 40)) - Math.min(...out.slice(0, 40));
    read2.set('Liseré ajouté au contour', `${nf(over * 100, 1)} % de plus au bord clair (limiteur à 12 %)`);
    read2.set('Sur le bruit des zones unies', `${nf(bruitOut * 100, 1)} % de grain au lieu de ${nf(bruitIn * 100, 1)} %${cr > 0 ? ' : le seuil (crisp) le laisse tranquille' : ''}`);
    const fen = signalDe(4, opts()), blanc = signalDe(1, opts());
    const v = fen > 103.01 ? ['ko', 'Au-dessus de 103 % : le white clip est trop haut, la diffusion refusera ces crêtes (le légaliseur les couperait).']
      : !kon && fen >= wc - 0.01 ? ['warn', 'Sans knee, tout ce qui dépasse le blanc est coupé au white clip : la fenêtre devient un aplat, sans un nuage.']
        : blanc < 92 ? ['warn', 'Le knee mord sur les blancs du plateau : la chemise et la mire deviennent ternes. Remontez le point ou la pente.']
          : Math.abs(exp - 0.45) > 0.04 ? ['warn', `Gamma ${exp < 0.45 ? 'plus petit : tons moyens relevés, image plus claire et moins contrastée' : 'plus grand : tons moyens abaissés, image plus dense'}. Toutes les caméras doivent partir du même gamma.`]
            : ['ok', 'La courbe BT.709 répartit les tons, le knee garde du détail dans les hautes lumières, le white clip tient la limite.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Master gamma (exposant)', 0.35, 0.55, exp, 0.01, (v) => { exp = v; draw(); }, (v) => nf(v, 2)),
      slider('Black gamma', -1, 1, bk, 0.1, (v) => { bk = v; draw(); }, (v) => (v > 0 ? 'ouvre ' : v < 0 ? 'referme ' : '') + nf(Math.abs(v), 1)),
      choice('Knee', [['on', 'en service'], ['off', 'coupé']], 'on', (v) => { kon = v === 'on'; draw(); }),
      slider('Knee point', 80, 100, kp, 1, (v) => { kp = v; draw(); }, (v) => v + ' %'),
      slider('Pente du knee', 0.02, 1, ks, 0.02, (v) => { ks = v; draw(); }, (v) => nf(v, 2)),
      slider('White clip', 100, 109, wc, 0.5, (v) => { wc = v; draw(); }, (v) => nf(v, 1) + ' %')),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'La courbe de la caméra : la lumière de la scène en abscisse (resserrée vers les hautes lumières), le signal en ordonnée. Les points cyan sont les repères : une ombre, le gris 18 %, un visage, le blanc, une fenêtre quatre fois plus lumineuse.')),
    verdict, read.el,
    el('div', { class: 'co-ctl' },
      slider('Détail (LEVEL)', 0, 1.5, dl, 0.05, (v) => { dl = v; draw(); }, (v) => nf(v, 2)),
      slider('Seuil (CRISP)', 0, 3, cr, 0.1, (v) => { cr = v; draw(); }, (v) => nf(v, 1) + ' %')),
    el('figure', { class: 'co-figc' }, cv2, el('figcaption', {}, 'Un contour de l\'image, du sombre au clair, avec un peu de bruit : le détail ajoute l\'écart de chaque point à la moyenne de ses voisins.')),
    read2.el);
  draw();
}

// ======================================================================================
// 3. La matrice de couleurs : raccorder deux caméras au vectorscope
// ======================================================================================
const SUJETS = { maillot: [0.8, 0.08, 0.07, 'maillot rouge'], pelouse: [0.15, 0.5, 0.1, 'pelouse'], peau: [0.78, 0.55, 0.42, 'visage'], ciel: [0.3, 0.55, 0.9, 'ciel'], gris: [0.5, 0.5, 0.5, 'gris'] };
/** la caméra 2 voit le rouge un peu vers l'orange et le vert un peu terne (écart propre à son prisme, ordre de grandeur) */
const ERREUR_CAM2 = { rg: -0.1, gr: -0.08, gb: 0.06 };
function demoPeinture(host) {
  const cv = canvas(720, 330, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let suj = 'maillot', sat = 1, mrg = 0, mgr = 0, mgb = 0;
  const read = readout(['CAM 1 (référence)', 'CAM 2 (à raccorder)', 'Écart', 'Un gris sur la CAM 2']);
  const verdict = el('p', { class: 'co-verdict' });
  const C0 = 165, R0 = 150;
  const P = (cb, cr) => [C0 + cb / 0.5 * R0, C0 - cr / 0.5 * R0];
  const cam2 = (rgb) => { const m = matrice(matrice(rgb, ERREUR_CAM2), { rg: mrg, gr: mgr, gb: mgb }); return saturer(m[0], m[1], m[2], sat); };
  const cbcr = (r, g0, b) => { const y = 0.2126 * r + 0.7152 * g0 + 0.0722 * b; return /** @type {[number, number]} */ ([(b - y) / 1.8556, (r - y) / 1.5748]); };
  const draw = () => {
    fond(g, 720, 330);
    // le graticule : le cercle, la ligne des carnations, les cibles des barres 75 %
    g.strokeStyle = '#2a3238'; g.lineWidth = 1; g.beginPath(); g.arc(C0, C0, R0, 0, Math.PI * 2); g.stroke();
    trait(g, C0 - R0, C0, C0 + R0, C0, '#2a3238'); trait(g, C0, C0 - R0, C0, C0 + R0, '#2a3238');
    const a = CARNATIONS * Math.PI / 180; trait(g, C0, C0, C0 + Math.cos(a) * R0, C0 - Math.sin(a) * R0, '#a07050', 1, [4, 3]);
    for (const b of BARRES.slice(1)) { const [cb, cr] = cbcr(0.75 * b[1], 0.75 * b[2], 0.75 * b[3]); const [x, y] = P(cb, cr); g.strokeStyle = COUL.grey; g.strokeRect(x - 7, y - 7, 14, 14); ecrire(g, String(b[0]).slice(0, 3), x, y - 10, { align: 'center', col: '#5a646c' }); }
    const [r, gg, bb, nom] = /** @type {any} */ (SUJETS[suj]);
    const A = [r, gg, bb], B = cam2(A);
    const [xa, ya] = P(...cbcr(A[0], A[1], A[2])), [xb, yb] = P(...cbcr(B[0], B[1], B[2]));
    g.fillStyle = COUL.cyan; g.beginPath(); g.arc(xa, ya, 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = COUL.amber; g.lineWidth = 2.5; g.beginPath(); g.arc(xb, yb, 7, 0, Math.PI * 2); g.stroke();
    ecrire(g, 'vectorscope', 8, 14);
    // les deux caméras côte à côte, en écran partagé
    const css = (c) => `rgb(${c.map((v) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v)), 1 / 1.2))).join(',')})`;
    g.fillStyle = css(A); g.fillRect(380, 40, 160, 120); g.fillStyle = css(B); g.fillRect(540, 40, 160, 120);
    g.strokeStyle = COUL.grey; g.strokeRect(380, 40, 320, 120);
    ecrire(g, 'CAM 1', 460, 180, { align: 'center', col: COUL.cyan }); ecrire(g, 'CAM 2', 620, 180, { align: 'center', col: COUL.amber });
    ecrire(g, `écran partagé : ${nom}`, 380, 30);
    const va = vecteur(A[0], A[1], A[2]), vb = vecteur(B[0], B[1], B[2]);
    let da = vb.angle - va.angle; if (da > 180) da -= 360; if (da < -180) da += 360;
    read.set('CAM 1 (référence)', va.sat < 0.005 ? 'au centre : pas de couleur' : `teinte ${nf(va.angle, 0)}°, saturation ${nf(va.sat, 3)}`);
    read.set('CAM 2 (à raccorder)', vb.sat < 0.005 ? 'au centre : pas de couleur' : `teinte ${nf(vb.angle, 0)}°, saturation ${nf(vb.sat, 3)}`);
    read.set('Écart', va.sat < 0.005 ? '—' : `${da >= 0 ? '+' : '−'}${nf(Math.abs(da), 1)}° de teinte, saturation × ${nf(vb.sat / va.sat, 2)}`);
    const gr = cam2([0.5, 0.5, 0.5]), vg = vecteur(gr[0], gr[1], gr[2]);
    read.set('Un gris sur la CAM 2', vg.sat < 1e-6 ? 'reste au centre : la matrice et la saturation ne touchent pas aux gris' : `décalé de ${nf(vg.sat, 3)}`);
    // le raccord : toutes les couleurs à la fois, mesuré sur les six barres
    const pire = Math.max(...BARRES.slice(1).map((b) => { const c = [0.75 * b[1], 0.75 * b[2], 0.75 * b[3]], d = cam2(c); let x = vecteur(d[0], d[1], d[2]).angle - vecteur(c[0], c[1], c[2]).angle; if (x > 180) x -= 360; if (x < -180) x += 360; return Math.abs(x); }));
    ecrire(g, `barres : pire écart de teinte ${nf(pire, 1)}°`, 380, 210, { col: pire < 2 ? COUL.pvw : COUL.amber });
    const v = pire < 2 && Math.abs(sat - 1) < 0.06 ? ['ok', 'Les deux caméras se raccordent : chaque barre tombe au même endroit du vectorscope. On vérifie toujours un visage, sur la ligne des carnations.']
      : Math.abs(sat - 1) >= 0.06 ? ['warn', 'La saturation éloigne ou rapproche toutes les couleurs du centre, sans les faire tourner : réglez d\'abord la teinte à la matrice, la saturation ensuite.']
        : ['ko', 'Les teintes ne tombent pas au même endroit : la matrice de la CAM 2 fait tourner certaines couleurs. Corrigez R-G, G-R et G-B jusqu\'à moins de 2° sur toutes les barres.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Ce que filment les deux caméras', Object.entries(SUJETS).map(([k, s]) => [k, String(s[3])]), suj, (v) => { suj = v; draw(); }),
      slider('CAM 2 · R-G', -0.3, 0.3, mrg, 0.01, (v) => { mrg = v; draw(); }, (v) => nf(v, 2)),
      slider('CAM 2 · G-R', -0.3, 0.3, mgr, 0.01, (v) => { mgr = v; draw(); }, (v) => nf(v, 2)),
      slider('CAM 2 · G-B', -0.3, 0.3, mgb, 0.01, (v) => { mgb = v; draw(); }, (v) => nf(v, 2)),
      slider('CAM 2 · saturation', 0.6, 1.4, sat, 0.02, (v) => { sat = v; draw(); }, (v) => '× ' + nf(v, 2))),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'À gauche, le vectorscope : les cibles des barres 75 %, la ligne des carnations (pointillés), la couleur vue par la CAM 1 (disque cyan) et par la CAM 2 (cercle ambre). À droite, l\'écran partagé du moniteur de référence.')),
    verdict, read.el);
  draw();
}

/** @type {import('./index.js').Lesson[]} */
export const LECONS_IMAGE = [
  {
    id: 'camera-numerique', title: 'Du capteur aux nombres : quantification, balance, noir', minutes: '10 min', partie: PARTIE,
    camlab: ['quantif', 'balance', 'noir'],
    essentials: [
      'Le signal du capteur devient des **nombres de 10 bits** : **64** pour le noir (0 %), **940** pour le blanc (100 %), jusqu\'à 1 019 pour les reflets ; 0 à 3 et 1 020 à 1 023 restent au SDI.',
      'La **balance des noirs** (ABB, iris fermé) cale les trois noirs à zéro ; puis la **balance des blancs** (AWB, sur un carton sous la lumière de la scène) règle les gains rouge et bleu pour qu\'un blanc donne R = V = B.',
      'Le **master black** (pedestal) pose le noir : entre **0 et 2 %** à la forme d\'onde. Trop haut, l\'image se délave ; trop bas, les ombres se bouchent.',
    ],
    figure: () => figNotions(['quantif', 'balance'], 'La quantification 10 bits et la balance des blancs'),
    demoTitle: 'Promenez le niveau de −7 à 109 %. Puis éclairez au jour (5 600 K) avec la balance PRST, passez en A ; montez le master black, enfin décalez le noir rouge.',
    demo: demoNumerique,
    body: `Chaque photosite donne une charge, donc une tension, proportionnelle à la lumière reçue. Le **convertisseur analogique-numérique** la mesure et la range sur une échelle de marches : c'est la **quantification**. Tout ce qui suit dans la caméra (balance, gamma, knee, détail) est un calcul sur ces nombres. En sortie, l'échelle est de **10 bits** : 1 024 codes, de 0 à 1 023. La BT.709 n'en donne pas tous à l'image : **64** est le noir (0 %), **940** le blanc (100 %), avec 876 pas de 0,11 % entre les deux ; 4 à 63 sont les sous-noirs (jusqu'à −7 %), 941 à 1 019 les super-blancs (jusqu'à 109 %) ; 0 à 3 et 1 020 à 1 023 sont réservés aux mots de synchronisation du SDI. Code = 64 + 876 × niveau : un gris à 50 % est au code 502. En 8 bits, même principe : 16 et 235 (un code 8 bits vaut quatre codes 10 bits). Les instruments graduent aussi en millivolts, héritage de l'analogique : 700 mV pour 100 %.

Nos yeux s'adaptent à la lumière ; la caméra non. Sous une lampe tungstène, son capteur rouge reçoit bien plus que le bleu ; au jour, c'est le bleu qui domine. D'abord la **balance des noirs** (ABB) : l'iris se ferme, la caméra mesure ses trois voies dans l'obscurité et les ramène à zéro, pour que les ombres n'aient pas de teinte ; on la fait à la mise en service, après un changement de gain ou de température, et toujours avant le blanc. Puis la **balance des blancs** (AWB) : WHITE BAL sur A ou B, un carton blanc sous la lumière de la scène, plein centre, exposé vers 80 %, et la touche WHT : la caméra règle les gains des voies rouge et bleue pour que le blanc donne R = V = B, et garde le réglage dans sa mémoire. PRST est un préréglage à 3 200 K sans mesure (COLOR TEMP. le bascule à 5 600 K) : il dépanne, mais aucune lumière n'est exactement à 3 200 ou 5 600 K.

Reste à **poser le noir**. Iris fermé, un capteur ne donne pas tout à fait zéro ; la balance des noirs retire ce reste, puis la vision place le noir avec le **master black** (pedestal), qui ajoute ou retire un peu de signal aux trois couleurs à la fois. Le repère : le noir entre **0 et 2 %** à la forme d'onde. Trop haut (5 %), un voile gris couvre l'image, le contraste baisse : **délavé**. Trop bas, l'image ne descend pas sous le noir, mais tout ce qui était plus sombre que le décalage le rejoint (les plis d'un rideau, une tribune à l'ombre) : **bouché**. La courbe de la caméra étant très raide près du noir, le master black change beaucoup les ombres, un peu les tons moyens, presque pas le blanc. Les noirs rouge, vert et bleu se règlent aussi un par un, en parade : trois traces au même niveau.

- L'ordre : balance des noirs, balance des blancs, puis le noir posé ; pour toutes les caméras, sur la même charte et sous la même lumière : c'est le début du line-up.
- Une balance qui répond NG dit pourquoi : niveau trop bas ou trop haut, pas de blanc au centre, lumière hors de portée.`,
    car: { text: 'Au poste vision, la vision fait les balances de toutes les caméras au début, sur le même carton, puis pose les noirs au même repère : la bague du manche du RCP règle le master black, les molettes BLACK R, V, B les trois noirs, et le PRISM montre le bas de la forme d\'onde et de la parade.', station: 'vision' },
    terms: ['mv-pct', 'parade-rvb', 'waveform'],
    competences: competencesDe(['quantif', 'balance', 'noir']),
    article: 'mesures',
    quiz: quizDe(['quantif', 'balance', 'noir'], [
      { q: 'Au line-up, la CAM 3 vient de passer de 0 à +6 dB de gain. Sur la parade, ses ombres tirent légèrement au vert. Que fait la vision ?',
        choices: ['Une balance des noirs (ABB), iris fermé, puis elle vérifie le blanc',
          ['Une balance des blancs seulement', 'La balance des blancs règle les gains sur un blanc : elle ne touche pas au niveau des noirs de chaque voie, qui a bougé avec le gain.'],
          ['Elle baisse le master black jusqu\'à ce que le vert disparaisse', 'Le master black déplace les trois voies ensemble : la teinte reste, et le noir finit bouché.']],
        answer: 0, why: 'Le niveau de noir des trois voies change un peu avec le gain, et pas de la même façon dans chacune : après un changement de gain, on refait la balance des noirs, puis on contrôle le blanc et on repose le noir entre 0 et 2 %.' },
    ]),
  },
  {
    id: 'camera-courbes', title: 'Gamma, knee et détail', minutes: '10 min', partie: PARTIE,
    camlab: ['gamma', 'knee', 'detail'],
    essentials: [
      'Le **gamma** relève les tons sombres et moyens : la courbe BT.709 (exposant **0,45**) met le gris 18 % à **41 %** ; l\'écran déplie avec un gamma **2,4**. Le **black gamma** ouvre ou referme les seules ombres.',
      'Le **knee** plie la courbe au-dessus de son point (85 à 95 %, ordre de grandeur) pour garder du détail dans une fenêtre ; le **white clip** coupe net au plafond, souvent **103 %** (EBU R 103).',
      'Le **détail** ajoute un liseré aux contours : l\'image **paraît** plus piquée ; le **skin detail** l\'adoucit sur les seuls visages. Le bon réglage ne se remarque pas.',
    ],
    figure: () => figNotions(['gamma', 'knee'], 'La courbe de gamma et le coude du knee'),
    demoTitle: 'Coupez le knee et regardez la fenêtre ×4. Remettez-le, puis baissez son point à 80 %. Jouez du master gamma et du black gamma ; plus bas, montez le détail, puis le seuil CRISP.',
    demo: demoCourbes,
    body: `Le capteur est **linéaire** : deux fois plus de lumière, deux fois plus de signal. L'œil ne l'est pas, il distingue bien mieux les écarts dans les tons sombres. La caméra applique donc une **courbe de transfert** (OETF), le **gamma**, qui relève les tons sombres et moyens. La BT.709 la fixe : V = 1,099 × L^0,45 − 0,099, et une droite V = 4,5 × L tout près du noir (sous 1,8 % de lumière), pour ne pas amplifier le bruit sans limite. Le gris moyen (18 % de lumière) sort à **41 %**, une ombre à 2 % sort à 9 %. L'écran de référence fait l'inverse avec un exposant **2,4** (BT.1886) : il reste un léger surcroît de contraste, un gamma de bout en bout d'environ 1,2, voulu pour une pièce peu éclairée. Régler le **master gamma** : un exposant plus petit relève les tons moyens (image plus claire, moins contrastée), plus grand les abaisse ; le noir et le blanc ne bougent pas. Le **black gamma** ne change que le bas de la courbe : il **ouvre** les ombres (on voit dans la tribune à l'ombre) ou les **referme** ; le bruit des ombres suit.

Exposée pour un visage, la caméra voit une fenêtre en plein jour deux, quatre, huit fois plus lumineuse que le blanc du plateau. Sans rien d'autre, tout ce qui dépasse le plafond est coupé : un aplat blanc, sans un nuage. Le **knee** (le coude) plie la courbe au-dessus d'un **point** (souvent 85 à 95 %, ordre de grandeur) : le signal ne monte plus qu'avec une **pente** réduite. Avec un point à 90 % et une pente d'un pour dix, ce qui aurait donné 190 % de signal sort à 100 % : la fenêtre garde ses nuages, un peu tassés. Sous le point, rien ne change. Le **white clip** est le plafond : rien ne sort au-dessus. Le SDI porte jusqu'à 109 %, mais beaucoup de diffuseurs n'acceptent pas plus d'environ 103 % (EBU R 103). Le knee garde le détail, le white clip garantit la limite. Un knee point trop bas ternit les blancs du plateau ; une pente trop faible fait de la fenêtre un aplat gris.

Le **détail** cherche les contours, là où la luminance change vite, et ajoute à chaque point son écart à la moyenne de ses voisins : un liseré clair du côté clair, sombre du côté sombre. L'image n'est pas plus nette (l'objectif et le capteur n'ont rien gagné), elle **paraît** plus piquée, ce qui compense la douceur de l'objectif, du filtre passe-bas et de l'écran. Ses réglages : **LEVEL** (la quantité), **LIMITER** (la hauteur maximale des liserés), **CRISP** (un seuil sous lequel le bruit et le grain ne reçoivent rien). Le **skin detail** repère la teinte de la peau et y réduit le détail : le visage s'adoucit, les cheveux, les yeux et le décor restent piqués. Trop de détail : des liserés autour des joueurs, un bruit qui grésille, une image « électronique ».

- Toutes les caméras partent du même gamma (celui de leur fichier de référence) : sinon la pelouse change de densité à chaque coupe.
- Couper le gamma (OFF) montre le signal linéaire : le gris moyen sort à 18 %, l'image est sombre et dure.`,
    car: { text: 'Au poste vision, MASTER GAMMA, BLACK GAMMA, KNEE POINT (95 % par défaut) et WHITE CLIP (103 %) sont sur l\'écran du RCP, page GAMMA / KNEE ; les touches GAMMA et KNEE les coupent, et l\'on voit aussitôt l\'effet au moniteur et à la forme d\'onde du PRISM. Un maillot blanc au soleil, le ciel derrière la tribune : on garde leur détail au knee.', station: 'vision' },
    terms: ['waveform', 'gamut'],
    competences: competencesDe(['gamma', 'knee', 'detail']),
    article: 'mesures',
    quiz: quizDe(['gamma', 'knee', 'detail'], [
      { q: 'Le contrôle qualité de la chaîne signale des crêtes de luminance à 107 % sur la CAM 2, à chaque plan sur un maillot blanc au soleil. Que règle la vision ?',
        choices: ['Le white clip de la CAM 2, à 103 %, et le knee pour garder le détail du maillot',
          ['Le gamma, pour assombrir l\'image', 'Le gamma laisse le blanc à sa place : il ne change que la répartition des tons moyens, les crêtes resteraient à 107 %.'],
          ['Rien : le SDI accepte jusqu\'à 109 %', 'Le SDI porte 109 %, mais la diffusion n\'accepte pas plus d\'environ 103 % (EBU R 103) : le légaliseur couperait plus loin, sans soin.']],
        answer: 0, why: 'Le white clip est le plafond du signal : à 103 %, aucune crête ne passe au-dessus. Le knee, plus bas, comprime ce qui dépasse son point pour que le maillot garde ses plis au lieu d\'un aplat.' },
    ]),
  },
  {
    id: 'camera-peinture', title: 'La matrice de couleurs et les fichiers de réglage', minutes: '9 min', partie: PARTIE,
    camlab: ['matrice', 'fichiers'],
    essentials: [
      'La **matrice** mélange les trois voies (neuf coefficients) pour que les couleurs tombent sur les primaires BT.709 ; elle fait **tourner** les teintes au vectorscope sans toucher aux **gris**.',
      'La **saturation** rapproche ou éloigne toutes les couleurs du centre, sans changer leur teinte ; on **raccorde** deux caméras sur une caméra de référence : même mire, même lumière, mêmes points au vectorscope, puis un visage.',
      'Les **fichiers** gardent les réglages : **scène** (la peinture d\'une situation, cinq fichiers), **référence** (la base validée par la maintenance), **objectif**, **opérateur** (le viseur du cadreur).',
    ],
    figure: () => figNotions(['matrice', 'fichiers'], 'La matrice de couleurs et les fichiers de réglage'),
    demoTitle: 'Le maillot rouge tire vers l\'orange sur la CAM 2 : corrigez R-G, puis G-R et G-B jusqu\'à ce que toutes les barres tombent à moins de 2°. Filmez ensuite un gris, puis un visage ; essayez la saturation.',
    demo: demoPeinture,
    body: `Les filtres du prisme ne séparent pas la lumière exactement comme les primaires de la norme : le capteur rouge voit un peu de vert, le vert un peu de rouge et de bleu. La caméra corrige en **mélangeant** ses trois voies : chaque couleur de sortie est faite d'un peu de chaque voie d'entrée. Ce calcul à neuf coefficients, c'est la **matrice**, réglée en usine pour les primaires de la HD (BT.709). Les réglages de la **matrice utilisateur** (R-G, R-B, G-R, G-B, B-R, B-G) ajoutent à une voie une part de sa différence avec une autre : sur un blanc ou un gris, les trois voies sont égales, les différences sont nulles, **rien ne change** ; la balance reste juste, seules les couleurs **tournent**. La **saturation**, elle, rapproche toutes les couleurs du gris ou les en éloigne, sans changer leur teinte ni leur luminance.

Au **vectorscope**, la teinte est l'angle autour du centre et la saturation la distance au centre ; les visages, quelle que soit la peau, se rangent près d'une même direction, la **ligne des carnations**, vers 123°. Deux modèles, deux marques ou deux caméras d'âge différent ne rendent pas le même rouge : un maillot tire vers l'orange sur l'une, vers le magenta sur l'autre. On **raccorde** (matching) : une caméra de référence, souvent la caméra 1, à laquelle on ne touche plus ; la même mire filmée par les deux sous la même lumière ; la matrice de l'autre réglée jusqu'à ce que ses couleurs tombent sur les mêmes points du vectorscope, la saturation ensuite ; et toujours un visage pour finir, au moniteur de référence en écran partagé.

Une caméra a des dizaines de réglages : les refaire à chaque changement de lumière prendrait des heures. Le menu FILE les range dans des **fichiers**. Le **fichier de scène** (cinq par caméra) garde la peinture d'une situation : gamma, knee, détail, couleurs ; STORE puis le numéro pour l'enregistrer, le numéro seul pour le rappeler, et toute la peinture revient d'un coup. Le **fichier de référence** est la base de la caméra, réglée et validée par la maintenance : on en repart avant un line-up. Le **fichier d'objectif** garde les corrections propres à un objectif ; le **fichier opérateur** les réglages du viseur du cadreur (zébra, marqueurs, menu USER). Qui touche à quoi : le cadreur a son fichier opérateur, la vision ses fichiers de scène ; la référence et les objectifs sont l'affaire de la maintenance. FILE CLEAR revient aux valeurs d'usine et efface aussi ce qui était juste.

- Au stade, un fichier de scène par situation et par caméra : le soleil, l'ombre, la nuit, l'éclairage du stade.
- Un visage qui change de teinte d'une caméra à l'autre se voit tout de suite : c'est le dernier contrôle du raccord.`,
    car: { text: 'Au line-up, toutes les HDC se raccordent sur la CAM 1 au vecteurscope du PRISM. Au poste vision, SATURATION est sur l\'écran du RCP et la touche MATRIX coupe la matrice ; la page SCÈNES garde cinq fichiers par caméra (STORE, RECALL) : quand le soleil passe derrière la tribune, un geste et la caméra reprend tout son réglage.', station: 'vision' },
    terms: ['vecteurscope', 'mire-75'],
    competences: competencesDe(['matrice', 'fichiers']),
    article: 'hdrguide',
    quiz: quizDe(['matrice', 'fichiers'], [
      { q: 'Au stade, la CAM 5 (un autre modèle que les autres) rend les maillots sang plus orangés que la CAM 1. Le gris de la charte est pourtant au centre du vectorscope sur les deux. Que règle la vision ?',
        choices: ['La matrice de la CAM 5, sur la même mire que la CAM 1, jusqu\'à ce que les teintes tombent au même endroit',
          ['La balance des blancs de la CAM 5', 'Le gris est déjà au centre : la balance est juste. Le défaut tient à la façon de rendre une couleur, pas le blanc.'],
          ['La saturation de la CAM 5', 'La saturation éloigne ou rapproche les couleurs du centre sans les faire tourner : l\'orange resterait orange.']],
        answer: 0, why: 'Un gris juste et une couleur qui tourne : c\'est la matrice. Elle fait tourner les teintes sans toucher aux gris ; on la règle sur la caméra de référence, à la même mire, puis on vérifie un visage.' },
    ]),
  },
];
