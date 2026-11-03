// @ts-check
import { registerExos, entre, pick, tirer, fr as frn } from '../exo.js';
import { eclairage, contraste } from '../../labo/calc/photometrie.js';
import { angleChampDe, diametre, uniformite, posesSures, STADE_TV } from '../../labo/calc/lumiere.js';
import { incidenceVisage, debouchagePour, scintillementVu, frequenceLumiere, sourceStadeById } from '../lumiere_eclairer_calc.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie de la partie « Éclairer pour la caméra » du chapitre « La lumière » (v19.29) :
// le diamètre éclairé et la distance d'un faisceau (2 d tan(θ/2)), l'éclairement dans l'axe (E = I ÷ d²),
// le projecteur d'une situation ; le rapport de contraste d'un visage, ses diaphs, le débouchage qu'il faut,
// l'éclairement d'une principale décalée ; l'uniformité U1 et U2 d'une grille, le scintillement d'un ralenti
// et le shutter sûr. Les réponses sont calculées par les fonctions du Labo (labo/calc/photometrie.js,
// labo/calc/lumiere.js) et de cours/lumiere_eclairer_calc.js.
// ----------------------------------------------------------------------------------
const fr = (v, d = 0) => frn(v, d).replace('-', '−');
const arrondi = (v, d) => Math.round(v * 10 ** d) / 10 ** d;
/** garde les pièges qui ne tombent pas dans la tolérance de la bonne réponse */
const pieges = (answer, tol, list) => list.filter((p) => Number.isFinite(p.v) && Math.abs(p.v - answer) > tol * 1.5);
const pose = (t) => `1/${Math.round(1 / t)} s`;

/** les situations et le projecteur qui leur va */
const SITUATIONS = [
  {
    q: 'Le réalisateur veut le logo de l\'émission projeté, net, sur le fond du décor. Quel projecteur accrochez-vous ?',
    choices: ['Une découpe, avec un gobo du logo', ['Un Fresnel au serré', 'Le Fresnel a un bord doux et pas de plan focal : il ne projette pas d\'image nette.'], ['Un panneau LED', 'Une source large éclaire sans forme : impossible d\'y dessiner un logo.']],
    solution: 'Une **découpe** : son objectif projette net ce qui est placé dans le plan focal (un gobo, des couteaux, un iris).',
  },
  {
    q: 'L\'invitée a la peau marquée et l\'ombre de son nez est trop nette. Quelle source pour sa face ?',
    choices: ['Une boîte à lumière, assez proche', ['Un Fresnel plus loin', 'Plus loin, la source paraît plus petite : l\'ombre devient encore plus nette.'], ['Un PAR', 'Un PAR est une petite source puissante : ombres dures.']],
    solution: 'Une **boîte à lumière** proche : la source est vue grande, les ombres sont fondues.',
  },
  {
    q: 'Pendant le direct d\'une émission de variétés, des faisceaux doivent changer de position et de couleur à chaque refrain. Que faut-il ?',
    choices: ['Des lyres commandées par le DMX', ['Des Fresnels avec des gélatines', 'On ne change pas une gélatine ni le pointage d\'un Fresnel pendant le direct : il faudrait monter au gril.'], ['Des PAR', 'Le PAR a un angle fixe et ne bouge pas seul.']],
    solution: 'Des **lyres** : pan, tilt, zoom, couleur et gobos se commandent à distance, la console enchaîne les états.',
  },
  {
    q: 'Au plateau du journal, il faut une face réglable du serré au large, au bord doux, qu\'on puisse rogner pour ne pas éclairer le décor. Que prenez-vous ?',
    choices: ['Un Fresnel avec ses volets coupe-flux', ['Une découpe', 'Le bord net d\'une découpe se voit sur le visage et le fond ; on la réserve aux formes et aux logos.'], ['Une boîte à lumière', 'Une boîte à lumière ne se serre pas et déborde partout ; c\'est une source de débouchage ou de face douce.']],
    solution: 'Un **Fresnel** : faisceau réglable, bord doux, et des volets pour rogner les débords.',
  },
  {
    q: 'Pour un concert, il faut des faisceaux puissants et fixes, sans réglage, en grand nombre. Quel projecteur ?',
    choices: ['Des PAR', ['Des lyres spot', 'Elles feraient l\'affaire, mais pour des faisceaux fixes sans réglage, c\'est beaucoup de mécanique et de DMX.'], ['Des boîtes à lumière', 'Une source large et douce ne fait pas de faisceau.']],
    solution: 'Des **PAR** : l\'angle est celui de la lampe, le faisceau est puissant, il n\'y a rien à régler.',
  },
];
/** les situations du plateau */
const PLATEAU = [
  {
    q: 'L\'invité porte des lunettes : le projecteur de face brille dans ses verres. Que faites-vous ?',
    choices: ['Je monte la principale, ou je l\'écarte sur le côté', ['Je la baisse au gradateur', 'Le reflet garde sa place ; il est seulement moins fort, et le visage aussi.'], ['J\'ouvre son faisceau', 'Le reflet vient de la direction de la source, pas de la largeur du faisceau.']],
    solution: 'Le verre réfléchit comme un miroir : en **montant ou en écartant la source**, le reflet sort de l\'axe de la caméra.',
  },
  {
    q: 'Le visage de la présentatrice montre deux ombres de nez. Que corrigez-vous ?',
    choices: ['Je garde une seule source dure sur son visage ; les autres sont douces', ['Je monte le débouchage', 'Le débouchage éclaircit l\'ombre, mais les deux sources dures en font toujours deux.'], ['J\'ajoute un contre-jour', 'Le contre-jour éclaire de derrière ; il ne supprime pas l\'ombre de face.']],
    solution: '**Une seule principale** (source dure) par visage et par axe : deux sources dures font deux ombres.',
  },
  {
    q: 'Un côté du visage est orangé, l\'autre bleuté. Les deux sources sont un Fresnel halogène et un panneau LED. Que faites-vous ?',
    choices: ['Je règle le panneau bicolore à la température de l\'halogène', ['Je refais la balance des blancs', 'La caméra ne fait qu\'une balance pour toute l\'image : elle ne corrige pas deux couleurs.'], ['Je baisse l\'halogène au gradateur', 'Un halogène qui baisse rougit encore : l\'écart grandit.']],
    solution: '**Une seule température** sur le plateau : on règle le panneau bicolore sur 3 200 K (ou l\'on corrige par une gélatine).',
  },
  {
    q: 'Sur un fond sombre, les cheveux bruns de l\'invité disparaissent. Quelle lumière ajoutez-vous ?',
    choices: ['Un contre-jour, derrière et en hauteur', ['Du débouchage', 'Il éclaire le visage depuis l\'avant ; il ne dessine pas le contour des cheveux.'], ['Une deuxième principale', 'Elle ferait une seconde ombre sur le visage, sans détacher les cheveux du fond.']],
    solution: 'Le **contre-jour** pose un liseré sur les cheveux et les épaules : la personne se détache du fond.',
  },
];

registerExos({
  'lumiere-projecteurs': {
    titre: 'Choisir et régler un projecteur',
    consigne: 'Au plateau, avant l\'émission : vous calculez la tache et l\'éclairement d\'un projecteur, la distance où l\'accrocher, et vous choisissez le projecteur de chaque besoin.',
    gen: (rnd) => {
      const th = pick(rnd, [12, 15, 20, 25, 30, 40, 50, 60]), d = pick(rnd, [3, 4, 5, 6, 8, 10, 12]);
      const D = arrondi(diametre(d, th), 2), tolD = Math.max(0.05, D * 0.02);
      const thF = pick(rnd, [12, 20, 30, 45, 60]), dF = pick(rnd, [3, 4, 5, 6, 8]);
      const r = eclairage({ source: 'fresnel', angle: thF, niveau: 1, d: dF });
      const I = Math.round(r.I0 / 100) * 100, E = Math.round(I / (dF * dF)), tolE = Math.max(1, E * 0.01);
      const thZ = pick(rnd, [10, 14, 19, 26, 36]), diam = pick(rnd, [1.5, 2, 2.5, 3, 4]);
      const dist = arrondi(diam / diametre(1, thZ), 1), tolZ = Math.max(0.1, dist * 0.02);
      const champ = arrondi(angleChampDe(thZ), 1);
      const S = pick(rnd, SITUATIONS);
      return [
        {
          type: 'nombre', unite: 'm', answer: D, tol: tolD,
          q: `Un projecteur a un angle de faisceau de **${th}°**. Quel diamètre éclaire-t-il (à 50 % de l'axe) sur un sujet à **${d} m** ?`,
          pieges: pieges(D, tolD, [{ v: arrondi(D / 2, 2), why: 'C\'est le rayon : le diamètre en vaut le double.' }, { v: arrondi(2 * d * Math.tan(th * Math.PI / 180), 2), why: 'La tangente se prend sur la moitié de l\'angle : tan(θ ÷ 2).' }]),
          aides: ['Le faisceau est un cône : sa moitié fait un triangle rectangle avec l\'axe.', 'Diamètre = 2 × d × tan(θ ÷ 2).'],
          solution: `2 × ${d} × tan(${fr(th / 2, 1)}°) = **${fr(D, 2)} m**. La lumière déborde encore jusqu'à l'angle de champ (10 %), environ 1,8 fois plus large.`,
        },
        {
          type: 'nombre', unite: 'lx', answer: E, tol: tolE,
          q: `Le Fresnel 1 kW réglé à ${thF}° donne **${fr(I)} cd** dans l'axe. Quel éclairement reçoit le présentateur, dans l'axe, à **${dF} m** ?`,
          pieges: pieges(E, tolE, [{ v: Math.round(I / dF), why: 'L\'éclairement baisse comme le carré de la distance : on divise par d².' }]),
          aides: ['Loi de l\'inverse du carré.', `E = I ÷ d², avec d = ${dF} m.`],
          solution: `${fr(I)} ÷ ${dF}² = ${fr(I)} ÷ ${dF * dF} = **${fr(E)} lx**. ${E < 800 ? 'Un peu juste pour un visage au plateau : on serre ou l\'on rapproche.' : E > 2500 ? 'Beaucoup pour un visage : on peut ouvrir le faisceau ou reculer.' : 'De l\'ordre de ce qu\'il faut pour un visage au plateau.'}`,
        },
        {
          type: 'nombre', unite: 'm', answer: dist, tol: tolZ,
          q: `Une découpe a un faisceau de **${thZ}°** (champ ≈ ${fr(champ, 1)}°). À quelle distance faut-il l'accrocher pour que son faisceau couvre **${fr(diam, 1)} m** de diamètre ?`,
          pieges: pieges(dist, tolZ, [{ v: arrondi(diam / (2 * Math.tan(thZ * Math.PI / 180)), 1), why: 'La tangente se prend sur la moitié de l\'angle : tan(θ ÷ 2).' }]),
          aides: ['Partez de la formule du diamètre, et isolez la distance.', 'd = diamètre ÷ (2 × tan(θ ÷ 2)).'],
          solution: `${fr(diam, 1)} ÷ (2 × tan(${fr(thZ / 2, 1)}°)) = **${fr(dist, 1)} m**.`,
        },
        {
          type: 'choix', q: S.q, choices: S.choices, answer: 0,
          aides: ['Bord net ou doux ? Forme projetée ? Mouvement ? Source large ou petite ?', 'Découpe : forme nette ; Fresnel : bord doux réglable ; PAR : angle fixe ; boîte à lumière : douceur ; lyre : mouvement.'],
          solution: S.solution,
        },
      ];
    },
  },
  'lumiere-plateau': {
    titre: 'Doser la lumière d\'un visage',
    consigne: 'Au plateau d\'avant-match : vous lisez les éclairements au luxmètre, vous calculez le rapport de contraste et le débouchage qu\'il faut, et vous corrigez un défaut.',
    gen: (rnd) => {
      const Ep = entre(rnd, 12, 28) * 50, Ed = entre(rnd, 3, Math.floor(Ep / 50) - 1) * 50;
      const k = contraste(Ep, Ed), R = arrondi(k.rapport, 2), tolR = 0.05;
      const r = pick(rnd, [2, 3, 4, 6, 8]), dia = arrondi(contraste(r - 1, 1).diaphs, 2), tolDia = 0.06;
      const Ep2 = entre(rnd, 14, 30) * 50, cible = pick(rnd, [2, 3, 4]), Ed2 = Math.round(debouchagePour(Ep2, cible)), tolEd = Math.max(1, Ed2 * 0.02);
      const az = pick(rnd, [30, 35, 40, 45]), elv = pick(rnd, [30, 35, 40, 45]), dP = pick(rnd, [3, 3.5, 4, 4.5, 5]), th = pick(rnd, [20, 30, 40]);
      // l'intensité est donnée arrondie dans l'énoncé : l'éclairement se calcule avec elle
      const inc = incidenceVisage(az, elv), F = eclairage({ source: 'fresnel', angle: th, niveau: 1, d: dP, incidence: inc });
      const I = Math.round(F.I0 / 100) * 100, Eface = Math.round(F.E * I / F.I0);
      const tolF = Math.max(2, Eface * 0.02);
      const S = pick(rnd, PLATEAU);
      return [
        {
          type: 'nombre', answer: R, tol: tolR,
          q: `Au luxmètre, la principale donne **${fr(Ep)} lx** sur le visage du consultant, le débouchage **${fr(Ed)} lx**. Quel est le rapport de contraste ?`,
          pieges: pieges(R, tolR, [{ v: arrondi(Ep / Ed, 2), why: 'Le côté éclairé reçoit aussi le débouchage : (principale + débouchage) ÷ débouchage.' }]),
          aides: ['Comparez le côté éclairé au côté ombre.', 'Rapport = (E principale + E débouchage) ÷ E débouchage.'],
          solution: `(${fr(Ep)} + ${fr(Ed)}) ÷ ${fr(Ed)} = **${fr(R, 2)}:1**, soit ${fr(k.diaphs, 1)} diaph${k.diaphs >= 2 ? 's' : ''}. ${R <= 2.5 ? 'Un contraste d\'information.' : R <= 4.5 ? 'Un modelé marqué.' : 'Un contraste fort pour un plateau d\'information : on monte le débouchage.'}`,
        },
        {
          type: 'nombre', unite: dia >= 2 ? 'diaphs' : 'diaph', answer: dia, tol: tolDia,
          q: `Le directeur photo veut un rapport de **${r}:1** sur le visage. Combien de diaphs d'écart cela fait-il entre le côté éclairé et le côté ombre ?`,
          pieges: pieges(dia, tolDia, [{ v: r, why: 'Le rapport n\'est pas en diaphs : un diaph est un facteur 2, il faut le log₂ du rapport.' }, { v: r / 2, why: 'Un diaph double la lumière : on prend le logarithme en base 2, pas la moitié.' }]),
          aides: ['Un diaph, c\'est un facteur 2 de lumière.', `Diaphs = log₂(${r}) : combien de fois faut-il doubler pour aller de 1 à ${r} ?`],
          solution: `log₂(${r}) = **${fr(dia, r === 2 || r === 4 || r === 8 ? 0 : 2)} diaph${dia >= 2 ? 's' : ''}**.`,
        },
        {
          type: 'nombre', unite: 'lx', answer: Ed2, tol: tolEd,
          q: `La principale donne **${fr(Ep2)} lx** sur le visage de la présentatrice. Quel débouchage faut-il pour un rapport de **${cible}:1** ?`,
          pieges: pieges(Ed2, tolEd, [{ v: Math.round(Ep2 / cible), why: 'Le côté éclairé reçoit principale et débouchage : (Ep + Ed) ÷ Ed = r, donc Ed = Ep ÷ (r − 1).' }]),
          aides: ['Écrivez le rapport, puis isolez le débouchage.', `(Ep + Ed) ÷ Ed = ${cible}, donc Ed = Ep ÷ (${cible} − 1).`],
          solution: `${fr(Ep2)} ÷ (${cible} − 1) = **${fr(Ed2)} lx**. Vérification : (${fr(Ep2)} + ${fr(Ed2)}) ÷ ${fr(Ed2)} = ${cible}.`,
        },
        {
          type: 'nombre', unite: 'lx', answer: Eface, tol: tolF,
          q: `La principale (**${fr(I)} cd** dans l'axe) est à **${fr(dP, 1)} m** du visage, décalée de **${az}°** sur le côté et montée de **${elv}°**. La cellule est sur le visage, tournée vers la caméra. Que lit le luxmètre ?`,
          pieges: pieges(Eface, tolF, [{ v: Math.round(I / (dP * dP)), why: 'La lumière arrive en biais sur la cellule tournée vers la caméra : il faut multiplier par cos(côté) × cos(hauteur).' }, { v: Math.round(I * Math.cos(az * Math.PI / 180) / (dP * dP)), why: 'La hauteur compte aussi : multipliez encore par cos de la hauteur.' }]),
          aides: ['E = I × cos i ÷ d², et la lumière arrive en biais de deux façons.', `cos i = cos ${az}° × cos ${elv}° ; E = ${fr(I)} × cos i ÷ ${fr(dP, 1)}².`],
          solution: `cos i = cos ${az}° × cos ${elv}° = ${fr(Math.cos(inc * Math.PI / 180), 3)} ; E = ${fr(I)} × ${fr(Math.cos(inc * Math.PI / 180), 3)} ÷ ${fr(dP * dP, 2)} = **${fr(Eface)} lx**.`,
        },
        {
          type: 'choix', q: S.q, choices: S.choices, answer: 0,
          aides: ['Cherchez d\'où vient le défaut : la direction, le nombre ou la couleur des sources.', 'Une seule principale, une seule température, une source qui ne se reflète pas dans l\'axe de la caméra.'],
          solution: S.solution,
        },
      ];
    },
  },
  'lumiere-stade': {
    titre: 'Juger l\'éclairage d\'un stade',
    consigne: 'Avant un match télévisé : vous vérifiez l\'uniformité relevée sur la pelouse et vous réglez les caméras pour que le direct et les super ralentis ne scintillent pas.',
    gen: (rnd) => {
      const base = entre(rnd, 13, 18) * 100, n = 6;
      const E = Array.from({ length: n }, () => Math.round((base + entre(rnd, -45, 45) * 10) / 10) * 10);
      E[entre(rnd, 0, n - 1)] = Math.round(base * pick(rnd, [0.45, 0.55, 0.65, 0.75]) / 10) * 10;
      const u = uniformite(E), u1 = arrondi(u.u1, 2), u2 = arrondi(u.u2, 2), tolU = 0.01;
      const ok1 = u.u1 >= STADE_TV.u1, ok2 = u.u2 >= STADE_TV.u2;
      const verdicts = ['Les deux repères sont tenus', 'U1 seul est sous son repère', 'U2 seul est sous son repère', 'U1 et U2 sont sous leurs repères'];
      const juste = ok1 && ok2 ? 0 : !ok1 && ok2 ? 1 : ok1 && !ok2 ? 2 : 3;
      const c = pick(rnd, [150, 250, 300, 400]), S = sourceStadeById('hmi-mag'), vu = scintillementVu(S.m, 1 / c, c);
      const Fr = arrondi(vu.auRalenti, 1), tolF = 0.2;
      const bonne = pick(rnd, posesSures(frequenceLumiere(50), 1 / 50)), mauvaises = tirer(rnd, [1 / 150, 1 / 200, 1 / 250, 1 / 500, 1 / 1000], 2);
      const liste = E.map((x) => fr(x)).join(' ; ');
      return [
        {
          type: 'nombre', answer: u1, tol: tolU,
          q: `L'éclairement vertical vers la caméra principale, relevé en six points de la pelouse : **${liste} lx**. Que vaut U1 ?`,
          pieges: pieges(u1, tolU, [{ v: u2, why: 'C\'est U2 (Emin ÷ Emoyen). U1 compare le minimum au maximum.' }, { v: arrondi(u.max / u.min, 2), why: 'L\'uniformité se calcule dans l\'autre sens : Emin ÷ Emax, au plus 1.' }]),
          aides: ['Repérez le plus petit et le plus grand relevé.', 'U1 = Emin ÷ Emax.'],
          solution: `U1 = ${fr(u.min)} ÷ ${fr(u.max)} = **${fr(u1, 2)}**.`,
        },
        {
          type: 'nombre', answer: u2, tol: tolU,
          q: `Mêmes relevés (**${liste} lx**). Que vaut U2 ?`,
          pieges: pieges(u2, tolU, [{ v: u1, why: 'C\'est U1 (Emin ÷ Emax). U2 compare le minimum à la moyenne.' }]),
          aides: ['Il faut la moyenne des six relevés.', `U2 = Emin ÷ Emoyen ; Emoyen = somme ÷ ${n}.`],
          solution: `Emoyen = ${fr(u.moy, 0)} lx ; U2 = ${fr(u.min)} ÷ ${fr(u.moy, 0)} = **${fr(u2, 2)}**.`,
        },
        {
          type: 'choix', q: `Avec U1 = ${fr(u1, 2)} et U2 = ${fr(u2, 2)}, et les repères d'un stade télévisé de haut niveau (U1 ≥ ${fr(STADE_TV.u1, 1)}, U2 ≥ ${fr(STADE_TV.u2, 1)}, ordres de grandeur), que dites-vous ?`,
          choices: verdicts.map((t, k) => (k === juste ? t : [t, `U1 = ${fr(u1, 2)} ${ok1 ? '≥' : '<'} ${fr(STADE_TV.u1, 1)} et U2 = ${fr(u2, 2)} ${ok2 ? '≥' : '<'} ${fr(STADE_TV.u2, 1)}.`])), answer: juste,
          aides: ['Comparez chaque valeur à son repère.', `U1 face à ${fr(STADE_TV.u1, 1)}, U2 face à ${fr(STADE_TV.u2, 1)}.`],
          solution: `**${verdicts[juste]}** : U1 = ${fr(u1, 2)} (repère ${fr(STADE_TV.u1, 1)}), U2 = ${fr(u2, 2)} (repère ${fr(STADE_TV.u2, 1)}).${juste ? ' Quand la caméra suivra le ballon, l\'image s\'assombrira sur les zones faibles.' : ''}`,
        },
        {
          type: 'nombre', unite: 'Hz', answer: Fr, tol: tolF,
          q: `Sous des projecteurs à iodures métalliques sur ballast magnétique (lumière à 100 Hz), une caméra tourne à **${c} images/s**, pose 1/${c} s, et le serveur relit à 50 images/s. À quelle fréquence l'image pompe-t-elle à l'écran ?`,
          pieges: pieges(Fr, tolF, [{ v: arrondi(vu.apparente, 1), why: 'C\'est la fréquence à la prise de vue ; relue au ralenti, elle est divisée par le facteur de ralenti.' }, { v: 100, why: '100 Hz, c\'est la lumière ; la caméra en voit un battement, ensuite ralenti.' }]),
          aides: ['À la prise de vue, la caméra voit l\'écart entre 100 Hz et le multiple de sa cadence le plus proche (0 ou la cadence elle-même).', `Puis divisez par le facteur de ralenti, ${c} ÷ 50.`],
          solution: `À la prise de vue : |100 − ${Math.round(100 / c) * c}| = ${fr(vu.apparente, 0)} Hz ; ralenti × ${fr(c / 50, 0)} : ${fr(vu.apparente, 0)} ÷ ${fr(c / 50, 0)} = **${fr(Fr, 1)} Hz**. Il faut des projecteurs sans scintillement.`,
        },
        {
          type: 'choix', q: `Caméra du direct à 50 images/s, sous ces mêmes projecteurs qui varient à 100 Hz. Quel shutter le RCP peut-il prendre sans scintillement ?`,
          choices: [pose(bonne), ...mauvaises.map((t) => [pose(t), `${pose(t)} n'est pas un multiple de 1/100 s : la pose garde une partie de l'ondulation et l'image pompe.`])], answer: 0,
          aides: ['La lumière refait le même cycle toutes les 10 ms.', 'La pose doit contenir un nombre entier de périodes : 1/100 s, 2/100 s…'],
          solution: `**${pose(bonne)}** : ${bonne > 0.015 ? 'deux périodes de 1/100 s par image (c\'est le shutter sur OFF)' : 'une période de 1/100 s par image'}, chaque image reçoit la même lumière.`,
        },
      ];
    },
  },
});
