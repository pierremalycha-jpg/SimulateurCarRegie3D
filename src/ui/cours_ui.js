// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { rich } from './rich.js';
import { q, openTerm } from './term.js';
import { icon } from './icons.js';
import { TERMS } from '../content/netterms.js';
import { openLayer, layerOpen, showTab, closeLayer } from './layer.js';
import { chaptersSection, glossarySection, postesSection, materielSection, proceduresSection } from './guide.js';
import { CHAPTERS, lessonById, allLessons, coursProgress, markSeen, recordQuiz, lessonDone, chapterDone } from '../cours/index.js';
import { posteCible, estLecon } from '../cours/liens.js';

// ----------------------------------------------------------------------------------
// L'espace Cours, plein écran (touche G, entrée du titre, pupitre, menu du car) : il s'ouvre
// par-dessus tout, écran titre compris, même pendant le chargement. Onglet Leçons : à gauche les
// chapitres et leurs leçons (et la recherche, qui trouve aussi les fiches « ? »), à droite la
// leçon : l'essentiel, le schéma, la manipulation, l'explication, « dans le car », les fiches
// « ? », le quiz. Puis les chapitres du guide, le glossaire, les postes, le matériel, les
// procédures (ui/guide.js).
// ----------------------------------------------------------------------------------
const UI = { lesson: /** @type {string | null} */ (null), chapter: /** @type {string | null} */ (null), demo: /** @type {{ destroy?: () => void } | null | void} */ (null), q: '' };
const TABS = /** @type {[string, string][]} */ ([['lecons', 'Leçons'], ['chapitres', 'Chapitres'], ['glossaire', 'Glossaire'], ['postes', 'Postes'], ['materiel', 'Matériel'], ['procedures', 'Procédures']]);
const OLD_TAB = { chapitres: 'lecons', articles: 'chapitres' };
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * @param {{ tab?: string, lesson?: string | null, chapter?: string | null, term?: string, poste?: string, fiche?: string } | string} [o]
 *   onglet (lecons, chapitres, glossaire, postes, materiel, procedures), leçon ou chapitre du guide à ouvrir ;
 *   term : fiche « ? » (les leçons qui la citent, la recherche sur son nom) ; poste : la leçon du poste (cours/liens.js)
 */
export function openCours(o = {}) {
  const opts = typeof o === 'string' ? { lesson: o } : { ...o };
  if (opts.fiche && !opts.lesson && !opts.term) { if (estLecon(opts.fiche)) opts.lesson = opts.fiche; else if (TERMS[opts.fiche]) opts.term = opts.fiche; }
  if (opts.poste && !opts.lesson) { const id = posteCible(opts.poste, S.ipMode); if (estLecon(id)) opts.lesson = id; else if (TERMS[id]) opts.term = id; }
  if (opts.term && TERMS[opts.term]) {
    // la première leçon qui cite la fiche ; sinon la recherche sur son nom (leçons et fiches)
    const hit = allLessons().find(({ lesson }) => (lesson.terms || []).includes(opts.term));
    if (hit) opts.lesson = hit.lesson.id; else { UI.q = TERMS[opts.term].t; UI.lesson = null; opts.tab = 'lecons'; }
  }
  let tab = OLD_TAB[opts.tab || ''] || opts.tab || 'lecons';
  if (opts.lesson) { UI.lesson = opts.lesson; tab = 'lecons'; const f = lessonById(opts.lesson); if (f) UI.chapter = f.chapter.id; }
  const chapter = opts.chapter || null;
  if (chapter && tab === 'lecons' && CHAPTERS.some((c) => c.id === chapter)) { UI.chapter = chapter; const c = CHAPTERS.find((x) => x.id === chapter); UI.lesson = c && c.lessons[0] ? c.lessons[0].id : null; }
  const want = { chapter: chapter && tab === 'chapitres' ? chapter : null };
  // déjà ouvert : on change d'onglet (ou de leçon) sans tout reconstruire
  if (layerOpen() === 'cours') { showTab(tab); return; }
  openLayer({
    kind: 'cours', title: 'Cours', ico: 'cours', tabs: TABS, tab,
    show: (k, box) => {
      if (k === 'lecons') { lecons(box); return stopDemo; }
      if (k === 'chapitres') { chaptersSection(box, want.chapter); want.chapter = null; return; }
      if (k === 'glossaire') glossarySection(box);
      if (k === 'postes') postesSection(box);
      if (k === 'materiel') materielSection(box);
      if (k === 'procedures') proceduresSection(box);
      box.classList.add('ly-narrow');
    },
  });
}
on('cours', (o) => openCours(o && typeof o === 'object' ? o : typeof o === 'string' ? o : {}));
function stopDemo() { try { if (UI.demo && UI.demo.destroy) UI.demo.destroy(); } catch (e) { /* démonstration déjà démontée */ } UI.demo = null; }

// ---------------- l'onglet Leçons ----------------
function lecons(box) {
  const page = el('article', { class: 'co-page', tabindex: '-1' });
  const nav = el('nav', { class: 'co-nav', 'aria-label': 'Chapitres et leçons' });
  const render = () => {
    stopDemo();
    drawNav(nav, render);
    page.replaceChildren();
    const found = UI.lesson ? lessonById(UI.lesson) : null;
    if (found) lessonPage(page, found, render); else home(page, render);
    const sc = box.closest('.ly-scroll'); if (sc && page.getBoundingClientRect().top < 0) page.scrollIntoView({ block: 'start' });
  };
  box.append(el('div', { class: 'co-grid' }, nav, page));
  render();
}
function drawNav(nav, render) {
  const search = /** @type {HTMLInputElement} */ (el('input', { type: 'search', class: 'co-search', id: 'co-search', placeholder: 'Rechercher (4:2:2, VLAN, bilan de liaison, PTP…)', 'aria-label': 'Rechercher une leçon ou une fiche', spellcheck: 'false', value: UI.q }));
  const list = el('div', { class: 'co-list' });
  const draw = () => {
    const f = norm(UI.q.trim());
    list.replaceChildren();
    if (f) {
      const hits = allLessons().filter(({ lesson }) => norm(lesson.title + ' ' + lesson.essentials.join(' ')).includes(f));
      const terms = Object.keys(TERMS).filter((k) => norm(TERMS[k].t + ' ' + (TERMS[k].aka || '') + ' ' + TERMS[k].short).includes(f)).slice(0, 12);
      if (hits.length) list.append(el('h4', {}, 'Leçons'), el('ol', { class: 'co-hits' }, ...hits.map(({ chapter, lesson }) => el('li', {}, lesBtn(chapter, lesson, render)))));
      if (terms.length) list.append(el('h4', {}, 'Fiches « ? »'), el('div', { class: 'co-chips' }, ...terms.map((k) => el('button', { type: 'button', class: 'co-chip', onclick: (ev) => openTerm(k, /** @type {HTMLElement} */ (ev.currentTarget)) }, TERMS[k].t))));
      if (!hits.length && !terms.length) list.append(el('p', { class: 'note' }, 'Rien ne correspond.'));
      return;
    }
    for (const ch of CHAPTERS) {
      const done = chapterDone(ch);
      const det = el('details', { class: 'co-chap', open: UI.chapter === ch.id || (!UI.chapter && CHAPTERS[0] === ch) ? '' : null },
        el('summary', {}, icon(ch.icon), el('span', {}, ch.title), el('small', {}, `${done} / ${ch.lessons.length}`)),
        ch.lessons.length ? el('ol', {}, ...ch.lessons.map((l) => el('li', {}, lesBtn(ch, l, render)))) : el('p', { class: 'note' }, 'Les leçons arrivent.'));
      det.addEventListener('toggle', () => { if (det.open) UI.chapter = ch.id; });
      list.append(det);
    }
  };
  search.addEventListener('input', () => { UI.q = search.value; draw(); });
  nav.replaceChildren(search, list);
  draw();
}
const lesBtn = (ch, l, render) => el('button', { type: 'button', class: 'co-les' + (UI.lesson === l.id ? ' on' : '') + (lessonDone(l.id) ? ' done' : ''), 'data-lesson': l.id, 'aria-current': UI.lesson === l.id ? 'true' : null, onclick: () => { UI.lesson = l.id; UI.chapter = ch.id; render(); } }, lessonDone(l.id) ? icon('fait') : null, l.title);

function home(page, render) {
  const total = allLessons().length, done = allLessons().filter(({ lesson }) => lessonDone(lesson.id)).length;
  page.append(el('h2', {}, 'Les cours'),
    el('p', { class: 'lede' }, 'Un chapitre par domaine, une leçon par terme technique. Chaque leçon tient en quelques minutes : l\'essentiel, un schéma, une manipulation pour comprendre, puis où le retrouver dans le car et un quiz. Le chef de car vous y renvoie quand un terme vous manque.'),
    el('p', { class: 'note' }, total ? `${done} leçon${done > 1 ? 's' : ''} acquise${done > 1 ? 's' : ''} sur ${total} (quiz réussi en entier).` : 'Les chapitres arrivent.'),
    el('div', { class: 'co-cards' }, ...CHAPTERS.map((ch) => el('button', { type: 'button', class: 'co-card', onclick: () => { UI.chapter = ch.id; UI.lesson = ch.lessons[0] ? ch.lessons[0].id : null; render(); } },
      icon(ch.icon), el('b', {}, ch.title), el('span', {}, ch.intro), el('small', {}, `${ch.lessons.length} leçon${ch.lessons.length > 1 ? 's' : ''} · ${chapterDone(ch)} acquise${chapterDone(ch) > 1 ? 's' : ''}`)))));
}
function lessonPage(page, { chapter, lesson, i }, render) {
  markSeen(lesson.id);
  const L = lesson;
  page.append(el('p', { class: 'co-crumb' }, icon(chapter.icon), chapter.title, el('span', {}, ` · leçon ${i + 1} / ${chapter.lessons.length}`)),
    el('h2', {}, L.title, L.minutes ? el('small', {}, L.minutes) : null),
    el('section', { class: 'co-ess', 'aria-label': 'L\'essentiel' }, el('h4', {}, 'L\'essentiel'), el('ul', {}, ...L.essentials.map((t) => el('li', {}, rich(t, 'co-rich'))))));
  if (L.figure) { try { page.append(el('div', { class: 'co-figbox' }, L.figure())); } catch (e) { console.error(e); } }
  if (L.demo) {
    const host = el('div', { class: 'co-demo-host' });
    page.append(el('section', { class: 'co-demo', 'aria-label': 'Manipulation' }, el('h4', {}, icon('a_toi'), 'À vous : ', el('span', {}, L.demoTitle || 'essayez')), host));
    try { UI.demo = L.demo(host); } catch (e) { console.error(e); host.append(el('p', { class: 'note' }, 'La manipulation n\'a pas pu démarrer dans ce navigateur.')); }
  }
  page.append(el('section', { class: 'co-text' }, rich(L.body, 'co-rich')));
  if (L.plus) page.append(el('details', { class: 'co-plus' }, el('summary', {}, 'Pour aller plus loin'), rich(L.plus, 'co-rich')));
  if (L.car) {
    // « Aller au poste » : le car est lancé s'il ne l'est pas encore (app/nav.js)
    page.append(el('section', { class: 'co-car' }, el('h4', {}, icon('car'), 'Dans le car'), el('p', {}, L.car.text),
      L.car.station ? el('div', { class: 'hwrow' }, el('button', { class: 'btn small primary', onclick: () => emit('go', { station: L.car.station, tab: L.car.tab, label: 'Aller au poste' }) }, S.mode === 'start' ? 'Lancer le car et aller au poste' : 'Aller au poste'),
        L.car.lesson ? el('button', { class: 'btn small', onclick: () => emit('go', { lesson: L.car.lesson }) }, 'Parcours du chef') : null) : null));
  }
  const terms = (L.terms || []).filter((id) => TERMS[id]);
  if (terms.length) page.append(el('section', { class: 'co-terms' }, el('h4', {}, 'Fiches « ? »'), el('div', { class: 'co-chips' }, ...terms.map((id) => el('span', { class: 'co-chip' }, TERMS[id].t, q(id))))));
  page.append(quiz(L, render));
  const all = allLessons(); const k = all.findIndex((x) => x.lesson.id === L.id);
  const prev = all[k - 1], next = all[k + 1];
  page.append(el('div', { class: 'co-nextprev' },
    prev ? el('button', { class: 'btn small', onclick: () => { UI.lesson = prev.lesson.id; UI.chapter = prev.chapter.id; render(); } }, '◀ ' + prev.lesson.title) : el('span'),
    next ? el('button', { class: 'btn small primary', onclick: () => { UI.lesson = next.lesson.id; UI.chapter = next.chapter.id; render(); } }, next.lesson.title + ' ▶') : el('span')));
}
// le quiz : une mauvaise réponse dit pourquoi (par choix quand la leçon le précise), la bonne s'allume
function quiz(L, render) {
  const p = coursProgress(L.id);
  const box = el('section', { class: 'co-quiz', 'aria-label': 'Quiz' });
  box.append(el('h4', {}, 'Quiz', p.quiz ? el('small', {}, ` · meilleur score ${p.quiz.score} / ${p.quiz.total}`) : null));
  const answers = new Array(L.quiz.length).fill(null);
  const done = el('p', { class: 'co-score', hidden: true });
  const items = L.quiz.map((Q, qi) => {
    const why = el('p', { class: 'co-why', hidden: true });
    const text = (c) => (Array.isArray(c) ? c[0] : c);
    const whyOf = (ci) => (Array.isArray(Q.choices[ci]) && Q.choices[ci][1]) || Q.why;
    const btns = Q.choices.map((c, ci) => el('button', { type: 'button', class: 'btn small co-choice-btn', onclick: () => {
      if (answers[qi] != null) return;
      answers[qi] = ci;
      btns.forEach((b, bi) => { b.disabled = true; b.classList.toggle('good', bi === Q.answer); b.classList.toggle('bad', bi === ci && ci !== Q.answer); });
      why.hidden = false; why.replaceChildren(rich((ci === Q.answer ? '**Exact.** ' : `**Non, c'est « ${text(Q.choices[Q.answer])} ».** `) + whyOf(ci), 'co-rich'));
      if (answers.every((a) => a != null)) { const score = answers.filter((a, k) => a === L.quiz[k].answer).length; recordQuiz(L.id, score, L.quiz.length); done.hidden = false; done.replaceChildren(el('b', {}, `${score} / ${L.quiz.length}`), score === L.quiz.length ? ' : leçon acquise.' : ' : relisez l\'essentiel et refaites le quiz.', el('button', { class: 'btn small', onclick: () => render() }, 'Refaire le quiz')); }
    } }, text(c)));
    return el('div', { class: 'co-q' }, el('p', {}, `${qi + 1}. ${Q.q}`), el('div', { class: 'co-choices' }, ...btns), why);
  });
  box.append(...items, done);
  return box;
}
/** ferme l'espace Cours s'il est ouvert (depuis « Aller au poste », par exemple) */
export function closeCours() { if (layerOpen() === 'cours') closeLayer(false); }
