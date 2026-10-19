// @ts-check
import { S } from '../../state.js';
import { ui } from './kit.js';

// ----------------------------------------------------------------------------------
// Parcours « Matériel » : la visionneuse d'appareils, connecteur par connecteur. Chaque étape
// ouvre l'appareil sur la bonne face et demande de cliquer un connecteur ; sa fiche (norme,
// type de prise, rôle dans le car) s'affiche à droite.
// ----------------------------------------------------------------------------------
const D = 'Matériel';
// ouvrir un appareil (sur une face donnée)
function device(id, key, view, say, ok) {
  return {
    id, title: say.title, say: say.text,
    do: say.do,
    go: { device: key, view },
    done: (c) => c.view().device === key && (!view || c.view().devView === view),
    skip: (c) => c.view().device === key && (!view || c.view().devView === view),
    ok,
    auto: (c) => ui(c, 'device', key, 1, view ? { view } : {}),
  };
}
// cliquer un connecteur de l'appareil ouvert (il faut le cliquer pendant l'étape)
function port(id, key, port, title, say, label, ok, view) {
  const k = key + ':' + port;
  return {
    id, title, say,
    enter: () => { if (S.seenPort) delete S.seenPort[k]; },
    do: `Clique le connecteur ${label}.`,
    go: { device: key, view }, show: [{ sel: `#modal .eq-svg g[data-id="${port}"]`, label }],
    done: () => !!(S.seenPort && S.seenPort[k]),
    ok,
    auto: (c) => { ui(c, 'device', key, 1, { focus: port, ...(view ? { view } : {}) }); (S.seenPort ||= {})[k] = true; },
  };
}
const close = {
  id: 'close', title: 'Refermer',
  say: 'On referme la visionneuse.',
  do: 'Ferme la visionneuse (× ou Échap).',
  done: (c) => !c.view().modal,
  ok: 'Fermé. La touche K rouvre le matériel à tout moment.',
  auto: (c) => ui(c, 'closeModal'),
};

// ---------------- caméra et CCU ----------------
/** @type {import('../engine.js').Lesson} */
const CAMERA = {
  id: 'materiel-camera', domain: D, stations: ['ccu', 'vision'],
  title: 'La caméra système et sa CCU',
  summary: 'Le câble hybride SMPTE, l\'intercom du cadreur, puis l\'arrière de la CCU : fibre, référence et sortie vers la grille.',
  duration: '6 min', level: 'découverte',
  outro: 'Une caméra système, c\'est une tête légère sur le terrain et sa CCU dans le car, reliées par un seul câble : tout passe par lui, dans les deux sens.',
  steps: [
    {
      id: 'intro', title: 'La visionneuse',
      say: 'La **visionneuse de matériel** montre les faces des appareils du car. Chaque connecteur est cliquable : sa fiche donne le type de prise, la norme et son rôle. On commence par la caméra.',
    },
    device('cam', 'cam', 'arriere', { title: 'La tête de caméra', text: 'L\'arrière de la tête de caméra : c\'est là qu\'arrivent le câble vers le car, les casques, les sorties vidéo locales.', do: 'Ouvre la caméra dans la visionneuse (face arrière).' }, 'Voilà l\'arrière de la tête.'),
    port('fibre', 'cam', 'ccu', 'Le câble hybride', 'Le connecteur le plus important : la **fibre hybride SMPTE** (ST 311), avec deux fibres monomodes et des conducteurs en cuivre.', 'CCU (fibre hybride)', 'Un seul câble transporte l\'image vers le car, le retour programme, l\'intercom, le tally, les commandes du RCP, et l\'alimentation de la caméra par le cuivre.', 'arriere'),
    port('icom', 'cam', 'icom1', 'L\'intercom du cadreur', 'Le casque du cadreur se branche ici : il entend le réalisateur et lui répond.', 'INTERCOM 1', 'La voix du cadreur passe par la même fibre jusqu\'à la CCU, puis par la matrice d\'intercom du car.', 'arriere'),
    device('ccu', 'ccu', 'arriere', { title: 'La CCU', text: 'Dans le car, chaque caméra a sa **CCU** (Camera Control Unit). On regarde sa face arrière.', do: 'Ouvre la CCU, face arrière.' }, 'L\'arrière de la CCU : la fibre de la caméra, la référence, les sorties vidéo.'),
    port('camera', 'ccu', 'camera', 'L\'arrivée de la fibre', 'La fibre venant du pied de car arrive ici.', 'CAMERA', 'C\'est la CCU qui alimente la caméra à travers ce câble, sur des centaines de mètres.', 'arriere'),
    port('ref', 'ccu', 'refin', 'La référence', 'La CCU reçoit la référence de synchro du générateur, par un distributeur.', 'REFERENCE IN', 'Sans elle, la caméra n\'est pas en phase avec les autres : son image sauterait à la commutation.', 'arriere'),
    port('sdi', 'ccu', 'sdi1', 'La sortie vers la grille', 'L\'image traitée (exposition, couleur réglées au RCP) sort en SDI vers la grille.', 'SDI 1', 'De la grille, elle part vers le mélangeur, le multiview et les enregistrements de l\'EVS.', 'arriere'),
    {
      id: 'quiz', title: 'Question',
      say: 'Une question pour retenir.',
      quiz: { q: 'Que transporte le câble hybride SMPTE entre la caméra et sa CCU ?', choices: ['L\'image, le retour programme, l\'intercom, le tally, les commandes du RCP et l\'alimentation de la caméra', 'Uniquement l\'image', 'L\'image et le son, mais pas l\'alimentation'], answer: 0, why: 'Les fibres portent les signaux dans les deux sens ; les conducteurs en cuivre portent l\'alimentation envoyée par la CCU.' },
    },
    close,
  ],
};

// ---------------- synchro ----------------
/** @type {import('../engine.js').Lesson} */
const SPG = {
  id: 'materiel-synchro', domain: D, stations: ['synchro'],
  title: 'Le générateur de synchro et le distributeur',
  summary: 'Le SPG : son GPS, ses sorties tri-level et black burst, le timecode ; puis le distributeur qui alimente chaque appareil.',
  duration: '5 min', level: 'intermédiaire',
  outro: 'Le SPG est le cœur du car : une référence (pour que les images soient en phase) et un timecode (pour les dater), tous deux calés sur le temps GPS.',
  steps: [
    {
      id: 'intro', title: 'Le SPG',
      say: 'Le **générateur de synchro** (SPG) fabrique les signaux de référence et le timecode de tout le car.',
    },
    device('spg', 'spg', 'arriere', { title: 'Le SPG', text: 'Ouvrons sa face arrière.', do: 'Ouvre le générateur de synchro (face arrière).' }, 'Une rangée de BNC : chaque sortie part vers un groupe d\'appareils.'),
    port('gps', 'spg', 'gps', 'Le GPS', 'Une antenne GPS sur le toit donne l\'heure exacte au générateur.', 'GPS', 'Tous les cars et la chaîne sont ainsi à la même heure, à la microseconde près.', 'arriere'),
    port('tls', 'spg', 'tls1', 'Le tri-level', 'La référence des équipements HD.', 'TRI-LEVEL 1', 'Une impulsion à trois niveaux par ligne : le top de synchro des appareils HD.', 'arriere'),
    port('ltc', 'spg', 'ltc1', 'Le timecode', 'Le timecode heure du jour (LTC) part vers les enregistreurs et les serveurs.', 'LTC 1', 'Il date les images ; il ne les synchronise pas.', 'arriere'),
    device('da', 'da', 'arriere', { title: 'Le distributeur', text: 'Une sortie du SPG ne suffit pas pour vingt appareils : un **distributeur** (DA) la recopie.', do: 'Ouvre le distributeur de référence.' }, 'Une entrée, huit sorties identiques.'),
    port('dain', 'da', 'in', 'L\'entrée', 'L\'entrée reçoit la référence du SPG.', 'IN', 'Chaque sortie en est une copie, isolée des autres : un court-circuit sur une sortie ne perturbe pas les autres appareils.', 'arriere'),
    {
      id: 'quiz', title: 'Question',
      say: 'Pour finir.',
      quiz: { q: 'À quoi sert le timecode (LTC) ?', choices: ['À dater les images, pour retrouver un instant sur tous les enregistrements', 'À mettre les images des caméras en phase', 'À transporter le son'], answer: 0, why: 'La mise en phase, c\'est la référence (tri-level, black burst). Le timecode est une horloge commune pour retrouver un instant.' },
    },
    close,
  ],
};

// ---------------- serveur ralenti ----------------
/** @type {import('../engine.js').Lesson} */
const EVS_HW = {
  id: 'materiel-evs', domain: D, stations: ['evs', 'ipdirector'],
  title: 'Le serveur ralenti EVS XT',
  summary: 'L\'arrière du serveur : entrées et sorties SDI configurables, référence, timecode, réseau XNet.',
  duration: '5 min', level: 'intermédiaire',
  outro: 'Le serveur enregistre toutes ses entrées en continu, sur le même timecode : c\'est ce qui permet de relire n\'importe quel angle au même instant.',
  steps: [
    {
      id: 'intro', title: 'Le serveur',
      say: 'Le **serveur ralenti** enregistre plusieurs caméras en continu et relit sur une ou deux sorties, piloté par la télécommande LSM.',
    },
    device('evs', 'evs', 'arriere', { title: 'L\'arrière du serveur', text: 'Ouvrons l\'arrière du serveur.', do: 'Ouvre le serveur EVS (face arrière).' }, 'Douze connecteurs vidéo, la synchro, le réseau.'),
    port('sdi', 'evs', 'sdi1', 'Les connecteurs vidéo', 'Les BNC vidéo sont affectés par configuration : en entrée (enregistrement) ou en sortie (lecture, multiviewer).', 'SDI 1', 'La configuration dit combien d\'entrées et de sorties : par exemple 8 enregistrements et 2 lectures.', 'arriere'),
    port('ref', 'evs', 'refin', 'La référence', 'Comme tout appareil du car, le serveur est verrouillé sur la référence.', 'REF IN', 'Sinon ses images ne seraient pas en phase avec les caméras au mélangeur.', 'arriere'),
    port('ltc', 'evs', 'ltcin', 'Le timecode', 'Le timecode du SPG entre ici.', 'LTC IN', 'Toutes les entrées enregistrées partagent ce timecode : on retrouve le même instant sur chaque angle.', 'arriere'),
    port('xnet', 'evs', 'xnet', 'Le réseau', 'Le réseau XNet relie les serveurs entre eux.', 'XNet', 'Un opérateur peut relire l\'enregistrement d\'un autre serveur comme s\'il était local.', 'arriere'),
    {
      id: 'quiz', title: 'Question',
      say: 'Pour finir.',
      quiz: { q: 'Pourquoi le serveur reçoit-il le timecode du SPG ?', choices: ['Pour que toutes les caméras enregistrées soient datées de la même façon et qu\'on retrouve le même instant sur chaque angle', 'Pour régler la vitesse des ralentis', 'Pour verrouiller ses images en phase'], answer: 0, why: 'Le même timecode sur chaque entrée : choisir un autre angle au même instant devient immédiat.' },
    },
    close,
  ],
};

// ---------------- grille et mélangeur ----------------
/** @type {import('../engine.js').Lesson} */
const ROUTER_HW = {
  id: 'materiel-grille', domain: D, stations: ['grille', 'melangeur'],
  title: 'La grille et le mélangeur',
  summary: 'L\'arrière de la grille (entrées, sorties, référence) et du processeur du mélangeur.',
  duration: '5 min', level: 'découverte',
  outro: 'La grille distribue, le mélangeur fabrique le programme : ce sont deux appareils distincts, reliés par des dizaines de câbles.',
  steps: [
    {
      id: 'intro', title: 'Deux appareils',
      say: 'La **grille** relie les sources aux destinations ; le **mélangeur** (son processeur, dans une baie) fabrique le programme à partir de ses entrées. Le pupitre du truquiste n\'est qu\'une télécommande.',
    },
    device('router', 'router', 'arriere', { title: 'La grille', text: 'L\'arrière de la grille : des rangées d\'entrées et de sorties vidéo.', do: 'Ouvre la grille.' }, 'Chaque BNC est une entrée ou une sortie.'),
    port('in', 'router', 'in1', 'Une entrée', 'Les entrées reçoivent les sources : CCU, serveurs, habillage…', 'IN 1', 'Chaque entrée peut être envoyée sur n\'importe quelle sortie.', 'arriere'),
    port('ref', 'router', 'ref', 'La référence', 'La grille aussi reçoit la référence.', 'REF IN', 'Elle commute pendant l\'intervalle de suppression, entre deux images : il lui faut savoir quand il arrive.', 'arriere'),
    device('mixer', 'mixer', 'arriere', { title: 'Le mélangeur', text: 'Le processeur du mélangeur, en baie.', do: 'Ouvre le processeur du mélangeur.' }, 'Ses entrées viennent des sorties de la grille.'),
    port('mixin', 'mixer', 'in1', 'Une entrée du mélangeur', 'Chaque entrée du mélangeur correspond à un bouton des rangées PGM et PST.', 'IN 1', 'La grille choisit ce qui arrive sur chaque entrée : c\'est ainsi qu\'on change une source du mélangeur sans recâbler.', 'arriere'),
    {
      id: 'quiz', title: 'Question',
      say: 'Pour finir.',
      quiz: { q: 'Pourquoi la grille a-t-elle besoin de la référence de synchro ?', choices: ['Pour commuter entre deux images, dans l\'intervalle de suppression, sans abîmer l\'image', 'Pour amplifier les signaux', 'Pour afficher le timecode'], answer: 0, why: 'Commuter au milieu d\'une image ferait un saut visible. Verrouillée, la grille commute au bon moment.' },
    },
    close,
  ],
};

// ---------------- pied de car ----------------
/** @type {import('../engine.js').Lesson} */
const PDC = {
  id: 'materiel-pied-de-car', domain: D, stations: [],
  title: 'Le pied de car : raccorder le car au stade',
  summary: 'Le panneau extérieur du car : la terre et l\'énergie, les embases caméras, le départ fibre vers l\'opérateur.',
  duration: '4 min', level: 'découverte',
  outro: 'Le pied de car est le premier et le dernier geste d\'une installation : la terre en premier, l\'énergie ensuite, puis les caméras et la transmission.',
  steps: [
    {
      id: 'intro', title: 'Le pied de car',
      say: 'À l\'arrière du car, le **pied de car** est le panneau où arrivent tous les câbles venant du stade : énergie, caméras, intercom, transmission, GPS.',
    },
    device('pdc', 'pdc', 'arriere', { title: 'Le panneau', text: 'Ouvrons le panneau extérieur.', do: 'Ouvre le pied de car.' }, 'Chaque embase est repérée : on ne se trompe pas de prise sous la pluie.'),
    port('earth', 'pdc', 'earth', 'La terre', 'La sécurité d\'abord.', 'TERRE', 'La liaison à la terre se raccorde toujours avant l\'énergie, et se débranche en dernier.', 'arriere'),
    port('power', 'pdc', 'power', 'L\'énergie', 'Le car est alimenté en triphasé.', 'ÉNERGIE', 'Par le réseau du stade ou par un groupe électrogène, souvent les deux, avec un onduleur pour les coupures.', 'arriere'),
    port('smpte', 'pdc', 'smpte1', 'Une embase caméra', 'Chaque caméra a son embase fibre hybride.', 'SMPTE 1', 'Le câble tiré depuis la position caméra s\'y raccorde ; derrière, il rejoint la CCU 1.', 'arriere'),
    port('tx', 'pdc', 'txfib', 'Le départ transmission', 'Le programme quitte le car par ici.', 'FIBRE TX', 'C\'est la fibre de l\'opérateur de transmission, vers la chaîne.', 'arriere'),
    {
      id: 'quiz', title: 'Question',
      say: 'Une question de sécurité.',
      quiz: { q: 'Dans quel ordre raccorde-t-on le car ?', choices: ['La terre d\'abord, puis l\'énergie', 'L\'énergie d\'abord, puis la terre', 'Peu importe, si le disjoncteur est ouvert'], answer: 0, why: 'La terre protège les personnes : elle doit être en place avant que la moindre tension n\'arrive dans le car.' },
    },
    close,
  ],
};

export const MATERIEL_LESSONS = [CAMERA, SPG, EVS_HW, ROUTER_HW, PDC];
