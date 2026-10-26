// @ts-check
import * as THREE from 'three';
import { el, mulberry32 } from '../../util.js';
import { slider, fmtNum } from '../../cours/kit.js';
import { zone, ecran, inverse } from '../kit.js';
import { appareil, Reseau } from '../materiel.js';
import { debitTcp } from '../../cours/ip_calc.js';

// ----------------------------------------------------------------------------------
// Vue 3D « TCP et UDP sur un chemin qui perd » : deux voies côte à côte, traversant la même zone de pertes.
// En haut, TCP : poignée de main (SYN, SYN-ACK, ACK), segments numérotés, accusés cumulatifs qui reviennent,
// fenêtre qui grandit, et à chaque perte des accusés répétés puis une retransmission ; le récepteur garde en
// attente ce qui suit un trou (écran au-dessus de lui). En bas, UDP : des datagrammes au rythme constant, sans
// retour ; une perte laisse un trou, rien n'attend. Le temps est ralenti ; le débit réel de TCP à ce RTT et ce taux
// de pertes est calculé à part (formule de Mathis, cours/ip_calc.js).
// ----------------------------------------------------------------------------------
const C = { syn: 0xffd38a, seg: 0x7fd3f3, ack: 0xffd38a, re: 0xff9a8a, dg: 0x7fd1a0 };
const NMAX = 18;

export const VUE_RESEAU_TCPUDP = {
  id: 'reseau-tcpudp', chapitre: 'reseau', titre: 'TCP et UDP sur un chemin qui perd',
  resume: 'Deux voies dans la même zone de pertes : TCP accuse, retransmet et fait attendre ce qui suit un trou ; UDP garde son rythme et laisse des trous.',
  lecons: ['reseau-tcp-udp', 'reseau-streaming'],
  lectures: ['Le chemin', 'TCP : fenêtre', 'TCP : livrés dans l\'ordre', 'TCP : retransmissions', 'UDP : reçus et perdus', 'À l\'échelle réelle'],
  depart: 'En haut TCP, en bas UDP. Le temps est ralenti : un aller dure environ une seconde.',
  vue: { cible: [0, 1.1, 0.1], dir: [0, 0.55, 1], dist: 12.5 },
  orbite: { rMin: 1.5, rMax: 22 },
  etapes: [
    { t: 'Deux transports, deux voies', reglage: { perte: 0, rtt: 40 }, lecon: 'reseau-tcp-udp',
      texte: `En haut, un **serveur web** envoie un fichier à un PC, en **TCP**. En bas, une **caméra** envoie son flux à un récepteur, en **UDP**. Les deux voies traversent la même zone du réseau, celle où des paquets peuvent se perdre.

Chaque extrémité est une **socket** : une adresse et un **port**. Le serveur écoute sur le port 443 (HTTPS), le PC répond depuis un port libre élevé ; le flux RTP de la caméra vise le port 5004 du récepteur.` },
    { t: 'TCP : la poignée de main', reglage: { perte: 0, rtt: 40, seul: 'tcp' }, lecon: 'reseau-tcp-udp',
      texte: `Avant le premier octet utile, TCP ouvre une **connexion** : **SYN** (« je veux te parler »), **SYN-ACK** (« d'accord »), **ACK** (« c'est parti »). Un aller-retour complet passe sans rien transporter.

UDP n'en fait rien : le premier datagramme part tout de suite.` },
    { t: 'TCP : segments et accusés', reglage: { perte: 0, rtt: 40, seul: 'tcp' }, lecon: 'reseau-tcp-udp',
      texte: `Les segments sont **numérotés** (en bleu). Le récepteur renvoie des **accusés** (en jaune) : « j'ai tout jusqu'au n, j'attends le n + 1 ».

L'émetteur garde en vol une **fenêtre** de segments non acquittés ; elle grandit à chaque accusé (de 1 à 8 ici) : c'est ainsi que TCP cherche le débit du chemin. L'écran au-dessus du PC montre ce qu'il a reçu, dans l'ordre.` },
    { t: 'TCP : une perte, une retransmission', reglage: { perte: 12, rtt: 40, seul: 'tcp' }, lecon: 'reseau-tcp-udp',
      texte: `Des segments se perdent (✕). Le récepteur reçoit les suivants mais **ne les livre pas** : il les garde en mémoire (orange sur l'écran) et répète « j'attends le n ». Trois accusés identiques, et l'émetteur **renvoie** le segment manquant (en rouge), puis **divise sa fenêtre** par deux.

Tout finit par arriver, dans l'ordre, mais tout ce qui suivait la perte a attendu au moins un aller-retour : c'est le **blocage en tête de file**.` },
    { t: 'UDP : le rythme, sans accusé', reglage: { perte: 0, rtt: 40, seul: 'udp' }, lecon: 'reseau-tcp-udp',
      texte: `UDP envoie ses datagrammes au rythme du flux, sans connexion, sans accusé, sans rien attendre. Aucun retour : la voie du bas ne transporte que des paquets vers la droite.

Le récepteur les prend comme ils viennent ; RTP leur ajoute un numéro et un horodatage pour les remettre en ordre et à l'heure.` },
    { t: 'UDP : une perte, un trou', reglage: { perte: 12, rtt: 40, seul: 'udp' }, lecon: 'reseau-tcp-udp',
      texte: `Les mêmes pertes : chaque datagramme perdu laisse un **trou** (rouge sur l'écran du récepteur), un morceau d'image ou de son qui manque. Mais rien n'attend : le flux garde son rythme et son retard.

Pour le temps réel, c'est le bon choix ; la réparation se fait au-dessus, quand on peut se l'offrir : deux réseaux (ST 2022-7), de la correction en avance (FEC), ou des retransmissions bornées par un tampon (SRT, RIST).` },
    { t: 'Un long chemin qui perd : TCP s\'effondre', reglage: { perte: 5, rtt: 200 }, lecon: 'reseau-streaming',
      texte: `Aller-retour de 200 ms, 5 % de pertes : chaque perte coûte un aller-retour et divise la fenêtre, qui n'a jamais le temps de regrandir. À l'échelle réelle, une connexion TCP plafonne alors vers **0,3 Mb/s**, même sur une fibre à 1 Gb/s (formule de Mathis : lisez « À l'échelle réelle »).

C'est pourquoi un direct par Internet ne passe pas en TCP : on prend **SRT** ou **RIST**, de l'UDP qui ne redemande que les paquets perdus, dans un tampon de latence de quelques allers-retours.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { perte: 0, rtt: 40, seul: '', gen: 0 };
    // les appareils et les deux voies
    const srv = appareil('serveur', 'Serveur web', { info: { nom: 'Le serveur (TCP)', texte: 'Socket 10.1.60.20:443 : il envoie un fichier en TCP.' } });
    const pc = appareil('pc', 'PC', { info: { nom: 'Le PC (TCP)', texte: 'Socket 10.1.60.50:51515 : il reçoit le fichier, dans l\'ordre, et accuse réception.' } });
    const cam = appareil('camera', 'Caméra', { info: { nom: 'La caméra (UDP)', texte: 'Elle envoie son flux RTP en UDP vers le port 5004 du récepteur.' } });
    const rx = appareil('moniteur', 'Récepteur', { info: { nom: 'Le récepteur (UDP)', texte: 'Port 5004 : il prend les datagrammes comme ils viennent ; RTP les numérote.' } });
    srv.position.set(-3.9, 0, -1.3); pc.position.set(3.9, 0, -1.3); srv.rotation.y = Math.PI / 2; pc.rotation.y = -Math.PI / 2;
    cam.position.set(-3.9, 0, 1.5); rx.position.set(3.9, 0, 1.5); cam.rotation.y = Math.PI / 2; rx.rotation.y = -Math.PI / 2;
    root.add(srv, pc, cam, rx);
    ctx.label(srv, 'TCP · 10.1.60.20:443', { off: [0, 1.35, 0], cls: 'small' }); ctx.label(pc, '10.1.60.50:51515', { off: [0, 1.5, 0], cls: 'small' });
    ctx.label(cam, 'UDP · RTP 10.1.20.11', { off: [0, 1.65, 0], cls: 'small' }); ctx.label(rx, 'port 5004', { off: [0, 1.5, 0], cls: 'small' });
    const net = new Reseau(ctx, root, 200);
    const Lt = net.relie({ obj: srv }, { obj: pc }, { couleur: 0x4a6a8a, sag: 0.05, info: { nom: 'La voie TCP', texte: 'Segments vers la droite, accusés vers la gauche.' } });
    const Lu = net.relie({ obj: cam }, { obj: rx }, { couleur: 0x4a6a8a, sag: 0.05, info: { nom: 'La voie UDP', texte: 'Des datagrammes vers la droite, et rien en retour.' } });
    const zp = zone(1.8, 1.6, 4.4, 0xff6a5a, { opacity: 0.07 }); zp.position.set(0, 0.8, 0.15); zp.userData.fill.userData.passe = true; zp.userData.edges.userData.passe = true; root.add(zp);
    const zTag = ctx.label(new THREE.Vector3(0, 1.75, 0.15), '', { cls: 'hot' });
    // les écrans des récepteurs
    const scT = ecran(2.8, 0.66, 760, () => {}); scT.mesh.position.set(2.6, 2.45, -1.45); root.add(scT.mesh);
    const scU = ecran(2.8, 0.66, 760, () => {}); scU.mesh.position.set(2.4, 0.95, 2.75); scU.mesh.rotation.x = -0.5; root.add(scU.mesh);
    scT.mesh.userData.info = { nom: 'Ce que le PC a reçu (TCP)', texte: 'Vert : livré à l\'application, dans l\'ordre. Orange : reçu mais en attente d\'un segment manquant.' };
    scU.mesh.userData.info = { nom: 'Ce que le récepteur a reçu (UDP)', texte: 'Vert : reçu. Rouge : perdu, un trou dans l\'image ou le son.' };
    // les croix des pertes (une réserve d'étiquettes réutilisées)
    const croix = Array.from({ length: 8 }, () => { const L = ctx.label(new THREE.Vector3(), '✕', { cls: 'word ko' }); L.show(false); return { L, until: 0 }; });
    let t = 0;
    const perdu = (curve) => { const c = croix.find((x) => x.until < t) || croix[0]; c.L.target.copy(curve.getPointAt(0.5)); c.L.show(true); c.until = t + 1.4; };
    // la simulation
    let T, U, rnd = mulberry32(5);
    const reset = () => {
      S.gen++; net.clear(); rnd = mulberry32(5); t = 0;
      T = { etat: 'syn', base: 1, next: 1, cwnd: 1, dup: 0, attendu: 1, tampon: new Set(), livres: [], retrans: 0, gap: 0, prog: 0, synT: 0.3 };
      U = { next: 1, recus: [], gap: 0.4, perdus: 0 };
    };
    const allerS = () => 0.45 + S.rtt / 120; // un aller, en secondes de la vue
    const vit = (curve) => curve.getLength() / allerS();
    const enVol = (gen, f) => (...a) => { if (gen === S.gen) f(...a); };
    function envoiSeg(n, re) {
      const lost = S.perte > 0 && rnd() < S.perte / 100;
      net.flux.add({ curve: Lt.curve, speed: vit(Lt.curve), color: re ? C.re : C.seg, scale: [0.16, 0.1, 0.1], to: lost ? 0.5 : 1, info: { nom: `Segment ${n}${re ? ' (retransmis)' : ''}`, texte: 'Numéroté : le récepteur sait où il se range.' }, onEnd: enVol(S.gen, () => (lost ? perdu(Lt.curve) : recoit(n))) });
    }
    function recoit(n) {
      if (n === T.attendu) { T.attendu++; while (T.tampon.has(T.attendu)) { T.tampon.delete(T.attendu); T.attendu++; } T.livres.push(n); }
      else if (n > T.attendu) T.tampon.add(n);
      const a = T.attendu;
      net.flux.add({ curve: inverse(Lt.curve), speed: vit(Lt.curve), color: C.ack, scale: [0.09, 0.06, 0.06], info: { nom: `Accusé : j'attends ${a}`, texte: 'Cumulatif : tout ce qui précède est bien arrivé.' }, onEnd: enVol(S.gen, () => accuse(a)) });
      dessineT();
    }
    function accuse(a) {
      if (a > T.base) { T.base = a; T.dup = 0; T.cwnd = Math.min(8, T.cwnd + 1); T.prog = t; }
      else if (a === T.base && T.next > T.base) { T.dup++; if (T.dup === 3) { envoiSeg(T.base, true); T.retrans++; T.cwnd = Math.max(1, Math.floor(T.cwnd / 2)); T.prog = t; ctx.say(`Trois accusés « j'attends ${T.base} » : l'émetteur renvoie le segment ${T.base} et divise sa fenêtre.`); } }
      lire();
    }
    function poignee() {
      const v = vit(Lt.curve), g = S.gen;
      net.flux.add({ curve: Lt.curve, speed: v, color: C.syn, scale: [0.14, 0.12, 0.12], info: { nom: 'SYN', texte: '« Je veux te parler. »' }, onEnd: enVol(g, () => {
        net.flux.add({ curve: inverse(Lt.curve), speed: v, color: C.syn, scale: [0.14, 0.12, 0.12], info: { nom: 'SYN-ACK', texte: '« D\'accord. »' }, onEnd: enVol(g, () => {
          net.flux.add({ curve: Lt.curve, speed: v, color: C.syn, scale: [0.14, 0.12, 0.12], info: { nom: 'ACK', texte: '« C\'est parti. » La connexion est ouverte.' }, onEnd: enVol(g, () => { T.etat = 'data'; T.prog = t; ctx.say('Connexion ouverte : un aller-retour et demi sans données utiles.'); }) });
          T.etat = 'data-wait';
        }) });
      }) });
    }
    function dessine(E, cases, titre) {
      const g = E.g, W = E.W, H = E.H;
      g.fillStyle = '#081014'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#e8ece6'; g.font = '600 34px "Archivo Narrow", sans-serif'; g.fillText(titre, 14, 38);
      const w = (W - 28) / NMAX;
      cases.slice(-NMAX).forEach(([n, c], i) => { g.fillStyle = c; g.fillRect(14 + i * w + 1, 54, w - 4, H - 66); g.fillStyle = '#0b0e10'; g.font = '600 22px "B612 Mono", monospace'; g.fillText(String(n), 14 + i * w + 4, H - 26); });
      E.mesh.material.map.needsUpdate = true;
    }
    function dessineT() {
      const cases = [...T.livres.map((n) => [n, '#7fd1a0'])];
      const enAttente = [...T.tampon].sort((a, b) => a - b);
      if (enAttente.length) { cases.push([T.attendu, '#2a3238']); for (const n of enAttente) cases.push([n, '#ffb020']); }
      dessine(scT, cases, enAttente.length ? `PC : ${T.livres.length} livrés · ${enAttente.length} en attente du ${T.attendu}` : `PC : ${T.livres.length} segments livrés dans l'ordre`);
    }
    function dessineU() { dessine(scU, U.recus, `Récepteur : ${U.recus.filter((c) => c[1] === '#7fd1a0').length} reçus · ${U.perdus} perdus`); }
    function lire() {
      ctx.read('Le chemin', `aller-retour ${S.rtt} ms · pertes ${S.perte} %`);
      ctx.read('TCP : fenêtre', T.etat === 'data' ? `${T.cwnd} segment${T.cwnd > 1 ? 's' : ''} en vol au plus` : 'connexion en cours d\'ouverture');
      ctx.read('TCP : livrés dans l\'ordre', `${T.livres.length}${T.tampon.size ? ` (${T.tampon.size} en attente du ${T.attendu})` : ''}`);
      ctx.read('TCP : retransmissions', String(T.retrans));
      ctx.read('UDP : reçus et perdus', `${U.recus.length - U.perdus} reçus, ${U.perdus} perdus`);
      const d = debitTcp(S.rtt, S.perte / 100, 1000);
      ctx.read('À l\'échelle réelle', S.perte ? `TCP plafonne vers ${fmtNum(d, d < 10 ? 1 : 0)} Mb/s sur un lien à 1 Gb/s ; UDP garde son débit, avec ${S.perte} % de trous` : 'sans perte, TCP remplit le lien et UDP passe intact');
      zTag.set(`aller-retour ${S.rtt} ms · pertes ${S.perte} %`);
    }
    reset(); dessineT(); dessineU(); lire();
    let ui = null;
    const sync = () => { if (!ui) return; for (const r of ui.querySelectorAll('input[type=range]')) { const k = /** @type {HTMLInputElement} */ (r).name; /** @type {HTMLInputElement} */ (r).value = String(/** @type {any} */ (S)[k]); const o = r.nextElementSibling; if (o) o.textContent = k === 'rtt' ? `${S.rtt} ms` : `${S.perte} %`; } };
    return {
      etape(i, E) { const R = E.reglage || {}; S.perte = R.perte ?? 0; S.rtt = R.rtt ?? 40; S.seul = R.seul || ''; reset(); dessineT(); dessineU(); lire(); sync(); },
      update(dt) {
        t += dt;
        for (const c of croix) if (c.until && c.until < t) { c.L.show(false); c.until = 0; }
        // TCP
        if (S.seul !== 'udp') {
          if (T.etat === 'syn') { T.synT -= dt; if (T.synT <= 0) { T.etat = 'hs'; poignee(); } }
          if (T.etat === 'data') {
            T.gap -= dt;
            if (T.gap <= 0 && T.next < T.base + T.cwnd) { envoiSeg(T.next, false); T.next++; T.gap = 0.16; lire(); }
            if (T.base < T.next && t - T.prog > 3.2 * allerS()) { envoiSeg(T.base, true); T.retrans++; T.cwnd = 1; T.prog = t; ctx.say(`Pas d'accusé à temps : l'émetteur renvoie le segment ${T.base} et repart avec une fenêtre de 1.`); }
          }
        }
        // UDP
        if (S.seul !== 'tcp') {
          U.gap -= dt;
          if (U.gap <= 0) {
            U.gap = 0.32; const n = U.next++, lost = S.perte > 0 && rnd() < S.perte / 100;
            net.flux.add({ curve: Lu.curve, speed: vit(Lu.curve), color: C.dg, scale: [0.14, 0.09, 0.09], to: lost ? 0.5 : 1, info: { nom: `Datagramme ${n}`, texte: 'Pas d\'accusé : il arrive ou il est perdu.' }, onEnd: enVol(S.gen, () => { if (lost) { perdu(Lu.curve); U.recus.push([n, '#ff6a5a']); U.perdus++; } else U.recus.push([n, '#7fd1a0']); U.recus.sort((a, b) => a[0] - b[0]); dessineU(); lire(); }) });
          }
        }
      },
      commandes() {
        ui = el('div', { class: 'v3-ctl' },
          slider('Aller-retour (RTT)', 10, 300, S.rtt, 10, (v) => { S.rtt = v; lire(); }, (v) => `${v} ms`),
          slider('Pertes', 0, 20, S.perte, 1, (v) => { S.perte = v; lire(); }, (v) => `${v} %`),
          el('div', { class: 'v3-row' }, el('button', { type: 'button', class: 'btn small primary', onclick: () => { S.seul = ''; reset(); dessineT(); dessineU(); lire(); ctx.say('On recommence : nouvelle connexion TCP, nouveau flux UDP.'); } }, 'Recommencer les deux')));
        const rs = ui.querySelectorAll('input[type=range]'); /** @type {HTMLInputElement} */ (rs[0]).name = 'rtt'; /** @type {HTMLInputElement} */ (rs[1]).name = 'perte';
        return ui;
      },
    };
  },
};
