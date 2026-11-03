// @ts-check
// ----------------------------------------------------------------------------------
// Le référentiel du BTS Métiers de l'audiovisuel, option « Techniques d'ingénierie et exploitation des
// équipements » (TIEE), tel que le fixe l'arrêté du 4 juin 2013 modifié (annexe I : référentiel des activités
// professionnelles, référentiel de certification, unités ; annexes 4 et 5 : règlement d'examen, définition des
// épreuves), et le rattachement des activités du simulateur à ses compétences.
//   - Les compétences portent leur numéro officiel, C1 à C39 (référentiel, pages 64 et 104 à 118) : ce sont
//     les numéros des fiches de TP et des sujets de TMO. Jusqu'à la v19.22, le simulateur les numérotait 1.1 à
//     4.5 par bloc de la fiche RNCP37022 ; la table ANCIEN fait la correspondance (progression, documents).
//   - Chaque compétence appartient à une unité (U3, U4, U51, U52, U6 : référentiel page 190) et donc à une
//     épreuve ; les quatre blocs de la fiche RNCP regroupent ces unités (BC02 = U4, la TMO).
//   - Les savoir-faire SF01 à SF112 (pages 104 à 118, définis pages 157 à 164) et les savoirs A1 à L12
//     (pages 129 à 135, avec le niveau taxonomique demandé à l'option TIEE) permettent de citer le référentiel
//     dans les leçons et les chapitres du Cours.
// La couverture est le constat sur le car régie ; « prevu » renvoie aux modules qui combleront une compétence
// absente ou incomplète (ROADMAP.md).
// ----------------------------------------------------------------------------------
import { NOTIONS, ORDRE } from '../camlab/notions/index.js';
import { DEFIS_LABO, atelierById } from '../labo/ateliers.js';

export const FICHE = {
  code: 'RNCP37022',
  titre: 'BTS Métiers de l\'audiovisuel, option Techniques d\'ingénierie et exploitation des équipements',
  echeance: '31 août 2027',
  /** le texte réglementaire et le document consulté (pagination du PDF) */
  arrete: 'Arrêté du 4 juin 2013 modifié portant définition et fixant les conditions de délivrance du BTS Métiers de l\'audiovisuel (BO n° 30 du 25 juillet 2013)',
  pages: { rap: '36 à 45', competences: '64, 65 et 104 à 118', savoirFaire: '157 à 164', savoirs: '129 à 135', unites: '190', examen: '201', epreuves: '203 à 217' },
};

/**
 * @typedef {object} Epreuve
 * @property {string} id E1 … E6, E51, E52
 * @property {string} unite U1 … U6, U51, U52
 * @property {string} titre
 * @property {string} [sigle]
 * @property {number} coef
 * @property {string} ccf forme en CCF (scolaires des établissements publics ou privés sous contrat, apprentis habilités)
 * @property {string} ponctuel forme ponctuelle
 * @property {string} [objet] ce que l'épreuve évalue, d'après l'annexe 5
 * @property {boolean} [competences] l'unité porte des compétences du référentiel de certification
 */
/** les épreuves de l'option TIEE (règlement d'examen, page 201 ; définition des épreuves, pages 203 à 217) */
/** @type {Epreuve[]} */
export const EPREUVES = [
  { id: 'E1', unite: 'U1', titre: 'Culture audiovisuelle et artistique', sigle: 'CAA', coef: 2, ccf: '2 situations d\'évaluation (essai argumenté, commentaire de deux supports)', ponctuel: 'écrit, 4 h + 30 min de lecture et de visionnement', objet: 'L\'analyse d\'un produit artistique, dans la logique du commentaire littéraire.' },
  { id: 'E2', unite: 'U2', titre: 'Anglais', coef: 1, ccf: '2 situations d\'évaluation (compréhension de l\'oral, expression orale)', ponctuel: 'oral, 45 min', objet: 'Compréhension de l\'oral, production et interaction orales, au niveau B2.' },
  { id: 'E3', unite: 'U3', titre: 'Physique et technique des équipements et supports', sigle: 'PTES', coef: 4, ccf: 'ponctuelle écrite, 6 h (3 h de technologie des équipements et supports, 3 h de physique)', ponctuel: 'écrit, 6 h (3 h + 3 h)', competences: true,
    objet: 'À partir du dossier d\'un projet de production (documents constructeur, schémas fonctionnels, notices, mesures), analyser le système, prendre en compte les contraintes, proposer et justifier des solutions, expliquer les principes physiques mis en œuvre.' },
  { id: 'E4', unite: 'U4', titre: 'Techniques et mise en œuvre', sigle: 'TMO', coef: 4, ccf: '2 situations d\'évaluation d\'au moins 4 h chacune : la première au second semestre de la première année, la seconde en janvier ou février de la seconde année, sur des compétences complémentaires', ponctuel: 'pratique, 4 h + 30 min de lecture, d\'appropriation et de préparation du sujet', competences: true,
    objet: 'Épreuve pratique sur des matériels professionnels : à partir d\'une situation professionnelle décrite par un conducteur, des éléments scénaristiques et les documents techniques, réaliser une production, faire des choix en explicitant contraintes et conséquences, mettre en œuvre les équipements, gérer des flux numériques sous contrainte, exploiter la documentation ; expliquer et vérifier par la mesure les principes physiques en jeu.' },
  { id: 'E51', unite: 'U51', titre: 'Projet à caractère professionnel', sigle: 'EPS', coef: 4, ccf: 'deux revues de production (20 min chacune, coef. 2 au total) puis un oral de 45 min (exposé 20 min, entretien 25 min)', ponctuel: 'oral, 1 h (exposé 25 min, entretien 35 min)', competences: true,
    objet: 'Dans un projet conduit en équipe pendant six semaines (150 h au plus), préparer, mettre en œuvre et finaliser une production respectant les normes de diffusion (PAD), puis en rendre compte avec un regard critique.' },
  { id: 'E52', unite: 'U52', titre: 'Environnement économique et juridique du projet', sigle: 'EEJ', coef: 1, ccf: 'oral de 15 min (exposé 5 min, entretien 10 min) sur le dossier du projet', ponctuel: 'oral, 15 min', competences: true,
    objet: 'Les contraintes économiques, juridiques et financières du projet à caractère professionnel.' },
  { id: 'E6', unite: 'U6', titre: 'Situation en milieu professionnel', coef: 1, ccf: 'oral de 30 min (exposé 15 min, entretien 15 min) sur le ou les rapports de stage', ponctuel: 'oral, 30 min', competences: true,
    objet: 'Un ou plusieurs stages de 8 à 10 semaines : rendre compte de son activité dans l\'entreprise et des contraintes (économiques, juridiques, organisationnelles, de sécurité) de la mission confiée.' },
];
export const epreuveDe = (/** @type {string} */ unite) => EPREUVES.find((e) => e.unite === unite) || null;
export const epreuveById = (/** @type {string} */ id) => EPREUVES.find((e) => e.id === id) || null;

/**
 * @typedef {object} Bloc
 * @property {string} id
 * @property {number} n
 * @property {string} titre
 * @property {string[]} unites unités du référentiel que le bloc regroupe
 * @property {string} epreuve épreuve correspondante
 * @property {string} forme
 */
/** les blocs de compétences de la fiche RNCP37022 ; chacun correspond à une ou deux unités du référentiel */
/** @type {Bloc[]} */
export const BLOCS = [
  { id: 'BC01', n: 1, titre: 'Mise en place d\'un projet', unites: ['U3'], epreuve: 'E3 Physique et technique des équipements et supports (PTES)', forme: 'écrit, 6 h, coef. 4' },
  { id: 'BC02', n: 2, titre: 'Mise en œuvre des savoir-faire d\'ingénierie et d\'exploitation', unites: ['U4'], epreuve: 'E4 Techniques et mise en œuvre (TMO)', forme: 'CCF, 2 situations pratiques, coef. 4' },
  { id: 'BC03', n: 3, titre: 'Participation à une production audiovisuelle', unites: ['U51', 'U52'], epreuve: 'E5 Projet à caractère professionnel (E51) et son environnement économique et juridique (E52)', forme: 'revues de production et oral, coef. 4 + 1' },
  { id: 'BC04', n: 4, titre: 'Analyse de situation professionnelle', unites: ['U6'], epreuve: 'E6 Situation en milieu professionnel', forme: 'oral sur le stage, coef. 1' },
];

/** modules qui comblent les compétences absentes ou incomplètes (ROADMAP.md) */
export const MODULES = {
  M2: 'La commande du diffuseur',
  M3: 'Après le coup de sifflet',
  M4: 'Recette et maintenance',
  M5: 'Plateau TV',
  M6: 'Entrepôt',
  M7: 'Nodal et régie finale',
  M8: 'Conférence et reportage',
};

/** les savoir-faire de l'option TIEE (référentiel, pages 104 à 118) */
/** @type {Record<string, string>} */
export const SAVOIR_FAIRE = {
  SF01: 'Comprendre et interpréter la demande technique et les intentions de réalisation ou de production.',
  SF02: 'Mobiliser ses connaissances culturelles, artistiques et techniques en relation avec le projet.',
  SF03: 'Identifier les possibilités des équipements.',
  SF04: 'Identifier les besoins.',
  SF05: 'Collecter des informations complètes.',
  SF06: 'Formuler une analyse argumentée.',
  SF07: 'Rechercher des solutions de manière non exhaustive.',
  SF08: 'Respecter les contraintes et argumenter les solutions envisagées.',
  SF09: 'Choisir les solutions et les outils conformes aux besoins exprimés.',
  SF10: 'Communiquer sur les moyens utilisés (anglais, français).',
  SF11: 'Élaborer une carte heuristique.',
  SF12: 'Proposer des solutions et des outils conformes aux besoins exprimés.',
  SF13: 'Argumenter le choix des solutions.',
  SF14: 'Choisir les moyens de communication adaptés.',
  SF15: 'Communiquer sur les moyens utilisés (anglais, français).',
  SF16: 'Élaborer les différents synoptiques relatifs aux travaux d\'ingénierie.',
  SF17: 'Caractériser l\'information (débit, format).',
  SF18: 'S\'approprier la documentation technique.',
  SF19: 'Préparer le matériel et le conditionner en fonction du lieu d\'utilisation et de sa disponibilité.',
  SF20: 'Respecter la compatibilité entre les différents équipements et/ou systèmes interconnectés.',
  SF21: 'Installer les équipements, réaliser les connexions conformément à la description du système technique donnée (schéma de câblage, schéma d\'implantation intégrant la notion d\'ergonomie) en respectant les règles de sécurité.',
  SF22: 'Assurer la mise en réseau des équipements et/ou des systèmes.',
  SF23: 'Équilibrer la distribution électrique.',
  SF24: 'Réaliser une installation (du point de vue sécurité) conforme à la réglementation en vigueur.',
  SF25: 'Assurer la sécurisation des points sensibles.',
  SF26: 'Effectuer les mesures nécessaires au bon fonctionnement du système (avant exploitation).',
  SF27: 'Analyser et interpréter les résultats de ces mesures.',
  SF28: 'Effectuer les réglages d\'exploitation.',
  SF29: 'Vérifier l\'intégrité des données ou des signaux aux différentes interfaces et le respect des normes.',
  SF30: 'Configurer le poste d\'ingénieur vision.',
  SF31: 'Configurer (« set-ups ») et tester les équipements.',
  SF32: 'Organiser l\'ergonomie du poste de travail.',
  SF33: 'Administrer les serveurs et les réseaux.',
  SF34: 'Gérer l\'espace occupé par les données.',
  SF35: 'Respecter les processus.',
  SF36: 'Vérifier l\'état des supports (acquisition, fabrication, diffusion).',
  SF37: 'Vérifier les contenus des « playlists ».',
  SF38: 'Anticiper les situations à risque dans l\'archivage.',
  SF39: 'Administrer les métadonnées liées au signal (audio, vidéo, droits…).',
  SF40: 'Contrôler l\'intégrité des données.',
  SF41: 'Contrôler en permanence les éléments transférés.',
  SF42: 'Contrôler et assurer la qualité et la conformité des informations (image, son et métadonnées) le long de la chaîne d\'exploitation.',
  SF43: 'Assurer les commutations au nodal.',
  SF44: 'Établir des fiches de tests, de résultats de mesures.',
  SF45: 'Effectuer les mesures nécessaires au bon fonctionnement du système.',
  SF46: 'Appliquer les procédures d\'identification d\'éléments défectueux.',
  SF47: 'Assurer la recette des matériels.',
  SF48: 'Effectuer les tests et essais.',
  SF49: 'Tester les effets.',
  SF50: 'Respecter les choix esthétiques et les contraintes techniques.',
  SF51: 'Rédiger les documents relatifs à la préparation et à l\'exécution des effets spéciaux (générateurs d\'effets ou stations informatiques dédiées).',
  SF52: 'L\'installation (configuration des équipements, éclairage) permet de réaliser l\'effet recherché conformément aux intentions artistiques.',
  SF53: 'Réserver des matériels opérationnels et transportables (technique, assurance, transport, consommables, gestion…).',
  SF54: 'Réceptionner les matériels.',
  SF55: 'Préparer le matériel avec précision et exhaustivité et le conditionner en fonction du lieu et des conditions d\'utilisation.',
  SF56: 'Assurer et gérer les flux et les compatibilités entre équipements.',
  SF57: 'Mettre en œuvre et rendre opérationnel le système (régie, car de transmission ou de réception…).',
  SF58: 'Choisir les moyens adaptés aux besoins exprimés (support, format, codec…).',
  SF59: 'Effectuer les mesures nécessaires au bon fonctionnement du système.',
  SF60: 'Diagnostiquer les dysfonctionnements au travers des procédures d\'identification.',
  SF61: 'Analyser les résultats des mesures, les interpréter et établir des comptes rendus d\'incidents précisant les « écarts ».',
  SF62: 'Respecter les intentions artistiques.',
  SF63: 'Veiller à la cohérence de la qualité des images.',
  SF64: 'Rendre opérationnelles les alternatives techniques ou organisationnelles proposées.',
  SF65: 'Établir des comptes rendus d\'intervention précisant les « écarts » par rapport aux solutions prévues ou au planning prévisionnel.',
  SF66: 'Expliquer les impacts d\'une solution alternative.',
  SF67: 'Réaliser la liaison.',
  SF68: 'Identifier les signaux à transmettre.',
  SF69: 'Assurer la gestion de la réception ou de l\'envoi du flux d\'information en respectant les procédures.',
  SF70: 'Définir la priorité des sources en fonction des événements.',
  SF71: 'Évaluer les débits d\'information et hiérarchiser les priorités.',
  SF72: 'Effectuer la commutation en sécurité sans interférer avec les autres liaisons.',
  SF73: 'Assurer l\'enchaînement entre plateaux ou l\'enregistrement.',
  SF74: 'Exploiter les possibilités de la régie et du mélangeur.',
  SF75: 'Identifier les points sensibles de l\'installation.',
  SF76: 'Ajouter au système en place des solutions de sécurité.',
  SF77: 'Communiquer avec les utilisateurs (en anglais ou en français).',
  SF78: 'Rechercher les effets.',
  SF79: 'Mettre en œuvre les effets.',
  SF80: 'Évaluer la conformité technique de l\'ensemble.',
  SF81: 'Travailler en collaboration avec le réalisateur.',
  SF82: 'Mesurer le signal.',
  SF83: 'Paramétrer une caméra.',
  SF84: 'Utiliser les outils de correction.',
  SF85: 'Argumenter les résultats obtenus.',
  SF86: 'Analyser la demande.',
  SF87: 'Faire les mesures.',
  SF88: 'Répertorier les défauts et les corriger en respectant le travail du monteur et la demande artistique.',
  SF89: 'Travailler en collaboration avec le monteur et le technicien son.',
  SF90: 'Rendre conforme le PAD en respectant la norme de diffusion et renseigner la fiche PAD.',
  SF91: 'Indexer des éléments de programme.',
  SF92: 'Classifier et assembler des éléments.',
  SF93: 'Planifier les opérations d\'entretien et de maintenance.',
  SF94: 'Utiliser les outils de gestion de stock.',
  SF95: 'Effectuer des tests de bon fonctionnement.',
  SF96: 'Effectuer la mesure préventive.',
  SF97: 'Sous-traiter la mesure préventive.',
  SF98: 'Constater les dysfonctionnements.',
  SF99: 'Déduire les sources de défauts et agir avec méthode.',
  SF100: 'Organiser les opérations de maintenance de niveau 3 (changement d\'élément défectueux).',
  SF101: 'Après détection du défaut, remplacer l\'élément défectueux et tester le système.',
  SF102: 'Réaliser un document d\'intervention.',
  SF103: 'Estimer le coût de la maintenance.',
  SF104: 'Former les utilisateurs avec une présentation systémique et adaptée au public concerné.',
  SF105: 'Contrôler les divers équipements et les câblages correspondants par rapport à la commande.',
  SF106: 'Collaborer avec les prestataires et les fournisseurs.',
  SF107: 'Réaliser les tests de mise en route.',
  SF108: 'Paramétrer les machines.',
  SF109: 'Fournir des indicateurs pertinents pour les décisions de renouvellement (usures, frais de maintenance).',
  SF110: 'Participer aux procédures d\'appel d\'offres.',
  SF111: 'Faire un choix, l\'argumenter, le justifier techniquement et financièrement parmi des solutions proposées.',
  SF112: 'Donner des indications précises sur les nouvelles orientations techniques.',
};

/** les familles de savoirs (référentiel, pages 129 à 135) */
/** @type {Record<string, string>} */
export const FAMILLES_SAVOIRS = {
  A: 'Appropriation et préparation du projet', B: 'Gestion de projet', C: 'Signaux', D: 'Installation des moyens et des outils audio et vidéo',
  E: 'Stockage', F: 'Transmissions', G: 'Image', H: 'Régie vidéo', I: 'Son', J: 'Montage vidéo', K: 'Informatique, liaisons, transferts, réseaux', L: 'Sécurité',
};
/**
 * Les savoirs et le niveau taxonomique demandé à l'option TIEE (1 : information ; 2 : expression ; 3 : maîtrise
 * d'outils ; 4 : maîtrise méthodologique ; null : non lisible dans le tableau). Référentiel, pages 127 à 135.
 */
/** @type {Record<string, { t: string, niveau: number | null }>} */
export const SAVOIRS = {
  A1: { t: 'Genres de production', niveau: 3 }, A2: { t: 'Modes de diffusion', niveau: 3 },
  A3: { t: 'Principe de planification d\'un projet (plan de tournage, postproduction, diffusion, archivage)', niveau: 3 },
  A4: { t: 'Workflow : processus industriel et/ou administratif, cycle de vie du produit', niveau: 4 },
  A5: { t: 'Vocabulaire technique et expression en français et en anglais, à l\'écrit et à l\'oral, en situation professionnelle', niveau: 4 },
  A6: { t: 'Fonctionnalités des outils bureautiques (tableur, traitement de texte, PREAO, DAO)', niveau: 3 },
  A7: { t: 'Représentation d\'un schéma fonctionnel', niveau: 4 }, A8: { t: 'Représentation des schémas d\'implantation', niveau: 4 },
  A9: { t: 'Règles de lecture des plans de bâtiments', niveau: 3 }, A10: { t: 'Représentation d\'un schéma de câblage', niveau: 4 },
  A11: { t: 'Fonctionnalités des logiciels de DAO (représentation des différents schémas)', niveau: 4 }, A12: { t: 'Contenu d\'un rapport de tournage', niveau: 2 },
  A13: { t: 'Pratiques de production, de postproduction et de diffusion', niveau: 3 }, A14: { t: 'Histoire du son et de l\'image', niveau: 2 },
  A15: { t: 'Musicologie, organologie', niveau: 2 }, A16: { t: 'Sémiologie du son et de l\'image', niveau: 3 }, A17: { t: 'Esthétiques sonores et visuelles', niveau: 2 },
  A18: { t: 'Acoustique des lieux de production', niveau: 2 }, A19: { t: 'Scénographie et méthodologie du découpage technique', niveau: 2 },
  A20: { t: 'Techniques d\'expression artistique (jeu d\'acteur)', niveau: 3 }, A21: { t: 'Techniques de narration des différents genres de production', niveau: 3 },
  A22: { t: 'Outils de communication numérique et de travail collaboratif', niveau: 3 }, A23: { t: 'Législation informatique et libertés', niveau: 3 },
  A24: { t: 'Performances des postes de travail informatiques (processeur, chipset, cartes graphiques, mémoires, sauvegardes, périphériques)', niveau: 4 },
  A25: { t: 'Fonctionnalités des progiciels de gestion', niveau: 1 }, A26: { t: 'Fonctionnalités des systèmes de gestion de bases de données', niveau: 3 },
  A27: { t: 'Structure des bases de données (mise en œuvre dans un DMAM)', niveau: 3 }, A28: { t: 'Mise en place d\'une démarche de réflexion collective', niveau: 2 },
  B1: { t: 'Gestion administrative d\'une structure permanente', niveau: 2 }, B2: { t: 'Outils de gestion et d\'organisation d\'une structure de production', niveau: 1 },
  B3: { t: 'Assurance des risques professionnels', niveau: 3 }, B4: { t: 'Droit et gestion des contrats commerciaux', niveau: 2 }, B5: { t: 'Négociation commerciale', niveau: 2 },
  B6: { t: 'Gestion et coordination des ressources humaines d\'un projet', niveau: 2 }, B7: { t: 'Gestion et coordination techniques d\'un projet', niveau: 3 },
  B8: { t: 'Gestion et coordination financières d\'un projet', niveau: 2 }, B9: { t: 'Gestion et coordination administratives d\'un projet', niveau: 2 },
  B10: { t: 'Gestion et coordination logistiques d\'un projet', niveau: 3 }, B11: { t: 'Droit et gestion des contrats', niveau: 2 }, B12: { t: 'Droit du travail et droit social', niveau: 3 },
  B13: { t: 'Droit d\'auteur, droits voisins et code de la propriété intellectuelle', niveau: 3 }, B14: { t: 'Accords collectifs et professionnels, principes de la répartition des droits', niveau: 2 },
  B15: { t: 'Connaissances juridiques et usages professionnels des mentions légales', niveau: 3 }, B16: { t: 'Contrats de l\'audiovisuel', niveau: 3 },
  B17: { t: 'Législation relative aux droits des personnes', niveau: 3 }, B18: { t: 'Règles administratives ou juridiques applicables à l\'occupation des lieux de tournage', niveau: 3 },
  B19: { t: 'Gestion d\'équipes', niveau: 2 }, B20: { t: 'Gestion budgétaire (plan de trésorerie, prévisionnel et réalisé)', niveau: 2 }, B21: { t: 'Gestion comptable et financière', niveau: 1 },
  B22: { t: 'Éléments de fiscalité', niveau: 1 }, B23: { t: 'Communication et promotion commerciales', niveau: 1 },
  B24: { t: 'Gestion et actualisation de l\'information, méthodologie de veille (technologique, économique et juridique)', niveau: 3 },
  C1: { t: 'Caractérisation du signal analogique (bande passante, rapport signal sur bruit)', niveau: 4 },
  C2: { t: 'Paramètres de la chaîne d\'acquisition du signal (échantillonnage, quantification…)', niveau: 4 },
  C3: { t: 'Caractérisation du signal numérique (diagramme de l\'œil, gigue, constellations)', niveau: 4 }, C4: { t: 'Canal de transmission (capacité, débit)', niveau: 4 },
  C5: { t: 'Multiplexage temporel et fréquentiel', niveau: 4 }, C6: { t: 'Transmission du signal en bande de base et en bande transposée', niveau: 4 },
  C7: { t: 'Supports de transmission (filaire, hertzien, optique) et connectique associée', niveau: 4 }, C8: { t: 'Techniques de compression (son et image)', niveau: 4 },
  C9: { t: 'Interfaces numériques (SDI SD et HD, HDMI, IEEE 1394, AES…)', niveau: 4 }, C10: { t: 'Normes d\'exploitation des signaux', niveau: 4 },
  C11: { t: 'Dispositifs (appareils et logiciels) de contrôle, de surveillance, de mesure et de réglage (vidéo, couleurs interdites, lumière…)', niveau: 4 },
  C12: { t: 'Appareils de mesure audio (vecteurscope audio, phasemètre, PPM, loudness meter, true peak meter, sonomètre, analyseur de spectre)', niveau: 3 },
  D1: { t: 'Moyens d\'éclairage (sources, corrections)', niveau: 2 }, D2: { t: 'Moyens de captation du son et de l\'image', niveau: 4 }, D3: { t: 'Moyens de montage', niveau: 3 },
  D4: { t: 'Moyens d\'affichage', niveau: 3 }, D5: { t: 'Calibrage et étalonnage des moyens d\'affichage', niveau: 3 }, D6: { t: 'Dispositifs de commutation et de brassage', niveau: 4 },
  E1: { t: 'Moyens de stockage et d\'archivage (NAS, SAN, bande, disque optique…), sécurité des données', niveau: 4 },
  E2: { t: 'Matériels de lecture et d\'enregistrement (bande, disque optique, carte mémoire, disque dur)', niveau: 4 }, E3: { t: 'Gestion des médias numériques (DMAM)', niveau: 4 },
  E4: { t: 'Formats de métadonnées', niveau: 4 }, E5: { t: 'Formats média numériques (compressés ou non)', niveau: 4 }, E6: { t: 'Formats de fichiers d\'échange et de transport', niveau: 4 },
  E7: { t: 'Règles de nommage des données, nomenclatures pour lister, identifier et indexer', niveau: 3 },
  F1: { t: 'Moyens de diffusion (streaming, DVD, Blu-ray…)', niveau: 4 }, F2: { t: 'Moyens de transmission (émetteur DVB, émetteur fibre, liaison HF…)', niveau: 4 },
  F3: { t: 'Moyens de réception (IRD, set-top box, récepteur DVB, liaison HF…)', niveau: 4 }, F4: { t: 'Moyens de transmission audio (réseaux audio, dispositifs HF)', niveau: 2 },
  F5: { t: 'Équipements d\'émission et de réception (antennes, paraboles, positionneur, analyseur de spectre, démodulateur)', niveau: 3 },
  G1: { t: 'Techniques de prise de vue', niveau: 3 }, G2: { t: 'Techniques d\'éclairage', niveau: 3 }, G3: { t: 'Spécificités de l\'éclairage en studio', niveau: 3 },
  G4: { t: 'Techniques de mesure (réflectométrie, thermocolorimétrie, éclairement, luminance, colorimétrie)', niveau: 3 }, G5: { t: 'Systèmes de contrôle d\'éclairage (jeux d\'orgue)', niveau: 3 },
  G6: { t: 'Technologie des caméras', niveau: 3 }, G7: { t: 'Technologie des objectifs des caméras, optiques', niveau: 3 }, G8: { t: 'Voies de commande des caméras et reports', niveau: 3 },
  G9: { t: 'Réglages d\'exploitation des caméras', niveau: 4 }, G10: { t: 'Machinerie (steady, travelling, grue…)', niveau: 3 },
  H1: { t: 'Chaîne de traitement, de production et de diffusion', niveau: 4 }, H2: { t: 'Procédures et contraintes d\'exploitation', niveau: 4 }, H3: { t: 'Réglages d\'exploitation', niveau: 4 },
  H4: { t: 'Dispositifs de trucage et d\'effets de direct (mélangeur, DVE…)', niveau: 4 }, H5: { t: 'Techniques et méthodologies de trucage en direct', niveau: 4 },
  H6: { t: 'Méthodes de recherche de défauts (câblage et configuration de l\'installation)', niveau: 4 },
  I1: { t: 'Systèmes de réseaux d\'ordre', niveau: 2 }, I2: { t: 'Logiciels de configuration de matrice d\'ordre', niveau: 2 }, I3: { t: 'Équipements de captation audio', niveau: 3 },
  I4: { t: 'Équipements de montage audio', niveau: 3 }, I5: { t: 'Équipements de traitement audio (timbre, dynamique, temporel)', niveau: 2 }, I6: { t: 'Équipements de mixage', niveau: 3 },
  I7: { t: 'Équipements de diffusion audio (enceintes)', niveau: 2 }, I8: { t: 'Logiciels de configuration des systèmes de diffusion', niveau: 2 },
  I9: { t: 'Techniques et méthodologie de captation audio', niveau: 3 }, I10: { t: 'Organisation d\'une séance d\'enregistrement', niveau: 2 },
  I11: { t: 'Techniques et méthodologie du traitement sonore', niveau: 3 }, I12: { t: 'Techniques et méthodologie du montage son', niveau: 2 },
  I13: { t: 'Techniques et méthodologie du mixage', niveau: 2 }, I14: { t: 'Codage et décodage audio', niveau: 3 },
  J1: { t: 'Techniques de montage audiovisuel', niveau: 3 }, J2: { t: 'Caractéristiques des logiciels de montage', niveau: 3 }, J3: { t: 'Traitements graphiques', niveau: 3 },
  J4: { t: 'Techniques et outils de compositing', niveau: 3 }, J5: { t: 'Options des logiciels de montage et de compositing (plug-ins, paramétrage, modèles)', niveau: 3 },
  J6: { t: 'Logiciels d\'étalonnage et de correction colorimétrique', niveau: 4 }, J7: { t: 'Authoring DVD et Blu-ray, finalisation', niveau: 4 },
  K1: { t: 'Modèle OSI', niveau: 4 }, K2: { t: 'Topologie des réseaux', niveau: 3 }, K3: { t: 'Infrastructures des réseaux locaux et étendus (Ethernet, Fibre Channel…)', niveau: 3 },
  K4: { t: 'Protocoles (ARP, TCP/IP, HTTP, HTTPS, FTP, FTPS, RTSP…)', niveau: 3 }, K5: { t: 'Diagramme de déploiement', niveau: 4 },
  K6: { t: 'Systèmes d\'exploitation serveurs (gestion des usagers, des services, sécurité)', niveau: 4 },
  K7: { t: 'Sécurité (intrusion, pertes de données, couverture et prévention des risques…)', niveau: 3 }, K8: { t: 'Systèmes d\'exploitation des postes clients', niveau: 4 },
  K9: { t: 'Langages à balises (HTML, XML)', niveau: 3 }, K10: { t: 'Langages d\'exécution séquentiels (scripts, macros)', niveau: null },
  L1: { t: 'Production d\'énergie électrique et alimentation autonome', niveau: 4 }, L2: { t: 'Distribution de l\'énergie électrique (monophasé, triphasé, régime de neutre)', niveau: 4 },
  L3: { t: 'Protection des personnes et des biens au niveau électrique', niveau: 4 }, L4: { t: 'Niveaux d\'habilitation électrique', niveau: 4 },
  L5: { t: 'Règles de l\'art dans le câblage (CEM conduite et rayonnée…)', niveau: 4 }, L6: { t: 'Gestes et postures', niveau: 3 }, L7: { t: 'Ergonomie du poste de travail', niveau: 4 },
  L8: { t: 'Sécurité des lieux et locaux d\'archivage', niveau: 3 }, L9: { t: 'Prévention des risques du travail en hauteur', niveau: 3 },
  L10: { t: 'Prévention des risques de chute des équipements implantés en hauteur', niveau: 3 }, L11: { t: 'Sécurité et contraintes du transport national et international', niveau: 2 },
  L12: { t: 'Réglementation des établissements recevant du public (ERP)', niveau: 2 },
};
/** les niveaux taxonomiques du référentiel (page 127) */
export const NIVEAUX_SAVOIR = { 1: 'information', 2: 'expression', 3: 'maîtrise d\'outils', 4: 'maîtrise méthodologique' };
export const familleDe = (/** @type {string} */ code) => FAMILLES_SAVOIRS[code[0]] || '';

/** @typedef {'bien' | 'partie' | 'absent'} Couverture */
/**
 * @typedef {object} Competence
 * @property {string} code numéro officiel, C1 à C39
 * @property {number} n
 * @property {string} titre intitulé du référentiel
 * @property {'U3' | 'U4' | 'U51' | 'U52' | 'U6'} unite unité (et donc épreuve) qui l'évalue (page 190)
 * @property {number} bloc bloc de la fiche RNCP (1 à 4)
 * @property {string} ancien le numéro du simulateur jusqu'à la v19.22 (1.1 à 4.5)
 * @property {string} taches tâches du référentiel des activités professionnelles (pages 104 à 118)
 * @property {string[]} sf savoir-faire (SAVOIR_FAIRE)
 * @property {string[]} savoirs savoirs associés (SAVOIRS)
 * @property {string} attendu les résultats attendus (pages 157 à 164), en une phrase
 * @property {Couverture} couverture
 * @property {(keyof typeof MODULES)[]} prevu modules qui la complèteront
 */
/** @type {Competence[]} */
export const COMPETENCES = [
  { code: 'C1', n: 1, titre: 'S\'approprier le dossier initial', unite: 'U51', bloc: 3, ancien: '3.1', taches: 'T1.1.1, T4.2.1', sf: ['SF01', 'SF02', 'SF03'], savoirs: ['A1', 'A2', 'A3', 'A5', 'L1', 'D1', 'D2', 'D3', 'H1', 'F1', 'F3', 'D4', 'E1', 'G10'],
    attendu: 'La nature du projet (type, lieux), ses aspects artistiques, techniques et financiers sont compris et interprétés.', couverture: 'partie', prevu: ['M2'] },
  { code: 'C2', n: 2, titre: 'Identifier le besoin en réponse aux demandes de la production', unite: 'U52', bloc: 3, ancien: '3.2', taches: 'T1.1.2, T1.1.4', sf: ['SF04', 'SF05', 'SF06'], savoirs: ['A1', 'A2'],
    attendu: 'Les attentes concrètes du chef de projet sont identifiées, analysées et interprétées : les livrables sont constitués.', couverture: 'partie', prevu: ['M2'] },
  { code: 'C3', n: 3, titre: 'Situer le projet dans son contexte', unite: 'U51', bloc: 3, ancien: '3.3', taches: 'T1.2.2', sf: ['SF07', 'SF08', 'SF09', 'SF10', 'SF11'], savoirs: ['L1', 'D1', 'D2', 'D3', 'D6', 'E1', 'F1', 'F3', 'D4', 'A5'],
    attendu: 'L\'environnement du projet et ses premières contraintes (techniques, artistiques, commerciales, financières) sont déterminés ; sa nature et sa destination sont cernées.', couverture: 'partie', prevu: ['M2'] },
  { code: 'C4', n: 4, titre: 'Choisir des solutions', unite: 'U51', bloc: 3, ancien: '3.4', taches: 'T1.1.3, T1.1.5, T1.2.1, T1.2.4', sf: ['SF12', 'SF13'], savoirs: ['L1', 'D1', 'D2', 'D3', 'E1', 'F1', 'F3', 'D4', 'H2', 'H3', 'C4', 'E6', 'C8', 'H1', 'C7', 'C6', 'C5', 'H4'],
    attendu: 'Les solutions techniques et les outils sont proposés et argumentés.', couverture: 'partie', prevu: ['M2'] },
  { code: 'C5', n: 5, titre: 'Communiquer avec les principaux acteurs', unite: 'U6', bloc: 4, ancien: '4.1', taches: 'T1.1.5, T1.2.3', sf: ['SF14', 'SF15'], savoirs: ['A5'],
    attendu: 'La communication écrite ou orale, en français et en anglais, est assurée entre les acteurs du projet.', couverture: 'partie', prevu: ['M2'] },
  { code: 'C6', n: 6, titre: 'Prendre en compte et traduire les contraintes', unite: 'U3', bloc: 1, ancien: '1.1', taches: 'T1.2.1, T2.1', sf: ['SF16', 'SF17', 'SF18'], savoirs: ['K5', 'A7', 'A10', 'A11', 'K1'],
    attendu: 'Les synoptiques, schémas de câblage et d\'implantation (avec l\'ergonomie) sont élaborés ; les supports et formats de fichiers sont identifiés et conformes aux normes.', couverture: 'partie', prevu: ['M2', 'M6'] },
  { code: 'C7', n: 7, titre: 'Réunir et organiser les ressources et éléments nécessaires au projet', unite: 'U51', bloc: 3, ancien: '3.5', taches: 'T2.5, T2.8', sf: ['SF19'], savoirs: ['L1', 'D1', 'D2', 'D3', 'D4', 'H1', 'D6', 'E1', 'F1', 'F3'],
    attendu: 'Le matériel est préparé et conditionné ; les serveurs et réseaux sont administrés.', couverture: 'absent', prevu: ['M2', 'M6'] },
  { code: 'C8', n: 8, titre: 'Mettre en place et rendre opérant les moyens de production, de postproduction et de diffusion', unite: 'U4', bloc: 2, ancien: '2.1', taches: 'T4.2.1', sf: ['SF20', 'SF21', 'SF22', 'SF23'], savoirs: ['L1', 'D1', 'D2', 'D3', 'D4', 'F1', 'F3', 'E1', 'A4', 'C10', 'C8', 'E6', 'K3', 'K4', 'K6', 'K7'],
    attendu: 'Les équipements et systèmes sont installés et configurés ; synoptiques, schémas d\'implantation et de câblage sont réactualisés ; le dossier des ouvrages exécutés (DOE, « tel que construit ») est délivré.', couverture: 'partie', prevu: ['M3', 'M7'] },
  { code: 'C9', n: 9, titre: 'Veiller à la sécurité des biens et des personnes', unite: 'U6', bloc: 4, ancien: '4.2', taches: 'T2.9', sf: ['SF24', 'SF25'], savoirs: ['K7', 'L2', 'L5'],
    attendu: 'L\'installation technique respecte les règles de sécurité ; les fiches de sécurité sont élaborées.', couverture: 'partie', prevu: ['M4'] },
  { code: 'C10', n: 10, titre: 'Vérifier la mise en conformité des signaux tout au long de la chaîne de production, de postproduction et de diffusion', unite: 'U4', bloc: 2, ancien: '2.2', taches: 'T2.2, T2.7, T4.1.5', sf: ['SF26', 'SF27', 'SF28', 'SF29', 'SF30'], savoirs: ['C11', 'C12', 'C3', 'C2', 'C1'],
    attendu: 'La qualité, la conformité et l\'intégrité des informations (image, son, métadonnées) sont contrôlées et garanties tout au long de la chaîne ; le poste d\'ingénieur vision est configuré.', couverture: 'bien', prevu: [] },
  { code: 'C11', n: 11, titre: 'Mettre en place et paramétrer les outils informatiques d\'un poste', unite: 'U4', bloc: 2, ancien: '2.3', taches: 'T2.3, T4.1.4, T4.2.1, T4.2.2', sf: ['SF31', 'SF32'], savoirs: ['D5', 'K8', 'A24', 'J2', 'J5'],
    attendu: 'Les performances des postes de travail sont adaptées aux logiciels utilisés ; les « set-ups » sont configurés et testés.', couverture: 'partie', prevu: ['M3'] },
  { code: 'C12', n: 12, titre: 'Administrer le réseau', unite: 'U51', bloc: 3, ancien: '3.6', taches: 'T2.4, T3.2.4', sf: ['SF33', 'SF34'], savoirs: ['K2', 'K3', 'K4', 'K6', 'K7', 'K8', 'K9', 'H1'],
    attendu: 'Les réseaux sont administrés et les espaces de stockage partagés adaptés aux besoins des utilisateurs.', couverture: 'bien', prevu: [] },
  { code: 'C13', n: 13, titre: 'Gérer le « workflow »', unite: 'U51', bloc: 3, ancien: '3.7', taches: 'T3.1.1, T3.2.1, T3.2.3, T3.2.6', sf: ['SF35', 'SF36', 'SF37', 'SF38'], savoirs: ['A27', 'A4', 'C10', 'C1'],
    attendu: 'Les processus de gestion des médias sont organisés pour harmoniser les échanges entre applications ; la distribution des contenus est automatisée.', couverture: 'partie', prevu: ['M3'] },
  { code: 'C14', n: 14, titre: 'Gérer le « dataflow »', unite: 'U4', bloc: 2, ancien: '2.4', taches: 'T2.7', sf: ['SF39', 'SF40'], savoirs: ['K9', 'E5', 'E6'],
    attendu: 'Les données sont contrôlées, organisées, indexées, décrites, retrouvées et distribuées en environnement multi-utilisateurs ; l\'accès est sécurisé à chaque étape.', couverture: 'partie', prevu: ['M3'] },
  { code: 'C15', n: 15, titre: 'Gérer le « médiaflow »', unite: 'U4', bloc: 2, ancien: '2.5', taches: 'T3.2.5', sf: ['SF41', 'SF42', 'SF43', 'SF44'], savoirs: ['E6', 'H1', 'D6', 'C11', 'C12'],
    attendu: 'Les informations d\'un fichier (codec, format, durée, résolution, débit) sont vérifiées à chaque étape ; les commutations au nodal sont assurées ; les comptes rendus de mesures sont rédigés.', couverture: 'partie', prevu: ['M3'] },
  { code: 'C16', n: 16, titre: 'Réceptionner les équipements', unite: 'U6', bloc: 4, ancien: '4.3', taches: 'T4.2.5', sf: ['SF45', 'SF46', 'SF47', 'SF48'], savoirs: ['C11', 'C12'],
    attendu: 'Le système est opérationnel et conforme au cahier des charges.', couverture: 'partie', prevu: ['M4', 'M6'] },
  { code: 'C17', n: 17, titre: 'Mettre en place et paramétrer les dispositifs de trucage et d\'effets', unite: 'U4', bloc: 2, ancien: '2.6', taches: 'T2.6, T4.2.1', sf: ['SF49', 'SF50', 'SF51', 'SF52'], savoirs: ['H4', 'G3', 'G4', 'G5', 'G6', 'G8', 'G9'],
    attendu: 'Les dispositifs de trucage et d\'effets (DVE, incrustateur) sont opérationnels, les effets programmés et testés conformément aux intentions artistiques.', couverture: 'partie', prevu: ['M5'] },
  { code: 'C18', n: 18, titre: 'Lister les matériels et les consommables', unite: 'U52', bloc: 3, ancien: '3.8', taches: 'T4.1.9, T4.2.7', sf: ['SF53'], savoirs: ['A5', 'L1', 'D1', 'D2', 'D3', 'D4', 'H1', 'D6', 'F1', 'F3', 'E1', 'G10'],
    attendu: 'La liste des équipements et des consommables nécessaires au projet est établie.', couverture: 'partie', prevu: ['M6'] },
  { code: 'C19', n: 19, titre: 'Tester les matériels', unite: 'U51', bloc: 3, ancien: '3.9', taches: 'T2.5, T2.8, T4.2.5, T4.2.9', sf: ['SF54', 'SF55'], savoirs: ['A5', 'L1', 'D1', 'D2', 'D3', 'D6', 'F1', 'F3', 'E1', 'G10'],
    attendu: 'Les équipements sont vérifiés, préparés et conditionnés pour le transport.', couverture: 'bien', prevu: [] },
  { code: 'C20', n: 20, titre: 'Rendre opérant les équipements de réception, d\'enregistrement et d\'acquisition', unite: 'U4', bloc: 2, ancien: '2.7', taches: 'T3.1.2, T3.2.2, T4.2.1', sf: ['SF56', 'SF57'], savoirs: ['F5', 'E1', 'F1', 'F3'],
    attendu: 'Les équipements de réception, d\'enregistrement et d\'acquisition sont mis en œuvre et rendus opérants.', couverture: 'bien', prevu: [] },
  { code: 'C21', n: 21, titre: 'Assurer la qualité de service des moyens d\'exploitation', unite: 'U3', bloc: 1, ancien: '1.2', taches: 'T3.1.7, T3.1.8, T3.2.5', sf: ['SF58'], savoirs: ['D6', 'H1', 'H2', 'C4', 'E6', 'E7', 'C8'],
    attendu: 'Les moyens d\'exploitation sont rendus opérants, adaptés aux besoins (support, format, codec).', couverture: 'bien', prevu: [] },
  { code: 'C22', n: 22, titre: 'Assurer la supervision des équipements', unite: 'U4', bloc: 2, ancien: '2.8', taches: 'T3.1.5', sf: ['SF59', 'SF60', 'SF61'], savoirs: ['C11', 'C12', 'C10'],
    attendu: 'Les mesures sont réalisées et interprétées ; les dysfonctionnements sont analysés et réparés ; un compte rendu d\'incident est établi.', couverture: 'partie', prevu: [] },
  { code: 'C23', n: 23, titre: 'Exploiter les équipements', unite: 'U4', bloc: 2, ancien: '2.9', taches: 'T3.1.4, T3.1.6', sf: ['SF62', 'SF63'], savoirs: ['C11', 'C12', 'G6', 'G8', 'G10', 'G9', 'G7', 'G1', 'G2', 'H3', 'G5'],
    attendu: 'Les équipements sont exploités en respectant les intentions artistiques et la cohérence de la qualité des images.', couverture: 'bien', prevu: [] },
  { code: 'C24', n: 24, titre: 'Adapter les moyens, mettre en œuvre des solutions alternatives', unite: 'U51', bloc: 3, ancien: '3.10', taches: 'T3.1.7', sf: ['SF64', 'SF65', 'SF66'], savoirs: ['H1', 'H2', 'D6'],
    attendu: 'Une solution alternative est choisie et mise en place ; un compte rendu d\'intervention est établi.', couverture: 'bien', prevu: [] },
  { code: 'C25', n: 25, titre: 'Interconnecter les équipements en vue de l\'échange ou de la transmission de flux d\'information', unite: 'U4', bloc: 2, ancien: '2.10', taches: 'T2.2, T2.4, T2.7, T3.2.1, T3.2.3, T3.2.5, T3.3.1, T3.3.2, T3.3.4, T4.1.1, T4.1.5, T4.1.6', sf: ['SF67', 'SF68'], savoirs: ['C7', 'C4', 'C6', 'C5', 'D6', 'C11', 'C12', 'F5', 'F1', 'F3'],
    attendu: 'Les signaux à transmettre sont identifiés et transmis.', couverture: 'bien', prevu: [] },
  { code: 'C26', n: 26, titre: 'Réceptionner ou envoyer les flux d\'information', unite: 'U4', bloc: 2, ancien: '2.11', taches: 'T3.2.2, T3.2.3, T3.2.5', sf: ['SF69'], savoirs: ['A5', 'L2', 'C7', 'C4', 'C6', 'C5', 'D6', 'C11', 'C12', 'F5', 'F1', 'F3'],
    attendu: 'Les flux d\'information sont reçus et stockés en respectant les procédures.', couverture: 'partie', prevu: ['M7', 'M8'] },
  { code: 'C27', n: 27, titre: 'Superviser les échanges entre les postes de travail et le serveur', unite: 'U3', bloc: 1, ancien: '1.3', taches: 'T3.2.6', sf: ['SF70', 'SF71'], savoirs: ['C8', 'C3', 'A4', 'C10', 'K2', 'C7', 'C4', 'C6', 'C5', 'D6', 'K4', 'K6', 'K7', 'E1', 'E2'],
    attendu: 'Les échanges entre les postes de travail et le serveur sont réalisés, les priorités définies selon les événements et les débits.', couverture: 'partie', prevu: ['M3'] },
  { code: 'C28', n: 28, titre: 'Connaître l\'organisation du nodal et répondre à la demande de communication', unite: 'U6', bloc: 4, ancien: '4.4', taches: 'T3.1.1', sf: ['SF72'], savoirs: ['H1', 'H2', 'D6', 'C4', 'E6', 'C8', 'F1', 'F3', 'F5'],
    attendu: 'L\'organisation du nodal est connue ; les communications sont réalisées sans interférer avec les autres liaisons.', couverture: 'partie', prevu: ['M7'] },
  { code: 'C29', n: 29, titre: 'Mettre en œuvre les conducteurs (régie finale ou réalisation d\'émissions)', unite: 'U51', bloc: 3, ancien: '3.11', taches: 'T3.3.2', sf: ['SF73', 'SF74'], savoirs: ['H1', 'H2', 'D6', 'C4', 'E6', 'C8', 'F1', 'F3', 'F5'],
    attendu: 'Le conducteur est mis en œuvre en respectant la demande.', couverture: 'partie', prevu: ['M5', 'M7'] },
  { code: 'C30', n: 30, titre: 'Anticiper les situations de dysfonctionnement pour assurer la continuité de service', unite: 'U51', bloc: 3, ancien: '3.12', taches: 'T3.3.3', sf: ['SF75', 'SF76', 'SF77'], savoirs: ['D6', 'F1', 'F3', 'F5', 'K3', 'K4', 'K6'],
    attendu: 'Les situations de dysfonctionnement sont identifiées ; des solutions de sécurité sont mises en place.', couverture: 'bien', prevu: [] },
  { code: 'C31', n: 31, titre: 'Assurer les « trucages » nécessaires au programme', unite: 'U4', bloc: 2, ancien: '2.12', taches: 'T3.1.3, T3.4.1, T3.4.2', sf: ['SF78', 'SF79', 'SF80', 'SF81'], savoirs: ['H4', 'G3', 'G4', 'G5', 'G1', 'G2'],
    attendu: 'Les effets en direct (DVE, incrustateur) sont réalisés conformément aux intentions artistiques.', couverture: 'bien', prevu: [] },
  { code: 'C32', n: 32, titre: 'Mettre en conformité les signaux', unite: 'U3', bloc: 1, ancien: '1.4', taches: 'T3.4.3', sf: ['SF82', 'SF83', 'SF84', 'SF85'], savoirs: ['A1', 'A2', 'A3', 'C10', 'E6', 'C8', 'C7', 'C4', 'C1', 'C5', 'D6', 'H2', 'H1', 'E1', 'E2'],
    attendu: 'La qualité, la conformité et l\'intégrité des informations (image, son, métadonnées) sont contrôlées et garanties tout au long de la chaîne.', couverture: 'bien', prevu: [] },
  { code: 'C33', n: 33, titre: 'Analyser et normaliser le support', unite: 'U51', bloc: 3, ancien: '3.13', taches: 'T3.4.4, T3.4.5, T3.4.6', sf: ['SF86', 'SF87', 'SF88', 'SF89', 'SF90'], savoirs: ['C11', 'C12', 'E6', 'C8', 'C10', 'E1', 'E2'],
    attendu: 'Le programme fini (PAD, master) respecte les normes du vecteur de diffusion ; la fiche de contrôle qualité est renseignée.', couverture: 'partie', prevu: ['M3'] },
  { code: 'C34', n: 34, titre: 'Archiver des éléments de programme', unite: 'U51', bloc: 3, ancien: '3.14', taches: 'T3.4.6, T3.4.7', sf: ['SF91', 'SF92'], savoirs: ['H2', 'H1', 'C4', 'E6', 'C8', 'D6', 'C11', 'C12', 'E1', 'E2'],
    attendu: 'Les éléments de programme sont enrichis de métadonnées et indexés pour des recherches plus rapides et un meilleur accès aux archives.', couverture: 'partie', prevu: ['M3'] },
  { code: 'C35', n: 35, titre: 'Garantir l\'opérationnalité d\'un système dans le cadre d\'une maintenance préventive', unite: 'U6', bloc: 4, ancien: '4.5', taches: 'T4.1.1, T4.1.5, T4.1.6, T4.1.9, T4.1.10, T4.2.2, T4.2.7, T4.2.8', sf: ['SF93', 'SF94', 'SF95', 'SF96', 'SF97'], savoirs: ['A5', 'C10', 'H2', 'H1', 'A10', 'L1', 'D1', 'D2', 'D3', 'D6', 'F1', 'F3', 'E1', 'G10', 'C4', 'E6', 'C8'],
    attendu: 'La maintenance préventive des équipements est assurée ; le stock des éléments de maintenance est assuré.', couverture: 'partie', prevu: ['M4'] },
  { code: 'C36', n: 36, titre: 'Diagnostiquer un dysfonctionnement dans le cadre d\'une maintenance curative', unite: 'U4', bloc: 2, ancien: '2.13', taches: 'T4.1.2, T4.1.3, T4.1.5, T4.1.6, T4.1.7, T4.2.3', sf: ['SF98', 'SF99', 'SF100', 'SF101', 'SF102', 'SF103'], savoirs: ['A5', 'D6', 'C11', 'C12', 'H2', 'H1', 'A7', 'H3', 'L1', 'D1', 'D2', 'D3', 'D4', 'F1', 'F3', 'E1', 'G10', 'C4', 'E6', 'C8'],
    attendu: 'Le dysfonctionnement est déterminé, la maintenance est assurée, un compte rendu d\'intervention est établi.', couverture: 'bien', prevu: [] },
  { code: 'C37', n: 37, titre: 'Maintenir les compétences techniques de l\'équipe des utilisateurs', unite: 'U51', bloc: 3, ancien: '3.15', taches: 'T4.1.8, T4.2.1, T4.2.4', sf: ['SF104'], savoirs: ['A5', 'H2', 'H1', 'L1', 'D1', 'D2', 'D3', 'D4', 'D6', 'F1', 'F3', 'E1', 'G10'],
    attendu: 'La forme et le contenu de la formation sont adaptés aux besoins et à la situation.', couverture: 'absent', prevu: ['M4'] },
  { code: 'C38', n: 38, titre: 'Mettre en œuvre les configurations techniques dans le cadre d\'une recette', unite: 'U4', bloc: 2, ancien: '2.14', taches: 'T4.2.1, T4.2.5', sf: ['SF105', 'SF106', 'SF107', 'SF108'], savoirs: ['A11', 'C9', 'C11', 'C12', 'C10', 'L4', 'C3', 'A5', 'L1', 'D1', 'D2', 'D3', 'D4', 'D6', 'F1', 'F3', 'E1', 'G10', 'L2', 'L5', 'L12'],
    attendu: 'Le dossier des ouvrages exécutés (DOE, « tel que construit ») est délivré après contrôle des équipements et des câblages, tests de mise en route et paramétrage.', couverture: 'partie', prevu: ['M4'] },
  { code: 'C39', n: 39, titre: 'Rechercher de manière non exhaustive des solutions compatibles avec les projets d\'investissement', unite: 'U52', bloc: 3, ancien: '3.16', taches: 'T4.2.6, T4.2.9, T4.2.10', sf: ['SF109', 'SF110', 'SF111', 'SF112'], savoirs: ['A5', 'H2', 'H1', 'L1'],
    attendu: 'Une solution compatible avec le projet est proposée, argumentée et justifiée techniquement et financièrement.', couverture: 'absent', prevu: ['M6'] },
];
export const competence = (/** @type {string} */ code) => COMPETENCES.find((c) => c.code === code) || null;
export const blocOf = (/** @type {string} */ code) => { const c = competence(code); return BLOCS[(c ? c.bloc : 1) - 1]; };
/** les compétences d'une unité, dans l'ordre du référentiel */
export const competencesDe = (/** @type {string} */ unite) => COMPETENCES.filter((c) => c.unite === unite);
/** les quatorze compétences évaluées à l'épreuve E4, Techniques et mise en œuvre (U4) */
export const TMO = competencesDe('U4').map((c) => c.code);
/** correspondance des anciens numéros du simulateur (1.1 à 4.5, jusqu'à la v19.22) vers les numéros officiels */
/** @type {Record<string, string>} */
export const ANCIEN = Object.fromEntries(COMPETENCES.map((c) => [c.ancien, c.code]));
/** un numéro officiel, qu'on lui donne l'ancien (« 1.4 ») ou le nouveau (« C32 ») ; '' si inconnu */
export const codeOfficiel = (/** @type {string} */ code) => (competence(code) ? code : ANCIEN[code] || '');

// ---------------- rattachement des activités ----------------
// Chaque activité porte les compétences qu'elle fait travailler (la première est la principale).
//   parcours  : parcours du chef de car (src/tutor/lessons), réussis jusqu'au bout
//   missions  : missions du guide (ui/guide.js) ; m6 et m14 (repérage) ne sont pas rattachées
//   phases    : phases du scénario jour de match (scenario.js), réussies à 60 % au moins
//   reseau    : missions du parcours réseau ST 2110 (net/course.js)
//   exercices : brassage complet, montage caméra à l'atelier, quiz ST 2110 et examen réseau (60 %),
//               émission en direct (60 %, médias lancés soi-même)
//   labo      : les défis notés des ateliers du Labo (src/labo/), réussis seul à 60 sur 100 ; un défi travaille
//               les compétences de son atelier (champ competences de labo/ateliers.js)
//   cours     : leçons de la section Cours (src/cours), acquises quand le quiz est réussi en entier
//   camera    : module « La caméra en 3D » (src/camlab) : la mise en service notée (« mes », réussie à
//               60 sur 100) et chaque notion écrite, acquise quand ses trois questions sont réussies du
//               premier coup ; une notion compte pour les compétences de sa fiche (champ competences)
/** les notions écrites du module caméra et leurs compétences (codes inconnus ignorés) */
function cameraNotions() {
  const codes = new Set(COMPETENCES.map((c) => c.code));
  /** @type {Record<string, string[]>} */ const t = {};
  for (const id of ORDRE) {
    const f = NOTIONS[id]; if (f.prevu || !(f.quiz || []).length) continue;
    const list = [...new Set((f.competences || []).filter((c) => codes.has(c)))];
    if (list.length) t[id] = list;
  }
  return t;
}
export const RATTACHEMENT = {
  parcours: {
    'prise-en-main': ['C8'],
    'chef-lineup': ['C21', 'C10', 'C19'],
    'chef-depannage': ['C36', 'C24'],
    'chef-cablage': ['C25', 'C18'],
    'vision-exposition': ['C32', 'C23'],
    'vision-balance': ['C32', 'C10', 'C19'],
    'ccu-depannage': ['C36', 'C24', 'C30'],
    'cadreur-cadrer': ['C23'],
    'atelier-montage': ['C20', 'C9'],
    'hf-liaisons': ['C20', 'C26', 'C24'],
    'synchro-reference': ['C21', 'C32', 'C30'],
    'grille-routage': ['C25', 'C23'],
    'brassage-cordons': ['C8', 'C25'],
    'transmission-secours': ['C26', 'C30', 'C28'],
    'intercom-parler': ['C22', 'C5'],
    'materiel-camera': ['C20'],
    'materiel-synchro': ['C25', 'C32'],
    'materiel-evs': ['C27', 'C20'],
    'materiel-grille': ['C25'],
    'materiel-pied-de-car': ['C25', 'C8'],
    'evs-ralenti': ['C31', 'C23'],
    'evs-clips': ['C15', 'C31'],
    'ipdirector-clips': ['C27', 'C15', 'C13', 'C34'],
    'melangeur-commuter': ['C31', 'C23'],
    'melangeur-incrustations': ['C17', 'C31'],
    'realisateur-ordres': ['C22', 'C5'],
    'scripte-notes': ['C29', 'C13'],
    'production-suivi': ['C5'],
    'son-tranche': ['C32', 'C23'],
    'son-departs': ['C32', 'C10'],
    'reseau-visite': ['C12', 'C14'],
    'reseau-ptp': ['C21', 'C12', 'C30'],
    'reseau-depannage': ['C36', 'C12'],
    'reseau-leaf': ['C11', 'C38', 'C12'],
    'reseau-passerelle': ['C11', 'C25', 'C12'],
    'prism-waveform': ['C32', 'C10', 'C23'],
    'prism-gamut': ['C32', 'C10'],
    'prism-oeil': ['C10', 'C36', 'C30'],
    'ctrlnet-bases': ['C12', 'C11'],
    'ctrlnet-machine': ['C11', 'C12', 'C25'],
    'ctrlnet-depannage': ['C36', 'C12'],
    'videohub-routage': ['C25', 'C23'],
    'videohub-verrou': ['C30', 'C25', 'C21'],
  },
  missions: {
    m1: ['C25'], m2: ['C6', 'C4'], m3: ['C6', 'C25'], m3b: ['C20'], m4: ['C6', 'C4'], m5: ['C20', 'C4'],
    m7: ['C23'], m8: ['C31'], m9: ['C32'], m10: ['C32', 'C10'], m10b: ['C10', 'C19'], m11: ['C31'], m12: ['C31'],
    m13: ['C31'], m13b: ['C15'], m15: ['C10', 'C26'], m16: ['C36'], m17: ['C18'],
  },
  phases: {
    patch: ['C8', 'C25'],
    lineup: ['C32', 'C10', 'C19'],
    line: ['C26', 'C5', 'C28'],
    air: ['C23', 'C36', 'C24'],
  },
  reseau: {
    n1: ['C12'], n2: ['C12', 'C11'], n3: ['C11', 'C12'], n4: ['C12'], n5: ['C14'], n6: ['C14', 'C32'], n7: ['C21'],
    n8: ['C32', 'C10'], n9: ['C36'], n10: ['C36', 'C21'], n11: ['C36', 'C27'], n12: ['C14', 'C21'], n13: ['C36', 'C30'], n14: ['C38', 'C12'],
  },
  exercices: {
    brassage: ['C8', 'C25'],
    atelier: ['C20', 'C9'],
    quiz2110: ['C12'],
    examenReseau: ['C36', 'C12'],
    // l'émission en direct : suivre le conducteur (3.11), lancer les médias depuis l'IPDirector (2.5 : le médiaflow),
    // exploiter le serveur et le mélangeur en direct (2.9), suivre les annonces de l'intercom (4.1)
    emission: ['C29', 'C15', 'C23', 'C5'],
  },
  cours: {
    'signal-422': ['C32', 'C10'], 'signal-bits': ['C32', 'C10'], 'signal-niveaux': ['C32', 'C10'], 'signal-formats': ['C32', 'C25'], 'signal-couleur': ['C32', 'C10'],
    'sdi-cest-quoi': ['C25', 'C10'], 'sdi-bits': ['C10', 'C36', 'C25'], 'sdi-oeil': ['C10', 'C36', 'C19'], 'sdi-falaise': ['C10', 'C36', 'C19'], 'sdi-embedded': ['C25', 'C32'], 'sdi-cable': ['C25', 'C19'],
    'reseau-ip': ['C12', 'C25'], 'reseau-vlan': ['C12', 'C25'], 'reseau-switch': ['C12', 'C36'], 'reseau-routage': ['C12', 'C25', 'C36'], 'reseau-multicast': ['C12', 'C26'], 'reseau-ptp': ['C12', 'C32'],
    'reseau-st2110': ['C26', 'C12', 'C25'], 'reseau-paquet': ['C12', 'C26'], 'reseau-rythme': ['C10', 'C12', 'C26'], 'reseau-2022-7': ['C30', 'C12', 'C26'], 'reseau-spine-leaf': ['C12', 'C6', 'C25'], 'reseau-nmos': ['C12', 'C25', 'C30'],
    'reseau-modele': ['C12', 'C25', 'C36'], 'reseau-etendue': ['C25', 'C26', 'C4'], 'reseau-ethernet': ['C25', 'C19', 'C12'], 'reseau-adresses': ['C12', 'C25'], 'reseau-types': ['C12', 'C26'], 'reseau-dhcp-dns': ['C12', 'C11', 'C36'], 'reseau-nat': ['C12', 'C26', 'C36'],
    'reseau-tcp-udp': ['C26', 'C12', 'C25'], 'reseau-streaming': ['C26', 'C4', 'C25'], 'reseau-mesures': ['C21', 'C36', 'C12'], 'reseau-qos': ['C21', 'C12', 'C30'],
    'hf-frequences': ['C25', 'C30'], 'hf-bilan': ['C25', 'C20'], 'hf-antennes': ['C20', 'C19'], 'hf-cofdm': ['C26', 'C20'],
    'sdi-grille': ['C25', 'C23', 'C30'],
    'synchro-genlock': ['C21', 'C32', 'C30'], 'synchro-timecode': ['C27', 'C15'],
    'camera-systeme': ['C20', 'C25', 'C23'], 'camera-fibre': ['C25', 'C19', 'C36'], 'camera-montage': ['C20', 'C9', 'C19'],
    'real-melangeur': ['C31', 'C23'], 'real-incrustations': ['C17', 'C31'], 'real-ordres': ['C22', 'C5', 'C29'],
    'ralentis-evs': ['C31', 'C23', 'C20'], 'ralentis-clips': ['C15', 'C31', 'C13', 'C34'],
    'son-tranche': ['C32', 'C23'], 'son-n1': ['C32', 'C10', 'C26'],
    // les bases, la dynamique, le loudness et l'audio numérique du chapitre Le son (v19.26) ; la compression vidéo (Le signal)
    'son-decibel': ['C32', 'C10'], 'son-micros': ['C23', 'C32'], 'son-stereo': ['C23', 'C32', 'C10'], 'son-liaisons': ['C25', 'C19', 'C32'],
    'son-dynamique': ['C23', 'C32'], 'son-loudness': ['C32', 'C10', 'C33'], 'son-numerique': ['C25', 'C32', 'C14'],
    'signal-compression': ['C14', 'C26', 'C33'],
    'expl-lineup': ['C32', 'C10', 'C19'], 'expl-depannage': ['C36', 'C24', 'C30'], 'expl-intercom': ['C5', 'C22', 'C25'],
    'expl-transmission': ['C26', 'C30', 'C28'], 'expl-regie-mobile': ['C6', 'C8', 'C25', 'C19'], 'expl-match': ['C8', 'C22', 'C5'],
    // les leçons de la TMO (v19.23) : du cahier des charges au synoptique, l'énergie, le nodal, le PAD, la recette et la maintenance
    'expl-synoptique': ['C6', 'C1', 'C2', 'C3', 'C4'], 'expl-energie': ['C8', 'C9', 'C30'], 'expl-nodal': ['C28', 'C15', 'C26', 'C25'],
    'expl-pad': ['C33', 'C13', 'C14', 'C34'], 'expl-recette': ['C38', 'C16', 'C35', 'C36'],
  },
  camera: {
    // la mise en service : rendre opérant (2.7), exploiter (2.9) et tester (3.9) la caméra ; interconnecter
    // caméra et CCU par la fibre et vérifier la liaison (2.10) ; mettre son signal en conformité : noirs,
    // blancs, exposition sous 100 % à la forme d'onde (1.4)
    mes: ['C20', 'C23', 'C19', 'C25', 'C32'],
    ...cameraNotions(),
  },
  // les défis du Labo : chacun travaille les compétences de son atelier
  labo: Object.fromEntries(DEFIS_LABO.map((d) => [d.id, [...(atelierById(d.atelier) || { competences: [] }).competences]])),
};
