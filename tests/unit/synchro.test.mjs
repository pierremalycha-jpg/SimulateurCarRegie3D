// Le chapitre « La synchro » étoffé (v19.19) : le modèle pur des leçons, de la vue 3D du SPG et des exercices
// (cours/synchro_calc.js) — rythmes des formats, dérive, formes d'onde du black burst et du tri-level, pont
// diviseur et réflexion d'une ligne 75 Ω, verrouillage d'un appareil sur une sortie du générateur, word clock
// et échantillons par image, ST 2059-1 ; puis les huit leçons, leur rang dans le parcours et leurs fiches.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/scene.mjs';
import '../../src/cours/all.js';
import { lessonById } from '../../src/cours/index.js';
import { PARCOURS } from '../../src/cours/parcours.js';
import { TERMS } from '../../src/content/netterms.js';
// les fiches « ? » de tous les postes (liens.js les enregistre, comme le fait l'interface)
import '../../src/cours/liens.js';
import {
  rythmes, derive, secondesPour, phaseApres, bbMv, triMv, mesureBB, mesureTri, niveauLigne, reflexion, echoNs, retardCable,
  verrou, referenceSpg, decalage, avancePour, ltcVerdict, wordclock, audioParImage, pgcd, ptpDeUtc, imagePtp, echantillonPtp, timecodePtp, TAI_UTC,
} from '../../src/cours/synchro_calc.js';

const pres = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

test('les rythmes : image, ligne, échantillons vidéo et audio', () => {
  const R = rythmes('1080i50');
  assert.equal(R.imageMs, 40); assert.equal(R.champMs, 20); assert.ok(pres(R.ligneUs, 1e6 / 28125));
  assert.equal(R.echParLigne, 2640); assert.equal(R.audioParImage, 1920);
  assert.equal(rythmes('1080p50').echParLigne, 2640); assert.equal(rythmes('720p50').echParLigne, 1980);
  assert.equal(rythmes('625i50').echParLigne, 864); assert.equal(rythmes('525i59').echParLigne, 858); assert.equal(rythmes('1080i59').echParLigne, 2200);
  // la dérive : 1 ppm = 1 µs par seconde
  assert.equal(derive(20, 3600), 72000);
  assert.ok(pres(secondesPour(20, rythmes('1080i50').ligneUs / 2), 0.8889, 1e-3));
  assert.equal(secondesPour(0, 10), Infinity);
  // la phase reste dans une demi-période
  for (let s = 0; s < 500; s += 37) { const p = phaseApres(20, s, 40000); assert.ok(p > -20000 && p <= 20000); }
  assert.ok(pres(phaseApres(20, 1, 40000), 20));
});

test('les formes d\'onde : black burst PAL et tri-level 1080i50', () => {
  // black burst : 0 avant 0H, mi-hauteur à 0H, −300 mV sur le top, retour à 0 après 4,7 µs, salve de ± 150 mV
  assert.equal(bbMv(-1), 0); assert.ok(pres(bbMv(0), -150)); assert.equal(bbMv(2), -300); assert.equal(bbMv(5.2), 0);
  let max = 0; for (let t = 5.6; t < 8; t += 0.005) max = Math.max(max, Math.abs(bbMv(t)));
  assert.ok(max > 140 && max <= 150, `salve : ${max}`);
  assert.equal(bbMv(30), 0); assert.ok(pres(bbMv(30, 'ntsc'), 53.6), 'noir NTSC à 7,5 IRE');
  // la ligne suivante : la forme se répète toutes les 64 µs
  assert.ok(pres(bbMv(2 + 64), bbMv(2)));
  // tri-level : −300 puis +300, passage à 0 V au repère
  assert.equal(triMv(0), 0); assert.equal(triMv(-0.3), -300); assert.equal(triMv(0.3), 300); assert.equal(triMv(1), 0);
  const T = mesureTri('1080i50');
  assert.ok(pres(T.demiNs, 44000 / 74.25)); assert.ok(pres(T.ligneUs, 2640 / 74.25)); assert.ok(pres(T.monteeNs, 4000 / 74.25));
  assert.ok(pres(mesureTri('720p50').demiNs, 40000 / 74.25));
  const B = mesureBB('pal');
  assert.equal(B.ligneUs, 64); assert.equal(B.cycles, 10); assert.ok(pres(B.salveUs, 10 / 4.43361875));
});

test('la ligne de référence : pont diviseur, réflexion, retard', () => {
  assert.deepEqual([0, 1, 2, 3].map((n) => Math.round(niveauLigne(n).k * 1000) / 1000), [2, 1, 0.667, 0.5]);
  assert.equal(niveauLigne(1).verdict, 'ok'); assert.equal(niveauLigne(0).verdict, 'hors'); assert.equal(niveauLigne(2).verdict, 'hors');
  assert.equal(reflexion(Infinity), 1); assert.equal(reflexion(75), 0); assert.ok(pres(reflexion(50), -0.2)); assert.ok(pres(reflexion(37.5), -1 / 3));
  assert.equal(retardCable(100), 500); assert.equal(echoNs(10), 100);
});

test('le générateur : référence d\'entrée, verrouillage, décalages, timecode', () => {
  assert.equal(referenceSpg({ mode: 'interne' }).etat, 'interne');
  assert.equal(referenceSpg({ mode: 'genlock', entree: 'pal' }).etat, 'verrouille');
  assert.equal(referenceSpg({ mode: 'genlock', entree: '10mhz' }).etat, 'verrouille');
  assert.equal(referenceSpg({ mode: 'genlock', entree: 'pal', perdue: true, stay: true }).etat, 'stay');
  assert.equal(referenceSpg({ mode: 'genlock', entree: 'pal', perdue: true, stay: false }).etat, 'libre');
  assert.ok(verrou('ccu', '1080i50').ok && verrou('ccu', 'pal').ok);
  assert.ok(!verrou('ccu', '720p50').ok && !verrou('ccu', 'ntsc').ok && !verrou('ccu', '').ok);
  assert.ok(verrou('ptz', '720p50').ok && !verrou('ptz', '1080i50').ok);
  assert.ok(/59,94/.test(verrou('melangeur', '1080i59').texte));
  const d = decalage(80, 'pal'); assert.equal(d.lignes, 1); assert.ok(pres(d.us, 16));
  assert.ok(Object.is(decalage(-14.5, '1080i50').lignes, 0), 'pas de « −0 ligne »');
  assert.equal(avancePour(14.5), -14.5);
  assert.ok(ltcVerdict({ cadence: '25', source: 'heure', fuseau: 1 }).ok);
  assert.ok(!ltcVerdict({ cadence: '30', source: 'heure', fuseau: 1 }).ok);
  assert.ok(!ltcVerdict({ cadence: '25', source: 'programme', fuseau: 1 }).ok);
  assert.ok(!ltcVerdict({ cadence: '25', source: 'heure', fuseau: 2 }).ok);
});

test('le word clock : niveau reçu, seuils des entrées, échantillons par image', () => {
  // 5 V : une entrée TTL se cale, même avec deux charges ; 1 V centré sur 0 ne franchit pas son seuil haut
  const w5 = wordclock({ sortie: '5V', terminees: 1, recepteur: 'ttl' });
  assert.ok(w5.ok && !w5.reflexions && w5.haut > 2.4);
  assert.ok(!wordclock({ sortie: '1V', terminees: 1, recepteur: 'ttl' }).ok);
  assert.ok(wordclock({ sortie: '1V', terminees: 1, recepteur: 'large' }).ok, 'une entrée à large plage prend le 1 V');
  assert.ok(pres(wordclock({ sortie: '1V', terminees: 1 }).vpp, 1));
  assert.ok(!wordclock({ sortie: '5V', terminees: 1, recepteur: 'fragile' }).ok, 'une entrée « 3 V au plus » refuse le 5 V');
  assert.ok(!wordclock({ sortie: '5V', terminees: 2, recepteur: 'exigeant' }).ok, 'deux charges : moins de 4 V');
  assert.ok(wordclock({ sortie: '5V', terminees: 0, bouchon: false }).reflexions, 'ligne ouverte : des rebonds');
  // le niveau baisse à chaque charge en plus
  const v = [1, 2, 3, 4].map((n) => wordclock({ sortie: '5V', terminees: n }).vpp);
  for (let i = 1; i < v.length; i++) assert.ok(v[i] < v[i - 1]);
  // échantillons par image
  assert.deepEqual(audioParImage(48000, 25), { moyen: 1920, sequence: 1, total: 1920, motif: [1920] });
  assert.equal(audioParImage(48000, 50).moyen, 960);
  const ntsc = audioParImage(48000, 30000, 1001);
  assert.equal(ntsc.sequence, 5); assert.equal(ntsc.total, 8008); assert.deepEqual(ntsc.motif, [1602, 1601, 1602, 1601, 1602]);
  assert.equal(audioParImage(44100, 30000, 1001).sequence, 100);
  assert.equal(pgcd(48048000, 30000), 6000);
});

test('ST 2059-1 : l\'heure PTP donne l\'image, sa phase, le timecode', () => {
  assert.equal(TAI_UTC, 37);
  const t = ptpDeUtc(Date.UTC(2026, 9, 27, 19, 45, 0, 530));
  assert.ok(pres(t, Date.UTC(2026, 9, 27, 19, 45, 0, 530) / 1000 + 37));
  const I = imagePtp(t, 25);
  assert.equal(I.n, Math.floor(t * 25)); assert.ok(pres(I.phaseMs + I.prochainMs, 40, 1e-6)); assert.ok(I.phaseMs >= 0 && I.phaseMs < 40);
  assert.ok(pres(I.phaseMs, 10, 1e-3), `phase ${I.phaseMs}`); // 530 ms = 13 × 40 ms + 10 ms
  const J = imagePtp(1000.03, 25); assert.equal(J.n, 25000); assert.ok(pres(J.phaseMs, 30, 1e-6));
  const K = imagePtp(t, 30000, 1001); assert.ok(K.phaseMs >= 0 && K.phaseMs < 1001 / 30 + 1e-9);
  assert.equal(timecodePtp(t, 25, 1), '20:45:00:13');
  assert.equal(timecodePtp(t, 50, 2), '21:45:00:26');
  const E = echantillonPtp(1000.03); assert.equal(E.n, 48001440); assert.equal(E.dansImage, 1440);
});

test('les huit leçons : rangées dans le parcours, fiches « ? » connues, une manipulation chacune', () => {
  const ids = Object.values(PARCOURS.synchro).flat();
  assert.deepEqual(ids, ['synchro-bases', 'synchro-timecode', 'synchro-signaux', 'synchro-genlock', 'synchro-distribution', 'synchro-spg', 'synchro-wordclock', 'synchro-2059']);
  for (const id of ids) {
    const f = lessonById(id); assert.ok(f && f.chapter.id === 'synchro', id);
    const L = f.lesson;
    assert.ok(L.quiz.length >= 5 && typeof L.demo === 'function' && typeof L.figure === 'function', `${id} : quiz, manipulation, schéma`);
    for (const t of L.terms || []) assert.ok(TERMS[t], `${id} : fiche ${t}`);
  }
  for (const k of ['black-burst', 'tri-level', 'terminaison-75', 'word-clock', 'dars', 'stay-genlock']) {
    const T = TERMS[k]; assert.ok(T && T.short.length <= 220 && T.cat === 'Synchronisation', k);
    for (const s of T.see || []) assert.ok(TERMS[s], `${k} → ${s}`);
  }
  // l'exercice « Repérer les sorties du générateur » est rangé avec le SPG700
  assert.ok((lessonById('synchro-spg').lesson.exercises || []).some((x) => x.id === 'materiel-synchro'));
  assert.ok(!(lessonById('synchro-genlock').lesson.exercises || []).some((x) => x.id === 'materiel-synchro'));
});
