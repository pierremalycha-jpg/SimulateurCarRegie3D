// @ts-check
import { el } from '../../util.js';
import { modal } from '../../ui/common.js';
import { offerDownload } from '../../shared.js';
import { CATALOGUE, SIGNAUX, CONNECTEURS, portOf } from '../catalogue/index.js';
import { appareil, debrancher } from '../build.js';

// ----------------------------------------------------------------------------------
// Le synoptique : tout le câblage en 2D. Les appareils sont rangés en colonnes dans le sens du
// signal (sources, traitement, mélange, enregistrement et contrôle, réseau, énergie) ; chaque
// câble va d'un connecteur à l'autre en courbe, de la couleur de son signal, en rouge pointillé
// quand la liaison est fausse. Des calques (vidéo et audio, commande et tally, réseau, énergie)
// allègent la vue ; un clic sur un appareil l'ouvre. Exports : le dessin (SVG) et la liste de
// câblage (CSV, une ligne par câble, à imprimer pour le montage).
// ----------------------------------------------------------------------------------
/** @typedef {import('./stock.js').Ctx} Ctx */
/** @typedef {import('../types.js').Cable} Cable */

const NS = 'http://www.w3.org/2000/svg';
const S = (/** @type {string} */ tag, /** @type {Record<string, any>} */ attrs = {}, /** @type {Element | null} */ parent = null, /** @type {string | null} */ text = null) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, String(attrs[k]));
  if (text != null) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
};
/** les calques : quels signaux chacun montre */
/** @type {Array<[string, string, string[]]>} */
const CALQUES = [
  ['video', 'Vidéo et audio', ['sdi', 'hdmi', 'audio', 'aes', 'madi', 'ref', 'tc', 'usb', 'media']],
  ['commande', 'Commande et tally', ['rs422', 'rs232', 'gpio', 'tally']],
  ['ip', 'Réseau', ['ip']],
  ['energie', 'Énergie', ['secteur', 'dc12']],
];
const VUE = { calques: new Set(['video', 'commande', 'ip']) };
/** la colonne d'un appareil, dans le sens du signal */
const COL = { camera: 0, son: 0, convertisseur: 1, pupitre: 1, melangeur: 2, ordinateur: 2, enregistreur: 3, moniteur: 3, accessoire: 3, reseau: 4, alimentation: 5 };
const COLS = ['Sources', 'Traitement et commande', 'Mélange', 'Enregistrement et contrôle', 'Réseau', 'Énergie'];
const W = 150, GAP_X = 70, X0 = 20, Y0 = 46, LINE = 14, HAUT = 40;

/** le dessin du synoptique (SVG), d'après le montage et le moteur */
export function dessin(/** @type {Ctx} */ ctx, /** @type {Set<string>} */ calques, /** @type {(uid: string) => void} */ onOpen) {
  const sigs = new Set(CALQUES.filter(([id]) => calques.has(id)).flatMap(([, , l]) => l));
  const cables = ctx.B.cables.filter((c) => sigs.has(c.sig));
  // l'énergie (mur, bandeau, bloc 12 V) n'apparaît qu'avec son calque, ou si un câble visible y mène
  const energie = (/** @type {import('../types.js').Appareil} */ a) => (CATALOGUE[a.modele] || { famille: '' }).famille === 'alimentation';
  const devs = ctx.B.appareils.filter((a) => !energie(a) || calques.has('energie') || cables.some((c) => c.a.dev === a.uid || c.b.dev === a.uid));
  const col = (/** @type {import('../types.js').Appareil} */ a) => COL[(CATALOGUE[a.modele] || { famille: 'accessoire' }).famille] ?? 3;
  const used = [...new Set(devs.map(col))].sort((x, y) => x - y);
  const cx = (/** @type {number} */ c) => X0 + used.indexOf(c) * (W + GAP_X);
  // les points d'attache : par appareil et par côté
  /** @typedef {{ c: Cable, end: 'a' | 'b', port: string, other: string }} Attache */
  /** @type {Map<string, { left: Attache[], right: Attache[] }>} */
  const att = new Map(devs.map((a) => [a.uid, { left: [], right: [] }]));
  const byUid = new Map(devs.map((a) => [a.uid, a]));
  for (const c of cables) {
    const A = byUid.get(c.a.dev), Bd = byUid.get(c.b.dev); if (!A || !Bd) continue;
    const ca = col(A), cb = col(Bd);
    const [sa, sb] = ca < cb ? ['right', 'left'] : ca > cb ? ['left', 'right'] : ['right', 'right'];
    att.get(A.uid)[sa].push({ c, end: 'a', port: c.a.port, other: Bd.uid });
    att.get(Bd.uid)[sb].push({ c, end: 'b', port: c.b.port, other: A.uid });
  }
  // les boîtes, colonne par colonne
  /** @type {Map<string, { x: number, y: number, h: number }>} */
  const pos = new Map();
  let H = 0;
  for (const c of used) {
    let y = Y0;
    for (const a of devs.filter((d) => col(d) === c).sort((x, y2) => x.nom.localeCompare(y2.nom, 'fr', { numeric: true }))) {
      const t = att.get(a.uid); const h = HAUT + 4 + LINE * Math.max(1, t.left.length, t.right.length);
      pos.set(a.uid, { x: cx(c), y, h }); y += h + 16;
    }
    H = Math.max(H, y);
  }
  // l'ordre des attaches : selon la hauteur de l'autre bout (moins de croisements)
  for (const [, t] of att) for (const side of ['left', 'right']) t[side].sort((p, q) => (pos.get(p.other).y - pos.get(q.other).y) || p.port.localeCompare(q.port));
  /** la position d'un bout de câble (end : 'a' ou 'b') sur le bord de sa boîte */
  const anchor = (/** @type {Cable} */ c, /** @type {'a' | 'b'} */ end) => {
    const uid = c[end].dev; const t = att.get(uid); const p = pos.get(uid);
    for (const side of /** @type {const} */ (['left', 'right'])) { const i = t[side].findIndex((x) => x.c === c && x.end === end); if (i >= 0) return { x: side === 'left' ? p.x : p.x + W, y: p.y + HAUT + i * LINE, side }; }
    return { x: p.x + W, y: p.y + 20, side: 'right' };
  };
  const width = Math.max(W + 2 * X0, X0 * 2 + used.length * W + (used.length - 1) * GAP_X);
  const svg = /** @type {SVGSVGElement} */ (S('svg', { xmlns: NS, viewBox: `0 0 ${width} ${Math.max(H + 10, 120)}`, width, height: Math.max(H + 10, 120), role: 'img', 'aria-label': `Synoptique : ${devs.length} appareils, ${cables.length} câbles` }));
  S('rect', { x: 0, y: 0, width, height: Math.max(H + 10, 120), fill: '#11151a' }, svg);
  for (const c of used) S('text', { x: cx(c), y: 24, fill: '#93a0ab', 'font-size': 12, 'font-family': 'Archivo Narrow, Arial Narrow, sans-serif', 'letter-spacing': '0.06em' }, svg, COLS[c].toUpperCase());
  // les câbles d'abord (sous les boîtes)
  const gC = S('g', { fill: 'none' }, svg);
  for (const c of cables) {
    if (!pos.has(c.a.dev) || !pos.has(c.b.dev)) continue;
    const pa = anchor(c, 'a'), pb = anchor(c, 'b');
    const k = Math.max(40, Math.abs(pb.x - pa.x) / 2);
    const dx = (/** @type {{ side: string }} */ p) => (p.side === 'left' ? -k : k);
    const ok = !ctx.E.cables[c.uid] || ctx.E.cables[c.uid].ok;
    const path = S('path', { d: `M${pa.x},${pa.y} C${pa.x + dx(pa)},${pa.y} ${pb.x + dx(pb)},${pb.y} ${pb.x},${pb.y}`, stroke: ok ? SIGNAUX[c.sig].couleur : '#ff3b30', 'stroke-width': 2, 'stroke-dasharray': ok ? null : '5 4', opacity: 0.9 }, gC);
    const pA = portOf((appareil(c.a.dev) || { modele: '' }).modele, c.a.port), pB = portOf((appareil(c.b.dev) || { modele: '' }).modele, c.b.port);
    S('title', {}, path, `${byUid.get(c.a.dev).nom} · ${pA ? pA.label : c.a.port} → ${byUid.get(c.b.dev).nom} · ${pB ? pB.label : c.b.port} (${SIGNAUX[c.sig].nom})${ok ? '' : ' : ' + ctx.E.cables[c.uid].why}`);
  }
  // les boîtes
  for (const a of devs) {
    const p = pos.get(a.uid); const m = CATALOGUE[a.modele];
    const err = ctx.E.alertes.some((x) => x.dev === a.uid && x.level === 'erreur'); const off = ctx.E.power[a.uid] && !ctx.E.power[a.uid].on;
    const g = S('g', { class: 'ep-sy-dev', tabindex: 0, role: 'button', 'aria-label': `${a.nom} (${m ? m.nom : a.modele})${err ? ', en défaut' : ''} : ouvrir`, 'data-uid': a.uid, style: 'cursor:pointer' }, svg);
    S('rect', { x: p.x, y: p.y, width: W, height: p.h, rx: 5, fill: off ? '#1c2026' : '#252c33', stroke: err ? '#ff3b30' : '#55606b', 'stroke-width': err ? 2 : 1.2 }, g);
    S('text', { x: p.x + 8, y: p.y + 15, fill: off ? '#8a949d' : '#e8edf1', 'font-size': 12.5, 'font-weight': 700, 'font-family': 'Archivo Narrow, Arial Narrow, sans-serif' }, g, a.nom.slice(0, 22));
    S('text', { x: p.x + 8, y: p.y + 27, fill: '#93a0ab', 'font-size': 10, 'font-family': 'Archivo Narrow, Arial Narrow, sans-serif' }, g, (m ? m.court : a.modele) + (off ? ' · éteint' : ''));
    const t = att.get(a.uid);
    for (const side of ['left', 'right']) t[side].forEach((x, i) => {
      const yy = p.y + HAUT + i * LINE; const xx = side === 'left' ? p.x : p.x + W;
      const po = portOf(a.modele, x.port);
      S('circle', { cx: xx, cy: yy, r: 3, fill: SIGNAUX[x.c.sig].couleur }, g);
      S('text', { x: side === 'left' ? xx + 6 : xx - 6, y: yy + 3.5, fill: '#c5ced6', 'font-size': 9.5, 'text-anchor': side === 'left' ? 'start' : 'end', 'font-family': 'B612 Mono, monospace' }, g, (po ? po.label : x.port).slice(0, 16));
    });
    g.addEventListener('click', () => onOpen(a.uid));
    g.addEventListener('keydown', (e) => { const k = /** @type {KeyboardEvent} */ (e).key; if (k === 'Enter' || k === ' ') { e.preventDefault(); onOpen(a.uid); } });
  }
  return svg;
}

/** la liste de câblage : une ligne par câble (CSV, séparateur « ; » pour un tableur en français) */
export function listeCablage(/** @type {Ctx} */ ctx) {
  const q = (/** @type {string} */ s) => `"${String(s).replace(/"/g, '""')}"`;
  const lignes = [['N°', 'De (appareil)', 'De (connecteur)', 'Vers (appareil)', 'Vers (connecteur)', 'Signal', 'Câble', 'État'].map(q).join(';')];
  ctx.B.cables.forEach((c, i) => {
    const A = appareil(c.a.dev), Bd = appareil(c.b.dev); const pa = A ? portOf(A.modele, c.a.port) : null, pb = Bd ? portOf(Bd.modele, c.b.port) : null;
    const st = ctx.E.cables[c.uid];
    lignes.push([String(i + 1), A ? A.nom : '?', pa ? `${pa.label} (${CONNECTEURS[pa.kind].nom})` : c.a.port, Bd ? Bd.nom : '?', pb ? `${pb.label} (${CONNECTEURS[pb.kind].nom})` : c.b.port, SIGNAUX[c.sig].nom, SIGNAUX[c.sig].cable, st && !st.ok ? `faux : ${st.why}` : 'bon'].map(q).join(';'));
  });
  return '﻿' + lignes.join('\r\n') + '\r\n';
}

/** @param {Ctx} ctx */
export function renderSynoptique(ctx) {
  const box = el('div', { class: 'ep-syno' });
  if (!ctx.B.cables.length) { box.append(el('p', { class: 'note' }, 'Aucun câble pour l\'instant. Ouvre un appareil et clique sur un connecteur pour prendre un câble.')); return box; }
  const host = el('div', { class: 'ep-syno-svg' });
  const draw = () => host.replaceChildren(dessin(ctx, VUE.calques, (uid) => ctx.open(uid)));
  const toggles = el('div', { class: 'ep-chips', role: 'group', 'aria-label': 'Calques' }, ...CALQUES.map(([id, nom]) => {
    const b = el('button', { type: 'button', class: 'btn small' + (VUE.calques.has(id) ? ' on' : ''), 'aria-pressed': String(VUE.calques.has(id)), 'data-k': `syno:${id}` }, nom);
    b.addEventListener('click', () => { if (VUE.calques.has(id)) VUE.calques.delete(id); else VUE.calques.add(id); b.classList.toggle('on', VUE.calques.has(id)); b.setAttribute('aria-pressed', String(VUE.calques.has(id))); draw(); });
    return b;
  }));
  draw();
  const ko = ctx.B.cables.filter((c) => ctx.E.cables[c.uid] && !ctx.E.cables[c.uid].ok);
  box.append(toggles, host,
    el('div', { class: 'ep-cf-row' },
      el('button', { type: 'button', class: 'btn small', onclick: () => { const b = el('div', { class: 'ep-syno-big' }); b.append(dessin(ctx, VUE.calques, (uid) => { modal.close(); ctx.open(uid); })); modal.open('Synoptique du montage', b, { width: 1280 }); } }, 'Agrandir'),
      el('button', { type: 'button', class: 'btn small', onclick: async () => { const svg = dessin(ctx, VUE.calques, () => {}); const r = await offerDownload('synoptique-entrepot.svg', '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg)); ctx.say(r === 'saved' ? 'Synoptique enregistré (SVG).' : 'Téléchargement impossible.'); } }, 'Exporter le dessin (SVG)'),
      el('button', { type: 'button', class: 'btn small', onclick: async () => { const r = await offerDownload('liste-de-cablage.csv', listeCablage(ctx)); ctx.say(r === 'saved' ? 'Liste de câblage enregistrée (CSV).' : 'Téléchargement impossible.'); } }, 'Liste de câblage (CSV)')));
  if (ko.length) box.append(el('h3', {}, `Liaisons fausses (${ko.length})`), el('ul', { class: 'ep-cables' }, ...ko.map((c) => el('li', { class: 'ko', style: `--c:${SIGNAUX[c.sig].couleur}` }, el('i', { 'aria-hidden': 'true' }), el('span', {}, `${(appareil(c.a.dev) || { nom: '?' }).nom} → ${(appareil(c.b.dev) || { nom: '?' }).nom}`, el('small', {}, ' ' + ctx.E.cables[c.uid].why)), el('button', { type: 'button', class: 'linkbtn', onclick: () => debrancher(c.uid) }, 'Débrancher')))));
  box.append(el('p', { class: 'note' }, `${ctx.B.cables.length} câble${ctx.B.cables.length > 1 ? 's' : ''}. Survole une liaison pour lire ses deux bouts ; un clic sur un appareil l'ouvre.`));
  return box;
}
