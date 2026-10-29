// @ts-check
import { S, on, emit } from '../state.js';
import { el, clamp } from '../util.js';
import { AT, atelierInput, atelierWheel } from '../atelier.js';
import { $, toast, modal, openInfo, askOpen, closeAsk } from '../ui/common.js';
import { closeStation, stationKey } from '../ui/stations.js';
import { termOpen, closeTerm } from '../ui/term.js';
import { openPlan, closePlan, planPointer, planWheel } from '../ui/plan.js';
import { openCommandes } from '../ui/guide.js';
import { layerOpen, closeLayer } from '../ui/layer.js';
import { openSynoptics } from '../ui/synoptics.js';
import { commutKey } from '../ui/commut.js';
import { openDevice, openEquipmentIndex } from '../equipment/viewer.js';
import { PL, KEYS, joy, onDeck, updToolbar } from './player.js';
import { CAMOP, releaseCamera } from './camop.js';
import { AIM, act } from './interact.js';
import { telOpen, telKey, toggleTelephone } from '../telephone/index.js';
import { titleOpen, titleKey } from './title.js';
import { camlabOpen } from '../camlab/index.js';
import { entrepotOpen } from '../entrepot/index.js';
import { vues3dOpen } from '../vues3d/index.js';

// ----------------------------------------------------------------------------------
// Entrées : clavier, souris (regard verrouillé ou glissé), molette, écran tactile.
// ----------------------------------------------------------------------------------
const isTyping = (e) => e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName) && e.target.type !== 'range' && e.target.type !== 'checkbox';

function onKeyDown(e) {
  // module « La caméra », vues 3D du Cours, entrepôt : ils ont leurs propres touches
  if (camlabOpen() || entrepotOpen() || vues3dOpen()) return;
  // confirmation dans la page : Échap = annuler, Entrée = bouton qui a le focus ; rien d'autre
  if (askOpen()) { if (e.code === 'Escape') { closeAsk(false); e.preventDefault(); } return; }
  // fenêtre explicative « ? » : Échap la ferme (sans fermer le poste) ; les autres touches ne pilotent rien
  if (termOpen()) { if (e.code === 'Escape') { closeTerm(); e.preventDefault(); } return; }
  // le téléphone levé : ses touches (Échap, Tab, flèches) ; un raccourci le range et suit son chemin
  if (telOpen() && telKey(e)) return;
  if (modal.isOpen) { if (e.code === 'Escape') modal.close(); return; }
  // le Cours (plein écran, par-dessus l'écran titre aussi) : Échap le referme
  if (layerOpen()) { if (e.code === 'Escape') { closeLayer(); e.preventDefault(); } return; }
  // écran titre : seulement la navigation dans son menu
  if (titleOpen()) { titleKey(e); return; }
  const typing = isTyping(e);
  // J : le chef de car, depuis n'importe où, feuille de service comprise
  if (e.code === 'KeyJ' && !typing && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey) { emit('chef'); e.preventDefault(); return; }
  if (S.mode === 'start') return;
  if (typing && e.code !== 'Escape') return;
  KEYS[e.code] = true;
  if (S.mode === 'station') {
    if (e.code === 'Escape') { closeStation(); e.preventDefault(); return; }
    if (stationKey(e)) { e.preventDefault(); return; }
    if (e.code === 'Tab' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); toggleTelephone(); return; }
    if (e.code === 'KeyL' && !e.ctrlKey && !e.metaKey && !e.altKey) { emit('journal'); return; }
    // G : le Cours sur la fiche du poste, si le poste ne se sert pas de la touche
    if (e.code === 'KeyG' && !e.ctrlKey && !e.metaKey && !e.altKey) emit('cours', { poste: S.station });
    return;
  }
  if (S.mode === 'plan') { if (e.code === 'Escape' || e.code === 'KeyP') closePlan(); return; }
  if (S.mode === 'camop') {
    if (e.code === 'KeyE' || e.code === 'Escape') { releaseCamera(); return; }
    if (e.code === 'KeyX' && S.camop.L.ext) { const c = S.camop; const f = c.focal; c.ext = !c.ext; c.lf.v = Math.log(clamp(c.ext ? f * 2 : f / 2, c.fMin, c.fMax)); if (c.tgt) c.tgt.lf = c.lf.v; toast(c.ext ? 'Doubleur x2 engagé : focale doublée, -2 diaphragmes' : 'Doubleur retiré'); }
    if (e.code === 'KeyR') CAMOP.returnHeld = true;
    if (e.key === '+') KEYS.Equal = true; if (e.key === '-') KEYS.Minus = true;
    e.preventDefault();
    return;
  }
  const target = AIM.target;
  if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (AT.active && onDeck() && (e.code === 'KeyE' || e.code === 'KeyQ')) { if (!e.repeat) atelierInput('down', e.code); return; }
  if (e.code === 'KeyE') act(target);
  if (e.code === 'KeyI' && target) { if (target.kind === 'cam') { openDevice('cam', target.cam.id); return; } const id = target.kind === 'station' ? target.station : target.info; if (id) openInfo(id); }
  if (e.code === 'KeyV') { PL.fly = !PL.fly; updToolbar(); toast(PL.fly ? 'Vol libre : Espace pour monter, C pour descendre' : 'Vol libre désactivé'); }
  if (e.code === 'KeyP') openPlan();
  if (e.code === 'KeyT') toggleTelephone();
  if (e.code === 'KeyG') { if (document.pointerLockElement) document.exitPointerLock(); emit('cours'); }
  if (e.code === 'KeyH') openCommandes();
  if (e.code === 'KeyL') { if (document.pointerLockElement) document.exitPointerLock(); emit('journal'); }
  // Échap : la souris est déjà libérée (le navigateur le fait au premier appui) : le menu du car
  if (e.code === 'Escape' && !document.pointerLockElement) { emit('menu'); e.preventDefault(); }
  if (e.code === 'KeyK') { if (target && target.kind === 'station' && target.device) openDevice(target.device, 1); else openEquipmentIndex(); }
  if (e.code === 'Tab') { e.preventDefault(); toggleTelephone(); }
  if (e.code === 'KeyY') openSynoptics();
  if (e.code === 'KeyM') $('#minimon').hidden = !$('#minimon').hidden;
  if (commutKey(e, 'fps')) e.preventDefault();
}

// regard : souris (verrouillée ou glissée) ou doigt ; en cadreur, la consigne de la tête fluide
function look(dx, dy, mult) {
  if (S.mode === 'camop' && S.camop) {
    const c = S.camop; const s = 0.0016 * mult * (c.cam.fov / 40);
    if (!c.tgt) c.tgt = { yaw: c.yaw.v, pitch: c.pitch.v, lf: c.lf.v };
    c.tgt.yaw -= dx * s; c.tgt.pitch = clamp(c.tgt.pitch - dy * s, -1.3, 1.0);
    return;
  }
  if (S.mode !== 'fps') return;
  const s = 0.0022 * mult;
  PL.yaw -= dx * s; PL.pitch = clamp(PL.pitch - dy * s, -1.45, 1.45);
}
const zoomCamop = (deltaY) => { const c = S.camop; if (c && c.tgt) c.tgt.lf = clamp(c.tgt.lf - deltaY * 0.0012, Math.log(c.fMin), Math.log(c.fMax)); };

export function installInput() {
  window.addEventListener('keydown', onKeyDown);
  // un clic de souris sur un bouton d'un poste ne doit pas lui laisser le focus : sinon Espace ou Entrée
  // (CUT, AUTO) « recliquerait » ce bouton en plus du raccourci
  document.addEventListener('click', (e) => { const t = /** @type {HTMLElement} */ (e.target); const b = t && t.closest && t.closest('button'); if (b && e.detail > 0 && S.mode === 'station') b.blur(); });
  window.addEventListener('keyup', (e) => { KEYS[e.code] = false; if (e.code === 'KeyE' && AT.active) atelierInput('up', 'KeyE'); if (e.code === 'KeyR') CAMOP.returnHeld = false; if (e.key === '+') KEYS.Equal = false; if (e.key === '-') KEYS.Minus = false; });
  window.addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; if (AT.active) atelierInput('up', 'KeyE'); });

  const IL = $('#input-layer');
  // capture du pointeur : refusée par le navigateur si le pointeur vient d'être verrouillé ou n'est plus actif
  const capture = (id) => { try { IL.setPointerCapture(id); } catch (e) { /* sans capture, le glissé s'arrête au bord de la fenêtre */ } };
  let dragLook = null;
  IL.addEventListener('pointerdown', (e) => {
    if (S.mode === 'plan') { planPointer('down', e); capture(e.pointerId); return; }
    if (S.mode === 'fps' && document.pointerLockElement && e.button === 0 && AT.active && onDeck()) { atelierInput('down', 'Mouse0'); return; }
    if (S.mode === 'fps' && document.pointerLockElement && e.button === 0 && AIM.target) { act(AIM.target); return; }
    if (S.mode === 'fps' || S.mode === 'camop') {
      if (e.pointerType === 'mouse' && !document.pointerLockElement) { try { const r = IL.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (err) { /* refus */ } }
      dragLook = { x: e.clientX, y: e.clientY, id: e.pointerId };
      capture(e.pointerId);
    }
  });
  IL.addEventListener('pointermove', (e) => {
    if (S.mode === 'plan') { planPointer('move', e); return; }
    if (dragLook && !document.pointerLockElement && dragLook.id === e.pointerId) { look(e.clientX - dragLook.x, e.clientY - dragLook.y, 2.2); dragLook.x = e.clientX; dragLook.y = e.clientY; }
  });
  IL.addEventListener('pointerup', (e) => { if (S.mode === 'plan') planPointer('up', e); if (AT.active && e.button === 0) atelierInput('up', 'Mouse0'); dragLook = null; });
  IL.addEventListener('wheel', (e) => {
    if (S.mode === 'plan') { e.preventDefault(); planWheel(e); }
    if (S.mode === 'camop' && S.camop) { e.preventDefault(); zoomCamop(e.deltaY); }
    if (S.mode === 'fps' && !document.pointerLockElement && AT.active && atelierWheel(e.deltaY)) e.preventDefault();
  }, { passive: false });
  document.addEventListener('mousemove', (e) => { if (document.pointerLockElement) look(e.movementX, e.movementY, 1); });
  document.addEventListener('wheel', (e) => { if (document.pointerLockElement && S.mode === 'fps' && AT.active) atelierWheel(e.deltaY); if (document.pointerLockElement && S.mode === 'camop' && S.camop && S.camop.tgt) zoomCamop(e.deltaY); }, { passive: true });
}

// commandes tactiles : joystick de déplacement, bouton d'action, monter, information
export function setupTouch() {
  const t = $('#touch'); t.hidden = false; t.innerHTML = '';
  const j = el('div', { class: 'joy' }, el('i'));
  const knobEl = /** @type {HTMLElement} */ (j.firstChild);
  let jid = null, c0 = null;
  j.addEventListener('pointerdown', (e) => { jid = e.pointerId; j.setPointerCapture(jid); const r = j.getBoundingClientRect(); c0 = [r.left + r.width / 2, r.top + r.height / 2]; e.stopPropagation(); });
  j.addEventListener('pointermove', (e) => { if (e.pointerId !== jid) return; const dx = clamp((e.clientX - c0[0]) / 50, -1, 1), dy = clamp((e.clientY - c0[1]) / 50, -1, 1); joy.x = dx; joy.y = dy; knobEl.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`; });
  const end = () => { jid = null; joy.x = joy.y = 0; knobEl.style.transform = ''; };
  j.addEventListener('pointerup', end); j.addEventListener('pointercancel', end);
  const b = (l, fn) => el('button', { class: 'tbtn', style: { padding: '14px 18px', fontSize: '16px' }, onclick: fn }, l);
  // atelier : E se maintient (lever, nettoyer), « Reposer » remplace la touche Q
  const eb = b('E', () => { if (!(AT.active && onDeck())) act(AIM.target); });
  eb.setAttribute('aria-label', 'E : utiliser'); eb.title = 'Utiliser ce que tu vises (poste, caméra, pièce)';
  eb.addEventListener('pointerdown', () => { if (AT.active && onDeck()) atelierInput('down', 'KeyE'); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) eb.addEventListener(ev, () => { if (AT.active) atelierInput('up', 'KeyE'); });
  const qb = b('Reposer', () => atelierInput('down', 'KeyQ')); qb.hidden = !AT.active;
  on('atelier', (e) => { qb.hidden = e.type === 'end'; });
  const info = () => { const target = AIM.target; if (target) { if (target.kind === 'cam') openDevice('cam', target.cam.id); else openInfo(target.kind === 'station' ? target.station : target.info); } };
  t.append(j, el('div', { class: 'tact' }, eb, qb, b('Monter', () => { PL.pos.y += 3; PL.fly = true; }), Object.assign(b('Info', info), { title: 'Voir la fiche ou le matériel de ce que tu vises (touche I)' })));
}
