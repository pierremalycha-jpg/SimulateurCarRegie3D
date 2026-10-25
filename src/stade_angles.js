// @ts-check
import * as THREE from 'three';
import { Builder } from './geo.js';
import { matiere } from './matiere.js';
import { makeCanvas } from './util.js';
import { fillFit, fillLines } from './textfit.js';
import { STANDS, BOWL, profileY, W } from './world.js';

// ----------------------------------------------------------------------------------
// Les angles du stade et les joues des tribunes. À Bollaert-Delelis, les quatre angles sont
// ouverts (les pylônes et les écrans géants y sont posés) ; jusqu'ici, rien ne les fermait côté
// ville et les bouts des tribunes étaient de grands pans lisses : l'angle se lisait comme un trou.
// Ici : un mur d'enceinte relie le dos des deux tribunes de chaque angle, avec un portail d'accès
// ouvert (numéroté), une buvette, et les joues des tribunes reçoivent des pilastres de béton, un
// bandeau de couronnement et une signalétique de secteur.
// ----------------------------------------------------------------------------------

const CORNERS = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
const NOMS = ['PORTE 1 · TRANNIN-LEPAGNOT', 'PORTE 2 · LEPAGNOT-DELACOURT', 'PORTE 3 · DELACOURT-MAREK', 'PORTE 4 · MAREK-TRANNIN'];

function panneauTex(lines, bg, fg) {
  const c = makeCanvas(512, 160); const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 160); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(0, 0, 512, 6);
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  fillLines(g, lines, 256, 84, 470, 130, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function buvetteTex() {
  const c = makeCanvas(512, 96); const g = c.getContext('2d');
  g.fillStyle = '#c8102e'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#f5c400'; g.fillRect(0, 84, 512, 12);
  g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; fillFit(g, 'BUVETTE · FRITES · BOISSONS', 256, 44, 480, 54);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

/** extrémités du mur d'enceinte de l'angle ci (dos de la tribune longue → dos de la tribune courte) */
function cornerLine(ci) {
  const [sx, sz] = CORNERS[ci];
  const A = STANDS.find((s) => s.axis === 'z' && s.sgn === sz), Bst = STANDS.find((s) => s.axis === 'x' && s.sgn === sx);
  return [new THREE.Vector2(sx * (A.half - 0.3), sz * (BOWL.hz + A.back - 0.3)), new THREE.Vector2(sx * (BOWL.hx + Bst.back - 0.3), sz * (Bst.half - 0.3))];
}
/** vrai si (x, z) est à moins de d mètres d'un mur d'angle ou devant son portail (pour ne pas y planter d'arbre) */
export function nearCornerWall(x, z, d) {
  for (let ci = 0; ci < 4; ci++) {
    const [p0, p1] = cornerLine(ci), v = p1.clone().sub(p0), L2 = v.lengthSq();
    if (Math.hypot(x - (p0.x + p1.x) / 2, z - (p0.y + p1.y) / 2) < 10) return true;
    const t = Math.max(0, Math.min(1, ((x - p0.x) * v.x + (z - p0.y) * v.y) / L2));
    if (Math.hypot(x - (p0.x + v.x * t), z - (p0.y + v.y * t)) < d) return true;
  }
  return false;
}

/** @param {THREE.Scene} scene */
export function buildAngles(scene) {
  const occ = [];
  const Bc = new Builder({ ao: 0.6, occluders: occ, aoOpts: { dist: 2, strength: 0.9, floor: 0.35 } }); // béton (mur d'enceinte, pilastres)
  const Bm = new Builder({ ao: 0.4, occluders: occ }); // acier (grilles, portails)
  const Bk = new Builder({ ao: 0.4, occluders: occ }); // buvettes

  // ---------- joues des tribunes : pilastres tous les 5 m, couronnement, repère de secteur ----------
  for (const st of STANDS) {
    for (const s of [-1, 1]) {
      const u = s * st.half;
      for (let o = 3; o < st.back - 1; o += 5) {
        const h = profileY(st, o) - 0.2; if (h < 1) continue;
        const [x, , z] = st.axis === 'z' ? [u + s * 0.22, 0, st.sgn * (BOWL.hz + o)] : [st.sgn * (BOWL.hx + o), 0, u + s * 0.22];
        if (st.axis === 'z') Bc.box(0.44, h, 0.6, x, h / 2, z, 0xc4c8cc); else Bc.box(0.6, h, 0.44, x, h / 2, z, 0xc4c8cc);
      }
      // soubassement sombre (2,4 m) le long de la joue
      const L = st.back, oc = L / 2;
      const [x, , z] = st.axis === 'z' ? [u + s * 0.08, 0, st.sgn * (BOWL.hz + oc)] : [st.sgn * (BOWL.hx + oc), 0, u + s * 0.08];
      if (st.axis === 'z') Bc.box(0.16, 2.4, L - 1, x, 1.2, z, 0x5a5f66); else Bc.box(L - 1, 2.4, 0.16, x, 1.2, z, 0x5a5f66);
    }
  }

  // ---------- les quatre angles : mur d'enceinte, portail, buvette ----------
  const gateMat = matiere('laque', { seed: 91, scale: 0.4, roughness: 0.45, metalness: 0.6, name: 'angles-portail' });
  CORNERS.forEach(([sx, sz], ci) => {
    const [p0, p1] = cornerLine(ci);
    const d = p1.clone().sub(p0), len = d.length(), dir = d.clone().normalize(), ang = Math.atan2(dir.x, dir.y);
    const gate = 8, g0 = (len - gate) / 2, g1 = g0 + gate, H = 2.6;
    // mur : deux tronçons, chaperon, contreforts tous les 4 m, barreaudage d'acier au-dessus (jusqu'à 4 m)
    for (const [a, b] of [[0, g0], [g1, len]]) {
      const m = p0.clone().add(dir.clone().multiplyScalar((a + b) / 2));
      Bc.box(0.4, H, b - a, m.x, H / 2, m.y, 0xb9bec4, ang);
      Bc.box(0.6, 0.18, b - a, m.x, H + 0.09, m.y, 0x9aa0a6, ang);
      Bc.box(0.44, 0.35, b - a, m.x, 0.17, m.y, 0x6d7278, ang); // soubassement
      for (let t = a + 2; t < b - 1; t += 4) { const q = p0.clone().add(dir.clone().multiplyScalar(t)); Bc.box(0.7, H - 0.2, 0.5, q.x, (H - 0.2) / 2, q.y, 0xaeb3b8, ang); Bm.box(0.08, 1.4, 0.08, q.x, H + 0.88, q.y, 0x2b3038, ang); }
      Bm.box(0.06, 0.06, b - a, m.x, H + 0.3, m.y, 0x2b3038, ang); Bm.box(0.08, 0.08, b - a, m.x, H + 1.55, m.y, 0x2b3038, ang);
      for (let t = a + 0.15; t < b; t += 0.3) { const q = p0.clone().add(dir.clone().multiplyScalar(t)); Bm.box(0.03, 1.36, 0.03, q.x, H + 0.86, q.y, 0x2b3038, ang); }
      // collisions (le joueur passe par le portail)
      for (let t = a; t < b; t += 1) { const q = p0.clone().add(dir.clone().multiplyScalar(t + 0.5)); W.obstacles.push({ x0: q.x - 0.5, x1: q.x + 0.5, z0: q.y - 0.5, z1: q.y + 0.5 }); }
    }
    // portail : deux piles, linteau avec le nom de la porte, vantaux grillagés ouverts contre le mur
    const gc = p0.clone().add(dir.clone().multiplyScalar(len / 2));
    for (const t of [g0, g1]) { const q = p0.clone().add(dir.clone().multiplyScalar(t)); Bc.cbox(1.0, 4.6, 1.0, q.x, 2.3, q.y, 0x6d7278, 0.04, ang); }
    Bc.cbox(0.8, 0.9, gate + 1, gc.x, 4.6, gc.y, 0x2b3038, 0.03, ang);
    const nom = new THREE.Mesh(new THREE.PlaneGeometry(gate - 0.4, 0.72), matiere('plastique', { map: panneauTex([NOMS[ci]], '#13294b', '#ffffff'), vertexColors: false, roughness: 0.5, strength: 0.2, name: 'angles-porte' }));
    // face côté terrain (vers l'intérieur de l'angle) et face côté ville
    const nrm = new THREE.Vector2(-dir.y, dir.x); if (nrm.dot(new THREE.Vector2(-sx, -sz)) < 0) nrm.negate();
    for (const side of [1, -1]) {
      const pm = nom.clone(); pm.position.set(gc.x + nrm.x * side * 0.42, 4.6, gc.y + nrm.y * side * 0.42); pm.rotation.y = Math.atan2(nrm.x * side, nrm.y * side); scene.add(pm);
    }
    for (const t of [g0 + 0.5, g1 - 0.5]) {
      const q = p0.clone().add(dir.clone().multiplyScalar(t < len / 2 ? t - 1.9 : t + 1.9)).add(nrm.clone().multiplyScalar(-1.9));
      const leaf = new THREE.Group();
      const Bg = new Builder();
      Bg.box(3.6, 0.08, 0.06, 0, 2.6, 0, 0xffffff); Bg.box(3.6, 0.08, 0.06, 0, 0.15, 0, 0xffffff);
      for (let k = 0; k <= 18; k++) Bg.box(0.035, 2.45, 0.035, -1.8 + k * 0.2, 1.37, 0, 0xffffff);
      leaf.add(Bg.mesh(gateMat)); leaf.position.set(q.x, 0, q.y); leaf.rotation.y = Math.atan2(nrm.x, nrm.y) + Math.PI / 2; scene.add(leaf);
    }
    // buvette côté intérieur de l'angle, contre le mur
    const kb = p0.clone().add(dir.clone().multiplyScalar(len * 0.22)).add(nrm.clone().multiplyScalar(2.2));
    const ka = Math.atan2(dir.x, dir.y);
    Bk.cbox(4.2, 2.8, 2.4, kb.x, 1.4, kb.y, 0xe9ecef, 0.05, ka + Math.PI / 2);
    Bk.cbox(4.6, 0.12, 1.4, kb.x + nrm.x * 1.6, 2.7, kb.y + nrm.y * 1.6, 0xc8102e, 0.02, ka + Math.PI / 2, 0); // auvent
    Bk.cbox(3.6, 0.08, 0.5, kb.x + nrm.x * 1.3, 1.05, kb.y + nrm.y * 1.3, 0x9aa0a6, 0.02, ka + Math.PI / 2); // comptoir
    Bk.box(3.4, 1.2, 0.04, kb.x + nrm.x * 1.21, 1.9, kb.y + nrm.y * 1.21, 0x3a3f46, ka + Math.PI / 2); // rideau métallique (fermé à moitié)
    const bs = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 0.75), matiere('plastique', { map: buvetteTex(), vertexColors: false, roughness: 0.5, strength: 0.2, name: 'angles-buvette' }));
    bs.position.set(kb.x + nrm.x * 1.23, 2.95 + 0.2, kb.y + nrm.y * 1.23); bs.rotation.y = Math.atan2(nrm.x, nrm.y); scene.add(bs);
    W.obstacles.push({ x0: kb.x - 2.4, x1: kb.x + 2.4, z0: kb.y - 2.4, z1: kb.y + 2.4 });
  });

  const parts = [
    [Bc, matiere('beton', { seed: 92, scale: 1.3, strength: 0.6, roughness: 0.88, name: 'angles-beton' })],
    [Bm, matiere('laque', { seed: 93, scale: 0.4, roughness: 0.45, metalness: 0.5, name: 'angles-acier' })],
    [Bk, matiere('tole', { seed: 94, scale: 0.6, strength: 0.4, roughness: 0.55, name: 'angles-buvettes' })],
  ];
  for (const [b, m] of parts) { if (!b.parts.length) continue; const mesh = b.mesh(m); mesh.name = m.name; mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); }
}
