// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » pour la mesure vidéo (PRISM : waveform, vecteurscope, diamant, diagramme de l'œil…). Elles s'ajoutent au lexique commun
// (content/netterms.js) : même format, mêmes boutons « ? » (ui/term.js), même lexique.
// Valeurs vérifiées (sources dans le rapport du chantier PRISM) : amplitude SDI 800 mV ± 10 % ; montée /
// descente 20-80 % ≤ 270 ps (HD-SDI, écart ≤ 100 ps), ≤ 135 ps (3G, ≤ 50 ps), ≤ 45 ps (12G, ≤ 18 ps) ;
// dépassement ≤ 10 % ; gigue de timing ≤ 1 / 2 / 8 UI, d'alignement ≤ 0,2 / 0,3 / 0,3 UI ; récepteurs : 20 dB
// (HD, 3G) ou 40 dB (6G, 12G) à la demi-fréquence d'horloge ; Belden 1694A : 5,4 dB/100 ft à 750 MHz,
// 7,8 à 1,5 GHz, 17,7 à 6 GHz ; EBU R 103 (2000) : R, G, B de −5 à 105 %, Y de −1 à 103 % ;
// BT.2408 : blanc de référence HLG à 75 % ; primaires BT.709 et BT.2020, blanc D65.
// ----------------------------------------------------------------------------------
import { TERMS, CATS, TERM_PATTERNS } from './netterms.js';

const V = 'Mesure vidéo', P = 'Couche physique SDI';
for (const c of [V, P]) if (!CATS.includes(c)) CATS.push(c);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  // ================= Mesure vidéo =================
  prism: {
    t: 'PRISM (moniteur de mesure)', aka: 'Telestream PRISM, anciennement Tektronix (MPI2, MPX2…)', cat: V,
    short: 'L\'instrument de mesure vidéo du car : un écran tactile en tuiles, chacune avec son affichage (waveform, vecteurscope, gamut, œil…), sur une entrée SDI ou un flux IP.',
    body: "Le PRISM a succédé aux moniteurs de forme d'onde (WFM) de Tektronix ; la gamme appartient aujourd'hui à Telestream. C'est un logiciel de mesure dans un boîtier : quelques boutons en façade, tout le reste sur l'écran tactile.\n\n- **Entrées** : plusieurs SDI (jusqu'au 12G-SDI) et des cages SFP 25 GbE pour les flux ST 2110.\n- **Tuiles** : l'écran se découpe en 1, 2 ou 4 tuiles ; chaque tuile choisit son application (waveform, vecteurscope, lightning, diamant, image, son, timing, état…).\n- **Options** : la couche physique (diagramme de l'œil, gigue, longueur de câble) et le HDR (échelles HDR, diagramme CIE).\n\nOn le trouve à la vision (régler les caméras), en zone technique (qualifier les liaisons) et au contrôle qualité.",
    car: 'Au poste vision (sous le Grade 1) et à la baie de mesure de la zone technique. Les mêmes tuiles, des préréglages différents : « Vision » d\'un côté, « Couche physique » de l\'autre.',
    see: ['waveform', 'vecteurscope', 'diamant', 'oeil'], ref: 'Telestream PRISM (MPI2, MPX2, MPS, MPD), fiches produit',
  },
  waveform: {
    t: 'Waveform', aka: 'moniteur de forme d\'onde, oscilloscope vidéo', cat: V,
    short: 'Trace le niveau de chaque point de l\'image, colonne par colonne : de 0 mV (noir) à 700 mV (blanc nominal). L\'outil de l\'exposition.',
    body: "Toutes les lignes de l'image sont superposées : la position horizontale d'un point sur la trace est sa position dans la ligne (de gauche à droite), sa hauteur est son niveau. Le haut de l'écran, ce sont les blancs ; le bas, les noirs.\n\nRepères pour un match de jour :\n- pelouse au soleil vers **40 à 55 %** ;\n- blancs (maillots, lignes) **sous 100 %**, 103 % au plus selon le diffuseur ;\n- noirs posés **entre 0 et 2 %**.\n\nTrois façons de le regarder : la **luminance** seule (Y), la **parade RVB**, la **parade YCbCr**. En HDR HLG, le blanc de référence se pose vers 75 %.",
    car: 'Tuile Waveform du PRISM (poste vision et baie de mesure), calculée sur l\'image réellement rendue (192 × 108 points, environ 8 fois par seconde). Bouton « Curseur » pour lire un niveau.',
    fig: 'wfm', see: ['mv-pct', 'parade-rvb', 'ycbcr', 'hdr-hlg'], ref: 'ITU-R BT.709 ; EBU R 103 (tolérances) ; rapport ITU-R BT.2408 (HLG)',
  },
  'mv-pct': {
    t: 'mV et % (échelle du waveform)', cat: V,
    short: 'Deux façons de lire la même hauteur : 700 mV = 100 % = blanc nominal, 0 mV = 0 % = noir. 1 % vaut 7 mV.',
    body: "L'échelle en mV vient de la vidéo analogique en composantes : 700 mV entre le noir et le blanc. Le numérique a gardé ces repères.\n\nEn 10 bits, la luminance code le noir à **64** et le blanc à **940**. Les codes au-dessus restent utilisables jusqu'à 1 019, soit environ **109 %** : c'est la ligne pointillée rouge du waveform, le plus haut que le signal puisse porter. Sous le noir, on descend jusqu'à environ −7 %.\n\nLes diffuseurs fixent leurs limites en % : blancs ≤ 100 % (ou 103 %), noirs ≥ 0 %. La recommandation EBU R 103 (2000) tolère R, G et B entre −5 et 105 %, la luminance entre −1 et 103 %.",
    car: 'Bouton mV / % de la tuile Waveform.',
    see: ['waveform', 'gamut'], ref: 'ITU-R BT.709 (codage 10 bits) ; EBU R 103',
  },
  'parade-rvb': {
    t: 'Parade RVB', aka: 'RGB parade', cat: V,
    short: 'Le waveform en trois morceaux côte à côte : rouge, vert, bleu. Sur un blanc ou un gris neutre, les trois traces sont à la même hauteur.',
    body: "C'est l'outil de la **balance** :\n- en haut, sur les blancs et les gris clairs : une trace plus haute que les deux autres signale une dominante de cette couleur (balance des blancs à reprendre, AWB ou gains WHITE) ;\n- en bas, sur les noirs : les trois traces doivent partir du même niveau (balance des noirs, ABB ou réglages BLACK).\n\nPour le **matching**, on compare deux caméras sur le même objet : mêmes hauteurs de R, G et B.",
    car: 'Tuile Waveform, bouton RVB. L\'exercice « Lire les niveaux au waveform et à la parade » (Cours, leçon sur les niveaux) fait corriger un noir rouge au RCP.',
    fig: 'parade', see: ['waveform', 'ycbcr', 'vecteurscope'],
  },
  ycbcr: {
    t: 'YCbCr', aka: 'luminance et différences de couleur (Y′CbCr)', cat: V,
    short: 'La forme du signal dans le câble SDI : la luminance Y et deux différences de couleur, Cb (bleu − Y) et Cr (rouge − Y), en 4:2:2.',
    body: "La caméra produit R, G et B ; on les transforme avant de les transporter :\n- `Y = 0,2126 R + 0,7152 G + 0,0722 B` (BT.709 ; en BT.2020 : 0,2627 / 0,6780 / 0,0593) ;\n- `Cb = (B − Y) / 1,8556` et `Cr = (R − Y) / 1,5748`.\n\nY va de 0 à 700 mV, Cb et Cr de −350 à +350 mV autour de zéro (sur la parade, ce zéro est dessiné à 350 mV). L'œil voit moins bien le détail de la couleur que celui de la lumière : en **4:2:2**, Cb et Cr ont deux fois moins d'échantillons que Y sur une ligne.\n\nAttention : toutes les combinaisons de Y, Cb et Cr n'existent pas en RVB. Un signal YCbCr peut être « hors gamut ».",
    car: 'Tuile Waveform, bouton YCbCr.',
    see: ['parade-rvb', 'vecteurscope', 'gamut'], ref: 'ITU-R BT.709, BT.2020, BT.2100',
  },
  vecteurscope: {
    t: 'Vecteurscope', aka: 'vectorscope', cat: V,
    short: 'Place chaque point de l\'image selon sa couleur : l\'angle donne la teinte, la distance au centre la saturation. Blanc, gris et noir tombent au centre.',
    body: "Horizontalement Cb, verticalement Cr : la luminance n'y figure pas. Les **cibles** (petites cases) marquent les six couleurs de la mire : rouge (R), magenta (Mg), bleu (B), cyan (Cy), vert (G), jaune (Yl), à 75 % ou à 100 %.\n\nÀ quoi il sert :\n- au **line-up**, vérifier que les barres tombent dans leurs cibles (gains et phase de la chaîne) ;\n- juger la **balance** : en zoom ×5, un gris neutre fait une petite tache au centre exact ;\n- comparer la **saturation** des caméras (matching) ;\n- la **ligne des tons chair**, vers 123°, aide à juger les visages.\n\nUne couleur peut rester dans le cercle et être pourtant hors gamut en RVB : c'est le travail du diamant.",
    car: 'Tuile Vecteurscope : boutons 75 % / 100 % (cibles) et ×1 / ×5.',
    fig: 'vecteur', see: ['mire-75', 'ycbcr', 'diamant', 'lightning'],
  },
  'mire-75': {
    t: 'Mire 75 % et 100 %', aka: 'barres de couleur, notation 100/0/75/0', cat: V,
    short: 'Barres de couleur dont le blanc est à 100 % et les couleurs à 75 % (mire du car) ou à 100 %. Au vecteurscope, chaque barre doit tomber dans sa cible.',
    body: "Les barres, de gauche à droite : blanc, jaune, cyan, vert, magenta, rouge, bleu, noir (luminance décroissante). La notation **100/0/75/0** se lit : blanc à 100 %, noir à 0 %, couleurs à 75 % au plus et 0 % au moins.\n\nPourquoi 75 % ? Une mire 100 % pousse le jaune et le cyan à 133 % en composite (et le rouge et le bleu à −33 %) : trop pour les émetteurs analogiques. Les 75 % restent dans les limites.\n\nAu line-up, la mire vérifie toute la chaîne (caméra, CCU, grille, départ) et le nom de la source au multiview.",
    car: 'La mire du car (source MIRE, « MIRE 100/75 ») et la touche BARS du RCP : au vecteurscope, les points tombent dans les cibles 75 %.',
    fig: 'mire', see: ['vecteurscope', 'lightning', 'arrowhead'], ref: 'ITU-R BT.471 (nomenclature des barres de couleur)',
  },
  lightning: {
    t: 'Lightning', aka: 'affichage « éclair » de Tektronix', cat: V,
    short: 'Croise la luminance (en hauteur) et une différence de couleur (en largeur) : Cb en haut, Cr en bas, le noir au centre. Vérifie la mire d\'un coup d\'œil.',
    body: "Sur la mire, la trace dessine un éclair : chaque barre a sa cible, en haut (Y et Cb) et en bas (Y et Cr).\n\n- une barre hors de sa cible = un gain ou une couleur faux dans la chaîne ;\n- la transition **vert → magenta** doit passer par les repères du centre ; si elle les manque, la luminance et la couleur ne sont plus alignées dans le temps (retard d'une composante) ;\n- des transitions bombées = décalage entre Cb et Cr.",
    car: 'Tuile Lightning (cibles 75 % ou 100 %). Mets une caméra en barres au RCP pour voir l\'éclair.',
    fig: 'lightning', see: ['vecteurscope', 'mire-75', 'ycbcr'], ref: 'Tektronix, notes d\'application sur les affichages Lightning et Diamond',
  },
  diamant: {
    t: 'Diamant', aka: 'diamond display (Tektronix)', cat: V,
    short: 'Affichage du gamut RVB : deux losanges, bleu-vert en haut, rouge-vert en bas. Une trace qui en sort a une composante R, G ou B hors de 0 à 700 mV.',
    body: "Construction :\n- losange du haut : verticalement B + G, horizontalement B − G ;\n- losange du bas : verticalement −(R + G), horizontalement R − G.\n\nLe carré des valeurs permises (chaque composante entre 0 et 700 mV), tourné de 45°, devient un losange. Le **noir** est au centre, le **blanc** aux pointes ; chaque côté correspond à une composante à 0 ou à 700 mV.\n\nLecture :\n- trace qui dépasse une **pointe** : blanc trop haut (white clip, knee) ;\n- trace qui sort par un **côté** : couleur trop saturée ; le côté dit quelle composante : bord haut droit = B, bord haut gauche = G, bord bas droit = R.\n\nLes instruments filtrent les transitions très rapides (vers 1,5 MHz chez Tektronix) pour ne pas alerter sur un simple front.",
    car: 'Tuile Diamant. Au RCP, la saturation poussée à 150 % fait sortir les maillots par les côtés ; knee et white clip gardent les blancs dans les pointes.',
    fig: 'diamant', see: ['split-diamant', 'gamut', 'arrowhead'], ref: 'Tektronix (diamond display) ; EBU R 103',
  },
  'split-diamant': {
    t: 'Split diamant', aka: 'split diamond', cat: V,
    short: 'Le diamant coupé en deux, les losanges écartés : les noirs ne se superposent plus, on voit enfin les excursions sous le noir (valeurs négatives).',
    body: "Dans le diamant normal, les deux losanges se touchent par leur pointe noire. Une valeur sous le noir dans le losange du haut tombe alors… dans le losange du bas, où on ne la distingue pas.\n\nLe split diamant écarte les deux losanges : tout ce qui apparaît dans l'espace entre eux est **sous le noir**. Causes courantes : master black trop bas, incrustation ou conversion mal réglée, source extérieure.",
    car: 'Tuile Split diamant. La chaîne du simulateur écrête à 0 : pas d\'excursion sous le noir ici, mais le réflexe reste bon pour une source extérieure.',
    fig: 'split', see: ['diamant', 'gamut'], ref: 'Tektronix (split diamond)',
  },
  arrowhead: {
    t: 'Arrowhead', aka: 'affichage « pointe de flèche » de Tektronix', cat: V,
    short: 'Le gamut composite (PAL ou NTSC) sans encodeur : la luminance en hauteur, l\'amplitude de la chrominance en largeur ; les obliques sont les limites du composite.',
    body: "En composite, la couleur est une sous-porteuse ajoutée à la luminance : le signal monte jusqu'à Y + C et descend jusqu'à Y − C. L'arrowhead place chaque point selon Y (hauteur) et C (largeur) : les limites Y + C et Y − C forment deux obliques qui se rejoignent, d'où la pointe de flèche.\n\nRepères : la mire 100 % atteint **133 %** (jaune, cyan) et **−33 %** (rouge, bleu). Le seuil d'alarme se règle selon l'émetteur ou le diffuseur.\n\nIl ne sert que si l'image doit encore sortir en composite analogique ; sinon, le diamant suffit.",
    car: 'Tuile Arrowhead (PAL).',
    fig: 'arrow', see: ['mire-75', 'diamant', 'gamut'], ref: 'Tektronix (arrowhead display)',
  },
  gamut: {
    t: 'Gamut', aka: 'légalité du signal, espace de couleurs', cat: V,
    short: 'L\'ensemble des valeurs qu\'un signal peut prendre sans sortir de ses limites. « Hors gamut » : une composante R, G, B (ou le composite) dépasse ce que la chaîne peut reproduire.',
    body: "Deux sens :\n- l'**espace de couleurs** : le triangle des couleurs représentables (BT.709 en HD, BT.2020 en UHD et HDR) ;\n- la **légalité du signal** : un signal YCbCr peut coder une couleur qui, reconvertie en RVB, donne une composante au-dessus de 100 % ou sous 0 %. Elle sera écrêtée plus loin, et la teinte changera.\n\nLimites courantes : EBU R 103 (2000) tolère R, G, B entre −5 et 105 %, la luminance entre −1 et 103 %, et de petites excursions sur moins de 1 % de l'image. Les versions suivantes sont un peu plus tolérantes.\n\nOutils : diamant (RVB), arrowhead (composite), image avec alerte gamut, CIE 1931 (espace de couleurs).",
    car: 'Tuile Image, bouton Gamut : les points hors limites clignotent en magenta. Préréglage « Gamut » du PRISM.',
    see: ['diamant', 'split-diamant', 'arrowhead', 'cie1931', 'mv-pct'], ref: 'EBU R 103 ; ITU-R BT.709, BT.2020',
  },
  cie1931: {
    t: 'Diagramme CIE 1931', aka: 'diagramme de chromaticité xy', cat: V,
    short: 'La carte de toutes les couleurs visibles (le « fer à cheval ») : on y place les couleurs de l\'image et les triangles des espaces BT.709 et BT.2020.',
    body: "Chaque couleur y est réduite à sa chromaticité (x, y), sans sa luminance. Le bord courbe porte les couleurs pures de l'arc-en-ciel (de 380 à 700 nm), la droite du bas les pourpres.\n\n- **BT.709** (HD) : R (0,640 ; 0,330), G (0,300 ; 0,600), B (0,150 ; 0,060) ;\n- **BT.2020** (UHD, HDR) : R (0,708 ; 0,292), G (0,170 ; 0,797), B (0,131 ; 0,046) ;\n- blanc **D65** : (0,3127 ; 0,3290).\n\nEn production HDR (HLG, BT.2100), le signal est en BT.2020 : le diagramme montre si des couleurs dépassent BT.709, ce qui posera problème à la conversion vers la version SDR. Le calcul : signal → lumière (courbe inverse), puis R, G, B → X, Y, Z, puis x = X / (X + Y + Z).",
    car: 'Tuile CIE 1931 ; sur l\'entrée HDR HLG du poste vision, les points se lisent en BT.2020.',
    fig: 'cie', see: ['gamut', 'hdr-hlg'], ref: 'CIE 1931 ; ITU-R BT.709, BT.2020, BT.2100',
  },
  'hdr-hlg': {
    t: 'HLG : niveaux de référence', aka: 'Hybrid Log-Gamma, ITU-R BT.2100', cat: V,
    short: 'En HDR HLG, le blanc de référence se pose vers 75 % du signal et un gris à 18 % vers 38 %. Au-dessus de 75 % : la place des hautes lumières.',
    body: "La courbe HLG est une courbe gamma pour les basses lumières et logarithmique pour les hautes : elle garde du détail dans le ciel, les maillots au soleil, les projecteurs. Elle s'affiche correctement sur un écran HDR et passablement sur un écran SDR.\n\nRepères (rapport ITU-R BT.2408) :\n- **blanc de référence** (papier blanc bien éclairé, graphismes) : **75 %**, soit environ 203 cd/m² sur un écran de 1 000 cd/m² ;\n- **gris à 18 %** : **38 %**.\n\nEn direct, on règle souvent sur la sortie SDR et la HDR suit (production « single stream »).",
    car: 'Poste vision : Grade 1 en SDR | HDR et entrée « HDR HLG » du PRISM ; le waveform trace la ligne du blanc de référence à 75 %.',
    see: ['waveform', 'cie1931'], ref: 'ITU-R BT.2100 ; rapport ITU-R BT.2408',
  },
  histogramme: {
    t: 'Histogramme', cat: V,
    short: 'Le nombre de points de l\'image à chaque niveau, de 0 à 109 %. Un tas collé à droite : blancs écrêtés ; collé à gauche : noirs bouchés.',
    body: "Pratique pour juger d'un coup d'œil la répartition des niveaux, mais il ne dit pas **où** sont ces points dans l'image : le waveform reste l'outil de l'ingénieur vision. La hauteur est ici en racine du nombre de points, pour voir aussi les petites zones.",
    car: 'Tuile Histogramme (R, V et B superposés).',
    see: ['waveform'],
  },
  // ================= Couche physique SDI =================
  oeil: {
    t: 'Diagramme de l\'œil', aka: 'eye pattern', cat: P,
    short: 'Des milliers de bits du signal SDI superposés sur une ou deux périodes : plus l\'« œil » est ouvert au centre, plus le récepteur distingue les 0 des 1.',
    body: "L'instrument récupère l'horloge du signal et dessine chaque bit par-dessus les précédents. Les transitions se croisent sur les côtés ; au milieu reste un espace vide en forme d'œil.\n\nCe qu'on y lit :\n- l'**amplitude** (800 mV ± 10 %) ;\n- les **temps de montée et de descente** ;\n- le **dépassement** après chaque front ;\n- la **gigue** : l'épaisseur des croisements ;\n- l'**ouverture** verticale au centre.\n\nLa norme définit l'œil à la sortie de l'émetteur, avec 1 m de câble. Plus loin, l'œil **brut** se ferme (après quelques dizaines de mètres en 3G, c'est normal) : l'égaliseur du récepteur le rouvre. L'œil **égalisé** montre ce que lit vraiment le récepteur.\n\nCe qui ferme l'œil : l'affaiblissement du câble, les réflexions (connecteur abîmé, pièce en 50 Ω, câble écrasé), le bruit, la gigue.",
    car: 'Baie de mesure, préréglage « Couche physique » : tuile Diagramme de l\'œil, boutons Brut / Égalisé, mesures à côté de la trace.',
    fig: 'oeil', see: ['amplitude-sdi', 'temps-montee', 'overshoot', 'gigue-alignement', 'egaliseur'], ref: 'SMPTE ST 292-1, ST 424, ST 2082-1 ; RP 184',
  },
  'amplitude-sdi': {
    t: 'Amplitude (SDI)', cat: P,
    short: 'La hauteur du signal SDI entre le niveau du 0 et celui du 1 : 800 mV ± 10 % (720 à 880 mV) à la sortie d\'un émetteur, pour toutes les versions du SDI.',
    body: "Mesurée au centre de l'œil, entre les niveaux haut et bas. Le décalage continu (DC offset) doit rester à 0 V ± 0,5 V.\n\nUne amplitude anormale trahit souvent une **terminaison** : la sortie de 75 Ω prévue pour une charge de 75 Ω donne environ 1,6 V à vide (entrée bouclée non terminée) et environ 530 mV sur deux charges en parallèle (double terminaison).\n\nAprès un long câble, l'amplitude mesurée baisse : l'instrument estime alors le niveau de la source d'après son égaliseur.",
    car: 'Tuile Diagramme de l\'œil (ligne Amplitude) et tuile État SDI (Niveau source).',
    see: ['oeil', 'temps-montee', 'affaiblissement'], ref: 'SMPTE ST 292-1, ST 424, ST 2082-1',
  },
  'temps-montee': {
    t: 'Temps de montée et de descente', aka: 'rise time, fall time', cat: P,
    short: 'Le temps que met le signal pour passer de 20 % à 80 % de son amplitude (montée), ou l\'inverse. Plus le débit est élevé, plus il doit être court.',
    body: "Limites à la sortie de l'émetteur :\n- HD-SDI (1,485 Gb/s) : **≤ 270 ps**, écart montée / descente ≤ 100 ps ;\n- 3G-SDI (2,97 Gb/s) : **≤ 135 ps**, écart ≤ 50 ps ;\n- 12G-SDI (11,88 Gb/s) : **≤ 45 ps**, écart ≤ 18 ps.\n\nUn câble long arrondit les fronts (il atténue les hautes fréquences) : c'est pourquoi on qualifie un émetteur avec un cordon court. Un écart entre montée et descente déforme l'œil et fait varier la tension moyenne.",
    car: 'Lignes Montée, Descente et Écart de la tuile Diagramme de l\'œil, comparées aux limites du format du car.',
    see: ['oeil', 'ui', 'overshoot'], ref: 'SMPTE ST 292-1, ST 424, ST 2082-1',
  },
  overshoot: {
    t: 'Dépassement', aka: 'overshoot', cat: P,
    short: 'La pointe qui dépasse le niveau haut (ou bas) juste après un front. Limite : 10 % de l\'amplitude. Trop de dépassement trahit une rupture d\'impédance.',
    body: "Le SDI est prévu pour 75 Ω de bout en bout. Une **rupture d'impédance** renvoie une partie du signal (réflexion) qui s'ajoute aux fronts suivants : dépassement, petites oscillations, œil qui se ferme.\n\nCauses classiques : connecteur BNC mal serti ou desserré, BNC 50 Ω, câble écrasé ou plié trop serré, terminaison de 75 Ω absente, embase fatiguée.\n\nRemède : remplacer le cordon ou le connecteur, vérifier les terminaisons.",
    car: 'Panne « cordon abîmé » : à la baie de mesure, le dépassement de la sortie CCU passe au-dessus de 10 %.',
    see: ['oeil', 'amplitude-sdi', 'affaiblissement'], ref: 'SMPTE ST 292-1, ST 424',
  },
  'gigue-timing': {
    t: 'Gigue de timing', aka: 'timing jitter', cat: P,
    short: 'Toute la variation de position des fronts par rapport à une horloge parfaite, au-dessus de 10 Hz. Limite : 1 UI en HD-SDI, 2 UI en 3G, 8 UI en 12G.',
    body: "On la mesure avec un filtre passe-haut à **10 Hz** (méthode de SMPTE RP 184) : elle comprend la gigue lente, celle qu'un récepteur suit sans erreur. Une forte gigue de timing ne fait donc pas forcément d'erreurs, mais elle gêne les appareils qui doivent reproduire l'horloge du signal (synchroniseurs, convertisseurs, désembedders audio) et elle s'accumule le long d'une chaîne de répéteurs.\n\nL'instrument l'affiche en UI (la durée d'un bit) et en ps, et trace la gigue démodulée en fonction du temps.",
    car: 'Tuile Gigue, filtre « Timing ».',
    see: ['gigue-alignement', 'ui', 'oeil'], ref: 'SMPTE RP 184, RP 192 ; ST 292-1, ST 424, ST 2082-1',
  },
  'gigue-alignement': {
    t: 'Gigue d\'alignement', aka: 'alignment jitter', cat: P,
    short: 'La partie rapide de la gigue (au-dessus de 100 kHz en HD et 3G), que la récupération d\'horloge du récepteur ne suit pas. Limite : 0,2 UI en HD-SDI, 0,3 UI en 3G et 12G.',
    body: "C'est elle qui ferme l'œil horizontalement et provoque les erreurs : le récepteur échantillonne chaque bit à l'instant donné par son horloge récupérée, et un front qui arrive trop tôt ou trop tard est lu de travers.\n\nCauses : bruit et diaphonie, interférence entre symboles laissée par un câble long, réflexions, alimentation bruyante. En 12G-SDI, la norme recommande de viser 0,2 UI ou mieux.",
    car: 'Tuile Gigue, filtre « Alignement », et ligne Gigue align. de la tuile Diagramme de l\'œil. Elle monte quand une liaison se dégrade.',
    see: ['gigue-timing', 'oeil', 'ui'], ref: 'SMPTE RP 184 ; ST 292-1, ST 424, ST 2082-1',
  },
  ui: {
    t: 'UI (intervalle unitaire)', aka: 'unit interval', cat: P,
    short: 'La durée d\'un bit : 673,4 ps en HD-SDI (1,485 Gb/s), 336,7 ps en 3G-SDI, 84,2 ps en 12G-SDI. La gigue se mesure en UI.',
    body: "UI = 1 / débit. Exprimer la gigue en UI rend les limites comparables d'un débit à l'autre :\n- 0,2 UI en HD-SDI = environ 135 ps ;\n- 0,3 UI en 3G-SDI = environ 101 ps ;\n- 0,3 UI en 12G-SDI = environ 25 ps.\n\nEn 12G, un quart de nanoseconde suffit donc à sortir des clous.",
    car: 'Échelle horizontale du diagramme de l\'œil (2 UI) et valeurs de la tuile Gigue.',
    see: ['gigue-timing', 'gigue-alignement', 'oeil'], ref: 'SMPTE RP 184',
  },
  'crc-edh': {
    t: 'CRC et EDH', aka: 'contrôles d\'erreurs du SDI', cat: P,
    short: 'Des sommes de contrôle transportées dans le signal : le récepteur les recalcule, une différence signale des données reçues fausses. CRC par ligne en HD et au-delà, EDH par trame en SD.',
    body: "- En **HD-SDI** et au-delà (ST 292-1, puis 3G et 12G) : après chaque fin de ligne active (EAV), deux mots de **CRC**, calculés séparément pour la luminance (Y) et la couleur (C). Le récepteur compte les lignes en erreur.\n- En **SD-SDI** : l'**EDH** (SMPTE RP 165) porte deux CRC par trame (image active et trame complète) et des drapeaux qui aident à trouver le maillon fautif dans une chaîne.\n\nPendant une émission, le seul bon compte est **zéro**. Quelques erreurs par minute : la liaison est au bord de la falaise. On remet les compteurs à zéro avant chaque essai.",
    car: 'Tuile État SDI : CRC Y / C, secondes en erreur, bouton « Compteurs à zéro ». Liseré rouge sur le point de mesure en erreur.',
    see: ['effet-falaise', 'oeil', 'egaliseur'], ref: 'SMPTE ST 292-1 ; SMPTE RP 165 (EDH)',
  },
  affaiblissement: {
    t: 'Affaiblissement et longueur de câble', aka: 'cable loss', cat: P,
    short: 'Un coaxial atténue d\'autant plus que la fréquence est haute et le câble long. L\'instrument mesure cet affaiblissement et en déduit la longueur, pour un type de câble donné.',
    body: "On compte l'affaiblissement à la **moitié de la fréquence d'horloge** : 742,5 MHz en HD-SDI, 1,485 GHz en 3G, 5,94 GHz en 12G.\n\nCâble Belden 1694A (type RG6, fiche technique) : environ **17,7 dB/100 m** à 750 MHz, **25,6** à 1,5 GHz, **58** à 6 GHz.\n\nLes normes demandent aux récepteurs d'accepter au moins **20 dB** (HD, 3G) ou **40 dB** (6G, 12G) : soit environ 113 m de 1694A en HD-SDI, 78 m en 3G, 69 m en 12G. Les égaliseurs actuels font mieux, sans garantie.\n\nL'instrument lit le réglage de son égaliseur et le convertit en mètres pour le câble choisi : avec un câble plus fin (type RG59), la vraie longueur est plus courte que l'estimation. Chaque connecteur et chaque passage par une baie de brassage ajoutent un peu de perte.",
    car: 'Tuile État SDI et panneau « Liaison mesurée » de la baie de mesure. Panne « touret » : plus de 100 m de câble en 3G, juste au bout de l\'égaliseur.',
    fig: 'cable', see: ['egaliseur', 'effet-falaise', 'oeil'], ref: 'SMPTE ST 292-1, ST 424, ST 2082-1 ; fiche technique Belden 1694A',
  },
  egaliseur: {
    t: 'Égaliseur adaptatif', aka: 'adaptive cable equalizer', cat: P,
    short: 'Le circuit d\'entrée de chaque récepteur SDI qui compense l\'affaiblissement du câble en remontant les hautes fréquences : il rouvre l\'œil, jusqu\'à sa limite.',
    body: "Il s'adapte tout seul à la longueur du câble. Mais en remontant les hautes fréquences il remonte aussi le bruit : plus le câble est long, plus l'œil égalisé est petit.\n\nLa **marge** est l'écart entre ce que l'égaliseur sait compenser et l'affaiblissement mesuré. Avec plusieurs dB de marge, aucune erreur ; près de zéro, quelques erreurs CRC ; au-delà, le récepteur perd le signal.\n\nPour aller plus loin qu'un égaliseur, on insère un **répéteur** (reclocker) au milieu de la liaison, ou on passe en fibre.",
    car: 'Ligne « Marge égaliseur » de la tuile État SDI ; œil égalisé de la tuile Diagramme de l\'œil.',
    see: ['affaiblissement', 'effet-falaise', 'reclocker'],
  },
  'effet-falaise': {
    t: 'Effet de falaise', aka: 'cliff effect', cat: P,
    short: 'En numérique, l\'image reste parfaite… jusqu\'à ce qu\'elle s\'effondre d\'un coup. Entre les deux, une zone étroite où seules les erreurs CRC trahissent le problème.',
    body: "En analogique, un câble trop long dégrade l'image peu à peu (bruit, flou) : on le voit venir. En numérique, chaque bit est lu juste tant que l'œil reste ouvert : l'image est parfaite. Puis, sur quelques dB (quelques mètres de câble), le taux d'erreurs grimpe de plusieurs ordres de grandeur : points blancs, lignes noires, puis plus d'image du tout.\n\nLe réflexe : surveiller les CRC, mesurer la marge, et garder plusieurs dB de réserve sur chaque liaison avant le direct.",
    car: 'Panne « cordon abîmé » : l\'œil se ferme, la gigue monte, quelques CRC… puis la caméra disparaît du multiview.',
    fig: 'falaise', see: ['crc-edh', 'egaliseur', 'affaiblissement'],
  },
  'timing-ref': {
    t: 'Timing par rapport à la référence', aka: 'timing display', cat: P,
    short: 'Où arrive une source par rapport à la référence du car (black burst ou tri-level) : décalage vertical en lignes, horizontal en µs. Au centre : la source est à l\'heure.',
    body: "Un mélangeur ne commute proprement qu'entre sources synchrones : même début d'image, même début de ligne. Les CCU, les serveurs, le mélangeur se verrouillent sur la référence du SPG (**genlock**) ; les petits écarts restants sont absorbés par la fenêtre d'entrée du mélangeur ou par des synchroniseurs.\n\nL'affichage Timing compare l'entrée à la référence et place un point sur une croix : à droite = en retard, à gauche = en avance, en bas ou en haut = décalage de lignes. Un point qui **dérive** sans arrêt : la source n'est pas verrouillée.\n\nRepères : une ligne dure 17,8 µs en 1080p50, 35,6 µs en 1080i50.",
    car: 'Tuile Timing de la baie de mesure. La panne « perte de référence » d\'une CCU fait dériver son point.',
    fig: 'timing', see: ['gigue-timing', 'vpid'], ref: 'SMPTE ST 318 (black burst) ; ST 274 (tri-level)',
  },
  reclocker: {
    t: 'Répéteur (reclocker)', aka: 'réhorlogeur, distributeur avec régénération', cat: P,
    short: 'Un appareil qui égalise un signal SDI fatigué, le réhorloge et le renvoie propre : on en place un pour allonger une liaison coaxiale.',
    body: "Il fait trois choses : égaliser le câble d'entrée, relire les bits avec une horloge propre (ce qui retire la gigue d'alignement), et renvoyer un signal neuf de 800 mV aux fronts raides. Les distributeurs (DA) et les grilles réhorlogent souvent leurs sorties.\n\nLimite : il lui faut un signal lisible à l'entrée. Il ne répare ni un connecteur abîmé en amont, ni des erreurs déjà présentes, et il laisse passer la gigue lente.",
    car: 'Bouton « Insérer un répéteur (reclocker) » de la baie de mesure : il sauve une liaison trop longue, pas un cordon abîmé.',
    see: ['egaliseur', 'affaiblissement', 'gigue-alignement'],
  },
  vpid: {
    t: 'Identifiant de charge utile (ST 352)', aka: 'VPID, payload identifier', cat: P,
    short: 'Un petit paquet de données dans le signal SDI qui annonce le format transporté (lignes, images par seconde, échantillonnage, colorimétrie). L\'instrument l\'affiche.',
    body: "Il permet aux récepteurs de se configurer seuls : 1080p50 ou 1080i50, niveau A ou B du 3G, 4:2:2 10 bits, SDR ou HDR. Un identifiant faux (par exemple une source HDR annoncée SDR) fait mal afficher l'image par l'appareil suivant, sans que le signal soit en erreur.",
    car: 'Ligne Format de la tuile État SDI.',
    see: ['crc-edh', 'timing-ref'], ref: 'SMPTE ST 352',
  },
};
Object.assign(TERMS, ADD);

// intitulés de l'interface → fiche (en tête de liste : plus précis que les motifs du poste Réseau IP)
TERM_PATTERNS.unshift(
  [/^gigue d.alignement|^gigue align/i, 'gigue-alignement'], [/^gigue de timing/i, 'gigue-timing'], [/^erreurs? crc|^crc\b/i, 'crc-edh'],
  [/^affaiblissement|^longueur estim/i, 'affaiblissement'], [/^marge (de l.)?égaliseur/i, 'egaliseur'], [/^diagramme de l.œil/i, 'oeil'],
  [/^dépassement$/i, 'overshoot'], [/^amplitude$/i, 'amplitude-sdi'], [/^vecteurscope/i, 'vecteurscope'], [/^parade rvb/i, 'parade-rvb'],
  [/^split diamant/i, 'split-diamant'], [/^timing par rapport/i, 'timing-ref'],
);
