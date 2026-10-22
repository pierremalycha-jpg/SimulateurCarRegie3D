// @ts-check
import { el } from '../../util.js';
import { CATALOGUE, SIGNAUX, CONNECTEURS } from '../catalogue/index.js';
import { appareil, cablesDe, autreBout, relier, debrancher, ranger, renommer, B } from '../build.js';

// ----------------------------------------------------------------------------------
// Le panneau d'un appareil : son nom, ses faces (dessinées par equipment/viewer.js, drawFace), ses
// connecteurs (clic : commencer ou finir un câble), ses câbles, sa configuration (les menus de
// l'appareil, écrits par le rédacteur « panneaux » dans ui/config/*.js), les alertes du moteur, et
// « Remettre au stock ». Ci-dessous la version de base : liste des ports et câblage par liste.
// ----------------------------------------------------------------------------------
/** @typedef {import('./stock.js').Ctx} Ctx */

/** le câble en cours : son premier bout (clic sur un port), partagé entre les panneaux */
export const PENDING = { a: /** @type {import('../types.js').Bout | null} */ (null) };

/** @param {string} uid @param {Ctx} ctx */
export function renderAppareil(uid, ctx) {
  const a = appareil(uid); const m = a ? CATALOGUE[a.modele] : null; if (!a || !m) return el('p', {}, 'Appareil inconnu.');
  const E = ctx.E;
  const box = el('div', { class: 'ep-app' });
  const nom = el('input', { type: 'text', value: a.nom, maxlength: '24', 'aria-label': 'Nom de l\'appareil' });
  nom.addEventListener('change', () => renommer(uid, nom.value));
  box.append(el('p', { class: 'ep-app-h' }, el('b', {}, m.nom), el('small', {}, ` ${m.marque} · ${m.role}`)), el('label', { class: 'ep-field' }, 'Nom ', nom));
  const P = E.power[uid];
  box.append(el('p', { class: 'ep-state ' + (P && P.on ? 'ok' : 'ko') }, P && P.on ? `Alimenté : ${P.source}.` : `Pas alimenté : ${P ? P.why : ''}`));
  const al = E.alertes.filter((x) => x.dev === uid);
  if (al.length) box.append(el('ul', { class: 'ep-alertes' }, ...al.map((x) => el('li', { class: x.level }, x.msg))));
  // les connecteurs
  const ports = el('ul', { class: 'ep-ports' });
  for (const p of m.ports) {
    const cab = cablesDe(uid, p.id)[0];
    const other = cab ? autreBout(cab, uid) : null; const oa = other ? appareil(other.dev) : null;
    const pend = PENDING.a && PENDING.a.dev === uid && PENDING.a.port === p.id;
    const li = el('li', { class: 'ep-port' + (cab ? ' wired' : '') + (pend ? ' pend' : ''), style: `--c:${SIGNAUX[p.sig].couleur}` },
      el('i', { 'aria-hidden': 'true' }),
      el('div', { class: 'ep-port-t' }, el('b', {}, p.label), el('small', {}, `${CONNECTEURS[p.kind].nom} · ${SIGNAUX[p.sig].nom} · ${p.dir === 'in' ? 'entrée' : p.dir === 'out' ? 'sortie' : 'entrée / sortie'}`), p.desc ? el('span', {}, p.desc) : null,
        cab ? el('span', { class: 'ep-link' }, `→ ${oa ? oa.nom : '?'} · ${portLabel(other)}`, E.cables[cab.uid] && !E.cables[cab.uid].ok ? el('em', {}, ' ' + E.cables[cab.uid].why) : null) : null),
      cab ? el('button', { type: 'button', class: 'btn small', onclick: () => { debrancher(cab.uid); } }, 'Débrancher')
        : el('button', { type: 'button', class: 'btn small' + (pend ? ' primary' : ''), onclick: () => clickPort(uid, p.id, ctx) }, pend ? 'Câble en main…' : PENDING.a ? 'Relier ici' : 'Câbler'));
    ports.append(li);
  }
  box.append(el('h3', {}, 'Connecteurs'), ports);
  if (PENDING.a) box.append(el('p', { class: 'note' }, `Câble en main depuis ${(appareil(PENDING.a.dev) || { nom: '?' }).nom} · ${portLabel(PENDING.a)}. Ouvrez l'autre appareil et choisissez son connecteur. `, el('button', { type: 'button', class: 'linkbtn', onclick: () => { PENDING.a = null; ctx.open(uid); } }, 'Lâcher le câble')));
  box.append(el('h3', {}, 'Configuration'), el('pre', { class: 'ep-cfg-raw' }, JSON.stringify(a.cfg, null, 1)));
  if (m.specs && m.specs.length) box.append(el('h3', {}, 'Caractéristiques'), el('ul', { class: 'prose' }, ...m.specs.map((s) => el('li', {}, s))));
  if (m.pose !== 'mur') box.append(el('p', {}, el('button', { type: 'button', class: 'btn small', onclick: () => { ranger(uid); ctx.panel('stock'); } }, 'Remettre au stock')));
  return box;
}
function portLabel(/** @type {import('../types.js').Bout | null} */ b) { if (!b) return ''; const a = appareil(b.dev); const m = a ? CATALOGUE[a.modele] : null; const p = m ? m.ports.find((x) => x.id === b.port) : null; return p ? p.label : b.port; }
/** un clic sur un connecteur : prend un câble, ou le branche à l'autre bout */
export function clickPort(uid, port, /** @type {Ctx} */ ctx) {
  if (!PENDING.a) { PENDING.a = { dev: uid, port }; ctx.open(uid); return; }
  if (PENDING.a.dev === uid && PENDING.a.port === port) { PENDING.a = null; ctx.open(uid); return; }
  const r = relier(PENDING.a, { dev: uid, port });
  if (!r.ok) { ctx.say(r.why || 'Impossible.'); return; }
  PENDING.a = null; ctx.open(uid);
}
export { B };
