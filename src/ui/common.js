import { el } from '../util.js';
import { S, emit } from '../state.js';
import { STATION_INFO } from '../data.js';

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

let toastT = 0;
export function toast(msg, kind = '', ms = 3200) {
  const t = $('#toast'); if (!t) return;
  t.textContent = msg; t.className = kind; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms);
}

export function intercom(who, msg, kind = '') {
  const box = $('#intercom'); if (!box) return;
  const d = el('div', { class: 'icm ' + kind }, el('b', {}, who), msg);
  box.appendChild(d);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => d.remove(), 7000);
  emit('intercom', { who, msg });
}

export const modal = {
  open(title, body, opts = {}) {
    const m = $('#modal'); m.innerHTML = '';
    const close = el('button', { class: 'x', 'aria-label': 'Fermer', onclick: () => modal.close() }, '×');
    const sheet = el('div', { class: 'sheet', style: opts.width ? { width: `min(${opts.width}px, 100%)` } : {} },
      el('header', {}, el('h2', {}, title), ...(opts.headerExtra || []), close),
      el('div', { class: 'body' }, body));
    m.appendChild(sheet); m.hidden = false;
    m.onclick = (e) => { if (e.target === m) modal.close(); };
    S.modalOpen = true;
    modal._onClose = opts.onClose || null;
    if (document.pointerLockElement) document.exitPointerLock();
    return sheet;
  },
  close() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; S.modalOpen = false; const f = modal._onClose; modal._onClose = null; if (f) { try { f(); } catch (e) { console.error(e); } } emit('modalclose'); },
  get isOpen() { return !$('#modal').hidden; },
};

export function infoBody(id) {
  const I = STATION_INFO[id];
  if (!I) return el('p', {}, 'Pas d\'information.');
  const sec = (t, arr) => arr && arr.length ? el('div', {}, el('h3', {}, t), el('ul', { class: 'steps' }, arr.map((x) => el('li', {}, x)))) : null;
  return el('div', { class: 'prose' },
    el('p', {}, el('b', {}, I.where ? I.where + ' — ' : ''), I.role),
    sec('Le matériel', I.gear), sec('Le déroulé', I.process), sec('Repères et pièges', I.tips));
}
export function openInfo(id) {
  const I = STATION_INFO[id]; if (!I) return;
  S.openedInfo[id] = true; emit('info', id);
  modal.open(I.title, infoBody(id), { width: 760 });
}

export function hwBtn(label, opts = {}) {
  const b = el('button', { class: 'hw ' + (opts.cls || ''), title: opts.title || '', onclick: opts.onclick }, label);
  if (opts.sub) b.appendChild(el('small', {}, opts.sub));
  return b;
}
export function knob(label, min, max, step, value, onInput, fmtv = (v) => v) {
  const id = 'k' + Math.random().toString(36).slice(2, 8);
  const b = el('b', {}, fmtv(value));
  const inp = el('input', { type: 'range', min, max, step, value, id });
  inp.addEventListener('input', () => { const v = +inp.value; b.textContent = fmtv(v); onInput(v); });
  const w = el('div', { class: 'knob' }, el('label', { for: id }, label, b), inp);
  w.set = (v) => { if (document.activeElement !== inp) { inp.value = v; b.textContent = fmtv(v); } };
  return w;
}
export function selectEl(options, value, onChange, id) {
  const s = el('select', { id: id || 's' + Math.random().toString(36).slice(2, 8) });
  for (const [v, l] of options) { const o = el('option', { value: v }, l); if (String(v) === String(value)) o.selected = true; s.appendChild(o); }
  s.addEventListener('change', () => onChange(s.value));
  return s;
}
export function field(label, input) { const id = input.id || ('f' + Math.random().toString(36).slice(2, 8)); input.id = id; return el('div', { class: 'field' }, el('label', { for: id }, label), input); }
export function monitor(src, size = 'med', label = '') {
  return el('div', { class: 'monwrap' }, label ? el('div', { class: 'lab' }, label) : null, el('div', { class: 'mon ' + size, 'data-gl': src }));
}
