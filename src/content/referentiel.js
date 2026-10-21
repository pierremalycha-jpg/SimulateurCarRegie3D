// @ts-check
// ----------------------------------------------------------------------------------
// Le référentiel du BTS Métiers de l'audiovisuel, option TIEE (fiche RNCP37022), et le
// rattachement des activités du simulateur à ses compétences. Les compétences sont numérotées
// 1.1 à 4.5 dans l'ordre de la fiche (numérotation à nous, la fiche ne numérote pas) : ce sont
// les numéros du document « Simulateur et référentiel TIEE : rattachement et plan de modules ».
// La couverture est le constat du 21 octobre 2026 sur le car régie (v18.2) ; « prevu » renvoie
// aux modules qui combleront une compétence absente ou incomplète (ROADMAP.md).
// ----------------------------------------------------------------------------------

export const FICHE = {
  code: 'RNCP37022',
  titre: 'BTS Métiers de l\'audiovisuel, option Techniques d\'ingénierie et exploitation des équipements',
  echeance: '31 août 2027',
};

/**
 * @typedef {object} Bloc
 * @property {string} id
 * @property {number} n
 * @property {string} titre
 * @property {string} epreuve épreuve correspondante (déduite des modalités d'évaluation de la fiche)
 * @property {string} forme
 */
/** @type {Bloc[]} */
export const BLOCS = [
  { id: 'BC01', n: 1, titre: 'Mise en place d\'un projet', epreuve: 'E3 Physique et technique des équipements et supports', forme: 'écrit' },
  { id: 'BC02', n: 2, titre: 'Mise en œuvre des savoir-faire d\'ingénierie et d\'exploitation', epreuve: 'E4 Techniques et mise en œuvre', forme: 'CCF, 2 situations' },
  { id: 'BC03', n: 3, titre: 'Participation à une production audiovisuelle', epreuve: 'E5 Projet (E51) et environnement du projet (E52)', forme: 'oral' },
  { id: 'BC04', n: 4, titre: 'Analyse de situation professionnelle', epreuve: 'E6 Situation en milieu professionnel', forme: 'oral' },
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

/** @typedef {'bien' | 'partie' | 'absent'} Couverture */
/**
 * @typedef {object} Competence
 * @property {string} code 1.1 à 4.5
 * @property {string} titre
 * @property {string} taches tâches du référentiel des activités
 * @property {Couverture} couverture
 * @property {(keyof typeof MODULES)[]} prevu modules qui la complèteront
 */
/** @type {Competence[]} */
export const COMPETENCES = [
  { code: '1.1', titre: 'Prendre en compte et traduire les contraintes', taches: 'T1.1.2, T1.2.1', couverture: 'partie', prevu: ['M2', 'M6'] },
  { code: '1.2', titre: 'Assurer la qualité de service des moyens d\'exploitation', taches: 'T3.1.5, T3.3.3', couverture: 'bien', prevu: [] },
  { code: '1.3', titre: 'Superviser les échanges entre les postes de travail et le serveur', taches: 'T3.2.4 à T3.2.6', couverture: 'partie', prevu: ['M3'] },
  { code: '1.4', titre: 'Mettre en conformité les signaux', taches: 'T2.2, T2.7', couverture: 'bien', prevu: [] },

  { code: '2.1', titre: 'Mettre en place et rendre opérants les moyens de production, de postproduction et de diffusion', taches: 'T2.1, T2.5', couverture: 'partie', prevu: ['M3', 'M7'] },
  { code: '2.2', titre: 'Vérifier la conformité des signaux tout au long de la chaîne', taches: 'T2.2, T3.1.5', couverture: 'bien', prevu: [] },
  { code: '2.3', titre: 'Mettre en place et paramétrer les outils informatiques d\'un poste', taches: 'T2.3', couverture: 'partie', prevu: ['M3'] },
  { code: '2.4', titre: 'Gérer le dataflow', taches: 'T2.4, T3.2.4', couverture: 'partie', prevu: ['M3'] },
  { code: '2.5', titre: 'Gérer le médiaflow', taches: 'T3.1.4, T3.2.5', couverture: 'partie', prevu: ['M3'] },
  { code: '2.6', titre: 'Mettre en place et paramétrer les dispositifs de trucage et d\'effets', taches: 'T2.6', couverture: 'partie', prevu: ['M5'] },
  { code: '2.7', titre: 'Rendre opérants les équipements de réception, d\'enregistrement et d\'acquisition', taches: 'T3.1.2', couverture: 'bien', prevu: [] },
  { code: '2.8', titre: 'Assurer la supervision des équipes', taches: 'T1.1.5', couverture: 'partie', prevu: [] },
  { code: '2.9', titre: 'Exploiter les équipements', taches: 'T3.1.1 à T3.1.8', couverture: 'bien', prevu: [] },
  { code: '2.10', titre: 'Interconnecter les équipements pour échanger ou transmettre des flux', taches: 'T3.3.4, T3.2.1', couverture: 'bien', prevu: [] },
  { code: '2.11', titre: 'Réceptionner ou envoyer les flux d\'information', taches: 'T3.2.1 à T3.2.3', couverture: 'partie', prevu: ['M7', 'M8'] },
  { code: '2.12', titre: 'Assurer les trucages nécessaires au programme', taches: 'T3.4.1, T3.4.2', couverture: 'bien', prevu: [] },
  { code: '2.13', titre: 'Diagnostiquer un dysfonctionnement en maintenance curative', taches: 'T3.1.7', couverture: 'bien', prevu: [] },
  { code: '2.14', titre: 'Mettre en œuvre les configurations techniques dans le cadre d\'une recette', taches: 'T2.1', couverture: 'partie', prevu: ['M4'] },

  { code: '3.1', titre: 'S\'approprier le dossier initial', taches: 'T1.1.1', couverture: 'absent', prevu: ['M2'] },
  { code: '3.2', titre: 'Identifier le besoin en réponse aux demandes de la production', taches: 'T1.1.2', couverture: 'absent', prevu: ['M2'] },
  { code: '3.3', titre: 'Situer le projet dans son contexte', taches: 'T1.1.2', couverture: 'absent', prevu: ['M2'] },
  { code: '3.4', titre: 'Choisir des solutions', taches: 'T1.2.1, T1.2.4', couverture: 'partie', prevu: ['M2'] },
  { code: '3.5', titre: 'Réunir et organiser les ressources et éléments nécessaires au projet', taches: 'T1.1.3, T1.1.4', couverture: 'absent', prevu: ['M2', 'M6'] },
  { code: '3.6', titre: 'Administrer le réseau', taches: 'T3.2.4', couverture: 'bien', prevu: [] },
  { code: '3.7', titre: 'Gérer le workflow', taches: 'T3.2.5, T3.2.6', couverture: 'partie', prevu: ['M3'] },
  { code: '3.8', titre: 'Lister les matériels et les consommables', taches: 'T1.1.3, T2.8', couverture: 'partie', prevu: ['M6'] },
  { code: '3.9', titre: 'Tester les matériels', taches: 'T2.5', couverture: 'bien', prevu: [] },
  { code: '3.10', titre: 'Adapter les moyens, mettre en œuvre des solutions alternatives', taches: 'T3.1.1, T3.1.7', couverture: 'bien', prevu: [] },
  { code: '3.11', titre: 'Mettre en œuvre les conducteurs (régie finale ou réalisation d\'émissions)', taches: 'T3.3.2', couverture: 'partie', prevu: ['M5', 'M7'] },
  { code: '3.12', titre: 'Anticiper les dysfonctionnements pour assurer la continuité de service', taches: 'T3.3.3', couverture: 'bien', prevu: [] },
  { code: '3.13', titre: 'Analyser et normaliser le support', taches: 'T3.4.4, T3.4.5', couverture: 'absent', prevu: ['M3'] },
  { code: '3.14', titre: 'Archiver des éléments de programme', taches: 'T3.4.6', couverture: 'partie', prevu: ['M3'] },
  { code: '3.15', titre: 'Maintenir les compétences techniques de l\'équipe des utilisateurs', taches: '', couverture: 'absent', prevu: ['M4'] },
  { code: '3.16', titre: 'Rechercher des solutions compatibles avec les projets d\'investissement', taches: '', couverture: 'absent', prevu: ['M6'] },

  { code: '4.1', titre: 'Communiquer avec les principaux acteurs', taches: 'T1.1.5, T1.2.3', couverture: 'partie', prevu: ['M2'] },
  { code: '4.2', titre: 'Veiller à la sécurité des biens et des personnes', taches: 'T2.9', couverture: 'partie', prevu: ['M4'] },
  { code: '4.3', titre: 'Réceptionner les équipements', taches: 'T2.5', couverture: 'absent', prevu: ['M4', 'M6'] },
  { code: '4.4', titre: 'Connaître l\'organisation du nodal et répondre à la demande de communication', taches: 'T3.3.1, T3.2.1', couverture: 'partie', prevu: ['M7'] },
  { code: '4.5', titre: 'Garantir l\'opérationnalité d\'un système par la maintenance préventive', taches: '', couverture: 'absent', prevu: ['M4'] },
];
export const blocOf = (code) => BLOCS[Number(code.split('.')[0]) - 1];

// ---------------- rattachement des activités ----------------
// Chaque activité porte les compétences qu'elle fait travailler (la première est la principale).
//   parcours  : parcours du chef de car (src/tutor/lessons), réussis jusqu'au bout
//   missions  : missions du guide (ui/guide.js) ; m6 et m14 (repérage) ne sont pas rattachées
//   phases    : phases du scénario jour de match (scenario.js), réussies à 60 % au moins
//   reseau    : missions du parcours réseau ST 2110 (net/course.js)
//   exercices : brassage complet, montage caméra à l'atelier, quiz ST 2110 et examen réseau (60 %)
//   cours     : leçons de la section Cours (src/cours), acquises quand le quiz est réussi en entier
export const RATTACHEMENT = {
  parcours: {
    'prise-en-main': ['2.1'],
    'chef-lineup': ['1.2', '2.2', '3.9'],
    'chef-depannage': ['2.13', '3.10'],
    'chef-cablage': ['2.10', '3.8'],
    'vision-exposition': ['1.4', '2.9'],
    'vision-balance': ['1.4', '2.2', '3.9'],
    'ccu-depannage': ['2.13', '3.10', '3.12'],
    'cadreur-cadrer': ['2.9'],
    'atelier-montage': ['2.7', '4.2'],
    'hf-liaisons': ['2.7', '2.11', '3.10'],
    'synchro-reference': ['1.2', '1.4', '3.12'],
    'grille-routage': ['2.10', '2.9'],
    'brassage-cordons': ['2.1', '2.10'],
    'transmission-secours': ['2.11', '3.12', '4.4'],
    'intercom-parler': ['2.8', '4.1'],
    'materiel-camera': ['2.7'],
    'materiel-synchro': ['2.10', '1.4'],
    'materiel-evs': ['1.3', '2.7'],
    'materiel-grille': ['2.10'],
    'materiel-pied-de-car': ['2.10', '2.1'],
    'evs-ralenti': ['2.12', '2.9'],
    'evs-clips': ['2.5', '2.12'],
    'ipdirector-clips': ['1.3', '2.5', '3.7', '3.14'],
    'melangeur-commuter': ['2.12', '2.9'],
    'melangeur-incrustations': ['2.6', '2.12'],
    'realisateur-ordres': ['2.8', '4.1'],
    'scripte-notes': ['3.11', '3.7'],
    'production-suivi': ['4.1'],
    'son-tranche': ['1.4', '2.9'],
    'son-departs': ['1.4', '2.2'],
    'reseau-visite': ['3.6', '2.4'],
    'reseau-ptp': ['1.2', '3.6', '3.12'],
    'reseau-depannage': ['2.13', '3.6'],
    'reseau-leaf': ['2.3', '2.14', '3.6'],
    'reseau-passerelle': ['2.3', '2.10', '3.6'],
    'prism-waveform': ['1.4', '2.2', '2.9'],
    'prism-gamut': ['1.4', '2.2'],
    'prism-oeil': ['2.2', '2.13', '3.12'],
    'ctrlnet-bases': ['3.6', '2.3'],
    'ctrlnet-machine': ['2.3', '3.6', '2.10'],
    'ctrlnet-depannage': ['2.13', '3.6'],
    'videohub-routage': ['2.10', '2.9'],
    'videohub-verrou': ['3.12', '2.10', '1.2'],
  },
  missions: {
    m1: ['2.10'], m2: ['1.1', '3.4'], m3: ['1.1', '2.10'], m3b: ['2.7'], m4: ['1.1', '3.4'], m5: ['2.7', '3.4'],
    m7: ['2.9'], m8: ['2.12'], m9: ['1.4'], m10: ['1.4', '2.2'], m10b: ['2.2', '3.9'], m11: ['2.12'], m12: ['2.12'],
    m13: ['2.12'], m13b: ['2.5'], m15: ['2.2', '2.11'], m16: ['2.13'], m17: ['3.8'],
  },
  phases: {
    patch: ['2.1', '2.10'],
    lineup: ['1.4', '2.2', '3.9'],
    line: ['2.11', '4.1', '4.4'],
    air: ['2.9', '2.13', '3.10'],
  },
  reseau: {
    n1: ['3.6'], n2: ['3.6', '2.3'], n3: ['2.3', '3.6'], n4: ['3.6'], n5: ['2.4'], n6: ['2.4', '1.4'], n7: ['1.2'],
    n8: ['1.4', '2.2'], n9: ['2.13'], n10: ['2.13', '1.2'], n11: ['2.13', '1.3'], n12: ['2.4', '1.2'], n13: ['2.13', '3.12'], n14: ['2.14', '3.6'],
  },
  exercices: {
    brassage: ['2.1', '2.10'],
    atelier: ['2.7', '4.2'],
    quiz2110: ['3.6'],
    examenReseau: ['2.13', '3.6'],
  },
  cours: {
    'signal-422': ['1.4', '2.2'], 'signal-bits': ['1.4', '2.2'], 'signal-niveaux': ['1.4', '2.2'], 'signal-formats': ['1.4', '2.10'], 'signal-couleur': ['1.4', '2.2'],
    'sdi-cest-quoi': ['2.10', '2.2'], 'sdi-oeil': ['2.2', '2.13', '3.9'], 'sdi-falaise': ['2.2', '2.13', '3.9'], 'sdi-embedded': ['2.10', '1.4'], 'sdi-cable': ['2.10', '3.9'],
    'reseau-ip': ['3.6', '2.10'], 'reseau-vlan': ['3.6', '2.10'], 'reseau-switch': ['3.6', '2.13'], 'reseau-multicast': ['3.6', '2.11'], 'reseau-ptp': ['3.6', '1.4'],
    'hf-frequences': ['2.10', '3.12'], 'hf-bilan': ['2.10', '2.7'], 'hf-antennes': ['2.7', '3.9'], 'hf-cofdm': ['2.11', '2.7'],
  },
};
