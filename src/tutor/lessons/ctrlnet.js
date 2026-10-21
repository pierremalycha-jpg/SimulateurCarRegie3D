// @ts-check
// Parcours du chef de car : le réseau de contrôle du car SDI.
import { emit } from '../../state.js';
import { randPick } from '../../util.js';
import { FAULTS, injectFault } from '../../faults.js';
import * as N from '../../net/ctrlnet.js';
import { goStation, ui } from './kit.js';

// ----------------------------------------------------------------------------------
// Trois parcours au poste Réseau quand le car est en SDI : les bases (adresse, masque,
// passerelle, VLAN, trunk, QoS, vérifiées au ping), mettre une machine sur le réseau (le PC
// d'habillage remplacé, sorti d'usine) et dépanner une machine injoignable (une panne tirée au
// sort : conflit d'adresse, mauvais VLAN, mauvais masque, câble). Les vérifications lisent le
// modèle (net/ctrlnet.js) et le journal des actions (pings, balayage, fiches ouvertes) : les
// parcours se rejouent sans navigateur.
// ----------------------------------------------------------------------------------
N.addCtrlFaults(FAULTS);
const D = 'Exploitation et dépannage';
const V = N.CN.view;
const tab = (k, label) => ({ sel: `#station .cn-tabs .tab[data-k="${k}"]`, label: 'onglet ' + label });
const inTab = (k) => V.tab === k;
const pinged = (c, a, b) => c.seen('ctrlnet', (e) => e.ev === 'ping' && e.ok && ((e.a === a && e.b === b) || (e.a === b && e.b === a)));
const machineTargets = (id, label) => [{ sel: `#station .cn-chip[data-dev="${id}"]`, label }, { sel: `#station .cn-mrow[data-dev="${id}"] .cn-link`, label }, tab('machines', 'Machines')];
const pingTargets = () => [{ sel: '#station .cn-ping [data-f="src"]', label: 'machine qui envoie' }, tab('outils', 'Outils')];
// ouvrir une fiche « ? » : un clic sur le bouton dans la page, ou (sans navigateur) l'événement qu'il produit
function openTermFor(c, sel, id) { if (!ui(c, 'click', sel)) emit('netlog', { type: 'term', id }); }

// ---------------- les bases ----------------
/** @type {import('../engine.js').Lesson} */
const BASES = {
  id: 'ctrlnet-bases', domain: D, stations: ['reseau'], needs: { sdi: true },
  title: 'Les bases du réseau du car',
  summary: 'Adresse IP, masque, passerelle, VLAN, trunk et QoS, sur le vrai réseau de contrôle du car SDI, vérifiés au ping.',
  duration: '12 min', level: 'découverte',
  outro: 'Tu as les bases : une **adresse** et un **masque** disent qui est « chez soi », la **passerelle** fait sortir du sous-réseau, les **VLAN** séparent les usages, le **trunk** les transporte entre switchs et la **QoS** décide qui passe d\'abord. L\'onglet Formation garde tout ça sous la main.',
  after: () => { if (N.CN.copy) N.setCopy(false, { quiet: true }); },
  steps: [
    {
      id: 'intro', title: 'Un réseau dans un car SDI',
      say: 'Dans ce car, les images passent en **SDI** : chacune sur son câble coaxial, à travers la grille. Mais tout ce qui se **pilote** passe par un réseau informatique ordinaire, en Ethernet à 1 Gb/s (Gigabit) :\n- les **RCP** règlent les caméras à travers leur **CCU** ;\n- le pupitre du mélangeur commande son processeur ;\n- IPDirector parle aux serveurs EVS, le tally et les noms arrivent au multiview, l\'intercom passe aussi par là.\n\nSi ce réseau tombe, les images restent… mais plus personne ne peut rien régler.',
    },
    goStation('reseau', 'Ça se passe au poste **Réseau**, dans la zone technique : c\'est notre console de supervision.', 'En haut, le bandeau d\'état : switchs, machines, fonctions du car, liens montants. Dessous, six onglets.'),
    {
      id: 'topo', title: 'La topologie',
      say: 'Trois **switchs** (le boîtier qui relie les machines d\'un même réseau) : le **SW-CŒUR** en zone technique, le **SW-PROD** sous les pupitres de production et le **SW-VISION** sous ceux de la vision. Chaque pastille est une machine : sa couleur dit son **VLAN** (un réseau séparé à l\'intérieur des switchs), son voyant dit si elle va bien.',
      do: 'Onglet Topologie : clique la pastille du RCP 1 pour ouvrir sa fiche.',
      go: { station: 'reseau' }, show: () => machineTargets('rcp1', 'RCP 1'),
      done: () => inTab('machines') && V.dev === 'rcp1',
      ok: 'Voilà la fiche du RCP 1 : son adresse IP, son masque, sa passerelle, le VLAN de son port et sa classe de QoS. Chaque champ a son explication en dessous.',
      hints: ['Les RCP sont branchés sur le switch de la régie vision : cherche sa carte dans la topologie.', 'Carte SW-VISION, pastille « RCP 1 » (port 1). Ou l\'onglet Machines, ligne RCP 1.'],
      auto: () => N.ctrlGo({ tab: 'machines', dev: 'rcp1' }),
    },
    {
      id: 'adresse', title: 'Adresse et masque',
      say: 'L\'**adresse IP** du RCP 1, c\'est 10.1.20.31 : son adresse sur le réseau. Dans ce car, elle se lit facilement : **10.1**, le car ; **20**, le VLAN des caméras ; **31**, la machine.\n\nLe **masque** 255.255.255.0 (on dit aussi **/24**) dit que les trois premiers nombres désignent le réseau : toutes les machines en 10.1.20.quelque chose sont « chez lui », et il leur parle directement.',
      do: 'Ouvre la fiche « ? » du masque, dans la fiche du RCP 1.',
      go: { station: 'reseau' }, show: () => [{ sel: '#station .cn-field[data-field="mask"] .q', label: '?' }, ...machineTargets('rcp1', 'RCP 1')],
      done: (c) => c.seen('term', (e) => e.id === 'sous-reseau'),
      ok: 'Le schéma montre les bits : les 1 du masque recouvrent la partie « réseau » de l\'adresse. Tu peux refermer la fiche avec Échap.',
      hints: ['Chaque intitulé technique a un petit bouton rond « ? » juste à côté.', 'Dans la fiche du RCP 1, à côté de « Masque de sous-réseau ».'],
      auto: (c) => { N.ctrlGo({ tab: 'machines', dev: 'rcp1' }); openTermFor(c, '#station .cn-field[data-field="mask"] .q', 'sous-reseau'); },
    },
    {
      id: 'quiz-masque', title: 'Question',
      say: 'Vérifions.',
      quiz: { q: 'Le RCP 3 est en 10.1.20.33 avec le masque 255.255.255.0. Quelle machine est « chez lui », dans son sous-réseau ?', choices: ['10.1.30.33, qui finit pareil', '10.1.20.13, la CCU 3', '10.1.2.33'], answer: 1, why: 'Avec /24, ce sont les trois premiers nombres qui comptent : 10.1.20. La CCU 3 (10.1.20.13) est chez lui, il lui parle directement. 10.1.30.33 finit pareil mais elle est dans un autre réseau (le VLAN 30) : il faudrait passer par la passerelle. L\'erreur fréquente est de lire la fin de l\'adresse au lieu du début.' },
    },
    {
      id: 'ping-local', title: 'Un ping dans le même VLAN',
      say: 'Le **ping** est le test de base : une machine envoie une demande d\'écho, l\'autre répond. S\'il y a une réponse, le chemin marche dans les deux sens.',
      do: 'Onglet Outils : un ping du RCP 1 vers la CCU 1.',
      go: { station: 'reseau' }, show: pingTargets,
      done: (c) => pinged(c, 'rcp1', 'ccu1'),
      ok: 'Réponse en moins d\'une milliseconde. Le RCP 1 et la CCU 1 sont dans le même VLAN et le même sous-réseau : le RCP demande « qui a 10.1.20.11 ? » (c\'est **ARP**), la CCU répond avec son adresse **MAC** (le numéro de sa carte réseau), et les trames passent du SW-VISION au SW-CŒUR sans routeur.',
      hints: ['Le ping est dans l\'onglet Outils : on choisit qui envoie et qui reçoit.', '« Depuis » : RCP 1 ; « Vers » : CCU 1 ; puis « Lancer le ping ».'],
      auto: () => { N.ctrlGo({ tab: 'outils', src: 'rcp1', dst: 'ccu1' }); N.doPing('rcp1', 'ccu1'); },
    },
    {
      id: 'ping-route', title: 'Un ping par la passerelle',
      say: 'Le **PC de supervision** du chef de car est en 10.1.10.50, dans le VLAN 10 (gestion). La CCU 1 n\'est pas « chez lui » : il confie donc le paquet à sa **passerelle**, 10.1.10.1, l\'adresse du SW-CŒUR dans le VLAN 10. Le SW-CŒUR est un switch **de niveau 3** : il sait aussi **router**, c\'est-à-dire faire passer un paquet d\'un réseau à un autre.',
      do: 'Un ping du PC de supervision vers la CCU 1.',
      go: { station: 'reseau' }, show: pingTargets,
      done: (c) => pinged(c, 'supv', 'ccu1'),
      ok: 'Ça répond aussi, mais regarde le chemin : PC de supervision → SW-PROD → SW-CŒUR (routage) → VLAN 20 → CCU 1. Et la réponse revient par la passerelle de la CCU, 10.1.20.1. Les deux passerelles doivent être justes.',
      hints: ['Même outil, autre source.', '« Depuis » : PC de supervision ; « Vers » : CCU 1.'],
      auto: () => { N.ctrlGo({ tab: 'outils', src: 'supv', dst: 'ccu1' }); N.doPing('supv', 'ccu1'); },
    },
    {
      id: 'quiz-trunk', title: 'Question',
      say: 'Le RCP 1 est branché sur le SW-VISION, la CCU 1 sur le SW-CŒUR. Entre les deux switchs, un seul câble, le **lien montant**, transporte tous les VLAN : c\'est un port **trunk**. Chaque trame y porte une petite étiquette **802.1Q** avec son numéro de VLAN.',
      quiz: { q: 'Comment la trame du RCP 1 (VLAN 20) arrive-t-elle à la CCU 1, sur l\'autre switch ?', choices: ['Par la passerelle 10.1.20.1, qui la route', 'Elle ne passe pas : il faut un routeur entre deux switchs', 'Par le lien montant en trunk, étiquetée « VLAN 20 »'], answer: 2, why: 'Même VLAN, même sous-réseau : pas besoin de routeur. Le trunk transporte la trame avec son étiquette 802.1Q, le SW-CŒUR la remet dans le VLAN 20. La passerelle ne sert que pour sortir du sous-réseau ; et deux switchs se relient très bien sans routeur, c\'est l\'erreur fréquente.' },
    },
    {
      id: 'qos', title: 'La QoS',
      say: 'Un lien Gigabit, c\'est beaucoup… jusqu\'à ce qu\'une grosse **copie de fichiers** le remplisse. La **QoS** (qualité de service) donne alors une priorité à chaque paquet : la **CoS** dans l\'étiquette VLAN, le **DSCP** dans l\'en-tête IP. Dans ce car : l\'intercom d\'abord (CoS 5, DSCP 46), les commandes ensuite, les fichiers en dernier.',
      do: 'Onglet Outils, en bas : lance une copie de fichiers et regarde la charge des liens montants.',
      go: { station: 'reseau' }, show: [{ sel: '#station .cn-copy', label: 'copie de fichiers' }, tab('outils', 'Outils')],
      done: () => N.CN.copy,
      ok: 'Le lien montant du SW-PROD est plein : la copie prend tout ce qu\'on lui laisse. Mais l\'intercom et les commandes passent devant, sans perte : la QoS du SW-CŒUR fait son travail. Si tu la désactives (onglet Switchs), l\'intercom se met à hacher.',
      hints: ['C\'est dans l\'onglet Outils, panneau « Charge des liens montants ».', 'Bouton « Lancer une copie de fichiers (NAS → habillage) ».'],
      auto: () => { N.ctrlGo({ tab: 'outils' }); N.setCopy(true); },
    },
    {
      id: 'quiz-qos', title: 'Question',
      say: 'Dernière question.',
      quiz: { q: 'Pendant la copie, le lien montant du SW-PROD est saturé. Avec la QoS du car, qu\'est-ce qui passe en premier ?', choices: ['La copie de fichiers, parce qu\'elle a commencé avant', 'L\'intercom (voix : CoS 5, DSCP 46), puis les commandes', 'Tout le monde à égalité : le switch partage le débit'], answer: 1, why: 'Avec la QoS, le switch range les paquets dans des files et sert d\'abord la plus prioritaire : la voix, puis la commande, la gestion, les données, et enfin les fichiers, qui ralentissent sans dommage. Le partage à égalité, c\'est ce qui se passe SANS QoS : une seule file, et l\'intercom perd des paquets comme tout le monde.' },
    },
  ],
};

// ---------------- mettre une machine sur le réseau ----------------
const gfx = () => N.CN.m.gfxpc;
const gfxPort = () => { const at = N.attachPort('gfxpc'); return at ? N.portOf(at.sw, at.n) : null; };
/** @type {import('../engine.js').Lesson} */
const MACHINE = {
  id: 'ctrlnet-machine', domain: D, stations: ['reseau'], needs: { sdi: true },
  title: 'Mettre une machine sur le réseau',
  summary: 'Le PC d\'habillage est remplacé : le ranger dans son VLAN, lui donner son adresse fixe, son masque, sa passerelle et sa classe de QoS, puis vérifier au ping.',
  duration: '10 min', level: 'débutant',
  outro: 'La mise en service, dans l\'ordre : le **VLAN** du port, l\'**adresse**, le **masque**, la **passerelle**, la **classe de QoS**, puis deux pings : un dans le VLAN, un depuis un autre VLAN. Et on note tout au plan d\'adressage.',
  cleanupLabel: 'Remettre le PC d\'habillage comme au plan',
  cleanup: () => N.resetDevice('gfxpc', true),
  steps: [
    {
      id: 'intro', title: 'Un PC neuf',
      enter: () => {
        // le PC d'habillage a été remplacé : branché sur un port libre du SW-PROD (VLAN 1 par défaut), réglages d'usine
        N.resetDevice('gfxpc', true);
        N.moveDevice('gfxpc', 'prod', 8, { quiet: true });
        N.setDevice('gfxpc', { dhcp: true, ip: '192.168.1.100', prefix: 24, gw: '192.168.1.1', qos: 'donnees' }, { quiet: true });
      },
      say: 'Le PC d\'habillage est tombé en panne ; le technicien a installé le PC de secours et l\'a branché sur un **port libre**, le port 8 du SW-PROD. Il sort d\'usine : il attend une adresse automatique (**DHCP**), et le port 8 est resté dans le **VLAN 1**, le VLAN par défaut, où il n\'y a personne. Résultat : l\'habillage n\'accède plus au NAS (le stockage où sont ses modèles et ses logos).',
    },
    goStation('reseau', 'On va au poste **Réseau** pour le mettre en service.', 'Regarde le bandeau : une fonction du car est touchée, « PC d\'habillage → NAS ».'),
    {
      id: 'fiche', title: 'Sa fiche',
      say: 'Chaque machine a sa **fiche** : réglages, explication de chaque champ, diagnostic et tests.',
      do: 'Ouvre la fiche du PC d\'habillage.',
      go: { station: 'reseau' }, show: () => machineTargets('gfxpc', 'PC d\'habillage'),
      done: () => inTab('machines') && V.dev === 'gfxpc',
      ok: (c) => `Le diagnostic est clair : « ${N.devState('gfxpc').issues[0] ? N.devState('gfxpc').issues[0].text : 'en DHCP, sans serveur'} » Une adresse en 169.254 veut dire : personne ne lui a répondu.`,
      hints: ['Onglet Machines, ou la pastille dans la carte du SW-PROD.', 'Ligne « PC d\'habillage » du tableau (elle est en rouge).'],
      auto: () => N.ctrlGo({ tab: 'machines', dev: 'gfxpc' }),
    },
    {
      id: 'plan', title: 'Le plan d\'adressage',
      say: 'Avant de toucher à quoi que ce soit, on lit le **plan d\'adressage** : c\'est lui qui dit où va chaque machine. Onglet « Plan d\'adressage » si tu veux le relire.',
      quiz: { q: 'D\'après le plan, où ranger le PC d\'habillage ?', choices: ['VLAN 30, avec le mélangeur : 10.1.30.10, passerelle 10.1.30.1', 'VLAN 60 (fichiers et habillage) : 10.1.60.10, masque 255.255.255.0, passerelle 10.1.60.1', 'VLAN 60 : 10.1.60.10, masque 255.255.255.0, passerelle 10.1.30.1'], answer: 1, why: 'Le PC d\'habillage travaille avec le NAS : il va dans le VLAN 60, avec la .1 de ce VLAN comme passerelle. Le VLAN 30 est celui du mélangeur : c\'est là que l\'habillage est utilisé, pas son réseau. Et une passerelle doit être dans le sous-réseau de la machine : 10.1.30.1 est hors de 10.1.60.0/24, elle ne saurait pas la joindre.' },
    },
    {
      id: 'vlan', title: 'Le VLAN du port',
      say: 'Le VLAN ne se règle pas dans la machine : c\'est celui du **port du switch** où elle est branchée. Un port où l\'on branche une machine est un port **access** : il appartient à un seul VLAN.',
      do: 'Range son port dans le VLAN 60 : champ « VLAN (port du switch) » de sa fiche, puis Appliquer (ou onglet Switchs, SW-PROD, port 8).',
      go: { station: 'reseau' }, show: [{ sel: '#station .cn-form [data-f="vlan"]', label: 'VLAN 60' }, ...machineTargets('gfxpc', 'PC d\'habillage')],
      done: () => !!gfxPort() && gfxPort().vlan === 60,
      ok: 'Le port 8 du SW-PROD est maintenant un port access du VLAN 60 : le PC est dans le même réseau virtuel que le NAS. Mais il n\'a toujours pas d\'adresse : pas de serveur DHCP dans ce VLAN.',
      hints: ['C\'est le switch qui décide du VLAN : le champ VLAN de la fiche modifie le port où la machine est branchée.', 'Fiche du PC d\'habillage, champ « VLAN (port du switch) » : VLAN 60 · Fichiers et habillage, puis « Appliquer ».'],
      auto: () => N.setDeviceVlan('gfxpc', 60),
    },
    {
      id: 'adresse', title: 'Adresse, masque, passerelle',
      say: 'En production, on travaille en **adresse fixe** : le NAS, la supervision et les collègues doivent retrouver le PC d\'habillage toujours au même endroit. Le DHCP est réservé aux invités.',
      do: 'Passe-le en adresse fixe : 10.1.60.10, masque 255.255.255.0, passerelle 10.1.60.1, puis Appliquer.',
      go: { station: 'reseau' }, show: [{ sel: '#station .cn-form [data-f="mode"]', label: 'Adresse fixe' }, { sel: '#station .cn-form [data-f="ip"]', label: '10.1.60.10' }, ...machineTargets('gfxpc', 'PC d\'habillage')],
      done: () => !gfx().dhcp && gfx().ip === '10.1.60.10' && gfx().prefix === 24 && gfx().gw === '10.1.60.1',
      ok: 'Adresse 10.1.60.10/24, passerelle 10.1.60.1 : le message sous chaque champ passe au vert. Le PC est dans le sous-réseau 10.1.60.0/24, celui du VLAN 60.',
      hints: ['D\'abord le mode d\'adressage, puis les trois champs. Les messages sous chaque champ te disent si c\'est cohérent avec le plan.', 'Mode « Adresse fixe » ; adresse 10.1.60.10 ; masque 255.255.255.0 (ou /24) ; passerelle 10.1.60.1 ; bouton « Appliquer ».'],
      auto: () => N.setDevice('gfxpc', { dhcp: false, ip: '10.1.60.10', prefix: 24, gw: '10.1.60.1' }),
    },
    {
      id: 'qos', title: 'La classe de QoS',
      say: 'Reste la **classe de QoS** : la priorité de ses paquets quand un lien est plein. Le PC d\'habillage échange surtout des fichiers avec le NAS : ça peut attendre derrière l\'intercom et les commandes.',
      do: 'Classe QoS : « Fichiers et Internet », puis Appliquer.',
      go: { station: 'reseau' }, show: [{ sel: '#station .cn-form [data-f="qos"]', label: 'Fichiers et Internet' }, ...machineTargets('gfxpc', 'PC d\'habillage')],
      done: () => gfx().qos === 'fichiers',
      ok: 'Classe « fichiers » : CoS 1, DSCP 8. Ses grosses copies ne passeront jamais devant l\'intercom.',
      hints: ['Le plan d\'adressage donne une classe par VLAN.', 'Champ « Classe QoS » : « Fichiers et Internet · CoS 1 · DSCP 8 », puis « Appliquer ».'],
      auto: () => N.setDevice('gfxpc', { qos: 'fichiers' }),
    },
    {
      id: 'ping-nas', title: 'Vérifier : le NAS',
      say: 'On ne déclare jamais une machine en service sans **vérifier**. D\'abord dans son VLAN.',
      do: 'Un ping du PC d\'habillage vers le NAS (bouton « Ping vers NAS » de sa fiche, ou onglet Outils).',
      go: { station: 'reseau' }, show: () => [{ sel: '#station .cn-fping[data-dst="nas"]', label: 'Ping vers le NAS' }, ...pingTargets()],
      done: (c) => pinged(c, 'gfxpc', 'nas'),
      ok: 'Le NAS répond : même VLAN, même sous-réseau, la liaison marche. L\'habillage retrouve ses fichiers.',
      hints: ['La fiche a des boutons de test en bas.', 'Fiche du PC d\'habillage, section « Tester » : « Ping vers NAS ».'],
      auto: () => N.doPing('gfxpc', 'nas'),
    },
    {
      id: 'ping-supv', title: 'Vérifier : la supervision',
      say: 'Puis depuis un **autre VLAN** : c\'est ce test qui vérifie la passerelle.',
      do: 'Un ping depuis le PC de supervision vers le PC d\'habillage.',
      go: { station: 'reseau' }, show: () => [{ sel: '#station .cn-fping[data-dst="supv"]', label: 'Ping depuis la supervision' }, ...pingTargets()],
      done: (c) => pinged(c, 'supv', 'gfxpc'),
      ok: 'Ça répond : le paquet part du VLAN 10, passe par le routage du SW-CŒUR, et la réponse revient par la passerelle 10.1.60.1. La machine est en service et supervisée.',
      hints: ['Le PC de supervision est dans le VLAN 10 : il passe forcément par les passerelles.', 'Fiche du PC d\'habillage : « Ping depuis la supervision ». Ou Outils : depuis « PC de supervision » vers « PC d\'habillage ».'],
      auto: () => N.doPing('supv', 'gfxpc'),
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Pour finir.',
      quiz: { q: 'Sur un autre PC du VLAN 60, quelqu\'un a mis la passerelle 10.1.30.1. Que se passe-t-il ?', choices: ['Plus rien ne marche pour ce PC, même le NAS', 'Rien : la passerelle ne sert qu\'au DHCP', 'Il joint toujours le NAS (même VLAN), mais plus la supervision, l\'heure ni Internet'], answer: 2, why: 'La passerelle ne sert que pour sortir du sous-réseau : le NAS, dans le même VLAN, répond toujours. Mais tout ce qui est ailleurs (supervision, serveur d\'heure, Internet) devient injoignable, d\'autant que 10.1.30.1 n\'est même pas dans son sous-réseau. Croire que tout s\'arrête est l\'erreur inverse : c\'est justement pour ça qu\'on vérifie aussi depuis un autre VLAN.' },
    },
  ],
};

// ---------------- dépanner une machine injoignable ----------------
const CAUSE = {
  'cn-conflit': (st) => `C'était un **conflit d'adresse IP** : ${N.devById(st.dev).name} avait pris l'adresse de ${N.devById(st.takes).name}. Les deux machines répondaient chacune leur tour : d'où les réponses une fois sur deux. On ne recopie jamais la configuration d'une machine sans changer l'adresse.`,
  'cn-vlan': (st) => `C'était le **VLAN du port** : le port de ${N.devById(st.dev).name} avait été changé de VLAN. La machine était branchée, son voyant allumé, mais isolée dans un autre réseau virtuel : personne n'entendait ses ARP.`,
  'cn-masque': (st) => `C'était le **masque** : ${N.devById(st.dev).name} était en 255.255.255.240 (/28) au lieu de 255.255.255.0. Elle croyait que ses partenaires n'étaient pas « chez elle », et sa passerelle n'était même plus dans son petit sous-réseau.`,
  'cn-cable': (st) => `C'était le **câble** : celui du port ${st.n} du ${N.swById(st.sw).name} était débranché. Voyant éteint, machine absente de la table MAC : la couche 1, à vérifier en premier.`,
};
/** la panne du parcours est réparée */
const fixed = (c) => { const e = c.mem.entry; if (!e) return true; try { return e.done || !!e.f.check(e.st); } catch (x) { return false; } };
/** @type {import('../engine.js').Lesson} */
const DEPANNAGE = {
  id: 'ctrlnet-depannage', domain: D, stations: ['reseau'], needs: { sdi: true },
  title: 'Dépanner une machine injoignable',
  summary: 'Une panne cachée sur le réseau de contrôle (conflit d\'adresse, mauvais VLAN, mauvais masque ou câble) : la trouver avec méthode, la réparer, vérifier.',
  duration: '10 min', level: 'intermédiaire',
  outro: 'La méthode vaut pour toutes les pannes réseau : **constater** (qui se plaint, quelle fonction est perdue), **localiser** (balayage, fiche, diagnostic), **réparer** en remontant les couches (câble, VLAN, adresse et masque, passerelle), puis **vérifier** au ping. Et on prévient celui qui s\'était plaint.',
  cleanupLabel: 'Réparer la panne',
  cleanup: (c) => { const e = c.mem.entry; if (e && !e.done) { e.f.repair(e.st); e.done = true; emit('fault'); } },
  steps: [
    {
      id: 'intro', title: 'Ça ne répond plus',
      enter: (c) => {
        const id = randPick(['cn-cable', 'cn-vlan', 'cn-masque', 'cn-conflit']);
        const e = injectFault(id, true);
        c.mem.entry = e || null; c.mem.dev = e ? e.st.dev : null; c.mem.devs = e ? [e.st.dev, e.st.takes].filter(Boolean) : [];
        const R = N.evaluate(); const f = N.FUNCS.find((x) => !R.funcs[x.key].ok && c.mem.devs.some((d) => d === x.a || d === x.b));
        c.mem.who = f ? f.who : 'LA CHAÎNE'; c.mem.msg = f ? f.lost : 'Quelque chose ne répond plus en régie.';
      },
      say: (c) => `Une panne vient d'arriver sur le réseau de contrôle. ${c.mem.who} appelle à l'intercom : « ${c.mem.msg} »\n\nOn ne touche à rien au hasard. La méthode : **constater**, **localiser**, **réparer**, **vérifier**.`,
    },
    goStation('reseau', 'Direction le poste **Réseau**.', 'Le bandeau le confirme : une fonction du car est en défaut.'),
    {
      id: 'sweep', title: 'Localiser : le balayage',
      say: 'Premier réflexe : qui ne répond plus ? Le **balayage** envoie un ping depuis le PC de supervision à chaque machine du car.',
      do: 'Onglet Outils : lance le balayage depuis le PC de supervision.',
      go: { station: 'reseau' }, show: [{ sel: '#station .cn-sweep', label: 'Lancer le balayage' }, tab('outils', 'Outils')],
      done: (c) => c.seen('ctrlnet', (e) => e.ev === 'sweep'),
      ok: () => { const bad = N.CN.lastSweep ? N.CN.lastSweep.rows.filter((r) => r.state !== 'ok') : []; return bad.length ? `Le balayage désigne ${bad.map((r) => N.devById(r.id).name).join(' et ')} : ${bad[0].state === 'instable' ? 'des réponses une fois sur deux' : 'aucune réponse'}. On regarde de plus près.` : 'Tout répond à la supervision : la panne est entre deux machines d\'un même VLAN. Le bandeau dit lesquelles.'; },
      hints: ['C\'est un outil de l\'onglet Outils.', 'Panneau « Balayage depuis le PC de supervision », bouton « Lancer le balayage ».'],
      auto: () => { N.ctrlGo({ tab: 'outils' }); N.sweep(); },
    },
    {
      id: 'fiche', title: 'Localiser : la fiche',
      say: 'La fiche de la machine en défaut donne son **diagnostic** : ce qui n\'est pas conforme au plan, et les liaisons qui ne répondent plus.',
      do: 'Ouvre la fiche de la machine qui ne répond plus.',
      go: { station: 'reseau' }, show: (c) => machineTargets(c.mem.dev, 'la machine en défaut'),
      done: (c) => inTab('machines') && c.mem.devs.includes(V.dev),
      ok: 'Lis le diagnostic de haut en bas : la première ligne rouge est souvent la cause, les suivantes ses conséquences.',
      hints: ['Le balayage, le bandeau ou le filtre « En défaut » de l\'onglet Machines te donnent son nom.', 'Onglet Machines, filtre « En défaut », puis clique son nom.'],
      auto: (c) => N.ctrlGo({ tab: 'machines', dev: c.mem.dev }),
    },
    {
      id: 'methode', title: 'Par où commencer',
      say: 'Avant de corriger, on se rappelle l\'ordre : du plus simple au plus fin.',
      quiz: { q: 'Une machine ne répond plus. Par quoi commences-tu ?', choices: ['Lui changer son adresse IP', 'Le câble et le voyant de son port, puis le VLAN du port', 'Redémarrer le switch de cœur'], answer: 1, why: 'On remonte les couches : d\'abord le câble et le voyant (couche 1), puis le VLAN du port (couche 2), puis l\'adresse et le masque, enfin la passerelle. Changer l\'adresse au hasard crée souvent un conflit de plus ; redémarrer le cœur couperait tout le car pendant une minute, pour rien.' },
    },
    {
      id: 'reparer', title: 'Réparer',
      say: 'À toi : la fiche et l\'onglet Switchs ont tout ce qu\'il faut.',
      do: 'Trouve la cause et répare.',
      go: { station: 'reseau' }, show: (c) => [{ sel: '#station .cn-issues li.err', label: 'diagnostic' }, ...machineTargets(c.mem.dev, 'la machine en défaut')],
      done: fixed,
      ok: (c) => (c.mem.entry && CAUSE[c.mem.entry.f.id] ? CAUSE[c.mem.entry.f.id](c.mem.entry.st) : 'Réparé.'),
      hints: ['Lis la première ligne rouge du diagnostic : elle nomme le champ ou le port en cause.', 'Câble débranché ou port désactivé : onglet Switchs, « Rebrancher » ou « Activer ». Mauvais VLAN : champ VLAN de la fiche. Mauvais masque ou adresse : « Valeurs du plan », puis « Appliquer ».', 'Pour un conflit, c\'est la machine dont l\'adresse n\'est pas celle du plan qu\'il faut corriger.'],
      auto: (c) => { const e = c.mem.entry; if (e && !e.done) e.f.repair(e.st); },
    },
    {
      id: 'verifier', title: 'Vérifier',
      say: 'Réparé ? On le **prouve**, au ping.',
      do: 'Un ping vers la machine réparée (depuis sa fiche, ou un nouveau balayage).',
      go: { station: 'reseau' }, show: (c) => [{ sel: '#station .cn-fping', label: 'Ping' }, ...machineTargets(c.mem.dev, 'la machine')],
      done: (c) => c.seen('ctrlnet', (e) => (e.ev === 'ping' && e.ok && (c.mem.devs.includes(e.a) || c.mem.devs.includes(e.b))) || (e.ev === 'sweep' && !e.bad.length)),
      ok: (c) => `${N.devById(c.mem.dev).name} répond. Dernier geste : prévenir à l'intercom celui qui s'était plaint (${c.mem.who}).`,
      hints: ['Les boutons de test sont en bas de la fiche.', 'Fiche de la machine : « Ping vers … » ; ou Outils → « Lancer le balayage ».'],
      auto: (c) => { const f = N.funcsOf(c.mem.dev)[0]; if (f) N.doPing(f.a, f.b); else N.doPing('supv', c.mem.dev); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Pour t\'entraîner à reconnaître les pannes.',
      quiz: { q: 'Une machine a son voyant de port allumé et apparaît dans la table MAC du switch, mais ne répond à personne, pas même à l\'ARP. Cause la plus probable ?', choices: ['Le câble est débranché', 'Sa passerelle est fausse', 'Son port est dans le mauvais VLAN'], answer: 2, why: 'Voyant allumé et MAC apprise : le câble va bien (couche 1). Une passerelle fausse ne l\'empêcherait pas de répondre aux machines de son VLAN. Reste le VLAN : la machine parle, mais dans un autre réseau virtuel que ses partenaires, qui n\'entendent pas ses réponses.' },
    },
  ],
};

/** @type {import('../engine.js').Lesson[]} */
export const CTRLNET_LESSONS = [BASES, MACHINE, DEPANNAGE];
