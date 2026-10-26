// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../../util.js';
import { slider, fmtNum } from '../../cours/kit.js';
import { eclat, ecran, piece, texte } from '../kit.js';
import { appareil, Reseau } from '../materiel.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Le genlock : toutes les images en même temps » : le SPG calé sur le GPS, son distributeur, les
// références (tops image, en blanc) qui partent en étoile vers deux CCU et un serveur ralenti, dont les
// images vont au mélangeur. Au-dessus de chaque source, sa phase sur une règle de ± 20 µs avec la fenêtre du
// mélangeur (± ½ ligne, 8,9 µs en 1080p50). Le mélangeur coupe d'une source à l'autre : propre dans la
// fenêtre, un saut au-delà. Une source libre dérive (20 ppm), un synchroniseur la rattrape en sautant ou
// répétant une image, le SPG passe en holdover si le GPS est perdu. Chiffres : leçon synchro-genlock.
// ----------------------------------------------------------------------------------
const FEN = 8.9; // demi-fenêtre du mélangeur (µs), ± ½ ligne en 1080p50
const SRC = [
  { id: 'ccu1', type: 'ccu', nom: 'CCU 1', col: '#3d7a4a', traite: 1.2 },
  { id: 'ccu2', type: 'ccu', nom: 'CCU 2', col: '#4a6aa0', traite: 1.4 },
  { id: 'evs', type: 'serveur', nom: 'Serveur ralenti', col: '#7a5a3a', traite: 14.5 },
];

export const VUE_SYNCHRO_GENLOCK = {
  id: 'synchro-genlock', chapitre: 'synchro', titre: 'Le genlock : toutes les images en même temps',
  resume: 'Le SPG, ses références en étoile, la phase de chaque source face à la fenêtre du mélangeur : une coupe propre, une source libre qui saute, le synchroniseur, le holdover.',
  lecons: ['synchro-genlock'],
  lectures: ['Référence', 'Phases au mélangeur', 'Dernière coupe'],
  depart: 'Les impulsions blanches sont les tops image de la référence. Chaque règle montre l\'avance ou le retard d\'une source au mélangeur.',
  vue: { cible: [0, 1.3, 0.2], dir: [0, 0.4, 1], dist: 10 },
  orbite: { rMin: 1.5, rMax: 20 },
  etapes: [
    { t: 'Le SPG donne le rythme', reglage: { evs: 0, libre: false, sync: false, gps: true }, vue: { cible: [-3.0, 1.0, 0.2], dir: [0.25, 0.4, 1], dist: 6.5 },
      texte: `À gauche, le **SPG** (générateur de synchronisation), calé sur le **GPS**. Il fabrique la **référence** : un signal dont chaque top marque le début d'une image et de chaque ligne, **black burst** (hérité de la SD) ou **tri-level** (HD).

Un **distributeur** (DA) la recopie en **étoile**, un câble coaxial par appareil. Les impulsions blanches sont les tops image qui partent vers les deux CCU et le serveur ralenti.` },
    { t: 'Le genlock : les images commencent ensemble', reglage: { evs: 0, libre: false, sync: false, gps: true }, vue: { cible: [1.0, 1.4, 0.4], dir: [0, 0.3, 1], dist: 8.5 },
      texte: `Chaque source se **verrouille** (genlock) sur la référence : elle ne compte plus les images sur son propre quartz, elle suit les tops du SPG. Toutes commencent leurs images, et leurs lignes, au même instant.

Au-dessus de chaque source, sa **phase** au mélangeur : le repère est au centre de la règle. La zone verte est la **fenêtre** du mélangeur, ± ½ ligne (8,9 µs en 1080p50) : il réaligne seul ce qui y tombe.` },
    { t: 'Couper proprement', reglage: { evs: 0, libre: false, sync: false, gps: true, coupe: true }, vue: { cible: [2.8, 1.3, 0.2], dir: [-0.1, 0.35, 1], dist: 6.5 },
      texte: `Le mélangeur coupe d'une source à l'autre **au top image**, dans la suppression (sur une ligne prévue pour cela). Toutes les sources étant en phase, l'image suivante commence exactement où la précédente s'arrêtait : la coupe ne se voit pas.

Regardez le moniteur programme du mélangeur : il change de source toutes les quelques secondes, sans à-coup.` },
    { t: 'La phase : compenser les retards', reglage: { evs: 14.5, libre: false, sync: false, gps: true, coupe: true }, vue: { cible: [1.0, 1.4, 0.4], dir: [0, 0.3, 1], dist: 8.5 },
      texte: `Être verrouillé ne suffit pas. Chaque appareil a ses temps de traitement, chaque câble son retard (≈ 5 ns par mètre). Le serveur ralenti sort ici ses images **14,5 µs** trop tard : hors de la fenêtre. À la coupe vers lui, l'image **saute**.

Chaque appareil a donc un réglage de **phase** (V en lignes, H en µs). Avec le curseur « Phase H du serveur », avancez-le jusqu'à ramener son repère dans le vert : la coupe redevient propre.` },
    { t: 'Une source libre dérive', reglage: { evs: 0, libre: true, sync: false, gps: true, coupe: true }, vue: { cible: [1.0, 1.4, 0.4], dir: [0, 0.3, 1], dist: 8.5 },
      texte: `La référence de la **CCU 2** est débranchée : elle repart sur son **quartz**. À 20 ppm près, elle dérive de **20 µs par seconde** : son repère traverse la fenêtre en moins d'une seconde et ne revient en phase que lorsqu'elle a pris une image entière d'avance (16 min 40 s plus tard).

À chaque coupe vers elle hors de la fenêtre, l'image **saute** ou **roule**, les moniteurs et le codeur décrochent, le son embarqué claque. (La dérive est ralentie ici pour qu'on la voie.)` },
    { t: 'Le synchroniseur d\'images', reglage: { evs: 0, libre: true, sync: true, gps: true, coupe: true }, vue: { cible: [1.0, 1.4, 0.4], dir: [0, 0.3, 1], dist: 8.5 },
      texte: `Une source qu'on ne peut pas verrouiller (une caméra HF, un duplex) passe par un **synchroniseur d'images** (frame sync) : une mémoire d'image qui la ressort en phase avec la référence. La coupe redevient propre.

Le prix : un retard (jusqu'à une image, 20 ms) et, quand la dérive a accumulé une image entière, le synchroniseur doit **sauter ou répéter une image**. À 20 ppm, c'est une fois toutes les 16 min 40 s environ.` },
    { t: 'Le GPS perdu : le holdover', reglage: { evs: 0, libre: false, sync: false, gps: false, coupe: true }, vue: { cible: [-3.0, 1.0, 0.2], dir: [0.25, 0.4, 1], dist: 6.5 },
      texte: `Le SPG perd le GPS (antenne en rouge) : il passe en **holdover**. Son oscillateur thermostaté (OCXO) continue seul, avec une dérive de l'ordre de quelques dizaines à quelques centaines de nanosecondes par heure.

Pour le car, **rien ne change** : toutes les sources suivent le même SPG, elles restent en phase entre elles. Seul l'écart avec l'extérieur (le studio, la régie finale) grandit lentement : on surveille, on ne re-verrouille rien.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { evs: 0, libre: false, sync: false, gps: true, coupe: false, ph: { ccu1: 0, ccu2: 0, evs: 0 }, on: 0, glitch: 0, last: '—', t: 0 };
    // le SPG, son antenne, le DA
    const spg = appareil('spg', 'SPG', { info: () => ({ nom: 'SPG (générateur de synchro)', texte: S.gps ? 'Calé sur le GPS : sa référence est à l\'heure du monde, en phase avec celle des autres cars et du studio (ST 2059-1).' : 'Holdover : le GPS est perdu, son oscillateur thermostaté continue seul.' }) });
    spg.position.set(-4.4, 0, -0.6); root.add(spg);
    const gpsLamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), eclat(0x7fd1a0)); gpsLamp.position.set(0.15, 1.2, -0.1); spg.add(gpsLamp);
    const gpsTag = ctx.label(gpsLamp, 'GPS', { off: [0, 0.16, 0], cls: 'small' });
    const da = piece('DA', 'plastique', (b) => { b.cbox(0.5, 0.12, 0.36, -2.9, 0.62, -0.6, 0x2a3138, 0.02); b.cbox(0.4, 0.56, 0.3, -2.9, 0.28, -0.6, 0x1d2227, 0.02); });
    da.userData.info = { nom: 'DA de référence', texte: 'Le distributeur recopie la référence vers chaque appareil : un câble par appareil, en étoile.' };
    da.userData.port = new THREE.Vector3(-2.9, 0.62, -0.42); root.add(da);
    const tda = texte('DA', { h: 0.1 }); tda.position.set(-2.9, 0.38, -0.44); root.add(tda);
    const net = new Reseau(ctx, root, 300);
    const L0 = net.relie({ obj: spg }, { obj: da }, { couleur: 0xe8ece6, r: 0.014, sag: 0.25 });
    // les sources et le mélangeur
    const objs = {}, Lref = {}, Lvid = {}, rulers = {};
    const mel = appareil('melangeur', 'Mélangeur', { info: { nom: 'Mélangeur', texte: 'Il coupe d\'une source à l\'autre au top image. Sa mémoire de ligne réaligne ce qui arrive dans sa fenêtre (± ½ ligne).' } });
    mel.position.set(3.6, 0, 0.6); mel.rotation.y = -0.6; root.add(mel);
    SRC.forEach((s, i) => {
      const o = appareil(s.type, s.nom, { info: () => ({ nom: s.nom, texte: `${S.libre && s.id === 'ccu2' ? 'Libre : elle cadence sur son quartz.' : 'Verrouillée sur la référence.'} Phase au mélangeur : ${fmtNum(phase(s.id), 1)} µs.` }) });
      o.position.set(-1.2 + i * 1.6, 0, 1.2 - i * 0.4); root.add(o); objs[s.id] = o;
      Lref[s.id] = net.relie({ obj: da }, { obj: o }, { couleur: 0xe8ece6, r: 0.012, sag: 0.3, info: { nom: `Référence de ${s.nom}`, texte: 'Coaxial 75 Ω : black burst ou tri-level.' } });
      Lvid[s.id] = net.relie({ obj: o }, { obj: mel }, { couleur: 0x2a5fb0, sag: 0.4, info: { nom: `Sortie SDI de ${s.nom}`, texte: 'Vers une entrée du mélangeur (par la grille, dans le car).' } });
      // la règle de phase au-dessus de la source
      const E = ecran(1.5, 0.52, 420, () => {}); E.mesh.position.set(0, o.userData.top + 0.7, 0); o.add(E.mesh);
      E.mesh.userData.info = { nom: `Phase de ${s.nom} au mélangeur`, texte: 'Le repère : avance (−) ou retard (+) de ses images sur la référence, en µs. Vert : la fenêtre du mélangeur (± 8,9 µs en 1080p50).' };
      rulers[s.id] = E;
    });
    // le moniteur programme du mélangeur
    const pgm = ecran(1.0, 0.56, 384, () => {}); pgm.mesh.position.set(0, 1.45, -0.05); mel.add(pgm.mesh);
    pgm.mesh.userData.info = { nom: 'Moniteur programme', texte: 'Ce qui sort du mélangeur : une coupe hors fenêtre se voit comme un saut ou un roulement de l\'image.' };
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.62, 0.04), eclat(0x15191d)); frame.position.set(0, 1.45, -0.08); mel.add(frame);
    /** phase d'une source au mélangeur (µs) : traitement non compensé, dérive si libre */
    const phase = (id) => {
      if (id === 'evs') return S.evs - S.ph.evs;
      // libre : 20 ppm, soit 20 µs par seconde en vrai ; ralenti ici à 4,2 µs par seconde pour qu'on le suive
      if (id === 'ccu2' && S.libre && !S.sync) return ((S.t * 4.2) % 40) - 20;
      return 0;
    };
    function drawRuler(id) {
      const E = rulers[id], g = E.g, W = E.W, H = E.H, p = phase(id), ok = Math.abs(p) <= FEN;
      g.fillStyle = '#081014'; g.fillRect(0, 0, W, H);
      const X = (v) => W / 2 + clamp(v / 20, -1, 1) * (W / 2 - 16);
      g.fillStyle = 'rgba(127,209,160,.28)'; g.fillRect(X(-FEN), 52, X(FEN) - X(-FEN), 40);
      g.strokeStyle = '#3a4650'; g.beginPath(); g.moveTo(16, 72); g.lineTo(W - 16, 72); g.stroke();
      g.fillStyle = '#6a747c'; g.font = '15px "Archivo Narrow", sans-serif'; g.fillText('−20 µs', 6, 112); g.fillText('+20 µs', W - 50, 112); g.fillText('fenêtre', W / 2 - 24, 112);
      g.fillStyle = ok ? '#7fd1a0' : '#ff8a80'; g.fillRect(X(p) - 4, 46, 8, 52);
      g.font = '700 26px "B612 Mono", monospace'; g.fillText(`${p >= 0 ? '+' : '−'}${fmtNum(Math.abs(p), 1)} µs`, 12, 32);
      g.fillStyle = '#aab4ba'; g.font = '600 18px "Archivo Narrow", sans-serif';
      g.fillText(id === 'ccu2' && S.libre ? (S.sync ? 'libre → synchroniseur' : 'LIBRE (quartz)') : 'verrouillée', W - 170, 30);
      E.mesh.material.map.needsUpdate = true;
    }
    function drawPgm() {
      const g = pgm.g, W = pgm.W, H = pgm.H, s = SRC[S.on];
      const dy = S.glitch > 0 ? Math.sin(S.glitch * 40) * H * 0.3 : 0;
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      g.fillStyle = s.col; g.fillRect(0, dy, W, H); g.fillStyle = '#2f6b23'; g.fillRect(0, H * 0.55 + dy, W, H * 0.45);
      g.fillStyle = '#fff'; g.font = '700 34px "Archivo Narrow", sans-serif'; g.fillText(s.nom, 16, 44 + dy);
      if (S.glitch > 0) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, (H / 2 + dy * 2) % H, W, 6); g.fillStyle = '#ff8a80'; g.fillText('SAUT', W - 110, H - 16); }
      g.fillStyle = '#e0453a'; g.fillRect(W - 26, 10, 14, 14);
      pgm.mesh.material.map.needsUpdate = true;
    }
    function lire() {
      ctx.read('Référence', S.gps ? 'SPG verrouillé sur le GPS · tri-level et black burst' : 'SPG en holdover (GPS perdu) : les sources restent en phase entre elles');
      ctx.read('Phases au mélangeur', SRC.map((s) => `${s.nom} ${phase(s.id) >= 0 ? '+' : '−'}${fmtNum(Math.abs(phase(s.id)), 1)} µs${Math.abs(phase(s.id)) > FEN ? ' (hors fenêtre)' : ''}`).join(' · '));
      ctx.read('Dernière coupe', S.last);
    }
    function couper() {
      const prev = S.on; S.on = (S.on + 1) % SRC.length;
      const p = phase(SRC[S.on].id), ok = Math.abs(p) <= FEN;
      if (!ok) S.glitch = 0.8;
      S.last = `${SRC[prev].nom} → ${SRC[S.on].nom} : ${ok ? 'propre' : `saut (phase ${fmtNum(p, 1)} µs, hors fenêtre)`}`;
      ctx.say(S.last + '.');
      if (S.sync && SRC[S.on].id === 'ccu2') S.last += ' (par le synchroniseur, retard d\'une image au plus)';
      lire();
    }
    let tRef = 0, tCut = 2.5, ui = null, dt0 = 0;
    const sync = () => { if (!ui) return; const r = /** @type {HTMLInputElement} */ (ui.querySelector('input[name=ph]')); if (r) { r.value = String(S.ph.evs); r.dispatchEvent(new Event('input')); } };
    return {
      etape(i, E) {
        const R = E.reglage || {};
        S.evs = R.evs ?? 0; S.libre = !!R.libre; S.sync = !!R.sync; S.gps = R.gps ?? true; S.coupe = !!R.coupe; S.ph.evs = 0; S.t = 0; S.glitch = 0; S.last = '—';
        /** @type {any} */ (gpsLamp.material).color.set(S.gps ? 0x7fd1a0 : 0xe0453a); gpsTag.set(S.gps ? 'GPS' : 'GPS perdu : holdover');
        Lref.ccu2.mesh.visible = !S.libre;
        sync(); lire();
      },
      update(dt) {
        S.t += dt; dt0 += dt;
        // les tops image de la référence, en étoile
        tRef += dt;
        if (tRef > 1.2) {
          tRef = 0;
          net.trame(L0, 1, { couleur: 0xffffff, taille: [0.06, 0.06, 0.06], info: { nom: 'Top image de la référence', texte: 'Le début d\'une image, toutes les 20 ms (ici ralenti).' }, onEnd: () => {
            for (const s of SRC) if (!(s.id === 'ccu2' && S.libre)) net.trame(Lref[s.id], 1, { couleur: 0xffffff, taille: [0.06, 0.06, 0.06], info: { nom: `Top image vers ${s.nom}`, texte: 'Sur un coaxial, la référence voyage à ≈ 5 ns par mètre.' } });
          } });
        }
        if (S.coupe) { tCut -= dt; if (tCut <= 0) { tCut = 3.2; couper(); } }
        if (S.glitch > 0) S.glitch -= dt;
        if (dt0 > 0.08) { dt0 = 0; for (const s of SRC) drawRuler(s.id); drawPgm(); if (S.libre) lire(); }
      },
      commandes() {
        const ph = slider('Phase H du serveur', -20, 20, S.ph.evs, 0.5, (v) => { S.ph.evs = v; lire(); }, (v) => `${v >= 0 ? '+' : '−'}${fmtNum(Math.abs(v), 1)} µs`);
        /** @type {HTMLInputElement} */ (ph.querySelector('input')).name = 'ph';
        ui = el('div', { class: 'v3-ctl' }, ph,
          el('div', { class: 'v3-row' },
            el('button', { type: 'button', class: 'btn small primary', onclick: () => couper() }, 'Couper'),
            el('button', { type: 'button', class: 'btn small', onclick: () => { S.libre = !S.libre; Lref.ccu2.mesh.visible = !S.libre; S.t = 0; lire(); ctx.say(S.libre ? 'Référence de la CCU 2 débranchée : elle dérive.' : 'Référence rebranchée : la CCU 2 se reverrouille.'); } }, 'Référence CCU 2'),
            el('button', { type: 'button', class: 'btn small', onclick: () => { S.sync = !S.sync; lire(); ctx.say(S.sync ? 'Synchroniseur d\'images sur l\'entrée de la CCU 2.' : 'Synchroniseur retiré.'); } }, 'Synchroniseur'),
            el('button', { type: 'button', class: 'btn small', onclick: () => { S.gps = !S.gps; /** @type {any} */ (gpsLamp.material).color.set(S.gps ? 0x7fd1a0 : 0xe0453a); gpsTag.set(S.gps ? 'GPS' : 'GPS perdu : holdover'); lire(); } }, 'GPS')));
        return ui;
      },
    };
  },
};
