// @ts-check
// ----------------------------------------------------------------------------------
// Base de données du matériel : faces avant/arrière (disposition schématique),
// connecteurs et commandes avec leur rôle, signal et norme.
// Sources : fiches techniques Sony HDC-5500 / HDCU-5500 / HDCU-5000 / RCP-3500,
// documentation de lancement EVS XT4K et manuels techniques XT (XT2/XT3/XT4K), manuels EVS Multicam LSM,
// page produit EVS IPDirector, brochures Sony XVS / ICP-X7000 (mélangeur du car).
// Les positions sont indicatives : seul l'inventaire des connecteurs suit la documentation.
// ----------------------------------------------------------------------------------

const SDI_STD = '12G-SDI (SMPTE ST 2082-1), 3G-SDI (ST 424), HD-SDI (ST 292-1) selon le format';
const REF_STD = 'Tri-level HD (SMPTE ST 274/296) ou black burst SD (ST 318, 625 lignes / 50 Hz)';
const M = (n, c, s, d, std, desc) => ({ n, c, s, d, std, desc });
const BNC = 'BNC 75 Ω';
/** élément d'une vue dessinée (corps, texte, port, bouton, voyant…) : t donne le type, le reste dépend du type
 * @typedef {{ t: string, [k: string]: any }} Item */

function row(items, ids, x0, y, dx, kind, labels, extra = {}) {
  ids.forEach((id, i) => items.push({ t: 'port', id, k: kind, x: x0 + i * dx, y, l: labels ? labels[i] : id.toUpperCase(), ...extra }));
}

// ---------------------------------------------------------------- CAMÉRA
function camDevice() {
  const P = {
    ccu: M('CCU (fibre hybride)', 'LEMO 3K.93C (SMPTE 304M), mâle sur la caméra', 'fiber', 'io', 'SMPTE ST 311 (câble hybride : 2 fibres monomodes + 4 conducteurs cuivre)', 'Unique câble entre la tête et sa CCU : vidéo vers le car, retour programme, intercom, tally, commandes du RCP et alimentation de la caméra par les conducteurs cuivre. Avec une fibre monomode seule (kit SM), il faut une alimentation locale.'),
    lens: M('LENS', 'Connecteur 12 broches', 'data', 'io', 'Interface optique série / analogique', 'Relie l\'objectif à la tête : commande d\'iris par le RCP, lecture de la focale, du point et du doubleur, retour d\'état. L\'iris est piloté à distance par l\'ingénieur vision.'),
    vf: M('VF', 'Connecteur 20 broches', 'video', 'out', 'Interface viseur', 'Alimente le viseur et lui envoie l\'image (ou le retour programme), le tally et les réglages de viseur (peaking, zébra, marqueurs).'),
    sdi1: M('SDI 1', BNC, 'video', 'out', SDI_STD, 'Sortie vidéo locale de la tête. Utilisée en HF (vers l\'émetteur), en caméra autonome, ou pour un moniteur local.'),
    sdi2: M('SDI 2', BNC, 'video', 'out', SDI_STD, 'Deuxième sortie locale.'),
    sdi3: M('SDI 3', BNC, 'video', 'out', SDI_STD, 'Troisième sortie locale.'),
    sdimoni: M('SDI MONI', BNC, 'video', 'out', 'HD-SDI', 'Sortie de contrôle avec incrustations possibles (menus, marqueurs).'),
    testout: M('TEST OUT', BNC, 'video', 'out', 'Vidéo analogique de contrôle', 'Sortie test pour un moniteur de réglage ou un oscilloscope sur place.'),
    prompter: M('PROMPTER / GENLOCK', BNC, 'video', 'in', '1 Vp-p, 75 Ω', 'Sortie prompteur (texte du présentateur reçu par la fibre) ou entrée de synchro quand la caméra travaille sans CCU.'),
    icom1: M('INTERCOM 1', 'XLR 5 broches femelle', 'comms', 'io', 'Intercom 4 fils (casque + micro)', 'Le casque du cadreur : il entend les ordres du réalisateur et lui parle (bouton de micro). Le signal passe par la fibre jusqu\'à la CCU puis la matrice intercom.'),
    icom2: M('INTERCOM 2', 'XLR 5 broches femelle', 'comms', 'io', 'Intercom 4 fils', 'Second casque (assistant, machiniste, technicien) ou second canal d\'ordres.'),
    audio1: M('AUDIO IN CH1', 'XLR 3 broches femelle', 'audio', 'in', 'Micro / ligne, alim. fantôme', 'Entrée audio transportée par la fibre jusqu\'au car (ex. micro d\'ambiance ou canon fixé sur la caméra).'),
    audio2: M('AUDIO IN CH2', 'XLR 3 broches femelle', 'audio', 'in', 'Micro / ligne', 'Deuxième entrée audio.'),
    mic1: M('MIC 1 IN', 'XLR 3 broches femelle', 'audio', 'in', 'Micro', 'Entrée du micro monté sur la caméra (avant du corps).'),
    earphone: M('EARPHONE', 'Mini-jack 4 pôles', 'audio', 'out', 'Stéréo', 'Écoute au casque (retour programme ou intercom).'),
    dcin: M('DC IN', 'XLR 4 broches', 'power', 'in', '10,5 à 17 V continu', 'Alimentation locale (batterie ou bloc secteur) quand la caméra n\'est pas alimentée par la fibre hybride : HF, fibre monomode, pré-câblage.'),
    dcout4: M('DC OUT (4 broches)', '4 broches', 'power', 'out', '0,5 A max', 'Alimente un accessoire (moniteur, émetteur).'),
    dcout2: M('DC OUT (2 broches)', '2 broches', 'power', 'out', '2,5 A max', 'Alimente un accessoire plus gourmand.'),
    remote: M('REMOTE', 'Multi-connecteur 8 broches', 'data', 'io', 'Liaison RCP / MSU', 'Branchement direct d\'un RCP sur la tête (configuration sans CCU).'),
    retctrl: M('RET CTRL', 'Connecteur 6 broches', 'data', 'in', 'Commande de retour', 'Télécommande de sélection des retours vidéo (boîtier sur les poignées).'),
    tracker: M('TRACKER', 'Connecteur 12 broches', 'data', 'io', 'Données de suivi', 'Données de position (grues, têtes robotisées, réalité augmentée) et intercom auxiliaire.'),
    crane: M('CRANE', 'Connecteur 12 broches', 'data', 'io', 'Selon version', 'Liaison avec une grue ou une tête télécommandée (présent sur certaines versions).'),
  };
  const C = {
    power: M('POWER', 'Interrupteur', 'power', '', '', 'Mise sous tension locale. En exploitation, la caméra est alimentée et allumée depuis la CCU (CAMERA POWER) ou le RCP (CAM PW).'),
    call: M('CALL', 'Bouton', 'comms', '', '', 'Le cadreur appelle la vision ou la régie : le voyant CALL s\'allume sur le RCP et la CCU.'),
    incom: M('INTERCOM LEVEL', 'Potentiomètre', 'comms', '', '', 'Volume des ordres dans le casque du cadreur.'),
    tally: M('TALLY', 'Voyant', 'comms', '', '', 'Voyant arrière : rouge quand la caméra est à l\'antenne.'),
    zoomdemand: M('Commande de zoom (zoom demand)', 'Poignée sur le bras droit', 'data', '', '', 'Sur un objectif box, le cadreur zoome avec une commande au pouce sur le bras de panoramique droit : la vitesse de zoom est proportionnelle à l\'appui.'),
    focusdemand: M('Commande de point (focus demand)', 'Molette sur le bras gauche', 'data', '', '', 'Le point se fait à la main gauche par une molette sur le bras de panoramique.'),
    retsw: M('Bouton RET', 'Bouton sur la poignée', 'video', '', '', 'Maintenu, il affiche le retour programme dans le viseur : le cadreur voit ce qui est à l\'antenne.'),
    sidepanel: M('Panneau latéral et MENU', 'Afficheur + molette', 'data', '', '', 'Réglages locaux de la tête (menus, état). En exploitation, presque tout est piloté par la vision.'),
    vfdisp: M('Viseur', 'Écran OLED / LCD', 'video', '', '', 'Le viseur affiche l\'image de la caméra (ou le retour), le tally, le zoom, l\'iris, les marqueurs de cadre (zones de sécurité), le peaking pour le point.'),
    fronttally: M('Tally avant', 'Voyant rouge', 'comms', '', '', 'Visible des joueurs et du public : la caméra est à l\'antenne.'),
    lensbody: M('Objectif', 'Zoom broadcast B4', 'data', '', '', 'Le zoom (focale variable), le point et l\'iris sont motorisés (servos). Le doubleur x2 se trouve dans l\'objectif.'),
  };
  const back = /** @type {Item[]} */ ([]);
  back.push({ t: 'body', x: 20, y: 20, w: 720, h: 400, r: 14 });
  back.push({ t: 'text', x: 40, y: 50, s: 'PANNEAU ARRIÈRE · tête de caméra système (type Sony HDC-5500)', size: 15, w: 600 });
  back.push({ t: 'group', x: 40, y: 70, w: 410, h: 95, l: 'Vidéo' });
  row(back, ['sdi1', 'sdi2', 'sdi3', 'sdimoni', 'testout', 'prompter'], 76, 120, 68, 'bnc', ['SDI 1', 'SDI 2', 'SDI 3', 'SDI MONI', 'TEST OUT', 'PROMPTER'], { small: true });
  back.push({ t: 'group', x: 40, y: 180, w: 410, h: 100, l: 'Ordres et audio' });
  row(back, ['icom1', 'icom2', 'audio1', 'audio2'], 85, 232, 78, 'xlr', ['INTERCOM 1', 'INTERCOM 2', 'AUDIO CH1', 'AUDIO CH2']);
  back.push({ t: 'port', id: 'earphone', k: 'jack', x: 405, y: 232, l: 'EARPHONE' });
  back.push({ t: 'group', x: 40, y: 295, w: 410, h: 100, l: 'Télécommande et accessoires' });
  row(back, ['remote', 'retctrl', 'tracker', 'crane'], 85, 345, 85, 'multi', ['REMOTE', 'RET CTRL', 'TRACKER', 'CRANE']);
  back.push({ t: 'group', x: 470, y: 70, w: 250, h: 95, l: 'Alimentation locale' });
  back.push({ t: 'port', id: 'dcin', k: 'xlr', x: 515, y: 120, l: 'DC IN' });
  back.push({ t: 'port', id: 'dcout4', k: 'multi', x: 600, y: 120, l: 'DC OUT 4P' });
  back.push({ t: 'port', id: 'dcout2', k: 'multi', x: 670, y: 120, l: 'DC OUT 2P' });
  back.push({ t: 'group', x: 470, y: 180, w: 250, h: 100, l: 'Commandes' });
  back.push({ t: 'sw', id: 'power', x: 510, y: 232, l: 'POWER' });
  back.push({ t: 'btn', id: 'call', x: 555, y: 215, w: 56, h: 30, l: 'CALL' });
  back.push({ t: 'knob', id: 'incom', x: 650, y: 232, r: 15, l: 'INCOM' });
  back.push({ t: 'led', id: 'tally', x: 700, y: 205, c: 'tally', l: 'TALLY' });
  back.push({ t: 'port', id: 'ccu', k: 'lemo', x: 595, y: 345, l: 'CCU (fibre)' });
  const side = [];
  side.push({ t: 'cam-profile' });
  return {
    key: 'cam', title: 'Caméra système 4K (type Sony HDC-5500)', multi: true,
    intro: 'Tête de caméra « système » : elle ne fonctionne pleinement qu\'avec sa CCU dans le car. Trois capteurs CMOS 2/3" 4K à obturation globale derrière un prisme qui sépare le rouge, le vert et le bleu, monture B4. Elle reçoit tout par un seul câble hybride : alimentation, retour programme, ordres, tally et réglages.',
    views: { arriere: { label: 'Face arrière (connecteurs)', w: 760, h: 440, items: back }, profil: { label: 'Vue de côté (optique, viseur)', w: 960, h: 440, items: side } },
    ports: P, controls: C,
    specs: [['Capteurs', '3 × CMOS 2/3" 4K, obturation globale, prisme RVB'], ['Monture', 'B4 (objectifs broadcast 2/3")'], ['Formats', '2160p, 1080p, 1080i en 50 et 59,94 Hz ; HDR (HLG, S-Log3) et SDR BT.709'], ['Liaison CCU', 'Fibre hybride SMPTE, connecteur LEMO 3K.93C'], ['Intercom', '2 × XLR 5 broches (INTERCOM 1 et 2)'], ['Alimentation locale', 'DC IN XLR 4 broches, 10,5 à 17 V'], ['Sorties locales', 'SDI 1/2/3, SDI MONI, TEST OUT (BNC)']],
    lesson: ['Le connecteur 3K.93C porte un point rouge : on l\'aligne avant d\'enfoncer et on le protège toujours par son bouchon (une poussière sur la fibre fait chuter le niveau optique).', 'L\'iris n\'est pas réglé par le cadreur mais par l\'ingénieur vision, à distance : le cadreur s\'occupe du cadre, du zoom et du point.', 'Sur une caméra HF ou en fibre monomode, la tête n\'est plus alimentée par le câble : DC IN sur batterie ou bloc secteur.'],
  };
}

// ---------------------------------------------------------------- CCU
function ccuDevice() {
  const P = {
    camera: M('CAMERA', 'Connecteur fibre (LEMO 3K.93C femelle)', 'fiber', 'io', 'SMPTE ST 311 / ST 304', 'Arrivée de la fibre hybride venant du pied de car. La CCU y envoie l\'alimentation de la caméra (portée ≈ 2 km avec l\'HDCU-5500 sur fibre hybride) et reçoit l\'image. Avec le kit monomode (HKCU-SM50), jusqu\'à 10 km mais alimentation locale à la caméra.'),
    refin: M('REFERENCE IN', BNC, 'ref', 'in', REF_STD, 'Référence de synchro venant du générateur (SPG) par un distributeur. Toute la chaîne est verrouillée sur cette référence : sinon l\'image saute à la commutation (voyant UNLOCK).'),
    refout: M('REFERENCE OUT (boucle)', BNC, 'ref', 'out', REF_STD, 'Recopie de la référence pour boucler vers la CCU suivante. La dernière de la chaîne doit être terminée à 75 Ω.'),
    prompter: M('PROMPTER', BNC, 'video', 'in', 'Analogique 1,0 Vp-p', 'Entrée du signal envoyé vers la caméra : prompteur ou retour programme (RET) visible dans le viseur.'),
    prompter2: M('PROMPTER 2 / VBS-RET', BNC, 'video', 'in', 'Analogique 1,0 Vp-p (terminée en mode 2 voies, bouclée en mode 1 voie)', 'Deuxième retour vers la caméra.'),
    sdi1: M('SDI 1', BNC, 'video', 'out', SDI_STD, 'Sortie principale vers la grille : image de la caméra après traitement (UHD HDR ou HD selon la production).'),
    sdi2: M('SDI 2', BNC, 'video', 'out', SDI_STD, 'Deuxième sortie, souvent une copie HD SDR (BT.709) pour les diffuseurs HD en production HDR.'),
    sdi3: M('SDI 3', BNC, 'video', 'io', SDI_STD, 'Sortie supplémentaire ou retour SDI (selon configuration). Peut afficher l\'état du système.'),
    sdi4: M('SDI 4', BNC, 'video', 'io', SDI_STD, 'Sortie supplémentaire ou retour SDI (selon configuration).'),
    char: M('CHARACTER', BNC, 'video', 'out', 'Vidéo avec incrustations', 'Image avec les menus et l\'état de la caméra incrustés, pour la vision.'),
    icom: M('INTERCOM / TALLY / IO', 'D-sub 50 broches', 'comms', 'io', 'Intercom PROD/ENG 4 fils, PGM audio (2 systèmes, 0 / -20 dBu), tally R/G/Y, FLAG', 'Tout l\'« éclaté » vers la matrice intercom et le système de tally : les ordres du réalisateur (PROD), ceux de la vision (ENG), le son programme pour le cadreur, et les tallys rouge/vert/jaune.'),
    rcp: M('RCP / CNU', 'Multi-connecteur 8 broches', 'data', 'io', 'Câble CCA-5', 'Branchement du RCP (pupitre de l\'ingénieur vision) ou d\'une unité réseau CNU.'),
    trunk: M('TRUNK', 'Connecteur 12 broches', 'data', 'io', 'Données transparentes', 'Liaison de données transparente vers la tête (RS-232/422 : têtes robotisées, données de suivi).'),
    lan: M('LAN', 'RJ-45', 'ip', 'io', '1000BASE-T', 'Réseau caméras (CNS) : MSU, RCP en réseau, menus à distance, tally IP (TSL UMD v5.0).'),
    opt: M('Emplacement option', 'SFP / cartes', 'ip', 'io', 'IP (ST 2110) ou 12G-SDI supplémentaires', 'Options : interface IP et sorties 12G-SDI supplémentaires.'),
    ac: M('AC IN', 'IEC', 'power', 'in', '100 à 240 V', 'Alimentation secteur de la CCU (depuis l\'onduleur du car).'),
  };
  const C = {
    power: M('POWER', 'Interrupteur', 'power', '', '', 'Allume la CCU.'),
    campower: M('CAMERA POWER', 'Interrupteur + voyant', 'power', '', '', 'Envoie l\'alimentation à la caméra par la fibre hybride. On ne branche ni ne débranche jamais un câble caméra sous tension.'),
    lcd: M('Afficheur d\'état', 'Écran', 'data', '', '', 'Numéro de caméra, format, niveau optique reçu, alarmes.'),
    sigbar: M('SIGNAL BAR', 'Barre de LED', 'fiber', '', '', 'Niveau optique reçu de la caméra. Une barre courte signale une fibre sale, pincée ou trop longue.'),
    led_ref: M('REF IN', 'Voyant vert', 'ref', '', '', 'Présence du signal de référence.'),
    led_unlock: M('UNLOCK', 'Voyant rouge', 'ref', '', '', 'La CCU n\'est pas verrouillée sur la référence : l\'image ne sera pas synchrone.'),
    led_rcp: M('RCP/MSU', 'Voyant', 'data', '', '', 'Un pupitre (RCP ou MSU) contrôle la caméra.'),
    led_alarm: M('ALARM', 'Voyant rouge', 'data', '', '', 'Défaut (alimentation, transmission, température).'),
    led_fan: M('PS FAN', 'Voyant', 'power', '', '', 'État du ventilateur de l\'alimentation.'),
    menu: M('MENU', 'Molette + touches', 'data', '', '', 'Navigation dans les menus de la CCU (format, sorties, configuration).'),
    call: M('CALL', 'Bouton', 'comms', '', '', 'Appel de la caméra : fait clignoter le tally du cadreur.'),
  };
  const front = /** @type {Item[]} */ ([
    { t: 'body', x: 10, y: 10, w: 520, h: 280, r: 6 },
    { t: 'text', x: 24, y: 34, s: 'CCU · demi-largeur 3U (type Sony HDCU-5500)', size: 13, w: 600 },
    { t: 'sw', id: 'power', x: 55, y: 85, l: 'POWER' },
    { t: 'sw', id: 'campower', x: 55, y: 175, l: 'CAMERA POWER' },
    { t: 'led', id: 'campower_led', x: 92, y: 160, c: 'green' },
    { t: 'lcd', id: 'lcd', x: 120, y: 50, w: 240, h: 78 },
    { t: 'bar', id: 'sigbar', x: 120, y: 142, w: 160, h: 16, l: 'SIGNAL BAR' },
    { t: 'led', id: 'led_ref', x: 135, y: 200, c: 'green', l: 'REF IN' },
    { t: 'led', id: 'led_unlock', x: 190, y: 200, c: 'red', l: 'UNLOCK' },
    { t: 'led', id: 'led_rcp', x: 245, y: 200, c: 'green', l: 'RCP/MSU' },
    { t: 'led', id: 'led_alarm', x: 300, y: 200, c: 'red', l: 'ALARM' },
    { t: 'led', id: 'led_fan', x: 355, y: 200, c: 'green', l: 'PS FAN' },
    { t: 'knob', id: 'menu', x: 440, y: 90, r: 28, l: 'MENU' },
    { t: 'btn', id: 'call', x: 400, y: 170, w: 90, h: 34, l: 'CALL' },
  ]);
  const rear = /** @type {Item[]} */ ([
    { t: 'body', x: 10, y: 10, w: 520, h: 296, r: 6 },
    { t: 'port', id: 'camera', k: 'lemo', x: 75, y: 150, l: 'CAMERA' },
    { t: 'group', x: 140, y: 34, w: 290, h: 78, l: 'Référence et retours' },
    { t: 'port', id: 'refin', k: 'bnc', x: 170, y: 82, l: 'REF IN' },
    { t: 'port', id: 'refout', k: 'bnc', x: 225, y: 82, l: 'REF OUT' },
    { t: 'port', id: 'prompter', k: 'bnc', x: 300, y: 82, l: 'PROMPTER' },
    { t: 'port', id: 'prompter2', k: 'bnc', x: 380, y: 82, l: 'PROMPT 2/RET', small: true },
    { t: 'group', x: 140, y: 122, w: 320, h: 78, l: 'Sorties vidéo' },
    { t: 'port', id: 'sdi1', k: 'bnc', x: 170, y: 170, l: 'SDI 1' },
    { t: 'port', id: 'sdi2', k: 'bnc', x: 228, y: 170, l: 'SDI 2' },
    { t: 'port', id: 'sdi3', k: 'bnc', x: 286, y: 170, l: 'SDI 3' },
    { t: 'port', id: 'sdi4', k: 'bnc', x: 344, y: 170, l: 'SDI 4' },
    { t: 'port', id: 'char', k: 'bnc', x: 415, y: 170, l: 'CHARACTER' },
    { t: 'port', id: 'icom', k: 'dsub50', x: 210, y: 244, l: 'INTERCOM/TALLY/IO' },
    { t: 'port', id: 'rcp', k: 'multi', x: 320, y: 248, l: 'RCP/CNU' },
    { t: 'port', id: 'trunk', k: 'multi', x: 385, y: 248, l: 'TRUNK' },
    { t: 'port', id: 'lan', k: 'rj45', x: 445, y: 248, l: 'LAN' },
    { t: 'port', id: 'opt', k: 'sfp', x: 478, y: 60, l: 'OPTION' },
    { t: 'port', id: 'ac', k: 'iec', x: 490, y: 160, l: 'AC IN' },
  ]);
  return {
    key: 'ccu', title: 'CCU — voie caméra (type Sony HDCU-5500)', multi: true,
    intro: 'La CCU (Camera Control Unit) est la moitié « car » de la caméra. Elle alimente la tête par la fibre hybride, reçoit l\'image, la traite (sous le contrôle du RCP), la synchronise sur la référence du car, et renvoie à la caméra le retour programme, l\'intercom et le tally. Format demi-largeur 3U : deux CCU côte à côte dans 3U de baie.',
    views: { avant: { label: 'Face avant', w: 540, h: 316, items: front }, arriere: { label: 'Face arrière', w: 540, h: 316, items: rear } },
    ports: P, controls: C,
    specs: [['Format', 'Demi-largeur 19", 3U, portable'], ['Liaison caméra', 'Fibre optique (pas de triax)'], ['Portée (fibre hybride, caméra alimentée)', 'Jusqu\'à ≈ 2 km (HDCU-5500/3500) ; 4 km avec l\'HDCU-5000'], ['Portée (fibre monomode, kit SM)', 'Jusqu\'à 10 km, alimentation locale de la caméra'], ['Sorties', '12G-SDI et 4K en standard ; IP et 12G supplémentaires en option'], ['Référence', 'REFERENCE IN/OUT en boucle (tri-level HD ou black burst)'], ['Intercom / tally', 'D-sub 50 : intercom PROD/ENG, PGM, tally R/G/Y, FLAG'], ['Réseau', 'Tally IP TSL UMD v5.0, menus à distance']],
    lesson: ['Ordre de mise en route : câble branché, CCU allumée, puis CAMERA POWER. Jamais l\'inverse.', 'Si la barre SIGNAL est courte : nettoyer les connecteurs fibre (stylo de nettoyage), vérifier les coudes du câble.', 'Voyant UNLOCK allumé : la référence ne rentre pas (câble, distributeur, terminaison 75 Ω manquante en bout de boucle).'],
  };
}

// ---------------------------------------------------------------- RCP
function rcpDevice() {
  const P = {
    ccu: M('CCU / CNU', 'Multi-connecteur 8 broches femelle', 'data', 'io', 'Câble CCA-5', 'Liaison point à point vers la CCU (ou vers un CNU en réseau).'),
    lan: M('LAN', 'RJ-45', 'ip', 'io', '1000BASE-T / 100BASE-TX / 10BASE-T, PoE IEEE 802.3af classe 2 (36 à 57 V)', 'Branchement réseau (CNS) : le RCP peut piloter n\'importe quelle caméra du réseau et être alimenté par le câble Ethernet (PoE).'),
    aux: M('AUX', 'Multi-connecteur 8 broches', 'data', 'io', '', 'Connecteur auxiliaire (accessoires).'),
    extio: M('EXT I/O', 'D-sub 9 broches', 'power', 'io', 'Entrée DC 10,5 à 17 V', 'Entrées/sorties externes et alimentation continue.'),
  };
  const C = {
    lcd: M('Écran tactile', 'LCD tactile', 'data', '', '', 'Affiche les paramètres et les menus (gamma, knee, détail, matrice, shutter, filtres, fichiers de scène) et les fonctions des touches assignables. On touche un paramètre puis on le règle avec les molettes.'),
    enc1: M('Molette 1', 'Molette', 'data', '', '', 'Règle le paramètre affiché au-dessus sur l\'écran.'), enc2: M('Molette 2', 'Molette', 'data', '', '', 'Règle le paramètre affiché.'), enc3: M('Molette 3', 'Molette', 'data', '', '', 'Règle le paramètre affiché.'),
    assign: M('Touches assignables (9)', 'Boutons', 'data', '', '', 'Neuf touches dont la fonction est choisie par l\'ingénieur vision (activer le détail, le knee, le gamma, la matrice…), plus une LED assignable.'),
    white: M('WHITE R / G / B', 'Potentiomètres', 'data', '', '', 'Gains rouge, vert et bleu : ils corrigent la balance des blancs. Sur le vecteurscope, un blanc ou un gris doit tomber au centre.'),
    black: M('BLACK / FLARE R / G / B', 'Potentiomètres', 'data', '', '', 'Niveaux de noir par couleur (ou compensation de flare si FLARE est allumé). Corrige un noir qui tire vers une couleur.'),
    flare: M('FLARE', 'Bouton', 'data', '', '', 'Bascule les potentiomètres BLACK sur la compensation de flare (voile lumineux dans l\'optique qui délave les noirs).'),
    awb: M('AWB', 'Bouton', 'data', '', '', 'Balance des blancs automatique : la caméra doit cadrer un blanc de référence. Le bouton reste allumé pendant le réglage.'),
    abb: M('ABB', 'Bouton', 'data', '', '', 'Balance des noirs automatique : l\'iris se ferme et la caméra égalise ses noirs.'),
    callbtn: M('CALL', 'Bouton', 'comms', '', '', 'Appelle le cadreur (fait clignoter son tally) ou signale un appel venant de la caméra.'),
    bars: M('BARS', 'Bouton', 'video', '', '', 'Envoie les barres de couleur de la caméra : sert à identifier la liaison et à aligner les niveaux.'),
    campw: M('CAM PW', 'Bouton', 'power', '', '', 'Allume ou coupe l\'alimentation de la tête de caméra.'),
    active: M('PANEL ACTIVE', 'Bouton', 'data', '', '', 'Le RCP prend la main sur la caméra. Éteint, les réglages sont verrouillés : évite de dérégler une caméra par erreur.'),
    preview: M('PREVIEW', 'Bouton', 'video', '', '', 'Affiche cette caméra sur le moniteur de contrôle de la vision (sortie de prévisualisation).'),
    autoiris: M('AUTO IRIS', 'Bouton', 'data', '', '', 'Iris automatique : pratique en dépannage, rarement utilisé en direct car il « pompe » avec le contenu de l\'image.'),
    close: M('CLOSE', 'Bouton', 'data', '', '', 'Ferme complètement l\'iris (protection, balance des noirs).'),
    joystick: M('Joystick IRIS / M.BLACK', 'Joystick', 'data', '', '', 'Commande principale : on pousse ou tire pour l\'iris (exposition), on tourne la bague pour le master black (niveau de noir de toutes les couleurs). L\'ingénieur vision garde la main dessus pendant tout le direct.'),
    tallyled: M('TALLY / CALL', 'Voyants', 'comms', '', '', 'Tally rouge quand la caméra est à l\'antenne, appel en cours.'),
  };
  const top = /** @type {Item[]} */ ([
    { t: 'body', x: 10, y: 10, w: 320, h: 980, r: 12 },
    { t: 'led', id: 'tallyled', x: 40, y: 32, c: 'tally', l: 'TALLY' },
    { t: 'led', id: 'callled', x: 300, y: 32, c: 'amber', l: 'CALL' },
    { t: 'lcd', id: 'lcd', x: 30, y: 52, w: 280, h: 190 },
    { t: 'knob', id: 'enc1', x: 80, y: 280, r: 18, l: '' }, { t: 'knob', id: 'enc2', x: 170, y: 280, r: 18, l: '' }, { t: 'knob', id: 'enc3', x: 260, y: 280, r: 18, l: '' },
    { t: 'keys', id: 'assign', x: 32, y: 318, cols: 3, rows: 3, w: 84, h: 28, gap: 8, labels: ['DETAIL', 'KNEE', 'GAMMA', 'MATRIX', 'BLK GAM', 'SKIN', 'ND', 'SHUTTER', 'ZEBRA'] },
    { t: 'group', x: 26, y: 440, w: 288, h: 110, l: 'WHITE' },
    { t: 'knob', id: 'white', x: 90, y: 492, r: 22, l: 'R' }, { t: 'knob', id: 'white', x: 170, y: 492, r: 22, l: 'G' }, { t: 'knob', id: 'white', x: 250, y: 492, r: 22, l: 'B' },
    { t: 'btn', id: 'awb', x: 130, y: 520, w: 80, h: 24, l: 'AWB' },
    { t: 'group', x: 26, y: 560, w: 288, h: 132, l: 'BLACK / FLARE' },
    { t: 'knob', id: 'black', x: 90, y: 612, r: 22, l: 'R' }, { t: 'knob', id: 'black', x: 170, y: 612, r: 22, l: 'G' }, { t: 'knob', id: 'black', x: 250, y: 612, r: 22, l: 'B' },
    { t: 'btn', id: 'flare', x: 52, y: 650, w: 100, h: 26, l: 'FLARE' }, { t: 'btn', id: 'abb', x: 188, y: 650, w: 100, h: 26, l: 'ABB' },
    { t: 'btn', id: 'callbtn', x: 32, y: 706, w: 84, h: 30, l: 'CALL' }, { t: 'btn', id: 'bars', x: 128, y: 706, w: 84, h: 30, l: 'BARS' }, { t: 'btn', id: 'campw', x: 224, y: 706, w: 84, h: 30, l: 'CAM PW' },
    { t: 'btn', id: 'active', x: 32, y: 746, w: 132, h: 30, l: 'PANEL ACTIVE' }, { t: 'btn', id: 'preview', x: 176, y: 746, w: 132, h: 30, l: 'PREVIEW' },
    { t: 'btn', id: 'autoiris', x: 32, y: 786, w: 132, h: 28, l: 'AUTO IRIS' }, { t: 'btn', id: 'close', x: 176, y: 786, w: 132, h: 28, l: 'CLOSE' },
    { t: 'joy', id: 'joystick', x: 170, y: 900, r: 62 },
  ]);
  const rear = /** @type {Item[]} */ ([
    { t: 'body', x: 10, y: 10, w: 320, h: 180, r: 8 },
    { t: 'text', x: 24, y: 34, s: 'Face arrière RCP', size: 13, w: 600 },
    { t: 'port', id: 'ccu', k: 'multi', x: 60, y: 110, l: 'CCU/CNU' },
    { t: 'port', id: 'lan', k: 'rj45', x: 135, y: 110, l: 'LAN (PoE)' },
    { t: 'port', id: 'aux', k: 'multi', x: 210, y: 110, l: 'AUX' },
    { t: 'port', id: 'extio', k: 'dsub9', x: 285, y: 110, l: 'EXT I/O' },
  ]);
  return {
    key: 'rcp', title: 'RCP — pupitre de réglage caméra (type Sony RCP-3500)', multi: true,
    intro: 'Le RCP (Remote Control Panel) est le pupitre d\'une caméra pour l\'ingénieur vision. Successeur du RCP-1500 (même encombrement) : touches d\'accès direct, écran tactile, bloc joystick iris / master black, 9 touches assignables. Il se branche sur la CCU (câble CCA-5) ou sur le réseau caméras (PoE).',
    views: { dessus: { label: 'Dessus (commandes)', w: 340, h: 1000, items: top }, arriere: { label: 'Face arrière', w: 340, h: 200, items: rear } },
    ports: P, controls: C,
    specs: [['Dimensions', '102 × 310 × 67 mm, ≈ 1,7 kg'], ['Consommation', '10 W'], ['Réseau', 'RJ-45 1000BASE-T, alimentation PoE IEEE 802.3af classe 2'], ['Liaison CCU', 'CCU/CNU 8 broches (câble CCA-5)'], ['Autres connecteurs', 'AUX 8 broches, EXT I/O D-sub 9 (DC 10,5 à 17 V)'], ['Commandes', 'Joystick iris / master black, écran tactile, 9 touches assignables'], ['Montage', 'Jusqu\'à 4 RCP par rack 19"']],
    lesson: ['La main reste sur le joystick : on « ride » l\'iris en suivant l\'action (soleil / ombre).', 'On ne touche aux potentiomètres de couleur qu\'en regardant le vecteurscope et le moniteur de référence, jamais un écran grand public.', 'Si le RCP ne répond pas : PANEL ACTIVE est peut-être éteint.'],
  };
}

// ---------------------------------------------------------------- EVS XT4K
function evsDevice() {
  const P = {};
  for (let i = 1; i <= 12; i++) P['sdi' + i] = M(`SDI ${i}`, BNC, 'video', 'io', '12G-SDI (UHD-4K sur un seul câble) ou 3G/HD-SDI ; Quad 3G-SDI (2SI ou découpage en carrés) en option', 'Connecteur des modules codec, affecté en entrée (enregistrement) ou en sortie (lecture, multiviewer) dans la configuration du serveur. L\'affectation de votre car est donnée dans « Dans votre installation ».');
  Object.assign(P, {
    xnet: M('XNet', 'Réseau EVS', 'ip', 'io', 'Réseau de production XNet (3 Gb/s d\'après la documentation de lancement)', 'Partage des trains et des clips entre serveurs : un opérateur peut relire l\'enregistrement d\'un autre serveur comme s\'il était local.'),
    gbe1: M('10GbE 1', 'SFP+', 'ip', 'io', '10 Gb/s Ethernet', 'Réseau de partage des médias : IPDirector, transferts de fichiers vers le montage, archivage.'),
    gbe2: M('10GbE 2', 'SFP+', 'ip', 'io', '10 Gb/s Ethernet', 'Second port de partage des médias.'),
    ipio: M('IP I/O', 'SFP', 'ip', 'io', 'Interface IP intégrée (ST 2022-6 / ST 2110 selon version)', 'Entrées/sorties vidéo sur IP, pour les cars IP.'),
    mgmt1: M('LAN gestion 1', 'RJ-45', 'ip', 'io', '1 GbE', 'Réseau de gestion du serveur, doublé pour la redondance.'),
    mgmt2: M('LAN gestion 2', 'RJ-45', 'ip', 'io', '1 GbE', 'Réseau de gestion redondant.'),
    refin: M('REF IN', BNC, 'ref', 'in', REF_STD, 'Référence de synchro (genlock) venant du SPG.'),
    refloop: M('REF LOOP', BNC, 'ref', 'out', REF_STD, 'Boucle de la référence (terminée si non utilisée).'),
    ltcin: M('LTC IN', 'XLR / bornier', 'ref', 'in', 'SMPTE ST 12-1 (LTC)', 'Timecode heure du jour venant du SPG : toutes les entrées enregistrées partagent le même timecode, d\'où le multicam synchronisé.'),
    ltcout: M('LTC OUT', 'XLR / bornier', 'ref', 'out', 'LTC', 'Sortie timecode.'),
    gpi: M('GPI', 'D-sub', 'data', 'io', 'Entrées / sorties par contact (manuels XT)', 'Déclenchements par contacts : démarrer une lecture depuis le mélangeur, renvoyer un tally, etc.'),
    rs1: M('RS-422 1', 'D-sub 9', 'data', 'io', 'Liaison série (19 200 bauds d\'après les manuels XT)', 'Port série de télécommande : sur les serveurs XT, la télécommande LSM s\'y raccorde. Vérifier l\'affectation des ports dans la configuration de votre serveur.'),
    rs2: M('RS-422 2', 'D-sub 9', 'data', 'io', 'Série', 'Second port de télécommande (deuxième LSM ou protocole Sony/VDCP pour un automate ou le mélangeur).'),
    rs3: M('RS-422 3', 'D-sub 9', 'data', 'io', 'Série', 'Port série (protocoles tiers).'),
    rs4: M('RS-422 4', 'D-sub 9', 'data', 'io', 'Série', 'Port série (protocoles tiers).'),
    aes: M('AES / analogique', 'D-sub', 'audio', 'io', 'AES3 et analogique', 'Audio associé aux images : jusqu\'à 192 pistes non compressées avec routeur audio interne (embeddé, AES, MADI, analogique).'),
    madiin: M('MADI IN', BNC, 'audio', 'in', 'AES10 (64 canaux)', 'Audio multicanal à enregistrer avec les images.'),
    madiout: M('MADI OUT', BNC, 'audio', 'out', 'AES10', 'Audio multicanal des sorties de lecture.'),
    vga: M('VGA', 'D-sub 15 HD', 'video', 'out', '', 'Écran du serveur : menus, configuration, et sur les systèmes Multicam l\'écran des clips (clip screen).'),
    kbd: M('Clavier', 'PS/2 / USB', 'data', 'in', '', 'Clavier du serveur : nommage des clips, configuration.'),
    usb: M('USB', 'USB', 'data', 'io', '', 'Maintenance, export.'),
    psu1: M('Alimentation 1', 'IEC', 'power', 'in', '100 à 240 V', 'Alimentations redondantes : on les branche sur deux circuits différents.'),
    psu2: M('Alimentation 2', 'IEC', 'power', 'in', '100 à 240 V', 'Seconde alimentation (redondance).'),
  });
  const C = {
    disks: M('Disques (RAID)', 'Tiroirs', 'data', '', '', 'Stockage interne jusqu\'à 9 To (≈ 30 h d\'UHD-4K à 600 Mb/s ; ≈ 130 h annoncées avec l\'extension externe à 40 To) ; en RAID : la perte d\'un disque n\'interrompt pas l\'enregistrement.'),
    leds: M('Voyants d\'état', 'LED', 'data', '', '', 'Alimentation, disques, réseau, enregistrement.'),
  };
  const front = /** @type {Item[]} */ ([{ t: 'body', x: 10, y: 10, w: 980, h: 500, r: 8 }, { t: 'text', x: 40, y: 60, s: 'SERVEUR DE PRODUCTION (type EVS XT4K) · 6U', size: 20, w: 700 }]);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) front.push({ t: 'disk', id: 'disks', x: 320 + c * 105, y: 120 + r * 170, w: 92, h: 150 });
  ['POWER', 'DISK', 'NET', 'REC', 'ALARM'].forEach((l, i) => front.push({ t: 'led', id: 'leds', x: 70, y: 140 + i * 50, c: i === 4 ? 'red' : i === 3 ? 'tally' : 'green', l }));
  const rear = /** @type {Item[]} */ ([{ t: 'body', x: 10, y: 10, w: 980, h: 500, r: 8 }]);
  rear.push({ t: 'group', x: 30, y: 36, w: 390, h: 200, l: 'Modules codec · SDI 1 à 6' }, { t: 'group', x: 30, y: 270, w: 390, h: 200, l: 'Modules codec · SDI 7 à 12' });
  for (let i = 0; i < 6; i++) { rear.push({ t: 'port', id: 'sdi' + (i + 1), k: 'bnc', x: 75 + i * 62, y: 120, l: 'SDI ' + (i + 1) }); rear.push({ t: 'port', id: 'sdi' + (i + 7), k: 'bnc', x: 75 + i * 62, y: 355, l: 'SDI ' + (i + 7) }); }
  rear.push({ t: 'group', x: 440, y: 36, w: 370, h: 100, l: 'Réseaux' });
  rear.push({ t: 'port', id: 'xnet', k: 'sfp', x: 485, y: 92, l: 'XNET' });
  row(rear, ['gbe1', 'gbe2', 'ipio'], 570, 92, 80, 'sfp', ['10GbE 1', '10GbE 2', 'IP I/O']);
  rear.push({ t: 'group', x: 440, y: 148, w: 370, h: 100, l: 'Synchronisation et timecode' });
  rear.push({ t: 'port', id: 'refin', k: 'bnc', x: 480, y: 200, l: 'REF IN' }, { t: 'port', id: 'refloop', k: 'bnc', x: 535, y: 200, l: 'REF LOOP' }, { t: 'port', id: 'ltcin', k: 'xlr', x: 610, y: 200, l: 'LTC IN' }, { t: 'port', id: 'ltcout', k: 'xlr', x: 680, y: 200, l: 'LTC OUT' }, { t: 'port', id: 'gpi', k: 'dsub25', x: 760, y: 200, l: 'GPI' });
  rear.push({ t: 'group', x: 440, y: 260, w: 370, h: 100, l: 'Commande' });
  rear.push({ t: 'port', id: 'mgmt1', k: 'rj45', x: 478, y: 312, l: 'LAN 1' }, { t: 'port', id: 'mgmt2', k: 'rj45', x: 530, y: 312, l: 'LAN 2' });
  row(rear, ['rs1', 'rs2', 'rs3', 'rs4'], 600, 312, 58, 'dsub9', ['RS422 1', 'RS422 2', 'RS422 3', 'RS422 4']);
  rear.push({ t: 'group', x: 440, y: 372, w: 370, h: 100, l: 'Audio et console' });
  rear.push({ t: 'port', id: 'aes', k: 'dsub25', x: 490, y: 424, l: 'AES' }, { t: 'port', id: 'madiin', k: 'bnc', x: 562, y: 424, l: 'MADI IN' }, { t: 'port', id: 'madiout', k: 'bnc', x: 618, y: 424, l: 'MADI OUT' }, { t: 'port', id: 'vga', k: 'dsub9', x: 682, y: 424, l: 'VGA' }, { t: 'port', id: 'kbd', k: 'usb', x: 738, y: 424, l: 'CLAVIER' }, { t: 'port', id: 'usb', k: 'usb', x: 784, y: 424, l: 'USB' });
  rear.push({ t: 'psu', id: 'psu1', x: 830, y: 36, w: 140, h: 200, l: 'PSU 1' }, { t: 'psu', id: 'psu2', x: 830, y: 270, w: 140, h: 200, l: 'PSU 2' });
  return {
    key: 'evs', title: 'Serveur ralenti (type EVS XT4K)', multi: true,
    intro: 'Serveur de production « live » : il enregistre en boucle plusieurs flux caméras (les « trains » d\'enregistrement) et, en même temps, relit n\'importe quel moment sur ses sorties de lecture, à n\'importe quelle vitesse. Toutes les entrées partagent le timecode : l\'opérateur passe d\'un angle à l\'autre sur la même action (multicam). Le XT4K a apporté l\'UHD-4K sur un seul câble 12G-SDI.',
    views: { arriere: { label: 'Face arrière', w: 1000, h: 520, items: rear }, avant: { label: 'Face avant', w: 1000, h: 520, items: front } },
    ports: P, controls: C,
    specs: [['Canaux', '4 canaux UHD-4K ou 8 canaux HD ; 12 canaux HD et plus avec la configuration ChannelMAX'], ['Vidéo', '12G-SDI (UHD sur un seul câble), Quad 3G-SDI 2SI / découpage en carrés en option ; IP intégrée'], ['Enregistrement', 'XAVC-4K en UHD, 10 bits, HDR'], ['Stockage', 'Interne jusqu\'à 9 To (≈ 30 h d\'UHD-4K), extensible en externe jusqu\'à 40 To (≈ 130 h d\'UHD-4K annoncées)'], ['Audio', 'Jusqu\'à 192 pistes non compressées, routeur audio interne ; analogique, AES, embeddé, MADI'], ['Réseaux', 'XNet (production), 2 × 10 GbE (partage des médias, IPDirector), LAN de gestion redondant'], ['Pilotage', 'Télécommande LSM (Multicam), IPDirector, protocoles série / IP'], ['Format', '6U'], ['Dans ce car', '(calculé selon le format : voir la configuration EVS au poste ralentis)']],
    lesson: ['En UHD, un XT4K n\'a que 4 canaux : par exemple 3 REC + 1 PLAY. Une caméra super ralenti 3x occupe à elle seule les 3 canaux d\'enregistrement.', 'En HD, le même serveur offre 8 canaux (12 avec ChannelMAX) : c\'est souvent le format qui donne le plus d\'angles enregistrés.', 'Les alimentations sont doublées : branchez-les sur deux circuits différents de l\'onduleur.', 'Le genlock et le LTC doivent venir du même SPG que le reste du car.', 'Les connecteurs série et GPI sont décrits d\'après les manuels techniques XT (XT2, XT3, XT4K) : vérifiez l\'affectation exacte des ports de votre serveur.'],
  };
}

// ---------------------------------------------------------------- télécommande LSM (Multicam)
function lsmDevice() {
  const P = {
    rs422: M('RS-422 (vers le serveur)', 'D-sub 9', 'data', 'io', 'Liaison série vers un port RS-422 du serveur', 'La télécommande pilote le serveur XT par liaison série (d\'après les manuels Multicam et XT). Un câble par télécommande.'),
    dcin: M('Alimentation', 'Connecteur DC', 'power', 'in', '', 'Alimentation de la télécommande.'),
  };
  const C = {
    display: M('Afficheur', 'Écran de la télécommande', 'data', '', '', 'Affiche le menu courant, le timecode, la vitesse, la caméra et les fonctions des touches F (« soft keys »).'),
    fkeys: M('Touches F1 à F10', 'Boutons', 'data', '', '', 'Clips de la page en cours (rappel, ou sauvegarde avec la fonction d\'enregistrement de clip) ; avec SHIFT + PAGE, choix de la page 1 à 10. Selon le menu, elles prennent d\'autres fonctions (soft keys).'),
    camkeys: M('Choix de l\'angle', 'Boutons', 'video', '', '', 'Sélection de la caméra (entrée enregistrée) sur le canal piloté : on change d\'angle en gardant le même timecode.'),
    opblock: M('Bloc opérationnel', 'Boutons à double fonction', 'data', '', '', 'Chaque touche a une fonction principale et une secondaire (avec SHIFT) : IN / GOTO IN, OUT / GOTO OUT, PLST / BROWSE, LOOP, RETURN, PLAY, LIVE (E/E), FAST JOG, TAKE, MENU, CLEAR…'),
    lever: M('Levier', 'Levier', 'data', '', '', 'Vitesse de lecture de 0 à 100 % ; avec la plage secondaire, de −100 à +100 % ou −200 à +200 %. Un ralenti se joue en général entre 25 et 50 % ; 33 % pour une caméra 3x.'),
    jog: M('Jog', 'Molette', 'data', '', '', 'Recherche image par image (un tour ≈ 35 images d\'après le manuel Multicam). FAST JOG pour le recalage rapide (désactivé automatiquement après PLAY ou LIVE). En mode BROWSE, la molette fait défiler les clips.'),
  };
  const top = /** @type {Item[]} */ ([{ t: 'body', x: 10, y: 10, w: 960, h: 500, r: 16 }, { t: 'lcd', id: 'display', x: 40, y: 30, w: 620, h: 96 }]);
  for (let i = 0; i < 10; i++) top.push({ t: 'btn', id: 'fkeys', x: 40 + i * 62, y: 140, w: 56, h: 40, l: 'F' + (i + 1) });
  [['IN', 'GOTO IN'], ['OUT', 'GOTO OUT'], ['PLST', 'BROWSE'], ['LOOP', ''], ['RETURN', ''], ['PLAY', ''], ['LIVE E/E', ''], ['FAST JOG', ''], ['TAKE', ''], ['PGM/PRV', '']].forEach(([l], i) => top.push({ t: 'btn', id: 'opblock', x: 40 + i * 62, y: 210, w: 56, h: 40, l }));
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach((l, i) => top.push({ t: 'btn', id: 'camkeys', x: 40 + i * 62, y: 270, w: 56, h: 40, l: 'CAM ' + l }));
  ['SHIFT', 'MENU', 'CLEAR', 'PAGE'].forEach((l, i) => top.push({ t: 'btn', id: 'opblock', x: 412 + i * 62, y: 270, w: 56, h: 40, l }));
  top.push({ t: 'lever', id: 'lever', x: 720, y: 40, w: 60, h: 300 });
  top.push({ t: 'jog', id: 'jog', x: 860, y: 380, r: 88 });
  top.push({ t: 'text', x: 40, y: 350, s: 'Disposition simplifiée : se référer au manuel Multicam de votre version.', size: 11, w: 500 });
  const rear = /** @type {Item[]} */ ([{ t: 'body', x: 10, y: 10, w: 960, h: 140, r: 10 }, { t: 'port', id: 'rs422', k: 'dsub9', x: 120, y: 80, l: 'RS-422' }, { t: 'port', id: 'dcin', k: 'xlr', x: 240, y: 80, l: 'DC' }]);
  return {
    key: 'lsm', title: 'Télécommande de ralentis (type EVS LSM, logiciel Multicam)', multi: true,
    intro: 'La télécommande de l\'opérateur ralenti : un afficheur, les touches F1 à F10 (clips et fonctions de menu), un bloc de touches à double fonction (SHIFT), le levier de vitesse et la molette jog. Utilisée par des milliers d\'opérateurs dans le sport en direct, elle pilote le serveur XT par liaison série.',
    views: { dessus: { label: 'Dessus (commandes)', w: 980, h: 520, items: top }, arriere: { label: 'Arrière', w: 980, h: 160, items: rear } },
    ports: P, controls: C,
    specs: [['Liaison', 'RS-422 vers le serveur (un port par télécommande)'], ['Logiciel', 'Multicam LSM (sur le serveur)'], ['Clips', '10 pages ; nommage page · banque · touche · angle (ex. 111A)'], ['Levier', '0 à 100 % ; plage secondaire −100/+100 % ou −200/+200 %'], ['Jog', '≈ 35 images par tour ; FAST JOG pour le recalage rapide']],
    lesson: ['Méthode : sortie en LIVE pendant le jeu ; après l\'action, jog arrière, IN, choix de l\'angle, puis lecture au levier quand le réalisateur envoie l\'EVS.', 'RETURN : à l\'intérieur d\'un clip trop court, on retourne sur la même image dans le train d\'enregistrement pour prendre ce qu\'il y a avant ou après.', 'TAKE : en mode PGM + PRV, échange PGM et PRV ; en mode 2 PGM, échange le contenu des deux sorties.', 'Verrouiller la télécommande : CLEAR puis MENU dans les 2 secondes (d\'après le manuel Multicam).'],
  };
}

// ---------------------------------------------------------------- poste IPDirector
function ipdDevice() {
  return rackGeneric('ipd', 'Poste IPDirector (EVS)', 'Station de travail qui gère les médias des serveurs EVS : base de données des clips (recherche, métadonnées, mots-clés), log des actions (clip logger), montage de playlists, contrôle des canaux d\'enregistrement et de lecture, transferts vers le montage.', {
    w: 760, h: 240, label: 'POSTE IPDIRECTOR · raccordements',
    ports: [
      { id: 'lan', k: 'rj45', x: 90, y: 130, l: 'LAN', meta: M('LAN', 'RJ-45 / SFP+', 'ip', 'io', 'Réseau de partage des médias EVS', 'Accès aux serveurs (base de données des clips, contrôle des canaux).') },
      { id: 'video', k: 'bnc', x: 200, y: 130, l: 'SDI MON', meta: M('Moniteur', BNC, 'video', 'in', '', 'Moniteur de visualisation des canaux.') },
      { id: 'kb', k: 'usb', x: 300, y: 130, l: 'USB', meta: M('Clavier / pupitre', 'USB', 'data', 'in', '', 'Clavier, souris, pupitre jog éventuel.') },
      { id: 'pwr', k: 'iec', x: 400, y: 130, l: 'SECTEUR', meta: M('Alimentation', 'IEC', 'power', 'in', '', 'Secteur ondulé.') },
    ],
    specs: [['Fonctions', 'Contrôle multicam des enregistrements et lectures, revue des contenus en cours d\'enregistrement, base de données (clips, playlists), log, transferts'], ['Modules', 'Database explorer, Clip logger, Playlist, Control panel (selon licences)']],
    lesson: ['IPDirector et la télécommande LSM travaillent sur les mêmes clips : un clip nommé dans IPDirector apparaît pour l\'opérateur ralenti.', 'Le logger note les actions avec des mots-clés pendant le direct : à la mi-temps, on retrouve tous les « TIR » d\'un joueur en une recherche.'],
  });
}

// ---------------------------------------------------------------- mélangeur Sony XVS-6000
function xvsDevice() {
  const P = {}; const items = /** @type {Item[]} */ ([{ t: 'body', x: 10, y: 10, w: 980, h: 580, r: 6 }, { t: 'text', x: 26, y: 34, s: 'XVS-6000 · processeur 6U · face arrière (disposition schématique)', size: 13, w: 700 }]);
  /** @type {Array<[string, string, number, number, string]>} */
  const boards = [['in', 'Carte d\'entrées 12G/3G-SDI', 1, 24, 'in'], ['out', 'Carte de sorties', 1, 16, 'out']];
  let y = 90;
  for (const [pre, l, from, count, d] of boards) {
    items.push({ t: 'group', x: 30, y: y - 40, w: 760, h: count > 16 ? 160 : 100, l });
    for (let i = 0; i < count; i++) {
      const id = pre + (from + i); const c = i % 12, r = Math.floor(i / 12);
      items.push({ t: 'port', id, k: 'bnc', x: 70 + c * 60, y: y + r * 62, l: (d === 'in' ? 'IN ' : 'OUT ') + (from + i), small: true });
      P[id] = d === 'in' ? M(`INPUT ${from + i}`, BNC, 'video', 'in', SDI_STD, 'Entrée du mélangeur (bus de sources). Convertisseur de format possible sur chaque entrée selon les options.')
        : M(`OUTPUT ${from + i}`, BNC, 'video', 'out', SDI_STD, 'Sortie assignable : PGM, clean, preview, AUX, multiviewer… selon la configuration (24 sorties assignables en HD, 6 en 4K dans la configuration de base).');
    }
    y += count > 16 ? 190 : 130;
  }
  items.push({ t: 'group', x: 30, y: y - 40, w: 760, h: 100, l: 'Option IP (ST 2110)' });
  items.push({ t: 'port', id: 'ip1', k: 'sfp', x: 90, y, l: '100G IP 1' }, { t: 'port', id: 'ip2', k: 'sfp', x: 180, y, l: '100G IP 2' });
  P.ip1 = M('Carte IP 100G', 'QSFP28', 'ip', 'io', 'SMPTE ST 2110, 4K et HD sur le même lien', 'Entrées/sorties sur réseau IP managé (option). Conversion de format côté entrée.');
  P.ip2 = M('Carte IP 100G (2)', 'QSFP28', 'ip', 'io', 'ST 2110 / ST 2022-7', 'Second lien (réseau rouge / bleu).');
  const side = [
    { id: 'refin', k: 'bnc', x: 860, y: 90, l: 'REF IN', meta: M('REF IN', BNC + ' avec boucle', 'ref', 'in', REF_STD, 'Référence de synchro avec boucle : toutes les entrées doivent être en phase avec elle.') },
    { id: 'refloop', k: 'bnc', x: 930, y: 90, l: 'LOOP', meta: M('REF LOOP', BNC, 'ref', 'out', REF_STD, 'Boucle de la référence (terminer à 75 Ω si inutilisée).') },
    { id: 'mvslan', k: 'rj45', x: 860, y: 170, l: 'MVS LAN', meta: M('NETWORK (MVS LAN)', 'RJ-45 1000BASE-T', 'ip', 'io', 'Gigabit Ethernet', 'Réseau du mélangeur : liaison avec l\'unité d\'interface système (MKS-X7700) et le pupitre ICP.') },
    { id: 'utillan', k: 'rj45', x: 930, y: 170, l: 'UTIL LAN', meta: M('NETWORK (UTIL LAN)', 'RJ-45 1000BASE-T', 'ip', 'io', 'Gigabit Ethernet', 'Réseau utilitaire : applications web (Virtual Menu, Virtual Shot Box), maintenance.') },
    { id: 'stally', k: 'dsub25', x: 895, y: 250, l: 'TALLY', meta: M('Tally série / parallèle', 'D-sub', 'comms', 'out', 'Tally série, parallèle (via MKS-X7701) ou IP', 'Le mélangeur sait ce qui est à l\'antenne : il pilote le tally des caméras, du multiview et des serveurs.') },
    { id: 'ac1', k: 'iec', x: 860, y: 340, l: 'AC 1', meta: M('Alimentation 1', 'IEC', 'power', 'in', '', 'Alimentations redondantes.') },
    { id: 'ac2', k: 'iec', x: 930, y: 340, l: 'AC 2', meta: M('Alimentation 2', 'IEC', 'power', 'in', '', 'Seconde alimentation (sur un autre circuit).') },
  ];
  for (const p of side) { items.push({ t: 'port', id: p.id, k: p.k, x: p.x, y: p.y, l: p.l }); P[p.id] = p.meta; }
  return {
    key: 'mixer', title: 'Mélangeur — processeur (type Sony XVS-6000)', multi: false,
    intro: 'Le pupitre du truquiste (ICP-X7000) n\'est qu\'une télécommande : le traitement est fait dans ce processeur, en baie. Il reçoit ses entrées de la grille et renvoie PGM, clean feed, preview et AUX. Il intègre aussi des multiviewers, une mémoire d\'images (frame memory) et des convertisseurs de format.',
    views: { arriere: { label: 'Face arrière', w: 1000, h: 600, items } },
    ports: P, controls: {},
    specs: [['Gamme', 'Sony XVS (XVS-9000 / 8000 / 7000 / 6000)'], ['HD', 'Jusqu\'à 4 M/E selon les sources, 48 à 64 entrées, 24 sorties assignables, jusqu\'à 16 keyers'], ['4K (configuration de base)', '2 M/E, 16 entrées, 6 sorties, 8 keyers (4 full + 4 sub)'], ['Keyers', '4 par M/E, redimensionneur 2,5D sur chaque keyer ; DME 3D en option (XKS-8470 : 2 canaux HD ; XKS-8475 : 1 canal 4K)'], ['Frame memory', 'Stockage non volatil 480 Go : images fixes et clips, transitions « clip » (logo animé)'], ['Multiviewer', '2 canaux intégrés, découpages 4 / 10 / 13 / 16'], ['AUX', 'Transitions cut et mix ; correction colorimétrique primaire sur toutes les entrées et AUX'], ['Interfaces', '12G-SDI ; IP ST 2110 par cartes 100G (option)'], ['Réseau', 'MVS LAN et UTIL LAN (1000BASE-T)'], ['Référence', 'REF IN BNC 75 Ω avec boucle']],
    lesson: ['Les chiffres d\'entrées varient selon les sources (48 ou 64 en HD) et selon les cartes installées : vérifiez la configuration de votre processeur.', 'En 4K, le nombre d\'entrées baisse fortement : dans ce simulateur, le mélangeur passe de 22 à 16 entrées utilisées en UHD.', 'Le pupitre et le processeur sont reliés par le réseau du mélangeur via l\'unité d\'interface système (MKS-X7700) : si le pupitre « gèle », le processeur continue de sortir l\'image.'],
  };
}
function icpDevice() {
  const C = {
    xpt: M('Rangées de boutons XPT', 'Boutons RVB', 'video', '', '', 'Un bouton par source (20, 28 ou 36 par rangée selon le modèle). Rangée du haut : bus de clé (KEY) / AUX ; puis bus d\'arrière-plan A (PGM) et B (preset). Couleur du bouton selon le bus.'),
    oled: M('Afficheurs OLED', 'OLED', 'data', '', '', 'Le nom de chaque source s\'affiche au-dessus de son bouton : il suit la grille et l\'affectation du mélangeur.'),
    trans: M('Module de transition', 'Levier + boutons', 'data', '', '', 'Type de transition (MIX, WIPE, DME, CLIP), éléments concernés (BKGD, KEY 1 à 4), durée, AUTO TRANS, CUT et levier de transition (fader).'),
    keyers: M('Keyers', 'Boutons', 'data', '', '', '4 keyers par M/E : source, type de découpe, redimensionneur 2,5D.'),
    dsk: M('DSK / sortie', 'Boutons', 'data', '', '', 'Incrustations aval (habillage) et fondu au noir sur le bus de sortie.'),
    menu: M('Pavé LCD / menu', 'Écran tactile', 'data', '', '', 'Menus de réglage et pavé de touches LCD : rappel des « snapshots », réglages des effets.'),
    joy: M('Joystick (positionneur)', 'Joystick', 'data', '', '', 'Position, taille et rotation des images incrustées (DME, resizer).'),
    snap: M('Snapshots / Shotbox', 'Boutons', 'data', '', '', 'Mémoires d\'état du mélangeur rappelées en une touche (ex. « image dans l\'image prête »).'),
  };
  const P = {
    lan: M('LAN (vers MKS-X7700)', 'RJ-45', 'ip', 'io', 'Gigabit Ethernet', 'Le pupitre dialogue avec l\'unité d\'interface système, qui dialogue avec le processeur.'),
    ac: M('Alimentation', 'IEC', 'power', 'in', '', 'Secteur ondulé.'),
  };
  const top = /** @type {Item[]} */ ([{ t: 'body', x: 10, y: 10, w: 980, h: 520, r: 12 }, { t: 'text', x: 30, y: 40, s: 'PUPITRE ICP-X7000 · 1 rangée M/E (extrait, disposition schématique)', size: 13, w: 700 }]);
  for (let r = 0; r < 3; r++) {
    top.push({ t: 'text', x: 30, y: 98 + r * 74, s: ['KEY/AUX', 'A · PGM', 'B · PST'][r], size: 11, w: 600 });
    for (let i = 0; i < 12; i++) {
      top.push({ t: 'btn', id: 'oled', x: 100 + i * 52, y: 70 + r * 74, w: 46, h: 16, l: String(i + 1), labelKey: 'oled:' + i, oled: true, c: 'cyan' });
      top.push({ t: 'btn', id: 'xpt', x: 100 + i * 52, y: 90 + r * 74, w: 46, h: 36, l: String(i + 1), litKey: `xpt:${r}:${i}`, litColor: ['#c9a227', '#ff3b30', '#2fd25a'][r] });
    }
  }
  [['MIX', 'trans'], ['WIPE', 'trans'], ['DME', 'trans'], ['CLIP', 'trans'], ['BKGD', 'trans'], ['KEY1', 'keyers'], ['KEY2', 'keyers'], ['CUT', 'trans'], ['AUTO', 'trans']].forEach(([l, id], i) => top.push({ t: 'btn', id, x: 100 + i * 62, y: 320, w: 56, h: 40, l }));
  ['DSK1', 'DSK2', 'FTB'].forEach((l, i) => top.push({ t: 'btn', id: 'dsk', x: 100 + i * 62, y: 380, w: 56, h: 40, l }));
  ['SNAP 1', 'SNAP 2', 'SNAP 3', 'SNAP 4'].forEach((l, i) => top.push({ t: 'btn', id: 'snap', x: 320 + i * 62, y: 380, w: 56, h: 40, l }));
  top.push({ t: 'lever', id: 'trans', x: 760, y: 70, w: 50, h: 260, fader: true, l: 'FADER' });
  top.push({ t: 'lcd', id: 'menu', x: 830, y: 70, w: 150, h: 116 });
  top.push({ t: 'joy', id: 'joy', x: 900, y: 400, r: 55, l: 'POSITIONNEUR' });
  const rear = /** @type {Item[]} */ ([{ t: 'body', x: 10, y: 10, w: 980, h: 140, r: 10 }, { t: 'port', id: 'lan', k: 'rj45', x: 120, y: 80, l: 'LAN' }, { t: 'port', id: 'ac', k: 'iec', x: 220, y: 80, l: 'AC' }]);
  return {
    key: 'mixpanel', title: 'Pupitre du mélangeur (type Sony ICP-X7000)', multi: false,
    intro: 'Surface de commande modulaire des mélangeurs Sony XVS : 1 à 4 rangées M/E, 20, 28 ou 36 boutons de croisement (XPT) par rangée, afficheurs OLED des noms de sources, boutons RVB, pavé LCD. Le pupitre est relié au processeur par l\'unité d\'interface système MKS-X7700.',
    views: { dessus: { label: 'Dessus (commandes)', w: 1000, h: 540, items: top }, arriere: { label: 'Arrière', w: 1000, h: 160, items: rear } },
    ports: P, controls: C,
    specs: [['Rangées', '1 à 4 M/E'], ['Boutons XPT', '20, 28 ou 36 par rangée ; châssis standard, étroit ou petit'], ['Affichage', 'OLED au-dessus des boutons, boutons RVB, pavé LCD'], ['Installation', 'À plat, incliné, ou séparé en deux positions'], ['Liaison', 'Unité d\'interface système MKS-X7700 ou MKS-X2700, station de contrôle du mélangeur'], ['À distance', 'Virtual Menu et Virtual Shot Box (applications web sur tablette ou PC)']],
    lesson: ['Les noms OLED viennent de la configuration : si un nom est faux, l\'erreur est dans la table des sources (ou dans le brassage), pas dans le pupitre.', 'Snapshot : on mémorise un état complet (sources, clés, transitions) pour le rappeler instantanément en direct.'],
  };
}
function siuDevice() {
  return rackGeneric('siu', 'Unité d\'interface système (type Sony MKS-X7700)', 'Relie le ou les pupitres au processeur du mélangeur et porte les cartes de tally / GPI (MKS-X7701 : 3 connecteurs D-sub 37, 18 sorties relais par carte).', {
    w: 900, h: 240, label: 'MKS-X7700 · face arrière (schématique)',
    ports: [
      { id: 'lanp', k: 'rj45', x: 80, y: 130, l: 'PANEL', meta: M('LAN pupitre', 'RJ-45', 'ip', 'io', 'Gigabit Ethernet', 'Vers le pupitre ICP-X7000.') },
      { id: 'lanm', k: 'rj45', x: 160, y: 130, l: 'MVS LAN', meta: M('LAN processeur', 'RJ-45', 'ip', 'io', 'Gigabit Ethernet', 'Vers le processeur XVS (MVS LAN).') },
      ...[1, 2, 3].map((i) => ({ id: 'tally' + i, k: 'dsub25', x: 270 + (i - 1) * 90, y: 130, l: 'TALLY ' + i, meta: M('TALLY / GPI ' + i, 'D-sub 37', 'comms', 'out', 'Contacts relais (carte MKS-X7701)', 'Sorties de tally parallèle : rouge (PGM) et vert (preset) vers les CCU et les moniteurs.') })),
      { id: 'ac', k: 'iec', x: 620, y: 130, l: 'AC', meta: M('Alimentation', 'IEC', 'power', 'in', '', 'Secteur ondulé.') },
    ],
  });
}

// ---------------------------------------------------------------- appareils de baie (génériques)
function rackGeneric(key, title, intro, opts) {
  const P = {}; const items = /** @type {Item[]} */ ([{ t: 'body', x: 10, y: 10, w: opts.w - 20, h: opts.h - 20, r: 6 }]);
  if (opts.label) items.push({ t: 'text', x: 26, y: 34, s: opts.label, size: 13, w: 600 });
  for (const g of opts.groups || []) {
    items.push({ t: 'group', x: g.x - 26, y: g.y - 40, w: g.cols * g.dx + 22, h: (g.rows || 1) * g.dy + 30, l: g.l });
    for (let i = 0; i < g.count; i++) {
      const id = g.prefix + (g.from + i);
      const c = i % g.cols, r = Math.floor(i / g.cols);
      items.push({ t: 'port', id, k: g.k, x: g.x + c * g.dx, y: g.y + r * g.dy, l: g.short ? g.short(g.from + i) : String(g.from + i), small: true });
      P[id] = M(g.name(g.from + i), g.conn, g.s, g.d, g.std, g.desc(g.from + i));
    }
  }
  for (const p of opts.ports || []) { items.push({ t: 'port', id: p.id, k: p.k, x: p.x, y: p.y, l: p.l }); P[p.id] = p.meta; }
  for (const it of opts.extra || []) items.push(it);
  return { key, title, intro, multi: false, views: { arriere: { label: opts.viewLabel || 'Face arrière', w: opts.w, h: opts.h, items } }, ports: P, controls: opts.controls || {}, specs: opts.specs || [], lesson: opts.lesson || [] };
}

export function routerInDesc(i) { return `Entrée ${i} de la grille.`; }
const DEV = {};
DEV.cam = camDevice(); DEV.ccu = ccuDevice(); DEV.rcp = rcpDevice(); DEV.evs = evsDevice(); DEV.lsm = lsmDevice();

DEV.router = rackGeneric('router', 'Grille de commutation (exemple de matrice 12G-SDI)', 'La grille reçoit toutes les sources (caméras, serveurs, mélangeur, habillage, retours) et les distribue vers toutes les destinations. Ici : 48 entrées et 68 sorties visibles (les grilles de car font souvent 144 à 288 ports, ou sont en IP).', {
  w: 1000, h: 640, label: 'GRILLE · face arrière (extrait)',
  groups: [
    { l: 'Entrées 1 à 48', prefix: 'in', from: 1, count: 48, cols: 16, rows: 3, x: 66, y: 100, dx: 54, dy: 62, k: 'bnc', conn: BNC, s: 'video', d: 'in', std: SDI_STD, name: (i) => `IN ${i}`, desc: (i) => 'Entrée de la grille.' },
    { l: 'Sorties 1 à 68', prefix: 'out', from: 1, count: 68, cols: 17, rows: 4, x: 66, y: 340, dx: 51, dy: 62, k: 'bnc', conn: BNC, s: 'video', d: 'out', std: SDI_STD, name: (i) => `OUT ${i}`, desc: (i) => 'Sortie de la grille.' },
  ],
  ports: [
    { id: 'ref', k: 'bnc', x: 930, y: 100, l: 'REF', meta: M('REF IN', BNC, 'ref', 'in', REF_STD, 'La grille commute sur l\'intervalle de suppression : elle doit être verrouillée sur la référence.') },
    { id: 'lan1', k: 'rj45', x: 930, y: 170, l: 'LAN 1', meta: M('LAN 1', 'RJ-45', 'ip', 'io', '', 'Contrôle (panneaux X-Y, broadcast controller).') },
    { id: 'lan2', k: 'rj45', x: 930, y: 230, l: 'LAN 2', meta: M('LAN 2', 'RJ-45', 'ip', 'io', '', 'Contrôle redondant.') },
  ],
  specs: [['Format', '12G-SDI (UHD) / 3G / HD, ou IP ST 2110 sur les cars récents'], ['Commutation', 'Dans l\'intervalle de suppression (« clean switch ») si verrouillée sur la référence'], ['Contrôle', 'Panneaux X-Y, salvos, noms de sources (UMD), tally']],
  lesson: ['Le nom d\'une source suit le signal : la grille pousse les noms (UMD) vers le multiview.', 'Une erreur de prise sur une sortie « départ » envoie la mauvaise image à la chaîne : toujours vérifier au retour antenne.'],
});
DEV.mixer = xvsDevice(); DEV.mixpanel = icpDevice(); DEV.siu = siuDevice(); DEV.ipd = ipdDevice();
DEV.mv = rackGeneric('mv', 'Processeur multiview', 'Assemble jusqu\'à des dizaines de sources sur les écrans de la régie, avec les étiquettes (UMD), le tally, les horloges, les vumètres et les alarmes (perte de signal, image figée, noir).', {
  w: 1000, h: 420, label: 'MULTIVIEWER · face arrière',
  groups: [{ l: 'Entrées 1 à 40', prefix: 'in', from: 1, count: 40, cols: 20, rows: 2, x: 52, y: 100, dx: 46, dy: 62, k: 'bnc', conn: BNC, s: 'video', d: 'in', std: SDI_STD, name: (i) => `IN ${i}`, desc: (i) => i <= 18 ? 'Tuile alimentée par la grille.' : i === 19 ? 'Multiviewer interne de l\'EVS.' : i > 24 ? 'Sortie CHARACTER d\'une CCU.' : 'Entrée.' }],
  ports: [
    { id: 'out1', k: 'bnc', x: 70, y: 300, l: 'OUT 1', meta: M('OUT 1', '12G-SDI / HDMI', 'video', 'out', '', 'Vers le mur d\'écrans de la production.') },
    { id: 'out2', k: 'bnc', x: 130, y: 300, l: 'OUT 2', meta: M('OUT 2', '12G-SDI / HDMI', 'video', 'out', '', 'Vers les écrans de la vision.') },
    { id: 'ref', k: 'bnc', x: 220, y: 300, l: 'REF', meta: M('REF IN', BNC, 'ref', 'in', REF_STD, 'Référence.') },
    { id: 'lan', k: 'rj45', x: 300, y: 300, l: 'LAN', meta: M('LAN', 'RJ-45', 'ip', 'io', 'TSL UMD', 'Reçoit les noms de sources et le tally.') },
  ],
});
DEV.spg = rackGeneric('spg', 'Générateur de synchro (type Telestream / Tektronix SPG8000A)', 'Le métronome du car : verrouillé sur le GPS, il fournit la référence vidéo (black burst, tri-level), le timecode, l\'horloge audio et le PTP. Il est doublé (principal + secours) avec un inverseur automatique.', {
  w: 1000, h: 260, label: 'SPG · face arrière (1U, disposition schématique)',
  ports: [
    ...[1, 2, 3, 4].map((i) => ({ id: 'bb' + i, k: 'bnc', x: 50 + (i - 1) * 52, y: 130, l: 'BB ' + i, meta: M('BLACK BURST ' + i, BNC, 'ref', 'out', 'SMPTE ST 318 / 625 lignes', 'Référence analogique pour les équipements SD et beaucoup de mélangeurs.') })),
    ...[1, 2, 3].map((i) => ({ id: 'tls' + i, k: 'bnc', x: 280 + (i - 1) * 52, y: 130, l: 'TRI ' + i, meta: M('TRI-LEVEL ' + i, BNC, 'ref', 'out', 'Tri-level HD (ST 274/296)', 'Référence HD à trois niveaux.') })),
    ...[1, 2].map((i) => ({ id: 'sdi' + i, k: 'bnc', x: 460 + (i - 1) * 52, y: 130, l: 'SDI ' + i, meta: M('SDI TEST ' + i, BNC, 'video', 'out', SDI_STD, 'Mire de test (barres, identifiant) et 1 kHz.') })),
    { id: 'wclk', k: 'bnc', x: 580, y: 130, l: 'WCLK', meta: M('WORD CLOCK', BNC, 'ref', 'out', '48 kHz', 'Horloge pour la console et les convertisseurs audio.') },
    { id: 'ltc1', k: 'xlr', x: 650, y: 130, l: 'LTC 1', meta: M('LTC 1', 'XLR / bornier', 'ref', 'out', 'SMPTE ST 12-1', 'Timecode heure du jour.') },
    { id: 'ltc2', k: 'xlr', x: 715, y: 130, l: 'LTC 2', meta: M('LTC 2', 'XLR / bornier', 'ref', 'out', 'LTC', 'Timecode.') },
    { id: 'gps', k: 'sma', x: 780, y: 130, l: 'GPS', meta: M('GPS', 'SMA', 'rf', 'in', 'Antenne GPS active', 'Asservissement sur le temps GPS : tous les cars et la chaîne sont à la même heure.') },
    { id: 'ptp1', k: 'sfp', x: 840, y: 130, l: 'PTP 1', meta: M('PTP 1', 'SFP / RJ-45', 'ip', 'out', 'IEEE 1588, SMPTE ST 2059-2', 'Grand maître PTP pour les équipements IP (ST 2110).') },
    { id: 'psu1', k: 'iec', x: 930, y: 100, l: 'PSU 1', meta: M('Alimentation 1', 'IEC', 'power', 'in', '', 'Alimentation redondante.') },
    { id: 'psu2', k: 'iec', x: 930, y: 175, l: 'PSU 2', meta: M('Alimentation 2', 'IEC', 'power', 'in', '', 'Alimentation redondante.') },
  ],
  specs: [['Sorties', 'Black burst, tri-level, mires SDI, word clock, LTC, PTP'], ['Asservissement', 'GPS, avec maintien (holdover) en cas de perte'], ['Sécurité', 'Doublé + inverseur automatique']],
});
DEV.da = rackGeneric('da', 'Distributeur de référence (DA)', 'Un amplificateur de distribution recopie la référence vers de nombreux appareils (ici les CCU).', {
  w: 1000, h: 220, label: 'DISTRIBUTEUR · face arrière',
  ports: [{ id: 'in', k: 'bnc', x: 70, y: 120, l: 'IN', meta: M('IN', BNC, 'ref', 'in', REF_STD, 'Entrée de la référence venant du SPG.') }],
  groups: [{ l: 'Sorties', prefix: 'out', from: 1, count: 8, cols: 8, rows: 1, x: 200, y: 140, dx: 60, dy: 60, k: 'bnc', conn: BNC, s: 'ref', d: 'out', std: REF_STD, name: (i) => `OUT ${i}`, desc: () => 'Sortie de référence.' }],
});
DEV.pdc = rackGeneric('pdc', 'Pied de car (panneau de raccordement extérieur)', 'Toutes les liaisons extérieures arrivent ici : caméras, fibres, coax, audio, intercom, transmissions, énergie. En interne, chaque embase est câblée vers la baie technique.', {
  w: 1000, h: 640, label: 'PIED DE CAR · panneau extérieur', viewLabel: 'Panneau extérieur',
  groups: [
    { l: 'SMPTE (fibre hybride) 1 à 16', prefix: 'smpte', from: 1, count: 16, cols: 8, rows: 2, x: 70, y: 110, dx: 74, dy: 74, k: 'lemo', conn: 'LEMO 3K.93C femelle', s: 'fiber', d: 'io', std: 'SMPTE ST 311', name: (i) => `SMPTE ${i}`, desc: (i) => `Embase caméra ${i} : reçoit le câble hybride tiré depuis la position caméra.` },
    { l: 'Fibres monomodes 1 à 16', prefix: 'fib', from: 1, count: 16, cols: 16, rows: 1, x: 66, y: 320, dx: 52, dy: 60, k: 'optcon', conn: 'Neutrik opticalCON (LC duplex)', s: 'fiber', d: 'io', std: 'Fibre OS2', name: (i) => `FIBRE ${i}`, desc: () => 'Fibre tactique monomode : pré-câblage, convertisseurs, IP.' },
    { l: 'Coax 1 à 12', prefix: 'bnc', from: 1, count: 12, cols: 12, rows: 1, x: 66, y: 440, dx: 52, dy: 60, k: 'bnc', conn: BNC, s: 'video', d: 'io', std: SDI_STD, name: (i) => `BNC ${i}`, desc: () => 'Liaisons coaxiales courtes.' },
  ],
  ports: [
    { id: 'icom', k: 'xlr', x: 720, y: 440, l: '4 FILS', meta: M('INTERCOM 4 FILS', 'XLR', 'comms', 'io', '4 fils', 'Ordres vers la chaîne, les commentateurs.') },
    { id: 'txfib', k: 'optcon', x: 790, y: 440, l: 'TX FIB', meta: M('FIBRE TX', 'opticalCON', 'ip', 'out', '', 'Départ vers l\'opérateur de transmission.') },
    { id: 'gps', k: 'sma', x: 850, y: 440, l: 'GPS', meta: M('ANTENNE GPS', 'SMA', 'rf', 'in', '', 'Antenne GPS du générateur de synchro.') },
    { id: 'power', k: 'p17', x: 820, y: 560, l: 'P17 63A', meta: M('ÉNERGIE', 'CEE 63 A triphasé (P17)', 'power', 'in', '400 V tri + N + T', 'Arrivée du groupe électrogène ou du réseau du stade. On raccorde la terre en premier.') },
    { id: 'earth', k: 'stud', x: 930, y: 560, l: 'TERRE', meta: M('TERRE', 'Borne', 'power', 'in', '', 'Piquet de terre / liaison équipotentielle. Toujours raccordée avant l\'énergie.') },
  ],
});
DEV.rx = rackGeneric('rx', 'Récepteur HF en diversité', 'Reçoit les émetteurs COFDM des caméras HF par plusieurs antennes combinées (diversité), démodule et décode l\'image (HEVC/H.264), puis la sort en SDI vers la grille.', {
  w: 1000, h: 260, label: 'RÉCEPTEUR HF · face arrière',
  ports: [
    ...[1, 2, 3, 4, 5, 6].map((i) => ({ id: 'ant' + i, k: 'sma', x: 50 + (i - 1) * 50, y: 130, l: 'ANT ' + i, meta: M('ANTENNE ' + i, 'SMA / N', 'rf', 'in', 'RF 2 GHz (via RF sur fibre)', 'Entrée d\'antenne pour la diversité.') })),
    ...[...Array(8).keys()].map((i) => ({ id: 'sdi' + (i + 1), k: 'bnc', x: 380 + i * 54, y: 130, l: 'SDI ' + (i + 1), meta: M('SDI OUT ' + (i + 1), BNC, 'video', 'out', SDI_STD, 'Image décodée d\'une caméra HF.') })),
    { id: 'ref', k: 'bnc', x: 860, y: 130, l: 'REF', meta: M('REF IN', BNC, 'ref', 'in', REF_STD, 'Le décodeur resynchronise l\'image sur la référence du car.') },
    { id: 'retout', k: 'bnc', x: 920, y: 130, l: 'RET', meta: M('SORTIE RETOUR', BNC, 'video', 'out', '', 'Récepteur du retour antenne.') },
  ],
});
DEV.audio = rackGeneric('audio', 'Console son · cœur et E/S (inspiration Studer Vista 1)', 'Face arrière simplifiée du cœur de la console : entrées micro/ligne avec préamplis et 48 V, sorties ligne, AES, et logements de cartes d\'extension D21m (MADI, SDI, réseau audio). Simulation pédagogique non officielle : nombres et emplacements donnés en ordre de grandeur, ils varient selon la version et les options.', {
  w: 1100, h: 520, label: 'CONSOLE SON · face arrière du cœur (simplifiée)',
  groups: [
    { l: 'Entrées micro / ligne 1-32 (préamplis, 48 V)', prefix: 'mic', from: 1, count: 32, cols: 16, rows: 2, x: 66, y: 110, dx: 46, dy: 56, k: 'xlr', conn: 'XLR 3 broches femelle', s: 'audio', d: 'in', std: 'Micro ou ligne symétrique, alimentation fantôme 48 V commutable', name: (i) => `MIC/LINE IN ${i}`, desc: (i) => (i <= 2 ? 'Couple ORTF de la tribune principale (ambiance).' : i <= 4 ? 'Couple XY du kop (ambiance).' : i <= 10 ? `Canon ${i - 4} au bord du terrain (micro statique : 48 V obligatoire).` : i === 11 ? 'Récepteur HF du micro de la journaliste bord terrain (niveau ligne : pas de 48 V).' : 'Entrée libre (patch à l\'écran).') },
    { l: 'Sorties ligne 1-16', prefix: 'out', from: 1, count: 16, cols: 16, rows: 1, x: 66, y: 280, dx: 46, dy: 56, k: 'xlr', conn: 'XLR 3 broches mâle', s: 'audio', d: 'out', std: 'Ligne symétrique ; alignement EBU R68 : −18 dBFS = 0 dBu (0 dBFS = +18 dBu)', name: (i) => `LINE OUT ${i}`, desc: (i) => (i <= 2 ? 'PGM analogique (secours de la transmission).' : i <= 4 ? 'International analogique.' : i <= 6 ? 'N-1 STUDIO vers le codec 4 fils de la transmission.' : i === 7 ? 'N-1 BORD TERRAIN vers l\'émetteur IFB.' : 'Sortie libre.') },
  ],
  ports: [
    { id: 'aesin', k: 'dsub25', x: 110, y: 400, l: 'AES IN 1-8', meta: M('AES/EBU IN 1-8', 'D-sub 25', 'audio', 'in', 'AES3, 8 paires', 'EVS PGM1 et PGM2, retour studio du décodeur, lecteur de jingles.') },
    { id: 'aesout', k: 'dsub25', x: 210, y: 400, l: 'AES OUT 1-8', meta: M('AES/EBU OUT 1-8', 'D-sub 25', 'audio', 'out', 'AES3, 8 paires', 'Vers les embedders du départ (PGM, international).') },
    { id: 'madi1', k: 'bnc', x: 330, y: 400, l: 'MADI 1', meta: M('CARTE D21m MADI · IN/OUT 1', BNC + ' ou fibre SC', 'audio', 'io', 'AES10, 64 canaux à 48 kHz', 'Unité de commentaire (micros des commentateurs et retours N-1), ou stagebox.') },
    { id: 'madi2', k: 'bnc', x: 390, y: 400, l: 'MADI 2', meta: M('CARTE D21m MADI · IN/OUT 2', BNC + ' ou fibre SC', 'audio', 'io', 'AES10, 64 canaux', 'Liaison redondante ou seconde stagebox.') },
    { id: 'sdi1', k: 'bnc', x: 470, y: 400, l: 'SDI IN 1', meta: M('CARTE D21m SDI · IN 1', BNC, 'video', 'in', 'HD/3G-SDI, désembedding de 16 canaux', 'Signal de la caméra HF après le récepteur : on en extrait le son du micro caméra.') },
    { id: 'sdi2', k: 'bnc', x: 530, y: 400, l: 'SDI IN 2', meta: M('CARTE D21m SDI · IN 2', BNC, 'video', 'in', 'HD/3G-SDI', 'Deuxième entrée de désembedding.') },
    { id: 'aoip1', k: 'rj45', x: 620, y: 400, l: 'AoIP A', meta: M('CARTE RÉSEAU AUDIO · A', 'RJ45 / SFP', 'ip', 'io', 'AES67 / ST 2110-30, PTP', 'Car IP : flux audio du réseau rouge (sources du stade, unité de commentaire).') },
    { id: 'aoip2', k: 'rj45', x: 680, y: 400, l: 'AoIP B', meta: M('CARTE RÉSEAU AUDIO · B', 'RJ45 / SFP', 'ip', 'io', 'AES67 / ST 2110-30, PTP', 'Réseau bleu : redondance ST 2022-7.') },
    { id: 'wclk', k: 'bnc', x: 770, y: 400, l: 'WCLK', meta: M('WORD CLOCK IN', BNC, 'ref', 'in', '48 kHz (ou référence vidéo)', 'Horloge audio du car, issue du générateur de synchro : toute la chaîne audio est verrouillée dessus.') },
    { id: 'gpio', k: 'dsub25', x: 860, y: 400, l: 'GPIO', meta: M('GPIO', 'D-sub 25', 'data', 'io', 'Contacts secs', 'Lampes rouges des cabines (micro ouvert), tally du mélangeur pour l\'AFV, fader start des lecteurs.') },
    { id: 'net', k: 'rj45', x: 950, y: 400, l: 'CTRL', meta: M('ETHERNET CONTRÔLE', 'RJ45', 'ip', 'io', '1 GbE', 'Liaison entre la surface de contrôle et le cœur DSP, télécommande, sauvegarde des snapshots.') },
    { id: 'psu1', k: 'iec', x: 1030, y: 380, l: 'PSU 1', meta: M('ALIMENTATION 1', 'IEC C14', 'power', 'in', '230 V', 'Alimentation principale.') },
    { id: 'psu2', k: 'iec', x: 1030, y: 450, l: 'PSU 2', meta: M('ALIMENTATION 2', 'IEC C14', 'power', 'in', '230 V', 'Alimentation redondante, sur un autre départ de l\'onduleur.') },
  ],
  specs: [['Surface (inspiration)', 'Version 22 faders (≈ 1 m de large) ou 32 faders ; une ou deux baies de 10 faders (un écran Vistonics chacune) et la Control Bay (10 faders + 2 « grand masters », son écran Vistonics, écoutes, talkback)'], ['Traitement', 'DSP intégré annoncé à 96 canaux (mono, stéréo, 5.1)'], ['E/S', 'Micro/ligne, ligne, AES intégrées ; cartes D21m : MADI, AES, SDI, analogique, AoIP'], ['Broadcast', 'N-x (mix-minus), talkback, GPIO, snapshots, automation'], ['Dans ce car', '17 tranches utilisées (couche A), masters et VCA en couche B']],
  lesson: ['Le patch relie chaque connecteur à une tranche : il se fait à l\'écran de la console.', 'Les micros statiques (ambiances, canons) ont besoin du 48 V ; une source ligne non.', 'La console est verrouillée sur la word clock du car : sans elle, clics et glissements.'],
});
DEV.conv = rackGeneric('conv', 'Convertisseur SDI / fibre', 'Petit boîtier qui transporte un signal SDI sur fibre monomode (plusieurs km), utilisé pour les mini-caméras, le pré-câblage, les sources lointaines.', {
  w: 600, h: 220, label: 'CONVERTISSEUR · faces', ports: [
    { id: 'sdi', k: 'bnc', x: 90, y: 120, l: 'SDI', meta: M('SDI', BNC, 'video', 'io', SDI_STD, 'Côté caméra.') },
    { id: 'cam', k: 'lemo', x: 220, y: 120, l: 'CAMÉRA', meta: M('CÔTÉ CAMÉRA', 'Hybride court', 'fiber', 'io', '', 'Adaptateur SMPTE / monomode.') },
    { id: 'line', k: 'optcon', x: 360, y: 120, l: 'FIBRE', meta: M('LIGNE FIBRE', 'LC / opticalCON', 'fiber', 'io', 'Fibre OS2', 'Vers le pied de car.') },
    { id: 'pwr', k: 'xlr', x: 480, y: 120, l: 'DC', meta: M('ALIMENTATION', 'XLR 4', 'power', 'in', '12 V', 'Alimentation locale.') },
  ],
});

const LINKMAP = { audio: 'audio', cam: 'cam', ccu: 'ccu', rcp: 'rcp', evs: 'evs', lsm: 'lsm', router: 'router', mixer: 'mixer', mixpanel: 'mixpanel', siu: 'siu', ipd: 'ipd', mv: 'mv', spg: 'spg', da: 'da', pdc: 'pdc', rx: 'rx', conv: 'conv' };
export const DEVICES = DEV;
export function deviceDef(key) { return DEV[LINKMAP[key] || key]; }
export const DEVICE_LIST = [
  ['cam', 'Caméra système (tête)'], ['ccu', 'CCU (voie caméra)'], ['rcp', 'RCP (pupitre vision)'], ['evs', 'Serveur ralenti EVS XT4K'], ['lsm', 'Télécommande LSM'], ['ipd', 'Poste IPDirector'],
  ['router', 'Grille'], ['mixer', 'Mélangeur XVS-6000 (processeur)'], ['mixpanel', 'Pupitre ICP-X7000'], ['siu', 'Interface MKS-X7700 (tally)'], ['mv', 'Multiviewer'], ['spg', 'Générateur de synchro'], ['da', 'Distributeur de référence'], ['rx', 'Récepteur HF'], ['conv', 'Convertisseur fibre'], ['audio', 'Console son (cœur et E/S)'], ['pdc', 'Pied de car'],
];
