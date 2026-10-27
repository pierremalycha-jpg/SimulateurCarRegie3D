// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Leçon « Compresser l'image : intra, inter, débit et latence » (chapitre Le signal vidéo numérique).
// La manipulation calcule le débit brut de l'image active (largeur × hauteur × images/s × bits par
// pixel : 20 en 4:2:2 10 bits, 12 en 4:2:0 8 bits), le rapport de compression et les bits par pixel
// d'un débit codé, la latence d'un codec (codage, réordonnancement des images B, tampon, décodage),
// puis la propagation d'une erreur dans un GOP (I, P, B). Les seuils de qualité et les latences sont
// des ordres de grandeur pour du sport (mouvement rapide), à dire comme tels ; les débits de
// contribution sont ceux de la leçon expl-transmission (JPEG XS 200 Mb/s, HEVC 25 Mb/s en HD).
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238', i: '#ff8a80', p: '#7fd3f3', b: '#59646f' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);
const box = (x, y, w, h, stroke = C.grey) => sv('rect', { x, y, width: w, height: h, rx: 3, fill: C.box, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};

// ---------------- le modèle (pur) ----------------
/** formats : image active, images (complètes) par seconde, lignes totales par image (durée d'une ligne) */
export const FORMATS_C = {
  '1080p50': { nom: '1080p50', w: 1920, h: 1080, ips: 50, lignes: 1125 },
  '1080i50': { nom: '1080i50', w: 1920, h: 1080, ips: 25, lignes: 1125 },
  '2160p50': { nom: '2160p50', w: 3840, h: 2160, ips: 50, lignes: 2250 },
};
/** échantillonnage : bits par pixel de l'image non compressée (Y à chaque pixel, Cb et Cr selon la structure) */
export const ECHANTILLONNAGES = { '422-10': { nom: '4:2:2 10 bits', bpp: 20 }, '420-8': { nom: '4:2:0 8 bits', bpp: 12 } };
/** débit brut de l'image active (b/s) */
export const debitBrut = (f, e) => f.w * f.h * f.ips * e.bpp;
/** rapport de compression d'un débit codé (b/s) */
export const rapportCompression = (brut, debit) => brut / debit;
/** bits par pixel d'un débit codé : la mesure qui permet de comparer les formats */
export const bitsParPixel = (debit, f) => debit / (f.w * f.h * f.ips);
/** durée d'une image (ms) */
export const dureeImage = (f) => 1000 / f.ips;
/**
 * Les familles de codecs du car. lat : la latence de bout en bout (ms) pour le format f et la distance M
 * entre images de référence (images B) ; seuils : bits par pixel « bon » et « correct » pour du sport.
 * Ordres de grandeur.
 */
export const CODECS = {
  jxs: { nom: 'JPEG XS', famille: 'intra, par paquets de lignes', inter: false, seuils: [1.8, 1], lat: (f) => 2 * 16 * 1000 / (f.ips * f.lignes) },
  intra: { nom: 'Intra image (XAVC-I, ProRes, DNxHD)', famille: 'intra, image par image', inter: false, seuils: [1.5, 0.8], lat: (f) => 2 * dureeImage(f) },
  avcld: { nom: 'H.264 faible latence (I et P)', famille: 'inter, sans images B', inter: true, seuils: [0.3, 0.15], lat: (f) => 4 * dureeImage(f) },
  hevc: { nom: 'HEVC de contribution (GOP avec B)', famille: 'inter, images B', inter: true, seuils: [0.15, 0.08], lat: (f, M = 3) => (2 + (M - 1)) * dureeImage(f) + 400 },
};
/** la qualité attendue d'un débit pour un codec : 'bon', 'correct' ou 'artefacts' */
export function qualite(codec, bpp) { const [a, b] = CODECS[codec].seuils; return bpp >= a ? 'bon' : bpp >= b ? 'correct' : 'artefacts'; }
/** les types d'images d'un GOP, dans l'ordre d'affichage : I, puis une image P toutes les M, des B entre elles */
export function gop(N, M) { return Array.from({ length: N }, (_, k) => (k === 0 ? 'I' : M > 1 && k % M ? 'B' : 'P')); }
/**
 * Les images abîmées par une erreur sur l'image k d'une suite de GOP (ordre d'affichage) : une image B
 * n'abîme qu'elle-même ; une image de référence (I ou P) abîme les B qui la précèdent (elles s'appuient
 * sur elle) et tout ce qui suit jusqu'à la prochaine image I.
 * @param {string[]} types les types d'images de la suite
 * @returns {number[]} les indices abîmés
 */
export function propagation(types, k) {
  if (types[k] === 'B') return [k];
  const out = [];
  for (let j = k - 1; j >= 0 && types[j] === 'B'; j--) out.unshift(j);
  for (let j = k; j < types.length && (j === k || types[j] !== 'I'); j++) out.push(j);
  return out;
}

// ---------------- la manipulation ----------------
function demoCompression(host) {
  let fmt = '1080p50', ech = '422-10', codec = 'jxs', debit = 200, M = 3, N = 12, err = 4;
  const read = readout(['Image non compressée', 'Rapport de compression', 'Bits par pixel', 'Qualité attendue (sport)', 'Latence de bout en bout']);
  const read2 = readout(['Image touchée', 'Images abîmées', 'À l\'écran']);
  const verdict = el('p', { class: 'co-verdict' });
  const cv = canvas(720, 150, 'co-canvas co-smooth'), g = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
  let cells = [];
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * 720 / r.width, y = (e.clientY - r.top) * 150 / r.height;
    const c = cells.find((q) => x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h); if (c) { err = c.k; draw(); }
  });
  const draw = () => {
    const f = FORMATS_C[fmt], e = ECHANTILLONNAGES[ech], K = CODECS[codec];
    const brut = debitBrut(f, e), d = debit * 1e6, bpp = bitsParPixel(d, f), q = qualite(codec, bpp), lat = K.lat(f, M);
    read.set('Image non compressée', `${fmtNum(brut / 1e9, 2)} Gb/s (${fmtNum(f.w)} × ${fmtNum(f.h)} × ${f.ips} images/s × ${e.bpp} bits)`);
    read.set('Rapport de compression', `${fmtNum(rapportCompression(brut, d), rapportCompression(brut, d) < 10 ? 1 : 0)} : 1`);
    read.set('Bits par pixel', `${fmtNum(bpp, bpp < 1 ? 3 : 2)} (au lieu de ${e.bpp})`);
    read.set('Qualité attendue (sport)', q === 'bon' ? 'bonne : rien ne se voit' : q === 'correct' ? 'correcte : des défauts sur les mouvements rapides' : 'artefacts : macroblocs, flou de mouvement, pelouse « baveuse »');
    read.set('Latence de bout en bout', `${lat < 2 ? fmtNum(lat, 2) : fmtNum(lat)} ms${lat < 2 ? ' : quelques lignes' : ` : ${fmtNum(lat / dureeImage(f), 1)} images`} (ordre de grandeur)`);
    const v = q === 'artefacts' ? ['ko', `Trop peu de bits pour ce codec : ${fmtNum(bpp, 3)} bit par pixel. Montez le débit, ou passez à un codec plus efficace si la latence le permet.`]
      : codec === 'hevc' && lat > 300 ? ['warn', `Bon rapport débit / qualité, mais ${fmtNum(lat)} ms de retard : bien pour un secours satellite, pas pour une liaison où l'on se parle (duplex, retour cadreur).`]
        : q === 'correct' ? ['warn', 'Le débit est juste : un plan large de foule ou une pluie de confettis le mettra en défaut.']
          : ['ok', `${K.nom} à ${debit} Mb/s : ${fmtNum(rapportCompression(brut, d), 0)} : 1, une qualité sans défaut visible et ${lat < 2 ? 'presque aucun retard' : fmtNum(lat) + ' ms de retard'}.`];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
    // le GOP : deux GOP de N images, en ordre d'affichage
    const types = K.inter ? [...gop(N, codec === 'avcld' ? 1 : M), ...gop(N, codec === 'avcld' ? 1 : M)] : Array.from({ length: 2 * N }, () => 'I');
    if (err >= types.length) err = types.length - 1;
    const bad = new Set(propagation(types, err));
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, 720, 150);
    g.font = '11px Arial, sans-serif'; g.fillStyle = '#aab4ba';
    g.fillText(K.inter ? `deux GOP de ${N} images, ordre d'affichage (cliquez une image pour y mettre une erreur)` : 'codec intra : chaque image est codée seule (cliquez une image pour y mettre une erreur)', 8, 14);
    const cw = Math.min(28, 700 / types.length);
    cells = types.map((t, k) => ({ k, x: 10 + k * cw, y: 34, w: cw - 3, h: 54 }));
    for (const c of cells) {
      const t = types[c.k];
      g.fillStyle = t === 'I' ? C.i : t === 'P' ? C.p : C.b; g.globalAlpha = bad.has(c.k) ? 0.35 : 0.9; g.fillRect(c.x, c.y, c.w, c.h); g.globalAlpha = 1;
      // une image abîmée : hachurée de rouge (les hachures découpées au cadre de l'image)
      if (bad.has(c.k)) { g.save(); g.beginPath(); g.rect(c.x, c.y, c.w, c.h); g.clip(); g.strokeStyle = '#ff4a3a'; g.lineWidth = 2; g.beginPath(); for (let s = -c.h; s < c.w; s += 7) { g.moveTo(c.x + s, c.y + c.h); g.lineTo(c.x + s + c.h, c.y); } g.stroke(); g.restore(); }
      if (c.k === err) { g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(c.x - 1, c.y - 1, c.w + 2, c.h + 2); }
      g.fillStyle = '#0b1013'; g.font = 'bold 12px Arial, sans-serif'; g.fillText(t, c.x + c.w / 2 - 4, c.y + 32);
    }
    g.fillStyle = '#aab4ba'; g.font = '11px Arial, sans-serif';
    g.fillText('I : image entière · P : prédite depuis l\'image de référence d\'avant · B : prédite des deux côtés', 8, 110);
    g.fillText(`une image = ${fmtNum(dureeImage(f))} ms en ${f.nom}`, 8, 128);
    read2.set('Image touchée', `image ${err + 1}, de type ${types[err]}`);
    read2.set('Images abîmées', `${bad.size}${types[err] === 'B' ? ' : une image B ne sert de référence à personne' : types[err] === 'I' && !K.inter ? ' : en intra, l\'erreur ne quitte pas son image' : ' : jusqu\'à la prochaine image I'}`);
    read2.set('À l\'écran', `${fmtNum(bad.size * dureeImage(f))} ms de défaut`);
  };
  const debitSl = slider('Débit codé', 5, 600, debit, 5, (v) => { debit = v; draw(); }, (v) => v + ' Mb/s');
  const setDebit = (v) => { const i = /** @type {HTMLInputElement} */ (debitSl.querySelector('input')); i.value = String(v); i.dispatchEvent(new Event('input')); };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Format', Object.entries(FORMATS_C).map(([k, f]) => [k, f.nom]), fmt, (v) => { fmt = v; draw(); }),
      choice('Échantillonnage', Object.entries(ECHANTILLONNAGES).map(([k, e]) => [k, e.nom]), ech, (v) => { ech = v; draw(); })),
    el('div', { class: 'co-ctl' },
      choice('Codec', [['jxs', 'JPEG XS'], ['intra', 'Intra image'], ['avcld', 'H.264 faible latence'], ['hevc', 'HEVC avec B']], codec, (v) => { codec = v; setDebit({ jxs: 200, intra: 220, avcld: 40, hevc: 25 }[v]); }),
      debitSl,
      slider('GOP (N images)', 6, 24, N, 6, (v) => { N = v; draw(); }, (v) => `${v} images`)),
    verdict, read.el,
    el('figure', { class: 'co-figc' }, cv, el('figcaption', {}, 'Une erreur de transmission dans le flux : dans un codec inter, elle se propage à toutes les images qui s\'appuient sur l\'image touchée.')),
    read2.el);
  draw();
}

// ---------------- le schéma ----------------
function figCompression() {
  const f = figure(720, 230, 'Un codeur : l\'image (2,07 Gb/s en 1080p50 4:2:2 10 bits) passe par une transformée, une quantification qui jette ce que l\'œil voit le moins, un codage entropique ; un codec intra code chaque image seule, un codec inter code les différences entre images dans un GOP : I, B, B, P… avec ses flèches de prédiction.');
  f.append(txt(10, 16, 'Ce que fait un codeur', 'co-t', 'start'));
  f.append(box(10, 30, 120, 44, C.amber), txt(70, 50, 'Image', 'co-t'), txt(70, 66, '2,07 Gb/s', 'co-m'));
  const steps = [['Transformée', 'DCT, ondelettes'], ['Quantification', 'on jette le moins visible'], ['Codage entropique', 'les fréquents en court']];
  steps.forEach(([a, b], i) => { const x = 160 + i * 150; f.append(arrow(x - 28, 52, x - 4, 52), box(x, 30, 130, 44), txt(x + 65, 50, a, 'co-s'), txt(x + 65, 66, b, 'co-m')); });
  f.append(arrow(612, 52, 636, 52), box(640, 30, 72, 44, C.green), txt(676, 50, 'Débit', 'co-t'), txt(676, 66, '200 Mb/s', 'co-m'));
  f.append(txt(10, 100, 'Intra : chaque image seule (JPEG XS, XAVC-I, ProRes) · Inter : les différences entre images (H.264, HEVC)', 'co-s', 'start'));
  // un GOP et ses prédictions
  const T = ['I', 'B', 'B', 'P', 'B', 'B', 'P', 'B', 'B', 'P', 'B', 'B', 'I'];
  const X = (k) => 24 + k * 52, Y = 150;
  T.forEach((t, k) => f.append(sv('rect', { x: X(k), y: Y, width: 40, height: 32, rx: 3, fill: t === 'I' ? C.i : t === 'P' ? C.p : C.b, opacity: 0.85 }), txt(X(k) + 20, Y + 21, t, 'co-t')));
  const curve = (a, b, col, up = true) => { const xa = X(a) + 20, xb = X(b) + 20, y = up ? Y - 2 : Y + 34, c = up ? Y - 26 : Y + 58; f.append(sv('path', { d: `M${xa} ${y} Q${(xa + xb) / 2} ${c} ${xb} ${y}`, fill: 'none', stroke: col, strokeWidth: 1.3 })); };
  curve(0, 3, C.p); curve(3, 6, C.p); curve(6, 9, C.p);
  for (const k of [1, 2]) { curve(0, k, C.grey, false); curve(3, k, C.grey, false); }
  f.append(txt(X(13) - 30, Y + 21, '…', 'co-t'), txt(360, 224, 'un GOP de 12 images (N = 12, M = 3) : une erreur sur une image I ou P dure jusqu\'à la prochaine image I', 'co-s'));
  return f;
}

/** @type {import('./index.js').Lesson} */
export const LESSON_COMPRESSION = {
  id: 'signal-compression', title: 'Compresser l\'image : intra, inter, débit et latence', minutes: '9 min',
  essentials: [
    'Une image 1080p50 4:2:2 10 bits fait **2,07 Gb/s** ; un codec la réduit d\'un **rapport** : JPEG XS ≈ 10 : 1 presque sans retard, HEVC ≈ 80 : 1 avec quelques centaines de millisecondes.',
    'Un codec **intra** code chaque image seule ; un codec **inter** (GOP : I, P, B) ne code que les différences, mieux, mais une erreur dure jusqu\'à la prochaine image I.',
    'Pour comparer deux débits, on compte les **bits par pixel** : 20 sans compression, de l\'ordre de 2 en JPEG XS, 0,2 en HEVC de contribution.',
  ],
  figure: figCompression,
  demoTitle: 'Comparez JPEG XS à 200 Mb/s et HEVC à 25 Mb/s : rapport, bits par pixel, latence. Descendez le débit jusqu\'aux artefacts, passez en 2160p50. Plus bas, mettez une erreur sur une image I, puis sur une B.',
  demo: demoCompression,
  body: `Sans compression, l'image coûte cher : en 1080p50 4:2:2 10 bits, chaque pixel porte une luminance et, un pixel sur deux, une paire de chrominances, soit **20 bits par pixel**, et 1 920 × 1 080 × 50 × 20 = **2,07 Gb/s** d'image active (le SDI 3G en transporte 2,97 avec la suppression). C'est ce qui circule dans le car, en SDI ou en ST 2110-20. Dès qu'on sort du car (une liaison vers la régie finale, un satellite, Internet), on **compresse** : le **rapport de compression** est le débit brut divisé par le débit codé.

Un codeur fait trois choses. Une **transformée** (DCT par blocs pour le H.264 et le HEVC, ondelettes pour le JPEG 2000 et le JPEG XS) range l'image en fréquences spatiales : les aplats en peu de coefficients, les détails fins à part. La **quantification** arrondit ces coefficients, d'autant plus fort que l'œil les voit peu : c'est là, et seulement là, que l'on perd de l'information. Le **codage entropique** écrit enfin les valeurs fréquentes en codes courts. Plus on quantifie fort, plus le débit baisse et plus les défauts apparaissent : **macroblocs** (des carrés visibles), flou sur les mouvements, pelouse « baveuse », bruit qui pompe.

Un codec **intra** code chaque image seule : **JPEG XS** (ST 2110-22, quelques lignes de retard), JPEG 2000, ou en production XAVC-I, ProRes, DNxHD. Chaque image se décode sans les autres : on coupe, on monte, on ralentit à l'image près, et une erreur ne touche qu'une image. Un codec **inter** (MPEG-2, **H.264**, **HEVC**) profite de ce qu'une image ressemble à la précédente : une image **I** est codée entière, une image **P** est prédite depuis l'image de référence d'avant (seuls les mouvements et les différences sont envoyés), une image **B** depuis celles d'avant et d'après. Le **GOP** (groupe d'images) va d'une I à la suivante : N = 12, M = 3 donne I B B P B B P B B P B B. C'est deux à cinq fois plus efficace qu'un intra à qualité égale, mais avec deux prix. Une erreur sur une I ou une P se **propage** jusqu'à la prochaine I (une demi-seconde en GOP de 12 à 25 images par seconde). Et une image B ne peut être codée qu'une fois l'image de référence suivante arrivée : le codeur **attend** M − 1 images, auxquelles s'ajoutent le tampon du codeur (qui lisse le débit) et le décodage.

D'où le choix du car. Pour la **contribution principale** sur fibre, le JPEG XS à 200 Mb/s en HD (de l'ordre de 10 : 1, environ 2 bits par pixel) : qualité de production, retard de moins d'une milliseconde. Pour le **secours** satellite, le HEVC à 25 Mb/s (80 : 1, 0,24 bit par pixel) : le satellite coûte cher au mégabit, et le retard de quelques centaines de millisecondes s'ajoute aux 250 ms du bond. Pour une **caméra HF**, un H.264 ou un HEVC en **faible latence** (sans images B, avec un tampon court) : quelques images de retard. Pour se **parler** (un duplex, un commentateur à distance), on fuit les longues latences : au-delà de quelques centaines de millisecondes, les deux interlocuteurs se coupent la parole.

Deux règles de métier. Les bits par pixel permettent de comparer : 25 Mb/s n'ont pas le même sens en 1080i50 (25 images entières par seconde) et en 2160p50 (huit fois plus de pixels par seconde). Et chaque passage par un codeur et un décodeur (une **cascade**) ajoute ses défauts : on garde le plus haut débit possible en contribution, pour que la régie finale puisse recompresser pour la diffusion sans que les défauts s'additionnent.

- Ordres de grandeur pour du sport : JPEG XS bon au-dessus de 1,8 bit par pixel, intra de production au-dessus de 1,5, H.264 faible latence au-dessus de 0,3, HEVC au-dessus de 0,15 ; les latences du modèle (2 × 16 lignes en JPEG XS, 2 images en intra, 4 images en H.264 faible latence, 400 ms de tampon en HEVC de contribution) sont indicatives.
- Le 4:2:0 8 bits (12 bits par pixel) de la diffusion grand public divise encore la chrominance par deux : la contribution reste en 4:2:2 10 bits pour les incrustations et les retouches de la régie finale.`,
  car: { text: 'Au poste Transmission : le départ principal TX1 en JPEG XS sur fibre et le secours TX2 en HEVC par satellite, leurs débits, leurs retards et la bascule ; la caméra HF arrive, elle, compressée en H.264 ou HEVC par sa liaison COFDM.', station: 'transmission' },
  terms: ['st2110-22', 'latence', 'debit'],
  competences: ['2.11', '1.4', '3.4'],
  quiz: [
    { q: 'Quel est le débit de l\'image active en 1080p50 4:2:2 10 bits, avant compression ?', choices: ['≈ 2,07 Gb/s', ['≈ 1,24 Gb/s', 'C\'est le 4:2:0 8 bits (12 bits par pixel) : en 4:2:2 10 bits, chaque pixel coûte 20 bits.'], ['≈ 2,97 Gb/s', 'C\'est le débit du lien 3G-SDI, suppression comprise ; l\'image active seule fait 2,07 Gb/s.']], answer: 0, why: '1 920 × 1 080 × 50 images/s × 20 bits = 2,07 Gb/s. Le SDI 3G en transporte 2,97 avec les lignes et les échantillons de suppression (son, données).' },
    { q: 'Le secours satellite passe en HEVC à 25 Mb/s. Quel rapport de compression, en 1080p50 4:2:2 10 bits ?', choices: ['≈ 83 : 1', ['≈ 10 : 1', 'C\'est le rapport du JPEG XS à 200 Mb/s : à 25 Mb/s, on compresse huit fois plus.'], ['≈ 119 : 1', 'C\'est 2,97 Gb/s ÷ 25 Mb/s : on divise le débit du lien SDI, suppression comprise, au lieu de l\'image active.']], answer: 0, why: '2 073,6 Mb/s ÷ 25 Mb/s ≈ 83. Le HEVC y arrive en codant les différences entre images (inter) ; le prix est une latence de quelques centaines de millisecondes.' },
    { q: 'Dans un GOP I B B P B B P…, une erreur de transmission touche une image P. Combien de temps le défaut reste-t-il à l\'écran ?', choices: ['Jusqu\'à la prochaine image I : les images suivantes s\'appuient sur la P abîmée', ['Une image seulement', 'C\'est le cas d\'une image B, qui ne sert de référence à personne, ou d\'un codec intra.'], ['Jusqu\'à la fin du match', 'L\'image I suivante est codée entière : elle remet le décodeur à zéro, en une demi-seconde environ.']], answer: 0, why: 'Les P et B qui suivent sont prédites à partir de la P abîmée : le défaut se recopie de proche en proche jusqu\'à la prochaine I. C\'est pourquoi la contribution utilise des GOP courts, ou de l\'intra.' },
    { q: 'Pourquoi un codec avec des images B ajoute-t-il du retard ?', choices: ['Une image B est prédite aussi depuis l\'image suivante : le codeur doit l\'attendre', ['Parce que les images B sont plus grosses', 'Les images B sont les plus petites du GOP ; c\'est l\'ordre de codage qui impose l\'attente.'], ['Parce que le décodeur affiche deux fois chaque image B', 'Chaque image est affichée une fois ; elles sont seulement transmises dans un autre ordre que celui d\'affichage.']], answer: 0, why: 'Pour coder B entre I et P, il faut déjà avoir la P : le codeur prend M − 1 images de retard, plus son tampon. Les modes faible latence suppriment les B.' },
    { q: 'Le commentateur est en duplex depuis un studio, par une liaison HEVC qui a 600 ms de latence. Que va-t-il se passer ?', choices: ['Les échanges avec le plateau se chevauchent : chacun répond trop tard', ['Rien : 600 ms ne s\'entendent pas', 'Un aller-retour de plus d\'une seconde se sent très bien dans une conversation : chacun croit l\'autre silencieux et reprend la parole.'], ['L\'image sera de mauvaise qualité', 'La latence ne dit rien de la qualité : le HEVC peut être excellent et lent à la fois.']], answer: 0, why: 'Une question et sa réponse font l\'aller-retour : 1,2 s de silence. Pour se parler, on choisit une liaison à faible latence (JPEG XS, H.264 sans B, tampon court).' },
    { q: 'Deux liaisons à 25 Mb/s : l\'une en 1080i50, l\'autre en 2160p50, même codec. Laquelle sera la plus abîmée ?', choices: ['La 2160p50 : huit fois plus de pixels par seconde pour le même débit', ['Aucune : même débit, même qualité', 'Le débit se partage entre les pixels : 0,48 bit par pixel en 1080i50, 0,06 en 2160p50.'], ['La 1080i50, parce qu\'elle est entrelacée', 'L\'entrelacé a ses défauts, mais ici c\'est le nombre de bits par pixel qui décide.']], answer: 0, why: '1080i50 : 1 920 × 1 080 × 25 ≈ 52 millions de pixels par seconde ; 2160p50 : 415 millions. À débit égal, huit fois moins de bits pour chaque pixel.' },
  ],
};
