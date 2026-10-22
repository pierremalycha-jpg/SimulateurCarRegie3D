// @ts-check
import { el } from '../../../util.js';
import { CATALOGUE } from '../../catalogue/index.js';
import { cablesDe, autreBout, appareil } from '../../build.js';
import { switchPortNum } from '../../engine.js';
import { section, note, etat, choix, texte, coche, action, reseau, checkIp, checkMask, ecrire } from './kit.js';

// ----------------------------------------------------------------------------------
// Les menus du réseau : le switch NETGEAR M4250 (VLAN de chaque port, PoE+ par port, budget
// PoE+, VLAN déclarés, adresse d'administration) et la box d'accès Internet (adresse LAN, serveur
// DHCP et sa plage, liaison WAN). Clés lues par le moteur : ports[n].vlan / poe, vlans, poeBudget
// (switch) ; lan.ip / mask / dhcp { on, de, a }, wan (routeur) ; reseau.
// ----------------------------------------------------------------------------------
/** @typedef {import('./kit.js').Appareil} Appareil */
/** @typedef {import('./kit.js').Modele} Modele */
/** @typedef {import('./kit.js').Ctx} Ctx */

/** @param {Appareil} a @param {Modele} m @param {Ctx} ctx */
export function menuSwitch(a, m, ctx) {
  const c = a.cfg; const E = ctx.E;
  const vlans = Object.keys(c.vlans || { 1: 'default' }).map(Number).sort((x, y) => x - y);
  const P = E.poe[a.uid];
  // les ports : ce qui est branché, le VLAN, le PoE+
  const rows = el('div', { class: 'ep-cf-table ep-cf-ports', role: 'table', 'aria-label': 'Ports du switch' });
  for (const p of m.ports.filter((q) => q.sig === 'ip')) {
    const n = switchPortNum(p.id); const pc = (c.ports || {})[n]; if (!pc) continue;
    const cb = cablesDe(a.uid, p.id)[0]; const o = cb ? autreBout(cb, a.uid) : null; const oa = o ? appareil(o.dev) : null;
    const pw = oa && E.power[oa.uid] && /PoE\+/.test(E.power[oa.uid].source) && E.power[oa.uid].source.includes(a.nom) ? E.power[oa.uid].watts : 0;
    rows.append(el('div', { class: 'ep-cf-tr' + (oa ? ' ok' : ''), role: 'row' },
      el('b', { role: 'cell' }, p.label),
      el('span', { role: 'cell', class: 'ep-cf-src' }, oa ? `${oa.nom}${pw ? ` · PoE+ ${pw} W` : ''}` : '—'),
      el('span', { role: 'cell' }, choix(a.uid, `ports.${n}.vlan`, pc.vlan != null ? Number(pc.vlan) : 1, vlans.map((v) => /** @type {[number, string]} */ ([v, `VLAN ${v}`])), `VLAN du port ${p.label}`)),
      p.poe ? el('span', { role: 'cell' }, coche(a.uid, `ports.${n}.poe`, pc.poe !== false, 'PoE+')) : el('span', { role: 'cell' })));
  }
  // les VLAN déclarés : en ajouter un, en retirer un (sauf le 1)
  const nouveau = el('input', { type: 'number', min: '2', max: '4094', placeholder: '20', 'aria-label': 'Numéro du VLAN à créer', 'data-k': `${a.uid}:vlan-new` });
  const nomV = el('input', { type: 'text', placeholder: 'video', maxlength: '16', 'aria-label': 'Nom du VLAN', 'data-k': `${a.uid}:vlan-nom` });
  const ajouter = () => { const v = Math.round(Number(nouveau.value)); if (!(v >= 2 && v <= 4094)) { ctx.say('Un VLAN se numérote de 2 à 4094 (le 1 existe déjà).'); return; } ecrire(a.uid, { [`vlans.${v}`]: nomV.value.trim() || `vlan${v}` }); };
  const listeV = el('ul', { class: 'ep-cf-list' }, ...vlans.map((v) => el('li', {}, el('span', {}, `VLAN ${v} · ${(c.vlans || {})[v] || ''}`),
    v === 1 ? el('small', {}, 'par défaut') : action('Retirer', () => {
      const vl = { ...(c.vlans || {}) }; delete vl[v];
      const patch = { vlans: vl }; for (const [n, pc] of Object.entries(c.ports || {})) if (Number(pc.vlan) === v) patch[`ports.${n}.vlan`] = 1;
      ecrire(a.uid, patch);
    }, '', `${a.uid}:vlan-del:${v}`))));
  return [
    section('PoE+',
      note('Le switch alimente par le câble RJ45 les appareils qui l\'acceptent (caméras PTZ, pupitre) : 30 W au plus par port (IEEE 802.3at), dans la limite de son budget total.'),
      P ? etat(P.ok, `${P.used} W demandés sur ${P.budget} W de budget${P.ok ? '' : ' : dépassé, des appareils restent éteints ou redémarrent'}.`) : null),
    section('Ports', note('Les ports d\'un même VLAN forment un réseau (domaine de niveau 2) ; deux VLAN sont séparés comme deux switchs. Tout est en VLAN 1 à la sortie du carton.'), rows),
    section('VLAN', listeV, el('div', { class: 'ep-cf-row' }, nouveau, nomV, action('Créer le VLAN', ajouter, '', `${a.uid}:vlan-add`))),
    reseau(a, ctx, { titre: 'Adresse d\'administration', menu: 'L\'interface web du switch (NETGEAR Engage ou la page du M4250). Sans serveur DHCP, il prend 169.254.100.100.' }),
  ].filter(Boolean).map((x) => /** @type {HTMLElement} */ (x));
}

/** @param {Appareil} a @param {Modele} m @param {Ctx} ctx */
export function menuRouteur(a, m, ctx) {
  const c = a.cfg; const lan = c.lan || {}; const d = lan.dhcp || {};
  const nb = Object.values(ctx.E.ip).filter((x) => x.dhcp && x.gw === lan.ip && x.link).length;
  return [
    section('Réseau local (LAN)',
      note('Page d\'administration de la box (http://192.168.1.1, par exemple). Son adresse LAN est la passerelle des appareils qui veulent sortir sur Internet.'),
      texte(a.uid, 'lan.ip', lan.ip, 'Adresse LAN', { mono: true, check: checkIp, set: (v) => ecrire(a.uid, { 'lan.ip': v, 'reseau.ip': v }) }),
      texte(a.uid, 'lan.mask', lan.mask, 'Masque', { mono: true, check: checkMask, set: (v) => ecrire(a.uid, { 'lan.mask': v, 'reseau.mask': v }) })),
    section('Serveur DHCP',
      note('La box donne une adresse, un masque et sa propre adresse comme passerelle à chaque appareil réglé en DHCP, pris dans la plage ci-dessous (dernier octet). Les adresses fixes se choisissent hors de cette plage.'),
      coche(a.uid, 'lan.dhcp.on', d.on !== false, 'Serveur DHCP actif'),
      el('div', { class: 'ep-cf-row' },
        texte(a.uid, 'lan.dhcp.de', d.de != null ? d.de : 100, 'Plage : de', { mono: true, max: 3, set: (v) => ecrire(a.uid, { 'lan.dhcp.de': Math.max(1, Math.min(254, Math.round(Number(v)) || 100)) }) }),
        texte(a.uid, 'lan.dhcp.a', d.a != null ? d.a : 199, 'à', { mono: true, max: 3, set: (v) => ecrire(a.uid, { 'lan.dhcp.a': Math.max(1, Math.min(254, Math.round(Number(v)) || 199)) }) })),
      etat(null, `${nb} appareil${nb > 1 ? 's ont' : ' a'} reçu une adresse de ce serveur.`)),
    section('Internet (WAN)',
      choix(a.uid, 'wan', c.wan || 'aucun', [['fibre', 'Fibre (ONT branché sur WAN)'], ['4g', '4G (modem intégré)'], ['aucun', 'Aucun accès']], 'Liaison', { aide: 'Sans accès, le streaming et la diffusion RTMP échouent.' })),
  ];
}
export const estSwitch = (/** @type {string} */ id) => !!CATALOGUE[id] && !!(CATALOGUE[id].cfg || {}).ports;
