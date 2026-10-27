// @ts-check
import { el } from '../util.js';
import { figure, sv, choice, readout, fmtNum } from './kit.js';
import { SENSORS, LENSES } from '../data/cameras.js';

// ----------------------------------------------------------------------------------
// Leçon « Le plan caméras d'un match : positions, axe et règle des 180° » (chapitre La réalisation).
// La manipulation pose dix caméras autour d'un terrain de 105 × 68 m et calcule, pour une action
// (le ballon, sa direction), le sens du mouvement à l'écran de chaque caméra : la direction de visée
// tournée d'un quart de tour donne la droite de l'image, son produit scalaire avec le mouvement dit
// « vers la droite », « vers la gauche » ou « dans l'axe ». Une coupe qui change le sens franchit
// l'axe. La focale pour un plan large (40 m de champ) ou serré (un joueur, 2,6 m de haut) se calcule
// sur le capteur 2/3" (9,59 mm de large) et se compare au zoom box Fujinon UA107 (data/cameras.js).
// Les positions sont celles d'un dispositif type, pas d'un stade précis.
// ----------------------------------------------------------------------------------
const C = { grey: '#8a949c', amber: '#ffd38a', red: '#ff8a80', green: '#7fd1a0', cyan: '#7fd3f3', box: '#1a2026', line: '#2a3238', herbe: '#1e4a24', herbe2: '#24562a' };
const txt = (x, y, s, cls = 'co-s', anchor = 'middle') => sv('text', { x, y, textAnchor: anchor, class: cls }, s);

// ---------------- le modèle (pur) ----------------
/** le terrain (m) : longueur, largeur ; repère : x vers la droite vu de la tribune principale, y vers la tribune d'en face */
export const TERRAIN = { L: 105, l: 68 };
/** les caméras d'un dispositif type : position (m), hauteur (m), rôle */
export const CAMS_PLAN = [
  { id: 'c1', nom: 'CAM 1', role: 'plan large, tribune principale', x: 0, y: -62, h: 20 },
  { id: 'c2', nom: 'CAM 2', role: 'serré, tribune principale', x: 3, y: -62, h: 20 },
  { id: 'c3', nom: 'CAM 3', role: '16 m gauche, en hauteur', x: -36, y: -58, h: 18 },
  { id: 'c4', nom: 'CAM 4', role: '16 m droite, en hauteur', x: 36, y: -58, h: 18 },
  { id: 'c5', nom: 'CAM 5', role: 'bord terrain gauche', x: -28, y: -38, h: 1.5 },
  { id: 'c6', nom: 'CAM 6', role: 'bord terrain droit', x: 28, y: -38, h: 1.5 },
  { id: 'c10', nom: 'CAM 10', role: 'Steadicam HF, côté bancs', x: 10, y: -36, h: 1.7 },
  { id: 'c7', nom: 'CAM 7', role: 'derrière le but gauche', x: -58, y: 4, h: 2 },
  { id: 'c8', nom: 'CAM 8', role: 'derrière le but droit', x: 58, y: -4, h: 2 },
  { id: 'c9', nom: 'CAM 9', role: 'reverse, tribune d\'en face', x: 0, y: 56, h: 15 },
];
/** des actions : position du ballon et direction de son mouvement (m) */
export const ACTIONS = [
  { id: 'attaque', nom: 'Contre-attaque vers le but de droite', b: [-5, 5], v: [1, 0.1] },
  { id: 'centre', nom: 'Centre depuis l\'aile droite, vers la surface', b: [42, 28], v: [0.15, -1] },
  { id: 'tir', nom: 'Tir vers le but de gauche', b: [-38, -5], v: [-1, 0.05] },
  { id: 'retrait', nom: 'Passe en retrait vers le gardien de droite', b: [30, 10], v: [1, -0.1] },
];
/** la droite de l'image d'une caméra qui regarde le point b : sa direction de visée tournée d'un quart de tour */
export function droiteImage(cam, b) { const fx = b[0] - cam.x, fy = b[1] - cam.y, n = Math.hypot(fx, fy) || 1; return [fy / n, -fx / n]; }
/** part du mouvement qui traverse l'image (−1 à +1) : + vers la droite de l'image, − vers la gauche */
export function traverse(cam, b, v) { const r = droiteImage(cam, b); return (r[0] * v[0] + r[1] * v[1]) / (Math.hypot(v[0], v[1]) || 1); }
/** sens à l'écran : +1 vers la droite, −1 vers la gauche, 0 dans l'axe de la caméra (vers elle ou au loin) */
export function sensEcran(cam, b, v, seuil = 0.35) { const s = traverse(cam, b, v); return Math.abs(s) < seuil ? 0 : Math.sign(s); }
/** une coupe de la caméra a vers la caméra c : le sens est-il gardé ? (une vue dans l'axe est neutre) */
export function coupe(a, c, b, v) { const sa = sensEcran(a, b, v), sc = sensEcran(c, b, v); return { sa, sc, neutre: sa === 0 || sc === 0, ok: sa === 0 || sc === 0 || sa === sc }; }
/** distance de la caméra au ballon (m), hauteur comprise */
export const distanceBallon = (cam, b) => Math.hypot(b[0] - cam.x, b[1] - cam.y, cam.h || 0);
/** focale (mm) pour cadrer une largeur W (m) à la distance D (m), sur un capteur de largeur w (mm, 2/3" par défaut) */
export const focalePour = (D, W, w = SENSORS['2/3'].w) => D * w / W;
/** largeur du champ d'un plan serré (m) : un joueur de la tête aux pieds, avec de l'air, en 16:9 */
export const SERRE_H = 2.6, LARGE_W = 40;
export const serreW = () => SERRE_H * 16 / 9;
const LENS = LENSES.UA107;
const sensTexte = (s) => (s > 0 ? 'vers la droite' : s < 0 ? 'vers la gauche' : 'dans l\'axe (vers la caméra ou au loin)');

// ---------------- la manipulation ----------------
function demoPlan(host) {
  let act = 'attaque', a = 'c1', c = 'c9';
  const fig = el('div', { class: 'co-scroll' });
  const read = readout(['L\'action', 'À l\'antenne', 'Coupe vers', 'Focales de la caméra à l\'antenne']);
  const verdict = el('p', { class: 'co-verdict' });
  const W = 720, H = 430, k = 4.6, cx = W / 2, cy = 200;
  const X = (x) => cx + x * k, Y = (y) => cy - y * k;
  const draw = () => {
    const A = ACTIONS.find((x) => x.id === act) || ACTIONS[0], ca = CAMS_PLAN.find((x) => x.id === a) || CAMS_PLAN[0], cc = CAMS_PLAN.find((x) => x.id === c) || CAMS_PLAN[0];
    const sa = sensEcran(ca, A.b, A.v);
    const f = figure(W, H, `Le terrain vu de haut, tribune principale en bas : dix caméras, le ballon et la direction de l'action. ${ca.nom} à l'antenne, coupe vers ${cc.nom}.`);
    f.append(sv('rect', { x: X(-TERRAIN.L / 2 - 8), y: Y(TERRAIN.l / 2 + 8), width: (TERRAIN.L + 16) * k, height: (TERRAIN.l + 16) * k, fill: C.herbe, rx: 4 }));
    for (let i = 0; i < 10; i++) if (i % 2) f.append(sv('rect', { x: X(-TERRAIN.L / 2 + i * TERRAIN.L / 10), y: Y(TERRAIN.l / 2), width: TERRAIN.L / 10 * k, height: TERRAIN.l * k, fill: C.herbe2 }));
    const lw = { fill: 'none', stroke: 'rgba(240,244,236,.8)', strokeWidth: 1.4 };
    f.append(sv('rect', { x: X(-TERRAIN.L / 2), y: Y(TERRAIN.l / 2), width: TERRAIN.L * k, height: TERRAIN.l * k, ...lw }), sv('line', { x1: X(0), y1: Y(34), x2: X(0), y2: Y(-34), ...lw }), sv('circle', { cx: X(0), cy: Y(0), r: 9.15 * k, ...lw }));
    for (const s of [-1, 1]) f.append(sv('rect', { x: s < 0 ? X(-52.5) : X(52.5 - 16.5), y: Y(20.16), width: 16.5 * k, height: 40.32 * k, ...lw }));
    // l'axe : la ligne qui partage le stade, les caméras du direct d'un seul côté
    f.append(sv('line', { x1: X(-66), y1: Y(0), x2: X(66), y2: Y(0), stroke: C.amber, strokeWidth: 1.4, strokeDasharray: '7 5' }), txt(X(-66), Y(0) - 6, 'l\'axe', 'co-s', 'start'));
    f.append(txt(cx, H - 8, 'tribune principale (le côté des caméras du direct)', 'co-s'), txt(cx, 14, 'tribune d\'en face', 'co-s'));
    // les lignes de visée et les caméras
    for (const cam of CAMS_PLAN) {
      const s = sensEcran(cam, A.b, A.v), on = cam.id === a, nx = cam.id === c;
      const col = s === 0 ? C.grey : s === sa || sa === 0 ? C.green : C.red;
      f.append(sv('line', { x1: X(cam.x), y1: Y(cam.y), x2: X(A.b[0]), y2: Y(A.b[1]), stroke: col, strokeWidth: on || nx ? 2.2 : 0.8, opacity: on || nx ? 0.95 : 0.4, strokeDasharray: on ? '' : '4 3' }));
      f.append(sv('circle', { cx: X(cam.x), cy: Y(cam.y), r: on || nx ? 9 : 7, fill: on ? '#f0372c' : nx ? '#33c46c' : C.box, stroke: col, strokeWidth: 2 }), txt(X(cam.x), Y(cam.y) + 4, cam.nom.replace('CAM ', ''), 'co-m'));
      f.append(txt(X(cam.x), Y(cam.y) + (cam.y < 0 ? 22 : -14), s > 0 ? '→' : s < 0 ? '←' : '·', 'co-t'));
    }
    // le ballon et son mouvement
    const bx = X(A.b[0]), by = Y(A.b[1]), ex = X(A.b[0] + A.v[0] * 14), ey = Y(A.b[1] + A.v[1] * 14);
    f.append(sv('line', { x1: bx, y1: by, x2: ex, y2: ey, stroke: '#fff', strokeWidth: 2.4 }), sv('circle', { cx: ex, cy: ey, r: 3.5, fill: '#fff' }), sv('circle', { cx: bx, cy: by, r: 6, fill: '#fff', stroke: '#0b1013', strokeWidth: 2 }));
    f.append(txt(W - 10, 32, 'flèche sous chaque caméra : le sens du jeu à son écran', 'co-s', 'end'), txt(W - 10, 46, 'vert : comme à l\'antenne · rouge : à l\'envers · gris : dans l\'axe', 'co-s', 'end'));
    fig.replaceChildren(f);
    const K = coupe(ca, cc, A.b, A.v);
    const D = distanceBallon(ca, A.b), fl = focalePour(D, LARGE_W), fs = focalePour(D, serreW());
    read.set('L\'action', A.nom);
    read.set('À l\'antenne', `${ca.nom} (${ca.role}) : le jeu va ${sensTexte(K.sa)}`);
    read.set('Coupe vers', `${cc.nom} (${cc.role}) : le jeu va ${sensTexte(K.sc)}`);
    read.set('Focales de la caméra à l\'antenne', `ballon à ${fmtNum(D)} m : plan large (40 m de champ) ${fmtNum(fl)} mm, serré sur un joueur ${fmtNum(fs)} mm${fs > LENS.fmax * 2 ? ` : au-delà des ${fmtNum(LENS.fmax * 2)} mm d'un zoom box UA107 avec doubleur` : fs > LENS.fmax ? ' : il faut le doubleur du zoom box UA107 (900 mm sans)' : ''}`);
    const v = a === c ? ['warn', 'C\'est la même caméra : choisissez la caméra vers laquelle couper.']
      : !K.ok ? ['ko', `La coupe franchit l'axe : à l'antenne, le jeu allait ${sensTexte(K.sa)} ; après la coupe, il va ${sensTexte(K.sc)}. Le téléspectateur croit que l'équipe repart dans l'autre sens. La ${cc.nom} se garde pour un ralenti annoncé, ou l'on passe d'abord par une vue dans l'axe.`]
        : K.neutre ? ['warn', `Coupe acceptable : l'une des deux vues est dans l'axe (le jeu vient vers la caméra ou s'en éloigne), elle ne dit pas de sens. C'est par une telle vue qu'on peut changer de côté.`]
          : ['ok', `Coupe propre : le jeu va ${sensTexte(K.sa)} avant et après. Les deux caméras sont du même côté de l'axe.`];
    verdict.className = 'co-verdict ' + v[0]; verdict.textContent = v[1];
  };
  const opts = CAMS_PLAN.map((x) => [x.id, x.nom.replace('CAM ', ''), `${x.nom} : ${x.role}`]);
  host.append(
    el('div', { class: 'co-ctl' }, choice('L\'action', ACTIONS.map((x) => [x.id, x.nom.split(' ')[0] + (x.id === 'retrait' ? ' en retrait' : ''), x.nom]), act, (v) => { act = v; draw(); })),
    el('div', { class: 'co-ctl' }, choice('À l\'antenne', opts, a, (v) => { a = v; draw(); }), choice('Coupe vers', opts, c, (v) => { c = v; draw(); })),
    fig, verdict, read.el);
  draw();
}

// ---------------- le schéma ----------------
function figPlan() {
  const f = figure(720, 210, 'La règle des 180° : une ligne, l\'axe, partage le stade en deux ; toutes les caméras du direct sont d\'un même côté (la tribune principale), et le jeu va dans le même sens sur chacune ; une caméra de l\'autre côté (la reverse) montre le jeu à l\'envers ; une caméra derrière un but regarde dans l\'axe et ne dit pas de sens.');
  f.append(txt(10, 16, 'La règle des 180° : rester du même côté de l\'axe', 'co-t', 'start'));
  f.append(sv('rect', { x: 200, y: 40, width: 320, height: 130, fill: '#1e4a24', rx: 4 }), sv('line', { x1: 360, y1: 40, x2: 360, y2: 170, stroke: 'rgba(240,244,236,.7)' }), sv('line', { x1: 160, y1: 105, x2: 560, y2: 105, stroke: C.amber, strokeWidth: 1.6, strokeDasharray: '7 5' }), txt(566, 109, 'axe', 'co-s', 'start'));
  f.append(sv('line', { x1: 310, y1: 120, x2: 410, y2: 120, stroke: '#fff', strokeWidth: 2.5 }), sv('path', { d: 'M410 120 l-9 -5 v10 Z', fill: '#fff' }), txt(360, 136, 'le jeu', 'co-s'));
  const cam = (x, y, n, s, col) => { f.append(sv('circle', { cx: x, cy: y, r: 9, fill: C.box, stroke: col, strokeWidth: 2 }), txt(x, y + 4, n, 'co-m'), txt(x, y + (y > 105 ? 26 : -16), s, 'co-s')); };
  cam(300, 190, '1', '→ à l\'écran', C.green); cam(420, 190, '4', '→ à l\'écran', C.green); cam(360, 24, '9', '← à l\'écran : reverse', C.red); cam(176, 105, '7', '· dans l\'axe', C.grey);
  f.append(txt(10, 60, 'Du même côté :', 'co-s', 'start'), txt(10, 74, 'le jeu va dans le même', 'co-s', 'start'), txt(10, 88, 'sens sur chaque caméra.', 'co-s', 'start'));
  f.append(txt(600, 60, 'De l\'autre côté :', 'co-s', 'start'), txt(600, 74, 'tout s\'inverse ; on', 'co-s', 'start'), txt(600, 88, 'la garde aux ralentis.', 'co-s', 'start'));
  return f;
}

/** @type {import('./index.js').Lesson} */
export const LESSON_PLAN = {
  id: 'real-plan', title: 'Le plan caméras d\'un match : positions, axe et règle des 180°', minutes: '8 min',
  essentials: [
    'Le **plan caméras** place chaque caméra pour un rôle : le plan large en tribune à la hauteur du milieu, les 16 m, les serrés, le bord terrain, les buts, la reverse.',
    'Toutes les caméras du direct restent du **même côté de l\'axe** (la tribune principale) : l\'équipe qui attaque vers la droite attaque vers la droite sur chaque plan, c\'est la **règle des 180°**.',
    'Une caméra **de l\'autre côté** (la reverse) inverse le sens : on la garde pour les ralentis ; une vue **dans l\'axe** (derrière un but) ne dit pas de sens et permet de passer.',
  ],
  figure: figPlan,
  demoTitle: 'Choisissez une action, puis la caméra à l\'antenne et celle vers laquelle couper : coupez de la CAM 1 vers la CAM 9 (la reverse), puis vers la CAM 4, puis vers la CAM 8 derrière le but. Regardez la focale qu\'il faut pour un serré.',
  demo: demoPlan,
  body: `Avant le match, le réalisateur et le chef de car posent le **plan caméras** (le dispositif) : où est chaque caméra, avec quel objectif, pour quel rôle. Un match ordinaire se fait avec de l'ordre d'une dizaine de caméras, une grande affiche ou une finale avec plus de trente (ordres de grandeur, selon le diffuseur). Les rôles se retrouvent d'un stade à l'autre :
- la **caméra principale** (le plan large, le « master ») en tribune principale, à la hauteur de la ligne médiane et assez haut (une vingtaine de mètres) pour voir l'espace et la tactique : c'est la caméra de base du direct ;
- à côté d'elle, le **serré** qui suit le porteur du ballon, et parfois une caméra **joueur** (ISO) qui ne lâche pas la vedette ;
- les deux **caméras 16 m**, en hauteur, alignées sur les surfaces de réparation : elles jugent le hors-jeu et donnent les plans moyens de l'attaque ;
- les **bords terrain** (portables, Steadicam en HF) pour les émotions et les plans au ras de la pelouse, les **caméras de but** derrière chaque but, les **super ralentis**, et pour les grands matchs la caméra volante, la grue, le drone ;
- la **reverse**, en face, dans la tribune opposée.

Toutes ces caméras ne se valent pas au montage du direct, à cause de l'**axe**. Le téléspectateur se repère au sens du jeu : l'équipe en rouge attaque vers la droite. Tant que les caméras qui passent en direct sont du **même côté** d'une ligne imaginaire (l'axe, qui partage le stade dans la longueur), l'équipe en rouge attaque vers la droite sur chacune d'elles : on peut couper de l'une à l'autre sans qu'il perde le fil. C'est la **règle des 180°**, l'angle du demi-cercle où les caméras restent. Une caméra de l'**autre côté** montre tout à l'envers : couper vers elle en plein jeu fait croire que l'équipe repart vers son propre but. La reverse sert donc aux **ralentis**, annoncés comme tels (un volet, une mention, le commentateur), ou aux plans arrêtés (un remplacement, un joueur à terre).

Une caméra placée **sur l'axe** (derrière un but, la caméra volante au-dessus du jeu) regarde le jeu venir vers elle ou s'en éloigner : elle ne dit pas de sens. Elle est **neutre**, et c'est par elle qu'on peut changer de côté sans heurter : on passe du côté principal à la vue de but, puis, si besoin, de l'autre côté. Le sens à l'écran se calcule : la direction dans laquelle la caméra regarde, tournée d'un quart de tour, donne la droite de l'image ; si le mouvement du ballon va dans ce sens, il va vers la droite à l'écran. Deux caméras qui donnent des sens opposés pour la même action sont de part et d'autre de l'axe.

Le plan caméras fixe aussi les **objectifs**. La focale qui cadre une largeur W à une distance D se calcule sur la largeur du capteur (9,59 mm en 2/3") : f = D × 9,59 ÷ W. Depuis la tribune principale, à une soixantaine de mètres du jeu, un plan large de 40 m demande environ 15 mm ; un joueur en pied (2,6 m de haut, soit 4,6 m de large en 16:9), de l'ordre de 125 mm. À l'autre bout du terrain, à 90 m, le même serré demande près de 190 mm. C'est pourquoi les positions de tribune portent de grands zooms box (8,4 à 900 mm pour un UA107, le double avec le doubleur), et les bords terrain des portables.

- Les positions du simulateur sont dans l'application **Plan caméras** du téléphone (touche P) : vues de haut, avec leur objectif et leur rôle.
- La scripte note la caméra de chaque action ; les ralentis d'un but montrent souvent trois angles : la principale, le 16 m, puis la caméra de but ou la reverse.`,
  car: { text: 'L\'application Plan caméras du téléphone (touche P) montre le stade vu de haut avec chaque caméra, son objectif et son rôle ; au poste du réalisateur, le multiview les montre toutes, et c\'est lui qui choisit à chaque coupe la caméra qui garde le sens du jeu.', station: 'realisateur' },
  terms: [],
  competences: ['2.9', '3.4', '3.11'],
  quiz: [
    { q: 'L\'équipe en rouge attaque vers la droite sur la CAM 1 (plan large, tribune principale). Le réalisateur coupe en plein jeu sur la reverse, dans la tribune d\'en face. Que voit le téléspectateur ?', choices: ['L\'équipe en rouge semble repartir vers la gauche, vers son propre but', ['Rien de particulier : seul le décor change', 'La reverse est de l\'autre côté de l\'axe : tout ce qui allait vers la droite va vers la gauche.'], ['L\'image à l\'envers, la tête en bas', 'Seul le sens gauche-droite s\'inverse, pas le haut et le bas.']], answer: 0, why: 'Couper de l\'autre côté de l\'axe inverse le sens du jeu à l\'écran. C\'est pourquoi la reverse sert aux ralentis annoncés, pas au direct en plein jeu.' },
    { q: 'Pourquoi une caméra derrière le but peut-elle servir à passer d\'un côté de l\'axe à l\'autre ?', choices: ['Elle est sur l\'axe : le jeu vient vers elle ou s\'en éloigne, elle ne dit pas de sens', ['Parce qu\'elle est plus proche du jeu', 'La distance ne change rien au sens : c\'est la direction de la visée par rapport au mouvement qui compte.'], ['Parce qu\'elle a un objectif plus court', 'La focale change la taille du cadre, pas le sens du mouvement à l\'écran.']], answer: 0, why: 'Le mouvement va dans la direction de la visée : rien ne traverse l\'image de gauche à droite. Cette vue neutre « efface » le sens précédent, et permet de repartir de l\'autre côté sans heurter.' },
    { q: 'À quoi servent les deux caméras 16 m ?', choices: ['À juger le hors-jeu et donner les plans moyens de l\'attaque, alignées sur les surfaces', ['À filmer les bancs de touche', 'Les bancs se filment depuis le bord terrain ; les 16 m sont en hauteur, alignées sur les lignes des surfaces.'], ['À remplacer la caméra principale à la mi-temps', 'La principale reste la caméra de base du direct pendant tout le match.']], answer: 0, why: 'Alignées sur la ligne des 16,5 m, elles donnent une vue perpendiculaire qui permet de juger un hors-jeu, et un plan plus serré que le large quand l\'attaque arrive dans la surface.' },
    { q: 'La caméra principale est à 60 m du jeu, en 2/3" (9,59 mm de large). Quelle focale pour un plan large de 40 m de champ ?', choices: ['Environ 14 mm', ['Environ 40 mm', 'C\'est confondre la focale et la largeur du champ : f = D × 9,59 ÷ W.'], ['Environ 250 mm', 'C\'est la focale d\'un serré sur un joueur à cette distance ou plus loin ; pour 40 m de champ, il faut une focale courte.']], answer: 0, why: 'f = 60 × 9,59 ÷ 40 ≈ 14,4 mm. Pour un joueur en pied (≈ 4,6 m de large en 16:9), il faudrait ≈ 125 mm : c\'est toute l\'étendue d\'un zoom box de stade.' },
    { q: 'Où place-t-on la caméra principale ?', choices: ['En tribune principale, à la hauteur de la ligne médiane, assez haut pour voir l\'espace', ['Derrière un but, pour voir tout le terrain dans sa longueur', 'Derrière un but, la caméra est sur l\'axe : elle ne dit pas le sens du jeu et écrase les distances.'], ['Au bord du terrain, au plus près des joueurs', 'Au ras de la pelouse, on ne voit ni l\'espace ni la tactique : c\'est la place des caméras d\'émotion.']], answer: 0, why: 'Centrée et en hauteur, elle voit les deux moitiés du terrain sous le même angle et donne le sens de référence du direct : toutes les autres caméras du direct se mettent du même côté qu\'elle.' },
    { q: 'Le réalisateur veut montrer un ralenti du but par la reverse. Comment le faire sans perdre le téléspectateur ?', choices: ['Le présenter comme un ralenti : un volet, une mention ou le commentateur qui l\'annonce', ['Le couper en direct, sans transition, pour gagner du temps', 'Une coupe sèche vers la reverse en plein jeu inverse le sens sans prévenir : c\'est la confusion que la règle des 180° évite.'], ['C\'est impossible : la reverse ne sert jamais', 'La reverse donne souvent le meilleur angle d\'un but ou d\'une faute : on l\'utilise, mais annoncée.']], answer: 0, why: 'Le téléspectateur comprend qu\'il voit l\'action rejouée sous un autre angle : le volet et le commentaire le préviennent que le sens est inversé.' },
  ],
};
