// @ts-check
// ----------------------------------------------------------------------------------
// Journal des erreurs de l'application : erreurs non rattrapées, promesses rejetées, erreurs
// d'un écouteur d'événement (bus de state.js), d'une image de la boucle de rendu, et messages
// console.error (erreurs de shaders de three.js par exemple). Chaque erreur est gardée une fois,
// avec l'endroit où elle s'est produite et son nombre de répétitions. Le journal est le même
// tableau que celui du filet de chargement (src/boot.js) : rien n'est perdu entre les deux.
// L'interface (ui/diag_ui.js) l'affiche et en fait un diagnostic à copier.
// Sans dépendance : importé très tôt (par state.js), y compris par les tests unitaires (Node).
// ----------------------------------------------------------------------------------
export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';

/** @typedef {{ kind: string, where: string, msg: string, stack: string, src?: string, line?: number, col?: number, t: number, n: number }} DiagError */
const W = /** @type {any} */ (typeof window !== 'undefined' ? window : {});
/** @type {DiagError[]} */
export const ERRS = (W.__carErrs = W.__carErrs || []);
/** @type {((e: DiagError, isNew: boolean) => void)[]} */
const subs = [];

// sans intérêt pour le stagiaire : extensions du navigateur, boucle de ResizeObserver
// (avertissement bénin des navigateurs)
const NOISE = /ResizeObserver loop/;
// « Script error. » : le navigateur a masqué le détail (Safari, page ouverte comme fichier) ;
// gardée et signalée, avec cette explication (les gestes et la boucle de rendu, eux, sont notés
// à la source avec leur message)
const MASKED = /^(Uncaught )?Script error\.?$/;
const EXT = /(chrome|moz|safari|safari-web)-extension:\/\//;

/** les erreurs qui méritent d'être signalées à l'écran */
export const visible = (/** @type {DiagError} */ e) => e.kind === 'erreur' || e.kind === 'promesse' || e.kind === 'console';

function add(o) {
  const e = { kind: o.kind || 'erreur', where: o.where || '', msg: String(o.msg || '').slice(0, 600), stack: String(o.stack || '').slice(0, 4000), src: o.src || '', line: o.line || 0, col: o.col || 0, t: o.t || Date.now(), n: o.n || 1 };
  if (e.kind !== 'ressource' && (NOISE.test(e.msg) || EXT.test(e.src) || EXT.test(e.stack))) e.kind = 'bruit';
  else if (MASKED.test(e.msg)) e.msg = 'Erreur sans détail (le navigateur en a masqué le message)';
  const same = ERRS.find((x) => x !== o && x.msg === e.msg && x.where === e.where && x.kind === e.kind);
  if (same) { same.n++; same.t = e.t; } else { if (ERRS.length >= 80) ERRS.splice(0, 1); ERRS.push(e); }
  for (const f of subs) { try { f(same || e, !same); } catch (er) { /* l'affichage ne doit pas boucler sur lui-même */ } }
  return same || e;
}

/**
 * Note une erreur rattrapée par l'application.
 * @param {any} err l'erreur (ou un message)
 * @param {string} [where] où elle s'est produite (« événement « chef » », « boucle de rendu »…)
 * @param {string} [kind]
 */
export function report(err, where = '', kind = 'erreur') {
  if (err && typeof err === 'object') { if (err.__reported) return null; try { err.__reported = true; } catch (e) { /* objet figé */ } }
  return add({ kind, where, msg: err && err.message ? err.message : String(err), stack: err && err.stack ? err.stack : '' });
}
export const onReport = (/** @type {(e: DiagError, isNew: boolean) => void} */ f) => { subs.push(f); };

if (typeof window !== 'undefined') {
  // le filet du chargement transmet désormais ici ; ce qu'il a déjà noté est remis au propre
  const early = ERRS.splice(0, ERRS.length);
  W.__carReport = add;
  for (const o of early) add(o);
  // console.error : messages d'erreur des bibliothèques (shader refusé par la carte graphique…)
  const ce = console.error.bind(console);
  console.error = (...a) => {
    ce(...a);
    const first = a[0];
    if (first && typeof first === 'object' && first.__reported) return;
    try { add({ kind: 'console', where: 'console', msg: a.map((x) => (x && x.message ? x.message : typeof x === 'string' ? x : (() => { try { return JSON.stringify(x); } catch (e) { return String(x); } })())).join(' '), stack: first && first.stack ? first.stack : '' }); } catch (e) { /* rien */ }
  };
}
