// @ts-check
import { el } from '../../util.js';
import { CATALOGUE } from '../catalogue/index.js';
import { explainReach, parseIp, parseMask, netOf, ipStr, linkLocal } from '../engine.js';

// ----------------------------------------------------------------------------------
// Le panneau réseau : les appareils qui ont une interface IP, rangés par domaine de niveau 2
// (un switch et un VLAN, le switch interne d'un appareil, une liaison directe), avec leur adresse
// effective (fixe, servie par le DHCP, lien local faute de serveur), les sous-réseaux présents,
// les conflits ; un ping d'un appareil vers un autre, qui dit pourquoi il échoue (explainReach) ;
// et le tableau « qui joint qui ».
// ----------------------------------------------------------------------------------
/** @typedef {import('./stock.js').Ctx} Ctx */

/** le ping choisi : gardé d'un dessin à l'autre */
const PING = { de: '', vers: '', fait: false };
const sousReseau = (/** @type {{ ip: string, mask: string }} */ x) => { const n = parseIp(x.ip), p = parseMask(x.mask); return n == null || p == null ? '' : `${ipStr(netOf(n, p))}/${p}`; };

/** @param {Ctx} ctx */
export function renderReseau(ctx) {
  const box = el('div', { class: 'ep-net' });
  const E = ctx.E;
  const rows = ctx.B.appareils.filter((a) => E.ip[a.uid]);
  if (!rows.length) { box.append(el('p', { class: 'note' }, 'Aucun appareil réseau dans le montage.')); return box; }
  // ---- par domaine ----
  const doms = new Map();
  for (const a of rows) { const d = E.ip[a.uid].link ? E.ip[a.uid].domaine || '(sans nom)' : 'Sans lien réseau'; if (!doms.has(d)) doms.set(d, []); doms.get(d).push(a); }
  box.append(el('p', { class: 'note' }, 'Un domaine de niveau 2 réunit ce qui se voit sans routeur : les ports d\'un même switch et d\'un même VLAN. Deux appareils se joignent s\'ils sont dans le même domaine ET dans le même sous-réseau (adresse et masque).'));
  for (const [d, l] of doms) {
    const sr = [...new Set(l.filter((a) => E.ip[a.uid].link).map((a) => sousReseau(E.ip[a.uid])).filter(Boolean))];
    // le sous-réseau le plus peuplé du domaine : les autres sont signalés
    const compte = (/** @type {string} */ x) => l.filter((a) => sousReseau(E.ip[a.uid]) === x).length;
    const principal = sr.slice().sort((x, y) => compte(y) - compte(x))[0] || '';
    const t = el('table', { class: 'ep-table' }, el('thead', {}, el('tr', {}, ...['Appareil', 'Adresse', 'Masque', 'Passerelle'].map((h) => el('th', { scope: 'col' }, h)))));
    const tb = el('tbody');
    for (const a of l) {
      const ip = E.ip[a.uid];
      const hors = sr.length > 1 && ip.link && sousReseau(ip) !== principal;
      const etat = ip.conflit ? ' · conflit' : ip.dhcp && linkLocal(ip.ip) ? ' · lien local' : hors ? ' · hors du sous-réseau ' + principal : ip.dhcp ? ' (DHCP)' : '';
      tb.append(el('tr', { class: ip.conflit || (ip.dhcp && linkLocal(ip.ip)) || hors ? 'ko' : '' },
        el('td', {}, el('button', { type: 'button', class: 'linkbtn', onclick: () => ctx.open(a.uid) }, a.nom), el('small', {}, ` ${(CATALOGUE[a.modele] || { court: '' }).court}`)),
        el('td', { class: 'mono' }, (ip.ip || '—') + etat), el('td', { class: 'mono' }, ip.mask || '—'), el('td', { class: 'mono' }, ip.gw || '—')));
    }
    t.append(tb);
    box.append(el('section', { class: 'ep-cf' }, el('h4', {}, d),
      d !== 'Sans lien réseau' ? el('p', { class: 'ep-cf-note' }, sr.length > 1 ? `${sr.length} sous-réseaux dans ce domaine (${sr.join(', ')}) : ils ne se joignent pas entre eux sans routeur.` : sr.length ? `Sous-réseau ${sr[0]}.` : '') : el('p', { class: 'ep-cf-note' }, 'Pas de câble RJ45 actif, ou l\'appareil en face n\'est pas alimenté.'),
      t));
  }
  // ---- ping ----
  const ids = rows.map((a) => a.uid);
  if (!ids.includes(PING.de)) PING.de = ids[0];
  if (!ids.includes(PING.vers) || PING.vers === PING.de) PING.vers = ids.find((x) => x !== PING.de) || '';
  const sel = (/** @type {'de' | 'vers'} */ k, /** @type {string} */ label) => {
    const s = el('select', { 'aria-label': label, 'data-k': `ping:${k}` }, ...rows.map((a) => { const o = el('option', { value: a.uid }, `${a.nom} (${E.ip[a.uid].ip || 'sans adresse'})`); if (a.uid === PING[k]) o.selected = true; return o; }));
    s.addEventListener('change', () => { PING[k] = s.value; PING.fait = false; out.replaceChildren(); });
    return s;
  };
  const out = el('pre', { class: 'ep-ping', 'aria-live': 'polite' });
  const ping = () => {
    const a = PING.de, b = PING.vers; if (!a || !b || a === b) return;
    const A = rows.find((x) => x.uid === a); PING.fait = true;
    const ok = !!E.reach[`${a}>${b}`]; const dst = E.ip[b].ip || '?';
    const lignes = [`${A.nom}> ping ${dst}`, '', `Envoi d'une requête « ping » sur ${dst} avec 32 octets de données :`];
    for (let i = 0; i < 4; i++) lignes.push(ok ? `Réponse de ${dst} : octets=32 temps<1ms TTL=64` : 'Délai d\'attente de la demande dépassé.');
    lignes.push('', `Statistiques Ping pour ${dst} : envoyés = 4, reçus = ${ok ? 4 : 0}, perdus = ${ok ? 0 : 4} (${ok ? 0 : 100} % de perte)`);
    out.textContent = lignes.join('\n');
    out.append(el('span', { class: 'ep-ping-why ' + (ok ? 'ok' : 'ko') }, '\n' + (ok ? 'Pourquoi ça répond : ' : 'Pourquoi ça ne répond pas : ') + explainReach(ctx.B, E, a, b)));
  };
  box.append(el('section', { class: 'ep-cf' }, el('h4', {}, 'Ping'),
    el('p', { class: 'ep-cf-note' }, 'Comme dans l\'invite de commandes du PC : une requête ICMP vers une adresse, et la réponse (ou le délai dépassé). Le simulateur dit en plus pourquoi.'),
    el('div', { class: 'ep-cf-row' }, sel('de', 'Depuis'), el('span', {}, '→'), sel('vers', 'Vers'), el('button', { type: 'button', class: 'btn small primary', 'data-k': 'ping:go', onclick: ping }, 'Ping')),
    out));
  // un ping déjà lancé se relance sur le montage modifié
  if (PING.fait) ping();
  // ---- qui joint qui ----
  if (rows.length >= 2 && rows.length <= 16) {
    const t = el('table', { class: 'ep-table ep-matrix' }, el('thead', {}, el('tr', {}, el('th', {}, ''), ...rows.map((a) => el('th', { scope: 'col', title: a.nom }, a.nom.slice(0, 8))))));
    const tb = el('tbody');
    for (const a of rows) tb.append(el('tr', {}, el('th', { scope: 'row' }, a.nom), ...rows.map((b) => a.uid === b.uid ? el('td', { class: 'self' }, '·') : el('td', { class: E.reach[`${a.uid}>${b.uid}`] ? 'ok' : 'ko', title: explainReach(ctx.B, E, a.uid, b.uid) }, E.reach[`${a.uid}>${b.uid}`] ? '✓' : '✗'))));
    t.append(tb);
    box.append(el('details', { class: 'ep-cf' }, el('summary', {}, 'Qui joint qui'), el('p', { class: 'ep-cf-note' }, 'Ligne : depuis ; colonne : vers. Survole une case pour l\'explication.'), el('div', { class: 'ep-matrix-wrap' }, t)));
  }
  return box;
}
