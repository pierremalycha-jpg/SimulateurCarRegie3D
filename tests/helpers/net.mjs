// Réseau ST 2110 de test : six caméras factices (comme tools/netcli.mjs), routage type d'un match,
// fabric construite et évaluée. Le modèle réseau (src/net/fabric.js) ne dépend que de S.cams.
import './dom.mjs';
import { S } from '../../src/state.js';
import { FAB, buildFabric, resetFabric } from '../../src/net/fabric.js';
import { updateNet } from '../../src/ipnet.js';

const cam = (id, link, model, hfr = 1) => ({ id, link, T: { model, hfr, short: model } });
export const ROUTES = { ME1: 'CAM1', ME2: 'CAM2', ME3: 'CAM3', ME4: 'CAM4', ME5: 'CAM5', ME6: 'CAM6', ME7: 'EVSA', ME8: 'EVSB', ME9: 'GFX', MV1: 'CAM1', MV2: 'CAM2', MV3: 'CAM3', MV10: 'EVSA', REC1: 'CAM1', REC2: 'CAM3', REC3: 'CAM3', AUX_TX1: 'PGM', AUX_TX2: 'PGM', AUX_GIANT: 'CLEAN', AUX_VISION: 'CAM2' };
export const PHASES = { REC3: 1 };

export function freshFabric(format = 'HD') {
  S.ipMode = true; S.format = format;
  S.cams = [cam(1, 'smpte', 'hdc'), cam(2, 'smpte', 'hdc'), cam(3, 'smpte', 'box', 3), cam(4, 'smpte', 'hdc'), cam(5, 'hf', 'steadi'), cam(6, 'smpte', 'ptz')];
  resetFabric();
  buildFabric();
  settle();
  return FAB;
}
// réévalue le réseau comme la boucle du simulateur (modèle + état de façade NET + analyseur)
export function settle() { FAB.lastMap = ''; updateNet(0.1, ROUTES, PHASES); return FAB.res; }
export const rxLost = () => Object.entries(FAB.res.rxState).filter(([, r]) => !r.ok).map(([k]) => k);
export const rxUnprotected = () => Object.entries(FAB.res.rxState).filter(([, r]) => r.ok && !r.protected).map(([k]) => k);
