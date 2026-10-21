// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le capteur CMOS 2/3" ». Zone image 9,59 × 5,39 mm, 1920 × 1080 photosites de 5 µm.
// Sony HXC-FB80 : trois CMOS 2/3", sensibilité F13 à 2000 lux (50i, 3200 K, réflectance 89,9 %),
// rapport signal sur bruit 60 dB. Bruit de photons = √n ; capacité d'un photosite de 5 µm :
// quelques dizaines de milliers d'électrons (la manipulation prend 20 000). La manipulation
// (camlab/labs/bloc.js, « capteur ») grossit jusqu'aux photosites et remplit un puits.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const CAPTEUR = {
  t: 'Le capteur CMOS 2/3"', aka: 'Imager, sensor ; photosite, pixel', chap: 3, lot: 1, point: 'bloc',
  short: 'Un capteur de 9,6 × 5,4 mm et ses 1920 × 1080 photosites, chacun sous une microlentille. Trois capteurs, un par couleur, au lieu d\'un capteur à filtres colorés.',
  fig: 'capteur',
  lab: 'capteur',
  body: "**Deux tiers de pouce.** Le nom vient des tubes de caméra, dont on donnait le diamètre en pouces ; la zone image d'un capteur 2/3\" en 16:9 mesure 9,59 × 5,39 mm. Dessus, 1920 colonnes et 1080 lignes de photosites, un peu plus de deux millions, de 5 µm de côté : un cheveu en couvre quinze.\n\n**Le photosite.** Chaque photosite est une photodiode gravée dans le silicium. Pendant la durée d'exposition, 1/50 s par défaut, chaque photon qui l'atteint libère un électron, qui s'accumule dans un « puits ». À la fin, on mesure la charge : plus il y a d'électrons, plus le pixel est clair. Au-dessus du photosite, une microlentille ramasse la lumière qui tomberait entre deux photosites. Le puits a une capacité : quelques dizaines de milliers d'électrons. Plein, il ne compte plus : c'est le blanc écrêté.\n\n**Le signal et le bruit.** Les photons arrivent au hasard : un photosite qui en reçoit n en moyenne en reçoit en fait n ± √n. À 10 000 électrons, l'écart est de 100, soit 1 % : invisible. À 100 électrons, il est de 10, soit 10 % : c'est le grain des zones sombres. S'y ajoute le bruit de la lecture électronique. La caméra annonce 60 dB de rapport signal sur bruit, mille contre un, dans de bonnes conditions. Le gain amplifie le signal et le bruit ensemble ; il n'ajoute aucune lumière.\n\n**La sensibilité.** Elle se donne en nombre f : « F13 à 2000 lux » veut dire qu'une scène éclairée à 2000 lux est bien exposée à f/13. À 500 lux, quatre fois moins, il faut f/6,5. Plus le nombre est grand, plus la caméra est sensible.\n\n**CMOS.** Chaque photosite a son propre amplificateur, et le capteur se lit ligne après ligne, du haut vers le bas, en un cinquantième de seconde : c'est l'obturateur déroulant. Un flash de photographe peut n'éclairer qu'une bande de l'image ; un panoramique très rapide penche légèrement les verticales. Les CCD d'avant lisaient toute l'image d'un coup, mais consommaient plus et lisaient plus lentement.",
  vraie: "On ne voit jamais le capteur : il est collé sur le prisme, et l'ensemble ne se démonte pas. Ce qu'on en voit, c'est son comportement : le grain quand le gain monte (sélecteur GAIN L, M, H sur le côté droit, 0, 6 et 12 dB), le blanc qui écrête, et les réglages qui en dépendent, shutter et balance des noirs.\n\n**Le bon geste.** Donner de la lumière au capteur plutôt que du gain : ouvrir l'iris, enlever un ND, demander un projecteur, et le gain en dernier recours. Refaire la balance des noirs après un changement de gain : le niveau de noir des trois voies bouge avec lui.\n\n**L'erreur fréquente.** Un point blanc fixe dans l'image, toujours au même endroit, quelle que soit la scène : un photosite défectueux, pas une poussière. Une procédure du menu MAINTENANCE les masque en les remplaçant par la moyenne de leurs voisins.",
  plus: "- **Pourquoi 2/3\" en broadcast.** C'est une taille de compromis : assez grande pour la sensibilité, assez petite pour qu'un zoom 12× tienne dans la main, et un 100× sur une caméra de tribune. Et une profondeur de champ confortable, précieuse en direct.\n- **La taille des photosites.** Un photosite plus grand a un puits plus grand et reçoit plus de photons : moins de bruit, plus de dynamique. Un capteur 2/3\" en 4K a des photosites de 2,5 µm, quatre fois plus petits : il demande plus de lumière ou plus de traitement.\n- **La dynamique.** Entre le noir noyé dans le bruit et le blanc qui écrête, le capteur voit une douzaine de diaphragmes ; le knee comprime les hautes lumières pour en garder un peu plus.\n- **Après le capteur.** La charge devient une tension, puis un nombre : le convertisseur analogique-numérique et la quantification, au chapitre du traitement.",
  car: "Dans le car, la vision juge le capteur sur la forme d'onde : le bruit qui épaissit le trait dans les noirs quand le gain monte. Quand l'éclairage du stade baisse en fin de match, le chef de car annonce « on passe à +6 dB » sur toutes les caméras, pour qu'elles gardent le même grain. Les caméras de super ralenti, qui exposent chaque image trois fois moins longtemps, sont les premières à manquer de lumière.",
  quiz: [
    {
      q: 'Un photosite reçoit 100 électrons de signal. Quel est l\'ordre de grandeur du bruit de photons ?',
      a: [
        ['± 1 électron', 'Le bruit de photons vaut la racine carrée du signal : √100 = 10.'],
        ['± 10 électrons, soit 10 % du signal', 'Exact : c\'est le grain des zones sombres. À 10 000 électrons, le bruit (± 100) ne fait plus que 1 %.'],
        ['± 100 électrons', 'Le bruit n\'égale jamais le signal, sauf à un seul électron.'],
      ],
      ok: 1,
    },
    {
      q: 'Monter le gain de +12 dB…',
      a: [
        ['amplifie le signal et le bruit ensemble : l\'image est plus claire, mais plus grenue.', 'Exact : +12 dB, c\'est quatre fois, deux diaphragmes, bruit compris.'],
        ['ajoute de la lumière sur le capteur.', 'Le gain amplifie après le capteur ; pas un photon de plus n\'arrive.'],
        ['réduit le bruit en moyennant les photosites.', 'Aucun moyennage : chaque photosite est amplifié tel quel.'],
      ],
      ok: 0,
    },
    {
      q: 'Que signifie « F13 à 2000 lux » dans la fiche technique ?',
      a: [
        ['La caméra ne fonctionne qu\'à partir de 2000 lux.', 'Elle fonctionne bien en dessous, en ouvrant l\'iris ou en montant le gain.'],
        ['L\'iris se ferme tout seul à f/13 quand il y a 2000 lux.', 'Ce n\'est pas un automatisme : c\'est une mesure, iris en manuel.'],
        ['Une scène éclairée à 2000 lux est bien exposée à f/13 : plus le nombre f est grand, plus la caméra est sensible.', 'Exact : à 500 lux, quatre fois moins, il faudra f/6,5. C\'est la façon broadcast de donner la sensibilité.'],
      ],
      ok: 2,
    },
  ],
  see: ['prisme', 'gain', 'shutter', 'quantif', 'grandcapteur', 'focale'],
  ref: 'Sony HXC-FB80 : trois capteurs CMOS 2/3" 1920 × 1080, sensibilité F13 à 2000 lux (50i, 3200 K, réflectance 89,9 %), rapport signal sur bruit 60 dB ; zone image 2/3" 16:9 : 9,59 × 5,39 mm',
  competences: ['2.9'],
};
