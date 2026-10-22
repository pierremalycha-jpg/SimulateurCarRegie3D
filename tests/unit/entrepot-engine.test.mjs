// Le moteur de l'entrepôt (engine.js) et les missions (missions.js), sur le vrai catalogue : les
// identifiants de ports et les clés cfg sont ceux des groupes blackmagic, panasonic, ross, reseau et
// divers. Chaque test construit son montage à la main (build.js) et lit le résultat du moteur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/dom.mjs';
import { CATALOGUE } from '../../src/entrepot/catalogue/index.js';
import { B, vider, sortir, relier, regler, debrancher, setSaving } from '../../src/entrepot/build.js';
import { evaluate, tallyWould, explainReach, linkLocal, numOf, switchPortNum, BANDEAU_W } from '../../src/entrepot/engine.js';
import { MISSIONS, missionById, noter } from '../../src/entrepot/missions.js';

setSaving(false);

// ---------------- outils de montage ----------------
const out = (id) => { const r = sortir(id); assert.ok(r.ok, `${id} : ${r.why}`); return r.uid; };
const link = (a, pa, b, pb) => { const r = relier({ dev: a, port: pa }, { dev: b, port: pb }); assert.ok(r.ok, `${a}:${pa} ↔ ${b}:${pb} : ${r.why}`); return r.uid; };
const cableDe = (dev, port) => B.cables.find((c) => (c.a.dev === dev && c.a.port === port) || (c.b.dev === dev && c.b.port === port));
const fixe = (ip, gw = '') => ({ dhcp: false, ip, mask: '255.255.255.0', gw });
/** le socle : mur, bandeau, switch alimenté par le bandeau */
function socle(mission = '') {
  vider(mission);
  const bandeau = out('bandeau'); link(bandeau, 'in', 'mur', 'prise1');
  const sw = out('switch-m4250'); link(sw, 'iec', bandeau, 'out1');
  return { bandeau, sw };
}
/** une caméra d'usine (AW-HE130 : 192.168.0.10, 1080i50) sur le port n du switch (PoE+) */
function camera(sw, n, ip = '', modele = 'he130') {
  const c = out(modele); link(c, 'lan', sw, `port-${n}`);
  if (ip) regler(c, { 'reseau.ip': ip });
  return c;
}
/** un bloc 12 V sur une prise du bandeau, pour un appareil en 12 V */
function douzeVolts(bandeau, prise, dev) { const bloc = out('bloc-12v'); link(bloc, 'iec', bandeau, `out${prise}`); link(dev, 'dc', bloc, 'dc'); return bloc; }

test('le catalogue réel a ce que le moteur lit : familles, ports et clés cfg du brief', () => {
  for (const id of ['he130', 'he20', 'rp150', 'atem-hd8-iso', 'carbonite-solo13', 'hyperdeck-hd-plus', 'hyperdeck-hd-mini', 'teranex-sdi-audio', 'teranex-audio-sdi', 'gpi-tally', 'switch-m4250', 'routeur', 'pc-regie', 'bloc-12v', 'moniteur-hdmi', 'micro-xlr', 'disque-usbc', 'carte-sd']) assert.ok(CATALOGUE[id], id);
  const port = (m, id) => CATALOGUE[m].ports.find((p) => p.id === id);
  assert.ok(port('he130', 'sdi-out') && port('he130', 'lan').poe && port('he130', 'lan').nic && port('he130', 'rs422').dir === 'in');
  assert.ok(port('rp150', 'gpio1').sig === 'tally' && port('rp150', 'serial-1').sig === 'rs422' && Array.isArray(CATALOGUE.rp150.cfg.cameras) && CATALOGUE.rp150.cfg.tallyIn === 'gpio1');
  assert.ok(port('gpi-tally', 'gpio').sig === 'tally' && 'atemIp' in CATALOGUE['gpi-tally'].cfg);
  assert.ok(port('atem-hd8-iso', 'sdi-out-pgm') && port('atem-hd8-iso', 'sdi-out-mv') && port('atem-hd8-iso', 'lan-4').nic && 'pgm' in CATALOGUE['atem-hd8-iso'].cfg && Array.isArray(CATALOGUE['atem-hd8-iso'].cfg.hyperdecks));
  assert.ok(port('hyperdeck-hd-plus', 'sdi-in').thru === 'sdi-loop' && port('hyperdeck-hd-plus', 'sd1').sig === 'media' && 'source' in CATALOGUE['hyperdeck-hd-plus'].cfg);
  assert.ok(port('teranex-audio-sdi', 'xlr-in-1').sig === 'audio' && port('teranex-sdi-audio', 'xlr-out-1').dir === 'out' && CATALOGUE['teranex-audio-sdi'].cfg.paire === 1);
  assert.ok(port('switch-m4250', 'port-1').poe && CATALOGUE['switch-m4250'].cfg.ports[1].vlan === 1 && CATALOGUE['switch-m4250'].cfg.poeBudget === 300);
  assert.ok(port('routeur', 'wan') && CATALOGUE.routeur.cfg.lan.dhcp.on && port('pc-regie', 'sdi-1').dir === 'io' && CATALOGUE['pc-regie'].cfg.decklink[1] === 'in');
  assert.ok(port('carte-sd', 'sd').sig === 'media' && port('disque-usbc', 'usbc').sig === 'usb' && port('micro-xlr', 'out').sig === 'audio');
  assert.equal(numOf('sdi-in-3'), 3); assert.equal(numOf('lan'), 0); assert.equal(switchPortNum('port-27'), 27);
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

test('IP : en DHCP sans routeur, adresse de lien local injoignable par une machine fixe ; avec un routeur allumé, des baux 192.168.1.100+', () => {
  const { sw, bandeau } = socle();
  const rp = out('rp150'); link(rp, 'lan', sw, 'port-10');
  const hd = out('hyperdeck-hd-plus'); link(hd, 'iec', bandeau, 'out2'); link(hd, 'lan', sw, 'port-11');
  let E = evaluate(B);
  assert.ok(E.ip[hd].dhcp && linkLocal(E.ip[hd].ip), E.ip[hd].ip);
  assert.equal(E.ip[hd].mask, '255.255.0.0');
  assert.equal(E.reach[`${rp}>${hd}`], false);
  assert.match(explainReach(B, E, rp, hd), /lien local/);
  assert.ok(E.alertes.some((a) => a.dev === hd && /lien local/.test(a.msg)));
  assert.equal(E.ip[sw].ip, '169.254.100.100', 'le switch en DHCP retombe sur son adresse de secours d\'usine');
  const rt = out('routeur'); link(rt, 'lan-1', sw, 'port-12');
  E = evaluate(B);
  assert.ok(!E.power[rt].on, 'le routeur n\'est pas alimenté : pas de bail');
  assert.ok(linkLocal(E.ip[hd].ip));
  link(rt, 'alim', bandeau, 'out3');
  E = evaluate(B);
  assert.ok(E.power[rt].on);
  assert.equal(E.ip[sw].ip, '192.168.1.100', 'le switch, sorti le premier, prend le premier bail');
  assert.equal(E.ip[hd].ip, '192.168.1.101'); assert.equal(E.ip[hd].gw, '192.168.1.1'); assert.equal(E.ip[hd].mask, '255.255.255.0');
  assert.equal(E.ip[rt].ip, '192.168.1.1'); assert.match(E.ip[rt].domaine, /VLAN 1/);
  assert.equal(E.reach[`${hd}>${rt}`], true);
  assert.equal(E.reach[`${rp}>${hd}`], false, 'le RP150 est resté en 192.168.0.9');
  regler(rt, { 'lan.dhcp.on': false }); E = evaluate(B); assert.ok(linkLocal(E.ip[hd].ip), 'DHCP coupé sur le routeur : lien local');
});

test('IP : reach dans le même sous-réseau ; un sous-réseau ou un masque faux, un autre VLAN, un switch éteint rendent la caméra injoignable', () => {
  const { sw } = socle();
  const rp = out('rp150'); link(rp, 'lan', sw, 'port-10');
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
  regler(rp, { 'reseau.ip': '192.168.0.9' }); regler(c1, { 'reseau.mask': '255.255.255.0' });
  regler(sw, { 'ports.1.vlan': 20 }); E = evaluate(B);
  assert.equal(E.reach[`${rp}>${c1}`], false); assert.match(E.ip[c1].domaine, /VLAN 20/); assert.match(explainReach(B, E, rp, c1), /domaine de niveau 2/);
  regler(sw, { 'ports.1.vlan': 1 }); debrancher(cableDe(sw, 'iec').uid); E = evaluate(B);
  assert.ok(!E.power[c1].on && !E.ip[rp].link);
  assert.match(explainReach(B, E, rp, c1), /pas alimenté/);
});

test('énergie : budget PoE+ dépassé, PoE coupé sur un port, puissance débitée repliée dans le switch et le bloc, fusible du bandeau', () => {
  const { sw, bandeau } = socle();
  const cams = [1, 2, 3].map((n) => camera(sw, n, `192.168.0.1${n}`));
  regler(sw, { poeBudget: 60 });
  let E = evaluate(B);
  assert.equal(E.poe[sw].used, 75); assert.equal(E.poe[sw].budget, 60); assert.ok(!E.poe[sw].ok);
  assert.ok(E.alertes.some((a) => a.dev === sw && /Budget PoE\+ dépassé : 75 W demandés pour 60 W/.test(a.msg)));
  assert.equal(E.power[sw].watts, CATALOGUE['switch-m4250'].watts + 75, 'le switch tire du secteur sa consommation plus ce qu\'il débite en PoE+');
  regler(sw, { 'ports.3.poe': false }); E = evaluate(B);
  assert.ok(!E.power[cams[2]].on); assert.equal(E.poe[sw].used, 50); assert.ok(E.poe[sw].ok);
  // trop sur un bandeau : sept PC de régie à 350 W
  for (let i = 2; i <= 8; i++) { const pc = out('pc-regie'); link(pc, 'iec', bandeau, `out${i}`); }
  E = evaluate(B);
  assert.ok(E.alertes.some((a) => a.dev === bandeau && /bandeau de 10 A/.test(a.msg)), JSON.stringify(E.alertes.filter((a) => a.dev === bandeau)));
  assert.equal(BANDEAU_W, 2300);
});

test('vidéo : la caméra d\'usine (1080i50) est refusée par l\'ATEM en 1080p50 et le programme est noir ; au bon format, PGM, AUX, multiview et HDMI sortent', () => {
  const { sw, bandeau } = socle();
  const atem = out('atem-hd8-iso'); link(atem, 'iec', bandeau, 'out2');
  const c1 = camera(sw, 1); link(c1, 'sdi-out', atem, 'sdi-in-1');
  const mon = out('moniteur-hdmi'); link(mon, 'iec', bandeau, 'out3'); link(mon, 'sdi-in', atem, 'sdi-out-pgm');
  let E = evaluate(B);
  assert.equal(E.video[`${atem}:sdi-in-1`].format, '1080i50', 'le flux arrive bien à l\'entrée');
  assert.ok(E.alertes.some((a) => a.dev === atem && /Format 1080i50 refusé par ATEM HD8 sur l'entrée 1 \(réglé en 1080p50\)/.test(a.msg)), JSON.stringify(E.alertes));
  assert.equal(E.video[`${mon}:sdi-in`].label, 'PGM (noir)');
  regler(c1, { format: '1080p50' }); E = evaluate(B);
  const pgm = E.video[`${mon}:sdi-in`];
  assert.equal(pgm.label, 'PGM'); assert.equal(pgm.src, atem); assert.equal(pgm.format, '1080p50'); assert.deepEqual(pgm.via, [c1]);
  assert.ok(!E.alertes.some((a) => /refusé/.test(a.msg)));
  regler(c1, { sdiOut: false }); E = evaluate(B);
  assert.equal(E.video[`${atem}:sdi-in-1`], null); assert.equal(E.video[`${mon}:sdi-in`].label, 'PGM (noir)');
  regler(c1, { sdiOut: true });
  debrancher(cableDe(mon, 'sdi-in').uid); link(mon, 'sdi-in', atem, 'sdi-out-mv'); E = evaluate(B);
  assert.equal(E.video[`${mon}:sdi-in`].label, 'Multiview');
  debrancher(cableDe(mon, 'sdi-in').uid); link(mon, 'sdi-in', atem, 'sdi-out-aux1'); regler(atem, { 'aux.1': 1 }); E = evaluate(B);
  assert.equal(E.video[`${mon}:sdi-in`].label, 'CAM 1'); assert.equal(E.video[`${mon}:sdi-in`].src, c1);
  debrancher(cableDe(mon, 'sdi-in').uid); link(mon, 'sdi-in', atem, 'sdi-out-3'); E = evaluate(B);
  assert.equal(E.video[`${mon}:sdi-in`].label, 'PGM', 'les sorties SDI 1 à 8 sont des retours programme');
  const mon2 = out('moniteur-hdmi'); link(mon2, 'hdmi-in', atem, 'hdmi-out'); link(mon2, 'iec', bandeau, 'out4'); E = evaluate(B);
  assert.equal(E.video[`${mon2}:hdmi-in`].label, 'Multiview', 'l\'HDMI de l\'ATEM porte le multiview');
  // le Carbonite d'usine est en 1080i50 : il accepte la caméra d'usine
  const carb = out('carbonite-solo13'); link(carb, 'iec', bandeau, 'out5'); debrancher(cableDe(c1, 'sdi-out').uid); link(c1, 'sdi-out', carb, 'sdi-in-1'); regler(c1, { format: '1080i50' });
  const mon3 = out('moniteur-hdmi'); link(mon3, 'iec', bandeau, 'out6'); link(mon3, 'sdi-in', carb, 'sdi-out-1'); E = evaluate(B);
  assert.equal(E.video[`${mon3}:sdi-in`].label, 'PGM'); assert.equal(E.video[`${mon3}:sdi-in`].format, '1080i50');
});

test('vidéo : Teranex embedder (micro sur la paire), boucle du HyperDeck, HyperDeck qui enregistre quand il a une carte et REC, désembedder', () => {
  const { sw, bandeau } = socle();
  const atem = out('atem-hd8-iso'); link(atem, 'iec', bandeau, 'out2');
  const c1 = camera(sw, 1); regler(c1, { format: '1080p50' });
  const ter = out('teranex-audio-sdi'); link(ter, 'lan', sw, 'port-5');
  const mic = out('micro-xlr'); link(mic, 'out', ter, 'xlr-in-1');
  link(c1, 'sdi-out', ter, 'sdi-in'); link(ter, 'sdi-out', atem, 'sdi-in-1');
  const hd = out('hyperdeck-hd-plus'); link(hd, 'iec', bandeau, 'out3'); link(atem, 'sdi-out-pgm', hd, 'sdi-in');
  const mon = out('moniteur-hdmi'); link(mon, 'iec', bandeau, 'out4'); link(hd, 'sdi-loop', mon, 'sdi-in');
  let E = evaluate(B);
  assert.match(E.power[ter].source, /PoE\+/, 'le Teranex Mini est alimenté par le switch');
  const inAtem = E.video[`${atem}:sdi-in-1`];
  assert.equal(inAtem.src, c1); assert.deepEqual(inAtem.via, [ter]); assert.deepEqual(inAtem.audio, [{ ch: 1, from: mic }, { ch: 2, from: mic }]);
  assert.equal(E.services[`${ter}:audio`].ok, true);
  const rec = E.video[`${hd}:sdi-in`];
  assert.equal(rec.label, 'PGM'); assert.deepEqual(rec.audio, [{ ch: 1, from: mic }, { ch: 2, from: mic }]);
  assert.equal(E.video[`${mon}:sdi-in`].label, 'PGM'); assert.deepEqual(E.video[`${mon}:sdi-in`].via, [ter, c1, hd], 'la boucle du HyperDeck recopie le programme');
  assert.ok(!E.services[`${hd}:enregistre`].ok); assert.match(E.services[`${hd}:enregistre`].why, /pas de carte/);
  assert.ok(E.alertes.some((a) => a.dev === hd && /pas de carte/.test(a.msg)));
  const sd = out('carte-sd'); link(sd, 'sd', hd, 'sd2'); E = evaluate(B);
  assert.match(E.services[`${hd}:enregistre`].why, /support choisi \(sd1\) est vide/);
  regler(hd, { media: 'sd2' }); E = evaluate(B);
  assert.match(E.services[`${hd}:enregistre`].why, /REC/);
  regler(hd, { enregistre: true }); E = evaluate(B);
  assert.ok(E.services[`${hd}:enregistre`].ok); assert.match(E.services[`${hd}:enregistre`].label, /Enregistre PGM \(1080p50, H.264\) sur /);
  const ssd = out('disque-usbc'); link(ssd, 'usbc', hd, 'usbc'); regler(hd, { media: 'usb' }); E = evaluate(B);
  assert.ok(E.services[`${hd}:enregistre`].ok, E.services[`${hd}:enregistre`].why);
  // la paire 2 : le micro passe en voies 3-4 ; l'entrée 1 sur « off » le fait disparaître du programme
  regler(ter, { paire: 2 }); E = evaluate(B);
  assert.deepEqual(E.video[`${hd}:sdi-in`].audio.map((x) => x.ch), [3, 4]);
  regler(atem, { 'audio.1': 'off' }); E = evaluate(B);
  assert.deepEqual(E.video[`${hd}:sdi-in`].audio, []);
  // un micro sur l'XLR de l'ATEM (MIC 1 sur ON) : voie 1 du programme
  const mic2 = out('micro-xlr'); link(mic2, 'out', atem, 'xlr-in-1'); regler(atem, { 'audio.mic1': 'on' }); E = evaluate(B);
  assert.deepEqual(E.video[`${hd}:sdi-in`].audio, [{ ch: 1, from: mic2 }]);
  // le micro du Teranex débranché : il n'embarque rien et le dit
  debrancher(cableDe(mic, 'out').uid); E = evaluate(B);
  assert.ok(!E.services[`${ter}:audio`].ok); assert.match(E.services[`${ter}:audio`].why, /Aucune source audio/);
  // le désembedder sur la boucle : il sort la paire demandée si elle existe
  const des = out('teranex-sdi-audio'); link(des, 'iec', bandeau, 'out5'); debrancher(cableDe(mon, 'sdi-in').uid); link(hd, 'sdi-loop', des, 'sdi-in'); link(des, 'sdi-loop', mon, 'sdi-in'); E = evaluate(B);
  assert.ok(E.services[`${des}:audio`].ok, E.services[`${des}:audio`].why); assert.equal(E.video[`${mon}:sdi-in`].label, 'PGM');
  regler(des, { paire: 3 }); E = evaluate(B); assert.match(E.services[`${des}:audio`].why, /voies 5-6 \(présentes : 1\)/);
});

/** le montage complet de la mission Conférence : trois AW-HE20 (le budget) adressées en 192.168.10.x */
function conference() {
  const { sw, bandeau } = socle('conference');
  regler(sw, { reseau: fixe('192.168.10.1') });
  const atem = out('atem-hd8-iso'); link(atem, 'iec', bandeau, 'out2'); link(atem, 'lan-1', sw, 'port-20');
  regler(atem, { reseau: fixe('192.168.10.240', '192.168.10.1'), pgm: 1 });
  const cams = [1, 2, 3].map((n) => { const c = camera(sw, n, `192.168.10.1${n}`, 'he20'); regler(c, { 'reseau.gw': '192.168.10.1', format: '1080p50' }); return c; });
  const ter = out('teranex-audio-sdi'); link(ter, 'lan', sw, 'port-13'); regler(ter, { reseau: fixe('192.168.10.60', '192.168.10.1') });
  const mic = out('micro-xlr'); link(mic, 'out', ter, 'xlr-in-1');
  link(cams[0], 'sdi-out', ter, 'sdi-in'); link(ter, 'sdi-out', atem, 'sdi-in-1'); link(cams[1], 'sdi-out', atem, 'sdi-in-2'); link(cams[2], 'sdi-out', atem, 'sdi-in-3');
  const rp = out('rp150'); link(rp, 'lan', sw, 'port-10');
  regler(rp, { reseau: fixe('192.168.10.9', '192.168.10.1'), tallyIp: true });
  cams.forEach((c, i) => regler(rp, { [`cameras.${i}.mode`]: 'ip', [`cameras.${i}.ip`]: `192.168.10.1${i + 1}` }));
  const gt = out('gpi-tally'); link(gt, 'lan-1', sw, 'port-11'); regler(gt, { atemIp: '192.168.10.240' });
  const bloc = douzeVolts(bandeau, 3, gt);
  link(gt, 'gpio', rp, 'gpio1');
  const hd = out('hyperdeck-hd-plus'); link(hd, 'iec', bandeau, 'out4'); link(hd, 'lan', sw, 'port-12'); link(atem, 'sdi-out-pgm', hd, 'sdi-in');
  regler(hd, { reseau: fixe('192.168.10.50', '192.168.10.1'), media: 'sd1', enregistre: true });
  const sd = out('carte-sd'); link(sd, 'sd', hd, 'sd1');
  return { sw, atem, cams, ter, mic, rp, gt, hd, bandeau, bloc };
}

test('services et tally : la chaîne complète ATEM → GPI & Tally → D-sub 25 → RP150 GPIO 1 (TALLY IP) → caméra du slot à l\'antenne', () => {
  const { atem, cams, rp, gt } = conference();
  let E = evaluate(B);
  assert.ok(E.services[`${gt}:atem:${atem}`].ok, JSON.stringify(E.services[`${gt}:atem:${atem}`]));
  assert.match(E.ip[gt].domaine, /VLAN 1/, 'les deux ports du GPI & Tally forment un switch interne relié au switch');
  for (const c of cams) { assert.ok(E.services[`${rp}:ptz-http:${c}`].ok); assert.ok(E.services[`${rp}:tally-ip:${c}`].ok); }
  assert.deepEqual(cams.map((c) => E.tally[c].pgm), [true, false, false]);
  assert.deepEqual(cams.map((c) => E.tally[c].pvw), [false, true, false], 'PVW sur l\'entrée 2 (usine)');
  assert.match(E.tally[cams[0]].via, /ATEM HD8 → GPI & Tally → RP150 \(GPI 1, TALLY IP\) → CAM 1/, E.tally[cams[0]].via);
  regler(atem, { pgm: 2 }); E = evaluate(B);
  assert.deepEqual(cams.map((c) => E.tally[c].pgm), [false, true, false]);
  assert.deepEqual(cams.map((c) => tallyWould(B, atem, 3)[c].pgm), [false, false, true]);
  regler(rp, { tallyIp: false }); E = evaluate(B);
  assert.ok(!E.tally[cams[1]].pgm);
  assert.ok(E.alertes.some((a) => a.dev === cams[1] && /tally reste éteint : TALLY IP est sur OFF/.test(a.msg)), JSON.stringify(E.alertes.filter((a) => a.dev === cams[1])));
  regler(rp, { tallyIp: true });
  debrancher(cableDe(gt, 'gpio').uid); E = evaluate(B);
  assert.ok(!E.tally[cams[1]].pgm); assert.ok(E.alertes.some((a) => a.dev === cams[1] && /pas de câble D-sub 25/.test(a.msg)));
  link(gt, 'gpio', rp, 'gpio1');
  regler(gt, { atemIp: '192.168.10.241' }); E = evaluate(B);
  assert.ok(!E.tally[cams[1]].pgm); assert.match(E.services[`${gt}:atem:192.168.10.241`].why, /cherche l'ATEM en 192\.168\.10\.241 : personne/);
  regler(gt, { atemIp: '192.168.10.240' });
  // le slot 2 du RP150 pilote CAM 3 : c'est CAM 3 qui s'allume quand l'entrée 2 est à l'antenne (mauvais mapping)
  regler(rp, { 'cameras.1.ip': '192.168.10.13' }); E = evaluate(B);
  assert.ok(!E.tally[cams[1]].pgm && E.tally[cams[2]].pgm);
  assert.ok(E.alertes.some((a) => a.dev === cams[1] && /le slot 2 de RP150 pilote CAM 3/.test(a.msg)));
  regler(rp, { 'cameras.1.ip': '192.168.10.99' }); E = evaluate(B);
  assert.match(E.services[`${rp}:ptz-http:192.168.10.99`].why, /RP150 cherche 192\.168\.10\.99 : personne/);
  assert.ok(E.alertes.some((a) => a.dev === rp && /cherche 192\.168\.10\.99/.test(a.msg)));
  regler(rp, { 'cameras.1.ip': '192.168.10.12' }); regler(cams[1], { tally: 'off' }); E = evaluate(B);
  assert.ok(!E.tally[cams[1]].pgm); assert.match(E.services[`${rp}:tally-ip:${cams[1]}`].why, /tally désactivé/);
});

test('tally du Carbonite : prise TALLY → RP150 GPIO 1 avec le mapping cfg.tally ; contrôle PTZ en série (SERIAL 1 → CAM 1)', () => {
  const { sw, bandeau } = socle();
  const carb = out('carbonite-solo13'); link(carb, 'iec', bandeau, 'out2');
  const cams = [1, 2].map((n) => camera(sw, n, `192.168.0.1${n}`)); cams.forEach((c, i) => link(c, 'sdi-out', carb, `sdi-in-${i + 1}`));
  const rp = out('rp150'); link(rp, 'lan', sw, 'port-10'); link(carb, 'tally', rp, 'gpio1');
  cams.forEach((c, i) => regler(rp, { [`cameras.${i}.mode`]: 'ip', [`cameras.${i}.ip`]: `192.168.0.1${i + 1}` }));
  let E = evaluate(B);
  assert.deepEqual(cams.map((c) => E.tally[c].pgm), [true, false]); assert.match(E.tally[cams[0]].via, /Solo 13 \(TALLY 1\)/);
  regler(carb, { pgm: 2 }); E = evaluate(B); assert.deepEqual(cams.map((c) => E.tally[c].pgm), [false, true]);
  // sortie tally 1 ↔ entrée 2 : c'est le slot 1 (CAM 1) qui s'allume quand l'entrée 2 est à l'antenne
  regler(carb, { 'tally.1': 2, 'tally.2': 1 }); E = evaluate(B); assert.deepEqual(cams.map((c) => E.tally[c].pgm), [true, false]);
  regler(carb, { 'tally.1': 1, 'tally.2': 2, pgm: 1 }); regler(rp, { 'cameras.0.mode': 'serial' }); E = evaluate(B);
  assert.ok(!E.services[`${rp}:ptz-serial:slot1`].ok); assert.match(E.services[`${rp}:ptz-serial:slot1`].why, /rien n'est branché sur/);
  link(rp, 'serial-1', cams[0], 'rs422'); E = evaluate(B);
  assert.ok(E.services[`${rp}:ptz-serial:${cams[0]}`].ok); assert.ok(E.tally[cams[0]].pgm, 'le tally passe aussi par la liaison série');
  regler(cams[0], { serie: 'rs232' }); E = evaluate(B);
  assert.match(E.services[`${rp}:ptz-serial:${cams[0]}`].why, /RS232/);
  regler(rp, { 'cameras.5.mode': 'serial' }); E = evaluate(B);
  assert.match(E.services[`${rp}:ptz-serial:slot6`].why, /pas de port série pour ce slot/);
});

test('mission Conférence : 100 sur le montage complet ; moins sans tally, sans REC, en DHCP, sans alimentation, sans GPI & Tally, hors budget', () => {
  const m = missionById('conference'); assert.ok(m && m.exigences.length >= 8);
  const { rp, hd, cams, gt, sw, bloc } = conference();
  let E = evaluate(B);
  let N = noter(m, B, E, CATALOGUE);
  assert.equal(N.score, 100, JSON.stringify(N.items.filter((i) => !i.ok), null, 1));
  assert.ok(E.power[gt].on); assert.equal(E.power[bloc].watts, CATALOGUE['gpi-tally'].watts, 'le bloc 12 V tire du secteur ce que tire le GPI & Tally');
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
  regler(sw, { 'ports.2.poe': false }); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.match(N.items.find((i) => i.id === 'alimentation').why, /CAM 2/); assert.ok(N.items.find((i) => i.id === 'cameras').partiel);
  regler(sw, { 'ports.2.poe': true });
  debrancher(cableDe(gt, 'lan-1').uid); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.match(N.items.find((i) => i.id === 'tally').why, /ne joint pas l'ATEM/);
  link(gt, 'lan-1', sw, 'port-11');
  // trois AW-HE130 à la place des HE20 : le budget est dépassé, la note perd 10 points
  for (const c of cams) B.appareils.find((a) => a.uid === c).modele = 'he130';
  E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.ok(!N.budget.ok && N.score === 90, JSON.stringify(N.budget));
});

test('mission Plateau TV : ATEM en DHCP du routeur, ISO sur disque USB-C, streaming par la box, multiview sur le moniteur, micro sur l\'XLR', () => {
  const m = missionById('plateau-iso'); assert.ok(m);
  const { sw, bandeau } = socle('plateau-iso');
  const rt = out('routeur'); link(rt, 'alim', bandeau, 'out3'); link(rt, 'lan-1', sw, 'port-24');
  const atem = out('atem-hd8-iso'); link(atem, 'iec', bandeau, 'out2'); link(atem, 'lan-1', sw, 'port-20');
  const cams = [1, 2].map((n) => { const c = camera(sw, n); regler(c, { 'reseau.dhcp': true, format: '1080p50' }); return c; });
  link(cams[0], 'sdi-out', atem, 'sdi-in-1'); link(cams[1], 'sdi-out', atem, 'sdi-in-2');
  const mic = out('micro-xlr'); link(mic, 'out', atem, 'xlr-in-1'); regler(atem, { 'audio.mic1': 'on', iso: true, 'stream.on': true, 'stream.cle': 'abcd-1234' });
  const mon = out('moniteur-hdmi'); link(mon, 'hdmi-in', atem, 'hdmi-out'); link(mon, 'iec', bandeau, 'out4');
  const rp = out('rp150'); link(rp, 'lan', sw, 'port-10'); regler(rp, { 'reseau.dhcp': true, tallyIp: true });
  const gt = out('gpi-tally'); link(gt, 'lan-1', sw, 'port-11'); regler(gt, { 'reseau.dhcp': true }); link(gt, 'gpio', rp, 'gpio1');
  let E = evaluate(B);
  assert.ok(!E.power[gt].on, 'le GPI & Tally n\'a pas de 12 V');
  assert.equal(E.ip[sw].ip, '192.168.1.100'); assert.equal(E.ip[atem].ip, '192.168.1.101'); assert.equal(E.ip[cams[0]].ip, '192.168.1.102'); assert.equal(E.ip[rp].ip, '192.168.1.104');
  assert.ok(!E.services[`${atem}:iso`].ok, 'pas encore de disque'); assert.ok(E.services[`${atem}:rtmp:internet`].ok, JSON.stringify(E.services[`${atem}:rtmp:internet`]));
  let N = noter(m, B, E, CATALOGUE);
  assert.ok(N.items.find((i) => i.id === 'stream').ok, JSON.stringify(N.items.find((i) => i.id === 'stream')));
  assert.ok(!N.items.find((i) => i.id === 'iso').ok); assert.match(N.items.find((i) => i.id === 'iso').why, /aucun disque/);
  assert.ok(N.items.find((i) => i.id === 'multiview').ok, 'l\'HDMI de l\'ATEM porte le multiview');
  assert.ok(N.items.find((i) => i.id === 'micro').ok, N.items.find((i) => i.id === 'micro').why);
  assert.ok(!N.items.find((i) => i.id === 'pilotage').ok, 'les slots du RP150 ne sont pas réglés');
  const ssd = out('disque-usbc'); link(ssd, 'usbc', atem, 'usbc-1');
  douzeVolts(bandeau, 5, gt);
  E = evaluate(B);
  regler(gt, { atemIp: E.ip[atem].ip });
  cams.forEach((c, i) => regler(rp, { [`cameras.${i}.mode`]: 'ip', [`cameras.${i}.ip`]: E.ip[c].ip }));
  E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.equal(N.score, 100, JSON.stringify(N.items.filter((i) => !i.ok), null, 1) + JSON.stringify(N.budget));
  regler(rt, { wan: 'aucun' }); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.match(N.items.find((i) => i.id === 'stream').why, /WAN : aucun/);
  regler(rt, { wan: '4g', 'lan.dhcp.on': false }); E = evaluate(B);
  assert.ok(linkLocal(E.ip[atem].ip), 'le DHCP coupé : lien local'); assert.ok(!E.services[`${atem}:rtmp:internet`].ok);
});

test('mission Régie vMix : NDI|HX et SDI dans vMix, PGM par la DeckLink vers le HyperDeck (REMOTE) et le Teranex désembedder, PTZ et tally vMix', () => {
  const m = missionById('regie-vmix'); assert.ok(m);
  const { sw, bandeau } = socle('regie-vmix');
  regler(sw, { reseau: fixe('192.168.0.2') });
  const pc = out('pc-regie'); link(pc, 'iec', bandeau, 'out2'); link(pc, 'lan', sw, 'port-20'); regler(pc, { reseau: fixe('192.168.0.100') });
  const c1 = camera(sw, 1, '192.168.0.11'), c2 = camera(sw, 2, '192.168.0.12');
  regler(c1, { ndi: true });
  link(c2, 'sdi-out', pc, 'sdi-1');
  regler(pc, { 'vmix.entrees': [{ type: 'ndi', source: 'CAM 1' }, { type: 'decklink', source: '1' }], 'vmix.ptz': [{ ip: '192.168.0.11', modele: 'he130' }, { ip: '192.168.0.12', modele: 'he130' }], 'vmix.pgm': 1, 'decklink.3': 'out' });
  const hd = out('hyperdeck-hd-plus'); link(hd, 'iec', bandeau, 'out3'); link(hd, 'lan', sw, 'port-12'); link(pc, 'sdi-3', hd, 'sdi-in');
  regler(hd, { reseau: fixe('192.168.0.50'), enregistre: true, distant: true });
  const sd = out('carte-sd'); link(sd, 'sd', hd, 'sd1');
  const ter = out('teranex-sdi-audio'); link(ter, 'lan', sw, 'port-13'); link(pc, 'sdi-4', ter, 'sdi-in'); regler(ter, { reseau: fixe('192.168.0.60') });
  const mon = out('moniteur-hdmi'); link(ter, 'sdi-loop', mon, 'sdi-in'); link(mon, 'iec', bandeau, 'out4');
  let E = evaluate(B);
  assert.ok(E.services[`${pc}:ndi:${c1}`].ok, JSON.stringify(E.services[`${pc}:ndi:${c1}`]));
  assert.equal(E.video[`${pc}:sdi-1`].src, c2);
  assert.equal(E.video[`${hd}:sdi-in`].label, 'PGM'); assert.equal(E.video[`${hd}:sdi-in`].src, pc); assert.deepEqual(E.video[`${hd}:sdi-in`].via, [c1]);
  assert.equal(E.video[`${hd}:sdi-in`].format, '1080i50', 'vMix sort au format de la caméra NDI à l\'antenne');
  assert.ok(E.services[`${hd}:enregistre`].ok);
  assert.ok(E.tally[c1].pgm && !E.tally[c2].pgm); assert.match(E.tally[c1].via, /vMix/);
  assert.ok(tallyWould(B, pc, 2)[c2].pgm);
  let N = noter(m, B, E, CATALOGUE);
  const ter1 = N.items.find((i) => i.id === 'teranex'); assert.ok(!ter1.ok && !ter1.partiel, 'la caméra n\'a pas d\'audio : rien sur les voies 1-2');
  for (const id of ['ndi', 'sdi', 'hyperdeck', 'pilotage', 'tally', 'adresses', 'alimentation']) assert.ok(N.items.find((i) => i.id === id).ok, id + ' : ' + N.items.find((i) => i.id === id).why);
  // un micro embarqué par un Teranex embedder avant la DeckLink : le désembedder a ses voies 1-2
  const emb = out('teranex-audio-sdi'); link(emb, 'lan', sw, 'port-14'); regler(emb, { reseau: fixe('192.168.0.61') }); const mic = out('micro-xlr'); link(mic, 'out', emb, 'xlr-in-1');
  debrancher(cableDe(c2, 'sdi-out').uid); link(c2, 'sdi-out', emb, 'sdi-in'); link(emb, 'sdi-out', pc, 'sdi-1');
  regler(pc, { 'vmix.pgm': 2 }); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.ok(E.services[`${ter}:audio`].ok, E.services[`${ter}:audio`].why);
  assert.equal(N.score, 100, JSON.stringify(N.items.filter((i) => !i.ok), null, 1) + JSON.stringify(N.budget));
  regler(hd, { distant: false }); E = evaluate(B); N = noter(m, B, E, CATALOGUE);
  assert.match(N.items.find((i) => i.id === 'hyperdeck').why, /REMOTE/);
  regler(c1, { ndi: false }); E = evaluate(B);
  assert.match(E.services[`${pc}:ndi:${c1}`].why, /NDI\|HX n'est pas activé/);
});

test('ATEM → HyperDeck piloté (9993, REMOTE), PC en ATEM Software Control, moniteur sans signal ; chaque exigence répond sur tout montage', () => {
  const { atem, hd, sw, bandeau } = conference();
  regler(atem, { 'hyperdecks.0.ip': '192.168.10.50' });
  let E = evaluate(B);
  assert.match(E.services[`${atem}:hyperdeck:${hd}`].why, /REMOTE est sur OFF/, 'd\'usine, le HyperDeck refuse le pilotage');
  regler(hd, { distant: true }); E = evaluate(B); assert.ok(E.services[`${atem}:hyperdeck:${hd}`].ok);
  regler(atem, { 'hyperdecks.0.ip': '192.168.10.51' }); E = evaluate(B); assert.match(E.services[`${atem}:hyperdeck:192.168.10.51`].why, /personne/);
  const pc = out('pc-regie'); link(pc, 'iec', bandeau, 'out5'); link(pc, 'lan', sw, 'port-21'); regler(pc, { logiciel: 'atem-control', reseau: fixe('192.168.10.100') });
  E = evaluate(B); assert.ok(E.services[`${pc}:atem:${atem}`].ok);
  const mon = out('moniteur-hdmi'); E = evaluate(B); assert.ok(!E.power[mon].on);
  for (const x of MISSIONS) { assert.ok(x.exigences.length >= 7 && x.budget > 0 && x.competences.length >= 3, x.id); for (const e of x.exigences) { const r = e.test(B, E); assert.equal(typeof r.ok, 'boolean'); assert.equal(typeof r.why, 'string'); assert.ok(!/undefined|NaN|\[object/.test(r.why), `${x.id}/${e.id} : ${r.why}`); } }
  vider('');
  for (const x of MISSIONS) for (const e of x.exigences) { const r = e.test(B, evaluate(B)); assert.ok(!r.ok && typeof r.why === 'string' && r.why.length > 3, `${x.id}/${e.id} sur un montage vide`); }
});
