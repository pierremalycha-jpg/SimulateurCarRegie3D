// L'entrepôt, groupe « panasonic » : les caméras AW-HE130 et AW-HE20, le pupitre AW-RP150 (catalogue/panasonic.js)
// et le mélangeur Ross Carbonite Black Solo 13 (catalogue/ross.js). Chaque modèle : ses ports (sérigraphie,
// signaux, PoE+, boucle thru), son interface d'usine, ses services, les clés exactes de sa configuration
// d'usine, ses faces, et ce qu'il devient dans un montage (sortir, câbler, alimenter).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/dom.mjs';
import { PANASONIC } from '../../src/entrepot/catalogue/panasonic.js';
import { ROSS } from '../../src/entrepot/catalogue/ross.js';
import { CATALOGUE, compatibles, portOf } from '../../src/entrepot/catalogue/index.js';
import { B, vider, sortir, relier, regler, setSaving } from '../../src/entrepot/build.js';
import { evaluate } from '../../src/entrepot/engine.js';

setSaving(false);
const P = (m, id) => { const p = m.ports.find((x) => x.id === id); assert.ok(p, `${m.id} : port ${id}`); return p; };
const CAM_CFG = ['format', 'sdiOut', 'hdmiOut', 'ndi', 'tally', 'serie', 'irId', 'reseau'];
const FORMATS = ['1080p50', '1080i50', '720p50', '1080p59', '1080i59'];

test('le groupe livre he130, he20, rp150 et carbonite-solo13, tous dans le catalogue commun', () => {
  assert.deepEqual(Object.keys(PANASONIC).sort(), ['he130', 'he20', 'rp150']);
  assert.deepEqual(Object.keys(ROSS), ['carbonite-solo13']);
  for (const id of ['he130', 'he20', 'rp150', 'carbonite-solo13']) { assert.equal(CATALOGUE[id].id, id); assert.ok(CATALOGUE[id].doc && CATALOGUE[id].averifier.length && CATALOGUE[id].specs.length && CATALOGUE[id].boite, id); }
});

test('caméras : ports à la sérigraphie Panasonic, LAN PoE+ qui porte l\'IP, pas de port inventé (pas d\'USB sur le HE130, pas de genlock sur le HE20)', () => {
  for (const id of ['he130', 'he20']) {
    const m = CATALOGUE[id];
    assert.equal(m.famille, 'camera'); assert.equal(m.pose, 'plateau'); assert.equal(m.marque, 'Panasonic');
    assert.deepEqual([P(m, 'sdi-out').sig, P(m, 'sdi-out').dir, P(m, 'sdi-out').kind], ['sdi', 'out', 'bnc']);
    assert.deepEqual([P(m, 'hdmi-out').sig, P(m, 'hdmi-out').dir, P(m, 'hdmi-out').label], ['hdmi', 'out', 'HDMI']);
    const lan = P(m, 'lan'); assert.deepEqual([lan.label, lan.kind, lan.sig, lan.dir, lan.poe, lan.nic], ['LAN', 'rj45', 'ip', 'io', true, true]); assert.ok(lan.watts > 10 && lan.watts <= 30, 'PoE+ : demande en W');
    assert.deepEqual([P(m, 'rs422').kind, P(m, 'rs422').sig, P(m, 'rs422').dir], ['rj45', 'rs422', 'in']); assert.match(P(m, 'rs422').label, /RS-422/);
    assert.deepEqual([P(m, 'rs232-in').kind, P(m, 'rs232-in').sig, P(m, 'rs232-in').dir, P(m, 'rs232-in').label], ['minidin8', 'rs232', 'in', 'RS-232C IN']);
    assert.deepEqual([P(m, 'rs232-out').dir, P(m, 'rs232-out').label], ['out', 'RS-232C OUT']);
    assert.deepEqual([P(m, 'audio-in').sig, P(m, 'audio-in').dir, P(m, 'audio-in').label], ['audio', 'in', 'AUDIO IN']);
    assert.deepEqual([P(m, 'dc').sig, P(m, 'dc').dir, P(m, 'dc').label], ['dc12', 'in', 'DC 12V IN']); assert.ok(P(m, 'dc').watts > 0);
    assert.deepEqual(m.reseau, { dhcp: false, ip: '192.168.0.10', mask: '255.255.255.0', gw: '192.168.0.1' });
    assert.deepEqual(m.formats, ['1080i50', '1080p50', '720p50', '1080i59', '1080p59']);
    assert.ok(m.watts > 0 && m.watts < 40 && m.prix > 0);
    assert.ok(m.boite.w > 0.1 && m.boite.w < 0.3 && m.boite.h > 0.1 && m.boite.h < 0.3, 'une tête PTZ');
    const S = Object.fromEntries(m.services.map((s) => [s.id, s]));
    assert.deepEqual([S['ptz-http'].role, S['ptz-http'].port, S.web.role, S.web.port, S['tally-ip'].role, S.ndi.role], ['serveur', 80, 'serveur', 80, 'serveur', 'serveur']);
    assert.ok(m.faces.arriere && m.faces.avant);
  }
  const he130 = CATALOGUE.he130, he20 = CATALOGUE.he20;
  assert.equal(P(he130, 'gl-in').sig, 'ref'); assert.equal(P(he130, 'gl-in').label, 'G/L IN'); assert.ok(!he130.ports.some((p) => p.sig === 'usb'), 'le HE130 n\'a pas d\'USB');
  assert.equal(P(he20, 'usb').sig, 'usb'); assert.equal(P(he20, 'usb').kind, 'usbc'); assert.ok(!he20.ports.some((p) => p.sig === 'ref'), 'le HE20 n\'a pas de genlock');
  assert.ok(!he130.services.some((s) => s.id === 'rtmp') && he20.services.some((s) => s.id === 'rtmp' && s.role === 'client'));
  assert.ok(he130.prix > he20.prix);
});

test('caméras : la configuration d\'usine a exactement les clés du brief (rtmp seulement sur le HE20)', () => {
  const he130 = CATALOGUE.he130.cfg, he20 = CATALOGUE.he20.cfg;
  assert.deepEqual(Object.keys(he130).sort(), [...CAM_CFG].sort());
  assert.deepEqual(Object.keys(he20).sort(), [...CAM_CFG, 'rtmp'].sort());
  for (const c of [he130, he20]) {
    assert.ok(FORMATS.includes(c.format)); assert.equal(c.format, '1080i50');
    assert.deepEqual([c.sdiOut, c.hdmiOut, c.ndi, c.tally, c.serie, c.irId], [true, true, false, 'ip', 'rs422', 1]);
    assert.deepEqual(c.reseau, { dhcp: false, ip: '192.168.0.10', mask: '255.255.255.0', gw: '192.168.0.1' });
  }
  assert.equal(he20.rtmp, false);
  assert.notEqual(he130.reseau, he20.reseau, 'chaque modèle a son propre objet reseau');
});

test('RP150 : cinq ports SERIAL CONT, IP CONT PoE+, SDI actif avec boucle THRU OUT, TALLY/GPIO 1 et GPIO 2 en D-sub 25, 12 V en XLR 4', () => {
  const m = CATALOGUE.rp150;
  assert.deepEqual([m.famille, m.pose, m.marque], ['pupitre', 'table', 'Panasonic']);
  const serie = m.ports.filter((p) => p.sig === 'rs422');
  assert.equal(serie.length, 5, 'le RP150 a cinq ports série');
  serie.forEach((p, i) => { assert.equal(p.id, 'serial-' + (i + 1)); assert.equal(p.label, `SERIAL CONT ${i + 1}`); assert.deepEqual([p.kind, p.dir], ['rj45', 'out']); });
  const lan = P(m, 'lan'); assert.deepEqual([lan.label, lan.kind, lan.sig, lan.dir, lan.poe, lan.nic], ['IP CONT', 'rj45', 'ip', 'io', true, true]); assert.ok(lan.watts > 0);
  assert.deepEqual([P(m, 'sdi-in').label, P(m, 'sdi-in').dir, P(m, 'sdi-in').thru], ['3G SDI ACTIVE IN', 'in', 'sdi-thru']);
  assert.deepEqual([P(m, 'sdi-thru').label, P(m, 'sdi-thru').dir, P(m, 'sdi-thru').sig], ['THRU OUT', 'out', 'sdi']);
  assert.deepEqual([P(m, 'gpio1').label, P(m, 'gpio1').kind, P(m, 'gpio1').sig, P(m, 'gpio1').dir], ['TALLY/GPIO 1', 'dsub25', 'tally', 'in']);
  assert.deepEqual([P(m, 'gpio2').label, P(m, 'gpio2').kind, P(m, 'gpio2').sig], ['GPIO 2', 'dsub25', 'gpio']);
  assert.deepEqual([P(m, 'dc').kind, P(m, 'dc').sig, P(m, 'dc').dir], ['xlr4', 'dc12', 'in']);
  assert.equal(m.ports.length, 11);
  assert.deepEqual(m.reseau, { dhcp: false, ip: '192.168.0.9', mask: '255.255.255.0', gw: '192.168.0.1' });
  const S = Object.fromEntries(m.services.map((s) => [s.id, s]));
  assert.deepEqual([S['ptz-http'].role, S['ptz-http'].port, S['tally-ip'].role], ['client', 80, 'client']);
  assert.ok(!m.formats, 'un pupitre n\'a pas de format vidéo');
  assert.ok(m.boite.w > 0.3 && m.boite.w < 0.4 && m.watts > 0 && m.prix > 0);
});

test('RP150 : la configuration d\'usine a exactement les clés du brief, dix emplacements de caméra', () => {
  const c = CATALOGUE.rp150.cfg;
  assert.deepEqual(Object.keys(c).sort(), ['cameras', 'reseau', 'tallyIn', 'tallyIp']);
  assert.equal(c.cameras.length, 10);
  c.cameras.forEach((s, i) => { assert.deepEqual(Object.keys(s).sort(), ['ip', 'mode', 'port', 'slot']); assert.equal(s.slot, i + 1); assert.ok(['ip', 'serial', 'off'].includes(s.mode)); assert.equal(s.ip, ''); assert.equal(s.port, 80); });
  assert.equal(c.tallyIp, true); assert.equal(c.tallyIn, 'gpio1');
  assert.deepEqual(c.reseau, { dhcp: false, ip: '192.168.0.9', mask: '255.255.255.0', gw: '192.168.0.1' });
});

test('Carbonite Black Solo 13 : 12 SDI + HDMI en entrée, 5 SDI + HDMI en sortie, AES, REF IN, TALLY et GPI en D-sub 25, Ethernet, série, secteur ; posé sur la table', () => {
  const m = CATALOGUE['carbonite-solo13'];
  assert.deepEqual([m.famille, m.pose, m.marque], ['melangeur', 'table', 'Ross Video']);
  const sdiIn = m.ports.filter((p) => p.sig === 'sdi' && p.dir === 'in'), sdiOut = m.ports.filter((p) => p.sig === 'sdi' && p.dir === 'out');
  assert.equal(sdiIn.length, 12); sdiIn.forEach((p, i) => { assert.equal(p.id, 'sdi-in-' + (i + 1)); assert.equal(p.label, `IN ${i + 1}`); assert.equal(p.kind, 'bnc'); });
  assert.equal(sdiOut.length, 5); sdiOut.forEach((p, i) => { assert.equal(p.id, 'sdi-out-' + (i + 1)); assert.equal(p.label, `OUT ${i + 1}`); });
  assert.deepEqual([P(m, 'hdmi-in').sig, P(m, 'hdmi-in').dir, P(m, 'hdmi-out').dir], ['hdmi', 'in', 'out']);
  assert.deepEqual([P(m, 'aes-out').sig, P(m, 'aes-out').dir, P(m, 'aes-out').label], ['aes', 'out', 'AES']);
  assert.deepEqual([P(m, 'ref-in').sig, P(m, 'ref-in').dir, P(m, 'ref-in').label], ['ref', 'in', 'REF IN']);
  assert.deepEqual([P(m, 'tally').kind, P(m, 'tally').sig, P(m, 'tally').dir], ['dsub25', 'tally', 'out']);
  assert.deepEqual([P(m, 'gpi').kind, P(m, 'gpi').sig], ['dsub25', 'gpio']);
  assert.deepEqual([P(m, 'lan').sig, P(m, 'lan').nic, P(m, 'lan').poe], ['ip', true, undefined]);
  assert.equal(P(m, 'rs422').sig, 'rs422');
  assert.deepEqual([P(m, 'iec').sig, P(m, 'iec').dir], ['secteur', 'in']); assert.ok(P(m, 'iec').watts > 0);
  assert.equal(m.ports.length, 12 + 1 + 5 + 1 + 1 + 1 + 2 + 2 + 1);
  assert.deepEqual(m.reseau, { dhcp: false, ip: '192.168.0.123', mask: '255.255.255.0', gw: '192.168.0.1' });
  const S = Object.fromEntries(m.services.map((s) => [s.id, s]));
  assert.deepEqual([S.rosstalk.role, S.rosstalk.port, S.dashboard.role, S.dashboard.port], ['serveur', 7788, 'serveur', 5253]);
  assert.deepEqual(m.formats, ['1080i50', '1080p50', '720p50', '1080i59', '1080p59']);
  assert.ok(m.watts > 50 && m.watts < 200 && m.prix > 5000);
  assert.ok(!m.u, 'tout en un sur la table : pas de hauteur en U');
});

test('Carbonite : la configuration d\'usine a exactement les clés du brief ; 13 entrées, tally n ↔ entrée n', () => {
  const c = CATALOGUE['carbonite-solo13'].cfg;
  assert.deepEqual(Object.keys(c).sort(), ['entrees', 'format', 'multiview', 'pgm', 'pvw', 'reseau', 'tally']);
  assert.equal(c.format, '1080i50'); assert.ok(FORMATS.includes(c.format));
  assert.deepEqual(Object.keys(c.entrees).map(Number), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
  for (const e of Object.values(c.entrees)) assert.ok(e.nom);
  assert.equal(c.pgm, 1); assert.equal(c.pvw, 2); assert.equal(typeof c.multiview, 'string');
  for (const [n, e] of Object.entries(c.tally)) assert.equal(Number(n), e);
  assert.deepEqual(c.reseau, { dhcp: false, ip: '192.168.0.123', mask: '255.255.255.0', gw: '192.168.0.1' });
});

test('faces : chaque élément « port » pointe sur un port du modèle, et chaque port câblable a sa place sur la face arrière', () => {
  for (const id of ['he130', 'he20', 'rp150', 'carbonite-solo13']) {
    const m = CATALOGUE[id]; const ids = new Set(m.ports.map((p) => p.id));
    const dessines = new Set();
    for (const f of Object.values(m.faces)) { assert.ok(f.w > 0 && f.h > 0 && f.label); for (const it of f.items) { if (it.t === 'port') { assert.ok(ids.has(it.id), `${id} : ${it.id}`); assert.ok(!dessines.has(it.id), `${id} : ${it.id} dessiné deux fois`); dessines.add(it.id); assert.ok(it.k && it.l && it.x > 0 && it.y > 0); } } }
    for (const p of m.ports) assert.ok(dessines.has(p.id), `${id} : ${p.id} absent des faces`);
  }
});

test('ce qui se branche sur quoi : SDI caméra → IN du Solo, RS-422 pupitre → CONTROL IN, TALLY du Solo → TALLY/GPIO 1, PoE+ ; ce qui ne se branche pas', () => {
  const ok = (a, b) => compatibles(portOf(a[0], a[1]), portOf(b[0], b[1])).ok;
  assert.ok(ok(['he130', 'sdi-out'], ['carbonite-solo13', 'sdi-in-1']));
  assert.ok(ok(['he20', 'hdmi-out'], ['carbonite-solo13', 'hdmi-in']));
  assert.ok(ok(['rp150', 'serial-1'], ['he130', 'rs422']));
  assert.ok(ok(['rp150', 'serial-5'], ['he20', 'rs422']));
  assert.ok(ok(['carbonite-solo13', 'tally'], ['rp150', 'gpio1']));
  assert.ok(ok(['carbonite-solo13', 'sdi-out-1'], ['rp150', 'sdi-in']));
  assert.ok(ok(['he130', 'rs232-out'], ['he20', 'rs232-in']), 'chaînage RS-232C');
  assert.ok(ok(['carbonite-solo13', 'iec'], ['mur', 'prise1']));
  assert.ok(!ok(['he130', 'sdi-out'], ['carbonite-solo13', 'hdmi-in']), 'SDI sur HDMI');
  assert.ok(!ok(['he130', 'sdi-out'], ['he20', 'sdi-out']), 'deux sorties');
  assert.ok(!ok(['rp150', 'serial-1'], ['he130', 'lan']), 'série sur réseau');
  assert.ok(!ok(['carbonite-solo13', 'gpi'], ['rp150', 'gpio1']), 'GPI sur tally');
  assert.ok(!ok(['he130', 'gl-in'], ['carbonite-solo13', 'sdi-out-1']), 'SDI sur le genlock');
});

test('dans un montage : trois caméras sortent avec l\'adresse d\'usine et des noms CAM n ; la Solo 13 au secteur s\'allume ; une caméra sur une prise 12 V d\'un appareil allumé aussi ; la cfg est une copie', () => {
  vider('');
  const c1 = sortir('he130').uid, c2 = sortir('he130').uid, c3 = sortir('he20').uid;
  const cams = B.appareils.filter((a) => a.uid !== 'mur');
  assert.deepEqual(cams.map((a) => a.nom), ['CAM 1', 'CAM 2', 'CAM 3']);
  assert.deepEqual(cams.map((a) => a.place.zone), ['plateau', 'plateau', 'plateau']);
  assert.ok(cams.every((a) => a.cfg.reseau.ip === '192.168.0.10'), 'toutes à l\'adresse d\'usine : le conflit classique');
  regler(c1, { 'reseau.ip': '192.168.0.11' });
  assert.equal(CATALOGUE.he130.cfg.reseau.ip, '192.168.0.10', 'le catalogue n\'est pas modifié');
  assert.equal(B.appareils.find((a) => a.uid === c2).cfg.reseau.ip, '192.168.0.10');
  const solo = sortir('carbonite-solo13'); assert.ok(solo.ok); assert.equal(B.appareils.find((a) => a.uid === solo.uid).place.zone, 'table');
  const rp = sortir('rp150'); assert.ok(rp.ok); assert.equal(B.appareils.find((a) => a.uid === rp.uid).place.slot, 2);
  assert.ok(relier({ dev: solo.uid, port: 'iec' }, { dev: 'mur', port: 'prise1' }).ok);
  assert.ok(relier({ dev: c1, port: 'sdi-out' }, { dev: solo.uid, port: 'sdi-in-1' }).ok);
  assert.ok(relier({ dev: c3, port: 'sdi-out' }, { dev: solo.uid, port: 'sdi-in-3' }).ok);
  assert.ok(relier({ dev: solo.uid, port: 'tally' }, { dev: rp.uid, port: 'gpio1' }).ok);
  assert.ok(relier({ dev: rp.uid, port: 'serial-1' }, { dev: c1, port: 'rs422' }).ok);
  assert.ok(!relier({ dev: rp.uid, port: 'serial-1' }, { dev: c2, port: 'rs422' }).ok, 'un port série par caméra');
  assert.ok(relier({ dev: rp.uid, port: 'serial-2' }, { dev: c2, port: 'rs422' }).ok);
  const E = evaluate(B);
  assert.ok(E.power[solo.uid].on && /secteur/.test(E.power[solo.uid].source));
  assert.ok(!E.power[c1].on && /Aucune alimentation/.test(E.power[c1].why), 'la caméra sans PoE+ ni 12 V est éteinte');
  assert.ok(!E.power[rp.uid].on, 'le pupitre sans 12 V ni PoE+ est éteint');
  assert.ok(Object.values(E.cables).every((c) => c.ok));
  assert.ok(E.alertes.some((a) => a.dev === c1 && /alimentation/i.test(a.msg)));
});
