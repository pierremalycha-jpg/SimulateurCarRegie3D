// @ts-check
// ----------------------------------------------------------------------------------
// Un petit réseau de niveau 2, pour les vues « table MAC » et « VLAN » : des commutateurs qui apprennent
// l'adresse source de chaque trame (table MAC par VLAN), qui recopient une diffusion ou une adresse
// inconnue sur tous les ports du VLAN (inondation), et qui étiquettent (802.1Q) les trames sur un trunk.
// Les trames sont animées par le Reseau de materiel.js ; ici, seulement la logique (testable sans 3D).
// ----------------------------------------------------------------------------------
export const DIFFUSION = 'FF:FF:FF:FF:FF:FF';

export class L2 {
  constructor() {
    /** @type {Map<string, { id: string, ports: Map<number, { vlan: number, trunk?: number[], link?: any, peer?: { sw?: string, host?: string, port?: number } }>, table: Map<string, { port: number, vlan: number, age: number }> }>} */
    this.sw = new Map();
    /** @type {Map<string, { id: string, mac: string, ip: string, sw: string, port: number, link?: any }>} */
    this.hosts = new Map();
    /** journal des décisions (pour le panneau et les tests) */
    this.log = [];
  }
  addSwitch(id) { this.sw.set(id, { id, ports: new Map(), table: new Map() }); return this; }
  /** un port access dans un VLAN, ou un trunk (vlan 0, trunk = VLAN autorisés) */
  port(sw, n, vlan, trunk) { this.sw.get(sw).ports.set(n, { vlan, trunk }); return this; }
  addHost(id, mac, ip, sw, port) { this.hosts.set(id, { id, mac, ip, sw, port }); this.sw.get(sw).ports.get(port).peer = { host: id }; return this; }
  /** deux commutateurs reliés port à port (un trunk) */
  trunk(a, pa, b, pb) { this.sw.get(a).ports.get(pa).peer = { sw: b, port: pb }; this.sw.get(b).ports.get(pb).peer = { sw: a, port: pa }; return this; }
  vlanOf(sw, port) { return this.sw.get(sw).ports.get(port).vlan; }
  hostByMac(mac) { for (const h of this.hosts.values()) if (h.mac === mac) return h; return null; }
  clearTables() { for (const s of this.sw.values()) s.table.clear(); this.log.length = 0; }
  /**
   * Une trame entre dans le commutateur sw par le port p (étiquette vlan si elle vient d'un trunk) :
   * il apprend la source et renvoie les ports de sortie, avec le VLAN de la trame et ce qu'il a décidé.
   * @returns {{ vlan: number, out: number[], decision: 'connue' | 'inondation' | 'diffusion' | 'filtrée', learned: boolean }}
   */
  forward(sw, p, src, dst, tagVlan = 0) {
    const S = this.sw.get(sw), P = S.ports.get(p);
    const vlan = P.trunk ? tagVlan : P.vlan;
    if (P.trunk && !P.trunk.includes(vlan)) { this.log.push({ sw, p, src, dst, vlan, decision: 'filtrée', out: [] }); return { vlan, out: [], decision: 'filtrée', learned: false }; }
    const key = vlan + '|' + src;
    const before = S.table.get(key);
    const learned = !before || before.port !== p;
    S.table.set(key, { port: p, vlan, age: 0 });
    const inVlan = (n, x) => n !== p && (x.trunk ? x.trunk.includes(vlan) : x.vlan === vlan) && !!x.peer;
    /** @type {number[]} */
    let out;
    /** @type {'connue' | 'inondation' | 'diffusion'} */
    let decision;
    if (dst === DIFFUSION) { out = [...S.ports.entries()].filter(([n, x]) => inVlan(n, x)).map(([n]) => n); decision = 'diffusion'; }
    else {
      const hit = S.table.get(vlan + '|' + dst);
      if (hit) { out = hit.port === p ? [] : [hit.port]; decision = 'connue'; }
      else { out = [...S.ports.entries()].filter(([n, x]) => inVlan(n, x)).map(([n]) => n); decision = 'inondation'; }
    }
    this.log.push({ sw, p, src, dst, vlan, decision, out });
    return { vlan, out, decision, learned };
  }
  /** la table d'un commutateur, triée par port */
  table(sw) { return [...this.sw.get(sw).table.entries()].map(([k, v]) => ({ mac: k.split('|')[1], ...v })).sort((a, b) => a.port - b.port || a.vlan - b.vlan); }
}
