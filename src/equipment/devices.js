// ----------------------------------------------------------------------------------
// Base de données du matériel : faces avant/arrière (disposition schématique),
// connecteurs et commandes avec leur rôle, signal et norme.
// Sources : fiches techniques Sony HDC-5500 / HDCU-5500 / HDCU-5000 / RCP-3500,
// fiche technique EVS XT-VIA (déc. 2022), pages produit EVS LSM-VIA, manuels EVS XT3 (génération précédente).
// Les positions sont indicatives : seul l'inventaire des connecteurs suit la documentation.
// ----------------------------------------------------------------------------------

const SDI_STD = '12G-SDI (SMPTE ST 2082-1), 3G-SDI (ST 424), HD-SDI (ST 292-1) selon le format';
const REF_STD = 'Tri-level HD (SMPTE ST 274/296) ou black burst SD (ST 318, 625 lignes / 50 Hz)';
const M = (n, c, s, d, std, desc) => ({ n, c, s, d, std, desc });
const BNC = 'BNC 75 Ω';

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
  const back = [];
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
  const front = [
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
  ];
  const rear = [
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
  ];
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
  const top = [
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
  ];
  const rear = [
    { t: 'body', x: 10, y: 10, w: 320, h: 180, r: 8 },
    { t: 'text', x: 24, y: 34, s: 'Face arrière RCP', size: 13, w: 600 },
    { t: 'port', id: 'ccu', k: 'multi', x: 60, y: 110, l: 'CCU/CNU' },
    { t: 'port', id: 'lan', k: 'rj45', x: 135, y: 110, l: 'LAN (PoE)' },
    { t: 'port', id: 'aux', k: 'multi', x: 210, y: 110, l: 'AUX' },
    { t: 'port', id: 'extio', k: 'dsub9', x: 285, y: 110, l: 'EXT I/O' },
  ];
  return {
    key: 'rcp', title: 'RCP — pupitre de réglage caméra (type Sony RCP-3500)', multi: true,
    intro: 'Le RCP (Remote Control Panel) est le pupitre d\'une caméra pour l\'ingénieur vision. Successeur du RCP-1500 (même encombrement) : touches d\'accès direct, écran tactile, bloc joystick iris / master black, 9 touches assignables. Il se branche sur la CCU (câble CCA-5) ou sur le réseau caméras (PoE).',
    views: { dessus: { label: 'Dessus (commandes)', w: 340, h: 1000, items: top }, arriere: { label: 'Face arrière', w: 340, h: 200, items: rear } },
    ports: P, controls: C,
    specs: [['Dimensions', '102 × 310 × 67 mm, ≈ 1,7 kg'], ['Consommation', '10 W'], ['Réseau', 'RJ-45 1000BASE-T, alimentation PoE IEEE 802.3af classe 2'], ['Liaison CCU', 'CCU/CNU 8 broches (câble CCA-5)'], ['Autres connecteurs', 'AUX 8 broches, EXT I/O D-sub 9 (DC 10,5 à 17 V)'], ['Commandes', 'Joystick iris / master black, écran tactile, 9 touches assignables'], ['Montage', 'Jusqu\'à 4 RCP par rack 19"']],
    lesson: ['La main reste sur le joystick : on « ride » l\'iris en suivant l\'action (soleil / ombre).', 'On ne touche aux potentiomètres de couleur qu\'en regardant le vecteurscope et le moniteur de référence, jamais un écran grand public.', 'Si le RCP ne répond pas : PANEL ACTIVE est peut-être éteint.'],
  };
}

// ---------------------------------------------------------------- EVS
function evsDevice() {
  const P = {};
  for (let i = 1; i <= 12; i++) P['sdi' + i] = M(`SDI ${i}`, BNC, 'video', 'io', '1,5G / 3G / 12G-SDI, choisi dans la configuration logicielle', 'Connecteur SDI configurable en entrée (enregistrement) ou en sortie (lecture, multiviewer). Dans ce car : SDI 1 à 8 = entrées REC, SDI 9 = PGM1 (EVS A), SDI 10 = PGM2 (EVS B), SDI 11 = multiviewer interne.');
  Object.assign(P, {
    ip1: M('IP 1', 'SFP+ 10GbE', 'ip', 'io', 'SMPTE ST 2110 / ST 2022-6, PTP, NMOS IS-04/IS-05', 'Entrées/sorties vidéo sur IP (installation ST 2110).'),
    ip2: M('IP 2', 'SFP+ 10GbE', 'ip', 'io', 'ST 2022-7 (redondance)', 'Second port IP (chemin redondant).'),
    xnet1: M('XNet-VIA 1', 'SFP+ 10GbE', 'ip', 'io', 'Réseau XNet-VIA 10 Gb/s', 'Partage des médias entre serveurs : un opérateur peut relire les enregistrements d\'un autre serveur.'),
    xnet2: M('XNet-VIA 2', 'SFP+ 10GbE', 'ip', 'io', 'XNet-VIA', 'Second lien réseau média.'),
    mgmt1: M('LAN gestion 1', 'RJ-45', 'ip', 'io', '1 GbE', 'Réseau de gestion et de commande (LSM-VIA, IPDirector). Doublé pour la redondance.'),
    mgmt2: M('LAN gestion 2', 'RJ-45', 'ip', 'io', '1 GbE', 'Réseau de gestion redondant.'),
    refin: M('REF IN', BNC, 'ref', 'in', REF_STD, 'Référence de synchro (genlock) : black burst ou tri-level, choisi dans la configuration.'),
    refloop: M('REF LOOP', BNC, 'ref', 'out', REF_STD, 'Boucle de la référence.'),
    ltcin: M('LTC IN', 'XLR 3 broches', 'ref', 'in', 'SMPTE ST 12-1 (LTC)', 'Timecode heure du jour venant du SPG : toutes les caméras enregistrées partagent le même timecode, d\'où le multicam synchronisé.'),
    ltcout: M('LTC OUT', 'XLR 3 broches', 'ref', 'out', 'LTC', 'Sortie timecode.'),
    gpi: M('GPI', 'D-sub 25', 'data', 'io', 'Entrées opto-isolées et TTL (manuels XT3)', 'Déclenchements par contacts (ex. tally, démarrage d\'une lecture par le mélangeur).'),
    rs1: M('RS-422 1', 'D-sub 9', 'data', 'io', 'Protocoles série (Sony BVW, VDCP, Odetics…)', 'Héritage : télécommandes série et automatismes tiers. Le LSM-VIA passe par IP.'),
    rs2: M('RS-422 2', 'D-sub 9', 'data', 'io', 'Série', 'Port série.'), rs3: M('RS-422 3', 'D-sub 9', 'data', 'io', 'Série', 'Port série.'), rs4: M('RS-422 4', 'D-sub 9', 'data', 'io', 'Série', 'Port série.'),
    aes: M('AES', 'D-sub 25', 'audio', 'io', 'AES3', 'Audio numérique AES (paires stéréo).'),
    madiin: M('MADI IN', BNC, 'audio', 'in', 'AES10 (64 canaux)', 'Audio multicanal à enregistrer avec les images.'),
    madiout: M('MADI OUT', BNC, 'audio', 'out', 'AES10', 'Audio multicanal des sorties de lecture.'),
    usb: M('USB', 'USB', 'data', 'io', '', 'Maintenance, export.'), disp: M('Écran', 'DisplayPort', 'video', 'out', '', 'Console locale de configuration.'),
    psu1: M('Alimentation 1', 'IEC', 'power', 'in', '100 à 240 V', 'Alimentations redondantes : on les branche sur deux circuits différents.'),
    psu2: M('Alimentation 2', 'IEC', 'power', 'in', '100 à 240 V', 'Seconde alimentation (redondance).'),
  });
  const C = {
    disks: M('Disques (RAID)', 'Tiroirs', 'data', '', '', 'Stockage en RAID : la perte d\'un disque n\'interrompt pas l\'enregistrement.'),
    leds: M('Voyants d\'état', 'LED', 'data', '', '', 'Alimentation, disques, réseau, enregistrement.'),
  };
  const front = [{ t: 'body', x: 10, y: 10, w: 980, h: 500, r: 8 }, { t: 'text', x: 40, y: 60, s: 'SERVEUR DE PRODUCTION (type EVS XT-VIA)', size: 20, w: 700 }];
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) front.push({ t: 'disk', id: 'disks', x: 320 + c * 105, y: 120 + r * 170, w: 92, h: 150 });
  ['POWER', 'DISK', 'NET', 'REC', 'ALARM'].forEach((l, i) => front.push({ t: 'led', id: 'leds', x: 70, y: 140 + i * 50, c: i === 4 ? 'red' : i === 3 ? 'tally' : 'green', l }));
  const rear = [{ t: 'body', x: 10, y: 10, w: 980, h: 500, r: 8 }];
  rear.push({ t: 'group', x: 30, y: 36, w: 390, h: 200, l: 'Carte codec A' }, { t: 'group', x: 30, y: 270, w: 390, h: 200, l: 'Carte codec B' });
  for (let i = 0; i < 6; i++) { rear.push({ t: 'port', id: 'sdi' + (i + 1), k: 'bnc', x: 75 + i * 62, y: 120, l: 'SDI ' + (i + 1) }); rear.push({ t: 'port', id: 'sdi' + (i + 7), k: 'bnc', x: 75 + i * 62, y: 355, l: 'SDI ' + (i + 7) }); }
  rear.push({ t: 'group', x: 440, y: 36, w: 370, h: 100, l: 'IP et réseau média' });
  row(rear, ['ip1', 'ip2', 'xnet1', 'xnet2'], 485, 92, 85, 'sfp', ['IP 1', 'IP 2', 'XNET-VIA 1', 'XNET-VIA 2']);
  rear.push({ t: 'group', x: 440, y: 148, w: 370, h: 100, l: 'Synchronisation et timecode' });
  rear.push({ t: 'port', id: 'refin', k: 'bnc', x: 480, y: 200, l: 'REF IN' }, { t: 'port', id: 'refloop', k: 'bnc', x: 535, y: 200, l: 'REF LOOP' }, { t: 'port', id: 'ltcin', k: 'xlr', x: 610, y: 200, l: 'LTC IN' }, { t: 'port', id: 'ltcout', k: 'xlr', x: 680, y: 200, l: 'LTC OUT' }, { t: 'port', id: 'gpi', k: 'dsub25', x: 760, y: 200, l: 'GPI' });
  rear.push({ t: 'group', x: 440, y: 260, w: 370, h: 100, l: 'Commande' });
  rear.push({ t: 'port', id: 'mgmt1', k: 'rj45', x: 478, y: 312, l: 'LAN 1' }, { t: 'port', id: 'mgmt2', k: 'rj45', x: 530, y: 312, l: 'LAN 2' });
  row(rear, ['rs1', 'rs2', 'rs3', 'rs4'], 600, 312, 58, 'dsub9', ['RS422 1', 'RS422 2', 'RS422 3', 'RS422 4']);
  rear.push({ t: 'group', x: 440, y: 372, w: 370, h: 100, l: 'Audio et console' });
  rear.push({ t: 'port', id: 'aes', k: 'dsub25', x: 490, y: 424, l: 'AES' }, { t: 'port', id: 'madiin', k: 'bnc', x: 570, y: 424, l: 'MADI IN' }, { t: 'port', id: 'madiout', k: 'bnc', x: 630, y: 424, l: 'MADI OUT' }, { t: 'port', id: 'usb', k: 'usb', x: 700, y: 424, l: 'USB' }, { t: 'port', id: 'disp', k: 'usb', x: 760, y: 424, l: 'DP' });
  rear.push({ t: 'psu', id: 'psu1', x: 830, y: 36, w: 140, h: 200, l: 'PSU 1' }, { t: 'psu', id: 'psu2', x: 830, y: 270, w: 140, h: 200, l: 'PSU 2' });
  return {
    key: 'evs', title: 'Serveur ralenti (type EVS XT-VIA)', multi: false,
    intro: 'Serveur de production « live » : il enregistre en boucle plusieurs flux caméras (les « trains » d\'enregistrement) et, en même temps, relit n\'importe quel moment sur ses sorties de lecture (PGM1, PGM2), à n\'importe quelle vitesse. Toutes les entrées partagent le timecode : l\'opérateur peut passer d\'un angle à l\'autre sur la même action (multicam).',
    views: { arriere: { label: 'Face arrière', w: 1000, h: 520, items: rear }, avant: { label: 'Face avant', w: 1000, h: 520, items: front } },
    ports: P, controls: C,
    specs: [['Canaux', '12 canaux FHD/HD (720p, 1080i, 1080p) ; 6 canaux UHD-4K (avec conversion du 1080p) ; 2 canaux UHD-8K (édition spéciale) ; 6 canaux fill/key'], ['Super Motion (option)', 'HD/FHD de 2x à 16x, UHD-4K de 2x à 4x'], ['Vidéo', '1,5G / 3G / 12G-SDI, choisi dans la configuration logicielle'], ['IP', '10GbE SFP+ : ST 2022-6, ST 2110, PTP, NMOS IS-04/IS-05'], ['Réseau média', 'XNet-VIA (10 Gb/s Ethernet)'], ['Gestion', 'Réseaux 1G redondants'], ['Audio', 'Embeddé, AES, MADI'], ['Pilotage', 'LSM-VIA (IP), LSM RCU, IPDirector'], ['Configuration dans ce car', '8 entrées REC + 2 lectures (PGM1, PGM2) + 1 multiviewer']],
    lesson: ['Une caméra super ralenti 3x arrive sur 3 connecteurs SDI (une phase par connecteur) : elle consomme 3 canaux d\'enregistrement.', 'Les alimentations sont doublées : branchez-les sur deux circuits différents de l\'onduleur.', 'Le genlock et le LTC doivent venir du même SPG que le reste du car.', 'Certaines connectiques (GPI, RS-422) sont décrites d\'après la génération précédente (XT3) : vérifiez la configuration exacte de votre serveur.'],
  };
}

// ---------------------------------------------------------------- LSM
function lsmDevice() {
  const P = {
    lan: M('LAN', 'RJ-45', 'ip', 'io', 'Ethernet', 'Pilotage du serveur en IP : plus de brassage RS-422 comme sur les anciennes télécommandes.'),
    dcin: M('DC IN', 'Connecteur d\'alimentation', 'power', 'in', '', 'Alimentation de la télécommande.'),
    usb: M('USB', 'USB', 'data', 'io', '', 'Clé de configuration, maintenance.'),
  };
  const C = {
    screen: M('Écran tactile', 'Écran tactile rabattable', 'data', '', '', 'Écran tactile réglable en hauteur, dispositions configurables : barre d\'application (page, banque, emplacement des clips, serveur d\'enregistrement, canal PGM piloté), clips, playlists, trains.'),
    fkeys: M('Touches F1 à F10', 'Boutons multicolores avec OLED', 'data', '', '', 'Appel ou sauvegarde des clips de la banque en cours. Chaque touche a un petit écran OLED qui affiche sa fonction du moment.'),
    camkeys: M('Touches caméras A à F', 'Boutons', 'video', '', '', 'Choix de l\'angle (entrée enregistrée) sur la sortie pilotée. On change d\'angle en gardant le même timecode.'),
    transport: M('Touches de transport', 'Boutons', 'data', '', '', 'MARK IN / MARK OUT, GOTO IN / OUT, PLAY, LIVE (E/E), RETURN, PLST (playlist).'),
    shortcuts: M('Raccourcis programmables', 'Boutons', 'data', '', '', 'Fonctions affectables : Fast jog, Trains, Back to Local, PGM Speed, Var Max, Second Lever Range, Loop…'),
    lever: M('Levier (T-bar)', 'Levier', 'data', '', '', 'Vitesse de lecture de 0 à 100 % (ou jusqu\'à la valeur « Var Max »). Un ralenti se joue en général entre 25 et 50 % ; 33 % pour une caméra 3x.'),
    jog: M('Jog', 'Molette', 'data', '', '', 'Déplacement image par image pour trouver exactement le point d\'entrée. Le Fast Jog parcourt les médias de 2x à 20x plus vite.'),
  };
  const top = [{ t: 'body', x: 10, y: 10, w: 960, h: 500, r: 16 }, { t: 'screen', id: 'screen', x: 40, y: 30, w: 620, h: 200 }];
  for (let i = 0; i < 10; i++) top.push({ t: 'btn', id: 'fkeys', x: 40 + i * 62, y: 255, w: 56, h: 40, l: 'F' + (i + 1), oled: true });
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach((l, i) => top.push({ t: 'btn', id: 'camkeys', x: 40 + i * 62, y: 305, w: 56, h: 40, l: 'CAM ' + l, oled: true, c: 'cyan' }));
  ['PAGE', 'BANK', 'SHIFT', 'MENU'].forEach((l, i) => top.push({ t: 'btn', id: 'transport', x: 412 + i * 62, y: 305, w: 56, h: 40, l, oled: true }));
  ['MARK IN', 'MARK OUT', 'GOTO IN', 'GOTO OUT', 'PLST', 'RETURN', 'LIVE E/E', 'PLAY', 'PGM/PRV', 'LOOP'].forEach((l, i) => top.push({ t: 'btn', id: 'transport', x: 40 + i * 62, y: 355, w: 56, h: 40, l, oled: true, c: l === 'PLAY' ? 'green' : l.startsWith('MARK') ? 'amber' : null }));
  ['FAST JOG', 'TRAINS', 'VAR MAX', 'LEVER 2', 'PGM SPD', 'LOCAL'].forEach((l, i) => top.push({ t: 'btn', id: 'shortcuts', x: 40 + i * 62, y: 410, w: 56, h: 36, l, oled: true, c: 'violet' }));
  top.push({ t: 'lever', id: 'lever', x: 700, y: 40, w: 60, h: 300 });
  top.push({ t: 'jog', id: 'jog', x: 860, y: 380, r: 88 });
  const rear = [{ t: 'body', x: 10, y: 10, w: 960, h: 140, r: 10 }, { t: 'port', id: 'lan', k: 'rj45', x: 100, y: 80, l: 'LAN' }, { t: 'port', id: 'dcin', k: 'xlr', x: 200, y: 80, l: 'DC IN' }, { t: 'port', id: 'usb', k: 'usb', x: 300, y: 80, l: 'USB' }];
  return {
    key: 'lsm', title: 'Télécommande de ralentis (type EVS LSM-VIA)', multi: true,
    intro: 'La télécommande de l\'opérateur ralenti : écran tactile rabattable, touches multicolores à OLED de contexte, raccourcis programmables, molette jog et levier de vitesse « qualité EVS ». Elle pilote le serveur en IP.',
    views: { dessus: { label: 'Dessus (commandes)', w: 980, h: 520, items: top }, arriere: { label: 'Arrière', w: 980, h: 160, items: rear } },
    ports: P, controls: C,
    specs: [['Liaison', 'IP vers le serveur (XT-VIA, XS-VIA, XT-GO)'], ['Commandes', 'Jog, levier, touches multicolores avec OLED, raccourcis programmables'], ['Écran', 'Tactile, rabattable, dispositions configurables'], ['Fast jog', '2x à 20x (réglable)']],
    lesson: ['Méthode : sortie en LIVE pendant le jeu ; après l\'action, retour en arrière au jog, MARK IN, choix de l\'angle, puis lecture au levier quand le réalisateur envoie l\'EVS.', 'Le timecode partagé permet de passer de la caméra A à la caméra C sur la même image.'],
  };
}

// ---------------------------------------------------------------- appareils de baie (génériques)
function rackGeneric(key, title, intro, opts) {
  const P = {}; const items = [{ t: 'body', x: 10, y: 10, w: opts.w - 20, h: opts.h - 20, r: 6 }];
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
DEV.mixer = rackGeneric('mixer', 'Mélangeur — châssis de traitement', 'Le pupitre du truquiste n\'est qu\'une télécommande : le traitement est fait dans ce châssis, en baie. Il reçoit ses entrées de la grille et renvoie PGM, clean feed, preview et AUX.', {
  w: 1000, h: 460, label: 'MÉLANGEUR · châssis, face arrière',
  groups: [
    { l: 'Entrées 1 à 24', prefix: 'in', from: 1, count: 24, cols: 12, rows: 2, x: 66, y: 100, dx: 58, dy: 62, k: 'bnc', conn: BNC, s: 'video', d: 'in', std: SDI_STD, name: (i) => `IN ${i}`, desc: () => 'Entrée du mélangeur (bus de sources).' },
    { l: 'Sorties', prefix: 'out', from: 1, count: 8, cols: 8, rows: 1, x: 66, y: 290, dx: 58, dy: 62, k: 'bnc', conn: BNC, s: 'video', d: 'out', std: SDI_STD, name: (i) => ['PGM', 'CLEAN', 'PVW', 'AUX 1', 'AUX 2', 'AUX 3', 'AUX 4', 'ME1 PVW'][i - 1], short: (i) => ['PGM', 'CLN', 'PVW', 'AUX1', 'AUX2', 'AUX3', 'AUX4', 'ME PV'][i - 1], desc: (i) => ['Programme avec habillage (DSK).', 'Programme sans DSK (clean feed) pour les diffuseurs étrangers.', 'Preview : ce qui passera à la prochaine transition.', 'Sortie auxiliaire.', 'Sortie auxiliaire.', 'Sortie auxiliaire.', 'Sortie auxiliaire.', 'Preview de l\'étage M/E.'][i - 1] },
  ],
  ports: [
    { id: 'dsk1f', k: 'bnc', x: 600, y: 290, l: 'DSK1 F', meta: M('DSK 1 FILL', BNC, 'video', 'in', SDI_STD, 'Remplissage du DSK 1 (score) venant du moteur graphique.') },
    { id: 'dsk1k', k: 'bnc', x: 655, y: 290, l: 'DSK1 K', meta: M('DSK 1 KEY', BNC, 'video', 'in', SDI_STD, 'Découpe du DSK 1.') },
    { id: 'ref', k: 'bnc', x: 760, y: 290, l: 'REF', meta: M('REF IN', BNC, 'ref', 'in', REF_STD, 'Référence (black burst ou tri-level). Toutes les entrées doivent être en phase avec elle.') },
    { id: 'tally', k: 'rj45', x: 840, y: 290, l: 'TALLY', meta: M('TALLY / GPI', 'RJ-45 / D-sub', 'comms', 'out', 'GPI ou IP (TSL UMD)', 'Le mélangeur sait ce qui est à l\'antenne : il envoie le tally aux CCU, au multiview, aux serveurs.') },
    { id: 'panel', k: 'rj45', x: 900, y: 290, l: 'PANEL', meta: M('LAN pupitre', 'RJ-45', 'ip', 'io', '', 'Liaison avec le pupitre du truquiste.') },
  ],
  specs: [['Architecture', 'Pupitre (commande) + châssis (traitement) reliés en réseau'], ['Étages', '1 à 5 M/E selon la taille, keyers, DVE, DSK, mémoires d\'effets'], ['Entrées', 'Une entrée par source, verrouillée sur la référence']],
});
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
DEV.conv = rackGeneric('conv', 'Convertisseur SDI / fibre', 'Petit boîtier qui transporte un signal SDI sur fibre monomode (plusieurs km), utilisé pour les mini-caméras, le pré-câblage, les sources lointaines.', {
  w: 600, h: 220, label: 'CONVERTISSEUR · faces', ports: [
    { id: 'sdi', k: 'bnc', x: 90, y: 120, l: 'SDI', meta: M('SDI', BNC, 'video', 'io', SDI_STD, 'Côté caméra.') },
    { id: 'cam', k: 'lemo', x: 220, y: 120, l: 'CAMÉRA', meta: M('CÔTÉ CAMÉRA', 'Hybride court', 'fiber', 'io', '', 'Adaptateur SMPTE / monomode.') },
    { id: 'line', k: 'optcon', x: 360, y: 120, l: 'FIBRE', meta: M('LIGNE FIBRE', 'LC / opticalCON', 'fiber', 'io', 'Fibre OS2', 'Vers le pied de car.') },
    { id: 'pwr', k: 'xlr', x: 480, y: 120, l: 'DC', meta: M('ALIMENTATION', 'XLR 4', 'power', 'in', '12 V', 'Alimentation locale.') },
  ],
});

const LINKMAP = { cam: 'cam', ccu: 'ccu', rcp: 'rcp', evs: 'evs', lsm: 'lsm', router: 'router', mixer: 'mixer', mv: 'mv', spg: 'spg', da: 'da', pdc: 'pdc', rx: 'rx', conv: 'conv' };
export const DEVICES = DEV;
export function deviceDef(key) { return DEV[LINKMAP[key] || key]; }
export const DEVICE_LIST = [
  ['cam', 'Caméra système (tête)'], ['ccu', 'CCU (voie caméra)'], ['rcp', 'RCP (pupitre vision)'], ['evs', 'Serveur ralenti EVS'], ['lsm', 'Télécommande LSM'],
  ['router', 'Grille'], ['mixer', 'Mélangeur (châssis)'], ['mv', 'Multiviewer'], ['spg', 'Générateur de synchro'], ['da', 'Distributeur de référence'], ['rx', 'Récepteur HF'], ['conv', 'Convertisseur fibre'], ['pdc', 'Pied de car'],
];
