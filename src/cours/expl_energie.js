// @ts-check
import { el } from '../util.js';
import { figure, sv, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Leçon « L'énergie du car : triphasé, P17, terre et secours » (chapitre L'exploitation). La
// manipulation range les baies du car sur les trois phases d'une arrivée P17 et calcule ce que
// porte chaque phase, le courant du neutre, la charge du groupe électrogène et l'autonomie de
// l'onduleur. Réseau français : 230 V entre phase et neutre, 400 V entre phases, 50 Hz (NF C 15-100) ;
// prises CEE (IEC 60309, « P17 ») 16, 32, 63 et 125 A ; régime TT : R × IΔn ≤ 50 V en local sec
// (25 V en milieu mouillé). Les puissances des baies sont des ordres de grandeur d'un car moyen,
// comme le « dizaines de kW » de la fiche du poste Énergie (content/stations.js).
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);
const box = (x, y, w, h, stroke = C.grey) => sv('rect', { x, y, width: w, height: h, rx: 3, fill: C.box, stroke, strokeWidth: 1.2 });
const arrow = (x1, y1, x2, y2, col = C.grey) => {
  const a = Math.atan2(y2 - y1, x2 - x1), s = 6, g = sv('g', {});
  g.append(sv('line', { x1, y1, x2, y2, stroke: col, strokeWidth: 1.4 }), sv('path', { d: `M${x2} ${y2} L${x2 - s * Math.cos(a - 0.45)} ${y2 - s * Math.sin(a - 0.45)} L${x2 - s * Math.cos(a + 0.45)} ${y2 - s * Math.sin(a + 0.45)} Z`, fill: col }));
  return g;
};

// ---------------- le modèle (pur) ----------------
/** tension simple (phase-neutre) et composée (entre phases), en volts */
export const V_PH = 230, U_TRI = 400;
/** courant d'une charge monophasée (A) : P en W, facteur de puissance cos φ */
export const courantMono = (P, cosphi = 1) => P / (V_PH * cosphi);
/** courant par phase d'une charge triphasée équilibrée (A) : P = √3 × U × I × cos φ */
export const courantTri = (P, cosphi = 1) => P / (Math.sqrt(3) * U_TRI * cosphi);
/** puissance apparente d'une arrivée triphasée (kVA) : √3 × 400 V × I */
export const kvaTri = (I) => Math.sqrt(3) * U_TRI * I / 1000;
/**
 * Courant du neutre : la somme des trois courants de phase décalés de 120° (charges de même cos φ).
 * Équilibré, il est nul ; une seule phase chargée, il vaut le courant de cette phase.
 */
export const neutre = (a, b, c) => Math.sqrt(Math.max(0, a * a + b * b + c * c - a * b - b * c - c * a));
/** autonomie d'un onduleur (minutes) : énergie utile des batteries (Wh) × rendement ÷ charge (W) */
export const autonomie = (wh, P, rend = 0.9) => (P > 0 ? wh * rend / P * 60 : Infinity);
/** résistance de terre maximale (Ω) en régime TT : R × IΔn ≤ UL (50 V en local sec, 25 V mouillé) */
export const terreMax = (idnMilliA, UL = 50) => UL / (idnMilliA / 1000);
/** calibres des prises CEE rouges (400 V, 3P + N + T) */
export const CALIBRES = [32, 63, 125];

/** les charges du car : puissance (W), cos φ, triphasée ou non, sur l'onduleur ou non (ordres de grandeur) */
export const CHARGES = [
  { id: 'ccu', nom: 'Baie CCU (10 voies, têtes télé-alimentées)', P: 2600, cos: 0.95, ups: true },
  { id: 'mel', nom: 'Mélangeur et son pupitre', P: 1200, cos: 0.95, ups: true },
  { id: 'evs', nom: 'Serveurs ralenti (3) et LSM', P: 2400, cos: 0.95, ups: true },
  { id: 'grille', nom: 'Grille, synchro, réseau', P: 1500, cos: 0.95, ups: true },
  { id: 'ecrans', nom: 'Mur d\'écrans et multiviews', P: 3000, cos: 0.95, ups: true },
  { id: 'son', nom: 'Console son, stagebox, intercom', P: 900, cos: 0.95, ups: true },
  { id: 'tx', nom: 'Transmission (codeurs)', P: 700, cos: 0.95, ups: true },
  { id: 'eclair', nom: 'Éclairage, prises de service', P: 1200, cos: 1, ups: false },
  { id: 'clim', nom: 'Climatisation (triphasée)', P: 12000, cos: 0.85, ups: false, tri: true },
];
/**
 * Le bilan d'une répartition : courants de chaque phase, neutre (part monophasée), puissances, verdicts.
 * @param {Record<string, number>} phase phase (0, 1, 2) de chaque charge monophasée
 * @param {{ calibre: number, kva: number, wh: number }} o calibre de la prise (A), groupe (kVA), batteries de l'onduleur (Wh)
 */
export function bilanEnergie(phase, o) {
  const I = [0, 0, 0], mono = [0, 0, 0];
  let P = 0, S = 0, Pups = 0;
  for (const c of CHARGES) {
    P += c.P; S += c.P / c.cos; if (c.ups) Pups += c.P;
    if (c.tri) { const i = courantTri(c.P, c.cos); for (let k = 0; k < 3; k++) I[k] += i; } else { const i = courantMono(c.P, c.cos); I[phase[c.id] ?? 0] += i; mono[phase[c.id] ?? 0] += i; }
  }
  const IN = neutre(mono[0], mono[1], mono[2]);
  const imax = Math.max(...I), imin = Math.min(...I);
  const desequilibre = imax > 0 ? (imax - imin) / imax : 0;
  return { I, IN, P, S, Pups, imax, desequilibre, charge: imax / o.calibre, groupe: S / 1000 / o.kva, auto: autonomie(o.wh, Pups) };
}

// ---------------- la manipulation ----------------
function demoEnergie(host) {
  // la répartition de départ : tout le gros matériel sur L1, comme un car câblé à la hâte
  /** @type {Record<string, number>} */
  const phase = { ccu: 0, mel: 0, evs: 0, grille: 1, ecrans: 0, son: 1, tx: 1, eclair: 2 };
  const o = { calibre: 63, kva: 60, wh: 3000 };
  const bars = el('div', { class: 'co-scroll' });
  const read = readout(['Courants de phase L1 · L2 · L3', 'Courant du neutre (part monophasée)', 'Puissance du car', 'Arrivée P17', 'Groupe électrogène', 'Onduleur']);
  const verdict = el('p', { class: 'co-verdict' });
  const rows = el('div', { class: 'co-ctl' });
  const draw = () => {
    const B = bilanEnergie(phase, o);
    // trois barres : le courant de chaque phase face au calibre de la prise
    const W = 640, f = figure(W, 132, `Courants des trois phases : L1 ${fmtNum(B.I[0], 1)} A, L2 ${fmtNum(B.I[1], 1)} A, L3 ${fmtNum(B.I[2], 1)} A, pour une prise de ${o.calibre} A`);
    const X = (a) => 70 + Math.min(1.25, a / o.calibre) * 440;
    ['L1', 'L2', 'L3'].forEach((n, k) => {
      const y = 12 + k * 30, v = B.I[k], col = v > o.calibre ? C.red : v > 0.8 * o.calibre ? C.amber : C.green;
      f.append(txt(30, y + 14, n, 'co-t'), sv('rect', { x: 70, y, width: 550, height: 20, fill: '#11161a', stroke: C.line }), sv('rect', { x: 70, y, width: X(v) - 70, height: 20, fill: col, opacity: 0.85 }), txt(X(v) + 6, y + 14, `${fmtNum(v, 1)} A`, 'co-s', 'start'));
    });
    f.append(sv('line', { x1: X(o.calibre), y1: 6, x2: X(o.calibre), y2: 104, stroke: C.red, strokeWidth: 2, strokeDasharray: '5 3' }), txt(X(o.calibre), 120, `calibre ${o.calibre} A`, 'co-s'));
    f.append(sv('line', { x1: X(0.8 * o.calibre), y1: 6, x2: X(0.8 * o.calibre), y2: 104, stroke: C.amber, strokeDasharray: '2 3' }), txt(X(0.8 * o.calibre), 120, '80 %', 'co-s'));
    bars.replaceChildren(f);
    read.set('Courants de phase L1 · L2 · L3', B.I.map((v) => `${fmtNum(v, 1)} A`).join(' · ') + ` (écart ${fmtNum(B.desequilibre * 100)} %)`);
    read.set('Courant du neutre (part monophasée)', `${fmtNum(B.IN, 1)} A${B.IN < 3 ? ' : phases équilibrées' : ''}`);
    read.set('Puissance du car', `${fmtNum(B.P / 1000, 1)} kW, ${fmtNum(B.S / 1000, 1)} kVA (dont ${fmtNum(B.Pups / 1000, 1)} kW sur l'onduleur)`);
    read.set('Arrivée P17', `${o.calibre} A tri = ${fmtNum(kvaTri(o.calibre), 1)} kVA ; phase la plus chargée à ${fmtNum(B.charge * 100)} %`);
    read.set('Groupe électrogène', `${o.kva} kVA, chargé à ${fmtNum(B.groupe * 100)} %`);
    read.set('Onduleur', `${fmtNum(o.wh / 1000, 1)} kWh de batteries : ${fmtNum(B.auto, 1)} min d'autonomie à ${fmtNum(B.Pups / 1000, 1)} kW`);
    const v = B.charge > 1 ? ['ko', `La phase la plus chargée dépasse le calibre de ${o.calibre} A : son disjoncteur va déclencher, et avec lui tout ce qui est branché sur elle. Répartissez les baies sur les trois phases.`]
      : B.groupe > 1 ? ['ko', 'Le groupe électrogène est trop petit pour le car : il cale ou sa protection coupe au premier appel de courant.']
        : B.groupe > 0.8 ? ['warn', `Le groupe tourne à ${fmtNum(B.groupe * 100)} % de sa puissance : trop peu de marge pour l'appel de courant de la climatisation. Prenez un groupe plus gros.`]
          : B.charge > 0.8 ? ['warn', 'Moins de 20 % de marge sur une phase : un appel de courant (la climatisation qui démarre, une baie rallumée) peut faire déclencher. Rééquilibrez.']
            : B.desequilibre > 0.3 ? ['warn', `Les phases sont déséquilibrées (${fmtNum(B.desequilibre * 100)} % d'écart) : le neutre porte ${fmtNum(B.IN, 1)} A et la tension d'un groupe se déséquilibre aussi. Déplacez une baie de la phase chargée vers la plus légère.`]
              : B.auto < 5 ? ['warn', 'L\'onduleur tient moins de 5 minutes : assez pour une bascule de source, pas pour attendre le dépanneur du groupe.']
                : ['ok', 'Phases équilibrées, de la marge sur la prise et sur le groupe, un onduleur qui couvre la bascule : le car peut prendre l\'antenne.'];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  for (const c of CHARGES.filter((x) => !x.tri)) rows.append(choice(`${c.nom} · ${fmtNum(c.P / 1000, 1)} kW`, [['0', 'L1'], ['1', 'L2'], ['2', 'L3']], String(phase[c.id]), (v) => { phase[c.id] = +v; draw(); }));
  host.append(
    el('p', { class: 'note' }, 'La climatisation (12 kW) est triphasée : elle charge les trois phases autant. Chaque baie monophasée se branche sur une phase.'),
    rows,
    el('div', { class: 'co-ctl' },
      choice('Prise P17 de l\'arrivée', CALIBRES.map((a) => [String(a), `${a} A`]), String(o.calibre), (v) => { o.calibre = +v; draw(); }),
      choice('Groupe électrogène', [['30', '30 kVA'], ['60', '60 kVA'], ['100', '100 kVA']], String(o.kva), (v) => { o.kva = +v; draw(); }),
      slider('Batteries de l\'onduleur', 500, 10000, o.wh, 500, (v) => { o.wh = v; draw(); }, (v) => `${fmtNum(v / 1000, 1)} kWh`)),
    bars, verdict, read.el);
  draw();
}

// ---------------- le schéma ----------------
function figEnergie() {
  const f = figure(720, 236, 'La chaîne de l\'énergie du car : le réseau du stade ou le groupe électrogène, l\'inverseur de source, la prise P17 rouge 400 V triphasée au pied de car, le tableau du car avec ses différentiels, l\'onduleur qui alimente les baies techniques ; la climatisation et l\'éclairage hors onduleur ; la terre posée d\'abord, par un piquet relié à la borne du car.');
  f.append(txt(10, 16, 'De la source aux baies : une seule arrivée, deux sources, un onduleur', 'co-t', 'start'));
  f.append(box(10, 34, 132, 40, C.cyan), txt(76, 52, 'Armoire TV du stade', 'co-s'), txt(76, 66, '400 V tri + N + T', 'co-m'));
  f.append(box(10, 92, 132, 40, C.amber), txt(76, 110, 'Groupe électrogène', 'co-s'), txt(76, 124, 'kVA, cos φ 0,8', 'co-m'));
  f.append(arrow(144, 54, 186, 78), arrow(144, 112, 186, 92));
  f.append(box(190, 64, 110, 40), txt(245, 82, 'Inverseur', 'co-s'), txt(245, 96, 'de source', 'co-s'));
  f.append(arrow(302, 84, 344, 84), box(348, 60, 116, 48, '#e0453a'), txt(406, 78, 'P17 rouge', 'co-t'), txt(406, 94, '32 · 63 · 125 A', 'co-m'));
  f.append(arrow(466, 84, 500, 84), box(504, 54, 110, 60), txt(559, 72, 'Tableau du car', 'co-s'), txt(559, 87, 'différentiels', 'co-m'), txt(559, 101, 'disjoncteurs', 'co-m'));
  f.append(arrow(616, 70, 640, 48), box(644, 30, 70, 36, C.green), txt(679, 52, 'Onduleur', 'co-s'));
  f.append(arrow(679, 68, 679, 92, C.green), box(630, 94, 84, 36, C.green), txt(672, 116, 'baies', 'co-s'));
  f.append(arrow(616, 100, 640, 156), box(570, 158, 144, 34), txt(642, 179, 'climatisation, éclairage', 'co-s'));
  // la terre
  f.append(sv('line', { x1: 406, y1: 110, x2: 406, y2: 188, stroke: C.green, strokeWidth: 1.6, strokeDasharray: '5 3' }));
  for (let k = 0; k < 3; k++) f.append(sv('line', { x1: 392 + k * 4, y1: 194 + k * 6, x2: 420 - k * 4, y2: 194 + k * 6, stroke: C.green, strokeWidth: 1.6 }));
  f.append(txt(430, 214, 'piquet de terre : posé et mesuré en premier', 'co-s', 'start'));
  // les trois phases
  f.append(txt(10, 160, 'Trois phases à 120° :', 'co-s', 'start'), txt(10, 176, '230 V phase-neutre, 400 V entre phases', 'co-m', 'start'), txt(10, 192, 'P = √3 × 400 V × I × cos φ', 'co-m', 'start'), txt(10, 208, '63 A tri ≈ 43,6 kVA ; 125 A ≈ 86,6 kVA', 'co-m', 'start'));
  f.append(txt(10, 228, 'Ordre : terre, contrôle des tensions et des phases, puis les baies une à une.', 'co-s', 'start'));
  return f;
}

/** @type {import('./index.js').Lesson} */
export const LESSON_ENERGIE = {
  id: 'expl-energie', title: 'L\'énergie du car : triphasé, P17, terre et secours', minutes: '9 min',
  essentials: [
    'Le car prend son énergie en **400 V triphasé** par une prise **P17** rouge (32, 63 ou 125 A) : P = √3 × 400 × I × cos φ, soit ≈ 43,6 kVA pour 63 A.',
    'On **équilibre les trois phases** : une phase trop chargée déclenche son disjoncteur, et le neutre porte la différence.',
    'La **terre d\'abord**, puis le contrôle des tensions ; un **onduleur** tient les baies pendant la bascule vers la source de secours.',
  ],
  figure: figEnergie,
  demoTitle: 'Le car est câblé à la hâte : presque tout est sur L1. Répartissez les baies sur les trois phases jusqu\'au voyant vert, puis essayez une prise de 32 A, un groupe de 30 kVA et des batteries plus petites.',
  demo: demoEnergie,
  body: `Un car régie consomme de l'ordre de **plusieurs dizaines de kilowatts** : les baies techniques (CCU, mélangeur, serveurs, grille, écrans) et surtout la **climatisation**, qui évacue toute cette chaleur d'un espace fermé. Cette énergie arrive par une seule prise, au **pied de car** : une prise industrielle **CEE** (IEC 60309), qu'on appelle **P17** sur les tournages. La rouge est en **400 V triphasé** : trois phases, le neutre et la terre (5 broches), en calibres 32, 63 ou 125 A ; la bleue, en 230 V monophasé (16 ou 32 A), sert aux petits appareils. La source est l'**armoire TV** du stade, ou un **groupe électrogène** dans le compound ; souvent les deux, avec un **inverseur de source**.

En France, chaque phase est à **230 V** du neutre et à **400 V** des deux autres, décalée de 120°. Une arrivée triphasée fournit P = √3 × U × I × cos φ : en 63 A, √3 × 400 × 63 ≈ **43,6 kVA** (puissance apparente) ; en 125 A, ≈ 86,6 kVA. Le **cos φ** (facteur de puissance) dit quelle part de cette puissance apparente fait vraiment du travail : proche de 1 pour l'éclairage, de 0,9 à 0,95 pour des alimentations d'électronique modernes, plus bas pour un moteur. Une baie monophasée de 2 600 W tire 2 600 ÷ (230 × 0,95) ≈ 11,9 A sur sa phase.

Chaque baie monophasée se branche sur **une** phase : c'est là que se joue l'**équilibrage**. Si tout le gros matériel est sur L1, L1 approche son calibre pendant que L3 est presque vide : au premier appel de courant (la climatisation qui démarre, un serveur rallumé), le disjoncteur de L1 déclenche et coupe tout ce qui y est branché, en plein direct. Le **neutre** ramène la différence entre les trois phases : nul quand elles sont égales, il porte autant que la phase quand une seule est chargée. Les alimentations à découpage de l'électronique ajoutent des harmoniques de rang 3 qui s'additionnent dans le neutre même quand les phases sont équilibrées : un neutre sous-dimensionné chauffe. Avec un groupe électrogène, un déséquilibre fort déséquilibre aussi ses tensions. On répartit donc les baies pour que les trois courants soient proches, avec une marge (on vise de l'ordre de 80 % du calibre au plus sur la phase la plus chargée), et l'on vérifie à la pince ampèremétrique une fois tout allumé.

La **sécurité** passe avant tout. La **terre** est posée et mesurée **en premier**, avant toute mise sous tension : un piquet enfoncé dans le sol, relié à la borne du car, toutes les masses reliées entre elles (liaison équipotentielle). En régime TT, le différentiel ne protège que si la résistance de terre est assez basse : R × IΔn ≤ 50 V (en local sec ; 25 V en milieu mouillé), soit 1 667 Ω au plus avec un différentiel de 30 mA, 166 Ω avec 300 mA. Les **différentiels 30 mA** protègent les personnes sur les prises. Viennent ensuite le contrôle des **tensions** (230 V et 400 V), de l'**ordre des phases** (le sens de rotation compte pour les moteurs de la climatisation) et de l'équilibre, puis la mise sous tension **baie par baie**, pour éviter l'appel de courant de tout le car d'un coup. Le raccordement sur l'armoire du stade est fait par une personne **habilitée** (NF C 18-510) : le technicien vidéo ne l'improvise pas.

Le **secours** fait partie du plan : deux sources (le réseau et un groupe, ou deux groupes) et un **onduleur** (UPS) qui alimente les baies techniques sans coupure pendant la bascule, de quelques secondes à quelques minutes. Son autonomie se calcule : énergie utile des batteries × rendement ÷ puissance des baies (3 kWh × 0,9 ÷ 12,3 kW ≈ 13 min). La climatisation et l'éclairage restent hors onduleur : ils ne doivent pas vider ses batteries.

- Ordres de grandeur : un car moyen, 20 à 40 kW dont la moitié en climatisation ; un groupe se dimensionne avec de la marge (cos φ de 0,8 de l'alternateur, appels de courant).
- Le poste Énergie du compound et le synoptique Énergie montrent la chaîne du car ; le pied de car porte la prise P17 63 A et la borne de terre.`,
  car: { text: 'Au compound, le poste Énergie : le groupe électrogène, le tableau de distribution, l\'onduleur et la terre. La visionneuse de matériel montre la prise P17 63 A triphasée du pied de car (« on raccorde la terre en premier ») et le synoptique Énergie du chef de car, la chaîne de la source aux baies.', station: 'energie' },
  terms: [],
  competences: ['4.2', '2.1', '3.12'],
  quiz: [
    { q: 'Quelle puissance apparente fournit une arrivée P17 de 63 A en 400 V triphasé ?', choices: ['≈ 43,6 kVA', ['≈ 14,5 kVA', 'C\'est 230 V × 63 A : une seule phase. En triphasé, on multiplie par √3 × 400 V.'], ['≈ 75,6 kVA', 'C\'est 3 × 400 V × 63 A : on compte trois fois la tension entre phases au lieu de √3 fois.']], answer: 0, why: 'S = √3 × U × I = 1,732 × 400 × 63 ≈ 43 600 VA. C\'est aussi 3 × 230 V × 63 A : trois phases à 230 V du neutre.' },
    { q: 'Le car est câblé : L1 à 58 A, L2 à 22 A, L3 à 15 A, sur une prise de 63 A. Que faire avant l\'antenne ?', choices: ['Déplacer une ou deux baies de L1 vers L3 et L2', ['Rien : aucune phase ne dépasse 63 A', 'L1 est à 92 % de son calibre : au premier appel de courant, son disjoncteur déclenche et coupe tout ce qui y est branché.'], ['Passer sur une prise de 125 A pour L1 seulement', 'Une prise triphasée a le même calibre sur ses trois phases ; c\'est la répartition qui est mauvaise, pas la prise.']], answer: 0, why: 'Le total (95 A sur trois phases) tient largement dans 63 A par phase s\'il est réparti : environ 32 A chacune. Équilibrer donne de la marge sur chaque phase et réduit le courant du neutre.' },
    { q: 'Les trois phases portent exactement le même courant. Que porte le neutre (charges de même cos φ, sans harmoniques) ?', choices: ['Rien : les trois courants décalés de 120° s\'annulent', ['Trois fois le courant d\'une phase', 'Les courants ne s\'additionnent pas en valeur : décalés de 120°, ils s\'annulent dans le neutre.'], ['Le courant d\'une phase', 'C\'est le cas d\'une seule phase chargée : le neutre ramène alors tout son courant.']], answer: 0, why: 'Trois courants égaux décalés de 120° ont une somme nulle. En pratique, les alimentations d\'électronique ajoutent des harmoniques de rang 3 qui, elles, s\'additionnent dans le neutre : on ne le sous-dimensionne jamais.' },
    { q: 'Le car arrive en retard. Dans quel ordre raccorder l\'énergie ?', choices: [['Mettre les baies sous tension, puis poser la terre pendant les essais', 'Sans terre, un défaut d\'isolement met les carrosseries sous tension et le différentiel ne protège personne.'], 'La terre, le contrôle des tensions et des phases, puis les baies une à une', ['Les baies toutes ensemble pour gagner du temps, puis la terre', 'Tout allumer d\'un coup crée un appel de courant qui peut faire déclencher ; et la terre vient avant toute mise sous tension.']], answer: 1, why: 'La terre d\'abord, toujours : c\'est elle qui rend la protection différentielle efficace. Puis on vérifie tensions, ordre des phases et équilibre ; on allume baie par baie pour éviter l\'appel de courant global.' },
    { q: 'En régime TT, le tableau du car a un différentiel de 300 mA en tête. Quelle résistance de terre au plus, en local sec ?', choices: ['≈ 166 Ω', ['≈ 1 667 Ω', 'C\'est la limite avec un différentiel de 30 mA : 50 V ÷ 0,03 A.'], ['≈ 15 Ω', 'C\'est 50 V ÷ 3,3 A : un calcul avec un courant dix fois trop grand.']], answer: 0, why: 'R × IΔn ≤ 50 V : R ≤ 50 ÷ 0,3 ≈ 166 Ω. Plus le différentiel est sensible, plus la terre peut être résistante ; on la mesure à la pose du piquet.' },
    { q: 'L\'onduleur a 3 kWh de batteries utiles (rendement 90 %) et alimente 9 kW de baies. Combien de temps tient-il ?', choices: ['Environ 18 min', ['Environ 20 min', 'C\'est 3 kWh ÷ 9 kW sans le rendement : une part de l\'énergie se perd dans la conversion.'], ['Environ 3 min', 'C\'est confondre kWh et kW : 3 kWh débitent 3 kW pendant une heure, 9 kW pendant un tiers d\'heure.']], answer: 0, why: '3 000 Wh × 0,9 ÷ 9 000 W = 0,3 h = 18 min. Assez pour basculer sur le groupe et le stabiliser ; c\'est pour cela que la climatisation, gourmande, reste hors onduleur.' },
  ],
};
