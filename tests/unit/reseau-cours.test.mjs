// Calculs des leçons « bases du réseau » du Cours (src/cours/reseau_calc.js) : adresses, découpage,
// encapsulation, latences, liens Ethernet, modes d'envoi, TCP, streaming, QoS. Les manipulations et
// les quiz reposent sur ces valeurs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ipNum, ipTxt, masque, ipBits, natureIp, classe, sousReseau, decouper, prefixePour, planVlsm,
  encapsuler, serialisation, propagationFibre, bondGeo, ECHELLES, latenceEchelle, LIENS, liensPossibles,
  modesEnvoi, debitTcp, fluxTcp, latenceSrt, streaming, CLASSES, dscp, attenteFile, erreurPtp,
} from '../../src/cours/reseau_calc.js';

test('adresses : conversions, nature, classe', () => {
  assert.equal(ipTxt(ipNum('10.1.20.31')), '10.1.20.31');
  assert.equal(ipNum('10.1.20.256'), null); assert.equal(ipNum('10.1.20'), null);
  assert.equal(ipTxt(masque(24)), '255.255.255.0'); assert.equal(ipTxt(masque(26)), '255.255.255.192'); assert.equal(masque(0), 0);
  assert.equal(ipBits(ipNum('192.168.1.10')), '11000000.10101000.00000001.00001010');
  assert.match(natureIp(ipNum('10.1.20.31')), /privée/); assert.match(natureIp(ipNum('172.20.0.1')), /privée/); assert.match(natureIp(ipNum('172.32.0.1')), /publique/);
  assert.match(natureIp(ipNum('192.168.0.1')), /privée/); assert.match(natureIp(ipNum('8.8.8.8')), /publique/); assert.match(natureIp(ipNum('100.70.1.1')), /opérateur/);
  assert.match(natureIp(ipNum('169.254.3.4')), /DHCP/); assert.match(natureIp(ipNum('127.0.0.1')), /boucle/); assert.match(natureIp(ipNum('239.1.1.1')), /multicast/);
  assert.deepEqual(['10.0.0.1', '150.1.1.1', '200.1.1.1', '239.1.1.1', '250.0.0.1'].map((s) => classe(ipNum(s))), ['A', 'B', 'C', 'D', 'E']);
});

test('sous-réseau : adresse réseau, diffusion, plage, nombre de machines', () => {
  const s = sousReseau(ipNum('10.1.20.31'), 24);
  assert.equal(ipTxt(s.reseau), '10.1.20.0'); assert.equal(ipTxt(s.diffusion), '10.1.20.255');
  assert.equal(ipTxt(s.premier), '10.1.20.1'); assert.equal(ipTxt(s.dernier), '10.1.20.254'); assert.equal(s.hotes, 254); assert.equal(s.role, 'machine');
  const t = sousReseau(ipNum('192.168.10.77'), 26);
  assert.equal(ipTxt(t.reseau), '192.168.10.64'); assert.equal(ipTxt(t.diffusion), '192.168.10.127'); assert.equal(t.hotes, 62); assert.equal(ipTxt(t.joker), '0.0.0.63');
  assert.equal(sousReseau(ipNum('192.168.10.64'), 26).role, 'adresse du réseau');
  assert.equal(sousReseau(ipNum('192.168.10.127'), 26).role, 'adresse de diffusion');
  assert.equal(sousReseau(ipNum('10.0.0.0'), 31).hotes, 2, '/31 point à point : deux adresses utiles');
  assert.equal(sousReseau(ipNum('10.0.0.0'), 31).role, 'machine');
  assert.equal(sousReseau(ipNum('10.0.0.5'), 30).hotes, 2);
  assert.equal(sousReseau(ipNum('172.16.5.4'), 16).hotes, 65534);
});

test('découpage : n sous-réseaux égaux, plan à la demande (VLSM)', () => {
  const d = decouper(ipNum('192.168.1.0'), 24, 4);
  assert.equal(d.p, 26); assert.equal(d.emprunt, 2); assert.equal(d.parSous, 62);
  assert.deepEqual(d.sous.map((x) => `${ipTxt(x.reseau)}-${ipTxt(x.diffusion)}`), ['192.168.1.0-192.168.1.63', '192.168.1.64-192.168.1.127', '192.168.1.128-192.168.1.191', '192.168.1.192-192.168.1.255']);
  assert.equal(decouper(ipNum('192.168.1.0'), 24, 5).p, 27, '5 sous-réseaux : 3 bits empruntés, 8 sous-réseaux');
  assert.equal(decouper(ipNum('192.168.1.0'), 24, 200), null);
  assert.equal(prefixePour(254), 24); assert.equal(prefixePour(255), 23); assert.equal(prefixePour(62), 26); assert.equal(prefixePour(2), 30);
  const p = planVlsm(ipNum('10.1.0.0'), 24, [{ nom: 'Invités', hotes: 100 }, { nom: 'Caméras', hotes: 24 }, { nom: 'Intercom', hotes: 10 }]);
  assert.ok(p.ok);
  assert.deepEqual(p.lignes.map((l) => `${l.nom} ${ipTxt(l.reseau)}/${l.p}`), ['Invités 10.1.0.0/25', 'Caméras 10.1.0.128/27', 'Intercom 10.1.0.160/28']);
  assert.equal(p.utilise, 128 + 32 + 16);
  assert.ok(!planVlsm(ipNum('10.1.0.0'), 24, [{ nom: 'A', hotes: 200 }, { nom: 'B', hotes: 100 }]).ok, 'trop gros pour un /24');
});

test('encapsulation : en-têtes, MTU, rendement sur le câble', () => {
  const e = encapsuler(1200, { transport: 'udp', rtp: true });
  assert.equal(e.paquetIp, 1200 + 12 + 8 + 20);
  assert.equal(e.trame, e.paquetIp + 14 + 4); assert.equal(e.surLeCable, e.trame + 20);
  assert.ok(!e.tropGros);
  assert.ok(encapsuler(1480, { transport: 'tcp' }).tropGros, '1 480 + 20 + 20 > 1 500');
  assert.equal(encapsuler(1460, { transport: 'tcp' }).paquetIp, 1500, 'MSS TCP courant : 1 460');
  const petit = encapsuler(1, { transport: 'udp' });
  assert.equal(petit.bourrage, 46 - 29); assert.equal(petit.trame, 64, 'trame Ethernet minimale : 64 octets');
  assert.equal(encapsuler(100, { vlan: true }).trame, encapsuler(100).trame + 4);
  assert.ok(encapsuler(1400).rendement > 0.95 && encapsuler(100).rendement < 0.61, 'petits paquets : 40 % du câble pour les en-têtes');
});

test('latences : sérialisation, fibre, satellite, échelles', () => {
  assert.equal(serialisation(1500, 1e9), 12); assert.equal(serialisation(1500, 10e9), 1.2);
  assert.equal(propagationFibre(200), 1);
  assert.ok(Math.abs(bondGeo() - 238.7) < 0.5, 'satellite géostationnaire : ≈ 239 ms au minimum');
  const lat = Object.fromEntries(ECHELLES.map((e) => [e.id, latenceEchelle(e).total]));
  assert.ok(lat.lan < 0.1 && lat.man < 1 && lat.wan < 5 && lat.sat > 240);
  assert.ok(lat.lan < lat.man && lat.man < lat.wan && lat.wan < lat['wan-int'] && lat['wan-int'] < lat.sat);
});

test('liens Ethernet : débit, distance, du moins cher au plus cher', () => {
  for (const l of LIENS) assert.ok(l.debit > 0 && l.portee > 0 && ['cuivre', 'mm', 'sm', 'dac'].includes(l.support), l.nom);
  assert.equal(liensPossibles(1, 80)[0].nom, '1000BASE-T');
  assert.equal(liensPossibles(10, 90)[0].nom, '10GBASE-T');
  assert.equal(liensPossibles(10, 200)[0].nom, '10GBASE-SR', 'au-delà de 100 m : fibre');
  assert.equal(liensPossibles(25, 150)[0].support, 'sm', '25G sur 150 m : monomode (le multimode OM3 s\'arrête à 70 m)');
  assert.equal(liensPossibles(10, 25000)[0].nom, '10GBASE-ER');
  assert.deepEqual(liensPossibles(100, 50000), []);
});

test('unicast, diffusion, multicast : charge du lien de l\'émetteur', () => {
  assert.deepEqual(modesEnvoi('unicast', 6, 40, 3000), { lienSource: 18000, recus: 6, inutiles: 0, copies: 6 });
  assert.equal(modesEnvoi('broadcast', 6, 40, 3000).inutiles, 34);
  assert.equal(modesEnvoi('multicast', 6, 40, 3000).lienSource, 3000);
});

test('TCP : limité par le lien, la fenêtre ou les pertes ; un flux constant décroche', () => {
  assert.equal(debitTcp({ lien: 1e9, rtt: 1, perte: 0 }).limite, 'le lien');
  const loin = debitTcp({ lien: 1e9, rtt: 100, perte: 0, fenetre: 65535 });
  assert.equal(loin.limite, 'la fenêtre'); assert.ok(Math.abs(loin.debit - 5.24e6) < 1e4, '64 Ko / 100 ms ≈ 5,2 Mb/s');
  const perdu = debitTcp({ lien: 1e9, rtt: 50, perte: 0.01 });
  assert.equal(perdu.limite, 'les pertes'); assert.ok(Math.abs(perdu.debit - 2.85e6) < 0.05e6, 'Mathis : 1 460 octets, 50 ms, 1 % ≈ 2,85 Mb/s');
  assert.ok(fluxTcp({ debit: 8e6, lien: 100e6, rtt: 20, perte: 0 }).tient);
  assert.ok(!fluxTcp({ debit: 8e6, lien: 100e6, rtt: 80, perte: 0.02 }).tient);
});

test('streaming : SRT selon les pertes, latences relatives des protocoles', () => {
  assert.equal(latenceSrt(20, 0.005), 120, 'jamais moins de 120 ms');
  assert.equal(latenceSrt(60, 0.005), 180); assert.equal(latenceSrt(60, 0.02), 240); assert.equal(latenceSrt(60, 0.05), 360);
  assert.equal(latenceSrt(60, 0.5), null);
  const o = { rtt: 40, perte: 0.01 };
  const l = Object.fromEntries(['rtp', 'srt', 'rtmp', 'llhls', 'hls'].map((p) => [p, streaming(p, o).latence]));
  assert.ok(l.rtp < l.srt && l.srt < l.rtmp && l.rtmp < l.llhls && l.llhls < l.hls);
  assert.ok(l.hls > 20000, 'HLS en segments de 6 s : plus de 20 s');
  assert.ok(!streaming('rtp', o).ok, 'RTP brut : une perte abîme l\'image');
  assert.ok(streaming('srt', o).ok);
});

test('QoS : DSCP, attente en FIFO et en priorité stricte, erreur de PTP', () => {
  assert.equal(dscp('EF'), 46); assert.equal(dscp('AF41'), 34); assert.equal(dscp('CS2'), 16); assert.equal(dscp('BE'), 0);
  for (const c of CLASSES) assert.equal(c.dscp, dscp(c.phb.split(' ')[0]), c.id);
  const fifo = Object.fromEntries(attenteFile(1.25e6, 1e9, 'fifo').map((c) => [c.id, c.attente]));
  const prio = Object.fromEntries(attenteFile(1.25e6, 1e9, 'prio').map((c) => [c.id, c.attente]));
  assert.equal(fifo.ptp, 10000, '1,25 Mo devant soi sur 1 Gb/s : 10 ms');
  assert.equal(prio.ptp, 12, 'en priorité : la fin d\'une trame de 1 500 octets, 12 µs');
  assert.equal(prio.fichiers, fifo.fichiers);
  assert.equal(erreurPtp(10012, 12), 5000);
});
