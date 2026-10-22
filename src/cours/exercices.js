// @ts-check
import { PROG } from '../shared.js';
import { lessonById as tutorLesson, progressOf } from '../tutor/engine.js';
import { NET_MISSIONS } from '../net/course.js';
import { allLessons } from './index.js';
import { mesBest, MES_SEUIL } from '../camlab/progress.js';

// ----------------------------------------------------------------------------------
// Les exercices pratiques du Cours. Deux sortes :
//   - les parcours guidés d'Olivier, le chef de car (src/tutor/lessons) : on les fait dans le car,
//     il explique, on agit, il vérifie ; « Commencer » lance le car si besoin et ouvre le poste ;
//   - les exercices notés (« x-… ») : une vacation à part (atelier, car vide, jour de match) ou la
//     formation réseau, avec un résultat enregistré ; ou la mise en service de la caméra de
//     plateau, dans le module « La caméra en 3D » (x-camera, src/camlab/mes.js).
// Chaque exercice est rangé dans une leçon : soit dans la leçon elle-même (champ exercises des
// chapitres écrits dans cours/*.js), soit ici, pour les leçons écrites avant les exercices (BY_LESSON).
// Un exercice n'est rangé qu'une fois. Les présentations de postes (« Présente-moi ») et la prise
// en main forment le mode Visite guidée (écran Jouer), pas des exercices.
// ----------------------------------------------------------------------------------
/** @typedef {{ id: string, title: string, summary: string, duration: string, level: string, go: any, special?: boolean }} ExerciseInfo */

/** les exercices notés : une vacation à part ou la formation réseau */
export const SPECIAL = {
  'x-atelier': { title: 'Atelier : monter une caméra seul, chronométré', summary: 'Monter une caméra de stade pièce par pièce, du pied jusqu\'à la fibre, puis la régler. Le temps et les erreurs sont notés.', duration: '15 min', level: 'intermédiaire', go: { preset: 'atelier', label: 'Lancer l\'atelier' } },
  'x-brassage': { title: 'Le car vide : tout brasser, noté', summary: 'Rien n\'est brassé : reliez chaque liaison au bon endroit en suivant la liste de câblage, jusqu\'à ce que le multiview soit complet.', duration: '20 min', level: 'intermédiaire', go: { preset: 'brassage', label: 'Lancer le car vide' } },
  'x-reseau': { title: 'Formation réseau ST 2110 : 14 missions, quiz, examen', summary: 'Dans le poste Réseau IP : de la lecture de la topologie au dépannage, puis un quiz et un examen de trois pannes cachées.', duration: '2 h', level: 'avancé', go: { station: 'reseau', tab: 'learn', ip: true, label: 'Ouvrir la formation' } },
  'x-camera': { title: 'Mise en service de la caméra de plateau, notée', summary: 'Dans le module « La caméra en 3D » : de l\'objectif démonté au fichier de scène, avec la fibre, la CCU, le RCP, le viseur, le tirage, les balances et l\'exposition. L\'ordre, chaque geste et le temps sont notés sur 100.', duration: '10 min', level: 'intermédiaire', go: { camera: 'mes', label: 'Ouvrir la mise en service' } },
  'x-entrepot': { title: 'L\'entrepôt : monter la régie de la cérémonie, notée', summary: 'Dans l\'entrepôt : trois caméras PTZ, un pupitre, un mélangeur, un enregistreur, un embedder pour le micro de la salle. Sortir le matériel, le poser, le câbler, le configurer (adresses, formats, tally) jusqu\'à remplir le cahier des charges.', duration: '30 min', level: 'intermédiaire', go: { entrepot: 'conference', label: 'Entrer dans l\'entrepôt' } },
  'x-match': { title: 'Jour de match : line-up, test de ligne, direct avec pannes', summary: 'De 17 h 30 à l\'antenne : line-up des caméras, test de ligne avec la chaîne, puis le direct, avec des pannes à résoudre. Chronométré et noté.', duration: '30 min', level: 'avancé', go: { preset: 'scenario', label: 'Lancer le jour de match' } },
};
/** meilleur score d'une mission de l'entrepôt (PROG.entrepot.missions[id].best), ou null */
export const entrepotBest = (P, id) => { const m = P && P.entrepot && P.entrepot.missions ? P.entrepot.missions[id] : null; return m && m.best != null ? Number(m.best.score ?? m.best) : null; };
const best = (a) => (a && a.length ? Math.max(...a.map((x) => x.score || 0)) : null);
/** résultat d'un exercice noté : { done, text } */
export function specialState(id) {
  const P = PROG; const N = P.net || { missions: {}, quiz: [], exams: [] };
  if (id === 'x-atelier') { const r = (P.rigs || []).slice().sort((a, b) => a.errs - b.errs || a.sec - b.sec)[0]; return r ? { done: true, text: `meilleur montage : ${r.errs} erreur${r.errs > 1 ? 's' : ''}, ${Math.floor(r.sec / 60)} min` } : { done: false, text: 'pas encore fait' }; }
  if (id === 'x-brassage') return P.patchBest ? { done: P.patchBest >= 100, text: `brassage réussi à ${P.patchBest} %` } : { done: false, text: 'pas encore fait' };
  if (id === 'x-reseau') { const n = NET_MISSIONS.filter((m) => (N.missions || {})[m.id]).length; const e = best(N.exams); return { done: n === NET_MISSIONS.length && e != null && e >= 60, text: n || e != null ? `${n} / ${NET_MISSIONS.length} missions${e != null ? ` · examen ${e} %` : ''}` : 'pas encore commencé' }; }
  if (id === 'x-camera') { const b = mesBest(P); return b ? { done: b.score >= MES_SEUIL, text: `meilleur résultat ${b.score} / 100, ${b.errs} erreur${b.errs > 1 ? 's' : ''}, ${Math.floor(b.sec / 60)} min ${String(b.sec % 60).padStart(2, '0')} s` } : { done: false, text: 'pas encore faite' }; }
  if (id === 'x-entrepot') { const b = entrepotBest(P, 'conference'); return b != null ? { done: b >= 60, text: `meilleur résultat ${b} / 100` } : { done: false, text: 'pas encore faite' }; }
  if (id === 'x-match') { const b = best(P.scenarios); return b != null ? { done: b >= 60, text: `meilleur score ${b} %` } : { done: false, text: 'pas encore joué' }; }
  return { done: false, text: '' };
}

/** exercices des leçons écrites avant les exercices : leçon → exercices et leur présentation */
/** @type {Record<string, Array<{ id: string, intro: string }>>} */
export const BY_LESSON = {
  // la mise en service : la chaîne caméra entière (tête, objectif, fibre, CCU, RCP) que la leçon décrit
  'camera-systeme': [
    { id: 'x-camera', intro: 'Exercice noté, dans le module « La caméra en 3D » : la caméra du plateau sort de son flight-case et vous la mettez en service seul, de l\'objectif au fichier de scène. Vous y retrouvez la leçon : la fibre nettoyée et branchée avant d\'alimenter, le niveau optique lu à la CCU, puis tout ce que la vision règle au RCP. Chaque erreur d\'ordre ou de geste est expliquée dans le bilan.' },
  ],
  'signal-niveaux': [
    { id: 'vision-exposition', intro: 'Au poste vision, une caméra a l\'iris fermé : vous déverrouillez son RCP (PANEL ACTIVE), puis vous rouvrez l\'iris au joystick, cran par cran. Réglez en regardant le waveform plutôt que le moniteur : la moyenne de l\'image doit remonter entre 35 et 55 %, et les blancs rester sous la ligne des 100 %.' },
    { id: 'prism-waveform', intro: 'Au poste vision, vous mettez une tuile du PRISM en waveform et vous lisez les niveaux au curseur, en mV et en % (700 mV = 100 % = code 940). La parade RVB montre ensuite un noir qui tire au rouge : vous le corrigez au RCP, jusqu\'à ce que les trois traces repartent du même niveau en bas de l\'échelle.' },
  ],
  'signal-couleur': [
    { id: 'vision-balance', intro: 'Au poste vision, vous envoyez les barres d\'une caméra pour vérifier la chaîne, puis vous corrigez une caméra qui dérive vers le rouge par une balance des blancs automatique (AWB). Sur la parade RVB, regardez un blanc : rouge, vert et bleu doivent revenir à la même hauteur, sinon le blanc n\'est plus le blanc de référence de l\'espace de couleur.' },
    { id: 'prism-gamut', intro: 'Au poste vision, la mire d\'une caméra tombe dans les cibles 75 % du vecteurscope ; puis la saturation est poussée et vous ramenez l\'image dans le diamant au RCP (saturation, knee, white clip). Le diamant montre ce qu\'est un signal hors gamut : une composante R, V ou B qui passe sous 0 ou au-dessus de 700 mV et sera écrêtée plus loin dans la chaîne.' },
  ],
  'sdi-oeil': [
    { id: 'prism-oeil', intro: 'À la baie de mesure, vous affichez l\'œil de la mire du SPG, la référence, puis vous cherchez la sortie caméra qui accumule des erreurs CRC alors que son image paraît parfaite. Comparez l\'œil brut et l\'œil égalisé, l\'affaiblissement et la marge lus par l\'instrument : c\'est l\'effet de falaise de la leçon, repéré avant la chute.' },
  ],
  'sdi-cable': [
    { id: 'brassage-cordons', intro: 'À la baie de brassage, vous passez en « car vide », puis vous câblez au cordon une caméra vers la grille, sa référence depuis le distributeur (DA) et le départ vers le codeur de transmission. Observez ce que change la baie normalée : sans cordon, chaque sortie est déjà reliée à l\'entrée prévue ; un cordon sert à dévier un signal.' },
    { id: 'x-brassage', intro: 'Exercice noté : rien n\'est brassé, et vous reliez chaque liaison à sa place en suivant la liste de câblage, jusqu\'à ce que le multiview soit complet. Chaque cordon est un passage de plus dans la baie : vérifiez la prise de départ et la prise d\'arrivée avant de brancher, une erreur se voit aussitôt au multiview.' },
  ],
  'reseau-ip': [
    { id: 'ctrlnet-bases', intro: 'Au poste Réseau du car SDI, vous ouvrez la fiche du RCP 1 pour lire son adresse (10.1.20.31) et son masque (/24), puis vous lancez deux pings : vers la CCU 1, dans le même sous-réseau, et depuis le PC de supervision, dans un autre VLAN. Regardez le chemin affiché : direct quand la partie réseau est la même, par la passerelle et le routage du SW-CŒUR sinon.' },
    { id: 'ctrlnet-machine', intro: 'Au poste Réseau, vous mettez en service le PC d\'habillage de secours : son port dans le VLAN 60, une adresse fixe (10.1.60.10), le masque /24, la passerelle 10.1.60.1 et sa classe de QoS. Deux pings le vérifient : vers le NAS, dans le même sous-réseau, puis depuis la supervision ; c\'est le second qui prouve que la passerelle est juste.' },
  ],
  'reseau-switch': [
    { id: 'ctrlnet-depannage', intro: 'Au poste Réseau, une panne tirée au sort rend une machine injoignable : câble débranché, port dans le mauvais VLAN, masque faux ou conflit d\'adresse. Vous la localisez au balayage et dans sa fiche, en remontant les couches ; la table MAC aide à trancher : une machine qui n\'y figure pas n\'envoie plus aucune trame, une machine apprise mais muette est mal rangée ou mal configurée.' },
  ],
  'reseau-multicast': [
    { id: 'reseau-visite', intro: 'Visite commentée du poste Réseau IP, dans le car IP : les réseaux rouge et bleu, spines et leaves, le plan d\'adressage des groupes multicast, puis un flux suivi de la caméra jusqu\'au mélangeur et son SDP. Repérez dans le SDP le groupe (ligne c=) et la source (a=source-filter) : c\'est le couple (S, G) auquel le récepteur s\'abonne par IGMPv3.' },
    { id: 'reseau-leaf', intro: 'Au terminal d\'une leaf neuve, sortie d\'usine, vous tapez sa configuration couche par couche : ports et VLAN, routage, OSPF, puis le multicast (plage SSM, PIM vers les spines, IGMPv3 sur le VLAN des caméras) et PTP. Dans l\'onglet Flux, observez que les flux des caméras ne repassent par le réseau rouge qu\'une fois PIM et IGMP en place.' },
    { id: 'reseau-passerelle', intro: 'Dans l\'onglet Exploitation du poste Réseau IP, vous configurez une passerelle IP vers SDI sortie d\'usine (adresses rouge et bleue, contrôle NMOS, domaine PTP), puis vous l\'abonnez au clean feed, d\'abord à la main, ensuite par NMOS. En saisie manuelle, vous écrivez la source, le groupe et le port de chaque réseau : une seule erreur sur la source, et le filtre SSM ne laisse rien passer.' },
    { id: 'reseau-depannage', intro: 'Le réalisateur a perdu une caméra. Au poste Réseau IP, vous délimitez la panne (une source ou plusieurs, un réseau ou les deux), puis vous descendez les couches jusqu\'au port de la CCU, sur la leaf rouge puis sur la bleue. Regardez la réception : rien n\'arrive par aucun des deux groupes tant que l\'émetteur est isolé de son VLAN, et le flux revient dès que le port est corrigé.' },
    { id: 'x-reseau', intro: 'Exercice noté, dans l\'onglet Formation du poste Réseau IP : 14 missions, de la lecture de la topologie au dépannage, un quiz, puis un examen de trois pannes cachées. Plusieurs missions reprennent cette leçon (suivre un flux de bout en bout, lire un SDP, bande passante et PIM) : faites-les sans aide pour vérifier ce que vous avez retenu.' },
  ],
  'reseau-ptp': [
    { id: 'reseau-ptp', intro: 'Au poste Réseau IP, onglet PTP, vous lisez quel grand maître est élu, vous le vérifiez en ligne de commande (show ptp parent), puis vous coupez le grand maître 1 en plein direct avant de le remettre en service. Observez l\'élection (BMCA) : le grand maître 2 prend la main en moins d\'une seconde et les caméras restent verrouillées, parce que les deux grands maîtres sont calés sur le GPS.' },
  ],
  'hf-bilan': [
    { id: 'hf-liaisons', intro: 'Au poste HF, vous mettez une deuxième antenne de réception en service, puis vous sortez une caméra HF d\'un canal brouillé vers un canal attribué libre. Suivez la marge de chaque liaison, l\'écart entre le signal reçu et le minimum que demande la modulation : elle remonte avec la deuxième antenne et s\'effondre quand un brouilleur couvre le canal.' },
  ],
};

/** les exercices d'une leçon (champ exercises de la leçon, puis BY_LESSON) */
export function exercisesOf(lesson) { return [...(lesson.exercises || []), ...(BY_LESSON[lesson.id] || [])]; }
/** fiche d'un exercice : titre, résumé, durée, niveau, cible du bouton « Commencer » */
/** @returns {ExerciseInfo | null} */
export function exerciseInfo(id) {
  if (SPECIAL[id]) return { id, ...SPECIAL[id], special: true };
  const l = tutorLesson(id); if (!l) return null;
  return { id, title: l.title, summary: l.summary, duration: l.duration, level: l.level, go: { lesson: id, label: l.title } };
}
/** exercice fait : parcours guidé terminé, ou exercice noté réussi */
export const exerciseDone = (id) => (SPECIAL[id] ? specialState(id).done : !!progressOf(id).done);
/** tous les exercices rangés dans le Cours, dans l'ordre des leçons */
export const allExercises = () => allLessons().flatMap(({ chapter, lesson }) => exercisesOf(lesson).map((x) => ({ chapter, lesson, ...x })));
