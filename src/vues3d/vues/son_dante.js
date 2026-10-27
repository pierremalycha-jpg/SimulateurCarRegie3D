// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../../util.js';
import { fmtNum } from '../../cours/kit.js';
import { COUL, eclat, verre, piece, texte, ecran } from '../kit.js';
import { appareil, commutateur, Reseau } from '../materiel.js';
import { flux as fluxDe, emission, charge, delaiChemin, tient, latenceConseillee, leader, LATENCES, DSCP, canalUtile } from '../../cours/dante_calc.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Dante : l'audio sur le réseau » : un boîtier de scène Dante (32 entrées), un commutateur Gigabit
// (le réseau primaire) et son jumeau (le secondaire), la console, un enregistreur, le PC de Dante Controller
// (son écran : la grille des abonnements), le car IP (ST 2110-30) et le SPG du car qui donne son word clock à la
// console. Les flux audio (unicast : une copie par récepteur ; multicast : une copie, recopiée par le
// commutateur), les annonces mDNS, les messages PTP du leader, une coupure du primaire, un commutateur mal
// réglé (sans IGMP snooping, EEE allumé). Débits, latence et leader : modèle pur cours/dante_calc.js, comme la
// leçon « Dante : l'audio sur le réseau ».
// ----------------------------------------------------------------------------------
const RX = [
  { id: 'console', nom: 'Console', col: 0xffb020 },
  { id: 'rec', nom: 'Enregistreur', col: 0x4cc3e6 },
  { id: 'car', nom: 'Car IP', col: 0xb07bff },
];
const DEF = { canaux: 32, multicast: false, snooping: true, lien: 1000, latence: 1, bonds: 1, eee: false, abos: ['console'], primaire: true, secondaire: false, horloge: 'externe', annonces: false, ptp: false, aes67: false };
const lat = (l) => fmtNum(l, 2).replace(/,?0+$/, '');

export const VUE_SON_DANTE = {
  id: 'son-dante', chapitre: 'son', aussi: ['reseau'], titre: 'Dante : l\'audio sur le réseau',
  resume: 'Un boîtier de scène, un commutateur, la console, un enregistreur et Dante Controller : les abonnements, l\'unicast et le multicast, l\'horloge PTP calée sur le word clock du car, la latence, la QoS, le réseau secondaire.',
  lecons: ['son-dante'],
  lectures: ['Flux', 'Lien du boîtier', 'Horloge', 'Latence', 'Réseaux'],
  depart: 'Chaque couleur suit un récepteur : ambre la console, cyan l\'enregistreur, violet le car IP. Les petites impulsions blanches sont les messages PTP.',
  vue: { cible: [0.5, 0.8, 1.0], dir: [0, 0.62, 1], dist: 12 },
  orbite: { rMin: 1.2, rMax: 22 },
  etapes: [
    { t: 'Un câble à la place du multipaire', lecon: 'son-dante', reglage: {}, vue: { cible: [0.2, 0.8, 1.0], dir: [0, 0.6, 1], dist: 11.5 },
      texte: `Le **boîtier de scène** reçoit 32 micros. Avant le réseau, il fallait un **multipaire** de 32 paires jusqu'à la console. Avec **Dante** (Audinate), ses canaux partent en **paquets IP** sur un seul câble Ethernet, jusqu'au **commutateur** Gigabit, puis vers la **console**.

Chaque paquet porte les échantillons de quelques canaux, une fois par milliseconde environ. Un canal à 48 kHz sur 24 bits, c'est 1,152 Mb/s : les 32 canaux tiennent largement dans un lien à 1 Gb/s (jauge du boîtier).` },
    { t: 'Trouver les appareils : adresses et mDNS', lecon: 'son-dante', reglage: { annonces: true }, vue: { cible: [-1.6, 0.9, 1.2], dir: [-0.15, 0.55, 1], dist: 7 },
      texte: `Chaque appareil prend une **adresse IP** : par le **DHCP** s'il y a un serveur, sinon une adresse **locale 169.254.x.x** qu'il se donne lui-même (leçon sur les types d'adresses). Puis il s'**annonce** par **mDNS / DNS-SD** sur son sous-réseau (impulsions cyan).

**Dante Controller**, sur le PC, écoute ces annonces : la liste des appareils et de leurs canaux apparaît sans rien configurer. Les noms des appareils et des canaux sont gardés dans les appareils eux-mêmes.` },
    { t: 'S\'abonner dans Dante Controller', lecon: 'son-dante', reglage: { abos: ['console', 'rec'] }, vue: { cible: [-1.0, 1.0, 1.4], dir: [-0.1, 0.5, 1], dist: 7.5 },
      texte: `La **grille** de Dante Controller (écran du PC) : les émetteurs en colonnes, les récepteurs en lignes ; un clic à la croisée **abonne** un canal de réception à un canal d'émission. L'enregistreur vient de s'abonner aux 32 canaux du boîtier.

En **unicast** (le mode par défaut), le boîtier envoie alors **une copie de plus** de chaque flux : le lien du boîtier porte deux fois les 32 canaux. Les flux sont faits de quelques canaux chacun (4 par défaut, ordre de grandeur).` },
    { t: 'Multicast : une seule copie', lecon: 'son-dante', reglage: { abos: ['console', 'rec', 'car'], multicast: true }, vue: { cible: [0, 0.9, 1.0], dir: [0, 0.6, 1], dist: 11 },
      texte: `Trois récepteurs veulent les mêmes canaux. En **multicast**, le boîtier envoie **une seule copie** vers une adresse de groupe ; le **commutateur** la recopie vers les ports abonnés, grâce à l'**IGMP snooping** (leçon sur le multicast).

La charge du lien du boîtier ne dépend plus du nombre de récepteurs. On passe un flux en multicast dans Dante Controller, côté émetteur.` },
    { t: 'Sans IGMP snooping : partout', lecon: 'son-dante', reglage: { abos: ['console', 'rec', 'car'], multicast: true, snooping: false }, vue: { cible: [0, 0.9, 1.0], dir: [0, 0.6, 1], dist: 11 },
      texte: `Le commutateur n'a **pas d'IGMP snooping** : il traite le multicast comme une **diffusion** et le recopie sur **tous** ses ports, abonnés ou non. Le PC de Dante Controller reçoit les 32 canaux dont il n'a que faire ; sur un port à 100 Mb/s, un appareil serait noyé.

Sur un réseau Dante, on active l'IGMP snooping (avec un querier) dès qu'on utilise le multicast.` },
    { t: 'L\'horloge : le leader PTP et le word clock du car', lecon: 'son-dante', reglage: { ptp: true }, vue: { cible: [1.4, 0.9, 0.8], dir: [0.2, 0.6, 1], dist: 10 },
      texte: `Tous les appareils échantillonnent au même rythme grâce à **PTP** : ils élisent un **leader** d'horloge (couronne verte), les autres le suivent (impulsions blanches, leçon sur PTP).

Ici, la **console** reçoit le **word clock** du **SPG du car** (câble blanc) : dans Dante Controller, on lui coche **Sync to External** et **Preferred Leader**. Elle devient le leader et donne au réseau l'horloge du car : le son est calé sur la même référence que la vidéo. Choisissez un autre leader dans « À vous ».` },
    { t: 'La latence : arriver à l\'heure', lecon: 'son-dante', reglage: { latence: 0.25, bonds: 5, lien: 100, canaux: 16 }, vue: { cible: [-0.6, 0.9, 0.8], dir: [0, 0.6, 1], dist: 9.5 },
      texte: `Chaque récepteur rend le son **exactement** après la **latence** réglée dans Dante Controller (0,25 à 5 ms selon les appareils, 1 ms par défaut). Le paquet le plus lent doit arriver avant : à chaque commutateur, sa sérialisation et l'attente derrière les trames déjà en file.

Ici, 0,25 ms à travers cinq commutateurs, en liens à 100 Mb/s : des paquets arrivent **trop tard** (en rouge), le son claque. Passez en 1 Gb/s, ou montez la latence : lecture « Latence ».` },
    { t: 'La QoS, et l\'EEE à couper', lecon: 'son-dante', reglage: { ptp: true, eee: true }, vue: { cible: [0, 0.9, 0.2], dir: [0.1, 0.65, 1], dist: 6.5 },
      texte: `Le commutateur doit faire passer l'horloge et l'audio **devant** le reste (copies de fichiers, vidéo) : la **QoS**. Audinate recommande **DSCP 56** (CS7) pour les messages PTP qui datent et **46** (EF) pour l'audio, en files à priorité stricte (leçon sur la QoS).

Ici, l'**EEE** (Energy Efficient Ethernet) est allumé : il endort les ports entre deux paquets, et chaque réveil retarde les messages PTP de façon irrégulière. Les suiveurs perdent l'heure (couronnes qui clignotent). On le **coupe** sur tous les ports Dante.` },
    { t: 'Le réseau secondaire', lecon: 'son-dante', reglage: { secondaire: true, abos: ['console', 'rec'] }, vue: { cible: [0.3, 0.8, 0.0], dir: [0.45, 0.8, 1], dist: 11.5 },
      texte: `Les appareils qui ont deux ports Dante les branchent sur deux réseaux séparés : **primaire** et **secondaire** (commutateur bleu). Chaque paquet part sur les **deux** ; le récepteur garde le premier arrivé, comme le ST 2022-7 des réseaux rouge et bleu du car IP.

Coupez le **primaire** dans « À vous » : le son continue par le secondaire, sans un clic. Sans secondaire, la console perdrait les 32 canaux d'un coup.` },
    { t: 'Vers le car IP : AES67', lecon: 'son-dante', reglage: { abos: ['console', 'car'], multicast: true, aes67: true }, vue: { cible: [0.6, 0.9, 2.2], dir: [0, 0.55, 1], dist: 7.5 },
      texte: `Le boîtier publie aussi un flux en mode **AES67** (multicast, horloge PTP version 2) : le **car IP** le reçoit comme un flux **ST 2110-30**, son audio à lui. C'est le pont entre le réseau de la section son et celui du car.

Ce qu'il faut accorder : le domaine et le profil PTP (les deux réseaux suivent le même grand maître, calé sur le GPS), les adresses multicast, et la description du flux (SDP), que Dante publie en mode AES67.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { ...DEF, t: 0, alive: true };
    // ---------------- le matériel ----------------
    const sw = commutateur('Commutateur Dante (primaire)', 6, { info: () => ({ nom: 'Commutateur Gigabit (réseau primaire)', texte: `Administrable : QoS (DSCP ${DSCP.ptp.valeur} et ${DSCP.audio.valeur}), IGMP snooping ${S.snooping ? 'actif' : 'COUPÉ'}, EEE ${S.eee ? 'ALLUMÉ (à couper)' : 'coupé'}.` }) });
    sw.position.set(0, 0, -0.4); root.add(sw);
    const sw2 = commutateur('Secondaire', 6, { couleur: 0x2a4a7a, info: { nom: 'Commutateur du réseau secondaire', texte: 'Un second réseau, séparé : chaque paquet y passe aussi. Une coupure du primaire ne s\'entend pas.' } });
    sw2.position.set(0, 0, -2.3); root.add(sw2);
    // le boîtier de scène : 32 entrées XLR en façade
    const box = new THREE.Group(); box.name = 'Boîtier de scène';
    box.add(piece('Boîtier de scène', 'plastique', (b) => {
      b.cbox(0.6, 0.42, 0.42, 0, 0.21, 0, 0x1d2227, 0.02);
      b.cbox(1.1, 0.44, 0.5, 0, 0.64, 0, 0x2b3036, 0.02);
      for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) b.cyl(0.035, 0.035, 0.02, -0.42 + c * 0.12, 0.74 - r * 0.16, 0.255, 0x15181b, 16, Math.PI / 2);
    }));
    const tb = texte('BOÎTIER DE SCÈNE · 32 IN · DANTE', { h: 0.06, bg: 'rgba(18,22,26,.86)' }); tb.position.set(0, 0.92, 0.26); box.add(tb);
    box.userData.port = new THREE.Vector3(0, 0.6, -0.25); box.userData.top = 1.05;
    box.userData.info = () => ({ nom: 'Boîtier de scène Dante (32 entrées)', texte: `Préamplis micro et convertisseurs sur scène : ${S.canaux} canaux envoyés en Dante. ${S.horloge === 'boitier' ? 'Leader d\'horloge.' : 'Il suit le leader d\'horloge.'}` });
    box.position.set(-3.0, 0, 1.3); box.rotation.y = 0.5; root.add(box);
    const pc = appareil('pc', 'Dante Controller', { info: { nom: 'PC avec Dante Controller', texte: 'Le logiciel d\'Audinate : la liste des appareils (découverts par mDNS), la grille des abonnements, la latence, l\'horloge, les compteurs d\'erreurs.' } });
    pc.position.set(-1.5, 0, 2.6); pc.rotation.y = 0.15; root.add(pc);
    const grid = ecran(0.44, 0.26, 360, () => {}); grid.mesh.position.set(0, 1.07, -0.035); pc.add(grid.mesh);
    grid.mesh.userData.info = { nom: 'La grille des abonnements', texte: 'Émetteurs en colonnes (les canaux du boîtier, par huit), récepteurs en lignes : un point vert est un abonnement.' };
    const objs = {
      console: appareil('melangeur', 'Console', { info: () => ({ nom: 'Console de mixage (Dante)', texte: `Reçoit les canaux du boîtier. ${S.horloge === 'externe' ? 'Reçoit le word clock du SPG du car (Sync to External) et le donne au réseau : leader PTP.' : 'Elle suit le leader d\'horloge.'}` }) }),
      rec: appareil('serveur', 'Enregistreur', { info: { nom: 'Enregistreur multipiste (Dante)', texte: 'Enregistre chaque canal du boîtier à part, pour remixer plus tard.' } }),
      car: appareil('passerelle', 'Car IP', { info: { nom: 'Car IP (ST 2110-30)', texte: 'Reçoit l\'audio en ST 2110-30 ; un flux Dante en mode AES67 s\'y reçoit.' } }),
    };
    objs.console.position.set(2.9, 0, 1.3); objs.console.rotation.y = -0.5;
    objs.rec.position.set(1.6, 0, 2.7); objs.rec.rotation.y = -0.25;
    objs.car.position.set(0.1, 0, 3.0);
    for (const o of Object.values(objs)) root.add(o);
    const spg = appareil('spg', 'SPG du car', { info: { nom: 'SPG du car (word clock)', texte: 'Sa sortie word clock (48 kHz, coaxial 75 Ω) donne à la console Dante l\'horloge de la vidéo du car.' } });
    spg.position.set(4.1, 0, -0.3); spg.rotation.y = -0.9; root.add(spg);
    // ---------------- les câbles ----------------
    const net = new Reseau(ctx, root, 900);
    const L = {
      box: net.relie({ obj: box }, { obj: sw, i: 0 }, { couleur: 0x4a6a8a, sag: 0.5, info: { nom: 'Lien du boîtier (primaire)', texte: 'Le seul câble entre la scène et la régie : tous les canaux, dans les deux sens.' } }),
      pc: net.relie({ obj: pc }, { obj: sw, i: 1 }, { couleur: 0x4a6a8a, sag: 0.5 }),
      console: net.relie({ obj: objs.console }, { obj: sw, i: 2 }, { couleur: 0x4a6a8a, sag: 0.5 }),
      rec: net.relie({ obj: objs.rec }, { obj: sw, i: 3 }, { couleur: 0x4a6a8a, sag: 0.5 }),
      car: net.relie({ obj: objs.car }, { obj: sw, i: 4 }, { couleur: 0x4a6a8a, sag: 0.5 }),
    };
    const L2 = {
      box: net.relie({ obj: box }, { obj: sw2, i: 0 }, { couleur: 0x3f7fe6, sag: 0.9, info: { nom: 'Lien du boîtier (secondaire)', texte: 'Le même trafic, sur un réseau séparé.' } }),
      console: net.relie({ obj: objs.console }, { obj: sw2, i: 2 }, { couleur: 0x3f7fe6, sag: 0.9 }),
      rec: net.relie({ obj: objs.rec }, { obj: sw2, i: 3 }, { couleur: 0x3f7fe6, sag: 0.9 }),
    };
    const Lwc = net.relie({ obj: spg }, { obj: objs.console }, { couleur: 0xe8ece6, r: 0.014, sag: 0.3, info: { nom: 'Word clock du car (48 kHz)', texte: 'Coaxial 75 Ω, signal carré à 48 kHz : la console Dante y prend son horloge (Sync to External).' } });
    // la jauge du lien du boîtier
    const gauge = new THREE.Group(); gauge.position.set(0.75, 0, 0.1); box.add(gauge);
    const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 16, 1, true), verre(0xffffff, 0.12, { side: THREE.DoubleSide, depthWrite: false })); glass.position.y = 0.5; glass.userData.passe = true; gauge.add(glass);
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 16), eclat(0x3fcf6e)); gauge.add(fill);
    const gTag = ctx.label(gauge, '', { off: [0, 1.15, 0], cls: 'small' });
    const G = { v: 0, cible: 0 };
    // les couronnes d'horloge
    const crown = {};
    for (const [k, o] of [['boitier', box], ['console', objs.console], ['rec', objs.rec], ['car', objs.car]]) {
      const c = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.02, 8, 24), eclat(0x3fcf6e)); c.rotation.x = Math.PI / 2; c.position.y = (o.userData.top || 1) + 0.25; o.add(c); crown[k] = c;
    }
    const leadTag = ctx.label(crown.console, 'leader PTP', { off: [0, 0.18, 0], cls: 'small' });
    const late = { n: 0 };
    // ---------------- le calcul ----------------
    let Cst = null;
    function calc() {
      const recepteurs = S.abos.length;
      const E = emission({ canaux: S.canaux, recepteurs: Math.max(1, recepteurs), multicast: S.multicast });
      const ch = charge(E.debit, S.lien);
      const D = delaiChemin({ bonds: S.bonds, lienMbps: S.lien, octets: fluxDe({ canaux: 4 }).fil, charge: Math.min(0.97, ch) });
      const T = tient(S.latence, D.total);
      const apps = [
        { nom: 'Boîtier de scène', id: '00:1d:c1:0a:00:02', preferred: S.horloge === 'boitier' },
        { nom: 'Console', id: '00:1d:c1:0a:00:07', preferred: S.horloge === 'externe' || S.horloge === 'console', externe: S.horloge === 'externe' },
        { nom: 'Enregistreur', id: '00:1d:c1:0a:00:05' },
      ];
      const lead = leader(apps);
      Cst = { E, ch, D, T, lead, cons: latenceConseillee(D.total) };
      return Cst;
    }
    function lire() {
      const { E, ch, D, T, lead, cons } = calc();
      G.cible = E.debit / 1e6;
      ctx.read('Flux', `${E.flux} flux ${S.multicast ? `multicast${S.snooping ? '' : ' (sans snooping : recopiés partout)'}` : 'unicast'} pour ${S.abos.length} récepteur${S.abos.length > 1 ? 's' : ''} : ${S.abos.map((a) => RX.find((r) => r.id === a)?.nom).join(', ')}`);
      ctx.read('Lien du boîtier', `${fmtNum(E.debit / 1e6, 1)} Mb/s sur ${S.lien === 1000 ? '1 Gb/s' : '100 Mb/s'} (${fmtNum(ch * 100, 0)} %) · ${S.canaux} canaux × ${fmtNum(canalUtile() / 1e6, 3)} Mb/s utiles`);
      ctx.read('Horloge', S.eee ? 'INSTABLE : l\'EEE retarde irrégulièrement les messages PTP' : `leader : ${lead ? lead.nom : '—'}${S.horloge === 'externe' ? ', calé sur le word clock du car (Sync to External)' : S.horloge === 'auto' ? ' (élection : la plus petite identité)' : ' (Preferred Leader)'}`);
      ctx.read('Latence', ch >= 1 ? 'le lien déborde : des paquets sont perdus' : `${lat(S.latence)} ms réglée ; le paquet le plus lent met ${fmtNum(D.total, 0)} µs à travers ${S.bonds} commutateur${S.bonds > 1 ? 's' : ''} : ${T.ok ? 'à l\'heure' : 'TROP TARD'} (conseillé : ${lat(cons)} ms)`);
      ctx.read('Réseaux', `primaire ${S.primaire ? 'en service' : 'COUPÉ'} · secondaire ${S.secondaire ? 'en service' : 'absent'}${!S.primaire && !S.secondaire ? ' : PLUS DE SON' : !S.primaire ? ' : le son passe par le secondaire' : ''}`);
      // l'horloge : couronne du leader, les autres suiveurs
      const lid = lead ? (lead.nom === 'Console' ? 'console' : lead.nom === 'Boîtier de scène' ? 'boitier' : 'rec') : 'console';
      for (const [k, c] of Object.entries(crown)) { c.visible = S.ptp || k === lid; /** @type {any} */ (c.material).color.set(k === lid ? 0x3fcf6e : 0x9aa4ac); c.scale.setScalar(k === lid ? 1.3 : 0.8); }
      leadTag.target = crown[lid]; leadTag.show(true);
      Lwc.mesh.visible = S.horloge === 'externe';
      for (const l of Object.values(L2)) l.mesh.visible = S.secondaire;
      sw2.visible = S.secondaire;
      /** @type {any} */ (L.box.mesh.material).color.set(S.primaire ? 0x4a6a8a : COUL.rouge);
      objs.car.visible = S.abos.includes('car') || S.aes67 || !S.snooping;
      L.car.mesh.visible = objs.car.visible;
      for (let i = 0; i < 5; i++) sw.userData.led(i, i === 0 && !S.primaire ? COUL.rouge : COUL.vert);
      drawGrid();
    }
    function drawGrid() {
      const g = grid.g, w = grid.W, h = grid.H;
      g.fillStyle = '#0e1a26'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#9fd4ff'; g.font = '600 15px "Archivo Narrow", sans-serif'; g.fillText('Dante Controller · abonnements', 8, 16);
      const cols = Math.ceil(S.canaux / 8), cw = (w - 110) / Math.max(4, cols);
      g.fillStyle = '#8a949c'; g.font = '12px "B612 Mono", monospace';
      for (let c = 0; c < cols; c++) g.fillText(`${c * 8 + 1}-${c * 8 + 8}`, 108 + c * cw, 34);
      RX.forEach((r, k) => {
        const y = 52 + k * 22; g.fillStyle = '#d9dee2'; g.fillText(r.nom, 8, y + 4);
        for (let c = 0; c < cols; c++) { const on = S.abos.includes(r.id); g.fillStyle = on ? '#3fcf6e' : '#243240'; g.beginPath(); g.arc(118 + c * cw, y, 6, 0, Math.PI * 2); g.fill(); }
      });
      g.fillStyle = '#ffb020'; g.font = '12px "B612 Mono", monospace';
      g.fillText(`latence ${lat(S.latence)} ms · ${S.multicast ? 'multicast' : 'unicast'} · horloge : ${Cst && Cst.lead ? Cst.lead.nom : '—'}`, 8, h - 8);
      grid.mesh.material.map.needsUpdate = true;
    }
    let tA = 0, tP = 0, tD = 0, ui = null;
    const setUi = () => {
      if (!ui) return;
      for (const b of ui.querySelectorAll('[data-k]')) { const e = /** @type {HTMLElement} */ (b); b.setAttribute('aria-pressed', String(String(S[e.dataset.k]) === e.dataset.v)); }
      for (const c of ui.querySelectorAll('input[data-r]')) { const e = /** @type {HTMLInputElement} */ (c); e.checked = S.abos.includes(e.dataset.r); }
      const r = /** @type {HTMLInputElement | null} */ (ui.querySelector('input[name=canaux]')); if (r) { r.value = String(S.canaux); r.dispatchEvent(new Event('input')); }
      const b2 = /** @type {HTMLInputElement | null} */ (ui.querySelector('input[name=bonds]')); if (b2) { b2.value = String(S.bonds); b2.dispatchEvent(new Event('input')); }
    };
    lire();
    return {
      dispose() { S.alive = false; },
      etape(i, E) { Object.assign(S, DEF, structuredClone(E.reglage || {})); if (!E.reglage || !E.reglage.abos) S.abos = DEF.abos.slice(); net.clear(); late.n = 0; lire(); setUi(); },
      update(dt) {
        S.t += dt;
        // la jauge
        G.v += (G.cible - G.v) * Math.min(1, dt * 3);
        const f = clamp(G.v / S.lien, 0, 1.15), hh = Math.max(0.01, Math.min(1, f));
        fill.scale.y = hh; fill.position.y = hh / 2 + 0.02; /** @type {any} */ (fill.material).color.set(f > 1 ? COUL.rouge : f > 0.7 ? COUL.ambre : COUL.vert);
        gTag.set(`${fmtNum(G.v, 1)} / ${S.lien} Mb/s`);
        if (S.eee) for (const [k, c] of Object.entries(crown)) if (c.visible && k !== 'console') c.scale.setScalar(0.8 + 0.3 * Math.abs(Math.sin(S.t * (5 + k.length)))); // les suiveurs perdent l'heure
        if (!Cst) return;
        // l'audio : une impulsion par flux et par copie, toutes les 0,35 s
        tA += dt;
        if (tA > 0.35) {
          tA = 0;
          const enRetard = !Cst.T.ok || Cst.ch >= 1;
          const coul = (r) => (enRetard && Math.random() < 0.5 ? COUL.rouge : r.col);
          const info = (r) => ({ nom: `Paquet audio vers ${r.nom}`, texte: `${S.multicast ? 'Multicast : une copie, recopiée par le commutateur' : 'Unicast : une copie pour ce récepteur'} ; quelques canaux, 1 ms d'échantillons, DSCP ${DSCP.audio.valeur}.${enRetard ? ' Celui-ci arrive après la latence choisie : perdu pour la lecture.' : ''}` });
          const subs = RX.filter((r) => S.abos.includes(r.id));
          const reseaux = [S.primaire ? [L, sw] : null, S.secondaire ? [L2, sw2] : null].filter(Boolean);
          for (const [LL] of /** @type {any[]} */ (reseaux)) {
            if (S.multicast) {
              const dests = S.snooping ? subs : [...RX, { id: 'pc', nom: 'PC', col: 0xff6fb1 }];
              net.trame(LL.box, 1, { couleur: 0xffffff, taille: [0.12, 0.075, 0.075], info: { nom: 'Flux multicast du boîtier', texte: 'Une seule copie sur le lien du boîtier.' }, onEnd: () => { if (!S.alive) return; for (const r of dests) if (LL[r.id]) net.trame(LL[r.id], -1, { couleur: S.snooping ? coul(r) : 0xff6fb1, info: info(r) }); } });
            } else {
              subs.forEach((r, k) => { if (LL[r.id]) net.chemin([[LL.box, 1], [LL[r.id], -1]], { couleur: coul(r), info: info(r), retard: k * 0.08 }); });
            }
          }
          if (enRetard && Math.random() < 0.3) { late.n++; ctx.say(Cst.ch >= 1 ? 'Le lien du boîtier déborde : des paquets sont perdus.' : `Un paquet arrive après ${lat(S.latence)} ms : le son claque.`); }
        }
        // le PTP : le leader envoie l'heure, les suiveurs répondent
        tP += dt;
        if (S.ptp && tP > 1.1) {
          tP = 0;
          const lid = Cst.lead ? Cst.lead.nom : 'Console';
          const from = lid === 'Console' ? L.console : lid === 'Boîtier de scène' ? L.box : L.rec;
          const autres = [L.box, L.console, L.rec].filter((x) => x !== from);
          // chaque lien va de l'appareil (sens +1) vers le commutateur ; le retour vers un appareil est le sens −1
          net.trame(from, 1, { couleur: 0xffffff, taille: [0.06, 0.06, 0.06], vitesse: 1.8, info: { nom: 'Message PTP (Sync)', texte: `Du leader (${lid}) vers tous, DSCP ${DSCP.ptp.valeur} : l'heure du réseau.` }, retard: S.eee ? Math.random() * 0.6 : 0, onEnd: () => {
            for (const a of autres) net.trame(a, -1, { couleur: 0xffffff, taille: [0.06, 0.06, 0.06], vitesse: 1.8, retard: S.eee ? Math.random() * 0.8 : 0, info: { nom: 'Message PTP vers un suiveur', texte: S.eee ? 'Retardé par le réveil d\'un port en veille (EEE) : l\'heure devient fausse.' : 'Il arrive avec un retard régulier, que le suiveur sait compenser.' } });
          } });
          if (S.horloge === 'externe') net.trame(Lwc, 1, { couleur: 0xe8ece6, taille: [0.05, 0.05, 0.05], vitesse: 2, info: { nom: 'Word clock du car', texte: 'Un front montant toutes les 1/48 000 s (ici ralenti) : la console Dante s\'y cale.' } });
        }
        // les annonces mDNS vers Dante Controller
        tD += dt;
        if (S.annonces && tD > 1.4) {
          tD = 0;
          for (const LL of [L.box, L.console, L.rec]) {
            net.chemin([[LL, 1], [L.pc, -1]], { couleur: COUL.cyan, taille: [0.08, 0.06, 0.06], info: { nom: 'Annonce mDNS / DNS-SD', texte: 'Un appareil Dante se présente : son nom, son adresse, ses canaux. Dante Controller les liste.' } });
          }
        }
      },
      commandes() {
        const tog = (k, label, opts) => el('div', { class: 'v3-row' }, el('span', {}, label), el('div', { class: 'seg', role: 'group', 'aria-label': label }, ...opts.map(([v, t]) => el('button', { type: 'button', 'data-k': k, 'data-v': String(v), 'aria-pressed': String(S[k] === v), onclick: () => { S[k] = v; net.clear(); lire(); setUi(); ctx.say(`${label} : ${t}.`); } }, t))));
        const canaux = el('input', { type: 'range', name: 'canaux', min: 8, max: 64, step: 8, value: S.canaux, 'aria-label': 'Canaux du boîtier' });
        const out = el('output', {}, String(S.canaux));
        canaux.addEventListener('input', () => { S.canaux = +(/** @type {HTMLInputElement} */ (canaux)).value; out.textContent = String(S.canaux); lire(); });
        const bonds = el('input', { type: 'range', name: 'bonds', min: 1, max: 8, step: 1, value: S.bonds, 'aria-label': 'Commutateurs traversés' });
        const outb = el('output', {}, String(S.bonds));
        bonds.addEventListener('input', () => { S.bonds = +(/** @type {HTMLInputElement} */ (bonds)).value; outb.textContent = String(S.bonds); lire(); });
        ui = el('div', { class: 'v3-ctl' },
          el('label', { class: 'co-slider' }, el('span', {}, 'Canaux du boîtier'), canaux, out),
          el('div', { class: 'v3-row' }, el('span', {}, 'Abonnés :'), ...RX.map((r) => {
            const cb = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox', 'data-r': r.id, 'aria-label': `${r.nom} abonné aux canaux du boîtier` }));
            cb.checked = S.abos.includes(r.id);
            cb.addEventListener('change', () => { S.abos = cb.checked ? [...new Set([...S.abos, r.id])] : S.abos.filter((x) => x !== r.id); net.clear(); lire(); ctx.say(`${r.nom} ${cb.checked ? 'abonné' : 'désabonné'} dans Dante Controller.`); });
            return el('label', { class: 'v3-chk' }, cb, ' ', r.nom);
          })),
          tog('multicast', 'Flux', [[false, 'unicast'], [true, 'multicast']]),
          tog('snooping', 'IGMP snooping', [[true, 'actif'], [false, 'coupé']]),
          tog('lien', 'Liens', [[1000, '1 Gb/s'], [100, '100 Mb/s']]),
          tog('latence', 'Latence', LATENCES.map((l) => [l, `${lat(l)} ms`])),
          el('label', { class: 'co-slider' }, el('span', {}, 'Commutateurs traversés'), bonds, outb),
          tog('horloge', 'Leader d\'horloge', [['externe', 'console + word clock'], ['boitier', 'boîtier'], ['auto', 'élection']]),
          tog('eee', 'EEE', [[false, 'coupé'], [true, 'allumé']]),
          tog('primaire', 'Primaire', [[true, 'en service'], [false, 'coupé']]),
          tog('secondaire', 'Secondaire', [[false, 'absent'], [true, 'en service']]));
        return ui;
      },
    };
  },
};
