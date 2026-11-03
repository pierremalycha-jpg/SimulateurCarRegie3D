// @ts-check
import { registerDefis } from '../defis.js';
import { entre, pick, fr } from '../../cours/exo.js';
import { CAPTEURS, hyperfocale, limites, tache, net, champ, angleH, recadrage, distTxt } from '../calc/optique.js';

// ----------------------------------------------------------------------------------
// Les défis de l'atelier « Optique et profondeur de champ » : isoler un sujet (zone nette mince),
// tout garder net (zone nette profonde, hyperfocale), cadrer à la bonne focale (champ, angle,
// facteur de recadrage). Le modèle juge (labo/calc/optique.js) ; les sujets A, B, C sont posés par
// la scène de l'essai.
// ----------------------------------------------------------------------------------
const mm = (v) => fr(v, Number.isInteger(v) ? 0 : 1) + ' mm';
const m1 = (v) => fr(v, v < 10 ? 2 : 1);
/** l'état de l'atelier : sujets { A, B, C } en mètres */
const dist = (st, k) => st.sujets[k];

registerDefis({
  'opt-isoler': {
    consigne: 'Un portrait en extérieur : le sujet B doit se détacher, net, entre deux plans flous.',
    gen(rnd) {
      const capteur = pick(rnd, ['s35', 'ff']); const K = CAPTEURS[capteur];
      const A = entre(rnd, 15, 30) / 10, B = A + entre(rnd, 15, 25) / 10, C = B + entre(rnd, 30, 60) / 10;
      const f = pick(rnd, [24, 35, 50]), N = pick(rnd, [2.8, 4, 5.6, 8]);
      const H = hyperfocale(f, N, K.c);
      const pool = [
        { type: 'choix', q: 'Le fond est encore trop net derrière le sujet. Sans bouger la caméra ni changer de focale, que fait-on ?', choices: ['On ouvre l\'iris (nombre f plus petit)', ['On ferme l\'iris', 'Fermer agrandit la zone nette : le fond devient plus net.'], ['On fait le point plus loin que le sujet', 'Le sujet sort de la zone nette avant le fond.']], answer: 0, aides: ['Lequel des réglages change la largeur du cône de lumière qui arrive au capteur ?', 'Un cône plus large fait des taches de flou plus grandes.'], solution: '**Ouvrir l\'iris** : le cône de rayons s\'élargit, les taches de flou grandissent, la zone nette s\'amincit.' },
        { type: 'choix', q: 'Même cadre sur le sujet, même iris : sur quel capteur la zone nette est-elle la plus mince ?', choices: ['Le plein format', ['Le 2/3"', 'C\'est l\'inverse : à cadre égal, la focale est 3,75 fois plus courte en 2/3", la zone nette bien plus profonde.'], ['C\'est la même sur tous', 'À cadre égal, la focale change avec le capteur, et la profondeur de champ suit le carré de la focale.']], answer: 0, aides: ['À cadre égal, un grand capteur demande une focale plus longue.', 'La profondeur de champ diminue très vite quand la focale s\'allonge.'], solution: 'Le **plein format** : pour le même cadre, il faut une focale bien plus longue, et c\'est elle qui l\'emporte.' },
      ];
      return {
        scene: { capteur, sujets: { A, B, C }, f: 35, N: 8, s: C },
        items: [
          {
            type: 'reglage', q: `Capteur ${K.nom}. Faites le point sur **B** (à ${m1(B)} m) et réglez focale et iris pour que **B soit net**, et **A et C flous** : leur tache au moins trois fois le cercle de confusion (${fr(3 * K.c, 3)} mm).`,
            fixe: { capteur },
            check: (st) => {
              const tA = tache(st.f, st.N, st.s, dist(st, 'A')), tC = tache(st.f, st.N, st.s, dist(st, 'C'));
              const okB = net(st.f, st.N, K.c, st.s, dist(st, 'B'));
              const why = !okB ? 'B n\'est pas net : le point doit être sur B, ou la zone nette l\'atteindre.' : tA < 3 * K.c ? 'A est encore trop net : allongez la focale ou ouvrez l\'iris.' : tC < 3 * K.c ? 'C est encore trop net : allongez la focale ou ouvrez l\'iris.' : '';
              return { ok: okB && tA >= 3 * K.c && tC >= 3 * K.c, mesure: `taches : A ${fr(tA, 3)} mm, B ${fr(tache(st.f, st.N, st.s, dist(st, 'B')), 3)} mm, C ${fr(tC, 3)} mm`, why };
            },
            corrige: { f: 135, N: 2, s: B },
            aides: ['Le point d\'abord : sur B, exactement.', 'Une focale longue et un iris ouvert font une zone nette mince : essayez 85 mm ou plus, à f/2.'],
            solution: `Point à ${m1(B)} m, focale longue (100 mm et plus) et iris ouvert (f/2) : la zone nette ne fait que quelques centimètres autour de B.`,
          },
          {
            type: 'nombre', q: `Sur ce capteur (cercle de confusion ${fr(K.c, 3)} mm), quelle est l'hyperfocale d'un ${f} mm à f/${fr(N, 1)} ?`, answer: Math.round(H * 100) / 100, tol: Math.max(0.05, H * 0.02), unite: 'm',
            aides: ['H = f² ÷ (N × c) + f, toutes les longueurs en millimètres.', `H = ${f}² ÷ (${fr(N, 1)} × ${fr(K.c, 3)}) + ${f} mm, puis en mètres.`],
            solution: `H = ${f}² ÷ (${fr(N, 1)} × ${fr(K.c, 3)}) + ${f} = ${fr(H * 1000, 0)} mm, soit **${fr(H, 2)} m**. Point fait là, tout est net de ${fr(H / 2, 2)} m environ jusqu'à l'infini.`,
          },
          pick(rnd, pool),
        ],
      };
    },
  },
  'opt-tout-net': {
    consigne: 'Un plan de décor : le premier plan et le fond doivent rester nets ensemble, à focale imposée.',
    gen(rnd) {
      // une focale et des sujets pour lesquels f/11 suffit : on retire jusqu'à ce que ce soit vrai
      for (let k = 0; ; k++) {
        const capteur = pick(rnd, ['2/3', 's35', 'ff']); const K = CAPTEURS[capteur];
        const f = capteur === '2/3' ? pick(rnd, [8, 10, 12]) : capteur === 's35' ? pick(rnd, [18, 21, 25]) : pick(rnd, [24, 28, 35]);
        const A = entre(rnd, 12, 30) / 10, C = entre(rnd, 8, 20);
        const B = Math.round((A + C) / 2 * 10) / 10;
        const H = hyperfocale(f, 11, K.c), s = Math.min(H, 2 * A * C / (A + C)); const [n0, f0] = limites(f, 11, K.c, s);
        if (!(n0 <= A && f0 >= C) && k < 40) continue;
        const N2 = pick(rnd, [4, 5.6, 8]), s2 = entre(rnd, 2, 6); const [pn, pf] = limites(f, N2, K.c, s2);
        const H8 = hyperfocale(f, 8, K.c);
        return {
          scene: { capteur, sujets: { A, B, C }, f, N: 2, s: 0.5 },
          items: [
            {
              type: 'reglage', q: `Capteur ${K.nom}, focale imposée : ${f} mm. Réglez l'iris et le point pour que **A** (${m1(A)} m), **B** et **C** (${m1(C)} m) soient **nets ensemble**.`,
              fixe: { capteur, f },
              check: (st) => {
                const ok = ['A', 'B', 'C'].every((x) => net(st.f, st.N, K.c, st.s, dist(st, x)));
                const [a, b] = limites(st.f, st.N, K.c, st.s);
                return { ok, mesure: `zone nette de ${distTxt(a)} à ${distTxt(b)}`, why: ok ? '' : a > dist(st, 'A') ? 'A est devant la zone nette : fermez l\'iris ou rapprochez le point.' : 'C est derrière la zone nette : fermez l\'iris ou reculez le point.' };
              },
              corrige: { N: 11, s: Math.round(s * 100) / 100 },
              aides: ['Fermer l\'iris agrandit la zone nette ; le point la déplace.', 'Le point se fait entre les deux, plus près de A que de C (la zone nette s\'étend plus loin derrière le point que devant).'],
              solution: `À f/11, point vers ${m1(s)} m : la zone nette va de ${distTxt(n0)} à ${distTxt(f0)}.`,
            },
            {
              type: 'nombre', q: `${f} mm à f/${fr(N2, 1)}, point à ${s2} m : où commence la zone nette (limite proche) ?`, answer: Math.round(pn * 100) / 100, tol: Math.max(0.02, pn * 0.02), unite: 'm',
              aides: ['Calculez d\'abord l\'hyperfocale H (en mm).', 'Limite proche = s(H − f) ÷ (H + s − 2f), toutes les longueurs en mm.'],
              solution: `H = ${fr(hyperfocale(f, N2, K.c), 2)} m ; limite proche = ${fr(pn, 2)} m (et lointaine ${distTxt(pf)}).`,
            },
            {
              type: 'reglage', q: `Toujours ${f} mm, à **f/8** : faites le point à l'**hyperfocale** (à 5 % près).`,
              fixe: { capteur, f, N: 8 },
              check: (st) => ({ ok: Math.abs(st.s - H8) / H8 <= 0.05, mesure: `point à ${distTxt(st.s)}, hyperfocale ${distTxt(H8)}`, why: st.s < H8 ? 'Le point est trop près.' : 'Le point est trop loin.' }),
              corrige: { N: 8, s: Math.round(H8 * 100) / 100 },
              aides: ['L\'atelier affiche l\'hyperfocale du réglage en cours.', 'H = f² ÷ (8 × c) + f.'],
              solution: `H = ${fr(H8, 2)} m : point fait là, tout est net de ${fr(H8 / 2, 2)} m jusqu'à l'infini.`,
            },
          ],
        };
      }
    },
  },
  'opt-cadrer': {
    consigne: 'Un plan taille sur le sujet B : trouver la focale qui fait le cadre demandé.',
    gen(rnd) {
      const capteur = pick(rnd, ['2/3', 's35', 'ff']); const K = CAPTEURS[capteur];
      const B = entre(rnd, 30, 120) / 10, W = entre(rnd, 12, 40) / 10;
      const fW = B * K.w / W;
      const K2 = CAPTEURS[pick(rnd, ['2/3', 's35'])], f2 = pick(rnd, [8, 12, 25, 50]), fFF = pick(rnd, [35, 50, 85]);
      return {
        scene: { capteur, sujets: { A: Math.max(1, B - 1.5), B, C: B + 6 }, f: Math.min(200, Math.max(8, Math.round(fW < 40 ? fW * 2.5 : fW / 2.5))), N: 4, s: B },
        items: [
          {
            type: 'reglage', q: `Capteur ${K.nom}, sujet **B** à ${m1(B)} m. Réglez la focale pour que le champ fasse **${fr(W, 1)} m de large** à sa distance (à 5 % près).`,
            fixe: { capteur },
            check: (st) => { const w = champ(K, st.f, dist(st, 'B')).w; return { ok: Math.abs(w - W) / W <= 0.05, mesure: `champ à B : ${fr(w, 2)} m (focale ${mm(Math.round(st.f * 10) / 10)})`, why: w > W ? 'Le champ est trop large : allongez la focale.' : 'Le champ est trop serré : raccourcissez la focale.' }; },
            corrige: { f: Math.round(fW * 2) / 2 },
            aides: ['Le champ couvert à la distance d vaut d × (largeur du capteur) ÷ f.', `Donc f = d × ${fr(K.w, 2)} mm ÷ ${fr(W, 1)} m.`],
            solution: `f = ${m1(B)} × ${fr(K.w, 2)} ÷ ${fr(W, 1)} ≈ **${fr(fW, 1)} mm**.`,
          },
          {
            type: 'nombre', q: `Capteur ${K2.nom} (${fr(K2.w, 2)} mm de large), focale ${f2} mm : quel est l'angle de champ horizontal ?`, answer: Math.round(angleH(K2, f2) * 10) / 10, tol: 0.5, unite: '°',
            aides: ['angle = 2 × arctan(largeur ÷ (2 × focale)).', `2 × arctan(${fr(K2.w, 2)} ÷ ${2 * f2}), en degrés.`],
            solution: `2 × arctan(${fr(K2.w, 2)} ÷ ${2 * f2}) = **${fr(angleH(K2, f2), 1)}°**.`,
          },
          {
            type: 'nombre', q: `Le réalisateur veut le cadre d'un ${fFF} mm en plein format. Quelle focale donne le même cadre en Super 35 (facteur de recadrage ${fr(recadrage(CAPTEURS.s35), 2)}) ?`, answer: Math.round(fFF / recadrage(CAPTEURS.s35) * 10) / 10, tol: Math.max(0.5, fFF / recadrage(CAPTEURS.s35) * 0.02), unite: 'mm',
            aides: ['Un capteur plus petit voit plus serré à focale égale.', 'On divise la focale du plein format par le facteur de recadrage.'],
            solution: `${fFF} ÷ ${fr(recadrage(CAPTEURS.s35), 2)} ≈ **${fr(fFF / recadrage(CAPTEURS.s35), 1)} mm**.`,
          },
        ],
      };
    },
  },
});
