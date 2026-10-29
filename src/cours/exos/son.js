// @ts-check
import { registerExos, entre, pick, tirer, fr as frn } from '../exo.js';

/** un niveau négatif écrit avec le signe moins typographique */
const fr = (v, d = 0) => frn(v, d).replace('-', '−');

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « Le son » : régler un gain d'entrée pour des crêtes entre −18 et
// −10 dBFS, prévoir l'écrêtage au-delà de 0 dBFS, lire un fader en rapport d'amplitude (20 log10),
// remettre la tranche dans l'ordre ; retarder le son d'autant d'images que l'image (20 ms en 1080p50,
// 40 ms en 1080i50), juger un décalage selon l'EBU R37 (40 ms d'avance, 60 ms de retard au plus de
// bout en bout), composer un N-1. Chiffres des leçons (cours/son.js).
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
    type: 'choix', q: 'Le canon du bord terrain, un micro statique, ne donne rien : ni crête, ni souffle. Que vérifies-tu d\'abord sur sa tranche ?',
    choices: ['L\'alimentation fantôme 48 V', ['Le fader, à monter', 'Un fader ne dose qu\'un signal qui existe : sans rien en entrée, il n\'y a rien à doser.'], ['La polarité (Ø)', 'Une polarité inversée change le signe du signal, elle ne le fait pas disparaître sur une voie seule.']], answer: 0,
    aides: ['Un micro statique, à condensateur, a besoin de quelque chose que la console lui envoie.', 'P48, sur les deux conducteurs de modulation.'],
    solution: 'Le **48 V** : sans alimentation fantôme, un micro statique ne délivre rien.',
  },
  {
    type: 'choix', q: 'Le couple d\'ambiance sonne bien en stéréo, mais se creuse et perd son corps quand on l\'écoute en mono. Le corrélateur est sous 0. Que corriges-tu ?',
    choices: ['La polarité d\'une des deux voies (touche Ø)', ['Le gain des deux voies', 'Le niveau ne change rien à une opposition de phase : la partie commune continue de s\'annuler.'], ['L\'égaliseur, en ajoutant des graves', 'C\'est l\'addition des deux voies qui s\'annule : aucun égaliseur ne la rattrape.']], answer: 0,
    aides: ['Un corrélateur sous 0 dit que les deux voies vont en sens opposés.', 'Une voie a changé de signe.'],
    solution: 'La **polarité** : une voie inversée annule la partie commune en mono ; rétablie, le corrélateur remonte vers +1.',
  },
  {
    type: 'choix', q: 'Le canon de la CAM 5 allume l\'OVL rouge sur chaque frappe. L\'assistant propose de baisser son fader. Qu\'en penses-tu ?',
    choices: ['Non : il faut baisser le gain d\'entrée, le fader ne répare pas un écrêtage', ['Oui : le son sera moins fort, donc propre', 'Baisser le fader d\'un micro écrêté donne un son écrêté moins fort : les crêtes sont déjà coupées à la conversion.'], ['Oui, et couper le 48 V', 'Sans 48 V, le canon ne délivre plus rien du tout.']], answer: 0,
    aides: ['Où se produit l\'écrêtage : avant ou après le fader ?', 'Le convertisseur ne sait pas écrire au-delà de 0 dBFS.'],
    solution: 'Baisser le **gain** : l\'écrêtage se produit au convertisseur, avant le fader.',
  },
];
const DEPARTS = [
  {
    type: 'choix', q: 'À l\'antenne, la chaîne diffuse l\'ambiance du stade sans aucun commentaire. Le plan de son demande la paire 1 en programme, la paire 2 en international. Que s\'est-il passé ?',
    choices: ['Les paires 1 et 2 sont inversées dans l\'embedder du départ', ['Les commentateurs ne sont pas dans leur N-1', 'Le N-1 est le retour des commentateurs ; il ne change pas ce que diffuse la chaîne.'], ['Le retard de ligne est trop long', 'Un retard décale le son, il n\'enlève pas les voix.']], answer: 0,
    aides: ['Le son sans voix, c\'est l\'international.', 'Regarde quelle paire porte quoi au départ.'],
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
    consigne: 'En cabine son, avant l\'antenne : tu règles le gain de chaque micro, tu prévois ce qui va écrêter et tu corriges les tranches en défaut.',
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
          aides: ['Un écart en décibels s\'ajoute au niveau de départ.', `Crête = ${fr(c0)} dBFS + ${plus} dB ; compare à 0 dBFS.`],
          solution: `${fr(c0)} + ${plus} = **${c1 > 0 ? '+' : ''}${fr(c1)} dBFS** : ${c1 > 0 ? 'au-delà de 0 dBFS, la crête est écrêtée (OVL), et aucun fader ne la réparera' : c1 === 0 ? 'pile à la pleine échelle : plus aucune marge, le moindre surplus écrête' : 'encore sous 0 dBFS : la marge a suffi'}.`,
        },
        {
          type: 'nombre', answer: Math.round(r * 100) / 100, tol: Math.max(0.05, r * 0.02),
          q: `On baisse le fader de **${f} dB**. Par combien l'amplitude du signal est-elle divisée ? (un écart en dB vaut 20 × log₁₀ du rapport d'amplitudes)`,
          pieges: [{ v: f / 20, why: 'Il faut passer par la puissance de 10 : rapport = 10^(dB ÷ 20).' }, { v: Math.round(10 ** (f / 10) * 100) / 100, why: 'C\'est le rapport en puissance (10 log₁₀) ; pour une amplitude, c\'est 20 log₁₀.' }],
          aides: ['Inverse la formule : rapport = 10 puissance (dB ÷ 20).', `10^(${f} ÷ 20).`],
          solution: `10^(${f} ÷ 20) = **${fr(r, 2)}**${f === 6 ? ' : −6 dB, c\'est à peu près l\'amplitude divisée par deux' : f === 20 ? ' : −20 dB, l\'amplitude divisée par dix' : ''}.`,
        },
        pick(rnd, [...TRANCHE, {
          type: 'ordre', q: 'Remets dans l\'ordre les réglages d\'une tranche.',
          items: ['Gain, 48 V et polarité, en écoutant la source seule (PFL)', 'Passe-haut, égaliseur, dynamique', 'Le fader, qui dose la source dans le mélange', 'Les envois, qui la dirigent vers les bus'],
          aides: ['Le premier réglage est le plus important : celui qui adapte le micro à la console.', 'Le fader ne vient qu\'après les traitements.'],
          solution: '1. Gain, 48 V, polarité (en PFL) ; 2. passe-haut, égaliseur, dynamique ; 3. le fader ; 4. les envois vers les bus.',
        }]),
      ];
    },
  },
  'son-n1': {
    titre: 'Les départs et la synchro labiale',
    consigne: 'En cabine son, onglet « Bus, N-1, départ » : tu cales le retard du son sur celui de l\'image, tu juges un décalage et tu composes les retours des commentateurs.',
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
          q: `Le car est en **${F.nom}**. L'image de la caméra HF arrive avec **${n} image${n > 1 ? 's' : ''}** de retard sur son son. Quel retard de ligne donnes-tu au son, en millisecondes ?`,
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
});
