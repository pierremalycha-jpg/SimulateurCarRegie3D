// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { slider, fmtNum } from '../../cours/kit.js';
import { eclat, verre, piece, texte, courbe, tube, mat, zone } from '../kit.js';
import { appareil } from '../materiel.js';
import { filesQos, CLASSES } from '../../cours/ip_calc.js';

// ----------------------------------------------------------------------------------
// Vue 3D « La QoS dans un commutateur » : quatre sources marquées (le grand maître PTP en EF 46, une caméra en
// AF41 34, l'intercom en CS4 32, une copie de fichiers en DF 0) envoient vers un même port de sortie, vers le
// multiview. Le commutateur est transparent : on voit ses files d'attente. Avec une seule file, tout le monde attend
// et perd ; avec une file par classe et la priorité stricte, PTP passe aussitôt et seule la classe « au mieux » perd.
// Le temps est ralenti (quelques paquets par seconde) ; les chiffres à l'échelle réelle viennent du modèle fluide
// de cours/ip_calc.js (filesQos).
// ----------------------------------------------------------------------------------
const CL = [
  { k: 'ptp', nom: 'Grand maître PTP', type: 'spg', col: 0xff9a8a, z: -1.65 },
  { k: 'media', nom: 'Caméra', type: 'camera', col: 0x7fd3f3, z: -0.55 },
  { k: 'commande', nom: 'Intercom', type: 'intercom', col: 0x7fd1a0, z: 0.55 },
  { k: 'fichiers', nom: 'NAS (copies)', type: 'serveur', col: 0xb8c0c8, z: 1.65 },
];
const XIN = -1.3, XHEAD = 1.55, XOUT = 2.1, YQ = 0.98, CAP = 7, PAS = 0.21;
const FIXE = { ptp: 1, commande: 20 }; // Mb/s : l'horloge et les commandes, petits et réguliers

export const VUE_RESEAU_QOS = {
  id: 'reseau-qos', chapitre: 'reseau', titre: 'La QoS dans un commutateur',
  resume: 'Quatre usages marqués vers un port de sortie engorgé : une seule file où tout le monde attend et perd, puis une file par classe et la priorité stricte.',
  lecons: ['reseau-qos', 'reseau-mesures'],
  lectures: ['Le port', 'PTP (EF 46)', 'Médias (AF41 34)', 'Commandes (CS4 32)', 'Fichiers (DF 0)', 'À l\'échelle réelle'],
  depart: 'Le commutateur est transparent : on voit ses files. Le temps est ralenti : quelques paquets par seconde.',
  vue: { cible: [0, 0.9, 0.2], dir: [0, 0.9, 1], dist: 12 },
  orbite: { rMin: 1.5, rMax: 22 },
  etapes: [
    { t: 'Un port de sortie, quatre usages', reglage: { mode: 'fifo', media: 300, fichiers: 150, lien: 1 }, lecon: 'reseau-qos',
      texte: `Quatre appareils envoient vers le **même port de sortie** du commutateur, celui du multiview : le grand maître **PTP** (l'horloge), une **caméra**, l'**intercom**, et un **NAS** qui copie des fichiers.

Ici, la somme tient dans le lien de 1 Gb/s : chaque paquet repart aussitôt, les files restent vides. La QoS n'a rien à faire.` },
    { t: 'La congestion : une seule file', reglage: { mode: 'fifo', media: 600, fichiers: 600, lien: 1 }, lecon: 'reseau-qos',
      texte: `La copie de fichiers monte : le port reçoit **1,2 Gb/s** pour 1 Gb/s. Les paquets en trop **attendent** dans la file (au centre), puis, la file pleine, sont **jetés** (✕).

Avec une seule file, tout le monde subit : le message PTP attend derrière les fichiers, et l'attente **varie** d'un paquet à l'autre. Pour une horloge qui mesure le délai du réseau, c'est une erreur qui s'ajoute.` },
    { t: 'Classer et marquer : le DSCP', reglage: { mode: 'fifo', media: 600, fichiers: 600, lien: 1, marques: true }, lecon: 'reseau-qos',
      texte: `Chaque paquet porte sa **classe** dans l'en-tête IP : le **DSCP** (6 bits). PTP en **EF 46**, les médias en **AF41 34** (valeurs d'AES67 et de ST 2110), l'intercom en **CS4 32**, les fichiers en **DF 0** (au mieux). Sur un trunk, l'étiquette VLAN porte aussi une priorité sur 3 bits (la CoS).

Le marquage seul ne change rien : encore faut-il que le commutateur range chaque classe dans sa file.` },
    { t: 'Une file par classe, priorité stricte', reglage: { mode: 'prio', media: 600, fichiers: 600, lien: 1, marques: true }, lecon: 'reseau-qos',
      texte: `Le commutateur **fait confiance** au marquage (qos trust dscp) : une **file par classe**, et un ordonnanceur en **priorité stricte** qui sert toujours la plus haute file non vide.

PTP passe aussitôt, sans attente variable ; les médias et l'intercom aussi. Seule la file **au mieux** (les fichiers) se remplit et **perd ce qui dépasse** : la copie ralentira, TCP s'en chargera.` },
    { t: 'La QoS ne crée pas de débit', reglage: { mode: 'prio', media: 1100, fichiers: 300, lien: 1, marques: true }, lecon: 'reseau-qos',
      texte: `Les médias seuls demandent **1,1 Gb/s** : plus que le lien. Même prioritaires, ils perdent des paquets ; et en priorité stricte, ils prennent tout ce qui reste, l'intercom (moins prioritaire) n'a plus rien.

La QoS protège une classe des autres, jamais d'elle-même. Un réseau média se **dimensionne** pour ne pas déborder ; la QoS reste une assurance pour l'horloge et les commandes.` },
    { t: 'Dimensionner : un lien à 10 Gb/s', reglage: { mode: 'prio', media: 1100, fichiers: 600, lien: 10, marques: true }, lecon: 'reseau-mesures',
      texte: `Le même trafic sur un port à **10 Gb/s** : 17 % de charge. Plus rien n'attend, plus rien ne se perd, et la latence de chaque paquet se réduit à sa sérialisation (1,2 µs pour 1 500 octets).

Mesurer, c'est surveiller cette **charge** et les **paquets jetés** de chaque file (compteurs du port) : une file « au mieux » qui perd n'est pas une panne ; une file PTP qui attend en est une.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { mode: 'fifo', media: 300, fichiers: 150, lien: 1, marques: false, t: 0 };
    // les sources, le récepteur
    const src = {};
    for (const c of CL) {
      const o = appareil(c.type, c.nom, { info: () => ({ nom: c.nom, texte: `Marque ses paquets ${CLASSES[c.k].phb} (DSCP ${CLASSES[c.k].dscp}, CoS ${CLASSES[c.k].cos}). Offre ${fmtNum(offert()[c.k])} Mb/s.` }) });
      o.position.set(-3.9, 0, c.z); o.rotation.y = Math.PI / 2; o.scale.setScalar(0.85); root.add(o); src[c.k] = o;
    }
    const mv = appareil('multiview', 'Multiview', { info: { nom: 'Le multiview', texte: 'Derrière le port de sortie : tout ce qui sort passe par ce lien.' } }); mv.position.set(4.0, 0, 0); mv.rotation.y = -Math.PI / 2; root.add(mv);
    const tags = {}; for (const c of CL) { tags[c.k] = ctx.label(src[c.k], '', { off: [0, src[c.k].userData.top * 0.85 + 0.25, 0], cls: 'small' }); }
    // le commutateur, transparent, et ses files
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.5, 4.4), verre(0x9fb3c4, 0.08, { depthWrite: false })); chassis.position.set(0.15, YQ, 0); chassis.userData.passe = true; root.add(chassis);
    const ch2 = new THREE.LineSegments(new THREE.EdgesGeometry(chassis.geometry), new THREE.LineBasicMaterial({ color: 0x9fb3c4, transparent: true, opacity: 0.5 })); ch2.position.copy(chassis.position); root.add(ch2);
    chassis.userData.info = { nom: 'Le commutateur', texte: 'Ses ports d\'entrée à gauche, son port de sortie à droite ; au milieu, les files d\'attente du port de sortie.' };
    root.add(piece('pied', 'laque', (b) => b.cbox(3.2, YQ - 0.25, 3.8, 0.15, (YQ - 0.25) / 2, 0, 0x1d2227, 0.03)));
    const filesZ = { ptp: -1.65, media: -0.55, commande: 0.55, fichiers: 1.65, fifo: 0 };
    const couloirs = {};
    for (const [k, z] of Object.entries(filesZ)) {
      const zz = zone(CAP * PAS + 0.12, 0.3, 0.32, k === 'fifo' ? 0xffd38a : CL.find((c) => c.k === k)?.col ?? 0xffffff, { opacity: 0.12, edge: 0.7 });
      zz.position.set(XHEAD - (CAP * PAS) / 2 + 0.05, YQ, z); zz.userData.fill.userData.passe = true; zz.userData.edges.userData.passe = true; root.add(zz); couloirs[k] = zz;
    }
    const sched = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 24), mat('alu', 0xffd38a, { metalness: 0.6, roughness: 0.3 })); sched.position.set(XOUT - 0.15, YQ, 0); root.add(sched);
    sched.userData.info = { nom: 'L\'ordonnanceur', texte: 'Il choisit quelle file envoie le paquet suivant : la plus haute non vide en priorité stricte.' };
    const tSched = texte('ordonnanceur', { h: 0.13, bg: 'rgba(12,16,20,.8)' }); tSched.position.set(XOUT - 0.15, YQ + 0.36, 0.3); root.add(tSched);
    const tSortie = ctx.label(new THREE.Vector3(3.1, 1.5, 0), '', { cls: 'hot' });
    // les câbles et les chemins des paquets
    const fil = (pts, col, r = 0.03) => { const c = courbe(pts); const m = tube(c, r, mat('plastique', col, { roughness: 0.5 }), 48, 8); root.add(m); return c; };
    const entree = {}, interne = {};
    for (const c of CL) {
      entree[c.k] = fil([[-3.6, 0.62, c.z], [-2.8, 0.55, c.z], [-2.0, YQ, c.z * 0.9], [XIN - 0.3, YQ, c.z * 0.85]], c.col);
      interne[c.k] = { prio: courbe([[XIN - 0.3, YQ, c.z * 0.85], [XIN + 0.6, YQ, c.z], [XHEAD - CAP * PAS, YQ, c.z]]), fifo: courbe([[XIN - 0.3, YQ, c.z * 0.85], [XIN + 0.6, YQ, c.z * 0.4], [XHEAD - CAP * PAS, YQ, 0]]) };
    }
    const sortie = fil([[XOUT, YQ, 0], [2.9, YQ, 0], [3.45, 0.8, 0], [3.75, 0.62, 0]], 0xffd38a, 0.045);
    const tirs = {}; for (const [k, z] of Object.entries(filesZ)) tirs[k] = courbe([[XHEAD + 0.08, YQ, z], [XOUT - 0.2, YQ, z * 0.3], [XOUT, YQ, 0]]);
    const F = ctx.flux(160, new THREE.BoxGeometry(1, 1, 1), eclat(0xffffff));
    const SC = [0.16, 0.12, 0.12];
    // les paquets en file : un maillage instancié
    const NQ = 48, Qm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.17, 0.12, 0.12), eclat(0xffffff), NQ); Qm.count = 0; Qm.frustumCulled = false; root.add(Qm);
    const M4 = new THREE.Matrix4(), Cc = new THREE.Color();
    const croix = Array.from({ length: 6 }, () => { const L = ctx.label(new THREE.Vector3(), '✕', { cls: 'word ko' }); L.show(false); return { L, until: 0 }; });
    // l'état
    let Q = {}, stats = {}, acc = {}, servT = 0, gen = 0;
    const offert = () => ({ ptp: FIXE.ptp, media: S.media, commande: FIXE.commande, fichiers: S.fichiers });
    const R = () => Math.min(14, 6 * S.lien); // paquets servis par seconde (vue ralentie)
    // 1 Gb/s = 6 paquets par seconde dans la vue ; l'horloge et les commandes, petites, sont grossies pour qu'on les voie
    const parS = (k, mbps) => (k === 'ptp' || k === 'commande' ? 0.7 : mbps / 1000 * 6);
    function reset() { gen++; F.clear(); Q = { ptp: [], media: [], commande: [], fichiers: [], fifo: [] }; stats = {}; for (const c of CL) { stats[c.k] = { n: 0, perdus: 0, servis: 0, attente: 0, att: [] }; acc[c.k] = Math.random(); } servT = 0; }
    const file = (k) => (S.mode === 'fifo' ? Q.fifo : Q[k]);
    function arrive(k) {
      const f = file(k), st = stats[k]; st.n++;
      if (f.length >= CAP) { st.perdus++; const c = croix.find((x) => x.until < S.t) || croix[0]; c.L.target.set(XHEAD - CAP * PAS - 0.15, YQ + 0.25, S.mode === 'fifo' ? 0 : filesZ[k]); c.L.show(true); c.until = S.t + 0.8; return; }
      f.push({ k, t: S.t });
    }
    function sert() {
      let f = null;
      if (S.mode === 'fifo') f = Q.fifo.length ? Q.fifo : null;
      else for (const c of CL) if (Q[c.k].length) { f = Q[c.k]; break; }
      if (!f) return;
      const p = f.shift(), st = stats[p.k]; st.servis++; const w = S.t - p.t; st.att.push(w); if (st.att.length > 30) st.att.shift();
      const g = gen, zk = S.mode === 'fifo' ? 'fifo' : p.k;
      const col = CL.find((c) => c.k === p.k)?.col ?? 0xffffff;
      F.add({ curve: tirs[zk], speed: 2.6, color: col, scale: SC, onEnd: () => { if (g === gen) F.add({ curve: sortie, speed: 3, color: col, scale: SC, info: { nom: 'Vers le multiview', texte: `${CLASSES[p.k].nom} : ${fmtNum(w, 1)} s d'attente dans la vue.` } }); } });
    }
    function lire() {
      const o = offert(), Rr = filesQos(o, 1000 * S.lien, /** @type {any} */ (S.mode));
      ctx.read('Le port', `${S.mode === 'fifo' ? 'une seule file' : 'une file par classe, priorité stricte'} · lien ${S.lien} Gb/s · offert ${fmtNum(Rr.total)} Mb/s (${fmtNum(Rr.charge * 100)} %)`);
      const nomL = { ptp: 'PTP (EF 46)', media: 'Médias (AF41 34)', commande: 'Commandes (CS4 32)', fichiers: 'Fichiers (DF 0)' };
      for (const c of CL) {
        const st = stats[c.k], m = st.att.length ? st.att.reduce((a, b) => a + b, 0) / st.att.length : 0;
        const v = st.att.length > 1 ? Math.sqrt(st.att.reduce((a, b) => a + (b - m) ** 2, 0) / st.att.length) : 0;
        ctx.read(nomL[c.k], `${st.n ? fmtNum(st.perdus / st.n * 100, 0) : 0} % perdus · attente ${fmtNum(m, 2)} s ± ${fmtNum(v, 2)} (vue ralentie)`);
      }
      const P = Rr.classes.ptp, Mi = Rr.classes.media, Fi = Rr.classes.fichiers;
      ctx.read('À l\'échelle réelle', `PTP : ${P.retardMs ? fmtNum(P.retardMs, 1) + ' ms d\'attente' : 'pas d\'attente'} ; médias : ${fmtNum(Mi.pertePct, 0)} % perdus ; fichiers : ${fmtNum(Fi.pertePct, 0)} % perdus (tampon de 1 Mo)`);
      tSortie.set(`port de sortie : ${S.lien} Gb/s · ${fmtNum(Rr.charge * 100)} %`);
      for (const c of CL) { tags[c.k].set(S.marques ? `${CLASSES[c.k].phb} ${CLASSES[c.k].dscp} · ${fmtNum(o[c.k])} Mb/s` : `${fmtNum(o[c.k])} Mb/s`); }
      for (const [k, z] of Object.entries(couloirs)) z.visible = S.mode === 'fifo' ? k === 'fifo' : k !== 'fifo';
    }
    reset(); lire();
    let ui = null, tl = 0;
    const sync = () => { if (!ui) return; for (const b of ui.querySelectorAll('[data-m]')) b.setAttribute('aria-pressed', String(/** @type {HTMLElement} */ (b).dataset.m === S.mode)); for (const b of ui.querySelectorAll('[data-l]')) b.setAttribute('aria-pressed', String(+(/** @type {HTMLElement} */ (b).dataset.l) === S.lien)); for (const r of ui.querySelectorAll('input[type=range]')) { const k = /** @type {HTMLInputElement} */ (r).name; /** @type {HTMLInputElement} */ (r).value = String(/** @type {any} */ (S)[k]); const out = r.nextElementSibling; if (out) out.textContent = `${/** @type {any} */ (S)[k]} Mb/s`; } };
    return {
      etape(i, E) { const Rg = E.reglage || {}; Object.assign(S, { mode: Rg.mode || 'fifo', media: Rg.media ?? 300, fichiers: Rg.fichiers ?? 150, lien: Rg.lien ?? 1, marques: !!Rg.marques }); reset(); lire(); sync(); },
      update(dt) {
        S.t += dt; tl += dt;
        const o = offert();
        for (const c of CL) {
          acc[c.k] += parS(c.k, o[c.k]) * dt;
          while (acc[c.k] >= 1) {
            acc[c.k] -= 1; const g = gen, k = c.k;
            F.add({ curve: entree[k], speed: 3.2, color: c.col, scale: SC, info: { nom: `Paquet ${CLASSES[k].phb}`, texte: `${CLASSES[k].nom} : DSCP ${CLASSES[k].dscp}.` }, onEnd: () => { if (g === gen) F.add({ curve: interne[k][S.mode === 'fifo' ? 'fifo' : 'prio'], speed: 3.2, color: c.col, scale: SC, onEnd: () => { if (g === gen) arrive(k); } }); } });
          }
        }
        servT += dt; const pas = 1 / R();
        while (servT >= pas) { servT -= pas; sert(); }
        // dessiner les files
        let n = 0;
        for (const [k, z] of Object.entries(filesZ)) Q[k].forEach((p, j) => { if (n >= NQ) return; M4.makeTranslation(XHEAD - j * PAS, YQ, z); Qm.setMatrixAt(n, M4); Qm.setColorAt(n, Cc.set(CL.find((c) => c.k === p.k)?.col ?? 0xffffff)); n++; });
        Qm.count = n; Qm.instanceMatrix.needsUpdate = true; if (Qm.instanceColor) Qm.instanceColor.needsUpdate = true;
        for (const c of croix) if (c.until && c.until < S.t) { c.L.show(false); c.until = 0; }
        if (tl > 0.5) { tl = 0; lire(); }
      },
      commandes() {
        const sl = (k, label, max) => { const s = slider(label, 0, max, /** @type {any} */ (S)[k], 50, (v) => { /** @type {any} */ (S)[k] = v; lire(); }, (v) => `${v} Mb/s`); /** @type {HTMLInputElement} */ (s.querySelector('input')).name = k; return s; };
        ui = el('div', { class: 'v3-ctl' },
          sl('media', 'Médias (caméra)', 1500), sl('fichiers', 'Copies de fichiers', 1500),
          el('div', { class: 'v3-row' }, el('span', {}, 'Le port :'), ...[['fifo', 'une seule file'], ['prio', 'QoS : priorité stricte']].map(([k, t]) => el('button', { type: 'button', class: 'btn small', 'data-m': k, 'aria-pressed': String(k === S.mode), onclick: () => { S.mode = k; reset(); lire(); sync(); ctx.say(k === 'fifo' ? 'Une seule file : tout le monde attend et perd ensemble.' : 'Une file par classe, servie en priorité stricte.'); } }, t))),
          el('div', { class: 'v3-row' }, el('span', {}, 'Lien :'), ...[1, 10].map((l) => el('button', { type: 'button', class: 'btn small', 'data-l': String(l), 'aria-pressed': String(l === S.lien), onclick: () => { S.lien = l; lire(); sync(); } }, `${l} Gb/s`))));
        return ui;
      },
    };
  },
};
