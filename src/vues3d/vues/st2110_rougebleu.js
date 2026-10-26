// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { texte } from '../kit.js';
import { appareil, commutateur, Reseau } from '../materiel.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Rouge et bleu : deux réseaux spine-leaf » : deux fabrics identiques et séparées (2 spines,
// 2 leaves chacune), deux caméras et deux récepteurs reliés aux deux. Chaque paquet part deux fois, un
// par réseau, avec le même numéro de séquence ; au mélangeur, la fusion ST 2022-7 garde la première copie.
// ECMP envoie chaque flux par une spine ; couper une spine, un réseau, puis les deux montre ce que la
// redondance couvre. Enfin, le contrôleur NMOS (réseau de contrôle, en gris) connecte le multiview : IS-05,
// puis les abonnements IGMP sur chaque réseau. Topologie : celle du car IP du simulateur, réduite.
// ----------------------------------------------------------------------------------
const RED = 0xe0453a, BLUE = 0x3f7fe6, CTRL = 0x9aa4ad;
const CAMS = [{ id: 'c1', nom: 'CAM 1', g: '239.1.1.1', col: 0xffd38a }, { id: 'c2', nom: 'CAM 2', g: '239.1.1.2', col: 0x7fd1a0 }];

export const VUE_ST2110_ROUGEBLEU = {
  id: 'st2110-rougebleu', chapitre: 'reseau', titre: 'Rouge et bleu : deux réseaux spine-leaf',
  resume: 'Deux fabrics spine-leaf séparées : chaque paquet part deux fois, le récepteur garde la première copie. Couper une spine, un réseau, les deux ; puis connecter un récepteur par NMOS.',
  lecons: ['reseau-2022-7', 'reseau-spine-leaf', 'reseau-nmos'],
  lectures: ['État des réseaux', 'Chemins (ECMP)', 'Au mélangeur', 'Paquets perdus'],
  depart: 'En rouge le réseau A, en bleu le réseau B, en gris le réseau de contrôle. Les petites boîtes sont les paquets, numérotés.',
  vue: { cible: [0, 1.2, -0.4], dir: [0, 0.5, 1], dist: 12 },
  orbite: { rMin: 1.5, rMax: 22 },
  etapes: [
    { t: 'Spine-leaf : deux sauts au plus', lecon: 'reseau-spine-leaf', etat: {}, vue: { cible: [-3, 1.4, -1.6], dir: [0, 0.35, 1], dist: 6.5 },
      texte: `Le réseau rouge, de près : en bas les **leaves**, où se branchent les appareils ; en haut les **spines**, qui ne relient que des leaves. **Chaque leaf est reliée à chaque spine.**

D'une caméra (leaf de gauche) au mélangeur (leaf de droite) : leaf, spine, leaf, jamais plus. Chaque leaf est aussi la passerelle de ses appareils ; le routage (OSPF) et le multicast (PIM) passent par les spines.` },
    { t: 'ECMP : un flux par chemin', lecon: 'reseau-spine-leaf', etat: {}, vue: { cible: [-3, 1.4, -1.6], dir: [0, 0.35, 1], dist: 6.5 },
      texte: `Les deux spines offrent deux chemins aussi bons. **ECMP** les répartit **flux par flux** : la CAM 1 (jaune) passe par la spine 1, la CAM 2 (verte) par la spine 2. Un flux ne se coupe jamais en deux : ses paquets restent dans l'ordre.

Dimensionner, c'est vérifier que les flux qui montent d'une leaf tiennent dans ses liens vers les spines.` },
    { t: 'Rouge et bleu : chaque paquet deux fois', lecon: 'reseau-2022-7', etat: {}, vue: { cible: [0, 1.2, -0.4], dir: [0, 0.5, 1], dist: 12 },
      texte: `À côté du rouge, un réseau **bleu** identique, sans aucun câble entre les deux. Chaque appareil a **deux cartes**.

La caméra envoie **chaque paquet deux fois**, un par réseau, avec le **même numéro de séquence**. Le mélangeur reçoit les deux copies et garde, numéro par numéro, **la première arrivée** (ST 2022-7). Lisez « Au mélangeur ».` },
    { t: 'Une spine rouge tombe', lecon: 'reseau-2022-7', etat: { s1r: false }, vue: { cible: [-1.5, 1.2, -0.6], dir: [0, 0.45, 1], dist: 9 },
      texte: `La spine 1 du rouge s'arrête. Côté rouge, le routage bascule la CAM 1 sur la spine 2 en quelques dizaines de millisecondes… et pendant ce temps, le **bleu** a porté chaque paquet perdu en rouge.

Au mélangeur : **aucun paquet perdu**. Il n'y a rien eu à commuter : la fusion travaille en permanence.` },
    { t: 'Tout le rouge tombe', lecon: 'reseau-2022-7', etat: { rouge: false }, vue: { cible: [0, 1.2, -0.4], dir: [0, 0.5, 1], dist: 12 },
      texte: `Le réseau rouge entier est coupé. Le bleu porte seul tous les flux : **toujours aucune perte**. C'est l'intérêt de deux réseaux **indépendants** : alimentés, câblés et configurés séparément.

Il faut tout de même réparer vite : on n'a plus de secours.` },
    { t: 'Les deux tombent', lecon: 'reseau-2022-7', etat: { rouge: false, bleu: false }, vue: { cible: [0, 1.2, -0.4], dir: [0, 0.5, 1], dist: 12 },
      texte: `Rouge et bleu coupés : plus aucune copie n'arrive, les **paquets sont perdus**. La redondance ne couvre que des pannes **indépendantes** : une caméra qui n'émet plus, une erreur de configuration recopiée sur les deux réseaux, une perte de PTP touchent les deux copies à la fois.` },
    { t: 'NMOS : connecter le multiview', lecon: 'reseau-nmos', etat: { nmos: true }, vue: { cible: [0, 1.0, 0.6], dir: [0, 0.55, 1], dist: 9.5 },
      texte: `Le multiview ne reçoit encore rien. Sur le **réseau de contrôle** (gris), à part, le **contrôleur** lit le **registre** (IS-04) : il connaît la CAM 2 et son SDP. Il envoie au multiview une requête **IS-05** (la boîte grise) : « abonne-toi à la CAM 2, source 10.1.11.2 et groupe 239.1.1.2 en rouge, 10.2.11.2 et 239.2.1.2 en bleu ».

Le multiview s'abonne alors **lui-même**, en IGMP, sur chaque réseau (les boîtes blanches) : le flux arrive par les deux. NMOS décide qui reçoit quoi ; le réseau transporte.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { rouge: true, bleu: true, s1r: true, s2r: true, s1b: true, s2b: true, mv: false, seq: 48210, perdus: 0, recus: 0, last: '' };
    const net = new Reseau(ctx, root, 900);
    // les deux fabrics
    const fab = (nom, col, x0) => {
      const sp = [0, 1].map((k) => { const s = commutateur(`SPINE ${nom} ${k + 1}`, 2, { pied: 2.0, couleur: col === RED ? 0x4a2a2a : 0x2a3a5a, info: { nom: `Spine ${k + 1} du réseau ${nom}`, texte: 'Un commutateur central : il ne relie que des leaves (32 ports à 100 GbE dans le car du simulateur).' } }); s.position.set(x0 + 0.6 + k * 1.2, 0, -3.2); root.add(s); return s; });
      const lf = [0, 1].map((k) => { const l = commutateur(`LEAF ${nom} ${k + 1}`, 4, { couleur: col === RED ? 0x4a2a2a : 0x2a3a5a, info: { nom: `Leaf ${k + 1} du réseau ${nom}`, texte: 'Commutateur de haut de baie : les appareils s\'y branchent (25 GbE) ; reliée à chaque spine (100 GbE).' } }); l.position.set(x0 + k * 2.4, 0, -1.1); root.add(l); return l; });
      const up = {};
      for (let l = 0; l < 2; l++) for (let s = 0; s < 2; s++) up[`${l}${s}`] = net.relie({ obj: lf[l], i: 2 + s }, { obj: sp[s], i: l }, { couleur: col, r: 0.022, sag: 0.1, info: { nom: `Lien 100 GbE leaf ${l + 1} → spine ${s + 1} (${nom})` } });
      const t = texte(`réseau ${nom}`, { h: 0.16, color: col === RED ? '#ff8a80' : '#8ab8ff', bg: 'rgba(12,16,20,.8)' }); t.position.set(x0 + 1.2, 3.35, -3.2); root.add(t);
      return { sp, lf, up };
    };
    const A = fab('rouge (A)', RED, -4.4), B = fab('bleu (B)', BLUE, 2.0);
    // les appareils, deux cartes chacun
    const cams = CAMS.map((c, i) => { const o = appareil('camera', c.nom, { info: { nom: `${c.nom} : deux cartes`, texte: `Carte rouge 10.1.11.${i + 1} → ${c.g} ; carte bleue 10.2.11.${i + 1} → ${c.g.replace('239.1.', '239.2.')}. Chaque paquet part sur les deux.` } }); o.position.set(-1.6 + i * 1.0, 0, 1.7); root.add(o); return o; });
    const mel = appareil('melangeur', 'Mélangeur', { info: { nom: 'Mélangeur : deux cartes', texte: 'Il reçoit chaque flux par le rouge et par le bleu, et garde, paquet par paquet, la première copie arrivée (ST 2022-7).' } });
    mel.position.set(1.0, 0, 1.7); root.add(mel);
    const mv = appareil('multiview', 'Multiview', { info: { nom: 'Multiview', texte: 'Connecté par le contrôleur NMOS à la dernière étape.' } });
    mv.position.set(2.3, 0, 1.7); root.add(mv);
    const Lc = cams.map((o) => ({ r: net.relie({ obj: o }, { obj: A.lf[0], i: 0 + cams.indexOf(o) }, { couleur: RED, sag: 0.5 }), b: net.relie({ obj: o }, { obj: B.lf[0], i: 0 + cams.indexOf(o) }, { couleur: BLUE, sag: 0.5 }) }));
    const Lm = { r: net.relie({ obj: A.lf[1], i: 0 }, { obj: mel }, { couleur: RED, sag: 0.5 }), b: net.relie({ obj: B.lf[1], i: 0 }, { obj: mel }, { couleur: BLUE, sag: 0.5 }) };
    const Lv = { r: net.relie({ obj: A.lf[1], i: 1 }, { obj: mv }, { couleur: RED, sag: 0.5 }), b: net.relie({ obj: B.lf[1], i: 1 }, { obj: mv }, { couleur: BLUE, sag: 0.5 }) };
    // le réseau de contrôle et le contrôleur NMOS
    const ctl = appareil('pc', 'Contrôleur NMOS', { info: { nom: 'Contrôleur de diffusion et registre NMOS', texte: 'Le registre (IS-04) tient la liste des émetteurs et des récepteurs ; le contrôleur les connecte (IS-05), comme une grille.' } });
    ctl.position.set(4.6, 0, 2.2); ctl.rotation.y = -0.5; root.add(ctl);
    const sc = commutateur('SW-CONTRÔLE', 4, { pied: 0.5, couleur: 0x3a4048 }); sc.position.set(4.0, 0, 0.6); root.add(sc);
    const Lctl = net.relie({ obj: ctl }, { obj: sc, i: 0 }, { couleur: CTRL, r: 0.012, sag: 0.3 });
    const Lsmv = net.relie({ obj: sc, i: 1 }, { obj: mv }, { couleur: CTRL, r: 0.012, sag: 0.3 });
    // la fusion au mélangeur : deux voyants (rouge, bleu) et le numéro gardé
    const fz = new THREE.Group(); fz.position.set(0, mel.userData.top + 0.3, 0); mel.add(fz);
    const vr = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.06), new THREE.MeshBasicMaterial({ color: 0x333333, toneMapped: false })), vb = vr.clone(); vb.material = vr.material.clone();
    vr.position.x = -0.1; vb.position.x = 0.1; fz.add(vr, vb);
    const fTag = ctx.label(fz, '', { off: [0, 0.2, 0], cls: 'small' });
    const pend = new Map();
    let flash = 0;
    const spineOk = (F, k, col) => (col === 'r' ? S.rouge && (k ? S.s2r : S.s1r) : S.bleu && (k ? S.s2b : S.s1b));
    /** la spine qu'ECMP donne à un flux (la sienne, sinon l'autre si elle est coupée) */
    const ecmp = (ci, col) => { const k = ci % 2; return spineOk(null, k, col) ? k : spineOk(null, 1 - k, col) ? 1 - k : -1; };
    function envoi(ci, dests) {
      const seq = ++S.seq; const c = CAMS[ci];
      for (const col of ['r', 'b']) {
        const F = col === 'r' ? A : B, up = col === 'r' ? S.rouge : S.bleu, k = ecmp(ci, col);
        const info = { nom: `${c.nom} · paquet n° ${seq} (${col === 'r' ? 'rouge' : 'bleu'})`, texte: `Même numéro de séquence sur les deux réseaux : le récepteur apparie les copies. Groupe ${col === 'r' ? c.g : c.g.replace('239.1.', '239.2.')}.` };
        if (!up || k < 0) { for (const d of dests) arrive(d, seq, col, false); continue; }
        net.chemin([[Lc[ci][col], 1], [F.up[`0${k}`], 1]], { couleur: c.col, info, taille: [0.11, 0.07, 0.07], vitesse: 1.9, onEnd: () => {
          net.trame(F.up[`1${k}`], -1, { couleur: c.col, info, taille: [0.11, 0.07, 0.07], vitesse: 1.9, onEnd: () => {
            for (const d of dests) net.trame(d === 'mel' ? Lm[col] : Lv[col], 1, { couleur: c.col, info, taille: [0.11, 0.07, 0.07], vitesse: 1.9, onEnd: () => arrive(d, seq, col, true) });
          } });
        } });
      }
    }
    /** une copie arrive (ou n'arrivera jamais) : la fusion garde la première, compte les pertes quand les deux manquent */
    function arrive(d, seq, col, ok) {
      if (d !== 'mel') return;
      const P = pend.get(seq) || { r: null, b: null, gardee: '' }; pend.set(seq, P);
      P[col] = ok;
      if (ok && !P.gardee) { P.gardee = col; S.recus++; S.last = `n° ${seq} : copie ${col === 'r' ? 'rouge' : 'bleue'} gardée`; (col === 'r' ? vr : vb).material.color.set(col === 'r' ? RED : BLUE); flash = 0.4; }
      if (P.r !== null && P.b !== null) {
        if (!P.r && !P.b) { S.perdus++; S.last = `n° ${seq} : perdu (aucune copie)`; vr.material.color.set(0x220000); vb.material.color.set(0x220000); }
        else if (P.gardee && P[P.gardee === 'r' ? 'b' : 'r'] === false) S.last = `n° ${seq} : manquait en ${P.gardee === 'r' ? 'bleu' : 'rouge'}, réparé par l'autre réseau`;
        pend.delete(seq);
      }
      lire();
    }
    function lire() {
      const st = (b) => (b ? 'en service' : 'coupé');
      ctx.read('État des réseaux', `rouge ${S.rouge ? (S.s1r ? 'en service' : 'spine 1 coupée') : 'coupé'} · bleu ${st(S.bleu)} · contrôle en service`);
      ctx.read('Chemins (ECMP)', CAMS.map((c, i) => `${c.nom} : rouge ${ecmp(i, 'r') < 0 || !S.rouge ? '—' : 'spine ' + (ecmp(i, 'r') + 1)}, bleu ${ecmp(i, 'b') < 0 || !S.bleu ? '—' : 'spine ' + (ecmp(i, 'b') + 1)}`).join(' · '));
      ctx.read('Au mélangeur', S.last || '…');
      ctx.read('Paquets perdus', `${S.perdus} sur ${S.recus + S.perdus}`);
      fTag.set(S.last);
      for (const [k, L] of Object.entries(A.up)) L.mesh.visible = S.rouge && (k[1] === '0' ? S.s1r : S.s2r);
      for (const [k, L] of Object.entries(B.up)) L.mesh.visible = S.bleu && (k[1] === '0' ? S.s1b : S.s2b);
      A.sp[0].visible = S.rouge && S.s1r; A.sp[1].visible = S.rouge; B.sp.forEach((s) => { s.visible = S.bleu; });
    }
    function nmos() {
      S.mv = false;
      net.trame(Lctl, 1, { couleur: CTRL, taille: [0.16, 0.1, 0.1], info: { nom: 'Requête IS-05', texte: 'PATCH …/receivers/multiview-5/staged : sender CAM 2, source et groupe pour chaque réseau, activation immédiate.' }, onEnd: () => net.trame(Lsmv, 1, { couleur: CTRL, taille: [0.16, 0.1, 0.1], info: { nom: 'Requête IS-05', texte: 'Le multiview reçoit ses paramètres de transport.' }, onEnd: () => {
        ctx.say('IS-05 reçue : le multiview s\'abonne en IGMP sur le rouge et sur le bleu.');
        for (const col of ['r', 'b']) net.trame(Lv[col], -1, { couleur: 0xffffff, taille: [0.08, 0.05, 0.05], info: { nom: `IGMPv3 join (${col === 'r' ? 'rouge' : 'bleu'})`, texte: `(10.${col === 'r' ? 1 : 2}.11.2, 239.${col === 'r' ? 1 : 2}.1.2)` }, onEnd: () => { S.mv = true; ctx.say('Le flux de la CAM 2 arrive au multiview par les deux réseaux.'); } });
      } }) });
    }
    let t = 0, ui = null, alive = true;
    lire();
    const sync = () => { if (!ui) return; for (const b of ui.querySelectorAll('[data-k]')) { const k = /** @type {HTMLElement} */ (b).dataset.k; b.setAttribute('aria-pressed', String(!S[k])); } };
    return {
      dispose() { alive = false; },
      etape(i, E) {
        const e = E.etat || {};
        S.rouge = e.rouge ?? true; S.bleu = e.bleu ?? true; S.s1r = e.s1r ?? true; S.s2r = true; S.s1b = true; S.s2b = true;
        S.perdus = 0; S.recus = 0; S.last = ''; pend.clear(); net.clear(); S.mv = false;
        lire(); sync();
        if (e.nmos) setTimeout(() => { if (alive) nmos(); }, 900);
        else if (i < 6) S.mv = false;
      },
      update(dt) {
        t += dt;
        if (t > 0.7) { t = 0; envoi(0, ['mel']); envoi(1, S.mv ? ['mel', 'mv'] : ['mel']); }
        if (flash > 0) { flash -= dt; if (flash <= 0) { vr.material.color.set(0x333333); vb.material.color.set(0x333333); } }
      },
      commandes() {
        const tog = (k, label) => el('button', { type: 'button', class: 'btn small', 'data-k': k, 'aria-pressed': String(!S[k]), onclick: () => { S[k] = !S[k]; lire(); sync(); ctx.say(`${label} : ${S[k] ? 'remis en service' : 'coupé'}.`); } }, label);
        ui = el('div', { class: 'v3-ctl' },
          el('div', { class: 'v3-row' }, el('span', {}, 'Couper :'), tog('s1r', 'spine rouge 1'), tog('rouge', 'tout le rouge'), tog('bleu', 'tout le bleu')),
          el('div', { class: 'v3-row' }, el('button', { type: 'button', class: 'btn small primary', onclick: () => nmos() }, 'Connecter le multiview (NMOS)')));
        return ui;
      },
    };
  },
};
