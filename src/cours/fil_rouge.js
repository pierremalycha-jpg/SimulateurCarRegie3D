// @ts-check
// ----------------------------------------------------------------------------------
// Le fil rouge du Cours (v19.30) : une histoire qui relie les leçons. Un samedi, le RC Lens reçoit à
// Bollaert ; on suit une image et un son du match, de la lumière du stade jusqu'à l'écran du téléspectateur.
// Le parcours fait quatre fois ce chemin, un tour par niveau (cours/parcours.js : Débutant, Intermédiaire,
// Avancé, Expert) : le premier pose les mots et les ordres de grandeur, le deuxième fait régler et calculer, le
// troisième entre dans le détail, le dernier traite le car IP et les cas difficiles. Chaque tour passe par les
// chapitres dans l'ordre de la chaîne (une étape par chapitre, ses leçons de ce niveau) ; le premier commence
// par l'arrivée au car (l'intercom et le schéma d'ensemble), les suivants finissent par l'exploitation (envoyer
// le match, le livrer, le recetter). La leçon conseillée (parcours.js : suivante) suit ce fil. Une étape sans
// leçon à ce niveau est sautée. Données seules : l'affichage est dans ui/cours_parcours.js.
// ----------------------------------------------------------------------------------
/** @typedef {{ chapitre: string, titre: string, recit: string }} Etape */
/** @typedef {{ niveau: 'debutant' | 'intermediaire' | 'avance' | 'expert', titre: string, but: string, etapes: Etape[] }} Tour */

export const HISTOIRE = {
  titre: 'Le fil rouge : un samedi à Bollaert',
  intro: 'Samedi soir, le RC Lens reçoit à Bollaert-Delelis, en direct. Vous entrez dans l\'équipe du car régie. Le fil rouge suit une image et un son du match, de la lumière du stade jusqu\'à l\'écran du téléspectateur ; chaque tour refait le chemin, un cran plus loin.',
};

/** l'ordre de la chaîne, de la lumière à l'antenne (les tours 2 à 4) */
const CHAINE = ['lumiere', 'camera', 'signal', 'sdi', 'synchro', 'son', 'realisation', 'ralentis', 'reseau', 'hf', 'exploitation'];
/** les récits de chaque étape, tour par tour : [titre, récit] */
const RECITS = {
  debutant: {
    exploitation: ['Arriver au car', 'Le matin du match, le car est garé au compound. Avant de toucher un câble, on regarde le chemin du signal, du stade au téléspectateur : qui parle à qui, et le schéma qui relie tout.'],
    lumiere: ['La lumière du stade', 'Tout commence par de la lumière : celle des projecteurs du stade et du plateau. Combien il en faut, de quelle couleur, et comment on la commande.'],
    camera: ['La caméra capte l\'image', 'La lumière entre dans l\'objectif. La caméra la transforme en signal, que le câble de la caméra emmène jusqu\'au car.'],
    signal: ['L\'image devient un signal', 'Dans la caméra, l\'image devient des nombres : un format, une cadence, des bits, de la couleur. On apprend à les compter.'],
    sdi: ['Le signal voyage dans le car', 'Ces nombres partent dans un câble coaxial, le SDI, jusqu\'à la grille et au mélangeur. On apprend ses débits et ses connecteurs.'],
    synchro: ['Tout le monde au même rythme', 'Pour couper d\'une caméra à l\'autre, tout doit battre au même rythme, et chaque image porte son heure : le timecode.'],
    son: ['Le son du match', 'Pendant ce temps, les micros captent la foule et les commentateurs. On apprend ce qu\'est un son, le décibel, les micros et la tranche de console.'],
    realisation: ['Fabriquer le programme', 'Au mélangeur, le réalisateur choisit l\'image qui part à l\'antenne. On apprend les touches et le langage du direct.'],
    ralentis: ['Revoir l\'action', 'But ! Le serveur a tout enregistré : on revoit l\'action au ralenti, sous plusieurs angles.'],
    reseau: ['Le réseau du car', 'Les appareils du car se parlent sur un réseau : des câbles Ethernet, des commutateurs, des adresses.'],
    hf: ['Sans fil, au bord du terrain', 'La caméra portable suit le jeu le long de la ligne de touche : son image passe par les ondes.'],
  },
  intermediaire: {
    lumiere: ['Régler la lumière', 'Le plateau du bord de terrain s\'installe : la distance et l\'angle des projecteurs, leur couleur, la ligne DMX et la console.'],
    camera: ['Monter et régler la caméra', 'On monte les caméras du stade, on règle le point et la profondeur de champ.'],
    signal: ['Un signal juste et léger', 'Les niveaux doivent tomber juste, et l\'image se compresse pour voyager : on mesure, on calcule les débits.'],
    sdi: ['Aiguiller les signaux', 'La grille aiguille chaque source ; le son voyage dans le même câble que l\'image.'],
    synchro: ['Verrouiller la synchro', 'Le générateur de synchro donne la mesure : chaque appareil se verrouille dessus, le genlock.'],
    son: ['Mixer le match', 'Couples stéréo, liaisons, compresseur, N-1 des commentateurs : on fabrique un son propre et on le renvoie à chacun.'],
    realisation: ['Habiller l\'image', 'Le score, le nom du buteur : les incrustations se posent sur l\'image.'],
    ralentis: ['Ranger les actions', 'Les ralentis se gardent en clips, se nomment et s\'enchaînent en playlists pour la mi-temps.'],
    reseau: ['Organiser le réseau', 'VLAN, plans d\'adresses, passerelle, DHCP, TCP ou UDP : on organise le réseau du car.'],
    hf: ['Faire tenir la liaison', 'On calcule le bilan de la liaison HF : la puissance, les pertes, la marge.'],
    exploitation: ['Préparer le direct', 'Line-up des caméras, énergie, transmission, nodal, méthode de dépannage : tout est prêt pour l\'antenne.'],
  },
  avance: {
    lumiere: ['Mesurer, piloter', 'On mesure la lumière pour exposer juste, on pilote des lyres.'],
    camera: ['Le détail de la caméra', 'La fibre, le capteur, le réglage fin de l\'image : ce qui fait une belle image de stade.'],
    signal: ['La couleur et le HDR', 'Espaces de couleur, HDR : l\'image du stade garde ses couleurs jusqu\'au téléviseur.'],
    sdi: ['Quand le signal souffre', 'Câbles trop longs, falaise numérique, diagramme de l\'œil : on comprend pourquoi l\'image tombe d\'un coup.'],
    synchro: ['Mettre en phase', 'Chaque source arrive avec son retard : on les met en phase au mélangeur.'],
    son: ['Livrer un son conforme', 'Loudness, crête vraie, audio numérique : le son part à la norme.'],
    realisation: ['Réaliser au plus juste', 'Les cas plus fins de la réalisation.'],
    ralentis: ['Le ralenti avancé', 'Les cas plus fins des ralentis.'],
    reseau: ['Le réseau en détail', 'NAT, streaming, multicast, mesures, QoS, PTP : le réseau qui transporte du temps réel.'],
    hf: ['La HF qui tient', 'Le COFDM : pourquoi la caméra HF tient dans un stade plein de reflets.'],
    exploitation: ['Livrer et recetter', 'Monter une régie, conformer le PAD, recetter le car : le travail ne s\'arrête pas au coup de sifflet.'],
  },
  expert: {
    lumiere: ['La lumière, à grande échelle', 'Éclairer un stade entier pour la télévision, et commander la lumière sur le réseau.'],
    camera: ['La caméra, cas difficiles', 'Les cas difficiles de la caméra.'],
    signal: ['Le signal, cas difficiles', 'Les cas difficiles du signal.'],
    sdi: ['Du mot au bit', 'Ce que le câble transporte vraiment : l\'embrouillage, le NRZI, l\'horloge retrouvée.'],
    synchro: ['La synchro, cas difficiles', 'Les cas difficiles de la synchro.'],
    son: ['Le son, cas difficiles', 'Les cas difficiles du son.'],
    realisation: ['La réalisation, cas difficiles', 'Les cas difficiles de la réalisation.'],
    ralentis: ['Les ralentis, cas difficiles', 'Les cas difficiles des ralentis.'],
    reseau: ['Le car IP', 'ST 2110, rythme d\'envoi, rouge et bleu, spine-leaf, NMOS : le car tout en IP.'],
    hf: ['La HF, cas difficiles', 'Les cas difficiles de la HF.'],
    exploitation: ['Le jour de match', 'La vacation entière, de 8 h à l\'antenne : tout ce que vous avez appris, dans l\'ordre du jour J.'],
  },
};
const TITRES = {
  debutant: ['Premier tour : de la lumière à l\'écran', 'Les mots, les appareils, les ordres de grandeur : on reconnaît ce que l\'on voit dans le car.'],
  intermediaire: ['Deuxième tour : se servir des notions', 'Le même chemin, un cran plus loin : on règle, on calcule, on choisit.'],
  avance: ['Troisième tour : comprendre le détail', 'On entre dans le détail : pourquoi ça marche, et pourquoi ça tombe.'],
  expert: ['Quatrième tour : le car IP et les cas difficiles', 'Le car tout en IP, et les situations où tout se joue.'],
};
const ordre = (/** @type {string} */ niveau) => (niveau === 'debutant' ? ['exploitation', ...CHAINE.filter((c) => c !== 'exploitation')] : CHAINE);

/** @type {Tour[]} */
export const TOURS = /** @type {const} */ (['debutant', 'intermediaire', 'avance', 'expert']).map((niveau) => ({
  niveau, titre: TITRES[niveau][0], but: TITRES[niveau][1],
  etapes: ordre(niveau).map((chapitre) => ({ chapitre, titre: RECITS[niveau][chapitre][0], recit: RECITS[niveau][chapitre][1] })),
}));

/**
 * Les étapes du fil, tour après tour, qui ont des leçons (lecons : la fonction qui donne les leçons d'un chapitre à
 * un niveau, celle de parcours.js) ; un chapitre absent du fil vient à la fin de chaque tour.
 * @param {(chapitre: string, niveau: string) => string[]} lecons
 * @param {string[]} [chapitres] tous les chapitres (dans l'ordre du sommaire)
 * @returns {{ tour: Tour, t: number, etape: Etape, e: number, n: number, lecons: string[] }[]} e : rang de l'étape dans son tour (à partir de 0) ; n : étapes du tour
 */
export function etapesDuFil(lecons, chapitres = CHAINE) {
  const out = [];
  TOURS.forEach((tour, t) => {
    const reste = chapitres.filter((c) => !tour.etapes.some((x) => x.chapitre === c)).map((chapitre) => ({ chapitre, titre: chapitre, recit: '' }));
    const liste = [...tour.etapes, ...reste].map((etape) => ({ etape, lecons: lecons(etape.chapitre, tour.niveau) })).filter((x) => x.lecons.length);
    liste.forEach((x, e) => out.push({ tour, t, etape: x.etape, e, n: liste.length, lecons: x.lecons }));
  });
  return out;
}
