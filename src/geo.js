// @ts-check
import * as THREE from 'three';
import { VIEW_INV, VIEW_INV_GLSL } from './render.js';

// ----------------------------------------------------------------------------------
// Boîte aux arêtes arrondies (chanfrein de rayon r), en three.js de base : la boîte subdivisée est
// projetée sur la « boîte intérieure » décalée de r (comme un congé d'usinage). Les normales sont
// exactes sur l'arrondi ; les grandes faces restent subdivisées (occlusion ambiante par sommet).
// ----------------------------------------------------------------------------------
export function roundedBox(w, h, d, r, seg = 4, segs = null) {
  r = Math.min(r, w / 2, h / 2, d / 2);
  const sw = segs ? segs[0] : seg, sh = segs ? segs[1] : seg, sd = segs ? segs[2] : seg;
  const g = new THREE.BoxGeometry(1, 1, 1, sw, sh, sd);
  const pos = g.attributes.position, nrm = g.attributes.normal;
  const inner = [w / 2 - r, h / 2 - r, d / 2 - r];
  const segOf = [sw, sh, sd];
  // part de chaque face (en coordonnées cube) réservée à l'arrondi : deux segments quand on en a
  const t = [0, 1, 2].map((i) => Math.min(0.5, (segOf[i] >= 4 ? 2 : 1) / segOf[i]));
  const q = [0, 0, 0], c = [0, 0, 0], o = [0, 0, 0];
  for (let i = 0; i < pos.count; i++) {
    q[0] = pos.getX(i) * 2; q[1] = pos.getY(i) * 2; q[2] = pos.getZ(i) * 2;
    let l = 0;
    for (let k = 0; k < 3; k++) {
      const m = 1 - t[k];
      const cl = Math.max(-m, Math.min(m, q[k]));
      c[k] = inner[k] * cl / m; o[k] = q[k] - cl; l += o[k] * o[k];
    }
    l = Math.sqrt(l) || 1;
    const nx = o[0] / l, ny = o[1] / l, nz = o[2] / l;
    pos.setXYZ(i, c[0] + nx * r, c[1] + ny * r, c[2] + nz * r);
    nrm.setXYZ(i, nx, ny, nz);
  }
  return g;
}

// ----------------------------------------------------------------------------------
// Occlusion ambiante cuite par sommet : rayons hémisphériques contre des boîtes alignées (les
// pièces du Builder). Le résultat assombrit la couleur par sommet : coins de pièce, dessous de
// bureau, pieds de baie « touchent » le sol, sans aucun coût au rendu.
// ----------------------------------------------------------------------------------
const AO_DIRS = (() => {
  const out = []; const n = 16;
  for (let i = 0; i < n; i++) {
    const z = 1 - (i + 0.5) / n * 0.92; // on évite les rayons rasants
    const r = Math.sqrt(1 - z * z), a = i * 2.39996;
    out.push([Math.cos(a) * r, Math.sin(a) * r, z]);
  }
  return out;
})();
/**
 * @param {THREE.BufferGeometry} geo géométrie non indexée avec position, normal, color
 * @param {number[][]} boxes boîtes [x0,y0,z0,x1,y1,z1]
 * @param {{ dist?: number, strength?: number, floor?: number, skip?: (vertexIndex: number, boxIndex: number) => boolean, skipV?: (vertexIndex: number) => boolean }} [o]
 */
export function bakeAO(geo, boxes, o = {}) {
  const D = o.dist ?? 1.2, K = o.strength ?? 1.0, FL = o.floor ?? 0.22;
  const pos = geo.attributes.position, nrm = geo.attributes.normal, col = geo.attributes.color;
  if (!pos || !nrm || !col || !boxes.length) return geo;
  const P = pos.array, N = nrm.array, C = col.array;
  const nb = boxes.length;
  const near = new Int32Array(nb);
  for (let i = 0; i < pos.count; i++) {
    if (o.skipV && o.skipV(i)) continue;
    const px = P[i * 3], py = P[i * 3 + 1], pz = P[i * 3 + 2];
    let nx = N[i * 3], ny = N[i * 3 + 1], nz = N[i * 3 + 2];
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    // boîtes à portée
    let nn = 0;
    for (let b = 0; b < nb; b++) {
      const B = boxes[b];
      const dx = Math.max(B[0] - px, 0, px - B[3]), dy = Math.max(B[1] - py, 0, py - B[4]), dz = Math.max(B[2] - pz, 0, pz - B[5]);
      if (dx * dx + dy * dy + dz * dz < D * D && !(o.skip && o.skip(i, b))) near[nn++] = b;
    }
    if (!nn) continue;
    // repère tangent
    const ax = Math.abs(nx) < 0.9 ? 1 : 0, ay = ax ? 0 : 1;
    let tx = ay * nz - 0 * ny, ty = 0 * nx - ax * nz, tz = ax * ny - ay * nx; // (ax,ay,0) × n
    const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
    const bx = ny * tz - nz * ty, by = nz * tx - nx * tz, bz = nx * ty - ny * tx;
    const ox = px + nx * 0.012, oy = py + ny * 0.012, oz = pz + nz * 0.012;
    let occ = 0, wsum = 0;
    for (const d of AO_DIRS) {
      const dx = tx * d[0] + bx * d[1] + nx * d[2], dy = ty * d[0] + by * d[1] + ny * d[2], dz = tz * d[0] + bz * d[1] + nz * d[2];
      const w = d[2]; wsum += w;
      let tmin = D;
      const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
      for (let k = 0; k < nn; k++) {
        const B = boxes[near[k]];
        let t0 = (B[0] - ox) * ix, t1 = (B[3] - ox) * ix; if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
        let u0 = (B[1] - oy) * iy, u1 = (B[4] - oy) * iy; if (u0 > u1) { const s = u0; u0 = u1; u1 = s; }
        let v0 = (B[2] - oz) * iz, v1 = (B[5] - oz) * iz; if (v0 > v1) { const s = v0; v0 = v1; v1 = s; }
        const ta = Math.max(t0, u0, v0), tb = Math.min(t1, u1, v1);
        if (tb >= ta && tb > 0 && ta < tmin) tmin = Math.max(ta, 0);
      }
      occ += w * (1 - tmin / D);
    }
    const ao = Math.max(FL, 1 - K * occ / wsum);
    C[i * 3] *= ao; C[i * 3 + 1] *= ao; C[i * 3 + 2] *= ao;
  }
  col.needsUpdate = true;
  return geo;
}

// ----------------------------------------------------------------------------------
// Fusion de géométries (non indexées) avec couleurs par sommet, pour réduire les appels de rendu.
// Options : uv (garder les UV), ao (résolution de subdivision en mètres : les grandes faces sont
// découpées et l'occlusion ambiante est cuite à la fusion), occluders (liste de boîtes partagée
// entre plusieurs Builder d'une même pièce).
// ----------------------------------------------------------------------------------
export class Builder {
  constructor(opts = {}) {
    this.parts = []; this.keepUV = !!opts.uv;
    this.aoRes = opts.ao || 0; this.aoOpts = opts.aoOpts || {};
    /** en dessous de cette taille (m), une pièce ne reçoit pas d'occlusion (et moins de segments) */
    this.smallSize = opts.small ?? 0.26;
    /** @type {number[][]} boîtes occultantes [x0,y0,z0,x1,y1,z1] */
    this.occluders = opts.occluders || [];
    /** indice d'occulteur de chaque pièce (−1 : aucun) */
    this.partBox = [];
    /** pièces menues (gobelets, boutons…) : pas d'occlusion calculée sur leurs sommets */
    this.partSmall = [];
  }
  add(geo, matrix, color, boxIndex = -1, small = false) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g.attributes.uv && !this.keepUV) g.deleteAttribute('uv');
    this.parts.push(g); this.partBox.push(boxIndex); this.partSmall.push(small);
    return this;
  }
  /** enregistre l'enveloppe (alignée) d'une boîte posée par matrix ; renvoie son indice */
  occlude(w, h, d, m) {
    const hx = w / 2, hy = h / 2, hz = d / 2;
    const e = m.elements;
    // étendue d'une boîte tournée : somme des valeurs absolues des colonnes de la matrice
    const ex = Math.abs(e[0]) * hx + Math.abs(e[4]) * hy + Math.abs(e[8]) * hz;
    const ey = Math.abs(e[1]) * hx + Math.abs(e[5]) * hy + Math.abs(e[9]) * hz;
    const ez = Math.abs(e[2]) * hx + Math.abs(e[6]) * hy + Math.abs(e[10]) * hz;
    this.occluders.push([e[12] - ex, e[13] - ey, e[14] - ez, e[12] + ex, e[13] + ey, e[14] + ez]);
    return this.occluders.length - 1;
  }
  segsFor(w, h, d) {
    if (!this.aoRes) return null;
    const s = (v) => Math.max(1, Math.min(48, Math.ceil(v / this.aoRes)));
    return [s(w), s(h), s(d)];
  }
  box(w, h, d, x, y, z, color, rotY = 0, rotX = 0, rotZ = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const sg = this.segsFor(w, h, d);
    const bi = this.aoRes ? this.occlude(w, h, d, m) : -1;
    return this.add(sg ? new THREE.BoxGeometry(w, h, d, sg[0], sg[1], sg[2]) : new THREE.BoxGeometry(w, h, d), m, color, bi, Math.max(w, h, d) < this.smallSize);
  }
  /** boîte aux arêtes arrondies (rayon r) ; les petites pièces ont moins de segments */
  cbox(w, h, d, x, y, z, color, r = 0.01, rotY = 0, rotX = 0, rotZ = 0, seg = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const small = Math.max(w, h, d) < this.smallSize;
    if (!seg) seg = small ? 3 : 4;
    const sg = this.segsFor(w, h, d);
    const segs = sg ? sg.map((v) => Math.max(v, seg)) : null;
    const bi = this.aoRes ? this.occlude(w, h, d, m) : -1;
    return this.add(roundedBox(w, h, d, r, seg, segs), m, color, bi, small);
  }
  cyl(rt, rb, h, x, y, z, color, seg = 10, rotX = 0, rotZ = 0, rotY = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ')), new THREE.Vector3(1, 1, 1));
    const r2 = Math.max(rt, rb) * 2;
    const bi = this.aoRes && r2 > 0.08 ? this.occlude(r2, h, r2, m) : -1;
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, color, bi);
  }
  sphere(r, x, y, z, color, seg = 10) {
    const m = new THREE.Matrix4().makeTranslation(x, y, z);
    return this.add(new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1)), m, color);
  }
  // segment de cylindre entre deux points
  rod(a, b, r, color, seg = 6) {
    const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
    const len = va.distanceTo(vb);
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    const mid = va.clone().add(vb).multiplyScalar(0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize());
    return this.add(g, new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)), color);
  }
  build() {
    if (!this.parts.length) return new THREE.BufferGeometry();
    const g = mergeNonIndexed(this.parts);
    if (this.aoRes && this.occluders.length) {
      // chaque sommet ignore la boîte de sa propre pièce (un arrondi est à l'intérieur de son enveloppe)
      const n = g.attributes.position.count;
      const owner = new Int32Array(n), small = new Uint8Array(n); let off = 0;
      this.parts.forEach((p, k) => { const c = p.attributes.position.count; owner.fill(this.partBox[k], off, off + c); if (this.partSmall[k]) small.fill(1, off, off + c); off += c; });
      bakeAO(g, this.occluders, { ...this.aoOpts, skip: (vi, bi) => owner[vi] === bi, skipV: (vi) => small[vi] === 1 });
    }
    return g;
  }
  mesh(material) { return new THREE.Mesh(this.build(), material); }
}

export function mergeNonIndexed(geos) {
  const names = [...new Set(geos.flatMap((g) => Object.keys(g.attributes)))];
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const itemSize = geos.find((g) => g.attributes[name]).attributes[name].itemSize;
    const arr = new Float32Array(total * itemSize);
    let off = 0;
    for (const g of geos) {
      const a = g.attributes[name];
      if (!a) { off += g.attributes.position.count * itemSize; continue; }
      arr.set(a.array, off);
      off += a.count * itemSize;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
  }
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

// Quad quelconque (4 points, sens anti-horaire vu de face) avec UV en mètres
export function quadGeo(p0, p1, p2, p3, uvs) {
  const g = new THREE.BufferGeometry();
  const pos = new Float32Array([...p0, ...p1, ...p2, ...p0, ...p2, ...p3]);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  if (uvs) {
    const [a, b, c, d] = uvs;
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([...a, ...b, ...c, ...a, ...c, ...d]), 2));
  }
  g.computeVertexNormals();
  return g;
}

export function setLayer(obj, layer) {
  obj.traverse((o) => o.layers.set(layer));
  return obj;
}

// Matériau "écran" : affiche une texture telle quelle (valeurs déjà en espace vidéo), sans éclairage ni tonemapping
export function screenMaterial(tex, opts = {}) {
  return new THREE.ShaderMaterial({
    uniforms: { map: { value: tex || null }, uGain: { value: opts.gain ?? 1.1 }, uOn: { value: 1 }, uLin: { value: opts.linear ? 1 : 0 }, uInvI: VIEW_INV.invI, uInvO: VIEW_INV.invO, uExpEye: VIEW_INV.exp },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform float uGain; uniform float uOn; uniform float uLin; uniform mat3 uInvI, uInvO; uniform float uExpEye; varying vec2 vUv;
      ${VIEW_INV_GLSL}
      void main(){ vec3 c = texture2D(map, vUv).rgb * uGain; c = clamp(c, 0.0, 1.0);
        if (uLin > 1.5) c = viewInverse(c, uInvI, uInvO, uExpEye) * 1.15; // vue post-traitée : l'écran garde son image (légèrement lumineux)
        else if (uLin > 0.5) c = pow(c, vec3(2.2)) * 1.6; // vu par une caméra : valeur linéaire approx.
        gl_FragColor = vec4(c * uOn + vec3(0.01,0.012,0.014)*(1.0-uOn), 1.0); }`,
    toneMapped: false,
  });
}
