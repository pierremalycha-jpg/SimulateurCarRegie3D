// Le pass du technicien, les objets du profil, la série et les défis du jour (v19.25) :
// game/pass.js, game/cosmetiques.js, game/defis.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import '../helpers/dom.mjs';
import { PASS, profil, recuperer, equiper, aRecuperer, debloque, regler, mergeProfil, profilPourCompte, pseudoPropre, rarete, paliersDu } from '../../src/game/pass.js';
import { COSMETIQUES, PAR_DEFAUT, objet } from '../../src/game/cosmetiques.js';
import { award, xpPourNiveau, NIVEAU_MAX, game } from '../../src/game/xp.js';
import { serie, veille, jourDe, defisDuJour, etatDefis, DEFIS, DEFIS_XP, bonusSerie } from '../../src/game/defis.js';
import { ICON_NAMES } from '../../src/ui/icons.js';

const fresh = () => ({ missions: {}, visited: {}, scenarios: [], reports: [], tutor: {}, cours: {} });
const auNiveau = (n) => { const P = fresh(); /** @type {any} */ (P).game = { keys: { x: { at: 1, pts: xpPourNiveau(n), label: 'x' } } }; return P; };

test('le pass : une récompense à chaque niveau de 2 à 60, chaque objet une seule fois, tous les objets gagnables', () => {
  for (let n = 2; n <= NIVEAU_MAX; n++) assert.ok(paliersDu(n).length >= 1, `niveau ${n} sans récompense`);
  assert.ok(PASS.every((p) => p.niveau >= 2 && p.niveau <= NIVEAU_MAX));
  const vus = new Set();
  for (const p of PASS) { const k = p.type + ':' + p.id; assert.ok(!vus.has(k), 'en double : ' + k); vus.add(k); assert.ok(objet(p.type, p.id).id === p.id, 'objet inconnu : ' + k); }
  for (const [type, liste] of Object.entries(COSMETIQUES)) for (const x of liste) {
    if (x.id === PAR_DEFAUT[type]) assert.ok(!vus.has(type + ':' + x.id), 'l\'objet par défaut n\'est pas dans le pass');
    else assert.ok(vus.has(type + ':' + x.id), 'objet jamais gagné : ' + type + ':' + x.id);
  }
  // les paliers en 5 donnent un cadre ou une bannière (les plus rares)
  for (let n = 5; n <= 60; n += 5) assert.ok(paliersDu(n).some((p) => p.type === 'cadre' || p.type === 'banniere'), `niveau ${n}`);
  assert.equal(rarete(2), 'commun'); assert.equal(rarete(5), 'rare'); assert.equal(rarete(40), 'epique'); assert.equal(rarete(60), 'legendaire');
});

test('les objets : identifiants uniques, icônes des avatars connues, couleurs données', () => {
  for (const [type, liste] of Object.entries(COSMETIQUES)) {
    assert.equal(new Set(liste.map((x) => x.id)).size, liste.length, type);
    assert.ok(liste.some((x) => x.id === PAR_DEFAUT[type]), 'défaut de ' + type);
  }
  for (const a of COSMETIQUES.avatar) { assert.ok(ICON_NAMES.includes(a.ico), 'icône ' + a.ico); assert.equal(a.fond.length, 2); }
  for (const b of COSMETIQUES.banniere) assert.ok(/gradient/.test(b.fond), b.id);
});

test('récupérer, puis équiper : un objet verrouillé est refusé', () => {
  const P = auNiveau(5);
  assert.deepEqual(aRecuperer(P), [2, 3, 4, 5]);
  assert.equal(equiper('cadre', 'or', P), false, 'cadre or : niveau 25');
  assert.ok(debloque('cadre', 'bronze', P));
  const recus = recuperer(0, P);
  assert.equal(recus.length, 5, 'niveau 2 : deux objets, puis 3, 4, 5');
  assert.deepEqual(aRecuperer(P), []);
  assert.deepEqual(recuperer(3, P), [], 'déjà récupéré');
  assert.ok(equiper('cadre', 'bronze', P)); assert.equal(profil(P).cadre, 'bronze');
  assert.ok(equiper('avatar', 'casque', P), 'l\'objet par défaut se remet toujours');
  assert.equal(equiper('avatar', 'inconnu', P), false);
});

test('le profil : pseudo propre, vitrine de trois badges gagnés, fusion', () => {
  assert.equal(pseudoPropre('  Léa   <b>Martin</b> '), 'Léa bMartinb');
  assert.equal(pseudoPropre('ab'), '', 'trop court');
  assert.equal(pseudoPropre('x'.repeat(40)).length, 20);
  const P = auNiveau(3);
  game(P).badges = { 'premier-pas': 1, 'monteur': 2, 'brasseur': 3, 'sang-froid': 4 };
  regler({ pseudo: 'Léo', vitrine: ['premier-pas', 'erudit', 'monteur', 'brasseur', 'sang-froid'] }, P);
  assert.deepEqual(profil(P).vitrine, ['premier-pas', 'monteur', 'brasseur'], 'badges gagnés seulement, trois au plus');
  regler({ pseudo: '?' }, P); assert.equal(profil(P).pseudo, 'Léo', 'un pseudo invalide ne remplace pas');
  const m = mergeProfil({ pseudo: 'A', recus: { 2: 1 }, at: 5 }, { pseudo: 'B', recus: { 4: 1 }, at: 9 });
  assert.equal(m.pseudo, 'B'); assert.deepEqual(Object.keys(m.recus).sort(), ['2', '4']);
});

test('le profil public d\'un compte : les champs que permettent les règles de Firestore, sans adresse', () => {
  const P = auNiveau(12);
  const compte = { role: 'eleve', prenom: 'Léa', nom: 'martin', classe: 'c1', classeNom: 'BTS 1 TIEE', email: 'lea@exemple.fr' };
  let pub = profilPourCompte(P, compte);
  assert.equal(pub.pseudo, 'Léa M.', 'sans pseudo : le prénom et l\'initiale du nom');
  regler({ pseudo: 'Léo' }, P); pub = profilPourCompte(P, compte);
  assert.equal(pub.pseudo, 'Léo');
  const regles = fs.readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8');
  const bloc = regles.slice(regles.indexOf('match /profils/'));
  const permis = [...bloc.slice(bloc.indexOf('hasOnly(['), bloc.indexOf('])')).matchAll(/'(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(Object.keys(pub).sort(), [...permis].sort(), 'mêmes champs que firestore.rules');
  assert.equal(pub.role, 'eleve'); assert.equal(pub.classe, 'c1'); assert.equal(pub.niveau, 12);
  assert.ok(Number.isInteger(pub.xp) && Number.isInteger(pub.maj));
  assert.ok(!JSON.stringify(pub).includes('@'), 'jamais l\'adresse');
  assert.equal(pub.titre, 'Technicien', 'le grade, par défaut');
  assert.equal(profilPourCompte(P, { role: 'prof' }).classe, null);
});

test('la série de jours : d\'affilée jusqu\'à aujourd\'hui ou hier, record, bonus', () => {
  assert.equal(veille('2026-03-01'), '2026-02-28');
  assert.equal(veille('2026-01-01'), '2025-12-31');
  assert.equal(jourDe(new Date(2026, 10, 3, 23, 59).getTime()), '2026-11-03');
  const j = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'];
  assert.deepEqual(serie(j, '2026-11-02'), { n: 4, best: 4, aujourdhui: true });
  assert.deepEqual(serie(j, '2026-11-03'), { n: 4, best: 4, aujourdhui: false }, 'hier compte encore');
  assert.equal(serie(j, '2026-11-04').n, 0, 'un jour sauté : la série repart');
  assert.equal(serie([], '2026-11-04').best, 0);
  assert.equal(bonusSerie(1), 10); assert.equal(bonusSerie(3), 20); assert.equal(bonusSerie(30), 40);
});

test('les défis du jour : trois, stables pour une date, un défi d\'XP, réussis par les gains du jour', () => {
  const a = defisDuJour('2026-11-03'), b = defisDuJour('2026-11-03');
  assert.deepEqual(a.map((d) => d.id), b.map((d) => d.id));
  assert.equal(new Set(a.map((d) => d.id)).size, 3);
  assert.ok(DEFIS_XP.includes(a[0]) && DEFIS.includes(a[1]) && DEFIS.includes(a[2]));
  // sur un mois, les défis changent
  const tirages = new Set(); for (let d = 1; d <= 30; d++) tirages.add(defisDuJour(`2026-11-${String(d).padStart(2, '0')}`).map((x) => x.id).join());
  assert.ok(tirages.size > 10);
  // le 1er janvier 2026 : 250 XP, exercice en autonomie, mission réseau
  const P = fresh(); const at = new Date(2026, 0, 1, 9).getTime();
  assert.deepEqual(defisDuJour('2026-01-01').map((d) => d.id), ['xp250', 'exo', 'reseau']);
  award({ P, key: 'exo:son-n1', pts: 30, label: 'exo', at });
  let e = etatDefis(game(P), '2026-01-01');
  assert.ok(e[1].fini && e[1].recu, 'l\'exercice : réussi, sa récompense donnée');
  assert.ok(!e[2].fini);
  award({ P, key: 'net:m1', pts: 40, label: 'réseau', at });
  award({ P, pts: 200, label: 'gros', sorte: 'scenario', at });
  e = etatDefis(game(P), '2026-01-01');
  assert.ok(e.every((d) => d.fini && d.recu), JSON.stringify(e.map((d) => [d.defi.id, d.val, d.but])));
  assert.ok(game(P).defis['2026-01-01'].includes('tous'), 'les trois : bonus');
  assert.equal(game(P).log.filter((l) => l.k === 'defi').length, 4, 'trois défis et le bonus');
});
