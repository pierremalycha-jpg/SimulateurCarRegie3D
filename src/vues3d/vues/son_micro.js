// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../../util.js';
import { choice, slider, fmtNum } from '../../cours/kit.js';
import { MICROS, DIRECTIVITES, aDistance, paDeSpl, sortieMv, sortieDbv, sortieDbu, gainPour, reponse, attenuation, proximite } from '../../cours/son_micro_calc.js';
import { COUL, mat, lum, verre, eclat, ecran, texte, piece, tube, courbe } from '../kit.js';

// ----------------------------------------------------------------------------------
// Vue 3D « Le micro dynamique ouvert » : un micro de chant de type SM58 agrandi environ 18 fois, couché sur
// son pied, qu'on éclate de la grille au connecteur (grille, mousse, membrane, bobine, aimant et pièce
// polaire, suspension, corps ouvert, fils, XLR et ses trois broches). Une source envoie des fronts de
// pression ; la membrane et la bobine bougent (mouvement exagéré), l'oscilloscope branché sur les broches 2 et
// 3 montre la tension induite. La source tourne autour du micro (la courbe cardioïde, à plat sur la table) et
// s'en approche (effet de proximité). Les chiffres viennent de cours/son_micro_calc.js : sensibilité des
// types SM58 et SM48, loi de la distance, A + B cos θ, effet de proximité idéal.
// ----------------------------------------------------------------------------------
const AY = 1.45; // hauteur de l'axe du micro
const HX = -1.25; // centre de la tête (grille)
const RG = 0.46; // rayon de la grille (≈ Ø 51 mm × 18)
/** la distance réelle (m) → la distance dans la scène (rayon du cercle de la source autour de la tête) */
const RV = (r) => 0.85 + Math.log(r / 0.02) / Math.log(100) * 3.2;
/** la direction d'arrivée : θ = 0 dans l'axe (devant la grille, vers −x), θ = 90° sur le côté (+z) */
const DIR = (deg) => new THREE.Vector3(-Math.cos(deg * Math.PI / 180), 0, Math.sin(deg * Math.PI / 180));
const hz = (f) => (f >= 1000 ? fmtNum(f / 1000, f >= 10000 ? 0 : 1) + ' kHz' : fmtNum(f, 0) + ' Hz');
const metres = (r) => (r < 1 ? fmtNum(r * 100, 0) + ' cm' : fmtNum(r, 1) + ' m');
const signe = (v, d = 1) => (v > 0.05 ? '+' : v < -0.05 ? '−' : '') + fmtNum(Math.abs(v), d);
const logv = (u, a, b) => a * (b / a) ** (u / 100), logu = (v, a, b) => Math.round(100 * Math.log(v / a) / Math.log(b / a));

export const VUE_SON_MICRO = {
  id: 'son-micro', chapitre: 'son', titre: 'Le micro dynamique ouvert',
  resume: 'Un micro de chant de type SM58 agrandi et éclaté : la membrane et sa bobine dans l\'aimant, la tension induite à l\'oscilloscope, la courbe cardioïde quand la source tourne, l\'effet de proximité quand elle s\'approche.',
  lecons: ['son-dynamique', 'son-directivite', 'son-acoustique'],
  lectures: ['Au micro', 'Directivité et proximité', 'Tension aux broches 2 et 3', 'Gain pour 0 dBu'],
  depart: 'Un micro de chant de type SM58, environ 18 fois plus grand que nature. Les fronts de pression partent de la source (le globe cyan) ; le mouvement de la membrane est très exagéré.',
  vue: { cible: [0, 1.5, 0], dir: [0.2, 0.32, 1], dist: 7.2 },
  orbite: { rMin: 1, rMax: 18 },
  etapes: [
    { t: 'Un micro de chant, agrandi 18 fois', lecon: 'son-dynamique', reglage: { ex: 0, ondes: false, polaire: false, tourne: false, th: 0, r: 0.05, f: 1000, L1: 70 },
      texte: `Un micro dynamique de **type SM58**, le micro des voix sur scène, agrandi environ **18 fois** : 16 cm deviennent près de 3 m. Devant, la **grille** sphérique ; derrière, le **corps**, tenu par la pince du pied ; au bout, le connecteur **XLR** et ses trois broches.

Ses chiffres (fiche du fabricant) : réponse de **50 Hz à 15 kHz**, directivité **cardioïde**, sensibilité **−54,5 dBV/Pa** (≈ 1,9 mV sous 1 Pa), impédance nominale **150 Ω**. Aucune pile, aucune alimentation : il produit seul sa tension. Cliquez sur une pièce pour la décrire.` },
    { t: 'Éclaté : de la grille au connecteur', lecon: 'son-dynamique', reglage: { ex: 1, ondes: false, polaire: false, tourne: false, th: 0, r: 0.05, f: 1000, L1: 70 }, vue: { cible: [0, 1.5, 0], dir: [0.1, 0.42, 1], dist: 8.2 },
      texte: `Les pièces s'écartent dans l'ordre du trajet du son :
- la **grille**, une sphère de fil d'acier, et sa **mousse** qui casse le souffle des « p » et des « b » ;
- la **capsule** : la **membrane** (ambre), la **bobine** de cuivre collée derrière elle, l'**aimant** et sa **pièce polaire** ;
- la **suspension** de caoutchouc qui isole la capsule des chocs et des bruits de main ;
- le **corps**, ouvert ici pour montrer les deux fils, et le **connecteur XLR**.` },
    { t: 'La capsule : une membrane, une bobine, un aimant', lecon: 'son-dynamique', reglage: { ex: 1, ondes: false, polaire: false, tourne: false, th: 0, r: 0.05, f: 1000, L1: 70 }, vue: { cible: [-1.45, 1.45, 0], dir: [0.45, 0.25, 1], dist: 3.2 },
      texte: `La **membrane**, un dôme de plastique très fin, porte une **bobine** de fil de cuivre émaillé, plus fin qu'un cheveu. La bobine plonge dans l'**entrefer** : la fente circulaire entre l'**aimant** (au centre) et la **pièce polaire** (la coupelle qui l'entoure), où le champ magnétique est intense.

Rien ne frotte : la membrane est tenue par son bord souple et la bobine flotte dans la fente. Toute la capsule, membrane et bobine comprises, pèse quelques dixièmes de gramme pour la partie mobile : c'est elle que la pression doit mettre en mouvement.` },
    { t: 'Le son pousse, la bobine produit une tension', lecon: 'son-dynamique', reglage: { ex: 0.35, ondes: true, polaire: false, tourne: false, th: 0, r: 0.05, f: 1000, L1: 70 }, vue: { cible: [-0.5, 2.0, 0], dir: [0.12, 0.28, 1], dist: 7.2 },
      texte: `La source envoie ses **fronts de pression** (les cercles cyan). Chaque surpression pousse la membrane, chaque dépression la tire : la **bobine** va et vient dans le champ de l'aimant, et une **tension** apparaît à ses bornes, par **induction** : e = B · l · v (le champ, la longueur du fil, la **vitesse** de la bobine).

L'**oscilloscope**, branché sur les broches 2 et 3, montre cette tension : quelques millivolts pour une voix proche. Le mouvement réel de la membrane est minuscule (une fraction de micromètre à 1 kHz) : ici, il est exagéré des milliers de fois.` },
    { t: 'Des pascals aux millivolts', lecon: 'son-acoustique', reglage: { ex: 0, ondes: true, polaire: false, tourne: false, th: 0, r: 0.3, f: 1000, L1: 70 }, vue: { cible: [-0.2, 1.7, 0], dir: [0.1, 0.25, 1], dist: 6.4 },
      texte: `La source fait **70 dB SPL à 1 m** (une voix projetée, ordre de grandeur). À la distance choisie, le micro reçoit moins : **−6 dB par doublement** de la distance. Le niveau en dB SPL devient une pression en pascals (94 dB SPL = 1 Pa), la sensibilité du micro (**−54,5 dBV/Pa**) la change en volts.

Rapprochez la source avec le curseur « Distance » : à 5 cm, la voix arrive 26 dB plus fort qu'à 1 m. Passez au **type SM48** (−57,5 dBV/Pa) : 3 dB de moins pour le même son, 3 dB de gain en plus à la console.` },
    { t: 'Tourner autour : la directivité cardioïde', lecon: 'son-directivite', reglage: { ex: 0, ondes: true, polaire: true, tourne: true, th: 0, r: 0.5, f: 1000, L1: 80 }, vue: { cible: [-2.1, 1.45, 0], dir: [0.05, 1, 0.42], dist: 11.5 },
      texte: `La source fait le tour du micro. À plat sur la table, la **courbe cardioïde** (ambre) : la sensibilité du micro selon l'angle d'arrivée, **0,5 + 0,5 × cos θ**. Dans l'axe, tout ; sur le côté (90°), la moitié, **−6 dB** ; derrière (180°), presque **rien**.

Regardez l'oscilloscope : la tension s'effondre quand la source passe derrière. C'est pour cela qu'on place le **retour de scène** du chanteur derrière un cardioïde, dans le trou de sa courbe : le micro ne le reprend pas, le larsen recule.` },
    { t: 'Tout près : l\'effet de proximité', lecon: 'son-directivite', reglage: { ex: 0, ondes: true, polaire: false, tourne: false, th: 0, r: 0.02, f: 100, L1: 70 }, vue: { cible: [-1.6, 1.5, 0], dir: [0.3, 0.3, 1], dist: 4.2 },
      texte: `La source est à **2 cm**, et joue un grave (**100 Hz**). Un micro directif mesure en partie le **gradient** de pression, la différence entre l'avant et l'arrière de la membrane ; tout près d'une source, l'onde est encore sphérique et ce gradient grandit aux basses fréquences : les **graves montent**, c'est l'**effet de proximité**.

Le modèle idéal donne ici plus de 20 dB ; un vrai micro est réglé pour en compenser une partie (ordre de grandeur). Éloignez la source à 50 cm, montez à 1 kHz : l'effet disparaît. À la console, le **passe-haut** de la tranche le corrige.` },
    { t: 'Le connecteur XLR', lecon: 'son-dynamique', reglage: { ex: 0.6, ondes: true, polaire: false, tourne: false, th: 0, r: 0.05, f: 1000, L1: 70 }, vue: { cible: [1.75, 1.45, 0], dir: [1, 0.25, 0.4], dist: 2.4 },
      texte: `Au bout du corps, le **XLR mâle** : broche **1** la masse (reliée au corps et au blindage du câble), broche **2** le point chaud, broche **3** le point froid. Les deux fils de la bobine arrivent sur 2 et 3 : la tension de la bobine est la **différence** entre ces deux broches, ce qu'attend une entrée **symétrique**.

C'est aussi pourquoi le **48 V** ne gêne pas ce micro : la console le met à égalité sur 2 et 3, il n'y a aucune différence entre elles, rien ne traverse la bobine.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { mic: 'sm58', ex: 0, exT: 0, ondes: false, polaire: false, tourne: false, th: 0, r: 0.05, f: 1000, L1: 70, ph: 0, t: 0 };
    const CARD = DIRECTIVITES.cardio;
    // ---------------- le pied ----------------
    root.add(piece('pied', 'alu', (b) => {
      b.cyl(0.42, 0.46, 0.05, 0.3, 0.025, 0, 0x22262b, 32);
      b.cyl(0.03, 0.03, AY - 0.18, 0.3, (AY - 0.18) / 2 + 0.05, 0, 0x9aa2aa, 12);
      b.cbox(0.12, 0.08, 0.3, 0.3, AY - 0.16, 0, 0x22262b, 0.02);
    }, { mat: { roughness: 0.35, metalness: 0.6 } }));
    const pinceTag = texte('pince', { h: 0.08 }); pinceTag.position.set(0.3, AY - 0.3, 0.18); root.add(pinceTag);
    // ---------------- les pièces, chacune dans son groupe (pour l'éclaté) ----------------
    /** @type {{ g: THREE.Group, base: number, off: number }[]} */
    const parts = [];
    const part = (name, base, off, info) => { const g = new THREE.Group(); g.name = name; g.position.x = base; g.userData.info = info; root.add(g); parts.push({ g, base, off }); return g; };
    // la grille : une sphère de fil (un maillage en fil de fer) et son col
    const gGr = part('grille', HX, -1.0, { nom: 'Grille', texte: 'Une sphère de fil d\'acier tressé : elle protège la capsule des chocs. On la dévisse pour la laver.' });
    const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(RG, 28, 18)), new THREE.LineBasicMaterial({ color: 0xc8cdd2, transparent: true, opacity: 0.55 }));
    gGr.add(wire);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(RG * 0.995, 32, 20), verre(0x8a949c, 0.08, { depthWrite: false })); shell.renderOrder = 1; gGr.add(shell);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(RG * 0.82, RG * 0.82, 0.12, 40, 1, true), mat('alu', 0xb8bec4, { metalness: 0.8, roughness: 0.3, side: THREE.DoubleSide }));
    col.rotation.z = Math.PI / 2; col.position.x = 0.36; gGr.add(col);
    // la mousse
    const gMo = part('mousse', HX, -0.7, { nom: 'Mousse anti-pop', texte: 'Une mousse à cellules ouvertes, sous la grille : elle casse la bouffée d\'air des « p » et des « b » (les plosives) avant la membrane.' });
    const moM = mat('mousse', 0x30353a, { transparent: true, opacity: 0.45, roughness: 1 }); moM.depthWrite = false;
    const mo = new THREE.Mesh(new THREE.SphereGeometry(RG * 0.9, 28, 18), moM);
    mo.renderOrder = 1; gMo.add(mo);
    // la membrane (un dôme) : elle bouge avec la bobine
    const gMe = part('membrane', HX - 0.08, -0.42, { nom: 'Membrane', texte: 'Un dôme de plastique très fin : la pression le pousse et le tire. Elle est collée à la bobine.' });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 12, 0, Math.PI * 2, 0, 0.75), mat('plastique', 0xd9b56a, { roughness: 0.35, side: THREE.DoubleSide }));
    dome.rotation.z = Math.PI / 2; dome.position.x = 0.26; gMe.add(dome);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.018, 8, 40), mat('caoutchouc', 0x8a6a2a)); rim.rotation.y = Math.PI / 2; rim.position.x = 0.03; gMe.add(rim);
    // la bobine
    const gBo = part('bobine', HX + 0.06, -0.22, { nom: 'Bobine mobile', texte: 'Du fil de cuivre émaillé très fin, enroulé sur un petit tube collé à la membrane. Elle plonge dans l\'entrefer de l\'aimant : en bougeant, elle produit la tension (e = B · l · v).' });
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.16, 36, 6, true), mat('alu', COUL.cuivre, { metalness: 1, roughness: 0.35, side: THREE.DoubleSide }));
    coil.rotation.z = Math.PI / 2; gBo.add(coil);
    for (let i = 0; i < 6; i++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.006, 6, 36), mat('alu', 0xe0a060, { metalness: 1, roughness: 0.3 })); t.rotation.y = Math.PI / 2; t.position.x = -0.06 + i * 0.024; gBo.add(t); }
    // l'aimant et la pièce polaire
    const gAi = part('aimant', HX + 0.14, 0, { nom: 'Aimant (au centre)', texte: 'Un aimant permanent : avec la pièce polaire, il concentre un champ intense dans la fente circulaire (l\'entrefer) où flotte la bobine.' });
    const mag = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.2, 32), mat('alu', 0x8d959d, { metalness: 0.7, roughness: 0.4 })); mag.rotation.z = Math.PI / 2; gAi.add(mag);
    const gPo = part('pièce polaire', HX + 0.15, 0.2, { nom: 'Pièce polaire (coupelle)', texte: 'Une coupelle de fer doux autour de l\'aimant : le champ se referme à travers la fente où passe la bobine. Elle forme le corps de la capsule.' });
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.22, 40, 1, true), mat('alu', 0x59646f, { metalness: 0.6, roughness: 0.45, side: THREE.DoubleSide })); cup.rotation.z = Math.PI / 2; gPo.add(cup);
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 40), mat('alu', 0x59646f, { metalness: 0.6, roughness: 0.45 })); back.rotation.z = Math.PI / 2; back.position.x = 0.11; gPo.add(back);
    // la suspension
    const gSu = part('suspension', HX + 0.46, 0.36, { nom: 'Suspension', texte: 'Un support de caoutchouc (pneumatique sur ce type de micro) : il isole la capsule du corps, donc des chocs et des bruits de main.' });
    const sus = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.045, 12, 40), mat('caoutchouc', 0x2a2d31)); sus.rotation.y = Math.PI / 2; gSu.add(sus);
    // le corps, ouvert (moitié avant coupée) : les deux fils de la bobine y descendent
    const gCo = part('corps', 0.25, 0.6, { nom: 'Corps', texte: 'Le tube métallique, ouvert ici pour montrer l\'intérieur : deux fils mènent la tension de la bobine aux broches 2 et 3 du connecteur.' });
    const cut = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.0);
    const bodyM = mat('laque', 0x3c4249, { roughness: 0.45, side: THREE.DoubleSide }), bodyInM = mat('plastique', 0x1a1d21, { side: THREE.BackSide });
    bodyM.clippingPlanes = [cut]; bodyInM.clippingPlanes = [cut];
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.15, 2.1, 40, 1, true), bodyM);
    body.rotation.z = Math.PI / 2; gCo.add(body);
    const bodyIn = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.145, 2.1, 40, 1, true), bodyInM);
    bodyIn.rotation.z = Math.PI / 2; gCo.add(bodyIn);
    // le connecteur XLR mâle et ses broches
    const gX = part('XLR', 1.45, 1.0, { nom: 'Connecteur XLR mâle', texte: 'Broche 1 : masse (corps, blindage) ; broche 2 : point chaud ; broche 3 : point froid. La tension de la bobine est la différence entre 2 et 3.' });
    const ins = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.14, 32), mat('plastique', 0x15181b)); ins.rotation.z = Math.PI / 2; gX.add(ins);
    const PINS = [{ n: 1, y: 0.06, z: -0.06, col: 0xb8bec4 }, { n: 2, y: 0.06, z: 0.06, col: COUL.rouge }, { n: 3, y: -0.07, z: 0, col: COUL.cyan }];
    const pinPos = {};
    for (const p of PINS) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.16, 12), mat('alu', 0xd8c890, { metalness: 1, roughness: 0.25 }));
      m.rotation.z = Math.PI / 2; m.position.set(0.14, p.y, p.z); m.userData.info = { nom: `Broche ${p.n}`, texte: p.n === 1 ? 'La masse : le corps du micro et le blindage du câble.' : p.n === 2 ? 'Le point chaud : un fil de la bobine.' : 'Le point froid : l\'autre fil de la bobine.' };
      gX.add(m); pinPos[p.n] = new THREE.Vector3(0.22, p.y, p.z);
      const t = texte(String(p.n), { h: 0.07, bg: 'rgba(18,22,26,.8)' }); t.position.set(0.24, p.y + (p.n === 3 ? -0.07 : 0.06), p.z * 1.9); t.rotation.y = Math.PI / 2; gX.add(t);
    }
    // les deux fils, de la bobine aux broches 2 et 3 (redessinés quand l'éclaté change)
    const fils = new THREE.Group(); fils.name = 'fils'; fils.userData.info = { nom: 'Les deux fils de la bobine', texte: 'Ils portent la tension induite jusqu\'aux broches 2 (point chaud) et 3 (point froid).' }; root.add(fils);
    const filM = [mat('plastique', COUL.rouge, { roughness: 0.5 }), mat('plastique', COUL.cyan, { roughness: 0.5 })];
    function drawFils() {
      for (const c of [...fils.children]) { fils.remove(c); /** @type {any} */ (c).geometry.dispose(); }
      const a = gBo.position.x + 0.08, b = gX.position.x + 0.0;
      [[2, 0.05], [3, -0.05]].forEach(([n, dz], k) => {
        const P = pinPos[n].clone().add(new THREE.Vector3(b - 0.2, AY, 0));
        const c = courbe([[a, AY + 0.12 * (k ? -1 : 1), dz], [a + 0.5, AY + 0.04, dz + 0.04], [(a + b) / 2, AY - 0.06, 0.08], [b - 0.3, AY + (k ? -0.04 : 0.04), 0.06], [P.x, P.y, P.z]]);
        fils.add(tube(c, 0.012, filM[k], 48, 6));
      });
    }
    for (const p of parts) p.g.position.y = AY;
    // ---------------- la source, ses fronts, la courbe polaire ----------------
    const src = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 16), lum(COUL.cyan, 0.8)); src.userData.info = { nom: 'La source', texte: 'Une voix, un instrument : elle envoie des fronts de pression vers le micro. Réglez son niveau, sa distance, son angle et sa fréquence dans « À vous ».' };
    root.add(src);
    const srcTag = ctx.label(src, 'source', { off: [0, 0.3, 0], cls: 'small' });
    const RINGS = 7, rings = [];
    for (let i = 0; i < RINGS; i++) { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 64), eclat(0x7fd3f3, 0.6)); m.rotation.x = Math.PI / 2; m.userData.passe = true; m.visible = false; root.add(m); rings.push(m); }
    const polarM = new THREE.MeshBasicMaterial({ color: 0xffd38a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    const polar = new THREE.Group(); polar.name = 'courbe cardioïde'; root.add(polar);
    {
      const shp = new THREE.Shape(), pts = [];
      for (let i = 0; i <= 96; i++) { const t = i / 96 * 360, a = Math.abs(CARD.A + CARD.B * Math.cos(t * Math.PI / 180)) * 2.4, d = DIR(t); pts.push(new THREE.Vector2(d.x * a, d.z * a)); }
      shp.setFromPoints(pts);
      const fill = new THREE.Mesh(new THREE.ShapeGeometry(shp, 64), polarM); fill.rotation.x = Math.PI / 2; fill.userData.passe = true; polar.add(fill);
      const line = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(p.x, 0, p.y))), new THREE.LineBasicMaterial({ color: 0xffd38a }));
      polar.add(line);
      for (const [t, lab] of [[0, 'axe : 0 dB'], [90, '90° : −6 dB'], [180, '180° : rien']]) { const d = DIR(t); const L = ctx.label(new THREE.Vector3(HX + d.x * (t === 180 ? 0.7 : 2.6), AY - 0.02, d.z * 2.6), lab, { cls: 'small' }); polar.userData.tags = (polar.userData.tags || []).concat(L); }
      polar.position.set(HX, AY - 0.02, 0);
      polar.userData.info = { nom: 'La courbe cardioïde', texte: 'La sensibilité selon l\'angle : 0,5 + 0,5 × cos θ. −6 dB sur le côté, presque rien à l\'arrière.' };
    }
    // ---------------- l'oscilloscope ----------------
    const osc = ecran(1.9, 1.05, 560, () => {}); osc.mesh.position.set(1.4, 3.05, -0.5); root.add(osc.mesh);
    const oscFrame = piece('oscilloscope', 'plastique', (b) => { b.cbox(2.05, 1.2, 0.12, 0, 0, -0.07, 0x23282e, 0.03); b.cbox(0.06, 1.0, 0.06, 0, -1.1, -0.07, 0x23282e, 0.02); });
    oscFrame.position.set(1.4, 3.05, -0.5); root.add(oscFrame);
    osc.mesh.userData.info = oscFrame.userData.info = { nom: 'Oscilloscope sur les broches 2 et 3', texte: 'La tension que donne la bobine : quelques millivolts pour une voix proche. Le calibre (mV par carreau) s\'adapte.' };
    const tOsc = texte('broches 2 – 3', { h: 0.09 }); tOsc.position.set(1.4, 3.75, -0.44); root.add(tOsc);
    // ---------------- les calculs ----------------
    const calc = () => {
      const M = MICROS[S.mic], Lm = aDistance(S.L1, 1, S.r), rep = reponse(CARD, S.th, S.f, S.r), Le = Lm + rep;
      return { M, Lm, rep, Le, mv: sortieMv(M.sens, Le), dbv: sortieDbv(M.sens, Le), dbu: sortieDbu(M.sens, Le), gain: gainPour(M.sens, Le) };
    };
    function drawOsc(K) {
      const g = osc.g, W = osc.W, H = osc.H;
      g.fillStyle = '#071012'; g.fillRect(0, 0, W, H);
      // sans son, la bobine ne bouge pas : la trace est plate (le calibre reste celui du son attendu)
      const pk0 = K.mv * Math.SQRT2, pk = S.ondes ? pk0 : 0, cal = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50].find((c) => pk0 <= c * 3.6) || 50;
      const X0 = 20, Wd = W - 40, Y0 = H / 2 + 2, hd = (H - 84) / 8;
      g.strokeStyle = '#183036'; g.lineWidth = 1;
      for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(X0 + i * Wd / 10, Y0 - 4 * hd); g.lineTo(X0 + i * Wd / 10, Y0 + 4 * hd); g.stroke(); }
      for (let j = -4; j <= 4; j++) { g.beginPath(); g.moveTo(X0, Y0 + j * hd); g.lineTo(X0 + Wd, Y0 + j * hd); g.stroke(); }
      g.strokeStyle = '#ffd38a'; g.lineWidth = 3; g.beginPath();
      for (let i = 0; i <= Wd; i++) { const y = Y0 - Math.sin(2 * Math.PI * 3 * i / Wd + S.ph) * pk / cal * hd; if (i) g.lineTo(X0 + i, y); else g.moveTo(X0, y); }
      g.stroke();
      g.fillStyle = '#9fe0b4'; g.font = '600 26px "B612 Mono", monospace';
      g.fillText(S.ondes ? `${fmtNum(K.mv, K.mv < 1 ? 3 : 2)} mV eff.` : 'silence : 0 mV', 20, 32);
      g.fillStyle = '#aab4ba'; g.font = '20px "Archivo Narrow", sans-serif';
      g.fillText(`${fmtNum(cal, cal < 1 ? 2 : 0)} mV par carreau · ${hz(S.f)} · ${S.mic === 'sm58' ? 'type SM58' : 'type SM48'}`, 20, H - 10);
      osc.mesh.material.map.needsUpdate = true;
    }
    function lire() {
      const K = calc();
      ctx.read('Au micro', `${fmtNum(K.Lm, 1)} dB SPL (${fmtNum(paDeSpl(K.Lm), paDeSpl(K.Lm) < 1 ? 3 : 2)} Pa) : ${S.L1} dB SPL à 1 m, source à ${metres(S.r)}`);
      ctx.read('Directivité et proximité', `angle ${fmtNum(S.th, 0)}° : ${attenuation(CARD, S.th) < -60 ? '−∞' : signe(attenuation(CARD, S.th))} dB · proximité à ${hz(S.f)} : ${signe(proximite(CARD, S.f, S.r))} dB · ensemble ${K.rep < -60 ? '−∞' : signe(K.rep)} dB`);
      ctx.read('Tension aux broches 2 et 3', `${fmtNum(K.mv, K.mv < 1 ? 3 : 2)} mV = ${fmtNum(K.dbv, 1).replace('-', '−')} dBV = ${fmtNum(K.dbu, 1).replace('-', '−')} dBu (${K.M.sens.toString().replace('.', ',').replace('-', '−')} dBV/Pa)`);
      ctx.read('Gain pour 0 dBu', `${fmtNum(K.gain, 1)} dB au préampli (0 dBu = −18 dBFS)`);
      return K;
    }
    let K = lire(), tRead = 0, ui = null;
    const inputs = {};
    const setUi = (k, v) => { const i = inputs[k]; if (i) { i.value = String(v); i.dispatchEvent(new Event('input')); } };
    /** la source tourne autour de la tête (la grille, qui recule quand le micro est éclaté) */
    function placeSource() {
      const d = DIR(S.th), R = RV(S.r);
      src.position.set(gGr.position.x, AY, 0).addScaledVector(d, R);
    }
    function applyExplode() {
      for (const p of parts) p.g.position.x = p.base + p.off * S.ex;
      drawFils(); placeSource();
    }
    applyExplode(); placeSource(); drawOsc(K);
    return {
      etape(i, E) {
        const R = E.reglage || {};
        S.exT = R.ex ?? 0; S.ondes = !!R.ondes; S.polaire = !!R.polaire; S.tourne = !!R.tourne;
        S.th = R.th ?? 0; S.r = R.r ?? 0.05; S.f = R.f ?? 1000; S.L1 = R.L1 ?? 70;
        polar.visible = S.polaire; for (const L of polar.userData.tags || []) L.show(S.polaire);
        for (const m of rings) m.visible = false;
        setUi('r', logu(S.r, 0.02, 2)); setUi('f', logu(S.f, 50, 5000)); setUi('th', S.th); setUi('L1', S.L1);
        // les curseurs arrondissent : on remet les valeurs exactes de l'étape (et la rotation, que le curseur d'angle arrête)
        S.th = R.th ?? 0; S.r = R.r ?? 0.05; S.f = R.f ?? 1000; S.tourne = !!R.tourne;
        placeSource(); K = lire(); drawOsc(K);
      },
      update(dt) {
        S.t += dt;
        // l'éclaté glisse vers sa cible
        if (Math.abs(S.ex - S.exT) > 1e-3) { S.ex += clamp(S.exT - S.ex, -dt * 1.2, dt * 1.2); applyExplode(); }
        if (S.tourne) { S.th = (S.th + dt * 24) % 360; placeSource(); }
        K = calc();
        // la membrane et la bobine : un mouvement exagéré, qui suit le niveau reçu (et le sens de la pression)
        const vis = S.ondes ? 0.004 + 0.05 * clamp((K.Le - 40) / 70, 0, 1) : 0;
        const fv = 1.2; // fréquence visible (ralentie)
        S.ph = S.t * 2 * Math.PI * fv;
        const sgn = (CARD.A + CARD.B * Math.cos(S.th * Math.PI / 180)) >= 0 ? 1 : -1;
        const dx = Math.sin(S.ph) * vis * sgn;
        gMe.position.x = parts[2].base + parts[2].off * S.ex + dx; gBo.position.x = parts[3].base + parts[3].off * S.ex + dx;
        // les fronts : des cercles qui partent de la source vers le micro
        const Rmax = RV(S.r) + 0.8;
        rings.forEach((m, k) => {
          if (!S.ondes) { m.visible = false; return; }
          const u = ((S.t * fv + k / RINGS) % 1), rad = 0.18 + u * Rmax;
          m.visible = true; m.position.set(src.position.x, AY - 0.15, src.position.z); m.scale.set(rad, rad, 1);
          /** @type {any} */ (m.material).opacity = 0.65 * (1 - u);
        });
        tRead += dt;
        if (tRead > 0.12) { tRead = 0; drawOsc(K); if (S.tourne) lire(); }
        srcTag.set(`source · ${fmtNum(S.th, 0)}°`);
      },
      commandes() {
        const sl = (key, label, min, max, val, step, on, fmt) => { const s = slider(label, min, max, val, step, on, fmt); inputs[key] = s.querySelector('input'); return s; };
        ui = el('div', { class: 'v3-ctl' },
          choice('Micro', [['sm58', 'type SM58'], ['sm48', 'type SM48']], S.mic, (v) => { S.mic = v; K = lire(); drawOsc(K); ctx.say(v === 'sm58' ? 'Type SM58 : −54,5 dBV/Pa.' : 'Type SM48 : −57,5 dBV/Pa, 3 dB de moins pour le même son.'); }),
          sl('L1', 'Niveau de la source à 1 m', 50, 110, S.L1, 1, (v) => { S.L1 = v; K = lire(); }, (v) => v + ' dB SPL'),
          sl('r', 'Distance', 0, 100, logu(S.r, 0.02, 2), 1, (v) => { S.r = logv(v, 0.02, 2); placeSource(); K = lire(); }, (v) => metres(logv(v, 0.02, 2))),
          sl('th', 'Angle de la source', 0, 180, S.th, 5, (v) => { S.th = v; S.tourne = false; placeSource(); K = lire(); }, (v) => v + '°'),
          sl('f', 'Fréquence', 0, 100, logu(S.f, 50, 5000), 1, (v) => { S.f = logv(v, 50, 5000); K = lire(); }, (v) => hz(logv(v, 50, 5000))),
          el('div', { class: 'v3-row' },
            el('button', { type: 'button', class: 'btn small', onclick: () => { S.exT = S.exT > 0.5 ? 0 : 1; ctx.say(S.exT ? 'Les pièces s\'écartent.' : 'Le micro se referme.'); } }, 'Éclater / refermer'),
            el('button', { type: 'button', class: 'btn small', onclick: () => { S.ondes = !S.ondes; ctx.say(S.ondes ? 'La source joue.' : 'La source se tait.'); } }, 'Son'),
            el('button', { type: 'button', class: 'btn small', onclick: () => { S.tourne = !S.tourne; S.polaire = S.polaire || S.tourne; polar.visible = S.polaire; for (const L of polar.userData.tags || []) L.show(S.polaire); ctx.say(S.tourne ? 'La source fait le tour du micro : regardez la tension.' : 'La source s\'arrête.'); } }, 'Faire tourner la source')));
        return ui;
      },
    };
  },
};
