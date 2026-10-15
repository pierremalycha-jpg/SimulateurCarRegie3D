import { S } from './state.js';
import { FAB, updateFabric, videoGbps, SPEED_GBPS, setSwitchPower, markDirty, resetFabric, PTP_REF } from './net/fabric.js';

// ----------------------------------------------------------------------------------
// Car IP (SMPTE ST 2110) : façade simple sur le modèle réseau détaillé (net/fabric.js).
// Deux fabrics spine-leaf indépendantes (rouge = A, bleu = B, ST 2022-7), PTP (ST 2059-2),
// registre et contrôleur NMOS (IS-04 / IS-05).
// ----------------------------------------------------------------------------------
export const NET = { red: true, blue: true, redState: 'ok', blueState: 'ok', gm1: true, gm2: true, nmos: true, mvLink: 100, mvSat: false, gmActive: 1, rogue: false };

// débit d'un flux vidéo ST 2110-20 (4:2:2 10 bits, image active, en-têtes compris) en Gb/s
export function flowGbps() { return videoGbps(); }
// adresses multicast d'un émetteur (source), rouge · bleu
export function mcastOf(src) {
  if (!src) return '—';
  const f = FAB.flows['v:' + src];
  return f ? `${f.groups.red} · ${f.groups.blue}` : '—';
}
export function netOk() { return !S.ipMode || NET.red || NET.blue; }
export function ptpLocked() { return !S.ipMode || (NET.gmActive > 0 && !NET.rogue); }
// le multiviewer reçoit un flux par tuile : son lien réseau limite le nombre de tuiles
export function mvCapacity() { return Math.floor(NET.mvLink / flowGbps()); }

function sync() {
  const R = FAB.res; if (!R) return;
  for (const c of ['red', 'blue']) {
    const spines = Object.values(FAB.switches).filter((s) => s.color === c && s.role === 'spine');
    const rx = Object.values(R.rxState);
    const okN = rx.filter((s) => s.per[c].ok && !(s.per[c].loss > 0)).length;
    const down = spines.every((s) => !s.power) || (rx.length > 0 && okN === 0);
    NET[c + 'State'] = down ? 'down' : okN < rx.length || FAB.issues.some((i) => i.color === c && i.sev !== 'info') ? 'degraded' : 'ok';
    NET[c] = !down;
  }
  NET.gm1 = FAB.gm.gm1.up; NET.gm2 = FAB.gm.gm2.up;
  const g = R.gmActive.red || R.gmActive.blue;
  NET.rogue = !!((R.gmActive.red && R.gmActive.red.rogue) || (R.gmActive.blue && R.gmActive.blue.rogue));
  NET.gmActive = !g ? 0 : g.id === 'gm1' ? 1 : g.id === 'gm2' ? 2 : 3;
  NET.nmos = R.regOk;
  const mv = FAB.switches['LEAF-R4'];
  NET.mvLink = mv ? SPEED_GBPS[mv.running.ports.Ethernet53.speed] : 100;
  NET.mvSat = Object.entries(R.rxState).some(([k, s]) => k.startsWith('MV') && (s.loss > 0 || !s.ok));
}
export function updateNet(dt, routeMap = {}, recPhase = {}) {
  if (!S.ipMode) return;
  updateFabric(dt, routeMap, recPhase);
  sync();
}
export function netStatus() {
  const out = [];
  if (!S.ipMode || !FAB.res) return out;
  const R = FAB.res;
  const st = (c) => NET[c + 'State'];
  const other = (c) => (c === 'red' ? 'bleu' : 'rouge');
  for (const c of ['red', 'blue']) out.push({ t: `Réseau ${c === 'red' ? 'rouge' : 'bleu'}`, s: st(c) === 'ok' ? 'OK (spine-leaf, 2 spines · 6 leaves)' : st(c) === 'down' ? `COUPÉ — les flux passent par le réseau ${other(c)} (ST 2022-7)` : `DÉGRADÉ — ${FAB.issues.find((i) => i.color === c && i.sev !== 'info')?.title || 'certaines réceptions manquent sur ce réseau'}`, level: st(c) === 'ok' ? 'ok' : 'warn' });
  const gm = R.gmActive.red || R.gmActive.blue;
  out.push({ t: 'PTP', s: !gm ? 'AUCUN GRAND MAÎTRE : appareils en maintien' : NET.rogue ? `${gm.name} élu grand maître : horloge non traçable !` : `${gm.name}${gm.id === 'gm2' ? ' (secours, élu par le BMCA)' : ' (GPS)'} · domaine ${PTP_REF.domain}`, level: !gm || NET.rogue ? 'err' : gm.id === 'gm1' && FAB.gm.gm2.up ? 'ok' : 'warn' });
  out.push({ t: 'Registre NMOS', s: NET.nmos ? 'OK (IS-04 / IS-05)' : 'INJOIGNABLE : connexions impossibles, les flux existants continuent', level: NET.nmos ? 'ok' : 'err' });
  const lost = Object.values(R.rxState).filter((s) => !s.ok || s.loss > 0).length, unp = Object.values(R.rxState).filter((s) => s.ok && !s.protected).length;
  out.push({ t: 'Réceptions ST 2110', s: `${Object.keys(R.rxState).length} abonnements · ${lost ? lost + ' en défaut · ' : ''}${unp ? unp + ' sans protection 2022-7' : 'toutes protégées'}`, level: lost ? 'err' : unp ? 'warn' : 'ok' });
  out.push({ t: 'Multiviewer 1', s: `port ${NET.mvLink} GbE · ${mvCapacity()} flux ${S.format === 'UHD' ? 'UHD' : 'HD'} au maximum${NET.mvSat ? ' · des tuiles ne reçoivent pas leur flux' : ''}`, level: NET.mvSat ? 'err' : 'ok' });
  const e = FAB.issues.filter((i) => i.sev === 'err').length;
  if (e) out.push({ t: 'Alarmes réseau', s: `${e} alarme(s) — poste « Réseau IP », onglet Diagnostic`, level: 'err' });
  return out;
}

// ---------------- pannes réseau (agissent sur la configuration réelle) ----------------
const SW = (id) => FAB.switches[id];
const port = (sw, p) => SW(sw).running.ports[p];
const both = (k) => [`LEAF-R${k}`, `LEAF-B${k}`];
const ccuDev = () => { const l = Object.values(FAB.devices).filter((d) => d.kind === 'ccu'); return l[Math.floor(Math.random() * l.length)]; };
export const IP_FAULTS = [
  {
    id: 'ipred', net: true, label: 'Coupure électrique des spines rouges', where: 'Réseau IP',
    can: () => S.ipMode && SW('SPINE-R1') && SW('SPINE-R1').power, inject() { setSwitchPower('SPINE-R1', false); setSwitchPower('SPINE-R2', false); return {}; }, check: () => SW('SPINE-R1').power && SW('SPINE-R2').power,
    hint: 'Rien ne se voit à l\'image (ST 2022-7 : chaque flux arrive aussi par le réseau bleu), mais il n\'y a plus de secours. Réseau IP : rallumer les deux spines rouges (PDU), vérifier qu\'elles redémarrent sur la bonne configuration.',
  },
  {
    id: 'ipgm', net: true, label: 'Perte du grand maître PTP principal', where: 'Synchro / Réseau IP (PTP)',
    can: () => S.ipMode && FAB.gm.gm1.up, inject() { FAB.gm.gm1.up = false; markDirty(); return {}; }, check: () => FAB.gm.gm1.up,
    hint: 'Alarme PTP : le grand maître de secours est élu (BMCA) et l\'image continue. Synchro ou Réseau IP → PTP : vérifier le GPS et l\'alimentation du grand maître 1, puis le remettre en service.',
  },
  {
    id: 'ipnmos', net: true, label: 'Registre NMOS injoignable', where: 'Réseau IP / contrôleur',
    can: () => S.ipMode && FAB.registryUp, inject() { FAB.registryUp = false; markDirty(); return {}; }, check: () => FAB.registryUp,
    hint: 'Les images restent à l\'antenne mais plus aucune connexion (TAKE) n\'est possible. Réseau IP → Flux NMOS : redémarrer le registre.',
  },
  {
    id: 'ipmv', net: true, label: 'Port du multiviewer bridé (vitesse trop faible)', where: 'Réseau IP (leaf monitoring)',
    can: () => S.ipMode && SW('LEAF-R4') && port('LEAF-R4', 'Ethernet53').speed === '100g', inject() { for (const s of both(4)) port(s, 'Ethernet53').speed = S.format === 'UHD' ? '25g' : '10g'; markDirty(); return {}; }, check: () => both(4).every((s) => port(s, 'Ethernet53').speed === '100g'),
    hint: 'Les tuiles du multiview se dégradent (PERTES DE PAQUETS) : après un échange d\'optique, le port du multiviewer 1 tourne à 25G (UHD) ou 10G (HD) et ne porte plus toutes les tuiles, sur les deux réseaux. Réseau IP : leaf-r4 et leaf-b4, Ethernet53 « speed 100g » (show interfaces Ethernet53 montre des output discards).',
  },
  {
    id: 'vlanccu', net: true, label: 'CCU dans le mauvais VLAN', where: 'Réseau IP (leaf caméras)',
    can: () => S.ipMode && Object.values(FAB.devices).some((d) => d.kind === 'ccu'), inject() { const d = ccuDev(); for (const c of ['red', 'blue']) port(d.nics[c].sw, d.nics[c].port).vlan = 1; markDirty(); return { dev: d.id }; },
    check: (st) => { const d = FAB.devices[st.dev]; return !d || ['red', 'blue'].every((c) => { const p = port(d.nics[c].sw, d.nics[c].port); return p.mode === 'access' && p.vlan === (c === 'red' ? 100 : 200) + d.leaf; }); },
    hint: 'Une caméra disparaît (FLUX PERDU) sur les deux réseaux. Réseau IP → leaf caméras : le port de la CCU est dans le VLAN 1 au lieu du VLAN média (101 rouge / 201 bleu) — « switchport access vlan 101 ».',
  },
  {
    id: 'snoop', net: true, label: 'Snooping IGMP désactivé (leaf monitoring)', where: 'Réseau IP',
    can: () => S.ipMode && SW('LEAF-R4') && SW('LEAF-R4').running.igmpSnooping, inject() { for (const s of both(4)) SW(s).running.igmpSnooping = false; markDirty(); return {}; }, check: () => both(4).every((s) => SW(s).running.igmpSnooping),
    hint: 'Tous les flux de la leaf monitoring sont inondés sur tous ses ports : la carte 25 GbE du moniteur vision déborde (et le multiviewer en UHD). Réseau IP : « ip igmp snooping » sur leaf-r4 et leaf-b4.',
  },
  {
    id: 'querier', net: true, label: 'Querier IGMP supprimé (leaf ralentis)', where: 'Réseau IP',
    can: () => S.ipMode && SW('LEAF-R3') && SW('LEAF-R3').running.svis[103] && SW('LEAF-R3').running.svis[103].igmp === 3, inject() { for (const s of both(3)) { const v = SW(s).color === 'red' ? 103 : 203; if (SW(s).running.svis[v]) SW(s).running.svis[v].igmp = 0; } markDirty(); return {}; },
    check: () => both(3).every((s) => { const sw = SW(s); const v = sw.color === 'red' ? 103 : 203; return (sw.running.svis[v] && sw.running.svis[v].igmp === 3) || (sw.running.vlans[v] && sw.running.vlans[v].querier); }),
    hint: 'Rien pendant 45 s… puis les entrées REC de l\'EVS perdent leurs caméras : sans querier, les abonnements IGMP expirent. Réseau IP : « ip igmp version 3 » sur l\'interface Vlan103 (rouge) et Vlan203 (bleu) de la leaf ralentis.',
  },
  {
    id: 'ssm', net: true, label: 'Plage SSM erronée (leaf transmission)', where: 'Réseau IP',
    can: () => S.ipMode && SW('LEAF-R6') && SW('LEAF-R6').running.ssmRange === '239.0.0.0/8', inject() { for (const s of both(6)) SW(s).running.ssmRange = '232.0.0.0/8'; markDirty(); return {}; }, check: () => both(6).every((s) => SW(s).running.ssmRange === '239.0.0.0/8'),
    hint: 'Les encodeurs TX ne reçoivent plus le PGM : la leaf transmission traite les groupes 239.x en ASM (plage SSM par défaut 232/8). Réseau IP : « ip pim ssm range 239.0.0.0/8 » sur leaf-r6 et leaf-b6.',
  },
  {
    id: 'mtu', net: true, label: 'MTU erronée sur les uplinks d\'une leaf bleue', where: 'Réseau IP',
    can: () => S.ipMode && SW('LEAF-B3') && port('LEAF-B3', 'Ethernet49').mtu === 9214, inject() { for (let i = 49; i <= 52; i++) port('LEAF-B3', 'Ethernet' + i).mtu = 1500; markDirty(); return {}; }, check: () => [49, 50, 51, 52].every((i) => port('LEAF-B3', 'Ethernet' + i).mtu === port(`SPINE-B${i <= 50 ? 1 : 2}`, 'Ethernet' + (i % 2 ? 5 : 6)).mtu),
    hint: 'Aucun effet à l\'image : OSPF reste bloqué en EXSTART entre leaf-b3 et les spines bleues, la leaf ralentis est isolée du réseau bleu (plus de protection 2022-7 pour l\'EVS). Réseau IP : show ip ospf neighbor, puis « mtu 9214 » sur Ethernet49-52.',
  },
  {
    id: 'rogue', net: true, label: 'Appareil élu grand maître PTP', where: 'Réseau IP (PTP)',
    can: () => S.ipMode && FAB.devices.gfx && FAB.devices.gfx.ptp.slaveOnly !== false, inject() { Object.assign(FAB.devices.gfx.ptp, { slaveOnly: false, priority1: 50, clockClass: 248 }); for (const s of both(2)) port(s, 'Ethernet1').ptpRole = 'dynamic'; markDirty(); return {}; },
    check: () => !NET.rogue,
    hint: 'Les caméras perdent leur verrouillage (images qui sautent) : le moteur d\'habillage, mis à jour, n\'est plus « slave only » et s\'annonce avec priority1 50. Réseau IP → PTP : le repasser en slave only, et protéger les ports d\'accès par « ptp role master ».',
  },
  {
    id: 'fec', net: true, label: 'FEC incohérente sur le port d\'une CCU', where: 'Réseau IP (leaf caméras)',
    can: () => S.ipMode && Object.values(FAB.devices).some((d) => d.kind === 'ccu'), inject() { const d = ccuDev(); for (const c of ['red', 'blue']) port(d.nics[c].sw, d.nics[c].port).fec = 'fc'; markDirty(); return { dev: d.id }; },
    check: (st) => { const d = FAB.devices[st.dev]; return !d || ['red', 'blue'].every((c) => ['auto', 'rs'].includes(port(d.nics[c].sw, d.nics[c].port).fec)); },
    hint: 'Une caméra disparaît : après un changement d\'optique, le port est en FEC fire-code alors que la CCU attend la RS-FEC à 25G — le lien ne monte pas. Réseau IP : port de la CCU, « error-correction encoding reed-solomon ».',
  },
  {
    id: 'ptpdom', net: true, label: 'Mauvais domaine PTP sur les leaves caméras', where: 'Réseau IP (PTP)',
    can: () => S.ipMode && SW('LEAF-R1') && SW('LEAF-R1').running.ptp.domain === PTP_REF.domain, inject() { for (const s of both(1)) SW(s).running.ptp.domain = 0; markDirty(); return {}; }, check: () => both(1).every((s) => SW(s).running.ptp.domain === PTP_REF.domain),
    hint: 'Toutes les caméras sur CCU perdent le verrouillage PTP (alarme REF, image qui saute à la commutation). Les leaves caméras sont en domaine 0 au lieu de 127. Réseau IP : « ptp domain 127 » sur leaf-r1 et leaf-b1.',
  },
  {
    id: 'ipconf', net: true, label: 'Conflit d\'adresse IP entre deux CCU', where: 'Réseau IP (adressage)',
    can: () => S.ipMode && Object.values(FAB.devices).filter((d) => d.kind === 'ccu').length >= 2,
    inject() { const [a, b] = Object.values(FAB.devices).filter((d) => d.kind === 'ccu'); const o = { red: b.nics.red.ip, blue: b.nics.blue.ip }; b.nics.red.ip = a.nics.red.ip; b.nics.blue.ip = a.nics.blue.ip; markDirty(); return { a: a.id, b: b.id, o }; },
    check: (st) => { const a = FAB.devices[st.a], b = FAB.devices[st.b]; return !a || !b || (a.nics.red.ip !== b.nics.red.ip && a.nics.blue.ip !== b.nics.blue.ip); },
    hint: 'Deux caméras disparaissent : une CCU remplacée a été configurée avec l\'adresse IP d\'une autre, sur les deux réseaux (l\'ARP et le contrôle RPF basculent d\'un port à l\'autre). Réseau IP → plan d\'adressage (ou show ip arp sur la leaf caméras) : rendre à la CCU son adresse.',
  },
];
export function clearNetFaults() { if (FAB.res || S.ipMode) resetFabric(); }
