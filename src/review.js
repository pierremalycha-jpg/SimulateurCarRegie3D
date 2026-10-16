// ----------------------------------------------------------------------------------
// Points techniques à faire relire par le formateur (avec la source utilisée).
// Statut et remarques stockés dans config/review (partagé).
// ----------------------------------------------------------------------------------
const SONY_HDC = 'Fiches techniques Sony HDC-5500 (pro.sony, AV-iQ, Gravity Media)';
const SONY_CCU = 'Fiches techniques Sony HDCU-5500 / HDCU-5000 et manuel HDCU';
const SONY_RCP = 'Fiche technique Sony RCP-3500 et manuels RCP-1500/3100';
const EVS_XT4K = 'Presse de lancement EVS XT4K (SVG Europe, Panorama Audiovisual, live-production.tv) et fiche revendeur (Expandore)';
const EVS_XT = 'Manuels techniques EVS XT2 / XT3 / XTnano / XT4K (ManualsLib)';
const EVS_MC = 'Manuels EVS Multicam LSM 10.x à 12.x (ManualsLib, manualzz)';
const EVS_IPD = 'Page produit EVS IPDirector et articles SVG (2013-2015)';
const SONY_XVS = 'Brochures Sony XVS (pro.sony, Gravity Media, AV Broadcast), fiches revendeurs';
const SONY_ICP = 'Pages produit Sony ICP-X7000';
const NORMES = 'Normes et recommandations (SMPTE, ITU-R, EBU)';
const SIMU = 'Choix de simulation (à valider avec vos habitudes)';
const STUDER = 'Presse de lancement de la Studer Vista 1 (ProSoundWeb, SVC, Radio World, Fast and Wide) et pages Evertz Vista 1 / Vista V';
const FUJI = 'Pages Fujifilm « 4K Studio / Field » et « 4K Portable » (fujifilm.com), fiche Gravity Media UA107x8.4BESM';
const SONY_HDLA = 'Pages Sony HDLA-1505 / HDLA-1507 / HDLA-3505 et viseurs HDVF-L770 / HDVF-EL780 (pro.sony)';
const NET2110 = 'Normes SMPTE ST 2110-10/-20/-21/-30/-40, ST 2022-7, ST 2059-2, AMWA IS-04/IS-05, AES67, RFC 7104 (a=group:DUP), RFC 7938 ; guides des constructeurs de commutateurs';
const STADE = 'Recherches web : site du RC Lens (tribunes, billetterie), stadiumdb.com, architectes (Atelier Ferret), presse (France 3, 90min)';

export const REVIEW_ITEMS = [
  ['net9', 'Mesures ST 2110', 'Géométrie retenue : 1 200 octets de vidéo par paquet, 4 paquets par ligne en 1080p (4 320 par image, 216 000 par seconde), 8 par ligne en UHD.', NET2110],
  ['net10', 'Mesures ST 2110', 'ST 2110-21, émetteur étroit : CMAX = max(4, ⌊NPACKETS / (43 200 × RACTIVE × TFRAME)⌋), VRX_FULL = max(8, ⌊NPACKETS / (27 000 × TFRAME)⌋) ; TROFFSET ≈ 43 lignes (22 en entrelacé). Formules à vérifier dans la norme.', NET2110],
  ['net11', 'Mesures ST 2110', 'Valeurs de l\'analyseur (gigue, CINST, VRX, latences, offsets PTP, transitoire au changement de grand maître) : simulées à partir de la charge des liens, ordres de grandeur seulement.', SIMU],
  ['net12', 'Formation réseau', 'Barème : mission 10 points (−2 par indice, −5 si la configuration de référence est chargée) ; examen : 30 points par panne (20 + bonus de rapidité), −10 si la configuration n\'est pas enregistrée, −5 par alarme ajoutée.', SIMU],
  ['net1', 'Réseau ST 2110', 'Architecture : deux fabrics indépendantes (rouge / bleu), 2 spines 32 × 100 GbE et 6 leaves 48 × 25 GbE + 8 × 100 GbE par réseau, 2 × 100 GbE de chaque leaf vers chaque spine. À comparer au car réel (souvent moins de leaves dans un car).', SIMU],
  ['net2', 'Réseau ST 2110', 'Plan d\'adressage : VLAN 100 × réseau + leaf, 10.réseau.leaf.0/24, passerelle .1, loopbacks 10.0.x.y, /31 sur l\'underlay, groupes 239.réseau.leaf.n port 5004. Exemple pédagogique.', SIMU],
  ['net3', 'Réseau ST 2110', 'PTP ST 2059-2 : domaine 127, logAnnounceInterval −2, logSyncInterval −3, logMinDelayReqInterval −3, timeout Announce 3 ; grands maîtres priority1 100 / 110, clockClass 6 (GPS) et 7 (holdover).', NET2110],
  ['net4', 'Réseau ST 2110', 'Plan DSCP : PTP 46 (EF), audio 34 (AF41), vidéo 26 (AF31), données 18, contrôle 16. Les valeurs varient selon les intégrateurs.', NET2110],
  ['net5', 'Réseau ST 2110', 'Débits retenus (en-têtes compris) : 1080p50 ≈ 2,16 Gb/s, 1080i50 ≈ 1,08 Gb/s, 2160p50 ≈ 8,6 Gb/s, paire audio ≈ 2,8 Mb/s (paquets de 1 ms).', NET2110],
  ['net6', 'Réseau ST 2110', 'Raccordements : CCU (25 GbE, 100 GbE pour le super ralenti UHD) et XVS-6000 (2 × 100 GbE par réseau) en natif ST 2110, multiviewers en 100 GbE, XT4K, caméras HF, POV et PTZ derrière des passerelles SDI ↔ IP. À vérifier selon les options réellement installées.', SIMU],
  ['net7', 'Réseau ST 2110', 'Querier IGMP : expiration des abonnements ramenée à 45 s (≈ 260 s par défaut, intervalle d\'appartenance IGMP) ; plage SSM par défaut 232.0.0.0/8.', NET2110],
  ['net8', 'Réseau ST 2110', 'Ligne de commande : syntaxe inspirée d\'EOS / NX-OS, simplifiée ; sorties de show reconstruites, pas copiées d\'un constructeur.', SIMU],

  ['cam1', 'Chaîne caméra', 'Tête HDC-5500 : connecteurs arrière (fibre 3K.93C, SDI 1/2/3, SDI MONI, TEST OUT, PROMPTER/GENLOCK, INTERCOM 1/2 XLR-5, AUDIO CH1/2, DC IN XLR-4 10,5-17 V, REMOTE, RET CTRL, TRACKER, CRANE).', SONY_HDC],
  ['cam2', 'Chaîne caméra', 'Portée ≈ 2 km en fibre hybride avec HDCU-5500 (4 km avec HDCU-5000) ; ≈ 10 km en monomode avec alimentation locale.', SONY_CCU],
  ['cam3', 'Chaîne caméra', 'CCU HDCU-5500 : demi-largeur 3U, D-sub 50 INTERCOM/TALLY/IO (PROD/ENG, PGM, tally R/G/Y), RCP/CNU 8 broches, REF IN/OUT en boucle, sortie CHARACTER.', SONY_CCU],
  ['cam4', 'Chaîne caméra', 'RCP-3500 : PoE 802.3af classe 2, CCU/CNU 8 broches, AUX 8 broches, EXT I/O D-sub 9, 102 × 310 × 67 mm, 1,7 kg, 10 W, 9 touches assignables.', SONY_RCP],
  ['cam5', 'Chaîne caméra', 'Le traitement de l\'image (« paint ») est fait en grande partie dans la tête ; la CCU gère les conversions de sortie (UHD/HD, HDR/SDR).', SONY_CCU],
  ['evs1', 'Serveur EVS XT4K', '4 canaux UHD-4K ou 8 canaux HD ; 12 et plus en configuration ChannelMAX.', EVS_XT4K],
  ['evs2', 'Serveur EVS XT4K', 'UHD sur un seul câble 12G-SDI ; Quad 3G-SDI (2SI / découpage en carrés) en option ; XAVC-4K 10 bits HDR.', EVS_XT4K],
  ['evs3', 'Serveur EVS XT4K', 'Stockage interne jusqu\'à 9 To (≈ 130 h d\'UHD annoncées ; un article parle de « plus de 30 h »), extensible jusqu\'à 40 To.', EVS_XT4K],
  ['evs4', 'Serveur EVS XT4K', '192 pistes audio, routeur audio interne ; réseaux XNet 3 Gb/s, 2 × 10 GbE, gestion redondante ; 6U.', EVS_XT4K],
  ['evs5', 'Serveur EVS XT4K', 'Télécommande LSM reliée au serveur en RS-422 (19 200 bauds d\'après les manuels XT) ; ports GPI et LTC.', EVS_XT],
  ['evs6', 'Serveur EVS XT4K', 'Répartition retenue avec un seul XT4K : HD = 8 REC + 2 PLAY (ChannelMAX) ou 6 REC + 2 PLAY ; UHD = 3 REC + 1 PLAY.', SIMU],
  ['lsm1', 'Télécommande LSM', 'Levier 0-100 % ; plage secondaire −100/+100 % ou −200/+200 %. Jog ≈ 35 images par tour. FAST JOG désactivé après PLAY/LIVE.', EVS_MC],
  ['lsm2', 'Télécommande LSM', 'Touches à double fonction (SHIFT) : IN/GOTO IN, OUT/GOTO OUT, PLST/BROWSE ; SHIFT + PAGE puis F = page 1 à 10.', EVS_MC],
  ['lsm5', 'Télécommande LSM', 'Création d\'un clip : IN et/ou OUT, puis une touche F libre ; une touche F occupée rappelle son clip (le simulateur utilise SHIFT + F pour écraser).', EVS_MC],
  ['lsm3', 'Télécommande LSM', 'RETURN (revenir dans le train depuis un clip), TAKE (échange PGM/PRV ou les deux PGM), verrouillage CLEAR puis MENU.', EVS_MC],
  ['lsm4', 'Télécommande LSM', 'Nommage des clips page · banque · touche · angle (ex. 111A) ; la disposition exacte des touches dépend du modèle.', EVS_MC],
  ['ipd1', 'IPDirector', 'Modules base de données, log, playlist, contrôle des canaux ; mêmes clips que la LSM.', EVS_IPD],
  ['xvs1', 'Mélangeur XVS-6000', 'En 4K (configuration de base) : 2 M/E, 16 entrées, 6 sorties, 8 keyers (4 full + 4 sub). Le simulateur limite le mélangeur à 16 entrées en UHD.', SONY_XVS],
  ['xvs2', 'Mélangeur XVS-6000', 'En HD : jusqu\'à 4 M/E selon les sources, 48 ou 64 entrées (les sources divergent), 24 sorties assignables, jusqu\'à 16 keyers.', SONY_XVS],
  ['xvs3', 'Mélangeur XVS-6000', '4 keyers par M/E avec redimensionneur 2,5D ; DME 3D en option (XKS-8470 : 2 canaux HD ; XKS-8475 : 1 canal 4K).', SONY_XVS],
  ['xvs4', 'Mélangeur XVS-6000', 'Frame memory non volatile 480 Go (images, clips, transitions « clip ») ; 2 multiviewers intégrés (4/10/13/16 fenêtres).', SONY_XVS],
  ['xvs5', 'Mélangeur XVS-6000', 'Processeur : REF IN BNC avec boucle, NETWORK (MVS LAN) et (UTIL LAN) en 1000BASE-T ; tally par carte MKS-X7701 (3 × D-sub 37, 18 relais).', SONY_XVS],
  ['xvs6', 'Mélangeur XVS-6000', 'Pupitre ICP-X7000 : 1 à 4 rangées M/E, 20/28/36 boutons XPT, OLED, boutons RVB ; relié via MKS-X7700 ou MKS-X2700.', SONY_ICP],
  ['lvl1', 'Niveaux et mesures', 'Vidéo 10 bits : noir 64, blanc 940, super-blanc max 1019 ; white clip par défaut du simulateur à 103 % (tolérance EBU R103).', NORMES],
  ['lvl2', 'Niveaux et mesures', 'Audio : alignement −18 dBFS (EBU R68), −23 LUFS intégré et −1 dBTP (EBU R128).', NORMES],
  ['lvl3', 'Niveaux et mesures', 'HLG : blanc de référence à 75 % du signal, 203 cd/m² (ITU-R BT.2408).', NORMES],
  ['lvl4', 'Niveaux et mesures', 'Fibre monomode ≈ 0,35-0,4 dB/km à 1310 nm ; ≈ 0,5 dB par connexion propre.', NORMES],
  ['lvl5', 'Niveaux et mesures', 'Line-up : niveau moyen visé 40-45 % selon la valeur de plan ; repères pelouse 40-55 %.', SIMU],
  ['aud1', 'Son', 'Synchro son / image : son en avance de 40 ms au plus, en retard de 60 ms au plus (EBU R37).', NORMES],
  ['aud2', 'Son', 'Plan de son par défaut : 1-2 PGM stéréo, 3-4 international, 5-8 silence (modifiable dans « Le car »).', SIMU],
  ['aud3', 'Son', 'Retard « asservi au tally » : la console ajoute la latence de la source à l\'antenne (caméra HF) ; le micro de la caméra HF est déjà calé sur son image.', SIMU],
  ['std1', 'Stade', 'Orientation : Lepagnot au sud (tribune principale : vestiaires, presse, TV), Marek-Xercès au nord (kop Marek debout en bas), Trannin à l\'ouest (voie ferrée, visiteurs), Delacourt à l\'est.', STADE],
  ['std2', 'Stade', 'Quatre pylônes d\'angle en treillis (≈ 72 m) portent un anneau de poutres auquel les toits sont suspendus ; angles ouverts ; toit ≈ 33 m.', STADE],
  ['std3', 'Stade', 'Deux écrans d\'angle de taille modeste (Marek-Delacourt, et Trannin-Lepagnot supposé) ; surface exacte non trouvée.', STADE],
  ['std4', 'Stade', 'Passerelle caméras sur le toit des loges de Lepagnot, compound TV derrière Lepagnot : emplacements supposés, à corriger avec votre plan d\'installation réel.', SIMU],
  ['std5', 'Stade', 'Sièges noirs, gris et blancs (pas de sièges sang et or) ; Xercès plus basse que les trois autres tribunes hautes ; toits qui ne couvrent pas les premiers rangs ; 20 grappes de haut-parleurs.', STADE],
  ['vis1', 'Console son', 'Studer Vista 1 : versions 22 faders (≈ 1 m de large) et 32 faders ; DSP intégré annoncé à 96 canaux (mono, stéréo, 5.1). Le nombre exact d\'E/S intégrées varie selon les sources (micro/ligne, ligne, AES) : à vérifier sur la fiche constructeur.', STUDER],
  ['vis2', 'Console son', 'Vistonics : molettes et touches montées sur l\'écran tactile, 10 tranches par écran ; couleurs : égaliseur rouge, dynamique vert, panoramique jaune. FaderGlow : bande lumineuse colorée le long des faders.', STUDER],
  ['vis3', 'Console son', 'Plan de patch du simulateur (MIC 1-11, MADI 1-2, SDI 1/1, AES 1-4, générateur) et dosages par défaut : choix pédagogiques, à adapter à la feuille de patch réelle du car.', SIMU],
  ['vis4', 'Console son', 'Voix des commentateurs par synthèse vocale du navigateur : volume calculé depuis la console (patch, gain, fader, VCA, bus écouté) ; l\'égaliseur et la dynamique ne modifient pas leur timbre.', SIMU],
  ['fuj1', 'Objectifs', 'Fujinon UA107x8.4BESM : 8,4-900 mm, f/1,7 jusqu\'à 340 mm, f/4,5 à 900 mm, MOD 3,05 m, ≈ 23,9 kg, 258 × 264 × 610 mm.', FUJI],
  ['fuj2', 'Objectifs', 'Fujinon UA80x9BESM : 9-720 mm, f/1,7 jusqu\'à 350 mm, f/3,5 à 720 mm, MOD 3,7 m, 23,5 kg ; UA125x8BESM : 8-1000 mm, f/1,7 → f/5,0, MOD 3,0 m, 26,6 kg ; UA70x8.7BESM : 8,7-610 mm, f/1,7 → f/3,05 ; UA27x6.5BESM : 6,5-180 mm, f/1,5 → f/2,2, MOD 0,6 m.', FUJI],
  ['fuj3', 'Objectifs', 'Portables : UA24x7.8BERD 7,8-187 mm f/1,8 → f/2,85, 1,98 kg ; UA46x13.5BERD 13,5-621 mm f/2,8 → f/5,5, 5,8 kg ; UA13x4.5BERD 4,5-59 mm f/1,8 → f/2,6, MOD 0,3 m. UA14x4.5BERD : ouvertures non vérifiées.', FUJI],
  ['hdla1', 'Caméras', 'Caméra tribune : Sony HDC-5500 dans un adaptateur grand objectif (série HDLA) avec viseur 7". La référence d\'adaptateur compatible HDC-5500 n\'a pas été confirmée (HDLA-1505/1507 : anciennes générations, HDLA-3505 : gamme HDC/HSC).', SONY_HDLA],
  ['ip1', 'IP', 'ST 2110-20 : ≈ 2,1 Gb/s en 1080p50 10 bits 4:2:2 ; ≈ 8,3 Gb/s en UHD p50. PTP ST 2059-2 ; NMOS IS-04/IS-05 ; ST 2022-7.', NORMES],
];
export const REVIEW_STATUS = { '': 'À vérifier', ok: 'Validé', fix: 'À corriger' };
