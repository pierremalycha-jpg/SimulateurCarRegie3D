// @ts-check
import { el } from '../util.js';
import { icon } from './icons.js';
import { FICHE, EPREUVES, COMPETENCES, SAVOIR_FAIRE, SAVOIRS, NIVEAUX_SAVOIR, FAMILLES_SAVOIRS, TMO, MODULES, competence, competencesDe, epreuveDe, familleDe } from '../content/referentiel.js';
import { ACTIVITES, livret } from '../livret.js';
import { allLessons } from '../cours/index.js';
import { activityLabel, liveProg, openLivret } from './livret.js';

// ----------------------------------------------------------------------------------
// Le référentiel du BTS MAV option TIEE cité dans le Cours (v19.23) : en fin de leçon, les compétences
// travaillées avec leur unité et leur épreuve, les savoir-faire et les savoirs concernés ; en tête de chapitre,
// les compétences et les familles de savoirs du chapitre ; et la page « Le référentiel du BTS » : les épreuves de
// l'option, l'épreuve E4 (TMO) et ses quatorze compétences, puis chaque compétence (tâches, savoir-faire,
// savoirs, résultats attendus) avec les activités du simulateur qui la font travailler. Les données viennent de
// content/referentiel.js (texte officiel) ; ce fichier ne fait que les afficher.
// ----------------------------------------------------------------------------------
/** @typedef {import('./cours_parcours.js').Go} Go */

/** « U4 · E4 Techniques et mise en œuvre (TMO) » */
export function uniteLabel(/** @type {string} */ unite, court = false) {
  const e = epreuveDe(unite);
  if (!e) return unite;
  return court ? `${unite} · ${e.id}${e.sigle ? ' ' + e.sigle : ''}` : `${unite} · ${e.id} ${e.titre}${e.sigle ? ` (${e.sigle})` : ''}`;
}
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
/** la pastille d'un savoir : code, intitulé, niveau demandé à l'option TIEE */
export function savoirChip(/** @type {string} */ code) {
  const s = SAVOIRS[code]; if (!s) return null;
  return el('span', { class: 'co-chip co-ref-sav', title: `${familleDe(code)}${s.niveau ? ` · niveau ${s.niveau}, ${NIVEAUX_SAVOIR[s.niveau]}` : ''}` }, el('b', {}, code), ` ${s.t}`, s.niveau ? el('small', {}, ` niv. ${s.niveau}`) : null);
}
/** une compétence en une ligne : code, intitulé, unité ; cliquable vers la page du référentiel */
function compLine(/** @type {string} */ code, /** @type {Go} */ go) {
  const c = competence(code); if (!c) return null;
  return el('li', {}, el('button', { type: 'button', class: 'co-ref-comp', 'data-code': c.code, onclick: () => go.referentiel && go.referentiel(c.code) },
    el('b', {}, c.code), el('span', {}, c.titre), el('small', {}, uniteLabel(c.unite, true))));
}

/**
 * Le bloc « Référentiel » d'une leçon : ses compétences, l'épreuve qui les évalue (la TMO quand c'est le cas), les
 * savoir-faire et les savoirs concernés (repliés), et le lien vers la page du référentiel.
 * @param {import('../cours/index.js').Lesson} L
 * @param {Go} go
 */
export function refBlock(L, go) {
  const codes = (L.competences || []).filter((c) => competence(c));
  const savoirs = (L.savoirs || []).filter((s) => SAVOIRS[s]);
  if (!codes.length && !savoirs.length) return null;
  const tmo = codes.filter((c) => TMO.includes(c));
  const unites = [...new Set(codes.map((c) => /** @type {any} */ (competence(c)).unite))];
  const sf = codes.flatMap((c) => /** @type {any} */ (competence(c)).sf.map((k) => ({ c, k })));
  const box = el('section', { class: 'co-ref', 'aria-label': 'Référentiel du BTS' },
    el('h4', {}, icon('livret'), 'Référentiel BTS MAV, option TIEE'),
    el('p', { class: 'co-ref-lede' }, tmo.length ? `${plural(tmo.length, 'compétence évaluée', 'compétences évaluées')} à l'épreuve E4, Techniques et mise en œuvre (TMO)${codes.length > tmo.length ? `, ${plural(codes.length - tmo.length, 'autre', 'autres')} en ${unites.filter((u) => u !== 'U4').map((u) => uniteLabel(u, true)).join(' et ')}` : ''}.`
      : `${plural(codes.length, 'compétence évaluée', 'compétences évaluées')} en ${unites.map((u) => uniteLabel(u, true)).join(' et ')}.`),
    el('ul', { class: 'co-ref-list' }, ...codes.map((c) => compLine(c, go))));
  if (sf.length || savoirs.length) {
    box.append(el('details', { class: 'co-ref-det' }, el('summary', {}, `${plural(sf.length, 'savoir-faire', 'savoir-faire')} et ${plural(savoirs.length, 'savoir', 'savoirs')} du référentiel`),
      sf.length ? el('ul', { class: 'co-ref-sf' }, ...sf.map(({ c, k }) => el('li', {}, el('b', {}, k), ` ${SAVOIR_FAIRE[k] || ''}`, el('small', {}, ` (${c})`)))) : null,
      savoirs.length ? el('div', { class: 'co-chips' }, ...savoirs.map(savoirChip)) : null,
      el('p', { class: 'note' }, 'Niveau : le degré de maîtrise que le référentiel demande à l\'option TIEE, de 1 (information) à 4 (maîtrise méthodologique).')));
  }
  box.append(el('div', { class: 'hwrow' }, el('button', { type: 'button', class: 'btn small co-ref-btn', onclick: () => go.referentiel && go.referentiel(codes[0]) }, icon('livret'), 'Le référentiel du BTS')));
  return box;
}

/**
 * En tête du chemin d'un chapitre : les compétences que ses leçons font travailler et les familles de savoirs
 * qu'il couvre.
 * @param {import('../cours/index.js').Chapter} ch
 * @param {Go} go
 */
export function chapitreRef(ch, go) {
  const codes = [...new Set(ch.lessons.flatMap((l) => l.competences || []))].filter((c) => competence(c)).sort((a, b) => /** @type {any} */ (competence(a)).n - /** @type {any} */ (competence(b)).n);
  const savoirs = [...new Set(ch.lessons.flatMap((l) => l.savoirs || []))].filter((s) => SAVOIRS[s]);
  if (!codes.length) return null;
  const fams = [...new Set(savoirs.map((s) => s[0]))].map((f) => `${FAMILLES_SAVOIRS[f]} (${savoirs.filter((s) => s[0] === f).sort().join(', ')})`);
  const tmo = codes.filter((c) => TMO.includes(c));
  return el('section', { class: 'co-ref co-ref-chap', 'aria-label': 'Référentiel du BTS' },
    el('h4', {}, icon('livret'), 'Dans le référentiel du BTS MAV, option TIEE'),
    el('p', { class: 'co-ref-lede' }, `${plural(codes.length, 'compétence', 'compétences')} travaillée${codes.length > 1 ? 's' : ''} par ce chapitre${tmo.length ? `, dont ${plural(tmo.length, 'évaluée', 'évaluées')} à l'épreuve E4 (TMO)` : ''}.`),
    el('div', { class: 'co-chips' }, ...codes.map((c) => el('button', { type: 'button', class: 'co-chip co-ref-chip' + (TMO.includes(c) ? ' tmo' : ''), 'data-code': c, title: /** @type {any} */ (competence(c)).titre, onclick: () => go.referentiel && go.referentiel(c) }, el('b', {}, c), ` ${/** @type {any} */ (competence(c)).titre}`))),
    fams.length ? el('p', { class: 'co-ref-fams' }, el('b', {}, 'Savoirs : '), fams.join(' · ')) : null);
}

// ---------------- la page « Le référentiel du BTS » ----------------
/** les leçons du Cours qui travaillent une compétence */
const leconsDe = (code) => allLessons().filter(({ lesson }) => (lesson.competences || []).includes(code));
function tableEpreuves() {
  const t = el('table', { class: 'co-ref-table' }, el('thead', {}, el('tr', {}, ...['Épreuve', 'Unité', 'Coef.', 'En CCF (scolaires)', 'Forme ponctuelle'].map((h) => el('th', {}, h)))),
    el('tbody', {}, ...EPREUVES.map((e) => el('tr', { class: e.id === 'E4' ? 'tmo' : '' }, el('td', {}, el('b', {}, e.id), ` ${e.titre}`, e.sigle ? el('small', {}, ` (${e.sigle})`) : null), el('td', {}, e.unite), el('td', {}, String(e.coef)), el('td', {}, e.ccf), el('td', {}, e.ponctuel)))));
  return el('div', { class: 'tblwrap' }, t);
}
function carteCompetence(c, go, L, ouverte) {
  const acts = ACTIVITES[c.code] || [];
  const comp = L.comps.find((x) => x.code === c.code);
  const lecons = leconsDe(c.code);
  const det = el('details', { class: 'co-ref-card', id: 'ref-' + c.code, open: ouverte ? '' : null },
    el('summary', {}, el('b', {}, c.code), el('span', {}, c.titre), el('small', {}, `${plural(c.sf.length, 'savoir-faire', 'savoir-faire')} · ${acts.length ? plural(acts.length, 'activité', 'activités') + ' dans le simulateur' : 'pas encore dans le simulateur'}`), comp ? el('span', { class: 'pill' + (comp.niveau === 'consolidee' ? ' ok' : comp.niveau === 'travaillee' ? ' warn' : comp.niveau === 'absent' ? ' lv-off' : '') }, { consolidee: 'Consolidée', travaillee: 'Travaillée', a_faire: 'À travailler', absent: 'Hors simulateur' }[comp.niveau]) : null),
    el('p', { class: 'co-ref-attendu' }, el('b', {}, 'Résultat attendu : '), c.attendu),
    el('p', { class: 'co-ref-meta' }, el('b', {}, 'Tâches : '), c.taches, ' · ', el('b', {}, 'Ancien numéro du simulateur : '), c.ancien),
    el('ul', { class: 'co-ref-sf' }, ...c.sf.map((k) => el('li', {}, el('b', {}, k), ` ${SAVOIR_FAIRE[k] || ''}`))),
    el('div', { class: 'co-chips' }, ...c.savoirs.map(savoirChip)));
  const sim = el('div', { class: 'co-ref-sim' }, el('h5', {}, 'Dans le simulateur'));
  if (lecons.length) sim.append(el('div', { class: 'co-chips' }, ...lecons.map(({ chapter, lesson }) => el('button', { type: 'button', class: 'co-chip co-ref-lecon', 'data-lesson': lesson.id, onclick: () => go.lecon(lesson.id) }, icon(chapter.icon), ` ${lesson.title}`))));
  const autres = acts.filter((a) => a.kind !== 'cours' && a.kind !== 'exo' && !(a.kind === 'camera' && a.ref !== 'mes'));
  const notions = acts.filter((a) => a.kind === 'camera' && a.ref !== 'mes').length;
  if (autres.length || notions) sim.append(el('p', { class: 'note' }, [...autres.slice(0, 8).map((a) => activityLabel(a)), ...(autres.length > 8 ? [`et ${autres.length - 8} autres`] : []), ...(notions ? [`${notions} notions de la caméra en 3D`] : [])].join(' · ')));
  if (!acts.length) sim.append(el('p', { class: 'note' }, 'Pas encore dans le simulateur.' + (c.prevu.length ? ` Prévu avec ${c.prevu.length > 1 ? 'les modules' : 'le module'} ${c.prevu.map((m) => `« ${MODULES[m]} »`).join(' et ')}.` : '')));
  else if (c.couverture === 'partie') sim.append(el('p', { class: 'note' }, 'Le simulateur n\'en couvre qu\'une partie' + (c.prevu.length ? ` ; ${c.prevu.length > 1 ? 'les modules' : 'le module'} ${c.prevu.map((m) => `« ${MODULES[m]} »`).join(' et ')} la complèteront.` : '.')));
  det.append(sim);
  return det;
}
/**
 * La page du référentiel dans le Cours.
 * @param {HTMLElement} page
 * @param {Go} go
 * @param {{ code?: string | null }} [opts] compétence à ouvrir et à montrer
 */
export function pageReferentiel(page, go, opts = {}) {
  const L = livret(liveProg());
  const e4 = /** @type {any} */ (epreuveDe('U4'));
  const code = opts.code && competence(opts.code) ? opts.code : null;
  page.append(el('p', { class: 'co-crumb' }, icon('livret'), 'Le référentiel du BTS'),
    el('h2', {}, 'Le référentiel du BTS MAV, option TIEE'),
    el('p', { class: 'lede' }, `${FICHE.arrete}. Fiche ${FICHE.code}, enregistrée jusqu'au ${FICHE.echeance}. Chaque leçon, chaque exercice et chaque mission du simulateur est rattaché aux compétences C1 à C39 de l'option ; le livret suit ce que vous avez pratiqué.`),
    el('section', { class: 'co-ref-sec', 'aria-label': 'Les épreuves' }, el('h3', {}, 'Les épreuves de l\'option'), tableEpreuves(),
      el('p', { class: 'note' }, 'CCF : contrôle en cours de formation (établissements publics ou privés sous contrat, apprentis habilités) ; les autres candidats passent la forme ponctuelle. Règlement d\'examen et définition des épreuves : annexes 4 et 5 de l\'arrêté.')),
    el('section', { class: 'co-ref-sec co-ref-tmo', 'aria-label': 'L\'épreuve E4' }, el('h3', {}, 'E4, Techniques et mise en œuvre (TMO) : ce que l\'épreuve attend'),
      el('p', {}, e4.objet),
      el('p', {}, el('b', {}, 'En CCF : '), e4.ccf, '. ', el('b', {}, 'En ponctuel : '), e4.ponctuel, '. Coefficient ', String(e4.coef), '.'),
      el('p', {}, el('b', {}, `Les ${TMO.length} compétences de l'unité U4 : `), 'celles que les sujets de TMO cochent en tête de page.'),
      el('div', { class: 'co-chips' }, ...TMO.map((c) => el('button', { type: 'button', class: 'co-chip co-ref-chip tmo', 'data-code': c, onclick: () => { const d = /** @type {HTMLDetailsElement | null} */ (page.querySelector('#ref-' + c)); if (d) { d.open = true; d.scrollIntoView({ block: 'start', behavior: 'smooth' }); } } }, el('b', {}, c), ` ${/** @type {any} */ (competence(c)).titre}`)))));
  for (const u of ['U3', 'U4', 'U51', 'U52', 'U6']) {
    const e = /** @type {any} */ (epreuveDe(u));
    const list = competencesDe(u);
    page.append(el('section', { class: 'co-ref-sec', 'data-unite': u, 'aria-label': uniteLabel(u) },
      el('h3', {}, `${u} · ${e.id} ${e.titre}`, e.sigle ? el('small', {}, ` ${e.sigle}`) : null),
      el('p', { class: 'note' }, `${plural(list.length, 'compétence', 'compétences')} · ${e.objet || ''}`),
      ...list.map((c) => carteCompetence(c, go, L, c.code === code))));
  }
  // les savoirs par famille, avec le niveau demandé à l'option
  const fams = Object.keys(FAMILLES_SAVOIRS);
  page.append(el('section', { class: 'co-ref-sec', 'aria-label': 'Les savoirs' }, el('h3', {}, 'Les savoirs et leur niveau pour l\'option TIEE'),
    el('p', { class: 'note' }, 'Niveau 1 : information · 2 : expression · 3 : maîtrise d\'outils · 4 : maîtrise méthodologique (référentiel, « relations entre les savoirs et les niveaux d\'approfondissement »).'),
    ...fams.map((f) => el('details', { class: 'co-ref-fam' }, el('summary', {}, el('b', {}, f), ` ${FAMILLES_SAVOIRS[f]}`, el('small', {}, ` ${Object.keys(SAVOIRS).filter((k) => k[0] === f).length} savoirs`)),
      el('ul', { class: 'co-ref-sf' }, ...Object.entries(SAVOIRS).filter(([k]) => k[0] === f).map(([k, s]) => el('li', {}, el('b', {}, k), ` ${s.t}`, el('small', {}, s.niveau ? ` niveau ${s.niveau}` : ' niveau non lisible dans le tableau'))))))));
  page.append(el('div', { class: 'hwrow' }, el('button', { type: 'button', class: 'btn small', onclick: () => openLivret() }, icon('livret'), 'Mon livret de compétences'), el('button', { type: 'button', class: 'btn small', onclick: () => go.accueil() }, 'Mon parcours')));
  if (code) { const d = page.querySelector('#ref-' + code); if (d) setTimeout(() => d.scrollIntoView({ block: 'start' }), 50); }
  // le nombre de compétences, pour la ligne d'état et les tests
  page.dataset.competences = String(COMPETENCES.length);
}
