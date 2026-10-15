import { S, emit, on } from './state.js';
import { EQUIP } from './equip.js';
import { setSoundPlan } from './audio.js';

// ----------------------------------------------------------------------------------
// Données partagées de la page publiée (capacités db / user / assets / downloads),
// avec repli sur le stockage du navigateur quand elles ne sont pas disponibles.
//   config/car      : nom du car, matériel, check-list et procédures maison (écrit par le formateur)
//   config/cabling  : liste de câblage importée
//   config/photos   : photos du matériel et leurs points cliquables
//   config/review   : relecture technique (statut et remarque par point)
//   progress/<id>   : progression d'un stagiaire (missions, scénarios, signalements, perf)
// ----------------------------------------------------------------------------------
export const SH = { db: null, user: null, assets: null, downloads: null, uid: null, isOwner: false, canEdit: false, canWrite: null, ready: false, readOnly: false };
export const CFG = { car: {}, cabling: null, photos: { list: [] }, review: { items: {} } };
export const PROG = { missions: {}, visited: {}, scenarios: [], reports: [], perf: null, patchBest: 0, updatedAt: 0 };

const LS = {
  get(k, d) { try { const v = localStorage.getItem('carregie.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('carregie.' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
};
const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r(null), ms))]);

export async function initShared() {
  // valeurs locales d'abord (fonctionne hors de claude.ai)
  for (const k of ['car', 'cabling', 'photos', 'review']) { const v = LS.get('config.' + k, null); if (v) CFG[k] = v; }
  Object.assign(PROG, LS.get('progress', {}));
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
}
export function canConfigure() { return !SH.db || SH.canEdit || SH.isOwner; }
export async function saveConfig(part, data) {
  CFG[part] = data; LS.set('config.' + part, data); applyConfig(); emit('config', part);
  if (!SH.db) return { ok: true, local: true };
  try { await SH.db.doc('config/' + part).set(JSON.parse(JSON.stringify(data))); return { ok: true }; }
  catch (e) { return { ok: false, code: e && e.code, message: e && e.message }; }
}

// ---------------- progression du stagiaire ----------------
function mergeProgress(d) {
  if (!d) return;
  PROG.missions = { ...(d.missions || {}), ...PROG.missions };
  PROG.visited = { ...(d.visited || {}), ...PROG.visited };
  const seen = new Set(PROG.scenarios.map((s) => s.at));
  for (const s of d.scenarios || []) if (!seen.has(s.at)) PROG.scenarios.push(s);
  const seenR = new Set(PROG.reports.map((r) => r.at));
  for (const r of d.reports || []) if (!seenR.has(r.at)) PROG.reports.push(r);
  PROG.perf = PROG.perf || d.perf || null;
  PROG.patchBest = Math.max(PROG.patchBest || 0, d.patchBest || 0);
}
function restoreProgress() {
  Object.assign(S.missionsDone, PROG.missions);
  Object.assign(S.visited, PROG.visited);
}
let saveT = 0, saving = false, again = false;
export function saveProgressSoon() { clearTimeout(saveT); saveT = setTimeout(saveProgress, 2500); }
async function saveProgress() {
  if (saving) { again = true; return; }
  PROG.missions = { ...S.missionsDone }; PROG.visited = { ...S.visited }; PROG.updatedAt = Date.now();
  PROG.scenarios = PROG.scenarios.slice(-20); PROG.reports = PROG.reports.slice(-50);
  LS.set('progress', PROG);
  if (!SH.db || !SH.uid || SH.readOnly) return;
  saving = true;
  try { await SH.db.doc('progress/' + SH.uid).set(JSON.parse(JSON.stringify(PROG))); }
  catch (e) { if (e && e.code === 'invalid_argument') SH.readOnly = true; }
  saving = false;
  if (again) { again = false; saveProgressSoon(); }
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
