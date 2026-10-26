// @ts-check
import { VUE_SDI_TRAME } from './vues/sdi_trame.js';
import { VUE_SDI_OEIL } from './vues/sdi_oeil.js';
import { VUE_SDI_BRASSAGE } from './vues/sdi_brassage.js';
import { VUE_RESEAU_MAC } from './vues/reseau_mac.js';
import { VUE_RESEAU_VLAN } from './vues/reseau_vlan.js';
import { VUE_RESEAU_PASSERELLE } from './vues/reseau_passerelle.js';
import { VUE_RESEAU_MULTICAST } from './vues/reseau_multicast.js';
import { VUE_RESEAU_PTP } from './vues/reseau_ptp.js';
import { VUE_ST2110_FLUX } from './vues/st2110_flux.js';
import { VUE_ST2110_PAQUET } from './vues/st2110_paquet.js';
import { VUE_ST2110_ROUGEBLEU } from './vues/st2110_rougebleu.js';
import { VUE_SYNCHRO_GENLOCK } from './vues/synchro_genlock.js';
import { VUE_CAMERA_FIBRE } from './vues/camera_fibre.js';
import { VUE_HF_STADE } from './vues/hf_stade.js';

// ----------------------------------------------------------------------------------
// Le catalogue des vues 3D du Cours : chaque vue est un fichier de vues/ (ses étapes, ses commandes,
// sa scène). Une vue est rattachée à un chapitre du Cours et à une ou plusieurs leçons : le bouton
// « Voir en 3D » d'une leçon ouvre la vue à la première étape tirée de cette leçon (etape.lecon),
// sinon à la première. L'ordre de la liste est celui du Cours.
// ----------------------------------------------------------------------------------
/**
 * @typedef {object} Etape
 * @property {string} t titre
 * @property {string} texte explication (texte riche de ui/rich.js)
 * @property {{ cible: number[], dir: number[], dist: number }} [vue] point de vue de l'étape
 * @property {string} [lecon] la leçon dont l'étape est tirée (« Voir en 3D » de cette leçon y mène)
 */
/**
 * @typedef {object} Vue3d
 * @property {string} id
 * @property {string} chapitre chapitre du Cours (cours/index.js)
 * @property {string[]} [aussi] autres chapitres où la vue est proposée
 * @property {string} titre
 * @property {string} resume une phrase
 * @property {string[]} lecons leçons du Cours dont la vue montre les notions (la première est sa leçon principale)
 * @property {Etape[]} etapes
 * @property {{ cible: number[], dir: number[], dist: number }} vue point de vue d'ensemble
 * @property {string[]} [lectures] lectures chiffrées affichées dans le panneau
 * @property {string} [depart] premier message du panneau
 * @property {{ rMin?: number, rMax?: number, phiMin?: number, phiMax?: number }} [orbite]
 * @property {{ sol?: boolean, fond?: number, brume?: number[] }} [decor]
 * @property {(ctx: any) => any} build
 */
/** @type {Vue3d[]} */
export const VUES = [VUE_SDI_TRAME, VUE_SDI_OEIL, VUE_SDI_BRASSAGE, VUE_SYNCHRO_GENLOCK, VUE_CAMERA_FIBRE, VUE_RESEAU_MAC, VUE_RESEAU_VLAN, VUE_RESEAU_PASSERELLE, VUE_RESEAU_MULTICAST, VUE_RESEAU_PTP, VUE_ST2110_FLUX, VUE_ST2110_PAQUET, VUE_ST2110_ROUGEBLEU, VUE_HF_STADE];

/** nom de l'entrée « … en 3D » de chaque chapitre, dans le sommaire du Cours */
export const CHAP3D = { sdi: 'Le SDI en 3D', synchro: 'La synchro en 3D', camera: 'La fibre en 3D', reseau: 'Le réseau en 3D', hf: 'La HF en 3D' };

export const vueById = (id) => VUES.find((v) => v.id === id) || null;
/** les vues d'un chapitre (la sienne, et celles qui y sont aussi rangées : la vue PTP l'est dans La synchro) */
export const vuesDuChapitre = (chap) => VUES.filter((v) => v.chapitre === chap || (v.aussi || []).includes(chap));
/** les vues qui montrent une leçon */
export const vuesDeLecon = (lessonId) => VUES.filter((v) => v.lecons.includes(lessonId));
/** la première étape tirée de la leçon (0 sinon) */
export function etapeDeLecon(vue, lessonId) { const i = vue.etapes.findIndex((e) => e.lecon === lessonId); return i < 0 ? 0 : i; }
