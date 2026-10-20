// @ts-check
import { loadFactory, loadReference, writeMemory, markDirty } from '../../net/fabric.js';
import { CFG, host, refHost, devicePorts, portRange, portsShort, uplinks, leafPlan, accessOk, uplinkOk, ospfFull, ptpSynced, issuesOf, saved, rxSummary, devFlowsProtected } from '../net_helpers.js';

// ----------------------------------------------------------------------------------
// Parcours du chef de car : mettre en service, couche par couche, une leaf neuve (la leaf
// caméras du réseau rouge, sortie de son carton en configuration usine).
// ----------------------------------------------------------------------------------
const L = 'LEAF-R1';
const P = () => leafPlan(L);
const devs = () => devicePorts(L);
const R = () => portRange(devs().map((d) => d.port));
const UP = () => uplinks(L);
const cfg = () => CFG(L);
const term = { station: 'reseau', tab: 'switch', sw: L, sub: 'term' };
const T = (sub) => [{ sel: '#station .net-swmain .tabs .tab', text: sub }];
const termInput = [{ sel: '#station .net-cmd', label: 'tape ici' }];
const said = (pat) => (c) => c.seen('cli', (e) => e.ok && e.sw === L && e.pat && e.pat.startsWith(pat));

/** @type {import('../engine.js').Lesson} */
export const LESSON_LEAF = {
  id: 'reseau-leaf', domain: 'Réseau ST 2110', stations: ['reseau'], needs: { ip: true },
  title: 'Mettre en service une leaf neuve',
  summary: 'Le commutateur des caméras (réseau rouge) a été remplacé. On le configure ensemble, couche par couche : ports, VLAN, routage, OSPF, multicast, PTP, QoS, puis on enregistre.',
  duration: '25 min', level: 'intermédiaire',
  cleanupLabel: 'Remettre la leaf caméras rouge dans sa configuration de référence',
  cleanup: () => { loadReference(L); writeMemory(L); markDirty(); },
  outro: 'Tu viens de faire ce qu\'on fait en vrai après le remplacement d\'un commutateur. Retiens l\'ordre : physique, VLAN, IP, routage, multicast, synchro, priorités, et enregistrer. Et garde toujours une copie des configurations de référence : le jour J, on recharge la sauvegarde et on vérifie avec les mêmes « show ».',
  steps: [
    {
      id: 'intro', title: 'Le travail du jour',
      say: (c) => `Salut ! Je suis Olivier, le chef de car. Aujourd'hui, un cas classique : la **leaf caméras du réseau rouge** a grillé cette nuit, on l'a remplacée par un commutateur neuf. Il sort du carton : configuration usine, il ne sait rien faire.\n\nSur cette leaf arrivent les ${devs().length} CCU (${portsShort(devs().map((d) => d.port))}) et partent 4 liens 100 Gb/s vers les deux spines rouges. On va la configurer **couche par couche**, comme on le fait toujours : d'abord le physique, puis le niveau 2 (VLAN), le niveau 3 (adresses, routage), le multicast, la synchro PTP et les priorités. À chaque étape je t'explique pourquoi, et on vérifie avant de passer à la suite.`,
    },
    {
      id: 'swap', title: 'Le commutateur neuf est en place',
      enter: () => { loadFactory(L); writeMemory(L); markDirty(); },
      say: (c) => { const r = rxSummary(); return `Voilà, il est en baie et câblé, en configuration usine. Regarde ce que ça change : ${r.single.length} réceptions sur ${r.total} n'arrivent plus que par le réseau bleu, et **aucune n'est perdue**.\n\nC'est tout l'intérêt du double réseau **rouge / bleu (SMPTE ST 2022-7)** : chaque appareil émet ses flux sur les deux réseaux, et chaque récepteur garde, paquet par paquet, celui qui arrive. À l'antenne, personne n'a rien vu. Par contre, on n'a plus de secours sur les caméras : si le bleu tousse maintenant, l'image tombe. On s'y met.`; },
    },
    {
      id: 'open', title: 'Ouvrir le poste Réseau IP',
      say: 'Tout se passe au poste **Réseau IP**, dans la zone technique du car. C\'est notre console de supervision : topologie, configuration des commutateurs, flux, PTP, mesures.',
      do: 'Va au poste Réseau IP (bouton « Emmène-moi » si tu veux).',
      go: { station: 'reseau' },
      done: (c) => c.view().station === 'reseau', skip: (c) => c.view().station === 'reseau',
      ok: 'Te voilà au poste. En haut, le bandeau résume l\'état des deux réseaux.',
      hints: ['Le poste est dans la zone technique, au fond du car, à côté des baies.', 'Touche Tab (le pupitre), puis la touche « Réseau IP » dans la rangée Technique.'],
      auto: (c) => c.io.go({ station: 'reseau' }),
    },
    {
      id: 'select', title: 'Choisir le commutateur',
      say: 'Onglet **Commutateurs** : à gauche, la liste des 17 commutateurs du car (rouge, bleu et contrôle). Notre leaf neuve ne s\'appelle plus « leaf-r1-cam » : en usine, son nom est **localhost**.',
      do: 'Ouvre l\'onglet Commutateurs et sélectionne « localhost » dans la colonne rouge.',
      go: { station: 'reseau', tab: 'switch', sw: L },
      show: (c) => (c.view().tab === 'switch' ? [{ sel: '#station .net-swbtn', text: host(L), label: 'la leaf neuve' }] : [{ sel: '#station .tabs .tab[data-k="switch"]', label: 'Commutateurs' }]),
      done: (c) => c.view().tab === 'switch' && c.view().sw === L,
      ok: 'La face avant s\'affiche : ports 1 à 48 en SFP28 (25 Gb/s) pour les appareils, 49 à 56 en QSFP28 (100 Gb/s) pour les liens vers les spines. En usine, tous les ports sont dans le VLAN 1 et rien n\'est routé.',
      hints: ['L\'onglet « Commutateurs » est le troisième en haut du poste.', 'Dans la colonne « Rouge », le bouton marqué « localhost ».'],
      auto: (c) => c.io.go({ station: 'reseau', tab: 'switch', sw: L, sub: 'ports' }),
    },
    {
      id: 'term', title: 'Ouvrir le terminal',
      say: 'On pourrait tout faire à la souris dans les sous-onglets, mais en exploitation on travaille en **ligne de commande** : c\'est plus rapide, on voit exactement ce qu\'on envoie, et c\'est la même chose sur tous les commutateurs du marché (à quelques mots près).',
      do: 'Ouvre le sous-onglet « Terminal (CLI) ».',
      go: term, show: T('Terminal'),
      done: (c) => c.view().tab === 'switch' && c.view().sw === L && c.view().sub === 'term',
      ok: 'Le prompt « localhost# » t\'attend. Astuces : les mots s\'abrègent (sh int st), Tab complète, ↑ rappelle la commande précédente, « ? » liste ce qui est possible.',
      auto: (c) => c.io.go(term),
    },
    {
      id: 'lldp', title: 'Qui est branché où ?',
      say: 'Avant de configurer quoi que ce soit, on vérifie le câblage. Le protocole **LLDP** fait que chaque équipement annonce son nom à son voisin : le commutateur sait donc ce qui est branché sur chaque port. C\'est la liste de câblage vérifiée, sans ouvrir la baie.',
      do: 'Tape la commande ci-dessous (clique-la pour la mettre dans le terminal, puis Entrée).',
      cli: ['show lldp neighbors'], sw: L, go: term, show: termInput,
      done: said('show lldp'),
      ok: (c) => `Tu vois les CCU sur ${portsShort(devs().map((d) => d.port))}, et les spines rouges sur Et49 à Et52 (deux liens par spine). Le câblage est bon : on peut configurer.`,
      hints: ['Abrégé : « sh lldp nei ».'],
      auto: (c) => c.io.cli(L, ['show lldp neighbors']),
    },
    {
      id: 'hostname', title: 'Le nom du commutateur',
      say: 'Première chose : le **nom**. Il apparaît dans le prompt, dans LLDP chez les voisins, dans les journaux et la supervision. Un commutateur mal nommé, c\'est une intervention sur le mauvais équipement un jour de match.\n\nPour modifier la configuration, on passe en mode configuration avec `configure terminal` (abrégé `conf t`).',
      do: `Donne-lui son nom : ${refHost(L)}.`,
      cli: () => ['configure terminal', `hostname ${refHost(L)}`], sw: L, go: term, show: termInput,
      done: () => cfg().hostname === refHost(L),
      ok: () => `Le prompt est devenu « ${refHost(L)}(config)# » : on est en mode configuration. Note bien : tant qu'on n'a pas enregistré, tout ça n'est que dans la mémoire vive (la « running-config »).`,
      hints: ['D\'abord « conf t », puis « hostname » suivi du nom.'],
    },
    {
      id: 'vlan', title: 'Le VLAN média',
      say: () => `Niveau 2 maintenant. Chaque leaf a son propre **VLAN média** et son propre sous-réseau : ici le VLAN **${P().vlan}** (100 + numéro de leaf sur le rouge, 200 + sur le bleu) et le sous-réseau **${P().subnet}**.\n\nPourquoi un VLAN par leaf et pas un grand VLAN pour tout le car ? Parce qu'on route dès la leaf : chaque domaine de diffusion reste petit, une tempête ou une boucle ne sort pas de la leaf, et c'est le routage IP qui relie les leaves entre elles.`,
      do: () => `Crée le VLAN ${P().vlan} et nomme-le ${P().name}.`,
      cli: () => [`vlan ${P().vlan}`, `name ${P().name}`], sw: L, go: term, show: termInput,
      done: () => !!cfg().vlans[P().vlan],
      ok: '« show vlan » le liste maintenant, mais aucun port n\'y est encore : c\'est l\'étape suivante.',
      hints: ['« vlan 101 » ouvre le VLAN (en le créant s\'il n\'existe pas), puis « name … ».'],
    },
    {
      id: 'access', title: 'Les ports des CCU',
      say: (c) => `En usine, tous les ports sont dans le **VLAN 1**. Les CCU ne peuvent donc parler à personne : leur passerelle sera dans le VLAN ${P().vlan}.\n\nOn met d'un coup tous les ports des CCU en mode **accès** dans le VLAN ${P().vlan}. La syntaxe accepte des plages : \`interface ${R()}\` sélectionne ${devs().length} ports à la fois. Un port d'accès ne transporte qu'un VLAN, sans étiquette : l'appareil n'a rien à configurer de son côté.`,
      do: 'Place les ports des CCU dans le VLAN média.',
      cli: () => [`interface ${R()}`, 'switchport mode access', `switchport access vlan ${P().vlan}`], sw: L, go: term, show: termInput,
      done: () => accessOk(L),
      ok: '« show interfaces status » te montrerait maintenant le VLAN 101 en face de chaque CCU. Les cartes réseau des CCU sont déjà réglées (adresses 10.1.1.20 et suivantes, passerelle 10.1.1.1) : il leur manque juste la passerelle.',
      hints: ['« interface » + la plage de ports, puis « switchport access vlan … ».', 'Si tu sélectionnes les ports un par un, ça marche aussi : c\'est juste plus long.'],
    },
    {
      id: 'svi', title: 'La passerelle des CCU (SVI)',
      say: () => `Les CCU envoient tout ce qui ne sort pas de leur sous-réseau à leur **passerelle**, ${P().gw}. Cette passerelle, c'est la leaf elle-même, par une interface virtuelle sur le VLAN : la **SVI** (interface Vlan${P().vlan}).\n\nC'est ce qui fait de la leaf un routeur « au plus près des appareils ».`,
      do: () => `Donne l'adresse ${P().svi} à l'interface Vlan${P().vlan}.`,
      cli: () => [`interface vlan${P().vlan}`, `ip address ${P().svi}`], sw: L, go: term, show: termInput,
      done: () => { const v = cfg().svis[P().vlan]; return !!v && v.ip === P().svi && !v.shutdown; },
      ok: 'La SVI existe. Mais pour l\'instant le commutateur ne route pas encore : il faut l\'activer globalement.',
      hints: ['« interface vlan101 » puis « ip address 10.1.1.1/24 ».'],
    },
    {
      id: 'routing', title: 'Activer le routage',
      say: 'Un commutateur sorti d\'usine se comporte en simple commutateur de niveau 2. `ip routing` en fait un **routeur** : il va acheminer les paquets d\'un sous-réseau à l\'autre et échanger ses routes avec ses voisins.\n\nRemarque : tu peux taper une commande globale même depuis le mode interface, le commutateur remonte tout seul d\'un niveau.',
      do: 'Active le routage IP.',
      cli: ['ip routing'], sw: L, go: term, show: termInput,
      done: () => cfg().ipRouting,
      ok: 'Le routage est actif. Reste à relier la leaf au reste du réseau : les uplinks.',
    },
    {
      id: 'uplink1', title: 'Le premier uplink',
      say: () => { const u = UP()[0]; return `Les 4 ports Ethernet49 à 52 sont les **uplinks** 100 Gb/s : deux vers spine-r1, deux vers spine-r2. Ce ne sont pas des ports d'accès mais des **liens routés** : chacun est un petit sous-réseau à deux adresses, un **/31** (une adresse côté leaf, une côté spine).\n\nTrois réglages comptent :\n- \`no switchport\` : le port devient un port routé (niveau 3) ;\n- l'adresse /31 : ici ${u.ip}, la spine est en ${u.peer} ;\n- vitesse **100g** et correction d'erreurs **Reed-Solomon** (RS-FEC), obligatoire en 100G sur fibre multimode : sans elle, le lien ne monte pas.\n\nLa MTU est déjà à 9214 (trames « jumbo ») : à l'intérieur du réseau, on laisse de la marge.`; },
      do: () => `Configure Ethernet49 (vers spine-r1) : port routé, adresse ${UP()[0].ip}, 100g, RS-FEC.`,
      cli: () => ['interface ethernet49', 'no switchport', `ip address ${UP()[0].ip}`, 'speed 100g', 'error-correction encoding reed-solomon'], sw: L, go: term, show: termInput,
      done: () => uplinkOk(L, UP()[0]),
      ok: 'Le premier uplink est prêt : le lien vers spine-r1 est monté (voyant d\'Et49 sur la face avant). Il ne lui manque que le protocole de routage.',
      hints: ['« int e49 » puis les quatre lignes.', 'L\'adresse côté leaf est l\'adresse impaire du /31.'],
    },
    {
      id: 'uplinks', title: 'Les trois autres uplinks',
      say: () => `Même recette pour les trois autres, avec l'adresse suivante à chaque fois : ${UP().slice(1).map((u) => `${u.port.replace('Ethernet', 'Et')} → ${u.ip}`).join(', ')}.\n\nSi tu veux, je te les fais : tu as compris le principe, c'est de la saisie (« Fais-le pour moi »).`,
      do: 'Configure Ethernet50, 51 et 52 de la même façon.',
      cli: () => UP().slice(1).flatMap((u) => [`interface ${u.port.toLowerCase()}`, 'no switchport', `ip address ${u.ip}`, 'speed 100g', 'error-correction encoding reed-solomon']), sw: L, go: term, show: termInput,
      done: () => UP().every((u) => uplinkOk(L, u)),
      ok: 'Les 4 uplinks sont montés. La leaf est physiquement reliée aux spines, mais elle ne connaît encore aucune route : elle ne sait pas où sont les autres sous-réseaux.',
    },
    {
      id: 'ospf', title: 'Le routage dynamique : OSPF',
      say: () => `Pour apprendre les routes, la leaf parle **OSPF** avec les spines. Chaque routeur décrit ses liens, tous calculent les meilleurs chemins. Comme il y a 4 chemins de même coût vers chaque autre leaf, le trafic est réparti sur les 4 : c'est l'**ECMP**.\n\nTrois choses :\n- une **loopback** (${P().loopback}) qui sert d'identité stable au routeur (router-id) ;\n- le processus \`router ospf 1\` ;\n- on annonce les interfaces dans l'aire 0 : les 4 uplinks et la SVI (pour que le réseau des CCU soit connu de tous).`,
      do: 'Crée la loopback, le processus OSPF, puis annonce les uplinks et la SVI.',
      cli: () => ['interface loopback0', `ip address ${P().loopback}/32`, 'router ospf 1', `router-id ${P().loopback}`, 'interface ethernet49-52', 'ip ospf area 0.0.0.0', `interface vlan${P().vlan}`, 'ip ospf area 0.0.0.0'], sw: L, go: term, show: termInput,
      done: () => { const c = cfg(); return c.ospf.enabled && c.ospf.routerId === P().loopback && UP().every((u) => c.ports[u.port].ospf) && c.svis[P().vlan] && c.svis[P().vlan].ospf; },
      ok: 'OSPF est configuré. Vérifions que les voisins répondent.',
      hints: ['« interface ethernet49-52 » sélectionne les 4 uplinks d\'un coup.'],
    },
    {
      id: 'ospfcheck', title: 'Vérifier les voisins OSPF',
      say: 'Une configuration, ça se vérifie. Chaque uplink doit avoir son voisin OSPF à l\'état **FULL** (bases de données synchronisées). Un voisin bloqué en EXSTART, c\'est presque toujours une MTU différente aux deux bouts.\n\nRemarque : `show` est une commande du mode normal. En mode configuration, on peut la faire précéder de `do`, ou revenir avec `end`.',
      do: 'Affiche les voisins OSPF.',
      cli: ['end', 'show ip ospf neighbor'], sw: L, go: term, show: termInput,
      done: (c) => said('show ip ospf neighbor')(c) && ospfFull(L) === 4,
      ok: '4 voisins en FULL : deux par spine. La leaf connaît maintenant tout le réseau rouge, et le réseau rouge connaît le sous-réseau des CCU. Mais les flux vidéo, eux, ne passent toujours pas : ce sont des flux **multicast**.',
      hints: ['« sh ip ospf nei ».', 'S\'il en manque, regarde l\'adresse de l\'uplink concerné.'],
    },
    {
      id: 'mcglobal', title: 'Le multicast (1/2) : SSM',
      say: () => `En ST 2110, une caméra n'envoie pas sa vidéo à un destinataire : elle l'émet vers un **groupe multicast** (ici 239.1.1.x sur le rouge). Ceux qui la veulent s'abonnent ; le réseau ne la duplique que là où il y a des abonnés. Une seule émission, autant de récepteurs qu'on veut.\n\nOn utilise le **SSM** (Source-Specific Multicast) : le récepteur demande « tel groupe, venant de telle source ». Pas de point de rendez-vous, chemins prévisibles. Deux réglages globaux :\n- \`ip multicast-routing\` ;\n- la **plage SSM** : par défaut 232.0.0.0/8, mais notre plan d'adressage utilise **${P().ssm}**. Elle doit être identique sur tous les commutateurs, sinon les abonnements sont ignorés.`,
      do: 'Active le routage multicast et règle la plage SSM.',
      cli: () => ['configure terminal', 'ip multicast-routing', `ip pim ssm range ${P().ssm}`], sw: L, go: term, show: termInput,
      done: () => cfg().mcastRouting && cfg().ssmRange === P().ssm,
      ok: 'Le commutateur sait router le multicast. Reste à dire sur quelles interfaces.',
    },
    {
      id: 'mcif', title: 'Le multicast (2/2) : PIM et IGMPv3',
      say: () => `Deux protocoles travaillent ensemble :\n- **IGMPv3**, côté appareils : c'est par lui qu'un récepteur dit « je veux tel groupe de telle source ». On l'active sur la SVI, en version 3 (indispensable pour le SSM). La SVI devient aussi le **querier** : elle redemande régulièrement qui écoute quoi, sans quoi le snooping finit par couper les flux.\n- **PIM** (sparse-mode), entre routeurs : il remonte l'abonnement vers la source, de leaf en spine. On l'active sur les 4 uplinks et sur la SVI.`,
      do: 'Active PIM sur les uplinks et la SVI, et IGMP version 3 sur la SVI.',
      cli: () => ['interface ethernet49-52', 'pim ipv4 sparse-mode', `interface vlan${P().vlan}`, 'pim ipv4 sparse-mode', 'ip igmp version 3'], sw: L, go: term, show: termInput,
      done: () => { const c = cfg(); const v = c.svis[P().vlan]; return UP().every((u) => c.ports[u.port].pim) && v && v.pim && v.igmp === 3; },
      ok: 'C\'est le moment de vérité : les flux des caméras devraient repasser par le rouge.',
      hints: ['« ip igmp version 3 » se tape sur l\'interface Vlan, pas sur les ports physiques.'],
    },
    {
      id: 'flows', title: 'Les flux sont-ils revenus ?',
      say: 'Va voir dans l\'onglet **Flux NMOS · SDP** : chaque ligne est un récepteur (entrée du mélangeur, multiview, EVS…) et ce qu\'il reçoit sur le rouge et sur le bleu.',
      do: 'Ouvre l\'onglet Flux NMOS · SDP et vérifie la colonne « État ».',
      go: { station: 'reseau', tab: 'flows' }, show: [{ sel: '#station .tabs .tab[data-k="flows"]', label: 'Flux NMOS · SDP' }],
      done: (c) => c.view().tab === 'flows' && devFlowsProtected(L),
      ok: 'Tout est « protégé 2022-7 » : chaque flux des caméras arrive de nouveau par les deux réseaux. Le secours est rétabli. Mais on n\'a pas fini : la synchro.',
      hints: ['L\'onglet est le cinquième en haut du poste.', 'Si un flux reste « sans protection », regarde le détail : le chemin rouge indique où ça coince.'],
      auto: (c) => c.io.go({ station: 'reseau', tab: 'flows' }),
    },
    {
      id: 'ptpglobal', title: 'PTP (1/2) : l\'horloge frontière',
      say: () => `En ST 2110, il n'y a plus de signal de référence (black burst, tri-level) dans un câble : toute la synchro passe par **PTP** (IEEE 1588, profil **SMPTE ST 2059-2**). Les grands maîtres GPS donnent l'heure, et chaque commutateur est une **horloge frontière** (« boundary clock ») : il se cale sur son maître, puis redistribue l'heure à ses ports, en corrigeant son propre temps de traversée.\n\nTrois réglages globaux : le mode **boundary**, le **domaine ${P().domain}** (celui du car : un équipement dans un autre domaine ne voit pas nos maîtres) et le **profil smpte2059-2** (il fixe les cadences : 4 Announce et 8 Sync par seconde).`,
      do: 'Configure PTP en horloge frontière, domaine 127, profil ST 2059-2.',
      cli: ['configure terminal', 'ptp mode boundary', 'ptp domain 127', 'ptp profile smpte2059-2'], sw: L, go: term, show: termInput,
      done: () => { const p = cfg().ptp; return p.mode === 'boundary' && p.domain === P().domain && p.profile === 'smpte2059-2'; },
      ok: 'L\'horloge est prête, mais aucun port ne parle encore PTP.',
    },
    {
      id: 'ptpports', title: 'PTP (2/2) : les ports',
      say: () => `On active PTP sur les ports :\n- les **uplinks** en rôle dynamique : c'est par eux que la leaf entend les spines, et l'algorithme BMCA choisit lequel sera son port esclave ;\n- les **ports des CCU**, en **ptp role master** : la leaf est forcément maître vers les appareils. C'est une protection : si un appareil mal réglé s'annonçait comme grand maître, la leaf l'ignorerait au lieu de faire basculer tout le car sur une horloge pirate.`,
      do: 'Active PTP sur les uplinks, et sur les ports des CCU en rôle maître.',
      cli: () => ['interface ethernet49-52', 'ptp enable', `interface ${R()}`, 'ptp enable', 'ptp role master'], sw: L, go: term, show: termInput,
      done: () => { const c = cfg(); return UP().every((u) => c.ports[u.port].ptp) && devs().every(({ port }) => c.ports[port].ptp && c.ports[port].ptpRole === 'master'); },
      ok: 'Vérifions qu\'elle est bien synchronisée.',
    },
    {
      id: 'ptpcheck', title: 'Vérifier la synchro',
      say: '`show ptp` résume l\'état de l\'horloge : le grand maître suivi, le port esclave (celui qui reçoit l\'heure), l\'écart mesuré avec le maître (offset, en nanosecondes) et le nombre de commutateurs traversés depuis le grand maître (steps removed).',
      do: 'Affiche l\'état PTP de la leaf.',
      cli: ['end', 'show ptp'], sw: L, go: term, show: termInput,
      done: (c) => said('show ptp')(c) && ptpSynced(L),
      ok: 'La leaf suit le grand maître 1 par un uplink (son port esclave), avec un écart de quelques dizaines de nanosecondes. Les CCU reçoivent de nouveau l\'heure par les deux réseaux.',
    },
    {
      id: 'qos', title: 'Les priorités (QoS)',
      say: 'Dernier réglage : les **priorités**. Chaque paquet porte une étiquette de priorité (le champ **DSCP**) : 46 pour PTP, 34 pour l\'audio, 26 pour la vidéo. Le commutateur doit la respecter, et PTP doit passer devant tout le monde : un message de synchro retardé dans une file d\'attente, c\'est une erreur de temps directement.\n\n`qos trust dscp` fait confiance au marquage, `qos map dscp 46 to traffic-class 7` met PTP dans la file la plus prioritaire.',
      do: 'Fais respecter le DSCP et place PTP en tête.',
      cli: ['configure terminal', 'qos trust dscp', 'qos map dscp 46 to traffic-class 7'], sw: L, go: term, show: termInput,
      done: () => cfg().qos.trust === 'dscp' && cfg().qos.ptpPriority,
      ok: 'Configuration terminée. Avant de crier victoire : le diagnostic.',
    },
    {
      id: 'diag', title: 'Le diagnostic',
      say: 'L\'onglet **Diagnostic** passe en revue tout le réseau : liens, VLAN, routage, multicast, PTP, configurations. C\'est ce qu\'on regarde avant de dire « c\'est bon » au réalisateur.',
      do: 'Ouvre l\'onglet Diagnostic.',
      go: { station: 'reseau', tab: 'diag' }, show: [{ sel: '#station .tabs .tab[data-k="diag"]', label: 'Diagnostic' }],
      done: (c) => c.view().tab === 'diag' && issuesOf(L).length === 0,
      ok: 'Plus aucune anomalie sur la leaf. Il en reste peut-être une, discrète, en gris : « configuration non enregistrée ».',
      hints: ['S\'il reste une alarme sur la leaf, son bouton t\'emmène au bon port : relis l\'étape concernée.'],
      auto: (c) => c.io.go({ station: 'reseau', tab: 'diag' }),
    },
    {
      id: 'save', title: 'Enregistrer !',
      say: 'Tout ce qu\'on a tapé est dans la **running-config**, en mémoire vive. Si le commutateur redémarre (coupure secteur, mise à jour), il repart sur sa **startup-config**… qui est encore la configuration usine. On perdrait tout, en plein match.\n\n`write memory` (ou `copy running-config startup-config`) recopie la running dans la startup. Réflexe à prendre : on n\'a pas fini tant qu\'on n\'a pas enregistré.',
      do: 'Enregistre la configuration.',
      go: term, show: termInput,
      cli: ['write memory'], sw: L,
      done: () => saved(L),
      ok: '« Copy completed successfully. » La leaf redémarrerait maintenant exactement dans cet état.',
    },
    {
      id: 'quiz', title: 'Une question pour finir',
      say: 'Une dernière question, pour voir si le principe est acquis.',
      quiz: { q: 'Pendant toute l\'opération, l\'image des caméras n\'a jamais été perdue à l\'antenne. Pourquoi ?', choices: ['Les CCU gardent quelques secondes d\'image en mémoire', 'Chaque flux arrive aussi par le réseau bleu : le récepteur garde le paquet qui arrive (ST 2022-7)', 'Le mélangeur repasse automatiquement en SDI'], answer: 1, why: 'Exactement : deux réseaux indépendants, chaque flux émis sur les deux, et le récepteur reconstitue le flux paquet par paquet. On peut donc intervenir sur un réseau en plein direct, à condition que l\'autre soit sain : vérifie toujours l\'état du bleu avant de toucher au rouge (et inversement).' },
    },
  ],
};

// « fais-le pour moi » : par défaut, taper les commandes de l'étape sur le commutateur
for (const s of LESSON_LEAF.steps) if (s.cli && s.sw && !s.auto) s.auto = (c) => c.io.cli(s.sw, typeof s.cli === 'function' ? s.cli(c) : s.cli);
