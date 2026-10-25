// @ts-check
import * as THREE from 'three';
import { Builder } from './geo.js';
import { matiere } from './matiere.js';
import { makeCanvas } from './util.js';
import { fillFit } from './textfit.js';
import { TEAMS } from './data/match.js';

// ----------------------------------------------------------------------------------
// Le bord terrain côté tribune principale : les deux abris de touche (coque, toit en plexiglas,
// douze sièges baquets, dossier aux couleurs du club), la zone technique, la table du 4e arbitre
// (panneau électronique des changements, écran), le tunnel télescopique à la sortie des joueurs,
// les tabourets des photographes derrière les buts. La géométrie est ici ; les personnes qui
// occupent ces places (entraîneurs, remplaçants, staff…) sont dans staff.js.
// Repère : le terrain est en |z| < 34, la ligne de touche côté Lepagnot en z = −34, les panneaux
// LED en z = −38, le pied de la tribune en z = −41.
// ----------------------------------------------------------------------------------

/** abris de touche : centre (x), sièges (z, hauteur, pas), zone technique ; équipe 0 à gauche (x < 0) */
export const BANCS = [-1, 1].map((s, team) => ({
  team, x: s * 10, zBack: -39.55, zFront: -37.75, len: 8,
  seats: Array.from({ length: 12 }, (_, i) => ({ x: s * 10 - 3.41 + i * 0.62, z: -38.75, y: 0.46 })),
  zone: { x: s * 10, z: -36.4 }, // zone technique (devant l'abri)
}));
/** table du 4e arbitre, entre le tunnel et l'abri des visiteurs */
export const TABLE4 = { x: 4.1, z: -37.4 };
/** tunnel télescopique (sortie des joueurs) */
export const TUNNEL_TELESCOPIQUE = { x: 0, z0: -41, z1: -37.4, r: 1.9 };
/** photographes derrière les buts : tabouret (siège) ou à genou */
export const PHOTOGRAPHES = [];
for (const sx of [-1, 1]) for (const z of [-21, -15.5, -10, 10, 15.5, 21]) PHOTOGRAPHES.push({ x: sx * 56.2, z, h: sx > 0 ? -Math.PI / 2 : Math.PI / 2, assis: Math.abs(z) > 12 });

function dossierTex(team) {
  const T = TEAMS[team];
  const c = makeCanvas(1024, 160); const g = c.getContext('2d');
  g.fillStyle = '#15181c'; g.fillRect(0, 0, 1024, 160);
  g.fillStyle = '#' + T.shirt.toString(16).padStart(6, '0'); g.fillRect(0, 0, 1024, 12); g.fillRect(0, 148, 1024, 12);
  g.fillStyle = '#f2f4f6'; g.textAlign = 'center'; g.textBaseline = 'middle';
  fillFit(g, T.name, 512, 82, 900, 96);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function panneau4Tex() {
  const c = makeCanvas(256, 128); const g = c.getContext('2d');
  g.fillStyle = '#0b0c0e'; g.fillRect(0, 0, 256, 128);
  g.font = '700 54px "B612 Mono", "JetBrains Mono", monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#ff3b2a'; g.fillText('14', 74, 64); g.fillStyle = '#30ff60'; g.fillText('9', 182, 64);
  g.fillStyle = '#5a6068'; g.fillRect(126, 20, 4, 88);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

/** @param {THREE.Scene} scene */
export function buildBordTerrain(scene) {
  const occ = [];
  const mk = () => new Builder({ ao: 0.3, occluders: occ, aoOpts: { dist: 0.9, strength: 0.9, floor: 0.35 } });
  const Bs = mk(); // acier laqué : ossature des abris, pieds, table
  const Bp = mk(); // plastique : sièges, coques, panneaux
  const Bf = mk(); // sol des abris (résine)
  const Bt = mk(); // toile du tunnel télescopique
  const glass = new Builder();

  // ---------- les abris de touche ----------
  for (const b of BANCS) {
    const T = TEAMS[b.team], x0 = b.x - b.len / 2, x1 = b.x + b.len / 2, zb = b.zBack, zf = b.zFront;
    const d = zf - zb, zc = (zb + zf) / 2;
    Bf.box(b.len, 0.08, d, b.x, 0.04, zc, 0x2b3038); // dalle
    // ossature : poteaux arrière, montants avant légers, poutre de rive
    for (const x of [x0 + 0.05, b.x, x1 - 0.05]) { Bs.cbox(0.08, 2.25, 0.08, x, 1.125, zb + 0.06, 0x2a2f35, 0.01); Bs.cbox(0.06, 1.95, 0.06, x, 0.975, zf - 0.05, 0x2a2f35, 0.008); }
    Bs.cbox(b.len, 0.08, 0.08, b.x, 2.27, zb + 0.06, 0x2a2f35, 0.01); Bs.cbox(b.len, 0.07, 0.07, b.x, 1.96, zf - 0.05, 0x2a2f35, 0.01);
    for (const x of [x0 + 0.05, b.x, x1 - 0.05]) Bs.rod([x, 2.27, zb + 0.06], [x, 1.96, zf - 0.05], 0.03, 0x2a2f35, 6);
    // dossier plein (aux couleurs du club) et soubassement
    Bp.cbox(b.len, 1.0, 0.06, b.x, 0.62, zb + 0.12, 0x15181c, 0.02);
    // douze sièges baquets : assise, dossier enveloppant, accoudoirs, sur un rail
    Bs.box(b.len - 0.3, 0.06, 0.08, b.x, 0.3, -38.8, 0x6d737a);
    for (const s of b.seats) {
      Bp.cbox(0.5, 0.07, 0.46, s.x, s.y - 0.035, s.z, T.shirt === 0xf2f4f6 ? 0x1d3a8a : 0xc8102e, 0.03);
      Bp.cbox(0.5, 0.62, 0.08, s.x, s.y + 0.32, s.z - 0.24, T.shirt === 0xf2f4f6 ? 0x1d3a8a : 0xc8102e, 0.035, 0, -0.12);
      Bp.cbox(0.5, 0.18, 0.07, s.x, s.y + 0.72, s.z - 0.28, 0x15181c, 0.03, 0, -0.12); // appui-tête
      for (const sx of [-0.25, 0.25]) Bp.cbox(0.05, 0.05, 0.36, s.x + sx, s.y + 0.2, s.z - 0.02, 0x2a2f35, 0.015);
      Bs.box(0.06, s.y - 0.3, 0.06, s.x, (s.y + 0.3) / 2, s.z, 0x6d737a);
    }
    // toit et joues en plexiglas (coque transparente légèrement teintée)
    {
      const n = 8, pts = [];
      for (let k = 0; k <= n; k++) { const t = k / n, a = t * Math.PI * 0.42; pts.push([zb + 0.06 + Math.sin(a) * d * 1.02, 2.3 - (1 - Math.cos(a)) * 0.43]); }
      for (let k = 0; k < n; k++) {
        const [za, ya] = pts[k], [zb2, yb] = pts[k + 1];
        const len = Math.hypot(zb2 - za, yb - ya), ang = Math.atan2(yb - ya, zb2 - za);
        glass.box(b.len, 0.012, len, b.x, (ya + yb) / 2, (za + zb2) / 2, 0xffffff, 0, -ang);
      }
      for (const x of [x0, x1]) {
        const shape = new THREE.Shape(); shape.moveTo(zb, 0.1);
        for (const [z, y] of pts) shape.lineTo(z, y);
        shape.lineTo(zf, 0.1); shape.lineTo(zb, 0.1);
        const g = new THREE.ShapeGeometry(shape); g.rotateY(-Math.PI / 2); g.translate(x, 0, 0);
        glass.add(g, null, 0xffffff);
      }
    }
    // dossier : nom du club, face au terrain
    const dm = new THREE.Mesh(new THREE.PlaneGeometry(b.len - 0.3, 0.42), matiere('plastique', { map: dossierTex(b.team), vertexColors: false, roughness: 0.5, strength: 0.2, name: 'bancs-dossier' }));
    dm.position.set(b.x, 1.62, zb + 0.16); scene.add(dm);
    Bp.cbox(b.len - 0.2, 0.5, 0.04, b.x, 1.62, zb + 0.13, 0x15181c, 0.01);
    // glacière, sacs, bouteilles devant l'abri
    Bp.cbox(0.6, 0.4, 0.4, x1 - 0.6, 0.28, zf + 0.35, 0x2f7ff0, 0.04);
    for (let k = 0; k < 6; k++) Bp.cyl(0.035, 0.035, 0.24, x0 + 0.6 + k * 0.1, 0.2, zf + 0.25, k % 2 ? 0xe8e8e8 : 0x30a0ff, 8);
    Bp.cbox(0.7, 0.35, 0.35, x0 + 0.7, 0.26, zf + 0.4, 0x15181c, 0.06);
  }

  // ---------- la table du 4e arbitre : panneau des changements, écran, chronomètre ----------
  {
    const { x, z } = TABLE4;
    Bs.cbox(2.0, 0.05, 0.75, x, 0.76, z, 0xd9dcdf, 0.015);
    Bs.cbox(1.96, 0.7, 0.04, x, 0.4, z + 0.35, 0x15181c, 0.01); // façade
    for (const dx of [-0.95, 0.95]) Bs.box(0.05, 0.74, 0.7, x + dx, 0.37, z, 0x9aa0a6);
    Bp.cbox(0.52, 0.32, 0.05, x - 0.4, 0.98, z - 0.22, 0x111214, 0.01, 0, -0.15); // écran (VAR)
    Bp.cbox(0.3, 0.05, 0.22, x - 0.4, 0.8, z - 0.18, 0x2a2f35, 0.01);
    // panneau électronique des changements, posé sur la table
    Bp.cbox(0.62, 0.34, 0.06, x + 0.55, 1.08, z - 0.1, 0x1b1e22, 0.02); Bp.cyl(0.02, 0.02, 0.28, x + 0.55, 0.82, z - 0.1, 0x9aa0a6, 8);
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.28), new THREE.MeshBasicMaterial({ map: panneau4Tex(), toneMapped: false }));
    pm.position.set(x + 0.55, 1.08, z - 0.065); scene.add(pm);
    Bp.cbox(0.2, 0.02, 0.28, x + 0.1, 0.79, z - 0.05, 0xf4f2ec, 0.004); // feuille de match
    // chaises
    for (const dx of [-0.5, 0.5]) { Bp.cbox(0.44, 0.05, 0.42, x + dx, 0.46, z - 0.7, 0x2a2f35, 0.02); Bp.cbox(0.44, 0.45, 0.05, x + dx, 0.7, z - 0.9, 0x2a2f35, 0.02); Bs.box(0.04, 0.44, 0.04, x + dx, 0.22, z - 0.7, 0x9aa0a6); }
  }

  // ---------- le tunnel télescopique : arceaux et toile sang et or ----------
  {
    const { x, z0, z1, r } = TUNNEL_TELESCOPIQUE;
    const segs = 4, L = (z1 - z0) / segs;
    for (let k = 0; k < segs; k++) {
      const zc = z0 + L * (k + 0.5), rr = r - k * 0.06;
      const g = new THREE.CylinderGeometry(rr, rr, L - 0.02, 20, 1, true, -Math.PI / 2, Math.PI);
      g.rotateX(-Math.PI / 2); g.scale(1, 1.4, 1); g.translate(x, 0, zc); // demi-cylindre du haut, axe le long de z
      Bt.add(g, null, k % 2 ? 0xc8102e : 0xb00e28);
      // arceau métallique en bout de segment
      const arc = new THREE.TorusGeometry(rr + 0.02, 0.03, 6, 20, Math.PI); arc.scale(1, 1.4, 1); arc.translate(x, 0, z0 + L * (k + 1));
      Bs.add(arc, null, 0xb8bec4);
      Bt.add(new THREE.BoxGeometry(0.05, 0.14, L - 0.04).translate(x - rr * 0.98, 0.42, zc), null, 0xf5c400);
      Bt.add(new THREE.BoxGeometry(0.05, 0.14, L - 0.04).translate(x + rr * 0.98, 0.42, zc), null, 0xf5c400);
    }
    // patins au sol
    for (const s of [-1, 1]) Bs.box(0.12, 0.06, z1 - z0, x + s * r, 0.03, (z0 + z1) / 2, 0x3a3f46);
  }

  // ---------- les tabourets des photographes ----------
  for (const p of PHOTOGRAPHES) if (p.assis) {
    Bp.cyl(0.17, 0.17, 0.04, p.x, 0.38, p.z, 0x15181c, 14);
    for (let k = 0; k < 3; k++) { const a = k * 2.094; Bs.rod([p.x, 0.37, p.z], [p.x + Math.cos(a) * 0.2, 0, p.z + Math.sin(a) * 0.2], 0.012, 0x9aa0a6, 5); }
  }

  const parts = [
    [Bs, matiere('laque', { seed: 71, scale: 0.4, roughness: 0.45, metalness: 0.5, name: 'bancs-acier' })],
    [Bp, matiere('plastique', { seed: 72, scale: 0.25, roughness: 0.45, name: 'bancs-plastique' })],
    [Bf, matiere('resine', { seed: 73, scale: 1, roughness: 0.5, name: 'bancs-sol' })],
    [Bt, matiere('tissu', { seed: 74, scale: 0.3, roughness: 0.85, strength: 0.5, side: THREE.DoubleSide, name: 'tunnel-toile' })],
  ];
  for (const [b, m] of parts) { if (!b.parts.length) continue; const mesh = b.mesh(m); mesh.name = m.name; mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh); }
  const gm = new THREE.Mesh(glass.build(), new THREE.MeshPhysicalMaterial({ color: 0xcfe0ee, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.2 }));
  gm.name = 'bancs-plexiglas'; gm.renderOrder = 2; scene.add(gm);
}
