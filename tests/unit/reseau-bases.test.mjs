// Le chapitre « Le réseau » (v19.17) : ses parties et leurs leçons, les calculs des bases (cours/ip_calc.js : adresses,
// découpage, types d'adresses, encapsulation, propagation, débit de TCP avec pertes, latence SRT, files d'attente,
// traduction d'adresses, gigue RTP), les fiches « ? » ajoutées, et les vues 3D qui illustrent chaque nouvelle leçon.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import '../../src/cours/liens.js';
import { lessonById, CHAPTERS } from '../../src/cours/index.js';
import { PARTIES } from '../../src/cours/reseau.js';
import { vuesDeLecon } from '../../src/vues3d/catalogue.js';
import { TERMS, CATS } from '../../src/content/netterms.js';
import {
  infoReseau, decouper, prefixePour, typeAdresse, classe, portee, encapsuler, serialisationUs, fluxParLien, propagationMs,
  bondSatelliteMs, debitTcp, debitFenetre, pertesUdp, latenceSrt, filesQos, routeurNat, gigueRtp, budgetLatence, bits32, parseIp,
} from '../../src/cours/ip_calc.js';

const NOUVELLES = ['reseau-modele', 'reseau-etendue', 'reseau-ethernet', 'reseau-adresses', 'reseau-types', 'reseau-dhcp-dns', 'reseau-nat', 'reseau-tcp-udp', 'reseau-streaming', 'reseau-mesures', 'reseau-qos'];

test('le chapitre réseau : cinq parties, chaque leçon une fois, dans l\'ordre des parties', () => {
  const ch = CHAPTERS.find((c) => c.id === 'reseau');
  const ids = PARTIES.flatMap(([, l]) => l);
  assert.equal(PARTIES.length, 5);
  assert.equal(new Set(ids).size, ids.length, 'une leçon dans deux parties');
  assert.deepEqual(ch.lessons.map((l) => l.id), ids, 'le sommaire suit les parties');
  for (const l of ch.lessons) assert.ok(l.partie && PARTIES.some(([p, ls]) => p === l.partie && ls.includes(l.id)), l.id);
  assert.ok(ch.lessons.length >= 23);
});

test('chaque nouvelle leçon : quiz de six questions expliquées, fiches existantes, au moins une vue 3D', () => {
  for (const id of NOUVELLES) {
    const f = lessonById(id); assert.ok(f, id);
    const L = f.lesson;
    assert.equal(L.quiz.length, 6, `${id} : six questions`);
    for (const q of L.quiz) {
      assert.equal(q.choices.length, 3, `${id} : trois choix`);
      q.choices.forEach((c, i) => { if (i !== q.answer) assert.ok(Array.isArray(c) && c[1].length > 10, `${id} : choix faux sans explication (« ${q.q} »)`); });
      assert.equal(typeof q.choices[q.answer], 'string', `${id} : la bonne réponse est une chaîne`);
    }
    for (const t of L.terms) assert.ok(TERMS[t], `${id} : fiche ${t}`);
    assert.ok(typeof L.figure === 'function' && typeof L.demo === 'function', `${id} : schéma et manipulation`);
    assert.ok(vuesDeLecon(id).length >= 1, `${id} : aucune vue 3D`);
  }
});

test('fiches « ? » des bases et du streaming : complètes, familles connues, renvois valides', () => {
  const ids = ['modele-osi', 'encapsulation', 'lan-wan', 'ethernet', 'sfp', 'adresse-reseau', 'broadcast-ip', 'cidr', 'types-adresses', 'adresses-privees', 'ipv6', 'dns', 'nat', 'port', 'tcp', 'traceroute', 'contribution', 'srt', 'rist', 'rtmp', 'hls', 'ndi', 'arq'];
  for (const id of ids) {
    const T = TERMS[id]; assert.ok(T, id);
    assert.ok(T.t && T.short && T.body && CATS.includes(T.cat), id);
    assert.ok(T.short.length <= 220, `${id} : phrase courte trop longue`);
    for (const s of T.see || []) assert.ok(TERMS[s], `${id} → ${s}`);
  }
});

test('adresses : réseau, diffusion, plage, découpage', () => {
  const a = infoReseau('10.1.20.130', 26);
  assert.deepEqual([a.reseau, a.broadcast, a.premier, a.dernier, a.hotes, a.masque], ['10.1.20.128', '10.1.20.191', '10.1.20.129', '10.1.20.190', 62, '255.255.255.192']);
  const b = infoReseau('10.20.1.7', 22);
  assert.deepEqual([b.reseau, b.broadcast, b.hotes], ['10.20.0.0', '10.20.3.255', 1022]);
  assert.equal(infoReseau('10.255.2.0', 31).hotes, 2); assert.equal(infoReseau('10.255.2.0', 31).broadcast, null);
  assert.ok(infoReseau('10.1.20.255', 24).estBroadcast); assert.ok(infoReseau('10.1.20.0', 24).estReseau);
  assert.equal(bits32(/** @type {number} */ (parseIp('10.1.20.31'))), '00001010.00000001.00010100.00011111');
  const d = decouper('10.1.20.0', 24, 26);
  assert.deepEqual(d.map((x) => x.reseau), ['10.1.20.0', '10.1.20.64', '10.1.20.128', '10.1.20.192']);
  assert.deepEqual([prefixePour(200), prefixePour(254), prefixePour(255), prefixePour(2)], [24, 24, 23, 30]);
});

test('types d\'adresses, classes, portée d\'un envoi', () => {
  const T = (a) => typeAdresse(a).type;
  assert.equal(T('10.1.20.31'), 'privée'); assert.equal(T('172.20.0.1'), 'privée'); assert.equal(T('172.32.0.1'), 'publique');
  assert.equal(T('192.168.1.10'), 'privée'); assert.equal(T('169.254.7.20'), 'lien local (APIPA)'); assert.equal(T('127.0.0.1'), 'boucle locale');
  assert.equal(T('239.1.1.3'), 'multicast privé'); assert.equal(T('232.1.1.1'), 'multicast SSM'); assert.equal(T('224.0.0.251'), 'multicast local');
  assert.equal(T('100.72.3.4'), 'partagée (CGNAT)'); assert.equal(T('255.255.255.255'), 'diffusion limitée'); assert.equal(T('8.8.8.8'), 'publique');
  assert.deepEqual(['10.0.0.1', '150.1.1.1', '200.1.1.1', '230.1.1.1', '250.1.1.1'].map((a) => classe(a).c), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(portee('10.1.20.255', '10.1.20.31', 24).genre, 'diffusion');
  assert.match(portee('10.1.30.5', '10.1.20.31', 24).ou, /passerelle/);
  assert.match(portee('10.1.20.11', '10.1.20.31', 24).ou, /direct/);
  assert.equal(portee('239.1.1.1', '10.1.20.31', 24).genre, 'multicast');
});

test('encapsulation, trame, débits des liens', () => {
  const v = encapsuler(1200);
  assert.deepEqual(v.couches.map((c) => c.total), [1200, 1212, 1220, 1240, 1258, 1278]);
  assert.ok(Math.abs(v.efficacite - 1200 / 1278) < 1e-12);
  assert.equal(encapsuler(1460, { transport: 'tcp' }).surFil, 1460 + 20 + 20 + 18 + 20);
  assert.equal(encapsuler(56, { transport: 'icmp' }).surFil, 56 + 8 + 20 + 18 + 20);
  assert.equal(encapsuler(10, { transport: 'udp', rtp: false }).surFil, 10 + 8 + 20 + 18 + 8 + 20, 'trame complétée à 46 octets de données');
  assert.ok(Math.abs(serialisationUs(1500, 1) - 12) < 1e-9 && Math.abs(serialisationUs(1500, 10) - 1.2) < 1e-9);
  assert.deepEqual([fluxParLien(2.16, 1), fluxParLien(2.16, 10), fluxParLien(2.16, 25), fluxParLien(8.6, 25)], [0, 4, 10, 2]);
});

test('distance et retard : fibre, satellite, budget', () => {
  assert.ok(Math.abs(propagationMs(250) - 1.225) < 0.01, '5 µs/km dans la fibre');
  assert.ok(bondSatelliteMs() > 235 && bondSatelliteMs() < 242, 'un bond géostationnaire ≈ 239 ms');
  const B = budgetLatence({ km: 250, sauts: 8, gbps: 10, equipementUs: 10 });
  assert.ok(Math.abs(B.total - (B.prop + B.seri + B.equip)) < 1e-12 && B.total > 1.3 && B.total < 1.4);
});

test('TCP avec pertes (Mathis), UDP, latence SRT', () => {
  assert.ok(Math.abs(debitTcp(100, 0.01) - 1.43) < 0.01, '≈ 1,4 Mb/s à 100 ms et 1 %');
  assert.equal(debitTcp(1, 0.0001, 1000), 1000, 'plafonné par le lien');
  assert.equal(debitTcp(50, 0, 100), 100);
  assert.ok(Math.abs(debitFenetre(65535, 100) - 5.24) < 0.01);
  const u = pertesUdp(10, 0.01); assert.ok(Math.abs(u.pps - 949.8) < 0.1 && Math.abs(u.perdusS - 9.498) < 0.01);
  assert.deepEqual(latenceSrt(80, 2), { mult: 4, latence: 320, surdebit: 25 });
  assert.equal(latenceSrt(10, 0.5).latence, 60, 'RTT compté à 20 ms au moins');
  assert.equal(latenceSrt(50, 45), null);
});

test('QoS : une file ou la priorité stricte', () => {
  const o = { ptp: 1, media: 700, fichiers: 600 };
  const F = filesQos(o, 1000, 'fifo');
  assert.ok(F.classes.ptp.pertePct > 20 && F.classes.ptp.retardMs > 0, 'une seule file : PTP perd et attend');
  const P = filesQos(o, 1000, 'prio');
  assert.equal(P.classes.ptp.perdu, 0); assert.equal(P.classes.media.perdu, 0); assert.equal(P.classes.ptp.retardMs, 0);
  assert.ok(Math.abs(P.classes.fichiers.servi - 299) < 1e-9);
  const M = filesQos({ ptp: 1, media: 1100, fichiers: 0 }, 1000, 'prio');
  assert.ok(M.classes.media.perdu > 0, 'la QoS ne crée pas de débit');
  assert.equal(filesQos({ ptp: 1, media: 300 }, 1000, 'fifo').classes.media.perdu, 0);
});

test('NAT : la sortie ouvre la ligne, l\'entrée non demandée est bloquée sauf redirection ; gigue RTP', () => {
  const N = routeurNat('203.0.113.7');
  const s = N.sortie('192.168.1.20', 51515, '198.51.100.9');
  assert.equal(s.ip, '203.0.113.7');
  assert.deepEqual(N.sortie('192.168.1.20', 51515, '198.51.100.9'), s, 'même correspondance pour la même conversation');
  assert.equal(N.entree(s.port, '198.51.100.9').ip, '192.168.1.20');
  assert.equal(N.entree(s.port, '192.0.2.66'), null, 'un autre expéditeur ne passe pas');
  assert.equal(N.entree(9000, '192.0.2.66'), null);
  N.rediriger(9000, '192.168.1.50', 9000);
  assert.equal(N.entree(9000, '192.0.2.66').par, 'redirection');
  assert.equal(gigueRtp([5, 5, 5, 5]), 0);
  assert.ok(gigueRtp([5, 8, 5, 8, 5, 8, 5, 8]) > 0.5);
});
