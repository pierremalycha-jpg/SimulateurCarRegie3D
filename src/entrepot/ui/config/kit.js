// @ts-check
import { el } from '../../../util.js';
import { regler, appareil } from '../../build.js';
import { CATALOGUE } from '../../catalogue/index.js';
import { parseIp, parseMask, linkLocal } from '../../engine.js';

// ----------------------------------------------------------------------------------
// La boîte à outils des menus de configuration de l'entrepôt : une section, une ligne de réglage
// (liste, champ, case, touches), l'état constaté par le moteur, et la section « Réseau » commune à
// tout appareil qui a une adresse IP. Chaque contrôle écrit dans la configuration de l'appareil
// par build.js (regler) : le montage change de version, le moteur recalcule, le panneau se
// redessine. Chaque contrôle porte data-k (appareil:clé) pour que le panneau lui rende le focus
// après ce nouveau dessin.
// ----------------------------------------------------------------------------------
/** @typedef {import('../../types.js').Appareil} Appareil */
/** @typedef {import('../../types.js').Modele} Modele */
/** @typedef {import('../stock.js').Ctx} Ctx */

/** une valeur dans la configuration, par un chemin « a.b.c » */
export function lire(/** @type {Record<string, any>} */ cfg, /** @type {string} */ path) {
  let o = cfg; for (const k of path.split('.')) { if (o == null) return undefined; o = o[k]; } return o;
}
/** écrit une ou plusieurs clés (chemins « a.b ») dans la configuration d'un appareil */
export const ecrire = (/** @type {string} */ uid, /** @type {Record<string, any>} */ patch) => regler(uid, patch);

/** une section du menu : un titre, des lignes, une note facultative */
export function section(/** @type {string} */ titre, ...kids) {
  return el('section', { class: 'ep-cf' }, el('h4', {}, titre), ...kids);
}
/** une note sous une section (le pourquoi, le menu du vrai appareil) */
export const note = (/** @type {string} */ t) => el('p', { class: 'ep-cf-note' }, t);
/** l'état d'un service ou d'une fonction, tel que le moteur l'a constaté */
export function etat(/** @type {boolean | null} */ ok, /** @type {string} */ texte) {
  return el('p', { class: 'ep-cf-etat ' + (ok == null ? 'neutre' : ok ? 'ok' : 'ko') }, el('i', { 'aria-hidden': 'true' }), el('span', {}, texte));
}
/** une ligne : libellé, contrôle, aide (le libellé enveloppe le contrôle) */
function ligne(/** @type {string} */ label, /** @type {HTMLElement} */ ctrl, aide = '', err = '') {
  return el('label', { class: 'ep-cf-l' + (err ? ' err' : '') }, el('span', { class: 'ep-cf-lab' }, label), ctrl, err ? el('small', { class: 'ep-cf-err' }, err) : aide ? el('small', {}, aide) : null);
}

/**
 * Une liste de choix. options : [valeur, texte] ; la valeur écrite garde son type (nombre, texte).
 * @param {string} uid @param {string} path @param {any} value @param {Array<[any, string]>} options @param {string} label
 * @param {{ aide?: string, set?: (v: any) => void }} [o]
 */
export function choix(uid, path, value, options, label, o = {}) {
  const s = el('select', { 'data-k': `${uid}:${path}` });
  let found = false;
  options.forEach(([v, t], i) => { const op = el('option', { value: String(i) }, t); if (String(v) === String(value)) { op.selected = true; found = true; } s.append(op); });
  if (!found && value != null && value !== '') { const op = el('option', { value: '-1' }, `${value} (réglage actuel)`); op.selected = true; s.prepend(op); }
  s.addEventListener('change', () => { const i = +s.value; if (i < 0) return; const v = options[i][0]; if (o.set) o.set(v); else ecrire(uid, { [path]: v }); });
  return ligne(label, s, o.aide);
}
/**
 * Un champ de texte, écrit à la validation (Entrée ou sortie du champ).
 * @param {string} uid @param {string} path @param {any} value @param {string} label
 * @param {{ aide?: string, placeholder?: string, check?: (v: string) => string, set?: (v: string) => void, list?: string, mono?: boolean, max?: number }} [o]
 */
export function texte(uid, path, value, label, o = {}) {
  const v = value == null ? '' : String(value);
  const i = el('input', { type: 'text', value: v, 'data-k': `${uid}:${path}`, placeholder: o.placeholder || '', spellcheck: 'false', autocomplete: 'off', list: o.list || null, maxlength: String(o.max || 64), class: o.mono ? 'mono' : null });
  i.addEventListener('change', () => { const t = i.value.trim(); if (o.set) o.set(t); else ecrire(uid, { [path]: t }); });
  i.addEventListener('keydown', (e) => { if (e.key === 'Enter') i.blur(); });
  return ligne(label, i, o.aide, o.check && v ? o.check(v) : '');
}
/** une case à cocher (marche / arrêt d'une fonction) */
export function coche(/** @type {string} */ uid, /** @type {string} */ path, /** @type {boolean} */ value, /** @type {string} */ label, /** @type {{ aide?: string, set?: (v: boolean) => void }} */ o = {}) {
  const c = el('input', { type: 'checkbox', 'data-k': `${uid}:${path}` });
  c.checked = !!value;
  c.addEventListener('change', () => { if (o.set) o.set(c.checked); else ecrire(uid, { [path]: c.checked }); });
  return el('label', { class: 'ep-cf-c' }, c, el('span', {}, label), o.aide ? el('small', {}, o.aide) : null);
}
/**
 * Une rangée de touches à bascule, comme sur un pupitre (une seule allumée).
 * @param {string} uid @param {string} path @param {any} value @param {Array<[any, string, string?]>} options [valeur, texte, titre]
 * @param {string} label @param {{ cls?: string, set?: (v: any) => void }} [o]
 */
export function touches(uid, path, value, options, label, o = {}) {
  const box = el('div', { class: 'ep-cf-keys ' + (o.cls || ''), role: 'group', 'aria-label': label });
  for (const [v, t, title] of options) {
    const on = String(v) === String(value);
    box.append(el('button', { type: 'button', 'aria-pressed': String(on), title: title || t, 'data-k': `${uid}:${path}:${v}`, onclick: () => { if (o.set) o.set(v); else ecrire(uid, { [path]: v }); } }, t));
  }
  return el('div', { class: 'ep-cf-l' }, el('span', { class: 'ep-cf-lab' }, label), box);
}
/** un bouton d'action dans un menu */
export const action = (/** @type {string} */ label, /** @type {() => void} */ f, cls = '', k = '') => el('button', { type: 'button', class: 'btn small ' + cls, onclick: f, 'data-k': k || null }, label);

/** le libellé d'un format : 1080i50 → 1080/50i, 1080p59 → 1080/59,94p */
export function formatLabel(/** @type {string} */ f) {
  const m = String(f || '').match(/^(\d+)([ip])(\d+)$/); if (!m) return String(f || '');
  const hz = m[3] === '59' ? '59,94' : m[3] === '29' ? '29,97' : m[3];
  return `${m[1]}/${hz}${m[2]}`;
}
/** les formats d'un modèle, en options */
export const formats = (/** @type {Modele} */ m) => (m.formats || []).map((f) => /** @type {[string, string]} */ ([f, formatLabel(f)]));

/** vérifie une adresse IPv4 (texte vide si elle est bonne) */
export const checkIp = (/** @type {string} */ v) => (parseIp(v) == null ? 'Adresse invalide : quatre nombres de 0 à 255 séparés par des points.' : '');
export const checkMask = (/** @type {string} */ v) => (parseMask(v) == null ? 'Masque invalide : 255.255.255.0 (/24), par exemple, ou /24.' : '');

/** les adresses effectives des appareils du montage, pour une liste de suggestions (<datalist>) */
export function suggestions(/** @type {Ctx} */ ctx, /** @type {string} */ id, /** @type {(a: Appareil, m: Modele) => boolean} */ filtre) {
  const dl = el('datalist', { id });
  for (const a of ctx.B.appareils) {
    const m = CATALOGUE[a.modele]; const ip = ctx.E.ip[a.uid];
    if (!m || !ip || !ip.ip || !filtre(a, m)) continue;
    dl.append(el('option', { value: ip.ip }, `${a.nom} (${m.court})`));
  }
  return dl;
}

/**
 * La section « Réseau » : DHCP ou adresse fixe, masque, passerelle, et l'adresse effective que le
 * moteur a calculée (DHCP servi par la box, lien local faute de serveur, conflit, domaine).
 * @param {Appareil} a @param {Ctx} ctx @param {{ titre?: string, menu?: string }} [o]
 */
export function reseau(a, ctx, o = {}) {
  const r = a.cfg.reseau || {}; const E = ctx.E.ip[a.uid];
  const kids = [];
  if (o.menu) kids.push(note(o.menu));
  kids.push(coche(a.uid, 'reseau.dhcp', !!r.dhcp, 'Adresse automatique (DHCP)', { aide: 'Coché : l\'appareil demande une adresse au serveur DHCP du réseau (la box). Décoché : l\'adresse fixe ci-dessous.' }));
  if (!r.dhcp) {
    kids.push(
      texte(a.uid, 'reseau.ip', r.ip, 'Adresse IP', { check: checkIp, mono: true, placeholder: '192.168.10.11' }),
      texte(a.uid, 'reseau.mask', r.mask, 'Masque', { check: checkMask, mono: true, placeholder: '255.255.255.0' }),
      texte(a.uid, 'reseau.gw', r.gw, 'Passerelle', { check: (v) => (v ? checkIp(v) : ''), mono: true, placeholder: 'vide, ou l\'adresse de la box', aide: 'Seulement pour sortir du sous-réseau (Internet, streaming) : l\'adresse LAN du routeur.' }));
  }
  if (E) {
    const t = !E.link ? 'Pas de lien réseau : aucun câble RJ45 actif, ou l\'appareil en face n\'est pas alimenté.'
      : `Adresse effective : ${E.ip || '(aucune)'} / ${E.mask || '?'}${E.gw ? ', passerelle ' + E.gw : ''}${E.dhcp ? (linkLocal(E.ip) ? ' (lien local : aucun serveur DHCP n\'a répondu)' : ' (servie par le DHCP)') : ''}${E.conflit ? ' · CONFLIT D\'ADRESSE' : ''}${E.domaine ? ' · ' + E.domaine : ''}.`;
    kids.push(etat(E.link && !E.conflit && !(E.dhcp && linkLocal(E.ip)), t));
  }
  return section(o.titre || 'Réseau', ...kids);
}

/** l'état d'un ou plusieurs services du moteur dont la clé commence par `prefixe` */
export function services(/** @type {Ctx} */ ctx, /** @type {string} */ prefixe, vide = '') {
  const l = Object.entries(ctx.E.services).filter(([k]) => k.startsWith(prefixe));
  if (!l.length) return vide ? [etat(null, vide)] : [];
  return l.map(([, s]) => etat(s.ok, s.ok ? s.label : `${s.label} : ${s.why}`));
}
/** le nom d'un appareil (par son uid) */
export const nomDe = (/** @type {string} */ uid) => { const a = appareil(uid); return a ? a.nom : '?'; };
