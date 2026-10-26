// @ts-check
import { el } from '../util.js';
import { rich } from './rich.js';
import { icon } from './icons.js';
import { exoOf, tirage, verifier, lireNombre, pointsItem, scoreExo, seul, etatVide, reponse, COUT, SEUIL_EXO, SEUIL_PARFAIT } from '../cours/exo.js';
import { coursProgress, recordExo } from '../cours/index.js';

// ----------------------------------------------------------------------------------
// L'exercice en autonomie d'une leçon (cours/exo.js), à la fin de la page, après le quiz : une question
// à la fois, comme dans Duolingo. On répond, on vérifie ; une réponse fausse coûte des points (une erreur
// prévue est expliquée) et l'on peut réessayer. Deux aides graduées (un indice, puis la méthode) coûtent
// chacune un quart de la question ; la solution se demande aussi, la question ne rapporte alors rien.
// À la fin : le score sur 100, les étoiles, le détail par question ; « Refaire » tire d'autres valeurs.
// L'essai en cours est gardé quand la page se redessine.
// ----------------------------------------------------------------------------------
/**
 * @typedef {{ id: string, items: import('../cours/exo.js').ExoItem[], vues: (number[] | null)[], k: number,
 *   etats: import('../cours/exo.js').EtatItem[], saisie: string, choix: number | null, ordre: number[] | null,
 *   retour: { ok: boolean, why?: string } | null, faux: string[], fini: boolean, score: number }} Essai
 * faux : les réponses déjà refusées à la question en cours (on ne paie pas deux fois la même erreur)
 */
/** @type {Essai | null} */
let RUN = null;
const pct = (v) => `${Math.round(v * 100)} %`;
/** trois étoiles, pleines ou vides, avec leur texte pour les lecteurs d'écran */
export function etoiles(n, max = 3, cls = '') {
  return el('span', { class: 'pa-stars' + (cls ? ' ' + cls : ''), role: 'img', 'aria-label': `${n} étoile${n > 1 ? 's' : ''} sur ${max}`, title: `${n} étoile${n > 1 ? 's' : ''} sur ${max}` },
    ...Array.from({ length: max }, (_, k) => icon(k < n ? 'etoilePleine' : 'bravo', k < n ? 'on' : '')));
}
/** étoiles de l'exercice seul : réussi, puis presque parfait */
const etoilesExo = (s) => (s >= SEUIL_PARFAIT ? 2 : s >= SEUIL_EXO ? 1 : 0);

/**
 * La section de l'exercice d'une leçon.
 * @param {import('../cours/index.js').Lesson} L
 * @param {{ onChange?: () => void, suite?: { label: string, go: () => void } | null }} [o] onChange : après un essai
 *   enregistré (le sommaire et les étoiles se mettent à jour) ; suite : où aller après l'exercice
 */
export function exoSection(L, o = {}) {
  const X = exoOf(L.id);
  const box = el('section', { class: 'co-exoauto', id: 'co-exoauto', 'aria-label': 'Exercice en autonomie' });
  if (!X) return box;
  const redraw = (/** @type {string} */ focus) => {
    const nb = exoSection(L, o); box.replaceWith(nb);
    const f = /** @type {HTMLElement | null} */ (focus ? nb.querySelector(focus) : null); if (f) f.focus();
  };
  const p = /** @type {any} */ (coursProgress(L.id)).exo || null;
  box.append(el('h4', {}, icon('entrainement'), 'Exercice en autonomie', p ? el('small', {}, ` · meilleur score ${p.best} / 100`) : null));
  const R = RUN && RUN.id === L.id ? RUN : null;
  const commencer = () => { const t = tirage(X); RUN = { id: L.id, items: t.items, vues: t.vues, k: 0, etats: t.items.map(() => etatVide()), saisie: '', choix: null, ordre: t.vues[0] && t.items[0].type === 'ordre' ? [...t.vues[0]] : null, retour: null, faux: [], fini: false, score: 0 }; redraw('.pa-q-input, .pa-q-choices button, .pa-ordre button'); };
  if (!R) {
    box.append(el('div', { class: 'pa-exo-intro' },
      el('b', {}, X.titre), el('p', {}, X.consigne),
      el('p', { class: 'note' }, `Vous êtes seul : chaque question a deux aides (−${pct(COUT.aide)} chacune) et sa solution (la question ne rapporte alors rien) ; une réponse fausse coûte aussi des points. Réussi à ${SEUIL_EXO} sur 100, trois étoiles à ${SEUIL_PARFAIT}. Chaque essai tire d'autres valeurs.`),
      el('div', { class: 'hwrow' }, p ? etoiles(etoilesExo(p.best), 2, 'small') : null,
        el('button', { type: 'button', class: 'btn primary pa-exo-go', onclick: commencer }, p ? 'Refaire l\'exercice (d\'autres valeurs)' : 'Commencer l\'exercice'))));
    return box;
  }
  if (R.fini) { box.append(bilan(R, X, L, commencer, o)); return box; }
  const it = R.items[R.k], st = R.etats[R.k];
  const resolue = st.ok || st.solution;
  const done = R.items.reduce((s, x, j) => s + (j < R.k ? pointsItem(x, R.etats[j]) : 0), 0);
  const card = el('div', { class: 'pa-q-card' + (R.retour && !R.retour.ok ? ' faux' : '') + (st.ok ? ' juste' : '') + (st.solution ? ' sol' : '') });
  card.append(el('div', { class: 'pa-q-head' },
    el('span', {}, `Question ${R.k + 1} / ${R.items.length}`),
    el('span', { class: 'pa-q-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(R.items.length), 'aria-valuenow': String(R.k), 'aria-label': 'Avancement de l\'exercice' }, el('i', { style: { width: `${(R.k / R.items.length) * 100}%` } })),
    el('span', { class: 'pa-q-pts' }, `${Math.round(100 * done / R.items.length)} pts`)),
  rich(it.q, 'co-rich pa-q-text'));
  // la réponse
  const verif = () => {
    if (resolue) return;
    const v = it.type === 'choix' ? R.choix : it.type === 'ordre' ? R.ordre : R.saisie;
    const r = verifier(it, v);
    if (r.vide) { R.retour = { ok: false, why: it.type === 'nombre' ? 'Écrivez un nombre (la virgule ou le point conviennent).' : it.type === 'choix' ? 'Choisissez une réponse.' : 'Écrivez votre réponse.' }; redraw('.pa-q-input'); return; }
    const cle = it.type === 'nombre' ? String(lireNombre(v)) : it.type === 'texte' ? String(v).trim().toLowerCase() : JSON.stringify(v);
    if (r.ok) { st.ok = true; R.retour = { ok: true }; } else { if (!R.faux.includes(cle)) { st.erreurs++; R.faux.push(cle); } R.retour = { ok: false, why: r.why }; if (it.type === 'choix') R.choix = null; }
    redraw(st.ok ? '.pa-next' : '.pa-q-input, .pa-q-choices button.sel, .pa-verif');
  };
  if (it.type === 'nombre' || it.type === 'texte') {
    const inp = /** @type {HTMLInputElement} */ (el('input', { type: 'text', class: 'pa-q-input', value: resolue && !st.ok ? '' : R.saisie, inputmode: it.type === 'nombre' ? 'decimal' : null, placeholder: it.placeholder || (it.type === 'nombre' ? 'votre réponse' : ''), 'aria-label': 'Votre réponse', autocomplete: 'off', spellcheck: 'false', disabled: resolue }));
    inp.addEventListener('input', () => { R.saisie = inp.value; });
    inp.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.preventDefault(); verif(); } });
    card.append(el('div', { class: 'pa-q-row' }, inp, it.unite ? el('span', { class: 'pa-unit' }, it.unite) : null));
  } else if (it.type === 'choix') {
    const vue = R.vues[R.k] || (it.choices || []).map((_, c) => c);
    const txt = (c) => (Array.isArray(c) ? c[0] : c);
    card.append(el('div', { class: 'pa-q-choices', role: 'group', 'aria-label': 'Les choix' }, ...vue.map((c) => el('button', {
      type: 'button', 'data-c': String(c), class: 'btn small co-choice-btn' + (R.choix === c ? ' sel' : '') + (st.ok && c === it.answer ? ' good' : '') + (R.faux.includes(String(c)) ? ' bad' : ''), 'aria-pressed': R.choix === c ? 'true' : 'false', disabled: resolue || R.faux.includes(String(c)),
      onclick: () => { R.choix = c; R.retour = null; redraw(`.pa-q-choices [data-c="${c}"]`); },
    }, txt((it.choices || [])[c])))));
  } else if (it.type === 'ordre') {
    const ord = R.ordre || [...(R.vues[R.k] || [])];
    const move = (i, d) => { const j = i + d; if (j < 0 || j >= ord.length) return; [ord[i], ord[j]] = [ord[j], ord[i]]; R.ordre = ord; R.retour = null; redraw(`.pa-ordre li:nth-child(${j + 1}) button[data-d="${d}"]`); };
    card.append(el('ol', { class: 'pa-ordre', 'aria-label': 'Les étapes, dans l\'ordre proposé' }, ...ord.map((x, i) => el('li', {},
      el('span', {}, (it.items || [])[x]),
      el('button', { type: 'button', class: 'btn small icon', 'data-d': '-1', 'aria-label': `Monter : ${(it.items || [])[x]}`, title: 'Monter', disabled: resolue || i === 0, onclick: () => move(i, -1) }, icon('monter')),
      el('button', { type: 'button', class: 'btn small icon', 'data-d': '1', 'aria-label': `Descendre : ${(it.items || [])[x]}`, title: 'Descendre', disabled: resolue || i === ord.length - 1, onclick: () => move(i, 1) }, icon('descendre'))))));
  }
  // les aides déjà ouvertes
  if (st.aides) card.append(el('div', { class: 'pa-aides' }, ...it.aides.slice(0, st.aides).map((a, j) => el('p', { class: 'pa-aide' }, icon('indice'), el('b', {}, j ? 'Méthode : ' : 'Indice : '), rich(a, 'co-rich')))));
  // le retour : juste, faux (et pourquoi), solution
  if (R.retour && !R.retour.ok && !resolue) card.append(el('p', { class: 'pa-retour faux', role: 'status' }, el('b', {}, 'Pas encore.'), ' ', R.retour.why || (st.erreurs ? `Cette erreur coûte ${pct(it.type === 'choix' ? COUT.erreurChoix : COUT.erreur)} de la question. Relisez, ou demandez une aide.` : '')));
  if (resolue) {
    card.append(el('div', { class: 'pa-retour ' + (st.ok ? 'juste' : 'sol'), role: 'status' },
      el('b', {}, st.ok ? `Juste ! ${Math.round(pointsItem(it, st) * 100)} % de la question.` : `La réponse : ${reponse(it)}.`), rich(it.solution, 'co-rich')));
  }
  // les boutons
  const derniere = R.k === R.items.length - 1;
  const suite = () => {
    if (derniere) { R.fini = true; R.score = scoreExo(R.items, R.etats); recordExo(L.id, R.score, seul(R.etats)); if (o.onChange) o.onChange(); redraw('.pa-bilan'); return; }
    R.k++; R.saisie = ''; R.choix = null; R.retour = null; R.faux = []; const n = R.items[R.k]; R.ordre = n.type === 'ordre' ? [...(R.vues[R.k] || [])] : null;
    redraw('.pa-q-input, .pa-q-choices button, .pa-ordre button:not([disabled])');
  };
  card.append(el('div', { class: 'pa-q-btns' }, ...(resolue
    ? [el('button', { type: 'button', class: 'btn primary pa-next', onclick: suite }, derniere ? 'Voir le résultat' : 'Question suivante')]
    : [
      el('button', { type: 'button', class: 'btn primary pa-verif', onclick: verif }, 'Vérifier'),
      st.aides < it.aides.length ? el('button', { type: 'button', class: 'btn small pa-aide-btn', onclick: () => { st.aides++; redraw('.pa-aide-btn, .pa-verif'); } }, icon('indice'), `${st.aides ? 'La méthode' : 'Un indice'} (−${pct(COUT.aide)})`) : null,
      el('button', { type: 'button', class: 'btn small pa-sol-btn', onclick: () => { st.solution = true; R.retour = null; redraw('.pa-next'); } }, 'Voir la solution (0 point)'),
    ])));
  box.append(el('p', { class: 'pa-exo-t' }, el('b', {}, X.titre), ' · ', X.consigne), card);
  return box;
}

// le résultat d'un essai : score, étoiles, détail, et la suite
function bilan(R, X, L, refaire, o) {
  const ok = R.score >= SEUIL_EXO, best = /** @type {any} */ (coursProgress(L.id)).exo;
  const msg = R.score >= SEUIL_PARFAIT ? 'Excellent : presque sans aide.' : ok ? 'Exercice réussi. Refaites-le avec moins d\'aide pour gagner la dernière étoile et monter la moyenne du niveau.' : `Pas encore réussi : il faut ${SEUIL_EXO} sur 100. Relisez la leçon et refaites l'exercice, avec d'autres valeurs.`;
  return el('div', { class: 'pa-bilan' + (ok ? ' ok' : ''), tabindex: '-1', role: 'status' },
    el('div', { class: 'pa-bilan-score' }, el('b', {}, `${R.score}`), el('span', {}, '/ 100'), etoiles(etoilesExo(R.score), 2)),
    el('p', {}, msg, best && best.best > R.score ? ` Votre meilleur score reste ${best.best}.` : ''),
    !seul(R.etats) && ok ? el('p', { class: 'note' }, 'Une solution a été demandée : l\'exercice compte pour le niveau, mais pas encore pour le livret de compétences (à refaire sans solution).') : null,
    el('ol', { class: 'pa-detail' }, ...R.items.map((it, j) => { const e = R.etats[j]; const pts = pointsItem(it, e); return el('li', { class: pts >= 1 ? 'ok' : pts > 0 ? 'mi' : 'ko' }, el('span', {}, `Question ${j + 1}`), el('small', {}, e.solution ? 'solution demandée' : [e.aides ? `${e.aides} aide${e.aides > 1 ? 's' : ''}` : '', e.erreurs ? `${e.erreurs} erreur${e.erreurs > 1 ? 's' : ''}` : ''].filter(Boolean).join(', ') || 'du premier coup'), el('b', {}, `${Math.round(pts * 100)} %`)); })),
    el('div', { class: 'hwrow' },
      el('button', { type: 'button', class: 'btn' + (ok ? '' : ' primary'), onclick: refaire }, 'Refaire (d\'autres valeurs)'),
      o.suite ? el('button', { type: 'button', class: 'btn' + (ok ? ' primary' : ''), onclick: () => { RUN = null; o.suite.go(); } }, o.suite.label) : null));
}
/** oublie l'essai en cours (changement de leçon) */
export function resetExo() { RUN = null; }
