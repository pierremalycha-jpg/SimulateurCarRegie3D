// @ts-check
import { el } from '../../../util.js';
import { CATALOGUE } from '../../catalogue/index.js';
import { MUR_W, BANDEAU_W } from '../../engine.js';
import { section, note, etat, coche, formatLabel } from './kit.js';

// ----------------------------------------------------------------------------------
// Les appareils sans menu de réseau : l'énergie (le tableau électrique du mur, le bandeau 19", le
// bloc 12 V : ce que chacun alimente et la puissance appelée), les moniteurs (ce qu'ils
// affichent), et les accessoires (micro, disque, carte SD, pied : rien à régler). Clé lue par le
// moteur : interrupteur (bandeau).
// ----------------------------------------------------------------------------------
/** @typedef {import('./kit.js').Appareil} Appareil */
/** @typedef {import('./kit.js').Modele} Modele */
/** @typedef {import('./kit.js').Ctx} Ctx */

/** les appareils alimentés par `a` (la source du moteur nomme l'appareil qui alimente), et la puissance totale en aval */
export function aval(/** @type {Ctx} */ ctx, /** @type {Appareil} */ a, depth = 0) {
  const P = ctx.E.power;
  const direct = ctx.B.appareils.filter((x) => x.uid !== a.uid && P[x.uid] && P[x.uid].on && (a.modele === 'mur' ? P[x.uid].source === 'secteur' : P[x.uid].source.endsWith(`(${a.nom})`)));
  let w = 0;
  // un bandeau en aval : on ajoute ce qu'il alimente (le moteur a déjà replié le 12 V et le PoE+ dans les watts du bloc et du switch)
  const distribue = (/** @type {Appareil} */ x) => ((CATALOGUE[x.modele] || { ports: [] }).ports || []).some((p) => p.sig === 'secteur' && p.dir === 'out');
  const lignes = direct.map((x) => { const sous = depth < 5 && distribue(x) ? aval(ctx, x, depth + 1).w : 0; const wx = (P[x.uid].watts || 0) + sous; w += wx; return { a: x, w: wx, source: P[x.uid].source }; });
  return { lignes, w };
}
/** une jauge de puissance : appelée / disponible */
function jauge(/** @type {number} */ w, /** @type {number} */ max, /** @type {string} */ quoi) {
  const pct = Math.min(100, Math.round(w / max * 100));
  return el('div', { class: 'ep-cf-jauge' + (w > max ? ' ko' : pct > 80 ? ' warn' : ''), role: 'meter', 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(w), 'aria-label': quoi },
    el('i', { style: `width:${pct}%` }), el('span', {}, `${w} W sur ${max} W (${pct} %)`));
}
const listeAval = (/** @type {ReturnType<typeof aval>} */ r, /** @type {Ctx} */ ctx) => (r.lignes.length
  ? el('ul', { class: 'ep-cf-list' }, ...r.lignes.map((l) => el('li', {}, el('button', { type: 'button', class: 'linkbtn', onclick: () => ctx.open(l.a.uid) }, l.a.nom), el('small', {}, `${l.w} W`))))
  : etat(null, 'Rien n\'est branché.'));

/** @param {Appareil} a @param {Modele} m @param {Ctx} ctx */
export function menuDivers(a, m, ctx) {
  if (a.modele === 'mur') {
    const r = aval(ctx, a);
    return [section('Puissance appelée',
      note(`Quatre prises sur un disjoncteur de 16 A : P = U × I = 230 V × 16 A ≈ ${MUR_W} W pour l'ensemble. Au-delà, il saute et tout s'éteint (dans l'entrepôt, une alerte). Les puissances sont des ordres de grandeur en marche.`),
      jauge(r.w, MUR_W, 'Puissance sur le disjoncteur'), listeAval(r, ctx))];
  }
  if (m.famille === 'alimentation' && 'interrupteur' in (m.cfg || {})) {
    const r = aval(ctx, a);
    return [section('Bandeau',
      note(`Huit prises protégées par un fusible de 10 A : ≈ ${BANDEAU_W} W au plus. L'interrupteur coupe tout ce qui y est branché.`),
      coche(a.uid, 'interrupteur', a.cfg.interrupteur !== false, 'Interrupteur sur marche'),
      jauge(r.w, BANDEAU_W, 'Puissance sur le bandeau'), listeAval(r, ctx))];
  }
  if (m.famille === 'alimentation') {
    const r = aval(ctx, a);
    return [section('Bloc 12 V', note('Un bloc 12 V · 5 A fournit 60 W au plus : une caméra PTZ (≈ 16 à 22 W), un pupitre (≈ 12 W).'), jauge(r.w, 60, 'Puissance sur le bloc'), listeAval(r, ctx))];
  }
  if (m.famille === 'moniteur') {
    const vus = m.ports.filter((p) => (p.sig === 'sdi' || p.sig === 'hdmi') && p.dir === 'in').map((p) => ({ p, f: ctx.E.video[`${a.uid}:${p.id}`] }));
    return [section('Ce qu\'il affiche', note('Le moniteur montre la première entrée qui reçoit un signal.'),
      ...vus.map(({ p, f }) => etat(f ? true : null, `${p.label} : ${f ? `${f.label} (${formatLabel(f.format)})${f.audio.length ? ', son sur les voies ' + [...new Set(f.audio.map((x) => x.ch))].join(', ') : ''}` : 'pas de signal'}`)))];
  }
  return [section('Réglages', etat(null, m.famille === 'son' ? 'Un micro dynamique n\'a rien à régler : il se branche sur une entrée XLR (mélangeur ou Teranex Audio to SDI).' : m.id === 'pied-camera' ? 'Un pied se pose sur le plateau ; la caméra se fixe dessus.' : 'Rien à régler : ce support se branche dans un logement SD ou sur un port USB-C.'))];
}
