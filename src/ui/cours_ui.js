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
import { CHAPTERS, lessonById, allLessons, coursProgress, markSeen, recordQuiz, drawQuiz } from '../cours/index.js';
import { posteCible, estLecon } from '../cours/liens.js';
import { exercisesOf, exerciseInfo, exerciseDone, specialState, allExercises } from '../cours/exercices.js';
import { TUTOR } from '../tutor/engine.js';
import { livret } from '../livret.js';
import { liveProg, openLivret } from './livret.js';
import { vuesDuChapitre, vuesDeLecon, CHAP3D } from '../vues3d/catalogue.js';
import { niveauDe, leconOuverte, etatLecon, etatNiveaux, ordreDe } from '../cours/parcours.js';
import { accueilParcours, cheminChapitre, apercuFerme, etapesLecon, pageTest, nouveauTest, testEnCours, finirTest, pastille, libre } from './cours_parcours.js';
import { exoSection, etoiles } from './cours_exo.js';
import { exoOf } from '../cours/exo.js';
import { PROG } from '../shared.js';
import { NOTIONS } from '../camlab/notions/index.js';
import { notionAcquise } from '../camlab/progress.js';

// ----------------------------------------------------------------------------------
// L'espace Cours, plein écran (touche G, menu titre, écran Jouer, pupitre, menu du car) : il s'ouvre
// par-dessus tout, écran titre compris, même pendant le chargement. Quatre onglets : Leçons, Glossaire,
// Postes, Matériel. Leçons : à gauche le seul menu (recherche, chapitres rangés par niveau, la caméra en
// 3D) ; à droite, « Mon parcours » (la suite conseillée, une tuile par catégorie, le livret), le chemin d'un
// chapitre niveau par niveau (ui/cours_parcours.js), ou la leçon en trois étapes : apprendre (l'essentiel,
// schéma, manipulation, explication, dans le car, fiches « ? »), le quiz, l'exercice en autonomie
// (ui/cours_exo.js), puis les exercices pratiques dans le car. Une leçon d'un niveau fermé (profil
// Étudiant) n'en montre que l'aperçu et le chemin pour l'ouvrir. Une leçon qui a une vue 3D (src/vues3d) la
// propose (« Voir en 3D ») ; le chapitre a alors son entrée « … en 3D » dans le sommaire.
// ----------------------------------------------------------------------------------
/** vue : null (Mon parcours ou la leçon), « chapitre » (le chemin du chapitre), « test » (un test de niveau) */
const UI = { lesson: /** @type {string | null} */ (null), chapter: /** @type {string | null} */ (null), vue: /** @type {null | 'chapitre' | 'test'} */ (null), demo: /** @type {{ destroy?: () => void } | null | void} */ (null), q: '' };
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
  if (opts.home) { UI.lesson = null; UI.chapter = null; UI.vue = null; finirTest(); }
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
  if (opts.lesson) { UI.lesson = opts.lesson; UI.vue = null; finirTest(); const f = lessonById(opts.lesson); if (f) UI.chapter = f.chapter.id; }
  // un chapitre s'ouvre sur son chemin, niveau par niveau
  else if (opts.chapter && CHAPTERS.some((c) => c.id === opts.chapter)) { UI.chapter = opts.chapter; UI.lesson = null; UI.vue = 'chapitre'; finirTest(); }
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
// le profil change (Réglages par-dessus le Cours) : les niveaux s'ouvrent ou se ferment
on('profile', () => { if (layerOpen() === 'cours' && REDRAW) REDRAW(); });
/** @type {null | (() => void)} */ let REDRAW = null;
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
    drawNav(nav, go);
    page.replaceChildren();
    const found = UI.lesson ? lessonById(UI.lesson) : null;
    const ch = UI.chapter ? CHAPTERS.find((c) => c.id === UI.chapter) : null;
    if (UI.vue === 'test' && testEnCours()) pageTest(page, go);
    else if (found) { if (leconOuverte(found.lesson.id, PROG, { libre: libre() })) lessonPage(page, found, go, nav); else apercuFerme(page, found, go); }
    else if (UI.vue === 'chapitre' && ch) cheminChapitre(page, ch, go, modulesDe(ch).map(moduleBtn));
    else home(page, go);
    // un schéma qui contient des touches (ports, récepteurs, maillons) est un groupe, pas une image
    for (const s of page.querySelectorAll('svg[role="img"]')) if (s.querySelector('[tabindex], a, button')) s.setAttribute('role', 'group');
    const sc = box.closest('.ly-scroll'); if (sc && page.getBoundingClientRect().top < 0) page.scrollIntoView({ block: 'start' });
  };
  /** @type {import('./cours_parcours.js').Go} */
  const go = {
    lecon: (id) => { UI.lesson = id; const f = lessonById(id); if (f) UI.chapter = f.chapter.id; UI.vue = null; finirTest(); render(); },
    chapitre: (id) => { UI.lesson = null; UI.chapter = id; UI.vue = 'chapitre'; finirTest(); render(); },
    accueil: () => { UI.lesson = null; UI.vue = null; finirTest(); render(); },
    test: (chId, niveau) => { nouveauTest(chId, niveau); UI.lesson = null; UI.chapter = chId; UI.vue = 'test'; render(); },
    render,
  };
  REDRAW = render;
  box.append(el('div', { class: 'co-grid' }, nav, page));
  render();
}
/** une entrée de module (la caméra en 3D, les vues 3D du chapitre) */
const moduleBtn = (m) => el('button', { type: 'button', class: 'co-les co-module', 'data-event': m.event, onclick: () => { closeLayer(false); emit(m.event, m.arg); } }, icon('cube'), el('span', {}, m.label, m.sub ? el('small', {}, m.sub) : null));
function drawNav(nav, /** @type {import('./cours_parcours.js').Go} */ go) {
  const search = /** @type {HTMLInputElement} */ (el('input', { type: 'search', class: 'co-search', id: 'co-search', placeholder: 'Rechercher (4:2:2, VLAN, bilan de liaison, PTP…)', 'aria-label': 'Rechercher une leçon ou une fiche', spellcheck: 'false', value: UI.q }));
  const list = el('div', { class: 'co-list' });
  const o = { libre: libre() };
  const draw = () => {
    const f = norm(UI.q.trim());
    list.replaceChildren();
    if (f) {
      const hits = allLessons().filter(({ lesson }) => norm(lesson.title + ' ' + lesson.essentials.join(' ')).includes(f));
      const terms = Object.keys(TERMS).filter((k) => norm(TERMS[k].t + ' ' + (TERMS[k].aka || '') + ' ' + TERMS[k].short).includes(f)).slice(0, 12);
      if (hits.length) list.append(el('h4', {}, 'Leçons'), el('ol', { class: 'co-hits' }, ...hits.map(({ lesson }) => el('li', {}, lesBtn(lesson, go, o)))));
      if (terms.length) list.append(el('h4', {}, 'Fiches « ? »'), el('div', { class: 'co-chips' }, ...terms.map((k) => el('button', { type: 'button', class: 'co-chip', onclick: (ev) => openTerm(k, /** @type {HTMLElement} */ (ev.currentTarget)) }, TERMS[k].t))));
      if (!hits.length && !terms.length) list.append(el('p', { class: 'note' }, 'Rien ne correspond.'));
      return;
    }
    const accueil = !UI.lesson && UI.vue !== 'chapitre' && UI.vue !== 'test';
    list.append(el('button', { type: 'button', class: 'co-les co-home' + (accueil ? ' on' : ''), 'aria-current': accueil ? 'true' : null, onclick: () => go.accueil() }, icon('parcours'), 'Mon parcours'));
    for (const ch of CHAPTERS) {
      const N = etatNiveaux(ch.id, PROG, o);
      const done = N.reduce((s, n) => s + n.terminees, 0), tot = N.reduce((s, n) => s + n.lecons.length, 0);
      const chemin = UI.vue === 'chapitre' && UI.chapter === ch.id && !UI.lesson;
      const det = el('details', { class: 'co-chap', open: UI.chapter === ch.id ? '' : null },
        el('summary', {}, icon(ch.icon), el('span', {}, ch.title), el('small', { title: `${done} leçon(s) terminée(s) sur ${tot}` }, `${done} / ${tot}`)),
        el('ol', {},
          el('li', {}, el('button', { type: 'button', class: 'co-les co-chemin' + (chemin ? ' on' : ''), 'data-chapitre': ch.id, 'aria-current': chemin ? 'true' : null, onclick: () => go.chapitre(ch.id) }, icon('parcours'), 'Le parcours du chapitre')),
          ...modulesDe(ch).map((m) => el('li', {}, moduleBtn(m))),
          // les leçons rangées par niveau ; un chapitre en parties (le réseau) garde ses intertitres dans chaque niveau
          ...N.flatMap((n) => [
            el('li', { class: 'co-niv' + (n.ouvert ? '' : ' ferme') + (n.valide ? ' ok' : '') }, n.ouvert ? (n.valide ? icon('fait') : null) : icon('cadenas'), pastille(n.niveau), el('small', {}, `${n.terminees} / ${n.lecons.length}`)),
            ...n.lecons.flatMap((id, k) => {
              const L = /** @type {any} */ (lessonById(id)).lesson; const prev = k ? /** @type {any} */ (lessonById(n.lecons[k - 1])).lesson : null;
              return [L.partie && (!prev || prev.partie !== L.partie) ? el('li', { class: 'co-part' }, L.partie) : null, el('li', {}, lesBtn(L, go, o, n.ouvert))].filter(Boolean);
            }),
          ])),
        !ch.lessons.length && !modulesDe(ch).length ? el('p', { class: 'note' }, 'Les leçons arrivent.') : null);
      det.addEventListener('toggle', () => { if (det.open) UI.chapter = ch.id; });
      list.append(det);
    }
  };
  search.addEventListener('input', () => { UI.q = search.value; draw(); });
  nav.replaceChildren(search, list);
  draw();
}
/** une leçon du sommaire : terminée (coche), fermée (cadenas), sinon ses étoiles */
const lesBtn = (l, go, o, ouvert = leconOuverte(l.id, PROG, o)) => {
  const e = etatLecon(l.id, PROG);
  return el('button', { type: 'button', class: 'co-les' + (UI.lesson === l.id ? ' on' : '') + (e.terminee ? ' done' : '') + (ouvert ? '' : ' lock'), 'data-lesson': l.id, 'aria-current': UI.lesson === l.id ? 'true' : null, onclick: () => go.lecon(l.id) },
    ouvert ? (e.terminee ? icon('fait') : null) : icon('cadenas'), el('span', {}, l.title), ouvert && e.etoiles ? etoiles(e.etoiles, 3, 'mini') : null);
};

// Mon parcours : la suite conseillée, une tuile par catégorie, l'exercice pratique à faire dans le car, le livret
function home(page, /** @type {import('./cours_parcours.js').Go} */ go) {
  const xs = allExercises(); const xd = xs.filter((x) => exerciseDone(x.id)).length;
  const L = livret(liveProg()); const inSim = L.total - L.count.absent; const worked = L.count.consolidee + L.count.travaillee;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const bar = (a, b, label) => el('span', { class: 'co-bar', role: 'img', 'aria-label': `${label} : ${a} sur ${b}` }, el('i', { style: { width: pct(a, b) + '%' } }));
  const P = accueilParcours(go);
  const ld = P.bilans.reduce((s, x) => s + x.b.terminees, 0), lt = P.bilans.reduce((s, x) => s + x.b.lecons, 0);
  const et = P.bilans.reduce((s, x) => s + x.b.etoiles, 0), em = P.bilans.reduce((s, x) => s + x.b.max, 0);
  const nv = P.bilans.flatMap((x) => x.b.niveaux), nvd = nv.filter((n) => n.valide).length;
  // l'exercice pratique à faire dans le car : le premier non fait d'une leçon ouverte
  const nextX = xs.find((x) => !exerciseDone(x.id) && leconOuverte(x.lesson.id, PROG, { libre: libre() }));
  const nextXi = nextX ? exerciseInfo(nextX.id) : null;
  page.append(el('h2', {}, 'Mon parcours'),
    el('p', { class: 'lede' }, 'Chaque catégorie se fait par niveaux : Débutant, puis Intermédiaire, Avancé et Expert. Une leçon se termine par son quiz et un exercice en autonomie, où l\'aide se paie en points ; un niveau validé ouvre le suivant. Commencez par les fondamentaux.'),
    ...(libre() ? [el('p', { class: 'note pa-libre' }, icon('ouvert'), 'Profil Formateur : tous les niveaux sont ouverts. Au profil Étudiant, on commence par le niveau Débutant de chaque catégorie.')] : []),
    P.hero,
    el('div', { class: 'co-kpis pa-kpis' },
      el('div', { class: 'co-kpi' }, el('b', {}, `${ld} / ${lt}`), el('span', {}, 'leçons terminées'), bar(ld, lt, 'Leçons terminées')),
      el('div', { class: 'co-kpi' }, el('b', {}, `${et} / ${em}`), el('span', {}, 'étoiles'), bar(et, em, 'Étoiles')),
      el('div', { class: 'co-kpi' }, el('b', {}, `${nvd} / ${nv.length}`), el('span', {}, 'niveaux validés'), bar(nvd, nv.length, 'Niveaux validés')),
      el('div', { class: 'co-kpi' }, el('b', {}, `${worked} / ${inSim}`), el('span', {}, 'compétences du BTS travaillées'), bar(worked, inSim, 'Compétences travaillées'))),
    P.cats,
    el('section', { class: 'co-next', 'aria-label': 'Dans le car' }, el('h4', {}, icon('chef'), `Dans le car : ${xd} / ${xs.length} exercices pratiques faits`),
      el('div', { class: 'co-next-row' },
        nextX && nextXi ? el('button', { type: 'button', class: 'co-next-item', onclick: () => go.lecon(nextX.lesson.id) }, el('small', {}, `Exercice pratique · ${nextX.lesson.title}`), el('b', {}, nextXi.title), el('span', {}, `${nextXi.duration} · ${nextXi.level}`)) : el('p', { class: 'note' }, 'Pas d\'exercice pratique à faire dans les leçons ouvertes.'))),
    // les procédures maison du formateur, quand il en a écrit (Espace formateur, onglet Procédures)
    ...((CFG.car.procedures || []).length ? [el('section', { class: 'co-procs', 'aria-label': 'Procédures du car' }, el('h4', {}, 'Les procédures du car'), (() => { const b = el('div'); proceduresSection(b); return b; })())] : []),
    el('section', { class: 'co-livret', 'aria-label': 'Livret de compétences' }, el('h4', {}, 'Mon livret de compétences (BTS MAV, option TIEE)'),
      el('div', { class: 'co-blocs' }, ...L.blocs.map((b) => { const w = b.count.consolidee + b.count.travaillee; const n = b.comps.length - b.count.absent; return el('div', { class: 'co-bloc' }, el('b', {}, b.id), el('span', {}, b.titre), bar(w, n, b.id), el('small', {}, `${w} / ${n} travaillées`)); })),
      el('div', { class: 'hwrow' }, el('button', { type: 'button', class: 'btn small', onclick: () => openLivret() }, 'Ouvrir le livret complet')),
      el('p', { class: 'note' }, 'Une compétence est travaillée quand une leçon, un exercice ou une tâche qui la font pratiquer est réussi ; consolidée, avec trois réussites dont un exercice pratique fait seul. Le livret dit ce qui a été pratiqué ; la valider reste le rôle du formateur.')));
}
function lessonPage(page, { chapter, lesson }, /** @type {import('./cours_parcours.js').Go} */ go, nav) {
  markSeen(lesson.id);
  const L = lesson;
  const nv = niveauDe(L.id);
  const ordre = ordreDe(chapter.id); const i = ordre.indexOf(L.id);
  // après un quiz ou un exercice : le sommaire et les étapes se mettent à jour, sans redessiner la page
  const maj = () => { drawNav(nav, go); const s = page.querySelector('.pa-steps-box'); if (s) s.replaceWith(etapesLecon(L.id)); };
  page.append(el('p', { class: 'co-crumb' }, icon(chapter.icon), chapter.title, el('span', {}, ' · '), nv ? pastille(nv.niveau) : null, el('span', {}, `${L.partie ? ` · ${L.partie}` : ''} · leçon ${i + 1} / ${ordre.length}`)),
    el('h2', {}, L.title, L.minutes ? el('small', {}, L.minutes) : null),
    etapesLecon(L.id),
    el('section', { class: 'co-ess', id: 'co-lire', 'aria-label': 'L\'essentiel' }, el('h4', {}, 'L\'essentiel'), el('ul', {}, ...L.essentials.map((t) => el('li', {}, rich(t, 'co-rich'))))));
  if (L.figure) { try { page.append(el('div', { class: 'co-figbox' }, L.figure())); } catch (e) { console.error(e); } }
  // la notion en 3D : la scène s'ouvre à l'étape tirée de cette leçon, et « Quitter » ramène ici
  const v3 = vuesDeLecon(L.id);
  if (v3.length) {
    page.append(el('section', { class: 'co-3d', 'aria-label': 'Voir en 3D' }, el('h4', {}, icon('cube'), 'Voir en 3D'),
      ...v3.map((v) => el('div', { class: 'co-3d-item' },
        el('div', {}, el('b', {}, v.titre), el('p', {}, v.resume)),
        el('button', { type: 'button', class: 'btn small primary', 'data-vue': v.id, onclick: () => { closeLayer(false); emit('vue3d', { vue: v.id, lecon: L.id, from: 'cours' }); } }, 'Ouvrir la vue 3D')))));
  }
  // les notions de la caméra en 3D que la leçon reprend : chacune s'ouvre à sa pastille, « Quitter » ramène ici
  const cl = (L.camlab || []).filter((id) => NOTIONS[id]);
  if (cl.length) {
    page.append(el('section', { class: 'co-3d co-camlab', 'aria-label': 'Sur la caméra en 3D' }, el('h4', {}, icon('cube'), 'Sur la caméra en 3D'),
      el('p', { class: 'note' }, 'Chaque notion s\'ouvre sur la caméra de plateau, à sa pastille : la fiche, la manipulation sur la caméra et l\'image du viseur, les trois questions d\'Olivier.'),
      ...cl.map((id) => el('div', { class: 'co-3d-item' + (notionAcquise(id) ? ' acquise' : '') },
        el('div', {}, el('b', {}, NOTIONS[id].t, notionAcquise(id) ? el('small', { class: 'co-acq' }, ' · notion acquise') : null), el('p', {}, NOTIONS[id].short)),
        el('button', { type: 'button', class: 'btn small', 'data-notion': id, onclick: () => { closeLayer(false); emit('camera', { from: 'cours', notion: id, lesson: L.id }); } }, 'Ouvrir sur la caméra')))));
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
  const terms = (L.terms || []).filter((id) => TERMS[id]);
  if (terms.length) page.append(el('section', { class: 'co-terms' }, el('h4', {}, 'Fiches « ? »'), el('div', { class: 'co-chips' }, ...terms.map((id) => el('span', { class: 'co-chip' }, TERMS[id].t, q(id))))));
  // la fin de la leçon : le quiz, puis l'exercice en autonomie ; ensuite, les exercices pratiques dans le car
  const apres = ordre[i + 1] || null;
  const apresOuverte = apres && leconOuverte(apres, PROG, { libre: libre() });
  const suite = apresOuverte ? { label: 'Leçon suivante', go: () => go.lecon(/** @type {string} */ (apres)) } : { label: 'Le parcours du chapitre', go: () => go.chapitre(chapter.id) };
  page.append(quiz(L, maj));
  page.append(exoSection(L, { onChange: maj, suite }));
  const xs = exercisesOf(L);
  if (xs.length) page.append(el('section', { class: 'co-exos', 'aria-label': 'Exercices pratiques dans le car' }, el('h4', {}, icon('chef'), xs.length > 1 ? 'Dans le car : exercices pratiques' : 'Dans le car : exercice pratique'),
    el('p', { class: 'note' }, 'Pour aller plus loin : le geste dans le car, avec Olivier. Ils comptent pour le livret de compétences (« consolidée »).'),
    ...xs.map((x) => exerciseCard(x, L))));
  const avant = ordre[i - 1] ? /** @type {any} */ (lessonById(ordre[i - 1])).lesson : null;
  page.append(el('div', { class: 'co-nextprev' },
    avant ? el('button', { class: 'btn small', onclick: () => go.lecon(avant.id) }, '◀ ' + avant.title) : el('button', { class: 'btn small', onclick: () => go.chapitre(chapter.id) }, '◀ Le parcours du chapitre'),
    apresOuverte ? el('button', { class: 'btn small primary', onclick: () => go.lecon(/** @type {string} */ (apres)) }, /** @type {any} */ (lessonById(/** @type {string} */ (apres))).lesson.title + ' ▶')
      : el('button', { class: 'btn small primary', onclick: () => go.chapitre(chapter.id) }, apres ? 'Le parcours du chapitre (niveau suivant fermé) ▶' : 'Le parcours du chapitre ▶')));
}
// le quiz : trois questions tirées dans la banque de la leçon, réponses mélangées. On choisit ses réponses
// (on peut changer d'avis), puis « Valider » donne le score et le corrigé de chaque question : pourquoi la
// bonne réponse est juste, pourquoi le choix fait est faux. « Refaire le quiz » tire d'autres questions.
function quiz(L, onChange = () => {}) {
  const p = coursProgress(L.id);
  if (!ESSAI || ESSAI.id !== L.id) { const draw = drawQuiz(L.quiz); ESSAI = { id: L.id, draw, answers: draw.map(() => null), checked: false }; }
  const E = ESSAI;
  const box = el('section', { class: 'co-quiz', id: 'co-quiz', 'aria-label': 'Quiz' });
  // la section est redessinée en place ; le focus clavier revient sur l'élément visé
  const redraw = (/** @type {string} */ focus) => { const nb = quiz(L, onChange); box.replaceWith(nb); const f = /** @type {HTMLElement | null} */ (nb.querySelector(focus)); if (f) f.focus(); };
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
      onclick: () => { if (!E.answers.every((x) => x != null)) return; E.checked = true; recordQuiz(L.id, score, n); onChange(); redraw('.co-score'); },
    }, 'Valider mes réponses'), all ? null : el('small', {}, `${E.answers.filter((x) => x != null).length} / ${n} répondues`)));
  } else {
    box.append(el('p', { class: 'co-score', tabindex: '-1', role: 'status' }, el('b', {}, `${score} / ${n}`), score === n ? (etatLecon(L.id, PROG).terminee ? ' : quiz réussi, leçon terminée.' : exoOf(L.id) ? ' : quiz réussi. Reste l\'exercice en autonomie, juste en dessous.' : ' : quiz réussi, leçon terminée.') : ' : relisez l\'essentiel et refaites le quiz (d\'autres questions seront tirées).',
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
