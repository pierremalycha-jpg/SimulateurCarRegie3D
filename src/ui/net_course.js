// @ts-check
import { S, emit } from '../state.js';
import { el, mmss } from '../util.js';
import { modal, ask } from './common.js';
import { explain } from './widgets.js';
import { NC, NET_MISSIONS, startMission, stopMission, answer, qText, objectivesOf, hint, missionScore, courseTotals, resetCourse, newQuiz, saveQuiz, startExam, endExam, closeExam, examReportHTML, EXAM_TIME } from '../net/course.js';
import { PROG } from '../shared.js';
import { offerDownload } from '../shared.js';

// ----------------------------------------------------------------------------------
// Onglet « Formation » du poste Réseau IP : parcours de missions ST 2110, quiz, examen.
// ----------------------------------------------------------------------------------
const net = () => PROG.net || { missions: {}, quiz: [], exams: [] };

export function tabCourse(box, R) {
  if (NC.exam) { examPanel(box, R); return; }
  const T = courseTotals();
  const best = (a) => (a.length ? Math.max(...a.map((x) => x.score)) + ' %' : '—');
  box.append(el('div', { class: 'hwpanel' },
    el('div', { class: 'hwrow' }, el('h3', {}, 'Parcours ST 2110'), el('span', { class: 'pill ' + (T.done === T.total ? 'ok' : '') }, `${T.done} / ${T.total} missions · ${T.pts} / ${T.max} points`), el('span', { class: 'pill' }, `Quiz : ${best(net().quiz)}`), el('span', { class: 'pill' }, `Examen : ${best(net().exams)}`)),
    el('div', { class: 'net-progress' }, el('i', { style: { width: (T.done / T.total * 100) + '%' } })),
    el('p', { class: 'note' }, 'Quatorze missions, de la lecture de la topologie au dépannage et à la reconstruction d\'une leaf. Les objectifs se cochent tout seuls quand vous agissez dans le poste (ou dans d\'autres postes du car). Chaque mission vaut 10 points : −2 par indice, −5 si vous chargez la configuration de référence. Résultats enregistrés dans votre suivi (visible du formateur).'),
    el('div', { class: 'hwrow' },
      el('button', { class: 'btn small primary', onclick: () => openQuiz(R) }, 'Quiz ST 2110 (10 questions)'),
      el('button', { class: 'btn small', onclick: async () => { if (!(await ask('Lancer l\'examen réseau ? Trois pannes cachées vont être injectées l\'une après l\'autre (15 min maximum). Le réseau est d\'abord remis en configuration de référence.', { title: 'Examen réseau', ok: 'Lancer l\'examen' }))) return; startExam(); R.refresh(); } }, 'Examen réseau (3 pannes, 15 min)'),
      el('button', { class: 'btn small', onclick: () => emit('openGuide', 'reseau') }, 'Cours : réseau spine-leaf'),
      el('button', { class: 'btn small', onclick: () => emit('openGuide', 'mesure2110') }, 'Cours : mesurer un flux 2110'),
      el('button', { class: 'btn small', onclick: async () => { if (await ask('Effacer votre progression sur le parcours réseau ?', { title: 'Recommencer le parcours réseau', ok: 'Effacer ma progression', danger: true })) { resetCourse(); R.refresh(); } } }, 'Recommencer le parcours'))));
  if (NC.done) { const m = NET_MISSIONS.find((x) => x.id === NC.done.id); box.append(el('div', { class: 'hwpanel net-done' }, el('h3', {}, `Mission réussie : ${m.title} · ${NC.done.pts}/10`), el('p', {}, m.learn), el('div', { class: 'hwrow' }, nextBtn(m, R), el('button', { class: 'btn small', onclick: () => { NC.done = null; R.refresh(); } }, 'Fermer')))); }
  if (NC.active) missionCard(box, R);
  const grid = el('div', { class: 'net-missions' });
  NET_MISSIONS.forEach((m, i) => {
    const r = net().missions[m.id]; const act = NC.active === m.id;
    grid.append(el('div', { class: 'net-mcard' + (r ? ' ok' : '') + (act ? ' on' : '') },
      el('div', { class: 'k' }, `Mission ${i + 1}${m.setup ? ' · dépannage' : ''}`), el('b', {}, m.title), el('p', { class: 'note' }, ((x) => (/[.!?…]$/.test(x) ? x : x + '.'))(m.intro.split('. ')[0])),
      el('div', { class: 'hwrow' }, r ? el('span', { class: 'pill ok' }, `${r.pts}/10`) : null, act ? el('span', { class: 'pill warn' }, 'en cours') : el('button', { class: 'btn small' + (r ? '' : ' primary'), onclick: () => { start(m, R); } }, r ? 'Refaire' : 'Commencer'))));
  });
  box.append(el('h3', { class: 'eq-h' }, 'Missions'), grid);
}
async function start(m, R) {
  if (m.setup && !(await ask(`« ${m.title} » remet le réseau en configuration de référence puis y introduit une panne. Continuer ?`, { ok: 'Commencer la mission' }))) return;
  NC.done = null; startMission(m.id);
  explain(`Mission « ${m.title} » : ${m.intro}`);
  R.go(m.tab || 'topo', { sw: m.sw, sub: m.sub, msub: m.msub, keepCourse: true });
}
function nextBtn(m, R) {
  const i = NET_MISSIONS.indexOf(m); const n = NET_MISSIONS[i + 1];
  return n ? el('button', { class: 'btn small primary', onclick: () => start(n, R) }, `Mission suivante : ${n.title}`) : el('span', { class: 'note ok' }, 'Parcours terminé : tentez l\'examen réseau !');
}
// carte de la mission en cours (affichée dans l'onglet Formation et en tête des autres onglets)
export function missionCard(box, R, compact = false) {
  const m = NET_MISSIONS.find((x) => x.id === NC.active); if (!m) return;
  const objs = objectivesOf(m);
  const card = el('div', { class: 'hwpanel net-mission' + (compact ? ' compact' : '') });
  card.append(el('div', { class: 'hwrow' }, el('h3', {}, `Mission en cours : ${m.title}`), el('span', { class: 'pill' }, `${objs.filter((o) => o.ok).length + (m.q || []).filter((q) => NC.answers[m.id + ':' + q.id]).length} / ${objs.length + (m.q || []).length}`), compact ? el('button', { class: 'btn small', onclick: () => R.go('learn') }, 'Voir le détail') : null));
  if (!compact) card.append(el('p', {}, m.intro));
  const ul = el('ul', { class: 'net-obj' });
  for (const o of objs) ul.append(el('li', { class: o.ok ? 'ok' : '' }, el('span', { class: 'chk' }, o.ok ? '✓' : '○'), o.t));
  card.append(ul);
  if (!compact) {
    for (const q of m.q || []) {
      const done = NC.answers[m.id + ':' + q.id];
      const inp = el('input', { type: 'text', placeholder: 'Votre réponse', 'aria-label': qText(q) });
      const res = el('span', { class: 'note' });
      const check = () => { const ok = answer(m.id, q.id, inp.value); res.textContent = ok ? 'Exact.' : 'Ce n\'est pas ça : vérifiez dans le poste.'; res.className = 'note ' + (ok ? 'ok' : 'err'); if (ok) R.refresh(); };
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') check(); e.stopPropagation(); });
      card.append(el('div', { class: 'net-q' + (done ? ' ok' : '') }, el('span', { class: 'chk' }, done ? '✓' : '?'), el('span', { class: 'grow' }, qText(q)), done ? el('b', { class: 'ok' }, String(q.a())) : el('span', { class: 'hwrow' }, inp, el('button', { class: 'btn small', onclick: check }, 'Vérifier'), res)));
    }
    const hl = el('div', { class: 'list' });
    const showHints = (hs) => { hl.innerHTML = ''; hs.forEach((h, i) => hl.append(el('div', { class: 'item' }, el('span', { class: 'dot amber' }), el('div', { class: 'grow' }, el('div', { class: 's' }, `Indice ${i + 1} : ${h}`))))); };
    if (NC.hints[m.id]) showHints(m.hints.slice(0, NC.hints[m.id]));
    card.append(hl, el('div', { class: 'hwrow' },
      el('button', { class: 'btn small', onclick: () => R.go(m.tab || 'topo', { sw: m.sw, sub: m.sub, msub: m.msub }) }, 'Aller à l\'onglet de la mission'),
      el('button', { class: 'btn small', disabled: (NC.hints[m.id] || 0) >= m.hints.length, onclick: () => { showHints(hint(m.id)); R.refresh(); } }, `Indice (−2 pts) · ${NC.hints[m.id] || 0}/${m.hints.length}`),
      el('span', { class: 'note' }, `Score possible : ${missionScore(m.id)}/10`),
      el('button', { class: 'btn small danger', onclick: () => { stopMission(); R.refresh(); } }, 'Abandonner')));
  }
  box.append(card);
}

// ---------------- quiz ----------------
function openQuiz(R) {
  const Q = newQuiz(10); let i = 0, score = 0, answered = false;
  const body = el('div', { class: 'list' });
  const draw = () => {
    body.innerHTML = '';
    if (i >= Q.length) {
      const pct = Math.round(score / Q.length * 100); saveQuiz(pct, Q.length);
      body.append(el('div', { class: 'lcd amber big' }, `Score : ${score} / ${Q.length} (${pct} %)`), el('p', { class: 'note' }, pct >= 80 ? 'Très bien : les bases ST 2110 sont acquises.' : 'Relisez les chapitres « Production IP » et « Réseau ST 2110 spine-leaf » du guide, puis recommencez.'), el('div', { class: 'hwrow' }, el('button', { class: 'btn primary', onclick: () => { modal.close(); R.refresh(); } }, 'Fermer'), el('button', { class: 'btn', onclick: () => { modal.close(); openQuiz(R); } }, 'Nouveau quiz')));
      return;
    }
    const q = Q[i]; answered = false;
    const fb = el('div', { class: 'note' });
    const opts = el('div', { class: 'list' });
    q.opts.forEach((o, k) => opts.append(el('button', { class: 'btn net-opt', onclick: (e) => {
      if (answered) return; answered = true;
      const ok = k === q.a; if (ok) score++;
      [...opts.children].forEach((b, j) => b.classList.add(j === q.a ? 'good' : j === k ? 'bad' : 'dim'));
      fb.className = 'note ' + (ok ? 'ok' : 'err'); fb.textContent = (ok ? 'Exact. ' : 'Non. ') + q.ex;
      next.hidden = false;
    } }, o)));
    const next = el('button', { class: 'btn primary', hidden: true, onclick: () => { i++; draw(); } }, i === Q.length - 1 ? 'Voir le score' : 'Question suivante');
    body.append(el('div', { class: 'k note' }, `Question ${i + 1} / ${Q.length} · score ${score}`), el('h3', {}, q.q), opts, fb, next);
  };
  draw();
  modal.open('Quiz ST 2110 et réseau', body, { width: 760 });
}

// ---------------- examen ----------------
function examPanel(box, R) {
  const E = NC.exam;
  if (E.over) {
    const tb = el('tbody');
    for (const f of E.faults) tb.append(el('tr', {}, el('td', {}, f.label), el('td', { class: f.entry && f.entry.done ? 'ok' : 'err' }, f.entry && f.entry.done ? 'résolue' : 'non résolue'), el('td', { class: 'mono' }, f.dur ? mmss(f.dur) : '—'), el('td', { class: 'mono' }, `${f.pts} / 30`), el('td', {}, f.aided ? 'référence chargée (÷2)' : '—'), el('td', { class: 'note' }, f.entry ? f.entry.f.hint : '')));
    box.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Examen réseau terminé'), el('div', { class: 'lcd amber big' }, `Score : ${E.score} %`),
      el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact net-tbl' }, el('thead', {}, el('tr', {}, ...['Panne', 'État', 'Temps', 'Points', 'Aide', 'Explication'].map((h) => el('th', {}, h)))), tb)),
      el('p', { class: 'note' }, `Configurations enregistrées : ${E.saved ? 'oui' : 'non (−10)'} · alarmes restantes : ${E.issuesLeft} · pénalités : ${E.pen}. Le résultat est enregistré dans votre suivi.`),
      el('div', { class: 'hwrow' }, el('button', { class: 'btn', onclick: () => offerDownload('examen-reseau-st2110.html', examReportHTML(E)) }, 'Télécharger le compte rendu'), el('button', { class: 'btn primary', onclick: () => { closeExam(); R.refresh(); } }, 'Fermer'))));
    return;
  }
  const left = Math.max(0, EXAM_TIME - (S.time - E.t0));
  const timer = el('div', { class: 'lcd amber big' }, mmss(left));
  const list = el('ul', { class: 'net-obj' });
  E.ids.forEach((id, k) => { const f = E.faults[k]; list.append(el('li', { class: f && f.entry && f.entry.done ? 'ok' : '' }, el('span', { class: 'chk' }, f && f.entry && f.entry.done ? '✓' : f ? '!' : '○'), f ? (f.entry && f.entry.done ? `Panne ${k + 1} résolue en ${mmss(Math.round((f.doneAt || S.time) - f.t0))}` : `Panne ${k + 1} en cours depuis ${mmss(Math.round(S.time - f.t0))} — à trouver`) : `Panne ${k + 1} : à venir`)); });
  box.append(el('div', { class: 'hwpanel net-mission' }, el('div', { class: 'hwrow' }, el('h3', {}, 'Examen réseau en cours'), timer),
    el('p', {}, 'Trois pannes cachées arrivent l\'une après l\'autre. Elles ont été enregistrées dans la configuration de démarrage : redémarrer un commutateur ne les efface pas. Pour chacune : constater, localiser, corriger, puis enregistrer (write memory). Pas d\'indice ; charger la configuration de référence divise les points de la panne par deux.'),
    list, el('div', { class: 'hwrow' }, el('button', { class: 'btn small danger', onclick: async () => { if (await ask('Terminer l\'examen maintenant ?', { title: 'Examen réseau', ok: 'Terminer l\'examen', danger: true })) { endExam(); R.refresh(); } } }, 'Terminer l\'examen'))));
  R.live = () => { timer.textContent = mmss(Math.max(0, EXAM_TIME - (S.time - E.t0))); };
}
export { NC };
