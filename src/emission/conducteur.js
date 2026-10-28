// @ts-check
import { MEDIAS } from './medias.js';

// ----------------------------------------------------------------------------------
// Le conducteur de l'émission en direct : la suite minutée des séquences, du compte à rebours avant
// l'antenne au générique de fin. Calcul pur (testé) : on lui donne le temps écoulé et ce qui se passe
// (le média qui joue sur le canal de diffusion de l'EVS, la période du match), il dit quand passer à la
// séquence suivante. src/emission/index.js l'anime (coup d'envoi, mi-temps…), ia.js le suit.
//
//   attente → générique de début → présentation → 1re période → mi-temps → page de pub → retour au
//   stade → 2e période → fin du match → générique de fin → fin d'antenne
//
// Un média (générique, pub) ne passe pas tout seul : il faut le lancer depuis l'IPDirector au top ; le lancer pendant
// la séquence qui le précède (décompte, mi-temps, fin du match), c'est donner le top soi-même. S'il n'est pas lancé,
// l'émission continue au bout de DUREES.attenteMedia (le média est « manqué »).
// ----------------------------------------------------------------------------------

/** durées en secondes : le compte à rebours avant l'antenne, les séquences sans média, une période de jeu */
export const DUREES_DEFAUT = Object.freeze({ compte: 120, presentation: 15, periode: 600, mitemps: 10, reprise: 12, finmatch: 15, attenteMedia: 20 });
/** @type {{ compte: number, presentation: number, periode: number, mitemps: number, reprise: number, finmatch: number, attenteMedia: number }} */
export const DUREES = { ...DUREES_DEFAUT };
/** change des durées (tests de bout en bout, formateur) ; sans argument, revient aux durées par défaut */
export function setDurees(/** @type {Partial<typeof DUREES>} */ o = {}) {
  Object.assign(DUREES, DUREES_DEFAUT);
  for (const [k, v] of Object.entries(o || {})) if (k in DUREES && Number.isFinite(v) && v > 0) DUREES[/** @type {keyof typeof DUREES} */ (k)] = v;
  return DUREES;
}

/**
 * @typedef {object} Segment
 * @property {string} id
 * @property {string} titre
 * @property {string} quoi ce qui se passe, ce que chacun fait
 * @property {'compte' | 'media' | 'duree' | 'periode' | 'fin'} type
 * @property {string} [media] le média à lancer au top (MEDIAS)
 * @property {'presentation' | 'mitemps' | 'reprise' | 'finmatch'} [cle] sa durée (DUREES)
 * @property {1 | 2} [periode]
 * @property {boolean} antenne à l'antenne (après le top)
 */
/** @type {Segment[]} */
export const SEGMENTS = [
  { id: 'attente', titre: 'Avant l\'antenne', quoi: 'Compte à rebours. Le générique est chargé sur le canal de diffusion de l\'EVS, le truquiste le prépare au preset.', type: 'compte', antenne: false },
  { id: 'generique', titre: 'Générique de début', quoi: 'Top antenne : l\'IPDirector lance le générique, le truquiste le prend à l\'antenne, le son l\'ouvre.', type: 'media', media: 'gen-debut', antenne: true },
  { id: 'presentation', titre: 'Présentation', quoi: 'Retour au stade sur le plan large, titre du match à l\'habillage, les commentateurs ouvrent l\'émission.', type: 'duree', cle: 'presentation', antenne: true },
  { id: 'mt1', titre: '1re période', quoi: 'Coup d\'envoi. Score et chrono à l\'antenne, ralentis après les actions.', type: 'periode', periode: 1, antenne: true },
  { id: 'mitemps', titre: 'Mi-temps', quoi: 'Coup de sifflet : plan large, statistiques à l\'habillage. La pub est chargée à l\'IPDirector.', type: 'duree', cle: 'mitemps', antenne: true },
  { id: 'pub', titre: 'Page de publicité', quoi: 'Top pub : l\'IPDirector lance l\'écran publicitaire, le truquiste le prend, le score sort de l\'image.', type: 'media', media: 'pub', antenne: true },
  { id: 'reprise', titre: 'Retour au stade', quoi: 'Fin de la pub : retour sur le plan large, les commentateurs reprennent l\'antenne.', type: 'duree', cle: 'reprise', antenne: true },
  { id: 'mt2', titre: '2e période', quoi: 'Coup d\'envoi de la seconde période (les équipes ont changé de côté).', type: 'periode', periode: 2, antenne: true },
  { id: 'finmatch', titre: 'Fin du match', quoi: 'Coup de sifflet final : score et statistiques. Le générique de fin est chargé à l\'IPDirector.', type: 'duree', cle: 'finmatch', antenne: true },
  { id: 'generiqueFin', titre: 'Générique de fin', quoi: 'Top générique de fin : l\'IPDirector le lance, le truquiste le prend, puis fondu au noir.', type: 'media', media: 'gen-fin', antenne: true },
  { id: 'fin', titre: 'Fin d\'antenne', quoi: 'Rendu de l\'antenne à la chaîne. Le compte rendu de l\'émission s\'affiche.', type: 'fin', antenne: false },
];
export const segmentById = (/** @type {string} */ id) => SEGMENTS.find((s) => s.id === id) || null;

/**
 * @typedef {object} Conducteur
 * @property {number} i séquence en cours (SEGMENTS)
 * @property {number} t temps passé dans la séquence (s)
 * @property {number} compte compte à rebours avant l'antenne (s)
 * @property {boolean} suspendu compte à rebours arrêté
 * @property {Record<string, number>} lance retard du lancement de chaque média, en secondes après le top (négatif : avant le top), par séquence
 * @property {Record<string, boolean>} manque média jamais lancé (par séquence)
 * @property {boolean} fini
 */
/**
 * @typedef {object} Faits ce qui se passe au car, lu à chaque image
 * @property {{ id: string, pos: number, playing: boolean } | null} media le média chargé sur le canal de diffusion de l'EVS
 * @property {'libre' | 'avant' | 1 | 'mi-temps' | 2 | 'fin'} periode la période du match
 * @property {number} [clock] temps de jeu (s)
 * @property {number} [dureePeriode]
 */
/** @returns {Conducteur} */
export function nouveauConducteur() { return { i: 0, t: 0, compte: DUREES.compte, suspendu: false, lance: {}, manque: {}, fini: false }; }
export const segmentDe = (/** @type {Conducteur} */ E) => SEGMENTS[Math.min(E.i, SEGMENTS.length - 1)];

/**
 * Fait avancer le conducteur de dt secondes.
 * @param {Conducteur} E
 * @param {number} dt
 * @param {Faits} f
 * @returns {{ type: 'segment' | 'lance' | 'manque', id: string, de?: string, retard?: number }[]} ce qui vient de se passer
 */
export function avance(E, dt, f) {
  /** @type {{ type: 'segment' | 'lance' | 'manque', id: string, de?: string, retard?: number }[]} */
  const ev = [];
  if (E.fini) return ev;
  const seg = segmentDe(E);
  const passer = () => {
    const de = seg.id; E.i = Math.min(E.i + 1, SEGMENTS.length - 1); E.t = 0;
    const s = segmentDe(E); if (s.type === 'fin') E.fini = true;
    ev.push({ type: 'segment', id: s.id, de });
  };
  // l'IPDirector lance le média suivant avant son top (pendant le décompte, la mi-temps, la fin du match) : c'est
  // le top, on prend l'antenne sur le générique, on part en pub
  const suiv = SEGMENTS[E.i + 1];
  if ((seg.type === 'compte' || seg.type === 'duree') && suiv && suiv.type === 'media' && f.media && f.media.id === suiv.media && f.media.playing) { passer(); return ev; }
  switch (seg.type) {
    case 'compte':
      if (!E.suspendu) E.compte = Math.max(0, E.compte - dt);
      if (E.compte <= 0) passer();
      break;
    case 'media': {
      E.t += dt;
      const m = f.media && f.media.id === seg.media ? f.media : null;
      const dur = MEDIAS[/** @type {string} */ (seg.media)].duree;
      // retard du lancement par rapport au top (négatif : lancé avant le top)
      if (E.lance[seg.id] == null && m && (m.playing || m.pos > 0.05)) { E.lance[seg.id] = Math.round((E.t - (m.pos || 0)) * 100) / 100; ev.push({ type: 'lance', id: seg.id, retard: E.lance[seg.id] }); }
      if (E.lance[seg.id] != null) { if (!m || m.pos >= dur - 0.04) passer(); }
      else if (E.t >= DUREES.attenteMedia) { E.manque[seg.id] = true; ev.push({ type: 'manque', id: seg.id }); passer(); }
      break;
    }
    case 'duree':
      E.t += dt;
      if (E.t >= DUREES[/** @type {'presentation'} */ (seg.cle)]) passer();
      break;
    case 'periode':
      E.t += dt;
      if (f.periode === (seg.periode === 1 ? 'mi-temps' : 'fin')) passer();
      break;
    default: break;
  }
  return ev;
}
/** l'antenne tout de suite (le compte à rebours est sauté) */
export function antenneMaintenant(/** @type {Conducteur} */ E) { if (segmentDe(E).type === 'compte') E.compte = 0; }
/** arrêter ou reprendre le compte à rebours */
export function suspendre(/** @type {Conducteur} */ E, v = !E.suspendu) { E.suspendu = !!v; return E.suspendu; }

/**
 * Le prochain top : ce qui arrive, et dans combien de secondes (null : il attend une action, un média à lancer).
 * @param {Conducteur} E
 * @param {Faits} f
 * @returns {{ titre: string, dans: number | null } | null}
 */
export function prochain(E, f) {
  const seg = segmentDe(E); const suiv = SEGMENTS[E.i + 1];
  switch (seg.type) {
    case 'compte': return { titre: 'Top antenne : générique de début', dans: E.compte };
    case 'media': {
      const m = f.media && f.media.id === seg.media ? f.media : null; const M_ = MEDIAS[/** @type {string} */ (seg.media)];
      if (E.lance[seg.id] == null) return { titre: `Lancer : ${M_.nom.toLowerCase()}`, dans: null };
      return { titre: suiv ? suiv.titre : 'Fin', dans: Math.max(0, M_.duree - (m ? m.pos : M_.duree)) };
    }
    case 'duree': {
      const reste = Math.max(0, DUREES[/** @type {'presentation'} */ (seg.cle)] - E.t);
      const titre = suiv && suiv.type === 'media' ? `Top ${MEDIAS[/** @type {string} */ (suiv.media)].nom.toLowerCase()}` : suiv && suiv.type === 'periode' ? 'Coup d\'envoi' : suiv ? suiv.titre : 'Fin';
      return { titre, dans: reste };
    }
    case 'periode': {
      const dp = f.dureePeriode || DUREES.periode;
      const fin = seg.periode === 1 ? dp : 2 * dp;
      const avant = f.periode === 'avant' || (seg.periode === 2 && f.periode === 'mi-temps');
      return { titre: seg.periode === 1 ? 'Mi-temps' : 'Fin du match', dans: avant ? null : Math.max(0, fin - (f.clock || 0)) };
    }
    default: return null;
  }
}

/**
 * @typedef {object} Journal ce qu'a relevé src/emission/index.js pendant l'émission
 * @property {Record<string, { retard: number | null, antenne: number, par: string }>} medias par média : retard du lancement (s, null = jamais lancé),
 *   part du média passée à l'antenne (0 à 1), qui l'a lancé ('vous', 'ia' ou un pseudo)
 * @property {number} noir secondes d'image en défaut à l'antenne (noir, mire, perte de signal), du top à la fin
 * @property {number} score part du temps de jeu avec le score à l'antenne (0 à 1)
 * @property {number[]} retours délai (s) du retour au stade après le générique de début et après la pub (Infinity si jamais)
 */
/**
 * Le compte rendu noté sur 100 de la conduite de l'émission (calcul pur).
 * @param {Journal} J
 * @returns {{ score: number, lignes: { titre: string, pts: number, max: number, detail: string }[], parVous: number }}
 */
export function bilan(J) {
  const lignes = [];
  const fr = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  for (const id of ['gen-debut', 'pub', 'gen-fin']) {
    const r = (J.medias || {})[id] || { retard: null, antenne: 0, par: '' };
    const nom = MEDIAS[id].nom;
    const ecart = r.retard == null ? Infinity : Math.abs(r.retard);
    const pl = ecart <= 2 ? 15 : ecart <= 5 ? 10 : ecart <= 10 ? 5 : 0;
    lignes.push({ titre: `${nom} : lancé au top`, pts: pl, max: 15, detail: r.retard == null ? 'jamais lancé' : `${fr(Math.abs(r.retard))} s ${r.retard < 0 ? 'avant' : 'après'} le top${r.par ? ' (' + (r.par === 'vous' ? 'par vous' : r.par === 'ia' ? 'par l\'équipe virtuelle' : 'par ' + r.par) + ')' : ''}` });
    const pa = Math.round(10 * Math.max(0, Math.min(1, r.antenne || 0)));
    lignes.push({ titre: `${nom} : à l'antenne`, pts: pa, max: 10, detail: `${Math.round(100 * Math.max(0, Math.min(1, r.antenne || 0)))} % du média diffusé` });
  }
  const noir = Math.max(0, J.noir || 0);
  lignes.push({ titre: 'Pas de noir ni de mire à l\'antenne', pts: Math.max(0, 15 - Math.floor(noir / 2)), max: 15, detail: `${fr(noir)} s d'image en défaut` });
  lignes.push({ titre: 'Score et chrono à l\'antenne pendant le jeu', pts: Math.round(5 * Math.max(0, Math.min(1, J.score || 0))), max: 5, detail: `${Math.round(100 * Math.max(0, Math.min(1, J.score || 0)))} % du temps de jeu` });
  const ret = (J.retours || []).slice(0, 2); while (ret.length < 2) ret.push(Infinity);
  const okRet = ret.filter((d) => d <= 3).length;
  lignes.push({ titre: 'Retour au stade à la fin des médias', pts: Math.round(2.5 * okRet), max: 5, detail: ret.map((d, k) => `${k ? 'après la pub' : 'après le générique'} : ${Number.isFinite(d) ? fr(d) + ' s' : 'non'}`).join(' · ') });
  const score = lignes.reduce((a, l) => a + l.pts, 0);
  const parVous = ['gen-debut', 'pub', 'gen-fin'].filter((id) => ((J.medias || {})[id] || {}).par === 'vous').length;
  return { score, lignes, parVous };
}
/** une émission réussie : 60 sur 100 ; « seule » quand les trois médias ont été lancés par le stagiaire lui-même */
export const SEUIL_EMISSION = 60;
