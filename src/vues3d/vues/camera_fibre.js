// @ts-check
import * as THREE from 'three';
import { el, clamp } from '../../util.js';
import { choice, slider, fmtNum } from '../../cours/kit.js';
import { OPTIQUE, bilanOptique } from '../../cours/camera_fibre.js';
import { COUL, mat, verre, eclat, ecran, texte, courbe, inverse } from '../kit.js';

// ----------------------------------------------------------------------------------
// Vue 3D « La fibre de la caméra » : à gauche, un câble hybride SMPTE agrandi environ 100 fois, ouvert sur sa
// longueur et dénudé au bout (renforts, deux fibres, deux conducteurs d'énergie, deux basse tension), où
// circulent la lumière et l'énergie ; à droite, une fibre agrandie environ 8 000 fois : la gaine optique, le
// cœur, la lumière qui y reste (monomode) ou rebondit (multimode, plusieurs chemins qui s'étalent) ; au bout,
// la face du connecteur vue au microscope d'inspection, avec sa poussière, et le niveau reçu à la CCU.
// Bilan : cours/camera_fibre.js.
// ----------------------------------------------------------------------------------
const CY = 1.0, CX0 = -6.2, CX1 = -2.4; // le câble : axe, début, fin de la gaine
const RJ = 0.46; // gaine ≈ Ø 9,2 mm
const FY = 1.2, FX0 = 0.6, FX1 = 5.4, RCL = 0.5; // la fibre agrandie : axe, début, fin, gaine optique (125 µm)
const RCORE = { mono: 0.036, multi: 0.2 }; // cœur : 9 µm ou 50 µm, à la même échelle

export const VUE_CAMERA_FIBRE = {
  id: 'camera-fibre', chapitre: 'camera', titre: 'La fibre de la caméra : câble hybride et lumière',
  resume: 'Le câble hybride SMPTE ouvert en deux, une fibre agrandie 8 000 fois où la lumière reste dans le cœur, la face du connecteur au microscope et le niveau reçu à la CCU.',
  lecons: ['camera-fibre', 'camera-systeme'],
  lectures: ['Fibre', 'Pertes', 'Niveau reçu à la CCU', 'État de la voie'],
  depart: 'À gauche le câble (× 100), à droite une seule fibre (× 8 000). La lumière réelle est infrarouge, invisible : on la montre en cyan.',
  vue: { cible: [-0.4, 1.2, 0], dir: [0, 0.32, 1], dist: 11 },
  orbite: { rMin: 0.6, rMax: 20 },
  etapes: [
    { t: 'Un câble, tout dedans', vue: { cible: [-3.2, 1.0, 0], dir: [-0.25, 0.35, 1], dist: 4.6 },
      texte: `Le câble hybride ST 311 (≈ 9 mm), ouvert sur sa longueur et dénudé au bout :
- au centre, **deux fibres monomodes** dans leur gaine serrée (bleue, blanche) : une par sens ;
- **deux conducteurs d'énergie** (rouge, noir) : la CCU alimente la tête ;
- **deux conducteurs basse tension** (vert, blanc) ;
- des **renforts** en fibres d'aramide (jaune), qui encaissent la traction quand on tire le câble ;
- la **gaine** extérieure.` },
    { t: 'Le cuivre porte l\'énergie, la fibre les signaux', vue: { cible: [-4.0, 1.0, 0], dir: [0, 0.14, 1], dist: 4.2 },
      texte: `Dans la coupe, l'**énergie** (orange) descend du car vers la tête par le cuivre ; la **lumière** (cyan) monte par une fibre et descend par l'autre.

Le cuivre a une résistance : plus le câble est long, plus la tension chute. Au-delà de l'ordre de **2 km** (selon la caméra et la CCU), la tête ne reçoit plus assez de puissance : c'est le cuivre qui limite la longueur, pas la lumière.` },
    { t: 'Une fibre de près : cœur et gaine', fibre: 'mono', vue: { cible: [2.6, 1.2, 0], dir: [0.1, 0.3, 1], dist: 5 },
      texte: `Une seule fibre, agrandie environ 8 000 fois. Le tube transparent est la **gaine optique** (125 µm de diamètre), en verre. Au centre, le **cœur** (9 µm), d'un verre à l'indice de réfraction un peu plus fort (≈ 1,468 contre 1,463).

Autour, un **revêtement** de 250 µm la protège, puis une **gaine serrée** de 900 µm (la couleur bleue ou blanche dans le câble). La fibre entière est à peine plus épaisse qu'un cheveu.` },
    { t: 'La réflexion totale', fibre: 'multi', vue: { cible: [2.6, 1.2, 0], dir: [0.1, 0.3, 1], dist: 5 },
      texte: `Ici, une fibre **multimode** (cœur de 50 µm) pour bien voir les rayons. Un rayon qui touche la frontière cœur-gaine sous un angle **rasant** y est **entièrement réfléchi** : il reste prisonnier du cœur, rebond après rebond, même si la fibre se courbe.

Mais les rayons n'ont pas tous la même pente : les plus inclinés font un chemin plus long et arrivent **après** les autres. Une impulsion **s'étale** : c'est la dispersion modale, qui limite la portée du multimode (≈ 3 dB/km et quelques centaines de mètres à haut débit).` },
    { t: 'Monomode : un seul chemin', fibre: 'mono', vue: { cible: [2.6, 1.2, 0], dir: [0.1, 0.3, 1], dist: 5 },
      texte: `Avec un cœur de **9 µm**, il ne reste qu'**un seul chemin** : la lumière file droit, les impulsions arrivent intactes, et l'on perd environ **0,35 dB par kilomètre** (à 1 310 nm). C'est la fibre des caméras de stade, des liaisons de transmission, des réseaux du car IP.

La lumière est **infrarouge** (1 310 nm), invisible : on ne regarde jamais dans un connecteur en service.` },
    { t: 'Une poussière sur la face', fibre: 'mono', salete: 'poussiere', vue: { cible: [5.9, 1.2, 0], dir: [-0.15, 0.2, 1], dist: 4 },
      texte: `Au bout, la **face du connecteur** telle que la montre un microscope d'inspection : le disque de la gaine (125 µm), le cœur au centre (9 µm). Une **poussière** de quelques microns s'y est posée : elle bloque une partie de la lumière et en renvoie vers la caméra.

Quelques dB perdus d'un coup : bien plus que des kilomètres de fibre. La règle : **inspecter, nettoyer, inspecter**, aux deux bouts, à chaque branchement, et remettre les bouchons. Passe la face en « propre » dans « À toi ».` },
    { t: 'Le niveau optique à la CCU', fibre: 'mono', salete: 'propre', vue: { cible: [3.8, 2.2, 0], dir: [0, 0.22, 1], dist: 7.6 },
      texte: `La CCU affiche le **niveau reçu** de chaque voie, en dBm : de l'ordre de **−5 à −15 dBm** en exploitation, décrochage vers **−20 dBm**. Le laser émet de l'ordre de −2 dBm ; chaque élément retire des décibels : la fibre (presque rien), chaque paire de connecteurs (≈ 0,4 dB), chaque raccord de touret, et surtout la saleté.

Allonge la fibre, ajoute des tourets, salis un connecteur : une voie très en dessous des autres trahit un connecteur sale, pas la longueur.` },
  ],
  build(ctx) {
    const root = ctx.root;
    const S = { fibre: 'mono', salete: 'propre', km: 0.4, tourets: 2 };
    // ---------------- le câble hybride, ouvert ----------------
    // la coupe : chaque élément est ouvert dans son propre axe (z > dz), entre x = −5,4 et x = −3
    const P2 = new THREE.Plane(new THREE.Vector3(-1, 0, 0), -5.4), P3 = new THREE.Plane(new THREE.Vector3(1, 0, 0), 3.0);
    const clip = (m, dz = 0) => { m.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 0, -1), dz), P2, P3]; m.clipIntersection = true; m.side = THREE.DoubleSide; return m; };
    const cyl = (r, x0, x1, y, z, m, info, name) => { const g = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, 32), m); g.rotation.z = -Math.PI / 2; g.position.set((x0 + x1) / 2, y, z); g.userData.info = info; g.name = name; root.add(g); return g; };
    cyl(RJ, CX0, CX1, CY, 0, clip(mat('plastique', 0x1f2429, { roughness: 0.6 })), { nom: 'Gaine extérieure', texte: 'Résistante à l\'écrasement et aux UV ; le câble fait de l\'ordre de 9 mm de diamètre.' }, 'gaine');
    cyl(RJ - 0.04, CX0, CX1 + 0.35, CY, 0, clip(mat('tissu', 0xd8b04a, { roughness: 0.9 })), { nom: 'Renforts (aramide)', texte: 'Des fibres d\'aramide (type Kevlar) qui encaissent la traction : on ne tire jamais une fibre par son connecteur.' }, 'aramide');
    const EL = [
      { k: 'f1', nom: 'Fibre monomode (vers le car)', r: 0.045, dy: 0.07, dz: -0.1, col: 0x3f7fe6, x1: -0.9, info: 'Gaine serrée de 900 µm autour de la fibre de 125 µm : l\'image, le son, les données de la tête montent vers la CCU.' },
      { k: 'f2', nom: 'Fibre monomode (vers la tête)', r: 0.045, dy: -0.07, dz: -0.1, col: 0xe6e6e0, x1: -1.0, info: 'Le retour programme, les ordres, le tally et les commandes du RCP descendent vers la tête.' },
      { k: 'p1', nom: 'Conducteur d\'énergie', r: 0.11, dy: 0.24, dz: 0, col: 0xd0302a, x1: -1.35, info: 'La CCU télé-alimente la tête : la chute de tension dans ce cuivre limite la longueur du câble (de l\'ordre de 2 km).' },
      { k: 'p2', nom: 'Conducteur d\'énergie', r: 0.11, dy: -0.24, dz: 0, col: 0x202224, x1: -1.4, info: 'Le retour de l\'alimentation.' },
      { k: 's1', nom: 'Conducteur basse tension', r: 0.06, dy: 0.34, dz: -0.11, col: 0x3fa060, x1: -1.65, info: 'Signalisation basse tension (selon le constructeur).' },
      { k: 's2', nom: 'Conducteur basse tension', r: 0.06, dy: -0.34, dz: -0.11, col: 0xf0f0ea, x1: -1.7, info: 'Signalisation basse tension (selon le constructeur).' },
    ];
    const paths = {};
    for (const e of EL) {
      cyl(e.r, CX0, e.x1, CY + e.dy, e.dz, clip(mat('plastique', e.col, { roughness: 0.45 }), e.dz), { nom: e.nom, texte: e.info }, e.k);
      if (e.k[0] === 'p' || e.k[0] === 's') cyl(e.r * 0.45, e.x1 - 0.02, e.x1 + 0.18, CY + e.dy, e.dz, mat('alu', COUL.cuivre, { metalness: 1, roughness: 0.3 }), { nom: 'Âme de cuivre', texte: e.info }, 'cuivre');
      else cyl(e.r * 0.5, e.x1 - 0.02, e.x1 + 0.12, CY + e.dy, e.dz, verre(0xbfe9f6, 0.6), { nom: 'Fibre nue (125 µm)', texte: 'Sans sa gaine serrée : un fil de verre plus fin qu\'un cheveu.' }, 'verre');
      paths[e.k] = courbe([[CX0, CY + e.dy, e.dz], [e.x1, CY + e.dy, e.dz]]);
    }
    const tc = texte('câble hybride ST 311 (× 100)', { h: 0.14 }); tc.position.set(-4.3, 1.75, 0); root.add(tc);
    for (const e of EL) ctx.label(new THREE.Vector3(e.x1 + 0.1, CY + e.dy, e.dz), e.k[0] === 'f' ? 'fibre' : e.k[0] === 'p' ? 'énergie' : 'basse tension', { off: [0.25, e.dy > 0 ? 0.12 : -0.12, 0], cls: 'small' });
    ctx.label(new THREE.Vector3(CX1 + 0.3, CY + RJ, 0), 'renforts', { off: [0, 0.12, 0], cls: 'small' });
    const fl = ctx.flux(160, new THREE.SphereGeometry(1, 10, 8), eclat(0xffffff));
    // ---------------- la fibre agrandie ----------------
    const clad = new THREE.Mesh(new THREE.CylinderGeometry(RCL, RCL, FX1 - FX0, 48, 1, true), verre(0xbfd8e8, 0.16, { side: THREE.DoubleSide, depthWrite: false }));
    clad.rotation.z = -Math.PI / 2; clad.position.set((FX0 + FX1) / 2, FY, 0); clad.userData.info = { nom: 'Gaine optique (125 µm)', texte: 'Du verre d\'indice un peu plus faible que le cœur (≈ 1,463) : la frontière réfléchit les rayons rasants.' }; root.add(clad);
    const coat = new THREE.Mesh(new THREE.CylinderGeometry(RCL * 1.6, RCL * 1.6, 0.6, 48, 1, true), mat('plastique', 0x3a6ab0, { side: THREE.DoubleSide, roughness: 0.4 }));
    coat.rotation.z = -Math.PI / 2; coat.position.set(FX0 + 0.3, FY, 0); coat.userData.info = { nom: 'Revêtement (250 µm) et gaine serrée (900 µm)', texte: 'Ils protègent la fibre ; on les retire pour la préparer, jamais la gaine optique.' }; root.add(coat);
    const coreM = eclat(0x8fd6ea, 0.42); coreM.depthWrite = false; clad.renderOrder = 1;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, FX1 - FX0, 32, 1, true), coreM); core.rotation.z = -Math.PI / 2; core.position.set((FX0 + FX1) / 2, FY, 0); core.userData.passe = true; core.renderOrder = 2; root.add(core);
    const coreTag = ctx.label(new THREE.Vector3(FX0 + 1.4, FY, 0), '', { off: [0, -0.7, 0], cls: 'small' });
    ctx.label(new THREE.Vector3(FX0 + 2.6, FY + RCL, 0), 'gaine optique · 125 µm', { off: [0, 0.18, 0], cls: 'small' });
    const tf = texte('une fibre (× 8 000)', { h: 0.14 }); tf.position.set((FX0 + FX1) / 2, FY + 1.05, 0); root.add(tf);
    // les rayons : un chemin droit (monomode), trois pentes (multimode)
    const rays = new THREE.Group(); root.add(rays);
    const zig = (slope) => {
      const pts = []; const r = RCORE.multi * 0.92; let x = FX0, y = 0, dir = 1;
      pts.push([x, FY, 0]);
      if (!slope) { pts.push([FX1, FY, 0]); return pts; }
      while (x < FX1) { const dx = (r * dir - y) / slope * dir; const nx = Math.min(FX1, x + Math.abs(dx)); y += (nx - x) * slope * dir; x = nx; pts.push([x, FY + y, 0]); dir = -dir; }
      return pts;
    };
    const rayCurves = { mono: [new THREE.LineCurve3(new THREE.Vector3(FX0, FY, 0), new THREE.Vector3(FX1, FY, 0))], multi: [0, 0.18, 0.36].map((sl) => { const p = zig(sl); return new THREE.CatmullRomCurve3(p.map((q) => new THREE.Vector3(q[0], q[1], q[2])), false, 'catmullrom', 0); }) };
    const rayLines = { mono: [], multi: [] };
    const rayM = eclat(0xbfefff, 0.7);
    for (const k of ['mono', 'multi']) for (const c of rayCurves[k]) { const l = new THREE.Mesh(new THREE.TubeGeometry(c, 240, 0.007, 6, false), rayM); l.userData.passe = true; l.renderOrder = 3; rays.add(l); rayLines[k].push(l); }
    // la face du connecteur, vue au microscope, et l'écran de la CCU
    const face = ecran(1.3, 1.3, 512, () => {}); face.mesh.position.set(6.25, FY, 0.2); face.mesh.rotation.y = -0.35; root.add(face.mesh);
    face.mesh.userData.info = { nom: 'Face du connecteur (microscope d\'inspection)', texte: 'Le disque de la gaine (125 µm) et le cœur (9 µm). Une poussière de quelques µm suffit à perdre plusieurs dB.' };
    const tface = texte('la face, au microscope', { h: 0.1 }); tface.position.set(6.25, FY + 0.82, 0.2); tface.rotation.y = -0.35; root.add(tface);
    const ccu = ecran(2.2, 0.8, 640, () => {}); ccu.mesh.position.set(3.4, 3.3, -0.8); root.add(ccu.mesh);
    ccu.mesh.userData.info = { nom: 'Le niveau optique, à la CCU', texte: 'De l\'ordre de −5 à −15 dBm en exploitation ; vers −20 dBm, la voie décroche.' };
    const dust = [[0.12, -0.05, 0.05], [-0.3, 0.2, 0.08], [0.02, 0.01, 0.035]];
    function drawFace() {
      const g = face.g, W = face.W, H = face.H, cx = W / 2, cy = H / 2;
      g.fillStyle = '#05080a'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#c9cfc6'; g.beginPath(); g.arc(cx, cy, W * 0.46, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#e8ebe4'; g.beginPath(); g.arc(cx, cy, W * 0.42 * (S.fibre === 'multi' ? 1 : 1), 0, Math.PI * 2); g.fill();
      const rc = W * 0.42 * (S.fibre === 'multi' ? 50 : 9) / 125;
      g.fillStyle = '#7fd3f3'; g.beginPath(); g.arc(cx, cy, rc, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(cx, cy, W * 0.42 * 25 / 125, 0, Math.PI * 2); g.stroke();
      if (S.salete !== 'propre') {
        g.fillStyle = 'rgba(40,30,20,.85)';
        for (const [x, y, r] of dust.slice(0, S.salete === 'sale' ? 3 : 1)) { g.beginPath(); g.ellipse(cx + x * W, cy + y * H, r * W, r * W * 0.7, 0.6, 0, Math.PI * 2); g.fill(); }
        if (S.salete === 'sale') { g.fillStyle = 'rgba(200,190,150,.35)'; g.beginPath(); g.ellipse(cx - 0.05 * W, cy + 0.03 * H, 0.25 * W, 0.12 * W, -0.4, 0, Math.PI * 2); g.fill(); }
      }
      g.fillStyle = '#e8ece6'; g.font = '600 26px "Archivo Narrow", sans-serif'; g.fillText(S.salete === 'propre' ? 'propre' : S.salete === 'poussiere' ? 'une poussière sur le cœur' : 'trace de doigt et poussières', 16, H - 18);
      g.fillStyle = '#aab4ba'; g.font = '20px "Archivo Narrow", sans-serif'; g.fillText(`cœur ${S.fibre === 'multi' ? 50 : 9} µm · gaine 125 µm`, 16, 30);
      face.mesh.material.map.needsUpdate = true;
    }
    function drawCcu(B) {
      const g = ccu.g, W = ccu.W, H = ccu.H;
      g.fillStyle = '#0b1a12'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#7bf29a'; g.font = '600 30px "B612 Mono", monospace'; g.fillText(`CAM 4  OPT. ${fmtNum(B.recu, 1)} dBm`, 20, 46);
      const X = (v) => 20 + clamp((v + 25) / 25, 0, 1) * (W - 40);
      g.fillStyle = '#1a2a22'; g.fillRect(20, 70, W - 40, 40);
      g.fillStyle = 'rgba(127,209,160,.35)'; g.fillRect(X(-15), 70, X(-5) - X(-15), 40);
      g.fillStyle = '#ff6a5a'; g.fillRect(X(OPTIQUE.sensib) - 2, 64, 4, 52);
      g.fillStyle = B.etat === 'bon' ? '#7fd1a0' : B.etat === 'limite' ? '#ffd38a' : '#ff6a5a'; g.fillRect(20, 78, Math.max(4, X(B.recu) - 20), 24);
      g.fillStyle = '#8a949c'; g.font = '18px "Archivo Narrow", sans-serif'; g.fillText('−25 dBm', 20, 136); g.fillText('0 dBm', W - 70, 136); g.fillText('exploitation', X(-12.5) - 40, 136); g.fillStyle = '#ff8a80'; g.fillText('décrochage', X(OPTIQUE.sensib) - 30, 160);
      g.fillStyle = B.etat === 'décroché' ? '#ff8a80' : '#7bf29a'; g.font = '600 24px "B612 Mono", monospace'; g.fillText(B.etat === 'décroché' ? 'OPTIQUE : PAS DE SIGNAL' : B.etat === 'limite' ? 'NIVEAU BAS' : 'OK', 20, 196);
      ccu.mesh.material.map.needsUpdate = true;
    }
    function maj() {
      const r = RCORE[S.fibre]; core.scale.set(r, 1, r);
      for (const l of rayLines.mono) l.visible = S.fibre === 'mono';
      for (const l of rayLines.multi) l.visible = S.fibre === 'multi';
      coreTag.set(S.fibre === 'mono' ? 'cœur · 9 µm (monomode)' : 'cœur · 50 µm (multimode)');
      const B = bilanOptique(S.km, 2 + S.tourets, S.salete, S.fibre);
      drawFace(); drawCcu(B);
      ctx.read('Fibre', S.fibre === 'mono' ? `monomode 9/125 µm · ${OPTIQUE.fibre.mono} dB/km` : `multimode 50/125 µm · ${OPTIQUE.fibre.multi} dB/km`);
      ctx.read('Pertes', `fibre ${fmtNum(B.fibre, 2)} dB · ${2 + S.tourets} paires de connecteurs ${fmtNum(B.conn, 1)} dB${B.sal ? ` · saleté ${B.sal} dB` : ''}`);
      ctx.read('Niveau reçu à la CCU', `${fmtNum(B.recu, 1)} dBm (émis ≈ ${OPTIQUE.emis} dBm)`);
      ctx.read('État de la voie', B.etat === 'bon' ? 'normal' : B.etat === 'limite' ? 'hors de la plage d\'exploitation' : 'décrochée');
    }
    let t1 = 0, t2 = 0, ui = null;
    maj();
    const syncUi = () => { if (!ui) return; for (const b of ui.querySelectorAll('[data-v]')) { const v = /** @type {HTMLElement} */ (b).dataset.v; if (['mono', 'multi'].includes(v)) b.setAttribute('aria-pressed', String(v === S.fibre)); else b.setAttribute('aria-pressed', String(v === S.salete)); } };
    return {
      etape(i, E) { if (E.fibre) S.fibre = E.fibre; if (E.salete) S.salete = E.salete; maj(); syncUi(); },
      update(dt) {
        t1 += dt; t2 += dt;
        // dans le câble : la lumière dans les fibres (les deux sens), l'énergie dans le cuivre
        if (t1 > 0.5) {
          t1 = 0;
          fl.add({ curve: paths.f1, speed: 1.6, color: 0x8fd6ea, scale: 0.035, info: { nom: 'La lumière vers le car', texte: 'L\'image, le son et les données de la tête, en infrarouge (≈ 1 310 nm).' } });
          fl.add({ curve: inverse(paths.f2), speed: 1.6, color: 0x8fd6ea, scale: 0.035, info: { nom: 'La lumière vers la tête', texte: 'Retour, ordres, tally, commandes du RCP.' } });
          fl.add({ curve: paths.p1, speed: 1.1, color: 0xff9a3a, scale: 0.075, info: { nom: 'L\'énergie vers la tête', texte: 'Envoyée par la CCU, en tension élevée pour limiter les pertes dans le cuivre.' } });
        }
        // dans la fibre agrandie : des impulsions sur chaque chemin, parties en même temps
        if (t2 > 1.4) {
          t2 = 0;
          for (const c of rayCurves[S.fibre]) fl.add({ curve: c, speed: 1.3, color: 0xbfefff, scale: 0.05, info: { nom: 'Une impulsion de lumière', texte: S.fibre === 'mono' ? 'Un seul chemin : elle arrive intacte.' : 'Chaque chemin a sa longueur : les impulsions parties ensemble arrivent étalées.' } });
        }
      },
      commandes() {
        ui = el('div', { class: 'v3-ctl' },
          choice('Fibre', [['mono', 'monomode 9 µm'], ['multi', 'multimode 50 µm']], S.fibre, (v) => { S.fibre = v; maj(); }),
          choice('Face du connecteur', [['propre', 'propre'], ['poussiere', 'une poussière'], ['sale', 'sale']], S.salete, (v) => { S.salete = v; maj(); ctx.say(v === 'propre' ? 'Face nettoyée et inspectée.' : 'La face est sale : regarde le niveau à la CCU.'); }),
          slider('Longueur', 0.1, 10, S.km, 0.1, (v) => { S.km = v; maj(); }, (v) => fmtNum(v, 1) + ' km'),
          slider('Raccords de tourets', 0, 6, S.tourets, 1, (v) => { S.tourets = v; maj(); }, (v) => String(v)));
        return ui;
      },
    };
  },
};
