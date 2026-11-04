// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » du chapitre « Les caméras PTZ » et de l'atelier du même nom au Labo (v19.30). Même format que
// content/netterms.js ; elles s'ajoutent au lexique commun. Valeurs : Panasonic AW-HE130 et AW-UE20 en
// 192.168.0.10 / 255.255.255.0 à la sortie d'usine (FAQ et guides Panasonic), PoE+ IEEE 802.3at ; Easy IP
// Setup : recherche sur le segment Ethernet, sans traverser de routeur, réglages réseau dans les 20 minutes
// qui suivent la mise sous tension quand la caméra est réglée sur « 20min » (d'usine sur l'AW-UE20,
// « Unlimited » depuis le micrologiciel 2.00 de l'AW-HE130) ; AW-RP150 : 200 caméras en IP, 5 en série,
// écran tactile 7 pouces ; PoE : IEEE 802.3af (15,4 W à la source, 12,95 W à l'appareil), 802.3at (30 W,
// 25,5 W), classes 0 à 4 ; DSCP : RFC 2474, AF41 = 34 (RFC 2597), EF = 46 (RFC 3246).
// ----------------------------------------------------------------------------------
import { TERMS, CATS } from './netterms.js';

const C = 'Caméras PTZ';
if (!CATS.includes(C)) CATS.push(C);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  ptz: {
    t: 'Caméra PTZ', aka: 'Pan, Tilt, Zoom ; caméra tourelle, tourelle robotisée', cat: C,
    short: 'Une caméra avec son zoom sur une tourelle motorisée : elle tourne (pan), s\'incline (tilt) et zoome à distance, pilotée par un pupitre ou un logiciel.',
    body: "Une **PTZ** réunit dans un boîtier la caméra, l'optique et deux moteurs : **pan** (rotation horizontale) et **tilt** (inclinaison). On la pose sur une table, un pied ou au plafond, et un opérateur la pilote de loin.\n\n- **L'image** sort en **SDI** ou **HDMI** vers le mélangeur, parfois aussi en **IP** (H.264, RTSP, SRT, NDI|HX selon le modèle).\n- **La commande** passe par le réseau (IP), ou par une liaison série RS-422 sur les modèles qui l'ont.\n- **Les positions mémorisées** (presets) rappellent un cadre en un geste.\n\nAu BTS : deux AW-HE130 (capteurs 1/2,86 pouce, zoom 20×) et une AW-UE20 (capteur 4K 1/2,8 pouce, zoom 12×), pilotées par un pupitre AW-RP150.",
    car: 'Au Labo, atelier Caméras PTZ : le banc de mise en service du BTS. Dans le car, des tourelles servent de caméras de commentateurs ou d\'ambiance.',
    see: ['poe', 'easy-ip-setup', 'aw-rp150'], ref: 'Modes d\'emploi Panasonic AW-HE130, AW-UE20',
  },
  'classe-poe': {
    t: 'Classe PoE', aka: 'Power class (IEEE 802.3af / 802.3at)', cat: C,
    short: 'Ce qu\'un appareil annonce au switch en se branchant : la puissance qu\'il lui faut. Le switch la réserve sur son budget.',
    body: "Avant d'envoyer du courant, le switch **détecte** l'appareil, puis lit sa **classe** :\n\n- classe 1 : 4 W ; classe 2 : 7 W ; classe 3 (et 0) : 15,4 W, le maximum du PoE (802.3af) ;\n- classe 4 : **30 W**, le PoE+ (802.3at), dont 25,5 W arrivent à l'appareil.\n\nUn switch qui **alloue par classe** retient la puissance annoncée, même si l'appareil consomme moins : quatre appareils de classe 4 réservent 120 W. Quand le **budget** total du switch est atteint, les ports suivants ne sont plus alimentés. Une caméra qui demande du PoE+ ne démarre pas sur un port réglé en PoE simple.",
    car: 'Au Labo, atelier Caméras PTZ : le budget du switch compte 30 W par caméra et pour le pupitre ; un port réglé en PoE (15,4 W) laisse une AW-HE130 éteinte.',
    see: ['poe'], ref: 'IEEE 802.3af, IEEE 802.3at',
  },
  'easy-ip-setup': {
    t: 'Easy IP Setup', aka: 'Easy IP Setup Software (Panasonic), EasyIPSetupTool Plus', cat: C,
    short: 'Le logiciel Panasonic qui trouve les caméras sur le réseau, même hors du sous-réseau du PC, et change leur adresse.',
    body: "Sur le PC, **Search** envoie une recherche en **diffusion** sur le segment Ethernet : chaque caméra répond, avec son **adresse MAC**, son adresse IP, son port, son modèle. Il trouve donc une caméra dont l'adresse n'est **pas** dans le sous-réseau du PC, mais pas au-delà d'un **routeur**.\n\n- **Network Settings** : adresse IP, masque, passerelle, port HTTP, DHCP, puis Save.\n- **Access Camera** : ouvre la page web de la caméra dans le navigateur.\n- **La fenêtre de 20 minutes** : une caméra réglée sur « 20min » (Easy IP Setup accommodate period) n'est plus affichée ni réglable passé 20 minutes sous tension. On la redémarre, ou l'on règle « Unlimited » dans sa page web.\n\nDes caméras neuves ont toutes la même adresse (192.168.0.10) : on les distingue par leur MAC, notée sur l'étiquette.",
    car: 'Au Labo, atelier Caméras PTZ : le PC technique a Easy IP Setup ; les trois caméras sortent du carton en 192.168.0.10.',
    see: ['conflit-ip', 'mac', 'sous-reseau'], ref: 'Panasonic, Easy IP Setup Software, mode d\'emploi',
  },
  'port-http': {
    t: 'Port HTTP', aka: 'Numéro de port TCP du serveur web', cat: C,
    short: 'Le numéro de porte du serveur web de la caméra : 80 par défaut. Changé, il faut l\'écrire dans l\'URL (http://adresse:port) et au pupitre.',
    body: "Une adresse IP désigne l'appareil ; le **port** désigne le service. Le serveur web d'une caméra écoute en **TCP**, sur le port **80** par défaut (443 en HTTPS).\n\n- Avec un autre port, l'URL le précise : `http://192.168.10.11:8080`. Sans lui, le navigateur frappe à la porte 80 : « connexion refusée ».\n- Les pupitres Panasonic envoient leurs commandes en **HTTP** (`/cgi-bin/aw_ptz?cmd=…`) : dans MANUAL IP SET, le port de chaque caméra doit être celui qu'elle écoute.",
    car: 'Au Labo, atelier Caméras PTZ : le port HTTP se règle dans Easy IP Setup ou la page web ; le pupitre l\'attend dans MANUAL IP SET.',
    see: ['port', 'tcp'], ref: 'RFC 9110 (HTTP), IANA (port 80)',
  },
  'compte-admin': {
    t: 'Compte administrateur', aka: 'Compte de la page web d\'un appareil', cat: C,
    short: 'Le nom et le mot de passe qui protègent les réglages d\'un appareil réseau. Celui d\'usine se change ; une caméra sans compte ne se pilote pas.',
    body: "Tout ce qui est sur le réseau est joignable par tous les postes du réseau. Le **compte administrateur** empêche qu'un autre poste change l'adresse d'une caméra ou la pilote.\n\n- L'**AW-UE20** demande de créer le compte au **premier accès** à sa page web ; tant qu'il n'existe pas, un pupitre la voit mais ne peut pas la piloter.\n- L'**AW-HE130** a un compte d'**usine** (admin, 12345 dans son mode d'emploi) : connu de tous, il se **change** avant d'exploiter.\n\nBonne pratique : un mot de passe d'au moins 8 caractères, ni le nom ni celui d'usine, noté dans le dossier technique du banc (pas sur l'appareil).",
    car: 'Au Labo, atelier Caméras PTZ : la page web de chaque caméra, User mng.',
    see: ['easy-ip-setup'], ref: 'Modes d\'emploi Panasonic AW-HE130, AW-UE20',
  },
  dscp: {
    t: 'DSCP', aka: 'Differentiated Services Code Point (Diffserv)', cat: C,
    short: 'Six bits dans l\'en-tête IP qui disent au switch la priorité d\'un paquet : 34 (AF41) pour la vidéo, 46 (EF) pour ce qui ne doit pas attendre, 0 au mieux.',
    body: "L'en-tête IP a un octet de **qualité de service** (l'ancien ToS) ; ses **6 premiers bits** sont le **DSCP** : 64 valeurs. L'octet vaut donc DSCP × 4 (34 → 136).\n\n- **0** (DF) : au mieux, la file ordinaire ;\n- **34** (AF41) : la vidéo interactive, la classe des médias ;\n- **46** (EF) : ce qui ne supporte aucune attente (voix, horloge PTP).\n\nLa caméra **marque** ses paquets (réglage Diffserv de sa page web), mais rien ne se passe si le switch ne **fait pas confiance** au DSCP et n'a pas de **file prioritaire** : marquer sans régler le switch ne sert à rien.",
    car: 'Au Labo, atelier Caméras PTZ : Diffserv dans Setup → Network → Advanced ; confiance DSCP et files du port du PC dans « Le banc ».',
    see: ['qos', 'cos'], ref: 'RFC 2474, RFC 2597 (AF), RFC 3246 (EF), RFC 4594',
  },
  'aw-rp150': {
    t: 'Pupitre AW-RP150', aka: 'Remote camera controller Panasonic', cat: C,
    short: 'Le pupitre de commande des PTZ : joystick, zoom, touches de caméra, écran tactile. Il appelle chaque caméra à l\'adresse et au port qu\'on lui a donnés.',
    body: "Le **AW-RP150** pilote jusqu'à **200 caméras en IP** (et 5 par liaison série RS-422) ; ses **10 touches** de sélection appellent les numéros de caméra. Il a un écran tactile de **7 pouces**, un joystick pan et tilt, une commande de zoom, une sortie SDI de contrôle, du tally et des GPIO. Il s'alimente en **PoE+** ou en 12 V.\n\nMise en service, menu CONNECT SETTING :\n\n- **RP IP SET** : l'adresse, le masque et la passerelle du pupitre, dans le sous-réseau des caméras ;\n- **MANUAL IP SET** : pour chaque numéro, l'adresse IP et le port de la caméra ;\n- **AUTO IP SET** : le pupitre attribue les adresses lui-même ; on ne le lance pas en même temps qu'Easy IP Setup.",
    car: 'Au Labo, atelier Caméras PTZ : le pupitre, ses touches de caméra (allumées quand la liaison tient) et la commande HTTP que chaque geste envoie.',
    see: ['ptz', 'port-http'], ref: 'Panasonic AW-RP150, mode d\'emploi',
  },
};
for (const [k, v] of Object.entries(ADD)) if (!TERMS[k]) TERMS[k] = v;
