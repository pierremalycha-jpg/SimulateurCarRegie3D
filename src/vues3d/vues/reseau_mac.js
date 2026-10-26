// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { COUL, eclat, ecran } from '../kit.js';
import { appareil, commutateur, Reseau } from '../materiel.js';
import { L2, DIFFUSION } from '../l2.js';
import { envoi } from '../l2anim.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Le commutateur apprend » : SW-VISION et cinq machines du réseau de contrôle (VLAN 20).
// Au-dessus du commutateur, sa table MAC se remplit trame après trame : la question ARP en diffusion
// (recopiée partout), la réponse (un seul port, et un deuxième apprentissage), la commande (port connu),
// une adresse encore inconnue (inondation). Les machines gardent ou ignorent ce qu'elles reçoivent.
// Mêmes appareils et adresses que la leçon (cours/reseau.js).
// ----------------------------------------------------------------------------------
const HOSTS = [
  { id: 'rcp1', type: 'rcp', name: 'RCP 1', mac: '02:1A:20:00:00:31', ip: '10.1.20.31', port: 0 },
  { id: 'ccu1', type: 'ccu', name: 'CCU 1', mac: '02:1A:20:00:00:11', ip: '10.1.20.11', port: 1 },
  { id: 'rcp2', type: 'rcp', name: 'RCP 2', mac: '02:1A:20:00:00:32', ip: '10.1.20.32', port: 2 },
  { id: 'ccu2', type: 'ccu', name: 'CCU 2', mac: '02:1A:20:00:00:12', ip: '10.1.20.12', port: 3 },
  { id: 'pc', type: 'pc', name: 'PC supervision', mac: '02:1A:20:00:00:50', ip: '10.1.20.50', port: 4 },
];
const H = Object.fromEntries(HOSTS.map((h) => [h.id, h]));
const K_ARP = 0xffb020, K_REP = 0x7fd1a0, K_CMD = 0x4cc3e6;

/** les trames de chaque étape (la scène rejoue en silence celles des étapes d'avant) */
const SCENES = [
  [],
  [{ src: 'rcp1', dst: DIFFUSION, k: 'arp', who: 'ccu1' }],
  [{ src: 'ccu1', dst: H.rcp1.mac, k: 'rep' }],
  [{ src: 'rcp1', dst: H.ccu1.mac, k: 'cmd' }],
  [{ src: 'rcp2', dst: H.ccu2.mac, k: 'cmd' }],
  [{ src: 'ccu2', dst: H.rcp2.mac, k: 'rep' }],
];

export const VUE_RESEAU_MAC = {
  id: 'reseau-mac', chapitre: 'reseau', titre: 'Le commutateur apprend : la table MAC',
  resume: 'Cinq machines sur un commutateur : la diffusion ARP recopiée partout, la table MAC qui se remplit, puis chaque trame vers son seul port.',
  lecons: ['reseau-switch'],
  lectures: ['Dernière trame', 'Décision du commutateur', 'Table MAC'],
  depart: 'Avancez étape par étape : chaque étape envoie ses trames. « À vous » permet d\'en envoyer d\'autres.',
  vue: { cible: [0, 1.0, 0.3], dir: [0, 0.55, 1], dist: 7.4 },
  orbite: { rMin: 1.2, rMax: 16 },
  etapes: [
    { t: 'Un commutateur, cinq machines', vue: { cible: [0, 1.1, 0.2], dir: [0, 0.5, 1], dist: 7.2 },
      texte: `Le commutateur **SW-VISION** relie cinq machines du réseau de contrôle : deux RCP, deux CCU et le PC de supervision, toutes dans le VLAN 20 (10.1.20.0/24).

Chaque carte réseau a une **adresse MAC** de 48 bits, gravée en usine (02:1A:20:00:00:31 pour le RCP 1). Au-dessus du commutateur, sa **table MAC** : vide au démarrage. Il ne sait pas encore qui est derrière quel port.` },
    { t: 'La question ARP, en diffusion', vue: { cible: [0, 1.1, 0.2], dir: [0, 0.5, 1], dist: 7.2 },
      texte: `Le RCP 1 doit commander la CCU 1 (10.1.20.11), mais il lui faut son adresse MAC. Il envoie une question **ARP** : « qui a 10.1.20.11 ? », adressée à **FF:FF:FF:FF:FF:FF**, la **diffusion**.

Le commutateur fait deux choses :
- il **apprend** : l'adresse source (RCP 1) est derrière le port 1, première ligne de la table ;
- il **recopie** la diffusion sur **tous les autres ports**.

Toutes les machines la reçoivent ; seule la CCU 1 se reconnaît.` },
    { t: 'La réponse : un seul port', vue: { cible: [0, 1.1, 0.2], dir: [0, 0.5, 1], dist: 7.2 },
      texte: `La CCU 1 répond « c'est moi, 02:1A:20:00:00:11 », directement au RCP 1 (une trame **unicast**).

Le commutateur apprend une deuxième ligne (CCU 1 derrière le port 2), et cette fois il **connaît** la destination : la trame ne sort que par le **port 1**. Les autres machines n'en voient rien.` },
    { t: 'La commande : destination connue', vue: { cible: [0, 1.1, 0.2], dir: [0, 0.5, 1], dist: 7.2 },
      texte: `Le RCP 1 a gardé la réponse dans son **cache ARP** : la commande d'iris part sans question, adressée à la MAC de la CCU 1.

Destination connue : le commutateur l'envoie sur le **seul port 2**. C'est tout l'intérêt d'un commutateur sur un simple répéteur : chaque échange n'occupe que les deux ports concernés.` },
    { t: 'Une adresse inconnue : l\'inondation', vue: { cible: [0, 1.1, 0.2], dir: [0, 0.5, 1], dist: 7.2 },
      texte: `Le RCP 2 envoie une commande à la CCU 2. Il connaît sa MAC (son cache ARP), mais **le commutateur, lui, ne l'a jamais vue** : la CCU 2 n'a encore rien envoyé.

Destination inconnue : le commutateur **inonde**, il recopie la trame sur tous les autres ports, comme une diffusion. Les machines qui ne sont pas la CCU 2 la **jettent** (ce n'est pas leur adresse). Il a appris le RCP 2 au passage.` },
    { t: 'La table est complète', vue: { cible: [0, 1.6, -0.6], dir: [0, 0.25, 1], dist: 4.6 },
      texte: `La CCU 2 répond : quatrième ligne, et toutes les trames suivantes vont droit au but.

En exploitation :
- \`show mac address-table\` dit à quel port est branchée une machine, sans suivre le câble ;
- une entrée **vieillit** (300 s par défaut) : une machine muette sort de la table ;
- une adresse qui **saute** d'un port à l'autre trahit une boucle ou deux machines à la même MAC.

Essayez « Débrancher la CCU 2 et la rebrancher sur le port 6 » : la table se corrige à sa première trame.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const sw = commutateur('SW-VISION', 6, { info: { nom: 'SW-VISION (commutateur)', texte: 'Un commutateur de niveau 2 : il ne lit que les adresses MAC des trames, jamais les adresses IP. Six ports, tous dans le VLAN 20.' } });
    sw.position.set(0, 0, -0.9); root.add(sw);
    const net = new Reseau(ctx, root);
    const l2 = new L2().addSwitch('SW');
    for (let p = 0; p < 6; p++) l2.port('SW', p, 20);
    const objs = {}, links = new Map(), lamps = {}, tags = {};
    HOSTS.forEach((h, i) => {
      const a = (i - 2) * 0.42, x = Math.sin(a) * 3.0, z = Math.cos(a) * 3.0 - 1.6;
      const o = appareil(h.type, h.name, { info: () => ({ nom: h.name, texte: `Adresse MAC ${h.mac} (gravée dans sa carte) · adresse IP ${h.ip}/24 (configurée) · port ${l2.hosts.get(h.id).port + 1} de SW-VISION.` }) });
      o.position.set(x, 0, z); o.rotation.y = -a * 0.6; root.add(o); objs[h.id] = o;
      l2.addHost(h.id, h.mac, h.ip, 'SW', h.port);
      const L = net.relie({ obj: o }, { obj: sw, i: h.port }, { couleur: 0x5f7f9f, info: { nom: `Câble ${h.name} → port ${h.port + 1}`, texte: 'Un câble cuivre RJ45, catégorie 6 : une liaison Ethernet à 1 Gb/s.' } });
      links.set(`SW:${h.port}`, { L, versSw: 1 });
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 10), eclat(0x2a3138)); lamp.position.set(0, o.userData.top + 0.12, 0); o.add(lamp); lamps[h.id] = lamp;
      tags[h.id] = ctx.label(lamp, '', { off: [0, 0.16, 0], cls: 'small' }); tags[h.id].show(false);
    });
    // la sixième prise, libre (pour rebrancher la CCU 2)
    const spare = { port: 5 };
    // la table MAC, au-dessus du commutateur
    const tab = ecran(2.3, 1.0, 1024, () => {});
    tab.mesh.position.set(0, 1.85, -1.05); root.add(tab.mesh);
    tab.mesh.userData.info = { nom: 'Table MAC de SW-VISION', texte: 'Ce que le commutateur a appris : telle adresse MAC est derrière tel port, dans tel VLAN. Remplie seule, à partir de l\'adresse source de chaque trame reçue.' };
    const hl = new Set();
    function drawTable() {
      const g = tab.g, W = tab.W, Hh = tab.H, rows = l2.table('SW');
      g.fillStyle = '#081014'; g.fillRect(0, 0, W, Hh);
      g.fillStyle = '#ffb020'; g.font = '700 40px "Archivo Narrow", sans-serif'; g.fillText('show mac address-table · SW-VISION', 24, 52);
      g.font = '600 30px "B612 Mono", monospace'; g.fillStyle = '#8a949c';
      g.fillText('VLAN  ADRESSE MAC          PORT  APPAREIL', 24, 104);
      rows.forEach((r, i) => {
        const h = l2.hostByMac(r.mac);
        g.fillStyle = hl.has(r.mac) ? '#ffe3b0' : '#d3f3df';
        if (hl.has(r.mac)) { g.fillStyle = 'rgba(255,176,32,.18)'; g.fillRect(14, 120 + i * 52, W - 28, 46); g.fillStyle = '#ffe3b0'; }
        g.fillText(`${String(r.vlan).padEnd(6)}${r.mac.padEnd(21)}${String(r.port + 1).padEnd(6)}${h ? HOSTS.find((x) => x.id === h.id).name : '?'}`, 24, 154 + i * 52);
      });
      if (!rows.length) { g.fillStyle = '#6a747c'; g.fillText('(vide : rien n\'a encore été appris)', 24, 160); }
      tab.mesh.material.map.needsUpdate = true;
      ctx.read('Table MAC', rows.length ? rows.map((r) => `${HOSTS.find((x) => x.mac === r.mac).name} → port ${r.port + 1}`).join(' · ') : 'vide');
    }
    drawTable();
    const KIND = {
      arp: (s, who) => ({ c: K_ARP, info: { nom: `Question ARP : qui a ${H[who].ip} ?`, texte: `Trame de diffusion. MAC source ${H[s].mac} (${H[s].name}) · MAC destination FF:FF:FF:FF:FF:FF.` } }),
      rep: (s, d) => ({ c: K_REP, info: { nom: `Réponse de ${H[s].name}`, texte: `Trame unicast. MAC source ${H[s].mac} · MAC destination ${d}.` } }),
      cmd: (s, d) => ({ c: K_CMD, info: { nom: `Commande de ${H[s].name}`, texte: `Trame unicast (une commande IP à l'intérieur). MAC source ${H[s].mac} · MAC destination ${d}.` } }),
    };
    let flashT = 0;
    function flash(id, garde, texteTag) {
      /** @type {any} */ (lamps[id].material).color.set(garde ? COUL.vert : 0x8a949c);
      tags[id].set(texteTag); tags[id].show(true); flashT = 2.4;
    }
    /** envoie une trame (animée) */
    function send(t, then) {
      const k = KIND[t.k](t.src, t.k === 'arp' ? t.who : t.dst);
      ctx.read('Dernière trame', k.info.nom);
      envoi(l2, net, links, t.src, t.dst, {
        couleur: k.c, info: k.info,
        onSwitch: (s, r, port) => {
          sw.userData.led(port, 0xffb020);
          hl.clear(); hl.add(l2.hosts.get(t.src).mac); drawTable();
          const d = r.decision === 'diffusion' ? `diffusion : recopiée sur les ports ${r.out.map((n) => n + 1).join(', ')}` : r.decision === 'connue' ? `destination connue : port ${r.out.map((n) => n + 1).join(', ')} seulement` : `destination inconnue : inondation sur les ports ${r.out.map((n) => n + 1).join(', ')}`;
          ctx.read('Décision du commutateur', `${r.learned ? `appris : ${HOSTS.find((x) => x.id === t.src).name} derrière le port ${port + 1}. ` : ''}${d}`);
          ctx.say(`SW-VISION, port ${port + 1} : ${d}.`);
        },
        onHost: (id, garde) => (t.k === 'arp' ? flash(id, id === t.who, id === t.who ? 'c\'est moi : je réponds' : 'reçue, pas pour moi') : flash(id, garde, garde ? 'pour moi' : 'pas pour moi : jetée')),
        onDone: () => { for (let p = 0; p < 6; p++) sw.userData.led(p, 0x3fcf6e); if (then) then(); },
      });
    }
    /** rejoue en silence les étapes d'avant (table seule), puis anime l'étape i */
    function scene(i) {
      net.clear(); l2.clearTables();
      for (let s = 1; s < i; s++) for (const t of SCENES[s]) { const h = l2.hosts.get(t.src); l2.forward('SW', h.port, h.mac, t.dst, 0); }
      hl.clear(); drawTable();
      const seq = [...SCENES[i]];
      const next = () => { const t = seq.shift(); if (t && alive) send(t, () => setTimeout(next, 400)); };
      next();
    }
    let ui = null, alive = true;
    return {
      dispose() { alive = false; },
      etape(i) { scene(i); },
      update(dt) {
        if (flashT > 0) { flashT -= dt; if (flashT <= 0) for (const id of Object.keys(lamps)) { /** @type {any} */ (lamps[id].material).color.set(0x2a3138); tags[id].show(false); } }
      },
      commandes() {
        const opts = HOSTS.map((h) => el('option', { value: h.id }, h.name));
        const a = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': 'Machine qui envoie' }, ...opts.map((x) => x.cloneNode(true))));
        const b = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': 'Machine destinataire' }, ...opts.map((x) => x.cloneNode(true)))); b.value = 'pc';
        ui = el('div', { class: 'v3-ctl' },
          el('div', { class: 'v3-row' }, el('span', {}, 'Trame :'), a, el('span', {}, '→'), b,
            el('button', { type: 'button', class: 'btn small primary', onclick: () => { if (a.value === b.value) { ctx.say('Une machine ne s\'envoie pas de trame à elle-même par le commutateur.'); return; } send({ src: a.value, dst: H[b.value].mac, k: 'cmd' }); } }, 'Envoyer'),
            el('button', { type: 'button', class: 'btn small', onclick: () => send({ src: a.value, dst: DIFFUSION, k: 'arp', who: b.value }) }, 'Diffusion ARP')),
          el('div', { class: 'v3-row' },
            el('button', { type: 'button', class: 'btn small', onclick: () => { l2.clearTables(); hl.clear(); drawTable(); ctx.say('Table vidée (comme après un redémarrage) : la prochaine trame vers une machine inconnue sera recopiée partout.'); } }, 'Vider la table'),
            el('button', { type: 'button', class: 'btn small', onclick: () => moveCcu2() }, 'Rebrancher la CCU 2 sur le port 6')));
        return ui;
      },
    };
    /** la CCU 2 change de port : la table garde l'ancien jusqu'à sa première trame */
    function moveCcu2() {
      const h = l2.hosts.get('ccu2'); if (h.port === spare.port) { ctx.say('La CCU 2 est déjà sur le port 6.'); return; }
      const old = h.port;
      const L = links.get(`SW:${old}`).L; root.remove(L.mesh); links.delete(`SW:${old}`);
      l2.sw.get('SW').ports.get(old).peer = undefined;
      h.port = spare.port; spare.port = old; l2.sw.get('SW').ports.get(h.port).peer = { host: 'ccu2' };
      const N = net.relie({ obj: objs.ccu2 }, { obj: sw, i: h.port }, { couleur: 0x5f7f9f });
      links.set(`SW:${h.port}`, { L: N, versSw: 1 });
      ctx.say(`CCU 2 rebranchée sur le port ${h.port + 1}. La table dit encore « port ${old + 1} » : elle se corrige dès que la CCU 2 envoie une trame.`);
      setTimeout(() => { if (alive) send({ src: 'ccu2', dst: DIFFUSION, k: 'arp', who: 'rcp2' }); }, 900);
    }
  },
};
