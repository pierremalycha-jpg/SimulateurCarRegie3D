// @ts-check
import { registerDefis } from '../defis.js';
import { pick, fr } from '../../cours/exo.js';
import { COURBES, GRIS, plage, gainDiaphs, expoPourGris } from '../calc/sensito.js';

// ----------------------------------------------------------------------------------
// Les défis de l'atelier « Sensitométrie » : le gris à sa place selon la courbe, garder un ciel
// lumineux sous l'écrêtage (sous-exposer ou le knee), compter les diaphs (plage utile, gain).
// L'état de l'atelier : { courbe, e (diaphs), g (dB), ciel (diaphs au-dessus du gris) } ; ses
// mesures : vGris, vBlanc, vCiel, cielEcrete, plage { diaphs, dessus, dessous }.
// ----------------------------------------------------------------------------------
const pc = (v) => fr(v * 100, 0) + ' %';
const tiers = (e) => Math.round(e * 3) / 3;

registerDefis({
  'sen-gris': {
    consigne: 'Une charte de gris devant la caméra : le gris moyen doit tomber là où la courbe l\'attend.',
    gen(rnd) {
      const courbe = pick(rnd, ['bt709', 'slog3', 'hlg']); const C = COURBES[courbe];
      const e0 = pick(rnd, [-3, -2, 2, 3]);
      const dB = pick(rnd, [6, 12, 18]);
      return {
        scene: { courbe, e: e0, g: 0, ciel: 3 },
        items: [
          {
            type: 'reglage', q: `Courbe **${C.nom}**, sans gain : réglez l'exposition pour que le **gris 18 %** tombe à **${pc(C.grisCible)}** sur la forme d'onde (à 2 % près).`,
            fixe: { courbe, g: 0 },
            check: (st, m) => ({ ok: Math.abs(m.vGris - C.grisCible) <= 0.02, mesure: `gris à ${pc(m.vGris)}`, why: m.vGris > C.grisCible ? 'Le gris est trop haut : fermez (exposition plus basse).' : 'Le gris est trop bas : ouvrez (exposition plus haute).' }),
            corrige: { e: tiers(expoPourGris(courbe, C.grisCible, 0)) },
            aides: ['Chaque cran d\'exposition vaut un tiers de diaph ; lisez le gris sur la forme d\'onde.', `En ${C.nom}, le gris 18 % est attendu vers ${pc(C.grisCible)} : c'est la référence de la courbe.`],
            solution: `Exposition à ${fr(tiers(expoPourGris(courbe, C.grisCible, 0)), 2)} diaph : le gris arrive à ${pc(C.grisCible)}.`,
          },
          {
            type: 'nombre', q: `On ajoute ${dB} dB de gain à la caméra. De combien de diaphs le signal monte-t-il ?`, answer: Math.round(gainDiaphs(dB) * 10) / 10, tol: 0.1, unite: 'diaphs',
            aides: ['Un diaph double la lumière ; doubler une tension, c\'est +6 dB.', `${dB} ÷ 6.`],
            solution: `${dB} dB ÷ 6,02 ≈ **${fr(gainDiaphs(dB), 0)} diaphs** (et le bruit monte d'autant).`,
          },
          {
            type: 'nombre', q: 'Combien de diaphs séparent le gris 18 % du blanc de la charte (90 %) ?', answer: Math.round(Math.log2(0.9 / GRIS) * 100) / 100, tol: 0.05, unite: 'diaphs',
            aides: ['Le blanc reflète cinq fois plus que le gris.', 'log₂ 5.'],
            solution: '0,90 ÷ 0,18 = 5 ; log₂ 5 ≈ **2,32 diaphs**.',
          },
        ],
      };
    },
  },
  'sen-ciel': {
    consigne: 'Un plan de stade en fin de journée : le ciel est bien plus lumineux que la pelouse.',
    gen(rnd) {
      const ciel = pick(rnd, [3.5, 4, 4.5]);
      const pk = plage('knee', 0, 0).dessus;
      const pool = [
        { type: 'choix', q: 'À quoi sert le knee d\'une caméra de direct ?', choices: ['À comprimer les hautes lumières pour qu\'elles écrêtent plus tard', ['À relever les noirs', 'Ce serait le black gamma, en bas de la courbe.'], ['À réduire le bruit', 'Le knee agit en haut de la courbe, sur les blancs ; le bruit est dans les noirs.']], answer: 0, aides: ['Le knee agit au-dessus d\'environ 85 % du signal.', 'Il plie la courbe vers le haut pour y faire entrer plus de diaphs.'], solution: 'Le knee **comprime les hautes lumières** au-dessus de son point (vers 85 %) : un ciel à quatre ou cinq diaphs au-dessus du gris garde du détail au lieu d\'écrêter.' },
        { type: 'choix', q: 'Pour garder le ciel sans knee, on sous-expose d\'un diaph. Que se passe-t-il en bas de l\'image ?', choices: ['Les ombres s\'approchent du bruit : on perd un diaph dans les noirs', ['Rien : le capteur a assez de marge', 'La plage ne change pas : on la fait glisser, ce qu\'on gagne en haut se perd en bas.'], ['Les blancs deviennent gris', 'Ils baissent d\'un diaph, mais c\'est en bas qu\'on perd des détails.']], answer: 0, aides: ['La plage du capteur a une largeur fixe.', 'Ce qu\'on gagne en haut, on le perd en bas.'], solution: 'La plage du capteur ne s\'étire pas : sous-exposer d\'un diaph fait **glisser les ombres d\'un diaph vers le bruit**.' },
      ];
      return {
        scene: { courbe: 'bt709', e: 0, g: 0, ciel },
        items: [
          {
            type: 'reglage', q: `Le ciel est à **+${fr(ciel, 1)} diaphs** au-dessus du gris. Gardez-le **sous l'écrêtage** sans descendre le gris sous **30 %**, et sans gain.`,
            fixe: { g: 0, ciel },
            check: (st, m) => ({ ok: !m.cielEcrete && m.vGris >= 0.3, mesure: `gris à ${pc(m.vGris)}, ciel à ${pc(m.vCiel)}${m.cielEcrete ? ' (écrêté)' : ''}`, why: m.cielEcrete ? 'Le ciel écrête encore.' : 'Le gris est descendu sous 30 % : l\'image est trop sombre.' }),
            corrige: { courbe: 'knee', e: 0 },
            aides: ['En BT.709, le signal écrête vers +2,7 diaphs au-dessus du gris.', 'Deux voies : sous-exposer (le gris baisse), ou le knee qui comprime les blancs.'],
            solution: `Le **knee** : la courbe se plie au-dessus de 85 % et garde jusqu'à environ +${fr(pk, 1)} diaphs ; le gris reste à 41 %. Sous-exposer ne suffit pas : pour garder le ciel, le gris tomberait sous 30 %.`,
          },
          pick(rnd, pool),
          {
            type: 'nombre', q: 'Lisez-le dans l\'atelier : en BT.709 avec knee, exposition 0, sans gain, jusqu\'à combien de diaphs au-dessus du gris la caméra garde-t-elle du détail ?', answer: Math.round(pk * 10) / 10, tol: 0.15, unite: 'diaphs',
            aides: ['Choisissez la courbe « BT.709 avec knee » et lisez la plage utile.', 'L\'atelier l\'écrit : « … au-dessus du gris ».'],
            solution: `Environ **+${fr(pk, 1)} diaphs** : le knee amène 600 % de blanc à 109 %.`,
          },
        ],
      };
    },
  },
  'sen-plage': {
    consigne: 'Choisir la courbe qui convient à une scène très contrastée, et compter ce qu\'elle garde.',
    gen(rnd) {
      const lo = pick(rnd, [0.5, 1, 2]), hi = pick(rnd, [200, 400, 800]);
      const n = Math.log2(hi / lo);
      const gdB = pick(rnd, [6, 12]); const perte = plage('bt709', 0, 0).dessus - plage('bt709', 0, gdB).dessus;
      return {
        scene: { courbe: 'bt709', e: 0, g: 6, ciel: 4 },
        items: [
          {
            type: 'reglage', q: 'Exposition 0, sans gain : choisissez la courbe qui garde **le plus de diaphs au-dessus du gris**.',
            fixe: { e: 0, g: 0 },
            check: (st, m) => ({ ok: st.courbe === 'slog3', mesure: `${COURBES[st.courbe].nom} : +${fr(m.plage.dessus, 1)} diaphs au-dessus du gris`, why: 'Une autre courbe en garde davantage : comparez la plage utile de chacune.' }),
            corrige: { courbe: 'slog3' },
            aides: ['Essayez chaque courbe et lisez la plage utile.', 'Une courbe logarithmique donne autant de place à chaque diaph.'],
            solution: '**S-Log3** : elle va jusqu\'à la saturation du capteur (+6 diaphs ici) ; l\'image paraît terne, elle se reprend à l\'étalonnage.',
          },
          {
            type: 'nombre', q: `Une scène va de ${fr(lo, 1)} % (ombres) à ${fr(hi, 0)} % (soleil sur le métal). Combien de diaphs couvre-t-elle ?`, answer: Math.round(n * 100) / 100, tol: 0.05, unite: 'diaphs',
            aides: ['Le nombre de diaphs est le log₂ du rapport des luminances.', `log₂ (${fr(hi, 0)} ÷ ${fr(lo, 1)}).`],
            solution: `${fr(hi, 0)} ÷ ${fr(lo, 1)} = ${fr(hi / lo, 0)} ; log₂ ${fr(hi / lo, 0)} ≈ **${fr(n, 2)} diaphs**.`,
          },
          {
            type: 'nombre', q: `En BT.709, combien de diaphs perd-on au-dessus du gris en passant de 0 à +${gdB} dB de gain (exposition inchangée) ? Lisez-le dans l'atelier.`, answer: Math.round(perte * 10) / 10, tol: 0.15, unite: 'diaphs',
            aides: ['Le gain monte tout le signal : les blancs écrêtent plus tôt.', `Environ un diaph par 6 dB : ${gdB} dB…`],
            solution: `Environ **${fr(perte, 1)} diaph${perte >= 2 ? 's' : ''}** : le gain ne crée pas de lumière, il fait écrêter plus tôt (et monte le bruit d'autant).`,
          },
        ],
      };
    },
  },
});
