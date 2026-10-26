// @ts-check
import { camById } from '../state.js';
import { el, fmt } from '../util.js';
import { MIX, TRANS, WIPES, mixCut, mixAuto, dskToggle, ftbToggle, keyToggle, meSource, sourceLabel, frameRate } from '../pipeline.js';
import { mixInputs } from '../equip.js';
import { MIXACT, TRANS_TXT } from '../ui/st_mixer.js';
import { COMMUT, keyLegend, keyModeLabel, mixerOk } from '../ui/commut.js';
import { PUP, TB, ROW_LABEL, lit, leverPos, updateMelangeur3D } from './icp.js';
import { monFrame } from './kit.js';

// ----------------------------------------------------------------------------------
// Le poste « Mélangeur » en vue 3D (poste3d/index.js) devant le pupitre ICP-X7000 (poste3d/icp.js) :
// chaque touche y a sa zone cliquable, son nom et son explication, et appelle les mêmes gestes que la
// vue 2D (MIXACT, ui/st_mixer.js) ; des vues s'approchent de chaque zone du pupitre, dont la fiche
// s'affiche à droite ; l'écran du menu ouvre ses réglages en 2D.
// ----------------------------------------------------------------------------------
PUP.keyMode = keyModeLabel;

const camName = (n) => { const id = meSource(n); if (!id) return 'entrée non utilisée'; const s = sourceLabel(id); if (id.startsWith('CAM')) { const c = camById(+id.slice(3)); return c ? `${s} (${c.T.short})` : `${s} (non installée)`; } return s; };
const ROW_TXT = {
  key: 'Bus de clé (KEY/AUX) : choisit la source que KEY 1 incruste en image dans l\'image. Ne change rien à l\'antenne tant que la clé n\'est pas prise.',
  pgm: 'Bus A (programme) : la source à l\'antenne, tally rouge. Un appui ici commute en direct, sans transition : on ne voit pas avant ce qu\'on envoie.',
  pst: 'Bus B (preset) : la source suivante, préparée à l\'avance, tally vert. Rien ne change à l\'antenne : on vérifie le cadre au moniteur PVW, puis une transition l\'envoie.',
};
const CORNER = { tl: 'haut gauche', tr: 'haut droit', bl: 'bas gauche', br: 'bas droit' };
/** pour chaque touche : nom, classes et texte des zones cliquables (les parcours du chef de car les visent), explication, geste */
function describe(c) {
  switch (c.t) {
    case 'xpt': return { name: `${ROW_LABEL[c.bus]} · entrée ${c.n}`, cls: 'xpt ' + c.bus, aria: `${ROW_LABEL[c.bus]} entrée ${c.n}`, text: `${ROW_LABEL[c.bus]}, entrée ${c.n}`, info: () => `${camName(c.n)}. ${ROW_TXT[c.bus]}${c.n <= 10 ? ` Clavier : ${c.n % 10} (mode ${keyModeLabel()}).` : ''}`, act: () => MIXACT.press(c.bus, c.n), off: () => c.n > mixInputs() || !meSource(c.n) };
    case 'keycut': return { name: 'KEY CUT', cls: 'hw', text: 'KEY CUT', info: 'Prend ou retire la clé 1 d\'un coup, au top image : l\'image incrustée apparaît (ou disparaît) instantanément.', act: () => keyToggle(false) };
    case 'keyauto': return { name: 'KEY AUTO', cls: 'hw', text: 'KEY AUTO', info: 'Fait entrer ou sortir la clé 1 en transition, à la durée affichée. Le fond (BKGD) ne bouge pas.', act: () => keyToggle(true) };
    case 'corner': return { name: `Position : coin ${CORNER[c.k]}`, cls: 'hw', aria: `Coin ${CORNER[c.k]}`, text: 'Coin ' + CORNER[c.k], info: 'Place l\'image incrustée dans ce coin. Sur un vrai pupitre, c\'est le joystick du positionneur qui la déplace.', act: () => MIXACT.corner(c.k) };
    case 'size': return { name: c.d > 0 ? 'Taille +' : 'Taille −', cls: 'hw', text: c.d > 0 ? 'Agrandir l\'incrustation' : 'Réduire l\'incrustation', info: () => `Taille de l'image incrustée : ${Math.round(MIX.key1.size * 100)} % (de 15 à 60 %).`, act: () => MIXACT.size(Math.round(MIX.key1.size * 100) + c.d * 5) };
    case 'dsk': return { name: `DSK ${c.n} ${c.auto ? 'AUTO' : 'CUT'}`, cls: 'hw', text: `DSK ${c.n} ${c.auto ? 'AUTO' : 'CUT'}`, info: `Habillage aval (downstream key) n° ${c.n} : ${c.n === 1 ? 'le score et le chrono' : 'les graphiques (bandeaux, statistiques)'}. Il est au-dessus de tout, ralentis compris ; le clean feed reste sans habillage. ${c.auto ? 'AUTO : entrée ou sortie en fondu.' : 'CUT : d\'un coup.'}`, act: () => dskToggle(c.n, c.auto) };
    case 'ftb': return { name: 'FTB', cls: 'hw', text: 'FTB', info: 'Fade to black : fondu au noir de toute la sortie, DSK compris. En tout début ou toute fin d\'émission seulement.', act: () => ftbToggle() };
    case 'store': return { name: 'STORE', cls: 'hw', text: 'STORE', info: 'Mémoriser : la touche SNAP suivante enregistre l\'état du pupitre (preset, clé, transition, DSK).', act: () => MIXACT.store() };
    case 'snap': return { name: `SNAP ${c.i + 1}`, cls: 'hw', text: `SNAP ${c.i + 1}`, info: () => (MIX.snaps && MIX.snaps[c.i] ? 'Mémoire occupée : un appui rappelle le preset, la clé et la transition, sans toucher au programme.' : 'Mémoire vide : STORE puis cette touche pour y ranger l\'état du pupitre.'), act: () => MIXACT.snap(c.i) };
    case 'next': return { name: `NEXT TRANS · ${c.k === 'bkgd' ? 'BKGD' : 'KEY 1'}`, cls: 'hw', text: c.k === 'bkgd' ? 'BKGD' : 'KEY 1', info: 'Next transition : ce qui change à la prochaine transition, l\'arrière-plan (BKGD), la clé 1, ou les deux.', act: () => MIXACT.next(c.k) };
    case 'wipe': return { name: `Motif : ${WIPES[c.i]}`, cls: 'hw', text: WIPES[c.i].split(' ')[0], info: `Choisit le motif de volet « ${WIPES[c.i]} » (et le type WIPE).`, act: () => MIXACT.wipe(c.i) };
    case 'trans': return { name: TRANS[c.k], cls: 'hw', text: TRANS[c.k], info: TRANS_TXT[c.k] + (c.k === 'mix' ? ' Clavier : X.' : c.k === 'wipe' ? ' Clavier : W.' : c.k === 'stinger' ? ' Clavier : L.' : ''), act: () => MIXACT.trans(c.k) };
    case 'rate': return { name: c.d > 0 ? 'Durée +' : 'Durée −', cls: 'hw', text: c.d > 0 ? 'Allonger la transition' : 'Raccourcir la transition', info: () => `Durée de transition : ${MIX.rate} images = ${fmt(MIX.rate / frameRate(), 2)} s. Chaque appui ${c.d > 0 ? 'ajoute' : 'retire'} 5 images.`, act: () => MIXACT.rate(MIX.rate + c.d * 5) };
    case 'cut': return { name: 'CUT', cls: 'hw big', text: 'CUT', info: 'Coupe : PGM et PST s\'échangent d\'une image à la suivante, sans image intermédiaire. Clavier : Espace ou Entrée.', act: () => { if (mixerOk()) mixCut(); } };
    case 'auto': return { name: 'AUTO TRANS', cls: 'hw big', text: 'AUTO TRANS', info: () => `Déroule la transition choisie (${TRANS[MIX.trans]}) à la durée affichée : ${MIX.rate} images. Clavier : Entrée du pavé numérique.`, act: () => { if (mixerOk()) mixAuto(); } };
    default: return { name: '?', cls: 'hw', text: '', info: '', act: () => {} };
  }
}

// vues : œil et point visé dans le repère du pupitre (le bureau sous son centre), ouverture verticale
const VIEWS = [
  { id: 'poste', label: 'Le poste', eye: [0.02, 0.78, 0.74], look: [0.02, 0.0, -0.08], fov: 55 },
  { id: 'xpt', label: 'Croisements', eye: [-0.05, 0.62, 0.62], look: [-0.05, 0.0, -0.08], fov: 46 },
  { id: 'trans', label: 'Transition', eye: [0.57, 0.52, 0.5], look: [0.58, 0.0, -0.03], fov: 46 },
  { id: 'cles', label: 'Clé et DSK', eye: [-0.17, 0.5, 0.52], look: [-0.17, 0.0, 0.02], fov: 46 },
  { id: 'menu', label: 'Menu · mémoires', eye: [-0.63, 0.5, 0.48], look: [-0.64, 0.0, -0.06], fov: 46 },
  { id: 'ecrans', label: 'Écrans', eye: [-0.25, 0.70, 0.95], look: [-0.55, 0.85, -0.9], fov: 58 },
];
// zones du pupitre : repère (dans le plan du plateau), la vue qui s'en approche, la fiche
const ZONES = [
  { id: 'xpt', at: [-0.05, 0.03, -0.25], view: 'xpt', title: 'Rangées de croisement',
    text: ['Trois rangées, une touche par entrée du mélangeur ; l\'OLED au-dessus affiche le nom de la source (il suit la grille).', '**A · PGM** (rouge) : à l\'antenne. **B · PST** (vert) : la suivante, préparée. **KEY/AUX** (jaune) : la source de l\'incrustation.', 'Le geste de base : préparer sur B, regarder le moniteur PVW, puis CUT ou AUTO TRANS.'] },
  { id: 'trans', at: [0.58, 0.03, -0.24], view: 'trans', title: 'Module de transition',
    text: ['Le type (MIX, WIPE, DIP, DME, CLIP) et sa durée en images, NEXT TRANS (ce qui change : fond, clé, les deux), puis le lancement : **CUT**, **AUTO TRANS** ou la **barre T** à la main.', 'Pendant une transition, les deux sources sont à l\'antenne : leurs deux tallys sont rouges.'] },
  { id: 'cles', at: [-0.1, 0.03, 0.06], view: 'cles', title: 'Clé 1 et habillage aval',
    text: ['**KEY 1** : le redimensionneur 2,5D incruste la source du bus KEY/AUX en image dans l\'image (coin, taille).', '**DSK 1 et 2** : l\'habillage en aval de tout (score, bandeaux) ; **FTB** : le fondu au noir de toute la sortie.'] },
  { id: 'menu', at: [-0.645, 0.03, -0.26], view: 'menu', title: 'Menu et mémoires',
    text: ['L\'écran du menu résume l\'état de la M/E (transition, clé, DSK, format). Touchez-le pour régler la durée, la taille de la clé et le mode du clavier.', '**STORE** puis **SNAP** : mémorise l\'état du pupitre pour le rappeler en une touche (préparé avant le direct).'] },
  { id: 'ecrans', at: [-0.3, 0.75, -0.95], view: 'ecrans', title: 'Les écrans du truquiste',
    text: ['Devant vous, **PGM** (ce qui part à l\'antenne) et **PVW** (le preset) ; à gauche, le **multiview** : toutes les sources, avec leur tally (rouge = à l\'antenne, vert = en preset).', 'Ils sont aussi en direct dans le panneau de droite.'] },
];
const INTRO = { title: 'Le pupitre du truquiste', text: ['Un panneau de commande type **ICP-X7000** qui pilote le processeur **XVS-6000** dans la baie technique.', 'Survolez une touche : son nom et son rôle s\'affichent. Cliquez pour l\'actionner. Glissez pour tourner autour du pupitre, clic droit (ou Maj + glisser) pour le déplacer, molette pour vous approcher ; double-clic pour revenir à la vue.', 'À droite, le multiview, le PGM et le PVW en direct : chaque commutation s\'y voit. Les étiquettes ouvrent la fiche de chaque zone.'] };

export const POSTE_MELANGEUR = {
  id: 'melangeur',
  ready: () => !!PUP.grp,
  root: () => PUP.grp, deck: () => PUP.deck,
  views: VIEWS, zones: ZONES, intro: INTRO,
  // le pupitre fait 1,60 m de large : sur un écran étroit, l'œil peut reculer jusqu'au-dessus de la 2e rangée
  eyeBox: { x: [-2.5, 2.5], y: [0.12, 1.9], z: [-0.9, 1.75] }, rMax: 2.2,
  /** commandes : touches, puis la barre T (glissée) et l'écran du menu (ouvre ses réglages) */
  controls() {
    /** @type {any[]} */
    const keys = PUP.ctrls.map((c) => ({ ...describe(c), i: c.ki, corners: () => PUP.keys.corners(c.ki) }));
    // la barre T et l'écran du menu d'abord : là où une zone en recouvre une autre, la touche (après) l'emporte
    /** @type {any[]} */
    const list = [];
    list.push({ name: 'Barre T', id: 'tbar', cls: 'p3d-tbar', aria: 'Levier de transition', text: 'Barre T', slider: true,
      info: () => `Levier de transition, à la main : ${Math.round(leverPos() * 100)} %. Tirez-le jusqu'à l'autre butée pour finir la transition ; au milieu, les deux images se superposent. Clavier : flèches haut et bas.`,
      corners: () => { const y = 0.035, x0 = TB.x - 0.045, x1 = TB.x + 0.045; return [[x0, y, TB.z0 - 0.02], [x1, y, TB.z0 - 0.02], [x1, y, TB.z1 + 0.02], [x0, y, TB.z1 + 0.02]]; },
      value: leverPos, set: (v) => MIXACT.tbar(v), along: [[TB.x, 0.066, TB.z0], [TB.x, 0.066, TB.z1]] });
    list.push({ name: 'Écran du menu', cls: 'p3d-menu', text: 'Écran du menu', panel: 'menu',
      info: 'L\'écran tactile du pupitre : il résume l\'état de la M/E. Touchez-le pour ses réglages (durée, clé, clavier).',
      corners: () => { const y = 0.0125, x0 = -0.77, x1 = -0.52, z0 = -0.235, z1 = -0.065; return [[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]]; } });
    return list.concat(keys);
  },
  hover(c) { if (!PUP.keys) return; const F = PUP.keys; const old = F.hot; F.hot = c && c.i != null ? c.i : -1; for (const k of [old, F.hot]) if (k >= 0) { const c = PUP.ctrls[k]; F.set(k, -1); const l = lit(c); F.set(k, l < 0 ? 0 : l); } F.flush(); },
  /** les écrans du truquiste, en direct dans le panneau de droite : le multiview, puis PGM et PVW en grand */
  monitors(host) {
    host.append(monFrame('mv', 'Multiview : toutes les sources, tally rouge = PGM, vert = PVW', 'big'),
      el('div', { class: 'p3d-monrow' }, monFrame('PGM', 'PGM · à l\'antenne', 'pgm'), monFrame('PVW', 'PVW · preset', 'pvw')));
    return {};
  },
  /** réglages de l'écran du menu, en 2D sur la fiche */
  panels: { menu: menuPanel },
  key: MIXACT.key,
  legend: () => 'Clavier : ' + keyLegend() + ' · W = WIPE · X = MIX · L = CLIP.',
  update(dt) { updateMelangeur3D(dt); },
};

function menuPanel() {
  const rate = el('input', { type: 'number', min: 0, max: 200, value: MIX.rate, id: 'mixrate', 'aria-label': 'Durée de transition, en images' });
  rate.addEventListener('change', () => MIXACT.rate(rate.value));
  const size = el('input', { type: 'range', min: 15, max: 60, step: 1, value: Math.round(MIX.key1.size * 100), 'aria-label': 'Taille de l\'image incrustée, en pour cent' });
  size.addEventListener('input', () => MIXACT.size(+size.value));
  const km = el('button', { class: 'btn small', onclick: () => MIXACT.keyMode() }, 'Touches 1-9 : ' + keyModeLabel());
  const box = el('div', { class: 'p3d-form' },
    el('label', {}, el('span', {}, 'Durée de transition (images)'), rate),
    el('label', {}, el('span', {}, 'Taille de la clé 1'), size),
    el('div', {}, km));
  return { box, update() { if (document.activeElement !== rate) rate.value = String(MIX.rate); if (document.activeElement !== size) size.value = String(Math.round(MIX.key1.size * 100)); km.textContent = 'Touches 1-9 : ' + keyModeLabel(); km.classList.toggle('on', COMMUT.mode === 'preset'); } };
}
