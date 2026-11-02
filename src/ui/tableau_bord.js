// @ts-check
import { on } from '../state.js';
import { el } from '../util.js';
import { toast, ask, field } from './common.js';
import { icon } from './icons.js';
import { openLayer, closeLayer, layerOpen, showTab, layerSay } from './layer.js';
import { livretPanel, livretCSV } from './livret.js';
import { offerDownload } from '../shared.js';
import { COMPTE, estProf } from '../comptes/session.js';
import { bilanEleve, bilanClasse, duree, dureeS, ESSAIS_DIFFICULTE } from '../comptes/bilan.js';
import { vueClasseCar, vueClasseExos, ongletCar, ongletExos, resumeCar, graphiqueJours, carDe } from './tableau_car.js';
import { lireListe, nomComplet, motDePasseRefuse } from '../comptes/identifiants.js';
import {
  suivreClasses, suivreEleves, suivreProgressions, secretsDe, creerClasse, renommerClasse, supprimerClasse,
  creerEleve, changerMdp, changerClasse, supprimerEleve, listeProfs, ajouterProf, retirerProf, texteErreur,
} from '../comptes/firebase.js';

// ----------------------------------------------------------------------------------
// Le tableau de bord du professeur (v19.24), rangé dans Réglages → Espace formateur (et la bande du
// compte de l'écran titre). Trois onglets dans l'espace plein écran :
//   Suivi des élèves    la synthèse de la classe, un élève par ligne, puis le bilan d'un élève : ce qu'il
//                       a validé, son parcours chapitre par chapitre, ses difficultés (comptes/bilan.js),
//                       son livret de compétences ;
//   Classes et comptes  créer une classe, y créer des élèves (identifiant et mot de passe provisoire),
//                       les fiches de connexion à imprimer, un nouveau mot de passe, changer de classe ;
//   Professeurs         les adresses autorisées à ouvrir un compte professeur.
// Les données arrivent en direct de Firestore (comptes/firebase.js) tant que le tableau est ouvert.
// ----------------------------------------------------------------------------------
const TB = {
  classes: /** @type {any[]} */ ([]), eleves: /** @type {any[]} */ ([]), progs: /** @type {Record<string, any>} */ ({}),
  classe: '', eleve: '', cleProgs: '', unsubs: /** @type {(() => void)[]} */ ([]), offProgs: () => {}, redessiner: () => {}, erreur: '',
  montrerMdp: false, secrets: /** @type {Record<string, any>} */ ({}), crees: /** @type {any[]} */ ([]),
  // la vue de la classe (ensemble, car régie, exercices pratiques) et l'onglet de la fiche d'un élève
  vue: 'ensemble', onglet: 'ensemble',
};
/** une rangée de touches à bascule (une seule allumée) */
function bascule(label, options, valeur, choisir, id = '') {
  return el('div', { class: 'seg tb-seg', role: 'group', 'aria-label': label, id },
    ...options.map(([v, t]) => el('button', { type: 'button', 'data-v': v, 'aria-pressed': String(v === valeur), onclick: () => choisir(v) }, t)));
}
const SANS = '__sans__';
const classeNom = (id) => (TB.classes.find((c) => c.id === id) || {}).nom || (id ? 'Classe supprimée' : 'Sans classe');
const nomEleve = (e) => nomComplet(e) || e.identifiant || e.uid;
const parNom = (a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr') || String(a.prenom || '').localeCompare(String(b.prenom || ''), 'fr');
const elevesDeLaClasse = () => TB.eleves.filter((e) => (TB.classe === SANS ? !e.classe || !TB.classes.some((c) => c.id === e.classe) : e.classe === TB.classe)).sort(parNom);
const quand = (t) => {
  if (!t) return 'jamais';
  const j = Math.floor((Date.now() - t) / 864e5);
  return j <= 0 ? `aujourd'hui, ${new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : j === 1 ? 'hier' : j < 30 ? `il y a ${j} jours` : new Date(t).toLocaleDateString('fr-FR');
};
/** une barre de progression (part de 0 à 1) */
const barre = (part, label) => el('span', { class: 'tb-bar', role: 'img', 'aria-label': label }, el('i', { style: { width: Math.round(Math.max(0, Math.min(1, part)) * 100) + '%' } }));

// ---------------- l'ouverture, les abonnements ----------------
export function openTableauBord(/** @type {string} */ tab = 'suivi') {
  if (!estProf()) { toast('Le tableau de bord demande un compte professeur : Réglages → Mon compte.', 'bad', 5000); return; }
  if (layerOpen() === 'tableau') { showTab(tab); return; }
  abonner();
  openLayer({ kind: 'tableau', title: 'Tableau de bord', ico: 'tableau', tabs: [['suivi', 'Suivi des élèves'], ['comptes', 'Classes et comptes'], ['profs', 'Professeurs']], tab, show });
}
function abonner() {
  desabonner();
  const ko = (e) => { TB.erreur = texteErreur(e); TB.redessiner(); };
  TB.unsubs.push(suivreClasses((l) => { TB.classes = l; if (!TB.classe || (TB.classe !== SANS && !l.some((c) => c.id === TB.classe))) TB.classe = l[0] ? l[0].id : SANS; TB.erreur = ''; TB.redessiner(); }, ko));
  TB.unsubs.push(suivreEleves((l) => { TB.eleves = l; TB.erreur = ''; suivreLesProgressions(); TB.redessiner(); }, ko));
}
function suivreLesProgressions() {
  const uids = TB.eleves.map((e) => e.uid).sort(); const cle = uids.join(',');
  if (cle === TB.cleProgs) return;
  TB.cleProgs = cle; TB.offProgs();
  TB.offProgs = suivreProgressions(uids, (m) => { TB.progs = m; TB.redessiner(); });
}
function desabonner() {
  for (const u of TB.unsubs) { try { u(); } catch (e) { /* déjà fermé */ } }
  TB.unsubs = []; TB.offProgs(); TB.offProgs = () => {}; TB.cleProgs = ''; TB.progs = {}; TB.secrets = {}; TB.crees = []; TB.eleve = '';
}
on('layerclose', () => { if (TB.unsubs.length && layerOpen() !== 'tableau') desabonner(); });
// le professeur se déconnecte, tableau ouvert : il se ferme
on('compte', () => { if (layerOpen() === 'tableau' && !estProf()) closeLayer(); });
on('tableauBord', (t) => openTableauBord(typeof t === 'string' ? t : 'suivi'));

function show(/** @type {string} */ k, /** @type {HTMLElement} */ page) {
  page.classList.add('tb');
  // les données arrivent par paquets : on redessine au plus une fois par image, sans perdre le défilement
  let attente = 0;
  TB.redessiner = () => { if (attente) return; attente = requestAnimationFrame(() => { attente = 0; if (page.isConnected) dessiner(); }); };
  const dessiner = () => {
    const sc = /** @type {HTMLElement | null} */ (page.closest('.ly-scroll')); const y = sc ? sc.scrollTop : 0;
    const actif = /** @type {HTMLElement | null} */ (document.activeElement); const garde = actif && page.contains(actif) && actif.matches('input, textarea');
    if (garde) return; // on ne redessine pas sous les doigts de quelqu'un qui tape
    page.replaceChildren();
    if (TB.erreur) page.append(el('p', { class: 'mp-state err', role: 'alert' }, icon('alarme'), 'Données indisponibles : ' + TB.erreur));
    if (k === 'suivi') pageSuivi(page); else if (k === 'comptes') pageComptes(page); else pageProfs(page);
    if (sc) sc.scrollTop = y;
  };
  dessiner();
  return () => { cancelAnimationFrame(attente); TB.redessiner = () => {}; };
}

/** le choix de la classe, commun aux deux premiers onglets */
function choixClasse() {
  const opts = [...TB.classes.map((c) => [c.id, c.nom]), [SANS, 'Élèves sans classe']];
  const sel = el('select', { id: 'tb-classe', 'aria-label': 'Classe', onchange: () => { TB.classe = /** @type {HTMLSelectElement} */ (sel).value; TB.eleve = ''; TB.redessiner(); } },
    ...opts.map(([v, t]) => el('option', { value: v, selected: v === TB.classe }, `${t} (${TB.eleves.filter((e) => (v === SANS ? !e.classe || !TB.classes.some((c) => c.id === e.classe) : e.classe === v)).length})`)));
  return el('div', { class: 'tb-classe' }, el('label', { for: 'tb-classe' }, 'Classe'), sel);
}

// ---------------- Suivi des élèves ----------------
function pageSuivi(page) {
  if (TB.eleve) { const e = TB.eleves.find((x) => x.uid === TB.eleve); if (e) { ficheEleve(page, e); return; } TB.eleve = ''; }
  const liste = elevesDeLaClasse();
  page.append(el('div', { class: 'tb-tete' }, el('h2', {}, 'Suivi des élèves'), choixClasse()));
  if (!TB.classes.length && !TB.eleves.length) {
    page.append(el('div', { class: 'tb-vide' }, el('p', {}, 'Aucune classe pour l\'instant. Commencez par créer une classe et ses élèves.'), el('button', { type: 'button', class: 'btn primary', onclick: () => showTab('comptes') }, 'Créer une classe')));
    return;
  }
  const C = bilanClasse(liste.map((e) => ({ uid: e.uid, nom: nomEleve(e), prog: TB.progs[e.uid] || null })));
  page.append(bascule('Vue de la classe', [['ensemble', 'Vue d\'ensemble'], ['car', 'Car régie : temps aux postes'], ['exos', 'Exercices pratiques']], TB.vue, (v) => { TB.vue = v; TB.redessiner(); }, 'tb-vue-classe'));
  const ouvrir = (uid) => { TB.eleve = uid; TB.onglet = TB.vue === 'ensemble' ? 'ensemble' : TB.vue; TB.redessiner(); };
  if (liste.length && TB.vue === 'car') { page.append(vueClasseCar(C.eleves.map((x) => ({ uid: x.uid, nom: x.nom, prog: x.prog, identifiant: (liste.find((y) => y.uid === x.uid) || {}).identifiant })), ouvrir)); return; }
  if (liste.length && TB.vue === 'exos') { page.append(vueClasseExos(C.eleves.map((x) => ({ uid: x.uid, nom: x.nom, prog: x.prog, identifiant: (liste.find((y) => y.uid === x.uid) || {}).identifiant })), ouvrir)); return; }
  page.append(el('div', { class: 'tb-kpis' },
    kpi('Élèves', `${C.effectif}`, C.jamais.length ? `${C.jamais.length} jamais connecté${C.jamais.length > 1 ? 's' : ''}` : 'tous connectés au moins une fois'),
    kpi('Leçons terminées', C.moyenneTerminees == null ? '—' : `${C.moyenneTerminees} / ${C.lecons}`, 'en moyenne par élève'),
    kpi('Exercices', C.moyenneExos == null ? '—' : `${C.moyenneExos} / 100`, 'moyenne des meilleurs scores'),
    kpi('Travail cette semaine', duree(C.minutesSemaine || 0), 'en moyenne par élève'),
    kpi('À suivre', `${C.aSuivre.length}`, C.aSuivre.length ? (C.aSuivre.length > 1 ? 'élèves en difficulté' : 'élève en difficulté') : 'aucune difficulté repérée', C.aSuivre.length ? 'warn' : 'ok')));
  if (C.leconsDifficiles.length) {
    page.append(el('section', { class: 'tb-sec' }, el('h3', {}, 'Où la classe bloque'),
      el('ul', { class: 'tb-blocages' }, ...C.leconsDifficiles.map((l) => el('li', {}, el('b', {}, l.titre), el('span', {}, `${l.eleves.length} élève${l.eleves.length > 1 ? 's' : ''} : ${l.eleves.join(', ')}`))))));
  }
  if (C.inactifs.length) page.append(el('p', { class: 'note' }, `Sans activité depuis plus de deux semaines : ${C.inactifs.join(', ')}.`));
  if (!liste.length) { page.append(el('p', { class: 'note' }, 'Pas encore d\'élève dans cette classe : onglet « Classes et comptes ».')); return; }
  const t = el('table', { class: 'tbl compact tb-table', id: 'tb-eleves' },
    el('thead', {}, el('tr', {}, ...['Élève', 'Dernière activité', 'Cette semaine', 'Parcours du Cours', 'Exercices', 'Car régie', 'Exercices pratiques', 'Compétences', 'Niveau', 'Difficultés'].map((h) => el('th', { scope: 'col' }, h)))),
    el('tbody', {}, ...C.eleves.map((x) => {
      const b = x.b; const e = liste.find((y) => y.uid === x.uid); const r = resumeCar(x.prog);
      const fortes = b.difficultes.filter((d) => d.gravite === 'forte').length;
      return el('tr', { class: 'tb-ligne' + (b.alertes ? ' alerte' : ''), tabindex: '0', 'data-uid': x.uid, onclick: () => ouvrir(x.uid), onkeydown: (ev) => { if (ev.key === 'Enter') ouvrir(x.uid); } },
        el('th', { scope: 'row' }, el('span', { class: 'tb-nom' }, x.nom), el('small', {}, e ? e.identifiant : '')),
        el('td', { class: b.inactif ? 'tb-dim' : '' }, b.jamais ? 'jamais' : quand(b.dernier)),
        el('td', {}, duree(b.minutes.semaine)),
        el('td', {}, el('span', { class: 'tb-parc' }, barre(b.lecons ? b.terminees / b.lecons : 0, `${b.terminees} leçons terminées sur ${b.lecons}`), `${b.terminees} / ${b.lecons}`)),
        el('td', {}, b.moyenneExos == null ? '—' : `${b.moyenneExos} / 100`),
        el('td', {}, r.jeu ? `${dureeS(r.jeu)} · ${r.postes} poste${r.postes > 1 ? 's' : ''}` : '—'),
        el('td', {}, r.exos.seul + r.exos.aide ? `${r.exos.seul + r.exos.aide} / ${r.exos.total}` + (r.exos.aide ? ` (${r.exos.aide} aidé${r.exos.aide > 1 ? 's' : ''})` : '') : r.exos.commence ? 'commencés' : '—'),
        el('td', {}, `${b.competences.consolidee + b.competences.travaillee}` + (b.competences.consolidee ? ` (${b.competences.consolidee} cons.)` : '')),
        el('td', {}, `${b.niveauN} · ${b.niveau}`),
        el('td', {}, b.alertes ? el('span', { class: 'tb-pastille ' + (fortes ? 'forte' : 'moyenne') }, fortes === b.alertes ? `${fortes} forte${fortes > 1 ? 's' : ''}` : `${b.alertes}${fortes ? ' dont ' + fortes + ' forte' + (fortes > 1 ? 's' : '') : ''}`) : b.difficultes.length ? el('span', { class: 'tb-pastille aide' }, 'aidé') : el('span', { class: 'tb-dim' }, '—')));
    })));
  page.append(el('div', { class: 'tblwrap' }, t),
    el('p', { class: 'note' }, `Une difficulté : le quiz d'une leçon ou son exercice manqué ${ESSAIS_DIFFICULTE} fois ou plus, une épreuve notée jamais réussie ; « forte » à partir de ${2 * ESSAIS_DIFFICULTE} essais. Cliquez sur un élève pour son bilan.`),
    el('div', { class: 'hwrow' },
      el('button', { type: 'button', class: 'btn small', onclick: () => offerDownload(`suivi-${fichier(classeNom(TB.classe))}.csv`, csvSuivi(C.eleves)) }, 'Exporter le suivi (CSV)'),
      el('button', { type: 'button', class: 'btn small', onclick: () => offerDownload(`livrets-${fichier(classeNom(TB.classe))}.csv`, livretCSV(C.eleves.map((x) => ({ name: x.nom, prog: x.prog || {} })))) }, 'Exporter les livrets (CSV)')));
}
const kpi = (titre, valeur, sous, cls = '') => el('div', { class: 'tb-kpi ' + cls }, el('small', {}, titre), el('b', {}, valeur), el('span', {}, sous));
const fichier = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'classe';
function csvSuivi(rows) {
  const q = (s) => (/[;"\n]/.test(String(s)) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
  const out = [['Élève', 'Dernière activité', 'Minutes (7 jours)', 'Minutes (total)', 'Leçons terminées', 'Leçons', 'Moyenne exercices', 'Quiz réussis', 'Car régie (min)', 'Aux postes (min)', 'Manipulation (min)', 'Postes pratiqués', 'Exercices pratiques réussis seul', 'Réussis aidé', 'Épreuves réussies', 'Compétences travaillées', 'Consolidées', 'XP', 'Niveau', 'Difficultés', 'Détail des difficultés'].join(';')];
  for (const x of rows) {
    const b = x.b; const c = carDe(x.prog);
    out.push([x.nom, b.dernier ? new Date(b.dernier).toISOString() : '', b.minutes.semaine, b.minutes.total, b.terminees, b.lecons, b.moyenneExos ?? '', b.quizReussis,
      Math.round(c.temps.jeu / 60), Math.round(c.temps.poste / 60), Math.round(c.manip.s / 60), c.postesVus, c.exercices.seul, c.exercices.aide, c.epreuves.seul,
      b.competences.consolidee + b.competences.travaillee, b.competences.consolidee, b.xp, b.niveau, b.alertes, b.difficultes.map((d) => `${d.titre} : ${d.texte}`).join(' | ')].map(q).join(';'));
  }
  return '﻿' + out.join('\r\n');
}

/** le bilan d'un élève */
function ficheEleve(page, e) {
  const prog = TB.progs[e.uid] || null; const b = bilanEleve(prog);
  page.append(el('div', { class: 'tb-tete' },
    el('button', { type: 'button', class: 'btn small', id: 'tb-retour', onclick: () => { TB.eleve = ''; TB.onglet = 'ensemble'; TB.redessiner(); } }, '← ' + classeNom(e.classe)),
    el('h2', {}, nomEleve(e)), el('span', { class: 'tb-dim' }, `${e.identifiant} · ${classeNom(e.classe)}`)));
  if (b.jamais) { page.append(el('p', { class: 'note' }, 'Cet élève ne s\'est pas encore connecté (ou n\'a encore rien fait).')); }
  page.append(bascule('Partie du bilan', [['ensemble', 'Vue d\'ensemble'], ['car', 'Car régie'], ['exos', 'Exercices pratiques'], ['cours', 'Cours'], ['livret', 'Livret']], TB.onglet, (v) => { TB.onglet = v; TB.redessiner(); }, 'tb-onglets-eleve'));
  const gerer = el('div', { class: 'hwrow' }, el('button', { type: 'button', class: 'btn small', onclick: () => { TB.classe = e.classe || SANS; showTab('comptes'); } }, icon('cle'), 'Gérer le compte (mot de passe, classe)'));
  if (TB.onglet === 'car') { page.append(ongletCar(prog), gerer); return; }
  if (TB.onglet === 'exos') { page.append(ongletExos(prog), gerer); return; }
  if (TB.onglet === 'livret') { page.append(el('section', { class: 'tb-sec' }, livretPanel(prog || {})), gerer); return; }
  if (TB.onglet === 'cours') { page.append(...coursEleve(b, prog), gerer); return; }
  const c = carDe(prog);
  page.append(el('div', { class: 'tb-kpis' },
    kpi('Dernière activité', b.jamais ? '—' : quand(b.dernier), b.inactif ? 'plus de deux semaines' : '', b.inactif ? 'warn' : ''),
    kpi('Temps de travail', duree(b.minutes.semaine), `cette semaine · ${duree(b.minutes.total)} en tout`),
    kpi('Leçons terminées', `${b.terminees} / ${b.lecons}`, `${b.vues} ouverte${b.vues > 1 ? 's' : ''} · ${b.quizReussis} quiz réussi${b.quizReussis > 1 ? 's' : ''}`),
    kpi('Exercices', b.moyenneExos == null ? '—' : `${b.moyenneExos} / 100`, `${b.exosFaits} fait${b.exosFaits > 1 ? 's' : ''} · ${b.exosSeul} réussi${b.exosSeul > 1 ? 's' : ''} seul`),
    kpi('Compétences', `${b.competences.consolidee + b.competences.travaillee}`, `travaillée${b.competences.consolidee + b.competences.travaillee > 1 ? 's' : ''} · ${b.competences.consolidee} consolidée${b.competences.consolidee > 1 ? 's' : ''}`),
    kpi('Niveau', `${b.niveauN}`, `${b.niveau} · ${b.xp} XP`),
    kpi('Car régie', dureeS(c.temps.jeu), `${c.postesVus} / ${c.postesTotal} postes · ${dureeS(c.manip.s)} à manipuler`),
    kpi('Exercices pratiques', `${c.exercices.seul + c.exercices.aide} / ${c.exercices.total}`, `${c.exercices.seul} seul · ${c.exercices.aide} aidé${c.exercices.aide > 1 ? 's' : ''} · épreuves ${c.epreuves.seul} / ${c.epreuves.total}`)));
  page.append(el('section', { class: 'tb-sec' }, el('h3', {}, 'Activité des deux dernières semaines'), graphiqueJours(prog)));
  // les difficultés
  const D = b.difficultes;
  page.append(el('section', { class: 'tb-sec', id: 'tb-difficultes' }, el('h3', {}, 'Difficultés'),
    D.length ? el('ul', { class: 'tb-diff' }, ...D.map((d) => el('li', { class: d.gravite },
      el('span', { class: 'tb-pastille ' + d.gravite }, d.gravite === 'forte' ? 'Forte' : d.gravite === 'moyenne' ? 'À surveiller' : 'Aidé'),
      el('b', {}, d.titre), el('span', {}, d.texte))))
      : el('p', { class: 'note' }, b.jamais ? 'Rien à signaler pour l\'instant.' : 'Aucune difficulté repérée : rien n\'a été manqué plusieurs fois.')));
  page.append(gerer);
}
/** l'onglet « Cours » : le parcours chapitre par chapitre, les épreuves notées */
function coursEleve(b, prog) {
  const out = [];
  // le parcours, chapitre par chapitre
  out.push(el('section', { class: 'tb-sec' }, el('h3', {}, 'Parcours du Cours'),
    el('table', { class: 'tbl compact tb-chap' }, el('thead', {}, el('tr', {}, ...['Chapitre', 'Leçons terminées', 'Niveau en cours', 'Étoiles'].map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, ...b.chapitres.map((c) => el('tr', {}, el('th', { scope: 'row' }, c.titre),
        el('td', {}, el('span', { class: 'tb-parc' }, barre(c.lecons ? c.terminees / c.lecons : 0, `${c.terminees} sur ${c.lecons}`), `${c.terminees} / ${c.lecons}`)),
        el('td', {}, c.fini ? 'Terminé' : c.niveau || '—'), el('td', {}, `${c.etoiles} / ${c.max}`)))))));
  // les épreuves notées et le livret
  const ep = epreuves(prog || {});
  out.push(el('section', { class: 'tb-sec' }, el('h3', {}, 'Épreuves notées'), ep.length ? el('ul', { class: 'tb-ep' }, ...ep.map(([t, v]) => el('li', {}, el('b', {}, t), el('span', {}, v)))) : el('p', { class: 'note' }, 'Aucune épreuve notée pour l\'instant.')));
  return out;
}
/** les meilleurs résultats des épreuves notées : [titre, valeur] */
function epreuves(P) {
  const best = (a) => (a && a.length ? Math.max(...a.map((x) => (x && x.score) || 0)) : null);
  const n = (a) => (a && a.length ? ` (${a.length} essai${a.length > 1 ? 's' : ''})` : '');
  const out = [];
  const add = (t, a, unite = ' / 100') => { const v = best(a); if (v != null) out.push([t, `meilleur ${v}${unite}${n(a)}`]); };
  add('Émission en direct', P.emissions); add('Jour de match', P.scenarios, ' %'); add('Examen réseau', (P.net || {}).exams, ' %'); add('Quiz ST 2110', (P.net || {}).quiz, ' %');
  add('Mise en service de la caméra', ((P.camera || {}).mes || {}).runs);
  for (const [id, m] of Object.entries((P.entrepot || {}).missions || {})) if (m) add(`Entrepôt, mission « ${id} »`, m.runs);
  if ((P.rigs || []).length) out.push(['Montage de la caméra', `meilleur : ${Math.min(...P.rigs.map((r) => r.errs ?? 99))} erreur(s) (${P.rigs.length} essai${P.rigs.length > 1 ? 's' : ''})`]);
  if (P.patchBest) out.push(['Brassage', `${P.patchBest} %`]);
  return out;
}

// ---------------- Classes et comptes ----------------
function pageComptes(page) {
  page.append(el('div', { class: 'tb-tete' }, el('h2', {}, 'Classes et comptes'), TB.classes.length ? choixClasse() : null));
  // une nouvelle classe
  const nom = el('input', { type: 'text', id: 'tb-nouvelle', placeholder: 'BTS MAV 1re année', maxlength: '60', 'aria-label': 'Nom de la nouvelle classe' });
  const creer = async () => {
    const v = /** @type {HTMLInputElement} */ (nom).value.trim(); if (!v) { toast('Le nom de la classe ?', 'bad'); return; }
    try { TB.classe = await creerClasse(v, /** @type {string} */ (COMPTE.uid)); /** @type {HTMLInputElement} */ (nom).value = ''; /** @type {HTMLInputElement} */ (nom).blur(); toast(`Classe « ${v} » créée.`, 'good'); TB.redessiner(); }
    catch (er) { toast(texteErreur(er), 'bad', 6000); }
  };
  page.append(el('section', { class: 'tb-sec' }, el('h3', {}, 'Nouvelle classe'),
    el('div', { class: 'tb-ligneform' }, nom, el('button', { type: 'button', class: 'btn primary', id: 'tb-creer-classe', onclick: creer }, 'Créer la classe'))));
  if (!TB.classes.length && !TB.eleves.length) return;
  const liste = elevesDeLaClasse();
  const reel = TB.classe !== SANS;
  // la classe choisie : la renommer, la supprimer (vide)
  if (reel) {
    page.append(el('div', { class: 'hwrow' },
      el('button', { type: 'button', class: 'btn small', onclick: async () => {
        const v = await demander('Nouveau nom de la classe', classeNom(TB.classe)); if (!v) return;
        try { await renommerClasse(TB.classe, v); } catch (er) { toast(texteErreur(er), 'bad'); }
      } }, 'Renommer la classe'),
      el('button', { type: 'button', class: 'btn small danger', disabled: liste.length > 0, title: liste.length ? 'Videz d\'abord la classe (supprimez ses élèves ou changez-les de classe)' : '', onclick: async () => {
        if (!(await ask(`La classe « ${classeNom(TB.classe)} » sera supprimée.`, { title: 'Supprimer la classe ?', ok: 'Supprimer', danger: true }))) return;
        try { await supprimerClasse(TB.classe); TB.classe = ''; } catch (er) { toast(texteErreur(er), 'bad'); }
      } }, 'Supprimer la classe')));
  }
  // ajouter des élèves : un par un, ou une liste collée
  if (reel) {
    const prenom = el('input', { type: 'text', id: 'tb-prenom', 'aria-label': 'Prénom', placeholder: 'Prénom', maxlength: '40' });
    const nomE = el('input', { type: 'text', id: 'tb-nom', 'aria-label': 'Nom', placeholder: 'Nom', maxlength: '40' });
    const mdp = el('input', { type: 'text', id: 'tb-mdp', 'aria-label': 'Mot de passe (facultatif)', placeholder: 'Mot de passe : tiré au hasard', maxlength: '64', autocomplete: 'off' });
    const lot = el('textarea', { id: 'tb-liste', rows: '5', 'aria-label': 'Liste d\'élèves', placeholder: 'Un élève par ligne :\nLéa Martin\nMARTIN Léa\nMartin;Léa' });
    const etat = el('p', { class: 'note', 'aria-live': 'polite' });
    const ajouter = async (gens, motDePasse = '') => {
      if (!gens.length) { toast('Aucun élève à créer.', 'bad'); return; }
      const ok = []; const ko = [];
      for (let i = 0; i < gens.length; i++) {
        const g = gens[i]; etat.textContent = `Création ${i + 1} / ${gens.length} : ${nomComplet(g)}…`;
        try { const r = await creerEleve({ prenom: g.prenom, nom: g.nom, classe: TB.classe, mdp: motDePasse, profUid: /** @type {string} */ (COMPTE.uid) }); ok.push({ ...g, ...r, classe: classeNom(TB.classe) }); }
        catch (er) { ko.push(`${nomComplet(g)} : ${texteErreur(er)}`); }
      }
      TB.crees = [...ok, ...TB.crees].slice(0, 120);
      for (const c of ok) TB.secrets[c.uid] = { identifiant: c.identifiant, mdp: c.mdp };
      etat.textContent = `${ok.length} compte${ok.length > 1 ? 's' : ''} créé${ok.length > 1 ? 's' : ''}` + (ko.length ? ` · ${ko.length} échec${ko.length > 1 ? 's' : ''} : ${ko.join(' ; ')}` : '.');
      toast(etat.textContent, ko.length ? 'bad' : 'good', 6000);
      /** @type {HTMLElement} */ (document.activeElement)?.blur?.(); TB.redessiner();
    };
    page.append(el('section', { class: 'tb-sec' }, el('h3', {}, `Ajouter des élèves à ${classeNom(TB.classe)}`),
      el('div', { class: 'tb-ligneform' }, prenom, nomE, mdp, el('button', { type: 'button', class: 'btn primary', id: 'tb-ajouter', onclick: async () => {
        const p = /** @type {HTMLInputElement} */ (prenom).value.trim(), n = /** @type {HTMLInputElement} */ (nomE).value.trim(), m = /** @type {HTMLInputElement} */ (mdp).value.trim();
        if (!p || !n) { toast('Prénom et nom, s\'il vous plaît.', 'bad'); return; }
        if (m && motDePasseRefuse(m)) { toast('Mot de passe : ' + motDePasseRefuse(m), 'bad'); return; }
        /** @type {HTMLInputElement} */ (prenom).value = ''; /** @type {HTMLInputElement} */ (nomE).value = ''; /** @type {HTMLInputElement} */ (mdp).value = '';
        await ajouter([{ prenom: p, nom: n }], m);
      } }, 'Créer le compte')),
      el('details', { class: 'tb-lot' }, el('summary', {}, 'Créer toute une liste (copier-coller depuis un tableur)'), lot,
        el('button', { type: 'button', class: 'btn', id: 'tb-ajouter-liste', onclick: async () => { const g = lireListe(/** @type {HTMLTextAreaElement} */ (lot).value); /** @type {HTMLTextAreaElement} */ (lot).value = ''; await ajouter(g); } }, 'Créer les comptes de la liste')),
      etat, el('p', { class: 'note' }, 'L\'identifiant se forme avec le prénom et le nom (« lea.martin ») ; le mot de passe provisoire est tiré au hasard. Remettez à chacun sa fiche de connexion.')));
  }
  // les comptes tout juste créés : à noter ou imprimer tout de suite
  if (TB.crees.length) {
    page.append(el('section', { class: 'tb-sec tb-crees', id: 'tb-crees' }, el('h3', {}, 'Comptes créés'),
      el('table', { class: 'tbl compact' }, el('thead', {}, el('tr', {}, ...['Élève', 'Classe', 'Identifiant', 'Mot de passe'].map((h) => el('th', { scope: 'col' }, h)))),
        el('tbody', {}, ...TB.crees.map((c) => el('tr', {}, el('td', {}, nomComplet(c)), el('td', {}, c.classe), el('td', { class: 'tb-mono' }, c.identifiant), el('td', { class: 'tb-mono' }, c.mdp))))),
      el('div', { class: 'hwrow' }, el('button', { type: 'button', class: 'btn small', onclick: () => fiches(TB.crees.map((c) => ({ nom: nomComplet(c), classe: c.classe, identifiant: c.identifiant, mdp: c.mdp }))) }, 'Fiches de connexion de ces comptes'),
        el('button', { type: 'button', class: 'btn small', onclick: () => { TB.crees = []; TB.redessiner(); } }, 'Masquer'))));
  }
  // les élèves de la classe
  if (!liste.length) { page.append(el('p', { class: 'note' }, reel ? 'Pas encore d\'élève dans cette classe.' : 'Aucun élève sans classe.')); return; }
  const manque = liste.filter((e) => !TB.secrets[e.uid]).map((e) => e.uid);
  if (manque.length) secretsDe(manque).then((s) => { let n = 0; for (const uid of manque) { TB.secrets[uid] = s[uid] || { absent: true }; n++; } if (n) TB.redessiner(); }).catch(() => {});
  const autres = [['', 'Sans classe'], ...TB.classes.map((c) => [c.id, c.nom])];
  page.append(el('section', { class: 'tb-sec' }, el('h3', {}, `Élèves (${liste.length})`),
    el('div', { class: 'hwrow' },
      el('button', { type: 'button', class: 'btn small', id: 'tb-voir-mdp', 'aria-pressed': String(TB.montrerMdp), onclick: () => { TB.montrerMdp = !TB.montrerMdp; TB.redessiner(); } }, TB.montrerMdp ? 'Masquer les mots de passe' : 'Afficher les mots de passe'),
      el('button', { type: 'button', class: 'btn small', id: 'tb-fiches', onclick: () => fiches(liste.map((e) => ({ nom: nomEleve(e), classe: classeNom(e.classe), identifiant: e.identifiant, mdp: (TB.secrets[e.uid] || {}).mdp || '' }))) }, 'Imprimer les fiches de connexion'),
      el('button', { type: 'button', class: 'btn small', onclick: () => offerDownload(`comptes-${fichier(classeNom(TB.classe))}.csv`, '﻿' + ['Nom;Prénom;Classe;Identifiant;Mot de passe', ...liste.map((e) => [e.nom, e.prenom, classeNom(e.classe), e.identifiant, (TB.secrets[e.uid] || {}).mdp || ''].join(';'))].join('\r\n')) }, 'Exporter les comptes (CSV)')),
    el('div', { class: 'tblwrap' }, el('table', { class: 'tbl compact tb-table', id: 'tb-comptes' },
      el('thead', {}, el('tr', {}, ...['Élève', 'Identifiant', 'Mot de passe', 'Classe', ''].map((h) => el('th', { scope: 'col' }, h)))),
      el('tbody', {}, ...liste.map((e) => {
        const s = TB.secrets[e.uid];
        const sel = el('select', { 'aria-label': `Classe de ${nomEleve(e)}`, onchange: async () => { try { await changerClasse(e.uid, /** @type {HTMLSelectElement} */ (sel).value || null); toast(`${nomEleve(e)} : ${classeNom(/** @type {HTMLSelectElement} */ (sel).value)}.`, 'good'); /** @type {HTMLSelectElement} */ (sel).blur(); } catch (er) { toast(texteErreur(er), 'bad'); } } },
          ...autres.map(([v, t]) => el('option', { value: v, selected: (e.classe || '') === v }, t)));
        return el('tr', { 'data-uid': e.uid },
          el('th', { scope: 'row' }, nomEleve(e)), el('td', { class: 'tb-mono' }, e.identifiant || ''),
          el('td', { class: 'tb-mono' }, !s ? '…' : s.absent ? '—' : TB.montrerMdp ? s.mdp : '••••••••'), el('td', {}, sel),
          el('td', { class: 'tb-actions' },
            el('button', { type: 'button', class: 'btn small', 'data-act': 'mdp', onclick: async () => {
              if (!(await ask(`${nomEleve(e)} reçoit un nouveau mot de passe, tiré au hasard ; l'ancien ne marche plus.`, { title: 'Nouveau mot de passe ?', ok: 'Changer' }))) return;
              try { const m = await changerMdp(e.uid); TB.secrets[e.uid] = { identifiant: e.identifiant, mdp: m }; TB.crees = [{ ...e, mdp: m, classe: classeNom(e.classe) }, ...TB.crees.filter((c) => c.uid !== e.uid)]; toast(`Nouveau mot de passe de ${nomEleve(e)} : ${m}`, 'good', 8000); TB.redessiner(); }
              catch (er) { toast(texteErreur(er), 'bad', 6000); }
            } }, icon('cle'), 'Nouveau mot de passe'),
            el('button', { type: 'button', class: 'btn small danger', 'data-act': 'suppr', onclick: async () => {
              if (!(await ask(`Le compte de ${nomEleve(e)} et toute sa progression seront supprimés définitivement.`, { title: 'Supprimer le compte ?', ok: 'Supprimer', danger: true }))) return;
              try { await supprimerEleve(e.uid); toast(`Compte de ${nomEleve(e)} supprimé.`); } catch (er) { toast(texteErreur(er), 'bad', 6000); }
            } }, 'Supprimer')));
      })))),
    el('p', { class: 'note' }, 'Les mots de passe affichés sont les mots de passe provisoires donnés aux élèves ; seuls les professeurs les voient.')));
}
/** une petite question dans la page (nom de classe) */
async function demander(titre, valeur = '') {
  const inp = el('input', { type: 'text', value: valeur, maxlength: '60', 'aria-label': titre });
  const box = el('div', {}, field(titre, inp));
  const p = ask('', { title: titre, ok: 'Valider' });
  setTimeout(() => { const host = document.querySelector('#ask-d'); if (host) { host.replaceChildren(box); /** @type {HTMLInputElement} */ (inp).focus(); /** @type {HTMLInputElement} */ (inp).select(); } }, 0);
  return (await p) ? /** @type {HTMLInputElement} */ (inp).value.trim() : '';
}
/** les fiches de connexion à imprimer (une page HTML, quatre fiches par ligne à découper) */
function fiches(rows) {
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Fiches de connexion — TIEE Simulator</title><style>
body{font:14px/1.4 Arial,Helvetica,sans-serif;color:#111;margin:12mm}h1{font-size:16px;margin:0 0 8mm}
.g{display:grid;grid-template-columns:repeat(2,1fr);gap:6mm}.f{border:1px dashed #888;border-radius:8px;padding:5mm;break-inside:avoid}
.f h2{font-size:15px;margin:0 0 2mm}.f p{margin:1mm 0}.f code{font:600 15px/1 "Courier New",monospace;background:#f1f1f1;padding:1mm 2mm;border-radius:3px}
.f small{color:#555}@media print{body{margin:8mm}h1{display:none}}</style></head><body>
<h1>Fiches de connexion à découper (${rows.length})</h1><div class="g">${rows.map((r) => `<div class="f"><h2>TIEE Simulator</h2><p><b>${esc(r.nom)}</b>${r.classe ? ` · ${esc(r.classe)}` : ''}</p>
<p>Identifiant : <code>${esc(r.identifiant)}</code></p><p>Mot de passe : <code>${esc(r.mdp || '(demander au professeur)')}</code></p>
<p><small>Écran titre → Se connecter. Garde ce mot de passe pour toi.</small></p></div>`).join('')}</div></body></html>`;
  offerDownload(`fiches-connexion-${fichier(rows.length === 1 ? rows[0].nom : classeNom(TB.classe))}.html`, html).then((r) => { if (r === 'saved') layerSay('Fiches enregistrées : ouvrez le fichier et imprimez-le.'); });
}

// ---------------- Professeurs ----------------
function pageProfs(page) {
  page.append(el('div', { class: 'tb-tete' }, el('h2', {}, 'Professeurs')),
    el('p', { class: 'note' }, 'Ces adresses peuvent ouvrir un compte professeur (écran titre → Se connecter → « Professeur : ouvrir mon compte », puis confirmer l\'adresse par le lien reçu). Un professeur voit toutes les classes et tous les élèves.'));
  const host = el('div', { class: 'tb-profs', 'aria-live': 'polite' }, el('p', { class: 'note' }, 'Chargement…'));
  const email = el('input', { type: 'email', id: 'tb-prof-email', placeholder: 'prenom.nom@ac-amiens.fr', 'aria-label': 'Adresse du professeur à autoriser' });
  const lire = async () => {
    try {
      const l = await listeProfs();
      host.replaceChildren(l.length ? el('ul', { class: 'tb-ep' }, ...l.map((m) => el('li', {}, el('b', {}, m), m === (COMPTE.email || '').toLowerCase() ? el('span', { class: 'tb-dim' }, 'vous') : el('button', { type: 'button', class: 'btn small danger', onclick: async () => {
        if (!(await ask(`${m} ne pourra plus ouvrir de compte professeur. Un compte déjà ouvert le reste.`, { title: 'Retirer cette adresse ?', ok: 'Retirer', danger: true }))) return;
        try { await retirerProf(m); lire(); } catch (er) { toast(texteErreur(er), 'bad'); }
      } }, 'Retirer')))) : el('p', { class: 'note' }, 'Aucune adresse.'));
    } catch (er) { host.replaceChildren(el('p', { class: 'mp-state err' }, icon('alarme'), texteErreur(er))); }
  };
  lire();
  page.append(host, el('div', { class: 'tb-ligneform' }, email, el('button', { type: 'button', class: 'btn primary', onclick: async () => {
    const v = /** @type {HTMLInputElement} */ (email).value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { toast('Adresse e-mail non valide.', 'bad'); return; }
    try { await ajouterProf(v); /** @type {HTMLInputElement} */ (email).value = ''; toast(`${v} peut ouvrir un compte professeur.`, 'good'); lire(); } catch (er) { toast(texteErreur(er), 'bad', 6000); }
  } }, 'Autoriser cette adresse')));
}
