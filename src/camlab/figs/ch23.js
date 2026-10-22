// @ts-check
// Schémas des fiches du module caméra : les filtres, le prisme et les capteurs (chapitres 2 et 3). Un schéma par fiche, nommé par le champ `fig`.
// Aides communes : ../figkit.js (svg, tx, head, rays, dim, n1).
// Les chiffres sont ceux des fiches : CC électronique de la HXC-FB80 (3200, 4300, 5600, 6300 K),
// sensibilité f/13 à 2000 lx, rapport signal sur bruit 60 dB, vitesses du shutter en 50i,
// photosite de 5 µm, formats 1080/50i, 1080/50P, 1080/25PsF et 720/50P.

import { svg, tx, head, dim, n1 } from '../figkit.js';
import { kelvinRGB } from '../optics.js';
import { encode } from '../vf.js';

const mired = (T) => 1e6 / T;
const frn = (v, d = 0) => (Math.round(v * 10 ** d) / 10 ** d).toString().replace('.', ',');

/** couleur d'affichage d'une lumière blanche à T kelvins (corps noir, normalisé à sa voie la plus forte) */
function kColor(T) {
  const c = kelvinRGB(T), m = Math.max(...c);
  return `rgb(${c.map((v) => Math.round(255 * encode(v / m))).join(',')})`;
}

/** @type {Record<string, () => string>} */
export const FIGS_CH23 = {
  /** l'échelle des températures de couleur, en kelvins et en mireds, et les quatre positions du CC électronique */
  cc: () => {
    const x0 = 24, w = 392, m0 = mired(1800), m1 = mired(10000);
    const X = (T) => x0 + (m0 - mired(T)) / (m0 - m1) * w;
    const stops = [1800, 2400, 3200, 4300, 5600, 6500, 8000, 10000].map((T) => `<stop offset="${n1((X(T) - x0) / w)}" stop-color="${kColor(T)}"/>`).join('');
    const marks = [[1800, 'bougie'], [3200, 'tungstène'], [5600, 'jour'], [10000, 'ciel bleu']];
    const top = marks.map(([T, l]) => {
      const x = n1(X(T)), edge = T === 1800 ? ' l' : T === 10000 ? ' c23-r' : '', xl = T === 1800 ? x0 : T === 10000 ? x0 + w : x;
      // le ciel bleu sans valeur : c'est un ordre de grandeur, et la place manque à côté du jour
      const vals = T === 10000 ? '' : `${tx(xl, 108, String(T) + ' K', 'cf-tick' + edge)}${tx(xl, 121, frn(mired(+T)) + ' mired', 'cf-tick' + edge)}`;
      return `<line class="cf-axis" x1="${x}" y1="66" x2="${x}" y2="72"/>${tx(xl, 60, String(l), 'cf-lbl' + edge)}${vals}`;
    }).join('');
    const cc = [[3200, 'A', 0], [4300, 'B', 1], [5600, 'C', 0], [6300, 'D', 1]].map(([T, l, low]) => { const x = n1(X(T)); return `<path class="c23-flag" d="M${x} 158 l-6 -10 h12 z"/><line class="cf-axis" x1="${x}" y1="158" x2="${x}" y2="${low ? 186 : 168}"/>${tx(x, low ? 198 : 180, `${l} · ${T}K`, 'cf-lbl')}`; }).join('');
    return svg(262, 'Schéma : l\'échelle des températures de couleur, de la bougie (1800 K) au ciel bleu, régulière en mireds ; les quatre positions du CC électronique de la caméra, A 3200 K, B 4300 K, C 5600 K et D 6300 K ; de 3200 à 5600 K il y a 134 mired, de 5600 à 6300 K seulement 20.', `
      <defs><linearGradient id="c23-kgrad" x1="0" x2="1" y1="0" y2="0">${stops}</linearGradient></defs>
      ${head('La couleur de la lumière', 'Une échelle régulière en mireds (un million ÷ T) : en kelvins, elle se tasse vers le bleu.')}
      <rect x="${x0}" y="72" width="${w}" height="22" rx="3" fill="url(#c23-kgrad)" class="c23-kbar"/>
      ${top}
      ${tx(16, 142, 'COLOR TEMP. : le CC électronique de la FB80', 'cf-bt')}
      <line class="cf-axis" x1="${x0}" y1="158" x2="${x0 + w}" y2="158"/>${cc}
      ${dim(n1(X(3200)), 220, n1(X(5600)), 220)}${tx(n1((X(3200) + X(5600)) / 2), 234, '134 mired', 'cf-lbl')}
      ${dim(n1(X(5600)), 220, n1(X(6300)), 220)}${tx(n1(X(6300) + 8), 224, '20 mired', 'cf-lbl l')}
      ${tx(16, 256,'De 5600 à 6300 K, sept fois moins d\'écart que de 3200 à 5600 K.', 'cf-sub')}`);
  },

  /** le trajet de la lumière devant les capteurs (passe-bas, infrarouge), et le spectre */
  olpf: () => {
    const cy = 92;
    const X = (nm) => 30 + (nm - 350) / 800 * 390, base = 238, hh = 46;
    const vis = [[400, '#6a3ab0'], [470, '#2f5cff'], [500, '#22c0e0'], [540, '#36d05a'], [580, '#f0e030'], [620, '#ff8a20'], [700, '#d01414']].map(([nm, c]) => `<stop offset="${n1((+nm - 400) / 300)}" stop-color="${c}"/>`).join('');
    const path = (fn) => { let d = ''; for (let nm = 350; nm <= 1150; nm += 10) d += `${nm === 350 ? 'M' : 'L'}${n1(X(nm))} ${n1(base - fn(nm) * hh)} `; return d; };
    const si = path((nm) => (nm < 400 ? 0.15 : nm < 800 ? 0.25 + 0.75 * (nm - 400) / 400 : Math.max(0, (1100 - nm) / 300)));
    const irf = path((nm) => (nm < 640 ? 1 : nm > 720 ? 0 : 0.5 * (1 + Math.cos(Math.PI * (nm - 640) / 80))));
    const ticks = [400, 500, 600, 700, 800, 900, 1000, 1100].map((nm) => `<line class="cf-axis" x1="${n1(X(nm))}" y1="${base}" x2="${n1(X(nm))}" y2="${base + 4}"/>${tx(n1(X(nm)), base + 15, String(nm), 'cf-tick')}`).join('');
    const cells = [0, 1].map((r) => [0, 1].map((c) => `<rect class="cf-cell" x="${366 + c * 26}" y="${cy - 26 + r * 26}" width="24" height="24" rx="2"/><circle class="cf-dot" cx="${378 + c * 26}" cy="${cy - 14 + r * 26}" r="3.2"/>`).join('')).join('');
    return svg(274, 'Schéma : devant les capteurs, deux lames de quartz font d\'un point lumineux quatre points écartés d\'un photosite (5 µm), puis un filtre arrête l\'infrarouge. En bas, le spectre : la lumière visible de 400 à 700 nm, le silicium qui voit jusque vers 1100 nm, le filtre qui coupe vers 700 nm, la télécommande à 940 nm.', `
      ${head('Devant les capteurs, deux filtres', 'Ils ne se règlent pas : ils sont collés dans le bloc optique.')}
      <line class="cf-ray" x1="14" y1="${cy}" x2="120" y2="${cy}"/>
      <rect class="c23-quartz" x="120" y="${cy - 30}" width="30" height="60" rx="2"/>${tx(135, cy + 44, 'passe-bas', 'cf-lbl')}${tx(135, cy + 57, '(quartz)', 'cf-s')}
      <line class="cf-ray" x1="150" y1="${cy}" x2="200" y2="${cy - 6}"/><line class="cf-ray" x1="150" y1="${cy}" x2="200" y2="${cy + 6}"/>
      <rect class="c23-irf" x="200" y="${cy - 30}" width="16" height="60" rx="2"/>${tx(208, cy + 44, 'filtre IR', 'cf-lbl')}
      <line class="cf-ray" x1="216" y1="${cy - 6}" x2="262" y2="${cy - 6}"/><line class="cf-ray" x1="216" y1="${cy + 6}" x2="262" y2="${cy + 6}"/>
      <rect class="cf-prism" x="262" y="${cy - 26}" width="52" height="52" rx="2"/>${tx(288, cy + 44, 'prisme', 'cf-lbl')}
      <line class="cf-sensor" x1="330" y1="${cy - 24}" x2="330" y2="${cy + 24}"/>${tx(330, cy + 44, 'capteur', 'cf-lbl')}
      <line class="cf-ray" x1="314" y1="${cy - 6}" x2="330" y2="${cy - 6}"/><line class="cf-ray" x1="314" y1="${cy + 6}" x2="330" y2="${cy + 6}"/>
      <line class="cf-dash" x1="332" y1="${cy - 8}" x2="364" y2="${cy - 26}"/><line class="cf-dash" x1="332" y1="${cy + 8}" x2="364" y2="${cy + 26}"/>
      ${cells}${tx(391, cy - 34, '1 point → 4', 'cf-lbl')}${tx(392, cy + 44, 'à 5 µm d\'écart', 'cf-s')}
      ${tx(16, 166, 'Le spectre : ce que voit l\'œil, ce que voit le capteur', 'cf-bt')}
      <defs><linearGradient id="c23-vis" x1="0" x2="1">${vis}</linearGradient></defs>
      <rect x="${n1(X(400))}" y="${base - 2}" width="${n1(X(700) - X(400))}" height="6" fill="url(#c23-vis)"/>
      <rect class="c23-irband" x="${n1(X(700))}" y="${base - 2}" width="${n1(X(1100) - X(700))}" height="6"/>
      <line class="cf-axis" x1="${X(350)}" y1="${base}" x2="${X(1150)}" y2="${base}"/>${ticks}${tx(X(1150), base + 15, 'nm', 'cf-tick')}
      <path class="c23-si" d="${si}"/><path class="c23-irc" d="${irf}"/>
      <line class="c23-led" x1="${n1(X(940))}" y1="${base - hh}" x2="${n1(X(940))}" y2="${base}"/>
      ${tx(n1(X(550)), base + 28, 'visible', 'cf-lbl')}${tx(n1(X(900)), base + 28, 'infrarouge', 'cf-lbl')}
      <line class="c23-irc" x1="16" y1="182" x2="34" y2="182"/>${tx(40, 186, 'filtre IR', 'c23-lbl-ir l')}
      <line class="c23-si" x1="112" y1="182" x2="130" y2="182"/>${tx(136, 186, 'silicium (ordre de grandeur)', 'c23-lbl-si l')}
      <line class="c23-led" x1="300" y1="176" x2="300" y2="188"/>${tx(306, 186, 'télécommande 940 nm', 'c23-lbl-led l')}`);
  },

  /** le gain par pas de 3 dB : amplification, diaphragmes, rapport signal sur bruit, lumière nécessaire */
  gain: () => {
    const G = [-3, 0, 3, 6, 9, 12];
    let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 4294967296);
    const rows = G.map((g, i) => {
      const y = 62 + i * 25, a = 10 ** (g / 20), wpx = a * 34;
      const dots = Array.from({ length: Math.round(a * 5) }, () => `<circle class="c23-noise" cx="${n1(72 + rnd() * wpx)}" cy="${n1(y - 9 + rnd() * 12)}" r="1.3"/>`).join('');
      return `${tx(18, y, (g > 0 ? '+' : g < 0 ? '−' : '') + Math.abs(g) + ' dB', 'cf-lbl l')}<rect class="cf-zone" x="70" y="${y - 12}" width="${n1(wpx)}" height="15" rx="2"/>${dots}
        ${tx(232, y, '×' + frn(a, 2), 'cf-tick')}${tx(282, y, (g > 0 ? '+' : g < 0 ? '−' : '') + frn(Math.abs(g) / 6, 1), 'cf-tick')}${tx(334, y, String(60 - g), 'cf-tick')}${tx(396, y, String(Math.round(2000 * (5.6 / 13) ** 2 / a)), 'cf-tick')}`;
    }).join('');
    return svg(236, 'Schéma : le gain de −3 à +12 dB par pas de 3 dB. +6 dB multiplie le signal par deux, un diaphragme ; le rapport signal sur bruit passe de 60 dB à 0 dB à 48 dB à +12 dB ; la lumière nécessaire à f/5,6 passe de 371 à 93 lux.', `
      ${head('+6 dB = ×2 = un diaphragme', 'Le gain amplifie le signal du capteur, et son bruit avec.')}
      ${tx(18, 46, 'gain', 'cf-s l')}${tx(120, 46, 'amplification', 'cf-s')}${tx(282, 46, 'diaph.', 'cf-s')}${tx(334, 46, 'S/N (dB)', 'cf-s')}${tx(396, 46, 'lux à f/5,6', 'cf-s')}
      ${rows}
      ${tx(16, 222, 'FB80 : f/13 à 2000 lux (50 Hz) et 60 dB de rapport signal sur bruit, à 0 dB.', 'cf-sub')}`);
  },

  /** ce que chaque image garde du mouvement ; le scintillement des lampes à 100 Hz */
  shutter: () => {
    const x0 = 120, fw = 76; // 20 ms = 76 px
    const rowsT = [['OFF : 1/50 s', 1, '360°'], ['1/100 s', 0.5, '180°'], ['1/500 s', 0.1, '36°']].map(([l, r, a], i) => {
      const y = 52 + i * 32;
      const fr4 = [0, 1, 2, 3].map((k) => `<rect class="c23-frame" x="${x0 + k * fw}" y="${y}" width="${fw - 2}" height="22" rx="2"/><rect class="c23-win" x="${x0 + k * fw}" y="${y}" width="${n1(Math.max(3, (fw - 2) * +r))}" height="22" rx="2"/><rect class="c23-trace" x="${x0 + k * fw}" y="${y + 8}" width="${n1(Math.max(3, (fw - 2) * +r))}" height="6" rx="3"/>`).join('');
      return `${tx(16, y + 11, String(l), 'cf-lbl l')}${tx(16, y + 23, `angle ${a}`, 'cf-tick l')}${fr4}`;
    }).join('');
    const ms = [0, 1, 2, 3, 4].map((k) => tx(x0 + k * fw, 160, `${k * 20} ms`, 'cf-tick')).join('');
    let wave = ''; for (let x = 0; x <= 2 * fw * 2; x += 2) { const t = x / fw * 20; wave += `${x ? 'L' : 'M'}${x0 + x} ${n1(206 - 12 * Math.cos(2 * Math.PI * t / 10))} `; }
    const wins = [['1/50 s : 2 vibrations', 2 * fw, true], ['1/60 s : 1,67 vibration', 2 * fw / 1.2, false], ['1/100 s : 1 vibration', fw, true]].map(([l, w, ok], i) => {
      const y = 232 + i * 17;
      return `<rect class="${ok ? 'c23-win' : 'c23-bad'}" x="${x0}" y="${y - 9}" width="${n1(+w)}" height="11" rx="2"/>${tx(16, y, String(l), 'cf-tick l')}${tx(x0 + 2 * fw + 12, y, ok ? 'pas de scintillement' : 'scintille', ok ? 'c23-ok' : 'c23-ko')}`;
    }).join('');
    return svg(296, 'Schéma : quatre images de 20 ms. Shutter OFF, le capteur reçoit la lumière pendant toute l\'image et les traces du ballon se touchent ; à 1/100 s pendant la moitié, à 1/500 s pendant un dixième : des trous entre les images, le mouvement saute. En bas, une lumière qui vibre à 100 Hz : 1/50 s et 1/100 s en contiennent un nombre entier de vibrations et ne scintillent pas ; 1/60 s scintille.', `
      ${head('Ce que garde chaque image', '50 images par seconde, 20 ms chacune : le shutter n\'en garde qu\'une partie.')}
      ${rowsT}${ms}
      ${tx(16, 178, 'Une lampe sur le secteur 50 Hz vibre à 100 Hz :', 'cf-bt')}
      <path class="c23-wave" d="${wave}"/>
      ${wins}`);
  },

  /** les quatre réglages de l'exposition, leur prix, et l'ordre */
  exposition: () => {
    const B = [
      ['1 · Iris', ['il ouvre ou ferme le passage', 'prix : la profondeur de champ ;', 'au-delà de f/11, la diffraction']],
      ['2 · Filtre ND', ['retire 2, 4 ou 6 diaphragmes', 'prix : aucun sur l\'image ;', 'la roue ne tourne pas à l\'antenne']],
      ['3 · Gain', ['+6 dB = un diaphragme de plus', 'prix : le bruit ;', 'S/N 60 dB à 0 dB, 54 à +6 dB']],
      ['4 · Shutter', ['un temps de pose plus court', 'prix : la saccade du mouvement,', 'le scintillement des lampes']],
    ];
    const boxes = B.map(([t, lines], i) => {
      const x = 16 + (i % 2) * 210, y = 44 + Math.floor(i / 2) * 82;
      return `<g transform="translate(${x} ${y})"><rect class="cf-box" x="0" y="0" width="198" height="72" rx="3"/>${tx(10, 18, String(t), 'cf-bt')}${(/** @type {string[]} */ (lines)).map((l, k) => tx(10, 36 + k * 14, l, 'cf-bs')).join('')}</g>`;
    }).join('');
    return svg(262, 'Schéma : quatre réglages changent la luminosité, chacun avec son prix : l\'iris (la profondeur de champ, la diffraction), le filtre ND (aucun sur l\'image, mais pas à l\'antenne), le gain (le bruit), le shutter (la saccade, le scintillement). L\'ordre : l\'iris pour l\'image voulue, le ND pour la lumière en trop, le gain pour la lumière qui manque ; le shutter pour le mouvement.', `
      ${head('Quatre réglages, quatre prix', 'Tous changent la luminosité de l\'image ; chacun coûte autre chose.')}
      ${boxes}
      ${tx(16, 222, 'L\'ordre : l\'iris pour l\'image voulue → le ND pour la lumière en trop', 'cf-bb')}
      ${tx(16, 240, '→ le gain pour la lumière qui manque. Le shutter sert au mouvement', 'cf-bb')}
      ${tx(16, 256, 'et aux écrans, pas à l\'exposition.', 'cf-bb')}`);
  },

  /** les formats à la même échelle, les trames de l'entrelacé, la cadence */
  formats: () => {
    const lines = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => `<rect class="${k % 2 ? 'c23-f2' : 'c23-f1'}" x="246" y="${50 + k * 9}" width="80" height="7" rx="1"/><rect class="c23-f1" x="346" y="${50 + k * 9}" width="80" height="7" rx="1"/>`).join('');
    const x0 = 112, ms = 76; // 20 ms = 76 px, sur 80 ms
    const rowsT = [['1080/50i', 'f', 20], ['1080/50P', 'p', 20], ['1080/25PsF', 's', 40], ['720/50P', 'p', 20]].map(([l, k, step], i) => {
      const y = 176 + i * 17, n = 80 / +step;
      const cells = Array.from({ length: n }, (_, j) => {
        const x = x0 + j * (+step / 20) * ms, w = (+step / 20) * ms - 3;
        if (k === 'f') return `<rect class="${j % 2 ? 'c23-f2' : 'c23-f1'}" x="${n1(x)}" y="${y - 9}" width="${n1(w)}" height="11" rx="2"/>`;
        if (k === 's') return `<rect class="c23-f1" x="${n1(x)}" y="${y - 9}" width="${n1(w / 2 - 1)}" height="11" rx="2"/><rect class="c23-f1" x="${n1(x + w / 2 + 1)}" y="${y - 9}" width="${n1(w / 2 - 1)}" height="11" rx="2" opacity=".6"/>`;
        return `<rect class="c23-f1" x="${n1(x)}" y="${y - 9}" width="${n1(w)}" height="11" rx="2"/>`;
      }).join('');
      return `${tx(16, y, String(l), 'cf-tick l')}${cells}`;
    }).join('');
    const ticks = [0, 20, 40, 60, 80].map((t) => tx(n1(x0 + t / 20 * ms), 248, `${t} ms`, 'cf-tick')).join('');
    return svg(256, 'Schéma : à la même échelle, l\'image 1920 × 1080 (2,07 millions de pixels) et l\'image 1280 × 720 (0,92 million) ; en 1080i, les lignes paires et impaires sont deux trames prises à 20 ms d\'écart, en progressif toutes les lignes sont prises au même instant ; sur 80 ms, le 1080/50i fait quatre trames, le 1080/50P et le 720/50P quatre images, le 1080/25PsF deux images envoyées chacune en deux segments.', `
      ${head('Lignes, images, trames', 'Trois formats HD de la FB80, à la même échelle (1 px pour 10 pixels).')}
      <rect class="cf-face" x="16" y="48" width="192" height="108" rx="2"/><rect class="c23-720" x="16" y="48" width="128" height="72" rx="2"/>
      ${tx(112, 150, '1920 × 1080 : 2,07 Mpx', 'cf-lbl')}${tx(80, 88, '1280 × 720', 'cf-lbl')}${tx(80, 102, '0,92 Mpx', 'cf-s')}
      ${lines}${tx(286, 134, '1080i : 2 trames', 'cf-lbl')}${tx(286, 147, 'à 20 ms d\'écart', 'cf-s')}${tx(386, 134, 'progressif', 'cf-lbl')}${tx(386, 147, 'toutes à t', 'cf-s')}
      ${rowsT}${ticks}`);
  },
};
