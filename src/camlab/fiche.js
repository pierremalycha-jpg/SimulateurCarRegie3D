// @ts-check
import { el } from '../util.js';
import { emit } from '../state.js';
import { rich } from '../ui/rich.js';
import { lessonById } from '../cours/index.js';
import { NOTIONS, CHAPITRES } from './notions/index.js';
import { FIGS } from './figs.js';
import { LABS } from './labs.js';
import { questionList } from './quiz.js';
import { recordNotion, notionAcquise, camProg } from './progress.js';

// ----------------------------------------------------------------------------------
// Une fiche du module caméra, dans le panneau de droite. Le même moule que les fiches du Cours :
// l'essentiel, le schéma, la manipulation, « Comprendre », « Sur la vraie caméra », « Pour aller
// plus loin », « Dans le car », les trois questions d'Olivier, les liens vers le Cours et les
// postes du car, les notions liées, la référence.
// Une notion pas encore écrite montre son essentiel et le lot où elle arrive.
// Les questions d'Olivier sont enregistrées (camlab/progress.js) : seule la première réponse de
// chaque question compte, la notion est acquise quand les trois le sont dans la même série.
// Une manipulation renvoie { node, dispose, hint? } : hint, sa consigne au-dessus d'elle.
// ctx = { open(id) : ouvrir une autre notion, lens(state) : piloter la caméra 3D,
//   progress() : la progression a changé, cours(id) : ouvrir une leçon du Cours (le module se
//   ferme), go(cible) : « Emmène-moi » vers un poste du car (le module se ferme) }
// ----------------------------------------------------------------------------------

const LOTS = { 1: 'premier', 2: 'deuxième', 3: 'troisième' };
/** consigne par défaut des manipulations des chapitres 1 à 3 (une manipulation peut donner la sienne : hint) */
const HINT_OPTIQUE = 'Les bagues de la caméra suivent tes réglages ; l\'image du viseur aussi.';

/** les trois questions d'Olivier, leur score et « Refaire les questions » */
function quiz(id, f, ctx, onChange) {
  const box = el('div', { class: 'cs-oq' });
  const result = el('div', { class: 'cs-result', 'aria-live': 'polite' });
  const prev = camProg().notions[id];
  const status = el('p', { class: 'cs-note' }, prev ? `Meilleure série : ${prev.score} / ${prev.total} du premier coup.` : 'Ta première réponse à chaque question compte : trois sur trois, et la notion est acquise.');
  const start = () => {
    result.replaceChildren();
    const list = questionList(f.quiz, {
      onDone(score, total) {
        const ok = recordNotion(id, score, total);
        onChange();
        if (ctx.progress) ctx.progress();
        const best = camProg().notions[id];
        status.textContent = `Meilleure série : ${best.score} / ${best.total} du premier coup.`;
        result.replaceChildren(
          el('p', { class: 'cs-score' + (score === total ? ' ok' : '') }, el('b', {}, `${score} / ${total}`),
            score === total ? ' du premier coup : notion acquise.' : ok ? ' cette fois ; la notion reste acquise.' : ' du premier coup. Relis la fiche, puis refais les questions.'),
          el('div', { class: 'cs-row' }, el('button', { type: 'button', class: 'btn small', onclick: () => start() }, 'Refaire les questions')));
      },
    });
    box.replaceChildren(list);
  };
  start();
  return el('div', {}, status, box, result);
}

/** la leçon du Cours de la fiche (champ cours) et les boutons « Emmène-moi » (champ go) */
function liens(f, ctx) {
  const items = [];
  const L = f.cours ? lessonById(f.cours) : null;
  if (L) {
    items.push(el('button', { type: 'button', class: 'btn small cs-cours', 'data-lesson': L.lesson.id,
      onclick: () => { if (ctx.cours) ctx.cours(L.lesson.id); else emit('cours', { lesson: L.lesson.id }); } },
    'La leçon du Cours : ', el('b', {}, L.lesson.title)));
  }
  for (const g of f.go || []) {
    if (!g || !(g.station || g.lesson)) continue;
    const target = { station: g.station, lesson: g.lesson, label: g.label };
    items.push(el('button', { type: 'button', class: 'btn small cs-go', 'data-station': g.station || '',
      onclick: () => { if (ctx.go) ctx.go(target); else emit('go', target); } },
    'Emmène-moi : ', el('b', {}, g.label)));
  }
  return items.length ? section('Dans le Cours et dans le car', el('div', { class: 'cs-links' }, ...items)) : null;
}

const section = (title, ...body) => el('section', { class: 'cl-sec' }, el('h3', {}, title), ...body);

/** construit la fiche d'une notion ; renvoie { node, dispose } */
export function renderFiche(id, ctx) {
  const f = NOTIONS[id]; if (!f) return { node: el('p', {}, 'Notion inconnue.'), dispose() {} };
  const chap = CHAPITRES.find((c) => c.n === f.chap);
  const disposers = [];
  const node = el('article', { class: 'cl-fiche' + (f.prevu ? ' prevu' : ''), 'aria-label': f.t });
  const badge = el('p', { class: 'cs-badge', hidden: !notionAcquise(id) }, el('i', { 'aria-hidden': 'true' }), 'Notion acquise');
  node.append(el('header', { class: 'cl-fh' },
    el('p', { class: 'cl-kick' }, `Chapitre ${f.chap} · ${chap ? chap.nom : ''}`),
    el('h2', {}, f.t),
    f.aka ? el('p', { class: 'cl-aka' }, f.aka) : null,
    badge));
  node.append(el('p', { class: 'cl-short' }, f.short));
  if (f.prevu) {
    node.append(el('div', { class: 'cl-todo' },
      el('b', {}, 'Fiche en préparation'),
      el('p', {}, `Elle arrive avec le ${LOTS[f.lot]} lot : schéma, manipulation sur la caméra et questions d'Olivier.${f.cours ? ' Elle reprendra la fiche du Cours sur le même sujet.' : ''}`)));
  }
  if (f.fig && FIGS[f.fig]) node.append(el('figure', { class: 'cl-fig', html: FIGS[f.fig]() }));
  if (f.lab && LABS[f.lab]) {
    const lab = /** @type {{ node: Element, dispose: () => void, hint?: string }} */ (LABS[f.lab](ctx)); disposers.push(lab.dispose);
    // la consigne : celle que donne la manipulation (hint), sinon, pour l'objectif, les filtres et
    // les capteurs (chapitres 1 à 3), les bagues et le viseur qui suivent ; rien ailleurs
    const hint = lab.hint != null ? lab.hint : f.chap <= 3 ? HINT_OPTIQUE : '';
    node.append(section('À toi', hint ? el('p', { class: 'cl-hint' }, hint) : null, lab.node));
  }
  if (f.body) node.append(section('Comprendre', rich(f.body, 'chef-say cl-rich')));
  if (f.vraie) node.append(section('Sur la vraie caméra', rich(f.vraie, 'chef-say cl-rich')));
  if (f.plus) node.append(el('details', { class: 'cl-sec cl-plus' }, el('summary', {}, 'Pour aller plus loin'), rich(f.plus, 'chef-say cl-rich')));
  if (f.car) node.append(section('Dans le car', rich(f.car, 'chef-say cl-rich')));
  if (f.quiz && f.quiz.length) node.append(section('Les questions d\'Olivier', quiz(id, f, ctx, () => { badge.hidden = !notionAcquise(id); })));
  const L = liens(f, ctx); if (L) node.append(L);
  if (f.see && f.see.length) {
    node.append(section('Voir aussi', el('div', { class: 'cl-see' }, ...f.see.filter((s) => NOTIONS[s]).map((s) =>
      el('button', { type: 'button', class: 'cl-chip' + (NOTIONS[s].prevu ? ' prevu' : '') + (notionAcquise(s) ? ' cs-done' : ''), onclick: () => ctx.open(s) }, NOTIONS[s].t)))));
  }
  if (f.ref || f.competences) {
    node.append(el('footer', { class: 'cl-ref' },
      f.ref ? el('p', {}, el('b', {}, 'Référence : '), f.ref) : null,
      f.competences ? el('p', {}, el('b', {}, 'Référentiel TIEE : '), 'compétence' + (f.competences.length > 1 ? 's ' : ' ') + f.competences.join(', ')) : null));
  }
  return { node, dispose() { for (const d of disposers) try { d(); } catch (e) { /* rien à libérer */ } } };
}
