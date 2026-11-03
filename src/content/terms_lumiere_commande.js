// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » du chapitre « La lumière » (v19.29), partie « commande ». Même format que content/netterms.js ;
// elles s'ajoutent au lexique commun (catégories de content/terms_labo.js). Valeurs : RDM (ANSI E1.20) sur la
// même paire que le DMX, code de début 0xCC, identifiant unique de 48 bits ; pan 540° et tilt 270° (lyres de la
// console du Labo, labo/calc/show.js) : 2,1° par pas sur 8 bits, moins d'un centième de degré sur 16 bits ;
// splitter : 32 récepteurs par sortie (RS-485), sorties isolées ; presets numérotés par famille comme sur la
// console du Labo (1 intensité, 2 position, 3 gobo, 4 couleur, 5 faisceau).
// ----------------------------------------------------------------------------------
import { TERMS } from './netterms.js';
import './terms_labo.js';

const L = 'Lumière et DMX';
/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  rdm: {
    t: 'RDM', aka: 'Remote Device Management (ANSI E1.20)', cat: L,
    short: 'Le DMX qui répond : la console découvre les projecteurs de la ligne, lit leur état et règle leur adresse à distance.',
    body: "Le DMX512 va dans un seul sens. Le **RDM** ajoute un dialogue sur la même paire : entre deux trames de niveaux, la console envoie une question (code de début 0xCC) et un seul appareil répond.\n\n- **Découverte** : chaque appareil a un identifiant unique de 48 bits (fabricant et numéro) ; la console les trouve tous sans connaître leur adresse.\n- **Réglages à distance** : adresse de départ, mode, inversion du pan, lecture des heures de lampe, des températures, des erreurs.\n\nIl demande une ligne qui laisse passer le retour : des splitters et des nœuds **compatibles RDM**. Un splitter ordinaire ne transmet que dans le sens console → projecteurs.",
    car: 'Le RDM n\'est pas simulé dans le Labo : l\'adresse s\'y règle au menu du projecteur ou aux commutateurs DIP, comme sur un appareil sans RDM.',
    see: ['dmx512', 'adresse-dmx', 'splitter-dmx'], ref: 'ANSI E1.20 (RDM)',
  },
  'splitter-dmx': {
    t: 'Splitter DMX', aka: 'Répartiteur isolé, booster', cat: L,
    short: 'Un boîtier qui reçoit une ligne DMX et la recopie, régénérée et isolée, sur plusieurs sorties : la seule façon propre de faire des branches.',
    body: "Une ligne DMX va d'appareil en appareil, sans dérivation : un câble en Y crée des réflexions au bout de chaque branche. Le **splitter** reçoit la ligne et la renvoie sur 4, 6 ou 8 sorties.\n\n- Chaque sortie est une nouvelle ligne : jusqu'à **32 récepteurs** et environ 300 m de câble (ordre de grandeur), avec sa propre **terminaison** au bout.\n- Les sorties sont **isolées** (optiquement ou galvaniquement) : un défaut sur une branche ne remonte pas à la console.\n- Pour le **RDM**, il faut un splitter compatible, qui laisse passer les réponses.",
    car: 'L\'atelier DMX du Labo : la vue de la ligne propose un splitter quand il y a trop de récepteurs ou une dérivation en Y.',
    see: ['terminaison-dmx', 'dmx512', 'rdm'], ref: 'ANSI E1.11, TIA/EIA-485',
  },
  'noeud-dmx': {
    t: 'Nœud DMX', aka: 'Node Art-Net ou sACN, passerelle Ethernet / DMX', cat: L,
    short: 'Le boîtier qui reçoit des univers sur le réseau (Art-Net ou sACN) et refait des lignes DMX près des projecteurs.',
    body: "La console envoie ses univers sur Ethernet ; le **nœud**, posé près des projecteurs, les écoute et sort chaque univers sur un port DMX (XLR 5 broches).\n\nIl se règle comme tout appareil du réseau : une **adresse IP** et un **masque** dans le sous-réseau de la console, puis, pour chaque sortie, l'univers écouté : en Art-Net, Net, Sub-Net et Universe (le Port-Address) ; en sACN, le numéro d'univers.\n\nUn nœud remplace de longues lignes DMX par un seul câble réseau, et isole les lignes les unes des autres.",
    car: 'L\'atelier DMX du Labo, vue « Le réseau lumière » : la console et un nœud, leurs adresses et l\'univers écouté.',
    see: ['artnet', 'sacn', 'univers-dmx'], ref: 'Art-Net 4, ANSI E1.31',
  },
  'cue-lumiere': {
    t: 'Cue', aka: 'Mémoire, pas de conduite', cat: L,
    short: 'Un état de la lumière enregistré dans une séquence, avec ses temps : on passe de l\'une à l\'autre par Go.',
    body: "Une **cue** garde des valeurs (intensités, couleurs, positions) et des **temps** : le fondu d'entrée (ce qui monte), le fondu de sortie (ce qui descend), un **delay** (une attente avant de commencer).\n\nLes cues se rangent dans une **séquence**, sur un exécuteur ; la touche **Go** lance la suivante. Avec le **tracking**, une cue ne garde que ce qui change par rapport à la précédente.",
    car: 'La console dot2 du Labo : Store Cue enregistre, Go rejoue ; le Labo relit le show et note les cues.',
    see: ['tracking', 'preset-lumiere', 'chaser'], ref: 'Pratique des consoles d\'éclairage',
  },
  'preset-lumiere': {
    t: 'Preset', aka: 'Palette', cat: L,
    short: 'Une valeur enregistrée une fois (une couleur, une position, un gobo) et appelée par son numéro : les cues y renvoient.',
    body: "Un **preset** garde, pour des projecteurs, une couleur, une position, un gobo ou un réglage de faisceau. On le rappelle par son numéro (« Preset 4.3 » : le troisième preset de couleur, sur une console de type MA où les couleurs sont la famille 4).\n\nUne cue qui utilise un preset garde un **renvoi**, pas la valeur. Corriger le preset corrige d'un coup toutes les cues qui y renvoient : la position du présentateur a bougé, on la refait une fois, pas dans trente cues.",
    car: 'La console dot2 du Labo : les presets de couleur et de position du show de départ, appelés dans les cues.',
    see: ['cue-lumiere', 'tracking'], ref: 'Pratique des consoles d\'éclairage',
  },
  chaser: {
    t: 'Chaser', aka: 'Séquence en boucle', cat: L,
    short: 'Une séquence qui enchaîne ses pas toute seule, en boucle, à une vitesse donnée (en pas par minute, BPM).',
    body: "Un **chaser** joue ses cues l'une après l'autre sans Go, à sa **vitesse** : à b pas par minute, un pas dure 60 ÷ b secondes, et un tour de n pas dure n × 60 ÷ b secondes. Un chaser de 4 pas à 120 BPM fait le tour en 2 s.\n\nSes réglages : la vitesse (souvent calée au tempo, par un bouton Learn qu'on frappe), le **fondu** entre les pas (de net à fondu), le sens (avant, arrière, aller-retour, au hasard).",
    car: 'La console dot2 du Labo : un exécuteur réglé en chaser, sa vitesse et ses pas ; un des défis en demande un.',
    see: ['cue-lumiere'], ref: 'Pratique des consoles d\'éclairage',
  },
  'pan-tilt': {
    t: 'Pan et tilt', aka: 'Panoramique et inclinaison d\'une lyre', cat: L,
    short: 'Les deux axes d\'une lyre : le pan tourne la lyre autour de sa base (souvent 540°), le tilt incline la tête (souvent 270°).',
    body: "Une **lyre** (projecteur asservi) oriente son faisceau par deux moteurs : le **pan**, rotation horizontale de la lyre, et le **tilt**, inclinaison de la tête.\n\nSur 8 bits, 540° de pan se partagent en 255 pas : **2,1° par pas**, et à 20 m la tache saute de plus de 70 cm. Les lyres envoient donc pan et tilt sur **16 bits** (deux canaux : grossier puis fin) : moins d'un centième de degré par pas.\n\nUn **effet** de position fait suivre à pan et tilt deux sinus de même vitesse : déphasés de 90°, la tache décrit un cercle.",
    car: 'La console dot2 du Labo : les lyres spot et wash, leurs encodeurs pan et tilt, les effets de position.',
    see: ['gobo', 'empreinte-dmx'], ref: 'Fiches des constructeurs de lyres',
  },
  gobo: {
    t: 'Gobo', aka: 'Découpe de motif dans le faisceau', cat: L,
    short: 'Un petit disque ajouré placé dans le faisceau d\'une découpe ou d\'une lyre spot : il projette un motif net.',
    body: "Un **gobo** est un disque de métal ou de verre gravé, placé au point focal du projecteur : la mise au point (focus) rend son motif net sur le décor ou au sol.\n\nUne lyre spot en porte plusieurs sur une **roue de gobos** (choisis par un canal DMX), souvent avec un canal de **rotation**. Une roue de couleurs fonctionne de même avec des filtres fixes ; une lyre wash, elle, mélange ses couleurs (CMY ou LED RGBW) et n'a pas de gobo.",
    car: 'La console dot2 du Labo : la roue de gobos de la lyre spot, appelée par un preset de gobo.',
    see: ['pan-tilt'], ref: 'Pratique de l\'éclairage scénique',
  },
};
for (const [k, v] of Object.entries(ADD)) if (!TERMS[k]) TERMS[k] = v;
