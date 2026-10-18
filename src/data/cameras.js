// @ts-check
// Catalogue caméras : capteurs, objectifs, types de caméras, rôles de cadrage, liaisons vers le car, formats.
// Les valeurs techniques sont des ordres de grandeur réalistes (indicatifs), elles varient selon les modèles et les constructeurs.

export const SENSORS = {
  '2/3': { label: '2/3" (B4)', w: 9.59, h: 5.39 },
  '1/2.8': { label: '1/2,8"', w: 5.57, h: 3.13 },
  '1': { label: '1"', w: 13.2, h: 7.42 },
};

// Objectifs : fmin/fmax en mm, ouverture max, focale de début de "ramping" et ouverture max à fmax
export const LENSES = {
  // --- Fujinon 4K « box » (studio / terrain, 2/3") : chiffres constructeur (focales, ouvertures, distance mini, masse) ---
  UA125: { name: 'Fujinon UA125x8BESM', brand: 'Fujinon', kind: 'box', fmin: 8, fmax: 1000, f0: 1.7, ramp: 340, fLong: 5.0, ext: true, mod: 3.0, kg: 26.6, dim: '258 × 264 × 635 mm', len: 0.635, desc: 'Zoom box 4K 125x (8–1000 mm, 16–2000 mm avec le doubleur) : f/1,7 jusqu\'à 340 mm puis f/5 à 1000 mm. Pour les serrés extrêmes depuis la tribune.' },
  UA107: { name: 'Fujinon UA107x8.4BESM', brand: 'Fujinon', kind: 'box', fmin: 8.4, fmax: 900, f0: 1.7, ramp: 340, fLong: 4.5, ext: true, mod: 3.05, kg: 23.9, dim: '258 × 264 × 610 mm', len: 0.61, desc: 'Zoom box 4K 107x (8,4–900 mm) : f/1,7 jusqu\'à 340 mm, f/4,5 à 900 mm. La référence des caméras principales de stade.' },
  UA80: { name: 'Fujinon UA80x9BESM', brand: 'Fujinon', kind: 'box', fmin: 9, fmax: 720, f0: 1.7, ramp: 350, fLong: 3.5, ext: true, mod: 3.7, kg: 23.5, dim: '258 × 264 × 610 mm', len: 0.61, desc: 'Zoom box 4K 80x (9–720 mm), doubleurs 1,2x et 2x : f/1,7 jusqu\'à 350 mm, f/3,5 à 720 mm. Plus lumineux au long foyer : idéal en plan large / 16 m et en super ralenti.' },
  UA70: { name: 'Fujinon UA70x8.7BESM', brand: 'Fujinon', kind: 'box', fmin: 8.7, fmax: 610, f0: 1.7, ramp: 340, fLong: 3.05, ext: true, mod: 3.05, kg: 23.8, dim: '≈ 258 × 264 × 610 mm', len: 0.61, desc: 'Zoom box 4K 70x (8,7–610 mm) : f/1,7 jusqu\'à 340 mm, f/3,05 à 610 mm. Positions plus proches du terrain.' },
  UA27: { name: 'Fujinon UA27x6.5BESM', brand: 'Fujinon', kind: 'box', fmin: 6.5, fmax: 180, f0: 1.5, ramp: 123, fLong: 2.2, ext: true, mod: 0.6, kg: 22.8, dim: '≈ 258 × 264 × 560 mm', len: 0.56, desc: 'Zoom box 4K grand-angle (6,5–180 mm), très lumineux (f/1,5) : plans tactiques en hauteur, positions proches.' },
  // --- Fujinon 4K portables (épaule, Steadicam, grue) ---
  UA46: { name: 'Fujinon UA46x13.5BERD', brand: 'Fujinon', kind: 'portable', fmin: 13.5, fmax: 621, f0: 2.8, ramp: 316, fLong: 5.5, ext: true, mod: 2.8, kg: 5.8, dim: 'Φ 146,5 × 364 mm', len: 0.364, dia: 0.146, desc: 'Zoom portable 4K très long (13,5–621 mm) : f/2,8 jusqu\'à 316 mm, f/5,5 à 621 mm. Caméras bord terrain derrière les buts.' },
  UA24: { name: 'Fujinon UA24x7.8BERD', brand: 'Fujinon', kind: 'portable', fmin: 7.8, fmax: 187, f0: 1.8, ramp: 118, fLong: 2.85, ext: true, mod: 0.8, kg: 1.98, dim: 'longueur 220,5 mm', len: 0.22, dia: 0.11, desc: 'Zoom portable 4K polyvalent (7,8–187 mm) : f/1,8 jusqu\'à 118 mm, f/2,85 à 187 mm, 1,98 kg. Épaule, Steadicam, rail.' },
  UA13: { name: 'Fujinon UA13x4.5BERD', brand: 'Fujinon', kind: 'portable', fmin: 4.5, fmax: 59, f0: 1.8, ramp: 41, fLong: 2.6, ext: true, mod: 0.3, kg: 2.28, dim: '', len: 0.22, dia: 0.12, desc: 'Grand-angle portable 4K (4,5–59 mm) : f/1,8 jusqu\'à 41 mm, f/2,6 à 59 mm, mise au point à 30 cm. Vestiaires, tunnel, grue, caméra volante.' },
  UA14: { name: 'Fujinon UA14x4.5BERD', brand: 'Fujinon', kind: 'portable', fmin: 4.5, fmax: 63, f0: 1.8, ramp: 41, fLong: 2.8, ext: true, mod: 0.3, len: 0.24, dia: 0.12, desc: 'Grand-angle portable 4K (4,5–63 mm) : f/1,8 jusqu\'à 41 mm, f/2,8 à 63 mm, mise au point à 30 cm.' },
  // --- Canon (autre fabricant courant, gardé pour comparer) ---
  UJ122: { name: 'Canon UJ122x8.2B', brand: 'Canon', kind: 'box', fmin: 8.2, fmax: 1000, f0: 1.7, ramp: 340, fLong: 5.0, ext: true, len: 0.64, desc: 'Zoom box UHD très longue focale (8,2–1000 mm) : f/1,7 jusqu\'à 340 mm, f/5,0 à 1000 mm (chiffres constructeur), distance mini 3 m.' },
  UJ86: { name: 'Canon UJ86x9.3B', brand: 'Canon', kind: 'box', fmin: 9.3, fmax: 800, f0: 1.7, ramp: 340, fLong: 4.0, ext: true, len: 0.6, desc: 'Zoom box UHD 9,3–800 mm : f/1,7 jusqu\'à 340 mm, f/4,0 à 800 mm (chiffres constructeur), distance mini 3 m.' },
  UJ27: { name: 'Canon UJ27x6.5B', brand: 'Canon', kind: 'box', fmin: 6.5, fmax: 180, f0: 1.5, ramp: 123, fLong: 2.2, ext: true, len: 0.55, desc: 'Zoom box grand-angle (6,5–180 mm) pour positions proches : f/1,5 jusqu\'à 123 mm, f/2,2 à 180 mm.' },
  CJ45: { name: 'Canon CJ45ex9.7B', brand: 'Canon', kind: 'portable', fmin: 9.7, fmax: 437, f0: 2.0, ramp: 224, fLong: 3.9, ext: true, len: 0.33, dia: 0.13, desc: 'Zoom portable longue focale (9,7–437 mm) : f/2,0 jusqu\'à 224 mm, f/3,9 à 437 mm.' },
  CJ24: { name: 'Canon CJ24ex7.5B', brand: 'Canon', kind: 'portable', fmin: 7.5, fmax: 180, f0: 1.8, ramp: 120, fLong: 2.7, ext: true, len: 0.23, desc: 'Zoom portable polyvalent (7,5–180 mm).' },
  CJ20: { name: 'Canon CJ20ex7.8B', brand: 'Canon', kind: 'portable', fmin: 7.8, fmax: 156, f0: 1.8, ramp: 108, fLong: 2.6, ext: true, len: 0.21, desc: 'Zoom portable léger, idéal Steadicam et épaule.' },
  CJ15: { name: 'Canon CJ15ex4.3B', brand: 'Canon', kind: 'portable', fmin: 4.3, fmax: 65, f0: 1.8, ramp: 40, fLong: 2.9, ext: true, len: 0.22, desc: 'Grand-angle (4,3–65 mm).' },
  // --- optiques intégrées ---
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
    body: 'Caméra système Sony HDC-5500 (3 capteurs CMOS 2/3" 4K, fibre SMPTE) dans un adaptateur grand objectif (type Sony HDLA-3505), viseur 7" à l\'arrière',
    support: 'Trépied lourd + tête fluide (type Vinten Vector), deux manches : commande de zoom et commande de point (en Europe, souvent zoom à gauche et point à droite ; c\'est une préférence d\'opérateur)',
    lenses: ['UA107', 'UA80', 'UA125', 'UA70', 'UA27', 'UJ86', 'UJ122', 'UJ27'], defLens: 'UA80',
    links: ['smpte', 'precab', 'smf', 'triax', 'ip'], defLink: 'smpte',
    roles: ['large', 'serre', 'semi', 'joueur', 'tactique', 'fixe'], hfr: 1, operator: true, model: 'box',
  },
  hfr3: {
    label: 'Super ralenti 3x (150 i/s)', short: 'SSM 3x', sensor: '2/3',
    body: 'Caméra système Sony HDC-5500 en mode HFR 3x (150 i/s en 50 Hz, en HD avec la licence HFR : la HDC-5500 monte à 8x en HD mais à 2x seulement en 4K) : 3 phases SDI vers l\'EVS',
    support: 'Trépied lourd + tête fluide, adaptateur grand objectif', lenses: ['UA80', 'UA107', 'UA125', 'UA70', 'UA46', 'UJ86'], defLens: 'UA80',
    links: ['smpte', 'precab', 'smf', 'ip'], defLink: 'smpte', roles: ['serre', 'joueur', 'semi'], hfr: 3, operator: true, model: 'box',
  },
  hfr6: {
    label: 'Super ralenti 6x (300 i/s)', short: 'SSM 6x', sensor: '2/3',
    body: 'Caméra HFR 6x (300 i/s) : 6 phases, demande beaucoup de lumière',
    support: 'Trépied lourd, adaptateur grand objectif', lenses: ['UA80', 'UA107', 'UA70', 'UA46', 'UJ86'], defLens: 'UA107',
    links: ['smpte', 'precab', 'smf', 'ip'], defLink: 'smpte', roles: ['serre', 'joueur'], hfr: 6, operator: true, model: 'box',
  },
  portable: {
    label: 'Caméra portable / épaule', short: 'Épaule', sensor: '2/3',
    body: 'Sony HDC-5500 ou HDC-3500 en configuration épaule (même voie CCU que les caméras tribune), objectif portable Fujinon',
    support: 'Épaule ou trépied léger', lenses: ['UA24', 'UA46', 'UA13', 'UA14', 'CJ24', 'CJ20', 'CJ45', 'CJ15'], defLens: 'UA24',
    links: ['smpte', 'triax', 'smf', 'coax', 'ip', 'precab'], defLink: 'smpte', roles: ['joueur', 'serre', 'bancs', 'tribune', 'tunnel', 'semi'], hfr: 1, operator: true, model: 'shoulder',
  },
  steadicam: {
    label: 'Steadicam HF', short: 'Steadi HF', sensor: '2/3',
    body: 'Caméra compacte 2/3" sur harnais stabilisé + émetteur HF COFDM au dos',
    support: 'Bras et harnais Steadicam, batteries V-Lock', lenses: ['UA24', 'UA13', 'UA14', 'CJ20', 'CJ15', 'CJ24'], defLens: 'UA24',
    links: ['hf'], defLink: 'hf', roles: ['suivi', 'joueur'], hfr: 1, operator: true, model: 'steadicam', moving: 'touchline',
  },
  pov: {
    label: 'Mini-caméra POV', short: 'POV', sensor: '1/2.8',
    body: 'Mini-caméra (type Marshall, Dreamchip) pilotée à distance',
    support: 'Fixation dans le filet / poteau, boîtier de conversion fibre', lenses: ['FIX4'], defLens: 'FIX4',
    links: ['smf', 'coax'], defLink: 'smf', roles: ['but', 'fixe'], hfr: 1, operator: false, model: 'pov',
  },
  grue: {
    label: 'Grue télescopique', short: 'Grue', sensor: '2/3',
    body: 'Caméra compacte sur tête télécommandée en bout de grue (type Technocrane)',
    support: 'Grue télescopique sur base, tête 3 axes, opérateur + machiniste', lenses: ['UA13', 'UA14', 'CJ15', 'CJ20'], defLens: 'UA13',
    links: ['smpte', 'smf'], defLink: 'smpte', roles: ['grue'], hfr: 1, operator: true, model: 'crane', moving: 'crane',
  },
  rail: {
    label: 'Caméra sur rail (travelling)', short: 'Rail', sensor: '2/3',
    body: 'Caméra compacte sur chariot motorisé télécommandé',
    support: 'Rail le long de la ligne de touche, chariot motorisé', lenses: ['UA24', 'CJ20', 'CJ24'], defLens: 'UA24',
    links: ['smf', 'smpte'], defLink: 'smf', roles: ['suivi'], hfr: 1, operator: true, model: 'rail', moving: 'rail',
  },
  spider: {
    label: 'Caméra câblée volante (type Spidercam)', short: 'Volante', sensor: '2/3',
    body: 'Caméra compacte gyrostabilisée suspendue à 4 câbles motorisés',
    support: '4 treuils en haut des tribunes, pilote + cadreur', lenses: ['UA13', 'UA14', 'CJ15', 'CJ20'], defLens: 'UA13',
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
    body: 'Caméra tourelle 4K télécommandée depuis le car (type Panasonic AW-UE160, Sony BRC-AM7)',
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
