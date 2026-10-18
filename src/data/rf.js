// @ts-check
// Liaisons HF numériques (COFDM) : modulations, codes correcteurs, intervalles de garde, plan de fréquences.

// Modulation COFDM : C/N requis (canal gaussien, valeurs DVB-T EN 300 744)
export const MODS = { QPSK: 2, '16QAM': 4, '64QAM': 6 };
export const FECS = { '1/2': 0.5, '2/3': 2 / 3, '3/4': 0.75, '5/6': 5 / 6, '7/8': 7 / 8 };
export const CN_REQ = {
  QPSK: { '1/2': 3.1, '2/3': 4.9, '3/4': 5.9, '5/6': 6.9, '7/8': 7.7 },
  '16QAM': { '1/2': 8.8, '2/3': 11.1, '3/4': 12.5, '5/6': 13.5, '7/8': 13.9 },
  '64QAM': { '1/2': 14.4, '2/3': 16.5, '3/4': 18.0, '5/6': 19.3, '7/8': 20.1 },
};
export const GUARDS = { '1/4': 0.25, '1/8': 0.125, '1/16': 1 / 16, '1/32': 1 / 32 };
export function cofdmBitrate(mod, fec, gi, bwMHz) {
  // Débit utile DVB-T : QPSK 1/2 GI 1/4 = 4,98 Mb/s en 8 MHz
  return 4.98 * (MODS[mod] / 2) * (FECS[fec] / 0.5) * (1.25 / (1 + GUARDS[gi])) * (bwMHz / 8);
}
export const TX_POWERS = [10, 50, 100, 250, 500, 1000]; // mW

// Plan de fréquences (bande 2 GHz). status: 'attrib' = attribué par la coordination, 'occ' = occupé par un autre utilisateur, 'wifi' = bande ISM
export function buildChannels() {
  const ch = [];
  for (let f = 2030; f <= 2490; f += 10) {
    let status = 'libre', user = '';
    if ([2230, 2290, 2310, 2330, 2350].includes(f)) { status = 'attrib'; user = 'Attribué à notre production (coordination)'; }
    if ([2250, 2270, 2280].includes(f)) { status = 'occ'; user = 'Autre diffuseur (liaison HF)'; }
    if (f >= 2110 && f <= 2200) { status = 'occ'; user = 'Réseaux mobiles 2,1 GHz (2110-2170 MHz) et satellite mobile (2170-2200 MHz) : hors bandes vidéo PMSE'; }
    if ([2090, 2100].includes(f)) { status = 'occ'; user = 'Organisateur (vidéo sécurité)'; }
    if (f >= 2400 && f < 2484) { status = 'wifi'; user = 'Bande ISM 2,4 GHz (Wi-Fi des spectateurs)'; }
    ch.push({ f, status, user });
  }
  return ch;
}
