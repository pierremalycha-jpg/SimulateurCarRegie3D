// @ts-check
import * as THREE from 'three';
import { el } from '../../util.js';
import { choice, slider, fmtNum } from '../../cours/kit.js';
import { MICROS, mvParPa, P48, rFantome, uMicro, iCourtCircuit, fuite, liaison } from '../../cours/son_micro_calc.js';
import { COUL, mat, lum, verre, eclat, ecran, texte, piece, courbe, tube, cableEntre, inverse } from '../kit.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Trois capsules et le 48 V ». Devant, quatre capsules agrandies côte à côte, que les mêmes fronts de
// pression atteignent : la capsule dynamique (une bobine qui bouge dans un aimant : la tension suit la vitesse),
// la capsule statique (une membrane face à une plaque arrière, chargées : la tension suit le déplacement ; son
// électronique), le ruban entre deux aimants (figure en 8) et l'électret (charge piégée, transistor). Derrière,
// une liaison micro ouverte entre la console et le micro : le +48 V sur les broches 2 et 3 par deux résistances
// de 6,81 kΩ, le courant qui revient par la broche 1, la tension qui reste au micro ; un dynamique sur la même
// ligne (rien ne le traverse), un câble abîmé (la bobine traversée), puis un câble secteur voisin dont le parasite
// arrive pareil sur les deux conducteurs et s'annule à l'entrée symétrique. Chiffres : cours/son_micro_calc.js.
// ----------------------------------------------------------------------------------
const ZF = 1.3; // rangée des capsules
const OX = 11; // la liaison micro est à droite des capsules, assez loin pour qu'on la regarde seule
const ZB = 1.0;
const Y2 = 1.25, Y3 = 1.0, Y1 = 0.75; // hauteurs des conducteurs 2, 3 et 1
const XC = OX - 2.6, XM = OX + 2.6; // la console, le micro
const CAPS = [
  { k: 'dynamique', x: -4.6, nom: 'Dynamique', loi: 'tension ∝ vitesse de la bobine', mic: 'sm58' },
  { k: 'statique', x: -1.6, nom: 'Statique', loi: 'tension ∝ déplacement de la membrane', mic: 'statique' },
  { k: 'ruban', x: 1.4, nom: 'Ruban', loi: 'tension ∝ vitesse du ruban', mic: 'ruban' },
  { k: 'electret', x: 4.3, nom: 'Électret', loi: 'charge piégée à vie, transistor alimenté', mic: 'electret' },
];
const CHARGES = { statique: { nom: 'micro statique', i: 3 }, dynamique: { nom: 'micro dynamique', i: 0, rb: 300 }, ruban: { nom: 'micro à ruban', i: 0, rb: 300 } };

export const VUE_SON_CAPSULES = {
  id: 'son-capsules', chapitre: 'son', titre: 'Trois capsules et le 48 V',
  resume: 'Une capsule dynamique, une statique, un ruban et un électret sous les mêmes fronts de pression ; puis un câble micro ouvert : le 48 V sur les broches 2 et 3, un dynamique qu\'il ne traverse pas, un parasite qui s\'annule en symétrique.',
  lecons: ['son-statique', 'son-48v', 'son-liaisons'],
  lectures: ['Les capsules sous 1 Pa (94 dB SPL)', 'Tension au micro', 'Courants dans le câble', 'Parasite à l\'entrée de la console'],
  depart: 'À gauche, quatre capsules agrandies (mouvements très exagérés) ; à droite, un câble micro ouvert entre la console et le micro.',
  vue: { cible: [5.2, 1.2, ZF], dir: [0, 0.55, 1], dist: 24 },
  orbite: { rMin: 1.2, rMax: 32 },
  // un sol à la taille de la scène (celui des vues s'arrête à 16 m du centre)
  decor: { sol: false },
  etapes: [
    { t: 'Changer la pression en tension', lecon: 'son-statique', reglage: { ondes: true }, vue: { cible: [-0.2, 1.5, ZF], dir: [0, 0.3, 1], dist: 14 },
      texte: `Quatre capsules agrandies reçoivent les mêmes **fronts de pression** (les plans cyan qui avancent). Chacune change la pression en tension à sa façon :
- la **dynamique** : une bobine qui bouge dans un aimant ;
- la **statique** : une membrane qui s'approche et s'éloigne d'une plaque, comme un condensateur ;
- le **ruban** : un ruban d'aluminium entre deux aimants ;
- l'**électret** : un statique dont la charge est piégée à vie.
Au-dessus de chacune, ce qu'elle donne sous 1 Pa (94 dB SPL), en ordre de grandeur pour les trois dernières.` },
    { t: 'Le dynamique : une vitesse', lecon: 'son-statique', reglage: { ondes: true }, vue: { cible: [-4.6, 1.35, ZF - 0.1], dir: [0.8, 0.3, 0.6], dist: 4.4 },
      texte: `La **membrane** (ambre) est collée à une **bobine** de cuivre qui plonge dans le champ de l'**aimant**. La pression la pousse : la bobine traverse le champ et produit une tension, d'autant plus grande qu'elle va **vite** (induction).

Rien à alimenter, une construction solide : c'est le micro des voix sur scène. Mais la membrane et sa bobine pèsent : un type SM58 ne donne qu'environ **1,9 mV sous 1 Pa**.` },
    { t: 'Le statique : un condensateur qui respire', lecon: 'son-statique', reglage: { ondes: true }, vue: { cible: [-1.6, 1.35, ZF - 0.2], dir: [0.85, 0.3, 0.5], dist: 4.4 },
      texte: `Devant, une **membrane** métallisée de quelques micromètres ; derrière, à quelques dizaines de micromètres, une **plaque arrière** percée. Les deux sont **chargées** (+ et −) par la **polarisation**. Quand la membrane s'approche, la capacité change, la charge ne suit pas : c'est la **tension** qui varie, au rythme du **déplacement**.

La capsule ne peut rien fournir seule : l'**électronique** (le boîtier vert) adapte son impédance énorme et donne un niveau bien plus fort, de l'ordre de **20 mV sous 1 Pa** ici. Il faut l'alimenter : c'est le **48 V**.` },
    { t: 'Le ruban et l\'électret', lecon: 'son-statique', reglage: { ondes: true }, vue: { cible: [2.85, 1.45, ZF - 0.1], dir: [0.45, 0.35, 1], dist: 6.4 },
      texte: `Le **ruban** est un dynamique sans bobine : un ruban d'aluminium plissé, plus fin qu'une feuille de papier, suspendu entre deux **aimants**. Ouvert devant et derrière, il capte les deux faces : **figure en 8**. Son très doux, mais fragile : un souffle, un choc, ou un 48 V appliqué sur un câble défectueux peuvent l'abîmer.

L'**électret** a une plaque arrière dont la **charge** est **piégée à vie** dans un film plastique (les + violets) : plus besoin de polarisation. Son petit **transistor**, lui, doit être alimenté (pile, 48 V ou émetteur HF) : c'est le micro-cravate.` },
    { t: 'Le 48 V voyage dans le câble', lecon: 'son-48v', reglage: { ondes: false, on: true, micro: 'statique', defaut: false, parasite: false, i: 3 }, vue: { cible: [OX - 0.7, 1.3, ZB], dir: [0, 0.45, 1], dist: 12 },
      texte: `À droite des capsules, un câble micro ouvert entre la **console** (à gauche) et un **micro statique** (à droite). Dans la console, le **+48 V** passe par **deux résistances de 6,81 kΩ** vers la broche **2** (rouge) et la broche **3** (cyan) ; des **condensateurs** l'empêchent d'entrer dans le préampli.

Les points orange sont le courant : il descend vers le micro **par les deux conducteurs du signal** et revient par la broche **1** (la masse, en gris). Les deux conducteurs portent la même tension : le signal, leur **différence**, n'est pas gêné. D'où le nom de fantôme.` },
    { t: 'Ce qui reste au micro', lecon: 'son-48v', reglage: { ondes: false, on: true, micro: 'statique', defaut: false, parasite: false, i: 3 }, vue: { cible: [OX + 2.4, 1.6, ZB], dir: [-0.3, 0.35, 1], dist: 5.6 },
      texte: `Vu du micro, les deux résistances sont en **parallèle** : **3,405 kΩ**. Le courant qu'il demande y fait chuter la tension : **U = 48 − I × 3,405 kΩ**, soit environ **38 V pour 3 mA**.

Montez le « Courant demandé » vers 10 mA, le maximum prévu par la norme P48 : il ne reste qu'environ 14 V. Un micro gourmand sur une alimentation faible perd de la marge (il sature plus tôt). Coupez le 48 V : le statique est **muet**, ni crête ni souffle.` },
    { t: 'Un dynamique sur le 48 V', lecon: 'son-48v', reglage: { ondes: false, on: true, micro: 'dynamique', defaut: false, parasite: false, i: 0 }, vue: { cible: [OX + 1.2, 1.3, ZB], dir: [0, 0.45, 1], dist: 8.4 },
      texte: `On branche un **micro dynamique** sur la même ligne, 48 V allumé. Sa **bobine** est reliée entre la broche 2 et la broche 3 : toutes deux sont à **+48 V**, il n'y a **aucune différence** entre elles. Aucun courant ne la traverse : le dynamique fonctionne exactement comme sans 48 V.

C'est pour cela qu'on peut laisser le 48 V sur une tranche où l'on branche un dynamique, **tant que la liaison est symétrique et saine**.` },
    { t: 'Un câble abîmé', lecon: 'son-48v', reglage: { ondes: false, on: true, micro: 'dynamique', defaut: true, parasite: false, i: 0 }, vue: { cible: [OX + 1.2, 1.3, ZB], dir: [0, 0.45, 1], dist: 8.4 },
      texte: `Le câble a un défaut : la broche **3** touche la **masse** (le pont rouge). La broche 2 est toujours à +48 V, la 3 à 0 V : la **bobine** est entre les deux. Un courant continu d'environ **6,8 mA** la traverse (48 V ÷ 7,1 kΩ) : la membrane est décentrée, le son craque et se déforme.

Même chose avec un adaptateur XLR vers jack TS, ou une liaison asymétrique. Un **ruban** ancien peut y laisser son ruban. On allume le 48 V fader baissé, et l'on change un câble douteux.` },
    { t: 'Un parasite sur la ligne', lecon: 'son-liaisons', reglage: { ondes: false, on: false, micro: 'dynamique', defaut: false, parasite: true, sym: true, i: 0 }, vue: { cible: [OX - 0.4, 1.4, ZB + 0.3], dir: [0, 0.5, 1], dist: 10.5 },
      texte: `Un **câble secteur** (jaune) court le long du câble micro : il induit un **ronflement** (50 Hz et ses harmoniques). Les deux conducteurs torsadés le captent **pareil** (les points blancs, sur 2 et sur 3 en même temps) ; le signal, lui, part en **opposition** sur 2 et 3.

L'entrée **symétrique** de la console ne garde que la **différence** entre 2 et 3 : le signal double, le parasite **s'annule**, au déséquilibre près. L'écran de l'entrée montre une voix propre.` },
    { t: 'Sans symétrie, le parasite reste', lecon: 'son-liaisons', reglage: { ondes: false, on: false, micro: 'dynamique', defaut: false, parasite: true, sym: false, i: 0 }, vue: { cible: [OX - 0.4, 1.4, ZB + 0.3], dir: [0, 0.5, 1], dist: 10.5 },
      texte: `La même ligne en **asymétrique** (un jack TS, un RCA) : un seul conducteur et la masse. L'entrée ne peut plus rien soustraire : le **parasite** arrive **tout entier** avec le signal.

Sur un niveau de micro (quelques millivolts), quelques millivolts de ronflement couvrent la voix. D'où la règle : les micros voyagent en **symétrique** (XLR), et une source asymétrique qui doit aller loin passe par une **boîte de direct** (DI).` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { ondes: true, on: true, micro: 'statique', defaut: false, parasite: false, sym: true, i: 3, t: 0 };
    const sol = new THREE.Mesh(new THREE.PlaneGeometry(60, 34), mat('beton', 0x1b2026, { roughness: 0.92 })); sol.rotation.x = -Math.PI / 2; sol.position.set(OX / 2, 0, -2); sol.receiveShadow = true; sol.name = 'sol'; root.add(sol);
    const grille = new THREE.GridHelper(60, 120, 0x2b333b, 0x20272e); grille.position.set(OX / 2, 0.002, -2); /** @type {any} */ (grille.material).transparent = true; /** @type {any} */ (grille.material).opacity = 0.5; root.add(grille);
    // ================= devant : les quatre capsules =================
    const movers = {};
    const socle = (x) => { const p = piece('socle', 'plastique', (b) => { b.cbox(1.5, 0.5, 1.2, x, 0.25, ZF, 0x1d2227, 0.03); }); root.add(p); };
    const screens = {};
    for (const C of CAPS) {
      socle(C.x);
      const E = ecran(1.6, 0.62, 420, () => {}); E.mesh.position.set(C.x, 2.55, ZF - 0.2); root.add(E.mesh);
      E.mesh.userData.info = { nom: `Capsule ${C.nom.toLowerCase()}`, texte: C.loi };
      screens[C.k] = E;
      const t = texte(C.nom, { h: 0.16, bg: 'rgba(18,22,26,.86)' }); t.position.set(C.x, 0.32, ZF + 0.61); root.add(t);
    }
    // la dynamique : membrane, bobine, aimant, coupelle (axe le long de z, face à +z)
    {
      const x = CAPS[0].x, y = 1.25;
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.5, 40, 1, true), mat('alu', 0x59646f, { metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide }));
      cup.rotation.x = Math.PI / 2; cup.position.set(x, y, ZF - 0.25); cup.userData.info = { nom: 'Pièce polaire', texte: 'Elle referme le champ de l\'aimant à travers la fente où flotte la bobine.' }; root.add(cup);
      const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.5, 32), mat('alu', 0x8d959d, { metalness: 0.7, roughness: 0.4 })); mag.rotation.x = Math.PI / 2; mag.position.set(x, y, ZF - 0.25); mag.userData.info = { nom: 'Aimant', texte: 'Un aimant permanent : le champ est intense dans l\'entrefer.' }; root.add(mag);
      const mv = new THREE.Group(); mv.position.set(x, y, ZF); mv.userData.info = { nom: 'Membrane et bobine', texte: 'La membrane pousse la bobine dans le champ : la tension suit sa vitesse. Aucune alimentation.' }; root.add(mv);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 12, 0, Math.PI * 2, 0, 0.75), mat('plastique', 0xd9b56a, { roughness: 0.35, side: THREE.DoubleSide })); dome.rotation.x = Math.PI / 2; dome.position.z = -0.4; mv.add(dome);
      const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.3, 36, 4, true), mat('alu', COUL.cuivre, { metalness: 1, roughness: 0.35, side: THREE.DoubleSide })); coil.rotation.x = Math.PI / 2; coil.position.z = -0.1; mv.add(coil);
      movers.dynamique = { obj: mv, z0: ZF, amp: 0.05 };
    }
    // la statique : membrane, plaque arrière percée, charges, électronique
    {
      const x = CAPS[1].x, y = 1.25;
      const plate = piece('plaque arrière', 'alu', (b) => { b.cyl(0.5, 0.5, 0.08, 0, 0, 0, 0x8d959d, 40, Math.PI / 2); }, { mat: { metalness: 0.7, roughness: 0.35 } });
      plate.position.set(x, y, ZF - 0.15); plate.userData.info = { nom: 'Plaque arrière', texte: 'Percée de trous : l\'air passe. Elle forme la seconde armature du condensateur, à quelques dizaines de micromètres de la membrane.' }; root.add(plate);
      const holes = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, 0.1, 10), eclat(0x101418), 12);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
      for (let i = 0; i < 12; i++) { const a = i / 12 * 2 * Math.PI, r = i % 2 ? 0.32 : 0.18; M.compose(new THREE.Vector3(x + Math.cos(a) * r, y + Math.sin(a) * r, ZF - 0.14), Q, new THREE.Vector3(1, 1, 1)); holes.setMatrixAt(i, M); }
      root.add(holes);
      const memb = new THREE.Mesh(new THREE.CircleGeometry(0.5, 40), mat('alu', 0xe8c060, { metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }));
      const mv = new THREE.Group(); mv.position.set(x, y, ZF + 0.02); mv.add(memb); mv.userData.info = { nom: 'Membrane métallisée', texte: 'Quelques micromètres de plastique doré : la première armature. Très légère, elle suit les aigus et les sons faibles.' }; root.add(mv);
      // les charges : + sur la membrane, − sur la plaque
      const plus = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 10, 8), eclat(0xff8a80), 8), moins = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 10, 8), eclat(0x7fb8ff), 8);
      for (let i = 0; i < 8; i++) { const a = i / 8 * 2 * Math.PI + 0.2; M.makeTranslation(Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.03); plus.setMatrixAt(i, M); M.makeTranslation(x + Math.cos(a) * 0.4, y + Math.sin(a) * 0.4, ZF - 0.1); moins.setMatrixAt(i, M); }
      mv.add(plus); root.add(moins);
      const elec = piece('électronique', 'plastique', (b) => { b.cbox(0.5, 0.36, 0.22, 0, 0, 0, 0x1f5a35, 0.02); b.cbox(0.12, 0.1, 0.06, 0.08, 0.03, 0.13, 0x15181b, 0.01); }); elec.position.set(x, y - 0.1, ZF - 0.55); elec.userData.info = { nom: 'Électronique d\'adaptation', texte: 'Un transistor (FET) transforme l\'impédance énorme de la capsule en une sortie basse impédance, à fort niveau. Il est alimenté par le 48 V.' }; root.add(elec);
      ctx.label(elec, 'électronique (48 V)', { off: [0, -0.32, 0], cls: 'small' });
      movers.statique = { obj: mv, z0: ZF + 0.02, amp: 0.04 };
    }
    // le ruban entre deux aimants
    {
      const x = CAPS[2].x, y = 1.25;
      root.add(piece('aimants du ruban', 'alu', (b) => { b.cbox(0.16, 0.95, 0.4, x - 0.3, y, ZF, 0x59646f, 0.02); b.cbox(0.16, 0.95, 0.4, x + 0.3, y, ZF, 0x59646f, 0.02); }, { mat: { metalness: 0.6, roughness: 0.4 } }));
      const geo = new THREE.PlaneGeometry(0.4, 0.85, 1, 24); const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getY(i) * 60) * 0.012);
      geo.computeVertexNormals();
      const rib = new THREE.Mesh(geo, mat('alu', 0xd8dde2, { metalness: 0.9, roughness: 0.25, side: THREE.DoubleSide }));
      const mv = new THREE.Group(); mv.position.set(x, y, ZF); mv.add(rib); mv.userData.info = { nom: 'Ruban', texte: 'Un ruban d\'aluminium plissé de quelques micromètres, entre deux aimants : il bouge, une tension apparaît à ses bouts. Ouvert des deux côtés : figure en 8. Fragile.' }; root.add(mv);
      movers.ruban = { obj: mv, z0: ZF, amp: 0.06 };
    }
    // l'électret : plaque chargée à vie, transistor
    {
      const x = CAPS[3].x, y = 1.25;
      const film = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 40), mat('plastique', 0x7a5ad0, { roughness: 0.4 })); film.rotation.x = Math.PI / 2; film.position.set(x, y, ZF - 0.15);
      film.userData.info = { nom: 'Film électret', texte: 'Un film plastique dont la charge est piégée à vie : la capsule n\'a plus besoin de polarisation.' }; root.add(film);
      for (let i = 0; i < 6; i++) { const t = texte('+', { h: 0.12, color: '#f2e8ff' }); const a = i / 6 * 2 * Math.PI; t.position.set(x + Math.cos(a) * 0.26, y + Math.sin(a) * 0.26 - 0.03, ZF - 0.1); root.add(t); }
      // membrane à demi transparente : on voit les charges piégées du film derrière elle
      const memb = new THREE.Mesh(new THREE.CircleGeometry(0.42, 40), mat('alu', 0xe8c060, { metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.45 }));
      /** @type {any} */ (memb.material).depthWrite = false; memb.renderOrder = 3;
      const mv = new THREE.Group(); mv.position.set(x, y, ZF + 0.02); mv.add(memb); mv.userData.info = { nom: 'Membrane', texte: 'Comme dans un statique : sa distance au film chargé fait varier la tension.' }; root.add(mv);
      const fet = piece('transistor', 'plastique', (b) => { b.cbox(0.3, 0.24, 0.16, 0, 0, 0, 0x1f5a35, 0.02); }); fet.position.set(x, y - 0.1, ZF - 0.45); fet.userData.info = { nom: 'Transistor (FET)', texte: 'Il adapte l\'impédance de la capsule. Il doit être alimenté : pile, 48 V, ou l\'émetteur HF du micro-cravate.' }; root.add(fet);
      ctx.label(fet, 'transistor : pile ou 48 V', { off: [0, -0.28, 0], cls: 'small' });
      movers.electret = { obj: mv, z0: ZF + 0.02, amp: 0.035 };
    }
    // les fronts de pression : des plans qui avancent vers les capsules
    const fronts = [];
    // un front : un voile très léger et son contour, plus net (sinon les voiles empilés délavent la scène)
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Group(); m.position.set(0, 1.25, 4); root.add(m);
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(11.5, 1.6), eclat(0x7fd3f3, 0.05)); fill.userData.passe = true;
      /** @type {any} */ (fill.material).side = THREE.DoubleSide; /** @type {any} */ (fill.material).depthWrite = false; m.add(fill);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(11.5, 1.6)), new THREE.LineBasicMaterial({ color: 0x7fd3f3, transparent: true, opacity: 0.8 }));
      m.add(edge); m.userData.mats = [fill.material, edge.material];
      fronts.push(m);
    }
    function drawCaps() {
      for (const C of CAPS) {
        const E = screens[C.k], g = E.g, W = E.W, H = E.H, M = MICROS[C.mic], mv = mvParPa(M.sens);
        g.fillStyle = '#0a1214'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#e8ece6'; g.font = '700 30px "Archivo Narrow", sans-serif'; g.fillText(C.nom, 14, 38);
        g.fillStyle = '#ffd38a'; g.font = '600 26px "B612 Mono", monospace'; g.fillText(`${fmtNum(mv, mv < 10 ? 1 : 0)} mV sous 1 Pa`, 14, 80);
        g.fillStyle = '#aab4ba'; g.font = '19px "Archivo Narrow", sans-serif'; g.fillText(C.loi, 14, 112);
        g.fillText(M.ordre ? 'ordre de grandeur' : 'type SM58, fiche du fabricant', 14, 140);
        E.mesh.material.map.needsUpdate = true;
      }
    }
    drawCaps();
    // ================= derrière : la liaison micro ouverte =================
    const cons = piece('console', 'plastique', (b) => { b.cbox(2.0, 1.5, 1.2, XC - 0.6, 0.95, ZB, 0x262c33, 0.03); b.cbox(2.1, 0.2, 1.3, XC - 0.6, 0.12, ZB, 0x1d2227, 0.03); });
    cons.userData.info = { nom: 'Console : l\'entrée micro', texte: 'Le +48 V, deux résistances de 6,81 kΩ vers les broches 2 et 3, deux condensateurs qui arrêtent le continu avant le préampli.' }; root.add(cons);
    const tCons = texte('console · entrée micro', { h: 0.14, bg: 'rgba(18,22,26,.86)' }); tCons.position.set(XC - 0.6, 1.88, ZB + 0.62); root.add(tCons);
    const src48 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.3, 0.1), lum(0xe0453a, 0.5)); src48.position.set(XC - 1.2, 1.35, ZB + 0.62); src48.userData.info = { nom: 'Source +48 V', texte: 'La touche 48 V de la tranche (ou d\'un groupe de tranches) la met en service.' }; root.add(src48);
    const t48 = texte('+48 V', { h: 0.1, color: '#fff' }); t48.position.set(XC - 1.2, 1.35, ZB + 0.68); root.add(t48);
    const res = [];
    for (const [y, n] of [[Y2, 2], [Y3, 3]]) {
      const r = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.4, 16), mat('plastique', 0xc9b48a, { roughness: 0.5 })); r.rotation.z = Math.PI / 2; r.position.set(XC - 0.6, y, ZB + 0.62);
      r.userData.info = { nom: `Résistance de 6,81 kΩ (broche ${n})`, texte: 'Deux résistances égales : le 48 V arrive pareil sur les deux conducteurs. Vues du micro, en parallèle : 3,405 kΩ.' }; root.add(r); res.push(r);
      const tr = texte('6,81 kΩ', { h: 0.075, color: '#ffd38a' }); tr.position.set(XC - 0.6, y + 0.1, ZB + 0.68); root.add(tr);
      root.add(cableEntre([XC - 1.2, 1.35, ZB + 0.62], [XC - 0.8, y, ZB + 0.62], 0.012, mat('plastique', 0xe0453a), 0.02, { out: 0.02 }));
    }
    // les trois conducteurs ouverts
    const condM = { 2: mat('plastique', COUL.rouge, { roughness: 0.45 }), 3: mat('plastique', COUL.cyan, { roughness: 0.45 }), 1: mat('alu', 0xa7adb3, { metalness: 0.6, roughness: 0.5 }) };
    const path = { 2: courbe([[XC - 0.4, Y2, ZB + 0.62], [XC + 0.4, Y2, ZB + 0.3], [XM - 0.4, Y2, ZB + 0.3], [XM, Y2, ZB + 0.3]]), 3: courbe([[XC - 0.4, Y3, ZB + 0.62], [XC + 0.4, Y3, ZB + 0.3], [XM - 0.4, Y3, ZB + 0.3], [XM, Y3, ZB + 0.3]]), 1: courbe([[XC + 0.4, Y1, ZB + 0.62], [XC + 0.6, Y1, ZB + 0.3], [XM - 0.4, Y1, ZB + 0.3], [XM, Y1, ZB + 0.3]]) };
    /** @type {Record<number, THREE.Mesh>} */
    const conds = {};
    for (const n of [2, 3, 1]) {
      const m = tube(path[n], n === 1 ? 0.03 : 0.025, condM[n], 80, 10); conds[n] = m; m.userData.info = { nom: `Broche ${n} : ${n === 1 ? 'masse (blindage)' : n === 2 ? 'point chaud' : 'point froid'}`, texte: n === 1 ? 'Le retour du courant du 48 V, et le blindage du câble.' : 'Le signal (en opposition sur 2 et 3) et le +48 V (pareil sur 2 et 3).' };
      root.add(m);
      ctx.label(new THREE.Vector3(XC + 1.4, n === 2 ? Y2 : n === 3 ? Y3 : Y1, ZB + 0.3), `broche ${n}`, { off: [0, 0.1, 0], cls: 'small' });
    }
    const gaine = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, XM - XC - 1.6, 32, 1, true), verre(0x8a949c, 0.08, { depthWrite: false, side: THREE.DoubleSide }));
    gaine.rotation.z = Math.PI / 2; gaine.position.set((XC + XM) / 2 + 0.2, Y3, ZB + 0.3); gaine.userData.passe = true; gaine.renderOrder = 1; root.add(gaine);
    // le défaut : la broche 3 touche la masse
    const pont = new THREE.Mesh(new THREE.BoxGeometry(0.06, Y3 - Y1, 0.06), eclat(0xff3b30)); pont.position.set(OX + 1.6, (Y3 + Y1) / 2, ZB + 0.3); pont.visible = false;
    pont.userData.info = { nom: 'Défaut : la broche 3 touche la masse', texte: 'Un fil écrasé, une soudure, un adaptateur asymétrique : le 48 V trouve un chemin à travers la bobine du dynamique.' }; root.add(pont);
    // le micro au bout : un statique (boîtier) ou un dynamique (bobine)
    const micS = piece('micro statique', 'plastique', (b) => { b.cbox(1.0, 0.9, 0.7, 0, 0, 0, 0x30373f, 0.04); b.cbox(0.3, 0.5, 0.06, 0.1, 0, 0.36, 0x1f5a35, 0.02); });
    micS.position.set(XM + 0.6, 1.0, ZB + 0.3); micS.userData.info = { nom: 'Micro statique', texte: 'Il prend son courant sur les broches 2 et 3 : polarisation de la capsule et électronique.' }; root.add(micS);
    const micD = new THREE.Group(); micD.position.set(XM + 0.6, 1.0, ZB + 0.3); root.add(micD);
    const bob = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.08, 10, 32), mat('alu', COUL.cuivre, { metalness: 1, roughness: 0.35 })); bob.userData.info = { nom: 'Bobine du dynamique', texte: 'Branchée entre les broches 2 et 3. Avec une liaison saine, aucune tension continue entre elles : rien ne la traverse.' }; micD.add(bob);
    const micTag = ctx.label(new THREE.Vector3(XM + 0.6, 1.62, ZB + 0.3), '', { cls: 'small' });
    const uScr = ecran(1.5, 0.55, 420, () => {}); uScr.mesh.position.set(XM + 0.4, 2.3, ZB + 0.2); root.add(uScr.mesh);
    uScr.mesh.userData.info = { nom: 'Ce que mesure le voltmètre au micro', texte: 'La tension qui reste au micro : U = 48 − I × 3,405 kΩ.' };
    // le câble secteur et l'écran de l'entrée
    const secteur = tube(courbe([[XC + 0.2, 0.55, ZB + 1.15], [OX, 0.6, ZB + 1.05], [XM, 0.55, ZB + 1.15]]), 0.06, mat('plastique', 0xd9b020, { roughness: 0.5 }), 60, 10);
    secteur.userData.info = { nom: 'Câble secteur (230 V)', texte: 'Il rayonne un champ à 50 Hz : le câble micro voisin capte un ronflement.' }; root.add(secteur);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, XM - XC - 0.3, 24, 1, true), eclat(0xffd020, 0.12)); halo.rotation.z = Math.PI / 2; halo.position.set((XC + XM) / 2 + 0.1, 0.57, ZB + 1.1); halo.userData.passe = true; /** @type {any} */ (halo.material).depthWrite = false; root.add(halo);
    const inScr = ecran(1.7, 0.75, 460, () => {}); inScr.mesh.position.set(XC - 0.6, 2.55, ZB + 0.1); root.add(inScr.mesh);
    inScr.mesh.userData.info = { nom: 'Entrée de la console : 2 − 3', texte: 'Ce que garde l\'entrée symétrique : la différence entre les deux conducteurs.' };
    const fl = ctx.flux(220, new THREE.SphereGeometry(1, 10, 8), eclat(0xffffff));
    // ---------------- calculs et affichage ----------------
    const etat = () => {
      const C0 = CHARGES[S.micro], stat = S.micro === 'statique';
      const I = S.on && stat ? S.i : 0, U = S.on ? uMicro(I) : 0, fu = S.on && !stat ? fuite(C0.rb || 300, S.defaut) : 0;
      const L = liaison(2, 20, S.sym, 0.001);
      return { stat, I, U, fu, L };
    };
    function drawU(X) {
      const g = uScr.g, W = uScr.W, H = uScr.H;
      g.fillStyle = '#071012'; g.fillRect(0, 0, W, H);
      g.font = '600 34px "B612 Mono", monospace';
      if (X.stat) { g.fillStyle = S.on ? '#9fe0b4' : '#ff8a80'; g.fillText(S.on ? `U = ${fmtNum(X.U, 1)} V` : 'U = 0 V : muet', 16, 52); }
      else { g.fillStyle = X.fu ? '#ff8a80' : '#9fe0b4'; g.fillText(X.fu ? `bobine : ${fmtNum(X.fu, 1)} mA` : 'bobine : 0 mA', 16, 52); }
      g.fillStyle = '#aab4ba'; g.font = '20px "Archivo Narrow", sans-serif';
      g.fillText(X.stat ? `${fmtNum(X.I, 1)} mA demandés · 48 − I × 3,405 kΩ` : S.on ? (S.defaut ? '48 V ÷ (6,81 kΩ + 300 Ω)' : 'broches 2 et 3 à +48 V : aucune différence') : '48 V éteint', 16, 92);
      uScr.mesh.material.map.needsUpdate = true;
    }
    function drawIn(X, ph) {
      const g = inScr.g, W = inScr.W, H = inScr.H;
      g.fillStyle = '#071012'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#aab4ba'; g.font = '20px "Archivo Narrow", sans-serif';
      g.fillText(S.parasite ? (S.sym ? 'entrée symétrique : 2 − 3' : 'entrée asymétrique : conducteur − masse') : 'entrée de la console', 14, 28);
      // le parasite restant rapporté au signal (2 mV ici), puis le tout ramené à la hauteur de l'écran
      const pr = S.parasite ? X.L.reste / 2 : 0, k = 1 / (1 + 1.4 * pr), res = pr * k;
      g.strokeStyle = '#9fe0b4'; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i <= W - 28; i++) { const u = i / (W - 28); const v = Math.sin(2 * Math.PI * 4 * u + ph) * 0.6 * k + 0.6 * res * (Math.sin(2 * Math.PI * 1.1 * u + ph * 0.3) + 0.4 * Math.sin(2 * Math.PI * 3.3 * u)); const y = H / 2 + 14 - v * (H / 2 - 30); if (i) g.lineTo(14 + i, y); else g.moveTo(14, y); }
      g.stroke();
      g.fillStyle = S.parasite && !S.sym ? '#ff8a80' : '#9fe0b4'; g.font = '600 22px "B612 Mono", monospace';
      g.fillText(!S.parasite ? 'signal seul' : S.sym ? `parasite rejeté : ${fmtNum(X.L.rejection, 0)} dB` : 'parasite : tout entier', 14, H - 14);
      inScr.mesh.material.map.needsUpdate = true;
    }
    function maj() {
      const X = etat();
      micS.visible = S.micro === 'statique'; micD.visible = S.micro !== 'statique';
      // en asymétrique (jack TS, RCA), il n'y a plus de point froid : un conducteur et la masse
      conds[3].visible = S.sym;
      const bm = /** @type {any} */ (bob.material); bm.color.set(S.micro === 'ruban' ? 0xd8dde2 : COUL.cuivre); bm.emissive.set(X.fu ? 0x7a1010 : 0x000000);
      micTag.set(S.micro === 'statique' ? 'micro statique' : S.micro === 'ruban' ? 'micro à ruban' : 'micro dynamique');
      pont.visible = S.defaut; secteur.visible = halo.visible = S.parasite;
      /** @type {any} */ (src48.material).emissiveIntensity = S.on ? 0.9 : 0.05;
      drawU(X);
      ctx.read('Les capsules sous 1 Pa (94 dB SPL)', CAPS.map((C) => `${C.nom.toLowerCase()} ${fmtNum(mvParPa(MICROS[C.mic].sens), mvParPa(MICROS[C.mic].sens) < 10 ? 1 : 0)} mV`).join(' · ') + ' (ordres de grandeur, sauf le type SM58)');
      ctx.read('Tension au micro', X.stat ? (S.on ? `${fmtNum(X.U, 1)} V = 48 − ${fmtNum(X.I, 1)} mA × ${fmtNum(rFantome() / 1000, 3)} kΩ` : '0 V : 48 V éteint, le statique est muet') : S.on ? '+48 V sur 2 et sur 3, 0 V entre elles' : '0 V');
      ctx.read('Courants dans le câble', X.stat && S.on ? `${fmtNum(X.I / 2, 2)} mA sur la 2, autant sur la 3, ${fmtNum(X.I, 1)} mA de retour par la 1 (court-circuit : ${fmtNum(iCourtCircuit(), 1)} mA au plus ; P48 : ${P48.imax} mA prévus)` : X.fu ? `${fmtNum(X.fu, 2)} mA continus à travers la bobine (câble défectueux)` : 'aucun courant dans la bobine');
      ctx.read('Parasite à l\'entrée de la console', !S.parasite ? 'pas de câble secteur à côté' : S.sym ? `20 mV captés, ${fmtNum(X.L.reste, 2)} mV restants (déséquilibre 0,1 % : ${fmtNum(X.L.rejection, 0)} dB de réjection)` : '20 mV captés, 20 mV restants : rien n\'est rejeté');
      return X;
    }
    let X = maj(), ui = null, tC = 0, tN = 0, tD = 0;
    const inputs = {};
    const setUi = (k, v) => { const i = inputs[k]; if (i) { i.value = String(v); i.dispatchEvent(new Event('input')); } };
    const sync = () => { if (!ui) return; for (const b of ui.querySelectorAll('[data-v]')) { const v = /** @type {HTMLElement} */ (b).dataset.v; const grp = /** @type {HTMLElement} */ (b.closest('.co-choice'))?.textContent || ''; const on = grp.startsWith('Micro') ? v === S.micro : grp.startsWith('48 V') ? v === (S.on ? 'on' : 'off') : grp.startsWith('Câble') ? v === (S.defaut ? 'def' : 'ok') : grp.startsWith('Liaison') ? v === (S.sym ? 'sym' : 'asym') : null; if (on != null) b.setAttribute('aria-pressed', String(on)); } };
    return {
      etape(i, E) {
        const R = E.reglage || {};
        if (R.ondes != null) S.ondes = R.ondes;
        if (R.on != null) S.on = R.on;
        if (R.micro) S.micro = R.micro;
        if (R.defaut != null) S.defaut = R.defaut;
        if (R.parasite != null) S.parasite = R.parasite;
        if (R.sym != null) S.sym = R.sym;
        if (R.i != null && R.micro === 'statique') { S.i = R.i; setUi('i', R.i); }
        if (i < 4) S.ondes = true;
        fl.clear(); X = maj(); sync();
      },
      update(dt) {
        S.t += dt;
        // devant : les fronts avancent, les parties mobiles suivent la pression
        fronts.forEach((m, k) => {
          const u = ((S.t * 0.35 + k / fronts.length) % 1); m.position.z = 4.2 - u * 3.0; m.visible = S.ondes;
          const [fm, em] = m.userData.mats; fm.opacity = 0.06 * (1 - u); em.opacity = 0.85 * (1 - u) + 0.05;
        });
        const p = Math.sin(2 * Math.PI * 0.35 * fronts.length * S.t);
        for (const [k, M] of Object.entries(movers)) { M.obj.position.z = M.z0 + (S.ondes ? p * M.amp : 0); if (k === 'ruban') M.obj.rotation.y = S.ondes ? p * 0.05 : 0; }
        // derrière : le courant du 48 V (orange), le parasite (blanc, sur 2 et 3 ensemble)
        tC += dt;
        if (S.on && tC > 0.25) {
          tC = 0;
          if (X.stat && X.I > 0) {
            const sp = 0.6 + X.I * 0.12;
            for (const n of [2, 3]) fl.add({ curve: path[n], speed: sp, color: 0xff9a3a, scale: 0.05, info: { nom: `Courant du 48 V (broche ${n})`, texte: `La moitié du courant du micro : ${fmtNum(X.I / 2, 2)} mA.` } });
            fl.add({ curve: inverse(path[1]), speed: sp, color: 0xffb060, scale: 0.06, info: { nom: 'Retour par la masse (broche 1)', texte: `Tout le courant du micro revient : ${fmtNum(X.I, 1)} mA.` } });
          } else if (X.fu) fl.add({ curve: path[2], speed: 1.2, color: 0xff3b30, scale: 0.06, info: { nom: 'Courant de défaut', texte: `Il traverse la bobine puis rejoint la masse par le défaut : ${fmtNum(X.fu, 1)} mA.` } });
        }
        tN += dt;
        if (S.parasite && tN > 0.35) {
          tN = 0;
          for (const n of S.sym ? [2, 3] : [2]) fl.add({ curve: path[n], speed: 2.2, color: 0xffffff, scale: 0.045, info: { nom: 'Parasite capté', texte: S.sym ? 'Le même sur les deux conducteurs : la différence l\'annule.' : 'Sur le seul conducteur : rien ne l\'annule.' } });
        }
        tD += dt;
        if (tD > 0.1) { tD = 0; drawIn(X, S.t * 4); }
        bob.scale.setScalar(X.fu ? 1 + 0.08 * Math.sin(S.t * 18) : 1);
      },
      commandes() {
        const s = slider('Courant demandé par le statique', 0, 12, S.i, 0.5, (v) => { S.i = v; X = maj(); }, (v) => fmtNum(v, 1) + ' mA');
        inputs.i = s.querySelector('input');
        ui = el('div', { class: 'v3-ctl' },
          choice('Micro au bout du câble', [['statique', 'statique'], ['dynamique', 'dynamique'], ['ruban', 'ruban']], S.micro, (v) => { S.micro = v; fl.clear(); X = maj(); ctx.say(v === 'statique' ? 'Un statique : il prend son courant sur les broches 2 et 3.' : `Un ${v === 'ruban' ? 'ruban' : 'dynamique'} : sa bobine est entre les broches 2 et 3.`); }),
          s,
          choice('48 V', [['on', 'allumé'], ['off', 'éteint']], 'on', (v) => { S.on = v === 'on'; fl.clear(); X = maj(); ctx.say(S.on ? '48 V allumé (fader baissé, d\'abord).' : '48 V coupé.'); }),
          choice('Câble', [['ok', 'sain'], ['def', 'broche 3 à la masse']], 'ok', (v) => { S.defaut = v === 'def'; fl.clear(); X = maj(); ctx.say(S.defaut ? 'Défaut : la broche 3 touche la masse.' : 'Câble réparé.'); }),
          choice('Liaison', [['sym', 'symétrique'], ['asym', 'asymétrique']], 'sym', (v) => { S.sym = v === 'sym'; X = maj(); }),
          el('div', { class: 'v3-row' },
            el('button', { type: 'button', class: 'btn small', onclick: () => { S.parasite = !S.parasite; X = maj(); ctx.say(S.parasite ? 'Un câble secteur longe la ligne.' : 'Câble secteur éloigné.'); } }, 'Câble secteur à côté'),
            el('button', { type: 'button', class: 'btn small', onclick: () => { S.ondes = !S.ondes; } }, 'Son sur les capsules')));
        return ui;
      },
      dispose() { fl.clear(); },
    };
  },
};
