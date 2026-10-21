// @ts-check
// Schémas des fiches du module caméra : la voie caméra (chapitre 7). Un schéma par fiche, nommé par le champ `fig`.
// Aides communes : ../figkit.js (svg, tx, head, rays, dim, n1). Couleurs : classes cf-* de camlab.css et c7f-* de
// camlab-ch7.css. Les chiffres viennent des calculs de ../labs/ch7.js (référence, codes 10 bits, débits, fibre).
import { svg, tx, head, dim, n1 } from '../figkit.js';
import { TRI_HALF, BB_SYNC, BB_BURST, refWave, ycbcr, codes10, sdiRate, FORMATS, blockedFraction, lossDb } from '../labs/ch7.js';

const fr = (v, d = 1) => (Math.round(v * 10 ** d) / 10 ** d).toString().replace('.', ',');
/** une flèche horizontale de x1 à x2 (classe de trait cls) */
const arrow = (x1, y, x2, cls) => `<line class="${cls}" x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" marker-end="url(#cf-a)"/>`;
/** une ligne de rappel, de la légende vers la pièce */
const lead = (x1, y1, x2, y2) => `<line class="c7f-lead" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><circle class="c7f-leaddot" cx="${x2}" cy="${y2}" r="2"/>`;

/** la trace d'une référence, de t = 0 à tmax (µs), dans une boîte (x0, y0 en haut à gauche, w × h, 0 V au milieu) */
function wavePath(kind, x0, y0, w, h, tmax, t0) {
  const pts = [];
  for (let i = 0; i <= w; i++) { const t = i / w * tmax, v = refWave(kind, t, t0); pts.push(`${n1(x0 + i)},${n1(y0 + h / 2 - v / 0.4 * h / 2)}`); }
  return `<polyline class="c7f-wave" points="${pts.join(' ')}"/>`;
}

export const FIGS_CH7 = {
  /** la coupe du câble hybride, la face d'une fibre au microscope, une poussière sur le cœur */
  fibre: () => {
    const b = blockedFraction([{ x: 0, y: 0, r: 2 }]);
    const cable = `<circle class="c7f-jacket" cx="92" cy="128" r="66"/><circle class="c7f-inner" cx="92" cy="128" r="57"/>
      <circle class="c7f-buf" cx="70" cy="106" r="10"/><circle class="c7f-fib1" cx="70" cy="106" r="3.6"/>
      <circle class="c7f-buf" cx="114" cy="106" r="10"/><circle class="c7f-fib2" cx="114" cy="106" r="3.6"/>
      <circle class="c7f-cu" cx="66" cy="148" r="13"/><circle class="c7f-cu" cx="118" cy="148" r="13"/>
      <circle class="c7f-lv" cx="92" cy="80" r="6"/><circle class="c7f-lv" cx="92" cy="177" r="6"/><circle class="c7f-fill" cx="92" cy="128" r="7"/>`;
    const legend = [['c7f-fib1', 'fibre 1 : vers la CCU', 18, 214], ['c7f-fib2', 'fibre 2 : vers la caméra', 18, 230], ['c7f-cu', 'cuivre : l\'énergie', 186, 214], ['c7f-lv', 'basse tension', 186, 230]]
      .map(([c, t, x, y]) => `<circle class="${c}" cx="${Number(x) + 5}" cy="${Number(y) - 4}" r="5"/>${tx(Number(x) + 15, y, t, 'cf-lbl l')}`).join('');
    // la face : gaine de 125 µm (rayon 56 px), zone du cœur de 25 µm ; l'agrandissement : 3,2 px par µm
    const fx = 256, fy = 120, k = 56 / 62.5, zx = 384, zy = 120, kz = 3.2;
    const face = `<circle class="c7f-ferrule" cx="${fx}" cy="${fy}" r="70"/><circle class="c7f-clad" cx="${fx}" cy="${fy}" r="56"/>
      <circle class="c7f-core" cx="${fx}" cy="${fy}" r="${n1(4.5 * k)}"/><circle class="c7f-zone" cx="${fx}" cy="${fy}" r="${n1(12.5 * k)}"/>
      <line class="cf-dash" x1="${fx + 8}" y1="${fy - 10}" x2="${zx - 26}" y2="${zy - 32}"/><line class="cf-dash" x1="${fx + 8}" y1="${fy + 10}" x2="${zx - 26}" y2="${zy + 32}"/>
      <circle class="c7f-clad" cx="${zx}" cy="${zy}" r="${n1(12.5 * kz + 4)}"/><circle class="c7f-core" cx="${zx}" cy="${zy}" r="${n1(4.5 * kz)}"/>
      <circle class="c7f-zone" cx="${zx}" cy="${zy}" r="${n1(12.5 * kz)}"/>
      <path class="c7f-dust" d="M${zx + 2} ${zy - 9} l7 -1 l3 5 l-1 6 l-6 3 l-6 -2 l-2 -6 z"/>`;
    return svg(292, `Schéma : la coupe du câble hybride (deux fibres, une par sens, deux conducteurs de cuivre pour l'énergie, deux conducteurs basse tension) ; la face d'une fibre au microscope : la gaine de 125 µm, le cœur de 9 µm, la zone du cœur de 25 µm ; une poussière de 4 µm posée sur le cœur arrête ${fr(b * 100, 0)} % de la lumière, ${fr(lossDb(b), 1)} dB.`, `
      ${head('Un câble, deux fibres, du cuivre', 'La coupe du câble hybride ; la face d\'une fibre, au microscope.')}
      ${cable}${legend}${face}
      ${tx(fx, 208, 'gaine 125 µm · cœur 9 µm', 'cf-s')}${tx(zx, 174, 'zone du cœur : 25 µm', 'cf-s')}
      ${tx(zx, 188, 'une poussière de 4 µm :', 'cf-lbl')}${tx(zx, 202, `${fr(b * 100, 0)} % de la lumière, ${fr(lossDb(b), 1)} dB`, 'cf-lbl')}
      ${tx(16, 254, 'Vers la CCU : l\'image, le son, la voix du cadreur, le CALL.', 'cf-sub')}
      ${tx(16, 270, 'Vers la caméra : retours, intercom, tally, prompteur, commandes, synchro.', 'cf-sub')}
      ${tx(16, 286, 'Le cuivre : l\'énergie de la CCU, 600 m au plus avec la HXC-FB80.', 'cf-sub')}`);
  },

  /** la CCU entre la caméra et la régie : ce qui entre, ce qui sort */
  ccu: () => {
    const outs = [['SDI HD/SD ×4 : grille, moniteur', 84], ['3G/4K/HD ×4 : grille (1080p50, 4K)', 102]];
    const ins = [['REFERENCE : tri-level ou black burst', 128], ['RET 1 et 2 : retours (VBS ou SDI)', 146], ['PROMPTER, intercom, tally', 164]];
    return svg(250, 'Schéma : la caméra HXC-FB80 reliée par la fibre hybride à sa CCU HXCU-FB80 ; la CCU sort l\'image sur quatre sorties SDI HD ou SD et quatre sorties 3G, 4K ou HD vers la grille ; elle reçoit la référence, deux retours, le prompteur, l\'intercom et le tally, et les commandes du RCP ; elle alimente la caméra.', `
      ${head('La CCU, entre la caméra et la régie', 'Un seul câble côté plateau ; des prises normalisées côté régie.')}
      <rect class="cf-body" x="8" y="94" width="62" height="48" rx="4"/>${tx(39, 114, 'HXC-FB80', 'cf-lbl')}${tx(39, 130, 'caméra', 'cf-s')}
      ${arrow(72, 106, 128, 'c7f-up')}${arrow(128, 120, 72, 'c7f-down')}${arrow(128, 134, 72, 'c7f-cuL')}
      ${tx(100, 98, 'image →', 'cf-tick')}${tx(100, 152, '← énergie', 'cf-tick')}${tx(100, 72, 'fibre hybride', 'cf-s')}
      <rect class="cf-box" x="130" y="64" width="92" height="114" rx="4"/>${tx(176, 112, 'HXCU-FB80', 'cf-bb mid')}${tx(176, 128, 'CCU', 'cf-s')}
      ${outs.map(([t, y]) => `${arrow(222, y, 240, 'c7f-up')}${tx(244, Number(y) + 4, t, 'cf-s l')}`).join('')}
      ${ins.map(([t, y]) => `${arrow(240, y, 224, 'c7f-down')}${tx(244, Number(y) + 4, t, 'cf-s l')}`).join('')}
      <rect class="cf-box" x="138" y="196" width="76" height="26" rx="3"/>${tx(176, 213, 'RCP', 'cf-bb mid')}
      <line class="c7f-down" x1="176" y1="194" x2="176" y2="180" marker-end="url(#cf-a)"/>${tx(222, 213, 'les commandes de la vision', 'cf-s l')}
      ${tx(16, 244, 'La peinture de l\'image se fait dans la caméra ; la CCU la transporte et la met aux formats de la régie.', 'cf-sub')}`);
  },

  /** le RCP vu de dessus, et ce que fait chaque bloc */
  rcp: () => {
    const btn = (x, y, t, c = '') => `<rect class="c7f-btn ${c}" x="${x}" y="${y}" width="34" height="16" rx="2"/>${tx(x + 17, y + 11.5, t, 'c7f-btxt')}`;
    const knobs = (y, t) => [0, 1, 2].map((i) => `<circle class="cf-knob" cx="${52 + i * 34}" cy="${y}" r="9"/>${tx(52 + i * 34, y + 21, 'RGB'[i], 'cf-tick')}`).join('') + tx(158, y + 4, t, 'cf-tick l');
    const panel = `<rect class="cf-body" x="22" y="44" width="176" height="246" rx="6"/>
      <rect class="c7f-lcd" x="34" y="54" width="152" height="28" rx="2"/>${tx(42, 66, 'CAM 1  F4  0dB', 'c7f-lcdt')}${tx(42, 78, 'ND CLR  M.BLK +0', 'c7f-lcdt')}
      ${btn(34, 90, 'CALL', 'red')}${btn(72, 90, 'PANEL', 'amb')}${btn(110, 90, 'CAM PW')}${btn(148, 90, 'BARS')}
      <rect class="c7f-win" x="34" y="114" width="40" height="16" rx="2"/>${tx(54, 126, '0 dB', 'c7f-lcdt c7f-mid')}${tx(54, 142, 'GAIN', 'cf-tick')}
      <rect class="c7f-win" x="84" y="114" width="40" height="16" rx="2"/>${tx(104, 126, 'CLR', 'c7f-lcdt c7f-mid')}${tx(104, 142, 'ND', 'cf-tick')}
      <rect class="c7f-win" x="134" y="114" width="52" height="16" rx="2"/>${tx(160, 126, '3200K', 'c7f-lcdt c7f-mid')}${tx(160, 142, 'CC', 'cf-tick')}
      ${btn(34, 150, 'WHITE')}${knobs(186, 'WHITE')}${knobs(226, 'BLACK')}
      <circle class="c7f-stickbase" cx="110" cy="268" r="17"/><line class="c7f-stick" x1="110" y1="268" x2="110" y2="250"/><circle class="c7f-stickknob" cx="110" cy="248" r="8"/>`;
    const notes = [
      [216, 60, 'Le nom de la caméra, les valeurs', 186, 68],
      [216, 92, 'PANEL ACTIVE : la main (éteint : verrouillé)', 106, 98],
      [216, 112, 'CAM PW alimente, BARS, CALL appelle', 165, 98],
      [216, 134, 'MASTER GAIN, filtres ND et CC', 186, 122],
      [216, 160, 'WHITE : balance des blancs auto', 68, 158],
      [216, 188, 'Boutons WHITE R, G, B : retouches', 120, 186],
      [216, 228, 'Boutons BLACK R, G, B (et flare)', 120, 226],
      [216, 256, 'Manche : pousser, tirer = iris', 119, 258],
      [216, 274, 'tourner le bouton = master black', 118, 248],
    ].map(([x, y, t, px, py]) => `${tx(Number(x), Number(y) + 4, String(t), 'cf-s l')}${lead(Number(x) - 4, y, px, py)}`).join('');
    return svg(300, 'Schéma d\'un RCP vu de dessus : l\'écran ; les touches CALL, PANEL ACTIVE, CAM PW et BARS ; les fenêtres MASTER GAIN, ND et CC ; la touche WHITE ; les boutons WHITE et BLACK R, G, B ; le manche, qu\'on pousse ou qu\'on tire pour l\'iris et dont on tourne le bouton pour le master black.', `
      ${head('Le RCP, type RCP-1500', 'Un pupitre par caméra ; la main droite sur le manche.')}
      ${panel}${notes}`);
  },

  /** le tri-level et le black burst à l'oscilloscope ; la boucle de référence et son bouchon */
  genlock: () => {
    const sc = (x, w, title) => `<rect class="c7f-scope" x="${x}" y="44" width="${w}" height="104" rx="3"/><line class="c7f-zero" x1="${x}" y1="96" x2="${x + w}" y2="96"/>${tx(x + 6, 58, title, 'cf-bt')}`;
    // tri-level : 0 à 2,4 µs sur 196 px ; black burst : 0 à 10 µs sur 196 px ; 0,4 V = 30 px
    const triX = (t) => 16 + t / 2.4 * 196, bbX = (t) => 228 + t / 10 * 196;
    const tri = wavePath('tri', 16, 66, 196, 60, 2.4, 0.5), bb = wavePath('bb', 228, 66, 196, 60, 10, 1);
    const ccu = (x, k) => `<rect class="cf-box" x="${x}" y="196" width="78" height="40" rx="3"/>${tx(x + 39, 210, `CCU ${k}`, 'cf-bb mid')}<circle class="c7f-bnc" cx="${x + 20}" cy="224" r="6"/><circle class="c7f-bnc" cx="${x + 58}" cy="224" r="6"/>${tx(x + 20, 248, 'IN', 'cf-tick')}${tx(x + 58, 248, 'boucle', 'cf-tick')}`;
    return svg(292, `Schéma : à l'oscilloscope, le tri-level (−300 mV puis +300 mV, ${fr(TRI_HALF, 2)} µs chacun en 1080i50) et le black burst (top de synchro de ${fr(BB_SYNC, 1)} µs à −300 mV, puis une salve de ${BB_BURST.cycles} périodes à 4,43 MHz) ; en dessous, le distributeur envoie la référence à la CCU 1, qui la passe par sa boucle à la CCU 2, puis à la CCU 3, dont la boucle porte un bouchon de 75 Ω.`, `
      ${head('Deux références, une boucle', 'À l\'oscilloscope, puis de CCU en CCU dans la baie.')}
      ${sc(16, 196, 'Tri-level (HD)')}${tri}${sc(228, 196, 'Black burst (SD)')}${bb}
      ${dim(n1(triX(0.5)), 136, n1(triX(0.5 + TRI_HALF)), 136)}${tx(n1(triX(0.5 + TRI_HALF / 2)), 146, fr(TRI_HALF, 2) + ' µs', 'cf-tick')}
      ${tx(n1(triX(0.5 + 1.5 * TRI_HALF) + 14), 76, '+300 mV', 'cf-tick l')}${tx(n1(triX(0.5) - 4), 122, '−300 mV', 'cf-tick r')}
      ${dim(n1(bbX(1)), 136, n1(bbX(1 + BB_SYNC)), 136)}${tx(n1(bbX(1 + BB_SYNC / 2)), 146, fr(BB_SYNC, 1) + ' µs à −300 mV', 'cf-tick')}
      ${tx(n1(bbX(1 + BB_BURST.start + 1.1)), 78, 'salve 4,43 MHz', 'cf-tick')}
      ${tx(16, 168, 'Le repère du tri-level : le passage à 0 V, au milieu. Celui du black burst : le front du top.', 'cf-sub')}
      <rect class="cf-box" x="10" y="196" width="56" height="40" rx="3"/>${tx(38, 214, 'DA', 'cf-bb mid')}${tx(38, 228, 'tri-level', 'cf-tick')}
      ${ccu(110, 1)}${ccu(214, 2)}${ccu(318, 3)}
      <path class="c7f-cable" d="M66 216 C 90 216, 104 224, 124 224"/><path class="c7f-cable" d="M168 224 C 190 238, 210 238, 228 224"/><path class="c7f-cable" d="M272 224 C 294 238, 314 238, 332 224"/>
      <rect class="c7f-term" x="383" y="217" width="26" height="14" rx="2"/>${tx(396, 228, '75 Ω', 'c7f-termt')}
      ${tx(16, 270, 'Un seul bouchon de 75 Ω, au bout de la boucle. Sans bouchon : l\'amplitude double (×2) ;', 'cf-sub')}
      ${tx(16, 286, 'avec deux bouchons : les deux tiers. Débrancher la CCU 2 coupe aussi la CCU 3.', 'cf-sub')}`);
  },

  /** le 4:2:2 : un Y' par point, Cb et Cr pour deux points ; les mots du SDI ; l'échelle des codes ; les débits */
  sortie: () => {
    const px = Array.from({ length: 8 }, (_, i) => `<rect class="c7f-px" x="${16 + i * 34}" y="52" width="30" height="30" rx="2"/>${tx(31 + i * 34, 71, 'Y\'', 'cf-lbl')}`).join('');
    const cc = [0, 2, 4, 6].map((i) => `<rect class="c7f-c" x="${16 + i * 34}" y="86" width="64" height="16" rx="2"/>${tx(48 + i * 34, 98, 'Cb · Cr', 'cf-tick')}`).join('');
    const words = ['Cb', 'Y\'', 'Cr', 'Y\'', 'Cb', 'Y\'', 'Cr', 'Y\''].map((w, i) => `<rect class="c7f-word${w === 'Y\'' ? '' : ' c'}" x="${16 + i * 34}" y="124" width="30" height="18" rx="2"/>${tx(31 + i * 34, 137, w, 'cf-tick')}`).join('');
    const yr = ycbcr(0.75, 0, 0), red = codes10(yr[0], yr[1], yr[2]);
    const X = (c) => 16 + c / 1023 * 408;
    const ticks = [[4, '4'], [64, '64 noir'], [512, '512'], [940, '940 blanc'], [1019, '1019']].map(([c, t]) => `<line class="cf-axis" x1="${n1(X(c))}" y1="168" x2="${n1(X(c))}" y2="178"/>${tx(n1(X(c)), 190, String(t), 'cf-tick')}`).join('');
    const rates = Object.keys(FORMATS).map((f, i) => {
      const F = FORMATS[f];
      return tx(16, 222 + i * 16, `${f} : ${F.w.toLocaleString('fr-FR')} × ${F.h.toLocaleString('fr-FR')} × ${F.fps} × 2 mots × 10 bits = ${fr(sdiRate(f) / 1e9, 3)} Gb/s, ${F.sdi}`, 'cf-bs');
    }).join('');
    return svg(270, `Schéma : huit points d'une ligne, chacun avec sa luminance Y', et un couple Cb, Cr pour deux points (4:2:2) ; les mots dans l'ordre du câble, Cb, Y', Cr, Y' ; l'échelle des codes 10 bits, noir à 64, couleur nulle à 512, blanc à 940 ; les débits : 1,485 Gb/s en 1080i50 et 720p50 (HD-SDI), 2,97 Gb/s en 1080p50 (3G-SDI).`, `
      ${head('Un point, trois nombres sur 10 bits', 'Y\' pour chaque point ; Cb et Cr pour deux points : le 4:2:2.')}
      ${px}${cc}${tx(300, 72, '8 points :', 'cf-s l')}${tx(300, 86, '8 Y\', 4 Cb, 4 Cr', 'cf-s l')}
      ${words}${tx(300, 137, '← l\'ordre du câble', 'cf-s l')}
      <rect class="c7f-scale" x="16" y="160" width="408" height="8" rx="2"/>${ticks}
      ${tx(16, 206, `Barre rouge à 75 % : Y' ${red[0]}, Cb ${red[1]}, Cr ${red[2]} ; un gris : Cb = Cr = 512.`, 'cf-bs')}
      ${rates}`);
  },

  /** l'ordre du line-up et la parade avant et après le raccord */
  lineup: () => {
    const steps = [['Fichier de référence', 'F03 REFERENCE'], ['Les barres', 'BARS : la liaison'], ['Les noirs', 'ABB, master black'], ['Les blancs', 'WHITE, boutons R et B'], ['L\'exposition', 'l\'iris, au manche'], ['Les couleurs', 'saturation, matrice']]
      .map(([t, s], i) => `<circle class="c7f-num" cx="28" cy="${58 + i * 32}" r="10"/>${tx(28, 62 + i * 32, String(i + 1), 'cf-bb mid')}${tx(46, 56 + i * 32, t, 'cf-lbl l')}${tx(46, 70 + i * 32, s, 'cf-tick l')}`).join('');
    // la parade : trois voies, la CAM 1 à gauche de chaque voie, la CAM 2 à droite ; trois niveaux (noir, gris, blanc)
    const parade = (x0, y0, off, title) => {
      const lv = [0.02, 0.4, 0.88], H = 74, w = 58;
      let s = `<rect class="c7f-scope" x="${x0}" y="${y0}" width="${3 * w + 8}" height="${H + 12}" rx="3"/>${tx(x0 + (3 * w + 8) / 2, y0 - 6, title, 'cf-bt c7f-mid')}`;
      ['r', 'g', 'b'].forEach((c, i) => {
        const x = x0 + 4 + i * w;
        for (const [j, l] of lv.entries()) {
          const y1 = y0 + 6 + H * (1 - l), y2 = y0 + 6 + H * (1 - l - off[i][j]);
          s += `<line class="c7f-tr ${c}" x1="${x + 4}" y1="${n1(y1)}" x2="${x + w / 2 - 3}" y2="${n1(y1)}"/><line class="c7f-tr ${c}" x1="${x + w / 2 + 3}" y1="${n1(y2)}" x2="${x + w - 4}" y2="${n1(y2)}"/>`;
        }
        s += `<line class="c7f-sep" x1="${x + w / 2}" y1="${y0 + 4}" x2="${x + w / 2}" y2="${y0 + H + 8}"/>`;
      });
      return s;
    };
    const before = [[0.03, 0.05, 0.06], [0.015, 0.03, 0.04], [-0.005, -0.04, -0.07]], after = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    return svg(262, 'Schéma : les six étapes du line-up (fichier de référence, barres, noirs, blancs, exposition, couleurs) ; la parade R, V, B de deux caméras, la CAM 1 à gauche de chaque voie et la CAM 2 à droite : avant le raccord, les traces de la CAM 2 sont décalées ; après, elles sont à la hauteur de celles de la CAM 1.', `
      ${head('Raccorder sur une caméra de référence', 'Dans l\'ordre, caméra par caméra, depuis les RCP.')}
      ${steps}
      ${parade(236, 58, before, 'Avant')}${parade(236, 170, after, 'Après')}
      ${tx(330, 258, 'R, V, B : CAM 1 | CAM 2 (noir, gris, blanc)', 'cf-tick')}`);
  },
};
