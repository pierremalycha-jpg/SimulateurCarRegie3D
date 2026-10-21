// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » de la grille du car SDI (Videohub 40 × 40 12G) : grille, point de croisement, TAKE,
// verrouillage, étiquette, 12G-SDI, reclocking, commutation au top image, protocole Ethernet. Elles
// s'ajoutent au lexique commun (content/netterms.js) : même format, mêmes boutons « ? » (ui/term.js).
// Sources : documentation Blackmagic Design (Videohub 12G, Videohub Control, Videohub Ethernet
// Protocol : TCP 9990, ports numérotés à partir de 0, verrous U / O / L), normes SMPTE ST 2082-1,
// ST 424, ST 292-1 et RP 168.
// ----------------------------------------------------------------------------------
import { CATS, TERMS, TERM_PATTERNS } from './netterms.js';

const CAT = 'Grille SDI';
if (!CATS.includes(CAT)) CATS.push(CAT);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  grille: {
    t: 'Grille (matrice de commutation)', aka: 'router, routeur vidéo', cat: CAT,
    short: 'L\'appareil qui relie n\'importe quelle source du car à n\'importe quelle destination : on choisit une sortie, puis l\'entrée qu\'elle doit recevoir.',
    body: "Une grille a des **entrées** (les sources : caméras, serveurs de ralentis, sorties du mélangeur, habillage…) et des **sorties** (les destinations : entrées du mélangeur, tuiles du multiview, enregistreurs, départs vers la chaîne). À l'intérieur, chaque sortie peut être reliée à n'importe quelle entrée : c'est une **matrice** de **points de croisement**.\n\nDeux règles :\n- une sortie ne reçoit qu'une entrée à la fois ;\n- une entrée peut alimenter autant de sorties qu'on veut (la grille recopie le signal).\n\nOn commande une grille de sa façade, de panneaux de commande ou d'un logiciel par le réseau. Toujours dans le même ordre : **la destination d'abord, la source ensuite**, puis on valide (TAKE) et on vérifie à l'image.",
    car: "Le car SDI a une Videohub 40 × 40 12G (inspiration Blackmagic Design) : 40 entrées, 40 sorties. Les 52 destinations du car ne tiennent pas toutes sur 40 sorties : les tuiles 1 à 12 du multiview sont câblées en direct, seule la dernière rangée (tuiles 13 à 18) passe par la grille. Dans le car IP, la grille est remplacée par le réseau ST 2110 et un contrôleur NMOS.",
    fig: 'vhmatrix', see: ['point-croisement', 'take', 'verrou-sortie', 'etiquette', 'protocole-videohub'],
  },
  'point-croisement': {
    t: 'Point de croisement', aka: 'crosspoint', cat: CAT,
    short: 'La liaison établie dans la grille entre une entrée et une sortie.',
    body: "Dans la matrice, chaque case à l'intersection d'une ligne (une sortie) et d'une colonne (une entrée) est un point de croisement. Commuter une sortie, c'est fermer un point sur sa ligne : celui qui était fermé s'ouvre en même temps, puisqu'une sortie ne reçoit qu'une source.\n\nUne colonne peut avoir plusieurs points fermés : la même caméra part vers le mélangeur, le multiview et l'enregistreur EVS. Une grille 40 × 40 a 1 600 points de croisement ; l'état de toute la grille tient pourtant en 40 nombres, l'entrée de chaque sortie.",
    car: "Poste Grille, onglet Matrice : un point par ligne (sortie), sur la colonne de l'entrée qu'elle reçoit. Dans le protocole Ethernet, c'est le bloc VIDEO OUTPUT ROUTING.",
    fig: 'vhmatrix', see: ['grille', 'protocole-videohub'],
  },
  take: {
    t: 'TAKE', aka: 'prise : la touche qui valide la commutation', cat: CAT,
    short: 'La touche qui exécute la commutation préparée : tant qu\'on ne l\'a pas pressée, rien ne change à la sortie.',
    body: "Sur la façade de la Videohub : OUT et le choix de la sortie, IN et le choix de la source. L'écran montre déjà l'image de la source ; CLEAR et TAKE clignotent. **TAKE** valide, **CLEAR** annule.\n\nDans le logiciel Videohub Control, un clic sur une source commute tout de suite ; l'option « Utiliser TAKE » ajoute cette étape de validation. Dans un car, on l'active : une erreur de clic ne part pas à l'antenne.\n\nLe mot sert aussi ailleurs dans le car : TAKE IN / TAKE OUT de l'habillage (lancer, retirer un graphique), TAKE de la télécommande LSM (échanger les sorties du serveur).",
    car: "Le logiciel du poste Grille a « Utiliser TAKE » coché : la source préparée clignote en rouge jusqu'au TAKE.",
    see: ['grille', 'verrou-sortie'],
  },
  'verrou-sortie': {
    t: 'Verrouillage d\'une sortie', aka: 'lock', cat: CAT,
    short: 'Une sortie verrouillée refuse toute commutation, d\'où qu\'elle vienne : on protège ainsi les départs vers la chaîne.',
    body: "Une grille est commandée par plusieurs postes à la fois : sa façade, le logiciel sur plusieurs ordinateurs, des panneaux, des automatismes. **Verrouiller** une sortie (LOCK) la fige sur sa source actuelle : plus personne ne peut la changer par erreur, pas même celui qui l'a verrouillée, tant qu'il ne l'a pas déverrouillée.\n\nLe protocole de la Videohub donne trois états par sortie :\n- **U** (unlocked) : libre ;\n- **O** (owned) : verrouillée par ce client ;\n- **L** (locked) : verrouillée par un autre client.\n\nLe verrou d'un autre poste peut être forcé : on l'appelle d'abord à l'intercom pour savoir pourquoi la sortie est figée.\n\nOn verrouille les sorties dont dépend l'antenne : départs TX1 et TX2, enregistrement de sécurité du programme.",
    car: "Cadenas du poste Grille : ambre, verrouillée par ce poste (O) ; rouge, verrouillée par un autre poste (L). Un départ verrouillé ne prend plus la mire du poste Transmission, ni une fausse manœuvre.",
    see: ['take', 'protocole-videohub'], ref: 'Blackmagic Design, Videohub Ethernet Protocol (bloc VIDEO OUTPUT LOCKS)',
  },
  etiquette: {
    t: 'Étiquette (label)', aka: 'nom d\'une entrée ou d\'une sortie', cat: CAT,
    short: 'Le nom donné à une entrée ou une sortie de la grille : il ne change que l\'affichage, jamais le câblage.',
    body: "Sans étiquette, la Videohub affiche « Input 1 » ou « Output 31 ». On nomme chaque port d'après ce qui y est câblé : CAM 3, EVS A, TX1 FIBRE… Les étiquettes s'éditent dans Videohub Setup (ou par le protocole Ethernet) et apparaissent partout : façade, logiciels, panneaux.\n\nL'étiquette n'est qu'un nom. Si elle est fausse, on route la mauvaise image en croyant bien faire. D'où deux réflexes :\n- regarder l'image (écran de la façade, monitoring) avant de valider ;\n- relire les étiquettes avec la liste de câblage au line-up.\n\nLe nom sous chaque image du multiview (UMD) est un autre nom, géré par le multiviewer : les deux doivent dire la même chose.",
    car: "Poste Grille, onglet Videohub Setup : les étiquettes des 40 entrées et des 40 sorties, avec ce qui est câblé sur chaque port. Une panne inverse les étiquettes de deux caméras.",
    see: ['grille', 'protocole-videohub'],
  },
  '12g-sdi': {
    t: '12G-SDI', aka: 'SMPTE ST 2082-1', cat: CAT,
    short: 'Le SDI à 11,88 Gb/s : une image UHD (2160p jusqu\'à 60 images par seconde) sur un seul câble coaxial 75 Ω.',
    body: "Les débits du SDI ont suivi les formats :\n- **HD-SDI** : 1,485 Gb/s (1080i, 720p) ;\n- **3G-SDI** : 2,97 Gb/s (1080p50 et 60) ;\n- **6G-SDI** : 5,94 Gb/s (2160p jusqu'à 30) ;\n- **12G-SDI** : 11,88 Gb/s (2160p50 et 60).\n\nAvant le 12G, l'UHD demandait quatre câbles 3G (quad-link). Un seul coaxial suffit maintenant, mais à ce débit le signal s'affaiblit vite : la longueur utile tombe à quelques dizaines de mètres (de l'ordre de 70 m sur un bon câble, contre plus de 100 m en HD : ordres de grandeur, selon le câble). Une grille 12G accepte aussi les débits inférieurs : chaque entrée détecte le format qu'elle reçoit.",
    car: "En UHD, les liaisons de la grille du car SDI sont en 12G-SDI ; en 1080p50, la même grille transporte du 3G-SDI.",
    see: ['reclocking', 'grille'], ref: 'SMPTE ST 2082-1 (12G), ST 2081-1 (6G), ST 424 (3G), ST 292-1 (HD)',
  },
  reclocking: {
    t: 'Reclocking', aka: 'régénération du signal SDI', cat: CAT,
    short: 'La grille reconstruit chaque signal SDI avant de le renvoyer : horloge propre, gigue retirée, comme s\'il repartait d\'un appareil neuf.',
    body: "Dans un coaxial, le signal SDI s'affaiblit et se déforme : les fronts s'arrondissent, la **gigue** (l'instant d'arrivée de chaque bit qui varie) augmente. À l'entrée, un **égaliseur** compense la perte du câble. Le **reclocking** relit ensuite les bits avec une horloge récupérée et nettoyée, puis les réémet à neuf.\n\nConséquences :\n- la longueur de câble « repart de zéro » à chaque sortie reclockée ;\n- un signal trop abîmé (câble trop long, connecteur sale) n'est pas réparé : au-delà d'une limite, les bits sont faux et l'image décroche d'un coup (« effet falaise »).\n\nLe reclocking ne met pas les sources en phase entre elles : c'est le rôle de la référence (genlock).",
    car: "Chaque sortie de la Videohub du car est reclockée.",
    fig: 'vhreclock', see: ['12g-sdi', 'commutation-propre'],
  },
  'commutation-propre': {
    t: 'Commutation au top image', aka: 'référence de la grille, ligne de commutation', cat: CAT,
    short: 'Verrouillée sur la référence du car, la grille commute pendant l\'intervalle de suppression, entre deux images : pas de saut visible.',
    body: "Commuter au milieu d'une image donnerait une image coupée en deux, puis un décrochage des appareils en aval. La grille reçoit donc la référence du car (tri-level ou black burst, entrée **REF IN**) et commute au moment prévu, sur une ligne réservée de l'intervalle de suppression, entre deux images.\n\nÀ condition que les sources soient elles-mêmes synchrones (caméras genlockées, serveurs verrouillés) : une grille sans synchroniseur ne remet pas en phase une source qui ne l'est pas. Une source extérieure (duplex, liaison HF) passe d'abord par un synchroniseur d'images.",
    car: "Face arrière de la Videohub : REF IN et sa boucle, reliés au générateur de synchro.",
    see: ['reclocking', 'grille'], ref: 'SMPTE RP 168 (point de commutation)',
  },
  'protocole-videohub': {
    t: 'Protocole Ethernet Videohub', aka: 'TCP 9990', cat: CAT,
    short: 'Un protocole texte : un client se connecte au port TCP 9990 de la grille, reçoit tout son état (étiquettes, verrous, routage), puis chaque changement.',
    body: "Le protocole est fait de **blocs** : un titre en capitales suivi de « : », des lignes, puis une ligne vide. À la connexion, la grille envoie tout son état :\n- `PROTOCOL PREAMBLE` (version) et `VIDEOHUB DEVICE` (modèle, nombre de ports) ;\n- `INPUT LABELS` et `OUTPUT LABELS` : une ligne « numéro étiquette » par port ;\n- `VIDEO OUTPUT LOCKS` : U, O ou L pour chaque sortie ;\n- `VIDEO OUTPUT ROUTING` : une ligne « sortie entrée » par sortie.\n\nLes ports sont numérotés **à partir de 0** : la ligne `30 23` veut dire « sortie 31 ← entrée 24 ». Pour commuter, un client envoie un bloc de la même forme (`VIDEO OUTPUT ROUTING:`, `30 23`, une ligne vide) ; la grille répond `ACK` et prévient tous les clients. C'est ainsi que la façade, les logiciels et les automatismes restent d'accord.",
    car: "Poste Grille, onglet Videohub Setup : les blocs que la grille du car enverrait à un client, mis à jour en direct. Elle est en 192.168.10.40 sur le réseau de contrôle.",
    see: ['reseau-ctl', 'verrou-sortie', 'etiquette'], ref: 'Blackmagic Design, Videohub Ethernet Protocol',
  },
};
Object.assign(TERMS, ADD);
// intitulés de l'interface du poste Grille → fiche (motifs précis : ils ne doivent rien capter ailleurs)
TERM_PATTERNS.push(
  [/^points? de croisement|^matrice 40/i, 'point-croisement'], [/^utiliser take$/i, 'take'], [/^verrou(illage)? des sorties|^sorties verrouillées/i, 'verrou-sortie'],
  [/^étiquettes? des (entrées|sorties)/i, 'etiquette'], [/^12g-sdi/i, '12g-sdi'], [/reclock/i, 'reclocking'], [/^protocole ethernet|tcp 9990/i, 'protocole-videohub'],
);
