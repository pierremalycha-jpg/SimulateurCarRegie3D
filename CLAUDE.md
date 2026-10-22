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
- **Jouer** : le lieu (car régie ; salle de concert en préparation, `src/content/lieux.js`), le mode (car
  installé, tout à faire, visite guidée), solo ou coopération (salon `src/ui/session_ui.js`), conditions de
  captation repliées. Pas de liste de scénarios : les exercices notés (car vide, atelier, jour de match,
  formation réseau, mise en service de la caméra) se lancent depuis leur leçon du Cours. L'entrepôt sera un
  mode à part (ROADMAP.md).
- **Réglages** : une seule fenêtre (`src/ui/settings.js`), avec le profil Étudiant / Formateur
  (`src/app/profile.js`) ; l'espace formateur (configuration, suivi, relecture) n'y apparaît qu'au profil
  Formateur (classe `role-only`).
- **Section Cours** : un seul modèle, `src/cours/` (chapitres et leçons : `index.js` pour les types et la
  progression, `kit.js` pour les schémas et manipulations, un fichier par chapitre, liste dans `all.js`, ordre
  dans `ORDER`, liens avec le glossaire et les postes dans `liens.js`). L'affichage est `src/ui/cours_ui.js`
  dans l'espace plein écran `src/ui/layer.js` : barre Leçons · Glossaire · Postes · Matériel, un seul sommaire
  (à gauche), la page « Mon suivi » (progression, à faire ensuite, livret). Une leçon = l'essentiel (3 lignes),
  un schéma, une manipulation qui calcule vraiment, l'explication, « dans le car », fiches « ? », quiz de
  3 questions (chaque mauvaise réponse expliquée), ses **exercices pratiques** et son article de référence.
  Ne pas recréer `src/content/cours/` ni `src/ui/cours/`, ni d'onglet Chapitres ou Procédures.
- **La caméra en 3D** (`src/camlab/`, ouverte depuis le chapitre La caméra du Cours) : 51 notions écrites, une
  fiche par fichier (`notions/<id>.js`) rangée dans le registre de son groupe (`notions/ch1.js` … `ch89.js`),
  schéma dans `figs/`, manipulation dans `labs/` (elle pilote la 3D par `ctx.lens`, clés listées dans
  `index.js`), styles `src/styles/camlab-<groupe>.css`. Le moule est vérifié par `tests/unit/camlab.test.mjs`
  (compétences du référentiel, leçon `cours` existante). Notions acquises et quiz : `progress.js`, `quiz.js` ;
  exercice noté « Mise en service » : `mes.js` (exercice pratique `x-camera` de la leçon `camera-systeme`).
- **Exercices pratiques** : les parcours d'Olivier (`src/tutor/`) sont rangés dans les leçons par
  `src/cours/exercices.js` (BY_LESSON : chaque exercice une seule fois, test unitaire), avec les exercices notés
  (`x-atelier`, `x-brassage`, `x-reseau`, `x-match`, `x-camera`). Le panneau du chef (`src/ui/tutor_ui.js`,
  touche J) ne propose que les exercices du poste où l'on est ; en fin d'exercice, « Revenir à la leçon ». La
  **visite guidée** (mode de Jouer) : le tour du car, puis la présentation de chaque poste (« Poste suivant »).
- **Livret de compétences** : référentiel TIEE dans `src/content/referentiel.js` (RATTACHEMENT : parcours,
  missions, phases, réseau, exercices, cours, camera), calcul pur dans `src/livret.js`, affichage
  `src/ui/livret.js`. Toute nouvelle activité notée, toute nouvelle leçon se rattache à des compétences.
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
