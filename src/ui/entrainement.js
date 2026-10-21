// @ts-check
import { S, emit, on } from '../state.js';
import { el } from '../util.js';
import { openLayer, layerOpen, showTab } from './layer.js';
import { icon } from './icons.js';
import { lessonFamilies } from './tutor_ui.js';
import { TUTOR, progressOf } from '../tutor/engine.js';
import { MISSIONS, missionsSection } from './guide.js';
import { PROG } from '../shared.js';
import { NET_MISSIONS } from '../net/course.js';
import { livretPanel, liveProg } from './livret.js';
import { codesOf } from '../livret.js';

// ----------------------------------------------------------------------------------
// L'espace S'entraîner, plein écran : tout ce qui fait progresser, avec où l'on en est. Les
// parcours du chef de car (par famille, dans l'ordre d'une journée de car), les exercices notés
// (jour de match, brassage, atelier de montage, formation réseau), les missions d'installation et
// le livret de compétences du référentiel TIEE, qui fait le bilan de tout cela.
// Un bouton lance ce qu'il faut : le car s'il n'est pas encore lancé, le parcours, le poste.
// ----------------------------------------------------------------------------------
const TABS = /** @type {[string, string][]} */ ([['parcours', 'Avec le chef de car'], ['exercices', 'Exercices notés'], ['missions', 'Missions d\'installation'], ['livret', 'Mon livret']]);
const PRESENT = 'Les postes du car';
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
const bar = (done, total) => el('span', { class: 'tr-bar', role: 'img', 'aria-label': `${done} sur ${total}` }, el('i', { style: { width: `${total ? (done / total) * 100 : 0}%` } }));

/** @param {string} [tab] parcours, exercices, missions, livret */
export function openEntrainement(tab = 'parcours') {
  if (layerOpen() === 'entrainement') { showTab(tab); return; }
  openLayer({ kind: 'entrainement', title: 'S\'entraîner', ico: 'entrainement', tabs: TABS, tab, show: (k, box) => ({ parcours, exercices, missions, livret })[k](box) });
}
on('entrainement', (tab) => openEntrainement(typeof tab === 'string' ? tab : 'parcours'));

// ---------------- les parcours du chef de car ----------------
function lessonRow(l) {
  const p = progressOf(l.id); const cur = TUTOR.lesson && TUTOR.lesson.id === l.id;
  return el('li', { class: 'tr-lesson' + (p.done ? ' done' : '') },
    el('i', { class: 'co-led' + (p.done ? ' green' : cur ? ' amber' : '') }),
    el('span', { class: 'tr-l' }, el('b', {}, l.title), el('small', {}, `${l.duration} · ${l.level}${p.done ? ' · fait' : cur ? ' · en cours' : ''}`, comps(l)), el('span', {}, l.summary)),
    el('button', { type: 'button', class: 'btn small' + (p.done ? '' : ' primary'), 'data-lesson': l.id, onclick: () => emit('go', { lesson: l.id, label: l.title }) }, cur ? 'Reprendre' : p.done ? 'Refaire' : 'Commencer'));
}
// compétences du référentiel travaillées par le parcours (voir « Mon livret »)
function comps(l) {
  const c = codesOf('parcours', l.id);
  return c.length ? ` · compétence${c.length > 1 ? 's' : ''} ${c.join(', ')}` : '';
}
function parcours(box) {
  const fams = lessonFamilies();
  const all = fams.flatMap((f) => f.lessons); const done = all.filter((l) => progressOf(l.id).done).length;
  box.append(el('div', { class: 'tr-intro' },
    el('div', { class: 'co-say' }, el('span', { class: 'co-who' }, 'Olivier'),
      el('p', {}, 'Je t\'accompagne pas à pas : je t\'explique, tu fais, je vérifie. Choisis un parcours, je lance le car si besoin et je t\'emmène au bon poste. Si tu découvres le car, commence par « Prise en main ».')),
    el('p', { class: 'tr-sum' }, el('b', {}, `${done} / ${all.length}`), ' parcours terminés', bar(done, all.length))));
  const grid = el('div', { class: 'tr-fams' });
  for (const f of fams) {
    const n = f.lessons.filter((l) => progressOf(l.id).done).length;
    const head = el('h3', {}, icon(f.icon), el('span', {}, f.dom), el('small', {}, `${n} / ${f.lessons.length}`));
    // la présentation des postes : une touche par poste, plus compacte
    if (f.dom === PRESENT) {
      grid.append(el('section', { class: 'tr-fam plate wide', 'aria-label': f.dom }, head,
        el('p', { class: 'note' }, 'Olivier te présente chaque poste : à quoi il sert, ce qu\'on y regarde, les gestes de base. Quelques minutes chacun.'),
        el('ul', { class: 'tr-keys' }, ...f.lessons.map((l) => el('li', {}, el('button', { type: 'button', class: 'tr-key' + (progressOf(l.id).done ? ' done' : ''), 'data-lesson': l.id, title: l.summary, onclick: () => emit('go', { lesson: l.id, label: l.title }) },
          el('i', { class: 'co-led' + (progressOf(l.id).done ? ' green' : '') }), el('span', {}, l.title.replace(/^Présente-moi : /, ''))))))));
      continue;
    }
    grid.append(el('section', { class: 'tr-fam plate', 'aria-label': f.dom }, head, bar(n, f.lessons.length), el('ul', { class: 'tr-lessons' }, ...f.lessons.map(lessonRow))));
  }
  box.append(grid);
}

// ---------------- les exercices notés ----------------
function exercise(ico, title, text, status, actions) {
  return el('section', { class: 'tr-ex plate' },
    el('h3', {}, icon(ico), el('span', {}, title)),
    el('p', {}, text),
    el('p', { class: 'tr-status' + (status.ok ? ' ok' : '') }, el('i', { class: 'co-led' + (status.ok ? ' green' : status.some ? ' amber' : '') }), status.text),
    el('div', { class: 'hwrow' }, ...actions));
}
const act = (label, target, primary = false) => el('button', { type: 'button', class: 'btn small' + (primary ? ' primary' : ''), onclick: () => emit('go', { label, ...target }) }, label);
function exercices(box) {
  const sc = PROG.scenarios || []; const best = sc.reduce((m, s) => Math.max(m, s.score || 0), 0);
  const rigs = PROG.rigs || []; const rb = rigs.slice().sort((x, y) => x.errs - y.errs || x.sec - y.sec)[0];
  const N = PROG.net || { missions: {}, quiz: [], exams: [] }; const nd = NET_MISSIONS.filter((m) => (N.missions || {})[m.id]).length;
  const bestOf = (a) => (a && a.length ? Math.max(...a.map((x) => x.score || 0)) : null);
  const quiz = bestOf(N.quiz), exam = bestOf(N.exams);
  const md = MISSIONS.filter((m) => S.missionsDone[m.id]).length;
  const inGame = S.mode !== 'start';
  box.append(el('p', { class: 'note tr-lede' }, inGame
    ? 'Chaque exercice part d\'une vacation à lui : le lancer arrête la partie en cours et repart de la feuille de service. Ta progression est gardée.'
    : 'Chaque exercice lance sa vacation avec les conditions de captation de la feuille de service. Les résultats sont enregistrés, et le formateur les retrouve dans l\'Espace formateur.'),
  el('div', { class: 'tr-exs' },
    exercise('realisateur', 'Jour de match', 'De 17 h 30 à l\'antenne : line-up des caméras, test de ligne avec la chaîne, puis le direct, avec des pannes à résoudre. Chronométré et noté.',
      sc.length ? { ok: best >= 80, some: true, text: `Meilleur score : ${best} % (${plural(sc.length, 'vacation')})` } : { text: 'Pas encore joué' },
      [act('Lancer le jour de match', { preset: 'scenario' }, true)]),
    exercise('brassage', 'Le car vide', 'Rien n\'est brassé : reliez chaque liaison au bon endroit en suivant la liste de câblage, jusqu\'à ce que le multiview soit complet.',
      PROG.patchBest ? { ok: PROG.patchBest >= 100, some: true, text: `Brassage réussi à ${PROG.patchBest} %` } : { text: 'Pas encore fait' },
      [act('Brasser le car', { preset: 'brassage' }, true)]),
    exercise('ccu', 'Atelier de montage', 'Monter une caméra de stade pièce par pièce, du pied jusqu\'à la fibre, puis la régler. Le temps et les erreurs sont notés.',
      rb ? { ok: rb.errs === 0, some: true, text: `Meilleur montage : ${plural(rb.errs, 'erreur')}, ${Math.floor(rb.sec / 60)} min (${plural(rigs.length, 'essai')})` } : { text: 'Pas encore fait' },
      [act('Monter une caméra', { preset: 'atelier' }, true)]),
    exercise('reseau', 'Formation réseau ST 2110', 'Quatorze missions dans le poste Réseau IP, de la lecture de la topologie au dépannage, puis un quiz et un examen de trois pannes cachées. Dans le car IP.',
      nd || quiz != null || exam != null ? { ok: nd === NET_MISSIONS.length, some: true, text: `${nd} / ${NET_MISSIONS.length} missions · quiz ${quiz != null ? quiz + ' %' : '—'} · examen ${exam != null ? exam + ' %' : '—'}` } : { text: 'Pas encore commencée' },
      [act('Ouvrir la formation', { station: 'reseau', tab: 'learn', ip: true }, true)]),
    exercise('plan', 'Installer le car', 'Stade vide, à 8 h : placer, câbler et régler les caméras en suivant vingt missions guidées, jusqu\'au premier enchaîné et au premier dépannage.',
      md ? { ok: md === MISSIONS.length, some: true, text: `${md} / ${MISSIONS.length} missions réussies` } : { text: 'Pas encore commencé' },
      [act('Installer le car', { preset: 'vierge' }, true), el('button', { type: 'button', class: 'btn small', onclick: () => showTab('missions') }, 'Voir les missions')])));
}

// ---------------- les missions d'installation ----------------
function missions(box) {
  const md = MISSIONS.filter((m) => S.missionsDone[m.id]).length;
  box.classList.add('ly-narrow');
  box.append(el('p', { class: 'note' }, 'Un parcours d\'intégration pas à pas, du câblage d\'une caméra au dépannage. Les missions se valident toutes seules quand vous agissez ; la mission en cours s\'affiche en haut à gauche de l\'écran.'),
    el('p', { class: 'tr-sum' }, el('b', {}, `${md} / ${MISSIONS.length}`), ' missions réussies', bar(md, MISSIONS.length)),
    el('div', { class: 'hwrow' }, act('Installer le car (stade vide)', { preset: 'vierge' }, true)));
  const list = el('div'); missionsSection(list); box.append(list);
}

// ---------------- le livret de compétences ----------------
function livret(box) {
  box.classList.add('ly-narrow');
  box.append(el('p', { class: 'note tr-lede' }, 'Ce que tu as pratiqué dans le simulateur, rangé selon le référentiel du BTS (option TIEE) : chaque parcours, mission ou exercice réussi fait avancer les compétences qu\'il travaille.'),
    livretPanel(liveProg()));
}
