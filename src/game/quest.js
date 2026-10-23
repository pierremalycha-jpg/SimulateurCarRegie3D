// @ts-check
import * as THREE from 'three';
import { S, on, emit } from '../state.js';
import { el, mmss } from '../util.js';
import { $, modal } from '../ui/common.js';
import { icon } from '../ui/icons.js';
import { TUTOR, step, isAction, lessonsFor, lessonBlocked, lessonById as tutorLesson } from '../tutor/engine.js';
import { beginLesson } from '../ui/tutor_ui.js';
import { MISSIONS, currentMission } from '../ui/guide.js';
import { SC, PHASES, stopScenario, scenarioNext } from '../scenario.js';
import { STATION_INFO } from '../content/stations.js';
import { allExercises, exerciseInfo, exerciseDone, SPECIAL } from '../cours/exercices.js';
import { T } from '../truck.js';
import { TRUCK, W } from '../world.js';
import { PL } from '../app/player.js';
import { pcam } from '../app/view.js';
import { JEU } from './sfx.js';
import { BAREME, LEVELS, xpOf, levelOf, badgesWon, BADGES, game, badgeBloc } from './xp.js';
import { BLOCS } from '../content/referentiel.js';
import { PROG } from '../shared.js';
import { avancement } from '../carriere/index.js';
import { episodeById } from '../carriere/mails.js';

// ----------------------------------------------------------------------------------
// L'objectif à l'écran, comme dans un jeu : en haut à gauche, ce qu'il y a à faire maintenant
// (l'étape de l'exercice d'Olivier, la mission d'installation, la phase du jour de match, le
// poste suivant de la visite guidée, la mission de la Carrière) ; dans la 3D, un repère sur l'endroit où aller. Le journal
// des missions (touche L, bouton Missions) liste ce qu'on peut faire ici et toutes les missions
// du Cours, avec l'XP qu'elles rapportent, et les badges.
// ----------------------------------------------------------------------------------
const Q = { root: /** @type {HTMLElement | null} */ (null), mark: /** @type {HTMLElement | null} */ (null), key: '', flash: 0, hidden: false };
const V = new THREE.Vector3();

// ---------------- ce qu'il y a à faire ----------------
/** @typedef {{ kind: string, tag: string, title: string, text?: string, sub?: string, prog?: number, goals?: Array<[string, boolean]>, todo?: boolean, target?: () => (THREE.Vector3 | null), station?: string, key: string }} Goal */
const stationPos = (id) => { const s = T.stations.find((x) => x.station === id || x.id === id); return s ? s.pos : null; };
const doorPos = () => new THREE.Vector3((TRUCK.doorX0 + TRUCK.doorX1) / 2, TRUCK.floor + 0.2, TRUCK.cz + TRUCK.wid / 2 + 0.6);
const camPos = (id) => { const c = S.cams.find((x) => x.id === id); return c && c.model && c.model.root ? c.model.root.position : null; };
const pointPos = (id) => { const p = (W.interactables || []).find((x) => x.id === id); return p ? p.pos : null; };
/** où va chaque mission du mode « Tout à faire » (celles qui ont un endroit) */
const MISSION_WHERE = {
  m1: () => pointPos('pieddecar'), m3b: () => camPos(1), m6: doorPos, 'mz-patch': () => stationPos('brassage'), 'mz-net': () => stationPos('reseau'),
  m7: () => stationPos('melangeur'), m8: () => stationPos('melangeur'), m9: () => stationPos('vision'), m10: () => stationPos('vision'), m10b: () => stationPos('vision'),
  m11: () => stationPos('habillage'), m12: () => stationPos('evs'), m13: () => stationPos('melangeur'), m13b: () => stationPos('evs'), m14: () => stationPos('synchro'),
  m15: () => stationPos('transmission'), m16: () => stationPos('chefdecar'), m17: () => stationPos('chefdecar'),
};
/** @returns {Goal | null} */
export function currentGoal() {
  const l = TUTOR.lesson, s = step();
  if (l && s) {
    const go = /** @type {any} */ (s.go); const g = go ? (typeof go === 'function' ? safe(() => go(ctxLite())) : go) : null;
    const todo = isAction(s) && !TUTOR.done;
    return { kind: 'exercice', tag: S.carriere ? 'Carrière' : S.visite ? 'Visite guidée' : 'Exercice', title: l.title, sub: `Étape ${TUTOR.i + 1} / ${l.steps.length}`, text: s.title, prog: (TUTOR.i + (TUTOR.done ? 1 : 0)) / l.steps.length, todo,
      station: g && g.station ? g.station : undefined, target: g && g.station ? () => stationPos(g.station) : undefined, key: `x:${l.id}:${TUTOR.i}:${TUTOR.done}` };
  }
  if (SC.on && SC.phase >= 0) {
    const P = PHASES[SC.phase]; const goals = safe(() => P.goals()) || [];
    return { kind: 'match', tag: 'Jour de match', title: P.title, sub: `Phase ${SC.phase + 1} / ${PHASES.length} · ${mmss(S.time - SC.tp)} / ${P.minutes} min`, goals, prog: goals.length ? goals.filter((x) => x[1]).length / goals.length : 0, todo: true, key: `m:${SC.phase}:${goals.map((x) => +x[1]).join('')}` };
  }
  if (S.showMission && S.preset === 'zero') {
    const m = currentMission();
    if (!m) return { kind: 'fini', tag: 'Installation', title: 'Installation terminée', text: 'Toutes les missions sont réussies. Les exercices d\'Olivier t\'attendent dans le journal (L).', prog: 1, key: 'z:done' };
    const done = MISSIONS.filter((x) => S.missionsDone[x.id]).length;
    return { kind: 'mission', tag: 'Installation du car', title: m.title, sub: `Mission ${MISSIONS.indexOf(m) + 1} / ${MISSIONS.length} · +${BAREME.mission} XP`, text: m.text, prog: done / MISSIONS.length, todo: true, target: MISSION_WHERE[m.id], key: `z:${m.id}` };
  }
  // une mission de la Carrière (src/carriere/) : où on en est, et le retour au bureau quand elle est réussie
  const ep = S.carriere ? episodeById(S.carriere.id) : null;
  if (ep) {
    const A = avancement(ep, PROG); const reste = A.points.find((p) => !p.ok);
    return { kind: A.fait ? 'fini' : 'visite', tag: 'Carrière', title: ep.mission.titre, sub: `${ep.poste} · ${A.n} / ${A.total}`, prog: A.n / A.total,
      text: A.fait ? 'Mission accomplie : retourne au bureau de l\'entrepôt, un mail t\'attend (Olivier, touche J).' : `À voir : ${reste ? reste.label : ''}. Olivier t'y emmène (touche J).`, key: `c:${ep.id}:${A.n}` };
  }
  if (S.visite) return { kind: 'visite', tag: 'Visite guidée', title: 'Continuer la visite', text: 'Olivier t\'attend : ouvre son panneau (J) pour le poste suivant.', key: 'v' };
  // rien en cours : ce qu'on peut faire ici, et la touche du journal
  if (S.mode === 'station' || S.mode === 'fps') {
    const st = S.mode === 'station' ? S.station : null;
    const here = st ? lessonsFor(st).here.filter((l) => !l.id.startsWith('poste-') && !lessonBlocked(l)) : [];
    const n = here.length;
    return { kind: 'idle', tag: 'Missions', title: n ? `${n} mission${n > 1 ? 's' : ''} à ce poste` : 'Choisis une mission', text: n ? `${here.map((l) => l.title).slice(0, 2).join(' · ')}${n > 2 ? ' …' : ''}` : st ? 'Pas d\'exercice à ce poste : ouvre le journal des missions (L).' : 'Ouvre le journal des missions (L), ou assieds-toi à un poste : Olivier te propose ses exercices.', key: `i:${st}:${n}` };
  }
  return null;
}
const safe = (fn) => { try { return fn(); } catch (e) { return null; } };
const ctxLite = () => ({ io: TUTOR.io, seen: () => false, view: () => (TUTOR.io ? TUTOR.io.view() : {}), mem: TUTOR.mem });

// ---------------- le panneau d'objectif ----------------
function build() {
  Q.root = el('section', { id: 'quest', class: 'quest', 'aria-label': 'Objectif', hidden: true });
  Q.mark = el('div', { id: 'qmark', class: 'qmark', hidden: true, 'aria-hidden': 'true' }, icon('repere'), el('b'), el('small'));
  const hud = $('#hud'); if (hud) { hud.prepend(Q.root); hud.append(Q.mark); }
}
export function renderQuest(force = false) {
  if (!Q.root) build();
  const r = /** @type {HTMLElement} */ (Q.root);
  const g = currentGoal();
  const show = JEU.quest && !Q.hidden && S.mode !== 'start' && !!g;
  if (!show) { if (!r.hidden) { r.hidden = true; Q.key = ''; } return; }
  const key = g.key + '|' + (g.todo ? 1 : 0);
  if (!force && key === Q.key && !r.hidden) return;
  Q.key = key; r.hidden = false;
  r.classList.toggle('idle', g.kind === 'idle');
  const whereNow = /** @type {HTMLElement | null} */ ($('#where'));
  r.replaceChildren(...[
    el('div', { class: 'q-where' }, whereNow ? whereNow.textContent : ''),
    el('div', { class: 'q-head' }, icon(g.kind === 'match' ? 'antenne' : g.kind === 'mission' ? 'plan' : g.kind === 'fini' ? 'trophee' : g.kind === 'idle' ? 'missions' : 'objectif'), el('span', { class: 'q-tag' }, g.tag), g.sub ? el('span', { class: 'q-sub' }, g.sub) : null,
      el('button', { type: 'button', class: 'q-btn', title: 'Journal des missions (L)', 'aria-label': 'L : journal des missions', onclick: () => openJournal() }, icon('missions'), el('kbd', {}, 'L'))),
    el('h3', { class: 'q-title' }, g.title),
    g.text ? el('p', { class: 'q-text' + (g.todo ? ' todo' : '') }, g.todo && g.kind === 'exercice' ? el('i', { class: 'q-dot' }) : null, g.text) : null,
    g.goals ? el('ul', { class: 'q-goals' }, ...g.goals.map(([t, ok]) => el('li', { class: ok ? 'ok' : '' }, icon(ok ? 'fait' : 'suivant'), t))) : null,
    g.prog != null ? el('div', { class: 'q-prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(g.prog * 100)) }, el('i', { style: { width: `${Math.round(g.prog * 100)}%` } })) : null,
    g.kind === 'exercice' && g.todo ? el('div', { class: 'q-hint' }, el('kbd', {}, 'J'), ' Olivier : indice, « Emmène-moi », « Fais-le pour moi »') : null,
    g.kind === 'match' ? el('div', { class: 'q-acts' },
      PHASES[SC.phase] && PHASES[SC.phase].id !== 'air' ? el('button', { type: 'button', class: 'btn small primary', onclick: () => { scenarioNext(); renderQuest(true); } }, PHASES[SC.phase].done() ? 'Phase suivante' : 'Terminer la phase') : el('span', { class: 'note' }, 'Fin automatique après 5 min d\'antenne'),
      el('button', { type: 'button', class: 'btn small', onclick: () => { stopScenario(); renderQuest(true); } }, 'Abandonner')) : null].filter(Boolean));
}
/** l'objectif clignote en vert : une mission ou une étape vient d'être réussie */
function flash(kind = 'ok') {
  if (!Q.root) return;
  Q.root.classList.remove('flash-ok', 'flash-new'); void Q.root.offsetWidth; Q.root.classList.add(kind === 'ok' ? 'flash-ok' : 'flash-new');
}
on('mission', () => { renderQuest(true); flash('ok'); });
on('tutor', (e) => { if (!e) return; if (e.type === 'done') flash('ok'); else if (e.type === 'step' || e.type === 'start') { renderQuest(true); flash('new'); } else renderQuest(true); });
on('started', () => { Q.hidden = false; renderQuest(true); });
on('startScenario', () => setTimeout(() => renderQuest(true), 400));

// ---------------- le repère dans la 3D ----------------
const TMP = new THREE.Vector3();
export function updateQuestMarker() {
  const m = Q.mark; if (!m) return;
  const g = currentGoal();
  const hide = () => { if (!m.hidden) m.hidden = true; };
  if (!JEU.marker || !g || !g.target || S.mode !== 'fps') { hide(); return; }
  let p = safe(g.target);
  if (!p) { hide(); return; }
  // le but est dans le car et l'on est dehors (ou l'inverse) : le repère montre la porte
  const inside = Math.abs(p.x - TRUCK.cx) < TRUCK.len / 2 + 0.5 && Math.abs(p.z - TRUCK.cz) < TRUCK.wid / 2 + 0.5 && p.y > TRUCK.floor - 0.5 && p.y < TRUCK.ceil + 1;
  let label = g.station && STATION_INFO[g.station] ? STATION_INFO[g.station].title : g.kind === 'mission' ? g.title : 'Objectif';
  if (inside !== S.inTruck) { p = doorPos(); label = S.inTruck ? 'Sortir du car' : 'Entrer dans le car'; }
  const d = Math.hypot(p.x - PL.pos.x, p.z - PL.pos.z);
  if (d < 1.6) { hide(); return; }
  TMP.copy(p); if (!S.inTruck && inside === S.inTruck) TMP.y += 0.9;
  V.copy(TMP).project(pcam);
  const w = window.innerWidth, h = window.innerHeight;
  let x = (V.x + 1) / 2 * w, y = (1 - V.y) / 2 * h;
  const behind = V.z > 1;
  if (behind) { x = w - x; y = h - y; }
  const margin = 70; let off = behind;
  if (x < margin || x > w - margin || y < margin || y > h - margin) off = true;
  x = Math.max(margin, Math.min(w - margin, x)); y = Math.max(margin, Math.min(h - margin, y));
  if (behind) { y = h - margin; }
  m.hidden = false; m.classList.toggle('off', off);
  m.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  const b = m.querySelector('b'), s = m.querySelector('small');
  if (b && b.textContent !== label) b.textContent = label;
  const dist = d < 10 ? `${Math.round(d)} m` : `${Math.round(d / 5) * 5} m`;
  if (s && s.textContent !== dist) s.textContent = dist;
}

// ---------------- le journal des missions (touche L) ----------------
const TIER = { bronze: 'Bronze', argent: 'Argent', or: 'Or' };
const xpOfExercise = (id) => (id === 'x-atelier' ? BAREME.atelier : id === 'x-brassage' ? BAREME.brassage : id === 'x-reseau' ? BAREME.reseau * 14 : id === 'x-camera' ? BAREME.mes : id === 'x-entrepot' ? BAREME.entrepot : id === 'x-match' ? 100 : BAREME.exercice);
function startExercise(id, lessonId) {
  modal.close();
  const info = exerciseInfo(id);
  if (SPECIAL[id]) { S.coursBack = lessonId || null; emit('go', { ...info.go, label: info.title }); return; }
  S.coursBack = lessonId || null;
  beginLesson(id);
}
function row(id, lessonId, chapter) {
  const info = exerciseInfo(id); if (!info) return null;
  const done = exerciseDone(id); const l = tutorLesson(id); const why = l && S.mode !== 'start' ? lessonBlocked(l) : '';
  const running = TUTOR.lesson && TUTOR.lesson.id === id;
  return el('div', { class: 'qj-row' + (done ? ' done' : '') + (running ? ' running' : ''), 'data-exercise': id },
    el('span', { class: 'qj-state', 'aria-hidden': 'true' }, icon(done ? 'fait' : running ? 'objectif' : 'suivant')),
    el('div', { class: 'qj-main' }, el('b', {}, info.title), el('small', {}, [info.duration, info.level, chapter ? chapter.title : null].filter(Boolean).join(' · ')), el('span', { class: 'qj-sum' }, info.summary)),
    el('span', { class: 'qj-xp' + (done ? ' got' : '') }, icon('eclair'), `${xpOfExercise(id)} XP`),
    el('div', { class: 'qj-acts' },
      el('button', { type: 'button', class: 'btn small' + (done || why ? '' : ' primary'), disabled: !!why, title: why || '', onclick: () => startExercise(id, lessonId) }, running ? 'Reprendre' : done ? 'Refaire' : 'Commencer'),
      lessonId ? el('button', { type: 'button', class: 'linkbtn', onclick: () => { modal.close(); emit('cours', { lesson: lessonId }); } }, 'Leçon') : null));
}
/** une carte joueur qui se met à jour toute seule (écran titre, Jouer, menu du car) */
const LIVE = new Set();
export function livePlayerCard(compact = false) { const c = playerCard(compact); LIVE.add(c); return c; }
function refreshCards() { for (const c of [...LIVE]) { if (!c.isConnected && !c.parentNode) continue; const n = playerCard(c.classList.contains('compact')); c.replaceWith(n); LIVE.delete(c); LIVE.add(n); } }
on('xp', refreshCards); on('badge', refreshCards); on('shared', refreshCards);
export function playerCard(compact = false) {
  const xp = xpOf(), L = levelOf(xp), won = badgesWon().length;
  return el('div', { class: 'pcard' + (compact ? ' compact' : '') },
    el('div', { class: 'pc-lvl' }, el('small', {}, 'Niveau'), el('b', {}, String(L.n))),
    el('div', { class: 'pc-main' },
      el('div', { class: 'pc-title' }, L.title, el('span', { class: 'pc-xp' }, icon('eclair'), `${xp} XP`)),
      el('div', { class: 'pc-bar', role: 'progressbar', 'aria-label': 'Progression vers le niveau suivant', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(L.pct * 100)) }, el('i', { style: { width: `${Math.round(L.pct * 100)}%` } })),
      el('small', { class: 'pc-next' }, L.next ? `${L.remaining} XP avant le niveau ${L.n + 1} · ${LEVEL_NAME(L.n + 1)}` : 'Niveau maximal atteint')),
    el('div', { class: 'pc-badges' }, icon('medaille'), el('b', {}, String(won)), el('small', {}, won > 1 ? 'badges' : 'badge')));
}
const LEVEL_NAME = (n) => { const l = LEVELS.find((x) => x.n === n); return l ? l.title : ''; };
function badgesGrid() {
  const g = game();
  const card = (b) => el('div', { class: 'badge ' + b.tier + (g.badges[b.id] ? ' won' : ' locked'), title: b.desc }, el('span', { class: 'bd-ico' }, icon(b.ico)), el('b', {}, b.title), el('small', {}, g.badges[b.id] ? TIER[b.tier] + ' · obtenu' : b.desc));
  const general = BADGES.filter((b) => !b.comp);
  const box = el('div', { class: 'qj-badges' }, el('h4', {}, 'Badges du simulateur'), el('div', { class: 'badges' }, ...general.map(card)));
  for (const bl of BLOCS) {
    const list = BADGES.filter((b) => b.comp && badgeBloc(b) === bl && b.tier === 'bronze');
    const gold = (code) => BADGES.find((b) => b.comp === code && b.tier === 'or');
    box.append(el('h4', {}, `Bloc ${bl.n} · ${bl.titre}`), el('div', { class: 'badges comp' }, ...list.map((b) => { const o = gold(b.comp); const won = g.badges[o.id] ? 'or' : g.badges[b.id] ? 'bronze' : ''; return el('div', { class: 'badge ' + (won || 'bronze') + (won ? ' won' : ' locked'), title: b.desc }, el('span', { class: 'bd-ico' }, icon('livret')), el('b', {}, b.comp), el('small', {}, won === 'or' ? 'consolidée' : won ? 'travaillée' : 'à travailler')); })));
  }
  return box;
}
export function openJournal() {
  const body = el('div', { class: 'qj' });
  body.append(playerCard());
  const g = currentGoal();
  if (g) body.append(el('section', { class: 'qj-sec qj-now' }, el('h4', {}, icon('objectif'), 'Objectif en cours'), el('b', {}, g.title), g.text ? el('p', {}, g.text) : null, g.sub ? el('small', {}, g.sub) : null));
  const st = S.mode === 'station' ? S.station : null;
  if (st) {
    const { here } = lessonsFor(st); const ex = here.filter((l) => !l.id.startsWith('poste-'));
    if (ex.length) body.append(el('section', { class: 'qj-sec' }, el('h4', {}, icon('repere'), `Ici, au poste ${STATION_INFO[st] ? STATION_INFO[st].title : st}`), ...ex.map((l) => row(l.id, lessonOf(l.id), null))));
  }
  if (S.preset === 'zero') {
    body.append(el('section', { class: 'qj-sec' }, el('h4', {}, icon('plan'), 'Installation du car'), el('ol', { class: 'qj-missions' }, ...MISSIONS.map((m) => el('li', { class: S.missionsDone[m.id] ? 'done' : currentMission() === m ? 'now' : '' }, icon(S.missionsDone[m.id] ? 'fait' : 'suivant'), el('b', {}, m.title), el('span', {}, m.text))))));
  }
  // toutes les missions, par chapitre du Cours
  const all = allExercises(); const chapters = [...new Set(all.map((x) => x.chapter))];
  const tabs = el('div', { class: 'qj-chaps' });
  const list = el('div', { class: 'qj-list' });
  let cur = chapters[0];
  const draw = () => {
    for (const b of tabs.children) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.ch === cur.id));
    list.replaceChildren(...all.filter((x) => x.chapter === cur).map((x) => row(x.id, x.lesson.id, null)).filter(Boolean));
  };
  for (const ch of chapters) {
    const xs = all.filter((x) => x.chapter === ch), done = xs.filter((x) => exerciseDone(x.id)).length;
    tabs.append(el('button', { type: 'button', class: 'qj-chap', 'data-ch': ch.id, 'aria-pressed': 'false', onclick: () => { cur = ch; draw(); } }, icon(ch.icon), el('span', {}, ch.title), el('small', {}, `${done}/${xs.length}`)));
  }
  draw();
  const total = all.length, doneN = all.filter((x) => exerciseDone(x.id)).length;
  body.append(el('section', { class: 'qj-sec' }, el('h4', {}, icon('missions'), 'Toutes les missions', el('small', {}, ` · ${doneN} / ${total} réussies`)), tabs, list));
  body.append(el('section', { class: 'qj-sec' }, badgesGrid()));
  modal.open('Journal des missions', body, { width: 980 });
}
const lessonOf = (xid) => { const x = allExercises().find((e) => e.id === xid); return x ? x.lesson.id : null; };
on('journal', () => { if (S.mode === 'start') return; if (modal.isOpen) { modal.close(); return; } openJournal(); });
on('xp', () => { if (modal.isOpen && $('#modal .qj')) { const c = $('#modal .pcard'); if (c) c.replaceWith(playerCard()); } });
/** masquer ou montrer l'objectif (Réglages) */
export function setQuestVisible(v) { JEU.quest = !!v; renderQuest(true); }
