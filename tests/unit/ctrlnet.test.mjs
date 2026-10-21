// Réseau de contrôle du car SDI (src/net/ctrlnet.js) : plan d'adressage, acheminement d'un ping
// (même VLAN, routage, pare-feu, Internet), diagnostics, pannes injectées puis réparées, QoS d'un
// lien saturé, API des autres postes, fiches « ? » et schémas ajoutés, parcours du chef de car
// rejoués sans navigateur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useHeadless, TUTOR } from '../helpers/tutor.mjs';
import { S, on } from '../../src/state.js';
import * as N from '../../src/net/ctrlnet.js';
import { FAULTS, ACTIVE, clearFaults } from '../../src/faults.js';
import { TERMS, CATS, TERM_PATTERNS, termFor } from '../../src/content/netterms.js';
import { CTRL_CAT } from '../../src/content/terms_ctrlnet.js';
import { FIGS } from '../../src/ui/term_figs.js';
import { LESSON_FIGS } from '../../src/ui/figs_ctrlnet.js';
import { STATION_INFO } from '../../src/content/stations.js';
import { stationLesson } from '../../src/tutor/lessons/postes.js';
import { CTRLNET_LESSONS } from '../../src/tutor/lessons/ctrlnet.js';
import { registerLessons, startLesson, step, check, next, doForMe, answer, isAction, ctx, val, lessonBlocked } from '../../src/tutor/engine.js';
import { PROG } from '../../src/shared.js';

const fresh = () => { S.ipMode = false; clearFaults(); N.resetCtrlNet(); };

test('adresses : saisie d\'une adresse, d\'un masque, sous-réseaux', () => {
  assert.equal(N.parseIp('10.1.20.33'), (10 << 24 | 1 << 16 | 20 << 8 | 33) >>> 0);
  for (const bad of ['10.1.20', '10.1.20.256', 'a.b.c.d', '', '10.1.20.33.1']) assert.equal(N.parseIp(bad), null, bad);
  assert.equal(N.parseMask('255.255.255.0'), 24);
  assert.equal(N.parseMask('/28'), 28);
  assert.equal(N.parseMask('16'), 16);
  assert.equal(N.parseMask('255.255.255.240'), 28);
  assert.equal(N.parseMask('255.255.0.255'), null, 'masque non contigu');
  assert.equal(N.maskStr(24), '255.255.255.0');
  assert.equal(N.subnetStr('10.1.20.33', 24), '10.1.20.0/24');
  assert.equal(N.subnetStr('10.1.20.33', 28), '10.1.20.32/28');
  const e = N.checkFields({ ip: '10.1.20.0', mask: '255.255.255.0', gw: '10.1.20.1' });
  assert.match(e.ip, /adresse du réseau/);
  assert.match(N.checkFields({ ip: '10.1.20.255', mask: '/24', gw: '' }).ip, /diffusion/);
  assert.ok(N.checkFields({ ip: '10.1.20.33', mask: '255.255.0.255', gw: '' }).mask);
  assert.deepEqual(N.checkFields({ ip: '10.1.20.33', mask: '/24', gw: '10.1.20.1' }), {});
});

test('plan d\'adressage : toutes les machines conformes et joignables, une adresse fixe chacune', () => {
  fresh();
  const R = N.evaluate();
  assert.equal(R.err, 0, JSON.stringify(Object.entries(R.devs).filter(([, d]) => d.level !== 'ok').map(([k, d]) => [k, d.issues.map((i) => i.text)])));
  assert.equal(R.warn, 0);
  assert.equal(R.conf.length, 0);
  for (const f of N.FUNCS) assert.ok(R.funcs[f.key].ok, f.key);
  // le troisième nombre de l'adresse est le VLAN
  for (const d of N.DEVS) if (!d.dhcp && !d.ifaces) assert.equal(+d.ip.split('.')[2], d.vlan, d.id);
  const ips = N.DEVS.filter((d) => !d.dhcp).map((d) => d.ip);
  assert.equal(new Set(ips).size, ips.length, 'adresses uniques');
  assert.equal(N.SWITCHES.length, 3);
  assert.ok(N.VLANS.length >= 6);
});

test('ping : même VLAN sans routeur, autre VLAN par la passerelle, invités isolés, Internet par le routeur', () => {
  fresh();
  const local = N.ping('rcp3', 'ccu3');
  assert.equal(local.state, 'ok');
  assert.ok(!local.hops.some((h) => /routage/.test(h)), 'pas de routage dans le même VLAN');
  assert.match(N.explainPing(local), /même VLAN \(20\)/);
  const routed = N.ping('supv', 'ccu3');
  assert.equal(routed.state, 'ok');
  assert.ok(routed.hops.some((h) => /routage/.test(h)));
  assert.match(N.explainPing(routed), /passerelle 10\.1\.10\.1/);
  assert.ok(!/ de (PC|RCP|CCU) /.test(N.explainPing(routed)), 'pas de « de PC de supervision » sans article');
  assert.equal(N.ping('supv', 'swvision').state, 'ok', 'adresse d\'administration d\'un switch');
  assert.equal(N.ping('supv', 'router').state, 'ok');
  assert.equal(N.ping('ipd', 'chaine').state, 'ok', 'la production sort sur Internet');
  assert.equal(N.ping('guest', 'chaine').state, 'ok', 'les invités aussi');
  const g = N.ping('guest', 'ccu1');
  assert.equal(g.state, 'echec'); assert.match(g.why, /pare-feu/);
  assert.equal(N.ping('supv', 'guest').state, 'echec');
  assert.equal(N.leaseOf('guest').apipa, false);
  assert.match(N.ipOf('guest'), /^10\.1\.90\.1\d\d$/);
  // tables : la CCU 3 dans l'ARP du VLAN 20, apprise sur le lien montant du SW-VISION pour le RCP 3
  assert.ok(N.arpTable(20).some((r) => r.dev === 'ccu3' && r.ip === '10.1.20.13'));
  const m = N.macTable('vision').find((r) => r.dev === 'ccu3');
  assert.ok(m && m.port === 25 && m.vlan === 20);
});

test('diagnostics : masque, passerelle, VLAN du port, DHCP sans serveur', () => {
  fresh();
  N.setDevice('rcp3', { prefix: 16 });
  assert.equal(N.ping('rcp3', 'ccu3').state, 'ok', 'un masque plus large garde le VLAN');
  assert.equal(N.ping('supv', 'rcp3').state, 'echec', '… mais la réponse ne sait plus sortir');
  assert.ok(N.devState('rcp3').issues.some((i) => i.field === 'mask'));
  N.setDevice('rcp3', { prefix: 28 });
  assert.equal(N.ping('rcp3', 'ccu3').state, 'echec', '/28 : la CCU n\'est plus « chez lui » et la passerelle sort du sous-réseau');
  assert.equal(N.devState('rcp3').level, 'err');
  fresh();
  N.setDevice('rcp3', { gw: '10.1.30.1' });
  assert.equal(N.ping('rcp3', 'ccu3').state, 'ok', 'passerelle fausse : le VLAN marche');
  assert.equal(N.ping('supv', 'rcp3').state, 'echec');
  assert.ok(N.devState('rcp3').issues.some((i) => i.field === 'gw' && i.sev === 'err'));
  fresh();
  N.setDeviceVlan('ipd', 30);
  assert.equal(N.ctrlFunc('evs').state, 'coupe');
  assert.ok(N.devState('ipd').issues.some((i) => /VLAN 30/.test(i.text) && /VLAN 40/.test(i.text)));
  fresh();
  N.setDevice('gfxpc', { dhcp: true });
  assert.equal(N.leaseOf('gfxpc').apipa, true);
  assert.match(N.ipOf('gfxpc'), /^169\.254\./);
  assert.equal(N.ctrlFunc('gfx').ok, false);
  fresh();
});

test('pannes : chacune casse une fonction du car, se voit au diagnostic et se répare', () => {
  fresh();
  for (const id of ['cn-conflit', 'cn-vlan', 'cn-masque', 'cn-cable']) assert.ok(FAULTS.some((f) => f.id === id), id);
  const lost = [];
  on('ctrlnet', (e) => { if (e.type === 'lost') lost.push(e); });
  for (const f of N.CTRL_FAULTS) {
    for (let k = 0; k < 3; k++) {
      lost.length = 0;
      const st = f.inject();
      const R = N.evaluate();
      assert.equal(f.check(st), false, `${f.id} : panne en cours`);
      assert.ok(N.FUNCS.some((x) => !R.funcs[x.key].ok), `${f.id} : une fonction du car tombe`);
      assert.equal(N.devState(st.dev).level, 'err', `${f.id} : ${st.dev} en défaut`);
      assert.ok(lost.length && lost[0].who && lost[0].msg, `${f.id} : l'opérateur concerné le signale`);
      assert.ok(N.sweep().rows.some((r) => r.state !== 'ok'), `${f.id} : le balayage le voit`);
      f.repair(st);
      assert.equal(f.check(st), true, `${f.id} : réparée`);
      assert.equal(N.evaluate().err, 0, `${f.id} : tout est revenu`);
    }
  }
  // par le simulateur de pannes, puis « Tout réparer »
  const e = /** @type {any} */ (FAULTS.find((f) => f.id === 'cn-cable')).inject();
  assert.ok(e.dev);
  N.resetCtrlNet();
  fresh();
  assert.equal(ACTIVE.filter((a) => !a.done).length, 0);
});

test('QoS : une copie de fichiers sature le lien montant ; sans QoS, l\'intercom hache', () => {
  fresh();
  N.setCopy(true);
  let R = N.evaluate();
  const D = R.load['up-prod'].down;
  assert.ok(D.demand > R.load['up-prod'].cap, 'lien saturé');
  assert.equal(D.loss.voix, 0, 'avec la QoS : pas de perte pour la voix');
  assert.ok(D.loss.fichiers > 0, 'les fichiers attendent');
  assert.ok(R.funcs['icom-real'].ok && R.funcs.mixer.ok);
  assert.ok(R.funcs.gfx.ok, 'une copie ralentie n\'est pas une panne');
  N.setSwitchQos('core', false);
  R = N.evaluate();
  assert.equal(R.funcs['icom-real'].state, 'degrade');
  assert.ok(R.funcs['icom-real'].loss > 0.01);
  // matrice d'intercom mal marquée, QoS active : sa voix vers le SW-PROD (saturé) passe avec les fichiers
  N.setSwitchQos('core', true);
  N.setDevice('icmatrix', { qos: 'fichiers' });
  R = N.evaluate();
  assert.equal(R.funcs['icom-real'].state, 'degrade');
  assert.equal(R.funcs['icom-son'].state, 'degrade');
  assert.ok(R.funcs['icom-vision'].ok, 'le lien du SW-VISION n\'est pas saturé');
  assert.ok(N.devState('icmatrix').issues.some((i) => i.field === 'qos'));
  fresh();
});

test('API des autres postes : ctrlCam, ctrlFunc, ctrlOk, ctrlReach ; le car IP n\'est pas concerné', () => {
  fresh();
  assert.ok(N.ctrlCam(3).ok);
  N.setPort('vision', 3, { cable: false });
  assert.equal(N.ctrlCam(3).ok, false);
  assert.match(N.ctrlCam(3).why, /lien coupé|câble/i);
  assert.equal(N.ctrlOk('rcp3').ok, false);
  assert.ok(N.ctrlCam(14).ok, 'caméras du grand dispositif au-delà de 12 : non simulées');
  assert.equal(N.ctrlReach('rcp3', 'ccu3').ok, false);
  S.ipMode = true;
  assert.ok(N.ctrlCam(3).ok && N.ctrlFunc('cam3').ok && N.ctrlReach('rcp3', 'ccu3').ok && N.ctrlOk('rcp3').ok);
  S.ipMode = false;
  fresh();
  assert.ok(N.ctrlFunc('grille').ok && N.ctrlFunc('tally').ok && N.ctrlFunc('evs').ok && N.ctrlFunc('icom-vision').ok);
});

test('fiches « ? » et schémas ajoutés : complets, renvois valides, SVG bien formés', () => {
  assert.ok(CATS.includes(CTRL_CAT));
  const mine = Object.entries(TERMS).filter(([, T]) => T.cat === CTRL_CAT);
  assert.ok(mine.length >= 12);
  for (const [id, T] of Object.entries(TERMS)) {
    assert.ok(T.t && T.short && T.body && CATS.includes(T.cat), id);
    assert.ok(T.short.length <= 220, `${id} : phrase courte trop longue`);
    for (const k of T.see || []) assert.ok(TERMS[k], `${id} renvoie vers ${k} inexistant`);
    if (T.fig) assert.ok(FIGS[T.fig], `${id} : schéma ${T.fig} absent`);
  }
  // les fiches de base reprises du lexique du car IP existent toujours
  for (const id of ['vlan', 'svi', 'sous-reseau', 'passerelle', 'conflit-ip', 'qos', 'charge', 'udp']) assert.ok(TERMS[id], id);
  const used = new Set(Object.values(TERMS).map((T) => T.fig).filter(Boolean));
  const owner = {};
  for (const [k, f] of [...Object.entries(FIGS).filter(([k]) => k.startsWith('cn-')), ...Object.entries(LESSON_FIGS)]) {
    if (k.startsWith('cn-')) assert.ok(used.has(k), `schéma ${k} jamais utilisé`);
    const s = f();
    assert.match(s, /^<svg viewBox="0 0 \d+ \d+"[^>]*role="img" aria-label="[^"]+"/, k);
    assert.ok(s.endsWith('</svg>'), k);
    for (const tag of ['text', 'marker', 'defs', 'path']) assert.equal((s.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length, (s.match(new RegExp(`</${tag}>|<${tag}[^>]*/>`, 'g')) || []).length, `${k} : <${tag}> mal fermé`);
    assert.ok(!/NaN|undefined/.test(s), `${k} : valeur non calculée`);
    // plusieurs schémas s'affichent ensemble (onglet Formation) : leurs identifiants ne se répètent pas
    for (const m of s.matchAll(/ id="([^"]+)"/g)) { assert.ok(!owner[m[1]] || owner[m[1]] === k, `${k} : identifiant ${m[1]} déjà pris par ${owner[m[1]]}`); owner[m[1]] = k; }
  }
  const cases = { 'Adresse MAC': 'mac', 'Table ARP du SW-CŒUR': 'arp', 'Table MAC d\'un switch': 'table-mac', 'Mode d\'adressage': 'dhcp', 'Balayage depuis le PC de supervision': 'ping', 'Ping entre deux machines': 'ping', 'Masque de sous-réseau': 'sous-reseau', 'Passerelle': 'passerelle' };
  for (const [label, id] of Object.entries(cases)) assert.equal(termFor(label), id, label);
  // intitulés du car IP : inchangés
  for (const [label, id] of Object.entries({ 'Masque': 'sous-reseau', 'MAC multicast': 'mac-mcast', 'MAC de destination': 'mac-mcast', 'Raccordé à': 'lldp', 'Contrôleur': 'nmos' })) assert.equal(termFor(label), id, label);
  for (const label of ['Mode', 'État', 'Flux', 'Alarmes', 'Bilan', 'Lien']) assert.equal(termFor(label), null, label);
  for (const [re, id] of TERM_PATTERNS) assert.ok(TERMS[id], `motif ${re} → ${id} inexistant`);
});

test('fiche du poste et présentation : réseau de contrôle en SDI, ST 2110 en IP', () => {
  S.ipMode = false;
  assert.match(STATION_INFO.reseau.title, /contrôle/);
  const l = stationLesson('reseau', true);
  assert.match(l.title, /contrôle/);
  assert.match(val(l.steps.find((s) => s.id === 'role').say, ctx()), /SDI/);
  S.ipMode = true;
  assert.match(STATION_INFO.reseau.title, /ST 2110/);
  assert.match(l.title, /ST 2110/);
  assert.match(val(l.steps.find((s) => s.id === 'role').say, ctx()), /spine-leaf/);
  S.ipMode = false;
});

// rejoue un parcours avec « Fais-le pour moi »
function replay(id) {
  startLesson(id);
  const texts = []; const stuck = [];
  for (let guard = 0; guard < 60 && TUTOR.lesson; guard++) {
    const s = step(); const c = ctx();
    texts.push(val(s.say, c)); if (s.do) texts.push(val(s.do, c));
    check();
    if (s.quiz) answer(s.quiz.answer);
    else if (isAction(s) && !TUTOR.done) { doForMe(); check(); }
    if (!TUTOR.done) { stuck.push(s.id); break; }
    if (s.ok) texts.push(val(s.ok, c));
    next();
  }
  return { stuck, texts };
}
registerLessons(CTRLNET_LESSONS);
useHeadless();
for (const l of CTRLNET_LESSONS) {
  test(`parcours ${l.id} : complet et rejoué de bout en bout`, () => {
    fresh(); S.mode = 'fps';
    assert.ok(l.needs && l.needs.sdi);
    S.ipMode = true; assert.match(lessonBlocked(l), /SDI/); S.ipMode = false;
    assert.equal(lessonBlocked(l), '');
    for (const s of l.steps) {
      if (s.done) assert.ok(s.do && s.auto && s.ok && s.hints && s.hints.length >= 2 && s.go && (s.show || s.id.startsWith('open-')), `${l.id}/${s.id} : geste complet`);
      if (s.quiz) assert.ok(s.quiz.why.length > 80 && s.quiz.choices.length === 3, `${l.id}/${s.id}`);
    }
    // plusieurs tirages pour le dépannage (panne tirée au sort)
    for (let k = 0; k < (l.id === 'ctrlnet-depannage' ? 4 : 1); k++) {
      fresh();
      const { stuck, texts } = replay(l.id);
      assert.deepEqual(stuck, [], 'étapes bloquées');
      assert.equal(TUTOR.lesson, null, 'parcours terminé');
      assert.ok(PROG.tutor[l.id] && PROG.tutor[l.id].done);
      for (const t of texts) assert.ok(t && t.length > 8 && !/undefined|NaN|\[object|null\b/.test(t), `${l.id} : texte « ${t} »`);
      assert.equal(N.evaluate().err, 0, 'réseau en état à la fin');
    }
    fresh();
  });
}
