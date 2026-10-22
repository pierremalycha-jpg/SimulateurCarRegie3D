// @ts-check
import { el } from '../../../util.js';
import { numOf } from '../../engine.js';
import { section, note, etat, choix, texte, coche, touches, action, formats, formatLabel, reseau, services, suggestions, checkIp, ecrire, nomDe } from './kit.js';

// ----------------------------------------------------------------------------------
// Le menu d'un mélangeur (ATEM Television Studio HD8 ISO, Carbonite Black Solo 13) : le format,
// les bus programme et prévisualisation (avec la coupe), les entrées (ce qui arrive, nom, audio),
// les sorties (AUX de l'ATEM, sorties affectables du Carbonite), les micros, le tally à contacts
// (Carbonite), l'enregistrement ISO, le streaming et les HyperDeck pilotés (ATEM), le réseau.
// Ce que l'ATEM Software Control ou DashBoard règlent ; les clés sont celles que lit le moteur :
// format, pgm, pvw, entrees[n].nom, audio[n] / mic1, aux[n], sorties[port], tally[s], iso,
// stream { on, service, cle }, hyperdecks[i].ip, reseau.
// ----------------------------------------------------------------------------------
/** @typedef {import('./kit.js').Appareil} Appareil */
/** @typedef {import('./kit.js').Modele} Modele */
/** @typedef {import('./kit.js').Ctx} Ctx */
/** @typedef {import('../../types.js').Port} Port */

/** les entrées vidéo d'un mélangeur, numérotées comme le moteur (SDI n, puis le HDMI après le dernier SDI) */
export function entreesDe(/** @type {Modele} */ m) {
  const vin = m.ports.filter((p) => (p.sig === 'sdi' || p.sig === 'hdmi') && p.dir === 'in');
  const nSdi = vin.filter((p) => p.sig === 'sdi').length;
  return vin.map((p) => ({ p, n: numOf(p.id) || (p.sig === 'hdmi' ? nSdi + 1 : 0) })).filter((x) => x.n).sort((x, y) => x.n - y.n);
}

/** @param {Appareil} a @param {Modele} m @param {Ctx} ctx */
export function menuMelangeur(a, m, ctx) {
  const c = a.cfg; const E = ctx.E;
  const ins = entreesDe(m);
  const nomEntree = (/** @type {number} */ n) => (c.entrees && c.entrees[n] && c.entrees[n].nom) || `Entrée ${n}`;
  const fmt = c.format || (m.formats && m.formats[0]) || '';
  const flux = (/** @type {Port} */ p) => E.video[`${a.uid}:${p.id}`] || null;
  const out = [];

  // ---- format et bus ----
  const busOpts = ins.map(({ n }) => /** @type {[number, string, string]} */ ([n, String(n), `${n} · ${nomEntree(n)}`]));
  const pgm = Number(c.pgm) || 1, pvw = Number(c.pvw) || 0;
  out.push(section('Format et commutation',
    choix(a.uid, 'format', fmt, formats(m), 'Format du mélangeur', { aide: 'Toutes les entrées doivent arriver à ce format : une entrée d\'un autre format est refusée (écran noir sur ce bouton).' }),
    touches(a.uid, 'pgm', pgm, busOpts, 'Programme (PGM)', { cls: 'pgm' }),
    touches(a.uid, 'pvw', pvw, busOpts, 'Prévisualisation (PVW)', { cls: 'pvw' }),
    el('div', { class: 'ep-cf-row' }, action('CUT', () => ecrire(a.uid, { pgm: pvw || pgm, pvw: pgm }), 'primary', `${a.uid}:cut`), el('small', {}, 'La coupe échange le programme et la prévisualisation : le tally suit, si son chemin existe.'))));

  // ---- entrées ----
  const rows = el('div', { class: 'ep-cf-table', role: 'table', 'aria-label': 'Entrées' });
  for (const { p, n } of ins) {
    const f = flux(p);
    const refus = f && fmt && f.format !== fmt;
    rows.append(el('div', { class: 'ep-cf-tr' + (refus ? ' ko' : f ? ' ok' : ''), role: 'row' },
      el('b', { role: 'cell' }, `${n}`),
      el('span', { role: 'cell', class: 'ep-cf-src' }, el('small', {}, p.label), f ? `${f.label} · ${formatLabel(f.format)}${refus ? ' : refusée (format)' : ''}` : 'rien'),
      c.entrees ? el('span', { role: 'cell' }, texte(a.uid, `entrees.${n}.nom`, nomEntree(n), `Nom de l'entrée ${n}`, { max: 12 })) : null,
      c.audio ? el('span', { role: 'cell' }, choix(a.uid, `audio.${n}`, c.audio[n] != null ? c.audio[n] : 'afv', [['on', 'ON'], ['afv', 'AFV'], ['off', 'OFF']], `Son de l'entrée ${n}`)) : null));
  }
  out.push(section('Entrées',
    note(c.audio ? 'Son : ON, toujours dans le mélange ; AFV (audio follow video), seulement quand l\'entrée est au programme ; OFF, jamais.' : 'Ce qui arrive sur chaque entrée, d\'après les câbles et les sources.'),
    rows));

  // ---- sorties ----
  const vout = m.ports.filter((p) => (p.sig === 'sdi' || p.sig === 'hdmi') && p.dir === 'out');
  const roles = /** @type {Array<[any, string]>} */ ([['pgm', 'Programme'], ['pvw', 'Prévisualisation'], ['mv', 'Multiview'], ...ins.map(({ n }) => /** @type {[number, string]} */ ([n, `Entrée ${n} · ${nomEntree(n)}`]))]);
  const sorties = [];
  // un mélangeur qui a des AUX (l'ATEM) : ses autres sorties OUT n sont des retours programme fixes ; sans AUX (le Carbonite), elles s'affectent
  const affectables = !vout.some((p) => /aux-?\d/.test(p.id));
  const retours = vout.filter((p) => !affectables && /sdi-out-\d+$/.test(p.id));
  if (retours.length) sorties.push(el('p', { class: 'ep-cf-fixe' }, el('b', {}, `${retours[0].label} à ${retours[retours.length - 1].label}`), ' : retours programme vers les caméras (fixes).'));
  for (const p of vout) {
    if (retours.includes(p)) continue;
    const aux = p.id.match(/aux-?(\d+)/);
    if (aux) { const k = +aux[1]; sorties.push(choix(a.uid, `aux.${k}`, c.aux && c.aux[k] != null && c.aux[k] !== '' ? c.aux[k] : 'pgm', roles, `${p.label}`)); continue; }
    if (/pgm|mv|multiview|pvw|preview/.test(p.id)) { sorties.push(el('p', { class: 'ep-cf-fixe' }, el('b', {}, p.label), ` : ${/mv|multiview/.test(p.id) ? 'multiview' : /pvw|preview/.test(p.id) ? 'prévisualisation' : 'programme'} (fixe)`)); continue; }
    if (/hdmi/.test(p.id) && !/sdi-out-\d/.test(p.id) && m.ports.some((q) => /mv|multiview/.test(q.id))) { sorties.push(el('p', { class: 'ep-cf-fixe' }, el('b', {}, p.label), ' : multiview (comme la sortie SDI MULTIVIEW)')); continue; }
    const cur = c.sorties && c.sorties[p.id] != null ? c.sorties[p.id] : 'pgm';
    sorties.push(choix(a.uid, `sorties.${p.id}`, cur, roles, p.label));
  }
  if (sorties.length) out.push(section('Sorties', note('Une sortie auxiliaire (AUX, OUT n) reçoit ce qu\'on lui affecte : le programme pour un enregistreur, le multiview pour le moniteur de la régie, une caméra pour un retour.'), ...sorties));

  // ---- micros ----
  const mics = m.ports.filter((p) => p.sig === 'audio' && p.dir === 'in');
  if (mics.length && c.audio) out.push(section('Micros', note('Les entrées XLR du mélangeur : un micro branché ici entre dans le programme si son entrée est sur ON (ou AFV, suivie comme une entrée vidéo).'),
    ...mics.map((p, i) => choix(a.uid, `audio.mic${i + 1}`, c.audio[`mic${i + 1}`] || 'off', [['on', 'ON'], ['afv', 'AFV'], ['off', 'OFF']], p.label))));

  // ---- tally à contacts (Carbonite) ----
  if (c.tally && typeof c.tally === 'object') {
    const t = el('div', { class: 'ep-cf-grid' });
    for (let s = 1; s <= Math.max(ins.length, 8); s++) t.append(choix(a.uid, `tally.${s}`, Number(c.tally[s]) || 0, [[0, '—'], ...ins.map(({ n }) => /** @type {[number, string]} */ ([n, `entrée ${n}`]))], `Contact ${s}`));
    out.push(section('Tally (prise TALLY)', note('Chaque contact de la prise TALLY (D-sub 25) se ferme quand l\'entrée qu\'on lui associe est au programme. Câblée vers TALLY/GPIO 1 du pupitre : contact n → emplacement n du pupitre.'), t));
  }

  // ---- enregistrement, streaming, HyperDeck (ATEM) ----
  if ('iso' in c) out.push(section('Enregistrement ISO', note('L\'ATEM enregistre le programme et chaque entrée (ISO) en H.264 sur un disque USB-C branché sur USB-C 1 ou 2, avec un projet DaVinci Resolve.'),
    coche(a.uid, 'iso', !!c.iso, 'Enregistrer les ISO et le programme'), ...services(ctx, `${a.uid}:iso`)));
  if (c.stream && typeof c.stream === 'object') out.push(section('Streaming', note('Le mélangeur diffuse lui-même son programme en RTMP : il lui faut une passerelle (la box) et un accès Internet. Réglages : onglet Output de l\'ATEM Software Control.'),
    coche(a.uid, 'stream.on', !!c.stream.on, 'Diffuser (ON AIR)'),
    choix(a.uid, 'stream.service', c.stream.service || 'YouTube', [['YouTube', 'YouTube'], ['Twitch', 'Twitch'], ['Facebook', 'Facebook'], ['Personnalisé', 'Serveur RTMP personnalisé']], 'Plateforme'),
    texte(a.uid, 'stream.cle', c.stream.cle, 'Clé de diffusion', { placeholder: 'xxxx-xxxx-xxxx-xxxx', mono: true, aide: 'Donnée par la plateforme ; elle identifie la chaîne, ne la publiez pas.' }),
    ...services(ctx, `${a.uid}:rtmp:`)));
  if (Array.isArray(c.hyperdecks)) {
    const dl = `ep-dl-hd-${a.uid}`;
    out.push(section('HyperDeck pilotés', note('L\'ATEM lance et arrête l\'enregistrement des HyperDeck par le réseau (TCP 9993) : il faut leur adresse, et « Remote » sur ON dans chaque HyperDeck.'),
      suggestions(ctx, dl, (x, mo) => mo.famille === 'enregistreur'),
      ...c.hyperdecks.map((h, i) => texte(a.uid, `hyperdecks.${i}.ip`, h ? h.ip : '', `HyperDeck ${i + 1}`, { mono: true, list: dl, check: checkIp, placeholder: 'adresse' })),
      ...services(ctx, `${a.uid}:hyperdeck:`)));
  }
  out.push(reseau(a, ctx, { menu: /atem/.test(m.id) ? 'ATEM Setup (par USB ou par le réseau) → Configure → Network. L\'ATEM sort du carton en DHCP.' : 'DashBoard → Configuration → Network.' }));
  const pc = Object.entries(E.services).filter(([k, s]) => k.includes(`:${/atem/.test(m.id) ? 'atem' : 'rosstalk'}:${a.uid}`) && s.ok).map(([k]) => nomDe(k.split(':')[0]));
  if (pc.length) out.push(section('Pilotage', etat(true, `Piloté par ${pc.join(', ')}.`)));
  return out;
}
