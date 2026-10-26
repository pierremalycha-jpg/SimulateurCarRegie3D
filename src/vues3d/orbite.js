// @ts-check
import * as THREE from 'three';
import { clamp, lerp } from '../util.js';

// ----------------------------------------------------------------------------------
// La caméra des vues 3D : une orbite autour d'une cible, comme celle de la caméra du Cours (camlab) et
// des postes en 3D. Glisser pour tourner, clic droit ou Maj + glisser pour déplacer, molette ou pincement
// pour s'approcher ; flyTo vole en douceur d'un point de vue à un autre (changement d'étape, Recentrer).
// Les bornes (distance, hauteur de l'œil) sont celles de la vue ouverte.
// ----------------------------------------------------------------------------------
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {HTMLElement} dom
 */
export function makeOrbit(camera, dom) {
  const O = {
    target: new THREE.Vector3(), sph: new THREE.Spherical(6, 1.1, 0.6), vel: { th: 0, ph: 0 },
    /** @type {any} */ fly: null, moved: 0, rMin: 0.3, rMax: 30, phiMin: 0.08, phiMax: Math.PI - 0.08,
    /** @type {((e: PointerEvent) => void) | null} */ onTap: null,
    /** @type {((e: PointerEvent) => void) | null} */ onHover: null,
    /** @type {(() => void) | null} */ onDouble: null,
    apply() { const p = new THREE.Vector3().setFromSpherical(O.sph).add(O.target); camera.position.copy(p); camera.lookAt(O.target); },
    /** va regarder la cible depuis la direction dir (vers l'œil), à la distance dist */
    flyTo(target, dir, dist, dur = 0.9) {
      const from = { t: O.target.clone(), d: new THREE.Vector3().setFromSpherical(O.sph).normalize(), r: O.sph.radius };
      O.fly = { from, to: { t: target.clone(), d: dir.clone().normalize(), r: clamp(dist, O.rMin, O.rMax) }, k: 0, dur };
    },
    /** place l'œil tout de suite */
    jumpTo(target, dir, dist) { O.fly = null; O.target.copy(target); O.sph.setFromVector3(dir.clone().normalize().multiplyScalar(clamp(dist, O.rMin, O.rMax))); O.apply(); },
    update(dt) {
      if (O.fly) {
        const F = O.fly; F.k = Math.min(1, F.k + dt / F.dur); const e = ease(F.k);
        O.target.lerpVectors(F.from.t, F.to.t, e);
        const ang = F.from.d.angleTo(F.to.d); let d;
        if (ang < 1e-4) d = F.to.d.clone(); else { const s = Math.sin(ang); d = F.from.d.clone().multiplyScalar(Math.sin((1 - e) * ang) / s).addScaledVector(F.to.d, Math.sin(e * ang) / s); }
        const r = Math.exp(lerp(Math.log(F.from.r), Math.log(F.to.r), e));
        O.sph.setFromVector3(d.multiplyScalar(r));
        if (F.k >= 1) O.fly = null;
      } else if (Math.abs(O.vel.th) + Math.abs(O.vel.ph) > 1e-5) {
        O.sph.theta += O.vel.th; O.sph.phi = clamp(O.sph.phi + O.vel.ph, O.phiMin, O.phiMax);
        const k = Math.pow(0.0015, dt); O.vel.th *= k; O.vel.ph *= k;
      }
      O.sph.phi = clamp(O.sph.phi, O.phiMin, O.phiMax);
      O.sph.radius = clamp(O.sph.radius, O.rMin, O.rMax);
      O.apply();
    },
  };
  const ptrs = new Map(); let pinch = null; let lastTap = 0;
  dom.addEventListener('pointerdown', (e) => {
    dom.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button });
    O.moved = 0; O.fly = null; O.vel.th = O.vel.ph = 0;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), r: O.sph.radius, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; }
  });
  dom.addEventListener('pointermove', (e) => {
    const p = ptrs.get(e.pointerId);
    if (!p) { if (O.onHover) O.onHover(e); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    O.moved += Math.abs(dx) + Math.abs(dy);
    if (ptrs.size === 2 && pinch) {
      const [a, b] = [...ptrs.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
      O.sph.radius = clamp(pinch.r * pinch.d / Math.max(20, d), O.rMin, O.rMax);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2; pan(mx - pinch.mx, my - pinch.my); pinch.mx = mx; pinch.my = my;
      return;
    }
    if (p.b === 2 || e.shiftKey) { pan(dx, dy); return; }
    O.vel.th = -dx * 0.0055; O.vel.ph = -dy * 0.0055;
    O.sph.theta += O.vel.th; O.sph.phi = clamp(O.sph.phi + O.vel.ph, O.phiMin, O.phiMax);
  });
  const end = (e) => {
    const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch = null;
    if (p && O.moved < 6 && e.type === 'pointerup') {
      const now = performance.now();
      if (now - lastTap < 320 && O.onDouble) { lastTap = 0; O.onDouble(); return; }
      lastTap = now;
      if (O.onTap) O.onTap(e);
    }
  };
  dom.addEventListener('pointerup', end); dom.addEventListener('pointercancel', end);
  dom.addEventListener('contextmenu', (e) => e.preventDefault());
  dom.addEventListener('wheel', (e) => { e.preventDefault(); O.fly = null; O.sph.radius = clamp(O.sph.radius * Math.exp(e.deltaY * 0.0012), O.rMin, O.rMax); }, { passive: false });
  function pan(dx, dy) {
    const k = O.sph.radius * 0.0016; const right = new THREE.Vector3(), up = new THREE.Vector3();
    camera.matrixWorld.extractBasis(right, up, new THREE.Vector3());
    O.target.addScaledVector(right, -dx * k).addScaledVector(up, dy * k);
  }
  return O;
}
