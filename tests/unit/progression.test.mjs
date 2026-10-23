// La progression du stagiaire (src/shared.js) : numéro de version et mise à niveau d'une progression
// ancienne ou abîmée, fusion entre deux appareils (une réussite « seul » reste acquise), export dans un
// fichier et import qui fusionne sans rien effacer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/dom.mjs';
import { PROG, PROG_VERSION, migrateProgress, mergeProgress, exportProgress, importProgress, EXPORT_FORMAT, IMPORT_MAX } from '../../src/shared.js';
import { activityState } from '../../src/livret.js';

test('mise à niveau : une progression sans numéro (v19.3) prend la version actuelle, les champs abîmés sont remis à vide', () => {
  assert.equal(migrateProgress(null), null);
  assert.equal(migrateProgress([1, 2]), null);
  assert.equal(migrateProgress('texte'), null);
  const old = { missions: { m1: true }, visited: 'abîmé', scenarios: null, cours: { 'signal-422': { seen: true, quiz: { score: 3, total: 3 } } }, net: { missions: [] } };
  const p = migrateProgress(old);
  assert.equal(p.v, PROG_VERSION);
  assert.deepEqual(p.missions, { m1: true });
  assert.deepEqual(p.visited, {});
  assert.deepEqual(p.scenarios, []);
  assert.deepEqual(p.net, { missions: {}, quiz: [], exams: [] });
  assert.equal(p.cours['signal-422'].quiz.score, 3);
  assert.notEqual(p, old, 'une copie : l\'original n\'est pas touché');
  assert.equal(old.visited, 'abîmé');
  // écrite par une version plus récente : son numéro et ses champs inconnus restent
  const next = migrateProgress({ v: PROG_VERSION + 3, demain: { x: 1 } });
  assert.equal(next.v, PROG_VERSION + 3);
  assert.deepEqual(next.demain, { x: 1 });
});

test('fusion : un parcours réussi seul sur un appareil le reste, une mission réseau garde ses meilleurs points', () => {
  PROG.tutor = { 'chef-lineup': { done: true, aided: 2 } };
  PROG.net = { missions: { n1: { pts: 4, aided: true } }, quiz: [], exams: [] };
  mergeProgress({ tutor: { 'chef-lineup': { done: true, aided: 0, clean: true }, 'chef-cablage': { done: true, aided: 1 } }, net: { missions: { n1: { pts: 9, aided: false, clean: true }, n2: { pts: 7 } } } });
  assert.equal(PROG.tutor['chef-lineup'].clean, true);
  assert.equal(activityState(PROG, 'parcours', 'chef-lineup').done, true, 'réussi seul ailleurs : compte ici');
  assert.equal(activityState(PROG, 'parcours', 'chef-cablage').done, false, 'terminé avec aide : à refaire seul');
  assert.equal(PROG.net.missions.n1.pts, 9);
  assert.equal(PROG.net.missions.n1.clean, true);
  assert.equal(PROG.net.missions.n2.pts, 7);
  // l'inverse : une copie aidée venue d'ailleurs n'efface pas la réussite seule d'ici
  mergeProgress({ tutor: { 'chef-lineup': { done: true, aided: 3 } } });
  assert.equal(activityState(PROG, 'parcours', 'chef-lineup').done, true);
});

test('export puis import : le fichier se relit et fusionne sans rien effacer', () => {
  PROG.cours = { 'sdi-oeil': { seen: true, quiz: { score: 3, total: 3 } } };
  const text = exportProgress('19.4.0');
  const d = JSON.parse(text);
  assert.equal(d.format, EXPORT_FORMAT);
  assert.equal(d.v, PROG_VERSION);
  assert.equal(d.app, '19.4.0');
  assert.equal(d.progression.cours['sdi-oeil'].quiz.score, 3);
  // l'autre ordinateur a une autre leçon et un moins bon score sur la première
  d.progression.cours = { 'sdi-oeil': { seen: true, quiz: { score: 1, total: 3 } }, 'son-n1': { seen: true, quiz: { score: 3, total: 3 } } };
  const r = importProgress(JSON.stringify(d));
  assert.ok(r.ok, r.error);
  assert.equal(PROG.cours['sdi-oeil'].quiz.score, 3, 'le meilleur score reste');
  assert.equal(PROG.cours['son-n1'].quiz.score, 3, 'la leçon de l\'autre ordinateur arrive');
  // une progression brute (document du serveur) s'importe aussi
  assert.ok(importProgress(JSON.stringify({ missions: { m2: true } })).ok);
  assert.equal(PROG.missions.m2, true);
});

test('import : les fichiers qui ne sont pas une progression sont refusés, avec la raison', () => {
  for (const [text, why] of [['', /vide/], ['{pas du json', /illisible/], ['[1,2,3]', /ne contient pas/], ['{"nom":"Dupont"}', /ne contient pas/], [JSON.stringify({ format: EXPORT_FORMAT, progression: 'x' }), /ne contient pas/], ['x'.repeat(IMPORT_MAX + 1), /trop gros/]]) {
    const r = importProgress(text);
    assert.equal(r.ok, false, String(text).slice(0, 30));
    assert.match(r.error, why);
  }
});
