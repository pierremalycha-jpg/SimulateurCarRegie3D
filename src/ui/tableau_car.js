// @ts-check
import { el } from '../util.js';
import { STATION_INFO, STATION_LIST } from '../content/stations.js';
import { catalogue as catalogueMissions, FAMILLES } from '../game/missions.js';
import { MISSIONS } from './guide.js';
import { DESTS } from '../app/teleport.js';
import { DEV_NAMES } from '../equipment/cabling.js';
import { specialState } from '../cours/exercices.js';
import { bilanCar, joursRecents, dureeS, STATUTS } from '../comptes/bilan.js';

// ----------------------------------------------------------------------------------
// Le car régie dans le tableau de bord du professeur (v19.25) : ce que chaque élève y a fait, lu dans sa
// progression (PROG.car, comptes/suivi_car.js) et calculé par comptes/bilan.js (bilanCar).
//   la classe   le temps passé à chaque poste par chaque élève (et la part de manipulation), l'état de
//               chaque exercice pratique et de chaque épreuve pour chaque élève ;
//   un élève    son temps de jeu (dans le car, dans le stade, aux postes, une caméra en main), poste par
//               poste (ouvertures, temps assis, temps de manipulation, gestes), ses exercices pratiques
//               (réussi seul ou aidé, essais, abandons, indices, « Fais-le pour moi », temps), les tâches du
//               car vide, ce qu'il a consulté, les pannes, ses dernières parties, son activité jour par jour.
// ----------------------------------------------------------------------------------
let CAT = /** @type {import('../comptes/bilan.js').CatalogueCar | null} */ (null);
/** ce que le simulateur propose, lu une fois dans le code de l'application */
export function catalogueCar() {
  if (CAT) return CAT;
  const fam = Object.fromEntries(FAMILLES.map((f) => [f.id, f.titre]));
  CAT = {
    postes: STATION_LIST.map(([id, zone]) => ({ id, zone, titre: (STATION_INFO[id] || {}).title || id })),
    exos: catalogueMissions().map((m) => ({ id: m.id, titre: m.titre, groupe: /** @type {any} */ (m).groupe || fam[m.famille] || '', famille: m.famille, taches: /** @type {any} */ (m).taches })),
    missionsCar: MISSIONS.map((m) => ({ id: m.id, titre: m.title })),
    lieux: DESTS.map((d) => d[0]),
    appareils: DEV_NAMES,
    epreuve: (id, prog) => specialState(id, prog),
  };
  return CAT;
}
export const carDe = (prog) => bilanCar(prog, catalogueCar());

const kpi = (titre, valeur, sous, cls = '') => el('div', { class: 'tb-kpi ' + cls }, el('small', {}, titre), el('b', {}, valeur), el('span', {}, sous));
const pct = (x) => `${Math.round(x * 100)} %`;
const date = (t) => (t ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const pluriel = (n, mot, mots = mot + 's') => `${n} ${n > 1 ? mots : mot}`;
/** l'état d'un exercice, en pastille (couleur et mot : lisible sans la couleur) */
export const pastilleStatut = (/** @type {string} */ s, court = false) => el('span', { class: 'tb-statut st-' + s, title: STATUTS[s] }, court ? ({ seul: 'Seul', aide: 'Aidé', commence: 'En cours', abandon: 'Abandon', afaire: '—' })[s] : STATUTS[s]);
/** une petite barre (part de 0 à 1) */
const jauge = (part, label) => el('span', { class: 'tb-bar', role: 'img', 'aria-label': label }, el('i', { style: { width: Math.round(Math.max(0, Math.min(1, part)) * 100) + '%' } }));

/** l'activité des 14 derniers jours (minutes de travail par jour), en barres */
export function graphiqueJours(prog) {
  const J = joursRecents(prog, 14); const max = Math.max(30, ...J.map((j) => j.min)); const total = J.reduce((s, j) => s + j.min, 0);
  const jourCourt = (k) => new Date(k + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
  return el('figure', { class: 'tb-jours', role: 'img', 'aria-label': `Activité des 14 derniers jours : ${total} minutes en tout, ${J.filter((j) => j.min).length} jours actifs.` },
    el('div', { class: 'tb-jours-barres', 'aria-hidden': 'true' }, ...J.map((j) => el('div', { class: 'tb-jour', title: `${jourCourt(j.jour)} : ${j.min} min` },
      el('i', { style: { height: Math.round((j.min / max) * 100) + '%' } }), el('small', {}, jourCourt(j.jour).replace('.', ''))))),
    el('figcaption', { class: 'note' }, `Minutes de travail par jour (dans le simulateur, page visible et élève actif) : ${total} min sur 14 jours.`));
}

// ---------------- la classe ----------------
/** résumé d'une ligne du tableau de la classe : temps au car, exercices pratiques */
export function resumeCar(prog) {
  const c = carDe(prog);
  return { jeu: c.temps.jeu, postes: c.postesVus, exos: c.exercices, epreuves: c.epreuves };
}
/**
 * La classe au car régie : le temps passé à chaque poste par chaque élève, la part de manipulation.
 * @param {{ uid: string, nom: string, prog: any, identifiant?: string }[]} eleves @param {(uid: string) => void} ouvrir
 */
export function vueClasseCar(eleves, ouvrir) {
  const B = eleves.map((e) => ({ ...e, c: carDe(e.prog) }));
  const actifs = B.filter((x) => x.c.temps.jeu > 0);
  const moy = (f) => (actifs.length ? actifs.reduce((s, x) => s + f(x.c), 0) / actifs.length : 0);
  // les postes que la classe a pratiqués, les plus fréquentés d'abord
  const cat = catalogueCar().postes;
  const parPoste = cat.map((p) => ({ ...p, s: B.reduce((a, x) => a + (x.c.postes.find((q) => q.id === p.id) || { s: 0 }).s, 0) })).sort((a, b) => b.s - a.s);
  const vus = parPoste.filter((p) => p.s > 0), jamais = parPoste.filter((p) => !p.s);
  const box = el('div', { class: 'tb-vue' },
    el('div', { class: 'tb-kpis' },
      kpi('Au car régie', dureeS(moy((c) => c.temps.jeu)), 'en moyenne par élève actif'),
      kpi('Aux postes', dureeS(moy((c) => c.temps.poste)), `dont ${pct(actifs.length ? moy((c) => c.manip.s) / Math.max(1, moy((c) => c.temps.poste)) : 0)} à manipuler`),
      kpi('Postes pratiqués', actifs.length ? (moy((c) => c.postesVus)).toFixed(1).replace('.', ',') : '—', `sur ${cat.length}, en moyenne`),
      kpi('Exercices pratiques', actifs.length ? (moy((c) => c.exercices.seul + c.exercices.aide)).toFixed(1).replace('.', ',') : '—', `réussis en moyenne, sur ${B[0] ? B[0].c.exercices.total : 0}`),
      kpi('Élèves venus au car', `${actifs.length} / ${B.length}`, actifs.length < B.length ? 'les autres n\'y ont pas encore joué' : 'toute la classe')));
  if (!vus.length) { box.append(el('p', { class: 'note' }, 'Personne n\'a encore joué au car régie dans cette classe.')); return box; }
  const max = Math.max(1, ...B.flatMap((x) => x.c.postes.map((p) => p.s)));
  box.append(el('section', { class: 'tb-sec' }, el('h3', {}, 'Temps passé à chaque poste'),
    el('p', { class: 'note' }, 'Temps assis au poste ; en dessous, la part passée à manipuler (une action au poste il y a moins de 5 secondes). Plus la case est foncée, plus l\'élève y a passé de temps.'),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact tb-matrice', id: 'tb-matrice-postes' },
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Élève'), ...vus.map((p) => el('th', { scope: 'col', title: `${p.titre} (${p.zone})` }, p.titre.split(/ [—–(/]/)[0])))),
      el('tbody', {}, ...B.map((x) => el('tr', { class: 'tb-ligne', tabindex: '0', onclick: () => ouvrir(x.uid), onkeydown: (ev) => { if (ev.key === 'Enter') ouvrir(x.uid); } },
        el('th', { scope: 'row' }, el('span', {}, x.nom), x.identifiant ? el('small', {}, x.identifiant) : null),
        ...vus.map((p) => { const q = x.c.postes.find((y) => y.id === p.id) || { s: 0, part: 0 }; return el('td', { class: 'tb-case', style: `--k:${(q.s / max).toFixed(2)}`, title: q.s ? `${p.titre} : ${dureeS(q.s)}, ${pct(q.part)} à manipuler` : `${p.titre} : jamais` }, q.s ? [el('b', {}, dureeS(q.s)), el('small', {}, pct(q.part))] : el('span', { class: 'tb-dim' }, '—')); })))))),
    jamais.length ? el('p', { class: 'note' }, `Jamais ouverts par la classe : ${jamais.map((p) => p.titre).join(', ')}.`) : null));
  return box;
}
/**
 * La classe et les exercices pratiques : l'état de chaque exercice et de chaque épreuve pour chaque élève.
 * @param {{ uid: string, nom: string, prog: any, identifiant?: string }[]} eleves @param {(uid: string) => void} ouvrir
 */
export function vueClasseExos(eleves, ouvrir) {
  const B = eleves.map((e) => ({ ...e, c: carDe(e.prog) }));
  const box = el('div', { class: 'tb-vue' });
  if (!B.length) return box;
  const tous = B[0].c.exos;
  // les exercices qu'au moins un élève a abordés ; les autres sont listés à part
  const abordes = tous.filter((e) => B.some((x) => (x.c.exos.find((y) => y.id === e.id) || { statut: 'afaire' }).statut !== 'afaire'));
  const reste = tous.filter((e) => !abordes.includes(e));
  box.append(el('div', { class: 'tb-kpis' },
    ...['postes', 'installer', 'epreuves'].map((f) => {
      const l = tous.filter((e) => e.famille === f); const reussis = B.reduce((a, x) => a + x.c.exos.filter((e) => e.famille === f && (e.statut === 'seul' || e.statut === 'aide')).length, 0);
      return kpi(({ postes: 'Exercices pratiques', installer: 'Installer le car', epreuves: 'Épreuves notées' })[f], B.length ? (reussis / B.length).toFixed(1).replace('.', ',') : '—', `réussis en moyenne, sur ${l.length}`);
    })));
  if (!abordes.length) { box.append(el('p', { class: 'note' }, 'Aucun exercice pratique abordé pour l\'instant.')); return box; }
  box.append(el('section', { class: 'tb-sec' }, el('h3', {}, 'Exercices pratiques et épreuves'),
    el('p', { class: 'note' }, 'Seul : réussi sans « Fais-le pour moi ». Aidé : réussi avec. En cours : commencé, pas fini. Abandon : quitté avant la fin.'),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact tb-matrice tb-matrice-exos', id: 'tb-matrice-exos' },
      el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Exercice'), ...B.map((x) => el('th', { scope: 'col' }, el('button', { type: 'button', class: 'linkbtn', title: x.identifiant || '', onclick: () => ouvrir(x.uid) }, x.nom), x.identifiant ? el('small', {}, x.identifiant) : null)))),
      el('tbody', {}, ...abordes.map((e) => el('tr', {},
        el('th', { scope: 'row' }, el('span', {}, e.titre), el('small', {}, e.groupe)),
        ...B.map((x) => { const s = x.c.exos.find((y) => y.id === e.id); return el('td', {}, pastilleStatut(s ? s.statut : 'afaire', true)); })))))),
    reste.length ? el('details', { class: 'tb-reste' }, el('summary', {}, `${pluriel(reste.length, 'exercice')} que personne n'a encore abordé${reste.length > 1 ? 's' : ''}`), el('p', { class: 'note' }, reste.map((e) => e.titre).join(' · '))) : null));
  return box;
}

// ---------------- un élève ----------------
/** l'onglet « Car régie » de la fiche d'un élève */
export function ongletCar(prog) {
  const c = carDe(prog); const T = c.temps;
  const box = el('div', { class: 'tb-vue', id: 'tb-eleve-car' });
  box.append(el('div', { class: 'tb-kpis' },
    kpi('Temps au car régie', dureeS(T.jeu), `${pluriel(c.sessions.length, 'partie')} enregistrée${c.sessions.length > 1 ? 's' : ''}`),
    kpi('Aux postes', dureeS(T.poste), T.poste ? `dont ${dureeS(c.manip.s)} à manipuler (${pct(c.manip.s / T.poste)})` : 'jamais assis à un poste'),
    kpi('Postes pratiqués', `${c.postesVus} / ${c.postesTotal}`, `${pluriel(c.manip.actions, 'geste')} aux postes`),
    kpi('Dans le car, à pied', dureeS(T.car), [T.stade ? `stade ${dureeS(T.stade)}` : '', T.cadreur ? `caméra en main ${dureeS(T.cadreur)}` : '', T.plan ? `plan ${dureeS(T.plan)}` : ''].filter(Boolean).join(' · ') || 'ni stade, ni caméra en main, ni plan'),
    kpi('Pannes', `${c.pannes.ok} / ${c.pannes.n}`, c.pannes.n ? 'résolues pendant ses parties' : 'aucune panne pendant ses parties')));
  if (!T.jeu && !c.postesVus) { box.append(el('p', { class: 'note' }, 'Cet élève n\'a pas encore joué au car régie (ou ses parties datent d\'avant la version 19.25 du simulateur, qui mesure ce temps).')); }
  // poste par poste : ceux qu'il a pratiqués ; les autres, repliés
  const max = Math.max(1, ...c.postes.map((p) => p.s));
  const pratiques = c.postes.filter((p) => p.n || p.s), jamais = c.postes.filter((p) => !p.n && !p.s);
  box.append(el('section', { class: 'tb-sec' }, el('h3', {}, 'Poste par poste'),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact tb-table', id: 'tb-postes' },
      el('thead', {}, el('tr', {}, ...['Poste', 'Zone', 'Ouvert', 'Temps assis', 'Manipulation', 'Gestes', 'Dernière fois'].map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, ...pratiques.map((p) => el('tr', {},
        el('th', { scope: 'row' }, p.titre), el('td', {}, p.zone),
        el('td', {}, p.n ? `${p.n} fois` : '—'),
        el('td', {}, el('span', { class: 'tb-parc' }, jauge(p.s / max, `${dureeS(p.s)}`), dureeS(p.s))),
        el('td', {}, p.s ? `${dureeS(p.m)} (${pct(p.part)})` : '—'),
        el('td', {}, p.a ? String(p.a) : '—'),
        el('td', {}, p.d ? date(p.d) : '—')))))),
    jamais.length ? el('details', { class: 'tb-reste' }, el('summary', {}, `${pluriel(jamais.length, 'poste')} jamais ouvert${jamais.length > 1 ? 's' : ''}`), el('p', { class: 'note' }, jamais.map((p) => p.titre).join(' · '))) : null));
  // ce qu'il a vu, les tâches du car vide, les parties
  const liste = (l, vide) => (l.length ? el('ul', { class: 'tb-vus' }, ...l.slice(0, 20).map((x) => el('li', {}, el('span', {}, x.nom), el('b', {}, `${x.n}`)))) : el('p', { class: 'note' }, vide));
  box.append(el('div', { class: 'tb-grille' },
    el('section', { class: 'tb-sec' }, el('h3', {}, 'Matériel consulté'), el('p', { class: 'note' }, 'Visionneuse de matériel : connecteurs cliqués, faces regardées.'), liste(c.vus.app, 'Aucun appareil ouvert dans la visionneuse.')),
    el('section', { class: 'tb-sec' }, el('h3', {}, 'Lieux du stade'), el('p', { class: 'note' }, 'Destinations choisies (Aller à).'), liste(c.vus.lieux, 'Aucune destination choisie.')),
    el('section', { class: 'tb-sec' }, el('h3', {}, 'Fenêtres ouvertes'), el('p', { class: 'note' }, 'Fiches des postes, synoptiques, plan des caméras…'), liste(c.vus.fen, 'Aucune fenêtre ouverte en jeu.'))));
  box.append(el('section', { class: 'tb-sec' }, el('h3', {}, `Tâches du car vide : ${c.missionsCar.faites} / ${c.missionsCar.total}`),
    el('ul', { class: 'tb-taches' }, ...c.missionsCar.liste.map((m) => el('li', { class: m.ok ? 'ok' : '' }, el('span', { class: 'tb-statut ' + (m.ok ? 'st-seul' : 'st-afaire') }, m.ok ? 'Faite' : '—'), m.titre)))));
  box.append(el('section', { class: 'tb-sec' }, el('h3', {}, 'Dernières parties'),
    c.sessions.length ? el('table', { class: 'tbl compact', id: 'tb-sessions' },
      el('thead', {}, el('tr', {}, ...['Date', 'Départ', 'Durée active', 'Postes ouverts'].map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, ...c.sessions.map((s) => el('tr', {}, el('td', {}, date(s.at)), el('td', {}, libelleDepart(s)), el('td', {}, dureeS(s.s)),
        el('td', {}, s.postes.map((id) => (STATION_INFO[id] || {}).title || id).join(', ') || '—')))))
      : el('p', { class: 'note' }, 'Aucune partie enregistrée.')));
  return box;
}
// le mode choisi dans Jouer (S.modeCar), sinon le départ préparé (app/start.js)
const MODES = { vide: 'Car vide', libre: 'Car pré-installé', mission: 'Mission spécifique' };
const DEPARTS = { standard: 'Car pré-installé', zero: 'Car vide', vierge: 'Car vide', brassage: 'Brassage', scenario: 'Jour de match', atelier: 'Atelier caméra' };
const libelleDepart = (s) => MODES[s.mode] || DEPARTS[s.p] || s.p || '—';

/** l'onglet « Exercices pratiques » de la fiche d'un élève */
export function ongletExos(prog) {
  const c = carDe(prog);
  const box = el('div', { class: 'tb-vue', id: 'tb-eleve-exos' });
  const k = (titre, x) => kpi(titre, `${x.seul + x.aide} / ${x.total}`, `${x.seul} seul · ${x.aide} aidé${x.aide > 1 ? 's' : ''} · ${x.commence} en cours`);
  box.append(el('div', { class: 'tb-kpis' }, k('Exercices pratiques', c.exercices), k('Installer le car', c.installation), k('Épreuves notées', c.epreuves)));
  for (const f of FAMILLES) {
    const l = c.exos.filter((e) => e.famille === f.id); if (!l.length) continue;
    // rangés par groupe (chapitre du Cours pour les exercices d'Olivier)
    const groupes = [...new Set(l.map((e) => e.groupe))];
    box.append(el('section', { class: 'tb-sec' }, el('h3', {}, f.titre),
      el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact tb-table tb-exos' },
        el('thead', {}, el('tr', {}, ...['Exercice', 'État', 'Essais', 'Temps', 'Indices', '« Fais-le pour moi »', 'Erreurs', 'Dernière fois'].map((h) => el('th', { scope: 'col' }, h)))),
        ...groupes.map((g) => el('tbody', {},
          groupes.length > 1 ? el('tr', { class: 'tb-groupe' }, el('th', { colspan: '8', scope: 'colgroup' }, g)) : null,
          ...l.filter((e) => e.groupe === g).map((e) => el('tr', { class: e.statut === 'afaire' ? 'tb-jamais' : '' },
            el('th', { scope: 'row' }, el('span', {}, e.titre), e.texte ? el('small', {}, e.texte) : null),
            el('td', {}, pastilleStatut(e.statut)),
            el('td', {}, e.essais ? `${e.essais}${e.abandons ? ` (${e.abandons} abandon${e.abandons > 1 ? 's' : ''})` : ''}` : '—'),
            el('td', {}, dureeS(e.s)), el('td', {}, e.ind ? String(e.ind) : '—'), el('td', {}, e.aide ? String(e.aide) : '—'), el('td', {}, e.err ? String(e.err) : '—'),
            el('td', {}, e.d ? date(e.d) : '—')))))))));
  }
  return box;
}
