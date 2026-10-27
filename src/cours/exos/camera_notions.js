// @ts-check
import { registerExos, entre, pick, tirer, fr } from '../exo.js';
import { maxAperture } from '../../camlab/optics.js';
import {
  angleDeg, transmission, fresnel, irisPour, diaphGain, diaphShutter, mired, focaleMoire, Y709, debitSDI, code10, codeC, pctDe, oetf709,
  vecteur, lumaBarre, BARRES, autonomie, couple, amplitudeBoucle, ycbcr, decalageImage, margeSecurite, CROP_S35,
} from '../camera_calc.js';

// ----------------------------------------------------------------------------------
// Exercices en autonomie des leçons de la caméra qui reprennent les notions de la caméra en 3D (cours/camera_objectif.js,
// camera_capteurs.js, camera_image.js, camera_corps.js, camera_signal.js) : des valeurs tirées à chaque essai, les
// réponses calculées par les mêmes fonctions que les manipulations (cours/camera_calc.js, camlab/optics.js) : largeur
// cadrée et focale d'un plan sur un capteur 2/3" (9,59 × 5,39 mm), angle de champ, Fresnel, nombre f et diaphragmes,
// hyperfocale (cercle de confusion 0,011 mm), ramping et doubleur du Fujinon ZA12x4.5, sensibilité f/13 à 2 000 lux,
// mireds, moiré, luminance BT.709, codes 10 bits, gamma, knee, vectorscope, budget d'énergie, couple, référence en
// boucle, PLUGE, Super 35, super ralenti.
// ----------------------------------------------------------------------------------
const W23 = 9.59, H23 = 5.39, COC = 0.011;
/** un nombre arrondi à d décimales */
const r = (v, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
/** un nombre f écrit */
const fN = (N) => 'f/' + fr(N, Number.isInteger(N) ? 0 : 1);
/** un choix dont les deux réponses fausses portent leur explication */
const choix = (q, bon, faux, aides, solution) => ({ type: 'choix', q, choices: [bon, ...faux], answer: 0, aides, solution });

registerExos({
  // ================= L'objectif =================
  'camera-focale': {
    titre: 'Placer une caméra et choisir sa focale',
    consigne: 'Au plateau puis au stade, vous calculez le champ cadré, la focale d\'un cadre et l\'angle de champ, sur un capteur 2/3" de 9,59 × 5,39 mm.',
    gen: (rnd) => {
      const D = pick(rnd, [2, 3, 4, 5, 6, 8, 10, 12, 15, 20]), f = pick(rnd, [4.5, 8, 10, 12, 15, 20, 25, 30, 40, 54]);
      const W = D * W23 / f;
      const w = pick(rnd, [0.5, 0.8, 1, 1.5, 2, 3, 5]), D2 = pick(rnd, [3, 4, 6, 8, 10, 15, 20, 30]), f2 = D2 * W23 / w;
      const f3 = pick(rnd, [4.5, 6, 8, 12, 16, 25, 35, 54, 100, 200]), a = angleDeg(W23, f3);
      const s = pick(rnd, [20, 24, 30, 36]), T = transmission(s, fresnel());
      const zoom = pick(rnd, [[4.5, 54, 'ZA12x4.5'], [9, 720, 'UA80x9'], [8.4, 900, 'UA107x8.4'], [7.8, 187, 'UA24x7.8']]);
      return [
        {
          type: 'nombre', unite: 'm', answer: r(W, 2), tol: Math.max(0.02, W * 0.02),
          q: `La caméra est à **${D} m** du sujet, zoom à **${fr(f, f % 1 ? 1 : 0)} mm**. Quelle largeur de décor cadre-t-elle à cette distance ?`,
          pieges: [{ v: r(D * H23 / f, 2), why: 'C\'est la hauteur cadrée : pour la largeur, on prend la largeur du capteur, 9,59 mm.' }],
          aides: ['La largeur cadrée grandit avec la distance et diminue quand la focale s\'allonge.', `Largeur = distance × 9,59 ÷ focale = ${D} × 9,59 ÷ ${fr(f, 1)}.`],
          solution: `${D} × 9,59 ÷ ${fr(f, 1)} = **${fr(W, 2)} m** de large (et ${fr(D * H23 / f, 2)} m de haut).`,
        },
        {
          type: 'nombre', unite: 'mm', answer: r(f2, 1), tol: Math.max(0.2, f2 * 0.02),
          q: `Le réalisateur veut **${fr(w, 1)} m** de large à **${D2} m** de la caméra. Quelle focale faut-il ?`,
          pieges: [{ v: r(D2 * H23 / w, 1), why: 'Vous avez pris la hauteur du capteur (5,39 mm) : pour une largeur, c\'est 9,59 mm.' }],
          aides: ['On inverse la formule de la largeur cadrée.', `Focale = distance × 9,59 ÷ largeur = ${D2} × 9,59 ÷ ${fr(w, 1)}.`],
          solution: `${D2} × 9,59 ÷ ${fr(w, 1)} = **${fr(f2, 1)} mm**${f2 > 54 ? (f2 > 108 ? ' : au-delà du ZA12x4.5, même doublé ; il faut un objectif plus long' : ' : il faut le doubleur du ZA12x4.5 (deux diaphragmes de moins)') : ' : le ZA12x4.5 suffit'}.`,
        },
        {
          type: 'nombre', unite: '°', answer: r(a, 1), tol: 0.5,
          q: `Quel est l'angle de champ horizontal d'un capteur 2/3" (9,59 mm de large) à **${fr(f3, f3 % 1 ? 1 : 0)} mm** ?`,
          pieges: [{ v: r(a / 2, 1), why: 'C\'est le demi-angle : l\'angle de champ vaut deux fois arctan(9,59 ÷ 2f).' }],
          aides: ['Un triangle : la moitié du capteur, la focale, et le demi-angle.', `Angle = 2 × arctan(9,59 ÷ (2 × ${fr(f3, 1)})), en degrés.`],
          solution: `2 × arctan(9,59 ÷ ${fr(2 * f3, 1)}) = **${fr(a, 1)}°**.`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: '%', answer: r(T * 100, 0), tol: 1,
            q: `Un zoom compte **${s} surfaces air-verre**, en verre nu : chacune renvoie 4 % de la lumière (Fresnel). Quelle part de la lumière arrive aux capteurs ?`,
            pieges: [{ v: r(100 - 4 * s, 0), why: 'Les pertes ne s\'ajoutent pas : chaque surface laisse passer 96 % de ce qui lui arrive, on multiplie.' }],
            aides: ['Chaque surface laisse passer 96 % de la lumière qui lui arrive.', `Transmission = 0,96 puissance ${s}.`],
            solution: `0,96^${s} = **${fr(T * 100, 0)} %** : sans traitement multicouche, le zoom perdrait plus d'un diaphragme et demi, et la lumière renvoyée ferait un voile sur l'image.`,
          },
          {
            type: 'nombre', answer: r(zoom[1] / zoom[0], 1), tol: 0.1,
            q: `Le zoom **${zoom[2]}** va de ${fr(zoom[0], 1)} à ${fr(zoom[1], 0)} mm. Quel est son rapport de zoom ?`,
            pieges: [{ v: r(zoom[1] - zoom[0], 1), why: 'Le rapport est une division, pas une différence : la plus longue focale divisée par la plus courte.' }],
            aides: ['Le rapport de zoom est un « nombre de fois ».', `${fr(zoom[1], 0)} ÷ ${fr(zoom[0], 1)}.`],
            solution: `${fr(zoom[1], 0)} ÷ ${fr(zoom[0], 1)} = **${fr(zoom[1] / zoom[0], 1)}** fois : c'est le premier nombre du nom de l'objectif.`,
          },
          choix('À l\'image, une frange rouge d\'un côté des contours, bleue de l\'autre : nulle au centre, elle grandit vers les bords et au grand angle. De quoi s\'agit-il ?',
            'L\'aberration chromatique latérale de l\'objectif, que l\'ALAC de la caméra corrige',
            [['Un capteur décalé sur le prisme', 'Un défaut de registration donne le même liseré partout, au centre comme au bord.'], ['Une balance des blancs ratée', 'La balance change la couleur de toute l\'image, pas les contours.']],
            ['Regardez où le défaut est nul.', 'Un défaut qui dépend de la position dans l\'image vient de l\'objectif.'],
            'L\'**aberration chromatique latérale** : chaque couleur forme une image d\'une taille un peu différente. L\'ALAC agrandit ou réduit les images rouge et bleue pour les recaler sur la verte.'),
          choix('Le réalisateur veut un fond qui paraît tout proche du sujet, « tassé ». Que fait le cadreur ?',
            'Il recule la caméra et serre au téléobjectif',
            [['Il avance la caméra et élargit au grand angle', 'De près en grand angle, la perspective est exagérée : le fond paraît plus loin, le nez grossit.'], ['Il zoome sans bouger : la perspective change avec la focale', 'Zoomer agrandit l\'image sans changer le point de vue : seule la place de la caméra change la perspective.']],
            ['La perspective dépend de la place de la caméra.', 'De loin, au téléobjectif, les plans se rapprochent.'],
            'On **recule** et on **serre** : de loin, au téléobjectif, les plans s\'aplatissent. Zoomer seul ne change pas la perspective.'),
        ]),
      ];
    },
  },
  'camera-iris': {
    titre: 'Doser la lumière et la zone nette',
    consigne: 'Avec le zoom Fujinon ZA12x4.5 (f/1,8 jusqu\'à 41 mm, f/2,4 à 54 mm, doubleur ×2) sur un capteur 2/3" (cercle de confusion 0,011 mm), vous comptez les diaphragmes et la profondeur de champ.',
    gen: (rnd) => {
      const ST = [2, 2.8, 4, 5.6, 8, 11, 16];
      const k1 = entre(rnd, 0, 4), k2 = entre(rnd, k1 + 1, Math.min(6, k1 + 3)), d = k2 - k1;
      const f = pick(rnd, [4.5, 6, 8, 10, 12, 15, 20]), N = pick(rnd, [2.8, 4, 5.6, 8]), H = f * f / (N * COC) / 1000;
      const fl = pick(rnd, [43, 45, 47, 49, 51, 54]), Nmax = maxAperture(fl);
      const Nd = pick(rnd, [1.8, 2.4, 2.8, 4, 5.6]);
      return [
        {
          type: 'nombre', answer: 2 ** d,
          q: `On ferme l'iris de **${fN(ST[k1])}** à **${fN(ST[k2])}**. Par combien la lumière reçue par les capteurs est-elle divisée ?`,
          pieges: [{ v: r(ST[k2] / ST[k1], 2), why: 'Le rapport des nombres f compte le diamètre ; la lumière passe par la surface, qui varie comme son carré.' }, { v: d, why: 'C\'est le nombre de crans : chaque cran divise la lumière par deux.' }].filter((p) => p.v !== 2 ** d),
          aides: ['Un cran de l\'échelle (2 · 2,8 · 4 · 5,6 · 8 · 11 · 16) divise la lumière par deux.', `De ${fN(ST[k1])} à ${fN(ST[k2])}, il y a ${d} cran${d > 1 ? 's' : ''} : 2 puissance ${d}.`],
          solution: `${d} cran${d > 1 ? 's' : ''} : la lumière est divisée par **${2 ** d}**.`,
        },
        {
          type: 'nombre', unite: 'm', answer: r(H, H < 10 ? 2 : 1), tol: Math.max(0.02, H * 0.03),
          q: `Quelle est la distance hyperfocale à **${fr(f, f % 1 ? 1 : 0)} mm** et **${fN(N)}** (cercle de confusion 0,011 mm) ?`,
          pieges: [{ v: r(f * f / N / 1000, 3), why: 'Il manque le cercle de confusion : H = f² ÷ (N × 0,011), en millimètres, puis en mètres.' }],
          aides: ['H = f² ÷ (N × c), avec f et c en millimètres.', `${fr(f, 1)}² ÷ (${fr(N, 1)} × 0,011) = … mm, à diviser par 1 000.`],
          solution: `${fr(f, 1)}² ÷ (${fr(N, 1)} × 0,011) ≈ ${fr(H * 1000, 0)} mm = **${fr(H, 2)} m** : point réglé là, tout est net de ${fr(H / 2, 2)} m à l'infini.`,
        },
        pick(rnd, [
          {
            type: 'nombre', answer: r(Nmax, 2), tol: 0.03,
            q: `Iris grand ouvert, le cadreur serre à **${fl} mm**. Quel nombre f donne réellement l'objectif ? (f/1,8 jusqu'à 41 mm : au-delà, la pupille plafonne vers 22,8 mm)`,
            pieges: [{ v: 1.8, why: 'Au-delà de 41 mm, c\'est le ramping : la pupille ne grandit plus, le nombre f augmente.' }],
            aides: ['Le nombre f est la focale divisée par le diamètre de la pupille d\'entrée.', `La pupille reste à 41 ÷ 1,8 ≈ 22,8 mm : ${fl} ÷ 22,8, sans dépasser f/2,4.`],
            solution: `1,8 × ${fl} ÷ 41 = **f/${fr(Nmax, 2)}**${fl >= 54 ? ' (la fiche arrondit à f/2,4 à 54 mm)' : ''} : un peu moins de lumière qu'au large, c'est le ramping.`,
          },
          {
            type: 'nombre', answer: r(Nd * 2, 1), tol: 0.05,
            q: `L'iris est à **${fN(Nd)}**. Le cadreur engage le doubleur ×2. Quel est le nombre f réel ?`,
            pieges: [{ v: r(Nd * Math.SQRT2, 1), why: 'Ce serait un seul diaphragme perdu ; le doubleur en coûte deux : le nombre f double.' }],
            aides: ['Le doubleur agrandit l\'image deux fois en hauteur et en largeur.', 'La même lumière sur une image quatre fois plus grande : deux diaphragmes, le nombre f double.'],
            solution: `${fN(Nd)} × 2 = **${fN(Nd * 2)}** : deux diaphragmes de moins, il faudra ouvrir l'iris ou monter le gain.`,
          },
        ]),
        pick(rnd, [
          choix('Pour une interview, le réalisateur veut le visage net et le fond très flou. Que choisit-on ?',
            'Une focale longue, l\'iris ouvert, la caméra reculée et le sujet loin du fond',
            [['Une focale courte et l\'iris fermé', 'C\'est la recette du « tout net » : beaucoup de profondeur de champ.'], ['Plus de gain', 'Le gain ne change rien à la zone nette, il ajoute du bruit.']],
            ['Quels leviers raccourcissent la zone nette ?', 'L\'iris ouvert, la focale longue, et la distance entre le sujet et le fond.'],
            'Focale **longue**, iris **ouvert**, sujet loin du fond : la zone nette se resserre autour du visage.'),
          choix('Le cadreur vérifie son point en plan large, tout paraît net ; au premier serré à 54 mm, le visage est flou. Pourquoi ?',
            'En large, la profondeur de champ cachait l\'erreur : on fait toujours le point en serré',
            [['L\'iris a bougé pendant le zoom', 'L\'iris n\'a rien à voir : c\'est la zone nette qui fond quand la focale s\'allonge.'], ['Le doubleur s\'est engagé', 'Le doubleur se bascule à la main, par un levier : il ne s\'engage pas tout seul.']],
            ['Comment varie la profondeur de champ avec la focale ?', 'Elle diminue comme le carré de la focale.'],
            'En large, la zone nette est immense et cache l\'erreur. On fait le point **en serré**, puis on élargit.'),
        ]),
      ];
    },
  },
  'camera-point': {
    titre: 'Faire le point et choisir l\'objectif',
    consigne: 'Au stade et au plateau, vous calculez la focale d\'un plan (capteur 2/3" de 5,39 mm de haut), le décalage d\'une macro, et vous diagnostiquez un point qui décroche.',
    gen: (rnd) => {
      const [h, nom] = pick(rnd, [[0.4, 'un visage (40 cm de haut)'], [0.6, 'un plan poitrine (60 cm)'], [1.2, 'un plan américain (1,2 m)'], [2, 'un joueur en pied (2 m)']]);
      const D = pick(rnd, [3, 5, 8, 12, 20, 30, 50, 80]), f = D * H23 / h;
      const lens = f <= 54 ? 0 : f <= 108 ? 1 : 2;
      const fm = pick(rnd, [4.5, 5, 6, 8, 10]), dm = pick(rnd, [0.08, 0.1, 0.12, 0.15, 0.2]), dec = decalageImage(fm, dm);
      const LENS = ['Le ZA12x4.5 suffit (4,5 à 54 mm)', 'Le ZA12x4.5 avec son doubleur (9 à 108 mm)', 'Il faut un objectif plus long : un portable long ou un box'];
      return [
        {
          type: 'nombre', unite: 'mm', answer: r(f, 0), tol: Math.max(1, f * 0.02),
          q: `Le réalisateur demande **${nom}** d'un sujet à **${D} m**. Quelle focale faut-il ?`,
          pieges: [{ v: r(D * W23 / h, 0), why: 'Vous avez pris la largeur du capteur ; une hauteur cadrée se calcule avec sa hauteur, 5,39 mm.' }],
          aides: ['La hauteur cadrée vaut distance × 5,39 ÷ focale.', `Focale = ${D} × 5,39 ÷ ${fr(h, 1)}.`],
          solution: `${D} × 5,39 ÷ ${fr(h, 1)} = **${fr(f, 0)} mm**.`,
        },
        {
          type: 'choix', q: `Pour ces **${fr(f, 0)} mm**, quel objectif ?`,
          choices: LENS.map((t, k) => (k === lens ? t : [t, k < lens ? `${k === 0 ? '54' : '108'} mm, c'est trop court pour ${fr(f, 0)} mm.` : 'Un objectif plus court suffit : le doubleur ou un long foyer inutile coûte de la lumière.'])), answer: lens,
          aides: ['Comparez la focale demandée aux plus longues focales disponibles.', 'ZA12x4.5 : 54 mm ; doublé : 108 mm ; au-delà, un autre objectif.'],
          solution: `**${LENS[lens]}**.${lens === 1 ? ' Le doubleur coûte deux diaphragmes.' : ''}`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: 'mm', answer: r(dec, 2), tol: Math.max(0.01, dec * 0.03),
            q: `À **${fr(fm, fm % 1 ? 1 : 0)} mm**, on veut voir net à **${fr(dm * 100, 0)} cm**, plus près que la distance minimale (0,3 m). De combien la bague macro doit-elle décaler l'image ? (Δ = f² × (1/d − 1/0,3), en mm)`,
            pieges: [{ v: r(fm * fm / (dm * 1000), 2), why: 'Il faut retrancher ce que la bague de point fait déjà jusqu\'à 0,3 m : f² × (1/d − 1/d₀).' }],
            aides: ['Travaillez en millimètres : d = ' + fr(dm * 1000, 0) + ' mm, d₀ = 300 mm.', `${fr(fm, 1)}² × (1/${fr(dm * 1000, 0)} − 1/300).`],
            solution: `${fr(fm, 1)}² × (1/${fr(dm * 1000, 0)} − 1/300) = **${fr(dec, 2)} mm** : facile au grand angle ; à 54 mm, il faudrait des millimètres entiers, la macro est un outil du grand angle.`,
          },
          {
            type: 'ordre', q: 'Remettez dans l\'ordre le réglage du tirage optique.',
            items: ['Étoile de Siemens à 3 m, iris grand ouvert, doubleur sur ×1, macro au repos', 'Zoomer à fond (54 mm) et faire le point avec la bague de point', 'Élargir à fond (4,5 mm) et rendre l\'étoile nette avec la bague F.f', 'Recommencer serré, puis large, jusqu\'à ce que l\'image tienne', 'Bloquer la vis de la bague F.f'],
            aides: ['On prépare d\'abord ce qui pourrait cacher le défaut.', 'Serré : la bague de point ; large : la bague F.f ; puis on recommence et on bloque.'],
            solution: 'Préparer (iris ouvert, ×1, macro au repos) ; point en serré ; F.f en large ; recommencer ; bloquer la vis.',
          },
        ]),
        pick(rnd, [
          choix('Macro verrouillée au repos, la caméra est nette en serré et floue en large. On vient de remonter son objectif. Que faire ?',
            'Refaire le tirage à la bague F.f, iris grand ouvert',
            [['Demander au cadreur de refaire le point en large', 'En large, la bague de point n\'agit presque plus : elle ne rattrape pas une erreur de tirage.'], ['Fermer l\'iris', 'La profondeur de champ cache l\'erreur sans la corriger.']],
            ['Net en serré, flou en large : c\'est un signe connu.', 'On le règle après chaque montage d\'objectif.'],
            '**Le tirage** : la bague F.f, en large, iris ouvert ; on recommence jusqu\'à ce que le zoom soit parfocal.'),
          choix('Objectif monté, image correcte, mais l\'iris ne répond plus au RCP et le viseur n\'affiche plus ni zoom ni iris. Que vérifier ?',
            'Le câble 12 broches de l\'objectif, sur la prise LENS (à brancher caméra éteinte)',
            [['La fibre de la caméra', 'L\'image arrive : la fibre fonctionne. C\'est le lien entre l\'objectif et la caméra qui manque.'], ['La bague F.f', 'Le tirage règle la netteté, pas la commande de l\'iris.']],
            ['Par où passent la commande de l\'iris et la position du zoom ?', 'Un câble court relie l\'objectif à la caméra.'],
            'Le **câble 12 broches** : il porte l\'alimentation des moteurs, la commande de l\'iris et les positions de l\'objectif.'),
        ]),
      ];
    },
  },
  // ================= Filtres, prisme et capteurs =================
  'camera-filtres': {
    titre: 'Choisir le filtre et corriger la couleur',
    consigne: 'La caméra donne f/13 à 2 000 lux sans filtre : N = 13 × √(lux ÷ 2 000 × transmission du filtre). Vous choisissez le ND, comptez en mireds et repérez le moiré (photosites de 5 µm).',
    gen: (rnd) => {
      const NDS = [[1, 'CLEAR'], [1 / 4, '1/4'], [1 / 16, '1/16'], [1 / 64, '1/64']];
      const lux = pick(rnd, [2000, 5000, 10000, 20000, 40000]), nd = pick(rnd, NDS.slice(1)), N = irisPour(lux, /** @type {number} */ (nd[0]));
      const lux2 = pick(rnd, [500, 2000, 10000, 40000]);
      const ok = NDS.findIndex(([t]) => { const n = irisPour(lux2, /** @type {number} */ (t)); return n >= 4 && n < 8; });
      const [T1, T2] = tirer(rnd, [2800, 3200, 4300, 5600, 6300, 8000], 2), dm = Math.abs(mired(T1) - mired(T2));
      const P = pick(rnd, [2, 3, 3.9, 6, 10]), D = pick(rnd, [3, 5, 8, 12, 20]), fm = focaleMoire(P, D);
      return [
        {
          type: 'nombre', answer: r(N, 1), tol: Math.max(0.1, N * 0.02),
          q: `Scène à **${fr(lux)} lux**, filtre **ND ${nd[1]}** en place. Quel iris expose juste ?`,
          pieges: [{ v: r(irisPour(lux), 1), why: 'C\'est l\'iris sans filtre : le ND retire de la lumière, l\'iris doit s\'ouvrir.' }],
          aides: ['Le filtre laisse passer une fraction de la lumière : on la multiplie sous la racine.', `13 × √(${fr(lux)} ÷ 2 000 × ${nd[1]}).`],
          solution: `13 × √(${fr(lux)} ÷ 2 000 × ${nd[1]}) = **${fN(r(N, 1))}**.`,
        },
        {
          type: 'choix', q: `Scène à **${fr(lux2)} lux**. Quel filtre ramène l'iris entre f/4 et f/8, la zone où l'objectif est le meilleur ?`,
          choices: NDS.map(([t, n], k) => { const nom = k ? `ND ${n}` : 'CLEAR (sans filtre)'; return k === ok ? nom : [nom, `Avec ce filtre, il faudrait ${fN(r(irisPour(lux2, /** @type {number} */ (t)), 1))}.`]; }), answer: ok,
          aides: ['Calculez l\'iris pour chaque filtre : N = 13 × √(lux ÷ 2 000 × transmission).', 'Chaque cran de la roue retire deux diaphragmes : l\'iris s\'ouvre d\'un facteur 2.'],
          solution: `**${ok ? 'ND ' + NDS[ok][1] : 'CLEAR'}** : l'iris tombe à ${fN(r(irisPour(lux2, /** @type {number} */ (NDS[ok][0])), 1))}.`,
        },
        {
          type: 'nombre', unite: 'mired', answer: r(dm, 0), tol: 1,
          q: `Quel est l'écart, en mireds, entre une lumière à **${fr(T1)} K** et une autre à **${fr(T2)} K** ? (mired = 1 000 000 ÷ T)`,
          pieges: [{ v: Math.abs(T1 - T2), why: 'C\'est l\'écart en kelvins ; en mireds, on compare 10⁶ ÷ T.' }],
          aides: ['Calculez 1 000 000 ÷ T pour chaque lumière.', `${fr(mired(T1), 1)} et ${fr(mired(T2), 1)} : la différence.`],
          solution: `|${fr(mired(T1), 1)} − ${fr(mired(T2), 1)}| ≈ **${fr(dm, 0)} mireds**${dm < 30 ? ' : un petit écart' : ' : un grand écart, on choisit d\'abord le CC le plus proche'}.`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: 'mm', answer: r(fm, 1), tol: Math.max(0.2, fm * 0.02),
            q: `Un motif régulier de **${fr(P, 1)} mm** de période (un mur LED, des rayures) est à **${D} m**. Sous quelle focale tombe-t-il sous deux photosites de 5 µm, là où le moiré guette ?`,
            pieges: [{ v: r(fm / 2, 1), why: 'C\'est la limite d\'un seul photosite ; Nyquist demande deux photosites par période.' }],
            aides: ['Sur le capteur, la période vaut P × f ÷ D (tout en mm).', `On la veut égale à 2 × 0,005 mm : f = 0,01 × ${fr(D * 1000)} ÷ ${fr(P, 1)}.`],
            solution: `0,01 × ${fr(D * 1000)} ÷ ${fr(P, 1)} = **${fr(fm, 1)} mm** : en dessous (plus large), le motif est trop fin et se replie en moiré.`,
          },
          choix('Sous les projecteurs tungstène, des costumes noirs synthétiques virent au bordeaux à l\'image. Quel filtre est en cause ?',
            'Le filtre infrarouge, devant les capteurs',
            [['Le filtre ND', 'Un ND retire la même part de toutes les couleurs : il ne fait pas virer une teinte.'], ['Le filtre passe-bas optique', 'Il efface le moiré, il ne touche pas aux couleurs.']],
            ['Le silicium voit plus loin que l\'œil, au-delà du rouge.', 'Une lampe tungstène émet beaucoup au-delà de 700 nm.'],
            'Le **filtre infrarouge** : sans lui, l\'infrarouge s\'ajoute à la voie rouge (maximum du tungstène vers 906 nm).'),
        ]),
      ];
    },
  },
  'camera-prisme': {
    titre: 'Du prisme aux capteurs',
    consigne: 'Vous calculez la luminance d\'une couleur (BT.709), le bruit d\'un photosite, l\'iris qu\'impose la sensibilité de la caméra (f/13 à 2 000 lux) et le débit d\'un format.',
    gen: (rnd) => {
      const R = pick(rnd, [10, 20, 40, 60, 80, 90]), G = pick(rnd, [10, 30, 50, 70, 90]), B = pick(rnd, [5, 20, 40, 60, 90]);
      const Y = Y709(R, G, B);
      const n = pick(rnd, [100, 400, 900, 2500, 10000, 40000]), bruit = 100 / Math.sqrt(n);
      const lux = pick(rnd, [100, 200, 400, 500, 800, 1000, 3000]), N = irisPour(lux);
      const fmt = pick(rnd, ['1080i50', '1080p50', '2160p50', '720p50']), deb = debitSDI(/** @type {any} */ (fmt));
      const LIENS = ['HD-SDI (1,485 Gb/s)', '3G-SDI (2,97 Gb/s)', '12G-SDI (11,88 Gb/s)'];
      const lien = deb < 2 ? 0 : deb < 3 ? 1 : 2;
      return [
        {
          type: 'nombre', unite: '%', answer: r(Y, 1), tol: 0.5,
          q: `Une couleur donne **R ${R} %**, **V ${G} %**, **B ${B} %** sur les trois capteurs. Quelle est sa luminance Y (BT.709) ?`,
          pieges: [{ v: r((R + G + B) / 3, 1), why: 'Les trois couleurs ne pèsent pas autant : le vert compte pour plus de 70 % de la luminance.' }],
          aides: ['Y = 0,2126 R + 0,7152 V + 0,0722 B.', `0,2126 × ${R} + 0,7152 × ${G} + 0,0722 × ${B}.`],
          solution: `0,2126 × ${R} + 0,7152 × ${G} + 0,0722 × ${B} = **${fr(Y, 1)} %**.`,
        },
        {
          type: 'nombre', unite: '%', answer: r(bruit, 2), tol: Math.max(0.01, bruit * 0.02),
          q: `Un photosite reçoit en moyenne **${fr(n)} électrons**. Quel est le bruit de photons, en % du signal ?`,
          pieges: [{ v: r(100 / n, 3), why: 'Le bruit vaut √n électrons, pas un électron : on divise √n par n.' }],
          aides: ['Les photons arrivent au hasard : n ± √n.', `√${fr(n)} = ${fr(Math.sqrt(n))} électrons, rapportés à ${fr(n)}.`],
          solution: `√${fr(n)} ÷ ${fr(n)} = **${fr(bruit, 2)} %**${bruit >= 5 ? ' : le grain des zones sombres' : ' : invisible'}.`,
        },
        {
          type: 'nombre', answer: r(N, 1), tol: Math.max(0.1, N * 0.02),
          q: `La caméra donne **f/13 à 2 000 lux**. Un plateau est éclairé à **${fr(lux)} lux** : à quel iris l'exposer, sans filtre ni gain ?`,
          pieges: [{ v: r(13 * lux / 2000, 1), why: 'La lumière varie comme le carré du nombre f : il faut une racine carrée.' }],
          aides: ['Quatre fois moins de lumière, c\'est deux diaphragmes : le nombre f est divisé par deux.', `N = 13 × √(${fr(lux)} ÷ 2 000).`],
          solution: `13 × √(${fr(lux)} ÷ 2 000) = **${fN(r(N, 1))}**${N < 1.8 ? ' : l\'objectif n\'ouvre qu\'à f/1,8, il faudra du gain' : ''}.`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: 'Gb/s', answer: r(deb, 3), tol: 0.005,
            q: `En **${fmt}**, le raster complet compte ${fr(fmt.startsWith('2160') ? 5280 : fmt.startsWith('720') ? 1980 : 2640)} échantillons par ligne et ${fr(fmt.startsWith('2160') ? 2250 : fmt.startsWith('720') ? 750 : 1125)} lignes, à ${fmt === '1080i50' ? 25 : 50} images par seconde, deux mots de 10 bits par échantillon. Quel débit sur le câble ?`,
            aides: ['Échantillons × lignes × images par seconde × 20 bits.', 'Le résultat en bits par seconde, puis divisé par un milliard.'],
            solution: `**${fr(deb, 3)} Gb/s**, en ${LIENS[lien].split(' (')[0]}.`,
          },
          {
            type: 'choix', q: `La production est en **${fmt}**. Quelle liaison SDI faut-il entre la CCU et la grille ?`,
            choices: LIENS.map((t, k) => (k === lien ? t : [t, `Le ${fmt} demande ${fr(deb, 3)} Gb/s.`])), answer: lien,
            aides: ['Calculez le débit du format, raster complet.', '1080i50 et 720p50 : 1,485 Gb/s ; 1080p50 : le double ; 2160p50 : quatre fois plus.'],
            solution: `**${LIENS[lien]}** : ${fr(deb, 3)} Gb/s.`,
          },
        ]),
      ];
    },
  },
  'camera-exposition': {
    titre: 'Le budget de l\'exposition',
    consigne: 'Vous comptez en diaphragmes ce que coûtent ou rapportent le gain, le shutter et l\'iris, et vous mesurez le bougé d\'un ballon pendant la pose.',
    gen: (rnd) => {
      const g = pick(rnd, [3, 6, 9, 12, 18]), dg = diaphGain(g);
      const [ts, tn] = pick(rnd, [[1 / 100, '1/100'], [1 / 250, '1/250'], [1 / 500, '1/500'], [1 / 1000, '1/1000'], [1 / 2000, '1/2000']]), ds = diaphShutter(ts);
      const v = pick(rnd, [3, 5, 8, 12, 20, 30]), [tb, tbn] = pick(rnd, [[1 / 50, '1/50 (OFF)'], [1 / 100, '1/100'], [1 / 250, '1/250'], [1 / 500, '1/500'], [1 / 1000, '1/1000']]), cm = v * tb * 100;
      const k = entre(rnd, 1, 2), ST = [2.8, 4, 5.6, 8], i0 = entre(rnd, 0, 1);
      const sansScint = pick(rnd, [['1/50 (OFF)', 'deux battements entiers'], ['1/100', 'un battement entier']]), avec = tirer(rnd, ['1/60', '1/125', '1/250', '1/500'], 2);
      return [
        {
          type: 'nombre', answer: r(dg, 1), tol: 0.1,
          q: `On monte le gain de **+${g} dB**. Combien de diaphragmes cela représente-t-il ?`,
          pieges: [{ v: r(g / 3, 1), why: '3 dB, c\'est un doublement de puissance ; pour une amplitude de signal, un doublement vaut 6 dB.' }],
          aides: ['+6 dB doublent le signal : un diaphragme.', `${g} ÷ 6,02.`],
          solution: `${g} ÷ 6,02 ≈ **${fr(dg, 1)} diaphragme${dg >= 2 ? 's' : ''}**, avec ${fr(10 ** (g / 20), 1)} fois plus de bruit.`,
        },
        {
          type: 'nombre', answer: r(ds, 1), tol: 0.1,
          q: `On passe le shutter de OFF (1/50 s) à **${tn} s**. Combien de diaphragmes de lumière perd-on ?`,
          pieges: [{ v: r(1 / ts / 50, 1), why: 'C\'est le rapport des temps de pose ; en diaphragmes, on prend son logarithme en base 2.' }],
          aides: ['Chaque fois que le temps de pose est divisé par deux, on perd un diaphragme.', `log₂(${fr(1 / ts)} ÷ 50).`],
          solution: `log₂(${fr(1 / ts)} ÷ 50) = **${fr(ds, 1)} diaphragme${ds >= 2 ? 's' : ''}** : le shutter se choisit pour le mouvement, pas pour exposer.`,
        },
        {
          type: 'nombre', unite: 'cm', answer: r(cm, 1), tol: Math.max(0.1, cm * 0.02),
          q: `Un ballon file à **${v} m/s**. De combien avance-t-il pendant une pose de **${tbn} s** ?`,
          pieges: [{ v: r(v * tb, 3), why: 'C\'est en mètres : la question demande des centimètres.' }],
          aides: ['Distance = vitesse × temps.', `${v} m/s × ${fr(tb, 4)} s, en centimètres.`],
          solution: `${v} × ${fr(tb, 4)} = **${fr(cm, 1)} cm**${tb >= 1 / 60 ? ' : une traînée, qui rend le mouvement fluide' : ' : un ballon net, mais qui saute d\'une image à l\'autre'}.`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: 'dB', answer: r(6.02 * 2 * Math.log2(ST[i0 + k] / ST[i0]), 0), tol: 0.6,
            q: `Pour gagner de la profondeur de champ, on ferme l'iris de **${fN(ST[i0])}** à **${fN(ST[i0 + k])}**. Quel gain faudrait-il pour garder la même exposition ?`,
            pieges: [{ v: 3 * k, why: 'Un diaphragme vaut 6 dB de gain, pas 3.' }],
            aides: [`De ${fN(ST[i0])} à ${fN(ST[i0 + k])}, ${k} cran${k > 1 ? 's' : ''}.`, 'Chaque diaphragme se rattrape par 6 dB.'],
            solution: `${k} diaphragme${k > 1 ? 's' : ''} × 6 dB = **${6 * k} dB**, avec ${k > 1 ? 'quatre' : 'deux'} fois plus de bruit.`,
          },
          {
            type: 'choix', q: 'Sous des lampes qui battent à 100 Hz (secteur à 50 Hz), lequel de ces temps de pose ne fait pas scintiller l\'image ?',
            choices: [sansScint[0], ...avec.map((t) => [t, `${t} s ne contient pas un nombre entier de battements de 10 ms : l'image scintille et des bandes défilent.`])], answer: 0,
            aides: ['Un battement de la lampe dure 10 ms.', 'Il faut un nombre entier de battements pendant la pose.'],
            solution: `**${sansScint[0]}** : ${sansScint[1]} par pose, chaque image reçoit la même lumière.`,
          },
          {
            type: 'ordre', q: 'Remettez dans l\'ordre les réglages de l\'exposition.',
            items: ['L\'iris, choisi pour l\'image voulue (fond flou ou tout net)', 'Le filtre ND, pour retirer la lumière en trop', 'L\'iris, pour finir au tiers de diaphragme', 'Le gain, seulement iris grand ouvert et filtre sur CLEAR'],
            aides: ['Le gain coûte du bruit : il vient en dernier.', 'Le ND ne coûte rien sur l\'image : il vient tôt.'],
            solution: 'Iris pour l\'image, ND, iris pour finir, gain en dernier ; le shutter se choisit à part, pour le mouvement.',
          },
        ]),
      ];
    },
  },
  // ================= Le traitement de l'image =================
  'camera-numerique': {
    titre: 'Codes, balances et noirs',
    consigne: 'En 10 bits (BT.709), le noir est au code 64 et le blanc au code 940 ; 700 mV pour 100 % à la forme d\'onde. Vous convertissez, puis vous réglez une caméra.',
    gen: (rnd) => {
      const p = pick(rnd, [0, 2, 18, 41, 50, 60, 70, 75, 90, 100, 103, 109]);
      const c = pick(rnd, [64, 100, 200, 356, 502, 600, 721, 852, 940, 984, 1019]);
      const mvp = pick(rnd, [7, 14, 21, 35, 42, 49, 56, 63, 70, 80, 90]);
      return [
        {
          type: 'nombre', brut: true, answer: code10(p),
          q: `À quel code 10 bits correspond un niveau de luminance de **${p} %** ?`,
          pieges: [{ v: Math.round(1023 * p / 100), why: 'L\'image ne commence pas au code 0 : le noir est à 64, le blanc à 940.' }, { v: Math.round(16 + 219 * p / 100), why: 'C\'est le code 8 bits (16 à 235).' }].filter((x) => x.v !== code10(p)),
          aides: ['876 pas entre le noir (64) et le blanc (940).', `Code = 64 + 876 × ${fr(p / 100, 2)}.`],
          solution: `64 + 876 × ${fr(p / 100, 2)} = **${code10(p)}**${p > 100 ? ' : un super-blanc' : ''}.`,
        },
        {
          type: 'nombre', unite: '%', answer: r(pctDe(c), 1), tol: 0.15,
          q: `La tuile de mesure lit le code **${c}** sur un pixel. Quel niveau de luminance, en % ?`,
          pieges: [{ v: r(c / 1023 * 100, 1), why: 'Le 0 % est au code 64, pas au code 0.' }],
          aides: ['On retire d\'abord le code du noir.', `(${c} − 64) ÷ 876 × 100.`],
          solution: `(${c} − 64) ÷ 876 × 100 = **${fr(pctDe(c), 1)} %**.`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: 'mV', answer: mvp * 7,
            q: `Un appareil gradue en millivolts. À combien de mV correspond **${mvp} %** ?`,
            aides: ['100 % = 700 mV : 7 mV pour 1 %.', `Multipliez ${mvp} par 7.`],
            solution: `${mvp} × 7 = **${mvp * 7} mV**.`,
          },
          {
            type: 'ordre', q: 'Remettez dans l\'ordre la préparation de l\'image d\'une caméra.',
            items: ['La balance des noirs (ABB), iris fermé', 'La balance des blancs (AWB), sur un carton sous la lumière de la scène', 'Le noir posé au master black, entre 0 et 2 %', 'Le raccord avec la caméra de référence'],
            aides: ['Le zéro avant le blanc.', 'On raccorde une caméra déjà réglée.'],
            solution: 'Balance des noirs, balance des blancs, le noir posé, puis le raccord.',
          },
          choix('À la forme d\'onde, le noir d\'une caméra est posé à 5 %. Quel effet à l\'image ?',
            'Un voile gris : l\'image est délavée, le contraste baisse',
            [['Les ombres sont bouchées', 'Un noir bouché vient d\'un noir trop bas, pas trop haut.'], ['Aucun, 5 % est le repère', 'Le repère est entre 0 et 2 %.']],
            ['Le noir doit être entre 0 et 2 %.', 'Un noir trop haut éclaircit toutes les ombres.'],
            '**Délavé** : on baisse le master black jusqu\'à 0 à 2 %.'),
          choix('On vient de passer une caméra de 0 à +6 dB. Ses ombres tirent au vert. Que fait-on ?',
            'Une balance des noirs (ABB)',
            [['Une balance des blancs', 'Elle règle les gains sur le blanc, pas les noirs qui ont bougé avec le gain.'], ['Rien, le vert vient du gazon', 'Une teinte dans les ombres sur toute l\'image, c\'est un noir de voie décalé.']],
            ['Les noirs de chaque voie bougent avec le gain.', 'On les recale iris fermé.'],
            'La **balance des noirs**, iris fermé : les trois noirs reviennent à zéro.'),
        ]),
      ];
    },
  },
  'camera-courbes': {
    titre: 'La courbe de la caméra',
    consigne: 'La BT.709 : V = 1,099 × L^0,45 − 0,099 (et 4,5 L sous 1,8 %) ; l\'écran déplie avec un gamma 2,4 ; le knee plie la courbe au-dessus de son point.',
    gen: (rnd) => {
      const L = pick(rnd, [0.05, 0.1, 0.18, 0.3, 0.5, 0.7]), V = oetf709(L) * 100;
      const p = pick(rnd, [85, 90, 95]), s = pick(rnd, [0.1, 0.2, 0.25, 0.5]), V0 = pick(rnd, [120, 150, 190, 250, 300]), out = p + (V0 - p) * s;
      const Vs = pick(rnd, [41, 50, 60, 70, 80]), Le = (Vs / 100) ** 2.4 * 100;
      return [
        {
          type: 'nombre', unite: '%', answer: r(V, 1), tol: 0.5,
          q: `Une zone reçoit **${fr(L * 100, 0)} %** de la lumière du blanc. À combien sort-elle à la forme d'onde, avec la courbe BT.709 ?`,
          pieges: [{ v: r(L * 100, 1), why: 'C\'est le signal sans gamma (linéaire) : la courbe relève les tons sombres et moyens.' }],
          aides: ['Au-dessus de 1,8 % de lumière : V = 1,099 × L^0,45 − 0,099.', `1,099 × ${fr(L, 2)}^0,45 − 0,099.`],
          solution: `1,099 × ${fr(L, 2)}^0,45 − 0,099 = **${fr(V, 1)} %**${L === 0.18 ? ' : le gris moyen sort vers 41 %' : ''}.`,
        },
        {
          type: 'nombre', unite: '%', answer: r(out, 1), tol: 0.3,
          q: `Knee point à **${p} %**, pente **${fr(s, 2)}**. Une fenêtre aurait donné **${V0} %** de signal sans knee. À combien sort-elle (avant le white clip) ?`,
          pieges: [{ v: V0, why: 'Le knee comprime tout ce qui dépasse son point.' }, { v: r(V0 * s, 1), why: 'La pente ne s\'applique qu\'à la partie au-dessus du point.' }].filter((x) => Math.abs(x.v - out) > 0.3),
          aides: ['Sous le point, rien ne change ; au-dessus, l\'excédent est multiplié par la pente.', `${p} + (${V0} − ${p}) × ${fr(s, 2)}.`],
          solution: `${p} + ${V0 - p} × ${fr(s, 2)} = **${fr(out, 1)} %**${out > 103 ? ' : encore au-dessus de 103 %, le white clip coupera' : ''}.`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: '%', answer: r(Le, 1), tol: 0.5,
            q: `Sur un écran de référence (gamma 2,4, BT.1886), un signal à **${Vs} %** s'affiche à quelle part de la luminosité du blanc ?`,
            pieges: [{ v: r((Vs / 100) ** 2.2 * 100, 1), why: 'La BT.1886 fixe un gamma de 2,4, pas 2,2.' }, { v: Vs, why: 'L\'écran n\'est pas linéaire : il assombrit les tons moyens.' }],
            aides: ['L\'écran élève le signal à la puissance 2,4.', `${fr(Vs / 100, 2)}^2,4.`],
            solution: `${fr(Vs / 100, 2)}^2,4 = **${fr(Le, 1)} %** de la luminosité du blanc.`,
          },
          choix('La fenêtre derrière le présentateur est un aplat blanc, sans un nuage. Quel réglage ?',
            'Le knee : il comprime les hautes lumières au-dessus de son point',
            [['Le black gamma', 'Il ne touche que les ombres.'], ['Le master black', 'Il pose le noir, il ne change presque rien au blanc.']],
            ['Ce qui dépasse le blanc est coupé.', 'Un coude dans la courbe garde de la place au-dessus.'],
            'Le **knee** : au-dessus de son point, le signal monte moins vite ; la fenêtre garde ses nuages.'),
          choix('Les visages des gros plans paraissent trop piqués : pores et rides ressortent. Quel réglage ?',
            'Le skin detail, qui réduit le détail sur la teinte de la peau',
            [['Baisser tout le détail', 'Le décor et les cheveux perdraient leur piqué aussi.'], ['Monter le seuil CRISP', 'Il évite de souligner le bruit, pas la peau.']],
            ['On veut adoucir les visages seulement.', 'La caméra sait repérer la teinte de la peau.'],
            'Le **skin detail** : le visage s\'adoucit, le reste reste piqué.'),
          choix('On veut voir dans la tribune à l\'ombre sans toucher au noir ni au blanc. Quel réglage ?',
            'Le black gamma, pour ouvrir les ombres',
            [['Le master black', 'Il déplace le noir lui-même et délave l\'image.'], ['Le white clip', 'Il fixe le plafond du signal, rien dans les ombres.']],
            ['Un réglage qui ne change que le bas de la courbe.', 'Il ouvre ou referme les ombres.'],
            'Le **black gamma** : il relève les ombres, le bruit des ombres avec.'),
        ]),
      ];
    },
  },
  'camera-peinture': {
    titre: 'Couleurs, matrice et raccord',
    consigne: 'Au vectorscope, la teinte est un angle depuis l\'axe Cb ; la matrice ajoute à une voie une part de sa différence avec une autre ; la saturation éloigne les couleurs du centre.',
    gen: (rnd) => {
      const b = pick(rnd, BARRES.slice(1)), ang = vecteur(0.75 * b[1], 0.75 * b[2], 0.75 * b[3]).angle;
      const R = pick(rnd, [60, 70, 80, 90]), G = pick(rnd, [5, 10, 20, 30]), a = pick(rnd, [0.05, 0.1, 0.15, 0.2]), R2 = R + a * (R - G);
      const gris = pick(rnd, [20, 40, 50, 60, 80]), a2 = pick(rnd, [0.1, 0.2, -0.1]);
      return [
        {
          type: 'nombre', unite: '°', answer: r(ang, 0), tol: 2,
          q: `Où tombe la barre **${b[0]} 75 %** au vectorscope (angle depuis l'axe Cb, BT.709) ?`,
          aides: ['Calculez Y, puis Cb = (B − Y) ÷ 1,8556 et Cr = (R − Y) ÷ 1,5748.', 'L\'angle vaut arctan(Cr ÷ Cb), dans le bon quadrant.'],
          solution: `La barre ${b[0]} est vers **${fr(ang, 0)}°** (rouge 103°, jaune 175°, vert 230°, cyan 283°, bleu 355°, magenta 50°).`,
        },
        {
          type: 'nombre', unite: '%', answer: r(R2, 1), tol: 0.2,
          q: `Un maillot donne **R ${R} %** et **V ${G} %**. On règle **R-G = ${fr(a, 2)}** dans la matrice. Que devient la voie rouge ?`,
          pieges: [{ v: r(R * (1 + a), 1), why: 'La matrice ajoute une part de la différence R − V, pas une part de R.' }],
          aides: ['R\' = R + coefficient × (R − V).', `${R} + ${fr(a, 2)} × (${R} − ${G}).`],
          solution: `${R} + ${fr(a, 2)} × ${R - G} = **${fr(R2, 1)} %** : le rouge se renforce là où il dépasse le vert.`,
        },
        {
          type: 'nombre', unite: '%', answer: gris,
          q: `Un gris donne **R = V = B = ${gris} %**. Avec **R-G = ${fr(a2, 2)}** dans la matrice, que devient la voie rouge ?`,
          pieges: [{ v: r(gris * (1 + a2), 1), why: 'Sur un gris, R − V vaut zéro : la matrice n\'ajoute rien.' }],
          aides: ['R\' = R + coefficient × (R − V).', 'Sur un gris, R − V = 0.'],
          solution: `R − V = 0 : la voie reste à **${gris} %**. La matrice ne touche pas aux gris : la balance reste juste.`,
        },
        pick(rnd, [
          {
            type: 'ordre', q: 'Remettez dans l\'ordre le raccord de deux caméras.',
            items: ['Choisir la caméra de référence, et ne plus la toucher', 'Filmer la même mire avec les deux, sous la même lumière', 'Régler la matrice de l\'autre jusqu\'aux mêmes points du vectorscope', 'Régler la saturation', 'Vérifier un visage, en écran partagé'],
            aides: ['On commence par ce qui ne bougera plus.', 'La teinte avant la saturation ; un visage pour finir.'],
            solution: 'Référence ; même mire, même lumière ; matrice ; saturation ; un visage.',
          },
          choix('Le soleil passe derrière la tribune : la vision veut retrouver d\'un geste la peinture préparée pour l\'ombre. Que fait-elle ?',
            'Elle rappelle le fichier de scène préparé pour l\'ombre',
            [['Elle charge le fichier de référence', 'La référence est la base validée par la maintenance, pas la peinture d\'une situation.'], ['FILE CLEAR', 'Il revient aux valeurs d\'usine et efface ce qui était juste.']],
            ['Il y a cinq mémoires de peinture par caméra.', 'STORE pour enregistrer, le numéro seul pour rappeler.'],
            'Le **fichier de scène** de l\'ombre : toute la peinture revient d\'un coup.'),
        ]),
      ];
    },
  },
  // ================= Le corps, le viseur et le cadreur =================
  'camera-corps': {
    titre: 'Alimenter et commander la caméra',
    consigne: 'La tête consomme environ 19 W (corps) et 13 W (viseur 7") ; DC IN accepte 10,5 à 17 V et 5,4 A ; le câble hybride alimente la FB80 jusqu\'à 600 m.',
    gen: (rnd) => {
      const E = pick(rnd, [95, 130, 150, 190]), acc = pick(rnd, [0, 0.5, 1]), vf = pick(rnd, [true, false]);
      const P = 19 + (vf ? 13 : 0) + acc * 12, h = autonomie(E, P);
      const L = pick(rnd, [300, 450, 800, 1500, 4000]), ALIM = ['Par la CCU, dans le cuivre du câble hybride', 'En fibre monomode, avec une alimentation sur place par DC IN', 'Impossible, même en fibre monomode'];
      const al = L <= 600 ? 0 : 1;
      const [cmd, qui] = pick(rnd, [['le gain', 0], ['le filtre ND', 0], ['le shutter', 0], ['la balance des blancs', 0], ['les touches ASSIGN de son viseur', 1], ['le zoom et le point', 1]]);
      const [prise, role, faux1, faux2] = pick(rnd, [['XLR 5 broches', 'l\'intercom du cadreur (casque-micro)', 'l\'alimentation DC IN', 'un micro'], ['XLR 4 broches', 'l\'alimentation DC IN (12 V)', 'l\'intercom', 'la vidéo SDI'], ['XLR 3 broches', 'un micro ou une ligne audio', 'l\'intercom', 'l\'alimentation'], ['BNC', 'la vidéo (SDI, référence, prompteur)', 'l\'audio', 'l\'alimentation']]);
      return [
        {
          type: 'nombre', unite: 'h', answer: r(h, 1), tol: 0.1,
          q: `Caméra seule sur batterie de **${E} Wh**, ${vf ? 'viseur 7" branché' : 'sans viseur'}${acc ? `, une lampe de ${fr(acc, 1)} A sur DC OUT (12 V)` : ''}. Quelle autonomie, en heures ?`,
          pieges: [{ v: r(E / 19, 1), why: 'Vous n\'avez compté que le corps : le viseur et les accessoires consomment aussi.' }].filter((x) => Math.abs(x.v - r(h, 1)) > 0.1),
          aides: [`Additionnez les puissances : 19 W${vf ? ' + 13 W' : ''}${acc ? ` + ${fr(acc, 1)} A × 12 V` : ''}.`, `Autonomie = ${E} Wh ÷ ${fr(P)} W.`],
          solution: `${E} ÷ ${fr(P)} ≈ **${fr(h, 1)} h**, un peu moins en vrai à cause des pertes.`,
        },
        {
          type: 'nombre', unite: 'A', answer: r(P / 12, 2), tol: 0.03,
          q: `Avec ces ${fr(P)} W, quel courant la batterie fournit-elle sur DC IN, à 12 V ?`,
          aides: ['Puissance = tension × courant.', `I = ${fr(P)} ÷ 12.`],
          solution: `${fr(P)} ÷ 12 = **${fr(P / 12, 2)} A**, sous les 5,4 A que la prise accepte.`,
        },
        {
          type: 'choix', q: `La caméra est à **${fr(L)} m** du car. Comment l'alimenter ?`,
          choices: ALIM.map((t, k) => (k === al ? t : [t, k === 0 ? 'Au-delà de 600 m, la chute de tension dans le cuivre empêche la CCU d\'alimenter la FB80.' : k === 1 ? 'En dessous de 600 m, la CCU alimente la tête par le câble hybride : rien d\'autre à brancher.' : 'La fibre monomode va jusqu\'à 10 km : c\'est possible, avec une alimentation sur place.'])), answer: al,
          aides: ['Le cuivre du câble hybride limite la distance.', 'FB80 : 600 m en hybride ; fibre monomode : 10 km, mais sans énergie.'],
          solution: `**${ALIM[al]}**.`,
        },
        pick(rnd, [
          {
            type: 'choix', q: `La caméra est reliée à sa CCU. Qui règle **${cmd}** ?`,
            choices: qui === 0 ? ['La vision, au RCP', ['Le cadreur, sur le corps de la caméra', 'Reliée à la CCU, la caméra obéit au RCP pour le shutter, les balances, le gain et le filtre.'], ['Le réalisateur, au mélangeur', 'Le réalisateur choisit les images, il ne les règle pas.']]
              : ['Le cadreur, sur sa caméra', ['La vision, au RCP', 'La vision règle l\'image ; le cadreur garde son viseur, ses touches ASSIGN, le cadre, le zoom et le point.'], ['Le réalisateur, au mélangeur', 'Le réalisateur donne des ordres, il ne règle pas la caméra.']], answer: 0,
            aides: ['Reliée à la CCU, l\'image se règle à distance.', 'Le cadreur garde ce qui fait son métier.'],
            solution: qui === 0 ? '**La vision, au RCP** : les commutateurs du corps ne font plus rien.' : '**Le cadreur** : c\'est son métier, la vision ne s\'en occupe pas.',
          },
          choix(`À l'arrière de la caméra, à quoi sert la prise **${prise}** ?`, role,
            [[faux1, `Ce n'est pas ce que porte une prise ${prise}.`], [faux2, `Ce n'est pas ce que porte une prise ${prise}.`]],
            ['BNC : vidéo ; XLR 3 : audio ; XLR 4 : alimentation ; XLR 5 : intercom.', 'Le nombre de broches dit beaucoup.'],
            `La prise ${prise} : **${role}**.`),
        ]),
      ];
    },
  },
  'camera-viseur': {
    titre: 'Le viseur, le tally et l\'équilibre',
    consigne: 'Vous réglez la zone de sécurité du viseur (image de 1 920 × 1 080), vous lisez le tally de quatre caméras et vous calculez le couple d\'une caméra mal équilibrée.',
    gen: (rnd) => {
      const pct = pick(rnd, [80, 90, 92.5, 95]), axe = pick(rnd, [['largeur', 1920], ['hauteur', 1080]]), m = margeSecurite(pct, /** @type {number} */ (axe[1]));
      const kg = pick(rnd, [5, 6.8, 7, 12, 25, 49]), cmv = pick(rnd, [1, 2, 3, 5, 6]), C = couple(kg, cmv / 100);
      const [pgm, pvw] = tirer(rnd, [1, 2, 3, 4], 2), cam = pick(rnd, [pgm, pvw, [1, 2, 3, 4].find((x) => x !== pgm && x !== pvw)]);
      const etat = cam === pgm ? 0 : cam === pvw ? 1 : 2, ETATS = ['Rouge : à l\'antenne, on ne bouge plus le cadre', 'Vert : au preview, on prépare le cadre', 'Éteint : on peut chercher son plan'];
      return [
        {
          type: 'nombre', unite: 'pixels', answer: r(m, 1), tol: 0.5,
          q: `Le marqueur de zone de sécurité est réglé à **${fr(pct, 1)} %**. Quelle marge laisse-t-il de chaque côté, sur la ${axe[0]} de l'image (${axe[1]} pixels) ?`,
          pieges: [{ v: r(/** @type {number} */ (axe[1]) * (1 - pct / 100), 1), why: 'C\'est la marge totale : elle se partage entre les deux côtés.' }],
          aides: [`La zone garde ${fr(pct, 1)} % de l'image ; le reste se partage en deux.`, `${axe[1]} × (1 − ${fr(pct / 100, 3)}) ÷ 2.`],
          solution: `${axe[1]} × ${fr(1 - pct / 100, 3)} ÷ 2 = **${fr(m, 1)} pixels** de chaque côté.`,
        },
        {
          type: 'nombre', unite: 'N·m', answer: r(C, 2), tol: Math.max(0.02, C * 0.02),
          q: `Une caméra de **${fr(kg, 1)} kg** a son centre de gravité **${cmv} cm** en avant de l'axe d'inclinaison. Quel couple la fait piquer du nez ?`,
          pieges: [{ v: r(kg * cmv / 100, 2), why: 'Il manque l\'accélération de la pesanteur : le poids vaut masse × 9,81.' }],
          aides: ['Couple = masse × g × distance.', `${fr(kg, 1)} × 9,81 × ${fr(cmv / 100, 2)}.`],
          solution: `${fr(kg, 1)} × 9,81 × ${fr(cmv / 100, 2)} ≈ **${fr(C, 2)} N·m** : on fait glisser la plaque de ${cmv} cm vers l'arrière.`,
        },
        {
          type: 'choix', q: `Au mélangeur, la **CAM ${pgm}** est au programme et la **CAM ${pvw}** au preview (ce car utilise le tally vert). Que montre la lampe de tally de la **CAM ${cam}** ?`,
          choices: ETATS.map((t, k) => (k === etat ? t : [t, k === 0 ? `Seule la CAM ${pgm} est au programme.` : k === 1 ? `Seule la CAM ${pvw} est au preview.` : 'Cette caméra est utilisée par le mélangeur.'])), answer: etat,
          aides: ['Rouge : programme ; vert : preview.', `Comparez CAM ${cam} à CAM ${pgm} et CAM ${pvw}.`],
          solution: `**${ETATS[etat]}**.`,
        },
        pick(rnd, [
          choix('Le cadreur voit son image floue et veut prévenir la vision sans couper la réalisation. Que fait-il ?',
            'Il appuie sur CALL, puis parle sur la ligne ENG de l\'intercom',
            [['Il parle sur PROD', 'PROD est la ligne de la réalisation : les ordres de cadre, pas les pannes.'], ['Il règle BRIGHT et CONTRAST de son viseur', 'Ils ne changent que l\'écran du viseur, pas l\'image envoyée.']],
            ['Il y a un appel silencieux et deux lignes d\'intercom.', 'ENG : la technique ; PROD : la réalisation.'],
            '**CALL** allume le tally rouge du RCP de la vision ; on parle sur **ENG**.'),
          choix('Le zébra 1 du viseur est réglé à 70 %. Que hachure-t-il ?',
            'Les zones autour de 70 %, le niveau d\'un visage clair bien exposé',
            [['Tout ce qui dépasse 100 %', 'C\'est le rôle du zébra 2.'], ['Les zones nettes, pour le point', 'Le point, c\'est le peaking.']],
            ['Deux zébras, deux niveaux.', 'Un visage clair se pose vers 60 à 70 %.'],
            'Le **zébra 1** hachure ce qui est autour de 70 % (largeur 10 %) : on y pose un visage.'),
        ]),
      ];
    },
  },
  // ================= La voie caméra =================
  'camera-voie': {
    titre: 'La référence, la sortie et le line-up',
    consigne: 'La référence arrive en boucle à la CCU (tri-level ± 300 mV) ; la CCU sort en Y\'CbCr 10 bits (Y\' 64 à 940, Cb et Cr autour de 512). Vous vérifiez et vous ordonnez le line-up.',
    gen: (rnd) => {
      const n = pick(rnd, [0, 2, 3]), amp = 300 * amplitudeBoucle(n);
      const R = pick(rnd, [0, 25, 50, 75, 100]), G = pick(rnd, [0, 25, 50, 75, 100]), B = pick(rnd, [0, 25, 50, 75, 100]);
      const c = ycbcr(R / 100, G / 100, B / 100);
      const ips = pick(rnd, [25, 50]), deb = 2640 * 1125 * ips * 20 / 1e9;
      return [
        {
          type: 'nombre', unite: 'mV', answer: r(amp, 0), tol: 1,
          q: n === 0 ? 'Au bout de la boucle de référence, la dernière CCU n\'a **aucun bouchon** de 75 Ω. Quelle amplitude reçoit-elle pour le tri-level de ± 300 mV ? (en mV, une alternance)' : `Au bout de la boucle, on trouve **${n} bouchons** de 75 Ω en parallèle. Quelle amplitude reçoit la dernière CCU pour le tri-level de ± 300 mV ? (en mV, une alternance)`,
          pieges: [{ v: 300, why: 'C\'est l\'amplitude d\'une ligne bien terminée, par un seul bouchon.' }],
          aides: [n === 0 ? 'Sans bouchon, l\'onde se réfléchit au bout du câble et s\'ajoute à elle-même.' : `${n} bouchons de 75 Ω en parallèle font 75 ÷ ${n} Ω.`, n === 0 ? 'Elle double.' : `Pont diviseur : 300 × 2 × R ÷ (75 + R), avec R = ${fr(75 / n, 1)} Ω.`],
          solution: `**± ${fr(amp, 0)} mV** au lieu de ± 300 : le verrouillage n'est plus garanti. Un seul bouchon, sur la dernière sortie de boucle.`,
        },
        pick(rnd, [
          {
            type: 'nombre', brut: true, answer: code10(c.y * 100), tol: 1,
            q: `La caméra filme une couleur **R' ${R} %, V' ${G} %, B' ${B} %**. Quel code 10 bits porte la luminance Y' ?`,
            aides: ['Y\' = 0,2126 R\' + 0,7152 V\' + 0,0722 B\', puis code = 64 + 876 × Y\'.', `Y' = ${fr(c.y * 100, 1)} %.`],
            solution: `Y' = ${fr(c.y * 100, 1)} % : code **${code10(c.y * 100)}**.`,
          },
          {
            type: 'nombre', brut: true, answer: codeC(c.cr), tol: 1,
            q: `La caméra filme une couleur **R' ${R} %, V' ${G} %, B' ${B} %**. Quel code 10 bits porte la différence de couleur Cr ? (512 au centre, 896 pas pour 1)`,
            aides: ['Cr = (R\' − Y\') ÷ 1,5748.', `Cr = ${fr(c.cr, 3)} ; code = 512 + 896 × Cr.`],
            solution: `Cr = ${fr(c.cr, 3)} : code **${codeC(c.cr)}**${Math.abs(c.cr) < 0.001 ? ' : pas de couleur rouge-cyan' : ''}.`,
          },
        ]),
        {
          type: 'nombre', unite: 'Gb/s', answer: r(deb, 3), tol: 0.005,
          q: `La CCU sort du **1080${ips === 25 ? 'i50 (25 images par seconde)' : 'p50 (50 images par seconde)'}** : 2 640 échantillons par ligne, 1 125 lignes, deux mots de 10 bits par échantillon. Quel débit ?`,
          pieges: [{ v: r(1920 * 1080 * ips * 20 / 1e9, 3), why: 'Le SDI transporte aussi la suppression : 2 640 × 1 125, pas seulement l\'image active.' }],
          aides: ['Échantillons × lignes × images × 20 bits.', `2 640 × 1 125 × ${ips} × 20.`],
          solution: `**${fr(deb, 3)} Gb/s** : ${ips === 25 ? 'le HD-SDI' : 'le 3G-SDI'}.`,
        },
        {
          type: 'ordre', q: 'Remettez dans l\'ordre le line-up d\'une caméra.',
          items: ['Partir du fichier de référence', 'Les barres, pour valider la liaison', 'Les noirs : balance des noirs, puis master black', 'Les blancs : balance sur la même charte, la même lumière', 'L\'exposition : le même gris au même niveau', 'Les couleurs, au vectorscope'],
          aides: ['La chaîne d\'abord, sans l\'objectif ni la lumière.', 'Le zéro, puis le blanc, puis le niveau, puis la couleur.'],
          solution: 'Référence, barres, noirs, blancs, exposition, couleurs.',
        },
      ];
    },
  },
  // ================= Jusqu'au moniteur =================
  'camera-mesure': {
    titre: 'Lire la forme d\'onde et le vectorscope',
    consigne: 'À la forme d\'onde, 0 % est le noir et 100 % le blanc (700 mV) ; la diffusion n\'accepte pas plus de 103 %. Les barres 75 % font un escalier connu.',
    gen: (rnd) => {
      const mvv = pick(rnd, [49, 140, 287, 385, 455, 490, 630, 700, 721]);
      const b = pick(rnd, BARRES), Yb = lumaBarre(b);
      const cas = pick(rnd, [
        ['un trait plat et épais exactement sur la ligne des 100 %', 'Un blanc écrêté : ses détails sont perdus', 'Un noir bouché', 'Du bruit dans les ombres'],
        ['une trace tassée contre la ligne des 0 %', 'Des noirs bouchés', 'Un blanc écrêté', 'Une balance ratée'],
        ['une trace épaisse et floue dans les sombres', 'Du bruit, souvent du gain', 'Un blanc écrêté', 'Un noir bouché'],
      ]);
      return [
        {
          type: 'nombre', unite: '%', answer: r(mvv / 7, 1), tol: 0.2,
          q: `La forme d'onde, graduée en millivolts, lit **${mvv} mV** sur un visage. Quel niveau en % ?`,
          pieges: [{ v: r(mvv / 10, 1), why: '100 % valent 700 mV, pas 1 000.' }],
          aides: ['100 % = 700 mV : 7 mV pour 1 %.', `Divisez ${mvv} mV par 7.`],
          solution: `${mvv} ÷ 7 = **${fr(mvv / 7, 1)} %**${mvv / 7 > 103 ? ' : au-dessus de 103 %, la diffusion le refusera' : ''}.`,
        },
        {
          type: 'nombre', unite: '%', answer: r(Yb, 0), tol: 1,
          q: `Sur les barres 75 %, à quelle hauteur la forme d'onde montre-t-elle la barre **${b[0]}** ?`,
          aides: ['Y = 0,2126 R + 0,7152 V + 0,0722 B, chaque composante présente valant 75 %.', `La barre ${b[0]} : R ${b[1] ? 75 : 0}, V ${b[2] ? 75 : 0}, B ${b[3] ? 75 : 0}.`],
          solution: `**${fr(Yb, 0)} %** : l'escalier des barres fait 75 · 70 · 59 · 54 · 21 · 16 · 5 %.`,
        },
        choix(`À la forme d'onde, la CAM 2 montre ${cas[0]}. Qu'en concluez-vous ?`, cas[1],
          [[cas[2], 'Ce défaut-là a une autre trace.'], [cas[3], 'Ce défaut-là a une autre trace.']],
          ['Un plateau plat en haut, une trace tassée en bas, une trace épaisse : trois défauts.', 'Le bruit épaissit, l\'écrêtage aplatit.'],
          `**${cas[1]}**.`),
        pick(rnd, [
          choix('Au vectorscope, le gris de la charte de la CAM 3 est une petite tache décalée vers le rouge. Que règle la vision ?',
            'La balance des blancs : l\'image est trop chaude',
            [['La saturation', 'Un gris n\'a pas de saturation à régler : il doit être au centre.'], ['La matrice', 'La matrice ne touche pas aux gris.']],
            ['Un gris bien balancé est au centre exact.', 'Décalé vers le rouge, c\'est une dominante.'],
            'La **balance des blancs** : le gris revient au centre.'),
          choix('Les barres 75 % de la CCU tombent toutes un peu à l\'intérieur des cases du vectorscope, du côté du centre. Que se passe-t-il ?',
            'Le graticule est réglé sur les cibles 100 % : il faut les cibles 75 %',
            [['La CCU sature trop peu : il faut monter sa saturation', 'Les barres d\'une CCU sont fabriquées : elles sont justes. C\'est le graticule qui ne correspond pas.'], ['La liaison SDI est défectueuse', 'Une liaison défectueuse donne des erreurs, pas un décalage régulier de toutes les taches.']],
            ['Il existe des barres à 75 % et à 100 %.', 'Chaque mire a ses cibles.'],
            'Ce n\'est pas une panne : ce sont les **mauvaises cibles**. La mire du car est à 75 %.'),
        ]),
      ];
    },
  },
  'camera-moniteur': {
    titre: 'Régler le moniteur de référence',
    consigne: 'Le moniteur de référence suit la BT.1886 (gamma 2,4), son blanc à 100 cd/m² ; on le règle à la PLUGE, à la sonde et en bleu seul.',
    gen: (rnd) => {
      const Vs = pick(rnd, [41, 50, 60, 75, 90]), Lw = pick(rnd, [100, 120, 80]), cd = Lw * (Vs / 100) ** 2.4;
      const k = pick(rnd, [0.9, 1.1, 1.2]), bleu = (0.054 + k * (0.75 - 0.054)) * 100;
      const [reg, mire, f1, f2] = pick(rnd, [
        ['le point et le tirage optique', 'L\'étoile de Siemens', 'Les barres de couleur', 'La charte grise'],
        ['la liaison et les niveaux jusqu\'au car', 'Les barres de couleur', 'L\'étoile de Siemens', 'Le carton blanc'],
        ['le gamma et le raccord des caméras', 'La charte grise', 'L\'étoile de Siemens', 'Les barres de couleur'],
        ['la balance des blancs', 'Le carton blanc ou la charte grise', 'L\'étoile de Siemens', 'Les barres de couleur'],
      ]);
      return [
        choix('À la PLUGE, quelle lecture dit que la luminosité du moniteur est juste ?',
          'La barre −2 % se confond avec le noir, la +2 % reste juste visible',
          [['Les trois barres sont visibles', 'Voir la −2 %, c\'est voir plus noir que le noir : la luminosité est trop haute.'], ['Aucune barre n\'est visible', 'La +2 % doit rester visible, sinon les ombres sont bouchées à l\'écran.']],
          ['La −2 % est plus noire que le noir du signal.', 'On monte jusqu\'à la voir, puis on redescend jusqu\'à ce qu\'elle disparaisse.'],
          'La **−2 % disparaît, la +2 % reste juste visible** : le noir de l\'écran est le noir du signal.'),
        {
          type: 'nombre', unite: 'cd/m²', answer: r(cd, 1), tol: Math.max(0.2, cd * 0.02),
          q: `Écran de référence réglé à **${Lw} cd/m²** pour le blanc (gamma 2,4). Quelle luminance affiche-t-il pour un signal à **${Vs} %** ?`,
          pieges: [{ v: r(Lw * Vs / 100, 1), why: 'L\'écran n\'est pas linéaire : il élève le signal à la puissance 2,4.' }],
          aides: ['L = blanc × V^2,4.', `${Lw} × ${fr(Vs / 100, 2)}^2,4.`],
          solution: `${Lw} × ${fr(Vs / 100, 2)}^2,4 = **${fr(cd, 1)} cd/m²**.`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: '%', answer: r(bleu, 1), tol: 0.5,
            q: `En bleu seul, la barre grise 75 % montre 75 % de bleu. La chroma du moniteur est à **× ${fr(k, 1)}**. Combien montre la barre bleue ? (Y de la barre bleue : 5,4 %)`,
            pieges: [{ v: 75, why: 'Ce serait juste avec une chroma à × 1 : la chroma multiplie l\'écart entre le bleu et la luminance.' }],
            aides: ['Bleu affiché = Y + chroma × (B − Y).', `5,4 + ${fr(k, 1)} × (75 − 5,4).`],
            solution: `5,4 + ${fr(k, 1)} × 69,6 = **${fr(bleu, 1)} %** : ${k > 1 ? 'plus clair' : 'plus sombre'} que la barre grise, la chroma est ${k > 1 ? 'trop forte' : 'trop faible'}.`,
          },
          {
            type: 'ordre', q: 'Remettez dans l\'ordre le réglage d\'un moniteur de référence.',
            items: ['La luminosité, à la PLUGE', 'Le contraste, à la sonde, 100 cd/m² sur le blanc', 'La chroma, en bleu seul sur les barres', 'Ne plus y toucher : on règle les caméras en le regardant'],
            aides: ['Le noir d\'abord, le blanc ensuite, la couleur à la fin.', 'Le moniteur ne se règle jamais sur les caméras.'],
            solution: 'PLUGE, sonde, bleu seul ; puis on n\'y touche plus.',
          },
        ]),
        choix(`Pour vérifier ${reg}, quelle mire ?`, mire, [[f1, 'Cette mire teste autre chose.'], [f2, 'Cette mire teste autre chose.']],
          ['Les barres testent la chaîne ; les mires optiques testent l\'image.', 'Étoile : le point ; charte grise : gamma et raccord ; carton : balance.'],
          `**${mire}**.`),
      ];
    },
  },
  // ================= Pour aller plus loin =================
  'camera-plusloin': {
    titre: 'Grand capteur, HDR et super ralenti',
    consigne: 'Un Super 35 est environ 2,6 fois plus large qu\'un 2/3" (ordre de grandeur) ; une caméra HFR filme n fois 50 images par seconde ; la HDC-5500 donne f/11 à 2 000 lux en 1080p50.',
    gen: (rnd) => {
      const f = pick(rnd, [10, 20, 25, 40, 58, 100]), f35 = f * CROP_S35;
      const n = pick(rnd, [2, 3, 4, 6, 8]), d = Math.log2(n);
      const N = 11 / Math.sqrt(n);
      return [
        {
          type: 'nombre', unite: 'mm', answer: r(f35, 0), tol: Math.max(1, f35 * 0.01),
          q: `En 2/3", un cadre demande **${f} mm**. Quelle focale donne le même cadre sur un capteur Super 35 (≈ 2,6 fois plus large) ?`,
          pieges: [{ v: r(f / CROP_S35, 0), why: 'Un capteur plus grand demande une focale plus longue pour le même cadre, pas plus courte.' }],
          aides: ['La focale suit la taille du capteur.', `Multipliez ${f} mm par 2,6.`],
          solution: `${f} × 2,6 = **${fr(f35, 0)} mm**, avec 2,6 fois moins de profondeur de champ à la même ouverture.`,
        },
        {
          type: 'nombre', answer: r(d, 1), tol: 0.1,
          q: `Une caméra super ralenti filme en **${n}×** (${50 * n} images par seconde). Combien de diaphragmes de lumière perd-elle ?`,
          pieges: [{ v: n, why: 'C\'est le facteur de lumière ; en diaphragmes, on prend son logarithme en base 2.' }],
          aides: [`Une image ne dure pas plus de 1/${50 * n} s au lieu de 1/50.`, `Diaphragmes = log₂(${n}).`],
          solution: `log₂(${n}) = **${fr(d, 1)} diaphragme${d >= 2 ? 's' : ''}**.`,
        },
        pick(rnd, [
          {
            type: 'nombre', unite: '%', answer: r(100 / n, 1), tol: 0.2,
            q: `Jusqu'à quelle vitesse de relecture (en %) le ralenti de cette caméra ${n}× reste-t-il fluide, chaque image montrée une seule fois ?`,
            pieges: [{ v: 100 * n, why: 'Le ralenti est plus lent que le direct : la vitesse est sous 100 %.' }],
            aides: ['Vitesse × cadence (en multiples de 50) ≥ 1.', `Vitesse la plus lente = 100 % ÷ ${n}.`],
            solution: `100 ÷ ${n} = **${fr(100 / n, 1)} %**.`,
          },
          {
            type: 'nombre', answer: r(N, 1), tol: Math.max(0.1, N * 0.02),
            q: `La HDC-5500 donne f/11 à 2 000 lux en 1080p50. En **${n}×**, à 2 000 lux, quel iris expose juste ?`,
            pieges: [{ v: r(11 / n, 1), why: 'La lumière varie comme le carré du nombre f : on divise par √n, pas par n.' }],
            aides: [`${n} fois moins de lumière par image.`, `Le nombre f est divisé par √${n} : 11 ÷ √${n}.`],
            solution: `11 ÷ √${n} ≈ **${fN(r(N, 1))}** : il faut ouvrir, ou monter le gain.`,
          },
        ]),
        pick(rnd, [
          choix('En HLG (BT.2100), où pose-t-on le blanc de référence en direct (BT.2408) ?',
            'À 75 % du signal',
            [['À 100 %', 'C\'est la place du blanc en SDR ; en HLG, on garde de la place au-dessus pour les hautes lumières.'], ['À 50 %', 'Le gris 18 % est à 38 % ; le blanc de référence est plus haut, à 75 %.']],
            ['Le HDR garde de la place au-dessus du blanc.', 'Le gris 18 % tombe à 38 %.'],
            'À **75 %** : de 75 à 100 %, il reste près de deux diaphragmes pour les hautes lumières.'),
          choix('Au ralenti d\'une caméra 3×, une image sur trois saute. Que vérifier ?',
            'Les trois phases : chacune doit être enregistrée sur son entrée du serveur',
            [['Le shutter de la caméra', 'Le shutter change la netteté et la lumière, il ne fait pas sauter des images.'], ['Le timecode', 'Le timecode date les images, il ne les recombine pas.']],
            ['La caméra sort 150 images par seconde sur plusieurs liaisons.', 'A : 1, 4, 7… ; B : 2, 5, 8… ; C : 3, 6, 9…'],
            'Une **phase oubliée** : le serveur recombine trois liaisons, il en manque une.'),
        ]),
      ];
    },
  },
});
