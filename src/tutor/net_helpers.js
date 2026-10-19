// @ts-check
import { FAB, COLORS, CNUM, vlanOf, sviIp, p2p, PTP_REF, SSM_REF } from '../net/fabric.js';
import { ospfNeighbors } from '../net/cli.js';

// ----------------------------------------------------------------------------------
// Ce que le chef de car lit dans le réseau pour expliquer et vérifier : ports des appareils,
// adresses attendues, état des voisins, des flux et de PTP. Tout est calculé à partir du
// dispositif réel (nombre de caméras, ports occupés).
// ----------------------------------------------------------------------------------
export const SW = (id) => FAB.switches[id];
export const CFG = (id) => (FAB.switches[id] ? FAB.switches[id].running : null);
export const host = (id) => (FAB.switches[id] ? FAB.switches[id].running.hostname : id);
export const refHost = (id) => (FAB.switches[id] ? FAB.switches[id].hostname : id);

// ports d'un commutateur où sont branchés des appareils : [{ port, dev }]
export function devicePorts(id) {
  const out = [];
  for (const d of Object.values(FAB.devices)) for (const c of COLORS) {
    const n = d.nics[c];
    if (n && n.sw === id) { out.push({ port: n.port, dev: d }); if (n.port2) out.push({ port: n.port2, dev: d }); }
  }
  return out.sort((a, b) => num(a.port) - num(b.port));
}
const num = (p) => +String(p).replace(/\D/g, '');
// « ethernet1-7,9-11 » : la plage de ports telle qu'on la tape
export function portRange(ports) {
  const n = [...new Set(ports.map(num))].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < n.length; i++) {
    let j = i; while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++;
    parts.push(i === j ? String(n[i]) : `${n[i]}-${n[j]}`); i = j;
  }
  return 'ethernet' + parts.join(',');
}
export const portsShort = (ports) => portRange(ports).replace('ethernet', 'Et');
// les quatre uplinks d'une leaf (Ethernet49-52) : spine visée et adresse /31 attendue
export function uplinks(id) {
  const sw = SW(id); const c = sw.color;
  return [49, 50, 51, 52].map((n) => { const s = n <= 50 ? 1 : 2, j = (n - 49) % 2; const a = p2p(c, sw.k, s, j); return { port: 'Ethernet' + n, s, j, ip: `${a.leaf}/31`, peer: a.spine, spine: `SPINE-${c === 'red' ? 'R' : 'B'}${s}` }; });
}
export const leafPlan = (id) => {
  const sw = SW(id); const c = sw.color;
  return { color: c, k: sw.k, vlan: vlanOf(c, sw.k), svi: `${sviIp(c, sw.k)}/24`, gw: sviIp(c, sw.k), subnet: `10.${CNUM[c]}.${sw.k}.0/24`, loopback: sw.loopback, name: `MEDIA-${c === 'red' ? 'R' : 'B'}${sw.k}-${String(sw.zone).toUpperCase()}`, ssm: SSM_REF, domain: PTP_REF.domain };
};

// ---------------- vérifications ----------------
export const accessOk = (id) => { const c = CFG(id), v = leafPlan(id).vlan; return devicePorts(id).every(({ port }) => c.ports[port].mode === 'access' && c.ports[port].vlan === v); };
export const uplinkOk = (id, u) => { const p = CFG(id).ports[u.port]; return p.mode === 'routed' && p.ip === u.ip && p.speed === '100g' && (p.fec === 'rs' || p.fec === 'auto') && !p.shutdown; };
export const ospfFull = (id) => ospfNeighbors(SW(id)).filter((n) => n.state === 'FULL').length;
export const ptpSynced = (id) => { const sw = SW(id); const R = FAB.res; return !!(R && R.ptp[sw.color] && R.ptp[sw.color].synced[sw.id] != null); };
export const issuesOf = (id) => FAB.issues.filter((i) => i.sw === id && i.sev !== 'info');
export const saved = (id) => JSON.stringify(SW(id).running) === JSON.stringify(SW(id).startup);
// réceptions : perdues (rien reçu) et non protégées (reçues par un seul réseau)
export function rxSummary() {
  const rs = FAB.res ? Object.entries(FAB.res.rxState) : [];
  return { total: rs.length, lost: rs.filter(([, r]) => !r.ok).map(([k]) => k), single: rs.filter(([, r]) => r.ok && !r.protected).map(([k]) => k) };
}
// flux émis par les appareils d'un commutateur et protégés de nouveau
export function devFlowsProtected(id) {
  const devs = new Set(devicePorts(id).map((x) => x.dev.id));
  const rs = FAB.res ? Object.values(FAB.res.rxState) : [];
  return rs.filter((r) => FAB.flows[r.flow] && devs.has(FAB.flows[r.flow].dev)).every((r) => r.ok && r.protected);
}
