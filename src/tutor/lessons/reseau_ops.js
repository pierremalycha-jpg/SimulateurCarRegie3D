// @ts-check
import { FAB, CTL_GW, NMOS_REG, PTP_REF, sviIp, subnetOf, factoryDevice, setDeviceNet, setRxManual, rxTransport } from '../../net/fabric.js';
import { route } from '../../pipeline.js';

// ----------------------------------------------------------------------------------
// Parcours du chef de car dans l'onglet Exploitation du poste Réseau IP : remettre en service une
// passerelle IP → SDI sortie d'usine depuis son interface web (adresses, contrôle et NMOS, PTP),
// l'abonner à la main au clean feed, vérifier au moniteur et montrer la protection ST 2022-7.
// ----------------------------------------------------------------------------------
const DEV = 'gwstade', RX = 'AUX_GIANT', SRC = 'v:CLEAN';
const ops = (more = {}) => ({ station: 'reseau', tab: 'ops', ...more });
const atDev = (c) => { const v = c.view(); return v.station === 'reseau' && v.mode === 'ops' && v.opsView === 'dev' && v.opsDev === DEV; };
const dev = () => FAB.devices[DEV];
const R = () => FAB.res;
const nic = (color) => (R() ? R().nic[`${DEV}:${color}`] || {} : {});
const rxs = () => (R() ? R().rxState[RX] : null);
// adresses du plan d'adressage, relevées avant la sortie d'usine
const plan = (c) => c.mem.orig || { nics: { red: { ip: '10.1.6.25', mask: 24, gw: sviIp('red', 6) }, blue: { ip: '10.2.6.25', mask: 24, gw: sviIp('blue', 6) } }, ctlIp: '10.20.0.60', ctlMask: 22, ctlGw: CTL_GW, nmosReg: NMOS_REG, ptp: { domain: PTP_REF.domain, slaveOnly: true } };
// paramètres du clean feed, tels qu'on les lit sur la fiche de la source
const srcLeg = (color) => { const f = FAB.flows[SRC]; const d = FAB.devices[f.dev]; return { on: true, src: d.nics[color].ip, group: f.groups[color], port: f.udp }; };
const legTxt = (color) => { const L = srcLeg(color); return `source ${L.src}, groupe ${L.group}, port ${L.port}`; };
const F = (k, label) => [{ sel: `#station [data-f="${k}"]`, label }];
const APPLY = { sel: '#station [data-act="apply-dev"]', label: 'Appliquer' };
const toDev = (c) => (atDev(c) ? null : c.view().mode !== 'ops' ? [{ sel: '#station .net-mode[data-mode="ops"]', label: 'onglet Exploitation' }] : c.view().opsView !== 'dev' ? [{ sel: '#station .ops-navbtn[data-ops="dev"]', label: 'Appareils' }] : [{ sel: '#station [data-dev="gwstade"]', label: 'la passerelle' }]);

/** @type {import('../engine.js').Lesson} */
export const LESSON_GW = {
  id: 'reseau-passerelle', domain: 'Réseau ST 2110', stations: ['reseau'], needs: { ip: true },
  title: 'Mettre en service une passerelle (interface web)',
  summary: 'La passerelle des écrans d\'angle sort d\'usine. Depuis son interface : adresses rouge et bleue, contrôle et registre NMOS, PTP, puis abonnement au clean feed, contrôlé au moniteur.',
  duration: '12 min', level: 'débutant',
  cleanupLabel: 'remettre la passerelle dans sa configuration du car',
  cleanup: (c) => { setDeviceNet(DEV, plan(c)); setRxManual(RX, null); },
  outro: 'Une passerelle se met toujours en service dans cet ordre : les adresses (sinon rien ne passe), le contrôle et NMOS (sinon le contrôleur ne la voit pas), PTP (sinon les images ne sont pas en phase), puis les abonnements. Et on vérifie à l\'image, sur les deux réseaux.',
  steps: [
    {
      id: 'intro', title: 'Une passerelle neuve',
      enter: (c) => {
        const d = dev(); const n = (k) => ({ ip: d.nics[k].ip, mask: d.nics[k].mask, gw: d.nics[k].gw });
        c.mem.orig = { nics: { red: n('red'), blue: n('blue') }, ctlIp: d.ctlIp, ctlMask: d.ctlMask, ctlGw: d.ctlGw, nmosReg: d.nmosReg, ptp: { domain: d.ptp.domain, slaveOnly: d.ptp.slaveOnly } };
        factoryDevice(DEV);
      },
      say: 'La **passerelle des écrans d\'angle** (elle reçoit un flux ST 2110 et le rend en SDI vers les écrans du stade) vient d\'être remplacée. L\'appareil neuf est dans sa **configuration d\'usine** : adresses en 192.168.x.100, aucun registre NMOS, PTP dans le domaine 0.\n\nOn va la configurer depuis **son interface web**, comme sur une vraie passerelle, puis lui faire recevoir le clean feed, et vérifier à l\'image.',
    },
    {
      id: 'open', title: 'L\'interface de l\'appareil',
      say: 'Au poste Réseau IP, l\'onglet **Exploitation** rassemble ce qu\'on voit dans les interfaces des appareils et du contrôleur. La vue **Appareils** liste tout ce qui est raccordé, avec quatre voyants : média A (rouge), média B (bleu), PTP et NMOS.',
      do: 'Ouvre le poste Réseau IP, onglet Exploitation, vue Appareils, puis la « Passerelle écrans d\'angle ».',
      go: ops({ view: 'dev', dev: DEV }), show: toDev, done: atDev,
      ok: 'Quatre voyants rouges : l\'appareil est branché (le lien est monté), mais il ne parle à personne. Ses adresses ne sont pas celles du car.',
      auto: (c) => c.io.go(ops({ view: 'dev', dev: DEV })),
    },
    {
      id: 'mediaA', title: 'Carte média A (rouge)',
      say: (c) => `La carte A est raccordée à leaf-r6-gw, dont le sous-réseau est **${subnetOf('red', 6)}** (VLAN 106). Une adresse hors de ce sous-réseau, et la leaf rejette tout : ses flux échouent au contrôle RPF, ses abonnements sont ignorés.\n\nLe plan du car donne **${plan(c).nics.red.ip}**, masque /24, passerelle ${sviIp('red', 6)} (la leaf elle-même).`,
      do: (c) => `Saisis ${plan(c).nics.red.ip}, masque 24, passerelle ${sviIp('red', 6)} sur la ligne « A · rouge », puis Appliquer.`,
      go: ops({ view: 'dev', dev: DEV }), show: (c) => toDev(c) || [...F('red:ip', 'adresse A'), APPLY],
      done: () => !!nic('red').reach,
      ok: 'Voyant média A vert. Le masque et la passerelle ne servent qu\'à l\'unicast (supervision, ping) : le multicast et PTP restent sur le lien local. Mais une erreur ici se paie le jour où l\'on doit joindre l\'appareil à distance.',
      auto: (c) => setDeviceNet(DEV, { nics: { red: plan(c).nics.red } }),
    },
    {
      id: 'mediaB', title: 'Carte média B (bleu)',
      say: (c) => `Même chose sur le réseau bleu : sous-réseau ${subnetOf('blue', 6)}, et **la même fin d'adresse** que sur le rouge (${plan(c).nics.blue.ip}). C'est une convention, pas une obligation, mais elle évite bien des erreurs au dépannage.`,
      do: (c) => `Saisis ${plan(c).nics.blue.ip}, masque 24, passerelle ${sviIp('blue', 6)} sur la ligne « B · bleu », puis Appliquer.`,
      go: ops({ view: 'dev', dev: DEV }), show: (c) => toDev(c) || [...F('blue:ip', 'adresse B'), APPLY],
      done: () => !!nic('blue').reach,
      ok: 'Les deux cartes média sont joignables : la passerelle peut recevoir par les deux réseaux, indépendants l\'un de l\'autre.',
      auto: (c) => setDeviceNet(DEV, { nics: { blue: plan(c).nics.blue } }),
    },
    {
      id: 'nmos', title: 'Contrôle et registre NMOS',
      say: (c) => `Troisième carte : le **contrôle**, sur un réseau à part (10.20.0.0/22, VLAN 20). C'est par lui que l'appareil s'enregistre auprès du **registre NMOS** (IS-04) et reçoit ses ordres de connexion (IS-05).\n\nIci, pas de découverte automatique (DNS-SD) : on indique l'adresse du registre, **${NMOS_REG}**. Adresse de contrôle prévue : **${plan(c).ctlIp}**, masque /22, passerelle ${CTL_GW}.`,
      do: (c) => `Dans « Contrôle et NMOS » : ${plan(c).ctlIp}, masque 22, passerelle ${CTL_GW}, registre ${NMOS_REG}, puis Appliquer.`,
      go: ops({ view: 'dev', dev: DEV }), show: (c) => toDev(c) || [...F('ctl:ip', 'adresse de contrôle'), ...F('nmos:reg', 'registre NMOS'), APPLY],
      done: () => !!(R() && R().reg[DEV]),
      ok: 'Voyant NMOS vert : la passerelle s\'est déclarée au registre (son nœud, son récepteur) et envoie un battement toutes les 5 secondes. Le contrôleur la voit maintenant.',
      auto: (c) => { const p = plan(c); setDeviceNet(DEV, { ctlIp: p.ctlIp, ctlMask: p.ctlMask, ctlGw: p.ctlGw, nmosReg: p.nmosReg }); },
    },
    {
      id: 'ptp', title: 'PTP : le bon domaine',
      say: `Dernier voyant rouge : PTP. L'appareil est en **domaine 0**, le domaine par défaut de la norme IEEE 1588. Le profil broadcast **SMPTE ST 2059-2** utilise le domaine **${PTP_REF.domain}** : sur un autre domaine, l'appareil n'entend tout simplement pas le grand maître.\n\nLaisse « esclave uniquement » coché : une passerelle ne doit jamais pouvoir devenir la référence du car.`,
      do: `Mets le domaine PTP à ${PTP_REF.domain}, puis Appliquer.`,
      go: ops({ view: 'dev', dev: DEV }), show: (c) => toDev(c) || [...F('ptp:domain', `domaine ${PTP_REF.domain}`), APPLY],
      done: () => !!(R() && R().devPtp[DEV] && R().devPtp[DEV].state === 'locked'),
      ok: () => { const p = R().devPtp[DEV]; return `SLAVE · verrouillé, à ${p.offset} ns du grand maître (${p.hops} sauts : la leaf puis la spine, horloges frontières). Les quatre voyants sont verts.`; },
      auto: () => setDeviceNet(DEV, { ptp: { domain: PTP_REF.domain, slaveOnly: true } }),
    },
    {
      id: 'route', title: 'Choisir la source et la destination',
      say: 'Reste à lui faire recevoir une image. La vue **Connexions** met côte à côte les sources (émetteurs) et les destinations (récepteurs). Les deux moniteurs du bandeau montrent la source choisie et **ce que reçoit vraiment** la destination.',
      do: 'Vue Connexions : choisis la destination « Écrans d\'angle (fibre stade) », puis la source « CLEAN ».',
      go: ops({ view: 'route', rx: RX, src: SRC }),
      show: (c) => { const v = c.view(); return v.mode !== 'ops' ? [{ sel: '#station .net-mode[data-mode="ops"]', label: 'onglet Exploitation' }] : v.opsView !== 'route' ? [{ sel: '#station .ops-navbtn[data-ops="route"]', label: 'Connexions' }] : v.opsRx !== RX ? [{ sel: `#station [data-dst="${RX}"]`, label: 'la destination' }] : [{ sel: `#station [data-src="${SRC}"]`, label: 'la source' }]; },
      done: (c) => { const v = c.view(); return v.mode === 'ops' && v.opsView === 'route' && v.opsRx === RX && v.opsSrc === SRC; },
      ok: 'Le moniteur de gauche montre le clean feed ; celui de droite reste noir : la passerelle sortie d\'usine n\'est abonnée à rien.',
      auto: (c) => c.io.go(ops({ view: 'route', rx: RX, src: SRC })),
    },
    {
      id: 'manual', title: 'Abonnement à la main',
      say: () => `Faisons-le d'abord à la main, comme dans l'interface web du récepteur. En SSM (IGMPv3), on ne s'abonne pas à un groupe seul mais au couple **(source, groupe)**, sur chaque réseau. La fiche de la source CLEAN donne :\n- A (rouge) : ${legTxt('red')} ;\n- B (bleu) : ${legTxt('blue')}.`,
      do: 'Choisis « Saisie manuelle », recopie ces adresses sur les lignes A et B, puis Appliquer.',
      go: ops({ view: 'route', rx: RX, src: SRC }),
      show: (c) => (c.view().opsMode !== 'manual' ? [{ sel: '#station .ops-seg [data-mode="manual"]', label: 'Saisie manuelle' }] : [{ sel: '#station [data-leg="red:src"]', label: 'adresses A puis B' }, { sel: '#station [data-act="apply-rx"]', label: 'Appliquer' }]),
      done: () => { const s = rxs(); return !!(s && s.manual && s.ok && s.protected && s.flow === SRC); },
      ok: 'Le moniteur Destination affiche le clean feed, et l\'état indique « reçu A + B » : la passerelle reçoit le même flux par les deux réseaux et les fusionne paquet par paquet (ST 2022-7).',
      hints: ['Une faute de frappe dans la source ? Le filtre SSM ne laisse alors rien passer sur ce réseau : l\'état l\'explique.', 'Le port UDP est 5004 sur les deux réseaux.'],
      auto: (c) => { setRxManual(RX, { red: srcLeg('red'), blue: srcLeg('blue') }); c.io.go(ops({ view: 'route', rx: RX, src: SRC })); },
    },
    {
      id: 'cut', title: 'Et si le bleu tombe ?',
      say: 'Vérifions la redondance. Désactiver la jambe bleue revient à perdre tout le réseau bleu pour cette passerelle.',
      do: 'Décoche la ligne « B · bleu », puis Appliquer. Regarde le moniteur Destination.',
      go: ops({ view: 'route', rx: RX, src: SRC }), show: [{ sel: '#station [data-leg="blue:on"]', label: 'jambe bleue' }, { sel: '#station [data-act="apply-rx"]', label: 'Appliquer' }],
      done: () => { const s = rxs(); const m = FAB.rxManual[RX]; return !!(s && m && m.blue && !m.blue.on && s.ok && !s.protected); },
      ok: 'L\'image n\'a pas bougé : le rouge suffit, sans la moindre coupure. Mais l\'état passe en « reçu A seul » : la prochaine panne, elle, se verra. C\'est tout l\'intérêt de surveiller la protection 2022-7, même quand l\'image est belle.',
      auto: (c) => { const t = rxTransport(RX); setRxManual(RX, { red: t.red || srcLeg('red'), blue: { ...(t.blue || srcLeg('blue')), on: false } }); c.io.go(ops({ view: 'route', rx: RX, src: SRC })); },
    },
    {
      id: 'nmosc', title: 'Rendre la main au contrôleur',
      say: 'Dans l\'exploitation, personne ne tape ces adresses : le **contrôleur NMOS** lit le SDP de l\'émetteur dans le registre et l\'envoie au récepteur (IS-05). C\'est ce que fait la grille du car. Moins d\'erreurs, et les deux jambes sont toujours renseignées.',
      do: 'Choisis « NMOS (IS-05) » puis « Connecter ».',
      go: ops({ view: 'route', rx: RX, src: SRC }),
      show: (c) => (c.view().opsMode !== 'nmos' ? [{ sel: '#station .ops-seg [data-mode="nmos"]', label: 'NMOS (IS-05)' }] : [{ sel: '#station [data-act="connect"]', label: 'Connecter' }]),
      done: () => { const s = rxs(); return !FAB.rxManual[RX] && !!(s && s.ok && s.protected && s.flow === SRC); },
      ok: 'Connexion IS-05 faite : la passerelle a reçu le SDP, elle s\'abonne aux deux groupes, et la protection 2022-7 est de retour. Elle est en service.',
      auto: (c) => { route(RX, 'CLEAN'); c.io.go(ops({ view: 'route', rx: RX, src: SRC })); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une dernière question pour vérifier.',
      quiz: {
        q: 'Sur une jambe, tu saisis le bon groupe multicast mais l\'adresse source d\'une autre caméra. Que se passe-t-il ?',
        choices: ['Le récepteur affiche l\'autre caméra', 'Rien n\'arrive sur cette jambe : l\'abonnement IGMPv3 porte sur le couple (source, groupe)', 'Les deux flux se mélangent à l\'image', 'La leaf corrige l\'adresse toute seule'],
        answer: 1,
        why: 'En SSM, le récepteur demande « tel groupe, envoyé par telle source ». Si ce couple n\'existe pas, rien n\'est acheminé, même si le groupe existe avec une autre source. C\'est ce qui rend le SSM sûr : deux émetteurs peuvent même utiliser le même groupe sans se mélanger.',
      },
    },
  ],
};
