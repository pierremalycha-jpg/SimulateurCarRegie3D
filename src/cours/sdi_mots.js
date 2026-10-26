// @ts-check
// ----------------------------------------------------------------------------------
// Les mots d'une ligne SDI, calculés comme le fait un émetteur (calcul pur, sans affichage) : la vue
// 3D « Le coaxial et la trame » (vues3d/vues/sdi_trame.js) et la leçon « Du mot au bit »
// (cours/sdi_bits.js) s'en servent. Une ligne commence à son EAV : EAV, numéro de ligne (LN), CRC,
// espace HANC (paquets audio ST 299-1 dans le flux C, mots de remplissage ailleurs), SAV, puis la
// vidéo active. En HD et en 3G (niveau A), les deux flux de 10 bits, C (Cb, Cr) et Y, sont entrelacés
// mot à mot : Cb0 Y0 Cr0 Y1… Puis la mise en série : bit de poids faible d'abord, embrouillage par
// x⁹ + x⁴ + 1, codage NRZI (x + 1). Sources : SMPTE ST 274 (trames 1080), ST 296 (720p), ST 292-1
// (EAV/SAV, LN, CRC-18 x¹⁸ + x⁵ + x⁴ + 1), ST 424 (3G), ST 291-1 (paquets ancillary : ADF, DID,
// DBN, DC, UDW, CS ; parité sur b8, b9 = non b8), ST 299-1 (audio HD : DID E7h à E4h, 24 UDW).
// ----------------------------------------------------------------------------------

/** les trames du cours : mots par ligne (par flux), mots actifs, lignes, images par seconde */
export const TRAMES = {
  '1080p50': { nom: '1080p50', liaison: '3G-SDI', norme: 'ST 424', gbps: 2.97, tot: 2640, act: 1920, lignes: 1125, actives: 1080, ips: 50, vanc: 'lignes 1 à 41 et 1122 à 1125' },
  '1080i25': { nom: '1080i25', liaison: 'HD-SDI', norme: 'ST 292-1', gbps: 1.485, tot: 2640, act: 1920, lignes: 1125, actives: 1080, ips: 25, vanc: 'lignes 1 à 20, 561 à 583 et 1124 à 1125' },
  '720p50': { nom: '720p50', liaison: 'HD-SDI', norme: 'ST 292-1', gbps: 1.485, tot: 1980, act: 1280, lignes: 750, actives: 720, ips: 50, vanc: 'lignes 1 à 25 et 746 à 750' },
};
/** fréquence des mots d'un flux (MHz) : mots par ligne × lignes × images par seconde */
export const freqMots = (T) => T.tot * T.lignes * T.ips / 1e6;

/** les zones d'une ligne, dans l'ordre où elles passent dans le câble */
export const ZONES = {
  EAV: { nom: 'EAV', long: 'fin de la vidéo active (End of Active Video)' },
  LN: { nom: 'LN', long: 'numéro de ligne' },
  CRC: { nom: 'CRC', long: 'contrôle de la ligne (CRC)' },
  ANC: { nom: 'paquet audio', long: 'paquet de données audio (ST 299-1)' },
  HANC: { nom: 'HANC', long: 'espace ancillary horizontal libre (mots de remplissage)' },
  SAV: { nom: 'SAV', long: 'début de la vidéo active (Start of Active Video)' },
  ACT: { nom: 'vidéo active', long: 'échantillons de l\'image' },
};

/** parité d'un octet en ST 291 : b8 rend pair le nombre de 1 de b0 à b8, b9 = non b8 */
export function parite(v8) {
  let n = 0; for (let k = 0; k < 8; k++) n += (v8 >> k) & 1;
  const b8 = n & 1;
  return (v8 & 0xff) | (b8 << 8) | ((b8 ^ 1) << 9);
}
/** mot XYZ des séquences de synchro : 1 F V H P3 P2 P1 P0 0 0 (bits de protection P = parités croisées) */
export function xyz(F, Vb, H) {
  const P3 = Vb ^ H, P2 = F ^ H, P1 = F ^ Vb, P0 = F ^ Vb ^ H;
  return (1 << 9) | (F << 8) | (Vb << 7) | (H << 6) | (P3 << 5) | (P2 << 4) | (P1 << 3) | (P0 << 2);
}
/** les deux mots du numéro de ligne (LN0 : L6–L0 en b8–b2 ; LN1 : L10–L7 en b5–b2 ; b9 = non b8) */
export function motsLN(L) {
  const lo = (L & 0x7f) << 2, hi = ((L >> 7) & 0xf) << 2;
  const b8 = (v) => (v >> 8) & 1;
  return [lo | ((b8(lo) ^ 1) << 9), hi | ((b8(hi) ^ 1) << 9)];
}
/** CRC-18 (x¹⁸ + x⁵ + x⁴ + 1) d'une suite de bits, bit de poids faible d'abord, registre à zéro au départ (C0 en bit 0) */
export function crc18bits(bits, c = 0) {
  for (const b of bits) {
    const fb = b ^ (c & 1);
    c >>>= 1;
    if (fb) c ^= (1 << 17) | (1 << 13) | (1 << 12); // le polynôme, retourné (traitement bit de poids faible d'abord)
  }
  return c;
}
/** CRC0 et CRC1 d'une suite de mots de 10 bits (C0–C8 en b0–b8, puis C9–C17 ; b9 = non b8) */
export function crc18(words) {
  const c = crc18bits(bitsDe(words));
  const lo = c & 0x1ff, hi = (c >> 9) & 0x1ff;
  return [lo | ((((lo >> 8) & 1) ^ 1) << 9), hi | ((((hi >> 8) & 1) ^ 1) << 9)];
}

/** l'image du cours : un stade (ciel, tribunes, pelouse tondue en bandes), r, v, b de 0 à 1 */
export function imageRGB(x, y) {
  if (y < 0.22) return [0.42 + 0.2 * y, 0.6 + 0.3 * y, 0.86];
  if (y < 0.44) { const n = Math.sin(x * 913.7 + y * 377.1) * 0.5 + 0.5; return [0.35 + 0.4 * n * 0.6, 0.12 + 0.1 * n, 0.12 + 0.08 * n]; }
  const band = Math.floor(x * 12) % 2 ? 0.06 : 0;
  return [0.12 + band * 0.5, 0.45 + band, 0.16 + band * 0.4];
}
/** codes 10 bits Y', Cb, Cr (BT.709, plage légale : Y 64 à 940, C 64 à 960 autour de 512) */
export function codes709(r, g, b) {
  const Y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const Cb = (b - Y) / 1.8556, Cr = (r - Y) / 1.5748;
  return [Math.round(64 + 876 * Y), Math.round(512 + 896 * Cb), Math.round(512 + 896 * Cr)];
}

/**
 * Les mots d'une ligne, entrelacés C puis Y, à partir de son EAV.
 * @param {string} fk trame (TRAMES)
 * @param {number} n numéro de la ligne (1 à lignes)
 * @param {{ audio?: number, groupes?: number }} [o] audio : échantillons portés par la ligne (0, 1 ou 2) ; groupes : groupes audio embarqués (4 = 16 canaux)
 * @returns {{ v: number, f: 'C' | 'Y', z: string, d: string }[]}
 */
export function ligneSDI(fk, n, o = {}) {
  const T = TRAMES[fk];
  const first = fk === '720p50' ? 26 : fk === '1080i25' ? 21 : 42;
  const vb = n < first || n > first + (fk === '1080i25' ? 539 : T.actives - 1) ? 1 : 0; // ligne de suppression verticale
  const F = fk === '1080i25' && n > 563 ? 1 : 0;
  const C = [], Y = [];
  const push = (arr, v, z, d = '') => arr.push({ v, z, d });
  // EAV, puis LN et CRC (calculé plus bas)
  for (const s of [C, Y]) {
    ['3FF', '000', '000'].forEach((h, k) => push(s, parseInt(h, 16), 'EAV', ['premier mot de synchro (tous les bits à 1)', 'deuxième mot de synchro (tous à 0)', 'troisième mot de synchro (tous à 0)'][k]));
    push(s, xyz(F, vb, 1), 'EAV', `mot XYZ : F = ${F}, V = ${vb}, H = 1 (fin de ligne)`);
    const [l0, l1] = motsLN(n);
    push(s, l0, 'LN', `LN0 : bits 0 à 6 du numéro de ligne ${n}`); push(s, l1, 'LN', `LN1 : bits 7 à 10 du numéro de ligne ${n}`);
    push(s, 0, 'CRC', 'CRC0 : bits 0 à 8 du CRC'); push(s, 0, 'CRC', 'CRC1 : bits 9 à 17 du CRC');
  }
  // HANC : paquets audio dans le flux C (ST 299-1), juste après le CRC ; remplissage ailleurs
  const hanc = T.tot - T.act - 12;
  const nAudio = o.audio ?? 1, groupes = o.groupes ?? 4;
  const DIDS = [0xe7, 0xe6, 0xe5, 0xe4];
  let dbn = (n % 255) + 1;
  for (let s = 0; s < nAudio; s++) {
    for (let g = 0; g < groupes; g++) {
      const pk = [];
      const at = (v, z, d) => pk.push({ v, z, d });
      at(0x000, 'ANC', 'ADF : drapeau de début de paquet (000)'); at(0x3ff, 'ANC', 'ADF (3FF)'); at(0x3ff, 'ANC', 'ADF (3FF)');
      at(parite(DIDS[g]), 'ANC', `DID ${DIDS[g].toString(16).toUpperCase()}h : données audio du groupe ${g + 1} (canaux ${g * 4 + 1} à ${g * 4 + 4})`);
      at(parite(dbn), 'ANC', `DBN : numéro de paquet ${dbn}`); dbn = (dbn % 255) + 1;
      at(parite(24), 'ANC', 'DC : 24 mots de données suivent');
      const udw = ['horloge audio (phase)', 'horloge audio (phase)'];
      for (let ch = 1; ch <= 4; ch++) for (let k = 0; k < 4; k++) udw.push(`canal ${g * 4 + ch} : échantillon 24 bits (${k + 1}/4)`);
      for (let k = 0; k < 6; k++) udw.push('ECC : code correcteur du paquet');
      udw.forEach((d, k) => at(parite((n * 37 + g * 11 + s * 5 + k * 29) & 0xff), 'ANC', 'UDW : ' + d));
      let sum = 0; for (const w of pk.slice(3)) sum = (sum + (w.v & 0x1ff)) & 0x1ff;
      at(sum | ((((sum >> 8) & 1) ^ 1) << 9), 'ANC', 'CS : somme de contrôle du paquet');
      for (const w of pk) push(C, w.v, w.z, w.d);
    }
  }
  while (C.length < 12 + hanc - 4) push(C, 0x200, 'HANC', 'remplissage du flux C (200)');
  while (Y.length < 12 + hanc - 4) push(Y, 0x040, 'HANC', 'remplissage du flux Y (040)');
  // SAV, puis la vidéo active (4:2:2 : un Cb et un Cr pour deux Y)
  for (const s of [C, Y]) {
    ['3FF', '000', '000'].forEach((h, k) => push(s, parseInt(h, 16), 'SAV', ['premier mot de synchro (tous les bits à 1)', 'deuxième mot de synchro (tous à 0)', 'troisième mot de synchro (tous à 0)'][k]));
    push(s, xyz(F, vb, 0), 'SAV', `mot XYZ : F = ${F}, V = ${vb}, H = 0 (début de ligne)`);
  }
  const yy = Math.min(1, Math.max(0, (n - first) / T.actives));
  for (let x = 0; x < T.act; x += 2) {
    if (vb) {
      for (let k = 0; k < 2; k++) { push(C, 0x200, 'ACT', 'ligne de suppression verticale : 200 en C (pas de couleur)'); push(Y, 0x040, 'ACT', 'ligne de suppression verticale : noir (040 en Y)'); }
      continue;
    }
    const [y0, cb, cr] = codes709(...imageRGB(x / T.act, yy));
    const [y1] = codes709(...imageRGB((x + 1) / T.act, yy));
    push(C, cb, 'ACT', `Cb des pixels ${x + 1} et ${x + 2} : code ${cb}`); push(Y, y0, 'ACT', `Y du pixel ${x + 1} : code ${y0} (${Math.round((y0 - 64) / 8.76)} %)`);
    push(C, cr, 'ACT', `Cr des pixels ${x + 1} et ${x + 2} : code ${cr}`); push(Y, y1, 'ACT', `Y du pixel ${x + 2} : code ${y1} (${Math.round((y1 - 64) / 8.76)} %)`);
  }
  // CRC de chaque flux : sur la vidéo active, l'EAV et le numéro de ligne
  for (const s of [C, Y]) {
    const act = s.slice(s.length - T.act).map((w) => w.v);
    const [c0, c1] = crc18([...act, ...s.slice(0, 6).map((w) => w.v)]);
    s[6].v = c0; s[7].v = c1;
  }
  const out = [];
  for (let k = 0; k < C.length; k++) { out.push({ ...C[k], f: /** @type {'C'} */ ('C') }); out.push({ ...Y[k], f: /** @type {'Y'} */ ('Y') }); }
  return out;
}
/** échantillons audio portés par la ligne de rang g (depuis le début), à 48 kHz */
export function echantillonsLigne(fk, g) {
  const T = TRAMES[fk]; const k = 48000 / (T.lignes * T.ips);
  return Math.floor((g + 1) * k) - Math.floor(g * k);
}
export const hex3 = (v) => v.toString(16).toUpperCase().padStart(3, '0');

// ---------------- la mise en série : du mot au bit ----------------
/** les bits des mots, bit de poids faible d'abord */
export function bitsDe(words) { const b = []; for (const w of words) for (let k = 0; k < 10; k++) b.push((w >> k) & 1); return b; }
/**
 * Embrouillage auto-synchronisant x⁹ + x⁴ + 1 puis NRZI (x + 1). état : { s: 9 derniers bits embrouillés, niveau }.
 * Renvoie les bits embrouillés et les niveaux sur le câble (0 : −400 mV, 1 : +400 mV).
 */
export function embrouille(bits, etat = { s: 0, niveau: 0 }) {
  const out = [], lv = [];
  let s = etat.s, niveau = etat.niveau;
  for (const x of bits) {
    const y = x ^ ((s >> 3) & 1) ^ ((s >> 8) & 1); // y(n) = x(n) ⊕ y(n−4) ⊕ y(n−9)
    s = ((s << 1) | y) & 0x1ff;
    niveau ^= y; // NRZI : un 1 fait basculer le niveau, un 0 le garde
    out.push(y); lv.push(niveau);
  }
  etat.s = s; etat.niveau = niveau;
  return { bits: out, niveaux: lv };
}
/** le récepteur : NRZI inverse puis désembrouillage (il retrouve les bits d'origine sans connaître l'état de l'émetteur) */
export function desembrouille(niveaux, etat = { s: 0, prec: 0 }) {
  const out = [];
  let s = etat.s, prec = etat.prec;
  for (const l of niveaux) {
    const y = l ^ prec; prec = l;
    out.push(y ^ ((s >> 3) & 1) ^ ((s >> 8) & 1));
    s = ((s << 1) | y) & 0x1ff;
  }
  etat.s = s; etat.prec = prec;
  return out;
}
/** la plus longue suite de niveaux identiques (sans transition : le récepteur perd l'horloge si elle dure trop) */
export function plusLongPalier(niveaux) { let best = 0, run = 0, p = -1; for (const l of niveaux) { run = l === p ? run + 1 : 1; p = l; if (run > best) best = run; } return best; }
