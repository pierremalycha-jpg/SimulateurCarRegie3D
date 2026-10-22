// @ts-check
import { el } from '../../../util.js';
import { CATALOGUE } from '../../catalogue/index.js';
import { numOf } from '../../engine.js';
import { section, note, etat, choix, texte, coche, touches, action, reseau, services, suggestions, checkIp, ecrire, formatLabel } from './kit.js';

// ----------------------------------------------------------------------------------
// Le menu du PC de régie (Windows et carte DeckLink Duo 2) : le logiciel lancé (vMix, ATEM
// Software Control, DashBoard), le sens de chaque BNC de la DeckLink, et dans vMix les entrées
// (DeckLink ou NDI|HX), le programme, les caméras PTZ pilotées, le tally, l'enregistrement et le
// streaming. Clés lues par le moteur : logiciel, decklink[n] ('in' | 'out'), vmix { entrees[i]
// { type, source }, pgm, ptz[i].ip, tally, enregistre, stream }, reseau.
// ----------------------------------------------------------------------------------
/** @typedef {import('./kit.js').Appareil} Appareil */
/** @typedef {import('./kit.js').Modele} Modele */
/** @typedef {import('./kit.js').Ctx} Ctx */

/** @param {Appareil} a @param {Modele} m @param {Ctx} ctx */
export function menuPc(a, m, ctx) {
  const c = a.cfg; const E = ctx.E;
  const bncs = m.ports.filter((p) => p.sig === 'sdi' && p.dir === 'io');
  const out = [
    section('Logiciel',
      choix(a.uid, 'logiciel', c.logiciel || 'vmix', [['vmix', 'vMix (régie logicielle)'], ['atem-control', 'ATEM Software Control (pilote un ATEM)'], ['dashboard', 'DashBoard (pilote un Carbonite)']], 'Logiciel lancé'),
      c.logiciel === 'atem-control' || c.logiciel === 'dashboard' ? el('div', {}, ...services(ctx, `${a.uid}:${c.logiciel === 'atem-control' ? 'atem' : 'rosstalk'}:`, 'Aucun mélangeur à piloter.')) : null),
  ];
  if (bncs.length) {
    out.push(section('DeckLink Duo 2',
      note('Desktop Video Setup : chaque BNC est une entrée ou une sortie. D\'usine, la carte travaille par paires (une entrée et une sortie par paire).'),
      ...bncs.map((p) => {
        const n = numOf(p.id); const dir = c.decklink && c.decklink[n] === 'out' ? 'out' : 'in'; const f = dir === 'in' ? E.video[`${a.uid}:${p.id}`] : null;
        return el('div', { class: 'ep-cf-row' }, choix(a.uid, `decklink.${n}`, dir, [['in', 'Entrée'], ['out', 'Sortie (programme)']], p.label), el('small', {}, dir === 'in' ? (f ? `reçoit ${f.label} (${formatLabel(f.format)})` : 'rien n\'arrive') : 'sort le programme de vMix'));
      })));
  }
  if (c.logiciel !== 'vmix') { out.push(reseau(a, ctx, { menu: 'Windows : Paramètres → Réseau → Ethernet → Modifier (IP).' })); return out.filter(Boolean).map((x) => /** @type {HTMLElement} */ (x)); }

  const v = c.vmix || {}; const ents = Array.isArray(v.entrees) ? v.entrees : []; const ptz = Array.isArray(v.ptz) ? v.ptz : [];
  const dlNdi = `ep-dl-ndi-${a.uid}`, dlCam = `ep-dl-ptz-${a.uid}`;
  const entrees = bncs.filter((p) => !(c.decklink && c.decklink[numOf(p.id)] === 'out')).map((p) => /** @type {[string, string]} */ ([p.id, `DeckLink ${p.label}`]));
  const camsNdi = el('datalist', { id: dlNdi }, ...ctx.B.appareils.filter((x) => (CATALOGUE[x.modele] || {}).famille === 'camera').map((x) => el('option', { value: x.nom })));
  const lignes = ents.map((e, i) => {
    const svc = Object.entries(E.services).find(([k, s]) => k.startsWith(`${a.uid}:ndi:`) && s.label.startsWith(`Entrée ${i + 1} `));
    return el('div', { class: 'ep-cf-slot' },
      el('b', {}, String(i + 1)),
      choix(a.uid, `vmix.entrees.${i}.type`, e && e.type === 'ndi' ? 'ndi' : 'decklink', [['decklink', 'DeckLink (SDI)'], ['ndi', 'NDI|HX (réseau)']], `Type de l'entrée ${i + 1}`, { set: (t) => ecrire(a.uid, { [`vmix.entrees.${i}`]: { type: t, source: '' } }) }),
      e && e.type === 'ndi'
        ? texte(a.uid, `vmix.entrees.${i}.source`, e.source, 'Source NDI', { list: dlNdi, placeholder: 'CAM 1, ou l\'adresse de la caméra' })
        : choix(a.uid, `vmix.entrees.${i}.source`, e ? e.source : '', [['', '—'], ...entrees], 'BNC'),
      svc ? el('small', { class: 'ep-cf-slot-st' }, svc[1].ok ? '✓ ' + svc[1].label : '✗ ' + svc[1].why) : null,
      action('Retirer', () => ecrire(a.uid, { 'vmix.entrees': ents.filter((_, j) => j !== i), 'vmix.pgm': Math.min(Number(v.pgm) || 1, Math.max(1, ents.length - 1)) }), '', `${a.uid}:vmix-del:${i}`));
  });
  out.push(section('vMix : entrées',
    note('Add Input → Camera (une entrée DeckLink) ou NDI / Desktop Capture (une source NDI|HX trouvée sur le réseau : la caméra doit avoir NDI|HX activé et être joignable).'),
    camsNdi, ...lignes,
    action('Ajouter une entrée', () => ecrire(a.uid, { 'vmix.entrees': [...ents, { type: 'decklink', source: '' }] }), '', `${a.uid}:vmix-add`),
    ents.length ? touches(a.uid, 'vmix.pgm', Number(v.pgm) || 1, ents.map((_, i) => /** @type {[number, string]} */ ([i + 1, String(i + 1)])), 'Programme (à l\'antenne)', { cls: 'pgm' }) : null));
  out.push(section('vMix : caméras PTZ',
    note('Settings → PTZ (Panasonic) : l\'adresse de chaque caméra. vMix la pilote en HTTP et lui envoie son tally quand son entrée est au programme.'),
    suggestions(ctx, dlCam, (x, mo) => mo.famille === 'camera'),
    ...ptz.map((p, i) => el('div', { class: 'ep-cf-row' }, texte(a.uid, `vmix.ptz.${i}.ip`, p ? p.ip : '', `Caméra PTZ ${i + 1}`, { mono: true, list: dlCam, check: checkIp }), action('Retirer', () => ecrire(a.uid, { 'vmix.ptz': ptz.filter((_, j) => j !== i) }), '', `${a.uid}:ptz-del:${i}`))),
    action('Ajouter une caméra', () => ecrire(a.uid, { 'vmix.ptz': [...ptz, { ip: '', modele: '' }] }), '', `${a.uid}:ptz-add`),
    ...services(ctx, `${a.uid}:ptz-http:`),
    coche(a.uid, 'vmix.tally', !!v.tally, 'Tally vers les caméras PTZ')));
  out.push(section('vMix : sorties',
    coche(a.uid, 'vmix.enregistre', !!v.enregistre, 'Enregistrer le programme (Record)'), ...services(ctx, `${a.uid}:enregistre`),
    coche(a.uid, 'vmix.stream', !!v.stream, 'Diffuser (Stream)', { aide: 'Il faut une passerelle (la box) et un accès Internet.' }), ...services(ctx, `${a.uid}:rtmp:`)));
  out.push(reseau(a, ctx, { menu: 'Windows : Paramètres → Réseau → Ethernet → Modifier (IP). Le PC doit être dans le sous-réseau des caméras qu\'il pilote.' }));
  if (!ents.length) out.push(etat(false, 'vMix n\'a aucune entrée : le programme est noir.'));
  return out.filter(Boolean).map((x) => /** @type {HTMLElement} */ (x));
}
