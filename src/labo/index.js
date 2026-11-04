// @ts-check
import { el } from '../util.js';
import { on, emit } from '../state.js';
import { icon } from '../ui/icons.js';
import { rich } from '../ui/rich.js';
import { openTerm, termOpen, closeTerm } from '../ui/term.js';
import { askOpen, ask } from '../ui/common.js';
import { PROG, saveProgressSoon } from '../shared.js';
import { TERMS } from '../content/netterms.js';
import { competence, SAVOIRS } from '../content/referentiel.js';
import { reponse, lireNombre, pointsItem } from '../cours/exo.js';
import { ATELIERS, atelierById, bilanAtelier } from './ateliers.js';
import { INITIAL, MESURES, poser, etatPour } from './etats.js';
import { tirageDefi, verifierItem, noterDefi, etatVide, scoreDefi, SEUIL_DEFI, DEFIS } from './defis.js';
import './defis/all.js';
import { defiEtat } from './suivi.js';
import * as OPTIQUE from './ateliers/optique.js';
import * as PHOTO from './ateliers/photometrie.js';
import * as SENSITO from './ateliers/sensito.js';
import * as DMX from './ateliers/dmx.js';
import * as DOT2 from './ateliers/dot2.js';
import * as PTZ from './ateliers/ptz.js';

// ----------------------------------------------------------------------------------
// Le Labo (v19.28) : l'espace de Jouer qui remplace l'entrepôt. Un écran à part, par-dessus tout
// (la boucle du simulateur l'ignore, comme le module caméra) : en haut, un onglet par atelier
// (labo/ateliers.js) ; au centre, l'atelier (labo/ateliers/<id>.js : ses dessins et ses commandes,
// sur l'état et les mesures de labo/etats.js) ; à droite, deux onglets : « Défis » (les défis notés
// de l'atelier, et l'essai en cours : une question à la fois, deux aides, la solution, le score) et
// « Comprendre » (les notions, les fiches « ? », les liens vers le Cours, le référentiel cité). Un atelier
// qui a une mise en service (sa vue rend etapes() : les caméras PTZ) a un troisième onglet, « Pas à pas » :
// les étapes cochées d'après l'état, comment faire la suivante, et un bouton qui y mène.
// Un défi impose ses réglages (fixe) : leurs commandes se verrouillent le temps de la question.
// La console dot2 occupe tout l'espace (pas de panneau). Ouvert par l'événement « labo »
// ({ atelier, lesson }) : depuis Jouer, le Cours (exercice x-labo-<id>) ou le module caméra.
// ----------------------------------------------------------------------------------
const MODULES = { optique: OPTIQUE, photometrie: PHOTO, sensito: SENSITO, dmx: DMX, dot2: DOT2, ptz: PTZ };
export const LB = { open: false, atelier: ATELIERS[0].id, lesson: '', panneau: 'defis', replie: false };
/** @type {any} */ let R = null;
let titleWasOpen = false;
/** l'état de chaque atelier (gardé tant que la page vit) et sa vue */
const STATES = /** @type {Record<string, any>} */ ({});
const VUES = /** @type {Record<string, { root: HTMLElement, rendre: () => void } | null>} */ ({});
const VERROUS = new Set();
/**
 * l'essai de défi en cours
 * @type {null | { id: string, atelier: string, items: any[], vues: any[], k: number, etats: any[], retour: any, saisie: string, choix: number | null, fini: boolean, res: any, aides: number }}
 */
let RUN = null;

export const laboOpen = () => LB.open;
export function initLabo() {
  on('labo', (o) => { if (o && o.type) return; openLabo(o || {}); });
}

const etat = (id) => STATES[id] || (STATES[id] = INITIAL[id] ? INITIAL[id]() : {});
const ctxDe = (id) => ({
  get st() { return etat(id); },
  m: () => (MESURES[id] ? MESURES[id](etat(id)) : {}),
  changer: (patch) => changer(id, patch),
  verrous: VERROUS,
  dire: (t) => { if (R) R.live.textContent = t; },
});
/** applique un réglage à l'atelier, le redessine en gardant le focus ; la réponse d'un réglage vérifié s'efface */
function changer(id, patch) {
  // un réglage imposé par la question ne bouge pas
  const libre = Object.fromEntries(Object.entries(patch).filter(([k]) => !VERROUS.has(k) && ![...VERROUS].some((v) => k.startsWith(v + '.'))));
  if (!Object.keys(libre).length) return;
  poser(etat(id), libre);
  const a = /** @type {HTMLElement | null} */ (document.activeElement);
  const cle = a && R && R.work.contains(a) ? (a.dataset.k ? `[data-k="${a.dataset.k}"]${a.dataset.v ? `[data-v="${a.dataset.v}"]` : ''}` : a.getAttribute('aria-label') ? `[aria-label="${a.getAttribute('aria-label')}"]` : '') : '';
  rendreAtelier();
  if (LB.panneau === 'pasapas' && R.side.contains(document.activeElement) === false) dessinerSide();
  if (cle) { const b = /** @type {HTMLElement | null} */ (R.work.querySelector(cle)); if (b && b !== document.activeElement && !(/** @type {any} */ (b).disabled)) b.focus({ preventScroll: true }); }
  if (RUN && !RUN.fini && RUN.atelier === id && RUN.retour && !RUN.retour.ok && RUN.items[RUN.k].type === 'reglage') { RUN.retour = null; dessinerDefi(); }
}

// ---------------- construction ----------------
function build() {
  const tabs = el('nav', { class: 'lb-tabs', role: 'tablist', 'aria-label': 'Les ateliers du Labo' },
    ...ATELIERS.map((A) => el('button', { type: 'button', role: 'tab', class: 'lb-tab', 'data-atelier': A.id, onclick: () => choisir(A.id) }, icon(A.ico), el('span', {}, A.court))));
  const quitter = el('button', { type: 'button', class: 'btn small lb-quit', title: 'Revenir à l\'écran Jouer (Échap)', onclick: () => closeLabo() }, 'Quitter', ' ', el('kbd', {}, 'Échap'));
  // à côté de la console, le panneau des défis se replie pour lui laisser toute la place
  const replier = el('button', { type: 'button', class: 'btn small lb-replier', 'aria-pressed': 'false', onclick: () => { LB.replie = !LB.replie; dessinerSide(); } }, 'Masquer les défis');
  const bar = el('header', { class: 'lb-bar' }, el('div', { class: 'lb-id' }, el('h1', {}, 'Le Labo'), el('small', { class: 'lb-sous' }, '')), tabs, replier, quitter);
  const work = el('main', { class: 'lb-work', 'aria-label': 'L\'atelier' });
  const sideTabs = el('div', { class: 'seg lb-sidetabs', role: 'tablist', 'aria-label': 'Défis ou explications' },
    el('button', { type: 'button', role: 'tab', 'data-p': 'defis', onclick: () => { LB.panneau = 'defis'; dessinerSide(); } }, 'Défis'),
    el('button', { type: 'button', role: 'tab', 'data-p': 'pasapas', onclick: () => { LB.panneau = 'pasapas'; dessinerSide(); } }, 'Pas à pas'),
    el('button', { type: 'button', role: 'tab', 'data-p': 'comprendre', onclick: () => { LB.panneau = 'comprendre'; dessinerSide(); } }, 'Comprendre'));
  const sideBody = el('div', { class: 'lb-sidebody' });
  const side = el('aside', { class: 'lb-side', 'aria-label': 'Défis et explications' }, sideTabs, sideBody);
  const live = el('p', { class: 'sr', 'aria-live': 'polite' });
  const root = el('div', { id: 'labo', class: 'labo', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Le Labo', hidden: true }, bar, el('div', { class: 'lb-body' }, work, side), live);
  document.body.append(root);
  document.addEventListener('keydown', onKey, true);
  R = { root, bar, tabs, work, side, sideTabs, sideBody, live, replier };
}
function onKey(e) {
  if (!LB.open || e.code !== 'Escape' || askOpen()) return;
  e.preventDefault(); e.stopPropagation();
  // une fiche « ? » ouverte se ferme d'abord (les touches du simulateur ignorent le Labo)
  if (termOpen()) { closeTerm(); return; }
  closeLabo();
}

// ---------------- l'atelier ----------------
function choisir(id) {
  if (!atelierById(id)) id = ATELIERS[0].id;
  if (RUN && !RUN.fini && RUN.atelier !== id) RUN = null; // changer d'atelier abandonne l'essai (rien n'est noté)
  if (!RUN || RUN.fini) VERROUS.clear();
  LB.atelier = id;
  const A = atelierById(id);
  for (const b of R.tabs.querySelectorAll('.lb-tab')) { const onT = /** @type {HTMLElement} */ (b).dataset.atelier === id; b.setAttribute('aria-selected', String(onT)); }
  R.bar.querySelector('.lb-sous').textContent = A.titre;
  R.root.classList.toggle('lb-plein', !!A.libre);
  R.root.classList.toggle('lb-console', A.id === 'dot2');
  // un atelier à mise en service s'ouvre la première fois sur son « Pas à pas »
  if (!VUES[id] && !RUN && id === 'ptz') LB.panneau = 'pasapas';
  const V = VUES[id] || (VUES[id] = MODULES[id].creer(ctxDe(id)));
  R.work.replaceChildren(V.root);
  rendreAtelier();
  dessinerSide();
  emit('labo', { type: 'atelier', atelier: id });
}
function rendreAtelier() { const V = VUES[LB.atelier]; if (V) V.rendre(); }

// ---------------- le panneau : défis et explications ----------------
function dessinerSide() {
  const A = atelierById(LB.atelier);
  const console = A.id === 'dot2';
  R.side.hidden = !!A.libre || (console && LB.replie);
  R.root.classList.toggle('lb-replie', console && LB.replie);
  R.replier.hidden = !console; R.replier.textContent = LB.replie ? 'Afficher les défis' : 'Masquer les défis'; R.replier.setAttribute('aria-pressed', String(LB.replie));
  const V = /** @type {any} */ (VUES[A.id]);
  const pas = !!(V && V.etapes);
  if (!pas && LB.panneau === 'pasapas') LB.panneau = 'defis';
  for (const b of R.sideTabs.querySelectorAll('button')) { const p = /** @type {HTMLElement} */ (b).dataset.p; b.setAttribute('aria-selected', String(p === LB.panneau)); /** @type {HTMLElement} */ (b).hidden = p === 'pasapas' && !pas; }
  if (LB.panneau === 'comprendre') { R.sideBody.replaceChildren(comprendre(A)); return; }
  if (LB.panneau === 'pasapas') { R.sideBody.replaceChildren(pasAPas(V)); return; }
  if (RUN && RUN.atelier === A.id) { dessinerDefi(); return; }
  R.sideBody.replaceChildren(listeDefis(A));
}
const etoile = (on) => el('span', { class: 'lb-star' + (on ? ' on' : ''), 'aria-hidden': 'true' }, icon(on ? 'etoilePleine' : 'bravo'));
function listeDefis(A) {
  const b = bilanAtelier(PROG, A.id);
  return el('div', { class: 'lb-defis' },
    el('p', { class: 'lb-lede' }, A.resume),
    el('p', { class: 'lb-note' }, `${b.reussis} défi${b.reussis > 1 ? 's' : ''} réussi${b.reussis > 1 ? 's' : ''} seul sur ${b.total}. Chaque essai tire d'autres valeurs ; réussi à ${SEUIL_DEFI} sur 100.`),
    el('ol', { class: 'lb-dlist' }, ...A.defis.map((d) => {
      const e = defiEtat(PROG, d.id);
      const txt = !e ? 'Pas encore tenté' : e.seul ? `Réussi seul · meilleur ${e.best} / 100` : `Meilleur ${e.best} / 100 · ${e.n} essai${e.n > 1 ? 's' : ''}`;
      return el('li', { class: 'lb-dcard' + (e && e.seul ? ' ok' : '') },
        etoile(!!(e && e.seul)),
        el('div', {}, el('b', {}, d.titre), el('small', {}, txt), el('span', { class: 'lb-dcons' }, DEFIS[d.id] ? DEFIS[d.id].consigne : '')),
        el('button', { type: 'button', class: 'btn small' + (e && e.seul ? '' : ' primary'), 'data-defi': d.id, onclick: () => commencer(d.id) }, e ? 'Refaire' : 'Commencer'));
    })));
}
/** la mise en service pas à pas : les étapes cochées d'après l'état de l'atelier, la suivante dépliée */
function pasAPas(V) {
  const E = V.etapes(), k = E.findIndex((e) => !e.fait), n = E.filter((e) => e.fait).length;
  const enDefi = RUN && !RUN.fini && RUN.atelier === LB.atelier;
  return el('div', { class: 'lb-pas' },
    el('p', { class: 'lb-lede' }, 'La mise en service du banc, dans l\'ordre. Chaque étape se coche seule quand l\'atelier la voit faite.'),
    enDefi ? el('p', { class: 'lb-note' }, 'Un défi est en cours : ses réglages remplacent ceux de la fiche.') : null,
    el('p', { class: 'lb-note' }, k < 0 ? `Les ${E.length} étapes sont faites : le banc est en service.` : `${n} étape${n > 1 ? 's' : ''} faite${n > 1 ? 's' : ''} sur ${E.length}.`),
    el('ol', { class: 'lb-steps' }, ...E.map((e, i) => el('li', { class: 'lb-step' + (e.fait ? ' ok' : '') + (i === k ? ' cur' : ''), 'aria-current': i === k ? 'step' : null },
      el('span', { class: 'lb-step-n', 'aria-hidden': 'true' }, e.fait ? '✓' : String(i + 1)),
      el('div', {}, el('b', {}, e.titre), e.fait ? el('small', {}, ' · fait') : null,
        i === k ? el('div', { class: 'lb-step-body' }, el('p', {}, (V.comment || {})[e.id] || ''), e.reste ? el('p', { class: 'lb-note' }, 'Il reste : ', e.reste, '.') : null,
          el('button', { type: 'button', class: 'btn small primary', 'data-k': 'pas:aller', onclick: () => V.aller(e) }, 'Y aller')) : null)))));
}
function comprendre(A) {
  const lien = (L) => el('button', { type: 'button', class: 'lb-lien', onclick: () => {
    if (L.camera) { closeLabo(false); emit('camera', { notion: L.camera, from: 'labo', lesson: A.id }); return; }
    closeLabo(false); emit('cours', { lesson: L.lecon });
  } }, icon(L.camera ? 'vision' : 'cours'), L.titre);
  return el('div', { class: 'lb-comp' },
    el('h3', {}, 'Ce qu\'on y manipule'),
    el('ul', { class: 'lb-notions' }, ...A.notions.map((n) => el('li', {}, n))),
    A.terms.length ? el('h3', {}, 'Fiches « ? »') : null,
    A.terms.length ? el('div', { class: 'co-chips' }, ...A.terms.filter((k) => TERMS[k]).map((k) => el('button', { type: 'button', class: 'co-chip', 'data-term': k, onclick: (ev) => openTerm(k, /** @type {HTMLElement} */ (ev.currentTarget)) }, TERMS[k].t))) : null,
    A.liens.length ? el('h3', {}, 'Dans le Cours') : null,
    A.liens.length ? el('div', { class: 'lb-liens' }, ...A.liens.map(lien)) : null,
    el('h3', {}, 'Référentiel BTS MAV, option TIEE'),
    el('ul', { class: 'lb-ref' }, ...A.competences.map((c) => { const C = competence(c); return el('li', {}, el('b', {}, c), ' ', C ? C.titre : ''); })),
    el('p', { class: 'lb-note' }, 'Savoirs associés : ', ...A.savoirs.map((s, i) => [i ? ' · ' : '', el('span', { title: SAVOIRS[s] ? SAVOIRS[s].t : '' }, `${s} ${SAVOIRS[s] ? SAVOIRS[s].t : ''}`)]).flat()));
}

// ---------------- un essai de défi ----------------
async function commencer(id) {
  const t = tirageDefi(id); if (!t) return;
  const d = /** @type {any} */ (ATELIERS.flatMap((A) => A.defis.map((x) => ({ ...x, atelier: A.id }))).find((x) => x.id === id));
  // un atelier qui a son propre état (la console) : le défi y charge sa scène, après accord si l'on y a déjà travaillé
  const V = /** @type {any} */ (VUES[d.atelier]);
  if (V && V.programme && V.programme() && !(await ask('Le défi charge son show de départ dans la console : les cues et les exécuteurs du show en cours seront remplacés. Pour les garder, sauvegardez-le d\'abord (Backup, Save Show) ou exportez-le.', { title: 'Remplacer le show de la console', ok: 'Charger le show du défi', cancel: 'Annuler' }))) return;
  if (V && V.preparer) V.preparer(t.scene);
  STATES[d.atelier] = etatPour(d.atelier, t.scene);
  // la vue de l'atelier lit l'état par son contexte : elle suit le nouvel objet
  RUN = { id, atelier: d.atelier, items: t.items, vues: t.vues, k: 0, etats: t.items.map(() => etatVide()), retour: null, saisie: '', choix: null, fini: false, res: null, aides: 0 };
  LB.panneau = 'defis';
  entrerQuestion();
}
function entrerQuestion() {
  const it = RUN.items[RUN.k];
  VERROUS.clear();
  if (it.type === 'reglage' && it.fixe) { poser(etat(RUN.atelier), it.fixe); for (const k of Object.keys(it.fixe)) VERROUS.add(k); }
  RUN.retour = null; RUN.saisie = ''; RUN.choix = null; RUN.aides = 0;
  rendreAtelier(); dessinerSide();
  const q = R.sideBody.querySelector('.lb-q'); if (q) /** @type {HTMLElement} */ (q).focus({ preventScroll: false });
}
function valider() {
  const it = RUN.items[RUN.k], E = RUN.etats[RUN.k];
  let v = null;
  if (it.type === 'nombre' || it.type === 'texte') v = RUN.saisie;
  if (it.type === 'choix') v = RUN.choix;
  // la console : on relit son show au moment de vérifier
  const V = /** @type {any} */ (VUES[RUN.atelier]);
  if (it.type === 'reglage' && V && V.lire) STATES[RUN.atelier] = V.lire();
  const r = verifierItem(it, v, { st: etat(RUN.atelier), m: MESURES[RUN.atelier](etat(RUN.atelier)) });
  if (r.vide) { RUN.retour = { ok: false, why: it.type === 'choix' ? 'Choisissez une réponse.' : 'Écrivez une réponse.' }; dessinerDefi(); return; }
  if (r.ok) E.ok = true; else E.erreurs++;
  RUN.retour = r; dessinerDefi();
  if (R) R.live.textContent = r.ok ? 'Juste.' : `Pas encore. ${r.why || ''}`;
}
function aide() { const E = RUN.etats[RUN.k]; if (E.aides < 2) { E.aides++; dessinerDefi(); } }
function solution() {
  const it = RUN.items[RUN.k], E = RUN.etats[RUN.k];
  E.solution = true; E.ok = true;
  const V = /** @type {any} */ (VUES[RUN.atelier]);
  if (it.type === 'reglage' && it.corrige && V && V.appliquer) { V.appliquer(it.corrige); STATES[RUN.atelier] = etatPour(RUN.atelier, it.corrige); }
  else if (it.type === 'reglage' && it.corrige) { const verr = [...VERROUS]; VERROUS.clear(); poser(etat(RUN.atelier), it.corrige); for (const k of verr) VERROUS.add(k); rendreAtelier(); }
  RUN.retour = { ok: true, sol: true }; dessinerDefi();
}
function suivante() {
  if (RUN.k < RUN.items.length - 1) { RUN.k++; entrerQuestion(); return; }
  // fin de l'essai : noté dans la progression, annoncé au jeu (XP, livret, tableau de bord)
  RUN.fini = true; VERROUS.clear();
  RUN.res = noterDefi(PROG, RUN.id, RUN.items, RUN.etats);
  saveProgressSoon();
  emit('laboDefi', { id: RUN.id, score: RUN.res.score, seul: RUN.res.seul, reussi: RUN.res.reussi, premier: RUN.res.premier });
  rendreAtelier(); dessinerDefi();
}
function dessinerDefi() {
  if (!RUN || !R || LB.panneau !== 'defis' || RUN.atelier !== LB.atelier) return;
  const d = /** @type {any} */ (ATELIERS.find((A) => A.id === RUN.atelier).defis.find((x) => x.id === RUN.id));
  const retour = el('button', { type: 'button', class: 'lb-back', onclick: () => { RUN = null; VERROUS.clear(); rendreAtelier(); dessinerSide(); } }, '← Les défis');
  if (RUN.fini) {
    const r = RUN.res;
    R.sideBody.replaceChildren(el('div', { class: 'lb-run lb-fin' }, retour,
      el('h3', {}, d.titre),
      el('p', { class: 'lb-score' + (r.reussi ? ' ok' : '') }, el('b', {}, `${r.score} / 100`), ' ', r.reussi ? (r.seul ? 'Réussi seul.' : 'Réussi, mais avec une solution demandée : à refaire seul pour qu\'il compte.') : `Pas encore : il faut ${SEUIL_DEFI}.`),
      el('ol', { class: 'lb-detail' }, ...RUN.items.map((it, k) => { const E = RUN.etats[k]; const p = Math.round(pointsItem(/** @type {any} */ (it.type === 'reglage' ? { ...it, type: 'nombre' } : it), E) * 100); return el('li', {}, `${p} / 100`, E.solution ? ' (solution demandée)' : E.aides ? ` (${E.aides} aide${E.aides > 1 ? 's' : ''})` : '', E.erreurs ? ` · ${E.erreurs} erreur${E.erreurs > 1 ? 's' : ''}` : ''); })),
      el('div', { class: 'lb-acts' },
        el('button', { type: 'button', class: 'btn primary', 'data-k': 'defi:refaire', onclick: () => commencer(RUN.id) }, 'Refaire avec d\'autres valeurs'),
        el('button', { type: 'button', class: 'btn', onclick: () => { RUN = null; dessinerSide(); } }, 'Les défis'))));
    return;
  }
  const it = RUN.items[RUN.k], E = RUN.etats[RUN.k], fait = E.ok;
  const zone = el('div', { class: 'lb-answer' });
  if (it.type === 'reglage') {
    if (it.fixe && Object.keys(it.fixe).length) zone.append(el('p', { class: 'lb-note' }, icon('cadenas'), ' Certains réglages sont imposés : leurs commandes sont verrouillées.'));
    if (!fait && RUN.atelier === 'dot2') zone.append(el('p', { class: 'lb-note' }, 'Programmez dans la console, puis vérifiez : le Labo lit le show de la console tel qu\'il est.'));
    if (!fait) zone.append(el('button', { type: 'button', class: 'btn primary', 'data-k': 'defi:verifier', onclick: valider }, RUN.atelier === 'dot2' ? 'Vérifier mon programme' : 'Vérifier mon réglage'));
  } else if (it.type === 'nombre' || it.type === 'texte') {
    const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'text', inputmode: it.type === 'nombre' ? 'decimal' : 'text', class: 'lb-input', 'aria-label': 'Votre réponse', placeholder: it.placeholder || '', value: RUN.saisie, disabled: fait ? '' : null, spellcheck: 'false', autocomplete: 'off' }));
    inp.addEventListener('input', () => { RUN.saisie = inp.value; });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); valider(); } });
    zone.append(el('div', { class: 'lb-inrow' }, inp, it.unite ? el('span', { class: 'lb-unit' }, it.unite) : null), fait ? null : el('button', { type: 'button', class: 'btn primary', 'data-k': 'defi:valider', onclick: valider }, 'Valider'));
    if (it.type === 'nombre' && RUN.saisie && !Number.isFinite(lireNombre(RUN.saisie))) zone.append(el('p', { class: 'lb-note' }, 'Écrivez un nombre (virgule ou point).'));
  } else if (it.type === 'choix') {
    const ordre = RUN.vues[RUN.k] || it.choices.map((_, k) => k);
    zone.append(el('div', { class: 'lb-choix', role: 'radiogroup', 'aria-label': 'Les réponses' }, ...ordre.map((k) => { const c = it.choices[k]; const t = Array.isArray(c) ? c[0] : c; return el('button', { type: 'button', role: 'radio', class: 'lb-ch', 'aria-checked': String(RUN.choix === k), disabled: fait ? '' : null, onclick: () => { RUN.choix = k; dessinerDefi(); } }, t); })),
    fait ? null : el('button', { type: 'button', class: 'btn primary', 'data-k': 'defi:valider', onclick: valider }, 'Valider'));
  }
  const fb = RUN.retour ? el('div', { class: 'lb-fb ' + (RUN.retour.ok ? 'ok' : 'bad'), role: 'status' },
    el('b', {}, RUN.retour.sol ? 'Solution' : RUN.retour.ok ? 'Juste.' : 'Pas encore.'), RUN.retour.mesure ? el('span', {}, ' ' + RUN.retour.mesure + '.') : null, !RUN.retour.ok && RUN.retour.why ? el('span', {}, ' ' + RUN.retour.why) : null) : null;
  const aides = E.aides ? el('div', { class: 'lb-aides' }, ...it.aides.slice(0, E.aides).map((a, k) => el('p', {}, el('b', {}, k ? 'Méthode : ' : 'Indice : '), a))) : null;
  const sol = fait ? el('div', { class: 'lb-sol' }, rich(it.solution, 'lb-rich'), it.type !== 'reglage' ? el('p', { class: 'lb-note' }, `Réponse : ${reponse(it)}`) : null) : null;
  const nav = el('div', { class: 'lb-acts' },
    fait ? el('button', { type: 'button', class: 'btn primary', 'data-k': 'defi:suivante', onclick: suivante }, RUN.k < RUN.items.length - 1 ? 'Question suivante' : 'Voir le résultat') : null,
    !fait && E.aides < 2 ? el('button', { type: 'button', class: 'btn small', 'data-k': 'defi:aide', onclick: aide }, E.aides ? 'La méthode' : 'Un indice') : null,
    !fait ? el('button', { type: 'button', class: 'btn small', 'data-k': 'defi:solution', onclick: solution }, 'La solution') : null);
  const score = scoreDefi(RUN.items, RUN.etats);
  R.sideBody.replaceChildren(el('div', { class: 'lb-run' }, retour,
    el('h3', {}, d.titre),
    el('p', { class: 'lb-note' }, `Question ${RUN.k + 1} / ${RUN.items.length} · ${score} points pour l'instant`),
    el('p', { class: 'lb-cons' }, DEFIS[RUN.id].consigne),
    el('div', { class: 'lb-q', tabindex: '-1' }, rich(it.q, 'lb-rich')),
    zone, fb, aides, sol, nav,
    el('p', { class: 'lb-note' }, 'Une aide ou une erreur coûte un quart de la question ; la solution ne rapporte rien.')));
}

// ---------------- ouvrir, fermer ----------------
/** ouvre le Labo : o.atelier (l'onglet), o.lesson (la leçon du Cours où revenir en sortant) */
export function openLabo(o = {}) {
  if (!R) build();
  if (o.lesson) LB.lesson = o.lesson;
  if (!LB.open) {
    LB.open = true;
    const title = document.getElementById('title');
    titleWasOpen = !!title && !title.hidden; if (title) title.hidden = true;
    R.root.hidden = false; document.body.classList.add('labo-on');
  }
  choisir(o.atelier || LB.atelier);
  const t = /** @type {HTMLElement | null} */ (R.tabs.querySelector('[aria-selected="true"]')); if (t) t.focus({ preventScroll: true });
  emit('labo', { type: 'open', atelier: LB.atelier });
}
/** ferme le Labo ; retour : revenir à la leçon d'où l'on venait (sinon, l'écran d'où l'on était parti) */
export function closeLabo(retour = true) {
  if (!LB.open) return;
  LB.open = false; R.root.hidden = true; document.body.classList.remove('labo-on');
  const title = document.getElementById('title');
  if (title && titleWasOpen) title.hidden = false;
  const lesson = LB.lesson; LB.lesson = '';
  emit('labo', { type: 'close', atelier: LB.atelier });
  if (retour && lesson) emit('cours', { lesson });
}
/** accès de débogage et de test */
export const laboDebug = () => ({ R, LB, STATES, RUN, VERROUS, choisir, commencer, valider, solution, suivante, changer, mesures: (id) => (MESURES[id] ? MESURES[id](etat(id)) : {}) });
