// @ts-check
import { S, on, emit } from '../state.js';
import { el } from '../util.js';
import { resetFabric } from '../net/fabric.js';
import { toast, ask } from './common.js';
import { hasStation, closeStation } from './stations.js';
import { closePlan } from './plan.js';
import { netGo, netView, netType } from './st_network.js';
import { releaseCamera } from '../app/camop.js';
import { whereAmI } from '../app/hud.js';
import { TUTOR, registerLessons, setIO, startLesson, stopLesson, next, prev, check, hint, doForMe, answer, step, isAction, ctx, val, lessonsFor, lessonAvailable, progressOf } from '../tutor/engine.js';
import { NET_LESSONS } from '../tutor/lessons/reseau.js';
import { stationLesson, stationIds } from '../tutor/lessons/postes.js';
import { STATION_INFO } from '../content/stations.js';
import { rich } from './rich.js';

// ----------------------------------------------------------------------------------
// Le chef de car à l'écran : un panneau qui ne bloque pas le poste (on lit et on agit en
// même temps), appelé à tout moment (bouton « Chef de car », touche J). Il propose les
// parcours du poste où l'on se trouve, déroule les étapes, met en évidence l'élément à
// utiliser, emmène au bon poste et au bon onglet, tape les commandes si on le lui demande.
// ----------------------------------------------------------------------------------
const CHEF = { name: 'Olivier', role: 'chef de car' };
const UI = { root: /** @type {HTMLElement | null} */ (null), min: false, said: '', lastKey: '', voice: false, notes: /** @type {string[]} */ ([]), feedback: '', spotUntil: 0 };
try { UI.voice = localStorage.getItem('carregie.chefVoice') === '1'; } catch (e) { /* stockage indisponible */ }

// ---------------- entrées / sorties pour le moteur ----------------
const view = () => {
  const station = S.mode === 'station' ? S.station : null;
  const v = station === 'reseau' ? netView() : { tab: null, sub: null, sw: null, port: null, rx: null };
  return { station, ...v };
};
function goTo(g) {
  if (!g) return;
  if (g.station && view().station !== g.station) {
    if (!hasStation(g.station)) return;
    if (S.mode === 'camop') releaseCamera();
    if (S.mode === 'plan') closePlan();
    if (S.mode === 'station') closeStation(true);
    emit('openStationNow', { id: g.station });
  }
  if (g.station === 'reseau' && (g.tab || g.sw || g.sub || g.rx || g.sel)) {
    const o = {}; for (const k of ['sw', 'sub', 'port', 'rx', 'msub', 'sel', 'view', 'dev', 'src']) if (g[k] !== undefined) o[k] = g[k];
    netGo(g.tab, o);
  }
}
setIO({
  cli: (sw, lines) => netType(sw, lines),
  go: goTo,
  view,
  log: (type, o = {}) => emit('netlog', { type, ...o }),
});

// parcours connus : réseau ST 2110, puis la présentation de chaque poste
registerLessons(NET_LESSONS);
registerLessons(stationIds().map((id) => stationLesson(id, hasStation(id))).filter(Boolean));

// ---------------- texte du chef : `code`, **gras**, listes « - », paragraphes ----------------
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
  if (S.mode === 'start' && open) { toast('Lancez d\'abord une vacation : le chef de car vous attend dans le car.'); return; }
  TUTOR.open = open;
  if (!open) { hush(); if (UI.root) UI.root.hidden = true; spot(null); return; }
  if (!UI.root) build();
  UI.root.hidden = false; UI.min = false; UI.root.classList.remove('min');
  render(true);
}
function build() {
  UI.root = el('aside', { id: 'chef', class: 'chef', role: 'dialog', 'aria-label': 'Chef de car', hidden: true });
  document.body.append(UI.root, el('div', { id: 'chef-spot', hidden: true }, el('span', { class: 'chef-spot-lab' })));
  // le panneau se déplace en le prenant par son en-tête (position mémorisée)
  try { const p = JSON.parse(localStorage.getItem('carregie.chefPos') || 'null'); if (p && window.innerWidth > 720) Object.assign(UI.root.style, { left: p.x + 'px', top: p.y + 'px', right: 'auto', bottom: 'auto' }); } catch (e) { /* position par défaut */ }
}
function drag(head) {
  head.addEventListener('pointerdown', (e) => {
    if (window.innerWidth <= 720 || /** @type {HTMLElement} */ (e.target).closest('button')) return;
    const r = UI.root.getBoundingClientRect(); const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const mv = (ev) => { const x = Math.max(4, Math.min(window.innerWidth - 120, ev.clientX - dx)), y = Math.max(4, Math.min(window.innerHeight - 60, ev.clientY - dy)); Object.assign(UI.root.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' }); };
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); const r2 = UI.root.getBoundingClientRect(); try { localStorage.setItem('carregie.chefPos', JSON.stringify({ x: Math.round(r2.left), y: Math.round(r2.top) })); } catch (er) { /* rien */ } };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  });
}
function header(sub) {
  const voice = el('button', { class: 'chef-ico' + (UI.voice ? ' on' : ''), title: UI.voice ? 'Couper la voix du chef' : 'Faire parler le chef (synthèse vocale)', 'aria-pressed': String(UI.voice), onclick: () => { UI.voice = !UI.voice; try { localStorage.setItem('carregie.chefVoice', UI.voice ? '1' : '0'); } catch (e) { /* rien */ } if (!UI.voice) hush(); else { UI.said = ''; } render(true); } }, UI.voice ? 'Voix' : 'Muet');
  const h = el('header', { class: 'chef-head' },
    el('div', { class: 'chef-avatar', 'aria-hidden': 'true' }, 'O'),
    el('div', { class: 'chef-who' }, el('b', {}, `${CHEF.name} · ${CHEF.role}`), el('small', {}, sub || '')),
    voice,
    el('button', { class: 'chef-ico', title: UI.min ? 'Agrandir' : 'Réduire', onclick: () => { UI.min = !UI.min; UI.root.classList.toggle('min', UI.min); render(true); } }, UI.min ? '▢' : '–'),
    el('button', { class: 'chef-ico', title: 'Fermer (J)', onclick: () => toggleChef(false) }, '×'));
  drag(h);
  return h;
}
function where() {
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
    const todo = el('div', { class: 'chef-do' + (TUTOR.done ? ' ok' : '') }, el('span', { class: 'chef-tag' }, TUTOR.done ? 'Fait' : 'À toi'), rich(val(s.do, c)));
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
    q.choices.forEach((t, k) => box.append(el('button', { class: 'btn small chef-choice' + (TUTOR.answer === k ? (k === q.answer ? ' good' : ' bad') : ''), disabled: TUTOR.done, onclick: () => { answer(k); render(true); } }, t)));
    if (TUTOR.answer != null) box.append(TUTOR.answer === q.answer ? el('div', { class: 'chef-ok' }, rich('**Exactement.** ' + q.why)) : el('div', { class: 'chef-bad' }, 'Pas tout à fait. Relis l\'explication et réessaie.'));
    body.append(box);
  }
  for (const n of UI.notes) body.append(el('div', { class: 'chef-hint' }, el('span', { class: 'chef-tag' }, 'Indice'), rich(n)));
  if (UI.feedback) body.append(el('div', { class: 'chef-note' }, UI.feedback));
  if (s.do && TUTOR.done && s.ok) body.append(el('div', { class: 'chef-ok' }, el('span', { class: 'chef-tag' }, 'Bien joué'), rich(val(s.ok, c))));
  else if (s.do && !TUTOR.done) body.append(el('div', { class: 'chef-wait' }, el('i', { class: 'chef-dot' }), 'Je regarde ce que tu fais…'));
  UI.root.append(body);
  // actions
  const g = s.go ? val(s.go, c) : null;
  const v = /** @type {any} */ (view());
  // poste Réseau IP : onglet Exploitation (vue, appareil) ou sous-onglet de l'onglet Technique
  const atTab = !g || !g.tab ? true : g.tab === 'ops' ? v.mode === 'ops' && (!g.view || v.opsView === g.view) && (!g.dev || v.opsDev === g.dev) : v.tab === g.tab && v.mode !== 'ops';
  const there = !g || (v.station === (g.station || v.station) && atTab);
  const acts = el('div', { class: 'chef-acts' });
  if (isAction(s) && !TUTOR.done) {
    if (g || s.show) acts.append(el('button', { class: 'btn small', onclick: () => { if (!there) goTo(g); UI.spotUntil = performance.now() + 6000; spot(targets(s), true); } }, there ? 'Montre-moi' : 'Emmène-moi'));
    if (s.hints && TUTOR.hint < s.hints.length) acts.append(el('button', { class: 'btn small', onclick: () => { const h = hint(); if (h) UI.notes.push(h); render(true); } }, 'Un indice'));
    if (s.auto) acts.append(el('button', { class: 'btn small', title: 'Le chef le fait devant toi et t\'explique', onclick: () => { if (g && !there) goTo(g); doForMe(); UI.feedback = TUTOR.done ? '' : 'J\'ai lancé l\'action ; ça devrait se voir dans un instant.'; render(true); } }, 'Fais-le pour moi'));
  }
  const nav = el('div', { class: 'chef-nav' },
    el('button', { class: 'btn small', disabled: TUTOR.i === 0, onclick: () => { prev(); onStep(); } }, '◀'),
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
function finished(l) { lastDone = l; UI.notes = []; UI.feedback = ''; hush(); speak(l.outro || ''); render(true); }
function renderFinish(l) {
  const p = progressOf(l.id);
  UI.root.append(header('Parcours terminé'), el('div', { class: 'chef-body' },
    el('h3', { class: 'chef-step' }, `« ${l.title} » : terminé !`),
    rich(l.outro || 'Bravo, parcours terminé.'),
    el('p', { class: 'note' }, `Aide « Fais-le pour moi » : ${p.aided || 0} fois · indices : ${p.hints || 0} · mauvaises réponses : ${p.wrong || 0}. C'est enregistré dans ta progression.`)),
  el('footer', { class: 'chef-foot' }, el('div', { class: 'chef-nav' }, el('button', { class: 'btn small primary', onclick: () => { lastDone = null; render(true); } }, 'Autres parcours'), el('button', { class: 'btn small', onclick: () => { lastDone = null; toggleChef(false); } }, 'Fermer'))));
}

function card(l) {
  const p = progressOf(l.id); const ok = lessonAvailable(l);
  const resume = TUTOR.lesson && TUTOR.lesson.id === l.id;
  return el('div', { class: 'chef-card' + (p.done ? ' done' : '') },
    el('div', { class: 'grow' }, el('b', {}, l.title, p.done ? el('span', { class: 'chef-check', title: 'déjà fait' }, ' ✓') : null), el('small', {}, `${l.duration} · ${l.level}`), el('span', { class: 's' }, l.summary)),
    el('button', { class: 'btn small' + (ok ? ' primary' : ''), disabled: !ok, title: ok ? '' : 'Demande le car IP', onclick: async () => {
      if (resume) { onStep(); return; }
      if (TUTOR.lesson && !(await ask(`Abandonner « ${TUTOR.lesson.title} » pour commencer « ${l.title} » ?`, { title: 'Changer de parcours', ok: 'Commencer « ' + l.title + ' »', cancel: 'Garder le parcours en cours' }))) return;
      if (TUTOR.lesson) stopLesson(false, false);
      startLesson(l.id); onStep();
    } }, resume ? 'Reprendre' : p.done ? 'Refaire' : 'Commencer'));
}
function renderHome() {
  if (lastDone) { renderFinish(lastDone); return; }
  UI.root.append(header('à ton écoute'));
  if (UI.min) { UI.root.append(el('div', { class: 'chef-mini' }, 'Besoin d\'aide ? Agrandis-moi.')); return; }
  const body = el('div', { class: 'chef-body' });
  const st = S.mode === 'station' ? S.station : null;
  const { here, others } = lessonsFor(st);
  body.append(rich(`Salut, moi c'est ${CHEF.name}, le chef de car. ${where()} Je peux te présenter un poste, ou t'accompagner pas à pas dans un parcours : je t'explique, tu fais, je vérifie.`));
  const ipNeeded = [...here, ...others].some((l) => l.needs && l.needs.ip) && !S.ipMode;
  if (ipNeeded) body.append(el('div', { class: 'chef-note' }, rich('Les parcours **réseau ST 2110** se font dans le **car IP**. Ce car est câblé en SDI : je peux le passer en IP tout de suite (réseau rouge et bleu, PTP, NMOS).'),
    el('button', { class: 'btn small primary', onclick: () => switchToIp() }, 'Passer le car en IP')));
  if (here.length) body.append(el('h4', {}, `Ici, au poste ${STATION_INFO[st] ? STATION_INFO[st].title : st}`), ...here.map(card));
  const groups = {};
  for (const l of others) (groups[l.domain] = groups[l.domain] || []).push(l);
  for (const [dom, list] of Object.entries(groups)) {
    if (dom === 'Les postes du car') body.append(el('details', { class: 'chef-more' }, el('summary', {}, `${dom} (${list.length})`), ...list.map(card)));
    else body.append(el('h4', {}, dom), ...list.map(card));
  }
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
}

// ---------------- boucle : vérifier l'étape, suivre l'élément à montrer ----------------
setInterval(() => {
  for (const b of document.querySelectorAll('.chef-btn')) b.classList.toggle('busy', !!TUTOR.lesson);
  if (!TUTOR.lesson) { if (UI.root && !UI.root.hidden && S.mode !== 'start') render(); return; }
  const was = TUTOR.done;
  check();
  if (TUTOR.done !== was && TUTOR.open) { const s = step(); if (s && s.ok) speak(val(s.ok, ctx())); }
  if (TUTOR.open) {
    render();
    const s = step();
    spot(s && isAction(s) && !TUTOR.done && !UI.min ? targets(s) : null);
  }
}, 250);
on('chef', () => toggleChef());
on('station', () => {
  if (TUTOR.open) { render(true); return; }
  // la première fois qu'on ouvre un poste, le chef se présente (une fois par navigateur)
  let seen; try { seen = localStorage.getItem('carregie.chefHint') === '1'; localStorage.setItem('carregie.chefHint', '1'); } catch (e) { seen = true; }
  if (!seen) toast('Besoin d\'aide ? Le chef de car (bouton « Chef de car » ou touche J) vous présente ce poste et vous guide pas à pas.', '', 7000);
});
on('stationClose', () => { if (TUTOR.open) render(true); });
