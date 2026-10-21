// @ts-check

// ----------------------------------------------------------------------------------
// Schémas des fiches du module caméra : du SVG écrit à la main, à l'échelle du panneau (440 px
// de large), couleurs de l'interface (classes cf-* de camlab.css). Un schéma par fiche, nommé
// par le champ `fig` de la fiche. Les chiffres sont ceux des fiches : capteur 2/3" (9,59 mm de
// large, cercle de confusion 0,011 mm), Fujinon ZA12x4.5BERD, mode d'emploi HXC-FB80.
// ----------------------------------------------------------------------------------

import { svg, tx, head, rays, dim, n1 } from './figkit.js';
import { FIGS_CH1 } from './figs/ch1.js';
import { FIGS_CH23 } from './figs/ch23.js';
import { FIGS_CH4 } from './figs/ch4.js';
import { FIGS_CH56 } from './figs/ch56.js';
import { FIGS_CH7 } from './figs/ch7.js';
import { FIGS_CH89 } from './figs/ch89.js';


/** une rangée du schéma du tirage : objectif, monture, prisme, capteur ; les rayons convergent en xf */
function tirageRow(y, title, sub, xf, ok) {
  const cy = y + 92, xs = 262, top = cy - 30, bot = cy + 30;
  const lens = `<rect class="cf-lens" x="26" y="${cy - 36}" width="104" height="72" rx="10"/><text class="cf-in" x="78" y="${cy + 4}">objectif</text>`;
  const mount = `<line class="cf-mount" x1="146" y1="${cy - 44}" x2="146" y2="${cy + 44}"/><text class="cf-s" x="146" y="${cy + 58}">monture</text>`;
  const prism = `<rect class="cf-prism" x="178" y="${cy - 26}" width="56" height="52" rx="2"/><text class="cf-s" x="206" y="${cy + 42}">prisme</text>`;
  const sensor = `<line class="cf-sensor${ok ? '' : ' bad'}" x1="${xs}" y1="${cy - 24}" x2="${xs}" y2="${cy + 24}"/><text class="cf-s" x="${xs}" y="${cy + 42}">capteur</text>`;
  // au-delà du point de convergence, les rayons continuent jusqu'au capteur : une tache au lieu d'un point
  const k = (xs - xf) / (xf - 130);
  const spread = ok ? '' : [top, bot].map((v) => `<line class="cf-ray" x1="${xf}" y1="${cy}" x2="${xs}" y2="${cy + (cy - v) * k}"/>`).join('');
  const spot = ok ? `<circle class="cf-dot" cx="${xs}" cy="${cy}" r="3.5"/>` : `<line class="cf-spot" x1="${xs}" y1="${cy - 30 * k}" x2="${xs}" y2="${cy + 30 * k}"/>`;
  const d = `${dim(146, cy + 70, xs, cy + 70)}<text class="cf-s" x="${(146 + xs) / 2}" y="${cy + 84}">48 mm : le tirage de la monture B4</text>`;
  return `<text class="cf-t${ok ? ' ok' : ' bad'}" x="16" y="${y + 16}">${title}</text><text class="cf-sub" x="16" y="${y + 34}">${sub}</text>
    ${lens}${mount}${prism}${rays(130, [top, cy, bot], xf, cy)}${spread}${sensor}${spot}${ok ? d : ''}`;
}

/** une rangée du schéma de l'angle de champ : la caméra, le champ, la mire à 3 m */
function champRow(y, id, title, sub, tan, width) {
  const cy = y + 70, x0 = 62, L = 368, dy = L * tan, xm = x0 + 170; // 1 m = 56,7 px
  const half = Math.min(170 * tan, 44);
  return `<clipPath id="cf-clip-${id}"><rect x="0" y="${y + 38}" width="440" height="88"/></clipPath>
    ${tx(16, y + 16, title, 'cf-t')}${tx(16, y + 32, sub, 'cf-sub')}
    <g clip-path="url(#cf-clip-${id})"><polygon class="cf-wedge" points="${x0},${cy} ${x0 + L},${n1(cy - dy)} ${x0 + L},${n1(cy + dy)}"/></g>
    <rect class="cf-body" x="14" y="${cy - 14}" width="34" height="28" rx="3"/><rect class="cf-lens" x="48" y="${cy - 9}" width="14" height="18" rx="3"/>
    <line class="cf-dash" x1="${xm}" y1="${y + 40}" x2="${xm}" y2="${y + 124}"/>${tx(xm - 5, y + 52, 'mire à 3 m', 'cf-s r')}
    ${dim(xm + 14, n1(cy - half), xm + 14, n1(cy + half))}${tx(xm + 22, cy + 4, width, 'cf-lbl l')}`;
}

/** une rangée du schéma de la mise au point : d'où viennent les rayons, où ils se croisent */
function pointRow(y, title, sub, near, shift) {
  const cy = y + 66, xl = 150, xs = 262, xf = near && !shift ? xs + 28 : xs; // où l'image se forme
  const xg = 112 - (shift ? 16 : 0); // le groupe frontal, avancé par la bague de point
  const inRays = near ? [cy - 22, cy, cy + 22].map((v) => `<line class="cf-ray" x1="30" y1="${cy}" x2="${xl}" y2="${v}"/>`).join('') : [cy - 22, cy, cy + 22].map((v) => `<line class="cf-ray" x1="20" y1="${v}" x2="${xl}" y2="${v}"/>`).join('');
  const k = (xs - xl) / (xf - xl);
  const outRays = [cy - 22, cy, cy + 22].map((v) => `<line class="cf-ray" x1="${xl}" y1="${v}" x2="${xf}" y2="${cy}"/>`).join('');
  const spot = xf === xs ? `<circle class="cf-dot" cx="${xs}" cy="${cy}" r="3.5"/>` : `<line class="cf-spot" x1="${xs}" y1="${n1(cy - 22 * (1 - k))}" x2="${xs}" y2="${n1(cy + 22 * (1 - k))}"/>`;
  const subject = near ? `<circle class="cf-dot" cx="30" cy="${cy}" r="4"/>${tx(30, cy + 36, 'sujet à 1 m')}` : tx(34, cy + 36, 'sujet très loin');
  const arrow = shift ? `${dim(xg - 4, cy + 42, xg + 24, cy + 42)}${tx(xg + 10, cy + 56, 'la bague avance le groupe')}` : '';
  return `${tx(16, y + 16, title, 'cf-t')}${tx(16, y + 32, sub, 'cf-sub')}
    ${subject}${inRays}<rect class="cf-lens" x="${xg}" y="${cy - 30}" width="12" height="60" rx="4"/><rect class="cf-lens" x="${xl - 10}" y="${cy - 26}" width="20" height="52" rx="6"/>${outRays}
    <line class="cf-sensor${xf === xs ? '' : ' bad'}" x1="${xs}" y1="${cy - 24}" x2="${xs}" y2="${cy + 24}"/>${tx(xs, cy + 40, 'capteur')}${spot}${arrow}`;
}

/** trois barres R, G, B avec leur titre et leur légende */
function rgbBars(x0, title, sub, hs, caption) {
  const base = 176, cls = ['cf-bar-r', 'cf-bar-g', 'cf-bar-b'], names = ['R', 'G', 'B'];
  const bars = hs.map((h, i) => { const H = Math.max(2, h * 50); return `<rect class="${cls[i]}" x="${x0 + i * 36}" y="${n1(base - H)}" width="28" height="${n1(H)}" rx="2"/>${tx(x0 + 14 + i * 36, base + 14, names[i], 'cf-tick')}${tx(x0 + 14 + i * 36, n1(base - H - 5), h > 0.15 ? '×' + h.toFixed(2).replace('.', ',').replace(/0$/, '').replace(/,$/, '') : '0', 'cf-tick')}`; }).join('');
  return `<line class="cf-axis" x1="${x0 - 6}" y1="${base}" x2="${x0 + 106}" y2="${base}"/>${tx(x0 + 50, 54, title, 'cf-bb mid')}${tx(x0 + 50, 68, sub)}${bars}${tx(x0 + 50, 208, caption, 'cf-s')}`;
}

const BASE = {
  /** le tirage juste et le tirage faux ; la règle du réglage */
  tirage: () => svg(372, 'Schéma : avec un tirage juste, les rayons se rejoignent sur le capteur ; avec un tirage faux, ils se rejoignent avant et font une tache floue.', `
    ${tirageRow(4, 'Tirage juste', 'L\'image se forme exactement sur le capteur : un point net.', 262, true)}
    ${tirageRow(196, 'Tirage faux', 'L\'image se forme avant le capteur : le point devient une tache.', 236, false)}
    <g transform="translate(290 52)"><rect class="cf-box" x="0" y="0" width="140" height="96" rx="3"/>
      <text class="cf-bt" x="10" y="20">La règle</text>
      <text class="cf-bs" x="10" y="42">En serré (54 mm) :</text><text class="cf-bb" x="10" y="58">la bague de point</text>
      <text class="cf-bs" x="10" y="76">En large (4,5 mm) :</text><text class="cf-bb" x="10" y="92">la bague F.f</text></g>
    <g transform="translate(290 244)"><rect class="cf-box" x="0" y="0" width="140" height="96" rx="3"/>
      <text class="cf-bt" x="10" y="20">Pourquoi en large</text>
      <text class="cf-bs" x="10" y="42">La bague de point agit</text><text class="cf-bs" x="10" y="58">comme la focale au carré :</text>
      <text class="cf-bs" x="10" y="74">144 fois moins à 4,5 mm</text><text class="cf-bs" x="10" y="90">qu'à 54 mm.</text></g>`),

  /** l'angle de champ au grand angle et au téléobjectif, et la largeur du champ à 3 m */
  focale: () => svg(268, 'Schéma vu de dessus : à 4,5 mm la caméra voit 94° et 6,4 m de large à 3 m ; à 54 mm, 10° et 53 cm.', `
    ${champRow(0, 'w', '4,5 mm : le grand angle', 'Angle de champ 94°. À 3 m, le champ fait 6,4 m de large.', Math.tan(Math.PI / 180 * 46.8), '6,4 m')}
    ${champRow(130, 't', '54 mm : le téléobjectif', 'Angle de champ 10°, douze fois plus étroit.', Math.tan(Math.PI / 180 * 5.07), '53 cm')}
    ${tx(220, 262, 'Largeur du champ = distance × 9,59 ÷ focale (le capteur fait 9,59 mm de large)', 'cf-s')}`),

  /** les groupes du zoom qui bougent, l'image qui ne bouge pas, et l'échelle des focales */
  zoom: () => {
    const cy = 98;
    const grp = (x, w, h, label, dy = 50) => `<rect class="cf-lens" x="${x}" y="${cy - h / 2}" width="${w}" height="${h}" rx="4"/>${tx(x + w / 2, cy + dy, label)}`;
    const xf = (f) => 30 + 380 * Math.log(f / 4.5) / Math.log(12);
    const ticks = [4.5, 8, 15, 30, 54].map((f) => `<line class="cf-axis" x1="${n1(xf(f))}" y1="196" x2="${n1(xf(f))}" y2="204"/>${tx(n1(xf(f)), 218, String(f).replace('.', ','), 'cf-tick')}`).join('');
    return svg(258, 'Schéma : dans le zoom, le variateur et le compensateur se déplacent ; l\'image reste sur le capteur. Échelle des focales de 4,5 à 54 mm, 9 à 108 mm avec le doubleur.', `
      ${head('Un zoom parfocal', 'Deux groupes se déplacent ensemble ; l\'image reste sur le capteur.')}
      ${tx(150, 50, 'la focale change')}${dim(90, 57, 140, 57)}${dim(160, 57, 212, 57)}
      <rect class="cf-body" x="20" y="${cy - 36}" width="300" height="72" rx="6"/>
      ${rays(20, [cy - 20, cy, cy + 20], 340, cy)}
      ${grp(32, 22, 58, 'frontal')}${grp(100, 14, 40, 'variateur')}${grp(176, 14, 40, 'compensateur', 64)}<line class="cf-mount" x1="236" y1="${cy - 16}" x2="236" y2="${cy + 16}"/>${tx(236, cy + 50, 'iris')}${grp(268, 18, 46, 'relais')}
      <line class="cf-sensor" x1="340" y1="${cy - 24}" x2="340" y2="${cy + 24}"/><circle class="cf-dot" cx="340" cy="${cy}" r="3.5"/>${tx(340, cy + 40, 'capteur')}
      ${tx(16, 178, 'Les focales de l\'objectif : 4,5 à 54 mm, rapport 12', 'cf-bt')}
      <line class="cf-axis" x1="30" y1="200" x2="410" y2="200"/>${ticks}
      <rect class="cf-zone" x="${n1(xf(9))}" y="230" width="${n1(410 - xf(9))}" height="7" rx="2"/><path class="cf-arrow" d="M410 227 L420 233.5 L410 240 z"/>
      ${tx(30, 251, 'doubleur ×2 : 9 à 108 mm, et deux diaphragmes de moins', 'cf-sub')}`);
  },

  /** l'image recule quand le sujet s'approche ; la bague de point la ramène ; l'échelle de la bague */
  point: () => {
    const pos = (d) => Math.pow(0.3 / d, 0.45), X = (d) => 40 + 360 * (d === Infinity ? 0 : pos(d));
    const scale = [[Infinity, '∞'], [5, '5'], [2, '2'], [1, '1'], [0.5, '0,5'], [0.3, '0,3']].map(([d, t]) => `<line class="cf-axis" x1="${n1(X(d))}" y1="262" x2="${n1(X(d))}" y2="276"/>${tx(n1(X(d)), 292, t, 'cf-tick')}`).join('');
    return svg(308, 'Schéma : un sujet lointain forme son image sur le capteur ; un sujet proche la forme derrière, et la bague de point avance le groupe frontal pour la ramener sur le capteur. Échelle de la bague : ∞, 5, 2, 1, 0,5 et 0,3 m.', `
      ${pointRow(0, 'Sujet lointain, bague sur ∞', 'Les rayons arrivent parallèles : l\'image se forme sur le capteur.', false, false)}
      ${pointRow(118, 'Sujet à 1 m : la bague de point avance le groupe frontal', 'Sans ce geste, l\'image se formerait derrière le capteur : une tache.', true, true)}
      <rect class="cf-body" x="40" y="262" width="360" height="14" rx="3"/>${scale}
      ${tx(16, 252, 'L\'échelle de la bague (en m) : serrée vers ∞, étalée vers 0,3 m', 'cf-bt')}`);
  },

  /** le trou de l'iris à chaque cran, et la lumière qui passe */
  iris: () => {
    const N = [['2', 22, '1'], ['2,8', 15.7, '1/2'], ['4', 11, '1/4'], ['5,6', 7.9, '1/8'], ['8', 5.5, '1/16'], ['11', 4, '1/32'], ['16', 2.8, '1/64'], ['C', 0, '0']];
    const hex = (cx, cy, r) => (r <= 0 ? '' : `<polygon class="cf-hole" points="${[0, 1, 2, 3, 4, 5].map((i) => { const a = Math.PI / 3 * i + Math.PI / 6; return `${n1(cx + r * Math.cos(a))},${n1(cy + r * Math.sin(a))}`; }).join(' ')}"/>`);
    const cells = N.map(([t, r, l], i) => { const cx = 46 + i * 52, cy = 80; return `<circle class="cf-blade" cx="${cx}" cy="${cy}" r="24"/>${hex(cx, cy, r)}${tx(cx, 122, t === 'C' ? 'C' : 'f/' + t, 'cf-lbl')}${tx(cx, 138, l, 'cf-tick')}`; }).join('');
    return svg(196, 'Schéma : le trou de l\'iris vu de face à f/2, 2,8, 4, 5,6, 8, 11, 16 et C ; à chaque cran la lumière est divisée par deux.', `
      ${head('Chaque cran divise la lumière par deux', 'Le trou vu de face ; en dessous, la part de lumière qui passe.')}
      ${cells}
      ${tx(16, 166, 'N = focale ÷ diamètre du trou : à 20 mm, f/4 est un trou de 5 mm.', 'cf-sub')}
      ${tx(16, 182, 'f/1,8 est l\'ouverture maximale de l\'objectif, un tiers de cran avant f/2.', 'cf-sub')}`);
  },

  /** la zone nette à 3 m pour quatre réglages, sur une échelle des distances */
  pdc: () => {
    const X = (d) => 60 + d * 60;
    const R = [['54 mm · f/1,8', 2.94, 3.06, '12 cm'], ['54 mm · f/8', 2.75, 3.3, '55 cm'], ['20 mm · f/4', 2.26, 4.48, '2,2 m'], ['4,5 mm · f/1,8', 0.76, Infinity, 'de 76 cm à l\'infini']];
    const rows = R.map(([l, a, b, w], i) => {
      const y = 62 + i * 36, x1 = X(/** @type {number} */ (a)), x2 = isFinite(/** @type {number} */ (b)) ? X(/** @type {number} */ (b)) : 416, wide = x2 - x1 > 120;
      return `${tx(62, y - 4, l, 'cf-lbl l')}<rect class="cf-zone" x="${n1(x1)}" y="${y}" width="${n1(Math.max(3, x2 - x1))}" height="10" rx="2"/>${isFinite(/** @type {number} */ (b)) ? '' : `<path class="cf-arrow" d="M416 ${y - 2} L426 ${y + 5} L416 ${y + 12} z"/>`}${tx(wide ? n1(x1 + 6) : n1(x2 + 6), y + 9, w, wide ? 'cf-tick l ink' : 'cf-tick l')}`;
    }).join('');
    const ticks = [0, 1, 2, 3, 4, 5, 6].map((d) => `<line class="cf-axis" x1="${X(d)}" y1="212" x2="${X(d)}" y2="217"/>${tx(X(d), 230, d + ' m', 'cf-tick')}`).join('');
    return svg(236, 'Schéma : la zone nette, point à 3 m. 12 cm à 54 mm f/1,8 ; 55 cm à 54 mm f/8 ; de 2,3 à 4,5 m à 20 mm f/4 ; de 76 cm à l\'infini à 4,5 mm f/1,8.', `
      ${head('La zone nette, point à 3 m', 'Elle grandit quand on ferme l\'iris, quand on élargit, quand on s\'éloigne.')}
      <line class="cf-dash" x1="240" y1="44" x2="240" y2="212"/>${tx(240, 42, 'point à 3 m')}
      <rect class="cf-body" x="22" y="124" width="26" height="22" rx="3"/><rect class="cf-lens" x="48" y="128" width="10" height="14" rx="2"/>
      ${rows}<line class="cf-axis" x1="60" y1="212" x2="420" y2="212"/>${ticks}`);
  },

  /** les quatre positions du bouton FILTER, et ce qui passe */
  nd: () => {
    const F = [['1 · CLEAR', 0, 40, '1', '0 diaph.'], ['2 · 1/4 ND', 0.62, 10, '1/4', '− 2 diaph.'], ['3 · 1/16 ND', 0.86, 2.5, '1/16', '− 4 diaph.'], ['4 · 1/64 ND', 0.95, 1, '1/64', '− 6 diaph.']];
    const cells = F.map(([t, op, h, l, s], i) => { const cx = 70 + i * 100; return `${tx(cx, 50, t, 'cf-lbl')}<rect class="cf-nd0" x="${cx - 34}" y="58" width="68" height="60" rx="3"/><rect x="${cx - 34}" y="58" width="68" height="60" rx="3" fill="rgba(0,0,0,${op})"/><rect class="cf-beam" x="${cx - 34}" y="${n1(170 - +h)}" width="68" height="${h}"/>${tx(cx, 188, l, 'cf-lbl')}${tx(cx, 203, s, 'cf-tick')}`; }).join('');
    return svg(212, 'Schéma : les quatre positions du bouton FILTER, CLEAR, 1/4, 1/16 et 1/64, et la lumière qui passe : toute, un quart, un seizième, un soixante-quatrième.', `
      ${head('Les quatre positions du bouton FILTER', 'Au-dessus, le verre ; en dessous, la lumière qui passe à travers.')}
      ${cells}`);
  },

  /** le bloc prisme : le bleu réfléchi en premier, puis le rouge, le vert tout droit */
  prisme: () => svg(256, 'Schéma : la lumière blanche entre dans le bloc prisme ; la première surface dichroïque réfléchit le bleu vers le capteur bleu, la seconde réfléchit le rouge vers le capteur rouge, le vert traverse jusqu\'au capteur vert.', `
    ${head('Le bloc prisme : une lumière, trois capteurs', 'Chaque surface dichroïque réfléchit une couleur et laisse passer le reste.')}
    <rect class="cf-prism" x="120" y="86" width="80" height="100"/><rect class="cf-prism" x="202" y="86" width="80" height="100"/>
    <line class="cf-dichro" x1="120" y1="186" x2="200" y2="86"/><line class="cf-dichro" x1="202" y1="86" x2="282" y2="186"/>
    <line class="cf-ray-w" x1="20" y1="136" x2="160" y2="136"/>${tx(60, 126, 'lumière blanche')}
    <line class="cf-ray-b" x1="160" y1="136" x2="160" y2="58"/><line class="cf-ray-y" x1="160" y1="136" x2="242" y2="136"/>
    <line class="cf-ray-r" x1="242" y1="136" x2="242" y2="214"/><line class="cf-ray-g" x1="242" y1="136" x2="330" y2="136"/>
    <line class="cf-sensor b" x1="140" y1="58" x2="180" y2="58"/>${tx(160, 50, 'capteur bleu', 'cf-lbl')}
    <line class="cf-sensor r" x1="222" y1="214" x2="262" y2="214"/>${tx(242, 230, 'capteur rouge', 'cf-lbl')}
    <line class="cf-sensor" x1="330" y1="116" x2="330" y2="156"/>${tx(330, 172, 'capteur vert', 'cf-lbl')}
    <line class="cf-dash" x1="201" y1="86" x2="201" y2="186"/>${tx(206, 204, 'lame d\'air', 'cf-s l')}
    ${tx(194, 204, '1. dichroïque bleu', 'cf-s r')}${tx(242, 80, '2. dichroïque rouge', 'cf-s')}
    <g transform="translate(350 44)"><rect class="cf-box" x="0" y="0" width="84" height="80" rx="3"/><text class="cf-bt" x="8" y="18">Luminance</text>
      <text class="cf-bs" x="8" y="38">0,21 R</text><text class="cf-bs" x="8" y="54">+ 0,72 G</text><text class="cf-bs" x="8" y="70">+ 0,07 B</text></g>`),

  /** le capteur, un photosite sous sa microlentille, le puits qui se remplit et le bruit */
  capteur: () => {
    const cells = [0, 1, 2].map((r) => [0, 1, 2].map((c) => { const x = 216 + c * 40, y = 44 + r * 40, hi = r === 1 && c === 1; return `<rect class="cf-cell${hi ? ' hi' : ''}" x="${x}" y="${y}" width="38" height="38" rx="2"/><path class="cf-ml" d="M${x + 3} ${y + 30} A16 14 0 0 1 ${x + 35} ${y + 30} Z"/>`; }).join('')).join('');
    return svg(236, 'Schéma : le capteur de 9,59 × 5,39 mm et ses 1920 × 1080 photosites ; neuf photosites vus de près sous leurs microlentilles ; le puits d\'un photosite, rempli d\'électrons, et le bruit qui vaut la racine carrée du signal.', `
      ${head('Un capteur 2/3", vu de loin et de près', 'Chaque photosite compte les photons qu\'il reçoit pendant 1/50 s.')}
      <rect class="cf-face" x="20" y="44" width="160" height="90" rx="2"/>${tx(100, 92, '1920 × 1080', 'cf-in')}${tx(100, 148, '9,59 × 5,39 mm')}
      <rect class="cf-dim-box" x="96" y="84" width="8" height="8"/><line class="cf-dash" x1="104" y1="84" x2="216" y2="44"/><line class="cf-dash" x1="104" y1="92" x2="216" y2="164"/>
      ${cells}${tx(276, 180, 'neuf photosites de 5 µm sous leurs microlentilles')}
      <rect class="cf-well" x="372" y="44" width="48" height="120" rx="3"/><rect class="cf-fill" x="374" y="84" width="44" height="78" rx="2"/>${tx(396, 58, 'le puits', 'cf-tick')}${tx(396, 76, 'e⁻', 'cf-tick')}
      ${tx(16, 206, '100 électrons → bruit ± 10, soit 10 % : du grain.', 'cf-bs')}${tx(16, 224, '10 000 électrons → bruit ± 100, soit 1 % : une image propre. Le bruit vaut √n.', 'cf-bs')}`);
  },

  /** avant et après la balance des blancs ; la balance des noirs */
  balance: () => svg(220, 'Schéma : sous tungstène vue avec un réglage lumière du jour, la voie rouge est à 1,66 et la bleue à 0,41 ; après la balance des blancs, les trois voies sont égales ; après la balance des noirs, les trois noirs sont à zéro.', `
    ${head('Un blanc, trois voies', 'Le rouge domine sous tungstène ; on règle les gains R et B.')}
    ${rgbBars(26, 'Avant la balance', 'réglée jour, filmée tungstène', [1.66, 1, 0.41], 'le blanc vire à l\'orange')}
    ${rgbBars(172, 'Après AWB', 'sur le carton blanc', [1, 1, 1], 'R = G = B : blanc')}
    ${rgbBars(318, 'ABB, iris fermé', 'les trois voies dans le noir', [0.06, 0.02, 0.08], 'noirs ramenés à zéro')}`),

  /** le TOP MENU dans le viseur, les quatre familles, la molette */
  menu: () => {
    const lines = ['<TOP MENU>', '', ' USER', ' USER MENU CUSTOMIZE', ' ALL', '▶OPERATION', ' PAINT', ' MAINTENANCE', ' FILE', ' DIAGNOSIS'].map((t, i) => tx(22, 56 + i * 12.5, t.replace('<', '&lt;').replace('>', '&gt;'), 'cf-mono' + (t.startsWith('▶') ? ' hi' : ''))).join('');
    const fam = [['OPERATION', 'cadreur : viseur, zebra, marqueurs'], ['PAINT', 'l\'image : gamma, knee, détail (RCP)'], ['MAINTENANCE', 'installation : système, réseau, date'], ['FILE', 'sauvegardes : scène, référence']].map(([n, d], i) => `<g transform="translate(242 ${44 + i * 34})"><rect class="cf-box" x="0" y="0" width="190" height="30" rx="3"/><text class="cf-bb" x="8" y="13">${n}</text><text class="cf-bs sm" x="8" y="25">${d}</text></g>`).join('');
    return svg(240, 'Schéma : le TOP MENU affiché dans le viseur (USER, USER MENU CUSTOMIZE, ALL, OPERATION, PAINT, MAINTENANCE, FILE, DIAGNOSIS), les quatre familles et ce qu\'elles contiennent, la molette qu\'on tourne et sur laquelle on appuie, le point d\'interrogation qui clignote.', `
      ${head('Le menu, dans le viseur', 'DISPLAY/MENU sur MENU : le TOP MENU se pose sur l\'image.')}
      <rect class="cf-vf" x="12" y="42" width="220" height="135" rx="3"/>${lines}
      ${fam}
      <circle class="cf-knob" cx="40" cy="214" r="17"/><rect class="cf-accent" x="38" y="199" width="4" height="10" rx="2"/>
      ${tx(66, 204, 'tourner : déplacer, changer', 'cf-bs')}${tx(66, 218, 'appuyer : entrer, enregistrer', 'cf-bs')}${tx(66, 232, 'CANCEL : annuler', 'cf-bs')}
      ${tx(242, 212, '? clignote : valeur en cours', 'cf-mono hi')}${tx(242, 226, 'de modification', 'cf-mono hi')}`);
  },

  /** la face arrière : chaque prise, par famille */
  connectique: () => {
    const P = [['DC IN', 50, 150, 26, 'alim'], ['EARPHONE', 112, 70, 9, 'son'], ['INTERCOM', 128, 150, 25, 'son'], ['AUDIO 2 IN', 206, 150, 25, 'son'], ['REMOTE', 282, 88, 15, 'alim'], ['DC OUT', 282, 158, 13, 'alim'], ['TEST OUT', 342, 88, 13, 'img'], ['PROMPTER|GENLOCK', 342, 158, 13, 'img'], ['SDI OUT', 398, 88, 13, 'img'], ['SDI I/O', 398, 158, 13, 'img']];
    const jacks = P.map(([n, x, y, r, f]) => `<circle class="cf-jk ${f}" cx="${x}" cy="${y}" r="${r}"/><circle class="cf-jk-pin" cx="${x}" cy="${y}" r="${+r * 0.35}"/>${String(n).split('|').map((l, i) => tx(x, +y + +r + 14 + i * 11, l, 'cf-jk-lbl')).join('')}`).join('');
    const leg = [['img', 'image (BNC)', 24], ['son', 'son, intercom (XLR, jack)', 118], ['alim', 'alimentation, commande', 266]].map(([f, t, x]) => `<circle class="cf-jk ${f}" cx="${x}" cy="40" r="5"/>${tx(+x + 10, 44, t, 'cf-lbl l')}`).join('');
    return svg(214, 'Schéma de la face arrière : DC IN, EARPHONE, INTERCOM, AUDIO 2 IN, REMOTE, DC OUT, TEST OUT, PROMPTER/GENLOCK, SDI OUT et SDI I/O, colorées par famille : image, son et intercom, alimentation et commande.', `
      ${head('La face arrière, par famille', 'Avec la CCU, la fibre porte presque tout : peu de prises servent.')}
      ${leg}<rect class="cf-plate" x="4" y="52" width="432" height="156" rx="8"/>
      <rect class="cf-sw" x="170" y="60" width="74" height="22" rx="3"/>${tx(207, 74, 'LINE · MIC · +48V', 'cf-tick')}
      ${jacks}`);
  },
};

/** tous les schémas : ceux du premier lot, puis ceux de chaque chapitre (figs/*.js) */
export const FIGS = { ...BASE, ...FIGS_CH1, ...FIGS_CH23, ...FIGS_CH4, ...FIGS_CH56, ...FIGS_CH7, ...FIGS_CH89 };
