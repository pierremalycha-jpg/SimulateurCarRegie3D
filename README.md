# Car régie 3D — simulateur de formation

Simulateur pédagogique d'une captation de football en car régie : stade 3D, plan de caméras, liaisons
(SMPTE, triax, fibre, coax, IP, HF), car régie visitable en vue à la première personne et postes
interactifs (réalisateur, scripte, mélangeur, habillage, vision/RCP, EVS/LSM, IPDirector, son, HF, grille,
CCU, synchro, transmission, intercom, baie de brassage, chef de car avec simulateur de pannes).

Aux postes, les écrans utiles restent affichés en permanence (zone d'écrans fixe, moniteur flottant
déplaçable) et un fil « Ce qui se passe » explique chaque action. Une visionneuse de matériel montre les faces
avant/arrière (caméra système, CCU, RCP, serveur ralenti, LSM, mélangeur, grille, SPG…), chaque connecteur et la
liste de câblage générée à partir de l'installation.

## Profil matériel

Le simulateur est réglé sur ce parc (modifiable dans l'Espace formateur → « Le car ») :

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
  - `tools/reach.mjs` vérifie que chaque poste est accessible à pied.
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

## Construire et tester

```
npm install
node tools/build.mjs          # produit dist/index.html (fichier unique, three.js chargé depuis jsDelivr)
node tools/build.mjs --dev    # même chose sans minification
node tools/v3.mjs OUT hd      # postes, son, pannes, formateur, perf (aussi : scenario, ip, ops)
node tools/syn.mjs OUT sdi    # captures des synoptiques (aussi : faults, ip)
node tools/reach.mjs          # chaque poste du car est-il accessible à pied ?
node tools/netcli.mjs HD LEAF-R1 'sh ip route;;sh ptp'   # modèle réseau et CLI sans navigateur
node tools/net.mjs OUT HD     # poste Réseau IP, terminal, pannes réseau et effets à l'image
node tools/course.mjs OUT HD  # parcours de formation, mesures, capture, quiz, examen
node tools/v8.mjs OUT keys    # commutation clavier (aussi : audio, visual, mobile, review)
node tools/session.mjs OUT    # session à deux navigateurs (salle simulée) : rôles, synchro, ordres, pannes
node tools/gfx.mjs OUT haute jour   # captures de référence du rendu (accueil, terrain, kop, vol, compound, car, caméras)
node tools/lum.mjs jour       # exposition des caméras : rendu physique comparé au rendu Lambert
node tools/func.mjs           # tests fonctionnels historiques
```

## Organisation du code (`src/`)

| Fichier | Rôle |
| --- | --- |
| `data.js` | Catalogues (caméras, objectifs, liaisons, positions, antennes, modulations) et contenus pédagogiques |
| `equip.js` | Profil matériel (XVS-6000, XT4K, LSM, IPDirector) et répartition des canaux EVS |
| `world.js` | Stade, éclairage, public, compound et extérieur du car |
| `render.js` | Rendu physique : conversion des matériaux, environnement (ciel capturé, studio du car), post-traitement de la vue « œil » |
| `people.js` | Joueurs et arbitres articulés : géométries, tenues (nom et numéro), visage, animation de course |
| `landscape.js` | Sol jusqu'à l'horizon (carte des parcelles), arbres instanciés, terrils |
| `vehicles.js` | Semi-remorque régie, tracteur, camion satellite, groupe électrogène, bungalows, enrobé |
| `params.js` | Registre des valeurs chiffrées relisibles (objectifs, liaisons, C/N, latences, line-up) et corrections appliquées |
| `multi/` | Sessions à plusieurs : salle temps réel, rôles, hôte du match (`session.js`), tranches d'état partagées (`slices.js`) |
| `truck.js` | Intérieur du car (postes, écrans, baies) |
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
| `truck.js` (car) | Intérieur du car : plan, postes, baies et pupitres détaillés, collisions |
| `ui/` | Session (`session_ui.js`), relecture (`review_ui.js`), réseau IP (`st_network.js`, `net_tools.js`, `net_course.js`), synoptiques (`synoptics.js`), plan du car (`truckmap.js`), postes (`stations.js`, `st_audio.js`, `commut.js`, `st_vision.js`, `st_evs.js`, `st_mixer.js`, `st_ipd.js`, `st_patch.js`), espace formateur (`config.js`), rapports (`report.js`), plan, guide, missions |
| `equipment/` | Visionneuse de matériel : appareils (`devices.js`), liste de câblage (`cabling.js`), rendu SVG et photos (`viewer.js`) |
| `faults.js`, `exercises.js` | Simulateur de pannes, réalisateur virtuel et opérateur EVS automatique |
