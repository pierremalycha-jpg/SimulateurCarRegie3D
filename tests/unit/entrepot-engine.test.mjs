// Le moteur de l'entrepôt (engine.js) et les missions (missions.js), testés sur des modèles FICTIFS
// minimaux qui suivent le vocabulaire du brief (ids de modèles, clés cfg, ids de ports). Quand le vrai
// catalogue sera écrit, ces fictifs seront écrasés par Object.assign : les tests restent valables tant
// que les clés sont les mêmes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/dom.mjs';
import { CATALOGUE } from '../../src/entrepot/catalogue/index.js';
import { B, vider, sortir, relier, regler, debrancher, setSaving } from '../../src/entrepot/build.js';
import { evaluate, tallyWould, explainReach, linkLocal, numOf, switchPortNum } from '../../src/entrepot/engine.js';
import { MISSIONS, missionById, noter } from '../../src/entrepot/missions.js';

setSaving(false);

// ---------------- les modèles fictifs ----------------
const P = (id, label, kind, sig, dir, extra = {}) => ({ id, label, kind, sig, dir, ...extra });
const sdiIn = (n) => P(`sdi-in-${n}`, `SDI IN ${n}`, 'bnc', 'sdi', 'in');
const lan = (extra = {}) => P('lan', 'LAN', 'rj45', 'ip', 'io', { nic: true, ...extra });
const iec = () => P('iec', 'AC IN', 'iec', 'secteur', 'in');
const dc = () => P('dc', 'DC 12V IN', 'dc', 'dc12', 'in');
const boite = { w: 0.2, h: 0.1, d: 0.2 };
const RESEAU_CAM = { dhcp: false, ip: '192.168.0.10', mask: '255.255.255.0', gw: '192.168.0.1' };
const FICTIFS = {
  he130: {
    id: 'he130', marque: 'Panasonic', nom: 'AW-HE130 (fictif)', court: 'HE130', famille: 'camera', role: 'Caméra PTZ', pose: 'plateau',
    ports: [P('sdi-out', 'SDI OUT', 'bnc', 'sdi', 'out'), P('hdmi-out', 'HDMI', 'hdmi', 'hdmi', 'out'), lan({ poe: true, watts: 25 }), P('rs422', 'CONTROL IN (RS-422)', 'rj45', 'rs422', 'in'), P('ref-in', 'G/L IN', 'bnc', 'ref', 'in'), dc()],
    reseau: RESEAU_CAM, services: [{ id: 'ptz-http', role: 'serveur', port: 80 }, { id: 'web', role: 'serveur', port: 80 }, { id: 'ndi', role: 'serveur' }, { id: 'tally-ip', role: 'serveur' }],
    watts: 25, prix: 4500, formats: ['1080p50', '1080i50', '720p50', '1080p59', '1080i59'],
    cfg: { format: '1080p50', sdiOut: true, hdmiOut: true, ndi: false, tally: 'ip', serie: 'rs422', irId: 1, reseau: { ...RESEAU_CAM } }, boite,
  },
  rp150: {
    id: 'rp150', marque: 'Panasonic', nom: 'AW-RP150 (fictif)', court: 'RP150', famille: 'pupitre', role: 'Pupitre PTZ', pose: 'table',
    ports: [lan({ poe: true, watts: 20 }), P('serial', 'SERIAL CONT', 'rj45', 'rs422', 'out'), P('gpio1', 'TALLY/GPIO 1', 'dsub25', 'tally', 'in'), P('gpio2', 'GPIO 2', 'dsub25', 'gpio', 'io'), P('sdi-in-1', 'SDI IN', 'bnc', 'sdi', 'in', { thru: 'sdi-out-1' }), P('sdi-out-1', 'THRU OUT', 'bnc', 'sdi', 'out'), P('dc', 'DC 12V IN', 'xlr4', 'dc12', 'in')],
    reseau: { dhcp: false, ip: '192.168.0.9', mask: '255.255.255.0', gw: '192.168.0.1' }, services: [{ id: 'ptz-http', role: 'client', port: 80 }, { id: 'tally-ip', role: 'client' }],
    watts: 20, prix: 3000,
    cfg: { cameras: Array.from({ length: 10 }, (_, i) => ({ slot: i + 1, mode: 'off', ip: '', port: 80 })), tallyIp: false, tallyIn: 'gpio1', reseau: { dhcp: false, ip: '192.168.0.9', mask: '255.255.255.0', gw: '192.168.0.1' } }, boite,
  },
  'atem-hd8-iso': {
    id: 'atem-hd8-iso', marque: 'Blackmagic Design', nom: 'ATEM HD8 ISO (fictif)', court: 'ATEM HD8', famille: 'melangeur', role: 'Mélangeur', pose: 'rack', u: 1,
    ports: [...[1, 2, 3, 4, 5, 6, 7, 8].map(sdiIn), P('sdi-out-pgm', 'PGM OUT', 'bnc', 'sdi', 'out'), P('sdi-out-aux-1', 'AUX 1', 'bnc', 'sdi', 'out'), P('sdi-out-mv', 'MULTIVIEW', 'bnc', 'sdi', 'out'), P('hdmi-out', 'HDMI OUT', 'hdmi', 'hdmi', 'out'),
      ...[1, 2, 3, 4].map((n) => P(`lan-${n}`, `ETHERNET ${n}`, 'rj45', 'ip', 'io', { nic: n === 1 })), P('usbc-1', 'USB-C 1', 'usbc', 'usb', 'io'), P('usbc-2', 'USB-C 2', 'usbc', 'usb', 'io'), P('audio-in-1', 'MIC 1', 'xlr3', 'audio', 'in'), P('audio-in-2', 'MIC 2', 'xlr3', 'audio', 'in'), P('ref-in', 'REF IN', 'bnc', 'ref', 'in'), iec()],
    reseau: { dhcp: true, ip: '192.168.10.240', mask: '255.255.255.0', gw: '192.168.10.1' }, services: [{ id: 'atem', role: 'serveur', port: 9910 }, { id: 'hyperdeck', role: 'client', port: 9993 }, { id: 'rtmp', role: 'client' }],
    watts: 60, prix: 3200, formats: ['1080p50', '1080i50', '720p50', '1080p59', '1080i59'],
    cfg: { format: '1080p50', entrees: { 1: { nom: 'Cam 1' } }, pgm: 1, pvw: 2, multiview: '10', aux: { 1: 'pgm' }, iso: false, stream: { on: false, service: 'YouTube', cle: '' }, hyperdecks: [{ ip: '' }, { ip: '' }, { ip: '' }, { ip: '' }], audio: { 1: 'afv', 2: 'afv', mic1: 'off', mic2: 'off' }, reseau: { dhcp: true, ip: '192.168.10.240', mask: '255.255.255.0', gw: '192.168.10.1' } }, boite,
  },
  'gpi-tally': {
    id: 'gpi-tally', marque: 'Blackmagic Design', nom: 'GPI and Tally Interface (fictif)', court: 'GPI Tally', famille: 'convertisseur', role: 'Tally', pose: 'table',
    ports: [lan(), P('tally', 'TALLY / GPI', 'dsub25', 'tally', 'out'), dc()],
    reseau: { dhcp: false, ip: '192.168.10.2', mask: '255.255.255.0', gw: '' }, services: [{ id: 'atem', role: 'client', port: 9910 }],
    watts: 5, prix: 350, cfg: { atemIp: '', sorties: 'entrees 1-8', reseau: { dhcp: false, ip: '192.168.10.2', mask: '255.255.255.0', gw: '' } }, boite,
  },
  'hyperdeck-hd-plus': {
    id: 'hyperdeck-hd-plus', marque: 'Blackmagic Design', nom: 'HyperDeck Studio HD Plus (fictif)', court: 'HyperDeck', famille: 'enregistreur', role: 'Enregistreur', pose: 'rack', u: 1,
    ports: [P('sdi-in', 'SDI IN', 'bnc', 'sdi', 'in', { thru: 'sdi-loop' }), P('sdi-loop', 'SDI LOOP', 'bnc', 'sdi', 'out'), P('sdi-out', 'SDI OUT', 'bnc', 'sdi', 'out'), P('hdmi-in', 'HDMI IN', 'hdmi', 'hdmi', 'in'), P('hdmi-out', 'HDMI OUT', 'hdmi', 'hdmi', 'out'), lan(), P('sd1', 'SD 1', 'sd', 'media', 'in'), P('sd2', 'SD 2', 'sd', 'media', 'in'), P('usbc', 'USB-C', 'usbc', 'usb', 'io'), P('rs422', 'REMOTE', 'dsub9', 'rs422', 'in'), iec()],
    reseau: { dhcp: true, ip: '', mask: '', gw: '' }, services: [{ id: 'hyperdeck', role: 'serveur', port: 9993 }, { id: 'web', role: 'serveur', port: 80 }],
    watts: 30, prix: 1100, cfg: { source: 'sdi', codec: 'H.264', qualite: 'haute', media: 'sd1', distant: true, enregistre: false, reseau: { dhcp: true, ip: '', mask: '', gw: '' } }, boite,
  },
  'teranex-audio-sdi': {
    id: 'teranex-audio-sdi', marque: 'Blackmagic Design', nom: 'Teranex Mini Audio to SDI (fictif)', court: 'Teranex A→SDI', famille: 'convertisseur', role: 'Embedder', pose: 'table',
    ports: [P('sdi-in', 'SDI IN', 'bnc', 'sdi', 'in'), P('sdi-out', 'SDI OUT', 'bnc', 'sdi', 'out'), P('audio-in-1', 'XLR 1', 'xlr3', 'audio', 'in'), P('audio-in-2', 'XLR 2', 'xlr3', 'audio', 'in'), lan({ poe: true, watts: 10 }), P('usbc', 'USB-C', 'usbc', 'usb', 'io'), dc()],
    reseau: { dhcp: true, ip: '', mask: '', gw: '' }, watts: 10, prix: 500, cfg: { paire: 1, entree: 'xlr', niveau: 4, reseau: { dhcp: true, ip: '', mask: '', gw: '' } }, boite,
  },
  'teranex-sdi-audio': {
    id: 'teranex-sdi-audio', marque: 'Blackmagic Design', nom: 'Teranex Mini SDI to Audio (fictif)', court: 'Teranex SDI→A', famille: 'convertisseur', role: 'Désembedder', pose: 'table',
    ports: [P('sdi-in', 'SDI IN', 'bnc', 'sdi', 'in', { thru: 'sdi-loop' }), P('sdi-loop', 'SDI LOOP', 'bnc', 'sdi', 'out'), P('audio-out-1', 'XLR 1', 'xlr3', 'audio', 'out'), P('audio-out-2', 'XLR 2', 'xlr3', 'audio', 'out'), lan({ poe: true, watts: 10 }), dc()],
    reseau: { dhcp: true, ip: '', mask: '', gw: '' }, watts: 10, prix: 500, cfg: { paire: 1, entree: 'aes', niveau: 4, reseau: { dhcp: true, ip: '', mask: '', gw: '' } }, boite,
  },
  'switch-m4250': {
    id: 'switch-m4250', marque: 'NETGEAR', nom: 'M4250 PoE+ (fictif)', court: 'Switch', famille: 'reseau', role: 'Switch', pose: 'rack', u: 1,
    ports: [...Array.from({ length: 24 }, (_, i) => P(`lan-${i + 1}`, `${i + 1}`, 'rj45', 'ip', 'io', { poe: true })), P('lan-25', '25', 'rj45', 'ip', 'io'), P('lan-26', '26', 'rj45', 'ip', 'io', { nic: true }), iec()],
    reseau: { dhcp: true, ip: '169.254.100.100', mask: '255.255.0.0', gw: '' }, services: [{ id: 'web', role: 'serveur', port: 80 }],
    watts: 40, prix: 1500, cfg: { ports: Object.fromEntries(Array.from({ length: 26 }, (_, i) => [i + 1, { vlan: 1, poe: true, profil: 'defaut' }])), vlans: { 1: 'default' }, poeBudget: 300, igmp: true, qos: true, reseau: { dhcp: true, ip: '169.254.100.100', mask: '255.255.0.0', gw: '' } }, boite,
  },
  routeur: {
    id: 'routeur', marque: 'Générique', nom: 'Routeur (fictif)', court: 'Box', famille: 'reseau', role: 'Routeur', pose: 'table',
    ports: [...[1, 2, 3, 4].map((n) => P(`lan-${n}`, `LAN ${n}`, 'rj45', 'ip', 'io', { nic: n === 1 })), P('wan', 'WAN', 'rj45', 'ip', 'io'), dc()],
    reseau: { dhcp: false, ip: '192.168.1.1', mask: '255.255.255.0', gw: '' }, services: [{ id: 'web', role: 'serveur', port: 80 }],
    watts: 10, prix: 150, cfg: { lan: { ip: '192.168.1.1', mask: '255.255.255.0', dhcp: { on: true, de: 100, a: 199 } }, wan: 'fibre' }, boite,
  },
  'pc-regie': {
    id: 'pc-regie', marque: 'Générique', nom: 'PC de régie (fictif)', court: 'PC', famille: 'ordinateur', role: 'vMix', pose: 'table',
    ports: [lan(), ...[1, 2, 3, 4].map((n) => P(`decklink-${n}`, `DeckLink ${n}`, 'bnc', 'sdi', 'io')), P('hdmi-out', 'HDMI', 'hdmi', 'hdmi', 'out'), P('usbc', 'USB-C', 'usbc', 'usb', 'io'), iec()],
    reseau: { dhcp: true, ip: '', mask: '', gw: '' }, services: [{ id: 'ptz-http', role: 'client' }, { id: 'atem', role: 'client' }, { id: 'ndi', role: 'client' }, { id: 'rosstalk', role: 'client' }, { id: 'rtmp', role: 'client' }, { id: 'hyperdeck', role: 'client' }],
    watts: 300, prix: 2500, cfg: { logiciel: 'vmix', decklink: { 1: 'in', 2: 'in', 3: 'out', 4: 'out' }, vmix: { entrees: [], ptz: [], tally: true, enregistre: false, stream: false }, reseau: { dhcp: true, ip: '', mask: '', gw: '' } }, boite,
  },
  'bloc-12v': { id: 'bloc-12v', marque: 'Générique', nom: 'Bloc 12 V (fictif)', court: 'Bloc 12 V', famille: 'alimentation', role: 'Alimentation', pose: 'table', ports: [iec(), P('out', '12 V OUT', 'dc', 'dc12', 'out')], watts: 0, prix: 40, cfg: {}, boite },
  'micro-xlr': { id: 'micro-xlr', marque: 'Générique', nom: 'Micro XLR (fictif)', court: 'Micro', famille: 'son', role: 'Micro', pose: 'plateau', ports: [P('out', 'XLR', 'xlr3', 'audio', 'out')], watts: 0, prix: 120, cfg: {}, boite },
  'carte-sd': { id: 'carte-sd', marque: 'Générique', nom: 'Carte SD (fictif)', court: 'SD', famille: 'accessoire', role: 'Support', pose: 'table', ports: [P('sd', 'SD', 'sd', 'media', 'out')], watts: 0, prix: 60, cfg: {}, boite },
  'disque-usbc': { id: 'disque-usbc', marque: 'Générique', nom: 'Disque USB-C (fictif)', court: 'SSD', famille: 'accessoire', role: 'Support', pose: 'table', ports: [P('usbc', 'USB-C', 'usbc', 'usb', 'io')], watts: 0, prix: 150, cfg: {}, boite },
  'moniteur-hdmi': { id: 'moniteur-hdmi', marque: 'Générique', nom: 'Moniteur (fictif)', court: 'Moniteur', famille: 'moniteur', role: 'Moniteur', pose: 'table', ports: [P('hdmi-in', 'HDMI IN', 'hdmi', 'hdmi', 'in'), P('sdi-in', 'SDI IN', 'bnc', 'sdi', 'in'), dc()], watts: 20, prix: 250, cfg: {}, boite },
};
Object.assign(CATALOGUE, FICTIFS);

// ---------------- outils de montage ----------------
const out = (id) => { const r = sortir(id); assert.ok(r.ok, `${id} : ${r.why}`); return r.uid; };
const link = (a, pa, b, pb) => { const r = relier({ dev: a, port: pa }, { dev: b, port: pb }); assert.ok(r.ok, `${a}:${pa} ↔ ${b}:${pb} : ${r.why}`); return r.uid; };
/** le socle : mur, bandeau, switch alimenté par le bandeau */
function socle() {
  vider('');
  const bandeau = out('bandeau'); link(bandeau, 'in', 'mur', 'prise1');
  const sw = out('switch-m4250'); link(sw, 'iec', bandeau, 'out1');
  return { bandeau, sw };
}
/** une caméra d'usine sur le port n du switch (PoE+) */
function camera(sw, n, ip = '') {
  const c = out('he130'); link(c, 'lan', sw, `lan-${n}`);
  if (ip) regler(c, { 'reseau.ip': ip });
  return c;
}

test('outils : numéro de port, lien local', () => {
  assert.equal(numOf('sdi-in-3'), 3); assert.equal(numOf('lan'), 0); assert.equal(switchPortNum('sfp-2'), 28);
  assert.ok(linkLocal('169.254.3.4')); assert.ok(!linkLocal('192.168.0.10'));
});

test('IP : deux caméras d\'usine sur le même switch sont en conflit (192.168.0.10), une troisième réadressée ne l\'est pas', () => {
  const { sw } = socle();
  const c1 = camera(sw, 1), c2 = camera(sw, 2), c3 = camera(sw, 3, '192.168.0.12');
  const E = evaluate(B);
  assert.ok(E.power[c1].on && E.power[c2].on, 'PoE+ du switch');
  assert.match(E.power[c1].source, /PoE\+/);
  assert.ok(E.ip[c1].conflit && E.ip[c2].conflit && !E.ip[c3].conflit);
  assert.equal(E.ip[c1].domaine, E.ip[c3].domaine); assert.match(E.ip[c1].domaine, /VLAN 1/);
  assert.ok(E.alertes.some((a) => a.dev === c1 && /Conflit d'adresse avec CAM 2 \(192\.168\.0\.10\)/.test(a.msg)));
  assert.equal(E.reach[`${c3}>${c1}`], false, 'une machine en conflit ne répond pas proprement');
  regler(c2, { 'reseau.ip': '192.168.0.11' });
  const E2 = evaluate(B);
  assert.ok(!E2.ip[c1].conflit && !E2.ip[c2].conflit);
  assert.equal(E2.reach[`${c3}>${c1}`], true);
});

test('IP : en DHCP sans routeur, adresse de lien local injoignable par une machine fixe ; avec un routeur, un bail 192.168.1.100', () => {
  const { sw, bandeau } = socle();
  const rp = out('rp150'); link(rp, 'lan', sw, 'lan-10');
  const hd = out('hyperdeck-hd-plus'); link(hd, 'iec', bandeau, 'out2'); link(hd, 'lan', sw, 'lan-11');
  let E = evaluate(B);
  assert.ok(E.ip[hd].dhcp && linkLocal(E.ip[hd].ip), E.ip[hd].ip);
  assert.equal(E.ip[hd].mask, '255.255.0.0');
  assert.equal(E.reach[`${rp}>${hd}`], false);
  assert.match(explainReach(B, E, rp, hd), /lien local/);
  assert.ok(E.alertes.some((a) => a.dev === hd && /lien local/.test(a.msg)));
  // le switch lui-même est en DHCP : il retombe sur son adresse de secours d'usine
  assert.equal(E.ip[sw].ip, '169.254.100.100');
  const rt = out('routeur'); link(rt, 'lan-1', sw, 'lan-12');
  E = evaluate(B);
  assert.ok(!E.power[rt].on, 'le routeur n\'est pas alimenté : pas de bail');
  assert.ok(linkLocal(E.ip[hd].ip));
  const bloc = out('bloc-12v'); link(bloc, 'iec', bandeau, 'out3'); link(rt, 'dc', bloc, 'out');
  E = evaluate(B);
  assert.ok(E.power[rt].on);
  assert.equal(E.ip[sw].ip, '192.168.1.100', 'le switch, sorti le premier, prend le premier bail');
  assert.equal(E.ip[hd].ip, '192.168.1.101'); assert.equal(E.ip[hd].gw, '192.168.1.1'); assert.equal(E.ip[hd].mask, '255.255.255.0');
  assert.equal(E.ip[rt].ip, '192.168.1.1');
  assert.equal(E.reach[`${hd}>${rt}`], true);
  assert.equal(E.reach[`${rp}>${hd}`], false, 'le RP150 est resté en 192.168.0.9');
});

test('IP : reach dans le même sous-réseau ; un masque ou un sous-réseau faux rend la caméra injoignable', () => {
  const { sw } = socle();
  const rp = out('rp150'); link(rp, 'lan', sw, 'lan-10');
  const c1 = camera(sw, 1);
  let E = evaluate(B);
  assert.equal(E.reach[`${rp}>${c1}`], true); assert.equal(E.reach[`${c1}>${rp}`], true);
  assert.match(explainReach(B, E, rp, c1), /même domaine .* même sous-réseau \(192\.168\.0\.0\/24\)/);
  regler(c1, { 'reseau.ip': '192.168.1.10' }); E = evaluate(B);
  assert.equal(E.reach[`${rp}>${c1}`], false); assert.match(explainReach(B, E, rp, c1), /pas dans le sous-réseau/);
  regler(c1, { 'reseau.ip': '192.168.0.10', 'reseau.mask': '255.255.255.255.0' }); E = evaluate(B);
  assert.equal(E.reach[`${rp}>${c1}`], false); assert.match(explainReach(B, E, rp, c1), /masque .* invalide/i);
  assert.ok(E.alertes.some((a) => a.dev === c1 && /Masque/.test(a.msg)));
  regler(c1, { 'reseau.mask': '255.255.0.0' }); regler(rp, { 'reseau.ip': '192.168.5.9' }); E = evaluate(B);
  assert.equal(E.reach[`${c1}>${rp}`], false, 'vu de la caméra (/16) c\'est le même réseau, mais le RP150 (/24) ne répond pas');
  assert.match(explainReach(B, E, c1, rp), /la réponse ne revient pas/);
  // un autre VLAN sur le port de la caméra : plus le même domaine
  regler(rp, { 'reseau.ip': '192.168.0.9' }); regler(c1, { 'reseau.mask': '255.255.255.0' });
  regler(sw, { 'ports.1.vlan': 20 }); E = evaluate(B);
  assert.equal(E.reach[`${rp}>${c1}`], false); assert.match(E.ip[c1].domaine, /VLAN 20/); assert.match(explainReach(B, E, rp, c1), /domaine de niveau 2/);
  // le switch éteint : plus de lien
  regler(sw, { 'ports.1.vlan': 1 }); debrancher(B.cables.find((c) => c.a.dev === sw && c.a.port === 'iec').uid); E = evaluate(B);
  assert.ok(!E.power[c1].on && !E.ip[rp].link);
});

test('énergie : budget PoE+ dépassé, et un port dont le PoE est coupé n\'alimente plus', () => {
  const { sw } = socle();
  const cams = [1, 2, 3].map((n) => camera(sw, n, `192.168.0.1${n}`));
  regler(sw, { poeBudget: 60 });
  let E = evaluate(B);
  assert.equal(E.poe[sw].used, 75); assert.equal(E.poe[sw].budget, 60); assert.ok(!E.poe[sw].ok);
  assert.ok(E.alertes.some((a) => a.dev === sw && /Budget PoE\+ dépassé : 75 W demandés pour 60 W/.test(a.msg)));
  regler(sw, { 'ports.3.poe': false }); E = evaluate(B);
  assert.ok(!E.power[cams[2]].on); assert.equal(E.poe[sw].used, 50); assert.ok(E.poe[sw].ok);
});

test('vidéo : une caméra en 1080i50 est refusée par l\'ATEM en 1080p50, le programme est noir ; au bon format, PGM, AUX et multiview sortent', () => {
  const { sw, bandeau } = socle();
  const atem = out('atem-hd8-iso'); link(atem, 'iec', bandeau, 'out2');
  const c1 = camera(sw, 1); link(c1, 'sdi-out', atem, 'sdi-in-1');
  const mon = out('moniteur-hdmi'); link(mon, 'sdi-in', atem, 'sdi-out-pgm');
  const bloc = out('bloc-12v'); link(bloc, 'iec', bandeau, 'out3'); link(mon, 'dc', bloc, 'out');
  regler(c1, { format: '1080i50' });
  let E = evaluate(B);
  assert.equal(E.video[`${atem}:sdi-in-1`].format, '1080i50', 'le flux arrive bien à l\'entrée');
  assert.ok(E.alertes.some((a) => a.dev === atem && /Format 1080i50 refusé par ATEM HD8 sur l'entrée 1 \(réglé en 1080p50\)/.test(a.msg)), JSON.stringify(E.alertes));
  assert.equal(E.video[`${mon}:sdi-in`].label, 'PGM (noir)');
  regler(c1, { format: '1080p50' }); E = evaluate(B);
  const pgm = E.video[`${mon}:sdi-in`];
  assert.equal(pgm.label, 'PGM'); assert.equal(pgm.src, atem); assert.equal(pgm.format, '1080p50'); assert.deepEqual(pgm.via, [c1]);
  assert.ok(!E.alertes.some((a) => /refusé/.test(a.msg)));
  // la caméra éteinte : rien à l'entrée, programme noir
  regler(c1, { sdiOut: false }); E = evaluate(B);
  assert.equal(E.video[`${atem}:sdi-in-1`], null); assert.equal(E.video[`${mon}:sdi-in`].label, 'PGM (noir)');
  regler(c1, { sdiOut: true });
  // multiview et AUX
  debrancher(B.cables.find((c) => c.a.dev === mon && c.a.port === 'sdi-in').uid); link(mon, 'sdi-in', atem, 'sdi-out-mv'); E = evaluate(B);
  assert.equal(E.video[`${mon}:sdi-in`].label, 'Multiview');
  debrancher(B.cables.find((c) => c.a.dev === mon && c.a.port === 'sdi-in').uid); link(mon, 'sdi-in', atem, 'sdi-out-aux-1'); regler(atem, { 'aux.1': 1 }); E = evaluate(B);
  assert.equal(E.video[`${mon}:sdi-in`].label, 'CAM 1'); assert.equal(E.video[`${mon}:sdi-in`].src, c1);
  // un moniteur sur HDMI de l'ATEM voit le multiview (le modèle a une sortie MV à part)
  const mon2 = out('moniteur-hdmi'); link(mon2, 'hdmi-in', atem, 'hdmi-out'); const bloc2 = out('bloc-12v'); link(bloc2, 'iec', bandeau, 'out4'); link(mon2, 'dc', bloc2, 'out'); E = evaluate(B);
  assert.equal(E.video[`${mon2}:hdmi-in`].label, 'Multiview');
});

test('vidéo : boucle du HyperDeck, Teranex embedder (micro sur la paire 1), HyperDeck qui enregistre quand il a une carte et REC', () => {
  const { sw, bandeau } = socle();
  const atem = out('atem-hd8-iso'); link(atem, 'iec', bandeau, 'out2');
  const c1 = camera(sw, 1);
  const ter = out('teranex-audio-sdi'); link(ter, 'lan', sw, 'lan-5');
  const mic = out('micro-xlr'); link(mic, 'out', ter, 'audio-in-1');
  link(c1, 'sdi-out', ter, 'sdi-in'); link(ter, 'sdi-out', atem, 'sdi-in-1');
  const hd = out('hyperdeck-hd-plus'); link(hd, 'iec', bandeau, 'out3'); link(atem, 'sdi-out-pgm', hd, 'sdi-in');
  const mon = out('moniteur-hdmi'); link(hd, 'sdi-loop', mon, 'sdi-in'); const bloc = out('bloc-12v'); link(bloc, 'iec', bandeau, 'out4'); link(mon, 'dc', bloc, 'out');
  let E = evaluate(B);
  const inAtem = E.video[`${atem}:sdi-in-1`];
  assert.equal(inAtem.src, c1); assert.deepEqual(inAtem.via, [ter]); assert.deepEqual(inAtem.audio, [{ ch: 1, from: mic }, { ch: 2, from: mic }]);
  assert.equal(E.services[`${ter}:audio`].ok, true);
  const rec = E.video[`${hd}:sdi-in`];
  assert.equal(rec.label, 'PGM'); assert.deepEqual(rec.audio, [{ ch: 1, from: mic }, { ch: 2, from: mic }], 'AFV : la caméra à l\'antenne apporte son audio');
  assert.equal(E.video[`${mon}:sdi-in`].label, 'PGM'); assert.deepEqual(E.video[`${mon}:sdi-in`].via, [ter, c1, hd], 'la boucle du HyperDeck recopie le programme : Teranex, caméra, HyperDeck');
  assert.ok(!E.services[`${hd}:enregistre`].ok); assert.match(E.services[`${hd}:enregistre`].why, /pas de carte/);
  assert.ok(E.alertes.some((a) => a.dev === hd && /pas de carte/.test(a.msg)));
  const sd = out('carte-sd'); link(sd, 'sd', hd, 'sd2'); E = evaluate(B);
  assert.match(E.services[`${hd}:enregistre`].why, /support choisi \(sd1\) est vide/);
  regler(hd, { media: 'sd2' }); E = evaluate(B);
  assert.match(E.services[`${hd}:enregistre`].why, /REC/);
  regler(hd, { enregistre: true }); E = evaluate(B);
  assert.ok(E.services[`${hd}:enregistre`].ok); assert.match(E.services[`${hd}:enregistre`].label, /Enregistre PGM \(1080p50, H.264\) sur SD/);
  // la paire 2 : le micro passe en voies 3-4, et l'entrée 1 en « off » le fait disparaître du programme
  regler(ter, { paire: 2 }); E = evaluate(B);
  assert.deepEqual(E.video[`${hd}:sdi-in`].audio.map((x) => x.ch), [3, 4]);
  regler(atem, { 'audio.1': 'off' }); E = evaluate(B);
  assert.deepEqual(E.video[`${hd}:sdi-in`].audio, []);
  // le micro débranché : le Teranex n'embarque rien et le dit
  debrancher(B.cables.find((c) => c.a.dev === mic).uid); E = evaluate(B);
  assert.ok(!E.services[`${ter}:audio`].ok); assert.match(E.services[`${ter}:audio`].why, /Aucune source audio/);
});

/** le montage complet de la mission Conférence, adressé en 192.168.10.x */
function conference() {
  vider('conference');
  const bandeau = out('bandeau'); link(bandeau, 'in', 'mur', 'prise1');
  const sw = out('switch-m4250'); link(sw, 'iec', bandeau, 'out1'); regler(sw, { reseau: { dhcp: false, ip: '192.168.10.1', mask: '255.255.255.0', gw: '' } });
  const atem = out('atem-hd8-iso'); link(atem, 'iec', bandeau, 'out2'); link(atem, 'lan-1', sw, 'lan-20');
  regler(atem, { reseau: { dhcp: false, ip: '192.168.10.240', mask: '255.255.255.0', gw: '192.168.10.1' }, pgm: 1, 'audio.1': 'on' });
  const cams = [1, 2, 3].map((n) => { const c = camera(sw, n, `192.168.10.1${n}`); regler(c, { 'reseau.gw': '192.168.10.1' }); return c; });
  const ter = out('teranex-audio-sdi'); link(ter, 'lan', sw, 'lan-13'); regler(ter, { reseau: { dhcp: false, ip: '192.168.10.60', mask: '255.255.255.0', gw: '192.168.10.1' } });
  const mic = out('micro-xlr'); link(mic, 'out', ter, 'audio-in-1');
  link(cams[0], 'sdi-out', ter, 'sdi-in'); link(ter, 'sdi-out', atem, 'sdi-in-1'); link(cams[1], 'sdi-out', atem, 'sdi-in-2'); link(cams[2], 'sdi-out', atem, 'sdi-in-3');
  const rp = out('rp150'); link(rp, 'lan', sw, 'lan-10');
  regler(rp, { reseau: { dhcp: false, ip: '192.168.10.9', mask: '255.255.255.0', gw: '192.168.10.1' }, tallyIp: true });
  cams.forEach((c, i) => regler(rp, { [`cameras.${i}.mode`]: 'ip', [`cameras.${i}.ip`]: `192.168.10.1${i + 1}` }));
  const gt = out('gpi-tally'); link(gt, 'lan', sw, 'lan-11'); regler(gt, { atemIp: '192.168.10.240' });
  const bloc = out('bloc-12v'); link(bloc, 'iec', bandeau, 'out3'); link(gt, 'dc', bloc, 'out');
  link(gt, 'tally', rp, 'gpio1');
  const hd = out('hyperdeck-hd-plus'); link(hd, 'iec', bandeau, 'out4'); link(hd, 'lan', sw, 'lan-12'); link(atem, 'sdi-out-pgm', hd, 'sdi-in');
  regler(hd, { reseau: { dhcp: false, ip: '192.168.10.50', mask: '255.255.255.0', gw: '192.168.10.1' }, media: 'sd1', enregistre: true });
  const sd = out('carte-sd'); link(sd, 'sd', hd, 'sd1');
  return { sw, atem, cams, ter, mic, rp, gt, hd, bandeau, bloc };
}

test('services et tally : la chaîne complète ATEM → GPI & Tally → D-sub → RP150 (TALLY IP) → caméra du slot à l\'antenne', () => {
  const { atem, cams, rp, gt } = conference();
  let E = evaluate(B);
  assert.ok(E.services[`${gt}:atem:${atem}`].ok, JSON.stringify(E.services[`${gt}:atem:${atem}`]));
  for (const c of cams) { assert.ok(E.services[`${rp}:ptz-http:${c}`].ok); assert.ok(E.services[`${rp}:tally-ip:${c}`].ok); }
  assert.deepEqual(cams.map((c) => E.tally[c].pgm), [true, false, false]);
  assert.deepEqual(cams.map((c) => E.tally[c].pvw), [false, true, false], 'PVW sur l\'entrée 2');
  assert.match(E.tally[cams[0]].via, /ATEM HD8 → GPI Tally → RP150 \(GPI 1, TALLY IP\) → CAM 1/);
  regler(atem, { pgm: 2 }); E = evaluate(B);
  assert.deepEqual(cams.map((c) => E.tally[c].pgm), [false, true, false]);
  assert.deepEqual(cams.map((c) => tallyWould(B, atem, 3)[c].pgm), [false, false, true]);
  // sans TALLY IP : rien, et l'explication le dit
  regler(rp, { tallyIp: false }); E = evaluate(B);
  assert.ok(!E.tally[cams[1]].pgm);
  assert.ok(E.alertes.some((a) => a.dev === cams[1] && /tally reste éteint : TALLY IP est sur OFF/.test(a.msg)), JSON.stringify(E.alertes.filter((a) => a.dev === cams[1])));
  regler(rp, { tallyIp: true });
  // le D-sub débranché
  const dsub = B.cables.find((c) => c.a.dev === gt && c.a.port === 'tally'); debrancher(dsub.uid); E = evaluate(B);
  assert.ok(!E.tally[cams[1]].pgm); assert.ok(E.alertes.some((a) => a.dev === cams[1] && /pas de câble D-sub 25/.test(a.msg)));
  link(gt, 'tally', rp, 'gpio1');
  // le GPI & Tally cherche la mauvaise adresse
  regler(gt, { atemIp: '192.168.10.241' }); E = evaluate(B);
  assert.ok(!E.tally[cams[1]].pgm); assert.match(E.services[`${gt}:atem:192.168.10.241`].why, /cherche l'ATEM en 192\.168\.10\.241 : personne/);
  regler(gt, { atemIp: '192.168.10.240' });
  // le slot 2 du RP150 pilote CAM 3 : c'est CAM 3 qui s'allume quand l'entrée 2 est à l'antenne (mauvais mapping)
  regler(rp, { 'cameras.1.ip': '192.168.10.13' }); E = evaluate(B);
  assert.ok(!E.tally[cams[1]].pgm && E.tally[cams[2]].pgm);
  assert.ok(E.alertes.some((a) => a.dev === cams[1] && /le slot 2 de RP150 pilote CAM 3/.test(a.msg)));
  // le RP150 cherche une adresse où il n'y a personne
  regler(rp, { 'cameras.1.ip': '192.168.10.99' }); E = evaluate(B);
  assert.match(E.services[`${rp}:ptz-http:192.168.10.99`].why, /RP150 cherche 192\.168\.10\.99 : personne/);
  assert.ok(E.alertes.some((a) => a.dev === rp && /cherche 192\.168\.10\.99/.test(a.msg)));
});

test('contrôle PTZ en série : le slot en « serial » pilote la caméra câblée en RS-422, et le tally passe aussi', () => {
  const { cams, rp, atem } = conference();
  regler(rp, { 'cameras.0.mode': 'serial' });
  let E = evaluate(B);
  assert.ok(!E.services[`${rp}:ptz-serial:slot1`].ok); assert.match(E.services[`${rp}:ptz-serial:slot1`].why, /rien n'est branché/);
  link(rp, 'serial', cams[0], 'rs422'); E = evaluate(B);
  assert.ok(E.services[`${rp}:ptz-serial:${cams[0]}`].ok);
  regler(atem, { pgm: 1 }); E = evaluate(B); assert.ok(E.tally[cams[0]].pgm);
  regler(cams[0], { serie: 'rs232' }); E = evaluate(B);
  assert.match(E.services[`${rp}:ptz-serial:${cams[0]}`].why, /RS232/);
});

test('mission Conférence : 100 sur le montage complet, moins sans tally, moins avec un HyperDeck qui n\'enregistre pas, moins en DHCP', () => {
  const m = missionById('conference'); assert.ok(m && m.exigences.length >= 8);
  const { rp, hd, cams, gt } = conference();
  let E = evaluate(B);
  let N = noter(m, B, E, CATALOGUE);
  assert.equal(N.score, 100, JSON.stringify(N.items.filter((i) => !i.ok), null, 1));
  assert.ok(N.budget.ok && N.budget.used > 0 && N.budget.used <= 25000, JSON.stringify(N.budget));
  assert.ok(!E.alertes.some((a) => a.level === 'erreur'), JSON.stringify(E.alertes));
  regler(rp, { tallyIp: false }); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.ok(N.score < 100); assert.ok(!N.items.find((i) => i.id === 'tally').ok); assert.match(N.items.find((i) => i.id === 'tally').why, /TALLY IP/);
  regler(rp, { tallyIp: true });
  regler(hd, { enregistre: false }); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  const rec = N.items.find((i) => i.id === 'enregistrement'); assert.ok(!rec.ok && rec.partiel); assert.match(rec.why, /REC/);
  assert.ok(N.items.find((i) => i.id === 'micro').ok, 'le micro se juge sur le programme, même sans REC');
  regler(hd, { enregistre: true });
  regler(cams[2], { 'reseau.dhcp': true }); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  const adr = N.items.find((i) => i.id === 'adresses'); assert.ok(!adr.ok); assert.match(adr.why, /en DHCP : CAM 3/);
  assert.ok(!N.items.find((i) => i.id === 'pilotage').ok, 'en lien local, le RP150 ne la joint plus');
  regler(cams[2], { 'reseau.dhcp': false });
  // la caméra 2 non alimentée (PoE coupé sur son port)
  const sw = B.appareils.find((a) => a.modele === 'switch-m4250').uid; regler(sw, { 'ports.2.poe': false }); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.match(N.items.find((i) => i.id === 'alimentation').why, /CAM 2/); assert.ok(N.items.find((i) => i.id === 'cameras').partiel);
  regler(sw, { 'ports.2.poe': true });
  // sans le GPI & Tally : l'explication
  debrancher(B.cables.find((c) => c.a.dev === gt && c.a.port === 'lan').uid); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.match(N.items.find((i) => i.id === 'tally').why, /ne joint pas l'ATEM/);
  assert.equal(noter(m, B, E, CATALOGUE).score, N.score);
});

test('mission Plateau TV : ATEM en DHCP du routeur, ISO sur disque USB-C, streaming par la box, multiview sur le moniteur', () => {
  const m = missionById('plateau-iso'); assert.ok(m);
  vider('plateau-iso');
  const bandeau = out('bandeau'); link(bandeau, 'in', 'mur', 'prise1');
  const sw = out('switch-m4250'); link(sw, 'iec', bandeau, 'out1');
  const rt = out('routeur'); const bloc = out('bloc-12v'); link(bloc, 'iec', bandeau, 'out3'); link(rt, 'dc', bloc, 'out'); link(rt, 'lan-1', sw, 'lan-24');
  const atem = out('atem-hd8-iso'); link(atem, 'iec', bandeau, 'out2'); link(atem, 'lan-1', sw, 'lan-20');
  const cams = [1, 2].map((n) => { const c = camera(sw, n); regler(c, { 'reseau.dhcp': true }); return c; });
  link(cams[0], 'sdi-out', atem, 'sdi-in-1'); link(cams[1], 'sdi-out', atem, 'sdi-in-2');
  const mic = out('micro-xlr'); link(mic, 'out', atem, 'audio-in-1'); regler(atem, { 'audio.mic1': 'on', iso: true, 'stream.on': true, 'stream.cle': 'abcd-1234' });
  const mon = out('moniteur-hdmi'); link(mon, 'hdmi-in', atem, 'hdmi-out'); const blocMon = out('bloc-12v'); link(blocMon, 'iec', bandeau, 'out5'); link(mon, 'dc', blocMon, 'out');
  const rp = out('rp150'); link(rp, 'lan', sw, 'lan-10'); regler(rp, { 'reseau.dhcp': true, tallyIp: true });
  const gt = out('gpi-tally'); link(gt, 'lan', sw, 'lan-11'); regler(gt, { 'reseau.dhcp': true }); link(gt, 'tally', rp, 'gpio1');
  let E = evaluate(B);
  assert.ok(!E.power[gt].on, 'le GPI & Tally n\'a pas de 12 V');
  // les baux : dans l'ordre des appareils sortis (switch, ATEM, caméras, RP150, GPI & Tally) ; le GPI & Tally éteint n'en a pas
  assert.equal(E.ip[sw].ip, '192.168.1.100'); assert.equal(E.ip[atem].ip, '192.168.1.101'); assert.equal(E.ip[cams[0]].ip, '192.168.1.102'); assert.equal(E.ip[rp].ip, '192.168.1.104');
  assert.ok(!E.services[`${atem}:iso`].ok, 'pas encore de disque'); assert.ok(E.services[`${atem}:rtmp:internet`].ok, JSON.stringify(E.services[`${atem}:rtmp:internet`]));
  let N = noter(m, B, E, CATALOGUE);
  assert.ok(N.items.find((i) => i.id === 'stream').ok, JSON.stringify(N.items.find((i) => i.id === 'stream')));
  assert.ok(!N.items.find((i) => i.id === 'iso').ok); assert.match(N.items.find((i) => i.id === 'iso').why, /aucun disque/);
  assert.ok(N.items.find((i) => i.id === 'multiview').ok, 'l\'HDMI de l\'ATEM porte le multiview');
  assert.ok(N.items.find((i) => i.id === 'micro').ok);
  assert.ok(!N.items.find((i) => i.id === 'pilotage').ok, 'les slots du RP150 ne sont pas réglés');
  const ssd = out('disque-usbc'); link(ssd, 'usbc', atem, 'usbc-1');
  const bloc2 = out('bloc-12v'); link(bloc2, 'iec', bandeau, 'out4'); link(gt, 'dc', bloc2, 'out');
  E = evaluate(B);
  regler(gt, { atemIp: E.ip[atem].ip });
  cams.forEach((c, i) => regler(rp, { [`cameras.${i}.mode`]: 'ip', [`cameras.${i}.ip`]: E.ip[c].ip }));
  E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.equal(N.score, 100, JSON.stringify(N.items.filter((i) => !i.ok), null, 1));
  regler(rt, { wan: 'aucun' }); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.match(N.items.find((i) => i.id === 'stream').why, /WAN : aucun/);
  regler(rt, { wan: '4g', 'lan.dhcp.on': false }); E = evaluate(B);
  assert.ok(linkLocal(E.ip[atem].ip), 'le DHCP coupé : lien local'); assert.ok(!E.services[`${atem}:rtmp:internet`].ok);
});

test('mission Régie vMix : NDI|HX et SDI dans vMix, PGM par la DeckLink vers le HyperDeck (REMOTE) et le Teranex désembedder, PTZ et tally vMix', () => {
  const m = missionById('regie-vmix'); assert.ok(m);
  vider('regie-vmix');
  const bandeau = out('bandeau'); link(bandeau, 'in', 'mur', 'prise1');
  const sw = out('switch-m4250'); link(sw, 'iec', bandeau, 'out1'); regler(sw, { reseau: { dhcp: false, ip: '192.168.0.2', mask: '255.255.255.0', gw: '' } });
  const pc = out('pc-regie'); link(pc, 'iec', bandeau, 'out2'); link(pc, 'lan', sw, 'lan-20'); regler(pc, { reseau: { dhcp: false, ip: '192.168.0.100', mask: '255.255.255.0', gw: '' } });
  const c1 = camera(sw, 1, '192.168.0.11'), c2 = camera(sw, 2, '192.168.0.12');
  regler(c1, { ndi: true });
  link(c2, 'sdi-out', pc, 'decklink-1');
  regler(pc, { 'vmix.entrees': [{ type: 'ndi', source: 'CAM 1' }, { type: 'decklink', source: '1' }], 'vmix.ptz': [{ ip: '192.168.0.11', modele: 'he130' }, { ip: '192.168.0.12', modele: 'he130' }], 'vmix.pgm': 1 });
  const hd = out('hyperdeck-hd-plus'); link(hd, 'iec', bandeau, 'out3'); link(hd, 'lan', sw, 'lan-12'); link(pc, 'decklink-3', hd, 'sdi-in');
  regler(hd, { reseau: { dhcp: false, ip: '192.168.0.50', mask: '255.255.255.0', gw: '' }, enregistre: true });
  const sd = out('carte-sd'); link(sd, 'sd', hd, 'sd1');
  const ter = out('teranex-sdi-audio'); link(ter, 'lan', sw, 'lan-13'); link(pc, 'decklink-4', ter, 'sdi-in'); regler(ter, { reseau: { dhcp: false, ip: '192.168.0.60', mask: '255.255.255.0', gw: '' } });
  const mon = out('moniteur-hdmi'); link(ter, 'sdi-loop', mon, 'sdi-in'); const bloc = out('bloc-12v'); link(bloc, 'iec', bandeau, 'out4'); link(mon, 'dc', bloc, 'out');
  let E = evaluate(B);
  assert.ok(E.services[`${pc}:ndi:${c1}`].ok, JSON.stringify(E.services[`${pc}:ndi:${c1}`]));
  assert.equal(E.video[`${pc}:decklink-1`].src, c2);
  assert.equal(E.video[`${hd}:sdi-in`].label, 'PGM'); assert.equal(E.video[`${hd}:sdi-in`].src, pc); assert.deepEqual(E.video[`${hd}:sdi-in`].via, [c1]);
  assert.ok(E.services[`${hd}:enregistre`].ok);
  assert.ok(E.tally[c1].pgm && !E.tally[c2].pgm); assert.match(E.tally[c1].via, /vMix/);
  assert.ok(tallyWould(B, pc, 2)[c2].pgm);
  let N = noter(m, B, E, CATALOGUE);
  const ter1 = N.items.find((i) => i.id === 'teranex'); assert.ok(!ter1.ok && !ter1.partiel, 'la caméra n\'a pas d\'audio : rien sur les voies 1-2');
  for (const id of ['ndi', 'sdi', 'hyperdeck', 'pilotage', 'tally', 'adresses', 'alimentation']) assert.ok(N.items.find((i) => i.id === id).ok, id + ' : ' + N.items.find((i) => i.id === id).why);
  // un micro embarqué par un Teranex embedder avant la DeckLink : le désembedder a ses voies 1-2
  const emb = out('teranex-audio-sdi'); link(emb, 'lan', sw, 'lan-14'); regler(emb, { reseau: { dhcp: false, ip: '192.168.0.61', mask: '255.255.255.0', gw: '' } }); const mic = out('micro-xlr'); link(mic, 'out', emb, 'audio-in-1');
  debrancher(B.cables.find((c) => c.a.dev === c2 && c.a.port === 'sdi-out').uid); link(c2, 'sdi-out', emb, 'sdi-in'); link(emb, 'sdi-out', pc, 'decklink-1');
  regler(pc, { 'vmix.pgm': 2 }); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.ok(E.services[`${ter}:audio`].ok, E.services[`${ter}:audio`].why);
  assert.equal(N.score, 100, JSON.stringify(N.items.filter((i) => !i.ok), null, 1));
  regler(hd, { distant: false }); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.match(N.items.find((i) => i.id === 'hyperdeck').why, /REMOTE/);
  regler(c1, { ndi: false }); E = evaluate(B);
  assert.match(E.services[`${pc}:ndi:${c1}`].why, /NDI\|HX n'est pas activé/);
});

test('ATEM → HyperDeck piloté (9993) et PC en ATEM Software Control ; moniteur sans signal ; chaque mission a ses exigences testables', () => {
  const { atem, hd, sw, bandeau } = conference();
  regler(atem, { 'hyperdecks.0.ip': '192.168.10.50' });
  let E = evaluate(B);
  assert.ok(E.services[`${atem}:hyperdeck:${hd}`].ok);
  regler(hd, { distant: false }); E = evaluate(B); assert.match(E.services[`${atem}:hyperdeck:${hd}`].why, /REMOTE est sur OFF/);
  regler(atem, { 'hyperdecks.0.ip': '192.168.10.51' }); E = evaluate(B); assert.match(E.services[`${atem}:hyperdeck:192.168.10.51`].why, /personne/);
  const pc = out('pc-regie'); link(pc, 'iec', bandeau, 'out5'); link(pc, 'lan', sw, 'lan-21'); regler(pc, { logiciel: 'atem-control', reseau: { dhcp: false, ip: '192.168.10.100', mask: '255.255.255.0', gw: '' } });
  E = evaluate(B); assert.ok(E.services[`${pc}:atem:${atem}`].ok);
  const mon = out('moniteur-hdmi'); E = evaluate(B); assert.ok(!E.power[mon].on);
  for (const x of MISSIONS) { assert.ok(x.exigences.length >= 7 && x.budget > 0 && x.competences.length >= 3, x.id); for (const e of x.exigences) { const r = e.test(B, E); assert.equal(typeof r.ok, 'boolean'); assert.equal(typeof r.why, 'string'); assert.ok(!/undefined|NaN|\[object/.test(r.why), `${x.id}/${e.id} : ${r.why}`); } }
  vider('');
  for (const x of MISSIONS) for (const e of x.exigences) { const r = e.test(B, evaluate(B)); assert.ok(!r.ok && typeof r.why === 'string' && r.why.length > 3, `${x.id}/${e.id} sur un montage vide`); }
});
