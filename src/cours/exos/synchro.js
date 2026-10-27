// @ts-check
import { registerExos, entre, pick, fr } from '../exo.js';
import { rythmes, secondesPour, mesureTri, mesureBB, niveauLigne, reflexion, echoNs, APPAREILS, verrou, nomSortie, familleDe, avancePour, audioParImage, imagePtp, TAI_UTC } from '../synchro_calc.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « La synchro » : des timecodes à convertir, des dérives de quartz, des
// retards de câble et des fenêtres de phase à calculer, des situations du car à trancher, avec des valeurs
// tirées à chaque essai. Les chiffres sont ceux des leçons (cours/synchro.js) : timecode ST 12-1 à 25
// images/s, ≈ 5 ns par mètre de coaxial (un ordre de grandeur), lignes de 17,78 µs en 1080p50 et 35,56 µs en
// 1080i50, fenêtre du mélangeur de l'ordre de ± ½ ligne, une image de 20 ms à 50 Hz. Les exercices des six
// autres leçons (bases, signaux, distribution, SPG700, word clock, ST 2059) calculent leurs réponses avec
// cours/synchro_calc.js, le modèle de leurs manipulations.
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

// ---------------- les six leçons de la référence, du générateur et des horloges ----------------
/** un nombre à la française, signe moins typographique */
const frs = (v, d = 0) => fr(v, d).replace('-', '−');
/** les sorties de référence qu'on peut proposer à un appareil */
const SIGS = ['pal', 'ntsc', '1080i50', '1080p25', '720p50', '1080i59'];
const FMTS_BASE = [{ id: '1080i50', nom: '1080i50' }, { id: '1080p50', nom: '1080p50' }, { id: '720p50', nom: '720p50' }];
/** une question « quelle référence pour cet appareil ? » : un format accepté, deux refusés (famille, format) */
function questionReference(rnd, intro) {
  const A = pick(rnd, APPAREILS.filter((a) => a.entree === 'ref'));
  const bon = pick(rnd, A.accepte);
  const famille = pick(rnd, SIGS.filter((x) => familleDe(x) !== 50));
  const format = pick(rnd, SIGS.filter((x) => familleDe(x) === 50 && !A.accepte.includes(x)));
  return {
    type: 'choix', q: `${intro} **${A.nom}**. Quelle référence lui donnez-vous ?`,
    choices: [nomSortie(bon), [nomSortie(famille), verrou(A.id, famille).texte], [nomSortie(format), verrou(A.id, format).texte]], answer: 0,
    aides: ['Deux conditions : la famille de cadence (50 ou 59,94 Hz), puis ce que son entrée de référence accepte.', 'Un tri-level a un format ; un black burst PAL convient à beaucoup d\'appareils de la famille 50 Hz.'],
    solution: `**${nomSortie(bon)}** : ${verrou(A.id, bon).texte} Il accepte ${A.accepte.map(nomSortie).join(' ou ')}.`,
  };
}
const deuxC = (v) => String(v).padStart(2, '0');
/** des secondes du jour → HH:MM:SS */
const hms = (sec) => { const x = ((sec % 86400) + 86400) % 86400; return `${deuxC(Math.floor(x / 3600))}:${deuxC(Math.floor(x / 60) % 60)}:${deuxC(x % 60)}`; };

registerExos({
  'synchro-bases': {
    titre: 'Fréquences, phases et dérives',
    consigne: 'Deux appareils du plateau ne sont pas encore verrouillés : vous chiffrez leur dérive, ce qu\'elle coûte à la coupe et à l\'audio.',
    gen: (rnd) => {
      const a = entre(rnd, 3, 25), b = entre(rnd, 3, 25), d = a + b, m = pick(rnd, [1, 2, 5, 10]);
      const ms = d * m * 60 / 1000;
      const F = pick(rnd, FMTS_BASE), R = rythmes(F.id), dp = pick(rnd, [5, 10, 20, 40]), sec = secondesPour(dp, R.ligneUs / 2);
      const ips = pick(rnd, [25, 50, 24]), n = 48000 / ips;
      return [
        {
          type: 'nombre', unite: 'ms', answer: Math.round(ms * 1000) / 1000, tol: Math.max(0.001, ms * 0.01),
          q: `Le quartz de A est à **+${a} ppm**, celui de B à **−${b} ppm**. De combien leurs tops se sont-ils écartés au bout de **${m} min**, en ms ?`,
          pieges: [{ v: Math.round(Math.abs(a - b) * m * 60) / 1000, why: 'L\'un avance, l\'autre retarde : leurs écarts s\'ajoutent.' }, { v: d * m * 60, why: 'C\'est le résultat en µs : 1 ms = 1 000 µs.' }].filter((p) => Math.abs(p.v - ms) > ms * 0.02),
          aides: ['1 ppm, c\'est 1 µs d\'écart par seconde.', `Écart = (${a} + ${b}) ppm × ${m * 60} s, en µs, puis ÷ 1 000.`],
          solution: `${d} µs par seconde × ${m * 60} s = ${fr(d * m * 60)} µs = **${fr(ms, 2)} ms**.`,
        },
        {
          type: 'nombre', unite: 's', answer: Math.round(sec * 100) / 100, tol: Math.max(0.02, sec * 0.02),
          q: `En **${F.nom}**, deux sources libres diffèrent de **${dp} ppm**. Au bout de combien de secondes sortent-elles de la fenêtre du mélangeur (± ½ ligne) ?`,
          pieges: [{ v: Math.round(secondesPour(dp, R.ligneUs) * 100) / 100, why: 'C\'est le temps de dériver d\'une ligne entière : la fenêtre n\'en vaut que la moitié.' }],
          aides: [`Une ligne ${F.nom} dure ${fr(R.ligneUs, 2)} µs.`, `Demi-ligne ÷ ${dp} µs par seconde.`],
          solution: `${fr(R.ligneUs / 2, 2)} µs ÷ ${dp} µs/s = **${fr(sec, 2)} s** : une coupe qui saute en moins d'une minute, d'où le genlock.`,
        },
        {
          type: 'nombre', answer: n,
          q: `À **48 kHz** et **${ips} images/s**, combien d'échantillons audio dans une image ?`,
          pieges: [{ v: 48000, why: 'C\'est une seconde entière.' }, ...(ips !== 25 ? [{ v: 1920, why: 'C\'est à 25 images/s.' }] : [{ v: 960, why: 'C\'est à 50 images/s.' }])],
          aides: ['Échantillons par seconde ÷ images par seconde.', `48 000 ÷ ${ips}.`],
          solution: `48 000 ÷ ${ips} = **${fr(n)}** : un nombre entier, l'audio se cale sur l'image sans reste.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Deux caméras verrouillées sur le SPG arrivent au mélangeur avec 3 µs d\'écart, toujours le même. Est-ce une dérive ?',
            choices: ['Non : un écart de phase fixe (câble, traitement), qu\'on règle avec la phase H', ['Oui : elles n\'ont pas la même fréquence', 'Verrouillées sur la même référence, elles ont la même fréquence ; un écart qui ne bouge pas est une phase.'], ['Oui : il faut un synchroniseur d\'images', 'Un synchroniseur coûte une image de retard ; 3 µs se règlent à la phase H, et sont déjà dans la fenêtre du mélangeur.']], answer: 0,
            aides: ['Une dérive change avec le temps ; cet écart, non.', 'Fréquence : le rythme ; phase : l\'instant.'],
            solution: '**Un écart de phase** : même fréquence (genlock), un retard fixe de câble ou de traitement, réglé par la phase H.',
          },
          {
            type: 'choix', q: 'Un convertisseur audio tourne sur sa propre horloge, la console sur celle du SPG. Qu\'entend-on ?',
            choices: ['Des clics réguliers : un échantillon de temps en temps est jeté ou inventé', ['Rien : 48 kHz, c\'est 48 kHz', 'Deux horloges libres à 48 kHz ne battent jamais exactement au même rythme : quelques ppm suffisent.'], ['Un son plus aigu', 'La dérive est de quelques ppm : bien trop peu pour changer la hauteur d\'un son ; elle se traduit par des clics.']], answer: 0,
            aides: ['Deux horloges libres glissent l\'une par rapport à l\'autre.', 'Quand l\'écart atteint un échantillon, il faut en jeter ou en inventer un.'],
            solution: '**Des clics** : on met le convertisseur en horloge externe, sur le word clock du SPG.',
          },
          {
            type: 'choix', q: 'Que donne le SPG à chaque appareil vidéo, en un mot ?',
            choices: ['Une référence (black burst ou tri-level), sur laquelle il se verrouille', ['Le timecode, qui met les images en phase', 'Le timecode date les images ; il ne cale ni fréquence ni phase.'], ['L\'image du programme', 'Le SPG ne fabrique que des signaux de synchronisation (et des mires).']], answer: 0,
            aides: ['Il donne le rythme, pas l\'image.', 'Black burst ou tri-level.'],
            solution: 'Une **référence** : chacun s\'y verrouille (genlock) et règle ensuite sa phase.',
          },
        ]),
      ];
    },
  },
  'synchro-signaux': {
    titre: 'Lire une référence',
    consigne: 'À l\'oscilloscope du plateau, vous mesurez le black burst et le tri-level du générateur, puis vous choisissez la référence d\'un appareil.',
    gen: (rnd) => {
      const fmt = pick(rnd, ['1080i50', '720p50']), T = mesureTri(fmt);
      const fmt2 = pick(rnd, ['1080i50', '720p50', '1080i59']), T2 = mesureTri(fmt2), nom2 = fmt2.replace('59', '59,94');
      const std = pick(rnd, ['pal', 'ntsc']), B = mesureBB(std);
      return [
        {
          type: 'nombre', unite: 'ns', answer: Math.round(T.demiNs * 10) / 10, tol: 1,
          q: `Un tri-level **${fmt}** : chaque moitié de l'impulsion dure **${T.demi} périodes** de l'horloge de 74,25 MHz. Combien de nanosecondes ?`,
          pieges: [{ v: Math.round(T.impulsionNs * 10) / 10, why: 'C\'est l\'impulsion entière, les deux moitiés.' }],
          aides: ['Une période de 74,25 MHz dure 1 000 ÷ 74,25 ns.', `${T.demi} × ${fr(T.Tns, 2)} ns.`],
          solution: `${T.demi} × ${fr(T.Tns, 2)} ns = **${fr(T.demiNs)} ns** (≈ ${fr(T.demiNs / 1000, 2)} µs) à −300 mV, puis autant à +300 mV.`,
        },
        {
          type: 'nombre', unite: 'µs', answer: Math.round(T2.ligneUs * 100) / 100, tol: 0.02,
          q: `Une ligne de tri-level **${nom2}** compte **${fr(T2.total)} périodes** d'une horloge de ${fr(1000 / T2.Tns, 3)} MHz. Combien de µs ?`,
          pieges: [{ v: Math.round(T2.total * 1000 / 74.25) / 1000, why: 'En 59,94, l\'horloge est divisée par 1,001 : chaque période dure un peu plus.' }].filter((p) => Math.abs(p.v - T2.ligneUs) > 0.02),
          aides: ['Nombre de périodes × durée d\'une période.', `${fr(T2.total)} × ${fr(T2.Tns, 3)} ns, puis ÷ 1 000.`],
          solution: `${fr(T2.total)} × ${fr(T2.Tns, 3)} ns = **${fr(T2.ligneUs, 2)} µs**, la durée d'une ligne ${nom2}.`,
        },
        {
          type: 'nombre', unite: 'µs', answer: Math.round(B.salveUs * 100) / 100, tol: 0.02,
          q: `La salve d'un black burst **${std === 'pal' ? 'PAL' : 'NTSC'}** compte **${B.cycles} cycles** de sous-porteuse à **${fr(B.fMHz, std === 'pal' ? 8 : 6)} MHz**. Combien de µs dure-t-elle ?`,
          pieges: [{ v: Math.round(B.periodeNs * 100) / 100, why: 'C\'est la durée d\'un seul cycle, en nanosecondes.' }],
          aides: ['Un cycle dure 1 ÷ fréquence.', `${B.cycles} ÷ ${fr(B.fMHz, 3)} MHz donne des µs.`],
          solution: `${B.cycles} ÷ ${fr(B.fMHz, 3)} = **${fr(B.salveUs, 2)} µs** ; elle commence ≈ ${fr(B.salveDebutUs, 1)} µs après 0H.`,
        },
        pick(rnd, [
          questionReference(rnd, 'Au plateau, vous branchez la référence de'),
          {
            type: 'choix', q: 'Le câble affaiblit la référence d\'un quart. Laquelle garde son repère au même instant ?',
            choices: ['Le tri-level : son repère est un passage à 0 V', ['Le black burst : son top est plus long', 'Son repère est à mi-hauteur du top : il dépend de l\'amplitude reçue.'], ['Aucune', 'Un passage à zéro ne dépend pas de l\'amplitude.']], answer: 0,
            aides: ['Où est le repère de chacun ?', 'Mi-hauteur d\'un côté, passage à zéro de l\'autre.'],
            solution: 'Le **tri-level** : son repère est le passage à 0 V du front montant, qui ne bouge pas avec l\'amplitude.',
          },
        ]),
      ];
    },
  },
  'synchro-distribution': {
    titre: 'Fermer une ligne de référence',
    consigne: 'Au plateau, des appareils sont chaînés par leurs entrées bouclées : vous vérifiez les terminaisons, le niveau reçu et les échos.',
    gen: (rnd) => {
      const n = pick(rnd, [0, 2, 3]), L = niveauLigne(n), mv = Math.round(300 * L.k * 10) / 10;
      const Z = pick(rnd, [50, 37.5, 25, 150, 100]), g = Math.round(reflexion(Z) * 1000) / 1000;
      const d = entre(rnd, 2, 25), e = echoNs(d);
      const desc = n === 0 ? 'Le bouchon a été oublié : la ligne est **ouverte**' : `La ligne est fermée par **${n} charges de 75 Ω** (${n === 2 ? 'une entrée terminée en interne et le bouchon' : 'deux entrées terminées en interne et le bouchon'})`;
      return [
        {
          type: 'nombre', unite: 'mV', answer: mv, tol: 1,
          q: `Le générateur donne 300 mV de top sur une seule charge de 75 Ω. ${desc}. Quelle amplitude de top reçoit le dernier appareil ?`,
          pieges: [{ v: 300, why: '300 mV, c\'est avec une seule charge de 75 Ω : ici, le pont diviseur n\'est plus le même.' }, ...(n ? [{ v: Math.round(300 / n * 10) / 10, why: 'Le niveau ne se divise pas par le nombre de charges : c\'est un pont diviseur avec les 75 Ω du générateur.' }] : [])].filter((p) => Math.abs(p.v - mv) > 1),
          aides: ['Pont diviseur : V = 600 mV × charge ÷ (75 Ω + charge) ; à vide, rien ne chute dans le générateur.', n ? `La charge vaut 75 ÷ ${n} = ${fr(75 / n, 1)} Ω.` : 'Sans charge, tout le 600 mV « à vide » arrive.'],
          solution: n ? `Charge = ${fr(L.RL, 1)} Ω : 600 × ${fr(L.RL, 1)} ÷ (75 + ${fr(L.RL, 1)}) = **${fr(mv, 1)} mV**, soit ${fr(L.k * 100)} % du nominal : hors tolérance.` : '**600 mV** : le double du nominal, et toute l\'impulsion revient en écho (Γ = +1).',
        },
        {
          type: 'nombre', answer: g, tol: 0.005,
          q: `Un raccord de **${fr(Z, Z % 1 ? 1 : 0)} Ω** ferme une ligne de 75 Ω. Quel est le coefficient de réflexion Γ = (Z − 75) ÷ (Z + 75) ?`,
          pieges: [{ v: -g, why: 'Le signe compte : Γ est négatif quand la charge est plus faible que 75 Ω, positif quand elle est plus forte.' }].filter((p) => Math.abs(p.v - g) > 0.005),
          aides: ['Remplacez Z dans la formule.', `(${fr(Z, 1)} − 75) ÷ (${fr(Z, 1)} + 75).`],
          solution: `(${fr(Z, 1)} − 75) ÷ (${fr(Z, 1)} + 75) = **${frs(g, 3)}** : ${fr(Math.abs(g) * 100)} % de l'impulsion repart vers le générateur${g < 0 ? ', retournée' : ''}.`,
        },
        {
          type: 'nombre', unite: 'ns', answer: e,
          q: `Le premier appareil d'une chaîne bouclée est à **${d} m** de câble du bout de la ligne, laissée ouverte. Après combien de nanosecondes l'écho y repasse-t-il (≈ 5 ns par mètre) ?`,
          pieges: [{ v: d * 5, why: 'C\'est l\'aller seulement : l\'écho fait l\'aller jusqu\'au bout, puis le retour.' }],
          aides: ['L\'impulsion va jusqu\'au bout, s\'y réfléchit, et revient.', `2 × ${d} m × 5 ns.`],
          solution: `2 × ${d} × 5 = **${fr(e)} ns**${e >= 100 ? ' : autant que les fronts d\'un black burst, le front se dédouble' : ' : de l\'ordre des fronts du tri-level'}.`,
        },
        pick(rnd, [
          {
            type: 'ordre', q: 'Remettez dans l\'ordre le câblage d\'une référence en boucle sur trois appareils.',
            items: ['Relier une sortie BLACK du générateur à l\'entrée bouclée du premier appareil', 'Relier sa seconde BNC à l\'entrée bouclée de l\'appareil suivant, et ainsi de suite', 'Poser un bouchon 75 Ω sur la BNC libre du dernier appareil, et là seulement', 'Vérifier à l\'oscilloscope 300 mV de top au dernier appareil', 'Vérifier que chaque appareil affiche REF LOCK'],
            aides: ['On câble d\'abord, on termine ensuite, on vérifie à la fin.', 'Le bouchon se met une fois, au bout.'],
            solution: '1. sortie → premier appareil ; 2. de proche en proche ; 3. un bouchon au bout ; 4. 300 mV au dernier ; 5. REF LOCK partout.',
          },
          {
            type: 'choix', q: 'Pourquoi le car distribue-t-il la référence en étoile, par des DA ?',
            choices: ['Une ligne et une charge par appareil : rien à oublier, et une panne ne touche qu\'un appareil', ['Parce que la boucle est interdite en HD', 'Beaucoup d\'appareils HD ont encore une entrée bouclée.'], ['Pour économiser du câble', 'Une étoile demande plutôt plus de câble.']], answer: 0,
            aides: ['Que se passe-t-il dans une boucle si un câble est arraché ?', 'Le DA isole ses sorties les unes des autres.'],
            solution: '**En étoile**, chaque appareil a sa ligne fermée sur son entrée : pas de bouchon à oublier, une panne reste locale.',
          },
        ]),
      ];
    },
  },
  'synchro-spg': {
    titre: 'Configurer le générateur',
    consigne: 'Vous préparez le SPG700 du plateau pour une captation : référence, sorties BLACK, décalages, timecode.',
    gen: (rnd) => {
      const r = entre(rnd, 6, 24) + pick(rnd, [0, 0.5]), off = avancePour(r);
      const L = pick(rnd, [
        { q: 'Le serveur ralenti refuse le timecode du générateur, réglé à 30 i/s.', bon: 'Passer la cadence du LTC à 25 i/s', faux: [['Passer le LTC en heure programme', 'Le serveur doit parler l\'heure du jour, comme la scripte ; c\'est la cadence qui ne va pas.'], ['Changer le format de la sortie BLACK', 'La référence ne porte pas le timecode LTC : c\'est la sortie LTC qu\'il faut régler.']], why: 'un plateau européen compte 25 images par seconde ; 30 i/s ne correspond à aucune de ses machines.' },
        { q: 'En janvier, le timecode des enregistreurs a une heure d\'avance sur l\'horloge du plateau.', bon: 'Régler le fuseau de la sortie LTC sur UTC+1', faux: [['Régler la cadence du LTC à 30 i/s', 'Une heure pile d\'écart n\'est pas une affaire de cadence.'], ['Décaler la sortie BLACK d\'une image', 'Une image ne fait que 40 ms ; l\'écart est d\'une heure.']], why: 'l\'heure d\'été (UTC+2) a été laissée en hiver.' },
        { q: 'Le timecode du LTC compte depuis 00:00:00:00 au lancement de l\'enregistrement, pas l\'heure du jour.', bon: 'Passer la source du LTC en heure du jour', faux: [['Passer la cadence à 29,97 i/s', 'La cadence ne change pas l\'origine du compte.'], ['Activer Stay GenLock', 'Stay GenLock concerne la référence d\'entrée, pas le timecode.']], why: 'en heure programme, le LTC part d\'un instant choisi ; un plateau en direct travaille en heure du jour.' },
      ]);
      return [
        questionReference(rnd, 'Une sortie BLACK du SPG700 va à'),
        {
          type: 'nombre', unite: 'µs', answer: off, tol: 0.05,
          q: `Le serveur ralenti sort ses images **${fr(r, 1)} µs** après sa référence. Quel décalage donnez-vous à sa sortie BLACK, en µs (négatif pour avancer) ?`,
          pieges: [{ v: r, why: 'Un décalage positif retarde la référence : le serveur arriverait encore plus tard.' }],
          aides: ['On avance sa référence de son temps de traitement.', 'Avancer, c\'est un décalage négatif, égal au retard.'],
          solution: `**${frs(off, 1)} µs** : avancée de ${fr(r, 1)} µs, la référence fait sortir ses images en même temps que celles des autres.`,
        },
        {
          type: 'choix', q: L.q + ' Que corrigez-vous sur le générateur ?',
          choices: [L.bon, ...L.faux], answer: 0,
          aides: ['Chaque sortie LTC a une cadence, une source et un fuseau.', 'Lequel des trois explique ce symptôme ?'],
          solution: `**${L.bon}** : ${L.why}`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Le SPG700 du plateau doit être en phase avec la référence du bâtiment, qui arrive en black burst. Comment le régler ?',
            choices: ['En genlock sur son entrée bouclée, avec Stay GenLock', ['En référence interne', 'En interne, il serait le maître : sa phase n\'aurait aucun rapport avec celle du bâtiment.'], ['En reliant sa sortie BLACK 1 à la référence du bâtiment', 'C\'est son entrée genlock qui reçoit une référence ; une sortie n\'en reçoit pas.']], answer: 0,
            aides: ['Il doit suivre une référence plus haute.', 'Et ne pas sauter si elle disparaît un instant.'],
            solution: '**Genlock** sur l\'entrée bouclée (bouchon si rien n\'en repart), avec **Stay GenLock** pour ne pas sauter si la référence disparaît.',
          },
          {
            type: 'ordre', q: 'Remettez dans l\'ordre les réglages du générateur.',
            items: ['La référence d\'entrée : interne ou genlock', 'Le format de chaque sortie BLACK', 'Le décalage de chaque sortie BLACK', 'Le word clock et le DARS', 'Le timecode LTC : cadence, source, fuseau'],
            aides: ['Tout dépend d\'abord de ce que le générateur suit.', 'Le format d\'une sortie avant son décalage.'],
            solution: '1. la référence d\'entrée ; 2. les formats ; 3. les décalages ; 4. l\'audio ; 5. le timecode.',
          },
        ]),
      ];
    },
  },
  'synchro-wordclock': {
    titre: 'Caler l\'audio de l\'option son',
    consigne: 'Les étudiants de l\'option son branchent leur console et leurs convertisseurs sur le générateur du plateau : vous réglez et vérifiez l\'horloge audio.',
    gen: (rnd) => {
      const [fs, ips] = pick(rnd, [[48000, 25], [48000, 50], [48000, 24], [96000, 25], [96000, 50], [44100, 25], [44100, 50]]);
      const A = audioParImage(fs, ips);
      const n = pick(rnd, [0, 1, 2, 3]), k = niveauLigne(n), v = Math.round(k.k * 1000) / 1000;
      const ppm = pick(rnd, [5, 10, 20, 50]), sec = 1e6 / (48000 * ppm);
      return [
        {
          type: 'nombre', answer: A.moyen,
          q: `À **${fr(fs / 1000, 1)} kHz** et **${ips} images/s**, combien d'échantillons par image ?`,
          pieges: [{ v: fs, why: 'C\'est une seconde entière.' }],
          aides: ['Échantillons par seconde ÷ images par seconde.', `${fr(fs)} ÷ ${ips}.`],
          solution: `${fr(fs)} ÷ ${ips} = **${fr(A.moyen)}** échantillons par image, un nombre entier.`,
        },
        {
          type: 'nombre', unite: 'V', answer: v, tol: 0.01,
          q: `La sortie word clock est réglée en **1 V sur 75 Ω** (générateur adapté : 1 V crête à crête sur une seule charge de 75 Ω). ${n === 0 ? 'La ligne est laissée **ouverte**' : `Elle est fermée par **${n} charge${n > 1 ? 's' : ''} de 75 Ω**`}. Combien de volts crête à crête reçoit le bout ?`,
          pieges: [{ v: 1, why: '1 V, c\'est sur une seule charge de 75 Ω.' }].filter((p) => Math.abs(p.v - v) > 0.01),
          aides: ['Pont diviseur : 2 V à vide derrière 75 Ω.', n ? `2 × (75 ÷ ${n}) ÷ (75 + 75 ÷ ${n}).` : 'Sans charge, rien ne chute dans les 75 Ω du générateur.'],
          solution: `**${fr(v, 2)} V** crête à crête${n === 1 ? '' : n === 0 ? ', avec des rebonds sur chaque front' : ', trop peu pour beaucoup d\'entrées'} ; centré sur 0 V, il ne monte qu'à ${fr(v / 2, 2)} V : une entrée TTL n'y voit rien. Pour la section son : 5 V.`,
        },
        {
          type: 'nombre', unite: 's', answer: Math.round(sec * 100) / 100, tol: Math.max(0.02, sec * 0.02),
          q: `Un convertisseur libre et la console diffèrent de **${ppm} ppm** à 48 kHz. Tous les combien de secondes faut-il jeter ou inventer un échantillon (un clic) ?`,
          pieges: [{ v: Math.round(1e6 / ppm) / 1e6, why: 'Comptez en échantillons : à 48 kHz, l\'écart est de 48 000 × ppm × 10⁻⁶ échantillon par seconde.' }],
          aides: [`À ${ppm} ppm, l'écart est de 48 000 × ${ppm} ÷ 1 000 000 échantillon par seconde.`, 'Un échantillon de retard est atteint au bout de 1 ÷ cet écart secondes.'],
          solution: `48 000 × ${ppm} × 10⁻⁶ = ${fr(48000 * ppm / 1e6, 2)} échantillon par seconde : un clic toutes les **${fr(sec, 2)} s**. D'où l'horloge externe.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'La console de l\'option son a une entrée word clock TTL. À quel niveau réglez-vous la sortie du SPG700 ?',
            choices: ['5 V', ['1 V sur 75 Ω', 'Centré sur 0 V, ce signal ne monte qu\'à +0,5 V : une entrée TTL attend un haut au-dessus de 2,4 V.'], ['Le plus bas possible, pour ne pas abîmer l\'entrée', 'Une entrée TTL est faite pour 5 V ; trop bas, elle ne voit aucun front.']], answer: 0,
            aides: ['Une entrée TTL : bas sous 0,4 V, haut au-dessus de 2,4 V.', 'Le réglage qui marche presque partout.'],
            solution: '**5 V** : un haut bien au-dessus de 2,4 V. On ne passe en 1 V que si la notice de l\'appareil le demande.',
          },
          {
            type: 'choix', q: 'Qui est le maître de l\'horloge audio quand l\'option son travaille avec la vidéo du plateau ?',
            choices: ['Le SPG, dont le word clock est calé sur la référence vidéo', ['La console son', 'Maître, la console imposerait un 48 kHz sans lien avec la vidéo : le son glisserait par rapport aux images.'], ['Chaque appareil, en interne', 'Des horloges libres glissent : des clics.']], answer: 0,
            aides: ['L\'audio doit tomber juste sur les images.', '1 920 échantillons par image à 25 i/s.'],
            solution: 'Le **SPG** : son word clock vient de la même horloge que la référence vidéo. La console et les convertisseurs se mettent en externe.',
          },
          {
            type: 'choix', q: 'Trois appareils de l\'option son sont chaînés en T sur le word clock. Où se met la terminaison 75 Ω ?',
            choices: ['Une seule, au bout de la chaîne', ['Une sur chaque appareil', 'Chaque charge en plus fait baisser le niveau.'], ['Aucune', 'Sans terminaison, les fronts rebondissent : de la gigue, de faux fronts.']], answer: 0,
            aides: ['Comme une référence vidéo.', 'Une ligne 75 Ω se ferme une fois.'],
            solution: '**Une seule**, au bout ; les entrées du milieu en haute impédance (ou une étoile par un DA).',
          },
        ]),
      ];
    },
  },
  'synchro-2059': {
    titre: 'L\'heure PTP et la phase des images',
    consigne: 'Dans le car hybride, une passerelle IP lit l\'heure PTP du grand maître : vous calculez, comme elle, l\'image en cours et l\'heure du jour.',
    gen: (rnd) => {
      const S = entre(rnd, 100, 9999), ms = entre(rnd, 1, 999), c = pick(rnd, [25, 50]);
      const t = S + ms / 1000, I = imagePtp(t, c, 1);
      const per = 1000 / c, dans = ms % per;
      const h = entre(rnd, 6, 21), m = entre(rnd, 0, 59), s = entre(rnd, 0, 59), fus = pick(rnd, [1, 2]);
      const base = h * 3600 + m * 60 + s;
      const tai = hms(base), utc = hms(base - TAI_UTC), loc = hms(base - TAI_UTC + fus * 3600);
      return [
        {
          type: 'nombre', answer: I.n, brut: true,
          q: `L'heure PTP est **${fr(S)},${String(ms).padStart(3, '0')} s** depuis l'origine SMPTE. À **${c} images/s**, quel est le numéro de l'image en cours ?`,
          pieges: [{ v: S, why: 'C\'est le nombre de secondes : il y a plusieurs images par seconde.' }, { v: I.n + 1, why: 'C\'est l\'image suivante, qui n\'a pas encore commencé.' }],
          aides: ['n = partie entière de (t × cadence).', `${fr(S)},${String(ms).padStart(3, '0')} × ${c}, sans les décimales.`],
          solution: `${fr(t, 3)} × ${c} = ${fr(t * c, 3)} : image n° **${I.n}**.`,
        },
        {
          type: 'nombre', unite: 'ms', answer: dans,
          q: `Toujours à **${c} images/s** et à ${fr(S)},${String(ms).padStart(3, '0')} s : depuis combien de millisecondes cette image a-t-elle commencé ?`,
          pieges: [{ v: per - dans, why: 'C\'est le temps qui reste avant la prochaine image.' }].filter((p) => p.v !== dans),
          aides: [`Une image dure ${fr(per)} ms ; toutes partent de l'origine.`, `Reste de ${ms} ms ÷ ${fr(per)} ms.`],
          solution: `${ms} ms = ${Math.floor(ms / per)} × ${fr(per)} ms + **${fr(dans)} ms** : la prochaine image commence dans ${fr(per - dans)} ms.`,
        },
        {
          type: 'texte', placeholder: 'HH:MM:SS', forme: 'ip', accept: [loc],
          q: `Le grand maître donne l'heure du jour **${tai}** en TAI. Quelle heure légale affiche le timecode, en France, à **UTC+${fus}** (TAI − UTC = ${TAI_UTC} s) ?`,
          pieges: [{ v: utc, why: 'C\'est l\'heure UTC : il faut encore ajouter le fuseau.' }, { v: hms(base + fus * 3600), why: 'Il faut aussi retirer les 37 secondes intercalaires : PTP compte en TAI.' }].filter((p) => p.v !== loc),
          aides: ['TAI → UTC : retirez 37 s.', `UTC → heure légale : ajoutez ${fus} h.`],
          solution: `${tai} − 37 s = ${utc} UTC, + ${fus} h = **${loc}**.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Dans un car hybride, d\'où viennent la référence black burst des CCU et l\'heure PTP des appareils IP ?',
            choices: ['Du même générateur, calé sur le GPS : black burst, tri-level et PTP de grand maître', ['De deux générateurs indépendants, l\'un SDI, l\'autre IP', 'Sans horloge commune, les deux mondes dériveraient : les passerelles sauteraient.'], ['Le PTP vient du black burst, par une passerelle', 'Le grand maître PTP tire son heure de la même horloge que les références, pas d\'un black burst.']], answer: 0,
            aides: ['Une seule horloge pour tout le car.', 'ST 2059-1 relie l\'heure PTP au top de la référence.'],
            solution: 'Un **même générateur**, calé sur le GPS, sort les références analogiques et l\'heure PTP : les deux mondes sont en phase.',
          },
          {
            type: 'choix', q: 'Que fixe SMPTE ST 2059-1 ?',
            choices: ['L\'origine des temps (1970, TAI) et le calcul de la phase des images, du son et du timecode', ['Le profil PTP du broadcast (domaine, messages)', 'C\'est ST 2059-2.'], ['Le format des paquets vidéo', 'C\'est ST 2110-20.']], answer: 0,
            aides: ['Deux parties : -1 et -2.', 'L\'une dit comment passer d\'une heure à une image.'],
            solution: '**ST 2059-1** : l\'origine SMPTE et la règle de phase ; ST 2059-2 : le profil PTP.',
          },
        ]),
      ];
    },
  },
});
