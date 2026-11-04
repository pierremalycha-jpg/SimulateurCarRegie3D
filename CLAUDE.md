# TIEE Simulator : consignes pour les sessions Claude

Simulateur de formation aux métiers du car régie (BTS Métiers de l'audiovisuel, option TIEE). Une seule page
HTML construite par esbuild (`node tools/build.mjs` → `dist/index.html`), Three.js 0.160, sans framework.
Tout est en français (code commenté en français, interface, commits).

## Avant de commencer
- Lire `README.md` (section de la version en cours, en tête) et `ROADMAP.md` : ce qui existe, ce qui est décidé.
- `git fetch origin main` puis repartir de `origin/main` : plusieurs sessions travaillent en parallèle. Un sujet
  déjà traité sur `main` ne se refait pas dans une autre architecture : on l'étend.
- Vérifier : `npx eslint src tests tools && npx tsc -p tsconfig.json && npm test` (tests unitaires Node, rapides).

## Décisions d'interface (v19) à respecter
- **La page de lecture d'une leçon (v19.26, décidée le 2 novembre 2026)** : une leçon se lit comme une page de présentation qui
  se dévoile au défilement (`src/ui/reveal.js` : les sections `[data-reveal]` reçoivent `co-reveal` puis `in` en entrant à
  l'écran ; tout visible sans observateur, avec moins d'animations ou sous `navigator.webdriver` ; l'opacité finale est toujours
  1 ; une section redessinée garde ses classes). Structure fixe (`lessonPage` de `src/ui/cours_ui.js`, feuille
  `src/styles/cours-lecture.css`, sélecteurs préfixés `.co-lecon`) : l'en-tête (`.co-hero` : fil d'Ariane, titre, l'essentiel en
  trois phrases sans cadre), la barre des étapes collante (`.co-steps-bar`), le schéma légendé par son titre accessible
  (`figure.co-figbox` + `.co-figcap`), la manipulation, l'explication en colonne de lecture (avec « Pour aller plus loin » et
  l'article), « Dans le car », les mots de la leçon (`.co-terms`), le référentiel compact, le quiz puis l'exercice (adjacents :
  `.co-quiz + .co-exoauto`), les exercices pratiques, la navigation. Les cartes ne servent qu'aux blocs où l'on agit ; le texte
  n'a pas de cadre. Rien ne se retire du contenu pour gagner en lisibilité : on range, on espace, on rythme. Un chapitre long se
  range en parties (`PARTIES` : le réseau, le son). Un fondamental qui manque s'ajoute dans son chapitre, avec sa manipulation
  qui calcule depuis un module pur testé (`cours/son_calc.js`, `cours/video_calc.js`), ses six questions expliquées, son exercice,
  ses fiches « ? » et son rattachement. Suite `node tools/e2e.mjs cours-lecture`, test `tests/unit/son.test.mjs`.
- **Le style de l'interface (v19.22, décidé le 2 novembre 2026)** : épuré, inspiré de la direction artistique d'Apple. Un fond
  nuit neutre, des panneaux de verre dépoli (`--mat`, `--blur`) aux grands rayons (`--r-s`, `--r`, `--r-l` ; pilules pour les
  barres), **une seule couleur d'accent** (`--accent`, bleu ; `--neon` et `--cyan` en sont des alias ; `--accent-fill` pour une
  surface pleine sous du texte blanc) pour l'action et la sélection, le rouge tally pour l'antenne (`--tally-key` sous du
  texte blanc), le vert pour le prêt, l'ambre pour l'expérience ; tout texte reste lisible à 4,5:1 (suite accessibilite). Archivo partout (`--f-disp` =
  `--f-body`), corps 15 px, **pas de capitales espacées** sur les touches, titres et étiquettes (seuls les petits en-têtes de
  groupe gris y ont droit), **pas de coin coupé** (`--notch: none`), pas de contour lumineux, pas de LED décorative. Une
  nouvelle feuille lit les jetons de `src/styles/theme-jeu.css` et ne code aucune couleur en dur ; un texte d'interface tient
  en une ou deux lignes (l'explication longue va dans la leçon ou la fiche « ? »). Suite `node tools/e2e.mjs epure`.
- **Le référentiel officiel (v19.23, décidé le 2 novembre 2026)** : les compétences portent leurs numéros officiels **C1 à
  C39** (arrêté du 4 juin 2013 modifié, pages 64 et 104 à 118 du référentiel ; ce sont les numéros des fiches de TP et des
  sujets de TMO), plus jamais 1.1 à 4.5 (la table `ANCIEN` de `src/content/referentiel.js` convertit, `migrateProgress`
  renomme les badges). Chaque compétence a son unité (U3, U4 = la TMO, U51, U52, U6), ses tâches, ses savoir-faire SF01 à
  SF112 et ses savoirs (A1 à L12, avec le niveau demandé à l'option) ; une leçon porte `competences` (la même liste que
  `RATTACHEMENT.cours`, test unitaire) et `savoirs`. Le référentiel est cité tel quel : bloc « Référentiel BTS MAV, option
  TIEE » en fin de leçon, rappel en tête de chapitre, page « Le référentiel du BTS » du Cours (`src/ui/referentiel_ui.js`),
  livret. Les leçons de la TMO (`src/cours/exploitation_tmo.js`, exercices `exos/exploitation_tmo.js`) : synoptique,
  énergie, nodal, PAD, recette. Toute nouvelle leçon cite ses compétences et ses savoirs ; un texte du référentiel ne se
  paraphrase pas, il se cite. Suite `node tools/e2e.mjs referentiel`.
- **Les comptes (v19.24, décidé le 2 novembre 2026)** : Firebase (Authentication par adresse et mot de passe, Firestore),
  `src/comptes/` (`config.js` : projet de l'établissement, valeurs publiques ; vides = sans compte, tout marche comme avant).
  L'élève se connecte avec l'identifiant donné par son professeur (adresse fabriquée `<identifiant>@` `DOMAINE_ELEVES`, domaine
  `.invalid`), ne s'inscrit pas ; le professeur ouvre son compte si son adresse est dans `admin/profs` et confirmée. Le rôle suit
  le compte (`forceRole`). La progression change de propriétaire avec le compte (`useAccount` de `shared.js`, une copie locale
  par compte) ; rien ne passe d'un compte à l'autre. Le tableau de bord du professeur (`ui/tableau_bord.js`) est rangé dans
  Réglages → Espace formateur (plus la bande du compte de l'écran titre). Une difficulté se calcule dans `comptes/bilan.js`
  (essais manqués) ; toute nouvelle activité notée qui garde ses essais y prend sa ligne. Qui lit et écrit quoi :
  `firestore.rules` (tout changement de document s'y reflète et se teste : `node tools/firebase-test.mjs`, émulateur). Suite
  `node tools/e2e.mjs comptes`, tests `tests/unit/comptes.test.mjs`, `tests/firebase/comptes.mjs`.
  Le car régie au tableau de bord (v19.25) : `PROG.car` (temps par activité et par poste, manipulation, gestes, exercices
  pratiques, missions, ce qui est consulté, parties), compté par `comptes/suivi_car.js` sur les événements (`station`,
  `tutor`, `missionCar`, `device`, `teleport`, `modalopen`, `faultNew`…), calculé par `bilanCar` ; un nouveau poste ou un
  nouvel exercice y apparaît seul (catalogues lus dans le code : `ui/tableau_car.js`). L'envoi en ligne est limité à une fois
  par minute (`ENVOI_MIN_MS`, forfait gratuit de Firebase) : ne pas enregistrer en ligne à chaque geste.
- **Le pass, les profils et le classement (v19.27, décidés le 3 novembre 2026)** : sur les comptes de la v19.24 (pas
  d'autre système de comptes). À la connexion, élève ou professeur, la progression faite sans compte sur l'ordinateur est
  proposée à la reprise (`proposerReprise` de `ui/compte_ui.js`) ; fenêtre fermée ou cachée, ce qui attend part en ligne
  (`flushProgress` de `shared.js`). Profil public `profils/<uid>` (`comptes/profils.js`, `profilPourCompte` ; élèves
  seulement, écritures limitées à une toutes les deux minutes). 60 niveaux (`game/xp.js`), le pass (`game/pass.js` : une récompense par niveau, à récupérer puis
  équiper ; objets dessinés par le code, `game/cosmetiques.js`), série et défis du jour (`game/defis.js`, chaque gain porte
  sa sorte). L'espace Profil (`ui/profil_ui.js` : profil, pass, succès, classement) s'ouvre par la carte joueur et le téléphone (applications Profil, Classement), pas par une quatrième entrée. Le profil public ne porte
  jamais d'adresse ; un nouveau champ public s'ajoute aussi aux règles (test unitaire). Test `pass.test.mjs`, suite
  `node tools/e2e.mjs profil`.
- **TIEE Simulator**, réalisé par le BTS Audiovisuel de Saint-Quentin (logo `src/assets/logo-bts-av.png`),
  développé par Pierre MALYCHA : ces mentions restent sur l'écran titre et dans « À propos » (Réglages).
- **Trois entrées, les mêmes partout** : Jouer · Cours · Réglages. Écran titre (`src/app/title.js`,
  `index.template.html`), écran Jouer (`src/app/start.js`), menu du car (Échap, `src/app/nav.js` : Reprendre,
  Cours, Réglages, Équipe en coopération, Retour à l'accueil), téléphone (`src/telephone/` : applications du car,
  Cours, Réglages). Pas de quatrième entrée : un nouvel écran se range dans l'une des trois.
- **Le téléphone** (v19.9, décidé le 25 octobre 2026) : comme dans un GTA, tout ce qui n'est pas dans le décor passe
  par un smartphone levé devant soi (Tab ou T ; bouton Téléphone du HUD et de l'en-tête des postes). Il remplace le
  pupitre et les boutons Pupitre / Missions / Chef de car : le HUD ne garde que le niveau, Téléphone et Menu (Échap).
  Applications (`apps.js`, rangées par famille) : Aller à, Missions, Olivier, Plan caméras, Synoptiques, Matériel,
  Équipe ; Cours, Glossaire, Les postes, Progression ; Réglages, Commandes ; interrupteurs son, vol libre, retour PGM.
  Une application s'affiche sur l'écran (`view`) ou range le téléphone et ouvre sa fenêtre (`open`). Boîtier 3D
  (`modele.js` : `Builder` + `matiere()`, son propre petit rendu WebGL par-dessus tout), écran HTML posé sur la vitre
  par une transformation projective (`cssProjection`, à l'échelle 1 au repos ; pas de `CSS3DRenderer` : clics perdus). Un nouvel outil devient une application, pas un bouton du HUD ; les
  touches historiques (P, Y, K, G, L, J, H, M, V) restent des raccourcis. Le Labo n'a pas de téléphone (il a ses onglets).
  Suite `node tools/e2e.mjs telephone`.
- **Jouer** : le lieu (car régie ; le Labo ; salle de concert en préparation, `src/content/lieux.js`), le
  mode, solo ou coopération (salon `src/ui/session_ui.js`), conditions de captation repliées. Les modes du car
  (décidés le 24 octobre 2026) : **Car vide** (tout à faire ; Olivier propose d'abord la visite guidée, puis aide sur
  demande), **Car pré-installé** (jeu libre : ni chef de car, ni missions ; par défaut l'**émission en direct**, sinon
  « Match en continu » ; la coopération se joue ici),
  **Mission spécifique** (une tâche choisie dans `src/game/missions.js`, rangée par famille : installer le car, aux
  postes avec Olivier, épreuves notées ; le car est préparé pour elle (`prepa`) ; à la fin, « Mission suivante »
  (sans recharger si le car convient, `memeCar`) ou « Arrêter » ; déroulement `src/game/mission_run.js`, liste
  `src/ui/missions_ui.js`). Pour le Labo : un mode par atelier. Les
  exercices restent rangés dans leur leçon du Cours ; la Mission spécifique propose les mêmes (mêmes identifiants,
  rien ne compte deux fois).
- **L'émission en direct** (`src/emission/`, v19.19, décidée le 28 octobre 2026) : au car pré-installé, le match se
  joue comme une émission : décompte (ou « Antenne maintenant »), générique de début de 30 s, deux périodes de 10 min,
  page de pub à la mi-temps, générique de fin, compte rendu. Le conducteur est un calcul pur (`conducteur.js` :
  `SEGMENTS`, `DUREES`, `avance`, `bilan`) ; les médias (`medias.js`) se lancent depuis l'IPDirector (`panneau.js`) sur
  le canal de diffusion de l'EVS (`EVS.ch[i].media`, PGM2, PGM1 en UHD) ; images et musiques sont fabriquées par le
  code (`dessin.js`, `musique.js` : sonie −23 dBFS, marques fictives). Le match a des périodes (`M.periode` dans
  `match.js` : `libre` = le match en continu de toujours, pour le car vide, les missions et les exercices). Seul, les
  postes non occupés sont tenus par l'**équipe virtuelle** (`ia.js`, `titulaire`) ; le poste où l'on est assis n'est
  jamais touché (au mélangeur, les ordres arrivent par l'intercom). Livret 3.11, progression v5 (`PROG.emissions`).
  Tests `tests/unit/emission.test.mjs`, suite `node tools/e2e.mjs emission` (`sauter` raccourcit les séquences).
- **Le match et la vie autour du car** (v19.20, décidé le 28 octobre 2026) : le match se **tire à chaque partie**
  (`match.js` : `tirerMatch`, `nouveauMatch`, graine nouvelle ; forme du jour, style, temps forts ; la même graine rejoue
  le même match) contre un **club de Ligue 1** (`data/clubs.js`, `adversaire.js` : tiré au sort ou choisi dans Jouer,
  transmis par l'hôte en coopération). Les **figurants** (`src/figurants/`, deux troupes instanciées `troupe.js`) :
  l'équipe du car assise à ses postes quand le car est installé (`equipe.js` ; le titulaire du poste où l'on s'assoit
  s'écarte et attend dans l'allée), les techniciens et la sécurité du compound (`compound.js`, itinéraires en boucle,
  jamais à travers les obstacles : `OBSTACLES_COMPOUND` de `world.js`, `truckBlocked`). Dans Jouer, « Ton poste » :
  commencer assis à un poste. Un câble est posé au sol ou tendu entre deux supports, jamais en l'air sans raison.
  Tests `tests/unit/match.test.mjs`, `tests/unit/figurants.test.mjs`, suite `node tools/e2e.mjs figurants`.
- **Le style graphique** (v19.21, décidé le 29 octobre 2026) : « dessin » par défaut (cel shading, `src/style.js` :
  paliers de lumière et ombres nettes par réécriture des `ShaderChunk` de three.js, sans coût ; contours à l'encre et
  couleurs franches dans la composition de `render.js`, qualité Moyenne et Haute), « réaliste » au choix (Réglages). Un
  texte du décor s'écrit avec `texteAjuste` (`util.js`) et ne dépasse jamais de son support : un panneau écrit du stade
  s'inscrit dans `W.panneaux` avec sa boîte (suite `node tools/e2e.mjs graphismes`). Les bancs de touche
  (`figurants/banc.js`) : remplaçants aux couleurs du club, staff, entraîneur dans sa zone technique.
- **Réglages** : une seule fenêtre (`src/ui/settings.js`), avec le profil Étudiant / Formateur
  (`src/app/profile.js`) ; l'espace formateur (configuration, suivi, relecture) n'y apparaît qu'au profil
  Formateur (classe `role-only`).
- **Section Cours** : un seul modèle, `src/cours/` (chapitres et leçons : `index.js` pour les types et la
  progression, `kit.js` pour les schémas et manipulations, un fichier par chapitre, liste dans `all.js`, ordre
  dans `ORDER`, liens avec le glossaire et les postes dans `liens.js`). L'affichage est `src/ui/cours_ui.js`
  dans l'espace plein écran `src/ui/layer.js` : barre Leçons · Glossaire · Postes · Matériel, un seul sommaire
  (à gauche), la page « Mon parcours » (la suite, les catégories, livret). Une leçon = l'essentiel (3 lignes),
  un schéma, une manipulation qui calcule vraiment, l'explication, « dans le car », fiches « ? », un quiz
  (banque d'au moins 5 questions à 3 choix, chaque choix faux expliqué ; chaque essai en tire 3, réponses
  mélangées, corrigé à la validation : `drawQuiz`), ses **exercices pratiques** et son article de référence.
  Ne pas recréer `src/content/cours/` ni `src/ui/cours/`, ni d'onglet Chapitres ou Procédures. **Le parcours** (v19.18,
  décidé le 26 octobre 2026, façon Duolingo) : chaque chapitre est une catégorie dont les leçons sont rangées en niveaux
  Débutant, Intermédiaire, Avancé, Expert (`cours/parcours.js`, table `PARCOURS` : toute nouvelle leçon y prend sa
  place) ; un niveau s'ouvre quand le précédent est validé (leçons terminées, moyenne des exercices ≥ 70) ou par un test
  de niveau ; une leçon se termine par son quiz puis son **exercice en autonomie** (`cours/exo.js`, un fichier par
  chapitre dans `cours/exos/` : valeurs tirées, deux aides et la solution qui coûtent des points ; toute nouvelle leçon
  a le sien, test unitaire) ; « Mon parcours » (`ui/cours_parcours.js`) remplace « Mon suivi » ; au profil Formateur
  tout est ouvert. Suite `node tools/e2e.mjs parcours`. Un long chapitre se
  range en parties (v19.17 : `PARTIES` de `cours/reseau.js`, champ `partie` des leçons, titres dans le sommaire) ; les
  calculs des bases du réseau sont dans `cours/ip_calc.js`.
- **Le Labo** (`src/labo/`, v19.28, décidé le 3 novembre 2026) : il **remplace l'entrepôt et la Carrière** (retirés du
  code ; ne pas les recréer). Lieu « Le Labo » de Jouer, un écran à part par-dessus le reste (`labo/index.js`,
  `styles/labo.css`) : un onglet par atelier (`labo/ateliers.js` : compétences, savoirs, fiches, liens, défis), l'atelier au
  centre (`labo/ateliers/<id>.js` : canvas ou plateau 3D, et commandes de `labo/kit.js`, liées à l'état par chemin pointé et verrouillables),
  à droite Défis et Comprendre (notions, fiches « ? » de `content/terms_labo.js`, liens du Cours, référentiel cité). Un
  atelier calcule sur un modèle pur testé (`labo/calc/` : optique, photométrie, sensitométrie, DMX) ; son état et ses mesures
  sont dans `labo/etats.js`. Ses défis notés (`labo/defis/<id>.js`, moteur `labo/defis.js` sur celui de `cours/exo.js`) :
  trois questions tirées, au moins un **réglage** jugé par le modèle (`fixe` verrouille ce qui est imposé, `corrige` est la
  solution posée), aides et solution qui coûtent ; réussi à 60, compté **seul** sans solution. Suivi `PROG.labo`
  (`labo/suivi.js`, progression v10), XP et badges, défi du jour, livret (`RATTACHEMENT.labo`), tableau de bord, exercice
  `x-labo-<id>` dans une leçon du Cours (`cours/exercices.js`). La console dot2 (`labo/dot2/simulateur_dot2.html`, écrite à
  part) se garde **telle quelle** dans le dépôt ; au chargement, le Labo y pose un crochet d'une ligne (`CROCHET` de
  `labo/ateliers/dot2.js` : l'application publiée sous `window.__laboDot2`) pour lire le show en mémoire et y charger un show.
  Ses défis de programmation (v19.29, `labo/defis/dot2.js`) partent du show de départ `labo/dot2/show_depart.js` (plateau 1
  patché, groupes, presets, aucune cue) et se jugent en relisant le show (`labo/calc/show.js` : tracking, renvois aux presets,
  couleur d'une lyre, effet de position, chaser) : on juge le résultat programmé, pas les touches. Un nouvel atelier : son entrée dans `ateliers.js`, son
  modèle pur, son état, son interface, ses défis, ses fiches ; le test vérifie que chaque réglage a une solution et n'est
  jamais juste d'avance. Test `tests/unit/labo.test.mjs`, suite `node tools/e2e.mjs labo`.
- **La caméra en 3D** (`src/camlab/`, ouverte depuis le chapitre La caméra du Cours) : 51 notions écrites, une
  fiche par fichier (`notions/<id>.js`) rangée dans le registre de son groupe (`notions/ch1.js` … `ch89.js`),
  schéma dans `figs/`, manipulation dans `labs/` (elle pilote la 3D par `ctx.lens`, clés listées dans
  `index.js`), styles `src/styles/camlab-<groupe>.css`. Le moule est vérifié par `tests/unit/camlab.test.mjs`
  (compétences du référentiel, leçon `cours` existante). Notions acquises et quiz : `progress.js`, `quiz.js` ;
  exercice noté « Mise en service » : `mes.js` (exercice pratique `x-camera` de la leçon `camera-systeme`).
- **Le chapitre « La lumière »** (v19.29, décidé le 3 novembre 2026) : `cours/lumiere.js` et ses trois parties
  (`lumiere_mesure.js` : sources, grandeurs, distance, couleur, mesure ; `lumiere_eclairer.js` : projecteurs, plateau, stade ;
  `lumiere_commande.js` : DMX, ligne, console, lyres, Art-Net et sACN), exercices `cours/exos/lumiere_*.js`, fiches
  `content/terms_lumiere_*.js`. Les manipulations calculent avec les modèles du Labo (`labo/calc/`) : leçons et ateliers disent
  les mêmes chiffres. Les ateliers du Labo y sont les exercices pratiques (`x-labo-photometrie`, `x-labo-dmx`, `x-labo-dot2`).
- **Le plateau 3D du Labo** (`src/labo/plateau/`, v19.30, décidé le 4 novembre 2026) : les ateliers Optique et Photométrie se
  jouent sur un plateau vu en isométrie et dessiné en low-poly **polygonal** : des facettes (prismes, cônes, icosaèdres
  froissés), pas des cubes. Le moteur (`scene.js` : un seul rendu WebGL partagé, monté dans
  l'atelier affiché, rendu à la demande ; caméra orthographique, quarts de tour, zoom, recentrer ; glisser-poser au sol ;
  étiquettes en pilules) reçoit de l'atelier un **adaptateur** (scène, objets à prendre, étiquettes, cadre, image de la caméra,
  exposition). Les pièces (`pieces.js`) : Builder en mode `ao`, formes à facettes (`prisme`, `cone`, `boule`, `froisse`),
  `matPlate()` = `matiere()` sans relief, lu à plat, aucun fichier de texture ; les repères (champ, zone nette, cônes, anneau) vivent sur la couche 1, que l'image de la caméra ne voit
  pas. L'image de la caméra (`dof.js`) est rendue pour de vrai : flou par pixel depuis la profondeur avec la formule de la
  leçon (jugée à la définition HD), exposition π ÷ Eref, balance des blancs, zébra ; les lumières sont en unités physiques
  (candelas, lux). Les calculs sont purs (`calc.js`, test `tests/unit/plateau.test.mjs`). L'état des ateliers porte la place
  des objets (`cam.x`, `cam.z`, `lat`) ; un objet déplacé écrit l'état par `ctx.changer` (donc un réglage imposé par un défi
  verrouille aussi l'objet) ; les défis et leurs scènes ne changent pas. Un nouvel atelier en 3D suit ce moule. Suite
  `node tools/e2e.mjs labo-plateau`.
- **Les vues 3D du Cours** (`src/vues3d/`, v19.16, décidé le 26 octobre 2026) : une notion technique qui se
  comprend mieux en la voyant (câble, appareils, réseau, lieu) a sa vue ; une notion de calcul ou de courbe reste en
  2D (tableau de pertinence dans le README). Une vue = un fichier de `vues/` (id, chapitre, `lecons`, `etapes` avec
  `t`, `texte`, `vue`, `reglage`, `lecon` ; `build(ctx)` qui rend `etape`, `update`, `commandes`), inscrite dans
  `catalogue.js` (`aussi` pour un second chapitre). Elle s'ouvre depuis le sommaire du chapitre (« … en 3D », une
  seule entrée par chapitre) ou le « Voir en 3D » d'une leçon ; l'écrit reste dans le panneau de droite (onglets En 3D
  et La leçon). Les lectures chiffrées viennent des modèles purs des leçons (`cours/sdi_mots.js`,
  `cours/st2110_calc.js`, `vues3d/l2.js`…), pas de valeurs écrites à la main. Matières : `kit.js` (`mat`, `verre`,
  `eclat` pour ce qui brille ou circule) au-dessus de `matiere()`. Tests `tests/unit/vues3d.test.mjs`, suite
  `node tools/e2e.mjs vues3d`.
- **Exercices pratiques** : les parcours d'Olivier (`src/tutor/`) sont rangés dans les leçons par
  `src/cours/exercices.js` (BY_LESSON : chaque exercice une seule fois, test unitaire), avec les exercices notés
  (`x-atelier`, `x-brassage`, `x-reseau`, `x-match`, `x-camera`). Le chef (`src/ui/tutor_ui.js`, touche J) est une
  **boîte de dialogue en bas de l'écran** (`#chef.dlg` : portrait, nom, texte, gestes ; elle passe en haut si
  l'élément montré est dessous, se réduit en une ligne ; pas de petite fenêtre déplaçable) ; il ne propose que les
  exercices du poste où l'on est ; en fin d'exercice, « Revenir à la leçon » (ou « Mission suivante »). La **visite
  guidée** : proposée par Olivier au début du car vide : le tour du car,
  puis la présentation de chaque poste ; son plan est dans le suivi des tâches.
- **Livret de compétences** : référentiel TIEE dans `src/content/referentiel.js` (RATTACHEMENT : parcours,
  missions, phases, réseau, exercices, cours, camera), calcul pur dans `src/livret.js`, affichage
  `src/ui/livret.js`. Toute nouvelle activité notée, toute nouvelle leçon se rattache à des compétences. Une
  activité ne compte que réussie seule (sans « Fais-le pour moi ») ; « consolidée » demande un exercice
  pratique (`estPratique`), pas seulement des quiz. L'XP suit la même règle (pannes cachées seulement).
- **Progression** (`src/shared.js`) : `PROG.v` et `migrateProgress` (monter `PROG_VERSION` et ajouter l'étape quand
  la forme change), fusion `mergeProgress` (rien ne se perd entre deux appareils), Réglages → Ma progression
  (`src/ui/ma_progression.js` : export, import, effacement, données personnelles). Aucune ressource externe nouvelle
  (polices intégrées par `tools/build.mjs`).
- **La couche jeu (v19.3)**, `src/game/` : le **suivi des tâches sur le côté** (`quest.js`, `#quest` : la mission en
  cours et ses tâches cochées, groupées en car vide, les étapes d'un exercice, le plan de la visite ; repère 3D
  `#qmark`), le journal des missions (touche L, application Missions du téléphone : exercices du poste,
  toutes les missions par chapitre, badges), XP / niveaux / badges (`xp.js`, calcul pur, barème `BAREME`, badges de
  compétence pilotés par `src/livret.js`), accroches sur les événements (`progression.js`), effets (`fx.js`) et
  bruitages WebAudio (`sfx.js`, réglage dans Réglages → Jeu). Le HUD est épuré : trois blocs (objectif avec le lieu,
  barre d'outils avec le niveau : Téléphone, Menu ; bande d'état TC · match · PGM · alarmes) et le retour PGM ; le mini-plan et le panneau du jour de match sont masqués (réglage, objectif). Toute nouvelle activité notée émet un événement et
  prend une ligne dans `progression.js`. Le thème visuel est `src/styles/theme-jeu.css` (chargé en dernier : il
  redéfinit les jetons de couleur et les composants ; depuis la v19.22, le style épuré ci-dessus) ; une animation d'entrée
  n'anime que la position, jamais l'opacité finale. L'ancienne carte `#mission` reste dans le code mais est masquée : l'objectif la remplace.
- **Le son (v19.4.1)** : ce que le joueur entend dépend de l'endroit (`src/audio.js` : `ecoute`, `setEar`) : la foule
  dans le stade (rumeur lointaine derrière les tribunes, devant le car), l'écoute de la console au poste son, presque
  rien ailleurs dans le car, silence à l'accueil ; volume dans Réglages. La console (vumètres, loudness, départs) n'en
  dépend pas. Les commentaires ne sont pas dits (pas de synthèse vocale, jugée trop robotique) : fil écrit au poste son.
- **Rendu (v19.5)** : toute nouvelle géométrie passe par `matiere()` (`src/matiere.js`, recettes de relief
  procédurales, triplanaire : pas de texture de fichier) et par un `Builder` en mode `ao` avec `cbox` (arêtes
  arrondies, occlusion cuite) ; une famille de matière = une pièce fusionnée nommée. Le SSAO ne tourne que dans le
  car ; la qualité Basse garde le rendu uni. Suite `node tools/e2e.mjs rendu`, test `tests/unit/matiere.test.mjs`.
- **Version à partager protégée (v19.14, décidé le 26 octobre 2026, dépôt public)** : seulement
  `TIEE-Simulator.exe` (`tools/exe.mjs`) et, sur Mac (v19.15), `TIEE-Simulator-mac.dmg` (`tools/mac.mjs`, pièces
  `tools/macapp.mjs`, communes `tools/sea.mjs` ; construit sur un Mac de GitHub), plus de fichier HTML dans le kit. La page y est chiffrée par le mot de
  passe (`lan/coffre.mjs`, serveur protégé `tools/protege.mjs`) : écran « Accès réservé » de `lan/serveur.mjs`, jeton
  par navigateur, rien d'autre servi sans lui. Signature Authenticode par `tools/signature.mjs`. Construction et
  publication par GitHub (`.github/workflows/exe.yml`, secrets `TIEE_MDP`, `TIEE_SIGN_CERT`, `TIEE_SIGN_KEY`). Ne
  jamais écrire le mot de passe ni une clé privée dans le dépôt ; ne pas republier la page construite (artefacts de
  l'intégration continue, `dist/index.html` versionné). Tests `tests/unit/acces.test.mjs`, suite `node tools/e2e.mjs acces`.
- Les fiches « ? » (`src/content/netterms.js` + `terms_*.js`, figures `src/ui/figs_*.js`) restent la source
  des définitions courtes ; une leçon les cite dans `terms`.

## Contenu et ton
- Pédagogique, précis, chiffres vérifiables (normes SMPTE, débits, longueurs) ; quand un chiffre est un ordre
  de grandeur, le dire. Le jargon est expliqué à sa première apparition.
- Pas de marque AMP. Le nom RC Lens et les couleurs sang et or sont admis, pas le blason officiel ; garder la
  mention « simulation non officielle, sans lien avec le club ». Les adversaires (`data/clubs.js`) : nom et couleurs
  du club, jamais de blason ni de logo, des joueurs fictifs, un niveau de jeu fictif ; « sans lien avec les clubs ».
- Les captures et rapports de travail vont dans le dossier de brouillon de la session, pas dans le dépôt.

## Tests de bout en bout (Playwright, Chromium logiciel)
- `node tools/e2e.mjs <suite>` (liste : `node tools/e2e.mjs --list`) ; harnais `tests/e2e/harness.mjs`
  (profil Formateur et écran titre sauté par défaut ; `title: true`, `fresh: true` pour l'écran titre et un
  profil Étudiant). `tests/e2e/postes.mjs` se lance seul. Ne pas reconstruire `dist` pendant qu'une suite tourne.
- Une suite par fonctionnalité nouvelle ; les captures servent à relire l'écran (les regarder).

## Git
- Auteur des commits : `git -c user.name="Pierre Malycha" -c user.email="pierre.malycha@gmail.com" commit`.
- Messages en français, sans identifiant de modèle. Commits petits et réguliers ; `dist/` n'est plus versionné
  (v19.14 : le dépôt est public, la page construite ne doit pas y être téléchargeable).
- Livraison : `node tools/build.mjs`, suites E2E touchées, mise à jour de `README.md` (section de version, tableau
  du code) et de `ROADMAP.md`, version dans `package.json`, puis publication de l'artefact et du kit exécutable
  (`TIEE_MDP=… node tools/exe.mjs --verifier` en local, `tools/mac.mjs` sur un Mac, ou étiquette `v…` poussée :
  workflow `exe.yml`, Windows et macOS dans la même Release).
