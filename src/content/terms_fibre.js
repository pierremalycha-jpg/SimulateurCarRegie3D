// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » des liaisons optiques de la caméra : fibre monomode, câble hybride SMPTE, niveau optique,
// propreté des connecteurs. Elles s'ajoutent au lexique commun (content/netterms.js), même format.
// Valeurs : fibre monomode 9/125 µm (UIT-T G.652 : ≈ 0,35 dB/km à 1 310 nm, ≈ 0,2 dB/km à 1 550 nm),
// multimode 50/125 µm (≈ 3 dB/km à 850 nm) ; câble hybride SMPTE ST 311, connecteur ST 304 (type LEMO
// 3K.93C) ; inspection des connecteurs IEC 61300-3-35. Niveaux optiques : ceux du simulateur (baie CCU).
// ----------------------------------------------------------------------------------
import { TERMS, CATS } from './netterms.js';

export const FIBRE_CAT = 'Liaisons optiques';
if (!CATS.includes(FIBRE_CAT)) CATS.push(FIBRE_CAT);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  'fibre-monomode': {
    t: 'Fibre monomode', aka: 'single-mode, SMF, 9/125 µm', cat: FIBRE_CAT,
    short: 'Une fibre au cœur si fin (9 µm) que la lumière n\'y suit qu\'un seul chemin : elle porte loin, très peu affaiblie.',
    body: "Une fibre optique, c'est un **cœur** de verre entouré d'une **gaine optique** d'un indice un peu plus faible (125 µm de diamètre), puis d'un revêtement protecteur. La lumière reste dans le cœur par **réflexion totale**.\n\nEn **monomode**, le cœur ne fait que **9 µm** : un seul chemin possible, aucun étalement des impulsions. Affaiblissement ≈ 0,35 dB/km à 1 310 nm : quelques kilomètres ne coûtent presque rien. En **multimode** (cœur de 50 ou 62,5 µm), plusieurs chemins de longueurs différentes étalent les impulsions et l'affaiblissement est d'environ 3 dB/km : réservé aux courtes distances.",
    car: 'Le câble hybride de chaque caméra système contient deux fibres monomodes, une par sens.',
    see: ['cable-hybride', 'niveau-optique', 'nettoyage-fibre'], ref: 'UIT-T G.652 ; SMPTE ST 311',
  },
  'cable-hybride': {
    t: 'Câble hybride SMPTE', aka: 'fibre caméra, câble ST 311, connecteur ST 304', cat: FIBRE_CAT,
    short: 'Le câble unique entre une tête de caméra et sa CCU : deux fibres monomodes pour les signaux et du cuivre pour l\'énergie.',
    body: "Le câble **ST 311** (≈ 9 mm de diamètre) réunit **deux fibres monomodes** (une par sens), **deux conducteurs d'énergie** et **deux conducteurs basse tension**, sous une gaine renforcée. Le connecteur **ST 304** (type LEMO 3K.93C) les branche tous d'un seul geste, fibres au centre.\n\nLa CCU **télé-alimente** la tête par le cuivre : la chute de tension dans le câble limite la longueur, de l'ordre de 2 km selon la caméra et la CCU. Au-delà, on passe en fibre monomode seule, avec une alimentation sur place.",
    car: 'À la baie CCU : la liaison de chaque voie, sa longueur, son niveau optique et l\'alimentation de la tête.',
    see: ['fibre-monomode', 'niveau-optique', 'nettoyage-fibre'], ref: 'SMPTE ST 311 (câble), ST 304 (connecteur)',
  },
  'niveau-optique': {
    t: 'Niveau optique', aka: 'puissance reçue, en dBm', cat: FIBRE_CAT,
    short: 'La puissance de lumière qui arrive au bout de la fibre, en dBm : la CCU l\'affiche pour chaque caméra.',
    body: "Le **dBm** compare une puissance à 1 mW : 0 dBm = 1 mW, −10 dBm = 0,1 mW, −20 dBm = 0,01 mW. Chaque perte se soustrait en dB : la fibre (≈ 0,35 dB/km), chaque paire de connecteurs propres (de l'ordre de 0,3 à 0,5 dB), une poussière (plusieurs dB).\n\nLe **bilan** : puissance émise − pertes = niveau reçu ; la **marge** est l'écart avec la sensibilité du récepteur. En exploitation, de l'ordre de −5 à −15 dBm ; vers −20 dBm, la liaison décroche (ordres de grandeur du simulateur).",
    car: 'Baie CCU : « OPT. −5,6 dBm » sur chaque voie ; une voie bien plus basse que les autres trahit un connecteur sale.',
    see: ['fibre-monomode', 'nettoyage-fibre', 'cable-hybride'], ref: 'Fiches des CCU ; IEC 61300-3-35',
  },
  'nettoyage-fibre': {
    t: 'Nettoyer et inspecter un connecteur optique', cat: FIBRE_CAT,
    short: 'Une poussière de quelques µm sur un cœur de 9 µm bloque la lumière : on nettoie et on inspecte les deux bouts avant chaque branchement.',
    body: "La face d'un connecteur optique ne se voit pas à l'œil : le cœur fait 9 µm, moins qu'un cheveu (≈ 70 µm). Une poussière, une trace de doigt ou une rayure suffisent à perdre plusieurs dB ou à renvoyer de la lumière vers l'émetteur.\n\nLa règle : **inspecter, nettoyer, inspecter**, aux **deux bouts**, avant de brancher. Stylo de nettoyage (à cliquer), lingette sèche, puis alcool isopropylique si besoin ; un microscope de poche ou une sonde vérifie la face (zones du cœur et de la gaine, IEC 61300-3-35). On remet les **bouchons** dès qu'on débranche.\n\nJamais de regard dans un connecteur en service : la lumière est **infrarouge** (1 310 nm), invisible, et peut abîmer l'œil.",
    car: 'Dans l\'atelier, le montage de la caméra fait nettoyer la fibre aux deux bouts avant de la brancher.',
    see: ['niveau-optique', 'fibre-monomode', 'cable-hybride'], ref: 'IEC 61300-3-35 (inspection des faces de connecteurs)',
  },
};
Object.assign(TERMS, ADD);
