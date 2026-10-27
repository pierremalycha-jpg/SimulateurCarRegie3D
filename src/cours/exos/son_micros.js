// @ts-check
import { registerExos, entre, pick, fr as frn } from '../exo.js';
import {
  splDePa, longueurOnde, aDistance, somme, C_SON, vDeDbu, dbuDeV, dbuDeDbv, LIGNE_PRO, LIGNE_GP,
  MICROS, mvParPa, sortieMv, sortieDbu, gainPour, ecartSens, DIRECTIVITES, attenuation, angleRejet, facteurDistance,
  uMicro, rFantome, iCourtCircuit, fuite, liaison,
} from '../son_micro_calc.js';

/** un nombre écrit à la française, avec le signe moins typographique */
const fr = (v, d = 0) => frn(v, d).replace('-', '−');
const r1 = (v) => Math.round(v * 10) / 10, r2 = (v) => Math.round(v * 100) / 100;

// ----------------------------------------------------------------------------------
// Exercices en autonomie de la partie « Capter : le son et le micro » du chapitre Le son : convertir des
// pressions en dB SPL, appliquer la loi de la distance et l'addition des sources, calculer une longueur
// d'onde ; la tension d'un micro dynamique type SM58 ou SM48 et le gain qu'il demande ; l'écart avec un
// statique ; l'atténuation et l'angle de rejet d'une directivité ; la tension qui reste à un micro sur la
// P48 ; les niveaux de ligne et ce que laisse une liaison symétrique. Les réponses sont calculées par le
// modèle des leçons (cours/son_micro_calc.js).
// ----------------------------------------------------------------------------------
const DYN = ['sm58', 'sm48'];
const nomCourt = (k) => (k === 'sm58' ? 'type SM58' : k === 'sm48' ? 'type SM48' : k);

registerExos({
  'son-acoustique': {
    titre: 'Pressions, distances et décibels',
    consigne: 'Au bord du terrain, avant le match : vous estimez le niveau que recevront les micros selon la distance et le nombre de sources, et vous convertissez les pressions en décibels.',
    gen: (rnd) => {
      const [pa, juste] = pick(rnd, [[0.02, 60], [0.2, 80], [2, 100], [20, 120], [0.063, 70], [6.3, 110]]);
      const L1 = entre(rnd, 76, 104), r = pick(rnd, [2, 4, 8, 16, 0.5, 0.25]), Lr = r1(aDistance(L1, 1, r));
      const Ls = entre(rnd, 80, 100), coh = rnd() < 0.4, tot = r1(somme(Ls, Ls, coh));
      const f = pick(rnd, [50, 100, 250, 500, 1000, 2000, 5000, 10000]), lam = longueurOnde(f);
      const paTxt = frn(pa, pa < 0.1 ? 3 : pa < 1 ? 2 : pa < 10 ? 1 : 0);
      return [
        {
          type: 'nombre', unite: 'dB SPL', answer: juste, tol: 0.6,
          q: `Un calibreur mesure une pression efficace de **${paTxt} Pa**. Combien de dB SPL ?`,
          pieges: [{ v: Math.round(10 * Math.log10(pa / 20e-6)), why: 'Une pression est une amplitude : 20 × log₁₀, pas 10 × log₁₀.' }],
          aides: ['La référence est 20 µPa ; 94 dB SPL valent 1 Pa.', `dB SPL = 20 × log₁₀(${paTxt} ÷ 0,00002).`],
          solution: `20 × log₁₀(${paTxt} ÷ 20 µPa) = **${fr(splDePa(pa), 1)} dB SPL**. Repère : 1 Pa = 94 dB SPL, et chaque facteur 10 sur la pression ajoute 20 dB.`,
        },
        {
          type: 'nombre', unite: 'dB SPL', answer: Lr, tol: 0.3,
          q: `Une frappe de balle donne **${L1} dB SPL à 1 m**. Quel niveau reçoit un canon placé à **${frn(r, 2)} m**, en champ libre ?`,
          pieges: [{ v: r1(L1 - 10 * Math.log10(r)), why: 'La pression baisse comme 1/r : 20 × log₁₀ de la distance, soit 6 dB par doublement, pas 3.' }].filter((p) => Math.abs(p.v - Lr) > 0.3),
          aides: ['En champ libre, chaque doublement de la distance retire 6 dB.', `L = ${L1} − 20 × log₁₀(${frn(r, 2)}).`],
          solution: `${L1} − 20 × log₁₀(${frn(r, 2)}) = **${fr(Lr, 1)} dB SPL**${r > 1 ? ` : ${fr(Math.log2(r), 0)} doublement${Math.log2(r) > 1 ? 's' : ''} de la distance, ${fr(Math.log2(r) * 6, 0)} dB de moins` : ' : plus près, plus fort'}.`,
        },
        {
          type: 'nombre', unite: 'dB SPL', answer: tot, tol: 0.3,
          q: `Deux sources arrivent chacune à **${Ls} dB SPL** au micro. Elles sont **${coh ? 'identiques et en phase (deux enceintes qui jouent le même signal, au même point)' : 'indépendantes (deux groupes de supporters)'}**. Quel niveau ensemble ?`,
          pieges: [{ v: Ls * 2, why: 'Les décibels ne s\'additionnent pas : ce sont des logarithmes.' }, { v: r1(somme(Ls, Ls, !coh)), why: coh ? 'Ça, c\'est pour deux sources indépendantes (+3 dB). Identiques et en phase, les pressions s\'ajoutent : +6 dB.' : 'Ça, c\'est pour deux sources identiques et en phase (+6 dB). Indépendantes, ce sont les puissances qui s\'ajoutent : +3 dB.' }],
          aides: [coh ? 'Les pressions s\'ajoutent : la pression double.' : 'Les puissances s\'ajoutent : la puissance double.', coh ? 'Doubler une pression : 20 × log₁₀(2).' : 'Doubler une puissance : 10 × log₁₀(2).'],
          solution: `${Ls} + ${coh ? '6' : '3'} = **${fr(tot, 1)} dB SPL** : ${coh ? 'deux sources identiques et en phase doublent la pression (+6 dB)' : 'deux sources indépendantes doublent la puissance (+3 dB)'}.`,
        },
        {
          type: 'nombre', unite: 'm', answer: r2(lam), tol: Math.max(0.01, lam * 0.02),
          q: `Quelle est la longueur d'onde d'un son de **${f >= 1000 ? frn(f / 1000, 0) + ' kHz' : f + ' Hz'}** dans l'air (c ≈ ${C_SON} m/s) ?`,
          pieges: [{ v: r2(f / C_SON), why: 'C\'est l\'inverse : λ = c ÷ f.' }],
          aides: ['La longueur d\'onde, c\'est la distance parcourue pendant une période.', `λ = ${C_SON} ÷ ${f}.`],
          solution: `${C_SON} ÷ ${f} = **${frn(lam, lam < 0.1 ? 3 : 2)} m**${lam > 1 ? ' : les graves ont des longueurs d\'onde de plusieurs mètres, ils contournent les obstacles' : lam < 0.05 ? ' : un aigu s\'arrête sur une tête ou un pied de micro' : ''}.`,
        },
      ];
    },
  },
  'son-dynamique': {
    titre: 'Le micro dynamique au préampli',
    consigne: 'En cabine de commentaire et sur scène, des micros dynamiques type SM58 et SM48 : vous calculez ce qu\'ils donnent, et le gain que la console doit leur ajouter.',
    gen: (rnd) => {
      const k = pick(rnd, DYN), M = MICROS[k], spl = entre(rnd, 84, 116), mv = sortieMv(M.sens, spl), dbu = sortieDbu(M.sens, spl), g = gainPour(M.sens, spl);
      const autre = k === 'sm58' ? 'sm48' : 'sm58';
      return [
        {
          type: 'nombre', unite: 'mV', answer: r2(mv), tol: Math.max(0.05, mv * 0.02),
          q: `Un micro **${nomCourt(k)}** (sensibilité **${fr(M.sens, 1)} dBV/Pa**) reçoit **${spl} dB SPL**. Quelle tension efficace donne-t-il ?`,
          pieges: [{ v: r2(mvParPa(M.sens)), why: 'C\'est sa tension sous 1 Pa (94 dB SPL) ; il faut tenir compte de l\'écart avec 94 dB.' }].filter((p) => Math.abs(p.v - mv) > 0.05),
          aides: ['Sa tension en dBV : sensibilité + (niveau − 94).', `U = 10^((${fr(M.sens, 1)} + ${spl} − 94) ÷ 20) volts.`],
          solution: `${fr(M.sens, 1)} + (${spl} − 94) = ${fr(M.sens + spl - 94, 1)} dBV, soit **${frn(mv, 2)} mV**.`,
        },
        {
          type: 'nombre', unite: 'dB', answer: r1(g), tol: 0.6,
          q: `Toujours ${spl} dB SPL sur le ${nomCourt(k)}. Quel gain d'entrée pour amener ce niveau à **0 dBu** (−18 dBFS) ?`,
          pieges: [{ v: r1(-(M.sens + spl - 94)), why: 'Vous avez oublié de passer des dBV aux dBu : dBu = dBV + 2,2.' }],
          aides: ['Gain = niveau visé − niveau du micro, en dBu.', `Le micro donne ${fr(M.sens + spl - 94, 1)} dBV ; ajoutez 2,2 pour l'avoir en dBu.`],
          solution: `Le micro donne ${fr(dbu, 1)} dBu ; gain = 0 − (${fr(dbu, 1)}) = **${fr(g, 1)} dB**.`,
        },
        {
          type: 'nombre', unite: 'dB', answer: Math.abs(ecartSens('sm58', 'sm48')),
          q: `On remplace le ${nomCourt(k)} par un **${nomCourt(autre)}** (${fr(MICROS[autre].sens, 1)} dBV/Pa), même chanteur, même distance. De combien de dB faut-il ${autre === 'sm48' ? 'monter' : 'baisser'} le gain ?`,
          aides: ['Comparez les deux sensibilités.', `${fr(MICROS.sm58.sens, 1)} et ${fr(MICROS.sm48.sens, 1)} dBV/Pa.`],
          solution: `L'écart des sensibilités : **3 dB**. Le type SM48 donne 3 dB de moins pour la même pression : ${autre === 'sm48' ? 'on monte' : 'on baisse'} le gain de 3 dB, pas le fader.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Le 48 V est allumé sur la tranche où l\'on branche un micro dynamique, par un câble XLR sain. Que faire ?',
            choices: ['Rien : le dynamique fonctionne avec ou sans 48 V', ['Couper le 48 V tout de suite, sinon la bobine grille', 'En liaison symétrique saine, les broches 2 et 3 sont au même potentiel : rien ne traverse la bobine.'], ['Monter le gain : le 48 V rend le micro moins sensible', 'Le 48 V ne change rien à un dynamique.']], answer: 0,
            aides: ['Où arrive le 48 V : sur une broche ou sur deux ?', 'La bobine est branchée entre les broches 2 et 3.'],
            solution: '**Rien** : le +48 V est sur les deux broches de modulation, la bobine ne voit aucune différence. Le risque n\'existe qu\'avec un câble défectueux ou une liaison asymétrique.',
          },
          {
            type: 'choix', q: 'Dans un micro dynamique, qu\'est-ce qui produit la tension ?',
            choices: ['La bobine qui bouge dans le champ de l\'aimant', ['La charge d\'un condensateur', 'C\'est le principe du micro statique.'], ['Le 48 V de la console', 'Le dynamique n\'utilise aucune alimentation.']], answer: 0,
            aides: ['Le micro dynamique est une petite génératrice.', 'Induction : e = B · l · v.'],
            solution: 'La **bobine** collée à la membrane se déplace dans l\'entrefer de l\'aimant : la tension apparaît par induction, sans alimentation.',
          },
          {
            type: 'ordre', q: 'Remettez dans l\'ordre le trajet du son dans un micro dynamique.',
            items: ['La grille et la mousse arrêtent le souffle des plosives', 'La pression fait bouger la membrane', 'La bobine collée à la membrane se déplace dans l\'aimant', 'Une tension apparaît aux bornes de la bobine', 'Elle sort par les broches 2 et 3 du XLR'],
            aides: ['On part de l\'extérieur du micro.', 'La tension naît du mouvement de la bobine.'],
            solution: 'Grille et mousse, membrane, bobine dans l\'aimant, tension induite, broches 2 et 3 du XLR.',
          },
        ]),
      ];
    },
  },
  'son-statique': {
    titre: 'Statique ou dynamique ?',
    consigne: 'Au bord du terrain et en tribune, des micros statiques (couples d\'ambiance, canons) et des dynamiques : vous comparez ce qu\'ils donnent et vous mettez un canon en service.',
    gen: (rnd) => {
      const sens = pick(rnd, [-40, -38, -36, -34, -32, -30, -28]), spl = entre(rnd, 70, 100), mv = 1000 * 10 ** ((sens + spl - 94) / 20);
      const ec = r1(sens - MICROS.sm58.sens);
      return [
        {
          type: 'nombre', unite: 'mV/Pa', answer: r1(mvParPa(sens)), tol: Math.max(0.1, mvParPa(sens) * 0.02),
          q: `La fiche d'un micro statique annonce **${fr(sens, 0)} dBV/Pa**. Combien de mV donne-t-il sous 1 Pa ?`,
          aides: ['0 dBV = 1 V ; −20 dBV = 0,1 V ; −40 dBV = 10 mV.', `10^(${fr(sens, 0)} ÷ 20) volts.`],
          solution: `10^(${fr(sens, 0)} ÷ 20) = **${frn(mvParPa(sens), 1)} mV/Pa**, une dizaine de fois plus qu'un dynamique type SM58 (1,9 mV/Pa).`,
        },
        {
          type: 'nombre', unite: 'dB', answer: ec, tol: 0.3,
          q: `De combien de dB ce statique (${fr(sens, 0)} dBV/Pa) est-il plus sensible qu'un dynamique type SM58 (−54,5 dBV/Pa) ?`,
          aides: ['Les deux sensibilités sont en dB : on les soustrait.', `${fr(sens, 0)} − (−54,5).`],
          solution: `${fr(sens, 0)} − (−54,5) = **${fr(ec, 1)} dB** : autant de gain en moins à la console pour le même son, et autant de marge sur le souffle du préampli.`,
        },
        {
          type: 'nombre', unite: 'mV', answer: r1(mv), tol: Math.max(0.1, mv * 0.02),
          q: `Le même statique capte une ambiance à **${spl} dB SPL**. Quelle tension donne-t-il ?`,
          aides: ['En dBV : sensibilité + (niveau − 94).', `${fr(sens, 0)} + ${spl} − 94 = ${fr(sens + spl - 94, 0)} dBV.`],
          solution: `${fr(sens + spl - 94, 0)} dBV, soit **${frn(mv, 1)} mV**.`,
        },
        pick(rnd, [
          {
            type: 'ordre', q: 'Remettez dans l\'ordre la mise en service d\'un canon du bord terrain sur sa tranche.',
            items: ['Fader baissé, écoute coupée', 'Brancher le canon (câble XLR sain)', 'Allumer le 48 V et attendre quelques secondes', 'Écouter en PFL et régler le gain', 'Ouvrir le fader dans le mélange'],
            aides: ['Le 48 V ne s\'allume jamais fader ouvert.', 'Le gain se règle en écoutant la source seule.'],
            solution: 'Fader baissé ; brancher ; 48 V, quelques secondes ; PFL et gain ; enfin le fader.',
          },
          {
            type: 'choix', q: 'Un micro-cravate à électret ne donne rien sur l\'émetteur HF dont la pile est vide. Pourquoi, alors que sa capsule est chargée à vie ?',
            choices: ['Son transistor d\'adaptation a besoin d\'une alimentation', ['La charge de l\'électret s\'est vidée avec la pile', 'La charge de l\'électret est piégée à vie : elle ne dépend pas de la pile.'], ['Un électret ne fonctionne qu\'avec le 48 V d\'une console', 'Il fonctionne avec une pile, l\'alimentation de l\'émetteur ou le 48 V, selon le modèle.']], answer: 0,
            aides: ['L\'électret remplace la polarisation, pas tout le reste.', 'La capsule a une impédance énorme.'],
            solution: 'Le **transistor** qui adapte l\'impédance de la capsule doit être alimenté : sans pile, plus rien ne sort.',
          },
          {
            type: 'choix', q: 'Une grosse caisse donne 140 dB SPL au micro. Lequel prenez-vous ?',
            choices: ['Un dynamique, ou un statique avec son atténuateur (PAD)', ['Un statique sans atténuateur', 'Vers 130 à 140 dB SPL (ordre de grandeur), l\'électronique d\'un statique sature.'], ['Un ruban', 'Le ruban est le plus fragile face aux fortes pressions et au souffle d\'air.']], answer: 0,
            aides: ['Lequel n\'a pas d\'électronique qui sature ?', 'Un PAD atténue avant l\'électronique.'],
            solution: 'Un **dynamique** encaisse sans saturer ; un statique peut le faire avec son **PAD**, en vérifiant sa pression maximale.',
          },
        ]),
      ];
    },
  },
  'son-directivite': {
    titre: 'Placer un micro selon sa directivité',
    consigne: 'Sur la scène de la mi-temps et au bord du terrain : vous calculez ce qu\'un micro rejette selon l\'angle, et où mettre le retour de scène.',
    gen: (rnd) => {
      const k = pick(rnd, ['cardio', 'super', 'hyper']), D = DIRECTIVITES[k], th = pick(rnd, [45, 60, 90, 120, 135]), att = attenuation(D, th);
      const k2 = pick(rnd, ['cardio', 'super', 'hyper']), D2 = DIRECTIVITES[k2], rej = angleRejet(D2) || 180;
      const d0 = pick(rnd, [1, 1.5, 2, 3]), k3 = pick(rnd, ['cardio', 'hyper']), D3 = DIRECTIVITES[k3], dist = r2(d0 * facteurDistance(D3));
      return [
        {
          type: 'nombre', unite: 'dB', answer: r1(att), tol: 0.3,
          q: `Un micro **${D.nom}** répond comme ${frn(D.A, 2)} + ${frn(D.B, 2)} × cos θ. De combien est atténué un son qui arrive à **${th}°** de son axe ? (une valeur négative)`,
          pieges: [{ v: r1(10 * Math.log10(Math.abs(D.A + D.B * Math.cos(th * Math.PI / 180)))), why: 'C\'est une amplitude : 20 × log₁₀, pas 10.' }],
          aides: [`Calculez d'abord ${frn(D.A, 2)} + ${frn(D.B, 2)} × cos ${th}°.`, 'Puis 20 × log₁₀ de la valeur absolue.'],
          solution: `${frn(D.A, 2)} + ${frn(D.B, 2)} × cos ${th}° = ${frn(D.A + D.B * Math.cos(th * Math.PI / 180), 3)} ; 20 × log₁₀ = **${fr(att, 1)} dB**.`,
        },
        {
          type: 'nombre', unite: '°', answer: Math.round(rej), tol: 1,
          q: `À quel angle de son axe un micro **${D2.nom}** (${frn(D2.A, 2)} + ${frn(D2.B, 2)} × cos θ) ne capte-t-il plus rien ?`,
          aides: ['Cherchez l\'angle où A + B × cos θ = 0.', `cos θ = −${frn(D2.A, 2)} ÷ ${frn(D2.B, 2)}.`],
          solution: `cos θ = −${frn(D2.A, 2)} ÷ ${frn(D2.B, 2)} : θ ≈ **${Math.round(rej)}°**. C'est là qu'on place le retour de scène${k2 === 'cardio' ? ' : juste derrière un cardioïde' : ' : de biais, pas juste derrière, où le lobe arrière capte encore'}.`,
        },
        {
          type: 'nombre', unite: 'm', answer: dist, tol: 0.05,
          q: `Un omni placé à **${frn(d0, 1)} m** d'un orateur capte un certain rapport voix / salle. À quelle distance un **${D3.nom}** (Q = ${k3 === 'cardio' ? 3 : 4}) garde-t-il le même rapport ?`,
          pieges: [{ v: r2(d0 * (k3 === 'cardio' ? 3 : 4)), why: 'Le facteur de distance est la racine carrée de Q, pas Q.' }],
          aides: ['Le facteur de distance vaut √Q.', `${frn(d0, 1)} × √${k3 === 'cardio' ? 3 : 4}.`],
          solution: `${frn(d0, 1)} × √${k3 === 'cardio' ? 3 : 4} = **${frn(dist, 2)} m** : le micro directif peut être ${frn(facteurDistance(D3), 2)} fois plus loin.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: 'Un commentateur colle son micro cardioïde : sa voix grossit, grave et sourde. Que faites-vous à la console ?',
            choices: ['Monter un peu le passe-haut de la tranche (et lui demander de garder sa distance)', ['Baisser le gain', 'Le gain baisse tout, les graves en trop restent dans la même proportion.'], ['Passer la tranche en mono', 'La voix est déjà mono : l\'effet de proximité est un excès de graves.']], answer: 0,
            aides: ['C\'est l\'effet de proximité.', 'Il ajoute des graves : quel réglage les retire ?'],
            solution: 'Le **passe-haut** (vers 100 à 150 Hz) retire les graves que l\'effet de proximité ajoute ; une distance constante évite qu\'ils varient.',
          },
          {
            type: 'choix', q: 'Pour capter l\'ambiance d\'une tribune en stéréo, que prenez-vous ?',
            choices: ['Un couple de deux cardioïdes (ORTF ou XY)', ['Un canon pointé sur la tribune', 'Le canon donne une seule voie très étroite : pas d\'image stéréo.'], ['Un dynamique tenu à la main', 'Un seul micro, peu sensible, loin de la source : ni stéréo, ni niveau.']], answer: 0,
            aides: ['Une image stéréo demande deux micros.', 'ORTF : 17 cm et 110° ; XY : capsules confondues.'],
            solution: 'Un **couple de cardioïdes** : ORTF (plus aéré) ou XY (compatible mono).',
          },
          {
            type: 'choix', q: 'Quelle directivité n\'a aucun effet de proximité ?',
            choices: ['L\'omnidirectionnel', ['Le cardioïde', 'Il mesure en partie le gradient de pression : il a un effet de proximité.'], ['La figure en 8', 'C\'est le gradient pur : l\'effet de proximité le plus fort.']], answer: 0,
            aides: ['L\'effet de proximité vient du gradient de pression.', 'Quel micro ne mesure que la pression ?'],
            solution: 'L\'**omni** ne mesure que la pression : pas d\'effet de proximité.',
          },
        ]),
      ];
    },
  },
  'son-48v': {
    titre: 'Le 48 V dans le câble',
    consigne: 'En cabine son, avant le line-up : vous vérifiez ce que la P48 laisse à chaque statique et ce qui arrive aux dynamiques branchés sur des tranches où elle est allumée.',
    gen: (rnd) => {
      const i = pick(rnd, [1.5, 2, 3, 4, 5, 6, 7, 8]), U = uMicro(i), def = rnd() < 0.5;
      const rb = pick(rnd, [150, 300, 600]), fu = fuite(rb, true);
      return [
        {
          type: 'nombre', unite: 'V', answer: r1(U), tol: 0.3,
          q: `Un micro statique demande **${frn(i, 1)} mA** sur l'alimentation fantôme P48 (deux résistances de 6,81 kΩ). Quelle tension lui reste-t-il ?`,
          pieges: [{ v: r1(48 - i / 1000 * 6810), why: 'Vu du micro, les deux résistances de 6,81 kΩ sont en parallèle : 3,405 kΩ, pas 6,81.' }],
          aides: ['Les deux résistances sont en parallèle vues du micro.', `U = 48 − ${frn(i, 1)} mA × ${frn(rFantome() / 1000, 3)} kΩ.`],
          solution: `48 − ${frn(i / 1000, 4)} × ${frn(rFantome(), 0)} = **${frn(U, 1)} V**.`,
        },
        {
          type: 'nombre', unite: 'mA', answer: r1(iCourtCircuit()), tol: 0.2,
          q: 'Quel courant au plus la P48 peut-elle donner, micro en court-circuit entre les broches 2-3 et la masse ?',
          aides: ['Toute la tension tombe alors dans les résistances.', '48 V ÷ 3 405 Ω.'],
          solution: `48 ÷ 3 405 ≈ **${frn(iCourtCircuit(), 1)} mA** : la norme prévoit 10 mA au plus par micro.`,
        },
        def ? {
          type: 'nombre', unite: 'mA', answer: r1(fu), tol: 0.2,
          q: `Un câble a sa broche 3 en court-circuit avec la masse. Le 48 V est allumé et un micro dynamique (bobine de **${rb} Ω**) est branché. Quel courant continu traverse la bobine ?`,
          aides: ['Le courant part du +48 V, passe par une résistance de 6,81 kΩ, la bobine, puis la broche 3 à la masse.', `48 ÷ (6 810 + ${rb}).`],
          solution: `48 ÷ (6 810 + ${rb}) ≈ **${frn(fu, 1)} mA** dans la bobine : bruit, déformation. On change le câble.`,
        } : {
          type: 'choix', q: 'Un micro dynamique est branché par un câble XLR sain sur une tranche où le 48 V est allumé. Quel courant continu traverse sa bobine ?',
          choices: ['Aucun : les broches 2 et 3 sont au même potentiel', ['Environ 7 mA', 'Ce serait le cas avec une broche à la masse (câble défectueux).'], ['14 mA, le maximum de la P48', 'C\'est le courant de court-circuit, pas ce que voit une bobine entre deux broches à +48 V.']], answer: 0,
          aides: ['La bobine est entre la broche 2 et la broche 3.', 'Les deux reçoivent +48 V.'],
          solution: '**Aucun** : sans différence de potentiel entre 2 et 3, rien ne traverse la bobine.',
        },
        pick(rnd, [
          {
            type: 'ordre', q: 'Remettez dans l\'ordre les gestes pour remplacer un micro statique sur une tranche en service.',
            items: ['Baisser le fader et couper l\'écoute', 'Couper le 48 V et attendre quelques secondes', 'Débrancher l\'ancien micro, brancher le nouveau', 'Rallumer le 48 V', 'Vérifier en PFL, puis rouvrir le fader'],
            aides: ['On commence toujours par protéger les enceintes.', 'On ne branche jamais à chaud.'],
            solution: 'Fader baissé ; 48 V coupé ; changer le micro ; 48 V ; PFL, puis fader.',
          },
          {
            type: 'choix', q: 'Sur quelles broches du XLR la console envoie-t-elle le +48 V ?',
            choices: ['Les broches 2 et 3, le retour par la broche 1', ['La broche 1 seule', 'La broche 1 est la masse : le courant y revient.'], ['La broche 2 seule', 'Sur une seule broche, la tension apparaîtrait dans le signal et la bobine d\'un dynamique.']], answer: 0,
            aides: ['Le signal est la différence entre 2 et 3.', 'Pour ne pas le gêner, le 48 V doit être pareil sur les deux.'],
            solution: '**2 et 3**, par deux résistances égales ; retour par la **1**.',
          },
        ]),
      ];
    },
  },
  'son-liaisons': {
    titre: 'Niveaux et liaisons',
    consigne: 'À la baie de brassage et en cabine son : vous convertissez des niveaux de ligne et vous jugez ce qu\'une liaison laisse passer d\'un parasite.',
    gen: (rnd) => {
      const d = pick(rnd, [-10, -6, 0, 4, 8, 12, 18]), v = vDeDbu(d);
      const vv = pick(rnd, [0.1, 0.245, 0.5, 1, 2, 3.1]), dv = dbuDeV(vv);
      const par = entre(rnd, 5, 80), dq = pick(rnd, [0.1, 0.5, 1, 2]), L = liaison(10, par, true, dq / 100);
      return [
        {
          type: 'nombre', unite: 'V', answer: Math.round(v * 1000) / 1000, tol: Math.max(0.005, v * 0.01),
          q: `Quelle tension efficace correspond à **${d > 0 ? '+' : ''}${fr(d, 0)} dBu** ?`,
          pieges: [{ v: Math.round(10 ** (d / 20) * 1000) / 1000, why: 'C\'est le calcul en dBV (référence 1 V) ; le dBu prend 0,775 V.' }].filter((p) => Math.abs(p.v - v) > 0.01),
          aides: ['0 dBu = 0,775 V.', `U = 0,775 × 10^(${fr(d, 0)} ÷ 20).`],
          solution: `0,775 × 10^(${fr(d, 0)} ÷ 20) = **${frn(v, 3)} V**.`,
        },
        {
          type: 'nombre', unite: 'dBu', answer: r1(dv), tol: 0.2,
          q: `Un voltmètre lit **${frn(vv, 3)} V** efficaces sur une sortie de ligne. Combien de dBu ?`,
          aides: ['dBu = 20 × log₁₀(U ÷ 0,775).', `20 × log₁₀(${frn(vv, 3)} ÷ 0,775).`],
          solution: `20 × log₁₀(${frn(vv, 3)} ÷ 0,775) = **${fr(dv, 1)} dBu**.`,
        },
        {
          type: 'nombre', unite: 'dB', answer: r1(LIGNE_PRO - dbuDeDbv(LIGNE_GP)), tol: 0.3,
          q: 'Un lecteur grand public sort à **−10 dBV**, l\'entrée de la console attend **+4 dBu**. De combien de dB la source arrive-t-elle trop bas ?',
          pieges: [{ v: 14, why: 'On ne soustrait pas des dBV et des dBu directement : −10 dBV = −7,8 dBu.' }],
          aides: ['Mettez d\'abord les deux niveaux dans la même unité.', '−10 dBV = −10 + 2,2 dBu.'],
          solution: `−10 dBV = ${fr(dbuDeDbv(-10), 1)} dBu ; +4 − (${fr(dbuDeDbv(-10), 1)}) = **${fr(LIGNE_PRO - dbuDeDbv(LIGNE_GP), 1)} dB**, environ 12 dB.`,
        },
        rnd() < 0.5 ? {
          type: 'nombre', unite: 'mV', answer: Math.round(L.reste * 1000) / 1000, tol: Math.max(0.001, L.reste * 0.02),
          q: `Un câble symétrique capte **${par} mV** de ronflement, pareil sur ses deux conducteurs ; la liaison a **${frn(dq, 1)} %** de déséquilibre. Combien de parasite reste-t-il à l'arrivée ?`,
          pieges: [{ v: par, why: 'C\'est le cas d\'une liaison asymétrique : en symétrique, la différence l\'annule, au déséquilibre près.' }],
          aides: ['En symétrique, seule la part due au déséquilibre reste.', `${par} mV × ${frn(dq, 1)} %.`],
          solution: `${par} × ${frn(dq / 100, 3)} = **${frn(L.reste, 3)} mV**, soit une réjection de ${fr(L.rejection, 0)} dB.`,
        } : {
          type: 'choix', q: 'Quel brochage pour un XLR audio (IEC 60268-12) ?',
          choices: ['1 masse, 2 point chaud, 3 point froid', ['1 point chaud, 2 point froid, 3 masse', 'La masse est toujours la broche 1.'], ['1 masse, 2 point froid, 3 point chaud', 'C\'est l\'ancien câblage de certains appareils américains : la norme met le point chaud sur la 2.']], answer: 0,
          aides: ['La masse, c\'est le blindage du câble.', 'Le point chaud est la broche 2.'],
          solution: '**1 masse, 2 point chaud, 3 point froid.** Inverser 2 et 3 inverse la polarité de la source.',
        },
      ];
    },
  },
});
