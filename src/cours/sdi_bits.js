// @ts-check
import { el } from '../util.js';
import { figure, sv, canvas, choice, readout } from './kit.js';
import { bitsDe, embrouille, desembrouille, plusLongPalier, hex3 } from './sdi_mots.js';

// ----------------------------------------------------------------------------------
// Leçon « Du mot au bit » du chapitre SDI : comment les mots de 10 bits deviennent un signal sur le câble,
// et comment le récepteur s'y retrouve sans fil d'horloge. Sérialisation bit de poids faible d'abord,
// embrouillage auto-synchronisant x⁹ + x⁴ + 1, codage NRZI (x + 1), récupération d'horloge, recherche des
// séquences 3FF 000 000, signaux pathologiques (SMPTE RP 198, « checkfield »). Normes : ST 259, ST 292-1,
// ST 424 (même codage canal du SD au 3G), ST 2082-1 (12G). Calculs : cours/sdi_mots.js.
// ----------------------------------------------------------------------------------
const C = { data: '#ffd38a', scr: '#d08cff', lv: '#4cc3e6', ok: '#7fd1a0', bad: '#ff8a80', grid: '#2a3238', txt: '#aab4ba' };
/** les suites de mots de la manipulation (flux C et Y entrelacés, comme dans le câble) */
const SUITES = {
  sav: { nom: 'SAV (3FF 000 000 XYZ)', mots: [0x3ff, 0x3ff, 0x000, 0x000, 0x000, 0x000, 0x200, 0x200, 0x1a0, 0x1a7, 0x178, 0x1a7] },
  noir: { nom: 'Ligne noire (C 200, Y 040)', mots: [0x200, 0x040, 0x200, 0x040, 0x200, 0x040, 0x200, 0x040, 0x200, 0x040, 0x200, 0x040] },
  blanc: { nom: 'Blanc 100 % (C 200, Y 3AC)', mots: [0x200, 0x3ac, 0x200, 0x3ac, 0x200, 0x3ac, 0x200, 0x3ac, 0x200, 0x3ac, 0x200, 0x3ac] },
  check: { nom: 'Checkfield, test d\'égaliseur (C 300, Y 198)', mots: [0x300, 0x198, 0x300, 0x198, 0x300, 0x198, 0x300, 0x198, 0x300, 0x198, 0x300, 0x198] },
};

function figBits() {
  const f = figure(440, 196, 'La chaîne d\'un émetteur SDI puis du récepteur : sérialisation, embrouillage, NRZI, câble, égaliseur, horloge reconstituée, NRZI inverse, désembrouillage, recherche des repères');
  const box = (x, y, w, t, s, col = '#59646f') => { f.append(sv('rect', { x, y, width: w, height: 38, rx: 3, fill: '#1a2229', stroke: col }), sv('text', { x: x + w / 2, y: y + 16, textAnchor: 'middle', class: 'co-t' }, t), sv('text', { x: x + w / 2, y: y + 31, textAnchor: 'middle', class: 'co-s' }, s)); };
  const arrow = (x1, y1, x2, y2) => f.append(sv('line', { x1, y1, x2, y2, stroke: '#8a949c', strokeWidth: 1.4, 'marker-end': 'url(#co-arr-b)' }));
  f.append(sv('defs', {}, sv('marker', { id: 'co-arr-b', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: 'auto' }, sv('path', { d: 'M0 0 L8 4 L0 8 z', fill: '#8a949c' }))));
  f.append(sv('text', { x: 8, y: 14, class: 'co-t' }, 'Émetteur'), sv('text', { x: 8, y: 116, class: 'co-t' }, 'Récepteur'));
  box(8, 22, 92, 'Mots 10 bits', 'C et Y entrelacés', C.data); arrow(100, 41, 114, 41);
  box(114, 22, 92, 'Sérialisation', 'poids faible d\'abord'); arrow(206, 41, 220, 41);
  box(220, 22, 96, 'Embrouillage', 'x⁹ + x⁴ + 1', C.scr); arrow(316, 41, 330, 41);
  box(330, 22, 102, 'NRZI', '1 = le niveau bascule', C.lv);
  f.append(sv('path', { d: 'M381 60 L381 78 L58 78 L58 92', fill: 'none', stroke: C.lv, strokeWidth: 2 }), sv('text', { x: 220, y: 74, textAnchor: 'middle', class: 'co-s' }, 'coaxial 75 Ω · 800 mV crête à crête · pas de fil d\'horloge'));
  box(8, 124, 100, 'Égaliseur', 'rouvre l\'œil'); arrow(108, 143, 118, 143);
  box(118, 124, 104, 'Horloge', 'reconstituée (PLL)', C.ok); arrow(222, 143, 232, 143);
  box(232, 124, 96, 'NRZI inverse', 'puis désembrouille', C.scr); arrow(328, 143, 338, 143);
  box(338, 124, 94, 'Repères', '3FF 000 000', C.ok);
  f.append(sv('text', { x: 220, y: 186, textAnchor: 'middle', class: 'co-s' }, 'Le récepteur retrouve l\'horloge dans les transitions, puis le début des mots dans les repères.'));
  return f;
}

function demoBits(host) {
  let suite = 'sav', scr = 'oui', pol = 'normale';
  const W = 660, H = 214, cv = canvas(W, H, 'co-canvas co-smooth'), g = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
  const read = readout(['Bits envoyés', 'Plus long palier sur le câble', 'Ce que relit le récepteur']);
  const draw = () => {
    const mots = SUITES[suite].mots;
    const bits = bitsDe(mots);
    // l'embrouilleur tourne depuis longtemps : on part d'un état quelconque (celui d'une ligne déjà passée)
    const etat = { s: 0x15a, niveau: 0 };
    const sortie = scr === 'oui' ? embrouille(bits, etat) : (() => { let n = 0; const lv = bits.map((b) => (n ^= b)); return { bits, niveaux: lv }; })();
    const niveaux = pol === 'inversée' ? sortie.niveaux.map((l) => l ^ 1) : sortie.niveaux;
    const relus = scr === 'oui' ? desembrouille(niveaux, { s: 0, prec: pol === 'inversée' ? 1 : 0 }) : niveaux.map((l, i) => l ^ (i ? niveaux[i - 1] : (pol === 'inversée' ? 1 : 0)));
    const n = bits.length, X = (i) => 40 + i * (W - 50) / n;
    g.fillStyle = '#0b1013'; g.fillRect(0, 0, W, H);
    g.font = '11px Arial, sans-serif'; g.fillStyle = C.txt;
    g.fillText('mots', 4, 22); g.fillText('bits', 4, 52); g.fillText('envoyés', 4, 64); g.fillText('câble', 4, 120); g.fillText('relus', 4, 186);
    // les mots
    mots.forEach((m, k) => { const x0 = X(k * 10), x1 = X(k * 10 + 10); g.strokeStyle = C.grid; g.strokeRect(x0 + 0.5, 8.5, x1 - x0 - 1, 20); g.fillStyle = k % 2 ? C.data : '#8ab8ff'; g.font = '11px Menlo, Consolas, monospace'; g.fillText(`${k % 2 ? 'Y' : 'C'} ${hex3(m)}`, x0 + 4, 22); });
    // les bits (après embrouillage s'il est actif)
    const shown = sortie.bits;
    for (let i = 0; i < n; i++) { g.fillStyle = shown[i] ? (scr === 'oui' ? C.scr : C.data) : '#28323a'; g.fillRect(X(i) + 0.5, shown[i] ? 40 : 54, X(i + 1) - X(i) - 1, shown[i] ? 24 : 10); }
    // le signal sur le câble
    g.strokeStyle = C.lv; g.lineWidth = 2; g.beginPath();
    for (let i = 0; i < n; i++) { const y = niveaux[i] ? 96 : 136; if (i === 0) g.moveTo(X(0), y); else g.lineTo(X(i), y); g.lineTo(X(i + 1), y); }
    g.stroke(); g.lineWidth = 1;
    g.fillStyle = C.txt; g.fillText('+400 mV', 4, 99); g.fillText('−400 mV', 4, 139);
    // le plus long palier, entouré
    let best = 0, bi = 0, run = 0; for (let i = 0; i < n; i++) { run = i && niveaux[i] === niveaux[i - 1] ? run + 1 : 1; if (run > best) { best = run; bi = i - run + 1; } }
    g.strokeStyle = best > 20 ? C.bad : C.ok; g.setLineDash([4, 3]); g.strokeRect(X(bi), 88, X(bi + best) - X(bi), 56); g.setLineDash([]);
    // ce que relit le récepteur
    let faux = 0;
    for (let i = 0; i < n; i++) { const ok = relus[i] === bits[i]; if (!ok && i >= 9) faux++; g.fillStyle = i < 9 && scr === 'oui' ? '#3a4650' : ok ? C.ok : C.bad; g.fillRect(X(i) + 0.5, relus[i] ? 166 : 180, X(i + 1) - X(i) - 1, relus[i] ? 24 : 10); }
    read.set('Bits envoyés', `${n} bits (${mots.length} mots), bit de poids faible d'abord`);
    read.set('Plus long palier sur le câble', `${plusLongPalier(niveaux)} bits sans transition${best > 20 ? ' : le récepteur risque de perdre l\'horloge' : ''}`);
    read.set('Ce que relit le récepteur', faux ? `${faux} bits faux` : scr === 'oui' ? 'tout est juste après les 9 premiers bits (le temps que le désembrouilleur se cale)' : 'tout est juste : le NRZI ne dépend pas de la polarité');
  };
  host.append(el('div', { class: 'co-ctl' },
    choice('Suite de mots', Object.entries(SUITES).map(([k, s]) => [k, s.nom]), suite, (v) => { suite = v; draw(); }),
    choice('Embrouillage', [['oui', 'x⁹ + x⁴ + 1 actif'], ['non', 'coupé']], scr, (v) => { scr = v; draw(); }),
    choice('Polarité du câble', [['normale', 'normale'], ['inversée', 'inversée']], pol, (v) => { pol = v; draw(); })),
  cv, read.el);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const SDI_BITS = {
  id: 'sdi-bits', title: 'Du mot au bit : embrouillage, NRZI, horloge retrouvée', minutes: '8 min',
  essentials: [
    'Le SDI envoie chaque mot **bit de poids faible d\'abord**, sur un seul conducteur, **sans fil d\'horloge** : le récepteur reconstitue l\'horloge à partir des **transitions** du signal.',
    'Pour qu\'il y ait toujours des transitions, le flux est **embrouillé** (x⁹ + x⁴ + 1) puis codé en **NRZI** (un 1 fait basculer le niveau) ; la polarité du câble n\'a alors plus d\'importance.',
    'Le récepteur retrouve le **début des mots** grâce aux repères **3FF 000 000**, des valeurs interdites ailleurs ; une mire **checkfield** pousse égaliseurs et horloges à leurs limites.',
  ],
  figure: figBits,
  demoTitle: 'Choisis une suite de mots, coupe l\'embrouillage, inverse la polarité : regarde les paliers sans transition et ce que relit le récepteur.',
  demo: (host) => demoBits(host),
  body: `Un câble SDI n'a qu'un conducteur utile : les mots de l'image partent **en série**, bit après bit. Chaque mot de 10 bits sort **bit de poids faible d'abord** (b0, puis b1… jusqu'à b9). En 3G, cela fait 2,97 milliards de bits par seconde : un bit dure **337 ps**, l'**unité d'intervalle** (UI) de l'œil ; 673 ps en HD, 84 ps en 12G.

**Pas de fil d'horloge.** Le récepteur doit savoir quand lire chaque bit. Il fabrique sa propre horloge (une boucle à verrouillage de phase, la PLL d'un « CDR », clock and data recovery) et la recale à chaque **transition** du signal. Tant que les transitions sont nombreuses, l'horloge reste calée ; un long palier sans transition, et elle dérive.

**L'embrouillage.** Une image réelle contient de longues suites identiques : une ligne noire (Y 040, C 200) ne compte qu'un 1 par mot, un repère SAV aligne 20 bits à 1 puis 40 à 0. Avant d'envoyer, l'émetteur **embrouille** le flux par le polynôme **x⁹ + x⁴ + 1** : chaque bit envoyé est le bit de donnée combiné (ou exclusif) à deux bits envoyés plus tôt, 4 et 9 bits avant. Le résultat ressemble à du hasard, plein de transitions. Le désembrouillage est **auto-synchronisant** : le récepteur applique la même formule à ce qu'il reçoit et retrouve les données après 9 bits, sans rien connaître de l'émetteur.

**Le NRZI.** Le flux embrouillé est enfin codé en NRZI (x + 1) : un **1 fait basculer** le niveau, un **0 le garde**. L'information est dans les changements, pas dans le niveau : un câble ou un appareil qui **inverse la polarité** ne change rien aux données.

**Retrouver les mots.** Le récepteur reçoit des bits sans séparation. Il cherche la suite **3FF 000 000** (en HD et 3G : 20 bits à 1 puis 40 à 0, une fois désembrouillée) : ces valeurs (000 à 003, 3FC à 3FF) sont **interdites** à l'image et au son, elles ne peuvent signifier qu'un repère EAV ou SAV. Le récepteur aligne ses mots dessus, ligne après ligne.

**Les signaux pathologiques.** L'embrouillage n'est pas parfait : certains motifs, rencontrés au mauvais moment par l'embrouilleur, produisent encore de longs paliers (de l'ordre de 19 ou 20 bits identiques) ou un signal déséquilibré. La mire **checkfield** (SMPTE RP 198) en est faite exprès : sa moitié haute (C 300, Y 198) éprouve l'**égaliseur**, sa moitié basse (C 200, Y 110) la **PLL**. Une liaison qui passe la checkfield avec de la marge passe toutes les images.`,
  plus: `- Le même codage de canal sert du SD (270 Mb/s) au 3G ; le 12G-SDI le garde aussi (ST 2082-1) mais transporte plusieurs flux entrelacés.
- Un **reclocker** (dans une grille, un distributeur) recompose les bits avec une horloge propre : il efface la gigue accumulée et remet le budget de câble à zéro.
- La **gigue d'alignement** (les transitions qui bougent par rapport à l'horloge) ferme l'œil sur les côtés ; la gigue de timing, plus lente, est suivie par la PLL.
- Les analyseurs (PRISM) affichent l'œil, la gigue et comptent les erreurs CRC, et ils peuvent générer la checkfield pour tester une liaison avant le direct.`,
  car: { text: 'À la baie de mesure, le PRISM montre l\'œil de chaque liaison, mesure la gigue et compte les erreurs CRC. La mire du SPG sert de référence ; une liaison qui étincelle sur la checkfield est au bord de la falaise.', station: 'mesure' },
  terms: ['ui', 'gigue-alignement', 'oeil', 'reclocking', 'crc-edh', 'egaliseur'],
  competences: ['2.2', '2.13', '2.10'], article: 'liaisons',
  quiz: [
    { q: 'Pourquoi le flux SDI est-il embrouillé avant d\'être envoyé ?',
      choices: [['Pour le chiffrer : sans la clé, on ne peut pas lire l\'image.', 'Ce n\'est pas un chiffrement : le polynôme est public, et le récepteur désembrouille sans rien connaître de l\'émetteur.'],
        'Pour qu\'il y ait assez de transitions : le récepteur reconstitue l\'horloge à partir d\'elles.',
        ['Pour réduire le débit, comme une compression.', 'Le débit est le même avant et après : un bit embrouillé pour un bit de donnée.']],
      answer: 1, why: 'Il n\'y a pas de fil d\'horloge : la PLL du récepteur se recale sur les transitions. Une image noire ou un repère SAV en donneraient trop peu ; embrouillé, le flux en est plein.' },
    { q: 'Un convertisseur inverse la polarité du signal SDI. Que se passe-t-il ?',
      choices: [['Tous les bits sont inversés : l\'image devient un négatif.', 'Ce serait le cas avec un codage par niveau (NRZ). En NRZI, l\'information est dans les changements de niveau, pas dans le niveau.'],
        ['Le récepteur perd l\'horloge.', 'L\'inversion ne supprime aucune transition : l\'horloge reste calée.'],
        'Rien : en NRZI, un 1 est un changement de niveau, et une inversion ne change aucun changement.'],
      answer: 2, why: 'Le NRZI code un 1 par une bascule du niveau, un 0 par un niveau qui reste : inverser tous les niveaux garde les mêmes bascules, donc les mêmes données.' },
    { q: 'Comment le récepteur trouve-t-il où commence chaque mot de 10 bits ?',
      choices: ['Il cherche la suite 3FF 000 000, que l\'image et le son n\'ont pas le droit de contenir.',
        ['Il compte les bits depuis l\'allumage de l\'émetteur.', 'Le récepteur peut être branché à tout moment : il ne sait rien du début de l\'émission.'],
        ['Un fil à part lui envoie un top à chaque mot.', 'Le SDI n\'a qu\'un conducteur utile : ni horloge ni top de mot à part.']],
      answer: 0, why: 'Les valeurs 000 à 003 et 3FC à 3FF sont réservées aux repères EAV et SAV : quand la suite 3FF 000 000 passe, le récepteur sait qu\'un repère commence et aligne ses mots dessus, à chaque ligne.' },
    { q: 'En 3G-SDI, combien dure un bit (une unité d\'intervalle, UI) ?',
      choices: [['3,37 ns', 'C\'est dix fois trop : à 2,97 Gb/s, il passe près de 3 milliards de bits par seconde.'], '337 ps', ['33,7 ps', 'Ce serait un débit de près de 30 Gb/s.']],
      answer: 1, why: '1 / 2,97 Gb/s ≈ 337 ps. En HD (1,485 Gb/s), 673 ps ; en 12G (11,88 Gb/s), 84 ps : plus le débit monte, plus l\'œil est étroit.' },
    { q: 'Dans quel ordre partent les bits du mot 200h (10 0000 0000 en binaire) ?',
      choices: [['1, puis neuf 0', 'C\'est l\'ordre d\'écriture, bit de poids fort à gauche. Le SDI envoie le bit de poids faible d\'abord.'], 'Neuf 0, puis le 1', ['Un 1, un 0, un 1… alternés', 'L\'alternance vient de l\'embrouillage, après la mise en série ; le mot lui-même ne contient qu\'un 1.']],
      answer: 1, why: 'Bit de poids faible d\'abord : b0 à b8 valent 0 et partent les premiers, b9 vaut 1 et part le dernier. L\'embrouillage vient ensuite mélanger cette suite.' },
    { q: 'Avant le direct, on envoie la mire checkfield sur une longue liaison 3G. Pourquoi ?',
      choices: [['Pour régler la colorimétrie de la caméra.', 'La checkfield n\'est pas une mire de couleur : ses deux moitiés sont des motifs choisis pour le codage du câble.'],
        'Parce qu\'elle produit exprès les motifs les plus durs pour l\'égaliseur et la PLL : si elle passe avec de la marge, toute image passera.',
        ['Parce qu\'elle désactive l\'embrouillage pendant le test.', 'L\'embrouillage reste actif : c\'est justement avec lui que ses motifs donnent de longs paliers.']],
      answer: 1, why: 'Sa moitié haute (C 300, Y 198) charge l\'égaliseur, sa moitié basse (C 200, Y 110) la récupération d\'horloge : c\'est le pire cas d\'une image, prévu par SMPTE RP 198.' },
  ],
};
