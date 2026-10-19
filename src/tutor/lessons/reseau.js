// @ts-check
import { S } from '../../state.js';
import { FAB, markDirty, camPtpOk, videoGbps, writeMemory } from '../../net/fabric.js';
import { injectFault } from '../../faults.js';
import { CFG, leafPlan, saved, rxSummary } from '../net_helpers.js';
import { LESSON_LEAF } from './reseau_leaf.js';
import { LESSON_GW } from './reseau_ops.js';

// ----------------------------------------------------------------------------------
// Parcours du chef de car pour le réseau ST 2110 : visite commentée, PTP, dépannage
// méthodique (la mise en service d'une leaf est dans reseau_leaf.js).
// ----------------------------------------------------------------------------------
const net = (tab, more = {}) => ({ station: 'reseau', tab, ...more });
const tabSel = (k, label) => [{ sel: `#station .tabs .tab[data-k="${k}"]`, label }];
const onTab = (k) => (c) => c.view().station === 'reseau' && c.view().tab === k;
const goTab = (k) => (c) => c.io.go(net(k));
const ROW = (rx) => [{ sel: `#station tr[data-rx="${rx}"]`, label: 'cette ligne' }];

// ---------------- visite commentée ----------------
/** @type {import('../engine.js').Lesson} */
const LESSON_TOUR = {
  id: 'reseau-visite', domain: 'Réseau ST 2110', stations: ['reseau'], needs: { ip: true },
  title: 'Le réseau du car en 15 minutes',
  summary: 'Visite commentée : pourquoi l\'IP, les deux réseaux rouge et bleu, spines et leaves, le plan d\'adressage, un flux de bout en bout, son SDP, PTP et les mesures.',
  duration: '15 min', level: 'débutant',
  outro: 'Voilà le tour du propriétaire. Retiens trois idées : chaque signal est un flux multicast, chaque flux existe deux fois (rouge et bleu), et tout le monde est à l\'heure grâce à PTP. Si tu veux mettre les mains dedans, fais « Mettre en service une leaf neuve ».',
  steps: [
    {
      id: 'intro', title: 'Pourquoi un car IP ?',
      say: 'Bienvenue dans le car IP. Dans un car SDI, chaque signal a son câble coaxial et passe par une grille de commutation : une caméra, un câble ; un écran, un câble.\n\nIci, tous les signaux voyagent sur un **réseau Ethernet**, selon la norme **SMPTE ST 2110**. Chaque « essence » est un flux séparé : la vidéo sans compression (ST 2110-20), l\'audio (ST 2110-30, compatible AES67), les données annexes (ST 2110-40 : timecode, sous-titres). On peut donc envoyer l\'audio d\'une source ailleurs que sa vidéo, sans désembedder.\n\nCe qui remplace la grille : un réseau de commutateurs, un protocole de synchro (PTP) et un système de contrôle (NMOS). Je te fais visiter.',
    },
    {
      id: 'open', title: 'Le poste Réseau IP',
      say: 'Tout se supervise depuis le poste **Réseau IP**, dans la zone technique.',
      do: 'Va au poste Réseau IP.',
      go: { station: 'reseau' }, done: (c) => c.view().station === 'reseau', skip: (c) => c.view().station === 'reseau',
      ok: 'En haut, le bandeau donne l\'état des deux réseaux d\'un coup d\'œil ; dans le moniteur, le multiview reçu par le réseau.',
      auto: (c) => c.io.go({ station: 'reseau' }),
    },
    {
      id: 'topo', title: 'La topologie',
      say: 'L\'onglet **Topologie** dessine les deux réseaux : le **rouge** en haut, le **bleu** en bas. Ils sont identiques et totalement indépendants : pas un câble entre les deux.',
      do: 'Ouvre l\'onglet Topologie.',
      go: net('topo'), show: tabSel('topo', 'Topologie'), done: onTab('topo'),
      ok: 'Tu vois trois étages : les spines (le cœur), les leaves (une par zone du car), et entre les deux réseaux, les appareils.',
      auto: goTab('topo'),
    },
    {
      id: 'spine', title: 'Les spines',
      say: 'Les **spines** forment le cœur du réseau. Elles ne reçoivent aucun appareil : leur seul travail est de relier les leaves entre elles, avec des liens 100 Gb/s. Deux spines par réseau : si l\'une s\'arrête, l\'autre porte tout le trafic.',
      do: 'Clique sur une spine (une grande boîte en haut ou en bas du schéma).',
      go: net('topo'), show: [{ sel: '#station [data-tut="sw:spine"]', label: 'une spine' }],
      done: (c) => c.seen('sel', (e) => e.role === 'spine'),
      ok: 'Le détail s\'affiche sous le schéma : ses liens vers chaque leaf, sa charge. Elle porte aussi les deux grands maîtres PTP (sur son port 31).',
      auto: (c) => { c.io.go(net('topo', { sel: { kind: 'sw', id: 'SPINE-R1' } })); c.io.log('sel', { kind: 'sw', id: 'SPINE-R1', role: 'spine' }); },
    },
    {
      id: 'leaf', title: 'Les leaves',
      say: 'Les **leaves** sont au plus près des appareils, une par zone du car : caméras, production, ralentis, monitoring, audio, passerelles et transmission. Chaque leaf a 4 liens montants (2 par spine) : deux appareils sur des leaves différentes se parlent toujours en leaf → spine → leaf, trois commutateurs, quel que soit le chemin. C\'est l\'architecture **spine-leaf** : prévisible et facile à agrandir.',
      do: 'Clique sur une leaf.',
      go: net('topo'), show: [{ sel: '#station [data-tut="sw:leaf"]', label: 'une leaf' }],
      done: (c) => c.seen('sel', (e) => e.role === 'leaf'),
      ok: 'Chaque leaf a son VLAN et son sous-réseau : le routage commence dès la leaf.',
      auto: (c) => { c.io.go(net('topo', { sel: { kind: 'sw', id: 'LEAF-R1' } })); c.io.log('sel', { kind: 'sw', id: 'LEAF-R1', role: 'leaf' }); },
    },
    {
      id: 'link', title: 'La bande passante',
      say: () => `Une vidéo ST 2110-20 n'est pas compressée : en ${S.format === 'UHD' ? 'UHD' : 'HD 1080p50'} 10 bits 4:2:2, c'est environ **${String(videoGbps()).replace('.', ',')} Gb/s** par flux. Un lien 100 Gb/s en porte donc une petite quarantaine en HD, une dizaine en UHD. Tout le dimensionnement d'un car IP tient dans ce calcul.`,
      do: 'Clique sur un lien entre une leaf et une spine pour voir sa charge.',
      go: net('topo'), show: [{ sel: '#station [data-tut="link"]', label: 'un lien' }],
      done: (c) => c.seen('sel', (e) => e.kind === 'link'),
      ok: 'Tu vois la charge montante et descendante du lien. Plus loin, l\'outil « Charge des liens » (onglet Mesures) classe les liens les plus chargés.',
      auto: (c) => { const l = FAB.links[0]; c.io.go(net('topo', { sel: { kind: 'link', id: l.id } })); c.io.log('sel', { kind: 'link', id: l.id }); },
    },
    {
      id: 'dev', title: 'Un appareil, deux cartes',
      say: 'Chaque appareil a **deux cartes réseau** : une sur le rouge, une sur le bleu, avec deux adresses (10.1.… et 10.2.…). Il émet chacun de ses flux sur les deux réseaux à la fois, et chaque récepteur s\'abonne aux deux. C\'est la norme **ST 2022-7** : le récepteur garde, paquet par paquet, celui qui arrive. Un câble arraché, une spine en panne : rien à l\'image.',
      do: 'Clique sur un appareil (une CCU par exemple).',
      go: net('topo'), show: [{ sel: '#station [data-tut="dev"]', label: 'un appareil' }],
      done: (c) => c.seen('sel', (e) => e.kind === 'dev'),
      ok: 'Le détail montre ses deux cartes, leur port sur chaque leaf, leur adresse.',
      auto: (c) => { c.io.go(net('topo', { sel: { kind: 'dev', id: 'ccu1' } })); c.io.log('sel', { kind: 'dev', id: 'ccu1' }); },
    },
    {
      id: 'addr', title: 'Le plan d\'adressage',
      say: () => { const p = leafPlan('LEAF-R1'); return `Onglet **Plan d'adressage**. Un bon plan, c'est quand on lit une adresse et qu'on sait où est l'appareil :\n- **10.1.x.y** sur le rouge, **10.2.x.y** sur le bleu ; **x** = numéro de la leaf (1 caméras, 2 production…) ; la passerelle est toujours en **.1** ;\n- les VLAN suivent : **100 + x** sur le rouge (${p.vlan} pour les caméras), **200 + x** sur le bleu ;\n- les groupes multicast aussi : **239.1.x.n** et **239.2.x.n**, dans la plage SSM 239.0.0.0/8.`; },
      do: 'Ouvre l\'onglet Plan d\'adressage.',
      go: net('addr'), show: tabSel('addr', 'Plan d\'adressage'), done: onTab('addr'),
      ok: 'Garde ce tableau sous la main : en dépannage, c\'est lui qui dit ce qui devrait être.',
      auto: goTab('addr'),
    },
    {
      id: 'flow', title: 'Un flux de bout en bout',
      say: 'Onglet **Flux NMOS · SDP**. Chaque ligne est un **récepteur** : entrée du mélangeur, multiview, enregistrement EVS, retour viseur… Quand le réalisateur commute à la grille, c\'est un contrôleur qui dit au récepteur quel flux écouter (NMOS **IS-05**) ; le récepteur s\'abonne alors aux deux groupes, rouge et bleu.',
      do: 'Ouvre l\'onglet et clique sur la ligne « ME1 » (entrée 1 du mélangeur).',
      go: net('flows', { rx: 'ME1' }), show: (c) => (c.view().tab === 'flows' ? ROW('ME1') : tabSel('flows', 'Flux NMOS · SDP')),
      done: (c) => c.view().tab === 'flows' && (c.seen('rx', (e) => e.rx === 'ME1') || c.view().rx === 'ME1'),
      ok: 'Le détail montre le chemin sur chaque réseau : CCU → leaf caméras → spine → leaf production → mélangeur. Deux chemins indépendants, un seul flux à l\'arrivée.',
      auto: (c) => { c.io.go(net('flows', { rx: 'ME1' })); c.io.log('rx', { rx: 'ME1' }); },
    },
    {
      id: 'sdp', title: 'Lire un SDP',
      say: 'Comment le récepteur sait-il quoi recevoir ? Par le **SDP** de l\'émetteur : une fiche texte qui décrit le flux. Les lignes à connaître :\n- `a=group:DUP` : le flux existe en double (2022-7) ;\n- `c=IN IP4 239.1.1.1` : le groupe multicast, et `a=source-filter` : l\'adresse de la source (c\'est le SSM) ;\n- `a=rtpmap:96 raw/90000` : vidéo non compressée, horloge RTP à 90 kHz ;\n- `a=fmtp` : le format (1920×1080, 50 images/s, 10 bits, 4:2:2, BT.709) et `TP=2110TPN` (émetteur à débit très régulier) ;\n- `a=ts-refclk:ptp=…:127` : l\'horloge PTP de référence, domaine 127.',
      do: 'Clique sur « Voir le SDP de l\'émetteur ».',
      go: net('flows', { rx: 'ME1' }), show: [{ sel: '#station [data-tut="sdp"]', label: 'le SDP' }],
      done: (c) => c.seen('sdp'),
      ok: 'Si un seul de ces champs ne correspond pas à ce que le récepteur sait faire (format, cadence, profondeur), il refuse le flux : c\'est la première chose à lire quand une connexion échoue.',
      auto: (c) => { const fid = FAB.res && FAB.res.rxState.ME1 ? FAB.res.rxState.ME1.flow : 'v:CAM1'; c.io.log('sdp', { fid }); },
    },
    {
      id: 'ptp', title: 'Qui donne l\'heure ?',
      say: 'Onglet **PTP**. Deux grands maîtres GPS donnent l\'heure ; chaque commutateur la relaie (horloge frontière) jusqu\'aux appareils. Chaque paquet porte l\'heure PTP de sa capture : c\'est ce qui permet de mélanger des sources, de garder le son calé sur l\'image et de commuter sans saut.',
      do: 'Ouvre l\'onglet PTP et regarde quel grand maître est élu sur chaque réseau.',
      go: net('ptp'), show: tabSel('ptp', 'PTP'), done: onTab('ptp'),
      ok: 'Le grand maître 1 est élu partout : il a la meilleure priorité (priority1 = 100 contre 110). Le parcours « PTP : qui donne l\'heure ? » détaille l\'élection et le secours.',
      auto: goTab('ptp'),
    },
    {
      id: 'meas', title: 'Mesurer un flux',
      say: 'Dernier outil : l\'**analyseur de flux** (onglet Mesures). Il mesure ce qu\'aucun écran ne montre : le débit, la régularité des paquets (modèle ST 2110-21 : CINST et VRX doivent rester sous les limites), la latence de chaque chemin et l\'écart entre rouge et bleu (le récepteur 2022-7 doit pouvoir l\'absorber).',
      do: 'Ouvre l\'onglet Mesures, outil « Analyseur de flux ».',
      go: net('meas', { msub: 'stream' }), show: tabSel('meas', 'Mesures'),
      done: (c) => onTab('meas')(c) && (c.seen('tool', (e) => e.tool === 'stream') || c.seen('analyzer')),
      ok: 'Les courbes défilent pour le flux choisi. Un flux peut passer à l\'image et être hors norme : c\'est l\'analyseur qui le voit avant la panne.',
      auto: (c) => { c.io.go(net('meas', { msub: 'stream' })); c.io.log('tool', { tool: 'stream' }); },
    },
    {
      id: 'diag', title: 'Le diagnostic',
      say: 'Enfin l\'onglet **Diagnostic** : toutes les anomalies du réseau, triées, avec un bouton qui t\'emmène au bon commutateur et au bon port. En bas, la **méthode de dépannage** couche par couche. C\'est la page qu\'on ouvre en premier quand quelque chose ne va pas.',
      do: 'Ouvre l\'onglet Diagnostic.',
      go: net('diag'), show: tabSel('diag', 'Diagnostic'), done: onTab('diag'),
      ok: 'Si tout est vert, « Aucune anomalie ». Le parcours « Dépannage : une caméra a disparu » te fera pratiquer.',
      auto: goTab('diag'),
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Une question pour vérifier.',
      quiz: { q: 'Une spine du réseau rouge tombe en panne pendant le direct. Que voit-on à l\'antenne ?', choices: ['Toutes les caméras disparaissent', 'Rien : l\'autre spine rouge prend le relais, et de toute façon chaque flux arrive aussi par le bleu', 'Les caméras sautent une image'], answer: 1, why: 'Double sécurité : dans chaque réseau, deux spines se partagent le trafic (ECMP), et les deux réseaux portent chacun tous les flux (2022-7). Une panne de spine ne se voit qu\'au poste Réseau IP et dans les alarmes.' },
    },
  ],
};

// ---------------- PTP ----------------
const gmName = (c) => (FAB.res && FAB.res.gmActive[c] ? FAB.res.gmActive[c].name : 'aucun');
const camsLocked = () => S.cams.every((cam) => camPtpOk(cam.id));
/** @type {import('../engine.js').Lesson} */
const LESSON_PTP = {
  id: 'reseau-ptp', domain: 'Réseau ST 2110', stations: ['reseau', 'synchro'], needs: { ip: true },
  title: 'PTP : qui donne l\'heure ?',
  summary: 'Grands maîtres, élection (BMCA), horloges frontières : on coupe un grand maître en plein direct pour voir le secours, puis on comprend le danger d\'une horloge pirate.',
  duration: '10 min', level: 'intermédiaire',
  outro: 'PTP en trois phrases : les grands maîtres sont élus par le BMCA (priority1 d\'abord, puis la qualité d\'horloge), chaque commutateur relaie l\'heure en horloge frontière, et un appareil ne doit jamais pouvoir devenir maître (« slave only » et ports « ptp role master »).',
  steps: [
    {
      id: 'intro', title: 'Plus de câble de référence',
      say: 'En SDI, on distribue une **référence** (black burst ou tri-level) à chaque appareil par un câble. En IP, plus de câble : tout le monde se cale sur une heure commune, transportée par le réseau avec le protocole **PTP** (IEEE 1588), profil **SMPTE ST 2059-2**.\n\nChaque appareil connaît l\'heure à quelques dizaines de nanosecondes près ; la norme ST 2059-1 dit comment en déduire le début de chaque image. Résultat : toutes les caméras sont « en phase » sans aucun câble de synchro.',
    },
    {
      id: 'open', title: 'L\'onglet PTP',
      say: 'Allons voir qui donne l\'heure.',
      do: 'Ouvre le poste Réseau IP, onglet PTP.',
      go: net('ptp'), show: tabSel('ptp', 'PTP'), done: onTab('ptp'),
      ok: 'En haut, les deux grands maîtres ; puis le grand maître élu sur chaque réseau, les commutateurs et les appareils.',
      auto: goTab('ptp'),
    },
    {
      id: 'bmca', title: 'L\'élection (BMCA)',
      say: () => `Les deux grands maîtres sont des horloges GPS. Chacun annonce sa « qualité » plusieurs fois par seconde (messages Announce). Tous les commutateurs appliquent le même algorithme, le **BMCA**, qui compare dans l'ordre :\n1. **priority1** (réglée à la main : le plus petit gagne) ;\n2. la **classe d'horloge** (6 = verrouillée GPS, 7 = GPS perdu, en maintien) ;\n3. la précision et la stabilité annoncées ;\n4. **priority2**, puis l'identité.\n\nIci, le grand maître 1 a priority1 = 100, le 2 a 110 : c'est le 1 qui est élu (rouge : ${gmName('red')} ; bleu : ${gmName('blue')}).`,
    },
    {
      id: 'parent', title: 'Le voir en ligne de commande',
      say: 'Sur n\'importe quel commutateur, `show ptp parent` donne le maître dont il dépend et le grand maître au bout de la chaîne, avec sa classe et ses priorités.',
      do: 'Sur leaf-r1-cam, tape « show ptp parent ».',
      cli: ['show ptp parent'], sw: 'LEAF-R1', go: net('switch', { sw: 'LEAF-R1', sub: 'term' }), show: [{ sel: '#station .net-cmd', label: 'tape ici' }],
      done: (c) => c.seen('cli', (e) => e.ok && e.pat && e.pat.startsWith('show ptp parent')),
      ok: 'Class 6 (verrouillé GPS), Priority1 100 : c\'est bien le grand maître 1.',
      auto: (c) => { c.io.go(net('switch', { sw: 'LEAF-R1', sub: 'term' })); c.io.cli('LEAF-R1', ['show ptp parent']); },
    },
    {
      id: 'cut', title: 'Couper le grand maître 1',
      say: 'Maintenant on simule une panne : le grand maître 1 s\'arrête, en plein match. Regarde bien les caméras.',
      do: 'Onglet PTP : décoche « En service » sur le grand maître 1.',
      go: net('ptp'), show: [{ sel: '#station [data-tut="gm1-up"]', label: 'grand maître 1' }],
      done: () => !FAB.gm.gm1.up && FAB.res && FAB.res.gmActive.red && FAB.res.gmActive.red.id === 'gm2',
      ok: () => `Après trois messages Announce manqués (moins d'une seconde en ST 2059-2), les commutateurs ont élu le **grand maître 2**. Les caméras sont-elles décrochées ? ${camsLocked() ? '**Non** : toutes restent verrouillées.' : 'Certaines oui : regarde le tableau des appareils.'} Les deux grands maîtres sont calés sur le GPS : ils donnent la même heure, à quelques nanosecondes près. Le passage de l'un à l'autre est invisible.`,
      auto: () => { FAB.gm.gm1.up = false; markDirty(); },
    },
    {
      id: 'restore', title: 'Le remettre en service',
      say: 'Le grand maître 1 revient (alimentation rétablie).',
      do: 'Recoche « En service » sur le grand maître 1.',
      go: net('ptp'), show: [{ sel: '#station [data-tut="gm1-up"]', label: 'grand maître 1' }],
      done: () => FAB.gm.gm1.up && FAB.res && FAB.res.gmActive.red && FAB.res.gmActive.red.id === 'gm1',
      ok: 'Il est réélu aussitôt (priority1 meilleure) : c\'est un fonctionnement « réversible ». Certains cars préfèrent donner la même priority1 aux deux grands maîtres pour éviter cette seconde bascule : le départage se fait alors sur la qualité.',
      auto: () => { FAB.gm.gm1.up = true; markDirty(); },
    },
    {
      id: 'rogue', title: 'Le danger : une horloge pirate',
      say: 'Le BMCA compare **priority1 avant tout**. Un appareil mis à jour, oublié en « maître possible » avec priority1 = 50, battrait nos deux grands maîtres GPS : tout le réseau se calerait sur son horloge interne, qui dérive. Les images se mettent à sauter à la commutation.\n\nDeux protections, toujours ensemble :\n- chaque appareil en **slave only** (tableau des appareils, onglet PTP) ;\n- sur les leaves, les ports des appareils en **ptp role master** : le commutateur ignore toute annonce qui arrive par ces ports.',
    },
    {
      id: 'quiz', title: 'Question',
      say: 'À toi de répondre.',
      quiz: { q: 'Le GPS du grand maître 1 tombe (il passe en classe 7, maintien). Le grand maître 2 est toujours verrouillé GPS (classe 6). Lequel est élu ?', choices: ['Le grand maître 2, car sa classe d\'horloge est meilleure', 'Le grand maître 1, car priority1 est comparé avant la classe', 'Aucun : PTP s\'arrête'], answer: 1, why: 'Piège classique : priority1 passe avant la qualité. Le grand maître 1 (priority1 100) reste élu même en maintien, et le grand maître 2 (110) attend. C\'est voulu si on préfère garder une seule référence stable ; sinon, on donne la même priority1 aux deux pour que la qualité départage.' },
    },
  ],
};

// ---------------- dépannage ----------------
const faultOf = (c) => c.mem.entry;
const faultDev = (c) => (faultOf(c) && faultOf(c).st ? FAB.devices[faultOf(c).st.dev] : null);
const camOf = (c) => { const d = faultDev(c); return d ? +String(d.id).replace(/\D/g, '') : 1; };
const nicOf = (c, color) => { const d = faultDev(c); return d ? d.nics[color] : null; };
const portFixed = (c, color) => { const n = nicOf(c, color); if (!n) return false; const p = CFG(n.sw).ports[n.port]; return p.mode === 'access' && p.vlan === leafPlan(n.sw).vlan; };
/** @type {import('../engine.js').Lesson} */
const LESSON_FIX = {
  id: 'reseau-depannage', domain: 'Réseau ST 2110', stations: ['reseau'], needs: { ip: true },
  title: 'Dépannage : une caméra a disparu',
  summary: 'Le réalisateur n\'a plus une caméra. On applique la méthode : constater, délimiter, descendre les couches, réparer, enregistrer.',
  duration: '12 min', level: 'intermédiaire',
  outro: 'La méthode vaut pour toutes les pannes : délimiter d\'abord (une source ou toutes ? un réseau ou les deux ?), puis descendre les couches (physique, VLAN, IP, multicast, PTP) jusqu\'à la cause. Et ne jamais oublier d\'enregistrer la correction.',
  steps: [
    {
      id: 'call', title: '« La caméra est noire ! »',
      // panne cachée, enregistrée sur les deux leaves (elle survivrait à un redémarrage)
      enter: (c) => { c.mem.entry = injectFault('vlanccu', true); for (const color of ['red', 'blue']) { const n = nicOf(c, color); if (n) writeMemory(n.sw); } markDirty(); },
      say: (c) => `Le réalisateur à l'interphone : « La **${camOf(c)}**, je ne l'ai plus ! ». Pas de panique, on applique la méthode. Première question, toujours la même : **qu'est-ce qui est touché exactement ?** Une seule source ou plusieurs ? Un seul réseau ou les deux ?`,
    },
    {
      id: 'flows', title: 'Délimiter',
      say: (c) => `Au poste Réseau IP, onglet **Flux NMOS · SDP**, cherche les réceptions de la CAM ${camOf(c)} (par exemple l'entrée ${camOf(c)} du mélangeur, « ME${camOf(c)} »).`,
      do: (c) => `Ouvre l'onglet Flux et clique sur la ligne ME${camOf(c)}.`,
      go: (c) => net('flows', { rx: 'ME' + camOf(c) }), show: (c) => (c.view().tab === 'flows' ? ROW('ME' + camOf(c)) : tabSel('flows', 'Flux NMOS · SDP')),
      done: (c) => c.view().tab === 'flows' && (c.seen('rx', (e) => e.rx === 'ME' + camOf(c)) || c.view().rx === 'ME' + camOf(c)),
      ok: (c) => `« RIEN REÇU » : **ni par le rouge, ni par le bleu**. Et seules les réceptions de la CAM ${camOf(c)} sont touchées (${rxSummary().lost.length} réceptions perdues en tout). Conclusion : le réseau va bien dans son ensemble ; le problème est **du côté de cette CCU**, et sur les deux réseaux à la fois. Soit l'appareil lui-même, soit ses deux raccordements.`,
      auto: (c) => { c.io.go(net('flows', { rx: 'ME' + camOf(c) })); c.io.log('rx', { rx: 'ME' + camOf(c) }); },
    },
    {
      id: 'diag', title: 'Que dit le diagnostic ?',
      say: 'L\'onglet **Diagnostic** passe en revue toutes les configurations : il pointe souvent directement le coupable.',
      do: 'Ouvre l\'onglet Diagnostic et lis les alarmes.',
      go: net('diag'), show: tabSel('diag', 'Diagnostic'), done: onTab('diag'),
      ok: (c) => `Il signale la CCU ${camOf(c)} injoignable sur les deux réseaux. Le bouton de l'alarme mène au port de la leaf : allons le voir.`,
      auto: goTab('diag'),
    },
    {
      id: 'port', title: 'Le port de la CCU (réseau rouge)',
      say: (c) => { const n = nicOf(c, 'red'); return `La CCU ${camOf(c)} est sur **${n ? n.port : '?'}** de leaf-r1-cam. Couche 1 d'abord : le lien est-il monté (« connected ») ? Puis couche 2 : est-il dans le bon VLAN ?`; },
      do: (c) => { const n = nicOf(c, 'red'); return `Onglet Commutateurs → leaf-r1-cam → Interfaces, et sélectionne ${n ? n.port : 'le port de la CCU'}.`; },
      go: (c) => { const n = nicOf(c, 'red'); return net('switch', { sw: n ? n.sw : 'LEAF-R1', port: n ? n.port : undefined, sub: 'ports' }); },
      done: (c) => { const n = nicOf(c, 'red'); const v = c.view(); return !!n && v.tab === 'switch' && v.sw === n.sw && v.port === n.port; },
      ok: (c) => { const n = nicOf(c, 'red'); const p = n ? CFG(n.sw).ports[n.port] : null; return `Le lien est monté (couche 1 bonne), mais le port est dans le **VLAN ${p ? p.vlan : '?'}** au lieu du **VLAN ${n ? leafPlan(n.sw).vlan : '?'}**. La CCU est bien branchée, mais isolée de sa passerelle : elle ne peut plus émettre vers le réseau. Quelqu'un (ou un script) a modifié la configuration.`; },
      auto: (c) => { const n = nicOf(c, 'red'); if (n) c.io.go(net('switch', { sw: n.sw, port: n.port, sub: 'ports' })); },
    },
    {
      id: 'fixred', title: 'Réparer sur le rouge',
      say: 'Tu peux corriger dans le formulaire (liste « VLAN d\'accès ») ou en ligne de commande.',
      do: (c) => { const n = nicOf(c, 'red'); return `Remets ${n ? n.port : 'le port'} dans le VLAN ${n ? leafPlan(n.sw).vlan : 101}.`; },
      cli: (c) => { const n = nicOf(c, 'red'); return n ? ['configure terminal', `interface ${n.port.toLowerCase()}`, `switchport access vlan ${leafPlan(n.sw).vlan}`, 'end'] : []; },
      sw: 'LEAF-R1',
      go: (c) => { const n = nicOf(c, 'red'); return net('switch', { sw: n ? n.sw : 'LEAF-R1', port: n ? n.port : undefined, sub: 'ports' }); },
      done: (c) => portFixed(c, 'red'),
      ok: (c) => `Regarde le multiview : **la CAM ${camOf(c)} est revenue**, par le rouge seulement. À l'antenne, c'est réglé ; mais elle n'a pas de secours. On ne s'arrête pas là.`,
      auto: (c) => { const n = nicOf(c, 'red'); if (n) c.io.cli(n.sw, ['configure terminal', `interface ${n.port.toLowerCase()}`, `switchport access vlan ${leafPlan(n.sw).vlan}`, 'end']); },
    },
    {
      id: 'fixblue', title: 'Réparer sur le bleu',
      say: 'Même erreur sur le bleu : la même modification a été faite des deux côtés. C\'est typique d\'une erreur humaine ou d\'un script appliqué aux deux réseaux… et c\'est pour ça que les deux réseaux sont tombés ensemble.',
      do: (c) => { const n = nicOf(c, 'blue'); return `Sur leaf-b1-cam, remets ${n ? n.port : 'le port'} dans le VLAN ${n ? leafPlan(n.sw).vlan : 201}.`; },
      cli: (c) => { const n = nicOf(c, 'blue'); return n ? ['configure terminal', `interface ${n.port.toLowerCase()}`, `switchport access vlan ${leafPlan(n.sw).vlan}`, 'end'] : []; },
      sw: 'LEAF-B1',
      go: (c) => { const n = nicOf(c, 'blue'); return net('switch', { sw: n ? n.sw : 'LEAF-B1', port: n ? n.port : undefined, sub: 'ports' }); },
      done: (c) => portFixed(c, 'blue'),
      ok: 'La CCU émet de nouveau sur les deux réseaux : protection 2022-7 rétablie.',
      auto: (c) => { const n = nicOf(c, 'blue'); if (n) c.io.cli(n.sw, ['configure terminal', `interface ${n.port.toLowerCase()}`, `switchport access vlan ${leafPlan(n.sw).vlan}`, 'end']); },
    },
    {
      id: 'save', title: 'Enregistrer',
      say: 'Dernier réflexe : la correction n\'existe que dans la running-config. Au prochain redémarrage, la panne reviendrait.',
      do: 'Enregistre la configuration des deux leaves (write memory sur chacune).',
      cli: ['write memory'], sw: 'LEAF-R1',
      go: net('switch', { sw: 'LEAF-R1', sub: 'term' }),
      done: () => saved('LEAF-R1') && saved('LEAF-B1'),
      ok: (c) => { const e = faultOf(c); const solved = e && (e.done || e.f.check(e.st)); return `Enregistré sur les deux leaves. ${solved ? 'La panne est résolue.' : ''} Dans le compte rendu d'incident, on note : symptôme, délimitation, cause, correction, heure. Et on cherche qui a modifié la configuration, pour que ça ne se reproduise pas.`; },
      auto: (c) => { c.io.cli('LEAF-R1', ['write memory']); c.io.cli('LEAF-B1', ['write memory']); },
    },
    {
      id: 'quiz', title: 'Question',
      say: 'Pour ancrer la méthode.',
      quiz: { q: 'Une seule source est perdue, sur les deux réseaux à la fois. Où chercher en premier ?', choices: ['Les spines', 'L\'appareil et ses deux ports d\'accès (sur les deux leaves)', 'Les grands maîtres PTP'], answer: 1, why: 'Si les spines ou le PTP étaient en cause, bien d\'autres sources seraient touchées. Une seule source sur les deux réseaux, c\'est l\'appareil ou ses raccordements : son alimentation, ses cartes, ou la configuration de ses deux ports.' },
    },
  ],
};

// en quittant un parcours avant la fin : remettre le réseau dans un état propre
LESSON_PTP.cleanupLabel = 'Remettre le grand maître 1 en service';
LESSON_PTP.cleanup = () => { if (!FAB.gm.gm1.up) { FAB.gm.gm1.up = true; markDirty(); } };
LESSON_FIX.cleanupLabel = 'Réparer la panne de la CCU et enregistrer';
LESSON_FIX.cleanup = (c) => { for (const color of ['red', 'blue']) { const n = nicOf(c, color); if (!n) continue; Object.assign(CFG(n.sw).ports[n.port], { mode: 'access', vlan: leafPlan(n.sw).vlan }); writeMemory(n.sw); } markDirty(); };

export const NET_LESSONS = [LESSON_TOUR, LESSON_LEAF, LESSON_GW, LESSON_PTP, LESSON_FIX];
// « fais-le pour moi » par défaut : taper les commandes de l'étape
for (const l of NET_LESSONS) for (const s of l.steps) if (s.cli && s.sw && !s.auto) s.auto = (c) => c.io.cli(s.sw, typeof s.cli === 'function' ? s.cli(c) : s.cli);
