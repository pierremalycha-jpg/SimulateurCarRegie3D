// Vues 3D du Cours (v19.16) : le catalogue (chaque vue rattachée à des leçons qui existent, des étapes
// complètes), et les modèles de calcul qu'elles animent : les mots d'une ligne SDI (EAV/SAV, LN, CRC,
// paquets audio, embrouillage), le ST 2110 (paquets, modèle -21, tampon du récepteur, 2022-7), le niveau 2
// (table MAC, VLAN, trunk), la décision de routage, le bilan optique de la fibre, les fiches « ? » optiques.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { CHAPTERS, allLessons, lessonById } from '../../src/cours/index.js';
import { VUES, CHAP3D, vueById, vuesDuChapitre, vuesDeLecon, etapeDeLecon } from '../../src/vues3d/catalogue.js';
import { TRAMES, freqMots, parite, xyz, motsLN, crc18bits, ligneSDI, echantillonsLigne, bitsDe, embrouille, desembrouille, plusLongPalier } from '../../src/cours/sdi_mots.js';
import { video, audio, modele21, emissions, tampon, fusion, surabonnement } from '../../src/cours/st2110_calc.js';
import { L2, DIFFUSION } from '../../src/vues3d/l2.js';
import { trajet, reseauDe } from '../../src/cours/reseau_routage.js';
import { bilanOptique } from '../../src/cours/camera_fibre.js';
import { fspl, antGain } from '../../src/cours/hf.js';
import { TERMS, CATS } from '../../src/content/netterms.js';
import { FIBRE_CAT } from '../../src/content/terms_fibre.js';
import { mulberry32 } from '../../src/util.js';

const bad = (t) => !t || /undefined|NaN|\[object|null\b/.test(t);
const chapitreDe = new Map(allLessons().map(({ chapter, lesson }) => [lesson.id, chapter.id]));

test('le catalogue : identifiants uniques, chapitres connus, leçons qui existent', () => {
  assert.ok(VUES.length >= 14);
  const ids = new Set();
  for (const v of VUES) {
    assert.ok(!ids.has(v.id), `${v.id} : en double`); ids.add(v.id);
    assert.equal(vueById(v.id), v);
    assert.ok(CHAP3D[v.chapitre], `${v.id} : chapitre ${v.chapitre} sans entrée « en 3D »`);
    assert.ok(CHAPTERS.some((c) => c.id === v.chapitre), `${v.id} : chapitre ${v.chapitre} inconnu du Cours`);
    for (const c of v.aussi || []) assert.ok(CHAPTERS.some((x) => x.id === c), `${v.id} : chapitre ${c}`);
    assert.ok(v.titre && v.resume && !bad(v.titre) && !bad(v.resume), v.id);
    assert.ok(typeof v.build === 'function', `${v.id} : build`);
    assert.ok(Array.isArray(v.lectures), `${v.id} : lectures`);
    assert.ok(v.lecons.length >= 1, `${v.id} : au moins une leçon`);
    for (const l of v.lecons) {
      assert.ok(lessonById(l), `${v.id} : leçon ${l} inconnue`);
      assert.ok([v.chapitre, ...(v.aussi || [])].includes(chapitreDe.get(l)), `${v.id} : la leçon ${l} est hors de son chapitre`);
      assert.ok(vuesDeLecon(l).includes(v), `${l} : bouton « Voir en 3D »`);
    }
    for (const k of ['cible', 'dir']) assert.equal(v.vue[k].length, 3, `${v.id} : vue.${k}`);
    assert.ok(v.vue.dist > 0, `${v.id} : distance`);
  }
  for (const c of Object.keys(CHAP3D)) assert.ok(vuesDuChapitre(c).length >= 1, `${c} : aucune vue`);
});

test('chaque étape a un titre, un texte, et renvoie à une leçon de sa vue', () => {
  for (const v of VUES) {
    assert.ok(v.etapes.length >= 4, `${v.id} : au moins quatre étapes`);
    v.etapes.forEach((E, i) => {
      assert.ok(E.t && !bad(E.t), `${v.id} étape ${i + 1} : titre`);
      assert.ok(E.texte && E.texte.length > 120 && !bad(E.texte), `${v.id} étape ${i + 1} : texte`);
      if (E.lecon) assert.ok(v.lecons.includes(E.lecon), `${v.id} étape ${i + 1} : leçon ${E.lecon}`);
      if (E.vue) { assert.equal(E.vue.cible.length, 3); assert.equal(E.vue.dir.length, 3); assert.ok(E.vue.dist > 0); }
    });
    for (const l of v.lecons) { const k = etapeDeLecon(v, l); assert.ok(k >= 0 && k < v.etapes.length); }
  }
});

test('SDI : les mots de synchro, le numéro de ligne, la parité des paquets', () => {
  // XYZ : 1 F V H P3 P2 P1 P0 0 0 (ST 292-1)
  assert.equal(xyz(0, 0, 1), 0x274); assert.equal(xyz(0, 0, 0), 0x200);
  assert.equal(xyz(0, 1, 1), 0x2d8); assert.equal(xyz(0, 1, 0), 0x2ac);
  // ST 291 : b8 rend pair, b9 = non b8 (DID E7h de l'audio HD, DC de 24 mots)
  assert.equal(parite(0xe7), 0x2e7); assert.equal(parite(24), 0x218);
  const [l0, l1] = motsLN(1125);
  assert.equal(((l0 >> 2) & 0x7f) | (((l1 >> 2) & 0xf) << 7), 1125);
  // 148,5 millions de mots par seconde et par flux en 1080p50 : 2 flux × 10 bits = 2,97 Gb/s
  assert.equal(freqMots(TRAMES['1080p50']), 148.5);
  assert.equal(freqMots(TRAMES['1080p50']) * 2 * 10 / 1000, 2.97);
  // 48 kHz : 960 échantillons par image en 1080p50, répartis sur les 1 125 lignes
  let n = 0; for (let g = 0; g < 1125; g++) n += echantillonsLigne('1080p50', g);
  assert.equal(n, 960);
});

test('SDI : une ligne complète, son CRC et ses paquets audio', () => {
  const L = ligneSDI('1080p50', 100);
  assert.equal(L.length, 2 * TRAMES['1080p50'].tot);
  const C = L.filter((w) => w.f === 'C'), Y = L.filter((w) => w.f === 'Y');
  assert.deepEqual(Y.slice(0, 4).map((w) => w.v), [0x3ff, 0, 0, 0x274]);
  for (const w of L) assert.ok(w.v >= 0 && w.v < 1024 && w.z && w.d, 'mot de 10 bits décrit');
  // le CRC-18 recalculé avec ses propres bits donne un reste nul (contrôle du récepteur)
  for (const s of [C, Y]) {
    const act = s.slice(s.length - 1920).map((w) => w.v);
    const c = crc18bits(bitsDe([...act, ...s.slice(0, 6).map((w) => w.v)]));
    const b = []; for (const w of [s[6].v, s[7].v]) for (let k = 0; k < 9; k++) b.push((w >> k) & 1);
    assert.equal(crc18bits(b, c), 0);
  }
  // quatre paquets audio (DID E7h à E4h) dans le flux C, chacun avec sa somme de contrôle
  const dids = C.filter((w, i) => w.z === 'ANC' && i >= 3 && C[i - 3].v === 0 && C[i - 2].v === 0x3ff && C[i - 1].v === 0x3ff).map((w) => w.v & 0xff);
  assert.deepEqual(dids, [0xe7, 0xe6, 0xe5, 0xe4]);
  const k0 = C.findIndex((w) => w.z === 'ANC');
  const pk = C.slice(k0, k0 + 31); // ADF ×3, DID, DBN, DC, 24 UDW, CS
  assert.equal(pk[5].v & 0xff, 24);
  let sum = 0; for (const w of pk.slice(3, 30)) sum = (sum + (w.v & 0x1ff)) & 0x1ff;
  assert.equal(pk[30].v & 0x1ff, sum);
  assert.equal((pk[30].v >> 9) & 1, ((sum >> 8) & 1) ^ 1);
  // une ligne de suppression verticale : V = 1
  assert.equal(ligneSDI('1080p50', 10)[7].v, 0x2d8);
});

test('SDI : l\'embrouillage se défait chez le récepteur et casse les longs paliers', () => {
  const rnd = mulberry32(7), bits = Array.from({ length: 3000 }, () => (rnd() < 0.5 ? 1 : 0));
  const e = embrouille(bits);
  assert.deepEqual(desembrouille(e.niveaux), bits);
  // auto-synchronisant : un récepteur parti d'un autre état retrouve les bits après 10 bits
  const d = desembrouille(e.niveaux, { s: 0x155, prec: 1 });
  assert.deepEqual(d.slice(10), bits.slice(10));
  // une vraie ligne (de longues suites de 200 et de 040) n'a plus de palier long sur le câble
  const L = ligneSDI('1080p50', 100);
  assert.ok(plusLongPalier(embrouille(bitsDe(L.map((w) => w.v))).niveaux) < 40);
});

test('ST 2110 : paquets, débit, modèle de rythme -21 et tampon du récepteur', () => {
  const V = video('1080p50');
  assert.equal(V.ligne, 4800); assert.equal(V.parLigne, 4);
  assert.equal(V.nPaquetsImage, 4320); assert.equal(V.pps, 216000);
  assert.ok(V.ip > 2.1 && V.ip < 2.2, `≈ 2,2 Gb/s (${V.ip})`);
  assert.ok(V.efficacite > 0.9 && V.efficacite < 1);
  const N = modele21('1080p50', 'N'), W = modele21('1080p50', 'W');
  assert.deepEqual([N.cmax, N.vrx], [5, 8]);
  assert.deepEqual([W.cmax, W.vrx], [16, 720]);
  assert.ok(tampon(emissions('N', 4320), 4320).max <= N.vrx, 'émetteur étroit : sous VRX');
  assert.ok(tampon(emissions('rafale', 4320), 4320).max > W.vrx, 'rafale : déborde même un récepteur large');
  const A = audio(2, 0.001);
  assert.deepEqual([A.ech, A.charge, A.pps], [48, 288, 1000]);
  assert.deepEqual(fusion(0, 0, 100), { repares: 0, perdus: 0, n: 100 });
  assert.deepEqual(fusion(1, 0, 100), { repares: 100, perdus: 0, n: 100 });
  assert.equal(surabonnement(48, 25, 4, 100).ratio, 3);
});

test('niveau 2 : apprentissage, inondation, diffusion limitée au VLAN, trunk filtré', () => {
  const l2 = new L2().addSwitch('SW');
  for (const [p, v] of [[1, 10], [2, 10], [3, 10], [4, 20]]) l2.port('SW', p, v);
  l2.port('SW', 7, 0, [10, 20]);
  l2.addHost('A', 'AA', '10.0.10.1', 'SW', 1).addHost('B', 'BB', '10.0.10.2', 'SW', 2).addHost('D', 'DD', '10.0.10.3', 'SW', 3).addHost('C', 'CC', '10.0.20.1', 'SW', 4);
  let r = l2.forward('SW', 1, 'AA', 'BB');
  assert.equal(r.decision, 'inondation'); assert.deepEqual(r.out, [2, 3]); assert.ok(r.learned);
  r = l2.forward('SW', 2, 'BB', 'AA');
  assert.equal(r.decision, 'connue'); assert.deepEqual(r.out, [1]);
  r = l2.forward('SW', 1, 'AA', DIFFUSION);
  assert.equal(r.decision, 'diffusion'); assert.deepEqual(r.out, [2, 3]);
  r = l2.forward('SW', 4, 'CC', 'AA');
  assert.equal(r.vlan, 20); assert.deepEqual(r.out, [], 'A n\'est pas dans le VLAN 20');
  assert.equal(l2.forward('SW', 7, 'EE', 'AA', 30).decision, 'filtrée');
  assert.deepEqual(l2.table('SW').map((e) => e.mac), ['AA', 'BB', 'CC']);
});

test('routage : direct, par la passerelle, sans passerelle, masque trop large', () => {
  assert.equal(reseauDe('10.1.20.31', 24), '10.1.20.0');
  assert.equal(reseauDe('10.1.60.20', 16), '10.1.0.0');
  assert.deepEqual([trajet('rcp1', 'ccu1').chemin, trajet('rcp1', 'ccu1').sauts], ['direct', 0]);
  assert.deepEqual([trajet('rcp1', 'nas').chemin, trajet('rcp1', 'nas').sauts], ['routeur', 1]);
  assert.equal(trajet('rcp1', 'nas', { passerelle: false }).chemin, 'sans-passerelle');
  const m = trajet('rcp1', 'nas', { masque: 16 });
  assert.equal(m.chemin, 'arp-perdu'); assert.equal(m.panne, 'masque'); assert.ok(!m.ok);
  for (const t of [trajet('rcp1', 'nas'), m]) for (const e of t.etapes) assert.ok(!bad(e));
});

test('fibre : bilan optique, état de la voie ; HF : espace libre et gain d\'antenne', () => {
  const B = bilanOptique(0.4, 4);
  assert.ok(Math.abs(B.recu - -3.74) < 1e-9); assert.equal(B.etat, 'bon');
  assert.equal(bilanOptique(2, 2, 'poussiere').etat, 'bon');
  assert.equal(bilanOptique(4, 6, 'sale', 'multi').etat, 'décroché');
  assert.equal(bilanOptique(5, 10, 'sale').etat, 'limite'); // −2 − 1,75 − 4 − 8 = −15,75 dBm
  // 2,2 GHz : ≈ 79 dB à 100 m, 6 dB de plus à chaque doublement
  assert.ok(Math.abs(fspl(100, 2200) - 79.3) < 0.1);
  assert.ok(Math.abs(fspl(200, 2200) - fspl(100, 2200) - 6.02) < 0.01);
  assert.equal(antGain('omni', 90), 2); assert.equal(antGain('patch', 0), 9); assert.equal(antGain('patch', 33), 6);
});

test('fiches « ? » des liaisons optiques : complètes, renvois valides', () => {
  assert.ok(CATS.includes(FIBRE_CAT));
  const ids = Object.keys(TERMS).filter((k) => TERMS[k].cat === FIBRE_CAT);
  assert.deepEqual(ids.sort(), ['cable-hybride', 'fibre-monomode', 'nettoyage-fibre', 'niveau-optique']);
  for (const id of ids) {
    const T = TERMS[id];
    assert.ok(T.t && T.short && T.body && T.car && T.ref, id);
    for (const s of T.see) assert.ok(TERMS[s], `${id} : renvoi ${s}`);
  }
});
