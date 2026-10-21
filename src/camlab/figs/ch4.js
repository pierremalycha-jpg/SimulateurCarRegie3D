// @ts-check
// Schémas des fiches du module caméra : le traitement de l'image (chapitre 4). Un schéma par fiche, nommé par le champ `fig`.
// Aides communes : ../figkit.js (svg, tx, head, rays, dim, n1). Les courbes sont calculées par les
// fonctions du viseur simulé (../vf.js : oetf, kneeCurve, hueSat), les mêmes que les manipulations.
import { svg, tx, head, n1 } from '../figkit.js';
import { oetf, kneeCurve, hueSat, decode } from '../vf.js';

/** une polyligne SVG d'une fonction, échantillonnée sur [a, b] */
const path = (f, a, b, X, Y, cls, n = 80) => {
  let d = ''; for (let i = 0; i <= n; i++) { const x = a + (b - a) * i / n; d += (i ? 'L' : 'M') + n1(X(x)) + ' ' + n1(Y(f(x))) + ' '; }
  return `<path class="${cls}" d="${d.trim()}"/>`;
};
/** gris d'affichage d'un niveau vidéo (0 à 1) */
const grey = (v) => { const c = Math.round(255 * Math.max(0, Math.min(1, v))); return `rgb(${c},${c},${c})`; };

/** @type {Record<string, () => string>} */
export const FIGS_CH4 = {
  /** de la lumière aux codes : l'échelle 10 bits, ses zones, le noir à 64 et le blanc à 940 */
  quantif: () => {
    const Yc = (c) => 226 - 170 * c / 1023;
    // le signal du capteur, puis ses marches (12 niveaux pour qu'on les voie)
    const X = (t) => 24 + 150 * t, Y = (v) => 214 - 150 * v, ramp = (t) => 0.06 + 0.86 * (t * t * (3 - 2 * t) * 0.6 + t * 0.4);
    const steps = (t) => Math.round(ramp(t) * 12) / 12;
    const zones = [[51, Yc(1020) - 51 + 5, 'c4-res'], [Yc(1019), Yc(940) - Yc(1019), 'c4-sup'], [Yc(940), Yc(64) - Yc(940), 'c4-leg'], [Yc(64), Yc(4) - Yc(64), 'c4-sub'], [Yc(4), 231 - Yc(4), 'c4-res']];
    const lab = [[52, 'synchro du SDI : 1020 à 1023', 53], [66, 'super-blancs : 941 à 1019 (109 %)', Yc(980)], [84, 'blanc 100 % : 940 (8 bits : 235)', Yc(940)], [146, 'l\'image : 876 pas de 0,11 %', Yc(500)], [200, 'noir 0 % : 64 (8 bits : 16)', Yc(64)], [216, 'sous-noirs : 4 à 63 (−7 %)', Yc(34)], [232, 'synchro du SDI : 0 à 3', 229]];
    return svg(262, 'Schéma : à gauche, le signal continu du capteur et les marches de la quantification ; à droite, l\'échelle des codes 10 bits : 0 à 3 et 1020 à 1023 réservés à la synchronisation du SDI, 4 à 63 les sous-noirs, 64 le noir, 940 le blanc, 941 à 1019 les super-blancs jusqu\'à 109 % ; en 8 bits, le noir est à 16 et le blanc à 235.', `
      ${head('De la lumière aux nombres', 'Chaque niveau devient un code : 1 024 codes en 10 bits.')}
      <line class="cf-axis" x1="24" y1="214" x2="176" y2="214"/><line class="cf-axis" x1="24" y1="214" x2="24" y2="56"/>
      ${path(ramp, 0, 1, X, Y, 'c4-ana')}${path(steps, 0, 1, X, Y, 'c4-step', 240)}
      ${tx(100, 232, 'le signal du capteur, puis ses marches')}${tx(100, 248, 'code = 64 + 876 × niveau (10 bits)', 'cf-lbl')}
      ${zones.map(([y, h, c]) => `<rect class="${c}" x="196" y="${n1(+y)}" width="22" height="${n1(Math.max(2, +h))}"/>`).join('')}
      <rect class="c4-scale" x="196" y="51" width="22" height="180"/>
      ${lab.map(([y, t, yy]) => `<line class="cf-dash" x1="220" y1="${n1(+yy)}" x2="228" y2="${n1(+y - 4)}"/>${tx(232, y, String(t), 'cf-s l')}`).join('')}`);
  },

  /** trois réglages du master black : le bas de la forme d'onde et l'échelle de gris */
  noir: () => {
    const items = [['noir', 0], ['étoile', 18], ['pavé 1', 31], ['pavé 2', 59], ['pavé 3', 86]];
    const panel = (x0, title, sub, b) => {
      const Y = (v) => 170 - v / 0.4 * 88, lv = items.map(([, v]) => oetf(decode(+v) + b / 450));
      const trace = lv.map((v, i) => `<line class="c4-trace" x1="${x0 + 8 + i * 22}" y1="${n1(Y(v))}" x2="${x0 + 26 + i * 22}" y2="${n1(Y(v))}"/>`).join('');
      const strip = lv.map((v, i) => `<rect x="${x0 + 8 + i * 22}" y="184" width="20" height="20" fill="${grey(v)}" class="c4-sw"/>`).join('');
      return `${tx(x0 + 63, 54, title, 'cf-bb mid')}${tx(x0 + 63, 68, sub)}
        <rect class="cf-vf" x="${x0}" y="76" width="126" height="100" rx="3"/>
        ${[0, 0.1, 0.2, 0.3].map((v) => `<line class="c4-grid" x1="${x0 + 4}" y1="${n1(Y(v))}" x2="${x0 + 122}" y2="${n1(Y(v))}"/>`).join('')}
        ${tx(x0 + 120, n1(Y(0) - 3), '0 %', 'cf-tick c4-r')}${tx(x0 + 120, n1(Y(0.3) - 3), '30 %', 'cf-tick c4-r')}${trace}${strip}`;
    };
    return svg(236, 'Schéma : trois réglages du master black. Délavé, à +5 %, le noir et les ombres montent, un voile gris. Juste, entre 0 et 2 %. Bouché, à −7 %, le noir, l\'étoile et le premier pavé se confondent. En dessous, les mêmes gris : noir, étoile, pavés 1 à 3 de la mire.', `
      ${head('Le noir, trois réglages', 'Le bas de la forme d\'onde (0 à 40 %) et les gris sombres de la mire.')}
      ${panel(16, 'Délavé', 'master black +5 %', 5)}${panel(157, 'Juste', 'noir à 0–2 %', 1)}${panel(298, 'Bouché', 'master black −7 %', -7)}
      ${tx(220, 224, 'De gauche à droite : noir, étoile, pavés 1 à 3. Le master black déplace surtout le bas.', 'cf-s')}`);
  },

  /** la courbe de la caméra (BT.709), celle de l'écran (BT.1886) et le black gamma */
  gamma: () => {
    const X = (x) => 44 + 180 * x, Y = (y) => 226 - 176 * y;
    const v18 = oetf(0.18), l18 = Math.pow(v18, 2.4);
    const ticks = [[0, '0'], [0.18, '18'], [0.5, '50'], [1, '100']].map(([v, t]) => `<line class="cf-axis" x1="${n1(X(+v))}" y1="226" x2="${n1(X(+v))}" y2="230"/>${tx(n1(X(+v)), 242, String(t), 'cf-tick')}`).join('');
    const box = (y, t, a, b, cls) => `<g transform="translate(250 ${y})"><rect class="cf-box" x="0" y="0" width="184" height="54" rx="3"/><line class="${cls}" x1="10" y1="14" x2="30" y2="14"/><text class="cf-bt" x="36" y="18">${t}</text><text class="cf-bs" x="10" y="34">${a}</text><text class="cf-bs" x="10" y="48">${b}</text></g>`;
    return svg(262, 'Schéma : la courbe de la caméra BT.709 relève les tons sombres, 18 % de lumière donnent 41 % de signal ; l\'écran BT.1886 applique un gamma 2,4, 41 % de signal donnent 12 % de luminance ; ensemble, la chaîne garde un léger contraste, un gamma d\'environ 1,2. Le black gamma ne modifie que le bas de la courbe.', `
      ${head('Deux courbes qui se compensent', 'La caméra relève les ombres, l\'écran les rabaisse.')}
      <rect class="cf-vf" x="44" y="50" width="180" height="176"/>
      <line class="cf-dash" x1="${X(0)}" y1="${Y(0)}" x2="${X(1)}" y2="${Y(1)}"/>
      <rect class="c4-band" x="44" y="${n1(Y(0.3))}" width="180" height="${n1(Y(0) - Y(0.3))}"/>
      ${path((x) => oetf(x), 0, 1, X, Y, 'c4-cur')}${path((x) => Math.pow(x, 2.4), 0, 1, X, Y, 'c4-disp')}${path((x) => Math.pow(oetf(x), 2.4), 0, 1, X, Y, 'c4-sys')}
      <line class="cf-dash" x1="${n1(X(0.18))}" y1="226" x2="${n1(X(0.18))}" y2="${n1(Y(v18))}"/><line class="cf-dash" x1="44" y1="${n1(Y(v18))}" x2="${n1(X(0.18))}" y2="${n1(Y(v18))}"/>
      <circle class="c4-dot" cx="${n1(X(0.18))}" cy="${n1(Y(v18))}" r="3.5"/>${tx(n1(X(0.18) + 6), n1(Y(v18) - 6), '41 %', 'cf-lbl l')}
      ${tx(40, n1(Y(v18) + 4), '41', 'cf-tick c4-r')}${tx(40, n1(Y(1) + 4), '100', 'cf-tick c4-r')}${ticks}
      ${tx(134, 258, 'lumière de la scène (% du blanc)')}${tx(50, 64, 'black gamma : le bas seul', 'cf-s l')}
      ${box(50, 'La caméra', 'BT.709 : V = 1,099 L^0,45 − 0,099', `18 % de lumière → ${Math.round(v18 * 100)} % de signal`, 'c4-cur')}
      ${box(112, 'L\'écran', 'BT.1886 : luminance = V^2,4', `${Math.round(v18 * 100)} % de signal → ${Math.round(l18 * 100)} % de luminance`, 'c4-disp')}
      ${box(174, 'Les deux', 'un gamma d\'environ 1,2 :', 'un peu plus de contraste qu\'en vrai', 'c4-sys')}`);
  },

  /** le knee et le white clip : la courbe au-dessus du point, le plafond */
  knee: () => {
    const X = (v) => 40 + 150 * v, Y = (v) => 214 - 150 * v, P = 0.9, S = 0.1, WC = 1.03;
    const xt = [[0, '0'], [1, '100'], [2, '200 %']].map(([v, t]) => `<line class="cf-axis" x1="${X(+v)}" y1="214" x2="${X(+v)}" y2="218"/>${tx(X(+v), 230, String(t), 'cf-tick')}`).join('');
    const yt = [[0, '0'], [0.5, '50'], [1, '100'], [1.09, '109']].map(([v, t]) => tx(36, n1(Y(+v) + 4), String(t), 'cf-tick c4-r')).join('');
    return svg(250, 'Schéma : sans knee, le signal monte jusqu\'au plafond de 109 % et tout ce qui dépasse devient un aplat ; avec un knee à 90 %, au-dessus du point la pente est dix fois plus faible et une fenêtre à 140 à 190 % reste sous le plafond, avec son détail. Le white clip, ici à 103 %, coupe tout ce qui dépasse.', `
      ${head('Le knee et le white clip', 'Comprimer les hautes lumières, puis plafonner.')}
      <rect class="cf-vf" x="40" y="44" width="390" height="170"/>
      <rect class="c4-band" x="${X(1.4)}" y="44" width="${X(1.9) - X(1.4)}" height="170"/>${tx(n1(X(1.65)), 58, 'la fenêtre', 'cf-s')}
      <line class="c4-grid" x1="40" y1="${n1(Y(1))}" x2="430" y2="${n1(Y(1))}"/><line class="c4-clip" x1="40" y1="${n1(Y(WC))}" x2="430" y2="${n1(Y(WC))}"/><line class="c4-grid" x1="40" y1="${n1(Y(1.09))}" x2="430" y2="${n1(Y(1.09))}"/>
      ${path((v) => Math.min(1.09, v), 0, 2.6, X, Y, 'c4-ref')}${path((v) => Math.min(WC, kneeCurve(v, P, S)), 0, 2.6, X, Y, 'c4-cur', 120)}
      <circle class="c4-dot" cx="${n1(X(P))}" cy="${n1(Y(P))}" r="4"/>${tx(n1(X(P) + 8), n1(Y(P) + 16), 'knee point 90 %', 'cf-lbl l')}
      ${tx(n1(X(1.3)), n1(Y(kneeCurve(1.3, P, S)) + 18), 'pente (slope) : 1 pour 10', 'cf-s l')}
      ${tx(426, n1(Y(WC) + 13), 'white clip 103 %', 'cf-s r')}${tx(n1(X(0.55)), n1(Y(1.09) - 4), 'sans knee : aplat au plafond', 'cf-s l')}
      ${xt}${yt}${tx(235, 246, 'signal avant le knee', 'cf-s')}`);
  },

  /** le détail : le contour ajouté, le seuil CRISP, le détail des carnations */
  detail: () => {
    const sm = (x, w) => { const t = Math.max(0, Math.min(1, (x + w) / (2 * w))); return t * t * (3 - 2 * t); };
    const img = (x) => 0.18 + 0.6 * sm(x, 0.06), soft = (x) => 0.18 + 0.6 * sm(x, 0.2), hp = (x) => img(x) - soft(x), out = (x) => img(x) + 0.6 * hp(x);
    const X = (x) => 30 + 220 * (x + 0.5);
    const row = (y0, title, f, cls, mid = 0) => `${tx(16, y0 - 4, title, 'cf-bb')}<rect class="cf-vf" x="30" y="${y0}" width="220" height="50" rx="2"/>${path(f, -0.5, 0.5, X, (v) => y0 + 46 - (v - mid) * 52, cls, 120)}`;
    const box = (y, t, a, b) => `<g transform="translate(266 ${y})"><rect class="cf-box" x="0" y="0" width="168" height="54" rx="3"/><text class="cf-bt" x="10" y="18">${t}</text><text class="cf-bs" x="10" y="34">${a}</text><text class="cf-bs" x="10" y="48">${b}</text></g>`;
    return svg(262, 'Schéma : un contour de l\'image ; le contour seul, ce qui sépare l\'image de sa version adoucie, avec la bande du seuil CRISP autour de zéro ; l\'image plus le contour, avec un liseré clair du côté clair et un liseré sombre du côté sombre.', `
      ${head('Le détail : un contour ajouté', 'L\'image n\'est pas plus nette, ses bords sont soulignés.')}
      ${row(58, '1. L\'image', img, 'c4-ref')}
      ${tx(16, 126, '2. Le contour seul (et le seuil CRISP)', 'cf-bb')}<rect class="cf-vf" x="30" y="130" width="220" height="50" rx="2"/>
      <rect class="c4-band" x="30" y="${155 - 4}" width="220" height="8"/>${path(hp, -0.5, 0.5, X, (v) => 155 - v * 110, 'c4-disp', 120)}
      ${row(202, '3. L\'image + le contour', out, 'c4-cur')}
      ${tx(n1(X(0.12)), 214, 'liseré clair', 'cf-s l')}${tx(n1(X(-0.12)), 244, 'liseré sombre', 'cf-s r')}
      ${box(50, 'LEVEL', 'la quantité de contour', 'ajoutée à l\'image')}
      ${box(112, 'CRISP', 'sous ce seuil, pas de contour :', 'le bruit n\'est pas accentué')}
      ${box(174, 'SKIN DETAIL', 'moins de contour sur la teinte', 'de la peau, et là seulement')}`);
  },

  /** la matrice et la saturation : le vectorscope, la ligne des carnations, une matrice qui garde le blanc */
  matrice: () => {
    const cx = 116, cy = 150, k = 96 / 0.42, Pt = (hs) => [cx + Math.cos(hs.hue * Math.PI / 180) * hs.sat * k, cy - Math.sin(hs.hue * Math.PI / 180) * hs.sat * k];
    const cols = [['R', [0.75, 0, 0]], ['Mg', [0.75, 0, 0.75]], ['B', [0, 0, 0.75]], ['Cy', [0, 0.75, 0.75]], ['V', [0, 0.75, 0]], ['J', [0.75, 0.75, 0]]];
    const tg = cols.map(([n, c]) => { const [x, y] = Pt(hueSat(...c)); return `<rect class="c4-target" x="${n1(x - 6)}" y="${n1(y - 6)}" width="12" height="12"/>${tx(n1(cx + (x - cx) * 1.2), n1(cy + (y - cy) * 1.2 + 4), String(n), 'cf-lbl')}`; }).join('');
    const [rx, ry] = Pt(hueSat(0.75, 0, 0)), [ox, oy] = Pt(hueSat(0.75, 0.16, 0));
    const a = 123 * Math.PI / 180;
    return svg(262, 'Schéma : un vectorscope avec les cibles du rouge, du magenta, du bleu, du cyan, du vert et du jaune, et la ligne des carnations ; le rouge d\'une seconde caméra, décalé vers le jaune, revient sur sa cible par la matrice. À droite, la matrice : chaque voie reçoit une part de sa différence avec les autres, chaque ligne fait 1, le blanc ne bouge pas ; les primaires de la norme BT.709.', `
      ${head('Matrice et saturation', 'Au vectorscope : la teinte tourne, la saturation éloigne du centre.')}
      <circle class="cf-vf" cx="${cx}" cy="${cy}" r="100"/>
      ${[0.1, 0.2, 0.3, 0.4].map((r) => `<circle class="c4-ring" cx="${cx}" cy="${cy}" r="${n1(r * k)}"/>`).join('')}
      <line class="c4-grid" x1="${cx - 100}" y1="${cy}" x2="${cx + 100}" y2="${cy}"/><line class="c4-grid" x1="${cx}" y1="${cy - 100}" x2="${cx}" y2="${cy + 100}"/>
      <line class="c4-skin" x1="${cx}" y1="${cy}" x2="${n1(cx + Math.cos(a) * 98)}" y2="${n1(cy - Math.sin(a) * 98)}"/>${tx(n1(cx + Math.cos(a) * 66 - 4), n1(cy - Math.sin(a) * 66 - 10), 'chairs', 'cf-s r')}
      ${tg}<circle class="c4-dot" cx="${n1(ox)}" cy="${n1(oy)}" r="4"/><line class="c4-move" x1="${n1(ox)}" y1="${n1(oy)}" x2="${n1(rx + 2)}" y2="${n1(ry + 5)}" marker-end="url(#cf-a)"/>
      ${tx(n1(ox + 8), n1(oy + 14), 'CAM 2', 'cf-s l')}
      <g transform="translate(232 50)"><rect class="cf-box" x="0" y="0" width="202" height="122" rx="3"/>
        <text class="cf-bt" x="10" y="18">La matrice (USER MATRIX)</text>
        <text class="cf-mono" x="10" y="38">R' = R + a(R−G) + b(R−B)</text><text class="cf-mono" x="10" y="54">G' = G + c(G−R) + d(G−B)</text><text class="cf-mono" x="10" y="70">B' = B + e(B−R) + f(B−G)</text>
        <text class="cf-bs" x="10" y="90">Si R = G = B, rien ne change :</text><text class="cf-bs" x="10" y="106">le blanc et les gris restent neutres.</text></g>
      <g transform="translate(232 180)"><rect class="cf-box" x="0" y="0" width="202" height="70" rx="3"/>
        <text class="cf-bt" x="10" y="18">BT.709 (x, y CIE 1931)</text>
        <text class="cf-bs" x="10" y="36">R 0,640 ; 0,330 · V 0,300 ; 0,600</text><text class="cf-bs" x="10" y="52">B 0,150 ; 0,060</text><text class="cf-bs" x="10" y="66">blanc D65 0,3127 ; 0,3290</text></g>`);
  },

  /** les fichiers de réglage : la référence, cinq fichiers de scène, l'objectif, l'opérateur */
  fichiers: () => {
    const scene = [1, 2, 3, 4, 5].map((i) => `<rect class="c4-mem" x="${168 + (i - 1) * 52}" y="66" width="46" height="40" rx="3"/>${tx(191 + (i - 1) * 52, 91, String(i), 'cf-in')}`).join('');
    const mem = (x, y, w, t, a, b, cls = 'c4-mem') => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="46" rx="3"/>${tx(x + 8, y + 17, t, 'cf-bb')}${tx(x + 8, y + 31, a, 'cf-s l')}${tx(x + 8, y + 43, b, 'cf-s l')}`;
    return svg(256, 'Schéma : la mémoire de la caméra. Le réglage en cours s\'enregistre par STORE dans un des cinq fichiers de scène, qu\'un numéro rappelle. Le fichier de référence est la base de la caméra, réglée par la maintenance ; le fichier d\'objectif garde les corrections propres à chaque objectif ; le fichier opérateur, le viseur du cadreur. FILE CLEAR revient aux valeurs d\'usine.', `
      ${head('Les fichiers de la caméra', 'Le menu FILE : F01 à F05.')}
      <rect class="cf-box" x="16" y="62" width="128" height="74" rx="3"/>${tx(80, 84, 'le réglage', 'cf-bb mid')}${tx(80, 98, 'en cours')}${tx(80, 114, 'gamma, knee,')}${tx(80, 126, 'détail, couleurs…')}
      <line class="c4-move" x1="146" y1="78" x2="164" y2="78" marker-end="url(#cf-a)"/>${tx(155, 72, 'STORE', 'cf-tick')}
      <line class="c4-move" x1="164" y1="104" x2="146" y2="104" marker-end="url(#cf-a)"/>${tx(155, 120, 'n°', 'cf-tick')}
      ${tx(296, 60, 'F02 SCENE FILE : 5 fichiers, une situation chacun', 'cf-s')}${scene}
      ${mem(16, 150, 200, 'F03 REFERENCE', 'la base de la caméra,', 'réglée par la maintenance', 'c4-mem ref')}
      ${mem(228, 150, 206, 'F04 LENS FILE', 'un fichier par objectif :', 'ses corrections propres')}
      ${mem(16, 204, 200, 'F01 OPERATOR FILE', 'le viseur du cadreur : zebra,', 'marqueurs, menu USER')}
      ${mem(228, 204, 206, 'F05 FILE CLEAR', 'remise aux valeurs', 'd\'usine')}`);
  },
};
