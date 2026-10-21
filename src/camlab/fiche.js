// @ts-check
import { el } from '../util.js';
import { rich } from '../ui/rich.js';
import { NOTIONS, CHAPITRES } from './notions/index.js';
import { FIGS } from './figs.js';
import { LABS } from './labs.js';

// ----------------------------------------------------------------------------------
// Une fiche du module caméra, dans le panneau de droite. Le même moule que les fiches du Cours :
// l'essentiel, le schéma, la manipulation, « Comprendre », « Sur la vraie caméra », « Pour aller
// plus loin », « Dans le car », les trois questions d'Olivier, les notions liées, la référence.
// Une notion pas encore écrite montre son essentiel et le lot où elle arrive.
// ctx = { open(id) : ouvrir une autre notion, lens(state) : piloter la caméra 3D }
// ----------------------------------------------------------------------------------

const LOTS = { 1: 'premier', 2: 'deuxième', 3: 'troisième' };

/** les trois questions d'Olivier : un choix, l'explication de ce choix, on peut réessayer */
function quiz(questions) {
  const box = el('ol', { class: 'cl-quiz' });
  questions.forEach((q, qi) => {
    const why = el('p', { class: 'cl-why', 'aria-live': 'polite' });
    const opts = el('div', { class: 'cl-opts', role: 'group', 'aria-label': `Question ${qi + 1}` });
    q.a.forEach(([text, expl], i) => opts.append(el('button', {
      type: 'button', class: 'cl-opt',
      onclick: (e) => {
        const b = /** @type {HTMLElement} */ (e.currentTarget);
        for (const o of opts.children) o.classList.remove('chosen');
        b.classList.add('chosen', i === q.ok ? 'right' : 'wrong');
        why.textContent = expl; why.className = 'cl-why ' + (i === q.ok ? 'right' : 'wrong');
        if (i === q.ok) for (const o of opts.children) /** @type {HTMLButtonElement} */ (o).disabled = true;
      },
    }, text)));
    box.append(el('li', {}, el('p', { class: 'cl-q' }, q.q), opts, why));
  });
  return box;
}

const section = (title, ...body) => el('section', { class: 'cl-sec' }, el('h3', {}, title), ...body);

/** construit la fiche d'une notion ; renvoie { node, dispose } */
export function renderFiche(id, ctx) {
  const f = NOTIONS[id]; if (!f) return { node: el('p', {}, 'Notion inconnue.'), dispose() {} };
  const chap = CHAPITRES.find((c) => c.n === f.chap);
  const disposers = [];
  const node = el('article', { class: 'cl-fiche' + (f.prevu ? ' prevu' : ''), 'aria-label': f.t });
  node.append(el('header', { class: 'cl-fh' },
    el('p', { class: 'cl-kick' }, `Chapitre ${f.chap} · ${chap ? chap.nom : ''}`),
    el('h2', {}, f.t),
    f.aka ? el('p', { class: 'cl-aka' }, f.aka) : null));
  node.append(el('p', { class: 'cl-short' }, f.short));
  if (f.prevu) {
    node.append(el('div', { class: 'cl-todo' },
      el('b', {}, 'Fiche en préparation'),
      el('p', {}, `Elle arrive avec le ${LOTS[f.lot]} lot : schéma, manipulation sur la caméra et questions d'Olivier.${f.cours ? ' Elle reprendra la fiche du Cours sur le même sujet.' : ''}`)));
  }
  if (f.fig && FIGS[f.fig]) node.append(el('figure', { class: 'cl-fig', html: FIGS[f.fig]() }));
  if (f.lab && LABS[f.lab]) {
    const lab = LABS[f.lab](ctx); disposers.push(lab.dispose);
    node.append(section('À toi', el('p', { class: 'cl-hint' }, 'Les bagues de la caméra suivent tes réglages ; l\'image du viseur aussi.'), lab.node));
  }
  if (f.body) node.append(section('Comprendre', rich(f.body, 'chef-say cl-rich')));
  if (f.vraie) node.append(section('Sur la vraie caméra', rich(f.vraie, 'chef-say cl-rich')));
  if (f.plus) node.append(el('details', { class: 'cl-sec cl-plus' }, el('summary', {}, 'Pour aller plus loin'), rich(f.plus, 'chef-say cl-rich')));
  if (f.car) node.append(section('Dans le car', rich(f.car, 'chef-say cl-rich')));
  if (f.quiz && f.quiz.length) node.append(section('Les questions d\'Olivier', quiz(f.quiz)));
  if (f.see && f.see.length) {
    node.append(section('Voir aussi', el('div', { class: 'cl-see' }, ...f.see.filter((s) => NOTIONS[s]).map((s) =>
      el('button', { type: 'button', class: 'cl-chip' + (NOTIONS[s].prevu ? ' prevu' : ''), onclick: () => ctx.open(s) }, NOTIONS[s].t)))));
  }
  if (f.ref || f.competences) {
    node.append(el('footer', { class: 'cl-ref' },
      f.ref ? el('p', {}, el('b', {}, 'Référence : '), f.ref) : null,
      f.competences ? el('p', {}, el('b', {}, 'Référentiel TIEE : '), 'compétence' + (f.competences.length > 1 ? 's ' : ' ') + f.competences.join(', ')) : null));
  }
  return { node, dispose() { for (const d of disposers) try { d(); } catch (e) { /* rien à libérer */ } } };
}
