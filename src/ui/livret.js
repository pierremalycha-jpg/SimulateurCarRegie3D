// @ts-check
import { S } from '../state.js';
import { el } from '../util.js';
import { modal } from './common.js';
import { icon } from './icons.js';
import { PROG } from '../shared.js';
import { lessonById } from '../tutor/engine.js';
import { MISSIONS } from './guide.js';
import { NET_MISSIONS } from '../net/course.js';
import { PHASES } from '../scenario.js';
import { FICHE, MODULES } from '../content/referentiel.js';
import { livret, NIVEAUX, CONSOLIDE } from '../livret.js';

// ----------------------------------------------------------------------------------
// Le livret de compétences à l'écran : un résumé par bloc (épreuve, barre des niveaux), puis
// chaque compétence avec les activités du simulateur qui la font travailler, réussies ou non.
// Le stagiaire l'ouvre depuis le chef de car ; le formateur le voit pour chaque stagiaire dans
// l'onglet Stagiaires de l'espace formateur, et l'exporte en CSV.
// ----------------------------------------------------------------------------------

/** progression de ce navigateur, avec les missions réussies depuis le dernier enregistrement */
export const liveProg = () => ({ ...PROG, missions: { ...PROG.missions, ...S.missionsDone } });

const KIND = { parcours: 'Parcours', mission: 'Mission', phase: 'Jour de match', reseau: 'Réseau ST 2110', exercice: 'Exercice' };
const EXO = { brassage: 'Brassage complet du car', atelier: 'Monter une caméra à l\'atelier', quiz2110: 'Quiz ST 2110 réussi', examenReseau: 'Examen réseau réussi' };
const ORDER = /** @type {const} */ (['consolidee', 'travaillee', 'a_faire', 'absent']);
const PILL = { consolidee: 'pill ok', travaillee: 'pill warn', a_faire: 'pill', absent: 'pill lv-off' };

/** @param {{ kind: string, ref: string }} a */
export function activityLabel(a) {
  const find = (list) => { const x = list.find((m) => m.id === a.ref); return x ? x.title : a.ref; };
  switch (a.kind) {
    case 'parcours': { const l = lessonById(a.ref); return l ? l.title : a.ref; }
    case 'mission': return find(MISSIONS);
    case 'phase': return find(PHASES);
    case 'reseau': return find(NET_MISSIONS);
    default: return EXO[a.ref] || a.ref;
  }
}
const modules = (ids) => ids.map((id) => `« ${MODULES[id]} »`).join(' et ');
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

function bar(count) {
  const label = ORDER.filter((k) => count[k]).map((k) => `${NIVEAUX[k]} : ${count[k]}`).join(', ');
  return el('div', { class: 'lv-bar', role: 'img', 'aria-label': label, title: label }, ...ORDER.map((k) => (count[k] ? el('i', { class: 'lv-' + k, style: { flexGrow: String(count[k]) } }) : null)));
}
function legend() {
  return el('div', { class: 'lv-legend' }, ...ORDER.map((k) => el('span', {}, el('i', { class: 'lv-' + k }), NIVEAUX[k])),
    el('small', {}, `Travaillée : au moins une activité réussie. Consolidée : ${CONSOLIDE} activités différentes réussies, ou toutes s'il y en a moins.`));
}

function compRow(c) {
  const main = el('div', { class: 'lv-main' }, el('div', { class: 'lv-t' }, c.titre, c.taches ? el('small', {}, ' · ' + c.taches) : null));
  if (!c.total) main.append(el('p', { class: 'lv-later' }, 'Pas encore dans le simulateur.' + (c.prevu.length ? ` Prévu avec ${c.prevu.length > 1 ? 'les modules' : 'le module'} ${modules(c.prevu)}.` : '')));
  else {
    main.append(el('ul', { class: 'lv-acts' }, ...c.acts.map((a) => el('li', { class: 'lv-act' + (a.done ? ' done' : '') },
      a.done ? icon('fait') : el('span', { class: 'lv-dot', 'aria-hidden': 'true' }),
      el('span', { class: 'sr' }, a.done ? 'réussi : ' : 'à faire : '),
      el('span', {}, el('em', {}, KIND[a.kind]), ' ', activityLabel(a), a.aided ? el('small', {}, ' (aidé)') : null)))));
    if (c.couverture === 'partie') main.append(el('p', { class: 'lv-later' }, 'Le simulateur n\'en couvre qu\'une partie' + (c.prevu.length ? ` ; ${c.prevu.length > 1 ? 'les modules' : 'le module'} ${modules(c.prevu)} la complèteront.` : '.')));
  }
  return el('li', { class: 'lv-comp lv-' + c.niveau },
    el('span', { class: 'lv-code' }, c.code), main,
    el('div', { class: 'lv-state' }, el('span', { class: PILL[c.niveau] }, NIVEAUX[c.niveau]), c.total ? el('small', {}, `${c.done} / ${c.total}`) : null));
}

/**
 * Le livret d'une progression (PROG ou document progress/<id>).
 * @param {any} prog
 * @param {{ open?: string }} [opts] bloc à ouvrir d'emblée
 */
export function livretPanel(prog, opts = {}) {
  const L = livret(prog);
  const inSim = L.total - L.count.absent;
  const worked = L.count.consolidee + L.count.travaillee;
  const dets = L.blocs.map((b) => {
    const d = el('details', { class: 'lv-bloc' },
      el('summary', {}, el('b', {}, b.id), el('span', {}, b.titre), el('small', {}, `${b.count.consolidee + b.count.travaillee} / ${b.comps.length}`)),
      el('ol', { class: 'lv-list' }, ...b.comps.map(compRow)));
    d.open = opts.open === b.id;
    return d;
  });
  const cards = L.blocs.map((b, i) => el('button', { class: 'lv-card', type: 'button', 'aria-label': `${b.id} ${b.titre} : voir les compétences`, onclick: () => { dets[i].open = true; dets[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } },
    el('span', { class: 'lv-card-h' }, el('b', {}, b.id), el('span', {}, b.titre)),
    el('small', {}, `${b.epreuve} · ${b.forme}`),
    bar(b.count),
    el('small', { class: 'lv-n' }, `${plural(b.count.consolidee + b.count.travaillee, 'travaillée', 'travaillées')} sur ${b.comps.length}` + (b.count.absent ? ` · ${b.count.absent} hors simulateur` : ''))));
  return el('div', { class: 'lv' },
    el('p', { class: 'lv-intro' }, `${worked} compétence${worked > 1 ? 's' : ''} travaillée${worked > 1 ? 's' : ''} sur les ${inSim} que le simulateur fait pratiquer (${L.count.consolidee} consolidée${L.count.consolidee > 1 ? 's' : ''}). Le référentiel de l'option TIEE (fiche ${FICHE.code}) en compte ${L.total} ; les ${L.count.absent} autres arrivent avec les prochains modules.`),
    el('div', { class: 'lv-sum' }, ...cards),
    legend(),
    ...dets,
    el('p', { class: 'note' }, 'Le livret montre ce qui a été pratiqué dans le simulateur. Valider une compétence reste le rôle du formateur, en situation.'));
}

/** cellule du tableau de suivi : compétences travaillées sur celles que le simulateur fait pratiquer */
export function livretCell(prog) {
  const L = livret(prog); const inSim = L.total - L.count.absent;
  return `${L.count.consolidee + L.count.travaillee} / ${inSim}` + (L.count.consolidee ? ` · ${L.count.consolidee} cons.` : '');
}

/**
 * Export des livrets : une ligne par stagiaire, une colonne par compétence (niveau atteint).
 * @param {{ name: string, prog: any }[]} rows
 */
export function livretCSV(rows) {
  const L0 = livret({});
  const head = ['Stagiaire', 'Travaillées', 'Consolidées', ...L0.comps.map((c) => `${c.code} ${c.titre}`)];
  const q = (s) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [head.map(q).join(';')];
  for (const r of rows) {
    const L = livret(r.prog);
    lines.push([r.name, String(L.count.consolidee + L.count.travaillee), String(L.count.consolidee), ...L.comps.map((c) => NIVEAUX[c.niveau])].map(q).join(';'));
  }
  return '\uFEFF' + lines.join('\r\n');
}

/** le livret du stagiaire de ce navigateur */
export function openLivret() {
  modal.open('Mon livret de compétences', livretPanel(liveProg()), { width: 980 });
}
