// @ts-check
// Implantation dans le stade : positions caméras et antennes de réception HF.

// Positions caméras (coordonnées en mètres, y = hauteur de l'optique). Stade inspiré de Bollaert-Delelis :
// tribune Lepagnot (principale, z négatif), Marek-Xercès en face, Trannin (x négatif) et Delacourt derrière les buts.
export const SLOTS = [
  { id: 'g_c1', label: 'Passerelle centrale – position 1', zone: 'Tribune Lepagnot', pos: [-1.5, 18.6, -67.9], types: ['plateau', 'hfr3', 'hfr6', 'portable'], role: 'large', precab: true, desc: 'Position du plan large (caméra 1) : dans l\'axe de la ligne médiane, en hauteur pour voir la profondeur du jeu.' },
  { id: 'g_c2', label: 'Passerelle centrale – position 2', zone: 'Tribune Lepagnot', pos: [1.5, 18.6, -67.9], types: ['plateau', 'hfr3', 'hfr6', 'portable'], role: 'serre', precab: true, desc: 'Position du serré (caméra 2), à côté du plan large pour garder le même axe.' },
  { id: 'g_c3', label: 'Passerelle centrale – position 3', zone: 'Tribune Lepagnot', pos: [4.5, 18.6, -67.9], types: ['plateau', 'hfr3', 'hfr6', 'portable'], role: 'joueur', precab: true, desc: 'Troisième position centrale : ISO joueur ou super ralenti.' },
  { id: 'g_16l', label: 'Passerelle – 16 m gauche', zone: 'Tribune Lepagnot', pos: [-36, 18.6, -67.9], types: ['plateau', 'hfr3', 'hfr6', 'portable'], role: 'semi', precab: true, desc: 'Alignée sur la ligne de la surface de réparation gauche : action dans la surface et hors-jeu.' },
  { id: 'g_16r', label: 'Passerelle – 16 m droite', zone: 'Tribune Lepagnot', pos: [36, 18.6, -67.9], types: ['plateau', 'hfr3', 'hfr6', 'portable'], role: 'semi', precab: true, desc: 'Alignée sur la ligne de la surface de réparation droite.' },
  { id: 'high_c', label: 'Haut de la tribune Lepagnot (centre)', zone: 'Tribune Lepagnot', pos: [0, 30.7, -84], types: ['plateau', 'portable'], role: 'tactique', precab: false, desc: 'Position très haute pour le plan tactique.' },
  { id: 'pitch_c', label: 'Bord terrain – entre les bancs', zone: 'Bord terrain', pos: [0, 1.6, -39.4], types: ['portable', 'steadicam', 'ptz'], role: 'joueur', precab: true, desc: 'Caméra basse au niveau des bancs : joueurs, entraîneurs, remplacements.' },
  { id: 'pitch_gl', label: 'Bord terrain – derrière le but gauche', zone: 'Bord terrain', pos: [-58.6, 1.6, -9], types: ['portable', 'hfr3', 'hfr6', 'plateau'], role: 'serre', precab: true, desc: 'Caméra basse derrière le but : actions dans la surface, buts, gardien.' },
  { id: 'pitch_gr', label: 'Bord terrain – derrière le but droit', zone: 'Bord terrain', pos: [58.6, 1.6, 9], types: ['portable', 'hfr3', 'hfr6', 'plateau'], role: 'serre', precab: true, desc: 'Caméra basse derrière le but droit.' },
  { id: 'end_hl', label: 'Tribune Trannin (haute) – axe du but', zone: 'Tribune Trannin', pos: [-89, 17.4, 0], types: ['plateau', 'hfr3', 'portable'], role: 'semi', precab: true, desc: 'Axe du but en hauteur : profondeur et lignes de passe.' },
  { id: 'end_hr', label: 'Tribune Delacourt (haute) – axe du but', zone: 'Tribune Delacourt', pos: [89, 17.3, 0], types: ['plateau', 'hfr3', 'portable'], role: 'semi', precab: true, desc: 'Axe du but droit en hauteur.' },
  { id: 'opp_c', label: 'Tribune Xercès – centre (contrechamp)', zone: 'Tribune Marek-Xercès', pos: [0, 15.35, 66.5], types: ['plateau', 'hfr3', 'portable'], role: 'semi', precab: false, desc: 'Contrechamp (reverse) : souvent réservé aux ralentis pour ne pas désorienter le téléspectateur.' },
  { id: 'opp_16l', label: 'Bord terrain opposé – 16 m gauche', zone: 'Bord terrain', pos: [-36, 1.6, 39.5], types: ['portable', 'hfr3', 'plateau'], role: 'serre', precab: false, desc: 'Contrechamp bas.' },
  { id: 'opp_16r', label: 'Bord terrain opposé – 16 m droit', zone: 'Bord terrain', pos: [36, 1.6, 39.5], types: ['portable', 'hfr3', 'plateau'], role: 'serre', precab: false, desc: 'Contrechamp bas.' },
  { id: 'steadi_l', label: 'Steadicam HF – touche gauche', zone: 'Bord terrain', pos: [-26, 1.6, -36.4], types: ['steadicam', 'portable'], role: 'suivi', precab: false, desc: 'Steadicam qui suit l\'action le long de la touche gauche.' },
  { id: 'steadi_r', label: 'Steadicam HF – touche droite', zone: 'Bord terrain', pos: [26, 1.6, -36.4], types: ['steadicam', 'portable'], role: 'suivi', precab: false, desc: 'Steadicam qui suit l\'action le long de la touche droite.' },
  { id: 'pov_l', label: 'Mini-caméra dans le filet gauche', zone: 'But gauche', pos: [-54.3, 2.05, 1.4], types: ['pov'], role: 'but', precab: false, desc: 'Caméra fixe dans le filet : ralentis des buts.' },
  { id: 'pov_r', label: 'Mini-caméra dans le filet droit', zone: 'But droit', pos: [54.3, 2.05, -1.4], types: ['pov'], role: 'but', precab: false, desc: 'Caméra fixe dans le filet droit.' },
  { id: 'rail_opp', label: 'Rail travelling – touche opposée', zone: 'Bord terrain', pos: [0, 0.9, 36.6], types: ['rail'], role: 'suivi', precab: false, desc: 'Chariot motorisé sur rail qui suit le jeu au ras de la pelouse.' },
  { id: 'spider', label: 'Caméra câblée volante', zone: 'Au-dessus du terrain', pos: [0, 16, -10], types: ['spider'], role: 'suivi', precab: false, desc: 'Caméra suspendue à 4 câbles : vues aériennes dynamiques.' },
  { id: 'crane_l', label: 'Grue – angle gauche', zone: 'Bord terrain', pos: [-60, 3.5, -38.4], types: ['grue'], role: 'grue', precab: false, desc: 'Grue télescopique dans l\'angle : plans d\'ambiance et de célébrations.' },
  { id: 'beauty', label: 'Toit Marek-Xercès – plan beauté', zone: 'Toit', pos: [0, 34.6, 47], types: ['ptz', 'plateau'], role: 'beaute', precab: false, desc: 'Vue générale du stade, pour l\'ouverture et les retours de pub.' },
  { id: 'tunnel', label: 'Sortie du tunnel des joueurs', zone: 'Tunnel', pos: [3.4, 1.7, -42.5], types: ['portable', 'steadicam', 'ptz'], role: 'tunnel', precab: true, desc: 'Entrée des joueurs et sortie à la mi-temps.' },
  { id: 'comm', label: 'Positions commentateurs', zone: 'Tribune Lepagnot', pos: [11.5, 12.9, -62.6], types: ['ptz'], role: 'comm', precab: true, desc: 'Plan des commentateurs.' },
  { id: 'drone', label: 'Drone – zone de vol derrière Marek-Xercès', zone: 'Extérieur', pos: [-40, 58, 75], types: ['drone'], role: 'beaute', precab: false, desc: 'Vol autorisé uniquement hors du public, avec télépilote certifié.' },
];

export const ANTENNAS = [
  { id: 'ant_main', label: 'Antenne toit Lepagnot', pos: [0, 35.5, -44], gain: 13, kind: 'secteur', on: true },
  { id: 'ant_opp', label: 'Antenne toit Marek-Xercès', pos: [0, 34.5, 44], gain: 13, kind: 'secteur', on: false },
  { id: 'ant_l', label: 'Antenne toit Trannin', pos: [-64, 31, 0], gain: 13, kind: 'secteur', on: false },
  { id: 'ant_r', label: 'Antenne toit Delacourt', pos: [64, 33, 0], gain: 13, kind: 'secteur', on: false },
  { id: 'ant_tun', label: 'Antenne tunnel / vestiaires', pos: [0, 3.6, -64], gain: 6, kind: 'omni', on: false },
  { id: 'ant_cpd', label: 'Mât antenne du compound', pos: [-4, 9, -100], gain: 9, kind: 'omni', on: false },
];
