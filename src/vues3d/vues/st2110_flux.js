// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { choice, fmtNum } from '../../cours/kit.js';
import { FORMATS, video, audio } from '../../cours/st2110_calc.js';
import { eclat, mat, texte, courbe, tube } from '../kit.js';
import { appareil, commutateur, Reseau } from '../materiel.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Du SDI au réseau : les essences séparées » : un câble SDI où l'image, le son et les données
// passent ensemble arrive dans une passerelle ; il en sort trois flux distincts (ST 2110-20 vidéo, -30 audio,
// -40 données), de tailles et de cadences différentes, vers la leaf ; chaque récepteur ne reçoit que ce
// qu'il a demandé. Au-dessus, le grand maître PTP donne l'heure : chaque paquet porte l'horodatage RTP de
// son image, et le serveur ralenti réaligne l'image et le son. Débits : cours/st2110_calc.js.
// ----------------------------------------------------------------------------------
const K = { v: 0xffd38a, a: 0xd08cff, d: 0x7fd1a0, ptp: 0xff8a3a };
const RX = [
  { id: 'mel', type: 'melangeur', nom: 'Mélangeur', veut: { v: true, a: false, d: false } },
  { id: 'son', type: 'intercom', nom: 'Console son', veut: { v: false, a: true, d: false } },
  { id: 'evs', type: 'serveur', nom: 'Serveur ralenti', veut: { v: true, a: true, d: true } },
  { id: 'mv', type: 'multiview', nom: 'Multiview', veut: { v: true, a: false, d: false } },
];
const ESS = { v: { nom: 'vidéo ST 2110-20', g: '239.1.1.1' }, a: { nom: 'audio ST 2110-30', g: '239.1.2.1' }, d: { nom: 'données ST 2110-40', g: '239.1.3.1' } };

export const VUE_ST2110_FLUX = {
  id: 'st2110-flux', chapitre: 'reseau', titre: 'Du SDI au réseau : les essences séparées',
  resume: 'Un câble SDI où tout passe ensemble entre dans une passerelle ; il en sort trois flux, vidéo, audio et données, que chaque récepteur demande séparément. L\'horodatage PTP les réaligne.',
  lecons: ['reseau-st2110'],
  lectures: ['Flux vidéo', 'Flux audio', 'Ce que reçoit chaque appareil', 'Horodatage'],
  depart: 'Jaune : la vidéo, violet : l\'audio, vert : les données. Les paquets sont à l\'échelle de leur taille, pas de leur nombre.',
  vue: { cible: [0, 1.0, 0.3], dir: [0, 0.5, 1], dist: 10.5 },
  orbite: { rMin: 1.2, rMax: 20 },
  etapes: [
    { t: 'En SDI : tout dans le même câble', vue: { cible: [-4.2, 0.9, 0.3], dir: [-0.1, 0.45, 1], dist: 5.5 },
      texte: `À gauche, la sortie SDI d'une caméra : dans le même câble, à débit fixe, passent l'image active (jaune), le son embarqué dans la suppression (violet) et les données (vert : timecode, VPID…).

Pour n'en prendre que le son, il faut tout recevoir et **désembedder**. Pour l'envoyer à trois endroits, il faut une grille ou un distributeur : un câble par destination.` },
    { t: 'La passerelle sépare les essences', vue: { cible: [-1.6, 1.0, 0.3], dir: [0, 0.45, 1], dist: 6 },
      texte: `La **passerelle** (ou la caméra IP elle-même) sépare le signal en trois **flux** IP, chacun vers son **groupe multicast** :
- **ST 2110-20**, la vidéo active seule : de gros paquets (1 200 octets de pixels), très nombreux (216 000 par seconde en 1080p50) ;
- **ST 2110-30**, l'audio : de petits paquets réguliers, un par milliseconde ;
- **ST 2110-40**, les données : quelques paquets par image.

Les trois partent sur le **même câble réseau**, mais ce sont trois flux indépendants.` },
    { t: 'Chacun ne reçoit que ce qu\'il demande', vue: { cible: [2.2, 1.0, 0.3], dir: [0, 0.5, 1], dist: 7.5 },
      texte: `La leaf recopie chaque flux vers ceux qui l'ont demandé (IGMP) :
- le **mélangeur** et le **multiview** prennent la vidéo seule ;
- la **console son** prend l'audio seul : quelques Mb/s, sans voir passer une image ;
- le **serveur ralenti** prend les trois, pour enregistrer l'image, son son et son timecode.

Cochez ce que chacun veut dans « À vous » : les paquets suivent.` },
    { t: 'L\'horodatage réaligne l\'image et le son', vue: { cible: [1.2, 1.6, 0.3], dir: [0, 0.35, 1], dist: 8 },
      texte: `Au-dessus, le **grand maître PTP** donne la même heure à tous (impulsions orange). Chaque paquet porte un **horodatage RTP** : l'heure PTP de l'image à laquelle il appartient (horloge de 90 kHz pour la vidéo, de 48 kHz pour l'audio).

Les flux ont voyagé séparément, peut-être par des chemins différents : le serveur ralenti range les paquets **par horodatage**, pas par ordre d'arrivée. L'image et le son de la même image se retrouvent : c'est **ST 2110-10**. Cliquez un paquet pour lire son horodatage.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { fk: '1080p50', veut: Object.fromEntries(RX.map((r) => [r.id, { ...r.veut }])) };
    // le câble SDI et son train mêlé
    const coax = tube(courbe([[-6.6, 0.55, 0.3], [-3.0, 0.55, 0.3]]), 0.12, mat('plastique', 0x2a5fb0, { roughness: 0.5 }), 20, 16);
    coax.userData.info = { nom: 'Câble SDI', texte: 'Image, son embarqué et données ensemble, à débit fixe (2,97 Gb/s en 3G-SDI), suppression comprise.' };
    root.add(coax);
    const sdiT = texte('SDI 3G : tout ensemble', { h: 0.12 }); sdiT.position.set(-4.8, 0.95, 0.3); root.add(sdiT);
    const gw = appareil('passerelle', 'Passerelle SDI → IP', { info: { nom: 'Passerelle SDI → IP', texte: 'Elle désembedde le son et les données, met l\'image active en paquets, et envoie trois flux ST 2110 horodatés sur l\'heure PTP.' } });
    gw.position.set(-2.6, 0, 0.3); gw.rotation.y = -Math.PI / 2; root.add(gw);
    const sw = commutateur('LEAF', 6, { info: { nom: 'Leaf', texte: 'Elle recopie chaque flux multicast vers les ports abonnés.' } });
    sw.position.set(0.4, 0, -1.4); root.add(sw);
    const net = new Reseau(ctx, root, 600);
    const Lgw = net.relie({ obj: gw }, { obj: sw, i: 0 }, { couleur: 0x8a949c, sag: 0.5, info: { nom: 'Câble réseau de la passerelle', texte: 'Un seul câble (25 GbE), trois flux indépendants.' } });
    const rxO = {}, Lr = {};
    RX.forEach((r, i) => {
      const x = 0.4 + (i - 1.5) * 1.55;
      const o = appareil(r.type, r.nom, { info: () => ({ nom: r.nom, texte: `Abonné à : ${['v', 'a', 'd'].filter((e) => S.veut[r.id][e]).map((e) => ESS[e].nom).join(', ') || 'rien'}.` }) });
      o.position.set(x + 1.6, 0, 1.4); root.add(o); rxO[r.id] = o;
      Lr[r.id] = net.relie({ obj: sw, i: 2 + i }, { obj: o }, { couleur: 0x8a949c, sag: 0.5 });
    });
    // le grand maître PTP, au-dessus
    const gm = appareil('spg', 'Grand maître PTP', { info: { nom: 'Grand maître PTP (SPG, GPS)', texte: 'Il donne la même heure à tous les appareils (ST 2059) : c\'est elle que portent les horodatages RTP.' } });
    gm.position.set(-1.6, 0, -2.6); root.add(gm);
    const Lgm = net.relie({ obj: gm }, { obj: sw, i: 5 }, { couleur: 0xd8b25a, sag: 0.4 });
    // le train du câble SDI : des segments mêlés qui défilent
    const train = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), eclat(0xffffff), 60); train.count = 0; train.frustumCulled = false; root.add(train);
    train.userData.info = { nom: 'Le signal SDI', texte: 'L\'image active (jaune), le son (violet) et les données (vert) se suivent dans chaque ligne.' };
    const segs = []; let sx = 0;
    for (let i = 0; i < 12; i++) { segs.push({ x: sx, w: 0.5, c: K.v }); sx += 0.52; segs.push({ x: sx, w: 0.08, c: K.a }); sx += 0.1; segs.push({ x: sx, w: 0.05, c: K.d }); sx += 0.07; segs.push({ x: sx, w: 0.12, c: 0x59646f }); sx += 0.14; }
    let off = 0;
    // horodatage RTP (90 kHz) : l'heure PTP en tics
    let rtpV = 1856300400, image = 0;
    let tV = 0, tA = 0, tD = 0, tP = 0, ui = null;
    const send = (e) => {
      const ts = e === 'a' ? Math.round(rtpV / 90 * 48) : rtpV;
      const info = { nom: `Paquet ${ESS[e].nom}`, texte: `Groupe ${ESS[e].g} · horodatage RTP ${fmtNum(ts, 0)} (${e === 'a' ? 'horloge 48 kHz' : 'horloge 90 kHz'}) : image n° ${image} · ${e === 'v' ? '1 200 octets de pixels' : e === 'a' ? '48 échantillons par canal (1 ms)' : 'timecode et données annexes'}.` };
      const size = e === 'v' ? [0.12, 0.075, 0.075] : e === 'a' ? [0.055, 0.045, 0.045] : [0.04, 0.035, 0.035];
      net.trame(Lgw, 1, { couleur: K[e], info, taille: size, vitesse: 1.6, onEnd: () => {
        for (const r of RX) if (S.veut[r.id][e]) net.trame(Lr[r.id], 1, { couleur: K[e], info, taille: size, vitesse: 1.6, onEnd: r.id === 'evs' ? () => aligne(e) : undefined });
      } });
    };
    // le réalignement au serveur ralenti : un repère par essence, allumé quand l'image est complète
    const rack = new THREE.Group(); rack.position.set(0, rxO.evs.userData.top + 0.35, 0); rxO.evs.add(rack);
    const slot = {}; ['v', 'a', 'd'].forEach((e, i) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.1), eclat(0x2a3138)); m.position.set((i - 1) * 0.2, 0, 0); rack.add(m); slot[e] = m; });
    const rackTag = ctx.label(rack, '', { off: [0, 0.2, 0], cls: 'small' });
    let got = { v: 0, a: 0, d: 0 };
    function aligne(e) {
      got[e] = 1.2; /** @type {any} */ (slot[e].material).color.set(K[e]);
      rackTag.set(`image n° ${image} : ${['v', 'a', 'd'].filter((k) => got[k] > 0).map((k) => ({ v: 'vidéo', a: 'son', d: 'données' }[k])).join(' + ')}`);
    }
    function lire() {
      const V = video(S.fk), A = audio(8);
      ctx.read('Flux vidéo', `${ESS.v.g} · ${fmtNum(V.pps, 0)} paquets/s · ${fmtNum(V.gbpsFil, 2)} Gb/s`);
      ctx.read('Flux audio', `${ESS.a.g} · 8 canaux, 1 000 paquets/s · ${fmtNum(A.mbpsFil, 1)} Mb/s`);
      ctx.read('Ce que reçoit chaque appareil', RX.map((r) => `${r.nom} : ${['v', 'a', 'd'].filter((e) => S.veut[r.id][e]).map((e) => ({ v: 'vidéo', a: 'audio', d: 'données' }[e])).join(' + ') || 'rien'}`).join(' · '));
      ctx.read('Horodatage', `RTP vidéo ${fmtNum(rtpV, 0)} (90 kHz) : image n° ${image}`);
    }
    lire();
    const M4 = new THREE.Matrix4(), C = new THREE.Color(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), Sc = new THREE.Vector3();
    return {
      update(dt) {
        // le train SDI
        off = (off + dt * 0.6) % sx; let n = 0;
        for (let k = -1; k <= 1; k++) for (const s of segs) {
          const x0 = -6.6 + ((s.x + off) % sx) + k * sx, x1 = x0 + s.w; if (x1 < -6.55 || x0 > -3.05) continue;
          const a = Math.max(x0, -6.55), b = Math.min(x1, -3.05); if (b <= a) continue;
          P.set((a + b) / 2, 0.55, 0.3); Sc.set(b - a, 0.255, 0.255); M4.compose(P, Q, Sc); train.setMatrixAt(n, M4); train.setColorAt(n, C.set(s.c)); n++;
        }
        train.count = n; train.instanceMatrix.needsUpdate = true; if (train.instanceColor) train.instanceColor.needsUpdate = true;
        // les flux IP : cadences relatives (à l'échelle de la scène, pas du réel)
        tV += dt; tA += dt; tD += dt; tP += dt;
        if (tV > 0.24) { tV = 0; send('v'); }
        if (tA > 0.55) { tA = 0; send('a'); }
        if (tD > 1.6) { tD = 0; send('d'); }
        if (tP > 1.0) { tP = 0; image++; rtpV += 1800; net.trame(Lgm, 1, { couleur: K.ptp, taille: [0.08, 0.05, 0.05], info: { nom: 'Message PTP (Sync)', texte: 'Le grand maître donne l\'heure ; chaque appareil horodate ses paquets sur elle.' } }); lire(); }
        for (const e of ['v', 'a', 'd']) if (got[e] > 0) { got[e] -= dt; if (got[e] <= 0) /** @type {any} */ (slot[e].material).color.set(0x2a3138); }
      },
      commandes() {
        ui = el('div', { class: 'v3-ctl' },
          choice('Format', Object.keys(FORMATS).map((k) => [k, FORMATS[k].nom]), S.fk, (v) => { S.fk = v; lire(); }),
          el('table', { class: 'v3-abos' },
            el('thead', {}, el('tr', {}, el('th', {}, ''), el('th', {}, 'vidéo'), el('th', {}, 'audio'), el('th', {}, 'données'))),
            el('tbody', {}, ...RX.map((r) => el('tr', {}, el('th', { scope: 'row' }, r.nom), ...['v', 'a', 'd'].map((e) => {
              const cb = /** @type {HTMLInputElement} */ (el('input', { type: 'checkbox', 'aria-label': `${r.nom} reçoit ${ESS[e].nom}` })); cb.checked = S.veut[r.id][e];
              cb.addEventListener('change', () => { S.veut[r.id][e] = cb.checked; lire(); ctx.say(`${r.nom} ${cb.checked ? 's\'abonne au' : 'se désabonne du'} flux ${ESS[e].nom} (${ESS[e].g}).`); });
              return el('td', {}, cb);
            }))))));
        return ui;
      },
    };
  },
};
