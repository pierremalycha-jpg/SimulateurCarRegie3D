// @ts-check
import { el } from '../util.js';
import { labSdi } from './lab_sdi.js';
import { COURS_FIGS } from './figs_sdi.js';

// ----------------------------------------------------------------------------------
// Leçon « La falaise numérique » du chapitre SDI, reprise de la maquette de la section Cours :
// ce qu'un câble SDI transporte, pourquoi sa longueur est limitée, et la falaise : l'image est
// parfaite, puis elle casse en quelques mètres. Valeurs : débits SMPTE ST 259 (270 Mb/s), ST 292-1
// (1,485 Gb/s), ST 424 (2,97 Gb/s), ST 2082-1 (11,88 Gb/s) ; 800 mV crête à crête sur 75 Ω ;
// embrouillage x^9 + x^4 + 1 puis NRZI ; EAV / SAV, numéro de ligne et CRC en HD ; audio embeddé
// ST 299-1 (16 canaux) ; payload ID ST 352. Les portées sont celles du simulateur (data/cameras.js,
// LINKS.coax), pour que le cours et le car disent la même chose.
// ----------------------------------------------------------------------------------
/** @type {import('./index.js').Lesson} */
export const FALAISE = {
  id: 'sdi-falaise', title: 'La falaise numérique', minutes: '8 min',
  essentials: [
    'Un câble SDI transporte l\'image **non compressée**, le son embeddé et le timecode, bit après bit, sur un coaxial de 75 Ω.',
    'Le câble affaiblit les fréquences hautes : plus le débit est élevé (HD 1,485 ; 3G 2,97 ; 12G 11,88 Gb/s), plus la portée est courte.',
    'En numérique, c\'est tout ou rien : l\'image est parfaite, puis des erreurs invisibles, puis des étincelles, puis plus rien, en quelques mètres. On garde toujours de la marge.',
  ],
  figure: () => el('div', { class: 'co-figwrap', html: COURS_FIGS.sdi() }),
  demoTitle: 'allongez le câble jusqu\'à perdre l\'image, en HD-SDI puis en 12G-SDI, avec et sans égaliseur : regardez l\'œil se fermer et le compteur d\'erreurs.',
  demo: (host) => ({ destroy: labSdi(host) }),
  body: `**Ce que transporte un câble SDI.** Le SDI envoie l'image en série : les bits passent l'un après l'autre sur un seul conducteur, ce qui demande un débit très élevé. L'image n'est pas compressée. Chaque pixel est décrit par sa luminance (Y) et ses différences de couleur (Cb, Cr), en 4:2:2 sur 10 bits.

Entre deux lignes d'image, dans la suppression, le signal transporte des données annexes : le son embeddé (16 canaux en HD-SDI), le timecode et l'identifiant du format.

**Un débit par format.**
- SD-SDI : 270 Mb/s, la définition standard d'avant ;
- HD-SDI : 1,485 Gb/s, le 1080i50 ;
- 3G-SDI : 2,97 Gb/s, le 1080p50 ;
- 12G-SDI : 11,88 Gb/s, l'UHD 2160p50 (ou quatre câbles 3G, le quad-link).

**Pourquoi la longueur est limitée.** Un câble coaxial affaiblit davantage les fréquences hautes, et d'autant plus qu'il est long. Plus le débit est élevé, plus ces fréquences sont hautes : la portée diminue. À l'arrivée, un **égaliseur** remonte les aigus pour rouvrir l'œil, jusqu'à ce que le bruit l'emporte.

**La falaise numérique.** Tant que le récepteur distingue les 0 des 1, l'image est parfaite. Juste avant la limite, des erreurs apparaissent sans se voir, puis des étincelles, puis plus rien, en quelques mètres. En analogique, l'image se dégradait peu à peu ; en numérique, c'est tout ou rien : on garde toujours de la marge.

**Une liaison point à point.** Un câble SDI relie une sortie à une seule entrée, dans un seul sens. Pour envoyer une source à plusieurs endroits, on passe par un distributeur (DA) ou par la grille. Les connecteurs : BNC 75 Ω, ou HD-BNC et DIN 1.0/2.3 sur les appareils très denses.`,
  plus: `- **Pas de fil d'horloge.** Le flux est embrouillé (polynôme x⁹ + x⁴ + 1) puis codé en NRZI. Il y a ainsi assez de transitions pour que le récepteur reconstitue l'horloge à partir du signal lui-même.
- **Des repères dans chaque ligne.** Chaque ligne contient deux repères : l'EAV marque la fin de l'image active, le SAV le début de la suivante. Ce sont des mots réservés que l'image ne peut jamais contenir.
- **Un contrôle par ligne.** En HD, chaque ligne porte son numéro et un CRC. L'analyseur (le PRISM du car) compte les lignes en erreur bien avant qu'on voie quoi que ce soit.
- **Un format annoncé.** Le payload ID (SMPTE ST 352) dit au récepteur ce qu'il reçoit : 1080i50, 1080p50, 2160p50…
- **Le niveau.** 800 mV crête à crête sur 75 Ω à la sortie. Un T BNC qui partage un câble casse l'impédance : réflexions, œil fermé.
- **L'UHD en quad-link.** Quatre câbles 3G portent chacun un quart de l'image : quatre carrés (square division), ou quatre images entières en HD entrelacées point par point (2SI), lisibles sur un moniteur HD.
- **La gigue.** Si la position des transitions varie trop, l'œil se ferme aussi sur les côtés : le récepteur ne sait plus quand lire le bit.`,
  car: { text: 'Dans le car SDI, presque tout arrive à la grille par des câbles coaxiaux : sorties des CCU, serveurs EVS, habillage, duplex. À la baie de brassage, un cordon oublié ou croisé se voit tout de suite au multiview ; à la baie de mesure, le PRISM montre l\'œil et compte les erreurs CRC. Dans le plan caméras, une liaison coaxiale trop longue est refusée.', station: 'mesure' },
  terms: ['oeil', 'effet-falaise', 'affaiblissement', 'egaliseur', 'crc-edh', 'vpid'],
  competences: ['2.2', '2.13', '3.9'], article: 'liaisons',
  quiz: [
    { q: 'Une caméra est reliée en 12G-SDI par 90 m de câble coaxial. Que voit-on au multiview ?',
      choices: [['Une image un peu plus sombre et moins nette.', 'C\'était le cas en analogique. En numérique, l\'image ne se dégrade pas peu à peu : elle est parfaite, ou elle casse.'],
        ['Rien, ou une image qui étincelle : on dépasse la portée du 12G-SDI (environ 70 m).', 'À 90 m, le récepteur ne distingue plus les 0 des 1. C\'est la falaise numérique.'],
        ['Une image parfaite : la longueur ne compte pas en numérique.', 'Le câble affaiblit les fréquences hautes. Plus le débit est élevé, plus la portée est courte, même en numérique.']],
      answer: 1, why: 'À 90 m, le récepteur ne distingue plus les 0 des 1 : c\'est la falaise numérique.' },
    { q: 'Pourquoi le 12G-SDI porte-t-il moins loin que le HD-SDI ?',
      choices: [['Parce que l\'image UHD est compressée.', 'Non : le SDI transporte l\'image non compressée, en UHD comme en HD.'],
        ['Parce que son débit est huit fois plus élevé : le câble affaiblit davantage les fréquences hautes qu\'il utilise.', '11,88 Gb/s contre 1,485 Gb/s : l\'atténuation à la moitié de la fréquence d\'horloge est environ trois fois plus forte.'],
        ['Parce que les connecteurs BNC 12G sont plus petits.', 'Le connecteur doit être prévu pour le 12G, mais c\'est l\'affaiblissement du câble qui limite la portée.']],
      answer: 1, why: '11,88 Gb/s contre 1,485 Gb/s : l\'atténuation à la moitié de la fréquence d\'horloge est environ trois fois plus forte.' },
    { q: 'Le réalisateur veut la même caméra au mélangeur et sur l\'écran géant du stade. Que faites-vous ?',
      choices: [['Je mets un T BNC pour partager le câble entre les deux.', 'Un T casse l\'impédance de 75 Ω : réflexions et œil fermé. Une sortie SDI alimente une seule entrée.'],
        ['J\'augmente le niveau de sortie pour alimenter deux entrées.', 'Le niveau SDI est fixe (800 mV). Il ne se règle pas pour alimenter plusieurs entrées.'],
        ['Je passe par la grille ou par un distributeur (DA), qui recopie le signal vers les deux destinations.', 'La grille ou le DA régénère le signal et le recopie. Le SDI reste point à point.']],
      answer: 2, why: 'La grille ou le DA régénère le signal et le recopie : le SDI reste point à point.' },
    { q: 'Au PRISM, le compteur d\'erreurs CRC d\'une caméra en 3G grimpe, alors que son image est parfaite au multiview. Que faut-il en conclure ?',
      choices: [['Rien d\'urgent : tant que l\'image est parfaite, la liaison est bonne.', 'Juste avant la limite, les erreurs apparaissent sans se voir : ce sont elles que le PRISM compte. Quelques mètres de plus, et l\'image étincelle puis disparaît.'],
        'La liaison est au bord de la falaise : il faut retrouver de la marge avant le direct.',
        ['L\'image va se dégrader peu à peu : on la surveille au multiview.', 'C\'était le cas en analogique. En numérique, c\'est tout ou rien : l\'image reste parfaite, puis elle casse en quelques mètres.']],
      answer: 1, why: 'Le CRC de chaque ligne permet à l\'analyseur de compter les lignes en erreur bien avant qu\'on voie quoi que ce soit. Ces erreurs invisibles sont la première marche de la falaise : viennent ensuite les étincelles, puis plus rien. On retrouve de la marge (une liaison plus courte) avant le direct.' },
    { q: 'Un signal UHD arrive en quad-link 2SI. Pour un contrôle rapide, on branche un seul des quatre câbles 3G sur un moniteur HD. Que voit-on ?',
      choices: ['L\'image entière, en HD : chaque câble porte une image complète.',
        ['Un quart de l\'image : un des quatre carrés.', 'C\'est le cas en square division, où chaque câble porte un carré. En 2SI, les quatre câbles portent chacun une image entière en HD.'],
        ['Rien de lisible : il faut les quatre câbles pour former une image.', 'Il les faut pour retrouver l\'UHD, pas pour regarder : en 2SI, chaque câble est une image HD complète, lisible seule sur un moniteur HD.']],
      answer: 0, why: 'Le quad-link répartit l\'UHD sur quatre câbles 3G. En 2SI, chaque câble porte une image entière en HD, et les quatre sont entrelacées point par point : un seul suffit à un moniteur HD pour voir tout le cadre. En square division, on n\'aurait vu qu\'un carré.' },
  ],
};
