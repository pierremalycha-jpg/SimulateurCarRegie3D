// @ts-check
// ----------------------------------------------------------------------------------
// Module « L'entrepôt » : les types communs (JSDoc). Un seul vocabulaire pour le catalogue
// (entrepot/catalogue), l'état du montage (entrepot/build.js), le moteur (entrepot/engine.js),
// la scène 3D (entrepot/scene.js) et les panneaux (entrepot/ui).
//
// Vocabulaire :
//   - un MODÈLE (Modele) est un appareil du catalogue (AW-HE130, HyperDeck Studio HD Plus…) ;
//   - un APPAREIL (Appareil) est un exemplaire sorti du stock et placé dans l'entrepôt ;
//   - un PORT est un connecteur d'un modèle ; une LIAISON (Cable) relie deux ports de deux appareils ;
//   - une CONFIGURATION (cfg) est ce que l'on règle dans les menus de l'appareil (adresse IP, format…).
// ----------------------------------------------------------------------------------

/**
 * Connecteur physique : ce qui est sur la face de l'appareil.
 * @typedef {'bnc' | 'hdmi' | 'rj45' | 'xlr3' | 'xlr4' | 'xlr5' | 'rca' | 'toslink' | 'usbc' | 'usba' | 'minidin8' | 'dsub25' | 'dsub9' | 'rj12' | 'dc' | 'iec' | 'sfp' | 'jack35' | 'jack63' | 'sd' | 'ssd' | 'mur'} PortKind
 */
/**
 * Signal que transporte un port (une liaison n'est valable qu'entre deux ports du même signal,
 * et un câble du bon type).
 * @typedef {'sdi' | 'hdmi' | 'ip' | 'audio' | 'aes' | 'ref' | 'tc' | 'rs422' | 'rs232' | 'gpio' | 'tally' | 'secteur' | 'dc12' | 'usb' | 'madi' | 'media'} Signal
 */
/** @typedef {'in' | 'out' | 'io'} Dir */
/**
 * @typedef {object} Port
 * @property {string} id identifiant unique dans le modèle (sdi-in-1, lan, dc…)
 * @property {string} label sérigraphie réelle (SDI IN 1, LAN, DC 12V IN…)
 * @property {PortKind} kind connecteur
 * @property {Signal} sig signal
 * @property {Dir} dir sens
 * @property {string} [desc] rôle, en une phrase
 * @property {string} [group] groupe de la face (Vidéo, Réseau, Alimentation…)
 * @property {boolean} [poe] port réseau qui FOURNIT du PoE+ (switch) ou qui PEUT ÊTRE alimenté en PoE+ (appareil)
 * @property {number} [watts] pour un port PoE d'appareil : puissance demandée (W) ; pour un port iec/dc d'appareil : consommation (W)
 * @property {string} [thru] port de sortie qui recopie ce port d'entrée (boucle active : HyperDeck, Teranex, RP150)
 * @property {boolean} [nic] port réseau de l'appareil (porte une interface IP de cfg.reseau)
 */
/**
 * Interface réseau par défaut d'un modèle (ce qui sort du carton).
 * @typedef {object} Iface
 * @property {boolean} dhcp
 * @property {string} ip
 * @property {string} mask
 * @property {string} gw
 */
/**
 * Un service réseau rendu ou demandé par un modèle (pour le moteur : qui parle à qui, sur quel port).
 * @typedef {object} Service
 * @property {string} id ptz-http, hyperdeck, atem, web, ndi, rtmp, vmix…
 * @property {'serveur' | 'client'} role l'appareil écoute (serveur) ou appelle (client)
 * @property {number} [port] port TCP/UDP (80, 9993, 9910…)
 * @property {string} [desc]
 */
/**
 * Élément d'une face dessinée (le format de equipment/devices.js : body, group, text, port, led, btn,
 * lcd, knob, sw…) ; un élément « port » porte l'id du port du modèle.
 * @typedef {{ t: string, [k: string]: any }} FaceItem
 */
/** @typedef {{ label: string, w: number, h: number, items: FaceItem[] }} Face */
/**
 * @typedef {object} Modele
 * @property {string} id identifiant du catalogue (he130, atem-hd8-iso…)
 * @property {string} marque Panasonic, Blackmagic Design, Ross Video, NETGEAR…
 * @property {string} nom nom commercial (AW-HE130, ATEM Television Studio HD8 ISO…)
 * @property {string} court nom court pour les étiquettes (HE130, ATEM HD8…)
 * @property {'camera' | 'pupitre' | 'melangeur' | 'enregistreur' | 'convertisseur' | 'reseau' | 'ordinateur' | 'alimentation' | 'moniteur' | 'accessoire' | 'son'} famille
 * @property {string} role ce que fait l'appareil, en une phrase
 * @property {'rack' | 'table' | 'plateau' | 'mur'} pose où il se pose : baie 19" (hauteur en U), table, plateau (pied), prise murale
 * @property {number} [u] hauteur en U pour un appareil de baie
 * @property {number} [largeur] fraction de la largeur d'une baie (1, 1/2, 1/3) : un demi-rack, un tiers de rack
 * @property {Port[]} ports
 * @property {Iface | null} [reseau] interface IP d'usine (null : pas d'IP)
 * @property {Service[]} [services]
 * @property {number} [watts] consommation typique (W), pour le budget électrique
 * @property {number} [prix] ordre de grandeur (€ HT), à titre pédagogique
 * @property {string[]} [formats] formats vidéo possibles (1080p50, 1080i50, 720p50…) ; le premier est l'usine
 * @property {Record<string, any>} [cfg] configuration d'usine (menus de l'appareil) ; le moteur et le panneau de configuration la lisent
 * @property {Record<string, Face>} [faces] faces dessinées (avant, arriere)
 * @property {string[]} [specs] caractéristiques à montrer (texte)
 * @property {string} [doc] document de référence (mode d'emploi, fiche technique)
 * @property {string[]} [averifier] points que le rédacteur n'a pas pu vérifier dans la documentation
 * @property {{ w: number, h: number, d: number, couleur?: string }} [boite] dimensions (m) et couleur pour la 3D
 */

/**
 * Un appareil sorti du stock.
 * @typedef {object} Appareil
 * @property {string} uid
 * @property {string} modele id du modèle
 * @property {string} nom nom donné par l'utilisateur (CAM 1, HyperDeck PGM…)
 * @property {Place} place
 * @property {Record<string, any>} cfg configuration courante (copie de l'usine, puis réglée)
 * @property {boolean} [on] interrupteur de l'appareil (s'il en a un) ; absent : toujours allumé quand alimenté
 */
/**
 * Où l'appareil est posé : dans la baie (u = rangée du bas, 1 à 12), sur la table (slot), sur le
 * plateau (slot), ou au mur (prises).
 * @typedef {{ zone: 'rack' | 'table' | 'plateau' | 'mur', slot: number }} Place
 */
/** @typedef {{ dev: string, port: string }} Bout */
/**
 * @typedef {object} Cable
 * @property {string} uid
 * @property {Bout} a
 * @property {Bout} b
 * @property {Signal} sig signal transporté (déduit des ports)
 * @property {number} [len] longueur (m)
 */
/**
 * Le montage : ce que l'utilisateur a sorti, posé, câblé et réglé.
 * @typedef {object} Build
 * @property {Appareil[]} appareils
 * @property {Cable[]} cables
 * @property {string} [mission] mission en cours (entrepot/missions.js) ou '' pour le bac à sable
 * @property {number} [at] date d'enregistrement
 */

/**
 * Ce qui arrive sur un port vidéo (SDI ou HDMI) : la source, son format, l'audio embarqué.
 * @typedef {object} Flux
 * @property {string} src uid de l'appareil d'origine (caméra, mélangeur…)
 * @property {string} srcPort port de sortie d'origine
 * @property {string} format 1080p50, 1080i50…
 * @property {string} label ce que c'est (CAM 1, PGM, multiview…)
 * @property {Array<{ ch: number, from: string }>} audio voies audio embarquées (1 à 16) et leur origine
 * @property {string[]} via appareils traversés (boucles)
 */
/**
 * Résultat du moteur pour un montage.
 * @typedef {object} Eval
 * @property {Record<string, { on: boolean, source: string, why: string, watts: number }>} power par appareil : alimenté ? par quoi (secteur, PoE+ du switch X port n) ? pourquoi pas ?
 * @property {Record<string, { budget: number, used: number, ok: boolean }>} poe par switch : budget PoE
 * @property {Record<string, { ok: boolean, why: string }>} cables par câble : liaison valable ? (signal, sens, format…)
 * @property {Record<string, Flux | null>} video par « uid:port » d'entrée vidéo : le flux reçu (null : rien)
 * @property {Record<string, { ip: string, mask: string, gw: string, dhcp: boolean, link: boolean, conflit: boolean, domaine: string }>} ip par appareil réseau : adresse effective, lien, conflit d'adresse, domaine de niveau 2
 * @property {Record<string, boolean>} reach par « a>b » : a joint b en IP
 * @property {Record<string, { ok: boolean, why: string, label: string }>} services par « uid:service(:cible) » : service rendu ou pas
 * @property {Record<string, { pgm: boolean, pvw: boolean, via: string }>} tally par appareil (caméra) : tally reçu, par quel chemin
 * @property {Array<{ dev: string, level: 'erreur' | 'attention' | 'info', msg: string }>} alertes
 * @property {number} ver
 */
export {};
