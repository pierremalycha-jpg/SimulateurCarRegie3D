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
- **TIEE Simulator**, réalisé par le BTS Audiovisuel de Saint-Quentin (logo `src/assets/logo-bts-av.png`),
  développé par Pierre MALYCHA : ces mentions restent sur l'écran titre et dans « À propos » (Réglages).
- **Trois entrées, les mêmes partout** : Jouer · Cours · Réglages. Écran titre (`src/app/title.js`,
  `index.template.html`), écran Jouer (`src/app/start.js`), menu du car (Échap, `src/app/nav.js` : Reprendre,
  Cours, Réglages, Équipe en coopération, Retour à l'accueil), pupitre (`src/ui/pupitre.js` : outils du car,
  Cours, Réglages). Pas de quatrième entrée : un nouvel écran se range dans l'une des trois.
- **Jouer** : le lieu (car régie ; l'entrepôt ; salle de concert en préparation, `src/content/lieux.js`), le
  mode, solo ou coopération (salon `src/ui/session_ui.js`), conditions de captation repliées. Les modes du car
  (décidés le 24 octobre 2026) : **Car vide** (tout à faire ; Olivier propose d'abord la visite guidée, puis aide sur
  demande), **Car pré-installé** (jeu libre : ni chef de car, ni missions, ni objectif ; la coopération se joue ici),
  **Mission spécifique** (une tâche choisie dans `src/game/missions.js`, rangée par famille : installer le car, aux
  postes avec Olivier, épreuves notées ; le car est préparé pour elle (`prepa`) ; à la fin, « Mission suivante »
  (sans recharger si le car convient, `memeCar`) ou « Arrêter » ; déroulement `src/game/mission_run.js`, liste
  `src/ui/missions_ui.js`). Pour l'entrepôt : la Carrière, ses missions, le bac à sable, la reprise du montage. Les
  exercices restent rangés dans leur leçon du Cours ; la Mission spécifique propose les mêmes (mêmes identifiants,
  rien ne compte deux fois).
- **Réglages** : une seule fenêtre (`src/ui/settings.js`), avec le profil Étudiant / Formateur
  (`src/app/profile.js`) ; l'espace formateur (configuration, suivi, relecture) n'y apparaît qu'au profil
  Formateur (classe `role-only`).
- **Section Cours** : un seul modèle, `src/cours/` (chapitres et leçons : `index.js` pour les types et la
  progression, `kit.js` pour les schémas et manipulations, un fichier par chapitre, liste dans `all.js`, ordre
  dans `ORDER`, liens avec le glossaire et les postes dans `liens.js`). L'affichage est `src/ui/cours_ui.js`
  dans l'espace plein écran `src/ui/layer.js` : barre Leçons · Glossaire · Postes · Matériel, un seul sommaire
  (à gauche), la page « Mon suivi » (progression, à faire ensuite, livret). Une leçon = l'essentiel (3 lignes),
  un schéma, une manipulation qui calcule vraiment, l'explication, « dans le car », fiches « ? », un quiz
  (banque d'au moins 5 questions à 3 choix, chaque choix faux expliqué ; chaque essai en tire 3, réponses
  mélangées, corrigé à la validation : `drawQuiz`), ses **exercices pratiques** et son article de référence.
  Ne pas recréer `src/content/cours/` ni `src/ui/cours/`, ni d'onglet Chapitres ou Procédures.
- **L'entrepôt** (`src/entrepot/`, tuile « L'entrepôt » de Jouer, décidé le 22 octobre 2026) : monter une
  régie mobile de A à Z d'après un cahier des charges. Catalogue de matériel réel (`catalogue/`, un fichier par
  groupe, points non vérifiés dans `averifier`), montage (`build.js`), moteur pur et seul juge de ce qui marche
  (`engine.js` : énergie, câbles, IP, vidéo, services, tally, alertes), missions notées (`missions.js`), résultat
  rendu (`suivi.js` → exercice `x-entrepot`, livret), 3D (`scene.js`), panneaux (`ui/` : stock, appareil, menus
  de configuration `ui/config/` un fichier par famille, synoptique, réseau, cahier des charges). Les menus règlent
  les clés que lit le moteur (un réglage sans effet le dit) ; une nouvelle mission se rattache à des compétences. Tests
  `tests/unit/entrepot*.test.mjs`, suite `node tools/e2e.mjs entrepot`. La préparation logistique (flight cases,
  phases électriques, camion, lien avec le car) reste à faire (ROADMAP.md, v21).
- **La Carrière** (`src/carriere/`, premier mode de l'entrepôt, décidé le 23 octobre 2026) : le mode scénarisé (le
  mode libre est le bac à sable). Au bureau du hall (`entrepot/scene/bureau.js`), l'ordinateur reçoit des mails
  qui proposent un poste sur une prestation (`mails.js` : un épisode = l'offre, son ordre de mission, le mail de
  retour ; `requis` pour l'ordre). Une mission reprend une activité qui existe (visite guidée réduite, mission de
  l'entrepôt…) et n'est réussie que si elle l'est (`index.js`, calcul pur, lu dans la progression) : pas d'XP ni de
  livret en double. `PROG.carriere` ne garde que les dates de réception et de lecture. Depuis le car, retour au
  bureau par `restart('carriere')`. Ne pas l'appeler « Scénario » (c'est le jour de match). Tests
  `tests/unit/carriere.test.mjs`, suite `node tools/e2e.mjs carriere`.
- **La caméra en 3D** (`src/camlab/`, ouverte depuis le chapitre La caméra du Cours) : 51 notions écrites, une
  fiche par fichier (`notions/<id>.js`) rangée dans le registre de son groupe (`notions/ch1.js` … `ch89.js`),
  schéma dans `figs/`, manipulation dans `labs/` (elle pilote la 3D par `ctx.lens`, clés listées dans
  `index.js`), styles `src/styles/camlab-<groupe>.css`. Le moule est vérifié par `tests/unit/camlab.test.mjs`
  (compétences du référentiel, leçon `cours` existante). Notions acquises et quiz : `progress.js`, `quiz.js` ;
  exercice noté « Mise en service » : `mes.js` (exercice pratique `x-camera` de la leçon `camera-systeme`).
- **Exercices pratiques** : les parcours d'Olivier (`src/tutor/`) sont rangés dans les leçons par
  `src/cours/exercices.js` (BY_LESSON : chaque exercice une seule fois, test unitaire), avec les exercices notés
  (`x-atelier`, `x-brassage`, `x-reseau`, `x-match`, `x-camera`). Le chef (`src/ui/tutor_ui.js`, touche J) est une
  **boîte de dialogue en bas de l'écran** (`#chef.dlg` : portrait, nom, texte, gestes ; elle passe en haut si
  l'élément montré est dessous, se réduit en une ligne ; pas de petite fenêtre déplaçable) ; il ne propose que les
  exercices du poste où l'on est ; en fin d'exercice, « Revenir à la leçon » (ou « Mission suivante »). La **visite
  guidée** : proposée par Olivier au début du car vide (et la mission de stagiaire de la Carrière) : le tour du car,
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
  `#qmark`), le journal des missions (touche L, bouton Missions du HUD et des en-têtes de poste : exercices du poste,
  toutes les missions par chapitre, badges), XP / niveaux / badges (`xp.js`, calcul pur, barème `BAREME`, badges de
  compétence pilotés par `src/livret.js`), accroches sur les événements (`progression.js`), effets (`fx.js`) et
  bruitages WebAudio (`sfx.js`, réglage dans Réglages → Jeu). Le HUD est épuré : trois blocs (objectif avec le lieu,
  barre d'outils avec le niveau : Pupitre, Missions, Menu, chef pendant un exercice ; bande d'état TC · match ·
  PGM · alarmes) et le retour PGM ; le mini-plan et le panneau du jour de match sont masqués (réglage, objectif). Toute nouvelle activité notée émet un événement et
  prend une ligne dans `progression.js`. Le thème visuel est `src/styles/theme-jeu.css` (chargé en dernier : il
  redéfinit les jetons de couleur et les composants) ; une animation d'entrée n'anime que la position, jamais
  l'opacité finale. L'ancienne carte `#mission` reste dans le code mais est masquée : l'objectif la remplace.
- **Le son (v19.4.1)** : ce que le joueur entend dépend de l'endroit (`src/audio.js` : `ecoute`, `setEar`) : la foule
  dans le stade (rumeur lointaine derrière les tribunes, devant le car), l'écoute de la console au poste son, presque
  rien ailleurs dans le car, silence à l'accueil ; volume dans Réglages. La console (vumètres, loudness, départs) n'en
  dépend pas. Les commentaires ne sont pas dits (pas de synthèse vocale, jugée trop robotique) : fil écrit au poste son.
- **Rendu (v19.5)** : toute nouvelle géométrie passe par `matiere()` (`src/matiere.js`, recettes de relief
  procédurales, triplanaire : pas de texture de fichier) et par un `Builder` en mode `ao` avec `cbox` (arêtes
  arrondies, occlusion cuite) ; une famille de matière = une pièce fusionnée nommée. Le SSAO ne tourne que dans le
  car ; la qualité Basse garde le rendu uni. Suite `node tools/e2e.mjs rendu`, test `tests/unit/matiere.test.mjs`.
- **Le stade (v19.9)** : tout texte dessiné dans une texture passe par `src/textfit.js` (`fillFit`, `fillLines` : la
  police se réduit, rien ne sort du cadre). Locaux sous la tribune `src/stade_locaux.js` (pièces closes, à garder
  cohérentes avec `WALK_ZONES` et `blockedOutside` de `world.js`), bord terrain `src/bordterrain.js`, personnes
  `src/staff.js` (instances articulées de `people.js`), plateau des commentateurs `src/plateau.js` (source STUDIO
  rendue), angles `src/stade_angles.js`. Suite `node tools/e2e.mjs stade`.
- Les fiches « ? » (`src/content/netterms.js` + `terms_*.js`, figures `src/ui/figs_*.js`) restent la source
  des définitions courtes ; une leçon les cite dans `terms`.

## Contenu et ton
- Pédagogique, précis, chiffres vérifiables (normes SMPTE, débits, longueurs) ; quand un chiffre est un ordre
  de grandeur, le dire. Le jargon est expliqué à sa première apparition.
- Pas de marque AMP. Le nom RC Lens et les couleurs sang et or sont admis, pas le blason officiel ; garder la
  mention « simulation non officielle, sans lien avec le club ».
- Les captures et rapports de travail vont dans le dossier de brouillon de la session, pas dans le dépôt.

## Tests de bout en bout (Playwright, Chromium logiciel)
- `node tools/e2e.mjs <suite>` (liste : `node tools/e2e.mjs --list`) ; harnais `tests/e2e/harness.mjs`
  (profil Formateur et écran titre sauté par défaut ; `title: true`, `fresh: true` pour l'écran titre et un
  profil Étudiant). `tests/e2e/postes.mjs` se lance seul. Ne pas reconstruire `dist` pendant qu'une suite tourne.
- Une suite par fonctionnalité nouvelle ; les captures servent à relire l'écran (les regarder).

## Git
- Auteur des commits : `git -c user.name="Pierre Malycha" -c user.email="pierre.malycha@gmail.com" commit`.
- Messages en français, sans identifiant de modèle. Commits petits et réguliers ; `dist/` est versionné (reconstruit
  avant chaque commit de livraison).
- Livraison : `node tools/build.mjs`, suites E2E touchées, mise à jour de `README.md` (section de version, tableau
  du code) et de `ROADMAP.md`, version dans `package.json`, puis publication de l'artefact et du kit exécutable
  (`node tools/exe.mjs --verifier`).
