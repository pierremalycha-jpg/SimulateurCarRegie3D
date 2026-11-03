// @ts-check
import { registerExos, entre, pick, fr } from '../exo.js';
import { MODELES, CANAUX, LIGNE, ARTNET, SACN, empreinte, suivante, dernier, valeur8, absolue, dip, deDip, diagLigne, portAddress, sacnMulticast, liaison } from '../../labo/calc/dmx.js';
import { suivre, modifier, LYRES, pas, position16, formeEffet, tourEffet, tourChaser } from '../../labo/calc/show.js';
import { cadence, ecartTache, phases, debitUnivers, versPortAddress, dipLeves } from '../lumiere_commande_calc.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « La lumière » (v19.29), partie « Commander la lumière » : patcher à la
// suite, lire une adresse univers.adresse et des commutateurs DIP ; la trame et le diagnostic d'une ligne ;
// suivre une conduite en tracking et en Cue Only, un chaser ; le pas d'une lyre en 8 et 16 bits, les formes
// d'un effet ; Art-Net (Port-Address, à partir de 0) et sACN (multicast), le débit d'un réseau lumière. Les
// réponses sont calculées par les fonctions des ateliers du Labo (labo/calc/dmx.js, labo/calc/show.js) et
// cours/lumiere_commande_calc.js.
// ----------------------------------------------------------------------------------
const trois = (a) => String(a).padStart(3, '0');
/** les appareils tirés : modèle et mode (labo/calc/dmx.js) */
const APPAREILS = [['par', '4 canaux'], ['par', '8 canaux'], ['lyre', '16 canaux'], ['lyre', '24 canaux'], ['panneau', '4 canaux'], ['decoupe', '5 canaux'], ['gradateur', '6 canaux']];
/** l'appareil avec son article : « une lyre spot en mode 16 canaux » */
const ARTICLE = { par: 'un', lyre: 'une', panneau: 'un', decoupe: 'une', gradateur: 'un' };
const nomApp = (m, mode) => `${ARTICLE[m]} ${m === 'par' ? MODELES[m].nom : MODELES[m].nom[0].toLowerCase() + MODELES[m].nom.slice(1)} en mode ${mode}`;
/** une phrase qui commence par une minuscule */
const minus = (t) => t[0].toLowerCase() + t.slice(1);

// ---------------- la ligne : les défauts et leurs remèdes ----------------
const REMEDE = {
  terminaison: 'Poser une terminaison de 120 Ω sur la sortie du dernier appareil',
  charge: 'Partager les appareils entre les sorties d\'un splitter',
  longueur: 'Rapprocher la source des projecteurs : un splitter ou un nœud à mi-chemin',
  y: 'Supprimer le Y : un splitter, une sortie par branche',
};
const PAS_CA = {
  terminaison: 'La ligne est terminée au bout : ce n\'est pas son défaut.',
  charge: 'Il y a moins de 32 récepteurs sur la ligne : la charge n\'est pas en cause.',
  longueur: 'La ligne est bien plus courte que 300 m : la longueur n\'est pas en cause.',
  y: 'La ligne n\'a pas de dérivation en Y.',
};
const BROCHES = [['la masse (le blindage)', 1], ['Data −', 2], ['Data +', 3]];

// ---------------- la console ----------------
const PROJ = [['Contre', 'le contre', 'il'], ['Face', 'la face', 'elle'], ['Decor', 'le décor', 'il']];

registerExos({
  'lumiere-dmx': {
    titre: 'Patcher un univers à la suite',
    consigne: 'Au montage du plateau, vous patchez les projecteurs à la suite dans l\'univers, vous réglez leurs adresses et vous traduisez les demandes du réalisateur en valeurs DMX.',
    gen(rnd) {
      const [m1, mo1] = pick(rnd, APPAREILS), [m2, mo2] = pick(rnd, APPAREILS);
      const a1 = entre(rnd, 0, 40) * 4 + 1, fp1 = empreinte(m1, mo1), a2 = suivante(a1, fp1), fp2 = empreinte(m2, mo2);
      const pct = entre(rnd, 2, 19) * 5, v = valeur8(pct);
      const u = entre(rnd, 2, 6), ad = entre(rnd, 1, CANAUX), abs = absolue(u, ad);
      let ad2 = entre(rnd, 5, 400); while (dipLeves(ad2).length < 2) ad2++;
      const leves = dipLeves(ad2), adDip = deDip(dip(ad2));
      return [
        {
          type: 'nombre', q: `Vous patchez **${nomApp(m1, mo1)}** à l'adresse **${a1}**. À quelle adresse réglez-vous l'appareil suivant, sans trou ni chevauchement ?`, answer: a2,
          pieges: [{ v: dernier(a1, fp1), why: 'C\'est le dernier canal du premier appareil (adresse + empreinte − 1) : le suivant commencerait dessus, en conflit.' }],
          aides: ['Combien de canaux occupe ce modèle dans ce mode ? C\'est son empreinte.', 'Le suivant commence à adresse + empreinte.'],
          solution: `L'empreinte est de ${fp1} canaux : ${a1} + ${fp1} = **${a2}**. Le premier occupe les canaux ${a1} à ${dernier(a1, fp1)}.`,
        },
        {
          type: 'nombre', q: `À l'adresse ${a2}, vous patchez ensuite **${nomApp(m2, mo2)}**. Quel est son dernier canal ?`, answer: dernier(a2, fp2),
          pieges: [{ v: suivante(a2, fp2), why: 'C\'est l\'adresse de l\'appareil suivant ; le dernier canal est adresse + empreinte − 1.' }],
          aides: [`Ce mode compte ${fp2} canaux, le premier étant l'adresse elle-même.`, 'Dernier canal = adresse + empreinte − 1.'],
          solution: `${a2} + ${fp2} − 1 = **${dernier(a2, fp2)}** : l'appareil occupe les canaux ${a2} à ${dernier(a2, fp2)}.`,
        },
        {
          type: 'nombre', q: `Le réalisateur demande la face à **${pct} %**. Quelle valeur DMX (0 à 255, arrondie à l'unité) sort sur son canal d'intensité ?`, answer: v, tol: 0.5,
          pieges: [{ v: pct, why: 'Un canal DMX ne compte pas de 0 à 100 mais de 0 à 255 : il faut convertir le pourcentage.' }],
          aides: ['100 % correspond à 255, la plus grande valeur d\'un octet.', 'Valeur = pourcentage ÷ 100 × 255, arrondie.'],
          solution: `${pct} ÷ 100 × 255 = ${fr(pct / 100 * 255, 2)}, arrondi à **${v}**.`,
        },
        {
          type: 'nombre', q: `Le plan de feu indique « **${u}.${trois(ad)}** » pour une découpe. La console compte les adresses d'un seul tenant : quelle adresse absolue tapez-vous ?`, answer: abs,
          pieges: [{ v: u * CANAUX + ad, why: `L'univers 1 commence à 1 : il faut compter les univers qui précèdent, ${u} − 1, pas ${u}.` }],
          aides: ['Avant l\'univers ' + u + ', il y a les univers 1 à ' + (u - 1) + ', de 512 canaux chacun.', 'Adresse absolue = (univers − 1) × 512 + adresse.'],
          solution: `(${u} − 1) × 512 + ${ad} = **${fr(abs)}**.`,
        },
        {
          type: 'nombre', q: `Un vieux PAR n'a que des commutateurs DIP. Ceux qui valent **${leves.join(', ')}** sont levés. Quelle est son adresse ?`, answer: adDip,
          aides: ['Chaque commutateur levé ajoute sa valeur (1, 2, 4, 8… 256).', 'Additionnez les valeurs des commutateurs levés.'],
          solution: `${leves.join(' + ')} = **${adDip}**.`,
        },
      ];
    },
  },
  'lumiere-ligne': {
    titre: 'Rendre une ligne DMX fiable',
    consigne: 'Le plateau est câblé en DMX. Vous calculez la cadence de la ligne, vous trouvez ce qui cloche et vous prévoyez les splitters.',
    gen(rnd) {
      const n = pick(rnd, [64, 96, 128, 192, 256, 320, 384, 448, 512]), K = cadence(n);
      // un seul défaut par ligne
      const SC = [
        { id: 'terminaison', L: { recepteurs: entre(rnd, 8, 24), longueur: entre(rnd, 6, 20) * 10, terminaison: false, y: false, splitter: 0 }, dit: (L) => `${L.recepteurs} projecteurs en chaîne, ${L.longueur} m de câble DMX, rien sur la sortie du dernier. Les derniers projecteurs clignotent par moments.` },
        { id: 'charge', L: { recepteurs: entre(rnd, 36, 60), longueur: entre(rnd, 6, 20) * 10, terminaison: true, y: false, splitter: 0 }, dit: (L) => `${L.recepteurs} projecteurs LED en chaîne sur une seule sortie, ${L.longueur} m de câble, terminaison au bout. Les derniers décrochent.` },
        { id: 'longueur', L: { recepteurs: entre(rnd, 6, 20), longueur: entre(rnd, 40, 60) * 10, terminaison: true, y: false, splitter: 0 }, dit: (L) => `${L.recepteurs} projecteurs au bout de ${L.longueur} m de câble DMX, terminaison au bout. Au bout, les valeurs sont parfois fausses.` },
        { id: 'y', L: { recepteurs: entre(rnd, 8, 20), longueur: entre(rnd, 6, 20) * 10, terminaison: true, y: true, splitter: 0 }, dit: (L) => `${L.recepteurs} projecteurs, ${L.longueur} m de câble ; au milieu, un câble en Y envoie la ligne vers jardin et vers cour. Les deux branches clignotent.` },
      ];
      const sc = pick(rnd, SC), D = diagLigne(sc.L), id = D.pb.length ? D.pb[0].id : sc.id;
      const ordre = ['terminaison', 'charge', 'longueur', 'y'];
      const R = entre(rnd, 40, 150);
      let b = 1; while (!diagLigne({ recepteurs: R, longueur: 100, terminaison: true, y: false, splitter: b }).ok) b++;
      const [nomB, noB] = pick(rnd, BROCHES);
      return [
        {
          type: 'nombre', q: `La console envoie **${n} canaux** par trame (coupure de 176 µs, marque de 12 µs, 44 µs par créneau). Combien dure une trame, en millisecondes ?`, answer: K.ms, tol: 0.05, unite: 'ms',
          pieges: [{ v: n * 44 / 1000, why: 'Il manque la coupure, la marque et le code de début, qui prend un créneau lui aussi.' }],
          aides: ['Le code de début occupe un créneau de 44 µs avant les canaux.', 'Durée = 176 + 12 + (canaux + 1) × 44 µs, puis divisez par 1 000.'],
          solution: `176 + 12 + ${n + 1} × 44 = ${fr(K.us)} µs, soit **${fr(K.ms, 2)} ms**.`,
        },
        {
          type: 'nombre', q: `Avec ces ${n} canaux, combien de trames par seconde la ligne transmet-elle (à l'unité près) ?`, answer: K.hz, tol: 1,
          aides: ['Une seconde, c\'est 1 000 000 µs.', 'Trames par seconde = 1 000 000 ÷ durée d\'une trame en µs.'],
          solution: `1 000 000 ÷ ${fr(K.us)} ≈ **${fr(K.hz, 1)}** trames par seconde.`,
        },
        {
          type: 'choix', q: `${sc.dit(sc.L)} Que faites-vous ?`,
          choices: [...ordre.map((k) => (k === id ? REMEDE[k] : /** @type {[string, string]} */ ([REMEDE[k], PAS_CA[k]]))), ['Changer l\'adresse du premier projecteur', 'Une adresse règle ce qu\'un appareil lit ; elle ne change rien au signal électrique de la ligne.']], answer: ordre.indexOf(id),
          aides: ['Repassez les quatre règles : 32 récepteurs, environ 300 m, une terminaison au bout, pas de Y.', 'Une seule de ces règles n\'est pas tenue ici.'],
          solution: `${D.pb.length ? D.pb[0].t : ''} Remède : **${minus(REMEDE[id])}**.`,
        },
        {
          type: 'nombre', q: `Il faut commander **${R} projecteurs LED** depuis une seule sortie de console. Combien de sorties de splitter au minimum, chacune une ligne en chaîne ?`, answer: b,
          pieges: [{ v: Math.max(1, Math.floor(R / LIGNE.recepteurs)), why: 'Arrondir au-dessous laisse une branche à plus de 32 récepteurs.' }].filter((p) => p.v !== b),
          aides: [`Une branche porte ${LIGNE.recepteurs} récepteurs au plus.`, `Divisez ${R} par ${LIGNE.recepteurs} et arrondissez au-dessus.`],
          solution: `${R} ÷ ${LIGNE.recepteurs} = ${fr(R / LIGNE.recepteurs, 2)}, arrondi au-dessus : **${b} sorties**, chacune terminée au bout.`,
        },
        {
          type: 'choix', q: `Vous refaites la fiche XLR 5 broches d'un câble DMX coupé. Le fil qui porte **${nomB}** va sur…`,
          choices: BROCHES.map(([nm, k]) => (k === noB ? `la broche ${k}` : /** @type {[string, string]} */ ([`la broche ${k}`, `La broche ${k}, c'est ${nm}.`]))), answer: BROCHES.findIndex((x) => x[1] === noB),
          aides: ['Les broches 4 et 5 portent une seconde paire, peu utilisée.', '1 : la masse ; puis la paire de données, le − avant le +.'],
          solution: `**Broche ${noB}** : 1 la masse, 2 Data −, 3 Data +, 4 et 5 la seconde paire.`,
        },
      ];
    },
  },
  'lumiere-console': {
    titre: 'Suivre une conduite en tracking',
    consigne: 'En répétition, vous lisez la conduite de la séquence principale, vous retouchez une cue en tracking ou en Cue Only, et vous réglez un chaser.',
    gen(rnd) {
      const [P, nomP, pron] = pick(rnd, PROJ), autre = PROJ.find((x) => x[0] !== P);
      const v = () => entre(rnd, 1, 10) * 10;
      /** @type {{ no: number, values: Record<string, Record<string, number>> }[]} */
      const L = [{ no: 1, values: { [P]: { DIM: v() }, [autre[0]]: { DIM: v() } } }, { no: 2, values: {} }, { no: 3, values: {} }, { no: 4, values: {} }];
      for (const k of [1, 2, 3]) { if (rnd() < 0.45) L[k].values[P] = { DIM: v() }; if (rnd() < 0.6 || !Object.keys(L[k].values).length) L[k].values[autre[0]] = { DIM: v() }; }
      const ecrit = L.map((c) => `- Cue ${c.no} : ${Object.entries(c.values).map(([f, a]) => `${PROJ.find((x) => x[0] === f)[1]} ${a.DIM} %`).join(', ')}`).join('\n');
      const etat = suivre(L), avant2 = etat[1][P].DIM;
      let X = v(); while (X === avant2) X = v();
      const tr = suivre(modifier(L, 1, P, 'DIM', X, false))[2][P].DIM, co = suivre(modifier(L, 1, P, 'DIM', X, true))[2][P].DIM;
      const c3 = L[2].values[P] ? ` La cue 3 enregistre elle-même ${nomP} (${L[2].values[P].DIM} %) : la retouche s'y arrête.` : '';
      const nPas = entre(rnd, 3, 8), bpm = pick(rnd, [60, 90, 120, 150, 180]), tour = tourChaser(bpm, nPas);
      const grp = entre(rnd, 2, 9), lvl = entre(rnd, 5, 10) * 10, pr = entre(rnd, 1, 6), cue = entre(rnd, 2, 12);
      return [
        {
          type: 'nombre', q: `La séquence, en tracking (seules les valeurs enregistrées sont écrites) :\n${ecrit}\n\nÀ quel niveau est **${nomP}** à la cue 4 ?`, answer: etat[3][P].DIM, unite: '%',
          aides: ['En tracking, une valeur reste jusqu\'à ce qu\'une cue la change.', `Remontez de la cue 4 vers la cue 1 : la première cue qui enregistre ${nomP} donne la valeur.`],
          solution: `${nomP[0].toUpperCase() + nomP.slice(1)} est à **${etat[3][P].DIM} %** : c'est la dernière valeur enregistrée jusqu'à la cue 4.`,
        },
        {
          type: 'nombre', q: `Vous mettez ${nomP} à **${X} %** dans la cue 2 et vous enregistrez **en tracking**. À quel niveau est-${pron} à la cue 3 ?`, answer: tr, unite: '%',
          pieges: co !== tr ? [{ v: co, why: 'C\'est ce que donnerait un enregistrement en Cue Only ; en tracking, la retouche se propage.' }] : [],
          aides: ['En tracking, la retouche se propage aux cues suivantes…', '… jusqu\'à la première cue qui enregistre elle-même ce projecteur.'],
          solution: `**${tr} %**.${c3 || ' La cue 3 n\'enregistre pas ce projecteur : la nouvelle valeur la traverse.'}`,
        },
        {
          type: 'nombre', q: `Même retouche (${nomP} à ${X} % dans la cue 2), mais enregistrée **en Cue Only**. À quel niveau est-${pron} à la cue 3 ?`, answer: co, unite: '%',
          pieges: co !== tr ? [{ v: tr, why: 'C\'est le résultat en tracking ; en Cue Only, la suite reste comme avant.' }] : [],
          aides: ['En Cue Only, la retouche ne doit pas changer la suite de la conduite.', 'La console écrit l\'ancienne valeur dans la cue 3 si celle-ci ne l\'enregistrait pas.'],
          solution: `**${co} %**, comme avant la retouche : en Cue Only, la cue 3 garde ce qu'elle donnait.${c3}`,
        },
        {
          type: 'nombre', q: `Un chaser de **${nPas} pas** tourne à **${bpm} BPM** (pas par minute). Combien de secondes dure un tour complet ?`, answer: tour, tol: 0.05, unite: 's',
          pieges: [{ v: 60 / bpm, why: 'C\'est la durée d\'un seul pas ; un tour en compte ' + nPas + '.' }],
          aides: [`À ${bpm} pas par minute, un pas dure 60 ÷ ${bpm} s.`, 'Un tour = nombre de pas × durée d\'un pas.'],
          solution: `${nPas} × 60 ÷ ${bpm} = **${fr(tour, 2)} s**.`,
        },
        {
          type: 'ordre', q: `Vous programmez la cue ${cue} : les projecteurs du groupe ${grp} à ${lvl} %, dans la couleur du preset 4.${pr}. Remettez les gestes dans l'ordre.`,
          items: [`Sélectionner : Group ${grp}`, `Donner les valeurs : At ${lvl}, puis Preset 4.${pr}`, `Enregistrer : Store Cue ${cue}`, 'Vider le programmeur : Clear', 'Rejouer la séquence (Go) pour vérifier'],
          aides: ['On ne peut donner une valeur qu\'à des projecteurs sélectionnés.', 'On enregistre ce qui est dans le programmeur, puis on le vide, sinon il garde la priorité sur la lecture.'],
          solution: 'Sélection, valeurs, **Store**, **Clear**, puis **Go** : le programmeur vidé, on voit ce que la séquence joue vraiment.',
        },
      ];
    },
  },
  'lumiere-lyres': {
    titre: 'Viser juste avec une lyre',
    consigne: 'Une lyre doit viser une présentatrice et faire un effet à l\'antenne. Vous calculez la précision de son pan et de son tilt, et vous réglez l\'effet.',
    gen(rnd) {
      const COURSES = [['le pan', LYRES['gen-spot'].pan, 'Le pan de cette lyre'], ['le tilt', LYRES['gen-spot'].tilt, 'Le tilt de cette lyre'], ['le pan', [-315, 315], 'Le pan d\'une lyre d\'un autre modèle']];
      const [nom, c, phrase] = /** @type {[string, [number, number], string]} */ (pick(rnd, COURSES)), P = pas(c), ampl = c[1] - c[0];
      const d = entre(rnd, 8, 40), e = ecartTache(P.huit, d) * 100;
      const ang = Math.round((c[0] + ampl * (0.1 + 0.8 * rnd())) * 2) / 2, p16 = position16(ang, c);
      // un huit demande un tilt deux fois plus rapide sans déphasage (0° ou 180° ; à 90°, il se referme en arc)
      const mult = pick(rnd, [1, 1, 1, 2]), dph = mult === 2 ? pick(rnd, [0, 180]) : pick(rnd, [0, 30, 45, 60, 90, 120, 135, 180]), forme = formeEffet(dph, mult);
      const FORMES = ['cercle', 'droite', 'ellipse', 'huit'];
      const POURQUOI = { cercle: 'Un cercle demande la même vitesse et 90° de déphasage.', droite: 'Une droite vient d\'un déphasage de 0° ou de 180° à même vitesse.', ellipse: 'Une ellipse vient d\'un déphasage entre 0° et 90° (ou entre 90° et 180°) à même vitesse.', huit: 'Un huit demande un tilt deux fois plus rapide que le pan, sans déphasage.' };
      const bpm = pick(rnd, [12, 15, 20, 24, 30, 40, 60, 90, 120]), nL = pick(rnd, [3, 4, 5, 6, 8, 9, 10, 12]), ph = phases(nL)[1];
      const fin = pick(rnd, [
        {
          type: 'nombre', q: `Un effet de position tourne à **${bpm} BPM**. Combien de secondes dure un tour ?`, answer: tourEffet(bpm), tol: 0.02, unite: 's',
          aides: ['BPM : battements, ici tours, par minute.', 'Durée d\'un tour = 60 ÷ BPM.'],
          solution: `60 ÷ ${bpm} = **${fr(tourEffet(bpm), 2)} s**.`,
        },
        {
          type: 'nombre', q: `**${nL} lyres** en ligne font une vague : la phase est répartie sur 360°. Quel déphasage entre deux lyres voisines, en degrés ?`, answer: ph, tol: 0.1, unite: '°',
          aides: ['Les lyres se partagent un tour complet.', 'Déphasage = 360 ÷ nombre de lyres.'],
          solution: `360 ÷ ${nL} = **${fr(ph, 1)}°** : 0°, ${fr(ph, 1)}°, ${fr(2 * ph, 1)}°…`,
        },
      ]);
      return [
        {
          type: 'nombre', q: `${phrase} couvre **${ampl}°**. Codé sur 8 bits, combien de degrés vaut un pas ?`, answer: P.huit, tol: 0.01, unite: '°',
          aides: ['8 bits : 256 valeurs, donc 255 pas de 0 à 255.', `Pas = ${ampl} ÷ 255.`],
          solution: `${ampl} ÷ 255 = **${fr(P.huit, 2)}°** par pas. En 16 bits : ${ampl} ÷ 65 535 = ${fr(P.seize, 4)}°.`,
        },
        {
          type: 'nombre', q: `La lyre vise une présentatrice à **${d} m**. Avec ce pas de 8 bits, de combien de centimètres la tache saute-t-elle d'un pas à l'autre ?`, answer: e, tol: Math.max(0.5, e * 0.02), unite: 'cm',
          aides: ['Le saut est le côté opposé d\'un triangle dont la distance est le côté adjacent.', `Saut = distance × tan(pas), puis × 100 pour des centimètres.`],
          solution: `${d} × tan ${fr(P.huit, 2)}° = ${fr(e / 100, 3)} m, soit **${fr(e, 1)} cm** : bien trop pour viser un visage. En 16 bits, ${fr(ecartTache(P.seize, d) * 1000, 1)} mm.`,
        },
        {
          type: 'nombre', q: `En 16 bits, ${nom} (de ${fr(c[0]).replace('-', '−')}° à ${fr(c[1])}°) doit aller à **${fr(ang, 1).replace('-', '−')}°**. Quelle valeur prend l'octet **grossier** (le premier canal) ?`, answer: p16.grossier,
          aides: ['Ramenez l\'angle à une fraction de la course, puis à une valeur de 0 à 65 535.', 'Valeur 16 bits = (angle − début de course) ÷ course × 65 535 ; grossier = partie entière de cette valeur ÷ 256.'],
          solution: `(${fr(ang, 1).replace('-', '−')} − (${fr(c[0]).replace('-', '−')})) ÷ ${ampl} × 65 535 ≈ ${fr(p16.v16)} ; ${fr(p16.v16)} = ${p16.grossier} × 256 + ${p16.fin} : grossier **${p16.grossier}**, fin ${p16.fin}.`,
        },
        {
          type: 'choix', q: `Effet de position : pan et tilt en sinus de même amplitude, le tilt déphasé de **${dph}°**${mult === 2 ? ' et **deux fois plus rapide** que le pan' : ', à la même vitesse'}. La tache décrit…`,
          choices: FORMES.map((x) => (x === forme ? `un ${x}` : /** @type {[string, string]} */ ([x === 'ellipse' || x === 'droite' ? `une ${x}` : `un ${x}`, POURQUOI[x]]))), answer: FORMES.indexOf(forme),
          aides: ['À même vitesse, c\'est le déphasage qui fait la forme ; à vitesse double, c\'est le rapport des vitesses.', '0° ou 180° : droite ; 90° : cercle ; entre les deux : ellipse ; tilt × 2 : huit.'],
          solution: `**${forme === 'ellipse' || forme === 'droite' ? 'Une' : 'Un'} ${forme}**. ${POURQUOI[forme]}`,
        },
        fin,
      ];
    },
  },
  'lumiere-reseau': {
    titre: 'Configurer le réseau lumière',
    consigne: 'La console sort ses univers sur un réseau Ethernet séparé, vers des nœuds près des projecteurs. Vous réglez les nœuds et vous vérifiez ce qui passe.',
    gen(rnd) {
      const u = entre(rnd, 1, 1200), mc = sacnMulticast(u), inv = `239.255.${u & 255}.${(u >> 8) & 255}`;
      const net = entre(rnd, 0, 2), sub = entre(rnd, 0, 15), uni = entre(rnd, 0, 15), pa = portAddress(net, sub, uni);
      // la liaison : un seul défaut, ou aucun
      const uc = entre(rnd, 1, 40), cible = versPortAddress(uc);
      const cons = { ip: `2.0.0.${entre(rnd, 2, 50)}`, masque: '255.0.0.0', protocole: /** @type {'artnet' | 'sacn'} */ ('artnet'), univers: uc };
      const nd = { ip: `2.0.1.${entre(rnd, 2, 250)}`, masque: '255.0.0.0', protocole: /** @type {'artnet' | 'sacn'} */ ('artnet'), net: cible.net, sub: cible.sub, uni: cible.uni, sacn: uc };
      const cas = pick(rnd, ['ok', 'reseau', 'univers', 'protocole', 'ok-sacn']);
      if (cas === 'reseau') { nd.ip = `192.168.${entre(rnd, 0, 9)}.${entre(rnd, 2, 250)}`; nd.masque = '255.255.255.0'; }
      if (cas === 'univers') { const faux = versPortAddress(uc + 1); nd.net = faux.net; nd.sub = faux.sub; nd.uni = faux.uni; }
      if (cas === 'protocole') nd.protocole = 'sacn';
      if (cas === 'ok-sacn') { cons.protocole = 'sacn'; nd.protocole = 'sacn'; }
      const Lk = liaison(cons, nd), id = Lk.ok ? 'ok' : Lk.pb[0].id;
      const ISSUES = [['ok', 'Il reçoit : rien à corriger', 'Quelque chose empêche la liaison : relisez les adresses, le protocole et l\'univers.'], ['reseau', 'Il ne reçoit pas : pas dans le même sous-réseau', 'Les deux adresses sont dans le même sous-réseau.'], ['univers', 'Il ne reçoit pas : il écoute un autre univers', 'L\'univers écouté est bien celui que la console envoie.'], ['protocole', 'Il ne reçoit pas : pas le même protocole', 'Les deux parlent le même protocole.']];
      const dit = (o, qui) => `${qui} en ${o.ip}, masque ${o.masque}, ${o.protocole === 'artnet' ? 'Art-Net' : 'sACN'}`;
      const ecoute = nd.protocole === 'artnet' ? `réglé Net ${nd.net}, Sub-Net ${nd.sub}, Universe ${nd.uni}` : `abonné à l'univers sACN ${nd.sacn}`;
      const N = pick(rnd, [8, 16, 24, 32, 48, 64, 100, 128]), mb = debitUnivers(N) / 1000;
      const proto = pick(rnd, [['Art-Net', ARTNET.port, SACN.port], ['sACN', SACN.port, ARTNET.port]]);
      return [
        {
          type: 'texte', forme: 'ip', placeholder: '239.255.0.1', q: `La console envoie l'univers **${u}** en sACN. Vers quelle adresse multicast ?`, accept: mc,
          pieges: inv !== mc ? [{ v: inv, why: 'Les deux octets sont inversés : l\'octet de poids fort (univers ÷ 256) vient d\'abord.' }] : [],
          aides: ['sACN envoie chaque univers vers un groupe 239.255.x.y.', `x = partie entière de ${u} ÷ 256, y = le reste.`],
          solution: `${u} = ${u >> 8} × 256 + ${u & 255} : **${mc}**, port UDP ${SACN.port}.`,
        },
        {
          type: 'nombre', q: `Un nœud Art-Net est réglé **Net ${net}, Sub-Net ${sub}, Universe ${uni}**. Quel univers de la console (numérotés à partir de 1) reçoit-il ?`, answer: pa + 1,
          pieges: [{ v: pa, why: 'C\'est le Port-Address, compté à partir de 0 ; la console compte ses univers à partir de 1.' }],
          aides: ['Port-Address = Net × 256 + Sub-Net × 16 + Universe, à partir de 0.', 'L\'univers de la console vaut le Port-Address + 1.'],
          solution: `${net} × 256 + ${sub} × 16 + ${uni} = Port-Address ${pa}, soit l'univers **${pa + 1}** de la console.`,
        },
        {
          type: 'choix', q: `${dit(cons, 'Console')}, univers ${uc} (à partir de 1). ${dit(nd, 'Nœud')}, ${ecoute}. Le nœud reçoit-il l'univers ?`,
          choices: ISSUES.map(([k, t, w]) => (k === id ? t : /** @type {[string, string]} */ ([t, w]))), answer: ISSUES.findIndex((x) => x[0] === id),
          aides: ['Vérifiez dans l\'ordre : le sous-réseau, le protocole, puis l\'univers.', `En Art-Net, l'univers ${uc} de la console part en Port-Address ${cible.pa} (Net ${cible.net}, Sub-Net ${cible.sub}, Universe ${cible.uni}).`],
          solution: Lk.ok ? '**Il reçoit** : même sous-réseau, même protocole, même univers.' : `**${ISSUES.find((x) => x[0] === id)[1]}**. ${Lk.pb[0].t}`,
        },
        {
          type: 'nombre', q: `La console envoie **${N} univers** Art-Net à 44 trames par seconde (environ 600 octets par paquet, en-têtes compris). Quel débit, en Mbit/s ?`, answer: mb, tol: Math.max(0.05, mb * 0.03), unite: 'Mbit/s',
          pieges: [{ v: N * CANAUX * 8 * 44 / 1e6, why: 'Vous n\'avez compté que les 512 octets des canaux : les en-têtes (Art-Net, UDP, IP, Ethernet) comptent aussi.' }],
          aides: ['Un univers à 44 trames par seconde fait environ 210 kbit/s.', `Débit = ${N} × débit d'un univers, puis divisez par 1 000 pour des Mbit/s.`],
          solution: `${N} × ${fr(debitUnivers(1), 1)} kbit/s ≈ **${fr(mb, 1)} Mbit/s** : peu de chose pour un lien à 1 Gbit/s.`,
        },
        {
          type: 'nombre', q: `Le pare-feu du réseau lumière doit laisser passer **${proto[0]}**. Quel port UDP ouvrez-vous ?`, answer: proto[1], brut: true,
          pieges: [{ v: proto[2], why: `C'est le port de ${proto[0] === 'Art-Net' ? 'sACN' : 'Art-Net'}.` }],
          aides: ['Art-Net et sACN ont chacun leur port UDP fixe, écrit dans leur norme.', 'Le port d\'Art-Net commence par 64, celui de sACN par 55.'],
          solution: `**${proto[1]}** pour ${proto[0]} (${proto[0] === 'Art-Net' ? 'sACN : ' + SACN.port : 'Art-Net : ' + ARTNET.port}).`,
        },
      ];
    },
  },
});
