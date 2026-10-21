// @ts-check
import { el, clamp } from '../../util.js';
import { LENS, SENSOR, MIRE_D, COC, defocus, blur, zoomPos, maxAperture, effAperture, exposureOf, fr, distLabel, fieldHeight, dofLimits } from '../optics.js';
import { makeViewfinder, whiteLevels, drawScope, cnv, encode } from '../vf.js';
import { slider, seg, toggle, btnRow, linkBtn, lensRings, lensState, shell, scopeCanvas, irisN, irisPos, pointPos } from '../controls.js';
import { LENSES, maxAperture as rampOf } from '../../data/cameras.js';

// ----------------------------------------------------------------------------------
// Manipulations des fiches du module caméra : L'objectif (chapitre 1), lots 2 et 3. Chacune reçoit
// ctx = { lens(état) } et renvoie { node, dispose } (voir ../labs.js). Le viseur simulé est dans
// ../vf.js, les commandes communes dans ../controls.js, les calculs d'optique dans ../optics.js.
// Les calculs propres à ces fiches sont exportés en tête (tests/unit/camlab-ch1.test.mjs) ; quand
// un coefficient est un ordre de grandeur de la maquette et pas un chiffre de fiche technique, le
// commentaire le dit.
// - frontale : traitement anti-reflet (Fresnel), pare-soleil (géométrie de la maquette 3D), nettoyage
// - ramping : l'ouverture maximale au bout du zoom (f/1,8 jusqu'à 41 mm, f/2,4 à 54 mm)
// - doubleur : ×2 sur la focale et le nombre f, quatre fois moins de lumière
// - macro : un décalage d'image fixe, une erreur de point en f² : le zoom n'est plus parfocal
// - defauts : aberration chromatique latérale et ALAC, distorsion, vignetage, sur une mire quadrillée
// - monture : monter l'objectif B4, brancher le câble 12 broches, la face d'appui propre
// - box-portable : quel objectif pour quel plan, du plateau à la tribune
// ----------------------------------------------------------------------------------

const DEG = Math.PI / 180;
const send = (ctx, s) => { if (ctx && ctx.lens) ctx.lens(s); };
const readout = () => el('p', { class: 'cl-read' });
const okWhite = (w) => w >= 80 && w < 99.6;
/** une touche seule sur sa ligne, à sa largeur */
const one = (b) => el('div', { class: 'c1-gestes' }, b);
const pct = (v, d = 0) => fr(v * 100, d) + ' %';
const mm = (f) => fr(f, f < 10 ? 1 : 0) + ' mm';
const stops = (v) => fr(v, 1).replace('-', '−');

// =================================================================================
// Les calculs
// =================================================================================

// ---- la lentille frontale ----
/** réflexion d'une surface air-verre en incidence normale (Fresnel) : ((n − 1) / (n + 1))² */
export const fresnel = (n) => ((n - 1) / (n + 1)) ** 2;
/** réflexion d'une couche quart d'onde d'indice n1 sur un verre d'indice n2, à la longueur d'onde de calcul */
export const quarterWave = (n1, n2) => ((n2 - n1 * n1) / (n2 + n1 * n1)) ** 2;
/** surfaces air-verre d'un zoom de télévision : une trentaine (ordre de grandeur) */
export const SURFACES = 30;
/** les traitements : verre nu (n = 1,5 : 4 %), couche simple de fluorure de magnésium (n = 1,38 sur un verre 1,52 : 1,3 %), multicouche (de l'ordre de 0,2 %) */
export const COATS = [
  { id: 'nu', nom: 'Verre nu', R: fresnel(1.5) },
  { id: 'simple', nom: 'Couche simple', R: quarterWave(1.38, 1.52) },
  { id: 'multi', nom: 'Multicouche', R: 0.002 },
];
/** lumière transmise par n surfaces qui réfléchissent chacune R */
export const transmission = (R, n = SURFACES) => (1 - R) ** n;
/** part de la lumière réfléchie qui finit en voile uniforme sur le capteur (modèle de la maquette, ordre de grandeur) */
export const VEIL_K = 0.05;
/** voile (lumière linéaire, 1 = blanc à 100 %) dû aux reflets internes */
export const veilOf = (T) => VEIL_K * (1 - T);
/** voile d'un projecteur qui frappe toute la lentille de face (modèle de la maquette, ordre de grandeur) */
export const PROJ_K = 0.045;
/** voile d'une trace de doigt, de la poussière, d'une rayure (ordres de grandeur) */
export const SMUDGE = { finger: 0.012, dust: 0.0015, scratch: 0.004 };
/**
 * Pare-soleil de la caméra 3D (camlab/model.js) : ouverture avant de 208 × 158 mm, 84,5 mm devant la
 * lentille frontale, elle-même de 85 mm de diamètre. W, H : demi-ouverture (m), d : profondeur, r : rayon.
 */
export const HOOD = { W: 0.104, H: 0.079, d: 0.0845, r: 0.0425 };
/**
 * Part de la lentille frontale éclairée par une source lointaine à theta (radians) de l'axe, dans le
 * plan horizontal : l'ombre du bord du pare-soleil coupe le disque de la lentille selon une corde.
 */
export function hoodLit(theta, hood = true, H = HOOD) {
  if (theta >= Math.PI / 2) return 0;
  if (!hood) return 1;
  const c = clamp((H.W - H.d * Math.tan(theta)) / H.r, -1, 1);
  return (Math.PI - Math.acos(c) + c * Math.sqrt(1 - c * c)) / Math.PI;
}
/** angle (radians) au-delà duquel le pare-soleil met toute la lentille à l'ombre */
export const hoodShadow = (H = HOOD) => Math.atan((H.W + H.r) / H.d);
/** angle (radians) en deçà duquel la lentille reste entièrement éclairée */
export const hoodFull = (H = HOOD) => Math.atan((H.W - H.r) / H.d);

// ---- le ramping ----
/** diamètre de la pupille d'entrée (mm) : focale ÷ nombre f */
export const pupil = (f, N) => f / N;
/** diaphragmes perdus au bout du zoom, l'iris réglé sur Nset */
export const rampLoss = (Nset, f) => 2 * Math.log2(Math.max(Nset, maxAperture(f)) / Nset);

// ---- le doubleur ----
/** nombre f réel : l'iris ne s'ouvre pas plus que le ramping, et le doubleur multiplie tout par 2 */
export const extAperture = (Nset, f, ext) => Math.max(Nset, maxAperture(f)) * (ext ? LENS.ext : 1);

// ---- la macro ----
/** course de la bague macro, en décalage de l'image (mm) : ordre de grandeur de la maquette */
export const MACRO_MAX = 0.95;
/** décalage d'image (mm) qu'il faut pour voir net à D (m), la bague de point réglée sur dF (m) */
export const macroNeed = (f, D, dF = LENS.mod) => defocus(f, D, dF, 0);
/** distance (m) la plus proche rendue nette par un décalage M (mm), la bague de point sur la distance minimale */
export const macroClosest = (f, M = MACRO_MAX) => 1 / (M * 1000 / (f * f) + 1 / LENS.mod);

// ---- les défauts optiques (modèle de la maquette : ordres de grandeur d'un zoom grand angle 2/3") ----
/** demi-diagonale de l'image 1920 × 1080, en photosites */
export const CORNER = Math.hypot(960, 540);
/** taille d'un photosite (µm) : 9,59 mm ÷ 1920 */
export const PITCH = SENSOR.w / 1920 * 1000;
/** aberration chromatique latérale : écart de grandissement du rouge et du bleu sur le vert (fraction) */
export function lateralCA(f) { const k = Math.sqrt(LENS.fmin / f); return { R: 0.0015 * k, B: -0.001 * k }; }
/** ce que laisse l'ALAC de l'aberration chromatique latérale (ordre de grandeur) */
export const ALAC_RESIDUAL = 0.1;
/** distorsion au coin de l'image (fraction) : barillet au grand angle (−3 %), coussinet au serré (+1,2 %) */
export const distortion = (f) => -0.03 + 0.042 * zoomPos(f);
/** perte de lumière au coin de l'image (fraction) : forte à pleine ouverture, presque nulle vers f/4 */
export const vignetteLoss = (N) => 0.06 + 0.44 * clamp((4 - N) / (4 - LENS.f0), 0, 1);

// ---- objectif portable ou box ----
/** les objectifs comparés : celui de la caméra du plateau, et deux objectifs du car (data/cameras.js) */
export const OBJECTIFS = {
  ZA12: { id: 'ZA12', name: 'Fujinon ZA12x4.5BERD', kind: 'portable', fmin: LENS.fmin, fmax: LENS.fmax, f0: LENS.f0, ramp: LENS.ramp, fLong: LENS.fLong, kg: 2.07, where: 'sur la caméra du plateau, poignée de servo' },
  UA24: { id: 'UA24', ...LENSES.UA24, where: 'portable du car, poignée de servo' },
  UA80: { id: 'UA80', ...LENSES.UA80, where: 'box du car, sur adaptateur grand objectif (15,5 kg)' },
};
/** focale (mm) qui cadre une hauteur Hm (m) à la distance D (m) sur un capteur 2/3" */
export const focalFor = (D, Hm) => D * SENSOR.h / Hm;
/** ouverture maximale d'un objectif à la focale f (mm), avec ou sans doubleur */
export const lensAperture = (lens, f, ext = false) => rampOf(lens, f, ext);

// =================================================================================
// Les manipulations
// =================================================================================

/** la lentille frontale : le traitement, le pare-soleil, le nettoyage */
function frontale(ctx) {
  const LIGHT = 0.5 / transmission(0.002); // le plateau des autres fiches, à travers un objectif traité multicouche
  const start = () => ({ z: zoomPos(10), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, coat: 'nu', hood: true, proj: false, ang: 52, dust: false, finger: false, scratch: false });
  const st = start();
  const defis = [false, false, false]; let msg = '';
  const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img));
  const rings = lensRings(st, () => up(), []);
  const coat = seg('Traitement', COATS.map((c) => [c.id, c.nom]), st.coat, (v) => { st.coat = v; msg = ''; up(); });
  const hood = toggle('Pare-soleil', true, (v) => { st.hood = v; msg = ''; up(); });
  const ang = slider('Projecteur', 48, 85, 0.5, st.ang, (v) => { st.ang = v; msg = ''; up(); });
  const clean = (label, fn) => el('button', { type: 'button', class: 'btn small', onclick: () => { fn(); up(); } }, label);
  const tools = el('div', { class: 'c1-gestes', role: 'group', 'aria-label': 'Nettoyer la lentille' },
    clean('Soufflette', () => { if (st.scratch) return; msg = st.dust ? 'La soufflette chasse les grains sans toucher le verre. On commence toujours par elle.' : 'Plus de poussière : la soufflette ne peut rien contre une trace grasse.'; st.dust = false; }),
    clean('Pinceau doux', () => { if (st.scratch) return; msg = st.dust ? 'Le pinceau décroche les grains, sans appuyer. Ses poils ne se touchent pas avec les doigts : ils prendraient du gras.' : 'Plus de poussière à décrocher.'; st.dust = false; }),
    clean('Papier optique et liquide', () => {
      if (st.scratch) return;
      if (st.dust) { st.scratch = true; msg = 'Un grain de poussière est resté sous le papier : en frottant, il a rayé le traitement. Une rayure ne s\'enlève plus.'; return; }
      msg = st.finger ? 'Une goutte de liquide sur le papier, jamais sur la lentille, puis en spirale du centre vers le bord : la trace part, le voile avec.' : 'Rien à nettoyer : on ne frotte pas une lentille propre.';
      st.finger = false;
    }),
    clean('Chiffon (tee-shirt)', () => {
      if (st.scratch) return;
      if (st.dust) { st.scratch = true; msg = 'Le tissu a traîné un grain sur le verre : une rayure dans le traitement, pour toujours.'; return; }
      msg = st.finger ? 'Le tee-shirt étale la graisse au lieu de l\'enlever : la trace est toujours là, le voile aussi.' : 'Un chiffon de vêtement laisse des fibres et du gras : jamais sur une optique.';
    }));
  ang.row.hidden = true; tools.hidden = true;
  const read = readout();
  const sh = shell({ vf, scope: sc, ctrls: [coat.row, one(hood.btn), ang.row, tools, read], defis: [
    'Choisis le traitement qui laisse passer plus de 90 % de la lumière à travers les 30 surfaces, et garde le voile sous 2 %.',
    'Un projecteur en contre-jour frappe la lentille. Remets le pare-soleil, puis fais déplacer le projecteur jusqu\'à ce que la lentille soit entièrement à l\'ombre.',
    'Un doigt a touché la lentille et la poussière du plateau s\'y est collée : nettoie-la sans la rayer.',
  ] });
  function olivier(T, vPct, lit) {
    if (st.scratch) return msg + ' Sur un objectif de ce prix, c\'est un passage au service après-vente. Recommence : soufflette d\'abord.';
    if (defis[2]) return 'Propre. L\'ordre ne change jamais : souffler, brosser, et seulement ensuite essuyer, au papier optique. Le bouchon remis dès que la caméra ne tourne plus.';
    if (defis[1]) return msg || 'Le voile est revenu : regarde le bas de la forme d\'onde. Commence par ce qui ne touche pas le verre.';
    if (defis[0]) {
      if (!st.hood) return `Sans pare-soleil, toute la lentille prend le projecteur : le voile remonte le noir à ${fr(vPct, 1)} %. Remets-le.`;
      if (lit > 0) return `Le pare-soleil met déjà ${pct(1 - lit)} de la lentille à l'ombre. Fais reculer le projecteur vers le côté : plus il est loin de l'axe, plus l'ombre du bord avance.`;
      return 'Entièrement à l\'ombre.';
    }
    const c = COATS.find((x) => x.id === st.coat);
    if (st.coat === 'nu') return `Verre nu : chaque surface renvoie ${pct(c.R, 1)} de la lumière. Sur 30 surfaces, il n'en arrive que ${pct(T)}, et ce qui manque rebondit dans l'objectif : un voile gris sur toute l'image.`;
    if (st.coat === 'simple') return `Une couche de fluorure de magnésium : ${pct(c.R, 1)} par surface, ${pct(T)} qui arrive. Mieux, mais le voile monte encore à ${fr(vPct, 1)} %.`;
    return 'Multicouche.';
  }
  function up() {
    const o = rings.read();
    const c = COATS.find((x) => x.id === st.coat), T = transmission(c.R);
    const lit = st.proj ? hoodLit(st.ang * DEG, st.hood) : 0;
    const vCoat = veilOf(T), vProj = st.proj ? lit * Math.cos(st.ang * DEG) * PROJ_K : 0;
    const vSm = (st.finger ? SMUDGE.finger : 0) + (st.dust ? SMUDGE.dust : 0) + (st.scratch ? SMUDGE.scratch : 0);
    const veil = vCoat + vProj + vSm, vPct = 100 * encode(veil);
    if (!defis[0] && st.coat === 'multi' && T > 0.9 && 100 * encode(vCoat) < 2) {
      defis[0] = true; st.proj = true; st.hood = false; hood.set(false); ang.row.hidden = false;
    }
    const lit2 = st.proj ? hoodLit(st.ang * DEG, st.hood) : 0;
    if (defis[0] && !defis[1] && st.hood && lit2 === 0) {
      defis[1] = true; st.dust = true; st.finger = true; tools.hidden = false; msg = '';
    }
    if (defis[1] && !defis[2] && !st.dust && !st.finger && !st.scratch) defis[2] = true;
    hood.set(st.hood);
    ang.out.textContent = fr(st.ang, 0) + '° / axe';
    const parts = [`${pct(c.R, 1)} réfléchi par surface · ${SURFACES} surfaces : ${pct(T)} de la lumière arrive (${stops(Math.log2(T))} diaph.)`];
    if (st.proj) parts.push(`lentille éclairée par le projecteur : ${pct(lit2)} (ombre complète au-delà de ${fr(hoodShadow() / DEG, 0)}°)`);
    parts.push(`voile : un noir parfait remonte à ${fr(vPct, 1)} %`);
    read.textContent = parts.join(' · ');
    sh.done(defis); sh.say(olivier(T, vPct, lit2));
    const E = exposureOf(o.N) * LIGHT * T;
    vf.draw({ f: o.f, dF: o.dF, N: o.N, E, black: [veil, veil, veil], light: LIGHT });
    send(ctx, lensState(st, o, { light: LIGHT * T }));
  }
  sh.node.append(btnRow(linkBtn('Recommencer', () => {
    Object.assign(st, start()); coat.mark(st.coat); hood.set(true); ang.set(st.ang); ang.row.hidden = true; tools.hidden = true; defis.fill(false); msg = ''; up();
  })));
  up();
  return { node: sh.node, dispose: () => vf.dispose() };
}

// =================================================================================
/** le ramping : l'iris grand ouvert, le zoom jusqu'au bout, l'ouverture qui ne bouge plus */
function ramping(ctx) {
  const L = 0.048; // un plateau peu éclairé : à f/1,8, le blanc de la mire vers 90 %
  const st = { z: 0, s: pointPos(MIRE_D), n: 0, nd: 1 };
  const defis = [false, false, false]; let sweep = null, wWide = 0, wTele = 0;
  const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img));
  const rings = lensRings(st, () => up(), ['zoom', 'iris']);
  const read = readout();
  const sh = shell({ vf, scope: sc, ctrls: [...rings.rows, read], defis: [
    'Iris grand ouvert (f/1,8), zoome du grand angle jusqu\'au bout : regarde le blanc de la mire sur la forme d\'onde.',
    'Toujours à f/1,8 : trouve la focale la plus longue où l\'image ne s\'assombrit pas encore.',
    'Ferme l\'iris juste assez pour que le blanc ne bouge plus du tout de 4,5 à 54 mm, puis vérifie sur toute la course du zoom.',
  ] });
  const Nend = maxAperture(LENS.fmax), N_END = 2.35; // f/2,4 au bout du zoom (fiche Fujinon) : à moins de 0,03 diaphragme près
  function olivier(o, w) {
    if (defis[2]) return `f/${fr(o.Nset)} : un peu moins de lumière au grand angle, mais le même niveau du large au serré. Un zoom peut partir à l'antenne sans que l'image s'assombrisse au bout.`;
    if (defis[1]) {
      if (o.Nset < N_END) return `À f/${fr(o.Nset, 2)}, le ramping mord encore au bout du zoom : à 54 mm, l'objectif ne s'ouvre pas plus que f/${fr(Nend, 1)}. Ferme encore un peu.`;
      if (o.Nset > 2.65) return 'Trop fermé : on perd de la lumière pour rien. Le plus ouvert qui ne bouge plus, c\'est l\'ouverture du bout du zoom.';
      if (sweep && sweep.max >= 53.5) return 'Reviens jusqu\'au grand angle : le blanc ne bouge pas.';
      if (sweep && sweep.min <= 6) return 'Zoome jusqu\'au bout, 54 mm : le blanc ne bouge pas.';
      return 'Parcours maintenant tout le zoom, de 4,5 à 54 mm, sans toucher l\'iris.';
    }
    if (defis[0]) {
      if (o.Nset > 1.85) return 'Rouvre l\'iris en grand, à f/1,8.';
      if (o.f > 41.1) return `À ${mm(o.f)}, l'objectif ne s'ouvre déjà plus qu'à f/${fr(maxAperture(o.f), 1)}. Élargis un peu.`;
      if (o.f < 39) return `Le blanc passe de ${fr(wWide, 0)} à ${fr(wTele, 0)} % au bout du zoom. Plus serré : à ${mm(o.f)}, rien n'a encore changé.`;
      return 'C\'est là.';
    }
    if (o.Nset > 1.85) return 'Ouvre l\'iris en grand, à f/1,8 : c\'est là que le ramping se voit.';
    if (o.f <= 41) return `${mm(o.f)} : le blanc reste à ${fr(w, 0)} %. Continue vers le serré.`;
    return `Le blanc baisse : à ${mm(o.f)}, l'objectif ne peut plus ouvrir qu'à f/${fr(maxAperture(o.f), 1)}. Va jusqu'au bout.`;
  }
  function up() {
    const o = rings.read(); rings.show();
    const E = exposureOf(o.N) * L, w = whiteLevels(E)[1];
    if (o.Nset <= 1.85 && o.f <= 41) wWide = w;
    if (!defis[0] && o.Nset <= 1.85 && o.f >= 53.5) { defis[0] = true; wTele = w; }
    if (defis[0] && !defis[1] && o.Nset <= 1.85 && o.f >= 39 && o.f <= 41.1) defis[1] = true;
    if (defis[1] && !defis[2]) {
      if (o.Nset < N_END || o.Nset > 2.65) sweep = null;
      else {
        sweep = sweep || { min: o.f, max: o.f };
        sweep.min = Math.min(sweep.min, o.f); sweep.max = Math.max(sweep.max, o.f);
        if (sweep.min <= 6 && sweep.max >= 53.5) defis[2] = true;
      }
    }
    const Nmax = maxAperture(o.f), loss = rampLoss(o.Nset, o.f);
    read.textContent = `${mm(o.f)} : ouverture maximale f/${fr(Nmax, 1)} · pupille d'entrée ${fr(pupil(o.f, o.N), 1)} mm (focale ÷ nombre f) · ${loss > 0.01 ? `iris réglé à f/${fr(o.Nset)}, obtenu f/${fr(o.N, 1)} : ${stops(-loss)} diaph.` : 'aucune perte'} · blanc ${fr(w, 0)} %`;
    sh.done(defis); sh.say(olivier(o, w));
    vf.draw({ f: o.f, dF: o.dF, N: o.N, light: L });
    send(ctx, lensState(st, o, { light: L }));
  }
  sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { z: 0, n: 0 }); defis.fill(false); sweep = null; rings.sync(); up(); })));
  up();
  return { node: sh.node, dispose: () => vf.dispose() };
}

// =================================================================================
/** le doubleur : 9–108 mm, deux diaphragmes, et le même cadre sans lui */
function doubleur(ctx) {
  const L = 0.46; // à f/5,6 sans doubleur, le blanc de la mire vers 90 %
  const start = () => ({ z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(5.6), nd: 1, ext: false });
  const st = start();
  const defis = [false, false, false]; let framedExt = false, wOff = 0;
  const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img));
  const rings = lensRings(st, () => up(), ['zoom', 'iris']);
  const ext = seg('Doubleur', [['1', '×1'], ['2', '×2']], '1', (v) => { st.ext = v === '2'; up(); });
  const read = readout();
  const sh = shell({ vf, scope: sc, ctrls: [ext.row, ...rings.rows, read], defis: [
    'Serre à fond (54 mm), puis bascule le doubleur sur ×2 : quelle focale, et que devient l\'image ?',
    'Doubleur engagé, rattrape l\'exposition à l\'iris : le blanc entre 80 et 100 % sur la forme d\'onde.',
    'Cadre la mire en entier (60 cm de haut) avec le doubleur, puis fais le même cadre sans lui, toujours bien exposé.',
  ] });
  const exMark = (g, W) => { g.font = '600 15px "B612 Mono", monospace'; g.fillStyle = 'rgba(240,240,232,0.92)'; g.textAlign = 'right'; g.fillText('EX', W - 12, 42); };
  function olivier(o, fe, N, w, Hh) {
    if (defis[2]) return `Même cadre, même focale (${mm(fe)}) : sans doubleur, l'iris a deux crans de marge en plus. Le doubleur ne sert qu'au-delà de 54 mm, là où le zoom seul ne va pas.`;
    if (defis[1]) {
      const framed = Hh >= 0.6 && Hh <= 0.72;
      if (!framedExt) return st.ext ? (framed ? 'Cadré.' : `Le champ fait ${fr(Hh, 2)} m de haut à 3 m. Règle le zoom jusqu'à ce que la mire touche le haut et le bas de l'image (60 cm).`) : 'Ce cadre-là se fait d\'abord avec le doubleur : remets-le sur ×2.';
      if (st.ext) return 'Cadré avec le doubleur. Repasse sur ×1 et refais le même cadre.';
      if (!framed) return `Sans doubleur, le champ fait ${fr(Hh, 2)} m de haut : ${Hh > 0.72 ? 'serre' : 'élargis'} pour retrouver la mire en entier.`;
      return w >= 99.6 ? 'Même cadre, mais l\'image est écrêtée : sans doubleur, il arrive quatre fois plus de lumière. Ferme l\'iris de deux crans.' : 'Un peu sombre : ouvre un peu l\'iris.';
    }
    if (defis[0]) {
      if (!st.ext) return 'Remets le doubleur sur ×2 : c\'est avec lui qu\'il faut exposer.';
      if (w >= 99.6) return 'Écrêté : ferme un peu l\'iris.';
      if (w < 80) return `Le blanc était à ${fr(wOff, 0)} %, il est à ${fr(w, 0)} %. Ouvre l'iris de deux crans : il faut quatre fois plus de lumière.`;
      return 'Exposé.';
    }
    if (st.ext) return o.f >= 53.5 ? 'Doublé.' : `Doubleur engagé : ${mm(o.f)} × 2 = ${mm(fe)}, et f/${fr(N, 1)}. Serre à fond pour atteindre le bout.`;
    return o.f >= 53.5 ? 'Bascule le levier du doubleur sur ×2.' : 'Serre d\'abord à fond : 54 mm, le bout du zoom.';
  }
  function up() {
    const o = rings.read(); rings.show();
    const k = st.ext ? LENS.ext : 1, fe = o.f * k, N = extAperture(o.Nset, o.f, st.ext);
    const w = whiteLevels(exposureOf(N) * L)[1], Hh = fieldHeight(MIRE_D, fe);
    if (!st.ext) wOff = w;
    if (!defis[0] && st.ext && o.f >= 53.5) defis[0] = true;
    if (defis[0] && !defis[1] && st.ext && okWhite(w)) defis[1] = true;
    if (defis[1] && !defis[2]) {
      const framed = Hh >= 0.6 && Hh <= 0.72;
      if (st.ext && framed) framedExt = true;
      if (framedExt && !st.ext && framed && okWhite(w)) defis[2] = true;
    }
    const [near, far] = dofLimits(fe, N, o.dF);
    read.textContent = `Focale ${mm(fe)}${st.ext ? ` (${mm(o.f)} × 2)` : ''} · iris réglé f/${fr(o.Nset)}, obtenu f/${fr(N, 1)} · champ à 3 m : ${fr(Hh, 2)} m de haut · zone nette de ${distLabel(near)} à ${distLabel(far)} · blanc ${fr(w, 0)} %`;
    sh.done(defis); sh.say(olivier(o, fe, N, w, Hh));
    vf.draw({ f: fe, dF: o.dF, N, light: L, overlay: st.ext ? exMark : undefined });
    send(ctx, { ...lensState(st, o, { light: L }), iris: N, ext: st.ext ? 1 : 0 });
  }
  sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, start()); ext.mark('1'); defis.fill(false); framedExt = false; rings.sync(); up(); })));
  up();
  return { node: sh.node, dispose: () => vf.dispose() };
}

// =================================================================================
/** la macro : plus près que 0,3 m, au grand angle ; le zoom qui n'est plus parfocal ; le retour au repos */
function macro(ctx) {
  const CARD = 0.12, N0 = 2.8, LIGHT = 0.95 / exposureOf(N0);
  const start = () => ({ z: zoomPos(8), s: pointPos(1), n: irisPos(N0), nd: 1, m: 0, free: false, phase: 0 });
  const st = start();
  const defis = [false, false, false]; let ref = null, sweep = null, msg = '';
  const vf = makeViewfinder();
  const rings = lensRings(st, () => up(), ['zoom', 'point']);
  const ring = slider('Bague macro', 0, 1, 0.001, 0, (v) => { st.m = v; msg = ''; up(); });
  const lever = toggle('Bouton macro', false, (v) => {
    if (!v && st.m > 0.004) { lever.set(true); msg = 'La bague macro ne se rebloque qu\'au repos : ramène-la d\'abord en butée, sur son repère.'; up(); return; }
    st.free = v; if (!v) { st.m = 0; ring.set(0); } msg = ''; up();
  });
  vf.canvas.addEventListener('wheel', (e) => { e.preventDefault(); st.s = clamp(st.s - Math.sign(e.deltaY) * 0.0012, 0, 1); rings.sync(); up(); }, { passive: false });
  const read = readout();
  const sh = shell({ vf, ctrls: [...rings.rows, one(lever.btn), ring.row, read], defis: [
    'Une petite mire est posée à 12 cm de la lentille, plus près que la distance minimale (0,3 m). Fais le point dessus.',
    'Sans toucher aux bagues de point et de macro, serre le zoom d\'au moins moitié : que devient l\'image ?',
    'La petite mire est retirée. Remets la macro au repos et bloquée, puis vérifie sur la grande mire à 3 m que le zoom est de nouveau parfocal : net en serré, puis en large.',
  ] });
  const delta = () => -st.m * MACRO_MAX;
  function olivier(o, b) {
    if (msg) return msg;
    if (defis[2]) return 'Macro au repos, le zoom est de nouveau parfocal. On le vérifie à chaque fois : une macro oubliée, et le premier plan large de l\'antenne est flou.';
    if (defis[1]) {
      if (st.free || st.m > 0) return 'Ramène la bague macro à zéro et rebloque-la : tant qu\'elle est sortie, le zoom n\'est pas parfocal.';
      const sharp = b <= COC;
      if (sweep && sweep.max >= 50) return sharp ? 'Net en serré : élargis maintenant, sans toucher au point.' : 'Le point a bougé : refais-le en serré.';
      if (o.f < 50) return 'Zoome à fond pour faire le point sur l\'étoile, à 3 m.';
      return sharp ? 'Net.' : 'Fais le point à la bague de point, en serré.';
    }
    if (defis[0]) return b >= 3 * COC ? 'Flou.' : `Net à ${mm(ref.f)}. Sans toucher aux bagues de point et de macro, serre le zoom jusqu'à ${mm(ref.f * 1.5)} au moins.`;
    if (!st.free) {
      if (st.s < 0.995) return `La bague de point est sur ${distLabel(o.dF)} : la mire est à 12 cm. Tourne-la jusqu'en butée.`;
      return 'La bague de point est en butée, à 0,3 m : la mire est plus près. Appuie sur le bouton macro pour débloquer la bague macro.';
    }
    const need = macroNeed(o.f, CARD, o.dF);
    if (need > MACRO_MAX) return `À ${mm(o.f)}, même à fond, la macro ne fait le point qu'à ${fr(macroClosest(o.f) * 100, 0)} cm. Élargis : la macro travaille au grand angle.`;
    return 'Tourne la bague macro jusqu\'à ce que la petite mire soit nette.';
  }
  function up() {
    const o = rings.read(); rings.show();
    const N = effAperture(N0, o.f), d = delta();
    const bCard = blur(o.f, CARD, o.dF, d, N), bMire = blur(o.f, MIRE_D, o.dF, d, N);
    if (!defis[0] && st.phase === 0 && bCard <= COC) defis[0] = true;
    if (defis[0] && !defis[1]) {
      if (bCard <= COC) ref = { f: o.f, m: st.m, s: st.s };
      if (ref && Math.abs(st.m - ref.m) < 0.003 && Math.abs(st.s - ref.s) < 0.003 && o.f >= 1.5 * ref.f && bCard >= 3 * COC) {
        defis[1] = true; st.phase = 1;
        msg = `À ${mm(o.f)}, la petite mire est floue alors qu'aucune bague de point n'a bougé : en macro, le décalage de l'image est fixe, mais l'erreur de point grandit comme le carré de la focale. Le zoom n'est plus parfocal : on cadre d'abord, on fait le point macro ensuite.`;
      }
    }
    if (defis[1] && !defis[2]) {
      if (st.free || st.m > 0 || bMire > COC) sweep = null;
      else {
        if (!sweep && o.f >= 50) sweep = { min: o.f, max: o.f };
        if (sweep) { sweep.min = Math.min(sweep.min, o.f); sweep.max = Math.max(sweep.max, o.f); if (sweep.min <= 6 && sweep.max >= 50) defis[2] = true; }
      }
    }
    ring.input.disabled = !st.free;
    ring.out.textContent = st.m > 0 ? fr(st.m * MACRO_MAX, 2) + ' mm' : 'repos';
    lever.set(st.free);
    const D = st.phase === 0 ? CARD : MIRE_D, b = st.phase === 0 ? bCard : bMire;
    read.textContent = `${st.phase === 0 ? 'Petite mire à 12 cm' : 'Grande mire à 3 m'} · bague de point sur ${distLabel(o.dF)} · macro : image décalée de ${fr(-d, 2)} mm · ${b <= COC ? 'net' : b < 3 * COC ? 'un peu flou' : 'flou'} · en macro à fond, au plus près à ${mm(o.f)} : ${fr(macroClosest(o.f) * 100, 0)} cm`;
    sh.done(defis); sh.say(olivier(o, b));
    const scene = st.phase === 0 ? { scene: /** @type {'pdc'} */ ('pdc'), cards: [{ D: CARD, ang: 0 }] } : { D };
    vf.draw({ f: o.f, dF: o.dF, delta: d, N, light: LIGHT, ...scene });
    send(ctx, { ...lensState(st, o, { light: LIGHT }), macro: st.free || st.m > 0 ? 1 : 0 });
  }
  sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, start()); ring.set(0); defis.fill(false); ref = null; sweep = null; msg = ''; rings.sync(); up(); })));
  up();
  return { node: sh.node, dispose: () => vf.dispose() };
}

// =================================================================================
/** les défauts optiques sur une mire quadrillée : aberration chromatique latérale et ALAC, vignetage, distorsion */
function defauts(ctx) {
  const W = 640, H = 360, LW = 320, LH = 180, Z = 3; // loupe : un photosite = trois pixels d'écran
  const view = cnv(W, H); view.className = 'cl-vfc c1-chart'; view.setAttribute('role', 'img');
  const loupe = cnv(LW, LH); loupe.className = 'c1-loupe'; loupe.setAttribute('role', 'img');
  const sc = scopeCanvas();
  const st = { z: 0, s: pointPos(MIRE_D), n: 0, nd: 1, alac: false };
  const defis = [false, false, false];
  let raf = 0;
  const rings = lensRings(st, () => up(), ['zoom', 'iris']);
  const alac = toggle('Correction ALAC', false, (v) => { st.alac = v; up(); });
  const read = readout();
  const sh = shell({ vf: { canvas: view }, scope: sc, ctrls: [...rings.rows, one(alac.btn), read], defis: [
    'Au grand angle (4,5 mm), regarde le coin à la loupe : le rouge et le bleu ne tombent pas sur le vert. Active l\'ALAC : l\'écart doit passer sous un demi-photosite.',
    'À pleine ouverture, les coins sont plus sombres que le centre. Ferme l\'iris jusqu\'à ce qu\'ils gardent au moins 80 % du centre.',
    'Au grand angle, les lignes du bord se courbent. Trouve les focales où elles restent droites : distorsion sous 0,3 %.',
  ] });
  sh.screen.insertBefore(el('div', { class: 'c1-loupebox' }, el('span', { class: 'c1-cap' }, 'Loupe sur le coin haut droit : un photosite = 3 pixels'), loupe), sh.screen.lastChild);
  // la mire : un quadrillage noir sur blanc, un trait de 4 photosites tous les 90
  const S = 90, T = 4;
  const lineCov = (u, fp) => { const d = Math.abs(((u % S) + S + S / 2) % S - S / 2); return clamp((T / 2 + fp / 2 - d) / fp, 0, 1); };
  /** dessine une partie de l'image (photosites de x0, y0, échelle k photosites par pixel) avec les défauts */
  function paint(canvas, w, h, x0, y0, k, p) {
    const g = canvas.getContext('2d'), id = g.createImageData(w, h), d = id.data, fp = Math.max(1, k);
    const mR = 1 / (1 + p.aR), mB = 1 / (1 + p.aB);
    for (let j = 0, i = 0; j < h; j++) {
      const y = y0 + (j + 0.5) * k - 540;
      for (let q = 0; q < w; q++, i += 4) {
        const x = x0 + (q + 0.5) * k - 960, r2 = (x * x + y * y) / (CORNER * CORNER);
        const du = 1 / (1 + p.dist * r2), V = 1 - p.vig * r2;
        for (let c = 0; c < 3; c++) {
          const m = du * (c === 0 ? mR : c === 2 ? mB : 1), cx = lineCov(x * m, fp), cy = lineCov(y * m, fp);
          const cov = 1 - (1 - cx) * (1 - cy);
          d[i + c] = Math.round(255 * encode((0.86 - 0.85 * cov) * V));
        }
        d[i + 3] = 255;
      }
    }
    g.putImageData(id, 0, 0);
    return id;
  }
  function draw(p) {
    raf = 0;
    const id = paint(view, W, H, 0, 0, 1920 / W, p);
    paint(loupe, LW, LH, 1920 - LW / Z, 0, 1 / Z, p);
    drawScope(sc, id);
    const g = view.getContext('2d');
    g.strokeStyle = '#ffb020'; g.lineWidth = 2; g.strokeRect(W - LW / Z / 3 - 1, 1, LW / Z / 3, LH / Z / 3);
    g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(6, 6, 104, st.alac ? 62 : 42);
    g.font = '600 15px "B612 Mono", monospace'; g.fillStyle = 'rgba(240,240,232,0.92)'; g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 3; g.textAlign = 'left';
    g.fillText(`Z ${mm(p.f)}`, 12, 22); g.fillText(`F${fr(p.N, 1)}`, 12, 42); if (st.alac) g.fillText('ALAC', 12, 62); g.shadowBlur = 0;
  }
  function up() {
    const o = rings.read(); rings.show();
    const ca = lateralCA(o.f), k = st.alac ? ALAC_RESIDUAL : 1;
    const p = { f: o.f, N: o.N, aR: ca.R * k, aB: ca.B * k, dist: distortion(o.f), vig: vignetteLoss(o.N) };
    const caPx = Math.max(Math.abs(p.aR), Math.abs(p.aB)) * CORNER, corner = 1 - p.vig;
    if (!defis[0] && st.alac && o.f <= 6 && caPx < 0.5) defis[0] = true;
    if (defis[0] && !defis[1] && corner >= 0.8) defis[1] = true;
    if (defis[1] && !defis[2] && Math.abs(p.dist) < 0.003) defis[2] = true;
    read.textContent = `Au coin : rouge ${fr(p.aR * CORNER, 1)} photosite, bleu ${fr(p.aB * CORNER, 1).replace('-', '−')} (un photosite = ${fr(PITCH, 1)} µm) · distorsion ${fr(p.dist * 100, 1).replace('-', '−')} % (${p.dist < -0.003 ? 'barillet' : p.dist > 0.003 ? 'coussinet' : 'droite'}) · coins à ${fr(corner * 100, 0)} % du centre (${stops(Math.log2(corner))} diaph.)`;
    view.setAttribute('aria-label', `Mire quadrillée à ${mm(o.f)}, f/${fr(o.N)} : distorsion ${fr(p.dist * 100, 1)} %, coins à ${fr(corner * 100, 0)} % du centre`);
    loupe.setAttribute('aria-label', `Loupe sur le coin : écart du rouge ${fr(p.aR * CORNER, 1)} photosite, du bleu ${fr(p.aB * CORNER, 1)}`);
    sh.done(defis); sh.say(olivier(o, p, caPx, corner));
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => draw(p));
    send(ctx, lensState(st, o, { light: 0.5 }));
  }
  function olivier(o, p, caPx, corner) {
    if (defis[2]) return `Vers ${mm(o.f)}, la distorsion change de sens : barillet au grand angle, coussinet au serré. Aucune caméra ne la corrige en direct ; on évite de cadrer une ligne droite (un but, un horizon) au bord de l'image en grand angle.`;
    if (defis[1]) return Math.abs(p.dist) < 0.003 ? 'Droites.' : `À ${mm(o.f)}, la distorsion vaut ${fr(p.dist * 100, 1)} % au coin : ${p.dist < 0 ? 'les lignes se bombent vers l\'extérieur (barillet). Serre' : 'les lignes se creusent (coussinet). Élargis'}.`;
    if (defis[0]) return corner >= 0.8 ? 'Coins à 80 %.' : `Coins à ${fr(corner * 100, 0)} % du centre : la forme d'onde du blanc est arrondie aux bords. Ferme l'iris : le vignetage vient surtout de la pleine ouverture.`;
    if (!st.alac) return o.f > 6 ? 'Élargis à fond : c\'est au grand angle que l\'aberration chromatique latérale est la plus forte.' : `Dans la loupe, chaque trait a un liseré rouge d'un côté, bleu de l'autre : ${fr(caPx, 1)} photosite d'écart au coin, rien au centre. C'est le défaut que l'ALAC sait corriger.`;
    return o.f > 6 ? 'Reviens au grand angle pour vérifier la correction.' : 'Corrigé.';
  }
  sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { z: 0, n: 0, alac: false }); alac.set(false); defis.fill(false); rings.sync(); up(); })));
  up();
  return { node: sh.node, dispose: () => { if (raf) cancelAnimationFrame(raf); raf = 0; } };
}

// =================================================================================
/** la monture B4 et le câble 12 broches : monter, brancher, vérifier ; la face d'appui propre */
function monture(ctx) {
  const N0 = 2.8, LIGHT = 0.95 / exposureOf(N0), DIRT = 0.1, LOOSE = 0.2;
  const start = () => ({ z: zoomPos(20), s: pointPos(MIRE_D), n: irisPos(N0), nd: 1, power: true, cap: true, lens: 'off', rubber: false, cable: false, ext: false, dirt: 0, tests: { iris: false, ret: false, ext: false } });
  const st = start();
  const defis = [false, false, false]; let msg = '', retT = 0, retOn = false, seenWide = false;
  const vf = makeViewfinder(); const sc = scopeCanvas(); vf.onFrame((img) => drawScope(sc, img));
  const rings = lensRings(st, () => up(), ['zoom']);
  const say = (t) => { msg = t; up(); };
  const B = (fn) => el('button', { type: 'button', class: 'btn small', onclick: fn });
  const bPower = B(() => { st.power = !st.power; say(st.power ? (st.cable ? 'Caméra allumée : l\'objectif est alimenté par son câble.' : 'Caméra allumée.') : 'Caméra éteinte.'); });
  const bCap = B(() => {
    if (st.lens !== 'off') return say('L\'objectif est en place : le bouchon de la monture n\'a plus rien à protéger.');
    st.cap = !st.cap; say(st.cap ? 'Bouchon remis : la poussière n\'entre pas sur le prisme.' : 'Levier relevé, bouchon retiré : on ne laisse pas la monture ouverte, l\'objectif doit suivre tout de suite.');
  });
  const bLens = B(() => {
    if (st.lens === 'off') {
      if (st.cap) return say('Le bouchon de la monture est encore en place : relève le levier et retire-le d\'abord.');
      st.lens = 'in'; return say('L\'ergot de l\'objectif entre dans l\'encoche du haut : l\'objectif ne peut entrer que droit. Il tient, mais il n\'est pas encore plaqué.');
    }
    if (st.lens === 'locked') return say('L\'objectif est verrouillé : relève d\'abord le levier.');
    if (st.cable) return say('Le câble est encore branché : débranche-le d\'abord, caméra éteinte.');
    st.lens = 'off'; say('Objectif retiré : on le pose sur son bouchon arrière, jamais sur sa monture.');
  });
  const bLever = B(() => {
    if (st.lens === 'off') return say('Rien à verrouiller : présente d\'abord l\'objectif.');
    if (st.lens === 'in') { st.lens = 'locked'; return say('Levier rabattu : la bague de la monture tourne et plaque l\'objectif contre la face d\'appui.'); }
    if (st.rubber) return say('Le caoutchouc de sécurité bloque le levier : retire-le d\'abord.');
    st.lens = 'in'; say('Levier relevé : l\'objectif ne tient plus que par l\'ergot. On le tient à deux mains.');
  });
  const bRubber = B(() => {
    if (st.lens !== 'locked') return say('Le caoutchouc de sécurité se pose sur un levier rabattu.');
    st.rubber = !st.rubber; say(st.rubber ? 'Caoutchouc posé : le levier ne peut plus se relever par accident (mode d\'emploi).' : 'Caoutchouc retiré.');
  });
  const bCable = B(() => {
    if (st.lens === 'off') return say('Pas d\'objectif, pas de câble à brancher.');
    if (st.power) return say('Caméra allumée : le mode d\'emploi demande d\'éteindre la caméra avant de brancher ou de débrancher le câble de l\'objectif.');
    st.cable = !st.cable; say(st.cable ? 'Câble branché sur la prise LENS, détrompeur en face, bague vissée.' : 'Câble débranché.');
  });
  const bClean = B(() => {
    if (st.lens !== 'off') return say('Les faces d\'appui sont cachées : démonte d\'abord l\'objectif.');
    const was = st.dirt; st.dirt = 0;
    say(was ? 'La soufflette chasse le grain des deux faces d\'appui, celle de l\'objectif et celle de la caméra. Remonte l\'objectif.' : 'Faces d\'appui propres.');
  });
  const tIris = B(() => {
    if (!st.power || st.lens === 'off') return say('La caméra doit être allumée, l\'objectif monté.');
    if (!st.cable) return say('La vision ferme l\'iris au RCP, mais rien ne bouge : la commande de l\'iris passe par le câble 12 broches.');
    st.n = irisPos(irisN(st.n) < 3.4 ? 4 : N0); st.tests.iris = true;
    say(`L'iris obéit : f/${fr(irisN(st.n))}. La commande descend par le câble, la position de l'iris remonte par lui.`);
  });
  const tRet = B(() => {
    if (!st.power || st.lens === 'off') return say('La caméra doit être allumée, l\'objectif monté.');
    if (!st.cable) return say('RET ne fait rien : la touche est sur la poignée de l\'objectif, son contact passe par le câble.');
    st.tests.ret = true; retOn = true; clearTimeout(retT); retT = window.setTimeout(() => { retOn = false; up(); }, 1400);
    say('RET : le viseur montre le retour vidéo tant qu\'on appuie (ici les barres envoyées par le car).');
  });
  const tExt = B(() => {
    if (st.lens === 'off') return say('Pas d\'objectif monté.');
    st.ext = !st.ext;
    if (st.ext && st.cable && st.power) { st.tests.ext = true; return say('Doubleur sur ×2 : l\'image double et le viseur affiche EX. La caméra sait que la focale et le nombre f ont doublé.'); }
    say(st.ext ? 'L\'image a doublé, c\'est optique ; mais sans câble, le viseur n\'affiche pas EX : la caméra ne le sait pas.' : 'Doubleur sur ×1.');
  });
  const pins = [['12v', '+12 V'], ['iris', 'iris (commande, position)'], ['zoom', 'position du zoom'], ['ext', 'doubleur (EXT)'], ['ret', 'touche RET'], ['data', 'données série']];
  const pinBox = el('div', { class: 'c1-pins', role: 'list', 'aria-label': 'Ce qui passe dans le câble de l\'objectif' }, ...pins.map(([id, t]) => el('span', { class: 'c1-pin', role: 'listitem', 'data-p': id }, t)));
  const read = readout();
  const sh = shell({ vf, scope: sc, ctrls: [
    el('div', { class: 'c1-gestes', role: 'group', 'aria-label': 'Les gestes' }, bPower, bCap, bLens, bLever, bRubber, bCable, bClean),
    el('div', { class: 'c1-gestes', role: 'group', 'aria-label': 'Vérifier' }, el('span', { class: 'c1-cap' }, 'Vérifier :'), tIris, tRet, tExt),
    ...rings.rows, el('div', { class: 'c1-pinrow' }, el('span', { class: 'c1-cap' }, 'Dans le câble 12 broches :'), pinBox), read,
  ], defis: [
    'Monte l\'objectif sur la caméra : bouchon de la monture retiré, ergot dans l\'encoche, levier rabattu, caoutchouc de sécurité posé.',
    'Branche le câble de l\'objectif comme le demande le mode d\'emploi, allume, puis vérifie ses trois fonctions : l\'iris commandé par la vision, la touche RET, le doubleur affiché EX.',
    'Un grain de 0,1 mm s\'est glissé sur la face d\'appui : regarde au grand angle, puis démonte, nettoie et remonte dans l\'ordre, jusqu\'à une image nette en large.',
  ] });
  // erreur de position de l'image (mm) : un objectif mal plaqué ou posé sur un grain n'est plus à 48 mm
  const shift = () => st.dirt + (st.lens === 'in' ? LOOSE : 0);
  function olivier(o, b) {
    if (msg) return msg;
    if (defis[2]) return 'Net en large. Une face d\'appui sale, c\'est une erreur de tirage : la bague de point la rattrape en serré, pas en large. On souffle les deux faces à chaque montage.';
    if (defis[1]) return o.f > 6 ? 'Élargis à fond : c\'est au grand angle qu\'une erreur de position de l\'objectif se voit.' : b > COC ? 'Flou en large, net en serré : l\'objectif n\'est pas à sa place. Éteins, débranche, démonte, nettoie.' : 'Net.';
    if (defis[0]) return 'Éteins d\'abord la caméra, branche le câble, rallume, puis fais les trois vérifications.';
    return 'Commence par le bouchon de la monture : le levier relevé, il se retire.';
  }
  function up() {
    const o = rings.read(); rings.show();
    const mounted = st.lens === 'locked', live = st.power && st.cable && st.lens !== 'off';
    const k = st.ext ? LENS.ext : 1, fe = o.f * k, N = extAperture(irisN(st.n), o.f, st.ext);
    // le cadreur a fait le point en serré : la bague de point rattrape l'erreur à 54 mm
    const dz = shift(), dF = dz ? 1 / (1 / (MIRE_D * 1000) + dz / (LENS.fmax * k) ** 2) / 1000 : MIRE_D;
    const b = Math.abs(defocus(fe, MIRE_D, dF, dz)) / N;
    if (!defis[0] && mounted && st.rubber && !st.cap) defis[0] = true;
    if (defis[0] && !defis[1] && live && mounted && st.tests.iris && st.tests.ret && st.tests.ext) {
      defis[1] = true; st.dirt = DIRT; st.ext = false; seenWide = false;
      msg = 'Les trois fonctions passent. L\'objectif a été prêté à la caméra 2 et remonté ici sans souffler la face d\'appui : un grain de 0,1 mm le décale. Le cadreur a refait le point en serré. Regarde au grand angle.';
    }
    if (defis[1] && !defis[2]) {
      if (st.dirt && o.f <= 6) seenWide = true;
      if (seenWide && !st.dirt && mounted && st.rubber && live && o.f <= 6 && b <= COC) { defis[2] = true; msg = ''; }
    }
    bPower.textContent = st.power ? 'Éteindre la caméra' : 'Allumer la caméra'; bPower.classList.toggle('on', st.power);
    bCap.textContent = st.cap ? 'Retirer le bouchon de la monture' : 'Remettre le bouchon';
    bLens.textContent = st.lens === 'off' ? 'Présenter l\'objectif, ergot en haut' : 'Retirer l\'objectif';
    bLever.textContent = st.lens === 'locked' ? 'Relever le levier' : 'Rabattre le levier de verrouillage';
    bRubber.textContent = st.rubber ? 'Retirer le caoutchouc' : 'Poser le caoutchouc de sécurité';
    bCable.textContent = st.cable ? 'Débrancher le câble' : 'Brancher le câble 12 broches';
    bClean.textContent = 'Souffler les faces d\'appui';
    tIris.textContent = 'Iris : un cran au RCP'; tRet.textContent = 'Appuyer sur RET'; tExt.textContent = st.ext ? 'Doubleur sur ×1' : 'Doubleur sur ×2';
    for (const [btn, done] of [[tIris, st.tests.iris], [tRet, st.tests.ret], [tExt, st.tests.ext]]) /** @type {HTMLElement} */ (btn).classList.toggle('on', !!done);
    const active = { '12v': live, iris: live, zoom: live, ext: live && st.ext, ret: live && retOn, data: live };
    for (const p of pinBox.querySelectorAll('[data-p]')) p.classList.toggle('on', !!active[/** @type {HTMLElement} */ (p).dataset.p]);
    const state = [st.power ? 'caméra allumée' : 'caméra éteinte', st.lens === 'off' ? (st.cap ? 'monture bouchée' : 'monture ouverte') : st.lens === 'in' ? 'objectif présenté, pas verrouillé' : 'objectif verrouillé', st.rubber ? 'caoutchouc posé' : null, st.cable ? 'câble branché' : 'câble débranché'];
    read.textContent = state.filter(Boolean).join(' · ') + (st.lens !== 'off' && st.power && !st.cap ? ` · ${mm(fe)}, image ${dz ? `décalée de ${fr(dz, 1)} mm : ` : ''}${b <= COC ? 'nette' : 'floue'}` : '');
    sh.done(defis); sh.say(olivier(o, b));
    const dark = !st.power || st.lens === 'off';
    vf.draw({ f: fe, dF, delta: dz, N, light: LIGHT, E: dark ? 0 : undefined, osd: live, scene: live && retOn ? 'bars' : 'mire', msg: live && retOn ? 'RET' : '',
      overlay: live && st.ext ? (g, W) => { g.font = '600 15px "B612 Mono", monospace'; g.fillStyle = 'rgba(240,240,232,0.92)'; g.textAlign = 'right'; g.fillText('EX', W - 12, 42); } : undefined });
    send(ctx, { ...lensState(st, o, { light: dark ? 0 : LIGHT }), iris: N, ext: st.ext ? 1 : 0 });
  }
  sh.node.append(btnRow(linkBtn('Recommencer', () => { clearTimeout(retT); retOn = false; Object.assign(st, start()); defis.fill(false); msg = ''; seenWide = false; rings.sync(); up(); })));
  up();
  return { node: sh.node, dispose: () => { clearTimeout(retT); vf.dispose(); } };
}

// =================================================================================
/** objectif portable ou box : quel objectif pour quel plan, et ce qu'il reste d'ouverture */
function boxPortable(ctx) {
  const W = 640, H = 360;
  const SC = [
    { D: 3, Hm: 0.6, h: 1.75, decor: 'plateau', nom: 'Plateau : le présentateur à 3 m, plan poitrine (60 cm)' },
    { D: 80, Hm: 2, h: 1.8, decor: 'stade', nom: 'Tribune : un joueur à 80 m, en pied (2 m)' },
    { D: 80, Hm: 0.4, h: 1.8, decor: 'stade', nom: 'Tribune : le visage du même joueur (40 cm)' },
  ];
  const view = cnv(W, H); view.className = 'cl-vfc c1-cadre'; view.setAttribute('role', 'img');
  const st = { lens: 'ZA12', z: zoomPos(20), ext: false };
  const defis = [false, false, false];
  const lensOf = () => OBJECTIFS[st.lens];
  const fOf = () => { const L = lensOf(); return L.fmin * Math.pow(L.fmax / L.fmin, st.z); };
  const pick = seg('Objectif', [['ZA12', 'ZA12x4.5 portable'], ['UA24', 'UA24x7.8 portable'], ['UA80', 'UA80x9 box']], st.lens, (v) => {
    const f = fOf(); st.lens = v; const L = lensOf(); st.z = clamp(Math.log(f / L.fmin) / Math.log(L.fmax / L.fmin), 0, 1); zoom.set(st.z); up();
  });
  const zoom = slider('Zoom', 0, 1, 0.001, st.z, (v) => { st.z = v; up(); });
  const ext = toggle('Doubleur ×2', false, (v) => { st.ext = v; up(); });
  const read = readout();
  const sh = shell({ vf: { canvas: view }, ctrls: [pick.row, zoom.row, one(ext.btn), read], defis: [
    'Plateau : cadre le présentateur en plan poitrine (60 cm de haut à 3 m) avec l\'objectif de la caméra du plateau.',
    'Tribune, à 80 m : cadre un joueur en pied (2 m de haut dans l\'image) avec au moins f/2 d\'ouverture, pour le match de nuit.',
    'Toujours à 80 m : cadre le visage du joueur (40 cm de haut). Quelle ouverture reste-t-il ?',
  ] });
  const k = () => defis.findIndex((d) => !d);
  /** une silhouette debout : pieds en (cx, yFeet), ppm pixels par mètre, h sa taille (m) */
  function person(g, cx, yFeet, ppm, h, shirt, shorts) {
    const Y = (y) => yFeet - y * ppm, X = (x) => cx + x * ppm;
    g.fillStyle = '#1b1c1f';
    for (const s of [-1, 1]) g.fillRect(X(s * 0.1 - 0.065), Y(0.85), 0.13 * ppm, 0.85 * ppm);
    if (shorts) { g.fillStyle = shorts; g.fillRect(X(-0.19), Y(1.0), 0.38 * ppm, 0.26 * ppm); }
    g.fillStyle = shirt; g.beginPath(); g.moveTo(X(-0.23), Y(h - 0.25)); g.lineTo(X(0.23), Y(h - 0.25)); g.lineTo(X(0.19), Y(0.95)); g.lineTo(X(-0.19), Y(0.95)); g.closePath(); g.fill();
    for (const s of [-1, 1]) { g.save(); g.translate(X(s * 0.23), Y(h - 0.27)); g.rotate(-s * 0.12); g.fillRect(-0.05 * ppm, 0, 0.1 * ppm, 0.62 * ppm); g.restore(); }
    g.fillStyle = '#c99a78'; g.fillRect(X(-0.045), Y(h - 0.19), 0.09 * ppm, 0.07 * ppm);
    g.beginPath(); g.ellipse(X(0), Y(h - 0.115), 0.09 * ppm, 0.115 * ppm, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2b1d14'; g.beginPath(); g.ellipse(X(0), Y(h - 0.05), 0.092 * ppm, 0.055 * ppm, 0, Math.PI, 0); g.fill();
    if (ppm > 400) { g.fillStyle = '#1b1c1f'; for (const s of [-1, 1]) { g.beginPath(); g.arc(X(s * 0.035), Y(h - 0.1), 0.009 * ppm, 0, Math.PI * 2); g.fill(); } g.fillRect(X(-0.025), Y(h - 0.18), 0.05 * ppm, 0.008 * ppm); }
  }
  function draw(sc, Hf, fe, N, L) {
    const g = view.getContext('2d'), ppm = H / Hf, top = sc.h + 0.06 * Hf, yFeet = top * ppm;
    if (sc.decor === 'plateau') {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d1430'); gr.addColorStop(1, '#1a2550'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#3a2a1c'; g.fillRect(0, yFeet - 0.75 * ppm, W, 0.06 * ppm); // le bureau du plateau
      person(g, W / 2, yFeet, ppm, sc.h, '#4a5a78', null);
      g.fillStyle = '#5a4430'; g.fillRect(0, yFeet - 0.74 * ppm, W, 0.74 * ppm + 2);
    } else {
      g.fillStyle = '#2f3a2c'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#5c6670'; for (let i = 0; i < 12; i++) g.fillRect(0, yFeet - (6 + i * 0.9) * ppm, W, 0.45 * ppm); // les gradins, au loin
      g.fillStyle = '#c8a02a'; g.fillRect(0, yFeet - 1.6 * ppm, W, 0.9 * ppm); // les panneaux du bord du terrain
      g.fillStyle = '#2f7a34'; g.fillRect(0, yFeet - 0.7 * ppm, W, H);
      g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = -6; i < 6; i++) g.fillRect(W / 2 + i * 10 * ppm, yFeet - 0.7 * ppm, 5 * ppm, H);
      person(g, W / 2, yFeet, ppm, sc.h, '#b0172a', '#e7c62b');
    }
    g.font = '600 15px "B612 Mono", monospace'; g.fillStyle = 'rgba(240,240,232,0.92)'; g.shadowColor = 'rgba(0,0,0,0.8)'; g.shadowBlur = 3;
    g.textAlign = 'left'; g.fillText(`Z ${mm(fe)}`, 12, 22); g.fillText(`F${fr(N, 1)}`, 12, 42);
    g.textAlign = 'right'; g.fillText(L.id, W - 12, 22); if (st.ext) g.fillText('EX', W - 12, 42); g.shadowBlur = 0;
    view.setAttribute('aria-label', `${sc.nom} : cadre de ${fr(Hf, 2)} m de haut, ${mm(fe)}, f/${fr(N, 1)}`);
  }
  function olivier(sc, Hf, fe, N, L, okFrame) {
    const i = k();
    if (i < 0) return `f/${fr(N, 1)} : ${fr(2 * Math.log2(N / L.f0), 1)} diaphragmes de moins qu'à pleine ouverture. La nuit, la vision les rattrape au gain. Et ce serré-là ne se fait qu'avec un objectif box sur un pied lourd, zoom et point aux manches.`;
    const need = focalFor(sc.D, sc.Hm);
    const maxF = L.fmax * (st.ext ? 2 : 1);
    if (i === 0) {
      if (st.lens !== 'ZA12') return 'Sur le plateau, c\'est l\'objectif de la caméra qu\'on a : le ZA12x4.5.';
      return okFrame ? 'Cadré.' : `Il faut ${mm(need)} : ${Hf > sc.Hm ? 'serre' : 'élargis'}.`;
    }
    if (L.fmax * 2 < need) return `Le ${L.id} s'arrête à ${mm(L.fmax * 2)} avec le doubleur : à 80 m, il cadre encore ${fr(sc.D * SENSOR.h / (L.fmax * 2), 1)} m de haut au plus serré. Il faut ${mm(need)}.`;
    if (maxF < need) return `${mm(need)} au moins : le ${L.id} n'y arrive qu'avec le doubleur.`;
    if (!okFrame) return `Il faut ${mm(need)} pour ${sc.Hm < 1 ? 'ce gros plan' : 'ce cadre'} : ${Hf > sc.Hm ? 'serre' : 'élargis'}.`;
    if (i === 1 && N > 2) return `Le cadre est bon, mais f/${fr(N, 1)} : ${fr(2 * Math.log2(N / 1.7), 1)} diaphragmes de moins qu'à f/1,7. Il faut un objectif plus lumineux à cette focale.`;
    return 'Cadré.';
  }
  function up() {
    const L = lensOf(), f = fOf(), fe = f * (st.ext ? 2 : 1), N = lensAperture(L, f, st.ext);
    const i = k(), sc = SC[i < 0 ? 2 : i], Hf = sc.D * SENSOR.h / fe;
    const okFrame = Math.abs(Hf - sc.Hm) / sc.Hm <= 0.1;
    if (!defis[0] && st.lens === 'ZA12' && okFrame && i === 0) defis[0] = true;
    else if (defis[0] && !defis[1] && i === 1 && okFrame && N <= 2) defis[1] = true;
    else if (defis[1] && !defis[2] && i === 2 && okFrame) defis[2] = true;
    const i2 = k(), sc2 = SC[i2 < 0 ? 2 : i2], Hf2 = sc2.D * SENSOR.h / fe;
    zoom.row.querySelector('.cl-lbl').textContent = L.kind === 'box' ? 'Zoom (manche)' : 'Zoom';
    zoom.out.textContent = mm(fe);
    ext.set(st.ext);
    read.textContent = `${L.name} : ${L.kind === 'box' ? 'objectif box' : 'objectif portable'}, ${fr(L.fmin, 1)}–${fr(L.fmax, 0)} mm (${fr(L.fmin * 2, 1)}–${fr(L.fmax * 2, 0)} mm avec le doubleur), ${fr(L.kg, 2)} kg, ${L.where}${L.kind === 'box' ? ' ; zoom et point aux manches seulement' : ''} · ${sc2.nom} · ${mm(fe)}, f/${fr(N, 1)} : ${fr(Hf2, 2)} m de haut dans l'image`;
    sh.done(defis); sh.say(olivier(sc2, Hf2, fe, N, L, Math.abs(Hf2 - sc2.Hm) / sc2.Hm <= 0.1));
    draw(sc2, Hf2, fe, N, L);
    if (st.lens === 'ZA12') send(ctx, { zoom: st.z, ext: st.ext ? 1 : 0 });
  }
  sh.node.append(btnRow(linkBtn('Recommencer', () => { Object.assign(st, { lens: 'ZA12', z: zoomPos(20), ext: false }); pick.mark('ZA12'); zoom.set(st.z); defis.fill(false); up(); })));
  up();
  return { node: sh.node, dispose() {} };
}

/** @type {Record<string, (ctx: any) => { node: HTMLElement, dispose: () => void }>} */
export const LABS_CH1 = { frontale, ramping, doubleur, macro, defauts, monture, 'box-portable': boxPortable };
