import { S, on, emit } from '../state.js';
import { toast } from '../ui/common.js';
import { FAB, writeMemory, resetFabric, loadFactory, markDirty, PTP_REF } from './fabric.js';
import { NET } from '../ipnet.js';
import { injectFault, ACTIVE } from '../faults.js';
import { videoGeom, mcastMac } from './analyzer.js';
import { PROG, saveProgressSoon } from '../shared.js';

// ----------------------------------------------------------------------------------
// Parcours de formation « réseau ST 2110 » : missions guidées dont les objectifs sont
// vérifiés automatiquement (actions dans le poste Réseau IP, commandes tapées, état du
// réseau), questions, quiz QCM et examen de dépannage noté. Résultats dans PROG.net.
// ----------------------------------------------------------------------------------
export const NC = { active: null, t0: 0, log: [], hints: {}, aided: {}, answers: {}, sticky: {}, entry: null, exam: null };
PROG.net = PROG.net || { missions: {}, quiz: [], exams: [] };
const P = () => (PROG.net = PROG.net || { missions: {}, quiz: [], exams: [] });

on('netlog', (e) => {
  NC.log.push({ ...e, t: S.time }); if (NC.log.length > 400) NC.log.shift();
  if ((e.type === 'refload' || e.type === 'reset') && NC.active) NC.aided[NC.active] = true;
  if ((e.type === 'refload' || e.type === 'reset') && NC.exam && NC.exam.cur) NC.exam.cur.aided = true;
});
on('fault', () => { if (NC.exam && NC.exam.cur && NC.exam.cur.entry && NC.exam.cur.entry.done && !NC.exam.cur.doneAt) NC.exam.cur.doneAt = S.time; });

// ---------------- aides à la vérification ----------------
const since = () => NC.log.filter((e) => e.t >= NC.t0);
const cmd = (pat, swPred = () => true) => since().some((e) => e.type === 'cli' && e.ok && e.pat && e.pat.startsWith(pat) && swPred(FAB.switches[e.sw]));
const ev = (type, pred = () => true) => since().some((e) => e.type === type && pred(e));
const allSaved = () => Object.values(FAB.switches).every((s) => !s.power || JSON.stringify(s.running) === JSON.stringify(s.startup));
const swRole = (r) => (sw) => sw && sw.role === r;
const swIs = (id) => (sw) => sw && sw.id === id;
const firstCcu = () => Object.values(FAB.devices).find((d) => d.kind === 'ccu');
const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, '').replace(/^(e|et|eth|ethernet)(\d+)$/, 'ethernet$2').replace(/-/g, ':');
const num = (v) => parseFloat(String(v).replace(',', '.').replace(/[^\d.\-]/g, ''));
const eqNum = (tol = 0) => (exp) => (v) => Math.abs(num(v) - exp) <= Math.max(tol * Math.abs(exp), 0.0001);
const eqStr = (exp) => (v) => norm(v) === norm(exp);
const injectSaved = (id) => { const e = injectFault(id, true); for (const sw of Object.values(FAB.switches)) if (sw.power) writeMemory(sw.id); return e; };
const solved = () => { const e = NC.entry; if (!e) return false; let ok = e.done; try { ok = ok || !!e.f.check(e.st); } catch (x) { /* état transitoire */ } return ok; };
const savedAfterFix = () => solved() && allSaved();

// ---------------- missions ----------------
// objectif : { t, ok(), live } — un objectif « live » doit être vrai au moment de la validation ;
// les autres restent acquis une fois atteints. q : question (texte, réponse attendue).
export const NET_MISSIONS = [
  {
    id: 'n1', title: 'La fabric en un coup d\'œil', tab: 'topo',
    intro: 'Deux réseaux identiques et indépendants, rouge et bleu. Chacun est une fabric spine-leaf : les appareils se raccordent aux leaves (une par zone), et chaque leaf est reliée à chaque spine.',
    obj: [
      { t: 'Onglet Topologie : sélectionner une spine', ok: () => ev('sel', (e) => e.role === 'spine') },
      { t: 'Sélectionner une leaf', ok: () => ev('sel', (e) => e.role === 'leaf') },
      { t: 'Sélectionner un lien leaf ↔ spine et lire sa charge', ok: () => ev('sel', (e) => e.kind === 'link') },
      { t: 'Sélectionner un appareil et repérer ses deux cartes (rouge et bleue)', ok: () => ev('sel', (e) => e.kind === 'dev') },
    ],
    q: [{ id: 'q1', t: 'Combien de liens 100 GbE relient une leaf aux spines de son réseau ?', a: () => 4, check: eqNum() }],
    hints: ['Les spines sont en haut (rouge) et en bas (bleu) ; cliquez une boîte pour voir son détail sous le schéma.', 'Chaque leaf a deux liens vers chacune des deux spines de son réseau.'],
    learn: 'Une leaf a 4 × 100 GbE d\'uplinks (2 par spine). Deux appareils sur des leaves différentes communiquent toujours en leaf → spine → leaf : trois commutateurs, quel que soit le chemin.',
  },
  {
    id: 'n2', title: 'Le plan d\'adressage', tab: 'addr',
    intro: 'Chaque leaf a un VLAN média et un sous-réseau /24 par réseau. Un même appareil garde la même fin d\'adresse sur le rouge et sur le bleu.',
    obj: [
      { t: 'Ouvrir l\'onglet Plan d\'adressage', ok: () => ev('tab', (e) => e.tab === 'addr') },
      { t: 'Depuis le terminal de leaf-r1-cam, pinguer la CCU 1 (ping 10.1.1.x)', ok: () => cmd('ping', swIs('LEAF-R1')) },
    ],
    q: [
      { id: 'q1', t: () => `Quelle est l'adresse IP de la ${firstCcu() ? firstCcu().name : 'CCU 1'} sur le réseau bleu ?`, a: () => (firstCcu() ? firstCcu().nics.blue.ip : ''), check: eqStr },
      { id: 'q2', t: 'Quel VLAN porte les appareils de la leaf production sur le réseau rouge ?', a: () => 102, check: eqNum() },
      { id: 'q3', t: 'Quelle passerelle utilisent les appareils de la leaf caméras sur le réseau bleu ?', a: () => '10.2.1.1', check: eqStr },
    ],
    hints: ['Plan d\'adressage → tableau « Équipements ».', 'Règle : VLAN = 100 × réseau (1 rouge, 2 bleu) + numéro de leaf ; passerelle = .1 du sous-réseau 10.réseau.leaf.0/24.'],
    learn: 'Un plan d\'adressage régulier se lit sans documentation : 10.<réseau>.<leaf>.<hôte>, VLAN 100 × réseau + leaf, passerelle en .1. En panne, c\'est ce qui permet de repérer d\'un coup d\'œil une adresse fausse.',
  },
  {
    id: 'n3', title: 'Premiers pas en ligne de commande', tab: 'switch', sw: 'LEAF-R1', sub: 'term',
    intro: 'En exploitation, on lit l\'état d\'un commutateur en ligne de commande. Les mots peuvent être abrégés (sh int st), « ? » liste les suites possibles et Tab complète.',
    obj: [
      { t: 'Sur leaf-r1-cam : show interfaces status', ok: () => cmd('show interfaces status', swIs('LEAF-R1')) },
      { t: 'Sur leaf-r1-cam : show lldp neighbors', ok: () => cmd('show lldp', swIs('LEAF-R1')) },
      { t: 'Sur leaf-r1-cam : show running-config (avec ou sans filtre « | section »)', ok: () => cmd('show running-config', swIs('LEAF-R1')) },
    ],
    q: [{ id: 'q1', t: () => { const d = Object.values(FAB.devices).filter((x) => x.kind === 'ccu')[1]; return `Sur quel port de leaf-r1-cam est raccordée la ${d ? d.name : 'CCU 2'} ?`; }, a: () => { const d = Object.values(FAB.devices).filter((x) => x.kind === 'ccu')[1]; return d ? d.nics.red.port : 'Ethernet2'; }, check: eqStr }],
    hints: ['Onglet Commutateurs → leaf-r1-cam → Terminal (CLI).', 'La colonne « Name » de show interfaces status reprend la description du port.'],
    learn: 'show interfaces status donne en une page l\'état de couche 1 (connected / notconnect / disabled), le VLAN et la vitesse ; show lldp neighbors confirme qui est réellement branché en face. C\'est toujours le premier réflexe.',
  },
  {
    id: 'n4', title: 'L\'underlay : OSPF et ECMP', tab: 'switch', sw: 'SPINE-R1', sub: 'term',
    intro: 'Les liens leaf ↔ spine sont routés (/31). OSPF annonce les sous-réseaux et répartit le trafic sur les uplinks de même coût (ECMP).',
    obj: [
      { t: 'Sur une spine : show ip ospf neighbor', ok: () => cmd('show ip ospf neighbor', swRole('spine')) },
      { t: 'Sur une leaf : show ip route', ok: () => cmd('show ip route', swRole('leaf')) },
    ],
    q: [
      { id: 'q1', t: 'Combien de voisins OSPF (en FULL) une spine a-t-elle ?', a: () => 12, check: eqNum() },
      { id: 'q2', t: 'Par combien de chemins de même coût une leaf joint-elle le sous-réseau d\'une autre leaf ?', a: () => 4, check: eqNum() },
    ],
    hints: ['Une spine voit chaque leaf de son réseau deux fois (deux liens).', 'Dans show ip route, une route O est suivie de plusieurs lignes « via » : une par chemin ECMP.'],
    learn: 'Une spine a 12 voisins (6 leaves × 2 liens) ; une leaf joint les autres sous-réseaux par 4 chemins ECMP. Si un voisin n\'est pas en FULL, le trafic est simplement réparti sur les autres liens : pas d\'effet visible, mais moins de marge.',
  },
  {
    id: 'n5', title: 'Suivre un flux de bout en bout', tab: 'flows',
    intro: 'Le contrôleur NMOS connecte l\'entrée 1 du mélangeur à une caméra : le récepteur s\'abonne en IGMPv3 aux deux groupes, et PIM construit le chemin jusqu\'à la leaf de la source, sur chaque réseau.',
    obj: [
      { t: 'Flux NMOS : sélectionner la réception « XVS-6000 entrée 1 » et lire ses deux chemins', ok: () => ev('rx', (e) => e.rx === 'ME1') },
      { t: 'Ouvrir le SDP de son émetteur', ok: () => ev('sdp', (e) => FAB.res && FAB.res.rxState.ME1 && e.fid === FAB.res.rxState.ME1.flow) },
      { t: 'Sur la spine rouge traversée : show ip mroute', ok: () => cmd('show ip mroute', (sw) => { const s = FAB.res && FAB.res.rxState.ME1; return sw && s && (sw.id === s.per.red.spine || sw.id === s.per.blue.spine); }) },
    ],
    q: [{ id: 'q1', t: 'Sur quel port leaf-r2-prod reçoit-elle ce flux depuis la spine (réseau rouge) ?', a: () => { const s = FAB.res && FAB.res.rxState.ME1; const l = s && s.per.red.ld && FAB.links.find((x) => x.id === s.per.red.ld); return l ? l.a.port : '—'; }, check: eqStr }],
    hints: ['Le détail de la réception donne le chemin : appareil → leaf → port → spine → port → leaf → appareil.', 'show ip mroute sur leaf-r2-prod donne aussi l\'« Incoming interface ».'],
    learn: 'Le chemin multicast se lit à chaque saut avec show ip mroute : interface d\'entrée (vers la source, contrôle RPF) et liste des interfaces de sortie. Le choix de la spine et de l\'uplink dépend d\'un hachage du groupe (ECMP).',
  },
  {
    id: 'n6', title: 'Lire un SDP', tab: 'addr',
    intro: 'Le SDP décrit un flux : adresses des deux jambes, format, horloge PTP. NMOS IS-05 le transmet au récepteur.',
    obj: [{ t: 'Ouvrir le SDP d\'un flux vidéo (plan d\'adressage ou flux NMOS)', ok: () => ev('sdp', (e) => /^v:/.test(e.fid)) }],
    q: [
      { id: 'q1', t: 'Quel type de charge RTP (PT) porte la vidéo ST 2110-20 dans ce car ?', a: () => 96, check: eqNum() },
      { id: 'q2', t: 'Quelle ligne du SDP regroupe les deux jambes rouge et bleue ? (commencez par a=)', a: () => 'a=group:DUP primary secondary', check: () => (v) => /a=group:dup/.test(String(v).toLowerCase().replace(/\s+/g, '')) },
      { id: 'q3', t: () => `Quel est le groupe multicast bleu de ${FAB.flows['v:CAM1'] ? 'la CAM 1' : 'la première caméra'} ?`, a: () => (FAB.flows['v:CAM1'] || Object.values(FAB.flows).find((f) => f.kind === 'video')).groups.blue, check: eqStr },
    ],
    hints: ['Chaque ligne du SDP est commentée dans la fenêtre : survolez-la ou lisez la colonne de droite.', 'm=video 5004 RTP/AVP 96 : le dernier nombre est le type de charge.'],
    learn: 'Un SDP ST 2110 porte deux m= (primary / secondary) regroupés par a=group:DUP, un filtre de source (SSM), les paramètres de l\'image (fmtp) et la référence PTP (ts-refclk). Un SDP faux = un récepteur abonné au mauvais flux.',
  },
  {
    id: 'n7', title: 'PTP : qui donne l\'heure ?', tab: 'meas', msub: 'ptpm',
    intro: 'Les commutateurs sont des horloges frontières : chacun se cale sur son maître et redistribue l\'heure. Le grand maître est élu par le BMCA.',
    obj: [
      { t: 'Sur un commutateur : show ptp parent', ok: () => cmd('show ptp parent') },
      { t: 'Mesures → Suivi PTP : observer l\'offset d\'une CCU', ok: () => ev('tool', (e) => e.tool === 'ptpm') },
      { t: 'Couper le grand maître 1 et constater l\'élection du grand maître 2', ok: () => NC.sticky.gm2elected },
      { t: 'Remettre le grand maître 1 en service (il est réélu)', live: true, ok: () => NC.sticky.gm2elected && FAB.gm.gm1.up && FAB.res && FAB.res.gmActive.red && FAB.res.gmActive.red.id === 'gm1' },
    ],
    q: [{ id: 'q1', t: 'Quel domaine PTP utilise le profil SMPTE ST 2059-2 par défaut ?', a: () => PTP_REF.domain, check: eqNum() }],
    hints: ['Mesures → Suivi PTP : bouton « Couper le grand maître 1 ».', 'Le transitoire de l\'offset au changement de maître dure quelques secondes : c\'est l\'asservissement qui converge.'],
    learn: 'Au changement de grand maître, les appareils voient un petit saut d\'offset (quelques centaines de ns) que leur asservissement rattrape : l\'image n\'est pas affectée tant que les deux grands maîtres sont verrouillés sur le GPS.',
    track: () => { if (FAB.res && !FAB.gm.gm1.up && FAB.res.gmActive.red && FAB.res.gmActive.red.id === 'gm2') NC.sticky.gm2elected = true; },
  },
  {
    id: 'n8', title: 'Mesurer un flux ST 2110', tab: 'meas', msub: 'stream',
    intro: 'Un analyseur de flux vérifie le débit, la régularité des paquets (ST 2110-21), les pertes et l\'écart entre les deux jambes 2022-7. La capture montre les paquets eux-mêmes.',
    obj: [
      { t: 'Mesures → Analyseur de flux : analyser la réception XVS-6000 entrée 1', ok: () => ev('analyzer', (e) => e.rx === 'ME1') },
      { t: 'Mesures → Capture : capturer le trafic du port d\'une CCU (session miroir)', ok: () => ev('capture', (e) => Object.values(FAB.devices).some((x) => x.kind === 'ccu' && Object.values(x.nics).some((n) => n.sw === e.sw && n.port === e.port))) },
    ],
    q: [
      { id: 'q1', t: 'Quel est le CMAX d\'un émetteur étroit (type N) dans le format de ce car ?', a: () => videoGeom().cmax, check: eqNum() },
      { id: 'q2', t: 'Combien de paquets par seconde compte un flux vidéo dans ce format ?', a: () => videoGeom().pps, check: eqNum(0.03) },
      { id: 'q3', t: 'Quelle est l\'adresse MAC de destination du groupe 239.1.1.1 ?', a: () => mcastMac('239.1.1.1'), check: eqStr },
    ],
    hints: ['L\'analyseur affiche la géométrie du flux : paquets par image, paquets par seconde, CMAX, VRX.', 'MAC multicast : 01:00:5e suivi des 23 bits de poids faible du groupe.'],
    learn: 'CINST mesuré ≤ CMAX et VRX ≤ VRX_FULL : l\'émetteur est conforme ST 2110-21 et un récepteur étroit ne débordera pas. Une capture se fait sur un port miroir (SPAN) : attention, si le port de destination est plus lent que le trafic recopié, c\'est la capture qui perd des paquets, pas le réseau.',
  },
  {
    id: 'n9', title: 'Dépannage : une caméra a disparu', tab: 'diag', setup: () => { NC.entry = injectSaved('vlanccu'); },
    intro: 'Le réalisateur signale qu\'une caméra est noire au multiview, sur les deux réseaux. La configuration fautive a été enregistrée : redémarrer le commutateur ne suffira pas.',
    obj: [
      { t: 'Rétablir l\'image de la caméra', live: true, ok: solved },
      { t: 'Enregistrer la correction (write memory) sur les commutateurs modifiés', live: true, ok: savedAfterFix },
    ],
    hints: ['Diagnostic : quel appareil est injoignable, et pourquoi ?', 'show interfaces status sur la leaf caméras : regardez la colonne Vlan du port de la CCU.', 'interface EthernetN ⏎ switchport access vlan 101 (201 en bleu) ⏎ end ⏎ wr'],
    learn: 'Un port d\'accès dans le mauvais VLAN coupe l\'appareil de sa passerelle : plus rien n\'entre ni ne sort. La correction doit être faite sur les deux réseaux, puis enregistrée.',
  },
  {
    id: 'n10', title: 'Dépannage : une alarme sans effet visible', tab: 'diag', setup: () => { NC.entry = injectSaved('mtu'); },
    intro: 'Aucune plainte à l\'image, mais des alarmes réseau sont apparues. Une leaf bleue a été modifiée pendant la nuit.',
    obj: [
      { t: 'Identifier les voisinages OSPF bloqués (show ip ospf neighbor)', ok: () => cmd('show ip ospf neighbor', (sw) => sw && sw.color === 'blue') },
      { t: 'Rétablir les voisinages OSPF', live: true, ok: solved },
      { t: 'Enregistrer la correction', live: true, ok: savedAfterFix },
    ],
    hints: ['Un voisin en EXSTART qui ne passe jamais en FULL : comparez la MTU des deux côtés.', 'show interfaces Ethernet49 sur la leaf, puis sur la spine en face.'],
    learn: 'Une MTU différente aux deux bouts bloque OSPF en EXSTART : le lien est « up » mais ne route rien. Le trafic passe par les autres chemins… jusqu\'à la prochaine panne. Une alarme sans effet visible n\'est jamais à ignorer.',
  },
  {
    id: 'n11', title: 'Dépannage : les ralentis s\'arrêtent… plus tard', tab: 'diag', setup: () => { NC.entry = injectSaved('querier'); },
    intro: 'Rien ne se passe pendant quelques dizaines de secondes, puis l\'EVS perd ses entrées d\'enregistrement. Pourquoi aussi longtemps après la modification ?',
    obj: [
      { t: 'Vérifier le querier IGMP de la leaf ralentis (show ip igmp snooping querier)', ok: () => cmd('show ip igmp snooping querier', (sw) => sw && sw.k === 3) },
      { t: 'Rétablir le querier sur les deux réseaux', live: true, ok: solved },
      { t: 'Enregistrer la correction', live: true, ok: savedAfterFix },
    ],
    hints: ['Le querier est la SVI en IGMPv3 (interface Vlan103 / Vlan203).', 'interface Vlan103 ⏎ ip igmp version 3'],
    learn: 'Sans querier, personne ne relance les rapports IGMP : les abonnements expirent après l\'intervalle d\'appartenance (≈ 260 s en réalité). La cause et l\'effet sont séparés de plusieurs minutes : on remonte le temps avec show logging.',
  },
  {
    id: 'n12', title: 'Bande passante : PIM ou SDN ?', tab: 'meas', msub: 'load', setup: () => { NC.entry = injectSaved('ipmv'); },
    intro: 'Des tuiles du multiview se dégradent. En PIM, personne ne contrôle la bande passante ; un contrôleur SDN, lui, refuse ce qui ne passe pas.',
    obj: [
      { t: 'Mesures → Charge des liens : trouver le lien saturé', ok: () => ev('tool', (e) => e.tool === 'load') },
      { t: 'Flux NMOS : passer le contrôleur en mode SDN et observer les refus', ok: () => NC.sticky.sdn },
      { t: 'Remettre le port du multiviewer à sa vitesse nominale', live: true, ok: solved },
      { t: 'Enregistrer la correction', live: true, ok: savedAfterFix },
    ],
    hints: ['Le lien le plus chargé est en tête du tableau (rouge au-delà de 100 %).', 'Port Ethernet53 des leaves monitoring : speed 100g.'],
    learn: 'En PIM, un lien saturé dégrade tous les flux qui le traversent (pertes de paquets partout). En SDN, le contrôleur refuse les connexions de trop : les tuiles concernées sont noires mais les autres restent parfaites. C\'est un choix d\'exploitation.',
    track: () => { if (FAB.mode === 'sdn') NC.sticky.sdn = true; },
  },
  {
    id: 'n13', title: 'Une horloge pirate', tab: 'ptp', setup: () => { NC.entry = injectSaved('rogue'); NC.rogue = NC.entry && NC.entry.st && NC.entry.st.dev; },
    intro: 'Les caméras sautent à la commutation : PTP n\'est plus traçable. Un appareil mis à jour s\'annonce comme maître.',
    obj: [
      { t: 'Identifier le maître élu (show ptp parent)', ok: () => cmd('show ptp parent') },
      { t: 'Faire réélire un grand maître GPS (appareil en slave only)', live: true, ok: () => !NET.rogue },
      { t: 'Protéger le port d\'accès de l\'appareil (ptp role master, rouge et bleu)', live: true, ok: () => { const d = FAB.devices[NC.rogue]; return !d || ['red', 'blue'].every((c) => FAB.switches[d.nics[c].sw].running.ports[d.nics[c].port].ptpRole === 'master'); } },
      { t: 'Enregistrer la correction', live: true, ok: savedAfterFix },
    ],
    hints: ['PTP → tableau « Grand maître élu par réseau » ; puis tableau des appareils (case slave only).', 'Sur la leaf de l\'appareil : interface EthernetN ⏎ ptp role master'],
    learn: 'Le BMCA compare d\'abord priority1 : un appareil mal réglé peut battre deux grands maîtres GPS. Double protection : appareils en « slave only », et « ptp role master » sur les ports d\'accès pour ignorer leurs annonces.',
  },
  {
    id: 'n14', title: 'Reconstruire une leaf', tab: 'switch', sw: 'LEAF-B5', sub: 'term', setup: () => { loadFactory('LEAF-B5'); writeMemory('LEAF-B5'); markDirty(); },
    intro: 'La leaf audio du réseau bleu a été remplacée par un commutateur neuf, en configuration usine. Reconfigurez-la (sans charger la configuration de référence) : VLAN 205, SVI 10.2.5.1/24 en IGMPv3 + PIM + OSPF, uplinks routés en /31, PTP, QoS…',
    obj: [
      { t: 'leaf-b5 sans alarme et tous les flux audio protégés (rouge + bleu)', live: true, ok: () => { const sw = FAB.switches['LEAF-B5']; if (!sw || !FAB.res) return false; const bad = FAB.issues.some((i) => i.sw === 'LEAF-B5' && i.sev !== 'info'); const audio = Object.entries(FAB.res.rxState).filter(([k]) => k.startsWith('CONS:') || k.startsWith('CU:')); return !bad && audio.length > 0 && audio.every(([, s]) => s.protected); } },
      { t: 'Enregistrer la configuration', live: true, ok: () => { const sw = FAB.switches['LEAF-B5']; return sw && JSON.stringify(sw.running) === JSON.stringify(sw.startup); } },
    ],
    hints: ['Comparez avec leaf-r5-audio : show running-config, en remplaçant 1 par 2 dans les adresses et 105 par 205.', 'Uplinks : no switchport ⏎ ip address 10.255.2.x/31 ⏎ speed 100g ⏎ error-correction encoding reed-solomon ⏎ pim ipv4 sparse-mode ⏎ ip ospf area 0.0.0.0 ⏎ ptp enable', 'Global : hostname, ip routing, ip multicast-routing, ip pim ssm range 239.0.0.0/8, router ospf 1, ptp mode boundary, ptp domain 127, ptp profile smpte2059-2, qos trust dscp.'],
    learn: 'Reconstruire une leaf, c\'est dérouler les couches dans l\'ordre : ports et vitesses, VLAN et SVI, routage, multicast, PTP, QoS — puis enregistrer. Gardez toujours une sauvegarde des configurations de référence.',
  },
];

// ---------------- déroulement ----------------
export function startMission(id) {
  const m = NET_MISSIONS.find((x) => x.id === id); if (!m) return;
  if (NC.exam) { toast('Un examen est en cours', 'bad'); return; }
  if (m.setup) resetFabric();
  NC.active = id; NC.t0 = S.time; NC.entry = null; NC.sticky = {}; NC.hints[id] = 0; NC.aided[id] = false;
  for (const q of m.q || []) delete NC.answers[id + ':' + q.id];
  if (m.setup) m.setup();
  emit('netcourse', { type: 'start', id });
}
export function stopMission() { NC.active = null; NC.entry = null; emit('netcourse', { type: 'stop' }); }
export function answer(mid, qid, v) {
  const m = NET_MISSIONS.find((x) => x.id === mid); const q = m && m.q.find((x) => x.id === qid); if (!q) return false;
  const ok = q.check(q.a())(v);
  if (ok) NC.answers[mid + ':' + qid] = true;
  emit('netcourse', { type: 'answer', ok });
  return ok;
}
export function qText(q) { return typeof q.t === 'function' ? q.t() : q.t; }
export function objectivesOf(m) {
  return m.obj.map((o, i) => { const k = m.id + ':o' + i; let ok = false; try { ok = !!o.ok(); } catch (e) { ok = false; } if (ok && !o.live) NC.sticky[k] = true; return { t: o.t, ok: o.live ? ok : ok || !!NC.sticky[k], live: o.live }; });
}
export function hint(mid) { const m = NET_MISSIONS.find((x) => x.id === mid); const n = NC.hints[mid] = Math.min((NC.hints[mid] || 0) + 1, m.hints.length); return m.hints.slice(0, n); }
export function missionScore(mid) { return Math.max(2, 10 - 2 * (NC.hints[mid] || 0) - (NC.aided[mid] ? 5 : 0)); }
export function updateCourse(dt = 0.1) {
  if (!S.ipMode) return;
  if (NC.active) {
    const m = NET_MISSIONS.find((x) => x.id === NC.active);
    if (m.track) m.track();
    const objs = objectivesOf(m);
    const qs = (m.q || []).every((q) => NC.answers[m.id + ':' + q.id]);
    if (objs.every((o) => o.ok) && qs) {
      const pts = missionScore(m.id);
      const prev = P().missions[m.id];
      P().missions[m.id] = { at: Date.now(), pts: Math.max(pts, prev ? prev.pts : 0), hints: NC.hints[m.id] || 0, aided: !!NC.aided[m.id], dur: Math.round(S.time - NC.t0) };
      saveProgressSoon();
      toast(`Mission réseau réussie : ${m.title} (${pts}/10)`, 'good', 5000);
      NC.done = { id: m.id, pts };
      NC.active = null; NC.entry = null;
      emit('netcourse', { type: 'done', id: m.id, pts });
    }
  }
  if (NC.exam) updateExam(dt);
}
export function courseTotals() { const M = P().missions; const done = NET_MISSIONS.filter((m) => M[m.id]); return { done: done.length, total: NET_MISSIONS.length, pts: done.reduce((a, m) => a + M[m.id].pts, 0), max: NET_MISSIONS.length * 10 }; }
export function resetCourse() { P().missions = {}; saveProgressSoon(); emit('netcourse', { type: 'reset' }); }

// ---------------- quiz ----------------
export const QUIZ = [
  ['En ST 2110, comment voyagent la vidéo, le son et les données ?', ['Dans des flux séparés, chacun avec ses propres groupes multicast', 'Dans un seul flux, comme un signal SDI encapsulé', 'Dans des trames Ethernet sans couche IP', 'En TCP, pour garantir la livraison'], 0, 'Chaque essence est un flux RTP/UDP séparé (-20 vidéo, -30 audio, -40 données). Encapsuler un SDI complet, c\'est ST 2022-6.'],
  ['Que transporte ST 2110-20 ?', ['La vidéo non compressée (image active)', 'La vidéo compressée JPEG XS', 'L\'audio PCM', 'Le timecode et les sous-titres'], 0, '-22 : vidéo compressée (JPEG XS), -30 : audio, -40 : données annexes.'],
  ['Débit approximatif d\'un flux 1080p50 4:2:2 10 bits en ST 2110-20 ?', ['≈ 2,1 Gb/s', '≈ 1,5 Gb/s', '≈ 3 Gb/s', '≈ 12 Gb/s'], 0, '1920 × 1080 × 20 bits × 50 ≈ 2,07 Gb/s d\'image active, un peu plus avec les en-têtes.'],
  ['Débit approximatif d\'un flux UHD 2160p50 4:2:2 10 bits ?', ['≈ 8,3 Gb/s', '≈ 2,1 Gb/s', '≈ 12 Gb/s', '≈ 25 Gb/s'], 0, '3840 × 2160 × 20 × 50 ≈ 8,3 Gb/s : trois flux UHD remplissent presque un port 25 GbE.'],
  ['Que fait SMPTE ST 2022-7 ?', ['Envoie deux copies de chaque flux sur deux réseaux et les fusionne paquet par paquet', 'Compresse les flux pour économiser la bande passante', 'Ajoute une correction d\'erreurs dans chaque paquet', 'Synchronise les commutations au top image'], 0, 'Commutation sans coupure : une perte sur un réseau est comblée par l\'autre copie.'],
  ['Le réseau rouge tombe entièrement. Que voit-on à l\'image ?', ['Rien : tout arrive par le bleu, mais il n\'y a plus de protection', 'Une image figée pendant la bascule', 'Le noir sur toutes les sources', 'Des pertes de paquets sur une source sur deux'], 0, 'C\'est tout l\'intérêt de 2022-7 — et son piège : une panne invisible qu\'il faut traiter tout de suite.'],
  ['Domaine PTP par défaut du profil SMPTE ST 2059-2 ?', ['127', '0', '24', '44'], 0, 'Domaine 127, Announce 2^-2 s, Sync 2^-3 s.'],
  ['Premier critère comparé par le BMCA pour élire le grand maître ?', ['priority1 (le plus petit gagne)', 'La précision de l\'horloge', 'L\'adresse MAC', 'Le nombre de sauts'], 0, 'Ordre : priority1, clockClass, précision, variance, priority2, identité.'],
  ['clockClass 6 signifie…', ['Grand maître verrouillé sur sa référence (GPS)', 'Horloge libre, non traçable', 'Horloge en maintien (holdover) hors tolérance', 'Appareil esclave seulement'], 0, '6 : verrouillé sur la référence primaire, 7 : holdover dans la tolérance, 248 : valeur par défaut d\'une horloge libre.'],
  ['Une horloge frontière (boundary clock)…', ['se cale sur son maître par un port esclave et redistribue l\'heure sur ses autres ports', 'corrige seulement le temps de traversée dans les messages', 'est forcément un grand maître GPS', 'ne transmet pas les messages PTP'], 0, 'L\'horloge transparente, elle, corrige le temps de résidence sans se caler.'],
  ['Comment doit être réglé PTP sur un appareil (CCU, passerelle…) ?', ['En « slave only »', 'Avec priority1 = 0', 'En horloge frontière', 'Dans le domaine 0'], 0, 'Sinon, un appareil mal réglé peut se faire élire grand maître. Protection supplémentaire : « ptp role master » sur le port d\'accès.'],
  ['Pourquoi IGMPv3 plutôt qu\'IGMPv2 en ST 2110 ?', ['IGMPv3 permet de s\'abonner à un flux d\'une source précise (S,G)', 'IGMPv3 est plus rapide', 'IGMPv2 ne fonctionne pas en 25 GbE', 'IGMPv3 chiffre les flux'], 0, 'Indispensable en SSM : le récepteur indique la source et le groupe.'],
  ['Plage multicast SSM par défaut ?', ['232.0.0.0/8', '239.0.0.0/8', '224.0.0.0/24', '225.0.0.0/8'], 0, 'Avec des groupes en 239.x, il faut configurer « ip pim ssm range 239.0.0.0/8 » partout.'],
  ['Que se passe-t-il si le snooping IGMP est désactivé sur une leaf ?', ['Tous les flux du VLAN sortent sur tous les ports (inondation)', 'Plus aucun flux ne passe', 'Seuls les flux audio passent', 'Rien, le querier suffit'], 0, 'Les cartes 25 GbE débordent vite : pertes sur tous les appareils de la leaf.'],
  ['Le querier IGMP disparaît. Quand les flux s\'arrêtent-ils ?', ['À l\'expiration des abonnements (≈ 260 s par défaut)', 'Immédiatement', 'Jamais', 'Au prochain redémarrage du commutateur'], 0, 'Intervalle d\'appartenance = 2 × 125 s + 10 s. La cause et l\'effet sont séparés de plusieurs minutes.'],
  ['Deux routeurs OSPF ont une MTU différente sur leur lien. État du voisinage ?', ['Bloqué en EXSTART / EXCHANGE', 'FULL', 'DOWN, le lien tombe', '2-WAY'], 0, 'Le lien est monté, mais les descriptions de base sont refusées : pas de routage par ce lien.'],
  ['À 25 GbE ou 100 GbE sur fibre courte, quelle correction d\'erreurs est attendue ?', ['Reed-Solomon (RS-FEC)', 'Aucune', 'Fire-code', 'Hamming'], 0, 'Une FEC différente aux deux bouts empêche le lien de monter.'],
  ['Combien de commutateurs traverse un flux entre deux appareils de leaves différentes ?', ['3 (leaf, spine, leaf)', '2', '4', 'Cela dépend du nombre de leaves'], 0, 'C\'est la propriété du spine-leaf : latence et nombre de sauts constants.'],
  ['NMOS IS-04 et IS-05 servent respectivement à…', ['l\'enregistrement / découverte et la gestion des connexions', 'la synchronisation et la redondance', 'la compression et le chiffrement', 'la supervision SNMP et les alarmes'], 0, 'IS-04 : registre des nœuds, émetteurs, récepteurs. IS-05 : connecter un récepteur en lui passant un SDP.'],
  ['Le registre NMOS tombe en plein direct. Conséquence ?', ['Les flux établis continuent, mais plus aucune connexion n\'est possible', 'Tout passe au noir', 'Les flux passent sur un seul réseau', 'PTP se désynchronise'], 0, 'Ce sont les commutateurs qui portent les flux, pas le registre.'],
  ['Adresse MAC de destination du groupe 239.1.2.3 ?', ['01:00:5e:01:02:03', 'ff:ff:ff:ff:ff:ff', '01:00:5e:ef:01:02', '33:33:01:02:03:00'], 0, '01:00:5e + les 23 bits de poids faible : 32 groupes partagent la même MAC.'],
  ['Un émetteur ST 2110-21 de type N (étroit)…', ['envoie des paquets réguliers ; le récepteur n\'a besoin que d\'un petit tampon', 'envoie l\'image par rafales', 'est réservé à l\'audio', 'n\'a pas besoin de PTP'], 0, 'Le modèle fixe CMAX (rafale tolérée) et VRX_FULL (tampon du récepteur virtuel).'],
  ['En mode PIM, un uplink est saturé. Que se passe-t-il ?', ['Tous les flux qui le traversent perdent des paquets', 'Le dernier flux connecté est refusé', 'Le trafic bascule sur l\'autre réseau', 'Rien grâce à la QoS'], 0, 'Un contrôleur SDN, lui, aurait refusé la connexion de trop.'],
  ['Marquage DSCP recommandé pour PTP (AES67) ?', ['46 (EF)', '34 (AF41)', '26 (AF31)', '0'], 0, 'Et une file prioritaire dans les commutateurs, pour une latence constante.'],
  ['Session miroir d\'un port 100 GbE chargé à 60 Gb/s vers un port 25 GbE. Conséquence ?', ['La capture est incomplète, le réseau n\'est pas affecté', 'Le port source perd des paquets', 'Les flux sont refusés', 'Le commutateur redémarre'], 0, 'Les paquets manquants sont dans la capture, pas sur le réseau : vérifiez toujours la capacité du port miroir.'],
  ['Pourquoi un VLAN par leaf dans ce car ?', ['Le niveau 2 reste local : tout ce qui sort de la leaf est routé', 'Pour séparer la vidéo de l\'audio', 'Parce que PTP l\'exige', 'Pour économiser des adresses IP'], 0, 'Pas de VLAN étendu sur la fabric : pas de boucles ni de tempêtes de diffusion entre leaves.'],
];
export function newQuiz(n = 10) {
  const idx = QUIZ.map((_, i) => i).sort(() => Math.random() - 0.5).slice(0, n);
  return idx.map((i) => { const [q, opts, a, ex] = QUIZ[i]; const order = opts.map((_, k) => k).sort(() => Math.random() - 0.5); return { q, opts: order.map((k) => opts[k]), a: order.indexOf(a), ex }; });
}
export function saveQuiz(score, n) { P().quiz.push({ at: Date.now(), score, n }); P().quiz = P().quiz.slice(-20); saveProgressSoon(); }

// ---------------- examen ----------------
const EXAM_POOL = ['vlanccu', 'snoop', 'querier', 'ssm', 'mtu', 'rogue', 'fec', 'ptpdom', 'ipconf', 'ipmv'];
export const EXAM_TIME = 15 * 60;
export function startExam() {
  if (!S.ipMode) { toast('L\'examen réseau demande un car IP', 'bad'); return; }
  NC.active = null; resetFabric();
  const ids = EXAM_POOL.slice().sort(() => Math.random() - 0.5).slice(0, 3);
  NC.exam = { t0: S.time, ids, i: -1, faults: [], cur: null, wait: 2, base: null, over: false };
  emit('netcourse', { type: 'exam' });
}
function nextExamFault() {
  const E = NC.exam; E.i++;
  if (E.i >= E.ids.length) { endExam(); return; }
  const id = E.ids[E.i];
  const entry = injectSaved(id);
  E.cur = { id, entry, t0: S.time, aided: false, doneAt: null, label: entry ? entry.f.label : id };
  E.faults.push(E.cur);
}
function updateExam(dt) {
  const E = NC.exam; if (E.over) return;
  if (E.base == null && FAB.res) E.base = FAB.issues.filter((i) => i.sev !== 'info').length;
  if (S.time - E.t0 > EXAM_TIME) { endExam(); return; }
  if (!E.cur) { E.wait -= dt; if (E.wait <= 0 && S.time - E.t0 > 1) nextExamFault(); return; }
  if (E.cur.entry && E.cur.entry.done) { if (!E.cur.doneAt) E.cur.doneAt = S.time; E.cur = null; E.wait = 3; }
}
export function endExam() {
  const E = NC.exam; if (!E || E.over) return;
  E.over = true; E.dur = Math.round(S.time - E.t0);
  const issues = FAB.issues.filter((i) => i.sev !== 'info').length;
  const saved = allSaved();
  let pts = 0;
  for (const f of E.faults) {
    f.pts = 0;
    if (f.entry && f.entry.done) { const dt = (f.doneAt || S.time) - f.t0; f.dur = Math.round(dt); f.pts = 20 + Math.round(10 * Math.max(0, Math.min(1, (480 - dt) / 300))); if (f.aided) f.pts = Math.round(f.pts / 2); }
    pts += f.pts;
  }
  const max = E.ids.length * 30;
  // pannes jamais atteintes (temps écoulé ou examen arrêté)
  for (let k = E.faults.length; k < E.ids.length; k++) E.faults.push({ id: E.ids[k], label: `Panne ${k + 1} (non atteinte)`, entry: null, pts: 0, aided: false });
  // alarmes ajoutées par le stagiaire : comptées seulement si toutes les pannes sont résolues
  const allFixed = E.faults.every((f) => f.entry && f.entry.done);
  const pen = (saved ? 0 : 10) + (allFixed ? Math.min(15, Math.max(0, issues - (E.base || 0)) * 5) : 0);
  E.pen = pen; E.saved = saved; E.issuesLeft = issues;
  E.score = Math.max(0, Math.round((pts - pen) / max * 100));
  P().exams.push({ at: Date.now(), score: E.score, dur: E.dur, faults: E.faults.map((f) => ({ id: f.id, label: f.label, ok: !!(f.entry && f.entry.done), dur: f.dur || null, pts: f.pts, aided: f.aided })), saved, pen });
  P().exams = P().exams.slice(-20); saveProgressSoon();
  emit('netcourse', { type: 'examEnd' });
}
export function closeExam() { NC.exam = null; emit('netcourse', { type: 'examClose' }); }
export function examReportHTML(E) {
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Examen réseau ST 2110</title><style>body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#111}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px}</style></head><body>
<h1>Examen réseau ST 2110</h1><p>${new Date().toLocaleString('fr-FR')} · score ${E.score} % · durée ${Math.floor(E.dur / 60)} min ${E.dur % 60} s</p>
<table><tr><th>Panne</th><th>Résolue</th><th>Temps</th><th>Points</th><th>Aide</th></tr>${E.faults.map((f) => `<tr><td>${esc(f.label)}</td><td>${f.entry && f.entry.done ? 'oui' : 'non'}</td><td>${f.dur ? f.dur + ' s' : '—'}</td><td>${f.pts} / 30</td><td>${f.aided ? 'configuration de référence chargée' : '—'}</td></tr>`).join('')}</table>
<p>Configurations enregistrées : ${E.saved ? 'oui' : 'non (−10)'} · alarmes restantes : ${E.issuesLeft} · pénalités : ${E.pen}</p></body></html>`;
}
export { ACTIVE };
