// @ts-check
import { el, clamp, fmt, tc } from '../util.js';
import { S, camById } from '../state.js';
import { EVS, recordedCams, clipName } from '../pipeline.js';
import { evsLayout } from '../equip.js';
import { LSM, LSMACT, lsmTick, lsmKey, lsmKeyOn, evsScreen, buildEVS } from '../ui/st_evs.js';
import { LSMS, LSM_KEYS, LEVER, JOG, updateLsm3D, hoverLsmKey } from './lsm.js';
import { monFrame } from './kit.js';

// ----------------------------------------------------------------------------------
// Le poste ralentis en vue 3D (poste3d/index.js) devant la télécommande LSM (poste3d/lsm.js) : chaque touche a
// sa zone cliquable (F1 à F10, angles, bloc opérationnel, raccourcis du simulateur), le levier de vitesse se
// pousse (glisser loin de soi = plus vite), la molette jog se tourne (glisser en rond autour d'elle, molette
// de la souris, flèches). Les gestes sont ceux du poste à plat (LSMACT, ui/st_evs.js) ; à droite, en direct,
// les sorties EVS A et EVS B, le programme et l'écran du serveur (trains d'enregistrement, clips, playlist) ;
// « Tous les réglages » contient la télécommande à plat, avec les préréglages du levier.
// ----------------------------------------------------------------------------------
const ch = () => EVS.ch[EVS.lsmCh || 0];
const rect = (x, z, w, d, y) => () => [[x - w / 2, y, z - d / 2], [x + w / 2, y, z - d / 2], [x + w / 2, y, z + d / 2], [x - w / 2, y, z + d / 2]];
/** le nom des touches comme sur la télécommande à plat (les parcours d'Olivier les cherchent par ce texte) */
const TEXT = { LIVE: 'LIVE E/E', FAST: 'FAST JOG', PGM: 'PGM/PRV', LAST: 'DERN. ACTION', AUTO: 'OPÉ. AUTO' };
const INFO = {
  IN: 'IN : marque le début du clip sur l\'image en cours. Avec SHIFT : GOTO IN, la sortie se cale sur le point IN.',
  OUT: 'OUT : marque la fin du clip. Avec SHIFT : GOTO OUT.',
  PLST: 'PLST : mode playlist (les touches F y ajoutent les clips, PLAY la lance). Avec SHIFT : BROWSE, la molette fait défiler les clips.',
  LOOP: 'LOOP : le clip IN-OUT tourne en boucle (écran géant, analyse).',
  RETURN: 'RETURN : quitte les limites du clip, sur la même image du train d\'enregistrement.',
  LIVE: 'LIVE (E/E) : la sortie montre l\'entrée en direct. C\'est l\'état d\'attente entre deux ralentis.',
  PLAY: 'PLAY : lecture à 100 %, vitesse réelle.',
  FAST: 'FAST JOG : la molette va dix fois plus vite (recalage rapide).',
  TAKE: 'TAKE : échange PGM1 et PGM2 (mode 2 PGM), ou envoie à l\'antenne ce qui était préparé sur PRV.',
  PGM: 'PGM/PRV : choisit la sortie pilotée par la télécommande (EVS A ou EVS B).',
  SHIFT: 'SHIFT : la touche suivante donne sa fonction secondaire (inscrite dessous).',
  MENU: 'MENU : menu opérationnel ou secondaire (réglages, modes PGM).',
  CLEAR: 'CLEAR : efface IN et OUT (en mode playlist : vide la playlist).',
  PAGE: 'SHIFT + PAGE, puis une touche F : choisit la page de clips (1 à 10).',
  LAST: 'Raccourci du simulateur : se cale 3 s avant la dernière action notée, IN et OUT posés.',
  REC: 'Enregistrement du serveur : arrêté, plus rien n\'est enregistré et aucun ralenti n\'est possible sur la suite.',
  AUTO: 'Opérateur automatique du simulateur : après chaque action, l\'EVS A se cale tout seul.',
};

function controls() {
  /** @type {any[]} */
  const list = [];
  const rec = recordedCams();
  LSM_KEYS.forEach((k, ki) => {
    const corners = rect(k.x, k.z, k.w, k.d, 0.0085);
    if (k.kind === 'f') {
      list.push({ name: k.name, cls: 'lsm-key', text: k.name, ki, act: () => LSMACT.f(k.i), on: () => !!EVS.clips[(EVS.page - 1) * 10 + k.i], corners,
        info: () => { const idx = (EVS.page - 1) * 10 + k.i, cl = EVS.clips[idx]; return LSM.page ? `Choisit la page ${k.i + 1}.` : cl ? `Clip ${clipName(idx)} (CAM ${cl.cam}, ${fmt(cl.out - cl.in, 1)} s) : un appui le rappelle, calé sur son IN ; SHIFT + F l'écrase.` : 'Touche vide : avec un IN (et un OUT) marqués, un appui crée le clip ici, protégé de l\'écrasement de la boucle.'; } });
    } else if (k.kind === 'cam') {
      const id = rec[k.i];
      list.push({ name: id != null ? `${k.name} (CAM ${id})` : k.name, cls: 'lsm-key', text: k.name, ki, attrs: id != null ? { 'data-id': id } : {}, act: () => { if (id != null) LSMACT.cam(id); }, off: () => id == null, on: () => id != null && ch().cam === id, corners,
        info: () => { const c = id != null ? camById(id) : null; return c ? `Angle ${'ABCDEFGH'[k.i]} : la CAM ${id} (${c.T.short})${c.hfr > 1 ? `, super ralenti ${c.hfr}x (${50 * c.hfr} i/s)` : ''}. Au même timecode que les autres angles : on change d'angle sans perdre l'action.` : 'Pas d\'entrée enregistrée sur cette touche : affecte des entrées REC à la grille.'; } });
    } else {
      list.push({ name: TEXT[k.name] || k.name, cls: 'lsm-key', text: TEXT[k.name] || k.name, ki, act: () => LSMACT.key(k.name), on: () => lsmKeyOn(k.name), corners, info: INFO[k.name] || '' });
    }
  });
  // levier de vitesse : 0 % vers l'opérateur, 100 % loin de lui
  list.push({ name: 'Levier de vitesse', cls: 'lsm-lever-3d', aria: 'Levier de vitesse', slider: true, up: true, step: 0.01, value: () => ch().lever, set: (v) => LSMACT.lever(Math.round(v * 100) / 100),
    info: () => {
      const c = ch(), cam = camById(c.cam), v = c.lever, per = v > 0 && cam ? 1 / (v * cam.hfr) : Infinity;
      return `Levier à ${Math.round(v * 100)} % : le pousser lance la lecture à vitesse variable.${v === 0 ? ' À 0 : image figée.' : cam ? ` La CAM ${cam.id} est enregistrée à ${50 * cam.hfr} i/s : ${per <= 1.05 ? 'chaque image de sortie est différente, le ralenti est fluide' : `chaque image est répétée ≈ ${fmt(per, 1)} fois, le mouvement saccade`}.` : ''} Flèches haut et bas : par 1 %.`;
    },
    along: [[LEVER.x, 0.034, LEVER.z1], [LEVER.x, 0.034, LEVER.z0]], corners: rect(LEVER.x, (LEVER.z0 + LEVER.z1) / 2, 0.05, LEVER.z1 - LEVER.z0 + 0.02, 0.034) });
  // molette jog : sans butée
  list.push({ name: 'Molette jog', cls: 'lsm-jog-3d', aria: 'Molette jog', text: 'JOG', jog: (n) => { LSMS.jogA += n / 35 * 2 * Math.PI; LSMACT.jog(n); },
    info: () => { const c = ch(); return EVS.browse ? 'BROWSE : la molette fait défiler les clips de la base.' : `Molette jog : un tour ≈ 35 images${EVS.fastJog ? ' (FAST JOG : dix fois plus)' : ''}. Tourne-la en glissant autour d'elle (sens des aiguilles d'une montre = vers l'avant), molette de la souris ou flèches. Position ${tc(S.tcOffset + (c.mode === 'live' ? S.simTime : c.t))}, ${fmt(Math.max(0, S.simTime - (c.mode === 'live' ? S.simTime : c.t)), 1)} s derrière le direct.`; },
    corners: rect(JOG.x, JOG.z, JOG.r * 2, JOG.r * 2, 0.017) });
  return list;
}

// vues : œil et point visé dans le repère de la télécommande (x : largeur, z : vers l'opérateur)
const VIEWS = [
  { id: 'poste', label: 'Le poste', eye: [0.0, 0.5, 0.42], look: [0.0, 0.0, -0.02], fov: 50 },
  { id: 'touches', label: 'Les touches', eye: [-0.06, 0.36, 0.2], look: [-0.06, 0.0, -0.03], fov: 46 },
  { id: 'levier', label: 'Levier et jog', eye: [0.15, 0.32, 0.26], look: [0.12, 0.0, 0.01], fov: 44 },
];
const ZONES = [
  { id: 'touches', at: [-0.08, 0.05, -0.04], view: 'touches', title: 'Les touches de la LSM',
    text: ['En haut, l\'**afficheur** : la sortie pilotée (PGM1 = EVS A), l\'angle, le timecode et l\'écart avec le direct, IN et OUT, l\'enregistrement.', 'Les touches **F1 à F10** rangent et rappellent les clips de la page ; les touches **d\'angle** (CAM A à H) changent de caméra au même timecode.', 'Le **bloc opérationnel** : IN et OUT (début et fin du clip), LIVE (retour au direct), PLAY, PLST (playlist), SHIFT (fonction secondaire, inscrite dessous)… Devant, les raccourcis du simulateur : DERN. ACTION, REC, opérateur automatique.'] },
  { id: 'levier', at: [0.13, 0.06, -0.05], view: 'levier', title: 'Le levier et la molette',
    text: ['Le **levier** règle la vitesse de lecture : poussé à fond, 100 % ; à mi-course, 50 %. Le pousser lance le ralenti.', 'Une caméra normale (50 i/s) relue à 33 % répète chaque image trois fois : le mouvement saccade. Une caméra **super ralenti** 3x (150 i/s) reste fluide jusqu\'à 33 %.', 'La **molette jog** avance ou recule image par image (un tour ≈ 35 images) pour poser précisément l\'IN ; FAST JOG la rend dix fois plus rapide.'] },
];
const INTRO = { title: 'Le poste ralentis (EVS)', text: ['La télécommande **LSM** pilote le serveur ralenti : il enregistre en boucle toutes ses caméras sur le même timecode, et l\'opérateur peut revenir en arrière sur n\'importe quel angle.', 'Méthode : la sortie reste en **LIVE** pendant le jeu. Après l\'action : DERN. ACTION (ou jog arrière + IN), choisis l\'angle, puis pousse le levier quand le réalisateur envoie l\'EVS.', 'Survole une commande : son nom et son rôle s\'affichent. Glisse pour tourner autour du pupitre, clic droit (ou Maj + glisser) pour le déplacer, molette pour t\'approcher ; double-clic pour revenir à la vue.', 'À droite, en direct : les sorties EVS A et EVS B, le programme et l\'écran du serveur (trains d\'enregistrement : clique pour te placer). « Tous les réglages » ouvre la télécommande à plat.'] };

export const POSTE_EVS = {
  id: 'evs',
  ready: () => !!LSMS.grp,
  root: () => LSMS.grp, deck: () => LSMS.top,
  views: VIEWS, zones: ZONES, intro: INTRO, detailView: 'touches',
  enter(arg) { EVS.lsmCh = evsLayout().plays < 2 ? 0 : (typeof arg === 'number' ? arg : 0); LSM.shift = false; LSM.page = false; },
  controls, controlsSig: () => recordedCams().join(',') + '|' + evsLayout().plays,
  hover(c) { hoverLsmKey(c && c.ki != null ? c.ki : -1); },
  /** les écrans du poste ralentis, en direct dans le panneau de droite : EVS A, EVS B, programme, écran du serveur */
  monitors(host) {
    const scr = evsScreen();
    const labB = () => (evsLayout().plays < 2 ? 'EVS B (pas de canal en UHD)' : 'EVS B · sortie PGM2');
    const mB = monFrame('EVSB', labB());
    host.append(el('div', { class: 'p3d-monrow three' }, monFrame('EVSA', 'EVS A · sortie PGM1'), mB, monFrame('PGM', 'Programme (PGM)', 'pgm')), scr.el);
    return { update() { scr.update(); const l = mB.querySelector('.lab'); if (l && l.textContent !== labB()) l.textContent = labB(); }, frame() { scr.frame(); } };
  },
  drawer: { label: 'Tous les réglages', note: 'La télécommande à plat : préréglages du levier, mêmes touches', build: (host, arg, ctx) => buildEVS(host, arg, { ...ctx, noMonitors: true }) },
  key(e) { return lsmKey(e, (d) => LSMACT.lever(clamp(Math.round((ch().lever + d) * 100) / 100, 0, 1))); },
  legend: () => 'Levier : pousser = plus vite · molette jog : glisser en rond autour d\'elle, molette de la souris · Espace lecture/pause · I / O · L live · ← → image par image.',
  update(dt) { lsmTick(); updateLsm3D(dt); },
};
