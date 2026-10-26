// @ts-check
// ----------------------------------------------------------------------------------
// Calculs ST 2110 du Cours (purs, sans affichage), partagés par les leçons du car IP (cours/reseau_st2110.js)
// et les vues 3D (vues3d/vues/st2110_*.js). Vidéo ST 2110-20 : 4:2:2 10 bits, un « pgroup » de 5 octets
// pour 2 pixels (RFC 4175), 1 200 octets de vidéo par paquet par défaut (480 pixels, comme le poste
// Réseau IP, net/analyzer.js). En-têtes : RFC 4175 8 octets (numéro de séquence étendu, une ligne :
// longueur, numéro de ligne, décalage), RTP 12, UDP 8, IPv4 20, Ethernet 14 + FCS 4 ; sur le fil, préambule
// et intervalle entre trames 20 octets. Audio ST 2110-30 : L24, 48 kHz, paquets de 1 ms (48 échantillons)
// ou de 125 µs (6 échantillons). Modèle ST 2110-21 : CMAX et VRX_FULL des émetteurs étroits (N) et larges (W).
// ----------------------------------------------------------------------------------
export const ENTETES = { rfc4175: 8, rtp: 12, udp: 8, ip: 20, eth: 18, fil: 20 };
/** les formats vidéo du cours */
export const FORMATS = {
  '1080i25': { w: 1920, h: 1080, lignes: 1125, ips: 25, entrelace: true, sdi: 1.485, nom: '1080i25 (HD-SDI)' },
  '1080p50': { w: 1920, h: 1080, lignes: 1125, ips: 50, entrelace: false, sdi: 2.97, nom: '1080p50 (3G-SDI)' },
  '2160p50': { w: 3840, h: 2160, lignes: 2250, ips: 50, entrelace: false, sdi: 11.88, nom: '2160p50 (12G-SDI)' },
};
/**
 * Un flux vidéo ST 2110-20.
 * @param {string} fk format
 * @param {number} [charge] octets de vidéo par paquet
 */
export function video(fk, charge = 1200) {
  const F = FORMATS[fk];
  const ligne = F.w * 2.5; // octets d'une ligne active (5 octets pour 2 pixels)
  const parLigne = Math.ceil(ligne / charge);
  const lignesActives = F.h; // les lignes actives d'une image (les deux trames en entrelacé)
  const nPaquetsImage = lignesActives * parLigne;
  const pps = nPaquetsImage * F.ips;
  const tete = ENTETES.rfc4175 + ENTETES.rtp + ENTETES.udp + ENTETES.ip;
  const paquetIp = charge + tete, trame = paquetIp + ENTETES.eth, fil = trame + ENTETES.fil;
  const utile = ligne * lignesActives * F.ips * 8 / 1e9; // Gb/s d'image active
  return { F, ligne, parLigne, nPaquetsImage, pps, charge, paquetIp, trame, fil, utile, ip: pps * paquetIp * 8 / 1e9, gbpsFil: pps * fil * 8 / 1e9, efficacite: charge / fil };
}
/** un flux audio ST 2110-30 (L24, 48 kHz) */
export function audio(canaux, tempsPaquet = 0.001) {
  const ech = Math.round(48000 * tempsPaquet), charge = ech * canaux * 3;
  const pps = Math.round(1 / tempsPaquet);
  const paquetIp = charge + ENTETES.rtp + ENTETES.udp + ENTETES.ip, fil = paquetIp + ENTETES.eth + ENTETES.fil;
  return { canaux, ech, charge, pps, paquetIp, fil, mbpsFil: pps * fil * 8 / 1e6, utile: 48000 * 24 * canaux / 1e6 };
}
/** modèle de compatibilité ST 2110-21 : émetteur étroit (N, NL) ou large (W) */
export function modele21(fk, type = 'N', charge = 1200) {
  const V = video(fk, charge), F = V.F, tframe = 1 / F.ips;
  const ractive = F.entrelace ? (F.h / 2) / (F.lignes / 2) : F.h / F.lignes;
  const npackets = F.entrelace ? V.nPaquetsImage / 2 : V.nPaquetsImage; // par trame en entrelacé
  const tf = F.entrelace ? tframe / 2 : tframe;
  if (type === 'W') return { cmax: Math.max(16, Math.floor(npackets / (21600 * ractive * tf))), vrx: Math.max(720, Math.floor(npackets / (300 * tf))), npackets, tf, ractive };
  return { cmax: Math.max(4, Math.floor(npackets / (43200 * ractive * tf))), vrx: Math.max(8, Math.floor(npackets / (27000 * tf))), npackets, tf, ractive };
}
/**
 * Les instants d'émission des paquets d'une image (en fractions de la durée d'image), selon le type d'émetteur :
 * 'NL' linéaire (réparti sur toute l'image), 'N' espacé (seulement pendant les lignes actives), 'W' par petites rafales,
 * 'rafale' : non conforme (toute l'image envoyée en quelques lignes).
 */
export function emissions(type, n, ractive = 0.96) {
  const out = [];
  for (let i = 0; i < n; i++) {
    if (type === 'NL') out.push(i / n);
    else if (type === 'N') out.push(i / n * ractive);
    else if (type === 'W') { const b = 12, k = Math.floor(i / b); out.push((k * b) / n * ractive + (i % b) * 0.000004); }
    else out.push(0.05 + i / n * 0.12);
  }
  return out;
}
/**
 * Le récepteur virtuel : un tampon rempli par les arrivées et vidé au rythme régulier de l'image (n paquets
 * répartis sur ractive de la durée d'image) ; renvoie la courbe de remplissage et son maximum.
 */
export function tampon(arrivees, n, ractive = 0.96, pas = 400) {
  const sorted = [...arrivees].sort((a, b) => a - b);
  const lus = (t) => Math.min(n, Math.floor(Math.max(0, t) / ractive * n));
  // le maximum, calculé à chaque arrivée (là où le tampon est le plus plein)
  let max = 0;
  sorted.forEach((t, i) => { const v = i + 1 - lus(t); if (v > max) max = v; });
  // la courbe, échantillonnée pour le dessin
  const pts = []; let k = 0;
  for (let s = 0; s <= pas; s++) { const t = s / pas; while (k < sorted.length && sorted[k] <= t) k++; pts.push(Math.max(0, k - lus(t))); }
  return { pts, max };
}
/** ST 2022-7 : paquets reçus, réparés par l'autre réseau, perdus (pertes indépendantes sur chaque réseau) */
export function fusion(pertesRouge, pertesBleu, n = 1000, rnd = Math.random) {
  let repares = 0, perdus = 0;
  for (let i = 0; i < n; i++) {
    const r = rnd() < pertesRouge, b = rnd() < pertesBleu;
    if (r && b) perdus++; else if (r || b) repares++;
  }
  return { repares, perdus, n };
}
/** spine-leaf : capacité vers les appareils et vers les spines d'une leaf, et le rapport des deux */
export function surabonnement(ports, vitessePort, uplinks, vitesseUplink) {
  const bas = ports * vitessePort, haut = uplinks * vitesseUplink;
  return { bas, haut, ratio: bas / haut };
}
