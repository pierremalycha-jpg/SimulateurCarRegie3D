# Feuille de route

Version complète, avec la frise, la couverture du référentiel et les outils :
https://claude.ai/artifact/66qXXNdPDeDcUuTbWeLNTx (page privée, à partager depuis son menu).

Rattachement au référentiel, compétence par compétence, et plan de modules :
https://claude.ai/artifact/CC1su9aPGFspDxWwi8qSGP (page privée).

**Vision.** Un simulateur où chaque compétence de l'option TIEE du BTS MAV se pratique sur un lieu
réaliste, de la préparation du matériel à l'entrepôt jusqu'au direct, en passant par le câblage, les
réglages et la panne. Son nom : **TIEE Simulator**, réalisé par le BTS Audiovisuel de Saint-Quentin (lycée
Henri-Martin), développé par Pierre MALYCHA.

**Règles du chantier.**

- Un moteur, plusieurs lieux : signaux, matériel, tuteur, pannes et suivi sont communs.
- La préparation nourrit l'exploitation : ce qu'on prépare à l'entrepôt part sur le lieu.
- Un lieu fini avant le suivant : chaque version livre un événement jouable de bout en bout.
- Vérifié par des pros et en classe : un relecteur professionnel par lieu, un test avec des étudiants.
- Aligné sur le référentiel : chaque parcours est rattaché aux compétences de la fiche RNCP37022,
  numérotées 1.1 à 4.5 dans le document de rattachement.

Calendrier indicatif, calé sur l'année scolaire (les épreuves ont lieu en mai-juin).

| Version | Période | Contenu |
|---|---|---|
| Postes en 3D, lots 4 et 5 | nov. 2026 – janv. 2027 (proposé) | Lot 4 : les baies (CCU, grille, synchro, brassage avec cordons tirés en 3D, mesure, HF, transmission), face avant puis face arrière. Lot 5 : les postes « à écran » (réalisateur, scripte, habillage, production, chef de car, IPDirector, réseau) : la vue assise, l'interface 2D dans l'écran de l'ordinateur |
| Refonte des interfaces, lots 2 et 3 | nov. 2026 (proposé, maquettes à valider : https://claude.ai/artifact/XLVMsthbTFehQP1KfdXh1t, page privée) | Lot 2, le premier lancement : sur l'écran titre, Jouer propose d'abord « Visiter le car avec Olivier » (10 min) et ce que sera la première séance ; à l'arrivée, une seule voix (Olivier dit les commandes de déplacement, l'objectif tient en une ligne, les tâches se déplient avec L) ; niveau et XP cachés tant qu'ils valent zéro ; Jouer en trois choix courts et un résumé « Ta partie » avec un seul bouton. Lot 3, la charte : casse normale au lieu des majuscules espacées, une seule couleur d'action, les couleurs du direct réservées au direct, coins arrondis au lieu des biseaux et halos, chiffres en Archivo à chasse fixe, un bouton principal par écran ; Réglages en onglets |
| v19.21 | oct. 2026 (fait) | Lot 1 de la refonte des interfaces : Olivier passe sous le menu Échap et les fenêtres (sauf quand l'étape s'y joue), se range à côté du téléphone, laisse voir la bande d'état et le retour PGM ; écran titre sans chevauchement ; ponctuation des chiffres corrigée (« 20:44 », plus « 20: 44 ») ; le tutoiement partout (le formateur et le relecteur restent vouvoyés) ; trente-cinq bruitages de studio (cloches FM, bois, souffles, gamme de ré pentatonique, réverbération courte, compresseur), dont le téléphone, les onglets, les interrupteurs, le curseur de volume, Olivier, le lancement et le top antenne ; planche d'écoute écrite par la suite `sons`. Reste : les lots 2 et 3 (ligne au-dessus) |
| v19.20 | oct. 2026 (fait) | Le match ne se fige plus (ballon libre repris, coup d'envoi dosé) ; un match tiré à chaque partie (graine nouvelle, forme du jour, style, temps forts : Lens ne gagne plus à tous les coups) ; dix-sept vrais adversaires de Ligue 1 (nom et couleurs, sans blason ; joueurs et niveaux fictifs), tirés au sort ou choisis dans Jouer ; l'équipe à ses postes (douze équipiers assis ; à son poste, le titulaire laisse sa place) et le choix de son poste au départ ; le compound vit (techniciens qui entrent et sortent du car, sécurité, portail) ; plus de fils en l'air (câbles caméra au sol, caténaire en fils continus). Reste : des figurants qui s'écartent devant le joueur ; l'équipe au car vide une fois l'installation finie ; d'autres compétitions (Coupe de France, Ligue des champions) |
| v19.19 | oct. 2026 (fait) | L'émission en direct au car pré-installé (choix par défaut, « Match en continu » à côté) : décompte ou « Antenne maintenant », générique de début de 30 s, deux périodes de 10 minutes, page de publicité à la mi-temps, générique de fin, tous lancés depuis l'IPDirector (base MÉDIAS, cue, LANCER, temps restant) ; médias dessinés et composés par le code (marques fictives, sonie −23 dBFS) ; le match par périodes (échauffement, mi-temps, sifflets, changement de côté) ; seul, les postes non occupés tenus par une équipe virtuelle (réalisateur, truquiste, IPDirector, son, habillage, vision, scripte) ; horloge du direct, conducteur au suivi, au scripte et au téléphone ; compte rendu noté, livret (3.11), progression v5. Reste : essayer la durée des périodes et le barème avec une classe ; la pub par la régie finale (décrochage, module M7) ; une coupure pub notée « à la seconde » |
| v19.16 | oct. 2026 (fait) | Le Cours en 3D : quatorze vues (90 étapes) avec leur panneau d'explications (onglets En 3D et La leçon), ouvertes depuis le sommaire d'un chapitre (« … en 3D ») ou le « Voir en 3D » d'une leçon : le SDI (trame dans le coaxial, œil, BNC et brassage), la synchro (genlock), la fibre de la caméra, le réseau (table MAC, VLAN, passerelle, multicast, PTP), le ST 2110 (essences, paquet et rythme, rouge et bleu en spine-leaf), la HF dans le stade ; dix leçons de plus (du mot au bit, la passerelle, six leçons du car IP dans Le réseau, la fibre de la caméra). Reste : d'autres vues si les classes les demandent (grille et matrice, adressage IP restent en 2D, jugés mieux ainsi) |
| v19.17 | oct. 2026 (fait) | Le réseau de A à Z : le chapitre rangé en cinq parties (bases, adresser et acheminer, transporter, QoS et mesures, car IP), onze leçons de plus (modèle en couches, LAN / MAN / WAN, Ethernet, adresse réseau et diffusion, types d'adresses, DHCP et DNS, NAT, TCP et UDP, streaming SRT / RIST / RTMP / HLS / NDI, mesures, QoS), 23 fiches « ? », calculs purs `cours/ip_calc.js` ; six vues 3D de plus (vingt, 132 étapes) : couches et encapsulation, adresses et diffusion, DHCP et DNS, TCP et UDP, du LAN au WAN et au streaming, QoS. Reste : IPv6 en 3D si les classes le demandent ; un exercice noté de plan d'adressage |
| v19.18 | oct. 2026 (fait) | Le Cours en parcours, à la façon de Duolingo : chaque chapitre est une catégorie faite de niveaux (Débutant, Intermédiaire, Avancé, Expert ; 57 leçons, 29 niveaux) qui s'ouvrent l'un après l'autre ; chaque leçon se termine par son quiz et un exercice en autonomie (57 exercices, valeurs tirées à chaque essai, deux aides et la solution qui coûtent des points, score sur 100, étoiles) ; un niveau s'ouvre quand ses leçons sont terminées avec une moyenne de 70 sur 100, ou par un test de niveau (80 %) ; « Mon parcours » propose les fondamentaux d'abord ; tout est ouvert au profil Formateur. Reste : relire le rangement par niveau et les seuils avec une classe, faire relire les chiffres signalés (README) |
| v19.15 | oct. 2026 (fait) | L'application macOS : `TIEE-Simulator-mac.dmg` (Apple silicon et Intel, macOS 11+), même protection par mot de passe que l'exécutable Windows, construite et vérifiée sur un Mac de GitHub, publiée dans la même Release ; case « essai » du workflow (mot de passe jetable). Reste : notariser l'application (certificat Developer ID d'Apple) pour supprimer l'étape « Ouvrir quand même » |
| v19.14 | oct. 2026 (fait) | Un exécutable protégé, construit par GitHub : la page chiffrée par un mot de passe (scrypt + AES-256-GCM), écran « Accès réservé » à chaque lancement et dans chaque navigateur, signature Authenticode horodatée (certificat de l'établissement ou d'une autorité), publication dans les Releases à chaque étiquette de version ; plus de fichier HTML à partager. Reste : décider si le dépôt redevient privé (le code source public permet de reconstruire sans mot de passe), un certificat reconnu par Windows (SmartScreen) |
| v19.13 | oct. 2026 (fait) | Postes en 3D, lot 3 : la télécommande LSM des ralentis (touches F, angles, bloc opérationnel, levier de vitesse, molette jog ; à droite EVS A, EVS B, programme et écran du serveur) et le pupitre d'intercom du réalisateur (TALK et LISTEN par canal, afficheurs, micro ; à droite le journal de l'intercom et l'état du pupitre) |
| v19.12.1 | oct. 2026 (fait) | Correctif : sur un écran à forte densité (Retina, HiDPI), les écrans recopiés du panneau de droite grandissaient à chaque image et le panneau descendait sans fin ; contrôle en densité 2 dans la suite du poste vision |
| v19.12 | oct. 2026 (fait) | Postes en 3D, écran partagé : le pupitre en 3D à gauche, à droite les écrans du poste en direct (multiview, PGM / PVW ; Grade 1, PRISM ; programme, vumètres, loudness) puis la fiche et le fil ; caméra en orbite autour du pupitre (tourner, déplacer, s'approcher, revenir), comme celle du Cours ; chaque nouveau poste en 3D fournit ses écrans |
| v19.11 | oct. 2026 (fait) | Postes en 3D, lot 2 : la vision (rangée de RCP en 3D, un clic donne la main, joystick, molettes, touches, écran tactile) et le son (faders, SEL / PFL / MUTE, molettes GAIN et PAN, Control Bay, talkback maintenu) ; tiroir « Tous les réglages » avec l'interface 2D complète du poste (et ses moniteurs), vers lequel Olivier renvoie ; zones cliquables découpées à la forme des commandes |
| v19.10 | oct. 2026 (prototype) | Le poste du truquiste en 3D : le pupitre ICP-X7000 construit touche par touche sur le bureau (tallys, OLED, barre T), la vue de l'opérateur avec une zone cliquable par touche, une bulle d'explication, des étiquettes, des vues par zone, la fiche et le fil « Ce qui se passe » à droite ; vue 2D au choix (défaut en mode allégé et qualité Basse) |
| v19.9 | oct. 2026 (fait) | Le téléphone : un smartphone en 3D levé devant soi (Tab), dont les applications mènent à tout ce qui n'est pas dans le décor (aller à un poste, missions, Olivier, plan caméras, synoptiques, matériel, Cours, progression, réglages) ; il remplace le pupitre et les boutons Pupitre, Missions et Chef de car (HUD : niveau, Téléphone, Menu). Reste : le téléphone à l'entrepôt (cahier des charges, stock, réseau) et la Carrière (les mails sur le téléphone) |
| v19.8 | oct. 2026 (fait) | Trois façons de jouer au car régie : car vide (Olivier propose d'abord la visite), car pré-installé (jeu libre, sans chef ni missions), mission spécifique (une tâche choisie par famille, le car préparé pour elle, enchaîner ou arrêter) ; le suivi des tâches sur le côté ; Olivier en boîte de dialogue en bas de l'écran ; la tâche « réseau de contrôle » du car vide vérifie enfin l'adresse du plan |
| v19.7 | oct. 2026 (fait) | Jouer par Internet : depuis le salon, l'hôte obtient un lien en un clic (analyse du réseau, ouverture de la box par UPnP, adresse publique vérifiée, sinon tunnel Cloudflare gratuit et sans compte) ; l'invité ouvre le lien dans son navigateur ou le colle dans son salon, et chacun voit l'avatar de l'autre ; ce qui vient d'Internet doit porter la clé du lien. À essayer avec une vraie box et un vrai invité |
| v19.6 | oct. 2026 (fait) | La Carrière, mode scénarisé de l'entrepôt (lot 1) : le bureau et son ordinateur dans le hall, une messagerie où des mails proposent un poste sur une prestation, l'ordre de mission, deux épisodes (stagiaire : visite du car réduite à six postes ; assistant technique : la conférence montée à l'entrepôt), retour au bureau depuis le car, badge « Embauché », progression v3 |
| Carrière, lots 2 et 3 | à planifier (R7) | Lot 2 : marcher dans l'entrepôt à la première personne (déplacement, E pour l'ordinateur, les rayonnages et la baie ; la vue en orbite reste pour câbler et sur tablette). Lot 3 : la saison complète (environ huit mails : car vide, atelier, mise en service de la caméra, formation réseau, plateau TV, vMix, jour de match), avec le compte rendu dans le mail de retour |
| v19.5 | oct. 2026 (fait) | Un rendu de jeu vidéo sans ressource externe : matières procédurales (relief, rugosité, teinte) plaquées en triplanaire, boîtes chanfreinées, occlusion ambiante cuite par sommet, SSAO dans le car, intérieur du car en pénombre avec spots et accessoires, car régie et tracteur retravaillés, compound habillé, arbres en plans alpha, béton des tribunes ; qualité Basse inchangée. 19.5.1 : moiré et faces qui sautent corrigés, entrepôt en matières avec environnement, afficheurs de timecode et conducteurs dans le car |
| v19.4.1 | oct. 2026 (fait) | Un son supportable, à sa place : l'écoute suit le joueur (la foule dans le stade, rumeur lointaine derrière les tribunes et devant le car, l'écoute de la console au poste son, presque rien ailleurs dans le car, silence à l'accueil), montée douce au lancement, volume du son dans les Réglages ; commentaires sans voix de synthèse (fil écrit au poste son) |
| v19.4 | oct. 2026 (fait) | Consolider le car régie : quiz des leçons en banque (5 questions par leçon, 3 tirées, réponses mélangées, corrigé à la validation), réponses mélangées dans la caméra en 3D, livret qui ne compte que les réussites seules et demande un exercice pratique pour « consolidée », XP sur les seules pannes cachées, progression numérotée, fusionnée avant écriture, échec signalé, export / import / effacement et données personnelles (Réglages → Ma progression), polices intégrées (plus de Google Fonts), fuite mémoire des caméras corrigée, serveur réseau local durci |
| v19.3 | oct. 2026 (fait) | L'interface jeu : objectif toujours à l'écran (exercice, mission, phase du jour de match) avec repère 3D, journal des missions (L), XP et sept niveaux de technicien, badges (dont un par compétence du livret), bruitages WebAudio, nouvelle identité visuelle « jeu vidéo » (écran titre cinématique, menu de pause, HUD, notifications), rubrique Jeu des réglages |
| v19.2 | oct. 2026 (fait) | L'entrepôt, tuile de Jouer : monter une régie mobile de A à Z (caméras PTZ Panasonic, pupitre AW-RP150, ATEM HD8 ISO ou Carbonite, HyperDeck, Teranex, switch PoE+, box, PC vMix) d'après un cahier des charges noté ; catalogue de 21 modèles réels, moteur (énergie, câbles, IP, vidéo, tally), hall en 3D, faces cliquables, menus de configuration de chaque appareil, synoptique et liste de câblage, réseau avec ping, trois missions, compte rendu, exercice noté x-entrepot et livret ; chiffres et menus à faire relire par un professionnel |
| v19.1 | oct. 2026 (fait) | La caméra en 3D terminée : les 51 notions écrites (lots 2 et 3 : filtres et prisme, capteurs, traitement de l'image, corps, viseur et cadreur, voie caméra, mesure, grand capteur, HDR, super ralenti), notions acquises et quiz des neuf chapitres, exercice noté « Mise en service » (x-camera, leçon La chaîne caméra), liens vers le Cours, livret ; chiffres à faire relire par un professionnel de la caméra |
| v19 | oct. 2026 (fait) | TIEE Simulator : trois entrées (Jouer, Cours, Réglages) ; Jouer = le lieu (car régie, salle de concert en préparation), le mode (car installé, tout à faire, visite guidée), solo ou coopération (salon) ; le chef de car devient les exercices pratiques des leçons du Cours ; Cours à un seul sommaire avec page de suivi, dix chapitres |
| v18.2 | nov. 2026 | Mur des lieux sur l'accueil (fait), puis décisions D1 à D16 de la revue v18.1, premier test en classe, mesure d'usage, CLAUDE.md et skills maison |
| v18.5 | oct. 2026 (fait) | La caméra de plateau en 3D dans le Cours (onglet La caméra) : caméra type Sony HXC-FB80 et zoom Fujinon, 23 pastilles, 51 notions en 9 chapitres de la lentille frontale au moniteur, lot 1 écrit (12 fiches : schéma, manipulation sur la caméra et l'image du viseur, trois questions d'Olivier) ; lots 2 et 3, quiz de chapitre et parcours noté « Mise en service » faits en v19.1 |
| v18.4 | oct. 2026 (fait) | Menus par profil (Étudiant / Formateur, mémorisé) ; cinq familles partout (écran titre, pupitre, menu du car) : Jouer, Cours, Chef de car, Formateur, Réglages ; section Cours en plein écran : chapitres Le signal vidéo numérique, Le SDI, Le réseau, La HF, une leçon par terme (l'essentiel, schéma, manipulation qui calcule, « dans le car », fiches « ? », quiz) ; espace du chef de car (parcours guidés, exercices notés, missions, livret de compétences TIEE) |
| v18.3 | oct. 2026 (fait) | Écran titre avec chargement par étapes ; instrument de mesure type PRISM au poste vision et dans une baie de mesure (waveform, parade, vecteurscope, diamant, split diamant, œil, gigue) ; grille Videohub 40×40 avec monitoring ; réseau de contrôle Gigabit du car SDI (VLAN, QoS, pannes) ; les trois reliés : sans réseau, RCP, grille, IPDirector et mélangeur ne commandent plus |
| Modules du car | nov. 2026 – janv. 2027 | Les compétences que le car ne travaille pas encore (blocs 3 et 4) : M1 livret de compétences, M2 « La commande du diffuseur » (dossier initial, choix et chiffrage du dispositif), M3 « Après le coup de sifflet » (clips, PAD, archive), M4 « Recette et maintenance » (get-in sécurisé, réception, recette, maintenance préventive) |
| v20 | févr. – mars 2027 | Socle multi-lieux : format de lieu, moteur de signaux unique (vidéo, audio, commande, réseau, énergie), catalogue de matériel unique, lieux chargés à la demande, un tuteur par métier, livret de compétences ouvert à tous les lieux |
| v21 | avr. – juin 2027 | Entrepôt, la préparation d'une prestation (le module existe depuis v19.2) : flight cases, budget électrique en triphasé (P17, équilibrage des phases), chargement du camion, check-list de départ et de retour, liste de colisage, ce qu'on emporte part sur le car régie (un oubli devient un problème sur place), éditeur de pannes pour le formateur |
| v22 | juil. – sept. 2027 | Salle de concert, le son : façade, retours, Dante, diffusion et calage, niveaux sonores, captation |
| v23 | oct. – déc. 2027 | Salle de concert, la lumière : console DMX, Art-Net et sACN, projecteurs, plan de feu, électricité et accroche |
| v24 | 2028 | Édition 2028-2029 : épreuve blanche, bilan des mesures, veille sur le référentiel (fiche enregistrée jusqu'au 31 août 2027) |

**Un lieu est fini quand** l'événement se joue de bout en bout, avec au moins 6 parcours du tuteur, des
pannes, une documentation exportable, la relecture d'un professionnel du domaine, ses tests automatiques
et 30 images par seconde sur le PC le plus faible de l'établissement.

**Décidé.**

- 21 octobre 2026 : les quatre modules du car passent avant les autres lieux. Ils comblent 8 des 9
  compétences absentes du car sans nouveau décor.
- 21 octobre 2026 (v19) : l'ensemble s'appelle **TIEE Simulator** (R2). L'écran Jouer ne propose que deux
  lieux, le car régie et la salle de concert ; le plateau TV et la conférence sont retirés de la feuille de
  route ; l'entrepôt devient un mode à part. Le chef de car n'est plus une entrée : ses parcours sont les
  exercices pratiques des leçons du Cours, et sa présentation du car devient le mode « Visite guidée ».

- 28 octobre 2026 (v19.20) : le match se **tire à chaque partie** (le résultat n'est jamais écrit d'avance) contre un
  **vrai club de Ligue 1** (nom et couleurs admis, pas de blason ; joueurs fictifs ; niveaux de jeu fictifs, propres au
  simulateur). Le car installé a son **équipe à ses postes**, visible : à son poste, le titulaire s'écarte ; on peut
  choisir son poste avant de commencer. Le compound a ses **figurants** (techniciens, sécurité). Pas de fils qui
  flottent : un câble est posé au sol, ou tendu entre deux supports.
- 28 octobre 2026 (v19.19) : le car pré-installé se joue en **émission en direct** (par défaut) : le match ne commence
  plus tout seul ; un décompte (ou « Antenne maintenant ») mène au générique de début (30 s), puis deux périodes de 10
  minutes, la page de publicité à la mi-temps, le générique de fin ; les médias se lancent depuis l'**IPDirector**. Seul,
  les postes que l'on n'occupe pas sont tenus par une **équipe virtuelle** qui suit le conducteur ; au poste où l'on est
  assis, rien ne bouge sans nous (au mélangeur, le réalisateur virtuel donne ses ordres par l'intercom). « Match en
  continu » garde le jeu libre ; le car vide, les missions et les exercices gardent le match en continu.
- 26 octobre 2026 (v19.18) : le Cours se fait en **parcours**, comme Duolingo : par catégorie (le chapitre), des
  niveaux Débutant, Intermédiaire, Avancé, Expert, ouverts l'un après l'autre ; une leçon se termine par son quiz et un
  exercice en autonomie où l'aide coûte des points ; le niveau suivant demande les leçons terminées et une moyenne de
  70 sur 100, ou un test de niveau ; au profil Étudiant, on passe d'abord par les fondamentaux, le profil Formateur
  voit tout. Les exercices pratiques dans le car restent dans leur leçon, Jouer reste libre.
- 25 octobre 2026 (v19.9) : tout ce qui n'est pas dans le décor passe par un **téléphone** qu'on lève devant soi,
  comme dans un GTA ou un Schedule 1 : un smartphone en 3D tenu en main, dont les applications ouvrent les outils
  (rangées dans les trois familles : le car, le Cours, les réglages). Il remplace le pupitre et les boutons du HUD :
  à l'écran, il ne reste que le téléphone (Tab) et le menu (Échap) ; les anciennes touches restent des raccourcis.
  Le car régie d'abord ; l'entrepôt suivra avec ses propres applications.
- 24 octobre 2026 (v19.8) : le car régie se joue de trois façons, chacune à sa phase : **car vide** (tout à faire,
  Olivier propose d'abord la visite guidée), **car pré-installé** (jeu libre, ni chef de car ni missions) et **mission
  spécifique** (une tâche précise, le car préparé pour elle ; ensuite on enchaîne ou l'on s'arrête). La visite guidée
  n'est plus un mode : Olivier la propose au début du car vide. Jouer propose donc une liste de missions : elle
  reprend les exercices rangés dans les leçons du Cours (mêmes identifiants), qui restent la référence. Le chef de
  car parle dans une boîte de dialogue en bas de l'écran, les tâches sont sur le côté.
- 23 octobre 2026 (v19.6) : un mode scénarisé, la **Carrière**, à côté du mode libre (bac à sable de l'entrepôt,
  car installé). Il s'appelle Carrière, pas Scénario (le mot désigne déjà le jour de match dans le code). C'est le
  premier mode du lieu « L'entrepôt » : pas de quatrième entrée. Sa messagerie est une deuxième porte vers les
  mêmes activités, jamais une copie : une mission est réussie quand l'activité qu'elle reprend l'est, sans XP ni
  rattachement de plus ; les exercices notés restent rangés dans leur leçon du Cours, qui reste la référence. La
  société des mails est celle du formateur, sinon un nom fictif.
- 23 octobre 2026 (v19.5) : l'aspect visuel est traité comme un chantier à part entière, dans l'ordre intérieur du car,
  extérieur, stade ; tout reste procédural (une seule page, aucun fichier), le détail n'apparaît qu'en qualité Moyenne et
  Haute (portables à GPU intégré visés), et le car est en pénombre réaliste. Reste à mesurer sur le PC le plus faible,
  puis à poursuivre : joueurs, sièges en relief, entrepôt.
- 23 octobre 2026 (v19.4.1) : le son n'est plus partout le même : on entend la foule dans le stade, l'écoute de la
  console au poste son, presque rien ailleurs dans le car ; les commentaires ne sont plus dits par la synthèse vocale
  (trop robotique), leur fil reste écrit au poste son.
- 23 octobre 2026 (v19.4) : on consolide le car régie avant d'étendre l'entrepôt ou d'ouvrir un lieu : d'abord des
  preuves d'apprentissage fiables (quiz, livret, XP), une progression qui ne se perd pas, un serveur réseau local
  qu'un élève ne peut pas faire tomber.
- 22 octobre 2026 (v19.3) : le simulateur se présente comme un jeu : l'objectif en cours est toujours à l'écran,
  les missions se choisissent dans le journal (L) sans passer par Échap, la progression se mesure en XP, niveaux et
  badges rattachés aux compétences du livret, les bruitages sont synthétisés (aucun fichier), le rendu 3D n'est pas
  touché (30 i/s sur le PC le plus faible). Nouvelle identité visuelle « jeu vidéo » sur toutes les interfaces.
- 22 octobre 2026 (v19.2) : l'entrepôt reste une tuile de l'écran Jouer, à côté du car régie ; on y monte une
  régie mobile (caméras PTZ, mélangeur, enregistreur, réseau) d'après un cahier des charges. Le lien avec le car
  (ce qu'on prépare part sur le lieu) viendra avec la préparation logistique, en v21.

**Décisions ouvertes.**

- R8 (25 octobre 2026) : les postes en 3D. Vue 3D par défaut (2D en mode allégé et en qualité Basse), ou 2D par
  défaut et 3D au choix ? Mesurer d'abord sur le PC le plus faible : au poste en 3D, le car est rendu comme en
  marchant. Faire relire la disposition des pupitres (photos du vrai matériel de l'établissement, R4).

- R11 (28 octobre 2026) : les vrais clubs. Les noms et couleurs des clubs de Ligue 1 sont utilisés sans blason ni logo,
  avec des joueurs fictifs et la mention « simulation non officielle, sans lien avec les clubs » : à faire valider par
  l'établissement avant une diffusion hors de la classe. Les niveaux de jeu (×0,6 dans la force d'une équipe) donnent
  environ 12 % de victoires de Lens contre le Paris SG et 62 % contre Metz : à ajuster après essai.

- R10 (28 octobre 2026) : l'émission en direct. Des périodes de 10 minutes et un barème (lancement au top à 2 s près,
  média diffusé en entier, pas de noir) à essayer avec une classe ; faut-il proposer l'émission dans le car vide, une
  fois l'installation finie, et une variante où la pub est insérée par la régie finale (décrochage) ?

- R9 (26 octobre 2026) : le parcours du Cours. Le rangement des 57 leçons par niveau (`cours/parcours.js`) et les seuils
  (exercice réussi à 60, moyenne de 70 pour ouvrir un niveau, test à 80 %) sont une première proposition : à essayer
  avec une classe. Faut-il aussi un exercice pratique dans le car pour valider les niveaux Avancé et Expert ?

- R1 : la place d'un lieu « Nodal et régie finale » (technicien de trafic, technicien de régie finale,
  responsable nodal), proposé par le rattachement, avant ou à la place de la salle de concert.
- R3 : le public (TIEE seul, ou aussi les options Son et Image) ; le concert sert surtout ces deux options.
- R4 : brancher le vrai matériel de l'établissement.
- R5 : les relecteurs professionnels.
- R7 : la suite de la Carrière (marche à la première personne dans l'entrepôt, saison complète) avant, pendant ou
  après les quatre modules du car ; ses épisodes peuvent porter les modules (M2, la commande du diffuseur, par un
  mail de client).
- R6 : protéger le rôle de formateur en coopération : il se choisit librement dans le salon (une panne forcée
  n'est acceptée que de l'hôte ou du formateur depuis la v19.4) ; un code donné par le formateur, ou le profil
  Formateur de l'ordinateur qui héberge ?
