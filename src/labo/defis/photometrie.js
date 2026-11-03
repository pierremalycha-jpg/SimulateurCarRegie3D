// @ts-check
import { registerDefis } from '../defis.js';
import { entre, pick, fr } from '../../cours/exo.js';
import { SOURCES, eclairage, intensiteAxe, ouverture, eclairementPour, mired, contraste } from '../calc/photometrie.js';

// ----------------------------------------------------------------------------------
// Les défis de l'atelier « Photométrie » : le bon niveau au sujet (distance, faisceau, inverse du
// carré, cosinus), exposer d'après le luxmètre (N² ÷ t = E × S ÷ 250), corriger la couleur (mireds,
// gélatines, gradateur qui rougit l'halogène), le rapport de contraste (principale et débouchage).
// L'état de l'atelier : p1 (principale) et p2 (débouchage) { source, angle, niveau, Tled, gel, d,
// phi, alpha, on }, cam { iso, t, N, Tcam } ; ses mesures : e1, e2, E, T, ratio, expo, dom.
// ----------------------------------------------------------------------------------
const lx = (v) => fr(Math.round(v), 0) + ' lx';

registerDefis({
  'pho-niveau': {
    consigne: 'Un plateau d\'interview : le directeur photo demande un niveau précis sur le visage.',
    gen(rnd) {
      const X = entre(rnd, 8, 40) * 50;
      const E1 = entre(rnd, 4, 20) * 100, d1 = entre(rnd, 2, 4), d2 = d1 * pick(rnd, [2, 1.5, 3]);
      const I = entre(rnd, 8, 40) * 1000, d = entre(rnd, 3, 8), i = pick(rnd, [30, 45, 60]);
      const Ei = I * Math.cos(i * Math.PI / 180) / (d * d);
      // une solution : au serré (12°), à la distance qui donne X
      const dSol = Math.sqrt(intensiteAxe(SOURCES.fresnel, 12) / X);
      return {
        scene: { p1: { source: 'fresnel', angle: 40, niveau: 1, gel: 'aucune', d: 6, phi: 0, alpha: 0, on: true }, p2: { on: false } },
        items: [
          {
            type: 'reglage', q: `Fresnel 1 kW, de face (devant la caméra), gradateur à 90 % au moins : obtenez **${lx(X)}** au sujet (à 5 % près), en jouant sur la distance et le faisceau.`,
            fixe: { 'p1.source': 'fresnel', 'p1.phi': 0, 'p1.alpha': 0, 'p1.gel': 'aucune', 'p2.on': false },
            check: (st, m) => {
              const ok = Math.abs(m.E - X) / X <= 0.05 && st.p1.niveau >= 0.9;
              return { ok, mesure: `luxmètre : ${lx(m.E)}, gradateur ${Math.round(st.p1.niveau * 100)} %`, why: st.p1.niveau < 0.9 ? 'Le gradateur est sous 90 % : un halogène gradué rougit. Réglez plutôt la distance et le faisceau.' : m.E > X ? 'Trop de lumière : reculez ou ouvrez le faisceau.' : 'Pas assez : approchez ou serrez le faisceau.' };
            },
            corrige: { 'p1.angle': 12, 'p1.niveau': 1, 'p1.d': Math.round(dSol * 100) / 100 },
            aides: ['L\'éclairement baisse comme le carré de la distance : deux fois plus loin, quatre fois moins.', 'Serrer le faisceau concentre la lumière : l\'intensité dans l\'axe monte.'],
            solution: `Au serré (12°, environ ${fr(intensiteAxe(SOURCES.fresnel, 12), 0)} cd), à ${fr(dSol, 2)} m : E = I ÷ d² ≈ ${lx(X)}.`,
          },
          {
            type: 'nombre', q: `Un projecteur donne ${lx(E1)} à ${d1} m. Sans rien changer d'autre, combien donne-t-il à ${fr(d2, 1)} m ?`, answer: Math.round(E1 * (d1 / d2) ** 2), tol: Math.max(1, E1 * (d1 / d2) ** 2 * 0.01), unite: 'lx',
            pieges: [{ v: Math.round(E1 * d1 / d2), why: 'L\'éclairement ne baisse pas comme la distance, mais comme son carré.' }],
            aides: ['Loi de l\'inverse du carré.', `E₂ = E₁ × (d₁ ÷ d₂)² = ${fr(E1, 0)} × (${d1} ÷ ${fr(d2, 1)})².`],
            solution: `${fr(E1, 0)} × (${d1} ÷ ${fr(d2, 1)})² = **${lx(E1 * (d1 / d2) ** 2)}**.`,
          },
          {
            type: 'nombre', q: `Un projecteur de ${fr(I, 0)} cd dans l'axe, à ${d} m, éclaire une cellule inclinée de ${i}° par rapport à sa lumière. Quel éclairement lit-elle ?`, answer: Math.round(Ei), tol: Math.max(1, Ei * 0.01), unite: 'lx',
            pieges: [{ v: Math.round(I / (d * d)), why: 'C\'est l\'éclairement de face : incliné, la cellule reçoit moins (cosinus de l\'angle).' }],
            aides: ['E = I × cos i ÷ d².', `E = ${fr(I, 0)} × cos ${i}° ÷ ${d}².`],
            solution: `${fr(I, 0)} × cos ${i}° ÷ ${d * d} = **${lx(Ei)}**.`,
          },
        ],
      };
    },
  },
  'pho-exposer': {
    consigne: 'La caméra est réglée d\'avance : c\'est à la lumière de s\'adapter, mesurée au luxmètre.',
    gen(rnd) {
      const S = pick(rnd, [400, 800, 1600]), t = 1 / 50;
      const E = entre(rnd, 4, 30) * 50, N = ouverture(E, S, t);
      const Nc = pick(rnd, [2.8, 4, 5.6]), Sc = pick(rnd, [400, 800]); const Eref = eclairementPour(Nc, Sc, t);
      return {
        scene: { p1: { source: 'led', angle: 50, niveau: 1, Tled: 5600, gel: 'aucune', d: 1.2, phi: 0, alpha: 0, on: true }, p2: { on: false }, cam: { iso: Sc, t, N: Nc, Tcam: 5600 } },
        items: [
          {
            type: 'nombre', q: `Le luxmètre lit ${lx(E)} au sujet. Caméra à ${S} ISO, 1/50 s : à quel diaphragme exposer juste ? (cellule plate, C = 250)`, answer: Math.round(N * 10) / 10, tol: Math.max(0.1, N * 0.03), unite: '(nombre f)',
            aides: ['N² ÷ t = E × S ÷ C.', `N = √(E × t × S ÷ 250) = √(${fr(E, 0)} × 0,02 × ${S} ÷ 250).`],
            solution: `N = √(${fr(E, 0)} × 0,02 × ${S} ÷ 250) = **f/${fr(N, 1)}**.`,
          },
          {
            type: 'reglage', q: `La caméra est à **f/${fr(Nc, 1)}, ${Sc} ISO, 1/50 s**. Réglez le panneau LED (niveau, distance) pour exposer juste : à **⅓ de diaph** près.`,
            fixe: { 'cam.N': Nc, 'cam.iso': Sc, 'cam.t': t, 'p1.source': 'led', 'p2.on': false },
            check: (st, m) => ({ ok: Math.abs(m.expo) <= 1 / 3, mesure: `luxmètre : ${lx(m.E)} ; il faut ${lx(Eref)} (écart ${fr(m.expo, 2)} diaph)`, why: m.expo > 0 ? 'Trop de lumière : l\'image est surexposée.' : 'Pas assez de lumière : l\'image est sous-exposée.' }),
            corrige: { 'p1.niveau': 1, 'p1.angle': 50, 'p1.phi': 0, 'p1.alpha': 0, 'p1.gel': 'aucune', 'p1.d': Math.round(Math.sqrt(SOURCES.led.I[0] / Eref) * 100) / 100 },
            aides: [`Calculez d'abord l'éclairement qu'il faut : E = N² × 250 ÷ (t × S).`, `Il faut ${lx(Eref)} : réglez le niveau, puis la distance si le panneau ne suffit pas.`],
            solution: `E = ${fr(Nc, 1)}² × 250 ÷ (0,02 × ${Sc}) = ${lx(Eref)} ; le panneau à pleine puissance à ${fr(Math.sqrt(SOURCES.led.I[0] / Eref), 2)} m les donne.`,
          },
          {
            type: 'choix', q: 'Pourquoi baisse-t-on rarement un projecteur halogène au gradateur pour régler l\'exposition d\'une caméra ?', choices: ['Il rougit : sa température de couleur baisse avec la tension', ['Il s\'éteint sous 50 %', 'Il descend jusqu\'au noir, mais sa lumière change de couleur en chemin.'], ['Le gradateur fait scintiller l\'image', 'Un gradateur bien réglé ne scintille pas ; le problème est la couleur.']], answer: 0,
            aides: ['Que devient le filament quand il chauffe moins ?', 'À mi-tension, un halogène 3 200 K tombe vers 2 400 K.'],
            solution: 'Un filament moins chaud émet une lumière plus **orangée** : à mi-tension, un halogène de 3 200 K descend vers 2 400 K. On règle plutôt la distance, le faisceau, des diffuseurs ou des filtres neutres.',
          },
        ],
      };
    },
  },
  'pho-couleur': {
    consigne: 'Une caméra balancée en lumière du jour et un projecteur halogène : il faut accorder la lumière à la caméra.',
    gen(rnd) {
      const pairs = [[3200, 5600], [5600, 3200], [3200, 4300], [6500, 3200], [2800, 3200]];
      const [Ta, Tb] = pick(rnd, pairs); const sh = Math.round(mired(Tb) - mired(Ta));
      const pool = [
        { type: 'choix', q: 'Dans le même plan, une fenêtre (lumière du jour, 5 600 K) et une lampe halogène (3 200 K), caméra balancée à 5 600 K. Que voit-on ?', choices: ['La zone éclairée par la lampe tire vers l\'orange', ['La zone de la fenêtre tire vers l\'orange', 'La caméra est balancée pour la lumière du jour : c\'est elle qui reste blanche.'], ['Rien : la caméra fait la moyenne', 'La balance des blancs n\'a qu\'un réglage pour toute l\'image : les deux lumières ne peuvent pas être blanches ensemble.']], answer: 0, aides: ['Quelle lumière a la même couleur que le réglage de la caméra ?', 'Une lumière plus chaude (moins de kelvins) que la balance paraît orangée.'], solution: 'La caméra est balancée à 5 600 K : la fenêtre est blanche, la zone de la **lampe halogène tire vers l\'orange**. On corrige la lampe (CTB) ou la fenêtre (CTO), pas les deux.' },
        { type: 'choix', q: 'Pourquoi compte-t-on les corrections de couleur en mireds plutôt qu\'en kelvins ?', choices: ['Une même gélatine décale toujours du même nombre de mireds, quelle que soit la source', ['Parce que c\'est plus précis', 'La précision n\'est pas en cause : c\'est l\'additivité.'], ['Parce que les mireds sont des unités du Système international', 'Le mired (10⁶ ÷ K) n\'est pas une unité SI ; on l\'emploie parce que les décalages s\'additionnent.']], answer: 0, aides: ['Une CTB fait passer 3 200 K à 5 700 K ; fait-elle passer 4 000 K à 6 500 K ?', 'En mireds, le décalage d\'une gélatine est constant.'], solution: 'En kelvins, l\'effet d\'une gélatine dépend de la source ; en **mireds** (10⁶ ÷ K), il est **constant** : on additionne simplement les décalages.' },
      ];
      return {
        scene: { p1: { source: 'fresnel', angle: 30, niveau: 0.6, gel: 'aucune', d: 4, phi: 30, alpha: 0, on: true }, p2: { on: false }, cam: { Tcam: 5600, iso: 800, t: 1 / 50, N: 4 } },
        items: [
          {
            type: 'reglage', q: 'Caméra balancée à **5 600 K**, Fresnel halogène. Sans toucher la balance, amenez la lumière à moins de **20 mireds** de la caméra, avec au moins **150 lx** au sujet.',
            fixe: { 'cam.Tcam': 5600, 'p1.source': 'fresnel', 'p2.on': false },
            check: (st, m) => ({ ok: Math.abs(m.dom) <= 20 && m.E >= 150, mesure: `lumière à ${fr(Math.round(m.T / 10) * 10, 0)} K, écart ${fr(m.dom, 0)} mireds ; ${lx(m.E)}`, why: m.E < 150 ? 'Pas assez de lumière au sujet.' : m.dom > 0 ? 'La lumière est encore trop chaude (orangée) pour la caméra.' : 'La lumière est devenue trop froide (bleutée).' }),
            corrige: { 'p1.gel': 'ctb', 'p1.niveau': 1, 'p1.d': 3, 'p1.angle': 30, 'p1.alpha': 0 },
            aides: ['Une gélatine bleue (CTB) refroidit la lumière ; regardez aussi le gradateur.', 'Un halogène gradué rougit : CTB plein et gradateur à fond.'],
            solution: 'CTB plein (−137 mireds) et gradateur à **100 %** : 3 200 K devient environ 5 700 K, à 3 mireds de la caméra. Le CTB mange près de deux tiers de la lumière : on se rapproche.',
          },
          {
            type: 'nombre', q: `De combien de mireds faut-il décaler une lumière de ${fr(Ta, 0)} K pour l'amener à ${fr(Tb, 0)} K ? (signe compris : négatif vers le bleu)`, answer: sh, tol: 2, unite: 'mireds',
            aides: ['Un mired vaut 10⁶ ÷ T (en kelvins).', `10⁶ ÷ ${fr(Tb, 0)} − 10⁶ ÷ ${fr(Ta, 0)}.`],
            solution: `${fr(mired(Tb), 1)} − ${fr(mired(Ta), 1)} = **${sh > 0 ? '+' : ''}${sh} mireds** (${sh < 0 ? 'vers le bleu : une CTB' : 'vers l\'orange : une CTO'}).`,
          },
          pick(rnd, pool),
        ],
      };
    },
  },
  'pho-contraste': {
    consigne: 'Un portrait à deux lumières : la principale de trois quarts, le débouchage de l\'autre côté.',
    gen(rnd) {
      const R = pick(rnd, [2, 3, 4, 8]); const Emin = entre(rnd, 4, 10) * 50;
      const r2 = pick(rnd, [2, 4, 8, 16]); const Ep = entre(rnd, 4, 16) * 100, Ed = entre(rnd, 1, 4) * 50;
      const c2 = contraste(Ep, Ed);
      return {
        scene: { p1: { source: 'fresnel', angle: 25, niveau: 1, gel: 'aucune', d: 4, phi: -40, alpha: 0, on: true }, p2: { source: 'led', angle: 50, niveau: 1, Tled: 3200, gel: 'aucune', d: 1.2, phi: 30, alpha: 0, on: true } },
        items: [
          {
            type: 'reglage', q: `Obtenez un rapport de contraste de **${R}:1** (à 10 % près) entre la principale et le débouchage, avec au moins **${lx(Emin)}** de principale.`,
            fixe: { 'p1.on': true, 'p2.on': true },
            check: (st, m) => ({ ok: m.e2 > 0 && Math.abs(m.ratio - R) / R <= 0.1 && m.e1 >= Emin, mesure: `principale ${lx(m.e1)}, débouchage ${lx(m.e2)} : ${fr(m.ratio, 2)}:1`, why: m.e1 < Emin ? 'La principale est trop faible.' : m.ratio > R ? 'Trop contrasté : remontez le débouchage.' : 'Pas assez contrasté : baissez le débouchage.' }),
            corrige: (() => {
              // la principale telle qu'elle est posée, le débouchage de face à la distance qui donne Ep ÷ (R − 1)
              const e1 = eclairage({ source: 'fresnel', angle: 25, niveau: 1, d: 4, incidence: 40 }).E; const cible = e1 / (R - 1);
              return { 'p1.source': 'fresnel', 'p1.angle': 25, 'p1.niveau': 1, 'p1.gel': 'aucune', 'p1.d': 4, 'p1.phi': -40, 'p1.alpha': 0, 'p2.source': 'led', 'p2.niveau': 1, 'p2.gel': 'aucune', 'p2.phi': 0, 'p2.alpha': 0, 'p2.d': Math.round(Math.sqrt(SOURCES.led.I[0] / cible) * 100) / 100 };
            })(),
            aides: ['Rapport = (principale + débouchage) ÷ débouchage : le côté éclairé reçoit les deux lumières, le côté ombre le débouchage seul.', `Il faut un débouchage égal à la principale divisée par ${R - 1}.`],
            solution: `Pour ${R}:1, le débouchage vaut la principale ÷ ${R - 1} : on l'éloigne ou on le baisse jusqu'à ce rapport.`,
          },
          {
            type: 'nombre', q: `Un rapport de contraste de ${r2}:1, c'est combien de diaphs d'écart entre le côté éclairé et le côté ombre ?`, answer: Math.log2(r2), tol: 0.05, unite: 'diaphs',
            aides: ['Un diaph = deux fois plus de lumière.', `2 à la puissance combien fait ${r2} ?`],
            solution: `log₂ ${r2} = **${fr(Math.log2(r2), 0)} diaph${r2 > 2 ? 's' : ''}**.`,
          },
          {
            type: 'nombre', q: `Principale ${lx(Ep)}, débouchage ${lx(Ed)} : quel est le rapport de contraste (le nombre avant « :1 ») ?`, answer: Math.round(c2.rapport * 100) / 100, tol: 0.05, unite: ':1',
            pieges: [{ v: Math.round(Ep / Ed * 100) / 100, why: 'Le côté éclairé reçoit aussi le débouchage : (principale + débouchage) ÷ débouchage.' }],
            aides: ['Côté éclairé : principale + débouchage. Côté ombre : débouchage seul.', `(${fr(Ep, 0)} + ${fr(Ed, 0)}) ÷ ${fr(Ed, 0)}.`],
            solution: `(${fr(Ep, 0)} + ${fr(Ed, 0)}) ÷ ${fr(Ed, 0)} = **${fr(c2.rapport, 2)}:1**.`,
          },
        ],
      };
    },
  },
});
