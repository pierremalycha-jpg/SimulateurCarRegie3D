// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../../util.js';
import { fmtNum } from '../../cours/kit.js';
import { COUL, eclat, mat, verre } from '../kit.js';
import { appareil, commutateur, Reseau } from '../materiel.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Multicast et IGMP » : cinq caméras ST 2110 (2,2 Gb/s chacune, 1080p50) et quatre récepteurs sur
// une leaf. Chaque caméra envoie un seul flux vers son groupe ; le commutateur le recopie vers les
// récepteurs qui l'ont demandé par IGMP (abonnement visible). Des jauges montrent la charge de chaque
// lien. Trois modes : multicast avec snooping, sans snooping (tout partout, les ports à 10 Gb/s
// débordent), unicast (une copie par destinataire). Débits : ceux de la leçon (cours/reseau.js).
// ----------------------------------------------------------------------------------
const CAMS = [0, 1, 2, 3, 4].map((i) => ({ id: 'cam' + (i + 1), nom: `CAM ${i + 1}`, groupe: `239.1.1.${i + 1}`, src: `10.1.11.${i + 1}`, col: [0xffb020, 0x3fcf6e, 0x4c9cff, 0xff6fb1, 0xb07bff][i] }));
const RX = [
  { id: 'mel', type: 'melangeur', nom: 'Mélangeur', cap: 25 },
  { id: 'mv', type: 'multiview', nom: 'Multiview', cap: 10 },
  { id: 'evs', type: 'serveur', nom: 'Serveur ralenti', cap: 25 },
  { id: 'mon', type: 'moniteur', nom: 'Moniteur de contrôle', cap: 10 },
];
const DEBIT = 2.2; // Gb/s d'un flux ST 2110-20 1080p50 4:2:2 10 bits, en-têtes compris (ordre de grandeur)
const ABOS0 = { mel: ['cam1', 'cam2', 'cam3'], mv: ['cam1', 'cam2'], evs: ['cam1'], mon: [] };

export const VUE_RESEAU_MULTICAST = {
  id: 'reseau-multicast', chapitre: 'reseau', titre: 'Multicast et IGMP : un flux, plusieurs récepteurs',
  resume: 'Cinq caméras, quatre récepteurs : chaque flux part une seule fois et le commutateur le recopie vers ceux qui l\'ont demandé. Sans snooping, ou en unicast, les liens saturent.',
  lecons: ['reseau-multicast'],
  lectures: ['Mode', 'Liens des récepteurs', 'Liens des caméras', 'Dernier message IGMP'],
  depart: 'Chaque couleur est le flux d\'une caméra. Les jauges montrent la charge de chaque lien.',
  vue: { cible: [0, 1.0, 0.6], dir: [0, 0.5, 1], dist: 9.2 },
  orbite: { rMin: 1.5, rMax: 20 },
  etapes: [
    { t: 'Un flux, recopié par le commutateur', mode: 'mc', abos: ABOS0,
      texte: `Chaque caméra envoie **un seul flux** ST 2110-20 (de l'ordre de **2,2 Gb/s** en 1080p50) vers une adresse de **groupe** : 239.1.1.1 pour la CAM 1, 239.1.1.2 pour la CAM 2… Elle ne sait pas qui regarde.

Le commutateur **recopie** chaque flux vers les ports qui l'ont demandé : la CAM 1 part une fois, arrive au mélangeur, au multiview et au serveur ralenti. Le lien de la caméra ne porte qu'une copie, quel que soit le nombre de récepteurs.` },
    { t: 'S\'abonner : le rapport IGMP', mode: 'mc', abos: ABOS0, join: ['mon', 'cam1'], vue: { cible: [1.6, 1.0, 0.4], dir: [0.1, 0.5, 1], dist: 7 },
      texte: `Le moniteur de contrôle veut la CAM 1. Il envoie un **rapport IGMPv3** (la petite trame blanche) : « je veux le groupe 239.1.1.1, **envoyé par 10.1.11.1** ». C'est le couple **(S, G)**, la source et le groupe : en **SSM**, une autre machine qui émettrait par erreur vers le même groupe n'est pas reçue.

Le commutateur, qui fait de l'**IGMP snooping**, lit ce rapport et ajoute le port du moniteur à la liste du groupe : le flux arrive. Un rapport « leave » le retire. Dans le car IP, c'est le contrôleur NMOS qui fait abonner chaque entrée.` },
    { t: 'Pas d\'abonnement, pas de flux', mode: 'mc', abos: { ...ABOS0, mon: ['cam1'] }, vue: { cible: [0, 1.0, 0.6], dir: [0, 0.5, 1], dist: 9.2 },
      texte: `Les CAM 4 et 5 envoient leur flux au commutateur, mais **personne ne les a demandées** : rien ne sort vers les récepteurs. Le flux s'arrête à la leaf.

C'est la grande différence avec le SDI : il n'y a pas de câble par image. Une image n'arrive que là où elle est demandée, et un même lien peut porter plusieurs images (le mélangeur reçoit ici trois caméras sur un seul port à 25 Gb/s).` },
    { t: 'En unicast : une copie par destinataire', mode: 'uc', abos: { ...ABOS0, mon: ['cam1'] }, vue: { cible: [-1.5, 1.0, 0.4], dir: [-0.1, 0.55, 1], dist: 8.5 },
      texte: `En **unicast**, la CAM 1 devrait envoyer **une copie par destinataire** : quatre copies de 2,2 Gb/s, 8,8 Gb/s sur son seul lien, et elle devrait connaître chaque récepteur. À chaque nouveau moniteur, il faudrait la reconfigurer.

Le multicast renverse la logique : la source envoie une fois, le réseau recopie là où il faut, et chacun s'abonne ou se désabonne sans toucher à la source.` },
    { t: 'Sans snooping : tout partout', mode: 'flood', abos: { ...ABOS0, mon: ['cam1'] }, vue: { cible: [1.4, 1.0, 0.4], dir: [0.1, 0.5, 1], dist: 8.5 },
      texte: `Un commutateur **sans IGMP snooping** ne lit pas les rapports : il traite le multicast comme une **diffusion** et recopie **tous les flux sur tous les ports** du VLAN, demandés ou non.

Cinq caméras, 11 Gb/s : les ports à **10 Gb/s** (multiview, moniteur) **débordent**, perdent des paquets, et les images se figent ou se déchirent. Les caméras reçoivent même les flux des autres. C'est l'une des pannes du poste Réseau IP : « snooping désactivé ».` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { mode: 'mc', abos: structuredClone(ABOS0), igmp: '—' };
    const sw = commutateur('LEAF-A', 9, { info: { nom: 'Leaf A (commutateur de haut de baie)', texte: 'Ports à 25 GbE vers les caméras et la plupart des récepteurs, à 10 GbE vers le multiview et le moniteur. IGMP snooping actif (sauf réglage contraire).' } });
    sw.position.set(0, 0, -1.4); root.add(sw);
    const net = new Reseau(ctx, root, 700);
    const camO = {}, rxO = {}, Lc = {}, Lr = {};
    CAMS.forEach((c, i) => {
      const a = 0.35 + i * 0.22, x = -Math.sin(a) * 4.2, z = Math.cos(a) * 4.2 - 2.4;
      const o = appareil('camera', c.nom, { couleur: 0x3a4048, info: () => ({ nom: `${c.nom} · source ${c.src}`, texte: `Envoie un flux ST 2110-20 vers le groupe ${c.groupe} (≈ ${fmtNum(DEBIT, 1)} Gb/s). Lien 25 GbE vers la leaf.` }) });
      o.position.set(x, 0, z); o.rotation.y = 0.4 + i * 0.15; root.add(o); camO[c.id] = o;
      Lc[c.id] = net.relie({ obj: o }, { obj: sw, i }, { couleur: c.col, sag: 0.6 });
      ctx.label(o, c.groupe, { off: [0, 1.6, 0], cls: 'small' });
    });
    RX.forEach((r, i) => {
      const a = 0.35 + i * 0.3, x = Math.sin(a) * 3.8, z = Math.cos(a) * 3.8 - 2.0;
      const o = appareil(r.type, r.nom, { info: () => ({ nom: r.nom, texte: `Lien ${r.cap} GbE. Abonné à : ${S.abos[r.id].length ? S.abos[r.id].map((c) => CAMS.find((x) => x.id === c).nom).join(', ') : 'rien'}.` }) });
      o.position.set(x, 0, z); o.rotation.y = -0.4 - i * 0.2; root.add(o); rxO[r.id] = o;
      Lr[r.id] = net.relie({ obj: sw, i: 5 + i }, { obj: o }, { couleur: 0x8a949c, sag: 0.6, info: { nom: `Lien ${r.cap} GbE vers ${r.nom}` } });
    });
    // jauges de charge : un tube de verre et son remplissage
    const gauges = {};
    const gauge = (obj, key, cap) => {
      const g = new THREE.Group(); g.position.set(0.36, 0, 0); obj.add(g);
      const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 16, 1, true), verre(0xffffff, 0.12, { side: THREE.DoubleSide, depthWrite: false })); glass.position.y = 0.5; glass.userData.passe = true; g.add(glass);
      const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 16), eclat(0x3fcf6e, 0.9)); g.add(fill);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.03, 16), mat('alu', 0x59646f)); base.position.y = 0.015; g.add(base);
      const tag = ctx.label(g, '', { off: [0, 1.15, 0], cls: 'small' });
      gauges[key] = { fill, tag, cap, v: 0, cible: 0 };
    };
    for (const c of CAMS) gauge(camO[c.id], c.id, 25);
    for (const r of RX) gauge(rxO[r.id], r.id, r.cap);
    /** ce que chaque lien porte, selon le mode */
    function charges() {
      const rx = {}, cam = {};
      for (const r of RX) rx[r.id] = S.mode === 'flood' ? CAMS.map((c) => c.id) : S.abos[r.id];
      for (const c of CAMS) cam[c.id] = S.mode === 'uc' ? RX.filter((r) => S.abos[r.id].includes(c.id)).length : 1;
      return { rx, cam };
    }
    function update() {
      const { rx, cam } = charges();
      for (const r of RX) gauges[r.id].cible = rx[r.id].length * DEBIT;
      for (const c of CAMS) gauges[c.id].cible = cam[c.id] * DEBIT + (S.mode === 'flood' ? (CAMS.length - 1) * DEBIT : 0);
      ctx.read('Mode', { mc: 'multicast, IGMP snooping actif', uc: 'unicast : une copie par destinataire', flood: 'multicast sans snooping : recopié partout' }[S.mode]);
      ctx.read('Liens des récepteurs', RX.map((r) => `${r.nom} ${fmtNum(rx[r.id].length * DEBIT, 1)} / ${r.cap} Gb/s${rx[r.id].length * DEBIT > r.cap ? ' : DÉBORDE' : ''}`).join(' · '));
      ctx.read('Liens des caméras', CAMS.map((c) => `${c.nom} ${fmtNum(gauges[c.id].cible, 1)}`).join(' · ') + ' Gb/s (sur 25)');
      ctx.read('Dernier message IGMP', S.igmp);
      for (const r of RX) for (let i = 0; i < 1; i++) sw.userData.led(5 + RX.indexOf(r), rx[r.id].length * DEBIT > r.cap ? COUL.rouge : rx[r.id].length ? COUL.vert : 0x59646f);
    }
    /** un abonnement ou un désabonnement IGMP, animé du récepteur au commutateur */
    function igmp(rid, cid, join) {
      const c = CAMS.find((x) => x.id === cid), r = RX.find((x) => x.id === rid);
      S.igmp = `${r.nom} : ${join ? 'join' : 'leave'} (${c.src}, ${c.groupe})`;
      net.trame(Lr[rid], -1, { couleur: 0xffffff, taille: [0.1, 0.06, 0.06], vitesse: 1.4, info: { nom: `IGMPv3 ${join ? 'report (join)' : 'leave'}`, texte: `De ${r.nom} : ${join ? 'je veux' : 'je ne veux plus'} le groupe ${c.groupe} envoyé par ${c.src}.` }, onEnd: () => {
        const L = S.abos[rid];
        if (join && !L.includes(cid)) L.push(cid); if (!join) S.abos[rid] = L.filter((x) => x !== cid);
        ctx.say(`Le commutateur a lu le rapport IGMP de ${r.nom} : ${join ? 'le flux de ' + c.nom + ' part vers son port' : 'il ne reçoit plus ' + c.nom}.`);
        update(); syncUi();
      } });
      update();
    }
    let tEmit = 0, ui = null, alive = true;
    const syncUi = () => {
      if (!ui) return;
      for (const b of ui.querySelectorAll('[data-m]')) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.m === S.mode));
      for (const b of ui.querySelectorAll('[data-r]')) { const e = /** @type {HTMLInputElement} */ (b); e.checked = S.abos[e.dataset.r].includes(e.dataset.c); }
    };
    update();
    return {
      dispose() { alive = false; },
      etape(i, E) {
        S.mode = E.mode || 'mc'; S.abos = structuredClone(E.abos || ABOS0); S.igmp = '—';
        net.clear(); update(); syncUi();
        if (E.join) setTimeout(() => { if (alive) igmp(E.join[0], E.join[1], true); }, 800);
      },
      update(dt) {
        // jauges : elles montent ou descendent doucement vers leur charge
        for (const G of Object.values(gauges)) {
          G.v += (G.cible - G.v) * Math.min(1, dt * 3);
          const f = clamp(G.v / G.cap, 0, 1.15), h = Math.max(0.01, Math.min(1, f));
          G.fill.scale.y = h; G.fill.position.y = h / 2 + 0.02;
          /** @type {any} */ (G.fill.material).color.set(f > 1 ? COUL.rouge : f > 0.7 ? COUL.ambre : COUL.vert);
          G.tag.set(`${fmtNum(G.v, 1)} / ${G.cap} Gb/s`);
        }
        // les flux : un paquet toutes les 0,3 s par copie
        tEmit += dt; if (tEmit < 0.3) return; tEmit = 0;
        const { rx } = charges();
        for (const c of CAMS) {
          const subs = RX.filter((r) => rx[r.id].includes(c.id));
          const info = { nom: `Paquet du flux ${c.nom}`, texte: `RTP/UDP vers ${S.mode === 'uc' ? 'l\'adresse de chaque récepteur' : `le groupe ${c.groupe}`}, source ${c.src}. Environ 216 000 paquets par seconde en 1080p50.` };
          if (S.mode === 'uc') {
            subs.forEach((r, k) => net.chemin([[Lc[c.id], 1], [Lr[r.id], 1]], { couleur: c.col, info, retard: k * 0.07 }));
            if (!subs.length) continue;
          } else {
            net.trame(Lc[c.id], 1, { couleur: c.col, info, onEnd: () => { for (const r of subs) net.trame(Lr[r.id], 1, { couleur: c.col, info }); } });
          }
          if (S.mode === 'flood') for (const o of CAMS) if (o.id !== c.id) setTimeout(() => alive && net.trame(Lc[o.id], -1, { couleur: c.col, info: { nom: `Flux ${c.nom} recopié vers ${o.nom}`, texte: 'Sans snooping, la caméra reçoit les flux des autres : de la charge pour rien.' } }), 600);
        }
      },
      commandes() {
        const grid = el('table', { class: 'v3-abos' },
          el('thead', {}, el('tr', {}, el('th', {}, ''), ...CAMS.map((c) => el('th', { style: { color: '#' + c.col.toString(16).padStart(6, '0') } }, c.nom)))),
          el('tbody', {}, ...RX.map((r) => el('tr', {}, el('th', { scope: 'row' }, r.nom), ...CAMS.map((c) => {
            const cb = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox', 'data-r': r.id, 'data-c': c.id, 'aria-label': `${r.nom} abonné à ${c.nom}` }));
            cb.checked = S.abos[r.id].includes(c.id);
            cb.addEventListener('change', () => igmp(r.id, c.id, cb.checked));
            return el('td', {}, cb);
          })))));
        ui = el('div', { class: 'v3-ctl' },
          el('div', { class: 'v3-row' }, el('span', {}, 'Mode :'), ...[['mc', 'multicast'], ['uc', 'unicast'], ['flood', 'sans snooping']].map(([k, t]) => el('button', { type: 'button', class: 'btn small', 'data-m': k, 'aria-pressed': String(k === S.mode), onclick: () => { S.mode = k; net.clear(); update(); syncUi(); ctx.say(`Mode : ${t}.`); } }, t))),
          el('p', { class: 'v3-note' }, 'Abonnements (un clic envoie le rapport IGMP) :'), grid);
        return ui;
      },
    };
  },
};
