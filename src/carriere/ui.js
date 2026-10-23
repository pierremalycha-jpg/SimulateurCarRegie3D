// @ts-check
import { el } from '../util.js';
import { rich } from '../ui/rich.js';
import { icon } from '../ui/icons.js';
import { PROG, CFG, saveProgressSoon } from '../shared.js';
import { boite, avancement, marquerLu, nonLus } from './index.js';
import { SOCIETE_DEFAUT } from './mails.js';

// ----------------------------------------------------------------------------------
// La messagerie de l'ordinateur du bureau (panneau de l'entrepôt en mode Carrière) : la boîte de
// réception, du plus récent au plus ancien, puis le mail ouvert. Une proposition de poste porte
// son ordre de mission : le poste, le lieu, la durée, ce qu'on attend (coché d'après la
// progression) et le bouton qui y emmène. Ouvrir un mail le marque comme lu.
// ----------------------------------------------------------------------------------
/** @typedef {{ lancer: (id: string) => void, refresh: () => void }} Ctx */
/** le mail ouvert ('' : la boîte de réception) */
export const MSG = { sel: '' };

export const societe = () => (CFG.car.company || '').trim() || SOCIETE_DEFAUT;
const date = (/** @type {number} */ t) => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

/** ouvre un mail (le marque comme lu) */
export function ouvrirMail(/** @type {string} */ id) {
  MSG.sel = id;
  if (marquerLu(PROG, id)) saveProgressSoon();
}

/** @param {Ctx} ctx */
export function renderMessagerie(ctx) {
  const mails = boite(PROG, { societe: societe() });
  const box = el('div', { class: 'cr-mail' });
  const m = mails.find((x) => x.id === MSG.sel);
  if (!m) {
    MSG.sel = '';
    const n = nonLus(PROG);
    box.append(el('p', { class: 'cr-who' }, el('b', {}, 'Boîte de réception'), el('small', {}, ` · ${societe()} · ${n ? `${n} non lu${n > 1 ? 's' : ''}` : 'tout est lu'}`)));
    if (!mails.length) { box.append(el('p', { class: 'note' }, 'Aucun mail pour l\'instant.')); return box; }
    box.append(el('ul', { class: 'cr-list', 'aria-label': 'Mails reçus' }, ...mails.map((x) => {
      const A = avancement(x.ep, PROG);
      const tag = x.kind === 'retour' ? 'Mission réussie' : A.fait ? `${x.ep.poste} · réussie` : A.n ? `${x.ep.poste} · en cours ${A.n} / ${A.total}` : `Proposition de poste : ${x.ep.poste}`;
      return el('li', {}, el('button', { type: 'button', class: 'cr-row' + (x.lu ? '' : ' unread'), 'data-mail': x.id, 'data-k': 'mail:' + x.id, onclick: () => { ouvrirMail(x.id); ctx.refresh(); } },
        el('i', { class: 'cr-dot', 'aria-hidden': 'true' }),
        el('span', { class: 'cr-row-t' }, el('b', {}, x.de.nom, el('small', {}, ` · ${x.de.role}`)), el('span', { class: 'cr-obj' }, x.objet), el('small', { class: 'cr-tag' + (x.kind === 'retour' || A.fait ? ' ok' : '') }, tag)),
        el('small', { class: 'cr-date' }, date(x.recu)), x.lu ? null : el('span', { class: 'sr' }, ' (non lu)')));
    })));
    return box;
  }
  box.append(el('button', { type: 'button', class: 'linkbtn cr-back', 'data-k': 'mail:retour', onclick: () => { MSG.sel = ''; ctx.refresh(); } }, '← Boîte de réception'),
    el('h3', { class: 'cr-objet' }, m.objet),
    el('p', { class: 'cr-meta' }, el('span', {}, el('b', {}, 'De : '), `${m.de.nom}, ${m.de.role} (${societe()})`), el('span', {}, el('b', {}, 'À : '), 'toi'), el('span', {}, el('b', {}, 'Reçu le : '), date(m.recu))),
    rich(m.corps, 'cr-body'));
  if (m.kind === 'offre') {
    const M = m.ep.mission; const A = avancement(m.ep, PROG);
    box.append(el('section', { class: 'cr-ordre' + (A.fait ? ' ok' : ''), 'aria-label': 'Ordre de mission' },
      el('h4', {}, icon(A.fait ? 'fait' : 'missions'), 'Ordre de mission'),
      el('dl', {}, el('dt', {}, 'Poste'), el('dd', {}, m.ep.poste), el('dt', {}, 'Lieu'), el('dd', {}, M.lieu), el('dt', {}, 'Mission'), el('dd', {}, M.titre), el('dt', {}, 'Durée'), el('dd', {}, M.duree)),
      el('p', { class: 'cr-att' }, el('b', {}, 'Ce qu\'on attend de toi'), el('small', {}, ` · ${A.n} / ${A.total}`)),
      el('ul', { class: 'cr-points' }, ...A.points.map((p) => el('li', { class: p.ok ? 'ok' : '' }, icon(p.ok ? 'fait' : 'suivant'), el('span', {}, p.label), p.ok ? el('span', { class: 'sr' }, ' (fait)') : null))),
      A.fait ? el('p', { class: 'cr-done' }, 'Mission réussie. ', el('small', {}, 'Le mail de retour est dans ta boîte de réception.')) : null,
      el('div', { class: 'cr-acts' }, el('button', { type: 'button', class: 'btn' + (A.fait ? ' small' : ' primary'), 'data-k': 'mail:go', onclick: () => ctx.lancer(m.ep.id) }, A.fait ? 'Y retourner' : A.n ? 'Reprendre la mission' : M.bouton))));
  }
  return box;
}
