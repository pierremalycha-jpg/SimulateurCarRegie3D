// @ts-check
import * as THREE from 'three';
import { el, mulberry32 } from '../../util.js';
import { slider, fmtNum } from '../../cours/kit.js';
import { mat, eclat, verre, piece, texte, courbe, tube, zone, inverse } from '../kit.js';
import { appareil } from '../materiel.js';
import { propagationMs, bondSatelliteMs, budgetLatence, latenceSrt, debitTcp } from '../../cours/ip_calc.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Du car au monde : LAN, MAN, WAN et streaming » : une carte schématique (pas à l'échelle). Le car et
// le stade (LAN), la boucle de fibre de la ville jusqu'au centre technique (MAN), la fibre de l'opérateur jusqu'à
// la régie finale (WAN), le détour par un satellite géostationnaire, Internet (avec la box du car qui traduit les
// adresses, et SRT qui redemande les paquets perdus), puis la plateforme (RTMP) et la distribution au public
// (HLS par un CDN). Les paquets vont plus ou moins vite selon la latence réelle du chemin (échelle logarithmique) ;
// les chiffres viennent de cours/ip_calc.js (propagation, bond satellite, latence SRT, débit de TCP).
// ----------------------------------------------------------------------------------
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const POS = { car: V(-4.6, 0, 1.3), stade: V(-5.0, 0, -0.9), centre: V(-0.9, 0, 0.1), regie: V(5.0, 0, -0.5), box: V(-3.7, 0, 2.1), sat: V(0.2, 5.0, -1.6), teleport: V(3.8, 0, -1.6), nuage: V(1.0, 1.9, 2.2), plateforme: V(6.0, 0, 1.7) };

export const VUE_RESEAU_WAN = {
  id: 'reseau-wan', chapitre: 'reseau', titre: 'Du car au monde : LAN, MAN, WAN et streaming',
  resume: 'Le car et le stade (LAN), la fibre de la ville (MAN), la fibre de l\'opérateur, le satellite et Internet (WAN) ; la box qui traduit les adresses, SRT qui redemande les pertes, RTMP vers la plateforme, HLS vers le public.',
  lecons: ['reseau-etendue', 'reseau-streaming', 'reseau-nat'],
  lectures: ['Étendue', 'Chemin', 'Aller', 'Ce qui protège le flux', 'Retard au spectateur'],
  depart: 'Une carte, pas à l\'échelle. Les paquets vont plus ou moins vite selon la latence réelle du chemin.',
  vue: { cible: [0.6, 1.3, 1.0], dir: [0, 0.8, 1], dist: 15.5 },
  orbite: { rMin: 2, rMax: 26 },
  etapes: [
    { t: 'Le LAN : le car et le stade', mode: 'lan', lecon: 'reseau-etendue', vue: { cible: [-4.6, 0.6, 0.4], dir: [0.1, 0.6, 1], dist: 6 },
      texte: `Le **réseau local** (LAN) : le car, ses commutateurs, les caméras du stade reliées par fibre. Quelques centaines de mètres de câble, un seul exploitant qui règle tout (VLAN, QoS), des débits de 1 à 100 Gb/s.

Un aller prend quelques microsecondes : on ne le voit même pas.` },
    { t: 'Le MAN : le stade relié à la ville', mode: 'man', lecon: 'reseau-etendue', vue: { cible: [-2.4, 0.5, 0.6], dir: [0, 0.75, 1], dist: 8.5 },
      texte: `Le **réseau métropolitain** (MAN) : une boucle de fibre fait le tour de la ville et relie le stade au **centre technique** de l'opérateur. Fibre louée, ou **fibre noire** que l'on éclaire avec ses propres équipements.

Une quinzaine de kilomètres : environ **0,07 ms** de propagation (5 µs par kilomètre).` },
    { t: 'Le WAN : la fibre de l\'opérateur', mode: 'wan', lecon: 'reseau-etendue', vue: { cible: [1.6, 0.6, 0], dir: [0, 0.7, 1], dist: 11 },
      texte: `Du centre technique, la **fibre de l'opérateur** porte le programme jusqu'à la **régie finale**, à Paris : environ 250 km de câble. Un réseau étendu (WAN) managé : l'opérateur garantit le débit et la disponibilité.

Environ **1,3 ms** pour l'aller : la propagation (1,25 ms) et la traversée des équipements. C'est le chemin TX1 du car.` },
    { t: 'Le satellite : 72 000 km de détour', mode: 'sat', lecon: 'reseau-etendue', vue: { cible: [0, 2.4, 0], dir: [0, 0.3, 1], dist: 13 },
      texte: `Le chemin de secours (TX2) monte vers un **satellite géostationnaire**, à 35 786 km au-dessus de l'équateur, et redescend vers un **téléport** près de la régie. Montée et descente : environ **240 ms**, avant tout codage.

Pour une contribution, ce retard est acceptable ; pour un **duplex** (une interview à distance), il dépasse les 150 ms qu'une conversation supporte : les interlocuteurs se coupent la parole.` },
    { t: 'Internet : la box traduit les adresses', mode: 'net', lecon: 'reseau-nat', vue: { cible: [-0.7, 1.0, 1.5], dir: [0, 0.6, 1], dist: 11.5 },
      texte: `Troisième chemin : **Internet**, par la box (ou le modem 4G) du car. Le car est en adresses privées : la box **traduit** chaque sortie vers son adresse publique et un port à elle (NAT), et note la correspondance.

L'encodeur **appelle** (SRT en mode caller) : sa sortie ouvre la ligne. La régie **écoute** sur un port public, redirigé vers son décodeur (listener). Dans l'autre sens, un appel n'entrerait pas.` },
    { t: 'SRT : redemander ce qui se perd', mode: 'srt', lecon: 'reseau-streaming', vue: { cible: [0.6, 1.2, 1.0], dir: [0, 0.55, 1], dist: 14 },
      texte: `Internet perd des paquets (✕ dans le nuage). La régie repère le trou grâce aux numéros et **redemande** le paquet (accusé négatif, en rouge) ; le car le **renvoie** (en orange). Tout cela doit tenir dans le **tampon de latence** de SRT : ici, de l'ordre de 3 à 4 fois l'aller-retour.

Réglez l'aller-retour et les pertes dans « À vous » : la latence conseillée suit (guide de déploiement de Haivision).` },
    { t: 'Vers la plateforme : RTMP', mode: 'rtmp', lecon: 'reseau-streaming', vue: { cible: [5.4, 0.6, 0.6], dir: [0.1, 0.6, 1], dist: 6.5 },
      texte: `La régie envoie aussi le direct vers une **plateforme** (YouTube, Twitch…) en **RTMP** : une connexion **TCP** sur le port 1935, identifiée par une clé de diffusion. Les segments partent, les **accusés** reviennent.

Sur un lien qui perd, TCP retransmet et ralentit : le direct prend du retard. On garde de la marge sur le débit.` },
    { t: 'Vers le public : HLS et le CDN', mode: 'hls', lecon: 'reseau-streaming', vue: { cible: [5.4, 0.6, 2.6], dir: [0, 0.75, 1], dist: 8 },
      texte: `La plateforme découpe le direct en **segments** de quelques secondes (les gros blocs), en plusieurs qualités, et les sert par **HTTP**. Les serveurs d'un **CDN** les gardent près des spectateurs : chacun télécharge chez le plus proche.

Le lecteur attend plusieurs segments avant de commencer : **10 à 30 s** de retard sur le direct, le prix de la robustesse.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { mode: 'lan', rtt: 40, perte: 4, t: 0, gen: 0 };
    // ---------------- le décor ----------------
    const sol = zone(14.5, 0.02, 7.6, 0x2c3a44, { opacity: 0.25, edge: 0.15 }); sol.position.set(0.8, 0.01, 1.2); sol.userData.fill.userData.passe = true; root.add(sol);
    const stade = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.2, 10, 40), mat('beton', 0x6a7078)); stade.rotation.x = Math.PI / 2; stade.position.copy(POS.stade).setY(0.2); stade.scale.set(1, 0.7, 1); root.add(stade);
    const pel = new THREE.Mesh(new THREE.CircleGeometry(0.75, 32), mat('herbe', 0x2f7a3a)); pel.rotation.x = -Math.PI / 2; pel.position.copy(POS.stade).setY(0.03); root.add(pel);
    stade.userData.info = { nom: 'Le stade', texte: 'Les caméras, reliées au car par fibre : le réseau local de la captation.' };
    const car = piece('Car régie', 'laque', (b) => { b.cbox(1.5, 0.48, 0.48, 0.2, 0.34, 0, 0x2a3138, 0.03); b.cbox(0.38, 0.4, 0.46, -0.78, 0.3, 0, 0x1d2227, 0.03); }); car.position.copy(POS.car); root.add(car);
    car.userData.info = { nom: 'Le car régie', texte: 'Son réseau local (LAN) : commutateurs, VLAN, adresses privées 10.1.x.x.' };
    const ville = piece('La ville', 'beton', (b) => { const r = mulberry32(3); for (let i = 0; i < 14; i++) { const a = r() * Math.PI * 2, d = r() * 1.05, h = 0.25 + r() * 0.7; b.cbox(0.22, h, 0.22, -2.2 + Math.cos(a) * d, h / 2, 0.3 + Math.sin(a) * d, 0x4a5058, 0.02); } }); root.add(ville);
    const centre = piece('Centre technique', 'beton', (b) => { b.cbox(0.6, 0.55, 0.5, 0, 0.28, 0, 0x5a6470, 0.03); }); centre.position.copy(POS.centre); root.add(centre);
    centre.userData.info = { nom: 'Le centre technique de l\'opérateur', texte: 'Là où la boucle de la ville rejoint le réseau national de l\'opérateur.' };
    const regie = piece('Régie finale', 'beton', (b) => { b.cbox(1.0, 0.9, 0.7, 0, 0.45, 0, 0x4a5568, 0.03); }); regie.position.copy(POS.regie); root.add(regie);
    regie.userData.info = { nom: 'La régie finale (Paris)', texte: 'Elle reçoit la contribution du car, met le programme à l\'antenne et le distribue.' };
    const sat = piece('Satellite', 'alu', (b) => { b.cbox(0.3, 0.3, 0.3, 0, 0, 0, 0xc8b070, 0.02); b.cbox(1.4, 0.02, 0.34, 0, 0, 0, 0x2a4a7a, 0.004); }, { mat: { metalness: 0.5, roughness: 0.4 } }); sat.position.copy(POS.sat); root.add(sat);
    sat.userData.info = { nom: 'Satellite géostationnaire', texte: 'À 35 786 km : il semble immobile dans le ciel. Un bond (montée et descente) : environ 240 ms.' };
    const tel = piece('Téléport', 'alu', (b) => { b.cyl(0.05, 0.05, 0.5, 0, 0.25, 0, 0x9aa4ad, 10); b.cyl(0.42, 0.06, 0.12, 0, 0.62, 0, 0xd8dce0, 24); }); tel.position.copy(POS.teleport); root.add(tel);
    tel.userData.info = { nom: 'Le téléport', texte: 'La grande parabole qui reçoit le satellite et renvoie le signal à la régie.' };
    const box = appareil('portable', 'Box / 4G', { info: { nom: 'La box (ou le modem 4G) du car', texte: 'Elle fait sortir le car sur Internet en traduisant ses adresses privées (NAT).' } }); box.scale.setScalar(0.7); box.position.copy(POS.box); root.add(box);
    const nuage = new THREE.Group(); for (const [x, y, z, r] of [[0, 0, 0, 0.7], [0.65, 0.1, 0.1, 0.55], [-0.6, 0.05, -0.05, 0.5], [0.2, 0.4, -0.1, 0.5]]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), verre(0xbfd8e8, 0.12, { depthWrite: false })); m.position.set(x, y, z); m.userData.passe = true; nuage.add(m); }
    nuage.position.copy(POS.nuage); root.add(nuage);
    const plat = appareil('serveur', 'Plateforme', { info: { nom: 'La plateforme (YouTube, Twitch…)', texte: 'Elle reçoit en RTMP, réencode en plusieurs qualités et découpe en segments HLS.' } }); plat.position.copy(POS.plateforme); root.add(plat);
    const cdn = [V(4.6, 0, 3.3), V(6.0, 0, 3.6), V(7.3, 0, 3.1)].map((p, i) => { const o = appareil('serveur', `CDN ${i + 1}`, { info: { nom: 'Un serveur du CDN', texte: 'Il garde les segments en cache, près des spectateurs.' } }); o.scale.setScalar(0.6); o.position.copy(p); root.add(o); return o; });
    // les spectateurs : des téléphones dressés, écran allumé vers nous
    const SPX = (i) => 4.1 + i * 0.42, SPZ = (i) => 4.5 + (i % 2) * 0.22;
    const ecrans = piece('Spectateurs', 'plastique', (b) => { for (let i = 0; i < 9; i++) b.cbox(0.2, 0.36, 0.03, SPX(i), 0.24, SPZ(i), 0x1d2227, 0.012); }); root.add(ecrans);
    const gEcran = new THREE.PlaneGeometry(0.16, 0.3), mEcran = eclat(0x9fd8ff, 0.92);
    for (let i = 0; i < 9; i++) { const e = new THREE.Mesh(gEcran, mEcran); e.position.set(SPX(i), 0.24, SPZ(i) + 0.017); e.userData.passe = true; root.add(e); }
    ecrans.userData.info = { nom: 'Les spectateurs', texte: 'Chacun télécharge les segments chez le serveur du CDN le plus proche.' };
    // ---------------- les liaisons ----------------
    const voie = (pts, col, r = 0.035, op = 1) => { const c = courbe(pts); const m = tube(c, r, op < 1 ? eclat(col, op) : mat('plastique', col, { roughness: 0.5 }), 96, 8); m.userData.passe = op < 1; root.add(m); return { c, m }; };
    const ring = []; for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2; ring.push([-2.2 + Math.cos(a) * 1.5, 0.06, 0.3 + Math.sin(a) * 1.5]); }
    voie(ring, 0xffb020, 0.03);
    const W = {
      lan: voie([[-4.2, 0.4, 1.1], [-4.6, 0.3, 0.2], [-4.9, 0.25, -0.4]], 0x7fd1a0, 0.03),
      man: voie([[-3.9, 0.35, 1.2], [-3.4, 0.07, 0.9], [-3.6, 0.06, 0.3], [-2.2, 0.06, -1.2], [-1.1, 0.06, -0.6], [-0.9, 0.3, -0.1]], 0xffb020, 0.04),
      wan: voie([[-0.6, 0.3, 0.1], [0.6, 0.06, -0.4], [2.6, 0.06, -0.3], [4.0, 0.06, -0.6], [4.6, 0.4, -0.5]], 0xd08cff, 0.05),
      sat: voie([[-4.4, 0.6, 1.2], [-2, 3.2, -0.4], [0.1, 4.9, -1.6], [2.2, 3.2, -1.7], [3.8, 0.75, -1.6], [4.6, 0.6, -0.8]], 0x7fd3f3, 0.02, 0.5),
      net: voie([[-3.6, 0.5, 2.1], [-2, 1.2, 2.3], [1.0, 1.9, 2.2], [3.2, 1.3, 1.2], [4.6, 0.6, -0.2]], 0x9aa4ad, 0.025, 0.55),
      rtmp: voie([[5.3, 0.5, -0.1], [5.7, 0.35, 0.8], [6.0, 0.5, 1.4]], 0x7fd3f3, 0.03),
    };
    W.wan.m.userData.info = { nom: 'La fibre de l\'opérateur (WAN)', texte: 'Environ 250 km de fibre jusqu\'à Paris : 1,25 ms de propagation.' };
    W.sat.m.userData.info = { nom: 'Le bond satellite', texte: '2 × 35 786 km à la vitesse de la lumière : environ 240 ms.' };
    W.net.m.userData.info = { nom: 'Internet', texte: 'Un chemin sans garantie : le débit varie, des paquets se perdent.' };
    const hls = cdn.map((o) => voie([[6.1, 0.5, 1.9], [(6.1 + o.position.x) / 2, 0.5, (1.9 + o.position.z) / 2], [o.position.x, 0.45, o.position.z - 0.1]], 0x7fd1a0, 0.02));
    const vers = cdn.map((o, i) => voie([[o.position.x, 0.4, o.position.z + 0.1], [SPX(1 + i * 3), 0.3, SPZ(1 + i * 3) - 0.05]], 0x7fd1a0, 0.012));
    // étiquettes
    const T = (pos, t) => { const x = texte(t, { h: 0.2, bg: 'rgba(12,16,20,.84)' }); x.position.copy(pos); root.add(x); return x; };
    T(V(-4.8, 1.2, 2.2), 'LAN · le car'); T(V(-2.2, 1.4, -1.3), 'MAN · la ville'); T(V(1.8, 0.9, -1.0), 'WAN · fibre d\'opérateur, 250 km'); T(V(-1.2, 4.6, -1.6), 'WAN · satellite'); T(V(1.0, 2.9, 2.2), 'Internet');
    const tagBox = ctx.label(box, '', { off: [0, 1.2, 0], cls: 'small' }), tagRegie = ctx.label(regie, '', { off: [0, 1.4, 0], cls: 'small' }), tagNuage = ctx.label(nuage, '', { off: [0, 1.0, 0], cls: 'hot' });
    // ---------------- les paquets ----------------
    const F = ctx.flux(260, new THREE.BoxGeometry(1, 1, 1), eclat(0xffffff));
    const croix = Array.from({ length: 6 }, () => { const L = ctx.label(V(0, 0, 0), '✕', { cls: 'word ko' }); L.show(false); return { L, until: 0 }; });
    const visu = (ms) => 0.6 + 0.85 * Math.log10(1 + ms); // secondes de la vue pour un aller de ms millisecondes
    const vit = (c, ms) => c.getLength() / visu(ms);
    let rnd = mulberry32(9), tick = 0, seq = 0;
    const agenda = [];
    const plan = (dt, f) => agenda.push({ at: S.t + dt, f, gen: S.gen });
    const allerNet = () => S.rtt / 2;
    function envoie(c, ms, o = {}) { return F.add({ curve: c, speed: vit(c, ms), color: o.col ?? 0xffd38a, scale: o.taille ?? [0.16, 0.1, 0.1], to: o.to ?? 1, info: o.info, onEnd: o.fin }); }
    function lire() {
      const fib = budgetLatence({ km: 250, sauts: 6, gbps: 10, equipementUs: 20 }), man = propagationMs(15), sl = latenceSrt(S.rtt, S.perte);
      const R = {
        lan: ['LAN : le car et le stade', 'fibre et cuivre dans le car', 'quelques µs', 'VLAN, QoS, deux réseaux en car IP', 'le direct n\'est pas encore parti'],
        man: ['MAN : la ville', 'boucle de fibre, ≈ 15 km', `${fmtNum(man, 2)} ms de propagation`, 'fibre louée ou noire, chemins doublés', '—'],
        wan: ['WAN managé', 'fibre de l\'opérateur, ≈ 250 km', `${fmtNum(fib.total, 2)} ms (propagation ${fmtNum(fib.prop, 2)} ms)`, 'un débit garanti par l\'opérateur (SLA), deux routes', '—'],
        sat: ['WAN par satellite', '2 × 35 786 km', `≈ ${fmtNum(bondSatelliteMs(), 0)} ms pour un bond`, 'chemin indépendant de la fibre : le secours', '—'],
        net: ['WAN par Internet', 'box ou 4G, puis Internet', `≈ ${fmtNum(allerNet(), 0)} ms (aller-retour ${S.rtt} ms)`, 'traduction d\'adresses à la sortie ; SRT en caller, la régie en listener', '—'],
        srt: ['Internet, protégé par SRT', `aller-retour ${S.rtt} ms, ${S.perte} % de pertes`, `≈ ${fmtNum(allerNet(), 0)} ms + tampon`, sl ? `SRT : tampon de ${sl.latence} ms (${sl.mult} × l'aller-retour), ≈ ${sl.surdebit} % de débit en plus pour les renvois` : 'plus de 40 % de pertes : inutilisable', '—'],
        rtmp: ['Vers la plateforme', 'RTMP sur TCP, port 1935', `aller-retour ${S.rtt} ms`, `TCP : retransmissions ; à ${S.perte} % de pertes, ≈ ${fmtNum(debitTcp(S.rtt, S.perte / 100, 1000), 1)} Mb/s possibles`, 'de 2 à 5 s, plus la plateforme'],
        hls: ['Vers le public', 'HLS par HTTP, un CDN', 'segments de 6 s', 'TCP, plusieurs qualités au choix du lecteur', '10 à 30 s (2 à 5 s en basse latence)'],
      }[S.mode];
      ['Étendue', 'Chemin', 'Aller', 'Ce qui protège le flux', 'Retard au spectateur'].forEach((k, i) => ctx.read(k, R[i]));
      const nat = S.mode === 'net' || S.mode === 'srt';
      tagBox.set(nat ? 'NAT : 10.1.90.20:5000 → 203.0.113.7:40000' : ''); tagBox.show(nat);
      tagRegie.set(nat ? 'SRT listener : port 9000 (redirigé)' : S.mode === 'rtmp' ? 'encodeur RTMP' : ''); tagRegie.show(nat || S.mode === 'rtmp');
      tagNuage.set(S.mode === 'srt' ? `pertes ${S.perte} %` : ''); tagNuage.show(S.mode === 'srt');
    }
    function demarre() { S.gen++; F.clear(); agenda.length = 0; rnd = mulberry32(9); tick = 0; seq = 0; lire(); }
    function emet() {
      const m = S.mode, g = S.gen;
      if (m === 'lan') { envoie(W.lan.c, 0.001, { col: 0x7fd1a0, info: { nom: 'Une image de caméra', texte: 'Dans le LAN : quelques microsecondes.' } }); return 0.4; }
      if (m === 'man') { envoie(W.man.c, propagationMs(15), { info: { nom: 'Le programme', texte: 'Par la boucle de la ville jusqu\'au centre technique.' } }); return 0.5; }
      if (m === 'wan') { envoie(W.man.c, propagationMs(15), { fin: () => { if (g === S.gen) envoie(W.wan.c, 1.3, { col: 0xd08cff, info: { nom: 'Le programme', texte: 'Sur la fibre de l\'opérateur.' } }); } }); return 0.5; }
      if (m === 'sat') { envoie(W.sat.c, bondSatelliteMs(), { col: 0x7fd3f3, info: { nom: 'Le programme', texte: 'Par le satellite : environ 240 ms.' } }); return 0.55; }
      if (m === 'net') { envoie(W.net.c, allerNet(), { col: 0xffd38a, info: { nom: 'Un paquet SRT', texte: 'Source 203.0.113.7:40000 après traduction ; destination la régie, port 9000.' } }); return 0.45; }
      if (m === 'srt') {
        const n = ++seq, lost = rnd() < S.perte / 100 * 3; // pertes grossies pour qu'on les voie
        const t1 = visu(allerNet());
        envoie(W.net.c, allerNet(), { col: 0xffd38a, to: lost ? 0.5 : 1, info: { nom: `Paquet ${n}`, texte: 'Numéroté : la régie repère un trou.' }, fin: lost ? () => { if (g !== S.gen) return; const c = croix.find((x) => x.until < S.t) || croix[0]; c.L.target.copy(W.net.c.getPointAt(0.5)); c.L.show(true); c.until = S.t + 1.5; } : undefined });
        if (lost) plan(t1 + 0.4, () => { ctx.say(`La régie n'a pas reçu le paquet ${n} : elle le redemande.`); envoie(inverse(W.net.c), allerNet(), { col: 0xff6a5a, taille: [0.1, 0.07, 0.07], info: { nom: `Demande du paquet ${n}`, texte: 'Accusé négatif (NAK).' }, fin: () => { if (g === S.gen) envoie(W.net.c, allerNet(), { col: 0xff9a3a, info: { nom: `Paquet ${n} renvoyé`, texte: 'Il arrive avant la fin du tampon de latence : l\'image n\'a pas de trou.' } }); } }); });
        return 0.4;
      }
      if (m === 'rtmp') { envoie(W.rtmp.c, S.rtt / 2, { col: 0x7fd3f3, info: { nom: 'Segment TCP (RTMP)', texte: 'Il attend son accusé.' }, fin: () => { if (g === S.gen) envoie(inverse(W.rtmp.c), S.rtt / 2, { col: 0xffd38a, taille: [0.08, 0.06, 0.06], info: { nom: 'Accusé TCP', texte: 'Reçu.' } }); } }); return 0.45; }
      if (m === 'hls') {
        hls.forEach((h, i) => envoie(h.c, 5, { col: 0x7fd1a0, taille: [0.32, 0.22, 0.22], info: { nom: 'Un segment HLS', texte: 'Quelques secondes de programme, servies comme un fichier.' }, fin: () => { if (g === S.gen) envoie(vers[i].c, 3, { col: 0x7fd1a0, taille: [0.22, 0.15, 0.15], info: { nom: 'Le segment, vers un spectateur', texte: 'Téléchargé par HTTP chez le CDN le plus proche.' } }); } }));
        return 2.2;
      }
      return 1;
    }
    demarre();
    let ui = null;
    return {
      etape(i, E) { S.mode = E.mode || 'lan'; demarre(); if (ui) ui.hidden = !['net', 'srt', 'rtmp'].includes(S.mode); },
      update(dt) {
        S.t += dt; tick -= dt;
        if (tick <= 0) tick = emet();
        for (let i = agenda.length - 1; i >= 0; i--) { const a = agenda[i]; if (a.gen !== S.gen) { agenda.splice(i, 1); continue; } if (a.at <= S.t) { agenda.splice(i, 1); a.f(); } }
        for (const c of croix) if (c.until && c.until < S.t) { c.L.show(false); c.until = 0; }
      },
      commandes() {
        ui = el('div', { class: 'v3-ctl' },
          slider('Aller-retour sur Internet', 10, 300, S.rtt, 5, (v) => { S.rtt = v; lire(); }, (v) => `${v} ms`),
          slider('Pertes sur Internet', 0, 15, S.perte, 0.5, (v) => { S.perte = v; lire(); }, (v) => `${fmtNum(v, 1)} %`),
          el('p', { class: 'v3-note' }, 'Ces réglages servent aux étapes Internet, SRT et RTMP.'));
        ui.hidden = !['net', 'srt', 'rtmp'].includes(S.mode);
        return ui;
      },
    };
  },
};
