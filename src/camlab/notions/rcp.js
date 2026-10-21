// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Le RCP et l'ingénieur de la vision ». Mode d'emploi Sony RCP-1500/1501/1530 : PANEL
// ACTIVE (donne la main au pupitre ; éteint, le panneau est verrouillé), CAM PW (alimente la caméra
// depuis la CCU), BARS (barres ou signal de test), CALL, AUTO IRIS, MASTER GAIN (fenêtre en dB),
// fenêtres ND et CC avec leurs touches, WHITE (balance des blancs automatique), boutons WHITE R, G,
// B et BLACK/FLARE R, G, B, bloc iris et master black à manche (joystick). Mode d'emploi HXCU-FB80 :
// RCP de la série RCP-1000 par câble, ou par le réseau (RCP-1500, 1501, 1530, alimentés en PoE).
// Exposition : un cran d'iris = un diaphragme = +6 dB de gain (×2). La manipulation (labs/ch7.js,
// « rcp ») fait prendre la main, exposer au manche, rattraper une baisse de lumière de quatre
// diaphragmes (l'iris ne donne que 3,3 diaphragmes de f/5,6 à f/1,8 : il faut +6 dB), puis caler
// le noir au master black et rendre la main.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const RCP = {
  t: 'Le RCP et l\'ingénieur de la vision', aka: 'Remote Control Panel, pupitre de commande à distance ; type Sony RCP-1500', chap: 7, lot: 2, point: 'rcp',
  short: 'Le pupitre de la vision : l\'iris et le noir au manche, la balance, le gain, les filtres et les menus de peinture, à distance de la caméra. La touche PANEL ACTIVE lui donne la main.',
  fig: 'rcp',
  lab: 'rcp',
  body: "**Un pupitre par caméra.** À la régie, devant le mur d'écrans, l'**ingénieur de la vision** a un RCP (Remote Control Panel) par caméra. Relié à la CCU, il règle l'image à distance, pendant que le cadreur s'occupe du cadre, du zoom et du point. Le RCP ne fabrique pas l'image : il envoie des ordres à la caméra, à travers la CCU et la fibre, et affiche en retour les valeurs réglées.\n\n**Ce qu'il commande.** Sur un RCP type Sony RCP-1500 :\n- **le manche** (joystick) : on le pousse ou on le tire pour l'**iris** ; on tourne son bouton pour le **master black**, le niveau du noir de l'image ;\n- **les balances** : la touche WHITE lance la balance des blancs automatique ; les boutons WHITE R, G, B et BLACK R, G, B retouchent les blancs et les noirs voie par voie ;\n- **MASTER GAIN** : le gain, affiché en dB ;\n- **les filtres** : ND (densité neutre, qui retire de la lumière) et CC (température de couleur), affichés chacun dans sa fenêtre ;\n- le shutter, et par les menus du pupitre toute la peinture de l'image : gamma, knee, détail, matrice ;\n- **CAM PW** (alimenter la caméra depuis la CCU), **BARS** (envoyer les barres), **CALL** (appeler le cadreur ; lui aussi peut appeler la vision).\n\n**PANEL ACTIVE.** Tant que cette touche est éteinte, le panneau est verrouillé : un geste sur le pupitre ne change rien à l'image. On l'allume pour régler, on l'éteint quand la caméra est réglée. Plusieurs pupitres peuvent atteindre la même caméra (son RCP, le pupitre maître du chef vision) : PANEL ACTIVE dit lequel a la main.\n\n**Le geste de la vision.** L'œil sur le moniteur de référence et la forme d'onde, la main sur le manche : on suit l'exposition en continu. Et un ordre pour exposer :\n1. la lumière, ou le filtre ND, pour le gros ;\n2. l'iris pour le réglage fin, entre f/2,8 et f/8 si possible ;\n3. le gain seulement quand l'iris est en butée : chaque +6 dB vaut un diaphragme, et ajoute du bruit.",
  vraie: "Le RCP se branche sur la CCU, par son câble ou par le réseau (les RCP-1500, 1501 et 1530, alimentés en PoE). Sans CCU, il se branche directement sur la prise REMOTE de la caméra. Une fois la caméra reliée, son menu PAINT suit le RCP : c'est lui qui a la main sur la peinture.\n\n**Le bon geste.** Allumer PANEL ACTIVE avant de régler, l'éteindre après. Régler en regardant la mesure, pas seulement l'image : le blanc de référence sous 100 %, les visages vers 60 à 70 %, le noir à sa place. Répondre au CALL du cadreur.\n\n**L'erreur fréquente.** Tourner un bouton sur le mauvais RCP : le nom de la caméra est affiché sur chaque pupitre, on le lit. Monter le gain alors que l'iris pouvait encore s'ouvrir. Laisser le panneau actif et poser un dossier dessus.",
  plus: "- **Le pupitre maître.** Le chef vision a un MSU (Master Setup Unit) qui atteint toutes les caméras, leurs fichiers de réglage, et peut copier le réglage d'une caméra sur une autre. Sur un petit plateau, un RCP par caméra suffit.\n- **Les menus de peinture.** Toutes les pages PAINT de la caméra (P01 à P14 : niveaux, température de couleur, gamma, black gamma, saturation, knee, white clip, détail, matrice) sont réglables depuis le RCP. Le cadreur les voit dans son menu, mais ne les règle pas.\n- **AUTO IRIS.** Une touche du RCP passe l'iris en automatique. En direct, on reste en manuel : l'automatique fait « pomper » l'image dès qu'une chemise blanche entre dans le cadre.\n- **Pourquoi pas le gain d'abord.** De f/5,6 à f/1,8, l'iris donne 3,3 diaphragmes sans un grain de bruit de plus. +6 dB de gain donne un diaphragme, mais multiplie aussi le bruit par deux.\n- **Plusieurs caméras, une seule image.** La vision règle toutes les caméras au même niveau et aux mêmes couleurs : c'est le line-up, puis le suivi pendant l'émission.",
  car: "Au poste Vision du car, une rangée de RCP (type RCP-3500, le successeur du RCP-1500), un par caméra, avec le pupitre maître au milieu, devant le moniteur de référence et l'instrument de mesure (forme d'onde, parade, vecteurscope). L'ingénieur vision expose toutes les caméras du match au même niveau, la main sur les manches, et suit la lumière jusqu'au coup de sifflet final.",
  quiz: [
    {
      q: 'L\'ingénieur vision tourne le bouton du master black, mais l\'image ne change pas. Que vérifier d\'abord ?',
      a: [
        ['Que PANEL ACTIVE est allumé : éteint, le panneau est verrouillé.', 'Exact : verrouillé, le pupitre ne commande rien. C\'est fait exprès, contre les gestes involontaires.'],
        ['Que le cadreur a bien fait le point.', 'Le point n\'a rien à voir avec le niveau du noir : un noir flou reste un noir.'],
        ['Que le gain est à 0 dB.', 'Le master black agit quel que soit le gain.'],
      ],
      ok: 0,
    },
    {
      q: 'Le plateau perd un diaphragme de lumière ; l\'iris est à f/4. Que fait la vision ?',
      a: [
        ['Elle monte le gain de +6 dB.', 'L\'exposition revient, mais avec deux fois plus de bruit, alors que l\'iris pouvait encore s\'ouvrir sans rien coûter.'],
        ['Elle ouvre l\'iris d\'un cran, à f/2,8.', 'Exact : un cran d\'iris compense un diaphragme, sans bruit ni saccade.'],
        ['Elle ajoute un filtre ND.', 'Un filtre ND retire de la lumière : l\'image serait encore plus sombre.'],
      ],
      ok: 1,
    },
    {
      q: 'Pendant l\'émission, qui règle quoi ?',
      a: [
        ['Le cadreur règle l\'iris, la vision le cadre.', 'C\'est l\'inverse : la vision ne touche pas au cadre, et le cadreur laisse l\'iris au RCP.'],
        ['La vision règle tout depuis le RCP, cadre compris.', 'Le RCP ne commande ni le panoramique, ni le zoom, ni le point d\'une caméra sur pied : c\'est le travail du cadreur.'],
        ['Le cadreur règle le cadre, le zoom et le point ; la vision règle l\'exposition et la couleur au RCP.', 'Exact : deux métiers, deux postes, une image.'],
      ],
      ok: 2,
    },
  ],
  see: ['iris', 'noir', 'balance', 'gain', 'nd', 'menu', 'lineup', 'ccu'],
  ref: 'Mode d\'emploi Sony RCP-1500/1501/1530 : PANEL ACTIVE, CAM PW, BARS, CALL, AUTO IRIS, MASTER GAIN, fenêtres ND et CC, WHITE (balance des blancs automatique), boutons WHITE R, G, B et BLACK/FLARE R, G, B, bloc iris et master black à manche ; mode d\'emploi HXCU-FB80 : RCP par câble ou par le réseau (PoE)',
  competences: ['2.9', '2.2', '1.4'],
};
