// Le Labo (v19.28) : les modèles des ateliers (optique, photométrie, sensitométrie, DMX), les défis
// (toujours solubles, jamais justes d'avance), le suivi dans la progression, le livret, le Cours.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATELIERS, DEFIS_LABO, atelierById, bilanAtelier } from '../../src/labo/ateliers.js';
import { DEFIS, tirageDefi, verifierItem, noterDefi, etatVide, scoreDefi } from '../../src/labo/defis.js';
import '../../src/labo/defis/all.js';
import { etatPour, MESURES, poser, INITIAL } from '../../src/labo/etats.js';
import { normaliserLabo, mergeLabo, noterEssai, defiReussi, SEUIL_DEFI } from '../../src/labo/suivi.js';
import * as O from '../../src/labo/calc/optique.js';
import * as P from '../../src/labo/calc/photometrie.js';
import * as S from '../../src/labo/calc/sensito.js';
import * as D from '../../src/labo/calc/dmx.js';
import { competence, SAVOIRS, RATTACHEMENT } from '../../src/content/referentiel.js';
import { TERMS } from '../../src/content/netterms.js';
import '../../src/content/terms_labo.js';
import '../../src/content/terms_video.js';
import '../../src/content/terms_mesure.js';
import { activityState, ACTIVITES } from '../../src/livret.js';
import { PROG, migrateProgress, mergeProgress, PROG_VERSION } from '../../src/shared.js';
import { lessonById, allLessons } from '../../src/cours/index.js';
import '../../src/cours/all.js';
import { NOTIONS } from '../../src/camlab/notions/index.js';
import { SPECIAL, specialState, allExercises } from '../../src/cours/exercices.js';
import { BADGES } from '../../src/game/xp.js';

const proche = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} : ${a} au lieu de ${b}`);
let graine = 7;
const rnd = () => { graine = (graine * 16807) % 2147483647; return graine / 2147483647; };

test('le catalogue : des ateliers rattachés au référentiel, des fiches et des liens qui existent', () => {
  assert.deepEqual(ATELIERS.map((A) => A.id), ['optique', 'photometrie', 'sensito', 'dmx', 'dot2']);
  for (const A of ATELIERS) {
    assert.ok(A.competences.length && A.competences.every((c) => competence(c)), `${A.id} : compétences officielles`);
    assert.ok(A.savoirs.every((s) => SAVOIRS[s]), `${A.id} : savoirs`);
    assert.ok(A.terms.every((t) => TERMS[t]), `${A.id} : fiches « ? »`);
    for (const L of A.liens) assert.ok(L.lecon ? lessonById(L.lecon) : NOTIONS[L.camera], `${A.id} : lien ${L.titre}`);
    assert.equal(!!A.libre, A.defis.length === 0, `${A.id} : noté ou libre`);
  }
  assert.equal(new Set(DEFIS_LABO.map((d) => d.id)).size, DEFIS_LABO.length, 'des identifiants uniques');
  assert.deepEqual(Object.keys(DEFIS).sort(), DEFIS_LABO.map((d) => d.id).sort(), 'un générateur par défi annoncé');
});

test('optique : les chiffres du module caméra, l\'hyperfocale, la tache au point, le champ', () => {
  const [a, b] = O.limites(54, 1.8, 0.011, 3);
  proche(a, 2.94, 0.005, 'limite proche'); proche(b, 3.06, 0.005, 'limite lointaine');
  proche(O.hyperfocale(4.5, 4, 0.011), 0.465, 0.005, 'hyperfocale 4,5 mm f/4');
  assert.equal(O.limites(4.5, 4, 0.011, 1)[1], Infinity, 'au-delà de l\'hyperfocale : jusqu\'à l\'infini');
  assert.equal(O.tache(50, 2, 4, 4), 0, 'au point, pas de tache');
  assert.ok(O.tache(50, 2, 4, 2) > O.tache(50, 8, 4, 2), 'fermer réduit la tache');
  proche(O.angleH(O.CAPTEURS.ff, 25), 71.5, 0.1, 'angle 25 mm plein format');
  proche(O.recadrage(O.CAPTEURS.s35), 1.446, 0.01, 'recadrage Super 35');
  proche(O.champ(O.CAPTEURS['2/3'], 9.59, 10).w, 10, 1e-9, 'champ');
});

test('photométrie : inverse du carré, cosinus, exposition, gradateur, mireds, contraste', () => {
  const e1 = P.eclairage({ source: 'fresnel', angle: 12, niveau: 1, d: 2 }).E, e2 = P.eclairage({ source: 'fresnel', angle: 12, niveau: 1, d: 4 }).E;
  proche(e1 / e2, 4, 1e-9, 'deux fois plus loin, quatre fois moins');
  proche(P.eclairage({ source: 'fresnel', angle: 12, niveau: 1, d: 2, incidence: 60 }).E, e1 / 2, 1e-6, 'cos 60° = 0,5');
  proche(P.eclairage({ source: 'fresnel', angle: 20, niveau: 1, d: 3, alpha: 10 }).I / P.eclairage({ source: 'fresnel', angle: 20, niveau: 1, d: 3 }).I, 0.5, 1e-9, 'à la moitié de l\'angle de faisceau : 50 %');
  proche(P.ouverture(1000, 800, 1 / 50), 8, 1e-9, '1 000 lx, 800 ISO, 1/50 : f/8');
  proche(P.eclairementPour(4, 800, 1 / 50), 250, 1e-9);
  const g = P.gradateur(P.SOURCES.fresnel, 0.5); proche(g.flux, 0.0947, 0.001, 'flux à mi-tension'); proche(g.T, 2392, 2, 'température à mi-tension');
  proche(P.eclairage({ source: 'fresnel', angle: 30, niveau: 1, gel: 'ctb', d: 3 }).T, 5698, 3, 'halogène + CTB');
  proche(P.contraste(300, 100).rapport, 4, 1e-9); proche(P.contraste(300, 100).diaphs, 2, 1e-9);
  proche(P.melange([{ E: 100, T: 3200 }, { E: 100, T: 5600 }]).T, 1e6 / ((1e6 / 3200 + 1e6 / 5600) / 2), 1e-6, 'mélange en mireds');
});

test('sensitométrie : les courbes placent le gris où on l\'attend, le gain fait écrêter plus tôt', () => {
  proche(S.signal('bt709', S.GRIS).V, 0.409, 0.001, 'BT.709');
  proche(S.signal('slog3', S.GRIS).V, 420 / 1023, 1e-4, 'S-Log3');
  proche(S.signal('hlg', S.GRIS).V, 0.38, 0.002, 'HLG gris'); proche(S.signal('hlg', 0.9).V, 0.73, 0.01, 'HLG blanc (BT.2408 : 75 %)');
  proche(S.gainDiaphs(6.0206), 1, 1e-3);
  proche(S.plage('slog3', 0, 0).dessus, 6, 1e-6, 'S-Log3 va jusqu\'à la saturation du capteur');
  proche(S.plage('bt709', 0, 0).dessus, 2.73, 0.01, 'BT.709 écrête vers +2,7 diaphs');
  assert.ok(S.plage('knee', 0, 0).dessus > 5, 'le knee garde plus de 5 diaphs');
  proche(S.plage('bt709', 0, 0).dessus - S.plage('bt709', 0, 12).dessus, 2, 0.01, '+12 dB : deux diaphs de moins en haut');
  proche(S.plage('bt709', 0, 0).dessous, S.plage('bt709', 0, 12).dessous, 1e-9, 'le gain ne gagne rien dans les noirs');
  proche(S.signal('bt709', S.GRIS, S.expoPourGris('bt709', 0.5)).V, 0.5, 1e-3, 'exposer pour un niveau');
  assert.ok(S.signal('bt709', 4).ecrete && !S.signal('knee', 4).ecrete);
});

test('DMX : trame, adresses, 16 bits, DIP, ligne, Art-Net et sACN', () => {
  const t = D.trame(512); assert.equal(t.us, 22760); proche(t.hz, 43.9, 0.05);
  assert.equal(D.portAddress(0, 1, 3), 19); assert.deepEqual(D.dePortAddress(19), { net: 0, sub: 1, uni: 3 });
  assert.equal(D.sacnMulticast(300), '239.255.1.44'); assert.equal(D.sacnMulticast(1), '239.255.0.1');
  assert.deepEqual(D.valeur16(50), { v: 32768, grossier: 128, fin: 0 }); assert.equal(D.valeur8(40), 102);
  assert.equal(D.absolue(3, 17), 1041); assert.deepEqual(D.versUA(1041), { univers: 3, adresse: 17 });
  for (const a of [1, 37, 256, 511]) assert.equal(D.deDip(D.dip(a)), a);
  const list = [{ id: 'a', nom: 'a', modele: 'par', mode: '8 canaux', adresse: 1 }, { id: 'b', nom: 'b', modele: 'lyre', mode: '16 canaux', adresse: 9 }];
  assert.ok(D.aLaSuite(list, 1)); list[1].adresse = 8; assert.ok(!D.aLaSuite(list, 1));
  assert.deepEqual(D.planUnivers(list).conflits.sort(), ['a', 'b']);
  assert.ok(!D.diagLigne({ recepteurs: 40, longueur: 100, terminaison: true, y: false, splitter: 0 }).ok, '40 récepteurs sur une branche');
  assert.ok(D.diagLigne({ recepteurs: 40, longueur: 100, terminaison: true, y: false, splitter: 2 }).ok, 'un splitter partage');
  const c = { ip: '2.0.0.1', masque: '255.0.0.0', protocole: 'artnet', univers: 1 };
  assert.ok(D.liaison(c, { ip: '2.0.0.9', masque: '255.0.0.0', protocole: 'artnet', net: 0, sub: 0, uni: 0, sacn: 1 }).ok, 'univers 1 = Port-Address 0');
  assert.ok(!D.liaison(c, { ip: '2.0.0.9', masque: '255.0.0.0', protocole: 'artnet', net: 0, sub: 0, uni: 1, sacn: 1 }).ok, 'le décalage d\'un');
  assert.ok(!D.liaison(c, { ip: '10.0.0.9', masque: '255.0.0.0', protocole: 'artnet', net: 0, sub: 0, uni: 0, sacn: 1 }).ok, 'pas le même réseau');
  proche(D.debitArtnet(44).kbps, 209.8, 0.1);
});

test('les défis : trois questions, au moins un réglage, toujours solubles, jamais justes d\'avance', () => {
  for (const d of DEFIS_LABO) {
    for (let k = 0; k < 150; k++) {
      const t = tirageDefi(d.id, rnd); assert.ok(t);
      assert.equal(t.items.length, 3, d.id);
      assert.ok(t.items.some((it) => it.type === 'reglage'), `${d.id} : un réglage`);
      for (const it of t.items) {
        assert.ok(it.q && it.solution && it.aides && it.aides.length === 2, `${d.id} : énoncé, solution, deux aides`);
        if (it.type !== 'reglage') continue;
        const st = poser(etatPour(d.atelier, t.scene), it.fixe || {});
        assert.ok(!verifierItem(it, null, { st, m: MESURES[d.atelier](st) }).ok, `${d.id} : déjà juste au départ`);
        poser(st, it.corrige);
        const r = verifierItem(it, null, { st, m: MESURES[d.atelier](st) });
        assert.ok(r.ok, `${d.id} : la solution ne passe pas (${r.mesure} ; ${r.why})`);
      }
      // les autres questions acceptent leur propre réponse
      for (const it of t.items) if (it.type === 'nombre') assert.ok(verifierItem(it, String(it.answer)).ok, `${d.id} : ${it.q}`);
    }
  }
});

test('poser : chemins pointés, éléments de liste par id, objets fondus', () => {
  const st = INITIAL.dmx();
  poser(st, { 'appareils.f2.adresse': 99, 'console.univers': 3, ligne: { terminaison: false } });
  assert.equal(st.appareils.find((x) => x.id === 'f2').adresse, 99);
  assert.equal(st.console.univers, 3); assert.equal(st.ligne.terminaison, false); assert.equal(st.ligne.recepteurs, 12, 'le reste de la ligne gardé');
});

test('le suivi : un essai noté, réussi seul ou non, fusionné entre deux appareils', () => {
  let L = noterEssai(undefined, 'opt-isoler', 45, true).L;
  assert.ok(!L.defis['opt-isoler'].seul);
  let r = noterEssai(L, 'opt-isoler', 80, false); L = r.L; assert.ok(!r.premier && !L.defis['opt-isoler'].seul, 'avec la solution : pas seul');
  r = noterEssai(L, 'opt-isoler', 70, true); L = r.L; assert.ok(r.premier && L.defis['opt-isoler'].seul);
  assert.deepEqual(L.defis['opt-isoler'].runs, [45, 80, 70]); assert.equal(L.defis['opt-isoler'].best, 80);
  const B = { defis: { 'opt-isoler': { best: 90, seul: false, n: 2, at: Date.now() + 10, runs: [10, 90] }, 'dmx-dip': { best: 60, seul: true, n: 1, at: 5, runs: [60] } } };
  const M = mergeLabo(L, B);
  assert.equal(M.defis['opt-isoler'].best, 90); assert.ok(M.defis['opt-isoler'].seul); assert.ok(M.defis['dmx-dip'].seul);
  assert.deepEqual(normaliserLabo({ defis: { x: 'abîmé', y: { best: 50, runs: [50, 'a'] } } }), { defis: { y: { best: 50, seul: false, n: 1, at: 0, runs: [50] } } });
  // un essai complet, noté comme l'exercice du Cours
  const t = tirageDefi('dmx-dip', rnd); const etats = t.items.map(() => ({ ...etatVide(), ok: true }));
  assert.equal(scoreDefi(t.items, etats), 100);
  const Pp = { labo: undefined }; const res = noterDefi(Pp, 'dmx-dip', t.items, etats);
  assert.ok(res.reussi && res.seul && res.premier && defiReussi(Pp, 'dmx-dip'));
  etats[0].aides = 2; etats[1].erreurs = 1; assert.equal(scoreDefi(t.items, etats), Math.round(100 * (0.5 + 0.75 + 1) / 3));
  assert.equal(SEUIL_DEFI, 60);
});

test('progression v10 : l\'entrepôt et la Carrière retirés, le Labo remis en forme et fusionné', () => {
  assert.ok(PROG_VERSION >= 10);
  const p = migrateProgress({ v: 9, entrepot: { missions: { conference: { best: 80 } } }, carriere: { recus: {} }, labo: { defis: { 'sen-gris': { best: 70, seul: true, runs: [70] } } } });
  assert.equal(p.entrepot, undefined); assert.equal(p.carriere, undefined);
  assert.equal(p.labo.defis['sen-gris'].best, 70); assert.equal(p.v, PROG_VERSION);
  const G = /** @type {any} */ (PROG); G.labo = { defis: { 'sen-gris': { best: 40, seul: false, n: 1, at: 1, runs: [40] } } };
  mergeProgress({ v: 10, labo: { defis: { 'sen-gris': { best: 75, seul: true, n: 1, at: 2, runs: [75] } } } });
  assert.ok(G.labo.defis['sen-gris'].seul); assert.equal(G.labo.defis['sen-gris'].best, 75);
  delete G.labo;
});

test('livret, Cours et badges : chaque défi compte pour les compétences de son atelier', () => {
  for (const d of DEFIS_LABO) assert.deepEqual(RATTACHEMENT.labo[d.id], atelierById(d.atelier).competences, d.id);
  const Pp = { labo: { defis: { 'pho-niveau': { best: 80, seul: true }, 'pho-exposer': { best: 70, seul: false } } } };
  assert.deepEqual(activityState(Pp, 'labo', 'pho-niveau'), { done: true, aided: false });
  assert.deepEqual(activityState(Pp, 'labo', 'pho-exposer'), { done: false, aided: true });
  assert.ok(ACTIVITES.C17.some((a) => a.kind === 'labo' && a.ref === 'pho-niveau'));
  // un exercice du Cours par atelier noté, rangé dans une seule leçon, fait quand tous les défis sont réussis seul
  for (const A of ATELIERS.filter((x) => !x.libre)) {
    const id = 'x-labo-' + A.id;
    assert.ok(SPECIAL[id] && SPECIAL[id].go.labo === A.id, id);
    assert.equal(allExercises().filter((x) => x.id === id).length, 1, `${id} : une seule leçon`);
    const all = { labo: { defis: Object.fromEntries(A.defis.map((d) => [d.id, { best: 90, seul: true }])) } };
    assert.ok(specialState(id, all).done); assert.ok(!specialState(id, { labo: { defis: {} } }).done);
    assert.deepEqual(bilanAtelier(all, A.id), { reussis: A.defis.length, total: A.defis.length });
  }
  assert.ok(allLessons().length > 0);
  assert.ok(['laborantin', 'atelier-complet', 'labo-complet'].every((b) => BADGES.some((x) => x.id === b)));
  assert.ok(!BADGES.some((x) => x.id === 'entrepot' || x.id === 'embauche'));
});
