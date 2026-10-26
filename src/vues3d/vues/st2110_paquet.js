// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../../util.js';
import { choice, fmtNum } from '../../cours/kit.js';
import { video } from '../../cours/st2110_calc.js';
import { imageRGB } from '../../cours/sdi_mots.js';
import { eclat, verre, ecran, texte, courbe, tube, mat, piece } from '../kit.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Un paquet ST 2110-20 en poupées russes, et son rythme » : une ligne d'image coupée en quatre,
// puis un paquet ouvert couche après couche (pixels, RFC 4175, RTP, UDP, IP, Ethernet), chaque couche avec
// ses champs écrits dessus ; enfin le rythme d'envoi (ST 2110-21) : un émetteur qui envoie ses paquets
// régulièrement ou par rafales, et le tampon du récepteur qui se remplit. Valeurs : st2110_calc.js.
// ----------------------------------------------------------------------------------
const LAYERS = [
  { k: 'pix', nom: 'Pixels', o: 1200, col: 0xffd38a, w: 1.7, h: 0.42, champs: ['1 200 octets = 240 groupes de 5 octets', 'chaque groupe : Cb, Y, Cr, Y (10 bits chacun)', '480 pixels : le quart d\'une ligne 1080'] },
  { k: 'rfc', nom: 'En-tête RFC 4175', o: 8, col: 0xff8a80, w: 2.0, h: 0.56, champs: ['séquence étendue : 0x0002 (16 bits de plus)', 'longueur : 1 200 octets', 'ligne n° 541 · décalage : pixel 960'] },
  { k: 'rtp', nom: 'RTP', o: 12, col: 0xffb020, w: 2.3, h: 0.7, champs: ['séquence : 48 213 (16 bits)', 'horodatage : 1 856 300 400 (90 kHz, heure PTP)', 'SSRC 0x5A1C93E2 · M = 0 (pas la fin de l\'image)'] },
  { k: 'udp', nom: 'UDP', o: 8, col: 0x7fd1a0, w: 2.6, h: 0.84, champs: ['port source 50 000 → port destination 5 004', 'longueur : 1 228 octets', 'pas d\'accusé de réception, pas de renvoi'] },
  { k: 'ip', nom: 'IPv4', o: 20, col: 0x4cc3e6, w: 2.9, h: 0.98, champs: ['source 10.1.11.1 (CAM 1, carte rouge)', 'destination 239.1.1.1 (groupe de la CAM 1)', 'TTL 64 · DSCP 34 (AF41, vidéo)'] },
  { k: 'eth', nom: 'Ethernet', o: 18, col: 0x9aa4ad, w: 3.2, h: 1.12, champs: ['MAC destination 01:00:5E:01:01:01 (groupe)', 'MAC source de la caméra · type IPv4', 'FCS : 4 octets de contrôle en fin de trame'] },
];
const PX = -0.6, PY = 1.2; // centre du paquet
const RY = 0.9, R0 = 2.6, R1 = 6.4; // la piste du rythme

export const VUE_ST2110_PAQUET = {
  id: 'st2110-paquet', chapitre: 'reseau', titre: 'Un paquet ST 2110 en poupées russes, et son rythme',
  resume: 'Une ligne d\'image en quatre paquets ; un paquet ouvert couche par couche, chaque champ écrit dessus ; puis le rythme d\'envoi et le tampon du récepteur (ST 2110-21).',
  lecons: ['reseau-paquet', 'reseau-rythme'],
  lectures: ['Couche ouverte', 'Taille du paquet', 'Rythme', 'Tampon du récepteur'],
  depart: 'Chaque étape ouvre une couche de plus. Cliquez une couche pour lire ses champs.',
  vue: { cible: [0.8, 1.3, 0], dir: [0, 0.35, 1], dist: 9 },
  orbite: { rMin: 1, rMax: 18 },
  etapes: [
    { t: 'Une ligne, quatre paquets', ouvre: -1, lecon: 'reseau-paquet', vue: { cible: [PX, 2.3, 0], dir: [0, 0.2, 1], dist: 5.4 },
      texte: `En haut, une ligne de l'image (1 920 pixels). En 4:2:2 10 bits, deux pixels font **5 octets** : la ligne pèse 4 800 octets. Elle est coupée en **4 morceaux de 1 200 octets** (480 pixels), un par paquet.

4 paquets par ligne, 1 080 lignes : **4 320 paquets par image**, 216 000 par seconde en 1080p50. Ouvrons l'un d'eux.` },
    { t: 'Au cœur : les pixels', ouvre: 0, vue: { cible: [PX, PY, 0], dir: [0.15, 0.35, 1], dist: 4 },
      texte: `Toutes les couches extérieures sont soulevées : il reste la **charge utile**, 1 200 octets de pixels. Ils vont par **groupes de 5 octets** (un « pgroup », RFC 4175) : Cb, Y, Cr, Y, quatre échantillons de 10 bits pour deux pixels.

C'est 93 % du paquet : tout le reste, ce sont des étiquettes pour l'acheminer.` },
    { t: 'RFC 4175 : quelle ligne, quel pixel', ouvre: 1, vue: { cible: [PX, PY, 0], dir: [0.15, 0.35, 1], dist: 4.4 },
      texte: `Première enveloppe, **8 octets** : le numéro de séquence étendu, puis, pour le morceau transporté, sa **longueur**, son **numéro de ligne** et le **décalage** de son premier pixel.

Le récepteur range ainsi chaque morceau à sa place dans l'image, même si les paquets arrivent dans le désordre.` },
    { t: 'RTP : le numéro et l\'heure', ouvre: 2, vue: { cible: [PX, PY, 0], dir: [0.15, 0.35, 1], dist: 4.8 },
      texte: `**RTP**, 12 octets : le **numéro de séquence** (un trou dans la suite, c'est une perte ; ST 2022-7 s'en sert pour apparier les copies rouge et bleue), l'**horodatage** (l'heure PTP de l'image, en tics de 90 kHz), l'identifiant de la source, et le bit **M**, posé sur le dernier paquet de l'image.` },
    { t: 'UDP et IP : le port et le groupe', ouvre: 4, vue: { cible: [PX, PY, 0], dir: [0.15, 0.35, 1], dist: 5.4 },
      texte: `**UDP** (8 octets) donne le **port** : pas d'accusé de réception, pas de renvoi ; en direct, un paquet en retard ne sert à rien.

**IP** (20 octets) porte la **source** (la caméra) et la **destination**, le **groupe multicast** 239.1.1.1 : c'est ce couple (S, G) auquel les récepteurs s'abonnent. Son champ **DSCP** donne la priorité de la vidéo, son **TTL** compte les routeurs.` },
    { t: 'Ethernet, puis le fil : 1 286 octets', ouvre: 5, vue: { cible: [PX, PY, 0], dir: [0.15, 0.35, 1], dist: 6 },
      texte: `Dernière enveloppe, **Ethernet** : les adresses MAC (la destination est l'adresse multicast 01:00:5E suivie de 23 bits du groupe) et 4 octets de contrôle en fin de trame. Sur le fil s'ajoutent encore 8 octets de préambule et 12 de silence.

Total : **1 286 octets** sur le fil pour 1 200 de pixels. Sans trames jumbo, une trame ne dépasse pas le **MTU** de 1 500 octets ; au-delà, elle est jetée.` },
    { t: 'Le rythme : un émetteur étroit', ouvre: 6, rythme: 'N', lecon: 'reseau-rythme', vue: { cible: [4.8, 1.3, 0], dir: [0, 0.38, 1], dist: 6.8 },
      texte: `À droite, un émetteur envoie les paquets d'une image vers un récepteur, qui les lit au rythme de l'image. Le cylindre est son **tampon** : les paquets arrivés et pas encore lus.

Un émetteur **étroit** (type N, ST 2110-21) envoie ses paquets **régulièrement** pendant les lignes actives : le tampon reste presque vide. En 1080p50, un récepteur étroit n'a besoin que de **8 paquets** de tampon (VRX_FULL).` },
    { t: 'Le rythme : rafales et tampon qui déborde', ouvre: 6, rythme: 'rafale', vue: { cible: [4.8, 1.3, 0], dir: [0, 0.38, 1], dist: 6.8 },
      texte: `Un émetteur qui envoie par **rafales** remplit le tampon d'un coup. Un émetteur **large** (type W) est autorisé à le faire un peu : il lui faut un récepteur large, avec un tampon de 720 paquets en 1080p50. Au-delà de ce que tient le tampon, des **paquets sont perdus** : des morceaux d'image manquent.

Essayez les trois rythmes dans « À vous », et regardez le tampon.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { ouvre: 5, lift: LAYERS.map(() => 0), rythme: 'N', pend: [], lus: 0, n: 0, t: 0, pertes: 0 };
    // ---------------- la ligne d'image, coupée en quatre ----------------
    const strip = ecran(4.6, 0.16, 1024, (g, W, H) => { for (let x = 0; x < W; x++) { const [r, gg, b] = imageRGB(x / W, 0.5); g.fillStyle = `rgb(${r * 255 | 0},${gg * 255 | 0},${b * 255 | 0})`; g.fillRect(x, 0, 1, H); } for (const k of [1, 2, 3]) { g.fillStyle = '#000'; g.fillRect(k * W / 4 - 2, 0, 4, H); } });
    strip.mesh.position.set(PX, 3.0, 0); strip.mesh.userData.info = { nom: 'Une ligne de l\'image', texte: '1 920 pixels, 4 800 octets en 4:2:2 10 bits : quatre morceaux de 1 200 octets.' }; root.add(strip.mesh);
    const lt = texte('une ligne de 1 920 pixels = 4 800 octets', { h: 0.12 }); lt.position.set(PX, 3.25, 0); root.add(lt);
    const quarts = new THREE.Group(); root.add(quarts);
    for (let k = 0; k < 4; k++) {
      const x = PX - 1.725 + k * 1.15;
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.3), eclat(0xffd38a, 0.85)); b.position.set(x, 2.35, 0); quarts.add(b);
      b.userData.info = { nom: `Paquet ${k + 1} de la ligne`, texte: `Pixels ${k * 480 + 1} à ${k * 480 + 480} de la ligne : décalage ${k * 480} dans l'en-tête RFC 4175.` };
      const l = tube(courbe([[x, 2.9, 0], [x, 2.52, 0]]), 0.01, eclat(0xffffff, 0.6), 4, 6); quarts.add(l);
      const t = texte(`paquet ${k + 1}`, { h: 0.08 }); t.position.set(x, 2.35, 0.16); quarts.add(t);
    }
    // ---------------- le paquet : des coques emboîtées ----------------
    const shells = LAYERS.map((L, i) => {
      const g = new THREE.Group(); g.position.set(PX, PY, 0); root.add(g);
      const d = L.h;
      const body = new THREE.Mesh(new THREE.BoxGeometry(L.w, L.h, d), i === 0 ? mat('plastique', L.col, { roughness: 0.5 }) : verre(L.col, 0.13, { depthWrite: false }));
      body.userData.info = { nom: `${L.nom} · ${L.o} octets`, texte: L.champs.join(' ; ') + '.' };
      if (i) body.renderOrder = 10 - i;
      g.add(body);
      if (i) g.add(new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(L.w, L.h, d)), new THREE.LineBasicMaterial({ color: L.col })));
      // l'étiquette de la couche, sur son dessus : nom, taille, champs
      const E = ecran(Math.min(L.w - 0.1, 2.2), 0.42, 768, (gg, W, H) => {
        gg.fillStyle = 'rgba(8,16,20,.92)'; gg.fillRect(0, 0, W, H);
        gg.fillStyle = '#' + L.col.toString(16).padStart(6, '0'); gg.fillRect(0, 0, 10, H);
        gg.font = '700 34px "Archivo Narrow", sans-serif'; gg.fillText(`${L.nom} · ${L.o} octets`, 22, 40);
        gg.fillStyle = '#d3f3df'; gg.font = '24px "B612 Mono", monospace'; L.champs.forEach((c, k) => gg.fillText(c, 22, 78 + k * 30));
      });
      E.mesh.position.set(0, L.h / 2 + 0.24, 0); E.mesh.rotation.x = -0.35; g.add(E.mesh);
      E.mesh.userData.info = body.userData.info;
      g.userData.plate = E.mesh;
      return g;
    });
    // les groupes de 5 octets, posés sur la charge utile
    const pg = new THREE.Group(); pg.position.set(PX - 0.55, PY + 0.21 + 0.06, 0.12); root.add(pg);
    ['Cb', 'Y', 'Cr', 'Y'].forEach((n, k) => { const c = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), eclat([0x8ab8ff, 0xffd38a, 0xff8a80, 0xffd38a][k])); c.position.x = k * 0.15; pg.add(c); c.userData.info = { nom: `${n} : 10 bits`, texte: 'Quatre échantillons de 10 bits = 40 bits = 5 octets pour deux pixels (4:2:2).' }; });
    const pgT = ctx.label(pg, '5 octets = 2 pixels', { off: [0.22, -0.32, 0.2], cls: 'small' });
    // ---------------- le rythme : émetteur, piste, tampon ----------------
    const tx = piece('émetteur', 'plastique', (b) => { b.cbox(0.6, 0.6, 0.6, R0 - 0.4, RY, 0, 0x2a3138, 0.03); b.cbox(0.5, RY - 0.3, 0.5, R0 - 0.4, (RY - 0.3) / 2, 0, 0x1d2227, 0.02); });
    tx.userData.info = { nom: 'Émetteur ST 2110-20', texte: 'Il envoie les 4 320 paquets de chaque image, au rythme de son type (étroit, large).' }; root.add(tx);
    const rx = piece('récepteur', 'plastique', (b) => { b.cbox(0.6, 0.6, 0.6, R1 + 0.4, RY, 0, 0x2a3138, 0.03); b.cbox(0.5, RY - 0.3, 0.5, R1 + 0.4, (RY - 0.3) / 2, 0, 0x1d2227, 0.02); });
    rx.userData.info = { nom: 'Récepteur', texte: 'Il lit les paquets au rythme de l\'image ; ceux qui arrivent en avance attendent dans son tampon.' }; root.add(rx);
    const track = tube(courbe([[R0 - 0.1, RY, 0], [R1 + 0.1, RY, 0]]), 0.02, mat('alu', 0x59646f), 4, 8); root.add(track);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.6, 24, 1, true), verre(0xffffff, 0.12, { side: THREE.DoubleSide, depthWrite: false })); cyl.position.set(R1 + 0.4, RY + 1.15, 0); cyl.userData.passe = true; root.add(cyl);
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 1, 24), eclat(0x7fd1a0, 0.85)); fill.position.set(R1 + 0.4, RY + 0.35, 0); root.add(fill);
    fill.userData.info = { nom: 'Le tampon du récepteur', texte: 'Les paquets arrivés et pas encore lus. Un récepteur étroit en tient 8 (1080p50), un large 720.' };
    const lim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 8, 32), eclat(0xff6a5a)); lim.rotation.x = Math.PI / 2; root.add(lim);
    ctx.label(lim, 'tampon plein : récepteur étroit', { off: [0.75, 0, 0], cls: 'ko' });
    const tamponT = ctx.label(cyl, '', { off: [0, 0.95, 0], cls: 'small' });
    const runner = ctx.flux(120, new THREE.BoxGeometry(0.1, 0.07, 0.07), eclat(0xffffff));
    const line = courbe([[R0 - 0.05, RY + 0.06, 0], [R1 + 0.05, RY + 0.06, 0]]);
    const V = video('1080p50');
    const NIMG = 48; // paquets dessinés par image (à l'échelle de la scène)
    const CAP = 4; // le tampon d'un récepteur étroit, à l'échelle de la scène (8 paquets sur 4 320 en vrai)
    const PERIOD = 4.0; // durée d'une image dans la scène (s)
    function departs(type) {
      const out = [];
      for (let i = 0; i < NIMG; i++) {
        if (type === 'N') out.push(i / NIMG * 0.96);
        else if (type === 'W') out.push(Math.floor(i / 8) * 8 / NIMG * 0.96 + (i % 8) * 0.004);
        else out.push(0.05 + Math.floor(i / 24) * 0.45 + (i % 24) * 0.004);
      }
      return out.map((t) => t * PERIOD);
    }
    let sched = departs('N'), next = 0, tImg = 0;
    function setRythme(t) { S.rythme = t; sched = departs(t); next = 0; tImg = 0; S.pend = []; S.lus = 0; S.n = 0; S.pertes = 0; runner.clear(); lire(); }
    function lire() {
      const ty = S.rythme === 'N' ? 'étroit (N) : régulier pendant les lignes actives' : S.rythme === 'W' ? 'large (W) : petites rafales de 8' : 'rafales de 24 : non conforme';
      ctx.read('Rythme', ty);
      ctx.read('Taille du paquet', `${V.fil} octets sur le fil pour ${V.charge} de pixels (${fmtNum(V.efficacite * 100, 1)} % utiles) · ${fmtNum(V.pps, 0)} paquets/s`);
    }
    function setOuvre(k) {
      S.ouvre = k;
      ctx.read('Couche ouverte', k < 0 ? 'le paquet fermé' : k >= 6 ? 'le paquet entier, en route' : `${LAYERS[k].nom} (${LAYERS[k].o} octets)`);
    }
    lire(); setOuvre(-1);
    return {
      etape(i, E) {
        setOuvre(E.ouvre ?? -1);
        quarts.visible = (E.ouvre ?? -1) < 0;
        if (E.rythme) setRythme(E.rythme);
      },
      update(dt) {
        // les coques extérieures à la couche ouverte se soulèvent ; à l'étape « fermé » ou au rythme, tout est en place
        LAYERS.forEach((L, i) => {
          const up = S.ouvre >= 0 && S.ouvre < 6 && i > S.ouvre ? 1 : 0;
          S.lift[i] += (up - S.lift[i]) * Math.min(1, dt * 3);
          const g = shells[i]; g.position.y = PY + S.lift[i] * (1.2 + (i - S.ouvre) * 0.42);
          g.userData.plate.visible = S.ouvre === i || (S.ouvre < 0 && i === 5) || (S.ouvre >= 6 && i === 5);
        });
        pg.visible = S.ouvre === 0; pgT.show(S.ouvre === 0);
        // le rythme
        tImg += dt;
        while (next < sched.length && sched[next] <= tImg) { next++; S.n++; const it = runner.add({ curve: line, speed: 1.4, color: S.rythme === 'N' ? 0x7fd1a0 : S.rythme === 'W' ? 0xffd38a : 0xff6a5a, info: { nom: 'Paquet ST 2110-20', texte: 'En route vers le récepteur.' } }); it.onEnd = () => { S.pend.push(1); if (S.pend.length > CAP + 0.5) { S.pend.pop(); S.pertes++; } }; }
        // le récepteur lit à cadence régulière pendant les lignes actives
        const rate = NIMG / (PERIOD * 0.96);
        S.lus += dt * rate; while (S.lus >= 1 && S.pend.length) { S.pend.shift(); S.lus -= 1; } if (!S.pend.length) S.lus = Math.min(S.lus, 1);
        if (tImg > PERIOD + 1.5) { tImg = 0; next = 0; }
        const f = clamp(S.pend.length / CAP, 0, 1.05);
        fill.scale.y = Math.max(0.01, f * 1.5); fill.position.y = RY + 0.35 + f * 0.75;
        /** @type {any} */ (fill.material).color.set(f >= 1 ? 0xff6a5a : f > 0.6 ? 0xffd38a : 0x7fd1a0);
        lim.position.set(R1 + 0.4, RY + 0.35 + 1.5, 0);
        tamponT.set(`${S.pend.length} en attente`);
        ctx.read('Tampon du récepteur', `${S.pend.length} paquet${S.pend.length > 1 ? 's' : ''} en attente · ${S.pertes} perdu${S.pertes > 1 ? 's' : ''} (tampon d'un récepteur étroit)`);
      },
      commandes() {
        return el('div', { class: 'v3-ctl' },
          choice('Couche', [['-1', 'fermé'], ...LAYERS.map((L, i) => [String(i), L.nom.replace('En-tête ', '')])], '-1', (v) => { setOuvre(+v); quarts.visible = +v < 0; }),
          choice('Rythme', [['N', 'étroit (N)'], ['W', 'large (W)'], ['rafale', 'rafales']], S.rythme, (v) => { setRythme(v); ctx.say(v === 'N' ? 'Émetteur étroit : un paquet à intervalle régulier.' : v === 'W' ? 'Émetteur large : de petites rafales ; il faut un récepteur large.' : 'Rafales : le tampon d\'un récepteur étroit déborde, des paquets sont perdus.'); }));
      },
    };
  },
};
