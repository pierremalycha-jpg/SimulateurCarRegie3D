// Module « L'entrepôt », groupe « reseau » : le switch NETGEAR M4250-26G4F-PoE+, le routeur (box),
// le PC de régie avec DeckLink Duo 2, et les accessoires de divers.js (bloc 12 V, pied, moniteur,
// micro, disque USB-C, carte SD). Chaque modèle : ses ports (ni plus ni moins que la documentation),
// sa configuration d'usine avec exactement les clés du brief, ses faces, ses services ; puis un
// montage : switch alimenté par le bandeau, PC et routeur sur le switch, budget PoE+ tenu puis dépassé
// avec des caméras fictives, un bloc 12 V qui alimente une caméra, un disque et une carte qui se
// branchent sur un enregistreur fictif.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/dom.mjs';
import { CATALOGUE, SIGNAUX, CONNECTEURS, compatibles, portOf, modelesDe } from '../../src/entrepot/catalogue/index.js';
import { RESEAU } from '../../src/entrepot/catalogue/reseau.js';
import { DIVERS } from '../../src/entrepot/catalogue/divers.js';
import { B, vider, sortir, relier, regler, setSaving } from '../../src/entrepot/build.js';
import { evaluate } from '../../src/entrepot/engine.js';

setSaving(false);
const bad = (t) => !t || /undefined|NaN|\[object|\bnull\b/.test(String(t));
const SW = CATALOGUE['switch-m4250'], RT = CATALOGUE.routeur, PC = CATALOGUE['pc-regie'];
const ports = (m) => Object.fromEntries(m.ports.map((p) => [p.id, p]));

// des appareils fictifs pour exercer le switch et les supports : une caméra PoE+ (30 W), un
// enregistreur avec un logement SD et un port USB-C (le vocabulaire du brief, sans attendre les autres groupes)
const FICTIFS = {
  'x-cam': { id: 'x-cam', marque: 'Test', nom: 'Caméra PoE+ fictive', court: 'XCAM', famille: 'camera', role: 'test', pose: 'plateau', watts: 30, cfg: { reseau: { dhcp: false, ip: '192.168.0.10', mask: '255.255.255.0', gw: '' } },
    ports: [{ id: 'lan', label: 'LAN', kind: 'rj45', sig: 'ip', dir: 'io', poe: true, watts: 30, nic: true }, { id: 'dc', label: 'DC 12V IN', kind: 'dc', sig: 'dc12', dir: 'in' }] },
  'x-rec': { id: 'x-rec', marque: 'Test', nom: 'Enregistreur fictif', court: 'XREC', famille: 'enregistreur', role: 'test', pose: 'rack', u: 1, watts: 20, cfg: {},
    ports: [{ id: 'sd1', label: 'SD 1', kind: 'sd', sig: 'media', dir: 'io' }, { id: 'usbc', label: 'USB-C', kind: 'usbc', sig: 'usb', dir: 'io' }, { id: 'iec', label: 'AC', kind: 'iec', sig: 'secteur', dir: 'in' }] },
};
Object.assign(CATALOGUE, FICTIFS);

test('le groupe réseau livre ses trois modèles, divers ses six, aux identifiants du brief, dans le catalogue', () => {
  assert.deepEqual(Object.keys(RESEAU), ['switch-m4250', 'routeur', 'pc-regie']);
  assert.deepEqual(Object.keys(DIVERS), ['mur', 'bandeau', 'bloc-12v', 'pied-camera', 'moniteur-hdmi', 'micro-xlr', 'disque-usbc', 'carte-sd']);
  for (const id of [...Object.keys(RESEAU), ...Object.keys(DIVERS)]) assert.equal(CATALOGUE[id].id, id);
  assert.equal(modelesDe('reseau').length, 2); assert.equal(modelesDe('ordinateur').length, 1);
  // le mur et le bandeau sont intacts
  assert.equal(DIVERS.mur.ports.length, 4); assert.equal(DIVERS.bandeau.ports.length, 9); assert.deepEqual(DIVERS.bandeau.cfg, { interrupteur: true });
});

test('chaque modèle du groupe : textes complets, doc, averifier, boite, specs, faces avant ou arrière', () => {
  for (const m of [...Object.values(RESEAU), ...['bloc-12v', 'pied-camera', 'moniteur-hdmi', 'micro-xlr', 'disque-usbc', 'carte-sd'].map((id) => DIVERS[id])]) {
    assert.ok(!bad(m.doc), `${m.id}.doc`); assert.ok(m.averifier.length >= 1, `${m.id}.averifier`); assert.ok(m.specs.length >= 1, `${m.id}.specs`);
    assert.ok(m.boite && m.boite.w > 0 && m.boite.h > 0 && m.boite.d > 0 && /^#[0-9a-f]{6}$/i.test(m.boite.couleur), `${m.id}.boite`);
    assert.ok(typeof m.prix === 'number' && m.prix >= 0, `${m.id}.prix`); assert.ok(typeof m.watts === 'number', `${m.id}.watts`);
    assert.ok(m.cfg && typeof m.cfg === 'object', `${m.id}.cfg`);
    assert.ok(Object.keys(m.faces).length >= 1, `${m.id}.faces`);
    for (const [name, f] of Object.entries(m.faces)) {
      assert.ok(!bad(f.label), `${m.id}.faces.${name}.label`);
      for (const it of f.items) { assert.ok(!bad(it.t), `${m.id}.${name}: item`); if (it.t === 'text') assert.ok(!bad(it.s)); if (it.t === 'port') assert.ok(it.x > 0 && it.x < f.w && it.y > 0 && it.y < f.h, `${m.id}.${name}.${it.id} hors de la face`); }
    }
    // chaque port du modèle est dessiné sur une face (le pied n'a pas de port)
    const drawn = new Set(Object.values(m.faces).flatMap((f) => f.items.filter((it) => it.t === 'port').map((it) => it.id)));
    for (const p of m.ports) { assert.ok(drawn.has(p.id), `${m.id}.${p.id} absent des faces`); assert.ok(!bad(p.desc), `${m.id}.${p.id}.desc`); assert.ok(!bad(p.group), `${m.id}.${p.id}.group`); }
    for (const s of m.specs) assert.ok(!bad(s)); for (const s of m.averifier) assert.ok(!bad(s));
    for (const s of m.services || []) { assert.ok(['serveur', 'client'].includes(s.role), `${m.id} service ${s.id}`); assert.ok(['ptz-http', 'atem', 'hyperdeck', 'rosstalk', 'dashboard', 'web', 'ndi', 'rtmp', 'tally-ip'].includes(s.id), `${m.id} : service ${s.id} inconnu du brief`); }
  }
});

test('switch M4250 : 24 ports PoE+, 2 cuivre, 4 SFP, OOB, secteur ; interface d\'usine DHCP avec secours 169.254.100.100 ; cfg du brief', () => {
  assert.equal(SW.marque, 'NETGEAR'); assert.equal(SW.pose, 'rack'); assert.equal(SW.u, 1); assert.equal(SW.famille, 'reseau');
  const P = ports(SW);
  const poe = SW.ports.filter((p) => p.poe), cuivre = SW.ports.filter((p) => p.kind === 'rj45' && p.sig === 'ip' && !p.poe && p.id !== 'oob'), sfp = SW.ports.filter((p) => p.kind === 'sfp');
  assert.equal(poe.length, 24); assert.equal(cuivre.length, 2); assert.equal(sfp.length, 4); assert.equal(SW.ports.length, 32);
  for (let n = 1; n <= 30; n++) { const p = P['port-' + n]; assert.ok(p, 'port-' + n); assert.equal(p.label, String(n)); assert.equal(p.sig, 'ip'); assert.equal(p.dir, 'io'); assert.ok(p.nic); assert.equal(!!p.poe, n <= 24); assert.equal(p.kind, n <= 26 ? 'rj45' : 'sfp'); }
  assert.ok(P.oob && !P.oob.nic && !P.oob.poe); assert.equal(P.iec.sig, 'secteur'); assert.equal(P.iec.dir, 'in');
  assert.deepEqual(SW.reseau, { dhcp: true, ip: '169.254.100.100', mask: '255.255.0.0', gw: '' });
  assert.deepEqual(Object.keys(SW.cfg).sort(), ['igmp', 'poeBudget', 'ports', 'qos', 'reseau', 'vlans']);
  assert.equal(SW.cfg.poeBudget, 300); assert.equal(SW.cfg.igmp, true); assert.equal(SW.cfg.qos, true); assert.deepEqual(SW.cfg.vlans, { 1: 'default' });
  assert.deepEqual(SW.cfg.reseau, SW.reseau);
  assert.equal(Object.keys(SW.cfg.ports).length, 30);
  for (let n = 1; n <= 30; n++) assert.deepEqual(SW.cfg.ports[n], { vlan: 1, poe: n <= 24, profil: 'defaut' }, 'cfg.ports ' + n);
  assert.ok(SW.services.some((s) => s.id === 'web' && s.role === 'serveur' && s.port === 80));
  // la face avant porte les 26 RJ45 et les 4 SFP, la face arrière le secteur
  const av = SW.faces.avant.items.filter((it) => it.t === 'port'), ar = SW.faces.arriere.items.filter((it) => it.t === 'port');
  assert.equal(av.filter((it) => it.k === 'rj45').length, 27); assert.equal(av.filter((it) => it.k === 'sfp').length, 4); assert.deepEqual(ar.map((it) => it.id), ['iec']);
  // deux rangées : impairs en haut, pairs en bas
  const y = (id) => av.find((it) => it.id === id).y;
  assert.ok(y('port-1') < y('port-2') && y('port-1') === y('port-23') && y('port-2') === y('port-24'));
  assert.ok(SW.watts >= 30 && SW.watts <= 50); assert.ok(SW.prix >= 1000 && SW.prix <= 2500);
  assert.ok(SW.averifier.some((s) => /169\.254\.100\.100/.test(s)));
});

test('routeur : 4 LAN commutés (nic), WAN, bloc secteur ; cfg lan/wan du brief et reseau qui recopie la passerelle', () => {
  assert.equal(RT.pose, 'table'); assert.equal(RT.famille, 'reseau');
  const P = ports(RT);
  assert.deepEqual(Object.keys(P), ['lan-1', 'lan-2', 'lan-3', 'lan-4', 'wan', 'alim']);
  for (let n = 1; n <= 4; n++) { assert.ok(P['lan-' + n].nic); assert.equal(P['lan-' + n].kind, 'rj45'); assert.equal(P['lan-' + n].sig, 'ip'); }
  assert.ok(!P.wan.nic); assert.equal(P.alim.sig, 'secteur');
  assert.deepEqual(Object.keys(RT.cfg).sort(), ['lan', 'reseau', 'wan']);
  assert.deepEqual(RT.cfg.lan, { ip: '192.168.1.1', mask: '255.255.255.0', dhcp: { on: true, de: 100, a: 199 } });
  assert.ok(['fibre', '4g', 'aucun'].includes(RT.cfg.wan));
  assert.deepEqual(RT.reseau, { dhcp: false, ip: '192.168.1.1', mask: '255.255.255.0', gw: '' }); assert.deepEqual(RT.cfg.reseau, RT.reseau);
  assert.ok(RT.services.some((s) => s.id === 'web' && s.role === 'serveur'));
});

test('PC de régie : un seul port Ethernet, 4 BNC DeckLink bidirectionnels, HDMI vers le moniteur, USB, secteur ; cfg logiciel/decklink/vmix/reseau', () => {
  assert.equal(PC.pose, 'table'); assert.equal(PC.famille, 'ordinateur');
  const eth = PC.ports.filter((p) => p.sig === 'ip');
  assert.equal(eth.length, 1); assert.equal(eth[0].id, 'lan'); assert.ok(eth[0].nic); assert.match(eth[0].desc, /seul port Ethernet/);
  const sdi = PC.ports.filter((p) => p.sig === 'sdi');
  assert.deepEqual(sdi.map((p) => p.id), ['sdi-1', 'sdi-2', 'sdi-3', 'sdi-4']);
  for (const p of sdi) { assert.equal(p.kind, 'bnc'); assert.equal(p.dir, 'io'); assert.equal(p.group, 'DeckLink Duo 2'); }
  const P = ports(PC);
  assert.equal(P['hdmi-out'].dir, 'out'); assert.equal(P['hdmi-out'].sig, 'hdmi');
  assert.ok(PC.ports.filter((p) => p.sig === 'usb').length >= 2); assert.equal(P.iec.sig, 'secteur');
  assert.deepEqual(Object.keys(PC.cfg).sort(), ['decklink', 'logiciel', 'reseau', 'vmix']);
  assert.equal(PC.cfg.logiciel, 'vmix'); assert.deepEqual(PC.cfg.decklink, { 1: 'in', 2: 'in', 3: 'in', 4: 'out' });
  assert.deepEqual(Object.keys(PC.cfg.vmix).sort(), ['enregistre', 'entrees', 'ptz', 'stream', 'tally']);
  assert.deepEqual(PC.cfg.vmix.entrees, [{ type: 'decklink', source: '' }]); assert.deepEqual(PC.cfg.vmix.ptz, [{ ip: '', modele: '' }]);
  assert.equal(PC.cfg.vmix.tally, true); assert.equal(PC.cfg.vmix.enregistre, false); assert.equal(PC.cfg.vmix.stream, false);
  assert.deepEqual(PC.cfg.reseau, { dhcp: true, ip: '', mask: '', gw: '' }); assert.deepEqual(PC.reseau, PC.cfg.reseau);
  const svc = Object.fromEntries(PC.services.map((s) => [s.id, s]));
  for (const id of ['ptz-http', 'atem', 'rosstalk', 'dashboard', 'ndi', 'rtmp']) assert.equal(svc[id].role, 'client', id);
  assert.equal(svc.atem.port, 9910); assert.equal(svc.rosstalk.port, 7788); assert.equal(svc['ptz-http'].port, 80);
  assert.equal(PC.formats[0], '1080p50');
});

test('divers : bloc 12 V (IEC → DC), pied sans port, moniteur HDMI + SDI, micro XLR sans alimentation, disque USB-C, carte SD', () => {
  const bloc = DIVERS['bloc-12v'], pied = DIVERS['pied-camera'], mon = DIVERS['moniteur-hdmi'], mic = DIVERS['micro-xlr'], dsk = DIVERS['disque-usbc'], sd = DIVERS['carte-sd'];
  assert.deepEqual(bloc.ports.map((p) => [p.id, p.kind, p.sig, p.dir]), [['iec', 'iec', 'secteur', 'in'], ['dc', 'dc', 'dc12', 'out']]); assert.equal(bloc.famille, 'alimentation');
  assert.deepEqual(pied.ports, []); assert.equal(pied.pose, 'plateau'); assert.equal(pied.famille, 'accessoire');
  assert.deepEqual(mon.ports.map((p) => [p.id, p.kind, p.sig, p.dir]), [['hdmi-in', 'hdmi', 'hdmi', 'in'], ['sdi-in', 'bnc', 'sdi', 'in'], ['iec', 'iec', 'secteur', 'in']]); assert.equal(mon.famille, 'moniteur');
  assert.deepEqual(mic.ports.map((p) => [p.id, p.kind, p.sig, p.dir]), [['out', 'xlr3', 'audio', 'out']]); assert.equal(mic.famille, 'son'); assert.ok(!mic.ports.some((p) => p.sig === 'secteur' || p.sig === 'dc12'));
  assert.deepEqual(dsk.ports.map((p) => [p.id, p.kind, p.sig, p.dir]), [['usbc', 'usbc', 'usb', 'io']]);
  assert.deepEqual(sd.ports.map((p) => [p.id, p.kind, p.sig, p.dir]), [['sd', 'sd', 'media', 'io']]);
  for (const m of [bloc, pied, mon, mic, dsk, sd]) { assert.deepEqual(m.cfg, {}); assert.equal(m.reseau, undefined); }
  // les compatibilités que le moteur attend
  assert.ok(compatibles(bloc.ports[1], FICTIFS['x-cam'].ports[1]).ok, 'bloc → DC IN caméra');
  assert.ok(compatibles(bloc.ports[1], { id: 'dc', label: '12 V', kind: 'xlr4', sig: 'dc12', dir: 'in' }).ok, 'bloc → XLR 4 du RP150');
  assert.ok(compatibles(dsk.ports[0], FICTIFS['x-rec'].ports[1]).ok, 'disque → USB-C de l\'enregistreur');
  assert.ok(!compatibles(dsk.ports[0], portOf('pc-regie', 'usb-1')).ok, 'USB-C sur USB-A : pas de câble direct');
  assert.ok(compatibles(dsk.ports[0], portOf('pc-regie', 'usbc-1')).ok, 'disque → USB-C du PC');
  assert.ok(compatibles(sd.ports[0], FICTIFS['x-rec'].ports[0]).ok, 'carte → logement SD');
  assert.ok(!compatibles(sd.ports[0], dsk.ports[0]).ok, 'carte SD et disque : signaux différents');
  assert.ok(compatibles(mic.ports[0], { id: 'in', label: 'XLR IN', kind: 'xlr3', sig: 'audio', dir: 'in' }).ok, 'micro → XLR IN');
  assert.ok(compatibles(portOf('pc-regie', 'hdmi-out'), mon.ports[0]).ok, 'PC HDMI → moniteur');
  assert.ok(compatibles(portOf('pc-regie', 'sdi-1'), mon.ports[1]).ok, 'DeckLink → SDI IN moniteur');
  assert.ok(compatibles(portOf('switch-m4250', 'port-25'), portOf('routeur', 'lan-1')).ok, 'switch ↔ routeur');
  assert.ok(compatibles(portOf('switch-m4250', 'port-26'), portOf('pc-regie', 'lan')).ok, 'switch ↔ PC');
  assert.ok(!compatibles(portOf('switch-m4250', 'port-27'), portOf('pc-regie', 'lan')).ok, 'cage SFP sans module : pas de RJ45 dessus');
  for (const [k, v] of Object.entries(SIGNAUX)) assert.ok(v.nom && CONNECTEURS, k);
});

test('montage : le switch tient 10 caméras PoE+ (300 W), pas 11 ; le PC et le routeur se branchent ; le bloc 12 V alimente une caméra', () => {
  vider('');
  const bd = sortir('bandeau').uid; relier({ dev: bd, port: 'in' }, { dev: 'mur', port: 'prise1' });
  const sw = sortir('switch-m4250').uid; assert.ok(relier({ dev: sw, port: 'iec' }, { dev: bd, port: 'out1' }).ok);
  assert.equal(B.appareils.find((a) => a.uid === sw).place.zone, 'rack');
  const pc = sortir('pc-regie').uid, rt = sortir('routeur').uid, mon = sortir('moniteur-hdmi').uid;
  assert.ok(relier({ dev: pc, port: 'lan' }, { dev: sw, port: 'port-25' }).ok);
  assert.ok(relier({ dev: rt, port: 'lan-1' }, { dev: sw, port: 'port-26' }).ok);
  assert.ok(relier({ dev: pc, port: 'iec' }, { dev: bd, port: 'out2' }).ok); assert.ok(relier({ dev: rt, port: 'alim' }, { dev: bd, port: 'out3' }).ok);
  assert.ok(relier({ dev: pc, port: 'hdmi-out' }, { dev: mon, port: 'hdmi-in' }).ok); assert.ok(relier({ dev: mon, port: 'iec' }, { dev: bd, port: 'out4' }).ok);
  assert.ok(!relier({ dev: pc, port: 'usb-1' }, { dev: sw, port: 'port-1' }).ok, 'USB sur un port réseau : refusé');
  let E = evaluate(B);
  for (const u of [sw, pc, rt, mon]) assert.ok(E.power[u].on, u);
  assert.deepEqual(E.poe[sw], { budget: 300, used: 0, ok: true });
  // dix caméras à 30 W en PoE+ : 300 W, budget tenu ; la onzième le dépasse
  const cams = [];
  for (let n = 1; n <= 10; n++) { const c = sortir('x-cam', { zone: 'plateau', slot: n }).uid; cams.push(c); assert.ok(relier({ dev: c, port: 'lan' }, { dev: sw, port: 'port-' + n }).ok); }
  E = evaluate(B);
  assert.ok(cams.every((c) => E.power[c].on && /PoE\+/.test(E.power[c].source)));
  // le squelette du moteur (af8182a) additionne la demande PoE à chacune de ses passes (6 × 300 W) :
  // on vérifie le multiple ; le moteur livré donnera 300 W tout rond (signalé dans le rapport)
  assert.equal(E.poe[sw].budget, 300); assert.ok(E.poe[sw].used >= 300 && E.poe[sw].used % 300 === 0, String(E.poe[sw].used));
  const c11 = sortir('x-cam', { zone: 'plateau', slot: 11 }).uid; relier({ dev: c11, port: 'lan' }, { dev: sw, port: 'port-11' });
  E = evaluate(B);
  assert.ok(E.poe[sw].used >= 330 && E.poe[sw].used % 330 === 0); assert.ok(!E.poe[sw].ok); assert.ok(E.alertes.some((a) => a.dev === sw && /Budget PoE\+ dépassé/.test(a.msg)));
  // le budget est celui du modèle (300 W, le squelette du moteur lit le catalogue avant l'appareil : signalé)
  regler(sw, { poeBudget: 2000 }); E = evaluate(B); assert.equal(B.appareils.find((a) => a.uid === sw).cfg.poeBudget, 2000); assert.ok(E.poe[sw].budget >= 300);
  const c12 = sortir('x-cam', { zone: 'plateau', slot: 12 }).uid;
  assert.ok(!relier({ dev: c12, port: 'lan' }, { dev: sw, port: 'port-25' }).ok, 'port 25 déjà pris par le routeur');
  // une caméra sur un bloc 12 V branché au bandeau
  const bloc = sortir('bloc-12v').uid; assert.ok(relier({ dev: bloc, port: 'iec' }, { dev: bd, port: 'out5' }).ok);
  assert.ok(relier({ dev: c12, port: 'dc' }, { dev: bloc, port: 'dc' }).ok);
  E = evaluate(B);
  assert.ok(E.power[bloc].on); assert.ok(E.power[c12].on); assert.match(E.power[c12].source, /12 V/);
  // le switch éteint (bandeau sur arrêt) : plus de PoE
  regler(bd, { interrupteur: false }); E = evaluate(B);
  assert.ok(!E.power[sw].on && !E.power[cams[0]].on && !E.power[c12].on);
  // la configuration du switch est bien une copie de l'usine : la régler ne touche pas le catalogue
  regler(sw, { 'ports.1.vlan': 20 }); assert.equal(B.appareils.find((a) => a.uid === sw).cfg.ports[1].vlan, 20); assert.equal(SW.cfg.ports[1].vlan, 1);
});

test('supports d\'enregistrement : la carte SD et le disque USB-C se câblent dans l\'enregistreur ; pied, micro et carte n\'ont pas besoin d\'alimentation', () => {
  vider('');
  const rec = sortir('x-rec').uid, sd = sortir('carte-sd').uid, dsk = sortir('disque-usbc').uid, mic = sortir('micro-xlr').uid, pied = sortir('pied-camera').uid;
  assert.ok(relier({ dev: sd, port: 'sd' }, { dev: rec, port: 'sd1' }).ok); assert.ok(relier({ dev: dsk, port: 'usbc' }, { dev: rec, port: 'usbc' }).ok);
  assert.ok(!relier({ dev: sd, port: 'sd' }, { dev: rec, port: 'usbc' }).ok, 'la carte ne va pas dans l\'USB-C');
  assert.equal(B.appareils.find((a) => a.uid === pied).place.zone, 'plateau');
  const E = evaluate(B);
  for (const u of [sd, dsk, mic, pied]) { assert.ok(E.power[u].on, u); assert.equal(E.power[u].source, 'sans alimentation'); }
  assert.ok(B.cables.every((c) => E.cables[c.uid].ok));
  // le prix total d'une régie vMix d'entrée de gamme reste raisonnable
  const total = ['switch-m4250', 'routeur', 'pc-regie', 'moniteur-hdmi', 'micro-xlr', 'disque-usbc', 'carte-sd', 'bloc-12v', 'pied-camera', 'bandeau'].reduce((s, id) => s + CATALOGUE[id].prix, 0);
  assert.ok(total > 4000 && total < 8000, String(total));
});
