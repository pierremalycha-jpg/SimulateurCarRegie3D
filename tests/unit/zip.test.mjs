// Archives « réseau local » : l'écrivain de la construction (tools/zip.mjs, deflate) et celui de
// la page publiée (src/multi/lankit.js, sans compression) relus par un lecteur indépendant :
// noms UTF-8, contenus, CRC (zlib.crc32 de Node) et droits d'exécution des lanceurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { makeZip } from '../../tools/zip.mjs';
import { zipStore } from '../../src/multi/lankit.js';

function readZip(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(eocd >= 0, 'fin de répertoire central');
  const n = buf.readUInt16LE(eocd + 10), cdOff = buf.readUInt32LE(eocd + 16);
  const out = [];
  for (let i = 0, p = cdOff; i < n; i++) {
    assert.equal(buf.readUInt32LE(p), 0x02014b50, 'entrée du répertoire central');
    const flags = buf.readUInt16LE(p + 8), method = buf.readUInt16LE(p + 10), crc = buf.readUInt32LE(p + 16), csize = buf.readUInt32LE(p + 20), size = buf.readUInt32LE(p + 24);
    const nl = buf.readUInt16LE(p + 28), xl = buf.readUInt16LE(p + 30), cl = buf.readUInt16LE(p + 32), attr = buf.readUInt32LE(p + 38), lo = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nl).toString('utf8');
    assert.equal(buf.readUInt32LE(lo), 0x04034b50, `${name} : en-tête local`);
    const start = lo + 30 + buf.readUInt16LE(lo + 26) + buf.readUInt16LE(lo + 28);
    const raw = buf.subarray(start, start + csize);
    const data = method === 8 ? zlib.inflateRawSync(raw) : method === 0 ? raw : assert.fail('méthode ' + method);
    assert.equal(data.length, size, `${name} : taille`);
    assert.equal(zlib.crc32(data), crc, `${name} : CRC`);
    out.push({ name, data, utf8: !!(flags & 0x0800), mode: attr >>> 16 });
    p += 46 + nl + xl + cl;
  }
  return out;
}
const ENTRIES = [
  { name: 'car-regie-reseau-local/LISEZMOI.txt', data: 'Mode d\'emploi — réseau local\n' },
  { name: 'car-regie-reseau-local/Lancer le serveur (Windows).bat', data: '@echo off\r\nnode car-regie-serveur-lan.mjs\r\n' },
  { name: 'car-regie-reseau-local/lancer-serveur.sh', data: '#!/bin/sh\nnode car-regie-serveur-lan.mjs\n', exec: true },
  { name: 'car-regie-reseau-local/données.bin', data: Buffer.from(Array.from({ length: 70000 }, (_, i) => (i * 7919) & 255)) },
];
const check = (files) => {
  assert.equal(files.length, ENTRIES.length);
  ENTRIES.forEach((e, i) => {
    assert.equal(files[i].name, e.name);
    assert.ok(files[i].utf8, 'drapeau UTF-8');
    assert.ok(files[i].data.equals(Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data, 'utf8')), `${e.name} : contenu`);
    assert.equal(files[i].mode, e.exec ? 0o100755 : 0o100644, `${e.name} : droits`);
  });
};

test('archive de la construction (deflate)', () => check(readZip(makeZip(ENTRIES))));

test('archive assemblée dans la page (sans compression)', async () => {
  const blob = zipStore(ENTRIES.map((e) => ({ ...e, data: Buffer.isBuffer(e.data) ? new Uint8Array(e.data) : e.data })));
  assert.equal(blob.type, 'application/zip');
  check(readZip(Buffer.from(await blob.arrayBuffer())));
});
