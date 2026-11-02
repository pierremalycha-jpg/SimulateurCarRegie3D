// @ts-check
import { el } from '../util.js';
import { figure, sv, slider, choice, readout, fmtNum } from './kit.js';
import { IMAGES, debitActif, taux, tailleOctets, octets, gop, gainGop, CODECS } from './video_calc.js';

// ----------------------------------------------------------------------------------
// Leçon « La compression vidéo » du chapitre Le signal (v19.24) : pourquoi compresser (2 Gb/s d'image active en
// 1080p50 4:2:2 10 bits), l'intra (dans l'image : transformée, quantification, entropie) et l'inter (le GOP :
// images I, P, B), les codecs du car (XDCAM HD422 50 Mb/s, AVC-Intra, ProRes, H.264 et HEVC de contribution,
// JPEG XS), le débit contre la latence et la qualité. Calculs : cours/video_calc.js.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238', white: '#e8eef2' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle', more = {}) => sv('text', { x, y, textAnchor: anchor, class: cls, ...(more.fill ? { style: `fill: ${more.fill}` } : {}) }, s);
const box = (x, y, w, h, stroke = C.grey, fill = C.box) => sv('rect', { x, y, width: w, height: h, rx: 3, fill, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};
const mb = (bs) => (bs >= 1e9 ? `${fmtNum(bs / 1e9, 2)} Gb/s` : `${fmtNum(bs / 1e6, bs < 20e6 ? 1 : 0)} Mb/s`);

function figCompression() {
  const f = figure(720, 262, 'En haut, la compression intra : chaque image est découpée en blocs, transformée (DCT ou ondelettes), quantifiée (les détails fins, que l\'œil voit peu, sont arrondis : c\'est là que l\'on perd) puis codée sans perte (entropie). En bas, la compression inter, le GOP : une image I complète, puis des images P prédites de la précédente et des images B prédites des deux côtés ; seuls les blocs qui bougent sont transmis, avec leurs vecteurs de mouvement. Une P pèse environ le tiers d\'une I, une B le dixième : un GOP de 12 images coûte à peu près trois images I.');
  f.append(txt(10, 16, 'Intra : dans l\'image', 'co-t', 'start'));
  const row = [['Blocs', '8 × 8, 16 × 16…'], ['Transformée', 'DCT, ondelettes'], ['Quantification', 'on arrondit : la perte'], ['Entropie', 'codage sans perte']];
  row.forEach(([a, b], i) => { const x = 10 + i * 176; f.append(box(x, 28, 160, 44, i === 2 ? C.amber : C.grey), txt(x + 80, 46, a, 'co-t'), txt(x + 80, 62, b, 'co-s')); if (i < row.length - 1) f.append(arrow(x + 162, 50, x + 174, 50)); });
  f.append(txt(10, 92, 'L\'œil voit mal les détails fins et la couleur : le quantificateur les arrondit d\'abord. Plus on arrondit, moins de bits, plus de blocs visibles.', 'co-s', 'start'));
  f.append(txt(10, 122, 'Inter : d\'une image à l\'autre, le GOP', 'co-t', 'start'));
  const seq = 'IBBPBBPBBPBB'.split(''), G = gop(12, 3);
  seq.forEach((k, i) => {
    const x = 10 + i * 58, h = k === 'I' ? 70 : k === 'P' ? 26 : 9, col = k === 'I' ? C.amber : k === 'P' ? C.cyan : C.grey;
    f.append(sv('rect', { x, y: 206 - h, width: 50, height: h, fill: col, opacity: 0.85 }), txt(x + 25, 222, k, 'co-t'));
  });
  f.append(arrow(70, 140, 180, 140, C.cyan), txt(125, 136, 'P : prédite de la précédente', 'co-s'));
  f.append(arrow(60, 160, 36, 160, C.grey), arrow(66, 160, 180, 160, C.grey), txt(125, 174, 'B : prédite des deux côtés', 'co-s'));
  f.append(txt(400, 140, `GOP de 12, M = 3 : ${G.I} I, ${G.P} P, ${G.B} B`, 'co-s', 'start'), txt(400, 156, `poids ≈ ${fmtNum(G.poids, 1)} images I au lieu de 12 : ${fmtNum(gainGop(12, 3), 1)} fois moins`, 'co-s', 'start'), txt(400, 172, 'le prix : une coupe au milieu du GOP doit remonter à l\'image I ;', 'co-s', 'start'), txt(400, 186, 'une image B attend la suivante : de la latence', 'co-s', 'start'));
  f.append(txt(10, 250, 'Tout intra (AVC-Intra, ProRes, JPEG XS) : chaque image seule, montage et coupe libres, latence minimale, débit plus haut.', 'co-s', 'start'));
  return f;
}
function demoCompression(host) {
  let img = '1080', ips = 50, ech = '422', bits = 10, codec = 'xdcam', duree = 90, n = 12, m = 3;
  const read = readout(['Image active non compressée', 'Avec ce codec', 'Taux de compression', 'Une minute de fichier', 'Le match entier', 'Le GOP choisi', 'Latence due au GOP']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const I = IMAGES.find((x) => x.id === img) || IMAGES[1];
    const brut = debitActif(I.w, I.h, ech, bits, ips);
    const K = CODECS.find((c) => c.id === codec) || CODECS[0];
    const kIps = ips === 50 && K.id === 'prores' ? 2 : 1; // ProRes : débit donné à 25 i/s
    const kUhd = I.id === '2160' ? 4 : I.id === '720p' ? 0.5 : 1;
    const deb = K.mbs * 1e6 * kIps * kUhd;
    const t = taux(brut, deb);
    const G = gop(n, m);
    read.set('Image active non compressée', `${fmtNum(I.w)} × ${fmtNum(I.h)} × ${ech === '444' ? 3 : ech === '422' ? 2 : '1,5'} × ${bits} × ${ips} = ${mb(brut)}`);
    read.set('Avec ce codec', `${K.nom} : ${mb(deb)} (${K.codec}${kUhd !== 1 || kIps !== 1 ? ', rapporté à ce format' : ''})`);
    read.set('Taux de compression', `${fmtNum(t, t > 20 ? 0 : 1)}:1`);
    read.set('Une minute de fichier', `${octets(tailleOctets(deb, 60))} (non compressé : ${octets(tailleOctets(brut, 60))})`);
    read.set('Le match entier', `${duree} min : ${octets(tailleOctets(deb, duree * 60))}`);
    read.set('Le GOP choisi', K.intra ? 'tout intra : chaque image seule, pas de GOP' : `${n} images, M = ${m} : ${G.I} I, ${G.P} P, ${G.B} B ; ${fmtNum(gainGop(n, m), 1)} fois moins qu'en tout intra à qualité d'image I égale`);
    read.set('Latence due au GOP', K.intra ? 'quelques lignes (JPEG XS) à une image' : `${m > 1 ? `une image B attend ${m - 1} image${m > 2 ? 's' : ''} : ${fmtNum((m - 1) * 1000 / ips, 0)} ms` : 'pas de B : une image'} ; un décodeur qui prend le flux en route attend l'image I suivante, jusqu'à ${fmtNum(n * 1000 / ips, 0)} ms`);
    verdict.className = 'co-verdict ' + (t > 150 ? 'warn' : 'ok');
    verdict.textContent = K.id === 'diff' ? `${fmtNum(t, 0)}:1 : ce que reçoit le téléspectateur. Chaque étape avant lui (acquisition, contribution, PAD) a gardé plus de qualité pour que cette dernière compression ne s'ajoute pas à des défauts déjà là.` : K.intra ? `Tout intra : montage à l'image près et latence minimale, au prix d'un débit ${fmtNum(deb / (CODECS[0].mbs * 1e6 * kUhd), 1)} fois plus haut que le XDCAM 50.` : t > 60 ? `${fmtNum(t, 0)}:1 en GOP long : assez pour une contribution de qualité, pas pour y refaire un montage ou une incrustation.` : `${fmtNum(t, 1)}:1 : une compression modérée, qui supporte le montage et plusieurs générations.`;
  };
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Image', IMAGES.map((i) => [i.id, i.nom]), img, (v) => { img = v; draw(); }),
      choice('Images par seconde', [['25', '25'], ['50', '50']], '50', (v) => { ips = +v; draw(); }),
      choice('Échantillonnage', [['444', '4:4:4'], ['422', '4:2:2'], ['420', '4:2:0']], '422', (v) => { ech = v; draw(); }),
      choice('Bits', [['8', '8 bits'], ['10', '10 bits']], '10', (v) => { bits = +v; draw(); })),
    el('div', { class: 'co-ctl' },
      choice('Codec', CODECS.map((c) => [c.id, c.nom, c.usage]), codec, (v) => { codec = v; draw(); }),
      slider('Durée', 5, 180, duree, 5, (v) => { duree = v; draw(); }, (v) => `${v} min`),
      slider('Longueur du GOP', 1, 60, n, 1, (v) => { n = v; m = Math.min(m, n); draw(); }, (v) => (v === 1 ? '1 (tout intra)' : `${v} images`)),
      slider('Distance entre références (M)', 1, 4, m, 1, (v) => { m = v; draw(); }, (v) => (v === 1 ? '1 : I et P seulement' : `${v} : ${v - 1} B entre deux références`))),
    verdict, read.el);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const SIGNAL_COMPRESSION = {
  id: 'signal-compression', title: 'La compression vidéo : intra, inter, débits', minutes: '9 min',
  essentials: [
    'Une image active en 1080p50 4:2:2 10 bits fait **2 Gb/s** : on la **compresse** pour l\'enregistrer et la transmettre, en retirant ce que l\'œil ne voit pas (**intra**, dans l\'image) et ce qui ne change pas (**inter**, d\'une image à l\'autre : le **GOP**, images I, P, B).',
    'Le car travaille avec des codecs de **contribution** et d\'**enregistrement** : **XDCAM HD422 à 50 Mb/s** (le PAD), AVC-Intra et ProRes (tout intra, montage), H.264 ou HEVC vers la chaîne (10 à 20 Mb/s), **JPEG XS** (10:1, quelques lignes de latence) ; le téléspectateur reçoit 7 Mb/s.',
    'Plus on compresse, moins ça pèse, mais plus il y a de défauts (blocs, flou, bavures sur la foule) et de **latence** (le GOP) : chaque codec est un compromis débit, qualité, délai.',
  ],
  figure: figCompression,
  demoTitle: 'Comptez le débit brut d\'un 1080p50, puis essayez chaque codec et lisez le taux et la taille du match. Allongez le GOP et regardez le poids et la latence ; passez en tout intra.',
  demo: demoCompression,
  body: `Non compressée, une image active 1080p50 en 4:2:2 10 bits pèse 1 920 × 1 080 × 2 × 10 × 50 = **2,07 Gb/s** (2,97 Gb/s avec la suppression, en SDI : leçon sur les formats). Le SDI et le ST 2110-20 la transportent telle quelle dans le car, où la qualité se joue ; mais pour l'**enregistrer** (15 Go par minute) et la **transmettre** (une liaison IP ou satellite de quelques dizaines de mégabits), il faut la **compresser**, c'est-à-dire ne garder que ce qui compte.

La compression **intra** travaille **dans l'image**. Elle la découpe en blocs, les transforme (DCT dans MPEG-2 et H.264, ondelettes dans JPEG 2000 et JPEG XS) pour séparer les grandes surfaces des détails fins, **quantifie** (arrondit) ces détails que l'œil voit mal, c'est là que l'on perd, puis code le reste sans perte (entropie). Ce sont les codecs **tout intra** : chaque image est indépendante, on coupe et l'on monte à l'image près, la latence est d'une image au plus, mais le débit reste élevé (AVC-Intra 100 à 100 Mb/s, ProRes 422 HQ à 176 Mb/s en 1080p25 et 352 en p50, JPEG XS vers 300 Mb/s pour du 3G, en 10:1). La compression **inter** y ajoute le **temps** : dans un match, d'une image à l'autre, la tribune ne bouge pas. Le **GOP** (group of pictures) commence par une image **I** complète (intra), suivie d'images **P** prédites de la précédente (on ne transmet que les blocs qui changent, avec leurs **vecteurs de mouvement**) et d'images **B** prédites des deux côtés, les plus légères. Une P pèse environ le tiers d'une I, une B le dixième : un GOP de 12 (IBBPBBPBBPBB) coûte trois images I au lieu de douze. Le prix : pour couper ou décoder au milieu, il faut remonter à l'I ; une image B attend la suivante (de la **latence**) ; un mouvement de foule, imprévisible, fait exploser le débit ou bave.

Les codecs du car, par usage. **XDCAM HD422** (MPEG-2 4:2:2 8 bits, GOP long, **50 Mb/s**) : le format du **PAD** des chaînes françaises et de l'enregistrement de secours, robuste, décodé partout. **AVC-Intra 100** et **ProRes 422 HQ** : tout intra, 10 bits, pour les fichiers de montage et les ralentis. En **contribution** (du car vers la chaîne, par IP ou satellite), **H.264** (AVC) 4:2:2 10 bits à 15 à 25 Mb/s en GOP long, ou **HEVC** (H.265) qui fait la même qualité avec deux fois moins (et porte l'UHD) ; le codeur de transmission règle le débit, le GOP et la latence (300 ms à 2 s, tampon compris). **JPEG XS** (ST 2110-22) : intra par groupes de lignes, latence de quelques lignes, 6:1 à 10:1 : il fait passer un flux ST 2110 dans un lien 10 GbE ou vers une production à distance sans perdre le direct. Et tout au bout, la **diffusion** : H.264 4:2:0 8 bits à 6 à 8 Mb/s sur la TNT, HEVC pour l'UHD, 5 à 8 Mb/s en streaming adaptatif ; cette dernière compression est faite pour l'œil du téléspectateur, à condition qu'on ne lui ait pas déjà donné une image abîmée en amont : chaque génération de compression ajoute ses défauts à ceux de la précédente.

Le débit se lit avec le **profil** et le **niveau** du codec (4:2:2 10 bits ou 4:2:0 8 bits ; CBR, débit constant pour une liaison, ou VBR, variable pour un fichier) et le **conteneur** qui l'enveloppe (MXF OP1a pour le PAD, MP4, MOV, TS pour le transport). Les défauts d'une compression trop forte se reconnaissent : **blocs** sur les aplats, **flou** et **bavures** sur les mouvements rapides (la foule qui ondule), **banding** sur les dégradés en 8 bits, et des images qui « sautent » quand le réseau perd un GOP entier.

- Taille d'un fichier : débit × durée ÷ 8. À 50 Mb/s, 375 Mo par minute, 34 Go pour un match de 90 min.
- Taux de compression : débit brut ÷ débit compressé. 2,07 Gb/s en 50 Mb/s : 41:1 ; en 7 Mb/s à l'antenne : près de 300:1.`,
  car: { text: 'Au poste transmission, le codeur de contribution (H.264 ou HEVC) et son débit vers la chaîne ; à l\'IPDirector, les clips et le PAD en XDCAM HD422 50 Mb/s ; en car IP, le JPEG XS du ST 2110-22. La leçon Le PAD reprend le fichier livré.', station: 'transmission' },
  terms: ['codec', 'gop', 'st2110-22'],
  competences: ['C14', 'C26', 'C33'], savoirs: ['C8', 'E5', 'E6', 'C4'],
  quiz: [
    { q: 'Combien pèse une image active 1080p50 4:2:2 10 bits, non compressée ?', choices: ['Environ 2 Gb/s', ['Environ 50 Mb/s', '50 Mb/s, c\'est le XDCAM HD422, déjà compressé 41 fois.'], ['Environ 200 Mb/s', 'C\'est l\'ordre de grandeur d\'un codec tout intra (ProRes), pas du signal brut : 1 920 × 1 080 × 2 × 10 × 50 = 2,07 Gb/s.']], answer: 0, why: '1 920 × 1 080 pixels × 2 échantillons (4:2:2) × 10 bits × 50 images = 2,07 Gb/s pour l\'image active ; 2,97 Gb/s avec la suppression en 3G-SDI.' },
    { q: 'Dans un GOP, quelle image est complète et décodable seule ?', choices: ['L\'image I (intra)', ['L\'image P', 'La P est prédite de l\'image précédente : sans elle, impossible de la reconstruire.'], ['L\'image B', 'La B est prédite des deux côtés : la plus légère, la plus dépendante.']], answer: 0, why: 'L\'I est codée en intra, seule ; les P et B ne portent que les différences. D\'où le temps d\'accrochage d\'un décodeur et les coupes qui doivent remonter à l\'I.' },
    { q: 'Quel codec pour le PAD d\'une chaîne française ?', choices: ['XDCAM HD422 à 50 Mb/s (MPEG-2 4:2:2)', ['H.264 à 7 Mb/s', 'C\'est le débit de diffusion TNT, bien trop compressé pour un PAD, qui sera recompressé.'], ['JPEG XS', 'JPEG XS sert au transport en production (ST 2110-22), pas aux fichiers livrés.']], answer: 0, why: 'Le XDCAM HD422 50 Mb/s en MXF OP1a est le format de PAD le plus répandu en France : robuste, 4:2:2, décodé partout (leçon Le PAD).' },
    { q: 'Pourquoi un codeur en GOP long ajoute-t-il de la latence ?', choices: ['Une image B attend les images suivantes pour être codée, et le décodeur attend l\'image I pour s\'accrocher', ['Parce que les fichiers sont plus gros', 'Le GOP long rend les fichiers plus petits, pas plus gros.'], ['Parce qu\'il calcule la DCT', 'La transformée est instantanée à l\'échelle d\'une image ; c\'est l\'attente des images de référence qui coûte du temps.']], answer: 0, why: 'Les B sont prédites des deux côtés : il faut avoir la référence suivante avant de les coder. Un décodeur qui prend le flux en route attend l\'I. Le tout intra n\'a pas ce délai.' },
    { q: 'Un fichier à 50 Mb/s pendant 90 minutes pèse environ…', choices: ['34 Go', ['270 Go', 'C\'est en mégabits, pas en octets : divisez par 8.'], ['4 Go', '50 Mb/s × 5 400 s = 270 000 Mb, soit 33 750 Mo.']], answer: 0, why: '50 Mb/s × 5 400 s ÷ 8 = 33 750 Mo ≈ 34 Go. Une minute : 375 Mo.' },
    { q: 'Quels défauts trahissent une compression trop forte sur la foule qui ondule ?', choices: ['Des blocs, du flou et des bavures sur les mouvements', ['Un son décalé', 'La synchro labiale ne dépend pas du taux de compression de l\'image.'], ['Une image plus sombre', 'La compression ne change pas les niveaux : elle enlève du détail.']], answer: 0, why: 'La foule est imprévisible pour le codeur inter : il manque de bits, et les blocs, le flou et les bavures apparaissent, surtout en GOP long à bas débit.' },
  ],
};
