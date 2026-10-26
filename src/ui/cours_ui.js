// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { rich } from './rich.js';
import { q, openTerm } from './term.js';
import { icon } from './icons.js';
import { TERMS } from '../content/netterms.js';
import { openLayer, layerOpen, showTab, closeLayer } from './layer.js';
import { glossarySection, postesSection, materielSection, proceduresSection, openArticle } from './guide.js';
import { CFG } from '../shared.js';
import { CHAPTERS, lessonById, allLessons, coursProgress, markSeen, recordQuiz, lessonDone, chapterDone, drawQuiz } from '../cours/index.js';
import { posteCible, estLecon } from '../cours/liens.js';
import { exercisesOf, exerciseInfo, exerciseDone, specialState, allExercises } from '../cours/exercices.js';
import { TUTOR } from '../tutor/engine.js';
import { livret } from '../livret.js';
import { liveProg, openLivret } from './livret.js';
import { vuesDuChapitre, vuesDeLecon, CHAP3D } from '../vues3d/catalogue.js';

// ----------------------------------------------------------------------------------
// L'espace Cours, plein écran (touche G, menu titre, écran Jouer, pupitre, menu du car) : il s'ouvre
// par-dessus tout, écran titre compris, même pendant le chargement. Quatre onglets : Leçons, Glossaire,
// Postes, Matériel. Leçons : à gauche le seul menu (recherche, chapitres et leçons, la caméra en 3D) ;
// à droite, la leçon (l'essentiel, schéma, manipulation, explication, dans le car, exercices
// pratiques, fiches « ? », quiz), ou, sans leçon choisie, le suivi : progression, ce qu'il reste à
// faire, livret de compétences. Une leçon qui a une vue 3D (src/vues3d) la propose (« Voir en 3D ») ; le
// chapitre a alors son entrée « … en 3D » dans le sommaire, comme la caméra en 3D.
// ----------------------------------------------------------------------------------
const UI = { lesson: /** @type {string | null} */ (null), chapter: /** @type {string | null} */ (null), demo: /** @type {{ destroy?: () => void } | null | void} */ (null), q: '' };
/** l'essai de quiz en cours (gardé quand la page se redessine) : questions tirées, réponses choisies, corrigé affiché */
/** @type {{ id: string, draw: { i: number, order: number[] }[], answers: (number | null)[], checked: boolean } | null} */
let ESSAI = null;
const TABS = /** @type {[string, string][]} */ ([['lecons', 'Leçons'], ['glossaire', 'Glossaire'], ['postes', 'Postes'], ['materiel', 'Matériel']]);
// anciens onglets (chapitres du guide, procédures, caméra) : tout est maintenant dans les leçons
const OLD_TAB = { chapitres: 'lecons', articles: 'lecons', procedures: 'lecons', camera: 'lecons', notions: 'lecons' };
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * @param {{ tab?: string, lesson?: string | null, chapter?: string | null, term?: string, poste?: string, fiche?: string, article?: string | null, home?: boolean } | string} [o]
 *   onglet (lecons, glossaire, postes, materiel), leçon ou chapitre à ouvrir ; term : fiche « ? » (la leçon qui
 *   la cite) ; poste : la leçon du poste (cours/liens.js) ; article : article de l'ancien guide (la leçon
 *   qui le cite) ; home : le suivi de la progression
 */
export function openCours(o = {}) {
  const opts = typeof o === 'string' ? { lesson: o } : { ...o };
  if (opts.tab === 'camera') opts.chapter = 'camera';
  if (opts.home) { UI.lesson = null; UI.chapter = null; }
  if (opts.fiche && !opts.lesson && !opts.term) { if (estLecon(opts.fiche)) opts.lesson = opts.fiche; else if (TERMS[opts.fiche]) opts.term = opts.fiche; }
  if (opts.poste && !opts.lesson) { const id = posteCible(opts.poste, S.ipMode); if (estLecon(id)) opts.lesson = id; else if (TERMS[id]) opts.term = id; }
  if (opts.article) {
    const hit = allLessons().find(({ lesson }) => lesson.article === opts.article);
    if (hit) opts.lesson = hit.lesson.id; else { openArticle(opts.article); return; }
  }
  if (opts.term && TERMS[opts.term]) {
    // la première leçon qui cite la fiche ; sinon la recherche sur son nom (leçons et fiches)
    const hit = allLessons().find(({ lesson }) => (lesson.terms || []).includes(opts.term));
    if (hit) opts.lesson = hit.lesson.id; else { UI.q = TERMS[opts.term].t; UI.lesson = null; opts.tab = 'lecons'; }
  }
  const tab = OLD_TAB[opts.tab || ''] || opts.tab || 'lecons';
  if (opts.lesson) { UI.lesson = opts.lesson; const f = lessonById(opts.lesson); if (f) UI.chapter = f.chapter.id; }
  else if (opts.chapter && CHAPTERS.some((c) => c.id === opts.chapter)) { UI.chapter = opts.chapter; const c = CHAPTERS.find((x) => x.id === opts.chapter); UI.lesson = c && c.lessons[0] ? c.lessons[0].id : null; }
  if (layerOpen() === 'cours') { showTab(tab); return; }
  openLayer({
    kind: 'cours', title: 'Cours', ico: 'cours', tabs: TABS, tab,
    show: (k, box) => {
      if (k === 'lecons') { lecons(box); return stopDemo; }
      if (k === 'glossaire') glossarySection(box);
      if (k === 'postes') postesSection(box);
      if (k === 'materiel') materielSection(box);
      box.classList.add('ly-narrow');
    },
  });
}
on('cours', (o) => openCours(o && typeof o === 'object' ? o : typeof o === 'string' ? o : {}));
/** les modules d'un chapitre : le sien (la caméra en 3D), puis ses vues 3D (une entrée qui ouvre la première, avec la liste) */
function modulesDe(ch) {
  const out = ch.module ? [ch.module] : [];
  const vs = vuesDuChapitre(ch.id);
  if (vs.length) out.push({ label: CHAP3D[ch.id] || 'En 3D', sub: vs.map((v) => v.titre).join(' · '), event: 'vue3d', arg: { chapitre: ch.id, from: 'cours', liste: true } });
  return out;
}
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
    // un schéma qui contient des touches (ports, récepteurs, maillons) est un groupe, pas une image
    for (const s of page.querySelectorAll('svg[role="img"]')) if (s.querySelector('[tabindex], a, button')) s.setAttribute('role', 'group');
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
    list.append(el('button', { type: 'button', class: 'co-les co-home' + (!UI.lesson ? ' on' : ''), 'aria-current': !UI.lesson ? 'true' : null, onclick: () => { UI.lesson = null; render(); } }, icon('livret'), 'Mon suivi'));
    for (const ch of CHAPTERS) {
      const done = chapterDone(ch);
      const xs = ch.lessons.flatMap((l) => exercisesOf(l)); const xd = xs.filter((x) => exerciseDone(x.id)).length;
      const det = el('details', { class: 'co-chap', open: UI.chapter === ch.id ? '' : null },
        el('summary', {}, icon(ch.icon), el('span', {}, ch.title), el('small', { title: `${done} leçon(s) acquise(s) sur ${ch.lessons.length}` + (xs.length ? `, ${xd} exercice(s) fait(s) sur ${xs.length}` : '') }, `${done} / ${ch.lessons.length}`)),
        el('ol', {},
          ...modulesDe(ch).map((m) => el('li', {}, el('button', { type: 'button', class: 'co-les co-module', 'data-event': m.event, onclick: () => { closeLayer(false); emit(m.event, m.arg); } }, icon('cube'), el('span', {}, m.label, m.sub ? el('small', {}, m.sub) : null)))),
          // un chapitre en parties (le réseau) : un intertitre avant la première leçon de chaque partie
          ...ch.lessons.flatMap((l, k) => [l.partie && l.partie !== ch.lessons[k - 1]?.partie ? el('li', { class: 'co-part', role: 'presentation' }, l.partie) : null, el('li', {}, lesBtn(ch, l, render))].filter(Boolean))),
        !ch.lessons.length && !modulesDe(ch).length ? el('p', { class: 'note' }, 'Les leçons arrivent.') : null);
      det.addEventListener('toggle', () => { if (det.open) UI.chapter = ch.id; });
      list.append(det);
    }
  };
  search.addEventListener('input', () => { UI.q = search.value; draw(); });
  nav.replaceChildren(search, list);
  draw();
}
const lesBtn = (ch, l, render) => el('button', { type: 'button', class: 'co-les' + (UI.lesson === l.id ? ' on' : '') + (lessonDone(l.id) ? ' done' : ''), 'data-lesson': l.id, 'aria-current': UI.lesson === l.id ? 'true' : null, onclick: () => { UI.lesson = l.id; UI.chapter = ch.id; render(); } }, lessonDone(l.id) ? icon('fait') : null, l.title);

// le suivi : où l'on en est, ce qu'il reste à faire, le livret de compétences
function home(page, render) {
  const lessons = allLessons(); const ld = lessons.filter(({ lesson }) => lessonDone(lesson.id)).length;
  const xs = allExercises(); const xd = xs.filter((x) => exerciseDone(x.id)).length;
  const L = livret(liveProg()); const inSim = L.total - L.count.absent; const worked = L.count.consolidee + L.count.travaillee;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const bar = (a, b, label) => el('span', { class: 'co-bar', role: 'img', 'aria-label': `${label} : ${a} sur ${b}` }, el('i', { style: { width: pct(a, b) + '%' } }));
  const open = (lessonId) => { UI.lesson = lessonId; const f = lessonById(lessonId); UI.chapter = f ? f.chapter.id : null; render(); };
  // la suite : la première leçon non acquise, le premier exercice non fait (dans l'ordre du Cours)
  const nextL = lessons.find(({ lesson }) => !lessonDone(lesson.id));
  const nextX = xs.find((x) => !exerciseDone(x.id));
  const nextXi = nextX ? exerciseInfo(nextX.id) : null;
  page.append(el('h2', {}, 'Mon suivi'),
    el('p', { class: 'lede' }, 'Chaque leçon explique une notion avec un schéma et une manipulation ; son quiz la valide. Ses exercices pratiques se font dans le car, avec Olivier qui guide et vérifie. Choisissez un chapitre dans la liste, ou reprenez ci-dessous.'),
    el('div', { class: 'co-kpis' },
      el('div', { class: 'co-kpi' }, el('b', {}, `${ld} / ${lessons.length}`), el('span', {}, 'leçons acquises'), bar(ld, lessons.length, 'Leçons acquises')),
      el('div', { class: 'co-kpi' }, el('b', {}, `${xd} / ${xs.length}`), el('span', {}, 'exercices pratiques faits'), bar(xd, xs.length, 'Exercices faits')),
      el('div', { class: 'co-kpi' }, el('b', {}, `${worked} / ${inSim}`), el('span', {}, 'compétences du BTS travaillées'), bar(worked, inSim, 'Compétences travaillées'))),
    el('section', { class: 'co-next', 'aria-label': 'À faire ensuite' }, el('h4', {}, 'À faire ensuite'),
      el('div', { class: 'co-next-row' },
        nextL ? el('button', { type: 'button', class: 'co-next-item', onclick: () => open(nextL.lesson.id) }, el('small', {}, `Leçon · ${nextL.chapter.title}`), el('b', {}, nextL.lesson.title), el('span', {}, nextL.lesson.minutes || '')) : el('p', { class: 'note' }, 'Toutes les leçons sont acquises.'),
        nextX && nextXi ? el('button', { type: 'button', class: 'co-next-item', onclick: () => open(nextX.lesson.id) }, el('small', {}, `Exercice pratique · ${nextX.lesson.title}`), el('b', {}, nextXi.title), el('span', {}, `${nextXi.duration} · ${nextXi.level}`)) : el('p', { class: 'note' }, 'Tous les exercices sont faits.'))),
    el('section', { class: 'co-prog', 'aria-label': 'Par chapitre' }, el('h4', {}, 'Par chapitre'),
      el('table', { class: 'co-ptab' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Chapitre'), el('th', {}, 'Leçons'), el('th', {}, 'Exercices'), el('th', {}, el('span', { class: 'sr' }, 'Reprendre')))),
        el('tbody', {}, ...CHAPTERS.map((ch) => {
          const cl = ch.lessons.length, cd = chapterDone(ch);
          const cx = ch.lessons.flatMap((l) => exercisesOf(l)); const cxd = cx.filter((x) => exerciseDone(x.id)).length;
          const first = ch.lessons.find((l) => !lessonDone(l.id)) || ch.lessons[0];
          return el('tr', {},
            el('th', { scope: 'row' }, icon(ch.icon), ch.title),
            el('td', { 'data-l': 'Leçons' }, el('span', { class: 'co-cell' }, bar(cd, cl, 'Leçons'), `${cd} / ${cl}`)),
            el('td', { 'data-l': 'Exercices' }, cx.length ? el('span', { class: 'co-cell' }, bar(cxd, cx.length, 'Exercices'), `${cxd} / ${cx.length}`) : '—'),
            el('td', {}, first ? el('button', { type: 'button', class: 'btn small', onclick: () => open(first.id) }, cd === cl && cl ? 'Revoir' : cd ? 'Continuer' : 'Commencer') : ch.module ? el('button', { type: 'button', class: 'btn small', onclick: () => { closeLayer(false); emit(ch.module.event, ch.module.arg); } }, 'Ouvrir') : null));
        })))),
    // les procédures maison du formateur, quand il en a écrit (Espace formateur, onglet Procédures)
    ...((CFG.car.procedures || []).length ? [el('section', { class: 'co-procs', 'aria-label': 'Procédures du car' }, el('h4', {}, 'Les procédures du car'), (() => { const b = el('div'); proceduresSection(b); return b; })())] : []),
    el('section', { class: 'co-livret', 'aria-label': 'Livret de compétences' }, el('h4', {}, 'Mon livret de compétences (BTS MAV, option TIEE)'),
      el('div', { class: 'co-blocs' }, ...L.blocs.map((b) => { const w = b.count.consolidee + b.count.travaillee; const n = b.comps.length - b.count.absent; return el('div', { class: 'co-bloc' }, el('b', {}, b.id), el('span', {}, b.titre), bar(w, n, b.id), el('small', {}, `${w} / ${n} travaillées`)); })),
      el('div', { class: 'hwrow' }, el('button', { type: 'button', class: 'btn small', onclick: () => openLivret() }, 'Ouvrir le livret complet')),
      el('p', { class: 'note' }, 'Une compétence est travaillée quand une leçon, un exercice ou une tâche qui la font pratiquer est réussi ; consolidée, avec trois réussites dont un exercice pratique fait seul. Le livret dit ce qui a été pratiqué ; la valider reste le rôle du formateur.')));
}
function lessonPage(page, { chapter, lesson, i }, render) {
  markSeen(lesson.id);
  const L = lesson;
  page.append(el('p', { class: 'co-crumb' }, icon(chapter.icon), chapter.title, el('span', {}, `${L.partie ? ` · ${L.partie}` : ''} · leçon ${i + 1} / ${chapter.lessons.length}`)),
    el('h2', {}, L.title, L.minutes ? el('small', {}, L.minutes) : null),
    el('section', { class: 'co-ess', 'aria-label': 'L\'essentiel' }, el('h4', {}, 'L\'essentiel'), el('ul', {}, ...L.essentials.map((t) => el('li', {}, rich(t, 'co-rich'))))));
  if (L.figure) { try { page.append(el('div', { class: 'co-figbox' }, L.figure())); } catch (e) { console.error(e); } }
  // la notion en 3D : la scène s'ouvre à l'étape tirée de cette leçon, et « Quitter » ramène ici
  const v3 = vuesDeLecon(L.id);
  if (v3.length) {
    page.append(el('section', { class: 'co-3d', 'aria-label': 'Voir en 3D' }, el('h4', {}, icon('cube'), 'Voir en 3D'),
      ...v3.map((v) => el('div', { class: 'co-3d-item' },
        el('div', {}, el('b', {}, v.titre), el('p', {}, v.resume)),
        el('button', { type: 'button', class: 'btn small primary', 'data-vue': v.id, onclick: () => { closeLayer(false); emit('vue3d', { vue: v.id, lecon: L.id, from: 'cours' }); } }, 'Ouvrir la vue 3D')))));
  }
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
      L.car.station ? el('div', { class: 'hwrow' }, el('button', { class: 'btn small primary', onclick: () => emit('go', { station: L.car.station, tab: L.car.tab, label: 'Aller au poste' }) }, S.mode === 'start' ? 'Lancer le car et aller au poste' : 'Aller au poste')) : null));
  }
  if (L.article) page.append(el('div', { class: 'hwrow co-article' }, el('button', { type: 'button', class: 'btn small', onclick: () => openArticle(L.article) }, icon('guide'), 'Lire l\'article de référence')));
  const xs = exercisesOf(L);
  if (xs.length) page.append(el('section', { class: 'co-exos', 'aria-label': 'Exercices pratiques' }, el('h4', {}, icon('chef'), xs.length > 1 ? 'Exercices pratiques' : 'Exercice pratique'),
    ...xs.map((x) => exerciseCard(x, L))));
  const terms = (L.terms || []).filter((id) => TERMS[id]);
  if (terms.length) page.append(el('section', { class: 'co-terms' }, el('h4', {}, 'Fiches « ? »'), el('div', { class: 'co-chips' }, ...terms.map((id) => el('span', { class: 'co-chip' }, TERMS[id].t, q(id))))));
  page.append(quiz(L));
  const all = allLessons(); const k = all.findIndex((x) => x.lesson.id === L.id);
  const prev = all[k - 1], next = all[k + 1];
  page.append(el('div', { class: 'co-nextprev' },
    prev ? el('button', { class: 'btn small', onclick: () => { UI.lesson = prev.lesson.id; UI.chapter = prev.chapter.id; render(); } }, '◀ ' + prev.lesson.title) : el('span'),
    next ? el('button', { class: 'btn small primary', onclick: () => { UI.lesson = next.lesson.id; UI.chapter = next.chapter.id; render(); } }, next.lesson.title + ' ▶') : el('span')));
}
// le quiz : trois questions tirées dans la banque de la leçon, réponses mélangées. On choisit ses réponses
// (on peut changer d'avis), puis « Valider » donne le score et le corrigé de chaque question : pourquoi la
// bonne réponse est juste, pourquoi le choix fait est faux. « Refaire le quiz » tire d'autres questions.
function quiz(L) {
  const p = coursProgress(L.id);
  if (!ESSAI || ESSAI.id !== L.id) { const draw = drawQuiz(L.quiz); ESSAI = { id: L.id, draw, answers: draw.map(() => null), checked: false }; }
  const E = ESSAI;
  const box = el('section', { class: 'co-quiz', 'aria-label': 'Quiz' });
  // la section est redessinée en place ; le focus clavier revient sur l'élément visé
  const redraw = (/** @type {string} */ focus) => { const nb = quiz(L); box.replaceWith(nb); const f = /** @type {HTMLElement | null} */ (nb.querySelector(focus)); if (f) f.focus(); };
  box.append(el('h4', {}, 'Quiz', p.quiz ? el('small', {}, ` · meilleur score ${p.quiz.score} / ${p.quiz.total}`) : null),
    el('p', { class: 'co-quiz-help' }, `${E.draw.length} questions tirées parmi ${L.quiz.length}. Choisissez vos réponses, puis validez : le corrigé s'affiche à la fin.`));
  const text = (c) => (Array.isArray(c) ? c[0] : c);
  const items = E.draw.map(({ i, order }, qi) => {
    const Q = L.quiz[i];
    const whyOf = (ci) => (Array.isArray(Q.choices[ci]) && Q.choices[ci][1]) || Q.why;
    const btns = order.map((ci) => el('button', {
      type: 'button', class: 'btn small co-choice-btn' + (E.checked && ci === Q.answer ? ' good' : '') + (E.checked && ci === E.answers[qi] && ci !== Q.answer ? ' bad' : '') + (E.answers[qi] === ci ? ' sel' : ''),
      'data-c': String(ci), 'aria-pressed': E.answers[qi] === ci ? 'true' : 'false', disabled: E.checked,
      onclick: () => { if (E.checked) return; E.answers[qi] = ci; redraw(`.co-q[data-q="${i}"] [data-c="${ci}"]`); },
    }, text(Q.choices[ci])));
    const a = E.answers[qi];
    const why = E.checked && a != null ? el('div', { class: 'co-why' }, rich((a === Q.answer ? '**Exact.** ' + Q.why : `**Non, c'est « ${text(Q.choices[Q.answer])} ».** ${whyOf(a)}` + (whyOf(a) !== Q.why ? ' ' + Q.why : '')), 'co-rich')) : null;
    return el('div', { class: 'co-q', 'data-q': String(i) }, el('p', {}, `${qi + 1}. ${Q.q}`), el('div', { class: 'co-choices', role: 'group', 'aria-label': `Question ${qi + 1}` }, ...btns), why);
  });
  box.append(...items);
  const n = E.draw.length, score = E.draw.filter(({ i }, qi) => E.answers[qi] === L.quiz[i].answer).length;
  const all = E.answers.every((x) => x != null);
  if (!E.checked) {
    box.append(el('div', { class: 'co-score' }, el('button', {
      type: 'button', class: 'btn small primary co-valider', disabled: !all,
      onclick: () => { if (!E.answers.every((x) => x != null)) return; E.checked = true; recordQuiz(L.id, score, n); redraw('.co-score'); },
    }, 'Valider mes réponses'), all ? null : el('small', {}, `${E.answers.filter((x) => x != null).length} / ${n} répondues`)));
  } else {
    box.append(el('p', { class: 'co-score', tabindex: '-1', role: 'status' }, el('b', {}, `${score} / ${n}`), score === n ? ' : leçon acquise.' : ' : relisez l\'essentiel et refaites le quiz (d\'autres questions seront tirées).',
      el('button', { type: 'button', class: 'btn small', onclick: () => { const prev = E.draw.map((d) => d.i); const draw = drawQuiz(L.quiz, prev); ESSAI = { id: L.id, draw, answers: draw.map(() => null), checked: false }; redraw('.co-choice-btn'); } }, 'Refaire le quiz')));
  }
  return box;
}
/** ferme l'espace Cours s'il est ouvert (depuis « Aller au poste », par exemple) */
export function closeCours() { if (layerOpen() === 'cours') closeLayer(false); }

// un exercice pratique : ce qu'on y fait, son état, « Commencer » (le car se lance si besoin)
function exerciseCard(x, L) {
  const I = exerciseInfo(x.id); if (!I) return null;
  const done = exerciseDone(x.id);
  const st = I.special ? specialState(x.id).text : done ? 'fait' : TUTOR.lesson && TUTOR.lesson.id === x.id ? 'en cours' : 'pas encore fait';
  return el('div', { class: 'co-exo' + (done ? ' done' : ''), 'data-exercise': x.id },
    el('i', { class: 'co-led' + (done ? ' green' : ''), 'aria-hidden': 'true' }),
    el('div', { class: 'co-exo-t' }, el('b', {}, I.title), el('small', {}, `${I.duration} · ${I.level} · ${st}`), el('p', {}, x.intro || I.summary)),
    el('button', { type: 'button', class: 'btn small' + (done ? '' : ' primary'), onclick: () => { S.coursBack = L.id; emit('go', { ...I.go, label: I.title }); } }, done ? 'Refaire' : S.mode === 'start' && !I.go.camera ? 'Commencer (lance le car)' : 'Commencer'));
}
