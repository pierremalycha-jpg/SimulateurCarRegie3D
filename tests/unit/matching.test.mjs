// Le matching à la mire (v19.30) : le calcul pur (BT.709, Lab, courbe des gris, matrice, diagnostic, échelle
// apprise, homographie), la mire, les profils de caméras et les commandes Panasonic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  oetf709, oetf709Inv, ycbcr, labLineaire, deltaE, cctLineaire, ajusterCourbe, lineariser, encoder, caracteriser, ajusterMatrice, appliquerMatrice,
  ajusterSaturation, saturer, diagnostic, ecart, estimerEchelle, homographie, projeter, zonesPastilles, simulerCamera, raccorde, TOLERANCES, axeDe, MATRICE_NULLE,
} from '../../src/matching/calc.js';
import { MIRES, MIRE_DEFAUT, neutres, colorees, position } from '../../src/matching/mires.js';
import { CAMERAS, borner, enUnites, formatValeur } from '../../src/matching/cameras.js';
import { commandes, requete, lireReponse, codeTemperature, CT_HE130, urlCommande, urlInstantane, MATRICE_ORDRE } from '../../src/matching/panasonic.js';

const pres = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} ≠ ${b} (±${tol})`);
const MIRE = MIRES[MIRE_DEFAUT];

test('la mire : 24 pastilles en 4 × 6, six gris du blanc au noir, dix-huit couleurs, luminances décroissantes', () => {
  assert.equal(MIRE.pastilles.length, 24); assert.equal(MIRE.lignes * MIRE.colonnes, 24);
  const g = neutres(MIRE); assert.equal(g.length, 6); assert.equal(g[0].id, 'blanc'); assert.equal(g[5].id, 'noir');
  for (let i = 1; i < g.length; i++) assert.ok(g[i].L < g[i - 1].L);
  pres(g[0].L, 0.9, 0.03, 'le blanc renvoie 90 %'); pres(g[5].L, 0.033, 0.01, 'le noir renvoie 3 %');
  assert.equal(colorees(MIRE).length, 18);
  assert.deepEqual(position(MIRE, 7), { ligne: 1, colonne: 1 });
  assert.deepEqual(position(MIRE, 23), { ligne: 3, colonne: 5 });
});

test('BT.709 : OETF et inverse, luminance, Lab du blanc, ΔE nul, température du gris D65', () => {
  for (const L of [0, 0.01, 0.018, 0.1, 0.18, 0.5, 1]) pres(oetf709Inv(oetf709(L)), L, 1e-9);
  pres(oetf709(0.18), 0.409, 0.002, 'gris 18 % → 41 %');
  const y = ycbcr(1, 1, 1); pres(y.y, 1, 1e-9); pres(y.cb, 0, 1e-9); pres(y.cr, 0, 1e-9);
  const w = labLineaire(1, 1, 1); pres(w.L, 100, 0.01); pres(w.a, 0, 0.05); pres(w.b, 0, 0.05);
  assert.equal(deltaE(w, w), 0);
  pres(cctLineaire(1, 1, 1), 6500, 60, 'blanc D65');
  assert.ok(cctLineaire(1.1, 1, 0.9) < 6000, 'un gris rougi est plus chaud');
  assert.ok(cctLineaire(0.9, 1, 1.1) > 7000, 'un gris bleui est plus froid');
  assert.equal(axeDe(0, 0.4), 'R'); assert.equal(axeDe(0.4, 0), 'B'); assert.equal(axeDe(-0.3, -0.3), 'G');
});

test('la courbe des gris retrouve le noir, le gain et l\'exposant d\'une caméra simulée', () => {
  const vrai = { noir: 0.02, gain: 0.95, g: 0.42 };
  const pts = neutres(MIRE).map((p) => ({ L: p.L, V: encoder(vrai, p.L) }));
  const c = ajusterCourbe(pts);
  pres(c.g, vrai.g, 0.002, 'exposant'); pres(c.gain, vrai.gain, 0.01, 'gain'); pres(c.noir, vrai.noir, 0.003, 'noir');
  for (const p of pts) pres(lineariser(c, p.V), p.L, 0.002, 'linéariser');
  const ideal = caracteriser(simulerCamera(MIRE), MIRE);
  pres(ideal.gamma, 0.45, 0.002); pres(ideal.r.noir, 0, 0.002); pres(ideal.cct, 6500, 60);
});

test('la matrice : six coefficients retrouvés aux moindres carrés, le blanc ne bouge pas, la saturation seule', () => {
  const m = { rg: 0.12, rb: -0.05, gr: -0.08, gb: 0.03, br: 0.06, bg: -0.1 };
  const src = colorees(MIRE).map((p) => p.lin), cib = src.map((c) => appliquerMatrice(m, c));
  const f = ajusterMatrice(cib, src);
  for (const k of Object.keys(m)) pres(f[k], m[k], 1e-6, k);
  assert.deepEqual(appliquerMatrice(m, [0.5, 0.5, 0.5]), [0.5, 0.5, 0.5]);
  const s = ajusterSaturation(src.map((c) => saturer(0.85, c)), src); pres(s, 0.85, 1e-6, 'saturation');
  assert.deepEqual(saturer(2, [0.2, 0.2, 0.2]), [0.2, 0.2, 0.2]);
});

test('le diagnostic retrouve les défauts d\'une caméra B (noir, balance, exposition, gamma, matrice) et prévoit un raccord', () => {
  const A = simulerCamera(MIRE);
  const defauts = { noir: [0.015, 0.015, 0.02], gain: [0.94 * 0.9, 0.9, 1.07 * 0.9], gamma: 0.42, matrice: { rg: -0.1, rb: 0.02, gr: 0.05, gb: 0, br: -0.03, bg: 0.06 } };
  const B = simulerCamera(MIRE, defauts);
  const d = diagnostic(A, B, MIRE);
  pres(d.noirs.master, -1.67, 0.15, 'master black en points'); pres(d.noirs.b, -0.33, 0.15, 'B pedestal'); pres(d.noirs.r, 0.17, 0.15, 'R pedestal');
  pres(d.balance.gainR, 1 / 0.94, 0.01, 'gain R'); pres(d.balance.gainB, 1 / 1.07, 0.01, 'gain B');
  assert.ok(d.balance.dbR > 0 && d.balance.dbB < 0);
  assert.ok(d.balance.cctB > d.balance.cctA && d.balance.dMireds < 0, 'B est plus bleue : il faut la réchauffer');
  pres(d.exposition.diaph, Math.log2(1 / 0.9), 0.02, 'diaph');
  pres(d.gamma.gB, 0.42, 0.003); pres(d.gamma.facteur, 0.45 / 0.42, 0.01);
  for (const k of Object.keys(defauts.matrice)) assert.ok(Math.sign(d.matrice[k]) === -Math.sign(defauts.matrice[k]) || Math.abs(defauts.matrice[k]) < 0.01, `matrice ${k} en sens inverse`);
  assert.ok(d.ecart.avant.moyen > 5, 'avant : visible ' + d.ecart.avant.moyen);
  assert.ok(d.ecart.apres.moyen < 0.5, 'après : raccordé ' + d.ecart.apres.moyen);
  assert.ok(d.ok && raccorde(d.ecart.apres) && !raccorde(d.ecart.avant));
  assert.ok(d.teintes.length === 18 && d.teintes[0].d >= d.teintes[17].d);
  assert.ok(d.ecart.avant.pire && d.ecart.avant.parPastille.length === 24);
  // les mêmes caméras : rien à régler
  const z = diagnostic(A, A, MIRE);
  pres(z.noirs.master, 0, 1e-6); pres(z.balance.gainR, 1, 1e-6); pres(z.gamma.facteur, 1, 1e-6); pres(z.ecart.avant.moyen, 0, 1e-9);
  for (const k of Object.keys(MATRICE_NULLE)) pres(z.matrice[k], 0, 1e-6, k);
});

test('avec du bruit, le diagnostic reste utile (raccord prévu sous la tolérance)', () => {
  const A = simulerCamera(MIRE, { bruit: 0.004, graine: 3 });
  const B = simulerCamera(MIRE, { gain: [0.96, 1, 1.05], gamma: 0.48, matrice: { rg: 0.08, rb: 0, gr: 0, gb: -0.05, br: 0, bg: 0 }, bruit: 0.004, graine: 7 });
  const d = diagnostic(A, B, MIRE);
  assert.ok(d.ecart.apres.moyen < TOLERANCES.deltaE, 'après ' + d.ecart.apres.moyen);
  assert.ok(d.ecart.apres.moyen < d.ecart.avant.moyen / 3);
  pres(d.gamma.facteur, 0.45 / 0.48, 0.03);
});

test('apprendre l\'échelle d\'un réglage : un tour corrige une échelle fausse, un effet nul ou trop petit la garde, bornée', () => {
  assert.equal(estimerEchelle(20, 40, 0, 1), 40);         // 40 pas ont fait 1 dB : 40 pas par dB
  assert.equal(estimerEchelle(20, 0, 0, 1), 20);          // rien demandé
  assert.equal(estimerEchelle(20, 40, 0, 0.0001), 20);    // rien mesuré
  assert.equal(estimerEchelle(20, 40, 0, 0.1), 80);       // 400, borné à ×4
  assert.equal(estimerEchelle(20, 40, 0, 20), 5);         // 2, borné à ÷4
  assert.equal(estimerEchelle(20, 40, 0, -2), -20);       // le sens inverse s'apprend aussi
  // la boucle : l'échelle vraie vaut 2,5 fois l'estimation ; en deux tours le gain est posé
  const vraie = 50, cible = 1.2; let echelle = 20, pose = 0, mesure = 0;
  for (let tour = 0; tour < 3; tour++) {
    const u = enUnites({ echelle }, cible - mesure, echelle); const avant = mesure;
    pose += u; mesure = pose / vraie;
    echelle = estimerEchelle(echelle, u, avant, mesure);
  }
  pres(mesure, cible, 0.02, 'gain posé'); pres(echelle, vraie, 1, 'échelle apprise');
});

test('l\'homographie : les coins, le centre, les zones des pastilles dans l\'image', () => {
  const coins = [{ x: 100, y: 80 }, { x: 700, y: 90 }, { x: 690, y: 480 }, { x: 110, y: 470 }];
  const h = homographie(coins); assert.ok(h);
  [[0, 0], [1, 0], [1, 1], [0, 1]].forEach(([u, v], i) => { const p = projeter(h, u, v); pres(p.x, coins[i].x, 1e-6); pres(p.y, coins[i].y, 1e-6); });
  const c = projeter(h, 0.5, 0.5); assert.ok(c.x > 380 && c.x < 420 && c.y > 260 && c.y < 300);
  const z = zonesPastilles(h, 4, 6); assert.equal(z.length, 24); assert.equal(z[0].points.length, 49);
  for (const p of z[0].points) assert.ok(p.x > 100 && p.x < 200 && p.y > 80 && p.y < 180, 'première case en haut à gauche');
  for (const p of z[23].points) assert.ok(p.x > 590 && p.x < 690 && p.y > 380 && p.y < 480, 'dernière case en bas à droite');
  assert.equal(homographie([coins[0], coins[0], coins[0], coins[0]]), null);
  assert.equal(homographie(null), null);
});

test('les profils de caméras : bornes, échelles, pilotage ; les valeurs se formatent', () => {
  for (const c of Object.values(CAMERAS)) {
    assert.ok(c.id && c.nom && ['cgi', 'manuel', 'aucun'].includes(c.pilotage), c.id);
    for (const [k, r] of Object.entries(c.reglages)) {
      assert.ok(r.lib && r.min < r.max && r.grandeur, `${c.id}.${k}`);
      if (!r.absolu) assert.ok(r.echelle > 0, `${c.id}.${k} : échelle`);
    }
  }
  assert.equal(CAMERAS.fb80.pilotage, 'manuel'); assert.equal(CAMERAS.he130.pilotage, 'cgi');
  assert.ok(!CAMERAS.ue20.reglages.matrice && CAMERAS.ue20.aVerifier, 'la UE20 n\'a pas de matrice');
  assert.equal(borner(CAMERAS.he130.reglages.gainR, 200), 150); assert.equal(borner(CAMERAS.he130.reglages.gamma, 0.4449), 0.44);
  assert.equal(enUnites(CAMERAS.he130.reglages.gainR, 0.5), 10); assert.equal(enUnites(CAMERAS.he130.reglages.gainR, 0.5, 40), 20);
  assert.equal(formatValeur(CAMERAS.he130.reglages.gainR, 0.5), '+0.50 dB'); assert.equal(formatValeur(CAMERAS.he130.reglages.temperature, 5600.4), '5600 K');
});

test('les commandes Panasonic suivent la spécification (HE130, famille UE20), s\'inversent, et les réponses se lisent', () => {
  assert.deepEqual(commandes('he130', 'gainR', 0), ['ORI:096']); assert.deepEqual(commandes('he130', 'gainR', 150), ['ORI:12C']); assert.deepEqual(commandes('he130', 'gainB', -150), ['OBI:000']);
  assert.deepEqual(commandes('he130', 'gainR', 999), ['ORI:12C'], 'borné');
  assert.deepEqual(commandes('he130', 'pedestal', -150), ['OTP:000']); assert.deepEqual(commandes('he130', 'pedestalR', -100), ['ORP:032']); assert.deepEqual(commandes('he130', 'pedestalB', 100), ['OBP:0FA']);
  assert.deepEqual(commandes('he130', 'gamma', 0.3), ['OSA:6A:67']); assert.deepEqual(commandes('he130', 'gamma', 0.55), ['OSA:6A:80']); assert.deepEqual(commandes('he130', 'gamma', 0.75), ['OSA:6A:94']);
  assert.deepEqual(commandes('he130', 'matrice.rg', -63), ['OSE:31:3', 'OSD:A4:41']); assert.deepEqual(commandes('he130', 'matrice.bg', 63), ['OSE:31:3', 'OSD:A9:BF']); assert.deepEqual(commandes('he130', 'matrice.gr', 0), ['OSE:31:3', 'OSD:A6:80']);
  assert.deepEqual(commandes('he130', 'saturation', 0), ['OSD:B0:80']); assert.deepEqual(commandes('he130', 'saturation', -99), ['OSD:B0:1D']); assert.deepEqual(commandes('he130', 'saturation', 40), ['OSD:B0:A8']);
  assert.equal(CT_HE130.length, 121); assert.equal(codeTemperature(2000), 0); assert.equal(codeTemperature(15000), 120); assert.equal(CT_HE130[codeTemperature(5600)], 5600); assert.equal(CT_HE130[codeTemperature(3190)], 3200);
  assert.deepEqual(commandes('he130', 'temperature', 5600), ['OAW:9', 'OSD:B1:' + codeTemperature(5600).toString(16).toUpperCase().padStart(3, '0')]);
  assert.deepEqual(commandes('he130', 'balanceAuto', 0), ['OWS']);
  assert.deepEqual(commandes('ue20', 'gainR', 30), ['ORI:12C']); assert.deepEqual(commandes('ue20', 'gainR', -30), ['ORI:000']); assert.deepEqual(commandes('ue20', 'pedestal', 10), ['OTP:12C']);
  assert.deepEqual(commandes('ue20', 'saturation', -3), ['OCG:00']); assert.deepEqual(commandes('ue20', 'saturation', 3), ['OCG:06']);
  assert.equal(commandes('ue20', 'matrice.rg', 10), null); assert.equal(commandes('ue20', 'gamma', 0.45), null); assert.equal(commandes('he130', 'inconnu', 1), null);
  assert.equal(requete('he130', 'gainR'), 'QRI'); assert.equal(requete('he130', 'matrice.gb'), 'QSD:A7'); assert.equal(requete('ue20', 'gamma'), null); assert.equal(requete('ue20', 'saturation'), 'QCG');
  // aller-retour : chaque commande se relit avec la valeur posée
  for (const [reg, v] of [['gainR', 37], ['gainB', -120], ['pedestal', 5], ['pedestalR', -40], ['pedestalB', 99], ['gamma', 0.48], ['matrice.rb', -12], ['saturation', 20], ['temperature', 3200]]) {
    const c = commandes('he130', reg, v); const r = lireReponse('he130', c[c.length - 1]);
    assert.ok(r && 'reglage' in r && r.reglage === reg, reg); pres(/** @type {any} */ (r).valeur, v, 1e-9, reg);
  }
  for (const [reg, v] of [['gainR', -7], ['gainB', 30], ['pedestal', -4], ['saturation', 2]]) {
    const c = commandes('ue20', reg, v); const r = lireReponse('ue20', c[0]);
    assert.ok(r && 'reglage' in r && r.reglage === reg, reg); pres(/** @type {any} */ (r).valeur, v, 1e-9, reg);
  }
  assert.deepEqual(lireReponse('he130', 'ER3:OSD:A4'), { erreur: 'réglage refusé dans ce mode (ER3)' });
  assert.equal(lireReponse('he130', 'n\'importe quoi'), null);
  assert.deepEqual(lireReponse('he130', 'OAW:9'), { reglage: 'balanceMode', valeur: 9 });
  assert.equal(MATRICE_ORDRE.join(','), 'rg,rb,gr,gb,br,bg');
  assert.equal(urlCommande('192.168.0.10', 'OSD:A4:41'), 'http://192.168.0.10/cgi-bin/aw_cam?cmd=OSD%3AA4%3A41&res=1');
  assert.equal(urlInstantane('192.168.0.10'), 'http://192.168.0.10/cgi-bin/camera?resolution=1920');
});

test('l\'écart entre deux mesures : ΔE et vecteurscope, nul pour la même mesure', () => {
  const A = simulerCamera(MIRE);
  const e = ecart(A, A); assert.equal(e.moyen, 0); assert.equal(e.vecto, 0);
  const B = simulerCamera(MIRE, { gain: [1.1, 1, 1] });
  const f = ecart(A, B); assert.ok(f.moyen > 1 && f.max >= f.moyen && f.vecto > TOLERANCES.vecto && f.pire);
});
