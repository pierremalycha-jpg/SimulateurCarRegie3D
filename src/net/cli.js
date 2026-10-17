import { FAB, COLORS, CLABEL, CNUM, LEAVES, vlanOf, ipToInt, inSubnet, SPEED_GBPS, markDirty, writeMemory, clone, portPeer, portState, clockId, PTP_REF, linkName, spanLoad } from './fabric.js';

// ----------------------------------------------------------------------------------
// Ligne de commande des commutateurs, inspirée d'EOS / NX-OS (syntaxe simplifiée).
// Elle lit et modifie la même configuration que l'interface graphique.
//   exec      : show …, configure terminal, write memory, reload, ping
//   config    : hostname, ip routing, ip multicast-routing, ip pim ssm range, ip igmp snooping,
//               vlan, interface, router ospf, ptp …, qos …
//   if / vlan / ospf : sous-modes
// Les mots peuvent être abrégés (sh int st, conf t, int e1…). « ? » liste les commandes.
// ----------------------------------------------------------------------------------
export function cliSession(sw) { return { sw, mode: 'exec', ctx: null, hist: [] }; }
const swOf = (s) => FAB.switches[s.sw];
const cfgOf = (s) => swOf(s).running;
export function cliPrompt(s) {
  const h = cfgOf(s).hostname;
  if (s.mode === 'exec') return h + '#';
  if (s.mode === 'config') return h + '(config)#';
  if (s.mode === 'if') return `${h}(config-if-${shortIf(s.ctx.names)})#`;
  if (s.mode === 'vlan') return `${h}(config-vlan-${s.ctx})#`;
  if (s.mode === 'ospf') return h + '(config-router-ospf)#';
  return h + '#';
}
const shortIf = (names) => (names.length > 1 ? names.map((n) => n.replace('Ethernet', 'Et')).join(',').slice(0, 24) : names[0].replace('Ethernet', 'Et').replace('Vlan', 'Vl').replace('Loopback', 'Lo'));
export const ifShort = (n) => n.replace('Ethernet', 'Et').replace('Vlan', 'Vl').replace('Loopback', 'Lo');

// ---------------- analyse des noms d'interfaces ----------------
function parseIf(sw, tok) {
  const m = /^(e|et|eth|ethe|ether|ethern|etherne|ethernet|v|vl|vla|vlan|lo|loo|loop|loopb|loopba|loopbac|loopback)([\d,\-]+)$/i.exec(tok);
  if (!m) return null;
  const t = m[1].toLowerCase();
  if (t[0] === 'e') {
    const out = [];
    for (const part of m[2].split(',')) {
      const r = part.split('-').map(Number);
      if (r.some((x) => !Number.isInteger(x))) return null;
      const a = r[0], b = r[1] ?? r[0];
      for (let i = a; i <= b; i++) { if (!sw.hw.some((h) => h.name === 'Ethernet' + i)) return { err: `% Interface Ethernet${i} inexistante sur ce modèle` }; out.push('Ethernet' + i); }
    }
    return { type: 'eth', names: out };
  }
  if (t[0] === 'v') { const id = +m[2]; if (!(id >= 1 && id <= 4094)) return { err: '% VLAN hors plage (1-4094)' }; return { type: 'vlan', id, names: ['Vlan' + id] }; }
  if (+m[2] !== 0) return { err: '% Seule Loopback0 est disponible' };
  return { type: 'lo', names: ['Loopback0'] };
}
// regroupe « ethernet 1 » → « ethernet1 »
function joinIfTokens(toks) {
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    if (/^(e|et|eth|ethe|ether|ethern|etherne|ethernet|vl|vla|vlan|lo|loo|loop|loopb|loopba|loopbac|loopback)$/i.test(toks[i]) && /^[\d,\-]+$/.test(toks[i + 1] || '') && i > 0 && /^(int|inte|inter|interf|interfa|interfac|interface|interfaces|in)$/i.test(toks[i - 1] + '')) { out.push(toks[i] + toks[i + 1]); i++; } else out.push(toks[i]);
  }
  return out;
}
const isIp = (t) => ipToInt(t) != null;
const isCidr = (t) => { const [a, l] = String(t).split('/'); return isIp(a) && /^\d+$/.test(l || '') && +l <= 32; };

// ---------------- grammaire ----------------
// motif : mots littéraux (alternatives a|b), <n> nombre, <ip>, <cidr>, <if> interface, <w> mot, <text> reste de la ligne
const C = (p, h, f) => ({ p: p.split(' '), h, f });
const SHOW = [
  C('show running-config', 'configuration active (running)', (s) => runningConfig(swOf(s))),
  C('show running-config interfaces <if>', 'configuration d\'une interface', (s, a) => runningConfig(swOf(s), a.if.names)),
  C('show startup-config', 'configuration enregistrée (startup)', (s) => runningConfig(swOf(s), null, true)),
  C('show interfaces status', 'état de tous les ports', (s) => showIntStatus(swOf(s))),
  C('show interfaces <if> status', 'état de ports choisis', (s, a) => showIntStatus(swOf(s), a.if.names)),
  C('show interfaces <if>', 'détail d\'une interface (débits, erreurs)', (s, a) => showInt(swOf(s), a.if)),
  C('show interfaces counters rates', 'débits par port', (s) => showRates(swOf(s))),
  C('show vlan', 'VLAN et ports', (s) => showVlan(swOf(s))),
  C('show ip interface brief', 'interfaces IP (L3)', (s) => showIpBrief(swOf(s))),
  C('show ip route', 'table de routage', (s) => showRoute(swOf(s))),
  C('show ip arp', 'table ARP', (s) => showArp(swOf(s))),
  C('show ip ospf neighbor|neighbors', 'voisins OSPF', (s) => showOspf(swOf(s))),
  C('show ip pim neighbor|neighbors', 'voisins PIM', (s) => showPim(swOf(s))),
  C('show ip mroute', 'routes multicast (S,G)', (s) => showMroute(swOf(s))),
  C('show ip igmp snooping groups', 'abonnements IGMPv3 par port', (s) => showIgmp(swOf(s))),
  C('show ip igmp snooping querier', 'querier IGMP par VLAN', (s) => showQuerier(swOf(s))),
  C('show ptp', 'état PTP (horloge frontière)', (s) => showPtp(swOf(s))),
  C('show ptp parent', 'maître et grand maître PTP', (s) => showPtpParent(swOf(s))),
  C('show ptp interface brief', 'état PTP de chaque port', (s) => showPtpInt(swOf(s))),
  C('show lldp neighbors|neighbor', 'voisins découverts (LLDP)', (s) => showLldp(swOf(s))),
  C('show monitor session', 'sessions miroir (SPAN)', (s) => showMonitor(swOf(s))),
  C('show qos maps', 'correspondance DSCP → file', (s) => showQos(swOf(s))),
  C('show logging', 'journal (événements récents)', (s) => showLog(swOf(s))),
  C('show version', 'modèle et logiciel', (s) => showVersion(swOf(s))),
];
const EXEC = [
  ...SHOW,
  C('configure terminal', 'passer en mode configuration', (s) => { s.mode = 'config'; s.ctx = null; return ''; }),
  C('configure', 'passer en mode configuration', (s) => { s.mode = 'config'; s.ctx = null; return ''; }),
  C('write memory', 'enregistrer la running dans la startup', (s) => { writeMemory(s.sw); return 'Copy completed successfully.'; }),
  C('write', 'enregistrer la configuration', (s) => { writeMemory(s.sw); return 'Copy completed successfully.'; }),
  C('copy running-config startup-config', 'enregistrer la configuration', (s) => { writeMemory(s.sw); return 'Copy completed successfully.'; }),
  C('reload', 'redémarrer (recharge la startup)', (s) => { const sw = swOf(s); const lost = JSON.stringify(sw.running) !== JSON.stringify(sw.startup); sw.running = clone(sw.startup); markDirty(); s.mode = 'exec'; return (lost ? '! Les modifications non enregistrées sont perdues.\n' : '') + 'Redémarrage… configuration de démarrage (startup) rechargée.'; }),
  C('ping <ip>', 'tester la joignabilité IP', (s, a) => ping(swOf(s), a.ip)),
  C('clear ip igmp snooping groups', 'vider les abonnements (ils reviennent au prochain query)', () => 'Abonnements effacés : les récepteurs répondent au prochain query du querier.'),
  C('exit', 'fermer la session', () => '(session fermée — rouvrez le terminal)'),
];
const CONFIG = [
  C('hostname <w>', 'nom du commutateur', (s, a) => { cfgOf(s).hostname = a.w; return ch(s); }),
  C('ip routing', 'activer le routage IP', (s) => { cfgOf(s).ipRouting = true; return ch(s); }),
  C('no ip routing', 'désactiver le routage IP', (s) => { cfgOf(s).ipRouting = false; return ch(s); }),
  C('ip multicast-routing', 'activer le routage multicast', (s) => { cfgOf(s).mcastRouting = true; return ch(s); }),
  C('no ip multicast-routing', 'désactiver le routage multicast', (s) => { cfgOf(s).mcastRouting = false; return ch(s); }),
  C('ip pim ssm range <cidr>', 'plage multicast traitée en SSM', (s, a) => { cfgOf(s).ssmRange = a.cidr; return ch(s); }),
  C('no ip pim ssm range', 'plage SSM par défaut (232.0.0.0/8)', (s) => { cfgOf(s).ssmRange = '232.0.0.0/8'; return ch(s); }),
  C('ip igmp snooping', 'activer le snooping IGMP', (s) => { cfgOf(s).igmpSnooping = true; return ch(s); }),
  C('no ip igmp snooping', 'désactiver le snooping IGMP (inondation !)', (s) => { cfgOf(s).igmpSnooping = false; return ch(s); }),
  C('ip igmp snooping vlan <n>', 'snooping sur un VLAN', (s, a) => vlanSet(s, a.n, { snooping: true })),
  C('no ip igmp snooping vlan <n>', 'pas de snooping sur ce VLAN', (s, a) => vlanSet(s, a.n, { snooping: false })),
  C('ip igmp snooping vlan <n> querier', 'querier IGMP de niveau 2 sur le VLAN', (s, a) => vlanSet(s, a.n, { querier: true })),
  C('no ip igmp snooping vlan <n> querier', 'retirer le querier du VLAN', (s, a) => vlanSet(s, a.n, { querier: false })),
  C('vlan <n>', 'créer / éditer un VLAN', (s, a) => { const c = cfgOf(s); if (a.n < 1 || a.n > 4094) return '% VLAN hors plage'; if (!c.vlans[a.n]) { c.vlans[a.n] = { name: 'VLAN' + String(a.n).padStart(4, '0'), snooping: true, querier: false }; markDirty(); } s.mode = 'vlan'; s.ctx = a.n; return ''; }),
  C('no vlan <n>', 'supprimer un VLAN', (s, a) => { const c = cfgOf(s); if (a.n === 1) return '% Le VLAN 1 ne peut pas être supprimé'; delete c.vlans[a.n]; return ch(s); }),
  C('interface <if>', 'configurer une interface (EthernetN, VlanN, Loopback0)', (s, a) => {
    const c = cfgOf(s);
    if (a.if.type === 'vlan' && !c.svis[a.if.id]) { c.svis[a.if.id] = { ip: '', pim: false, igmp: 0, ospf: false, shutdown: false }; markDirty(); }
    s.mode = 'if'; s.ctx = a.if; return '';
  }),
  C('no interface <if>', 'supprimer une interface Vlan', (s, a) => { if (a.if.type !== 'vlan') return '% Seules les interfaces Vlan peuvent être supprimées'; delete cfgOf(s).svis[a.if.id]; return ch(s); }),
  C('router ospf <n>', 'activer et configurer OSPF', (s) => { const c = cfgOf(s); if (!c.ospf.enabled) { c.ospf.enabled = true; markDirty(); } s.mode = 'ospf'; return ''; }),
  C('no router ospf <n>', 'supprimer OSPF', (s) => { cfgOf(s).ospf.enabled = false; return ch(s); }),
  C('ptp mode boundary|e2etransparent|disabled', 'rôle PTP du commutateur', (s, a) => { cfgOf(s).ptp.mode = a.lit === 'e2etransparent' ? 'transparent' : a.lit; return ch(s); }),
  C('no ptp mode', 'désactiver PTP', (s) => { cfgOf(s).ptp.mode = 'disabled'; return ch(s); }),
  C('ptp domain <n>', 'domaine PTP (ST 2059-2 : 127)', (s, a) => { if (a.n > 255) return '% Domaine 0-255'; cfgOf(s).ptp.domain = a.n; return ch(s); }),
  C('ptp profile smpte2059-2|default|aes67', 'profil PTP', (s, a) => { cfgOf(s).ptp.profile = a.lit; if (a.lit === 'smpte2059-2') Object.assign(cfgOf(s).ptp, { announce: PTP_REF.announce, sync: PTP_REF.sync, delayReq: PTP_REF.delayReq }); if (a.lit === 'default') Object.assign(cfgOf(s).ptp, { announce: 1, sync: 0, delayReq: 0 }); return ch(s); }),
  C('ptp priority1 <n>', 'priorité 1 (BMCA)', (s, a) => { cfgOf(s).ptp.priority1 = Math.min(255, a.n); return ch(s); }),
  C('ptp priority2 <n>', 'priorité 2 (BMCA)', (s, a) => { cfgOf(s).ptp.priority2 = Math.min(255, a.n); return ch(s); }),
  C('ptp announce interval <w>', 'intervalle Announce (log2 s)', (s, a) => ptpIv(s, 'announce', a.w)),
  C('ptp sync-message interval <w>', 'intervalle Sync (log2 s)', (s, a) => ptpIv(s, 'sync', a.w)),
  C('ptp delay-req interval <w>', 'intervalle Delay_Req (log2 s)', (s, a) => ptpIv(s, 'delayReq', a.w)),
  C('qos trust dscp', 'respecter le marquage DSCP', (s) => { cfgOf(s).qos.trust = 'dscp'; return ch(s); }),
  C('no qos trust', 'ignorer le DSCP', (s) => { cfgOf(s).qos.trust = 'none'; cfgOf(s).qos.ptpPriority = false; return ch(s); }),
  C('qos map dscp 46 to traffic-class 7', 'PTP dans la file prioritaire', (s) => { const q = cfgOf(s).qos; q.ptpPriority = true; if (q.trust !== 'dscp') { q.trust = 'dscp'; } return ch(s); }),
  C('no qos map dscp 46', 'PTP dans la file par défaut', (s) => { cfgOf(s).qos.ptpPriority = false; return ch(s); }),
  C('monitor session <n> source <if>', 'port à recopier (entrée et sortie)', (s, a) => monSet(s, a.n, { src: a.if.names[0], dir: 'both' }, a.if)),
  C('monitor session <n> source <if> rx|tx|both', 'port à recopier, sens choisi', (s, a) => monSet(s, a.n, { src: a.if.names[0], dir: a.lit }, a.if)),
  C('monitor session <n> destination <if>', 'port où est branché l\'analyseur', (s, a) => monSet(s, a.n, { dest: a.if.names[0] }, a.if)),
  C('no monitor session <n>', 'supprimer une session miroir', (s, a) => { delete (cfgOf(s).monitor || {})[a.n]; return ch(s); }),
  C('end', 'retour au mode exec', (s) => { s.mode = 'exec'; s.ctx = null; return ''; }),
  C('exit', 'remonter d\'un niveau', (s) => { s.mode = s.mode === 'config' ? 'exec' : 'config'; s.ctx = null; return ''; }),
];
const IF = [
  C('description <text>', 'description du port', (s, a) => ifSet(s, { desc: a.text })),
  C('no description', 'effacer la description', (s) => ifSet(s, { desc: '' })),
  C('shutdown', 'couper l\'interface', (s) => ifSet(s, { shutdown: true }, true)),
  C('no shutdown', 'activer l\'interface', (s) => ifSet(s, { shutdown: false }, true)),
  C('speed <w>', 'vitesse (10g, 25g, 40g, 100g)', (s, a) => { let v = a.w.toLowerCase().replace('forced', '').replace('full', ''); if (!SPEED_GBPS[v]) return '% Vitesse inconnue (1g, 10g, 25g, 40g, 100g)'; return ifSet(s, { speed: v }, false, v); }),
  C('speed forced <w>', 'vitesse forcée', (s, a) => { const v = a.w.toLowerCase().replace('full', ''); if (!SPEED_GBPS[v]) return '% Vitesse inconnue'; return ifSet(s, { speed: v }, false, v); }),
  C('error-correction encoding reed-solomon|fire-code', 'FEC (RS attendue à 25G / 100G sur optique SR)', (s, a) => ifSet(s, { fec: a.lit === 'reed-solomon' ? 'rs' : 'fc' })),
  C('no error-correction encoding', 'désactiver la FEC', (s) => ifSet(s, { fec: 'none' })),
  C('default error-correction encoding', 'FEC automatique', (s) => ifSet(s, { fec: 'auto' })),
  C('mtu <n>', 'taille maximale de trame (68-9214)', (s, a) => { if (a.n < 68 || a.n > 9214) return '% MTU 68-9214'; return ifSet(s, { mtu: a.n }); }),
  C('switchport', 'port de niveau 2', (s) => ifSet(s, { mode: 'access', ip: '' }, true)),
  C('no switchport', 'port routé (niveau 3)', (s) => ifSet(s, { mode: 'routed', vlan: 0 }, true)),
  C('switchport mode access|trunk', 'mode du port', (s, a) => ifSet(s, { mode: a.lit, ip: '' }, true)),
  C('switchport access vlan <n>', 'VLAN d\'accès', (s, a) => {
    const c = cfgOf(s); let msg = '';
    if (!c.vlans[a.n]) { c.vlans[a.n] = { name: 'VLAN' + String(a.n).padStart(4, '0'), snooping: true, querier: false }; msg = `! Le VLAN ${a.n} n'existait pas : il est créé.`; }
    const r = ifSet(s, { vlan: a.n, mode: 'access', ip: '' }, true); return [msg, r].filter(Boolean).join('\n');
  }),
  C('ip address <cidr>', 'adresse IP', (s, a) => {
    const c = cfgOf(s); const I = s.ctx;
    if (I.type === 'lo') { c.loopback = a.cidr.split('/')[0]; return ch(s); }
    if (I.type === 'vlan') { c.svis[I.id].ip = a.cidr; return ch(s); }
    for (const n of I.names) if (c.ports[n].mode !== 'routed') return `% ${n} est un port de niveau 2 : « no switchport » d'abord`;
    return ifSet(s, { ip: a.cidr });
  }),
  C('no ip address', 'retirer l\'adresse', (s) => { const c = cfgOf(s); const I = s.ctx; if (I.type === 'lo') c.loopback = ''; else if (I.type === 'vlan') c.svis[I.id].ip = ''; else return ifSet(s, { ip: '' }); return ch(s); }),
  C('pim ipv4 sparse-mode', 'activer PIM', (s) => l3Set(s, { pim: true })),
  C('ip pim sparse-mode', 'activer PIM', (s) => l3Set(s, { pim: true })),
  C('no pim ipv4 sparse-mode', 'retirer PIM', (s) => l3Set(s, { pim: false })),
  C('no ip pim sparse-mode', 'retirer PIM', (s) => l3Set(s, { pim: false })),
  C('ip igmp version <n>', 'version IGMP du querier (3 pour SSM)', (s, a) => { if (s.ctx.type !== 'vlan') return '% IGMP se configure sur une interface Vlan'; if (![1, 2, 3].includes(a.n)) return '% Version 1, 2 ou 3'; cfgOf(s).svis[s.ctx.id].igmp = a.n; return ch(s); }),
  C('ip igmp', 'activer IGMP (v3)', (s) => { if (s.ctx.type !== 'vlan') return '% IGMP se configure sur une interface Vlan'; cfgOf(s).svis[s.ctx.id].igmp = 3; return ch(s); }),
  C('no ip igmp', 'désactiver IGMP (plus de querier)', (s) => { if (s.ctx.type !== 'vlan') return '% IGMP se configure sur une interface Vlan'; cfgOf(s).svis[s.ctx.id].igmp = 0; return ch(s); }),
  C('ip ospf area <w>', 'annoncer l\'interface en OSPF', (s) => l3Set(s, { ospf: true })),
  C('ip router ospf <n> area <w>', 'annoncer l\'interface en OSPF', (s) => l3Set(s, { ospf: true })),
  C('no ip ospf area', 'retirer l\'interface d\'OSPF', (s) => l3Set(s, { ospf: false })),
  C('ptp enable', 'activer PTP sur le port', (s) => ifSet(s, { ptp: true })),
  C('no ptp enable', 'désactiver PTP sur le port', (s) => ifSet(s, { ptp: false })),
  C('ptp role master|dynamic', 'forcer le port maître (protection BMCA)', (s, a) => ifSet(s, { ptpRole: a.lit })),
  C('no ptp role', 'rôle PTP dynamique', (s) => ifSet(s, { ptpRole: 'dynamic' })),
];
const VLANM = [
  C('name <w>', 'nom du VLAN', (s, a) => { cfgOf(s).vlans[s.ctx].name = a.w; return ch(s); }),
];
const OSPFM = [
  C('router-id <ip>', 'identifiant OSPF (loopback)', (s, a) => { cfgOf(s).ospf.routerId = a.ip; return ch(s); }),
  C('shutdown', 'suspendre OSPF', (s) => { cfgOf(s).ospf.enabled = false; return ch(s); }),
  C('no shutdown', 'relancer OSPF', (s) => { cfgOf(s).ospf.enabled = true; return ch(s); }),
  C('passive-interface default', 'interfaces passives par défaut', () => '! Accepté (sans effet dans le simulateur)'),
  C('max-lsa <n>', 'limite de LSA', () => '! Accepté (sans effet dans le simulateur)'),
];
const ch = () => { markDirty(); return ''; };
function monSet(s, n, o, I) {
  if (I.type !== 'eth') return '% Une session miroir porte sur un port Ethernet';
  const c = cfgOf(s); c.monitor = c.monitor || {};
  const m = c.monitor[n] = { ...(c.monitor[n] || {}), ...o };
  if (m.src && m.src === m.dest) { delete m.dest; return '% La source et la destination doivent être différentes'; }
  return ch(s);
}
function vlanSet(s, n, o) { const c = cfgOf(s); if (!c.vlans[n]) return `% VLAN ${n} inexistant`; Object.assign(c.vlans[n], o); return ch(s); }
function ptpIv(s, k, w) { const v = +w; if (!Number.isInteger(v) || v < -7 || v > 4) return '% Intervalle en log2 secondes (-7 à 4)'; cfgOf(s).ptp[k] = v; return ch(s); }
function ifSet(s, o, l2, speed) {
  const c = cfgOf(s); const I = s.ctx; const sw = swOf(s);
  if (I.type === 'vlan') { if ('shutdown' in o) { c.svis[I.id].shutdown = o.shutdown; return ch(s); } return '% Commande non applicable à une interface Vlan'; }
  if (I.type === 'lo') return '% Commande non applicable à Loopback0';
  for (const n of I.names) if (speed && !sw.hw.find((h) => h.name === n).speeds.includes(speed)) return `% ${n} (${sw.hw.find((h) => h.name === n).type}) ne supporte pas ${speed}`;
  for (const n of I.names) Object.assign(c.ports[n], o);
  return ch(s);
}
function l3Set(s, o) {
  const c = cfgOf(s); const I = s.ctx;
  if (I.type === 'vlan') { Object.assign(c.svis[I.id], o); return ch(s); }
  if (I.type === 'lo') return ch(s);
  for (const n of I.names) if (c.ports[n].mode !== 'routed') return `% ${n} n'est pas routé : « no switchport » d'abord`;
  for (const n of I.names) Object.assign(c.ports[n], o);
  return ch(s);
}

// ---------------- moteur de correspondance ----------------
function matchTok(pt, tok, sw) {
  if (pt === '<n>') return /^\d+$/.test(tok) ? { n: +tok } : null;
  if (pt === '<ip>') return isIp(tok) ? { ip: tok } : null;
  if (pt === '<cidr>') return isCidr(tok) ? { cidr: tok } : null;
  if (pt === '<w>') return tok ? { w: tok } : null;
  if (pt === '<if>') { const r = parseIf(sw, tok); return r ? { if: r } : null; }
  const alts = pt.split('|'); const low = tok.toLowerCase();
  const hit = alts.filter((a) => a.startsWith(low));
  if (hit.length >= 1) return { lit: alts.includes(low) ? low : hit[0], word: true, cand: hit };
  return null;
}
function findCmd(list, toks, sw) {
  let cands = list.map((c) => ({ c, args: {} }));
  for (let i = 0; i < toks.length; i++) {
    const next = [];
    const lits = new Set();
    for (const x of cands) {
      const pt = x.c.p[i];
      if (pt == null) continue;
      if (pt === '<text>') { next.push({ c: x.c, args: { ...x.args, text: toks.slice(i).join(' ') }, done: true }); continue; }
      const m = matchTok(pt, toks[i], sw);
      if (!m) continue;
      if (m.amb) { lits.add('?' + pt); continue; }
      if (m.if && m.if.err) return { err: m.if.err };
      if (m.word) lits.add(pt.includes('|') ? pt + ':' + m.lit : m.lit);
      const a = { ...x.args }; if (m.word) { if (pt.includes('|')) a.lit = m.lit; } else Object.assign(a, m);
      next.push({ c: x.c, args: a, lit: m.word ? m.lit : null, exact: m.word && toks[i].toLowerCase() === m.lit });
    }
    // un mot abrégé qui correspond à plusieurs mots-clés différents est ambigu (sauf correspondance exacte)
    const words = new Set(next.filter((x) => x.lit && !x.done).map((x) => x.lit));
    if (words.size > 1) {
      const ex = next.filter((x) => x.exact);
      if (ex.length) cands = next.filter((x) => x.done || !x.lit || x.exact);
      else if (words.has('show')) cands = next.filter((x) => x.done || !x.lit || x.lit === 'show');
      else return { err: `% Commande ambiguë : « ${toks[i]} » (${[...words].join(', ')})` };
    } else cands = next;
    if ([...lits].some((l) => l.startsWith('?')) && !cands.length) return { err: `% Commande ambiguë : « ${toks[i]} »` };
    if (cands.some((x) => x.done)) { const d = cands.find((x) => x.done); return { cmd: d.c, args: d.args }; }
    if (!cands.length) return { err: `% Entrée invalide à « ${toks[i]} »`, pos: i };
  }
  const full = cands.filter((x) => x.c.p.length === toks.length);
  if (full.length) return { cmd: full[0].c, args: full[0].args };
  if (cands.length) return { err: '% Commande incomplète' };
  return { err: '% Entrée invalide' };
}
function listFor(s) {
  if (s.mode === 'exec') return EXEC;
  if (s.mode === 'config') return [...CONFIG, ...SHOW];
  if (s.mode === 'if') return [...IF, ...CONFIG, ...SHOW];
  if (s.mode === 'vlan') return [...VLANM, ...CONFIG, ...SHOW];
  if (s.mode === 'ospf') return [...OSPFM, ...CONFIG, ...SHOW];
  return EXEC;
}
const tokenize = (line) => joinIfTokens(line.trim().split(/\s+/).filter(Boolean));
export function runCli(s, line) {
  const sw = swOf(s);
  if (!sw.power) return '% Connexion perdue : le commutateur est hors tension.';
  let raw = line.trim(); if (!raw) return '';
  s.hist.push(raw); if (s.hist.length > 60) s.hist.shift();
  // filtre de sortie : | include / exclude / begin / section
  let filt = null;
  const pi = raw.indexOf(' | ');
  if (pi > 0) { const f = raw.slice(pi + 3).trim().split(/\s+/); raw = raw.slice(0, pi); filt = { k: (f[0] || '').toLowerCase(), v: f.slice(1).join(' ') }; }
  if (raw.endsWith('?')) return help(s, raw.slice(0, -1));
  if (/^do\s+/i.test(raw)) raw = raw.replace(/^do\s+/i, '');
  const toks = tokenize(raw);
  const own = s.mode === 'if' ? IF : s.mode === 'vlan' ? VLANM : s.mode === 'ospf' ? OSPFM : null;
  let r = own ? findCmd(own, toks, sw) : { err: 'x' };
  let fromOwn = !r.err;
  if (r.err) { const r2 = findCmd(listFor(s), toks, sw); if (!r2.err || !own) r = r2; }
  if (r.err) return r.err;
  // une commande du mode config tapée dans un sous-mode quitte ce sous-mode (comme sur un vrai commutateur)
  if (!fromOwn && own && CONFIG.includes(r.cmd) && !['end', 'exit'].includes(r.cmd.p[0])) { s.mode = 'config'; s.ctx = null; }
  s.lastCmd = r.cmd.p.join(' ');
  let out = r.cmd.f(s, r.args) || '';
  if (filt && out) {
    const L = out.split('\n'); const v = filt.v.toLowerCase();
    if ('include'.startsWith(filt.k)) out = L.filter((l) => l.toLowerCase().includes(v)).join('\n');
    else if ('exclude'.startsWith(filt.k)) out = L.filter((l) => !l.toLowerCase().includes(v)).join('\n');
    else if ('begin'.startsWith(filt.k)) { const i = L.findIndex((l) => l.toLowerCase().includes(v)); out = i < 0 ? '' : L.slice(i).join('\n'); }
    else if ('section'.startsWith(filt.k)) { const o = []; let on = false; for (const l of L) { if (!l.startsWith(' ')) on = l.toLowerCase().includes(v); if (on) o.push(l); } out = o.join('\n'); }
  }
  return out;
}
function help(s, partial) {
  const toks = tokenize(partial);
  const endsSpace = /\s$/.test(partial) || !partial;
  const list = listFor(s); const sw = swOf(s);
  const out = new Map();
  for (const c of list) {
    let ok = true;
    const n = endsSpace ? toks.length : toks.length - 1;
    for (let i = 0; i < n; i++) { const pt = c.p[i]; if (!pt) { ok = false; break; } if (pt === '<text>') break; const m = matchTok(pt, toks[i], sw); if (!m || m.amb) { ok = false; break; } }
    if (!ok) continue;
    const pt = c.p[n]; if (!pt) { out.set('<cr>', { h: c.h, len: 0 }); continue; }
    if (!endsSpace) { const last = toks[toks.length - 1]; const m = matchTok(pt, last, sw); if (!m) continue; }
    const key = pt.startsWith('<') ? pt : pt.split('|').join(' | ');
    if (!out.has(key) || (out.get(key).len > c.p.length)) out.set(key, { h: c.h, len: c.p.length });
  }
  if (!out.size) return '% Aucune commande ne correspond';
  return [...out].map(([k, v]) => `  ${k.padEnd(28)} ${v.h}`).join('\n');
}
// complétion (touche Tab) du dernier mot
export function cliComplete(s, line) {
  const toks = line.split(/\s+/); const last = toks[toks.length - 1];
  if (!last) return line;
  const prev = tokenize(toks.slice(0, -1).join(' '));
  const sw = swOf(s); const words = new Set();
  for (const c of listFor(s)) {
    let ok = true;
    for (let i = 0; i < prev.length; i++) { const pt = c.p[i]; if (!pt) { ok = false; break; } const m = matchTok(pt, prev[i], sw); if (!m || m.amb) { ok = false; break; } }
    if (!ok) continue;
    const pt = c.p[prev.length]; if (!pt || pt.startsWith('<')) continue;
    for (const a of pt.split('|')) if (a.startsWith(last.toLowerCase())) words.add(a);
  }
  if (words.size === 1) { toks[toks.length - 1] = [...words][0]; return toks.join(' ') + ' '; }
  return line;
}

// ---------------- rendu des configurations ----------------
const FEC_TXT = { rs: 'reed-solomon', fc: 'fire-code' };
export function runningConfig(sw, only, startup) {
  const c = startup ? sw.startup : sw.running; const L = [];
  const fac = { speed: null, mtu: 9214 };
  if (!only) {
    L.push(`! ${sw.model} · ${startup ? 'startup-config' : 'running-config'}`, `! simulateur de car régie — syntaxe de type EOS / NX-OS`, '!', `hostname ${c.hostname}`, '!');
    if (c.igmpSnooping === false) L.push('no ip igmp snooping');
    for (const [id, v] of Object.entries(c.vlans)) { if (!v.snooping) L.push(`no ip igmp snooping vlan ${id}`); if (v.querier) L.push(`ip igmp snooping vlan ${id} querier`); }
    if (c.qos.trust === 'dscp') L.push('qos trust dscp');
    if (c.qos.ptpPriority) L.push('qos map dscp 46 to traffic-class 7');
    L.push('!');
    if (c.ptp.mode !== 'disabled') {
      L.push(`ptp mode ${c.ptp.mode === 'transparent' ? 'e2etransparent' : c.ptp.mode}`, `ptp profile ${c.ptp.profile}`, `ptp domain ${c.ptp.domain}`, `ptp priority1 ${c.ptp.priority1}`, `ptp priority2 ${c.ptp.priority2}`, `ptp announce interval ${c.ptp.announce}`, `ptp sync-message interval ${c.ptp.sync}`, `ptp delay-req interval ${c.ptp.delayReq}`, '!');
    }
    for (const [id, v] of Object.entries(c.vlans)) if (+id !== 1) L.push(`vlan ${id}`, `   name ${v.name}`, '!');
  }
  for (const h of sw.hw) {
    if (only && !only.includes(h.name)) continue;
    const p = c.ports[h.name]; const out = [];
    if (p.desc) out.push(`   description ${p.desc}`);
    if (p.shutdown) out.push('   shutdown');
    if (p.mode === 'routed') out.push('   no switchport');
    else if (p.mode === 'trunk') out.push('   switchport mode trunk');
    else if (p.vlan !== 1) out.push(`   switchport access vlan ${p.vlan}`);
    if (p.speed !== h.speeds[0]) out.push(`   speed ${p.speed}`);
    if (p.fec === 'none') out.push('   no error-correction encoding'); else if (p.fec !== 'auto') out.push(`   error-correction encoding ${FEC_TXT[p.fec]}`);
    if (p.mtu !== fac.mtu) out.push(`   mtu ${p.mtu}`);
    if (p.mode === 'routed' && p.ip) out.push(`   ip address ${p.ip}`);
    if (p.mode === 'routed' && p.pim) out.push('   pim ipv4 sparse-mode');
    if (p.mode === 'routed' && p.ospf) out.push('   ip ospf area 0.0.0.0');
    if (p.ptp) out.push('   ptp enable');
    if (p.ptpRole === 'master') out.push('   ptp role master');
    L.push(`interface ${h.name}`, ...out, '!');
  }
  if (!only || only.includes('Loopback0')) if (c.loopback) L.push('interface Loopback0', `   ip address ${c.loopback}/32`, '!');
  for (const [id, v] of Object.entries(c.svis)) {
    if (only && !only.includes('Vlan' + id)) continue;
    L.push(`interface Vlan${id}`); if (v.shutdown) L.push('   shutdown'); if (v.ip) L.push(`   ip address ${v.ip}`); if (v.igmp) L.push(`   ip igmp version ${v.igmp}`); if (v.pim) L.push('   pim ipv4 sparse-mode'); if (v.ospf) L.push('   ip ospf area 0.0.0.0'); L.push('!');
  }
  if (!only) {
    if (c.ipRouting) L.push('ip routing');
    if (c.mcastRouting) L.push('ip multicast-routing');
    if (c.ssmRange !== '232.0.0.0/8') L.push(`ip pim ssm range ${c.ssmRange}`);
    L.push('!');
    for (const [n, m] of Object.entries(c.monitor || {})) { if (m.src) L.push(`monitor session ${n} source ${m.src}${m.dir && m.dir !== 'both' ? ' ' + m.dir : ''}`); if (m.dest) L.push(`monitor session ${n} destination ${m.dest}`); }
    if (Object.keys(c.monitor || {}).length) L.push('!');
    if (c.ospf.enabled) L.push('router ospf 1', ...(c.ospf.routerId ? [`   router-id ${c.ospf.routerId}`] : []), '   max-lsa 12000', '!');
    L.push('end');
  }
  return L.join('\n');
}

// ---------------- commandes show ----------------
const pad = (v, n) => String(v ?? '').slice(0, n).padEnd(n);
function table(head, rows, widths) { return [head.map((h, i) => pad(h, widths[i])).join(' ').trimEnd(), widths.map((w) => '-'.repeat(w)).join(' '), ...rows.map((r) => r.map((x, i) => pad(x, widths[i])).join(' ').trimEnd())].join('\n'); }
const typeOf = (h, sp, st) => (st !== 'connected' && st !== 'disabled' ? 'Not Present' : h.type === 'SFP28' ? (sp === '25g' ? '25GBASE-SR' : '10GBASE-SR') : h.type === 'QSFP28' ? (sp === '100g' ? '100GBASE-SR4' : sp === '40g' ? '40GBASE-SR4' : sp.toUpperCase() + 'BASE-SR') : sp === '1g' ? '1000BASE-T' : '10GBASE-T');
function peerName(st) {
  const p = st.peer; if (!p) return '';
  if (p.kind === 'link') return FAB.switches[p.other.sw].running.hostname + ' ' + ifShort(p.other.port);
  return p.dev.name;
}
function showIntStatus(sw, only) {
  const rows = [];
  for (const h of sw.hw) {
    if (only && !only.includes(h.name)) continue;
    const p = sw.running.ports[h.name]; const st = portState(sw.id, h.name);
    rows.push([ifShort(h.name), p.desc || peerName(st), st.status === 'down' ? 'notconnect' : st.status, p.mode === 'routed' ? 'routed' : p.mode === 'trunk' ? 'trunk' : p.vlan, 'full', p.speed.toUpperCase(), typeOf(h, p.speed, st.status)]);
  }
  return table(['Port', 'Name', 'Status', 'Vlan', 'Duplex', 'Speed', 'Type'], rows, [6, 26, 12, 7, 6, 6, 14]);
}
const gb = (x) => (x >= 1 ? `${x.toFixed(2)} Gbps` : `${(x * 1000).toFixed(1)} Mbps`);
function showInt(sw, I) {
  const c = sw.running;
  if (I.type === 'vlan') {
    const v = c.svis[I.id]; if (!v) return `% Interface Vlan${I.id} inexistante`;
    const vl = c.vlans[I.id];
    const up = sw.power && !v.shutdown && !!vl;
    return [`Vlan${I.id} is ${v.shutdown ? 'administratively down' : up ? 'up' : 'down'}, line protocol is ${up ? 'up (connected)' : 'down (VLAN absent)'}`, '  Hardware is Vlan', v.ip ? `  Internet address is ${v.ip}` : '  No Internet protocol address assigned', `  IP MTU 1500 bytes`, `  IGMP ${v.igmp ? 'version ' + v.igmp + ' (querier)' : 'désactivé'} · PIM ${v.pim ? 'sparse-mode' : 'désactivé'} · OSPF ${v.ospf ? 'area 0.0.0.0' : 'non annoncé'}`].join('\n');
  }
  if (I.type === 'lo') return [`Loopback0 is up, line protocol is up (connected)`, c.loopback ? `  Internet address is ${c.loopback}/32` : '  No Internet protocol address assigned'].join('\n');
  return I.names.map((n) => {
    const p = c.ports[n]; const st = portState(sw.id, n); const h = sw.hw.find((x) => x.name === n);
    const up = st.status === 'connected';
    const drops = st.outL.cap && st.outL.load > st.outL.cap ? Math.round((st.outL.load - st.outL.cap) * 1e9 / 8 / 1450 * 300) : 0;
    return [`${n} is ${p.shutdown ? 'administratively down' : up ? 'up' : 'down'}, line protocol is ${up ? 'up (connected)' : 'down (' + (st.status === 'down' ? 'notconnect' : st.status) + ')'}`,
      `  Hardware is Ethernet, address is 28:99:3a:${hx2(CNUM[sw.color] || 3)}:${hx2(sw.k || sw.s || 0)}:${hx2(+n.slice(8))}`,
      p.desc ? `  Description: ${p.desc}` : null,
      p.mode === 'routed' ? (p.ip ? `  Internet address is ${p.ip}` : '  No Internet protocol address assigned') : `  Switchport ${p.mode}, VLAN ${p.vlan}`,
      `  Ethernet MTU ${p.mtu} bytes, BW ${SPEED_GBPS[p.speed] * 1e6} kbit`,
      `  Full-duplex, ${p.speed.toUpperCase()}b/s, auto negotiation: off, uni-link: n/a`,
      `  Forward error correction: ${p.fec === 'auto' ? (p.speed === '25g' || p.speed === '100g' ? 'Reed-Solomon (auto)' : 'disabled (auto)') : p.fec === 'none' ? 'disabled' : FEC_TXT[p.fec]}`,
      `  Transceiver ${typeOf(h, p.speed, st.status)}${st.peer && st.peer.kind !== 'ctl' ? ' · voisin : ' + peerName(st) : ''}`,
      st.reason ? `  ! ${st.reason}` : null,
      `  5 seconds input rate ${gb(st.inL.load)}, ${Math.round(st.inL.load * 1e9 / 8 / 1450)} packets/sec`,
      `  5 seconds output rate ${gb(Math.min(st.outL.load, st.outL.cap || st.outL.load))}, ${Math.round(Math.min(st.outL.load, st.outL.cap || st.outL.load) * 1e9 / 8 / 1450)} packets/sec`,
      `  ${up ? Math.round(st.inL.load * 2.6e7) : 0} packets input, 0 input errors, 0 CRC`,
      `  ${up ? Math.round(st.outL.load * 2.6e7) : 0} packets output, ${drops} output discards${drops ? '  ← file de sortie saturée' : ''}`].filter((x) => x != null).join('\n');
  }).join('\n\n');
}
const hx2 = (n) => (n & 255).toString(16).padStart(2, '0');
function showRates(sw) {
  const rows = [];
  for (const h of sw.hw) { const st = portState(sw.id, h.name); if (st.status !== 'connected') continue; const cap = SPEED_GBPS[sw.running.ports[h.name].speed]; rows.push([ifShort(h.name), sw.running.ports[h.name].desc || peerName(st), gb(st.inL.load), (st.inL.load / cap * 100).toFixed(1) + '%', gb(st.outL.load), (st.outL.load / cap * 100).toFixed(1) + '%']); }
  return table(['Port', 'Name', 'In', 'In %', 'Out', 'Out %'], rows, [6, 26, 13, 7, 13, 7]);
}
function compactPorts(list) {
  const nums = list.map((n) => +n.slice(8)).sort((a, b) => a - b); const out = [];
  for (let i = 0; i < nums.length; i++) { let j = i; while (nums[j + 1] === nums[j] + 1) j++; out.push(j > i ? `Et${nums[i]}-${nums[j]}` : `Et${nums[i]}`); i = j; }
  return out.join(', ');
}
function showVlan(sw) {
  const c = sw.running; const rows = [];
  for (const [id, v] of Object.entries(c.vlans)) { const ports = Object.entries(c.ports).filter(([, p]) => p.mode === 'access' && p.vlan === +id).map(([n]) => n); rows.push([id, v.name, 'active', compactPorts(ports)]); }
  const orphan = [...new Set(Object.values(c.ports).filter((p) => p.mode === 'access' && !c.vlans[p.vlan]).map((p) => p.vlan))];
  return table(['VLAN', 'Name', 'Status', 'Ports'], rows, [5, 22, 9, 40]) + (orphan.length ? `\n\n! Ports affectés à des VLAN inexistants : ${orphan.join(', ')} (ports inactifs)` : '');
}
function showIpBrief(sw) {
  const c = sw.running; const rows = [];
  for (const h of sw.hw) { const p = c.ports[h.name]; if (p.mode !== 'routed') continue; const st = portState(sw.id, h.name); rows.push([h.name, p.ip || 'unassigned', st.status === 'connected' ? 'up' : p.shutdown ? 'admin down' : 'down', st.status === 'connected' ? 'up' : 'down', p.mtu]); }
  if (c.loopback) rows.push(['Loopback0', c.loopback + '/32', 'up', 'up', 65535]);
  for (const [id, v] of Object.entries(c.svis)) { const up = sw.power && !v.shutdown && c.vlans[id]; rows.push(['Vlan' + id, v.ip || 'unassigned', v.shutdown ? 'admin down' : up ? 'up' : 'down', up ? 'up' : 'lowerlayerdown', 1500]); }
  return table(['Interface', 'IP Address', 'Status', 'Protocol', 'MTU'], rows, [12, 18, 11, 15, 6]);
}
// voisins OSPF / PIM d'un commutateur
function l3Neighbors(sw) {
  const out = [];
  for (const l of FAB.links) {
    const side = l.a.sw === sw.id ? 'a' : l.b.sw === sw.id ? 'b' : null; if (!side) continue;
    const me = side === 'a' ? l.a : l.b, ot = side === 'a' ? l.b : l.a;
    const st = FAB.res.up[l.id]; const o = FAB.switches[ot.sw];
    out.push({ l, port: me.port, other: o, otherPort: ot.port, st, ip: (o.running.ports[ot.port].ip || '').split('/')[0] });
  }
  return out;
}
function showOspf(sw) {
  if (!sw.running.ospf.enabled) return '% OSPF n\'est pas configuré';
  const rows = [];
  for (const n of l3Neighbors(sw)) {
    if (!n.st.up) continue;
    const pa = sw.running.ports[n.port];
    if (!pa.ospf || !n.other.running.ospf.enabled || !n.other.running.ports[n.otherPort].ospf || !sw.running.ipRouting || !n.other.running.ipRouting) continue;
    const state = n.st.ospf === 'FULL' ? 'FULL' : /MTU/.test(n.st.ospf) ? 'EXSTART' : /même/.test(n.st.ospf) ? 'INIT' : 'DOWN';
    rows.push([n.other.running.ospf.routerId || n.other.loopback, '1', 'default', '0', state, '00:00:3' + (n.l.j + 2), n.ip, ifShort(n.port)]);
  }
  for (const id of ['gm1', 'gm2']) { const d = FAB.devices[id]; for (const c of COLORS) if (d.nics[c].sw === sw.id) { /* les grands maîtres ne font pas d'OSPF : sous-réseau connecté */ } }
  return table(['Neighbor ID', 'Inst', 'VRF', 'Pri', 'State', 'Dead Time', 'Address', 'Interface'], rows, [12, 4, 7, 3, 8, 9, 15, 9]);
}
function showPim(sw) {
  if (!sw.running.mcastRouting) return '% Le routage multicast est désactivé';
  const rows = [];
  for (const n of l3Neighbors(sw)) if (n.st.up && n.st.pim) rows.push([n.ip, ifShort(n.port), '1d02h', '00:01:4' + n.l.j, 'v2', '1', 'BFD']);
  return table(['Neighbor Address', 'Interface', 'Uptime', 'Expires', 'Mode', 'DR Pri', 'Flags'], rows, [16, 9, 7, 8, 4, 6, 5]);
}
function routesOf(sw) {
  // routes connectées + OSPF (ECMP via les uplinks en FULL)
  const c = sw.running; const R = []; if (!sw.power) return R;
  for (const h of sw.hw) { const p = c.ports[h.name]; if (p.mode === 'routed' && p.ip && portState(sw.id, h.name).status === 'connected') R.push({ t: 'C', net: netOf(p.ip), via: [ifShort(h.name)] }); }
  for (const [id, v] of Object.entries(c.svis)) if (v.ip && !v.shutdown && c.vlans[id]) R.push({ t: 'C', net: netOf(v.ip), via: ['Vlan' + id] });
  if (c.loopback) R.push({ t: 'C', net: c.loopback + '/32', via: ['Loopback0'] });
  if (!c.ipRouting || !c.ospf.enabled || sw.role === 'ctl') return R;
  // graphe OSPF du réseau de la même couleur
  const adj = {};
  for (const l of FAB.links) if (l.color === sw.color && FAB.res.up[l.id].ospf === 'FULL') { (adj[l.a.sw] = adj[l.a.sw] || []).push({ to: l.b.sw, l, my: l.a.port, nh: l.b }); (adj[l.b.sw] = adj[l.b.sw] || []).push({ to: l.a.sw, l, my: l.b.port, nh: l.a }); }
  const dist = { [sw.id]: 0 }; const first = { [sw.id]: [] }; const q = [sw.id];
  while (q.length) { const u = q.shift(); for (const e of adj[u] || []) { if (dist[e.to] == null) { dist[e.to] = dist[u] + 1; first[e.to] = u === sw.id ? [e] : first[u].slice(); q.push(e.to); } else if (dist[e.to] === dist[u] + 1) { const add = u === sw.id ? [e] : first[u]; for (const x of add) if (!first[e.to].includes(x)) first[e.to].push(x); } } }
  for (const [id, d] of Object.entries(dist)) {
    if (id === sw.id) continue; const o = FAB.switches[id];
    const via = first[id].map((e) => `${(FAB.switches[e.nh.sw].running.ports[e.nh.port].ip || '').split('/')[0]}, ${ifShort(e.my)}`);
    for (const [vid, v] of Object.entries(o.running.svis)) if (v.ip && v.ospf && !v.shutdown) R.push({ t: 'O', net: netOf(v.ip), via, cost: 10 * d + 1 });
    if (o.running.loopback) R.push({ t: 'O', net: o.running.loopback + '/32', via, cost: 10 * d });
    for (const h of o.hw) { const p = o.running.ports[h.name]; if (p.mode === 'routed' && p.ip && p.ospf && h.name === 'Ethernet31' && o.role === 'spine') R.push({ t: 'O', net: netOf(p.ip), via, cost: 10 * d + 1 }); }
  }
  return R;
}
function netOf(cidr) { const [ip, l] = cidr.split('/'); const n = ipToInt(ip); const m = +l === 0 ? 0 : (~0 << (32 - +l)) >>> 0; const v = (n & m) >>> 0; return `${v >>> 24}.${(v >> 16) & 255}.${(v >> 8) & 255}.${v & 255}/${l}`; }
function showRoute(sw) {
  if (!sw.running.ipRouting) return '! IP routing not enabled\n' + routesOf(sw).filter((r) => r.t === 'C').map((r) => ` C        ${r.net} is directly connected, ${r.via[0]}`).join('\n');
  const R = routesOf(sw).sort((a, b) => ipToInt(a.net.split('/')[0]) - ipToInt(b.net.split('/')[0]));
  const L = ['VRF: default', 'Codes: C - connected, O - OSPF', '', 'Gateway of last resort is not set', ''];
  for (const r of R) {
    if (r.t === 'C') L.push(` C        ${r.net} is directly connected, ${r.via[0]}`);
    else { L.push(` O        ${r.net} [110/${r.cost}] via ${r.via[0]}`); for (const v of r.via.slice(1)) L.push(`                               via ${v}`); }
  }
  return L.join('\n');
}
function showArp(sw) {
  const rows = [];
  for (const d of Object.values(FAB.devices)) for (const c of COLORS) { const n = d.nics[c]; if (!n || n.sw !== sw.id) continue; const st = FAB.res.nic[d.id + ':' + c]; if (!st || !st.up) continue; rows.push([n.ip, '0', `08:00:11:${hx2(CNUM[c])}:${hx2(d.leaf)}:${hx2(+n.ip.split('.')[3])}`, (st.conflict ? '! ' : '') + `Vlan${vlanOf(c, d.leaf)}, ${ifShort(n.port)}`]); }
  for (const n of l3Neighbors(sw)) if (n.st.up) rows.push([n.ip, '0', '28:99:3a:00:00:' + hx2(+n.otherPort.slice(8)), ifShort(n.port)]);
  const conf = rows.some((r) => r[3].startsWith('!'));
  return table(['Address', 'Age', 'Hardware Addr', 'Interface'], rows, [15, 4, 18, 26]) + (conf ? '\n\n! Adresse en double : l\'entrée ARP bascule d\'un port à l\'autre (%IP-4-DUPADDR)' : '');
}
function sgOn(sw) {
  // entrées (S,G) qui traversent ce commutateur
  const M = new Map(); if (!FAB.res) return M;
  for (const [rid, s] of Object.entries(FAB.res.rxState)) for (const c of COLORS) {
    const p = s.per[c]; if (!p || !p.ok || sw.color !== c) continue;
    const f = FAB.flows[s.flow]; const sd = FAB.devices[f.dev], rd = FAB.devices[FAB.rx[rid].dev];
    const key = `${p.src}|${p.group}`;
    const add = (iif, oif, port) => { if (!M.has(key)) M.set(key, { src: p.src, group: p.group, iif, oifs: new Map(), flow: f }); const o = M.get(key).oifs; if (!o.has(oif)) o.set(oif, new Set()); if (port) o.get(oif).add(port); };
    const lu = p.lu && FAB.links.find((l) => l.id === p.lu), ld = p.ld && FAB.links.find((l) => l.id === p.ld);
    if (p.ls === sw.id) { if (p.lr === sw.id) add(`Vlan${vlanOf(c, sd.leaf)}`, `Vlan${vlanOf(c, rd.leaf)}`, ifShort(rd.nics[c].port)); else add(`Vlan${vlanOf(c, sd.leaf)}`, ifShort(lu.a.port)); }
    else if (p.spine === sw.id) add(ifShort(lu.b.port), ifShort(ld.b.port));
    else if (p.lr === sw.id) add(ifShort(ld.a.port), `Vlan${vlanOf(c, rd.leaf)}`, ifShort(rd.nics[c].port));
  }
  return M;
}
function showMroute(sw) {
  if (!sw.running.mcastRouting) return '% Le routage multicast est désactivé';
  const M = sgOn(sw); if (!M.size) return 'Aucune entrée (S,G).';
  const L = ['IP Multicast Routing Table (PIM-SSM)', 'Flags: S - SSM, T - SPT, L - Local receiver', ''];
  for (const e of [...M.values()].sort((a, b) => ipToInt(a.group) - ipToInt(b.group))) {
    L.push(`(${e.src}, ${e.group}), uptime 00:${String(10 + (ipToInt(e.group) % 50)).padStart(2, '0')}:12, flags: ST  · ${e.flow.label} (${e.flow.gbps >= 1 ? e.flow.gbps.toFixed(2) + ' Gb/s' : (e.flow.gbps * 1000).toFixed(1) + ' Mb/s'})`, `  Incoming interface: ${e.iif}`, `  Outgoing interface list:`, ...[...e.oifs].map(([o, ps]) => `    ${o}${ps.size ? ' (snooping : ' + [...ps].join(', ') + ')' : ''}`));
  }
  return L.join('\n');
}
function showIgmp(sw) {
  if (sw.role !== 'leaf') return '% Pas de récepteurs directement raccordés sur ce commutateur';
  const rows = [];
  for (const [rid, s] of Object.entries(FAB.res.rxState)) {
    const p = s.per[sw.color]; if (!p || !p.joined || p.lr !== sw.id) continue;
    const rd = FAB.devices[FAB.rx[rid].dev];
    rows.push([vlanOf(sw.color, sw.k), p.group, p.src, ifShort(rd.nics[sw.color].port), 'v3', FAB.rx[rid].label]);
  }
  const t = FAB.timers[sw.id];
  return table(['Vlan', 'Group', 'Source', 'Port', 'Ver', 'Récepteur'], rows, [5, 14, 13, 6, 3, 30]) + (t != null ? `\n\n! Aucun querier sur le VLAN : les entrées expirent dans ${Math.max(0, Math.round(45 - t))} s` : '');
}
function showQuerier(sw) {
  const c = sw.running; const rows = [];
  for (const [id, v] of Object.entries(c.vlans)) {
    const svi = c.svis[id];
    const q = svi && !svi.shutdown && svi.igmp > 0 && c.mcastRouting ? `${svi.ip.split('/')[0]} (SVI, v${svi.igmp})` : v.querier ? 'querier L2 (v3)' : '—';
    rows.push([id, v.snooping && c.igmpSnooping ? 'enabled' : 'DISABLED', q]);
  }
  return table(['Vlan', 'Snooping', 'Querier'], rows, [5, 9, 30]);
}
// états PTP des ports d'un commutateur
export function ptpPorts(sw) {
  const R = FAB.res; const P = R.ptp[sw.color]; const c = sw.running; const out = {};
  if (!P || c.ptp.mode === 'disabled' || !sw.power) return out;
  const me = P.synced[sw.id];
  let slaveDone = false;
  for (const h of sw.hw) {
    const p = c.ports[h.name]; const st = portState(sw.id, h.name);
    if (st.status !== 'connected') { out[h.name] = '—'; continue; }
    if (!p.ptp) { out[h.name] = 'Disabled'; continue; }
    const peer = st.peer;
    if (peer.kind === 'link') {
      const o = FAB.switches[peer.other.sw]; const od = P.synced[o.id];
      if (!st.link.ptp) { out[h.name] = 'Disabled'; continue; }
      if (me != null && od != null && od === me - 1 && !slaveDone) { out[h.name] = 'Slave'; slaveDone = true; }
      else if (me != null && od != null && od === me - 1) out[h.name] = 'Passive';
      else out[h.name] = 'Master';
    } else if (peer.kind === 'gm') {
      out[h.name] = P.gm && P.gm.id === peer.dev.id ? (slaveDone = true, 'Slave') : p.ptpRole === 'master' ? 'Master' : 'Passive';
    } else if (peer.kind === 'dev' && P.gm && P.gm.id === peer.dev.id) { out[h.name] = 'Slave'; slaveDone = true; }
    else out[h.name] = 'Master';
  }
  return out;
}
function showPtp(sw) {
  const c = sw.running; if (c.ptp.mode === 'disabled') return 'PTP Mode: Disabled';
  const P = FAB.res.ptp[sw.color]; const hops = P && P.synced[sw.id];
  const ports = ptpPorts(sw); const slave = Object.entries(ports).find(([, v]) => v === 'Slave');
  const gm = P && P.gm;
  const locked = hops != null && gm;
  return [`PTP Mode: ${c.ptp.mode === 'boundary' ? 'Boundary Clock' : 'End-to-end Transparent Clock'}`, `PTP Profile: ${c.ptp.profile === 'smpte2059-2' ? 'SMPTE ST 2059-2' : c.ptp.profile}`, `Clock Identity: 0x${clockId(sw.id).replace(/:/g, '')}`,
    `Grandmaster Clock Identity: ${locked ? '0x' + clockId(gm.id).replace(/:/g, '') + ' (' + gm.name + ')' : '0x' + clockId(sw.id).replace(/:/g, '') + ' (lui-même : horloge libre)'}`,
    `Domain: ${c.ptp.domain}${c.ptp.domain !== PTP_REF.domain ? '   ! ST 2059-2 attend le domaine 127' : ''}`,
    `Number of slave ports: ${slave ? 1 : 0}`, `Number of master ports: ${Object.values(ports).filter((v) => v === 'Master').length}`,
    slave ? `Slave port: ${slave[0]}` : 'Slave port: —',
    `Offset From Master (nanoseconds): ${locked ? (hops * 7 + 3) : '—'}`, `Mean Path Delay (nanoseconds): ${locked ? 180 + hops * 25 : '—'}`, `Steps Removed: ${locked ? hops : '—'}`,
    `Intervals (log2 s): announce ${c.ptp.announce}, sync ${c.ptp.sync}, delay-req ${c.ptp.delayReq}${c.ptp.announce !== PTP_REF.announce || c.ptp.sync !== PTP_REF.sync ? '   ! ST 2059-2 recommande -2 / -3 / -3' : ''}`].join('\n');
}
function showPtpParent(sw) {
  const P = FAB.res.ptp[sw.color]; if (!P || !P.gm || P.synced[sw.id] == null) return 'Parent: aucun (horloge libre)';
  const g = P.gm;
  return [`Parent Clock:`, `  Parent Clock Identity: 0x${clockId(g.id).replace(/:/g, '')}`, `Grandmaster Clock:`, `  Grandmaster Clock Identity: 0x${clockId(g.id).replace(/:/g, '')}`, `  Grandmaster Clock Quality:`, `    Class: ${g.cls}${g.cls === 6 ? ' (verrouillé GPS)' : g.cls === 7 ? ' (holdover)' : g.cls === 248 ? ' (horloge libre !)' : ''}`, `    Accuracy: 0x${g.cls === 6 ? '21' : 'fe'}`, `    OffsetScaledLogVariance: 0x4e5d`, `  Priority1: ${g.p1}`, `  Priority2: ${g.p2}`, `  Nom : ${g.name}${g.rogue ? '   ! ce n\'est pas un grand maître GPS' : ''}`].join('\n');
}
function showPtpInt(sw) {
  const ports = ptpPorts(sw); const rows = [];
  for (const [n, v] of Object.entries(ports)) if (v !== '—') rows.push([ifShort(n), sw.running.ports[n].ptpRole === 'master' ? 'master (forcé)' : 'dynamic', v, 'IPv4', 'e2e']);
  return table(['Interface', 'Role', 'State', 'Transport', 'Delay'], rows, [9, 15, 8, 9, 5]);
}
function showLldp(sw) {
  const rows = [];
  for (const h of sw.hw) {
    const st = portState(sw.id, h.name); if (st.status !== 'connected' || !st.peer) continue;
    const p = st.peer;
    if (p.kind === 'link') rows.push([ifShort(h.name), FAB.switches[p.other.sw].running.hostname, p.other.port, 120]);
    else if (p.kind === 'probe') rows.push([ifShort(h.name), 'analyseur-ip', 'eth0', 120]);
    else rows.push([ifShort(h.name), p.dev.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24), p.kind === 'ctl' ? 'mgmt0' : p.color === 'red' ? 'media-a (rouge)' : 'media-b (bleu)', 120]);
  }
  return table(['Port', 'Neighbor Device ID', 'Neighbor Port ID', 'TTL'], rows, [6, 26, 18, 4]);
}
function showMonitor(sw) {
  const M = sw.running.monitor || {}; if (!Object.keys(M).length) return 'Aucune session miroir.';
  return Object.entries(M).map(([n, m]) => { const l = m.dest && m.src ? spanLoad(sw.id, m) : null; return [`Session ${n}`, '---------', `Source Ports:`, `   ${m.dir === 'rx' ? 'Rx Only' : m.dir === 'tx' ? 'Tx Only' : 'Both'}: ${m.src || '—'}`, `Destination Ports:`, `   ${m.dest || '—'} :  ${m.dest && m.src ? 'active' : 'inactive (session incomplète)'}`, l ? `   trafic recopié ≈ ${l.load.toFixed(2)} Gb/s pour un port de ${l.cap} Gb/s${l.load > l.cap ? '   ! la destination déborde : capture incomplète' : ''}` : ''].filter(Boolean).join('\n'); }).join('\n\n');
}
function showQos(sw) {
  const q = sw.running.qos;
  if (q.trust !== 'dscp') return 'qos trust: none — tout le trafic dans la file par défaut (TC 0)';
  return table(['DSCP', 'Usage', 'Traffic class'], [['46 (EF)', 'PTP (événements et généraux)', q.ptpPriority ? '7 (priorité stricte)' : '0 (par défaut !)'], ['34 (AF41)', 'audio ST 2110-30 / AES67', '5'], ['26 (AF31)', 'vidéo ST 2110-20', '4'], ['18 (AF21)', 'données ST 2110-40', '3'], ['16 (CS2)', 'contrôle (NMOS, gestion)', '2'], ['0', 'autres', '0']], [9, 30, 22]);
}
function showLog(sw) {
  const L = [];
  const t = (i) => `Oct 15 20:${String(40 + (i % 19)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}`;
  let i = 0;
  for (const is of FAB.issues) {
    if (is.sw !== sw.id && !(is.color === sw.color && /PTP/.test(is.title))) continue;
    const tag = /OSPF/.test(is.title) ? '%OSPF-4-ADJCHG' : /PIM/.test(is.title) ? '%PIM-5-NBRCHG' : /PTP/.test(is.title) ? '%PTP-4-STATE' : /querier|IGMP|Snooping/i.test(is.title) ? '%IGMPSNOOPING-4-QUERIER' : /saturé/.test(is.title) ? '%QOS-4-TXDROPS' : /Uplink|coupé/.test(is.title) ? '%LINEPROTO-5-UPDOWN' : /non enregistrée/.test(is.title) ? '%SYS-5-CONFIG_I' : /injoignable/.test(is.title) ? '%ETH-4-HOST' : '%SYS-4-EVENT';
    L.push(`${t(i++)} ${sw.running.hostname} ${tag}: ${is.title}${is.detail ? ' — ' + is.detail : ''}`);
  }
  return L.length ? L.join('\n') : `${t(0)} ${sw.running.hostname} %SYS-5-RESTART: aucun événement depuis le démarrage`;
}
function showVersion(sw) {
  return [`Simulateur de commutateur — ${sw.model}`, `Software image version: simOS 4.31.2F (syntaxe EOS / NX-OS simplifiée)`, `Hostname: ${sw.running.hostname}`, `Management IP: ${sw.mgmt} (VLAN 10 GESTION-OOB, port mgmt0)`, `Serial number: SIM${(sw.id.length * 7919).toString(16).toUpperCase()}${sw.k || sw.s || 0}`, `Uptime: 1 day, 2 hours`, `Ports: ${sw.hw.length} (${[...new Set(sw.hw.map((h) => h.type))].join(' + ')})`].join('\n');
}
function ping(sw, ip) {
  const fail = (why) => `PING ${ip} 72(100) bytes of data.\n\n--- ${ip} ping statistics ---\n5 packets transmitted, 0 received, 100% packet loss${why ? '\n! ' + why : ''}`;
  if (!sw.running.ipRouting && sw.role !== 'ctl') return fail('routage IP désactivé');
  // cible : appareil, SVI, loopback, interface routée
  let target = null;
  for (const d of Object.values(FAB.devices)) for (const c of COLORS) { const n = d.nics[c]; if (n && n.ip === ip) target = { kind: 'dev', d, c, n }; }
  if (sw.role === 'ctl') { const d = Object.values(FAB.devices).find((x) => x.ctlIp === ip); if (!d) return fail('hôte inconnu sur le réseau de contrôle'); const p = sw.running.ports[d.ctl.port]; return p && !p.shutdown && p.vlan === (d.kind === 'gm' ? 10 : 20) ? ok(ip) : fail('port de contrôle coupé ou mauvais VLAN'); }
  const rts = routesOf(sw);
  const has = rts.find((r) => inSubnet(ip, r.net));
  if (!has) return fail('% Pas de route vers ' + ip);
  if (target && target.c !== sw.color) return fail('autre réseau (rouge et bleu sont indépendants)');
  if (target) { const st = FAB.res.nic[target.d.id + ':' + target.c]; if (!st.reach) return fail(target.d.name + ' : ' + st.why); }
  return ok(ip);
  function ok(x) { const ms = () => (0.05 + Math.random() * 0.05).toFixed(3); return `PING ${x} 72(100) bytes of data.\n${[1, 2, 3, 4, 5].map((i) => `80 bytes from ${x}: icmp_seq=${i} ttl=63 time=${ms()} ms`).join('\n')}\n\n--- ${x} ping statistics ---\n5 packets transmitted, 5 received, 0% packet loss`; }
}
export { linkName, LEAVES, CLABEL };
