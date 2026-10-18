// Test du modèle réseau ST 2110 et du CLI en Node (sans navigateur)
import { S } from '../src/state.js';
import { FAB, buildFabric, updateFabric, delivery, camPtpOk } from '../src/net/fabric.js';
import { cliSession, runCli, cliPrompt } from '../src/net/cli.js';
S.ipMode = true; S.format = process.argv[2] || 'HD';
const mk = (id, link, model, hfr = 1) => ({ id, link, T: { model, hfr, short: model } });
S.cams = [mk(1, 'smpte', 'hdc'), mk(2, 'smpte', 'hdc'), mk(3, 'smpte', 'box', 3), mk(4, 'smpte', 'hdc'), mk(5, 'hf', 'steadi'), mk(6, 'smpte', 'ptz')];
const map = { ME1: 'CAM1', ME2: 'CAM2', ME3: 'CAM3', ME4: 'CAM4', ME5: 'CAM5', ME6: 'CAM6', ME7: 'EVSA', ME8: 'EVSB', ME9: 'GFX', MV1: 'CAM1', MV2: 'CAM2', MV3: 'CAM3', MV10: 'EVSA', REC1: 'CAM1', REC2: 'CAM3', REC3: 'CAM3', AUX_TX1: 'PGM', AUX_TX2: 'PGM', AUX_GIANT: 'CLEAN', AUX_VISION: 'CAM2' };
const phase = { REC3: 1 };
buildFabric(); updateFabric(0.1, map, phase);
console.log('switches', Object.keys(FAB.switches).length, 'devices', Object.keys(FAB.devices).length, 'flows', Object.keys(FAB.flows).length, 'links', FAB.links.length);
console.log('issues', FAB.issues.map((i) => i.sev + ' ' + i.title));
const s = cliSession(process.argv[3] || 'LEAF-R1');
const cmds = (process.argv[4] || 'sh int st;;sh ip ospf nei').split(';;');
for (const c of cmds) { console.log(cliPrompt(s) + ' ' + c); console.log(runCli(s, c)); }
console.log('ME1', JSON.stringify(delivery('CAM1', 'ME1')).slice(0, 300));
console.log('ptp cam1', camPtpOk(1));
