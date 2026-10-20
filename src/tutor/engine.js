// @ts-check
import { S, on, emit } from '../state.js';
import { PROG, saveProgressSoon } from '../shared.js';

// ----------------------------------------------------------------------------------
// Le chef de car : un tuteur qui accompagne le stagiaire poste par poste. Un parcours est une
// suite d'étapes :
//   · explication : le chef parle, « Suivant » pour continuer ;
//   · action : le chef explique puis demande un geste ; l'étape est validée quand l'état réel
//     du simulateur le montre (done), le chef commente alors le résultat (ok) ;
//   · question : choix multiple, avec l'explication de la bonne réponse.
// Chaque action propose « Montre-moi » (élément à utiliser mis en évidence), « Emmène-moi »
// (poste et onglet), des indices progressifs et « Fais-le pour moi ».
// Le moteur ne touche pas au DOM : l'interface (ui/tutor_ui.js) lui fournit ses entrées et
// sorties (io) ; sans interface (tests), io simule la navigation et la ligne de commande.
// ----------------------------------------------------------------------------------

/**
 * @typedef {object} Step
 * @property {string} id
 * @property {string} title titre court (liste des étapes)
 * @property {string | ((c: Ctx) => string)} say ce que dit le chef (`code`, **gras**, paragraphes séparés par une ligne vide)
 * @property {string | ((c: Ctx) => string)} [do] le geste demandé (étape d'action)
 * @property {string[] | ((c: Ctx) => string[])} [cli] commandes à taper (cliquables : elles vont dans le terminal)
 * @property {string} [sw] commutateur concerné par les commandes
 * @property {(c: Ctx) => boolean} [done] condition de réussite (étape d'action)
 * @property {string | ((c: Ctx) => string)} [ok] commentaire du chef quand c'est fait
 * @property {string[]} [hints] indices, du plus discret au plus explicite
 * @property {(c: Ctx) => void} [auto] action du bouton Fais-le pour moi
 * @property {(c: Ctx) => void} [enter] préparation à l'entrée dans l'étape (une seule fois)
 * @property {Go | ((c: Ctx) => Go)} [go] où se rendre (poste, onglet…)
 * @property {Target[] | ((c: Ctx) => Target[])} [show] éléments à mettre en évidence
 * @property {{ q: string, choices: string[], answer: number, why: string }} [quiz]
 * @property {(c: Ctx) => boolean} [skip] étape sautée quand c'est vrai (ex. : on est déjà au poste)
 */
/** @typedef {{ station?: string, cam?: number, tab?: string, sub?: string, sw?: string, port?: string, rx?: string, msub?: string, sel?: { kind: string, id: string }, device?: string, n?: number }} Go */
/** @typedef {{ sel: string, text?: string, label?: string }} Target */
/**
 * @typedef {object} Lesson
 * @property {string} id
 * @property {string} domain famille (ex. « Réseau ST 2110 »)
 * @property {string[]} stations postes où le chef le propose en premier
 * @property {string} title
 * @property {string} summary
 * @property {string} duration
 * @property {string} level
 * @property {{ ip?: boolean, hf?: boolean, cams?: number }} [needs]
 * @property {(c: Ctx) => void} [after] toujours appelé à la fin du parcours (terminé ou quitté)
 * @property {string} [outro]
 * @property {string} [cleanupLabel] ce que fait cleanup, proposé quand on quitte avant la fin
 * @property {(c: Ctx) => void} [cleanup]
 * @property {Step[]} steps
 */
/**
 * @typedef {object} Ctx contexte passé aux textes et aux conditions
 * @property {IO} io
 * @property {(type: string, pred?: (e: any) => boolean) => boolean} seen événement survenu depuis le début de l'étape
 * @property {() => any} view où en est l'interface (poste, onglet, commutateur…)
 * @property {Record<string, any>} mem mémoire du parcours (valeurs tirées au départ, etc.)
 */
/**
 * @typedef {object} IO entrées et sorties fournies par l'interface
 * @property {(sw: string, lines: string[]) => void} cli tape des commandes sur un commutateur
 * @property {(g: Go) => void} go se rendre au poste / à l'onglet
 * @property {() => any} view état de l'interface
 * @property {(type: string, o?: object) => void} log simule une action d'interface (événement « netlog »)
 * @property {(name: string, ...args: any[]) => any} [ui] gestes d'interface hors des postes : prendre une caméra,
 *   ouvrir un appareil dans la visionneuse, cliquer un bouton, l'atelier de montage…
 */

export const LESSONS = /** @type {Lesson[]} */ ([]);
export function registerLessons(list) { for (const l of list) if (!LESSONS.some((x) => x.id === l.id)) LESSONS.push(l); }
export const lessonById = (id) => LESSONS.find((l) => l.id === id) || null;

export const TUTOR = {
  /** @type {Lesson | null} */ lesson: null,
  i: 0,            // étape courante
  done: false,     // l'étape courante est réussie (on attend « Suivant »)
  t0: 0,           // début de l'étape (horloge réelle du simulateur)
  hint: 0,         // indices montrés sur l'étape
  aided: false,    // « fais-le pour moi » utilisé sur l'étape
  answer: /** @type {number | null} */ (null),
  tries: 0,        // mauvaises réponses à la question de l'étape
  entered: /** @type {Set<string>} */ (new Set()),
  mem: /** @type {Record<string, any>} */ ({}),
  stats: { aided: 0, hints: 0, wrong: 0 },
  /** @type {Array<{ type: string, t: number, [k: string]: any }>} */ log: [],
  /** @type {IO} */ io: /** @type {any} */ (null),
  open: false,     // panneau ouvert
};

// ---------------- entrées / sorties par défaut (sans interface) ----------------
const headView = { station: null, cam: null, mode: 'tech', tab: null, sub: null, sw: null, port: null, rx: null, opsView: null, opsDev: null, opsRx: null, opsSrc: null, opsMode: null, device: null, devView: null };
export function headlessIO(runCli) {
  return {
    cli(sw, lines) { for (const l of lines) runCli(sw, l); },
    go(g) {
      if (g.station) { if (headView.station !== g.station) headView.tab = null; headView.station = g.station; headView.cam = g.cam || null; }
      if (g.device) headView.device = g.device;
      // poste Réseau IP : onglet Exploitation (vue, appareil, récepteur, source) ou onglet Technique
      if (g.tab === 'ops') { headView.mode = 'ops'; for (const [k, h] of [['view', 'opsView'], ['dev', 'opsDev'], ['rx', 'opsRx'], ['src', 'opsSrc']]) if (g[k]) headView[h] = g[k]; emit('netlog', { type: 'mode', mode: 'ops' }); return; }
      if (g.tab) headView.mode = 'tech';
      for (const k of ['tab', 'sub', 'sw', 'port', 'rx']) if (g[k]) headView[k] = g[k];
      if (g.tab) emit('netlog', { type: 'tab', tab: g.tab });
    },
    view: () => headView,
    log(type, o = {}) { emit('netlog', { type, ...o }); },
    // sans interface : seuls les effets sur l'état comptent (caméra prise, appareil ouvert)
    ui(name, ...a) {
      if (name === 'take') { headView.station = null; S.mode = 'camop'; S.camop = S.cams.find((c) => c.id === a[0]) || null; }
      if (name === 'release') { S.mode = 'fps'; S.camop = null; }
      if (name === 'device') { headView.device = a[0]; headView.devView = (a[2] && a[2].view) || 'arriere'; }
      if (name === 'closeModal') headView.device = null;
    },
  };
}
export function setIO(io) { TUTOR.io = io; }

// journal des actions : le chef vérifie ce qui a été fait depuis le début de l'étape
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
const push = (e) => { TUTOR.log.push({ ...e, t: now() }); if (TUTOR.log.length > 300) TUTOR.log.shift(); };
on('netlog', push);
on('station', (id) => push({ type: 'station', id }));
// les autres postes : mélangeur, habillage, ralentis, pannes, fiches, matériel… (ev = le type d'origine)
for (const name of ['mixer', 'gfx', 'evs', 'fault', 'keymode', 'info', 'mission', 'device', 'audio', 'router', 'intercom', 'repair', 'patchDone']) {
  on(name, (p) => push(p && typeof p === 'object' ? { ...p, ev: p.type, type: name } : { type: name, v: p }));
}

/** @returns {Ctx} */
export function ctx() {
  return {
    io: TUTOR.io,
    seen: (type, pred = () => true) => TUTOR.log.some((e) => e.t >= TUTOR.t0 && e.type === type && pred(e)),
    view: () => (TUTOR.io ? TUTOR.io.view() : headView),
    mem: TUTOR.mem,
  };
}
export const val = (v, c) => (typeof v === 'function' ? v(c) : v);
export const step = () => (TUTOR.lesson ? TUTOR.lesson.steps[TUTOR.i] : null);
export const isAction = (s) => !!(s && (s.done || s.quiz));

// ---------------- déroulement ----------------
export function startLesson(id) {
  const l = lessonById(id); if (!l) return false;
  Object.assign(TUTOR, { lesson: l, i: 0, mem: {}, stats: { aided: 0, hints: 0, wrong: 0 } });
  TUTOR.entered = new Set();
  progressOf(l.id).started = Date.now();
  goStep(0);
  emit('tutor', { type: 'start', id });
  return true;
}
export function stopLesson(finished = false, cleanup = false) {
  const l = TUTOR.lesson; if (!l) return;
  if (!finished && cleanup && l.cleanup) { try { l.cleanup(ctx()); } catch (e) { console.error(e); } }
  if (finished) {
    const p = progressOf(l.id);
    Object.assign(p, { done: true, at: Date.now(), aided: TUTOR.stats.aided, hints: TUTOR.stats.hints, wrong: TUTOR.stats.wrong, steps: l.steps.length });
    saveProgressSoon();
  }
  if (l.after) { try { l.after(ctx()); } catch (e) { console.error(e); } }
  TUTOR.lesson = null;
  emit('tutor', { type: finished ? 'finish' : 'stop', id: l.id });
}
function enterStep() {
  const s = step(); if (!s) return;
  TUTOR.t0 = now(); TUTOR.hint = 0; TUTOR.aided = false; TUTOR.answer = null; TUTOR.tries = 0;
  TUTOR.done = !isAction(s);
  const key = TUTOR.lesson.id + '/' + s.id;
  if (s.enter && !TUTOR.entered.has(key)) { TUTOR.entered.add(key); s.enter(ctx()); }
  progressOf(TUTOR.lesson.id).step = TUTOR.i;
  check();
}
export function goStep(i, dir = 1) {
  const l = TUTOR.lesson; if (!l) return;
  TUTOR.i = Math.max(0, Math.min(l.steps.length - 1, i));
  // étapes inutiles dans la situation présente (déjà au bon endroit…)
  for (;;) {
    const s = l.steps[TUTOR.i]; let skip;
    try { skip = !!(s.skip && s.skip(ctx())); } catch (e) { skip = false; }
    const j = TUTOR.i + dir;
    if (!skip || j < 0 || j >= l.steps.length) break;
    TUTOR.i = j;
  }
  enterStep();
  emit('tutor', { type: 'step', i: TUTOR.i });
}
export function next() {
  const l = TUTOR.lesson; if (!l) return;
  if (TUTOR.i >= l.steps.length - 1) { stopLesson(true); return; }
  goStep(TUTOR.i + 1);
}
export const prev = () => goStep(TUTOR.i - 1, -1);

// vérification (appelée régulièrement par l'interface, et après chaque action)
export function check() {
  const s = step(); if (!s || TUTOR.done || !s.done) return TUTOR.done;
  let ok;
  try { ok = !!s.done(ctx()); } catch (e) { ok = false; } // état transitoire pendant un recalcul
  if (ok) { TUTOR.done = true; emit('tutor', { type: 'done', i: TUTOR.i }); }
  return TUTOR.done;
}
export function hint() {
  const s = step(); if (!s || !s.hints || TUTOR.hint >= s.hints.length) return null;
  TUTOR.hint++; TUTOR.stats.hints++;
  emit('tutor', { type: 'hint' });
  return s.hints[TUTOR.hint - 1];
}
export function doForMe() {
  const s = step(); if (!s || !s.auto || TUTOR.done) return false;
  TUTOR.aided = true; TUTOR.stats.aided++;
  s.auto(ctx());
  check();
  emit('tutor', { type: 'auto', i: TUTOR.i });
  return true;
}
export function answer(k) {
  const s = step(); if (!s || !s.quiz || TUTOR.done) return false;
  TUTOR.answer = k;
  const ok = k === s.quiz.answer;
  if (ok) TUTOR.done = true; else { TUTOR.stats.wrong++; TUTOR.tries++; }
  emit('tutor', { type: 'answer', ok });
  return ok;
}

// ---------------- progression (enregistrée avec celle du stagiaire) ----------------
export function progressOf(id) {
  const P = PROG.tutor = PROG.tutor || {};
  return (P[id] = P[id] || { done: false });
}
export const lessonsDone = () => Object.entries(PROG.tutor || {}).filter(([, p]) => p.done).map(([id]) => id);
// parcours proposés en premier à un poste donné (puis tous les autres)
export function lessonsFor(station) {
  const here = LESSONS.filter((l) => station && l.stations.includes(station));
  return { here, others: LESSONS.filter((l) => !here.includes(l)) };
}
// un parcours peut demander le car IP, une caméra HF, deux canaux EVS…
export function lessonBlocked(l) {
  const n = l.needs || {};
  if (n.ip && !S.ipMode) return 'Demande le car IP';
  if (n.hf && !S.cams.some((c) => c.rf)) return 'Demande une caméra HF (plan caméras)';
  if (n.cams && S.cams.length < n.cams) return `Demande au moins ${n.cams} caméras`;
  return '';
}
export const lessonAvailable = (l) => !lessonBlocked(l);
