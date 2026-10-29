// @ts-check
import { el } from '../../util.js';
import { drawFace } from '../../equipment/viewer.js';
import { CATALOGUE, SIGNAUX, CONNECTEURS, compatibles, portOf } from '../catalogue/index.js';
import { appareil, cablesDe, autreBout, relier, debrancher, ranger, renommer, allumer, usine, poser, occupes, ZONES, B } from '../build.js';
import { renderConfig } from './config/index.js';
import { formatLabel } from './config/kit.js';

// ----------------------------------------------------------------------------------
// Le panneau d'un appareil : son nom, sa place, son alimentation (marche / arrêt), les alertes du
// moteur, puis quatre onglets :
//   - Faces : les faces dessinées (equipment/viewer.js, drawFace) ; un clic sur un connecteur
//     prend un câble, ou le branche à l'autre bout quand un câble est en main ; l'anneau d'un
//     connecteur dit sa liaison (couleur du signal, rouge si elle est fausse, orange : compatible
//     avec le câble en main) ;
//   - Câblage : les mêmes connecteurs en liste (le clavier y suffit), avec ce qui arrive ;
//   - Réglages : les menus de l'appareil (ui/config/*.js) ;
//   - Fiche : le rôle, les caractéristiques, la consommation, le prix, les points à vérifier.
// ----------------------------------------------------------------------------------
/** @typedef {import('./stock.js').Ctx} Ctx */
/** @typedef {import('../types.js').Bout} Bout */

/** le câble en cours : son premier bout (clic sur un port), partagé entre les panneaux */
export const PENDING = { a: /** @type {Bout | null} */ (null) };
/** l'onglet affiché, la face choisie pour chaque modèle, le connecteur choisi : gardés d'un dessin à l'autre */
export const APP = { tab: 'faces', faces: /** @type {Record<string, string>} */ ({}), port: '' };

const TABS = [['faces', 'Faces'], ['cablage', 'Câblage'], ['reglages', 'Réglages'], ['fiche', 'Fiche']];
const sens = (/** @type {string} */ d) => (d === 'in' ? 'entrée' : d === 'out' ? 'sortie' : 'entrée / sortie');
function portLabel(/** @type {Bout | null} */ b) { if (!b) return ''; const a = appareil(b.dev); const p = a ? portOf(a.modele, b.port) : null; return p ? p.label : b.port; }
const nomBout = (/** @type {Bout} */ b) => `${(appareil(b.dev) || { nom: '?' }).nom} · ${portLabel(b)}`;
/** ce port peut-il recevoir le câble en main ? */
function accepte(/** @type {string} */ uid, /** @type {string} */ port) {
  if (!PENDING.a || (PENDING.a.dev === uid && PENDING.a.port === port)) return false;
  const a = appareil(PENDING.a.dev); const pa = a ? portOf(a.modele, PENDING.a.port) : null; const pb = portOf((appareil(uid) || { modele: '' }).modele, port);
  return !!pa && !!pb && compatibles(pa, pb).ok && !cablesDe(uid, port).length;
}

/** @param {string} uid @param {Ctx} ctx */
export function renderAppareil(uid, ctx) {
  const a = appareil(uid); const m = a ? CATALOGUE[a.modele] : null; if (!a || !m) return el('p', {}, 'Appareil inconnu.');
  const E = ctx.E;
  const box = el('div', { class: 'ep-app' });
  // ---- en-tête : nom, modèle, place, alimentation, alertes ----
  const nom = el('input', { type: 'text', value: a.nom, maxlength: '24', 'aria-label': 'Nom de l\'appareil', 'data-k': `${uid}:nom` });
  nom.addEventListener('change', () => renommer(uid, nom.value));
  nom.addEventListener('keydown', (e) => { if (e.key === 'Enter') nom.blur(); });
  box.append(el('p', { class: 'ep-app-h' }, el('b', {}, m.nom), el('small', {}, ` ${m.marque} · ${m.role}`)), el('label', { class: 'ep-field' }, 'Nom ', nom));
  if (m.pose !== 'mur') box.append(placeSelect(a, m));
  const P = E.power[uid];
  const besoin = m.ports.some((p) => (p.sig === 'secteur' || p.sig === 'dc12' || (p.sig === 'ip' && p.poe)) && (p.dir === 'in' || p.dir === 'io'));
  if (besoin) {
    const marche = a.on !== false;
    box.append(el('div', { class: 'ep-state ' + (P && P.on ? 'ok' : 'ko') },
      el('span', {}, P && P.on ? `Alimenté : ${P.source}${P.watts ? ` · ≈ ${P.watts} W` : ''}.` : `Éteint : ${P ? P.why : ''}`),
      'interrupteur' in (m.cfg || {}) ? null : el('button', { type: 'button', class: 'btn small' + (marche ? ' on' : ''), 'aria-pressed': String(marche), 'data-k': `${uid}:on`, title: 'L\'interrupteur de l\'appareil', onclick: () => allumer(uid, !marche) }, `Interrupteur : ${marche ? 'marche' : 'arrêt'}`)));
  }
  const al = E.alertes.filter((x) => x.dev === uid && !(x.level === 'erreur' && P && !P.on && x.msg === P.why));
  if (al.length) box.append(el('ul', { class: 'ep-alertes' }, ...al.map((x) => el('li', { class: x.level }, x.msg))));
  if (PENDING.a) box.append(el('p', { class: 'ep-pending' }, el('span', {}, `Câble en main depuis ${nomBout(PENDING.a)} (${SIGNAUX[(portOf((appareil(PENDING.a.dev) || { modele: '' }).modele, PENDING.a.port) || { sig: 'sdi' }).sig].nom}). Choisis le connecteur d'arrivée, ici ou sur un autre appareil.`),
    el('button', { type: 'button', class: 'linkbtn', 'data-k': 'lacher', onclick: () => { PENDING.a = null; ctx.open(uid); } }, 'Lâcher le câble')));

  // ---- onglets ----
  const hasFaces = m.faces && Object.keys(m.faces).length;
  const tabs = TABS.filter(([t]) => t !== 'faces' || hasFaces);
  if (!tabs.some(([t]) => t === APP.tab)) APP.tab = tabs[0][0];
  box.append(el('div', { class: 'ep-tabs', role: 'tablist', 'aria-label': 'Vues de l\'appareil' },
    ...tabs.map(([t, l]) => el('button', { type: 'button', role: 'tab', 'aria-selected': String(APP.tab === t), 'data-k': `tab:${t}`, onclick: () => { APP.tab = t; ctx.open(uid); } }, l))));
  const body = el('div', { class: 'ep-tabbody', role: 'tabpanel' });
  if (APP.tab === 'faces') body.append(...vueFaces(a, m, ctx));
  else if (APP.tab === 'cablage') body.append(vueCablage(a, m, ctx));
  else if (APP.tab === 'reglages') body.append(...renderConfig(a, m, ctx), el('p', { class: 'ep-cf-foot' }, el('button', { type: 'button', class: 'btn small', 'data-k': `${uid}:usine`, onclick: () => { usine(uid); ctx.say(`${a.nom} : réglages d'usine.`); } }, 'Revenir aux réglages d\'usine')));
  else body.append(vueFiche(m));
  box.append(body);
  if (m.pose !== 'mur') box.append(el('p', { class: 'ep-app-foot' }, el('button', { type: 'button', class: 'btn small', 'data-k': `${uid}:ranger`, onclick: () => { if (PENDING.a && PENDING.a.dev === uid) PENDING.a = null; ranger(uid); ctx.panel('stock'); } }, 'Remettre au stock')));
  return box;
}

/** la place de l'appareil : un emplacement libre de sa zone (rangée de U pour la baie) */
function placeSelect(/** @type {import('../types.js').Appareil} */ a, /** @type {import('../types.js').Modele} */ m) {
  const zone = m.pose; const Z = ZONES[zone]; if (!Z) return null;
  const h = zone === 'rack' ? Math.max(1, Math.ceil(m.u || 1)) : 1; const occ = occupes(zone, a.uid);
  const s = el('select', { 'data-k': `${a.uid}:place`, 'aria-label': 'Emplacement' });
  for (let n = 1; n + h - 1 <= Z.slots; n++) {
    let libre = true; for (let i = 0; i < h; i++) if (occ.has(n + i)) libre = false;
    if (!libre && n !== a.place.slot) continue;
    const t = zone === 'rack' ? (h > 1 ? `U ${n} à ${n + h - 1}` : `U ${n}`) : `${Z.nom}, place ${n}`;
    const o = el('option', { value: String(n) }, t); if (n === a.place.slot) o.selected = true; s.append(o);
  }
  s.addEventListener('change', () => poser(a.uid, { zone, slot: +s.value }));
  return el('label', { class: 'ep-field' }, zone === 'rack' ? `Baie 19" (${m.u || 1} U${m.largeur && m.largeur < 1 ? `, ${m.largeur === 0.5 ? 'demi' : 'tiers de'} largeur` : ''})` : Z.nom, s);
}

/** un clic sur un connecteur : prend un câble, le branche, ou choisit le connecteur déjà câblé */
export function clickPort(/** @type {string} */ uid, /** @type {string} */ port, /** @type {Ctx} */ ctx) {
  APP.port = port;
  if (PENDING.a) {
    if (PENDING.a.dev === uid && PENDING.a.port === port) { PENDING.a = null; ctx.open(uid); return; }
    const from = PENDING.a;
    const r = relier(from, { dev: uid, port });
    if (!r.ok) { ctx.say(r.why || 'Impossible.'); ctx.open(uid); return; }
    PENDING.a = null; ctx.say(`Câble posé : ${nomBout(from)} → ${nomBout({ dev: uid, port })}.`); ctx.open(uid); return;
  }
  if (!cablesDe(uid, port).length) PENDING.a = { dev: uid, port };
  ctx.open(uid);
}

/** l'onglet Faces : la face choisie, ses connecteurs cliquables, le détail du connecteur choisi */
function vueFaces(/** @type {import('../types.js').Appareil} */ a, /** @type {import('../types.js').Modele} */ m, /** @type {Ctx} */ ctx) {
  const E = ctx.E; const uid = a.uid;
  const noms = Object.keys(m.faces || {});
  // d'office, la face qui porte le plus de connecteurs (l'arrière d'un enregistreur, l'avant d'un switch)
  const nPorts = (/** @type {string} */ n) => m.faces[n].items.filter((it) => it.t === 'port').length;
  const face = noms.includes(APP.faces[m.id]) ? APP.faces[m.id] : noms.slice().sort((x, y) => nPorts(y) - nPorts(x))[0];
  const out = [];
  if (noms.length > 1) out.push(el('div', { class: 'ep-faces-sw', role: 'group', 'aria-label': 'Face' }, ...noms.map((n) => el('button', { type: 'button', class: 'btn small' + (n === face ? ' on' : ''), 'aria-pressed': String(n === face), 'data-k': `face:${n}`, onclick: () => { APP.faces[m.id] = n; ctx.open(uid); } }, m.faces[n].label || n))));
  // l'état en direct : voyants d'alimentation et de tally
  const on = !!(E.power[uid] && E.power[uid].on); const T = E.tally[uid];
  const st = { led: /** @type {Record<string, string | null>} */ ({}) };
  for (const f of Object.values(m.faces)) for (const it of f.items) if (it.t === 'led') st.led[it.id] = /tally/i.test(it.id) ? (T && T.pgm ? 'tally' : T && T.pvw ? 'green' : null) : /power|pwr|status/i.test(it.id) ? (on ? 'green' : null) : null;
  /** @type {Record<string, { ok: boolean, color: string }>} */ const conns = {};
  for (const p of m.ports) {
    const cb = cablesDe(uid, p.id)[0];
    if (cb) conns[p.id] = { ok: !E.cables[cb.uid] || E.cables[cb.uid].ok, color: SIGNAUX[p.sig].couleur };
    if (PENDING.a && PENDING.a.dev === uid && PENDING.a.port === p.id) conns[p.id] = { ok: true, color: '#ffffff' };
    else if (accepte(uid, p.id)) conns[p.id] = { ok: true, color: '#ffb020' };
  }
  const host = el('div', { class: 'ep-face' });
  drawFace(host, m.faces[face], st, conns, (id) => { if (m.ports.some((p) => p.id === id)) clickPort(uid, id, ctx); }, `${m.nom}, ${m.faces[face].label || face}`);
  out.push(host, el('p', { class: 'ep-face-leg' }, 'Clique sur un connecteur pour prendre un câble, puis sur celui d\'arrivée. Anneau : couleur du signal quand il est câblé, rouge pointillé si la liaison est fausse, orange quand il accepte le câble en main.'));
  // le connecteur choisi
  const p = m.ports.find((x) => x.id === APP.port);
  if (p) out.push(detailPort(a, p, ctx));
  return out;
}

/** le détail d'un connecteur : ce qu'il est, où il va, ce qui y arrive */
function detailPort(/** @type {import('../types.js').Appareil} */ a, /** @type {import('../types.js').Port} */ p, /** @type {Ctx} */ ctx) {
  const E = ctx.E; const uid = a.uid;
  const cb = cablesDe(uid, p.id)[0]; const other = cb ? autreBout(cb, uid) : null;
  const f = (p.sig === 'sdi' || p.sig === 'hdmi') ? E.video[`${uid}:${p.id}`] : null;
  const pend = PENDING.a && PENDING.a.dev === uid && PENDING.a.port === p.id;
  return el('div', { class: 'ep-port-detail', style: `--c:${SIGNAUX[p.sig].couleur}` },
    el('b', {}, p.label), el('small', {}, ` ${CONNECTEURS[p.kind].nom} · ${SIGNAUX[p.sig].nom} · ${sens(p.dir)}`),
    p.desc ? el('p', {}, p.desc) : null,
    f ? el('p', { class: 'ep-link' }, `Reçoit : ${f.label} (${formatLabel(f.format)})`) : null,
    cb ? el('p', { class: 'ep-link' }, `→ ${nomBout(/** @type {Bout} */ (other))}`, E.cables[cb.uid] && !E.cables[cb.uid].ok ? el('em', {}, ' ' + E.cables[cb.uid].why) : null) : null,
    el('div', { class: 'ep-cf-row' },
      cb ? el('button', { type: 'button', class: 'btn small', 'data-k': `${uid}:deb:${p.id}`, onclick: () => { debrancher(cb.uid); ctx.open(uid); } }, 'Débrancher')
        : el('button', { type: 'button', class: 'btn small' + (pend ? ' primary' : ''), 'data-k': `${uid}:cab:${p.id}`, onclick: () => clickPort(uid, p.id, ctx) }, pend ? 'Câble en main (lâcher)' : PENDING.a ? 'Brancher ici' : 'Prendre un câble'),
      other ? el('button', { type: 'button', class: 'linkbtn', onclick: () => { APP.port = other.port; ctx.open(other.dev); } }, 'Aller à l\'autre bout') : null));
}

/** l'onglet Câblage : les connecteurs par groupe, en liste */
function vueCablage(/** @type {import('../types.js').Appareil} */ a, /** @type {import('../types.js').Modele} */ m, /** @type {Ctx} */ ctx) {
  const E = ctx.E; const uid = a.uid;
  const box = el('div');
  const groupes = [...new Set(m.ports.map((p) => p.group || 'Connecteurs'))];
  for (const g of groupes) {
    const ul = el('ul', { class: 'ep-ports' });
    for (const p of m.ports.filter((x) => (x.group || 'Connecteurs') === g)) {
      const cb = cablesDe(uid, p.id)[0]; const other = cb ? autreBout(cb, uid) : null;
      const pend = PENDING.a && PENDING.a.dev === uid && PENDING.a.port === p.id;
      const f = (p.sig === 'sdi' || p.sig === 'hdmi') && (p.dir === 'in' || p.dir === 'io') ? E.video[`${uid}:${p.id}`] : null;
      ul.append(el('li', { class: 'ep-port' + (cb ? ' wired' : '') + (pend ? ' pend' : '') + (accepte(uid, p.id) ? ' ok' : ''), style: `--c:${SIGNAUX[p.sig].couleur}` },
        el('i', { 'aria-hidden': 'true' }),
        el('div', { class: 'ep-port-t' }, el('b', {}, p.label), el('small', {}, `${CONNECTEURS[p.kind].nom} · ${SIGNAUX[p.sig].nom} · ${sens(p.dir)}`), p.desc ? el('span', {}, p.desc) : null,
          f ? el('span', { class: 'ep-link' }, `reçoit ${f.label} (${formatLabel(f.format)})`) : null,
          cb ? el('span', { class: 'ep-link' }, `→ ${nomBout(/** @type {Bout} */ (other))}`, E.cables[cb.uid] && !E.cables[cb.uid].ok ? el('em', {}, ' ' + E.cables[cb.uid].why) : null) : null),
        cb ? el('button', { type: 'button', class: 'btn small', 'data-k': `${uid}:deb:${p.id}`, onclick: () => { debrancher(cb.uid); ctx.open(uid); } }, 'Débrancher')
          : el('button', { type: 'button', class: 'btn small' + (pend ? ' primary' : ''), 'data-k': `${uid}:cab:${p.id}`, onclick: () => clickPort(uid, p.id, ctx) }, pend ? 'Câble en main…' : PENDING.a ? 'Relier ici' : 'Câbler')));
    }
    box.append(el('h3', {}, g), ul);
  }
  return box;
}

/** l'onglet Fiche : ce que dit la documentation */
function vueFiche(/** @type {import('../types.js').Modele} */ m) {
  const l = [];
  if (m.watts != null) l.push(`Consommation : ≈ ${m.watts} W en marche (ordre de grandeur).`);
  if (m.prix != null && m.prix > 0) l.push(`Prix : ≈ ${m.prix.toLocaleString('fr-FR')} € HT (ordre de grandeur, à titre pédagogique).`);
  if (m.pose === 'rack') l.push(`Se monte dans la baie : ${m.u || 1} U${m.largeur && m.largeur < 1 ? `, ${m.largeur === 0.5 ? 'demi' : 'tiers de'} largeur (sur une tablette 1 U)` : ''}.`);
  if (m.formats && m.formats.length) l.push(`Formats : ${m.formats.map(formatLabel).join(', ')}.`);
  return el('div', { class: 'ep-fiche' },
    el('p', { class: 'lede' }, m.role),
    el('ul', { class: 'prose' }, ...l.map((t) => el('li', {}, t))),
    m.specs && m.specs.length ? el('div', {}, el('h3', {}, 'Caractéristiques'), el('ul', { class: 'prose' }, ...m.specs.map((s) => el('li', {}, s)))) : null,
    m.doc ? el('p', { class: 'note' }, `Source : ${m.doc}`) : null,
    m.averifier && m.averifier.length ? el('details', {}, el('summary', {}, `Points à faire vérifier par un professionnel (${m.averifier.length})`), el('ul', { class: 'prose' }, ...m.averifier.map((s) => el('li', {}, s)))) : null);
}
export { B };
