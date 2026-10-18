// @ts-check
import { S, emit } from '../state.js';
import { el } from '../util.js';
import { $, modal } from './common.js';
import { T } from '../truck.js';
import { TRUCK } from '../world.js';
import { avatarPositions } from '../multi/avatars.js';

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
  tech: 'Baies : CCU, grille, mélangeur, réseau IP (spines, multiviewers), EVS, transmission, synchro, intercom, brassage, audio, HF. Les leaves IP sont en haut de chaque baie.',
};

function drawPlan(scale, labels) {
  const L = T.layout; const I = L.size;
  const W = (I.x1 - I.x0) * scale, H = (I.z1 - I.z0) * scale;
  const px = (lx) => (lx - I.x0) * scale, pz = (lz) => (lz - I.z0) * scale;
  const svg = sv('svg', { viewBox: labels ? `-6 -120 ${W + 12} ${H + 250}` : `-6 -6 ${W + 12} ${H + 12}`, class: 'tmap-svg', role: 'img', 'aria-label': 'Plan du car régie' });
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
      const lab = s.short || s.label;
      if (rack) {
        // baies serrées : étiquettes hors du car, reliées au point par un trait
        const top = s.lz < 0, ey = top ? -10 : H + 10;
        g.append(sv('line', { x1: tx, y1: pz(s.lz), x2: tx, y2: ey, stroke: '#5a6470', 'stroke-dasharray': '3 3' }));
        g.append(sv('text', { x: tx, y: top ? ey - 4 : ey + 12, 'text-anchor': 'start', transform: `rotate(${top ? -40 : 40} ${tx} ${top ? ey - 4 : ey + 12})` }, lab));
      } else {
        // rangées serrées : une étiquette sur deux décalée
        const alt = T.stations.filter((x) => x.zone === s.zone && Math.abs(x.lz - s.lz) < 0.1 && x.lx < s.lx).length % 2;
        g.append(sv('text', { x: tx, y: ty + (alt ? (s.lz > 0 ? 13 : -13) : 0), 'text-anchor': 'middle' }, lab.length > 22 ? lab.slice(0, 21) + '…' : lab));
      }
    }
    g.addEventListener('click', (e) => { e.stopPropagation(); if (goTo) goTo(s); });
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.stopPropagation(); if (goTo) goTo(s); } });
    svg.append(g);
  }
  // équipiers d'une session (couleur de leur rôle, initiale)
  const peers = sv('g', { class: 'tmap-peers' }); svg.append(peers);
  // joueur
  const me = sv('g', { class: 'tmap-me' }, sv('circle', { r: labels ? 8 : 5.5 }), sv('path', { d: labels ? 'M0 -15 L7 -3 L-7 -3 Z' : 'M0 -11 L5 -2 L-5 -2 Z' }));
  svg.append(me);
  return { svg, me, px, pz, peers, labels, peersKey: '' };
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
  placePeers(plan);
}
function placePeers(plan) {
  const now = performance.now(); if (plan.peersT && now - plan.peersT < 250) return; plan.peersT = now;
  const list = avatarPositions().filter((a) => a.truck);
  const key = list.map((a) => `${a.peer}:${a.x.toFixed(1)}:${a.z.toFixed(1)}:${a.color}:${a.name}`).join('|');
  if (key === plan.peersKey) return; plan.peersKey = key;
  plan.peers.textContent = '';
  for (const a of list) {
    const x = plan.px(a.x - TRUCK.cx), y = plan.pz(a.z - TRUCK.cz), r = plan.labels ? 8 : 5;
    const g = sv('g', { transform: `translate(${x} ${y})` }, sv('circle', { r, fill: a.color, stroke: '#0b0d10', 'stroke-width': 1.5 }), sv('title', {}, a.name));
    g.append(sv('text', { y: plan.labels ? 4 : 3, 'text-anchor': 'middle', style: `font:700 ${plan.labels ? 10 : 7}px "Barlow Condensed",sans-serif;fill:#0b0d10` }, a.name.slice(0, 1).toUpperCase()));
    if (plan.labels) g.append(sv('text', { y: -12, 'text-anchor': 'middle', style: 'font:600 11px "Barlow Condensed",sans-serif;fill:#e6ecf2' }, a.name));
    plan.peers.append(g);
  }
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
    el('button', { class: 'btn', onclick: () => emit('openSynoptics') }, 'Synoptiques techniques du car (Y)'),
    el('p', { class: 'note' }, 'Dans le car : Z Q S D pour marcher, souris pour regarder, E ou clic pour prendre le poste visé (il s\'allume en orange), I pour sa fiche, K pour voir son matériel, Tab pour ce plan.')), { width: 1000 });
}
export function closeTruckPlan() { bigPlan = null; }
// plan détaillé pour les synoptiques (styles intégrés pour l'export SVG)
export function planSVG() {
  const p = drawPlan(48, true);
  if (getPL) place(p, getPL());
  const st = document.createElementNS(NS, 'style');
  st.textContent = '.tmap-zone{font:600 15px "Barlow Condensed",sans-serif;fill:rgba(230,236,242,.6);letter-spacing:.06em}.tmap-door{font:600 12px "Barlow Condensed",sans-serif;fill:#30c060}.tmap-st circle{fill:#8a949e;stroke:#0b0d10;stroke-width:1.5;cursor:pointer}.tmap-st:hover circle{fill:#ffb020}.tmap-st text{font:600 11px "Barlow Condensed",sans-serif;fill:#e6ecf2}.tmap-me circle{fill:#30c0ff;stroke:#fff;stroke-width:1.5}.tmap-me path{fill:#30c0ff}';
  p.svg.prepend(st);
  p.svg.style.minWidth = '900px';
  return p.svg;
}
