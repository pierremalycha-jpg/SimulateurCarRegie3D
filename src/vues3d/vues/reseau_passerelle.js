// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { MACHINES, trajet, reseauDe } from '../../cours/reseau_routage.js';
import { COUL, zone, texte, eclat, piece } from '../kit.js';
import { appareil, commutateur, Reseau } from '../materiel.js';

// ----------------------------------------------------------------------------------
// Vue 3D « La passerelle : un pont entre deux réseaux » : deux îlots, le VLAN 20 des caméras et le VLAN 60
// des fichiers, chacun avec son commutateur ; entre eux, au sommet d'une passerelle (au sens propre),
// le routeur SW-CŒUR et ses deux interfaces 10.1.20.1 et 10.1.60.1. Un paquet vers un voisin reste sur son
// îlot ; vers l'autre réseau, il monte au routeur, change d'enveloppe (couleur, TTL 64 → 63) et redescend.
// Pannes : passerelle absente, masque trop large ; traceroute. Décision : cours/reseau_routage.js.
// ----------------------------------------------------------------------------------
const A = -3.3, B = 3.3; // centres des deux îlots
const VA = 0xffb020, VB = 0x4cc3e6, K_ARP = 0xffd38a, K_ICMP = 0xff6a5a;

export const VUE_RESEAU_PASSERELLE = {
  id: 'reseau-passerelle', chapitre: 'reseau', titre: 'La passerelle : un pont entre deux réseaux',
  resume: 'Deux îlots, deux sous-réseaux ; au sommet de la passerelle, le routeur. Le paquet pour un voisin reste chez lui, l\'autre monte, change d\'enveloppe et redescend.',
  lecons: ['reseau-routage', 'reseau-ip'],
  lectures: ['Paquet', 'Décision', 'Chemin', 'TTL à l\'arrivée'],
  depart: 'Chaque îlot est un sous-réseau (un VLAN). Le routeur est le seul passage entre les deux.',
  vue: { cible: [0, 1.0, 0.3], dir: [0, 0.5, 1], dist: 11 },
  orbite: { rMin: 1.5, rMax: 22 },
  etapes: [
    { t: 'Deux réseaux et une passerelle', vue: { cible: [0, 1.0, 0.3], dir: [0, 0.5, 1], dist: 11 },
      texte: `À gauche, le **VLAN 20** des caméras (10.1.20.0/24) : le RCP 1 et la CCU 1. À droite, le **VLAN 60** des fichiers (10.1.60.0/24) : le NAS et le PC de supervision. Chaque îlot a son commutateur ; aucune trame ne passe de l'un à l'autre.

Au sommet de la passerelle, le **routeur** (SW-CŒUR, commutateur de niveau 3) a **une adresse dans chaque réseau** : 10.1.20.1 côté caméras, 10.1.60.1 côté fichiers. C'est la **passerelle** de chaque îlot.` },
    { t: 'Même réseau : en direct', envoi: ['rcp1', 'ccu1'], vue: { cible: [A, 0.9, 0.4], dir: [0, 0.5, 1], dist: 6 },
      texte: `Le RCP 1 (10.1.20.31/24) commande la CCU 1 (10.1.20.11). Il applique **son masque** aux deux adresses : 10.1.20.0 des deux côtés, c'est un **voisin**.

Il demande la MAC de la CCU par ARP, puis la trame va **directement** par le commutateur de l'îlot. Le routeur n'est pas dérangé.` },
    { t: 'Autre réseau : par la passerelle', envoi: ['rcp1', 'nas'], vue: { cible: [0, 1.4, 0.3], dir: [0, 0.45, 1], dist: 9 },
      texte: `Le RCP 1 envoie ses fichiers de scène au NAS (10.1.60.20). À travers le masque /24 : 10.1.60.0, pas 10.1.20.0. **Ce n'est pas un voisin** : le paquet est confié à la passerelle 10.1.20.1.

La trame (jaune) monte au routeur, adressée à **sa** MAC. Le routeur lit l'IP de destination, trouve la route vers 10.1.60.0/24, **décrémente le TTL** (64 → 63) et refait l'enveloppe (bleue) pour l'autre îlot. Les adresses IP n'ont pas changé.` },
    { t: 'La réponse refait le chemin', envoi: ['nas', 'rcp1'], vue: { cible: [0, 1.4, 0.3], dir: [0, 0.45, 1], dist: 9 },
      texte: `Le NAS répond. Le retour est **indépendant** de l'aller : le NAS applique son propre masque, voit que 10.1.20.31 n'est pas un voisin, et passe par **sa** passerelle, 10.1.60.1.

C'est pourquoi une passerelle fausse d'un seul côté donne un aller qui arrive et une réponse qui se perd : le ping « part » mais ne revient pas.` },
    { t: 'Panne : pas de passerelle', panne: { passerelle: false }, envoi: ['rcp1', 'nas'], vue: { cible: [A, 1.0, 0.4], dir: [0.1, 0.45, 1], dist: 6.5 },
      texte: `Le RCP 1 n'a plus de passerelle. Vers la CCU 1, rien ne change : c'est un voisin. Vers le NAS, il ne sait **à qui confier** le paquet : « destination injoignable », rien ne part.

Signature de la panne : tout ce qui est local marche, tout ce qui est au-delà échoue (supervision, heure NTP, fichiers). Essaie les deux envois depuis « À toi ».` },
    { t: 'Panne : un masque trop large', panne: { masque: 16 }, envoi: ['rcp1', 'nas'], vue: { cible: [A, 1.0, 0.4], dir: [0.1, 0.45, 1], dist: 6.5 },
      texte: `Le RCP 1 a reçu un masque **/16**. Vu en /16, 10.1.60.20 et 10.1.20.31 sont dans le même réseau, 10.1.0.0 : le RCP croit le NAS **voisin** et l'appelle par ARP… dans son îlot. La diffusion reste dans le VLAN 20 ; le NAS ne l'entend jamais, personne ne répond.

Le masque se règle dans chaque machine, comme l'adresse et la passerelle : c'est pourquoi le plan d'adresses est écrit avant l'installation.` },
    { t: 'traceroute : où s\'arrête le chemin', trace: true, vue: { cible: [0, 1.4, 0.3], dir: [0, 0.45, 1], dist: 9 },
      texte: `**traceroute** envoie des paquets au TTL croissant. Le premier (TTL 1) meurt au premier routeur, qui renvoie un message ICMP « temps dépassé » (rouge) : on connaît le premier saut, 10.1.20.1. Le second (TTL 2) passe le routeur et arrive au NAS.

Quand une liaison est coupée, le dernier routeur qui répond dit **où** chercher. Dans le car SDI, le chemin le plus long n'a qu'un routeur ; dans un car IP, un flux passe leaf, spine, leaf.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { masque: 24, passerelle: true };
    // les îlots et la passerelle
    const deck = piece('îlots', 'beton', (b) => {
      b.cbox(4.2, 0.2, 3.4, A, 0.1, 0.2, 0x3a4048, 0.04); b.cbox(4.2, 0.2, 3.4, B, 0.1, 0.2, 0x3a4048, 0.04);
    });
    root.add(deck);
    const arc = new THREE.Group(); root.add(arc);
    const N = 18;
    const pathY = (t) => 0.2 + Math.sin(Math.PI * t) * 1.15;
    const deckB = piece('passerelle', 'alu', (b) => {
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N, x0 = A + 2.1 + t0 * (B - A - 4.2), x1 = A + 2.1 + t1 * (B - A - 4.2);
        const y0 = pathY(t0), y1 = pathY(t1), len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
        b.cbox(len + 0.02, 0.06, 1.0, (x0 + x1) / 2, (y0 + y1) / 2, 0.2, 0x8a939c, 0.01, 0, 0, ang);
        for (const z of [-0.28, 0.68]) b.rod([x0, y0, z], [x0, y0 + 0.45, z], 0.012, 0x6a737c, 6);
      }
      for (const z of [-0.28, 0.68]) for (let i = 0; i < N; i++) { const t0 = i / N, t1 = (i + 1) / N, x0 = A + 2.1 + t0 * (B - A - 4.2), x1 = A + 2.1 + t1 * (B - A - 4.2); b.rod([x0, pathY(t0) + 0.45, z], [x1, pathY(t1) + 0.45, z], 0.015, 0x6a737c, 6); }
    }, { mat: { metalness: 0.7, roughness: 0.4 } });
    deckB.userData.info = { nom: 'La passerelle', texte: 'Le seul passage entre les deux îlots : tout ce qui change de sous-réseau monte au routeur.' };
    root.add(deckB);
    const za = zone(4.1, 1.7, 3.3, VA, { opacity: 0.06 }); za.position.set(A, 1.05, 0.2); root.add(za);
    const zb = zone(4.1, 1.7, 3.3, VB, { opacity: 0.06 }); zb.position.set(B, 1.05, 0.2); root.add(zb);
    for (const z of [za, zb]) { z.userData.fill.userData.passe = true; z.userData.edges.userData.passe = true; }
    const ta = texte('VLAN 20 · caméras · 10.1.20.0/24', { h: 0.12, color: '#ffd38a', bg: 'rgba(12,16,20,.8)' }); ta.position.set(A, 2.05, -1.42); root.add(ta);
    const tb = texte('VLAN 60 · fichiers · 10.1.60.0/24', { h: 0.12, color: '#8fd6ea', bg: 'rgba(12,16,20,.8)' }); tb.position.set(B, 2.05, -1.42); root.add(tb);
    // le matériel
    const swA = commutateur('SW-VISION', 4, { pied: 0.75 }); swA.position.set(A, 0.2, -0.9); root.add(swA);
    const swB = commutateur('SW-FICHIERS', 4, { pied: 0.75 }); swB.position.set(B, 0.2, -0.9); root.add(swB);
    const rt = commutateur('SW-CŒUR · routeur', 2, { routeur: true, pied: 0.55, info: { nom: 'Le routeur (SW-CŒUR, niveau 3)', texte: 'Une interface (SVI) dans chaque VLAN : Vlan20 10.1.20.1/24 et Vlan60 10.1.60.1/24. Sa table de routage : 10.1.20.0/24 et 10.1.60.0/24, directement connectés.' } });
    rt.position.set(0, pathY(0.5), -0.1); root.add(rt);
    ctx.label(rt, '10.1.20.1', { off: [-0.55, 1.05, 0.3], cls: 'small' }); ctx.label(rt, '10.1.60.1', { off: [0.55, 1.05, 0.3], cls: 'small' });
    const pos = { rcp1: [A - 1.0, 1.1], ccu1: [A + 0.9, 1.1], nas: [B - 0.9, 1.1], sup: [B + 1.0, 1.1] };
    const type = { rcp1: 'rcp', ccu1: 'ccu', nas: 'serveur', sup: 'pc' };
    const objs = {}, marks = {};
    for (const [id, m] of Object.entries(MACHINES)) {
      const o = appareil(type[id], m.nom, { info: () => ({ nom: `${m.nom} · ${m.ip}`, texte: `Masque /${id === 'rcp1' ? S.masque : 24} · passerelle ${id === 'rcp1' && !S.passerelle ? 'aucune' : reseauDe(m.ip, 24).replace(/\.0$/, '.1')} · VLAN ${m.vlan}.` }) });
      o.position.set(pos[id][0], 0.2, pos[id][1]); root.add(o); objs[id] = o;
      const mk = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 10), eclat(0x2a3138)); mk.position.set(0, o.userData.top + 0.12, 0); o.add(mk); marks[id] = mk;
      ctx.label(o, m.ip, { off: [0, o.userData.top + 0.32, 0], cls: 'small' });
    }
    const net = new Reseau(ctx, root);
    const L = {
      rcp1: net.relie({ obj: objs.rcp1 }, { obj: swA, i: 0 }, { couleur: VA, sag: 0.4 }), ccu1: net.relie({ obj: objs.ccu1 }, { obj: swA, i: 1 }, { couleur: VA, sag: 0.4 }),
      nas: net.relie({ obj: objs.nas }, { obj: swB, i: 0 }, { couleur: VB, sag: 0.4 }), sup: net.relie({ obj: objs.sup }, { obj: swB, i: 1 }, { couleur: VB, sag: 0.4 }),
      ra: net.relie({ obj: rt, i: 0 }, { obj: swA, i: 3 }, { couleur: VA, sag: 0.1, info: { nom: 'Interface Vlan20 du routeur', texte: '10.1.20.1/24 : la passerelle des machines du VLAN 20.' } }),
      rb: net.relie({ obj: rt, i: 1 }, { obj: swB, i: 3 }, { couleur: VB, sag: 0.1, info: { nom: 'Interface Vlan60 du routeur', texte: '10.1.60.1/24 : la passerelle des machines du VLAN 60.' } }),
    };
    const side = (id) => (MACHINES[id].vlan === 20 ? 'a' : 'b');
    const upTo = (id) => [[L[id], 1], [side(id) === 'a' ? L.ra : L.rb, -1]]; // machine → commutateur → routeur
    const downTo = (id) => [[side(id) === 'a' ? L.ra : L.rb, 1], [L[id], -1]]; // routeur → commutateur → machine
    let lampT = 0;
    const lamp = (id, c) => { /** @type {any} */ (marks[id].material).color.set(c); lampT = 2.5; };
    function send(src, dst, then) {
      const r = trajet(src, dst, { masque: src === 'rcp1' ? S.masque : 24, passerelle: src === 'rcp1' ? S.passerelle : true });
      const D = MACHINES[dst], Sm = MACHINES[src];
      ctx.read('Paquet', `${Sm.nom} (${Sm.ip}) → ${D.nom} (${D.ip})`);
      ctx.read('Décision', r.etapes[0] + (r.local ? ' Voisin.' : ' Pas un voisin.'));
      ctx.read('Chemin', '…'); ctx.read('TTL à l\'arrivée', '…');
      const env1 = { nom: `Trame de ${Sm.nom}`, texte: `IP ${Sm.ip} → ${D.ip} · MAC destination : ${r.chemin === 'routeur' ? 'le routeur (sa passerelle)' : D.nom} · TTL 64.` };
      if (r.chemin === 'direct') {
        net.chemin([[L[src], 1], [L[dst], -1]], { couleur: side(src) === 'a' ? VA : VB, info: env1, onEnd: () => { lamp(dst, COUL.vert); ctx.read('Chemin', 'direct, par le commutateur de l\'îlot'); ctx.read('TTL à l\'arrivée', '64 (aucun routeur traversé)'); ctx.say(r.etapes.slice(1).join(' ')); if (then) then(); } });
      } else if (r.chemin === 'routeur') {
        net.chemin(upTo(src), { couleur: side(src) === 'a' ? VA : VB, info: env1, onEnd: () => {
          ctx.say('Au routeur : nouvelle enveloppe Ethernet, TTL 64 → 63.');
          const env2 = { nom: 'Le même paquet, nouvelle enveloppe', texte: `IP ${Sm.ip} → ${D.ip} (inchangées) · MAC source : le routeur · MAC destination : ${D.nom} · TTL 63.` };
          net.chemin(downTo(dst), { couleur: side(dst) === 'a' ? VA : VB, info: env2, taille: [0.12, 0.075, 0.075], onEnd: () => { lamp(dst, COUL.vert); ctx.read('Chemin', `par la passerelle ${reseauDe(Sm.ip, 24).replace(/\.0$/, '.1')}, un routeur`); ctx.read('TTL à l\'arrivée', '63'); ctx.say(r.etapes.slice(1).join(' ')); if (then) then(); } });
        } });
      } else if (r.chemin === 'sans-passerelle') {
        lamp(src, COUL.rouge); ctx.read('Chemin', 'aucun : rien ne part'); ctx.read('TTL à l\'arrivée', '—'); ctx.say(r.etapes[1]); if (then) then();
      } else {
        // masque trop large : une question ARP qui reste sur l'îlot, sans réponse
        net.trame(L[src], 1, { couleur: K_ARP, info: { nom: `ARP : qui a ${D.ip} ?`, texte: 'Diffusion dans le VLAN 20 seulement : le NAS ne l\'entendra jamais.' }, onEnd: () => {
          net.trame(L.ccu1, -1, { couleur: K_ARP, onEnd: () => lamp('ccu1', 0x8a949c) });
          net.trame(L.ra, -1, { couleur: K_ARP, onEnd: () => { lamp(src, COUL.rouge); ctx.read('Chemin', 'question ARP restée dans le VLAN 20 : pas de réponse'); ctx.read('TTL à l\'arrivée', '—'); ctx.say(r.etapes.slice(1).join(' ')); if (then) then(); } });
        } });
      }
    }
    function traceroute() {
      ctx.read('Paquet', 'traceroute 10.1.60.20 depuis le RCP 1');
      ctx.read('Décision', 'TTL 1, puis TTL 2…');
      // TTL 1 : meurt au routeur, qui renvoie « temps dépassé »
      net.chemin(upTo('rcp1'), { couleur: VA, info: { nom: 'Sonde TTL 1', texte: 'Le premier routeur la détruit (TTL 1 → 0) et répond par ICMP « temps dépassé ».' }, onEnd: () => {
        ctx.say('Saut 1 : 10.1.20.1 répond « temps dépassé » (le TTL est tombé à 0).');
        net.chemin([[L.ra, 1], [L.rcp1, -1]], { couleur: K_ICMP, info: { nom: 'ICMP « temps dépassé »', texte: 'Envoyé par 10.1.20.1 : le routeur se signale, c\'est le premier saut.' }, onEnd: () => {
          // TTL 2 : passe et arrive
          send('rcp1', 'nas', () => { ctx.read('Chemin', '1 : 10.1.20.1 · 2 : 10.1.60.20 (arrivé)'); ctx.say('Saut 2 : 10.1.60.20, la destination. Deux sauts, un routeur.'); });
        } });
      } });
    }
    let alive = true, ui = null;
    const sync = () => { if (!ui) return; for (const b of ui.querySelectorAll('[data-k]')) { const k = /** @type {HTMLElement} */ (b).dataset.k; b.setAttribute('aria-pressed', String(k === 'gw' ? !S.passerelle : S.masque === 16)); } };
    return {
      dispose() { alive = false; },
      update(dt) { if (lampT > 0) { lampT -= dt; if (lampT <= 0) for (const m of Object.values(marks)) /** @type {any} */ (m.material).color.set(0x2a3138); } },
      etape(i, E) {
        S.masque = (E.panne && E.panne.masque) || 24; S.passerelle = !(E.panne && E.panne.passerelle === false); sync();
        net.clear();
        if (E.envoi) setTimeout(() => { if (alive) send(E.envoi[0], E.envoi[1]); }, 700);
        if (E.trace) setTimeout(() => { if (alive) traceroute(); }, 700);
      },
      commandes() {
        const opt = Object.entries(MACHINES).map(([k, m]) => el('option', { value: k }, `${m.nom} (${m.ip})`));
        const a = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': 'Qui envoie' }, ...opt.map((x) => x.cloneNode(true))));
        const b = /** @type {HTMLSelectElement} */ (el('select', { 'aria-label': 'Vers' }, ...opt.map((x) => x.cloneNode(true)))); b.value = 'nas';
        ui = el('div', { class: 'v3-ctl' },
          el('div', { class: 'v3-row' }, el('span', {}, 'Paquet :'), a, el('span', {}, '→'), b, el('button', { type: 'button', class: 'btn small primary', onclick: () => { if (a.value === b.value) { ctx.say('Choisis deux machines différentes.'); return; } send(a.value, b.value); } }, 'Envoyer')),
          el('div', { class: 'v3-row' }, el('span', {}, 'Pannes du RCP 1 :'),
            el('button', { type: 'button', class: 'btn small', 'data-k': 'gw', 'aria-pressed': 'false', onclick: () => { S.passerelle = !S.passerelle; sync(); ctx.say(S.passerelle ? 'Passerelle du RCP 1 rétablie : 10.1.20.1.' : 'Le RCP 1 n\'a plus de passerelle.'); } }, 'sans passerelle'),
            el('button', { type: 'button', class: 'btn small', 'data-k': 'mask', 'aria-pressed': 'false', onclick: () => { S.masque = S.masque === 24 ? 16 : 24; sync(); ctx.say(`Masque du RCP 1 : /${S.masque}.`); } }, 'masque /16')),
          el('div', { class: 'v3-row' }, el('button', { type: 'button', class: 'btn small', onclick: () => traceroute() }, 'traceroute RCP 1 → NAS')));
        return ui;
      },
    };
  },
};
