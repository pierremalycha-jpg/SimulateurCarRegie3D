// @ts-check
import { S, emit, on } from './state.js';
import { EQUIP } from './equip.js';
import { setSoundPlan, applyAudioPatch } from './audio.js';
import { applyOverrides } from './params.js';
import { mergeGame } from './game/xp.js';

// ----------------------------------------------------------------------------------
// Données partagées de la page publiée (capacités db / user / assets / downloads),
// avec repli sur le stockage du navigateur quand elles ne sont pas disponibles.
//   config/car      : nom du car, matériel, check-list et procédures maison (écrit par le formateur)
//   config/cabling  : liste de câblage importée
//   config/photos   : photos du matériel et leurs points cliquables
//   config/review   : arbitrage du formateur (statut par point) et corrections chiffrées appliquées
//   review/<id>     : relecture d'un expert (avis par point, valeurs proposées, autres remarques)
//   sessions/<id>   : comptes rendus des sessions à plusieurs (formateur)
//   progress/<id>   : progression d'un stagiaire (missions, scénarios, signalements, perf)
// ----------------------------------------------------------------------------------
export const SH = { db: null, user: null, assets: null, downloads: null, uid: null, isOwner: false, canEdit: false, canWrite: null, ready: false, readOnly: false };
/**
 * @typedef {object} CarConfig réglages du car (tous facultatifs : le simulateur a ses valeurs par défaut)
 * @property {string} [name] @property {string} [company] @property {string[]} [soundPlan] plan de son : 4 paires embedder
 * @property {Object<string, any>} [equip] @property {string[]} [checklist]
 * @property {Array<{ title: string, steps?: string[] }>} [procedures]
 * @property {any[]} [camPreset] @property {any} [audioPatch]
 */
/** @type {{ car: CarConfig, cabling: any, photos: { list: any[] }, review: { items: Object<string, any>, overrides: Object<string, any> } }} */
export const CFG = { car: {}, cabling: null, photos: { list: [] }, review: { items: {}, overrides: {} } };
// ma relecture (expert) : enregistrée dans review/<mon id>
export const MYREV = { domains: [], items: {}, params: {}, extra: [], updatedAt: 0 };
/**
 * Version du format de la progression (PROG.v). À monter quand sa forme change, avec l'étape qui convient
 * dans migrateProgress. 1 : sans numéro (jusqu'à la v19.3) ; 2 : numérotée, réussites « seul » (clean) des
 * parcours et des missions réseau (v19.4).
 */
export const PROG_VERSION = 2;
export const PROG = { v: PROG_VERSION, missions: {}, visited: {}, scenarios: [], reports: [], perf: null, patchBest: 0, updatedAt: 0 };
/** état du dernier enregistrement de la progression : sur cet ordinateur (local), sur le serveur de la page (remote) */
export const SAVE = { local: /** @type {boolean | null} */ (null), remote: /** @type {boolean | null} */ (null), at: 0, error: '' };

const LS = {
  get(k, d) { try { const v = localStorage.getItem('carregie.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('carregie.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

export async function initShared() {
  // valeurs locales d'abord (fonctionne hors de claude.ai)
  for (const k of ['car', 'cabling', 'photos', 'review']) { const v = LS.get('config.' + k, null); if (v) CFG[k] = v; }
  Object.assign(PROG, migrateProgress(LS.get('progress', {})) || {});
  Object.assign(MYREV, LS.get('review.me', {}));
  applyConfig();
  restoreProgress();
  const c = window.claude;
  if (c && typeof c.use === 'function') {
    const get = (n) => withTimeout(c.use(n).catch(() => null), 12000);
    const [db, user, assets, downloads] = await Promise.all([get('db'), get('user'), get('assets'), get('downloads')]);
    Object.assign(SH, { db, user, assets, downloads });
    if (user) {
      SH.uid = await user.id(); SH.isOwner = await user.isOwner(); SH.canEdit = await user.canEdit(); SH.canWrite = await user.can('data.write');
    }
    if (db) {
      for (const k of ['car', 'cabling', 'photos', 'review']) {
        db.doc('config/' + k).onSnapshot((snap) => { if (snap.exists) { CFG[k] = structuredClone(snap.data()); LS.set('config.' + k, CFG[k]); applyConfig(); emit('config', k); } }, () => {});
      }
      if (SH.uid) {
        try {
          const snap = await db.doc('progress/' + SH.uid).get();
          if (snap.exists) { mergeProgress(snap.data()); restoreProgress(); }
        } catch (e) { /* lecture refusée : progression locale seulement */ }
        try {
          const r = await db.doc('review/' + SH.uid).get();
          if (r.exists) { Object.assign(MYREV, structuredClone(r.data())); LS.set('review.me', MYREV); emit('myreview'); }
        } catch (e) { /* relecture partagée indisponible */ }
      }
    }
  }
  SH.ready = true;
  emit('shared');
}

// ---------------- configuration du car ----------------
function applyConfig() {
  const e = CFG.car.equip || {};
  for (const k of ['evsServers', 'evsHdChannels', 'lsmCount', 'mix4kInputs']) if (e[k] != null) EQUIP[k] = +e[k];
  if (CFG.car.name) EQUIP.truck = CFG.car.name;
  setSoundPlan(CFG.car.soundPlan);
  applyAudioPatch(CFG.car.audioPatch);
  applyOverrides((CFG.review && CFG.review.overrides) || {});
}
export function canConfigure() { return !SH.db || SH.canEdit || SH.isOwner; }
export async function saveConfig(part, data) {
  CFG[part] = data; LS.set('config.' + part, data); applyConfig(); emit('config', part);
  if (!SH.db) return { ok: true, local: true };
  try { await SH.db.doc('config/' + part).set(JSON.parse(JSON.stringify(data))); return { ok: true }; }
  catch (e) { return { ok: false, code: e && e.code, message: e && e.message }; }
}

// ---------------- relecture métier ----------------
/** @type {ReturnType<typeof setTimeout> | undefined} */ let revT;
export function saveMyReviewSoon() { clearTimeout(revT); revT = setTimeout(saveMyReview, 1200); }
export async function saveMyReview() {
  MYREV.updatedAt = Date.now();
  LS.set('review.me', MYREV);
  if (!SH.db || !SH.uid) return { ok: true, local: true };
  try { await SH.db.doc('review/' + SH.uid).set(JSON.parse(JSON.stringify(MYREV))); return { ok: true }; }
  catch (e) { return { ok: false, code: e && e.code, message: e && e.message }; }
}
// toutes les relectures (formateur / autres experts) : [{ id, data, mine }]
export function watchReviews(cb) {
  if (!SH.db) { cb([{ id: 'local', data: MYREV, mine: true }]); return () => {}; }
  return SH.db.collection('review').onSnapshot((q) => cb(q.docs.map((d) => ({ id: d.id, data: d.data(), mine: d.id === SH.uid }))), () => cb([{ id: SH.uid || 'local', data: MYREV, mine: true }]));
}
// comptes rendus de session (formateur)
export async function saveSessionReport(id, data) {
  const all = LS.get('sessions', []); all.push({ id, ...data }); LS.set('sessions', all.slice(-30));
  if (!SH.db) return { ok: true, local: true };
  try { await SH.db.doc('sessions/' + id).set(JSON.parse(JSON.stringify(data))); return { ok: true }; }
  catch (e) { return { ok: false, code: e && e.code, message: e && e.message }; }
}
export function watchSessionReports(cb) {
  if (!SH.db) { cb(LS.get('sessions', []).map((d) => ({ id: d.id, data: d }))); return () => {}; }
  return SH.db.collection('sessions').onSnapshot((q) => cb(q.docs.map((d) => ({ id: d.id, data: d.data() }))), () => cb(null));
}

// ---------------- progression du stagiaire ----------------
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
/**
 * Remet une progression lue (ce navigateur, le serveur, un fichier importé) à la forme actuelle : copie,
 * champs absents ou mal formés remis à vide, numéro de version. Pure : ne touche pas à PROG. Une
 * progression écrite par une version plus récente garde son numéro et ses champs inconnus.
 * @returns {any} null si ce n'est pas une progression
 */
export function migrateProgress(d) {
  if (!isObj(d)) return null;
  const p = JSON.parse(JSON.stringify(d));
  const v = Number.isFinite(p.v) ? p.v : 1;
  // v1 → v2 : le numéro de version ; les réussites « seul » (clean) se déduisent de l'aide enregistrée (livret.js)
  for (const k of ['missions', 'visited', 'tutor', 'cours']) if (k in p && !isObj(p[k])) p[k] = {};
  for (const k of ['missions', 'visited']) if (!isObj(p[k])) p[k] = {};
  for (const k of ['scenarios', 'reports']) if (!Array.isArray(p[k])) p[k] = [];
  if ('rigs' in p && !Array.isArray(p.rigs)) p.rigs = [];
  p.patchBest = Number(p.patchBest) || 0;
  if ('net' in p) {
    if (!isObj(p.net)) p.net = {};
    if (!isObj(p.net.missions)) p.net.missions = {};
    for (const k of ['quiz', 'exams']) if (!Array.isArray(p.net[k])) p.net[k] = [];
  }
  p.v = Math.max(v, PROG_VERSION);
  return p;
}
/** fusionne une autre progression (document progress/<id> du serveur, fichier importé) avec celle de ce navigateur ; rien ne se perd */
export function mergeProgress(d) {
  d = migrateProgress(d);
  if (!d) return;
  PROG.v = Math.max(PROG.v || 1, d.v);
  PROG.missions = { ...(d.missions || {}), ...PROG.missions };
  PROG.visited = { ...(d.visited || {}), ...PROG.visited };
  const seen = new Set(PROG.scenarios.map((s) => s.at));
  for (const s of d.scenarios || []) if (!seen.has(s.at)) PROG.scenarios.push(s);
  const seenR = new Set(PROG.reports.map((r) => r.at));
  for (const r of d.reports || []) if (!seenR.has(r.at)) PROG.reports.push(r);
  PROG.perf = PROG.perf || d.perf || null;
  PROG.patchBest = Math.max(PROG.patchBest || 0, d.patchBest || 0);
  { const seenA = new Set((PROG.rigs || []).map((x) => x.at)); PROG.rigs = PROG.rigs || []; for (const x of d.rigs || []) if (!seenA.has(x.at)) PROG.rigs.push(x); }
  // parcours du chef de car : un parcours réussi ailleurs le reste ici
  // (réussi seul ici ou là-bas : ça reste acquis)
  if (d.tutor) {
    const T = PROG.tutor = PROG.tutor || {};
    for (const [id, p] of Object.entries(d.tutor)) {
      if (!p) continue;
      if (!T[id] || (p.done && !T[id].done)) T[id] = { ...p, clean: !!(p.clean || (T[id] && T[id].clean)) };
      else if (p.clean && T[id].done) T[id].clean = true;
    }
  }
  if (d.net) {
    const n = PROG.net = PROG.net || { missions: {}, quiz: [], exams: [] };
    n.missions = n.missions || {};
    for (const [id, r] of Object.entries(d.net.missions || {})) {
      const m = n.missions[id];
      if (!r) continue;
      if (!m) n.missions[id] = r; else { m.pts = Math.max(m.pts || 0, r.pts || 0); if (r.clean) m.clean = true; }
    }
    for (const k of ['quiz', 'exams']) { const seen = new Set((n[k] || []).map((x) => x.at)); n[k] = n[k] || []; for (const x of d.net[k] || []) if (!seen.has(x.at)) n[k].push(x); }
  }
  // meilleur score de chaque série : le meilleur des deux appareils
  const best = (a, b) => (!a ? b : !b ? a : b.score > a.score ? b : a);
  const bestOf = (mine, theirs) => { for (const [k, v] of Object.entries(theirs || {})) mine[k] = best(mine[k], v); return mine; };
  // Cours : leçon vue ici ou ailleurs, meilleur quiz
  if (d.cours) {
    const C = PROG.cours = PROG.cours || {};
    for (const [id, p] of Object.entries(d.cours)) { if (!p) continue; const m = C[id] || (C[id] = { seen: false, quiz: null }); m.seen = m.seen || !!p.seen; m.quiz = best(m.quiz, p.quiz); }
  }
  // progression du jeu (XP, badges) : une récompense obtenue sur l'un des appareils l'est pour de bon
  if (d.game) { const G = /** @type {any} */ (PROG); G.game = mergeGame(G.game, d.game); }
  // l'entrepôt : meilleur résultat de chaque mission, derniers essais, et le montage le plus récent
  if (d.entrepot) {
    const N = /** @type {any} */ (PROG).entrepot = /** @type {any} */ (PROG).entrepot || {};
    const M = N.missions = N.missions || {};
    for (const [id, r] of Object.entries(d.entrepot.missions || {})) {
      if (!r) continue; const m = M[id] = M[id] || { best: null, runs: [] }; m.runs = m.runs || [];
      const seenE = new Set(m.runs.map((x) => x.at)); for (const x of r.runs || []) if (!seenE.has(x.at)) m.runs.push(x);
      m.runs = m.runs.sort((a, b) => (a.at || 0) - (b.at || 0)).slice(-10);
      m.best = best(m.best, r.best);
    }
    if (d.entrepot.build && (!N.build || (d.entrepot.build.at || 0) > (N.build.at || 0))) N.build = d.entrepot.build;
  }
  // module caméra : notions, quiz de chapitre, mise en service (meilleur résultat et derniers essais)
  if (d.camera) {
    const K = /** @type {any} */ (PROG.camera = PROG.camera || {});
    K.notions = bestOf(K.notions || {}, d.camera.notions); K.quiz = bestOf(K.quiz || {}, d.camera.quiz);
    const m = K.mes = K.mes || { best: null, runs: [] }, r = d.camera.mes || {}; m.runs = m.runs || [];
    const seenM = new Set(m.runs.map((x) => x.at)); for (const x of r.runs || []) if (!seenM.has(x.at)) m.runs.push(x);
    m.runs = m.runs.sort((a, b) => (a.at || 0) - (b.at || 0)).slice(-10);
    if (r.best && (!m.best || r.best.score > m.best.score || (r.best.score === m.best.score && r.best.sec < m.best.sec))) m.best = r.best;
  }
}
function restoreProgress() {
  Object.assign(S.missionsDone, PROG.missions);
  Object.assign(S.visited, PROG.visited);
}
/** @type {ReturnType<typeof setTimeout> | undefined} */ let saveT;
let saving = false, again = false;
export function saveProgressSoon() { clearTimeout(saveT); saveT = setTimeout(saveProgress, 2500); }
/** l'état d'un enregistrement ; prévient l'interface (« progressSave ») quand il change (ui/ma_progression.js) */
function noteSave(/** @type {'local' | 'remote'} */ where, /** @type {boolean} */ ok, /** @type {any} */ err) {
  const before = SAVE[where];
  SAVE[where] = ok; if (ok) SAVE.at = Date.now(); else SAVE.error = String((err && (err.message || err.code)) || err || '').slice(0, 200);
  if (before !== ok) emit('progressSave', { where, ok, error: SAVE.error });
}
async function saveProgress() {
  if (saving) { again = true; return; }
  PROG.missions = { ...S.missionsDone }; PROG.visited = { ...S.visited }; PROG.updatedAt = Date.now(); PROG.v = Math.max(PROG.v || 1, PROG_VERSION);
  PROG.scenarios = PROG.scenarios.slice(-20); PROG.reports = PROG.reports.slice(-50); if (PROG.rigs) PROG.rigs = PROG.rigs.slice(-20);
  // stockage du navigateur plein (photos du formateur, autres pages) ou désactivé : on le dit, la progression reste en mémoire
  noteSave('local', LS.set('progress', PROG), 'stockage du navigateur plein ou désactivé');
  if (!SH.db || !SH.uid || SH.readOnly) return;
  saving = true;
  try {
    // fusion avant écriture : ce qu'un autre appareil a enregistré entre-temps sur le serveur n'est pas écrasé
    try {
      const snap = await SH.db.doc('progress/' + SH.uid).get();
      if (snap.exists) { mergeProgress(snap.data()); restoreProgress(); LS.set('progress', PROG); }
    } catch (e) { /* lecture impossible : on écrit ce qu'on a */ }
    await SH.db.doc('progress/' + SH.uid).set(JSON.parse(JSON.stringify(PROG)));
    noteSave('remote', true);
  } catch (e) {
    // invalid_argument : la page n'accepte pas d'écriture (lecture seule) ; on garde la copie de ce navigateur sans insister
    if (e && e.code === 'invalid_argument') SH.readOnly = true; else noteSave('remote', false, e);
  }
  saving = false;
  if (again) { again = false; saveProgressSoon(); }
}
/** enregistre tout de suite (après un import, avant de quitter) */
export function saveProgressNow() { clearTimeout(saveT); return saveProgress(); }

// ---------------- exporter, importer, effacer ----------------
export const EXPORT_FORMAT = 'tiee-simulator/progression';
/** la progression de ce navigateur dans un fichier JSON (à garder, à changer d'ordinateur, à remettre au formateur) */
export function exportProgress(app = '') {
  PROG.missions = { ...S.missionsDone }; PROG.visited = { ...S.visited };
  return JSON.stringify({ format: EXPORT_FORMAT, v: PROG_VERSION, app, exportedAt: new Date().toISOString(), progression: PROG });
}
/** taille maximale d'un fichier importé (une progression pèse quelques dizaines de kilo-octets) */
export const IMPORT_MAX = 5 * 1024 * 1024;
/**
 * Lit un fichier exporté (ou une progression brute) et le fusionne avec la progression de ce navigateur :
 * rien n'est effacé, chaque réussite des deux côtés est gardée, le meilleur score aussi.
 * @param {string} text
 * @returns {{ ok: boolean, error?: string, from?: string, at?: string }}
 */
export function importProgress(text) {
  if (typeof text !== 'string' || !text.trim()) return { ok: false, error: 'Le fichier est vide.' };
  if (text.length > IMPORT_MAX) return { ok: false, error: 'Le fichier est trop gros pour une progression (5 Mo au plus).' };
  let d;
  try { d = JSON.parse(text); } catch (e) { return { ok: false, error: 'Ce n\'est pas un fichier de progression (JSON illisible).' }; }
  const wrapped = isObj(d) && d.format === EXPORT_FORMAT;
  const p = wrapped ? d.progression : d;
  // une progression brute a au moins l'un de ses champs habituels
  if (!isObj(p) || (!wrapped && !['missions', 'visited', 'cours', 'tutor', 'game', 'camera', 'net'].some((k) => k in p))) return { ok: false, error: 'Ce fichier ne contient pas de progression du TIEE Simulator.' };
  mergeProgress(p);
  restoreProgress();
  saveProgressSoon();
  emit('progressImport');
  return { ok: true, from: wrapped ? String(d.app || '') : '', at: wrapped ? String(d.exportedAt || '') : '' };
}
/** efface la progression : ce navigateur et, sur la page publiée, sa copie sur le serveur. La page se recharge ensuite. */
export async function eraseProgress() {
  clearTimeout(saveT);
  const empty = { v: PROG_VERSION, missions: {}, visited: {}, scenarios: [], reports: [], perf: null, patchBest: 0, updatedAt: Date.now() };
  for (const k of Object.keys(PROG)) delete /** @type {any} */ (PROG)[k];
  Object.assign(PROG, empty);
  for (const k of Object.keys(S.missionsDone)) delete S.missionsDone[k];
  for (const k of Object.keys(S.visited)) delete S.visited[k];
  try { localStorage.removeItem('carregie.progress'); } catch (e) { /* stockage indisponible */ }
  if (SH.db && SH.uid && !SH.readOnly) {
    try { await SH.db.doc('progress/' + SH.uid).set(JSON.parse(JSON.stringify(PROG))); } catch (e) { return { ok: false, error: 'La copie du serveur n\'a pas pu être effacée : demandez-le au formateur.' }; }
  }
  return { ok: true };
}
export function addReport(where, text) {
  PROG.reports.push({ at: Date.now(), where: String(where).slice(0, 120), text: String(text).slice(0, 1000) });
  saveProgressSoon();
}
export function addScenarioResult(r) { PROG.scenarios.push({ at: Date.now(), ...r }); saveProgressSoon(); }
export function setPerf(p) { PROG.perf = { ...p, at: Date.now() }; saveProgressSoon(); }
on('mission', saveProgressSoon);
on('station', saveProgressSoon);
on('patchDone', () => { PROG.patchBest = 100; saveProgressSoon(); });
// atelier de montage : temps, erreurs et points repris
on('atelier', (e) => {
  if (e.type !== 'done' || !e.report) return;
  const r = e.report; (PROG.rigs = PROG.rigs || []).push({ at: Date.now(), sec: Math.round(r.sec), errs: r.errs, grade: r.grade, errors: r.errors.map((x) => String(x.label).slice(0, 80)) });
  saveProgressSoon();
});

// ---------------- tableau de bord formateur ----------------
export function watchAllProgress(cb) {
  if (!SH.db) { cb([{ id: 'local', data: PROG, local: true }]); return () => {}; }
  return SH.db.collection('progress').onSnapshot((q) => cb(q.docs.map((d) => ({ id: d.id, data: d.data() }))), () => cb(null));
}
export async function profilesOf(ids) {
  if (!SH.user || !ids.length) return {};
  try { return await SH.user.profiles(ids); } catch (e) { return {}; }
}

// ---------------- photos du matériel ----------------
export async function uploadPhoto(file) {
  if (SH.assets) {
    const r = await SH.assets.upload(file);
    return { asset: r.id, url: r.url };
  }
  // repli local : image redimensionnée en data URL (reste dans ce navigateur)
  const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
  const small = await shrink(url, 1400);
  return { asset: null, url: small };
}
function shrink(src, max) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.82)); };
    img.onerror = () => res(src);
    img.src = src;
  });
}
export function photoUrl(p) { return p.asset ? '/_blob/' + p.asset : p.url; }

// ---------------- téléchargements ----------------
export async function offerDownload(filename, data) {
  if (SH.downloads) {
    try { await SH.downloads.save({ filename, data }); return 'saved'; } catch (e) { return e && e.code === 'declined' ? 'declined' : 'error'; }
  }
  try {
    const blob = data instanceof Blob ? data : new Blob([data], { type: filename.endsWith('.csv') ? 'text/csv' : filename.endsWith('.html') ? 'text/html' : 'text/plain' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return 'saved';
  } catch (e) { return 'error'; }
}
