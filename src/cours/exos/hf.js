// @ts-check
import { registerExos, entre, pick, tirer, fr } from '../exo.js';
import { fspl, ANT, antGain } from '../hf.js';
import { cofdmBitrate } from '../../data/rf.js';
import { lambda, fresnel1, renflement, gainParabole, perteDiffraction } from '../hf_fresnel.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « La HF » : un plan de fréquences (intermodulation, canaux TNT),
// des longueurs d'onde et des antennes à viser, un bilan de liaison complet jusqu'à la marge, un
// intervalle de garde et un débit COFDM, avec des valeurs tirées à chaque essai. Les formules et les
// chiffres sont ceux des leçons (cours/hf.js, data/rf.js) : FSPL = 20 log d + 20 log f − 27,55,
// λ = 300 / f, 1 µs d'écho par 300 m de détour, débit DVB-T de 4,98 Mb/s en QPSK 1/2 garde 1/4 sur 8 MHz.
// ----------------------------------------------------------------------------------
/** canal TNT (8 MHz) d'une fréquence UHF : le canal 21 commence à 470 MHz */
const canalTnt = (f) => 21 + Math.floor((f - 470) / 8);
const mhz = (f) => fr(f, 3);
/** antennes de réception du bilan (gains en dBi de la leçon) */
const RX = [['un fouet omni', 2], ['un patch', 9], ['une log-périodique', 10], ['un panneau secteur', 13]];
/** obstacles sur le trajet (ordres de grandeur de la leçon) */
const OBSTACLES = [['en ligne de vue', 0], ['derrière une tribune en béton', 16]];
/** sensibilités de la leçon, marge d'implémentation comprise (ordres de grandeur) */
const SENSIB = [['QPSK 1/2', -96], ['16-QAM 3/4', -87], ['64-QAM 3/4', -82]];
const dbm = (v) => `${v < 0 ? '−' : ''}${fr(Math.abs(v), Number.isInteger(v) ? 0 : 1)} dBm`;
const MODCOD = { QPSK: 'QPSK', '16QAM': '16-QAM', '64QAM': '64-QAM' };
const TU = { '2K': 224, '8K': 896 };
const GARDES = { '1/4': 0.25, '1/8': 0.125, '1/16': 1 / 16, '1/32': 1 / 32 };

// ---------------- la liaison point à point (cours/hf_fresnel.js) ----------------
const FRESNEL_SITU = [
  {
    type: 'choix', q: 'Les deux paraboles se voient, mais la cime d\'une rangée d\'arbres affleure la ligne de vue. Que faites-vous ?',
    choices: ['Monter les mâts pour dégager au moins 60 % du premier rayon de Fresnel', ['Rien : on voit l\'autre antenne', 'L\'onde occupe tout l\'ellipsoïde de Fresnel : un obstacle au ras de la ligne de vue coûte déjà environ 6 dB.'], ['Monter la puissance de l\'émetteur au maximum', 'La puissance compense un temps la perte, mais l\'obstacle reste : le moindre changement (feuilles mouillées, vent) fait varier le niveau.']], answer: 0,
    aides: ['La ligne de vue ne suffit pas : l\'onde occupe un volume.', 'La règle des 60 %.'],
    solution: '**Monter les mâts** (ou déplacer un point) jusqu\'à dégager 60 % du premier rayon : la perte de diffraction devient nulle.',
  },
  {
    type: 'choix', q: 'Pourquoi aligner une parabole de 1,2 m est-il plus délicat qu\'une de 0,3 m, à la même fréquence ?',
    choices: ['Son faisceau est quatre fois plus étroit (≈ 70 λ ÷ D degrés)', ['Parce qu\'elle est plus lourde', 'Le poids compte pour le mât, mais c\'est la largeur du faisceau qui rend la visée délicate.'], ['Parce qu\'elle émet plus de puissance', 'Une antenne ne crée pas de puissance : elle la concentre, dans un faisceau d\'autant plus étroit qu\'elle est grande.']], answer: 0,
    aides: ['Le gain d\'une antenne est une concentration de l\'énergie.', 'Plus le diamètre est grand par rapport à la longueur d\'onde, plus le faisceau est fin.'],
    solution: 'Le faisceau à −3 dB vaut ≈ 70 λ ÷ D degrés : **quatre fois plus étroit** pour un diamètre quatre fois plus grand. On aligne au niveau reçu, au degré près.',
  },
];

registerExos({
  'hf-frequences': {
    titre: 'Poser un plan de fréquences sans brouillage',
    consigne: 'Au poste HF, vous préparez le plan des micros en UHF et le canal de la caméra HF : où tombent les produits d\'intermodulation, quel canal TNT est touché, quelle bande pour quel appareil.',
    gen: (rnd) => {
      // deux micros voisins en UHF, au pas de 25 kHz
      const f1 = Math.round((520 + entre(rnd, 0, 6000) * 0.025) * 1000) / 1000, ecart = entre(rnd, 4, 15) / 10;
      const f2 = Math.round((f1 + ecart) * 1000) / 1000;
      const lequel = pick(rnd, ['2f1 − f2', '2f2 − f1']);
      const im = Math.round((lequel === '2f1 − f2' ? 2 * f1 - f2 : 2 * f2 - f1) * 1000) / 1000;
      const autre = Math.round((lequel === '2f1 − f2' ? 2 * f2 - f1 : 2 * f1 - f2) * 1000) / 1000;
      const f = Math.round((470.5 + entre(rnd, 0, 220) + entre(rnd, 0, 3) * 0.25) * 1000) / 1000, ch = canalTnt(f);
      return [
        {
          type: 'nombre', unite: 'MHz', answer: im, tol: 0.001,
          q: `Deux micros HF émettent à **f1 = ${mhz(f1)} MHz** et **f2 = ${mhz(f2)} MHz**. À quelle fréquence tombe leur produit d'intermodulation d'ordre 3 **${lequel}** ?`,
          pieges: [
            { v: autre, why: `C'est l'autre produit d'ordre 3 (${lequel === '2f1 − f2' ? '2f2 − f1' : '2f1 − f2'}) : relisez lequel est demandé.` },
            { v: Math.round((f1 + f2) * 1000) / 1000, why: 'La somme des deux fréquences tombe hors de la bande des micros ; le produit gênant d\'ordre 3 est 2f1 − f2 ou 2f2 − f1.' },
          ],
          aides: ['Un produit d\'ordre 3 de deux micros se calcule avec deux fois l\'une des fréquences moins l\'autre.', `Doublez ${lequel.startsWith('2f1') ? 'f1' : 'f2'}, puis retirez ${lequel.startsWith('2f1') ? 'f2' : 'f1'} ; le résultat tombe à ${fr(ecart, 1)} MHz de ${lequel.startsWith('2f1') ? 'f1' : 'f2'}, de l'autre côté.`],
          solution: `${lequel} = **${mhz(im)} MHz**. Les deux produits encadrent la paire, à ${fr(ecart, 1)} MHz de chaque côté : aucun troisième micro ne doit être posé à moins de 300 kHz de ces fréquences.`,
        },
        {
          type: 'nombre', answer: ch,
          q: `La TNT découpe l'UHF en canaux de 8 MHz, le **canal 21** commençant à 470 MHz. Dans quel canal tombe un micro réglé sur **${mhz(f)} MHz** ?`,
          aides: ['Comptez combien de canaux entiers de 8 MHz séparent 470 MHz de la fréquence du micro.', `(${mhz(f)} − 470) ÷ 8, partie entière, puis ajoutez 21.`],
          solution: `${mhz(f)} − 470 = ${fr(f - 470, 3)} MHz, soit ${Math.floor((f - 470) / 8)} canaux entiers : c'est le **canal ${ch}** (${470 + (ch - 21) * 8} à ${478 + (ch - 21) * 8} MHz). S'il est occupé par un multiplex local, le micro y est brouillé.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Le réalisateur veut une caméra HF de plus sur la pelouse. Dans quelle bande l\'émettre un jour de match ?',
            choices: ['Dans la bande 2 GHz, sur un canal attribué par la coordination', ['Dans la bande Wi-Fi à 2,4 GHz, libre d\'autorisation', 'Le 2,4 GHz est saturé par les téléphones des spectateurs : jamais de liaison vidéo en 2,4 GHz un jour de match.'], ['En UHF, entre 470 et 694 MHz', 'L\'UHF est celle des micros HF, partagée avec la TNT ; une vidéo COFDM de 8 MHz y prendrait la place de plusieurs dizaines de micros.']], answer: 0,
            aides: ['Les caméras HF n\'émettent pas dans la même bande que les micros.', 'Retenez la règle du car sur le Wi-Fi, puis cherchez la bande partagée et coordonnée des caméras.'],
            solution: 'La **bande 2 GHz** (de l\'ordre de 2,2 à 2,5 GHz, partagée), sur un canal que le coordinateur de fréquences a attribué à la production ; 5 et 7 GHz sont les autres bandes vidéo.',
          },
          {
            type: 'choix', q: 'Un assistant son sort d\'un placard des micros HF réglés vers 750 MHz. Que lui dites-vous ?',
            choices: ['Ils sont inutilisables : au-dessus de 694 MHz, la bande est donnée à la téléphonie mobile', ['Ils conviennent s\'ils sont loin des autres micros', 'L\'écart entre micros n\'y change rien : la bande des 700 MHz n\'est plus ouverte aux micros.'], ['Il suffit de baisser leur puissance', 'Une émission à faible puissance reste une émission dans une bande qui n\'est plus autorisée.']], answer: 0,
            aides: ['Les micros HF travaillent en UHF jusqu\'à une limite haute précise.', 'Pensez au second dividende numérique (2019 en France).'],
            solution: 'Ils sont **interdits** : depuis le second dividende numérique, la bande au-dessus de 694 MHz est à la téléphonie mobile. Les micros restent entre 470 et 694 MHz, plus quelques fenêtres étroites.',
          },
          {
            type: 'choix', q: 'Pour un grand match, qui vous donne les fréquences que la production peut utiliser ?',
            choices: ['L\'autorisation de l\'Arcep, demandée par l\'ANFR, et le coordinateur de fréquences de l\'organisateur sur place', ['Personne : on choisit un canal libre à l\'analyseur de spectre', 'L\'analyseur montre qui émet, il ne donne aucun droit : les fréquences PMSE se demandent avant l\'événement.'], ['Le fabricant des micros, par le réglage d\'usine', 'Le réglage d\'usine ne tient compte ni de la TNT locale, ni des autres diffuseurs, ni des autorisations.']], answer: 0,
            aides: ['Les fréquences ne se choisissent pas : elles se demandent.', 'Une autorisation temporaire nationale, puis une attribution canal par canal sur le site.'],
            solution: 'Une **autorisation temporaire** (Arcep, sur dossier déposé auprès de l\'ANFR), puis le **coordinateur de fréquences** de l\'organisateur qui attribue les canaux à chaque diffuseur et vérifie à l\'analyseur.',
          },
          {
            type: 'choix', q: 'Un collègue a réglé huit micros tous les 500 kHz, « pour faire simple ». Que risque-t-il ?',
            choices: ['Le pire plan : 2f1 − f2 tombe exactement sur le micro d\'à côté', ['Rien : 500 kHz dépasse l\'écart minimal de 400 kHz', 'L\'écart entre deux micros est bon, mais les produits d\'intermodulation tombent pile sur les voisins.'], ['Un manque de canaux TNT', 'Huit micros sur 4 MHz tiennent dans un canal de 8 MHz : le problème est ailleurs.']], answer: 0,
            aides: ['Calculez 2f1 − f2 pour deux micros espacés de 500 kHz.', 'Avec un pas régulier, le produit de deux voisins tombe à un pas de l\'un d\'eux : sur le micro suivant.'],
            solution: 'Avec un pas régulier, **2f1 − f2 tombe sur un autre micro** de la série : il est brouillé par ses voisins. Un plan se calcule (plus de 300 kHz de tout produit, plus de 400 kHz de tout micro, hors canaux TNT).',
          },
        ]),
      ];
    },
  },
  'hf-antennes': {
    titre: 'Longueur d\'onde, évanouissements et visée',
    consigne: 'Sur le toit de la tribune, vous installez les antennes de réception des caméras HF : quelle longueur d\'onde, où tombent les creux, combien perd une antenne mal visée.',
    gen: (rnd) => {
      const [fa, fb] = tirer(rnd, [600, 1900, 2200, 2400, 5800], 2);
      const lam = 30000 / fa, demi = 30000 / fb / 2;
      const type = pick(rnd, ['panneau', 'patch', 'logper']), A = ANT[type];
      const ang = pick(rnd, [10, 15, 20, 30, 40]), g = Math.round(antGain(type, ang) * 10) / 10;
      return [
        {
          type: 'nombre', unite: 'cm', answer: Math.round(lam * 10) / 10, tol: Math.max(0.2, lam * 0.01),
          q: `Quelle est la longueur d'onde d'une liaison à **${fr(fa)} MHz** ? (λ en mètres = 300 / f en MHz.)`,
          pieges: [{ v: Math.round(lam / 2 * 10) / 10, why: 'C\'est la demi-longueur d\'onde, l\'écart de trajet qui met deux copies en opposition de phase.' }, { v: Math.round(lam / 10 * 100) / 100, why: 'Attention aux unités : 300 / f donne des mètres ; convertissez en centimètres.' }],
          aides: ['La formule donne des mètres : il faudra multiplier par 100 pour des centimètres.', `300 ÷ ${fr(fa)} = λ en mètres, puis × 100.`],
          solution: `300 ÷ ${fr(fa)} = ${fr(lam / 100, 3)} m, soit **${fr(lam, 1)} cm**. Plus la fréquence monte, plus l'onde est courte, et plus les creux d'évanouissement sont rapprochés.`,
        },
        {
          type: 'nombre', unite: 'cm', answer: Math.round(demi * 10) / 10, tol: Math.max(0.15, demi * 0.01),
          q: `À **${fr(fb)} MHz**, le signal direct et sa réflexion sur la pelouse arrivent en opposition de phase quand leurs trajets diffèrent d'une demi-longueur d'onde. De combien de centimètres ?`,
          pieges: [{ v: Math.round(demi * 2 * 10) / 10, why: 'C\'est la longueur d\'onde entière : avec un tour complet de retard, les deux copies sont de nouveau en phase et s\'additionnent.' }],
          aides: ['Calculez d\'abord la longueur d\'onde : 300 / f en mètres.', `λ = 300 ÷ ${fr(fb)} m ; divisez par deux et passez en centimètres.`],
          solution: `λ = ${fr(demi * 2, 1)} cm, la moitié : **${fr(demi, 1)} cm**. Quelques centimètres de déplacement du cadreur suffisent à passer d'une bosse à un creux de 10 à 20 dB : d'où la diversité.`,
        },
        {
          type: 'nombre', unite: 'dBi', answer: g, tol: 0.15,
          q: `Une antenne **${A.name.toLowerCase()}** de ${A.gain} dBi est visée à **${ang}°** de la caméra HF. Dans le modèle du simulateur, elle perd 3 × (angle ÷ ${A.hp}°)² dB hors de son axe. Quel est son gain vers la caméra ?`,
          pieges: [{ v: A.gain, why: 'C\'est le gain dans l\'axe : la caméra n\'y est pas, l\'antenne perd du gain hors de son axe.' }, { v: Math.round(3 * (ang / A.hp) ** 2 * 10) / 10, why: 'C\'est la perte, pas le gain qui reste : retirez-la du gain dans l\'axe.' }],
          aides: [`Calculez d'abord la perte : 3 × (${ang} ÷ ${A.hp})².`, `Gain vers la caméra = ${A.gain} dBi − la perte.`],
          solution: `Perte = 3 × (${ang} ÷ ${A.hp})² = ${fr(3 * (ang / A.hp) ** 2, 1)} dB, gain = **${fr(g, 1)} dBi**. Une antenne directive se paie en couverture : on la vise vers le terrain, et l'on garde un omni là où la caméra peut être partout.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Le niveau reçu d\'une seule antenne fait des creux brutaux quand le cadreur longe la touche. Que mettez-vous en place ?',
            choices: ['Une deuxième antenne, à plusieurs longueurs d\'onde de la première : la diversité', ['Plus de puissance à l\'émetteur', 'Les creux d\'évanouissement font 10 à 20 dB : quelques dB de plus ne les comblent pas, et l\'autonomie et les voisins en pâtissent.'], ['Un câble coaxial plus court', 'Le câble ajoute une perte fixe ; il ne crée pas les creux, qui viennent des trajets multiples.']], answer: 0,
            aides: ['Les creux viennent de copies du signal qui s\'annulent à un endroit précis.', 'À un autre endroit, à quelques longueurs d\'onde de là, les trajets ne se combinent pas de la même façon.'],
            solution: 'La **diversité** : deux antennes (ou plus) espacées ne voient presque jamais un creux au même instant ; le récepteur choisit la meilleure ou les combine.',
          },
          {
            type: 'choix', q: 'Le cadreur Steadicam se penche et tourne sans cesse : l\'émetteur change de polarisation. Quelle antenne de réception choisir ?',
            choices: ['Une antenne à polarisation circulaire (ou double)', ['Une antenne verticale très directive', 'Une antenne verticale reçoit mal une onde devenue horizontale : plus elle est directive, plus le creux est net.'], ['N\'importe laquelle : la polarisation ne joue pas en COFDM', 'La modulation n\'y change rien : une antenne croisée avec l\'onde perd beaucoup de signal.']], answer: 0,
            aides: ['Une antenne verticale reçoit mal une onde horizontale.', 'Il faut une antenne qui reçoit l\'émetteur quelle que soit son inclinaison, quitte à perdre un peu.'],
            solution: 'Une antenne en **polarisation circulaire** (hélice, patch à alimentation croisée) ou à double polarisation : elle reçoit l\'émetteur quelle que soit son inclinaison, au prix de 3 dB.',
          },
          {
            type: 'choix', q: 'Les antennes sont sur le toit de la tribune, à une centaine de mètres du car. Comment amener leur signal au récepteur ?',
            choices: ['En RF sur fibre : un boîtier sous l\'antenne module un laser', ['Par un long coaxial', 'À 2 GHz, un coaxial perd de l\'ordre de 1 dB tous les 10 m : 10 dB sur 100 m, une marge entière.'], ['Par le Wi-Fi du stade', 'Le Wi-Fi est saturé par les spectateurs, et l\'on ne relaie pas une liaison HF par une autre liaison radio partagée.']], answer: 0,
            aides: ['Comptez les pertes d\'un coaxial à 2 GHz sur cette longueur.', 'Le car reçoit déjà la vidéo des caméras par de la fibre.'],
            solution: 'De la **RF sur fibre** : le signal HF module un laser sous l\'antenne, et la fibre l\'amène au car sans les pertes d\'un long coaxial (de l\'ordre de 1 dB par 10 m à 2 GHz).',
          },
        ]),
      ];
    },
  },
  'hf-bilan': {
    titre: 'Faire le bilan d\'une liaison HF',
    consigne: 'Au poste HF, vous vérifiez qu\'une caméra HF tiendra pendant le match : affaiblissement en espace libre, niveau reçu, marge sur la sensibilité.',
    gen: (rnd) => {
      const d = pick(rnd, [10, 25, 40, 50, 80, 100, 150, 200, 400]), f = pick(rnd, [600, 2200, 5800]);
      const L = Math.round(fspl(d, f) * 10) / 10;
      const ptx = pick(rnd, [20, 23, 27, 30]), gtx = pick(rnd, [0, 2]), [rxNom, grx] = pick(rnd, RX), [obNom, obs] = pick(rnd, OBSTACLES), cab = entre(rnd, 1, 4);
      const d2 = pick(rnd, [40, 60, 80, 120, 150]), L2 = Math.round(fspl(d2, 2200));
      const prx = ptx + gtx + grx - L2 - obs - cab;
      const [modNom, sens] = pick(rnd, SENSIB);
      let niveau = entre(rnd, -92, -60); if (niveau === sens) niveau += 1;
      const marge = niveau - sens;
      const mv = pick(rnd, [-4, 1, 2, 5, 7, 12, 18]);
      const cat = mv >= 10 ? 0 : mv >= 3 ? 1 : mv >= 0 ? 2 : 3;
      const k = pick(rnd, [2, 4, 8]);
      return [
        {
          type: 'nombre', unite: 'dB', answer: L, tol: 0.3,
          q: `Quel est l'affaiblissement en espace libre d'une liaison de **${fr(d)} m** à **${fr(f)} MHz** ? (FSPL = 20 log d + 20 log f − 27,55, d en mètres, f en MHz.)`,
          pieges: [{ v: Math.round((20 * Math.log10(d) + 20 * Math.log10(f)) * 10) / 10, why: 'Il manque la constante : retirez 27,55 dB.' }],
          aides: ['Calculez séparément 20 log de la distance et 20 log de la fréquence.', `20 × log ${fr(d)} = ${fr(20 * Math.log10(d), 1)} ; 20 × log ${fr(f)} = ${fr(20 * Math.log10(f), 1)} ; additionnez, puis retirez 27,55.`],
          solution: `${fr(20 * Math.log10(d), 1)} + ${fr(20 * Math.log10(f), 1)} − 27,55 = **${fr(L, 1)} dB**. C'est le poste le plus lourd du bilan, et il ne compte aucun obstacle.`,
        },
        {
          type: 'nombre', unite: 'dBm', answer: prx, tol: 0.5,
          q: `L'émetteur de la caméra sort **${ptx} dBm** sur une antenne de **${gtx} dBi** ; le car reçoit sur **${rxNom}** de **${grx} dBi**, ${obNom} (**${obs} dB**), avec **${cab} dB** de câbles. L'espace libre coûte **${L2} dB** à ${d2} m. Quel niveau reçoit le récepteur ?`,
          pieges: [{ v: ptx + gtx + grx - L2 - cab, why: obs ? 'Vous avez oublié l\'obstacle sur le trajet.' : '' }, { v: ptx - gtx - grx - L2 - obs - cab, why: 'Les gains d\'antenne s\'ajoutent : ils concentrent l\'énergie, ils ne la retirent pas.' }].filter((x) => x.why),
          aides: ['En décibels, tout s\'additionne : les gains avec un signe +, les pertes avec un signe −.', `${ptx} + ${gtx} + ${grx} − ${L2} − ${obs} − ${cab}.`],
          solution: `${ptx} + ${gtx} + ${grx} − ${L2} − ${obs} − ${cab} = **${dbm(prx)}**. ${obs ? 'La tribune, à elle seule, coûte autant que de multiplier la distance par six.' : 'En ligne de vue, il ne reste que l\'espace libre et les câbles.'}`,
        },
        {
          type: 'nombre', unite: 'dB', answer: marge,
          q: `Le récepteur lit **${dbm(niveau)}** ; la caméra émet en **${modNom}**, dont la sensibilité est de l'ordre de **${dbm(sens)}**. Quelle est la marge ?`,
          pieges: [{ v: -marge, why: 'Le signe est inversé : la marge est le niveau reçu moins la sensibilité (positive quand on reçoit plus que le minimum).' }],
          aides: ['La marge compare ce que l\'on reçoit au minimum que le récepteur sait décoder.', `${dbm(niveau)} − (${dbm(sens)}) : attention aux deux signes moins.`],
          solution: `${niveau} − (${sens}) = **${marge} dB**. ${marge >= 10 ? 'Confortable : les évanouissements passeront.' : marge >= 3 ? 'Juste : chaque creux se verra.' : marge >= 0 ? 'Instable : au moindre pas du cadreur, l\'image décroche.' : 'Négative : l\'image est perdue.'}`,
        },
        pick(rnd, [
          {
            type: 'choix', q: `La liaison de la caméra HF a une marge de **${mv} dB**. Qu'en dites-vous ?`,
            choices: [['Confortable : les évanouissements de quelques dB passeront inaperçus', 'Il faut plus de 10 dB pour être tranquille.'], ['Juste : elle tient, mais chaque creux se verra', 'Entre 3 et 10 dB seulement.'], ['Instable : à la merci du prochain pas du cadreur', 'Entre 0 et 3 dB seulement.'], ['Perdue : le récepteur ne décode plus', 'Seulement sous 0 dB.']], answer: cat,
            aides: ['La leçon donne trois seuils : 10 dB, 3 dB et 0 dB.', 'Au-delà de 10 dB on est tranquille ; entre 3 et 10 la liaison tient ; sous 3 elle est à la merci d\'un creux ; sous 0 elle est perdue.'],
            solution: `Avec ${mv} dB : **${['confortable', 'juste', 'instable', 'perdue'][cat]}**. En numérique, la dégradation n'est pas progressive : image parfaite, puis plus rien en quelques dB (l'effet falaise).`,
          },
          {
            type: 'nombre', unite: 'dB', answer: Math.round(20 * Math.log10(k) * 10) / 10, tol: 0.3,
            q: `La caméra HF s'éloigne : elle passe de 50 m à **${50 * k} m** du récepteur. Combien de dB d'espace libre de plus ?`,
            pieges: [{ v: 10 * Math.log10(k), why: 'L\'affaiblissement suit 20 log d, pas 10 log d : chaque doublement coûte 6 dB, pas 3.' }, { v: k, why: 'En dB, ce n\'est pas le rapport des distances : c\'est 20 fois son logarithme.' }],
            aides: ['Chaque doublement de la distance coûte 6 dB.', `La distance est multipliée par ${k}, soit ${Math.log2(k)} doublement${k > 2 ? 's' : ''} : 20 log ${k}.`],
            solution: `20 × log ${k} = **${fr(20 * Math.log10(k), 1)} dB** (${Math.log2(k)} × 6 dB). C'est la marge qu'il faut avoir en réserve, ou rattraper par une antenne plus directive.`,
          },
        ]),
      ];
    },
  },
  'hf-cofdm': {
    titre: 'Régler l\'émetteur COFDM d\'une caméra HF',
    consigne: 'Au poste HF, vous choisissez le mode, l\'intervalle de garde, la modulation et le codage de la caméra HF : quels échos sont absorbés, quel débit reste pour l\'image.',
    gen: (rnd) => {
      const mode = pick(rnd, ['2K', '8K']), g = pick(rnd, Object.keys(GARDES)), giT = TU[mode] * GARDES[g];
      const gB = pick(rnd, [7, 14, 28, 56, 112, 224]), km = gB * 0.3;
      const mod = pick(rnd, ['QPSK', '16QAM', '64QAM']), fec = pick(rnd, ['1/2', '2/3', '3/4']), gi = pick(rnd, ['1/4', '1/32']);
      const rate = Math.round(cofdmBitrate(mod, fec, gi, 8) * 10) / 10;
      const detour = pick(rnd, [0.6, 1.5, 3, 6, 9, 15, 24]), tau = detour / 0.3;
      return [
        {
          type: 'nombre', unite: 'µs', answer: giT,
          q: `En COFDM **${mode}**, le symbole utile dure **${TU[mode]} µs**. Combien dure l'intervalle de garde **${g}** ?`,
          pieges: [{ v: TU[mode] + giT, why: 'C\'est la durée du symbole complet, garde comprise : la garde n\'en est qu\'une fraction.' }],
          aides: ['La garde est une fraction de la durée du symbole utile.', `${TU[mode]} µs × ${g}.`],
          solution: `${TU[mode]} × ${g} = **${fr(giT, giT % 1 ? 1 : 0)} µs**. Un écho plus court que cette garde ne brouille rien : il s'ajoute au symbole courant.`,
        },
        {
          type: 'nombre', unite: 'km', answer: Math.round(km * 10) / 10, tol: 0.2,
          q: `L'intervalle de garde dure **${gB} µs**. Un écho met 1 µs de plus par 300 m de détour. Jusqu'à quel détour (en km) un écho reste-t-il absorbé ?`,
          pieges: [{ v: gB * 300, why: 'C\'est en mètres : convertissez en kilomètres.' }, { v: Math.round(gB / 0.3 * 10) / 10, why: 'L\'opération est inversée : chaque microseconde de garde couvre 300 m, on multiplie.' }],
          aides: ['Chaque microseconde de garde couvre 300 m de détour.', `${gB} × 0,3 km.`],
          solution: `${gB} × 0,3 = **${fr(km, 1)} km** de détour. Dans un stade, les échos sur les tribunes font quelques centaines de mètres : la garde 1/4 est très large, on peut la raccourcir pour gagner du débit.`,
        },
        {
          type: 'nombre', unite: 'Mb/s', answer: rate, tol: 0.2,
          q: `En 8 MHz, la référence DVB-T est **4,98 Mb/s en QPSK 1/2, garde 1/4**. Quel débit utile en **${MODCOD[mod]} ${fec}, garde ${gi}** ? (Bits par porteuse : QPSK 2, 16-QAM 4, 64-QAM 6 ; le débit suit le rendement du codage et 1 / (1 + garde).)`,
          pieges: [{ v: Math.round(4.98 * ({ QPSK: 2, '16QAM': 4, '64QAM': 6 }[mod] / 2) * ({ '1/2': 0.5, '2/3': 2 / 3, '3/4': 0.75 }[fec] / 0.5) * 10) / 10, why: gi === '1/4' ? '' : 'Vous avez oublié la garde : une garde de 1/32 au lieu de 1/4 laisse 1,25 / 1,03125 fois plus de place aux données.' }].filter((x) => x.why && Math.abs(x.v - rate) > 0.3),
          aides: ['Partez de 4,98 Mb/s et multipliez par trois rapports : les bits par porteuse, le codage, la garde.', `4,98 × (bits ÷ 2) × (${fec} ÷ 1/2) × (1,25 ÷ (1 + ${gi})).`],
          solution: `4,98 × ${({ QPSK: 2, '16QAM': 4, '64QAM': 6 }[mod]) / 2} × ${fr(({ '1/2': 0.5, '2/3': 2 / 3, '3/4': 0.75 }[fec]) / 0.5, 2)} × ${fr(1.25 / (1 + GARDES[gi]), 3)} = **${fr(rate, 1)} Mb/s**. Plus de débit, c'est une image plus fine, mais il faut plus de signal : chaque pas de modulation demande environ 6 dB de plus.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: `Un écho sur la tribune d'en face fait **${fr(detour, detour % 1 ? 1 : 0)} km** de détour (${fr(tau, 0)} µs). L'émetteur est en 2K, garde 1/32 (7 µs). Que se passe-t-il ?`,
            choices: tau <= 7
              ? ['Rien : l\'écho tombe dans l\'intervalle de garde, il est absorbé', ['L\'image se dégrade : il faut passer en garde 1/4', 'L\'écho est plus court que la garde : il ne brouille rien, inutile de perdre du débit.'], ['L\'image est perdue : un écho brouille toujours le COFDM', 'C\'est justement ce que l\'intervalle de garde évite.']]
              : [['Rien : l\'écho tombe dans l\'intervalle de garde', `L'écho dure ${fr(tau, 0)} µs, la garde 1/32 n'en couvre que 7.`], 'L\'écho dépasse la garde et brouille le symbole suivant : allonger la garde (1/4 : 56 µs)', ['Il faut augmenter la puissance', 'Plus de puissance renforce aussi l\'écho : c\'est sa durée, pas son niveau, qui pose problème.']],
            answer: tau <= 7 ? 0 : 1,
            aides: ['Convertissez le détour en retard : 1 µs par 300 m.', 'Comparez ce retard à la durée de la garde.'],
            solution: tau <= 7 ? `${fr(tau, 0)} µs, c'est moins que la garde de 7 µs : l'écho est **absorbé**.` : `${fr(tau, 0)} µs dépasse la garde de 7 µs : **interférence entre symboles**. Une garde 1/4 (56 µs en 2K) absorbe jusqu'à 17 km de détour, au prix d'environ 20 % de débit.`,
          },
          {
            type: 'choix', q: 'La Steadicam suit les joueurs jusque dans le tunnel des vestiaires, où le signal chute. Quel réglage de l\'émetteur ?',
            choices: ['Redescendre en QPSK, codage robuste : moins de débit, mais elle passe partout', ['Passer en 64-QAM pour une plus belle image', 'Le 64-QAM demande environ 12 dB de signal de plus que le QPSK : dans le tunnel, l\'image décrocherait.'], ['Raccourcir l\'intervalle de garde', 'Une garde plus courte donne du débit, pas de la robustesse au signal faible.']], answer: 0,
            aides: ['Chaque pas de modulation demande environ 6 dB de signal en plus.', 'Dans le tunnel, ce qui manque, c\'est le signal, pas le débit.'],
            solution: 'Le **QPSK** (avec un codage 1/2 ou 2/3) : il demande peu de C/N, la liaison tient là où le 16-QAM ou le 64-QAM décrochent ; l\'image est un peu moins fine.',
          },
          {
            type: 'choix', q: 'L\'image de la caméra HF arrive au car avec un retard de 1 à 3 images sur les caméras câblées. Que fait-on ?',
            choices: ['Elle passe par un synchroniseur à l\'entrée du car, et son son est recalé d\'autant', ['Rien : le COFDM est sans retard', 'Le codage H.264 ou HEVC et l\'entrelacement coûtent de l\'ordre de 20 à 60 ms.'], ['On l\'interdit à l\'antenne', 'Le retard est connu et se compense : la caméra HF est à l\'antenne à chaque match.']], answer: 0,
            aides: ['D\'où vient ce retard : compression et entrelacement.', 'Toute source non synchrone du car passe par le même appareil à son entrée.'],
            solution: 'Un **synchroniseur** la cale sur la référence du car, et le son de la caméra HF (et ses retours) est recalé d\'autant : la latence de 20 à 60 ms est le prix de la compression.',
          },
        ]),
      ];
    },
  },
  'hf-fresnel': {
    titre: 'Préparer une liaison point à point',
    consigne: 'Avant d\'aller poser les mâts d\'une liaison vers une position éloignée, vous calculez le premier rayon de Fresnel, le dégagement à garder, le renflement de la Terre et le gain des paraboles.',
    gen: (rnd) => {
      const D = pick(rnd, [2, 3, 4, 5, 6, 8, 10, 12, 15]), f = pick(rnd, [2.4, 5, 7, 13]), d1 = pick(rnd, [D / 2, D / 4, D / 3]);
      const r = Math.round(fresnel1(d1, D - d1, f) * 100) / 100, r6 = Math.round(0.6 * fresnel1(d1, D - d1, f) * 100) / 100;
      const Dt = pick(rnd, [5, 10, 15, 20, 30]), b = Math.round(renflement(Dt / 2, Dt / 2) * 100) / 100;
      const da = pick(rnd, [0.3, 0.6, 0.9, 1.2]), fa = pick(rnd, [5, 7, 13]), g = Math.round(gainParabole(da, fa) * 10) / 10;
      const relp = pick(rnd, [0, 20, 40]), pd = Math.round(perteDiffraction(relp / 100) * 10) / 10;
      const where = d1 === D / 2 ? 'au milieu de la liaison' : `à ${fr(d1, 2)} km de l'émetteur`;
      return [
        {
          type: 'nombre', unite: 'm', answer: r, tol: Math.max(0.05, r * 0.01),
          q: `Liaison de **${D} km** à **${fr(f, 1)} GHz**. Quel est le rayon du premier ellipsoïde de Fresnel **${where}** ?`,
          pieges: [{ v: Math.round(17.32 * d1 * (D - d1) / (f * D) * 100) / 100, why: 'Il manque la racine carrée : r1 = 17,32 × √(d1 × d2 ÷ (f × D)).' }].filter((x) => Math.abs(x.v - r) > Math.max(0.1, r * 0.02)),
          aides: ['r1 = 17,32 × √(d1 × d2 ÷ (f × D)), distances en km, f en GHz, r1 en m.', `d1 = ${fr(d1, 2)} km, d2 = ${fr(D - d1, 2)} km.`],
          solution: `17,32 × √(${fr(d1, 2)} × ${fr(D - d1, 2)} ÷ (${fr(f, 1)} × ${D})) = **${fr(r, 2)} m**.`,
        },
        {
          type: 'nombre', unite: 'm', answer: r6, tol: Math.max(0.05, r6 * 0.015),
          q: `Au même point, de combien de mètres au moins le sommet d'un obstacle doit-il rester sous la ligne de vue (la règle des 60 %) ?`,
          pieges: [{ v: r, why: 'C\'est le rayon entier : la règle demande d\'en dégager 60 %.' }],
          aides: ['On garde libres 60 % du premier rayon de Fresnel.', `0,6 × ${fr(r, 2)} m.`],
          solution: `0,6 × ${fr(r, 2)} = **${fr(r6, 2)} m** sous la ligne de vue : la diffraction n'y coûte rien.`,
        },
        {
          type: 'nombre', unite: 'm', answer: b, tol: Math.max(0.03, b * 0.02),
          q: `Liaison de **${Dt} km**. De combien la Terre bombe-t-elle au milieu (atmosphère standard, k = 4/3) ?`,
          pieges: [{ v: Math.round((Dt / 2) ** 2 / 12.74 * 100) / 100, why: 'C\'est sans le facteur k = 4/3 : les ondes se courbent un peu, le renflement effectif est plus petit.' }].filter((x) => Math.abs(x.v - b) > 0.05),
          aides: ['Renflement = d1 × d2 ÷ (12,74 × k), en m, distances en km.', `${fr(Dt / 2, 1)} × ${fr(Dt / 2, 1)} ÷ (12,74 × 4/3).`],
          solution: `${fr(Dt / 2, 1)} × ${fr(Dt / 2, 1)} ÷ 16,99 = **${fr(b, 2)} m**, à ajouter à la hauteur des obstacles.`,
        },
        {
          type: 'nombre', unite: 'dBi', answer: g, tol: 0.3,
          q: `Quel est le gain d'une parabole de **${fr(da, 1)} m** à **${fa} GHz** (rendement 0,55) ?`,
          pieges: [{ v: Math.round(10 * Math.log10(0.55 * Math.PI * da / lambda(fa)) * 10) / 10, why: 'Le gain suit la surface : (π D ÷ λ) est au carré.' }],
          aides: [`Longueur d'onde : 0,3 ÷ ${fa} = ${fr(lambda(fa) * 100, 2)} cm.`, `Gain = 10 log (0,55 × (π × ${fr(da, 1)} ÷ ${fr(lambda(fa), 4)})²).`],
          solution: `π × ${fr(da, 1)} ÷ ${fr(lambda(fa), 4)} = ${fr(Math.PI * da / lambda(fa), 1)} ; au carré, × 0,55, puis 10 log : **${fr(g, 1)} dBi**.`,
        },
        pick(rnd, [...FRESNEL_SITU, {
          type: 'nombre', unite: 'dB', answer: pd, tol: 0.3,
          q: `Un obstacle ne laisse dégagés que **${relp} %** du premier rayon de Fresnel. Quelle perte de diffraction (UIT-R P.526 : ν = −√2 × dégagement, J = 6,9 + 20 log (√((ν − 0,1)² + 1) + ν − 0,1)) ?`,
          aides: [`Dégagement relatif : ${fr(relp / 100, 2)} ; ν = −√2 × ${fr(relp / 100, 2)} = ${fr(-Math.SQRT2 * relp / 100, 3)}.`, 'Remplacez ν dans la formule ; à 0 % de dégagement, on trouve environ 6 dB.'],
          solution: `ν = ${fr(-Math.SQRT2 * relp / 100, 3)} : **${fr(pd, 1)} dB** perdus${relp === 0 ? ', l\'obstacle affleure la ligne de vue' : ''}. À 60 %, plus rien.`,
        }]),
      ];
    },
  },
});
