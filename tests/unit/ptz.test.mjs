// Les caméras PTZ (v19.30) : le modèle de l'atelier du Labo (alimentation PoE, qui joint qui, Easy IP Setup et sa
// fenêtre de 20 minutes, page web, compte, pupitre, QoS, étapes de la mise en service, recette), les calculs des
// leçons (champ, matériel, commande HTTP, flux), les défis (solubles, jamais justes d'avance).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as Z from '../../src/labo/calc/ptz.js';
import * as K from '../../src/cours/ptz_calc.js';
import { DEFIS, tirageDefi, verifierItem } from '../../src/labo/defis.js';
import '../../src/labo/defis/all.js';
import { etatPour, MESURES, poser } from '../../src/labo/etats.js';
import { lessonById } from '../../src/cours/index.js';
import '../../src/cours/all.js';
import { PARCOURS } from '../../src/cours/parcours.js';
import { symptomes } from '../../src/cours/ptz_exploiter.js';

const proche = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} : ${a} au lieu de ${b}`);
/** le banc tout branché, aux ports 1 à 5 */
const branche = () => { const st = Z.bancUsine(); st.appareils.forEach((a, i) => { a.port = i + 1; }); return Z.majTension(st); };
/** le banc au plan */
function auPlan() {
  const st = branche(), P = st.plan;
  for (const a of st.appareils) { const ip = a.id === 'pc' ? P.pc : a.id === 'rp' ? P.rp : P.cams[a.id]; Object.assign(a, { ip, masque: P.masque, passerelle: P.passerelle }); if (a.id.startsWith('cam')) a.compte = { user: 'regie', usine: false }; }
  st.rp.cams = { 1: { ip: P.cams.cam1, port: 80 }, 2: { ip: P.cams.cam2, port: 80 }, 3: { ip: P.cams.cam3, port: 80 } };
  st.rp.modes = { 1: 'LAN', 2: 'LAN', 3: 'LAN' };
  st.video = { cam1: { prise: 'sdi', entree: 1 }, cam2: { prise: 'sdi', entree: 2 }, cam3: { prise: 'sdi', entree: 3 } }; st.tally = true;
  return st;
}

test('les réglages d\'usine Panasonic et le PoE (IEEE 802.3af / 802.3at)', () => {
  assert.equal(Z.USINE.ip, '192.168.0.10'); assert.equal(Z.USINE.masque, '255.255.255.0');
  assert.equal(Z.POE.af.pse, 15.4); assert.equal(Z.POE.at.pse, 30); assert.equal(Z.POE.at.pd, 25.5);
  assert.equal(Z.CLASSES_POE[4], 30);
  assert.equal(Z.MODELES.ue20.periode, '20min', 'AW-UE20 : fenêtre de 20 min d\'usine');
  assert.equal(Z.MODELES.he130.periode, 'illimite', 'AW-HE130 (micrologiciel 2.00 et suivants) : Unlimited');
  assert.equal(Z.MODELES.ue20.compte, null, 'AW-UE20 : compte à créer');
  assert.ok(Z.MODELES.he130.compte.usine, 'AW-HE130 : compte d\'usine');
});

test('alimentation : PoE+ exigé, budget par classe, bloc 12 V', () => {
  const st = branche();
  const A = Z.alimentation(st);
  assert.equal(A.reserve, 120, '4 appareils de classe 4'); assert.equal(A.budget, 125);
  assert.ok(st.appareils.every((a) => A.par[a.id].alimente));
  st.switch.ports = st.switch.ports.map((p) => (p.n === 2 ? { ...p, poe: 'af' } : p));
  assert.match(Z.alimentation(st).par.cam1.pb, /PoE\+/, 'PoE simple : l\'AW-HE130 ne démarre pas');
  st.switch.ports = Z.portsUsine(); st.switch.budget = 90;
  const B = Z.alimentation(st);
  assert.ok(!B.par.rp.alimente && B.depasse, 'le dernier port dépasse le budget');
  st.appareils.find((a) => a.id === 'rp').secteur = true;
  assert.ok(Z.alimentation(st).par.rp.alimente, 'sur son bloc 12 V');
  assert.equal(Z.alimentation(st).reserve, 90);
});

test('qui joint qui : réseau, masque des deux côtés, doublon, VLAN', () => {
  const st = branche();
  assert.match(Z.joint(st, 'pc', 'cam1').pb, /en double/, 'trois caméras neuves en 192.168.0.10');
  const P = auPlan();
  assert.ok(Z.joint(P, 'pc', 'cam1').ok && Z.joint(P, 'rp', 'cam3').ok);
  P.appareils.find((a) => a.id === 'cam2').masque = '255.255.255.252';
  assert.match(Z.joint(P, 'pc', 'cam2').pb, /ne voit pas|sous-réseau/, 'un masque trop étroit : elle ne sait pas répondre');
  const Q = auPlan(); Q.switch.ports = Q.switch.ports.map((p) => (p.n === 3 ? { ...p, vlan: 20 } : p));
  assert.match(Z.joint(Q, 'pc', 'cam2').pb, /VLAN/);
  assert.ok(Z.dansReseau('192.168.10.11', '255.255.255.0', '192.168.10.200') && !Z.dansReseau('192.168.10.11', '255.255.255.0', '192.168.0.10'));
  assert.ok(!Z.adresseHote('192.168.10.255', '255.255.255.0') && !Z.adresseHote('192.168.10.0', '255.255.255.0'));
  assert.deepEqual(Z.reseauDe('10.10.5.17', '255.255.255.224'), { reseau: '10.10.5.0', diffusion: '10.10.5.31', p: 27, hotes: 30 });
});

test('Easy IP Setup : la diffusion trouve hors du sous-réseau, la MAC distingue, la fenêtre de 20 minutes', () => {
  const st = branche();
  Object.assign(st.appareils[0], { ip: '192.168.10.100' });
  let R = Z.rechercheEasyIp(st);
  assert.equal(R.liste.length, 3, 'trois caméras, hors du sous-réseau du PC');
  assert.equal(new Set(R.liste.map((c) => c.mac)).size, 3, 'trois MAC différentes');
  st.minutes = 25; Z.majTension(st);
  R = Z.rechercheEasyIp(st);
  assert.deepEqual(R.masquees, ['cam3'], 'l\'AW-UE20 disparaît passé 20 minutes');
  assert.match(Z.reglerEasyIp(st, 'cam3', { ip: '192.168.10.13', masque: '255.255.255.0', passerelle: '', http: 80 }).pb, /Redémarrez/);
  // couper puis rendre le PoE : elle redémarre, la fenêtre se rouvre
  st.switch.ports = st.switch.ports.map((p) => (p.n === 4 ? { ...p, poe: 'off' } : p)); Z.majTension(st);
  st.switch.ports = Z.portsUsine(); Z.majTension(st);
  assert.equal(Z.depuis(st, 'cam3'), 0);
  const r = Z.reglerEasyIp(st, 'cam3', { ip: '192.168.10.13', masque: '255.255.255.0', passerelle: '192.168.10.1', http: 80 });
  assert.ok(r.ok && r.patch['appareils.cam3.ip'] === '192.168.10.13');
  assert.match(Z.reglerEasyIp(st, 'cam1', { ip: '192.168.10.13', masque: '255.255.255.0', passerelle: '192.168.20.1', http: 80 }).pb, /passerelle/);
  // un autre VLAN : rien
  st.switch.ports = st.switch.ports.map((p) => (p.n === 1 ? { ...p, vlan: 30 } : p));
  assert.equal(Z.rechercheEasyIp(st).liste.length, 0);
});

test('la page web : URL et port, compte, pupitre', () => {
  const st = auPlan();
  assert.equal(Z.ouvrirUrl(st, 'http://192.168.10.11').code, 'ok');
  st.appareils.find((a) => a.id === 'cam2').http = 8080;
  assert.equal(Z.ouvrirUrl(st, '192.168.10.12').code, 'refuse');
  assert.equal(Z.ouvrirUrl(st, 'http://192.168.10.12:8080/').code, 'ok');
  assert.equal(Z.ouvrirUrl(st, 'http://192.168.0.10').code, 'delai');
  st.appareils.find((a) => a.id === 'cam3').compte = null;
  assert.equal(Z.ouvrirUrl(st, 'http://192.168.10.13').code, 'compte');
  assert.ok(!Z.verifierCompte('admin', '12345', '12345').ok && !Z.verifierCompte('regie', 'regie', 'regie').ok && Z.verifierCompte('regie', 'Tiee-Banc-24', 'Tiee-Banc-24').ok);
  const L = Z.liaisonsPupitre(st);
  assert.match(L.find((l) => l.n === 2).pb, /port 8080/);
  assert.match(L.find((l) => l.n === 3).pb, /compte/);
  assert.ok(L.find((l) => l.n === 1).ok);
});

test('QoS : marquer, faire confiance et ranger — les trois', () => {
  const st = auPlan();
  for (const c of Z.cameras(st)) Object.assign(c, { flux: true, debit: 20 });
  st.transfert = 70; st.switch.lien = 100;
  assert.ok(!Z.qos(st).ok, 'sans QoS, la vidéo perd');
  for (const c of Z.cameras(st)) c.dscp = 34;
  assert.ok(!Z.qos(st).ok, 'marquer seul ne suffit pas');
  st.switch.qos.confiance = 'dscp';
  assert.ok(!Z.qos(st).ok, 'une seule file : toujours des pertes');
  st.switch.qos.files = 'prio';
  assert.ok(Z.qos(st).ok, 'les trois : la vidéo passe');
  assert.equal(Z.tosDe(34), 136); assert.equal(Z.dscpAF(4, 1), 34); assert.equal(Z.DSCP.EF, 46);
});

test('la mise en service pas à pas : onze étapes, toutes faites au plan, la recette', () => {
  const st = Z.bancUsine();
  assert.equal(Z.etapes(st).length, 11);
  assert.ok(Z.etapes(st).every((e) => !e.fait), 'rien de fait au carton');
  const P = auPlan();
  P.easyip.cherche = true;
  for (const c of Z.cameras(P)) c.dscp = 34;
  P.switch.qos = { confiance: 'dscp', files: 'prio' };
  P.rp.testees = ['cam1', 'cam2', 'cam3'];
  const E = Z.etapes(P);
  assert.deepEqual(E.filter((e) => !e.fait).map((e) => e.id), []);
  assert.ok(Z.recette(P).ok);
  // le tally : l'entrée 2 au programme allume la touche 2 du pupitre ; sans câble GPIO, rien
  P.pgm = 2; assert.deepEqual([Z.tallyRouge(P).cam, Z.tallyRouge(P).n], ['cam2', 2]);
  P.tally = false; assert.equal(Z.tallyRouge(P).n, 0);
  // CONNECT SETTING : un numéro en SERIAL n'est pas piloté par le réseau
  P.rp.modes[1] = 'SERIAL'; assert.match(Z.liaisonsPupitre(P).find((l) => l.n === 1).pb, /CONNECT SETTING/);
});

test('les calculs des leçons : champ, matériel, commande HTTP, flux', () => {
  proche(K.angleH('he130', 4.5), 56.9, 0.2, 'AW-HE130 au plus large (ordre de grandeur)');
  proche(K.angleH('ue20', 46.8), 6.1, 0.1, 'AW-UE20 au plus serré');
  proche(K.rapportZoom('he130'), 20, 1e-9); proche(K.rapportZoom('ue20'), 12, 1e-9);
  proche(K.champ('he130', 9, 9), 9 * K.largeurCapteur(2.86) / 9, 1e-9);
  assert.deepEqual(K.materiel(2, 1, true), { ports: 5, reserve: 120, conso: 92, rj45: 5, sdi: 4, cams: 3, portsPoe: 4 });
  assert.equal(K.commande('pt', 25, 0), 'PTS7550'); assert.equal(K.commande('zoom', -40), 'Z10'); assert.equal(K.commande('pt', 0, 0), 'PTS5050');
  assert.equal(K.urlCommande('192.168.10.11', 80, 'PTS5050'), 'http://192.168.10.11/cgi-bin/aw_ptz?cmd=%23PTS5050&res=1');
  assert.equal(K.urlCommande('192.168.10.12', 8080, 'Z75'), 'http://192.168.10.12:8080/cgi-bin/aw_ptz?cmd=%23Z75&res=1');
  assert.match(K.lireCommande('PTS2550'), /gauche à la vitesse 25.*tilt à l'arrêt/);
  proche(K.chargeLien(3, 20, 0, 100), 0.6, 1e-9); assert.equal(K.fluxMax(20, 100), 4); proche(K.volumeGo(20, 60), 9, 1e-9);
});

test('les défis PTZ : solubles, jamais justes d\'avance (60 tirages chacun)', () => {
  let g = 11; const rnd = () => { g = (g * 16807) % 2147483647; return g / 2147483647; };
  for (const id of Object.keys(DEFIS).filter((k) => k.startsWith('ptz-'))) {
    for (let i = 0; i < 60; i++) {
      const t = tirageDefi(id, rnd);
      assert.ok(t.items.some((it) => it.type === 'reglage'), `${id} : au moins un réglage`);
      for (const it of t.items) {
        if (it.type !== 'reglage') continue;
        const st = etatPour('ptz', t.scene); if (it.fixe) poser(st, it.fixe);
        assert.ok(!verifierItem(it, null, { st, m: MESURES.ptz(st) }).ok, `${id} : juste d'avance`);
        poser(st, it.corrige);
        const r = verifierItem(it, null, { st, m: MESURES.ptz(st) });
        assert.ok(r.ok, `${id} : la solution ne passe pas (${r.why})`);
      }
    }
  }
});

test('le chapitre : dix leçons rangées par niveau, les symptômes du dépannage', () => {
  const ids = Object.values(PARCOURS.ptz).flat();
  assert.equal(ids.length, 10);
  for (const id of ids) assert.ok(lessonById(id), id);
  assert.equal(lessonById('ptz-easyip').chapter.id, 'ptz');
  const s = (p) => symptomes(p);
  assert.deepEqual([s('debranche').lien, s('poe').vu, s('vlan').vu, s('masque').vu, s('masque').pc, s('port').pc, s('port').rp], [false, false, false, true, false, true, false]);
});

test('le câblage : la fiche doit entrer, le RS-422 n\'est pas l\'Ethernet, G/L IN ne sort pas d\'image', () => {
  const st = Z.bancUsine();
  const ok = (r, msg) => { assert.ok(r.ok, `${msg} : ${r.pb}`); Z.majTension(Object.assign(st, {})); for (const [k, v] of Object.entries(r.patch)) { const parts = k.split('.'); let o = st; for (let i = 0; i < parts.length - 1; i++) o = Array.isArray(o) ? o.find((x) => x.id === parts[i]) : o[parts[i]]; o[parts[parts.length - 1]] = v; } };
  // un câble réseau : de la prise LAN au port 2
  ok(Z.brancher(st, 'rj45', 'cam1:lan', 'sw:p2'), 'CAM 1 au port 2');
  assert.equal(Z.appareil(st, 'cam1').port, 2);
  assert.ok(!Z.brancher(st, 'rj45', 'cam2:lan', 'sw:p2').ok, 'port déjà pris');
  assert.ok(!Z.brancher(st, 'bnc', 'cam2:lan', 'mix:in1').ok, 'un BNC n\'entre pas dans une RJ45');
  // le piège : la prise RS-422, RJ45 elle aussi
  ok(Z.brancher(st, 'rj45', 'cam2:rs422', 'sw:p3'), 'le câble entre');
  Z.majTension(st);
  assert.match(Z.alimentation(st).par.cam2.pb, /RS-422/);
  assert.ok(!Z.alimentation(st).par.cam2.lien);
  // la vidéo
  st.appareils.find((a) => a.id === 'cam1').secteur = true;
  ok(Z.brancher(st, 'bnc', 'cam1:gl', 'mix:in1'), 'G/L IN vers l\'entrée 1 : le câble entre');
  assert.match(Z.imageMelangeur(st).parCam.cam1.pb, /synchronisation/);
  ok(Z.brancher(st, 'bnc', 'mix:in1', 'cam1:sdi'), 'la sortie SDI vers l\'entrée 1');
  assert.ok(Z.imageMelangeur(st).parCam.cam1.ok);
  assert.ok(!Z.brancher(st, 'bnc', 'cam3:sdi', 'mix:in1').ok, 'l\'entrée 1 est prise');
  // le tally, le bloc, débrancher
  ok(Z.brancher(st, 'gpio', 'mix:gpio', 'rp:gpio'), 'tally');
  assert.ok(st.tally);
  assert.deepEqual(Z.debrancher(st, 'rp:gpio'), { tally: false });
  assert.deepEqual(Z.debrancher(st, 'sw:p2'), { 'appareils.cam1.port': 0, 'appareils.cam1.prise': 'lan' });
  assert.ok(Z.cablesPoses(st).some((c) => c.type === 'dc' && c.a.startsWith('cam1:')));
  // chaque prise des modèles du banc a une sérigraphie et une fiche
  for (const m of ['he130', 'ue20', 'rp150', 'pc']) for (const P of Z.PRISES[m]) assert.ok(P.serigraphie && P.fiche && P.role, `${m} : ${P.id}`);
  assert.ok(Z.PRISES.he130.some((P) => P.role === 'rs422' && P.fiche === 'rj45'), 'AW-HE130 : RS-422 en RJ45');
});
