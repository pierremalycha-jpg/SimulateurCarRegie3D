import * as THREE from 'three';

// Fusion de géométries (non indexées) avec couleurs par sommet, pour réduire les appels de rendu
export class Builder {
  constructor() { this.parts = []; }
  add(geo, matrix, color) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    if (matrix) g.applyMatrix4(matrix);
    const n = g.attributes.position.count;
    const c = new THREE.Color(color);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    if (!g.attributes.normal) g.computeVertexNormals();
    if (g.attributes.uv) g.deleteAttribute('uv');
    this.parts.push(g);
    return this;
  }
  box(w, h, d, x, y, z, color, rotY = 0, rotX = 0, rotZ = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ')), new THREE.Vector3(1, 1, 1));
    return this.add(new THREE.BoxGeometry(w, h, d), m, color);
  }
  cyl(rt, rb, h, x, y, z, color, seg = 10, rotX = 0, rotZ = 0, rotY = 0) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rotX, rotY, rotZ, 'YXZ')), new THREE.Vector3(1, 1, 1));
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), m, color);
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
    return mergeNonIndexed(this.parts);
  }
  mesh(material) { return new THREE.Mesh(this.build(), material); }
}

export function mergeNonIndexed(geos) {
  const names = Object.keys(geos[0].attributes);
  let total = 0;
  for (const g of geos) total += g.attributes.position.count;
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const itemSize = geos[0].attributes[name].itemSize;
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
    uniforms: { map: { value: tex || null }, uGain: { value: opts.gain ?? 1.1 }, uOn: { value: 1 }, uLin: { value: opts.linear ? 1 : 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform float uGain; uniform float uOn; uniform float uLin; varying vec2 vUv;
      void main(){ vec3 c = texture2D(map, vUv).rgb * uGain; c = clamp(c, 0.0, 1.0);
        if (uLin > 0.5) c = pow(c, vec3(2.2)) * 1.6; // vu par une caméra : valeur linéaire approx.
        gl_FragColor = vec4(c * uOn + vec3(0.01,0.012,0.014)*(1.0-uOn), 1.0); }`,
    toneMapped: false,
  });
}
