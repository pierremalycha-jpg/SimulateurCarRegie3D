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
import { lessonById as coursLesson } from '../cours/index.js';
import { NOTIONS } from '../camlab/notions/index.js';

// ----------------------------------------------------------------------------------
// Le livret de compétences à l'écran : un résumé par bloc (épreuve, barre des niveaux), puis
// chaque compétence avec les activités du simulateur qui la font travailler, réussies ou non.
// Le stagiaire l'ouvre depuis le chef de car ; le formateur le voit pour chaque stagiaire dans
// l'onglet Stagiaires de l'espace formateur, et l'exporte en CSV.
// ----------------------------------------------------------------------------------

/** progression de ce navigateur, avec les missions réussies depuis le dernier enregistrement */
export const liveProg = () => ({ ...PROG, missions: { ...PROG.missions, ...S.missionsDone } });

const KIND = { parcours: 'Parcours', mission: 'Mission', phase: 'Jour de match', reseau: 'Réseau ST 2110', exercice: 'Exercice', cours: 'Cours', exo: 'Exercice du Cours', camera: 'Caméra 3D' };
const EXO = { brassage: 'Brassage complet du car', atelier: 'Monter une caméra à l\'atelier', quiz2110: 'Quiz ST 2110 réussi', examenReseau: 'Examen réseau réussi', entrepot: 'Une régie mobile montée dans l\'entrepôt (mission réussie)' };
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
    case 'cours': { const f = coursLesson(a.ref); return f ? f.lesson.title : a.ref; }
    case 'exo': { const f = coursLesson(a.ref); return f ? `Exercice en autonomie : ${f.lesson.title}` : a.ref; }
    case 'camera': return a.ref === 'mes' ? 'Mise en service de la caméra de plateau (notée)' : NOTIONS[a.ref] ? `Notion « ${NOTIONS[a.ref].t} »` : a.ref;
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
    el('small', {}, `Travaillée : au moins une activité réussie. Consolidée : ${CONSOLIDE} activités différentes réussies (ou toutes s'il y en a moins), dont un exercice pratique. Un exercice terminé avec « Fais-le pour moi » ne compte qu'une fois refait seul.`));
}

function compRow(c) {
  const main = el('div', { class: 'lv-main' }, el('div', { class: 'lv-t' }, c.titre, c.taches ? el('small', {}, ' · ' + c.taches) : null));
  if (!c.total) main.append(el('p', { class: 'lv-later' }, 'Pas encore dans le simulateur.' + (c.prevu.length ? ` Prévu avec ${c.prevu.length > 1 ? 'les modules' : 'le module'} ${modules(c.prevu)}.` : '')));
  else {
    // les notions du module caméra tiennent sur une ligne : combien sont acquises, et lesquelles
    const notions = c.acts.filter((a) => a.kind === 'camera' && a.ref !== 'mes');
    const nd = notions.filter((a) => a.done);
    const camLine = notions.length ? el('li', { class: 'lv-act' + (nd.length === notions.length ? ' done' : '') },
      nd.length === notions.length ? icon('fait') : el('span', { class: 'lv-dot', 'aria-hidden': 'true' }),
      el('span', { class: 'sr' }, nd.length === notions.length ? 'réussi : ' : 'en cours : '),
      el('span', {}, el('em', {}, KIND.camera), ` Notions acquises : ${nd.length} / ${notions.length}`, nd.length ? el('small', {}, ' (' + nd.map((a) => NOTIONS[a.ref] ? NOTIONS[a.ref].t : a.ref).join(', ') + ')') : null)) : null;
    main.append(el('ul', { class: 'lv-acts' }, ...c.acts.filter((a) => !notions.includes(a)).map((a) => el('li', { class: 'lv-act' + (a.done ? ' done' : '') },
      a.done ? icon('fait') : el('span', { class: 'lv-dot', 'aria-hidden': 'true' }),
      el('span', { class: 'sr' }, a.done ? 'réussi : ' : 'à faire : '),
      el('span', {}, el('em', {}, KIND[a.kind]), ' ', activityLabel(a), a.aided ? el('small', {}, ' (terminé avec de l\'aide : à refaire seul pour qu\'il compte)') : null))), camLine));
    if (c.niveau === 'travaillee' && c.pratique.total && !c.pratique.done && c.done >= Math.min(CONSOLIDE, c.total)) main.append(el('p', { class: 'lv-later' }, 'Pour la consolider : réussir seul un de ses exercices pratiques (les quiz seuls ne suffisent pas).'));
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
