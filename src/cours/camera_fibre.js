// @ts-check
import { el } from '../util.js';
import { figure, sv, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Leçon « La fibre de la caméra » du chapitre La caméra : ce que contient le câble hybride SMPTE (ST 311),
// comment la lumière reste dans le verre (réflexion totale), monomode contre multimode, et le bilan optique
// jusqu'au niveau lu à la CCU, avec ce qui le ruine : la saleté des connecteurs. Valeurs : fibre monomode
// 9/125 µm (UIT-T G.652, ≈ 0,35 dB/km à 1 310 nm), multimode 50/125 (≈ 3 dB/km à 850 nm), indices de
// l'ordre de 1,468 (cœur) et 1,463 (gaine) ; connecteurs propres ≈ 0,3 à 0,5 dB par paire ; plage
// d'exploitation et décrochage : ceux du simulateur (baie CCU), −5 à −15 dBm et ≈ −20 dBm. Ordres de grandeur.
// Vue 3D : vues3d/vues/camera_fibre.js.
// ----------------------------------------------------------------------------------
export const OPTIQUE = {
  emis: -2, // dBm émis par le laser de la tête (ordre de grandeur)
  sensib: -20, // dBm : en dessous, la liaison décroche
  fibre: { mono: 0.35, multi: 3 }, // dB/km
  paire: 0.4, // dB par paire de connecteurs propres
  sale: { propre: 0, poussiere: 3, sale: 8 }, // dB perdus par un connecteur sali (ordre de grandeur)
};
/** le bilan optique d'une liaison caméra : niveau reçu, marge, état */
export function bilanOptique(km, paires, salete = 'propre', type = 'mono') {
  const fibre = km * OPTIQUE.fibre[type], conn = paires * OPTIQUE.paire, sal = OPTIQUE.sale[salete];
  const recu = OPTIQUE.emis - fibre - conn - sal, marge = recu - OPTIQUE.sensib;
  return { fibre, conn, sal, recu, marge, etat: marge < 0 ? 'décroché' : recu < -15 ? 'limite' : 'bon' };
}

function figFibre() {
  const f = figure(440, 196, 'À gauche, la coupe du câble hybride SMPTE : deux fibres monomodes au centre, deux conducteurs d\'énergie, deux conducteurs basse tension, des renforts, la gaine. À droite, une fibre de près : la lumière reste dans le cœur de 9 µm par réflexion totale sur la gaine optique de 125 µm.');
  const cx = 82, cy = 102;
  f.append(sv('text', { x: 10, y: 16, class: 'co-t' }, 'Câble hybride ST 311 (≈ 9 mm)'));
  f.append(sv('circle', { cx, cy, r: 70, fill: '#1d2227', stroke: '#59646f' }), sv('circle', { cx, cy, r: 62, fill: '#3a3320', stroke: '#6a5a2a' }));
  for (const [dx, dy, col] of /** @type {[number, number, string][]} */ ([[-12, -6, '#3f7fe6'], [12, -6, '#e0e0e0'], [-30, 26, '#e0453a'], [30, 26, '#222'], [-34, -30, '#7fd1a0'], [34, -30, '#f2f2ee']])) f.append(sv('circle', { cx: cx + dx, cy: cy + dy, r: col === '#3f7fe6' || col === '#e0e0e0' ? 9 : 13, fill: col, stroke: '#0b1013' }));
  f.append(sv('text', { x: cx, y: cy - 22, textAnchor: 'middle', class: 'co-s' }, '2 fibres'), sv('text', { x: cx, y: cy + 52, textAnchor: 'middle', class: 'co-s' }, 'énergie (cuivre)'), sv('text', { x: cx, y: cy - 48, textAnchor: 'middle', class: 'co-s' }, 'basse tension'));
  const g = sv('g', { transform: 'translate(180 0)' });
  g.append(sv('text', { x: 10, y: 16, class: 'co-t' }, 'Une fibre monomode, de près'));
  g.append(sv('rect', { x: 10, y: 50, width: 240, height: 100, fill: '#2a3a44', stroke: '#59646f' }), sv('rect', { x: 10, y: 92, width: 240, height: 16, fill: '#8fd6ea', opacity: 0.6 }));
  g.append(sv('path', { d: 'M10 100 L250 100', stroke: '#ffd38a', strokeWidth: 3 }));
  g.append(sv('text', { x: 130, y: 44, textAnchor: 'middle', class: 'co-s' }, 'gaine optique : 125 µm (indice ≈ 1,463)'), sv('text', { x: 130, y: 126, textAnchor: 'middle', class: 'co-s' }, 'cœur : 9 µm (indice ≈ 1,468)'));
  g.append(sv('text', { x: 130, y: 172, textAnchor: 'middle', class: 'co-s' }, 'la lumière (1 310 nm, invisible) ne suit qu\'un chemin'));
  f.append(g);
  return f;
}
function demoFibre(host) {
  let km = 0.5, touret = 2, sal = 'propre', type = 'mono';
  const out = el('div', { class: 'co-hbars' }), read = readout(['Pertes', 'Niveau reçu à la CCU', 'Marge', 'État de la voie']);
  const draw = () => {
    const paires = 2 + touret; // la prise de la tête, celle de la CCU, une par raccord de touret
    const B = bilanOptique(km, paires, sal, type);
    const pct = (v) => Math.max(0, Math.min(100, (v + 25) / 25 * 100));
    out.replaceChildren(el('div', { class: 'co-hbar' }, el('span', {}, 'Niveau reçu'), el('i', {}, el('b', { style: { width: pct(B.recu) + '%', background: B.etat === 'bon' ? '#7fd1a0' : B.etat === 'limite' ? '#ffd38a' : '#ff6a5a' } })), el('small', {}, `${fmtNum(B.recu, 1)} dBm (de −25 à 0)`)));
    read.set('Pertes', `fibre ${fmtNum(B.fibre, 2)} dB (${fmtNum(km, 1)} km × ${OPTIQUE.fibre[type]} dB/km) · ${paires} paires de connecteurs ${fmtNum(B.conn, 1)} dB${B.sal ? ` · saleté ${B.sal} dB` : ''}`);
    read.set('Niveau reçu à la CCU', `${fmtNum(B.recu, 1)} dBm (émis ≈ ${OPTIQUE.emis} dBm)`);
    read.set('Marge', B.marge >= 0 ? `${fmtNum(B.marge, 1)} dB avant le décrochage (≈ ${OPTIQUE.sensib} dBm)` : `dépassée de ${fmtNum(-B.marge, 1)} dB`);
    read.set('État de la voie', B.etat === 'bon' ? 'OPT. normal : image, retours et commandes passent' : B.etat === 'limite' ? 'hors de la plage d\'exploitation : nettoyer, vérifier les raccords avant le direct' : 'OPTIQUE : PAS DE SIGNAL, la voie décroche');
  };
  host.append(el('div', { class: 'co-ctl' },
    slider('Longueur de fibre', 0.1, 10, km, 0.1, (v) => { km = v; draw(); }, (v) => fmtNum(v, 1) + ' km'),
    slider('Raccords de tourets', 0, 6, touret, 1, (v) => { touret = v; draw(); }, (v) => String(v)),
    choice('Un connecteur', [['propre', 'propre'], ['poussiere', 'une poussière'], ['sale', 'sale (doigt)']], sal, (v) => { sal = v; draw(); }),
    choice('Fibre', [['mono', 'monomode 9/125'], ['multi', 'multimode 50/125']], type, (v) => { type = v; draw(); })),
  out, read.el);
  draw();
}

/** @type {import('./index.js').Lesson} */
export const CAMERA_FIBRE = {
  id: 'camera-fibre', title: 'La fibre de la caméra : câble hybride, lumière, propreté', minutes: '8 min',
  camlab: ['fibre'],
  essentials: [
    'Le **câble hybride SMPTE** (ST 311) réunit **deux fibres monomodes** (une par sens) et du **cuivre** qui alimente la tête ; son connecteur (ST 304, type LEMO 3K.93C) branche tout d\'un geste.',
    'Dans la fibre, la lumière reste dans le **cœur** (9 µm) par **réflexion totale** sur la gaine optique (125 µm) : ≈ 0,35 dB/km seulement, la longueur est limitée par l\'**énergie** du cuivre, pas par l\'image.',
    'Ce qui ruine une liaison, c\'est la **saleté** : une poussière sur un cœur de 9 µm coûte plusieurs dB. On **inspecte et nettoie les deux bouts** avant de brancher, et on lit le **niveau optique** à la CCU.',
  ],
  figure: figFibre,
  demoTitle: 'Allongez la fibre, ajoutez des raccords de tourets, salissez un connecteur, passez en multimode : suivez le niveau reçu à la CCU.',
  demo: demoFibre,
  body: `Entre la tête de caméra et sa CCU, un seul câble : le **câble hybride SMPTE** (ST 311), de l'ordre de 9 mm de diamètre. Dedans :
- **deux fibres monomodes**, une par sens : vers le car l'image, le son, les données de la tête ; vers la tête le retour programme, les ordres, le tally, les commandes du RCP ;
- **deux conducteurs d'énergie** : la CCU télé-alimente la tête ;
- **deux conducteurs basse tension** (signalisation), des **renforts** (fibres d'aramide) qui encaissent la traction, et une gaine résistante.

Le connecteur **ST 304** (type LEMO 3K.93C) branche tout d'un geste ; les deux fibres y sont au centre, dans des férules de céramique alignées au micron.

**La lumière dans le verre.** Une fibre est faite d'un **cœur** de verre entouré d'une **gaine optique** d'un indice de réfraction un peu plus faible (de l'ordre de 1,468 contre 1,463). Un rayon qui rencontre la frontière sous un angle rasant est **entièrement réfléchi** (réflexion totale) : il reste prisonnier du cœur, même dans une fibre courbée. En **monomode**, le cœur ne fait que **9 µm** : un seul chemin possible, les impulsions ne s'étalent pas, et l'affaiblissement est d'environ **0,35 dB/km** à 1 310 nm. Une **multimode** (cœur de 50 µm) laisse passer plusieurs chemins de longueurs différentes, qui étalent les impulsions, et perd environ 3 dB/km : elle ne sert qu'aux courtes distances.

**La longueur.** La fibre porterait l'image sur des kilomètres ; c'est le **cuivre** qui limite : la tension chute dans le câble, et au-delà de l'ordre de 2 km (selon la caméra et la CCU), la tête ne reçoit plus assez de puissance. Plus loin, on passe en fibre monomode seule, avec une alimentation sur place.

**Le bilan optique.** Le laser de la tête émet de l'ordre de −2 dBm. Chaque élément retire des décibels : la fibre (presque rien), chaque **paire de connecteurs** (≈ 0,4 dB propre), chaque raccord de touret. La CCU affiche le **niveau reçu** : de l'ordre de −5 à −15 dBm en exploitation, décrochage vers −20 dBm.

**La propreté.** Une poussière de quelques microns sur un cœur de 9 µm, une trace de doigt, et l'on perd plusieurs dB, voire la liaison ; la lumière renvoyée peut aussi gêner l'émetteur. La règle : **inspecter, nettoyer, inspecter**, aux deux bouts, à chaque branchement (stylo de nettoyage, microscope de poche), et remettre les **bouchons** dès qu'on débranche. Jamais de regard dans un connecteur en service : la lumière est infrarouge, invisible.`,
  plus: `- Rayon de courbure : une fibre trop pliée laisse fuir la lumière (pertes par courbure) ; on suit le rayon minimal du câble (de l'ordre de 10 fois son diamètre en pose).
- Une voie bien plus basse que les autres à la baie CCU (−18 dBm quand les autres sont à −6) trahit presque toujours un connecteur sale ou abîmé, pas la longueur.
- Les tourets se raccordent par des **coupleurs** femelle-femelle : chaque raccord, c'est deux faces de plus à nettoyer.`,
  car: { text: 'À la baie CCU : le niveau optique et l\'alimentation de chaque voie ; dans l\'atelier de montage, la fibre se nettoie aux deux bouts avant d\'être branchée. La panne « fibre » de la CCU fait tomber l\'image d\'une caméra.', station: 'ccu' },
  terms: ['cable-hybride', 'fibre-monomode', 'niveau-optique', 'nettoyage-fibre'],
  competences: ['2.10', '3.9', '2.13'],
  quiz: [
    { q: 'Que contient le câble hybride SMPTE d\'une caméra de stade ?',
      choices: [['Une fibre pour l\'image et une pour le son', 'Les deux fibres vont chacune dans un sens : l\'image et le son montent ensemble vers le car.'], 'Deux fibres monomodes (une par sens) et du cuivre pour l\'énergie', ['Un coaxial SDI et une alimentation', 'Le coaxial ne porterait pas loin : le câble hybride est optique pour les signaux.']],
      answer: 1, why: 'Deux fibres monomodes, une par sens, deux conducteurs d\'énergie et deux basse tension, sous une gaine renforcée (ST 311).' },
    { q: 'Pourquoi la lumière ne sort-elle pas d\'une fibre courbée ?',
      choices: ['Par réflexion totale : la gaine optique a un indice plus faible que le cœur', ['Parce que la gaine extérieure est noire', 'La gaine extérieure protège ; c\'est la gaine optique, en verre, qui guide.'], ['Parce que la lumière va trop vite pour tourner', 'C\'est la différence d\'indice qui réfléchit la lumière vers le cœur.']],
      answer: 0, why: 'Un rayon rasant la frontière cœur-gaine est entièrement réfléchi. Seule une courbure trop serrée fait fuir la lumière.' },
    { q: 'Une caméra au bout de 3 km de câble hybride ne s\'allume pas. Pourquoi, alors que la fibre porterait la lumière bien plus loin ?',
      choices: [['La fibre perd trop à 3 km', '3 km de monomode coûtent environ 1 dB : rien.'], 'La chute de tension dans le cuivre : la CCU ne peut plus alimenter la tête', ['Le connecteur limite la longueur', 'Le connecteur coûte de l\'ordre de 0,4 dB, quelle que soit la longueur.']],
      answer: 1, why: 'Le cuivre a une résistance : au-delà de l\'ordre de 2 km, la tête ne reçoit plus assez de puissance. Plus loin : fibre monomode seule et alimentation locale.' },
    { q: 'À la baie CCU, la CAM 4 reçoit −18 dBm, les autres caméras −6 dBm, avec des longueurs voisines. Que faire avant le direct ?',
      choices: ['Inspecter et nettoyer les connecteurs de sa fibre, aux deux bouts et à chaque raccord', ['Rien : l\'image arrive encore', 'Il ne reste qu\'environ 2 dB avant le décrochage (−20 dBm).'], ['Changer le câble pour un plus court', '12 dB d\'écart ne viennent pas de la longueur (0,35 dB/km), mais presque toujours d\'une face sale ou abîmée.']],
      answer: 0, why: 'Une poussière coûte plusieurs dB. Inspecter, nettoyer, inspecter : c\'est la première chose à faire.' },
    { q: 'Pourquoi le monomode plutôt que le multimode pour une caméra de stade ?',
      choices: [['Parce qu\'il est moins cher', 'Le coût n\'est pas la raison : la portée et la bande passante le sont.'], 'Un seul chemin : pas d\'étalement des impulsions et ≈ 0,35 dB/km, contre ≈ 3 dB/km en multimode', ['Parce que le multimode n\'existe pas en 9 µm', 'C\'est vrai par définition, mais ce n\'est pas une raison.']],
      answer: 1, why: 'En multimode, plusieurs chemins de longueurs différentes étalent les impulsions ; le monomode porte loin, sans étalement.' },
    { q: 'Vous débranchez une fibre caméra en fin de match. Que faites-vous aussitôt ?',
      choices: [['Je regarde dans le connecteur pour vérifier la propreté', 'Jamais à l\'œil nu : la lumière est infrarouge et invisible, et il faut un microscope pour voir un cœur de 9 µm.'], 'Je remets les bouchons sur les deux connecteurs', ['Je souffle dans le connecteur', 'Le souffle dépose de l\'humidité et des particules ; on nettoie avec les outils prévus.']],
      answer: 1, why: 'Les bouchons protègent les faces de la poussière ; au prochain branchement, on inspectera et nettoiera quand même.' },
  ],
};
