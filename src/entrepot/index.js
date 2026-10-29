// @ts-check
import * as THREE from 'three';
import { el } from '../util.js';
import { on, emit } from '../state.js';
import { toast, ask } from '../ui/common.js';
import { makeOrbit } from './orbit.js';
import { buildHall, PC_UID } from './scene.js';
import { B, vider, charger, montageEnregistre, setSaving, appareil, sortir, relier, regler, poser, allumer, ranger } from './build.js';
import { evaluate } from './engine.js';
import { CATALOGUE } from './catalogue/index.js';
import { MISSIONS, missionById, noter } from './missions.js';
import { renderStock } from './ui/stock.js';
import { renderAppareil, PENDING } from './ui/appareil.js';
import { renderSynoptique } from './ui/synoptique.js';
import { renderReseau } from './ui/reseau.js';
import { renderMission } from './ui/mission.js';
import { PROG, saveProgressSoon } from '../shared.js';
import { recevoir, nonLus, boite, enCours } from '../carriere/index.js';
import { episodeById } from '../carriere/mails.js';
import { renderMessagerie, MSG, societe } from '../carriere/ui.js';

// ----------------------------------------------------------------------------------
// Module « L'entrepôt » : un mode à part, ouvert depuis l'écran Jouer (lieu « L'entrepôt »). On y
// monte une régie mobile de A à Z : sortir le matériel du stock, le poser dans la baie, sur la
// table ou sur le plateau, le câbler, le configurer (adresses IP, formats, menus), jusqu'à ce que
// le cahier des charges soit rempli. Son propre rendu 3D (un second contexte WebGL, construit à la
// première ouverture) ; la boucle du simulateur est en pause tant qu'il est ouvert.
//
// Les panneaux : le stock (rayons du catalogue), l'appareil choisi (faces, connecteurs, câblage,
// configuration), le synoptique (tout le câblage en 2D), le réseau (adresses, qui joint qui, ping),
// la mission (le cahier des charges et la note). Tous lisent B (build.js) et E (engine.js).
// En mode Carrière (src/carriere/), on arrive au bureau du planning : son ordinateur (un clic, ou
// le bouton Messagerie) ouvre les mails qui proposent les missions ; une mission de l'entrepôt
// se monte ici, une mission au car régie ferme l'entrepôt et lance le car (événement « carriere »).
// ----------------------------------------------------------------------------------
export const EP = { open: false, built: false, lesson: '', carriere: false };
/** @type {any} */
let R = null;
let titleWasOpen = false, raf = 0, last = 0;

export const entrepotOpen = () => EP.open;
/** l'événement « entrepot » ouvre le module : { mission: 'conference' | '', lesson : la leçon du Cours où revenir en sortant, carriere : le bureau et ses mails } */
export function initEntrepot() {
  on('entrepot', (o) => { if (o && o.type) return; openEntrepot(o || {}); });
  // un mail arrivé (mission réussie) : l'écran du bureau, la pastille et le panneau suivent
  on('carriere', (e) => { if (e && e.type === 'courrier' && EP.open && R) { syncPc(); refreshPins(); refreshPanel(); } });
}

const quality = () => { try { return localStorage.getItem('carregie.quality') || 'moyenne'; } catch (e) { return 'moyenne'; } };

/** le résultat du moteur, recalculé quand le montage change (B.ver) */
let evalVer = -1, evalRes = /** @type {import('./types.js').Eval | null} */ (null);
export function evalCourant() { if (evalVer !== B.ver || !evalRes) { evalRes = evaluate(B); evalRes.ver = B.ver; evalVer = B.ver; } return evalRes; }

async function build() {
  const q = quality();
  const root = el('div', { id: 'entrepot', class: 'entrepot', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'L\'entrepôt', hidden: true });
  const canvas = el('canvas', { class: 'ep-gl', 'aria-label': 'L\'entrepôt en 3D : glisser pour tourner, molette pour approcher, clic sur un appareil pour l\'ouvrir' });
  const pins = el('div', { class: 'ep-pins' });
  const side = el('aside', { class: 'ep-side', hidden: true, 'aria-label': 'Panneau' });
  const btn = (label, title, onclick, cls = '') => el('button', { type: 'button', class: 'btn small ' + cls, title, onclick }, label);
  const bStock = btn('Stock', 'Les rayons : sortir du matériel', () => panel('stock', true), 'ep-b-stock');
  const bSyno = btn('Synoptique', 'Tout le câblage, en 2D', () => panel('synoptique', true), 'ep-b-syno');
  const bNet = btn('Réseau', 'Les adresses IP, qui joint qui, le ping', () => panel('reseau', true), 'ep-b-reseau');
  const bMission = btn('Cahier des charges', 'Ce que demande le client, et la note', () => panel('mission', true), 'ep-b-mission');
  // Carrière : la messagerie de l'ordinateur du bureau, avec le nombre de mails non lus
  const bMail = btn('Messagerie', 'L\'ordinateur du bureau : tes mails et tes missions', () => { MSG.sel = ''; panel('messagerie', true); }, 'ep-b-messagerie');
  bMail.append(el('span', { class: 'ep-badge', hidden: true }));
  const bQuit = btn('Quitter', 'Revenir à l\'écran Jouer (Échap)', () => closeEntrepot(), 'ep-quit');
  bQuit.append(' ', el('kbd', {}, 'Échap'));
  const zones = el('div', { class: 'ep-zones', role: 'toolbar', 'aria-label': 'Aller à' },
    ...[['bureau', 'Bureau'], ['rack', 'Baie'], ['table', 'Table'], ['plateau', 'Plateau'], ['mur', 'Mur']].map(([z, l]) => el('button', { type: 'button', class: 'linkbtn', 'data-zone': z, onclick: () => goZone(z) }, l)));
  const bar = el('header', { class: 'ep-bar' },
    el('div', { class: 'ep-id' }, el('span', { class: 'tape y' }, 'L\'entrepôt'), el('small', { class: 'ep-mission-name' }, '')),
    el('div', { class: 'ep-views', role: 'toolbar', 'aria-label': 'Panneaux' }, bMail, bStock, bSyno, bNet, bMission),
    zones, bQuit);
  const hint = el('p', { class: 'ep-hint-bar' }, 'Glisser pour tourner · molette ou pincer pour approcher · clic droit ou Maj pour déplacer · un appareil s\'ouvre d\'un clic');
  const loading = el('p', { class: 'ep-loading' }, 'Ouverture de l\'entrepôt…');
  root.append(canvas, pins, bar, side, hint, loading);
  document.body.append(root);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q === 'haute' ? 2 : q === 'basse' ? 1 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = q !== 'basse'; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 60);
  const hall = buildHall(renderer, q);
  const orbit = makeOrbit(camera, canvas, { min: 0.4, max: 16 });
  R = { root, canvas, pins, side, bar, renderer, camera, hall, orbit, ray: new THREE.Raycaster(), panel: '', dev: '', pinEls: new Map(), syncVer: -1, escT: 0, loading };
  orbit.onTap = (e) => {
    const r = canvas.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    R.ray.setFromCamera(v, camera);
    const uid = hall.pick(R.ray);
    if (uid === PC_UID) { if (EP.carriere) { MSG.sel = ''; panel('messagerie'); } else toast('L\'ordinateur du planning : ses mails se lisent en mode Carrière (Jouer, L\'entrepôt).', '', 4000); return; }
    if (uid) openAppareil(uid);
  };
  window.addEventListener('keydown', onKey);
  const look = hall.lookAt('table'); orbit.target.copy(look.target); orbit.sph.setFromVector3(look.dir.clone().normalize().multiplyScalar(look.dist)); orbit.apply();
  window.addEventListener('resize', resize);
  EP.built = true; loading.remove();
}
function resize() {
  if (!R) return;
  const w = R.canvas.clientWidth || 1, h = R.canvas.clientHeight || 1;
  R.renderer.setSize(w, h, false); R.camera.aspect = w / h; R.camera.updateProjectionMatrix();
}
function onKey(/** @type {KeyboardEvent} */ e) {
  if (!EP.open) return;
  if (e.key === 'Escape') {
    const t = /** @type {HTMLElement | null} */ (e.target);
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) { t.blur(); return; }
    // un câble en main : Échap le lâche d'abord
    if (PENDING.a) { PENDING.a = null; refreshPanel(); toast('Câble lâché.', '', 1800); return; }
    if (R.panel) { panel(''); return; }
    closeEntrepot();
  }
}
function loop(now) {
  if (!EP.open) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016); last = now;
  R.orbit.update(dt); R.hall.update(dt);
  if (R.syncVer !== B.ver) { R.hall.sync(B, evalCourant()); R.syncVer = B.ver; refreshPins(); refreshPanel(); }
  R.renderer.render(R.hall.scene, R.camera);
  placePins();
}

// ---------------- pastilles : un bouton par appareil, qui suit l'objet 3D ----------------
function refreshPins() {
  R.pins.replaceChildren(); R.pinEls.clear();
  if (EP.carriere) {
    const n = nonLus(PROG);
    const b = el('button', { type: 'button', class: 'ep-pin pc' + (n ? ' new' : ''), 'data-uid': PC_UID, onclick: () => { MSG.sel = ''; panel('messagerie'); } },
      el('i', { 'aria-hidden': 'true' }), el('span', { 'aria-hidden': 'true' }, n ? `Messagerie · ${n}` : 'Messagerie'), el('b', { class: 'sr' }, `L'ordinateur du bureau : la messagerie${n ? `, ${n} mail${n > 1 ? 's' : ''} non lu${n > 1 ? 's' : ''}` : ''}`));
    R.pins.append(b); R.pinEls.set(PC_UID, b);
  }
  for (const a of B.appareils) {
    if (a.place.zone === 'mur') continue;
    const m = CATALOGUE[a.modele]; const E = evalCourant();
    const alert = E.alertes.some((x) => x.dev === a.uid && x.level === 'erreur');
    const b = el('button', { type: 'button', class: 'ep-pin' + (alert ? ' ko' : ''), 'data-uid': a.uid, onclick: () => openAppareil(a.uid) },
      el('i', { 'aria-hidden': 'true' }), el('span', { 'aria-hidden': 'true' }, a.nom), el('b', { class: 'sr' }, `${a.nom} (${m ? m.nom : a.modele})${alert ? ', en défaut' : ''}`));
    R.pins.append(b); R.pinEls.set(a.uid, b);
  }
}
function placePins() {
  const r = R.canvas.getBoundingClientRect(); const v = new THREE.Vector3();
  /** @type {Array<{ b: HTMLElement, x: number, y: number }>} */ const vus = [];
  for (const [uid, b] of R.pinEls) {
    const p = uid === PC_UID ? R.hall.pcAnchor() : R.hall.anchor(uid); if (!p) { b.hidden = true; continue; }
    v.copy(p).project(R.camera);
    const behind = v.z > 1; b.hidden = behind;
    if (!behind) vus.push({ b, x: ((v.x + 1) / 2) * r.width, y: ((1 - v.y) / 2) * r.height });
    b.classList.toggle('cur', uid === R.dev);
  }
  // les étiquettes proches (les appareils de la baie, 4,4 cm l'un au-dessus de l'autre) s'écartent vers le bas
  vus.sort((p, q) => p.y - q.y);
  for (let i = 0; i < vus.length; i++) {
    for (let j = 0; j < i; j++) if (Math.abs(vus[i].x - vus[j].x) < 120 && vus[i].y - vus[j].y < 21) vus[i].y = vus[j].y + 21;
    vus[i].b.style.transform = `translate(${vus[i].x}px, ${vus[i].y}px)`;
  }
}
// un écran étroit (moins de 900 px : styles/entrepot.css) a le panneau en bas, et ses propres points de vue
const etroit = () => window.innerWidth < 900;
function goZone(zone) { const l = R.hall.lookAt(zone, { etroit: etroit() }); R.orbit.flyTo(l.target, l.dir, l.dist); }

// ---------------- panneaux ----------------
/** ouvre un panneau ('' le referme) ; toggle : un second appui sur le même bouton de la barre le referme */
export function panel(name, toggle = false) {
  if (!R) return;
  R.panel = toggle && name === R.panel && name !== 'appareil' ? '' : name;
  if (R.panel !== 'appareil') R.dev = '';
  R.side.hidden = !R.panel; R.root.classList.toggle('side-open', !!R.panel); R.root.classList.toggle('side-wide', R.panel === 'synoptique');
  for (const b of R.bar.querySelectorAll('.ep-views .btn')) b.classList.toggle('on', b.classList.contains('ep-b-' + (R.panel === 'synoptique' ? 'syno' : R.panel)));
  if (R.panel === 'messagerie') goZone('bureau');
  refreshPanel();
}
export function openAppareil(uid) {
  if (!appareil(uid)) return;
  // la vue ne vole vers l'appareil que quand on en change (un réglage redessine le panneau sans bouger la caméra)
  const autre = R.dev !== uid || R.panel !== 'appareil';
  R.dev = uid; R.panel = 'appareil'; R.side.hidden = false; R.root.classList.add('side-open'); R.root.classList.remove('side-wide');
  for (const b of R.bar.querySelectorAll('.ep-views .btn')) b.classList.remove('on');
  refreshPanel();
  const a = appareil(uid); if (a && autre) goZone(a.place.zone);
}
function refreshPanel() {
  if (!R) return;
  R.bar.querySelector('.ep-mission-name').textContent = barLabel();
  syncBar();
  if (!R.panel) return;
  const E = evalCourant();
  const ctx = { B, E, open: openAppareil, panel, close: () => panel(''), say: (/** @type {string} */ t) => toast(t, '', 3500), lecon: EP.lesson, quitter: () => closeEntrepot() };
  const body = R.panel === 'stock' ? renderStock(ctx)
    : R.panel === 'appareil' ? (appareil(R.dev) ? renderAppareil(R.dev, ctx) : (R.panel = '', null))
      : R.panel === 'synoptique' ? renderSynoptique(ctx)
        : R.panel === 'reseau' ? renderReseau(ctx)
          : R.panel === 'mission' ? renderMission(missionById(B.mission), ctx)
            : R.panel === 'messagerie' && EP.carriere ? renderMessagerie({ lancer: lancerEpisode, refresh: () => { syncPc(); refreshPins(); refreshPanel(); } }) : null;
  if (!body) { R.side.hidden = true; R.root.classList.remove('side-open'); return; }
  const titles = { stock: 'Le stock', appareil: appareil(R.dev) ? appareil(R.dev).nom : 'Appareil', synoptique: 'Synoptique', reseau: 'Le réseau', mission: 'Le cahier des charges', messagerie: 'Messagerie' };
  // le panneau est redessiné à chaque changement du montage : on garde sa position de lecture
  // (même panneau, même appareil, même mail) et le contrôle qui avait le focus (data-k)
  const vue = `${R.panel}:${R.dev}:${R.panel === 'messagerie' ? MSG.sel : ''}`; const old = R.side.querySelector('.ep-sbody');
  const scroll = old && R.sideVue === vue ? old.scrollTop : 0;
  const act = /** @type {HTMLElement | null} */ (document.activeElement); const k = act && R.side.contains(act) ? act.getAttribute('data-k') : null;
  const sbody = el('div', { class: 'ep-sbody' }, body);
  R.side.replaceChildren(el('header', { class: 'ep-sh' }, el('h2', {}, titles[R.panel] || ''), el('button', { type: 'button', class: 'linkbtn', onclick: () => panel('') }, 'Fermer')), sbody);
  sbody.scrollTop = scroll; R.sideVue = vue;
  if (k) { const n = /** @type {HTMLElement | null} */ (R.side.querySelector(`[data-k="${CSS.escape(k)}"]`)); if (n) n.focus({ preventScroll: true }); }
  if (R.hall.select) R.hall.select(R.panel === 'appareil' ? R.dev : '');
}

// ---------------- la Carrière : le bureau, ses mails, les missions qu'ils proposent ----------------
/** la ligne sous « L'entrepôt » : la mission, le bac à sable, ou la Carrière */
function barLabel() {
  const M = missionById(B.mission);
  if (EP.carriere) { const ep = enCours(PROG); return `Carrière · ${M ? M.titre : ep ? ep.mission.titre : 'lis tes mails au bureau'}`; }
  return M ? M.titre : 'Bac à sable : monte ce que tu veux';
}
/** la touche Messagerie et la zone Bureau n'existent qu'en Carrière ; le nombre de mails non lus */
function syncBar() {
  const n = EP.carriere ? nonLus(PROG) : 0;
  const bm = /** @type {HTMLElement} */ (R.bar.querySelector('.ep-b-messagerie')); bm.hidden = !EP.carriere;
  const badge = /** @type {HTMLElement} */ (bm.querySelector('.ep-badge')); badge.hidden = !n; badge.textContent = String(n);
  bm.setAttribute('aria-label', n ? `Messagerie, ${n} non lu${n > 1 ? 's' : ''}` : 'Messagerie');
  const bz = /** @type {HTMLElement} */ (R.bar.querySelector('[data-zone="bureau"]')); bz.hidden = !EP.carriere;
}
/** l'écran de l'ordinateur du bureau */
function syncPc() {
  if (!R) return;
  R.hall.ecranPc({ actif: EP.carriere, societe: societe(), nonLus: EP.carriere ? nonLus(PROG) : 0, lignes: EP.carriere ? boite(PROG, { societe: societe() }).map((m) => ({ de: m.de.nom, objet: m.objet, lu: m.lu })) : [] });
}
/** le bouton de l'ordre de mission : monter la régie ici, ou partir au car régie */
async function lancerEpisode(/** @type {string} */ id) {
  const ep = episodeById(id); if (!ep) return;
  const a = ep.mission.action;
  if (a.type === 'visite') { closeEntrepot(); emit('carriere', { type: 'visite', id }); return; }
  // une mission de l'entrepôt : on reprend le montage déjà commencé, sinon le stock est rangé
  if (B.mission !== a.mission) {
    const saved = montageEnregistre();
    if (saved && saved.mission === a.mission) charger(saved);
    else {
      const perdu = B.appareils.some((x) => x.modele !== 'mur') || !!saved;
      if (perdu && !(await ask('Commencer cette mission remet tout le matériel au stock : ton montage enregistré (« Reprendre le montage » dans Jouer) sera remplacé. Continuer ?', { title: ep.mission.titre, ok: 'Commencer la mission' }))) return;
      vider(a.mission);
    }
  }
  panel('mission'); goZone('table');
  toast(`Mission : ${ep.mission.titre}. Le cahier des charges est ouvert ; rends le montage quand tout marche.`, '', 5000);
}

// ---------------- ouverture et fermeture ----------------
/** @param {{ mission?: string, reprendre?: boolean, lesson?: string, carriere?: boolean }} o */
export async function openEntrepot(o = {}) {
  if (EP.open) return;
  EP.open = true; EP.lesson = o.lesson || ''; EP.carriere = !!o.carriere;
  const title = document.getElementById('title');
  titleWasOpen = !!title && !title.hidden; if (title) title.hidden = true;
  if (!EP.built) { try { await build(); } catch (e) { EP.open = false; if (title && titleWasOpen) title.hidden = false; throw e; } }
  const saved = montageEnregistre();
  if (EP.carriere) {
    // la Carrière : les mails arrivés depuis la dernière fois ; le montage de la mission en cours, s'il est commencé
    if (recevoir(PROG).length) saveProgressSoon();
    const ep = enCours(PROG); const a = ep ? ep.mission.action : null;
    // sinon le hall est vide, sans toucher au montage enregistré (« Reprendre le montage » de Jouer)
    if (a && a.type === 'entrepot' && saved && saved.mission === a.mission) charger(saved); else { setSaving(false); vider(''); setSaving(true); }
    MSG.sel = '';
  } else if (o.reprendre && saved) charger(saved); else vider(o.mission || '');
  const m = missionById(B.mission);
  R.bar.querySelector('.ep-mission-name').textContent = barLabel();
  R.root.hidden = false; document.body.classList.add('entrepot-on');
  resize(); last = 0; R.syncVer = -1; raf = requestAnimationFrame(loop);
  syncPc();
  if (EP.carriere) { const l = R.hall.lookAt('bureau', { etroit: etroit() }); R.orbit.target.copy(l.target); R.orbit.sph.setFromVector3(l.dir.clone().normalize().multiplyScalar(l.dist)); R.orbit.apply(); }
  panel(EP.carriere ? 'messagerie' : m ? 'mission' : 'stock');
  const first = /** @type {HTMLElement | null} */ (R.bar.querySelector('button')); if (first) first.focus({ preventScroll: true });
  emit('entrepot', { type: 'open', mission: B.mission, carriere: EP.carriere });
}
export function closeEntrepot() {
  if (!EP.open) return;
  EP.open = false; EP.carriere = false; cancelAnimationFrame(raf); PENDING.a = null;
  if (R) { R.root.hidden = true; R.panel = ''; R.side.hidden = true; }
  document.body.classList.remove('entrepot-on');
  const title = document.getElementById('title');
  if (title && titleWasOpen) { title.hidden = false; const b = document.getElementById('ti-play'); if (b) b.focus({ preventScroll: true }); }
  emit('entrepot', { type: 'close' });
  // venu d'une leçon du Cours (exercice x-entrepot) : on y revient
  const lesson = EP.lesson; EP.lesson = '';
  if (lesson) emit('cours', { lesson });
}
/** la note de la mission en cours (null en bac à sable) */
export function noteCourante() { const m = missionById(B.mission); return m ? noter(m, B, evalCourant(), CATALOGUE) : null; }
/** accès de débogage et de test */
export const entrepotDebug = () => ({ R, B, E: evalCourant(), CATALOGUE, MISSIONS, note: noteCourante, panel, openAppareil, act: { sortir, relier, regler, poser, allumer, ranger, vider } });
