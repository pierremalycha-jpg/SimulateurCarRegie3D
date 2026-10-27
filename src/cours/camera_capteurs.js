// @ts-check
import { el } from '../util.js';
import { canvas, slider, choice, readout } from './kit.js';
import { ND, dofLimits, castOf, kelvinRGB } from '../camlab/optics.js';
import { irisPour, diaphND, diaphGain, diaphShutter, bilanExposition, snrGain, snrPhotons, bouge, battements, scintille, mired, ecartMired, focaleMoire, photosite, Y709, RASTERS, debitSDI, signalDe, SENSIBILITE } from './camera_calc.js';
import { quizDe, competencesDe, figNotions, COUL, fond, ecrire, trait, nf, metres, fN } from './camera_kit.js';

// ----------------------------------------------------------------------------------
// Chapitre « La caméra », partie « Filtres, prisme et capteurs » : les filtres (ND, température de couleur, passe-bas
// et infrarouge), le prisme et les trois capteurs (et les formats), puis l'exposition, qui réunit iris, ND, gain et
// obturateur. Notions du module « La caméra en 3D » (champ camlab) ; calculs de cours/camera_calc.js (sensibilité
// de la HXC-FB80, f/13 à 2 000 lux en 50 Hz ; 60 dB de rapport signal sur bruit ; ND 1/4, 1/16, 1/64 ; mireds ;
// Nyquist sur des photosites de 5 µm ; débits SDI) et camlab/optics.js (lumière du corps noir, dominante).
// ----------------------------------------------------------------------------------
const PARTIE = 'Filtres, prisme et capteurs';
/** une couleur linéaire (0 à 1) en couleur d'écran (sRGB approché) */
const css = (r, g, b) => { const k = Math.max(1, r, g, b); const t = (v) => Math.round(255 * Math.pow(Math.max(0, Math.min(1, v / k)), 1 / 2.2)); return `rgb(${t(r)},${t(g)},${t(b)})`; };

// ======================================================================================
// 1. Les filtres : ND et iris, température de couleur, moiré
// ======================================================================================
const SCENES = { plateau: { lux: 400, t: 'plateau éclairé' }, salle: { lux: 1000, t: 'salle très éclairée' }, couvert: { lux: 10000, t: 'ciel couvert' }, soleil: { lux: 50000, t: 'plein soleil' } };
function demoFiltres(host) {
  const cv = canvas(720, 150, 'co-canvas co-smooth'), g = cv.getContext('2d');
  const cv2 = canvas(720, 120, 'co-canvas co-smooth'), g2 = cv2.getContext('2d');
  let sc = 'couvert', nd = 0, T = 3200, cc = 5600, P = 3.9, D = 8, f = 12;
  const read = readout(['Iris qui expose la scène', 'Ce que retire le filtre', 'Où tombe l\'iris']);
  const read2 = readout(['Écart de couleur', 'Dominante sans balance (gains R et B)', 'Ce qui reste à la balance']);
  const read3 = readout(['Le motif sur le capteur', 'Focale où le moiré guette']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const S = SCENES[sc], t = ND[nd][1], N = irisPour(S.lux, t);
    // l'échelle des nombres f, de f/1,8 à f/22 : la zone où l'objectif est à son meilleur, l'iris qu'il faudrait
    fond(g, 720, 150);
    const stops = [1.4, 1.8, 2.8, 4, 5.6, 8, 11, 16, 22, 32, 45], X = (n) => 40 + Math.log2(n / 1.4) * 2 / Math.log2(45 / 1.4) / 2 * 640;
    g.fillStyle = 'rgba(51,196,108,.25)'; g.fillRect(X(4), 50, X(5.6) - X(4), 40);
    g.fillStyle = 'rgba(255,211,138,.12)'; g.fillRect(X(2.8), 50, X(8) - X(2.8), 40);
    g.fillStyle = 'rgba(240,55,44,.18)'; g.fillRect(40, 50, X(1.8) - 40, 40); g.fillRect(X(16), 50, 680 - X(16), 40);
    trait(g, 40, 90, 680, 90, COUL.grey);
    for (const n of stops) { trait(g, X(n), 86, X(n), 94, COUL.grey); ecrire(g, fN(n), X(n), 108, { align: 'center' }); }
    ecrire(g, 'objectif : f/1,8 à f/16', X(1.8), 124); ecrire(g, 'le meilleur piqué', (X(4) + X(5.6)) / 2, 44, { align: 'center', col: COUL.pvw });
    const xn = X(Math.max(1.4, Math.min(45, N)));
    trait(g, xn, 40, xn, 96, COUL.amber, 3);
    ecrire(g, `il faudrait ${fN(N)}`, Math.min(640, Math.max(70, xn)), 30, { align: 'center', col: COUL.amber, font: '600 12px Arial, sans-serif' });
    ecrire(g, `${S.t}, ${nf(S.lux)} lux · filtre ${ND[nd][0]}`, 40, 18, { col: COUL.blanc });
    read.set('Iris qui expose la scène', `${fN(N)} : N = 13 × √(${nf(S.lux)} ÷ 2 000 × ${t === 1 ? '1' : '1/' + nf(1 / t)})`);
    read.set('Ce que retire le filtre', t === 1 ? 'rien (CLEAR)' : `${nf(diaphND(t))} diaphragmes : il laisse passer 1/${nf(1 / t)} de la lumière (densité ${nf(-Math.log10(t), 1)})`);
    read.set('Où tombe l\'iris', N > 16 ? `au-delà de f/16 : trop de lumière de ${nf(2 * Math.log2(N / 16), 1)} diaphragme(s), même iris fermé` : N < 1.8 ? `sous f/1,8 : il manque ${nf(2 * Math.log2(1.8 / N), 1)} diaphragme(s), il faudra du gain` : N >= 4 && N <= 5.6 ? 'dans la zone du meilleur piqué' : N >= 2.8 && N <= 8 ? 'dans la zone de travail' : N > 8 ? 'très fermé : la diffraction adoucit l\'image, la profondeur de champ devient énorme' : 'très ouvert : peu de profondeur de champ');
    const v = N > 8 ? ['warn', `Trop de lumière pour cet iris : passez à un ND plus dense. Chaque cran de la roue retire deux diaphragmes.`] : N < 2.8 && t < 1 ? ['warn', 'Le filtre est trop dense pour la scène : revenez vers CLEAR avant de penser au gain.'] : N < 1.8 ? ['ko', 'Même grand ouvert et sans filtre, il manque de la lumière : il faudra du gain (leçon L\'exposition).'] : ['ok', 'Le filtre a retiré la lumière en trop : l\'iris reste à sa meilleure place, et la vision finit au manche.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
    // la couleur de la lumière, le carton blanc vu par la caméra, et après la balance
    fond(g2, 720, 120);
    const L = kelvinRGB(T), cast = castOf(T, cc);
    const patch = (x, c, label) => { g2.fillStyle = c; g2.fillRect(x, 20, 200, 64); g2.strokeStyle = COUL.grey; g2.strokeRect(x, 20, 200, 64); ecrire(g2, label, x + 100, 104, { align: 'center' }); };
    patch(20, css(L[0], L[1], L[2]), `la lumière : ${nf(T)} K`);
    patch(260, css(cast[0], 1, cast[2]), `le carton blanc, caméra réglée à ${nf(cc)} K`);
    patch(500, css(1, 1, 1), 'après la balance des blancs : R = G = B');
    const dm = ecartMired(T, cc);
    read2.set('Écart de couleur', `${nf(Math.abs(dm), 0)} mired (${nf(mired(T), 0)} contre ${nf(mired(cc), 0)}) : ${Math.abs(dm) < 10 ? 'à peine visible' : dm > 0 ? 'la lumière est plus chaude (orange) que le réglage' : 'la lumière est plus froide (bleue) que le réglage'}`);
    read2.set('Dominante sans balance (gains R et B)', `R × ${nf(cast[0], 2)}, B × ${nf(cast[2], 2)} pour V = 1`);
    read2.set('Ce qui reste à la balance', Math.abs(dm) < 30 ? 'une petite correction : le CC électronique est bien choisi' : `une grande correction : rapprochez le CC de la lumière (${[3200, 4300, 5600, 6300].reduce((a, b) => (Math.abs(ecartMired(T, b)) < Math.abs(ecartMired(T, a)) ? b : a))} K) avant la balance`);
    // le moiré
    const per = P * f / (D * 1000) / (photosite() / 1000);
    read3.set('Le motif sur le capteur', `une période de ${nf(P, 1)} mm à ${metres(D)} tombe sur ${nf(per, 1)} photosite(s) : ${per < 2 ? 'moins de deux, le motif se replie : moiré' : 'au moins deux, il est compté juste'}`);
    read3.set('Focale où le moiré guette', `en dessous de ${nf(focaleMoire(P, D), 1)} mm (plus large), le motif devient plus fin que deux photosites`);
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('La scène', Object.entries(SCENES).map(([k, s]) => [k, s.t, `${s.lux} lux, ordre de grandeur`]), sc, (v) => { sc = v; draw(); }),
      choice('Roue des filtres (FILTER)', ND.map(([n], i) => [String(i), `${i + 1} ${n}`]), '0', (v) => { nd = +v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'L\'échelle des nombres f : en vert, la zone du meilleur piqué ; en rouge, ce que l\'objectif ne sait pas faire. Le trait ambre est l\'iris qui exposerait juste la scène.')),
    verdict, read.el,
    el('div', { class: 'co-ctl' },
      slider('Température de la lumière', 2000, 10000, T, 100, (v) => { T = v; draw(); }, (v) => nf(v) + ' K'),
      choice('CC électronique (COLOR TEMP.)', [3200, 4300, 5600, 6300].map((k) => [String(k), nf(k) + ' K']), String(cc), (v) => { cc = +v; draw(); })),
    el('figure', { class: 'co-figc' }, cv2, el('figcaption', {}, 'La couleur d\'une lumière blanche (le corps noir), ce que la caméra fait d\'un carton blanc sans balance, puis après.')),
    read2.el,
    el('div', { class: 'co-ctl' },
      slider('Période du motif (mur LED, chemise rayée)', 1, 10, P, 0.1, (v) => { P = v; draw(); }, (v) => nf(v, 1) + ' mm'),
      slider('Distance', 1, 30, D, 0.5, (v) => { D = v; draw(); }, (v) => metres(v)),
      slider('Focale', 4.5, 54, f, 0.5, (v) => { f = v; draw(); }, (v) => nf(v, 1) + ' mm')),
    read3.el);
  draw();
}

// ======================================================================================
// 2. Le prisme et les trois capteurs (bruit de photons, formats)
// ======================================================================================
const COULEURS = { pelouse: [0.12, 0.45, 0.08, 'la pelouse'], maillot: [0.8, 0.06, 0.05, 'un maillot rouge'], ciel: [0.35, 0.6, 1, 'le ciel'], peau: [0.75, 0.5, 0.38, 'un visage'], blanc: [0.9, 0.9, 0.9, 'un blanc'] };
function demoPrisme(host) {
  const cv = canvas(720, 200, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let col = 'maillot', e = 10000, fmt = '1080p50';
  const read = readout(['Capteur rouge · vert · bleu', 'Luminance Y', 'Avec un seul capteur à mosaïque (Bayer)']);
  const read2 = readout(['Bruit de photons', 'Rapport signal sur bruit']);
  const read3 = readout(['Format', 'Débit sur le câble', 'Liaison']);
  const draw = () => {
    const [r, gg, b, nom] = /** @type {any} */ (COULEURS[col]);
    fond(g, 720, 200);
    // la lumière entre, le bleu est réfléchi d'abord, puis le rouge ; le vert traverse
    g.fillStyle = 'rgba(76,195,230,.14)'; g.strokeStyle = COUL.cyan; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(250, 40); g.lineTo(420, 40); g.lineTo(420, 160); g.lineTo(250, 160); g.closePath(); g.fill(); g.stroke();
    trait(g, 280, 160, 330, 40, COUL.cyan, 2.5); trait(g, 360, 40, 400, 160, COUL.cyan, 2.5);
    g.fillStyle = css(r, gg, b); g.fillRect(40, 84, 60, 32); ecrire(g, nom, 70, 134, { align: 'center' });
    trait(g, 100, 100, 304, 100, '#f3f1e8', 4);
    trait(g, 304, 100, 300, 20, '#4ca0ff', 4); trait(g, 304, 100, 380, 100, '#ffd27a', 4);
    trait(g, 380, 100, 384, 186, '#ff5a4e', 4); trait(g, 380, 100, 520, 100, COUL.pvw, 4);
    const sensor = (x, y, w, h, c, v, lab) => { g.fillStyle = `rgba(${c},${0.15 + 0.85 * v})`; g.fillRect(x, y, w, h); g.strokeStyle = `rgb(${c})`; g.strokeRect(x, y, w, h); ecrire(g, `${lab} ${nf(v * 100)} %`, x + w + 8, y + h / 2 + 4, { col: `rgb(${c})` }); };
    sensor(280, 6, 44, 12, '76,160,255', b, 'bleu');
    sensor(520, 92, 12, 18, '51,196,108', gg, 'vert');
    sensor(366, 186, 44, 10, '255,90,78', r, 'rouge');
    ecrire(g, 'surfaces dichroïques', 335, 176, { align: 'center', col: COUL.cyan });
    const Y = Y709(r, gg, b);
    read.set('Capteur rouge · vert · bleu', `${nf(r * 100)} % · ${nf(gg * 100)} % · ${nf(b * 100)} % : chacun l'image complète de sa couleur, 1 920 × 1 080`);
    read.set('Luminance Y', `${nf(Y * 100)} % = 0,2126 R + 0,7152 V + 0,0722 B : le vert porte ${nf(0.7152 * gg / Math.max(1e-6, Y) * 100)} % de cette luminance`);
    read.set('Avec un seul capteur à mosaïque (Bayer)', 'un photosite sur quatre voit le rouge, un sur quatre le bleu, deux sur quatre le vert : la caméra devine le reste, et les filtres absorbent la lumière que le prisme trie');
    const n = e, bruit = Math.sqrt(n);
    read2.set('Bruit de photons', `${nf(n)} électrons ± ${nf(bruit)} : ${nf(bruit / n * 100, 1)} %${n >= 30000 ? ' ; le puits est plein (quelques dizaines de milliers d\'électrons) : blanc écrêté' : ''}`);
    read2.set('Rapport signal sur bruit', `${nf(snrPhotons(n), 0)} dB pour ce photosite seul (la caméra annonce 60 dB, bruit de lecture compris, au niveau nominal)`);
    const R = RASTERS[fmt];
    read3.set('Format', `${fmt} : ${fmt.startsWith('2160') ? '3 840 × 2 160' : fmt.startsWith('720') ? '1 280 × 720' : '1 920 × 1 080'}, ${fmt.includes('i') ? '25 images de deux trames par seconde' : '50 images entières par seconde'}`);
    read3.set('Débit sur le câble', `${nf(R.ech)} × ${nf(R.lignes)} × ${R.ips} × 20 bits = ${nf(debitSDI(/** @type {any} */ (fmt)), 3)} Gb/s (suppression comprise)`);
    read3.set('Liaison', R.lien);
  };
  host.append(
    el('div', { class: 'co-ctl' }, choice('Ce qu\'on filme', Object.entries(COULEURS).map(([k, c]) => [k, String(c[3])]), col, (v) => { col = v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le bloc prisme : la première surface renvoie le bleu, la seconde le rouge, le vert traverse. Chaque capteur s\'allume à la part de sa couleur.')),
    read.el,
    el('div', { class: 'co-ctl' },
      slider('Lumière reçue par un photosite', 0, 100, Math.round(Math.log(e / 50) / Math.log(600) * 100), 1, (v) => { e = Math.round(50 * Math.pow(600, v / 100)); draw(); }, (v) => `${nf(Math.round(50 * Math.pow(600, v / 100)))} électrons`),
      choice('Format', Object.keys(RASTERS).map((k) => [k, k]), fmt, (v) => { fmt = v; draw(); })),
    read2.el, read3.el);
  draw();
}

// ======================================================================================
// 3. L'exposition : iris, ND, gain, obturateur, et le prix de chacun
// ======================================================================================
const IRIS = [1.8, 2, 2.8, 4, 5.6, 8, 11, 16];
const GAINS = [-3, 0, 3, 6, 9, 12];
const SHUTTERS = [['50', 'OFF (1/50)'], ['60', '1/60'], ['100', '1/100 (ECS)'], ['125', '1/125'], ['250', '1/250'], ['500', '1/500'], ['1000', '1/1000'], ['2000', '1/2000']];
/** lux d'une position de curseur (0 à 100) : de 20 à 100 000 lux */
const luxDe = (v) => Math.round(20 * Math.pow(5000, v / 100));
function demoExposition(host) {
  const cv = canvas(720, 230, 'co-canvas co-smooth'), g = cv.getContext('2d');
  let vl = 40, ki = 4, nd = 0, gi = 1, sh = '50';
  const read = readout(['Le blanc nominal sort à', 'Profondeur de champ (20 mm, point à 3 m)', 'Bruit', 'Un ballon à 5 m/s pendant la pose', 'Lampes sur le secteur 50 Hz']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const lux = luxDe(vl), N = IRIS[ki], t = ND[nd][1], gain = GAINS[gi], ts = 1 / +sh;
    const parts = [
      ['la scène', Math.log2(lux / SENSIBILITE.lux), COUL.cyan],
      ['l\'iris', 2 * Math.log2(SENSIBILITE.N / N), COUL.amber],
      ['le filtre ND', -diaphND(t), '#b0b8c0'],
      ['le gain', diaphGain(gain), COUL.red],
      ['le shutter', -diaphShutter(ts), COUL.green],
    ];
    const tot = bilanExposition({ lux, N, nd: t, gainDb: gain, t: ts });
    fond(g, 720, 230);
    const X0 = 360, k = 24, Xs = (v) => X0 + Math.max(-14, Math.min(14, v)) * k;
    trait(g, X0, 14, X0, 206, COUL.blanc, 1, [3, 3]);
    for (let s = -12; s <= 12; s += 2) ecrire(g, (s > 0 ? '+' : '') + nf(s), Xs(s), 222, { align: 'center' });
    ecrire(g, 'diaphragmes par rapport à f/13 à 2 000 lux (la sensibilité de la caméra)', 10, 12);
    parts.forEach(([nom, v, c], i) => {
      const y = 24 + i * 30, a = Xs(0), b = Xs(/** @type {number} */ (v));
      g.fillStyle = /** @type {string} */ (c); g.globalAlpha = 0.75; g.fillRect(Math.min(a, b), y, Math.max(2, Math.abs(b - a)), 20); g.globalAlpha = 1;
      ecrire(g, `${nom} ${/** @type {number} */ (v) >= 0 ? '+' : '−'}${nf(Math.abs(/** @type {number} */ (v)), 1)}`, /** @type {number} */ (v) >= 0 ? a - 6 : a + 6, y + 14, { align: /** @type {number} */ (v) >= 0 ? 'right' : 'left', col: COUL.blanc });
    });
    const y = 24 + 5 * 30, b = Xs(tot);
    g.fillStyle = Math.abs(tot) <= 0.34 ? COUL.pvw : COUL.tally; g.fillRect(Math.min(X0, b), y, Math.max(3, Math.abs(b - X0)), 22);
    ecrire(g, `total ${tot >= 0 ? '+' : '−'}${nf(Math.abs(tot), 1)} : ${Math.abs(tot) <= 0.34 ? 'exposé juste' : tot > 0 ? 'trop clair' : 'trop sombre'}`, tot >= 0 ? X0 - 6 : X0 + 6, y + 15, { align: tot >= 0 ? 'right' : 'left', col: COUL.blanc, font: '600 12px Arial, sans-serif' });
    const blanc = signalDe(Math.pow(2, tot), { kneeOn: false, clip: 1.09 });
    read.set('Le blanc nominal sort à', `${nf(blanc, 0)} %${blanc >= 108.9 ? ' : écrêté' : blanc < 60 ? ' : image sombre' : ''}`);
    const [near, far] = dofLimits(20, N, 3);
    read.set('Profondeur de champ (20 mm, point à 3 m)', `${metres(near)} à ${metres(far)}`);
    read.set('Bruit', `${nf(snrGain(gain))} dB de rapport signal sur bruit${gain > 0 ? ` : ${nf(10 ** (gain / 20), 1)} fois plus de bruit qu'à 0 dB` : ''}`);
    read.set('Un ballon à 5 m/s pendant la pose', `il avance de ${metres(bouge(5, ts))} : ${ts >= 1 / 60 ? 'une traînée, le mouvement est fluide' : ts >= 1 / 250 ? 'presque net' : 'net, mais le mouvement saccade d\'une image à l\'autre'}`);
    read.set('Lampes sur le secteur 50 Hz', `${nf(battements(ts), 2)} battement(s) à 100 Hz par pose : ${scintille(ts) ? 'pas un nombre entier, l\'image scintille et des bandes défilent' : 'un nombre entier, pas de scintillement'}`);
    const v = gain > 0 && (ki > 0 || nd > 0) ? ['warn', 'Du gain alors que l\'iris n\'est pas grand ouvert ou qu\'un filtre est en place : on ouvre l\'iris, on revient sur CLEAR, et le gain vient en dernier.']
      : ts < 1 / 50 && scintille(ts) ? ['warn', 'Ce shutter fait scintiller les lampes : le shutter se choisit pour le mouvement ou pour un écran, pas pour exposer. Revenez sur OFF ou calez-le en ECS.']
        : Math.abs(tot) <= 0.34 ? ['ok', `Exposé juste. L'ordre : l'iris pour l'image voulue, le ND pour la lumière en trop, l'iris pour finir, le gain seulement iris grand ouvert et filtre sur CLEAR.`]
          : tot > 0 ? ['ko', `Trop clair de ${nf(tot, 1)} diaphragme(s) : un ND plus dense d'abord (−2 par cran), puis l'iris.`] : ['ko', `Trop sombre de ${nf(-tot, 1)} diaphragme(s) : ouvrez l'iris, revenez sur CLEAR ; le gain en dernier (+6 dB par diaphragme).`];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  host.append(
    el('div', { class: 'co-ctl' },
      slider('Lumière de la scène', 0, 100, vl, 1, (v) => { vl = v; draw(); }, (v) => `${nf(luxDe(v))} lux`),
      slider('Iris', 0, IRIS.length - 1, ki, 1, (v) => { ki = v; draw(); }, (v) => fN(IRIS[v])),
      choice('ND', ND.map(([n], i) => [String(i), n]), '0', (v) => { nd = +v; draw(); }),
      choice('Gain', GAINS.map((x, i) => [String(i), (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x) + ' dB']), '1', (v) => { gi = +v; draw(); }),
      choice('Shutter', SHUTTERS, sh, (v) => { sh = v; draw(); })),
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Le budget de l\'exposition en diaphragmes : chaque réglage ajoute ou retire de la lumière ; le total doit tomber à zéro (le blanc au niveau nominal).')),
    verdict, read.el);
  draw();
}

/** @type {import('./index.js').Lesson[]} */
export const LECONS_CAPTEURS = [
  {
    id: 'camera-filtres', title: 'Les filtres : ND, température de couleur, passe-bas', minutes: '10 min', partie: PARTIE,
    camlab: ['nd', 'cc', 'olpf'],
    essentials: [
      'Les **filtres ND** (densité neutre) retirent de la lumière sans changer les couleurs : **1/4, 1/16, 1/64**, deux, quatre et six diaphragmes. Ils gardent l\'iris vers f/4 à f/5,6 en plein jour.',
      'La lumière blanche a une **couleur**, sa **température** : 3 200 K pour le tungstène, 5 600 K pour le jour. On compte les écarts en **mireds** (10⁶ ÷ T) ; le **CC électronique** rapproche la caméra de la lumière, la balance finit.',
      'Devant les capteurs, le **filtre passe-bas** efface ce qui est plus fin que deux photosites (le **moiré**) et le **filtre infrarouge** arrête ce que le silicium verrait au-delà de 700 nm.',
    ],
    figure: () => figNotions(['nd', 'cc'], 'Les filtres ND et la température de couleur'),
    demoTitle: 'Sous un ciel couvert, choisissez le filtre qui ramène l\'iris dans le vert ; passez en plein soleil. Plus bas, éclairez au tungstène avec une caméra réglée à 5 600 K, puis cherchez la focale où un mur LED se met à onduler.',
    demo: demoFiltres,
    body: `Entre l'objectif et le prisme, la lumière traverse encore des filtres. Le premier sert l'exposition : la roue des **filtres ND** (densité neutre), commandée par le bouton FILTER ou par le RCP. Un ND est un verre gris qui absorbe la même part de toutes les couleurs : l'image est moins lumineuse, ni plus chaude ni plus froide. Sur la HXC-FB80, quatre positions : 1 CLEAR, 2 **1/4** (deux diaphragmes), 3 **1/16** (quatre), 4 **1/64** (six). Pourquoi ne pas simplement fermer l'iris ? À f/16, la diffraction adoucit l'image, la profondeur de champ devient énorme et l'iris est en butée : la vision n'a plus de marge. Le ND retire la lumière en trop et laisse l'iris à sa meilleure place. L'iris d'une scène se calcule depuis la sensibilité de la caméra, f/13 à 2 000 lux : **N = 13 × √(lux ÷ 2 000)**, multiplié par la racine de ce que laisse passer le filtre. Un ciel couvert vers 10 000 lux demande f/29 sans filtre, f/7,3 avec le 1/16.

La lumière « blanche » n'a pas toujours la même couleur. On la décrit par la **température** d'un corps qu'on chauffe : 1 800 K pour une bougie, 3 200 K pour le filament d'un projecteur tungstène, 5 600 K pour le jour ; plus elle monte, plus la lumière est bleue. Les kelvins trompent : de 3 200 à 5 600 K, l'écart est énorme ; de 5 600 à 6 300 K, il se voit à peine. On compte donc en **mireds**, un million divisé par la température : 312,5 et 179, soit 134 mireds dans le premier cas, 20 dans le second ; un écart d'une dizaine de mireds commence à se remarquer entre deux caméras (ordre de grandeur). Deux façons de corriger : un **filtre CC** optique, sur une roue (les HDC-5500 du car en ont une : 3 200, 4 300, 6 300 K, et un filtre étoile), qui coûte un peu de lumière ; ou le **CC électronique** (3 200, 4 300, 5 600, 6 300 K), qui change les gains des voies rouge et bleue sans rien perdre : c'est celui de la FB80. Dans les deux cas, on part de la position la plus proche de la lumière, et la **balance des blancs** termine.

Devant chaque capteur, deux filtres encore. Le capteur compte l'image avec des photosites de 5 µm : un motif régulier plus fin que deux photosites par période (la limite de **Nyquist**, 100 paires de lignes par millimètre) ne se perd pas seulement, il se **replie** en une onde lente qui n'existe pas, le **moiré**. Le **filtre passe-bas optique**, une lame de quartz biréfringente qui dédouble chaque rayon, efface ce qui est juste au-delà ; l'image en est un tout petit peu adoucie, ce que rattrape le détail. Il n'efface pas tout : un mur LED au pas de 3,9 mm, à 8 m, ondule en dessous de 20 mm de focale. Le **filtre infrarouge** coupe au-delà de 700 nm : sans lui, le silicium, qui voit jusque vers 1 100 nm, rosirait les blancs, virerait les tissus noirs synthétiques au bordeaux et ferait briller la LED d'une télécommande (940 nm). Une lampe tungstène en émet beaucoup : à 3 200 K, son maximum est à 906 nm.

- Quand la nuit tombe sur le stade, les ND reviennent sur CLEAR les uns après les autres, puis le gain monte.
- Moiré à l'antenne : la vision baisse le détail de la caméra, le réalisateur change de focale ou de valeur de plan.`,
    car: { text: 'Au poste vision, la vision commute les ND et les CC depuis les RCP : l\'après-midi entre soleil et ombre de la tribune, puis les projecteurs à LED à la nuit tombée, avec une nouvelle balance de toutes les caméras sur la même charte. Les panneaux LED du bord du terrain sont les premiers pièges à moiré.', station: 'vision' },
    competences: competencesDe(['nd', 'cc', 'olpf']),
    article: 'optique',
    quiz: quizDe(['nd', 'cc', 'olpf'], [
      { q: 'Au stade, en début d\'après-midi, la CAM 2 est à f/16 avec le ND 1/4 et l\'image est encore un peu claire. Que demande l\'ingénieur vision à son RCP ?',
        choices: ['Le ND 1/16 : deux diaphragmes de moins, l\'iris pourra rouvrir vers f/8',
          ['Un gain de −3 dB', 'Le gain négatif ne retire qu\'un demi-diaphragme et l\'iris resterait en butée à f/16, avec la diffraction.'],
          ['Un shutter à 1/250', 'Le shutter ne sert pas à exposer : il rendrait le mouvement saccadé et ferait scintiller les écrans du stade.']],
        answer: 0, why: 'Un iris en butée à f/16 n\'a plus de marge et adoucit l\'image. Le cran suivant de la roue retire deux diaphragmes sans toucher aux couleurs : l\'iris revient vers sa zone de travail, et la vision finit au manche.' },
    ]),
  },
  {
    id: 'camera-prisme', title: 'Le prisme et les trois capteurs', minutes: '10 min', partie: PARTIE,
    camlab: ['prisme', 'capteur', 'formats'],
    essentials: [
      'Le **bloc prisme** trie la lumière par ses surfaces **dichroïques** : le bleu, puis le rouge sont renvoyés, le vert traverse ; chaque couleur a son **capteur** 2/3" de 1 920 × 1 080 photosites, calés au pixel près.',
      'Un **photosite** de 5 µm compte des électrons : le **bruit de photons** vaut √n (1 % à 10 000 électrons, 10 % à 100) ; la caméra donne **f/13 à 2 000 lux** et 60 dB de rapport signal sur bruit.',
      'Le **format** dit les lignes, la cadence et le balayage : **1080i50** (HD-SDI, 1,485 Gb/s), **1080p50** (3G-SDI, 2,97 Gb/s), 2160p50 (12G-SDI) ; toute la régie travaille au même format.',
    ],
    figure: () => figNotions(['prisme', 'capteur'], 'Le prisme dichroïque et le capteur CMOS 2/3"'),
    demoTitle: 'Filmez le maillot rouge, puis la pelouse et un blanc : regardez quel capteur travaille. Faites descendre la lumière d\'un photosite jusqu\'à 100 électrons, puis changez de format.',
    demo: demoPrisme,
    body: `Derrière les filtres, la lumière entre dans un **bloc prisme** : trois prismes de verre collés, dont deux faces internes portent une couche **dichroïque**, un empilement de couches très minces qui réfléchit une bande de couleurs et laisse passer le reste, presque sans rien absorber. La première surface renvoie le **bleu** vers le capteur bleu, la seconde le **rouge** vers le capteur rouge, le **vert** traverse tout droit. Chaque capteur reçoit l'image complète de sa couleur. Un capteur unique, lui, voit la couleur par une mosaïque de filtres (la matrice de **Bayer** : un photosite sur quatre pour le rouge, un sur quatre pour le bleu, deux pour le vert) et devine le reste, en perdant la lumière que les filtres absorbent. Le prix du tri-capteur : un bloc lourd, des objectifs calculés pour traverser son verre (la monture B4), et trois images qui doivent se superposer à mieux que deux ou trois micromètres. Un capteur qui bouge, c'est un liseré coloré sur tous les contours : un défaut de **registration**, qui part en maintenance. Dans la luminance, le vert pèse plus de 70 % (Y = 0,2126 R + 0,7152 V + 0,0722 B) : c'est lui qui porte le détail, et le cadreur fait le point sur la voie verte.

Le **capteur CMOS 2/3"** mesure 9,59 × 5,39 mm : 1 920 colonnes et 1 080 lignes de photosites de 5 µm, chacun sous une microlentille. Pendant le temps de pose, chaque photon libère un électron, qui s'accumule dans un puits de quelques dizaines de milliers d'électrons ; plein, il ne compte plus : c'est le blanc écrêté. Les photons arrivent au hasard : un photosite qui en reçoit n en reçoit n ± √n. À 10 000 électrons, 1 % de bruit, invisible ; à 100, 10 % : le grain des zones sombres. S'y ajoute le bruit de lecture. La **sensibilité** se donne en nombre f : « f/13 à 2 000 lux » (50 Hz, 3 200 K, blanc à 89,9 %) veut dire qu'une scène à 2 000 lux sort au niveau nominal à f/13, sans gain. Le CMOS se lit ligne après ligne, en un cinquantième de seconde : un flash peut n'éclairer qu'une bande de l'image (obturateur déroulant) ; les HDC-5500 du car, à obturateur global, n'ont pas ce défaut.

Le **format** dit trois choses : le nombre de lignes actives (1080 ou 720), la cadence, et le balayage. En **1080i50** (1080/50i, ou 1080i25 d'après ses 25 images), chaque image est faite de deux **trames** entrelacées prises à 20 ms d'écart : deux fois moins de données, des dents de peigne sur ce qui bouge, et le **HD-SDI** suffit (2 640 × 1 125 × 25 × 20 bits = 1,485 Gb/s). En **1080p50**, 50 images entières par seconde : deux fois plus de données, le **3G-SDI** (2,97 Gb/s). Le 1080/25PsF prend l'image d'un coup et l'envoie en deux segments ; le 720p50 tient en HD-SDI. Le format fixe aussi le shutter par défaut (1/50 s en 50 Hz) et la sensibilité : toute la régie doit être au même format et à la même référence.

- En UHD 2160p50, quatre fois plus de pixels : 12G-SDI (11,88 Gb/s) ou quatre liens 3G.
- Si un diffuseur demande du 1080i25, c'est la sortie du car qui le fabrique, pas les caméras.`,
    car: { text: 'Le car travaille d\'office en 1080p50, en 3G-SDI dans la grille, le mélangeur et les serveurs ; il sait aussi le 1080i50 et l\'UHD 2160p50. Au poste vision, la parade RVB du PRISM montre les trois capteurs côte à côte ; une caméra qui frange sur tous les contours part en maintenance.', station: 'vision' },
    terms: ['parade-rvb', 'vpid'],
    competences: competencesDe(['prisme', 'capteur', 'formats']),
    article: 'formats',
    quiz: quizDe(['prisme', 'capteur', 'formats'], [
      { q: 'Au line-up, la CAM 4 montre un liseré rouge d\'un côté de tous les contours et cyan de l\'autre, au centre de l\'image comme au bord, à toutes les focales. Que faut-il en penser ?',
        choices: ['Un capteur a bougé sur le prisme (registration) : la caméra part en maintenance',
          ['C\'est l\'aberration chromatique de l\'objectif : l\'ALAC la corrigera', 'L\'aberration latérale est nulle au centre et grandit vers les bords. Un liseré identique partout vient des capteurs, pas de l\'objectif.'],
          ['C\'est une balance des blancs ratée', 'La balance change la couleur de toute l\'image, pas des liserés sur les contours.']],
        answer: 0, why: 'Les trois images doivent se superposer à une fraction de photosite. Si un capteur se décale, chaque contour prend un liseré de sa couleur d\'un côté et de la couleur complémentaire de l\'autre, partout dans l\'image : cela ne se règle pas sur place.' },
    ]),
  },
  {
    id: 'camera-exposition', title: 'L\'exposition : iris, ND, gain, obturateur', minutes: '10 min', partie: PARTIE,
    camlab: ['gain', 'shutter', 'exposition'],
    essentials: [
      'Quatre réglages changent la lumière de l\'image, tous comptés en **diaphragmes** (deux fois plus ou moins) : l\'**iris**, le **ND**, le **gain** (+6 dB = un diaphragme), le **shutter** (1/100 s coûte un diaphragme).',
      'Chacun a un **prix** : l\'iris la profondeur de champ, le gain le **bruit** (+6 dB, deux fois plus), le shutter la **fluidité** du mouvement et le **scintillement** des lampes ; le ND, rien sur l\'image.',
      'L\'**ordre** : l\'iris pour l\'image voulue, le ND pour la lumière en trop, l\'iris pour finir, le gain seulement iris grand ouvert et filtre sur CLEAR ; le shutter se choisit pour le mouvement, pas pour exposer.',
    ],
    figure: () => figNotions(['exposition', 'shutter'], 'L\'exposition et le temps de pose'),
    demoTitle: 'Partez d\'un plateau à 400 lux et exposez juste. Montez à 10 000 lux, puis baissez à 50 lux. Essayez un gain avec le ND en place, puis un shutter à 1/125.',
    demo: demoExposition,
    body: `Ce qui compte pour l'image, c'est la lumière que reçoit chaque photosite pendant une image, puis l'amplification qu'on lui donne. Quatre réglages y touchent, et tous se comptent dans la même unité, le **diaphragme** : deux fois plus ou deux fois moins de lumière. L'**iris** (2 × log₂ du rapport des nombres f), le **filtre ND** (log₂ de ce qu'il laisse passer : 1/16, quatre diaphragmes), le **gain** (6 dB par diaphragme, car 20 × log₁₀ 2 = 6,02) et le **shutter** (log₂ du rapport des temps de pose). On part de la sensibilité de la caméra, f/13 à 2 000 lux, et l'on additionne : le total tombe à zéro quand le blanc est au niveau nominal. Un plateau à 400 lux, c'est 2,3 diaphragmes de moins que 2 000 lux : f/5,8 les rattrape, sans filtre ni gain.

Chacun a son prix. L'**iris** change la profondeur de champ et, au-delà de f/11, adoucit l'image par diffraction. Le **ND** ne coûte rien sur l'image, mais sa roue est mécanique. Le **gain** amplifie le signal et le **bruit** ensemble : il n'ajoute aucune lumière. La FB80 annonce 60 dB de rapport signal sur bruit à 0 dB ; à +6 dB, 54 dB ; à +12 dB, 48 dB. Le bruit se voit d'abord dans les noirs, en grain qui fourmille ; et les noirs des trois voies bougent un peu avec le gain : après un changement de gain, on refait la balance des noirs. Le **shutter** (l'obturateur électronique) raccourcit le temps de pose, 1/50 s sur OFF : un ballon à 5 m/s avance de 10 cm pendant 1/50 s (une traînée qui rend le mouvement fluide), de 1 cm à 1/500 (net, mais il saute de place en place : le mouvement **saccade**).

Le shutter fait aussi **scintiller** les lampes : sur le secteur à 50 Hz, beaucoup de lampes vibrent à 100 Hz. Si le temps de pose contient un nombre entier de vibrations (1/50 s en contient deux, 1/100 une), chaque image reçoit la même lumière ; à 1/60 ou 1/125, non, et comme le CMOS se lit ligne après ligne, des **bandes** défilent. Le mode **ECS** (clear scan) règle le temps de pose au dixième de hertz près sur la fréquence d'un écran du décor, pour arrêter ses bandes.

D'où l'**ordre** des réglages : l'iris d'abord, choisi pour l'image voulue (un fond flou, ou tout net) ; le ND pour retirer la lumière en trop sans toucher à cet iris ; l'iris pour finir, au tiers de diaphragme ; le gain seulement quand l'iris est grand ouvert et le ND sur CLEAR. Le shutter ne sert pas à exposer : on le choisit pour le mouvement ou pour un écran, et les autres réglages compensent.

- Dehors, ciel couvert vers 10 000 lux : 4,6 diaphragmes de plus que le plateau ; ND 1/16 et f/7,3, ou ND 1/64 pour garder f/4 et le fond flou d'une interview.
- Les caméras de super ralenti posent au plus 1/150 s en 3× : 1,6 diaphragme de moins que les autres, et les premières à scintiller.`,
    car: { text: 'Au poste vision, l\'ingénieur vision suit l\'iris de chaque caméra au manche du RCP, en continu, entre le soleil et l\'ombre ; il change les ND quand le soleil sort ou se couche et ne touche au gain qu\'à la nuit, pour toutes les caméras à la fois (« on passe à +6 dB »). Le shutter ne sert qu\'aux caméras de ralenti et aux écrans.', station: 'vision' },
    competences: competencesDe(['gain', 'shutter', 'exposition']),
    article: 'optique',
    exercises: [
      { id: 'vision-exposition', intro: 'Au poste vision, une caméra a l\'iris fermé : vous déverrouillez son RCP (PANEL ACTIVE), puis vous rouvrez l\'iris au joystick, cran par cran, comme le premier réglage du budget de la leçon. Réglez en regardant le waveform plutôt que le moniteur : la moyenne de l\'image doit remonter entre 35 et 55 %, et les blancs rester sous la ligne des 100 %. Le gain n\'a rien à faire ici tant que l\'iris a de la marge.' },
    ],
    quiz: quizDe(['gain', 'shutter', 'exposition'], [
      { q: 'En fin de match, l\'éclairage du stade baisse : les caméras sont à f/1,8, ND sur CLEAR, et l\'image reste un diaphragme trop sombre. Que fait la vision ?',
        choices: ['+6 dB de gain sur toutes les caméras à la fois, puis une balance des noirs',
          ['Un shutter plus long que 1/50 s', 'À 50 images par seconde, une image ne peut pas durer plus d\'un cinquantième de seconde en exploitation normale : on ne gagne rien sur le direct.'],
          ['+6 dB sur la seule caméra principale', 'Le gain ajoute du bruit : une caméra plus bruitée que les autres se voit à chaque coupe. On passe toutes les caméras au même gain.']],
        answer: 0, why: 'Iris grand ouvert et filtre sur CLEAR, il ne reste que le gain : +6 dB, un diaphragme, deux fois plus de bruit. On le monte pour toutes les caméras, pour qu\'elles gardent le même grain, et on refait la balance des noirs, qui bouge avec le gain.' },
    ]),
  },
];
