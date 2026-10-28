// @ts-check
import { M } from '../match.js';
import { EVS, canalMedias } from '../pipeline.js';
import { nouveauConducteur, segmentDe, prochain } from './conducteur.js';

// ----------------------------------------------------------------------------------
// L'état de l'émission en cours, partagé par la boucle (index.js), l'équipe virtuelle (ia.js) et les
// panneaux (panneau.js : IPDirector, scripte, téléphone). Pas d'interface ici.
// ----------------------------------------------------------------------------------
export const EMI = {
  /** une émission est en cours (car pré-installé, « Émission en direct ») */
  on: false,
  /** le conducteur (conducteur.js) */
  C: nouveauConducteur(),
  /** instant (S.time) du top antenne, de la fin d'antenne */
  t0: 0, tFin: 0,
  /** relevés pour le compte rendu (conducteur.js, bilan) */
  J: /** @type {import('./conducteur.js').Journal} */ ({ medias: {}, noir: 0, score: 0, retours: [] }),
  /** temps de jeu (s) et temps de jeu avec le score à l'antenne */
  jeu: 0, jeuScore: 0,
  /** temps passé par le joueur à chaque poste pendant l'émission (s) */
  postes: /** @type {Record<string, number>} */ ({}),
  /** fin de chaque média (S.time), pour mesurer le retour au stade */
  finMedia: /** @type {Record<string, number>} */ ({}),
  /** le compte rendu, quand l'émission est finie */
  rapport: /** @type {null | { score: number, lignes: { titre: string, pts: number, max: number, detail: string }[], parVous: number }} */ (null),
  /** ce que fait chaque poste : 'vous', 'ia', ou le pseudo d'un participant (mis à jour par ia.js) */
  qui: /** @type {Record<string, string>} */ ({}),
  /** session à plusieurs : l'état vient de l'hôte */
  suivi: false,
};
/** le canal de diffusion des médias et ce qu'il porte */
export const canalDiffusion = () => EVS.ch[canalMedias()];
export const mediaCharge = () => canalDiffusion().media;
/** ce que voit le conducteur à chaque image */
export function faitsDuCar() {
  const m = mediaCharge();
  return { media: m ? { id: m.id, pos: m.pos, playing: m.playing } : null, periode: M.periode, clock: M.clock, dureePeriode: M.dureePeriode };
}
export const segmentEnCours = () => segmentDe(EMI.C);
export const prochainTop = () => prochain(EMI.C, faitsDuCar());
/** la source du mélangeur qui porte les médias (EVSA ou EVSB) */
export const sourceMedias = () => (canalMedias() ? 'EVSB' : 'EVSA');
