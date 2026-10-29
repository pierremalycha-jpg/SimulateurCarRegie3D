// @ts-check
import { el } from '../../util.js';
import { zone, texte } from '../kit.js';
import { appareil, commutateur, Reseau } from '../materiel.js';
import { L2, DIFFUSION } from '../l2.js';
import { envoi } from '../l2anim.js';

// ----------------------------------------------------------------------------------
// Vue 3D « VLAN : des réseaux dans le réseau » : deux commutateurs du car SDI (SW-CŒUR, SW-VISION) reliés
// par un trunk, et des machines regroupées par usage. Chaque VLAN est une zone de couleur : une diffusion
// n'en sort pas, sauf par le trunk, étiquetée (802.1Q), vers les machines du même VLAN de l'autre côté.
// Trois réglages montrent l'intérêt et les pannes : sans VLAN, un port dans le mauvais VLAN, un VLAN
// oublié sur le trunk. Plan des VLAN : celui de la leçon (cours/reseau.js) et du poste Réseau.
// ----------------------------------------------------------------------------------
const VLANS = {
  1: { nom: 'un seul réseau', col: 0xd8dce0, net: '10.1.0.0/16' },
  10: { nom: 'Gestion', col: 0x9aa4ad, net: '10.1.10.0/24' },
  20: { nom: 'Caméras', col: 0xffb020, net: '10.1.20.0/24' },
  30: { nom: 'Production', col: 0x3fcf6e, net: '10.1.30.0/24' },
  50: { nom: 'Intercom', col: 0x4cc3e6, net: '10.1.50.0/24' },
  90: { nom: 'Invités', col: 0x9a7bff, net: '10.1.90.0/24' },
};
// machines : type, nom, commutateur, port, VLAN prévu, position x au sol
const M = [
  { id: 'pc', type: 'pc', nom: 'PC supervision', sw: 'COEUR', p: 5, v: 10, x: -4.7 },
  { id: 'mel', type: 'melangeur', nom: 'Mélangeur', sw: 'COEUR', p: 1, v: 30, x: -3.65 },
  { id: 'gri', type: 'serveur', nom: 'Grille', sw: 'COEUR', p: 2, v: 30, x: -2.85 },
  { id: 'pan', type: 'intercom', nom: 'Panneau intercom', sw: 'COEUR', p: 3, v: 50, x: -1.7 },
  { id: 'mat', type: 'serveur', nom: 'Matrice intercom', sw: 'COEUR', p: 4, v: 50, x: -0.9 },
  { id: 'rcp2', type: 'rcp', nom: 'RCP 2', sw: 'COEUR', p: 0, v: 20, x: 0.3 },
  { id: 'ccu1', type: 'ccu', nom: 'CCU 1', sw: 'VISION', p: 0, v: 20, x: 1.15 },
  { id: 'rcp1', type: 'rcp', nom: 'RCP 1', sw: 'VISION', p: 1, v: 20, x: 1.95 },
  { id: 'ccu2', type: 'ccu', nom: 'CCU 2', sw: 'VISION', p: 2, v: 20, x: 2.75 },
  { id: 'inv', type: 'portable', nom: 'Portable invité', sw: 'VISION', p: 4, v: 90, x: 4.3 },
];
const TRUNK = 7;
const mac = (i) => `02:1A:00:00:00:${String(i + 10).padStart(2, '0')}`;

export const VUE_RESEAU_VLAN = {
  id: 'reseau-vlan', chapitre: 'reseau', titre: 'VLAN : des réseaux dans le réseau',
  resume: 'Deux commutateurs, dix machines rangées par usage : chaque VLAN est une zone dont la diffusion ne sort pas, sauf étiquetée par le trunk.',
  lecons: ['reseau-vlan'],
  lectures: ['Réglage', 'Dernière diffusion', 'Reçue par'],
  depart: 'Chaque couleur est un VLAN. Envoie une diffusion depuis n\'importe quelle machine (« À toi »).',
  vue: { cible: [-0.2, 0.9, 0.2], dir: [0, 0.6, 1], dist: 12.8 },
  orbite: { rMin: 1.5, rMax: 20 },
  etapes: [
    { t: 'Un réseau, plusieurs VLAN', reglage: 'normal', vue: { cible: [-0.2, 0.9, 0.2], dir: [0, 0.6, 1], dist: 12.8 },
      texte: `Dans le car, un seul ensemble de commutateurs porte plusieurs **réseaux virtuels** (VLAN, IEEE 802.1Q) : gestion (10), caméras (20), production (30), intercom (50), invités (90). Chaque zone de couleur en est un.

Le VLAN se règle **sur le port du commutateur**, pas dans la machine : un port **access** appartient à un seul VLAN, et la machine branchée n'en sait rien. Chaque VLAN a son propre plan d'adresses (10.1.20.0/24 pour les caméras…).` },
    { t: 'La diffusion reste dans son VLAN', reglage: 'normal', envoi: 'ccu1', vue: { cible: [0.8, 0.9, 0.2], dir: [0, 0.55, 1], dist: 9.5 },
      texte: `La CCU 1 envoie une **diffusion** (une question ARP). Le commutateur la recopie… mais seulement sur les ports du **VLAN 20** : le RCP 1 et la CCU 2, et le **trunk** vers SW-CŒUR, qui la remet au RCP 2.

Le mélangeur, l'intercom, le portable de l'invité n'en voient rien : chaque VLAN est un **domaine de diffusion** à part. Une machine bavarde, une boucle ou un virus dans un VLAN ne gênent pas les autres.` },
    { t: 'Le trunk et son étiquette', reglage: 'normal', envoi: 'rcp2', vue: { cible: [0, 1.0, -1.2], dir: [0.05, 0.45, 1], dist: 6.2 },
      texte: `Entre les deux commutateurs, un seul câble porte tous les VLAN : c'est un port **trunk**. Chaque trame y reçoit une **étiquette 802.1Q** de 4 octets, glissée après les adresses MAC : le numéro de VLAN (12 bits, jusqu'à 4 094) et une priorité (3 bits, la classe de service).

La trame étiquetée est plus grosse et prend la couleur de son VLAN : le commutateur d'en face lit l'étiquette, la retire et remet la trame dans le bon VLAN.` },
    { t: 'Sans VLAN : tout le monde entend tout', reglage: 'plat', envoi: 'inv', vue: { cible: [-0.2, 0.9, 0.2], dir: [0, 0.6, 1], dist: 12.8 },
      texte: `Sans VLAN, toutes les machines sont dans le même réseau. La diffusion du **portable de l'invité** atteint les CCU, la grille, l'intercom : tout le monde l'entend, et l'invité peut chercher à joindre n'importe quelle machine.

Sur un car de 80 machines, les diffusions se multiplient, une boucle paralyse tout, et rien n'empêche un portable d'atteindre une CCU. D'où le découpage : **la panne reste chez elle**, la **priorité** se règle par usage (la voix de l'intercom passe devant les fichiers), et la **sécurité** se joue entre VLAN, au routeur.` },
    { t: 'Panne : un port dans le mauvais VLAN', reglage: 'mauvais', envoi: 'rcp1', vue: { cible: [-0.6, 0.9, 0.2], dir: [0, 0.55, 1], dist: 9.5 },
      texte: `Le RCP 1 est branché sur un port réglé en **VLAN 30**. Son voyant est allumé, son câble est bon… mais sa question ARP pour la CCU 1 part chez le **mélangeur et la grille**, dans la production. La CCU 1 ne l'entend jamais : le RCP ne commande plus sa caméra.

C'est la panne qui ressemble à un câble coupé, alors que le niveau physique est parfait. On la trouve en lisant le VLAN du port sur le commutateur (\`show interfaces status\`), pas dans la machine.` },
    { t: 'Panne : un VLAN oublié sur le trunk', reglage: 'trunk', envoi: 'rcp2', vue: { cible: [0.8, 0.9, 0.2], dir: [0, 0.55, 1], dist: 9.5 },
      texte: `La liste des **VLAN autorisés** du trunk a oublié le **20**. Le RCP 2, sur SW-CŒUR, appelle les CCU : sa diffusion arrive au trunk et s'y arrête. Toutes les machines du VLAN 20 de l'autre commutateur disparaissent **d'un coup**, alors que les autres VLAN passent toujours.

Symptôme typique : tout un usage tombe sur un seul commutateur, les autres fonctionnent. On vérifie \`show interfaces trunk\` des deux côtés.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const sws = { COEUR: commutateur('SW-CŒUR', 8, { info: { nom: 'SW-CŒUR', texte: 'Le commutateur central de la baie technique : il route aussi entre VLAN (passerelles 10.1.x.1).' } }), VISION: commutateur('SW-VISION', 8, { info: { nom: 'SW-VISION', texte: 'Le commutateur de la régie vision : CCU, RCP, et le portable de l\'invité.' } }) };
    sws.COEUR.position.set(-1.9, 0, -1.6); sws.VISION.position.set(1.9, 0, -1.6); root.add(sws.COEUR, sws.VISION);
    const net = new Reseau(ctx, root);
    const objs = {}, links = new Map(), tags = {};
    M.forEach((m, i) => {
      const o = appareil(m.type, m.nom, { info: () => ({ nom: m.nom, texte: `Branchée sur le port ${m.p + 1} de ${m.sw === 'COEUR' ? 'SW-CŒUR' : 'SW-VISION'}, réglé en VLAN ${S.portV(m)} ${S.portV(m) !== m.v ? `(prévu : VLAN ${m.v})` : ''}. Adresse MAC ${mac(i)}.` }) });
      o.position.set(m.x, 0, 1.0); root.add(o); objs[m.id] = o;
      tags[m.id] = ctx.label(o, '', { off: [0, o.userData.top + 0.18, 0], cls: 'small' }); tags[m.id].show(false);
    });
    // les zones : une par VLAN, autour de ses machines
    const zones = {};
    for (const v of [10, 20, 30, 50, 90]) {
      const ms = M.filter((m) => m.v === v); const x0 = Math.min(...ms.map((m) => m.x)) - 0.42, x1 = Math.max(...ms.map((m) => m.x)) + 0.42;
      const z = zone(x1 - x0, 1.5, 1.2, VLANS[v].col, { opacity: 0.09 }); z.position.set((x0 + x1) / 2, 0.76, 1.0); z.userData.fill.userData.passe = true; z.userData.edges.userData.passe = true; root.add(z); zones[v] = z;
      const t = texte(`VLAN ${v} · ${VLANS[v].nom}`, { h: 0.11, color: '#' + VLANS[v].col.toString(16).padStart(6, '0'), bg: 'rgba(12,16,20,.8)' }); t.position.set((x0 + x1) / 2, 1.62, 1.62); root.add(t);
      zones[v].userData.titre = t;
    }
    const plat = zone(10.3, 1.5, 1.3, 0xd8dce0, { opacity: 0.07 }); plat.position.set(-0.2, 0.76, 1.0); plat.visible = false; root.add(plat);
    plat.userData.fill.userData.passe = true; plat.userData.edges.userData.passe = true;
    const S = {
      mode: 'normal',
      portV: (m) => (S.mode === 'plat' ? 1 : S.mode === 'mauvais' && m.id === 'rcp1' ? 30 : m.v),
      trunk: () => (S.mode === 'plat' ? [1] : S.mode === 'trunk' ? [10, 30, 50, 90] : [10, 20, 30, 50, 90]),
    };
    let l2 = new L2();
    const cables = [];
    function wire() {
      for (const c of cables) { root.remove(c.mesh); c.mesh.geometry.dispose(); }
      cables.length = 0; links.clear(); net.clear();
      l2 = new L2().addSwitch('COEUR').addSwitch('VISION');
      for (const s of ['COEUR', 'VISION']) for (let p = 0; p < 7; p++) l2.port(s, p, 0);
      l2.port('COEUR', TRUNK, 0, S.trunk()).port('VISION', TRUNK, 0, S.trunk()).trunk('COEUR', TRUNK, 'VISION', TRUNK);
      M.forEach((m, i) => {
        const v = S.portV(m);
        l2.sw.get(m.sw).ports.get(m.p).vlan = v;
        l2.addHost(m.id, mac(i), '', m.sw, m.p);
        const L = net.relie({ obj: objs[m.id] }, { obj: sws[m.sw], i: m.p }, { couleur: VLANS[v].col, sag: 0.5, info: { nom: `Port ${m.p + 1} de ${m.sw === 'COEUR' ? 'SW-CŒUR' : 'SW-VISION'} : access, VLAN ${v}`, texte: `La machine envoie des trames ordinaires ; c'est le port qui les range dans le VLAN ${v}.` } });
        cables.push(L); links.set(`${m.sw}:${m.p}`, { L, versSw: 1 });
        sws[m.sw].userData.led(m.p, VLANS[v].col);
        tags[m.id].set(v !== m.v ? `VLAN ${v} : mauvais VLAN` : ''); tags[m.id].show(v !== m.v && S.mode === 'mauvais');
      });
      const T = net.relie({ obj: sws.COEUR, i: TRUNK }, { obj: sws.VISION, i: TRUNK }, { couleur: 0xe8ece6, r: 0.026, sag: 0.35, info: { nom: 'Trunk 802.1Q', texte: `Un seul câble pour tous les VLAN : VLAN autorisés ${S.trunk().join(', ')}. Chaque trame y porte son étiquette.` } });
      cables.push(T); links.set(`COEUR:${TRUNK}`, { L: T, versSw: -1 }); links.set(`VISION:${TRUNK}`, { L: T, versSw: 1 });
      for (const s of Object.values(sws)) s.userData.led(TRUNK, 0xffffff);
      for (const [v, z] of Object.entries(zones)) { z.visible = S.mode !== 'plat'; z.userData.titre.visible = S.mode !== 'plat'; void v; }
      plat.visible = S.mode === 'plat';
      ctx.read('Réglage', { normal: 'chaque usage dans son VLAN', plat: 'sans VLAN : un seul réseau', mauvais: 'panne : RCP 1 sur un port du VLAN 30', trunk: 'panne : le trunk n\'autorise plus le VLAN 20' }[S.mode]);
    }
    const recus = new Set();
    function diffuse(id) {
      const m = M.find((x) => x.id === id), v = S.portV(m);
      recus.clear();
      ctx.read('Dernière diffusion', `${m.nom} (VLAN ${v}) : question ARP en diffusion`);
      ctx.read('Reçue par', '…');
      envoi(l2, net, links, id, DIFFUSION, {
        couleur: VLANS[v].col, info: { nom: `Diffusion de ${m.nom}`, texte: `Destination FF:FF:FF:FF:FF:FF : le commutateur la recopie sur les ports du VLAN ${v} et sur le trunk.` },
        vlanCol: (vv) => VLANS[vv].col,
        onSwitch: (sw, r) => { if (r.decision === 'filtrée') ctx.say(`Le trunk n'autorise pas le VLAN ${r.vlan} : la trame s'arrête à l'entrée de ${sw === 'COEUR' ? 'SW-CŒUR' : 'SW-VISION'}.`); },
        onHost: (h) => { recus.add(h); tags[h].set('reçue'); tags[h].show(true); },
        onDone: () => {
          const names = [...recus].map((h) => M.find((x) => x.id === h).nom);
          ctx.read('Reçue par', names.length ? names.join(', ') : 'personne');
          ctx.say(`Diffusion de ${m.nom} : reçue par ${names.length ? names.join(', ') : 'personne'}. ${S.mode === 'plat' ? 'Sans VLAN, tout le monde l\'entend.' : `Seul le VLAN ${v} l'a reçue.`}`);
          setTimeout(() => { if (!alive) return; for (const k of Object.keys(tags)) { const mm = M.find((x) => x.id === k); tags[k].set(S.portV(mm) !== mm.v ? `VLAN ${S.portV(mm)} : mauvais VLAN` : ''); tags[k].show(S.portV(mm) !== mm.v && S.mode === 'mauvais'); } }, 2500);
        },
      });
    }
    let alive = true, ui = null;
    wire();
    const sync = () => { if (ui) for (const b of ui.querySelectorAll('[data-m]')) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.m === S.mode)); };
    return {
      dispose() { alive = false; },
      etape(i, E) {
        S.mode = E.reglage || 'normal'; wire(); sync();
        if (E.envoi) setTimeout(() => { if (alive) diffuse(E.envoi); }, 700);
      },
      commandes() {
        const sel = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': 'Machine qui envoie la diffusion' }, ...M.map((m) => el('option', { value: m.id }, m.nom))));
        sel.value = 'ccu1';
        ui = el('div', { class: 'v3-ctl' },
          el('div', { class: 'v3-row' }, el('span', {}, 'Diffusion depuis :'), sel, el('button', { type: 'button', class: 'btn small primary', onclick: () => diffuse(sel.value) }, 'Envoyer')),
          el('div', { class: 'v3-row' }, el('span', {}, 'Réglage :'),
            ...[['normal', 'VLAN par usage'], ['plat', 'sans VLAN'], ['mauvais', 'RCP 1 mal rangé'], ['trunk', 'VLAN 20 oublié']].map(([k, t]) => el('button', { type: 'button', class: 'btn small', 'data-m': k, 'aria-pressed': String(k === S.mode), onclick: () => { S.mode = k; wire(); sync(); ctx.say(`Réglage : ${t}.`); } }, t))));
        return ui;
      },
    };
  },
};
