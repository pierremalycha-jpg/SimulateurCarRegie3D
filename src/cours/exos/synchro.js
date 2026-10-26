// @ts-check
import { registerExos, entre, pick, fr } from '../exo.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « La synchro » : des timecodes à convertir, des dérives de quartz, des
// retards de câble et des fenêtres de phase à calculer, des situations du car à trancher, avec des valeurs
// tirées à chaque essai. Les chiffres sont ceux des leçons (cours/synchro.js) : timecode ST 12-1 à 25
// images/s, ≈ 5 ns par mètre de coaxial (un ordre de grandeur), lignes de 17,78 µs en 1080p50 et 35,56 µs en
// 1080i50, fenêtre du mélangeur de l'ordre de ± ½ ligne, une image de 20 ms à 50 Hz.
// ----------------------------------------------------------------------------------
const deux = (n) => String(n).padStart(2, '0');
/** le timecode d'un numéro d'image, à ips images par seconde */
const tc = (n, ips = 25) => { const ii = n % ips, s = Math.floor(n / ips); return `${deux(Math.floor(s / 3600))}:${deux(Math.floor(s / 60) % 60)}:${deux(s % 60)}:${deux(ii)}`; };
// les trames et la durée d'une ligne (1 125 lignes en 1080, 750 en 720p)
const LIGNES = [
  { nom: '1080p50', lignes: 1125, ips: 50 },
  { nom: '1080i50 (25 images par seconde)', lignes: 1125, ips: 25 },
  { nom: '720p50', lignes: 750, ips: 50 },
];

registerExos({
  'synchro-timecode': {
    titre: 'Dater les images au timecode',
    consigne: 'La scripte note les actions au timecode du car (heure du jour, 25 images/s) ; l\'opérateur ralenti les retrouve. Vous convertissez, vous vérifiez la dérive d\'une machine mal calée.',
    gen: (rnd) => {
      const n = entre(rnd, 25 * 5, 25 * 3600 * 3);
      const h = entre(rnd, 13, 22), m = entre(rnd, 0, 59), s = entre(rnd, 0, 59), ii = entre(rnd, 0, 24);
      const k = ((h * 60 + m) * 60 + s) * 25 + ii;
      const ppm = pick(rnd, [10, 20, 25, 40, 50]), min = 0.04 / (ppm * 1e-6) / 60;
      const T = tc(n);
      return [
        {
          type: 'texte', placeholder: 'HH:MM:SS:II', forme: 'ip', accept: [T, T.replace(/^0/, '')],
          q: `Un clip commence à l'image **${fr(n)}** de la journée (on compte à partir de 00:00:00:00, à 25 images/s). Quel est son timecode ?`,
          pieges: [{ v: tc(n, 30), why: 'C\'est le calcul à 30 images/s : en Europe, une seconde compte 25 images, numérotées de 00 à 24.' }].filter((x) => x.v !== T),
          aides: ['Divisez d\'abord par 25 : le quotient donne les secondes, le reste le numéro de l\'image (00 à 24).', 'Puis découpez les secondes en heures (3 600 s), minutes (60 s) et secondes.'],
          solution: `${fr(n)} = ${fr(Math.floor(n / 25))} s et ${n % 25} images : **${T}**.`,
        },
        {
          type: 'nombre', answer: k,
          q: `La scripte a noté « but, **${deux(h)}:${deux(m)}:${deux(s)}:${deux(ii)}** ». À quel numéro d'image de la journée est-ce (25 images/s, 00:00:00:00 = image 0) ?`,
          pieges: [{ v: ((h * 60 + m) * 60 + s) * 30 + ii, why: 'C\'est le calcul à 30 images/s : le car tourne à 25.' }, { v: ((h * 60 + m) * 60 + s) * 25, why: 'Il manque les images de la dernière seconde (II).' }].filter((x) => x.v !== k),
          aides: ['Ramenez tout en secondes, puis en images.', 'n = ((HH × 60 + MM) × 60 + SS) × 25 + II.'],
          solution: `((${h} × 60 + ${m}) × 60 + ${s}) × 25 + ${ii} = **${fr(k)}**.`,
        },
        {
          type: 'nombre', unite: 'min', answer: Math.round(min * 10) / 10, tol: Math.max(0.3, min * 0.01),
          q: `Un enregistreur a été calé (jam sync) sur le LTC du car, puis il compte seul sur son quartz, juste à **${ppm} ppm** près. Au bout de combien de minutes a-t-il dérivé d'une image entière (25 images/s) ?`,
          pieges: [{ v: Math.round(min / 2 * 10) / 10, why: 'C\'est pour une image de 20 ms (50 images/s) : à 25 images/s, une image dure 40 ms.' }],
          aides: [`À ${ppm} ppm, l'horloge gagne ou perd ${ppm} µs par seconde.`, `Une image dure 40 ms = 40 000 µs : divisez par ${ppm} µs/s, puis par 60.`],
          solution: `40 000 µs ÷ ${ppm} µs/s = ${fr(40000 / ppm)} s, soit **${fr(min, 1)} min**. D'où l'asservissement permanent au timecode du car.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Faut-il passer le timecode du car en drop-frame pour un match produit à 25 images/s ?',
            choices: ['Non : le drop-frame ne concerne que le 29,97 images/s', ['Oui, sinon il prend du retard sur l\'heure', '25 images font exactement une seconde : le timecode ne prend aucun retard.'], ['Oui, en sautant deux images chaque minute', 'Le drop-frame ne supprime aucune image, seulement des numéros, et seulement en 29,97.']], answer: 0,
            aides: ['D\'où vient le retard que le drop-frame rattrape ?', '30 000 / 1 001 n\'est pas un entier ; 25, si.'],
            solution: '**Non** : en 25 et 50 images/s, les cadences sont entières. Le drop-frame (point-virgule, 01:00:00;02) est une affaire de 29,97.',
          },
          {
            type: 'choix', q: 'Le monteur veut lire le timecode d\'une cassette SD image arrêtée. Lequel lira-t-il ?',
            choices: ['Le VITC, inscrit dans la suppression trame', ['Le LTC', 'Le LTC est un signal audio : il ne se lit qu\'en défilement.'], ['Aucun : un timecode ne se lit qu\'en lecture', 'Le VITC fait partie de chaque image : il se lit même image arrêtée.']], answer: 0,
            aides: ['Un des supports est un son, l\'autre est dans l\'image.', 'Une image arrêtée garde ses lignes de suppression.'],
            solution: 'Le **VITC** : il fait partie de l\'image. Le LTC, signal audio, ne se lit qu\'en défilement.',
          },
          {
            type: 'choix', q: 'Un enregistreur compte en « record run ». Pourquoi l\'opérateur ralenti n\'y retrouve-t-il pas le « but, 20:47:13:12 » de la scripte ?',
            choices: ['Il ne compte que pendant qu\'il enregistre : il ne parle pas l\'heure du jour du car', ['Parce qu\'il n\'est pas genlocké', 'Le genlock met les images en phase ; il ne les date pas.'], ['Parce que son timecode est en drop-frame', 'En 25 images/s, il n\'y a pas de drop-frame.']], answer: 0,
            aides: ['Toutes les machines doivent noter la même heure.', 'Record run, free run, heure du jour : laquelle partage le car ?'],
            solution: 'En **record run**, il compte pour lui-même. On le cale sur le LTC du car (heure du jour), asservi en permanence.',
          },
          {
            type: 'choix', q: 'Le timecode et le genlock viennent du même SPG. Que fait le timecode que le genlock ne fait pas ?',
            choices: ['Il date chaque image ; le genlock met les images en phase', ['Il met les sources en phase pour la coupe', 'C\'est le rôle du genlock : le timecode ne règle aucune phase.'], ['Rien : ce sont deux noms du même signal', 'Ce sont deux signaux différents, qui changent ensemble au début de chaque image.']], answer: 0,
            aides: ['L\'un dit « quand », l\'autre dit « en même temps ».', 'Le timecode porte HH:MM:SS:II.'],
            solution: 'Le timecode **date** (HH:MM:SS:II) ; le genlock **cale** le rythme des sorties. Les deux sont nécessaires.',
          },
          {
            type: 'choix', q: 'En 50 images/s, combien d\'images compte une minute ?',
            choices: ['3 000', ['1 500', 'C\'est une minute à 25 images/s.'], ['3 600', 'C\'est le nombre de secondes dans une heure, ou une minute à 60 images/s.']], answer: 0,
            aides: ['Une seconde compte 50 images.', 'Multipliez les 50 images d\'une seconde par 60.'],
            solution: '50 × 60 = **3 000** images. Le timecode ST 12-1 numérote les paires d\'images de 00 à 24, avec un drapeau pour la seconde image de chaque paire.',
          },
        ]),
      ];
    },
  },
  'synchro-genlock': {
    titre: 'Mettre les sources en phase',
    consigne: 'Au poste Synchro et à la baie de mesure, vous réglez la phase des sources du mélangeur : le retard des câbles, la fenêtre d\'entrée, la dérive d\'une source sans genlock.',
    gen: (rnd) => {
      const L = entre(rnd, 2, 30) * 10, us = L * 5 / 1000;
      const F = pick(rnd, LIGNES), ligne = 1e6 / (F.lignes * F.ips), demi = ligne / 2;
      const ppm = pick(rnd, [5, 10, 20, 25, 40, 50]), min = 0.02 / (ppm * 1e-6) / 60;
      return [
        {
          type: 'nombre', unite: 'µs', answer: Math.round(us * 1000) / 1000, tol: Math.max(0.01, us * 0.02),
          q: `La CCU est à **${L} m** de coaxial du mélangeur. Quel retard ce câble ajoute-t-il, en µs (≈ 5 ns par mètre, un ordre de grandeur) ?`,
          pieges: [{ v: L * 5, why: 'C\'est le retard en nanosecondes : 1 µs = 1 000 ns.' }],
          aides: ['Le retard est proportionnel à la longueur.', `${L} m × 5 ns, puis divisez par 1 000 pour passer en µs.`],
          solution: `${L} × 5 ns = ${fr(L * 5)} ns = **${fr(us, 2)} µs** : peu devant une ligne de 17,8 µs en 1080p50, mais à compenser par la phase H.`,
        },
        {
          type: 'nombre', unite: 'µs', answer: Math.round(demi * 100) / 100, tol: 0.05,
          q: `Le mélangeur réaligne ses entrées dans une fenêtre de l'ordre de **± ½ ligne**. En **${F.nom}** (${fr(F.lignes)} lignes par image), combien de µs de part et d'autre ?`,
          pieges: [{ v: Math.round(ligne * 100) / 100, why: 'C\'est une ligne entière : la fenêtre en vaut la moitié de chaque côté.' }],
          aides: ['Une ligne dure une seconde divisée par le nombre de lignes par seconde.', `1 000 000 µs ÷ (${fr(F.lignes)} × ${F.ips}), puis la moitié.`],
          solution: `Une ligne : ${fr(ligne, 2)} µs ; la fenêtre : **± ${fr(demi, 2)} µs** (à lire dans la notice du mélangeur). Au-delà, il faut régler la phase H, ou un synchroniseur.`,
        },
        {
          type: 'nombre', unite: 'min', answer: Math.round(min * 10) / 10, tol: Math.max(0.2, min * 0.01),
          q: `Une source n'est pas genlockée : son quartz est juste à **${ppm} ppm** près. En combien de minutes fait-elle le tour d'une image entière à 50 Hz (20 ms) ?`,
          pieges: [{ v: Math.round(min * 2 * 10) / 10, why: 'C\'est pour une image de 40 ms (25 images/s) : à 50 Hz, une image dure 20 ms.' }],
          aides: [`À ${ppm} ppm, elle dérive de ${ppm} µs par seconde.`, `20 ms = 20 000 µs : divisez par ${ppm} µs/s, puis par 60.`],
          solution: `20 000 ÷ ${ppm} = ${fr(20000 / ppm)} s, soit **${fr(min, 1)} min**. Elle traverse la fenêtre du mélangeur en quelques secondes au plus : à la coupe, l'image saute.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Un duplex arrive d\'un autre stade par satellite. Comment l\'entrer au mélangeur ?',
            choices: ['Par un synchroniseur d\'images, en retardant le son d\'une image', ['En le genlockant sur le SPG du car', 'Une source extérieure ne reçoit pas la référence du car : on ne peut pas la verrouiller.'], ['Tel quel : le mélangeur réaligne tout', 'La fenêtre du mélangeur ne fait que ± ½ ligne environ : une source libre en sort aussitôt.']], answer: 0,
            aides: ['La source ne suit pas la référence du car.', 'Un appareil reprend n\'importe quelle source, au prix d\'une image de retard au plus.'],
            solution: 'Un **synchroniseur d\'images** (frame sync) : jusqu\'à 20 ms de retard, que le son doit suivre.',
          },
          {
            type: 'choix', q: 'L\'antenne GPS du SPG est débranchée en plein direct. Que voit l\'antenne ?',
            choices: ['Rien : le SPG passe en holdover sur son oscillateur thermostaté', ['Toutes les caméras décrochent', 'Le SPG continue de fournir la référence : les appareils restent verrouillés.'], ['Une image qui roule à chaque coupe', 'La dérive en holdover est de quelques dizaines à centaines de nanosecondes par heure : invisible.']], answer: 0,
            aides: ['Le SPG ne s\'arrête pas sans GPS.', 'Son OCXO continue, avec une très faible dérive.'],
            solution: '**Rien** : le **holdover** garde la référence, à quelques dizaines ou centaines de ns par heure près. On rebranche l\'antenne, et le secours est prêt.',
          },
          {
            type: 'choix', q: 'La tuile Timing du PRISM place la CAM 4 à + 12 µs de la référence en 1080p50 ; à la coupe, l\'image saute. Que régler ?',
            choices: ['La phase H de la CCU 4, pour ramener son signal dans la fenêtre', ['La phase V, en lignes', 'L\'écart est de quelques µs, moins d\'une ligne de 17,8 µs : c\'est la phase H.'], ['Le timecode de la caméra', 'Le timecode date les images ; il ne règle aucune phase.']], answer: 0,
            aides: ['La fenêtre du mélangeur vaut ± 8,9 µs en 1080p50.', 'V se règle en lignes, H en µs.'],
            solution: 'La **phase H** de la CCU : + 12 µs sortent de la fenêtre de ± 8,9 µs ; on la ramène vers 0.',
          },
          {
            type: 'choix', q: 'Quelle référence pour les appareils HD du car, et où est son repère de temps ?',
            choices: ['Le tri-level : le passage à 0 V au milieu de l\'impulsion', ['Le black burst : le haut de la salve de couleur', 'Le black burst sert aussi, mais son repère est le front du top de synchronisation, pas la salve.'], ['Le timecode LTC : son mot de synchronisation', 'Le LTC date les images ; ce n\'est pas une référence de phase.']], answer: 0,
            aides: ['La HD a sa propre référence, symétrique.', 'Une impulsion à −300 mV puis +300 mV.'],
            solution: 'Le **tri-level** : le repère est le passage à 0 V, qui ne bouge pas si l\'amplitude varie.',
          },
          {
            type: 'ordre', q: 'Remettez dans l\'ordre le chemin de la référence, du toit du car jusqu\'à l\'entrée du mélangeur.',
            items: ['L\'antenne GPS', 'Le SPG (générateur de synchro)', 'Le distributeur (DA)', 'La CCU, verrouillée et phasée', 'L\'entrée du mélangeur, dans la fenêtre'],
            aides: ['Tout part de l\'heure des satellites.', 'La référence est distribuée en étoile, une sortie de DA par appareil.'],
            solution: 'GPS → SPG → DA → appareil (genlock et phase) → mélangeur. Le SPG est doublé d\'un secours.',
          },
        ]),
      ];
    },
  },
});
