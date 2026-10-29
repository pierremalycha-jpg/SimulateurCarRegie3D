// @ts-check
import { registerExos, entre, pick, tirer, fr } from '../exo.js';
import { opticalAt, powerAt } from '../camera.js';
import { bilanOptique, OPTIQUE } from '../camera_fibre.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « La caméra » : le niveau optique lu à la CCU et la longueur que
// permet l'énergie du cuivre (modèles de la leçon La chaîne caméra, cours/camera.js : laser −4 dBm,
// 0,4 dB/km, trois paires de connecteurs à 0,5 dB, 240 V sur 66 Ω/km), l'ordre du montage et le couple
// d'une charge déséquilibrée (masses de l'atelier), le bilan optique de la leçon La fibre de la caméra
// (cours/camera_fibre.js : −2 dBm émis, 0,35 dB/km en monomode, 3 dB/km en multimode, 0,4 dB par paire).
// Ce sont des ordres de grandeur, ceux du simulateur.
// ----------------------------------------------------------------------------------
const G = 9.81;
/** un niveau négatif écrit avec le signe moins typographique */
const moins = (v, d = 1) => fr(v, d).replace('-', '−');
const kg = (k) => fr(k, Number.isInteger(k) ? 0 : 1);
const SALE = { propre: 'propres', poussiere: 'dont un avec une poussière', sale: 'dont un sali par une trace de doigt' };

// ce qui circule dans le câble hybride, et dans quel sens (leçon La chaîne caméra)
const SENS = [
  { s: 'l\'image de la caméra', v: 'ccu' },
  { s: 'le son des micros de la caméra', v: 'ccu' },
  { s: 'l\'appel du cadreur (CALL)', v: 'ccu' },
  { s: 'le tally (rouge à l\'antenne, vert prête)', v: 'tete' },
  { s: 'le retour vidéo du viseur (RET)', v: 'tete' },
  { s: 'la référence de synchro', v: 'tete' },
  { s: 'l\'énergie de la tête', v: 'cuivre' },
];
const VOIES = { ccu: 'Vers la CCU, par la fibre montante', tete: 'Vers la tête, par la fibre descendante', cuivre: 'Par les conducteurs de cuivre' };
const POURQUOI = {
  ccu: 'Ce qui naît sur le terrain (l\'image, le son des micros, la voix et l\'appel du cadreur) monte vers le car par la fibre montante.',
  tete: 'Ce que le car envoie au cadreur et à sa caméra (retours, ordres, tally, commandes, synchro) descend par l\'autre fibre.',
  cuivre: 'Une fibre porte de la lumière, pas de puissance utile : l\'énergie passe par les deux conducteurs de cuivre, sous une tension élevée envoyée par la CCU.',
};
// qui règle quoi, et ce que dit une alarme de la baie CCU
const SITUATIONS = [
  {
    type: 'choix', q: 'Pendant le match, la pelouse passe à l\'ombre et l\'image de la CAM 2 s\'assombrit. Qui rouvre l\'iris, et où ?',
    choices: ['L\'ingénieur vision, au joystick de son RCP', ['Le cadreur, à la bague de l\'objectif', 'Reliée à sa CCU, la caméra obéit au RCP pour toute la peinture de l\'image : le cadreur garde le cadre, le zoom et le point.'], ['Le réalisateur, au mélangeur', 'Le réalisateur choisit les images, il ne les règle pas.']], answer: 0,
    aides: ['L\'iris fait partie de la « peinture » de l\'image, pas du cadre.', 'Celui qui expose toutes les caméras au même niveau, l\'œil sur le waveform.'],
    solution: 'L\'**ingénieur vision**, au joystick du RCP : il expose toutes les caméras au même niveau, l\'œil sur le waveform.',
  },
  {
    type: 'choix', q: 'Le chef vision veut recopier les réglages de la CAM 1 sur la CAM 5, de même modèle. Avec quoi ?',
    choices: ['Le MSU, le pupitre maître qui atteint toutes les caméras', ['Le RCP de la CAM 5', 'Un RCP ne commande que sa caméra : il ne lit pas les réglages d\'une autre.'], ['Le menu du viseur de la CAM 5', 'Le viseur règle ce que voit le cadreur (luminosité, peaking, zebra), pas l\'image envoyée au car.']], answer: 0,
    aides: ['Il existe un pupitre qui atteint toutes les caméras et leurs fichiers de réglage.', 'Master Setup Unit.'],
    solution: 'Le **MSU** (Master Setup Unit) : il atteint toutes les caméras, leurs fichiers de réglage, et copie un réglage de l\'une à l\'autre.',
  },
  {
    type: 'choix', q: 'Le cadreur de la CAM 4 a du mal à faire son point sur un joueur au loin. Quel outil de son viseur l\'aide ?',
    choices: ['Le peaking, qui souligne les contours nets', ['Le zebra, qui hachure ce qui dépasse un niveau', 'Le zebra aide à juger l\'exposition, pas la netteté.'], ['Le retour RET', 'Le retour montre le programme (ou une autre source) dans le viseur ; il ne dit rien du point.']], answer: 0,
    aides: ['On cherche ce qui montre où l\'image est nette.', 'Un outil qui souligne les contours.'],
    solution: 'Le **peaking** : il souligne les contours nets, le point se fait en le faisant apparaître sur le joueur.',
  },
  {
    type: 'choix', q: 'À la baie CCU, la voie de la CAM 3, au bout d\'un câble hybride de 2,8 km, affiche ALIM. COUPÉE. Que se passe-t-il ?',
    choices: ['La chute de tension dans le cuivre empêche la CCU d\'alimenter la tête à cette distance', ['La lumière ne porte pas à 2,8 km', 'La fibre ne perd que 0,4 dB par kilomètre : à 2,8 km, la lumière arrive très bien.'], ['La référence de synchro manque', 'Ce serait l\'alarme RÉF. NON VERROUILLÉE.']], answer: 0,
    aides: ['L\'alarme parle de l\'alimentation : qu\'est-ce qui la transporte dans le câble ?', 'Au-delà d\'environ 2 km de câble hybride, ce n\'est plus la lumière qui limite.'],
    solution: 'C\'est l\'**énergie** : la résistance du cuivre fait chuter la tension, et au-delà d\'environ 2 km la tête ne reçoit plus assez de puissance. Plus loin : fibre monomode seule et alimentation locale.',
  },
  {
    type: 'choix', q: 'À la baie CCU, la voie de la CAM 2 passe en RÉF. NON VERROUILLÉE. Quelle conséquence pour le direct ?',
    choices: ['La caméra n\'est plus en phase avec les autres : le mélangeur ne peut plus couper proprement sur elle', ['La caméra n\'a plus d\'image', 'La référence ne donne que le rythme commun : l\'image monte toujours par la fibre.'], ['La tête n\'est plus alimentée', 'Ce serait l\'alarme ALIM. COUPÉE.']], answer: 0,
    aides: ['La référence vient du générateur de synchro : à quoi sert-elle ?', 'Le genlock fait sortir toutes les caméras au même instant.'],
    solution: 'Sans **genlock**, la caméra n\'est plus calée sur le générateur de synchro : elle n\'est plus en phase avec les autres, le mélangeur ne coupe plus proprement. On vérifie l\'arrivée de la référence à la CCU.',
  },
];

// le montage : deux suites de gestes où chacun exige le précédent (leçon Monter une caméra de stade)
const CHAINE_SUPPORT = [
  'Poser le pied sur son repère, sortir et bloquer les jambes',
  'Verrouiller l\'araignée',
  'Boulonner la tête fluide sur l\'embase',
  'Mettre la tête à niveau (bulle) et verrouiller panoramique et inclinaison',
  'Poser l\'adaptateur grand objectif et le verrouiller',
  'Glisser la tête de caméra par l\'arrière et la verrouiller',
  'Lever l\'objectif box à deux et le verrouiller',
  'Équilibrer : la plaque, puis le contrepoids et les frictions',
];
const CHAINE_LIAISON = [
  'Poser l\'adaptateur grand objectif et le verrouiller',
  'Glisser la tête de caméra par l\'arrière et la verrouiller',
  'Inspecter et nettoyer les connecteurs de fibre, caméra et prise murale',
  'Brancher la fibre, la raccorder à la prise murale, l\'attacher au pied',
  'Annoncer « CAM 1 câblée » à la vision, tester le tally et le CALL',
];
// masses de l'atelier, d'après les fiches constructeurs (leçon Monter une caméra de stade)
const CHARGE = [['plaque', 1.5], ['adaptateur', 15.5], ['caméra', 5], ['objectif box', 23.5], ['viseur', 3.3]];
const SUPPORT = [['pied', 15], ['tête fluide', 18]];
const MONTAGE = [
  {
    type: 'choix', q: 'L\'adaptateur grand objectif est posé, levier fermé, mais son témoin de verrouillage n\'est pas visible. Que fais-tu avant d\'y glisser la caméra ?',
    choices: ['Je vérifie le verrou : témoin visible et test de traction', ['Je glisse la caméra : elle ne pèse que 5 kg', 'Le poids ne change rien à la règle : rien ne se pose sur une pièce qui n\'est pas verrouillée, et l\'objectif de 23,5 kg viendra ensuite.'], ['Je continue et je vérifierai une fois tout monté', 'Une fois l\'objectif posé, un adaptateur mal verrouillé, c\'est la chute de 24 kg.']], answer: 0,
    aides: ['Une seule règle fixe l\'ordre du montage.', 'Rien ne se pose sur une pièce qui n\'est pas stable et verrouillée.'],
    solution: '**Vérifier le verrou** : levier fermé, témoin visible, test de traction. C\'est l\'adaptateur qui portera la caméra, puis l\'objectif.',
  },
  {
    type: 'choix', q: 'La caméra tient seule à l\'horizontale, mais dès que le cadreur l\'incline vers le bas, elle tend à continuer de plonger. Que règles-tu ?',
    choices: ['Le contrepoids de la tête', ['La plaque, en la reculant', 'À l\'horizontale, le centre de gravité est déjà au-dessus de l\'axe : reculer la plaque le ferait passer derrière.'], ['Rien : le fluide retient la caméra', 'Le fluide freine le mouvement, il ne retient pas la charge.']], answer: 0,
    aides: ['Le centre de gravité est au-dessus de l\'axe d\'inclinaison : que se passe-t-il quand on incline ?', 'Il faut un couple opposé, donné par des ressorts.'],
    solution: 'Le **contrepoids** : ses ressorts compensent le couple qui naît quand le centre de gravité, à environ 25 cm au-dessus de l\'axe, sort de la verticale. Les frictions viennent après.',
  },
  {
    type: 'choix', q: 'L\'objectif box (≈ 23,5 kg) attend dans son flight case. Comment le monte-t-on ?',
    choices: ['À deux, sur une tête verrouillée et un adaptateur déjà bloqué', ['Seul, en le tenant par le pare-soleil', 'Près de 24 kg en bout de bras : on le lève à deux, jamais par le pare-soleil.'], ['Avant l\'adaptateur, directement sur la plaque', 'L\'objectif se pose sur l\'adaptateur grand objectif, qui doit être verrouillé avant.']], answer: 0,
    aides: ['Pense à sa masse et à ce qui doit déjà le porter.', 'La tête et l\'adaptateur doivent être verrouillés.'],
    solution: '**À deux**, tête verrouillée, adaptateur déjà bloqué, puis on le verrouille et on branche son câble.',
  },
];

registerExos({
  'camera-systeme': {
    titre: 'Lire la voie caméra',
    consigne: 'À la baie CCU, avant le line-up : tu vérifies le niveau optique et la longueur de câble possible de chaque caméra, puis tu réponds aux questions de l\'équipe vision.',
    gen: (rnd) => {
      const L = entre(rnd, 4, 40) * 50, dirt = pick(rnd, [0, 0, 3]);
      const v = Math.round(opticalAt(L, dirt) * 10) / 10;
      const sansConn = Math.round((-4 - 0.4 * L / 1000 - dirt) * 10) / 10;
      const P = pick(rnd, [60, 80, 100, 110, 120]), Lmax = Math.round(powerAt(1, P).Lmax / 10) * 10;
      const S = pick(rnd, SENS);
      const choix = Object.keys(VOIES);
      return [
        {
          type: 'nombre', unite: 'dBm', answer: v, tol: 0.15,
          q: `La tête de la CAM ${entre(rnd, 1, 8)} émet **−4 dBm** ; la fibre perd 0,4 dB/km ; la liaison passe par **trois paires de connecteurs** à 0,5 dB chacune${dirt ? ', et l\'un d\'eux a une poussière qui coûte **3 dB**' : ''}. Le câble fait **${fr(L)} m**. Quel niveau la CCU lit-elle ?`,
          pieges: [{ v: sansConn, why: 'Les trois paires de connecteurs coûtent aussi : 3 × 0,5 = 1,5 dB.' }, ...(dirt ? [{ v: Math.round(opticalAt(L, 0) * 10) / 10, why: 'La poussière coûte 3 dB : elle compte dans le bilan.' }] : [])].filter((p) => Math.abs(p.v - v) > 0.2),
          aides: ['Pars du niveau émis et retire chaque perte, en décibels : la fibre, les connecteurs, la saleté.', `−4 − 0,4 × ${fr(L / 1000, 2)} km − 3 × 0,5${dirt ? ' − 3' : ''}.`],
          solution: `−4 − ${fr(0.4 * L / 1000, 2)} − 1,5${dirt ? ' − 3' : ''} = **${moins(v, 1)} dBm**, dans la plage d'exploitation (−5 à −15 dBm). La fibre ne coûte presque rien ; ${dirt ? 'la poussière, elle, coûte plus que tout le câble.' : 'ce sont les connecteurs qui pèsent le plus.'}`,
        },
        {
          type: 'nombre', unite: 'm', answer: Lmax, tol: Math.max(20, Lmax * 0.02),
          q: `La CCU envoie **240 V** sur le cuivre du câble hybride, qui fait **66 Ω par kilomètre** (aller et retour compris). La puissance maximale qu'on peut faire passer dans une résistance R vaut V² ÷ (4R). La tête demande **${P} W**${P === 110 ? ' (objectif box et grand viseur)' : P === 60 ? ' (objectif portable)' : ''}. Quelle longueur de câble au plus, en mètres ?`,
          pieges: [{ v: Math.round(powerAt(1, P).Lmax * 4 / 10) * 10, why: 'Il manque le 4 de la formule : la puissance maximale est V² ÷ (4R), pas V² ÷ R.' }],
          aides: ['Cherche d\'abord la résistance R qui donne juste la puissance demandée : P = V² ÷ (4R).', `R = 240² ÷ (4 × ${P}) ohms ; la longueur, c'est R ÷ 66 Ω par kilomètre.`],
          solution: `R = 57 600 ÷ ${4 * P} = ${fr(57600 / (4 * P), 1)} Ω, soit ${fr(57600 / (4 * P) / 66, 2)} km : **≈ ${fr(Lmax)} m**. C'est l'énergie, pas la lumière, qui fixe la longueur du câble hybride${P >= 100 ? ' : de l\'ordre de 2 km pour une caméra de stade' : ''}.`,
        },
        {
          type: 'choix', q: `Dans le câble hybride SMPTE, par où passe **${S.s}** ?`,
          choices: choix.map((k) => (k === S.v ? VOIES[k] : [VOIES[k], POURQUOI[S.v]])), answer: choix.indexOf(S.v),
          aides: ['Demande-toi où naît ce signal : sur le terrain, ou dans le car ?', 'Deux fibres, une par sens ; le cuivre ne porte que l\'énergie.'],
          solution: `**${VOIES[S.v]}**. ${POURQUOI[S.v]}`,
        },
        pick(rnd, SITUATIONS),
      ];
    },
  },
  'camera-montage': {
    titre: 'Monter et équilibrer la caméra',
    consigne: 'Sur la passerelle de la tribune, tu montes la CAM 1 : l\'ordre des gestes, les masses en jeu, le couple d\'une charge mal placée.',
    gen: (rnd) => {
      const debut = entre(rnd, 0, CHAINE_SUPPORT.length - 5);
      const chaine = pick(rnd, [CHAINE_SUPPORT.slice(debut, debut + 5), CHAINE_SUPPORT.slice(debut, debut + 5), CHAINE_LIAISON]);
      const m = entre(rnd, 40, 55), dcm = entre(rnd, 3, 10), c = m * G * dcm / 100;
      const pieces = tirer(rnd, CHARGE.slice(1), entre(rnd, 2, 4));
      const total = pick(rnd, [false, true]);
      const liste = [...(total ? SUPPORT : []), ['plaque', 1.5], ...pieces];
      const M = Math.round(liste.reduce((s, [, k]) => s + Number(k), 0) * 10) / 10;
      return [
        {
          type: 'ordre', items: chaine,
          q: 'Remets ces gestes du montage dans l\'ordre.',
          aides: ['Une seule règle : rien ne se pose sur une pièce qui n\'est pas stable et verrouillée.', chaine === CHAINE_LIAISON ? 'La fibre se nettoie avant d\'être branchée, et la caméra doit être en place pour la recevoir.' : 'On part du sol : chaque pièce attend que celle qui la porte soit posée et verrouillée ; l\'équilibrage vient quand toute la charge est en place.'],
          solution: chaine.map((s, k) => `${k + 1}. ${s}`).join('\n'),
        },
        {
          type: 'nombre', unite: 'N·m', answer: Math.round(c * 10) / 10, tol: Math.max(0.5, c * 0.02),
          q: `La charge sur la tête (**${m} kg**) a son centre de gravité **${dcm} cm en avant** de l'axe d'inclinaison. Quel couple fait piquer la caméra du nez quand on libère le verrou ? (g = 9,81 m/s²)`,
          pieges: [{ v: Math.round(m * dcm / 100 * 10) / 10, why: 'Il manque g : le couple se calcule avec le poids (m × g), en newtons, pas avec la masse.' }, { v: Math.round(m * G * dcm * 10) / 10, why: 'La distance doit être en mètres : ' + dcm + ' cm = ' + fr(dcm / 100, 2) + ' m.' }],
          aides: ['Un couple, c\'est une force multipliée par sa distance à l\'axe.', `Poids = ${m} × 9,81 N ; distance = ${fr(dcm / 100, 2)} m.`],
          solution: `${m} × 9,81 × ${fr(dcm / 100, 2)} = **${fr(c, 1)} N·m**. Le fluide freine ce mouvement sans le retenir : on recule la plaque de ${dcm} cm, jusqu'à ce que le centre de gravité passe au-dessus de l'axe.`,
        },
        {
          type: 'nombre', unite: 'kg', answer: M, tol: 0.05,
          q: `Quelle masse ${total ? 'pèse le montage entier, du sol au viseur' : 'repose sur la tête fluide'} ? Pièces : ${liste.map(([n, k]) => `${n} ${kg(Number(k))} kg`).join(', ')}.`,
          aides: ['Additionne toutes les pièces de la liste, sans en oublier.', 'Fais la somme en gardant les dixièmes.'],
          solution: `${liste.map(([, k]) => kg(Number(k))).join(' + ')} = **${fr(M, 1)} kg**. ${total ? 'Plus de 80 kg une fois tout monté : c\'est pourquoi le pied se pose sur son repère et l\'araignée se verrouille.' : 'Près de 50 kg sur la tête avec toute la charge : jamais sur une tête libre.'}`,
        },
        pick(rnd, MONTAGE),
      ];
    },
  },
  'camera-fibre': {
    titre: 'Le bilan optique d\'une liaison',
    consigne: 'Une caméra est raccordée par plusieurs tourets : tu calcules ce que la CCU va recevoir, la marge qui reste, et ce qu\'un mauvais choix de fibre coûterait.',
    gen: (rnd) => {
      const km = entre(rnd, 3, 20) / 10, paires = entre(rnd, 2, 5), sal = pick(rnd, ['propre', 'poussiere', 'sale']);
      const B = bilanOptique(km, paires, sal), v = Math.round(B.recu * 10) / 10;
      const raccords = Math.floor((B.recu + 15) / OPTIQUE.paire + 1e-9);
      const km2 = entre(rnd, 2, 20) / 10, de = Math.round(km2 * (OPTIQUE.fibre.multi - OPTIQUE.fibre.mono) * 100) / 100;
      const km3 = entre(rnd, 1, 6), p3 = entre(rnd, 2, 4), s3 = pick(rnd, ['propre', 'poussiere', 'sale']);
      const B3 = bilanOptique(km3, p3, s3, 'multi'), ETATS = ['bon', 'limite', 'décroché'];
      return [
        {
          type: 'nombre', unite: 'dBm', answer: v, tol: 0.15,
          q: `Le laser de la tête émet **−2 dBm**. La liaison : **${fr(km, 1)} km** de fibre monomode (0,35 dB/km), **${paires} paires de connecteurs** (0,4 dB chacune), ${SALE[sal]}${sal === 'propre' ? '' : sal === 'poussiere' ? ' (3 dB)' : ' (8 dB)'}. Quel niveau la CCU lit-elle ?`,
          pieges: [{ v: Math.round((B.recu + B.sal) * 10) / 10, why: 'La saleté compte dans le bilan, et c\'est souvent elle qui coûte le plus.' }, { v: Math.round((B.recu + B.conn) * 10) / 10, why: 'Chaque paire de connecteurs coûte 0,4 dB, même propre.' }].filter((p) => Math.abs(p.v - v) > 0.2),
          aides: ['Pars du niveau émis et retire chaque perte : la fibre, les paires de connecteurs, la saleté.', `−2 − ${fr(km, 1)} × 0,35 − ${paires} × 0,4${B.sal ? ' − ' + B.sal : ''}.`],
          solution: `−2 − ${fr(B.fibre, 2)} − ${fr(B.conn, 1)}${B.sal ? ' − ' + B.sal : ''} = **${moins(v, 1)} dBm** : ${B.etat === 'bon' ? 'dans la plage d\'exploitation (−5 à −15 dBm)' : B.etat === 'limite' ? 'sous −15 dBm, près du décrochage' : 'sous −20 dBm, la liaison décroche'}. ${sal !== 'propre' ? 'Le connecteur sale coûte plus que toute la fibre : on inspecte, on nettoie, on inspecte.' : 'La fibre ne coûte presque rien : ce sont les connecteurs qui pèsent.'}`,
        },
        {
          type: 'nombre', answer: raccords,
          q: `Sur cette même liaison (la CCU lit ${moins(B.recu, 1)} dBm), combien de raccords de touret propres (0,4 dB chacun) peut-on encore ajouter sans passer sous **−15 dBm**, le bas de la plage d'exploitation ?`,
          aides: ['Calcule d\'abord la marge entre le niveau lu et −15 dBm.', `(${moins(B.recu, 1)} − (−15)) ÷ 0,4, arrondi à l'entier inférieur.`],
          solution: `Marge : ${fr(B.recu + 15, 1)} dB ; ${fr(B.recu + 15, 1)} ÷ 0,4 = ${fr((B.recu + 15) / 0.4, 1)} : **${raccords} raccords** au plus. ${raccords > 10 ? 'Des raccords propres coûtent peu ; une seule face sale en coûte bien plus.' : 'La marge est mince : la moindre poussière la mange.'}`,
        },
        {
          type: 'nombre', unite: 'dB', answer: de, tol: 0.05,
          q: `Un technicien propose une fibre multimode (≈ 3 dB/km) au lieu de la monomode (≈ 0,35 dB/km) pour **${fr(km2, 1)} km** de liaison. Combien de décibels de plus perdrait-on ?`,
          pieges: [{ v: Math.round(km2 * OPTIQUE.fibre.multi * 100) / 100, why: 'C\'est la perte totale de la multimode : la question demande ce qu\'elle perd de plus que la monomode.' }],
          aides: ['Calcule la perte de chaque fibre sur la longueur, puis la différence.', `${fr(km2, 1)} × (3 − 0,35).`],
          solution: `${fr(km2, 1)} × 2,65 = **${fr(de, 2)} dB** de plus, sans compter l'étalement des impulsions : la multimode ne sert qu'aux courtes distances.`,
        },
        {
          type: 'choix', q: `Une liaison de **${km3} km** en fibre **multimode** (3 dB/km), ${p3} paires de connecteurs (0,4 dB), ${SALE[s3]}${s3 === 'propre' ? '' : s3 === 'poussiere' ? ' (3 dB)' : ' (8 dB)'}, laser à −2 dBm. Dans quel état est-elle ?`,
          choices: [['Bonne : dans la plage d\'exploitation (−5 à −15 dBm)', `Le niveau reçu est de ${moins(B3.recu, 1)} dBm.`], ['Limite : sous −15 dBm, près du décrochage', `Le niveau reçu est de ${moins(B3.recu, 1)} dBm.`], ['Décrochée : sous −20 dBm', `Le niveau reçu est de ${moins(B3.recu, 1)} dBm.`]], answer: ETATS.indexOf(B3.etat),
          aides: ['Fais le bilan : niveau émis moins toutes les pertes.', 'Compare à −15 dBm (bas de la plage) et à −20 dBm (décrochage).'],
          solution: `−2 − ${fr(B3.fibre, 1)} − ${fr(B3.conn, 1)}${B3.sal ? ' − ' + B3.sal : ''} = **${moins(B3.recu, 1)} dBm** : ${B3.etat === 'bon' ? 'bonne' : B3.etat === 'limite' ? 'limite' : 'décrochée'}. En multimode, c'est la fibre elle-même qui coûte : 3 dB par kilomètre.`,
        },
      ];
    },
  },
});
