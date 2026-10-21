# Car régie 3D : consignes pour les sessions Claude

Simulateur de formation aux métiers du car régie (BTS Métiers de l'audiovisuel, option TIEE). Une seule page
HTML construite par esbuild (`node tools/build.mjs` → `dist/index.html`), Three.js 0.160, sans framework.
Tout est en français (code commenté en français, interface, commits).

## Avant de commencer
- Lire `README.md` (section de la version en cours, en tête) et `ROADMAP.md` : ce qui existe, ce qui est décidé.
- `git fetch origin main` puis repartir de `origin/main` : plusieurs sessions travaillent en parallèle. Un sujet
  déjà traité sur `main` ne se refait pas dans une autre architecture : on l'étend.
- Vérifier : `npx eslint src tests tools && npx tsc -p tsconfig.json && npm test` (tests unitaires Node, rapides).

## Décisions d'interface (v18.4) à respecter
- **Cinq familles, les mêmes partout** : Jouer · Cours · Chef de car · Formateur · Réglages. Écran titre
  (`src/app/title.js`, `index.template.html`), menu du car (Échap, `src/app/nav.js`), pupitre (`src/ui/pupitre.js`),
  feuille de service (`src/app/start.js`). Pas de sixième entrée : un nouvel écran se range dans une famille.
- **Profils** Étudiant / Formateur (`src/app/profile.js`) : ce qui est réservé au formateur porte la classe
  `role-only` (espace formateur, suivi, relecture technique, pannes).
- **Section Cours** : un seul modèle, `src/cours/` (chapitres et leçons : `index.js` pour les types et la
  progression, `kit.js` pour les schémas et manipulations, un fichier par chapitre : `signal.js`, `sdi.js`,
  `reseau.js`, `hf.js`, liste dans `all.js`, liens avec le glossaire et les postes dans `liens.js`). L'affichage
  est `src/ui/cours_ui.js`, dans l'espace plein écran `src/ui/layer.js`. Une leçon = l'essentiel (3 lignes),
  un schéma, une manipulation qui calcule vraiment, l'explication, « dans le car », fiches « ? », quiz de
  3 questions (chaque mauvaise réponse expliquée). Ne pas recréer `src/content/cours/` ni `src/ui/cours/`
  (ancienne maquette, fusionnée dans ce modèle).
- **Chef de car** : le tuteur Olivier (`src/tutor/`, panneau `src/ui/tutor_ui.js`, touche J) et son espace
  (`src/ui/entrainement.js` : parcours par famille, exercices notés, missions, livret de compétences).
- **Livret de compétences** : référentiel TIEE dans `src/content/referentiel.js` (RATTACHEMENT : parcours,
  missions, phases, réseau, exercices, cours), calcul pur dans `src/livret.js`, affichage `src/ui/livret.js`.
  Toute nouvelle activité notée se rattache à des compétences.
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
