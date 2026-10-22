// @ts-check
import { el } from '../../util.js';
import { CATALOGUE } from '../catalogue/index.js';

// ----------------------------------------------------------------------------------
// Le panneau réseau : les appareils qui ont une interface IP, leur adresse effective (fixe, DHCP,
// lien local), le domaine de niveau 2, les conflits, qui joint qui, et un ping. Le rédacteur
// « panneaux » écrit la version complète ; ci-dessous le tableau de base.
// ----------------------------------------------------------------------------------
/** @typedef {import('./stock.js').Ctx} Ctx */

/** @param {Ctx} ctx */
export function renderReseau(ctx) {
  const box = el('div', { class: 'ep-net' });
  const rows = ctx.B.appareils.filter((a) => (CATALOGUE[a.modele] || {}).reseau);
  if (!rows.length) { box.append(el('p', { class: 'note' }, 'Aucun appareil réseau dans le montage.')); return box; }
  const t = el('table', { class: 'ep-table' }, el('thead', {}, el('tr', {}, ...['Appareil', 'Adresse', 'Masque', 'Passerelle', 'Lien'].map((h) => el('th', {}, h)))));
  const tb = el('tbody');
  for (const a of rows) {
    const ip = ctx.E.ip[a.uid] || { ip: a.cfg && a.cfg.reseau ? a.cfg.reseau.ip : '', mask: a.cfg && a.cfg.reseau ? a.cfg.reseau.mask : '', gw: a.cfg && a.cfg.reseau ? a.cfg.reseau.gw : '', dhcp: !!(a.cfg && a.cfg.reseau && a.cfg.reseau.dhcp), link: false, conflit: false, domaine: '' };
    tb.append(el('tr', { class: ip.conflit ? 'ko' : '' }, el('td', {}, el('button', { type: 'button', class: 'linkbtn', onclick: () => ctx.open(a.uid) }, a.nom)), el('td', {}, ip.ip + (ip.dhcp ? ' (DHCP)' : '') + (ip.conflit ? ' · conflit' : '')), el('td', {}, ip.mask), el('td', {}, ip.gw || '—'), el('td', {}, ip.link ? 'lien' : 'pas de lien')));
  }
  t.append(tb); box.append(t);
  return box;
}
