# Car régie 3D — simulateur de formation

Simulateur pédagogique d'une captation de football en car régie : stade 3D, plan de caméras, liaisons
(SMPTE, triax, fibre, coax, IP, HF), car régie visitable en vue à la première personne et postes
interactifs (réalisateur, scripte, mélangeur, habillage, vision/RCP, EVS, son, HF, grille, CCU,
synchro, transmission, intercom, chef de car avec simulateur de pannes).

Aux postes, les écrans utiles restent affichés en permanence (zone d'écrans fixe, moniteur flottant
déplaçable) et un fil « Ce qui se passe » explique chaque action. Le poste vision reprend un RCP de type
RCP-3500, le poste ralentis une télécommande de type LSM-VIA. Une visionneuse de matériel montre les faces
avant/arrière (caméra système, CCU, RCP, serveur ralenti, LSM, grille, SPG…), chaque connecteur et la liste
de câblage générée à partir de l'installation.

## Construire

```
npm install
node tools/build.mjs          # produit dist/index.html (fichier unique, three.js chargé depuis jsDelivr)
node tools/v2.mjs             # tests fonctionnels (postes, RCP, LSM, matériel, câblage) avec Playwright
```

## Organisation du code (`src/`)

| Fichier | Rôle |
| --- | --- |
| `data.js` | Catalogues (caméras, objectifs, liaisons, positions, antennes, modulations) et contenus pédagogiques |
| `world.js` | Stade, éclairage, public, compound et extérieur du car |
| `truck.js` | Intérieur du car (postes, écrans, baies) |
| `match.js` | Simulation du match, rendu des joueurs, enregistrement d'état (base des ralentis EVS) |
| `bcam.js` | Caméras broadcast : optique, cadreurs automatiques, traitement CCU, câbles |
| `rf.js` | Bilan de liaison HF, diversité, brouillage |
| `pipeline.js` | Grille, mélangeur, EVS, multiview, retour antenne, mesures (waveform, vecteurscope) |
| `gfx.js` | Habillage (score, bandeaux, statistiques) |
| `audio.js` | Son du programme, loudness EBU R128 |
| `ui/` | Postes (`stations.js`, `st_vision.js`, `st_evs.js`, `widgets.js`), plan des caméras, guide, missions, synoptique |
| `equipment/` | Visionneuse de matériel : définitions des appareils (`devices.js`), liste de câblage (`cabling.js`), rendu SVG (`viewer.js`) |
| `faults.js`, `exercises.js` | Simulateur de pannes, réalisateur virtuel et opérateur EVS automatique |
