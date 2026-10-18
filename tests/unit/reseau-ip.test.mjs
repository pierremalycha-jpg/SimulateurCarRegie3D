// Modèle du réseau ST 2110 (src/net/fabric.js) et pannes réseau (src/ipnet.js) : topologie
// rouge / bleu, redondance ST 2022-7, PTP, et cycle injection → effet → réparation de chaque panne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshFabric, settle, rxLost, rxUnprotected } from '../helpers/net.mjs';
import { FAB, delivery, camPtpOk, setSwitchPower, ipToInt, inSubnet, loadReference, loadFactory, writeMemory, clone, vlanOf, subnetOf, p2p } from '../../src/net/fabric.js';
import { IP_FAULTS, clearNetFaults, NET } from '../../src/ipnet.js';

test('adressage : conversions et sous-réseaux', () => {
  assert.equal(ipToInt('10.1.1.20'), (10 << 24 | 1 << 16 | 1 << 8 | 20) >>> 0);
  assert.ok(inSubnet('10.1.1.20', '10.1.1.0/24'));
  assert.ok(!inSubnet('10.2.1.20', '10.1.1.0/24'));
  assert.ok(inSubnet('239.1.1.1', '239.0.0.0/8'));
  assert.equal(vlanOf('red', 1), 101); assert.equal(vlanOf('blue', 1), 201);
  assert.equal(subnetOf('blue', 3), '10.2.3.0/24');
  // liens point à point spine-leaf : /31 distincts
  const a = p2p('red', 1, 1, 0), b = p2p('red', 1, 1, 1);
  assert.notEqual(a.spine, b.spine); assert.equal(ipToInt(a.leaf) - ipToInt(a.spine), 1);
});

test('réseau sain : 17 commutateurs, tous les flux reçus deux fois, PTP verrouillé', () => {
  const F = freshFabric('HD');
  assert.equal(Object.keys(F.switches).length, 17);
  assert.deepEqual(F.issues, []);
  assert.deepEqual(rxLost(), []);
  assert.deepEqual(rxUnprotected(), []);
  const d = delivery('CAM1', 'ME1');
  assert.ok(d.ok && d.protected);
  assert.equal(d.per.red.group, '239.1.1.1'); assert.equal(d.per.blue.group, '239.2.1.1');
  for (const id of [1, 2, 3, 4, 5, 6]) assert.ok(camPtpOk(id), `PTP caméra ${id}`);
  for (const c of ['red', 'blue']) { const gm = F.res.gmActive[c]; assert.equal(gm.id, 'gm1'); assert.ok(gm.traceable); }
});

test('« charger la référence » rend la configuration de service, « usine » efface tout', () => {
  const F = freshFabric();
  for (const sw of Object.values(F.switches)) {
    const before = clone(sw.running);
    sw.running.ptp.domain = 0; sw.running.hostname = 'x';
    loadReference(sw.id);
    assert.deepEqual(sw.running, before, sw.id);
  }
  loadFactory('LEAF-R1'); settle();
  // leaf caméras rouge remise en usine : plus de VLAN ni de routage, le bleu prend le relais
  assert.deepEqual(rxLost(), []);
  assert.ok(rxUnprotected().includes('ME1'), 'CAM 1 n\'arrive plus que par le bleu');
  writeMemory('LEAF-R1');
  assert.deepEqual(F.switches['LEAF-R1'].startup, F.switches['LEAF-R1'].running);
});

test('ST 2022-7 : perte des spines rouges sans effet à l\'image, perte des deux réseaux = image perdue', () => {
  freshFabric();
  setSwitchPower('SPINE-R1', false); setSwitchPower('SPINE-R2', false); settle();
  assert.deepEqual(rxLost(), [], 'le bleu suffit');
  assert.ok(rxUnprotected().includes('ME1'), 'plus de secours');
  assert.ok(FAB.issues.some((i) => i.sev === 'err' && /spine-r1/i.test(i.title)));
  setSwitchPower('SPINE-B1', false); setSwitchPower('SPINE-B2', false); settle();
  const d = delivery('CAM1', 'ME1');
  assert.equal(d.ok, false); assert.equal(d.loss, 1);
  assert.match(d.reason, /spine/);
});

test('UHD : le réseau tient la charge (aucune perte)', () => {
  freshFabric('UHD');
  assert.deepEqual(rxLost(), []);
  assert.deepEqual(rxUnprotected(), []);
});

for (const f of IP_FAULTS) {
  test(`panne « ${f.label} » (${f.id}) : visible tant qu'elle n'est pas réparée`, () => {
    freshFabric();
    assert.ok(f.can(), 'injectable sur un réseau sain');
    const st = f.inject() || {};
    settle();
    // le temporisateur du querier IGMP expire au bout de QUERIER_TIMEOUT : on l'avance
    if (f.id === 'querier') { for (const k of Object.keys(FAB.timers)) FAB.timers[k] = 60; settle(); }
    assert.equal(f.check(st), false, 'la panne est détectée comme active');
    assert.ok(f.hint && f.hint.length > 40, 'piste de dépannage pour le stagiaire');
    clearNetFaults(); settle();
    assert.equal(f.check(st), true, '« tout réparer » la résout');
    assert.deepEqual(rxLost(), []);
    assert.ok(!NET.rogue && NET.nmos);
  });
}
