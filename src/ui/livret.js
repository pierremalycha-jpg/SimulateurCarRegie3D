// @ts-check
import { S } from '../state.js';
import { el } from '../util.js';
import { PROG } from '../shared.js';
import { LESSONS, lessonsDone } from '../tutor/engine.js';
import { CHAPTERS, lessonDone } from '../cours/index.js';
import { NET_MISSIONS } from '../net/course.js';

// ----------------------------------------------------------------------------------
// Le livret du stagiaire (fenêtre « Missions et livret », onglet Livret) : ce que l'on a fait, par
// famille, lu dans la progression enregistrée (shared.js PROG, la même que le suivi du formateur).
// Missions du parcours d'intégration, parcours du chef de car par domaine, leçons des cours,
// scénarios jour de match, brassage, montage caméra, parcours réseau ST 2110.
// ----------------------------------------------------------------------------------
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
function bar(a, b, label) {
  return el('div', { class: 'lv-row' }, el('span', { class: 'lv-l' }, label), el('div', { class: 'lv-bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(b), 'aria-valuenow': String(a), 'aria-label': label }, el('i', { style: { width: pct(a, b) + '%' } })), el('b', { class: 'lv-v' }, `${a} / ${b}`));
}
const best = (a) => (a && a.length ? Math.max(...a.map((x) => x.score || 0)) : null);
/** @param {HTMLElement} content @param {Array<{ id: string, title: string }>} missions */
export function livretInto(content, missions) {
  const mDone = missions.filter((m) => S.missionsDone[m.id]).length;
  const tDone = new Set(lessonsDone());
  const domains = [...new Set(LESSONS.map((l) => l.domain))];
  const cours = CHAPTERS.map((c) => [c.title, c.lessons.filter((l) => lessonDone(l.id)).length, c.lessons.length]);
  const sc = PROG.scenarios || [], N = PROG.net || { missions: {}, quiz: [], exams: [] };
  const netDone = NET_MISSIONS.filter((m) => (N.missions || {})[m.id]).length;
  const rigs = PROG.rigs || []; const rig = rigs.slice().sort((x, y) => x.errs - y.errs || x.sec - y.sec)[0];
  content.append(el('p', { class: 'note' }, 'Votre livret : tout ce que vous avez fait dans le simulateur, enregistré sur cet ordinateur (et chez le formateur quand la page est partagée). Les barres se remplissent toutes seules.'),
    el('section', { class: 'lv-sec' }, el('h3', {}, 'Le parcours d\'intégration'), bar(mDone, missions.length, 'Missions'),
      el('p', { class: 'lv-note' }, mDone === missions.length ? 'Parcours terminé.' : `Prochaine mission : ${(missions.find((m) => !S.missionsDone[m.id]) || {}).title || '—'}.`)),
    el('section', { class: 'lv-sec' }, el('h3', {}, 'Les parcours du chef de car'),
      ...domains.map((d) => { const L = LESSONS.filter((l) => l.domain === d); return bar(L.filter((l) => tDone.has(l.id)).length, L.length, d); }),
      el('p', { class: 'lv-note' }, 'Touche J : le chef propose les parcours du poste où vous êtes.')),
    el('section', { class: 'lv-sec' }, el('h3', {}, 'Les cours'),
      ...(cours.length ? cours.map(([t, a, b]) => bar(a, b, t)) : [el('p', { class: 'note' }, 'Les chapitres arrivent.')]),
      el('p', { class: 'lv-note' }, 'Une leçon est acquise quand son quiz est réussi en entier (touche G).')),
    el('section', { class: 'lv-sec' }, el('h3', {}, 'Les exercices'),
      el('dl', { class: 'lv-kv' },
        el('dt', {}, 'Jour de match (scénario)'), el('dd', {}, sc.length ? `meilleur score ${best(sc)} % · ${sc.length} partie${sc.length > 1 ? 's' : ''}` : 'pas encore joué'),
        el('dt', {}, 'Brassage du car vide'), el('dd', {}, PROG.patchBest ? `meilleur résultat ${PROG.patchBest} %` : 'pas encore fait'),
        el('dt', {}, 'Montage d\'une caméra'), el('dd', {}, rig ? `${rig.errs} erreur${rig.errs > 1 ? 's' : ''} · ${Math.floor(rig.sec / 60)} min${rigs.length > 1 ? ` (${rigs.length} essais)` : ''}` : 'pas encore fait'),
        el('dt', {}, 'Parcours réseau ST 2110'), el('dd', {}, netDone ? `${netDone} / ${NET_MISSIONS.length} missions` : 'pas encore commencé'),
        el('dt', {}, 'Quiz 2110'), el('dd', {}, best(N.quiz) != null ? `meilleur score ${best(N.quiz)} %` : '—'),
        el('dt', {}, 'Examen réseau'), el('dd', {}, best(N.exams) != null ? `meilleur score ${best(N.exams)} %` : '—'))),
    el('p', { class: 'note' }, PROG.updatedAt ? `Dernière activité enregistrée : ${new Date(PROG.updatedAt).toLocaleString('fr-FR')}.` : ''));
}
