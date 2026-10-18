// @ts-check
import * as THREE from 'three';
import { S } from '../state.js';
import { TRUCK, blockedOutside, groundHeight, inTruckFootprint } from '../world.js';
import { truckBlocked, truckFloorAt } from '../truck.js';
import { AT, atelierBlocks, ATELIER_DECK } from '../atelier.js';
import { $ } from '../ui/common.js';

// ----------------------------------------------------------------------------------
// Le joueur à la première personne : position, regard, marche (collisions, gravité,
// balancement), vol libre. Touches tenues dans KEYS, joystick tactile dans joy.
// ----------------------------------------------------------------------------------
export const PL = { pos: new THREE.Vector3(-13, 0, -107.5), yaw: 0.25, pitch: 0.02, y: 1.7, fly: false, vy: 0, vel: new THREE.Vector3(), bob: 0, bobY: 0, roll: 0, fov: 70, cyaw: 0.25, cpitch: 0.02 };
/** @type {Record<string, boolean>} */
export const KEYS = {};
export const joy = { x: 0, y: 0 };

// atelier de montage : on marche sur la passerelle (sol à 17,2 m), entre les flight cases et le garde-corps
export const onDeck = () => !PL.fly && PL.pos.y > 15 && PL.pos.x > ATELIER_DECK.x0 && PL.pos.x < ATELIER_DECK.x1 && PL.pos.z > ATELIER_DECK.z0 && PL.pos.z < ATELIER_DECK.z1;
// bouton « Vol libre » de la barre d'outils : allumé en vol
export function updToolbar() { const f = $('#tb-fly'); if (f) f.classList.toggle('on', PL.fly); }
// position de l'œil
export const eyePos = (out) => out.set(PL.pos.x, PL.y, PL.pos.z);

// vecteurs de travail : la marche n'alloue rien à chaque image
const F = new THREE.Vector3(), R = new THREE.Vector3(), MV = new THREE.Vector3(), STEP = new THREE.Vector3();
export function updatePlayer(dt) {
  const f = F.set(-Math.sin(PL.yaw), 0, -Math.cos(PL.yaw)), r = R.set(Math.cos(PL.yaw), 0, -Math.sin(PL.yaw));
  const mv = MV.set(0, 0, 0);
  if (KEYS.KeyW || KEYS.ArrowUp) mv.add(f); if (KEYS.KeyS || KEYS.ArrowDown) mv.sub(f); if (KEYS.KeyD || KEYS.ArrowRight) mv.add(r); if (KEYS.KeyA || KEYS.ArrowLeft) mv.sub(r);
  mv.addScaledVector(f, -joy.y).addScaledVector(r, joy.x);
  const run = KEYS.ShiftLeft || KEYS.ShiftRight;
  if (PL.fly && S.inTruck) PL.fly = false;
  let sp = PL.fly ? (run ? 45 : 15) : (run ? 8.5 : 4.2);
  if (S.inTruck) sp = run ? 3.2 : 2.2;
  if (mv.lengthSq() > 1) mv.normalize();
  // inertie : la vitesse rejoint la consigne en douceur (accélération / freinage), plus « planant » en vol
  const target = mv.multiplyScalar(sp);
  const acc = PL.fly ? 2.6 : S.inTruck ? 11 : 8;
  if (PL.fly) target.y = ((KEYS.Space ? 1 : 0) - (KEYS.KeyC || KEYS.ControlLeft ? 1 : 0)) * sp * 0.8;
  else target.y = 0;
  PL.vel.lerp(target, 1 - Math.exp(-acc * dt));
  if (!PL.fly) PL.vel.y = 0;
  const step = STEP.copy(PL.vel).multiplyScalar(dt);
  const p = PL.pos;
  const hs = Math.hypot(PL.vel.x, PL.vel.z);
  // roulis léger en vol quand on se décale sur le côté, FOV élargi à grande vitesse
  const side = PL.vel.dot(r) / Math.max(1, sp);
  PL.roll += ((PL.fly ? -side * 0.06 : 0) - PL.roll) * Math.min(1, dt * 4);
  PL.fov += (70 + (PL.fly ? Math.min(8, hs / 6) : run && hs > 5 ? 4 : 0) - PL.fov) * Math.min(1, dt * 3);
  if (PL.fly) {
    p.add(step);
    p.y = Math.max(groundHeight(p.x, p.z), p.y);
    PL.y = p.y + 1.7; PL.bobY *= 0.9;
    if (inTruckFootprint(p.x, p.z) && p.y < TRUCK.ceil) { p.y = TRUCK.ceil + 0.5; }
    return;
  }
  const deck = AT.active && onDeck();
  const blocked = (x, z) => S.inTruck ? truckBlocked(x, z) : deck ? atelierBlocks(x, z) : blockedOutside(x, z);
  const nx = p.x + step.x, nz = p.z + step.z;
  // entrée dans le car par la porte
  if (!S.inTruck && inTruckFootprint(nx, nz) && nx > TRUCK.doorX0 && nx < TRUCK.doorX1 && nz > TRUCK.z1 - 0.6) { S.inTruck = true; p.x = nx; p.z = TRUCK.z1 - 0.35; }
  else if (S.inTruck && nz > TRUCK.z1 + 0.05) { S.inTruck = false; p.x = nx; p.z = nz; }
  else {
    const Rr = S.inTruck ? 0.24 : 0.28, D = Rr * 0.71;
    const ok = (x, z) => !blocked(x + Rr, z) && !blocked(x - Rr, z) && !blocked(x, z + Rr) && !blocked(x, z - Rr) && !blocked(x + D, z + D) && !blocked(x - D, z + D) && !blocked(x + D, z - D) && !blocked(x - D, z - D);
    // glissement le long des obstacles : on essaie le mouvement complet, puis chaque axe séparément (la vitesse bloquée s'annule)
    if (ok(nx, nz)) { p.x = nx; p.z = nz; } else if (ok(nx, p.z)) { p.x = nx; PL.vel.z = 0; } else if (ok(p.x, nz)) { p.z = nz; PL.vel.x = 0; } else { PL.vel.x = 0; PL.vel.z = 0; }
  }
  // gravité / sol (estrade dans le car)
  const g = S.inTruck ? truckFloorAt(p.x, p.z) : deck ? ATELIER_DECK.y : groundHeight(p.x, p.z);
  if (p.y > g + 0.05) { PL.vy -= 18 * dt; p.y = Math.max(g, p.y + PL.vy * dt); } else { PL.vy = 0; p.y += (g - p.y) * Math.min(1, dt * 14); }
  // balancement de la marche (discret, plus faible dans le car)
  if (hs > 0.25) PL.bob += dt * (5.2 + hs * 0.9);
  const amp = (S.inTruck ? 0.012 : 0.028) * Math.min(1, hs / 4);
  PL.bobY += (Math.abs(Math.sin(PL.bob)) * amp - amp * 0.5 - PL.bobY) * Math.min(1, dt * 12);
  PL.y = p.y + 1.7 + PL.bobY;
}
