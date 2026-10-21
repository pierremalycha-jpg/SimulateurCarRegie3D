// @ts-check
import { S, on, emit, camById } from '../state.js';
import { el } from '../util.js';
import { resetFabric } from '../net/fabric.js';
import { toast, ask, modal } from './common.js';
import { hasStation, closeStation } from './stations.js';
import { openPlan, closePlan } from './plan.js';
import { openDevice, viewerState } from '../equipment/viewer.js';
import { teleport } from '../app/teleport.js';
import { AT, atelierDebug } from '../atelier.js';
import { netGo, netView, netType } from './st_network.js';
import { releaseCamera } from '../app/camop.js';
import { whereAmI } from '../app/hud.js';
import { TUTOR, registerLessons, setIO, startLesson, stopLesson, next, prev, check, hint, doForMe, answer, step, isAction, ctx, val, lessonsFor, lessonBlocked, lessonById, progressOf } from '../tutor/engine.js';
import { NET_LESSONS } from '../tutor/lessons/reseau.js';
import { ALL_STATION_LESSONS } from '../tutor/lessons/index.js';
import { stationLesson, stationIds } from '../tutor/lessons/postes.js';
import { STATION_INFO } from '../content/stations.js';
import { FIRST_STEPS, FIRST_STEPS_TOUCH } from '../content/controls.js';
import { rich } from './rich.js';
import { icon } from './icons.js';
import { report } from '../diag.js';
import { codesOf } from '../livret.js';
import { openLivret } from './livret.js';
import { lessonById as coursLesson } from '../cours/index.js';

// ----------------------------------------------------------------------------------
// Le chef de car à l'écran : un panneau qui ne bloque pas le poste (on lit et on agit en
// même temps), appelé à tout moment (bouton « Chef de car », touche J). Il propose les
// exercices du poste où l'on se trouve (tous les autres sont rangés dans les leçons du Cours),
// déroule les étapes, met en évidence l'élément à utiliser, emmène au bon poste et au bon
// onglet, tape les commandes si on le lui demande. En visite guidée (Jouer, mode « Visite
// guidée »), il fait le tour du car puis présente les postes l'un après l'autre.
// ----------------------------------------------------------------------------------
const CHEF = { name: 'Olivier', role: 'chef de car' };
const UI = { root: /** @type {HTMLElement | null} */ (null), openDom: '', placed: false, min: false, said: '', lastKey: '', voice: false, notes: /** @type {string[]} */ ([]), feedback: '', spotUntil: 0, intro: false };
try { UI.voice = localStorage.getItem('carregie.chefVoice') === '1'; } catch (e) { /* stockage indisponible */ }

// ---------------- entrées / sorties pour le moteur ----------------
// onglets des autres postes (barre .tabs du poste, boutons data-k) : lus et choisis dans la page
// (sans le sélecteur :has(), inconnu des navigateurs d'avant 2023 : Firefox ESR 115 par exemple)
const stationTabs = () => /** @type {HTMLElement | null} */ ([...document.querySelectorAll('#station .st-body .tabs')].find((t) => [...t.children].some((b) => b.matches('.tab[data-k]'))) || null);
const stationTab = () => { const b = /** @type {HTMLElement | null} */ (stationTabs()?.querySelector(':scope > .tab.on')); return b ? b.dataset.k : null; };
function clickTab(k) { const b = /** @type {HTMLElement | null} */ (stationTabs()?.querySelector(`:scope > .tab[data-k="${k}"]`)); if (b && !b.classList.contains('on')) b.click(); }
const view = () => {
  const station = S.mode === 'station' ? S.station : null;
  const v = station === 'reseau' ? netView() : { tab: station ? stationTab() : null, sub: null, sw: null, port: null, rx: null };
  const d = viewerState();
  // atelier de montage : gestes faits et phases (pour suivre le montage étape par étape)
  const atelier = AT.active || AT.finished ? { active: AT.active, finished: AT.finished, done: AT.done, ops: atelierDebug.OPS } : null;
  return { station, modal: modal.isOpen, cam: station ? S.selCam : null, device: d ? d.key : null, devView: d ? d.view : null, devSel: d ? d.sel : null, atelier, ...v };
};
function goTo(g) {
  if (!g) return;
  // poste à ouvrir (ou à rouvrir sur une autre caméra : poste vision, baie CCU)
  if (g.station && (view().station !== g.station || (g.cam && S.selCam !== g.cam))) {
    if (!hasStation(g.station)) return;
    if (S.mode === 'camop') releaseCamera();
    if (S.mode === 'plan') closePlan();
    if (S.mode === 'station') closeStation(true);
    emit('openStationNow', g.cam ? { id: g.station, cam: g.cam } : { id: g.station });
  }
  if (g.station && g.station !== 'reseau' && g.tab) { clickTab(g.tab); setTimeout(() => clickTab(g.tab), 120); }
  // visionneuse de matériel : l'appareil (et sa face) à montrer
  if (g.device) { const d = viewerState(); if (!d || d.key !== g.device || (g.n && d.n !== g.n)) openDevice(g.device, g.n || 1, g.view ? { view: g.view } : {}); }
  if (g.station === 'reseau' && (g.tab || g.sw || g.sub || g.rx || g.sel)) {
    const o = {}; for (const k of ['sw', 'sub', 'port', 'rx', 'msub', 'sel', 'view', 'dev', 'src']) if (g[k] !== undefined) o[k] = g[k];
    netGo(g.tab, o);
  }
}
// ---------------- gestes hors des postes (« Fais-le pour moi ») ----------------
// clique le premier élément visible qui correspond (texte optionnel) ; les éléments SVG reçoivent un vrai clic souris
function clickEl(sel, text) {
  for (const n of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll(sel))) {
    if (text && !(n.textContent || '').includes(text)) continue;
    if (n instanceof HTMLElement && typeof n.click === 'function') n.click(); else n.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    return true;
  }
  return false;
}
// liste déroulante : choisit la valeur et prévient l'interface comme un vrai choix
function setSelect(sel, value) {
  const s = /** @type {HTMLSelectElement | null} */ (document.querySelector(sel)); if (!s) return false;
  s.value = String(value); s.dispatchEvent(new Event('change', { bubbles: true })); return true;
}
// atelier de montage : enchaîne les gestes d'une phase dans l'ordre (pièces posées, gestes faits, réglages à zéro)
function atelierPhase(phase) {
  const A = atelierDebug; A.fast(0.05);
  for (const op of A.OPS) {
    if (op.phase !== phase || AT.done.has(op.id)) continue;
    if (op.id === 'tally') { const t = setInterval(() => { if (!AT.active || AT.done.has('tally')) { clearInterval(t); return; } if (AT.done.has('power') && AT.powered) A.act('tally'); }, 400); continue; }
    if (op.kind === 'place') { A.grab(op.part); A.install(op.part, op.id === 'zoom' ? 'L' : op.id === 'focus' ? 'R' : undefined); }
    else if (op.kind === 'adjust') { if (op.id === 'level') A.setLevel(0); else A.setBalance(0); A.act(op.id); }
    else { if (op.tool === 'pen') { A.grab('pen'); AT.clean[op.id === 'cleanCam' ? 'cam' : 'wall'] = true; AT.dirty[op.id === 'cleanCam' ? 'cam' : 'wall'] = false; } A.finishAct(op.id); }
  }
}
const UIACT = {
  take: (id) => { const c = camById(id); if (!c) return; if (S.mode === 'station') closeStation(true); if (S.mode === 'plan') closePlan(); emit('takeCamera', c); },
  release: () => { if (S.mode === 'camop') releaseCamera(); },
  plan: (open) => { if (open) { if (S.mode === 'station') closeStation(true); if (S.mode !== 'plan') openPlan(); } else if (S.mode === 'plan') closePlan(); },
  device: (key, n = 1, o = {}) => openDevice(key, n, o),
  synoptics: (tab) => emit('openSynoptics', tab),
  closeModal: () => { if (modal.isOpen) modal.close(); },
  click: clickEl,
  select: setSelect,
  teleport: (i) => { if (S.mode === 'station') closeStation(true); if (S.mode === 'plan') closePlan(); teleport(i); },
  atelier: (phase) => { if (phase === 'start') { if (!AT.active) { if (S.mode === 'station') closeStation(true); emit('startAtelier'); } } else atelierPhase(phase); },
};
setIO({
  cli: (sw, lines) => netType(sw, lines),
  go: goTo,
  view,
  log: (type, o = {}) => emit('netlog', { type, ...o }),
  ui: (name, ...a) => (UIACT[name] ? UIACT[name](...a) : undefined),
});

// parcours connus : un parcours pratique par poste, les compétences et le matériel, le réseau
// ST 2110, puis la présentation de chaque poste
registerLessons(ALL_STATION_LESSONS);
registerLessons(NET_LESSONS);
registerLessons(stationIds().map((id) => stationLesson(id, hasStation(id))).filter(Boolean));

// famille des présentations de poste (« Présente-moi ») : elles passent après les exercices
const PRESENT = 'Les postes du car';
// étiquette d'un encadré du chef : icône et mot
const tag = (ico, text) => el('span', { class: 'chef-tag' }, icon(ico), text);
const plain = (s) => String(s).replace(/`|\*\*/g, '').replace(/^- /gm, '').replace(/\n+/g, ' ');

// ---------------- voix ----------------
function speak(text) {
  const ss = window.speechSynthesis;
  if (!UI.voice || !ss || !window.SpeechSynthesisUtterance) return;
  try {
    ss.cancel();
    const u = new SpeechSynthesisUtterance(plain(text)); u.lang = 'fr-FR'; u.rate = 1.05;
    const v = ss.getVoices().find((x) => /^fr/i.test(x.lang) && /male|thomas|paul|henri|homme/i.test(x.name)) || ss.getVoices().find((x) => /^fr/i.test(x.lang));
    if (v) u.voice = v;
    u.onend = u.onerror = () => { S.chefSpeaking = false; };
    S.chefSpeaking = true;
    ss.speak(u);
  } catch (e) { S.chefSpeaking = false; }
}
function hush() { try { if (S.chefSpeaking && window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* rien */ } S.chefSpeaking = false; }

// ---------------- panneau ----------------
export function toggleChef(force) {
  const open = force ?? !TUTOR.open;
  TUTOR.open = open;
  document.body.classList.toggle('chef-open', open);
  if (!open) { hush(); UI.intro = false; if (UI.root) UI.root.hidden = true; spot(null); return; }
  if (!UI.root) build();
  UI.root.hidden = false; UI.min = false; UI.root.classList.remove('min');
  render(true);
}
function build() {
  UI.root = el('aside', { id: 'chef', class: 'chef', role: 'dialog', 'aria-label': 'Chef de car', hidden: true });
  document.body.append(UI.root, el('div', { id: 'chef-spot', hidden: true }, el('span', { class: 'chef-spot-lab' })));
  // le panneau se déplace en le prenant par son en-tête (position mémorisée)
  try { const p = JSON.parse(localStorage.getItem('carregie.chefPos') || 'null'); if (p && window.innerWidth > 720) { Object.assign(UI.root.style, { left: p.x + 'px', top: p.y + 'px', right: 'auto', bottom: 'auto' }); UI.placed = true; } } catch (e) { /* position par défaut */ }
}
function drag(head) {
  head.addEventListener('pointerdown', (e) => {
    if (window.innerWidth <= 720 || /** @type {HTMLElement} */ (e.target).closest('button')) return;
    const r = UI.root.getBoundingClientRect(); const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = (ev) => { const x = Math.max(4, Math.min(window.innerWidth - 120, ev.clientX - dx)), y = Math.max(4, Math.min(window.innerHeight - 60, ev.clientY - dy)); Object.assign(UI.root.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' }); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); UI.placed = true; const r2 = UI.root.getBoundingClientRect(); try { localStorage.setItem('carregie.chefPos', JSON.stringify({ x: Math.round(r2.left), y: Math.round(r2.top) })); } catch (er) { /* rien */ } };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
}
function header(sub) {
  const voice = el('button', { class: 'chef-ico' + (UI.voice ? ' on' : ''), title: UI.voice ? 'Couper la voix du chef' : 'Faire parler le chef (synthèse vocale)', 'aria-pressed': String(UI.voice), onclick: () => { UI.voice = !UI.voice; try { localStorage.setItem('carregie.chefVoice', UI.voice ? '1' : '0'); } catch (e) { /* rien */ } if (!UI.voice) hush(); else { UI.said = ''; } render(true); } }, icon(UI.voice ? 'son' : 'muet'), UI.voice ? 'Voix' : 'Muet');
  const h = el('header', { class: 'chef-head' },
    el('div', { class: 'chef-avatar', 'aria-hidden': 'true' }, 'O'),
    el('div', { class: 'chef-who' }, el('b', {}, `${CHEF.name}, ${CHEF.role}`), el('small', {}, sub || '')),
    voice,
    el('button', { class: 'chef-ico', title: UI.min ? 'Agrandir' : 'Réduire', 'aria-label': UI.min ? 'Agrandir le chef de car' : 'Réduire le chef de car', onclick: () => { UI.min = !UI.min; UI.root.classList.toggle('min', UI.min); render(true); } }, icon(UI.min ? 'agrandir' : 'reduire')),
    el('button', { class: 'chef-ico', title: 'Fermer (J)', 'aria-label': 'Fermer le chef de car', onclick: () => toggleChef(false) }, icon('fermer')));
  drag(h);
  return h;
}
function where() {
  if (S.mode === 'start') return 'Tu es sur la feuille de service, avant d\'entrer dans le car.';
  if (S.mode === 'station' && STATION_INFO[S.station]) return `Tu es au poste ${STATION_INFO[S.station].title}.`;
  if (S.mode === 'camop') return 'Tu es derrière une caméra.';
  const [zone] = whereAmI();
  return `Tu es ici : ${zone}.`;
}

export function render(force = false) {
  if (!UI.root || UI.root.hidden) return;
  const l = TUTOR.lesson, s = step();
  const key = [l ? l.id : '', TUTOR.i, TUTOR.done, TUTOR.answer, TUTOR.hint, UI.min, S.mode, S.station, S.ipMode, UI.feedback, lastDone ? lastDone.id : ''].join('|');
  if (!force && key === UI.lastKey) return;
  UI.lastKey = key;
  UI.root.innerHTML = '';
  if (!l) { renderHome(); spot(null); return; }
  if (!s) return;
  const c = ctx();
  UI.root.append(header(`${l.title} · étape ${TUTOR.i + 1}/${l.steps.length}`));
  if (UI.min) { UI.root.append(el('div', { class: 'chef-mini' }, el('b', {}, s.title), el('span', {}, isAction(s) && !TUTOR.done ? ' — à toi' : ' ✓'))); return; }
  const body = el('div', { class: 'chef-body' });
  body.append(el('div', { class: 'chef-prog', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(l.steps.length), 'aria-valuenow': String(TUTOR.i + 1) }, el('i', { style: { width: `${((TUTOR.i + (TUTOR.done ? 1 : 0)) / l.steps.length) * 100}%` } })),
    el('h3', { class: 'chef-step' }, s.title));
  const say = val(s.say, c);
  body.append(rich(say));
  if (UI.said !== l.id + '/' + s.id) { UI.said = l.id + '/' + s.id; speak(say); }
  // le geste demandé
  if (s.do) {
    const todo = el('div', { class: 'chef-do' + (TUTOR.done ? ' ok' : '') }, TUTOR.done ? tag('fait', 'Fait') : tag('a_toi', 'À toi'), rich(val(s.do, c)));
    const cli = s.cli ? val(s.cli, c) : null;
    if (cli && cli.length) {
      const box = el('div', { class: 'chef-cli' });
      for (const line of cli) box.append(el('button', { class: 'chef-cmd', title: 'Mettre cette commande dans le terminal', onclick: () => putInTerminal(line, s) }, el('code', {}, line)));
      todo.append(box, el('small', { class: 'note' }, 'Clique une commande : elle va dans le terminal, tu n\'as plus qu\'à valider par Entrée.'));
    }
    body.append(todo);
  }
  // question
  if (s.quiz) {
    const q = s.quiz;
    const box = el('div', { class: 'chef-quiz' }, el('p', { class: 'chef-q' }, q.q));
    // après deux erreurs, le chef montre la bonne réponse : le stagiaire la choisit pour continuer
    const shown = TUTOR.tries >= 2 && !TUTOR.done;
    q.choices.forEach((t, k) => box.append(el('button', { class: 'btn small chef-choice' + (TUTOR.answer === k ? (k === q.answer ? ' good' : ' bad') : '') + (shown && k === q.answer ? ' hint' : ''), disabled: TUTOR.done, onclick: () => { answer(k); render(true); } }, t)));
    if (TUTOR.answer === q.answer) box.append(el('div', { class: 'chef-ok' }, rich('**Exactement.** ' + q.why)));
    else if (shown) box.append(el('div', { class: 'chef-bad' }, rich(`Ce n'est pas « ${q.choices[TUTOR.answer]} ». La bonne réponse est « ${q.choices[q.answer]} » : ${q.why}\n\nChoisis-la pour continuer.`)));
    else if (TUTOR.answer != null) box.append(el('div', { class: 'chef-bad' }, `Pas « ${q.choices[TUTOR.answer]} ». Relis ce que je viens d'expliquer au-dessus, puis choisis une autre réponse.`));
    body.append(box);
  }
  for (const n of UI.notes) body.append(el('div', { class: 'chef-hint' }, tag('indice', 'Indice'), rich(n)));
  if (UI.feedback) body.append(el('div', { class: 'chef-note' }, UI.feedback));
  if (s.do && TUTOR.done && s.ok) body.append(el('div', { class: 'chef-ok' }, tag('bravo', 'Bien joué'), rich(val(s.ok, c))));
  else if (s.do && !TUTOR.done) body.append(el('div', { class: 'chef-wait' }, el('i', { class: 'chef-dot' }), 'Je regarde ce que tu fais…'));
  UI.root.append(body);
  // actions
  const g = s.go ? val(s.go, c) : null;
  const v = /** @type {any} */ (view());
  // poste Réseau IP : onglet Exploitation (vue, appareil) ou sous-onglet de l'onglet Technique
  const atTab = !g || !g.tab ? true : g.tab === 'ops' ? v.mode === 'ops' && (!g.view || v.opsView === g.view) && (!g.dev || v.opsDev === g.dev) : v.tab === g.tab && v.mode !== 'ops';
  const there = !g || (v.station === (g.station || v.station) && atTab && (!g.device || v.device === g.device));
  const acts = el('div', { class: 'chef-acts' });
  if (isAction(s) && !TUTOR.done) {
    if (g || s.show) acts.append(el('button', { class: 'btn small', onclick: () => { if (!there) goTo(g); UI.spotUntil = performance.now() + 6000; spot(targets(s), true); } }, there ? 'Montre-moi' : 'Emmène-moi'));
    if (s.hints && TUTOR.hint < s.hints.length) acts.append(el('button', { class: 'btn small', onclick: () => { const h = hint(); if (h) UI.notes.push(h); render(true); } }, 'Un indice'));
    if (s.auto) acts.append(el('button', { class: 'btn small', title: 'Le chef le fait devant toi et t\'explique', onclick: () => { if (g && !there) goTo(g); doForMe(); UI.feedback = TUTOR.done ? '' : 'J\'ai lancé l\'action ; ça devrait se voir dans un instant.'; render(true); } }, 'Fais-le pour moi'));
  }
  const nav = el('div', { class: 'chef-nav' },
    el('button', { class: 'btn small', 'aria-label': 'Étape précédente', title: 'Étape précédente', disabled: TUTOR.i === 0, onclick: () => { prev(); onStep(); } }, '◀'),
    el('button', { class: 'btn small' + (TUTOR.done ? ' primary' : ''), disabled: !TUTOR.done, onclick: () => { const last = TUTOR.i >= l.steps.length - 1; next(); if (last) finished(l); else onStep(); } }, TUTOR.i >= l.steps.length - 1 ? 'Terminer' : 'Suivant ▶'));
  UI.root.append(el('footer', { class: 'chef-foot' }, acts, nav,
    el('button', { class: 'chef-quit', onclick: () => quit() }, 'Quitter le parcours')));
}
function onStep() { UI.notes = []; UI.feedback = ''; UI.spotUntil = 0; render(true); }
async function quit() {
  const l = TUTOR.lesson; if (!l) return;
  let clean = false;
  if (l.cleanup) {
    const r = await ask(`Quitter « ${l.title} ».\n\n${l.cleanupLabel || 'Remettre en état'} ?`, { title: 'Quitter le parcours', ok: l.cleanupLabel || 'Remettre en état', alt: 'Laisser en l\'état', cancel: 'Continuer le parcours' });
    if (!r || TUTOR.lesson !== l) return;
    clean = r === true;
  }
  stopLesson(false, clean); hush(); onStep();
}
let lastDone = null;
// fin de parcours : le chef conclut, l'écran reste affiché jusqu'au choix suivant
function finished(l) {
  lastDone = l; UI.notes = []; UI.feedback = ''; hush();
  if (S.visite) { if (l.id === 'prise-en-main') VISIT.tour = true; else if (l.id.startsWith('poste-')) VISIT.done.add(l.id.slice(6)); }
  speak(l.outro || ''); render(true);
}
function renderFinish(l) {
  const p = progressOf(l.id);
  const body = el('div', { class: 'chef-body' },
    el('h3', { class: 'chef-step' }, `« ${l.title} » : terminé !`),
    rich(l.outro || 'Bravo, exercice terminé.'),
    el('p', { class: 'note' }, `Aide « Fais-le pour moi » : ${p.aided || 0} fois · indices : ${p.hints || 0} · mauvaises réponses : ${p.wrong || 0}. C'est enregistré dans ta progression.`));
  const nav = el('div', { class: 'chef-nav' });
  const close = el('button', { class: 'btn small', onclick: () => { lastDone = null; toggleChef(false); } }, 'Fermer');
  if (S.visite) {
    // visite guidée : le poste suivant, ou la fin de la visite
    const nx = visitNext(), stops = visitStops();
    if (nx) nav.append(el('button', { class: 'btn small primary', onclick: () => visitGo(nx) }, `Poste suivant : ${STATION_INFO[nx].title}`));
    else body.append(el('div', { class: 'chef-ok' }, rich(`**La visite est terminée.** Tu as vu les ${stops.length} postes du car. Les exercices pratiques de chaque poste t'attendent dans le **Cours**, rangés avec les leçons.`)));
    nav.append(el('button', { class: 'btn small', onclick: () => { lastDone = null; render(true); } }, 'Plan de la visite'));
    if (!nx) nav.append(el('button', { class: 'btn small primary', onclick: () => { lastDone = null; S.visite = false; toggleChef(false); emit('cours'); } }, 'Ouvrir le Cours'));
  } else {
    // exercice lancé depuis une leçon du Cours : on y revient
    const back = S.coursBack ? coursLesson(S.coursBack) : null;
    if (back) nav.append(el('button', { class: 'btn small primary', onclick: () => { lastDone = null; S.coursBack = null; toggleChef(false); emit('cours', { lesson: back.lesson.id }); } }, `Revenir à la leçon « ${back.lesson.title} »`));
    nav.append(el('button', { class: 'btn small' + (back ? '' : ' primary'), onclick: () => { lastDone = null; render(true); } }, 'Autres exercices'));
  }
  nav.append(close);
  UI.root.append(header(S.visite ? 'visite guidée' : 'exercice terminé'), body, el('footer', { class: 'chef-foot' }, nav));
}

// ---------------- visite guidée ----------------
// les postes du car, dans l'ordre des fiches (production, image, ralentis, son, technique) ;
// ceux qu'on a vus pendant cette visite sont cochés
const VISIT = { tour: false, done: /** @type {Set<string>} */ (new Set()) };
const visitStops = () => stationIds().filter((id) => hasStation(id) && lessonById('poste-' + id));
const visitNext = () => visitStops().find((id) => !VISIT.done.has(id)) || null;
function visitGo(id) { lastDone = null; if (TUTOR.lesson) stopLesson(false, false); startLesson(id === '*tour' ? 'prise-en-main' : 'poste-' + id); onStep(); }
function visitPlan(body) {
  const stops = visitStops(), seen = stops.filter((id) => VISIT.done.has(id)).length, nx = visitNext();
  body.append(el('h4', {}, `Visite guidée · ${seen} / ${stops.length} postes`),
    el('div', { class: 'chef-prog', role: 'progressbar', 'aria-label': 'Avancement de la visite', 'aria-valuemin': '0', 'aria-valuemax': String(stops.length), 'aria-valuenow': String(seen) }, el('i', { style: { width: `${(seen / Math.max(1, stops.length)) * 100}%` } })));
  const step = (id, label, done) => el('li', { class: 'chef-visit' + (done ? ' done' : '') + (id === (VISIT.tour ? nx : '*tour') ? ' next' : '') },
    el('button', { type: 'button', class: 'linkish', onclick: () => visitGo(id) }, done ? icon('fait') : el('i', { class: 'chef-dot', 'aria-hidden': 'true' }), el('span', {}, label), done ? el('span', { class: 'sr' }, ' (vu)') : null));
  body.append(el('ol', { class: 'chef-visit-list' }, step('*tour', 'Le tour du car', VISIT.tour), ...stops.map((id) => step(id, STATION_INFO[id].title, VISIT.done.has(id)))));
  const go = !VISIT.tour ? ['*tour', 'Commencer : le tour du car'] : nx ? [nx, `Continuer : ${STATION_INFO[nx].title}`] : null;
  body.append(el('div', { class: 'chef-acts' },
    go ? el('button', { class: 'btn small primary', onclick: () => visitGo(go[0]) }, go[1]) : null,
    el('button', { class: 'btn small', onclick: () => { S.visite = false; render(true); } }, 'Arrêter la visite')));
}

function card(l) {
  const p = progressOf(l.id); const why = S.mode === 'start' ? '' : lessonBlocked(l); const ok = !why;
  const resume = TUTOR.lesson && TUTOR.lesson.id === l.id;
  return el('div', { class: 'chef-card' + (p.done ? ' done' : '') },
    el('div', { class: 'grow' }, el('b', {}, l.title, p.done ? el('span', { class: 'chef-check', title: 'Déjà fait' }, icon('fait'), el('span', { class: 'sr' }, 'déjà fait')) : null), el('small', {}, `${l.duration} · ${l.level}`, comps(l)), el('span', { class: 's' }, l.summary)),
    el('button', { class: 'btn small' + (ok ? ' primary' : ''), disabled: !ok, title: why, onclick: async () => {
      if (resume) { onStep(); return; }
      if (TUTOR.lesson && !(await ask(`Abandonner « ${TUTOR.lesson.title} » pour commencer « ${l.title} » ?`, { title: 'Changer de parcours', ok: 'Commencer « ' + l.title + ' »', cancel: 'Garder le parcours en cours' }))) return;
      if (TUTOR.lesson) stopLesson(false, false);
      if (S.mode === 'start') { launchWith(l.id); return; }
      startLesson(l.id); onStep();
    } }, resume ? 'Reprendre' : p.done ? 'Refaire' : 'Commencer'));
}
// compétences du référentiel travaillées par le parcours (livret de compétences)
function comps(l) {
  const c = codesOf('parcours', l.id);
  return c.length ? el('span', { class: 'chef-comp', title: 'Compétences du référentiel TIEE travaillées : voir « Mon livret de compétences »' }, ' · compétence' + (c.length > 1 ? 's ' : ' ') + c.join(', ')) : null;
}
// depuis la feuille de service : le chef lance le car prêt à l'antenne (en IP si le parcours le
// demande) puis commence le parcours
function launchWith(id) {
  const l = lessonById(id); if (!l) return;
  const infra = /** @type {HTMLSelectElement | null} */ (document.getElementById('stinfra'));
  if (infra && l.needs && l.needs.ip) infra.value = 'ip';
  const b = /** @type {HTMLButtonElement | null} */ (document.getElementById('st-antenne'));
  if (!b) return;
  UI.intro = false; UI.openDom = l.domain;
  S.chefTour = false; S.visite = false;
  b.click();
  if (S.mode === 'start') return;
  startLesson(id); onStep();
  if (id === 'prise-en-main') dropOnboard();
}
// ---------------- depuis les autres écrans (Cours) ----------------
/**
 * Commence un parcours avec le chef, d'où que l'on soit : sur la feuille de service, le car est
 * lancé d'abord (en IP si le parcours le demande) ; dans le car, le panneau du chef s'ouvre sur
 * la première étape. Un parcours en cours n'est abandonné qu'avec l'accord du stagiaire.
 * @param {string} id
 */
export async function beginLesson(id) {
  const l = lessonById(id); if (!l) return;
  if (TUTOR.lesson && TUTOR.lesson.id === id) { toggleChef(true); return; }
  if (TUTOR.lesson && !(await ask(`Abandonner « ${TUTOR.lesson.title} » pour commencer « ${l.title} » ?`, { title: 'Changer de parcours', ok: 'Commencer « ' + l.title + ' »', cancel: 'Garder le parcours en cours' }))) return;
  if (TUTOR.lesson) stopLesson(false, false);
  lastDone = null; UI.intro = false; UI.openDom = l.domain;
  toggleChef(true);
  if (S.mode === 'start') { launchWith(id); return; }
  // le parcours demande un car IP, une caméra HF… : le chef l'explique dans sa liste
  if (lessonBlocked(l)) { render(true); toast(`« ${l.title} » : ${lessonBlocked(l).toLowerCase()}.`, 'bad', 6000); return; }
  startLesson(id); onStep();
}
function renderHome() {
  if (lastDone) { renderFinish(lastDone); return; }
  const atStart = S.mode === 'start';
  UI.root.append(header(atStart ? 'avant la vacation' : S.visite ? 'visite guidée' : UI.intro ? 'bienvenue dans le car' : 'à ton écoute'));
  if (UI.min) { UI.root.append(el('div', { class: 'chef-mini' }, 'Besoin d\'aide ? Agrandis-moi.')); return; }
  const body = el('div', { class: 'chef-body' });
  const st = S.mode === 'station' ? S.station : null;
  const { here } = lessonsFor(st);
  const toCours = (label = 'Tous les exercices : le Cours') => el('button', { class: 'btn small', onclick: () => { UI.min = true; UI.root.classList.add('min'); render(true); emit('cours'); } }, icon('cours'), label);
  if (atStart) {
    // feuille de service : la visite se choisit dans Jouer, les exercices dans le Cours
    body.append(rich(`Salut, moi c'est ${CHEF.name}, le chef de car. ${where()} Si tu découvres le car, choisis le mode **Visite guidée** : je te fais le tour du car, puis je te présente chaque poste. Les exercices pratiques sont dans le **Cours**, chacun dans la leçon qui l'explique.`),
      el('div', { class: 'chef-acts' }, toCours('Ouvrir le Cours')));
    UI.root.append(body);
    return;
  }
  if (UI.intro) {
    // premier lancement : les gestes de base, puis le tour du car
    const rows = matchMedia('(pointer: coarse)').matches ? FIRST_STEPS_TOUCH : FIRST_STEPS;
    body.append(rich(`Bienvenue au compound ! Moi c'est ${CHEF.name}, le chef de car. Je suis là pendant toute la vacation : bouton **Chef de car** ou touche **J**. Les gestes de base :`),
      el('ul', { class: 'chef-keys' }, ...rows.map(([k, d]) => el('li', {}, el('kbd', {}, k), el('span', {}, d)))),
      rich('On commence par le tour du car ? Cinq minutes : entrer dans le car, le plan caméras, les synoptiques, aller à un poste.'),
      el('div', { class: 'chef-acts' },
        el('button', { class: 'btn small primary', onclick: () => { UI.intro = false; startLesson('prise-en-main'); onStep(); } }, 'Commencer : se repérer'),
        el('button', { class: 'btn small', onclick: () => { UI.intro = false; toggleChef(false); toast('Le chef de car reste disponible : bouton « Chef de car » ou touche J.', '', 5000); } }, 'Plus tard')));
    UI.root.append(body);
    return;
  }
  if (S.visite) { body.append(rich(`${where()} On continue la visite ? Choisis un poste dans la liste, ou laisse-moi t'emmener au suivant.`)); visitPlan(body); UI.root.append(body); return; }
  body.append(rich(`Salut, moi c'est ${CHEF.name}, le chef de car. ${where()} ${st ? 'Voici ce qu\'on peut faire ici : je t\'explique, tu fais, je vérifie.' : 'Assieds-toi à un poste : je te propose ce qu\'on peut y faire. Tous les exercices sont aussi rangés dans le Cours, avec la leçon qui les explique.'}`));
  if (here.some((l) => l.needs && l.needs.ip) && !S.ipMode) body.append(el('div', { class: 'chef-note' }, rich('Les exercices **réseau ST 2110** se font dans le **car IP**. Ce car est câblé en SDI : je peux le passer en IP tout de suite (réseau rouge et bleu, PTP, NMOS).'),
    el('button', { class: 'btn small primary', onclick: () => switchToIp() }, 'Passer le car en IP')));
  // ici : les exercices pratiques du poste d'abord, sa présentation ensuite
  if (here.length) body.append(el('h4', {}, `Ici, au poste ${STATION_INFO[st] ? STATION_INFO[st].title : st}`), ...[...here].sort((a, b) => Number(a.domain === PRESENT) - Number(b.domain === PRESENT)).map(card));
  // le Cours et le livret s'ouvrent en grand : le chef se réduit pour ne pas les cacher
  body.append(el('div', { class: 'chef-acts' }, toCours(), el('button', { class: 'btn small', onclick: () => { UI.min = true; UI.root.classList.add('min'); render(true); openLivret(); } }, icon('fait'), 'Mon livret de compétences')));
  UI.root.append(body);
}
async function switchToIp() {
  if (!(await ask('Passer le car en IP (ST 2110) ? Les signaux passent alors par les deux réseaux rouge et bleu au lieu de la grille SDI.', { title: 'Car IP', ok: 'Passer en IP' }))) return;
  S.ipMode = true; resetFabric(); emit('router', {});
  toast('Car passé en IP : réseau ST 2110 rouge et bleu en service.', 'good');
  render(true);
}

// ---------------- commandes vers le terminal ----------------
function putInTerminal(line, s) {
  const inp = /** @type {HTMLInputElement | null} */ (document.querySelector('#station .net-cmd'));
  if (!inp || view().sw !== s.sw) {
    goTo({ station: 'reseau', tab: 'switch', sw: s.sw, sub: 'term' });
    setTimeout(() => putInTerminal2(line), 120);
    return;
  }
  putInTerminal2(line);
}
function putInTerminal2(line) {
  const inp = /** @type {HTMLInputElement | null} */ (document.querySelector('#station .net-cmd'));
  if (!inp) { toast('Ouvre le terminal du commutateur (bouton « Emmène-moi »).'); return; }
  inp.value = line; inp.focus();
  spot([{ sel: '#station .net-cmd', label: 'Entrée pour valider' }], true);
}

// ---------------- mise en évidence de l'élément à utiliser ----------------
function targets(s) { return s && s.show ? val(s.show, ctx()) : null; }
function findTarget(list) {
  for (const t of list || []) {
    for (const n of document.querySelectorAll(t.sel)) {
      const r = n.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (t.text && !(n.textContent || '').includes(t.text)) continue;
      return { n, r, t };
    }
  }
  // poste Réseau IP : la cible est dans l'autre onglet (Technique / Exploitation) → montrer cet onglet
  const other = /** @type {HTMLElement | null} */ (document.querySelector('#station .net-mode:not(.on)'));
  if (other && (list || []).length) {
    const wantOps = list.some((t) => /\.ops|data-(ops|act|dev|dst|src|f|leg|mode)=/.test(t.sel));
    if (wantOps === (other.dataset.mode === 'ops')) return { n: other, r: other.getBoundingClientRect(), t: { sel: '', label: 'onglet ' + (other.querySelector('b') || other).textContent } };
  }
  return null;
}
function spot(list, scroll = false) {
  const sp = document.getElementById('chef-spot'); if (!sp) return;
  const f = list ? findTarget(list) : null;
  if (!f) { sp.hidden = true; return; }
  if (scroll) { try { f.n.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) { /* rien */ } }
  const r = f.n.getBoundingClientRect();
  if (r.bottom < 0 || r.top > window.innerHeight) { sp.hidden = true; return; }
  sp.hidden = false;
  Object.assign(sp.style, { left: r.left - 5 + 'px', top: r.top - 5 + 'px', width: r.width + 10 + 'px', height: r.height + 10 + 'px' });
  const lab = sp.firstChild; lab.textContent = f.t.label || '';
  sp.classList.toggle('flash', performance.now() < UI.spotUntil);
  dodge(r);
}
// l'élément à utiliser est sous le panneau : le panneau passe de l'autre côté de l'écran
// (sauf si le stagiaire l'a placé lui-même)
function dodge(r) {
  if (!UI.root || UI.root.hidden || UI.placed || window.innerWidth <= 720) return;
  const p = UI.root.getBoundingClientRect();
  if (!(r.left < p.right && r.right > p.left && r.top < p.bottom && r.bottom > p.top)) return;
  const onRight = p.left > window.innerWidth / 2;
  if (onRight && r.left > p.width + 32) Object.assign(UI.root.style, { left: 'var(--gut-l)', right: 'auto' });
  else if (!onRight && r.right < window.innerWidth - p.width - 32) Object.assign(UI.root.style, { left: 'auto', right: 'var(--gut-r)' });
}

// ---------------- boucle : vérifier l'étape, suivre l'élément à montrer ----------------
setInterval(() => { try { tick(); } catch (e) { const r = report(e, 'chef de car (suivi de l\'étape)'); if (r && r.n === 1) console.error(e); } }, 250);
function tick() {
  for (const b of document.querySelectorAll('.chef-btn')) b.classList.toggle('busy', !!TUTOR.lesson);
  // dans la barre d'outils, le chef n'apparaît que s'il a quelque chose en cours (touche J à tout moment)
  const tb = document.getElementById('tb-chef'); if (tb) tb.hidden = !(TUTOR.lesson || TUTOR.open || S.visite);
  if (!TUTOR.lesson) { if (UI.root && !UI.root.hidden && S.mode !== 'start') render(); return; }
  const was = TUTOR.done;
  check();
  if (TUTOR.done !== was && TUTOR.open) { const s = step(); if (s && s.ok) speak(val(s.ok, ctx())); }
  if (TUTOR.open) {
    render();
    const s = step();
    spot(s && isAction(s) && !TUTOR.done && !UI.min ? targets(s) : null);
  }
}
on('chef', () => toggleChef());
// premier lancement d'une partie dans ce navigateur : le chef de car se présente de lui-même
// (car prêt à l'antenne ou grand dispositif ; les autres vacations ont leur propre consigne)
on('started', ({ preset }) => {
  let seen; try { seen = localStorage.getItem('carregie.chefIntro') === '1'; localStorage.setItem('carregie.chefIntro', '1'); } catch (e) { seen = true; }
  // feuille de service, touche « Visite guidée » allumée : le tour du car commence tout de suite
  if (S.chefTour && !TUTOR.lesson) { UI.intro = false; VISIT.tour = false; VISIT.done.clear(); lastDone = null; toggleChef(true); startLesson('prise-en-main'); onStep(); dropOnboard(); return; }
  if (S.chefTour === false && preset === 'standard') return;
  if (seen || TUTOR.open || !(preset === 'standard' || preset === 'grand')) return;
  UI.intro = true; UI.openDom = 'Prise en main';
  toggleChef(true); dropOnboard();
});
// le chef rappelle lui-même les premiers gestes : l'encart « Prise en main » n'est plus utile
function dropOnboard() {
  const ob = document.getElementById('onboard'); if (ob) ob.remove();
  try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* stockage indisponible */ }
}
on('station', () => {
  if (TUTOR.open) { render(true); return; }
  // la première fois qu'on ouvre un poste, le chef se présente (une fois par navigateur)
  let seen; try { seen = localStorage.getItem('carregie.chefHint') === '1'; localStorage.setItem('carregie.chefHint', '1'); } catch (e) { seen = true; }
  if (!seen) toast('Besoin d\'aide ? Le chef de car (bouton « Chef de car » ou touche J) vous présente ce poste et vous guide pas à pas.', '', 7000);
});
on('stationClose', () => { if (TUTOR.open) render(true); });
