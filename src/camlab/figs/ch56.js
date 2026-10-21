// @ts-check
// Schémas des fiches du module caméra : le corps de la caméra, le viseur et le cadreur (chapitres 5 et 6). Un schéma par fiche, nommé par le champ `fig`.
// Aides communes : ../figkit.js (svg, tx, head, rays, dim, n1). Classes cf-* (camlab.css) et c56-* (camlab-ch56.css).
// Chiffres : mode d'emploi et fiche technique Sony HXC-FB80 et HXCU-FB80 (voir labs/ch56.js et les fiches).

import { svg, tx, head, dim } from '../figkit.js';

/** une boîte avec son titre et ses lignes */
const card = (x, y, w, title, lines, cls = '') => `<g transform="translate(${x} ${y})"><rect class="cf-box ${cls}" x="0" y="0" width="${w}" height="${22 + lines.length * 14}" rx="3"/>${tx(8, 15, title, 'cf-bb')}${lines.map((l, i) => tx(8, 31 + i * 14, l, 'cf-bs')).join('')}</g>`;
/** une boîte d'appareil, son nom au milieu */
const dev = (x, y, w, h, name, sub = '') => `<rect class="cf-box" x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/>${tx(x + w / 2, y + h / 2 + (sub ? -2 : 4), name, 'cf-bb mid')}${sub ? tx(x + w / 2, y + h / 2 + 12, sub, 'cf-tick') : ''}`;
/** une flèche */
const arrow = (x1, y1, x2, y2, cls = 'cf-dim') => `<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#cf-a)"/>`;

export const FIGS_CH56 = {
  /** le panneau des commandes du corps, et ce que le RCP reprend quand la caméra est reliée à la CCU */
  commandes: () => {
    const tg = (x, y, name, pos) => `<rect class="cf-sw c56-remote" x="${x - 9}" y="${y - 12}" width="18" height="24" rx="3"/><line class="c56-lever" x1="${x}" y1="${y}" x2="${x}" y2="${y - 10}"/>${tx(x, y + 26, name, 'cf-tick')}${tx(x, y + 38, pos, 'cf-tick')}`;
    const btn = (x, y, name, cls) => `<circle class="cf-knob ${cls}" cx="${x}" cy="${y}" r="9"/>${tx(x, y + 22, name, 'cf-tick')}`;
    return svg(262, 'Schéma du panneau des commandes : FILTER, COLOR TEMP., ASSIGN 1 à 3, les commutateurs GAIN, OUTPUT et WHITE BAL, WHT/BLK, et les touches du menu. Reliée à la CCU, FILTER, GAIN, OUTPUT/AUTO KNEE, WHITE BAL, WHT/BLK et SHUTTER sont commandés par le RCP ; les touches ASSIGN, le menu, le viseur, l\'intercom et le CALL restent au cadreur.', `
      ${head('Le panneau des commandes', 'Reliée à la CCU, les commandes en bleu obéissent au RCP de la vision.')}
      <rect class="cf-plate" x="10" y="44" width="226" height="212" rx="6"/>
      <rect class="cf-sw c56-remote" x="20" y="54" width="92" height="62" rx="3"/>${tx(28, 70, 'FILTER', 'cf-bb')}
      ${['1 CLEAR', '2 1/4ND', '3 1/16ND', '4 1/64ND'].map((t, i) => tx(28, 84 + i * 10, t, 'cf-tick l')).join('')}
      ${btn(176, 72, 'COLOR TEMP.', 'c56-own')}
      ${btn(40, 140, 'ASSIGN 1', 'c56-own')}${btn(104, 140, 'ASSIGN 2', 'c56-own')}${btn(168, 140, 'ASSIGN 3', 'c56-own')}
      ${tg(40, 190, 'GAIN', 'L · M · H')}${tg(104, 190, 'OUTPUT', 'BARS · CAM')}${tg(168, 190, 'WHITE BAL', 'B · A · PRST')}
      ${tx(212, 186, 'WHT/BLK', 'cf-tick')}<rect class="cf-sw c56-remote" x="203" y="160" width="18" height="16" rx="3"/>
      ${tx(123, 250, 'STATUS/CANCEL · DISPLAY/MENU · molette', 'cf-tick')}
      ${card(246, 44, 186, 'Reliée à la CCU : le RCP', ['FILTER (ND)', 'GAIN', 'OUTPUT/AUTO KNEE (barres)', 'WHITE BAL et WHT/BLK', 'SHUTTER'], 'c56-remote')}
      ${card(246, 146, 186, 'Toujours au cadreur', ['ASSIGN 1 à 3 (fonction au choix)', 'le menu, le viseur', 'l\'intercom, le CALL, les RET'], 'c56-own')}
      ${tx(339, 248, 'GAIN d\'usine : L 0 dB, M 6 dB, H 12 dB', 'cf-tick')}`);
  },

  /** trois façons d'alimenter la tête, et ce qu'elle consomme */
  alimentation: () => {
    const cam = (x, y) => `<rect class="cf-body" x="${x}" y="${y - 14}" width="62" height="28" rx="3"/><rect class="cf-vf" x="${x + 38}" y="${y - 24}" width="20" height="10" rx="2"/>${tx(x + 31, y + 4, 'caméra', 'cf-tick')}`;
    const ccu = (x, y) => `<rect class="cf-box" x="${x}" y="${y - 14}" width="50" height="28" rx="3"/>${tx(x + 25, y + 4, 'CCU', 'cf-tick')}`;
    const loc = (x, y, t) => `<line class="c56-dc" x1="${x}" y1="${y + 14}" x2="${x}" y2="${y + 26}"/><rect class="cf-box" x="${x - 34}" y="${y + 26}" width="68" height="14" rx="2"/>${tx(x, y + 36, t, 'cf-tick')}`;
    const segs = [['corps', 19, 'corps 19 W'], ['viseur', 13, 'viseur 13 W'], ['objectif', 5, '≈ 5']];
    let x = 16;
    const bar = segs.map(([c, p, t]) => { const w = Number(p) * 6.4, r = `<rect class="c56-ld ${c}" x="${x}" y="226" width="${w}" height="20"/>${tx(x + w / 2, 240, String(t), 'cf-tick ink')}`; x += w; return r; }).join('');
    return svg(262, 'Schéma : en fibre hybride, la CCU alimente la caméra jusqu\'à 600 m ; en fibre monomode, jusqu\'à 10 km, la caméra s\'alimente sur place par DC IN ; sans CCU, par DC IN seulement. En dessous, ce que consomme la tête : 19 W pour le corps, 13 W de plus pour le viseur, quelques watts pour l\'objectif, et DC OUT qui fournit jusqu\'à 1,5 A à un accessoire.', `
      ${head('Trois façons d\'alimenter la tête', 'Le cuivre du câble hybride porte l\'énergie ; une fibre seule ne porte que la lumière.')}
      ${ccu(16, 62)}<line class="c56-cab c56-cab-h" x1="66" y1="62" x2="196" y2="62"/>${cam(196, 62)}${tx(268, 58, 'fibre hybride : la CCU', 'cf-lbl l')}${tx(268, 72, 'alimente, jusqu\'à 600 m', 'cf-lbl l')}
      ${ccu(16, 116)}<line class="c56-cab c56-cab-s" x1="66" y1="116" x2="196" y2="116"/>${cam(196, 116)}${loc(227, 116, 'DC IN')}${tx(268, 112, 'fibre monomode : 10 km,', 'cf-lbl l')}${tx(268, 126, 'énergie prise sur place', 'cf-lbl l')}
      ${cam(196, 178)}${loc(227, 178, 'DC IN')}${tx(268, 174, 'sans CCU : DC IN seul,', 'cf-lbl l')}${tx(268, 188, '10,5 à 17 V, 5,4 A au plus', 'cf-lbl l')}
      ${tx(16, 218, 'Ce que la tête consomme (fiche Sony ; objectif : ordre de grandeur)', 'cf-bt')}
      <rect class="cf-box" x="16" y="226" width="${37 * 6.4}" height="20"/>${bar}
      ${tx(260, 240, '+ DC OUT : 1,5 A au plus', 'cf-lbl l')}${tx(16, 258, '≈ 32 W avec le viseur fourni, ≈ 37 W avec l\'objectif', 'cf-tick l')}`);
  },

  /** le tally du mélangeur à la tête, le CALL vers la vision, l'intercom PROD et ENG */
  tally: () => svg(262, 'Schéma : le mélangeur envoie le tally à la CCU ; par la fibre, il allume à la caméra la lampe du viseur et le voyant du corps en rouge quand elle est au programme, le voyant G TALLY du viseur quand elle est au preview. Le CALL de la caméra allume le tally rouge de la CCU et du RCP. L\'intercom : la ligne PROD de la réalisation et la ligne ENG de la vision et de la technique, choisies par le commutateur INTERCOM MIC.', `
    ${head('Tally, CALL et intercom', 'Tout passe par la CCU et la fibre, dans les deux sens.')}
    ${dev(12, 46, 104, 58, 'mélangeur')}
    <rect class="c56-pgm" x="24" y="56" width="20" height="10" rx="2"/>${tx(50, 65, 'PGM : CAM 2', 'cf-tick l')}<rect class="c56-pvw" x="24" y="84" width="20" height="10" rx="2"/>${tx(50, 93, 'PVW : CAM 3', 'cf-tick l')}
    ${dev(160, 46, 70, 58, 'CCU', 'CAM 2')}${arrow(116, 66, 158, 66)}${tx(137, 60, 'tally', 'cf-tick')}
    <line class="c56-cab c56-cab-h" x1="230" y1="75" x2="292" y2="75"/>${tx(261, 68, 'fibre', 'cf-tick')}
    <rect class="cf-body" x="292" y="50" width="140" height="62" rx="4"/><rect class="c56-lamp red" x="300" y="56" width="26" height="10" rx="2"/>${tx(332, 64, 'lampe du viseur', 'cf-tick l')}
    <circle class="c56-led red" cx="306" cy="82" r="4"/><circle class="c56-led" cx="320" cy="82" r="4"/>${tx(330, 85, 'R TALLY · G TALLY', 'cf-tick l')}
    <circle class="c56-led red" cx="306" cy="100" r="4"/>${tx(316, 103, 'voyant du corps : rouge seul', 'cf-tick l')}
    ${tx(362, 128, 'rouge : à l\'antenne · vert : prête', 'cf-lbl')}
    ${dev(12, 150, 104, 56, 'intercom')}${tx(24, 196, 'PROD · ENG', 'cf-tick l')}
    ${arrow(116, 170, 158, 170)}${arrow(158, 186, 116, 186)}${dev(160, 150, 70, 56, 'CCU')}
    <line class="c56-cab c56-cab-h" x1="230" y1="178" x2="292" y2="178"/>
    ${card(292, 146, 140, 'INTERCOM MIC', ['PROD : la réalisation', 'OFF : micro coupé', 'ENG : vision, technique'])}
    ${arrow(292, 238, 234, 238, 'c56-call')}${dev(160, 222, 70, 32, 'RCP')}${tx(300, 236, 'CALL de la caméra :', 'cf-tick l')}${tx(300, 250, 'le tally rouge du RCP s\'allume', 'cf-tick l')}
    ${tx(64, 236, 'le casque du cadreur :', 'cf-tick')}${tx(64, 250, 'XLR 5 broches, INTERCOM', 'cf-tick')}`),

  /** les retours de la grille jusqu'au viseur, et le prompteur */
  retours: () => {
    const srcs = [['programme', 'SDI-1', 'RET-1'], ['preview', 'SDI-2', 'RET-2'], ['caméra 1', 'VBS-1', 'RET-3'], ['habillage', 'VBS-2', 'RET-4']];
    const rows = srcs.map(([s, inp, ret], i) => { const y = 62 + i * 26; return `${tx(18, y + 4, s, 'cf-lbl l')}${arrow(86, y, 150, y)}${tx(118, y - 4, inp, 'cf-tick')}${tx(186, y + 4, ret, 'cf-tick')}`; }).join('');
    return svg(270, 'Schéma : la grille envoie quatre retours à la CCU (programme, preview, caméra 1, habillage), sur les entrées SDI-1, SDI-2, VBS-1 et VBS-2, rangées en RET-1 à RET-4 par la page RETURN SET ; la fibre les porte au viseur, où la touche RET 1 montre le retour 1, RET2 SEL choisit le retour 2, 3 ou 4 de la touche RET, et MIX VF les mélange à l\'image. Le prompteur entre à la CCU (PROMPTER IN) et ressort à la caméra par la prise PROMPTER/GENLOCK.', `
      ${head('Les retours et le prompteur', 'Ce que la grille envoie à la CCU revient dans le viseur, ou devant le présentateur.')}
      ${tx(18, 44, 'la grille', 'cf-bt')}${rows}
      <rect class="cf-box" x="150" y="46" width="72" height="104" rx="4"/>${tx(186, 158, 'CCU · RETURN SET', 'cf-tick')}
      <line class="c56-cab c56-cab-h" x1="222" y1="98" x2="262" y2="98"/>${tx(242, 90, 'fibre', 'cf-tick')}
      ${card(262, 46, 170, 'Dans le viseur', ['RET 1 : le retour 1, tant', 'qu\'on appuie', 'RET2 SEL 2 · 3 · 4 : celui de', 'la touche RET « retour 2 »', 'MIX VF : mélangé à l\'image'])}
      ${tx(18, 196, 'texte du prompteur', 'cf-lbl l')}${arrow(120, 192, 150, 192)}
      <rect class="cf-box" x="150" y="176" width="72" height="32" rx="4"/>${tx(186, 196, 'PROMPTER IN', 'cf-tick')}
      <line class="c56-cab c56-cab-h" x1="222" y1="192" x2="262" y2="192"/>
      ${card(262, 176, 170, 'À la caméra', ['PROMPTER/GENLOCK (BNC)', 'vers le moniteur du prompteur'])}
      ${tx(18, 238, 'Exemple de car : le choix des quatre retours se fait à la CCU (VBS : vidéo analogique).', 'cf-tick l')}
      ${tx(18, 254, 'PROMPTER/GENLOCK reçoit la synchro quand la caméra travaille sans CCU.', 'cf-tick l')}`);
  },

  /** ce que le viseur ajoute à l'image, et ce qui part vraiment au car */
  viseur: () => {
    const star = (cx, cy, R) => Array.from({ length: 12 }, (_, i) => { const a0 = i / 12 * Math.PI * 2, a1 = (i + 0.5) / 12 * Math.PI * 2; return `<path class="c56-star" d="M${cx} ${cy} L${(cx + R * Math.cos(a0)).toFixed(1)} ${(cy + R * Math.sin(a0)).toFixed(1)} A${R} ${R} 0 0 1 ${(cx + R * Math.cos(a1)).toFixed(1)} ${(cy + R * Math.sin(a1)).toFixed(1)} Z"/>`; }).join('');
    const knob = (x, t) => `<circle class="cf-knob" cx="${x}" cy="214" r="10"/><rect class="cf-accent" x="${x - 1.5}" y="205" width="3" height="7" rx="1"/>${tx(x, 238, t, 'cf-tick')}`;
    return svg(262, 'Schéma : le viseur 7" montre l\'image avec la zone de sécurité à 90 %, la croix du centre, des zébras sur le blanc, le peaking sur les contours nets de l\'étoile. BRIGHT, CONTRAST, PEAKING, zébras, marqueurs, VF OUT et retours ne changent que le viseur ; l\'extender numérique (D.EXTENDER ×2 ou ×4) agrandit aussi l\'image qui part au car.', `
      ${head('Ce que le viseur ajoute, et ce qui sort', 'Presque tout reste dans le viseur ; seul l\'extender change aussi la sortie.')}
      <rect class="cf-vf" x="12" y="44" width="224" height="126" rx="3"/>
      <rect class="c56-mire" x="96" y="66" width="56" height="56" rx="1"/>${star(124, 92, 22)}<circle class="c56-peak" cx="124" cy="92" r="22"/>
      <rect class="c56-zeb" x="96" y="114" width="56" height="8"/>
      <rect class="cf-dash" x="23" y="50" width="202" height="114" fill="none"/><path class="c56-cross" d="M118 107 h12 M124 101 v12"/>
      ${tx(20, 60, 'Z 20 mm', 'cf-mono')}${tx(20, 74, 'F5.6', 'cf-mono')}${tx(228, 60, 'D.EX ×2', 'cf-mono hi c56-r')}
      ${tx(124, 186, 'zone de sécurité 90 %, centre, zébras, peaking', 'cf-tick')}
      ${knob(48, 'BRIGHT')}${knob(124, 'CONTRAST')}${knob(200, 'PEAKING')}${tx(124, 254, '7 pouces, 1920 × 1080 (155,5 × 87,5 mm)', 'cf-tick')}
      ${card(250, 44, 182, 'Le viseur seul', ['BRIGHT, CONTRAST : l\'écran', 'PEAKING, VF DETAIL : contours', 'ZEBRA : 70 % ± 5, 100 %', 'VF MARKER : centre, zone', 'VF OUT : une seule voie', 'RET, MIX VF : les retours'], 'c56-own')}
      ${card(250, 164, 182, 'Aussi la sortie', ['D.EXTENDER ×2 ou ×4 :', 'le centre agrandi part au car'], 'c56-out-c')}
      ${tx(341, 234, 'La forme d\'onde se lit', 'cf-tick')}${tx(341, 248, 'sur la sortie, pas au viseur', 'cf-tick')}`);
  },

  /** l'équilibrage sur la tête fluide, et les commandes reportées sur les manches */
  cadreur: () => {
    const ax = 214, ay = 176;
    return svg(262, 'Schéma de côté : la caméra sur la plaque de la tête fluide, l\'axe d\'inclinaison, le centre de gravité à 2 cm en arrière et environ 25 cm au-dessus de l\'axe ; le couple vaut la masse fois g fois la distance. Le manche droit porte la commande de zoom sous le pouce, le manche gauche la commande de point.', `
      ${head('Le poste du cadreur', 'Équilibrer la caméra sur la tête ; le zoom et le point sous les mains.')}
      <rect class="c56-head" x="${ax - 34}" y="${ay - 4}" width="68" height="36" rx="6"/><rect class="c56-leg" x="${ax - 18}" y="${ay + 32}" width="36" height="16"/>
      <rect class="c56-plt" x="${ax - 86}" y="${ay - 14}" width="116" height="10"/>
      <rect class="cf-body" x="${ax - 92}" y="${ay - 98}" width="128" height="84" rx="5"/><rect class="cf-lens" x="${ax + 36}" y="${ay - 76}" width="104" height="40" rx="4"/>
      <rect class="cf-body" x="${ax - 132}" y="${ay - 160}" width="46" height="64" rx="4"/><rect class="cf-vf" x="${ax - 138}" y="${ay - 152}" width="6" height="48"/>
      <polygon class="c56-bar" points="${ax - 80},${ay - 8} ${ax - 196},${ay + 34} ${ax - 196},${ay + 44} ${ax - 80},${ay + 4}"/>
      <circle class="c56-axis" cx="${ax}" cy="${ay}" r="5"/>
      <line class="cf-dash" x1="${ax - 9}" y1="${ay - 104}" x2="${ax - 9}" y2="${ay + 14}"/><circle class="c56-cg" cx="${ax - 9}" cy="${ay - 104}" r="7"/><path class="c56-cgx" d="M${ax - 16} ${ay - 104} h14 M${ax - 9} ${ay - 111} v14"/>
      ${tx(ax + 6, ay - 112, 'centre de gravité', 'cf-lbl l')}${dim(ax - 9, ay + 58, ax, ay + 58)}${tx(ax + 8, ay + 62, 'd', 'cf-lbl l')}
      ${dim(ax + 60, ay - 104, ax + 60, ay)}${tx(ax + 66, ay - 48, 'h ≈ 25 cm', 'cf-lbl l')}
      ${tx(ax - 204, ay + 60, 'manche : zoom au pouce (droit),', 'cf-tick l')}${tx(ax - 204, ay + 72, 'point à la manivelle (gauche)', 'cf-tick l')}
      ${card(300, 196, 132, 'couple = m · g · d', ['7 kg à 2 cm : 1,4 N·m', 'h : le contrepoids'])}`);
  },
};
