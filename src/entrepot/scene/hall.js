// @ts-check
import * as THREE from 'three';
import { U, RAIL_X, RACK, TABLE, STAGE, WALL_Z, MUR, HALL, canvasTex, put, rng, FONT } from './kit.js';

// ----------------------------------------------------------------------------------
// Le hall de l'entrepôt, tout ce qui ne bouge pas : le sol en béton et ses marquages, les murs en
// bardage, la charpente et ses suspensions, les rayonnages du stock (cartons et flight cases,
// instanciés), la baie 19" mobile de 12 U (montants percés et numérotés, flancs, roulettes), la
// table de régie, le plateau (estrade, fond, pupitre de conférence) et le
// repère de chaque zone au sol. Construit une fois ; tout passe par le bac (libéré à la fin).
// ----------------------------------------------------------------------------------

const std = (bin, color, roughness = 0.8, metalness = 0, o = {}) => bin.add(new THREE.MeshStandardMaterial({ color, roughness, metalness, ...o }));
const geo = (bin, g) => bin.add(g);

/**
 * Un lot de boîtes identiques posées par instance (rayonnages, cartons, poutres) : une géométrie
 * unité, une matrice par instance (position, échelle, rotation autour de y), une couleur facultative.
 */
function boxes(bin, /** @type {THREE.Object3D} */ parent, /** @type {THREE.Material} */ mat, /** @type {Array<{ p: number[], s: number[], ry?: number, c?: string }>} */ list, shadows = false) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(geo(bin, new THREE.BoxGeometry(1, 1, 1)), mat, list.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), c = new THREE.Color();
  list.forEach((b, i) => {
    q.setFromEuler(e.set(0, b.ry || 0, 0));
    m.compose(new THREE.Vector3(b.p[0], b.p[1], b.p[2]), q, new THREE.Vector3(b.s[0], b.s[1], b.s[2]));
    im.setMatrixAt(i, m);
    if (b.c) im.setColorAt(i, c.set(b.c));
  });
  im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  im.castShadow = shadows; im.receiveShadow = true;
  parent.add(im);
  return im;
}

/** le béton du sol : un carreau de 3 m (grain, taches, joints sciés), répété */
function concrete(g, w, h) {
  g.fillStyle = '#5b5f63'; g.fillRect(0, 0, w, h);
  const r = rng(11);
  for (let i = 0; i < 2600; i++) { const v = 70 + r() * 50 | 0; g.fillStyle = `rgba(${v},${v + 3},${v + 6},${0.08 + r() * 0.12})`; g.fillRect(r() * w, r() * h, 1 + r() * 2.5, 1 + r() * 2.5); }
  for (let i = 0; i < 9; i++) { const x = r() * w, y = r() * h, rad = 20 + r() * 70; const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(40,42,45,${0.06 + r() * 0.08})`); gr.addColorStop(1, 'rgba(40,42,45,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  g.fillStyle = 'rgba(25,27,30,0.55)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h);
}
/** le bardage des murs : soubassement sombre (1,2 m), bac acier nervuré au-dessus ; le carreau fait 3 m × 6 m */
function cladding(g, w, h) {
  const band = h * (1.2 / 6);
  g.fillStyle = '#7f878f'; g.fillRect(0, 0, w, h - band);
  for (let x = 0; x < w; x += w / 15) { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(x, 0, 3, h - band); g.fillStyle = 'rgba(0,0,0,0.16)'; g.fillRect(x + 3, 0, 2, h - band); }
  g.fillStyle = '#3c4146'; g.fillRect(0, h - band, w, band);
  g.fillStyle = '#e8b400'; g.fillRect(0, h - band - 4, w, 4);
}
/** un flight case : contreplaqué noir, cornières aluminium, coins boule */
function flightCase(g, w, h) {
  g.fillStyle = '#17191c'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#a9b0b7'; g.lineWidth = 9; g.strokeRect(4, 4, w - 8, h - 8);
  g.fillStyle = '#c9ced3'; for (const [x, y] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) { g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#8d949b'; g.fillRect(w / 2 - 18, h / 2 - 6, 36, 12);
}
/** un montant de baie : trous carrés (trois par U), et le numéro de chaque U à côté */
function railTex(g, w, h, n) {
  g.fillStyle = '#9aa1a8'; g.fillRect(0, 0, w, h);
  const per = h / n;
  for (let u = 0; u < n; u++) {
    const y0 = h - (u + 1) * per;
    for (const f of [6.35, 22.225, 38.1]) { const y = y0 + per - (f / 44.45) * per; g.fillStyle = '#20242a'; g.fillRect(w * 0.55, y - per * 0.07, w * 0.3, per * 0.14); }
    g.fillStyle = '#1b1e22'; g.font = `600 ${Math.round(per * 0.34)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(u + 1), w * 0.26, y0 + per / 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, y0, w, 1);
  }
}
/** un texte peint au sol (pochoir jaune), sur fond transparent */
function floorText(bin, /** @type {THREE.Object3D} */ parent, text, x, z, w, rotY = 0) {
  const h = w * 0.18;
  const t = bin.add(canvasTex(512, 92, (g, cw, ch) => { g.clearRect(0, 0, cw, ch); g.fillStyle = '#e8b400'; g.font = `700 ${Math.round(ch * 0.7)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, cw / 2, ch / 2 + 2, cw - 10); }));
  const m = new THREE.Mesh(geo(bin, new THREE.PlaneGeometry(w, h)), std(bin, '#ffffff', 0.9, 0, { map: t, transparent: true, depthWrite: false }));
  m.rotation.set(-Math.PI / 2, 0, rotY); m.position.set(x, 0.004, z); m.receiveShadow = true; parent.add(m);
}

/**
 * Construit le hall dans la scène.
 * @param {THREE.Scene} scene @param {ReturnType<import('./kit.js').makeBin>} bin @param {string} quality
 * @returns {{ rack: THREE.Group, sun: THREE.DirectionalLight }}
 */
export function buildStatic(scene, bin, quality) {
  const low = quality === 'basse', high = quality === 'haute';
  scene.background = new THREE.Color(0x0d1014);
  scene.fog = new THREE.Fog(0x0d1014, 16, 34);

  // ---- la lumière : le ciel des lanterneaux, un soleil d'appoint (ombres), un fond ambiant ----
  scene.add(new THREE.HemisphereLight(0xe4ecf5, 0x3a3530, 1.0));
  scene.add(new THREE.AmbientLight(0xffffff, 0.12));
  const sun = new THREE.DirectionalLight(0xfff1dc, 1.7);
  sun.position.set(2.5, 8, 4.5); sun.target.position.set(0.6, 0, -1.6); scene.add(sun.target);
  sun.castShadow = !low;
  if (!low) {
    const sz = high ? 2048 : 1024; sun.shadow.mapSize.set(sz, sz);
    const c = sun.shadow.camera; c.left = -5; c.right = 5; c.top = 4.5; c.bottom = -4.5; c.near = 2; c.far = 18;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  }
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.35); fill.position.set(-4, 4, 6); scene.add(fill);

  // ---- le sol ----
  const W = HALL.x1 - HALL.x0, D = HALL.z1 - HALL.z0;
  const floorT = bin.add(canvasTex(low ? 256 : 512, low ? 256 : 512, concrete, { repeat: [W / 3, D / 3], aniso: 8 }));
  const floor = new THREE.Mesh(geo(bin, new THREE.PlaneGeometry(W, D)), std(bin, '#ffffff', 0.92, 0, { map: floorT }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((HALL.x0 + HALL.x1) / 2, 0, (HALL.z0 + HALL.z1) / 2); floor.receiveShadow = true; scene.add(floor);
  // les allées (lignes jaunes) le long des rayonnages
  const lane = std(bin, '#d9a900', 0.7);
  for (const x of [HALL.x0 + 1.55, HALL.x1 - 1.55]) { const l = new THREE.Mesh(geo(bin, new THREE.PlaneGeometry(0.08, D - 0.6)), lane); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.002, (HALL.z0 + HALL.z1) / 2 + 0.3); l.receiveShadow = true; scene.add(l); }

  // ---- les murs (fond, gauche, droite) ----
  const wallMat = (len) => std(bin, '#ffffff', 0.85, 0.05, { map: bin.add(canvasTex(512, 512, cladding, { repeat: [len / 3, 1] })) });
  const wall = (len, x, z, ry) => { const m = new THREE.Mesh(geo(bin, new THREE.PlaneGeometry(len, HALL.h)), wallMat(len)); m.position.set(x, HALL.h / 2, z); m.rotation.y = ry; m.receiveShadow = true; scene.add(m); };
  wall(W, (HALL.x0 + HALL.x1) / 2, WALL_Z, 0);
  wall(D, HALL.x0, (HALL.z0 + HALL.z1) / 2, Math.PI / 2);
  wall(D, HALL.x1, (HALL.z0 + HALL.z1) / 2, -Math.PI / 2);
  // la porte sectionnelle du quai, à droite, et le bloc de sortie de secours
  const doorT = bin.add(canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#b8bec4'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += h / 9) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y, w, 3); g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, y + 3, w, 2); } g.fillStyle = '#2b3036'; g.fillRect(w * 0.1, h * 0.25, w * 0.8, h * 0.07); }));
  const door = new THREE.Mesh(geo(bin, new THREE.PlaneGeometry(4, 4.4)), std(bin, '#ffffff', 0.6, 0.3, { map: doorT }));
  door.position.set(HALL.x1 - 0.02, 2.2, 3.6); door.rotation.y = -Math.PI / 2; scene.add(door);
  const exit = new THREE.Mesh(geo(bin, new THREE.BoxGeometry(0.34, 0.14, 0.04)), std(bin, '#1aa64b', 0.5, 0, { emissive: '#1aa64b', emissiveIntensity: 0.9 }));
  exit.position.set(HALL.x0 + 0.03, 2.55, 4.8); exit.rotation.y = Math.PI / 2; scene.add(exit);

  // ---- la charpente et les suspensions ----
  const steel = std(bin, '#3a4048', 0.6, 0.4);
  const beams = []; for (let z = HALL.z0 + 1.6; z < HALL.z1; z += 3.2) beams.push({ p: [0, HALL.h - 0.2, z], s: [W, 0.35, 0.18] });
  boxes(bin, scene, steel, beams);
  const lamps = []; for (const x of [-4.8, -1.6, 1.6, 4.8]) for (const z of [-3.4, 0.3, 3.8]) lamps.push([x, z]);
  const wire = new THREE.InstancedMesh(geo(bin, new THREE.CylinderGeometry(0.006, 0.006, 1, 4)), steel, lamps.length);
  const shade = new THREE.InstancedMesh(geo(bin, new THREE.CylinderGeometry(0.09, 0.34, 0.24, low ? 10 : 18, 1, true)), std(bin, '#2c3137', 0.5, 0.5, { side: THREE.DoubleSide }), lamps.length);
  const bulb = new THREE.InstancedMesh(geo(bin, new THREE.CircleGeometry(0.3, low ? 10 : 18)), bin.add(new THREE.MeshBasicMaterial({ color: '#fff4dc' })), lamps.length);
  const mm = new THREE.Matrix4(), qq = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
  lamps.forEach(([x, z], i) => {
    wire.setMatrixAt(i, mm.compose(new THREE.Vector3(x, HALL.h - 0.75, z), new THREE.Quaternion(), new THREE.Vector3(1, 1.1, 1)));
    shade.setMatrixAt(i, mm.compose(new THREE.Vector3(x, HALL.h - 1.4, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1)));
    bulb.setMatrixAt(i, mm.compose(new THREE.Vector3(x, HALL.h - 1.52, z), qq, new THREE.Vector3(1, 1, 1)));
  });
  for (const im of [wire, shade, bulb]) { im.instanceMatrix.needsUpdate = true; scene.add(im); }

  // ---- les rayonnages du stock : montants bleus, lisses orange, planchers, cartons et flight cases ----
  const uprights = [], lisses = [], decks = [], cartons = [], cases = [];
  const r = rng(29);
  const LEVELS = [0.12, 1.25, 2.4, 3.5];
  /** une travée de rayonnage le long d'un mur : x (centre de la profondeur), de z0 à z1, ouverte vers +x (sens 1) ou -x (-1) */
  const run = (x, z0, z1, sens) => {
    const bays = Math.max(1, Math.round((z1 - z0) / 2.7)); const bl = (z1 - z0) / bays; const dep = 1.0;
    for (let b = 0; b <= bays; b++) for (const dx of [-dep / 2, dep / 2]) uprights.push({ p: [x + dx, 1.85, z0 + b * bl], s: [0.08, 3.7, 0.08] });
    for (let b = 0; b < bays; b++) {
      const zc = z0 + (b + 0.5) * bl;
      for (const y of LEVELS) {
        for (const dx of [-dep / 2, dep / 2]) lisses.push({ p: [x + dx, y + 0.06, zc], s: [0.05, 0.11, bl - 0.08] });
        decks.push({ p: [x, y + 0.115, zc], s: [dep - 0.04, 0.02, bl - 0.1] });
        if (y > 3) continue;
        // ce qui est rangé sur ce niveau : cartons et flight cases, sans dépasser la place
        let z = zc - bl / 2 + 0.12;
        while (z < zc + bl / 2 - 0.35) {
          const fc = r() < 0.38; const w = fc ? 0.55 + r() * 0.35 : 0.3 + r() * 0.35; const h = fc ? 0.35 + r() * 0.4 : 0.22 + r() * 0.45; const d = fc ? 0.55 + r() * 0.3 : 0.35 + r() * 0.35;
          if (z + w > zc + bl / 2 - 0.08) break;
          const item = { p: [x + sens * (dep / 2 - d / 2 - 0.05), y + 0.125 + h / 2, z + w / 2], s: [d, h, w], ry: (r() - 0.5) * 0.06, c: fc ? undefined : ['#a37a4c', '#b48a59', '#9a7146', '#c29a68'][r() * 4 | 0] };
          (fc ? cases : cartons).push(item);
          if (!fc && h < 0.4 && r() < 0.45) cartons.push({ p: [item.p[0], y + 0.125 + h + 0.13, item.p[2]], s: [d * 0.9, 0.26, w * 0.85], ry: (r() - 0.5) * 0.1, c: '#b08655' });
          z += w + 0.05 + r() * 0.12;
        }
      }
    }
  };
  run(HALL.x0 + 0.6, -4.7, 3.4, 1);
  run(HALL.x1 - 0.6, -4.7, 0.7, -1);
  boxes(bin, scene, std(bin, '#2357a8', 0.55, 0.35), uprights);
  boxes(bin, scene, std(bin, '#e0661a', 0.5, 0.3), lisses);
  boxes(bin, scene, std(bin, '#8f979e', 0.7, 0.3), decks);
  boxes(bin, scene, std(bin, '#ffffff', 0.95), cartons.map((c) => ({ ...c, c: c.c || '#a37a4c' })));
  const caseMat = std(bin, '#ffffff', 0.55, 0.15, { map: bin.add(canvasTex(128, 128, flightCase)) });
  boxes(bin, scene, caseMat, cases);
  // les panneaux des rayons (le stock est rangé par famille)
  const rayons = [['Caméras', -4.0], ['Mélangeurs', -1.3], ['Réseau · énergie', 1.9]];
  for (const [txt, z] of rayons) {
    const t = bin.add(canvasTex(256, 64, (g, w, h) => { g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, w, h); g.fillStyle = '#1d2733'; g.fillRect(0, 0, 10, h); g.font = `700 34px ${FONT}`; g.textBaseline = 'middle'; g.fillText(String(txt).toUpperCase(), 22, h / 2 + 2, w - 30); }));
    const p = new THREE.Mesh(geo(bin, new THREE.PlaneGeometry(1.1, 0.27)), std(bin, '#ffffff', 0.7, 0, { map: t }));
    p.position.set(HALL.x0 + 1.12, 3.95, Number(z)); p.rotation.y = Math.PI / 2; scene.add(p);
  }

  // ---- au sol : flight cases sur roulettes, tourets de câble, une palette ----
  const floorCases = [{ p: [4.7, 0.5, -1.4], s: [0.8, 0.86, 0.62], ry: 0.12 }, { p: [5.55, 0.42, -1.3], s: [0.62, 0.7, 0.62], ry: -0.05 }, { p: [4.95, 1.13, -1.42], s: [0.6, 0.4, 0.5], ry: 0.18 }, { p: [-4.6, 0.45, 0.6], s: [1.2, 0.76, 0.6], ry: 1.45 }];
  boxes(bin, scene, caseMat, floorCases, !low);
  const reelMat = std(bin, '#2f6f45', 0.7), drumMat = std(bin, '#1d2024', 0.6);
  for (const [x, z] of [[-5.1, 2.3], [-5.1, 2.95]]) {
    const g = new THREE.Group(); g.position.set(x, 0.32, z); g.rotation.x = Math.PI / 2; scene.add(g);
    for (const y of [-0.18, 0.18]) g.add(new THREE.Mesh(geo(bin, new THREE.CylinderGeometry(0.32, 0.32, 0.03, 20)), reelMat)).position.y = y;
    g.add(new THREE.Mesh(geo(bin, new THREE.CylinderGeometry(0.24, 0.24, 0.34, 20)), drumMat));
  }
  boxes(bin, scene, std(bin, '#b38b5d', 0.9), [{ p: [-4.8, 0.07, -2.9], s: [1.2, 0.14, 0.8] }]);
  boxes(bin, scene, std(bin, '#ffffff', 0.95), [{ p: [-4.95, 0.37, -2.95], s: [0.5, 0.46, 0.6], c: '#a37a4c' }, { p: [-4.45, 0.33, -2.85], s: [0.45, 0.38, 0.5], c: '#b48a59' }, { p: [-4.8, 0.78, -2.9], s: [0.55, 0.36, 0.5], ry: 0.2, c: '#c29a68' }]);

  // ---- la baie 19" mobile de 12 U ----
  const rack = new THREE.Group(); rack.position.set(RACK.x, 0, RACK.z); scene.add(rack);
  const rackMat = std(bin, '#3a4047', 0.5, 0.45), railMat = std(bin, '#ffffff', 0.45, 0.6, { map: bin.add(canvasTex(64, 768, (g, w, h) => railTex(g, w, h, 12))) });
  const H12 = 12 * U, top = RACK.y0 + H12;
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(RACK.w, 0.05, RACK.d)), rackMat), [0, RACK.y0 - 0.03, 0], null, rack);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(RACK.w, 0.02, RACK.d)), rackMat), [0, top + 0.012, 0], null, rack);
  for (const x of [-RACK.w / 2 + 0.008, RACK.w / 2 - 0.008]) put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(0.016, top - RACK.y0 + 0.07, RACK.d)), rackMat), [x, (RACK.y0 + top) / 2, 0], null, rack);
  // poignées sur les flancs
  for (const x of [-RACK.w / 2 - 0.012, RACK.w / 2 + 0.012]) put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(0.02, 0.03, 0.16)), std(bin, '#15181b', 0.6)), [x, top - 0.08, 0], null, rack);
  // les montants : avant et arrière, percés et numérotés (le U 1 en bas)
  const railG = geo(bin, new THREE.BoxGeometry(0.016, H12, 0.003));
  for (const zr of [RACK.rail, -RACK.rail + 0.06]) for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(railG, railMat); m.position.set(sx * (RAIL_X + 0.008), RACK.y0 + H12 / 2, zr); rack.add(m);
    const flange = new THREE.Mesh(geo(bin, new THREE.BoxGeometry(0.003, H12, 0.03)), rackMat); flange.position.set(sx * (RAIL_X + 0.015), RACK.y0 + H12 / 2, zr - 0.015); rack.add(flange);
  }
  // les roulettes (pivotantes)
  const wheelG = geo(bin, new THREE.CylinderGeometry(0.038, 0.038, 0.028, low ? 10 : 16)), forkG = geo(bin, new THREE.BoxGeometry(0.05, 0.05, 0.03)), wheelM = std(bin, '#121417', 0.7);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(wheelG, wheelM); w.rotation.z = Math.PI / 2; w.position.set(sx * (RACK.w / 2 - 0.06), 0.038, sz * (RACK.d / 2 - 0.07)); rack.add(w);
    const f = new THREE.Mesh(forkG, rackMat); f.position.set(sx * (RACK.w / 2 - 0.06), 0.078, sz * (RACK.d / 2 - 0.07)); rack.add(f);
  }
  // le cadre ne porte pas d'ombre : la lumière du hall entre dans la baie et éclaire les appareils
  rack.traverse((o) => { if (/** @type {any} */ (o).isMesh) { o.castShadow = false; o.receiveShadow = true; } });

  // ---- la table de régie ----
  const table = new THREE.Group(); scene.add(table);
  const tw = TABLE.x1 - TABLE.x0, td = TABLE.z1 - TABLE.z0;
  const topMat = std(bin, '#4a4f55', 0.65, 0.05), edge = std(bin, '#1d2024', 0.5, 0.2);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(tw, 0.035, td)), topMat), [(TABLE.x0 + TABLE.x1) / 2, TABLE.top - 0.0175, (TABLE.z0 + TABLE.z1) / 2], null, table);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(tw + 0.01, 0.04, 0.012)), edge), [(TABLE.x0 + TABLE.x1) / 2, TABLE.top - 0.02, TABLE.z1], null, table);
  for (const x of [TABLE.x0 + 0.06, TABLE.x1 - 0.06]) put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(0.06, TABLE.top - 0.035, td - 0.12)), steel), [x, (TABLE.top - 0.035) / 2, (TABLE.z0 + TABLE.z1) / 2], null, table);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(tw - 0.14, 0.4, 0.015)), steel), [(TABLE.x0 + TABLE.x1) / 2, TABLE.top - 0.28, TABLE.z0 + 0.08], null, table);
  // la goulotte à l'arrière (les câbles y passent)
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(tw - 0.2, 0.06, 0.08)), steel), [(TABLE.x0 + TABLE.x1) / 2, TABLE.top - 0.08, TABLE.z0 + 0.05], null, table);
  table.traverse((o) => { if (/** @type {any} */ (o).isMesh) { o.castShadow = !low; o.receiveShadow = true; } });

  // ---- le plateau : estrade, fond, pupitre de conférence, une plante ----
  const stage = new THREE.Group(); scene.add(stage);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(3.4, 0.22, 1.35)), std(bin, '#26292d', 0.85)), [STAGE.x, 0.11, WALL_Z + 0.75], null, stage);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(3.4, 0.006, 1.35)), std(bin, '#3b3f45', 0.95)), [STAGE.x, 0.223, WALL_Z + 0.75], null, stage);
  const backT = bin.add(canvasTex(512, 384, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#14294d'); gr.addColorStop(1, '#0a1630'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.globalAlpha = 0.16; g.fillStyle = '#7fb4ff'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(w * (0.15 + i * 0.2), h); g.lineTo(w * (0.3 + i * 0.2), 0); g.lineTo(w * (0.36 + i * 0.2), 0); g.lineTo(w * (0.21 + i * 0.2), h); g.fill(); }
    g.globalAlpha = 1; g.fillStyle = '#e8b400'; g.fillRect(w * 0.08, h * 0.83, w * 0.84, 4);
  }));
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(3.5, 2.5, 0.05)), [std(bin, '#14294d', 0.8), std(bin, '#14294d', 0.8), std(bin, '#14294d', 0.8), std(bin, '#14294d', 0.8), std(bin, '#ffffff', 0.85, 0, { map: backT }), std(bin, '#14294d', 0.8)]), [STAGE.x, 0.22 + 1.25, WALL_Z + 0.06], null, stage);
  const wood = std(bin, '#6b4b2e', 0.7);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(0.55, 1.05, 0.42)), wood), [STAGE.x + 0.55, 0.22 + 0.525, WALL_Z + 0.85], [0, -0.12, 0], stage);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(0.6, 0.04, 0.48)), wood), [STAGE.x + 0.55, 0.22 + 1.07, WALL_Z + 0.87], [0.25, -0.12, 0], stage);
  put(new THREE.Mesh(geo(bin, new THREE.CylinderGeometry(0.16, 0.12, 0.34, 12)), std(bin, '#d8d4cb', 0.8)), [STAGE.x - 1.35, 0.39, WALL_Z + 0.35], null, stage);
  put(new THREE.Mesh(geo(bin, new THREE.IcosahedronGeometry(0.34, 1)), std(bin, '#2e6b35', 0.9, 0, { flatShading: true })), [STAGE.x - 1.35, 0.85, WALL_Z + 0.35], null, stage);
  stage.traverse((o) => { if (/** @type {any} */ (o).isMesh) { o.castShadow = !low; o.receiveShadow = true; } });

  // ---- le tableau électrique : le coffret du disjoncteur au-dessus des prises, son fourreau qui monte au chemin de câbles ----
  const coffret = std(bin, '#d9dcde', 0.5);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(0.24, 0.28, 0.09)), coffret), [MUR.x, MUR.y + 0.36, MUR.z + 0.045], null, scene);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(0.16, 0.1, 0.004)), std(bin, '#1d2329', 0.2, 0.3)), [MUR.x, MUR.y + 0.38, MUR.z + 0.092], null, scene);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(0.022, 0.05, 0.012)), std(bin, '#ffd200', 0.4, 0, { emissive: '#3a2f00' })), [MUR.x + 0.03, MUR.y + 0.38, MUR.z + 0.1], null, scene);
  put(new THREE.Mesh(geo(bin, new THREE.CylinderGeometry(0.016, 0.016, HALL.h - MUR.y - 0.5, 10)), std(bin, '#9aa1a8', 0.5, 0.3)), [MUR.x, (HALL.h + MUR.y + 0.5) / 2, MUR.z + 0.04], null, scene);
  put(new THREE.Mesh(geo(bin, new THREE.BoxGeometry(6, 0.06, 0.3)), std(bin, '#7d858d', 0.5, 0.5)), [MUR.x + 2.2, HALL.h - 0.9, MUR.z + 0.16], null, scene);

  // ---- le repère de chaque zone au sol : ruban jaune et noir, nom au pochoir ----
  const tape = std(bin, '#e8b400', 0.6);
  const rect = (x0, z0, x1, z1) => {
    const t = 0.05;
    for (const [w, d, x, z] of [[x1 - x0, t, (x0 + x1) / 2, z0], [x1 - x0, t, (x0 + x1) / 2, z1], [t, z1 - z0, x0, (z0 + z1) / 2], [t, z1 - z0, x1, (z0 + z1) / 2]]) { const m = new THREE.Mesh(geo(bin, new THREE.PlaneGeometry(Number(w), Number(d))), tape); m.rotation.x = -Math.PI / 2; m.position.set(Number(x), 0.003, Number(z)); m.receiveShadow = true; scene.add(m); }
  };
  rect(RACK.x - 0.5, RACK.z - 0.5, RACK.x + 0.5, RACK.z + 0.75);
  rect(TABLE.x0 - 0.2, TABLE.z0 - 0.25, TABLE.x1 + 0.2, TABLE.z1 + 0.95);
  for (const rr of [STAGE.r - 0.55, STAGE.r + 0.55]) {
    const a0 = THREE.MathUtils.degToRad(STAGE.a0 - 10), a1 = THREE.MathUtils.degToRad(STAGE.a0 + STAGE.da * 7 + 10);
    // l'arc du plateau : RingGeometry tracée dans le plan XY puis couchée au sol, où l'angle φ du
    // plan donne (r cos φ, 0, -r sin φ) ; un emplacement d'angle a est en (r sin a, 0, r cos a) : φ = a - 90°
    const ring = new THREE.Mesh(geo(bin, new THREE.RingGeometry(rr - 0.025, rr + 0.025, 48, 1, a0 - Math.PI / 2, a1 - a0)), tape);
    ring.rotation.x = -Math.PI / 2; ring.position.set(STAGE.x, 0.003, STAGE.z); ring.receiveShadow = true; scene.add(ring);
  }
  floorText(bin, scene, 'BAIE 19"', RACK.x, RACK.z + 0.6, 0.9);
  floorText(bin, scene, 'RÉGIE', (TABLE.x0 + TABLE.x1) / 2, TABLE.z1 + 0.8, 1.1);
  floorText(bin, scene, 'PLATEAU', STAGE.x, STAGE.z + STAGE.r + 0.35, 1.3);
  floorText(bin, scene, 'TABLEAU ÉLECTRIQUE', MUR.x, WALL_Z + 0.55, 1.4);

  return { rack, sun };
}
