// @ts-check
// ----------------------------------------------------------------------------------
// Fiches « ? » de la compression vidéo (v19.26) : codec et conteneur, GOP (images I, P, B). Même format que
// content/netterms.js. Chiffres : cours/video_calc.js (ordres de grandeur dits comme tels).
// ----------------------------------------------------------------------------------
import { TERMS, CATS } from './netterms.js';

export const VIDEO_CAT = 'Signal vidéo';
if (!CATS.includes(VIDEO_CAT)) CATS.push(VIDEO_CAT);

/** @type {Record<string, import('./netterms.js').Term>} */
const ADD = {
  codec: {
    t: 'Codec et conteneur', aka: 'XDCAM HD422, AVC-Intra, ProRes, H.264, HEVC, JPEG XS, MXF, MP4', cat: VIDEO_CAT,
    short: 'Le codec compresse l\'image (intra dans l\'image, inter d\'une image à l\'autre) ; le conteneur (MXF, MP4, MOV, TS) l\'enveloppe avec le son et les métadonnées.',
    body: "Un **codec** (codeur-décodeur) décide ce qu'on garde de l'image : les détails fins arrondis (intra : DCT ou ondelettes, quantification, entropie), les blocs qui ne bougent pas d'une image à l'autre (inter : le GOP). Ordres de grandeur du car :\n- **XDCAM HD422** : MPEG-2 4:2:2, GOP long, **50 Mb/s**, le PAD et l'enregistrement ;\n- **AVC-Intra 100**, **ProRes 422 HQ** : tout intra, 10 bits, 100 à 350 Mb/s, le montage ;\n- **H.264** (AVC) et **HEVC** (H.265) de contribution : 10 à 25 Mb/s en GOP long, vers la chaîne ;\n- **JPEG XS** (ST 2110-22) : intra par lignes, 6:1 à 10:1, quelques lignes de latence ;\n- diffusion TNT : H.264 4:2:0 8 bits, 6 à 8 Mb/s.\n\nLe **conteneur** enveloppe l'essence : **MXF** OP1a (PAD), MP4 et MOV (fichiers), **TS** (transport). Profil et niveau fixent l'échantillonnage (4:2:2 ou 4:2:0), les bits et les limites de débit.",
    car: 'Le codeur de contribution au poste transmission, les clips et le PAD en XDCAM HD422 à l\'IPDirector, le JPEG XS du car IP.',
    see: ['gop', 'st2110-22'], ref: 'SMPTE ST 377 (MXF) ; ITU-T H.264, H.265 ; ISO/IEC 21122 (JPEG XS)',
  },
  gop: {
    t: 'GOP (images I, P, B)', aka: 'group of pictures, GOP long, tout intra', cat: VIDEO_CAT,
    short: 'Le groupe d\'images de la compression inter : une image I complète, puis des P prédites de la précédente et des B prédites des deux côtés ; seuls les changements sont transmis.',
    body: "- **I** (intra) : l'image complète, décodable seule ; elle ouvre le GOP ;\n- **P** (prédite) : les blocs qui diffèrent de l'image de référence précédente, avec leurs vecteurs de mouvement (environ le tiers d'une I) ;\n- **B** (bidirectionnelle) : prédite des références d'avant et d'après, la plus légère (environ le dixième d'une I).\n\nUn GOP de 12 avec M = 3 (IBBPBBPBBPBB) pèse à peu près trois images I au lieu de douze. Le prix : une coupe ou un décodeur qui s'accroche doivent remonter à l'I ; une B attend la référence suivante (latence) ; un mouvement imprévisible (la foule) fait baver. Le **tout intra** (GOP de 1) n'a aucun de ces défauts, au prix du débit.",
    car: 'Le codeur de contribution règle son GOP (et sa latence) ; le XDCAM HD422 du PAD est en GOP long de 12 ; les ralentis et le montage préfèrent le tout intra.',
    see: ['codec', 'st2110-22'], ref: 'ISO/IEC 13818-2 (MPEG-2) ; ITU-T H.264',
  },
};
Object.assign(TERMS, ADD);
