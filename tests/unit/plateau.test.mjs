// Le plateau 3D du Labo (v19.30) : les calculs qui le posent (isométrie et cadrage, lecture des positions
// des sujets et des projecteurs, exposition de l'image, tache de flou à l'écran, projecteur du rendu) et
// l'état des ateliers Optique et Photométrie qui y gagnent la place de la caméra et des sujets.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../../src/labo/plateau/calc.js';
import { INITIAL, MESURES, poser, etatPour } from '../../src/labo/etats.js';
import { tache, CAPTEURS } from '../../src/labo/calc/optique.js';
import { eclairage, eclairementPour, geometrieProjecteur, eclairageSujet, eclairageFond, H_CELLULE, FOND } from '../../src/labo/calc/photometrie.js';

const proche = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} : ${a} au lieu de ${b}`);
const norme = (v) => Math.hypot(...v);

test('isométrie : élévation arctan(1/√2), direction unitaire, base orthonormée, azimut de départ caméra devant', () => {
  proche(C.ELEV * 180 / Math.PI, 35.264, 0.01, 'élévation');
  for (const az of C.AZIMUTS) {
    const B = C.baseIso(az);
    proche(norme(B.dir), 1, 1e-9); proche(norme(B.droite), 1, 1e-9); proche(norme(B.haut), 1, 1e-9);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    proche(dot(B.dir, B.droite), 0, 1e-9); proche(dot(B.dir, B.haut), 0, 1e-9); proche(dot(B.droite, B.haut), 0, 1e-9);
    assert.equal(B.droite[1], 0, 'la droite de l\'écran est horizontale'); assert.ok(B.haut[1] > 0, 'le haut de l\'écran monte');
  }
  const d = C.directionIso(C.AZIMUTS[0]);
  assert.ok(d[0] < 0 && d[2] < 0 && d[1] > 0, 'l\'œil est devant (−z) et à gauche (−x), au-dessus');
});

test('cadrer : les points tiennent dans le cadre, la cible est au sol, la demi-hauteur suit le rapport', () => {
  const pts = [[0, 0, -4], [2, 1.8, 0], [-3, 0, 6]];
  for (const az of C.AZIMUTS) for (const aspect of [0.8, 1.6, 2.4]) {
    const { cible, demi } = C.cadrer(pts, az, aspect, 1.0);
    assert.equal(cible[1], 0);
    const B = C.baseIso(az);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    for (const p of pts) {
      const rel = [p[0] - cible[0], p[1] - cible[1], p[2] - cible[2]];
      assert.ok(Math.abs(dot(rel, B.haut)) <= demi + 1e-9, `az ${az} : hauteur`);
      assert.ok(Math.abs(dot(rel, B.droite)) <= demi * aspect + 1e-9, `az ${az} : largeur`);
    }
  }
  assert.equal(C.cadrer([], 45, 1).demi, 2.5, 'sans point : le minimum');
  assert.ok(C.cadrer(pts, 45, 1.6, 1.5).demi > C.cadrer(pts, 45, 1.6, 1.0).demi, 'la marge agrandit');
});

test('optique : un sujet se lit par sa distance le long de l\'axe et son écart latéral, aller et retour', () => {
  const cam = { x: 1.5, z: -2 };
  const p = C.mondeOptique(cam, 4, 0.75);
  proche(p.z, 2, 1e-9, 'quatre mètres devant'); proche(p.x, 0.75, 1e-9, 'à droite de l\'image : vers −x quand on regarde +z');
  const l = C.lectureOptique(cam, p.x, p.z); proche(l.d, 4, 1e-9); proche(l.lat, 0.75, 1e-9);
  assert.equal(C.borne(40, C.LIM.sujet), 29); assert.equal(C.borne(-9, C.LIM.lat), -7);
});

test('photométrie : un projecteur se lit en distance et angle autour du sujet, depuis la caméra, aller et retour', () => {
  const cam = { x: 0, z: -4 };
  const face = C.mondePhoto(cam, 3, 0);
  proche(face.x, 0, 1e-9); proche(face.z, -3, 1e-9, 'de face : entre le sujet et la caméra');
  const droite = C.mondePhoto(cam, 3, 90);
  proche(droite.z, 0, 1e-9); proche(droite.x, -3, 1e-9, 'à la droite d\'une caméra qui regarde +z : vers −x');
  for (const [d, phi] of [[2, -35], [4, 45], [1.5, 80], [6, -80]]) {
    const p = C.mondePhoto(cam, d, phi); const l = C.lecturePhoto(cam, p.x, p.z);
    proche(l.d, d, 1e-9, 'distance'); proche(l.phi, phi, 1e-9, 'angle');
  }
  // une caméra décalée : les angles se comptent depuis sa direction
  const cam2 = { x: 3, z: -3 };
  const p = C.mondePhoto(cam2, 2, 0); proche(Math.hypot(p.x, p.z), 2, 1e-9); proche(p.x / p.z, 3 / -3, 1e-9, 'sur la ligne sujet-caméra');
  proche(C.capVers({ x: 0, z: 0 }, { x: 0, z: 5 }), 0, 1e-9, 'cap vers +z'); proche(C.capVers({ x: 0, z: 0 }, { x: 2, z: 0 }), Math.PI / 2, 1e-9, 'cap vers +x');
});

test('la lumière du rendu : exposition π/Eref, plateau exposé de lui-même, tache en pixels, projecteur du rendu', () => {
  proche(C.expositionImage(250), Math.PI / 250, 1e-12);
  proche(C.expositionImage(eclairementPour(8, 800, 1 / 50)), Math.PI / 1000, 1e-12, 'f/8, 800 ISO, 1/50 s : 1 000 lx');
  proche(C.expositionPlateau(0), Math.PI / C.LUX_TRAVAIL, 1e-12, 'sans projecteur : la lumière de travail');
  assert.ok(C.expositionPlateau(5000) < C.expositionPlateau(0), 'un projecteur fort assombrit le reste');
  proche(C.tachePx(50, 2, 4, 2, CAPTEURS.s35.h, 270), tache(50, 2, 4, 2) / 14 * 270, 1e-9);
  proche(C.fovVertical(14, 35), 22.6, 0.1, '35 mm en Super 35');
  const r = eclairage({ source: 'fresnel', angle: 20, niveau: 1, d: 4 });
  const s = C.spotDepuis(r);
  proche(s.intensite, r.I0, 1e-9); proche(s.angle, 0.91 * 20 * Math.PI / 180, 1e-9); assert.ok(s.penombre > 0 && s.penombre < 1);
  assert.deepEqual(C.spotDepuis({ I0: 0, theta: 0 }).intensite, 0);
  assert.deepEqual(C.couleurLumiere([2, 1, 0.5]), [1, 0.5, 0.25]);
  const wb = C.balanceBlancs([1.2, 1, 0.8]); proche(wb[0], 1 / 1.2, 1e-9); assert.equal(wb[1], 1); proche(wb[2], 1 / 0.8, 1e-9);
});

test('l\'état des ateliers : la caméra et les sujets ont leur place, les défis posent leurs scènes comme avant', () => {
  const o = INITIAL.optique();
  assert.deepEqual(o.cam, { x: 0, z: 0 }); assert.deepEqual(Object.keys(o.lat), ['A', 'B', 'C']);
  const st = etatPour('optique', { capteur: 'ff', sujets: { A: 2, B: 3.5, C: 7 }, f: 35, N: 8, s: 7 });
  assert.deepEqual(st.sujets, { A: 2, B: 3.5, C: 7 }); assert.deepEqual(st.lat, o.lat, 'la scène ne touche pas aux écarts latéraux');
  poser(st, { 'cam.z': -1, 'lat.B': 3 });
  const m = MESURES.optique(st);
  assert.ok(m.sujets.A.dansChamp && !m.sujets.B.dansChamp, 'B, décalé de 3 m à 3,5 m du 35 mm plein format, sort du champ');
  const p = INITIAL.photometrie();
  assert.equal(p.cam.z, -4); assert.equal(p.cam.x, 0); assert.equal(p.cam.N, 4);
  const sp = etatPour('photometrie', { cam: { iso: 400, N: 2.8 } });
  assert.equal(sp.cam.z, -4, 'la scène d\'un défi garde la place de la caméra'); assert.equal(sp.cam.iso, 400);
});

test('photométrie sur le plateau : hauteur et incidence réelle, le fond derrière le sujet, les mesures complètes', () => {
  const p = { source: 'fresnel', angle: 30, niveau: 1, gel: 'aucune', d: 4, phi: -35, alpha: 0, on: true };
  const g0 = geometrieProjecteur({ ...p, h: H_CELLULE });
  proche(g0.d3, 4, 1e-9, 'à la hauteur de la cellule : la distance au sol'); proche(g0.incidence, 35, 1e-9, 'l\'incidence est l\'angle au sol');
  proche(eclairageSujet({ ...p, h: H_CELLULE }).E, eclairage({ ...p, incidence: 35 }).E, 1e-9, 'le même éclairement qu\'avant');
  const g1 = geometrieProjecteur({ ...p, phi: 0, h: H_CELLULE + 4 });
  proche(g1.d3, Math.SQRT2 * 4, 1e-9, 'quatre mètres plus haut : √2 fois plus loin'); proche(g1.incidence, 45, 1e-9, 'à 45°');
  assert.ok(eclairageSujet({ ...p, phi: 0, h: H_CELLULE + 4 }).E < eclairageSujet({ ...p, phi: 0, h: H_CELLULE }).E / 2, 'plus haut : moins de lumière (distance et cosinus)');
  const f = eclairageFond({ ...p, phi: 0, h: H_CELLULE }), s = eclairageSujet({ ...p, phi: 0, h: H_CELLULE });
  proche(f.distance, 4 + FOND, 1e-9, 'de face : le fond est à d + FOND'); proche(f.E / s.E, (4 / (4 + FOND)) ** 2, 1e-9, 'inverse du carré, dans l\'axe');
  assert.ok(eclairageFond({ ...p, phi: 60, h: H_CELLULE }).E < f.E, 'de côté, le fond reçoit moins');
  const st = etatPour('photometrie', {}); const m = MESURES.photometrie(st);
  for (const k of ['flux', 'omega', 'champ', 'watts', 'courant', 'irc', 'fond', 'd3', 'incidence']) assert.ok(k in m.r1, `r1.${k}`);
  proche(m.r1.watts, 1000, 1e-9); proche(m.r1.courant, 1000 / 230, 1e-9); proche(m.r1.champ, 30 * Math.sqrt(Math.log2(10)), 1e-9);
  assert.ok(m.fond > 0 && m.ecartFond > 0 && m.L18 > 0, 'fond, écart au fond, luminance du gris');
  proche(m.L18, 0.18 * m.E / Math.PI, 1e-9, 'L = ρE/π');
});

test('la visite des notions : des étapes complètes, qui regardent quelque part et lisent les mesures sans trou', async () => {
  const { ETAPES_PHOTO, ETAPES_OPTIQUE } = await import('../../src/labo/plateau/notions.js');
  const bad = (t) => !t || /undefined|NaN|\[object|null\b/.test(t);
  for (const [atelier, etapes, cles] of [['photometrie', ETAPES_PHOTO, ['flux', 'intensite', 'eclairement', 'inverse', 'cosinus', 'luminance', 'couleur', 'exposition', 'contraste']], ['optique', ETAPES_OPTIQUE, ['focale', 'iris', 'point', 'hyperfocale', 'capteur']]]) {
    assert.deepEqual(etapes.map((E) => E.id), cles, `${atelier} : les notions dans l'ordre`);
    for (const E of etapes) {
      assert.ok(E.titre && E.texte.length > 120 && E.lecon, `${E.id} : titre, texte, leçon`);
      const st = etatPour(atelier, {}); let m = MESURES[atelier](st);
      if (E.scene) { poser(st, typeof E.scene === 'function' ? E.scene(st, m) : E.scene); m = MESURES[atelier](st); }
      const v = E.vue(st, m);
      assert.ok(Array.isArray(v.cible) && v.cible.length === 3 && v.cible.every(Number.isFinite) && v.demi > 1 && v.demi < 40, `${E.id} : une vue`);
      if (E.lire) assert.ok(!bad(E.lire(st, m)), `${E.id} : lecture « ${E.lire(st, m)} »`);
    }
  }
});
