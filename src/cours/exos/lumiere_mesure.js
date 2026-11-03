// @ts-check
import { registerExos, pick, tirer, fr } from '../exo.js';
import { flux, angleSolide, intensiteMoyenne, angleChampDe } from '../../labo/calc/lumiere.js';
import { SOURCES, GELS, eclairage, profil, gradateur, mired, kelvin, dominante, ouverture, diaphs, luminance } from '../../labo/calc/photometrie.js';
import { surLigne, eclairementPonctuel, ecartDisque, TOL_MIRED, gelPour, GELS_COULEUR, ouvertureSpot, erreurSpot, dbPourDiaphs, ouvertureCamera } from '../lumiere_mesure_calc.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie du chapitre « La lumière », partie « La lumière et sa mesure » (v19.29) :
// brancher des projecteurs sur une ligne de 16 A et comparer les familles ; passer du flux à
// l'intensité, à l'éclairement et à la luminance ; l'inverse du carré, le cosinus et le bord du
// faisceau ; les mireds, les gélatines et le gradateur ; exposer d'après un luxmètre ou un spotmètre,
// rattraper au gain. Les réponses viennent des calculs du Labo (labo/calc/) et de
// cours/lumiere_mesure_calc.js.
// ----------------------------------------------------------------------------------
/** un nombre arrondi à d décimales */
const r = (v, d = 0) => (d >= 0 ? Math.round(v * 10 ** d) / 10 ** d : Math.round(v / 10 ** -d) * 10 ** -d);
/** garde les pièges qui ne tombent pas dans la tolérance de la bonne réponse */
const pg = (/** @type {{ v: number, why: string }[]} */ list, answer, tol) => list.filter((p) => Number.isFinite(p.v) && Math.abs(p.v - answer) > 2 * tol);
/** un écart signé, avec le moins typographique */
const sg = (v, d = 0) => (v > 0 ? '+' : '') + fr(v, d).replace('-', '−');
/** un nombre f */
const fN = (N) => `f/${fr(N, Number.isInteger(N) ? 0 : 1)}`;

// ---------------- les sources ----------------
const SITUATIONS_SOURCES = [
  {
    type: 'choix', q: 'Le réalisateur trouve le visage de l\'invité trop lumineux. La principale est un Fresnel halogène ; la caméra est balancée à 3 200 K. L\'assistant propose de baisser le gradateur à 50 %. Qu\'en pensez-vous ?',
    choices: ['Non : l\'halogène rougirait ; mieux vaut reculer le projecteur, le diffuser ou poser un filtre neutre', ['Oui : le gradateur sert à cela', 'Au gradateur, l\'halogène refroidit et rougit : à mi-tension, il descend vers 2 400 K, une dominante orange nette.'], ['Oui, et il faudra refaire la balance à 5 600 K', 'Un halogène baissé devient plus chaud (plus orange), pas plus froid : une balance à 5 600 K aggraverait la dominante.']], answer: 0,
    aides: ['Que devient la couleur d\'un filament moins chaud ?', 'Cherchez un moyen de baisser la lumière qui ne touche pas à sa couleur.'],
    solution: 'L\'halogène **rougit** au gradateur. Pour baisser sans changer la couleur : reculer (×1,4 sur la distance = un diaph), diffuser, ou poser un **ND**.',
  },
  {
    type: 'choix', q: 'À cinq minutes de l\'antenne, la HMI du plateau extérieur est coupée par erreur. Que dites-vous au réalisateur ?',
    choices: ['Il faut la rallumer tout de suite : elle peut tarder à se réamorcer à chaud, puis mettre une à deux minutes à retrouver sa lumière', ['Rien : elle repart instantanément', 'Une HMI est une lampe à arc : l\'arc se réamorce sous haute tension, puis la lampe doit chauffer pour donner sa lumière et sa couleur.'], ['On la remplace par un halogène de même puissance', 'Un halogène de même puissance donne quatre fois moins de lumière, à 3 200 K : le plan ne raccorderait plus.']], answer: 0,
    aides: ['Une HMI n\'est pas une ampoule à filament.', 'Pensez au ballast et au temps de montée en température.'],
    solution: 'Une HMI met **une à deux minutes** à atteindre sa pleine lumière et sa couleur, et ne se réamorce pas toujours aussitôt à chaud : on la rallume sans attendre.',
  },
  {
    type: 'choix', q: 'Pour un plateau filmé en direct, on hésite entre deux panneaux LED de même flux. Le premier annonce un IRC de 96 et un TLCI de 70 ; le second un IRC de 92 et un TLCI de 90. Lequel prendre ?',
    choices: ['Le second : son TLCI est meilleur', ['Le premier : son IRC est meilleur', 'L\'IRC est pensé pour l\'œil ; pour une caméra, c\'est le TLCI (EBU Tech 3355) qui dit ce qu\'il faudra corriger.'], ['Indifférent : ce sont deux LED', 'Deux LED peuvent rendre une peau très différemment : leur spectre a des creux qui ne sont pas aux mêmes endroits.']], answer: 0,
    aides: ['Un des deux indices simule une caméra.', 'Le TLCI vient de l\'EBU, pour la télévision.'],
    solution: 'Le **TLCI** simule une caméra : au-dessus de 85 environ, l\'étalonneur n\'a presque rien à corriger. À 70, il y aura des corrections.',
  },
];
// ---------------- la distance ----------------
const SITUATIONS_DISTANCE = [
  {
    type: 'choix', q: 'Une boîte à lumière de 1,2 m éclaire un visage à 60 cm. On la recule à 1,2 m. L\'éclairement est-il divisé par quatre ?',
    choices: ['Non, par moins : si près d\'une grande source, la loi de l\'inverse du carré ne vaut plus tout à fait', ['Oui, exactement : deux fois plus loin, quatre fois moins', 'La loi suppose une source ponctuelle ; à moins de cinq fois sa taille, une grande source n\'en est pas une.'], ['Non : une source douce donne le même éclairement à toute distance', 'L\'éclairement baisse bien quand on recule, seulement moins vite que l\'inverse du carré tant qu\'on reste près.']], answer: 0,
    aides: ['La loi de l\'inverse du carré suppose une source vue comme un point.', 'Comparez la distance à la taille de la source.'],
    solution: `À une distance de l'ordre de la taille de la source, la loi surestime nettement (de ${fr(ecartDisque(0.6, 1.2) * 100, 0)} % à 60 cm d'un disque de 1,2 m) : l'éclairement baisse **moins** que quatre fois. La loi vaut au-delà d'environ cinq fois la taille de la source.`,
  },
  {
    type: 'choix', q: 'Pour éclairer régulièrement un décor large avec plusieurs Fresnel côte à côte, comment placer les faisceaux ?',
    choices: ['Les recouvrir à leur bord : à la limite du faisceau, chacun donne 50 %, les deux moitiés s\'additionnent', ['Les placer bord à bord à la limite de leur angle de champ', 'Au bord de l\'angle de champ, il ne reste que 10 % de l\'axe : entre deux faisceaux, le décor serait sombre.'], ['Les pointer tous au centre', 'Le centre serait très éclairé et les côtés sombres.']], answer: 0,
    aides: ['Que vaut l\'intensité au bord de l\'angle de faisceau ?', '50 % + 50 %…'],
    solution: 'Au bord de l\'**angle de faisceau**, chaque projecteur donne la moitié de son axe : deux faisceaux qui se recouvrent là donnent un éclairement à peu près régulier.',
  },
];
// ---------------- la mesure ----------------
const SITUATIONS_MESURE = [
  {
    type: 'choix', q: 'Le ciel est très lumineux derrière le présentateur. Pour exposer son visage juste, quelle mesure prendre ?',
    choices: ['La cellule incidente au visage, tournée vers la caméra', ['Le spotmètre sur le ciel', 'Le spotmètre rendrait le ciel gris : le visage serait très sous-exposé.'], ['La moyenne de l\'image entière', 'Une mesure moyenne se fait tirer par le ciel lumineux : le visage sort trop sombre.']], answer: 0,
    aides: ['On veut exposer le visage, pas le ciel.', 'Quelle mesure ne dépend pas de ce qu\'il y a dans l\'image ?'],
    solution: 'La **cellule incidente** au visage mesure la lumière qui éclaire le visage : il sortira à sa place, quel que soit le ciel (qui écrêtera peut-être : on débouche alors le visage, ou l\'on pose un filtre neutre sur la fenêtre).',
  },
  {
    type: 'choix', q: 'Au poste vision, l\'iris d\'une caméra est grand ouvert et l\'image reste trop sombre. Dans quel ordre agir ?',
    choices: ['Vérifier que le filtre neutre est retiré, puis monter le gain', ['Monter le gain d\'abord', 'Le gain ajoute du bruit : on fait d\'abord entrer toute la lumière disponible (retirer le ND).'], ['Allonger le temps de pose à 1/25 s', 'En direct à 50 Hz, le temps de pose reste fixé : l\'image deviendrait floue et saccadée au mouvement.']], answer: 0,
    aides: ['Le gain amplifie aussi le bruit.', 'Avant d\'amplifier, faites entrer toute la lumière possible.'],
    solution: 'D\'abord la lumière : iris ouvert, **filtre neutre retiré**. Ensuite seulement le **gain** (6 dB ≈ un diaph), qui monte aussi le bruit.',
  },
];

registerExos({
  'lumiere-sources': {
    titre: 'Choisir et brancher les projecteurs',
    consigne: 'Vous montez le plateau du présentateur au bord du terrain : vous calculez le courant des projecteurs, ce que porte une ligne de 16 A, et ce que donnerait une LED à la place.',
    gen: (rnd) => {
      const P = pick(rnd, [500, 650, 800, 1000, 1200, 2000]);
      const L = surLigne(P, 'halogene'), I = r(L.I, 2);
      const eh = pick(rnd, [18, 20, 22, 25]), eL = pick(rnd, [80, 90, 100, 110, 120]);
      const Ph = pick(rnd, [1000, 2000, 5000]);
      const phi = flux(Ph, 'halogene', eh), PL = r(phi / eL, 0);
      return [
        {
          type: 'nombre', unite: 'A', answer: I, tol: 0.05,
          q: `Un Fresnel halogène de **${fr(P)} W** est branché sur le secteur, **230 V** monophasé. Quel courant tire-t-il ? (une lampe à incandescence est une résistance : cos φ = 1)`,
          pieges: pg([{ v: r(P / 400, 2), why: '400 V est la tension entre deux phases du triphasé ; un projecteur se branche entre une phase et le neutre, sous 230 V.' }, { v: r(230 / P, 2), why: 'La formule est I = P ÷ U, pas U ÷ P.' }], I, 0.05),
          aides: ['Puissance = tension × courant.', `I = P ÷ U = ${fr(P)} ÷ 230.`],
          solution: `I = ${fr(P)} ÷ 230 ≈ **${fr(I, 2)} A**.`,
        },
        {
          type: 'nombre', answer: L.n,
          q: `Combien de ces Fresnel de **${fr(P)} W** peut-on brancher sur une ligne de **16 A** ?`,
          pieges: pg([{ v: L.n + 1, why: `${L.n + 1} projecteurs tireraient ${fr((L.n + 1) * L.I, 1)} A : plus de 16 A, le disjoncteur déclenche. On arrondit vers le bas.` }], L.n, 0.1),
          aides: ['Divisez le courant de la ligne par celui d\'un projecteur.', `16 ÷ ${fr(I, 2)}, arrondi vers le bas.`],
          solution: `16 ÷ ${fr(L.I, 2)} = ${fr(16 / L.I, 2)} : **${L.n}** projecteurs (${fr(L.total, 1)} A). Un de plus ferait déclencher la ligne.`,
        },
        {
          type: 'nombre', unite: 'W', answer: PL, tol: 1,
          q: `Un projecteur halogène de **${fr(Ph)} W** donne environ **${eh} lm/W**. On veut le remplacer par une LED de **${eL} lm/W** qui donne le même flux. Quelle puissance faut-il à la LED ?`,
          pieges: pg([{ v: Ph, why: 'Même flux ne veut pas dire même puissance : la LED donne plus de lumens par watt.' }, { v: r(Ph * eL / eh, 0), why: 'Le rapport est à l\'envers : la LED, plus efficace, demande moins de puissance.' }], PL, 1),
          aides: ['Flux = puissance × efficacité ; calculez d\'abord le flux de l\'halogène.', `Flux = ${fr(Ph)} × ${eh} ; puis puissance LED = flux ÷ ${eL}.`],
          solution: `Flux : ${fr(Ph)} × ${eh} = ${fr(phi)} lm. LED : ${fr(phi)} ÷ ${eL} ≈ **${fr(PL)} W**, ${fr(Ph / PL, 1)} fois moins de puissance (et de chaleur).`,
        },
        pick(rnd, SITUATIONS_SOURCES),
      ];
    },
  },
  'lumiere-grandeurs': {
    titre: 'Du flux à la luminance',
    consigne: 'Vous préparez l\'éclairage d\'une interview : à partir de la fiche du projecteur, vous calculez l\'angle solide de son faisceau, son intensité, l\'éclairement au sujet, puis la luminance que verra la caméra.',
    gen: (rnd) => {
      const th = pick(rnd, [10, 15, 20, 25, 30, 40, 50, 60]);
      const om = angleSolide(th), omR = r(om, 3);
      const phi = pick(rnd, [5000, 8000, 10000, 12000, 15000, 20000]);
      const I = intensiteMoyenne(phi, th), Ir = r(I, -2);
      const I2 = pick(rnd, [4000, 6000, 8000, 10000, 16000, 25000]), d = pick(rnd, [2, 3, 4, 5]);
      const E = eclairementPonctuel(I2, d), Er = r(E, 0);
      const E3 = pick(rnd, [400, 600, 800, 1000, 1500, 2000]), carte = pick(rnd, [['grise', 0.18], ['blanche', 0.9]]);
      const rho = /** @type {number} */ (carte[1]), Lr = r(luminance(E3, rho), 1);
      return [
        {
          type: 'nombre', unite: 'sr', answer: omR, tol: Math.max(0.002, omR * 0.01),
          q: `Le faisceau du projecteur fait **${th}°** (angle au sommet du cône). Quel angle solide découpe-t-il, en stéradians ?`,
          pieges: pg([{ v: r(th / 360 * 4 * Math.PI, 3), why: 'Un angle solide ne se compte pas comme un angle plan : Ω = 2π (1 − cos θ/2).' }, { v: r(2 * Math.PI * (1 - Math.cos(th * Math.PI / 180)), 3), why: 'C\'est le demi-angle qui entre dans la formule : cos (θ/2), pas cos θ.' }], omR, Math.max(0.002, omR * 0.01)),
          aides: ['Ω = 2π (1 − cos θ/2).', `2π × (1 − cos ${fr(th / 2, 1)}°).`],
          solution: `Ω = 2π (1 − cos ${fr(th / 2, 1)}°) ≈ **${fr(omR, 3)} sr**, sur les 12,57 sr de la sphère.`,
        },
        {
          type: 'nombre', unite: 'cd', answer: Ir, tol: Math.max(100, I * 0.02),
          q: `Le projecteur émet **${fr(phi)} lm**, répartis dans un faisceau de **${th}°**. Quelle est son intensité moyenne dans le faisceau, en candelas ? (arrondie à la centaine)`,
          pieges: pg([{ v: r(phi * om, -2), why: 'L\'intensité est le flux divisé par l\'angle solide, pas multiplié.' }, { v: r(phi / th, 0), why: 'On divise par l\'angle solide en stéradians, pas par l\'angle en degrés.' }], Ir, Math.max(100, I * 0.02)),
          aides: ['Une candela, c\'est un lumen par stéradian.', `I = Φ ÷ Ω, avec Ω = 2π (1 − cos ${fr(th / 2, 1)}°) ≈ ${fr(omR, 3)} sr.`],
          solution: `I = ${fr(phi)} ÷ ${fr(om, 3)} ≈ **${fr(Ir)} cd**.`,
        },
        {
          type: 'nombre', unite: 'lx', answer: Er, tol: Math.max(1, E * 0.01),
          q: `Un projecteur a une intensité de **${fr(I2)} cd** dans son axe. Le visage est à **${d} m**, face à lui. Quel éclairement reçoit-il ?`,
          pieges: pg([{ v: r(I2 / d, 0), why: 'L\'éclairement baisse comme le carré de la distance : E = I ÷ d².' }], Er, Math.max(1, E * 0.01)),
          aides: ['Un lux, c\'est un lumen par mètre carré ; dans l\'axe, E = I ÷ d².', `${fr(I2)} ÷ ${d}².`],
          solution: `E = ${fr(I2)} ÷ ${d * d} = **${fr(Er)} lx**.`,
        },
        {
          type: 'nombre', unite: 'cd/m²', answer: Lr, tol: Math.max(0.2, Lr * 0.01),
          q: `Une carte **${carte[0]}** (${fr(rho * 100)} % de réflexion, surface mate) reçoit **${fr(E3)} lx**. Quelle est sa luminance ?`,
          pieges: pg([{ v: r(rho * E3, 1), why: 'Il manque la division par π : une surface mate renvoie sa lumière dans tout un demi-espace.' }, { v: E3, why: 'Les lux (ce qui arrive) ne sont pas des cd/m² (ce qui repart), et la carte ne renvoie qu\'une part de la lumière.' }], Lr, Math.max(0.2, Lr * 0.01)),
          aides: ['Pour une surface mate, L = ρ × E ÷ π.', `${fr(rho, 2)} × ${fr(E3)} ÷ π.`],
          solution: `L = ${fr(rho, 2)} × ${fr(E3)} ÷ π ≈ **${fr(Lr, 1)} cd/m²**.`,
        },
      ];
    },
  },
  'lumiere-distance': {
    titre: 'Doser par la distance et l\'angle',
    consigne: 'Au plateau, la principale ne se gradue pas : vous dosez la lumière par la distance, vous tenez compte de l\'incidence et du bord du faisceau.',
    gen: (rnd) => {
      const S = pick(rnd, [SOURCES.fresnel, SOURCES.hmi]), ang = pick(rnd, [20, 25, 30, 40]);
      const d1 = pick(rnd, [2, 3, 4]), k = pick(rnd, [1.5, 2, 2.5, 3]), d2 = d1 * k;
      const E1 = r(eclairage({ source: S.id, angle: ang, niveau: 1, d: d1 }).E, 0);
      const E2 = r(eclairage({ source: S.id, angle: ang, niveau: 1, d: d2 }).E, 0);
      const dia = r(diaphs(E1, E2), 2);
      const inc = pick(rnd, [30, 45, 60, 70]), d3 = pick(rnd, [3, 4, 5]);
      const E0 = eclairage({ source: S.id, angle: ang, niveau: 1, d: d3 }).E, Ei = eclairage({ source: S.id, angle: ang, niveau: 1, d: d3, incidence: inc }).E;
      const E0r = r(E0, 0), Eir = r(Ei, 0);
      const th = pick(rnd, [12, 16, 20, 24, 30, 36, 40]), champ = r(angleChampDe(th), 0);
      const alpha = pick(rnd, [th / 2, angleChampDe(th) / 2]);
      const part = profil(th, alpha);
      return [
        {
          type: 'nombre', unite: 'lx', answer: E2, tol: Math.max(1, E2 * 0.01),
          q: `Le ${S.nom}, réglé à ${ang}°, donne **${fr(E1)} lx** sur le visage à **${fr(d1)} m**. On le recule à **${fr(d2, 1)} m**. Quel éclairement lit le luxmètre ?`,
          pieges: pg([{ v: r(E1 / k, 0), why: 'L\'éclairement ne suit pas la distance, mais son carré.' }], E2, Math.max(1, E2 * 0.01)),
          aides: ['Loi de l\'inverse du carré : E₂ = E₁ × (d₁ ÷ d₂)².', `${fr(E1)} × (${fr(d1)} ÷ ${fr(d2, 1)})².`],
          solution: `${fr(E1)} × (${fr(d1)} ÷ ${fr(d2, 1)})² = ${fr(E1)} ÷ ${fr(k * k, 2)} ≈ **${fr(E2)} lx**.`,
        },
        {
          type: 'nombre', unite: 'diaphs', answer: dia, tol: 0.05,
          q: `De ${fr(d1)} m à ${fr(d2, 1)} m, l'éclairement passe de ${fr(E1)} à ${fr(E2)} lx. Combien de diaphs le visage a-t-il perdus ?`,
          pieges: pg([{ v: r(Math.log2(k), 2), why: 'La distance a été multipliée par ' + fr(k, 1) + ', mais la lumière par son carré : log₂ (' + fr(k * k, 2) + ').' }], dia, 0.05),
          aides: ['Un diaph, c\'est un facteur 2 de lumière : on compte en log₂.', `log₂ (${fr(E1)} ÷ ${fr(E2)}).`],
          solution: `log₂ (${fr(E1)} ÷ ${fr(E2)}) ≈ **${fr(dia, 2)} diaphs**${k === 2 ? ' : deux fois plus loin, deux diaphs' : ''}.`,
        },
        {
          type: 'nombre', unite: 'lx', answer: Eir, tol: Math.max(1, Ei * 0.01),
          q: `Face au projecteur, à ${d3} m, le décor reçoit **${fr(E0r)} lx**. On tourne le décor : la lumière arrive maintenant à **${inc}°** de sa perpendiculaire (même distance). Quel éclairement reçoit-il ?`,
          pieges: pg([{ v: r(E0 * Math.cos(inc * Math.PI / 180) ** 2, 0), why: 'Le carré, c\'est pour la distance ; pour l\'incidence, c\'est cos i, une fois.' }, { v: E0r, why: 'De biais, la même lumière s\'étale sur une surface plus grande : elle est multipliée par cos i.' }], Eir, Math.max(1, Ei * 0.01)),
          aides: ['E = I × cos i ÷ d² : seul le cosinus change.', `${fr(E0r)} × cos ${inc}°.`],
          solution: `${fr(E0r)} × cos ${inc}° = ${fr(E0r)} × ${fr(Math.cos(inc * Math.PI / 180), 3)} ≈ **${fr(Eir)} lx**.`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: '°', answer: champ, tol: 1,
            q: `Un projecteur annonce un angle de faisceau de **${th}°** (50 % de l'axe). Avec le profil du Labo, l'angle de champ (10 %) vaut environ 1,82 fois le faisceau. Quel est son angle de champ ?`,
            aides: ['L\'angle de champ est plus large que le faisceau.', `${th} × 1,82.`],
            solution: `${th} × 1,82 ≈ **${fr(champ)}°** : au-delà, il reste moins de 10 % de l'axe.`,
          },
          {
            type: 'choix', q: `Un Fresnel réglé à **${th}°** de faisceau est pointé sur le présentateur. L'invité est assis à **${fr(alpha, 1)}°** de l'axe. Quelle part de l'intensité de l'axe reçoit-il ?`,
            choices: [['100 %', 'Hors de l\'axe, l\'intensité baisse.'], ['50 %', 'C\'est la valeur au bord de l\'angle de faisceau, à la moitié de ' + th + '°.'], ['10 %', 'C\'est la valeur au bord de l\'angle de champ, environ 1,82 fois le faisceau.']].map((c, i) => (i === (part > 0.9 ? 0 : part > 0.3 ? 1 : 2) ? c[0] : c)), answer: part > 0.9 ? 0 : part > 0.3 ? 1 : 2,
            aides: ['Comparez l\'écart à la moitié de l\'angle de faisceau, puis de l\'angle de champ.', `Moitié du faisceau : ${fr(th / 2, 1)}° ; moitié du champ : ${fr(angleChampDe(th) / 2, 1)}°.`],
            solution: `À ${fr(alpha, 1)}° de l'axe d'un faisceau de ${th}° : **${fr(part * 100, 0)} %** de l'axe${part < 0.9 ? ', on repointe ou on ajoute un projecteur' : ''}.`,
          },
          ...SITUATIONS_DISTANCE,
        ]),
      ];
    },
  },
  'lumiere-couleur': {
    titre: 'Accorder la couleur de la lumière',
    consigne: 'Au plateau, vous accordez les sources à la balance de la caméra : vous comptez en mireds, vous choisissez la gélatine et vous surveillez le gradateur.',
    gen: (rnd) => {
      const T = pick(rnd, [2800, 3200, 4300, 5000, 5600, 6500]), m = r(mired(T), 0);
      const src = pick(rnd, [['un halogène à 3 200 K', 3200], ['une HMI à 5 600 K', 5600], ['une LED réglée à 4 300 K', 4300]]);
      const Ts = /** @type {number} */ (src[1]), G = pick(rnd, GELS.filter((g) => g.mired !== 0));
      const Tg = r(kelvin(mired(Ts) + G.mired), -1);
      const [Tl, Tc] = pick(rnd, [[3200, 5600], [5600, 3200], [3200, 4300], [5600, 4300], [4300, 3200], [2800, 3200], [6500, 5600]]);
      const best = gelPour(Tl, Tc), autres = tirer(rnd, GELS_COULEUR.filter((g) => g.id !== best.id), 2);
      const v = pick(rnd, [0.5, 0.6, 0.7, 0.8, 0.9]), Tv = gradateur(SOURCES.fresnel, v).T, dm = r(dominante(Tv, 3200), 0);
      return [
        {
          type: 'nombre', unite: 'mireds', answer: m, tol: 1,
          q: `Une lumière est à **${fr(T)} K**. Que vaut-elle en mireds ?`,
          aides: ['Mireds = un million divisé par les kelvins.', `10⁶ ÷ ${fr(T)}.`],
          solution: `10⁶ ÷ ${fr(T)} ≈ **${fr(m)} mireds**.`,
        },
        {
          type: 'nombre', unite: 'K', answer: Tg, tol: 30,
          q: `On pose la gélatine **${G.nom}** (environ ${sg(G.mired)} mireds) sur **${src[0]}**. Quelle température de couleur obtient-on ? (à la dizaine de kelvins)`,
          pieges: pg([{ v: r(Ts - G.mired, -1), why: 'Une gélatine décale des mireds, pas des kelvins : passez par 10⁶ ÷ K.' }], Tg, 30),
          aides: ['Passez en mireds, ajoutez le décalage de la gélatine, revenez en kelvins.', `10⁶ ÷ (10⁶ ÷ ${fr(Ts)} ${G.mired < 0 ? '−' : '+'} ${Math.abs(G.mired)}).`],
          solution: `${fr(mired(Ts), 1)} ${G.mired < 0 ? '−' : '+'} ${Math.abs(G.mired)} = ${fr(mired(Ts) + G.mired, 1)} mireds, soit **${fr(Tg)} K**.`,
        },
        {
          type: 'choix', q: `La lumière du plateau est à **${fr(Tl)} K**, la caméra est balancée à **${fr(Tc)} K**, et on ne touche pas à la caméra. Quelle gélatine poser sur les sources ?`,
          choices: [best.nom, ...autres.map((g) => [g.nom, `Il faut ${sg(r(mired(Tc) - mired(Tl), 0))} mireds ; ${g.nom.toLowerCase()} en donne ${sg(g.mired)}.`])], answer: 0,
          aides: ['Calculez la correction en mireds : balance moins lumière.', `${fr(mired(Tc), 0)} − ${fr(mired(Tl), 0)} mireds ; cherchez la gélatine la plus proche.`],
          solution: `Il faut ${sg(r(mired(Tc) - mired(Tl), 0))} mireds : la gélatine **${best.nom}** (${sg(best.mired)}) est la plus proche${Math.abs(mired(Tc) - mired(Tl) - best.mired) <= TOL_MIRED ? ', à moins d\'une vingtaine de mireds près' : ''}.`,
        },
        {
          type: 'nombre', unite: 'mireds', answer: dm, tol: 2,
          q: `Un Fresnel halogène (3 200 K à pleine tension) est baissé au gradateur à **${fr(v * 100)} %** de la tension. Sa température suit environ la tension à la puissance 0,42. La caméra est balancée à 3 200 K : de combien de mireds la lumière est-elle plus chaude ?`,
          pieges: pg([{ v: r(3200 - Tv, 0), why: 'C\'est l\'écart en kelvins ; la question le demande en mireds.' }], dm, 2),
          aides: [`T = 3 200 × ${fr(v, 1)}^0,42 ; puis passez en mireds.`, `Écart = 10⁶ ÷ T − 10⁶ ÷ 3 200.`],
          solution: `T ≈ ${fr(r(Tv, -1))} K, soit ${fr(mired(Tv), 0)} mireds contre ${fr(mired(3200), 1)} : **${sg(dm)} mireds**, ${Math.abs(dm) <= TOL_MIRED ? 'presque invisible' : 'une dominante orange visible'}.`,
        },
      ];
    },
  },
  'lumiere-mesure': {
    titre: 'Mesurer et exposer',
    consigne: 'Avec un luxmètre, un spotmètre et la fiche de la caméra, vous trouvez le bon diaphragme, vous repérez l\'erreur du spotmètre et vous rattrapez au gain ce qui manque.',
    gen: (rnd) => {
      const E = pick(rnd, [250, 400, 500, 800, 1000, 1600, 2000]), S = pick(rnd, [400, 800, 1600]), t = 1 / pick(rnd, [25, 50, 100]);
      const N = r(ouverture(E, S, t), 1);
      const rho = pick(rnd, [['une chemise blanche', 0.9], ['un costume gris clair', 0.36], ['une veste noire', 0.04], ['un maillot sombre', 0.09]]);
      const err = r(erreurSpot(/** @type {number} */ (rho[1])), 1);
      const L = pick(rnd, [20, 40, 60, 100, 160]), Ns = r(ouvertureSpot(L, S, t), 1);
      const n = pick(rnd, [1, 1.5, 2, 3]), dB = r(dbPourDiaphs(n), 1);
      const Ec = pick(rnd, [500, 1000, 1400, 2000, 4000]), Nc = r(ouvertureCamera(Ec), 1);
      const autre = pick(rnd, [
        {
          type: 'nombre', unite: 'dB', answer: dB, tol: 0.4,
          q: `L'iris est grand ouvert et il manque **${fr(n, 1)} diaph${n >= 2 ? 's' : ''}** de lumière. Quel gain faut-il monter, en décibels ?`,
          pieges: pg([{ v: n, why: 'Le gain se compte en décibels : environ 6 dB par diaph.' }, { v: r(n * 3, 1), why: '3 dB, c\'est un rapport de puissance ; le gain d\'un signal vidéo suit la tension : 20 log₁₀ 2 ≈ 6 dB par diaph.' }], dB, 0.4),
          aides: ['Un diaph = un facteur 2 sur le signal.', `20 log₁₀ 2 ≈ 6,02 dB par diaph, × ${fr(n, 1)}.`],
          solution: `${fr(n, 1)} × 6,02 ≈ **${fr(dB, 1)} dB**. Le bruit monte d'autant.`,
        },
        {
          type: 'nombre', answer: Nc, tol: 0.15,
          q: `La caméra du car annonce **f/13 à 2 000 lx**. Le stade est éclairé à **${fr(Ec)} lx** vers les caméras. Quel nombre f faut-il (sans gain) ? Donnez le nombre seul.`,
          pieges: pg([{ v: r(13 * Ec / 2000, 1), why: 'La lumière suit le carré du nombre f : N = 13 × √(E ÷ 2 000).' }], Nc, 0.15),
          aides: ['La lumière qui entre suit 1 ÷ N² : N varie comme la racine carrée de l\'éclairement.', `13 × √(${fr(Ec)} ÷ 2 000).`],
          solution: `13 × √(${fr(Ec)} ÷ 2 000) ≈ **${fN(Nc)}**.`,
        },
        ...SITUATIONS_MESURE,
      ]);
      return [
        {
          type: 'nombre', answer: N, tol: Math.max(0.1, N * 0.02),
          q: `Le luxmètre (cellule plate, C = 250) lit **${fr(E)} lx** sur le visage. La caméra est à **ISO ${S}**, pose **1/${fr(1 / t)} s**. Quel nombre f faut-il ? (une décimale, le nombre seul)`,
          pieges: pg([{ v: r(E * t * S / 250, 1), why: 'La formule donne N² : il reste à prendre la racine carrée.' }], N, Math.max(0.1, N * 0.02)),
          aides: ['N² ÷ t = E × S ÷ C.', `N = √(${fr(E)} × ${fr(t, 3)} × ${S} ÷ 250).`],
          solution: `N² = ${fr(E)} × ${fr(t, 3)} × ${S} ÷ 250 = ${fr(E * t * S / 250, 2)}, donc **${fN(N)}**.`,
        },
        {
          type: 'nombre', answer: Ns, tol: Math.max(0.1, Ns * 0.02),
          q: `Au spotmètre (K = 12,5), un gris moyen mesure **${L} cd/m²**. ISO ${S}, pose 1/${fr(1 / t)} s. Quel nombre f le spotmètre donne-t-il ? (une décimale, le nombre seul)`,
          pieges: pg([{ v: r(L * t * S / 12.5, 1), why: 'La formule donne N² : prenez la racine carrée.' }], Ns, Math.max(0.1, Ns * 0.02)),
          aides: ['N² ÷ t = L × S ÷ K.', `N = √(${L} × ${fr(t, 3)} × ${S} ÷ 12,5).`],
          solution: `N² = ${L} × ${fr(t, 3)} × ${S} ÷ 12,5 = ${fr(L * t * S / 12.5, 2)}, donc **${fN(Ns)}**.`,
        },
        {
          type: 'choix', q: `Le cadreur expose au spotmètre en visant **${rho[0]}** (${fr(/** @type {number} */ (rho[1]) * 100)} % de réflexion). Comment sortira l'image ?`,
          choices: [['Sous-exposée', 'Le spotmètre rend gris tout ce qu\'il vise : un sujet plus sombre que le gris le fait ouvrir, l\'image sort surexposée.'], ['À peu près juste', 'Le spotmètre ne serait juste que sur un gris moyen : ici, l\'écart dépasse un demi-diaph.'], ['Surexposée', 'Le spotmètre rend gris tout ce qu\'il vise : un sujet plus clair que le gris le fait fermer, l\'image sort sous-exposée.']].map((c, i) => (i === (err < -0.5 ? 0 : err > 0.5 ? 2 : 1) ? c[0] : c)),
          answer: err < -0.5 ? 0 : err > 0.5 ? 2 : 1,
          aides: ['Le spotmètre suppose que le sujet est un gris moyen.', 'Le sujet est-il plus clair ou plus sombre que le gris (environ 16 à 18 %) ?'],
          solution: `Le spotmètre rend ce sujet gris : erreur de **${sg(err, 1)} diaph${Math.abs(err) >= 2 ? 's' : ''}** (${err < 0 ? 'sous-exposé' : 'surexposé'}). Mesurez plutôt la lumière incidente, ou une carte grise.`,
        },
        autre,
      ];
    },
  },
});
