import { S, emit } from '../state.js';
import { EQUIP, evsLayout, mixInputs } from '../equip.js';

// ----------------------------------------------------------------------------------
// Réseau média SMPTE ST 2110 du car : deux réseaux indépendants (rouge = A, bleu = B,
// ST 2022-7), chacun en architecture spine-leaf (2 spines, 6 leaves « haut de baie »),
// plus un réseau de contrôle / gestion. Chaque commutateur a une configuration
// (running / startup) ; le moteur en déduit l'état des liens, l'underlay OSPF, le
// multicast PIM-SSM / IGMPv3, la bande passante, PTP (ST 2059-2), l'enregistrement NMOS,
// et ce que chaque récepteur reçoit vraiment.
// ----------------------------------------------------------------------------------
export const COLORS = ['red', 'blue'];
export const CNUM = { red: 1, blue: 2 };
export const CLABEL = { red: 'rouge', blue: 'bleu' };
export const LEAVES = [
  { k: 1, zone: 'cam', name: 'CAMÉRAS', rack: 'CCU 1-6' },
  { k: 2, zone: 'prod', name: 'PRODUCTION', rack: 'Mélangeur' },
  { k: 3, zone: 'replay', name: 'RALENTIS', rack: 'EVS' },
  { k: 4, zone: 'mon', name: 'MONITORING', rack: 'Multiview' },
  { k: 5, zone: 'audio', name: 'AUDIO', rack: 'Audio' },
  { k: 6, zone: 'gw', name: 'PASSERELLES · TX', rack: 'Transmission' },
];
export const SSM_REF = '239.0.0.0/8';
export const PTP_REF = { domain: 127, profile: 'smpte2059-2', announce: -2, sync: -3, delayReq: -3, timeout: 3 };
export const DSCP_REF = { ptp: 46, audio: 34, video: 26, anc: 18, ctl: 16 };
export const QUERIER_TIMEOUT = 45; // s (≈ 260 s dans la réalité, raccourci pour l'exercice)

export const FAB = {
  switches: {}, links: [], devices: {}, flows: {}, rx: {}, mode: 'pim',
  registryUp: true, gm: { gm1: { up: true, gps: true, priority1: 100, priority2: 128 }, gm2: { up: true, gps: true, priority1: 110, priority2: 128 } },
  timers: {}, res: null, key: '', ver: 0, issues: [],
};

// ---------------- plan d'adressage ----------------
export const vlanOf = (c, k) => CNUM[c] * 100 + k;
export const subnetOf = (c, k) => `10.${CNUM[c]}.${k}.0/24`;
export const sviIp = (c, k) => `10.${CNUM[c]}.${k}.1`;
const loopLeaf = (c, k) => `10.0.${CNUM[c]}.${10 + k}`, loopSpine = (c, s) => `10.0.${CNUM[c]}.${s}`;
export function p2p(c, k, s, j) { const b = k * 16 + (s - 1) * 4 + j * 2; return { spine: `10.255.${CNUM[c]}.${b}`, leaf: `10.255.${CNUM[c]}.${b + 1}` }; }
export const gmNet = (c, s) => ({ sw: `10.${CNUM[c]}.250.${(s - 1) * 4 + 1}`, gm: `10.${CNUM[c]}.250.${(s - 1) * 4 + 2}` });
export function ipToInt(ip) { const p = String(ip).split('.').map(Number); return p.length === 4 && p.every((x) => x >= 0 && x <= 255) ? ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3] : null; }
export function inSubnet(ip, cidr) {
  const [net, len] = String(cidr).split('/'); const a = ipToInt(ip), n = ipToInt(net), l = +len;
  if (a == null || n == null || !(l >= 0 && l <= 32)) return false;
  const mask = l === 0 ? 0 : (~0 << (32 - l)) >>> 0;
  return ((a & mask) >>> 0) === ((n & mask) >>> 0);
}

// ---------------- matériel des commutateurs ----------------
function leafPorts() {
  const p = [];
  for (let i = 1; i <= 48; i++) p.push({ name: 'Ethernet' + i, type: 'SFP28', speeds: ['25g', '10g'] });
  for (let i = 49; i <= 56; i++) p.push({ name: 'Ethernet' + i, type: 'QSFP28', speeds: ['100g', '40g', '25g', '10g'] }); // 10G avec adaptateur QSA
  return p;
}
function spinePorts() { const p = []; for (let i = 1; i <= 32; i++) p.push({ name: 'Ethernet' + i, type: 'QSFP28', speeds: ['100g', '40g', '25g', '10g'] }); return p; }
function ctlPorts() { const p = []; for (let i = 1; i <= 48; i++) p.push({ name: 'Ethernet' + i, type: 'RJ45/SFP+', speeds: ['10g', '1g'] }); return p; }
// port où se branche le PC de mesure (analyseur) sur chaque commutateur
export const PROBE_PORT = { leaf: 'Ethernet48', spine: 'Ethernet32', ctl: 'Ethernet48' };
export const SPEED_GBPS = { '1g': 1, '10g': 10, '25g': 25, '40g': 40, '100g': 100 };

// ---------------- configurations ----------------
const portDefault = (hw) => ({ desc: '', shutdown: false, speed: hw.speeds[0], fec: 'auto', mtu: 9214, mode: 'access', vlan: 1, ip: '', pim: false, ospf: false, igmp: 0, ptp: false, ptpRole: 'dynamic' });
export function factoryConfig(sw) {
  const ports = {};
  for (const h of sw.hw) ports[h.name] = portDefault(h);
  return {
    hostname: 'localhost', ipRouting: false, mcastRouting: false, ssmRange: '232.0.0.0/8', igmpSnooping: true,
    ospf: { enabled: false, routerId: '' }, loopback: '',
    vlans: { 1: { name: 'default', snooping: true, querier: false } }, svis: {},
    ptp: { mode: 'disabled', domain: 0, profile: 'default', announce: 1, sync: 0, delayReq: 0, priority1: 128, priority2: 128 },
    qos: { trust: 'none', ptpPriority: false },
    monitor: {},
    ports,
  };
}
export function referenceConfig(sw) {
  const cfg = factoryConfig(sw);
  cfg.hostname = sw.hostname;
  if (sw.role === 'ctl') {
    cfg.vlans = { 1: { name: 'default', snooping: true, querier: false }, 10: { name: 'GESTION-OOB', snooping: true, querier: false }, 20: { name: 'CONTROLE', snooping: true, querier: false } };
    cfg.svis = { 10: { ip: '10.10.0.1/24', pim: false, igmp: 0, ospf: false, shutdown: false }, 20: { ip: '10.20.0.1/22', pim: false, igmp: 0, ospf: false, shutdown: false } };
    for (const h of sw.hw) { const p = cfg.ports[h.name]; const n = +h.name.slice(8); p.vlan = n <= 16 ? 10 : 20; p.speed = n <= 16 ? '1g' : '10g'; p.mtu = 1500; p.desc = n <= 16 ? 'OOB gestion' : 'contrôle'; }
    cfg.qos = { trust: 'dscp', ptpPriority: false };
    return cfg;
  }
  const c = sw.color, CN = CNUM[c];
  cfg.ipRouting = true; cfg.mcastRouting = true; cfg.ssmRange = SSM_REF; cfg.igmpSnooping = true;
  cfg.ospf = { enabled: true, routerId: sw.loopback }; cfg.loopback = sw.loopback;
  cfg.ptp = { mode: 'boundary', domain: PTP_REF.domain, profile: PTP_REF.profile, announce: PTP_REF.announce, sync: PTP_REF.sync, delayReq: PTP_REF.delayReq, priority1: 128, priority2: 128 };
  cfg.qos = { trust: 'dscp', ptpPriority: true };
  if (sw.role === 'leaf') {
    const k = sw.k, v = vlanOf(c, k);
    cfg.vlans[v] = { name: `MEDIA-${c === 'red' ? 'R' : 'B'}${k}-${sw.zone.toUpperCase()}`, snooping: true, querier: false };
    cfg.svis[v] = { ip: `${sviIp(c, k)}/24`, pim: true, igmp: 3, ospf: true, shutdown: false };
    for (const h of sw.hw) {
      const p = cfg.ports[h.name]; const n = +h.name.slice(8);
      if (n >= 49 && n <= 52) {
        const s = n <= 50 ? 1 : 2, j = (n - 49) % 2;
        Object.assign(p, { mode: 'routed', vlan: 0, ip: `${p2p(c, k, s, j).leaf}/31`, pim: true, ospf: true, ptp: true, ptpRole: 'dynamic', speed: '100g', fec: 'rs', mtu: 9214, desc: `uplink spine-${c === 'red' ? 'r' : 'b'}${s} ${j ? 'b' : 'a'}` });
      } else Object.assign(p, { mode: 'access', vlan: v, ptp: true, ptpRole: 'master', mtu: 9214, fec: 'auto', desc: n === 48 ? 'PC de mesure (analyseur)' : '' });
    }
  } else {
    for (const h of sw.hw) {
      const p = cfg.ports[h.name]; const n = +h.name.slice(8);
      if (n <= 24) { const k = Math.ceil(n / 2), j = (n - 1) % 2; if (k <= LEAVES.length) Object.assign(p, { mode: 'routed', vlan: 0, ip: `${p2p(c, k, sw.s, j).spine}/31`, pim: true, ospf: true, ptp: true, ptpRole: 'dynamic', speed: '100g', fec: 'rs', mtu: 9214, desc: `leaf-${c === 'red' ? 'r' : 'b'}${k} ${j ? 'b' : 'a'}` }); else p.shutdown = true; }
      else if (n === 31) Object.assign(p, { mode: 'routed', vlan: 0, ip: `${gmNet(c, sw.s).sw}/30`, pim: false, ospf: true, ptp: true, ptpRole: 'dynamic', speed: '10g', fec: 'none', mtu: 1500, desc: `grand maître PTP ${sw.s}` });
      else if (n === 32) Object.assign(p, { mode: 'access', vlan: 1, desc: 'PC de mesure (analyseur)' });
      else p.shutdown = true;
    }
  }
  return cfg;
}
export const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------------- topologie ----------------
function mkSwitch(id, o) {
  const sw = { id, ...o, power: true, hw: o.role === 'leaf' ? leafPorts() : o.role === 'spine' ? spinePorts() : ctlPorts() };
  return sw;
}
let devIdx = 0;
function addDev(d) {
  d.ctlIp = d.ctlIp || `10.20.${Math.floor(devIdx / 200)}.${20 + (devIdx % 200)}`; devIdx++;
  d.nics = d.nics || {};
  for (const c of COLORS) {
    if (!d.ports || !d.ports[c]) continue;
    const { sw, port } = d.ports[c];
    const k = d.leaf;
    const host = 20 + Object.values(FAB.devices).filter((x) => x.leaf === k).length;
    d.nics[c] = { sw, port, ip: `10.${CNUM[c]}.${k}.${host}`, mask: 24, gw: sviIp(c, k), speeds: d.speeds, fec: d.speeds[0] === '10g' || d.speeds[0] === '1g' ? 'none' : 'rs', mtu: 1500 };
    // second port de la même carte (agrégat de liens, ex. mélangeur UHD : 2 × 100 GbE par réseau)
    if (d.extra) d.nics[c].port2 = d.extra;
  }
  d.ptp = d.ptp || { domain: PTP_REF.domain, slaveOnly: true, priority1: 255, clockClass: 255 };
  d.ctl = d.ctl || { sw: 'SW-CTRL', port: null, vlan: 20 };
  FAB.devices[d.id] = d;
}
// flux émis : id, appareil, essence, source logique (identifiant de la grille), groupe par réseau
function addFlow(dev, id, kind, src, label, gbps, extra = {}) {
  const d = FAB.devices[dev];
  const n = Object.values(FAB.flows).filter((f) => FAB.devices[f.dev].leaf === d.leaf).length + 1;
  FAB.flows[id] = { id, dev, kind, src, label, gbps, n, groups: { red: `239.1.${d.leaf}.${n}`, blue: `239.2.${d.leaf}.${n}` }, udp: 5004, pt: kind === 'audio' ? 97 : kind === 'anc' ? 100 : kind === 'jxs' ? 98 : 96, ...extra };
  (d.senders = d.senders || []).push(id);
}
function addRx(dev, id, label, fixed = null) { const d = FAB.devices[dev]; FAB.rx[id] = { id, dev, label, fixed }; (d.receivers = d.receivers || []).push(id); }

export function videoGbps() { return S.format === 'UHD' ? 8.6 : S.format === 'HD' ? 2.16 : 1.08; }
const audioGbps = (ch) => ch * 0.0012 + 0.0004;

export function topoKey() { return [S.format, S.cams.map((c) => c.id + c.link + c.T.model + c.T.hfr).join(','), mixInputs(), evsLayout().rec, EQUIP.evsServers].join('|'); }

export function buildFabric() {
  const old = FAB.switches, oldDevs = FAB.devices;
  FAB.switches = {}; FAB.links = []; FAB.devices = {}; FAB.flows = {}; FAB.rx = {}; devIdx = 0;
  for (const c of COLORS) {
    for (const s of [1, 2]) FAB.switches[`SPINE-${c === 'red' ? 'R' : 'B'}${s}`] = mkSwitch(`SPINE-${c === 'red' ? 'R' : 'B'}${s}`, { role: 'spine', color: c, s, hostname: `spine-${c === 'red' ? 'r' : 'b'}${s}`, model: 'Spine 32 × 100 GbE (QSFP28)', loopback: loopSpine(c, s), mgmt: `10.10.0.${c === 'red' ? s : 4 + s}` });
    for (const L of LEAVES) FAB.switches[`LEAF-${c === 'red' ? 'R' : 'B'}${L.k}`] = mkSwitch(`LEAF-${c === 'red' ? 'R' : 'B'}${L.k}`, { role: 'leaf', color: c, k: L.k, zone: L.zone, zoneName: L.name, hostname: `leaf-${c === 'red' ? 'r' : 'b'}${L.k}-${L.zone}`, model: 'Leaf 48 × 25 GbE + 8 × 100 GbE', loopback: loopLeaf(c, L.k), mgmt: `10.10.0.${(c === 'red' ? 10 : 20) + L.k}` });
  }
  FAB.switches['SW-CTRL'] = mkSwitch('SW-CTRL', { role: 'ctl', color: 'ctl', hostname: 'sw-ctrl', model: 'Contrôle / gestion 48 × 1/10 GbE', mgmt: '10.10.0.2' });
  // configurations : on garde celles déjà modifiées
  for (const sw of Object.values(FAB.switches)) {
    const o = old[sw.id];
    if (o) { sw.running = o.running; sw.startup = o.startup; sw.power = o.power; }
    else { sw.startup = referenceConfig(sw); sw.running = clone(sw.startup); }
  }
  // liens leaf ↔ spine (2 × 100 GbE vers chaque spine)
  for (const c of COLORS) for (const L of LEAVES) for (const s of [1, 2]) for (const j of [0, 1]) {
    const leaf = `LEAF-${c === 'red' ? 'R' : 'B'}${L.k}`, spine = `SPINE-${c === 'red' ? 'R' : 'B'}${s}`;
    FAB.links.push({ id: `${leaf}:${49 + (s - 1) * 2 + j}`, kind: 'uplink', color: c, a: { sw: leaf, port: 'Ethernet' + (49 + (s - 1) * 2 + j) }, b: { sw: spine, port: 'Ethernet' + ((L.k - 1) * 2 + j + 1) }, k: L.k, s, j });
  }
  const uhd = S.format === 'UHD';
  const ports = (k, n) => ({ red: { sw: `LEAF-R${k}`, port: 'Ethernet' + n }, blue: { sw: `LEAF-B${k}`, port: 'Ethernet' + n } });
  // caméras (CCU sur la leaf caméras ; HF, mini-caméras et PTZ via une passerelle)
  let q = 53; const gwCams = [];
  for (const c of S.cams) {
    if (c.link === 'hf' || c.T.model === 'pov' || c.T.model === 'ptz' || c.T.model === 'drone') { gwCams.push(c); continue; }
    const big = uhd && c.T.hfr > 1;
    addDev({ id: 'ccu' + c.id, name: `CCU ${c.id}`, kind: 'ccu', leaf: 1, cam: c.id, ports: ports(1, big ? q++ : c.id), speeds: big ? ['100g'] : ['25g', '10g'], native: true });
    for (let ph = 1; ph <= (c.T.hfr || 1); ph++) addFlow('ccu' + c.id, ph === 1 ? 'v:CAM' + c.id : `v:CAM${c.id}#${ph}`, 'video', 'CAM' + c.id, `CAM ${c.id}${ph > 1 ? ' phase ' + ph : ''}`, videoGbps(), { phase: ph });
    addFlow('ccu' + c.id, 'a:CAM' + c.id, 'audio', null, `CAM ${c.id} micros (2 can.)`, audioGbps(2), { ch: 2 });
    addFlow('ccu' + c.id, 'n:CAM' + c.id, 'anc', null, `CAM ${c.id} données (ANC)`, 0.0003);
    addRx('ccu' + c.id, 'RET' + c.id, `CCU ${c.id} retour viseur`, 'PGM');
  }
  // production
  addDev({ id: 'xvs', name: EQUIP.mixer, kind: 'mixer', leaf: 2, ports: ports(2, 53), speeds: ['100g'], native: true, extra: 'Ethernet54' });
  for (const s of ['PGM', 'CLEAN', 'PVW']) addFlow('xvs', 'v:' + s, 'video', s, `${EQUIP.mixer} ${s}`, videoGbps());
  for (let i = 1; i <= mixInputs(); i++) addRx('xvs', 'ME' + i, `${EQUIP.mixer} entrée ${i}`);
  addDev({ id: 'gfx', name: 'Habillage', kind: 'gfx', leaf: 2, ports: ports(2, 1), speeds: ['25g', '10g'] });
  addFlow('gfx', 'v:GFX', 'video', 'GFX', 'Habillage fill', videoGbps()); addFlow('gfx', 'v:GFXK', 'video', 'GFXK', 'Habillage key', videoGbps());
  // ralentis (XT4K en SDI derrière une passerelle)
  addDev({ id: 'gwevs', name: `Passerelle ${EQUIP.evsModel}`, kind: 'gateway', leaf: 3, ports: ports(3, 53), speeds: ['100g'] });
  addFlow('gwevs', 'v:EVSA', 'video', 'EVSA', 'EVS PGM1', videoGbps()); if (evsLayout().plays > 1) addFlow('gwevs', 'v:EVSB', 'video', 'EVSB', 'EVS PGM2', videoGbps());
  addFlow('gwevs', 'a:EVS', 'audio', null, 'EVS son des ralentis', audioGbps(8), { ch: 8 });
  for (let i = 1; i <= evsLayout().rec; i++) addRx('gwevs', 'REC' + i, `${EQUIP.evsModel} REC ${i}`);
  // monitoring
  addDev({ id: 'mv1', name: 'Multiviewer 1', kind: 'mv', leaf: 4, ports: ports(4, 53), speeds: ['100g', '40g', '25g', '10g'] });
  addDev({ id: 'mv2', name: 'Multiviewer 2', kind: 'mv', leaf: 4, ports: ports(4, 54), speeds: ['100g', '40g', '25g', '10g'] });
  addRx('mv1', 'MVPGM', 'Multiview grande tuile PGM', 'PGM'); addRx('mv1', 'MVPVW', 'Multiview grande tuile PVW', 'PVW');
  for (let i = 1; i <= 18; i++) addRx(i <= 9 ? 'mv1' : 'mv2', 'MV' + i, `Multiview tuile ${i}`);
  addDev({ id: 'grade1', name: 'Grade 1 + scopes', kind: 'mon', leaf: 4, ports: ports(4, 1), speeds: ['25g', '10g'] });
  addRx('grade1', 'AUX_VISION', 'Moniteur Grade 1 (vision)');
  // audio (ST 2110-30 / AES67)
  addDev({ id: 'console', name: 'Console son (cœur DSP)', kind: 'audio', leaf: 5, ports: ports(5, 1), speeds: ['10g'] });
  addDev({ id: 'stagebox', name: 'Stagebox terrain', kind: 'audio', leaf: 5, ports: ports(5, 2), speeds: ['10g'] });
  addDev({ id: 'commu', name: 'Unité de commentaire', kind: 'audio', leaf: 5, ports: ports(5, 3), speeds: ['10g'] });
  addFlow('stagebox', 'a:AMB', 'audio', null, 'Couples d\'ambiance (8 can.)', audioGbps(8), { ch: 8 });
  addFlow('stagebox', 'a:CANONS', 'audio', null, 'Canons bord terrain (8 can.)', audioGbps(8), { ch: 8 });
  addFlow('commu', 'a:COMM', 'audio', null, 'Commentaires (4 can.)', audioGbps(4), { ch: 4 });
  for (const [id, l] of [['a:PGM', 'Console PGM stéréo'], ['a:INTL', 'Console international'], ['a:N1', 'Console N-1']]) addFlow('console', id, 'audio', null, l, audioGbps(2), { ch: 2 });
  for (const f of ['a:AMB', 'a:CANONS', 'a:COMM', 'a:EVS', ...Object.keys(FAB.flows).filter((x) => x.startsWith('a:CAM'))]) addRx('console', 'CONS:' + f, 'Console ← ' + f.slice(2), f);
  addRx('commu', 'CU:N1', 'Unité commentaire ← N-1', 'a:N1');
  // passerelles et transmission
  addDev({ id: 'gwcam', name: 'Passerelle caméras HF / POV / PTZ', kind: 'gateway', leaf: 6, ports: ports(6, 53), speeds: ['100g'] });
  for (const c of gwCams) addFlow('gwcam', 'v:CAM' + c.id, 'video', 'CAM' + c.id, `CAM ${c.id} (${c.T.short})`, videoGbps());
  addDev({ id: 'tx1', name: 'Encodeur TX1 (JPEG XS)', kind: 'tx', leaf: 6, ports: ports(6, 1), speeds: ['25g', '10g'] });
  addDev({ id: 'tx2', name: 'Encodeur TX2 (HEVC)', kind: 'tx', leaf: 6, ports: ports(6, 2), speeds: ['25g', '10g'] });
  addRx('tx1', 'AUX_TX1', 'Départ TX1'); addRx('tx1', 'TX1:a:PGM', 'TX1 ← son PGM', 'a:PGM'); addRx('tx1', 'TX1:a:INTL', 'TX1 ← international', 'a:INTL');
  addRx('tx2', 'AUX_TX2', 'Départ TX2'); addRx('tx2', 'TX2:a:PGM', 'TX2 ← son PGM', 'a:PGM');
  addDev({ id: 'dec', name: 'Décodeurs retour / duplex', kind: 'gateway', leaf: 6, ports: ports(6, 3), speeds: ['25g', '10g'] });
  addFlow('dec', 'v:RETANT', 'video', 'RETANT', 'Retour antenne', videoGbps()); addFlow('dec', 'v:STUDIO', 'video', 'STUDIO', 'Duplex studio', videoGbps());
  addDev({ id: 'gen', name: 'Générateur de test', kind: 'gateway', leaf: 6, ports: ports(6, 4), speeds: ['25g', '10g'] });
  addFlow('gen', 'v:BARS', 'video', 'BARS', 'Mire', videoGbps()); addFlow('gen', 'v:BLACK', 'video', 'BLACK', 'Noir', videoGbps());
  addDev({ id: 'gwstade', name: 'Passerelle écrans d\'angle', kind: 'gateway', leaf: 6, ports: ports(6, 5), speeds: ['25g', '10g'] });
  addRx('gwstade', 'AUX_GIANT', 'Écrans d\'angle (fibre stade)');
  // grands maîtres PTP (un par spine)
  for (const g of [1, 2]) {
    FAB.devices['gm' + g] = { id: 'gm' + g, name: `Grand maître PTP ${g}`, kind: 'gm', leaf: 0, gm: g, nics: {}, ptp: { domain: PTP_REF.domain }, ctl: { sw: 'SW-CTRL', port: null, vlan: 10 }, ctlIp: `10.10.0.${40 + g}` };
    for (const c of COLORS) FAB.devices['gm' + g].nics[c] = { sw: `SPINE-${c === 'red' ? 'R' : 'B'}${g}`, port: 'Ethernet31', ip: gmNet(c, g).gm, mask: 30, gw: gmNet(c, g).sw, speeds: ['10g', '1g'], fec: 'none', mtu: 1500 };
  }
  // réseau de contrôle : registre NMOS / contrôleur, ports de contrôle des appareils
  FAB.devices.nmos = { id: 'nmos', name: 'Registre NMOS + contrôleur', kind: 'nmos', leaf: 0, nics: {}, ctl: { sw: 'SW-CTRL', port: 'Ethernet17', vlan: 20 }, ctlIp: '10.20.0.10', ptp: {} };
  let cp = 18;
  for (const d of Object.values(FAB.devices)) { if (d.kind === 'nmos') continue; if (d.kind === 'gm') { d.ctl.port = 'Ethernet' + (12 + d.gm); continue; } d.ctl.port = 'Ethernet' + cp++; }
  for (const d of Object.values(FAB.devices)) {
    const o = oldDevs[d.id]; if (!o) continue;
    for (const c of COLORS) if (d.nics[c] && o.nics && o.nics[c]) { d.nics[c].ip = o.nics[c].ip; d.nics[c].gw = o.nics[c].gw; }
    if (o.ptp) Object.assign(d.ptp, o.ptp);
  }
  if (!old['SW-CTRL']) { const C = FAB.switches['SW-CTRL']; for (const d of Object.values(FAB.devices)) for (const cf of [C.startup, C.running]) if (d.ctl.port) cf.ports[d.ctl.port].desc = d.kind === 'nmos' ? 'Registre NMOS' : d.name + ' (contrôle)'; }
  // ports de description sur les leaves
  for (const d of Object.values(FAB.devices)) for (const c of COLORS) {
    const n = d.nics[c]; if (!n) continue; const sw = FAB.switches[n.sw]; if (old[sw.id]) continue;
    for (const cf of [sw.startup, sw.running]) { const p = cf.ports[n.port]; if (!p.desc) p.desc = d.name; if (!n.speeds.includes(p.speed)) p.speed = n.speeds.find((x) => sw.hw.find((h) => h.name === n.port).speeds.includes(x)) || p.speed; if (n.port2 && !cf.ports[n.port2].desc) cf.ports[n.port2].desc = d.name + ' (lien 2)'; }
  }
  FAB.key = topoKey(); FAB.ver++; FAB.build = (FAB.build || 0) + 1;
  evaluate();
}

// ---------------- moteur d'évaluation ----------------
const portCfg = (sw, port) => FAB.switches[sw].running.ports[port];
function nicLink(d, c) {
  // lien appareil ↔ leaf : alimentation, shutdown, vitesse, FEC
  const n = d.nics[c]; if (!n) return { up: false, reason: 'pas de carte réseau' };
  const sw = FAB.switches[n.sw]; if (!sw || !sw.power) return { up: false, reason: `${n.sw} hors tension` };
  const p = portCfg(n.sw, n.port); const hw = sw.hw.find((h) => h.name === n.port);
  if (p.shutdown) return { up: false, reason: `${n.port} en shutdown` };
  if (!hw.speeds.includes(p.speed) || !n.speeds.includes(p.speed)) return { up: false, reason: `vitesse ${p.speed} incompatible (carte : ${n.speeds.join('/')})` };
  const fecNeeded = p.speed === '25g' || p.speed === '100g' ? 'rs' : 'none';
  if (p.fec !== 'auto' && p.fec !== fecNeeded) return { up: false, reason: `FEC ${p.fec} ≠ ${fecNeeded} attendu à ${p.speed}` };
  if (Object.values(sw.running.monitor || {}).some((m) => m.dest === n.port)) return { up: true, speed: SPEED_GBPS[p.speed], port: p, span: true };
  return { up: true, speed: SPEED_GBPS[p.speed], port: p };
}
function uplinkState(l) {
  const A = FAB.switches[l.a.sw], B = FAB.switches[l.b.sw];
  if (!A.power || !B.power) return { up: false, reason: 'commutateur hors tension' };
  const pa = A.running.ports[l.a.port], pb = B.running.ports[l.b.port];
  if (pa.shutdown || pb.shutdown) return { up: false, reason: 'port en shutdown' };
  if (pa.speed !== pb.speed) return { up: false, reason: `vitesses ${pa.speed} / ${pb.speed}` };
  const fa = pa.fec === 'auto' ? 'rs' : pa.fec, fb = pb.fec === 'auto' ? 'rs' : pb.fec;
  if (fa !== fb) return { up: false, reason: `FEC ${pa.fec} / ${pb.fec}` };
  const r = { up: true, speed: SPEED_GBPS[pa.speed], pa, pb };
  // underlay OSPF
  const l3 = pa.mode === 'routed' && pb.mode === 'routed' && pa.ip && pb.ip && sameP2P(pa.ip, pb.ip);
  if (!A.running.ipRouting || !B.running.ipRouting) r.ospf = 'routage IP désactivé';
  else if (!l3) r.ospf = 'interfaces non routées ou adresses hors du même /31';
  else if (!A.running.ospf.enabled || !B.running.ospf.enabled || !pa.ospf || !pb.ospf) r.ospf = 'OSPF non activé sur le lien';
  else if (pa.mtu !== pb.mtu) r.ospf = `MTU ${pa.mtu} / ${pb.mtu} : voisinage bloqué en EXSTART`;
  else r.ospf = 'FULL';
  r.pim = r.ospf === 'FULL' && A.running.mcastRouting && B.running.mcastRouting && pa.pim && pb.pim;
  r.ptp = A.running.ptp.mode !== 'disabled' && B.running.ptp.mode !== 'disabled' && pa.ptp && pb.ptp && A.running.ptp.domain === B.running.ptp.domain;
  return r;
}
function sameP2P(a, b) { const [ia, la] = a.split('/'), [ib, lb] = b.split('/'); if (la !== lb) return false; return inSubnet(ib, `${ia}/${la}`) && ia !== ib; }
function inSsm(sw, group) { return inSubnet(group, FAB.switches[sw].running.ssmRange || '232.0.0.0/8'); }

export function evaluate() {
  const R = { nic: {}, up: {}, leafOk: {}, rxState: {}, loads: {}, linkLoad: {}, ptp: {}, devPtp: {}, reg: {}, gmActive: {}, issues: [], flood: {}, querierLost: {}, refused: {} };
  const issues = R.issues;
  const iss = (sev, title, detail, where = {}) => issues.push({ sev, title, detail, ...where });
  for (const sw of Object.values(FAB.switches)) if (!sw.power) iss('err', `${sw.running.hostname} hors tension`, sw.role === 'ctl' ? 'Plus de contrôle ni de gestion : NMOS et supervision perdus.' : `Tout le trafic ${CLABEL[sw.color]} qui passait par ce commutateur est perdu : seul le réseau ${sw.color === 'red' ? 'bleu' : 'rouge'} porte encore les flux concernés (ST 2022-7).`, { sw: sw.id, color: sw.color });
  // 1. liens appareils
  for (const d of Object.values(FAB.devices)) for (const c of COLORS) {
    if (!d.nics[c]) continue;
    const st = nicLink(d, c); const n = d.nics[c];
    let reach = st.up && !st.span;
    let why = st.span ? `${n.port} est la destination d'une session miroir (SPAN) : il ne transporte plus que la copie du trafic` : st.reason;
    if (st.up && !st.span && d.kind !== 'gm') {
      const sw = FAB.switches[n.sw]; const p = st.port; const v = vlanOf(c, d.leaf);
      if (p.mode !== 'access') { reach = false; why = `${n.port} n'est pas en mode accès`; }
      else if (p.vlan !== v) { reach = false; why = `${n.port} dans le VLAN ${p.vlan} au lieu du ${v}`; }
      else if (!sw.running.vlans[v]) { reach = false; why = `VLAN ${v} absent de ${sw.running.hostname}`; }
      else if (!sw.running.svis[v] || sw.running.svis[v].shutdown || !inSubnet(n.ip, sw.running.svis[v].ip)) { reach = false; why = `pas de passerelle (SVI Vlan${v}) pour ${n.ip}`; }
      else if (!inSubnet(n.ip, `${sviIp(c, d.leaf)}/24`) || n.gw !== sviIp(c, d.leaf)) { reach = false; why = `adresse ${n.ip} / passerelle ${n.gw} incohérentes`; }
      else if (p.mtu < 1500) { reach = false; why = `MTU ${p.mtu} < 1500 : les paquets RTP de ~1 450 octets sont jetés`; }
    } else if (st.up && !st.span && d.kind === 'gm') {
      const p = st.port; if (p.mode !== 'routed' || !p.ip || !inSubnet(n.ip, p.ip)) { reach = false; why = 'port du grand maître non routé ou mauvais sous-réseau'; }
    }
    R.nic[d.id + ':' + c] = { up: st.up, reach, why: reach ? '' : why, speed: st.speed || 0 };
    if (!reach && d.kind !== 'gm' && FAB.switches[n.sw].power) iss(d.kind === 'ccu' || d.kind === 'mixer' ? 'warn' : 'warn', `${d.name} injoignable sur le réseau ${CLABEL[c]}`, why, { sw: n.sw, port: n.port, dev: d.id, color: c });
  }
  for (const d of Object.values(FAB.devices)) if (d.kind !== 'gm' && d.nics.red && d.nics.blue && !R.nic[d.id + ':red'].reach && !R.nic[d.id + ':blue'].reach && FAB.switches[d.nics.red.sw].power && FAB.switches[d.nics.blue.sw].power) iss('err', `${d.name} injoignable sur les deux réseaux`, `rouge : ${R.nic[d.id + ':red'].why} · bleu : ${R.nic[d.id + ':blue'].why}`, { sw: d.nics.red.sw, port: d.nics.red.port, dev: d.id });
  // conflits d'adresses
  for (const c of COLORS) { const seen = {}; for (const d of Object.values(FAB.devices)) { const n = d.nics[c]; if (!n) continue; if (seen[n.ip]) { iss('err', `Conflit d'adresse ${n.ip} (${CLABEL[c]})`, `${seen[n.ip].name} et ${d.name} ont la même adresse : l'ARP bascule de l'un à l'autre, les deux perdent des paquets.`, { dev: d.id, color: c }); R.nic[d.id + ':' + c].conflict = true; R.nic[seen[n.ip].id + ':' + c].conflict = true; } else seen[n.ip] = d; } }
  // 2. underlay
  for (const l of FAB.links) {
    const st = uplinkState(l); R.up[l.id] = st;
    if (!st.up && st.reason === 'commutateur hors tension') continue;
    if (!st.up) iss('warn', `Uplink ${l.a.sw} ${l.a.port} ↔ ${l.b.sw} ${l.b.port} coupé`, st.reason, { sw: l.a.sw, port: l.a.port, color: l.color });
    else if (st.ospf !== 'FULL') iss('warn', `OSPF ${l.a.sw} ↔ ${l.b.sw} (${l.a.port}) : ${st.ospf}`, 'Le lien est monté mais le routage ne passe pas par lui : les flux sont déviés vers les autres uplinks (ECMP).', { sw: l.a.sw, port: l.a.port, color: l.color });
    else if (!st.pim) iss('warn', `PIM inactif sur ${l.a.sw} ↔ ${l.b.sw} (${l.a.port})`, 'Pas de voisin PIM : le multicast ne passe pas par ce lien.', { sw: l.a.sw, port: l.a.port, color: l.color });
  }
  // vue par réseau : quelles spines relient deux leaves (OSPF + PIM)
  const spineOk = (c, k, s, need = 'pim') => FAB.links.some((l) => l.color === c && l.k === k && l.s === s && R.up[l.id].up && R.up[l.id].ospf === 'FULL' && (need !== 'pim' || R.up[l.id].pim));
  const spineLinks = (c, k, s) => FAB.links.filter((l) => l.color === c && l.k === k && l.s === s && R.up[l.id].up && R.up[l.id].ospf === 'FULL' && R.up[l.id].pim);
  // 3. réceptions (abonnements actuels)
  const map = FAB.routeMap || {};
  const subs = [];
  for (const rx of Object.values(FAB.rx)) {
    let src = rx.fixed;
    if (!src) src = map[rx.id];
    if (!src) continue;
    let fid = src.startsWith('a:') || src.startsWith('v:') ? src : 'v:' + src;
    if (rx.id.startsWith('REC')) { const ph = (FAB.recPhase || {})[rx.id]; if (ph) fid = `v:${src}#${ph + 1}`; }
    if (!FAB.flows[fid]) continue;
    subs.push({ rx, flow: FAB.flows[fid] });
  }
  const order = (s) => (s.rx.id.startsWith('ME') ? 0 : s.rx.id.startsWith('AUX_TX') ? 1 : s.rx.id.startsWith('MVP') ? 2 : s.rx.id.startsWith('REC') ? 3 : s.rx.id.startsWith('MV') ? 4 : 5);
  subs.sort((a, b) => order(a) - order(b));
  const loads = {}; // clé lien:direction → Map flux → Gb/s
  const addLoad = (key, f) => { (loads[key] = loads[key] || new Map()).set(f.id, f.gbps); };
  const capOf = {};
  for (const c of COLORS) {
    // émission : chaque appareil envoie tous ses flux sur ses deux cartes
    for (const d of Object.values(FAB.devices)) {
      const st = R.nic[d.id + ':' + c]; if (!st || !st.up) continue;
      let cap = st.speed; const n = d.nics[c];
      if (n.port2) { const p2 = portCfg(n.sw, n.port2); const p1 = portCfg(n.sw, n.port); const ok2 = !p2.shutdown && p2.speed === p1.speed && p2.mode === p1.mode && p2.vlan === p1.vlan; st.lanes = ok2 ? 2 : 1; if (ok2) cap += st.speed; else iss('warn', `${d.name} : lien 2 inactif sur le réseau ${CLABEL[c]}`, `${n.port2} doit avoir la même configuration que ${n.port} (vitesse, mode, VLAN) : la capacité de la carte est divisée par deux.`, { sw: n.sw, port: n.port2, dev: d.id, color: c }); }
      capOf[`${d.id}:${c}:up`] = cap; capOf[`${d.id}:${c}:down`] = cap; for (const fid of d.senders || []) addLoad(`${d.id}:${c}:up`, FAB.flows[fid]);
    }
    for (const l of FAB.links) if (l.color === c && R.up[l.id].up) { capOf[l.id + ':up'] = R.up[l.id].speed; capOf[l.id + ':down'] = R.up[l.id].speed; }
  }
  // délai sans querier IGMP
  for (const sw of Object.values(FAB.switches)) if (sw.role === 'leaf') {
    const v = vlanOf(sw.color, sw.k); const svi = sw.running.svis[v]; const vl = sw.running.vlans[v];
    const querier = sw.power && ((svi && !svi.shutdown && svi.igmp > 0 && sw.running.mcastRouting && (svi.pim || svi.igmp)) || (vl && vl.querier));
    const key = sw.id;
    if (!querier) { FAB.timers[key] = FAB.timers[key] ?? 0; R.querierLost[key] = FAB.timers[key]; } else delete FAB.timers[key];
  }
  const pathOf = (c, f, rx) => {
    // renvoie { ok, reason, keys[] } pour un réseau
    const sd = FAB.devices[f.dev], rd = FAB.devices[rx.dev];
    const ns = R.nic[sd.id + ':' + c], nr = R.nic[rd.id + ':' + c];
    if (!ns || !ns.reach) return { ok: false, reason: `émetteur ${sd.name} : ${ns ? ns.why : 'non raccordé'}` };
    if (ns.conflict) return { ok: false, reason: `conflit d'adresse sur ${sd.name}` };
    if (!nr || !nr.reach) return { ok: false, reason: `récepteur ${rd.name} : ${nr ? nr.why : 'non raccordé'}` };
    const g = f.groups[c]; const ls = FAB.switches[sd.nics[c].sw], lr = FAB.switches[rd.nics[c].sw];
    // côté récepteur : querier IGMPv3 et snooping
    const v = vlanOf(c, rd.leaf); const svi = lr.running.svis[v]; const vl = lr.running.vlans[v];
    if (svi && svi.igmp === 2) return { ok: false, reason: `${lr.running.hostname} Vlan${v} en IGMPv2 : les jonctions (S,G) IGMPv3 sont refusées` };
    if (FAB.timers[lr.id] != null && FAB.timers[lr.id] > QUERIER_TIMEOUT && vl && vl.snooping && lr.running.igmpSnooping) return { ok: false, reason: `pas de querier IGMP sur ${lr.running.hostname} : entrée de snooping expirée` };
    if (!inSsm(lr.id, g)) return { ok: false, reason: `${g} hors de la plage SSM de ${lr.running.hostname} (${lr.running.ssmRange}) : traité en ASM, pas de RP` };
    // la jonction IGMPv3 (S,G) est acceptée par la leaf du récepteur
    const keys = [`${sd.id}:${c}:up`];
    const J = { ok: false, joined: true, src: sd.nics[c].ip, group: g, ls: ls.id, lr: lr.id };
    if (ls.id !== lr.id) {
      if (!lr.running.mcastRouting || !ls.running.mcastRouting) return { ...J, reason: 'routage multicast désactivé' };
      if (!svi || !svi.pim) return { ...J, reason: `PIM absent sur l'interface Vlan${v} de ${lr.running.hostname}` };
      const sv = ls.running.svis[vlanOf(c, sd.leaf)]; if (!sv || !sv.pim) return { ...J, reason: `PIM absent sur l'interface Vlan${vlanOf(c, sd.leaf)} de ${ls.running.hostname} (échec RPF)` };
      if (!sv.ospf || !svi.ospf) return { ...J, reason: 'sous-réseau non annoncé en OSPF : pas de route vers la source (RPF)' };
      const spines = [1, 2].filter((s) => FAB.switches[`SPINE-${c === 'red' ? 'R' : 'B'}${s}`].power && spineOk(c, sd.leaf, s) && spineOk(c, rd.leaf, s) && inSsm(`SPINE-${c === 'red' ? 'R' : 'B'}${s}`, g));
      if (!spines.length) {
        const ssmBad = [1, 2].some((s) => !inSsm(`SPINE-${c === 'red' ? 'R' : 'B'}${s}`, g));
        return { ...J, reason: ssmBad ? `${g} hors de la plage SSM d'une spine` : 'aucune spine joignable en OSPF + PIM entre les deux leaves' };
      }
      // hachage ECMP : la spine puis l'uplink sont choisis d'après le groupe (indices décorrélés)
      const h = ipToInt(g), s = spines[h % spines.length];
      const up1 = spineLinks(c, sd.leaf, s), dn1 = spineLinks(c, rd.leaf, s);
      const lu = up1[Math.floor(h / spines.length) % up1.length], ld = dn1[Math.floor(h / spines.length) % dn1.length];
      keys.push(lu.id + ':up', ld.id + ':down');
      keys.push(`${rd.id}:${c}:down`);
      return { ...J, ok: true, keys, lu: lu.id, ld: ld.id, spine: `SPINE-${c === 'red' ? 'R' : 'B'}${s}` };
    }
    keys.push(`${rd.id}:${c}:down`);
    return { ...J, ok: true, keys, spine: null };
  };
  const st = {};
  for (const s of subs) {
    const per = {};
    for (const c of COLORS) {
      const p = pathOf(c, s.flow, s.rx);
      if (p.ok && FAB.mode === 'sdn') {
        // contrôleur SDN : admission selon la bande passante restante
        const full = p.keys.find((k) => { const m = loads[k]; const cur = m ? [...m.values()].reduce((a, b) => a + b, 0) : 0; return !(m && m.has(s.flow.id)) && cur + s.flow.gbps > (capOf[k] || 0) * 0.95; });
        if (full) { per[c] = { ok: false, reason: `refusé par le contrôleur SDN : bande passante insuffisante sur ${linkName(full)}`, refused: true }; continue; }
      }
      if (p.ok) for (const k of p.keys) addLoad(k, s.flow);
      per[c] = p;
    }
    st[s.rx.id] = { flow: s.flow.id, per, rx: s.rx.id };
  }
  // inondation si le snooping IGMP est désactivé : tout ce qui circule dans le VLAN sort sur tous ses ports
  for (const sw of Object.values(FAB.switches)) if (sw.role === 'leaf' && sw.power) {
    const v = vlanOf(sw.color, sw.k); const vl = sw.running.vlans[v];
    if (vl && (!vl.snooping || !sw.running.igmpSnooping)) {
      R.flood[sw.id] = true;
      const devs = Object.values(FAB.devices).filter((d) => d.nics[sw.color] && d.nics[sw.color].sw === sw.id && R.nic[d.id + ':' + sw.color].reach);
      const inVlan = new Map();
      for (const d of devs) for (const fid of d.senders || []) inVlan.set(fid, FAB.flows[fid]);
      for (const [k, m] of Object.entries(loads)) if (k.endsWith(':down') && devs.some((d) => k === `${d.id}:${sw.color}:down`)) for (const fid of m.keys()) inVlan.set(fid, FAB.flows[fid]);
      for (const d of devs) for (const f of inVlan.values()) if (!(d.senders || []).includes(f.id)) addLoad(`${d.id}:${sw.color}:down`, f);
      iss('err', `Snooping IGMP désactivé : inondation multicast sur ${sw.running.hostname}`, `Tous les flux du VLAN ${v} sortent sur tous ses ports (${inVlan.size} flux). Les liens les plus lents débordent.`, { sw: sw.id, color: sw.color });
    }
  }
  // charges et pertes par lien
  const lossOf = {};
  for (const [k, m] of Object.entries(loads)) {
    const load = [...m.values()].reduce((a, b) => a + b, 0), cap = capOf[k] || 0;
    R.linkLoad[k] = { load, cap, n: m.size };
    lossOf[k] = cap > 0 && load > cap ? 1 - cap / load : 0;
    if (lossOf[k] > 0) iss('err', `Lien saturé : ${linkName(k)}`, `${load.toFixed(1)} Gb/s demandés pour ${cap} Gb/s : ${(lossOf[k] * 100).toFixed(0)} % des paquets jetés. ${FAB.mode === 'pim' ? 'PIM ne contrôle pas la bande passante ; un contrôleur SDN aurait refusé les flux en trop.' : ''}`, { linkKey: k });
  }
  for (const [rid, s] of Object.entries(st)) {
    for (const c of COLORS) { const p = s.per[c]; if (p.ok) p.loss = Math.max(0, ...p.keys.map((k) => lossOf[k] || 0)); }
    const r = s.per.red, b = s.per.blue;
    const clean = (p) => p.ok && p.loss < 0.001;
    s.ok = r.ok || b.ok;
    s.loss = clean(r) || clean(b) ? 0 : Math.min(r.ok ? r.loss : 1, b.ok ? b.loss : 1);
    s.protected = r.ok && b.ok;
    s.reason = !s.ok ? (r.reason === b.reason ? r.reason : `rouge : ${r.reason} · bleu : ${b.reason}`) : s.loss > 0 ? `pertes de paquets ${(s.loss * 100).toFixed(0)} % sur les deux réseaux` : !s.protected ? `protection 2022-7 perdue (${!r.ok ? 'rouge : ' + r.reason : 'bleu : ' + b.reason})` : '';
    if (s.ok && !s.protected && !r.refused && !b.refused) R.unprotected = (R.unprotected || 0) + 1;
    if (r.refused && b.refused) R.refused[rid] = true;
    if (r.refused || b.refused) R.nRefused = (R.nRefused || 0) + 1;
  }
  if (R.nRefused) iss(Object.keys(R.refused).length ? 'err' : 'warn', `Contrôleur SDN : ${R.nRefused} connexion(s) refusée(s) faute de bande passante`, `${Object.keys(R.refused).length} récepteur(s) ne reçoivent rien (refus sur les deux réseaux). Le contrôleur préfère refuser un flux plutôt que de saturer un lien et dégrader tous les autres. Libérez de la bande passante ou passez le lien à une vitesse supérieure.`, {});
  R.rxState = st;
  const lostRx = Object.entries(st).filter(([, x]) => !x.ok && !R.refused[x.rx]);
  if (lostRx.length) iss('err', `${lostRx.length} réception(s) sans flux sur les deux réseaux`, `${lostRx.slice(0, 5).map(([id]) => FAB.rx[id].label).join(', ')}${lostRx.length > 5 ? '…' : ''}. Cause : ${lostRx[0][1].reason}`, {});
  const lossRx = Object.entries(st).filter(([, x]) => x.ok && x.loss > 0);
  if (lossRx.length) iss('err', `${lossRx.length} réception(s) avec pertes de paquets`, `${lossRx.slice(0, 5).map(([id]) => FAB.rx[id].label).join(', ')}${lossRx.length > 5 ? '…' : ''} : un lien saturé sur chacun des deux réseaux.`, {});
  // 4. PTP (BMCA par réseau, horloges frontières dans les commutateurs)
  for (const c of COLORS) {
    const cands = [];
    for (const g of [1, 2]) {
      const gm = FAB.gm['gm' + g]; const d = FAB.devices['gm' + g]; const n = R.nic[d.id + ':' + c];
      const sw = FAB.switches[d.nics[c].sw]; const p = portCfg(sw.id, d.nics[c].port);
      if (!gm.up || !n || !n.up || !n.reach) continue;
      if (sw.running.ptp.mode === 'disabled' || !p.ptp) continue;
      if (p.ptpRole === 'master') { iss('warn', `Port du grand maître ${g} en « ptp role master » sur ${sw.running.hostname}`, 'La spine ignore les annonces du grand maître : elle se prend pour la référence.', { sw: sw.id, port: d.nics[c].port, color: c }); continue; }
      if (sw.running.ptp.domain !== PTP_REF.domain) continue;
      cands.push({ id: 'gm' + g, name: `Grand maître ${g}`, p1: gm.priority1, cls: gm.gps ? 6 : 7, p2: gm.priority2, sw: sw.id, traceable: true });
    }
    for (const d of Object.values(FAB.devices)) {
      if (!d.ptp || d.ptp.slaveOnly !== false || !d.nics[c]) continue;
      const n = R.nic[d.id + ':' + c]; const sw = FAB.switches[d.nics[c].sw]; const p = portCfg(sw.id, d.nics[c].port);
      if (!n || !n.reach || sw.running.ptp.mode === 'disabled' || !p.ptp || p.ptpRole === 'master' || d.ptp.domain !== sw.running.ptp.domain) continue;
      cands.push({ id: d.id, name: d.name, p1: d.ptp.priority1, cls: d.ptp.clockClass || 248, p2: 128, sw: sw.id, traceable: false, rogue: true });
    }
    cands.sort((a, b) => a.p1 - b.p1 || a.cls - b.cls || a.p2 - b.p2);
    const gm = cands[0] || null;
    R.gmActive[c] = gm;
    if (gm && gm.rogue) iss('err', `PTP ${CLABEL[c]} : ${gm.name} est élu grand maître (priority1 ${gm.p1})`, 'Un appareil mal configuré s\'annonce maître avec une priorité meilleure que les grands maîtres GPS : tout le réseau se cale sur une horloge libre. Protection : « ptp role master » sur les ports d\'accès, ou appareil en « slave only ».', { dev: gm.id, color: c });
    // propagation depuis le grand maître à travers les liens PTP
    const synced = {};
    if (gm) {
      synced[gm.sw] = 0; const q = [gm.sw];
      while (q.length) {
        const s = q.shift();
        for (const l of FAB.links) {
          if (l.color !== c || !R.up[l.id].up || !R.up[l.id].ptp) continue;
          const o = l.a.sw === s ? l.b.sw : l.b.sw === s ? l.a.sw : null;
          if (!o || synced[o] != null) continue;
          if (FAB.switches[o].running.ptp.domain !== FAB.switches[s].running.ptp.domain) continue;
          synced[o] = synced[s] + 1; q.push(o);
        }
      }
    }
    R.ptp[c] = { gm, synced };
    for (const sw of Object.values(FAB.switches)) if (sw.color === c && sw.power && synced[sw.id] == null && sw.running.ptp.mode !== 'disabled') iss('warn', `PTP ${CLABEL[c]} : ${sw.running.hostname} n'est pas synchronisé`, sw.running.ptp.domain !== PTP_REF.domain ? `Domaine ${sw.running.ptp.domain} au lieu de ${PTP_REF.domain} : la leaf devient sa propre référence (horloge libre).` : 'Aucun chemin PTP vers le grand maître (ports uplink sans « ptp enable » ?).', { sw: sw.id, color: c });
  }
  // état PTP de chaque appareil (meilleur des deux réseaux)
  for (const d of Object.values(FAB.devices)) {
    if (d.kind === 'gm' || d.kind === 'nmos') continue;
    let best = null;
    for (const c of COLORS) {
      const n = d.nics[c]; if (!n) continue; const nr = R.nic[d.id + ':' + c]; if (!nr || !nr.up) continue;
      const sw = FAB.switches[n.sw]; const p = portCfg(sw.id, n.port); const P = R.ptp[c];
      let s;
      if (sw.running.ptp.mode === 'disabled') s = { state: 'unlocked', why: `PTP désactivé sur ${sw.running.hostname}` };
      else if (!p.ptp) s = { state: 'unlocked', why: `pas de « ptp enable » sur ${n.port}` };
      else if (sw.running.ptp.domain !== d.ptp.domain) s = { state: 'unlocked', why: `domaine ${sw.running.ptp.domain} ≠ ${d.ptp.domain} (appareil)` };
      else if (P.synced[sw.id] == null) s = { state: 'free', why: `${sw.running.hostname} non synchronisé : horloge libre` };
      else if (P.gm && !P.gm.traceable) s = { state: 'free', why: `calé sur ${P.gm.name} (horloge libre, non GPS)` };
      else {
        const hops = P.synced[sw.id] + 1;
        const noisy = !sw.running.qos.ptpPriority && Object.entries(R.linkLoad).some(([k, v]) => k.startsWith(d.id + ':' + c) && v.load > 0.8 * v.cap);
        s = { state: noisy ? 'noisy' : 'locked', hops, offset: Math.round(hops * 12 + (noisy ? 900 : 0)), why: noisy ? 'PTP non prioritaire sur un lien chargé : gigue de plusieurs centaines de ns' : '' };
      }
      s.color = c;
      const rank = { locked: 0, noisy: 1, free: 2, unlocked: 3 };
      if (!best || rank[s.state] < rank[best.state]) best = s;
    }
    R.devPtp[d.id] = best || { state: 'unlocked', why: 'aucun lien réseau' };
    if (d.kind === 'ccu' && best && best.state !== 'locked' && best.state !== 'noisy') iss('err', `${d.name} : PTP ${best.state === 'free' ? 'non traçable' : 'non verrouillé'}`, best.why + '. La caméra n\'est plus en phase avec les autres sources (image qui saute à la commutation).', { dev: d.id });
  }
  // 5. NMOS (réseau de contrôle)
  const ctl = FAB.switches['SW-CTRL'];
  const regOk = FAB.registryUp && ctl.power && !ctl.running.ports.Ethernet17.shutdown && ctl.running.ports.Ethernet17.vlan === 20;
  if (!regOk) iss('err', 'Registre NMOS injoignable', !FAB.registryUp ? 'Le service du registre est arrêté.' : 'Le port du registre sur le switch de contrôle est coupé ou dans le mauvais VLAN.', { sw: 'SW-CTRL', port: 'Ethernet17' });
  for (const d of Object.values(FAB.devices)) {
    if (d.kind === 'gm' || d.kind === 'nmos') continue;
    const p = ctl.running.ports[d.ctl.port];
    const ok = regOk && ctl.power && p && !p.shutdown && p.vlan === 20 && inSubnet(d.ctlIp, '10.20.0.0/22');
    R.reg[d.id] = ok;
    if (regOk && !ok) iss('warn', `${d.name} non enregistré dans NMOS (IS-04)`, `Port de contrôle ${d.ctl.port} ${p && p.shutdown ? 'coupé' : p && p.vlan !== 20 ? 'dans le VLAN ' + p.vlan : ''} : ses émetteurs et récepteurs n'apparaissent pas au contrôleur.`, { sw: 'SW-CTRL', port: d.ctl.port, dev: d.id });
  }
  R.regOk = regOk;
  // configurations non enregistrées
  for (const sw of Object.values(FAB.switches)) if (JSON.stringify(sw.running) !== JSON.stringify(sw.startup)) iss('info', `${sw.running.hostname} : configuration modifiée non enregistrée`, '« write memory » pour la conserver après un redémarrage.', { sw: sw.id });
  if (R.unprotected) iss('warn', `${R.unprotected} réception(s) sans protection 2022-7`, 'Elles ne passent plus que par un seul réseau : aucune conséquence à l\'image, mais la prochaine panne sera visible.', {});
  for (const [k, v] of Object.entries(FAB.timers)) if (v != null) { const sw = FAB.switches[k]; iss(v > QUERIER_TIMEOUT ? 'err' : 'warn', `Pas de querier IGMP sur ${sw.running.hostname}`, v > QUERIER_TIMEOUT ? 'Les entrées de snooping ont expiré : les récepteurs de cette leaf ne reçoivent plus rien.' : `Les entrées de snooping vont expirer dans ${Math.max(0, Math.round(QUERIER_TIMEOUT - v))} s (≈ 260 s dans la réalité).`, { sw: k, color: sw.color }); }
  const rank = { err: 0, warn: 1, info: 2 };
  issues.sort((a, b) => rank[a.sev] - rank[b.sev]);
  FAB.res = R; FAB.issues = issues;
  return R;
}
function linkName(k) {
  const parts = k.split(':'); const dir = parts.pop();
  if (FAB.devices[parts[0]]) return `${FAB.devices[parts[0]].name} (${CLABEL[parts[1]]}) ${dir === 'up' ? '→ leaf' : '← leaf'}`;
  const l = FAB.links.find((x) => x.id === parts.join(':')); return l ? `${l.a.sw} ${l.a.port} ${dir === 'up' ? '→' : '←'} ${l.b.sw}` : k;
}
export { linkName };

// ---------------- interface avec le reste du simulateur ----------------
let evalT = 0, dirty = true;
export function markDirty() { dirty = true; FAB.ver++; }
export function updateFabric(dt, routeMap, recPhase) {
  if (!S.ipMode) return;
  if (FAB.key !== topoKey()) buildFabric();
  for (const k of Object.keys(FAB.timers)) FAB.timers[k] += dt;
  const mk = JSON.stringify(routeMap) + JSON.stringify(recPhase);
  if (mk !== FAB.lastMap) { FAB.lastMap = mk; dirty = true; }
  FAB.routeMap = routeMap; FAB.recPhase = recPhase;
  evalT += dt;
  if (dirty || evalT > 1) { evalT = 0; dirty = false; evaluate(); emit('fabric'); }
}
// ce que reçoit une destination de la grille (identifiant de récepteur) pour une source donnée
export function delivery(src, dest) {
  if (!S.ipMode || !FAB.res) return { ok: true, loss: 0 };
  const s = FAB.res.rxState[dest];
  const fid = 'v:' + src;
  if (s && (s.flow === fid || s.flow.startsWith(fid + '#'))) return s;
  return { ok: true, loss: 0 };
}
// une réception (identifiant de récepteur) arrive-t-elle sans perte ?
export function rxOk(rx) { if (!S.ipMode || !FAB.res) return true; const s = FAB.res.rxState[rx]; return !s || (s.ok && !(s.loss > 0.3)); }
export function devicePtp(id) { return FAB.res ? FAB.res.devPtp[id] : null; }
export function camPtpOk(camId) {
  if (!S.ipMode || !FAB.res) return true;
  const d = FAB.devices['ccu' + camId]; if (!d) return true;
  const p = FAB.res.devPtp[d.id]; return !p || p.state === 'locked' || p.state === 'noisy';
}
export function setSwitchPower(id, on) {
  const sw = FAB.switches[id]; if (!sw) return;
  if (!on) sw.power = false; else { sw.power = true; sw.running = clone(sw.startup); }
  markDirty();
}
export function writeMemory(id) { const sw = FAB.switches[id]; sw.startup = clone(sw.running); markDirty(); }
export function loadReference(id) { const sw = FAB.switches[id]; sw.running = referenceConfig(sw); for (const d of Object.values(FAB.devices)) for (const c of COLORS) { const n = d.nics[c]; if (n && n.sw === id && !sw.running.ports[n.port].desc) sw.running.ports[n.port].desc = d.name; } markDirty(); }
export function loadFactory(id) { const sw = FAB.switches[id]; sw.running = factoryConfig(sw); markDirty(); }

// ---------------- vues utiles à l'interface et au CLI ----------------
let peerIdx = { b: -1, m: {} };
export function portPeer(swId, port) {
  if (peerIdx.b !== FAB.build) {
    const m = {};
    for (const d of Object.values(FAB.devices)) {
      for (const c of COLORS) { const n = d.nics[c]; if (n) { m[n.sw + '|' + n.port] = { kind: d.kind === 'gm' ? 'gm' : 'dev', dev: d, color: c }; if (n.port2) m[n.sw + '|' + n.port2] = { kind: 'dev', dev: d, color: c, lane: 2 }; } }
      if (d.ctl && d.ctl.port) m['SW-CTRL|' + d.ctl.port] = { kind: 'ctl', dev: d };
    }
    for (const l of FAB.links) { m[l.a.sw + '|' + l.a.port] = { kind: 'link', link: l, side: 'a', other: l.b }; m[l.b.sw + '|' + l.b.port] = { kind: 'link', link: l, side: 'b', other: l.a }; }
    for (const sw of Object.values(FAB.switches)) { const k = sw.id + '|' + PROBE_PORT[sw.role]; if (!m[k]) m[k] = { kind: 'probe', dev: { id: 'probe', name: 'PC de mesure (analyseur)' } }; }
    peerIdx = { b: FAB.build, m };
  }
  return peerIdx.m[swId + '|' + port] || null;
}
export function portState(swId, port) {
  const sw = FAB.switches[swId]; const R = FAB.res; const p = sw.running.ports[port];
  const peer = portPeer(swId, port);
  const ld = (k) => (R && R.linkLoad[k]) || { load: 0, cap: 0, n: 0 };
  if (!sw.power) return { status: 'down', peer, reason: 'commutateur hors tension', inL: ld(''), outL: ld('') };
  if (p.shutdown) return { status: 'disabled', peer, reason: 'shutdown', inL: ld(''), outL: ld('') };
  if (!peer) return { status: 'notconnect', peer, reason: 'rien de raccordé', inL: ld(''), outL: ld('') };
  if (peer.kind === 'ctl') return { status: 'connected', peer, reason: '', inL: ld(''), outL: ld('') };
  if (peer.kind === 'probe') { const mon = Object.values(sw.running.monitor || {}).find((m) => m.dest === port); return { status: 'connected', peer, reason: '', inL: ld(''), outL: mon ? spanLoad(sw.id, mon) : ld(''), span: mon }; }
  if (peer.kind === 'link') {
    const st = R.up[peer.link.id];
    const a = peer.side === 'a';
    return { status: st.up ? 'connected' : 'notconnect', peer, reason: st.up ? (st.ospf !== 'FULL' ? 'OSPF : ' + st.ospf : !st.pim ? 'pas de voisin PIM' : '') : st.reason, inL: ld(peer.link.id + (a ? ':down' : ':up')), outL: ld(peer.link.id + (a ? ':up' : ':down')), link: st };
  }
  const n = R.nic[peer.dev.id + ':' + peer.color] || { up: false, why: '' };
  // agrégat de deux liens : la charge se répartit sur les deux ports
  const half = (L) => (n.lanes === 2 ? { load: L.load / 2, cap: L.cap / 2, n: L.n } : peer.lane === 2 ? { load: 0, cap: 0, n: 0 } : L);
  return { status: n.up ? 'connected' : 'notconnect', peer, reason: n.reach ? (n.conflict ? 'conflit d\'adresse IP' : peer.lane === 2 && n.lanes !== 2 ? 'lien 2 hors agrégat (configuration différente)' : '') : n.why, inL: half(ld(`${peer.dev.id}:${peer.color}:up`)), outL: half(ld(`${peer.dev.id}:${peer.color}:down`)), nic: n };
}
// charge recopiée vers la destination d'une session miroir
export function spanLoad(swId, mon) {
  const sw = FAB.switches[swId]; const cap = SPEED_GBPS[sw.running.ports[mon.dest].speed];
  if (!mon.src) return { load: 0, cap, n: 0 };
  const st = portState(swId, mon.src); let load = 0, n = 0;
  if (mon.dir !== 'tx') { load += st.inL.load; n += st.inL.n; }
  if (mon.dir !== 'rx') { load += st.outL.load; n += st.outL.n; }
  return { load, cap, n };
}
const hx = (n) => (n & 255).toString(16).padStart(2, '0');
export function clockId(id) {
  if (/^gm\d$/.test(id)) return `ec:46:70:ff:fe:00:00:0${id.slice(2)}`;
  const sw = FAB.switches[id];
  if (sw) return `28:99:3a:ff:fe:${hx(CNUM[sw.color] || 3)}:${hx(sw.k || 0)}:${hx(sw.s || 0)}`;
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `08:00:11:ff:fe:${hx(h >> 16)}:${hx(h >> 8)}:${hx(h)}`;
}
// description SDP d'un émetteur (deux jambes rouge / bleu, ST 2022-7)
export function sdpOf(fid) {
  const f = FAB.flows[fid]; if (!f) return '';
  const d = FAB.devices[f.dev]; const uhd = S.format === 'UHD', hdi = S.format === 'HDi';
  const gmId = FAB.res && FAB.res.gmActive.red ? FAB.res.gmActive.red.id : 'gm1';
  const ref = `a=ts-refclk:ptp=IEEE1588-2008:${clockId(gmId).toUpperCase().replace(/:/g, '-')}:${PTP_REF.domain}`;
  const L = [`v=0`, `o=- ${1700000000 + f.n * 97} ${FAB.ver} IN IP4 ${d.nics.red ? d.nics.red.ip : d.ctlIp}`, `s=${f.label}`, `i=${d.name} · ${f.kind === 'audio' ? 'ST 2110-30' : f.kind === 'anc' ? 'ST 2110-40' : f.kind === 'jxs' ? 'ST 2110-22' : 'ST 2110-20'}`, `t=0 0`, `a=group:DUP primary secondary`];
  for (const c of COLORS) {
    const n = d.nics[c]; if (!n) continue;
    const g = f.groups[c];
    if (f.kind === 'audio') {
      L.push(`m=audio ${f.udp} RTP/AVP ${f.pt}`, `c=IN IP4 ${g}/64`, `a=source-filter: incl IN IP4 ${g} ${n.ip}`, `a=rtpmap:${f.pt} L24/48000/${f.ch || 2}`, `a=fmtp:${f.pt} channel-order=SMPTE2110.(${(f.ch || 2) === 2 ? 'ST' : (f.ch || 2) === 8 ? 'SGRP,SGRP' : 'U0' + (f.ch || 2)})`, `a=ptime:1`, `a=maxptime:1`);
    } else if (f.kind === 'anc') {
      L.push(`m=video ${f.udp} RTP/AVP ${f.pt}`, `c=IN IP4 ${g}/64`, `a=source-filter: incl IN IP4 ${g} ${n.ip}`, `a=rtpmap:${f.pt} smpte291/90000`, `a=fmtp:${f.pt} DID_SDID={0x60,0x60}; VPID_Code=${uhd ? 206 : 133}`);
    } else if (f.kind === 'jxs') {
      L.push(`m=video ${f.udp} RTP/AVP ${f.pt}`, `c=IN IP4 ${g}/64`, `a=source-filter: incl IN IP4 ${g} ${n.ip}`, `a=rtpmap:${f.pt} jxsv/90000`, `a=fmtp:${f.pt} packetmode=0; profile=High444.12; level=${uhd ? '4k-2' : '1080p-2'}; sublevel=Sublev3bpp; sampling=YCbCr-4:2:2; width=${uhd ? 3840 : 1920}; height=${uhd ? 2160 : 1080}; exactframerate=50; depth=10; colorimetry=${uhd ? 'BT2100' : 'BT709'}; TCS=${uhd ? 'HLG' : 'SDR'}; SSN=ST2110-22:2019; TP=2110TPN`, `b=AS:${Math.round(f.gbps * 1e6)}`);
    } else {
      L.push(`m=video ${f.udp} RTP/AVP ${f.pt}`, `c=IN IP4 ${g}/64`, `a=source-filter: incl IN IP4 ${g} ${n.ip}`, `a=rtpmap:${f.pt} raw/90000`,
        `a=fmtp:${f.pt} sampling=YCbCr-4:2:2; width=${uhd ? 3840 : 1920}; height=${uhd ? 2160 : 1080}; exactframerate=${hdi ? 25 : 50}; depth=10; TCS=${uhd ? 'HLG' : 'SDR'}; colorimetry=${uhd ? 'BT2100' : 'BT709'}; PM=2110GPM; SSN=ST2110-20:2017; TP=2110TPN;${hdi ? ' interlace;' : ''}`);
    }
    L.push(ref, `a=mediaclk:direct=0`, `a=mid:${c === 'red' ? 'primary' : 'secondary'}`);
  }
  return L.join('\n');
}

// remise à zéro complète (« tout réparer ») : configurations de référence, grands maîtres, registre
export function resetFabric() {
  FAB.switches = {}; FAB.devices = {}; FAB.mode = 'pim'; FAB.registryUp = true; FAB.timers = {};
  FAB.gm = { gm1: { up: true, gps: true, priority1: 100, priority2: 128 }, gm2: { up: true, gps: true, priority1: 110, priority2: 128 } };
  if (S.ipMode) buildFabric(); else FAB.key = '';
  markDirty();
}
