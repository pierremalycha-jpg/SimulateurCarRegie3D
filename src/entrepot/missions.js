// @ts-check
// ----------------------------------------------------------------------------------
// Les cahiers des charges de l'entrepôt : ce que le client demande, ce que le moteur doit
// constater pour que ce soit réussi, la note. Une mission = une liste d'exigences, chacune
// vérifiée sur le montage (build) et le résultat du moteur (Eval) ; une exigence peut être
// « acquise », « partielle » ou « manquante », avec une explication en français. Le bac à sable
// (id '') n'a pas d'exigence. Le rédacteur « moteur » écrit les exigences (voir le brief) ;
// ci-dessous le gabarit et la première mission, annoncée.
// ----------------------------------------------------------------------------------
/** @typedef {import('./types.js').Build} Build */
/** @typedef {import('./types.js').Eval} Eval */
/**
 * @typedef {object} Exigence
 * @property {string} id
 * @property {string} label ce que demande le client, en une ligne
 * @property {number} pts points
 * @property {(B: Build, E: Eval) => { ok: boolean, partiel?: boolean, why: string }} test
 */
/**
 * @typedef {object} Mission
 * @property {string} id
 * @property {string} titre
 * @property {string} client qui commande (une association, un lycée, une salle…)
 * @property {string} brief le cahier des charges, en quelques phrases
 * @property {string[]} contraintes ce qu'il faut respecter (budget, place, délai…)
 * @property {number} [budget] euros HT (ordre de grandeur) : la somme des prix du catalogue ne doit pas le dépasser
 * @property {Exigence[]} exigences
 * @property {string[]} competences codes du référentiel TIEE
 * @property {string} niveau 'découverte' | 'intermédiaire' | 'avancé'
 * @property {string} duree '20 min'…
 */

/** @type {Mission[]} */
export const MISSIONS = [
  {
    id: 'conference', titre: 'Conférence à trois caméras PTZ', client: 'Le lycée, pour la cérémonie de remise des diplômes',
    brief: 'Trois caméras PTZ pilotées depuis un seul pupitre, un mélangeur, l\'enregistrement du programme et le micro de la salle embarqué dans l\'image. La régie tient dans une baie mobile et sur une table.',
    contraintes: ['Une seule personne au pupitre : les trois caméras se pilotent depuis le même AW-RP150, et leur tally s\'allume.', 'Le programme est enregistré sur un HyperDeck.', 'Le micro XLR de la salle arrive dans le programme par un Teranex (embedder).', 'Toutes les adresses IP sont fixes et dans le même sous-réseau.'],
    budget: 25000, niveau: 'intermédiaire', duree: '30 min', competences: ['2.1', '2.7', '2.9', '2.10', '3.9'],
    exigences: [],
  },
];
export const missionById = (/** @type {string} */ id) => MISSIONS.find((m) => m.id === id) || null;

/**
 * Note une mission sur 100 : points des exigences acquises (la moitié pour une exigence partielle),
 * et le budget s'il y en a un.
 * @returns {{ score: number, total: number, items: Array<{ id: string, label: string, pts: number, ok: boolean, partiel: boolean, why: string }>, budget: { max: number, used: number, ok: boolean } | null }}
 */
export function noter(/** @type {Mission} */ m, /** @type {Build} */ B, /** @type {Eval} */ E, /** @type {Record<string, import('./types.js').Modele>} */ CAT) {
  const items = m.exigences.map((x) => { const r = x.test(B, E); return { id: x.id, label: x.label, pts: x.pts, ok: !!r.ok, partiel: !!r.partiel && !r.ok, why: r.why || '' }; });
  const total = items.reduce((s, i) => s + i.pts, 0) || 1;
  const got = items.reduce((s, i) => s + (i.ok ? i.pts : i.partiel ? i.pts / 2 : 0), 0);
  const used = B.appareils.reduce((s, a) => s + ((CAT[a.modele] || {}).prix || 0), 0);
  const budget = m.budget ? { max: m.budget, used, ok: used <= m.budget } : null;
  let score = Math.round(got / total * 100);
  if (budget && !budget.ok) score = Math.max(0, score - 10);
  return { score, total, items, budget };
}
