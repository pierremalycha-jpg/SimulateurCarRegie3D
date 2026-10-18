// @ts-check
import { S } from './state.js';

// ----------------------------------------------------------------------------------
// Profil matériel du car : modèles et ressources réellement disponibles.
// Valeurs par défaut = parc indiqué par l'utilisateur (mélangeur Sony XVS-6000,
// un serveur EVS XT4K piloté par une télécommande LSM, IPDirector). Modifiable dans
// l'espace formateur (configuration partagée du car).
// ----------------------------------------------------------------------------------
export const EQUIP = {
  truck: 'Car régie',
  mixer: 'XVS-6000',
  mixPanel: 'ICP-X7000',
  evsModel: 'XT4K',
  evsServers: 1, // nombre de serveurs XT4K
  evsHdChannels: 12, // 8 en standard, 12 avec ChannelMAX
  lsmCount: 1, // télécommandes LSM
  ipdirector: true,
  mix4kInputs: 16, // XVS-6000 en 4K, configuration de base (brochure Sony)
};

// Entrées du mélangeur réellement utilisables selon le format
export function mixInputs() { return S.format === 'UHD' ? EQUIP.mix4kInputs : 22; }

// Répartition des canaux EVS (enregistrement / lecture) selon le format et le nombre de serveurs
export function evsLayout() {
  const uhd = S.format === 'UHD';
  const n = EQUIP.evsServers;
  const per = uhd ? 4 : EQUIP.evsHdChannels;
  let rec, plays;
  if (uhd) { rec = 3 * n; plays = n >= 2 ? 2 : 1; }
  else if (n >= 2) { rec = 8; plays = 2; }
  else { plays = 2; rec = Math.min(8, per - 2 - (per >= 12 ? 2 : 0)); }
  rec = Math.min(8, rec);
  // serveur qui porte chaque entrée REC, et numéro de canal sur ce serveur
  const perSrvRec = n >= 2 ? Math.ceil(rec / n) : rec;
  const recServer = (k) => (n >= 2 ? Math.min(n, Math.floor((k - 1) / perSrvRec) + 1) : 1);
  const recPort = (k) => (n >= 2 ? ((k - 1) % perSrvRec) + 1 : k);
  const playServer = (i) => (n >= 2 && plays >= 2 ? i + 1 : 1);
  const playPort = (i) => (n >= 2 ? perSrvRec + 1 : rec + 1 + i);
  const label = uhd
    ? `${n} × XT4K en UHD : 4 canaux par serveur, soit ${n >= 2 ? '3 REC + 1 PLAY sur chacun (PGM1 sur le serveur 1, PGM2 sur le serveur 2)' : '3 REC + 1 PLAY : une seule sortie de lecture (PGM1)'}`
    : `${n} × XT4K en HD : ${n >= 2 ? '8 REC + 2 PLAY répartis sur les deux serveurs' : `${per} canaux${per >= 12 ? ' (ChannelMAX)' : ''}, soit ${rec} REC + 2 PLAY${per >= 12 ? ' + multiviewer' : ''}`}`;
  return { uhd, servers: n, per, rec, plays, recServer, recPort, playServer, playPort, label };
}
