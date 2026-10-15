import { S } from './state.js';

// ----------------------------------------------------------------------------------
// Car IP (SMPTE ST 2110) : réseaux rouge et bleu (ST 2022-7), PTP (ST 2059-2),
// registre et contrôleur NMOS (IS-04 / IS-05). États simulés et règles simples.
// ----------------------------------------------------------------------------------
export const NET = { red: true, blue: true, gm1: true, gm2: true, nmos: true, mvLink: 100, mvSat: false, gmActive: 1, lostPtpT: 0 };

// débit d'un flux vidéo ST 2110-20 (4:2:2 10 bits, image active) en Gb/s
export function flowGbps() { return S.format === 'UHD' ? 8.3 : S.format === 'HD' ? 2.1 : 1.05; }
// adresse multicast d'un émetteur (source)
export function mcastOf(src) {
  if (!src) return '—';
  if (src.startsWith('CAM')) return `239.10.1.${+src.slice(3)}`;
  const k = { EVSA: 17, EVSB: 18, GFX: 19, STUDIO: 21, BARS: 22, BLACK: 23, PGM: 24, CLEAN: 25, PVW: 26, RETANT: 27 }[src] || 99;
  return `239.10.2.${k}`;
}
export function netOk() { return !S.ipMode || NET.red || NET.blue; }
export function ptpLocked() { return !S.ipMode || NET.gm1 || NET.gm2; }
// le multiviewer reçoit un flux par tuile : son lien réseau limite le nombre de tuiles
export function mvCapacity() { return Math.floor(NET.mvLink / flowGbps()); }

export function updateNet(dt) {
  if (!S.ipMode) return;
  // BMCA : si le grand maître 1 disparaît, le 2 est élu après quelques secondes (timeout des messages Announce)
  if (!NET.gm1 && NET.gm2 && NET.gmActive === 1) { NET.lostPtpT += dt; if (NET.lostPtpT > 3) { NET.gmActive = 2; NET.lostPtpT = 0; } }
  if (NET.gm1 && NET.gmActive === 2 && NET.lostPtpT === 0) NET.gmActive = 1;
}
export function netStatus() {
  const out = [];
  if (!S.ipMode) return out;
  out.push({ t: 'Réseau rouge', s: NET.red ? 'OK' : 'COUPÉ — les flux passent par le réseau bleu (ST 2022-7)', level: NET.red ? 'ok' : 'warn' });
  out.push({ t: 'Réseau bleu', s: NET.blue ? 'OK' : 'COUPÉ — les flux passent par le réseau rouge (ST 2022-7)', level: NET.blue ? 'ok' : 'warn' });
  out.push({ t: 'PTP', s: NET.gm1 ? 'Grand maître 1 (SPG, GPS)' : NET.gm2 ? `Grand maître 1 perdu → ${NET.gmActive === 2 ? 'grand maître 2 élu (BMCA)' : 'élection en cours'}` : 'AUCUN GRAND MAÎTRE : appareils en maintien', level: NET.gm1 ? 'ok' : NET.gm2 ? 'warn' : 'err' });
  out.push({ t: 'Registre NMOS', s: NET.nmos ? 'OK (IS-04 / IS-05)' : 'INJOIGNABLE : connexions impossibles, les flux existants continuent', level: NET.nmos ? 'ok' : 'err' });
  out.push({ t: 'Lien du multiviewer', s: `${NET.mvLink} GbE · ${mvCapacity()} flux ${S.format === 'UHD' ? 'UHD' : 'HD'} au maximum`, level: NET.mvSat ? 'err' : 'ok' });
  return out;
}

export const IP_FAULTS = [
  {
    id: 'ipred', label: 'Coupure du réseau rouge', where: 'Réseau IP (Grille / contrôleur)',
    can: () => S.ipMode && NET.red, inject() { NET.red = false; return {}; }, check: () => NET.red,
    hint: 'Rien ne se voit à l\'image (ST 2022-7 : chaque flux arrive aussi par le réseau bleu), mais il n\'y a plus de secours. Contrôleur IP : remplacer l\'optique / la jarretière du lien rouge.',
  },
  {
    id: 'ipgm', label: 'Perte du grand maître PTP principal', where: 'Synchro (PTP)',
    can: () => S.ipMode && NET.gm1, inject() { NET.gm1 = false; NET.lostPtpT = 0; return {}; }, check: () => NET.gm1,
    hint: 'Alarme PTP : le grand maître de secours est élu (BMCA) et l\'image continue. Synchro : vérifier le GPS et l\'alimentation du SPG principal, puis le remettre en service.',
  },
  {
    id: 'ipnmos', label: 'Registre NMOS injoignable', where: 'Grille / contrôleur IP',
    can: () => S.ipMode && NET.nmos, inject() { NET.nmos = false; return {}; }, check: () => NET.nmos,
    hint: 'Les images restent à l\'antenne mais plus aucune prise (TAKE) n\'est possible. Contrôleur IP : redémarrer le service de registre NMOS.',
  },
  {
    id: 'ipmv', label: 'Lien du multiviewer saturé', where: 'Grille / contrôleur IP',
    can: () => S.ipMode && !NET.mvSat, inject() { NET.mvSat = true; NET.mvLink = 25; return {}; }, check: () => !NET.mvSat,
    hint: 'Des tuiles du multiview passent au noir « FLUX REFUSÉ » : le lien 25 GbE ne porte pas tous les flux. Contrôleur IP : basculer le multiviewer sur son uplink 100 GbE.',
  },
];
