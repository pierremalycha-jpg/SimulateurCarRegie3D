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

## Construire et tester

```
npm install
node tools/build.mjs          # produit dist/index.html (fichier unique, three.js chargé depuis jsDelivr)
node tools/build.mjs --dev    # même chose sans minification
node tools/v3.mjs OUT hd      # postes, son, pannes, formateur, perf (aussi : scenario, ip, ops)
node tools/func.mjs           # tests fonctionnels historiques
```

## Organisation du code (`src/`)

| Fichier | Rôle |
| --- | --- |
| `data.js` | Catalogues (caméras, objectifs, liaisons, positions, antennes, modulations) et contenus pédagogiques |
| `equip.js` | Profil matériel (XVS-6000, XT4K, LSM, IPDirector) et répartition des canaux EVS |
| `world.js` | Stade, éclairage, public, compound et extérieur du car |
| `truck.js` | Intérieur du car (postes, écrans, baies) |
| `match.js` | Simulation du match, rendu des joueurs, enregistrement d'état (base des ralentis EVS) |
| `bcam.js` | Caméras broadcast : optique, cadreurs automatiques, traitement CCU (knee, white clip, HLG), câbles |
| `rf.js` | Bilan de liaison HF, diversité, brouillage |
| `pipeline.js` | Grille, mélangeur, EVS, multiview, retour antenne, mesures (waveform, vecteurscope), HDR |
| `patch.js` | Baie de brassage : liaisons attendues, résolution des signaux, score |
| `ipnet.js` | Car IP : réseaux ST 2022-7, PTP, NMOS, débits |
| `audio.js` | Console son : sources, bus PGM / INTL / N-1, retard de ligne, embedder, loudness EBU R128, pannes son |
| `scenario.js` | Scénario « jour de match » chronométré et noté |
| `shared.js` | Données partagées de la page publiée (configuration, progression) avec repli local |
| `review.js` | Points techniques à faire relire par le formateur |
| `gfx.js` | Habillage (score, bandeaux, statistiques) |
| `truck.js` (car) | Intérieur du car : plan, postes, baies et pupitres détaillés, collisions |
| `ui/` | Plan du car (`truckmap.js`), postes (`stations.js`, `st_vision.js`, `st_evs.js`, `st_mixer.js`, `st_ipd.js`, `st_patch.js`), espace formateur (`config.js`), rapports (`report.js`), plan, guide, missions |
| `equipment/` | Visionneuse de matériel : appareils (`devices.js`), liste de câblage (`cabling.js`), rendu SVG et photos (`viewer.js`) |
| `faults.js`, `exercises.js` | Simulateur de pannes, réalisateur virtuel et opérateur EVS automatique |
