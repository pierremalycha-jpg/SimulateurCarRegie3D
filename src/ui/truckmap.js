import { S } from '../state.js';
import { el } from '../util.js';
import { $, modal } from './common.js';
import { STATION_INFO } from '../data.js';
import { T } from '../truck.js';
import { TRUCK } from '../world.js';

// ----------------------------------------------------------------------------------
// Plan du car : mini-plan dans l'interface (position, orientation, postes cliquables)
// et grand plan (touche Tab) avec la liste des postes par zone.
// ----------------------------------------------------------------------------------
const NS = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}, ...kids) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); for (const c of kids) if (c != null) e.append(c); return e; };
let mini = null, goTo = null, getPL = null;
const ZONE_HINT = {
  son: 'Cabine isolée : console, écoutes, loudness.',
  prod: '1re rangée : scripte, réalisateur, truquiste. 2e rangée (estrade) : habillage, production, chef de car.',
  vision: '1re rangée : ingénieurs vision (RCP). 2e rangée : ralentis (LSM) et IPDirector.',
  tech: 'Baies : CCU, grille, mélangeur, multiviewers, EVS, transmission, synchro, intercom, brassage, audio, HF.',
};

function drawPlan(scale, labels) {
  const L = T.layout; const I = L.size;
  const W = (I.x1 - I.x0) * scale, H = (I.z1 - I.z0) * scale;
  const px = (lx) => (lx - I.x0) * scale, pz = (lz) => (lz - I.z0) * scale;
  const svg = sv('svg', { viewBox: `-6 -6 ${W + 12} ${H + (labels ? 30 : 12)}`, class: 'tmap-svg', role: 'img', 'aria-label': 'Plan du car régie' });
  svg.append(sv('rect', { x: 0, y: 0, width: W, height: H, rx: 4, fill: '#14181d', stroke: '#5a6470', 'stroke-width': 2 }));
  for (const z of L.zones) {
    svg.append(sv('rect', { x: px(z.x0), y: 0, width: (z.x1 - z.x0) * scale, height: H, fill: z.color, opacity: 0.55 }));
    svg.append(sv('text', { x: px((z.x0 + z.x1) / 2), y: H - 5, 'text-anchor': 'middle', class: 'tmap-zone' }, (labels ? z.name : z.short).toUpperCase()));
  }
  // allée
  svg.append(sv('rect', { x: 4, y: pz(1.36), width: W - 8, height: pz(I.z1) - pz(1.36) - 2, fill: '#ffb020', opacity: 0.08 }));
  for (const f of L.furniture) {
    const fill = f.kind === 'platform' ? '#2a3038' : f.kind === 'rackunit' ? '#0d0f12' : f.kind === 'rack' ? 'none' : '#4a525c';
    if (f.kind === 'rack') continue;
    svg.append(sv('rect', { x: px(f.x0), y: pz(f.z0), width: (f.x1 - f.x0) * scale, height: (f.z1 - f.z0) * scale, fill, stroke: f.kind === 'rackunit' ? '#3a414a' : 'none', 'stroke-width': 1 }));
  }
  for (const w of L.walls) svg.append(sv('rect', { x: px(w.x0), y: pz(w.z0), width: Math.max(2, (w.x1 - w.x0) * scale), height: (w.z1 - w.z0) * scale, fill: '#8a949e' }));
  // mur d'écrans et porte
  svg.append(sv('rect', { x: px(-5.4), y: 0, width: (3.75 + 5.4) * scale, height: 3, fill: '#4aa3ff' }));
  svg.append(sv('rect', { x: px(L.door.x0), y: H - 3, width: (L.door.x1 - L.door.x0) * scale, height: 6, fill: '#30c060' }));
  if (labels) svg.append(sv('text', { x: px((L.door.x0 + L.door.x1) / 2), y: H + 20, 'text-anchor': 'middle', class: 'tmap-door' }, 'PORTE'));
  if (labels) svg.append(sv('text', { x: px(-0.8), y: 14, 'text-anchor': 'middle', class: 'tmap-door', style: 'fill:#4aa3ff' }, 'MUR D\'ÉCRANS'));
  // postes
  for (const s of T.stations) {
    const g = sv('g', { class: 'tmap-st', tabindex: 0, role: 'button', 'aria-label': 'Aller au poste ' + s.label });
    g.append(sv('circle', { cx: px(s.lx), cy: pz(s.lz), r: labels ? 7 : 4.5 }), sv('title', {}, s.label));
    if (labels) {
      const rack = s.zone === 'tech' && s.id !== 'hf';
      const tx = px(s.lx), ty = pz(s.lz) + (s.lz > 0 ? 18 : -11);
      // baies serrées : étiquettes inclinées
      g.append(sv('text', rack ? { x: tx, y: pz(s.lz) + (s.lz > 0 ? -12 : 14), 'text-anchor': s.lz > 0 ? 'start' : 'end', transform: `rotate(-38 ${tx} ${pz(s.lz) + (s.lz > 0 ? -12 : 14)})` } : { x: tx, y: ty, 'text-anchor': 'middle' }, s.label.length > 22 ? s.label.slice(0, 21) + '…' : s.label));
    }
    g.addEventListener('click', (e) => { e.stopPropagation(); if (goTo) goTo(s); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); if (goTo) goTo(s); } });
    svg.append(g);
  }
  // joueur
  const me = sv('g', { class: 'tmap-me' }, sv('circle', { r: labels ? 8 : 5.5 }), sv('path', { d: labels ? 'M0 -15 L7 -3 L-7 -3 Z' : 'M0 -11 L5 -2 L-5 -2 Z' }));
  svg.append(me);
  return { svg, me, px, pz };
}

export function initTruckMap(onGo, pl) {
  goTo = onGo; getPL = pl;
  const box = el('div', { id: 'truckmap', hidden: true, title: 'Plan du car (Tab pour l\'agrandir)' });
  const plan = drawPlan(16, false);
  box.append(el('div', { class: 'tmap-head' }, el('b', {}, 'Plan du car'), el('span', {}, matchMedia('(pointer: coarse)').matches ? 'Toucher un point : aller au poste' : 'Tab : agrandir · clic sur un point : aller au poste')), plan.svg);
  box.addEventListener('click', () => openTruckPlan());
  $('#hud').appendChild(box);
  mini = plan;
}

export function updateTruckMap(PL) {
  const box = $('#truckmap'); if (!box) return;
  const show = S.inTruck && S.mode === 'fps';
  if (box.hidden === show) box.hidden = !show;
  if (!show) return;
  place(mini, PL);
}
function place(plan, PL) {
  const lx = PL.pos.x - TRUCK.cx, lz = PL.pos.z - TRUCK.cz;
  // direction du regard : (−sin yaw, −cos yaw) dans le plan (x, z) ; en SVG l'axe y descend comme z
  const ang = Math.atan2(-Math.cos(PL.yaw), -Math.sin(PL.yaw)) * 180 / Math.PI + 90;
  plan.me.setAttribute('transform', `translate(${plan.px(lx)} ${plan.pz(lz)}) rotate(${ang})`);
}

let bigPlan = null;
export function updateBigPlan() { if (bigPlan && getPL && bigPlan.svg.isConnected) place(bigPlan, getPL()); }
export function openTruckPlan() {
  const plan = drawPlan(48, true); bigPlan = plan;
  if (getPL) place(plan, getPL());
  const zones = el('div', { class: 'tmap-zones' });
  for (const z of T.layout.zones) {
    const list = el('div', { class: 'hwrow' });
    for (const s of T.stations.filter((x) => x.zone === z.id)) list.append(el('button', { class: 'btn small', onclick: () => goTo && goTo(s) }, s.label));
    zones.append(el('div', { class: 'tmap-zone-card', style: { borderLeftColor: z.color } }, el('h3', {}, z.name), el('p', { class: 'note' }, ZONE_HINT[z.id] || ''), list));
  }
  modal.open('Plan du car régie', el('div', { class: 'list' },
    el('p', { class: 'note' }, 'Vue de dessus. Le mur d\'écrans est en haut, la porte en bas. Une allée longe tout le car côté porte (de la cabine son à la zone technique) ; le passage entre la production et la vision mène à la 1re rangée. Cliquez sur un poste (point ou bouton) pour vous y rendre et l\'ouvrir.'),
    el('div', { class: 'tmap-big' }, plan.svg), zones,
    el('p', { class: 'note' }, 'Dans le car : Z Q S D pour marcher, souris pour regarder, E ou clic pour prendre le poste visé (il s\'allume en orange), I pour sa fiche, K pour voir son matériel, Tab pour ce plan.')), { width: 1000 });
}
export function closeTruckPlan() { bigPlan = null; }
