// @ts-check
import { registerExos, entre, pick, tirer, fr as frn } from '../exo.js';
import { dbuVolt, ECART_PRO_CONSO, sommeDb, splA, attenuationDb, canonDb, angleEnregistrement, COUPLES, perteAdaptation, residuModeCommun, compresseur, loudnessIntegre, normaliser, debitPcm, dynamiqueDb, debitAes3, canauxMadi, latenceTampon, deriveEchantillons } from '../son_calc.js';

/** un niveau négatif écrit avec le signe moins typographique */
const fr = (v, d = 0) => frn(v, d).replace('-', '−');

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « Le son » : régler un gain d'entrée pour des crêtes entre −18 et
// −10 dBFS, prévoir l'écrêtage au-delà de 0 dBFS, lire un fader en rapport d'amplitude (20 log10),
// remettre la tranche dans l'ordre ; retarder le son d'autant d'images que l'image (20 ms en 1080p50,
// 40 ms en 1080i50), juger un décalage selon l'EBU R37 (40 ms d'avance, 60 ms de retard au plus de
// bout en bout), composer un N-1. Chiffres des leçons (cours/son.js). Depuis la v19.26, les bases et le
// traitement (cours/son_calc.js) : décibels et références, directivité et canon, couples stéréo (écarts,
// angle d'enregistrement, MS), niveaux et liaisons, compresseur, loudness, audio numérique.
// ----------------------------------------------------------------------------------
const FORMATS = [{ nom: '1080p50', ms: 20 }, { nom: '1080i50', ms: 40 }];
// les sources et la règle des départs (leçon N-1, synchro labiale et départs)
const SRC = [
  { name: 'COMM 1', voice: 'comm' }, { name: 'COMM 2', voice: 'comm' },
  { name: 'AMBIANCES', voice: '' }, { name: 'CANONS', voice: '' },
  { name: 'STUDIO', voice: 'studio' }, { name: 'BORD TERRAIN', voice: 'bt' },
];
const DEP = [
  { name: 'N-1 COMM', listener: 'comm', who: 'les commentateurs', du: 'des commentateurs', leur: 'leur' },
  { name: 'N-1 STUDIO', listener: 'studio', who: 'le présentateur en studio', du: 'du présentateur en studio', leur: 'lui' },
  { name: 'N-1 BT', listener: 'bt', who: 'la journaliste bord terrain', du: 'de la journaliste bord terrain', leur: 'lui' },
];
const TRANCHE = [
  {
    type: 'choix', q: 'Le canon du bord terrain, un micro statique, ne donne rien : ni crête, ni souffle. Que vérifiez-vous d\'abord sur sa tranche ?',
    choices: ['L\'alimentation fantôme 48 V', ['Le fader, à monter', 'Un fader ne dose qu\'un signal qui existe : sans rien en entrée, il n\'y a rien à doser.'], ['La polarité (Ø)', 'Une polarité inversée change le signe du signal, elle ne le fait pas disparaître sur une voie seule.']], answer: 0,
    aides: ['Un micro statique, à condensateur, a besoin de quelque chose que la console lui envoie.', 'P48, sur les deux conducteurs de modulation.'],
    solution: 'Le **48 V** : sans alimentation fantôme, un micro statique ne délivre rien.',
  },
  {
    type: 'choix', q: 'Le couple d\'ambiance sonne bien en stéréo, mais se creuse et perd son corps quand on l\'écoute en mono. Le corrélateur est sous 0. Que corrigez-vous ?',
    choices: ['La polarité d\'une des deux voies (touche Ø)', ['Le gain des deux voies', 'Le niveau ne change rien à une opposition de phase : la partie commune continue de s\'annuler.'], ['L\'égaliseur, en ajoutant des graves', 'C\'est l\'addition des deux voies qui s\'annule : aucun égaliseur ne la rattrape.']], answer: 0,
    aides: ['Un corrélateur sous 0 dit que les deux voies vont en sens opposés.', 'Une voie a changé de signe.'],
    solution: 'La **polarité** : une voie inversée annule la partie commune en mono ; rétablie, le corrélateur remonte vers +1.',
  },
  {
    type: 'choix', q: 'Le canon de la CAM 5 allume l\'OVL rouge sur chaque frappe. L\'assistant propose de baisser son fader. Qu\'en pensez-vous ?',
    choices: ['Non : il faut baisser le gain d\'entrée, le fader ne répare pas un écrêtage', ['Oui : le son sera moins fort, donc propre', 'Baisser le fader d\'un micro écrêté donne un son écrêté moins fort : les crêtes sont déjà coupées à la conversion.'], ['Oui, et couper le 48 V', 'Sans 48 V, le canon ne délivre plus rien du tout.']], answer: 0,
    aides: ['Où se produit l\'écrêtage : avant ou après le fader ?', 'Le convertisseur ne sait pas écrire au-delà de 0 dBFS.'],
    solution: 'Baisser le **gain** : l\'écrêtage se produit au convertisseur, avant le fader.',
  },
];
/** les choix faux de la question du PAD, selon que l'écart tient ou non dans la tolérance */
/** @type {(ecart: number) => [string, string][]} */
const fauxPad = (ecart) => (ecart <= 0.5
  ? [['Non : il faut exactement −23,0 LUFS', 'La R128 admet ±0,5 LU sur un PAD (±1 LU en direct).'], ['Non : la crête vraie est forcément dépassée', 'La crête vraie se mesure à part ; un petit écart de loudness ne dit rien d\'elle.']]
  : [['Oui : la tolérance est de ±1 LU', '±1 LU est la tolérance du direct ; un PAD doit tenir ±0,5 LU.'], ['Oui, si l\'on recompresse', 'Il ne manque pas de compression, mais un gain : on ne touche pas au mélange.']]);
const DEPARTS = [
  {
    type: 'choix', q: 'À l\'antenne, la chaîne diffuse l\'ambiance du stade sans aucun commentaire. Le plan de son demande la paire 1 en programme, la paire 2 en international. Que s\'est-il passé ?',
    choices: ['Les paires 1 et 2 sont inversées dans l\'embedder du départ', ['Les commentateurs ne sont pas dans leur N-1', 'Le N-1 est le retour des commentateurs ; il ne change pas ce que diffuse la chaîne.'], ['Le retard de ligne est trop long', 'Un retard décale le son, il n\'enlève pas les voix.']], answer: 0,
    aides: ['Le son sans voix, c\'est l\'international.', 'Regardez quelle paire porte quoi au départ.'],
    solution: 'Les **paires sont inversées** : l\'international (sans voix) est parti sur la paire du programme. On vérifie chaque paire au départ, et au test de ligne.',
  },
  {
    type: 'choix', q: 'Où le talkback (micro d\'ordres) de la régie doit-il partir ?',
    choices: ['Dans les N-1, jamais dans le programme', ['Dans le programme, pour que tout le monde l\'entende', 'Les ordres de la régie ne doivent jamais être à l\'antenne.'], ['Dans le son international', 'L\'international part aux diffuseurs étrangers : rien de la régie n\'y va.']], answer: 0,
    aides: ['Qui doit entendre les ordres ? Et qui ne doit surtout pas ?', 'Les retours de ceux qui parlent à l\'antenne.'],
    solution: 'Dans les **N-1** : les commentateurs et le studio entendent la régie ; le programme ne l\'entend jamais.',
  },
];

registerExos({
  'son-tranche': {
    titre: 'Régler une tranche',
    consigne: 'En cabine son, avant l\'antenne : vous réglez le gain de chaque micro, vous prévoyez ce qui va écrêter et vous corrigez les tranches en défaut.',
    gen: (rnd) => {
      const mic = -entre(rnd, 45, 60), cible = pick(rnd, [-18, -16, -14, -12, -10]), g = cible - mic;
      const c0 = pick(rnd, [-18, -16, -14, -12]), plus = entre(rnd, 6, 24), c1 = c0 + plus;
      const f = pick(rnd, [6, 12, 20]), r = 10 ** (f / 20);
      return [
        {
          type: 'nombre', unite: 'dB', answer: g, tol: 0.5,
          q: `Avec un gain de 0 dB, la frappe du ballon dans le canon de la CAM ${entre(rnd, 1, 8)} donne une crête à **${fr(mic)} dBFS**. Quel gain d'entrée pour placer cette crête à **${fr(cible)} dBFS** ?`,
          pieges: [{ v: -g, why: 'Le gain monte le niveau : il faut ajouter des décibels, pas en retirer.' }, { v: -mic, why: 'Avec ce gain, la crête arriverait à 0 dBFS : plus aucune marge.' }],
          aides: ['Le gain ajoute ses décibels au niveau du micro.', `Gain = ${fr(cible)} − (${fr(mic)}).`],
          solution: `${fr(cible)} − (${fr(mic)}) = **${g} dB**. La crête est à ${fr(cible)} dBFS : ${-cible} dB de marge avant l'écrêtage, pour un tir plus fort.`,
        },
        {
          type: 'nombre', unite: 'dBFS', answer: c1,
          q: `Les crêtes d'un micro sont réglées à **${fr(c0)} dBFS**. Un tir arrive **${plus} dB plus fort** que d'habitude. À combien de dBFS arriverait sa crête (si rien ne l'arrêtait) ?`,
          aides: ['Un écart en décibels s\'ajoute au niveau de départ.', `Crête = ${fr(c0)} dBFS + ${plus} dB ; comparez à 0 dBFS.`],
          solution: `${fr(c0)} + ${plus} = **${c1 > 0 ? '+' : ''}${fr(c1)} dBFS** : ${c1 > 0 ? 'au-delà de 0 dBFS, la crête est écrêtée (OVL), et aucun fader ne la réparera' : c1 === 0 ? 'pile à la pleine échelle : plus aucune marge, le moindre surplus écrête' : 'encore sous 0 dBFS : la marge a suffi'}.`,
        },
        {
          type: 'nombre', answer: Math.round(r * 100) / 100, tol: Math.max(0.05, r * 0.02),
          q: `On baisse le fader de **${f} dB**. Par combien l'amplitude du signal est-elle divisée ? (un écart en dB vaut 20 × log₁₀ du rapport d'amplitudes)`,
          pieges: [{ v: f / 20, why: 'Il faut passer par la puissance de 10 : rapport = 10^(dB ÷ 20).' }, { v: Math.round(10 ** (f / 10) * 100) / 100, why: 'C\'est le rapport en puissance (10 log₁₀) ; pour une amplitude, c\'est 20 log₁₀.' }],
          aides: ['Inversez la formule : rapport = 10 puissance (dB ÷ 20).', `10^(${f} ÷ 20).`],
          solution: `10^(${f} ÷ 20) = **${fr(r, 2)}**${f === 6 ? ' : −6 dB, c\'est à peu près l\'amplitude divisée par deux' : f === 20 ? ' : −20 dB, l\'amplitude divisée par dix' : ''}.`,
        },
        pick(rnd, [...TRANCHE, {
          type: 'ordre', q: 'Remettez dans l\'ordre les réglages d\'une tranche.',
          items: ['Gain, 48 V et polarité, en écoutant la source seule (PFL)', 'Passe-haut, égaliseur, dynamique', 'Le fader, qui dose la source dans le mélange', 'Les envois, qui la dirigent vers les bus'],
          aides: ['Le premier réglage est le plus important : celui qui adapte le micro à la console.', 'Le fader ne vient qu\'après les traitements.'],
          solution: '1. Gain, 48 V, polarité (en PFL) ; 2. passe-haut, égaliseur, dynamique ; 3. le fader ; 4. les envois vers les bus.',
        }]),
      ];
    },
  },
  'son-n1': {
    titre: 'Les départs et la synchro labiale',
    consigne: 'En cabine son, onglet « Bus, N-1, départ » : vous calez le retard du son sur celui de l\'image, vous jugez un décalage et vous composez les retours des commentateurs.',
    gen: (rnd) => {
      const F = pick(rnd, FORMATS), n = entre(rnd, 1, 6), autre = FORMATS.find((x) => x !== F) || F;
      const [sens, ms] = pick(rnd, [['avance', 20], ['avance', 35], ['avance', 50], ['avance', 80], ['retard', 30], ['retard', 50], ['retard', 70], ['retard', 120]]);
      const ok = sens === 'avance' ? ms <= 40 : ms <= 60;
      const D = pick(rnd, DEP);
      const exclus = SRC.filter((s) => s.voice === D.listener), gardes = SRC.filter((s) => s.voice !== D.listener);
      const bon = pick(rnd, exclus), autres = tirer(rnd, gardes, 2);
      const R37 = ['Dans la tolérance de l\'EBU R37', 'Hors tolérance : le son est trop en avance', 'Hors tolérance : le son est trop en retard'];
      const juste = ok ? 0 : sens === 'avance' ? 1 : 2;
      return [
        {
          type: 'nombre', unite: 'ms', answer: n * F.ms,
          q: `Le car est en **${F.nom}**. L'image de la caméra HF arrive avec **${n} image${n > 1 ? 's' : ''}** de retard sur son son. Quel retard de ligne donnez-vous au son, en millisecondes ?`,
          pieges: [{ v: n * autre.ms, why: `C'est la durée de ${n} image${n > 1 ? 's' : ''} en ${autre.nom} : en ${F.nom}, une image dure ${F.ms} ms.` }].filter((p) => p.v !== n * F.ms),
          aides: ['On retarde le son exactement du retard de l\'image.', `En ${F.nom}, une image dure ${F.ms} ms.`],
          solution: `${n} × ${F.ms} = **${n * F.ms} ms** : le son retombe sur les lèvres.`,
        },
        {
          type: 'choix', q: `Au bout de la chaîne, le son est **${ms} ms en ${sens}** sur l'image. Qu'en dit l'EBU R37 ?`,
          choices: R37.map((t, k) => (k === juste ? t : [t, `De bout en bout, l'EBU R37 tolère un son en avance de 40 ms au plus et en retard de 60 ms au plus : ${ms} ms en ${sens}, c'est ${ok ? 'dedans' : 'dehors'}.`])), answer: juste,
          aides: ['La tolérance n\'est pas la même dans les deux sens.', 'De bout en bout : 40 ms d\'avance au plus, 60 ms de retard au plus.'],
          solution: `**${R37[juste]}** : la R37 tolère 40 ms d'avance et 60 ms de retard de bout en bout. Le son en avance se remarque plus vite : dans la nature, la lumière arrive toujours avant le son.`,
        },
        {
          type: 'choix', q: `Le **${D.name}** est le retour ${D.du}. Quelle source ne doit pas y figurer ?`,
          choices: [bon.name, ...autres.map((s) => [s.name, `${s.name} reste dans le ${D.name} : seule la voix de celui qui l'écoute en est retirée.`])], answer: 0,
          aides: ['Un N-1, c\'est « tout sauf moi ».', `Quelle source porte la voix ${D.du} ?`],
          solution: `**${bon.name}** : le ${D.name} est le programme moins la voix ${D.du}, qui ${D.leur} reviendrait retardée, en écho.`,
        },
        pick(rnd, DEPARTS),
      ];
    },
  },
  // ---------------- les bases (v19.26) ----------------
  'son-decibel': {
    titre: 'Compter en décibels',
    consigne: 'Avant le test de ligne, le chef de car vous fait vérifier les niveaux : des tensions à convertir, des sources à additionner, une distance à estimer.',
    gen: (rnd) => {
      const dbu = pick(rnd, [-50, -40, -20, -10, 0, 4, 18, 24]), v = dbuVolt(dbu);
      const n = pick(rnd, [2, 3, 4]), base = pick(rnd, [94, 100, 104, 110]), corr = rnd() < 0.5;
      const s = sommeDb(Array(n).fill(base), corr);
      const d1 = pick(rnd, [1, 2, 4]), d2 = d1 * pick(rnd, [2, 4, 8]), l1 = pick(rnd, [90, 96, 100, 106]);
      const ecart = pick(rnd, [6, 12, 20, 40]);
      return [
        {
          type: 'nombre', unite: dbu >= 0 ? 'V' : 'mV', answer: dbu >= 0 ? Math.round(v * 1000) / 1000 : Math.round(v * 1000 * 100) / 100, tol: dbu >= 0 ? 0.01 : Math.max(0.05, v * 1000 * 0.01),
          q: `Quelle tension correspond à **${fr(dbu)} dBu** ? (réponse en ${dbu >= 0 ? 'volts' : 'millivolts'})`,
          pieges: dbu !== 0 ? [{ v: dbu >= 0 ? Math.round(10 ** (dbu / 20) * 1000) / 1000 : Math.round(10 ** (dbu / 20) * 1000 * 100) / 100, why: 'C\'est le résultat pour une référence de 1 V (dBV). Le dBu prend 0,775 V pour 0.' }] : [],
          aides: ['0 dBu = 0,775 V ; chaque +20 dB multiplie la tension par 10, chaque +6 dB par 2.', `Tension = 0,775 × 10^(${fr(dbu)} ÷ 20).`],
          solution: `0,775 × 10^(${fr(dbu)} ÷ 20) = **${dbu >= 0 ? fr(v, 3) + ' V' : fr(v * 1000, 2) + ' mV'}**${dbu === 4 ? ' : le niveau ligne professionnel' : dbu === -50 ? ' : un niveau micro, qu\'un préampli remonte de 50 dB' : ''}.`,
        },
        {
          type: 'nombre', unite: 'dB SPL', answer: Math.round(s * 10) / 10, tol: 0.3,
          q: `${n} sources ${corr ? '**identiques** (le même signal, en phase)' : '**indépendantes** (des micros différents)'} de **${base} dB SPL** chacune sont additionnées. Quel niveau total ?`,
          pieges: [{ v: Math.round(sommeDb(Array(n).fill(base), !corr) * 10) / 10, why: corr ? 'C\'est la somme de sources indépendantes (puissances, 10 log). Le même signal additionné n fois ajoute ses amplitudes : 20 log n.' : 'C\'est la somme de signaux identiques (amplitudes, 20 log). Des sources indépendantes additionnent leurs puissances : 10 log n.' }, { v: base * n, why: 'Les décibels ne s\'additionnent pas : on repasse en linéaire, on additionne, on revient en dB.' }],
          aides: [corr ? 'Des signaux identiques additionnent leurs amplitudes.' : 'Des sources indépendantes additionnent leurs puissances.', `Gain = ${corr ? '20' : '10'} × log₁₀(${n}).`],
          solution: `${corr ? '20' : '10'} × log₁₀(${n}) = +${fr(s - base, 1)} dB : **${fr(s, 1)} dB SPL**.`,
        },
        {
          type: 'nombre', unite: 'dB SPL', answer: Math.round(splA(l1, d1, d2) * 10) / 10, tol: 0.3,
          q: `Un canon reçoit un joueur à **${l1} dB SPL** à **${d1} m**. Quel niveau à **${d2} m**, en champ libre ?`,
          pieges: [{ v: Math.round((l1 - 3 * Math.log2(d2 / d1)) * 10) / 10, why: '−3 dB par doublement, c\'est la puissance divisée par deux. La pression suit 1/d : −6 dB par doublement de distance.' }],
          aides: ['En champ libre, la pression décroît de 6 dB à chaque doublement de la distance.', `Niveau = ${l1} − 20 × log₁₀(${d2} ÷ ${d1}).`],
          solution: `${l1} − 20 log₁₀(${d2 / d1}) = **${fr(splA(l1, d1, d2), 1)} dB SPL** : ${Math.log2(d2 / d1)} doublement${Math.log2(d2 / d1) > 1 ? 's' : ''}, ${Math.log2(d2 / d1) * 6} dB de moins.`,
        },
        {
          type: 'nombre', answer: Math.round(10 ** (ecart / 20) * 100) / 100, tol: Math.max(0.05, 10 ** (ecart / 20) * 0.02),
          q: `Une tension monte de **${ecart} dB**. Par combien est-elle multipliée ?`,
          pieges: [{ v: Math.round(10 ** (ecart / 10) * 100) / 100, why: 'C\'est le rapport en puissance (10 log). Pour une tension, c\'est 20 log : rapport = 10^(dB ÷ 20).' }],
          aides: ['+6 dB double la tension, +20 dB la multiplie par 10.', `Rapport = 10^(${ecart} ÷ 20).`],
          solution: `10^(${ecart} ÷ 20) = **× ${fr(10 ** (ecart / 20), 2)}**.`,
        },
      ];
    },
  },
  'son-micros': {
    titre: 'Choisir et pointer un micro',
    consigne: 'Au bord du terrain, vous placez les canons et les couples : il faut prévoir ce que chaque micro rejette, et choisir le bon pour chaque situation.',
    gen: (rnd) => {
      const theta = pick(rnd, [60, 90, 120, 150]), pat = pick(rnd, [{ id: 'cardio', a: 0.5, nom: 'cardioïde' }, { id: 'hyper', a: 0.25, nom: 'hypercardioïde' }]);
      const att = attenuationDb(pat.a, theta);
      const fA = pick(rnd, [200, 300]), fB = pick(rnd, [6000, 8000, 10000]), ang = pick(rnd, [60, 90]);
      /** @type {Array<{ q: string, ok: string, faux: [string, string][] }>} */
      const situations = [
        { q: 'Le commentateur, micro-casque à 2 cm de la bouche, dans une cabine ouverte sur le stade.', ok: 'Un cardioïde (dynamique ou statique), bonnette, passe-haut contre l\'effet de proximité', faux: [['Un omni statique', 'L\'omni prend la foule de partout, et de très près l\'effet de proximité n\'est pas son problème : c\'est la foule qui l\'est.'], ['Un canon', 'Un canon sur un micro-casque n\'existe pas, et de si près sa directivité n\'apporte rien.']] },
        { q: 'Les frappes et les contacts, le long de la touche, à 5 à 10 m du jeu.', ok: 'Des canons statiques (48 V), sous bonnette à poils', faux: [['Des micros main dynamiques', 'Trop peu sensibles et trop peu directifs à cette distance : on n\'entendrait que la foule.'], ['Des omnis', 'Un omni à 8 m du jeu ne capte que le stade.']] },
        { q: 'L\'ambiance de la tribune, pour le son international.', ok: 'Un couple de statiques (ORTF ou XY) face au terrain', faux: [['Un seul canon pointé sur la foule', 'Un canon fait un point, pas une ambiance : il manque la largeur et la stéréo.'], ['Le micro-casque d\'un commentateur', 'Sa voix est précisément ce que le son international ne doit pas contenir.']] },
        { q: 'La journaliste qui court le long de la touche avec un émetteur HF.', ok: 'Un micro main dynamique cardioïde', faux: [['Un canon statique sur perche', 'Encombrant, fragile et trop directif pour une interview en mouvement.'], ['Un micro-cravate omni', 'Il capterait toute la foule au niveau de sa voix ; et l\'interviewé ne serait pas dedans.']] },
      ];
      const S = pick(rnd, situations);
      const chs = [S.ok, ...S.faux];
      return [
        {
          type: 'nombre', unite: 'dB', answer: Math.round(att * 10) / 10, tol: 0.4,
          q: `Un micro **${pat.nom}** reçoit la foule à **${theta}°** de son axe. De combien l'atténue-t-il ? (diagramme a + (1 − a) cos θ, a = ${pat.a}) Réponse négative.`,
          pieges: [{ v: Math.round(-att * 10) / 10, why: 'Une atténuation s\'écrit en négatif : le niveau baisse.' }, { v: Math.round(attenuationDb(pat.id === 'cardio' ? 0.25 : 0.5, theta) * 10) / 10, why: `C'est l'autre diagramme (a = ${pat.id === 'cardio' ? '0,25' : '0,5'}).` }],
          aides: [`Calculez d'abord ρ = ${pat.a} + ${1 - pat.a} × cos ${theta}°.`, 'Puis 20 × log₁₀ |ρ|.'],
          solution: `ρ = ${pat.a} + ${1 - pat.a} × cos ${theta}° = ${fr(Math.abs(pat.a + (1 - pat.a) * Math.cos(theta * Math.PI / 180)), 3)} ; 20 log₁₀ = **${fr(att, 1)} dB**.`,
        },
        {
          type: 'choix', q: `Un canon de 25 cm reçoit la foule à ${ang}°. Entre ${fA} Hz et ${fB / 1000} kHz, laquelle rejette-t-il le mieux ?`,
          choices: [`${fB / 1000} kHz : le tube n'agit que dans l'aigu`, [`${fA} Hz : le grave est plus facile à rejeter`, `À ${fA} Hz, la longueur d'onde (${fr(343 / fA, 1)} m) est longue devant le tube : il n'agit pas, et le canon n'est qu'un hypercardioïde (${fr(canonDb(ang, fA), 1)} dB).`], ['Les deux pareil : la directivité ne dépend pas de la fréquence', `Le tube à interférence ne resserre que les longueurs d'onde courtes devant lui : ${fr(canonDb(ang, fA), 1)} dB à ${fA} Hz contre ${fr(canonDb(ang, fB), 1)} dB à ${fB / 1000} kHz.`]], answer: 0,
          aides: ['Comparez la longueur d\'onde (343 ÷ f) à la longueur du tube.', `À ${fA} Hz, λ = ${fr(343 / fA, 1)} m ; à ${fB / 1000} kHz, λ = ${fr(343 / fB * 100, 1)} cm.`],
          solution: `Le tube n'agit que pour les longueurs d'onde courtes devant lui : **${fB / 1000} kHz** (${fr(canonDb(ang, fB), 1)} dB) ; à ${fA} Hz, ${fr(canonDb(ang, fA), 1)} dB seulement. La foule grave entre quand même.`,
        },
        {
          type: 'choix', q: `${S.q} Quel micro ?`,
          choices: chs, answer: 0,
          aides: ['Demandez-vous ce qu\'il ne faut surtout pas entendre.', 'Statique = fin et directif mais fragile ; dynamique = robuste ; omni = tout autour.'],
          solution: `**${S.ok}.**`,
        },
        pick(rnd, [
          { type: 'choix', q: 'Un canon statique ne donne ni signal ni souffle. Première vérification ?', choices: ['L\'alimentation fantôme 48 V', ['Le fader', 'Sans signal à l\'entrée, le fader n\'a rien à doser.'], ['La bonnette', 'La bonnette ne coupe que le vent, pas le signal.']], answer: 0, aides: ['Un statique a besoin de quelque chose que la console lui envoie.', 'P48, sur la touche 48V de la tranche.'], solution: 'Le **48 V** : un micro statique sans alimentation fantôme reste muet.' },
          { type: 'choix', q: 'Un chanteur au micro hypercardioïde ; où placer le retour de scène pour éviter le larsen ?', choices: ['Vers 110 à 125° : les angles morts de l\'hypercardioïde', ['Juste derrière, à 180°', 'L\'hypercardioïde a un petit lobe arrière (−12 dB) : ce n\'est pas son angle mort.'], ['Devant, sous le micro', 'Devant, c\'est l\'axe du micro : le retour entrerait en plein.']], answer: 0, aides: ['Chaque diagramme a ses angles morts ; ceux de l\'hypercardioïde ne sont pas à 180°.', 'Entre 110 et 125°.'], solution: 'Les angles morts de l\'**hypercardioïde** sont vers **110 à 125°** ; derrière, il reprend un lobe.' },
        ]),
      ];
    },
  },
  'son-stereo': {
    titre: 'Régler un couple stéréo',
    consigne: 'Vous installez le couple d\'ambiance en tribune : il faut prévoir ce que capte chaque voie, où se place l\'image et quel couple couvre la scène.',
    gen: (rnd) => {
      const d = pick(rnd, [0.3, 0.4, 0.5, 0.6]), phi = pick(rnd, [20, 30, 45, 60]);
      const dt = d * Math.sin(phi * Math.PI / 180) / 343 * 1000;
      const Cx = pick(rnd, COUPLES.filter((c) => ['xy', 'ortf', 'ab60', 'nos'].includes(c.id)));
      const sra = angleEnregistrement(Cx);
      const g = pick(rnd, [0.5, 1, 1.5]);
      const m = pick(rnd, [0.8, 1]), sS = pick(rnd, [0.3, 0.5]);
      return [
        {
          type: 'nombre', unite: 'ms', answer: Math.round(dt * 100) / 100, tol: 0.03,
          q: `Un couple AB de **${fr(d * 100, 0)} cm**, une source à **${phi}°** à gauche. Quel écart de temps entre les deux voies ? (c = 343 m/s)`,
          pieges: [{ v: Math.round(d / 343 * 1000 * 100) / 100, why: 'C\'est le trajet de tout l\'écartement : seule sa projection sur la direction de la source compte, d × sin φ.' }, { v: Math.round(d * Math.sin(phi * Math.PI / 180) * 100) / 100, why: 'C\'est la différence de trajet en mètres ; divisez par 343 m/s pour des secondes, puis en millisecondes.' }],
          aides: ['La différence de trajet est d × sin φ.', `Δt = ${fr(d * 100, 0)} cm × sin ${phi}° ÷ 343 m/s.`],
          solution: `${fr(d, 2)} × sin ${phi}° ÷ 343 = ${fr(d * Math.sin(phi * Math.PI / 180) / 343, 5)} s = **${fr(dt, 2)} ms**${dt >= 1.1 ? ' : au-delà de 1,1 ms, la source est collée sur le haut-parleur gauche' : ''}.`,
        },
        {
          type: 'choix', q: `Le couple **${Cx.nom}** (${Cx.sous}). Son angle d'enregistrement est d'environ…`,
          choices: [`${fr(sra || 180, 0)}°`, ...[Math.round((sra || 180) * 0.55 / 10) * 10, Math.round((sra || 180) * 1.6 / 10) * 10].map((v) => [`${v}°`, `Pour ce couple, le modèle (15 dB ou 1,1 ms de pleine latéralisation) donne environ ${fr(sra || 180, 0)}°.`])], answer: 0,
          aides: ['Plus un couple est espacé ou ouvert, plus son angle d\'enregistrement est étroit.', 'XY 90° cardioïde ≈ 180°, ORTF ≈ 100°, AB 60 cm ≈ 80°, NOS ≈ 95°.'],
          solution: `Environ **${fr(sra || 180, 0)}°** : une source à ±${fr((sra || 180) / 2, 0)}° est sur un seul haut-parleur.`,
        },
        {
          type: 'nombre', answer: Math.round((m + g * sS) * 100) / 100, tol: 0.02,
          q: `Décodage MS : le M vaut **${fr(m, 1)}**, le S **${fr(sS, 1)}** et le gain du S est de **${fr(g, 1)}**. Que vaut la voie gauche L ?`,
          pieges: [{ v: Math.round((m - g * sS) * 100) / 100, why: 'M − g S, c\'est la voie droite. La gauche ajoute le S.' }, { v: Math.round((m + sS) * 100) / 100, why: 'Le S est multiplié par son gain avant d\'être ajouté.' }].filter((x) => Math.abs(x.v - (m + g * sS)) > 0.02),
          aides: ['L = M + S, R = M − S, le S affecté de son gain.', `L = ${fr(m, 1)} + ${fr(g, 1)} × ${fr(sS, 1)}.`],
          solution: `L = M + g × S = ${fr(m, 1)} + ${fr(g, 1)} × ${fr(sS, 1)} = **${fr(m + g * sS, 2)}** ; R = ${fr(m - g * sS, 2)} ; le mono (L + R) ÷ 2 redonne le M.`,
        },
        pick(rnd, [
          { type: 'choix', q: 'Le couple d\'ambiance doit rester parfait quand la chaîne diffuse en mono. Quel couple choisir ?', choices: ['Un couple coïncident (XY ou MS)', ['Un AB de 60 cm', 'Espacé, il fait un filtre en peigne en mono : des creux à 1 ÷ 2Δt.'], ['Un ORTF', 'L\'ORTF est espacé de 17 cm : la somme mono se creuse un peu.']], answer: 0, aides: ['Quel couple ne fabrique aucun écart de temps ?', 'Capsules au même point.'], solution: 'Un **couple coïncident** : aucun retard entre les voies, la somme mono n\'a pas de creux ; le MS va plus loin, son mono est le M.' },
          { type: 'choix', q: 'La scène paraît tassée au centre entre les enceintes. Que changer sur le couple AB ?', choices: ['L\'écarter davantage : l\'angle d\'enregistrement se resserre et la scène s\'étale', ['Le rapprocher', 'Moins espacé, l\'angle d\'enregistrement s\'élargit encore : tout se tasse davantage au centre.'], ['Inverser une voie', 'Une inversion creuse le mono et détruit l\'image, elle n\'élargit rien.']], answer: 0, aides: ['L\'angle d\'enregistrement et l\'écartement vont en sens inverse.', 'Pour atteindre 1,1 ms plus tôt, il faut plus de différence de trajet.'], solution: '**Écarter** le couple : les écarts de temps grandissent, l\'angle d\'enregistrement se resserre et la scène s\'étale entre les enceintes.' },
          { type: 'choix', q: 'Le corrélateur du couple descend à −0,6 et l\'ambiance se creuse en mono. Que faire ?', choices: ['Inverser la polarité d\'une seule voie (Ø)', ['Inverser les deux voies', 'Inversées ensemble, elles restent opposées l\'une à l\'autre.'], ['Rapprocher les capsules', 'La distance ne change pas le signe d\'une voie.']], answer: 0, aides: ['Sous 0, les deux voies vont en sens opposés.', 'Une voie a changé de signe : une seule à corriger.'], solution: 'Inverser **une seule voie** : le corrélateur remonte vers +1 et le mono retrouve son corps.' },
        ]),
      ];
    },
  },
  'son-liaisons': {
    titre: 'Raccorder au bon niveau',
    consigne: 'La liste de câblage à préparer : des niveaux à adapter, des liaisons à choisir, des impédances à vérifier.',
    gen: (rnd) => {
      const zs = pick(rnd, [150, 200, 600]), zc = pick(rnd, [150, 600, 1500, 2000, 10000]);
      const perte = perteAdaptation(zs, zc);
      const p = pick(rnd, [20, 50, 100]), cmrr = pick(rnd, [40, 60, 80]);
      const residu = residuModeCommun(p, cmrr);
      const broches = pick(rnd, [['2', 'point chaud'], ['3', 'point froid'], ['1', 'masse (blindage)']]);
      return [
        {
          type: 'nombre', unite: 'dB', answer: Math.round(ECART_PRO_CONSO * 10) / 10, tol: 0.2,
          q: 'Une sortie grand public à **−10 dBV** entre sur une console réglée pour **+4 dBu**. De combien de dB le signal arrive-t-il trop bas ?',
          pieges: [{ v: 14, why: 'On ne soustrait pas des dBV et des dBu directement : 0 dBV = +2,2 dBu. −10 dBV = −7,8 dBu.' }],
          aides: ['Convertissez d\'abord −10 dBV en dBu : 0 dBV = 1 V = +2,2 dBu.', '−10 dBV = −7,8 dBu ; écart avec +4 dBu.'],
          solution: `−10 dBV = −7,8 dBu ; 4 − (−7,8) = **${fr(ECART_PRO_CONSO, 1)} dB**, à rattraper par le gain de l'entrée.`,
        },
        {
          type: 'nombre', unite: 'dB', answer: Math.round(perte * 100) / 100, tol: 0.1,
          q: `Une source de **${zs} Ω** attaque une entrée de **${fr(zc)} Ω**. Quelle perte de niveau ? (pont diviseur : charge ÷ (source + charge), en dB, réponse négative ou nulle)`,
          pieges: [{ v: Math.round(-perte * 100) / 100, why: 'Une perte s\'écrit en négatif.' }],
          aides: ['La tension sur la charge vaut Zc ÷ (Zs + Zc) fois la tension à vide.', `20 × log₁₀(${fr(zc)} ÷ ${fr(zs + zc)}).`],
          solution: `20 log₁₀(${fr(zc)} ÷ ${fr(zs + zc)}) = **${fr(perte, 2)} dB**${zc >= 10 * zs ? ' : un pontage correct (charge ≥ 10 × source)' : zc <= zs ? ' : l\'adaptation 600/600 du téléphone, la moitié de la tension perdue' : ' : un peu court, on vise une charge d\'au moins dix fois la source'}.`,
        },
        {
          type: 'nombre', unite: 'mV', answer: Math.round(residu * 1000) / 1000, tol: Math.max(0.002, residu * 0.02),
          q: `Un parasite de **${p} mV** est capté sur un câble symétrique. L'entrée a une réjection de mode commun de **${cmrr} dB**. Que reste-t-il du parasite après l'entrée ?`,
          pieges: [{ v: Math.round(p / cmrr * 1000) / 1000, why: 'Une réjection en dB n\'est pas une division par le nombre de dB : c\'est 10^(dB ÷ 20) en tension.' }],
          aides: ['La réjection s\'applique en tension : 20 log.', `Résidu = ${p} ÷ 10^(${cmrr} ÷ 20).`],
          solution: `${p} ÷ 10^(${cmrr} ÷ 20) = **${fr(residu, 3)} mV**${residu < 0.1 ? ' : inaudible' : ' : encore audible dans les silences'}.`,
        },
        pick(rnd, [
          { type: 'texte', q: `Sur un XLR audio, quel numéro porte le **${broches[1]}** ?`, accept: [broches[0]], forme: 'mot', placeholder: '1, 2 ou 3', aides: ['« Un, masse ; deux, chaud ; trois, froid. »', 'Les broches vont de 1 à 3.'], solution: `Broche **${broches[0]}** : 1 masse, 2 point chaud, 3 point froid.` },
          { type: 'choix', q: 'Deux appareils reliés par un câble audio ronflent à 50 Hz ; tous deux sont à la terre. Que faire ?', choices: ['Lever la masse d\'un côté (ground lift) ou isoler par transformateur', ['Monter le gain', 'La ronflette monterait avec.'], ['Couper le 48 V', 'Le 48 V ne ronfle pas : c\'est une boucle de masse.']], answer: 0, aides: ['Le blindage et la terre forment une boucle.', 'On la casse ou on l\'isole.'], solution: 'Une **boucle de masse** : on lève la masse d\'un côté ou l\'on isole galvaniquement.' },
          { type: 'choix', q: 'Les broches 2 et 3 d\'un câble sont inversées. Qu\'entend-on sur cette voie seule ?', choices: ['Rien d\'anormal : seule la polarité est inversée', ['Un niveau 6 dB plus bas', 'Le signal passe entier, de signe opposé.'], ['Le silence', 'Chaud et froid inversés ne coupent rien.']], answer: 0, aides: ['Que change l\'échange de +s et −s ?', 'Le signe du signal.'], solution: '**Rien seule** : polarité inversée, qui ne s\'entend qu\'avec une autre voie (couple creusé en mono).' },
        ]),
      ];
    },
  },
  // ---------------- la dynamique, le loudness, le numérique (v19.26) ----------------
  'son-dynamique': {
    titre: 'Régler un compresseur',
    consigne: 'Le commentateur chuchote puis crie : vous réglez sa tranche. Des niveaux de sortie à prévoir, des réglages à choisir.',
    gen: (rnd) => {
      const seuil = pick(rnd, [-24, -20, -16]), ratio = pick(rnd, [2, 3, 4, 8]), inn = seuil + pick(rnd, [6, 8, 12, 16]);
      const out = compresseur(inn, seuil, ratio);
      const inn2 = seuil - pick(rnd, [4, 10]);
      return [
        {
          type: 'nombre', unite: 'dB', answer: Math.round(out * 100) / 100, tol: 0.15,
          q: `Compresseur : seuil **${fr(seuil)} dB**, ratio **${ratio}:1**, genou dur. Une crête entre à **${fr(inn)} dB**. À quel niveau sort-elle ?`,
          pieges: [{ v: Math.round(inn / ratio * 100) / 100, why: 'Le ratio ne divise que ce qui dépasse le seuil, pas le niveau entier.' }, { v: Math.round((seuil - (inn - seuil) / ratio) * 100) / 100, why: 'Au-dessus du seuil, la sortie monte encore, moins vite : on ajoute (entrée − seuil) ÷ ratio au seuil.' }],
          aides: ['Sous le seuil, rien ne change ; au-dessus, l\'excédent est divisé par le ratio.', `Sortie = ${fr(seuil)} + (${fr(inn)} − (${fr(seuil)})) ÷ ${ratio}.`],
          solution: `Excédent ${inn - seuil} dB ÷ ${ratio} = ${fr((inn - seuil) / ratio, 2)} dB ; sortie **${fr(out, 2)} dB**, soit ${fr(inn - out, 2)} dB de réduction de gain.`,
        },
        {
          type: 'nombre', unite: 'dB', answer: inn2,
          q: `Même compresseur (seuil ${fr(seuil)} dB). Un passage entre à **${fr(inn2)} dB**. À quel niveau sort-il ?`,
          aides: ['Où est ce niveau par rapport au seuil ?', 'Sous le seuil, le compresseur ne fait rien.'],
          solution: `${fr(inn2)} dB est sous le seuil : le compresseur ne touche pas à ce passage, il sort à **${fr(inn2)} dB**. Seul le gain de rattrapage, s'il y en a un, le remonterait.`,
        },
        {
          type: 'choix', q: 'La voix du commentateur « pompe » : le niveau respire à chaque syllabe. Quel réglage ?', choices: ['Allonger le relâchement', ['Raccourcir l\'attaque', 'L\'attaque règle l\'arrivée de la réduction, pas son retour entre les syllabes.'], ['Monter le ratio', 'Un ratio plus fort accentue encore le mouvement du gain.']], answer: 0,
          aides: ['Le pompage, c\'est le gain qui remonte trop vite entre deux sons.', 'Le temps de retour au gain normal.'],
          solution: 'Le **relâchement** : plus long (100 à 300 ms sur une voix), le gain ne remonte plus entre chaque syllabe.',
        },
        pick(rnd, [
          { type: 'ordre', q: 'Remettez dans l\'ordre les traitements d\'une tranche de commentateur.', items: ['Le gate, qui coupe la foule entre les phrases', 'Le compresseur, qui tient la voix', 'L\'égaliseur et le fader', 'Le limiteur, sur le bus de départ'], aides: ['On ne compresse pas ce qu\'on va couper.', 'Le limiteur protège la sortie, donc en dernier.'], solution: '1. gate ; 2. compresseur ; 3. égaliseur et fader ; 4. limiteur sur le bus.' },
          { type: 'choix', q: 'Qu\'est-ce qui fait d\'un compresseur un limiteur ?', choices: ['Un ratio infini et une attaque quasi nulle', ['Un seuil très bas', 'Un seuil bas compresse tout ; un limiteur a au contraire un seuil haut, près du plafond.'], ['Un fort gain de rattrapage', 'Le limiteur plafonne, il ne remonte pas.']], answer: 0, aides: ['Rien ne doit dépasser le seuil, jamais.', 'Pente horizontale, et réaction immédiate.'], solution: '**Ratio ∞:1, attaque nulle** : un plafond. Au départ, il tient la crête vraie sous −1 dBTP.' },
          { type: 'choix', q: 'Où régler le seuil du gate du micro-casque ?', choices: ['Entre la foule qui entre par le micro et la voix la plus douce', ['Au-dessus de la voix', 'Le gate resterait fermé pendant qu\'il parle.'], ['Le plus bas possible', 'Il ne se fermerait jamais : inutile.']], answer: 0, aides: ['Le gate doit s\'ouvrir sur la voix et se fermer sur la foule.', 'Ni trop haut ni trop bas.'], solution: 'Seuil **entre la foule et la voix**, relâchement assez long pour ne pas couper les fins de mots.' },
        ]),
      ];
    },
  },
  'son-loudness': {
    titre: 'Mettre un programme au loudness',
    consigne: 'Le PAD du résumé arrive : vous lisez le loudness-mètre, vous décidez du gain et vous vérifiez la crête vraie.',
    gen: (rnd) => {
      const lufs = pick(rnd, [-18, -20, -21, -25, -26, -28]), tp = pick(rnd, [-2, -4, -6, -9]);
      const N = normaliser(lufs, tp);
      const blocs = [...Array(entre(rnd, 6, 10)).fill(pick(rnd, [-22, -23, -24])), ...Array(entre(rnd, 2, 4)).fill(pick(rnd, [-75, -80])), ...Array(entre(rnd, 2, 4)).fill(pick(rnd, [-18, -20]))];
      const I = loudnessIntegre(blocs);
      const ecart = pick(rnd, [0.4, 0.8, 1.5, 2.5]), sens = pick(rnd, [1, -1]);
      return [
        {
          type: 'nombre', unite: 'dB', answer: Math.round(N.gain * 10) / 10, tol: 0.15,
          q: `Le programme mesure **${fr(lufs)} LUFS** intégré. Quel gain appliquer pour viser **−23 LUFS** ? (négatif pour baisser)`,
          pieges: [{ v: Math.round(-N.gain * 10) / 10, why: 'Le signe est inversé : si le programme est trop fort, on baisse (gain négatif).' }],
          aides: ['1 LU = 1 dB : le gain est la différence entre la cible et la mesure.', `Gain = −23 − (${fr(lufs)}).`],
          solution: `−23 − (${fr(lufs)}) = **${fr(N.gain, 1)} dB**.`,
        },
        {
          type: 'nombre', unite: 'dBTP', answer: Math.round(N.crete * 10) / 10, tol: 0.15,
          q: `Avant correction, sa crête vraie est à **${fr(tp)} dBTP**. Après le gain de ${fr(N.gain, 1)} dB, où est-elle ? Et passe-t-elle sous −1 dBTP ?`,
          aides: ['Un gain global déplace la crête vraie d\'autant.', `Crête = ${fr(tp)} + (${fr(N.gain, 1)}).`],
          solution: `${fr(tp)} + (${fr(N.gain, 1)}) = **${fr(N.crete, 1)} dBTP** : ${N.ok ? 'sous le plafond de −1 dBTP, conforme' : `au-dessus de −1 dBTP de ${fr(N.limiter, 1)} dB : le limiteur devra intervenir (ou le mélange est à revoir)`}.`,
        },
        {
          type: 'choix', q: `Un programme : des blocs à ${fr(blocs[0])} LUFS, un silence à ${fr(blocs.find((v) => v < -70) ?? -80)} LUFS, un générique à ${fr(blocs[blocs.length - 1])} LUFS. Le loudness intégré avec les portes vaut environ…`,
          choices: [`${fr(I.lufs, 1)} LUFS`, [`${fr(I.sansPorte, 1)} LUFS`, 'C\'est la moyenne sans porte : le silence tire la mesure vers le bas. La porte absolue à −70 LUFS l\'écarte.'], [`${fr(blocs[0])} LUFS`, 'Le générique, plus fort, pèse aussi dans la moyenne (en puissance).']], answer: 0,
          aides: ['Les blocs sous −70 LUFS ne comptent pas (porte absolue).', 'La moyenne se fait en puissance, pas en dB : les blocs forts pèsent plus.'],
          solution: `Portes : le silence est écarté, puis la moyenne en puissance des blocs restants : **${fr(I.lufs, 1)} LUFS** (sans porte, ${fr(I.sansPorte, 1)}).`,
        },
        {
          type: 'choix', q: `Au PAD, le fichier mesure ${fr(-23 + sens * ecart, 1)} LUFS, soit ${fr(ecart, 1)} LU ${sens > 0 ? 'au-dessus' : 'en dessous'} de la cible. Est-il conforme à l'EBU R128 ?`,
          choices: [ecart <= 0.5 ? 'Oui : dans la tolérance de ±0,5 LU du PAD' : 'Non : la tolérance du PAD est de ±0,5 LU ; on corrige le gain', ...fauxPad(ecart)], answer: 0,
          aides: ['Deux tolérances : le direct et le PAD.', '±1 LU en direct, ±0,5 LU au PAD.'],
          solution: ecart <= 0.5 ? `**Conforme** : ${fr(ecart, 1)} LU d'écart tient dans les ±0,5 LU du PAD.` : `**Non conforme** : ${fr(ecart, 1)} LU dépasse les ±0,5 LU du PAD. Un gain de ${fr(-sens * ecart, 1)} dB le ramène à −23 LUFS, à condition que la crête vraie reste sous −1 dBTP.`,
        },
      ];
    },
  },
  'son-numerique': {
    titre: 'Dimensionner l\'audio numérique',
    consigne: 'La stagebox, la console et les liaisons : des débits, des canaux, des latences et des horloges à calculer.',
    gen: (rnd) => {
      const fs = pick(rnd, [48000, 96000]), bits = pick(rnd, [16, 24]), ch = pick(rnd, [2, 8, 16]);
      const d = debitPcm(fs, bits, ch);
      const tampon = pick(rnd, [48, 96, 128, 256, 512]);
      const ppm = pick(rnd, [10, 25, 50, 100]);
      return [
        {
          type: 'nombre', unite: 'Mb/s', answer: Math.round(d / 1e6 * 1000) / 1000, tol: 0.01,
          q: `Un flux PCM de **${ch} canaux** à **${fs / 1000} kHz**, **${bits} bits**. Quel débit, en Mb/s ?`,
          pieges: [{ v: Math.round(d / 8 / 1e6 * 1000) / 1000, why: 'C\'est en mégaoctets par seconde : le débit se compte en bits, 8 fois plus.' }, { v: Math.round(debitPcm(fs, bits, 1) / 1e6 * 1000) / 1000, why: 'C\'est le débit d\'un seul canal : multipliez par le nombre de canaux.' }],
          aides: ['Débit = fréquence d\'échantillonnage × bits × canaux.', `${fs} × ${bits} × ${ch} bits par seconde.`],
          solution: `${fr(fs)} × ${bits} × ${ch} = ${fr(d)} b/s = **${fr(d / 1e6, 3)} Mb/s**.`,
        },
        {
          type: 'nombre', unite: 'ms', answer: Math.round(latenceTampon(tampon, fs) * 100) / 100, tol: 0.02,
          q: `Un tampon de **${tampon} échantillons** à **${fs / 1000} kHz**. Quelle latence ?`,
          pieges: [{ v: Math.round(latenceTampon(tampon, fs === 48000 ? 96000 : 48000) * 100) / 100, why: `C'est à ${fs === 48000 ? '96' : '48'} kHz. Ici la fréquence d'échantillonnage est ${fs / 1000} kHz.` }],
          aides: ['Un échantillon dure 1 ÷ fs.', `${tampon} ÷ ${fs} s, en millisecondes.`],
          solution: `${tampon} ÷ ${fr(fs)} = **${fr(latenceTampon(tampon, fs), 2)} ms**${fs === 48000 && tampon === 48 ? ' : 48 échantillons font 1 ms, le paquet du ST 2110-30' : ''}.`,
        },
        {
          type: 'nombre', answer: canauxMadi(fs),
          q: `Combien de canaux porte une liaison MADI à **${fs / 1000} kHz** (mode 64 canaux) ?`,
          pieges: [{ v: fs === 96000 ? 64 : 128, why: 'Le débit du MADI est fixe : doubler la fréquence d\'échantillonnage divise les canaux par deux.' }],
          aides: ['Le MADI a un débit fixe de 125 Mb/s.', '64 canaux à 48 kHz ; et si chaque canal demande deux fois plus ?'],
          solution: `**${canauxMadi(fs)} canaux** : 64 à 48 kHz, 32 à 96 kHz (16 à 192 kHz).`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: 'dB', answer: Math.round(dynamiqueDb(bits) * 10) / 10, tol: 0.2,
            q: `Quelle dynamique théorique pour une quantification sur **${bits} bits** ? (6,02 × bits + 1,76)`,
            aides: ['Chaque bit ajoute environ 6 dB.', `6,02 × ${bits} + 1,76.`],
            solution: `6,02 × ${bits} + 1,76 = **${fr(dynamiqueDb(bits), 1)} dB**${bits === 24 ? ' : bien plus que la chaîne analogique' : ' : le CD ; il faut viser plus haut dans l\'échelle'}.`,
          },
          {
            type: 'nombre', unite: 'éch./s', answer: Math.round(deriveEchantillons(ppm, 48000) * 100) / 100, tol: 0.05,
            q: `Deux convertisseurs à 48 kHz tournent sur leurs propres horloges, écartées de **${ppm} ppm**. De combien d'échantillons se décalent-ils chaque seconde ?`,
            pieges: [{ v: ppm, why: 'Une ppm est un millionième : il faut multiplier par 48 000 échantillons par seconde puis diviser par un million.' }],
            aides: ['ppm = partie par million.', `${ppm} × 10⁻⁶ × 48 000.`],
            solution: `${ppm} × 10⁻⁶ × 48 000 = **${fr(deriveEchantillons(ppm, 48000), 2)} échantillons par seconde** : un clic ${deriveEchantillons(ppm, 48000) >= 1 ? 'plusieurs fois par seconde' : `toutes les ${fr(1 / deriveEchantillons(ppm, 48000), 1)} s`} si rien ne les verrouille (word clock, PTP, ou un SRC).`,
          },
          {
            type: 'nombre', unite: 'Mb/s', answer: Math.round(debitAes3(fs) / 1e6 * 1000) / 1000, tol: 0.01,
            q: `Quel débit pour une liaison **AES3** à **${fs / 1000} kHz** ? (64 bits par trame)`,
            aides: ['Une trame AES3 porte 64 bits et il y en a une par échantillon.', `64 × ${fs}.`],
            solution: `64 × ${fr(fs)} = **${fr(debitAes3(fs) / 1e6, 3)} Mb/s** pour deux canaux.`,
          },
        ]),
      ];
    },
  },
});
