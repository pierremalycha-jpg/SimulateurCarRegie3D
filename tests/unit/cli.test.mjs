// Ligne de commande des commutateurs (src/net/cli.js) : modes, abréviations, filtres, aide,
// et dépannage d'une panne réseau au clavier, comme un stagiaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { freshFabric, settle, rxLost } from '../helpers/net.mjs';
import { FAB, camPtpOk } from '../../src/net/fabric.js';
import { cliSession, cliPrompt, runCli, cliComplete, runningConfig } from '../../src/net/cli.js';
import { IP_FAULTS } from '../../src/ipnet.js';

const typeAll = (s, lines) => lines.map((l) => runCli(s, l));

test('invite et modes : exec → config → interface → end', () => {
  freshFabric();
  const s = cliSession('LEAF-R1');
  assert.equal(cliPrompt(s), 'leaf-r1-cam#');
  runCli(s, 'conf t'); assert.equal(cliPrompt(s), 'leaf-r1-cam(config)#');
  runCli(s, 'int e2'); assert.equal(cliPrompt(s), 'leaf-r1-cam(config-if-Et2)#');
  runCli(s, 'exit'); assert.equal(cliPrompt(s), 'leaf-r1-cam(config)#');
  runCli(s, 'int e3'); runCli(s, 'end'); assert.equal(cliPrompt(s), 'leaf-r1-cam#');
});

test('abréviations, filtres et erreurs', () => {
  freshFabric();
  const s = cliSession('LEAF-R1');
  const full = runCli(s, 'show interfaces status');
  assert.equal(runCli(s, 'sh int st'), full);
  assert.match(full, /Et1\s+CCU 1\s+connected/);
  const inc = runCli(s, 'sh int st | inc connected');
  assert.ok(inc.split('\n').every((l) => /connected/.test(l)) && inc.length > 0);
  assert.match(runCli(s, 'sh xyz'), /Entrée invalide/);
  assert.match(runCli(s, 'show ip ospf neighbor'), /FULL/);
  assert.ok(runCli(s, '?').split('\n').length > 5, 'aide « ? »');
  assert.equal(cliComplete(s, 'sh ip ig'), 'sh ip igmp ', 'complétion (Tab) suivie d\'un espace, comme sur un vrai commutateur');
});

test('shutdown / no shutdown d\'un port de CCU', () => {
  freshFabric();
  const s = cliSession('LEAF-R1');
  typeAll(s, ['conf t', 'int e2', 'shutdown', 'end']);
  assert.match(runCli(s, 'sh int e2 st'), /disabled/);
  settle();
  assert.equal(FAB.res.nic['ccu2:red'].up, false);
  typeAll(s, ['conf t', 'int e2', 'no shutdown', 'end']);
  settle();
  assert.equal(FAB.res.nic['ccu2:red'].up, true);
});

test('configuration en service et sauvegarde', () => {
  freshFabric();
  const s = cliSession('SPINE-R1');
  const rc = runningConfig(FAB.switches['SPINE-R1']);
  assert.match(rc, /hostname spine-r1/);
  assert.match(rc, /ptp domain 127/);
  typeAll(s, ['conf t', 'hostname spine-r1-test', 'end']);
  assert.equal(cliPrompt(s), 'spine-r1-test#');
  assert.notDeepEqual(FAB.switches['SPINE-R1'].startup, FAB.switches['SPINE-R1'].running);
  runCli(s, 'write memory');
  assert.deepEqual(FAB.switches['SPINE-R1'].startup, FAB.switches['SPINE-R1'].running);
});

test('commutateur hors tension : plus de console', () => {
  freshFabric();
  FAB.switches['LEAF-R3'].power = false;
  assert.match(runCli(cliSession('LEAF-R3'), 'sh ver'), /hors tension/);
});

test('dépannage au clavier : mauvais domaine PTP sur les leaves caméras', () => {
  freshFabric();
  const f = IP_FAULTS.find((x) => x.id === 'ptpdom');
  const st = f.inject(); settle();
  assert.ok(![1, 2, 3, 4].every(camPtpOk), 'des caméras décrochées');
  for (const sw of ['LEAF-R1', 'LEAF-B1']) typeAll(cliSession(sw), ['conf t', 'ptp domain 127', 'end', 'wr']);
  settle();
  assert.ok(f.check(st), 'panne résolue');
  for (const id of [1, 2, 3, 4, 5, 6]) assert.ok(camPtpOk(id), `PTP caméra ${id}`);
});

test('dépannage au clavier : CCU dans le mauvais VLAN', () => {
  freshFabric();
  const f = IP_FAULTS.find((x) => x.id === 'vlanccu');
  const st = f.inject(); settle();
  assert.ok(rxLost().length > 0, 'une caméra perdue');
  const d = FAB.devices[st.dev];
  for (const c of ['red', 'blue']) {
    const port = d.nics[c].port.replace('Ethernet', 'e');
    typeAll(cliSession(d.nics[c].sw), ['conf t', `int ${port}`, `switchport access vlan ${(c === 'red' ? 100 : 200) + d.leaf}`, 'end']);
  }
  settle();
  assert.ok(f.check(st));
  assert.deepEqual(rxLost(), []);
});
