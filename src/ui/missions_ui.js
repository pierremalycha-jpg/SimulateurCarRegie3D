// @ts-check
import { el } from '../util.js';
import { icon } from './icons.js';
import { PROG } from '../shared.js';
import { FAMILLES, catalogue, dejaFaite } from '../game/missions.js';

// ----------------------------------------------------------------------------------
// La liste des missions spécifiques (game/missions.js), rangée par famille, les exercices d'Olivier
// par chapitre du Cours (repliés, sauf celui de la mission choisie). Une seule est choisie à la fois
// (aria-pressed) ; elle se lance ailleurs (l'écran Jouer, ou « Mission suivante » dans le car).
// ----------------------------------------------------------------------------------
/**
 * @param {string} sel la mission choisie
 * @param {(id: string) => void} onPick
 */
export function missionPicker(sel, onPick) {
  const all = catalogue();
  const item = (/** @type {import('../game/missions.js').MissionCar} */ m) => {
    const done = dejaFaite(m, PROG);
    return el('button', { type: 'button', class: 'mc-item' + (done ? ' done' : ''), 'data-mission': m.id, 'aria-pressed': String(m.id === sel), onclick: () => onPick(m.id) },
      icon(done ? 'fait' : m.kind === 'epreuve' ? 'trophee' : 'suivant'),
      el('span', { class: 'mc-t' }, el('b', {}, m.titre), el('small', {}, [m.duree, m.niveau, m.kind === 'epreuve' ? 'notée' : '', done ? 'déjà réussie' : ''].filter(Boolean).join(' · '))));
  };
  const box = el('div', { class: 'mc-pick', role: 'group', 'aria-label': 'Les missions' });
  for (const f of FAMILLES) {
    const list = all.filter((m) => m.famille === f.id);
    const faites = list.filter((m) => dejaFaite(m, PROG)).length;
    const sec = el('section', { class: 'mc-fam', 'data-famille': f.id },
      el('h3', {}, icon(f.ico), el('span', {}, f.titre), el('small', {}, `${faites} / ${list.length}`)),
      el('p', { class: 'mc-fam-sum' }, f.resume));
    for (const g of [...new Set(list.map((m) => m.groupe || ''))]) {
      const xs = list.filter((m) => (m.groupe || '') === g);
      if (!g) { sec.append(el('div', { class: 'mc-items' }, ...xs.map(item))); continue; }
      sec.append(el('details', { class: 'mc-grp', open: xs.some((m) => m.id === sel) ? '' : null },
        el('summary', {}, el('span', {}, g), el('small', {}, `${xs.filter((m) => dejaFaite(m, PROG)).length} / ${xs.length}`)),
        el('div', { class: 'mc-items' }, ...xs.map(item))));
    }
    box.append(sec);
  }
  return box;
}
