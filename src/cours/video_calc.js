// @ts-check
// ----------------------------------------------------------------------------------
// Les calculs de la leçon « La compression vidéo » (v19.26), purs et testés : le débit de l'image active
// (sans la suppression), le taux de compression, la taille d'un fichier, le poids d'un GOP selon les
// images I, P et B, les codecs de référence du car et leurs débits (ordres de grandeur dits comme tels).
// ----------------------------------------------------------------------------------
/** échantillons par pixel selon l'échantillonnage : 4:4:4 → 3, 4:2:2 → 2, 4:2:0 → 1,5 */
export const ECH = { '444': 3, '422': 2, '420': 1.5 };
/** les images actives usuelles */
export const IMAGES = /** @type {const} */ ([
  { id: '720p', w: 1280, h: 720, nom: '720p' }, { id: '1080', w: 1920, h: 1080, nom: '1080 (i ou p)' }, { id: '2160', w: 3840, h: 2160, nom: '2160p (UHD)' },
]);
/** le débit de l'image active (b/s) : pixels × échantillons par pixel × bits × images par seconde (pour l'entrelacé, les images par seconde sont les trames) */
export const debitActif = (w, h, ech, bits, ips) => w * h * ECH[ech] * bits * ips;
/** le taux de compression, écrit « n:1 » */
export const taux = (brut, compresse) => (compresse > 0 ? brut / compresse : Infinity);
/** la taille d'un fichier (octets) pour un débit (b/s) et une durée (s) */
export const tailleOctets = (debitBs, dureeS) => debitBs * dureeS / 8;
/** octets lisibles : Mo, Go (1 Go = 10⁹ octets, comme les fabricants de disques) */
export function octets(o) {
  if (o >= 1e12) return `${(o / 1e12).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} To`;
  if (o >= 1e9) return `${(o / 1e9).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Go`;
  if (o >= 1e6) return `${(o / 1e6).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
  return `${(o / 1e3).toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ko`;
}
/**
 * Un GOP (groupe d'images) : une image I (intra, complète), puis des P (prédites de l'image précédente) et des B
 * (bidirectionnelles, prédites des deux côtés). Ordres de grandeur : une P pèse le tiers d'une I, une B le dixième.
 * @param {number} n longueur du GOP (images), @param {number} m distance entre deux images de référence (1 : pas de B ; 3 : IBBPBBP…)
 * @returns {{ I: number, P: number, B: number, poids: number, moyen: number }} nombre d'images de chaque type, poids total en « images I », poids moyen d'une image
 */
export function gop(n, m = 3, kP = 1 / 3, kB = 0.1) {
  const ref = Math.max(1, Math.ceil(n / Math.max(1, m))); // images I ou P
  const I = 1, P = Math.max(0, ref - 1), B = Math.max(0, n - I - P);
  const poids = I + P * kP + B * kB;
  return { I, P, B, poids, moyen: poids / n };
}
/** le débit d'un flux à GOP long rapporté à ce que coûterait le tout-intra au même poids d'image I */
export const gainGop = (n, m = 3) => n / gop(n, m).poids;
/** les codecs de référence du car (débits typiques, ordres de grandeur) */
export const CODECS = /** @type {const} */ ([
  { id: 'xdcam', nom: 'XDCAM HD422', codec: 'MPEG-2 4:2:2, GOP long (12)', mbs: 50, usage: 'le PAD des chaînes françaises, l\'enregistrement', ech: '422', bits: 8, intra: false },
  { id: 'avci', nom: 'AVC-Intra 100', codec: 'H.264 tout intra 4:2:2 10 bits', mbs: 100, usage: 'enregistrement et montage sans GOP', ech: '422', bits: 10, intra: true },
  { id: 'prores', nom: 'ProRes 422 HQ', codec: 'intra, 4:2:2 10 bits (1080p25 ≈ 176 Mb/s, p50 ≈ 352)', mbs: 176, usage: 'montage, fichiers de travail', ech: '422', bits: 10, intra: true },
  { id: 'h264', nom: 'H.264 contribution', codec: 'AVC 4:2:2 10 bits, GOP long', mbs: 20, usage: 'la liaison du car vers la chaîne (IP, satellite)', ech: '422', bits: 10, intra: false },
  { id: 'hevc', nom: 'HEVC contribution', codec: 'H.265, GOP long', mbs: 10, usage: 'contribution, UHD', ech: '422', bits: 10, intra: false },
  { id: 'jpegxs', nom: 'JPEG XS (ST 2110-22)', codec: 'intra par lignes, latence de quelques lignes', mbs: 300, usage: 'production à distance, 10:1 environ', ech: '422', bits: 10, intra: true },
  { id: 'diff', nom: 'H.264 diffusion TNT', codec: 'AVC 4:2:0 8 bits, GOP long', mbs: 7, usage: 'ce que reçoit le téléspectateur', ech: '420', bits: 8, intra: false },
]);
