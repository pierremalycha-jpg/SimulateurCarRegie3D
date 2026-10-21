// Section Cours : les thèmes rangent toutes les fiches du lexique (chacune une seule fois), et
// les liens vers les fiches existent : glossaire, bouton « Cours » des postes, « Emmène-moi » des
// familles du lexique.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FICHES, THEMES, familles, themeDe } from '../../src/content/cours/index.js';
import { GLOSSAIRE, POSTES, FAMILLE_POSTE, ficheDuTerme, posteFiche, premiere, ecrite } from '../../src/content/cours/liens.js';
import { CATS, TERMS } from '../../src/content/netterms.js';
import { GLOSSARY } from '../../src/content/glossary.js';
import { STATION_LIST } from '../../src/content/stations.js';

const existe = (id) => !!(FICHES[id] || TERMS[id]);

test('thèmes : chaque notion de cours est dans son thème, chaque fiche du lexique une seule fois', () => {
  for (const th of THEMES) for (const k of th.fiches) assert.equal(FICHES[k]?.theme, th.id, k);
  for (const [k, F] of Object.entries(FICHES)) {
    assert.ok(THEMES.some((th) => th.fiches.includes(k)), `${k} : rangée dans un thème`);
    if (F.term) assert.ok(TERMS[F.term], `${k} : fiche du lexique ${F.term}`);
  }
  const seen = new Map();
  for (const th of THEMES) {
    for (const k of th.fiches) { const id = FICHES[k].term || k; if (TERMS[id]) seen.set(id, (seen.get(id) || 0) + 1); }
    for (const f of familles(th)) for (const id of f.ids) seen.set(id, (seen.get(id) || 0) + 1);
  }
  for (const id of Object.keys(TERMS)) assert.equal(seen.get(id), 1, `${id} (${TERMS[id].cat})`);
  assert.ok(Object.keys(TERMS).length >= 140);
  // chaque famille du lexique est citée par un thème (sinon elle tombe dans Réseau)
  for (const c of CATS) assert.ok(THEMES.some((th) => th.familles.includes(c)), c);
  assert.equal(themeDe('oeil'), 'video');
  assert.equal(themeDe('ptp'), 'synchro');
  assert.equal(themeDe('waveform'), 'mesure');
  assert.equal(themeDe('sdi'), 'video');
});

test('glossaire : chaque lien vise un terme du glossaire et une fiche qui existe', () => {
  const terms = new Set(GLOSSARY.map(([t]) => t));
  for (const [t, ids] of Object.entries(GLOSSAIRE)) {
    assert.ok(terms.has(t), `« ${t} » absent du glossaire`);
    for (const id of [].concat(ids)) assert.ok(existe(id), `${t} → ${id}`);
  }
  assert.equal(ficheDuTerme('SDI'), 'sdi');
  assert.equal(ficheDuTerme('Genlock / référence'), ecrite('genlock') ? 'genlock' : 'timing-ref');
  assert.equal(ficheDuTerme('Vecteurscope'), 'vecteurscope');
  assert.equal(ficheDuTerme('Truquiste'), '');
  // seules les fiches écrites sont proposées
  for (const [t] of GLOSSARY) { const f = ficheDuTerme(t); if (f) assert.ok(ecrite(f), `${t} → ${f}`); }
  assert.ok(GLOSSARY.filter(([t]) => ficheDuTerme(t)).length >= 60);
});

test('postes : le bouton « Cours » ouvre une fiche qui existe ; familles du lexique → un poste', () => {
  const stations = new Set(STATION_LIST.map(([id]) => id));
  for (const [id, p] of Object.entries(POSTES)) {
    assert.ok(stations.has(id), id);
    for (const k of Array.isArray(p) ? p : [...p.sdi, ...p.ip]) assert.ok(existe(k), `${id} → ${k}`);
  }
  assert.equal(posteFiche('brassage'), 'sdi');
  assert.equal(posteFiche('reseau', false), 'ctrl-sdi');
  assert.equal(posteFiche('reseau', true), 'st2110');
  assert.equal(posteFiche('cadreur'), '');
  for (const c of CATS) {
    assert.ok(FAMILLE_POSTE[c], `famille ${c} : un poste`);
    assert.ok(stations.has(FAMILLE_POSTE[c].station), c);
  }
  assert.equal(premiere(['echantillonnage', 'sdi']), ecrite('echantillonnage') ? 'echantillonnage' : 'sdi');
  assert.equal(premiere(['hf'], true), 'hf');
});
