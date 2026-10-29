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

## v19.21 : une interface plus nette, tutoyée, et des bruitages de studio

**Pourquoi.** Un premier lancement au profil Étudiant, relu capture par capture, montrait des défauts qu'un débutant
voit tout de suite : Olivier passait devant le menu Échap (« Retour à l'accueil » caché) et devant le téléphone ; sur
l'écran titre, le conseil d'Olivier recouvrait la mire ; les heures s'écrivaient « 20: 44: 50 » ; l'interface vouvoyait
ici et tutoyait là ; les bruitages sonnaient « jeu d'arcade ». C'est le premier lot de la refonte des interfaces ; le
premier lancement (lot 2) et la charte (lot 3) sont proposés en maquettes (ROADMAP.md).

**Olivier à sa place** (`ui/tutor_ui.js`, `etage()` ; `styles/chef-dialogue.css`). La boîte de dialogue :

- passe sous une fenêtre ouverte (menu Échap, réglages, synoptiques…), sauf quand l'étape en cours se joue dedans
  (« Suivre le câble », dans la visionneuse de matériel) ;
- se range à gauche du téléphone levé ;
- dans le car, se pose au-dessus de la bande d'état (timecode, PGM, alarmes) et se centre dans la place que laisse le
  retour PGM.

**L'écran titre.** Le moniteur (la mire), le niveau et le conseil d'Olivier s'empilent dans la colonne de droite : les
zones de l'ancienne grille (`menu.css`) les plaçaient l'un sur l'autre.

**La ponctuation des chiffres.** B612 Mono cale le deux-points, le point et la virgule à gauche d'une case entière :
« 20: 44 », « 192. 168. 1. 23 », « 1, 5 dB ». Une famille « TIEE Ponctuation » (Archivo, limitée à ces trois signes
par `unicode-range`, `tools/build.mjs`) passe devant B612 Mono dans `--f-mono` : « 20:44 », « 192.168.1.23 ». Les
colonnes restent alignées (chaque valeur d'une colonne a autant de signes).

**Réglages.** Les choix sont dans le même ordre partout (Affiché, puis Masqué) ; la note qui renvoyait au « pupitre
(Tab) », remplacé par le téléphone en v19.9, renvoie à l'application Aller à.

**Le tutoiement partout** (décidé le 29 octobre 2026). Olivier tutoyait, l'interface vouvoyait. Environ 1 500 formes
converties dans 130 fichiers, conjugaison comprise (« Que faites-vous ? » → « Que fais-tu ? », « vous préparerez » →
« tu prépareras », « Approchez-vous » → « Approche-toi ») : Jouer, suivi des tâches, téléphone, postes, Cours (leçons,
quiz, exercices en autonomie, exercices pratiques), vues 3D, entrepôt, émission, coopération. Restent au vouvoiement :
ce qui s'adresse au formateur (espace formateur, consignes du rôle formateur en coopération) et au relecteur
professionnel (fiche de relecture), et les personnages qui parlent à d'autres que l'élève (la chaîne et le stade à
l'intercom, les commentateurs, la publicité, la box qui « propose » une adresse à la machine).

**Des bruitages de studio** (`game/sons.js`, recettes en calcul pur ; `game/sfx.js`, le moteur WebAudio). Trente-cinq
sons au lieu de seize, sur une palette de régie plutôt que d'arcade :

- ni onde carrée ni dents de scie : des cloches en synthèse FM (verre, métal doux), des « bois » (marimba), des
  souffles filtrés et des clics ;
- les notes tenues sont toutes en ré majeur pentatonique : deux sons qui se suivent ne jurent jamais ;
- une chaîne de sortie commune : coupe-bas 40 Hz, coupe-haut 11 kHz, compresseur, réverbération courte calculée
  (1,1 s, aigus amortis) ; les clics varient de ± 3 % pour ne pas sonner « mitraillette » ;
- des niveaux hiérarchisés (crêtes mesurées, volume des bruitages au maximum) : le survol vers −42 dBFS, un clic vers
  −30, une information ou une réussite vers −21 à −14, un passage de niveau vers −6.

Nouveaux : la touche principale, une application du téléphone, un onglet, un interrupteur (il monte quand on allume,
descend quand on éteint), une carte de Jouer, un repli, le curseur de volume (un cran, plus aigu vers le haut), le
téléphone levé et rangé (à droite, comme lui), s'asseoir à un poste, le Cours en plein écran, une information,
Olivier qui parle, une tâche cochée, un niveau du Cours ouvert, une caméra posée, le lancement d'une partie, le top
antenne de l'émission (deux bips courts et un long à 1 kHz) et la fin d'antenne. Le refus reste discret (deux bois
graves, sans buzzer).

**Tests.** `tests/unit/sons.test.mjs` (palette : genres de voix, niveaux, durées, notes dans la gamme, survol le plus
discret) ; `tests/e2e/sons.mjs` rend chaque son hors ligne dans le navigateur (ni saturé ni muet), vérifie les gestes
(carte, interrupteur, curseur, fenêtre, bruitages coupés) et écrit la **planche d'écoute** (`planche-sons.wav`, tous
les sons à la suite, et `planche-sons.txt`) ; `tests/e2e/superpositions.mjs` (écran titre, Olivier sous le menu, à côté
du téléphone, hors de la bande d'état et du retour PGM, devant la fenêtre d'une étape ; la ponctuation des chiffres).

## v19.20 : un match qui ne se joue pas d'avance, de vrais adversaires, l'équipe à ses postes, un compound qui vit

**Pourquoi.** Quatre retours après l'émission en direct : au début d'un match, trois joueurs tournaient autour du
ballon sans jamais le toucher et le jeu s'arrêtait ; le match était toujours le même (Lens gagnait à chaque fois) ; le
car était vide de monde, on ne voyait personne aux postes ; au compound, des fils flottaient en l'air.

**Le match ne se fige plus** (`match.js`). Un joueur ne prenait le ballon qu'à 0,6 m, alors que les joueurs se
repoussent à moins de 1,2 m : deux ou trois joueurs pouvaient entourer un ballon arrêté, chacun à 0,7 m, et rester là.
Le receveur d'une passe ratée courait vers la cible de la passe, loin du ballon ; la passe du coup d'envoi (10 m/s)
s'arrêtait avant le milieu. Désormais : un ballon lent se contrôle à 0,95 m (pied tendu), les joueurs qui disputent un
ballon libre ne se repoussent plus entre eux, la passe ratée libère son receveur, la passe du coup d'envoi est dosée
pour arriver, et un filet de sécurité rend le ballon au joueur le plus proche s'il reste libre et arrêté plus de 1,5 s.
Le test rejoue un match réellement figé par l'ancienne IA, relevé dans une série de simulations.

**Un match tiré à chaque partie.** La simulation partait toujours de la même graine : on revoyait le même match. Chaque
partie (et chaque avant-match de l'émission) tire maintenant une graine nouvelle et, à partir d'elle, le **tirage du
match** (`tirerMatch`, calcul pur) :

- la **forme du jour** de chaque équipe (un écart-type de 0,045 sur une force de l'ordre de 0,45) ;
- le **style** de la rencontre : fermé (une fois sur quatre, moins de tirs), équilibré, ouvert (trois fois sur dix,
  30 % de tirs en plus) ;
- les **temps forts** : des phases de une à quatre minutes de jeu où l'une des équipes pousse (l'équipe la plus forte
  pousse plus souvent, pas toujours).

La force d'une équipe à un instant = son niveau × 0,6 + sa forme + l'avantage du terrain (+0,02 pour Lens) + le temps
fort en cours. L'**ascendant** (l'écart des deux forces, borné à ±0,35) pèse sur la fréquence et la précision des tirs,
les tacles et les arrêts du gardien. Ordre de grandeur mesuré sur 50 émissions simulées (deux périodes de 10 min) :
contre Lille, Lens gagne 44 % du temps, fait match nul 30 %, perd 26 % ; contre Metz, 62 / 22 / 16 ; contre le Paris SG,
12 / 40 / 48 ; environ deux buts par émission. La même graine rejoue le même match (tests). Le consultant
présente la rencontre d'après le tirage (favori, équipe en confiance).

**Les adversaires** (`data/clubs.js`, `adversaire.js`). Dix-sept clubs de Ligue 1 : Paris SG, Olympique de Marseille,
AS Monaco, LOSC Lille, Olympique lyonnais, OGC Nice, RC Strasbourg, Stade rennais, Stade brestois, Toulouse FC, Paris
FC, FC Nantes, AJ Auxerre, FC Lorient, Angers SCO, Le Havre AC, FC Metz. Leur nom et leurs couleurs, dans la tenue
portée à Bollaert (choisie pour trancher sur le maillot or et les manches rouges des Lensois : l'OM en blanc et bleu
ciel, Lille en blanc et marine, Nantes en vert…) ; **pas de blason ni de logo** ; des **joueurs fictifs** (onze noms
tirés d'une liste, toujours les mêmes pour un club) ; un **niveau de jeu fictif**, propre au simulateur, qui ne prétend
pas classer les clubs. Dans Jouer → Car pré-installé : « L'adversaire » (tiré au sort par défaut, ou choisi) ; l'affiche
du soir en tête de l'écran suit. L'adversaire habille les joueurs et le parcage visiteurs, passe dans le bandeau du
score, l'habillage (titre du match), les commentaires et le générique ; en coopération, l'hôte le transmet avec le
match. Simulation non officielle, sans lien avec les clubs.

**L'équipe à ses postes** (`figurants/equipe.js`). Quand le car est installé (pas au car vide ni à l'arrivée du jour
de match), douze équipiers sont assis à leur poste, casque d'ordres sur la tête :

| Poste | Équipier | Poste | Équipier |
| --- | --- | --- | --- |
| Son | Thomas, ingénieur du son | Vision 1 et 2 | Sami et Julie, ingénieurs vision |
| Scripte | Claire | Ralentis (LSM) | Hugo |
| Réalisateur | Marc | IPDirector, médias | Léa |
| Truquiste | Nadia | Production | Paul, producteur |
| Habillage | Inès | Chef de car | Olivier |
| Régie HF | Yanis, technicien HF | | |

Ils travaillent : les mains sur le pupitre ou les faders, le regard qui va des écrans au bureau, le réalisateur qui
montre le mur d'écrans, le producteur qui suit, bras croisés. Ce sont les visages de l'équipe virtuelle de l'émission
(`emission/ia.js`) : le générique de fin les nomme. Quand on s'assoit à un poste, son titulaire s'écarte, passe derrière
les bureaux (par le passage entre les deux rangées, ou côté technique) et attend debout contre la paroi de l'allée, en
regardant le mur d'écrans ; il revient s'asseoir quand on s'en va. En coopération, les postes des équipiers sont laissés
libres de la même façon. Dans Jouer, **« Ton poste »** : on peut commencer assis au poste de son choix (le son, le
mélangeur, l'IPDirector…), son titulaire ayant laissé la place ; « Aucun » garde l'arrivée au compound.

**Le compound vit** (`figurants/compound.js`). Des techniciens vont et viennent : le technicien vidéo entre dans le car,
vérifie la baie CCU et la grille, ressort contrôler le pied de car ; l'électricien fait la navette entre le groupe
électrogène et l'arrière du car, en gilet orange, la radio à la main ; la liaison satellite passe du camion satellite à
la baie d'intercom ; un cadreur part au stade par le portail et revient ; l'assistante de production va des bungalows
au car, derrière la production ; un runner court entre les bungalows et le stade. Trois agents de sécurité en gilet
fluo : au portail du stade, en ronde le long des grilles, à l'entrée du compound. Un **portail** est ouvert dans la
grille, là où passent la rampe de câbles et les piétons. Les figurants ne traversent ni les bureaux du car ni les
véhicules (vérifié point par point par les tests) ; ils ne bloquent pas le joueur.

**Plus de fils en l'air.**

- Les tracés des câbles caméra (affichés avec les étiquettes) montaient en éventail, en diagonale, de la rampe au
  panneau du pied de car, et flottaient jusqu'à 60 cm au-dessus du sol : ils sont maintenant posés au sol (3 à 22 cm) et
  montent à la verticale contre la paroi, chacun à sa prise.
- Les quatre câbles noirs du pied de car font de même.
- Les haubans d'un pixel qui descendaient des pylônes du stade jusqu'au sol, derrière les grilles du compound, sont
  retirés (ceux de l'anneau du toit restent).
- La caténaire de la voie ferrée, faite de boîtes de 4 cm d'épaisseur sur 1,4 km, se brisait à distance en pointillés
  flottants : elle est dessinée en fils continus, le porteur qui pend entre les portiques (45 cm de flèche), le fil de
  contact et les pendules.

**Ce qui change ailleurs.** `match.js` : `tirerMatch`, `forceEquipe`, `nouveauMatch` (graine, tirage, score à zéro,
coup d'envoi tiré au sort), `nouveauMatchEnContinu` (au lancement d'une partie hors émission), `avantMatch(duree,
graine)`. `people.js` : `peindreTenues` (les tenues d'après TEAMS, de nouveau quand l'adversaire change). `world.js` :
`peindreVisiteurs`, `OBSTACLES_COMPOUND`. `data/match.js` : `setAdversaire`. Rendu : les figurants sont deux troupes
instanciées (`figurants/troupe.js`, les mêmes corps que les joueurs : une dizaine de meshes instanciés par scène, quel
que soit leur nombre).

**À faire relire.** Les niveaux de jeu des clubs sont des ordres de grandeur fictifs ; les tenues sont des couleurs de
club, pas des maillots officiels. Les noms des clubs sont réels, les joueurs ne le sont pas.

Tests : `tests/unit/match.test.mjs` (nouveau : le match figé repart, coup d'envoi, même graine même match, résultats
variés, force, clubs), `tests/unit/figurants.test.mjs` (nouveau : équipe et rôles, chemins, se lever et revenir,
itinéraires du compound sans obstacle) ; suite `node tools/e2e.mjs figurants` (nouvelle : adversaire et poste dans
Jouer, au poste choisi le titulaire laisse sa place puis revient, chemins vérifiés avec les obstacles du car et du
compound, techniciens qui entrent et sortent, sécurité, câbles au sol, car vide sans équipe).

## v19.19 : l'émission en direct (générique, pub, générique de fin lancés depuis l'IPDirector, équipe virtuelle)

**Pourquoi.** Au car régie, le match tournait sans début ni fin : il manquait tout ce qui fait une **émission**, les
médias (générique de début, page de publicité, générique de fin), le top antenne et la conduite d'un conducteur. Et seul,
on ne pouvait tenir qu'un poste à la fois pendant que les autres restaient vides. Désormais, Jouer → Car régie → **Car
pré-installé** propose (choix par défaut) l'**émission en direct** : le match ne commence plus tout seul, il se joue
comme une émission, du compte à rebours au générique de fin, et les postes que l'on n'occupe pas sont tenus par une
**équipe virtuelle**. « Match en continu » garde le jeu libre d'avant.

**Le déroulé** (le conducteur, `emission/conducteur.js`, calcul pur) :

| Séquence | Durée | Ce qui se passe |
| --- | --- | --- |
| Avant l'antenne | 2 min (décompte) | Le match attend à l'échauffement (horloge arrêtée). Le décompte se **suspend**, ou l'on prend l'**antenne maintenant**. Le générique est chargé sur le canal de diffusion de l'EVS, le truquiste le prépare au preset |
| Générique de début | 30 s | Top antenne : l'**IPDirector lance le générique**, le truquiste le prend à l'antenne |
| Présentation | 15 s | Fondu sur le plan large, titre du match à l'habillage, les commentateurs ouvrent l'émission |
| 1re période | 10 min | Coup d'envoi : le temps de jeu court, score et chrono à l'antenne, ralentis |
| Mi-temps | 10 s | Coup de sifflet (deux brefs, un long), plan large, statistiques ; la pub est chargée |
| Page de publicité | 1 min 10 | Top pub : l'IPDirector lance l'écran publicitaire, le score sort de l'image |
| Retour au stade | 12 s | Plan large, les commentateurs reprennent l'antenne, le score revient |
| 2e période | 10 min | Les équipes ont changé de côté ; le temps de jeu va de 10:00 à 20:00 |
| Fin du match | 15 s | Sifflet final, score et statistiques ; le générique de fin est chargé |
| Générique de fin | 30 s | Top générique : score final et générique déroulant, puis fondu au noir |
| Fin d'antenne | | Le compte rendu noté s'affiche |

Un média ne part pas tout seul : il faut le **lancer au top**, depuis l'IPDirector. Le lancer pendant la séquence qui
le précède, c'est donner le top soi-même : le générique lancé pendant le décompte **prend l'antenne**, la pub lancée
pendant la mi-temps part tout de suite. Lancé en retard, il se voit (le média figé sur sa première image à l'antenne) ;
jamais lancé, l'émission continue sans lui au bout de 20 s, et il compte comme manqué.

**L'IPDirector** (`emission/panneau.js`, en tête du poste) : la base **MÉDIAS** du serveur (des fichiers importés
avant le match, pas des enregistrements des caméras), chacun avec sa vignette et sa durée (00:30:00, 01:10:00,
00:30:00) ; on **charge** un média sur le canal de diffusion (PGM2, l'EVS B ; PGM1 en UHD, le seul canal de lecture), il
attend en pause sur sa première image (cue) ; **LANCER** au top, **STOP**, **Début**, **Éjecter** ; l'écoulé, le **temps
restant** (aussi au multiview, sur la tuile de l'EVS) et, pour la pub, la partie en cours. Le prochain top est affiché
en grand (« TOP ! » en rouge quand c'est le moment), le conducteur à côté. Toute autre commande du canal (ralentis) éjecte
le média.

**Les médias**, dessinés et composés par le code (aucun fichier, `emission/dessin.js`, `emission/musique.js`) :

- **le générique de début** (30 s) : noir de tête, faisceaux des projecteurs, le terrain qui se dessine, le titre « Le
  Grand Match », l'affiche (les deux équipes, écussons génériques, « VS »), le coup d'envoi à 21:00, le logo de la chaîne
  fictive TIEE Sport, un éclair, le noir ; un indicatif à 128 bpm (16 mesures = 30 s : montée, thème en ré majeur,
  coup final sur le logo) ;
- **la page de publicité** (1 min 10) : le jingle « Publicité » (l'écran publicitaire doit être reconnaissable à
  l'image et au son, avant comme après), trois spots de 20 s de marques fictives (La Baraque du Terril, Mutuelle des
  Corons, Ch'ti Vélo) avec leur musique, puis le jingle de retour (« Retour à Bollaert ») ;
- **le générique de fin** (30 s) : le score final, puis le **générique déroulant** : qui a tenu chaque poste (vous, un
  participant, ou l'équipe virtuelle), les commentateurs, l'établissement ; le thème plus lent, fondu au noir.

Le son sort sur l'entrée AES de la console qui reçoit le canal (AES 2 = PGM2) : le fader EVS de la console s'ouvre avec
l'image (AFV). Chaque média est livré autour de **−23 dBFS efficaces**, crêtes sous −1 dBFS (mesuré hors ligne : −23 à
−26 dBFS selon les passages ; les trois spots à 0,5 dB près), comme le programme : la pub n'est pas plus forte que le
match.

**L'équipe virtuelle** (`emission/ia.js`). Seul, chaque poste que l'on n'occupe pas est tenu, et suit le conducteur :

- **le réalisateur** choisit les plans pendant le jeu (le large comme base, le 16 m du côté du ballon, des serrés sur le
  porteur, le joueur ; jamais le contrechamp en direct), demande les ralentis (après un but : le buteur, la joie, le
  ralenti en volet logo, le retour, le bandeau du buteur ; après une occasion suivie d'une sortie de but), prend les
  médias au top et enchaîne sur le stade à leur fin ;
- **le truquiste** exécute ses ordres avec un temps de réaction (0,2 à 0,5 s), score (DSK 1) au jeu, retiré sous les
  médias, fondu au noir à la fin ;
- **l'IPDirector** charge le prochain média (au plus tard 30 s avant son top) et le lance au top ; il rend le canal
  quand un média est fini ;
- **le son** baisse les ambiances sous un média (−22 dB), ferme les commentateurs avant l'antenne et sous les médias,
  met le canal de diffusion à 0 dB pour un média et le ramène à −6 dB pour les ralentis ;
- **l'habillage** : le titre du match à la présentation, les statistiques à la mi-temps et à la fin, le bandeau du
  buteur ;
- **la vision** suit l'exposition (iris) ; **les ralentis** (EVS A) calent l'action, comme avant ;
- **la scripte** annonce dans l'intercom : « Antenne dans 1 minute », « 30 secondes », le décompte, « Retour dans 10 »,
  « Mi-temps dans 1 minute », et rappelle à l'IPDirector un média oublié.

Le poste où l'on est assis n'est jamais touché : au mélangeur, c'est le réalisateur virtuel qui **donne ses ordres dans
l'intercom** (« Prépare l'EVS B… Top générique ! », « Retour stade : prépare la 1 », « Enchaîne ! ») et attend qu'on
les exécute ; au réalisateur, ce sont nos ordres que le truquiste virtuel exécute. En coopération, l'équipe virtuelle
ne tient que les rôles sans titulaire, chez l'hôte (qui fait tourner le match) ; son conducteur part à tous avec
l'instantané du match.

**À l'écran.** L'**horloge du direct** (sous la barre d'outils, et dans l'en-tête du poste quand on est assis) : la
lampe d'antenne, la séquence, le prochain top et le temps qui reste, le score et le temps de jeu ; pendant le décompte,
« Antenne maintenant » et « Suspendre ». Le **suivi des tâches** montre le conducteur, coché au fil de l'émission. Le
poste du **scripte** affiche le conducteur de l'émission (avec ses commandes), le téléphone a l'application **Le
direct** (le conducteur, et le chemin de l'IPDirector).

**Le compte rendu** (sur 100, `bilan` dans `conducteur.js`) : chaque média lancé au top (15 points à 2 s près, 10 à 5 s,
5 à 10 s ; en avance aussi) et diffusé en entier (10), pas de noir ni de mire ni de média figé à l'antenne (15, −1 point
par 2 s), le score à l'antenne pendant le jeu (5), le retour au stade à la fin du générique et de la pub (5) ; qui
tenait chaque poste ; au mélangeur, les ordres du réalisateur exécutés et le temps de réaction. « Rejouer l'émission »,
« Continuer en match libre ».

**Ce qui change ailleurs.**

- `match.js` : le match a des **périodes** (`M.periode` : `libre` = le match en continu de toujours, sinon avant-match,
  1re période, mi-temps, 2e période, fin ; `avantMatch`, `coupDEnvoi`, `matchEnContinu`) : le temps de jeu ne court
  que pendant une période, échauffement et retour au banc hors du jeu, sifflets de mi-temps et de fin, changement de
  côté ; les commentaires saluent la mi-temps, la reprise, la fin, l'ouverture et la clôture de l'émission.
- `pipeline.js` : un canal de l'EVS peut lire un **média** (`EVS.ch[i].media`), image et temps restant au multiview ;
  partagé en coopération (tranche `evs`).
- Progression **v5** (`PROG.emissions` : score, médias lancés soi-même, fusion entre deux appareils). Livret : l'émission
  est un exercice pratique rattaché à **3.11 (mettre en œuvre les conducteurs)**, 2.5 (le médiaflow), 2.9 et 4.1 ;
  elle ne compte que réussie (60 sur 100) avec les **trois médias lancés soi-même** depuis l'IPDirector. XP : 100 la
  première fois, 25 ensuite (25 aussi quand l'équipe virtuelle a lancé les médias).

**À faire relire.** La règle des écrans publicitaires (décret n° 92-280 du 27 mars 1992, article 14 : publicités
« aisément identifiables » et séparées du programme par des écrans reconnaissables à l'image et au son) ; la pub d'une
retransmission sportive placée dans une pause naturelle du jeu (la mi-temps) ; la sonie des publicités alignée sur celle
des programmes (EBU R128, imposée par le CSA, aujourd'hui l'Arcom, depuis 2011). Dans la réalité, la pub d'un match
diffusé par une grande chaîne est souvent insérée par la **régie finale** de la chaîne, pas par le car : ici, comme dans
une petite production ou une diffusion en ligne, le car la diffuse lui-même. Les durées (deux périodes de 10 minutes,
décompte de 2 minutes) sont celles d'un exercice, pas d'un match.

Tests : `tests/unit/emission.test.mjs` (médias, conducteur, décompte, média lancé ou manqué, périodes, compte rendu,
match par périodes, musiques), `tests/unit/progression.test.mjs` (v4 → v5) ; suite `node tools/e2e.mjs emission`
(nouvelle : Jouer, décompte, IPDirector, top, générique, périodes, pub, générique de fin, compte rendu, livret ; puis
l'émission rejouée au mélangeur avec l'IPDirector virtuel), `modes-car` (le car pré-installé en match continu).

## v19.18 : le Cours en parcours, à la façon de Duolingo (niveaux, exercices en autonomie, test de niveau)

**Pourquoi.** Tout le Cours était ouvert d'un coup : un étudiant qui arrivait pouvait commencer par le ST 2110 sans
savoir ce qu'est une adresse IP. Le Cours devient un **parcours** : chaque catégorie (un chapitre : la vidéo, le SDI,
le réseau…) se fait par **niveaux**, Débutant, Intermédiaire, Avancé, Expert ; un niveau s'ouvre quand le précédent
est validé, et chaque leçon se termine par son **quiz** et un **exercice en autonomie** où l'aide se paie en points.
On commence donc par les fondamentaux, puis on monte.

**Les catégories et leurs niveaux** (`cours/parcours.js`, table `PARCOURS` : c'est là que le formateur change le
niveau d'une leçon ; 57 leçons, 29 niveaux) :

| Catégorie | Débutant | Intermédiaire | Avancé | Expert |
| --- | --- | --- | --- | --- |
| Le signal vidéo numérique | formats et cadences, 8 ou 10 bits, 4:2:2 | niveaux 0–100 % | espaces de couleur, HDR | |
| Le SDI | le SDI, connecteurs et brassage | grille, audio embarqué | falaise, œil | du mot au bit |
| La synchro | le timecode | le genlock | | |
| La caméra | la chaîne caméra | le montage | la fibre | |
| La réalisation | le mélangeur, le langage du direct | les incrustations | | |
| Les ralentis | le serveur ralenti | clips et playlists | | |
| Le son | la tranche | N-1 et synchro labiale | | |
| Le réseau | couches, LAN / MAN / WAN, Ethernet, commutateur, adresse IP | VLAN, adresses et diffusion, types d'adresses, DHCP et DNS, passerelle, TCP et UDP | NAT, streaming, multicast, mesures, QoS, PTP | ST 2110, paquet, rythme, 2022-7, spine-leaf, NMOS |
| La HF | fréquences, antennes | bilan de liaison | COFDM | |
| L'exploitation | l'intercom | line-up, transmission, dépannage | régie mobile | le jour de match |

**Une leçon en trois étapes** (en tête de la leçon, avec ses étoiles) : **Apprendre** (l'essentiel, le schéma, la
manipulation, l'explication, « dans le car », les fiches « ? »), le **quiz** (3 sur 3, comme avant), puis
l'**exercice en autonomie** (60 sur 100). Une étoile pour le quiz, une pour l'exercice réussi, la troisième pour
l'exercice à 90 sur 100 (presque sans aide). Les exercices pratiques dans le car (Olivier) viennent ensuite, pour
aller plus loin : ils comptent toujours pour « consolidée » au livret.

**L'exercice en autonomie** (`cours/exo.js`, un fichier par chapitre dans `cours/exos/`, affichage
`ui/cours_exo.js`) : une situation du car, trois à cinq questions posées une à une, avec **des valeurs tirées à chaque
essai** (refaire, c'est refaire avec d'autres chiffres). Quatre sortes de questions : un nombre à calculer (débit,
code, affaiblissement, latence…, écrit à la française ou non), un choix dans une situation, une réponse à écrire (une
adresse, un timecode, un nom), des étapes à remettre dans l'ordre (line-up, DHCP, montage d'une caméra…). Les réponses
se calculent avec les modèles purs des leçons (`ip_calc.js`, `st2110_calc.js`, `sdi_mots.js`…), pas à la main.
Chaque question a **deux aides graduées** (un indice, puis la méthode : −25 % de la question chacune) et sa
**solution** (la question ne rapporte alors rien) ; une erreur coûte 25 % (50 % sur un choix, pour qu'on ne réussisse
pas en cliquant au hasard), une erreur prévue est expliquée, la même erreur n'est comptée qu'une fois. Le bilan donne
le score sur 100 et le détail par question.

**Ouvrir le niveau suivant** : toutes les leçons du niveau terminées (quiz et exercice réussis) et une **moyenne des
exercices d'au moins 70 sur 100** : un niveau fait en demandant toutes les solutions ne passe pas ; on refait alors
l'exercice le plus faible avec moins d'aide (« Mon parcours » le propose). Le **test de niveau** permet de sauter ce que
l'on sait déjà : six à douze questions tirées des quiz des leçons sautées, 80 % de bonnes réponses ; les leçons sautées
restent à faire pour leurs étoiles et le livret. Au profil **Formateur**, tout est ouvert.

**À l'écran** (`ui/cours_parcours.js`, `styles/cours-parcours.css`) :

- **Mon parcours** (l'accueil du Cours) : la leçon à faire ensuite, toujours prise dans le niveau le plus bas de toutes
  les catégories (tous les Débutant, puis les Intermédiaire…), quatre compteurs (leçons terminées, étoiles, niveaux
  validés, compétences), une tuile par catégorie (niveau atteint, échelle des quatre niveaux, étoiles), l'exercice
  pratique à faire dans le car et le livret ;
- **le chemin d'un chapitre** : niveau par niveau, les leçons en lacets, un disque par leçon (fait, à faire, fermé),
  ses étoiles, et au bout de chaque niveau ce qu'il faut pour ouvrir le suivant ; un niveau fermé propose son test ;
- **le sommaire** range chaque chapitre par niveau, avec ses cadenas (le réseau garde les titres de ses parties) ;
- une leçon d'un niveau fermé (atteinte par une fiche « ? », un poste, la recherche) n'en montre que l'aperçu et le
  chemin pour l'ouvrir.

**Ce qui change ailleurs.** Progression v4 (`PROG.cours[id].exo` : meilleur score, réussi seul, essais ;
`PROG.niveaux` : tests de niveau ; fusion entre deux appareils). XP : exercice réussi 30, trois étoiles 15, niveau validé
60, test réussi 40 ; trois badges (Premier niveau, Les fondamentaux, Expert). Livret : l'exercice en autonomie est une
activité de la leçon (« Exercice du Cours », mêmes compétences), réussie sans solution demandée ; ce n'est pas un
exercice pratique. Jouer → Mission spécifique reste libre.

**À faire relire** (chiffres signalés pendant l'écriture des exercices) : les portées SDI du plan caméras (70, 120,
150 m) données comme ordres de grandeur ; les sensibilités du bilan HF (−96, −87, −82 dBm) ; les deux modèles optiques
de la caméra (chaque exercice suit sa leçon) ; le nom de clip LSM tiré au sort ; les valeurs simplifiées du BMCA ; le
rangement des leçons par niveau et les seuils (60, 70, 80 %), à essayer avec une classe.

Tests : `tests/unit/parcours.test.mjs` (rangement, niveaux, conditions, suite conseillée, test de niveau),
`tests/unit/exos.test.mjs` (une leçon, un exercice ; 40 tirages de chaque exercice bien formés, réponse juste acceptée,
pièges refusés ; points), `tests/unit/progression.test.mjs` (v3 → v4, fusion) ; suites `node tools/e2e.mjs parcours`
(nouvelle), `cours`, `vues3d`.

## v19.17 : le réseau de A à Z, et en 3D (adresses, diffusion, TCP et UDP, LAN / MAN / WAN, streaming, QoS)

**Pourquoi.** Le chapitre Le réseau partait du car IP (ST 2110) sans poser les bases : l'adresse et le masque,
l'adresse réseau et la diffusion, TCP et UDP, le streaming, LAN, MAN et WAN, la qualité de service. Les voici, en
leçons et surtout **en 3D** : chaque notion a une scène où on la voit agir (les bits d'une adresse qui s'allument, une
diffusion qui inonde son sous-réseau et s'arrête au routeur, un accusé TCP qui revient, un datagramme UDP perdu qui
laisse un trou, un paquet qui s'enveloppe couche par couche, une file d'attente qui déborde).

**Le chapitre en cinq parties** (23 leçons ; les parties titrent le sommaire et sont rappelées dans le fil d'Ariane,
`PARTIES` dans `cours/reseau.js`) :

1. **Les bases d'un réseau** : `reseau-modele` (le modèle en couches OSI et TCP/IP, l'encapsulation),
   `reseau-etendue` (LAN, MAN, WAN, le temps de propagation), `reseau-ethernet` (câbles, débits, SFP, la trame et le
   MTU), le commutateur, les VLAN ;
2. **Adresser et acheminer** : l'adresse IP et le masque, `reseau-adresses` (adresse réseau, diffusion, plage,
   découpage en sous-réseaux, en binaire), `reseau-types` (unicast, diffusion, multicast ; privées, publiques,
   APIPA, boucle locale, CGNAT, classes historiques, IPv6), `reseau-dhcp-dns`, la passerelle, `reseau-nat` (NAT,
   ports, pare-feu, redirection) ;
3. **Transporter : TCP, UDP, streaming** : `reseau-tcp-udp` (ports, poignée de main, accusés, fenêtre,
   retransmission ; UDP et RTP), `reseau-streaming` (contribution SRT et RIST, RTMP vers une plateforme, HLS et CDN
   vers le public, NDI), le multicast ;
4. **Qualité de service et mesures** : `reseau-mesures` (débit, latence, gigue, pertes, budget de retard),
   `reseau-qos` (DSCP, classes, files, priorité stricte) ;
5. **Le car IP (ST 2110)** : PTP, essences, paquet, rythme, 2022-7, spine-leaf, NMOS.

Onze leçons nouvelles (57 en tout), chacune avec schéma, manipulation, quiz de six questions (chaque mauvais choix
expliqué) et rattachement au référentiel ; 23 fiches « ? » (`content/terms_ip.js`, famille « Bases du réseau » et
nouvelle famille « Streaming et contribution ») ; un thème « Réseau IP : les bases » au glossaire (15 entrées) ; les
liens leçons ↔ glossaire ↔ postes (réseau, transmission) complétés.

**Six vues 3D de plus** (vingt vues, 132 étapes), dans « Le réseau en 3D » et dans le « Voir en 3D » de chaque leçon
nouvelle :

| Vue | Ce qu'on y voit |
| --- | --- |
| Le modèle en couches : un paquet de bout en bout | Deux piles de quatre couches (noms OSI au choix) ; une image ST 2110, une page web ou un ping descend la pile en s'enveloppant d'en-têtes (RTP, UDP ou TCP, IP, Ethernet), traverse un commutateur qui n'ouvre que la trame, un routeur qui refait la trame, un pare-feu qui lit jusqu'au port, puis remonte ; taille sur le fil et part utile |
| Adresses, masque et diffusion | Huit machines sur un commutateur ; un écran montre les 32 bits de l'adresse, du masque, de l'adresse réseau (ET logique) et de la diffusion ; le masque (/23 à /27) redécoupe les zones ; une diffusion gardée dans son sous-réseau, ignorée ailleurs, arrêtée par le routeur ; un envoi direct ou par la passerelle ; un portable sans réponse DHCP en 169.254 |
| Arriver sur le réseau : DHCP et DNS | Un portable qui arrive sans adresse : Discover, Offer, Request, Ack ; le relais DHCP à travers le routeur ; le repli en 169.254 ; une box pirate qui répond plus vite ; le DNS local, puis la chaîne racine → .fr → exemple.fr |
| TCP et UDP sur un chemin qui perd | Deux voies dans la même zone de pertes : TCP (poignée de main, segments, accusés cumulatifs, fenêtre qui grandit, trois accusés en double et retransmission, délai dépassé) et UDP (le rythme tenu, des trous) ; l'écran de chaque récepteur ; aller-retour et pertes réglables ; le débit de TCP à l'échelle réelle |
| Du car au monde : LAN, MAN, WAN et streaming | Une carte, pas à l'échelle : le car et le stade (LAN), la boucle de la ville (MAN), la fibre de l'opérateur et le satellite géostationnaire (WAN : ≈ 1,3 ms contre ≈ 240 ms), Internet par la box et sa traduction d'adresses, SRT qui redemande les paquets perdus, RTMP vers une plateforme, HLS et un CDN vers les spectateurs ; le retard au spectateur |
| La QoS dans un commutateur | Quatre usages (PTP, caméra, intercom, copie de fichiers) vers un même port de sortie, dans un commutateur transparent : une seule file où tout le monde attend et perd, puis une file par classe (DSCP) et la priorité stricte ; marquages, charge, lien 1 ou 10 Gb/s ; pertes et attente par classe, à l'échelle réelle |

**Des calculs vrais.** Les leçons et les vues lisent `cours/ip_calc.js` (pur, testé) : adresse réseau, diffusion,
plage, découpage, préfixe pour n appareils, type d'adresse (RFC 1918, 3927, 6598, 5771, 4607), portée d'un envoi ;
encapsulation et taille sur le fil (18 octets d'en-tête et de contrôle Ethernet, 20 de préambule et d'intervalle) ; sérialisation,
flux par lien ; propagation (5 µs/km dans la fibre), bond géostationnaire ; débit de TCP avec pertes (formule de
Mathis : ≈ 1,4 Mb/s à 100 ms et 1 % de pertes) et par fenêtre ; pertes UDP ; latence SRT (multiplicateurs de
l'aller-retour conseillés par Haivision, aller-retour compté à 20 ms au moins) ; files d'attente une file ou
priorité stricte ; traduction d'adresses et redirection ; gigue RTP (RFC 3550) ; budget de latence. Les chiffres
qui ne sont que des ordres de grandeur (retard HLS, latence SRT conseillée) le disent.

**La 3D, notion par notion (suite du tableau de la v19.16).** L'adressage passe en 3D : l'écran des bits et la
diffusion qui reste dans sa zone montrent ce que le calcul seul ne montre pas.

| Notion | 3D ? | Pourquoi |
| --- | --- | --- |
| Modèle en couches, encapsulation | Oui | Des enveloppes qui s'emboîtent, des appareils qui n'en ouvrent pas autant |
| Adresse, masque, adresse réseau, diffusion | Oui (était Non) | Les bits à l'écran, la diffusion qui reste dans son sous-réseau |
| DHCP, DNS, APIPA | Oui | Des échanges entre machines, la diffusion, le relais |
| TCP, UDP | Oui | Les accusés qui reviennent, la retransmission, les trous |
| LAN, MAN, WAN, satellite, Internet, NAT | Oui | Des distances et des chemins |
| Streaming : SRT, RTMP, HLS, CDN | Oui | Le chemin du car au spectateur, la redemande des pertes |
| QoS : classes, files, priorité | Oui | Des files d'attente qui se remplissent |
| Découpage à la main, préfixe pour n appareils | Non | Du calcul : la manipulation de la leçon |
| Courbe du débit TCP selon les pertes, budget de latence | Non | Courbes et tableaux ; la vue en donne la lecture chiffrée |

Tests : `tests/unit/reseau-bases.test.mjs` (cinq parties, onze leçons et leur vue 3D, fiches, adresses, types,
encapsulation, propagation, TCP et SRT, QoS, NAT, gigue) ; suites `node tools/e2e.mjs vues3d` (les vingt vues, chaque
étape) et `cours`.

**Version publiée** : 19.17.0, exécutable Windows et application macOS dans la Release `v19.17.0`.

## v19.16 : le Cours en 3D (SDI, réseau, ST 2110, synchro, fibre, HF) et dix leçons de plus

**Pourquoi.** Comme la caméra de la v18.5, les notions techniques les plus abstraites se comprennent mieux quand on
les voit : un coaxial coupé en deux où défilent les mots de la ligne SDI, des machines rangées par VLAN, une
passerelle qui fait le pont entre deux réseaux, un paquet ST 2110 ouvert couche par couche. L'écrit reste à côté :
chaque vue a son panneau d'explications à droite, comme aux postes 3D.

**Où les trouver.** Dans le Cours, le sommaire de chaque chapitre concerné a une entrée **« … en 3D »** (Le SDI en
3D, La synchro en 3D, La fibre en 3D, Le réseau en 3D, La HF en 3D) qui ouvre la première vue avec la liste de
toutes les vues ; chaque leçon illustrée a une section **« Voir en 3D »** qui ouvre sa vue à l'étape tirée de cette
leçon. Le téléphone (application Cours) et l'exécutable / l'application macOS y mènent comme au reste du Cours.

**Une vue 3D** (`src/vues3d/`) : une scène construite dans le code (`matiere()`, `Builder` avec arêtes arrondies et
occlusion cuite, aucune image de fichier), qu'on fait tourner (glisser), approcher (molette, pincer) et déplacer
(clic droit ou Maj) ; un clic sur un objet le décrit. La barre du haut : Les vues 3D (liste par chapitre),
Étiquettes, Pause (barre d'espace), Recentrer (double-clic), Quitter (Échap : retour sur la leçon ou le chapitre
d'où l'on venait). Le panneau a deux onglets : **En 3D** (le résumé, les étapes à suivre avec Suivante / flèches,
« À vous » : les commandes qui changent la scène, « Ce que mesure la scène » : des lectures chiffrées calculées par
les mêmes modèles que les leçons, « Ce qui se passe », l'objet choisi) et **La leçon** (l'essentiel, le schéma et
l'explication de la leçon, un lien vers la leçon complète avec sa manipulation et son quiz). Le simulateur est en
pause pendant ce temps ; sous 900 px, le panneau passe sous la scène.

**Les quatorze vues** (90 étapes) :

| Chapitre | Vue | Ce qu'on y voit |
| --- | --- | --- |
| Le SDI | Le coaxial et la trame SDI | Un 1694A ouvert (âme, diélectrique, tresse, gaine) où défile la ligne : EAV, LN, CRC, paquets audio dans la HANC, SAV, Cb Y Cr Y ; en ligne, en mots ou en bits ; une loupe arrête le mot choisi (valeur, rôle) ; du mot au bit : embrouillage, NRZI (leçons `sdi-cest-quoi`, `sdi-embedded`, `sdi-bits`) |
| Le SDI | Le câble s'allonge : affaiblissement et œil | Cinq points de mesure le long du câble, l'œil et l'image à chacun ; la falaise ; un DA qui remet le compteur à zéro |
| Le SDI | BNC, 75 Ω et baie de brassage | Un BNC éclaté, l'écho d'une pièce 50 Ω, la baie normalée sans cordon puis avec cordon |
| La synchro | Le genlock : toutes les images en même temps | SPG calé sur le GPS, DA en étoile, la phase de chaque source face à la fenêtre du mélangeur (± ½ ligne), une coupe propre ou qui saute, une source libre qui dérive, le synchroniseur, le holdover |
| La caméra | La fibre de la caméra : câble hybride et lumière | Le câble ST 311 ouvert (énergie dans le cuivre, lumière dans les deux fibres), une fibre agrandie 8 000 fois (réflexion totale, multimode et monomode), la face du connecteur au microscope, le niveau reçu à la CCU |
| Le réseau | Le commutateur apprend : la table MAC | ARP en diffusion, réponse sur un seul port, la table qui se remplit, l'inondation d'une adresse inconnue |
| Le réseau | VLAN : des réseaux dans le réseau | Deux commutateurs, dix machines regroupées par VLAN (zones colorées), la diffusion qui reste dans son VLAN, le trunk et son étiquette 802.1Q, deux pannes |
| Le réseau | La passerelle : un pont entre deux réseaux | Deux îlots, la passerelle-pont et le routeur : en direct ou par la passerelle, l'enveloppe Ethernet refaite, pas de passerelle, un masque trop large, traceroute |
| Le réseau | Multicast et IGMP | Un flux recopié par le commutateur vers les seuls abonnés, le rapport IGMP, l'unicast, l'inondation sans snooping (jauges de débit des liens) |
| Le réseau (et La synchro) | PTP : l'heure du car IP | t1 à t4, le calcul du décalage, la file d'attente d'un commutateur ordinaire, l'horloge frontière, l'asymétrie, le BMCA |
| Le réseau | Du SDI au réseau : les essences séparées | Le train SDI, la passerelle qui sépare vidéo, audio et données, les abonnements, l'horodatage qui réaligne |
| Le réseau | Un paquet ST 2110 en poupées russes | Une ligne en quatre paquets, puis les couches (pixels, RFC 4175, RTP, UDP, IP, Ethernet) ; le rythme -21 et le tampon du récepteur qui déborde |
| Le réseau | Rouge et bleu : deux réseaux spine-leaf | Spines et leaves, ECMP, chaque paquet deux fois (2022-7), une spine puis un réseau entier qui tombe, NMOS qui connecte le multiview |
| La HF | La caméra HF dans le stade | Le stade au 1/10, la caméra qui longe la touche, deux antennes, les rayons direct, sol et tribune colorés selon la marge, l'historique du niveau, la diversité, les antennes directives, l'intervalle de garde COFDM, l'obstacle |

**Les nouvelles leçons** (46 en tout), chacune avec schéma, manipulation, quiz de six questions et rattachement au
référentiel : `sdi-bits` (du mot au bit : embrouillage x⁹ + x⁴ + 1, NRZI, horloge retrouvée), `reseau-routage` (la
passerelle), et tout le car IP rangé dans **Le réseau** : `reseau-st2110` (essences séparées), `reseau-paquet` (le
paquet ST 2110-20 couche par couche), `reseau-rythme` (ST 2110-21), `reseau-2022-7` (rouge et bleu),
`reseau-spine-leaf`, `reseau-nmos` (IS-04, IS-05) ; dans La caméra, `camera-fibre` (câble hybride, bilan optique,
propreté). Quatre fiches « ? » (`content/terms_fibre.js`, famille « Liaisons optiques ») : fibre monomode, câble
hybride SMPTE, niveau optique, nettoyer et inspecter un connecteur. Trois parcours d'Olivier changent de leçon
(`cours/exercices.js`) : « Visiter le réseau du car IP et suivre un flux » va avec `reseau-st2110`, « Mettre en
service une leaf neuve » avec `reseau-spine-leaf`, « Mettre en service une passerelle IP vers SDI » avec
`reseau-nmos`.

**Des calculs vrais.** Les vues lisent les mêmes modèles que les leçons, testés à part : `cours/sdi_mots.js` (les
5 280 mots d'une ligne 1080p50, XYZ, LN, CRC-18 dont le reste est nul au contrôle, paquets ST 299-1 avec parité et
somme de contrôle, embrouillage et désembrouillage), `cours/st2110_calc.js` (4 320 paquets par image, 216 000 par
seconde, ≈ 2,2 Gb/s ; CMAX et VRX du modèle -21 ; tampon du récepteur), `vues3d/l2.js` (apprentissage, inondation,
VLAN, trunk), `cours/reseau_routage.js` (décision de routage), `cours/camera_fibre.js` (bilan optique),
`cours/hf.js` (espace libre, gain d'antenne).

**La 3D, notion par notion : quand elle aide, quand le 2D suffit.**

| Notion | 3D ? | Pourquoi |
| --- | --- | --- |
| Trame SDI (EAV/SAV, HANC, audio, vidéo, LN, CRC) | Oui | Voir les mots défiler dans le câble, dans l'ordre et en proportion, est ce qui manquait au schéma |
| Affaiblissement, œil, falaise | Oui | La longueur se parcourt ; l'œil se mesure à chaque point |
| BNC, 75 Ω, brassage | Oui | Pièces à démonter, normalisation qu'on ne voit pas sur un schéma |
| Grille, matrice | Non | Le poste de la grille et le synoptique le montrent mieux qu'une scène |
| Genlock, phase, holdover | Oui | Plusieurs appareils et des règles de phase côte à côte |
| Timecode, LTC/VITC | Non | Un format de données : le schéma et la manipulation suffisent |
| Fibre, câble hybride SMPTE | Oui | Coupe et agrandissement, la lumière dans le cœur |
| Table MAC, VLAN, passerelle, multicast | Oui | Des machines, des câbles, des regroupements : la demande de départ |
| PTP | Oui | Les quatre messages et le temps de séjour se voient en mouvement |
| Adressage IP, masque | Non | Du calcul : la manipulation 2D reste la meilleure |
| ST 2110 : essences, paquet, rythme, 2022-7, spine-leaf, NMOS | Oui | Couches emboîtées, flux, deux réseaux, pannes |
| HF : bilan, échos, diversité, COFDM | Oui | Un lieu, des distances et des rayons |
| Signal (4:2:2, niveaux, gamma, HDR), son, réalisation, ralentis, exploitation | Non | Courbes, mesures, gestes de poste : les figures, manipulations et postes existants le font déjà |

Tests : `tests/unit/vues3d.test.mjs` (catalogue, étapes, modèles SDI, ST 2110, niveau 2, routage, fibre, HF, fiches
optiques), suite `node tools/e2e.mjs vues3d` (entrée du chapitre, liste, Pause, Étiquettes, onglet « La leçon »,
chaque vue et chaque étape sans erreur, « Voir en 3D » d'une leçon, Échap, 390 px). La suite `camera` vise
désormais l'entrée de la caméra dans le chapitre ouvert (le premier « … en 3D » du sommaire est celui du SDI).

**Version publiée** : 19.16.0, exécutable Windows et application macOS dans la Release `v19.16.0`.

## v19.15 : l'application macOS, et où télécharger le simulateur

**Pourquoi.** Le bouton *Code → Download ZIP* de GitHub donne le **code source**, pas le simulateur : il faudrait
installer Node.js et le construire (et cette page-là n'est pas protégée). La version à jouer se télécharge dans
les **Releases** du dépôt (colonne de droite de la page GitHub), une fois une version publiée : sous Windows
`TIEE-Simulator-partage.zip`, sur Mac `TIEE-Simulator-mac.dmg`. Il manquait la version Mac.

**L'application.** `TIEE-Simulator-mac.dmg` contient `TIEE Simulator.app` (Apple silicon et Intel dans un seul
fichier, macOS 11 ou plus récent), un raccourci vers Applications, `LISEZMOI.txt` (`partage/LISEZMOI-mac.txt`) et
les licences. Même principe que l'exécutable Windows : le serveur réseau local et la page chiffrée par le mot de
passe dans un Node.js autonome (blob SEA commun, `tools/sea.mjs`). On glisse l'application dans Applications, on
l'ouvre : une fenêtre du **Terminal** affiche le serveur (adresse à donner aux autres joueurs ; la fermer arrête le
simulateur), le navigateur s'ouvre sur « Accès réservé ». Les comptes rendus (`rapports`) et la clé des liens
Internet sont rangés dans le dossier `~/TIEE Simulator` (l'application, signée, ne doit pas changer).

**Construite sur un Mac de GitHub** (`tools/mac.mjs`, tâche « mac » de `.github/workflows/exe.yml`, machine macOS
Apple silicon) : node officiel de nodejs.org pour chaque processeur (empreinte SHA-256 vérifiée), signature de
Node.js retirée, blob injecté (postject, segment `NODE_SEA`), exécutable universel (`lipo`), petit lanceur compilé
(`clang`) qui passe la main à `Resources/lancer.sh`, icône `lan/car-regie-3d.icns` (`tools/icon.mjs`), signature
« ad hoc » (`codesign`, obligatoire sur Apple silicon), image disque (`hdiutil`). `--verifier` lance le serveur de
l'application (Apple silicon, puis Intel par Rosetta s'il est installé) et refait les contrôles de l'exécutable
Windows (écran d'accès, mauvais et bon mot de passe, page, parties, Internet, dossier de travail), puis contrôle
la signature, l'icône et l'image disque montée. Le lanceur refuse de démarrer depuis l'image disque ou le dossier
Téléchargements (macOS y « déplace » l'application en lecture seule) et demande de la glisser dans Applications.

**La première ouverture.** Sans certificat Developer ID ni notarisation par Apple (compte développeur, 99 $ par
an), macOS bloque la première ouverture : sous macOS 15 et plus récent, Réglages Système → Confidentialité et
sécurité → « Ouvrir quand même » ; avant, clic droit → Ouvrir. C'est expliqué pas à pas dans le LISEZMOI.
Notariser plus tard demande un certificat Developer ID et une étape de plus dans la tâche « mac ».

**Le workflow** s'appelle désormais « Versions à partager » : à l'envoi d'une étiquette `v…`, les tâches Windows
et macOS construisent et vérifient chacune leur version, puis la tâche « publication » met l'exécutable, le kit,
l'image disque et leurs empreintes SHA-256 dans la même *Release*. « Run workflow » garde les fichiers 30 jours ;
la case **essai** construit et vérifie tout avec un mot de passe jetable, sans rien garder (contrôler la
construction sans toucher au vrai mot de passe).

Tests : `tests/unit/mac.test.mjs` (Info.plist, icône, lanceur, dossier de travail, « rien en clair »),
`node tools/mac.mjs --verifier` sur un Mac (hors macOS, le script s'arrête après l'injection : contrôle seulement),
`node tools/exe.mjs --verifier` (inchangé, sur les pièces communes de `tools/sea.mjs`).

## v19.14 : un exécutable protégé par mot de passe et signé, construit par GitHub

**Pourquoi.** Le dépôt est devenu public (26 octobre 2026). La version à partager ne passe plus par un fichier
HTML, que n'importe qui pouvait ouvrir et copier : il n'y a plus que `TIEE-Simulator.exe`, qui demande un mot de
passe à chaque lancement, et qui est signé.

**Le mot de passe.** À la construction, la page du simulateur (three.js compris) est compressée puis chiffrée en
AES-256-GCM avec une clé tirée du mot de passe par scrypt (N = 2^17, r = 8 : 128 Mo et de l'ordre d'une
demi-seconde par essai ; `lan/coffre.mjs`). L'exécutable ne contient que ce coffre : ni la page en clair, ni le mot
de passe (`tools/exe.mjs` le vérifie et refuse de livrer sinon). Au double-clic, le navigateur s'ouvre sur l'écran
**« Accès réservé »** (logo du BTS, mentions) ; le premier bon mot de passe ouvre le coffre en mémoire, et chaque
navigateur reçoit un jeton (cookie `HttpOnly`, perdu à l'arrêt du serveur). Sans jeton : ni la page, ni les
parties, ni les comptes rendus, ni le WebSocket, ni le jeu par Internet. Les joueurs du réseau local et les invités
par Internet entrent le mot de passe à leur tour. Cinq essais manqués par minute et par adresse, puis une minute
d'attente. Lancé directement (`node lan/serveur.mjs`, page en clair), le serveur ne demande rien : c'est le mode de
développement et des tests.

**La signature.** `tools/signature.mjs` signe l'exécutable (Authenticode SHA-256, horodatage RFC 3161, par défaut
DigiCert) sans outil Windows : resedit assemble la signature, Node la calcule ; la somme de contrôle PE est
recalculée. `node tools/exe.mjs --verifier` la fait contrôler par `osslsigncode`. Deux possibilités :
- **certificat de l'établissement**, gratuit : `node tools/signature.mjs --creer` (openssl) crée un certificat
  auto-signé de cinq ans. Il prouve que l'exécutable vient du BTS et n'a pas été modifié (onglet « Signatures
  numériques » des propriétés). Windows ne lui fait confiance que sur les postes où `certificat.cer` est installé
  (« Éditeurs approuvés » et « Autorités de certification racines de confiance », par une stratégie de groupe du
  lycée) ; ailleurs, SmartScreen avertit comme pour un exécutable non signé ;
- **certificat d'une autorité reconnue** (payant, de l'ordre de 100 à 400 € par an selon le fournisseur, ordre de grandeur ; la clé
  est désormais gardée sur un support matériel ou dans un service en ligne, comme Azure Artifact Signing) : seul ce
  cas fait disparaître peu à peu l'avertissement de SmartScreen, à mesure que l'exécutable est téléchargé. Une clé
  exportable en PEM passe par les mêmes secrets ; un service en ligne demande une étape de plus dans le workflow.

**Construit par GitHub** (`.github/workflows/exe.yml`). Une fois pour toutes, dans *Settings → Secrets and
variables → Actions → New repository secret* :
- `TIEE_MDP` : le mot de passe (3 caractères au moins ; en dessous de 10, la construction avertit ; une phrase de
  quatre ou cinq mots est plus sûre et plus
  facile à dicter) ;
- `TIEE_SIGN_CERT` et `TIEE_SIGN_KEY` : le contenu de `certificat.pem` et de `cle.pem` (sans eux, l'exécutable est
  construit mais pas signé) ; `TIEE_SIGN_KEY_MDP` si la clé est protégée par un mot de passe.

Puis `git tag v19.14.0 && git push origin v19.14.0` : GitHub construit, vérifie (lancement, mauvais et bon mot de
passe, signature) et publie l'exécutable, le kit et leurs empreintes SHA-256 dans les *Releases*. « Run workflow »
(onglet Actions) fait la même chose sans publier (fichiers gardés 30 jours). Changer de mot de passe : modifier le
secret et publier une nouvelle version (les anciennes copies gardent l'ancien).

**Ce qui ne sort plus.** `TIEE-Simulator.html` n'est plus dans le kit, `dist/index.html` n'est plus versionné, et
l'intégration continue ne publie plus la page construite dans les fichiers de ses exécutions.

**Les limites, à connaître.**
- Tant que le **code source** (`src/`) est public, quelqu'un qui sait se servir de Node.js peut reconstruire le
  simulateur sans mot de passe (`npm ci && npm run build`), et l'historique git garde les anciennes versions de
  `dist/index.html`. Pour fermer cette porte, il faut rendre le dépôt privé (*Settings → General → Danger Zone →
  Change visibility*) ; les *Releases* d'un dépôt privé ne sont alors visibles que de ses membres (on distribue
  l'exécutable par l'ENT, un partage de fichiers ou une clé USB).
- Une personne qui a le mot de passe voit la page dans son navigateur et peut l'enregistrer : le mot de passe
  écarte ceux qui ne l'ont pas, il n'empêche pas un utilisateur autorisé de copier.
- Sur le réseau local, la page circule en HTTP : le mot de passe aussi, au moment où un joueur le tape.
- La solidité dépend du mot de passe : un mot de passe court ou courant se devine en partant du fichier. Un mot de
  passe de trois lettres écarte les curieux, pas quelqu'un de déterminé : scrypt rend chaque essai coûteux, mais
  quelques centaines de milliers de combinaisons s'essaient en quelques heures sur un PC (ordre de grandeur).

Tests : `tests/unit/acces.test.mjs` (coffre, serveur protégé, ce qui est servi avant et après le mot de passe,
essais limités), `node tools/e2e.mjs acces` (écran d'accès, mauvais et bon mot de passe, ouverture du simulateur,
second navigateur, téléphone), `node tools/exe.mjs --verifier` (exécutable chiffré et signé, lancé pour de vrai).
## v19.13 : les ralentis et l'intercom en 3D (lot 3)

**Pourquoi.** Suite des postes en 3D (lot 3 de la feuille de route, validé le 26 octobre 2026 avec l'écran partagé) :
la télécommande des ralentis, dont le levier et la molette se manient à la main, et le pupitre d'intercom.

**Le poste ralentis** (`src/poste3d/lsm.js`, `src/poste3d/ralentis.js`). La télécommande LSM (type EVS, logiciel
Multicam) est construite en 3D sur le bureau des ralentis, à la place de la texture plate : l'afficheur (quatre
lignes : sortie pilotée, angle, timecode et retard sur le direct, IN et OUT, enregistrement), les touches F1 à F10
(clips de la page), les touches d'angle (CAM A à H, les entrées enregistrées), le bloc opérationnel (IN, OUT, PLST,
LOOP, RETURN, LIVE, PLAY, FAST JOG, TAKE, PGM/PRV, SHIFT, MENU, CLEAR, PAGE, avec la fonction SHIFT sérigraphiée) et les
raccourcis du simulateur (DERN. ACTION, REC, opérateur automatique). Le **levier de vitesse** se pousse (loin de soi =
plus vite ; la bulle dit si le ralenti est fluide ou saccadé selon la cadence de la caméra) ; la **molette jog** se
tourne en glissant autour d'elle (un tour ≈ 35 images, comme la molette Multicam), à la molette de la souris ou aux
flèches. À droite : EVS A, EVS B, le programme et l'écran du serveur (trains d'enregistrement, cliquer pour se placer ;
clips de la page ; playlist). « Tous les réglages » : la télécommande à plat, avec les préréglages du levier. Le clavier
et la souris d'IPDirector restent dessinés à côté.

**Le poste intercom** (`src/poste3d/icom.js`, `src/poste3d/intercom.js`). Le pupitre du réalisateur, sur le bureau de
production : deux rangées de neuf modules, chacun avec son afficheur (le canal, son type : conférence, point à point,
IFB, 4 fils, hybride, relais), TALK et LISTEN ; au fond, le micro col de cygne et le haut-parleur. Cliquer un afficheur
explique le canal. À droite : le multiview et le programme (ce que regarde le réalisateur), le journal de l'intercom
(les ordres et les micros ouverts) et l'état du pupitre (micros ouverts, canaux écoutés). « Tous les réglages » : le
pupitre à plat, le trajet d'un ordre jusqu'au cadreur, le tally.

**Gestes communs.** Comme pour la vision (`RCPACT`), l'état et les gestes sont partagés entre le poste à plat et la
3D : `LSMACT` (`ui/st_evs.js`, avec l'écran du serveur `evsScreen`) et `ICOMACT` (`ui/st_intercom.js`, sorti de
`ui/stations.js`). L'état pur (touches allumées, afficheur, canaux) est dans les fichiers du matériel, que `truck.js`
importe sans dépendre de l'interface. Le moteur sait une nouvelle commande, la **molette sans butée** (`jog`), et des
attributs libres sur les zones cliquables (`data-id` des touches d'angle, que vise Olivier). Les parcours d'Olivier
pour l'intercom visent maintenant la touche par son nom (`.icp-talk[aria-label="TALK CAMÉRAS"]`), en 2D comme en 3D.

Tests : suites `poste3d-evs` et `poste3d-intercom` (`node tools/e2e.mjs poste3d-evs`, `… poste3d-intercom`).

## v19.12.1 : correctif, le panneau des écrans qui descendait sans fin

Retour du 25 octobre 2026 : au poste vision en 3D, sur les RCP, la fenêtre de droite descendait à l'infini. Les
écrans du panneau (Grade 1, multiview, programme du son) sont une copie du rendu WebGL dans un petit canevas
(`mirrorSlots`, `src/poste3d/index.js`) dont la taille est en pixels réels de l'écran. Sur un écran à forte densité
(Retina, HiDPI : 2 pixels réels par pixel CSS), ce canevas restait dans le flux de la page, agrandissait le moniteur,
qui demandait alors une copie plus grande à l'image suivante, et ainsi de suite. La copie est désormais posée
par-dessus le moniteur (position absolue, 100 %) dans tout le poste 3D, pas seulement dans le tiroir
(`src/styles/poste3d.css`). Les tests tournaient en densité 1 : `tests/e2e/poste3d-vision.mjs` vérifie maintenant,
en densité 2, que les écrans des postes vision et son gardent leur taille.

## v19.12 : l'écran partagé, le pupitre en 3D et les écrans du poste en 2D

**Pourquoi.** Retour du 25 octobre 2026 sur la v19.11 : au poste vision, la vue 3D regardait les RCP et l'on ne voyait
plus le multiview ni l'oscilloscope, donc plus l'effet de ses réglages. Il faut pouvoir tourner autour du matériel et
garder les écrans du poste sous les yeux, à chaque poste.

**L'écran partagé** (`src/poste3d/index.js`, `src/styles/poste3d.css`). À gauche, le pupitre en 3D ; à droite, un
panneau 2D (46 % de la largeur) :
- en haut, **les écrans du poste en direct** (chaque définition de poste les fournit, `monitors`) : au mélangeur le
  multiview, le PGM et le PVW ; à la vision le moniteur de référence Grade 1 (SDR, HDR HLG ou les deux), le multiview et
  le PRISM interactif (waveform, parade, vecteurscope, gamut) de la caméra au RCP ; au son l'image du programme, les
  vumètres, la corrélation et la loudness. Les images vidéo sont recopiées du rendu WebGL à chaque image ;
- en bas, deux onglets : **Fiche** (la zone, les réglages en 2D) et **Ce qui se passe** (un point signale une nouvelle
  explication) ; « ▾ » replie le bas du panneau pour donner toute la hauteur aux écrans.

**La caméra tourne autour du pupitre**, comme celle du Cours : glisser pour tourner (sans passer derrière le pupitre),
clic droit ou Maj + glisser pour déplacer, molette ou pincement pour s'approcher, double-clic pour revenir à la vue ;
l'œil reste dans le car. Les vues prédéfinies y volent en douceur ; la vue d'ensemble de chaque poste cadre maintenant
le pupitre (les écrans sont dans le panneau), et la caméra recule d'elle-même quand la zone 3D est étroite.

Au passage : `visionMonitors` (`ui/st_vision.js`) et `drawMeters` (`ui/st_audio.js`) sont partagés entre le poste 2D et
le panneau ; le tiroir « Tous les réglages » de la vision ne refait plus les écrans (`noMonitors`).

Tests : les suites `poste3d`, `poste3d-vision` et `poste3d-son` vérifient les écrans du panneau ; `poste3d` vérifie
l'orbite, le rapprochement, le retour à la vue et le repli de la fiche.

## v19.11 : la vision et le son en 3D, le tiroir « Tous les réglages »

**Pourquoi.** Suite du prototype v19.10 (lot 2 de la feuille de route) : les deux postes où l'on règle le plus de
matériel à la main, l'ingénieur vision et la régie son.

**Le moteur des postes en 3D** (`src/poste3d/index.js`) sait maintenant :
- des **molettes** (glisser vers le haut ou le bas, molette de la souris, flèches, double-clic pour revenir à la valeur
  nominale), des **glissières** le long d'une course 3D (barre T, faders, joystick), des **touches maintenues**
  (talkback) ;
- des commandes qui **changent avec l'état** (le RCP qui a la main) et des vues calculées (le siège, le RCP choisi) ;
- des zones cliquables **découpées à la forme** de la commande projetée : en vue de biais, deux faders voisins ne se
  recouvrent plus ;
- **« Tous les réglages »** : un tiroir qui contient l'interface 2D complète du poste, pour ce que le matériel 3D ne
  porte pas (pages, matrices, instruments). Ses moniteurs vidéo sont recopiés du rendu WebGL. Quand l'élément
  qu'Olivier veut montrer est dans le tiroir refermé, son repère montre le bouton qui l'ouvre (`ui/tutor_ui.js`).

**Le poste vision** (`src/poste3d/rcp.js`, `src/poste3d/vision.js`). La rangée de RCP du bureau vision est construite
en 3D : un RCP par caméra (CAM 1 à 6 devant la vision 1, CAM 7 à 16 devant la vision 2) et le MSU au milieu, avec ses
voyants TALLY et CALL, son écran (diaphragme, gain, ND, ON AIR / PVW), ses touches, ses molettes WHITE et BLACK et son
joystick (le manche suit l'iris, la bague le master black). Un clic sur un RCP lui donne la main (moniteur de
référence, PRISM) ; sur ce RCP, chaque commande agit comme en 2D, dont le verrou PANEL ACTIVE ; l'écran tactile ouvre
ses pages (PAINT, GAMMA / KNEE, GAIN / ND / SHUTTER, SCÈNES) sur la fiche. Le tiroir contient le RCP complet, le PRISM
interactif et le tableau de matching. Les gestes sont mis en commun (`RCPACT`, `lcdPage` dans `ui/st_vision.js`).

**Le poste son** (`src/poste3d/son.js`) sur la console de la cabine (`audiodesk.js`, qui expose sa géométrie) :
faders des 20 tranches, master PGM et VCA des commentaires, SEL / PFL / MUTE, sur l'écran Vistonics la molette GAIN
(en bas) et la molette PAN (en haut), et la Control Bay (écoutes, DIM, MONO, talkback maintenu, suivi du jeu,
limiteur). Le tiroir contient la console à plat (couches, égaliseur, dynamique, E/S et patch, bus et N-1, snapshots,
commentaires). Les gestes sont mis en commun (`AUACT` dans `ui/st_audio.js`).

Tests : `node tools/e2e.mjs poste3d-vision` et `poste3d-son` (matériel construit, commandes, verrou, joystick,
molettes, faders, talkback, tiroir et moniteurs recopiés, parcours « Exposer une caméra au RCP » et « Corriger une
tranche » suivis en 3D).

## v19.10 : le poste du truquiste en 3D, devant le vrai pupitre (prototype)

**Pourquoi.** Retour du 25 octobre 2026 : aux postes, l'interface 2D en plein écran fait perdre le matériel de vue.
On voulait s'asseoir devant le pupitre en 3D, avec les explications par-dessus. Le poste Mélangeur sert de prototype
au modèle qui servira aux autres postes.

**Le pupitre en 3D** (`src/poste3d/icp.js`). Le panneau de commande type ICP-X7000 est construit touche par touche
sur le bureau de la régie de production (il remplace l'image plate) : trois rangées de croisement de 22 touches avec
leur OLED (le nom de la source suit la grille), clé 1 (coin, taille), DSK 1 et 2, FTB, mémoires (STORE, SNAP 1 à 8),
module de transition (NEXT TRANS, motifs, types, durée sur un afficheur, CUT, AUTO TRANS) et une barre T dont la
poignée bouge, écran du menu qui résume la M/E. Les touches s'allument comme sur le vrai pupitre (rouge à l'antenne,
vert en preset, jaune pour la clé), en marchant dans le car comme au poste. Châssis et habillage en matières
(`matiere()`, `Builder` en mode `ao`), touches en deux maillages instanciés (corps, dessus lumineux avec sa légende).
La disposition est celle d'un pupitre de cette classe, simplifiée : à faire relire.

**Le poste en vue 3D** (`src/poste3d/index.js`, `src/poste3d/melangeur.js`, `src/styles/poste3d.css`). On prend le
poste comme avant (E, pupitre, chef de car) ; la vue est celle de l'opérateur, et une couche d'interface légère se
pose par-dessus :
- une **zone cliquable** transparente sur chaque commande, recalée à chaque image sur la touche 3D : clic, Tab et
  lecteur d'écran, et les parcours d'Olivier visent les mêmes sélecteurs qu'en 2D (son repère encadre la touche 3D) ;
- une **bulle** au survol : le nom de la commande, son rôle, la source qu'elle porte, son raccourci clavier ;
- des **étiquettes** sur les zones du pupitre et des **vues** (le poste, croisements, transition, clé et DSK, menu
  et mémoires, écrans) ; glisser pour regarder autour, molette pour zoomer, double-clic pour revenir ;
- à droite, la **fiche** de la zone (et les réglages de l'écran du menu en 2D : durée, taille de la clé, mode du
  clavier), puis le fil **« Ce qui se passe »**. La scène se recentre dans la partie libre de l'écran.
- La **barre T** se tire à la souris ou au doigt (ou aux flèches) ; la poignée et l'afficheur suivent.

Les gestes sont ceux de la vue 2D (`MIXACT` dans `src/ui/st_mixer.js`, mis en commun). Le bouton **Vue 2D / Vue 3D**
de l'en-tête bascule, le choix est mémorisé ; la vue 2D reste le défaut en mode allégé et en qualité Basse.

Tests : `node tools/e2e.mjs poste3d` (pupitre dans le car, zones cliquables nommées, survol, gestes, barre T, réglages
du menu, repère du chef de car sur la touche 3D, parcours « Préparer, couper et enchaîner » jusqu'au bout, bascule
2D / 3D, caméra rendue à la marche).

## v19.9 : le téléphone, une seule porte vers tout ce qui n'est pas dans le décor

**Pourquoi.** Retour du 25 octobre 2026 : trop de boutons et de touches à connaître (Pupitre, Missions, Chef de
car dans la barre d'outils, Missions et Chef de car en tête de chaque poste, une touche par outil). Comme dans un
GTA ou un Schedule 1, tout ce qui n'est pas dans le décor passe par un **téléphone** qu'on lève devant soi.

**Le téléphone** (`src/telephone/`, touche **Tab** ou **T**, bouton **Téléphone** du HUD et de l'en-tête des
postes). Un smartphone en 3D monte dans la main, à droite de l'écran (au centre sur un petit écran) ; son écran est
une vraie page (texte net, cliquable, lisible au clavier). Barre d'état avec l'heure du car (timecode), accueil avec
le lieu, l'objectif en cours et le niveau, puis les applications rangées dans les **trois familles** des menus :
- **Le car** : Aller à (plan du car, postes par zone, stade et compound, équipiers ; remplace le pupitre),
  Missions (le journal, pastille du nombre d'exercices au poste), Olivier (le chef de car), Plan caméras,
  Synoptiques, Matériel, Équipe (en coopération) ;
- **Cours** : Cours (au poste, la leçon du poste), Glossaire, Les postes, Progression (niveau et badges, Mon suivi,
  livret de compétences) ;
- **Réglages** : Réglages, Commandes ; en bas, trois interrupteurs (son, vol libre, retour PGM).

Une application s'ouvre sur l'écran du téléphone (Aller à, Progression) ou range le téléphone et ouvre sa fenêtre
habituelle. Échap revient à l'accueil puis range le téléphone, Tab le range, les flèches passent d'une application
à l'autre, un clic à côté le range. Les anciennes touches (P, Y, K, G, L, J, H, M, V) restent des raccourcis : elles
rangent le téléphone et font ce qu'elles faisaient. Car pré-installé (jeu libre) : ni Missions ni Olivier.

**Ce qui disparaît.** Le pupitre (`ui/pupitre.js`) ; dans la barre d'outils, Pupitre, Missions et Chef de car (il
reste le niveau, Téléphone et Menu) ; en tête des postes, Missions et Chef de car (remplacés par Téléphone). Les
textes d'Olivier, les conseils et la liste des commandes parlent du téléphone.

**Le rendu.** Le boîtier (aluminium, vitre, boutons, module photo, port USB-C) est construit par un `Builder` en
mode `ao` et habillé par `matiere()`, éclairé par une pièce procédurale (`RoomEnvironment`, aucun fichier), dans son
propre petit rendu WebGL posé par-dessus tout (il marche aussi par-dessus un poste ou le plan) ; les quatre coins
de la vitre sont projetés avec la même caméra et une transformation projective CSS (`matrix3d`, `cssProjection`) y
amène l'écran, si bien qu'il suit le téléphone quand il monte ou qu'il se range (un calque `CSS3DRenderer` a été
écarté : Chrome n'y fait pas arriver les clics). Au repos, l'écran est à l'échelle 1 (340 × 740 px) dès que la fenêtre le permet. Le rendu ne tourne que
pendant l'animation (environ 0,3 s) ; sans WebGL, l'écran s'affiche seul, avec un cadre dessiné.

Tests : `tests/unit/telephone.test.mjs` (la projection de l'écran), `node tools/e2e.mjs telephone` (HUD réduit, lever et ranger, familles et applications, Aller à jusqu'au
poste, téléphone par-dessus un poste, raccourci P, jeu libre, petit écran tactile).

## v19.8 : trois façons de jouer au car régie, le suivi des tâches sur le côté, Olivier en boîte de dialogue

**Pourquoi.** Retour du 24 octobre 2026 : les modes du car mélangeaient les phases (un car « installé » où le chef de
car et les missions restaient partout, une « visite guidée » à part, des exercices notés rangés seulement dans le
Cours) ; l'objectif tenait sur une carte, et le chef de car flottait dans une petite fenêtre qui chargeait l'image.
Cette version sépare les phases en trois modes, montre les tâches sur le côté comme le journal de quêtes d'un jeu
et fait parler Olivier dans une boîte de dialogue.

**Jouer → Car régie : trois modes** (`src/app/start.js`).
- **Car vide** : tout est à faire (stade vide, car non brassé, caméras non réglées, réseau de contrôle aux adresses
  d'usine). Olivier se présente et propose d'abord **le tour du car et les postes** (la visite guidée) ou
  **directement l'installation** ; ensuite il aide quand on l'appelle (J). C'est le mode proposé d'office au premier
  lancement.
- **Car pré-installé** : tout est en place, le match en direct, **jeu libre** : ni chef de car (J), ni journal des
  missions (L), ni objectif ; un message le dit. La coopération se joue dans ce mode.
- **Mission spécifique** : une tâche précise choisie dans une liste rangée par famille (`src/game/missions.js`,
  `src/ui/missions_ui.js`) : **Installer le car** (installer et câbler les caméras, brasser le car (noté), paramétrer
  le réseau de contrôle, le line-up, prendre l'antenne, la zone technique), **Aux postes, avec Olivier** (les 40
  exercices pratiques des leçons, par chapitre du Cours), **Épreuves notées** (jour de match, atelier, formation
  réseau ST 2110). Le car est **préparé pour la tâche** (`prepa` : stade sans caméra, caméras non réglées, réseau
  d'usine, car IP ou SDI, vacation à part). Une fois terminée : bannière « Mission réussie », puis **Mission
  suivante** (la liste ; si le car convient, elle commence tout de suite, sinon le simulateur se recharge avec le car
  préparé : `memeCar`, `restart('mission:<id>')`) ou **Arrêter**. Une étape de l'installation n'est réussie que si
  ses tâches le sont pendant la partie (les postes ouverts comptent depuis le lancement). Les exercices restent
  rangés dans leur leçon du Cours : ce sont les mêmes, ils comptent une fois.

**Le suivi des tâches sur le côté** (`src/game/quest.js`, `src/styles/suivi.css`). L'objectif devient une liste :
la mission en cours, sa barre, ses tâches cochées au fur et à mesure (en cours mise en avant, les autres grisées) et
ses boutons. Car vide : les 22 tâches de l'installation en quatre groupes (les caméras, le car, prendre l'antenne, la
zone technique), le groupe en cours ouvert ; exercice d'Olivier : ses étapes (les longues listes montrent celles
autour de l'étape en cours) ; visite guidée : le tour du car et les postes (un clic emmène au poste) ; jour de match :
ses objectifs ; mission terminée : « Mission suivante » et « Arrêter ». À un poste, le panneau du poste occupe
l'écran : l'étape en cours est dans la boîte de dialogue d'Olivier.

**Olivier en boîte de dialogue** (`src/ui/tutor_ui.js`, `src/styles/chef-dialogue.css`) : en bas de l'écran, comme
dans un jeu de rôle, le portrait qui déborde du cadre, son nom sur le bandeau, ce qu'il dit, puis les gestes
(Montre-moi, un indice, Fais-le pour moi, Suivant). Plus de petite fenêtre à déplacer : la boîte passe d'elle-même en
haut de l'écran quand l'élément à utiliser est dessous (ou d'un clic, ▲ ▼), se réduit en une ligne, et occupe le
bas de l'écran sur un téléphone. Le plan de la visite est dans le suivi (et, replié, dans la boîte : « Choisir un
poste »).

**Corrigé au passage.** La tâche « Le réseau de contrôle » du car vide se cochait toute seule : en sortie d'usine, le
RCP et la CCU sont dans le même sous-réseau (192.168.0.x) et se joignent déjà. Elle demande maintenant ce que dit la
consigne : l'adresse du plan (adresse, masque, passerelle) sur le RCP et la CCU de chaque caméra installée
(`camAuPlan`, `src/net/ctrlnet.js`).

Tests : unitaires `missions` (nouveau : le catalogue, chaque tâche et chaque exercice qui existent, la préparation, ce
qui est déjà fait, quand enchaîner sans recharger) et `ctrlnet` (l'adresse du plan) ; suite de bout en bout
`modes-car` (nouvelle : les trois modes, la liste par famille, le car préparé, le suivi, la mission réussie,
enchaîner avec puis sans rechargement, la boîte de dialogue, le car pré-installé sans chef ni missions, le car vide et
sa visite, le téléphone) ; `fichier`, `navigateurs`, `navigation` mises à jour.

## v19.7 : jouer par Internet, avec quelqu'un qui est chez lui

**Pourquoi.** Demande du 24 octobre 2026 : partager le simulateur avec une personne qui joue depuis chez elle,
l'ordinateur de l'hôte faisant serveur, le plus simplement possible, et voir son avatar. Le jeu à plusieurs ne
marchait que sur un même réseau local : depuis Internet, on ne voit que la box de l'hôte, qui ne sait pas à quel
ordinateur passer les connexions.

**Pour l'hôte : un bouton** (`src/ui/session_ui.js`, bloc « Inviter quelqu'un par Internet » du salon et de l'onglet
Participants, sur l'ordinateur qui fait tourner le serveur seulement). Le serveur (`lan/internet.mjs`) :

1. **analyse le réseau** : cartes de l'ordinateur, box (nom et modèle lus dans sa description UPnP), adresse
   publique de la box et adresse vue d'Internet (api.ipify.org), profil du réseau sous Windows (« public » : le
   pare-feu bloque les connexions entrantes) ;
2. **ouvre la box tout seul** (UPnP IGD : recherche SSDP sur chaque carte, `AddPortMapping` sur WANIPConnection ou
   WANPPPConnection, port suivant si le 8080 extérieur est pris par un autre appareil, durée de 1 h renouvelée toutes
   les 20 min et retirée à l'arrêt, durée nulle si la box n'accepte que des redirections permanentes) ;
3. **dit si le lien direct peut marcher** : une box sans adresse publique à elle (adresse privée, CGNAT 100.64.0.0/10,
   ou différente de celle que voit Internet : opérateur qui partage l'adresse, deux box en cascade) ne peut pas
   recevoir de connexion ; sinon, le serveur s'appelle lui-même par l'adresse publique pour vérifier (beaucoup de
   box le permettent, pas toutes : un échec n'est pas une preuve) ;
4. sinon, propose **un lien par tunnel** (Cloudflare « quick tunnel », gratuit, sans compte) : le programme
   `cloudflared` est téléchargé une seule fois depuis sa page officielle sur GitHub (dans `%LOCALAPPDATA%\TIEE-Simulator`
   sous Windows), ouvre une connexion sortante et donne une adresse `https://….trycloudflare.com`. Rien à régler sur
   la box ni sur le pare-feu ; l'adresse change à chaque lancement.

Le lien à envoyer s'affiche avec « Copier », et aussi dans la fenêtre du serveur. « Analyse du réseau » (dépliable)
résume ce qui a été trouvé et la marche à suivre pour ouvrir la box à la main. « Fermer l'accès par Internet » referme
la box et le tunnel, comme la fermeture de la fenêtre noire (SIGHUP sous Windows). `--internet` ouvre la box dès le
lancement. L'adresse du salon montrée à l'hôte est désormais celle de sa carte réseau, plus `localhost`.

**Pour l'invité : un lien.** Il l'ouvre dans son navigateur, sans rien installer (bandeau « Par Internet »), puis
rejoint la partie comme sur un réseau local. Avec le kit (exécutable ou fichier HTML), il colle le lien dans le salon
(« Vous avez reçu un lien de l'hôte ? », onglet Rejoindre une partie). Les avatars (technicien à la couleur du poste,
pseudo et poste au-dessus de la tête, assis au pupitre, étiquette sur la caméra du cadreur) passent par le même relais
qu'en réseau local : chacun voit l'autre.

**Sécurité.** Ce qui vient d'Internet doit porter la clé du lien (`?cle=` + 12 caractères, 60 bits) : sans elle, une
page « Lien incomplet » et des refus (page, API, WebSocket). Avec elle, la clé est gardée dans un cookie `HttpOnly` et
accompagne aussi le WebSocket (cookies bloqués). Le réseau local reste sans clé, comme avant. Le tunnel arrive par une
seconde porte, sur `127.0.0.1` seulement, où tout est traité comme venant d'Internet. L'état et les commandes
(`/api/internet`) ne répondent qu'à l'hôte, sur cet ordinateur, par `localhost` (pas par le tunnel, pas par un nom de
domaine qui pointerait ici). La clé est gardée dans `cle-internet.txt` à côté du serveur (un lien direct reste valable
d'un lancement à l'autre ; effacer le fichier les annule tous).

**Pas encore essayé en vrai** : une box réelle (le protocole est vérifié face à une fausse box) et le tunnel chez
Cloudflare (un faux `cloudflared` remplace le programme dans les tests). À essayer avec un invité.

Tests : unitaire `internet` (nouveau : adresses, SSDP, description de box, SOAP, fausse box UPnP : ouverture,
renouvellement, fermeture, port pris, redirections permanentes, refus, box sans adresse publique) ; `lan` complété
(clé, commandes réservées à l'hôte, tunnel, refus sans clé, client du jeu par le tunnel) ; suite de bout en bout
`internet` (nouvelle : hôte sans box, lien par tunnel, invité sans clé puis avec, partie rejointe, avatars des deux
côtés, lien collé dans le salon d'un autre ordinateur, fermeture) ; `reseau-local`, `session` et `fichier` repassées ;
`node tools/exe.mjs --verifier` contrôle aussi le module Internet.

## v19.6 : la Carrière, un mode scénarisé : le bureau de l'entrepôt et ses mails

**Pourquoi.** Les activités du simulateur étaient rangées côte à côte (les exercices dans les leçons du Cours,
les modes du car et les missions de l'entrepôt dans Jouer) sans fil qui les relie. La Carrière leur donne un
ordre et une raison d'être, comme dans un jeu de gestion à la première personne : on arrive au bureau de
l'entrepôt, un ordinateur reçoit des mails qui proposent un poste sur une prestation, on accepte, on réussit la
mission, la suivante arrive. Le mode libre reste ce qu'il était (le bac à sable de l'entrepôt, le car installé).
Ce premier lot pose la boucle de bout en bout avec deux missions ; la marche à la première personne dans
l'entrepôt et la saison complète viennent ensuite (`ROADMAP.md`).

**Jouer → L'entrepôt → Carrière** (premier mode du lieu, choisi d'office ; `src/app/start.js`). La touche dit où
l'on en est (« 2 mails non lus au bureau. Mission en cours : … ») et le bouton passe de « Commencer ma
carrière » à « Retourner au bureau ».

**Le bureau** (`src/entrepot/scene/bureau.js`), à l'avant gauche du hall : une table, un fauteuil, l'unité
centrale, le clavier et l'écran, qui montre la messagerie et ses mails non lus (texture redessinée quand ils
changent ; hors Carrière, « Session verrouillée »). En Carrière, l'entrepôt s'ouvre assis devant l'écran, sur la
messagerie ; elle se rouvre d'un clic sur l'écran ou l'unité centrale dans la 3D, par la pastille
« Messagerie · n » ou par la touche **Messagerie** de la barre (avec le nombre de mails non lus) ; la zone
**Bureau** rejoint Baie, Table, Plateau et Mur.

**La messagerie** (`src/carriere/ui.js`) : la boîte de réception du plus récent au plus ancien (expéditeur,
objet, date, état de la mission), puis le mail ouvert (lu dès qu'on l'ouvre). Une proposition porte son **ordre
de mission** : le poste, le lieu, la mission, la durée, ce qu'on attend (coché d'après la progression) et le
bouton qui y emmène. Les textes expliquent chaque mot du métier à sa première apparition (car régie, compound,
caméra PTZ, tally, N-1…). La société est celle que règle le formateur (Réglages → espace formateur → Le car,
« Société / service »), sinon un nom fictif, **TIEE Prestations**.

**La saison 1** (`src/carriere/mails.js`) :
1. **Stagiaire** : Nadia, chargée de planning, envoie au stade. Le car se lance en **visite guidée réduite** au
   tour du car et à six postes (réalisateur, truquiste, ingé vision, opérateur ralenti, ingé son, chef de car) ;
   ce qui est déjà vu est coché, la visite reprend au premier arrêt qui reste. À la fin, Olivier dit « Mission
   accomplie » et propose **Retourner à l'entrepôt** (le simulateur se recharge sur le bureau : `app/nav.js`).
   Le mail de retour d'Olivier résume qui fait quoi.
2. **Assistant technique** : la remise des diplômes du lycée, c'est-à-dire la mission « Conférence à trois
   caméras PTZ » de l'entrepôt. « Commencer le montage » ouvre son cahier des charges (le montage déjà commencé
   est repris) ; rendue à 60 / 100 au moins, Nadia répond avec la note.

**Rien ne se compte deux fois** (`src/carriere/index.js`, calcul pur). Une mission est réussie quand l'activité
qu'elle reprend l'est : les parcours « prise-en-main » et « poste-* » terminés (`PROG.tutor`), le meilleur
résultat de la mission de l'entrepôt (`PROG.entrepot`). Ce qui est acquis ailleurs l'est ici ; le livret et l'XP
ne voient que ces activités (aucune XP de plus, aucun rattachement nouveau). Seul un badge s'ajoute :
**Embauché**, la mission de stagiaire réussie en Carrière. Un mail arrive quand son épisode s'ouvre (ses requis
réussis), son retour quand sa mission est réussie, avec une notification (au car : « Il t'attend au bureau de
l'entrepôt »).

**Progression v3** (`src/shared.js`). `PROG.carriere` ne garde que la date de réception et de lecture de chaque
mail ; `PROG_VERSION` passe à 3 (une Carrière abîmée est remise en forme), deux appareils fusionnent en gardant
la date la plus ancienne, l'import accepte une progression qui n'a que la Carrière.

Tests : unitaire `carriere` (le moule des épisodes, l'ordre d'arrivée des mails, la visite et la mission de
l'entrepôt lues dans la progression, la lecture, la fusion, la mise à niveau v2 → v3, le badge) ; suite de bout en
bout `carriere` (Jouer, le bureau et son écran cliqué dans la 3D, le premier mail, le car en visite de stagiaire,
« Mission accomplie », le rechargement sur le bureau, la conférence montée et rendue, le mail de retour, Jouer qui
résume, la messagerie à 390 px).
## v19.5 : un rendu de jeu vidéo : matières, relief, lumière, décor

**Pourquoi.** Le simulateur faisait « brut de décoffrage » : des boîtes à arêtes vives en couleurs unies, aucun
relief de surface, rien qui touche le sol, un car éclairé à plat, un décor vide. Le moteur, lui, était déjà celui
d'un jeu (matériaux physiques, environnement capturé, courbe ACES, halo, ombres douces) : c'est le contenu que cette
version refait, sans aucune ressource externe (tout reste généré par le code dans la seule page) et sans toucher à
la qualité Basse, qui garde le rendu d'avant pour les ordinateurs les plus faibles.

**Des matières procédurales** (`src/matiere.js`). Une recette par surface (tôle peinte, tôle nervurée, aluminium
brossé, plastique grainé, stratifié, caoutchouc à pastilles, moquette, bitume, béton, mousse acoustique, tissu,
acier thermolaqué, tôle larmée, herbe) génère en code des cartes tuilables de **normales** (relief), de **rugosité**
et de **variation de teinte** (bruit de valeur périodique, 256 × 256, mises en cache). `matiere(recette, options)`
donne un `MeshStandardMaterial` qui les plaque en **triplanaire** (par la position dans le monde, mélange
« whiteout ») : les géométries fusionnées du `Builder`, sans UV, en profitent telles quelles, et une texture UV
(livrée du car, enrobé, parvis) s'y ajoute. Le relief se coupe sans recompiler la scène (`MATIERE.setDetail`,
suivi par Réglages → Qualité) : en Basse et en mode allégé, les matériaux restent unis.

**Des formes et des ombres de contact** (`src/geo.js`). `roundedBox` : une boîte aux arêtes arrondies en three.js
de base (projection sur la boîte intérieure, normales exactes) ; `Builder.cbox` pour l'utiliser. En mode `ao`, le
`Builder` subdivise les grandes faces et **cuit l'occlusion ambiante par sommet** à la fusion (rayons hémisphériques
contre les boîtes de la pièce, partagées entre plusieurs `Builder` par `occluders`) : coins de pièce, dessous de
bureau, pieds de baie et de chaise s'assombrissent sans coût au rendu ; les pièces menues (gobelets, boutons) en sont
dispensées. Dans le car, une **occlusion ambiante d'écran** (SSAO, `src/render.js` : pré-passe normales + profondeur
à demi-résolution, 12 échantillons, flou qui respecte les arêtes) complète la cuisson en Moyenne et Haute ; les
écrans et les LED y échappent (pondération par la luminance). `?noao` la coupe pour comparer.

**L'intérieur du car** (`src/truck.js`) : une pièce fusionnée par famille de matière (parois en tôle, sol en
caoutchouc, bureaux en stratifié à nez d'aluminium chanfreiné, baies thermolaquées à rails 19", sièges en tissu
à cinq branches et accoudoirs, plastiques, mousse acoustique du son, seuil en tôle larmée), **pénombre d'un vrai
car** : hémisphère réduite, un spot au-dessus de chaque poste, la lueur froide des murs d'écrans sur les pupitres ;
**accessoires** : échelles à câbles et torons au plafond, descentes derrière les baies et les murs d'écrans,
jarretières devant la baie de brassage, casques d'intercom, boîtiers, blocs-notes, gobelets, extincteur, trousse de
secours, tableau électrique, goulotte de prises, bouches de climatisation, horloges, poignée et joints de porte.

**L'extérieur** (`src/vehicles.js`, `src/world.js`, `src/landscape.js`) : caisse et extensions arrondies, livrée
sur **tôle nervurée**, portes arrière à crémones et charnières, passages de roues, bavettes, feux de gabarit,
plaque, pare-chocs, auvent du pied de car ; tracteur à **pare-brise courbe**, pare-soleil, calandre à lames,
rétroviseurs, marchepieds, antibrouillards ; DSNG, groupe (armoire de commande, prises P17) et bungalows (cadres de
fenêtres, marches) arrondis et en matière. Le compound : **bitume en relief** avec flaques qui reflètent le ciel,
barrières de chantier grillagées sur plots, cônes, rampes de câbles à cinq voies, bobines, flight cases à cornières
et roulettes, palette, poubelle, lampadaires, câbles d'énergie au sol et câbles vers le pied de car. Les **arbres**
sont des plans croisés à découpe alpha (feuillage peint en code, écorce, ombre découpée) à la place des sphères.
Le stade : béton des tribunes et du parvis en relief, pylônes en acier, **sièges et gradins en relief** (mode UV de
`matiere` : la carte de normales suit la texture des sièges, coques arrondies, dossiers, contremarches).

**L'entrepôt** (`src/entrepot/scene/hall.js`, `scene.js`) : béton du sol en relief, bardage en tôle, baie thermolaquée, plateau de
table en stratifié à nez d'aluminium, moquette de l'estrade, cartons et flight cases grainés ; une carte d'environnement du hall
(lanterneaux, murs, sol) donne des reflets aux métaux et aux façades. Les matières libérées avec le bac sortent de la liste.

**Second passage du car (19.5.1)** : deux afficheurs de timecode à LED rouges dans les murs d'écrans (production, vision), à
l'heure du car ; conducteurs d'émission sur les bureaux ; murs d'écrans ramenés sous le plafond. Et les défauts signalés en
classe : le **moiré** venait de motifs trop fins (tissage à 1,5 mm, stries de brossage, micro-rayures) : les recettes ont des
périodes d'au moins 4 mm et une anisotropie de 8 ; les surfaces qui **sautaient** étaient des faces coplanaires (nez de bureau
sur le plateau, socle des écrans EVS, lames des bouches de climatisation, seuil sous le balisage) et le bruit du SSAO
qui changeait à chaque image : tout est décalé ou fixé, et les accessoires sont posés sur la surface des plateaux.

**Vérifier.** `node tools/e2e.mjs rendu` (`tests/e2e/rendu.mjs` : familles de matières, relief actif / coupé selon
la qualité, occlusion cuite, spots, SSAO, accessoires, extérieur, arbres ; captures à regarder) ;
`tests/unit/matiere.test.mjs` (bruit tuilable, recettes bornées et tuilables, normales, boîtes arrondies,
occlusion cuite, `Builder` en mode ao).

**Performances.** Les matières coûtent six lectures de texture par pixel (relief et surface sur trois
projections) ; le SSAO, une passe de géométrie à demi-résolution dans le car seulement. Le car reste en quelques
appels de rendu par famille (82 000 triangles). À mesurer sur le PC le plus faible : si Moyenne tombe sous
30 i/s, le diagnostic de performance (Réglages) recommande Basse, où tout cela est désactivé.

## v19.4.1 : un son supportable, à sa place

**Pourquoi.** Retour du 23 octobre 2026 : le bruit de foule était insupportable, violent dès le lancement de la
partie, et les commentaires dits par la synthèse vocale sonnaient trop robotiques. Mesuré : on entendait partout
(devant le car, dans le car, à n'importe quel poste) le PGM de la console à son niveau de diffusion, environ
−24 LUFS de foule continue dès la première image.

**Le son suit le joueur** (`src/audio.js` : `ecoute`, `setEar`, appelés par `src/main.js` avec `earState`). La console
ne change pas (vumètres, loudness, départs, exercices) : seule l'écoute du joueur dépend de l'endroit. Au **poste
son**, l'écoute de la console (bus écouté, PFL, DIM, mono, retard de ligne), 9 dB sous le niveau de diffusion ; dans
la **cabine son**, debout, les mêmes haut-parleurs de plus loin ; **ailleurs dans le car**, presque rien (la cloison,
l'isolation). **Dehors**, la foule telle qu'elle sonne sur place (les couples d'ambiance avant la console, les frappes
et le sifflet selon la distance) : entière sur la pelouse et dans les gradins, masquée derrière les tribunes (une
rumeur grave) devant le car, où commence la partie, plus faible encore au loin. Le cadreur écoute depuis sa caméra ;
l'écran d'accueil, l'entrepôt et la caméra en 3D sont silencieux. Le son monte en douceur au lancement. Mesures à
la sortie, en dBFS RMS (rendu logiciel) : devant le car −51, pelouse et gradins −36, poste son −39, cabine son −51,
autre poste du car −70 ; avant : −28 partout.

**Un volume du son** dans Réglages → Sur cet ordinateur (`carregie.volume` ; 0,7 = niveaux de référence, 30 dB de
course, 0 = silence) ; l'option Son devient « Activé / Coupé » (Réglages et écran Jouer).

**Les commentaires ne sont plus dits** (`src/commentary.js`) : plus de synthèse vocale. Le fil écrit reste au poste son
(onglet Commentaires) avec leurs niveaux simulés (vumètres des tranches COMM, loudness, lampe rouge de la cabine) et la
mention « non entendu » quand la console les ferme : les exercices du poste son (lancer le bord terrain, N-1,
international) marchent comme avant. La voix du chef de car et celle du réalisateur virtuel restent au choix (coupées
par défaut).

Tests : unitaire `ecoute` (nouveau : chaque endroit, pas de saut en sortant des gradins, volume) ; suite de bout en
bout `ecoute` (nouvelle : niveaux mesurés par endroit, aucune voix de synthèse, fil écrit, volume dans les Réglages) ;
`direct-son` et `jeu` repassées.

## v19.4 : consolider le car régie : des preuves d'apprentissage fiables, une progression sûre

**Pourquoi.** Le constat du 23 octobre 2026 l'a montré : le livret pouvait dire « consolidée » sans que
l'étudiant sache faire seul. Dans les 111 questions des leçons, la bonne réponse n'était en troisième position
que 4 fois ; elle s'affichait dès la première erreur, et « Refaire le quiz » reposait les mêmes questions. Un
exercice fait entièrement par « Fais-le pour moi » comptait comme réussi, une panne qu'on s'injecte avec son
remède sous les yeux rapportait de l'XP sans limite. La progression, enfin, pouvait se perdre sans un mot. Cette
version consolide le car régie avant tout nouveau lieu ; l'entrepôt n'est pas touché.

**Le quiz d'une leçon vérifie vraiment** (`src/ui/cours_ui.js`, `src/cours/index.js` : `drawQuiz`, `QUIZ_N`). Chaque
leçon a une **banque de cinq questions** (185 en tout, dont 74 nouvelles : des situations du car et des calculs,
chaque choix faux avec son explication), et chaque essai en **tire trois** ; « Refaire le quiz » pose d'abord celles
qui n'avaient pas été posées. Les **réponses sont mélangées** à chaque tirage. On choisit ses réponses (on peut
changer d'avis), puis « Valider mes réponses » donne le score et **le corrigé de chaque question** : pourquoi la bonne
réponse est juste, pourquoi le choix fait est faux. Le focus clavier suit (choix, score). Le module **caméra en 3D**
mélange aussi les réponses à chaque série, et les questions des quiz de chapitre (`src/camlab/quiz.js`) ; la question
sur le gain est corrigée (le rapport signal sur bruit se mesure au niveau nominal de sortie : +6 dB de gain doublent
le bruit sans changer ce niveau). Vérifié et laissé : « le BT.2020 couvre les deux tiers du diagramme xy » est juste
(le schéma de la leçon le calcule : 64 %).

**Le livret ne compte que ce qui est réussi seul** (`src/livret.js`). Un parcours d'Olivier terminé avec « Fais-le
pour moi », une mission réseau sauvée par la configuration de référence ne comptent qu'une fois refaits seuls (une
réussite seule reste acquise : `clean`, enregistré par `tutor/engine.js` et `net/course.js`, gardé par la fusion
entre appareils) ; un montage d'atelier « à retravailler » (plus de deux erreurs) ne compte pas. Une compétence est
**consolidée** avec trois réussites dont **un exercice pratique** (`estPratique` : tout sauf les leçons et les
notions de la caméra) : trois quiz ne suffisent plus. Le livret le dit, compétence par compétence (« Pour la
consolider : réussir seul un de ses exercices pratiques ») et marque « terminé avec de l'aide : à refaire seul ».

**L'XP récompense la maîtrise** (`src/game/progression.js`, `src/game/xp.js`). Seules les **pannes cachées** rapportent
(jour de match, examen, formateur, exercices) : celle qu'on s'injecte depuis le catalogue, avec son poste et son
remède affichés, ne rapporte rien. Chaque panne rapporte ses points la première fois (20, ou 35 en moins d'une
minute), puis 5 ; « Dépanneur » demande cinq pannes cachées **différentes**. Un exercice refait ne rapporte que s'il
est fait sans aide. « Érudit » demande toutes les leçons du Cours (il en demandait 40, il y en a 37). Le barème
« visite », jamais utilisé, est retiré.

**La progression ne se perd plus sans qu'on le sache** (`src/shared.js`). Elle porte un **numéro de version**
(`PROG.v`, `PROG_VERSION` = 2) et toute progression lue (navigateur, serveur, fichier) passe par `migrateProgress`, qui
la remet à la forme actuelle sans perdre les champs d'une version plus récente. Sur la page publiée, chaque
enregistrement **relit et fusionne la copie du serveur avant d'écrire** : deux ordinateurs ne s'écrasent plus. Un
**échec d'enregistrement** (stockage du navigateur plein, serveur injoignable) est dit tout de suite par une
notification (événement `progressSave`, état `SAVE`). **Réglages → Ma progression** (`src/ui/ma_progression.js`) :
où elle est enregistrée et la dernière fois, un résumé, **Exporter dans un fichier**
(`tiee-progression-AAAA-MM-JJ.json`, format `tiee-simulator/progression`), **Importer un fichier** (fusion : rien
n'est effacé, chaque réussite et le meilleur score sont gardés ; un fichier qui n'est pas une progression est refusé
avec la raison), **Effacer ma progression** (confirmation dans la page ; ce navigateur et la copie du serveur, puis
rechargement), et **Vos données personnelles** : ce qui est enregistré, où, ce qui n'est pas fait, vos droits.

**Plus de Google Fonts.** Les polices des textures du monde 3D (Barlow, Barlow Condensed, Barlow Semi Condensed,
JetBrains Mono) sont intégrées à la page comme celles de l'interface (paquets Fontsource, licence OFL,
`tools/build.mjs`) : plus aucune requête vers un service de polices (l'adresse IP des élèves n'y part plus), même
rendu hors ligne ; environ 200 Ko de plus.

**Mémoire 3D.** Une caméra du stade retirée (relance de la vacation, plan caméras, atelier, coopération) libère
maintenant ses géométries fusionnées, ses matières, la texture de son étiquette, ses câbles, son bras de grue et ses
filins (`src/bcam.js`, `ownedResources` et `releaseOverlay` de `src/world.js`). Mesuré en rendu logiciel, douze
caméras : 129 géométries au démarrage, 169 après quatre relances, sans plus monter (avant : 123, puis 283).

**Serveur réseau local durci** (`lan/serveur.mjs`). Une autre page web ouverte sur le réseau ne peut plus rejoindre
les parties ni écrire de compte rendu : l'origine est vérifiée (WebSocket et `/api/rapport`, qui exige aussi du
JSON). Les fragments d'un message comptent ensemble (4 Mo au plus), une présence est limitée (64 Ko, 60 clés ; les
clés `__proto__` et voisines sont ignorées), les connexions (300, dont 20 par adresse, sauf la machine de l'hôte), les
parties (50) et les comptes rendus (6 par minute et par adresse, 500 dans le dossier) sont plafonnés. En coopération,
une panne forcée n'est acceptée que de l'hôte ou du formateur (`src/multi/session.js`) ; le rôle de formateur se
choisit encore librement dans le salon (`ROADMAP.md`).

Tests : unitaires `cours` (banque, tirage, mélange), `camlab-suivi` (réponses et questions mélangées), `livret`
(aide, atelier, exercice pratique), `xp` (Érudit, barème), `progression` (nouveau : mise à niveau, fusion, export,
import, refus), `bcam-memoire` (nouveau : chaque ressource d'une caméra libérée), `lan` (origine, fragments,
présence piégée ou trop grosse, comptes rendus) ; suite de bout en bout `progression` (nouvelle : la section,
export, import, refus, stockage plein signalé, effacement, aucune requête de polices), `cours` (corrigé caché avant
de valider, une erreur, nouveau tirage) et `camera` mises à jour.

## v19.3 : l'interface jeu : objectif à l'écran, XP, badges, bruitages

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

**Un HUD épuré : trois blocs.** À l'arrivée dans le car régie, l'écran ne montre plus que l'objectif en haut à
gauche (sa première ligne est le lieu : compound, car régie · production…), la barre d'outils en haut à droite
(le niveau et sa barre d'XP, Pupitre, Missions, Menu ; le chef de car pendant un exercice) et la bande d'état en
bas à gauche (timecode, match, antenne ; les alarmes seulement s'il y en a), plus le retour PGM. Le bandeau de lieu,
le PVW et les images par seconde de la bande, les boutons Cours et Son de la barre (dans le menu, le pupitre et les
réglages), le mini-plan du car (le pupitre a le plan ; Réglages → Jeu le remet), le panneau du jour de match (ses
objectifs et ses boutons Phase suivante / Abandonner sont dans l'objectif) et les messages d'arrivée ont disparu.
La prise en main tient sur une ligne en bas, une fois, et s'efface d'elle-même (40 s, ou E, Tab, L).

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
`faultNew` / `faultSolved`, `teleport`, `quiz`, `camlab`, `netMission`, `scenarioDone`, `entrepotRendu`, `xp`, `badge`, `journal`.

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
## v19.2 : l'entrepôt, une régie mobile à monter de A à Z

**Le lieu « L'entrepôt »** est une tuile de l'écran Jouer, à côté du car régie (`src/entrepot/`). On y monte une
régie mobile d'après le cahier des charges d'un client : sortir le matériel du stock, le poser dans la baie 19"
(12 U), sur la table ou sur le plateau, le brancher au secteur, le câbler, le configurer, jusqu'à ce que tout
marche. Ses « modes » : trois missions notées, le bac à sable, la reprise du dernier montage.

- **Les missions** (`missions.js`) : *Conférence à trois caméras PTZ* (le lycée, budget 25 000 € ; c'est
  l'exercice noté `x-entrepot` de la leçon « Monter une régie mobile », chapitre L'exploitation), *Plateau TV deux
  caméras, ISO et streaming* (ATEM HD8 ISO, disque USB-C, box Internet), *Régie vMix : NDI, SDI, HyperDeck,
  Teranex* (PC de régie et carte DeckLink). Chaque exigence est constatée par le moteur et expliquée
  (« Pas de tally sur CAM 2 (entrée 2) : TALLY IP est sur OFF dans le menu SYSTEM de RP150 ») ; le budget
  compte.
- **Le catalogue** (`catalogue/`, un fichier par groupe) : 21 modèles réels, avec leurs connecteurs
  sérigraphiés, leurs faces, leurs adresses d'usine et leur consommation : caméras Panasonic AW-HE130 et AW-HE20,
  pupitre AW-RP150, ATEM Television Studio HD8 ISO, Ross Carbonite Black Solo 13, HyperDeck Studio HD Plus et HD
  Mini, Teranex Mini SDI to Audio et Audio to SDI, GPI and Tally Interface, switch NETGEAR M4250 PoE+, box
  d'accès Internet, PC de régie (vMix, DeckLink Duo 2), prises murales, bandeau 19", bloc 12 V, moniteur, micro,
  disque, carte SD, pied. Prix et consommations sont des ordres de grandeur ; 66 points que la documentation n'a
  pas permis de confirmer sont listés dans la fiche de chaque appareil (« Points à faire vérifier »).
- **Le moteur** (`engine.js`), pur et seul juge : énergie (mur 16 A, bandeau 10 A, bloc 12 V, budget PoE+ du
  switch), câbles (signal, sens, connecteurs), IP (domaines de niveau 2 et VLAN, DHCP de la box, lien local,
  conflits, qui joint qui), vidéo (formats, boucles, embedder, mélangeurs, vMix et NDI|HX), services (pilotage
  des caméras, HyperDeck en TCP 9993, ATEM en TCP 9910, streaming), tally (ATEM → GPI & Tally → RP150 → caméras
  en IP ; Carbonite → RP150 ; vMix) et alertes en français. Nouveau : les sorties affectables d'un mélangeur
  (`cfg.sorties`, Carbonite).

**Les panneaux** (`ui/`), à droite de la 3D :
- **Le stock** : recherche, familles, prix, consommation, fiche dépliable (connecteurs par signal,
  caractéristiques), budget de la mission, ce qui est déjà sorti.
- **Un appareil** : nom, place (rangée de U dans la baie), interrupteur, alertes, et quatre onglets. *Faces* :
  les faces dessinées ; un clic sur un connecteur prend un câble, un clic sur un autre le pose ; l'anneau dit la
  liaison (couleur du signal, rouge pointillé si elle est fausse, orange quand le connecteur accepte le câble en
  main ; Échap lâche le câble). *Câblage* : la même chose en liste, au clavier, avec ce qui arrive sur chaque
  entrée. *Réglages* : le menu de l'appareil, comme sur le vrai (`ui/config/`, un fichier par famille : caméra,
  pupitre avec la recherche des caméras sur le réseau, mélangeur avec ses bus PGM/PVW et la coupe, HyperDeck
  avec REC et STOP, Teranex, GPI & Tally, switch avec VLAN et PoE+ par port, box avec son DHCP, PC avec la
  DeckLink et vMix, énergie avec la puissance appelée sur le disjoncteur et le bandeau). *Fiche* : rôle,
  caractéristiques, source, points à vérifier.
- **Le synoptique** : tout le câblage en SVG, en colonnes dans le sens du signal (sources, traitement, mélange,
  enregistrement, réseau, énergie), par calques ; exports du dessin (SVG) et de la liste de câblage (CSV).
- **Le réseau** : les domaines de niveau 2 et leurs sous-réseaux (une adresse hors du sous-réseau principal est
  signalée), un **ping** comme dans l'invite de commandes, qui dit pourquoi il répond ou non, et le tableau
  « qui joint qui ».
- **Le cahier des charges** : exigences, budget, note ; **« Rendre le montage »** enregistre l'essai
  (`suivi.js`, `PROG.entrepot.missions`) : le meilleur résultat valide l'exercice noté `x-entrepot` (60 / 100)
  et le livret ; le **compte rendu** (HTML à imprimer) reprend la note, le matériel, la liste de câblage et le
  plan d'adressage. Lancé depuis la leçon du Cours, l'entrepôt y ramène en sortant. La progression de
  l'entrepôt se fusionne entre deux appareils.

**La 3D** (`scene.js`, `scene/` : `hall.js`, `devices.js`, `cables.js`, `kit.js`) : le hall (sol béton, bardage,
charpente, rayonnages du stock avec cartons et flight cases instanciés), la baie 19" mobile de 12 U (montants
percés, U numérotés, roulettes ; un appareil d'un demi ou d'un tiers de largeur sur une tablette 1 U), la table de
régie et sa goulotte, le plateau en arc devant une estrade, le tableau électrique. Chaque appareil a ses
dimensions et ses faces avant et arrière dessinées en texture ; les voyants POWER s'allument, le tally rouge ou
vert suit le mélangeur, l'écran du moniteur montre ce qu'il reçoit (multiview, programme, caméra, « pas de
signal »). Les câbles partent du vrai connecteur et suivent un chemin de technicien (arrière de la table, flanc de
la baie, colonne, sol), couleur du signal, rouge si la liaison est fausse. L'appareil ouvert est entouré ; les
étiquettes proches (la baie) s'écartent. Mesuré en rendu logiciel : environ 160 appels de dessin pour une régie de
20 appareils et 30 câbles ; à vérifier sur le PC le plus faible de l'établissement.

Tests : `tests/unit/entrepot*.test.mjs` (catalogue, montage, moteur sur les vrais modèles, missions, sorties
affectables, suivi et fusion) ; suite de bout en bout `node tools/e2e.mjs entrepot` (Jouer, stock, câble posé
en deux clics sur les faces, la régie de la conférence à 100 / 100, les menus de chaque famille, la coupe et le
tally, le résultat rendu, le compte rendu, le synoptique et ses exports, le ping, le retour à Jouer,
l'exercice noté dans le Cours, le panneau à 390 px). À faire relire par un professionnel : les menus et les
chiffres du catalogue. La préparation logistique (flight cases, phases électriques, camion, ce qui part sur le
car) reste au programme de la v21 (`ROADMAP.md`).

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
npm run build        # dist/index.html (page publiée), TIEE-Simulator.html (à partager), serveur autonome et archive réseau local
npm run exe          # en plus : TIEE-Simulator.exe (Windows, sans installation) et le kit TIEE-Simulator-partage.zip
npm run build:dev    # même chose sans minification
npm run lint         # ESLint
npm run typecheck    # TypeScript (navigateur + Node)
npm test             # tests unitaires (node:test, ≈ 10 s)
npm run check        # les quatre à la suite (ce que fait l'intégration continue)
npm run test:e2e     # tests de bout en bout (Playwright, rendu logiciel : 40 suites, plusieurs heures)
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
| `game/quest.js` | Le suivi des tâches sur le côté (la mission en cours et ses tâches : car vide par groupe, étapes d'un exercice, plan de la visite, mission spécifique, jour de match, Carrière), le repère 3D, le journal des missions (touche L), la carte joueur |
| `game/missions.js`, `game/mission_run.js`, `ui/missions_ui.js` | La mission spécifique (Jouer → Car régie) : le catalogue par famille et la préparation du car (calcul pur), le déroulement (lancer, constater la fin, enchaîner ou arrêter), la liste à choisir |
| `emission/` | L'émission en direct (car pré-installé) : le conducteur et le compte rendu, calcul pur (`conducteur.js`), les médias de l'IPDirector (`medias.js`), leurs images (`dessin.js`, texture d'un canal de l'EVS `video.js`) et leur musique (`musique.js`), l'état partagé (`etat.js`), l'équipe virtuelle des postes non occupés (`ia.js`), les panneaux (`panneau.js` : médias de l'IPDirector, conducteur, objectif), la boucle, l'horloge du direct et le compte rendu (`index.js`) ; styles `styles/emission.css` |
| `game/fx.js`, `game/sfx.js` | Effets de jeu (barre d'XP, bannières de niveau et de badge, carte-titre, vignette, flash tally, alerte de panne) et bruitages synthétisés en WebAudio avec leur réglage |
| `game/sons.js` | Les recettes des bruitages (calcul pur) : voix (clic, note, cloche FM, bois, souffle, corps grave), notes de ré majeur pentatonique, durées ; jouées par `game/sfx.js` (chaîne de sortie, réverbération, accroches sur les gestes et les événements) |
| `styles/theme-jeu.css` | Le thème « jeu vidéo » : jetons de couleur, composants communs, HUD, écran titre, Jouer, menu, journal, badges |
| `telephone/index.js`, `telephone/apps.js`, `telephone/modele.js`, `styles/telephone.css` | Le téléphone (Tab ou T) : lever et ranger, touches, accueil (objectif, niveau), applications par famille (Aller à, Missions, Olivier, outils du car, Cours, Progression, Réglages), boîtier 3D et écran HTML posé dessus (transformation projective `cssProjection`) |
| `app/title.js` | Écran titre TIEE Simulator : logo du BTS, trois entrées (Jouer, Cours, Réglages), progression du chargement, conseils d'Olivier, mentions |
| `ui/settings.js` | Réglages : une seule fenêtre (ordinateur, partie en cours, ma progression, profil, espace formateur, aide, à propos) |
| `ui/ma_progression.js` | Réglages → Ma progression : où elle est enregistrée et si ça marche, exporter dans un fichier, importer (fusion), effacer, vos données personnelles ; notification quand un enregistrement échoue |
| `app/profile.js` | Profil Étudiant / Formateur, mémorisé ; classe `role-formateur` sur `body`, éléments `.role-only` |
| `cours/index.js`, `cours/kit.js`, `cours/all.js`, un fichier par chapitre (`signal.js`, `sdi.js`, `synchro.js`, `camera.js`, `realisation.js`, `ralentis.js`, `son.js`, `reseau.js`, `hf.js`, `exploitation.js`) | La section Cours : dix chapitres et leurs leçons, ordre d'apprentissage, progression, tirage du quiz dans la banque de chaque leçon (`drawQuiz`, `QUIZ_N`), kit des schémas et manipulations |
| `cours/parcours.js` | Le parcours du Cours : niveaux de chaque chapitre (`PARCOURS`), état d'une leçon (étoiles, terminée), d'un niveau (conditions, ouvert, validé), suite conseillée (les fondamentaux d'abord), test de niveau (calcul pur) |
| `cours/exo.js`, `cours/exos/` (un fichier par chapitre, le réseau en deux) | L'exercice en autonomie de chaque leçon : questions (nombre, choix, texte, ordre) tirées à chaque essai, vérification, aides et solution, points et score sur 100 |
| `ui/cours_parcours.js`, `ui/cours_exo.js`, `styles/cours-parcours.css` | Mon parcours (suite, catégories), chemin d'un chapitre par niveau, aperçu d'une leçon fermée, étapes d'une leçon, test de niveau ; l'exercice une question à la fois et son bilan |
| `cours/exercices.js` | Les exercices pratiques de chaque leçon : parcours d'Olivier (chacun dans une seule leçon) et exercices notés (atelier, car vide, formation réseau, jour de match, mise en service de la caméra, régie de l'entrepôt), leur état |
| `cours/liens.js` | Les liens du Cours avec le reste : terme du glossaire → leçon ou fiche « ? », poste → leçon (bouton « Cours », touche G) |
| `cours/sdi_falaise.js`, `cours/lab_sdi.js`, `cours/figs_sdi.js` | Leçon « La falaise numérique » : diagramme de l'œil et image qui casse avec la longueur du câble, défis d'Olivier |
| `cours/sdi_mots.js`, `cours/sdi_bits.js` | Les mots d'une ligne SDI (EAV/SAV, XYZ, LN, CRC-18, paquets audio ST 299-1, vidéo active), embrouillage et NRZI (calcul pur) ; la leçon « Du mot au bit » |
| `cours/reseau_routage.js` | La décision de routage (même réseau, passerelle, pannes) et la leçon « La passerelle » |
| `cours/st2110_calc.js`, `cours/reseau_st2110.js` | Les calculs ST 2110 (paquets, débits, modèle -21, tampon du récepteur, 2022-7, spine-leaf) et les six leçons du car IP |
| `cours/camera_fibre.js`, `content/terms_fibre.js` | Le bilan optique et la leçon « La fibre de la caméra » ; les fiches « ? » des liaisons optiques |
| `cours/ip_calc.js` | Les calculs des bases du réseau : adresses, diffusion, découpage, types d'adresses, encapsulation, propagation, débit de TCP avec pertes, latence SRT, files de QoS, NAT, gigue, budget de latence |
| `cours/reseau_bases.js`, `cours/reseau_adresses.js`, `cours/reseau_transport.js`, `cours/reseau_qos.js`, `content/terms_ip.js`, `styles/cours-reseau.css` | Les onze leçons des bases du réseau (couches, LAN / MAN / WAN, Ethernet, adresses, types, DHCP et DNS, NAT, TCP et UDP, streaming, mesures, QoS) rangées par `PARTIES` dans `cours/reseau.js` ; leurs fiches « ? » ; le style des parties du sommaire et des bits |
| `vues3d/index.js`, `vues3d/orbite.js`, `vues3d/kit.js`, `vues3d/materiel.js`, `styles/vues3d.css` | Le moteur des vues 3D du Cours : second contexte WebGL, orbite, étiquettes, clic sur un objet, panneau (En 3D, La leçon), liste ; matières et pièces, flux animés, appareils et câbles réseau |
| `vues3d/catalogue.js`, `vues3d/vues/`, `vues3d/l2.js`, `vues3d/l2anim.js` | Les vingt vues (une par fichier : étapes, commandes, scène) rattachées aux chapitres et aux leçons ; le petit réseau de niveau 2 (table MAC, VLAN, trunk) et son animation |
| `camlab/` | Module « La caméra en 3D » : caméra et plateau construits dans le code (`model.js`, `scene.js`), pastilles (`points.js`), 51 notions (`notions/`, une fiche par fichier, registres `ch1.js` … `ch89.js`), schémas (`figs.js`, `figs/`, `figkit.js`), manipulations (`labs.js`, `labs/`, commandes `controls.js`, optique `optics.js`, viseur simulé et traitement de l'image `vf.js`), affichage d'une fiche (`fiche.js`), progression (`progress.js`), quiz de chapitre (`quiz.js`), mise en service notée (`mes.js`) |
| `entrepot/` | Module « L'entrepôt » (tuile de Jouer) : monter une régie mobile d'après un cahier des charges. Types (`types.js`), catalogue de matériel réel (`catalogue/`, un fichier par groupe : `blackmagic.js`, `panasonic.js`, `ross.js`, `reseau.js`, `divers.js`), montage (`build.js`), moteur (`engine.js`), missions notées (`missions.js`), résultat rendu (`suivi.js`), 3D (`scene.js` ; `scene/` : hall, appareils, câbles, bureau et ordinateur de la Carrière `bureau.js` ; vue en orbite `orbit.js`), panneaux (`ui/` : `stock.js`, `appareil.js`, menus de configuration `ui/config/` un fichier par famille, `synoptique.js`, `reseau.js`, `mission.js`), ouverture, boucle et mode Carrière (`index.js`) |
| `carriere/` | La Carrière (mode de l'entrepôt) : les épisodes et leurs mails (`mails.js`), la boîte de réception et les missions lues dans la progression, calcul pur (`index.js`), la messagerie du bureau (`ui.js`), les mails qui arrivent et le lancement des missions au car (`installer.js`) |
| `ui/cours_ui.js` | L'espace Cours : un seul sommaire (chapitres rangés par niveau), « Mon parcours », chemin d'un chapitre, leçons (quiz, exercice en autonomie, exercices pratiques, article de référence), glossaire, postes, matériel |
| `app/nav.js` | Navigation entre les trois entrées : menu du car (Échap), aiguillage des boutons « Aller au poste », « Commencer » (car lancé si besoin), changement de vacation, retour au bureau de l'entrepôt (Carrière) |
| `ui/layer.js` | Espace plein écran (le Cours) : plaque, onglets, Fermer (Échap), ligne d'état |
| `ui/guide.js` | Missions d'installation (liste des tâches), articles de référence des leçons, glossaire, postes, matériel, procédures maison, commandes |
| `content/referentiel.js` | Référentiel du BTS MAV option TIEE (fiche RNCP37022) : 4 blocs, 39 compétences numérotées 1.1 à 4.5, couverture par le car et modules qui la complèteront ; rattachement des parcours, missions, phases du jour de match, missions réseau, exercices et leçons |
| `livret.js`, `ui/livret.js` | Livret de compétences : niveau de chaque compétence calculé d'après la progression (à travailler, travaillée, consolidée, hors simulateur), une activité ne comptant que réussie seule, « consolidée » demandant un exercice pratique (`estPratique`) ; affiché sur la page « Mon suivi » du Cours, depuis le chef de car et pour chaque stagiaire dans l'espace formateur, export CSV |
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
| `ui/tutor_ui.js` | Le chef de car en boîte de dialogue en bas de l'écran : accueil du car vide, exercices du poste où l'on est, visite guidée (tour du car puis chaque poste ; réduite aux postes d'une mission de la Carrière), retour à la leçon du Cours, étapes, mise en évidence, gestes « Fais-le pour moi » hors des postes (caméra, visionneuse, atelier), commandes vers le terminal, voix |
| `app/` | Application : vue et qualité graphique (`view.js`), joueur et déplacements (`player.js`), visée et interactions (`interact.js`), cadreur (`camop.js`), téléportation et postes (`teleport.js`), barre d'outils et d'état (`hud.js`), clavier / souris / tactile (`input.js`), écran Jouer, modes du car (car vide, pré-installé, mission spécifique) et lancement avec le car préparé (`start.js`), diagnostic de performance (`perf.js`), profileur `?perf` (`profiler.js`) |
| `data/` | Catalogues techniques : caméras, objectifs, liaisons, formats (`cameras.js`) ; positions et antennes du stade (`stadium.js`) ; HF COFDM (`rf.js`) ; exposition et lumières (`exposure.js`) ; équipes (`match.js` : Lens et l'adversaire du soir) ; clubs de Ligue 1, tenues, joueurs fictifs, niveaux fictifs (`clubs.js`) |
| `content/` | Contenus pédagogiques : fiches de poste (`stations.js`), glossaire (`glossary.js`), fiches des termes réseau et ST 2110 (`netterms.js`), chapitres du guide (`guide.js`), commandes (`controls.js`) |
| `state.js` | État partagé de la simulation (`S`) et bus d'événements (`on` / `emit`) |
| `truck.js` | Intérieur du car : plan, postes, écrans, baies et pupitres détaillés, collisions ; matières par famille, pénombre à spots, accessoires |
| `equip.js` | Profil matériel (XVS-6000, XT4K, LSM, IPDirector) et répartition des canaux EVS |
| `world.js` | Stade, éclairage, public (parcage visiteurs aux couleurs de l'adversaire), compound et extérieur du car, obstacles du compound |
| `adversaire.js` | L'adversaire du soir : tiré au sort ou choisi, il repeint les joueurs et le parcage visiteurs, passe à l'habillage ; transmis par l'hôte en coopération |
| `figurants/` | La vie autour du car : l'équipe à ses postes, qui laisse sa place quand on s'assoit (`equipe.js`), les techniciens et la sécurité du compound (`compound.js`), deux troupes instanciées aux poses procédurales (`troupe.js`), la boucle (`index.js`) |
| `render.js` | Rendu physique : conversion des matériaux, environnement (ciel capturé, studio du car), post-traitement de la vue « œil » (halo, ACES, SSAO dans le car) |
| `matiere.js` | Matières procédurales : recettes de relief, rugosité et teinte (cartes tuilables générées en code), matériau physique plaqué en triplanaire, relief coupé en qualité Basse |
| `people.js` | Joueurs et arbitres articulés : géométries, tenues (nom et numéro, repeintes quand l'adversaire change), visage, animation de course |
| `landscape.js` | Sol jusqu'à l'horizon (carte des parcelles), arbres instanciés en plans alpha, terrils |
| `vehicles.js` | Semi-remorque régie (caisse arrondie, livrée nervurée, portes, feux), tracteur à pare-brise courbe, camion satellite, groupe électrogène, bungalows, enrobé |
| `params.js` | Registre des valeurs chiffrées relisibles (objectifs, liaisons, C/N, latences, line-up) et corrections appliquées |
| `multi/` | Jeu à plusieurs : session, rôles, hôte du match, pseudos (`session.js`), tranches d'état partagées (`slices.js`), client du serveur réseau local et du jeu par Internet (`lan.js`), avatars des joueurs (`avatars.js`), fiches de rôle et objectifs (`roles.js`) |
| `lan/` | Serveur réseau local sans dépendance (`serveur.mjs` : HTTP + WebSocket, parties, comptes rendus ; origine vérifiée, tailles, connexions, parties et comptes rendus plafonnés ; clé exigée de ce qui vient d'Internet ; écran « Accès réservé » et jetons quand la page est chiffrée), coffre de l'exécutable (`coffre.mjs` : page chiffrée par le mot de passe, scrypt + AES-256-GCM), jeu par Internet (`internet.mjs` : analyse du réseau, ouverture de la box par UPnP, adresse publique, tunnel Cloudflare), lanceurs Windows / macOS / Linux, mode d'emploi |
| `match.js` | Simulation du match, son tirage à chaque partie (graine, forme du jour, style, temps forts), ses périodes (avant-match, deux périodes, mi-temps, fin ; ou le match en continu), rendu des joueurs, enregistrement d'état (base des ralentis EVS) |
| `bcam.js` | Caméras broadcast : optique, cadreurs automatiques, traitement CCU (knee, white clip, HLG), câbles |
| `rf.js` | Bilan de liaison HF, diversité, brouillage |
| `pipeline.js` | Grille, mélangeur, EVS, multiview, retour antenne, mesures (waveform, vecteurscope), HDR |
| `patch.js` | Baie de brassage : liaisons attendues, résolution des signaux, score |
| `ipnet.js` | Car IP : façade simple (état des réseaux, PTP, NMOS) et pannes réseau |
| `net/fabric.js` | Réseau ST 2110 : topologie spine-leaf rouge / bleu, configurations des commutateurs, moteur d'évaluation (liens, OSPF, PIM-SSM / IGMPv3, bande passante, ST 2022-7, PTP BMCA, NMOS), SDP |
| `net/cli.js` | Ligne de commande des commutateurs (syntaxe de type EOS / NX-OS) |
| `net/analyzer.js` | Instruments : analyseur de flux ST 2110-21 / 2022-7, suivi PTP, capture de paquets décodée |
| `net/course.js` | Parcours de formation réseau : missions vérifiées, quiz, examen noté |
| `audio.js` | Console son (inspiration Vista 1) : sources synthétisées, patch, chaîne DSP par tranche, bus et N-x, VCA, écoutes, snapshots, retard de ligne, embedder, loudness, corrélation, pannes son ; ce que le joueur entend selon l'endroit (`ecoute`, `setEar`) et le volume du son |
| `commentary.js` | Commentaires du match (commentateur, consultant, bord terrain, plateau) en fil écrit, sans voix : niveaux simulés suivant la console |
| `audiodesk.js` | Console son en 3D dans la cabine (faders motorisés, FaderGlow, écrans Vistonics animés) |
| `poste3d/` | Les postes en 3D : moteur de la vue du poste (`index.js` : écran partagé avec les écrans du poste en direct, caméra en orbite, vues, zones cliquables recalées et découpées sur la 3D, touches, molettes, glissières, molette sans butée (jog), touches maintenues, bulles, étiquettes, fiche, tiroir « Tous les réglages » avec l'interface 2D et ses moniteurs recopiés), outils des pupitres (`kit.js` : touches instanciées à légende, surfaces dessinées) ; le matériel : pupitre ICP-X7000 (`icp.js`), rangée de RCP (`rcp.js`), télécommande LSM (`lsm.js`), pupitre d'intercom (`icom.js`) ; les définitions de poste : mélangeur (`melangeur.js`), vision (`vision.js`), son (`son.js`, sur la console d'`audiodesk.js`), ralentis (`ralentis.js`), intercom (`intercom.js`) |
| `scenario.js` | Scénario « jour de match » chronométré et noté |
| `shared.js` | Données partagées de la page publiée (configuration, progression) avec repli local ; progression numérotée (`PROG_VERSION`, `migrateProgress` ; v3 : la Carrière), fusionnée avec le serveur avant chaque écriture, état de l'enregistrement (`SAVE`), export, import et effacement |
| `review.js` | Points techniques à faire relire par le formateur |
| `gfx.js` | Habillage (score, bandeaux, statistiques) |
| `atelier.js` | Atelier de montage de la CAM 1 : pièces, ordre des opérations et prérequis, visée, fantômes, gestes maintenus, réglages à la molette, mise en service, rapport |
| `ui/` | Session et salon de coopération (`session_ui.js`), relecture (`review_ui.js`), réseau IP (`st_network.js` : onglet Technique, `net_ops.js` : onglet Exploitation, `net_tools.js`, `net_course.js`, `term.js` et `term_figs.js` : boutons « ? », fiches et schémas), synoptiques (`synoptics.js`), plan du car (`truckmap.js`), postes (`stations.js`, `st_audio.js`, `commut.js`, `st_vision.js`, `st_evs.js`, `st_mixer.js`, `st_ipd.js`, `st_patch.js`), espace formateur (`config.js`), rapports (`report.js`), plan, guide, missions |
| `equipment/` | Visionneuse de matériel : appareils (`devices.js`), liste de câblage (`cabling.js`), rendu SVG et photos (`viewer.js`) |
| `faults.js`, `exercises.js` | Simulateur de pannes, réalisateur virtuel et opérateur EVS automatique |

Hors de `src/` :

| Dossier | Rôle |
| --- | --- |
| `lan/` | Serveur réseau local (voir plus haut), icônes de l'exécutable Windows (`.ico`) et de l'application macOS (`.icns`) |
| `partage/` | Modes d'emploi des versions à partager protégées par mot de passe : exécutable Windows (`LISEZMOI.txt`), application macOS (`LISEZMOI-mac.txt`) |
| `tests/unit/` | Tests unitaires `node:test` ; `tests/helpers/` (DOM minimal, scène vide, réseau de test), `tests/register.mjs` (chargement des fichiers texte comme esbuild) |
| `tests/e2e/` | Tests de bout en bout Playwright et leur harnais |
| `tools/` | Construction (`build.mjs`, `zip.mjs`), versions à partager : exécutable Windows et kit (`exe.mjs`, signature Authenticode `signature.mjs`), application macOS (`mac.mjs`, pièces `macapp.mjs`), pièces communes (`sea.mjs`, serveur protégé `protege.mjs`), icônes (`icon.mjs`), lanceur des tests de bout en bout (`e2e.mjs`), mesures et captures |
