// Les figurants (src/figurants/) : l'équipe du car à ses postes, qui laisse sa place quand on s'assoit, et la vie du
// compound (techniciens qui entrent et sortent du car, agents de sécurité). Calculs purs : chemins, pas de marche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EQUIPE, longueur, pointSur, avancerEquipier, VITESSE, LEVER } from '../../src/figurants/equipe.js';
import { MARCHEURS, LIEUX, departMarcheur, avancerMarcheur } from '../../src/figurants/compound.js';
import { TRUCK, OBSTACLES_COMPOUND, inTruckFootprint } from '../../src/world.js';

const truckSrc = fs.readFileSync(new URL('../../src/truck.js', import.meta.url), 'utf8');
const iaSrc = fs.readFileSync(new URL('../../src/emission/ia.js', import.meta.url), 'utf8');

test('l\'équipe : un équipier par poste du car, chaque rôle de l\'équipe virtuelle a un visage', () => {
  const ids = new Set();
  for (const e of EQUIPE) {
    assert.ok(!ids.has(e.id), `${e.id} en double`); ids.add(e.id);
    assert.ok(truckSrc.includes(`st('${e.station}'`), `${e.id} : le poste ${e.station} existe dans truck.js`);
    assert.ok(e.nom && e.metier && e.tenue && typeof e.tenue.haut === 'number');
    assert.ok(e.chemin.length >= 2, `${e.id} : un chemin vers l'attente`);
  }
  const roles = [...iaSrc.matchAll(/\{ id: '([a-z]+)', poste: '/g)].map((m) => m[1]);
  assert.ok(roles.length >= 8, 'les rôles de l\'équipe virtuelle (emission/ia.js)');
  for (const r of roles) assert.ok(EQUIPE.some((e) => e.role === r), `le rôle ${r} a son équipier`);
  // les places d'attente : distinctes, contre la paroi de l'allée ou dans la zone technique, jamais devant la porte
  const att = EQUIPE.map((e) => e.chemin[e.chemin.length - 1]);
  for (let a = 0; a < att.length; a++) for (let b = a + 1; b < att.length; b++) assert.ok(Math.hypot(att[a][0] - att[b][0], att[a][1] - att[b][1]) >= 0.6, `${EQUIPE[a].id} et ${EQUIPE[b].id} se gênent`);
  const porte = [TRUCK.doorX0 - TRUCK.cx - 0.3, TRUCK.doorX1 - TRUCK.cx + 0.3];
  for (const [i, p] of att.entries()) assert.ok(!(p[0] > porte[0] && p[0] < porte[1] && p[1] > 1.2), `${EQUIPE[i].id} attend devant la porte`);
});

test('le chemin : longueur, point à une distance, direction de la marche', () => {
  const ch = [[0, 0], [3, 0], [3, 4]];
  assert.equal(longueur(ch), 7);
  assert.deepEqual(pointSur(ch, 0), { x: 0, z: 0, cap: Math.PI / 2 });
  const p = pointSur(ch, 5); assert.equal(p.x, 3); assert.equal(p.z, 2); assert.equal(p.cap, 0);
  assert.deepEqual([pointSur(ch, 99).x, pointSur(ch, 99).z], [3, 4]);
});

test('l\'équipier laisse sa place : il se lève, va attendre, revient et se rassoit', () => {
  const L = 3, e = { s: 0, assis: 1 };
  avancerEquipier(e, L, true, LEVER / 2); assert.ok(e.assis > 0 && e.assis < 1 && e.s === 0, 'il se lève d\'abord');
  for (let t = 0; t < LEVER; t += 0.05) avancerEquipier(e, L, true, 0.05);
  assert.equal(e.assis, 0); assert.ok(e.s > 0, 'puis il marche');
  for (let t = 0; t < L / VITESSE + 0.2; t += 0.05) avancerEquipier(e, L, true, 0.05);
  assert.equal(e.s, L); assert.equal(e.sens, 0, 'arrivé à l\'attente, il ne bouge plus');
  // on se lève : il revient (sens −1) puis se rassoit
  avancerEquipier(e, L, false, 0.05); assert.equal(e.sens, -1);
  for (let t = 0; t < L / VITESSE + LEVER + 0.3; t += 0.05) avancerEquipier(e, L, false, 0.05);
  assert.equal(e.s, 0); assert.equal(e.assis, 1);
});

// un point est-il dans un obstacle du compound (avec la largeur d'un corps) ? la porte et ses marches sont un passage
const porteCar = (x, z) => x > TRUCK.doorX0 - 0.4 && x < TRUCK.doorX1 + 0.4 && z > TRUCK.z1 - 0.2 && z < TRUCK.z1 + 2.2;
const dansObstacle = (x, z, m = 0.3) => OBSTACLES_COMPOUND.some((o) => x > o.x0 - m && x < o.x1 + m && z > o.z0 - m && z < o.z1 + m);

test('le compound : chacun boucle son itinéraire sans traverser le car, le groupe, le camion satellite ni les bungalows', () => {
  for (const m of MARCHEURS) {
    const e = departMarcheur(m);
    let dedans = 0, cache = 0, tours = 0, k0 = e.k, prevK = e.k;
    for (let t = 0; t < 900; t += 0.1) {
      avancerMarcheur(m, e, 0.1);
      if (e.k === k0 && prevK !== k0) tours++;
      prevK = e.k;
      if (e.cache) { cache++; continue; }
      if (inTruckFootprint(e.x, e.z)) { dedans++; continue; }
      assert.ok(!dansObstacle(e.x, e.z) || porteCar(e.x, e.z), `${m.id} traverse un obstacle en (${e.x.toFixed(1)}, ${e.z.toFixed(1)})`);
    }
    assert.ok(tours >= 1 || m.etapes.length <= 4, `${m.id} : son itinéraire boucle (${tours} tours)`);
    if (m.id.startsWith('securite')) assert.equal(dedans, 0, `${m.id} reste dehors`);
    if (cache) assert.ok(m.etapes.some((x) => 'vers' in x && x.vers === LIEUX.stade), `${m.id} ne disparaît que dans le stade`);
  }
  const entrent = MARCHEURS.filter((m) => m.etapes.some((x) => 'vers' in x && inTruckFootprint(x.vers[0], x.vers[1])));
  assert.ok(entrent.length >= 3, 'des techniciens entrent dans le car et en ressortent');
  assert.ok(MARCHEURS.filter((m) => m.id.startsWith('securite')).length >= 2, 'des agents de sécurité');
});

test('le marcheur : il avance à sa vitesse, s\'arrête le temps de la pause, et repart', () => {
  const m = { id: 't', nom: '', metier: '', vitesse: 1, tenue: /** @type {any} */ ({}), etapes: [{ vers: [0, 0] }, { vers: [2, 0] }, { pause: 1, cap: 0.5, bras: /** @type {'radio'} */ ('radio') }] };
  const e = departMarcheur(m);
  assert.deepEqual([e.x, e.z], [0, 0]);
  avancerMarcheur(m, e, 1); assert.ok(Math.abs(e.x - 1) < 1e-9 && e.vitesse === 1);
  avancerMarcheur(m, e, 1.5); assert.equal(e.x, 2); assert.equal(e.vitesse, 0); assert.equal(e.bras, 'radio'); assert.equal(e.cap, 0.5);
  avancerMarcheur(m, e, 0.6); assert.equal(e.k, 0, 'la pause finie, il repart vers le premier point');
});
