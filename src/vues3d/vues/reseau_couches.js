// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { verre, texte, zone, libere } from '../kit.js';
import { appareil, commutateur, Reseau } from '../materiel.js';
import { encapsuler } from '../../cours/ip_calc.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Le modèle en couches » : à gauche, la pile de l'émetteur (application, transport, Internet, accès
// réseau) ; à droite, celle du destinataire ; entre les deux, un commutateur, un routeur et un pare-feu. Le paquet
// descend la pile de l'émetteur en s'enveloppant d'un en-tête par couche (encapsulation), traverse le réseau où
// chaque appareil n'ouvre que les couches dont il a besoin (le commutateur la trame, le routeur le paquet IP qu'il
// réemballe dans une nouvelle trame, le pare-feu le port), puis remonte la pile du destinataire en se déballant.
// Trois envois : une image ST 2110 (RTP, UDP), une page web (TCP), un ping (ICMP). Tailles : cours/ip_calc.js.
// ----------------------------------------------------------------------------------
const XE = -4.3, XD = 4.6, YP = 1.3; // piles de l'émetteur et du destinataire, hauteur du chemin
const NIV = { acces: 1.3, internet: 1.95, transport: 2.6, app: 3.25 };
const XS = -1.9, XR = 0.5, XF = 2.6; // commutateur, routeur, pare-feu
const COQ = { data: [0xffd38a, 'données'], rtp: [0xd08cff, 'RTP'], l4: [0x7fd3f3, 'UDP'], ip: [0xffb020, 'IP'], eth: [0x7fd1a0, 'Ethernet'] };
const ENVOIS = {
  video: { nom: 'Une image ST 2110', donnees: 1200, o: { transport: 'udp', rtp: true }, l4: 'UDP · port 5004', de: '10.1.20.11', vers: '10.1.60.50', pf: 'port UDP 5004 : flux RTP autorisé' },
  web: { nom: 'Une page web', donnees: 1460, o: { transport: 'tcp', rtp: false }, l4: 'TCP · port 443', de: '10.1.20.11', vers: '10.1.60.50', pf: 'port TCP 443 (HTTPS) : autorisé' },
  ping: { nom: 'Un ping', donnees: 56, o: { transport: 'icmp', rtp: false }, l4: 'ICMP · écho', de: '10.1.20.11', vers: '10.1.60.50', pf: 'ICMP écho : autorisé (on pourrait le bloquer)' },
};

export const VUE_RESEAU_COUCHES = {
  id: 'reseau-couches', chapitre: 'reseau', titre: 'Le modèle en couches : un paquet de bout en bout',
  resume: 'Le paquet descend les couches de l\'émetteur en s\'enveloppant d\'en-têtes, traverse un commutateur, un routeur et un pare-feu qui n\'ouvrent que ce dont ils ont besoin, puis remonte chez le destinataire.',
  lecons: ['reseau-modele', 'reseau-ethernet'],
  lectures: ['Ce qui part', 'Où il en est', 'Taille sur le fil', 'Ce que lit l\'appareil'],
  depart: 'À gauche la pile de l\'émetteur, à droite celle du destinataire. Chaque étape joue un morceau du voyage, en boucle.',
  vue: { cible: [0.15, 1.9, 0], dir: [0, 0.28, 1], dist: 14.6 },
  orbite: { rMin: 1.5, rMax: 22 },
  etapes: [
    { t: 'Quatre couches, chacune son travail', reglage: { de: 0, a: 16 }, lecon: 'reseau-modele',
      texte: `Deux machines, et entre elles un commutateur, un routeur, un pare-feu. Chaque machine empile quatre **couches** (modèle TCP/IP) : **application** (les données et leur format), **transport** (les ports, TCP ou UDP), **Internet** (les adresses IP, le chemin), **accès réseau** (la trame Ethernet, le câble).

Regardez le voyage complet d'une image ST 2110 ; les étapes suivantes le découpent.` },
    { t: 'L\'encapsulation : un en-tête par couche', reglage: { de: 0, a: 5 }, lecon: 'reseau-modele', vue: { cible: [XE, 2.2, 0.3], dir: [0.15, 0.2, 1], dist: 5.2 },
      texte: `Chez l'émetteur, l'image descend les couches et s'enveloppe à chaque étage : **RTP** (12 octets : numéro, horodatage), **UDP** (8 : les ports), **IP** (20 : les adresses), **Ethernet** (18 : les adresses MAC, le type, le contrôle). Comme des poupées russes.

Sur le fil, s'ajoutent encore un préambule et un silence : 1 200 octets d'image deviennent 1 278 octets, 94 % d'utile.` },
    { t: 'Le commutateur n\'ouvre que la trame', reglage: { de: 5, a: 7 }, lecon: 'reseau-modele', vue: { cible: [XS, 1.4, 0], dir: [0, 0.3, 1], dist: 4.8 },
      texte: `Le **commutateur** travaille au niveau 2 : il soulève l'enveloppe **Ethernet**, lit l'adresse MAC de destination, la cherche dans sa table et renvoie la trame par le bon port. Il ne regarde jamais l'adresse IP, ni le port, ni les données.` },
    { t: 'Le routeur : nouvelle trame, même paquet', reglage: { de: 7, a: 9 }, lecon: 'reseau-modele', vue: { cible: [XR, 1.4, 0], dir: [0, 0.3, 1], dist: 4.8 },
      texte: `Le **routeur** travaille au niveau 3 : il **retire** la trame Ethernet (elle n'avait de sens que sur le réseau d'avant), lit l'**adresse IP** de destination, décrémente le **TTL** (64 → 63), puis emballe le paquet dans une **nouvelle trame** pour le réseau suivant (une autre couleur) : nouvelles adresses MAC, mêmes adresses IP.` },
    { t: 'Le pare-feu regarde jusqu\'au port', reglage: { de: 9, a: 11 }, lecon: 'reseau-modele', vue: { cible: [XF, 1.4, 0], dir: [0, 0.3, 1], dist: 4.8 },
      texte: `Le **pare-feu** va jusqu'au niveau 4 : sous la trame et l'en-tête IP, il lit le **protocole et le port** (UDP 5004, TCP 443…). Une règle dit ce qui passe : il peut laisser passer le flux vidéo et bloquer tout le reste.` },
    { t: 'La décapsulation chez le destinataire', reglage: { de: 11, a: 16 }, lecon: 'reseau-modele', vue: { cible: [XD, 2.2, 0.3], dir: [-0.15, 0.2, 1], dist: 5.2 },
      texte: `Chez le destinataire, le paquet remonte les couches et chaque couche retire **son** en-tête : la carte réseau la trame, IP le paquet, UDP le datagramme (il lit le port pour trouver le logiciel), RTP remet l'image à sa place grâce au numéro et à l'horodatage. L'application reçoit ses 1 200 octets.` },
    { t: 'TCP, UDP, ICMP : changez ce qui part', reglage: { de: 0, a: 16, envoi: 'web' }, lecon: 'reseau-ethernet',
      texte: `Une **page web** voyage dans un segment **TCP** (20 octets d'en-tête, port 443), sans RTP. Un **ping** n'a pas de couche transport : un message **ICMP** de 8 octets directement dans IP. Le reste ne change pas : même paquet IP, même trame Ethernet, mêmes appareils.

Dépanner, c'est remonter ces couches de bas en haut : le voyant (1), le VLAN et la MAC (2), l'adresse et le ping (3), le port et le service (4 et au-delà). Changez l'envoi dans « À vous ».` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { envoi: 'video', de: 0, a: 16, osi: false };
    // appareils et câbles
    const em = appareil('serveur', 'Émetteur', { info: () => ({ nom: 'L\'émetteur', texte: `Adresse ${ENVOIS[S.envoi].de}. Sa pile de couches est au-dessus.` }) }); em.position.set(XE, 0, -1.2); root.add(em);
    const de = appareil('pc', 'Destinataire', { info: () => ({ nom: 'Le destinataire', texte: `Adresse ${ENVOIS[S.envoi].vers}. Sa pile de couches est au-dessus.` }) }); de.position.set(XD, 0, -1.2); root.add(de);
    const sw = commutateur('Commutateur', 4, { info: { nom: 'Le commutateur (niveau 2)', texte: 'Il lit l\'adresse MAC de destination et renvoie la trame par le bon port.' } }); sw.position.set(XS, 0, 0); root.add(sw);
    const rt = commutateur('Routeur', 3, { routeur: true, info: { nom: 'Le routeur (niveau 3)', texte: 'Il lit l\'adresse IP, décrémente le TTL et refait la trame pour le réseau suivant.' } }); rt.position.set(XR, 0, 0); root.add(rt);
    const pf = commutateur('Pare-feu', 3, { routeur: true, couleur: 0x5a2f33, info: { nom: 'Le pare-feu (jusqu\'au niveau 4)', texte: 'Il lit le protocole et le port, et applique ses règles.' } }); pf.position.set(XF, 0, 0); root.add(pf);
    const net = new Reseau(ctx, root, 20);
    net.relie({ obj: em }, { obj: sw, i: 0 }, { couleur: 0x4a6a8a, sag: 0.4 });
    net.relie({ obj: sw, i: 3 }, { obj: rt, i: 0 }, { couleur: 0x4a6a8a, sag: 0.3 });
    net.relie({ obj: rt, i: 2 }, { obj: pf, i: 0 }, { couleur: 0x7a5a3a, sag: 0.3 });
    net.relie({ obj: pf, i: 2 }, { obj: de }, { couleur: 0x7a5a3a, sag: 0.4 });
    const tagSw = ctx.label(sw, '', { off: [0, 1.6, 0], cls: 'small' }), tagRt = ctx.label(rt, '', { off: [0, 1.6, 0], cls: 'small' }), tagPf = ctx.label(pf, '', { off: [0, 1.6, 0], cls: 'small' });
    // les piles de couches : une dalle par couche
    const dalles = [];
    const pile = (x) => {
      for (const [k, y] of Object.entries(NIV)) {
        const col = { app: COQ.rtp[0], transport: COQ.l4[0], internet: COQ.ip[0], acces: COQ.eth[0] }[k];
        const z = zone(1.5, 0.05, 1.2, col, { opacity: 0.16, edge: 0.7 }); z.position.set(x, y - 0.32, 0.3); z.userData.fill.userData.passe = true; z.userData.edges.userData.passe = true; root.add(z);
        dalles.push({ k, x, y, z, t: null });
      }
    };
    pile(XE); pile(XD);
    const nomsDalles = () => {
      for (const d of dalles) {
        if (d.t) { d.z.remove(d.t); libere(d.t); }
        const txt = S.osi ? { app: '7 Application · 6 Présentation · 5 Session', transport: '4 Transport', internet: '3 Réseau', acces: '2 Liaison · 1 Physique' }[d.k] : { app: 'Application (RTP, HTTP)', transport: 'Transport (UDP, TCP)', internet: 'Internet (IP)', acces: 'Accès réseau (Ethernet)' }[d.k];
        d.t = texte(txt, { h: 0.12, bg: 'rgba(12,16,20,.82)' }); d.t.position.set(0, 0.05, 0.62); d.z.add(d.t);
      }
    };
    nomsDalles();
    // le paquet : des coques emboîtées
    const pkt = new THREE.Group(); root.add(pkt);
    const coques = {};
    Object.entries(COQ).forEach(([k, [col]], i) => {
      const s = 0.3 + i * 0.075;
      const m = new THREE.Mesh(new THREE.BoxGeometry(s * 1.5, s, s), k === 'data' ? verre(col, 0.85) : verre(col, 0.22, { depthWrite: false }));
      m.renderOrder = 2 + i; m.userData.passe = k !== 'data';
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
      const g = new THREE.Group(); g.add(m, e); pkt.add(g); coques[k] = { g, m, lift: 0, cible: 0, on: false };
    });
    const tagP = ctx.label(pkt, '', { off: [0, 0.62, 0], cls: 'hot' });
    // la chronologie du voyage : [nom, de, vers, durée, coques présentes, coques soulevées, appareil, ce qu'il lit]
    const P = (x, y) => new THREE.Vector3(x, y, 0.3);
    function phases() {
      const E = ENVOIS[S.envoi], rtp = !!E.o.rtp, icmp = E.o.transport === 'icmp';
      const haut = ['data', ...(rtp ? ['rtp'] : [])], l4 = icmp ? [] : ['l4'], ip3 = icmp ? ['l4', 'ip'] : ['ip'];
      const c1 = [...haut], c2 = [...haut, ...l4], c3 = [...c2, ...ip3], c4 = [...c3, 'eth'];
      const enc = encapsuler(E.donnees, E.o);
      return [
        ['L\'application prépare ses données', P(XE, NIV.app + 0.45), P(XE, NIV.app), 0.9, ['data'], [], '', `${E.donnees} octets de données`],
        [rtp ? 'RTP ajoute numéro et horodatage' : 'Les données sont prêtes', P(XE, NIV.app), P(XE, NIV.app), 0.8, c1, [], '', rtp ? '+ 12 octets RTP' : ''],
        [icmp ? 'Pas de couche transport pour un ping' : `${E.o.transport.toUpperCase()} ajoute les ports`, P(XE, NIV.app), P(XE, NIV.transport), 0.9, c2, [], '', icmp ? '' : `+ ${E.o.transport === 'tcp' ? 20 : 8} octets ${E.l4}`],
        ['IP ajoute les adresses', P(XE, NIV.transport), P(XE, NIV.internet), 0.9, c3, [], '', `+ 20 octets IP : ${E.de} → ${E.vers}${icmp ? ' (+ 8 ICMP)' : ''}`],
        ['Ethernet fait la trame', P(XE, NIV.internet), P(XE, NIV.acces), 0.9, c4, [], '', '+ 18 octets Ethernet : adresses MAC, type, contrôle'],
        ['Sur le câble', P(XE, NIV.acces), P(XS, YP), 1.3, c4, [], '', `${enc.surFil} octets sur le fil`],
        ['Le commutateur lit la trame', P(XS, YP), P(XS, YP), 1.8, c4, ['eth'], 'sw', 'MAC de destination : le port de sortie'],
        ['Vers le routeur', P(XS, YP), P(XR, YP), 1.1, c4, [], '', ''],
        ['Le routeur refait la trame', P(XR, YP), P(XR, YP), 2.4, c3, ['ip'], 'rt', `IP de destination ${E.vers} · TTL 64 → 63 · nouvelle trame`],
        ['Vers le pare-feu', P(XR, YP), P(XF, YP), 1.0, c4, [], '', ''],
        ['Le pare-feu lit le port', P(XF, YP), P(XF, YP), 1.9, c4, ['eth', 'ip', 'l4'], 'pf', E.pf],
        ['Vers le destinataire', P(XF, YP), P(XD, NIV.acces), 1.2, c4, [], '', ''],
        ['La carte retire la trame', P(XD, NIV.acces), P(XD, NIV.internet), 0.9, c3, [], '', 'trame contrôlée (FCS) puis retirée'],
        ['IP retire son en-tête', P(XD, NIV.internet), P(XD, NIV.transport), 0.9, c2, [], '', `c'est bien pour ${E.vers}`],
        [icmp ? 'ICMP répond à l\'écho' : `${E.o.transport.toUpperCase()} trouve le logiciel par le port`, P(XD, NIV.transport), P(XD, NIV.app), 0.9, c1, [], '', icmp ? 'la réponse repart en sens inverse' : E.l4],
        ['L\'application reçoit ses données', P(XD, NIV.app), P(XD, NIV.app + 0.45), 1.2, ['data'], [], '', `${E.donnees} octets livrés`],
      ];
    }
    let PH = phases(), k = S.de, tk = 0, routeEth = 0;
    const tags = { sw: tagSw, rt: tagRt, pf: tagPf };
    function entre(i) {
      const [nom, , , , , , dev, lit] = PH[i];
      tagP.set(nom);
      for (const [d, L] of Object.entries(tags)) { L.set(d === dev ? lit : ''); L.show(d === dev); }
      if (i === 8) routeEth = 1; else if (i < 8) routeEth = 0;
      /** @type {any} */ (coques.eth.m.material).color.set(routeEth ? 0x5fd3a8 : COQ.eth[0]);
      ctx.read('Où il en est', `${nom}${lit ? ` : ${lit}` : ''}`);
      ctx.read('Ce que lit l\'appareil', dev === 'sw' ? 'le commutateur : la trame (niveau 2)' : dev === 'rt' ? 'le routeur : le paquet IP (niveau 3)' : dev === 'pf' ? 'le pare-feu : jusqu\'au port (niveau 4)' : '—');
    }
    function lire() {
      const E = ENVOIS[S.envoi], enc = encapsuler(E.donnees, E.o);
      ctx.read('Ce qui part', `${E.nom} : ${E.donnees} octets, ${E.l4}`);
      ctx.read('Taille sur le fil', `${enc.surFil} octets (${Math.round(enc.efficacite * 100)} % d'utile) : ${enc.couches.map((c) => c.tete ? `${c.nom.replace(/ \(.*\)/, '')} ${c.tete}` : '').filter(Boolean).join(', ')}`);
    }
    const restart = () => { PH = phases(); k = S.de; tk = 0; entre(k); lire(); };
    restart();
    let ui = null;
    const sync = () => { if (!ui) return; for (const b of ui.querySelectorAll('[data-v]')) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.v === S.envoi)); const o = ui.querySelector('[data-k=osi]'); if (o) o.setAttribute('aria-pressed', String(S.osi)); };
    return {
      etape(i, E) { const R = E.reglage || {}; S.de = R.de ?? 0; S.a = R.a ?? 16; if (R.envoi) S.envoi = R.envoi; else if (i < 6) S.envoi = 'video'; restart(); sync(); },
      update(dt) {
        tk += dt;
        let ph = PH[k];
        if (tk >= ph[3]) { tk = 0; k = k + 1 >= Math.min(S.a, PH.length) ? S.de : k + 1; ph = PH[k]; entre(k); }
        const u = Math.min(1, tk / ph[3]), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        pkt.position.lerpVectors(ph[1], ph[2], e);
        const lev = Math.sin(Math.min(1, u * 1.6) * Math.PI); // soulever puis reposer pendant la lecture
        for (const [key, c] of Object.entries(coques)) {
          const on = ph[4].includes(key); c.g.visible = on;
          c.g.position.y = on && ph[5].includes(key) ? 0.12 + 0.55 * lev * (1 + Object.keys(COQ).indexOf(key) * 0.12) : 0;
        }
      },
      commandes() {
        ui = el('div', { class: 'v3-ctl' },
          el('div', { class: 'v3-row' }, el('span', {}, 'Ce qui part :'), ...Object.entries(ENVOIS).map(([kk, v]) => el('button', { type: 'button', class: 'btn small', 'data-v': kk, 'aria-pressed': String(kk === S.envoi), onclick: () => { S.envoi = kk; restart(); sync(); ctx.say(`${v.nom} : ${v.l4}.`); } }, v.nom))),
          el('div', { class: 'v3-row' }, el('button', { type: 'button', class: 'btn small', 'data-k': 'osi', 'aria-pressed': String(S.osi), onclick: () => { S.osi = !S.osi; nomsDalles(); sync(); ctx.say(S.osi ? 'Les sept couches du modèle OSI, rangées sur les quatre de TCP/IP.' : 'Les quatre couches du modèle TCP/IP.'); } }, 'Noms OSI (7 couches)')));
        return ui;
      },
    };
  },
};
