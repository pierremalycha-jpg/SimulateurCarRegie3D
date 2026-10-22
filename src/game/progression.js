// @ts-check
import { S, on } from '../state.js';
import { PROG } from '../shared.js';
import { award, bump, BAREME, checkBadges } from './xp.js';
import { lessonById, progressOf } from '../tutor/engine.js';
import { MISSIONS } from '../ui/guide.js';
import { NET_MISSIONS } from '../net/course.js';
import { STATION_INFO } from '../content/stations.js';
import { DESTS } from '../app/teleport.js';
import { lessonById as coursLesson } from '../cours/index.js';
import { NOTIONS } from '../camlab/notions/index.js';
import { noteCourante } from '../entrepot/index.js';
import { B as BUILD } from '../entrepot/build.js';
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
    if (!first) award({ pts: BAREME.exerciceRefait, label: 'Exercice refait : ' + name });
  });
  on('quiz', (e) => { if (!e || e.score !== e.total) return; const L = coursLesson(e.id); award({ key: 'quiz:' + e.id, pts: BAREME.quiz, label: 'Leçon acquise : ' + (L ? L.lesson.title : e.id) }); });
  on('camlab', (e) => {
    if (!e) return;
    if (e.type === 'notion' && e.score === e.total) award({ key: 'notion:' + e.id, pts: BAREME.notion, label: 'Notion acquise : ' + (NOTIONS[e.id] ? NOTIONS[e.id].t : e.id) });
    if (e.type === 'quiz' && e.score === e.total) award({ key: 'camquiz:' + e.n, pts: BAREME.quizChapitre, label: 'Quiz du chapitre ' + e.n + ' réussi' });
    if (e.type === 'mes' && e.score >= 60) { if (!award({ key: 'mes', pts: BAREME.mes, label: 'Caméra mise en service : ' + e.score + '/100' })) award({ pts: BAREME.mesRefaite, label: 'Mise en service refaite : ' + e.score + '/100' }); }
  });
  on('netMission', (e) => { if (e) award({ key: 'net:' + e.id, pts: e.aided ? BAREME.reseauAidee : BAREME.reseau, label: 'Mission réseau : ' + title(NET_MISSIONS, e.id) }); });
  on('faultSolved', (a) => { if (!a) return; const fast = a.dt < 60; bump('panne'); if (fast) bump('panneRapide'); award({ pts: fast ? BAREME.panneRapide : BAREME.panne, label: (fast ? 'Panne résolue en moins d\'une minute : ' : 'Panne résolue : ') + a.f.label }); });
  on('scenarioDone', (r) => { if (r) award({ pts: r.score, label: 'Jour de match terminé : ' + r.score + ' %' }); });
  on('atelier', (e) => { if (!e || e.type !== 'done') return; if (!award({ key: 'atelier', pts: BAREME.atelier, label: 'Caméra montée à l\'atelier' })) award({ pts: BAREME.atelierRefait, label: 'Montage refait à l\'atelier' }); });
  on('patchDone', () => award({ key: 'brassage', pts: BAREME.brassage, label: 'Car vide brassé à 100 %' }));
  on('entrepot', (e) => {
    if (!e || e.type !== 'change' || !BUILD.mission) return;
    let n; try { n = noteCourante(); } catch (err) { n = null; }
    if (n && n.score >= 60) {
      const P = /** @type {any} */ (PROG); P.entrepot = P.entrepot || {}; P.entrepot.missions = P.entrepot.missions || {};
      const m = P.entrepot.missions[BUILD.mission] || (P.entrepot.missions[BUILD.mission] = {}); if (!m.best || n.score > (m.best.score ?? m.best)) m.best = { score: n.score, at: Date.now() };
      award({ key: 'entrepot:' + BUILD.mission, pts: BAREME.entrepot, label: 'Mission de l\'entrepôt réussie : ' + title(/** @type {any} */ (EP_MISSIONS).map((x) => ({ id: x.id, title: x.titre })), BUILD.mission) });
    }
  });
  on('station', (id) => award({ key: 'poste:' + id, pts: BAREME.poste, label: 'Poste découvert : ' + (STATION_INFO[id] ? STATION_INFO[id].title : id) }));
  on('teleport', (i) => { const d = DESTS[i]; if (d && !d[4]) award({ key: 'lieu:' + i, pts: BAREME.lieu, label: 'Endroit découvert : ' + d[0] }); });
  // un état qui change sans événement (missions réussies, visites) : les badges sont revérifiés de temps en temps
  setInterval(() => { if (S.mode !== 'start') checkBadges(); }, 4000);
}
