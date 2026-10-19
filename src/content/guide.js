// @ts-check
// Contenus pédagogiques : chapitres du guide « Comprendre » (HTML statique, sans données dynamiques).

export const GUIDE = [
  {
    id: 'stade', title: 'Le stade (inspiré de Bollaert-Delelis)', html: `
<p>Le stade du simulateur s'inspire du <b>stade Bollaert-Delelis</b> de Lens, rénové pour l'Euro 2016 (≈ 38 000 places, pelouse 105 × 68 m). C'est une reconstitution simplifiée pour la formation, <b>non officielle et sans lien avec le club</b> : proportions, matériaux et emplacements techniques sont approchés.</p>
<ul>
<li><b>Quatre tribunes séparées, angles ouverts.</b> Lepagnot (tribune principale, côté caméras), Marek-Xercès en face, Trannin et Delacourt derrière les buts. Dans chaque angle, un pylône en treillis d'environ 72 m porte l'anneau de poutres auquel sont suspendus les toits : aucun poteau ne gêne la vue.</li>
<li><b>Lepagnot</b> : vestiaires, tunnel des joueurs, loges, tribune de presse et positions commentateurs. La <b>passerelle caméras</b> est posée sur le toit des loges, sous le front de la tribune haute, dans l'axe de la ligne médiane : c'est là que vont la caméra principale et les caméras « 16 m ».</li>
<li><b>Marek-Xercès</b> : le <b>kop</b> debout est en bas (Marek), la tribune Xercès au-dessus. Le kop est face aux caméras principales : c'est l'image du public que l'on voit le plus. Un couple d'ambiance devant le kop donne l'essentiel du son des tribunes.</li>
<li><b>Trannin</b> : longée par la voie ferrée (un TER passe de temps en temps), elle accueille le parcage des visiteurs dans un coin.</li>
<li><b>Écrans d'angle</b> : deux écrans de taille modeste dans les angles opposés (Marek-Delacourt, et sans doute Trannin-Lepagnot), pas visibles de toutes les places. Ils reçoivent la sortie « écran géant » de la grille.</li>
<li><b>Ambiance visuelle</b> : sièges noirs, gris et blancs ; structure blanche avec des touches sang et or, escaliers aux nez de marche jaunes ; banderoles et drapeaux dans le Marek ; grappes de haut-parleurs suspendues sous les toits.</li>
<li><b>Toits et HF</b> : les toits en polycarbonate translucide s'arrêtent avant les premiers rangs (qui sont mouillés par vent). Les antennes de réception HF sont posées à leur rive ; toits et charpente atténuent les liaisons qui les traversent.</li>
<li><b>Autour</b> : les cités minières, la gare au sud-est, et à l'horizon, à l'ouest-nord-ouest, les terrils jumeaux de Loos-en-Gohelle et les chevalements de la fosse 11/19.</li>
</ul>
<p class="note">Le compound TV est placé derrière la tribune Lepagnot (côté presse et vestiaires), position la plus courte vers la passerelle et le local technique. À vérifier avec votre propre plan d'installation à Bollaert.</p>`},
  {
    id: 'deroule', title: 'Déroulé d\'une production', html: `
<p>Une captation de match se prépare plusieurs jours à l'avance et s'installe en général la veille (J-1) ou le matin même.</p>
<ol class="steps">
<li><b>Repérage et plan de caméras.</b> Le réalisateur, le chef de car et la production définissent les positions caméras, les liaisons, l'emplacement du compound, l'énergie et les besoins en fréquences HF.</li>
<li><b>Arrivée et calage du car.</b> Mise à niveau, déploiement des extensions, raccordement de la terre puis de l'énergie (réseau du stade ou groupe), climatisation.</li>
<li><b>Câblage.</b> Tirage des câbles caméras (SMPTE, fibres), utilisation du pré-câblage du stade, câbles audio, intercom, transmission. Chaque câble est repéré et raccordé au pied de car.</li>
<li><b>Montage.</b> Caméras et objectifs sur leurs supports, micros (canons, ambiances, commentateurs), antennes HF.</li>
<li><b>Configuration.</b> Affectation des CCU, de la grille, du multiview (noms et tally), de l'intercom, des entrées EVS, des sorties.</li>
<li><b>Line-up.</b> Mires caméras, balance des noirs et des blancs, matching par la vision, test de chaque micro, test de chaque position intercom.</li>
<li><b>Tests transmission.</b> Envoi de la mire + 1 kHz à la chaîne, identification, vérification du retour antenne, test du chemin de secours.</li>
<li><b>Répétition et briefing.</b> Le réalisateur briefe les cadreurs et les EVS, l'habillage valide ses modèles.</li>
<li><b>Prise d'antenne et direct.</b> Le scripte compte à rebours, le réalisateur réalise, le chef de car surveille.</li>
<li><b>Fin d'antenne et démontage.</b> Dérushage éventuel, démontage, rapport technique.</li>
</ol>`},
  {
    id: 'chaine', title: 'La chaîne du signal', html: `
<p>Suivez le chemin d'une image, de l'objectif jusqu'au téléspectateur :</p>
<ol class="steps">
<li><b>Objectif → capteurs.</b> La lumière traverse le zoom (focale, iris, filtres ND) et un prisme qui la sépare sur 3 capteurs (rouge, vert, bleu).</li>
<li><b>Caméra → CCU.</b> Par la fibre SMPTE (ou triax, fibre, HF), la caméra envoie l'image à sa CCU dans le car et reçoit en retour l'alimentation, l'intercom, le retour programme, le tally et la référence.</li>
<li><b>RCP.</b> L'ingénieur vision règle l'image depuis son RCP : la CCU relaie les réglages vers la tête de caméra, où se fait l'essentiel du traitement (gain, noir, couleurs, iris, filtres) ; la CCU assure surtout les conversions de sortie (UHD/HD, HDR/SDR).</li>
<li><b>CCU → grille.</b> La sortie SDI (ou IP) de la CCU entre dans la grille.</li>
<li><b>Grille → mélangeur, EVS, multiview.</b> La grille distribue chaque caméra au mélangeur, aux entrées d'enregistrement des EVS et aux tuiles du multiview.</li>
<li><b>Mélangeur → PGM.</b> Le truquiste construit le programme : commutations, ralentis, habillage (DSK).</li>
<li><b>Son.</b> L'audio du programme est mixé en régie son puis embeddé dans le SDI du PGM.</li>
<li><b>Transmission.</b> Le PGM (et souvent le clean feed) part vers la chaîne par fibre, IP ou satellite, sur deux chemins.</li>
<li><b>Diffusion.</b> La chaîne ajoute sa propre couche (logo, pubs) et diffuse. Le car contrôle le retour antenne.</li>
</ol>`},
  {
    id: 'formats', title: 'Formats et interfaces', html: `
<table class="tbl"><thead><tr><th>Format</th><th>Interface</th><th>Débit</th><th>Portée coax typique</th></tr></thead><tbody>
<tr><td>1080i50 (HD entrelacé)</td><td>HD-SDI (ST 292)</td><td>1,485 Gb/s</td><td>≈ 120 à 150 m</td></tr>
<tr><td>1080p50 (HD progressif)</td><td>3G-SDI (ST 424)</td><td>2,97 Gb/s</td><td>≈ 100 à 120 m</td></tr>
<tr><td>2160p50 (UHD)</td><td>12G-SDI (ST 2082) ou 4 x 3G (quad-link)</td><td>11,88 Gb/s</td><td>≈ 70 m</td></tr>
<tr><td>Toutes</td><td>IP ST 2110 sur fibre 25/100 GbE</td><td>≈ 2,2 Gb/s (1080p50) à 8,6 Gb/s (UHD p50) par flux</td><td>fibre : plusieurs km</td></tr>
</tbody></table>
<p>En Europe, tout est à 50 Hz : 50 images par seconde (25 en entrelacé, 2 trames par image). Le timecode compte 25 images par seconde.</p>
<p><b>HDR.</b> Les productions UHD sont souvent en HDR HLG (BT.2100, couleurs BT.2020), avec une version SDR (BT.709) dérivée en parallèle. Les caméras sont réglées en HDR et contrôlées aussi en SDR.</p>`},
  {
    id: 'sync', title: 'Synchronisation', html: `
<p>Un mélangeur ne peut couper proprement entre deux caméras que si leurs images commencent exactement au même instant. Toutes les caméras, le mélangeur, les EVS et la grille sont donc verrouillés (genlock) sur la référence du <b>générateur de synchro</b> (SPG), lui-même calé sur le GPS.</p>
<ul><li><b>SDI :</b> référence black burst (analogique) ou tri-level (HD) distribuée en coaxial.</li>
<li><b>IP ST 2110 :</b> référence PTP envoyée sur le réseau par un grand maître.</li>
<li><b>Sources externes</b> (duplex, satellite, HF) : elles passent par un <b>synchroniseur d'images</b> qui les remet en phase.</li></ul>
<p>Le SPG fournit aussi le <b>timecode</b> : toutes les machines sont à la même heure, ce qui permet de retrouver une action sur toutes les caméras du serveur ralenti.</p>`},
  {
    id: 'liaisons', title: 'Liaisons caméras', html: `
<table class="tbl"><thead><tr><th>Liaison</th><th>Portée indicative</th><th>Alimente la caméra</th><th>Usage</th></tr></thead><tbody>
<tr><td>Fibre hybride SMPTE</td><td>≈ 2 km</td><td>Oui</td><td>Standard des caméras de stade</td></tr>
<tr><td>Triax</td><td>≈ 1,2 km en HD, moins en UHD</td><td>Oui</td><td>Ancien standard, robuste</td></tr>
<tr><td>Fibre monomode + convertisseurs</td><td>&gt; 10 km</td><td>Non (alim locale)</td><td>Longues distances, pré-câblage, mini-caméras</td></tr>
<tr><td>Coaxial SDI</td><td>70 m (12G) à 120 m (3G)</td><td>Non</td><td>Sources proches du car</td></tr>
<tr><td>IP ST 2110</td><td>Plusieurs km (fibre)</td><td>Non</td><td>Installations IP</td></tr>
<tr><td>HF COFDM</td><td>Couverture des antennes</td><td>Batterie</td><td>Steadicam, caméras mobiles, drone</td></tr>
</tbody></table>
<p>La fibre SMPTE porte tout : vidéo vers le car, retour programme vers le viseur, intercom, tally, télécommandes du RCP et alimentation. Les mini-caméras et les convertisseurs fibre demandent une alimentation locale.</p>`},
  {
    id: 'optique', title: 'Optique et exposition', html: `
<p><b>Focale et angle.</b> Sur un capteur 2/3" (9,59 mm de large), l'angle horizontal vaut 2 × arctan(9,59 / 2f) : 58° à 8,6 mm, 13,7° à 40 mm, 1,4° à 400 mm, 0,55° à 1000 mm. À 80 m, un champ de 7 m de large demande une focale d'environ 110 mm.</p>
<p><b>Iris.</b> La suite f/1.4 – 2 – 2.8 – 4 – 5.6 – 8 – 11 – 16 : chaque valeur divise la lumière par 2. Le zoom perd de la luminosité en longue focale (ramping) et le doubleur coûte 2 diaphragmes.</p>
<p><b>Repères d'exposition</b> (en plein jour, 0 dB, 50 i/s) : environ f/8 avec un ND 1/4. De nuit sous l'éclairage du stade (environ 2000 lux) : environ f/2.8 sans filtre. Ce sont les repères du simulateur : une caméra réelle de type HDC-5500 (sensibilité F11 sous 2000 lx pour un blanc à 89,9 %) est plus sensible de 2 à 3 diaphragmes, d'où plutôt un ND 1/16 ou 1/64 en plein soleil et un iris vers f/4 à f/8 de nuit selon l'objectif. Une caméra super ralenti 3x reçoit 3 fois moins de lumière par image (un diaphragme et demi).</p>
<p><b>Lire le waveform.</b> 0 % = noir, 100 % = blanc nominal (700 mV). Pelouse ensoleillée vers 40-55 %, peaux vers 50-70 %, maillot blanc juste sous 100 %. Au-dessus du knee point (95 % par défaut), les hautes lumières sont compressées, puis l'écrêteur (white clip) les limite : 103 % ici, une limite qu'exigent encore beaucoup de diffuseurs (c'était la tolérance en luminance de l'EBU R103-2000 ; depuis 2016, R103 admet une plage préférée jusqu'à 105 %, code 984 en 10 bits). Le signal SDI peut techniquement monter jusqu'à 109 %.</p>`},
  {
    id: 'objectifs', title: 'Caméras Sony HDC et objectifs Fujinon', html: `
<p>Sur un match, les caméras principales sont des <b>caméras système</b> (type Sony HDC-5500 : trois capteurs CMOS 2/3" 4K, liaison fibre SMPTE vers leur CCU) équipées d'<b>objectifs « box »</b> : de gros zooms à servo, dans un boîtier rectangulaire. La caméra se loge par l'arrière dans un <b>adaptateur grand objectif</b> (série Sony HDLA) qui porte l'objectif à l'avant et le grand viseur (7 pouces) à l'arrière, sans démonter l'objectif. Le cadreur pilote le zoom à la poignée droite (bascule au pouce) et le point à la roue de gauche : ce sont les <b>demandes</b>, reliées au servo de l'objectif.</p>
<h3>Objectifs box Fujinon 4K (chiffres constructeur)</h3>
<table class="tbl"><thead><tr><th>Modèle</th><th>Focales</th><th>Ouverture</th><th>Distance mini</th><th>Masse</th></tr></thead><tbody>
<tr><td>UA125x8BESM</td><td>8–1000 mm (16–2000 avec ×2)</td><td>f/1,7 jusqu'à 340 mm, f/5,0 à 1000 mm</td><td>3,0 m</td><td>26,6 kg</td></tr>
<tr><td>UA107x8.4BESM</td><td>8,4–900 mm</td><td>f/1,7 jusqu'à 340 mm, f/4,5 à 900 mm</td><td>3,05 m</td><td>≈ 24 kg</td></tr>
<tr><td>UA80x9BESM</td><td>9–720 mm (doubleurs ×1,2 et ×2)</td><td>f/1,7 jusqu'à 350 mm, f/3,5 à 720 mm</td><td>3,7 m</td><td>23,5 kg</td></tr>
<tr><td>UA70x8.7BESM</td><td>8,7–610 mm</td><td>f/1,7 jusqu'à 340 mm, f/3,05 à 610 mm</td><td>3,05 m</td><td>≈ 24 kg</td></tr>
<tr><td>UA27x6.5BESM</td><td>6,5–180 mm</td><td>f/1,5 jusqu'à 123 mm, f/2,2 à 180 mm</td><td>0,6 m</td><td>22,8 kg</td></tr>
</tbody></table>
<p>Leur boîtier mesure environ 258 × 264 mm pour 610 à 635 mm de long.</p>
<h3>Objectifs portables (épaule, Steadicam, grue)</h3>
<ul><li><b>UA24x7.8BERD</b> : 7,8–187 mm, f/1,8 jusqu'à 118 mm puis f/2,85 ; 1,98 kg. Le polyvalent de l'épaule et de la Steadicam.</li>
<li><b>UA46x13.5BERD</b> : 13,5–621 mm, f/2,8 jusqu'à 316 mm puis f/5,5 ; 5,8 kg. Long foyer derrière les buts.</li>
<li><b>UA13x4.5BERD</b> : 4,5–59 mm, f/1,8 jusqu'à 41 mm puis f/2,6 ; mise au point à 30 cm. Vestiaires, tunnel, grue.</li></ul>
<h3>Ce qu'il faut retenir</h3>
<ul>
<li><b>Rampe d'ouverture (ramping)</b> : au-delà d'une certaine focale, l'objectif perd de la lumière (f/1,7 → f/4,5 sur un 107x). Le soir, un serré à 900 mm demande donc environ 2,8 diaphragmes de plus qu'à 340 mm (2 × log2(4,5 / 1,7)) : l'ingénieur vision le compense au RCP.</li>
<li><b>Doubleur (extender ×2)</b> : focale doublée, mais 2 diaphragmes perdus (4 fois moins de lumière). Le simulateur l'applique avec la touche X au poste cadreur.</li>
<li><b>Distance minimale de mise au point (MOD)</b> : 3 m environ pour les grands box, d'où leur place en tribune ; un portable courant fait le point beaucoup plus près (0,3 à 0,8 m), sauf les longs portables (2,8 m pour l'UA46).</li>
<li><b>Masse</b> : 24 à 27 kg d'objectif + adaptateur + caméra : trépied ou pied lourd et tête fluide de grande capacité (type Vinten Vector), contrepoids réglé.</li>
</ul>
<p class="note">Les modèles cités sont des exemples de matériel courant en production sportive ; vérifiez les fiches constructeur pour un projet réel.</p>`},
  {
    id: 'hfguide', title: 'Liaisons HF', html: `
<p>Une liaison HF caméra se dimensionne par un <b>bilan de liaison</b> :</p>
<p class="formula">Niveau reçu = Puissance émise + Gains d'antennes − Pertes en espace libre − Obstacles − Évanouissements</p>
<p>Perte en espace libre à 2,3 GHz : environ 80 dB à 100 m, 86 dB à 200 m. Un mur de béton ou une tribune ajoute 20 à 30 dB. Le récepteur compare ce niveau au bruit pour obtenir le <b>C/N</b>. La liaison fonctionne tant que le C/N dépasse le seuil de la modulation choisie (par exemple 18 dB en 64-QAM 3/4, 6 dB en QPSK 3/4) : la différence est la <b>marge</b>.</p>
<p>En COFDM, la qualité ne se dégrade pas progressivement : au-dessus du seuil l'image est parfaite, au voisinage du seuil apparaissent des blocs, en dessous l'image se fige puis disparaît (« effet falaise »).</p>
<p>Pour fiabiliser : plusieurs antennes en diversité, une modulation plus robuste, plus de puissance, des fréquences propres coordonnées.</p>`},
  {
    id: 'songuide', title: 'Le son d\'un match', html: `
<ul><li><b>Ambiance :</b> couples de micros en tribune et au-dessus du public.</li>
<li><b>Effets :</b> micros canons bord terrain qui suivent le ballon (frappes, contacts), parfois micros paraboliques.</li>
<li><b>Commentaires :</b> unité de commentaire en cabine, avec retour N-1.</li>
<li><b>Son international :</b> ambiance + effets sans commentaire, livré à tous les diffuseurs.</li></ul>
<p>Formats : stéréo et 5.1 (parfois immersif), 16 canaux embeddés en HD-SDI, jusqu'à 32 en 3G/12G-SDI (SMPTE ST 299-2). Loudness EBU R128 : -23 LUFS intégré, true peak ≤ -1 dBTP. Line-up : 1 kHz à -18 dBFS.</p>`},
  {
    id: 'vista', title: 'La console son : inspiration Studer Vista 1', html: `
<p>La console du car s'inspire de la <b>Studer Vista 1</b>, la plus compacte des consoles Vista : une version 22 faders d'environ un mètre de large (idéale dans une cabine de car) et une version 32 faders. Son moteur de traitement (DSP) intégré est annoncé à 96 canaux (mono, stéréo ou 5.1). <i>Simulation pédagogique non officielle : interface et chiffres simplifiés.</i></p>
<h3>Ce que l'on voit sur la surface</h3>
<ul>
<li><b>Écrans Vistonics.</b> Les molettes et les touches sont posées <i>sur</i> l'écran tactile, au-dessus de chaque tranche : la valeur réglée s'affiche juste sous le doigt, sans menu. Un écran porte 10 tranches. Code couleur : <b style="color:#ef4444">rouge = égaliseur</b>, <b style="color:#22c55e">vert = dynamique</b>, <b style="color:#facc15">jaune = panoramique</b>.</li>
<li><b>FaderGlow.</b> Une bande lumineuse le long de chaque fader, de la couleur de la tranche : on repère d'un coup d'œil les ambiances, les canons, les commentaires. Dans le simulateur, elle s'allume quand la tranche est ouverte à l'antenne.</li>
<li><b>Couches (layers).</b> Les mêmes faders affichent tour à tour les sources (couche A) puis les masters et les VCA (couche B). Les faders motorisés se replacent.</li>
<li><b>Control Bay.</b> À droite. Sur la vraie Vista 1, elle porte 12 faders (10 tranches et 2 « grand masters ») avec son propre écran Vistonics, plus les écoutes et le talkback : la version 22 faders n'a donc qu'une baie de faders (10 tranches) à gauche. Dans le simulateur : vumètres, écoutes, talkback, et l'écran de la tranche sélectionnée (touche SEL) avec toutes ses commandes.</li>
</ul>
<h3>Le trajet du son dans une tranche</h3>
<p class="formula">Entrée (patch) → gain + 48 V → polarité Ø → passe-haut → égaliseur 4 bandes → gate / expandeur → compresseur → retard → panoramique → fader (+ VCA) → bus PGM, INTL, N-1</p>
<p class="note">Ordre retenu par le simulateur. Sur la vraie Vista, l'ordre des blocs de traitement (égaliseur, dynamique, insert, retard…) se règle tranche par tranche, dans la page Channel Patch.</p>
<ol>
<li><b>Gain d'entrée</b> : on vise des crêtes entre −18 et −10 dBFS sur le vumètre d'entrée. L'OVL rouge signifie que le préampli sature : il faut baisser le GAIN, pas le fader.</li>
<li><b>48 V</b> : les micros statiques (couples d'ambiance, canons) en ont besoin. Sans 48 V, ils ne délivrent rien.</li>
<li><b>Polarité (Ø)</b> : un côté d'un couple inversé rend le corrélateur négatif ; en mono, la partie commune aux deux micros s'annule : l'ambiance devient creuse et perd ses graves (annulation presque totale avec un couple XY).</li>
<li><b>Passe-haut</b> : coupe le grondement inutile (canons 100-150 Hz, voix 80-120 Hz).</li>
<li><b>Égaliseur</b> : on creuse plutôt qu'on n'ajoute. Bas-médium (250-500 Hz) pour éclaircir, haut-médium (2-4 kHz) pour la présence et l'impact du ballon.</li>
<li><b>Dynamique</b> : le compresseur resserre la voix d'un commentateur ; le gate ou l'expandeur coupe la foule qui « repisse » dans son micro quand il se tait.</li>
</ol>
<h3>Bus, N-1 et départs</h3>
<ul>
<li><b>PGM</b> : le mix complet, embeddé sur la paire 1-2 du départ, mesuré en loudness.</li>
<li><b>International</b> : ambiance et effets, <b>aucune voix</b>. Les diffuseurs étrangers y ajoutent leurs commentaires.</li>
<li><b>N-x (mix-minus)</b> : « tout sauf moi ». Le commentateur reçoit le N-1 COMMENTAIRE (sans sa voix), le présentateur studio le N-1 STUDIO (sans lui), la journaliste bord terrain le N-1 BT. Une voix dans son propre retour = écho, voire larsen.</li>
<li><b>VCA</b> : un fader de commande pour un groupe de tranches (ambiances, canons, commentaires…) ; il agit sur leurs gains sans créer de bus.</li>
<li><b>PFL</b> : écouter une tranche seule, avant fader, sans toucher à l'antenne. <b>AFV</b> : la tranche s'ouvre quand son image passe (micro de la caméra HF, son des ralentis). <b>Talkback</b> : le micro d'ordres part dans les N-1, jamais à l'antenne.</li>
<li><b>Snapshots</b> : des états complets de la console rappelés d'une touche (avant-match, match, mi-temps avec duplex, test de ligne).</li>
</ul>
<h3>E/S et patch</h3>
<p>La console reçoit des entrées micro/ligne analogiques, de l'AES, et, par ses cartes d'extension D21m, du MADI (stagebox, unité de commentaire), du SDI désembeddé (micro de la caméra HF, EVS) ou de l'audio sur IP (ST 2110-30 / AES67 dans le car IP). Le <b>patch</b> relie chaque connecteur à une tranche : il se fait à l'écran, donc on peut se tromper d'entrée sans toucher un câble. On travaille avec une <b>feuille de patch</b> et on vérifie chaque source en PFL.</p>
<h3>Mixer un match</h3>
<ol>
<li>Ambiances (couples ORTF en tribune principale, XY dans le kop) toujours ouvertes : elles portent l'émotion.</li>
<li>Canons : on ouvre celui qui est près du ballon. Le simulateur propose un assistant « suivi du jeu » qui pilote les faders motorisés ; coupez-le pour mixer à la main.</li>
<li>Commentaires au-dessus de l'ambiance, jamais dans l'international ; quand le commentateur « lance » le bord terrain, ouvrez sa tranche.</li>
<li>Contrôles : loudness intégrée −23 LUFS, corrélateur positif, plan de son conforme, synchro labiale.</li>
</ol>
<p class="note">Limite du simulateur : les voix sont dites par la synthèse vocale du navigateur, qui ne passe pas par le moteur audio. Leur volume suit fidèlement la console (patch, gain, fader, VCA, mute, bus écouté, master, DIM, retard de ligne), mais l'égaliseur et la dynamique n'en changent pas le timbre.</p>`},
  {
    id: 'car', title: 'Le car régie', html: `
<p>Un car régie est en général un semi-remorque d'environ 13,5 à 14,5 m (16,50 m au maximum avec le tracteur en Europe pour un ensemble articulé), souvent avec une ou deux extensions latérales qui doublent la largeur une fois déployées. Il est climatisé, isolé, et contient :</p>
<ul><li><b>Régie production :</b> mur d'écrans (multiview), réalisateur, scripte, truquiste au mélangeur, habillage, production.</li>
<li><b>Régie vision :</b> ingénieurs vision avec RCP, oscilloscopes et moniteur de référence, dans une lumière contrôlée.</li>
<li><b>Régie ralentis :</b> opérateurs EVS/LSM.</li>
<li><b>Régie son :</b> cabine isolée phoniquement avec la console.</li>
<li><b>Zone technique :</b> baies CCU, grille, châssis du mélangeur, processeurs multiview, serveurs, synchro, intercom, transmission, énergie.</li></ul>
<p>Autour du car, le <b>compound</b> accueille le groupe électrogène, le camion satellite (DSNG), parfois un car de complément (EVS, HF, unités de commentaires).</p>`},
  {
    id: 'camsys', title: 'La chaîne caméra en détail', html: `
<p>Une caméra « système » (type Sony HDC-5500) n'est que la moitié d'un ensemble : <b>tête de caméra</b> sur le terrain, <b>CCU</b> dans le car, <b>RCP</b> sur le pupitre de l'ingénieur vision. Les trois sont reliés en réseau.</p>
<h3>1. La tête de caméra</h3>
<ul>
<li><b>Bloc optique :</b> un prisme sépare la lumière en rouge, vert et bleu vers trois capteurs CMOS 2/3" (4K natif, obturation globale sur la HDC-5500). Monture <b>B4</b> : on y monte les zooms broadcast (portables d'environ 13x à 46x, ou « box » de 27x à 125x sur pied).</li>
<li><b>Viseur</b> (connecteur VF) : le cadreur y voit son image, le retour programme (RET), le tally et les marques de cadrage.</li>
<li><b>Connecteurs arrière :</b> fibre CCU (LEMO 3K.93C), SDI 1/2/3 et SDI MONI pour un usage local, TEST OUT, PROMPTER/GENLOCK, INTERCOM 1 et 2 (XLR 5 broches), AUDIO CH1/CH2 (XLR 3), EARPHONE, DC IN (XLR 4, 10,5 à 17 V), DC OUT, REMOTE, RET CTRL, TRACKER et CRANE (données de position pour la réalité augmentée et les grues). Ouvrez la tête dans la visionneuse (touche K) pour voir chaque connecteur.</li>
</ul>
<h3>2. La liaison : un seul câble pour tout</h3>
<p>Le câble hybride SMPTE (ST 311, connecteur ST 304 type LEMO 3K.93C) contient <b>deux fibres monomodes</b> (une par sens) et des <b>conducteurs de cuivre</b> pour l'alimentation de la tête. Dans un sens : l'image de la caméra et le son des micros. Dans l'autre : le retour programme, le prompteur, les ordres (intercom PROD et ENG), le tally, la référence et toutes les commandes du RCP.</p>
<p>La CCU télé-alimente la tête : la distance est donc limitée par la chute de tension dans le cuivre (environ 2 km avec une HDCU-5500 en câble hybride). Au-delà, on passe en <b>fibre monomode seule</b> avec une alimentation locale de la caméra (jusqu'à environ 10 km avec le kit adapté).</p>
<h3>3. La CCU</h3>
<ul>
<li>Format demi-largeur 3U. Face arrière : CAMERA (fibre), SDI de sortie (12G en standard), REFERENCE IN/OUT en boucle, PROMPTER, CHARACTER (sortie avec menus et indications pour le moniteur), INTERCOM/TALLY/IO (D-sub 50), RCP/CNU (8 broches), LAN, TRUNK, alimentation.</li>
<li>Face avant : voyants REF IN, UNLOCK, RCP/MSU, état d'alimentation, et la mesure du <b>niveau optique</b> reçu.</li>
<li>Elle verrouille la caméra sur la référence du car (genlock) : toutes les caméras sortent en phase.</li>
<li>Elle fournit les sorties dans les formats demandés (UHD, HD, HDR, SDR) ; le traitement de l'image proprement dit (« paint ») est en grande partie fait dans la tête.</li>
</ul>
<h3>4. Le RCP et le réseau caméras</h3>
<p>Le RCP (type RCP-3500) se branche sur la CCU (câble 8 broches) ou sur le <b>réseau caméras</b> en Ethernet (LAN, alimenté en PoE). Un <b>CNS</b> (camera network system) gère qui commande quoi : un RCP par caméra, plus un pupitre maître (MSU / MCP) pour le chef vision qui peut prendre la main sur toutes les caméras et copier des réglages.</p>
<p>Sur le RCP : joystick (iris en le poussant, master black en tournant la bague), molettes WHITE et BLACK/FLARE R/G/B, AWB et ABB, écran tactile pour le gamma, le knee, le détail, la matrice, les fichiers de scène, et les touches CALL, BARS, CAM PW, PANEL ACTIVE, PREVIEW.</p>
<h3>5. Le line-up d'une caméra, dans l'ordre</h3>
<ol>
<li><b>CAM PW</b> : la CCU alimente la tête. Vérifier le niveau optique sur la CCU et le voyant REF (pas d'UNLOCK).</li>
<li><b>BARS</b> : les barres apparaissent sur la bonne tuile du multiview, avec le bon nom (UMD) et le tally qui suit le mélangeur.</li>
<li><b>ABB</b> (balance des noirs, iris fermé) puis <b>AWB</b> sur une charte blanche ou une surface neutre dans la lumière du terrain.</li>
<li>Régler le <b>master black</b>, le <b>gamma</b>, le <b>knee</b> et le <b>détail</b> comme la caméra de référence (souvent la caméra 1).</li>
<li><b>Matching</b> : toutes les caméras sur le même sujet, comparaison au moniteur Grade 1 et à l'oscilloscope, correction des gains R/B.</li>
<li>Mémoriser un <b>fichier de scène</b> (soleil, ombre, nuit) pour pouvoir y revenir.</li>
<li>Test intercom avec le cadreur (PROD et ENG) et vérification du retour programme dans son viseur.</li>
</ol>`},
  {
    id: 'montage', title: 'Monter une caméra de stade', html: `
<p>Le jour du match, l'équipe caméra monte chaque position avant le line-up. Une caméra principale de passerelle pèse plus de 80 kg une fois complète : l'ordre de montage n'est pas une formalité, il évite la bascule, les chutes de matériel et les liaisons qui décrochent à l'antenne. L'<b>atelier de montage</b> (feuille de service, 09:30) fait refaire ces gestes sur la CAM 1.</p>
<h3>1. Le support</h3>
<ul>
<li><b>Pied lourd</b> (type Vinten HDT-2, ≈ 15 kg) posé sur le repère de la position, jambes sorties à la bonne hauteur d'optique et serrées, <b>araignée verrouillée</b>.</li>
<li><b>Tête lourde</b> (type Vinten Vector 750i, ≈ 18 kg, embase plate 4 vis ; un adaptateur Mitchell vers 4 vis si le support n'a qu'une embase Mitchell). On la <b>met à niveau</b> à la bulle avant de la charger, puis on <b>verrouille</b> panoramique et inclinaison.</li>
<li>Les <b>manches</b> se montent sur les rosaces, dentures bien emboîtées.</li>
</ul>
<h3>2. La caméra</h3>
<ul>
<li><b>Adaptateur grand objectif</b> (type Sony HDLA-3505, 15,5 kg) sur la plaque de la tête, levier fermé, test de traction.</li>
<li><b>Tête de caméra</b> (type HDC-5500) glissée par l'arrière et verrouillée : alimentation, vidéo et commandes passent par l'accouplement, sans câble.</li>
<li><b>Objectif box</b> (≈ 24 kg) : <b>à deux</b>, tête verrouillée, présenté sur la monture de l'adaptateur puis bloqué ; <b>câble d'objectif</b> sur le connecteur 36 broches.</li>
<li><b>Viseur 7"</b> sur le dessus de l'adaptateur (image, retour, tally).</li>
</ul>
<h3>3. Les commandes et l'équilibrage</h3>
<ul>
<li><b>Commande de zoom</b> (bascule au pouce, type Fujinon ERD-50A) et <b>commande de point</b> (molette, type EPD-51A) sur les manches, branchées au module servo. En Europe, le zoom est souvent à gauche, mais c'est une préférence d'opérateur.</li>
<li><b>Équilibrage</b> une fois tout monté : contrepoids réglé pour la charge avant de libérer le verrou, plaque avant / arrière jusqu'à ce que la caméra tienne seule ; les frictions se règlent ensuite, au goût du cadreur. On rééquilibre à chaque ajout (pare-soleil, housse de pluie).</li>
</ul>
<h3>4. La liaison et la mise en service</h3>
<ul>
<li><b>Fibre hybride SMPTE</b> : chaque extrémité (caméra, câble, prise murale) s'<b>inspecte et se nettoie</b> avant chaque branchement. Une poussière suffit à faire chuter le niveau optique à la CCU.</li>
<li>Le câble est <b>attaché au pied</b> : un câble accroché ne doit ni tirer sur le connecteur ni renverser la caméra.</li>
<li><b>Casque d'ordres</b> sur la prise INTERCOM de la caméra, puis appel à la vision : « CAM 1 câblée ». La CCU alimente la tête par la fibre, la vision vérifie l'image, on teste le <b>CALL</b> (la lampe d'appel s'allume au RCP) et le <b>tally</b> du viseur. Bouchon d'objectif retiré, la caméra passe au line-up.</li>
</ul>
<p class="note">Les modèles cités sont des exemples de matériel courant ; masses et connecteurs d'après les fiches constructeurs. Travail sur passerelle : voir le chapitre Sécurité (protection collective d'abord).</p>`},
  {
    id: 'evsarch', title: 'Le serveur ralenti en détail', html: `
<p>Un serveur de production live (dans votre car : <b>EVS XT4K</b>) enregistre en permanence plusieurs flux et, en même temps, relit n'importe quel instant de ces enregistrements, à n'importe quelle vitesse. Il est piloté par la <b>télécommande LSM</b> (logiciel Multicam) et, pour la gestion des clips, par <b>IPDirector</b>.</p>
<h3>Les canaux : enregistrement et lecture</h3>
<p>Le serveur dispose d'un nombre fixe de canaux : sur un XT4K, <b>4 canaux en UHD-4K</b> ou <b>8 canaux en HD</b> (12 et plus avec la configuration ChannelMAX). On les répartit selon la production. Avec un seul XT4K :</p>
<table><tr><th>Format</th><th>Répartition typique</th><th>Conséquence</th></tr>
<tr><td>HD (1080p / 1080i)</td><td>8 REC + 2 PLAY (ChannelMAX 12 canaux) ou 6 REC + 2 PLAY (8 canaux)</td><td>Deux sorties de lecture (PGM1, PGM2) ; une caméra 3x prend 3 entrées</td></tr>
<tr><td>UHD-4K</td><td>3 REC + 1 PLAY</td><td>Une seule sortie de lecture ; une caméra 3x occupe tout l'enregistrement</td></tr></table>
<p>C'est pourquoi le format de production se décide avec le parc EVS : en UHD, on ajoute des serveurs ou on enregistre moins d'angles. Les entrées sont alimentées par la grille, les sorties retournent à la grille puis au mélangeur. Dans ce simulateur, le format se choisit sur l'écran d'accueil et la répartition suit automatiquement.</p>
<h3>Les trains d'enregistrement</h3>
<p>L'enregistrement est une boucle (des heures de capacité) : on parle de « trains ». Tant que l'enregistrement tourne, chaque image de chaque entrée est disponible. Tous les trains partagent le même <b>timecode</b> (LTC du car) : c'est ce qui permet de passer d'un angle à l'autre sur la même action (<b>multicam</b>). Si on arrête l'enregistrement, plus rien n'est disponible après l'arrêt : c'est la pire erreur au poste ralentis. Quand la boucle est pleine, les images les plus anciennes sont écrasées : tout ce qu'on veut garder doit être sauvegardé en clip.</p>
<h3>Les clips</h3>
<p>Un clip est un point IN et un point OUT sur les trains, <b>avec tous les angles enregistrés</b>. Sur un LSM, il est rangé sur une touche F d'une banque et d'une page : le clip « 111A » est la page 1, banque 1, touche F1, angle A. Les clips sont protégés de l'écrasement et partagés avec les autres serveurs par le réseau XNet.</p>
<h3>La lecture</h3>
<ul>
<li><b>LIVE / E/E :</b> la sortie montre le direct. C'est l'état d'attente.</li>
<li><b>Recherche :</b> molette jog (image par image, ou FAST JOG pour aller vite), ou rappel d'un clip.</li>
<li><b>Lecture :</b> le levier règle la vitesse de 0 à 100 % (au-delà avec Var Max). Sur LSM, pousser le levier lance la lecture.</li>
<li><b>Deux sorties</b> : l'opérateur prépare PGM2 pendant que PGM1 est à l'antenne, ou fait un « split » (deux angles synchronisés).</li>
<li><b>Playlist :</b> plusieurs clips enchaînés (cut, mix, volet) pour un résumé ou les meilleurs moments.</li>
</ul>
<h3>Super ralenti : les phases</h3>
<p>Une caméra « 3x » tourne à 150 images/s (en Europe). Elle sort ces images sur <b>trois liaisons</b> à 50 i/s, appelées phases A, B, C (la phase A contient les images 1, 4, 7…, la B les images 2, 5, 8…). Le serveur enregistre chaque phase sur une entrée et les recombine : lue à 33 %, l'action est parfaitement fluide (chaque image affichée est une image différente). Une caméra standard lue à 33 % répète chaque image trois fois : le mouvement saccade. Les phases d'une même caméra sont enregistrées sur le même serveur.</p>
<h3>La télécommande LSM (Multicam)</h3>
<ul>
<li><b>Touches à double fonction</b> : IN / GOTO IN, OUT / GOTO OUT, PLST / BROWSE… la fonction secondaire s'obtient avec SHIFT.</li>
<li><b>Clips</b> : IN et/ou OUT, puis une touche F libre crée le clip ; une touche F occupée le rappelle.</li>
<li><b>Pages</b> : SHIFT + PAGE puis une touche F choisit la page 1 à 10.</li>
<li><b>RETURN</b> : dans un clip trop court, on revient sur la même image dans le train pour récupérer ce qu'il y a avant ou après.</li>
<li><b>TAKE</b> : en mode PGM + PRV, échange PGM et PRV ; en mode 2 PGM, échange le contenu des deux sorties.</li>
<li><b>Levier</b> : 0 à 100 %, plage secondaire −100/+100 % ou −200/+200 % ; <b>jog</b> : environ 35 images par tour.</li>
</ul>
<h3>IPDirector</h3>
<p>Le poste IPDirector travaille sur les mêmes clips que la LSM : base de données (recherche par mots-clés, joueurs, notes), log des actions pendant le direct, montage de playlists, contrôle des canaux, transferts vers le montage. Dans le car, il occupe en général un second opérateur ralentis ou un logueur.</p>
<h3>Raccordements</h3>
<p>Entrées et sorties 12G-SDI (UHD sur un seul câble) ou 3G/HD-SDI, Quad 3G-SDI en option, IP intégrée ; référence et timecode ; réseau XNet pour partager les clips entre serveurs ; 2 × 10 GbE pour IPDirector et les transferts ; réseau de gestion redondant ; audio embeddé, AES, MADI, analogique ; liaison série RS-422 vers la télécommande LSM (d'après les manuels XT). Ouvrez « Serveur ralenti EVS XT4K » dans la visionneuse de matériel pour voir chaque port.</p>`},
  {
    id: 'ipguide', title: 'Production IP : ST 2110, PTP, NMOS', html: `
<p>Dans un car « IP », les signaux ne voyagent plus sur des câbles coaxiaux point à point mais sur un <b>réseau Ethernet</b> (commutateurs 25 / 100 GbE). La grille de commutation devient un réseau piloté par un contrôleur.</p>
<h3>Les normes SMPTE ST 2110</h3>
<ul>
<li><b>ST 2110-20</b> : la vidéo non compressée, seule (sans les suppressions). Un 1080p50 4:2:2 10 bits fait environ 2,1 Gb/s ; un UHD p50 environ 8,3 Gb/s.</li>
<li><b>ST 2110-30</b> : l'audio PCM (compatible AES67) ; <b>-40</b> : les données annexes (timecode, sous-titres) ; <b>-22</b> : la vidéo compressée (JPEG XS par exemple).</li>
<li>Chaque « essence » est un flux séparé : on peut router le son sans la vidéo. À l'inverse, <b>ST 2022-6</b> transporte un signal SDI complet dans des paquets IP.</li>
</ul>
<h3>La synchronisation : PTP</h3>
<p>Plus de black burst : toutes les machines se calent sur une horloge commune distribuée par le réseau, le <b>PTP</b> (IEEE 1588, profil SMPTE ST 2059-2). Un <b>grand maître</b> asservi au GPS fournit l'heure ; les commutateurs jouent le rôle d'horloges relais (boundary clocks). Chaque paquet porte un horodatage : le récepteur sait exactement à quelle image il appartient.</p>
<h3>Découverte et connexion : NMOS</h3>
<p><b>NMOS IS-04</b> : chaque appareil s'annonce sur le réseau (« je suis la caméra 3, j'émets ces flux »). <b>IS-05</b> : le contrôleur établit les connexions (« le mélangeur entrée 3 s'abonne à ce flux »). C'est l'équivalent du TAKE de la grille.</p>
<h3>La redondance : ST 2022-7</h3>
<p>Deux réseaux complètement séparés (souvent appelés rouge et bleu) transportent chacun une copie de chaque flux. Le récepteur reconstitue le signal paquet par paquet à partir des deux copies : une coupure sur un réseau ne se voit pas à l'image (« commutation sans coupure »).</p>
<h3>Ce qui ne change pas</h3>
<p>Les métiers : truquiste, vision, EVS, son. Les pupitres sont les mêmes ; c'est l'infrastructure derrière qui change. Le tally et les noms de sources circulent aussi en IP (protocole TSL UMD v5).</p>`},
  {
    id: 'reseau', title: 'Réseau ST 2110 spine-leaf (rouge / bleu)', html: `
<p>Le poste <b>Réseau IP</b> (zone technique, baie « Réseau IP · Multiview ») montre et laisse configurer la vraie infrastructure du car IP : deux réseaux identiques et indépendants, <b>rouge (A)</b> et <b>bleu (B)</b>, chacun en architecture <b>spine-leaf</b>, plus un réseau de contrôle. Tout ce qui est réglé là (VLAN, OSPF, PIM, IGMP, PTP, vitesses, FEC, MTU…) agit réellement sur ce que reçoivent le mélangeur, l'EVS, le multiview et les départs.</p>
<p>Le poste a deux onglets. <b>Technique</b> : schémas, commutateurs, adressage, flux et SDP, PTP, mesures, diagnostic et formation. <b>Exploitation</b> : l'interface épurée d'un contrôleur et des appareils, comme sur une passerelle ou un contrôleur du marché. On y choisit une <b>source</b> et une <b>destination</b>, on les connecte par NMOS (IS-05) ou en saisissant à la main, pour chaque réseau, l'adresse de la source, le groupe multicast et le port UDP ; deux moniteurs montrent la source et ce que reçoit vraiment la destination. La vue <b>Appareils</b> règle les adresses des cartes média A et B, du contrôle et du registre NMOS, le domaine PTP et les adresses des émetteurs ; les vues <b>PTP</b> et <b>NMOS</b> surveillent la synchronisation et l'enregistrement de chaque appareil.</p>
<p>Chaque terme technique du poste a son bouton <b>« ? »</b> : il ouvre une fiche (l'essentiel en une phrase, un schéma, l'explication, où le voir dans le car, la norme de référence). Le bouton <b>Lexique</b>, à côté des deux onglets, regroupe toutes les fiches.</p>
<p>À savoir : le masque et la passerelle d'une carte média ne servent qu'à l'unicast (supervision, ping). Le multicast ST 2110, les abonnements IGMP et PTP restent sur le lien local : une mauvaise passerelle ne coupe pas les flux, une adresse hors du sous-réseau, si (la leaf rejette ce qui ne passe pas son contrôle RPF).</p>
<h3>Pourquoi le spine-leaf ?</h3>
<p>Un gros commutateur unique est simple mais c'est un point de panne unique et il ne grandit pas. En <b>spine-leaf</b> (réseau de Clos à deux étages), chaque <b>leaf</b> est reliée à chaque <b>spine</b> : n'importe quel appareil est à deux sauts de n'importe quel autre (leaf → spine → leaf). Pour plus de ports on ajoute des leaves ; pour plus de bande passante, des uplinks ou des spines. Les leaves sont placées <b>en haut de baie</b> (ToR, Top of Rack), au plus près des appareils.</p>
<table class="tbl"><tr><th>Élément (par réseau)</th><th>Dans le simulateur</th></tr>
<tr><td>Spines</td><td>2 × 32 ports 100 GbE (QSFP28)</td></tr>
<tr><td>Leaves</td><td>6 × (48 ports 25 GbE SFP28 + 8 ports 100 GbE) : caméras, production, ralentis, monitoring, audio, passerelles / TX</td></tr>
<tr><td>Uplinks</td><td>2 × 100 GbE de chaque leaf vers chaque spine (Ethernet49-50 → spine 1, 51-52 → spine 2) : 400 Gb/s par leaf</td></tr>
<tr><td>Grands maîtres PTP</td><td>GM 1 sur les spines n°1 rouge et bleue, GM 2 sur les spines n°2 (port Ethernet31)</td></tr>
<tr><td>Contrôle</td><td>commutateur SW-CTRL : VLAN 10 gestion hors bande, VLAN 20 contrôle (registre NMOS, RCP, panneaux)</td></tr></table>
<p>Les deux réseaux ne sont <b>jamais reliés</b> entre eux : une erreur de configuration ou une tempête sur l'un ne peut pas atteindre l'autre. Chaque appareil a deux cartes (une par réseau) et émet chaque flux deux fois ; le récepteur fusionne les deux copies paquet par paquet (<b>SMPTE ST 2022-7</b>).</p>
<h3>Plan d'adressage (exemple pédagogique)</h3>
<ul><li>VLAN média = 100 × réseau + numéro de leaf : 101 à 106 en rouge, 201 à 206 en bleu. Un VLAN par leaf : le niveau 2 reste local, tout ce qui sort de la leaf est routé.</li>
<li>Sous-réseau 10.&lt;réseau&gt;.&lt;leaf&gt;.0/24, passerelle (SVI) en .1, appareils à partir de .20, même fin d'adresse sur les deux réseaux.</li>
<li>Loopbacks (router-id) en 10.0.x.y/32 ; liens leaf ↔ spine en /31 (10.255.x.y) ; grands maîtres en /30.</li>
<li>Groupes multicast 239.&lt;réseau&gt;.&lt;leaf de la source&gt;.&lt;n&gt;, port UDP 5004 ; vidéo PT 96, audio 97, données 100.</li></ul>
<h3>Underlay : routage OSPF et ECMP</h3>
<p>Les liens leaf ↔ spine sont des ports <b>routés</b> (« no switchport ») avec une adresse /31. <b>OSPF</b> (zone 0) annonce les loopbacks et les sous-réseaux média, et répartit le trafic sur les quatre uplinks à coût égal (<b>ECMP</b>). Deux pièges classiques : une <b>MTU différente</b> aux deux bouts bloque le voisinage OSPF (état EXSTART / EXCHANGE) ; un sous-réseau non annoncé empêche le contrôle RPF du multicast. Beaucoup de grands réseaux utilisent BGP plutôt qu'OSPF dans l'underlay (RFC 7938) ; le principe reste le même.</p>
<h3>Multicast : IGMPv3, PIM-SSM et snooping</h3>
<ol><li>Le contrôleur NMOS (IS-05) donne au récepteur le <b>SDP</b> de l'émetteur.</li>
<li>Le récepteur envoie un rapport <b>IGMPv3</b> « je veux le groupe G de la source S » (<b>S,G</b>) à sa leaf.</li>
<li>La leaf envoie une jonction <b>PIM</b> vers la source (chemin choisi par la table de routage : contrôle RPF), via une spine, jusqu'à la leaf de la source.</li>
<li>Le flux descend par ce chemin ; le <b>snooping IGMP</b> de chaque leaf ne le fait sortir que sur les ports abonnés.</li></ol>
<p>En <b>SSM</b> (Source-Specific Multicast) il n'y a pas de point de rendez-vous : la plage SSM doit contenir les groupes utilisés. Par défaut c'est 232.0.0.0/8 ; avec des groupes en 239.x il faut « ip pim ssm range 239.0.0.0/8 » partout. Le <b>querier</b> (la SVI en IGMPv3, ou un querier de niveau 2) interroge régulièrement les récepteurs ; sans lui, les abonnements expirent au bout de l'intervalle d'appartenance (260 s par défaut, 45 s dans le simulateur) : la panne apparaît plusieurs minutes après la vraie cause. Sans snooping, tous les flux du VLAN sont <b>inondés</b> sur tous les ports.</p>
<h3>Bande passante</h3>
<p>Un 1080p50 4:2:2 10 bits fait ≈ 2,1 Gb/s (≈ 2,2 avec les en-têtes), un UHD p50 ≈ 8,3 Gb/s (≈ 8,6), une paire audio ≈ 3 Mb/s. Une leaf « non bloquante » (autant de capacité d'uplink que de capacité d'accès) peut quand même saturer un lien précis : le hachage ECMP peut placer plusieurs gros flux sur le même uplink, et un multiviewer de 18 tuiles UHD demande plus de 150 Gb/s. <b>PIM ne connaît pas la bande passante</b> : un lien saturé perd des paquets pour <i>tous</i> les flux qui le traversent. Un <b>contrôleur SDN</b> (fonctions de multicast « non bloquant » des constructeurs) réserve la bande passante et <b>refuse</b> une connexion plutôt que de dégrader les autres. Le poste permet de comparer les deux modes.</p>
<h3>PTP dans la fabric</h3>
<p>Profil <b>SMPTE ST 2059-2</b> : domaine 127, Announce toutes les 2^-2 s, Sync et Delay_Req toutes les 2^-3 s, expiration après 3 Announce manqués. Les commutateurs sont des <b>horloges frontières</b> (boundary clocks) : chacun se cale sur son maître (port esclave) et redistribue l'heure. L'élection du grand maître (<b>BMCA</b>) compare dans l'ordre : priority1, clockClass (6 = verrouillé GPS, 7 = holdover, 248 = horloge libre), précision, variance, priority2, identité. Protections : appareils en « slave only », « ptp role master » sur les ports d'accès, PTP marqué DSCP 46 et servi en priorité.</p>
<h3>NMOS et SDP</h3>
<p><b>IS-04</b> : chaque appareil s'enregistre (nœud, émetteurs, récepteurs) dans le registre, par le réseau de contrôle. <b>IS-05</b> : le contrôleur connecte un récepteur à un émetteur en lui transmettant le SDP. Le SDP ST 2110 décrit le format (sampling, width, height, exactframerate, colorimetry, TCS…), l'horloge PTP de référence (ts-refclk) et, pour ST 2022-7, les deux jambes regroupées par « a=group:DUP primary secondary » (RFC 7104). Si le registre tombe, les flux établis continuent : ce sont les commutateurs qui les portent.</p>
<h3>Configuration : running et startup</h3>
<p>Chaque modification (interface graphique ou ligne de commande) va dans la <b>running-config</b>. Elle n'est conservée après un redémarrage qu'après « <b>write memory</b> » (copie dans la startup-config). Le terminal accepte une syntaxe proche d'Arista EOS / Cisco NX-OS, simplifiée : show interfaces status, show vlan, show ip ospf neighbor, show ip route, show ip mroute, show ip igmp snooping groups, show ptp, show lldp neighbors, configure terminal, interface Ethernet5, switchport access vlan 101, speed 25g, mtu 9214, ptp role master, write memory…</p>
<h3>Méthode de dépannage</h3>
<ol><li>Délimiter : une réception ou toutes ? rouge, bleu ou les deux ? (une panne d'un seul réseau ne se voit pas à l'image).</li>
<li>Couche 1 : port « connected » ? même vitesse aux deux bouts ? RS-FEC à 25G / 100G ?</li>
<li>Couche 2 : bon VLAN ? snooping actif ? querier présent ? MTU ≥ 1 500 ?</li>
<li>Couche 3 : adresse et passerelle cohérentes ? pas de conflit ? OSPF en FULL ?</li>
<li>Multicast : plage SSM, IGMPv3, PIM sur les SVI et les uplinks, show ip mroute le long du chemin.</li>
<li>Bande passante, puis PTP (show ptp parent), puis enregistrement NMOS. Après réparation : write memory.</li></ol>
<p class="note">Simplifications : syntaxe et sorties des commandes inspirées des constructeurs sans en être la copie ; pas de BGP/EVPN, d'agrégats LACP ni de QoS fine ; minuteries raccourcies ; débits arrondis. Plan d'adressage et numérotation des ports : exemple pédagogique, à adapter aux conventions de votre car.</p>`},
  {
    id: 'mesure2110', title: 'Mesurer et analyser un flux ST 2110', html: `
<p>En SDI, un oscilloscope et un moniteur suffisaient. En IP, une image peut être parfaite et le réseau en danger (une seule jambe 2022-7 reçue), ou l'image dégradée alors que tous les commutateurs sont « verts ». Le poste <b>Réseau IP → Mesures</b> donne les trois instruments de base.</p>
<h3>Anatomie d'un paquet vidéo ST 2110-20</h3>
<table class="tbl"><tr><th>Couche</th><th>Ce qu'on y lit</th></tr>
<tr><td>Ethernet</td><td>MAC de destination multicast : 01:00:5e + les 23 bits de poids faible du groupe (239.1.1.1 → 01:00:5e:01:01:01). 32 groupes partagent la même MAC : un plan d'adressage soigné évite les collisions.</td></tr>
<tr><td>IPv4</td><td>Source (l'émetteur), destination (le groupe), DSCP (26 pour la vidéo dans ce car), TTL, « ne pas fragmenter ».</td></tr>
<tr><td>UDP</td><td>Port 5004 dans ce car (défini par le SDP).</td></tr>
<tr><td>RTP (RFC 3550)</td><td>Type de charge (96), numéro de séquence (un trou = un paquet perdu), horodatage 90 kHz aligné sur PTP, bit M sur le dernier paquet de l'image, SSRC.</td></tr>
<tr><td>En-tête RFC 4175</td><td>Numéro de séquence étendu, longueur, numéro de ligne et décalage en pixels : le récepteur sait où placer chaque morceau d'image.</td></tr></table>
<p>Ordre de grandeur en 1080p50 : 1 200 octets de vidéo par paquet (480 pixels), 4 paquets par ligne, 4 320 paquets par image, <b>216 000 paquets par seconde</b>. En UHD : 864 000 paquets par seconde.</p>
<h3>Régularité : ST 2110-21</h3>
<p>Un émetteur ne doit pas envoyer ses paquets en rafales, sinon les files d'attente des commutateurs et les tampons des récepteurs débordent. ST 2110-21 définit trois types d'émetteurs — N (étroit), NL (étroit linéaire) et W (large) — et deux modèles de mesure : la compatibilité réseau (CINST / CMAX) et le récepteur virtuel (VRX / VRX_FULL). Les deux types principaux :</p>
<ul><li><b>Type N (étroit)</b> : paquets réguliers, petit tampon côté récepteur — typique des appareils matériels (caméras, mélangeurs).</li>
<li><b>Type W (large)</b> : rafales tolérées, tampon plus grand — typique des logiciels sur serveur.</li></ul>
<p>On mesure <b>CINST</b> (rafale instantanée, comparée à <b>CMAX</b>) et le remplissage du <b>récepteur virtuel</b> (comparé à <b>VRX_FULL</b>). Dans le simulateur, CMAX et VRX_FULL sont calculés pour le format choisi ; la gigue et CINST montent quand les liens traversés sont chargés.</p>
<h3>ST 2022-7 : les deux jambes</h3>
<p>L'analyseur compare les deux réseaux : débit et pertes de chaque jambe, <b>écart de temps</b> entre rouge et bleu (quelques microsecondes ici, car les deux fabrics sont identiques), paquets <b>réparés</b> par l'autre réseau et paquets <b>perdus définitivement</b>. Des paquets réparés en continu signalent une jambe malade, même si l'image est parfaite.</p>
<h3>PTP : suivre l'offset</h3>
<p>Chaque appareil mesure son écart (offset) avec son maître à chaque message Sync. Verrouillé : quelques dizaines de nanosecondes. Au changement de grand maître : un saut, puis la convergence de l'asservissement en quelques secondes. Bruit de plusieurs centaines de nanosecondes : PTP n'a pas la priorité dans les files des commutateurs et les liens sont chargés. Appareil verrouillé sur une horloge non traçable : l'offset paraît bon, mais tout le réseau dérive par rapport au GPS — d'où l'intérêt de regarder <i>qui</i> est le grand maître (show ptp parent).</p>
<h3>La capture de paquets</h3>
<p>On ne se branche pas « en coupure » sur un lien 100 GbE : on crée une <b>session miroir</b> (SPAN) qui recopie le trafic d'un port vers le port où est branché l'analyseur. Deux pièges :</p>
<ul><li>si le port de destination est plus lent que le trafic recopié, c'est la <b>capture</b> qui perd des paquets, pas le réseau ;</li>
<li>un port de destination de SPAN ne transporte plus le trafic normal : ne jamais choisir le port d'un appareil en service.</li></ul>
<p>Dans la capture, on vérifie : les groupes et les sources attendus (filtre SSM), le DSCP, la continuité des numéros de séquence RTP, la présence des messages PTP (Announce, Sync, Follow_Up, Delay_Req / Delay_Resp, domaine 127), les rapports IGMPv3 du récepteur et la requête du querier.</p>
<h3>Le SDP, ligne par ligne</h3>
<p>Dans le poste, chaque ligne du SDP est commentée : <code>m=</code> (média, port, type de charge), <code>c=</code> (groupe), <code>a=source-filter</code> (SSM), <code>a=rtpmap</code> et <code>a=fmtp</code> (format), <code>a=ts-refclk</code> (horloge PTP), <code>a=group:DUP</code> et <code>a=mid</code> (les deux jambes 2022-7).</p>
<h3>Parcours de formation</h3>
<p>L'onglet <b>Formation</b> du poste Réseau IP propose quatorze missions (de la lecture de la topologie à la reconstruction d'une leaf), un quiz de dix questions tirées au sort et un examen de dépannage noté (trois pannes cachées, quinze minutes). Les résultats remontent au formateur dans l'Espace formateur → suivi des stagiaires.</p>
<p class="note">Valeurs simulées : CINST, VRX, gigue, latences et offsets suivent l'état du réseau mais ne remplacent pas un analyseur réel. Les formules de CMAX et VRX_FULL suivent le modèle étroit de ST 2110-21 ; à faire vérifier pour vos formats.</p>`},
  {
    id: 'hdrguide', title: 'HDR, SDR et colorimétrie', html: `
<h3>Gamut et courbe</h3>
<p>Deux choses définissent une image : l'étendue des couleurs (<b>gamut</b>) et la courbe de transfert (<b>gamma</b> ou OETF). La HD classique utilise le gamut <b>BT.709</b> et le gamma BT.709 (SDR). L'UHD utilise le gamut plus large <b>BT.2020</b>, et souvent une courbe <b>HDR</b>.</p>
<h3>HLG et PQ</h3>
<ul>
<li><b>HLG</b> (Hybrid Log-Gamma, BBC/NHK) : courbe relative, compatible avec les écrans SDR qui acceptent la colorimétrie BT.2020 (pour le parc HD en BT.709, on livre une version SDR convertie). C'est le choix habituel du sport en direct.</li>
<li><b>PQ</b> (ST 2084) : courbe absolue en cd/m², utilisée en cinéma et streaming.</li>
<li><b>S-Log3</b> : courbe « caméra » qui garde un maximum de dynamique, avant conversion.</li>
</ul>
<h3>Une seule équipe vision pour deux sorties</h3>
<p>On produit souvent en HDR et en SDR à la fois, à partir des mêmes caméras (« single stream »). Les CCU sortent l'HDR et une copie SDR convertie ; avec un flux de travail de type SR Live, l'ingénieur vision règle l'image sur le moniteur SDR et l'HDR suit automatiquement, avec des conversions (LUT) identiques sur toute la chaîne.</p>
<h3>Repères de niveaux</h3>
<ul>
<li>SDR : le blanc nominal est à 100 % ; la pelouse au soleil vers 40 à 55 %.</li>
<li>HLG : le « blanc de référence » (une feuille blanche) est à <b>75 %</b> du signal (recommandation ITU-R BT.2408), soit 203 cd/m² sur un écran de référence ; les tons chair vers 45 à 55 %. Au-dessus de 75 %, on garde de la marge pour les hautes lumières (ciel, projecteurs, maillots blancs au soleil).</li>
<li>Le moniteur de référence (Grade 1) doit être dans le bon mode (HLG ou SDR) : une image HDR vue en SDR paraît terne, l'inverse paraît brûlée.</li>
</ul>`},
  {
    id: 'mesures', title: 'Mesures et niveaux', html: `
<h3>La vidéo numérique (10 bits)</h3>
<table><tr><th>Niveau</th><th>Code 10 bits</th><th>Oscilloscope</th><th>Ancien analogique</th></tr>
<tr><td>Noir</td><td>64</td><td>0 %</td><td>0 mV</td></tr>
<tr><td>Blanc nominal</td><td>940</td><td>100 %</td><td>700 mV</td></tr>
<tr><td>Super-blanc maximal</td><td>1019</td><td>≈ 109 %</td><td>≈ 763 mV</td></tr>
<tr><td>Chrominance au repos</td><td>512</td><td>centre du vecteurscope</td><td>0 mV</td></tr></table>
<p>Les codes 0 à 3 et 1020 à 1023 sont réservés à la synchronisation du signal SDI. Les diffuseurs imposent souvent des limites (par exemple pas plus de 103 % en luminance) : le knee et l'écrêteur de la caméra servent à les respecter.</p>
<h3>Lire l'oscilloscope et le vecteurscope</h3>
<ul>
<li><b>Waveform :</b> chaque colonne de l'image donne une trace verticale ; la hauteur, c'est le niveau. On vérifie les noirs (vers 0-2 %), les blancs (sous 100 %) et la pelouse.</li>
<li><b>Parade RVB :</b> les trois composantes côte à côte ; un blanc neutre a ses trois traces à la même hauteur.</li>
<li><b>Vecteurscope :</b> la couleur (teinte = angle, saturation = distance au centre). Les barres à 75 % tombent dans les cibles ; un gris neutre est au centre.</li>
</ul>
<h3>L'audio</h3>
<ul>
<li>Alignement : un 1 kHz à <b>−18 dBFS</b> (recommandation EBU R68) correspond au niveau d'alignement de la ligne (0 dBu).</li>
<li>Loudness : <b>−23 LUFS</b> intégré sur le programme (EBU R128), true peak ≤ <b>−1 dBTP</b>.</li>
<li>Le dBFS est un niveau numérique (0 dBFS = le maximum possible, au-delà c'est l'écrêtage).</li>
</ul>
<h3>Les fibres</h3>
<ul>
<li>Une fibre monomode perd environ 0,35 à 0,4 dB par kilomètre à 1310 nm : la longueur compte peu.</li>
<li>Ce sont les <b>connecteurs</b> qui font les pertes : environ 0,5 dB par connexion propre, beaucoup plus s'ils sont sales. Une poussière invisible sur une fibre de 9 µm suffit à couper une caméra.</li>
<li>Réflexe : bouchon toujours en place, nettoyage (stylo, cassette) et inspection au microscope avant de connecter ; mesure du niveau reçu sur la CCU.</li>
</ul>
<h3>La HF</h3>
<p>Les niveaux reçus s'expriment en dBm (−60 dBm = un millionième de milliwatt), les gains d'antennes en dBi, et la qualité en C/N ou MER (dB). La marge = C/N reçu − C/N requis par la modulation : au-dessous de 0 dB, l'image décroche d'un coup (effet falaise).</p>`},
  {
    id: 'timing', title: 'Synchronisation fine et retards', html: `
<h3>Pourquoi les sources doivent être « en phase »</h3>
<p>Le mélangeur commute entre ses entrées à un instant précis de l'image (le point de commutation). Si deux sources ne commencent pas leur image au même moment, la commutation provoque un saut, une image qui roule ou une coupure du son. D'où le <b>genlock</b> : toutes les sources sont asservies à la même référence.</p>
<h3>La référence analogique</h3>
<ul>
<li><b>Black burst</b> (noir codé SD) ou <b>tri-level</b> (HD), distribué en étoile par des distributeurs (DA) depuis le générateur de synchro (SPG).</li>
<li>Chaque équipement a un réglage de <b>phase</b> (H phase, retard en lignes et en pixels) pour compenser ses temps de traitement et les longueurs de câble.</li>
<li>Les mélangeurs modernes acceptent une fenêtre de décalage en entrée et réalignent automatiquement ; les sources hors fenêtre passent par un <b>synchroniseur d'images</b> (frame sync), qui ajoute une image de retard.</li>
</ul>
<h3>Le SPG</h3>
<p>Asservi au GPS, il génère la référence vidéo, le timecode (LTC), le word clock audio (48 kHz) et le PTP. Il est doublé : un SPG de secours prend le relais automatiquement (changeover). En perte de GPS, il passe en <b>holdover</b> : son oscillateur (OCXO) reste stable des heures.</p>
<h3>Retards et synchro labiale</h3>
<p>Chaque traitement ajoute du retard : synchroniseur (1 image), multiviewer (1 à 2 images), liaison HF (de quelques dizaines de ms à plus d'une seconde selon l'encodage), transmission satellite. La vidéo et le son doivent rester alignés (lip-sync) : on retarde l'audio pour qu'il arrive en même temps que l'image. Repère (ITU-R BT.1359) : un décalage devient perceptible à partir d'environ 45 ms quand le son est en avance, et d'environ 125 ms quand il est en retard ; la tolérance de bout en bout de l'EBU R37 est plus serrée (son en avance de 40 ms au plus, en retard de 60 ms au plus).</p>`},
  {
    id: 'icomguide', title: 'Ordres et intercom', html: `
<p>Le système d'ordres relie toutes les personnes de la production. Sans lui, pas de réalisation possible : le réalisateur annonce chaque plan, la vision appelle un cadreur, l'EVS annonce qu'il est prêt.</p>
<h3>Les éléments</h3>
<ul>
<li><b>La matrice</b> : le cœur numérique, qui route chaque voix vers chaque destination.</li>
<li><b>Les pupitres</b> : une touche par destination, avec TALK (parler) et LISTEN (écouter). Afficheur avec le nom de la destination.</li>
<li><b>Les beltpacks</b> filaires ou sans fil (DECT 1,9 GHz, 2,4 ou 5 GHz) pour le personnel mobile.</li>
<li><b>Les interfaces</b> : 4 fils vers la chaîne et les autres cars, hybrides téléphoniques/SIP, cartes vers les CCU.</li>
</ul>
<h3>Les types de liaison</h3>
<ul>
<li><b>Conférence (partyline)</b> : un groupe où tout le monde s'entend (« Ordres », « Caméras », « EVS »).</li>
<li><b>Point à point</b> : une liaison privée.</li>
<li><b>IFB</b> : un retour programme, le plus souvent un N-1 (tout sauf la voix de celui qui l'écoute), que l'on interrompt ou atténue pour lui parler (commentateurs, présentateurs, journaliste bord terrain).</li>
<li><b>4 fils</b> : une paire pour parler, une pour écouter, sans mélange : pour relier deux systèmes.</li>
</ul>
<h3>Jusqu'au cadreur</h3>
<p>Les ordres sortent de la matrice vers chaque CCU (connecteur INTERCOM/TALLY/IO, canaux <b>PROD</b> pour la production et <b>ENG</b> pour la technique), passent dans la fibre caméra et arrivent au casque du cadreur (INTERCOM sur la tête de caméra). Le tally suit le même chemin : rouge = à l'antenne, vert = en preset (selon la configuration). Pour les caméras HF, l'intercom passe par une liaison radio séparée.</p>
<h3>Bonnes pratiques</h3>
<ul><li>Phrases courtes, toujours le nom ou le numéro d'abord (« La 3… serre le gardien »).</li>
<li>On ne parle pas sur l'ordre général pendant un direct si ce n'est pas utile à tout le monde : on utilise le point à point.</li>
<li>Tester chaque position au line-up, y compris les commentateurs et la chaîne.</li></ul>`},
  {
    id: 'cablage', title: 'Lire une liste de câblage', html: `
<p>Le chef de car prépare (ou génère depuis un logiciel) une <b>liste de câblage</b> : chaque câble porte un numéro, écrit sur une étiquette à ses deux extrémités. Le poste « Chef de car », onglet <b>Liste de câblage</b>, génère celle de votre installation.</p>
<h3>Les colonnes</h3>
<ul>
<li><b>N°</b> : identifiant unique du câble (C001…), identique sur les deux étiquettes.</li>
<li><b>Origine (A)</b> et <b>Destination (B)</b> : appareil · connecteur, par exemple « CCU 3 · SDI 1 » → « Grille · IN 3 ».</li>
<li><b>Câble</b> : le type (coaxial 75 Ω, fibre hybride SMPTE, multipaire D-sub, RJ-45, XLR…).</li>
<li><b>Longueur</b> et <b>signal</b> (vidéo, référence, audio, intercom, données, énergie, fibre, IP, HF).</li>
</ul>
<h3>Méthode d'installation</h3>
<ol>
<li>Tirer les câbles longs d'abord (caméras), en respectant les passages protégés.</li>
<li>Étiqueter les deux bouts avant de connecter.</li>
<li>Raccorder au <b>pied de car</b> (panneau de connexion extérieur) : embases SMPTE, triax, fibres, BNC, audio, réseau.</li>
<li>Tester chaque liaison : niveau optique, mire, continuité, intercom.</li>
<li>Cocher la ligne sur la liste ; noter tout changement (une liste fausse fait perdre des heures en dépannage).</li>
</ol>
<h3>En dépannage</h3>
<p>On suit le signal d'un bout à l'autre, maillon par maillon, en partant de ce qui marche : la liste dit exactement par où il passe. Dans le simulateur, chaque extrémité est cliquable et ouvre l'appareil sur le bon connecteur ; le bouton « Suivre » passe à l'autre bout du câble.</p>`},
  {
    id: 'securite', title: 'Sécurité', html: `
<ul><li>Terre raccordée avant toute mise sous tension ; aucune opération sur l'installation électrique ou à son voisinage (raccordement, consignation, dépannage) sans habilitation électrique adaptée (NF C 18-510), et jamais de travail sous tension sans habilitation spécifique.</li>
<li>Travail en hauteur (passerelles, toits) : protection collective d'abord (garde-corps, filets, nacelle) ; à défaut seulement, harnais antichute relié à un point d'ancrage, jamais seul ; outils attachés.</li>
<li>Câbles : passages protégés (passe-câbles), pas de câble dans les zones de circulation du public ou dans les issues de secours.</li>
<li>Rayonnement HF : respecter les distances de sécurité autour des antennes et émetteurs.</li>
<li>Drones : télépilote certifié, scénario de vol déclaré, jamais au-dessus du public.</li></ul>`},
  {
    id: 'sessions', title: 'Jouer à plusieurs (réseau local ou en ligne)', html: `
<p>Une captation est un travail d'équipe : le réalisateur annonce, le truquiste exécute, l'opérateur ralenti prépare, la vision et le son ajustent, la technique surveille. Le mode <b>« Jouer à plusieurs »</b> met plusieurs joueurs dans le <b>même car</b>, chacun sur son ordinateur, devant le <b>même match</b>. Chacun a un <b>pseudo</b> et un <b>rôle</b> ; on voit les autres se déplacer dans le stade et dans le car.</p>
<h3>Deux façons de se connecter</h3>
<ul>
<li><b>Réseau local (sans Internet)</b> : la personne qui héberge lance le petit serveur fourni : sous Windows, double-clic sur <code>Car-regie-3D.exe</code> (rien à installer, le navigateur s'ouvre tout seul) ; ailleurs, l'archive « réseau local » (Windows, macOS ou Linux, Node.js nécessaire). Il affiche une adresse du type <code>http://192.168.1.20:8080</code> : les autres l'ouvrent dans leur navigateur, rien à installer. Tout le monde doit être sur le même réseau (même box, même Wi-Fi ou même switch).</li>
<li><b>En ligne</b> : dans la page publiée sur claude.ai, partagée aux stagiaires (niveau « Contributeur » au moins). L'hôte crée la partie et donne son code.</li>
</ul>
<h3>Héberger, rejoindre</h3>
<ul>
<li>Accueil → « Jouer à plusieurs » (ou bouton « Équipe » de la barre d'outils). Choisissez votre <b>pseudo</b> : il s'affiche au-dessus de votre personnage.</li>
<li><b>Héberger une partie</b> : votre ordinateur fait tourner le match pour tous. <b>Rejoindre une partie</b> : sur le réseau local, les parties en cours s'affichent toutes seules, avec qui tient quel rôle.</li>
<li><b>Rôles</b> : formateur, réalisateur, truquiste, ralentis (EVS), son, vision, technique, habillage, cadreur (une caméra chacun), observateur. Un rôle déjà pris est signalé. L'hôte ou le formateur peut <b>réattribuer les rôles</b> (« Équipe » → Participants).</li>
</ul>
<h3>Pendant la prestation</h3>
<ul>
<li><b>Les autres joueurs</b> : un technicien en tenue de la couleur de son rôle, casque d'ordres, pseudo et rôle au-dessus de la tête. Assis à son pupitre quand il tient un poste ; quand il cadre, son étiquette passe au-dessus de sa caméra. Le plan du car les montre aussi, et « Aller à… » propose de <b>rejoindre un équipier</b>.</li>
<li><b>Fiche de rôle</b> (en haut à gauche) : ce qu'on attend de vous, un bouton « Aller à mon poste » (un cadreur y prend directement sa caméra) et des <b>objectifs suivis en direct</b> : ordres exécutés et temps de réaction du truquiste, enregistrement et ralentis passés pour l'EVS, loudness et commentaires hors de l'international pour le son, caméras bien exposées pour la vision, alarmes pour la technique…</li>
<li><b>Qui pilote quoi</b> : chaque poste appartient à un rôle (mélangeur → truquiste, EVS → ralentis, console → son, RCP → vision, grille, transmission, HF et baie CCU → technique, habillage → habillage). Les autres le voient <b>en lecture seule</b> (bandeau « tenu par… ») mais suivent tout ce qui s'y passe. Un poste sans titulaire reste à l'hôte.</li>
<li><b>Le match</b> tourne chez l'hôte ; les autres le reçoivent avec 0,3 s de retard, comme un retour. Les commentaires viennent aussi de l'hôte.</li>
<li><b>Ordres</b> : au poste réalisateur, « Prépare la 3 », « Top », « Enchaîne », « Ralenti »… s'affichent en grand chez le truquiste et l'opérateur ralenti, avec un bip, et passent dans le fil d'intercom. L'onglet « Ordres et messages » sert de canal écrit.</li>
<li><b>Formateur</b> : injecte des pannes (cachées ou annoncées) chez le joueur concerné, fait des annonces à tous, et produit un <b>compte rendu</b> : participants et rôles, ordres donnés, temps de réaction du truquiste, pannes résolues ou non, journal. Sur le réseau local, il est écrit sur l'ordinateur de l'hôte (dossier « rapports » du serveur).</li>
</ul>
<p class="note">Limites : les clips et playlists EVS ne sont pas partagés (chacun voit la lecture en cours, pas la bibliothèque), et les pannes du réseau IP restent locales. Si l'hôte part, le joueur suivant reprend le match là où il en était. Sur le réseau local, une connexion qui décroche se rétablit seule.</p>`},
  {
    id: 'relecture', title: 'Relecture technique par les métiers', html: `
<p>Les chiffres du simulateur (focales et rampes d'ouverture, portées des liaisons, rapports C/N, latences, tolérance de synchro labiale, niveaux de line-up…) viennent de documentations publiques et d'usages courants. Ils doivent être <b>validés par des professionnels</b> avant de servir de référence.</p>
<ul>
<li><b>Relecteurs</b> : écran d'accueil → « Relecture technique (experts) ». Choisissez votre domaine (vision, son, réseau, ralentis, HF, niveaux, stade), donnez un avis par point (exact, à corriger, je ne sais pas, non applicable), commentez, et proposez des valeurs chiffrées. « Voir le guide » et « Ouvrir le poste » montrent le point dans le simulateur.</li>
<li><b>Formateur</b> : Espace formateur → Relecture. La synthèse croise les relecteurs, met en avant les points contestés, et permet d'<b>appliquer</b> une valeur proposée : elle remplace celle du simulateur pour tous les stagiaires (« Rétablir l'origine » pour revenir). Rapport HTML et export CSV.</li>
<li><b>Dispositif réel</b> : l'onglet « Dispositif réel » de l'Espace formateur enregistre l'implantation des caméras de votre car (positions, types, objectifs, liaisons) et la feuille de patch audio : les stagiaires démarrent alors sur <b>votre</b> installation.</li>
</ul>`},
];
// le chapitre sur le stade vient après le déroulé d'une production
GUIDE.splice(1, 0, GUIDE.shift());
