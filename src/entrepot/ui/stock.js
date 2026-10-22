// @ts-check
import { el } from '../../util.js';
import { parFamille, SIGNAUX, CATALOGUE } from '../catalogue/index.js';
import { sortir, placeLibre, ZONES } from '../build.js';
import { missionById } from '../missions.js';

// ----------------------------------------------------------------------------------
// Le stock : les rayons de l'entrepôt, famille par famille. Une recherche (nom, marque, rôle),
// un filtre par famille, le budget de la mission en cours ; chaque modèle a son prix, sa
// consommation, où il se pose, combien sont déjà sortis, une fiche dépliable (caractéristiques,
// connecteurs par signal) et « Sortir ». En bas, ce qui est déjà sorti, pour l'ouvrir au clavier.
// ----------------------------------------------------------------------------------
/** @typedef {{ B: import('../types.js').Build, E: import('../types.js').Eval, open: (uid: string) => void, panel: (n: string) => void, close: () => void, say: (t: string) => void, lecon?: string, quitter?: () => void }} Ctx */

/** la recherche et la famille choisies : gardées d'un dessin du panneau à l'autre */
const ST = { q: '', fam: '' };
const sans = (/** @type {string} */ s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const pose = (/** @type {import('../types.js').Modele} */ m) => (m.pose === 'rack' ? `baie ${m.u || 1} U${m.largeur && m.largeur < 1 ? (m.largeur === 0.5 ? ' (demi)' : ' (tiers)') : ''}` : m.pose === 'table' ? 'table' : m.pose === 'plateau' ? 'plateau' : 'mur');

/** @param {Ctx} ctx */
export function renderStock(ctx) {
  const box = el('div', { class: 'ep-stock' });
  const familles = parFamille().map((f) => ({ ...f, modeles: f.modeles.filter((m) => m.pose !== 'mur') })).filter((f) => f.modeles.length);
  // le budget de la mission
  const M = missionById(ctx.B.mission || '');
  const used = ctx.B.appareils.reduce((s, a) => s + ((CATALOGUE[a.modele] || {}).prix || 0), 0);
  if (M && M.budget) box.append(el('p', { class: 'ep-budget ' + (used <= M.budget ? 'ok' : 'ko') }, `Budget : ${used.toLocaleString('fr-FR')} € sur ${M.budget.toLocaleString('fr-FR')} € (ordres de grandeur du catalogue).`));
  else if (used) box.append(el('p', { class: 'ep-budget' }, `Valeur du matériel sorti : ≈ ${used.toLocaleString('fr-FR')} € HT.`));
  // la recherche et les familles
  const q = el('input', { type: 'search', value: ST.q, placeholder: 'Chercher : HE20, ATEM, PoE, XLR…', 'aria-label': 'Chercher dans le stock', 'data-k': 'stock:q' });
  const chips = el('div', { class: 'ep-chips', role: 'group', 'aria-label': 'Famille' },
    ...[['', 'Tout'], ...familles.map((f) => [f.id, f.nom])].map(([id, nom]) => el('button', { type: 'button', class: 'btn small' + (ST.fam === id ? ' on' : ''), 'aria-pressed': String(ST.fam === id), 'data-k': `stock:fam:${id}`, onclick: () => { ST.fam = id; draw(); for (const b of chips.children) { const on = /** @type {HTMLElement} */ (b).dataset.k === `stock:fam:${id}`; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); } } }, nom)));
  const list = el('div', { class: 'ep-stock-list' });
  box.append(el('div', { class: 'ep-stock-search' }, q), chips, list);
  const draw = () => {
    const t = sans(ST.q.trim());
    list.replaceChildren();
    let n = 0;
    for (const f of familles) {
      if (ST.fam && f.id !== ST.fam) continue;
      const ms = f.modeles.filter((m) => !t || sans(`${m.nom} ${m.court} ${m.marque} ${m.role} ${m.id}`).includes(t));
      if (!ms.length) continue;
      const sec = el('section', { class: 'ep-rayon' }, el('h3', {}, f.nom));
      for (const m of ms) {
        n++;
        const nb = ctx.B.appareils.filter((a) => a.modele === m.id).length;
        const place = placeLibre(m.id);
        const sigs = {}; for (const p of m.ports) sigs[p.sig] = (sigs[p.sig] || 0) + 1;
        sec.append(el('div', { class: 'ep-item' },
          el('div', { class: 'ep-item-t' },
            el('b', {}, m.nom),
            el('small', {}, [m.marque, m.prix ? `≈ ${m.prix.toLocaleString('fr-FR')} €` : '', m.watts ? `≈ ${m.watts} W` : '', pose(m), nb ? `${nb} sorti${nb > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ')),
            el('p', {}, m.role),
            el('details', { class: 'ep-fiche-c' }, el('summary', {}, 'Fiche'),
              el('p', { class: 'ep-sigs' }, ...Object.entries(sigs).map(([s, k]) => el('span', { style: `--c:${SIGNAUX[s].couleur}` }, `${k} × ${SIGNAUX[s].nom}`))),
              m.specs && m.specs.length ? el('ul', { class: 'prose' }, ...m.specs.map((s) => el('li', {}, s))) : null)),
          el('button', { type: 'button', class: 'btn small primary', 'data-k': `stock:sortir:${m.id}`, disabled: place ? null : '', title: place ? `Poser sur : ${ZONES[m.pose].nom}` : `Plus de place : ${ZONES[m.pose].nom}`, onclick: () => { const r = sortir(m.id); if (r.ok && r.uid) ctx.open(r.uid); else ctx.say(r.why || 'Impossible.'); } }, 'Sortir')));
      }
      list.append(sec);
    }
    if (!n) list.append(el('p', { class: 'note' }, 'Rien dans le stock ne correspond à cette recherche.'));
  };
  q.addEventListener('input', () => { ST.q = q.value; draw(); });
  draw();
  // ce qui est sorti
  const sortis = ctx.B.appareils.filter((a) => a.modele !== 'mur');
  if (sortis.length) box.append(el('h3', {}, `Sorti du stock (${sortis.length})`), el('ul', { class: 'ep-cf-list' }, ...sortis.map((a) => {
    const P = ctx.E.power[a.uid];
    return el('li', {}, el('button', { type: 'button', class: 'linkbtn', onclick: () => ctx.open(a.uid) }, a.nom), el('small', {}, `${(CATALOGUE[a.modele] || { court: a.modele }).court} · ${ZONES[a.place.zone].nom}${a.place.zone === 'rack' ? ' U ' + a.place.slot : ''}${P && !P.on ? ' · éteint' : ''}`));
  })));
  return box;
}
