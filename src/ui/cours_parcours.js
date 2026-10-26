// @ts-check
import { el } from '../util.js';
import { rich } from './rich.js';
import { icon } from './icons.js';
import { PROG } from '../shared.js';
import { CHAPTERS, lessonById, recordTest } from '../cours/index.js';
import { etatNiveaux, etatLecon, niveauDe, bilanChapitre, conditions, suivante, leconsDuTest, tirerTest, testPasse, aReussir, NIVEAUX, SEUIL_TEST } from '../cours/parcours.js';
import { SEUIL_EXO } from '../cours/exo.js';
import { isTrainer } from '../app/profile.js';
import { etoiles } from './cours_exo.js';

// ----------------------------------------------------------------------------------
// Le parcours du Cours à l'écran (cours/parcours.js), à la façon de Duolingo : sur « Mon parcours », la
// leçon à faire ensuite et une tuile par catégorie (chapitre) avec son niveau ; dans un chapitre, le
// chemin de ses leçons, niveau par niveau (Débutant, Intermédiaire, Avancé, Expert), avec les étoiles de
// chaque leçon, le cadenas des niveaux fermés et, au bout de chaque niveau, les conditions pour ouvrir le
// suivant ; le test de niveau pour sauter ce que l'on sait déjà ; l'aperçu d'une leçon encore fermée. Au
// profil Formateur, tout est ouvert. ui/cours_ui.js range ces vues dans l'onglet Leçons.
// ----------------------------------------------------------------------------------
/** @typedef {{ lecon: (id: string) => void, chapitre: (id: string) => void, accueil: () => void, test: (ch: string, niveau: string) => void, render: () => void }} Go */
export const libre = () => isTrainer();
const RAISON = { commencer: 'Nouvelle leçon', quiz: 'Le quiz reste à réussir', exercice: 'L\'exercice reste à réussir', ameliorer: 'Refaire l\'exercice avec moins d\'aide : la moyenne du niveau manque' };
const BOUTON = { commencer: 'Commencer', quiz: 'Reprendre', exercice: 'Reprendre', ameliorer: 'Refaire l\'exercice' };

/** la pastille d'un niveau : son nom, coloré selon le rang */
export const pastille = (/** @type {{ id: string, titre: string }} */ n, extra = '') => el('span', { class: `pa-pill pa-${n.id}` }, n.titre + extra);
/** l'échelle des niveaux d'un chapitre : un plot par niveau (validé, ouvert, fermé) */
function echelle(N) {
  return el('span', { class: 'pa-ladder', role: 'img', 'aria-label': N.map((n) => `${n.niveau.titre} : ${n.valide ? 'validé' : n.ouvert ? 'ouvert' : 'fermé'}`).join(', ') },
    ...N.map((n) => el('i', { class: `pa-${n.niveau.id}` + (n.valide ? ' ok' : n.ouvert ? ' on' : ''), title: n.niveau.titre })));
}

// ---------------- Mon parcours : la suite, et une tuile par catégorie ----------------
export function accueilParcours(/** @type {Go} */ go) {
  const o = { libre: libre() };
  const next = suivante(PROG, o);
  const f = next ? lessonById(next.id) : null, nv = next ? niveauDe(next.id) : null;
  const B = CHAPTERS.map((c) => ({ c, b: bilanChapitre(c.id, PROG, o) }));
  const hero = el('section', { class: 'pa-hero', 'aria-label': 'Continuer' },
    f && nv && next ? el('div', { class: 'pa-hero-in' },
      el('span', { class: 'pa-hero-ico' }, icon(f.chapter.icon)),
      el('div', {}, el('small', {}, pastille(nv.niveau), ` ${f.chapter.title} · ${RAISON[next.raison]}`), el('b', {}, f.lesson.title), el('span', {}, f.lesson.minutes ? `${f.lesson.minutes} de lecture, puis le quiz et l'exercice` : 'La leçon, puis le quiz et l\'exercice')),
      el('button', { type: 'button', class: 'btn primary pa-continuer', onclick: () => go.lecon(next.id) }, BOUTON[next.raison]))
      : el('p', { class: 'note' }, 'Tous les niveaux ouverts sont validés. Bravo !'));
  const cats = el('section', { class: 'pa-cats', 'aria-label': 'Les catégories' }, el('h4', {}, icon('parcours'), 'Les catégories'),
    el('div', { class: 'pa-grid' }, ...B.map(({ c, b }) => el('button', { type: 'button', class: 'pa-cat' + (b.fini ? ' fini' : ''), 'data-chapitre': c.id, onclick: () => go.chapitre(c.id) },
      el('span', { class: 'pa-cat-ico' }, icon(c.icon)),
      el('span', { class: 'pa-cat-t' }, el('b', {}, c.title), el('small', {}, b.fini ? 'Tous les niveaux validés' : b.courant ? `Niveau ${b.courant.niveau.titre}` : '')),
      echelle(b.niveaux),
      el('span', { class: 'co-bar', role: 'img', 'aria-label': `Leçons terminées : ${b.terminees} sur ${b.lecons}` }, el('i', { style: { width: `${b.lecons ? Math.round(100 * b.terminees / b.lecons) : 0}%` } })),
      el('span', { class: 'pa-cat-n' }, `${b.terminees} / ${b.lecons} leçons`, el('span', {}, icon('etoilePleine', 'on'), `${b.etoiles} / ${b.max}`))))));
  return { hero, cats, bilans: B };
}

// ---------------- le chemin d'un chapitre ----------------
export function cheminChapitre(page, ch, /** @type {Go} */ go, modules = /** @type {HTMLElement[]} */ ([])) {
  const o = { libre: libre() };
  const b = bilanChapitre(ch.id, PROG, o);
  page.append(el('p', { class: 'co-crumb' }, icon(ch.icon), ch.title, el('span', {}, ` · ${b.terminees} / ${b.lecons} leçons terminées`)),
    el('h2', {}, ch.title),
    el('p', { class: 'lede' }, ch.intro));
  if (o.libre) page.append(el('p', { class: 'note pa-libre' }, icon('ouvert'), 'Profil Formateur : tous les niveaux sont ouverts. Au profil Étudiant, chacun s\'ouvre quand le précédent est validé.'));
  if (modules.length) page.append(el('div', { class: 'pa-modules' }, ...modules));
  // la leçon à faire : la première non terminée du premier niveau ouvert et pas encore validé
  const courant = b.niveaux.find((n) => n.ouvert && !n.valide);
  const cible = courant ? courant.lecons[courant.etats.findIndex((e) => !e.terminee)] : null;
  b.niveaux.forEach((n, i) => {
    const etat = n.valide ? 'valide' : n.ouvert ? 'ouvert' : 'ferme';
    const sec = el('section', { class: `pa-niv ${etat} pa-${n.niveau.id}`, 'data-niveau': n.niveau.id, 'aria-label': `Niveau ${n.niveau.titre}` });
    sec.append(el('header', { class: 'pa-niv-h' },
      el('div', {}, el('h3', {}, n.ouvert ? null : icon('cadenas'), n.niveau.titre), el('small', {}, n.niveau.sous)),
      el('span', { class: 'pa-niv-etat' }, n.valide ? (n.parTest ? 'Validé par le test' : 'Validé') : n.ouvert ? `${n.terminees} / ${n.lecons.length} leçons` : 'Fermé'),
      el('span', { class: 'pa-niv-stars' }, icon('etoilePleine', 'on'), `${n.etoiles} / ${n.max}`)));
    if (!n.ouvert) {
      const avant = b.niveaux.slice(0, i).filter((x) => !x.valide);
      const nq = Math.min(12, Math.max(6, 2 * leconsDuTest(ch.id, n.niveau.id, PROG).length));
      sec.append(el('div', { class: 'pa-ferme' },
        el('p', {}, `Ce niveau s'ouvre quand ${avant.length > 1 ? 'les niveaux' : 'le niveau'} ${avant.map((x) => x.niveau.titre).join(', ')} ${avant.length > 1 ? 'sont validés' : 'est validé'}. Vous connaissez déjà ces notions ? Le test de niveau les vérifie : ${nq} questions, ${Math.round(SEUIL_TEST * 100)} % de bonnes réponses.`),
        el('button', { type: 'button', class: 'btn small pa-test-btn', 'data-niveau': n.niveau.id, onclick: () => go.test(ch.id, n.niveau.id) }, icon('ouvert'), `Passer le test pour ouvrir ${n.niveau.titre}`)));
    }
    sec.append(el('ol', { class: 'pa-path' }, ...n.lecons.map((id, k) => {
      const L = /** @type {any} */ (lessonById(id)).lesson; const e = n.etats[k];
      const st = !n.ouvert ? 'lock' : e.terminee ? 'done' : id === cible ? 'cur' : e.quiz || e.exo != null ? 'part' : 'open';
      return el('li', { class: `pa-step st-${st}` },
        el('button', { type: 'button', class: 'pa-node', 'data-lesson': id, 'aria-label': `${L.title} : ${st === 'lock' ? 'fermée' : st === 'done' ? 'terminée' : st === 'cur' ? 'à faire maintenant' : 'ouverte'}, ${e.etoiles} étoile${e.etoiles > 1 ? 's' : ''} sur 3`, onclick: () => go.lecon(id) },
          el('span', { class: 'pa-disc' }, st === 'lock' ? icon('cadenas') : st === 'done' ? icon('fait') : String(k + 1))),
        el('div', { class: 'pa-node-t' }, st === 'cur' ? el('em', {}, 'À faire') : null, el('b', {}, L.title), L.partie ? el('small', {}, L.partie) : null, etoiles(e.etoiles, 3, 'small')));
    })));
    // au bout du niveau : ce qu'il faut pour ouvrir le suivant
    const suivant = b.niveaux[i + 1];
    if (n.ouvert && !n.valide && suivant) {
      sec.append(el('div', { class: 'pa-palier' }, el('b', {}, icon('trophee'), `Pour ouvrir le niveau ${suivant.niveau.titre}`),
        el('ul', {}, ...conditions(n).map((c) => el('li', { class: c.ok ? 'ok' : '' }, icon(c.ok ? 'fait' : 'cadenas'), c.texte)))));
    } else if (n.valide && suivant) sec.append(el('p', { class: 'pa-palier ok' }, icon('trophee'), `Niveau ${n.niveau.titre} validé : ${suivant.niveau.titre} est ouvert.`));
    else if (n.valide && !suivant) sec.append(el('p', { class: 'pa-palier ok' }, icon('trophee'), `Dernier niveau du chapitre validé : vous avez fait tout « ${ch.title} ».`));
    page.append(sec);
  });
}

// ---------------- une leçon encore fermée ----------------
export function apercuFerme(page, { chapter, lesson }, /** @type {Go} */ go) {
  const nv = niveauDe(lesson.id); if (!nv) return;
  const N = etatNiveaux(chapter.id, PROG);
  const bloque = N.filter((x) => x.k < nv.k && !x.valide);
  page.append(el('p', { class: 'co-crumb' }, icon(chapter.icon), chapter.title, el('span', {}, ' · '), pastille(nv.niveau)),
    el('h2', {}, lesson.title, lesson.minutes ? el('small', {}, lesson.minutes) : null),
    el('section', { class: 'pa-lock', 'aria-label': 'Leçon fermée' },
      el('p', {}, icon('cadenas'), el('b', {}, `Cette leçon est au niveau ${nv.niveau.titre} du chapitre « ${chapter.title} ».`), ` Elle s'ouvre quand ${bloque.length > 1 ? 'les niveaux' : 'le niveau'} ${bloque.map((x) => x.niveau.titre).join(', ')} ${bloque.length > 1 ? 'sont validés' : 'est validé'} : on passe d'abord par les fondamentaux.`),
      ...bloque.slice(0, 1).map((x) => el('ul', {}, ...conditions(x).map((c) => el('li', { class: c.ok ? 'ok' : '' }, icon(c.ok ? 'fait' : 'cadenas'), `${x.niveau.titre} · ${c.texte}`)))),
      el('div', { class: 'hwrow' },
        el('button', { type: 'button', class: 'btn primary', onclick: () => go.chapitre(chapter.id) }, icon('parcours'), 'Voir le parcours du chapitre'),
        el('button', { type: 'button', class: 'btn pa-test-btn', onclick: () => go.test(chapter.id, nv.niveau.id) }, icon('ouvert'), `Passer le test pour ouvrir ${nv.niveau.titre}`))),
    el('section', { class: 'co-ess', 'aria-label': 'Au programme' }, el('h4', {}, 'Au programme de cette leçon'), el('ul', {}, ...lesson.essentials.map((t) => el('li', {}, rich(t, 'co-rich'))))));
}

// ---------------- les trois étapes d'une leçon ----------------
export function etapesLecon(/** @type {string} */ id) {
  const e = etatLecon(id, PROG);
  const step = (n, label, ok, cible, info) => el('li', { class: ok ? 'ok' : '' }, el('a', { href: '#' + cible, onclick: (ev) => { ev.preventDefault(); const t = document.getElementById(cible); if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }, el('span', { class: 'pa-dot' }, ok ? icon('fait') : String(n)), el('span', {}, label, info ? el('small', {}, info) : null)));
  return el('div', { class: 'pa-steps-box' },
    el('ol', { class: 'pa-steps', 'aria-label': 'Les étapes de la leçon' },
      step(1, 'Apprendre', true, 'co-lire', ''),
      step(2, 'Quiz', e.quiz, 'co-quiz', e.quiz ? 'réussi' : '3 sur 3'),
      e.aExo ? step(3, 'Exercice', e.exo != null && e.exo >= SEUIL_EXO, 'co-exoauto', e.exo != null ? `${e.exo} / 100` : `${SEUIL_EXO} sur 100`) : null),
    etoiles(e.etoiles), e.terminee ? el('span', { class: 'pill ok' }, 'Leçon terminée') : null);
}

// ---------------- le test de niveau ----------------
/** @type {{ ch: string, niveau: string, lecons: string[], draw: ReturnType<typeof tirerTest>, answers: (number | null)[], checked: boolean } | null} */
let TEST = null;
export function nouveauTest(ch, niveau) {
  const lecons = leconsDuTest(ch, niveau, PROG);
  const draw = tirerTest(lecons);
  TEST = { ch, niveau, lecons, draw, answers: draw.map(() => null), checked: false };
  return TEST;
}
export const testEnCours = () => TEST;
export const finirTest = () => { TEST = null; };
export function pageTest(page, /** @type {Go} */ go) {
  const T = TEST; if (!T) return;
  const ch = CHAPTERS.find((c) => c.id === T.ch); const nv = NIVEAUX.find((n) => n.id === T.niveau);
  if (!ch || !nv) return;
  const n = T.draw.length, need = aReussir(n);
  const box = el('section', { class: 'pa-testpage co-quiz', 'aria-label': 'Test de niveau' });
  const redraw = (/** @type {string} */ focus) => { page.replaceChildren(); pageTest(page, go); const f = /** @type {HTMLElement | null} */ (page.querySelector(focus)); if (f) f.focus(); };
  page.append(el('p', { class: 'co-crumb' }, icon(ch.icon), ch.title, el('span', {}, ' · test de niveau')),
    el('h2', {}, `Ouvrir le niveau ${nv.titre}`),
    el('p', { class: 'lede' }, `${n} questions tirées des quiz des leçons que vous sautez (${T.lecons.length} leçon${T.lecons.length > 1 ? 's' : ''}). Il faut en réussir ${need}. Réussi, le niveau ${nv.titre} s'ouvre ; les leçons sautées restent à faire quand vous voulez, pour leurs étoiles et le livret.`));
  const text = (c) => (Array.isArray(c) ? c[0] : c);
  T.draw.forEach((d, qi) => {
    const L = /** @type {any} */ (lessonById(d.lesson)).lesson; const Q = L.quiz[d.i];
    const a = T.answers[qi];
    box.append(el('div', { class: 'co-q', 'data-q': String(qi) }, el('p', {}, `${qi + 1}. ${Q.q}`), el('small', { class: 'pa-src' }, L.title),
      el('div', { class: 'co-choices', role: 'group', 'aria-label': `Question ${qi + 1}` }, ...d.order.map((c) => el('button', {
        type: 'button', 'data-c': String(c), class: 'btn small co-choice-btn' + (a === c ? ' sel' : '') + (T.checked && c === Q.answer ? ' good' : '') + (T.checked && a === c && c !== Q.answer ? ' bad' : ''),
        'aria-pressed': a === c ? 'true' : 'false', disabled: T.checked, onclick: () => { T.answers[qi] = c; redraw(`.co-q[data-q="${qi}"] [data-c="${c}"]`); },
      }, text(Q.choices[c])))),
      T.checked && a != null && a !== Q.answer ? el('div', { class: 'co-why' }, rich(`**C'est « ${text(Q.choices[Q.answer])} ».** ${Q.why}`, 'co-rich')) : null));
  });
  const score = T.draw.filter((d, qi) => T.answers[qi] === /** @type {any} */ (lessonById(d.lesson)).lesson.quiz[d.i].answer).length;
  if (!T.checked) {
    const all = T.answers.every((x) => x != null);
    box.append(el('div', { class: 'co-score' }, el('button', { type: 'button', class: 'btn primary co-valider', disabled: !all, onclick: () => { T.checked = true; recordTest(T.ch, T.niveau, score, n); redraw('.co-score'); } }, 'Valider le test'),
      all ? null : el('small', {}, `${T.answers.filter((x) => x != null).length} / ${n} répondues`),
      el('button', { type: 'button', class: 'btn small', onclick: () => { finirTest(); go.chapitre(T.ch); } }, 'Abandonner')));
  } else {
    const ok = testPasse(score, n);
    box.append(el('div', { class: 'co-score pa-test-res' + (ok ? ' ok' : ''), tabindex: '-1', role: 'status' },
      el('b', {}, `${score} / ${n}`), ok ? ` : réussi, le niveau ${nv.titre} est ouvert.` : ` : il en fallait ${need}. Faites les leçons du niveau, ou retentez le test (d'autres questions).`,
      ok ? el('button', { type: 'button', class: 'btn primary', onclick: () => { finirTest(); go.chapitre(T.ch); } }, 'Voir le parcours') : el('button', { type: 'button', class: 'btn', onclick: () => { nouveauTest(T.ch, T.niveau); redraw('.co-choice-btn'); } }, 'Refaire le test'),
      ok ? null : el('button', { type: 'button', class: 'btn small', onclick: () => { finirTest(); go.chapitre(T.ch); } }, 'Retour au parcours')));
  }
  page.append(box);
}
