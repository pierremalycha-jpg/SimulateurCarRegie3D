// @ts-check
import { S, emit } from '../state.js';
import { el } from '../util.js';
import { toast } from './common.js';
import { fields, expected, patchScore, patchNormal, patchEmpty, physLabel, physToLogical, DEST_LABEL } from '../patch.js';
import { sourceLabel } from '../pipeline.js';
import { routerInLabel, routerOutLabel } from '../equipment/cabling.js';
import { explain } from './widgets.js';

const NS = 'http://www.w3.org/2000/svg';
const E = (tag, attrs = {}, parent, text) => { const e = document.createElementNS(NS, tag); for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
const DX = 46;

// Poste « baie de brassage » : exercice du car vide (on brasse soi-même chaque liaison)
export function buildPatch(body, arg, ctx) {
  ctx.dock.append(el('div', { class: 'monwrap grow' }, el('div', { class: 'lab' }, 'Multiview (résultat de ton brassage)'), el('div', { class: 'mon fill', 'data-gl': 'mv' })));
  let sel = null; let showCheck = false; const t0 = S.time;
  const status = el('div', { class: 'lcd amber' });
  const modeBtn = el('button', { class: 'btn' });
  const checkBtn = el('button', { class: 'btn', onclick: () => { showCheck = !showCheck; draw(); } });
  const ctl = el('div', { class: 'hwpanel' }, el('h3', {}, 'Exercice : le car vide'),
    el('p', { class: 'note' }, 'En exploitation, les jacks sont « normalés » : sans cordon, chaque source arrive directement à sa destination. Dans l\'exercice du car vide, les normales sont retirées : rien n\'arrive tant que tu n\'as pas brassé chaque liaison selon la liste de câblage. Clique une prise du haut puis une prise du bas ; clique une prise occupée pour retirer son cordon.'),
    el('div', { class: 'hwrow' }, modeBtn,
      el('button', { class: 'btn', onclick: () => { patchEmpty(); emit('router', {}); explain('Tous les cordons retirés.'); draw(); } }, 'Tout débrancher'),
      el('button', { class: 'btn', onclick: () => { patchNormal(); emit('router', {}); explain('Solution appliquée : chaque liaison est brassée comme sur la liste de câblage.'); draw(); } }, 'Montrer la solution'),
      checkBtn, status));
  modeBtn.onclick = () => {
    S.patch.on = !S.patch.on;
    if (S.patch.on && !Object.keys(S.patch.inputs).length) patchEmpty();
    emit('router', {}); emit('cams');
    explain(S.patch.on ? 'Car vide : les normales sont retirées. Au multiview, toutes les sources non brassées affichent « ENTRÉE VIDE ». Les CCU sans cordon de référence perdent le genlock.' : 'Car normalisé : toutes les liaisons passent par les normales, le brassage est ignoré.');
    draw();
  };
  const fieldHosts = {};
  const listBox = el('div', { class: 'list patch-list' });
  const wrap = el('div', { class: 'list' });
  for (const k of ['inputs', 'outputs', 'refs']) { fieldHosts[k] = el('div', { class: 'svgwrap patch-field' }); wrap.append(el('h3', { class: 'eq-h', id: 'pf-' + k }), fieldHosts[k]); }
  body.append(ctl, el('div', { class: 'patch-grid' }, wrap, el('div', { class: 'hwpanel' }, el('h3', {}, 'Plan de brassage (d\'après la liste de câblage)'), listBox)));

  const P = () => S.patch;
  function labelTop(k, id) { return k === 'inputs' ? physLabel(id) : k === 'outputs' ? `OUT ${id}` : `DA ${id}`; }
  function labelBottom(k, id) { return k === 'inputs' ? `IN ${id}` : k === 'outputs' ? DEST_LABEL(id) : `CCU ${id} REF`; }
  function connOfTop(k, id) {
    const p = P();
    if (k === 'inputs') return Object.keys(p.inputs).find((n) => p.inputs[n] === id);
    if (k === 'outputs') return p.outputs[id];
    return Object.keys(p.refs).find((c) => +p.refs[c] === +id);
  }
  function connOfBottom(k, id) {
    const p = P();
    if (k === 'inputs') return p.inputs[id];
    if (k === 'outputs') return Object.keys(p.outputs).find((o) => p.outputs[o] === id);
    return p.refs[id];
  }
  function unplug(k, side, id) {
    const p = P();
    if (k === 'inputs') { if (side === 'b') delete p.inputs[id]; else for (const n in p.inputs) if (p.inputs[n] === id) delete p.inputs[n]; }
    if (k === 'outputs') { if (side === 't') delete p.outputs[id]; else for (const o in p.outputs) if (p.outputs[o] === id) delete p.outputs[o]; }
    if (k === 'refs') { if (side === 'b') delete p.refs[id]; else for (const c in p.refs) if (+p.refs[c] === +id) delete p.refs[c]; }
  }
  function plug(k, top, bottom) {
    unplug(k, 't', top); unplug(k, 'b', bottom);
    const p = P();
    if (k === 'inputs') p.inputs[bottom] = top; else if (k === 'outputs') p.outputs[top] = bottom; else p.refs[bottom] = top;
    emit('router', {}); if (k === 'refs') emit('cams');
    explainPlug(k, top, bottom);
  }
  function explainPlug(k, top, bottom) {
    const e = expected();
    if (k === 'inputs') {
      const right = e.inputs[bottom] === top;
      const lg = physToLogical(top);
      if (right) explain(`${physLabel(top)} → grille IN ${bottom} : correct. La source s'appelle « ${routerInLabel(bottom)} » dans toute la régie (multiview, mélangeur, tally).`);
      else explain(`${physLabel(top)} → grille IN ${bottom} : ce n'est pas le plan. La régie croit recevoir « ${routerInLabel(bottom) || 'IN ' + bottom} » mais l'image est celle de ${sourceLabel(lg)} : le nom au multiview (UMD) et le tally seront faux. C'est l'erreur de brassage la plus courante… et la plus trompeuse.`, 'warn');
    } else if (k === 'outputs') {
      const right = e.outputs[top] === bottom;
      explain(right ? `Grille OUT ${top} (${routerOutLabel(top)}) → ${DEST_LABEL(bottom)} : correct.` : `Grille OUT ${top} (${routerOutLabel(top)}) → ${DEST_LABEL(bottom)} : la destination recevra ce que la grille envoie sur OUT ${top}, pas ce qu'on croit lui envoyer.`, right ? '' : 'warn');
    } else explain(`Référence : DA OUT ${top} → CCU ${bottom}. La CCU se verrouille sur le tri-level du SPG (voyant REF IN allumé). Toutes les sorties du distributeur portent la même référence.`);
  }
  function click(k, side, id) {
    const hasConn = side === 't' ? connOfTop(k, id) : connOfBottom(k, id);
    if (!sel && hasConn != null) { unplug(k, side, id); emit('router', {}); if (k === 'refs') emit('cams'); explain(`Cordon retiré (${side === 't' ? labelTop(k, id) : labelBottom(k, id)}).`); draw(); return; }
    if (sel && sel.k === k && sel.side !== side) { const top = side === 't' ? id : sel.id; const bot = side === 'b' ? id : sel.id; sel = null; plug(k, top, bot); draw(); return; }
    sel = { k, side, id }; draw();
  }
  function drawField(k, F) {
    const host = fieldHosts[k]; host.innerHTML = '';
    const n = Math.max(F.top.length, F.bottom.length);
    const w = n * DX + 40, h = 230;
    const svg = E('svg', { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: 'img', 'aria-label': F.title }, host);
    E('rect', { x: 4, y: 4, width: w - 8, height: h - 8, rx: 6, fill: '#1b2026', stroke: '#3a434c' }, svg);
    const xt = (i) => 30 + i * DX, yt = 62, yb = 168;
    const e = expected();
    const posTop = {}, posBot = {};
    F.top.forEach((id, i) => { posTop[id] = xt(i); });
    F.bottom.forEach((id, i) => { posBot[id] = xt(i); });
    // cordons
    const cords = [];
    if (k === 'inputs') for (const b in P().inputs) cords.push([P().inputs[b], +b, e.inputs[b] === P().inputs[b]]);
    if (k === 'outputs') for (const t in P().outputs) cords.push([+t, P().outputs[t], e.outputs[t] === P().outputs[t]]);
    if (k === 'refs') for (const b in P().refs) cords.push([+P().refs[b], +b, true]);
    for (const [t, b, ok] of cords) {
      const x1 = posTop[t], x2 = posBot[b]; if (x1 == null || x2 == null) continue;
      const col = showCheck && !ok ? '#ff3b30' : F.color;
      E('path', { d: `M${x1},${yt + 8} C${x1},${yt + 70} ${x2},${yb - 70} ${x2},${yb - 8}`, fill: 'none', stroke: '#000', 'stroke-width': 6, opacity: 0.45 }, svg);
      E('path', { d: `M${x1},${yt + 8} C${x1},${yt + 70} ${x2},${yb - 70} ${x2},${yb - 8}`, fill: 'none', stroke: col, 'stroke-width': 3.5, 'stroke-dasharray': showCheck && !ok ? '6 4' : null }, svg);
    }
    const jack = (x, y, id, side, label) => {
      const g = E('g', { class: 'jack', tabindex: 0, role: 'button', 'aria-label': label }, svg);
      const on = side === 't' ? connOfTop(k, id) != null : connOfBottom(k, id) != null;
      const isSel = sel && sel.k === k && sel.side === side && sel.id === id;
      E('circle', { cx: x, cy: y, r: 13, fill: '#0b0d10', stroke: isSel ? '#ffb020' : on ? F.color : '#6b747d', 'stroke-width': isSel ? 3 : 2 }, g);
      E('circle', { cx: x, cy: y, r: 5, fill: on ? F.color : '#2a2f35' }, g);
      const ty = side === 't' ? y - 32 : y + 30;
      const txt = E('text', { x, y: ty, fill: '#cfd6dc', 'font-size': 9.5, 'font-family': 'Barlow Condensed, Arial Narrow, sans-serif', 'text-anchor': 'middle' }, g);
      const parts = label.split(' '); const last = parts.pop();
      E('tspan', { x, dy: 0 }, txt, parts.join(' ')); E('tspan', { x, dy: 11 }, txt, last);
      g.addEventListener('click', () => click(k, side, id));
      g.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); click(k, side, id); } });
    };
    F.top.forEach((id) => jack(posTop[id], yt, id, 't', labelTop(k, id)));
    F.bottom.forEach((id) => jack(posBot[id], yb, id, 'b', labelBottom(k, id)));
  }
  function draw() {
    const F = fields();
    for (const k of ['inputs', 'outputs', 'refs']) { document.getElementById('pf-' + k).textContent = F[k].title; drawField(k, F[k]); }
    const sc = patchScore();
    modeBtn.textContent = S.patch.on ? 'Repasser en car normalisé' : 'Démarrer : car vide';
    modeBtn.className = 'btn' + (S.patch.on ? '' : ' primary');
    checkBtn.textContent = showCheck ? 'Masquer la correction' : 'Afficher la correction';
    status.textContent = S.patch.on ? `${sc.ok}/${sc.total} liaisons justes · ${Math.round((S.time - t0) / 60)} min` : 'Car normalisé';
    listBox.innerHTML = '';
    const e = expected(); const p = P();
    const line = (txt, ok) => listBox.appendChild(el('div', { class: 'item' }, el('span', { class: 'dot ' + (!showCheck ? '' : ok ? 'green' : 'red') }), el('div', { class: 'grow' }, el('div', { class: 's' }, txt))));
    for (const n in e.inputs) line(`${physLabel(e.inputs[n])} → grille IN ${n} (${routerInLabel(+n)})`, p.inputs[n] === e.inputs[n]);
    for (const o in e.outputs) line(`Grille OUT ${o} → ${DEST_LABEL(e.outputs[o])}`, p.outputs[o] === e.outputs[o]);
    for (const c in e.refs) line(`DA → CCU ${c} REF IN`, !!p.refs[c]);
    if (sc.pct === 100 && S.patch.on && !S.patchDone) { S.patchDone = true; toast('Brassage complet : toutes les liaisons sont justes !', 'good', 5000); explain('Bravo : le car est entièrement brassé. Vérifie maintenant au multiview que chaque nom correspond à la bonne image (c\'est ce que fait le chef de car au line-up).'); emit('patchDone'); }
  }
  draw();
  let lk = '';
  return {
    update() {
      const k = S.cams.map((c) => c.id + c.type + c.link).join() + JSON.stringify(S.patch) + showCheck;
      if (k !== lk) { lk = k; draw(); }
    },
  };
}
