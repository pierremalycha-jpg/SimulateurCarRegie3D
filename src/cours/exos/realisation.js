// @ts-check
import { registerExos, entre, pick, fr } from '../exo.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « La réalisation » : la durée d'une transition comptée en images,
// l'enchaînement preset → antenne et les tallys, le calcul d'une incrustation (PGM = fond × (1 − k) +
// fill × k), la clé luminance (clip et gain), l'ordre des couches, le timecode à 25 images par seconde
// et les ordres du réalisateur. Chiffres des leçons (cours/realisation.js).
// ----------------------------------------------------------------------------------
/** images par seconde comptées par le mélangeur selon le format (leçon Le mélangeur) */
const FORMATS = [{ nom: '1080i50', ips: 25 }, { nom: '1080p50', ips: 50 }];
const p2 = (n) => String(n).padStart(2, '0');
/** timecode HH:MM:SS:II à 25 images par seconde (images 00 à 24), comme la leçon */
const tc = (f, base = 25) => `${p2(Math.floor(f / (base * 3600)) % 24)}:${p2(Math.floor(f / (base * 60)) % 60)}:${p2(Math.floor(f / base) % 60)}:${p2(f % base)}`;
const TALLY = [
  {
    type: 'choix', q: 'Le truquiste enchaîne (MIX) de la CAM 2 vers la CAM 5. Pendant le fondu, quelle couleur ont les tallys des deux caméras ?',
    choices: ['Rouges tous les deux : les deux images sont à l\'antenne', ['CAM 2 rouge, CAM 5 verte', 'C\'est l\'état avant la transition. Pendant un fondu, les deux images sont visibles à l\'antenne.'], ['CAM 2 verte, CAM 5 rouge', 'C\'est l\'état après le fondu (les bus se sont échangés) : pendant, les deux sont à l\'antenne.']], answer: 0,
    aides: ['Pendant un enchaîné, que voit le téléspectateur ?', 'Le tally rouge veut dire « mon image est à l\'antenne ».'],
    solution: '**Rouges tous les deux** : pendant un enchaîné ou un volet, les deux images sont visibles, et aucun des deux cadreurs ne doit bouger.',
  },
  {
    type: 'choix', q: 'Après un CUT de la CAM 1 vers la CAM 3, où se trouve la CAM 1 ?',
    choices: ['En preset (rangée B · PST), tally vert, prête pour un retour', ['Nulle part : il faut la reprendre sur la rangée B', 'À la fin d\'une transition, les bus s\'échangent (flip-flop) : l\'ancienne source attend en preset.'], ['Toujours à l\'antenne, avec la CAM 3', 'Un CUT remplace l\'image d\'une image à la suivante : une seule source reste à l\'antenne.']], answer: 0,
    aides: ['Que font les deux bus à la fin d\'une transition ?', 'On parle de flip-flop.'],
    solution: 'Les bus **s\'échangent** : la CAM 1 attend en preset (tally vert), prête pour un retour.',
  },
  {
    type: 'choix', q: 'Le réalisateur veut entrer dans un ralenti sans qu\'on voie la coupe. Quelle transition le truquiste choisit-il ?',
    choices: ['Le CLIP (volet logo) : une animation cache la coupe', ['Un CUT', 'La coupe se verrait : l\'image du ralenti arrive d\'un coup.'], ['Un MIX de 25 images', 'Un fondu montre les deux images mêlées ; l\'entrée en ralenti se fait en volet logo.']], answer: 0,
    aides: ['On cherche une transition qui masque le passage d\'une image à l\'autre.', 'Une animation, souvent le logo de la compétition.'],
    solution: 'Le **CLIP** (volet logo, stinger) : la coupe se fait derrière l\'animation, pour entrer dans le ralenti et en sortir.',
  },
  {
    type: 'choix', q: 'Le truquiste appuie directement sur la touche CAM 6 de la rangée A · PGM. Que se passe-t-il ?',
    choices: ['Une coupe « à chaud » : la CAM 6 passe à l\'antenne sans avoir été vue en preset', ['La CAM 6 passe en preset', 'C\'est la rangée B · PST qui prépare ; la rangée A dit ce qui est à l\'antenne.'], ['Rien : il faut d\'abord appuyer sur CUT', 'La rangée A commute aussitôt le programme : pas besoin de transition.']], answer: 0,
    aides: ['Que représente la rangée A ?', 'La rangée A · PGM, c\'est l\'antenne.'],
    solution: 'Une **coupe à chaud** : possible, mais personne n\'a vu le cadre avant, et le cadreur n\'a pas eu son tally vert.',
  },
];
const COUCHES = [
  {
    type: 'choix', q: 'Le score est sur le DSK 1. Le truquiste coupe de la CAM 1 à la CAM 4, puis part en ralenti. Que devient le score ?',
    choices: ['Il reste à l\'écran : le DSK est après les transitions, au-dessus de tout', ['Il disparaît à chaque coupe', 'Ce serait une clé du M/E, prise dans les transitions. Le DSK est en aval.'], ['Il passe sur la CAM 1 en preset', 'Un DSK n\'est attaché à aucune source : il est posé sur le programme.']], answer: 0,
    aides: ['Où sont les DSK dans le mélangeur : avant ou après le dernier M/E ?', 'Downstream keyer : incrustateur aval.'],
    solution: 'Il **reste** : les DSK sont après le dernier M/E, indépendants des transitions.',
  },
  {
    type: 'choix', q: 'Un diffuseur étranger veut le programme sans le score ni les bandeaux, pour poser son habillage. Quelle sortie lui donne-t-on ?',
    choices: ['Le clean feed, pris avant les DSK', ['Le programme (PGM)', 'Le PGM porte le score et les bandeaux des DSK.'], ['La sortie fill de l\'habillage', 'Le fill est le graphique lui-même, sans l\'image du match.']], answer: 0,
    aides: ['Il faut le programme, mais avant que l\'habillage y soit posé.', 'Une sortie « propre ».'],
    solution: 'Le **clean feed** : le programme pris avant les DSK, sans habillage.',
  },
  {
    type: 'choix', q: 'L\'habillage lance un bandeau joueur : le moteur graphique sort bien le fill et le key, mais rien n\'apparaît au programme. Que vérifier d\'abord ?',
    choices: ['Que le DSK du bandeau (DSK 2) est ouvert au mélangeur', ['Le gain de la clé luminance', 'Un bandeau d\'habillage passe en clé linéaire : son key est fourni avec le fill.'], ['La référence de la caméra à l\'antenne', 'Le bandeau ne dépend pas de la caméra ; il est posé par un DSK.']], answer: 0,
    aides: ['Le graphique sort bien de l\'habillage : il manque l\'étape qui le pose sur le programme.', 'L\'incrustateur aval doit être ouvert.'],
    solution: 'Le **DSK 2** est sans doute fermé : le bandeau n\'arrive au programme que lorsque son DSK est ouvert.',
  },
  {
    type: 'choix', q: 'Pendant une animation, un liseré apparaît autour du graphique et la découpe ne suit plus l\'image. Quelle est la cause la plus probable ?',
    choices: ['Le fill et le key ne sont pas en phase (une image de décalage)', ['Le clip de la clé est trop haut', 'Le clip règle une clé luminance ; ici, la découpe est bonne mais décalée dans le temps.'], ['Le DSK est fermé', 'Un DSK fermé ne montre rien du tout ; ici, le graphique est là, mal découpé.']], answer: 0,
    aides: ['Le défaut n\'apparaît que pendant les animations.', 'Fill et key doivent arriver au même instant.'],
    solution: 'Fill et key **décalés** d\'une image : ils doivent avoir la même référence et le même retard sur le chemin.',
  },
  {
    type: 'choix', q: 'Un halo noir entoure les lettres d\'un graphique aux bords adoucis. Que règle-t-on dans le menu du DSK ?',
    choices: ['Le mode du fill : prémultiplié (shaped) ou non (unshaped)', ['Le gain de la clé, à monter', 'Un gain fort durcit les bords ; le halo noir vient d\'un fill multiplié deux fois par le key.'], ['La transition du M/E', 'Les DSK ne dépendent pas des transitions du M/E.']], answer: 0,
    aides: ['Le fill a peut-être déjà été multiplié par le key.', 'Shaped ou unshaped.'],
    solution: 'Un fill **prémultiplié** traité comme non prémultiplié est multiplié deux fois par le key : on règle « shaped / unshaped » dans le menu du DSK.',
  },
];
const ORDRES = [
  {
    q: 'Remets dans l\'ordre une coupe bien annoncée.',
    items: ['Le réalisateur : « Prépare la 3 »', 'Le truquiste met la CAM 3 sur la rangée B · PST', 'Le tally de la CAM 3 passe au vert : le cadreur soigne son cadre', 'Le réalisateur : « Top »', 'La CAM 3 passe à l\'antenne, tally rouge'],
  },
  {
    q: 'Remets dans l\'ordre le compte de la scripte jusqu\'à la prise d\'antenne.',
    items: ['« Antenne dans 1 minute »', '« 30 secondes »', '« 10, 9, 8… »', '« Top antenne »'],
  },
  {
    q: 'Remets dans l\'ordre un ralenti demandé par le réalisateur.',
    items: ['Le réalisateur : « Ralenti A, la 2 et la 7 »', 'L\'opérateur ralenti cale l\'action sur ces angles', 'L\'opérateur annonce « ralenti prêt »', 'Le truquiste l\'envoie à l\'antenne en volet logo'],
  },
];
const ROLES = [
  {
    type: 'choix', q: 'La chaîne veut avancer la page de publicité de deux minutes. Qui le négocie dans le car ?',
    choices: ['La production', ['La scripte', 'La scripte tient le temps et le conducteur ; c\'est la production qui représente la chaîne et règle les imprévus.'], ['Le truquiste', 'Le truquiste exécute les ordres du réalisateur au mélangeur.']], answer: 0,
    aides: ['Qui représente le diffuseur dans le car ?', 'Elle valide le conducteur et fait respecter les horaires de la chaîne.'],
    solution: 'La **production** : elle représente la chaîne, fait respecter ses horaires et règle les imprévus avec sa régie finale.',
  },
  {
    type: 'choix', q: 'Le réalisateur dit « Top » sans avoir rien annoncé. Sur quoi le truquiste coupe-t-il ?',
    choices: ['Sur ce qui est en preset, souvent l\'ancien plan', ['Sur la caméra que le réalisateur regarde', 'Le truquiste ne peut pas deviner : sans annonce, il coupe sur ce qui est en preset.'], ['Sur rien : il attend une annonce', 'Un « Top » se joue tout de suite : la coupe part sur la source en preset.']], answer: 0,
    aides: ['À quoi sert l\'annonce « Prépare la… » ?', 'La coupe fait passer à l\'antenne le contenu du bus preset.'],
    solution: 'Sur **ce qui est en preset** : souvent l\'ancien plan. L\'annonce sert justement à préparer la bonne caméra.',
  },
  {
    type: 'choix', q: 'Qui note les actions du match avec leur timecode et compte les prises d\'antenne ?',
    choices: ['La scripte', ['La production', 'La production suit les horaires de la chaîne et le retour antenne ; la scripte tient le temps et les notes.'], ['L\'opérateur ralenti', 'Il cale ses ralentis sur le timecode, mais ce sont les notes de la scripte qui gardent la trace des actions.']], answer: 0,
    aides: ['On l\'appelle aussi l\'assistante de réalisation.', 'Elle fait vivre le conducteur.'],
    solution: 'La **scripte** : elle tient le temps, annonce les comptes à rebours et note chaque action avec son timecode.',
  },
];

registerExos({
  'real-melangeur': {
    titre: 'Préparer, couper, enchaîner',
    consigne: 'Au poste Truquiste, avant le coup d\'envoi : tu règles la durée des transitions en images, puis tu suis les tallys pendant les commutations.',
    gen: (rnd) => {
      const F = pick(rnd, FORMATS), N = pick(rnd, [12, 15, 20, 25, 30, 50]);
      const G = pick(rnd, FORMATS), s = pick(rnd, [0.4, 0.8, 1, 1.2, 2]);
      const autre = FORMATS.find((x) => x !== F) || F, autreG = FORMATS.find((x) => x !== G) || G;
      return [
        {
          type: 'nombre', unite: 's', answer: Math.round(N / F.ips * 1000) / 1000, tol: 0.01,
          q: `Le car est en **${F.nom}** ; la durée de l'enchaîné est réglée à **${N} images**. Combien de secondes dure le fondu ?`,
          pieges: [{ v: Math.round(N / autre.ips * 1000) / 1000, why: `C'est la durée en ${autre.nom} : ${autre.ips} images par seconde.` }].filter((p) => Math.abs(p.v - N / F.ips) > 0.01),
          aides: ['Le mélangeur compte les transitions en images du format.', `En ${F.nom}, il y a ${F.ips} images par seconde : divise ${N} par ${F.ips}.`],
          solution: `${N} ÷ ${F.ips} = **${fr(N / F.ips, 2)} s**. La même durée en images dure ${F.ips === 25 ? 'deux fois moins' : 'deux fois plus'} longtemps en ${autre.nom} : vérifie le format du car avant de régler.`,
        },
        {
          type: 'nombre', unite: 'images', answer: Math.round(s * G.ips),
          q: `Le réalisateur veut des enchaînés de **${fr(s, 1)} s**. Le car est en **${G.nom}** : quelle durée en images règles-tu ?`,
          pieges: [{ v: Math.round(s * autreG.ips), why: `C'est la valeur pour du ${autreG.nom}.` }].filter((p) => p.v !== Math.round(s * G.ips)),
          aides: ['La durée se règle en images du format, pas en secondes.', `${fr(s, 1)} s × ${G.ips} images par seconde.`],
          solution: `${fr(s, 1)} × ${G.ips} = **${Math.round(s * G.ips)} images**.`,
        },
        {
          type: 'ordre', q: 'Remets dans l\'ordre le geste de base du truquiste.',
          items: ['Préparer la caméra sur la rangée B · PST', 'Regarder le cadre au moniteur preset', 'Lancer la transition (CUT ou AUTO TRANS)', 'Les bus s\'échangent : l\'ancienne source attend en preset'],
          aides: ['On ne fait passer à l\'antenne que ce qu\'on a vu avant.', 'Préparer, vérifier, transiter : et après la transition ?'],
          solution: '1. Préparer sur PST ; 2. vérifier au moniteur preset ; 3. la transition ; 4. les bus s\'échangent (flip-flop).',
        },
        pick(rnd, TALLY),
      ];
    },
  },
  'real-incrustations': {
    titre: 'Calculer une incrustation',
    consigne: 'Au poste Habillage et au Truquiste : tu calcules ce que donne une incrustation pixel par pixel, tu règles une clé luminance et tu ranges les couches.',
    gen: (rnd) => {
      const fond = entre(rnd, 2, 8) * 10, fill = entre(rnd, 5, 10) * 10, k = pick(rnd, [25, 40, 50, 60, 72, 80]);
      const pgm = fond * (1 - k / 100) + fill * k / 100, inv = fond * k / 100 + fill * (1 - k / 100);
      const k2 = pick(rnd, [20, 35, 50, 60, 72, 85]);
      const Y = entre(rnd, 4, 9) * 10, clip = pick(rnd, [20, 30, 40, 50]), gain = pick(rnd, [1, 2, 3, 4]);
      const kl = Math.min(100, Math.max(0, (Y - clip) * gain));
      return [
        {
          type: 'nombre', unite: '%', answer: Math.round(pgm * 10) / 10, tol: 0.5,
          q: `En un point de l'image, le fond est à **${fond} %** de luminance, le fill du bandeau à **${fill} %**, et le key vaut **${k} %**. Quelle luminance au programme ? (PGM = fond × (1 − k) + fill × k)`,
          pieges: [{ v: Math.round(inv * 10) / 10, why: 'Les poids sont inversés : c\'est le fill qui est multiplié par k, le fond par (1 − k).' }].filter((p) => Math.abs(p.v - pgm) > 0.6),
          aides: ['Le key dit la part du fill ; le reste revient au fond.', `${fond} × ${fr(1 - k / 100, 2)} + ${fill} × ${fr(k / 100, 2)}.`],
          solution: `${fond} × ${fr(1 - k / 100, 2)} + ${fill} × ${fr(k / 100, 2)} = **${fr(pgm, 1)} %**.`,
        },
        {
          type: 'nombre', unite: '%', answer: 100 - k2,
          q: `Le fond semi-transparent du bandeau vaut **${k2} %** dans le key. À combien de pour cent voit-on l'image du match derrière lui ?`,
          pieges: [{ v: k2, why: `${k2} % est la part du fill (le bandeau) ; l'image derrière garde le reste.` }].filter((p) => p.v !== 100 - k2),
          aides: ['Le key dit combien de fill on veut ; le fond garde ce qui reste.', '100 % − k.'],
          solution: `100 − ${k2} = **${100 - k2} %** de l'image du match.`,
        },
        {
          type: 'nombre', unite: '%', answer: kl,
          q: `Clé luminance : k = (Y − clip) × gain, bornée entre 0 et 100 %. Un point du logo a une luminance Y de **${Y} %** ; le clip est à **${clip} %** et le gain à **${gain}**. Que vaut le key en ce point ?`,
          pieges: [{ v: Math.max(0, (Y - clip) * gain), why: 'Le key ne dépasse jamais 100 % : au-delà, le fill remplace entièrement le fond.' }, { v: Y - clip, why: 'Il manque le gain : il multiplie l\'écart au seuil.' }].filter((p) => p.v !== kl),
          aides: ['Retire d\'abord le seuil (clip) à la luminance.', `(${Y} − ${clip}) × ${gain}, puis borne à 100 %.`],
          solution: `(${Y} − ${clip}) × ${gain} = ${(Y - clip) * gain} %${(Y - clip) * gain > 100 ? ', borné à **100 %**' : ` : **${kl} %**`}. Un gain fort fait passer vite de 0 à 100 % : les bords se durcissent.`,
        },
        pick(rnd, COUCHES),
      ];
    },
  },
  'real-ordres': {
    titre: 'Le temps du direct',
    consigne: 'Au poste Scripte : tu comptes en timecode, tu remets les ordres du réalisateur dans l\'ordre et tu dis qui fait quoi.',
    gen: (rnd) => {
      const f0 = ((entre(rnd, 20, 21) * 60 + entre(rnd, 0, 59)) * 60 + entre(rnd, 0, 59)) * 25 + entre(rnd, 0, 24);
      const N = entre(rnd, 8, 70), juste = tc(f0 + N);
      // l'erreur classique : compter les images jusqu'à 29, comme à 30 images par seconde
      const faux30 = tc(Math.floor(f0 / 25) * 30 + (f0 % 25) + N, 30);
      const O = pick(rnd, ORDRES);
      const D = entre(rnd, 10, 240), f1 = ((21 * 60 + entre(rnd, 0, 50)) * 60 + entre(rnd, 0, 50)) * 25 + entre(rnd, 0, 24);
      return [
        {
          type: 'texte', forme: 'ip', accept: [juste], placeholder: '21:04:13:24',
          q: `La scripte note un tir à **${tc(f0)}** (25 images par seconde, images de 00 à 24). Le but arrive **${N} images** plus tard. Quel timecode note-t-elle ?`,
          pieges: [{ v: faux30, why: 'À 25 images par seconde, les images vont de 00 à 24 : la seconde change après l\'image 24, pas après la 29.' }].filter((p) => p.v !== juste),
          aides: ['Ajoute les images, puis fais passer à la seconde suivante chaque paquet de 25.', `${N} images = ${Math.floor(N / 25)} s et ${N % 25} images ; ajoute-les à ${tc(f0)}.`],
          solution: `${tc(f0)} + ${N} images = **${juste}**.`,
        },
        {
          type: 'nombre', unite: 'images', answer: D,
          q: `Une action commence à **${tc(f1)}** et se termine à **${tc(f1 + D)}**. Combien d'images dure-t-elle (25 images par seconde) ?`,
          aides: ['Passe les deux timecodes en images, ou compte les secondes entières puis les images.', 'Une seconde vaut 25 images ; une minute, 1 500.'],
          solution: `${Math.floor(D / 25)} s et ${D % 25} images : **${D} images** (${fr(D / 25, 2)} s).`,
        },
        {
          type: 'ordre', q: O.q, items: O.items,
          aides: ['Un ordre s\'annonce toujours avant d\'être déclenché.', 'Cherche d\'abord la première et la dernière étape.'],
          solution: O.items.map((x, k) => `${k + 1}. ${x}`).join('\n'),
        },
        pick(rnd, ROLES),
      ];
    },
  },
});
