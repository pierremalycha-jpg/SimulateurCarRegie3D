// @ts-check
import { el } from '../util.js';
import { figure, sv, slider, choice, readout, fmtNum } from './kit.js';

// ----------------------------------------------------------------------------------
// Leçon « La liaison point à point : paraboles, zone de Fresnel et dégagement » (chapitre La HF). La
// manipulation trace le profil d'une liaison entre deux mâts (distance, fréquence, hauteurs, un
// obstacle) : la ligne de vue, le premier ellipsoïde de Fresnel, le renflement de la Terre, et
// calcule le dégagement, la perte de diffraction, le gain des paraboles et le niveau reçu.
// Formules : λ = c ÷ f ; rayon du 1er ellipsoïde r1 = 17,32 × √(d1 × d2 ÷ (f × D)) (m, d en km,
// f en GHz) ; renflement d1 × d2 ÷ (12,74 × k), k = 4/3 (atmosphère standard) ; affaiblissement en
// espace libre 92,45 + 20 log d + 20 log f (km, GHz : la même formule que hf.js en m et MHz) ;
// gain d'une parabole 10 log (η (π D ÷ λ)²), rendement η ≈ 0,55 ; ouverture ≈ 70 λ ÷ D degrés ;
// perte de diffraction d'une arête (UIT-R P.526) : 6,9 + 20 log (√((ν − 0,1)² + 1) + ν − 0,1) pour
// ν > −0,78, ν = −√2 × dégagement ÷ r1. Sensibilité du récepteur : celle de la leçon hf-bilan
// (16-QAM 3/4, ordre de grandeur −87 dBm).
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);
const dBs = (v, d = 1) => `${v < 0 ? '−' : ''}${fmtNum(Math.abs(v), d)}`;

// ---------------- le modèle (pur) ----------------
/** longueur d'onde (m) d'une fréquence en GHz */
export const lambda = (fGHz) => 0.299792458 / fGHz;
/** affaiblissement en espace libre (dB), d en km, f en GHz */
export const fsplKm = (dKm, fGHz) => 92.45 + 20 * Math.log10(Math.max(1e-3, dKm)) + 20 * Math.log10(fGHz);
/** rayon (m) du premier ellipsoïde de Fresnel en un point à d1 et d2 km des deux antennes */
export const fresnel1 = (d1Km, d2Km, fGHz) => (d1Km <= 0 || d2Km <= 0 ? 0 : 17.32 * Math.sqrt(d1Km * d2Km / (fGHz * (d1Km + d2Km))));
/** renflement de la Terre (m) en ce point, rayon terrestre effectif k × 6 370 km */
export const renflement = (d1Km, d2Km, k = 4 / 3) => d1Km * d2Km / (12.74 * k);
/** gain (dBi) d'une parabole de diamètre D (m) */
export const gainParabole = (Dm, fGHz, eta = 0.55) => 10 * Math.log10(eta * (Math.PI * Dm / lambda(fGHz)) ** 2);
/** ouverture du faisceau à −3 dB (degrés) */
export const ouverture = (Dm, fGHz) => 70 * lambda(fGHz) / Dm;
/** perte de diffraction (dB) d'une arête selon le dégagement relatif (dégagement ÷ r1 : 1 = tout le rayon libre, < 0 = obstrué) */
export function perteDiffraction(rel) {
  const v = -Math.SQRT2 * rel;
  return v <= -0.78 ? 0 : 6.9 + 20 * Math.log10(Math.sqrt((v - 0.1) ** 2 + 1) + v - 0.1);
}
/** sensibilité du récepteur (dBm) et pertes de câbles et connecteurs aux deux bouts (dB) : ordres de grandeur */
export const SENSIB_RX = -87, PERTES = 2;
/**
 * La liaison : D (km), f (GHz), h1, h2 (m) hauteurs des antennes, ho (m) hauteur de l'obstacle à xo (km),
 * dant (m) diamètre des paraboles, p (dBm) puissance émise.
 */
export function liaison({ D, f, h1, h2, ho, xo, dant, p }) {
  const x = Math.min(Math.max(xo, 0.01), D - 0.01);
  const vue = h1 + (h2 - h1) * x / D, bombe = renflement(x, D - x), r1 = fresnel1(x, D - x, f);
  const deg = vue - (ho + bombe), rel = r1 > 0 ? deg / r1 : 1, diff = perteDiffraction(rel);
  const G = gainParabole(dant, f), espace = fsplKm(D, f);
  const recu = p + 2 * G - espace - diff - PERTES;
  return { vue, bombe, r1, deg, rel, diff, G, espace, recu, marge: recu - SENSIB_RX, rMilieu: fresnel1(D / 2, D / 2, f), bMilieu: renflement(D / 2, D / 2), ouv: ouverture(dant, f), lambda: lambda(f) };
}

// ---------------- la manipulation ----------------
function demoFresnel(host) {
  const L = { D: 5, f: 7, h1: 10, h2: 12, ho: 14, xo: 2, dant: 0.6, p: 20 };
  const prof = el('div', { class: 'co-scroll' });
  const read = readout(['Longueur d\'onde, ouverture du faisceau', 'Rayon de Fresnel à l\'obstacle', 'Dégagement de l\'obstacle', 'Perte de diffraction', 'Bilan', 'Niveau reçu et marge']);
  const verdict = el('p', { class: 'co-verdict' });
  const draw = () => {
    const R = liaison(L);
    const W = 720, H = 250, x0 = 40, x1 = 680, yb = 210, ky = 160 / 40; // 40 m de hauteur dessinés sur 160 px
    const X = (km) => x0 + km / L.D * (x1 - x0), Y = (m) => yb - m * ky;
    const f = figure(W, H, `Profil de la liaison : ${fmtNum(L.D, 1)} km à ${L.f} GHz, antennes à ${L.h1} et ${L.h2} m, obstacle de ${L.ho} m à ${fmtNum(L.xo, 1)} km ; dégagement ${fmtNum(R.rel * 100)} % du premier rayon de Fresnel`);
    // le sol, bombé par la courbure de la Terre (exagérée comme le reste des hauteurs)
    let sol = `M${x0} ${yb}`; for (let i = 0; i <= 40; i++) { const d = L.D * i / 40; sol += ` L${X(d).toFixed(1)} ${Y(renflement(d, L.D - d)).toFixed(1)}`; }
    f.append(sv('path', { d: sol + ` L${x1} ${yb + 30} L${x0} ${yb + 30} Z`, fill: '#2a3a22', stroke: '#4a6a3a' }));
    // l'ellipsoïde de Fresnel autour de la ligne de vue (et ses 60 %)
    const up = [], dn = [], up6 = [], dn6 = [];
    for (let i = 0; i <= 60; i++) { const d = L.D * i / 60, v = L.h1 + (L.h2 - L.h1) * d / L.D, r = fresnel1(d, L.D - d, L.f); up.push(`${X(d).toFixed(1)} ${Y(v + r).toFixed(1)}`); dn.push(`${X(d).toFixed(1)} ${Y(v - r).toFixed(1)}`); up6.push(`${X(d).toFixed(1)} ${Y(v + 0.6 * r).toFixed(1)}`); dn6.push(`${X(d).toFixed(1)} ${Y(v - 0.6 * r).toFixed(1)}`); }
    f.append(sv('path', { d: `M${up.join(' L')} L${dn.reverse().join(' L')} Z`, fill: 'rgba(127,211,243,.12)', stroke: C.cyan, strokeWidth: 1 }));
    f.append(sv('path', { d: `M${up6.join(' L')} L${dn6.reverse().join(' L')} Z`, fill: 'rgba(127,211,243,.16)', stroke: C.cyan, strokeWidth: 0.6, strokeDasharray: '3 3' }));
    f.append(sv('line', { x1: X(0), y1: Y(L.h1), x2: X(L.D), y2: Y(L.h2), stroke: '#fff', strokeWidth: 1.4 }));
    // l'obstacle, posé sur le sol bombé
    const ob = renflement(L.xo, L.D - L.xo), col = R.rel >= 0.6 ? C.green : R.rel >= 0 ? C.amber : C.red;
    f.append(sv('rect', { x: X(L.xo) - 9, y: Y(L.ho + ob), width: 18, height: Math.max(1, Y(ob) - Y(L.ho + ob)), fill: '#59646f', stroke: col, strokeWidth: 2 }));
    // les mâts et les paraboles
    for (const [km, h, nom] of [[0, L.h1, 'émetteur'], [L.D, L.h2, 'car']]) {
      f.append(sv('line', { x1: X(+km), y1: yb, x2: X(+km), y2: Y(+h), stroke: C.grey, strokeWidth: 3 }), sv('circle', { cx: X(+km), cy: Y(+h), r: 6, fill: C.amber }), txt(X(+km), yb + 22, `${nom} · ${h} m`, 'co-s'));
    }
    f.append(txt(x0, 14, 'blanc : la ligne de vue · bleu : le 1er ellipsoïde de Fresnel (pointillé : ses 60 %) · hauteurs agrandies, sol bombé par la courbure de la Terre', 'co-s', 'start'));
    for (const m of [0, 10, 20, 30, 40]) f.append(txt(x0 - 6, Y(m) + 4, `${m}`, 'co-m', 'end'));
    prof.replaceChildren(f);
    read.set('Longueur d\'onde, ouverture du faisceau', `${fmtNum(R.lambda * 100, 1)} cm ; faisceau de ${fmtNum(R.ouv, 1)}° à −3 dB (parabole de ${fmtNum(L.dant, 1)} m)`);
    read.set('Rayon de Fresnel à l\'obstacle', `${fmtNum(R.r1, 1)} m (au milieu de la liaison : ${fmtNum(R.rMilieu, 1)} m) ; la Terre y bombe de ${fmtNum(R.bombe, 2)} m`);
    read.set('Dégagement de l\'obstacle', `${R.deg >= 0 ? '' : '−'}${fmtNum(Math.abs(R.deg), 1)} m sous la ligne de vue, soit ${fmtNum(R.rel * 100)} % du rayon (60 % demandés)`);
    read.set('Perte de diffraction', `${fmtNum(R.diff, 1)} dB`);
    read.set('Bilan', `${L.p} dBm émis + 2 × ${fmtNum(R.G, 1)} dBi − ${fmtNum(R.espace, 1)} dB d'espace libre − ${fmtNum(R.diff, 1)} dB d'obstacle − ${PERTES} dB de câbles`);
    read.set('Niveau reçu et marge', `${dBs(R.recu)} dBm, marge de ${dBs(R.marge)} dB sur un récepteur à ${dBs(SENSIB_RX, 0)} dBm`);
    const v = R.marge < 0 ? ['ko', 'Le niveau reçu est sous la sensibilité du récepteur : pas d\'image. Dégagez la ligne de vue (mâts plus hauts), rapprochez, ou passez à de plus grandes paraboles.']
      : R.rel < 0 ? ['ko', `L'obstacle coupe la ligne de vue : ${fmtNum(R.diff, 1)} dB de diffraction, une liaison à la merci du moindre changement (un camion, une grue, la pluie). Montez les antennes jusqu'à dégager 60 % du premier rayon.`]
        : R.rel < 0.6 ? ['warn', `La ligne de vue passe, mais l'obstacle entre dans l'ellipsoïde de Fresnel (${fmtNum(R.rel * 100)} % de dégagement) : ${fmtNum(R.diff, 1)} dB perdus et une liaison sensible. Visez 60 %.`]
          : R.marge < 15 ? ['warn', `Dégagement suffisant, mais seulement ${fmtNum(R.marge, 1)} dB de marge : les évanouissements (pluie aux hautes fréquences, réflexions) peuvent couper. Des paraboles plus grandes l'augmentent.`]
            : ['ok', `Ligne de vue et 60 % de l'ellipsoïde dégagés, ${fmtNum(R.marge, 1)} dB de marge : la liaison tient.`];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  const sl = (label, k, a, b, st, fmt) => slider(label, a, b, L[k], st, (v) => { L[k] = v; if (k === 'D' && L.xo > L.D) L.xo = L.D / 2; draw(); }, fmt);
  host.append(
    el('div', { class: 'co-ctl' },
      choice('Fréquence', [['2.4', '2,4 GHz'], ['7', '7 GHz'], ['13', '13 GHz']], '7', (v) => { L.f = +v; draw(); }),
      choice('Paraboles', [['0.3', '0,3 m'], ['0.6', '0,6 m'], ['1.2', '1,2 m']], '0.6', (v) => { L.dant = +v; draw(); }),
      sl('Distance', 'D', 0.5, 20, 0.5, (v) => `${fmtNum(v, 1)} km`)),
    el('div', { class: 'co-ctl' },
      sl('Mât de l\'émetteur', 'h1', 2, 40, 1, (v) => `${v} m`),
      sl('Mât du car', 'h2', 2, 40, 1, (v) => `${v} m`)),
    el('div', { class: 'co-ctl' },
      sl('Obstacle : hauteur', 'ho', 0, 35, 1, (v) => `${v} m`),
      sl('Obstacle : position', 'xo', 0.1, 19.9, 0.1, (v) => `${fmtNum(Math.min(v, L.D), 1)} km`)),
    prof, verdict, read.el);
  draw();
}

// ---------------- le schéma ----------------
function figFresnel() {
  const f = figure(720, 200, 'Une liaison point à point entre deux paraboles : la ligne de vue directe, autour d\'elle le premier ellipsoïde de Fresnel, le plus large au milieu ; un obstacle qui y entre fait perdre du niveau, même sans toucher la ligne de vue ; on garde libres 60 % de son rayon.');
  f.append(txt(10, 16, 'Voir l\'autre antenne ne suffit pas : il faut dégager l\'ellipsoïde', 'co-t', 'start'));
  const A = [60, 110], B = [660, 96];
  f.append(sv('ellipse', { cx: 360, cy: 103, rx: 300, ry: 46, fill: 'rgba(127,211,243,.12)', stroke: C.cyan, transform: 'rotate(-1.3 360 103)' }));
  f.append(sv('ellipse', { cx: 360, cy: 103, rx: 300, ry: 27.6, fill: 'none', stroke: C.cyan, strokeDasharray: '4 3', transform: 'rotate(-1.3 360 103)' }));
  f.append(sv('line', { x1: A[0], y1: A[1], x2: B[0], y2: B[1], stroke: '#fff', strokeWidth: 1.5 }));
  for (const [x, y] of [A, B]) f.append(sv('path', { d: `M${x} ${y - 16} Q${x + (x < 360 ? 14 : -14)} ${y} ${x} ${y + 16}`, fill: 'none', stroke: C.amber, strokeWidth: 3 }), sv('line', { x1: x, y1: y + 16, x2: x, y2: 190, stroke: C.grey, strokeWidth: 3 }));
  f.append(sv('rect', { x: 300, y: 118, width: 40, height: 72, fill: '#59646f', stroke: C.amber, strokeWidth: 1.5 }), txt(320, 112, 'obstacle', 'co-s'));
  f.append(sv('line', { x1: 360, y1: 57, x2: 360, y2: 103, stroke: C.cyan }), txt(366, 74, 'r1 = 17,32 √(d1 d2 ÷ f D)', 'co-m', 'start'));
  f.append(txt(360, 172, '60 % de r1 dégagés : la liaison ne perd rien à l\'obstacle', 'co-s'), txt(60, 196, 'mât, parabole', 'co-s'), txt(660, 196, 'mât du car', 'co-s'));
  return f;
}

/** @type {import('./index.js').Lesson} */
export const LESSON_FRESNEL = {
  id: 'hf-fresnel', title: 'La liaison point à point : paraboles, zone de Fresnel et dégagement', minutes: '9 min',
  essentials: [
    'Une liaison point à point vise une **parabole** sur l\'autre : beaucoup de gain (≈ 30 dBi pour 0,6 m à 7 GHz) dans un faisceau de quelques degrés, à aligner.',
    'L\'onde n\'occupe pas qu\'une ligne : autour de la ligne de vue, le **premier ellipsoïde de Fresnel** (r1 = 17,32 √(d1 d2 ÷ f D), en m) doit rester libre à **60 %**.',
    'Un obstacle qui frôle la ligne de vue coûte déjà **6 dB** ; au-delà de quelques kilomètres, la **courbure de la Terre** se compte aussi.',
  ],
  figure: figFresnel,
  demoTitle: 'La liaison de départ voit le car, mais un immeuble entre dans l\'ellipsoïde : montez les deux mâts jusqu\'à 60 % de dégagement. Passez à 20 km, à 13 GHz, puis changez de paraboles.',
  demo: demoFresnel,
  body: `Quand la fibre ne va pas jusqu'à la caméra (une arrivée de course à quelques kilomètres, un plateau en ville, un relais vers le car), on monte une **liaison point à point** : un émetteur et un récepteur, chacun avec une antenne **parabolique** sur un mât, qui se visent l'un l'autre. La parabole concentre l'énergie dans un faisceau très étroit : son gain vaut 10 log (η (π D ÷ λ)²), avec un rendement η de l'ordre de 0,55. À 7 GHz (λ = 4,3 cm), une parabole de 0,6 m fait environ **30 dBi**, avec un faisceau d'environ 5° à −3 dB (70 λ ÷ D). C'est ce qui permet de franchir des kilomètres avec quelques centaines de milliwatts, mais il faut **aligner** les deux paraboles au degré près, à la boussole puis au niveau reçu, et un mât qui bouge au vent fait décrocher.

Le bilan se fait comme pour la caméra HF (leçon sur le bilan de liaison) : niveau reçu = puissance émise + gains des deux antennes − affaiblissement en espace libre − pertes. En kilomètres et en gigahertz, l'espace libre s'écrit 92,45 + 20 log d + 20 log f (la même formule que 20 log d + 20 log f − 27,55 en mètres et en mégahertz) : 123 dB pour 5 km à 7 GHz.

Il reste une condition que le bilan seul ne dit pas : le **dégagement**. Une onde radio ne voyage pas sur une ligne mais dans un volume : le **premier ellipsoïde de Fresnel**, un fuseau autour de la ligne de vue, le plus large au milieu. Son rayon vaut r1 = 17,32 × √(d1 × d2 ÷ (f × D)) mètres (distances en km, f en GHz) : 7,3 m au milieu d'une liaison de 5 km à 7 GHz, 12,5 m à 2,4 GHz. Un obstacle (un toit, une tribune, une grue, la cime des arbres) qui entre dans ce fuseau fait perdre du niveau **même si l'on voit encore l'autre antenne** ; s'il affleure la ligne de vue, la perte est déjà d'environ **6 dB**, et elle grimpe vite au-delà. La règle de métier : garder libres au moins **60 % du rayon** du premier ellipsoïde, où la perte est nulle. On y arrive en montant les mâts, en déplaçant le point d'émission, ou en passant par un relais.

Sur de longues liaisons, la **Terre** elle-même se met en travers : son renflement au milieu vaut d1 × d2 ÷ (12,74 × k), avec k = 4/3 pour une atmosphère standard (les ondes se courbent un peu). Négligeable à 2 km (6 cm), il atteint 5,9 m au milieu d'une liaison de 20 km. La **fréquence** joue des deux côtés : plus elle monte, plus l'ellipsoïde est mince (bon pour le dégagement) et plus une parabole de même taille a de gain, mais plus l'espace libre affaiblit et plus la pluie coûte (vers 13 GHz et au-delà, une forte averse peut retirer plusieurs dB par kilomètre : ordre de grandeur). On prend donc de la **marge** : de l'ordre de 15 à 20 dB au-dessus de la sensibilité pour une liaison qu'on veut tenir toute une soirée.

- Avant d'aller sur place, on trace le profil du terrain entre les deux points (carte, altitudes, hauteur des bâtiments), comme dans la manipulation ; sur place, on aligne au niveau reçu et l'on note la marge.
- Les fréquences d'une liaison point à point se demandent comme celles des caméras HF (leçon Bandes et fréquences).`,
  car: { text: 'Au poste HF : les liaisons des caméras sans fil, leurs antennes de réception et leur marge. Une liaison point à point vers une position éloignée se prépare sur un profil comme celui de la manipulation, avant d\'aller poser les mâts.', station: 'hf' },
  terms: [],
  competences: ['2.10', '2.11', '3.4'],
  quiz: [
    { q: 'Les deux paraboles se voient, mais le toit d\'un immeuble affleure la ligne de vue au milieu de la liaison. Que perd-on ?', choices: ['Environ 6 dB, et la liaison devient fragile', ['Rien : on voit l\'autre antenne', 'L\'onde occupe un volume autour de la ligne de vue (l\'ellipsoïde de Fresnel) : un obstacle qui y entre coûte du niveau, même sans couper la vue.'], ['Toute la liaison : l\'image est coupée', 'Un obstacle qui affleure ne coupe pas tout : il retire environ 6 dB, ce qu\'une bonne marge peut absorber, mais de justesse.']], answer: 0, why: 'Au ras de la ligne de vue, la diffraction coûte environ 6 dB (UIT-R P.526). On veut 60 % du premier rayon de Fresnel dégagé, où la perte est nulle.' },
    { q: 'Quel est le rayon du premier ellipsoïde de Fresnel au milieu d\'une liaison de 4 km à 7 GHz ?', choices: ['≈ 6,5 m', ['≈ 0,04 m', 'C\'est la longueur d\'onde à 7 GHz (4,3 cm) : le rayon de Fresnel est bien plus grand au milieu d\'une liaison.'], ['≈ 26 m', 'C\'est oublier la racine carrée : r1 = 17,32 × √(2 × 2 ÷ (7 × 4)).']], answer: 0, why: 'r1 = 17,32 × √(d1 d2 ÷ (f D)) = 17,32 × √(4 ÷ 28) = 17,32 × 0,378 ≈ 6,5 m. Il faut en garder 60 % libres : ≈ 3,9 m sous la ligne de vue.' },
    { q: 'On passe d\'une parabole de 0,6 m à une parabole de 1,2 m, à la même fréquence. Que gagne-t-on, à chaque bout ?', choices: ['≈ 6 dB de gain, et un faisceau deux fois plus étroit à viser', ['≈ 3 dB', 'Le gain suit la surface de l\'antenne, donc le carré du diamètre : × 2 sur le diamètre, × 4 sur la surface, soit 6 dB.'], ['Rien : seule la puissance de l\'émetteur compte', 'Le gain des antennes entre dans le bilan comme la puissance : 6 dB de plus à chaque bout, 12 dB sur la liaison.']], answer: 0, why: 'Gain = 10 log (η (π D ÷ λ)²) : doubler D multiplie le gain par 4, soit +6 dB. Le faisceau (≈ 70 λ ÷ D degrés) devient deux fois plus étroit : l\'alignement est plus délicat.' },
    { q: 'Pourquoi la courbure de la Terre compte-t-elle sur une liaison de 20 km et pas sur une de 1 km ?', choices: ['Son renflement au milieu croît comme d1 × d2 : 1,5 cm à 1 km, ≈ 5,9 m à 20 km', ['Parce que les ondes radio ne vont pas au-delà de l\'horizon visuel', 'Elles vont un peu au-delà (k = 4/3 : les ondes se courbent), mais le renflement reste à compter dans le dégagement.'], ['Elle ne compte jamais en dessous de 100 km', 'À 20 km, le sol bombe déjà de près de 6 m au milieu : c\'est autant de dégagement en moins.']], answer: 0, why: 'Renflement = d1 × d2 ÷ (12,74 × k) mètres (km, k = 4/3) : 0,5 × 0,5 ÷ 17 ≈ 1,5 cm à 1 km ; 10 × 10 ÷ 17 ≈ 5,9 m à 20 km. On l\'ajoute à la hauteur des obstacles.' },
    { q: 'Une liaison a 8 dB de marge et un obstacle à 70 % de dégagement. Que faire pour qu\'elle tienne toute la soirée ?', choices: ['Gagner de la marge : de plus grandes paraboles ou un émetteur plus puissant', ['Rien : la marge est positive', 'Une marge de 8 dB laisse peu de place aux évanouissements (pluie, réflexions, mât qui bouge) ; on vise 15 à 20 dB.'], ['Monter les mâts', 'Le dégagement est déjà suffisant (70 % > 60 %) : monter les mâts ne gagne plus rien.']], answer: 0, why: 'Le dégagement est bon, c\'est la marge qui manque. Doubler le diamètre des deux paraboles donne 12 dB de plus sur la liaison.' },
    { q: 'Que faut-il faire avant d\'aller poser les mâts d\'une liaison point à point ?', choices: ['Tracer le profil entre les deux points et vérifier le dégagement et le bilan', ['Rien : on aligne sur place au niveau reçu', 'L\'alignement se fait sur place, mais un obstacle dans l\'ellipsoïde ne se règle pas en tournant la parabole : il faut l\'avoir vu avant.'], ['Choisir la fréquence la plus haute possible', 'Une fréquence plus haute amincit l\'ellipsoïde mais affaiblit plus et craint la pluie : c\'est un compromis, pas une règle.']], answer: 0, why: 'Le profil (altitudes, bâtiments, distance) dit d\'avance si 60 % de l\'ellipsoïde sont libres et quelle marge on aura ; sur place, on n\'a plus qu\'à aligner et vérifier.' },
  ],
};
