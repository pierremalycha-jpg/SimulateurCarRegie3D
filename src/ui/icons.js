// @ts-check
// ----------------------------------------------------------------------------------
// Icônes de l'interface : jeu Phosphor (licence MIT, phosphoricons.com), graisse « bold ». Les
// fichiers SVG sont intégrés à la page à la construction (chargeur texte d'esbuild) : tout marche
// hors ligne. Une icône accompagne toujours un texte : elle est masquée aux lecteurs d'écran.
// ----------------------------------------------------------------------------------
import iSquaresFour from '@phosphor-icons/core/bold/squares-four-bold.svg';
import iHeadset from '@phosphor-icons/core/bold/headset-bold.svg';
import iSpeakerHigh from '@phosphor-icons/core/bold/speaker-high-bold.svg';
import iSpeakerSlash from '@phosphor-icons/core/bold/speaker-slash-bold.svg';
import iUsersThree from '@phosphor-icons/core/bold/users-three-bold.svg';
import iMapTrifold from '@phosphor-icons/core/bold/map-trifold-bold.svg';
import iTreeStructure from '@phosphor-icons/core/bold/tree-structure-bold.svg';
import iToolbox from '@phosphor-icons/core/bold/toolbox-bold.svg';
import iBookOpenText from '@phosphor-icons/core/bold/book-open-text-bold.svg';
import iAirplaneTilt from '@phosphor-icons/core/bold/airplane-tilt-bold.svg';
import iMonitorPlay from '@phosphor-icons/core/bold/monitor-play-bold.svg';
import iGearSix from '@phosphor-icons/core/bold/gear-six-bold.svg';
import iStethoscope from '@phosphor-icons/core/bold/stethoscope-bold.svg';
import iFilmSlate from '@phosphor-icons/core/bold/film-slate-bold.svg';
import iSlidersHorizontal from '@phosphor-icons/core/bold/sliders-horizontal-bold.svg';
import iClipboardText from '@phosphor-icons/core/bold/clipboard-text-bold.svg';
import iTextAa from '@phosphor-icons/core/bold/text-aa-bold.svg';
import iBriefcase from '@phosphor-icons/core/bold/briefcase-bold.svg';
import iAperture from '@phosphor-icons/core/bold/aperture-bold.svg';
import iRewind from '@phosphor-icons/core/bold/rewind-bold.svg';
import iPlaylist from '@phosphor-icons/core/bold/playlist-bold.svg';
import iWaveform from '@phosphor-icons/core/bold/waveform-bold.svg';
import iVideoCamera from '@phosphor-icons/core/bold/video-camera-bold.svg';
import iGridNine from '@phosphor-icons/core/bold/grid-nine-bold.svg';
import iCpu from '@phosphor-icons/core/bold/cpu-bold.svg';
import iNetwork from '@phosphor-icons/core/bold/network-bold.svg';
import iHardDrives from '@phosphor-icons/core/bold/hard-drives-bold.svg';
import iGlobeSimple from '@phosphor-icons/core/bold/globe-simple-bold.svg';
import iMetronome from '@phosphor-icons/core/bold/metronome-bold.svg';
import iChatsTeardrop from '@phosphor-icons/core/bold/chats-teardrop-bold.svg';
import iPlugs from '@phosphor-icons/core/bold/plugs-bold.svg';
import iSpeakerHifi from '@phosphor-icons/core/bold/speaker-hifi-bold.svg';
import iBroadcast from '@phosphor-icons/core/bold/broadcast-bold.svg';
import iTruck from '@phosphor-icons/core/bold/truck-bold.svg';
import iSoccerBall from '@phosphor-icons/core/bold/soccer-ball-bold.svg';
import iDoorOpen from '@phosphor-icons/core/bold/door-open-bold.svg';
import iTShirt from '@phosphor-icons/core/bold/t-shirt-bold.svg';
import iBinoculars from '@phosphor-icons/core/bold/binoculars-bold.svg';
import iFlagPennant from '@phosphor-icons/core/bold/flag-pennant-bold.svg';
import iUsersFour from '@phosphor-icons/core/bold/users-four-bold.svg';
import iLightbulb from '@phosphor-icons/core/bold/lightbulb-bold.svg';
import iCellTower from '@phosphor-icons/core/bold/cell-tower-bold.svg';
import iDrone from '@phosphor-icons/core/bold/drone-bold.svg';
import iUser from '@phosphor-icons/core/bold/user-bold.svg';
import iCompass from '@phosphor-icons/core/bold/compass-bold.svg';
import iWrench from '@phosphor-icons/core/bold/wrench-bold.svg';
import iChalkboardTeacher from '@phosphor-icons/core/bold/chalkboard-teacher-bold.svg';
import iCheckCircle from '@phosphor-icons/core/bold/check-circle-bold.svg';
import iHandPointing from '@phosphor-icons/core/bold/hand-pointing-bold.svg';
import iLightbulbFilament from '@phosphor-icons/core/bold/lightbulb-filament-bold.svg';
import iPulse from '@phosphor-icons/core/bold/pulse-bold.svg';
import iStar from '@phosphor-icons/core/bold/star-bold.svg';
import iWarning from '@phosphor-icons/core/bold/warning-bold.svg';
import iRecord from '@phosphor-icons/core/bold/record-bold.svg';
import iMinus from '@phosphor-icons/core/bold/minus-bold.svg';
import iCornersOut from '@phosphor-icons/core/bold/corners-out-bold.svg';
import iX from '@phosphor-icons/core/bold/x-bold.svg';
import iGraduationCap from '@phosphor-icons/core/bold/graduation-cap-bold.svg';
import iBookBookmark from '@phosphor-icons/core/bold/book-bookmark-bold.svg';
import iUserGear from '@phosphor-icons/core/bold/user-gear-bold.svg';
import iSealCheck from '@phosphor-icons/core/bold/seal-check-bold.svg';
import iKeyboard from '@phosphor-icons/core/bold/keyboard-bold.svg';
import iNotebook from '@phosphor-icons/core/bold/notebook-bold.svg';
import iTarget from '@phosphor-icons/core/bold/target-bold.svg';
import iList from '@phosphor-icons/core/bold/list-bold.svg';
import iHouse from '@phosphor-icons/core/bold/house-bold.svg';
import iPlay from '@phosphor-icons/core/bold/play-bold.svg';
import iCube from '@phosphor-icons/core/bold/cube-bold.svg';

/** nom dans l'application -> dessin SVG @type {Record<string, string>} */
const SVG = {
  pupitre: iSquaresFour, chef: iHeadset, son: iSpeakerHigh, muet: iSpeakerSlash,
  equipe: iUsersThree, plan: iMapTrifold, synoptiques: iTreeStructure, materiel: iToolbox,
  guide: iBookOpenText, vol: iAirplaneTilt, retour: iMonitorPlay, reglages: iGearSix,
  diagnostic: iStethoscope, realisateur: iFilmSlate, melangeur: iSlidersHorizontal, scripte: iClipboardText,
  habillage: iTextAa, producteur: iBriefcase, vision: iAperture, evs: iRewind,
  ipdirector: iPlaylist, mixage: iWaveform, ccu: iVideoCamera, grille: iGridNine,
  processeur: iCpu, reseau: iNetwork, serveur: iHardDrives, transmission: iGlobeSimple,
  synchro: iMetronome, intercom: iChatsTeardrop, brassage: iPlugs, audio: iSpeakerHifi,
  hf: iBroadcast, car: iTruck, terrain: iSoccerBall, tunnel: iDoorOpen,
  vestiaires: iTShirt, passerelle: iBinoculars, but: iFlagPennant, kop: iUsersFour,
  pylone: iLightbulb, toit: iCellTower, aerien: iDrone, equipier: iUser,
  'prise-en-main': iCompass, exploitation: iWrench, postes: iChalkboardTeacher, fait: iCheckCircle,
  a_toi: iHandPointing, indice: iLightbulbFilament, bravo: iStar, alarme: iWarning,
  antenne: iRecord, reduire: iMinus, agrandir: iCornersOut, fermer: iX,
  // les lieux (content/lieux.js)
  hautparleur: iSpeakerHifi, lumiere: iLightbulbFilament,
  mesure: iPulse, // baie de mesure (PRISM)
  // les cinq familles du menu et leurs outils (app/title.js, ui/pupitre.js, ui/cours_ui.js)
  cours: iGraduationCap, lexique: iBookBookmark, formateur: iUserGear, relecture: iSealCheck, commandes: iKeyboard, livret: iNotebook,
  // le menu du car (app/nav.js) et l'espace du chef de car (ui/entrainement.js)
  entrainement: iTarget, menu: iList, accueil: iHouse, reprendre: iPlay, cube: iCube,
};
export const ICON_NAMES = Object.keys(SVG);
/**
 * Une icône prête à placer devant un libellé (span.ico, taille du texte, couleur du texte).
 * @param {string} name
 * @param {string} [cls]
 * @returns {HTMLSpanElement}
 */
export function icon(name, cls = '') {
  const s = document.createElement('span');
  s.className = 'ico' + (cls ? ' ' + cls : '');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = SVG[name] || '';
  return s;
}
