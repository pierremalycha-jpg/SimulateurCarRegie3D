// @ts-check
import * as THREE from 'three';
import { S, emit, on, camById, nextCamId } from '../state.js';
import { el, fmt, clamp } from '../util.js';
import { CAMERA_TYPES, LENSES, LINKS, ROLES, FORMATS, SENSORS } from '../data/cameras.js';
import { SLOTS } from '../data/stadium.js';
import { W, labelSprite, standHeightAt, standAt, bowlOffset } from '../world.js';
import { setLayer } from '../geo.js';
import { addCamera, removeCamera, loadPreset, lineUpCamera, computeRoute } from '../bcam.js';
import { RF } from '../rf.js';
import { recordedCams } from '../pipeline.js';
import { playerName, playerNumber } from '../match.js';
import { $, toast, selectEl, field, ask } from './common.js';
import { openDevice } from '../equipment/viewer.js';

export const PLAN = { cam: null, cx: 0, cz: -28, mpp: 0.3, sel: null, free: false, freeSlots: [], markers: {}, wedges: {}, hover: null, drag: null };

export function initPlan(scene) {
  PLAN.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 2000);
  PLAN.cam.up.set(0, 0, -1);
  PLAN.cam.layers.enable(1); PLAN.cam.layers.enable(2); PLAN.cam.layers.enable(3);
  const g = new THREE.Group(); scene.add(g); PLAN.group = g;
  for (const s of SLOTS) addMarker(s);
  for (const a of RF.antennas) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(2.2, 4), new THREE.MeshBasicMaterial({ color: 0xc77dff, depthTest: false, transparent: true, opacity: 0.9 }));
    m.rotation.x = -Math.PI / 2; m.position.set(a.pos[0], 46, a.pos[2]); m.renderOrder = 10; setLayer(m, 3); g.add(m);
    PLAN.markers['ant:' + a.id] = { mesh: m, pos: new THREE.Vector3(...a.pos), kind: 'ant', ant: a };
  }
  const zl = (t, x, z, sc = 26) => { const s = labelSprite(t, { scale: sc, border: 'rgba(147,160,171,0.5)', size: 40, depthTest: false }); s.position.set(x, 47, z); s.renderOrder = 11; setLayer(s, 3); g.add(s); };
  zl('TRIBUNE PRINCIPALE', 0, -104); zl('TRIBUNE OPPOSÉE', 0, 102); zl('VIRAGE GAUCHE', -128, 0, 22); zl('VIRAGE DROIT', 128, 0, 22); zl('COMPOUND · CAR RÉGIE', -18, -140, 30);
  on('cams', refreshMarkers);
}
function addMarker(s) {
  const m = new THREE.Mesh(new THREE.RingGeometry(1.5, 2.6, 24), new THREE.MeshBasicMaterial({ color: 0x8a96a1, depthTest: false, transparent: true, opacity: 0.95, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.set(s.pos[0], 46, s.pos[2]); m.renderOrder = 10; setLayer(m, 3); PLAN.group.add(m);
  PLAN.markers['slot:' + s.id] = { mesh: m, pos: new THREE.Vector3(...s.pos), kind: 'slot', slot: s };
}
function slotById(id) { return SLOTS.find((s) => s.id === id) || PLAN.freeSlots.find((s) => s.id === id); }
function camAtSlot(id) { return S.cams.find((c) => c.slotId === id); }
function refreshMarkers() {
  for (const k in PLAN.markers) {
    const m = PLAN.markers[k];
    if (m.kind === 'slot') {
      const c = camAtSlot(m.slot.id);
      const sel = PLAN.sel === k || (c && PLAN.sel === 'cam:' + c.id);
      m.mesh.material.color.setHex(sel ? 0x46c6f2 : c ? (c.status.ok ? 0xffb020 : 0xff3b30) : PLAN.hover === k ? 0xffffff : 0x8a96a1);
      m.mesh.scale.setScalar(sel ? 1.5 : 1);
    } else if (m.kind === 'ant') m.mesh.material.color.setHex(m.ant.on ? 0xc77dff : 0x4a4f55);
  }
}

export function openPlan() {
  if (document.pointerLockElement) document.exitPointerLock();
  S.mode = 'plan';
  $('#plan').hidden = false; $('#planlegend').hidden = false; $('#planzoom').hidden = false; $('#hud').hidden = true;
  buildLegend(); buildZoom(); renderPanel(); refreshMarkers();
  emit('plan');
}
export function closePlan() {
  $('#plan').hidden = true; $('#planlegend').hidden = true; $('#planzoom').hidden = true; $('#hud').hidden = false;
  S.mode = 'fps'; PLAN.sel = null;
}

function buildLegend() {
  const L = $('#planlegend'); L.innerHTML = '';
  for (const k of ['smpte', 'precab', 'smf', 'triax', 'coax', 'ip']) { const c = '#' + LINKS[k].color.toString(16).padStart(6, '0'); L.appendChild(el('span', {}, el('i', { style: { background: c } }), LINKS[k].short)); }
  L.appendChild(el('span', {}, el('i', { style: { background: '#ffb020', height: '8px', width: '8px', borderRadius: '50%' } }), 'position occupée'));
  L.appendChild(el('span', {}, el('i', { style: { background: '#c77dff', height: '8px', width: '8px' } }), 'antenne HF'));
  L.appendChild(el('span', { class: 'note' }, 'Clic : sélectionner · glisser : déplacer · molette : zoom · lignes blanches : angle de champ'));
}
function buildZoom() {
  const Z = $('#planzoom'); Z.innerHTML = '';
  Z.append(el('button', { class: 'tbtn', 'aria-label': 'Zoom avant', title: 'Zoom avant', onclick: () => { PLAN.mpp = clamp(PLAN.mpp / 1.3, 0.04, 1.2); } }, '+'), el('button', { class: 'tbtn', 'aria-label': 'Zoom arrière', title: 'Zoom arrière', onclick: () => { PLAN.mpp = clamp(PLAN.mpp * 1.3, 0.04, 1.2); } }, '−'),
    el('button', { class: 'tbtn', onclick: () => { fitView(); } }, 'Vue complète'), el('button', { class: 'tbtn' + (PLAN.free ? ' on' : ''), onclick: (e) => { PLAN.free = !PLAN.free; e.currentTarget.classList.toggle('on', PLAN.free); toast(PLAN.free ? 'Placement libre : cliquez au bord du terrain ou en tribune pour créer une position.' : 'Placement libre désactivé'); } }, 'Placement libre'));
}
export function fitView() {
  const w = window.innerWidth - (window.innerWidth > 760 ? 420 : 0), h = window.innerWidth > 760 ? window.innerHeight : window.innerHeight * 0.46;
  PLAN.mpp = Math.max(240 / w, 270 / h); PLAN.cx = window.innerWidth > 760 ? 0 + 210 * PLAN.mpp : 0; PLAN.cz = -28;
}

export function renderPlan(renderer) {
  const w = renderer.domElement.clientWidth, h = renderer.domElement.clientHeight;
  const c = PLAN.cam; const s = PLAN.mpp;
  c.left = -w / 2 * s; c.right = w / 2 * s; c.top = h / 2 * s; c.bottom = -h / 2 * s;
  c.position.set(PLAN.cx, 600, PLAN.cz); c.lookAt(PLAN.cx, 0, PLAN.cz); c.updateProjectionMatrix();
  for (const m of W.roofMeshes) m.visible = false;
  W.giantScreen.visible = false;
  updateWedges();
  renderer.toneMappingExposure = S.lighting === 'nuit' ? 10 : 1.2;
  renderer.setRenderTarget(null); renderer.setClearColor(0x0b0e11, 1); renderer.clear();
  renderer.render(W.scene, c);
  for (const m of W.roofMeshes) m.visible = true;
  W.giantScreen.visible = true;
  for (const k in PLAN.wedges) PLAN.wedges[k].visible = false;
}

function updateWedges() {
  for (const cam of S.cams) {
    let wg = PLAN.wedges[cam.id];
    if (!wg) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 3), 3));
      wg = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.3, depthTest: false }));
      wg.renderOrder = 9; setLayer(wg, 3); wg.frustumCulled = false; W.scene.add(wg); PLAN.wedges[cam.id] = wg;
    }
    wg.visible = true;
    const selc = PLAN.sel === 'cam:' + cam.id;
    wg.material.color.setHex(selc ? 0x46c6f2 : 0xffffff); wg.material.opacity = selc ? 1 : PLAN.sel ? 0.12 : 0.3;
    const p = cam.cam.position; const yaw = cam.yaw.v; const hf = cam.hfov();
    const dir = new THREE.Vector3(); cam.cam.getWorldDirection(dir);
    let dist = 60; if (dir.y < -0.02) dist = clamp(-p.y / dir.y * Math.hypot(dir.x, dir.z), 5, 160);
    const a1 = yaw + hf / 2, a2 = yaw - hf / 2;
    const P = (a, d) => [p.x - Math.sin(a) * d, 45.5, p.z - Math.cos(a) * d];
    const arr = wg.geometry.attributes.position;
    const pts = [[p.x, 45.5, p.z], P(a1, dist), [p.x, 45.5, p.z], P(a2, dist), P(a1, dist), P(yaw, dist * 1.01), P(yaw, dist * 1.01), P(a2, dist)];
    pts.forEach((q, i) => arr.setXYZ(i, q[0], q[1], q[2]));
    arr.needsUpdate = true;
  }
  for (const k in PLAN.wedges) if (!camById(+k)) { W.scene.remove(PLAN.wedges[k]); delete PLAN.wedges[k]; }
}

// --- interactions souris dans la vue plan ---
function screenOf(v) { const p = v.clone(); p.y = 46; p.project(PLAN.cam); return [(p.x + 1) / 2 * window.innerWidth, (1 - p.y) / 2 * window.innerHeight]; }
function pick(x, y) {
  let best = null, bd = 16;
  for (const k in PLAN.markers) { const m = PLAN.markers[k]; const [sx, sy] = screenOf(m.pos); const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = k; } }
  for (const c of S.cams) { const [sx, sy] = screenOf(c.cam.position); const d = Math.hypot(sx - x, sy - y); if (d < bd) { bd = d; best = 'cam:' + c.id; } }
  return best;
}
function worldOf(x, y) {
  const s = PLAN.mpp; const wx = PLAN.cx + (x - window.innerWidth / 2) * s; const wz = PLAN.cz + (y - window.innerHeight / 2) * s;
  return [wx, wz];
}
export function planPointer(type, e) {
  if (type === 'down') { PLAN.drag = { x: e.clientX, y: e.clientY, cx: PLAN.cx, cz: PLAN.cz, moved: false }; return; }
  if (type === 'move') {
    if (PLAN.drag) {
      const dx = e.clientX - PLAN.drag.x, dy = e.clientY - PLAN.drag.y;
      if (Math.hypot(dx, dy) > 5) PLAN.drag.moved = true;
      if (PLAN.drag.moved) { PLAN.cx = PLAN.drag.cx - dx * PLAN.mpp; PLAN.cz = PLAN.drag.cz - dy * PLAN.mpp; }
    } else {
      const h = pick(e.clientX, e.clientY);
      if (h !== PLAN.hover) { PLAN.hover = h; refreshMarkers(); const tip = $('#plantip'); if (tip) tip.remove(); if (h) showTip(h, e.clientX, e.clientY); }
    }
    return;
  }
  if (type === 'up') {
    const d = PLAN.drag; PLAN.drag = null;
    if (!d || d.moved) return;
    const k = pick(e.clientX, e.clientY);
    if (k) { select(k); return; }
    if (PLAN.free) {
      const [x, z] = worldOf(e.clientX, e.clientY);
      const sa = standAt(x, z); const o = sa ? sa.o : Math.min(0, bowlOffset(x, z));
      if (Math.abs(x) > 113 || Math.abs(z) > 93) { toast('Hors du stade : cliquez au bord du terrain ou dans une tribune.'); return; }
      if (!sa && bowlOffset(x, z) > 0) { toast('Angle ouvert du stade : pas de tribune ici (pylône du toit).'); return; }
      let y = 1.6;
      if (o > 0) y = standHeightAt(x, z) + 1.4;
      const id = 'free_' + (PLAN.freeSlots.length + 1);
      const s = { id, label: `Position libre ${PLAN.freeSlots.length + 1}`, zone: o > 0 ? sa.st.name : 'Bord terrain', pos: [Math.round(x * 10) / 10, Math.round(y * 10) / 10, Math.round(z * 10) / 10], types: ['plateau', 'portable', 'hfr3', 'hfr6', 'steadicam', 'ptz', 'pov'], role: o > 0 ? 'semi' : 'joueur', precab: false, desc: 'Position créée en placement libre.', free: true };
      PLAN.freeSlots.push(s); addMarker(s); select('slot:' + id);
    }
  }
}
export function planWheel(e) {
  const before = worldOf(e.clientX, e.clientY);
  PLAN.mpp = clamp(PLAN.mpp * (e.deltaY > 0 ? 1.12 : 1 / 1.12), 0.04, 1.2);
  const after = worldOf(e.clientX, e.clientY);
  PLAN.cx += before[0] - after[0]; PLAN.cz += before[1] - after[1];
}
function showTip(k, x, y) {
  const m = PLAN.markers[k]; let t = '';
  if (k.startsWith('cam:')) { const c = camById(+k.slice(4)); t = `CAM ${c.id} · ${c.T.label}`; }
  else if (m && m.kind === 'slot') { const c = camAtSlot(m.slot.id); t = `${m.slot.label}${c ? ' · CAM ' + c.id : ' · libre'}`; }
  else if (m && m.kind === 'ant') t = `${m.ant.label} · ${m.ant.on ? 'allumée' : 'éteinte'}`;
  const d = el('div', { id: 'plantip', class: 'chip', style: { position: 'fixed', left: x + 14 + 'px', top: y + 10 + 'px', zIndex: 6, pointerEvents: 'none' } }, t);
  document.body.appendChild(d);
}

function select(k) {
  if (k.startsWith('ant:')) { const a = PLAN.markers[k].ant; a.on = !a.on; toast(`${a.label} : ${a.on ? 'allumée' : 'éteinte'}`); refreshMarkers(); renderPanel(); return; }
  if (k.startsWith('slot:')) { const c = camAtSlot(k.slice(5)); if (c) k = 'cam:' + c.id; }
  PLAN.sel = k; refreshMarkers(); renderPanel();
}

// --- panneau latéral ---
function lensInfo(lensKey, sensorKey, dist) {
  const L = LENSES[lensKey], s = SENSORS[sensorKey];
  const a = (f) => 2 * Math.atan(s.w / (2 * f)) * 180 / Math.PI;
  const wfield = (f) => s.w * dist / f;
  return `${L.fmin}–${L.fmax} mm (${L.fmax === L.fmin ? 'fixe' : 'x' + Math.round(L.fmax / L.fmin)})${L.ext ? ', doubleur x2' : ''} · angle horizontal ${fmt(a(L.fmin), 1)}° → ${fmt(a(L.fmax), L.fmax > 300 ? 2 : 1)}° · à ${Math.round(dist)} m du rond central : champ de ${Math.round(wfield(L.fmin))} m → ${fmt(wfield(L.fmax), 1)} m de large`;
}

function camForm(slot, cam) {
  const types = slot ? slot.types : Object.keys(CAMERA_TYPES);
  const st = { type: cam ? cam.type : types[0], lens: cam ? cam.lens : null, link: cam ? cam.link : null, role: cam ? cam.role : (slot ? slot.role : null), id: cam ? cam.id : nextCamId(), target: cam ? cam.targetPlayer : 9 };
  const T = () => CAMERA_TYPES[st.type];
  if (!st.lens || !T().lenses.includes(st.lens)) st.lens = T().defLens;
  const validLinks = () => T().links.filter((l) => l !== 'precab' || (slot && slot.precab));
  if (!st.link || !validLinks().includes(st.link)) st.link = validLinks().includes(T().defLink) ? T().defLink : validLinks()[0];
  if (!st.role || !T().roles.includes(st.role)) st.role = T().roles[0];
  const box = el('div', { class: 'list' });
  const draw = () => {
    box.innerHTML = '';
    const ids = [];
    for (let i = 1; i <= S.maxCams; i++) if (!camById(i) || (cam && cam.id === i)) ids.push([i, 'CAM ' + i]);
    const pos = slot ? slot.pos : cam.base.toArray();
    const route = computeRoute(pos, st.type, st.link);
    const Lk = LINKS[st.link];
    const max = Lk.max ? Lk.max[S.format] : null;
    const tooLong = max != null && route.length > max;
    const dist = Math.hypot(pos[0], pos[1], pos[2]);
    box.append(
      el('div', { class: 'grid2' },
        field('Type de caméra', selectEl(types.map((t) => [t, CAMERA_TYPES[t].label]), st.type, (v) => { st.type = v; st.lens = null; st.link = null; st.role = null; if (!T().lenses.includes(st.lens)) st.lens = T().defLens; st.link = validLinks().includes(T().defLink) ? T().defLink : validLinks()[0]; st.role = T().roles.includes(slot?.role) ? slot.role : T().roles[0]; draw(); })),
        field('Objectif', selectEl(T().lenses.map((l) => [l, LENSES[l].name]), st.lens, (v) => { st.lens = v; draw(); })),
        field('Liaison vers le car', selectEl(validLinks().map((l) => [l, LINKS[l].label]), st.link, (v) => { st.link = v; draw(); })),
        field('Consigne de cadrage', selectEl(T().roles.map((r) => [r, ROLES[r].label]), st.role, (v) => { st.role = v; draw(); })),
        st.role === 'joueur' ? field('Joueur à suivre', selectEl([...Array(22).keys()].map((i) => [i, `${playerNumber(i)} · ${playerName(i)}`]), st.target, (v) => { st.target = +v; })) : null,
        field('Numéro (CCU)', selectEl(ids, st.id, (v) => { st.id = +v; }))),
      el('p', { class: 'note' }, el('b', {}, 'Caméra : '), T().body, '. ', el('b', {}, 'Support : '), T().support, '.'),
      el('p', { class: 'note' }, el('b', {}, 'Objectif : '), lensInfo(st.lens, T().sensor, dist), '. ', LENSES[st.lens].desc, LENSES[st.lens].mod ? ` Mise au point mini ${String(LENSES[st.lens].mod).replace('.', ',')} m${LENSES[st.lens].kg ? `, ${String(LENSES[st.lens].kg).replace('.', ',')} kg` : ''}${LENSES[st.lens].dim ? ` (${LENSES[st.lens].dim})` : ''}.` : ''),
      el('p', { class: 'note' }, el('b', {}, 'Cadrage : '), ROLES[st.role].desc),
      el('p', { class: 'note' }, el('b', {}, 'Liaison : '), Lk.desc),
      st.link === 'hf' ? el('p', { class: 'note warn' }, 'Liaison HF : pensez à allumer des antennes de réception (losanges violets sur le plan) et à régler la modulation en régie HF.')
        : el('p', { class: 'note ' + (tooLong ? 'err' : 'ok') }, `Longueur de câble : ${Math.round(route.length)} m${route.infra ? ` + ${Math.round(route.infraLength)} m de pré-câblage` : ''}${max != null ? ` · limite ${max >= 10000 ? '> 10 km' : max + ' m'} en ${S.format === 'UHD' ? 'UHD' : 'HD'}` : ''} → ${tooLong ? 'TROP LONG : la caméra ne fonctionnera pas' : 'OK'}${!Lk.power && st.link !== 'hf' ? ' · alimentation locale nécessaire' : ''}`),
      el('p', { class: 'note' }, `Raccordement : ${st.link === 'hf' ? 'récepteur HF ' + st.id + ' (baie HF)' : (Lk.power ? 'embase SMPTE/triax n° ' + st.id : 'fibre n° ' + st.id) + ' au pied de car → CCU ' + st.id}.`),
      el('div', { class: 'hwrow' },
        el('button', { class: 'btn primary', onclick: () => install(slot, cam, st) }, cam ? 'Appliquer' : 'Installer la caméra'),
        cam ? el('button', { class: 'btn danger', onclick: () => { removeCamera(cam.id); PLAN.sel = slot ? 'slot:' + slot.id : null; renderPanel(); refreshMarkers(); } }, 'Démonter la caméra') : null,
        cam ? el('button', { class: 'btn', onclick: () => { closePlan(); emit('takeCamera', cam); } }, 'Prendre la caméra') : null,
        cam ? el('button', { class: 'btn', onclick: () => { closePlan(); emit('openStationNow', { id: 'vision', cam: cam.id }); } }, 'Régler au RCP') : null,
        cam ? el('button', { class: 'btn', onclick: () => openDevice('cam', cam.id) }, 'Voir le matériel') : null));
  };
  draw();
  return box;
}

function install(slot, cam, st) {
  let paint = null;
  if (cam) { paint = { ...cam.paint }; removeCamera(cam.id); }
  if (camById(st.id)) { toast(`La CAM ${st.id} existe déjà : choisissez un autre numéro (CCU).`, 'bad'); return; }
  const c = addCamera({ id: st.id, type: st.type, lens: st.lens, link: st.link, role: st.role, slotId: slot ? slot.id : null, pos: slot ? slot.pos : null, targetPlayer: st.target });
  if (!c) { toast('Plus de CCU disponible (16 au plus) : démontez une caméra pour en installer une autre.', 'bad', 6000); return; }
  if (paint) Object.assign(c.paint, paint); else if (S.autoLineup) lineUpCamera(c);
  PLAN.sel = 'cam:' + c.id; renderPanel(); refreshMarkers();
  toast(`CAM ${c.id} installée · ${c.status.ok ? 'liaison OK' : c.status.reason}`, c.status.ok ? 'good' : 'bad');
  emit('installed', c);
}

export function renderPanel() {
  const P = $('#plan'); P.innerHTML = '';
  const head = el('div', { class: 'ph' },
    el('h2', {}, el('span', { class: 'tape' }, 'Plan des caméras'), el('button', { class: 'x', 'aria-label': 'Fermer', onclick: closePlan }, '×')),
    el('div', { class: 'hwrow' },
      ...[['basique', 'Plan à 6 caméras'], ['standard', 'Plan à 12 caméras'], ['grand', 'Grand dispositif (16 caméras)']].map(([k, l]) => el('button', { class: 'btn small', title: 'Remplace toutes les caméras installées par ce dispositif', onclick: async () => {
        if (S.cams.length && !(await ask(`Remplacer les ${S.cams.length} caméras installées par ce dispositif (${l.toLowerCase()}) ? Leurs réglages seront perdus.`, { title: 'Changer de dispositif', ok: 'Remplacer les caméras' }))) return;
        loadPreset(k, true); PLAN.sel = null; renderPanel(); refreshMarkers(); toast('Dispositif chargé : ' + l.toLowerCase());
      } }, l)),
      el('button', { class: 'btn small danger', onclick: async () => {
        if (S.cams.length && !(await ask(`Démonter les ${S.cams.length} caméras installées ? Leurs réglages seront perdus.`, { title: 'Tout démonter', ok: 'Tout démonter', danger: true }))) return;
        loadPreset('none'); renderPanel(); refreshMarkers();
      } }, 'Tout démonter')),
    el('div', { class: 'hwrow' }, field('Format de production', selectEl(Object.entries(FORMATS).map(([k, v]) => [k, v.label]), S.format, (v) => { S.format = v; for (const c of S.cams) c.checkLink(); renderPanel(); refreshMarkers(); }))));
  const body = el('div', { class: 'pb' });
  P.append(head, body);
  // sélection
  if (PLAN.sel) {
    let slot, cam = null;
    if (PLAN.sel.startsWith('cam:')) { cam = camById(+PLAN.sel.slice(4)); slot = cam ? slotById(cam.slotId) : null; }
    else slot = slotById(PLAN.sel.slice(5));
    if (slot || cam) {
      body.append(el('div', { class: 'hwpanel' }, el('h3', {}, cam ? `CAM ${cam.id} · ${slot ? slot.label : 'position'}` : slot.label),
        slot ? el('p', { class: 'note' }, `${slot.zone} · hauteur d'optique ${fmt(slot.pos[1], 1)} m · ${slot.precab ? 'pré-câblage disponible' : 'pas de pré-câblage'}. ${slot.desc}`) : null,
        camForm(slot, cam)));
    }
  } else {
    body.append(el('p', { class: 'note' }, 'Cliquez sur une position (cercle) pour installer une caméra, ou sur une caméra existante pour la modifier. Les losanges violets sont les antennes HF : un clic les allume ou les éteint.'));
  }
  // bilan
  const total = S.cams.reduce((a, c) => a + (c.route ? c.route.length : 0), 0);
  const rec = recordedCams(); const recCh = rec.reduce((a, id) => a + camById(id).hfr, 0);
  const bad = S.cams.filter((c) => !c.status.ok);
  body.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Bilan de l\'installation'),
    el('dl', { class: 'kv' },
      el('dt', {}, 'Caméras'), el('dd', {}, `${S.cams.length} / 16 CCU`),
      el('dt', {}, 'Câble à tirer'), el('dd', {}, `${(total / 1000).toFixed(2).replace('.', ',')} km`),
      el('dt', {}, 'Liaisons HF'), el('dd', {}, `${S.cams.filter((c) => c.rf).length} · antennes allumées ${RF.antennas.filter((a) => a.on).length}`),
      el('dt', {}, 'Enregistrement EVS'), el('dd', {}, `${recCh} / 8 entrées (${rec.length} caméras)`),
      el('dt', {}, 'Défauts'), el('dd', { class: bad.length ? 'err' : 'ok' }, bad.length ? bad.map((c) => 'CAM ' + c.id).join(', ') : 'aucun'))));
  const list = el('div', { class: 'list' });
  for (const c of S.cams) {
    list.appendChild(el('button', { class: 'item' + (PLAN.sel === 'cam:' + c.id ? ' sel' : ''), style: { textAlign: 'left' }, onclick: () => select('cam:' + c.id) },
      el('span', { class: 'dot ' + (c.status.ok ? 'green' : 'red') }),
      el('div', { class: 'grow' }, el('div', { class: 't' }, `CAM ${c.id} · ${c.T.short} · ${ROLES[c.role].label}`), el('div', { class: 's' }, `${c.L.name} · ${LINKS[c.link].short}${c.route && c.route.length ? ' · ' + Math.round(c.route.length) + ' m' : ''}${c.status.ok ? '' : ' · ' + c.status.reason}`))));
  }
  body.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Caméras installées'), list.children.length ? list : el('p', { class: 'note' }, 'Aucune caméra installée.')));
  const al = el('div', { class: 'list' });
  for (const a of RF.antennas) al.appendChild(el('label', { class: 'item' }, Object.assign(el('input', { type: 'checkbox', id: 'pa_' + a.id }), { checked: a.on, onchange: (e) => { a.on = e.target.checked; refreshMarkers(); } }), el('div', { class: 'grow' }, el('div', { class: 't' }, a.label), el('div', { class: 's' }, `${a.kind === 'omni' ? 'omnidirectionnelle' : 'secteur'} · ${a.gain} dBi · reliée au car par fibre (RF sur fibre)`))));
  body.append(el('div', { class: 'hwpanel' }, el('h3', {}, 'Antennes de réception HF'), al));
}
on('cams', () => { if (S.mode === 'plan') renderPanel(); });
