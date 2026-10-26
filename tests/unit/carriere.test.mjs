// La Carrière (src/carriere/) : les mails arrivent dans l'ordre (l'offre, puis le retour quand la
// mission est réussie, puis l'offre suivante), une mission est réussie quand l'activité qu'elle
// reprend l'est (visite guidée, mission de l'entrepôt), la lecture se retient, la progression
// v2 monte en v3 et deux appareils fusionnent sans rien perdre. Le moule : chaque épisode cite des
// postes du car et des missions de l'entrepôt qui existent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/dom.mjs';
import { EPISODES, POSTES_STAGIAIRE, SOCIETE_DEFAUT, episodeById } from '../../src/carriere/mails.js';
import { avancement, attendus, recevoir, boite, nonLus, marquerLu, enCours, commencee, mergeCarriere, normaliser } from '../../src/carriere/index.js';
import { STATION_INFO } from '../../src/content/stations.js';
import { MISSIONS } from '../../src/entrepot/missions.js';
import { PROG, PROG_VERSION, migrateProgress, mergeProgress } from '../../src/shared.js';
import { BADGES } from '../../src/game/xp.js';

const visiteFaite = (P, postes = POSTES_STAGIAIRE) => { P.tutor = P.tutor || {}; P.tutor['prise-en-main'] = { done: true }; for (const id of postes) P.tutor['poste-' + id] = { done: true }; };

test('le moule : chaque épisode a son mail, son ordre de mission et son retour ; les postes et les missions existent', () => {
  const ids = new Set();
  for (const ep of EPISODES) {
    assert.ok(!ids.has(ep.id), `épisode ${ep.id} en double`); ids.add(ep.id);
    for (const r of ep.requis) assert.ok(episodeById(r) && EPISODES.indexOf(episodeById(r)) < EPISODES.indexOf(ep), `${ep.id} : le requis ${r} vient avant`);
    const c = { societe: 'Ma société', score: 72 };
    assert.ok(ep.corps(c).length > 200 && ep.retour.corps(c).length > 100, `${ep.id} : des mails écrits`);
    assert.ok(ep.objet && ep.retour.objet && ep.de.nom && ep.retour.de.nom && ep.poste);
    const M = ep.mission; assert.ok(M.lieu && M.titre && M.duree && M.bouton && M.attendu.length);
    const a = M.action;
    if (a.type === 'visite') for (const id of a.postes) assert.ok(STATION_INFO[id], `${ep.id} : le poste ${id} existe`);
    else { assert.ok(MISSIONS.some((m) => m.id === a.mission), `${ep.id} : la mission ${a.mission} existe`); assert.ok(a.seuil > 0 && a.seuil <= 100); }
  }
  assert.ok(EPISODES[0].corps({ societe: 'Ma société', score: null }).includes('Ma société'), 'la société du formateur est citée');
  assert.equal(EPISODES[0].requis.length, 0, 'le premier épisode est ouvert d\'emblée');
  assert.equal(POSTES_STAGIAIRE.length, 6);
});

test('la boîte : le premier mail, la mission de stagiaire, le retour d\'Olivier et l\'offre suivante', () => {
  const P = {};
  assert.equal(commencee(P), false);
  assert.deepEqual(attendus(P), ['offre:stagiaire']);
  assert.deepEqual(recevoir(P, 1000), ['offre:stagiaire']);
  assert.ok(commencee(P));
  assert.deepEqual(recevoir(P, 2000), [], 'un mail n\'arrive qu\'une fois');
  let B = boite(P);
  assert.equal(B.length, 1); assert.equal(B[0].kind, 'offre'); assert.equal(B[0].lu, false);
  assert.ok(B[0].corps.includes(SOCIETE_DEFAUT), 'sans réglage du formateur : le nom fictif');
  assert.equal(nonLus(P), 1);
  assert.equal(enCours(P).id, 'stagiaire');
  // la visite à moitié faite : la mission avance, rien de nouveau n'arrive
  P.tutor = { 'prise-en-main': { done: true }, 'poste-realisateur': { done: true }, 'poste-scripte': { done: true } };
  const A = avancement(episodeById('stagiaire'), P);
  assert.equal(A.fait, false); assert.equal(A.n, 2, 'le tour et le réalisateur (la scripte n\'est pas demandée)'); assert.equal(A.total, 7);
  assert.equal(A.points.find((x) => !x.ok).label, STATION_INFO.melangeur.title);
  assert.deepEqual(recevoir(P, 3000), []);
  // un poste commencé mais pas terminé ne compte pas
  visiteFaite(P); P.tutor['poste-son'] = { done: false };
  assert.equal(avancement(episodeById('stagiaire'), P).fait, false);
  P.tutor['poste-son'].done = true;
  assert.equal(avancement(episodeById('stagiaire'), P).fait, true);
  // réussie : le retour d'Olivier, puis l'offre suivante, dans cet ordre
  assert.deepEqual(recevoir(P, 4000), ['retour:stagiaire', 'offre:conference']);
  B = boite(P);
  assert.deepEqual(B.map((m) => m.id), ['offre:conference', 'retour:stagiaire', 'offre:stagiaire'], 'du plus récent au plus ancien');
  assert.equal(B[1].de.nom, 'Olivier');
  assert.equal(enCours(P).id, 'conference');
});

test('la mission de l\'entrepôt : réussie à partir du seuil, le score dans le mail de retour', () => {
  const P = {}; visiteFaite(P); recevoir(P, 10);
  const ep = episodeById('conference');
  assert.equal(avancement(ep, P).fait, false);
  P.entrepot = { missions: { conference: { best: { score: 59, at: 1 }, runs: [] } } };
  assert.equal(avancement(ep, P).fait, false, '59 / 100 : pas encore');
  assert.match(avancement(ep, P).points[0].label, /meilleur : 59 \/ 100/);
  assert.deepEqual(recevoir(P, 20), []);
  P.entrepot.missions.conference.best = { score: 85, at: 2 };
  assert.deepEqual(recevoir(P, 30), ['retour:conference']);
  const m = boite(P, { societe: 'Régie du Nord' }).find((x) => x.id === 'retour:conference');
  assert.match(m.corps, /85 \/ 100/);
  assert.equal(enCours(P), null, 'plus de mission en cours');
});

test('lecture : un mail ouvert est lu, une seule fois ; un mail inconnu ne l\'est pas', () => {
  const P = {}; recevoir(P, 100);
  assert.equal(marquerLu(P, 'offre:stagiaire', 200), true);
  assert.equal(marquerLu(P, 'offre:stagiaire', 300), false);
  assert.equal(P.carriere.lus['offre:stagiaire'], 200);
  assert.equal(marquerLu(P, 'offre:inconnu', 300), false);
  assert.equal(nonLus(P), 0);
});

test('fusion et mise en forme : la date la plus ancienne gagne, une Carrière abîmée est nettoyée', () => {
  const a = { recus: { 'offre:stagiaire': 50 }, lus: {} };
  const b = { recus: { 'offre:stagiaire': 40, 'retour:stagiaire': 90 }, lus: { 'offre:stagiaire': 60 } };
  assert.deepEqual(mergeCarriere(a, b), { recus: { 'offre:stagiaire': 40, 'retour:stagiaire': 90 }, lus: { 'offre:stagiaire': 60 } });
  assert.deepEqual(normaliser('abîmé'), { recus: {}, lus: {} });
  assert.deepEqual(normaliser({ recus: { 'offre:stagiaire': 'hier', 'offre:conference': -3, ok: 5 }, lus: [] }), { recus: { ok: 5 }, lus: {} });
  // un mail d'un épisode inconnu (version plus récente) reste enregistré mais ne s'affiche pas
  assert.equal(boite({ carriere: { recus: { 'offre:futur': 5, 'offre:stagiaire': 4 }, lus: {} } }).length, 1);
});

test('progression : v2 → v3, la Carrière se fusionne entre deux appareils, le badge « Embauché »', () => {
  assert.ok(PROG_VERSION >= 3);
  const p = migrateProgress({ v: 2, missions: {}, carriere: { recus: 'abîmé' } });
  assert.equal(p.v, PROG_VERSION);
  assert.deepEqual(p.carriere, { recus: {}, lus: {} });
  assert.equal(migrateProgress({ v: 2, missions: {} }).carriere, undefined, 'pas commencée : rien n\'est ajouté');
  const P = /** @type {any} */ (PROG);
  P.carriere = { recus: { 'offre:stagiaire': 500 }, lus: {} };
  mergeProgress({ carriere: { recus: { 'offre:stagiaire': 300, 'retour:stagiaire': 900 }, lus: { 'retour:stagiaire': 950 } } });
  assert.deepEqual(P.carriere, { recus: { 'offre:stagiaire': 300, 'retour:stagiaire': 900 }, lus: { 'retour:stagiaire': 950 } });
  const badge = BADGES.find((x) => x.id === 'embauche');
  assert.ok(badge);
  const Q = {}; visiteFaite(Q);
  assert.equal(badge.test({ P: Q }), false, 'la visite faite hors Carrière ne suffit pas');
  recevoir(Q, 1);
  assert.equal(badge.test({ P: Q }), true);
  delete P.carriere;
});
