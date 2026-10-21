// @ts-check
import { el } from '../../util.js';
import { rich } from '../rich.js';
import { FICHES, THEMES } from '../../content/cours/index.js';
import { TERMS } from '../../content/netterms.js';
import { FIGS } from '../term_figs.js';
import { COURS_FIGS } from './figs.js';
import { LABS } from './labs.js';

// ----------------------------------------------------------------------------------
// Une fiche de cours à l'écran, toujours dans le même ordre : l'essentiel, le schéma, « À toi de
// jouer », l'explication, « Pour aller plus loin », « Dans le car », les trois questions
// d'Olivier, les renvois et la norme. Une fiche du lexique réseau (TERMS) s'affiche dans le même
// moule, sans manipulation ni questions pour l'instant.
// ----------------------------------------------------------------------------------

/**
 * @typedef {object} FicheCtx
 * @property {(id: string) => void} open ouvrir une autre fiche
 * @property {(target: { label: string, station?: string, lesson?: string }) => void} go « Emmène-moi », parcours du chef
 */

/** titre d'une fiche du cours ou du lexique */
export const ficheTitle = (id) => (FICHES[id] ? FICHES[id].t : TERMS[id] ? TERMS[id].t : id);
/** l'essentiel d'une fiche, en une phrase */
export const ficheShort = (id) => { const F = FICHES[id]; return F && !F.term ? F.short : TERMS[(F && F.term) || id]?.short || ''; };
/** état d'une fiche : manipulation, fiche du lexique, en préparation */
export function ficheKind(id) {
  const F = FICHES[id];
  if (F && F.prevu) return 'prevu';
  if (F && F.lab) return 'lab';
  return 'term';
}

/**
 * @param {string} id
 * @param {FicheCtx} ctx
 * @returns {{ node: HTMLElement, dispose: () => void }}
 */
export function ficheView(id, ctx) {
  const F = FICHES[id];
  const T = TERMS[(F && F.term) || id];
  const theme = THEMES.find((th) => th.id === (F ? F.theme : 'reseau'));
  let dispose = () => {};
  const node = el('article', { class: 'co-fiche', 'data-fiche': id, 'aria-labelledby': 'co-fiche-t' });
  if (!F && !T) { node.append(el('p', { class: 'note' }, 'Cette fiche n\'existe pas encore.')); return { node, dispose }; }
  const kicker = F && !F.term ? theme?.nom : T.cat;
  node.append(el('header', { class: 'co-head' },
    el('span', { class: 'co-kicker' }, kicker || 'Cours'),
    el('h2', { id: 'co-fiche-t' }, F && !F.term ? F.t : T.t),
    (F && !F.term ? F.aka : T.aka) ? el('p', { class: 'co-aka' }, F && !F.term ? F.aka : T.aka) : null));
  // fiche annoncée : ce qu'elle contiendra
  if (F && F.prevu) {
    node.append(el('p', { class: 'co-short' }, F.short),
      el('div', { class: 'co-prevu' }, el('b', {}, 'Fiche en préparation'), el('span', {}, 'Elle suivra le même moule que la fiche SDI : schéma, manipulation, explication, « Dans le car » et trois questions.'),
        el('button', { type: 'button', class: 'btn small', onclick: () => ctx.open('sdi') }, 'Voir la fiche SDI')));
    return { node, dispose };
  }
  // fiche du lexique réseau, reprise telle quelle
  if (!F || F.term) {
    const fig = T.fig && FIGS[T.fig] ? el('figure', { class: 'co-fig', html: FIGS[T.fig]() }) : null;
    node.append(el('p', { class: 'co-short' }, T.short), fig, rich(T.body, 'co-body'),
      T.car ? carBox(T.car, [], ctx) : null,
      el('p', { class: 'co-from note' }, 'Fiche du lexique réseau, reprise telle quelle. Manipulation et questions à venir.'),
      seeRow((T.see || []).filter((k) => TERMS[k]), ctx), T.ref ? el('p', { class: 'co-ref' }, 'Référence : ' + T.ref) : null);
    return { node, dispose };
  }
  const fig = F.fig && COURS_FIGS[F.fig] ? el('figure', { class: 'co-fig', html: COURS_FIGS[F.fig]() }) : null;
  const lab = F.lab && LABS[F.lab] ? el('section', { class: 'co-lab', 'aria-label': 'À toi de jouer' }) : null;
  node.append(el('p', { class: 'co-short' }, F.short), fig, lab,
    F.body ? el('section', { class: 'co-sec' }, el('h3', {}, 'Comprendre'), rich(F.body, 'co-body')) : null,
    F.plus ? el('details', { class: 'co-plus' }, el('summary', {}, 'Pour aller plus loin'), rich(F.plus, 'co-body')) : null,
    F.car ? carBox(F.car, F.go || [], ctx) : null,
    F.quiz && F.quiz.length ? quizView(F.quiz) : null,
    seeRow(F.see || [], ctx), F.ref ? el('p', { class: 'co-ref' }, 'Référence : ' + F.ref) : null);
  if (lab) dispose = LABS[F.lab](lab);
  return { node, dispose };
}

function carBox(text, go, ctx) {
  return el('section', { class: 'co-car' }, el('b', {}, 'Dans le car'), el('p', {}, text),
    go.length ? el('div', { class: 'co-go' }, ...go.map((g) => el('button', { type: 'button', class: 'btn small' + (g.station ? ' primary' : ''), onclick: () => ctx.go(g) }, g.label))) : null);
}

function seeRow(ids, ctx) {
  if (!ids.length) return null;
  return el('div', { class: 'co-see' }, el('b', {}, 'Voir aussi'),
    ...ids.map((k) => el('button', { type: 'button', class: 'tp-chip' + (ficheKind(k) === 'prevu' ? ' co-chip-prevu' : ''), onclick: () => ctx.open(k) }, ficheTitle(k), ficheKind(k) === 'prevu' ? el('small', {}, ' à venir') : null)));
}

// trois questions : une mauvaise réponse dit pourquoi ; à la deuxième, la bonne s'allume
function quizView(qs) {
  const score = el('p', { class: 'co-score note', 'aria-live': 'polite' });
  const first = qs.map(() => /** @type {boolean | null} */ (null));
  const upd = () => { const n = first.filter((v) => v !== null).length; score.textContent = n === qs.length ? `Du premier coup : ${first.filter(Boolean).length} sur ${qs.length}.` : ''; };
  const box = el('section', { class: 'co-quiz' }, el('h3', {}, 'Trois questions d\'Olivier'));
  qs.forEach((Q, qi) => {
    let tries = 0;
    const fb = el('p', { class: 'co-fb', 'aria-live': 'polite' });
    const btns = Q.a.map(([txt], i) => el('button', { type: 'button', class: 'co-ans', onclick: () => pick(i) }, txt));
    const lock = () => btns.forEach((b) => { b.disabled = true; });
    function pick(i) {
      const why = Q.a[i][1];
      if (first[qi] === null) first[qi] = i === Q.ok;
      if (i === Q.ok) { btns[i].classList.add('ok'); fb.className = 'co-fb ok'; fb.textContent = why; lock(); upd(); return; }
      tries++; btns[i].classList.add('ko'); btns[i].disabled = true;
      fb.className = 'co-fb ko';
      if (tries < 2) fb.textContent = why + ' Essaie encore.';
      else { btns[Q.ok].classList.add('ok'); fb.textContent = why + ' La bonne réponse est allumée en vert : ' + Q.a[Q.ok][1].replace(/^Exact : /, ''); lock(); }
      upd();
    }
    box.append(el('div', { class: 'co-q' }, el('p', { class: 'co-qt' }, el('span', { class: 'co-qn' }, String(qi + 1)), Q.q), el('div', { class: 'co-ans-list' }, ...btns), fb));
  });
  box.append(score);
  return box;
}
