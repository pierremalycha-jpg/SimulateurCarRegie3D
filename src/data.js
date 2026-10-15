// Catalogues techniques et contenus pédagogiques
// Les valeurs techniques sont des ordres de grandeur réalistes (indicatifs), elles varient selon les modèles et les constructeurs.

export const SENSORS = {
  '2/3': { label: '2/3" (B4)', w: 9.59, h: 5.39 },
  '1/2.8': { label: '1/2,8"', w: 5.57, h: 3.13 },
  '1': { label: '1"', w: 13.2, h: 7.42 },
};

// Objectifs : fmin/fmax en mm, ouverture max, focale de début de "ramping" et ouverture max à fmax
export const LENSES = {
  UJ122: { name: 'Canon UJ122x8.2B', kind: 'box', fmin: 8.2, fmax: 1000, f0: 1.7, ramp: 390, fLong: 4.4, ext: true, desc: 'Zoom "box" UHD très longue focale (8,2–1000 mm). Utilisé pour les plans serrés depuis la tribune.' },
  UA107: { name: 'Fujinon UA107x8.4BESM', kind: 'box', fmin: 8.4, fmax: 900, f0: 1.7, ramp: 350, fLong: 4.4, ext: true, desc: 'Zoom box 4K 8,4–900 mm, standard des caméras principales de stade.' },
  UJ86: { name: 'Canon UJ86x9.3B', kind: 'box', fmin: 9.3, fmax: 800, f0: 1.7, ramp: 330, fLong: 4.1, ext: true, desc: 'Zoom box UHD 9,3–800 mm. Très courant en plan large et serré.' },
  UJ27: { name: 'Canon UJ27x6.5B', kind: 'box', fmin: 6.5, fmax: 180, f0: 1.5, ramp: 140, fLong: 1.95, ext: true, desc: 'Zoom box grand-angle (6,5–180 mm) pour positions proches.' },
  CJ45: { name: 'Canon CJ45ex9.7B', kind: 'portable', fmin: 9.7, fmax: 437, f0: 2.0, ramp: 200, fLong: 4.4, ext: true, desc: 'Zoom portable longue focale (9,7–437 mm) : caméra épaule avec grande portée.' },
  UA46: { name: 'Fujinon UA46x9.5BERD', kind: 'portable', fmin: 9.5, fmax: 437, f0: 2.0, ramp: 210, fLong: 4.2, ext: true, desc: 'Zoom portable 4K longue focale.' },
  CJ24: { name: 'Canon CJ24ex7.5B', kind: 'portable', fmin: 7.5, fmax: 180, f0: 1.8, ramp: 120, fLong: 2.7, ext: true, desc: 'Zoom portable polyvalent (7,5–180 mm).' },
  UA24: { name: 'Fujinon UA24x7.8BERD', kind: 'portable', fmin: 7.8, fmax: 187, f0: 1.8, ramp: 125, fLong: 2.7, ext: true, desc: 'Zoom portable 4K polyvalent.' },
  CJ20: { name: 'Canon CJ20ex7.8B', kind: 'portable', fmin: 7.8, fmax: 156, f0: 1.8, ramp: 105, fLong: 2.7, ext: true, desc: 'Zoom portable léger, idéal Steadicam et épaule.' },
  CJ15: { name: 'Canon CJ15ex4.3B', kind: 'portable', fmin: 4.3, fmax: 65, f0: 1.8, ramp: 45, fLong: 2.6, ext: true, desc: 'Grand-angle (4,3–65 mm) : vestiaires, tunnel, grue, caméra volante.' },
  UA14: { name: 'Fujinon UA14x4.5BERD', kind: 'portable', fmin: 4.5, fmax: 63, f0: 2.0, ramp: 45, fLong: 2.8, ext: true, desc: 'Grand-angle 4K (4,5–63 mm).' },
  FIX4: { name: 'Optique fixe 4 mm', kind: 'fixe', fmin: 4, fmax: 4, f0: 2.0, ramp: 99, fLong: 2.0, ext: false, desc: 'Optique fixe grand-angle de mini-caméra (POV).' },
  FIX9: { name: 'Optique fixe 9 mm', kind: 'fixe', fmin: 9, fmax: 9, f0: 2.8, ramp: 99, fLong: 2.8, ext: false, desc: 'Optique fixe de drone (capteur 1").' },
  PTZ20: { name: 'Zoom intégré 20x (8,8–176 mm)', kind: 'ptz', fmin: 8.8, fmax: 176, f0: 2.8, ramp: 60, fLong: 4.5, ext: false, desc: 'Zoom intégré de caméra tourelle 4K (capteur 1").' },
};

export function maxAperture(lens, f, ext) {
  let n = lens.f0;
  if (f > lens.ramp) n = Math.min(lens.fLong, lens.f0 * (f / lens.ramp));
  if (ext) n *= 2; // doubleur : -2 diaphragmes
  return n;
}

export const CAMERA_TYPES = {
  plateau: {
    label: 'Caméra tribune grand objectif', short: 'Tribune', sensor: '2/3',
    body: 'Caméra système 3 capteurs 2/3" (type Sony HDC-5500, Grass Valley LDX 100, Ikegami UHK-X700)',
    support: 'Trépied lourd + tête fluide (type Vinten / Sachtler) + télécommandes zoom/point',
    lenses: ['UA107', 'UJ86', 'UJ122', 'UJ27'], defLens: 'UJ86',
    links: ['smpte', 'precab', 'smf', 'triax', 'ip'], defLink: 'smpte',
    roles: ['large', 'serre', 'semi', 'joueur', 'tactique', 'fixe'], hfr: 1, operator: true, model: 'box',
  },
  hfr3: {
    label: 'Super ralenti 3x (150 i/s)', short: 'SSM 3x', sensor: '2/3',
    body: 'Caméra système en mode HFR 3x (150 i/s en 50 Hz) : 3 phases SDI vers l\'EVS',
    support: 'Trépied lourd + tête fluide', lenses: ['UJ86', 'UA107', 'UJ122', 'CJ45'], defLens: 'UJ86',
    links: ['smpte', 'precab', 'smf', 'ip'], defLink: 'smpte', roles: ['serre', 'joueur', 'semi'], hfr: 3, operator: true, model: 'box',
  },
  hfr6: {
    label: 'Super ralenti 6x (300 i/s)', short: 'SSM 6x', sensor: '2/3',
    body: 'Caméra HFR 6x (300 i/s) : 6 phases, demande beaucoup de lumière',
    support: 'Trépied lourd', lenses: ['UJ86', 'UA107', 'CJ45'], defLens: 'UA107',
    links: ['smpte', 'precab', 'smf', 'ip'], defLink: 'smpte', roles: ['serre', 'joueur'], hfr: 6, operator: true, model: 'box',
  },
  portable: {
    label: 'Caméra portable / épaule', short: 'Épaule', sensor: '2/3',
    body: 'Caméra système portable 2/3" (même voie CCU que les caméras tribune)',
    support: 'Épaule ou trépied léger', lenses: ['CJ24', 'CJ20', 'UA24', 'CJ45', 'UA46', 'CJ15', 'UA14'], defLens: 'CJ24',
    links: ['smpte', 'triax', 'smf', 'coax', 'ip', 'precab'], defLink: 'smpte', roles: ['joueur', 'serre', 'bancs', 'tribune', 'tunnel', 'semi'], hfr: 1, operator: true, model: 'shoulder',
  },
  steadicam: {
    label: 'Steadicam HF', short: 'Steadi HF', sensor: '2/3',
    body: 'Caméra compacte 2/3" sur harnais stabilisé + émetteur HF COFDM au dos',
    support: 'Bras et harnais Steadicam, batteries V-Lock', lenses: ['CJ20', 'CJ15', 'UA14', 'CJ24'], defLens: 'CJ20',
    links: ['hf'], defLink: 'hf', roles: ['suivi', 'joueur'], hfr: 1, operator: true, model: 'steadicam', moving: 'touchline',
  },
  pov: {
    label: 'Mini-caméra POV', short: 'POV', sensor: '1/2.8',
    body: 'Mini-caméra (type Marshall, Dreamchip, Sony HDC-P31) pilotée à distance',
    support: 'Fixation dans le filet / poteau, boîtier de conversion fibre', lenses: ['FIX4'], defLens: 'FIX4',
    links: ['smf', 'coax'], defLink: 'smf', roles: ['but', 'fixe'], hfr: 1, operator: false, model: 'pov',
  },
  grue: {
    label: 'Grue télescopique', short: 'Grue', sensor: '2/3',
    body: 'Caméra compacte sur tête télécommandée en bout de grue (type Technocrane)',
    support: 'Grue télescopique sur base, tête 3 axes, opérateur + machiniste', lenses: ['CJ15', 'UA14', 'CJ20'], defLens: 'CJ15',
    links: ['smpte', 'smf'], defLink: 'smpte', roles: ['grue'], hfr: 1, operator: true, model: 'crane', moving: 'crane',
  },
  rail: {
    label: 'Caméra sur rail (travelling)', short: 'Rail', sensor: '2/3',
    body: 'Caméra compacte sur chariot motorisé télécommandé',
    support: 'Rail le long de la ligne de touche, chariot motorisé', lenses: ['CJ20', 'CJ24', 'UA24'], defLens: 'CJ20',
    links: ['smf', 'smpte'], defLink: 'smf', roles: ['suivi'], hfr: 1, operator: true, model: 'rail', moving: 'rail',
  },
  spider: {
    label: 'Caméra câblée volante (type Spidercam)', short: 'Volante', sensor: '2/3',
    body: 'Caméra compacte gyrostabilisée suspendue à 4 câbles motorisés',
    support: '4 treuils en haut des tribunes, pilote + cadreur', lenses: ['CJ15', 'UA14', 'CJ20'], defLens: 'CJ15',
    links: ['smf'], defLink: 'smf', roles: ['suivi'], hfr: 1, operator: true, model: 'spider', moving: 'spider',
  },
  drone: {
    label: 'Drone (HF)', short: 'Drone', sensor: '1',
    body: 'Drone avec nacelle stabilisée et liaison vidéo HF',
    support: 'Télépilote certifié + cadreur, zone de vol autorisée', lenses: ['FIX9'], defLens: 'FIX9',
    links: ['hf'], defLink: 'hf', roles: ['suivi', 'beaute'], hfr: 1, operator: true, model: 'drone', moving: 'drone',
  },
  ptz: {
    label: 'Caméra tourelle (PTZ)', short: 'PTZ', sensor: '1',
    body: 'Caméra tourelle 4K télécommandée depuis le car (type Panasonic AW-UE160, Sony FR7)',
    support: 'Fixation murale ou sur pied, pilotée par un opérateur au car', lenses: ['PTZ20'], defLens: 'PTZ20',
    links: ['ip', 'smf', 'coax'], defLink: 'ip', roles: ['comm', 'tribune', 'beaute', 'fixe', 'tunnel'], hfr: 1, operator: false, model: 'ptz',
  },
};

export const ROLES = {
  large: { label: 'Plan large (master)', desc: 'Suit le jeu en plan large, montre la tactique et l\'espace. C\'est la caméra de base du réalisateur.' },
  semi: { label: 'Plan moyen / 16 m', desc: 'Cadre l\'action plus serré que le master, souvent aligné sur la surface (hors-jeu).' },
  serre: { label: 'Serré porteur du ballon', desc: 'Suit le joueur qui a le ballon en plan serré (pied/genoux à tête).' },
  joueur: { label: 'ISO joueur', desc: 'Suit un joueur précis (la star), même sans ballon : réactions, émotions.' },
  tactique: { label: 'Plan tactique très large', desc: 'Plan très large et haut, pour l\'analyse tactique et les ralentis.' },
  fixe: { label: 'Plan fixe', desc: 'Cadre fixe défini à l\'installation.' },
  but: { label: 'Caméra de but (POV)', desc: 'Plan fixe depuis le filet : ralentis des buts.' },
  bancs: { label: 'Bancs / entraîneurs', desc: 'Réactions des entraîneurs et remplaçants.' },
  tribune: { label: 'Public / tribunes', desc: 'Ambiance, supporters, célébrations.' },
  tunnel: { label: 'Tunnel / entrée des joueurs', desc: 'Entrée des équipes, sortie à la mi-temps.' },
  comm: { label: 'Commentateurs', desc: 'Plan des commentateurs dans leur cabine.' },
  grue: { label: 'Grue (plans aériens bas)', desc: 'Mouvements amples au-dessus du bord terrain.' },
  suivi: { label: 'Suivi en mouvement', desc: 'La caméra se déplace pour suivre l\'action.' },
  beaute: { label: 'Plan beauté', desc: 'Vue d\'ensemble du stade (ouverture, retours de pub).' },
  manuel: { label: 'Manuel (vous)', desc: 'Vous cadrez vous-même cette caméra.' },
};

// Liaisons caméra -> car
export const LINKS = {
  smpte: {
    label: 'Fibre hybride SMPTE (311M, connecteur 3K.93C)', short: 'SMPTE', color: 0xff8a1f, max: { UHD: 2000, HD: 2000, HDi: 2000 }, power: true,
    desc: 'Câble hybride : 2 fibres monomodes + conducteurs cuivre qui alimentent la caméra depuis la CCU. Transporte vidéo, retour, intercom, tally et télécommandes. Portée limitée par l\'alimentation (environ 2 km selon caméra et câble).'
  },
  precab: {
    label: 'Pré-câblage du stade (fibre SM) + adaptateur', short: 'Pré-câblage', color: 0xffd23f, max: { UHD: 10000, HD: 10000, HDi: 10000 }, power: false,
    desc: 'Fibres monomodes installées à demeure entre la position caméra et le local TV du stade. Pas d\'alimentation : il faut un adaptateur SMPTE/fibre SM et une alimentation locale à la caméra.'
  },
  smf: {
    label: 'Fibre monomode tactique + convertisseurs', short: 'Fibre SM', color: 0xf5e663, max: { UHD: 10000, HD: 10000, HDi: 10000 }, power: false,
    desc: 'Fibre monomode (gaine jaune) avec convertisseurs aux deux bouts. Très longue portée (plus de 10 km) mais alimentation locale nécessaire.'
  },
  triax: {
    label: 'Triax', short: 'Triax', color: 0x4f8ff7, max: { UHD: 600, HD: 1200, HDi: 1500 }, power: true,
    desc: 'Câble coaxial à double blindage. Technologie plus ancienne, robuste, alimente la caméra. Portée réduite en UHD.'
  },
  coax: {
    label: 'Coaxial SDI (BNC 75 Ω)', short: 'Coax SDI', color: 0xcfd6dd, max: { UHD: 70, HD: 120, HDi: 150 }, power: false,
    desc: 'Liaison SDI directe. Courte portée : environ 70 m en 12G-SDI (UHD), 100 à 120 m en 3G-SDI. Pas de retour ni de télécommande sans câbles supplémentaires.'
  },
  ip: {
    label: 'IP SMPTE ST 2110 (fibre 25 GbE)', short: 'IP 2110', color: 0x2fd6c8, max: { UHD: 10000, HD: 10000, HDi: 10000 }, power: false,
    desc: 'Flux vidéo/audio/données non compressés sur réseau IP, synchronisés par PTP. Demande un réseau de commutateurs dimensionné et un grand maître PTP.'
  },
  hf: {
    label: 'Liaison HF numérique (COFDM)', short: 'HF', color: 0xd65cf2, max: null, power: false,
    desc: 'Émetteur au dos de la caméra, antennes réceptrices dans le stade reliées au car. Liberté de mouvement, mais latence, compression et risque de coupure.'
  },
};

export const FORMATS = {
  UHD: { label: 'UHD 2160p50 HDR (HLG)', sdi: '12G-SDI (ou 4 x 3G-SDI)', rate: '11,88 Gb/s', fps: 50 },
  HD: { label: 'HD 1080p50 SDR (BT.709)', sdi: '3G-SDI', rate: '2,97 Gb/s', fps: 50 },
  HDi: { label: 'HD 1080i50 SDR (BT.709)', sdi: 'HD-SDI', rate: '1,485 Gb/s', fps: 25 },
};

// Positions caméras (coordonnées en mètres, y = hauteur de l'optique). Tribune principale côté z négatif.
export const SLOTS = [
  { id: 'g_c1', label: 'Passerelle centrale – position 1', zone: 'Tribune principale', pos: [-1.5, 18.6, -67.9], types: ['plateau', 'hfr3', 'hfr6', 'portable'], role: 'large', precab: true, desc: 'Position du plan large (caméra 1) : dans l\'axe de la ligne médiane, en hauteur pour voir la profondeur du jeu.' },
  { id: 'g_c2', label: 'Passerelle centrale – position 2', zone: 'Tribune principale', pos: [1.5, 18.6, -67.9], types: ['plateau', 'hfr3', 'hfr6', 'portable'], role: 'serre', precab: true, desc: 'Position du serré (caméra 2), à côté du plan large pour garder le même axe.' },
  { id: 'g_c3', label: 'Passerelle centrale – position 3', zone: 'Tribune principale', pos: [4.5, 18.6, -67.9], types: ['plateau', 'hfr3', 'hfr6', 'portable'], role: 'joueur', precab: true, desc: 'Troisième position centrale : ISO joueur ou super ralenti.' },
  { id: 'g_16l', label: 'Passerelle – 16 m gauche', zone: 'Tribune principale', pos: [-36, 18.6, -67.9], types: ['plateau', 'hfr3', 'hfr6', 'portable'], role: 'semi', precab: true, desc: 'Alignée sur la ligne de la surface de réparation gauche : action dans la surface et hors-jeu.' },
  { id: 'g_16r', label: 'Passerelle – 16 m droite', zone: 'Tribune principale', pos: [36, 18.6, -67.9], types: ['plateau', 'hfr3', 'hfr6', 'portable'], role: 'semi', precab: true, desc: 'Alignée sur la ligne de la surface de réparation droite.' },
  { id: 'high_c', label: 'Tribune haute centrale', zone: 'Tribune principale', pos: [0, 33.5, -88], types: ['plateau', 'portable'], role: 'tactique', precab: false, desc: 'Position très haute pour le plan tactique.' },
  { id: 'pitch_c', label: 'Bord terrain – entre les bancs', zone: 'Bord terrain', pos: [0, 1.6, -39.4], types: ['portable', 'steadicam', 'ptz'], role: 'joueur', precab: true, desc: 'Caméra basse au niveau des bancs : joueurs, entraîneurs, remplacements.' },
  { id: 'pitch_gl', label: 'Bord terrain – derrière le but gauche', zone: 'Bord terrain', pos: [-58.6, 1.6, -9], types: ['portable', 'hfr3', 'hfr6', 'plateau'], role: 'serre', precab: true, desc: 'Caméra basse derrière le but : actions dans la surface, buts, gardien.' },
  { id: 'pitch_gr', label: 'Bord terrain – derrière le but droit', zone: 'Bord terrain', pos: [58.6, 1.6, 9], types: ['portable', 'hfr3', 'hfr6', 'plateau'], role: 'serre', precab: true, desc: 'Caméra basse derrière le but droit.' },
  { id: 'end_hl', label: 'Tribune haute derrière le but gauche', zone: 'Virage gauche', pos: [-93, 21.8, 0], types: ['plateau', 'hfr3', 'portable'], role: 'semi', precab: true, desc: 'Axe du but en hauteur : profondeur et lignes de passe.' },
  { id: 'end_hr', label: 'Tribune haute derrière le but droit', zone: 'Virage droit', pos: [93, 21.8, 0], types: ['plateau', 'hfr3', 'portable'], role: 'semi', precab: true, desc: 'Axe du but droit en hauteur.' },
  { id: 'opp_c', label: 'Tribune opposée – centre (contrechamp)', zone: 'Tribune opposée', pos: [0, 9.0, 53.5], types: ['plateau', 'hfr3', 'portable'], role: 'semi', precab: false, desc: 'Contrechamp (reverse) : souvent réservé aux ralentis pour ne pas désorienter le téléspectateur.' },
  { id: 'opp_16l', label: 'Bord terrain opposé – 16 m gauche', zone: 'Bord terrain', pos: [-36, 1.6, 39.5], types: ['portable', 'hfr3', 'plateau'], role: 'serre', precab: false, desc: 'Contrechamp bas.' },
  { id: 'opp_16r', label: 'Bord terrain opposé – 16 m droit', zone: 'Bord terrain', pos: [36, 1.6, 39.5], types: ['portable', 'hfr3', 'plateau'], role: 'serre', precab: false, desc: 'Contrechamp bas.' },
  { id: 'steadi_l', label: 'Steadicam HF – touche gauche', zone: 'Bord terrain', pos: [-26, 1.6, -36.4], types: ['steadicam', 'portable'], role: 'suivi', precab: false, desc: 'Steadicam qui suit l\'action le long de la touche gauche.' },
  { id: 'steadi_r', label: 'Steadicam HF – touche droite', zone: 'Bord terrain', pos: [26, 1.6, -36.4], types: ['steadicam', 'portable'], role: 'suivi', precab: false, desc: 'Steadicam qui suit l\'action le long de la touche droite.' },
  { id: 'pov_l', label: 'Mini-caméra dans le filet gauche', zone: 'But gauche', pos: [-54.3, 2.05, 1.4], types: ['pov'], role: 'but', precab: false, desc: 'Caméra fixe dans le filet : ralentis des buts.' },
  { id: 'pov_r', label: 'Mini-caméra dans le filet droit', zone: 'But droit', pos: [54.3, 2.05, -1.4], types: ['pov'], role: 'but', precab: false, desc: 'Caméra fixe dans le filet droit.' },
  { id: 'rail_opp', label: 'Rail travelling – touche opposée', zone: 'Bord terrain', pos: [0, 0.9, 36.6], types: ['rail'], role: 'suivi', precab: false, desc: 'Chariot motorisé sur rail qui suit le jeu au ras de la pelouse.' },
  { id: 'spider', label: 'Caméra câblée volante', zone: 'Au-dessus du terrain', pos: [0, 16, -10], types: ['spider'], role: 'suivi', precab: false, desc: 'Caméra suspendue à 4 câbles : vues aériennes dynamiques.' },
  { id: 'crane_l', label: 'Grue – angle gauche', zone: 'Bord terrain', pos: [-60, 3.5, -38.4], types: ['grue'], role: 'grue', precab: false, desc: 'Grue télescopique dans l\'angle : plans d\'ambiance et de célébrations.' },
  { id: 'beauty', label: 'Toit – plan beauté', zone: 'Toit', pos: [0, 42.5, 53], types: ['ptz', 'plateau'], role: 'beaute', precab: false, desc: 'Vue générale du stade, pour l\'ouverture et les retours de pub.' },
  { id: 'tunnel', label: 'Sortie du tunnel des joueurs', zone: 'Tunnel', pos: [3.4, 1.7, -42.5], types: ['portable', 'steadicam', 'ptz'], role: 'tunnel', precab: true, desc: 'Entrée des joueurs et sortie à la mi-temps.' },
  { id: 'comm', label: 'Cabine commentateurs', zone: 'Tribune principale', pos: [11.5, 15.1, -65.6], types: ['ptz'], role: 'comm', precab: true, desc: 'Plan des commentateurs.' },
  { id: 'drone', label: 'Drone – zone de vol tribune opposée', zone: 'Extérieur', pos: [-40, 58, 75], types: ['drone'], role: 'beaute', precab: false, desc: 'Vol autorisé uniquement hors du public, avec télépilote certifié.' },
];

export const ANTENNAS = [
  { id: 'ant_main', label: 'Antenne toit tribune principale', pos: [0, 40, -48], gain: 13, kind: 'secteur', on: true },
  { id: 'ant_opp', label: 'Antenne toit tribune opposée', pos: [0, 40, 48], gain: 13, kind: 'secteur', on: false },
  { id: 'ant_l', label: 'Antenne toit virage gauche', pos: [-68, 40, 0], gain: 13, kind: 'secteur', on: false },
  { id: 'ant_r', label: 'Antenne toit virage droit', pos: [68, 40, 0], gain: 13, kind: 'secteur', on: false },
  { id: 'ant_tun', label: 'Antenne tunnel / vestiaires', pos: [0, 3.6, -64], gain: 6, kind: 'omni', on: false },
  { id: 'ant_cpd', label: 'Mât antenne du compound', pos: [-4, 9, -100], gain: 9, kind: 'omni', on: false },
];

// Modulation COFDM : C/N requis (canal gaussien, valeurs DVB-T EN 300 744)
export const MODS = { QPSK: 2, '16QAM': 4, '64QAM': 6 };
export const FECS = { '1/2': 0.5, '2/3': 2 / 3, '3/4': 0.75, '5/6': 5 / 6, '7/8': 7 / 8 };
export const CN_REQ = {
  QPSK: { '1/2': 3.1, '2/3': 4.9, '3/4': 5.9, '5/6': 6.9, '7/8': 7.7 },
  '16QAM': { '1/2': 8.8, '2/3': 11.1, '3/4': 12.5, '5/6': 13.5, '7/8': 13.9 },
  '64QAM': { '1/2': 14.4, '2/3': 16.5, '3/4': 18.0, '5/6': 19.3, '7/8': 20.1 },
};
export const GUARDS = { '1/4': 0.25, '1/8': 0.125, '1/16': 1 / 16, '1/32': 1 / 32 };
export function cofdmBitrate(mod, fec, gi, bwMHz) {
  // Débit utile DVB-T : QPSK 1/2 GI 1/4 = 4,98 Mb/s en 8 MHz
  return 4.98 * (MODS[mod] / 2) * (FECS[fec] / 0.5) * (1.25 / (1 + GUARDS[gi])) * (bwMHz / 8);
}
export const TX_POWERS = [10, 50, 100, 250, 500, 1000]; // mW

// Plan de fréquences (bande 2 GHz). status: 'attrib' = attribué par la coordination, 'occ' = occupé par un autre utilisateur, 'wifi' = bande ISM
export function buildChannels() {
  const ch = [];
  for (let f = 2030; f <= 2490; f += 10) {
    let status = 'libre', user = '';
    if ([2150, 2190, 2230, 2330, 2350].includes(f)) { status = 'attrib'; user = 'Attribué à notre production (coordination)'; }
    if ([2170, 2270, 2280].includes(f)) { status = 'occ'; user = 'Autre diffuseur (liaison HF)'; }
    if ([2090, 2100].includes(f)) { status = 'occ'; user = 'Organisateur (vidéo sécurité)'; }
    if (f >= 2400) { status = 'wifi'; user = 'Bande ISM 2,4 GHz (Wi-Fi des spectateurs)'; }
    ch.push({ f, status, user });
  }
  return ch;
}

export const ND_FILTERS = [
  { label: 'CLEAR', f: 1 }, { label: '1/4 (ND 0.6)', f: 1 / 4 }, { label: '1/8 (ND 0.9)', f: 1 / 8 }, { label: '1/16 (ND 1.2)', f: 1 / 16 }, { label: '1/64 (ND 1.8)', f: 1 / 64 },
];
export const SHUTTERS = [
  { label: 'OFF', v: 0 }, { label: '1/100', v: 100 }, { label: '1/250', v: 250 }, { label: '1/500', v: 500 }, { label: '1/1000', v: 1000 }, { label: '1/2000', v: 2000 },
];
export const GAINS = [-3, 0, 3, 6, 9, 12];
export const IRIS_STOPS = [1.4, 1.7, 2, 2.4, 2.8, 3.4, 4, 4.8, 5.6, 6.7, 8, 9.5, 11, 13, 16, 22];

export const LIGHTING = {
  jour: { label: 'Après-midi ensoleillé', cct: 5600, desc: 'Soleil à 35° : une partie de la pelouse est à l\'ombre de la tribune. L\'ingé vision doit suivre l\'iris entre soleil et ombre.' },
  fin: { label: 'Fin de journée (soleil rasant)', cct: 3600, desc: 'Lumière chaude et rasante, grande ombre portée : contraste très fort.' },
  couvert: { label: 'Ciel couvert', cct: 6500, desc: 'Lumière douce et homogène, plus froide, environ 2 diaphragmes de moins qu\'en plein soleil.' },
  nuit: { label: 'Nuit – éclairage LED du stade', cct: 5700, desc: 'Éclairage de stade (environ 2000 lux) : environ 5 diaphragmes de moins qu\'en plein soleil.' },
};

// ----------------------------------------------------------------------------------
// Contenus pédagogiques
// ----------------------------------------------------------------------------------

export const STATION_INFO = {
  realisateur: {
    title: 'Réalisateur', where: 'Régie production – 1er rang, au centre',
    role: 'Le réalisateur raconte le match en images. Il choisit chaque plan, annonce les caméras au truquiste, demande les ralentis aux opérateurs EVS et donne des consignes de cadrage aux cadreurs par l\'intercom.',
    gear: ['Multiview (mosaïque de toutes les sources)', 'Pupitre intercom à touches : appel général caméras, caméra par caméra, EVS, son, production', 'Parfois un pupitre de réalisation (préparation des sources)'],
    process: ['Avant le match : briefing des cadreurs avec le plan de caméras et les consignes (qui suit quoi)', 'Pendant le direct : annonce « Prépare la 3 »… puis « Top » ou « Envoie la 3 »', 'Sur une action : « EVS A, ralenti sur l\'action, la 2 et la 7 »', 'Gère le rythme : plan large majoritaire, serrés sur les moments forts'],
    tips: ['Toujours annoncer une caméra avant de l\'envoyer : le cadreur voit son tally vert, il sait qu\'il va passer.', 'Éviter de couper pendant un zoom ou un panoramique rapide.', 'Le plan large reste la base : le téléspectateur doit toujours savoir où est le ballon.', 'Ne pas utiliser le contrechamp en direct (inversion de sens) : on le réserve aux ralentis.'],
  },
  scripte: {
    title: 'Scripte / assistant(e) réalisation', where: 'Régie production – à gauche du réalisateur',
    role: 'Gardien(ne) du temps et du conducteur : comptes à rebours, prises d\'antenne, coupures publicitaires, timings. Note les temps forts (timecode) pour les ralentis et les résumés.',
    gear: ['Conducteur (déroulé minuté)', 'Chronomètres, horloge maître (timecode)', 'Intercom et liaison avec le diffuseur'],
    process: ['Annonce : « Antenne dans 1 minute… 30 secondes… 10, 9, 8… Top antenne »', 'Suit la durée des séquences et des pubs', 'Note les actions marquantes avec leur timecode'],
    tips: ['Le timecode vient du générateur de synchro : tout le car est à la même heure.'],
  },
  melangeur: {
    title: 'Truquiste (opérateur mélangeur)', where: 'Régie production – à droite du réalisateur',
    role: 'Exécute en temps réel les commutations demandées par le réalisateur : cut, enchaîné (mix), volet, transitions logo pour les ralentis, incrustations et habillage (DSK). Prépare les effets complexes.',
    gear: ['Dans votre car : mélangeur Sony XVS-6000 (processeur 6U en baie) commandé par un pupitre ICP-X7000 via l\'unité d\'interface MKS-X7700', 'Bus A (programme, rouge) et B (preset, vert), levier de transition, MIX / WIPE / DME / CLIP', '4 keyers par M/E avec redimensionneur 2,5D, DME 3D en option, DSK (habillage aval)', 'Frame memory (images et clips de transition), snapshots et Shotbox, multiviewers intégrés'],
    process: ['La source annoncée est sélectionnée sur le bus PST (tally vert sur la caméra)', 'Au « Top », CUT ou AUTO (transition de durée réglée en images)', 'Le PST et le PGM s\'échangent après chaque transition (flip-flop)', 'Les DSK (score, logo) restent au-dessus de tout, y compris des ralentis'],
    tips: ['Raccourcis de ce simulateur : chiffres = préparer la source, Maj + chiffre = direct au PGM, Espace = CUT, Entrée = AUTO.', 'Une durée de mix de 12 à 25 images est courante ; un volet logo dure environ 1 s.', 'La sortie « clean feed » est le PGM sans les DSK : on la livre aux diffuseurs étrangers.'],
  },
  habillage: {
    title: 'Habillage (graphiste temps réel)', where: 'Régie production – 2e rang',
    role: 'Fait apparaître les éléments graphiques : score et chrono, bandeaux nom des joueurs, compositions, statistiques. Les graphiques sont produits par un moteur temps réel et envoyés au mélangeur sous forme de deux signaux : remplissage (fill) et découpe (key).',
    gear: ['Moteur graphique temps réel (type Vizrt, Chyron, Ross XPression, Singular)', 'Données externes : chronomètre officiel, fournisseur de statistiques', 'Sorties fill + key vers les DSK du mélangeur'],
    process: ['Les modèles sont préparés avant le direct (charte graphique du diffuseur)', 'Le score/chrono est en général permanent (DSK 1)', 'Les bandeaux sont « cuées » puis jouées sur ordre du réalisateur'],
    tips: ['Si le DSK correspondant n\'est pas à l\'antenne au mélangeur, le graphique ne se voit pas au PGM.'],
  },
  producteur: {
    title: 'Producteur / éditorial', where: 'Régie production – 2e rang',
    role: 'Représente le diffuseur : contenu éditorial, interventions des consultants, gestion des pubs et des duplex, relations avec la chaîne.',
    gear: ['Intercom, téléphone avec la chaîne, retour antenne'],
    process: ['Valide le conducteur', 'Décide des séquences (interviews, statistiques, sujets)'],
    tips: [],
  },
  chefdecar: {
    title: 'Chef de car', where: 'Régie production – 2e rang / zone technique',
    role: 'Responsable technique du car et de l\'installation : configuration (grille, multiview, intercom, tally), coordination de l\'équipe technique, essais avec le diffuseur, dépannage pendant le direct, sécurité électrique.',
    gear: ['Synoptique de l\'installation', 'Accès à la grille, aux alarmes, aux mesures', 'Intercom avec toute l\'équipe et le diffuseur (coordination technique)'],
    process: ['Avant : plan de câblage, affectation des CCU, des entrées EVS et du multiview', 'Line-up : mires, vérification des liaisons, test transmission avec la chaîne', 'Pendant : surveille les alarmes, anticipe les secours (redondance TX, alimentation)', 'Après : démontage, rapport technique'],
    tips: ['Poste de contrôle : ouvrez le simulateur de pannes pour vous entraîner au dépannage.'],
  },
  vision: {
    title: 'Ingénieur(e) vision', where: 'Régie vision',
    role: 'Règle l\'image de chaque caméra à distance : exposition (iris), niveau de noir, colorimétrie, gain, filtres. Égalise toutes les caméras entre elles (matching) pour que les coupes soient invisibles. Suit la lumière en direct (nuages, ombre et soleil).',
    gear: ['RCP (Remote Control Panel) : un par caméra, joystick iris / noir', 'MSU / MCP : pupitre maître pour les menus et fichiers de scène', 'Moniteur de référence Grade 1 (type Sony BVM-HX310) dans une lumière d\'ambiance contrôlée', 'Oscilloscope (waveform) et vecteurscope (type Telestream PRISM, Leader LV5600)'],
    process: ['Line-up : balance des noirs (iris fermé), balance des blancs sur une charte, chargement des fichiers de scène', 'Matching : même niveau de noir, même balance des blancs, même gamma et même saturation pour toutes les caméras', 'Direct : « riding » de l\'iris en continu, ajustements fins des couleurs'],
    tips: ['Repères : pelouse en plein soleil vers 40-55 %, maillot blanc sous 100 %, noirs à 0-2 %.', 'Ouvrir l\'iris d\'un diaphragme double la lumière ; +6 dB de gain aussi, mais avec du bruit.', 'Au téléobjectif, l\'ouverture maximale diminue (ramping) : l\'image peut s\'assombrir quand le cadreur zoome.', 'Les caméras super ralenti reçoivent 3 ou 6 fois moins de lumière par image.'],
  },
  brassage: {
    title: 'Baie de brassage (jackfield)', where: 'Zone technique',
    role: 'Panneaux de jacks vidéo, audio et référence placés entre les appareils et la grille : on y dérive, remplace ou contourne une liaison avec un cordon, sans toucher au câblage arrière.',
    gear: ['Jackfields vidéo (prises « normalées » : sans cordon, le signal passe directement)', 'Cordons de brassage 75 Ω', 'Liste de câblage et étiquetage des deux extrémités'],
    process: ['Installation : vérifier chaque liaison avec la liste de câblage', 'Dépannage : brasser une source de secours ou un appareil de remplacement', 'Toujours remettre les normales après un dépannage, et le noter'],
    tips: ['Un cordon inséré coupe la normale : la destination ne reçoit plus que le cordon.', 'Erreur classique : caméra brassée sur la mauvaise entrée de grille → nom faux au multiview et tally faux.'],
  },
  ipdirector: {
    title: 'IPDirector (gestion des médias EVS)', where: 'Régie ralentis',
    role: 'Gère la base de données des clips du serveur EVS : log des actions avec mots-clés pendant le direct, nommage et classement des clips, montage de playlists (résumés, meilleurs moments), contrôle des canaux, transferts vers le montage.',
    gear: ['Station de travail IPDirector reliée aux serveurs XT4K (réseau 10 GbE)', 'Moniteurs des canaux de lecture', 'Intercom avec l\'opérateur ralenti et le réalisateur'],
    process: ['Pendant le jeu : logger chaque action (BUT, TIR, FAUTE…) au bon timecode', 'Transformer les logs en clips, les nommer, ajouter joueurs et notes', 'À la mi-temps et à la fin : monter les playlists du résumé et les envoyer à l\'antenne ou au montage'],
    tips: ['Un clip créé ici apparaît aussi sur la télécommande LSM (même base de données).', 'Des mots-clés cohérents (toujours « TIR », jamais « frappe ») rendent la recherche instantanée.'],
  },
  evs: {
    title: 'Opérateur ralenti (EVS / LSM)', where: 'Régie ralentis',
    role: 'Enregistre en permanence plusieurs caméras sur le serveur et sort les ralentis à la demande du réalisateur, avec le bon angle et la bonne vitesse. Prépare aussi les résumés et les moments forts.',
    gear: ['Dans votre car : serveur EVS XT4K (4 canaux UHD ou 8 à 12 canaux HD selon la configuration)', 'Télécommande LSM (logiciel Multicam) : levier, jog, touches F, IN / OUT, PLST, TAKE', 'Poste IPDirector : base de données des clips, log, playlists', 'Moniteurs des sorties de lecture et écran du serveur (clip screen)'],
    process: ['Après une action : retour en arrière, MARK IN quelques secondes avant', 'Choix de l\'angle (toutes les caméras enregistrées sont synchronisées en timecode)', 'Le réalisateur envoie la sortie EVS au mélangeur, l\'opérateur lance la lecture au levier (25 à 50 % le plus souvent)', 'Pour une caméra super ralenti (3x), 33 % reste parfaitement fluide'],
    tips: ['Une caméra 3x occupe 3 entrées d\'enregistrement (une par phase).', 'Ralentir une caméra 50 i/s à 25 % fait répéter chaque image 4 fois : le mouvement saccade.', 'Raccourcis : Espace = lecture/pause, I = MARK IN, O = MARK OUT, L = live, flèches = jog image par image.'],
  },
  son: {
    title: 'Ingénieur(e) du son', where: 'Régie son (cabine isolée)',
    role: 'Mixe le son du programme : ambiance des tribunes, micros bord terrain (frappes de balle, coups de sifflet), commentaires. Fournit le son international (sans commentaires), gère les retours des commentateurs (N-1) et la conformité de loudness.',
    gear: ['Console numérique (type Lawo mc², Calrec Artemis/Apollo)', 'Micros : canons bord terrain, couples d\'ambiance en tribune, micros commentateurs', 'Liaisons MADI / Dante / ST 2110-30, embedding de l\'audio dans le SDI', 'Mesure de loudness (EBU R128)'],
    process: ['Installation des micros par l\'équipe son (chef OPS)', 'Line-up : 1 kHz à -18 dBFS sur toutes les liaisons', 'Direct : équilibre ambiance / effets / commentaires, cible -23 LUFS'],
    tips: ['EBU R128 : -23 LUFS intégré, true peak maximum -1 dBTP.', 'Le son voyage avec l\'image : 16 canaux audio peuvent être embeddés dans un flux SDI.'],
  },
  hf: {
    title: 'Technicien(ne) HF', where: 'Zone technique / car HF',
    role: 'Installe et exploite les liaisons sans fil : émetteurs des caméras HF, antennes réceptrices, récepteurs. Choisit les fréquences attribuées, la modulation et la puissance, surveille la marge de réception.',
    gear: ['Émetteurs COFDM au dos des caméras (type Vislink, Domo/Cobham)', 'Antennes réceptrices (panneaux secteur, omnidirectionnelles) en toit de tribune, reliées par fibre (RF sur fibre)', 'Récepteurs en diversité (4 à 8 antennes combinées)', 'Analyseur de spectre'],
    process: ['Demande de fréquences auprès de la coordination (en France, l\'ANFR ou le coordinateur de l\'événement)', 'Pose des antennes pour couvrir toutes les zones (terrain, tunnel, vestiaires)', 'Réglage modulation / débit / latence, test de couverture en marchant', 'Surveillance en direct : niveaux, MER, marge'],
    tips: ['64-QAM = beaucoup de débit (belle image) mais demande environ 18 dB de rapport signal/bruit ; QPSK passe partout mais compresse davantage.', 'Ne jamais utiliser la bande Wi-Fi 2,4 GHz : elle est saturée par les téléphones du public.', 'Plusieurs antennes en diversité évitent les coupures dues aux évanouissements (fading).'],
  },
  grille: {
    title: 'Grille de commutation (router)', where: 'Baie technique',
    role: 'La grille relie n\'importe quelle source à n\'importe quelle destination : entrées du mélangeur, tuiles du multiview, entrées d\'enregistrement EVS, départs vers la chaîne, moniteurs. C\'est le cœur de la configuration du car.',
    gear: ['Matrice SDI ou IP (type Evertz EQX, Grass Valley NV, Ross Ultrix) de plusieurs centaines d\'entrées/sorties', 'Panneaux de commande X-Y, système de contrôle (broadcast controller)', 'Gestion des noms de sources (UMD) et du tally'],
    process: ['Choisir la destination, puis la source, puis TAKE', 'Préparer des « salvos » (configurations complètes) avant le direct'],
    tips: ['Une erreur sur la grille peut envoyer du noir à la chaîne : vérifiez toujours le retour antenne.'],
  },
  ccu: {
    title: 'Baie CCU (voies caméras)', where: 'Baie technique',
    role: 'Chaque caméra a sa CCU (Camera Control Unit) dans le car. La CCU alimente la caméra par le câble, reçoit l\'image, renvoie le retour vidéo, l\'intercom, le tally et la référence, et relaie les réglages du RCP.',
    gear: ['CCU (type Sony HDCU, GV XCU) avec connecteur SMPTE ou triax', 'Adaptateurs fibre SM pour le pré-câblage', 'Sorties 12G/3G-SDI ou IP vers la grille'],
    process: ['Mise sous tension caméra par caméra (vérifier le niveau optique reçu)', 'Vérifier la référence (genlock) et le format', 'Barres caméra pour identifier chaque liaison'],
    tips: ['Niveau optique typique sur une fibre : -5 à -15 dBm. En dessous d\'environ -20 dBm, la liaison décroche.'],
  },
  synchro: {
    title: 'Générateur de synchro (SPG) et timecode', where: 'Baie technique',
    role: 'Tous les équipements doivent être synchronisés sur la même référence pour pouvoir commuter sans saut d\'image. Le SPG fournit cette référence, l\'heure (timecode) et l\'horloge audio.',
    gear: ['SPG (type Telestream/Tektronix SPG8000A, Evertz 5601) verrouillé sur le GPS', 'Sorties black burst et tri-level, LTC, word clock audio, PTP (grand maître) pour l\'IP', 'Généralement doublé (principal + secours avec bascule automatique)'],
    process: ['Toutes les CCU, le mélangeur, les EVS, les multiviews reçoivent la référence', 'Les sources externes non synchrones passent par un synchroniseur d\'images'],
    tips: ['Sans genlock, une source « saute » ou roule à la commutation.', 'Le timecode commun permet de retrouver la même action sur toutes les caméras EVS.'],
  },
  transmission: {
    title: 'Transmission vers le diffuseur', where: 'Baie technique / car satellite',
    role: 'Le programme (PGM avec son) est envoyé à la chaîne : c\'est la contribution. On utilise en général deux chemins indépendants (principal et secours) et on contrôle le retour antenne.',
    gear: ['Encodeurs (HEVC, JPEG XS) ou liaisons non compressées', 'Fibre opérateur, réseau IP managé, DSNG (camion satellite)', 'Récepteur du retour antenne'],
    process: ['Test de ligne : mire + 1 kHz, identification (ident), vérification de la qualité', 'Pendant le direct : surveiller le retour antenne'],
    tips: ['Le retour antenne arrive avec un délai (encodage, satellite environ 250 ms par bond, décodage). Ne jamais réaliser en regardant le retour.'],
  },
  intercom: {
    title: 'Intercom (ordres)', where: 'Baie technique + pupitres à chaque poste',
    role: 'Le système d\'ordres relie toute l\'équipe : réalisateur, cadreurs (par la CCU), EVS, son, production, chaîne, commentateurs. C\'est vital : sans intercom, pas de réalisation.',
    gear: ['Matrice numérique (type Riedel Artist, Clear-Com Eclipse)', 'Pupitres à touches à chaque poste, beltpacks sans fil (type Riedel Bolero)', 'Liaisons 4 fils vers la chaîne et les commentateurs'],
    process: ['Configuration des touches par poste avant le direct', 'Test de chaque position'],
    tips: ['Les cadreurs entendent l\'ordre via leur casque branché sur la caméra (canal transporté par la fibre SMPTE).'],
  },
  pieddecar: {
    title: 'Pied de car (panneau de raccordement)', where: 'Côté extérieur du car',
    role: 'Tous les câbles arrivent ici : caméras (SMPTE, triax, fibres), audio (multipaires, MADI), intercom, transmissions, énergie. Le panneau est relié en interne à la baie technique.',
    gear: ['Embases SMPTE 3K.93C, triax, fibres LC/ST/Opticalcon, BNC', 'Prises énergie (P17 32/63/125 A tri) et borne de terre'],
    process: ['Repérer chaque câble (étiquettes) et suivre le plan de câblage', 'Protéger les connecteurs (bouchons), ne pas laisser de câble sous tension en passage'],
    tips: ['Une connexion SMPTE sale (poussière sur la fibre) peut faire chuter le niveau optique : nettoyer avant de brancher.'],
  },
  energie: {
    title: 'Énergie', where: 'Compound',
    role: 'Le car consomme des dizaines de kW. Il est alimenté par le réseau du stade ou un groupe électrogène, avec un onduleur pour tenir pendant une bascule.',
    gear: ['Groupe électrogène (plusieurs centaines de kVA), tableau de distribution', 'Onduleur (UPS) dans le car', 'Mise à la terre (piquet de terre)'],
    process: ['Raccordement et vérification de la terre avant toute mise sous tension', 'Mesure des tensions et de l\'équilibre des phases'],
    tips: ['Prévoir toujours un secours : groupe + réseau, ou deux groupes.'],
  },
  cadreur: {
    title: 'Cadreur (OPV)', where: 'Positions caméras dans le stade',
    role: 'Le cadreur (opérateur de prise de vue) cadre et fait le point selon les consignes du réalisateur, qu\'il entend dans son casque. Il voit dans son viseur son image, le tally, et peut basculer sur le retour programme.',
    gear: ['Caméra + objectif, viseur, télécommandes zoom et point', 'Casque intercom', 'Tally rouge (à l\'antenne) et vert (préparé)'],
    process: ['Installation et réglage de la tête (équilibre), test avec la vision', 'Pendant le direct : anticiper l\'action, garder un cadre propre quand le tally est rouge'],
    tips: ['Tally rouge : pas de mouvement brusque, pas de recadrage.', 'Le doubleur (x2) double la focale mais fait perdre 2 diaphragmes.'],
  },
  antenne: {
    title: 'Antenne de réception HF', where: 'Toit, tunnel, compound',
    role: 'Reçoit le signal des émetteurs HF des caméras. Le signal est ramené au car par fibre. Plusieurs antennes sont combinées en diversité.',
    gear: ['Antenne panneau secteur (gain élevé, directive) ou omnidirectionnelle', 'Préamplificateur et convertisseur RF/fibre'],
    process: ['Viser la zone à couvrir, éviter les masques (béton, tribunes)'],
    tips: ['Le béton et les tribunes atténuent fortement le signal : une antenne dans le tunnel est indispensable pour suivre les joueurs depuis les vestiaires.'],
  },
  localtv: {
    title: 'Local technique TV du stade', where: 'Sous la tribune principale',
    role: 'Point d\'arrivée du pré-câblage du stade : les fibres et câbles des positions caméras et commentateurs aboutissent ici, sur des panneaux de brassage. On y raccorde les câbles venant du compound.',
    gear: ['Panneaux de brassage fibre, multipaires audio, prises SMPTE pré-installées'],
    process: ['Vérifier l\'état des fibres (mesure de perte) lors du repérage'],
    tips: ['Le pré-câblage évite des centaines de mètres de tirage de câbles, mais transporte rarement l\'alimentation.'],
  },
  commentateurs: {
    title: 'Cabine des commentateurs', where: 'Tribune de presse',
    role: 'Les commentateurs voient le terrain et un moniteur du programme. Leur unité de commentaire (micros-casques) envoie leur voix au car et reçoit un retour N-1 et les ordres.',
    gear: ['Unité de commentaire (type Glensound)', 'Moniteur PGM, liaison 4 fils / IP vers le car'],
    process: ['Test des micros et des retours au line-up'],
    tips: ['Le retour N-1 contient tout le programme sauf leur propre voix, pour éviter l\'écho.'],
  },
  var: {
    title: 'Assistance vidéo (VAR)', where: 'Salle VAR (stade ou centre déporté)',
    role: 'Les arbitres vidéo reçoivent les flux de nombreuses caméras du car (dont les super ralentis et les caméras hors-jeu) sur leurs propres serveurs de relecture.',
    gear: ['Serveurs de relecture dédiés, liaisons depuis la grille du car'],
    process: ['Le car livre des sorties ISO de caméras à la VAR'],
    tips: [],
  },
};

export const GLOSSARY = [
  ['SDI', 'Serial Digital Interface : vidéo numérique non compressée sur câble coaxial 75 Ω (BNC). HD-SDI 1,485 Gb/s (SMPTE ST 292), 3G-SDI 2,97 Gb/s (ST 424) pour le 1080p50, 12G-SDI 11,88 Gb/s (ST 2082) pour l\'UHD sur un seul câble. Transporte aussi l\'audio embeddé (16 canaux), le timecode et des données.'],
  ['Quad-link / 2SI', 'UHD transporté sur 4 liens 3G-SDI : découpage en quadrants (Square Division) ou entrelacement de 2 échantillons (2SI).'],
  ['SMPTE ST 2110', 'Transport de la vidéo (-20), de l\'audio (-30) et des données (-40) non compressés sur IP en flux séparés, synchronisés par PTP.'],
  ['PTP', 'Precision Time Protocol (IEEE 1588 / SMPTE ST 2059) : la référence de synchronisation des installations IP, fournie par un grand maître.'],
  ['Genlock / référence', 'Verrouillage de tous les équipements sur le même signal de synchronisation venant du SPG. Sans genlock, commuter entre deux sources provoque un saut d\'image.'],
  ['Black burst / tri-level', 'Signaux de référence : black burst (analogique 625 lignes) et tri-level (HD, impulsion à trois niveaux).'],
  ['SPG', 'Sync Pulse Generator : générateur de synchro, souvent asservi au GPS. Fournit référence, timecode, horloge audio et PTP.'],
  ['Timecode', 'Heure codée HH:MM:SS:II (heures, minutes, secondes, images). 25 images par seconde en Europe (50 Hz).'],
  ['CCU', 'Camera Control Unit : voie caméra dans le car. Alimente la caméra, reçoit l\'image, renvoie retour vidéo, intercom, tally et référence.'],
  ['RCP', 'Remote Control Panel : pupitre de réglage d\'une caméra par l\'ingénieur vision (iris, noir, blancs, gain…).'],
  ['MSU / MCP', 'Pupitre maître de configuration de toutes les caméras (menus, fichiers de scène).'],
  ['Tally', 'Lampe rouge (à l\'antenne) ou verte (préparée) sur la caméra, le viseur et le multiview, pilotée par le mélangeur.'],
  ['UMD', 'Under Monitor Display : étiquette de nom de source sous chaque image du multiview.'],
  ['Multiview', 'Processeur qui affiche de nombreuses sources sur un écran, avec étiquettes, tally, horloges, vumètres et alarmes (perte de signal, image figée, noir).'],
  ['Mélangeur', 'Vision mixer / switcher : commute et mélange les sources. Bus PGM/PST, transitions, keyers, DVE, DSK.'],
  ['PGM / PST', 'Programme (ce qui est à l\'antenne, tally rouge) et Preset ou Preview (ce qui est prêt à passer, tally vert).'],
  ['M/E', 'Mix/Effect : étage de mélange. Les grands mélangeurs en ont 3 à 5 pour préparer des effets.'],
  ['DSK', 'Downstream Keyer : incrustation en aval des M/E, pour l\'habillage permanent (score, logo).'],
  ['Clean feed', 'Programme sans habillage (sans DSK), livré aux diffuseurs qui ajoutent leurs propres graphiques.'],
  ['Signal international', 'Image + son international (ambiance sans commentaire) livrés à tous les diffuseurs.'],
  ['DVE', 'Digital Video Effects : redimensionnement et déplacement d\'image (image dans l\'image, PiP).'],
  ['Fill / Key', 'Les deux signaux d\'un graphique : l\'image (fill) et sa découpe noir et blanc (key).'],
  ['Volet logo / stinger', 'Transition animée avec le logo, utilisée pour entrer et sortir des ralentis.'],
  ['Serveur ralenti (EVS)', 'Serveur qui enregistre en boucle plusieurs caméras et permet de relire n\'importe quel moment, à n\'importe quelle vitesse.'],
  ['LSM', 'Live Slow Motion : télécommande du serveur ralenti avec levier de vitesse et molette jog.'],
  ['MARK IN / OUT', 'Points d\'entrée et de sortie d\'un clip.'],
  ['HFR / super ralenti', 'High Frame Rate : caméra à 150 i/s (3x) ou 300 i/s (6x). Chaque phase sort sur une sortie SDI enregistrée par l\'EVS, d\'où des ralentis fluides.'],
  ['Grille / router', 'Matrice de commutation : n\'importe quelle source vers n\'importe quelle destination.'],
  ['Jackfield / patch', 'Panneau de brassage manuel (BNC, fibres) pour les secours et les dépannages.'],
  ['Synchroniseur d\'images', 'Frame sync : remet en phase une source externe non verrouillée.'],
  ['Embedding', 'Insertion de l\'audio dans le flux SDI (et désembedding : extraction).'],
  ['MADI', 'AES10 : 64 canaux audio numériques sur un coaxial ou une fibre.'],
  ['N-1', 'Mix-minus : retour audio contenant tout le programme sauf la voix de celui qui l\'écoute.'],
  ['HDR / HLG', 'Haute dynamique. HLG (Hybrid Log-Gamma, ITU-R BT.2100) est le plus utilisé en direct ; on dérive souvent le SDR (BT.709) depuis le HDR.'],
  ['BT.709 / BT.2020', 'Espaces colorimétriques de la HD et de l\'UHD.'],
  ['Waveform', 'Oscilloscope de forme d\'onde : niveau de luminance de chaque colonne de l\'image, de 0 % (noir) à 100 % (blanc nominal, 700 mV).'],
  ['Vecteurscope', 'Affiche la chrominance : l\'angle donne la teinte, la distance au centre la saturation. Un blanc ou un gris parfaitement balancé est au centre.'],
  ['Super-blancs', 'Niveaux au-dessus de 100 %, jusqu\'à 109 % (écrêtage). À éviter dans le programme.'],
  ['Iris / diaphragme', 'Ouverture de l\'objectif : f/1.7 très ouvert, f/16 fermé. Un diaphragme (stop) double ou divise par deux la lumière.'],
  ['Ramping', 'Perte de luminosité d\'un zoom en longue focale (par exemple f/1.7 qui devient f/4.4 au maximum du zoom).'],
  ['Doubleur', 'Extender x2 intégré au zoom : double la focale, fait perdre 2 diaphragmes.'],
  ['Angle de champ', 'Angle horizontal = 2 × arctan(largeur capteur / (2 × focale)). Pour un capteur 2/3" (9,59 mm) : 58° à 8,6 mm, 1,4° à 400 mm.'],
  ['Filtre ND', 'Densité neutre : réduit la lumière sans changer les couleurs (1/4 = -2 diaphragmes).'],
  ['Balance des blancs', 'Égalisation des gains rouge et bleu pour qu\'un blanc soit neutre sous la lumière du moment.'],
  ['Balance des noirs', 'Égalisation des niveaux de noir R/V/B, iris fermé.'],
  ['Knee', 'Compression des hautes lumières pour garder du détail dans les blancs.'],
  ['Detail', 'Accentuation électronique des contours.'],
  ['Gain', 'Amplification du signal en dB : +6 dB = un diaphragme de plus, mais plus de bruit.'],
  ['Shutter', 'Obturateur électronique : temps d\'exposition plus court, moins de flou de bougé, moins de lumière.'],
  ['Scintillement (flicker)', 'Les lampes à décharge alimentées en 50 Hz pulsent 100 fois par seconde. Invisible à 50 i/s, mais visible en super ralenti si l\'éclairage n\'est pas « flicker-free ».'],
  ['Matching', 'Égaliser toutes les caméras (niveaux, noirs, couleurs) pour que les coupes soient invisibles.'],
  ['COFDM', 'Modulation multiporteuse très robuste aux échos (celle de la TNT, DVB-T), utilisée par les liaisons HF caméras.'],
  ['QPSK / 16-QAM / 64-QAM', 'Ordres de modulation : plus il est élevé, plus le débit est grand, mais plus il faut de rapport signal/bruit.'],
  ['FEC', 'Correction d\'erreurs (1/2 … 7/8) : un taux faible (1/2) est plus robuste mais réduit le débit utile.'],
  ['Intervalle de garde', 'Temps de protection entre symboles OFDM contre les échos (1/4 à 1/32).'],
  ['C/N, MER', 'Rapport porteuse/bruit et taux d\'erreur de modulation : la « santé » d\'une liaison HF, en dB.'],
  ['Diversité', 'Réception combinée sur plusieurs antennes pour éviter les coupures.'],
  ['Latence', 'Retard introduit par l\'encodage et le décodage (HF, IP compressé, satellite).'],
  ['DSNG', 'Digital Satellite News Gathering : camion d\'émission satellite.'],
  ['Contribution', 'Liaison du car vers la chaîne (fibre, IP, satellite).'],
  ['Retour antenne', 'Le signal tel qu\'il est diffusé, reçu en retour pour contrôle.'],
  ['EBU R128', 'Recommandation de loudness : -23 LUFS intégré, true peak ≤ -1 dBTP.'],
  ['Car régie', 'OB van (Outside Broadcast) : régie mobile complète dans un semi-remorque, souvent extensible.'],
  ['Compound', 'Parc technique où stationnent les cars, groupes et camions satellites.'],
  ['Pré-câblage', 'Infrastructure fibre/cuivre installée à demeure dans le stade entre les positions et le local TV.'],
  ['Conducteur', 'Déroulé minuté de l\'émission.'],
  ['Line-up', 'Phase de réglages et de tests avant le direct (mires, alignement, matching, transmissions).'],
  ['Mire', 'Signal de test : barres de couleur et 1 kHz à -18 dBFS pour aligner les niveaux.'],
  ['ISO', 'Enregistrement ou sortie isolée d\'une caméra.'],
  ['CNS (camera network system)', 'Réseau des caméras système : relie CCU, RCP et pupitre maître (MSU/MCP) en Ethernet et gère quel pupitre commande quelle caméra.'],
  ['PANEL ACTIVE', 'Touche du RCP qui autorise ou verrouille les réglages. Éteinte, les potentiomètres ne font plus rien : on protège une caméra réglée.'],
  ['CAM PW', 'Touche du RCP qui commande l\'alimentation de la tête de caméra par la CCU, à travers la fibre hybride. On coupe toujours avant de débrancher un câble caméra.'],
  ['CALL', 'Appel : fait clignoter le tally du cadreur (et du RCP) pour attirer son attention sans parler sur l\'ordre général.'],
  ['PREVIEW (RCP)', 'Envoie la caméra du RCP sur le moniteur de référence de la vision, via une sortie AUX de la grille.'],
  ['CHARACTER (sortie)', 'Sortie vidéo de la CCU avec incrustation des menus et des informations de la caméra, pour un moniteur de contrôle.'],
  ['Flare', 'Voile de lumière parasite dans l\'optique qui relève les noirs. La compensation de flare (R/G/B) le corrige.'],
  ['Black gamma', 'Réglage qui relève ou écrase les basses lumières sans toucher au noir ni au blanc : utile pour déboucher les ombres.'],
  ['Master black / pedestal', 'Niveau du noir pour les trois couleurs. Repère : noirs posés entre 0 et 2 % à l\'oscilloscope.'],
  ['Matrice (colorimétrie)', 'Réglage des couleurs de la caméra (saturation, teintes) : sert à égaliser des caméras de modèles différents.'],
  ['Skin detail', 'Réduction du détail sur les tons chair, pour adoucir les visages.'],
  ['Zébra', 'Hachures dans le viseur sur les zones au-dessus d\'un niveau choisi (par exemple 95 %).'],
  ['Fichier de scène', 'Mémoire de tous les réglages de rendu d\'une caméra (noirs, gamma, knee, détail, couleurs), rappelée en une touche.'],
  ['Fibre hybride SMPTE', 'Câble caméra normalisé (ST 311) : deux fibres monomodes et des conducteurs d\'alimentation, connecteur ST 304 (type LEMO 3K.93C).'],
  ['Niveau optique', 'Puissance lumineuse reçue sur la fibre, en dBm, affichée par la CCU. Une chute signale un connecteur sale ou une fibre pincée.'],
  ['Fibre monomode', 'Fibre à cœur très fin (9 µm), peu de pertes sur des kilomètres ; très sensible à la poussière sur les connecteurs.'],
  ['Retour (RET) / prompteur', 'Signaux envoyés du car vers la caméra : le programme dans le viseur du cadreur, le texte du prompteur.'],
  ['PROD / ENG', 'Les deux canaux d\'intercom d\'une caméra système : production (réalisateur) et technique (vision, chef de car).'],
  ['Partyline / conférence', 'Groupe d\'intercom où tous les membres s\'entendent.'],
  ['IFB', 'Interruptible foldback : programme envoyé dans un casque (commentateur), atténué quand la production parle.'],
  ['4 fils', 'Liaison audio avec une paire par sens, sans mélange : pour relier deux systèmes d\'intercom.'],
  ['TSL UMD', 'Protocole qui transporte le tally et les noms de sources (UMD) du mélangeur vers le multiview et les CCU ; la version 5 fonctionne sur IP.'],
  ['ST 2022-6', 'Transport d\'un signal SDI complet (avec suppressions) dans des paquets IP.'],
  ['ST 2022-7', 'Redondance « sans coupure » : chaque flux IP est envoyé sur deux réseaux séparés ; le récepteur reconstitue le signal à partir des deux copies.'],
  ['NMOS IS-04 / IS-05', 'Normes AMWA pour l\'IP : IS-04 = les appareils s\'annoncent sur le réseau ; IS-05 = le contrôleur établit les connexions (l\'équivalent du TAKE).'],
  ['Grand maître PTP', 'Horloge de référence du réseau IP, asservie au GPS ; les commutateurs la relaient (boundary clocks).'],
  ['JPEG XS', 'Compression légère à très faible latence (une fraction d\'image), utilisée pour la contribution et la production à distance.'],
  ['Holdover', 'Mode d\'un générateur de synchro qui a perdu le GPS : son oscillateur interne garde une référence stable pendant des heures.'],
  ['Word clock', 'Horloge audio (48 kHz) distribuée aux équipements son pour qu\'ils échantillonnent tous au même rythme.'],
  ['Salvo', 'Ensemble de points de croisement de la grille, enregistré et rappelé en une seule action.'],
  ['Point de croisement', 'Liaison établie dans la grille entre une entrée et une sortie. Une entrée peut alimenter plusieurs sorties ; une sortie ne reçoit qu\'une entrée.'],
  ['Pied de car', 'Panneau de connexion à l\'extérieur du car : embases caméras (SMPTE, triax, fibres), BNC, audio, réseau, énergie.'],
  ['Train (EVS)', 'Enregistrement continu d\'une entrée du serveur, en boucle. Tous les trains partagent le timecode.'],
  ['Clip (EVS)', 'Points IN et OUT sur les trains, avec tous les angles ; rangé sur une touche (ex. 111A = page 1, banque 1, F1, angle A).'],
  ['Page / banque', 'Organisation des clips sur la télécommande LSM : chaque page contient des banques de 10 touches F.'],
  ['Playlist (EVS)', 'Suite de clips enchaînés (cut, mix, volet) : résumés, meilleurs moments, écran géant.'],
  ['E/E (LIVE)', 'Electronic to electronic : la sortie du serveur montre l\'entrée en direct, sans retard. État d\'attente entre deux ralentis.'],
  ['Fast jog', 'Mode de la molette qui parcourt les enregistrements beaucoup plus vite qu\'image par image.'],
  ['Var Max', 'Réglage de la vitesse maximale du levier (par exemple pour aller au-delà de 100 %).'],
  ['Phases (super ralenti)', 'Une caméra 3x à 150 i/s sort trois flux à 50 i/s (phases A, B, C), enregistrés séparément puis recombinés par le serveur.'],
  ['Super Motion', 'Enregistrement des caméras rapides (plusieurs phases) par le serveur EVS ; les phases d\'une même caméra vont sur le même serveur. En UHD, un XT4K n\'a que 4 canaux.'],
  ['XT4K', 'Serveur EVS de génération UHD : 4 canaux UHD-4K sur un seul câble 12G-SDI, ou 8 canaux HD (12 avec ChannelMAX), stockage interne jusqu\'à 9 To.'],
  ['ChannelMAX', 'Configuration EVS qui augmente le nombre de canaux HD d\'un serveur (12 et plus sur un XT4K).'],
  ['Multicam (LSM)', 'Logiciel des serveurs EVS piloté par la télécommande LSM : trains, clips en pages et banques, playlists.'],
  ['RETURN (LSM)', 'Dans un clip, retourne sur la même image du train d\'enregistrement pour aller au-delà des points IN/OUT.'],
  ['TAKE (LSM)', 'Échange PGM et PRV (mode PGM + PRV) ou le contenu des deux PGM (mode 2 PGM).'],
  ['BROWSE (LSM)', 'Parcourt les clips de la base avec la molette jog.'],
  ['XVS-6000', 'Mélangeur de production Sony (processeur 6U) : en 4K, 2 M/E et 16 entrées dans la configuration de base ; davantage en HD.'],
  ['ICP-X7000', 'Pupitre modulaire des mélangeurs Sony XVS : rangées M/E, boutons XPT RVB, afficheurs OLED des noms de sources.'],
  ['Frame memory', 'Mémoire d\'images du mélangeur (480 Go sur la gamme XVS) : images fixes, clips, transitions « clip » (logo animé).'],
  ['Snapshot', 'Mémoire d\'état du mélangeur (sources, clés, transitions) rappelée en une touche.'],
  ['Bus A / B (flip-flop)', 'Sur les mélangeurs Sony, le bus A porte le programme et le B le preset : après chaque transition, ils s\'échangent pour que A reste à l\'antenne.'],
  ['XNet', 'Réseau qui relie les serveurs EVS entre eux pour partager trains et clips.'],
  ['IPDirector', 'Logiciel de gestion des serveurs EVS : log, clips, playlists, transferts.'],
  ['Codes 64-940', 'Niveaux de la vidéo numérique 10 bits : 64 = noir (0 %), 940 = blanc nominal (100 %), jusqu\'à 1019 pour les super-blancs.'],
  ['dBFS / dBTP', 'dBFS : niveau numérique, 0 dBFS = le maximum. dBTP : crête vraie, mesurée entre les échantillons (limite R128 : −1 dBTP).'],
  ['Frame sync (synchroniseur)', 'Appareil qui réaligne une source non synchronisée sur la référence, au prix d\'une image de retard.'],
  ['Lip-sync', 'Alignement du son et de l\'image ; on retarde l\'audio pour compenser les traitements vidéo.'],
  ['OTDR / réflectomètre', 'Appareil qui envoie une impulsion dans une fibre et localise les pertes et les coupures, à la distance près.'],
];

export const GUIDE = [
  {
    id: 'deroule', title: 'Déroulé d\'une production', html: `
<p>Une captation de match se prépare plusieurs jours à l'avance et s'installe en général la veille (J-1) ou le matin même.</p>
<ol class="steps">
<li><b>Repérage et plan de caméras.</b> Le réalisateur, le chef de car et la production définissent les positions caméras, les liaisons, l'emplacement du compound, l'énergie et les besoins en fréquences HF.</li>
<li><b>Arrivée et calage du car.</b> Mise à niveau, déploiement des extensions, raccordement de la terre puis de l'énergie (réseau du stade ou groupe), climatisation.</li>
<li><b>Câblage.</b> Tirage des câbles caméras (SMPTE, fibres), utilisation du pré-câblage du stade, câbles audio, intercom, transmission. Chaque câble est repéré et raccordé au pied de car.</li>
<li><b>Montage.</b> Caméras et objectifs sur leurs supports, micros (canons, ambiances, commentateurs), antennes HF.</li>
<li><b>Configuration.</b> Affectation des CCU, de la grille, du multiview (noms et tally), de l'intercom, des entrées EVS, des sorties.</li>
<li><b>Line-up.</b> Mires caméras, balance des noirs et des blancs, matching par la vision, test de chaque micro, test de chaque position intercom.</li>
<li><b>Tests transmission.</b> Envoi de la mire + 1 kHz à la chaîne, identification, vérification du retour antenne, test du chemin de secours.</li>
<li><b>Répétition et briefing.</b> Le réalisateur briefe les cadreurs et les EVS, l'habillage valide ses modèles.</li>
<li><b>Prise d'antenne et direct.</b> Le scripte compte à rebours, le réalisateur réalise, le chef de car surveille.</li>
<li><b>Fin d'antenne et démontage.</b> Dérushage éventuel, démontage, rapport technique.</li>
</ol>`},
  {
    id: 'chaine', title: 'La chaîne du signal', html: `
<p>Suivez le chemin d'une image, de l'objectif jusqu'au téléspectateur :</p>
<ol class="steps">
<li><b>Objectif → capteurs.</b> La lumière traverse le zoom (focale, iris, filtres ND) et un prisme qui la sépare sur 3 capteurs (rouge, vert, bleu).</li>
<li><b>Caméra → CCU.</b> Par la fibre SMPTE (ou triax, fibre, HF), la caméra envoie l'image à sa CCU dans le car et reçoit en retour l'alimentation, l'intercom, le retour programme, le tally et la référence.</li>
<li><b>RCP.</b> L'ingénieur vision règle l'image depuis son RCP : la CCU applique les réglages (gain, noir, couleurs) ou les renvoie à la caméra (iris, filtres).</li>
<li><b>CCU → grille.</b> La sortie SDI (ou IP) de la CCU entre dans la grille.</li>
<li><b>Grille → mélangeur, EVS, multiview.</b> La grille distribue chaque caméra au mélangeur, aux entrées d'enregistrement des EVS et aux tuiles du multiview.</li>
<li><b>Mélangeur → PGM.</b> Le truquiste construit le programme : commutations, ralentis, habillage (DSK).</li>
<li><b>Son.</b> L'audio du programme est mixé en régie son puis embeddé dans le SDI du PGM.</li>
<li><b>Transmission.</b> Le PGM (et souvent le clean feed) part vers la chaîne par fibre, IP ou satellite, sur deux chemins.</li>
<li><b>Diffusion.</b> La chaîne ajoute sa propre couche (logo, pubs) et diffuse. Le car contrôle le retour antenne.</li>
</ol>`},
  {
    id: 'formats', title: 'Formats et interfaces', html: `
<table class="tbl"><thead><tr><th>Format</th><th>Interface</th><th>Débit</th><th>Portée coax typique</th></tr></thead><tbody>
<tr><td>1080i50 (HD entrelacé)</td><td>HD-SDI (ST 292)</td><td>1,485 Gb/s</td><td>≈ 120 à 150 m</td></tr>
<tr><td>1080p50 (HD progressif)</td><td>3G-SDI (ST 424)</td><td>2,97 Gb/s</td><td>≈ 100 à 120 m</td></tr>
<tr><td>2160p50 (UHD)</td><td>12G-SDI (ST 2082) ou 4 x 3G (quad-link)</td><td>11,88 Gb/s</td><td>≈ 70 m</td></tr>
<tr><td>Toutes</td><td>IP ST 2110 sur fibre 25/100 GbE</td><td>≈ 2,5 Gb/s (1080p50) à 10 Gb/s (UHD) par flux</td><td>fibre : plusieurs km</td></tr>
</tbody></table>
<p>En Europe, tout est à 50 Hz : 50 images par seconde (25 en entrelacé, 2 trames par image). Le timecode compte 25 images par seconde.</p>
<p><b>HDR.</b> Les productions UHD sont souvent en HDR HLG (BT.2100, couleurs BT.2020), avec une version SDR (BT.709) dérivée en parallèle. Les caméras sont réglées en HDR et contrôlées aussi en SDR.</p>`},
  {
    id: 'sync', title: 'Synchronisation', html: `
<p>Un mélangeur ne peut couper proprement entre deux caméras que si leurs images commencent exactement au même instant. Toutes les caméras, le mélangeur, les EVS et la grille sont donc verrouillés (genlock) sur la référence du <b>générateur de synchro</b> (SPG), lui-même calé sur le GPS.</p>
<ul><li><b>SDI :</b> référence black burst (analogique) ou tri-level (HD) distribuée en coaxial.</li>
<li><b>IP ST 2110 :</b> référence PTP envoyée sur le réseau par un grand maître.</li>
<li><b>Sources externes</b> (duplex, satellite, HF) : elles passent par un <b>synchroniseur d'images</b> qui les remet en phase.</li></ul>
<p>Le SPG fournit aussi le <b>timecode</b> : toutes les machines sont à la même heure, ce qui permet de retrouver une action sur toutes les caméras du serveur ralenti.</p>`},
  {
    id: 'liaisons', title: 'Liaisons caméras', html: `
<table class="tbl"><thead><tr><th>Liaison</th><th>Portée indicative</th><th>Alimente la caméra</th><th>Usage</th></tr></thead><tbody>
<tr><td>Fibre hybride SMPTE</td><td>≈ 2 km</td><td>Oui</td><td>Standard des caméras de stade</td></tr>
<tr><td>Triax</td><td>≈ 1,2 km en HD, moins en UHD</td><td>Oui</td><td>Ancien standard, robuste</td></tr>
<tr><td>Fibre monomode + convertisseurs</td><td>&gt; 10 km</td><td>Non (alim locale)</td><td>Longues distances, pré-câblage, mini-caméras</td></tr>
<tr><td>Coaxial SDI</td><td>70 m (12G) à 120 m (3G)</td><td>Non</td><td>Sources proches du car</td></tr>
<tr><td>IP ST 2110</td><td>Plusieurs km (fibre)</td><td>Non</td><td>Installations IP</td></tr>
<tr><td>HF COFDM</td><td>Couverture des antennes</td><td>Batterie</td><td>Steadicam, caméras mobiles, drone</td></tr>
</tbody></table>
<p>La fibre SMPTE porte tout : vidéo vers le car, retour programme vers le viseur, intercom, tally, télécommandes du RCP et alimentation. Les mini-caméras et les convertisseurs fibre demandent une alimentation locale.</p>`},
  {
    id: 'optique', title: 'Optique et exposition', html: `
<p><b>Focale et angle.</b> Sur un capteur 2/3" (9,59 mm de large), l'angle horizontal vaut 2 × arctan(9,59 / 2f) : 58° à 8,6 mm, 13,7° à 40 mm, 1,4° à 400 mm, 0,55° à 1000 mm. À 80 m, un champ de 7 m de large demande une focale d'environ 110 mm.</p>
<p><b>Iris.</b> La suite f/1.4 – 2 – 2.8 – 4 – 5.6 – 8 – 11 – 16 : chaque valeur divise la lumière par 2. Le zoom perd de la luminosité en longue focale (ramping) et le doubleur coûte 2 diaphragmes.</p>
<p><b>Repères d'exposition</b> (en plein jour, 0 dB, 50 i/s) : environ f/8 avec un ND 1/4. De nuit sous l'éclairage du stade (environ 2000 lux) : environ f/2.8 sans filtre. Une caméra super ralenti 3x reçoit 3 fois moins de lumière par image (un diaphragme et demi).</p>
<p><b>Lire le waveform.</b> 0 % = noir, 100 % = blanc nominal (700 mV). Pelouse ensoleillée vers 40-55 %, peaux vers 50-70 %, maillot blanc juste sous 100 %. Au-dessus du knee point (95 % par défaut), les hautes lumières sont compressées, puis l'écrêteur (white clip) les limite : 103 % ici, pour respecter la tolérance EBU R103 qu'exigent beaucoup de diffuseurs. Le signal SDI peut techniquement monter jusqu'à 109 %.</p>`},
  {
    id: 'hfguide', title: 'Liaisons HF', html: `
<p>Une liaison HF caméra se dimensionne par un <b>bilan de liaison</b> :</p>
<p class="formula">Niveau reçu = Puissance émise + Gains d'antennes − Pertes en espace libre − Obstacles − Évanouissements</p>
<p>Perte en espace libre à 2,3 GHz : environ 80 dB à 100 m, 86 dB à 200 m. Un mur de béton ou une tribune ajoute 20 à 30 dB. Le récepteur compare ce niveau au bruit pour obtenir le <b>C/N</b>. La liaison fonctionne tant que le C/N dépasse le seuil de la modulation choisie (par exemple 18 dB en 64-QAM 3/4, 6 dB en QPSK 3/4) : la différence est la <b>marge</b>.</p>
<p>En COFDM, la qualité ne se dégrade pas progressivement : au-dessus du seuil l'image est parfaite, au voisinage du seuil apparaissent des blocs, en dessous l'image se fige puis disparaît (« effet falaise »).</p>
<p>Pour fiabiliser : plusieurs antennes en diversité, une modulation plus robuste, plus de puissance, des fréquences propres coordonnées.</p>`},
  {
    id: 'songuide', title: 'Le son d\'un match', html: `
<ul><li><b>Ambiance :</b> couples de micros en tribune et au-dessus du public.</li>
<li><b>Effets :</b> micros canons bord terrain qui suivent le ballon (frappes, contacts), parfois micros paraboliques.</li>
<li><b>Commentaires :</b> unité de commentaire en cabine, avec retour N-1.</li>
<li><b>Son international :</b> ambiance + effets sans commentaire, livré à tous les diffuseurs.</li></ul>
<p>Formats : stéréo et 5.1 (parfois immersif), jusqu'à 16 canaux embeddés dans le SDI. Loudness EBU R128 : -23 LUFS intégré, true peak ≤ -1 dBTP. Line-up : 1 kHz à -18 dBFS.</p>`},
  {
    id: 'car', title: 'Le car régie', html: `
<p>Un car régie est un semi-remorque de 16 à 18 m, souvent avec une ou deux extensions latérales qui doublent la largeur une fois déployées. Il est climatisé, isolé, et contient :</p>
<ul><li><b>Régie production :</b> mur d'écrans (multiview), réalisateur, scripte, truquiste au mélangeur, habillage, production.</li>
<li><b>Régie vision :</b> ingénieurs vision avec RCP, oscilloscopes et moniteur de référence, dans une lumière contrôlée.</li>
<li><b>Régie ralentis :</b> opérateurs EVS/LSM.</li>
<li><b>Régie son :</b> cabine isolée phoniquement avec la console.</li>
<li><b>Zone technique :</b> baies CCU, grille, châssis du mélangeur, processeurs multiview, serveurs, synchro, intercom, transmission, énergie.</li></ul>
<p>Autour du car, le <b>compound</b> accueille le groupe électrogène, le camion satellite (DSNG), parfois un car de complément (EVS, HF, unités de commentaires).</p>`},
  {
    id: 'camsys', title: 'La chaîne caméra en détail', html: `
<p>Une caméra « système » (type Sony HDC-5500) n'est que la moitié d'un ensemble : <b>tête de caméra</b> sur le terrain, <b>CCU</b> dans le car, <b>RCP</b> sur le pupitre de l'ingénieur vision. Les trois sont reliés en réseau.</p>
<h3>1. La tête de caméra</h3>
<ul>
<li><b>Bloc optique :</b> un prisme sépare la lumière en rouge, vert et bleu vers trois capteurs CMOS 2/3" (4K natif, obturation globale sur la HDC-5500). Monture <b>B4</b> : on y monte les zooms broadcast (portable 14x à 27x, ou « box » 86x à 122x sur pied).</li>
<li><b>Viseur</b> (connecteur VF) : le cadreur y voit son image, le retour programme (RET), le tally et les marques de cadrage.</li>
<li><b>Connecteurs arrière :</b> fibre CCU (LEMO 3K.93C), SDI 1/2/3 et SDI MONI pour un usage local, TEST OUT, PROMPTER/GENLOCK, INTERCOM 1 et 2 (XLR 5 broches), AUDIO CH1/CH2 (XLR 3), EARPHONE, DC IN (XLR 4, 10,5 à 17 V), DC OUT, REMOTE, RET CTRL, TRACKER et CRANE (données de position pour la réalité augmentée et les grues). Ouvrez la tête dans la visionneuse (touche K) pour voir chaque connecteur.</li>
</ul>
<h3>2. La liaison : un seul câble pour tout</h3>
<p>Le câble hybride SMPTE (ST 311, connecteur ST 304 type LEMO 3K.93C) contient <b>deux fibres monomodes</b> (une par sens) et des <b>conducteurs de cuivre</b> pour l'alimentation de la tête. Dans un sens : l'image de la caméra et le son des micros. Dans l'autre : le retour programme, le prompteur, les ordres (intercom PROD et ENG), le tally, la référence et toutes les commandes du RCP.</p>
<p>La CCU télé-alimente la tête : la distance est donc limitée par la chute de tension dans le cuivre (environ 2 km avec une HDCU-5500 en câble hybride). Au-delà, on passe en <b>fibre monomode seule</b> avec une alimentation locale de la caméra (jusqu'à environ 10 km avec le kit adapté).</p>
<h3>3. La CCU</h3>
<ul>
<li>Format demi-largeur 3U. Face arrière : CAMERA (fibre), SDI de sortie (12G en standard), REFERENCE IN/OUT en boucle, PROMPTER, CHARACTER (sortie avec menus et indications pour le moniteur), INTERCOM/TALLY/IO (D-sub 50), RCP/CNU (8 broches), LAN, TRUNK, alimentation.</li>
<li>Face avant : voyants REF IN, UNLOCK, RCP/MSU, état d'alimentation, et la mesure du <b>niveau optique</b> reçu.</li>
<li>Elle verrouille la caméra sur la référence du car (genlock) : toutes les caméras sortent en phase.</li>
<li>Elle fournit les sorties dans les formats demandés (UHD, HD, HDR, SDR) ; le traitement de l'image proprement dit (« paint ») est en grande partie fait dans la tête.</li>
</ul>
<h3>4. Le RCP et le réseau caméras</h3>
<p>Le RCP (type RCP-3500) se branche sur la CCU (câble 8 broches) ou sur le <b>réseau caméras</b> en Ethernet (LAN, alimenté en PoE). Un <b>CNS</b> (camera network system) gère qui commande quoi : un RCP par caméra, plus un pupitre maître (MSU / MCP) pour le chef vision qui peut prendre la main sur toutes les caméras et copier des réglages.</p>
<p>Sur le RCP : joystick (iris en le poussant, master black en tournant la bague), molettes WHITE et BLACK/FLARE R/G/B, AWB et ABB, écran tactile pour le gamma, le knee, le détail, la matrice, les fichiers de scène, et les touches CALL, BARS, CAM PW, PANEL ACTIVE, PREVIEW.</p>
<h3>5. Le line-up d'une caméra, dans l'ordre</h3>
<ol>
<li><b>CAM PW</b> : la CCU alimente la tête. Vérifier le niveau optique sur la CCU et le voyant REF (pas d'UNLOCK).</li>
<li><b>BARS</b> : les barres apparaissent sur la bonne tuile du multiview, avec le bon nom (UMD) et le tally qui suit le mélangeur.</li>
<li><b>ABB</b> (balance des noirs, iris fermé) puis <b>AWB</b> sur une charte blanche ou une surface neutre dans la lumière du terrain.</li>
<li>Régler le <b>master black</b>, le <b>gamma</b>, le <b>knee</b> et le <b>détail</b> comme la caméra de référence (souvent la caméra 1).</li>
<li><b>Matching</b> : toutes les caméras sur le même sujet, comparaison au moniteur Grade 1 et à l'oscilloscope, correction des gains R/B.</li>
<li>Mémoriser un <b>fichier de scène</b> (soleil, ombre, nuit) pour pouvoir y revenir.</li>
<li>Test intercom avec le cadreur (PROD et ENG) et vérification du retour programme dans son viseur.</li>
</ol>`},
  {
    id: 'evsarch', title: 'Le serveur ralenti en détail', html: `
<p>Un serveur de production live (dans votre car : <b>EVS XT4K</b>) enregistre en permanence plusieurs flux et, en même temps, relit n'importe quel instant de ces enregistrements, à n'importe quelle vitesse. Il est piloté par la <b>télécommande LSM</b> (logiciel Multicam) et, pour la gestion des clips, par <b>IPDirector</b>.</p>
<h3>Les canaux : enregistrement et lecture</h3>
<p>Le serveur dispose d'un nombre fixe de canaux : sur un XT4K, <b>4 canaux en UHD-4K</b> ou <b>8 canaux en HD</b> (12 et plus avec la configuration ChannelMAX). On les répartit selon la production. Avec un seul XT4K :</p>
<table><tr><th>Format</th><th>Répartition typique</th><th>Conséquence</th></tr>
<tr><td>HD (1080p / 1080i)</td><td>8 REC + 2 PLAY (ChannelMAX 12 canaux) ou 6 REC + 2 PLAY (8 canaux)</td><td>Deux sorties de lecture (PGM1, PGM2) ; une caméra 3x prend 3 entrées</td></tr>
<tr><td>UHD-4K</td><td>3 REC + 1 PLAY</td><td>Une seule sortie de lecture ; une caméra 3x occupe tout l'enregistrement</td></tr></table>
<p>C'est pourquoi le format de production se décide avec le parc EVS : en UHD, on ajoute des serveurs ou on enregistre moins d'angles. Les entrées sont alimentées par la grille, les sorties retournent à la grille puis au mélangeur. Dans ce simulateur, le format se choisit sur l'écran d'accueil et la répartition suit automatiquement.</p>
<h3>Les trains d'enregistrement</h3>
<p>L'enregistrement est une boucle (des heures de capacité) : on parle de « trains ». Tant que l'enregistrement tourne, chaque image de chaque entrée est disponible. Tous les trains partagent le même <b>timecode</b> (LTC du car) : c'est ce qui permet de passer d'un angle à l'autre sur la même action (<b>multicam</b>). Si on arrête l'enregistrement, plus rien n'est disponible après l'arrêt : c'est la pire erreur au poste ralentis. Quand la boucle est pleine, les images les plus anciennes sont écrasées : tout ce qu'on veut garder doit être sauvegardé en clip.</p>
<h3>Les clips</h3>
<p>Un clip est un point IN et un point OUT sur les trains, <b>avec tous les angles enregistrés</b>. Sur un LSM, il est rangé sur une touche F d'une banque et d'une page : le clip « 111A » est la page 1, banque 1, touche F1, angle A. Les clips sont protégés de l'écrasement et partagés avec les autres serveurs par le réseau XNet.</p>
<h3>La lecture</h3>
<ul>
<li><b>LIVE / E/E :</b> la sortie montre le direct. C'est l'état d'attente.</li>
<li><b>Recherche :</b> molette jog (image par image, ou FAST JOG pour aller vite), ou rappel d'un clip.</li>
<li><b>Lecture :</b> le levier règle la vitesse de 0 à 100 % (au-delà avec Var Max). Sur LSM, pousser le levier lance la lecture.</li>
<li><b>Deux sorties</b> : l'opérateur prépare PGM2 pendant que PGM1 est à l'antenne, ou fait un « split » (deux angles synchronisés).</li>
<li><b>Playlist :</b> plusieurs clips enchaînés (cut, mix, volet) pour un résumé ou les meilleurs moments.</li>
</ul>
<h3>Super ralenti : les phases</h3>
<p>Une caméra « 3x » tourne à 150 images/s (en Europe). Elle sort ces images sur <b>trois liaisons</b> à 50 i/s, appelées phases A, B, C (la phase A contient les images 1, 4, 7…, la B les images 2, 5, 8…). Le serveur enregistre chaque phase sur une entrée et les recombine : lue à 33 %, l'action est parfaitement fluide (chaque image affichée est une image différente). Une caméra standard lue à 33 % répète chaque image trois fois : le mouvement saccade. Les phases d'une même caméra sont enregistrées sur le même serveur.</p>
<h3>La télécommande LSM (Multicam)</h3>
<ul>
<li><b>Touches à double fonction</b> : IN / GOTO IN, OUT / GOTO OUT, PLST / BROWSE… la fonction secondaire s'obtient avec SHIFT.</li>
<li><b>Pages</b> : SHIFT + PAGE puis une touche F choisit la page 1 à 10.</li>
<li><b>RETURN</b> : dans un clip trop court, on revient sur la même image dans le train pour récupérer ce qu'il y a avant ou après.</li>
<li><b>TAKE</b> : en mode PGM + PRV, échange PGM et PRV ; en mode 2 PGM, échange le contenu des deux sorties.</li>
<li><b>Levier</b> : 0 à 100 %, plage secondaire −100/+100 % ou −200/+200 % ; <b>jog</b> : environ 35 images par tour.</li>
</ul>
<h3>IPDirector</h3>
<p>Le poste IPDirector travaille sur les mêmes clips que la LSM : base de données (recherche par mots-clés, joueurs, notes), log des actions pendant le direct, montage de playlists, contrôle des canaux, transferts vers le montage. Dans le car, il occupe en général un second opérateur ralentis ou un logueur.</p>
<h3>Raccordements</h3>
<p>Entrées et sorties 12G-SDI (UHD sur un seul câble) ou 3G/HD-SDI, Quad 3G-SDI en option, IP intégrée ; référence et timecode ; réseau XNet pour partager les clips entre serveurs ; 2 × 10 GbE pour IPDirector et les transferts ; réseau de gestion redondant ; audio embeddé, AES, MADI, analogique ; liaison série RS-422 vers la télécommande LSM (d'après les manuels XT). Ouvrez « Serveur ralenti EVS XT4K » dans la visionneuse de matériel pour voir chaque port.</p>`},
  {
    id: 'ipguide', title: 'Production IP : ST 2110, PTP, NMOS', html: `
<p>Dans un car « IP », les signaux ne voyagent plus sur des câbles coaxiaux point à point mais sur un <b>réseau Ethernet</b> (commutateurs 25 / 100 GbE). La grille de commutation devient un réseau piloté par un contrôleur.</p>
<h3>Les normes SMPTE ST 2110</h3>
<ul>
<li><b>ST 2110-20</b> : la vidéo non compressée, seule (sans les suppressions). Un 1080p50 4:2:2 10 bits fait environ 2,1 Gb/s ; un UHD p50 environ 8,3 Gb/s.</li>
<li><b>ST 2110-30</b> : l'audio PCM (compatible AES67) ; <b>-40</b> : les données annexes (timecode, sous-titres) ; <b>-22</b> : la vidéo compressée (JPEG XS par exemple).</li>
<li>Chaque « essence » est un flux séparé : on peut router le son sans la vidéo. À l'inverse, <b>ST 2022-6</b> transporte un signal SDI complet dans des paquets IP.</li>
</ul>
<h3>La synchronisation : PTP</h3>
<p>Plus de black burst : toutes les machines se calent sur une horloge commune distribuée par le réseau, le <b>PTP</b> (IEEE 1588, profil SMPTE ST 2059-2). Un <b>grand maître</b> asservi au GPS fournit l'heure ; les commutateurs jouent le rôle d'horloges relais (boundary clocks). Chaque paquet porte un horodatage : le récepteur sait exactement à quelle image il appartient.</p>
<h3>Découverte et connexion : NMOS</h3>
<p><b>NMOS IS-04</b> : chaque appareil s'annonce sur le réseau (« je suis la caméra 3, j'émets ces flux »). <b>IS-05</b> : le contrôleur établit les connexions (« le mélangeur entrée 3 s'abonne à ce flux »). C'est l'équivalent du TAKE de la grille.</p>
<h3>La redondance : ST 2022-7</h3>
<p>Deux réseaux complètement séparés (souvent appelés rouge et bleu) transportent chacun une copie de chaque flux. Le récepteur reconstitue le signal paquet par paquet à partir des deux copies : une coupure sur un réseau ne se voit pas à l'image (« commutation sans coupure »).</p>
<h3>Ce qui ne change pas</h3>
<p>Les métiers : truquiste, vision, EVS, son. Les pupitres sont les mêmes ; c'est l'infrastructure derrière qui change. Le tally et les noms de sources circulent aussi en IP (protocole TSL UMD v5).</p>`},
  {
    id: 'hdrguide', title: 'HDR, SDR et colorimétrie', html: `
<h3>Gamut et courbe</h3>
<p>Deux choses définissent une image : l'étendue des couleurs (<b>gamut</b>) et la courbe de transfert (<b>gamma</b> ou OETF). La HD classique utilise le gamut <b>BT.709</b> et le gamma BT.709 (SDR). L'UHD utilise le gamut plus large <b>BT.2020</b>, et souvent une courbe <b>HDR</b>.</p>
<h3>HLG et PQ</h3>
<ul>
<li><b>HLG</b> (Hybrid Log-Gamma, BBC/NHK) : courbe relative, compatible avec les écrans SDR. C'est le choix habituel du sport en direct.</li>
<li><b>PQ</b> (ST 2084) : courbe absolue en cd/m², utilisée en cinéma et streaming.</li>
<li><b>S-Log3</b> : courbe « caméra » qui garde un maximum de dynamique, avant conversion.</li>
</ul>
<h3>Une seule équipe vision pour deux sorties</h3>
<p>On produit souvent en HDR et en SDR à la fois, à partir des mêmes caméras (« single stream »). Les CCU sortent l'HDR et une copie SDR convertie ; avec un flux de travail de type SR Live, l'ingénieur vision règle l'image sur le moniteur SDR et l'HDR suit automatiquement, avec des conversions (LUT) identiques sur toute la chaîne.</p>
<h3>Repères de niveaux</h3>
<ul>
<li>SDR : le blanc nominal est à 100 % ; la pelouse au soleil vers 40 à 55 %.</li>
<li>HLG : le « blanc de référence » (une feuille blanche) est à <b>75 %</b> du signal (recommandation ITU-R BT.2408), soit 203 cd/m² sur un écran de référence ; les tons chair vers 45 à 55 %. Au-dessus de 75 %, on garde de la marge pour les hautes lumières (ciel, projecteurs, maillots blancs au soleil).</li>
<li>Le moniteur de référence (Grade 1) doit être dans le bon mode (HLG ou SDR) : une image HDR vue en SDR paraît terne, l'inverse paraît brûlée.</li>
</ul>`},
  {
    id: 'mesures', title: 'Mesures et niveaux', html: `
<h3>La vidéo numérique (10 bits)</h3>
<table><tr><th>Niveau</th><th>Code 10 bits</th><th>Oscilloscope</th><th>Ancien analogique</th></tr>
<tr><td>Noir</td><td>64</td><td>0 %</td><td>0 mV</td></tr>
<tr><td>Blanc nominal</td><td>940</td><td>100 %</td><td>700 mV</td></tr>
<tr><td>Super-blanc maximal</td><td>1019</td><td>≈ 109 %</td><td>≈ 763 mV</td></tr>
<tr><td>Chrominance au repos</td><td>512</td><td>centre du vecteurscope</td><td>0 mV</td></tr></table>
<p>Les codes 0 à 3 et 1020 à 1023 sont réservés à la synchronisation du signal SDI. Les diffuseurs imposent souvent des limites (par exemple pas plus de 103 % en luminance) : le knee et l'écrêteur de la caméra servent à les respecter.</p>
<h3>Lire l'oscilloscope et le vecteurscope</h3>
<ul>
<li><b>Waveform :</b> chaque colonne de l'image donne une trace verticale ; la hauteur, c'est le niveau. On vérifie les noirs (vers 0-2 %), les blancs (sous 100 %) et la pelouse.</li>
<li><b>Parade RVB :</b> les trois composantes côte à côte ; un blanc neutre a ses trois traces à la même hauteur.</li>
<li><b>Vecteurscope :</b> la couleur (teinte = angle, saturation = distance au centre). Les barres à 75 % tombent dans les cibles ; un gris neutre est au centre.</li>
</ul>
<h3>L'audio</h3>
<ul>
<li>Alignement : un 1 kHz à <b>−18 dBFS</b> (recommandation EBU R68) correspond au niveau d'alignement de la ligne (0 dBu).</li>
<li>Loudness : <b>−23 LUFS</b> intégré sur le programme (EBU R128), true peak ≤ <b>−1 dBTP</b>.</li>
<li>Le dBFS est un niveau numérique (0 dBFS = le maximum possible, au-delà c'est l'écrêtage).</li>
</ul>
<h3>Les fibres</h3>
<ul>
<li>Une fibre monomode perd environ 0,35 à 0,4 dB par kilomètre à 1310 nm : la longueur compte peu.</li>
<li>Ce sont les <b>connecteurs</b> qui font les pertes : environ 0,5 dB par connexion propre, beaucoup plus s'ils sont sales. Une poussière invisible sur une fibre de 9 µm suffit à couper une caméra.</li>
<li>Réflexe : bouchon toujours en place, nettoyage (stylo, cassette) et inspection au microscope avant de connecter ; mesure du niveau reçu sur la CCU.</li>
</ul>
<h3>La HF</h3>
<p>Les niveaux reçus s'expriment en dBm (−60 dBm = un millionième de milliwatt), les gains d'antennes en dBi, et la qualité en C/N ou MER (dB). La marge = C/N reçu − C/N requis par la modulation : au-dessous de 0 dB, l'image décroche d'un coup (effet falaise).</p>`},
  {
    id: 'timing', title: 'Synchronisation fine et retards', html: `
<h3>Pourquoi les sources doivent être « en phase »</h3>
<p>Le mélangeur commute entre ses entrées à un instant précis de l'image (le point de commutation). Si deux sources ne commencent pas leur image au même moment, la commutation provoque un saut, une image qui roule ou une coupure du son. D'où le <b>genlock</b> : toutes les sources sont asservies à la même référence.</p>
<h3>La référence analogique</h3>
<ul>
<li><b>Black burst</b> (noir codé SD) ou <b>tri-level</b> (HD), distribué en étoile par des distributeurs (DA) depuis le générateur de synchro (SPG).</li>
<li>Chaque équipement a un réglage de <b>phase</b> (H phase, retard en lignes et en pixels) pour compenser ses temps de traitement et les longueurs de câble.</li>
<li>Les mélangeurs modernes acceptent une fenêtre de décalage en entrée et réalignent automatiquement ; les sources hors fenêtre passent par un <b>synchroniseur d'images</b> (frame sync), qui ajoute une image de retard.</li>
</ul>
<h3>Le SPG</h3>
<p>Asservi au GPS, il génère la référence vidéo, le timecode (LTC), le word clock audio (48 kHz) et le PTP. Il est doublé : un SPG de secours prend le relais automatiquement (changeover). En perte de GPS, il passe en <b>holdover</b> : son oscillateur (OCXO) reste stable des heures.</p>
<h3>Retards et synchro labiale</h3>
<p>Chaque traitement ajoute du retard : synchroniseur (1 image), multiviewer (1 à 2 images), liaison HF (de quelques dizaines de ms à plus d'une seconde selon l'encodage), transmission satellite. La vidéo et le son doivent rester alignés (lip-sync) : on retarde l'audio pour qu'il arrive en même temps que l'image. Repère : au-delà d'environ 40 ms de décalage, un téléspectateur attentif le remarque.</p>`},
  {
    id: 'icomguide', title: 'Ordres et intercom', html: `
<p>Le système d'ordres relie toutes les personnes de la production. Sans lui, pas de réalisation possible : le réalisateur annonce chaque plan, la vision appelle un cadreur, l'EVS annonce qu'il est prêt.</p>
<h3>Les éléments</h3>
<ul>
<li><b>La matrice</b> : le cœur numérique, qui route chaque voix vers chaque destination.</li>
<li><b>Les pupitres</b> : une touche par destination, avec TALK (parler) et LISTEN (écouter). Afficheur avec le nom de la destination.</li>
<li><b>Les beltpacks</b> filaires ou sans fil (DECT 1,9 GHz, 2,4 ou 5 GHz) pour le personnel mobile.</li>
<li><b>Les interfaces</b> : 4 fils vers la chaîne et les autres cars, hybrides téléphoniques/SIP, cartes vers les CCU.</li>
</ul>
<h3>Les types de liaison</h3>
<ul>
<li><b>Conférence (partyline)</b> : un groupe où tout le monde s'entend (« Ordres », « Caméras », « EVS »).</li>
<li><b>Point à point</b> : une liaison privée.</li>
<li><b>IFB</b> : un programme (le son antenne) que l'on interrompt pour parler (commentateurs, présentateurs).</li>
<li><b>4 fils</b> : une paire pour parler, une pour écouter, sans mélange : pour relier deux systèmes.</li>
</ul>
<h3>Jusqu'au cadreur</h3>
<p>Les ordres sortent de la matrice vers chaque CCU (connecteur INTERCOM/TALLY/IO, canaux <b>PROD</b> pour la production et <b>ENG</b> pour la technique), passent dans la fibre caméra et arrivent au casque du cadreur (INTERCOM sur la tête de caméra). Le tally suit le même chemin : rouge = à l'antenne, vert = en preset (selon la configuration). Pour les caméras HF, l'intercom passe par une liaison radio séparée.</p>
<h3>Bonnes pratiques</h3>
<ul><li>Phrases courtes, toujours le nom ou le numéro d'abord (« La 3… serre le gardien »).</li>
<li>On ne parle pas sur l'ordre général pendant un direct si ce n'est pas utile à tout le monde : on utilise le point à point.</li>
<li>Tester chaque position au line-up, y compris les commentateurs et la chaîne.</li></ul>`},
  {
    id: 'cablage', title: 'Lire une liste de câblage', html: `
<p>Le chef de car prépare (ou génère depuis un logiciel) une <b>liste de câblage</b> : chaque câble porte un numéro, écrit sur une étiquette à ses deux extrémités. Le poste « Chef de car », onglet <b>Liste de câblage</b>, génère celle de votre installation.</p>
<h3>Les colonnes</h3>
<ul>
<li><b>N°</b> : identifiant unique du câble (C001…), identique sur les deux étiquettes.</li>
<li><b>Origine (A)</b> et <b>Destination (B)</b> : appareil · connecteur, par exemple « CCU 3 · SDI 1 » → « Grille · IN 3 ».</li>
<li><b>Câble</b> : le type (coaxial 75 Ω, fibre hybride SMPTE, multipaire D-sub, RJ-45, XLR…).</li>
<li><b>Longueur</b> et <b>signal</b> (vidéo, référence, audio, intercom, données, énergie, fibre, IP, HF).</li>
</ul>
<h3>Méthode d'installation</h3>
<ol>
<li>Tirer les câbles longs d'abord (caméras), en respectant les passages protégés.</li>
<li>Étiqueter les deux bouts avant de connecter.</li>
<li>Raccorder au <b>pied de car</b> (panneau de connexion extérieur) : embases SMPTE, triax, fibres, BNC, audio, réseau.</li>
<li>Tester chaque liaison : niveau optique, mire, continuité, intercom.</li>
<li>Cocher la ligne sur la liste ; noter tout changement (une liste fausse fait perdre des heures en dépannage).</li>
</ol>
<h3>En dépannage</h3>
<p>On suit le signal d'un bout à l'autre, maillon par maillon, en partant de ce qui marche : la liste dit exactement par où il passe. Dans le simulateur, chaque extrémité est cliquable et ouvre l'appareil sur le bon connecteur ; le bouton « Suivre » passe à l'autre bout du câble.</p>`},
  {
    id: 'securite', title: 'Sécurité', html: `
<ul><li>Terre raccordée avant toute mise sous tension ; jamais d'intervention sous tension sans habilitation électrique.</li>
<li>Travail en hauteur (passerelles, toits) : harnais, garde-corps, outils attachés.</li>
<li>Câbles : passages protégés (passe-câbles), pas de câble dans les zones de circulation du public ou dans les issues de secours.</li>
<li>Rayonnement HF : respecter les distances de sécurité autour des antennes et émetteurs.</li>
<li>Drones : télépilote certifié, scénario de vol déclaré, jamais au-dessus du public.</li></ul>`},
];

export const CONTROLS_HELP = [
  ['Clic dans la vue', 'Capturer la souris (vue à la première personne)'],
  ['Z Q S D / W A S D / flèches', 'Se déplacer'],
  ['Maj', 'Courir'],
  ['E', 'Interagir : ouvrir un poste, prendre une caméra, lire une info'],
  ['V', 'Vol libre (Espace = monter, C = descendre)'],
  ['P', 'Plan des caméras (vue de dessus)'],
  ['T', 'Se téléporter (car, terrain, passerelle…)'],
  ['G', 'Guide et missions'],
  ['M', 'Moniteur retour PGM (coin de l\'écran)'],
  ['K', 'Matériel du car : faces avant/arrière, connecteurs, raccordements'],
  ['I', 'Fiche du poste visé · sur une caméra : son matériel (connecteurs)'],
  ['Au poste', 'Bouton « Moniteur flottant » : un écran déplaçable au choix ; bouton « Matériel » : l\'appareil du poste'],
  ['Échap', 'Libérer la souris / fermer un poste'],
];

export const TEAMS = [
  { name: 'FC LUMIÈRE', short: 'LUM', shirt: 0x1f4fd6, shorts: 0xffffff, socks: 0x1f4fd6, gk: 0x22c55e, color: '#1f4fd6' },
  { name: 'AS RIVIÈRE', short: 'RIV', shirt: 0xd8262f, shorts: 0x1a1a1a, socks: 0xd8262f, gk: 0xf2c014, color: '#d8262f' },
];
export const PLAYER_NAMES = [
  ['M. Laurent', 'L. Benali', 'T. Moreau', 'J. Diallo', 'A. Fontaine', 'K. Traoré', 'R. Lefèvre', 'S. Martin', 'Y. Kanté', 'N. Girard', 'E. Rousseau'],
  ['P. Garnier', 'H. Mendy', 'C. Dubois', 'O. Camara', 'B. Lemaire', 'I. Sissoko', 'F. Roux', 'D. Petit', 'A. Koné', 'V. Mercier', 'G. Blanc'],
];
export const POSITIONS = ['Gardien', 'Défenseur', 'Défenseur', 'Défenseur', 'Défenseur', 'Milieu', 'Milieu', 'Milieu', 'Milieu', 'Attaquant', 'Attaquant'];
