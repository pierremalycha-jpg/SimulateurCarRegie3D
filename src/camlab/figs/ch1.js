// @ts-check
// Schémas des fiches du module caméra : L'objectif (chapitre 1). Un schéma par fiche, nommé par le champ `fig`.
// Aides communes : ../figkit.js (svg, tx, head, rays, dim, n1). Couleurs : classes cf-* de camlab.css et c1-* de
// camlab-ch1.css. Les chiffres sont ceux des fiches (fiche Fujinon ZA12x4.5BERD, mode d'emploi HXC-FB80, BTA S-1005),
// calculés quand ils peuvent l'être (Fresnel, géométrie du pare-soleil de la maquette, lentille mince).
import { svg, tx, head, rays, dim, n1 } from '../figkit.js';
import { COATS, transmission, SURFACES, HOOD, hoodShadow } from '../labs/ch1.js';

const pc = (v) => Math.round(v * 100) + ' %';
const frn = (v, d = 1) => v.toFixed(d).replace('.', ',');
/** un groupe de lentilles dans un barillet (x, largeur, hauteur, centre vertical) */
const grp = (x, w, h, cy) => `<rect class="cf-lens" x="${x}" y="${n1(cy - h / 2)}" width="${w}" height="${h}" rx="4"/>`;

/** la lentille frontale : le traitement sur 30 surfaces, l'ombre du pare-soleil, l'ordre du nettoyage */
function frontale() {
  const bars = COATS.map((c, i) => {
    const y = 70 + i * 44, T = transmission(c.R), w = 180 * T;
    return `${tx(16, y - 6, `${c.nom} · ${frn(c.R * 100)} % par surface`, 'cf-lbl l')}
      <rect class="c1-track" x="16" y="${y}" width="180" height="12" rx="2"/><rect class="cf-zone" x="16" y="${y}" width="${n1(w)}" height="12" rx="2"/>
      ${tx(n1(w > 150 ? 16 + w - 4 : 16 + w + 4), y + 10, pc(T), w > 150 ? 'cf-tick ink c1-r' : 'cf-tick l')}`;
  }).join('');
  // le pare-soleil vu de dessus, à l'échelle de la maquette 3D (0,8 pixel par millimètre)
  const s = 800, X0 = 262, cy = 182, r = HOOD.r * s, W = HOOD.W * s, d = HOOD.d * s, base = 0.05 * s;
  const xf = X0 + d, cut = hoodShadow(), half = Math.atan(9.59 / 2 / 4.5), deg = Math.round(cut * 180 / Math.PI);
  const fx = xf + 24, fy = cy - (fx - X0) * Math.tan(half);
  const px = xf + 22, py = cy - W - 22 * Math.tan(cut), ly = cy - W + d * Math.tan(cut);
  return svg(342, 'Schéma : à gauche, la lumière qui traverse trente surfaces air-verre, 29 % en verre nu, 68 % avec une couche simple, 94 % en multicouche ; à droite, le pare-soleil vu de dessus : le champ du grand angle passe, un projecteur à 60° de l\'axe ne touche plus la lentille ; en bas, l\'ordre du nettoyage.', `
    ${head('La lentille frontale', `La lumière qui traverse ${SURFACES} surfaces air-verre ; l'ombre du pare-soleil.`)}
    ${bars}
    ${tx(16, 194, 'Le reste rebondit entre les', 'cf-s l')}${tx(16, 207, 'lentilles : un voile gris.', 'cf-s l')}
    <rect class="cf-body" x="${X0 - 44}" y="${n1(cy - r - 6)}" width="44" height="${n1(2 * r + 12)}" rx="4"/>
    <line class="c1-glass" x1="${X0}" y1="${n1(cy - r)}" x2="${X0}" y2="${n1(cy + r)}"/>
    <path class="c1-hood" d="M${X0} ${n1(cy - base)} L${n1(xf)} ${n1(cy - W)} M${X0} ${n1(cy + base)} L${n1(xf)} ${n1(cy + W)}"/>
    <line class="cf-dash" x1="${X0}" y1="${cy}" x2="${n1(fx)}" y2="${n1(fy)}"/><line class="cf-dash" x1="${X0}" y1="${cy}" x2="${n1(fx)}" y2="${n1(2 * cy - fy)}"/>
    ${tx(n1(fx + 4), n1(fy + 4), 'champ à 4,5 mm', 'cf-s l')}${tx(n1(fx + 4), n1(fy + 17), '± 47°', 'cf-s l')}
    <line class="c1-proj" x1="${n1(px)}" y1="${n1(py)}" x2="${X0}" y2="${n1(ly)}"/><circle class="c1-sun" cx="${n1(px + 6)}" cy="${n1(py - 8)}" r="7"/>
    ${tx(n1(px - 4), n1(py - 6), `projecteur à ${deg}°`, 'cf-lbl c1-r')}
    ${tx(214, cy - 2, 'lentille', 'cf-s c1-r')}${tx(214, cy + 11, 'frontale', 'cf-s c1-r')}${tx(n1(xf - 2), n1(cy + W + 14), 'pare-soleil', 'cf-s')}
    ${tx(232, 296, `Au-delà de ${deg}°, l'ombre du bord`, 'cf-s l')}${tx(232, 309, 'couvre toute la lentille.', 'cf-s l')}
    ${tx(16, 324, 'Nettoyer : 1. la soufflette, 2. le pinceau doux, 3. le papier optique,', 'cf-bs')}
    ${tx(16, 338, 'une goutte de liquide sur le papier, en spirale du centre vers le bord.', 'cf-bs')}`);
}

/** le ramping : l'ouverture maximale à chaque focale, avec et sans doubleur */
function ramping() {
  const X = (f) => 64 + 356 * Math.log(f / 4.5) / Math.log(12);
  const Y = (N) => 64 + 2 * Math.log2(N / 1.8) * 40;
  const Nmax = (f) => (f <= 41 ? 1.8 : 1.8 + (2.4 - 1.8) * (f - 41) / 13);
  const pts = (k) => [4.5, ...Array.from({ length: 14 }, (_, i) => 41 + i)].map((f) => `${n1(X(f))},${n1(Y(Nmax(f) * k))}`).join(' ');
  const yt = [[1.8, 'f/1,8'], [2.4, 'f/2,4'], [3.6, 'f/3,6'], [4.8, 'f/4,8']].map(([N, t]) => `<line class="cf-axis" x1="58" y1="${n1(Y(+N))}" x2="64" y2="${n1(Y(+N))}"/>${tx(54, n1(Y(+N) + 4), String(t), 'cf-tick c1-r')}`).join('');
  const xt = [4.5, 8, 15, 30, 41, 54].map((f) => `<line class="cf-axis" x1="${n1(X(f))}" y1="186" x2="${n1(X(f))}" y2="192"/>${tx(n1(X(f)), 204, String(f).replace('.', ','), 'cf-tick')}`).join('');
  return svg(272, 'Courbe : l\'ouverture maximale du zoom selon la focale. f/1,8 de 4,5 à 41 mm, puis elle se ferme jusqu\'à f/2,4 à 54 mm ; avec le doubleur, f/3,6 puis f/4,8 à 108 mm. Au-delà de 41 mm, la pupille d\'entrée ne grandit plus : environ 22,5 mm.', `
    ${head('Le ramping : l\'ouverture qui se ferme au bout du zoom', 'L\'iris grand ouvert ne donne plus f/1,8 au-delà de 41 mm.')}
    <rect class="c1-ramp" x="${n1(X(41))}" y="52" width="${n1(X(54) - X(41))}" height="134"/>
    <line class="cf-dash" x1="${n1(X(41))}" y1="52" x2="${n1(X(41))}" y2="186"/>
    <line class="cf-axis" x1="64" y1="186" x2="420" y2="186"/><line class="cf-axis" x1="64" y1="52" x2="64" y2="186"/>
    ${yt}${xt}${tx(242, 220, 'focale (mm), échelle de la bague de zoom', 'cf-s')}
    <polyline class="c1-curve" points="${pts(1)}"/><polyline class="c1-curve ext" points="${pts(2)}"/>
    ${tx(72, n1(Y(1.8) - 6), '×1 : 4,5–54 mm', 'cf-lbl l')}${tx(72, n1(Y(3.6) - 6), 'doubleur ×2 : 9–108 mm', 'cf-lbl l')}
    ${tx(n1(X(41) - 4), 104, 'à 41 mm,', 'cf-s c1-r')}${tx(n1(X(41) - 4), 116, 'le ramping', 'cf-s c1-r')}${tx(n1(X(41) - 4), 128, 'commence', 'cf-s c1-r')}
    ${tx(16, 240, 'Pupille d\'entrée = focale ÷ nombre f. 41 ÷ 1,8 = 22,8 mm ; 54 ÷ 2,4 = 22,5 mm :', 'cf-bs')}
    ${tx(16, 254, 'au-delà de 41 mm, elle ne grandit plus. Au bout du zoom, un peu moins', 'cf-bs')}
    ${tx(16, 268, 'd\'un diaphragme (0,83) de perdu.', 'cf-bs')}`);
}

/** le doubleur : le groupe qui entre dans le faisceau, le quart central de l'image, les chiffres */
function doubleur() {
  const cy = 92;
  return svg(276, 'Schéma : le doubleur est un groupe de lentilles qui entre dans le faisceau, à l\'arrière de l\'objectif. Il agrandit deux fois l\'image : le capteur ne reçoit plus que le quart central du champ, étalé sur toute sa surface, d\'où quatre fois moins de lumière, deux diaphragmes. 4,5–54 mm devient 9–108 mm, f/1,8 devient f/3,6.', `
    ${head('Le doubleur ×2', 'Un groupe de lentilles bascule dans le faisceau, derrière l\'iris.')}
    <rect class="cf-body" x="20" y="${cy - 34}" width="300" height="68" rx="6"/>
    ${rays(20, [cy - 20, cy, cy + 20], 344, cy)}
    ${grp(32, 22, 56, cy)}${grp(92, 14, 40, cy)}${grp(150, 14, 40, cy)}<line class="cf-mount" x1="198" y1="${cy - 16}" x2="198" y2="${cy + 16}"/>
    <rect class="c1-ext" x="226" y="${cy - 18}" width="22" height="36" rx="4"/>${grp(272, 18, 44, cy)}
    <line class="cf-sensor" x1="344" y1="${cy - 24}" x2="344" y2="${cy + 24}"/><circle class="cf-dot" cx="344" cy="${cy}" r="3.5"/>
    ${tx(43, cy + 48, 'frontal')}${tx(128, cy + 48, 'zoom')}${tx(198, cy + 48, 'iris')}${tx(237, cy + 48, 'doubleur', 'cf-lbl')}${tx(281, cy + 48, 'relais')}${tx(344, cy + 40, 'capteur')}
    ${dim(237, cy - 46, 237, cy - 22)}${tx(250, cy - 38, 'levier ×1 / ×2', 'cf-s l')}
    <rect class="c1-scene" x="20" y="166" width="160" height="90" rx="2"/><rect class="c1-quarter" x="60" y="188.5" width="80" height="45" rx="1"/>
    ${tx(100, 160, 'le champ vu par le capteur', 'cf-s')}${tx(26, 180, '×1 : tout', 'cf-s l')}${tx(100, 215, '×2 : ce quart', 'cf-lbl')}
    ${tx(100, 270, 'étalé sur tout le capteur : ÷ 4', 'cf-s')}
    <g transform="translate(200 160)"><rect class="cf-box" x="0" y="0" width="234" height="102" rx="3"/>
      <text class="cf-bt" x="10" y="20">×1 → ×2</text>
      <text class="cf-bs" x="10" y="40">focales 4,5–54 mm → 9–108 mm</text>
      <text class="cf-bs" x="10" y="57">angle 94° → 56° (à 9 mm)</text>
      <text class="cf-bs" x="10" y="74">f/1,8 → f/3,6 ; f/2,4 → f/4,8</text>
      <text class="cf-bb" x="10" y="93">lumière ÷ 4 : deux diaphragmes</text></g>`);
}

/** la macro : la bague de point déplace le groupe frontal, la macro le groupe arrière ; le décalage en f² */
function macro() {
  const row = (y, title, sub, which) => {
    const cy = y + 66, shiftF = which === 'point' ? 14 : 0, shiftR = which === 'macro' ? -12 : 0;
    return `${tx(16, y + 16, title, 'cf-t')}${tx(16, y + 32, sub, 'cf-sub')}
      <rect class="cf-body" x="60" y="${cy - 24}" width="250" height="48" rx="5"/>
      ${grp(72 + shiftF, 16, 40, cy)}${grp(140, 12, 30, cy)}${grp(184, 12, 30, cy)}${grp(262 + shiftR, 16, 34, cy)}
      <rect class="c1-move" x="${which === 'point' ? 70 : 246}" y="${cy - 26}" width="36" height="52" rx="6"/>
      ${which === 'point' ? dim(80, cy + 32, 100, cy + 32) : dim(262, cy + 32, 282, cy + 32)}
      <line class="cf-sensor" x1="330" y1="${cy - 20}" x2="330" y2="${cy + 20}"/>${tx(330, cy + 34, 'capteur')}
      <circle class="cf-dot" cx="30" cy="${cy}" r="4"/>${tx(30, cy + 20, which === 'point' ? '0,3 m' : '12 cm', 'cf-s')}`;
  };
  const tab = [[4.5, '0,10 mm'], [10, '0,50 mm'], [54, '14,6 mm']].map(([f, v], i) => `${tx(26 + i * 140, 256, `à ${String(f).replace('.', ',')} mm :`, 'cf-bs')}${tx(26 + i * 140, 272, String(v), 'cf-bb')}`).join('');
  return svg(300, 'Schéma : la bague de point avance le groupe frontal, jusqu\'à 0,3 m ; la bague macro déplace le groupe arrière et fait le point plus près, au grand angle. Pour passer de 0,3 m à 12 cm, il faut décaler l\'image de 0,10 mm à 4,5 mm, 0,50 mm à 10 mm, 14,6 mm à 54 mm : le décalage varie comme le carré de la focale, le zoom n\'est plus parfocal.', `
    ${row(4, 'La bague de point', 'Le groupe frontal avance ; au plus près : 0,3 m (distance minimale).', 'point')}
    ${row(110, 'La bague macro', 'Le groupe arrière décale l\'image de la même longueur à toutes les focales.', 'macro')}
    ${tx(16, 236, 'De 300 à 120 mm : décalage = f² × (1/120 − 1/300), tout en mm (lentille mince)', 'cf-bs')}
    ${tab}${tx(16, 294, 'Le décalage est fixe, l\'erreur varie en f² : le zoom n\'est plus parfocal.', 'cf-bs')}`);
}

/** les défauts : six vignettes */
function defauts() {
  const cell = (i, title, l1, l2, body) => {
    const x = 8 + (i % 3) * 144, y = 42 + Math.floor(i / 3) * 146;
    return `<g transform="translate(${x} ${y})"><rect class="cf-box" x="0" y="0" width="136" height="138" rx="3"/>
      ${tx(8, 16, title, 'cf-bb c1-sm')}<g transform="translate(8 24)">${body}</g>
      ${tx(68, 118, l1, 'cf-s')}${tx(68, 131, l2, 'cf-s')}</g>`;
  };
  const ca = `<rect class="c1-white" x="0" y="0" width="120" height="80"/><rect class="c1-fr" x="78" y="6" width="3" height="56"/><rect class="c1-black" x="81" y="6" width="14" height="56"/><rect class="c1-fb" x="95" y="6" width="3" height="56"/>${tx(60, 75, 'bord de l\'image →', 'cf-s c1-ink')}`;
  const axial = `<rect class="cf-lens" x="4" y="14" width="14" height="52" rx="5"/>${['b', 'g', 'r'].map((c, k) => `<line class="c1-ray ${c}" x1="18" y1="18" x2="${70 + k * 14}" y2="40"/><line class="c1-ray ${c}" x1="18" y1="62" x2="${70 + k * 14}" y2="40"/><circle class="c1-pt ${c}" cx="${70 + k * 14}" cy="40" r="2.6"/>`).join('')}${tx(64, 78, 'bleu, vert, rouge', 'cf-s')}`;
  const bend = (k) => [0, 1, 2, 3, 4].map((j) => { const v = j * 20; return `<path class="c1-grid" d="M0 ${v} Q60 ${v + (v - 40) * k} 120 ${v}"/><path class="c1-grid" d="M${j * 30} 0 Q${j * 30 + (j * 30 - 60) * k * 0.9} 40 ${j * 30} 80"/>`; }).join('');
  const vig = `<rect x="0" y="0" width="120" height="80" fill="url(#c1-vig)"/>${tx(60, 44, 'centre 100 %', 'cf-tick c1-ink')}${tx(20, 76, '50 %', 'cf-tick')}`;
  const flare = `<rect class="c1-dark" x="0" y="0" width="120" height="80"/><rect class="c1-veil" x="0" y="0" width="120" height="80"/><circle class="c1-sun" cx="22" cy="16" r="8"/>${[[56, 38, 7], [78, 50, 11], [100, 63, 5]].map(([cx, cy, rr]) => `<polygon class="c1-ghost" points="${[0, 1, 2, 3, 4, 5].map((q) => { const a = q * Math.PI / 3; return `${n1(cx + rr * Math.cos(a))},${n1(cy + rr * Math.sin(a))}`; }).join(' ')}"/>`).join('')}<line class="cf-dash" x1="22" y1="16" x2="104" y2="66"/>`;
  const breath = `<rect class="c1-white" x="0" y="0" width="120" height="80"/><rect class="c1-frame" x="12" y="9" width="96" height="62"/><rect class="c1-frame b" x="4" y="3" width="112" height="74"/>${tx(60, 37, 'plein : au loin', 'cf-s c1-ink')}${tx(60, 53, 'tirets : au plus près', 'cf-s c1-ink')}`;
  return svg(336, 'Schéma en six vignettes : l\'aberration chromatique latérale (franges rouge et bleue au bord, corrigées par l\'ALAC), l\'aberration chromatique axiale (le bleu, le vert et le rouge ne font pas le point au même endroit), la distorsion en barillet, le vignetage (coins plus sombres), le flare (images fantômes et voile), la respiration (le champ change un peu avec le point).', `
    <defs><radialGradient id="c1-vig" cx="50%" cy="50%" r="62%"><stop offset="0" stop-color="#f1f1ea"/><stop offset="0.55" stop-color="#d6d6cf"/><stop offset="1" stop-color="#77776f"/></radialGradient></defs>
    ${head('Les défauts de tout objectif', 'Ce que l\'on voit, et ce que la caméra sait corriger.')}
    ${cell(0, 'Chromatisme latéral', 'franges au bord :', 'l\'ALAC les recale', ca)}
    ${cell(1, 'Chromatisme axial', 'rouge et bleu font', 'le point plus loin', axial)}
    ${cell(2, 'Distorsion', 'barillet en grand angle,', 'coussinet au serré', bend(0.22))}
    ${cell(3, 'Vignetage', 'coins sombres à', 'pleine ouverture', vig)}
    ${cell(4, 'Flare', 'reflets internes :', 'fantômes et voile', flare)}
    ${cell(5, 'Respiration', 'le cadre bouge un peu', 'avec le point', breath)}`);
}

/** la monture B4 vue de face, et ce qui passe dans les 12 broches */
function monture() {
  const cx = 110, cy = 150;
  const rows = [['1 · 2', 'touches RET et VTR'], ['3 · 6', 'masse et +12 V'], ['5 · 7', 'iris : commande, position'], ['4 · 8', 'iris automatique'], ['9', 'doubleur engagé (EXT)'], ['10', 'position du zoom'], ['11 · 12', 'données série']];
  const tab = rows.map(([n, t], i) => `${tx(226, 96 + i * 22, n, 'cf-tick l')}${tx(278, 96 + i * 22, t, 'cf-bs')}`).join('');
  const pins = Array.from({ length: 12 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 6, rr = i % 2 ? 7 : 12; return `<circle class="cf-jk-pin" cx="${n1(404 + rr * Math.cos(a))}" cy="${n1(66 + rr * Math.sin(a))}" r="1.6"/>`; }).join('');
  return svg(306, 'Schéma : à gauche, la monture B4 de la caméra vue de face, avec l\'encoche de l\'ergot en haut, la bague et son levier de verrouillage, la face d\'appui à 48 mm des capteurs et la prise LENS ; à droite, ce que portent les 12 broches du câble de l\'objectif : touches RET et VTR, masse et +12 V, commande et position de l\'iris, iris automatique, doubleur, position du zoom, données série.', `
    ${head('La monture B4 et le câble de l\'objectif', 'Une baïonnette normalisée (BTA S-1005), un câble à 12 broches.')}
    <circle class="cf-body" cx="${cx}" cy="${cy}" r="78"/>
    <circle class="c1-ring" cx="${cx}" cy="${cy}" r="58"/><circle class="c1-face" cx="${cx}" cy="${cy}" r="47"/><circle class="c1-throat" cx="${cx}" cy="${cy}" r="35"/>
    <rect class="c1-notch" x="${cx - 5}" y="${cy - 49}" width="10" height="12" rx="1"/>
    <g transform="rotate(-40 ${cx} ${cy})"><rect class="c1-lever" x="${cx - 6}" y="${cy - 90}" width="12" height="34" rx="3"/></g>
    <circle class="cf-jk alim" cx="${cx - 58}" cy="${cy + 60}" r="9"/><circle class="cf-jk-pin" cx="${cx - 58}" cy="${cy + 60}" r="3"/>
    ${tx(cx, cy + 4, 'vers le prisme', 'cf-s')}
    ${tx(cx + 30, 58, 'encoche de l\'ergot', 'cf-s l')}<line class="cf-dash" x1="${cx + 28}" y1="56" x2="${cx + 4}" y2="${cy - 50}"/>
    ${tx(8, 66, 'levier de', 'cf-s l')}${tx(8, 79, 'verrouillage', 'cf-s l')}
    ${tx(cx + 44, cy + 96, 'bague et face d\'appui :', 'cf-s')}${tx(cx + 44, cy + 109, '48 mm jusqu\'aux capteurs', 'cf-s')}
    ${tx(cx - 58, cy + 84, 'LENS', 'cf-jk-lbl')}
    ${tx(226, 70, 'Les 12 broches', 'cf-bt')}<circle class="cf-jk" cx="404" cy="66" r="17"/>${pins}
    ${tab}
    ${tx(16, 284, 'Brochage courant des objectifs B4 : à vérifier sur la notice de l\'objectif.', 'cf-s l')}
    ${tx(16, 300, 'Mode d\'emploi HXC-FB80 : caméra éteinte pour brancher ou débrancher.', 'cf-lbl l')}`);
}

/** portable ou box : deux silhouettes, et les plages de focales */
function boxPortable() {
  const X = (f) => 96 + 330 * Math.log(f / 4) / Math.log(1500 / 4);
  const bar = (y, name, a, b) => `${tx(16, y + 9, name, 'cf-lbl l')}<rect class="cf-zone" x="${n1(X(a))}" y="${y}" width="${n1(X(b) - X(a))}" height="10" rx="2"/><rect class="c1-zext" x="${n1(X(a * 2))}" y="${y + 12}" width="${n1(X(b * 2) - X(a * 2))}" height="5" rx="2"/>${tx(n1(X(b) + 4), y + 9, `${String(a).replace('.', ',')}–${b}`, 'cf-tick l')}`;
  const ticks = [5, 10, 50, 100, 500, 1000].map((f) => `<line class="cf-axis" x1="${n1(X(f))}" y1="292" x2="${n1(X(f))}" y2="297"/>${tx(n1(X(f)), 310, String(f), 'cf-tick')}`).join('');
  return svg(318, 'Schéma : à gauche, la caméra du plateau avec son objectif portable d\'environ 2 kg et sa poignée de servo ; à droite, une caméra de stade avec un objectif box de 23,5 kg sur son adaptateur grand objectif, commandée seulement par les manches. En bas, les focales : ZA12x4.5 de 4,5 à 54 mm, UA24x7.8 de 7,8 à 187 mm, UA80x9 de 9 à 720 mm, et le double avec le doubleur.', `
    ${head('Objectif portable ou objectif box', 'Deux familles de zooms B4 : à la main, ou sur un pied lourd.')}
    <rect class="cf-body" x="30" y="92" width="70" height="56" rx="5"/><rect class="cf-lens" x="100" y="100" width="78" height="40" rx="8"/>
    <path class="c1-grip" d="M112 140 L168 140 L172 166 Q140 176 112 166 Z"/>${tx(104, 84, 'objectif portable', 'cf-bb mid')}
    ${tx(104, 190, '≈ 2 kg, poignée de servo :', 'cf-s')}${tx(104, 203, 'zoom au pouce, RET, iris', 'cf-s')}
    <rect class="c1-box" x="262" y="62" width="150" height="94" rx="6"/><rect class="cf-body" x="226" y="78" width="38" height="70" rx="4"/><rect class="cf-body" x="210" y="92" width="18" height="40" rx="3"/>
    <rect class="c1-lens-f" x="406" y="70" width="10" height="78" rx="3"/>${tx(336, 52, 'objectif box', 'cf-bb mid')}${tx(336, 112, 'UA80x9 · 23,5 kg', 'cf-lbl')}
    ${tx(320, 176, 'adaptateur grand objectif', 'cf-s')}${tx(320, 189, '(15,5 kg) ; câble 36 broches', 'cf-s')}${tx(320, 203, 'zoom et point aux manches', 'cf-s')}
    ${tx(16, 228, 'Focales (mm, échelle logarithmique) ; trait fin : avec le doubleur', 'cf-bt')}
    ${bar(236, 'ZA12x4.5', 4.5, 54)}${bar(254, 'UA24x7.8', 7.8, 187)}${bar(272, 'UA80x9', 9, 720)}
    <line class="cf-axis" x1="${n1(X(4))}" y1="292" x2="${n1(X(1500))}" y2="292"/>${ticks}`);
}

/** @type {Record<string, () => string>} */
export const FIGS_CH1 = { frontale, ramping, doubleur, macro, defauts, monture, 'box-portable': boxPortable };
