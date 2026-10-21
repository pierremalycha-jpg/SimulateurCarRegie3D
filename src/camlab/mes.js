// @ts-check
import { el, clamp } from '../util.js';
import { NOTIONS } from './notions/index.js';
import { MIRE_D, ND, defocus, exposureOf, effAperture, zoomFocal, zoomPos, castOf, fr, distLabel } from './optics.js';
import { makeViewfinder, whiteLevels, drawScope } from './vf.js';
import { slider, seg, scopeCanvas, irisN, irisPos, pointDist, pointPos, irisLabel } from './controls.js';
import { recordMes, mesBest, MES_SEUIL } from './progress.js';

// ----------------------------------------------------------------------------------
// L'exercice noté « Mise en service » de la caméra du plateau : HXC-FB80, zoom Fujinon
// ZA12x4.5BERD, CCU HXCU-FB80 et RCP. La caméra sort de son flight-case : objectif démonté, fibre
// débranchée, CCU éteinte, viseur déréglé, filtre et balance de la veille. Le stagiaire fait tout
// lui-même, poste par poste (objectif, fibre, CCU, RCP, caméra, viseur, plateau), dans l'ordre
// qu'il croit juste : les dix étapes sont affichées dans le désordre.
//
// Le moteur (createMes, sans interface, testé dans tests/unit/camlab-suivi.test.mjs) applique
// chaque geste et le vérifie :
//   - un geste impossible (régler une caméra éteinte, nettoyer une fibre branchée…) est refusé
//     et expliqué, sans être compté ;
//   - une ERREUR D'ORDRE (8 points) : un geste fait avant une étape qu'il demande (balance des
//     blancs avant les noirs, caméra alimentée avant l'objectif, fibre branchée sous tension…) ;
//     le geste est fait quand même, comme sur la vraie caméra, et ses conséquences suivent (des
//     noirs refaits après les blancs effacent la balance des blancs) ;
//   - une ERREUR DE GESTE (5 points) : un geste mal fait (fibre branchée sale, tirage réglé en
//     zoom serré ou iris fermé, exposition rattrapée au gain, AWB sur un blanc écrêté…).
// Une même erreur n'est comptée qu'une fois. Le temps compte au-delà de 8 minutes (1 point par
// 30 s, 20 au plus). Note sur 100 ; réussi à partir de 60 (le seuil des exercices notés du livret).
//
// L'ordre retenu (ETAPES) : objectif, fibre, CCU et liaison, viseur sur les barres, tirage, noirs,
// filtre puis blancs, exposition, zebra, fichier de scène. Le tirage vient avant les balances : il
// se règle à chaque montage d'objectif (fiche « tirage »), dans un viseur réglé, iris grand ouvert
// avec le ND ; fait après, il déferait l'exposition. Les dépendances réelles (gestes, champ pre)
// comptent pour les erreurs d'ordre, pas la place dans la liste : le zebra peut se régler tôt.
// Chiffres : niveau optique d'exploitation −5 à −15 dBm, décrochage vers −20 dBm (leçon
// camera-systeme du Cours) ; un connecteur sale y coûte ici 8 dB (ordre de grandeur, « plusieurs
// décibels ») ; exposition jugée sur le blanc de la mire (80 à 99,6 %, comme les fiches), iris entre
// f/4 et f/8, gain 0 dB ; tirage juste à 0,012 mm près (manipulation « tirage » du lot 1).
// ----------------------------------------------------------------------------------

/** les deux éclairages possibles du plateau, tirés au sort à chaque essai */
export const VARIANTES = {
  tungstene: { id: 'tungstene', nom: 'Projecteurs tungstène (3200 K)', detail: 'Le plateau est éclairé par ses projecteurs. La caméra revient d\'un tournage en extérieur.', Tl: 3200, light: 0.5, nd: 1, ndStart: 1 / 16, wbSw: 'PRST', ct: true, mem: { A: 5600, B: 5600 } },
  jour: { id: 'jour', nom: 'Lumière du jour par la verrière (5600 K)', detail: 'Les rideaux de la verrière sont ouverts : le plateau reçoit la lumière du jour, bien plus forte que celle des projecteurs.', Tl: 5600, light: 8, nd: 1 / 16, ndStart: 1, wbSw: 'A', ct: false, mem: { A: 3200, B: 3200 } },
};

/**
 * Les dix étapes, dans l'ordre d'une mise en service. see : les notions à revoir.
 * @type {{ id: string, t: string, court: string, see: string[] }[]}
 */
export const ETAPES = [
  { id: 'objectif', t: 'Monter l\'objectif et brancher son câble', court: 'l\'objectif monté et branché', see: ['monture', 'connectique'] },
  { id: 'fibre', t: 'Nettoyer les connecteurs et brancher la fibre', court: 'la fibre branchée', see: ['fibre', 'connectique'] },
  { id: 'ccu', t: 'Mettre la CCU sous tension, alimenter la caméra et vérifier la liaison', court: 'la liaison vérifiée à la CCU', see: ['ccu', 'fibre', 'alimentation'] },
  { id: 'viseur', t: 'Régler le viseur sur les barres', court: 'le viseur réglé', see: ['viseur', 'mires'] },
  { id: 'tirage', t: 'Régler le tirage en deux passages', court: 'le tirage', see: ['tirage', 'point', 'pdc'] },
  { id: 'noirs', t: 'Faire la balance des noirs (ABB)', court: 'la balance des noirs', see: ['balance', 'noir'] },
  { id: 'blancs', t: 'Choisir le filtre adapté à la lumière, puis faire la balance des blancs (AWB) sur la charte', court: 'la balance des blancs', see: ['balance', 'nd', 'cc'] },
  { id: 'expo', t: 'Exposer à l\'iris sur la forme d\'onde, ND si besoin, sans gain', court: 'l\'exposition', see: ['iris', 'exposition', 'waveform', 'nd'] },
  { id: 'zebra', t: 'Régler le zebra du viseur à 70 %', court: 'le zebra', see: ['viseur', 'waveform'] },
  { id: 'scene', t: 'Enregistrer le fichier de scène', court: 'le fichier de scène', see: ['fichiers', 'menu'] },
];
const ETAPE = Object.fromEntries(ETAPES.map((e) => [e.id, e]));

/** les gestes qui demandent des étapes faites avant eux (erreurs d'ordre) */
export const GESTES = {
  'cam-pw': { t: 'Caméra alimentée', pre: ['objectif'] },
  'vf-ok': { t: 'Viseur réglé', pre: ['ccu'] },
  ff: { t: 'Tirage réglé', pre: ['ccu', 'viseur'] },
  abb: { t: 'Balance des noirs', pre: ['ccu'] },
  awb: { t: 'Balance des blancs', pre: ['ccu', 'noirs'] },
  expo: { t: 'Exposition validée', pre: ['ccu', 'noirs', 'blancs'] },
  store: { t: 'Fichier de scène enregistré', pre: ['ccu', 'noirs', 'blancs', 'expo'] },
};
/** pourquoi une étape passe avant (texte d'une erreur d'ordre) */
const AVANT = {
  objectif: 'On monte l\'objectif et on branche son câble avant d\'alimenter la caméra : on ne branche pas un connecteur sous tension, et la caméra doit trouver son objectif en place pour piloter l\'iris dès la mise en route.',
  ccu: 'On lit l\'état de la CCU avant de régler l\'image : un niveau optique hors plage annonce une liaison qui décrochera pendant l\'émission, et tous les réglages seraient à refaire.',
  viseur: 'La netteté se juge dans le viseur : trop lumineux ou sans contraste, il cache le flou. On règle d\'abord le viseur, sur les barres.',
  noirs: 'Les noirs sont le zéro des trois voies : on les cale d\'abord (ABB), le reste de l\'image se règle dessus.',
  blancs: 'L\'exposition et le fichier de scène viennent après la balance des blancs : pour l\'AWB, l\'iris se règle sur le carton ; on expose ensuite la scène, et l\'on enregistre une caméra entièrement réglée.',
  expo: 'Le fichier de scène garde la caméra telle qu\'elle est réglée : on l\'enregistre quand tout est fait, sinon c\'est un réglage incomplet qui reviendra au prochain rappel.',
};

/** @typedef {'ordre' | 'geste'} Sorte */
/** @typedef {{ kind: Sorte, t: string, why: string, see: string[] }} ErrDef */
/** les erreurs de geste et d'ordre qui ne sont pas un simple « avant » */
/** @type {Record<string, ErrDef>} */
export const ERREURS = {
  'objectif-tension': { kind: 'ordre', t: 'Objectif monté ou branché sous tension', why: AVANT.objectif, see: ['monture', 'connectique'] },
  'fibre-tension': { kind: 'ordre', t: 'Fibre branchée ou débranchée sous tension', why: 'Le câble hybride porte l\'énergie de la tête : on branche et on débranche la fibre CAM PW éteint, puis on alimente la caméra.', see: ['fibre', 'alimentation'] },
  'awb-filtre': { kind: 'ordre', t: 'Balance des blancs avant le filtre adapté à la lumière', why: 'On choisit d\'abord le filtre de tournage, celui qui laisse l\'iris vers f/4 à f/5,6 dans cette lumière, puis on fait la balance avec lui : elle se fait dans les conditions de l\'image, et un ND n\'est jamais parfaitement neutre.', see: ['nd', 'balance'] },
  'fibre-sale': { kind: 'geste', t: 'Fibre branchée sans nettoyer ses connecteurs', why: 'Le cœur d\'une fibre monomode fait 9 µm : une poussière suffit à faire perdre plusieurs décibels à la liaison, et elle raye les faces en contact. On inspecte et on nettoie les deux bouts avant chaque branchement.', see: ['fibre', 'connectique'] },
  'liaison-fausse': { kind: 'geste', t: 'Liaison déclarée bonne avec un niveau optique hors plage', why: 'En exploitation, la CCU reçoit entre −5 et −15 dBm ; vers −20 dBm, la liaison décroche. Hors plage, c\'est un connecteur sale ou un câble abîmé : CAM PW éteint, on débranche, on nettoie, on rebranche et on relit le niveau.', see: ['fibre', 'ccu'] },
  'viseur-image': { kind: 'geste', t: 'Viseur réglé sur l\'image au lieu des barres', why: 'Sur une image, on ne sait pas où devrait être le noir ni le blanc. Sur les barres : la luminosité (BRIGHT) pour que le noir soit juste noir, le contraste pour que chaque barre se distingue sans éblouir.', see: ['viseur', 'mires'] },
  'viseur-faux': { kind: 'geste', t: 'Viseur validé mal réglé', why: 'Sur les barres, le carré à +4 % doit se deviner sur le noir et celui à −2 % se confondre avec lui (luminosité) ; la barre blanche doit être claire sans être éblouissante (contraste).', see: ['viseur', 'mires'] },
  'tirage-serre': { kind: 'geste', t: 'Tirage réglé en zoom serré', why: 'En serré, la bague de point rattrape l\'erreur de tirage : tout paraît net, et le flou revient en large. Le point se fait en serré (54 mm), le tirage en grand angle (4,5 mm), en deux passages au moins.', see: ['tirage', 'point'] },
  'tirage-iris': { kind: 'geste', t: 'Tirage réglé avec l\'iris fermé', why: 'Iris fermé, la profondeur de champ cache l\'erreur de tirage. On ouvre l\'iris en grand (f/2,8 au plus) et on retire la lumière en trop avec le filtre ND.', see: ['tirage', 'pdc', 'nd'] },
  'point-large': { kind: 'geste', t: 'Point fait en grand angle', why: 'En large, la bague de point n\'agit presque plus : (54 ÷ 4,5)² = 144 fois moins qu\'en serré. Le point se fait à 54 mm, sur le centre de l\'étoile ; la loupe MAG du viseur aide.', see: ['point', 'tirage'] },
  'tirage-vis': { kind: 'geste', t: 'Vis F.f bloquée sur un tirage faux', why: 'On bloque la vis quand l\'image reste nette en serré et en large ; sinon, on recommence les deux passages : point en serré, tirage en large.', see: ['tirage'] },
  'balance-barres': { kind: 'geste', t: 'Balance lancée sur les barres', why: 'Les barres sortent du générateur de la caméra : elle ne voit plus son image, la balance ne se fait pas. On coupe BARS avant les balances.', see: ['balance', 'mires'] },
  'awb-prst': { kind: 'geste', t: 'Balance des blancs lancée avec WHITE BAL sur PRST', why: 'En PRST, la caméra applique un préréglage (3200 K, ou 5600 K avec COLOR TEMP.) : la balance automatique ne s\'enregistre qu\'en mémoire A ou B.', see: ['balance', 'cc'] },
  'awb-carton': { kind: 'geste', t: 'Balance des blancs sans la charte devant la caméra', why: 'La balance se mesure sur un carton blanc ou une charte grise qui remplit le centre du cadre, sous la lumière de la scène.', see: ['balance', 'mires'] },
  'awb-niveau': { kind: 'geste', t: 'Balance des blancs sur un blanc mal exposé', why: 'AWB : échec. Le blanc doit être bien exposé, vers 80 % : aucune voie écrêtée (regarde la parade), aucune enfouie dans le bruit. Le filtre adapté d\'abord, puis l\'iris.', see: ['balance', 'iris', 'waveform'] },
  gain: { kind: 'geste', t: 'Exposition rattrapée au gain', why: 'Le gain amplifie le signal et le bruit : +6 dB, c\'est un diaphragme de plus, mais une image plus granuleuse, et une balance des noirs à refaire. On expose à l\'iris et au filtre ; le gain reste à 0 dB tant qu\'il y a assez de lumière.', see: ['gain', 'exposition'] },
  'expo-niveau': { kind: 'geste', t: 'Exposition validée hors des niveaux', why: 'Le blanc de la mire se place vers 80 à 95 % sur la forme d\'onde, sous la ligne des 100 % : au-dessus, il est écrêté et ses détails sont perdus ; en dessous de 80 %, l\'image est sous-exposée.', see: ['iris', 'waveform'] },
  'expo-filtre': { kind: 'geste', t: 'Exposition à un iris hors de sa zone : le filtre n\'est pas le bon', why: 'On expose entre f/4 et f/8 : au-delà de f/8, la diffraction adoucit l\'image et la vision n\'a plus de marge (il faut un ND plus dense) ; plus ouvert que f/4, peu de profondeur de champ et moins de piqué (le ND est trop dense).', see: ['nd', 'iris', 'exposition'] },
};
/** points retirés par erreur, et temps */
export const POIDS = { ordre: 8, geste: 5 };
export const TEMPS = { ref: 480, pas: 30, max: 20 };

/** la note : 100 moins les erreurs et le temps au-delà de 8 minutes */
export function noteMes({ ordre = 0, geste = 0, sec = 0 }) {
  const temps = Math.min(TEMPS.max, Math.max(0, Math.ceil((sec - TEMPS.ref) / TEMPS.pas)));
  const score = Math.max(0, 100 - ordre * POIDS.ordre - geste * POIDS.geste - temps);
  return { score, temps, pOrdre: ordre * POIDS.ordre, pGeste: geste * POIDS.geste };
}
/** l'appréciation d'un score */
export const mention = (s) => (s >= 90 ? 'Mise en service maîtrisée.' : s >= 75 ? 'Bien : quelques gestes à reprendre.' : s >= MES_SEUIL ? 'Réussie, mais à refaire pour gagner en sûreté.' : 'À refaire : revois d\'abord les notions ci-dessous.');

// ---------------- le viseur : luminosité et contraste ----------------
/** gain et décalage d'affichage du viseur (BRIGHT et CONTRAST de −50 à +50) */
export const vfTransfer = (bright, contrast) => ({ k: Math.pow(2, contrast / 50), o: bright * 0.004 });
/** ce qui ne va pas dans le réglage du viseur, ou null */
export function vfFault(bright, contrast) {
  const { k, o } = vfTransfer(bright, contrast); const white = 0.75 * k + o;
  if (o > 0.004) return 'le noir est gris : la luminosité est trop haute, le carré à −2 % se distingue du noir';
  if (o + 0.04 * k < 0.012) return 'le noir est bouché : la luminosité est trop basse, le carré à +4 % ne se voit plus';
  if (white < 0.70) return 'l\'image est terne : le contraste est trop bas, la barre blanche reste grise';
  if (white > 0.95) return 'le blanc éblouit : le contraste est trop haut';
  return null;
}

// ---------------- le moteur ----------------
const INITIAL = (V) => ({
  mounted: false, cable: false, z: zoomPos(20), s: pointPos(5), delta: 0.09, locked: true, ffMoved: false,
  cleanCam: false, cleanCcu: false, plugged: false, dirty: 0,
  ccuOn: false, camPw: false, bootAt: 0, linkChecked: false,
  bars: false, iris: irisPos(5.6), gain: 0,
  nd: V.ndStart, wbSw: V.wbSw, ct: V.ct, mem: { ...V.mem },
  zebra1: false, zebraLevel: 100, sceneNo: 1, storedAt: 0,
  bright: 30, contrast: -30, mag: false, vfOkAt: 0,
  card: false,
  black: /** @type {[number, number, number]} */ ([0.004, 0, 0.006]), abbAt: 0, abbOk: false, awbAt: 0, awbOk: false, expoAt: 0,
  busy: /** @type {{ kind: 'ABB' | 'AWB', until: number } | null} */ (null), vfMsg: '', vfMsgUntil: 0,
});
const DUREE = { abb: 1500, awb: 1200, boot: 2000 };
/** niveau optique reçu à la CCU avec des connecteurs propres (dBm) et perte d'un connecteur sale (dB) */
export const OPT = { base: -7.4, sale: 8, min: -15, max: -5, decroche: -20 };

/**
 * Une mise en service. o.variante : 'tungstene' ou 'jour' (au hasard sinon) ; o.clock : horloge en
 * ms (performance.now) ; o.instant : balances et démarrage sans attente (essais).
 * @param {{ variante?: string, clock?: () => number, instant?: boolean }} [o]
 */
export function createMes(o = {}) {
  const V = VARIANTES[o.variante] || (Math.random() < 0.5 ? VARIANTES.tungstene : VARIANTES.jour);
  const clock = o.clock || (() => performance.now());
  const dur = (k) => (o.instant ? 0 : DUREE[k]);
  let st = INITIAL(V);
  /** @type {{ key: string, kind: Sorte, t: string, why: string, see: string[], at: number }[]} */
  const errors = [];
  /** @type {Record<string, number>} */ const firstDone = {};
  let t0 = 0, tEnd = 0, on = false;

  // ---- ce qui se calcule ----
  const f = () => zoomFocal(st.z);
  const dF = () => pointDist(st.s);
  const Nset = () => irisN(st.iris);
  const N = () => (st.busy && st.busy.kind === 'ABB' ? Infinity : effAperture(Nset(), f()));
  const E = () => { const n = N(); return isFinite(n) ? exposureOf(n, st.nd, st.gain) * V.light : 0; };
  const Tcam = () => (st.wbSw === 'PRST' ? (st.ct ? 5600 : 3200) : st.mem[st.wbSw]);
  const cast = () => /** @type {[number, number, number]} */ (castOf(V.Tl, Tcam()));
  /** niveaux vidéo (%) du blanc de la mire ou du carton, voie par voie, et sa luminance */
  const levels = () => { const w = whiteLevels(E(), cast()); return { w, Y: 0.2126 * w[0] + 0.7152 * w[1] + 0.0722 * w[2], max: Math.max(...w) }; };
  const head = () => st.ccuOn && st.camPw && st.plugged;
  const level = () => (head() ? OPT.base - OPT.sale * st.dirty : null);
  const linkUp = () => { const L = level(); return L != null && L > OPT.decroche; };
  const ready = () => linkUp() && clock() >= st.bootAt;
  const dfs = (fl) => Math.abs(defocus(fl, MIRE_D, dF(), st.delta));
  const tirageOk = () => Math.abs(st.delta) <= 0.012 && dfs(54) <= 0.02 && dfs(4.5) <= 0.012;
  const awbValid = () => st.awbOk && st.wbSw !== 'PRST' && Tcam() === V.Tl;
  /** ce qui ne va pas dans l'exposition (clé d'erreur et précision), ou null */
  function expoFault() {
    if (st.gain > 0) return { key: 'gain', why: `Gain à +${st.gain} dB.` };
    const L = levels(), n = N();
    if (L.max >= 99.6) return { key: 'expo-niveau', why: 'Le blanc de la mire est écrêté (100 %).' };
    if (L.Y < 80) return { key: 'expo-niveau', why: `Le blanc de la mire n'est qu'à ${fr(L.Y, 0)} %.` };
    if (n > 8.3) return { key: 'expo-filtre', why: `L'iris est à f/${fr(n)} : il faut un ND plus dense.` };
    if (n < 3.9) return { key: 'expo-filtre', why: `L'iris est à f/${fr(n)} : le ND est trop dense pour cette lumière.` };
    return null;
  }

  /** chaque étape : faite, maintenant ? */
  const DONE = {
    objectif: () => st.mounted && st.cable,
    fibre: () => st.plugged && st.dirty === 0,
    ccu: () => linkUp() && st.linkChecked,
    viseur: () => st.vfOkAt > 0 && !vfFault(st.bright, st.contrast),
    tirage: () => st.locked && tirageOk(),
    noirs: () => st.abbOk,
    blancs: () => awbValid(),
    expo: () => st.expoAt > st.awbAt && st.expoAt > 0 && !st.bars && !st.card && expoFault() === null && awbValid(),
    zebra: () => st.zebra1 && Math.abs(st.zebraLevel - 70) <= 5,
    scene: () => st.storedAt > 0 && st.storedAt >= Math.max(st.abbAt, st.awbAt, st.expoAt) && DONE.noirs() && DONE.blancs() && DONE.expo(),
  };
  const done = (id) => DONE[id]();
  const complete = () => on && ETAPES.every((e) => done(e.id));

  // ---- les erreurs ----
  const counted = (key) => errors.some((e) => e.key === key);
  /** compte une erreur (une seule fois par sorte de faute) ; renvoie son texte, ou null si déjà comptée */
  function fault(key, extra = {}) {
    if (counted(key)) return null;
    const d = ERREURS[key] || extra; if (!d) return null;
    const e = { key, kind: d.kind, t: extra.t || d.t, why: (extra.pre ? extra.pre + ' ' : '') + (extra.why || d.why), see: extra.see || d.see, at: clock() };
    errors.push(e);
    return e;
  }
  /** les étapes que le geste g demande : la première qui manque fait une erreur d'ordre */
  function order(g) {
    const G = GESTES[g]; if (!G) return null;
    const miss = G.pre.find((id) => !done(id)); if (!miss) return null;
    if (miss === 'objectif') return fault('objectif-tension', { t: `${G.t} avant d'avoir monté et branché l'objectif` });
    if (g === 'awb' && miss === 'noirs') return fault('avant:noirs', { kind: 'ordre', t: 'Balance des blancs avant celle des noirs', why: 'Les noirs sont le zéro des trois voies : faits après, ils décalent la mesure du blanc. Toujours ABB, puis AWB ; une balance des noirs refaite ensuite efface la balance des blancs, qu\'il faut refaire.', see: ETAPE.noirs.see });
    return fault('avant:' + miss, { kind: 'ordre', t: `${G.t} avant ${ETAPE[miss].court}`, why: AVANT[miss], see: ETAPE[miss].see });
  }
  const vfSay = (m, ms = 2500) => { st.vfMsg = m; st.vfMsgUntil = clock() + ms; };

  /**
   * Un geste. Renvoie { ok, msg, err } : ok faux si le geste est refusé (impossible) ; err : les
   * erreurs comptées par ce geste ; msg : ce que dit Olivier ou ce que montre la caméra.
   * @param {string} g @param {any} [v]
   */
  function act(g, v) {
    /** @type {any[]} */ const err = [];
    const push = (e) => { if (e) err.push(e); };
    const no = (msg) => ({ ok: false, msg, err });
    const yes = (msg = '') => { mark(); return { ok: true, msg, err }; };
    const powered = () => head();
    switch (g) {
      // ---- l'objectif ----
      case 'monter': {
        if (st.mounted && st.cable) return no('Débranche d\'abord le câble de l\'objectif.');
        if (powered()) push(fault('objectif-tension'));
        st.mounted = !st.mounted;
        return yes(st.mounted ? 'Objectif présenté sur la monture B4, bague de verrouillage serrée.' : 'Objectif démonté.');
      }
      case 'cable': {
        if (!st.mounted) return no('Monte d\'abord l\'objectif : son câble se branche sur la caméra une fois l\'objectif en place.');
        if (powered()) push(fault('objectif-tension'));
        st.cable = !st.cable;
        return yes(st.cable ? 'Câble de l\'objectif branché (12 broches) : le servo et l\'iris sont reliés à la caméra.' : 'Câble de l\'objectif débranché.');
      }
      case 'zoom': st.z = clamp(Number(v), 0, 1); return yes();
      case 'point': {
        if (!st.locked && !tirageOk() && f() < 8) push(fault('point-large'));
        st.s = clamp(Number(v), 0, 1); return yes();
      }
      case 'ff': {
        if (st.locked) return no('La vis de la bague F.f est bloquée : débloque-la pour tourner la bague.');
        push(order('ff'));
        if (f() > 8) push(fault('tirage-serre'));
        if (N() > 2.85) push(fault('tirage-iris'));
        st.delta = clamp(Number(v), -0.2, 0.2); st.ffMoved = true; return yes();
      }
      case 'vis': {
        if (!st.locked && st.ffMoved && !tirageOk()) push(fault('tirage-vis'));
        st.locked = !st.locked;
        return yes(st.locked ? (tirageOk() ? 'Vis F.f bloquée : le zoom est parfocal, net du large au serré.' : 'Vis F.f bloquée.') : 'Vis F.f débloquée : la bague F.f tourne.');
      }
      // ---- la fibre ----
      case 'nettoyer-cam': case 'nettoyer-ccu': {
        if (st.plugged) return no('La fibre est branchée : on la débranche (CAM PW éteint) avant d\'inspecter un connecteur.');
        if (g === 'nettoyer-cam') st.cleanCam = true; else st.cleanCcu = true;
        return yes(`Connecteur ${g === 'nettoyer-cam' ? 'de la caméra' : 'de la CCU'} inspecté et nettoyé au stylo : la face du verre est propre.`);
      }
      case 'brancher': {
        if (st.ccuOn && st.camPw) push(fault('fibre-tension'));
        if (st.plugged) {
          st.plugged = false; st.cleanCam = st.cleanCcu = false; st.linkChecked = false; st.dirty = 0;
          return yes('Fibre débranchée, bouchons remis. Avant de la rebrancher, on nettoie à nouveau les deux bouts.');
        }
        st.dirty = (st.cleanCam ? 0 : 1) + (st.cleanCcu ? 0 : 1);
        if (st.dirty) push(fault('fibre-sale'));
        st.plugged = true; if (head()) st.bootAt = clock() + dur('boot');
        return yes('Fibre branchée côté caméra et côté CCU, détrompeur aligné, bague vissée.');
      }
      // ---- la CCU et le RCP ----
      case 'ccu-power': {
        st.ccuOn = !st.ccuOn; st.linkChecked = false;
        if (head()) st.bootAt = clock() + dur('boot');
        return yes(st.ccuOn ? 'CCU sous tension ; le RCP s\'allume.' : 'CCU éteinte.');
      }
      case 'cam-pw': {
        if (!st.ccuOn) return no('Le RCP est éteint : la CCU n\'est pas sous tension.');
        if (!st.camPw) push(order('cam-pw'));
        st.camPw = !st.camPw; st.linkChecked = false;
        if (head()) { st.bootAt = clock() + dur('boot'); return yes('CAM PW : la CCU alimente la caméra par la fibre. La caméra démarre.'); }
        return yes(st.camPw ? 'CAM PW allumé, mais la CCU ne voit pas de caméra : rien ne part tant que la fibre n\'est pas branchée.' : 'CAM PW éteint : la caméra n\'est plus alimentée.');
      }
      case 'liaison': {
        if (!head()) return no('La CCU ne reçoit rien : la caméra n\'est pas alimentée.');
        const L = /** @type {number} */ (level());
        if (L < OPT.min || L > OPT.max) { push(fault('liaison-fausse')); return { ok: false, msg: `Niveau optique ${fr(L)} dBm : hors de la plage d'exploitation.`, err }; }
        st.linkChecked = true;
        return yes(`Liaison vérifiée : ${fr(L)} dBm, dans la plage d'exploitation ; référence verrouillée.`);
      }
      case 'bars': {
        if (!ready()) return no('Pas d\'image : la caméra n\'est pas en service.');
        st.bars = !st.bars; return yes(st.bars ? 'BARS : la caméra envoie ses barres de couleur.' : 'BARS éteint : l\'image de la caméra revient.');
      }
      case 'iris': {
        if (!st.ccuOn) return no('Le RCP est éteint.');
        if (!st.cable) return no('L\'objectif n\'est pas branché : l\'iris ne répond pas au RCP.');
        if (st.busy && st.busy.kind === 'ABB') return no('Balance des noirs en cours : l\'iris est fermé.');
        st.iris = clamp(Number(v), 0, 1); return yes();
      }
      case 'gain': {
        if (!st.ccuOn) return no('Le RCP est éteint.');
        const gdb = Number(v);
        if (gdb > 0) push(fault('gain'));
        if (gdb !== st.gain) {
          st.gain = gdb; st.black = [0.002 * (1 + gdb / 6), 0, 0.004 * (1 + gdb / 6)];
          if (st.abbOk) { st.abbOk = false; return yes(`Gain à ${gdb > 0 ? '+' : ''}${gdb} dB : le niveau des noirs a bougé, la balance des noirs est à refaire.`); }
        }
        return yes();
      }
      case 'abb': case 'awb': {
        if (!ready()) return no('La caméra n\'est pas en service.');
        if (st.busy) { const k = st.busy.kind; st.busy = null; vfSay(`${k} : annulé`); return yes(`${k} annulée (seconde pression).`); }
        if (st.bars) { push(fault('balance-barres')); vfSay(`${g.toUpperCase()} : impossible sur les barres`); return no('BARS est allumé : la caméra ne voit pas son image.'); }
        push(order(g));
        if (g === 'abb') { st.busy = { kind: 'ABB', until: clock() + dur('abb') }; tick(); return yes('AUTO BLACK : l\'iris se ferme, la caméra cale le noir de ses trois voies.'); }
        if (st.wbSw === 'PRST') { push(fault('awb-prst')); vfSay('AWB : impossible en PRST'); return no('WHITE BAL est sur PRST.'); }
        if (!st.card) { push(fault('awb-carton')); vfSay('AWB : échec (pas de blanc au centre)'); return no('Pas de charte au centre de l\'image.'); }
        const L = levels();
        if (L.w[1] < 45 || L.max >= 99.6) {
          push(fault('awb-niveau', { pre: L.max >= 99.6 ? 'Une voie est écrêtée sur la parade.' : `Le blanc n'est qu'à ${fr(L.w[1], 0)} %.` }));
          vfSay(L.max >= 99.6 ? 'AWB : échec (blanc écrêté)' : 'AWB : échec (niveau trop bas)');
          return no(L.max >= 99.6 ? 'AWB : échec, le blanc est écrêté.' : 'AWB : échec, le niveau est trop bas.');
        }
        if (st.nd !== V.nd) push(fault('awb-filtre'));
        st.busy = { kind: 'AWB', until: clock() + dur('awb') }; tick();
        return yes(`AUTO WHITE : la caméra mesure le carton et l'enregistre en mémoire ${st.wbSw}.`);
      }
      case 'vf-ok': {
        if (!ready()) return no('Le viseur est noir : la caméra n\'est pas en service.');
        push(order('vf-ok'));
        if (!st.bars) { push(fault('viseur-image')); return no('Le viseur se règle sur les barres : allume BARS au RCP.'); }
        const fv = vfFault(st.bright, st.contrast);
        if (fv) { push(fault('viseur-faux', { pre: `Ici, ${fv}.` })); return no(`Pas encore : ${fv}.`); }
        st.vfOkAt = clock(); return yes('Viseur réglé : le noir est noir, chaque barre se distingue. L\'image envoyée, elle, n\'a pas changé.');
      }
      case 'bright': st.bright = clamp(Number(v), -50, 50); return yes();
      case 'contrast': st.contrast = clamp(Number(v), -50, 50); return yes();
      case 'mag': st.mag = !st.mag; return yes();
      // ---- la caméra ----
      case 'nd': st.nd = Number(v); return yes();
      case 'wbsw': st.wbSw = String(v); return yes();
      case 'ct': st.ct = !st.ct; return yes();
      case 'zebra1': if (!ready()) return no('Caméra éteinte : le menu ne s\'affiche pas.'); st.zebra1 = !st.zebra1; return yes();
      case 'zebra-level': if (!ready()) return no('Caméra éteinte : le menu ne s\'affiche pas.'); st.zebraLevel = clamp(Math.round(Number(v)), 50, 109); return yes();
      case 'scene-no': st.sceneNo = clamp(Math.round(Number(v)), 1, 5); return yes();
      case 'store': {
        if (!ready()) return no('Caméra éteinte : le menu ne s\'affiche pas.');
        push(order('store'));
        st.storedAt = clock(); vfSay(`SCENE FILE ${st.sceneNo} : STORE OK`);
        return yes(`Fichier de scène ${st.sceneNo} enregistré.`);
      }
      // ---- le plateau ----
      case 'card': st.card = !!v; return yes(st.card ? 'Le carton blanc est devant la caméra, sous la lumière du plateau, au centre du cadre.' : 'La mire est revenue devant la caméra.');
      // ---- l'exposition ----
      case 'expo': {
        if (!ready()) return no('La caméra n\'est pas en service.');
        if (st.bars) return no('BARS est allumé : on expose l\'image de la caméra.');
        if (st.card) return no('Le carton est encore devant la caméra : on expose la scène, remets la mire.');
        push(order('expo'));
        const ef = expoFault();
        if (ef) { push(fault(ef.key, { pre: ef.why })); return no(`Pas encore : ${ef.why}`); }
        st.expoAt = clock(); const L = levels();
        return yes(`Exposition validée : f/${fr(N())}, ${ND.find((x) => x[1] === st.nd)[0]}, blanc de la mire à ${fr(L.Y, 0)} %, gain 0 dB.`);
      }
    }
    return no('');
  }
  /** les balances en cours se terminent ; renvoie true si quelque chose a changé */
  function tick() {
    let changed = false;
    if (st.busy && clock() >= st.busy.until) {
      if (st.busy.kind === 'ABB') {
        st.black = [0, 0, 0]; st.abbOk = true; st.abbAt = clock(); vfSay('ABB: OK');
        if (st.awbOk) { st.awbOk = false; st.vfMsg = 'ABB: OK · refaire l\'AWB'; }
      } else { st.mem[st.wbSw] = V.Tl; st.awbOk = true; st.awbAt = clock(); vfSay('AWB: OK'); }
      st.busy = null; changed = true;
    }
    if (st.vfMsg && clock() >= st.vfMsgUntil && !st.busy) { st.vfMsg = ''; changed = true; }
    mark();
    return changed;
  }
  /** le moment où chaque étape a été faite la première fois */
  function mark() { if (!on) return; for (const e of ETAPES) if (firstDone[e.id] == null && done(e.id)) firstDone[e.id] = clock() - t0; }

  return {
    V, errors, firstDone,
    get st() { return st; },
    act, tick, done, complete, ready, head, level, linkUp, tirageOk, levels, expoFault,
    f, dF, N, Nset, E, cast, Tcam,
    start() { t0 = clock(); tEnd = 0; on = true; mark(); },
    started: () => on,
    /** secondes écoulées */
    sec: () => (on ? ((tEnd || clock()) - t0) / 1000 : 0),
    finish() { if (!tEnd) tEnd = Math.max(clock(), t0 + 1e-6); },
    ordre: () => errors.filter((e) => e.kind === 'ordre').length,
    geste: () => errors.filter((e) => e.kind === 'geste').length,
    /** le résultat noté */
    result() {
      const sec = Math.round(this.sec()); const ordre = this.ordre(), geste = this.geste();
      return { ...noteMes({ ordre, geste, sec }), sec, ordre, geste, errs: errors.length, variante: V.id };
    },
    /** remet tout comme au départ (même éclairage) */
    reset() { st = INITIAL(V); errors.length = 0; for (const k of Object.keys(firstDone)) delete firstDone[k]; t0 = tEnd = 0; on = false; },
  };
}

// ==================================================================================
// Le panneau de l'exercice
// ==================================================================================
/** les postes : leur pastille sur la caméra 3D */
const POSTES = [
  { id: 'objectif', nom: 'Objectif', pin: 'monture' },
  { id: 'fibre', nom: 'Fibre', pin: 'fibre' },
  { id: 'ccu', nom: 'CCU', pin: 'ccu' },
  { id: 'rcp', nom: 'RCP', pin: 'rcp' },
  { id: 'camera', nom: 'Caméra', pin: 'commandes' },
  { id: 'viseur', nom: 'Viseur', pin: 'viseur' },
  { id: 'plateau', nom: 'Plateau', pin: 'mire' },
];
const mmss = (s) => `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, '0')} s`;
const clockTxt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pl = (n, one, many) => `${n} ${n > 1 ? many : one}`;

/** les barres du viseur (EBU 75 %, avec un noir) et, dessous, les carrés à −2 et +4 % sur le noir */
function drawVfBars(g, W, H, k, o) {
  const disp = (v) => Math.round(255 * clamp(v * k + o, 0, 1));
  const col = (r, gg, b) => `rgb(${disp(r)},${disp(gg)},${disp(b)})`;
  const bars = [[0.75, 0.75, 0.75], [0.75, 0.75, 0], [0, 0.75, 0.75], [0, 0.75, 0], [0.75, 0, 0.75], [0.75, 0, 0], [0, 0, 0.75], [0, 0, 0]];
  const top = Math.round(H * 0.7);
  bars.forEach((c, i) => { g.fillStyle = col(c[0], c[1], c[2]); g.fillRect(Math.round(i * W / 8), 0, Math.ceil(W / 8) + 1, top); });
  g.fillStyle = col(0, 0, 0); g.fillRect(0, top, W, H - top);
  const pw = W / 10;
  g.fillStyle = col(-0.02, -0.02, -0.02); g.fillRect(pw * 1, top + (H - top) * 0.2, pw, (H - top) * 0.6);
  g.fillStyle = col(0.04, 0.04, 0.04); g.fillRect(pw * 3, top + (H - top) * 0.2, pw, (H - top) * 0.6);
  g.fillStyle = col(1, 1, 1); g.fillRect(pw * 7, top + (H - top) * 0.2, pw * 2, (H - top) * 0.6);
}
/** luminosité et contraste du viseur, appliqués à l'image affichée (pas au signal) */
function applyVf(g, W, H, k, o) {
  if (Math.abs(k - 1) < 1e-3 && Math.abs(o) < 1e-3) return;
  const id = g.getImageData(0, 0, W, H), d = id.data, off = o * 255;
  for (let i = 0; i < d.length; i += 4) { d[i] = d[i] * k + off; d[i + 1] = d[i + 1] * k + off; d[i + 2] = d[i + 2] * k + off; }
  g.putImageData(id, 0, 0);
}

/**
 * Le panneau de la mise en service. ctx : { lens(état) : la caméra 3D, fly(pastille) : approcher
 * la vue d'une pièce, lensOut(t) : objectif écarté de la monture (0 à 1), tally(état),
 * open(id) : ouvrir une fiche, back : { title, go() } pour revenir à la leçon du Cours }.
 * Renvoie { node, dispose, running(), say(texte), engine }.
 * @param {any} ctx
 * @param {{ variante?: string }} [o]
 */
export function renderMes(ctx, o = {}) {
  const M = createMes({ variante: o.variante });
  const node = el('article', { class: 'cl-fiche cm-mes', 'aria-label': 'Mise en service de la caméra' });
  let timer = 0, finished = false, tab = 'objectif', sayErr = false;
  const vf = makeViewfinder(); const sc = scopeCanvas(); let scopeMode = 'luma';
  vf.onFrame((img) => drawScope(sc, M.ready() && img ? img : null, scopeMode));
  vf.canvas.setAttribute('aria-label', 'Le viseur de la caméra');

  // ---- l'écran de départ ----
  const intro = () => {
    const b = mesBest();
    node.replaceChildren(
      el('header', { class: 'cl-fh' }, el('p', { class: 'cl-kick' }, 'Exercice noté · caméra de plateau'), el('h2', {}, 'Mise en service')),
      el('p', { class: 'cl-short' }, 'La caméra du plateau sort de son flight-case : objectif démonté, fibre débranchée, CCU éteinte, viseur déréglé, filtre et balance de la veille. Mets-la en service toi-même, jusqu\'au fichier de scène.'),
      el('div', { class: 'cm-brief' },
        el('p', {}, el('b', {}, 'Éclairage : '), M.V.nom, '. ', M.V.detail),
        el('p', {}, 'Sept postes : l\'objectif, la fibre, la CCU, le RCP de la vision, les commandes et le menu de la caméra, le viseur, le plateau. Les dix étapes sont données dans le désordre : à toi de trouver l\'ordre.'),
        el('p', {}, `Note sur 100 : ${POIDS.ordre} points par erreur d'ordre, ${POIDS.geste} par erreur de geste (une même faute n'est comptée qu'une fois), et 1 point par 30 s au-delà de ${TEMPS.ref / 60} minutes. Réussi à partir de ${MES_SEUIL}.`),
        el('p', { class: 'cs-best' }, b ? `Meilleur résultat : ${b.score} / 100 en ${mmss(b.sec)}, ${pl(b.errs, 'erreur', 'erreurs')}.` : 'Pas encore fait.')),
      el('div', { class: 'cs-row' }, el('button', { type: 'button', class: 'btn primary', 'data-g': 'commencer', onclick: () => begin() }, 'Commencer (le chrono part)')));
    send();
  };

  // ---- l'exercice ----
  const status = el('p', { class: 'cm-status', 'aria-live': 'off' });
  const say = el('p', { class: 'cl-say', 'aria-live': 'polite' });
  const olivier = el('div', { class: 'cl-olivier' }, el('b', {}, 'Olivier'), say);
  const stepsList = el('ol', { class: 'cm-steps' });
  const errList = el('ol', { class: 'cm-errs' });
  const errBox = el('details', { class: 'cm-errbox' }, el('summary', {}, 'Erreurs comptées'), errList);
  const tabBar = el('div', { class: 'cm-tabs', role: 'tablist', 'aria-label': 'Les postes' });
  const panels = {};
  /** @type {(() => void)[]} */ const syncs = [];
  /** un bouton de geste ; label(state) donne son texte, on(state) s'il est enfoncé */
  const gbtn = (g, label, on = null, cls = '') => {
    const b = el('button', { type: 'button', class: 'btn small ' + cls, 'data-g': g, onclick: () => run(g) });
    syncs.push(() => { b.textContent = typeof label === 'function' ? label(M.st) : label; if (on) { const v = on(M.st); b.setAttribute('aria-pressed', String(v)); b.classList.toggle('on', v); } });
    return b;
  };
  /** un curseur de geste */
  const gslider = (g, label, min, max, step, get, out) => {
    const s = slider(label, min, max, step, get(M.st), (v) => run(g, v));
    s.input.setAttribute('data-g', g);
    syncs.push(() => { s.set(get(M.st)); s.out.textContent = out(M.st); });
    return s;
  };
  const gseg = (g, label, options, get) => {
    const s = seg(label, options, get(M.st), (v) => run(g, v));
    for (const b of s.box.children) b.setAttribute('data-g', g);
    syncs.push(() => s.mark(get(M.st)));
    return s;
  };
  const line = (fn) => { const p = el('p', { class: 'cm-st' }); syncs.push(() => { p.textContent = fn(M.st); }); return p; };
  const yesno = (v, a, b) => (v ? a : b);

  // objectif
  const sZoom = gslider('zoom', 'Zoom', 0, 1, 0.001, (s) => s.z, () => `${fr(M.f(), M.f() < 10 ? 1 : 0)} mm`);
  const sPoint = gslider('point', 'Bague de point', 0, 1, 0.0005, (s) => s.s, () => distLabel(M.dF()));
  const sFf = gslider('ff', 'Bague F.f', -0.2, 0.2, 0.0004, (s) => s.delta, () => 'sans graduation');
  sFf.row.classList.add('cl-ff');
  syncs.push(() => { sFf.input.disabled = M.st.locked; });
  panels.objectif = [
    line((s) => `Objectif : ${yesno(s.mounted, 'monté sur la monture B4', 'dans sa housse')} · câble : ${yesno(s.cable, 'branché', 'débranché')}`),
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('monter', (s) => (s.mounted ? 'Démonter l\'objectif' : 'Monter l\'objectif sur la monture')), gbtn('cable', (s) => (s.cable ? 'Débrancher le câble de l\'objectif' : 'Brancher le câble de l\'objectif'))),
    sZoom.row, sPoint.row, sFf.row,
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('vis', (s) => (s.locked ? 'Vis F.f bloquée' : 'Vis F.f débloquée'), (s) => !s.locked)),
  ];
  // fibre
  panels.fibre = [
    line((s) => `Connecteur caméra : ${yesno(s.cleanCam, 'propre', 'à inspecter')} · connecteur CCU : ${yesno(s.cleanCcu, 'propre', 'à inspecter')} · fibre : ${yesno(s.plugged, 'branchée', 'débranchée')}`),
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('nettoyer-cam', 'Inspecter et nettoyer le connecteur de la caméra'), gbtn('nettoyer-ccu', 'Inspecter et nettoyer le connecteur de la CCU')),
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('brancher', (s) => (s.plugged ? 'Débrancher la fibre' : 'Brancher la fibre'))),
    el('p', { class: 'cl-hint' }, 'Câble hybride SMPTE : deux fibres monomodes et le cuivre qui alimente la tête de caméra.'),
  ];
  // CCU
  const ccuDisp = el('pre', { class: 'cm-ccu', 'aria-label': 'Afficheur de la CCU' });
  syncs.push(() => {
    const s = M.st, L = M.level();
    ccuDisp.textContent = !s.ccuOn ? 'CCU HXCU-FB80 · éteinte' : [
      'CCU HXCU-FB80 · sous tension',
      `CAMÉRA : ${M.head() ? 'ALIM. CCU' : s.camPw ? 'CAM PW · PAS DE CAMÉRA' : 'NON ALIMENTÉE'}`,
      `OPT. : ${L == null ? '—' : L <= OPT.decroche ? 'PAS DE SIGNAL' : fr(L) + ' dBm'}`,
      `RÉF. : ${M.linkUp() ? 'LOCK' : '—'}`,
    ].join('\n');
  });
  panels.ccu = [
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('ccu-power', (s) => (s.ccuOn ? 'POWER : éteindre la CCU' : 'POWER : allumer la CCU'), (s) => s.ccuOn)),
    ccuDisp,
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('liaison', 'Liaison vérifiée : niveau dans la plage')),
  ];
  // RCP
  const sIris = gslider('iris', 'IRIS', 0, 1, 0.001, (s) => s.iris, () => irisLabel(M.N(), M.Nset()));
  panels.rcp = [
    line((s) => (s.ccuOn ? 'RCP allumé' + (M.ready() ? ' · caméra en service' : '') : 'RCP éteint (la CCU n\'est pas sous tension)')),
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('cam-pw', 'CAM PW', (s) => s.camPw), gbtn('bars', 'BARS', (s) => s.bars)),
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('abb', 'AUTO BLACK'), gbtn('awb', 'AUTO WHITE')),
    sIris.row,
    gseg('gain', 'MASTER GAIN', [[0, '0 dB'], [3, '+3'], [6, '+6'], [9, '+9'], [12, '+12']], (s) => s.gain).row,
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('expo', 'Exposition faite (forme d\'onde)')),
  ];
  // caméra
  const sZl = gslider('zebra-level', 'ZEBRA1 LEVEL', 50, 109, 1, (s) => s.zebraLevel, (s) => `${s.zebraLevel} %`);
  panels.camera = [
    gseg('nd', 'FILTER', ND.map(([nm, t], i) => [t, `${i + 1} ${nm.replace('ND', ' ND')}`]), (s) => s.nd).row,
    gseg('wbsw', 'WHITE BAL', [['B', 'B'], ['A', 'A'], ['PRST', 'PRST']], (s) => s.wbSw).row,
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('ct', 'COLOR TEMP. 5600K', (s) => s.ct)),
    el('p', { class: 'cm-sub' }, 'Menu OPERATION · O06 ZEBRA'),
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('zebra1', (s) => `ZEBRA1 : ${s.zebra1 ? 'ON' : 'OFF'}`, (s) => s.zebra1)),
    sZl.row,
    el('p', { class: 'cm-sub' }, 'Menu FILE · F02 SCENE FILE'),
    gseg('scene-no', 'Fichier', [1, 2, 3, 4, 5].map((n) => [n, String(n)]), (s) => s.sceneNo).row,
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('store', 'STORE')),
  ];
  // viseur
  panels.viseur = [
    gslider('bright', 'BRIGHT', -50, 50, 1, (s) => s.bright, (s) => (s.bright > 0 ? '+' : '') + s.bright).row,
    gslider('contrast', 'CONTRAST', -50, 50, 1, (s) => s.contrast, (s) => (s.contrast > 0 ? '+' : '') + s.contrast).row,
    el('div', { class: 'cl-row cl-btns cm-btns' }, gbtn('mag', 'MAG ×3', (s) => s.mag), gbtn('vf-ok', 'Viseur réglé')),
    el('p', { class: 'cl-hint' }, 'BRIGHT et CONTRAST ne changent que l\'affichage du viseur : la forme d\'onde, elle, lit l\'image envoyée.'),
  ];
  // plateau
  panels.plateau = [
    el('p', { class: 'cm-st' }, `Éclairage : ${M.V.nom}. La mire est à ${fr(MIRE_D, 0)} m du plan des capteurs.`),
    gseg('card', 'Devant la caméra', [[0, 'La mire'], [1, 'Le carton blanc']], (s) => (s.card ? 1 : 0)).row,
  ];
  // les onglets
  const tabEls = {}, panelEls = {};
  for (const p of POSTES) {
    const b = el('button', { type: 'button', role: 'tab', class: 'cm-tab', 'data-tab': p.id, 'aria-selected': String(p.id === tab), onclick: () => showTab(p.id) }, p.nom);
    tabEls[p.id] = b; tabBar.append(b);
    panelEls[p.id] = el('div', { class: 'cm-panel cl-ctrls', role: 'tabpanel', 'aria-label': p.nom, hidden: p.id !== tab }, ...panels[p.id]);
  }
  function showTab(id) {
    tab = id;
    for (const p of POSTES) { tabEls[p.id].setAttribute('aria-selected', String(p.id === id)); panelEls[p.id].hidden = p.id !== id; }
    const p = POSTES.find((x) => x.id === id); if (p && ctx.fly) ctx.fly(p.pin);
  }
  const scopeSeg = seg('Mesure', [['luma', 'Forme d\'onde'], ['parade', 'Parade']], 'luma', (v) => { scopeMode = String(v); render(); });
  // molette sur le viseur : la bague de point, finement (comme la manipulation du tirage)
  vf.canvas.addEventListener('wheel', (e) => { if (!M.started() || finished) return; e.preventDefault(); run('point', clamp(M.st.s - Math.sign(e.deltaY) * 0.0012, 0, 1)); }, { passive: false });

  function begin() {
    M.reset(); M.start(); finished = false; sayErr = false;
    node.replaceChildren(
      el('header', { class: 'cl-fh' }, el('p', { class: 'cl-kick' }, `Exercice noté · ${M.V.nom}`), el('h2', {}, 'Mise en service')),
      status,
      el('div', { class: 'cm-grid' },
        el('div', { class: 'cm-screens' }, el('div', { class: 'cl-vf' }, vf.canvas, el('div', { class: 'cl-scope' }, sc)), scopeSeg.row),
        el('div', { class: 'cm-desk' }, tabBar, ...POSTES.map((p) => panelEls[p.id]))),
      olivier,
      el('details', { class: 'cm-stepbox', open: true }, el('summary', {}, 'Les dix étapes, dans le désordre'), stepsList),
      errBox,
      el('div', { class: 'cs-row' }, el('button', { type: 'button', class: 'linkbtn', 'data-g': 'abandonner', onclick: () => { stop(); intro(); } }, 'Abandonner (rien n\'est noté)')));
    say.textContent = 'Le chrono tourne. Commence par le poste que tu veux.'; say.className = 'cl-say';
    showTab('objectif');
    if (ctx.lensOut) ctx.lensOut(1);
    if (ctx.tally) ctx.tally('off');
    clearInterval(timer); timer = window.setInterval(() => { if (M.tick()) refresh(); else showStatus(); }, 200);
    refresh();
  }
  function stop() { clearInterval(timer); timer = 0; }

  /** un geste de l'interface : le moteur l'applique, Olivier explique */
  function run(g, v) {
    if (finished || !M.started()) return;
    const r = M.act(g, v);
    if (r.err.length) {
      const e = r.err[r.err.length - 1];
      say.replaceChildren(el('b', {}, `Erreur ${e.kind === 'ordre' ? 'd\'ordre' : 'de geste'} : ${e.t}. `), e.why); say.className = 'cl-say cm-bad'; sayErr = true;
    } else if (r.msg) { say.textContent = r.msg; say.className = 'cl-say' + (r.ok ? '' : ' cm-warn'); sayErr = false; }
    else if (sayErr) { /* l'explication de la dernière erreur reste affichée */ }
    refresh();
  }
  function showStatus() {
    const n = ETAPES.filter((e) => M.done(e.id)).length, ne = M.errors.length;
    status.replaceChildren(el('b', {}, clockTxt(M.sec())), ` · ${pl(ne, 'erreur', 'erreurs')} · ${n} / ${ETAPES.length} étapes`);
  }
  function refresh() {
    for (const s of syncs) s();
    showStatus();
    // les étapes, dans le désordre (ordre alphabétique) ; cochées quand elles sont faites
    const sorted = [...ETAPES].sort((a, b) => a.t.localeCompare(b.t, 'fr'));
    stepsList.replaceChildren(...sorted.map((e) => el('li', { class: M.done(e.id) ? 'done' : '', 'data-step': e.id }, el('span', { class: 'sr' }, M.done(e.id) ? 'fait : ' : 'à faire : '), e.t)));
    errList.replaceChildren(...M.errors.map((e) => el('li', { class: 'cm-e-' + e.kind }, el('b', {}, e.t), el('small', {}, e.kind === 'ordre' ? ` · ordre, −${POIDS.ordre}` : ` · geste, −${POIDS.geste}`))));
    /** @type {HTMLElement} */ (errBox.firstChild).textContent = `Erreurs comptées : ${M.errors.length}`;
    render();
    if (M.complete()) finish();
  }

  /** l'image du viseur, la mesure et la caméra 3D */
  function render() {
    const s = M.st; const fl = M.f(), n = M.N(), ready = M.ready();
    const { k, o: off } = vfTransfer(s.bright, s.contrast);
    const msg = s.busy ? (s.busy.kind === 'ABB' ? 'ABB: EXECUTING' : 'AWB: EXECUTING') : s.vfMsg;
    if (!ready) vf.draw({ f: fl, dF: M.dF(), N: 8, E: 0, osd: false });
    else if (s.bars) vf.draw({ f: fl, dF: M.dF(), N: 8, scene: 'bars', osd: false, overlay: (g, W, H) => drawVfBars(g, W, H, k, off) });
    else {
      vf.draw({
        f: fl, dF: M.dF(), delta: s.mounted ? s.delta : 3, N: isFinite(n) ? n : 99, E: s.mounted ? M.E() : 0.3,
        wb: M.cast(), black: s.black, noise: 0.0012 * Math.pow(10, s.gain / 20), gain: s.gain, nd: s.nd,
        scene: s.card || !s.mounted ? 'card' : 'mire', mag: s.mag, msg,
        zebra: s.zebra1 ? { level: s.zebraLevel, width: 10, band: true } : undefined,
        overlay: (g, W, H) => applyVf(g, W, H, k, off),
      });
    }
    send();
  }
  function send() {
    if (!ctx.lens) return;
    const s = M.st, ready = M.ready(), n = M.N();
    ctx.lens({ zoom: s.z, focus: Math.pow(s.s, 1 / 0.45), iris: isFinite(n) ? n : 99, ff: s.delta, nd: ND.findIndex((x) => x[1] === s.nd),
      light: ready && !s.bars ? M.V.light : 0, gain: s.gain, wb: M.cast(), bars: ready && s.bars, zebra: ready && s.zebra1 ? [s.zebraLevel - 5, s.zebraLevel + 5] : null, mireD: MIRE_D });
    if (ctx.lensOut) ctx.lensOut(s.mounted ? 0 : 1);
  }

  // ---- le bilan ----
  function finish() {
    if (finished) return;
    finished = true; M.finish(); stop();
    const r = M.result(); const record = recordMes(r); const b = mesBest();
    if (ctx.tally) ctx.tally('pvw');
    const see = [...new Set(M.errors.flatMap((e) => e.see))].filter((id) => NOTIONS[id]);
    const order = ETAPES.map((e) => ({ ...e, at: M.firstDone[e.id] }));
    node.replaceChildren(...[
      el('header', { class: 'cl-fh' }, el('p', { class: 'cl-kick' }, `Bilan · ${M.V.nom}`), el('h2', {}, 'Mise en service terminée')),
      el('div', { class: 'cm-bilan', 'data-score': String(r.score) },
        el('p', { class: 'cm-score' + (r.score >= MES_SEUIL ? ' ok' : '') }, el('b', {}, `${r.score} / 100`), ' ', mention(r.score)),
        el('ul', { class: 'cm-calc' },
          el('li', {}, `Temps : ${mmss(r.sec)} (référence ${TEMPS.ref / 60} min)${r.temps ? ` : −${r.temps}` : ''}`),
          el('li', {}, `Erreurs d'ordre : ${r.ordre}${r.ordre ? ` × ${POIDS.ordre} = −${r.pOrdre}` : ''}`),
          el('li', {}, `Erreurs de geste : ${r.geste}${r.geste ? ` × ${POIDS.geste} = −${r.pGeste}` : ''}`)),
        el('p', { class: 'cs-best' }, record ? 'Ton meilleur résultat, enregistré dans ta progression et ton livret.' : b ? `Ton meilleur résultat reste ${b.score} / 100.` : '')),
      M.errors.length ? el('section', { class: 'cl-sec' }, el('h3', {}, 'Tes erreurs'), el('ol', { class: 'cm-errs cm-errs-full' }, ...M.errors.map((e) => el('li', { class: 'cm-e-' + e.kind }, el('b', {}, e.t), el('span', {}, ` (${e.kind === 'ordre' ? 'ordre' : 'geste'}). `), e.why)))) : el('p', { class: 'cs-note' }, 'Aucune erreur : chaque geste au bon moment.'),
      see.length ? el('section', { class: 'cl-sec' }, el('h3', {}, 'À revoir'), el('div', { class: 'cl-see' }, ...see.map((id) => el('button', { type: 'button', class: 'cl-chip' + (NOTIONS[id].prevu ? ' prevu' : ''), 'data-n': id, onclick: () => ctx.open && ctx.open(id) }, NOTIONS[id].t)))) : null,
      el('section', { class: 'cl-sec' }, el('h3', {}, 'L\'ordre d\'une mise en service'),
        el('ol', { class: 'cm-order' }, ...order.map((e) => el('li', {}, e.t, e.at != null ? el('small', {}, ` · faite à ${clockTxt(e.at / 1000)}`) : null)))),
      el('div', { class: 'cs-row' },
        el('button', { type: 'button', class: 'btn small primary', 'data-g': 'recommencer', onclick: () => intro() }, 'Recommencer'),
        ctx.back ? el('button', { type: 'button', class: 'btn small', onclick: () => ctx.back.go() }, `Revenir à la leçon « ${ctx.back.title} »`) : null),
    ].filter(Boolean));
  }

  intro();
  return {
    node, engine: M,
    running: () => M.started() && !finished,
    say(t) { say.textContent = t; say.className = 'cl-say cm-warn'; },
    dispose() { stop(); vf.dispose(); if (ctx.lensOut) ctx.lensOut(0); if (ctx.tally) ctx.tally('off'); },
  };
}
