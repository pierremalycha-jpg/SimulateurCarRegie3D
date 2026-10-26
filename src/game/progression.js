// @ts-check
import { S, on, emit } from '../state.js';
import { PROG } from '../shared.js';
import { award, bump, BAREME, checkBadges } from './xp.js';
import { lessonById, progressOf } from '../tutor/engine.js';
import { MISSIONS } from '../ui/guide.js';
import { NET_MISSIONS } from '../net/course.js';
import { STATION_INFO } from '../content/stations.js';
import { DESTS } from '../app/teleport.js';
import { lessonById as coursLesson, CHAPTERS } from '../cours/index.js';
import { etatNiveaux, testPasse, niveauInfo } from '../cours/parcours.js';
import { SEUIL_EXO, SEUIL_PARFAIT } from '../cours/exo.js';
import { NOTIONS } from '../camlab/notions/index.js';
import { MISSIONS as EP_MISSIONS } from '../entrepot/missions.js';

// ----------------------------------------------------------------------------------
// Les activités du simulateur qui rapportent de l'XP (game/xp.js) : chaque événement du
// simulateur est traduit en récompense, une fois (clé) ou à chaque fois.
// ----------------------------------------------------------------------------------
const title = (list, id) => { const m = list.find((x) => x.id === id); return m ? m.title : id; };
export function installProgression() {
  on('mission', (id) => award({ key: 'mission:' + id, pts: BAREME.mission, label: 'Mission réussie : ' + title(MISSIONS, id) }));
  on('tutor', (e) => {
    if (!e || e.type !== 'finish') return;
    const l = lessonById(e.id); const p = progressOf(e.id); const name = l ? l.title : e.id;
    bump('exercice');
    if (e.id.startsWith('poste-')) { award({ key: 'tutor:' + e.id, pts: BAREME.presentation, label: 'Poste présenté : ' + name }); return; }
    const first = award({ key: 'tutor:' + e.id, pts: Math.max(BAREME.exerciceMin, BAREME.exercice - BAREME.aide * (p.aided || 0) - BAREME.indice * (p.hints || 0)), label: 'Exercice terminé : ' + name });
    // refait : seulement sans « Fais-le pour moi » (refaire un exercice que le chef fait à notre place ne rapporte rien)
    if (!first && !p.aided) award({ pts: BAREME.exerciceRefait, label: 'Exercice refait seul : ' + name });
  });
  on('quiz', (e) => { if (!e || e.score !== e.total) return; const L = coursLesson(e.id); award({ key: 'quiz:' + e.id, pts: BAREME.quiz, label: 'Leçon acquise : ' + (L ? L.lesson.title : e.id) }); niveaux(); });
  // le parcours du Cours : l'exercice en autonomie (réussi, puis à trois étoiles), le test de niveau, le niveau validé
  on('coursExo', (e) => {
    if (!e || e.score < SEUIL_EXO) return;
    const L = coursLesson(e.id); const t = L ? L.lesson.title : e.id;
    award({ key: 'exo:' + e.id, pts: BAREME.exoCours, label: 'Exercice réussi : ' + t });
    if (e.score >= SEUIL_PARFAIT && e.seul) award({ key: 'exo3:' + e.id, pts: BAREME.exoParfait, label: 'Trois étoiles : ' + t });
    niveaux();
  });
  on('niveauTest', (e) => {
    if (!e || !testPasse(e.score, e.total)) return;
    const ch = CHAPTERS.find((c) => c.id === e.chapitre);
    award({ key: 'test:' + e.chapitre + ':' + e.niveau, pts: BAREME.testNiveau, label: `Test réussi : niveau ${niveauInfo(e.niveau).titre} ouvert (${ch ? ch.title : e.chapitre})` });
  });
  on('camlab', (e) => {
    if (!e) return;
    if (e.type === 'notion' && e.score === e.total) award({ key: 'notion:' + e.id, pts: BAREME.notion, label: 'Notion acquise : ' + (NOTIONS[e.id] ? NOTIONS[e.id].t : e.id) });
    if (e.type === 'quiz' && e.score === e.total) award({ key: 'camquiz:' + e.n, pts: BAREME.quizChapitre, label: 'Quiz du chapitre ' + e.n + ' réussi' });
    if (e.type === 'mes' && e.score >= 60) { if (!award({ key: 'mes', pts: BAREME.mes, label: 'Caméra mise en service : ' + e.score + '/100' })) award({ pts: BAREME.mesRefaite, label: 'Mise en service refaite : ' + e.score + '/100' }); }
  });
  on('netMission', (e) => { if (e) award({ key: 'net:' + e.id, pts: e.aided ? BAREME.reseauAidee : BAREME.reseau, label: 'Mission réseau : ' + title(NET_MISSIONS, e.id) }); });
  // seules les pannes cachées comptent (jour de match, examen, formateur, exercices) : une panne injectée depuis le
  // catalogue affiche son poste et son remède. Chaque panne rapporte ses points la première fois, peu ensuite.
  on('faultSolved', (a) => {
    if (!a || !a.hidden) return;
    const fast = a.dt < 60; if (fast) bump('panneRapide');
    if (award({ key: 'panne:' + a.f.id, pts: fast ? BAREME.panneRapide : BAREME.panne, label: (fast ? 'Panne résolue en moins d\'une minute : ' : 'Panne résolue : ') + a.f.label })) bump('panne');
    else award({ pts: BAREME.panneRefaite, label: 'Panne déjà rencontrée, résolue de nouveau : ' + a.f.label });
  });
  on('scenarioDone', (r) => { if (r) award({ pts: r.score, label: 'Jour de match terminé : ' + r.score + ' %' }); });
  on('atelier', (e) => { if (!e || e.type !== 'done') return; if (!award({ key: 'atelier', pts: BAREME.atelier, label: 'Caméra montée à l\'atelier' })) award({ pts: BAREME.atelierRefait, label: 'Montage refait à l\'atelier' }); });
  on('patchDone', () => award({ key: 'brassage', pts: BAREME.brassage, label: 'Car vide brassé à 100 %' }));
  // l'entrepôt : un montage rendu à 60/100 au moins (entrepot/suivi.js) ; refait : 25
  on('entrepotRendu', (e) => {
    if (!e || e.score < 60) return;
    const name = title(/** @type {any} */ (EP_MISSIONS).map((x) => ({ id: x.id, title: x.titre })), e.id);
    if (!award({ key: 'entrepot:' + e.id, pts: BAREME.entrepot, label: 'Mission de l\'entrepôt réussie : ' + name })) award({ pts: BAREME.entrepotRefait, label: 'Montage rendu de nouveau : ' + name + ' (' + e.score + '/100)' });
  });
  // la Carrière (src/carriere/) : une mission réussie ne rapporte pas d'XP de plus (l'activité qu'elle reprend
  // a déjà rapporté les siens) ; elle compte pour son badge
  on('carriere', (e) => { if (e && e.type === 'fait') checkBadges(); });
  // le poste compte tout de suite pour les badges (la progression n'est copiée qu'à l'enregistrement)
  on('station', (id) => { PROG.visited[id] = true; award({ key: 'poste:' + id, pts: BAREME.poste, label: 'Poste découvert : ' + (STATION_INFO[id] ? STATION_INFO[id].title : id) }); });
  on('teleport', (i) => { const d = DESTS[i]; if (d && !d[4]) award({ key: 'lieu:' + i, pts: BAREME.lieu, label: 'Endroit découvert : ' + d[0] }); });
  // un niveau validé par ses leçons rapporte ses points une fois (game/xp.js) et prévient le Cours (« niveau »)
  function niveaux() {
    for (const ch of CHAPTERS) for (const n of etatNiveaux(ch.id, PROG)) {
      if (n.ok && award({ key: 'niveau:' + ch.id + ':' + n.niveau.id, pts: BAREME.niveau, label: `Niveau ${n.niveau.titre} validé : ${ch.title}` })) emit('niveau', { chapitre: ch.id, niveau: n.niveau.id });
    }
  }
  // un état qui change sans événement (missions réussies, visites) : les badges sont revérifiés de temps en temps
  setInterval(() => { if (S.mode !== 'start') checkBadges(); }, 4000);
}
