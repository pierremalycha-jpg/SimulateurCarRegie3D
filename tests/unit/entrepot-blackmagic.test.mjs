// L'entrepôt, groupe Blackmagic Design : les six modèles (ATEM HD8 ISO, HyperDeck HD Plus et HD Mini,
// Teranex SDI→Audio et Audio→SDI, GPI & Tally) ont les ports attendus, la configuration d'usine du
// brief (les mêmes clés que le moteur et les panneaux), des faces cohérentes (chaque port dessiné
// une fois, dans le cadre), une interface réseau et des services au vocabulaire commun.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/dom.mjs';
import { BLACKMAGIC } from '../../src/entrepot/catalogue/blackmagic.js';
import { CATALOGUE, compatibles, portOf } from '../../src/entrepot/catalogue/index.js';
import { B, vider, sortir, relier, regler, setSaving } from '../../src/entrepot/build.js';
import { evaluate } from '../../src/entrepot/engine.js';

setSaving(false);
const IDS = ['atem-hd8-iso', 'hyperdeck-hd-plus', 'hyperdeck-hd-mini', 'teranex-sdi-audio', 'teranex-audio-sdi', 'gpi-tally'];
const bad = (t) => !t || /undefined|NaN|\[object|\bnull\b/.test(String(t));
const has = (m, ids) => { for (const id of ids) assert.ok(m.ports.some((p) => p.id === id), `${m.id} : port ${id} attendu`); };
const port = (m, id) => m.ports.find((p) => p.id === id);
const keys = (o) => Object.keys(o).sort();

test('blackmagic : les six modèles sont dans le registre, avec marque, documentation, prix, consommation, boîte et points à vérifier', () => {
  assert.deepEqual(keys(BLACKMAGIC), [...IDS].sort());
  for (const id of IDS) {
    const m = CATALOGUE[id];
    assert.ok(m && m.id === id, id);
    assert.equal(m.marque, 'Blackmagic Design');
    assert.ok(!bad(m.doc) && /Blackmagic/.test(m.doc), `${id} : doc`);
    assert.ok(Array.isArray(m.averifier) && m.averifier.length >= 1 && m.averifier.every((t) => !bad(t)), `${id} : averifier`);
    assert.ok(m.prix > 0 && m.watts > 0, `${id} : prix et watts`);
    assert.ok(m.boite && m.boite.w > 0 && m.boite.h > 0 && m.boite.d > 0, `${id} : boîte`);
    assert.ok(m.specs.length >= 3 && m.specs.every((t) => !bad(t)), `${id} : specs`);
    assert.ok(m.faces && m.faces.avant && m.faces.arriere, `${id} : deux faces`);
    assert.ok(m.reseau && m.cfg.reseau, `${id} : interface réseau et cfg.reseau`);
    assert.deepEqual(keys(m.cfg.reseau), ['dhcp', 'gw', 'ip', 'mask'], `${id} : cfg.reseau`);
    assert.deepEqual(m.cfg.reseau, m.reseau, `${id} : cfg.reseau = interface d'usine`);
    for (const p of m.ports) assert.ok(!bad(p.desc) && !bad(p.group), `${id}.${p.id} : desc et groupe`);
    for (const s of m.services || []) assert.ok(['serveur', 'client'].includes(s.role) && ['atem', 'hyperdeck', 'web', 'rtmp'].includes(s.id), `${id} : service ${s.id}`);
    // un seul port secteur / 12 V d'appareil porte la consommation, et il la porte
    const alim = m.ports.filter((p) => (p.sig === 'secteur' || p.sig === 'dc12') && p.dir === 'in');
    assert.ok(alim.length >= 1 && alim.some((p) => p.watts > 0), `${id} : alimentation avec consommation`);
  }
});

test('blackmagic : faces cohérentes : chaque port du modèle est dessiné une fois, dans le cadre, avec le bon dessin', () => {
  const DESSIN = { bnc: 'bnc', hdmi: 'usb', rj45: 'rj45', rj12: 'rj45', xlr3: 'xlr', xlr4: 'xlr', xlr5: 'xlr', rca: 'jack', toslink: 'jack', usbc: 'usb', dsub9: 'dsub9', dsub25: 'dsub25', dc: 'jack', iec: 'iec', sd: 'multi', jack63: 'jack' };
  for (const id of IDS) {
    const m = CATALOGUE[id]; const seen = new Map();
    for (const [name, f] of Object.entries(m.faces)) {
      assert.ok(!bad(f.label) && f.w >= 500 && f.h >= 80, `${id} : face ${name}`);
      assert.ok(f.items.some((it) => it.t === 'body') && f.items.some((it) => it.t === 'text'), `${id} : face ${name} a un corps et un titre`);
      for (const it of f.items) {
        assert.ok(it.x == null || (it.x >= 0 && it.x <= f.w && it.y >= 0 && it.y <= f.h), `${id} : face ${name}, ${it.t} ${it.id || ''} hors cadre`);
        if (it.t !== 'port') continue;
        const p = port(m, it.id); assert.ok(p, `${id} : face ${name}, port ${it.id} inconnu`);
        assert.equal(it.k, DESSIN[p.kind], `${id}.${it.id} : dessin`);
        assert.ok(!bad(it.l), `${id}.${it.id} : étiquette`);
        seen.set(it.id, (seen.get(it.id) || 0) + 1);
      }
    }
    for (const p of m.ports) assert.equal(seen.get(p.id), 1, `${id} : port ${p.id} dessiné ${seen.get(p.id) || 0} fois`);
    // les ports de la face arrière sont ceux que la 3D ancre : il y en a
    assert.ok(m.faces.arriere.items.filter((it) => it.t === 'port').length >= 5, `${id} : face arrière`);
  }
});

test('atem-hd8-iso : 8 entrées SDI, 12 sorties SDI, HDMI, MADI, XLR, casque, 4 Ethernet en switch, 2 USB-C, REF/TC, RS-422, secteur et 12 V ; cfg du brief', () => {
  const m = CATALOGUE['atem-hd8-iso'];
  assert.equal(m.famille, 'melangeur'); assert.equal(m.pose, 'table');
  const N8 = [1, 2, 3, 4, 5, 6, 7, 8];
  has(m, N8.map((n) => `sdi-in-${n}`)); has(m, N8.map((n) => `sdi-out-${n}`));
  has(m, ['sdi-out-pgm', 'sdi-out-aux1', 'sdi-out-aux2', 'sdi-out-mv', 'hdmi-out', 'madi-in', 'madi-out', 'xlr-in-1', 'xlr-in-2', 'rca-in-l', 'rca-in-r', 'headset', 'lan-1', 'lan-2', 'lan-3', 'lan-4', 'usbc-1', 'usbc-2', 'ref-in', 'ref-out', 'tc-in', 'tc-out', 'rs422', 'iec', 'dc']);
  assert.equal(m.ports.filter((p) => p.sig === 'sdi' && p.dir === 'in').length, 8);
  assert.equal(m.ports.filter((p) => p.sig === 'sdi' && p.dir === 'out').length, 12);
  assert.equal(m.ports.filter((p) => p.sig === 'ip' && p.nic).length, 4, 'les quatre ports du switch interne portent l\'adresse');
  assert.equal(port(m, 'sdi-out-pgm').kind, 'bnc'); assert.equal(port(m, 'hdmi-out').kind, 'hdmi'); assert.equal(port(m, 'headset').kind, 'xlr5'); assert.equal(port(m, 'rs422').kind, 'rj12'); assert.equal(port(m, 'dc').kind, 'xlr4');
  assert.equal(port(m, 'madi-in').sig, 'madi'); assert.equal(port(m, 'iec').watts, 100);
  assert.deepEqual(m.reseau, { dhcp: true, ip: '192.168.10.240', mask: '255.255.255.0', gw: '192.168.10.1' });
  assert.deepEqual(keys(m.cfg), ['audio', 'aux', 'entrees', 'format', 'hyperdecks', 'iso', 'multiview', 'pgm', 'pvw', 'reseau', 'stream']);
  assert.equal(m.cfg.format, '1080p50'); assert.equal(m.formats[0], m.cfg.format);
  assert.deepEqual(keys(m.cfg.entrees), N8.map(String)); assert.deepEqual(m.cfg.entrees[1], { nom: 'Cam 1' });
  assert.equal(m.cfg.pgm, 1); assert.equal(m.cfg.pvw, 2); assert.ok(['4', '7', '10', '13', '16'].includes(m.cfg.multiview));
  assert.deepEqual(m.cfg.aux, { 1: 'pgm', 2: 'pgm' }); assert.equal(typeof m.cfg.iso, 'boolean');
  assert.deepEqual(m.cfg.stream, { on: false, service: 'YouTube', cle: '' });
  assert.deepEqual(m.cfg.hyperdecks, [{ ip: '' }, { ip: '' }, { ip: '' }, { ip: '' }]);
  assert.deepEqual(keys(m.cfg.audio), [...N8.map(String), 'mic1', 'mic2']); for (const v of Object.values(m.cfg.audio)) assert.ok(['on', 'afv', 'off'].includes(v));
  assert.equal(m.cfg.reseau.dhcp, true);
  assert.ok(m.services.some((s) => s.id === 'atem' && s.role === 'serveur' && s.port === 9910));
  assert.ok(m.services.some((s) => s.id === 'hyperdeck' && s.role === 'client' && s.port === 9993));
  assert.ok(m.services.some((s) => s.id === 'rtmp' && s.role === 'client'));
  assert.ok(m.faces.avant.items.some((it) => it.t === 'keys') && m.faces.avant.items.some((it) => it.t === 'lever'), 'le pupitre : touches et T-bar');
});

test('hyperdeck-hd-plus : SDI 6G avec boucle, SDI OUT et MON OUT, HDMI in/out, REF, TC, RS-422 in/out, Ethernet, USB-C, 2 SD, casque, secteur, 12 V ; cfg du brief', () => {
  const m = CATALOGUE['hyperdeck-hd-plus'];
  assert.equal(m.famille, 'enregistreur'); assert.equal(m.pose, 'rack'); assert.equal(m.u, 1); assert.equal(m.largeur, 1 / 2);
  has(m, ['sdi-in', 'sdi-loop', 'sdi-out', 'sdi-mon', 'hdmi-in', 'hdmi-out', 'ref-in', 'ref-out', 'tc-in', 'tc-out', 'rs422-in', 'rs422-out', 'lan', 'usbc', 'sd1', 'sd2', 'phones', 'iec', 'dc']);
  assert.equal(m.ports.length, 19);
  assert.equal(port(m, 'sdi-in').thru, 'sdi-loop'); assert.equal(port(m, 'sdi-loop').dir, 'out');
  assert.equal(port(m, 'sd1').kind, 'sd'); assert.equal(port(m, 'sd1').sig, 'media'); assert.equal(port(m, 'usbc').sig, 'usb');
  assert.equal(port(m, 'rs422-in').kind, 'dsub9'); assert.equal(port(m, 'dc').kind, 'xlr4'); assert.ok(port(m, 'lan').nic);
  assert.deepEqual(keys(m.cfg), ['codec', 'distant', 'enregistre', 'media', 'qualite', 'reseau', 'source']);
  assert.equal(m.cfg.source, 'sdi'); assert.ok(['H.264', 'ProRes', 'DNxHD'].includes(m.cfg.codec)); assert.ok(['sd1', 'sd2', 'usb', ''].includes(m.cfg.media));
  assert.equal(m.cfg.distant, false); assert.equal(m.cfg.enregistre, false); assert.equal(m.cfg.reseau.dhcp, true);
  assert.ok(m.services.some((s) => s.id === 'hyperdeck' && s.role === 'serveur' && s.port === 9993));
  assert.ok(m.services.some((s) => s.id === 'web' && s.port === 80));
  assert.ok(m.formats.includes('2160p25'), 'le 6G-SDI monte en Ultra HD');
  assert.ok(m.faces.avant.items.filter((it) => it.t === 'port').map((it) => it.id).includes('sd1'), 'les cartes SD sont en face avant');
});

test('hyperdeck-hd-mini : une entrée 3G-SDI (boucle vers SDI OUT), HDMI OUT seulement, REF, TC, un RS-422, Ethernet, USB-C, 2 SD, secteur et 12 V jack ; cfg du brief', () => {
  const m = CATALOGUE['hyperdeck-hd-mini'];
  assert.equal(m.pose, 'rack'); assert.equal(m.u, 1); assert.equal(m.largeur, 1 / 3);
  has(m, ['sdi-in', 'sdi-out', 'hdmi-out', 'ref-in', 'ref-out', 'tc-in', 'tc-out', 'rs422', 'lan', 'usbc', 'sd1', 'sd2', 'phones', 'iec', 'dc']);
  assert.equal(m.ports.length, 15);
  assert.ok(!port(m, 'hdmi-in'), 'pas d\'entrée HDMI sur le HD Mini');
  assert.equal(port(m, 'sdi-in').thru, 'sdi-out'); assert.equal(port(m, 'dc').kind, 'dc');
  assert.ok(!port(m, 'lan').poe, 'PoE+ non confirmé : non retenu');
  assert.deepEqual(keys(m.cfg), ['codec', 'distant', 'enregistre', 'media', 'qualite', 'reseau', 'source']);
  assert.deepEqual(m.cfg, CATALOGUE['hyperdeck-hd-plus'].cfg, 'les deux HyperDeck sortent du carton avec les mêmes réglages');
  assert.ok(!m.formats.some((f) => /2160/.test(f)), 'le 3G-SDI reste en HD');
});

for (const [id, inOut, sdi2, opt] of [['teranex-sdi-audio', 'out', 'sdi-loop', 'optical-out'], ['teranex-audio-sdi', 'in', 'sdi-out', 'optical-in']]) {
  test(`${id} : SDI IN avec traversée, XLR ×2, RCA ×2, optique, Ethernet PoE+, USB, secteur ; cfg du brief`, () => {
    const m = CATALOGUE[id];
    assert.equal(m.famille, 'convertisseur'); assert.equal(m.pose, 'rack'); assert.equal(m.u, 1); assert.equal(m.largeur, 1 / 3);
    const pre = inOut === 'out' ? 'xlr-out-' : 'xlr-in-'; const rca = inOut === 'out' ? 'rca-out-' : 'rca-in-';
    has(m, ['sdi-in', sdi2, pre + '1', pre + '2', rca + 'l', rca + 'r', opt, 'lan', 'usb', 'iec']);
    assert.equal(m.ports.length, 10);
    assert.equal(port(m, 'sdi-in').thru, sdi2); assert.equal(port(m, sdi2).dir, 'out');
    for (const p of [pre + '1', pre + '2', rca + 'l', rca + 'r']) { assert.equal(port(m, p).dir, inOut); assert.equal(port(m, p).sig, 'audio'); }
    assert.equal(port(m, pre + '1').kind, 'xlr3'); assert.equal(port(m, rca + 'l').kind, 'rca'); assert.equal(port(m, opt).kind, 'toslink'); assert.equal(port(m, opt).sig, 'aes');
    const lan = port(m, 'lan'); assert.ok(lan.nic && lan.poe && lan.watts === 16, 'alimenté par PoE+ : 16 W demandés');
    assert.equal(port(m, 'iec').watts, 16); assert.equal(m.watts, 16);
    assert.deepEqual(keys(m.cfg), ['entree', 'niveau', 'paire', 'reseau']);
    assert.ok(m.cfg.paire >= 1 && m.cfg.paire <= 8); assert.ok(['xlr', 'rca', 'optique', 'aes'].includes(m.cfg.entree)); assert.equal(typeof m.cfg.niveau, 'number');
    assert.equal(m.cfg.reseau.dhcp, true);
    assert.deepEqual(m.services, []);
  });
}

test('gpi-tally : Ethernet avec boucle, USB, D-sub 25 tally/GPI, 12 V ; 192.168.10.2 fixe d\'usine ; client ATEM ; cfg du brief', () => {
  const m = CATALOGUE['gpi-tally'];
  assert.equal(m.pose, 'table');
  has(m, ['lan-1', 'lan-2', 'usb', 'gpio', 'dc']); assert.equal(m.ports.length, 5);
  assert.equal(port(m, 'gpio').kind, 'dsub25'); assert.equal(port(m, 'gpio').sig, 'tally');
  assert.ok(port(m, 'lan-1').nic && port(m, 'lan-2').nic);
  assert.deepEqual(m.reseau, { dhcp: false, ip: '192.168.10.2', mask: '255.255.255.0', gw: '192.168.10.1' });
  assert.deepEqual(keys(m.cfg), ['atemIp', 'reseau', 'sorties']);
  assert.equal(m.cfg.atemIp, ''); assert.equal(m.cfg.sorties, 'entrees 1-8'); assert.equal(m.cfg.reseau.ip, '192.168.10.2'); assert.equal(m.cfg.reseau.dhcp, false);
  assert.deepEqual(m.services.map((s) => [s.id, s.role, s.port]), [['atem', 'client', 9910]]);
});

test('câblage : PGM de l\'ATEM → Teranex embedder → HyperDeck (boucle) → entrée ATEM ; GPI & Tally en Ethernet sur l\'ATEM ; les sorties entre elles sont refusées', () => {
  assert.ok(compatibles(portOf('atem-hd8-iso', 'sdi-out-pgm'), portOf('teranex-audio-sdi', 'sdi-in')).ok);
  assert.ok(compatibles(portOf('teranex-audio-sdi', 'sdi-out'), portOf('hyperdeck-hd-plus', 'sdi-in')).ok);
  assert.ok(compatibles(portOf('hyperdeck-hd-plus', 'sdi-loop'), portOf('atem-hd8-iso', 'sdi-in-8')).ok);
  assert.ok(compatibles(portOf('gpi-tally', 'lan-1'), portOf('atem-hd8-iso', 'lan-2')).ok);
  assert.ok(compatibles(portOf('atem-hd8-iso', 'hdmi-out'), portOf('hyperdeck-hd-plus', 'hdmi-in')).ok);
  assert.ok(!compatibles(portOf('atem-hd8-iso', 'sdi-out-pgm'), portOf('hyperdeck-hd-plus', 'sdi-out')).ok, 'deux sorties');
  assert.ok(!compatibles(portOf('atem-hd8-iso', 'sdi-out-pgm'), portOf('hyperdeck-hd-plus', 'hdmi-in')).ok, 'SDI vers HDMI');
  assert.ok(!compatibles(portOf('atem-hd8-iso', 'tc-out'), portOf('hyperdeck-hd-plus', 'ref-in')).ok, 'timecode vers référence');
  assert.ok(!compatibles(portOf('teranex-sdi-audio', 'optical-out'), portOf('teranex-audio-sdi', 'xlr-in-1')).ok, 'optique S/PDIF vers XLR analogique');
  assert.ok(compatibles(portOf('teranex-sdi-audio', 'xlr-out-1'), portOf('atem-hd8-iso', 'xlr-in-1')).ok);
});

test('montage : l\'ATEM sur le secteur par le bandeau, le HyperDeck dans la baie en 12 V refusé sans bloc, le Teranex sans PoE n\'est pas alimenté, la configuration se règle et garde ses clés', () => {
  vider('');
  const bandeau = sortir('bandeau').uid; relier({ dev: bandeau, port: 'in' }, { dev: 'mur', port: 'prise1' });
  const atem = sortir('atem-hd8-iso'); assert.ok(atem.ok);
  const a = B.appareils.find((x) => x.uid === atem.uid); assert.equal(a.place.zone, 'table'); assert.equal(a.nom, 'ATEM HD8');
  assert.ok(relier({ dev: atem.uid, port: 'iec' }, { dev: bandeau, port: 'out1' }).ok);
  const hd = sortir('hyperdeck-hd-plus').uid, tx = sortir('teranex-audio-sdi').uid, gpi = sortir('gpi-tally').uid;
  assert.equal(B.appareils.find((x) => x.uid === hd).place.zone, 'rack');
  assert.ok(relier({ dev: hd, port: 'iec' }, { dev: bandeau, port: 'out2' }).ok);
  assert.ok(relier({ dev: atem.uid, port: 'sdi-out-pgm' }, { dev: tx, port: 'sdi-in' }).ok);
  assert.ok(relier({ dev: tx, port: 'sdi-out' }, { dev: hd, port: 'sdi-in' }).ok);
  assert.ok(relier({ dev: gpi, port: 'lan-1' }, { dev: atem.uid, port: 'lan-1' }).ok);
  assert.ok(!relier({ dev: gpi, port: 'lan-2' }, { dev: atem.uid, port: 'lan-1' }).ok, 'un port ne prend qu\'un câble');
  let E = evaluate(B);
  assert.ok(E.power[atem.uid].on && E.power[hd].on);
  assert.equal(E.power[atem.uid].watts, 100);
  assert.ok(!E.power[tx].on && /Aucune alimentation/.test(E.power[tx].why), 'le Teranex attend le secteur ou le PoE+');
  assert.ok(!E.power[gpi].on, 'le boîtier attend son bloc 12 V');
  assert.ok(Object.values(E.cables).every((c) => c.ok));
  regler(hd, { 'reseau.dhcp': false, 'reseau.ip': '192.168.10.50', codec: 'ProRes', distant: true });
  const h = B.appareils.find((x) => x.uid === hd);
  assert.deepEqual(keys(h.cfg), ['codec', 'distant', 'enregistre', 'media', 'qualite', 'reseau', 'source']);
  assert.equal(h.cfg.reseau.ip, '192.168.10.50'); assert.equal(h.cfg.reseau.mask, '255.255.255.0'); assert.equal(h.cfg.codec, 'ProRes');
  assert.deepEqual(CATALOGUE['hyperdeck-hd-plus'].cfg.reseau, { dhcp: true, ip: '', mask: '255.255.255.0', gw: '' }, 'le catalogue n\'est pas modifié par le réglage d\'un exemplaire');
  regler(atem.uid, { 'entrees.3.nom': 'Plateau', pgm: 3 });
  assert.equal(a.cfg.entrees[3].nom, 'Plateau'); assert.equal(a.cfg.entrees[1].nom, 'Cam 1'); assert.equal(a.cfg.pgm, 3);
  E = evaluate(B); assert.ok(E.alertes.every((x) => !bad(x.msg)));
});
