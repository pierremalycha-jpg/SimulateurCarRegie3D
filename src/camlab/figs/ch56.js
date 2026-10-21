// @ts-check
// Schémas des fiches du module caméra : le corps de la caméra, le viseur et le cadreur (chapitres 5 et 6). Un schéma par fiche, nommé par le champ `fig`.
// Aides communes : ../figkit.js (svg, tx, head, rays, dim, n1). Classes cf-* (camlab.css) et c56-* (camlab-ch56.css).
// Chiffres : mode d'emploi et fiche technique Sony HXC-FB80 et HXCU-FB80 (voir labs/ch56.js et les fiches).

import { svg, tx, head, dim } from '../figkit.js';

/** une boîte avec son titre et ses lignes */
const card = (x, y, w, title, lines, cls = '') => `<g transform="translate(${x} ${y})"><rect class="cf-box ${cls}" x="0" y="0" width="${w}" height="${22 + lines.length * 14}" rx="3"/>${tx(8, 15, title, 'cf-bb')}${lines.map((l, i) => tx(8, 31 + i * 14, l, 'cf-bs')).join('')}</g>`;
/** une boîte d'appareil, son nom au milieu */
const dev = (x, y, w, h, name, sub = '') => `<rect class="cf-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>${tx(x + w / 2, y + h / 2 + (sub ? -2 : 4), name, 'cf-bb mid')}${sub ? tx(x + w / 2, y + h / 2 + 12, sub, 'cf-s') : ''}`;
/** une flèche */
const arrow = (x1, y1, x2, y2, cls = 'cf-dim') => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#cf-a)"/>`;

export const FIGS_CH56 = {
  /** le panneau des commandes du corps, et ce que le RCP reprend quand la caméra est reliée à la CCU */
  commandes: () => {
    const tg = (x, y, name, pos) => `<rect class="cf-sw c56-remote" x="${x - 9}" y="${y - 12}" width="18" height="24" rx="3"/><line class="c56-lever" x1="${x}" y1="${y}" x2="${x}" y2="${y - 10}"/>${tx(x, y + 26, name, 'cf-s')}${tx(x, y + 39, pos, 'cf-s')}`;
    const btn = (x, y, name, cls) => `<circle class="cf-knob ${cls}" cx="${x}" cy="${y}" r="9"/>${tx(x, y + 22, name, 'cf-s')}`;
    return svg(262, 'Schéma du panneau des commandes : FILTER, COLOR TEMP., ASSIGN 1 à 3, les commutateurs GAIN, OUTPUT et WHITE BAL, WHT/BLK, et les touches du menu. Reliée à la CCU, FILTER, GAIN, OUTPUT/AUTO KNEE, WHITE BAL, WHT/BLK et SHUTTER sont commandés par le RCP ; les touches ASSIGN, le menu, le viseur, l\'intercom et le CALL restent au cadreur.', `
      ${head('Le panneau des commandes', 'Reliée à la CCU, les commandes en bleu obéissent au RCP de la vision.')}
      <rect class="cf-plate" x="10" y="44" width="226" height="212" rx="6"/>
      <rect class="cf-sw c56-remote" x="20" y="54" width="92" height="62" rx="3"/>${tx(28, 70, 'FILTER', 'cf-bb')}
      ${['1 CLEAR', '2 1/4ND', '3 1/16ND', '4 1/64ND'].map((t, i) => tx(28, 84 + i * 10, t, 'cf-s l')).join('')}
      ${btn(172, 72, 'COLOR TEMP.', 'c56-own')}
      ${btn(36, 136, 'ASSIGN 1', 'c56-own')}${btn(92, 136, 'ASSIGN 2', 'c56-own')}${btn(148, 136, 'ASSIGN 3', 'c56-own')}
      <rect class="cf-sw c56-remote" x="197" y="126" width="18" height="18" rx="3"/>${tx(206, 158, 'WHT/BLK', 'cf-s')}
      ${tg(40, 192, 'GAIN', 'L · M · H')}${tg(116, 192, 'OUTPUT', 'BARS · CAM')}${tg(192, 192, 'WHITE BAL', 'B · A · PRST')}
      ${tx(123, 250, 'STATUS/CANCEL · DISPLAY/MENU · molette', 'cf-s')}
      ${card(246, 44, 186, 'Reliée à la CCU : le RCP', ['FILTER (ND)', 'GAIN', 'OUTPUT/AUTO KNEE (barres)', 'WHITE BAL et WHT/BLK', 'SHUTTER'], 'c56-remote')}
      ${card(246, 146, 186, 'Toujours au cadreur', ['ASSIGN 1 à 3 (fonction au choix)', 'le menu, le viseur', 'l\'intercom, le CALL, les RET'], 'c56-own')}
      ${tx(254, 236, 'GAIN d\'usine :', 'cf-s l')}${tx(254, 250, 'L 0 dB · M 6 dB · H 12 dB', 'cf-s l')}`);
  },

  /** trois façons d'alimenter la tête, et ce qu'elle consomme */
  alimentation: () => {
    const row = (y, link, local, l1, l2) => {
      const ccu = link ? `<rect class="cf-box" x="16" y="${y - 13}" width="48" height="26" rx="3"/>${tx(40, y + 4, 'CCU', 'cf-s')}<line class="c56-cab ${link}" x1="64" y1="${y}" x2="150" y2="${y}"/>` : tx(40, y + 4, 'pas de CCU', 'cf-s');
      const cam = `<rect class="cf-body" x="150" y="${y - 13}" width="60" height="26" rx="3"/><rect class="cf-vf" x="186" y="${y - 22}" width="20" height="9" rx="2"/>${tx(180, y + 4, 'caméra', 'cf-s')}`;
      const dc = local ? `<line class="c56-dc" x1="210" y1="${y}" x2="232" y2="${y}"/><rect class="cf-box" x="232" y="${y - 11}" width="54" height="22" rx="2"/>${tx(259, y + 4, 'DC IN', 'cf-s')}` : '';
      return `${ccu}${cam}${dc}${tx(296, y - 3, l1, 'cf-s l')}${tx(296, y + 11, l2, 'cf-s l')}`;
    };
    const segs = [['corps', 19, 'corps 19 W'], ['viseur', 13, 'viseur 13 W'], ['objectif', 5, '≈ 5']];
    let x = 16;
    const bar = segs.map(([c, p, t]) => { const w = Number(p) * 6.4, r = `<rect class="c56-ld ${c}" x="${x}" y="206" width="${w}" height="20"/>${tx(x + w / 2, 220, String(t), 'cf-s c56-ink')}`; x += w; return r; }).join('');
    return svg(256, 'Schéma : en fibre hybride, la CCU alimente la caméra jusqu\'à 600 m ; en fibre monomode, jusqu\'à 10 km, la caméra s\'alimente sur place par DC IN ; sans CCU, par DC IN seulement. En dessous, ce que consomme la tête : 19 W pour le corps, 13 W de plus pour le viseur, quelques watts pour l\'objectif, et DC OUT qui fournit jusqu\'à 1,5 A à un accessoire.', `
      ${head('Trois façons d\'alimenter la tête', 'Le cuivre du câble hybride porte l\'énergie ; la fibre seule, non.')}
      ${row(64, 'c56-cab-h', false, 'fibre hybride : la CCU', 'alimente, jusqu\'à 600 m')}
      ${row(112, 'c56-cab-s', true, 'fibre monomode : 10 km,', 'énergie prise sur place')}
      ${row(160, '', true, 'sans CCU : DC IN seul,', '10,5 à 17 V, 5,4 A au plus')}
      ${tx(16, 196, 'Ce que la tête consomme', 'cf-bt')}${tx(186, 196, '(fiche Sony ; objectif : ordre de grandeur)', 'cf-s l')}
      <rect class="cf-box" x="16" y="206" width="${37 * 6.4}" height="20"/>${bar}
      ${tx(262, 220, '+ DC OUT : 1,5 A au plus', 'cf-s l')}${tx(16, 246, '≈ 32 W avec le viseur fourni, ≈ 37 W avec l\'objectif', 'cf-s l')}`);
  },

  /** le tally du mélangeur à la tête, le CALL vers la vision, l'intercom PROD et ENG */
  tally: () => svg(266, 'Schéma : le mélangeur envoie le tally à la CCU ; par la fibre, il allume à la caméra la lampe du viseur et le voyant du corps en rouge quand elle est au programme, le voyant G TALLY du viseur quand elle est au preview. Le CALL de la caméra allume le tally rouge du RCP. L\'intercom : la ligne PROD de la réalisation et la ligne ENG de la vision et de la technique, choisies par le commutateur INTERCOM MIC.', `
    ${head('Tally, CALL et intercom', 'Tout passe par la CCU et la fibre, dans les deux sens.')}
    <rect class="cf-box" x="12" y="44" width="110" height="64" rx="4"/>${tx(67, 60, 'mélangeur', 'cf-bb mid')}
    <rect class="c56-pgm" x="22" y="68" width="18" height="10" rx="2"/>${tx(46, 77, 'PGM : CAM 2', 'cf-s l')}<rect class="c56-pvw" x="22" y="88" width="18" height="10" rx="2"/>${tx(46, 97, 'PVW : CAM 3', 'cf-s l')}
    ${arrow(122, 76, 160, 76)}${tx(141, 70, 'tally', 'cf-s')}${dev(162, 50, 64, 52, 'CCU', 'CAM 2')}
    <line class="c56-cab c56-cab-h" x1="226" y1="76" x2="272" y2="76"/>${tx(249, 68, 'fibre', 'cf-s')}
    <rect class="cf-body" x="272" y="44" width="160" height="66" rx="4"/>
    <rect class="c56-lamp red" x="280" y="52" width="24" height="10" rx="2"/>${tx(310, 61, 'lampe du viseur', 'cf-s l')}
    <circle class="c56-led red" cx="286" cy="80" r="4"/><circle class="c56-led" cx="298" cy="80" r="4"/>${tx(310, 84, 'R TALLY · G TALLY', 'cf-s l')}
    <circle class="c56-led red" cx="286" cy="99" r="4"/>${tx(310, 103, 'corps : rouge seul', 'cf-s l')}
    ${tx(16, 126, 'Rouge : à l\'antenne (programme) · vert : la prochaine (preview)', 'cf-s l')}
    ${dev(12, 140, 110, 52, 'intercom', 'PROD · ENG')}
    ${arrow(122, 158, 160, 158)}${arrow(160, 174, 122, 174)}${dev(162, 140, 64, 52, 'CCU')}
    <line class="c56-cab c56-cab-h" x1="226" y1="166" x2="272" y2="166"/>
    ${card(272, 136, 160, 'INTERCOM MIC', ['PROD : la réalisation', 'OFF : micro coupé', 'ENG : vision, technique', 'casque : prise XLR 5'])}
    ${tx(16, 228, 'CALL de la caméra :', 'cf-s l')}${tx(16, 242, 'le tally rouge du RCP', 'cf-s l')}${tx(16, 256, 's\'allume', 'cf-s l')}
    ${dev(176, 224, 60, 32, 'RCP')}${arrow(300, 240, 238, 240, 'c56-call')}<rect class="cf-body" x="300" y="228" width="60" height="24" rx="3"/><circle class="c56-btn on" cx="314" cy="240" r="6"/>${tx(340, 244, 'CALL', 'cf-s')}`),

  /** les retours de la grille jusqu'au viseur, et le prompteur */
  retours: () => {
    const srcs = [['programme', 'SDI-1', 'RET-1'], ['preview', 'SDI-2', 'RET-2'], ['caméra 1', 'VBS-1', 'RET-3'], ['habillage', 'VBS-2', 'RET-4']];
    const rows = srcs.map(([s, inp, ret], i) => { const y = 72 + i * 24; return `${tx(16, y + 4, s, 'cf-s l')}${arrow(80, y, 148, y)}${tx(114, y - 4, inp, 'cf-s')}${tx(186, y + 4, ret, 'cf-s')}`; }).join('');
    return svg(262, 'Schéma : la grille envoie quatre retours à la CCU (programme, preview, caméra 1, habillage), sur les entrées SDI-1, SDI-2, VBS-1 et VBS-2, rangées en RET-1 à RET-4 par la page RETURN SET ; la fibre les porte au viseur, où la touche RET 1 montre le retour 1, RET2 SEL choisit le retour 2, 3 ou 4 de la touche RET, et MIX VF les mélange à l\'image. Le prompteur entre à la CCU et ressort à la caméra par la prise PROMPTER/GENLOCK.', `
      ${head('Les retours et le prompteur', 'La grille envoie, la CCU range, la fibre porte jusqu\'au viseur.')}
      ${tx(16, 54, 'la grille', 'cf-bt')}${rows}
      <rect class="cf-box" x="150" y="56" width="72" height="100" rx="4"/>${tx(186, 170, 'CCU · RETURN SET', 'cf-s')}
      <line class="c56-cab c56-cab-h" x1="222" y1="106" x2="262" y2="106"/>${tx(242, 98, 'fibre', 'cf-s')}
      ${card(262, 50, 170, 'Dans le viseur', ['RET 1 : le retour 1, tant', 'qu\'on appuie', 'RET2 SEL 2 · 3 · 4 : celui', 'de la touche « retour 2 »', 'MIX VF : mêlé à l\'image'])}
      ${tx(16, 204, 'le prompteur', 'cf-s l')}${arrow(86, 200, 146, 200)}
      <rect class="cf-box" x="148" y="184" width="82" height="32" rx="4"/>${tx(189, 204, 'PROMPTER IN', 'cf-s')}
      <line class="c56-cab c56-cab-h" x1="230" y1="200" x2="262" y2="200"/>
      ${card(262, 180, 170, 'À la caméra', ['PROMPTER/GENLOCK (BNC)', 'vers le moniteur prompteur'])}
      ${tx(16, 238, 'Exemple de car : les quatre retours se choisissent à la CCU.', 'cf-s l')}
      ${tx(16, 252, 'Sans CCU, PROMPTER/GENLOCK reçoit la synchro (genlock).', 'cf-s l')}`);
  },

  /** ce que le viseur ajoute à l'image, et ce qui part vraiment au car */
  viseur: () => {
    const star = (cx, cy, R) => Array.from({ length: 12 }, (_, i) => { const a0 = i / 12 * Math.PI * 2, a1 = (i + 0.5) / 12 * Math.PI * 2; return `<path class="c56-star" d="M${cx} ${cy} L${(cx + R * Math.cos(a0)).toFixed(1)} ${(cy + R * Math.sin(a0)).toFixed(1)} A${R} ${R} 0 0 1 ${(cx + R * Math.cos(a1)).toFixed(1)} ${(cy + R * Math.sin(a1)).toFixed(1)} Z"/>`; }).join('');
    const knob = (x, t) => `<circle class="cf-knob" cx="${x}" cy="210" r="10"/><rect class="cf-accent" x="${x - 1.5}" y="201" width="3" height="7" rx="1"/>${tx(x, 234, t, 'cf-s')}`;
    const zebra = Array.from({ length: 8 }, (_, i) => `<line class="c56-zebl" x1="${190 + i * 5}" y1="150" x2="${196 + i * 5}" y2="138"/>`).join('');
    return svg(262, 'Schéma : le viseur de 7 pouces montre l\'image avec la zone de sécurité à 90 %, la croix du centre, des zébras sur un blanc écrêté, le peaking sur les contours nets de l\'étoile. BRIGHT, CONTRAST, PEAKING, zébras, marqueurs, VF OUT et retours ne changent que le viseur ; l\'extender numérique (D.EXTENDER ×2 ou ×4) agrandit aussi l\'image qui part au car.', `
      ${head('Ce que le viseur ajoute, et ce qui sort', 'Presque tout reste dans le viseur ; l\'extender change aussi la sortie.')}
      <rect class="cf-vf" x="12" y="44" width="224" height="126" rx="3"/>
      <rect class="c56-mire" x="94" y="64" width="60" height="60" rx="1"/>${star(124, 92, 22)}<circle class="c56-peak" cx="124" cy="92" r="23"/>
      <rect class="c56-white" x="186" y="134" width="44" height="20"/>${zebra}
      <rect class="cf-dash" x="23" y="50" width="202" height="114" fill="none"/><path class="c56-cross" d="M118 107 h12 M124 101 v12"/>
      ${tx(28, 64, 'Z 20 mm', 'cf-mono')}${tx(28, 78, 'F5.6', 'cf-mono')}${tx(220, 64, 'D.EX ×2', 'cf-mono hi c56-r')}
      ${tx(124, 186, 'zone 90 %, centre, zébras, peaking', 'cf-s')}
      ${knob(48, 'BRIGHT')}${knob(124, 'CONTRAST')}${knob(200, 'PEAKING')}${tx(124, 252, 'écran 7 pouces, 1920 × 1080', 'cf-s')}
      ${card(250, 44, 182, 'Le viseur seul', ['BRIGHT, CONTRAST : l\'écran', 'PEAKING, VF DETAIL : contours', 'ZEBRA : 70 % ± 5, 100 %', 'VF MARKER : centre, zone', 'VF OUT : une seule voie', 'RET, MIX VF : les retours'], 'c56-own')}
      ${card(250, 162, 182, 'Aussi la sortie', ['D.EXTENDER ×2 ou ×4 :', 'le centre agrandi part au car'], 'c56-out-c')}
      ${tx(341, 236, 'La forme d\'onde se lit', 'cf-s')}${tx(341, 250, 'sur la sortie, pas au viseur', 'cf-s')}`);
  },

  /** l'équilibrage sur la tête fluide, et les commandes reportées sur les manches */
  cadreur: () => {
    // la caméra équilibrée, à l'échelle (1 m = 330 px) : repère de la caméra (monture en 0, axe optique en 0),
    // axe d'inclinaison 21 cm sous l'axe optique, centre de gravité au-dessus de l'axe (voir labs/ch56.js, MASSES)
    const S = 330, ax = 214, ay = 222, xa = -0.1198, h = 0.21;
    const X = (x) => (ax + (x - xa) * S).toFixed(1), Y = (y) => (ay - (y + h) * S).toFixed(1);
    const box = (x0, y0, x1, y1, cls) => `<rect class="${cls}" x="${X(x0)}" y="${Y(y1)}" width="${((x1 - x0) * S).toFixed(1)}" height="${((y1 - y0) * S).toFixed(1)}" rx="3"/>`;
    const gy = Number(Y(0.0386));
    return svg(278, 'Schéma de côté : la caméra sur la plaque de la tête fluide, équilibrée : son centre de gravité est à la verticale de l\'axe d\'inclinaison, environ 25 cm au-dessus. Le couple du poids vaut la masse fois g fois l\'écart à l\'axe ; en inclinant, le contrepoids compense m × g × h × sin θ. Les manches portent les commandes reportées : le zoom sous le pouce droit, le point sous la main gauche.', `
      ${head('Le poste du cadreur', 'Équilibrer la caméra sur la tête ; le zoom et le point sous les mains.')}
      <polygon class="c56-bar" points="${X(-0.30)},${Y(-0.17)} ${X(-0.62)},${Y(-0.27)} ${X(-0.62)},${Y(-0.245)} ${X(-0.30)},${Y(-0.155)}"/>
      <circle class="c56-btn on" cx="${X(-0.61)}" cy="${Y(-0.258)}" r="6"/>
      <rect class="c56-head" x="${ax - 34}" y="${ay - 6}" width="68" height="30" rx="6"/><rect class="c56-leg" x="${ax - 18}" y="${ay + 24}" width="36" height="12"/>
      ${box(-0.30, -0.19, -0.03, -0.165, 'c56-plt')}${box(-0.314, -0.123, -0.016, 0.074, 'cf-body')}
      ${box(0, -0.0475, 0.2375, 0.0475, 'cf-lens')}${box(0.2375, -0.06, 0.29, 0.06, 'cf-lens')}
      ${box(-0.36, 0.074, -0.33, 0.172, 'c56-brk')}${box(-0.405, 0.172, -0.30, 0.322, 'cf-body')}
      <circle class="c56-axis" cx="${ax}" cy="${ay}" r="5"/>
      <line class="cf-dash" x1="${ax}" y1="${gy}" x2="${ax}" y2="${ay + 30}"/><circle class="c56-cg" cx="${ax}" cy="${gy}" r="7"/><path class="c56-cgx" d="M${ax - 7} ${gy} h14 M${ax} ${gy - 7} v14"/>
      ${tx(ax + 12, gy - 8, 'centre de gravité', 'cf-s l')}${tx(ax + 40, ay + 4, 'axe d\'inclinaison', 'cf-s l')}
      ${dim(370, gy, 370, ay)}${tx(376, (gy + ay) / 2 + 4, 'h ≈ 25 cm', 'cf-s l')}
      ${tx(16, 260, 'manche droit : le zoom sous le pouce', 'cf-s l')}${tx(16, 274, 'manche gauche : le point (manivelle)', 'cf-s l')}
      ${card(282, 44, 150, 'couple = m · g · d', ['d : écart à l\'axe', '7 kg à 2 cm : 1,4 N·m', 'incliné : m·g·h·sin θ'])}`);
  },
};
