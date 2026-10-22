# TIEE Simulator — simulateur de formation au car régie

Réalisé par le BTS Audiovisuel de Saint-Quentin (lycée Henri-Martin), développé par Pierre MALYCHA.

Simulateur pédagogique d'une captation de football en car régie : stade 3D, plan de caméras, liaisons
(SMPTE, triax, fibre, coax, IP, HF), car régie visitable en vue à la première personne et postes
interactifs (réalisateur, scripte, mélangeur, habillage, vision/RCP, EVS/LSM, IPDirector, son, HF, grille,
CCU, synchro, transmission, intercom, baie de brassage, chef de car avec simulateur de pannes).

Aux postes, les écrans utiles restent affichés en permanence (zone d'écrans fixe, moniteur flottant
déplaçable) et un fil « Ce qui se passe » explique chaque action. Une visionneuse de matériel montre les faces
avant/arrière (caméra système, CCU, RCP, serveur ralenti, LSM, mélangeur, grille, SPG…), chaque connecteur et la
liste de câblage générée à partir de l'installation.

## Profil matériel

Le simulateur est réglé sur ce parc (modifiable dans Réglages, profil Formateur, Espace formateur → « Le car ») :

- mélangeur Sony XVS-6000 avec pupitre ICP-X7000 (16 entrées utilisées en UHD, 22 en HD) ;
- un serveur EVS XT4K (UHD : 3 REC + 1 PLAY ; HD : 8 REC + 2 PLAY en ChannelMAX, 6 + 2 sinon) ;
- une télécommande LSM (logiciel Multicam) et un poste IPDirector.

## Ce que contient la v3

- **Line-up** : niveaux par défaut recalés (moyennes 40-55 %, crêtes ≤ 103 %), white clip réglable.
- **Espace formateur** (données partagées de la page publiée, repli sur le navigateur sinon) :
  - nom du car et matériel ;
  - plan de son habituel ;
  - check-list et procédures maison ;
  - import/export de la liste de câblage (CSV, Excel) ;
  - photos du matériel avec points cliquables ;
  - suivi des stagiaires ;
  - fiche de relecture technique.
- **Baie de brassage** : exercice « car vide » sur jackfield, avec effets visibles au multiview (entrée vide,
  source croisée, référence absente).
- **Scénario « jour de match »** : brassage → line-up → test de ligne (plan de son, mire, 1 kHz) → antenne
  avec pannes surprises ; rapport noté et téléchargeable.
- **Car IP** (ST 2110) :
  - réseaux rouge et bleu (ST 2022-7) ;
  - PTP avec élection du grand maître (BMCA) ;
  - NMOS IS-04 / IS-05 ;
  - capacité du lien du multiviewer ;
  - pannes dédiées.
- **HDR** : sortie HLG (blanc de référence à 75 %) et moniteur de référence SDR | HDR côte à côte.
- **Son** :
  - 8 tranches ;
  - bus PGM / international / N-1 ;
  - écoute par bus ;
  - retard de ligne (synchro labiale, EBU R37) asservi ou non au tally ;
  - embedder du départ conforme au plan de son ;
  - pannes son.
- **Diagnostic de performance** (fluidité, carte graphique, qualité recommandée) et bouton « Signaler une
  erreur » partout.

## Ce que contient la v4

- **Car régie repensé** :
  - allée continue côté porte et passage vers la 1re rangée ;
  - zone technique accessible par sa propre porte ;
  - poste visé allumé en orange, clic ou E pour s'y installer ;
  - mini-plan et grand plan du car (Tab) ;
  - pupitres et baies détaillés (CCU HDCU-5500, grille, XVS-6000, XT4K, patch, synchro, intercom, HF…).
  - `tests/e2e/acces-postes.mjs` vérifie que chaque poste est accessible à pied.
- **Stade inspiré de Bollaert-Delelis (Lens)**, reconstitution non officielle :
  - tribunes Lepagnot, Marek-Xercès (kop Marek debout), Trannin et Delacourt, angles ouverts ;
  - pylônes d'angle, anneau de poutres, toits suspendus, deux écrans géants d'angle ;
  - public sang et or ;
  - voie ferrée et TER, cités minières, gare, terrils jumeaux et chevalements de la fosse 11/19 à l'horizon.
- **Caméras 3D détaillées** : tête fluide, manivelles de zoom et de point, viseur 7", objectif box, portable ENG, Steadicam, grue, PTZ, drone.

## Ce que contient la v5

- **Synoptiques techniques du car** (barre d'outils « Synoptiques », touche Y, poste chef de car) :
  - schémas : vidéo, synchronisation (et PTP en car IP), audio, intercom et tally, réseaux, énergie, élévation des baies, implantation ;
  - générés à partir de l'état réel du car : défauts en rouge, source à l'antenne en rouge, préparée en vert ;
  - un clic sur un bloc ouvre l'appareil ;
  - mode impression fond blanc et export SVG.
- **Stade plus réaliste (Bollaert-Delelis)** :
  - sièges noirs, gris et blancs ; Xercès plus basse que les autres tribunes ;
  - toits qui s'arrêtent avant les premiers rangs, nervures blanches en sous-face, haut-parleurs suspendus ;
  - escaliers aux nez de marche jaunes, vomitoires, tribune présidentielle, garde-corps, liserés sang et or ;
  - banderoles et drapeaux dans le Marek ;
  - façades en bardage blanc, écrans d'angle plus petits ;
  - parvis arboré, maisons de mineurs individuelles.

## Ce que contient la v6 : un vrai réseau ST 2110

- **Deux fabrics spine-leaf indépendantes**, rouge (A) et bleue (B), pour ST 2022-7 : par réseau 2 spines 32 × 100 GbE,
  6 leaves de haut de baie 48 × 25 GbE + 8 × 100 GbE (caméras, production, ralentis, monitoring, audio, passerelles),
  2 × 100 GbE de chaque leaf vers chaque spine, deux grands maîtres PTP, un commutateur de contrôle (NMOS).
- **Poste « Réseau IP »** (zone technique, baie « Réseau IP · Multiview ») :
  - topologie vivante (charge des liens, OSPF, PIM, état des cartes rouge / bleu de chaque appareil) ;
  - commutateurs configurables : face avant, ports (vitesse, FEC, MTU, VLAN, mode routé, PIM, OSPF, PTP), VLAN et SVI,
    routage, multicast, PTP, QoS, running / startup-config avec différences, write memory, configuration usine ;
  - **terminal** de type EOS / NX-OS (show interfaces status, show ip ospf neighbor, show ip mroute, show ip igmp snooping
    groups, show ptp, configure terminal…, abréviations, « ? », Tab, « | include ») ;
  - plan d'adressage modifiable (VLAN 100 × réseau + leaf, 10.réseau.leaf.0/24, /31 d'underlay, groupes 239.x), plan multicast ;
  - flux NMOS : chemin réel de chaque réception sur chaque réseau, SDP avec « a=group:DUP », mode PIM-SSM ou contrôleur SDN ;
  - PTP : élection BMCA, grands maîtres, horloges frontières, appareils « slave only » ;
  - diagnostic : alarmes avec renvoi au port, méthode de dépannage.
- **Effets réels à l'image** : flux perdu, pertes de paquets (lien saturé), refus SDN, caméra déverrouillée si PTP perdu.
- **13 pannes réseau** : spines coupées, grand maître, registre NMOS, port du multiviewer à 25G, VLAN, snooping, querier,
  plage SSM, MTU d'uplink, appareil élu grand maître, FEC, domaine PTP, conflit d'adresse.
- Liste de câblage du car IP générée port par port, synoptiques réseau et PTP tirés de la vraie topologie, chapitre
  « Réseau ST 2110 spine-leaf » et 22 termes de glossaire.

## Ce que contient la v7 : mesurer et former sur le réseau ST 2110

- **Onglet Formation** du poste Réseau IP : 14 missions guidées (topologie, adressage, CLI, OSPF/ECMP, suivi d'un flux,
  lecture d'un SDP, PTP, mesures, 5 dépannages, reconstruction d'une leaf depuis la configuration usine). Les objectifs
  se cochent seuls (actions dans le poste, commandes tapées, état réel du réseau) ; questions intégrées, indices
  payants, barème. Quiz de 10 questions tirées dans 26. **Examen** : 3 pannes cachées enregistrées dans la startup,
  15 minutes, score et compte rendu téléchargeable. Résultats dans le suivi du formateur.
- **Onglet Mesures** :
  - analyseur de flux : débit, paquets/s, pertes, gigue, CINST / CMAX et VRX / VRX_FULL (ST 2110-21), latence,
    décalage RTP → arrivée, écart rouge / bleu et paquets réparés / perdus (ST 2022-7), historiques sur 60 s ;
  - suivi PTP : offset de chaque appareil ou commutateur, transitoire au changement de grand maître, dérive d'une
    horloge non traçable ;
  - capture sur port miroir (monitor session) : flux observés, paquets RTP / PTP / IGMP / OSPF / PIM décodés couche par
    couche (Ethernet, IPv4/DSCP, UDP, RTP, RFC 4175), trous de séquence, débordement du port miroir ;
  - charge des liens avec historique.
- SDP commenté ligne par ligne, antisèche EOS / NX-OS / IOS-XE, alias NX-OS dans le CLI, adresses modifiées
  conservées, panne « horloge pirate » sur un appareil au hasard, chapitre « Mesurer et analyser un flux ST 2110 ».

## Ce que contient la v8 : son façon Vista 1, commentaires, caméras Sony / Fujinon

- **Console son inspirée de la Studer Vista 1** (simulation non officielle) : deux écrans « Vistonics » de 10 tranches
  (molettes posées sur l'écran ; rouge = égaliseur, vert = dynamique, jaune = panoramique), FaderGlow, couches A
  (sources) / B (masters et VCA), Control Bay (vumètres, corrélateur, loudness, écoutes PGM / INTL / N-1, DIM, MONO,
  PFL, talkback, lampe rouge) et écran de la tranche sélectionnée. Chaque tranche a une vraie chaîne WebAudio :
  patch d'entrée, gain avec saturation, 48 V, polarité, passe-haut, égaliseur 4 bandes, gate, compresseur, retard,
  panoramique, fader, VCA, départs PGM / international / N-1 commentaire / N-1 studio / N-1 bord terrain, AFV.
  Pages E/S et patch (face arrière, cartes D21m), bus et départs, snapshots (match, avant-match, mi-temps, test de
  ligne), « Comprendre la Vista 1 ». 17 sources : 2 couples d'ambiance, 6 canons qui captent le jeu selon leur
  distance au ballon (assistant de suivi du jeu débrayable), micro de la caméra HF, 2 EVS, commentateur, consultant,
  bord terrain, duplex, jingles, mire. Quatre nouvelles pannes : 48 V, phase, saturation d'entrée, patch.
- **Commentaires pendant le match** : commentateur, consultant, journaliste bord terrain et plateau, générés par les
  événements du match et dits par la synthèse vocale du navigateur ; le volume suit réellement la console (patch, gain,
  fader, VCA, mute, bus écouté, master, DIM, retard de ligne).
- **Console 3D** dans la cabine son : baies Vistonics avec molettes, faders motorisés et FaderGlow, touches, Control
  Bay, pont de vumètres ; tout suit l'état de la console.
- **Caméras** : Sony HDC-5500 dans un adaptateur grand objectif avec viseur 7", objectifs box Fujinon (UA125, UA107,
  UA80, UA70, UA27) et portables (UA24, UA46x13.5, UA13) avec leurs focales, rampes d'ouverture, distances minimales
  et masses ; modèles 3D refaits (boîtier, pare-soleil, servo, demandes de zoom et de point, tête fluide).
- **Commutation au clavier** : 1 à 9 (et 0) partout (déplacement, vol, postes), en mode DIRECT ou PRESET (B), Entrée =
  CUT ; fonctionne en AZERTY avec ou sans Maj.
- **Rendu et déplacements** : plus de scintillement des textures en vol (plan proche adaptatif, décalages de
  profondeur), inertie et balancement de la marche, vol plus fluide, regard lissé, brume, nuages, sol texturé.

## Ce que contient la v9 : relecture par les métiers, sessions à plusieurs, rendu réaliste

- **Relecture technique par les métiers** : les relecteurs (vision, son, réseau, ralentis, HF, niveaux, stade) donnent
  un avis par point, commentent et proposent des valeurs chiffrées ; le formateur voit la synthèse, tranche, et peut
  appliquer une valeur proposée à tout le simulateur (registre de paramètres : objectifs, portées des liaisons, C/N,
  latences, synchro labiale, line-up). Rapport HTML et CSV. Onglet « Dispositif réel » : implantation des caméras et
  feuille de patch audio du car de l'organisme.
- **Sessions à plusieurs en temps réel** : un code de session, un rôle par stagiaire (réalisateur, truquiste,
  ralentis, son, vision, technique, habillage, cadreur, observateur, formateur). Chaque poste est piloté par son
  titulaire et suivi en lecture seule par les autres ; le match tourne chez l'hôte et les autres le suivent ; les ordres
  du réalisateur s'affichent en grand chez le truquiste et l'opérateur ralenti ; le formateur injecte des pannes chez
  le bon stagiaire et obtient un compte rendu (temps de réaction aux ordres, pannes résolues).
- **Rendu réaliste** :
  - matériaux physiques (rugosité, métal) et éclairage d'environnement calculé à partir du ciel ; studio lumineux dans
    le car ; l'exposition des caméras broadcast reste calée sur celle de la v8 (écart mesuré < 1 % de jour) ;
  - vue « œil » post-traitée : image HDR multi-échantillonnée, halo des sources intenses (projecteurs de nuit,
    bandeaux LED du car), courbe filmique ACES, étalonnage léger, vignettage ; soleil visible dans le ciel ;
  - joueurs et arbitres articulés (buste, short, cuisses, jambes, chaussures, bras, mains, tête et cheveux), nom et
    numéro au dos, traits du visage, course procédurale (foulée, genou, coude, buste), regard qui suit le ballon,
    gardien en appui, fanions des arbitres assistants ; ballon à pentagones ;
  - public éclairé par le soleil et les ombres des toits, de face ou de dos selon le point de vue, écharpes, bonnets,
    vestes, qui se lève et lève les bras quand le match s'emballe ; drapeaux en tissu qui ondulent ;
  - pelouse avec grain de près, toits en bac acier, charpente métallique ;
  - paysage jusqu'à l'horizon (parcelles, routes, quartiers, autoroute), bois, haies et arbres de jardin, terrils
    érodés ;
  - compound : semi-remorque régie avec livrée, extensions, béquilles, roues à jantes, escalier à garde-corps,
    tracteur, camion satellite, groupe électrogène, bungalows, enrobé ; car régie éclairé par bandeaux LED, éclairage
    sous les bureaux et rétroéclairage des murs d'écrans.
  - Niveaux de qualité : « basse » garde les matériaux physiques sans post-traitement, le mode allégé (mobile) garde
    l'ancien rendu ; les arbres lointains ne sont calculés que pour la vue « œil » (pas par les caméras du stade).

## Ce que contient la v10 : interfaces repensées, relecture technique, atelier de montage caméra

- **Interfaces repensées, dans le langage visuel d'un car** :
  - titres en étiquettes de titreuse, raccourcis dessinés comme des touches de clavier ;
  - barre d'état façon afficheur UMD (cases noires, lampes de tally rouge et verte pour PGM / PVW) ;
  - bleu « rétroéclairage LCD » réservé à la sélection et au focus, touche blanche allumée pour l'action principale ;
  - polices Barlow (lisibles, condensées comme les légendes de pupitres) et JetBrains Mono pour les valeurs.
- **Accueil en feuille de service** : chaque mode est placé à l'heure où il se pratique un jour de match
  (get-in 08:00, préparation caméras 09:30, câblage 11:00, line-up 17:30, antenne 20:45). Les conditions de captation
  et l'espace formateur sont dans une colonne à part.
- **Prise en main** :
  - barre d'outils groupée par usage (se déplacer, la régie, l'aide, l'équipe) ;
  - aide aux six gestes de base à la première partie ;
  - en-têtes de postes avec le rôle et la touche Échap ;
  - écrans adaptés au téléphone.
- **Relecture technique complète** : 68 corrections sourcées (fiches constructeurs, normes EBU, SMPTE, ITU, Arcep,
  Code du travail), notamment :
  - **objectifs** : ouvertures et rampes recalées sur les fiches Canon et Fujinon, calcul des diaphragmes perdus,
    distance minimale de mise au point des longs portables ;
  - **caméras** : super ralenti de la HDC-5500 (8x en HD, 2x en 4K), crans de la roue ND, sensibilité, HLG sur écran
    BT.709 ;
  - **vidéo** : tolérance EBU R103 actuelle (105 %), 32 canaux audio embeddés en 3G / 12G-SDI (ST 299-2), latence
    d'un bond satellite (≈ 0,25 s), stockage interne de l'XT4K, longueur maximale d'un semi-remorque (16,50 m) ;
  - **son** : limites EBU R37 par étape et de bout en bout, seuils asymétriques de BT.1359, MADI 64 canaux,
    ORTF en mono, IFB en mix-minus, implantation de la Vista 1 et rôle du FaderGlow ;
  - **réseau ST 2110** : débits en 50 Hz, TRO pour l'UHD, trois flux UHD qui ne tiennent pas dans un port 25 GbE,
    VPID, niveaux JPEG XS, RS-FEC, RPF ;
  - **HF** : plan de fréquences sorti de la bande mobile 2,1 GHz ; les liaisons vidéo mobiles sont autorisées par
    l'Arcep (et non l'ANFR) ;
  - **sécurité** : travail en hauteur (protections collectives d'abord) et habilitation électrique.
  - Au passage, la durée des transitions suit la cadence du format (1080i50 compris).
- **Atelier de montage caméra (vue à la première personne)** : la CAM 1 (plan large) se monte sur la passerelle,
  pièce par pièce, à partir des flight cases :
  - **pièces** : pied lourd et araignée, tête fluide (embase 4 vis), manches, plaque, adaptateur grand objectif,
    tête de caméra, objectif box (levé à deux), viseur 7,4", commandes de zoom et de point (côté au choix), câble
    d'objectif 36 broches, fibre hybride SMPTE, casque d'ordres ;
  - **gestes** : viser et prendre (E), reposer (Q). La pièce tenue apparaît en fantôme à sa place, vert si c'est le
    moment et rouge sinon, avec la raison. Certains gestes se maintiennent (déployer les jambes, lever l'objectif,
    nettoyer une fibre) ; la bulle de niveau et l'équilibrage se règlent à la molette ;
  - **ordre de métier** : chaque refus explique la règle (tête verrouillée avant toute charge, mise à niveau avant
    de charger, objectif à deux, équilibrage une fois tout monté, fibre nettoyée et câble attaché) ;
  - **mise en service avec la vision par l'intercom** : alimentation par la CCU, image, test CALL et tally. Une fibre
    branchée sans nettoyage fait tomber le niveau optique et l'image (il faut débrancher, nettoyer, rebrancher) ; un
    bouchon oublié donne du noir ;
  - **bilan** : rapport (temps, erreurs, ce qui a été repris, points à retenir). La caméra montée reprend sa place
    dans le dispositif. Le résultat est enregistré dans la progression et apparaît dans le tableau de bord du
    formateur.

## Ce que contient la v11 : jouer à plusieurs sur un réseau local

- **Héberger / rejoindre** : la personne qui héberge lance un petit serveur sur son ordinateur ; les autres ouvrent
  l'adresse qu'il affiche (`http://192.168.x.x:8080`) dans leur navigateur, sans rien installer. Sur le réseau
  local, les parties en cours s'affichent toutes seules, avec qui tient quel rôle. Le mode en ligne (page publiée
  sur claude.ai) fonctionne toujours, avec les mêmes écrans.
- **Le serveur réseau local** (`lan/serveur.mjs`, Node.js 18 ou plus, aucune dépendance) :
  - sert la page du simulateur avec three.js intégré, donc sans connexion Internet ;
  - relaie en WebSocket la présence de chaque joueur (pseudo, rôle, position, états des postes) et les messages
    (ordres, faits de jeu, commentaires) ;
  - garde la présence de chacun pour les arrivants ;
  - écrit les comptes rendus de session dans un dossier `rapports`.
  
  Il existe aussi en un seul fichier autonome (`dist/car-regie-serveur-lan.mjs`). Ce fichier est livré dans
  l'archive `dist/car-regie-reseau-local.zip`, avec des lanceurs Windows / macOS / Linux et un mode d'emploi.
  L'archive se télécharge depuis la page publiée (« Jouer à plusieurs »). Une connexion qui décroche se rétablit
  seule.
- **Pseudos et avatars** :
  - chaque joueur choisit un pseudo ;
  - les autres le voient comme un technicien articulé, avec une tenue de la couleur de son rôle, un casque
    d'ordres, et son pseudo et son rôle au-dessus de la tête. Ces étiquettes grossissent avec la distance et ne
    sont pas filmées par les caméras du stade ;
  - il marche dans le stade, le compound et le car, et s'assoit à son pupitre quand il tient un poste. Quand il
    cadre, son étiquette passe au-dessus de sa caméra ;
  - le plan du car montre les équipiers, et « Aller à… » permet de rejoindre l'un d'eux.
- **Rôles dans la prestation** :
  - un rôle déjà pris est signalé au moment de rejoindre ;
  - l'hôte ou le formateur réattribue les rôles depuis l'onglet Participants (caméra comprise pour un cadreur) ;
  - chaque joueur a une fiche de rôle avec sa mission, un bouton « Aller à mon poste » (un cadreur y prend
    directement sa caméra) et des objectifs mesurés en direct : ordres exécutés et temps de réaction du truquiste,
    enregistrement et ralentis passés pour l'EVS, loudness, commentaires hors de l'international et corrélation
    pour le son, caméras bien exposées pour la vision, liaisons et transmission pour la technique, score et
    graphiques pour l'habillage, temps à l'antenne pour le cadreur ;
  - le compte rendu du formateur reprend les participants et leurs rôles.

## Ce que contient la v12 : un code plus stable, plus structuré, mesuré

Aucune fonction nouvelle pour le stagiaire : la v12 rend le simulateur plus sûr à faire évoluer.

- **Vérifications automatiques** :
  - ESLint (`eslint.config.js`) sur tout le code ;
  - vérification de types TypeScript sur le JavaScript existant (JSDoc, `// @ts-check` dans chaque fichier de
    `src/`), deux configurations : navigateur (`tsconfig.json`) et Node (`tsconfig.node.json`) ;
  - 65 tests unitaires `node:test` (≈ 2 s, sans navigateur) dans `tests/unit/` :
    - cohérence des catalogues et contenus (objectifs, types de caméras, positions, dispositifs prédéfinis,
      HF, fiches de poste, glossaire, guide, atelier) ;
    - réseau ST 2110 : topologie, ST 2022-7, PTP, chaque panne réseau injectée puis réparée, ligne de commande ;
    - session à plusieurs : chaque tranche d'état se réapplique à l'identique, un suivant reconstruit le
      dispositif de l'hôte, objectifs de rôle ;
    - réseau local : vrai serveur et client du jeu (présence, messages, reconnexion d'un onglet, parties, comptes
      rendus, partie complète) ;
    - archives ZIP relues par un lecteur indépendant ;
  - intégration continue GitHub Actions (`.github/workflows/ci.yml`) : lint, types, tests unitaires et
    construction à chaque envoi ; tests de bout en bout à la demande.
- **Tests de bout en bout rangés** dans `tests/e2e/` avec un harnais commun (`harness.mjs`) : page servie comme
  sur claude.ai, attentes sur condition plutôt que délais fixes, code de sortie fiable ; `tools/e2e.mjs` les
  enchaîne et donne un bilan.
- **Défauts trouvés par les tests et corrigés** :
  - « charger la configuration de référence » d'un commutateur oubliait les descriptions du second port des
    agrégats et ne réadaptait pas la vitesse des ports aux cartes réseau (un appareil 10G repassait en 25G) ;
  - la baie de brassage n'apparaissait pas dans l'onglet « Les postes » du guide.
- **Code réorganisé** :
  - `main.js` (824 lignes) découpé en modules `src/app/` ; il ne garde que l'initialisation, les événements
    et la boucle principale ;
  - `data.js` (1 160 lignes) séparé en catalogues techniques (`src/data/`) et contenus pédagogiques
    (`src/content/`).
- **Optimisations mesurées** (profileur intégré : ajouter `?perf` à l'adresse) : voir « Performances » plus bas.

## Ce que contient la v13 : le chef de car

Un tuteur, **Olivier, chef de car**, accompagne le stagiaire poste par poste. On l'appelle à tout moment :
bouton « Chef de car » de la feuille de service ou de la barre d'outils, bouton « Chef de car » en tête de chaque
poste, ou touche **J**.

- **Il sait où l'on est** et propose d'abord ce qui concerne le poste ouvert.
- **Il explique, puis demande un geste**, et vérifie sur l'état réel du simulateur que c'est fait. Ensuite il
  commente le résultat : ce qui a changé et pourquoi.
- À chaque étape, quatre aides :
  - « Montre-moi » met en évidence l'élément à utiliser (onglet, bouton, port, case, ligne d'un tableau) ;
  - « Emmène-moi » ouvre le bon poste et le bon onglet ;
  - les indices sont progressifs ;
  - « Fais-le pour moi » fait le geste devant le stagiaire : les commandes s'affichent dans le terminal.
- **Les commandes à taper sont cliquables** : elles vont dans le terminal du commutateur, il ne reste qu'à
  valider. Le panneau ne bloque pas le poste : on lit et on agit en même temps. Il peut être déplacé ou réduit,
  et se place en bas de l'écran sur mobile.
- **Voix** (facultative) : le chef lit ses explications ; pendant ce temps, les commentaires du match restent
  en texte.
- Les parcours terminés, les aides et les indices utilisés sont **enregistrés** dans la progression du
  stagiaire.
- Si l'on quitte un parcours en cours de route, le chef propose de remettre le réseau en état.

Parcours guidés, en commençant par le **réseau ST 2110** (dans un car SDI, le chef propose de passer le car en
IP) :

| Parcours | Ce qu'on y fait |
| --- | --- |
| Le réseau du car en 15 minutes | Visite commentée : pourquoi l'IP, rouge et bleu (ST 2022-7), spines et leaves, bande passante, plan d'adressage, un flux de bout en bout, lecture d'un SDP, PTP, analyseur, diagnostic |
| Mettre en service une leaf neuve | La leaf caméras rouge est remplacée par un commutateur en configuration usine. On la configure couche par couche : vérification LLDP, nom, VLAN, ports d'accès, SVI, routage, uplinks /31 en 100G RS-FEC, loopback et OSPF (voisins FULL), SSM, PIM et IGMPv3, retour de la protection 2022-7, PTP en horloge frontière, QoS DSCP, diagnostic et `write memory` |
| PTP : qui donne l'heure ? | BMCA, `show ptp parent`, coupure du grand maître 1 en plein direct (le 2 est élu, les caméras restent verrouillées), retour, horloge pirate, piège priority1 / classe d'horloge |
| Dépannage : une caméra a disparu | Panne réelle injectée. On applique la méthode : délimiter (une source, les deux réseaux), diagnostic, couche 1 puis couche 2, réparer sur le rouge puis sur le bleu, enregistrer |

Pour **chaque poste**, « Présente-moi ce poste » reprend sa fiche (rôle, matériel, déroulé, conseils).

Les parcours sont des données (`src/tutor/lessons/`) interprétées par un moteur sans affichage
(`src/tutor/engine.js`). Un test unitaire **rejoue chaque parcours de bout en bout** sur le modèle réseau, avec
les seules commandes données par le chef : une commande fausse ou une étape impossible à valider fait échouer le
test.

Au passage, le terminal des commutateurs accepte les commandes d'exploitation (`show`, `write`, `configure`…)
depuis les modes de configuration, comme sous Arista EOS. L'invite d'une plage de ports s'écrit aussi comme sous
EOS (`config-if-Et1-7,9-11`).

## Ce que contient la v17 : le chef de car sur tous les postes

Le chef de car accompagnait surtout le réseau ST 2110. Il a maintenant un **parcours pratique pour chaque poste du car**,
des **parcours de compétences** et des **parcours sur le matériel** : **30 nouveaux parcours**, en plus des 5 parcours
réseau et de la présentation de chaque poste.

Chaque parcours suit la même méthode :

1. le chef explique ;
2. il crée parfois une situation (un défaut, une panne, un brouillage) ;
3. le stagiaire agit ;
4. le chef vérifie sur l'**état réel du simulateur** : l'image rendue (waveform), le mélangeur, le serveur ralenti, la
   console, la grille, la visionneuse ou l'atelier.

Chaque geste propose « Emmène-moi / Montre-moi » (le bon poste, l'élément à utiliser mis en évidence), des indices et
« Fais-le pour moi », et chaque parcours se termine par une question.

| Famille | Parcours |
| --- | --- |
| Prise en main | Se repérer : le car, le plan caméras, les synoptiques |
| Réalisation et mélangeur | Commuter (preset, CUT, enchaîné, barre T, volet logo) · Score et bandeau (DSK, habillage) · Donner les ordres au truquiste · La scripte (timecode, notes vers l'EVS) · La production |
| Image et caméras | Exposer au RCP (PANEL ACTIVE, iris, waveform) · Barres, balance des blancs et matching · Baie CCU : fibre coupée et référence perdue · Prendre une caméra et cadrer · Monter une caméra de stade (atelier) |
| Ralentis | Un ralenti à l'antenne (DERN. ACTION, angle HFR, volet logo) · Clips et playlist au LSM · IPDirector : nommer, indexer, noter |
| Son | Gain, 48 V et phase · N-1 des commentateurs, synchro labiale et plan de son |
| Liaisons, synchro et diffusion | HF : antennes et changement de fréquence · Synchro : GPS, holdover, référence · Grille · Baie de brassage (car vide) · Transmission : mire et secours · Intercom |
| Exploitation et dépannage | Line-up avant l'antenne · Dépanner une panne cachée · Suivre un câble |
| Matériel | Caméra et CCU · Générateur de synchro et distributeur · Serveur EVS · Grille et mélangeur · Pied de car |

**Accueil du chef :**

- au poste où l'on se trouve, ses parcours sont proposés en premier ;
- tous les autres sont rangés par famille, repliés, avec la progression de chaque famille ;
- quand l'élément à utiliser est sous son panneau, le chef se déplace de l'autre côté de l'écran ;
- son panneau passe aussi au-dessus des fenêtres (visionneuse, synoptiques).

**Moteur :**

- le chef suit maintenant les événements de tous les postes : mélangeur, habillage, ralentis, son, grille, intercom,
  pannes et matériel ;
- il sait choisir un onglet de n'importe quel poste et ouvrir le poste vision sur une caméra donnée ;
- il peut ouvrir un appareil sur une face donnée de la visionneuse et faire les gestes hors des postes : prendre une
  caméra, ouvrir le plan, monter la caméra à l'atelier.

**Corrigé au passage :** la baie CCU affiche « CAMÉRA ÉTEINTE (CAM PW au RCP) » quand la caméra est simplement éteinte,
au lieu d'un faux « câble trop long ».

Tests :

- `tests/unit/chef-postes.test.mjs` vérifie que chaque parcours est complet : étapes, textes, gestes faisables,
  questions valides.
- Le même fichier vérifie que chaque poste du car a son parcours.
- Il rejoue 25 parcours de bout en bout sans navigateur.
- `tests/e2e/chef-postes.mjs` rejoue les 30 parcours dans le navigateur, par le panneau du chef. Pour chaque action,
  « Emmène-moi / Montre-moi » doit mettre en évidence un élément réel de la page, et « Fais-le pour moi » doit faire
  valider l'étape.

## v19.2 : l'interface jeu : objectif à l'écran, XP, badges, bruitages

**Un vrai HUD de jeu.** L'objectif en cours est toujours en haut à gauche (`src/game/quest.js`, `#quest`) : l'étape
de l'exercice d'Olivier (titre, étape n / N, barre, « à toi »), la mission du mode « Tout à faire » (n / 22, +25 XP),
la phase du jour de match avec ses objectifs cochés, la visite guidée, ou, sans rien en cours, les missions
disponibles au poste. Plus besoin d'aller les chercher avec Échap. Un **repère 3D** (`#qmark`) suit l'endroit où
aller (pied de car, porte du car, poste) avec la distance ; quand le but est dans le car et que l'on est dehors, il
montre la porte. La **touche L** et le bouton **Missions** (barre d'outils, en-tête des postes) ouvrent le **journal
des missions** : carte joueur, objectif en cours, exercices du poste où l'on est (« Ici, au poste »), missions
d'installation, toutes les missions par chapitre du Cours avec l'XP qu'elles rapportent, « Commencer » (l'exercice
d'Olivier démarre, ou la vacation notée se lance), « Leçon », et la vitrine des badges. Aux postes qui se servent de
L (mélangeur : volet logo ; EVS : LIVE), le bouton Missions de l'en-tête reste.

**XP, niveaux, badges** (`src/game/xp.js`, calcul pur, testé par `tests/unit/xp.test.mjs` ; accroches dans
`src/game/progression.js`). Barème (`BAREME`) : mission d'installation 25, exercice d'Olivier 60 moins l'aide
(« Fais-le pour moi » −8, indice −3, plancher 20 ; refait 15), présentation d'un poste 20, quiz d'une leçon 30,
notion de la caméra en 3D 15, quiz de chapitre 40, mise en service 100, mission réseau 40 (25 aidée), panne résolue
20 (35 en moins d'une minute), jour de match = son score, atelier 80, car vide brassé 80, mission de l'entrepôt 100,
poste découvert 5, endroit du stade 5. Sept niveaux de technicien : Stagiaire (0), Assistant technique (120),
Technicien (320), Technicien confirmé (650), Ingénieur d'exploitation (1 100), Chef de car (1 700), Directeur
technique (2 500). Badges : 19 badges du simulateur (Premiers pas, Explorateur, Le tour du car, Sans filet,
Sang-froid, Dépanneur, Brasseur, Monteur, Jour de match, Ingénieur réseau, Mise en service, Régie mobile, Curieux,
Érudit, Opticien…) et **un badge par compétence du référentiel**, bronze quand le livret la dit travaillée, or quand
elle est consolidée (`src/livret.js` décide, rien de nouveau à rattacher). Tout est enregistré avec la progression
(`PROG.game`, fusionné entre appareils par `mergeProgress`). Une récompense à clé n'est donnée qu'une fois ; les
pannes, scénarios et exercices refaits rapportent à chaque fois.

**Ce qui se voit** (`src/game/fx.js`) : barre d'XP en haut à droite (niveau, barre, « +25 XP » qui monte, clic =
journal), bannière de niveau et bannière de badge (une à la fois), carte-titre à l'entrée dans un lieu (compound,
car régie), vignette, flash rouge du tally à chaque commutation, alerte rouge à l'injection d'une panne. La carte
joueur (niveau, XP, badges) est sur l'écran titre, l'écran Jouer, le menu du car (Échap) et le journal.

**Bruitages** (`src/game/sfx.js`), synthétisés en WebAudio, aucun fichier : clic de touche, survol du menu,
ouverture et fermeture d'une fenêtre ou d'un poste, validation et refus, étape validée, mission réussie, XP, fanfare
de niveau, badge, alarme de panne, relais de tally à la commutation, bip d'intercom, souffle de téléportation,
bonne réponse de quiz. Réglages → **Jeu** : bruitages activés ou coupés, volume, objectif à l'écran, repère 3D ;
indépendant du son du car. Les événements nouveaux du bus : `modalopen`, `toast`, `layeropen` / `layerclose`,
`faultNew` / `faultSolved`, `teleport`, `quiz`, `camlab`, `netMission`, `scenarioDone`, `xp`, `badge`, `journal`.

**Nouvelle identité visuelle « jeu vidéo »** (`src/styles/theme-jeu.css`, chargée après les autres feuilles) : fond
nuit, panneaux de verre fumé à coins coupés, un trait néon cyan pour l'ordre et la sélection, rouge tally pour
l'antenne, vert pour le prêt, ambre et or pour l'expérience ; titres en capitales espacées. L'écran titre devient
cinématique (scanlines, balayage lumineux, touches qui glissent au survol, aide clavier, carte joueur), l'écran Jouer
a ses cartes et sa grande touche rouge qui pulse, le menu Échap est un menu de pause, les notifications glissent en
haut à droite. Les postes, le Cours et les fenêtres gardent leur organisation et prennent le thème. Les animations
d'entrée ne jouent que sur la position : un navigateur sans compositeur (tests en rendu logiciel) ou en « réduire
les animations » voit tout de suite l'état final. Le contraste des textes secondaires est relevé (suite
`accessibilite`).

Suites : `tests/e2e/jeu.mjs` (titre et Jouer avec la carte joueur, objectif et repère en « Tout à faire »,
journal par L et par le bouton, XP et bannière de niveau, badge « Premiers pas », « Commencer » depuis le journal,
menu, rubrique Jeu des réglages, progression enregistrée, téléphone) ; `navigation` mise à jour (touche Missions,
trois lieux).

## v19.1 : la caméra en 3D, terminée

**Les 51 notions sont écrites.** Le module « La caméra en 3D » (Cours, chapitre La caméra) a maintenant toutes
ses fiches, au moule du lot 1 : l'essentiel, un schéma, une manipulation qui calcule avec deux ou trois défis,
« Comprendre », « Sur la vraie caméra », « Pour aller plus loin », « Dans le car », trois questions d'Olivier
(chaque mauvaise réponse expliquée), les notions liées, la référence et les compétences TIEE. Les neuf
chapitres :

- **L'objectif** (13) : lentille frontale, focale, zoom, point, diaphragme, profondeur de champ, ramping,
  doubleur, macro, tirage optique, défauts optiques, monture B4, objectif en boîte et portable.
- **Les filtres et le prisme** (4) : ND, CC, prisme, passe-bas optique et filtre infrarouge.
- **Les capteurs** (5) : capteur, gain, shutter, exposition, formats et cadences.
- **Le traitement de l'image** (8) : quantification, balances, noir, gamma et black gamma, knee et white
  clip, détail, matrice, fichiers de scène. Le viseur simulé (`camlab/vf.js`) calcule tout ce traitement,
  en virgule flottante, dès qu'une manipulation le demande.
- **Le corps de la caméra** (6) : commandes, menu, connectique, alimentation, tally et intercom, retours.
- **Le viseur et le cadreur** (2) : viseur et ses aides, poste du cadreur (équilibrage, prompteur).
- **La voie caméra** (6) : fibre hybride, CCU, RCP, genlock, signal de sortie, line-up.
- **Jusqu'au moniteur** (4) : forme d'onde, vecteurscope, moniteur de référence, mires.
- **Pour aller plus loin** (3) : grand capteur, UHD et HDR, super ralenti.

Chaque groupe de chapitres a son registre (`camlab/notions/ch1.js` … `ch89.js`), ses schémas
(`camlab/figs/ch*.js`, aides communes `camlab/figkit.js`), ses manipulations (`camlab/labs/ch*.js`), ses
styles (`src/styles/camlab-ch*.css`) et ses tests (`tests/unit/camlab-ch*.test.mjs`). La caméra 3D suit les
manipulations : bagues, doubleur et macro (le moniteur du plateau aussi), lampe de tally du viseur.

**Le suivi.** Une notion est acquise à 3 / 3 du premier coup, comme une leçon du Cours (`camlab/progress.js`,
enregistré avec la progression du stagiaire) : coche dans la liste, « n / 51 acquises », compte par chapitre.
Chaque chapitre finit par un **quiz** de 5 ou 6 questions (`camlab/quiz.js`, 53 en tout) : meilleur score
gardé, notions des questions ratées proposées à revoir. La **mise en service notée** (`camlab/mes.js`) : la
caméra sort de son flight-case, sept postes (objectif, fibre, CCU, RCP, caméra et menu, viseur, plateau), dix
étapes à remettre dans l'ordre, deux éclairages tirés au sort (tungstène, ou plein jour qui demande un ND).
On part de 100 : −8 par erreur d'ordre (le geste est fait quand même, et ses conséquences suivent : une
balance des noirs refaite efface celle des blancs), −5 par erreur de geste, −1 par tranche de 30 s au-delà de
8 minutes (20 points au plus) ; réussie à partir de 60. Le bilan explique chaque erreur et propose les notions
à revoir. Elle se lance depuis la barre du module ou depuis l'exercice pratique **x-camera** de la leçon
« La chaîne caméra » (`camera-systeme`), qui affiche le meilleur résultat ; on revient ensuite à la leçon.

**Liens.** Une fiche qui a sa leçon dans le Cours l'ouvre (« La leçon du Cours : … ») ; « Emmène-moi » mène à
un poste du car. Le livret de compétences compte les notions acquises (sorte « camera » de
`RATTACHEMENT`) ; la mise en service compte pour 1.4, 2.7, 2.9, 2.10 et 3.9.

**Corrections.** La progression du Cours et du module caméra enregistrée sur le serveur n'est plus écrasée par
celle, vide, d'un nouvel appareil (`src/shared.js`, `mergeProgress`). Les feuilles de style de base passent
avant leurs compléments (`camlab.css` avant `camlab-ch1.css`, `tools/build.mjs`). Accessibilité : les pastilles
de la caméra 3D et les prises de la manipulation « connectique » annoncent le nom qu'elles affichent ; la suite
`accessibilite` passe aussi sur le module caméra (liste, six fiches, un quiz, la mise en service).

Suites : `tests/e2e/camera.mjs` ouvre les 51 fiches à 1280 et à 390 px, acquiert une notion, fait un quiz de
chapitre et joue la mise en service jusqu'au bilan ; tests unitaires `camlab*.test.mjs`.

## v19 : TIEE Simulator, trois entrées, des exercices pratiques dans le Cours

**Plus simple : Jouer, Cours, Réglages.** L'application s'appelle **TIEE Simulator**, réalisée par le BTS
Audiovisuel de Saint-Quentin (logo du BTS sur l'écran titre, `src/assets/logo-bts-av.png`), développée par Pierre
MALYCHA (pied de l'écran titre, de l'écran Jouer et « À propos »). L'écran titre (`src/app/title.js`) n'a plus que
trois entrées ; le chef de car et l'espace formateur ne sont plus des entrées à part. Les mêmes trois partout : menu
du car (Échap, `src/app/nav.js` : Reprendre, Cours, Réglages, Équipe en coopération, Retour à l'accueil), pupitre
(Tab : outils du car, Cours, Réglages), barre d'outils (Pupitre, Cours, Son, Menu ; le bouton du chef n'apparaît que
pendant un exercice ou la visite, touche J à tout moment).

**Réglages** (`src/ui/settings.js`) : une seule fenêtre, la même depuis le titre, Jouer et le car. Sur cet
ordinateur (qualité, son), la partie en cours (lumière, éclairage de nuit, voix, étiquettes), le profil Étudiant /
Formateur, l'espace formateur (profil Formateur : configuration du car, suivi des stagiaires, relecture technique),
l'aide (touches, diagnostic, test des performances, signaler une erreur) et « À propos ».

**Jouer** (`src/app/start.js`, `src/styles/jouer.css`) : trois choix numérotés, la touche Antenne à droite.
1. **Le lieu** : le car régie, et la salle de concert en préparation (fiche « Ce qui se prépare »). Le plateau TV et
   la conférence sont retirés ; l'entrepôt deviendra un mode à part (`ROADMAP.md`).
2. **Le mode** : **Car installé** (tout est prêt, on prend l'antenne), **Tout à faire** (stade vide, car non brassé,
   caméras non réglées, réseau de contrôle aux réglages d'usine, `factoryCtrlNet()` ; une liste de tâches se coche
   toute seule : brasser le car, configurer le réseau de contrôle, poser et régler les caméras), **Visite guidée**
   (Olivier fait le tour du car, puis présente chaque poste l'un après l'autre : plan de la visite, « Poste
   suivant » ; proposé d'office au premier lancement).
3. **En équipe** : Solo ou **Coopération**, qui ouvre le **salon** (`src/ui/session_ui.js`, `src/styles/salon.css`)
   comme le lobby d'un jeu en ligne : l'adresse à donner aux autres (réseau local) ou le code (en ligne), le pseudo,
   créer ou rejoindre une partie, et les postes de la prestation avec la personne qui tient chacun ou « Libre ».
Les conditions de captation (lumière, format, car SDI ou IP, qualité, son) sont repliées sous la touche Antenne.

**Le chef de car devient les exercices pratiques du Cours.** Les 42 parcours d'Olivier sont rangés, chacun une
seule fois, dans la leçon qui les explique (`src/cours/exercices.js`, test unitaire) et réécrits en exercices de
cette leçon (titre à l'infinitif, rappel de la leçon, chiffres de la leçon repris dans les étapes). Les exercices
notés y sont aussi : l'atelier de montage (La caméra), le car vide (Le SDI), la formation réseau ST 2110 (Le
réseau), le jour de match (L'exploitation). « Commencer » lance le car si besoin et ouvre l'exercice avec Olivier ;
à la fin, « Revenir à la leçon ». Au poste, la touche J ne propose que les exercices de ce poste. L'ancien espace du
chef (`ui/entrainement.js`) disparaît : ses missions sont la liste de tâches du mode « Tout à faire », son livret
est dans le Cours.

**Le Cours** (`src/ui/cours_ui.js`, `src/styles/cours-suivi.css`) : barre **Leçons · Glossaire · Postes ·
Matériel** (plus d'onglets Chapitres, Procédures ni La caméra), **un seul sommaire** à gauche (les chapitres, leurs
leçons, le module 3D de la caméra dans son chapitre), et au milieu la page **Mon suivi** : leçons acquises,
exercices faits, compétences travaillées, « à faire ensuite », un tableau par chapitre et le livret de compétences.
Dix chapitres et 36 leçons, dans l'ordre d'apprentissage (`cours/index.js`, `ORDER`) : le signal (5), le SDI (6, dont
la grille de commutation), la synchro (référence et genlock, timecode), la caméra (la chaîne caméra, monter une
caméra de stade, et le module 3D), la réalisation (mélangeur, incrustations, ordres), les ralentis (serveur, clips),
le son (la tranche, N-1 et synchro labiale), le réseau (5), la HF (4), l'exploitation (line-up, dépannage, intercom,
transmission, jour de match) ; 46 exercices pratiques en tout. Chaque nouvelle leçon a sa manipulation qui calcule
(mini-mélangeur et barre T, clé linéaire pixel par pixel, trains EVS et levier, N-1, phase H et V d'une source,
conversion de timecode et drop-frame, chaîne caméra et budget d'énergie, équilibrage d'une caméra, grille 6 × 6 aux
ports de la Videohub, parade RVB d'un line-up, dépannage par dichotomie, matrice d'intercom, bascule de
transmission, déroulé d'une journée de match). Chaque leçon cite son article de référence
(l'ancien guide, ouvert par-dessus le Cours) et ses compétences. Les procédures maison du formateur s'affichent sur
« Mon suivi » quand il en a écrit.

**v19.0.1** : sur un téléphone à forte densité d'écran (Android, application Claude), le poste Vision s'arrêtait sur
une erreur : la tuile vecteurscope de l'instrument de mesure, écrasée à quelques pixels, calculait un rayon
négatif. Le vecteurscope ne trace plus rien sur une tuile trop petite, et sous 600 px de large les quatre tuiles
s'empilent à leur hauteur naturelle avec au moins 190 px de trace chacune (`src/ui/prism.js`, `src/styles/prism.css`).
La suite `mobile` ouvre le poste Vision sur un écran ×3 de 426 × 779 et fait passer les 13 affichages de mesure sur
des tuiles minuscules.

Les fichiers à partager s'appellent `TIEE-Simulator.html`, `TIEE-Simulator.exe` et `TIEE-Simulator-partage.zip`.
Suites E2E mises à jour : `navigation`, `cours`, `chef`, `chef-postes`, `fichier`, `navigateurs`, `camera`,
`accessibilite`, `session`, `reseau-local`.

## v18.5 : la caméra de plateau en 3D

**Connaître la caméra, pièce par pièce.** Dans le Cours, l'onglet **La caméra** (`src/camlab/`) ouvre une caméra de
plateau type Sony HXC-FB80 avec son zoom Fujinon ZA12x4.5, construite dans le code (`camlab/model.js`), sur un
plateau avec son coin vision (`camlab/scene.js`). On la tourne à la souris ; 23 pastilles (`camlab/points.js`)
rapprochent la vue et ouvrent une fiche. Les 51 notions (`camlab/notions/`, une fiche par fichier, 9 chapitres de
la lentille frontale au moniteur) suivent un moule : l'essentiel, un schéma SVG (`camlab/figs.js`), une manipulation
sur la caméra (`camlab/labs/` : les bagues de la 3D bougent, l'image du viseur et du moniteur suit, `camlab/vf.js`
simule le viseur et ses zébras, `camlab/optics.js` calcule), l'explication, « sur la vraie caméra », « dans le
car », trois questions d'Olivier, les notions liées, la référence et les compétences TIEE. Le lot 1 est écrit (12
notions) : focale, zoom, point, diaphragme, profondeur de champ, tirage optique, filtres ND, prisme, capteur,
balance des blancs et des noirs, menu, connectique ; menus, procédure ABB/AWB, commutateurs et prises suivent le
mode d'emploi de la HXC-FB80. Les 39 autres notions sont annoncées « en préparation ». Le simulateur se met en pause
pendant le module ; Échap revient au Cours. Maquette autonome : `node tools/camlab-preview.mjs sortie.html
[--local] [--fragment]`. Tests : `tests/unit/camlab.test.mjs`, suite `tests/e2e/camera.mjs`.

## v18.4 : des menus par profil, cinq familles, une section Cours, le livret de compétences

**On ne se perd plus entre formateur, chef de car et joueur.** Deux profils (`src/app/profile.js`), choisis sous
le menu de l'écran titre et mémorisés : **Étudiant** voit Jouer, Cours, Chef de car et Réglages ; **Formateur** a
en plus l'espace formateur, le suivi des stagiaires, la relecture technique et les pannes (éléments `.role-only`).
Les mêmes **cinq familles** partout : l'écran titre (Jouer · Cours · Chef de car · Formateur · Réglages, les
crédits dans Réglages), la feuille de service (liens Cours, Chef de car, Formateur), le menu du car (Échap,
`src/app/nav.js` : Reprendre, Cours, Chef de car, Formateur, Réglages, Commandes, Son, Équipe, Diagnostic, Retour à
l'accueil), le pupitre (Tab : outils rangés par famille), la barre d'outils (Pupitre, Chef de car, Cours, Son,
Menu). L'ancien « Guide du car régie » à huit onglets est réparti (`src/ui/guide.js`) : chapitres, glossaire,
postes, matériel et procédures dans le Cours ; missions dans l'espace du chef de car ; réglages et commandes dans
le menu. La relecture des experts passe par l'espace formateur (onglet « Relecture technique », « Ma relecture »).

**La section Cours** (`src/cours/`, espace `src/ui/cours_ui.js` sur `src/ui/layer.js`, touche G, entrée du titre,
pupitre, menu, bouton « Cours » de chaque poste). Elle s'ouvre en plein écran par-dessus tout le reste, écran titre
compris et pendant le chargement, et se lit sans le stade 3D (téléphone, vidéoprojecteur). Quatre chapitres, 19
leçons, une par terme technique : **Le signal vidéo numérique** (`cours/signal.js` : 4:2:2, 8 ou 10 bits, niveaux
64–940, formats et cadences, espaces de couleur et HDR), **Le SDI** (`cours/sdi.js` : la trame, longueur de câble et
diagramme de l'œil, la falaise numérique, audio et données embarqués, connecteurs et brassage), **Le réseau**
(`cours/reseau.js` : adresse IP et masque, VLAN et commutateur, table MAC, multicast et IGMP, PTP), **La HF**
(`cours/hf.js` : bandes et fréquences, bilan de liaison, antennes et diversité, COFDM). Les adresses, VLAN, plan de
fréquences et portées sont ceux du simulateur (réseau de contrôle, `data/rf.js`, `data/cameras.js`) : l'élève retrouve
les mêmes nombres au poste. Chaque leçon : l'essentiel en trois lignes, un schéma SVG,
une manipulation qui calcule vraiment (une image réellement sous-échantillonnée en 4:4:4 / 4:2:2 / 4:2:0 avec une
loupe, un diagramme de l'œil qui se ferme avec la longueur du câble jusqu'à la falaise numérique, un masque de
sous-réseau, un bilan de liaison HF…), l'explication, « pour aller plus loin », « dans le car » (un bouton lance le
car s'il le faut et ouvre le poste, ou le parcours du chef), les fiches « ? » liées et un quiz de trois questions
dont chaque mauvaise réponse est expliquée ; une leçon est acquise quand le quiz est réussi en entier
(`PROG.cours`, repris dans le livret et le suivi). La recherche trouve les leçons et les 140 fiches « ? » ; les
fiches « ? » proposent la leçon qui les cite et « Ouvrir dans le Cours ». Les liens du Cours avec le reste
(`cours/liens.js`) : chaque terme du glossaire qui a sa leçon ou sa fiche « ? » affiche un bouton « Leçon » ou
« Fiche « ? » » ; le bouton « Cours » d'un poste et la touche G y ouvrent la leçon du poste (baie de mesure : le
diagramme de l'œil ; réseau : adresses et VLAN en car SDI, multicast et PTP en car IP) ; l'onglet Postes donne la
leçon de chaque poste. Un lien vers une leçon pas encore écrite s'allume le jour où elle l'est. Kit des leçons : `cours/kit.js` (SVG, canvas, curseurs, touches,
lectures). Les autres onglets : les chapitres du guide par famille, le glossaire, les postes, le matériel, les
procédures maison. Suite `tests/e2e/cours.mjs` (toutes les leçons).

**L'espace du chef de car** (`src/ui/entrainement.js`) : les parcours d'Olivier par famille avec leur progression
(« Commencer » lance le car si besoin, puis le parcours), les exercices notés (jour de match, car vide, atelier de
montage, formation réseau, installation) avec leur meilleur résultat, les missions d'installation et **Mon livret**.
En cours de partie, lancer une autre vacation recharge le simulateur et la lance directement.

**Le livret de compétences** (`src/content/referentiel.js`, `src/livret.js`, `src/ui/livret.js`) : le référentiel du
BTS MAV option TIEE (fiche RNCP37022), 4 blocs et 39 compétences numérotées 1.1 à 4.5, et le rattachement des
parcours du chef, des missions, des phases du jour de match, des missions réseau, des exercices et des leçons du
Cours à ces compétences. Le niveau de chaque compétence (à travailler, travaillée, consolidée, hors simulateur)
se calcule d'après la progression ; le stagiaire l'ouvre depuis le chef de car ou l'espace du chef, le formateur le
voit pour chaque stagiaire dans l'espace formateur et l'exporte en CSV. Le plan des modules du car qui comblent les
compétences absentes est dans `ROADMAP.md`.

## v18.3 : écran titre, PRISM, grille Videohub, réseau de contrôle du car SDI

**Écran titre et chargement.** La page s'ouvre sur un écran titre (`src/app/title.js`, écrit dans
`index.template.html` pour s'afficher avant même le programme) : menu (entrer dans le car, les lieux, espace
formateur, réglages, crédits), barre de progression réelle (la construction du stade et du car est découpée en
étapes dans `main.js`, les shaders sont compilés avant la première image) et conseils d'Olivier. Un moniteur sur
mire passe au vert quand tout est prêt. « Menu principal » sur la feuille de service y ramène. Les tests entrent
directement sur la feuille de service (harnais), sauf ceux qui vérifient le titre.

**PRISM : l'instrument de mesure** (`src/ui/prism.js`, modèle `src/prism_model.js`). Un instrument façon
Telestream PRISM, en tuiles, au poste vision (préréglage Vision) et dans une nouvelle **baie de mesure** en zone
technique (préréglage Couche physique). Affichages vidéo calculés sur l'image réellement rendue : image, waveform
(Y, YCbCr, parade RVB, mV ou %, curseur), vecteurscope, lightning, diamant, split diamant, arrowhead, CIE 1931,
histogramme. Couche physique depuis un modèle de la liaison SDI : diagramme de l'œil (brut ou égalisé, mesures),
gigue, timing par rapport à la référence, état SDI (CRC, affaiblissement, longueur estimée). 29 fiches « ? » et
13 schémas (`content/terms_mesure.js`, `ui/figs_mesure.js`), 3 parcours d'Olivier (`tutor/lessons/mesure.js`),
2 pannes de liaison (cordon abîmé, touret resté en ligne). Suite `tests/e2e/prism.mjs`.

**Grille Videohub 40 × 40** (`src/videohub.js`, poste `src/ui/st_videohub.js`). En car SDI, la grille est une
Videohub 40 × 40 12G (inspiration Blackmagic) : façade (écran avec la vidéo de la source, touches OUT / IN / TAKE / LOCK,
molette), logiciel Videohub Control (destinations et sources, TAKE, verrouillage des sorties), monitoring vivant des 40
entrées et des 40 sorties (une seule texture, rafraîchissement tournant), matrice pédagogique, Videohub Setup
(réseau, étiquettes, protocole Ethernet TCP 9990 en direct). Le verrou est réel : une sortie verrouillée refuse toute
commutation, d'où qu'elle vienne. Le car a 52 destinations pour 40 sorties : les tuiles 1 à 12 du multiview sont
câblées hors grille, et la baie de brassage est renumérotée en conséquence. 9 fiches « ? », 2 schémas, 2 parcours
d'Olivier, 2 pannes. Le car IP garde son contrôleur NMOS. Suite `tests/e2e/videohub.mjs`.

**Réseau de contrôle du car SDI** (`src/net/ctrlnet.js`, poste `src/ui/st_ctrlnet.js`). En car SDI, le poste
Réseau devient le réseau de contrôle Gigabit : 3 switchs administrables, 49 machines (CCU et RCP, mélangeur, grille,
EVS, intercom, console, SPG…), 7 VLAN, plan d'adressage, QoS, ping, tables ARP et MAC, charge des liens. Fiche
modifiable par machine (adresse, masque, passerelle, VLAN, classe QoS) avec explication et validation de chaque
champ. Onglet Formation « les bases, simplement ». 14 fiches « ? » et 12 schémas, 4 pannes (conflit d'adresse,
mauvais VLAN, mauvais masque, câble), 3 parcours d'Olivier. Le car IP garde son réseau ST 2110. Suite
`tests/e2e/ctrlnet.mjs`.

## v18.2 : le mur des lieux

La feuille de service s'ouvre sur **les lieux** du simulateur, présentés comme un multiview : un écran par
lieu, avec son étiquette et sa lampe de tally. Le car régie est à l'antenne ; un clic sur son écran amène à la
touche « Prendre l'antenne ». Les quatre lieux en préparation (plateau TV, entrepôt, conférence, concert, voir
`ROADMAP.md`) sont sur mire : leurs silhouettes se devinent sous la mire et se précisent au survol, avec trois
indices du métier et la période prévue. Un clic ouvre la fiche « Ce qui se prépare » : ce qu'on y fera, le
matériel annoncé, le guide sur place, et ce qui s'entraîne déjà dans le car en attendant (« Brasser le car »
pour le patch SDI du plateau, par exemple). Les lieux sont décrits dans `src/content/lieux.js`.

## v18.1 : revue pédagogique, vocabulaire du car, accessibilité, icônes

Relecture complète pour des étudiants de BTS MAV option TIEE. Les corrections évidentes sont faites ; les choix qui
changent le contenu ou la pédagogie sont listés dans le rapport de revue (décisions D1 à D16).

**Pédagogie des parcours du chef de car.**

- Chaque geste demandé a 2 ou 3 indices, du principe au réglage exact ; le premier ne donne plus la réponse.
- Les messages de réussite disent à quoi sert le geste dans le car.
- Quiz réécrits : distracteurs tirés des erreurs typiques, explication de l'erreur. Après une mauvaise réponse, le
  chef renvoie à son explication ; après deux, il donne la bonne réponse et son pourquoi, et l'étudiant la choisit.
- Exercice du truquiste : le réflexe est chronométré au départ de la transition (un mix n'est plus pénalisé).
- Erreurs techniques corrigées (PTP, débits et SDP, connecteurs, DSK, atelier).

**Vocabulaire : le jargon du car, expliqué.** Termes expliqués à leur première apparition dans un parcours ; graphies
harmonisées (PGM, PVW, N-1, line-up, multiview, normalé) ; glossaire réécrit (246 entrées, dont 55 nouvelles, triées,
avec un thème), chaque définition dit d'abord à quoi sert le terme dans le car. Les raccourcis annoncés dans la
fiche du mélangeur sont corrigés.

**Interface.**

- Environ 100 libellés repris : boutons qui disent ce qu'ils font, messages qui disent quoi faire, vouvoiement de
  l'interface (seul le chef tutoie).
- Confirmation avant de remplacer ou de démonter les caméras installées.
- Qualité graphique et son rangés « Sur cet ordinateur ».

**Accessibilité (WCAG 2.2 AA).** Le moteur axe-core passe sur 18 écrans (`tests/e2e/accessibilite.mjs`, dans la suite
E2E). Il a fallu reprendre les contrastes (rouge des touches allumées porteuses de texte `--tally-key`, légendes,
entrées non câblées, Vistonics) et les noms accessibles (touches de bus, champs, boutons à symbole seul). Le plan du
car et les zones défilantes sont utilisables au clavier.

**Icônes.** 56 dessins Phosphor (licence MIT, `@phosphor-icons/core`, graisse « bold ») intégrés au fichier par le
chargeur texte d'esbuild (`src/ui/icons.js`, `icon(nom)`), donc hors ligne. On les trouve sur les touches du
pupitre (postes, lieux, outils), dans la barre d'outils, sur les familles et les étiquettes du chef de car et sur les
états (alarmes, parcours faits). Une icône est toujours à côté d'un texte et masquée aux lecteurs d'écran.

**Mémoire 3D.** Après trois tours complets (16 postes, 14 lieux, caméra, plan, matériel), les géométries restent à
258. Les textures plafonnent à 116 : c'est le tampon de 44 images du retour antenne qui se remplit, pas une fuite.

## Ce que contient la v18 : une interface « pupitre broadcast »

Toute l'interface est refaite avec la matière du car régie. L'objectif : qu'on s'y repère plus vite et qu'on
reconnaisse le vrai matériel.

**Les codes de la matière.** Chaque couleur dit un état réel, comme sur un pupitre :

- **Façades** en aluminium anodisé gris-bleu brossé ;
- **touches** à capuchon rétroéclairé, qui s'enfoncent au clic ;
- **afficheurs** en verre noir ;
- **sérigraphie** claire ;
- **LED** :
  - rouge : antenne ;
  - vert : prêt ou fait ;
  - ambre : sélection, ou là où l'on est ;
  - cyan : la voix du chef de car, comme une touche d'intercom.

**Les polices**, intégrées à la page (paquets Fontsource, licence OFL), donc identiques en ligne, en fichier hors
ligne et dans tous les navigateurs :

- **Archivo** pour le texte ;
- **Archivo Narrow** pour la sérigraphie et les titres, en casse normale (plus de capitales espacées, sauf sur les
  touches qui imitent du vrai matériel) ;
- **B612 Mono**, la police des écrans de cockpit, uniquement dans les afficheurs.

**Ce qui change à l'écran** :

- **Accueil** :
  - une grande touche **« Prendre l'antenne »**, avec sa lampe Antenne ;
  - la touche **« Visite guidée avec le chef de car »**, allumée d'office tant qu'on n'a pas fait le tour du car ;
  - les conditions de captation en **sélecteurs à touches** (lumière, format, car SDI ou IP, qualité, son) ;
  - la journée du car en **tranches** comme les bandeaux d'inscription d'une console : installation, atelier,
    car vide, jour de match, grand dispositif.

  Tout tient sur un écran de portable de 1280 × 800. Le pupitre se met sous tension à l'ouverture : les
  afficheurs et les LED s'allument l'un après l'autre (désactivé si le système demande moins d'animations).
- **Le pupitre (touche Tab, ou T)** remplace le menu « Aller à » et le grand plan du car :
  - le plan du car et « vous êtes ici » ;
  - une rangée de touches par zone (cabine son, production, vision et ralentis, technique) ;
  - les endroits du stade et du compound ;
  - les équipiers d'une session ;
  - tous les outils avec leur touche : plan caméras, synoptiques, matériel, guide, chef de car, vol libre, retour
    PGM, son, équipe, réglages, diagnostic.
- **Barre d'outils** : quatre touches (Pupitre, Chef de car, Son, Équipe) sur une réglette vissée. Les raccourcis
  clavier n'ont pas changé.
- **Bande d'état** façon étiquette sous moniteur (UMD) : timecode, score, PGM et PVW avec leurs lampes de tally,
  alarmes.
- **Postes** :
  - bandeau de façade, avec le nom du poste sur sa plaque et le métier en plus petit ;
  - modules en plaques ;
  - journal « Ce qui se passe » sur un afficheur ;
  - sur un portable, les 22 touches d'un bus du mélangeur tiennent sur une ligne.
- **Fenêtres** : des tiroirs de baie, avec une plaque vissée pour le titre et les onglets en rangée de touches à LED.
- **Chef de car** : un panneau d'intercom. Lampe d'ordre cyan, avancement en bargraphe à LED, étiquettes en
  touches allumées (ambre : à toi ; vert : fait ; cyan : indice).
- `tests/e2e/navigateurs.mjs` vérifie aussi le pupitre : Tab l'ouvre, et la touche « Truquiste » emmène au poste
  Mélangeur.

## v17.2 : les erreurs à l'écran, un diagnostic à copier, trois navigateurs testés

Une panne ne passe plus inaperçue :

- **Bandeau « Un problème est survenu »** dès qu'une erreur se produit. Le simulateur continue de tourner, le bandeau ne
  bloque rien. Il signale :
  - une erreur non rattrapée ou une promesse rejetée ;
  - un écouteur d'événement qui plante (les autres écouteurs reçoivent quand même l'événement) ;
  - une image de la boucle de rendu qui plante (l'image suivante repart ; l'erreur est notée une fois, avec son
    nombre de répétitions) ;
  - un message d'erreur d'une bibliothèque (shader refusé par la carte graphique…).
- **Diagnostic technique à copier** (bandeau, feuille de service, Guide → Réglages). Il contient :
  - la version, la page (fichier, claude.ai, réseau local), le navigateur et sa version, l'écran ;
  - la carte graphique et la mémoire graphique utilisée ;
  - les fonctions du navigateur présentes ou absentes ;
  - l'état du simulateur et du chef de car (ouvert, à l'écran, recouvert par un autre élément) ;
  - chaque erreur avec l'endroit où elle s'est produite et sa pile d'appels.
- **Écran de secours au démarrage** : un petit script (`src/boot.js`) s'exécute avant le programme principal. Si
  celui-ci ne peut pas démarrer (navigateur trop ancien, erreur au chargement), une explication s'affiche avec le
  diagnostic à copier, au lieu d'une page vide.
- **Version affichée** sur la feuille de service : on sait quel fichier on a ouvert.

Compatibilité :

- la construction vise explicitement Chrome et Edge 100, Firefox 100 et Safari 15 ; esbuild refuse de construire
  si une syntaxe n'y passe pas ;
- `tests/e2e/navigateurs.mjs` : parcours court (feuille de service, chef de car au clavier et aux boutons, un
  poste, diagnostic, erreurs volontaires, écran de secours), lancé dans Chromium, Firefox et WebKit (moteur de
  Safari) par l'intégration continue à chaque envoi (`E2E_BROWSER=firefox` ou `webkit` en local) ;
- le bouton « Chef de car » de la barre d'outils garde son nom sur les écrans d'ordinateur portable (les autres
  boutons n'y montrent que leur touche).

## v17.1 : le chef de car dès l'ouverture de la page

Dans la version à partager (`Car-regie-3D.html`), on pouvait croire que le chef de car ne se lançait pas :

- sur la feuille de service, il n'y avait **pas de bouton** pour l'appeler, et la touche **J** était ignorée sans
  rien afficher ;
- le chef choisissait les onglets des postes avec le sélecteur CSS `:has()` ; les navigateurs d'avant 2023 ne le
  connaissent pas (Firefox ESR 115, encore courant dans les établissements, Chrome avant la version 105) : le
  panneau s'arrêtait sur une erreur.

Ce qui change :

- **Feuille de service** : une ligne « Première fois ? » avec le bouton **Chef de car** (ou touche **J**). Le chef
  propose de **prendre l'antenne avec lui** : il lance le car prêt à l'antenne et commence le tour du car. Il
  affiche aussi tous les parcours ; en choisir un lance le car (en IP si le parcours le demande), puis le parcours.
- **Premier lancement** (car prêt à l'antenne ou grand dispositif) : le chef se présente de lui-même. Il rappelle
  les gestes de base et propose « Commencer : se repérer ». Il ne le fait qu'une fois par navigateur.
- Le chef n'utilise plus `:has()` dans son code.
- `tests/e2e/fichier.mjs` ouvre le fichier comme un stagiaire qui le découvre : touche J sur la feuille de service,
  clic sur « Prendre l'antenne », présentation du chef, tour du car, puis bouton « Chef de car » à la réouverture.

## v16.1 : le chef de car remarche dans l'application publiée

Le lecteur d'artefacts de claude.ai n'affiche pas les boîtes de dialogue du navigateur : `confirm()` y renvoie
« non » sans rien montrer. Plusieurs boutons ne faisaient donc rien en ligne, alors que tout fonctionnait en local et
dans les tests (qui acceptaient ces boîtes automatiquement) :

- **chef de car :**
  - « Passer le car en IP » : les parcours réseau restaient grisés dans un car SDI ;
  - « Commencer » un parcours quand un autre était en cours ;
  - « Quitter le parcours » sans proposer la remise en état ;
- **poste Réseau IP :**
  - « Sortie d'usine » d'un appareil ;
  - « Config usine » d'un commutateur ;
  - examen réseau, remise à zéro du parcours, missions de dépannage.

Toutes ces confirmations passent maintenant par une fenêtre dans la page. Échap annule, Entrée valide. Les tests de
bout en bout se comportent comme le lecteur de claude.ai : une boîte du navigateur ouverte par la page est comptée
comme une erreur.

## Ce que contient la v16 : un « ? » à côté de chaque terme technique

Dans le poste Réseau IP, les deux onglets (Technique et Exploitation), chaque terme technique a maintenant un petit
bouton **« ? »** :

- en-têtes de tableau ;
- intitulés des mesures et des réglages ;
- titres des cartes ;
- bandeau d'état.

Exemple : la ligne « Gigue (écart-type IAT) » de l'analyseur de flux. Un clic ouvre une **fiche** à côté du bouton.
La fenêtre n'est pas modale : le poste continue de vivre derrière. Au téléphone, la fiche s'ouvre en bas de l'écran.

| Partie de la fiche | Contenu |
| --- | --- |
| Essentiel | L'idée en une phrase, en gras |
| Schéma | Un dessin explicatif quand il aide (21 schémas) : arrivées régulières et réelles pour la gigue, échange Sync / Delay_Req pour PTP, ordre du BMCA, arbre des horloges frontières, ST 2022-7, abonnement IGMPv3 puis PIM, snooping, VLAN et SVI, masque de sous-réseau, encapsulation d'un paquet, en-tête RTP, émetteurs N / NL / W, seaux CINST et VRX, NMOS, ECMP, files QoS, adresse MAC multicast, états OSPF, port miroir |
| Explication | Au niveau BTS, avec les ordres de grandeur |
| Dans le car | Où le voir et le régler dans le simulateur |
| Voir aussi | Renvois vers d'autres fiches, avec un bouton retour |
| Référence | La norme ou la RFC (SMPTE ST 2110, ST 2059-2, ST 2022-7, IEEE 1588, AMWA IS-04 / IS-05, RFC 3376…) |

Les **88 fiches** sont rangées en sept familles :

- ST 2110 ;
- transport et multicast ;
- réseau ;
- PTP ;
- NMOS ;
- mesures ;
- exploitation.

Le bouton **Lexique**, à côté des deux onglets, les regroupe toutes, avec une recherche. Les chapitres du guide sur
ST 2110 et le réseau ont aussi leurs « ? » et leur bouton Lexique. Échap ferme la fiche sans quitter le poste.

**Exactitude.** Seules les valeurs vérifiées sont citées :

- **PTP, profil ST 2059-2 :** domaine 127 par défaut, un Announce toutes les 250 ms, un Sync toutes les 125 ms,
  timeout de 3 Announce.
- **BMCA :** l'ordre de comparaison est celui d'IEEE 1588, vérifié dans l'implémentation linuxptp.
- **IGMPv3 (RFC 3376) :** requête toutes les 125 s, abonnement oublié après 260 s.
- **NMOS IS-04 :** un battement toutes les 5 s, effacement du nœud après 12 s.
- **AES67 (marquage DSCP) :** EF 46 pour PTP, AF41 34 pour les médias.
- **ST 2110-10 :** datagramme UDP de 1 460 octets au plus.
- **ST 2110-21 :** les formules de CMAX et VRX_FULL sont celles de l'analyseur EBU LIST. En 1080p50, avec 4 320
  paquets par image, CMAX vaut 5 et non 4. Un test vérifie que les fiches citent les valeurs que calcule
  l'analyseur du simulateur.
- **ST 2022-7 :** les classes de décalage ne sont pas chiffrées, faute de source sûre.

Tests :

- `tests/unit/netterms.test.mjs` vérifie :
  - que chaque fiche est complète et que ses renvois existent ;
  - que les schémas sont des SVG bien formés ;
  - que les intitulés de l'interface sont reconnus ;
  - les valeurs ST 2110-21.
- `tests/e2e/termes.mjs` vérifie :
  - le « ? » de la gigue et sa fiche avec schéma ;
  - « Voir aussi » et le retour ;
  - Échap, puis le focus rendu au bouton ;
  - les boutons dans chaque onglet ;
  - les mesures en direct, dont les boutons restent en place ;
  - le lexique et sa recherche ;
  - la fenêtre SDP et le guide ;
  - l'affichage au téléphone.

## Ce que contient la v15 : le poste Réseau IP en deux onglets

Le poste Réseau IP était devenu touffu : huit onglets, des sous-onglets, deux lignes d'indicateurs. Il a maintenant
**deux grands onglets** et un bandeau d'état sur une seule ligne (réseaux rouge et bleu, grand maître PTP, nœuds
NMOS, réceptions, alarmes).

**Technique** reprend tout l'existant, rangé dans une seule barre : topologie, commutateurs (interface graphique et
terminal), plan d'adressage, flux NMOS · SDP, PTP, mesures, diagnostic, formation.

**Exploitation** est une interface épurée, dans l'esprit des interfaces web des passerelles et des contrôleurs de
diffusion. Elle a quatre vues :

| Vue | Ce qu'on y fait |
| --- | --- |
| Connexions | Choisir une source (émetteur) et une destination (récepteur), puis connecter par NMOS (IS-05) ou saisir à la main, pour chaque réseau, l'adresse de la source, le groupe multicast et le port UDP. Le bandeau montre deux moniteurs : la **source** et ce que la **destination reçoit vraiment** (une autre caméra si l'on s'est trompé de groupe, « pas de flux » avec la cause sinon). |
| Appareils | Pour chaque appareil, quatre voyants (média A, média B, PTP, NMOS) et sa page de réglages : adresse, masque et passerelle des cartes média rouge et bleue, adresse de contrôle et registre NMOS, domaine PTP et mode esclave, adresses multicast et port de ses émetteurs. « Appliquer », « Annuler », « Sortie d'usine ». |
| PTP | Grand maître élu sur chaque réseau (identité, classe, priorités), état de chaque appareil (verrouillé, instable, non traçable, pas de maître), décalage et délai moyen, courbe du décalage. |
| NMOS | Registre (IS-04, IS-05), nœuds enregistrés avec leur adresse de contrôle et leur battement, connexions actives (IS-05 ou manuelles). |

Tout agit sur le même modèle que l'onglet Technique. Ce que vérifie le moteur :

- **Récepteur réglé à la main :**
  - le couple (source, groupe) doit exister : sinon le filtre SSM ne laisse rien passer ;
  - le port UDP doit être le bon : sinon les paquets arrivent mais sont ignorés ;
  - les jambes rouge et bleue doivent porter le même flux pour être fusionnées (ST 2022-7) ;
  - une connexion NMOS remplace la saisie manuelle.
- **Enregistrement NMOS :** il dépend de l'adresse de contrôle, du masque, de la passerelle et de l'adresse du
  registre saisis dans l'appareil. La cause d'un échec est donnée.
- **Exactitude :** une **passerelle** ou un **masque** faux sur une carte média n'est plus bloquant, mais un simple
  avertissement. En effet, le multicast ST 2110, les rapports IGMP et PTP restent sur le lien local. Une adresse hors
  du sous-réseau, elle, coupe les flux (contrôle RPF de la leaf).

Nouveau parcours du chef de car, **« Mettre en service une passerelle (interface web) »** :

1. la passerelle des écrans d'angle sort d'usine ;
2. on règle depuis son interface les adresses A et B, le contrôle et le registre NMOS, puis le domaine PTP 127 ;
3. on l'abonne à la main au clean feed et on vérifie au moniteur ;
4. on coupe la jambe bleue pour voir la protection ST 2022-7 à l'œuvre ;
5. on rend la main au contrôleur NMOS.

Le chef sait désigner l'onglet Technique ou Exploitation quand la cible est dans l'autre.

Tests :

- `tests/unit/exploitation.test.mjs` couvre :
  - les saisies manuelles justes et fausses ;
  - les adresses des cartes ;
  - NMOS ;
  - le réadressage d'un émetteur ;
  - la sortie d'usine.
- Le nouveau parcours est rejoué de bout en bout en test unitaire.
- `tests/e2e/reseau-ops.mjs` passe par l'interface :
  - connexion NMOS ;
  - saisies manuelles ;
  - sortie d'usine et remise en service ;
  - vues PTP et NMOS ;
  - parcours du chef.

## Ce que contient la v14 : une version à partager

Pour donner le simulateur à un collègue sans passer par claude.ai, `npm run exe` produit un **kit de partage**,
`dist/Car-regie-3D-partage.zip`, avec un mode d'emploi (`partage/LISEZMOI.txt`) et les licences :

| Fichier | Pour qui | Ce qu'il fait |
| --- | --- | --- |
| `Car-regie-3D.html` (1,8 Mo) | tout ordinateur (Windows, macOS, Linux) | Double-clic : le simulateur s'ouvre dans le navigateur, sans Internet ni installation (three.js est inclus). Tout fonctionne en solo, chef de car compris ; la progression reste dans le navigateur. Assez léger pour un courriel |
| `Car-regie-3D.exe` (84 Mo) | Windows 10 / 11 | Double-clic : le serveur réseau local démarre et le navigateur s'ouvre sur le simulateur. Les autres ordinateurs du réseau rejoignent la partie à l'adresse affichée, sans rien installer. Un second double-clic rouvre la page ; si le port 8080 est pris, le suivant est utilisé ; sur une erreur, la fenêtre reste ouverte pour la lire |

L'exécutable est une *single executable application* Node.js (`tools/exe.mjs`) :

1. le serveur réseau local, page incluse, est regroupé en un seul script (esbuild) ;
2. ce script devient un blob SEA ;
3. le `node.exe` officiel de la même version (empreinte SHA-256 vérifiée) perd sa signature, reçoit le blob
   (postject), puis le nom, la version et l'icône du simulateur (resedit, icône `lan/car-regie-3d.ico` dessinée par
   `tools/icon.mjs`) ;
4. l'outil contrôle le résultat : blob intact, fusible activé, sections disjointes.

`node tools/exe.mjs --verifier` lance en plus le même blob dans le Node de la machine (Linux) et l'interroge.
L'exécutable a aussi été essayé sous Wine 9 : page servie, deux joueurs connectés en WebSocket, ordres relayés,
compte rendu enregistré, second lancement, port occupé.

L'exécutable n'est pas signé numériquement. À la première ouverture, Windows SmartScreen demande
« Informations complémentaires » puis « Exécuter quand même ». Les messageries bloquent souvent les `.exe`, même
zippés : on passe par un partage de fichiers (OneDrive, Teams, WeTransfer…) ou une clé USB. Le fichier HTML seul
passe par courriel.

Autres changements : le serveur réseau local accepte `--ouvrir` (ouvre la page dans le navigateur) et prend le port
suivant quand 8080 est occupé, sauf si un port est imposé (`--port`). Ouverte en fichier, la page explique, dans
« Jouer à plusieurs », quoi lancer pour jouer à plusieurs. Un test de bout en bout (`tests/e2e/fichier.mjs`) ouvre
la version HTML en `file://`, sans réseau : démarrage, rendu, chef de car, progression retrouvée après réouverture,
aucune requête réseau.

## Performances

Le profileur intégré (ajouter `?perf` à l'adresse) affiche le temps de chaque sous-système de la boucle
principale ; `tools/perf-profile.mjs` le relève dans trois situations (dans le stade en marchant, dans le car en
marchant, au poste mélangeur). Mesures de la v12, Chromium en rendu logiciel (SwiftShader, `?lite`), deux passages
alternés par version, 45 s par situation :

| Situation | Images en 45 s (v11 → v12) | Temps processeur par image (v11 → v12) |
| --- | --- | --- |
| Stade | 52 → 58 (+11 %) | 657 → 187 ms (−72 %) |
| Car | 66 → 65,5 (=) | 578 → 76 ms (−87 %) |
| Poste mélangeur | 78,5 → 75 (−4 %, dans le bruit de mesure) | 422 → 11 ms (−97 %) |

Ce que le profileur a montré : la logique (match, caméras, joueur, visée, barre d'état) coûte moins de 2 ms par
image ; presque tout le temps passait dans la lecture synchrone des pixels des mesures d'exposition et du waveform,
qui oblige le processeur à attendre que la carte graphique ait fini de rendre toutes les caméras. Depuis la v12 :

- ces lectures sont asynchrones (`src/readback.js` : tampon PBO et barrière WebGL 2, résultat lu à une image
  suivante) : le processeur ne bloque plus, ce qui laisse travailler en parallèle processeur et carte graphique ;
- le multiview n'est redessiné à chaque image que lorsqu'on peut le voir (car, poste, plan), deux fois par seconde
  sinon, et hors du car une seule caméra « de fond » est rendue par image (pour les mesures) ;
- la barre d'état et le viseur du cadreur ne reconstruisent plus leur DOM, la marche et la visée n'allouent plus
  d'objets à chaque image.

En rendu logiciel, la carte graphique simulée reste le goulet d'étranglement : le gain en images n'apparaît que dans
le stade, où moins de rendus sont demandés. Sur une vraie carte graphique, la suppression des attentes rend
l'affichage plus régulier (moins d'à-coups 4 à 8 fois par seconde).

## Construire et tester

```
npm install
npm run build        # dist/index.html (page publiée), Car-regie-3D.html (à partager), serveur autonome et archive réseau local
npm run exe          # en plus : Car-regie-3D.exe (Windows, sans installation) et le kit Car-regie-3D-partage.zip
npm run build:dev    # même chose sans minification
npm run lint         # ESLint
npm run typecheck    # TypeScript (navigateur + Node)
npm test             # tests unitaires (node:test, ≈ 2 s)
npm run check        # les quatre à la suite (ce que fait l'intégration continue)
npm run test:e2e     # tests de bout en bout (Playwright, rendu logiciel : 26 suites, ≈ 90 min)
npm run serve:lan    # serveur réseau local (après la construction) : http://localhost:8080
```

Tests de bout en bout : `node tools/e2e.mjs --list` liste les suites, `node tools/e2e.mjs reseau session` n'en
lance que certaines (début du nom). Chaque suite garde son journal et ses captures dans `test-results/`. Une
suite se lance aussi seule : `node tests/e2e/<suite>.mjs [dossier] [options]` (options en tête de fichier).
Playwright n'est pas une dépendance du projet : le harnais prend celui du projet s'il est installé, sinon
l'installation globale de npm (`npm install --no-save playwright` puis `npx playwright install chromium`).

Outils :

```
node tools/perf-profile.mjs [page.html] [secondes]   # temps par sous-système (stade, car, poste)
node tools/netcli.mjs HD LEAF-R1 'sh ip route;;sh ptp'   # modèle réseau et CLI sans navigateur
node tools/gfx.mjs [dossier] haute jour   # captures de référence du rendu
node tools/shots.mjs dossier 1280 800 '["vision","hf"]'   # captures de postes
```

## Organisation du code (`src/`)

| Fichier | Rôle |
| --- | --- |
| `main.js` | Point d'entrée : initialisation du monde et du car, événements de l'application, boucle principale |
| `boot.js` | Filet de sécurité du chargement, script classique placé avant le programme : note les premières erreurs, écran de secours avec diagnostic si le programme ne démarre pas |
| `diag.js` | Journal des erreurs (partagé avec `boot.js`) : erreurs non rattrapées, écouteurs d'événement, boucle de rendu, `console.error` ; version de l'application |
| `ui/diag_ui.js` | Bandeau « Un problème est survenu » et fenêtre « Diagnostic technique » (texte à copier) |
| `game/xp.js`, `game/progression.js` | Progression du joueur : XP (barème par activité), niveaux de technicien, badges (dont un par compétence du livret), fusion entre appareils ; accroches sur les événements du simulateur |
| `game/quest.js` | L'objectif à l'écran (exercice, mission d'installation, phase du jour de match, visite, missions du poste), le repère 3D, le journal des missions (touche L), la carte joueur |
| `game/fx.js`, `game/sfx.js` | Effets de jeu (barre d'XP, bannières de niveau et de badge, carte-titre, vignette, flash tally, alerte de panne) et bruitages synthétisés en WebAudio avec leur réglage |
| `styles/theme-jeu.css` | Le thème « jeu vidéo » : jetons de couleur, composants communs, HUD, écran titre, Jouer, menu, journal, badges |
| `ui/pupitre.js` | Le pupitre (Tab ou T) : plan du car, touches des postes par zone, endroits du stade, équipiers, outils |
| `app/title.js` | Écran titre TIEE Simulator : logo du BTS, trois entrées (Jouer, Cours, Réglages), progression du chargement, conseils d'Olivier, mentions |
| `ui/settings.js` | Réglages : une seule fenêtre (ordinateur, partie en cours, profil, espace formateur, aide, à propos) |
| `app/profile.js` | Profil Étudiant / Formateur, mémorisé ; classe `role-formateur` sur `body`, éléments `.role-only` |
| `cours/index.js`, `cours/kit.js`, `cours/all.js`, un fichier par chapitre (`signal.js`, `sdi.js`, `synchro.js`, `camera.js`, `realisation.js`, `ralentis.js`, `son.js`, `reseau.js`, `hf.js`, `exploitation.js`) | La section Cours : dix chapitres et leurs leçons, ordre d'apprentissage, progression, kit des schémas et manipulations |
| `cours/exercices.js` | Les exercices pratiques de chaque leçon : parcours d'Olivier (chacun dans une seule leçon) et exercices notés (atelier, car vide, formation réseau, jour de match), leur état |
| `cours/liens.js` | Les liens du Cours avec le reste : terme du glossaire → leçon ou fiche « ? », poste → leçon (bouton « Cours », touche G) |
| `cours/sdi_falaise.js`, `cours/lab_sdi.js`, `cours/figs_sdi.js` | Leçon « La falaise numérique » : diagramme de l'œil et image qui casse avec la longueur du câble, défis d'Olivier |
| `camlab/` | Module « La caméra en 3D » : caméra et plateau construits dans le code (`model.js`, `scene.js`), pastilles (`points.js`), 51 notions (`notions/`, une fiche par fichier, registres `ch1.js` … `ch89.js`), schémas (`figs.js`, `figs/`, `figkit.js`), manipulations (`labs.js`, `labs/`, commandes `controls.js`, optique `optics.js`, viseur simulé et traitement de l'image `vf.js`), affichage d'une fiche (`fiche.js`), progression (`progress.js`), quiz de chapitre (`quiz.js`), mise en service notée (`mes.js`) |
| `ui/cours_ui.js` | L'espace Cours : un seul sommaire, page « Mon suivi » (progression, à faire ensuite, livret), leçons (quiz, exercices pratiques, article de référence), glossaire, postes, matériel |
| `app/nav.js` | Navigation entre les trois entrées : menu du car (Échap), aiguillage des boutons « Aller au poste », « Commencer » (car lancé si besoin), changement de vacation |
| `ui/layer.js` | Espace plein écran (le Cours) : plaque, onglets, Fermer (Échap), ligne d'état |
| `ui/guide.js` | Missions d'installation (liste des tâches), articles de référence des leçons, glossaire, postes, matériel, procédures maison, commandes |
| `content/referentiel.js` | Référentiel du BTS MAV option TIEE (fiche RNCP37022) : 4 blocs, 39 compétences numérotées 1.1 à 4.5, couverture par le car et modules qui la complèteront ; rattachement des parcours, missions, phases du jour de match, missions réseau, exercices et leçons |
| `livret.js`, `ui/livret.js` | Livret de compétences : niveau de chaque compétence calculé d'après la progression (à travailler, travaillée, consolidée, hors simulateur) ; affiché sur la page « Mon suivi » du Cours, depuis le chef de car et pour chaque stagiaire dans l'espace formateur, export CSV |
| `prism_model.js` | Modèle de la liaison SDI pour le PRISM : normes, points de mesure, œil, gigue, timing, pannes |
| `videohub.js` | Modèle de la grille Videohub 40 × 40 : plan des ports, étiquettes, verrous, protocole, pannes |
| `ui/st_videohub.js` | Le poste Grille en car SDI : façade, Videohub Control, monitoring, matrice, Setup |
| `net/ctrlnet.js` | Réseau de contrôle Gigabit du car SDI : switchs, machines, VLAN, QoS, ping, tables, pannes |
| `ui/prism.js` | L'instrument de mesure en tuiles (poste vision et baie de mesure) |
| `ui/prism_station.js` | La baie de mesure (poste `mesure`) |
| `ui/st_ctrlnet.js` | Le poste Réseau de contrôle (car SDI) : six onglets |
| `content/lieux.js` | Les lieux de l'écran Jouer : le car régie, la salle de concert en préparation (fiche « Ce qui se prépare ») |
| `ui/icons.js` | Icônes Phosphor intégrées au build (`icon(nom)`), toujours à côté d'un libellé |
| `tutor/` | Chef de car : moteur des parcours (`engine.js`), lecture du réseau pour expliquer et vérifier (`net_helpers.js`), parcours réseau ST 2110 (`lessons/reseau.js`, `lessons/reseau_leaf.js`, `lessons/reseau_ops.js`), parcours des postes, compétences et matériel (`lessons/realisation.js`, `image.js`, `ralentis.js`, `son.js`, `liaisons.js`, `exploitation.js`, `materiel.js`, outils communs `kit.js`), présentation de chaque poste (`lessons/postes.js`) |
| `ui/tutor_ui.js` | Panneau du chef de car : exercices du poste où l'on est, visite guidée (tour du car puis chaque poste), retour à la leçon du Cours, étapes, mise en évidence, gestes « Fais-le pour moi » hors des postes (caméra, visionneuse, atelier), commandes vers le terminal, voix |
| `app/` | Application : vue et qualité graphique (`view.js`), joueur et déplacements (`player.js`), visée et interactions (`interact.js`), cadreur (`camop.js`), téléportation et postes (`teleport.js`), barre d'outils et d'état (`hud.js`), clavier / souris / tactile (`input.js`), écran Jouer, modes et lancement (`start.js`), diagnostic de performance (`perf.js`), profileur `?perf` (`profiler.js`) |
| `data/` | Catalogues techniques : caméras, objectifs, liaisons, formats (`cameras.js`) ; positions et antennes du stade (`stadium.js`) ; HF COFDM (`rf.js`) ; exposition et lumières (`exposure.js`) ; équipes (`match.js`) |
| `content/` | Contenus pédagogiques : fiches de poste (`stations.js`), glossaire (`glossary.js`), fiches des termes réseau et ST 2110 (`netterms.js`), chapitres du guide (`guide.js`), commandes (`controls.js`) |
| `state.js` | État partagé de la simulation (`S`) et bus d'événements (`on` / `emit`) |
| `truck.js` | Intérieur du car : plan, postes, écrans, baies et pupitres détaillés, collisions |
| `equip.js` | Profil matériel (XVS-6000, XT4K, LSM, IPDirector) et répartition des canaux EVS |
| `world.js` | Stade, éclairage, public, compound et extérieur du car |
| `render.js` | Rendu physique : conversion des matériaux, environnement (ciel capturé, studio du car), post-traitement de la vue « œil » |
| `people.js` | Joueurs et arbitres articulés : géométries, tenues (nom et numéro), visage, animation de course |
| `landscape.js` | Sol jusqu'à l'horizon (carte des parcelles), arbres instanciés, terrils |
| `vehicles.js` | Semi-remorque régie, tracteur, camion satellite, groupe électrogène, bungalows, enrobé |
| `params.js` | Registre des valeurs chiffrées relisibles (objectifs, liaisons, C/N, latences, line-up) et corrections appliquées |
| `multi/` | Jeu à plusieurs : session, rôles, hôte du match, pseudos (`session.js`), tranches d'état partagées (`slices.js`), client du serveur réseau local (`lan.js`), avatars des joueurs (`avatars.js`), fiches de rôle et objectifs (`roles.js`) |
| `lan/` | Serveur réseau local sans dépendance (HTTP + WebSocket, parties, comptes rendus), lanceurs Windows / macOS / Linux, mode d'emploi |
| `match.js` | Simulation du match, rendu des joueurs, enregistrement d'état (base des ralentis EVS) |
| `bcam.js` | Caméras broadcast : optique, cadreurs automatiques, traitement CCU (knee, white clip, HLG), câbles |
| `rf.js` | Bilan de liaison HF, diversité, brouillage |
| `pipeline.js` | Grille, mélangeur, EVS, multiview, retour antenne, mesures (waveform, vecteurscope), HDR |
| `patch.js` | Baie de brassage : liaisons attendues, résolution des signaux, score |
| `ipnet.js` | Car IP : façade simple (état des réseaux, PTP, NMOS) et pannes réseau |
| `net/fabric.js` | Réseau ST 2110 : topologie spine-leaf rouge / bleu, configurations des commutateurs, moteur d'évaluation (liens, OSPF, PIM-SSM / IGMPv3, bande passante, ST 2022-7, PTP BMCA, NMOS), SDP |
| `net/cli.js` | Ligne de commande des commutateurs (syntaxe de type EOS / NX-OS) |
| `net/analyzer.js` | Instruments : analyseur de flux ST 2110-21 / 2022-7, suivi PTP, capture de paquets décodée |
| `net/course.js` | Parcours de formation réseau : missions vérifiées, quiz, examen noté |
| `audio.js` | Console son (inspiration Vista 1) : sources synthétisées, patch, chaîne DSP par tranche, bus et N-x, VCA, écoutes, snapshots, retard de ligne, embedder, loudness, corrélation, pannes son |
| `commentary.js` | Commentaires du match (commentateur, consultant, bord terrain, plateau) par synthèse vocale, volume suivant la console |
| `audiodesk.js` | Console son en 3D dans la cabine (faders motorisés, FaderGlow, écrans Vistonics animés) |
| `scenario.js` | Scénario « jour de match » chronométré et noté |
| `shared.js` | Données partagées de la page publiée (configuration, progression) avec repli local |
| `review.js` | Points techniques à faire relire par le formateur |
| `gfx.js` | Habillage (score, bandeaux, statistiques) |
| `atelier.js` | Atelier de montage de la CAM 1 : pièces, ordre des opérations et prérequis, visée, fantômes, gestes maintenus, réglages à la molette, mise en service, rapport |
| `ui/` | Session et salon de coopération (`session_ui.js`), relecture (`review_ui.js`), réseau IP (`st_network.js` : onglet Technique, `net_ops.js` : onglet Exploitation, `net_tools.js`, `net_course.js`, `term.js` et `term_figs.js` : boutons « ? », fiches et schémas), synoptiques (`synoptics.js`), plan du car (`truckmap.js`), postes (`stations.js`, `st_audio.js`, `commut.js`, `st_vision.js`, `st_evs.js`, `st_mixer.js`, `st_ipd.js`, `st_patch.js`), espace formateur (`config.js`), rapports (`report.js`), plan, guide, missions |
| `equipment/` | Visionneuse de matériel : appareils (`devices.js`), liste de câblage (`cabling.js`), rendu SVG et photos (`viewer.js`) |
| `faults.js`, `exercises.js` | Simulateur de pannes, réalisateur virtuel et opérateur EVS automatique |

Hors de `src/` :

| Dossier | Rôle |
| --- | --- |
| `lan/` | Serveur réseau local (voir plus haut), icône de l'exécutable Windows |
| `partage/` | Mode d'emploi du kit de partage (HTML autonome et exécutable Windows) |
| `tests/unit/` | Tests unitaires `node:test` ; `tests/helpers/` (DOM minimal, scène vide, réseau de test), `tests/register.mjs` (chargement des fichiers texte comme esbuild) |
| `tests/e2e/` | Tests de bout en bout Playwright et leur harnais |
| `tools/` | Construction (`build.mjs`, `zip.mjs`), exécutable Windows et kit de partage (`exe.mjs`, `icon.mjs`), lanceur des tests de bout en bout (`e2e.mjs`), mesures et captures |
