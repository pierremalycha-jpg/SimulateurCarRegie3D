// @ts-check
import { CHAPTERS, lessonById } from '../cours/index.js';
import { bilanChapitre, etatLecon } from '../cours/parcours.js';
import { SEUIL_EXO } from '../cours/exo.js';
import { livret } from '../livret.js';
import { xpOf, levelOf } from '../game/xp.js';

// ----------------------------------------------------------------------------------
// Le bilan d'un élève pour le tableau de bord du professeur (calcul pur, lu dans la progression
// enregistrée : PROG, src/shared.js) : où il en est dans le parcours du Cours, ce qu'il a validé,
// son temps de travail, et ses difficultés, c'est-à-dire ce qu'il a essayé plusieurs fois sans le
// réussir (le quiz d'une leçon, son exercice en autonomie, une épreuve notée), ou réussi seulement
// avec la solution. Le même calcul fait la synthèse d'une classe.
// ----------------------------------------------------------------------------------
/** à partir de combien d'essais manqués on parle de difficulté ; « forte » à partir du double */
export const ESSAIS_DIFFICULTE = 3;
/** jours sans activité au-delà desquels l'élève est signalé « inactif » */
export const JOURS_INACTIF = 14;

// le jour à l'heure locale, comme PROG.jours (comptes/activite.js, cleJour)
const jour = (t) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** minutes de travail des n derniers jours (PROG.jours : { 'AAAA-MM-JJ': minutes }) */
export function minutesSur(prog, n, now = Date.now()) {
  const J = (prog && prog.jours) || {};
  let s = 0; for (let i = 0; i < n; i++) s += Number(J[jour(now - i * 864e5)]) || 0;
  return s;
}
export const minutesTotal = (prog) => Object.values((prog && prog.jours) || {}).reduce((a, b) => a + (Number(b) || 0), 0);
/** « 2 h 05 », « 35 min », « — » */
export const duree = (/** @type {number} */ min) => (!min ? '—' : min < 60 ? `${Math.round(min)} min` : `${Math.floor(min / 60)} h ${String(Math.round(min % 60)).padStart(2, '0')}`);

const titreLecon = (id) => { const l = lessonById(id); return l ? l.lesson.title : id; };
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

/**
 * @typedef {object} Difficulte
 * @property {'quiz' | 'exo' | 'aide' | 'epreuve'} type
 * @property {string} id identifiant de l'activité (leçon, mission…)
 * @property {string} titre ce qui coince
 * @property {string} texte en une phrase
 * @property {number} essais
 * @property {'forte' | 'moyenne' | 'aide'} gravite
 * @property {string} [chapitre] le chapitre du Cours (pour ranger)
 */
/**
 * Les difficultés d'un élève, les plus fortes d'abord.
 * @returns {Difficulte[]}
 */
export function difficultes(prog) {
  const P = prog || {};
  /** @type {Difficulte[]} */
  const out = [];
  const grav = (n) => /** @type {'forte' | 'moyenne'} */ (n >= 2 * ESSAIS_DIFFICULTE ? 'forte' : 'moyenne');
  for (const [id, c] of Object.entries(P.cours || {})) {
    if (!c) continue;
    const L = lessonById(id); const chapitre = L ? L.chapter.id : '';
    const e = etatLecon(id, P);
    // le quiz : essais comptés depuis la v19.24 (qn) ; jamais réussi en entier
    const qn = Number(c.qn) || 0;
    if (qn >= ESSAIS_DIFFICULTE && !e.quiz) {
      const q = c.quiz;
      out.push({ type: 'quiz', id, chapitre, titre: titreLecon(id), essais: qn, gravite: grav(qn), texte: `Quiz : ${pluriel(qn, 'essai')} sans le réussir en entier${q && q.total ? ` (meilleur ${q.score} / ${q.total})` : ''}.` });
    }
    // l'exercice en autonomie : n essais, jamais à la note demandée
    const x = c.exo;
    if (x && Number(x.n) >= ESSAIS_DIFFICULTE && !(x.best >= SEUIL_EXO)) out.push({ type: 'exo', id, chapitre, titre: titreLecon(id), essais: x.n, gravite: grav(x.n), texte: `Exercice : ${pluriel(x.n, 'essai')}, meilleur score ${x.best} / 100 (${SEUIL_EXO} demandés).` });
    else if (x && x.best >= SEUIL_EXO && !x.seul) out.push({ type: 'aide', id, chapitre, titre: titreLecon(id), essais: Number(x.n) || 1, gravite: 'aide', texte: `Exercice réussi seulement avec la solution (${pluriel(Number(x.n) || 1, 'essai')}) : à refaire seul.` });
  }
  // les épreuves notées : plusieurs essais, aucun à 60 sur 100
  const serie = (id, titre, scores, ok = (s) => s >= 60, fmt = (s) => `${s} / 100`) => {
    const a = scores.filter((s) => Number.isFinite(s)); if (a.length < ESSAIS_DIFFICULTE || a.some(ok)) return;
    const best = a.reduce((m, s) => (ok(s) || s > m ? s : m), a[0]);
    out.push({ type: 'epreuve', id, titre, essais: a.length, gravite: grav(a.length), texte: `${pluriel(a.length, 'essai')} sans réussite (meilleur ${fmt(best)}).` });
  };
  serie('emission', 'L\'émission en direct', (P.emissions || []).map((e) => e && e.score));
  serie('scenario', 'Le jour de match', (P.scenarios || []).map((s) => s && s.score));
  serie('examenReseau', 'L\'examen réseau', ((P.net || {}).exams || []).map((x) => x && x.score));
  serie('camera-mes', 'La mise en service de la caméra', (((P.camera || {}).mes || {}).runs || []).map((r) => r && r.score));
  for (const [id, m] of Object.entries((P.entrepot || {}).missions || {})) if (m) serie('entrepot-' + id, `Mission de l'entrepôt « ${id} »`, (m.runs || []).map((r) => r && r.score));
  // le montage de la caméra : réussi à 2 erreurs au plus ; on garde le moins d'erreurs
  { const a = (P.rigs || []).map((r) => r && r.errs).filter((e) => Number.isFinite(e)); if (a.length >= ESSAIS_DIFFICULTE && !a.some((e) => e <= 2)) out.push({ type: 'epreuve', id: 'atelier', titre: 'Le montage de la caméra', essais: a.length, gravite: grav(a.length), texte: `${pluriel(a.length, 'essai')}, jamais moins de ${Math.min(...a)} erreurs.` }); }
  // les exercices pratiques avec Olivier terminés grâce à « Fais-le pour moi »
  for (const [id, t] of Object.entries(P.tutor || {})) if (t && t.done && t.aided && !t.clean) out.push({ type: 'aide', id: 'tutor-' + id, titre: `Exercice pratique « ${id} »`, essais: 1, gravite: 'aide', texte: 'Terminé avec « Fais-le pour moi » : à refaire seul.' });
  const rang = { forte: 0, moyenne: 1, aide: 2 };
  return out.sort((a, b) => rang[a.gravite] - rang[b.gravite] || b.essais - a.essais);
}

/**
 * Le bilan d'un élève.
 * @param {any} prog sa progression (null : jamais connecté)
 * @param {number} [now]
 */
export function bilanEleve(prog, now = Date.now()) {
  const P = prog || {};
  const chapitres = CHAPTERS.map((ch) => { const b = bilanChapitre(ch.id, P); return { id: ch.id, titre: ch.title, lecons: b.lecons, terminees: b.terminees, etoiles: b.etoiles, max: b.max, niveau: b.courant ? b.courant.niveau.titre : '', fini: b.fini }; });
  const lecons = chapitres.reduce((s, c) => s + c.lecons, 0), terminees = chapitres.reduce((s, c) => s + c.terminees, 0);
  const C = Object.values(P.cours || {}).filter(Boolean);
  const exos = C.map((c) => c.exo).filter((x) => x && Number.isFinite(x.best));
  const quiz = C.filter((c) => c.quiz && c.quiz.total);
  const xp = xpOf(P), lvl = levelOf(xp);
  const L = livret(P);
  const dernier = Number(P.updatedAt) || 0;
  const diff = difficultes(P);
  return {
    jamais: !prog || !dernier,
    dernier, inactif: !!dernier && now - dernier > JOURS_INACTIF * 864e5,
    xp, niveau: lvl.title, niveauN: lvl.n,
    lecons, terminees, vues: C.filter((c) => c.seen).length,
    quizReussis: quiz.filter((c) => c.quiz.score === c.quiz.total).length, quizFaits: quiz.length,
    moyenneExos: exos.length ? Math.round(exos.reduce((s, x) => s + x.best, 0) / exos.length) : null, exosFaits: exos.length,
    exosSeul: exos.filter((x) => x.seul).length,
    chapitres,
    competences: L.count, competencesTotal: L.total,
    minutes: { total: minutesTotal(P), semaine: minutesSur(P, 7, now) },
    difficultes: diff, alertes: diff.filter((d) => d.gravite !== 'aide').length,
  };
}

/**
 * La synthèse d'une classe : moyennes, élèves à suivre, leçons où la classe bloque.
 * @param {{ uid: string, nom: string, prog: any }[]} eleves
 */
export function bilanClasse(eleves, now = Date.now()) {
  const B = eleves.map((e) => ({ ...e, b: bilanEleve(e.prog, now) }));
  const actifs = B.filter((e) => !e.b.jamais);
  const moy = (f) => (actifs.length ? Math.round(actifs.reduce((s, e) => s + f(e.b), 0) / actifs.length) : null);
  // les leçons où plusieurs élèves sont en difficulté
  const parLecon = new Map();
  for (const e of B) for (const d of e.b.difficultes) if (d.type !== 'epreuve' && d.gravite !== 'aide') { const k = d.id; const x = parLecon.get(k) || { id: k, titre: d.titre, eleves: [] }; if (!x.eleves.includes(e.nom)) x.eleves.push(e.nom); parLecon.set(k, x); }
  return {
    effectif: B.length, actifs: actifs.length,
    jamais: B.filter((e) => e.b.jamais).map((e) => e.nom),
    inactifs: B.filter((e) => e.b.inactif).map((e) => e.nom),
    aSuivre: B.filter((e) => e.b.alertes > 0).sort((a, b) => b.b.alertes - a.b.alertes).map((e) => ({ nom: e.nom, uid: e.uid, alertes: e.b.alertes })),
    moyenneTerminees: moy((b) => b.terminees), lecons: B.length ? B[0].b.lecons : 0,
    moyenneExos: (() => { const a = actifs.map((e) => e.b.moyenneExos).filter((x) => x != null); return a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : null; })(),
    minutesSemaine: moy((b) => b.minutes.semaine),
    leconsDifficiles: [...parLecon.values()].sort((a, b) => b.eleves.length - a.eleves.length).slice(0, 8),
    eleves: B,
  };
}

// ---------------- le car régie (v19.25) ----------------
/**
 * @typedef {object} CatalogueCar ce que le simulateur propose (le tableau de bord le lit dans le code de l'application)
 * @property {{ id: string, titre: string, zone: string }[]} postes les postes (content/stations.js)
 * @property {{ id: string, titre: string, groupe: string, famille: string, taches?: string[] }[]} exos les missions spécifiques :
 *   installer le car (taches : missions du car vide), exercices pratiques d'Olivier, épreuves notées (game/missions.js)
 * @property {{ id: string, titre: string }[]} [missionsCar] les tâches du car vide (ui/guide.js, MISSIONS)
 * @property {string[]} [lieux] les destinations du stade (app/teleport.js, DESTS)
 * @property {Record<string, string>} [appareils] le nom du matériel (equipment/cabling.js, DEV_NAMES)
 * @property {(id: string, prog: any) => { done: boolean, text: string }} [epreuve] l'état d'une épreuve notée (cours/exercices.js)
 */
/** l'état d'un exercice pratique : réussi seul, réussi avec « Fais-le pour moi », commencé, abandonné, à faire */
export const STATUTS = { seul: 'Réussi seul', aide: 'Réussi avec aide', commence: 'Commencé', abandon: 'Abandonné', afaire: 'Pas commencé' };
const tri = (o) => Object.entries(o || {}).map(([k, n]) => ({ k, n: Number(n) || 0 })).sort((a, b) => b.n - a.n);

/**
 * Ce qu'un élève a fait au car régie : temps (en secondes) par activité et par poste, manipulation,
 * exercices pratiques et épreuves, tâches du car vide, ce qu'il a consulté, pannes, dernières parties.
 * @param {any} prog @param {CatalogueCar} cat
 */
export function bilanCar(prog, cat) {
  const P = prog || {};
  const C = P.car && typeof P.car === 'object' ? P.car : {};
  const t = C.t || {}, Po = C.postes || {}, Ex = C.exos || {}, Mi = C.missions || {}, V = C.vus || {};
  const temps = { jeu: Number(t.jeu) || 0, car: Number(t.car) || 0, stade: Number(t.stade) || 0, poste: Number(t.poste) || 0, cadreur: Number(t.cadreur) || 0, plan: Number(t.plan) || 0 };
  // les postes : tous ceux du simulateur, les plus pratiqués d'abord, ceux jamais ouverts ensuite
  const postes = cat.postes.map((p) => { const x = Po[p.id] || {}; const s = Number(x.s) || 0, m = Math.min(s, Number(x.m) || 0); return { ...p, n: Number(x.n) || 0, s, m, a: Number(x.a) || 0, d: Number(x.d) || 0, part: s ? m / s : 0 }; })
    .sort((a, b) => b.s - a.s || b.n - a.n || a.titre.localeCompare(b.titre, 'fr'));
  // les exercices pratiques et les épreuves, avec leur état
  const T = P.tutor || {};
  const exos = cat.exos.map((e) => {
    const x = Ex[e.id] || {}; const m = Mi[e.id] || {}; const tu = T[e.id] || {};
    let statut = 'afaire', texte = '';
    if (e.famille === 'installer' && e.taches && e.taches.length) {
      const faites = e.taches.filter((k) => (P.missions || {})[k]).length;
      statut = faites === e.taches.length ? 'seul' : faites || m.n ? 'commence' : 'afaire'; texte = `${faites} / ${e.taches.length} tâches`;
    } else if (e.famille === 'epreuves' || (cat.epreuve && /^x-/.test(e.id))) {
      const r = cat.epreuve ? cat.epreuve(e.id, P) : { done: false, text: '' };
      statut = r.done ? 'seul' : (m.n || m.f || (r.text && !/^pas encore/.test(r.text))) ? 'commence' : 'afaire'; texte = r.text;
    } else if (tu.done) { statut = tu.clean || !tu.aided ? 'seul' : 'aide'; texte = `${tu.hints || 0} indice${(tu.hints || 0) > 1 ? 's' : ''}, ${tu.wrong || 0} erreur${(tu.wrong || 0) > 1 ? 's' : ''}`; }
    else if (x.n || tu.started || m.n) statut = x.ab && !x.f ? 'abandon' : 'commence';
    return { ...e, statut, texte, essais: Math.max(Number(x.n) || 0, Number(m.n) || 0, tu.started ? 1 : 0), finis: Number(x.f) || (tu.done ? 1 : 0), abandons: Number(x.ab) || 0,
      aide: Number(x.aide) || 0, ind: Number(x.ind) || 0, err: Number(x.err) || 0, s: Number(x.s) || 0, d: Math.max(Number(x.d) || 0, Number(m.d) || 0, Number(tu.at) || 0) };
  });
  const compte = (f) => { const l = exos.filter(f); return { total: l.length, seul: l.filter((e) => e.statut === 'seul').length, aide: l.filter((e) => e.statut === 'aide').length, commence: l.filter((e) => e.statut === 'commence' || e.statut === 'abandon').length }; };
  const mc = cat.missionsCar || [];
  const lieux = cat.lieux || [], app = cat.appareils || {};
  return {
    temps, postes, postesVus: postes.filter((p) => p.n || p.s).length, postesTotal: postes.length,
    manip: { s: postes.reduce((a, p) => a + p.m, 0), actions: postes.reduce((a, p) => a + p.a, 0) },
    exos, exercices: compte((e) => e.famille === 'postes'), epreuves: compte((e) => e.famille === 'epreuves'), installation: compte((e) => e.famille === 'installer'),
    missionsCar: { total: mc.length, faites: mc.filter((m) => (P.missions || {})[m.id]).length, liste: mc.map((m) => ({ ...m, ok: !!(P.missions || {})[m.id] })) },
    vus: {
      app: tri(V.app).map((x) => ({ ...x, nom: app[x.k] || x.k })),
      lieux: tri(V.lieux).map((x) => ({ ...x, nom: lieux[Number(x.k)] || `Lieu ${x.k}` })),
      fen: tri(V.fen).map((x) => ({ ...x, nom: x.k })),
    },
    pannes: { n: Number((C.pannes || {}).n) || 0, ok: Number((C.pannes || {}).ok) || 0 },
    sessions: (Array.isArray(C.sessions) ? C.sessions : []).slice(-15).reverse().map((s) => ({ at: Number(s.at) || 0, s: Number(s.s) || 0, p: String(s.p || ''), mode: String(s.mode || ''), postes: Array.isArray(s.postes) ? s.postes : [] })),
  };
}
/** minutes de travail des n derniers jours, du plus ancien au plus récent : [{ jour, min }] (le graphique d'activité) */
export function joursRecents(prog, n = 14, now = Date.now()) {
  const J = (prog && prog.jours) || {}; const out = [];
  for (let i = n - 1; i >= 0; i--) { const k = jour(now - i * 864e5); out.push({ jour: k, min: Number(J[k]) || 0 }); }
  return out;
}
/** « 1 h 05 » à partir de secondes */
export const dureeS = (/** @type {number} */ s) => (!s ? '—' : s < 60 ? `${Math.round(s)} s` : duree(s / 60));
