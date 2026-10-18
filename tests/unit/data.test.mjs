// Cohérence des catalogues et des contenus : chaque référence (type de caméra, objectif, liaison,
// rôle, poste, position) pointe vers une entrée qui existe. Une faute de frappe dans les données
// se voit ici, pas pendant une formation.
import './../helpers/dom.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SENSORS, LENSES, CAMERA_TYPES, ROLES, LINKS, FORMATS, maxAperture } from '../../src/data/cameras.js';
import { SLOTS, ANTENNAS } from '../../src/data/stadium.js';
import { MODS, FECS, GUARDS, CN_REQ, cofdmBitrate, buildChannels } from '../../src/data/rf.js';
import { IRIS_STOPS, ND_FILTERS, LIGHTING } from '../../src/data/exposure.js';
import { TEAMS, PLAYER_NAMES, POSITIONS } from '../../src/data/match.js';
import { STATION_INFO, STATION_LIST } from '../../src/content/stations.js';
import { GLOSSARY } from '../../src/content/glossary.js';
import { GUIDE } from '../../src/content/guide.js';
import { CONTROLS_HELP } from '../../src/content/controls.js';
import { PRESETS } from '../../src/bcam.js';
import { ROLE_BRIEF } from '../../src/multi/roles.js';
import { ROLES_S } from '../../src/multi/session.js';
import { SLICES, STATION_SLICE } from '../../src/multi/slices.js';
import { atelierDebug } from '../../src/atelier.js';

const unique = (list, what) => {
  const seen = new Set(), dup = [];
  for (const x of list) { if (seen.has(x)) dup.push(x); seen.add(x); }
  assert.deepEqual(dup, [], `${what} en double`);
};

test('objectifs : focales et ouvertures cohérentes', () => {
  for (const [id, l] of Object.entries(LENSES)) {
    assert.ok(l.name, `${id} : nom`);
    assert.ok(l.fmin > 0 && l.fmin <= l.fmax, `${id} : focales ${l.fmin}–${l.fmax}`);
    assert.ok(l.f0 <= l.fLong, `${id} : ouverture plus fermée en bout de zoom`);
    // l'ouverture ne s'améliore jamais en zoomant, et le doubleur coûte 2 diaphragmes
    let prev = 0;
    for (let k = 0; k <= 20; k++) { const f = l.fmin + (l.fmax - l.fmin) * k / 20; const n = maxAperture(l, f, false); assert.ok(n >= prev - 1e-9, `${id} : rampe à ${f} mm`); prev = n; }
    if (l.ext) assert.equal(maxAperture(l, l.fmin, true), 2 * l.f0);
  }
});

test('types de caméra : objectifs, liaisons, rôles et capteur existent', () => {
  for (const [id, t] of Object.entries(CAMERA_TYPES)) {
    assert.ok(SENSORS[t.sensor], `${id} : capteur ${t.sensor}`);
    for (const l of t.lenses) assert.ok(LENSES[l], `${id} : objectif ${l}`);
    assert.ok(t.lenses.includes(t.defLens), `${id} : objectif par défaut ${t.defLens} hors liste`);
    for (const l of t.links) assert.ok(LINKS[l], `${id} : liaison ${l}`);
    assert.ok(t.links.includes(t.defLink), `${id} : liaison par défaut ${t.defLink} hors liste`);
    for (const r of t.roles) assert.ok(ROLES[r], `${id} : rôle ${r}`);
    assert.ok(t.label && t.short, `${id} : libellés`);
  }
});

test('liaisons : portée définie pour chaque format (sauf HF)', () => {
  for (const [id, l] of Object.entries(LINKS)) {
    if (id === 'hf') { assert.equal(l.max, null); continue; }
    for (const f of Object.keys(FORMATS)) assert.ok(l.max[f] > 0, `${id} : portée en ${f}`);
  }
});

test('positions caméras du stade', () => {
  unique(SLOTS.map((s) => s.id), 'position');
  for (const s of SLOTS) {
    assert.equal(s.pos.length, 3, s.id);
    assert.ok(s.types.length && s.types.every((t) => CAMERA_TYPES[t]), `${s.id} : types ${s.types}`);
    assert.ok(ROLES[s.role], `${s.id} : rôle ${s.role}`);
  }
  unique(ANTENNAS.map((a) => a.id), 'antenne');
  assert.ok(ANTENNAS.some((a) => a.on), 'au moins une antenne active');
});

test('dispositifs prédéfinis : chaque caméra est posable telle quelle', () => {
  for (const [name, list] of Object.entries(PRESETS)) {
    unique(list.map((o) => o.slotId), `${name} : position`);
    for (const o of list) {
      const slot = SLOTS.find((s) => s.id === o.slotId), T = CAMERA_TYPES[o.type];
      assert.ok(slot, `${name} : position ${o.slotId}`);
      assert.ok(T, `${name} : type ${o.type}`);
      assert.ok(slot.types.includes(o.type), `${name} : ${o.type} interdit en ${o.slotId}`);
      if (o.lens) assert.ok(T.lenses.includes(o.lens), `${name} : objectif ${o.lens} sur ${o.type}`);
      if (o.link) assert.ok(T.links.includes(o.link), `${name} : liaison ${o.link} sur ${o.type}`);
      assert.ok(ROLES[o.role], `${name} : rôle ${o.role}`);
    }
  }
});

test('HF : débit COFDM et plan de fréquences', () => {
  for (const m of Object.keys(MODS)) for (const f of Object.keys(FECS)) assert.ok(CN_REQ[m] && CN_REQ[m][f] != null, `C/N requis pour ${m} ${f}`);
  // DVB-T 8 MHz, 64QAM 2/3, GI 1/4 : 19,9 Mb/s (EN 300 744, tableau E.1)
  const r = cofdmBitrate('64QAM', '2/3', '1/4', 8);
  assert.ok(Math.abs(r - 19.9) < 0.3, `débit ${r}`);
  assert.ok(cofdmBitrate('QPSK', '1/2', '1/4', 8) < r);
  assert.ok(Object.keys(GUARDS).length >= 4);
  const ch = buildChannels();
  unique(ch.map((c) => c.f), 'fréquence');
  assert.ok(ch.some((c) => c.status === 'attrib'), 'des fréquences attribuées');
});

test('exposition : diaphragmes croissants, ND décroissants', () => {
  for (let i = 1; i < IRIS_STOPS.length; i++) assert.ok(IRIS_STOPS[i] > IRIS_STOPS[i - 1]);
  for (let i = 1; i < ND_FILTERS.length; i++) assert.ok(ND_FILTERS[i].f < ND_FILTERS[i - 1].f);
  for (const [id, l] of Object.entries(LIGHTING)) assert.ok(l.cct > 2000 && l.cct < 10000, id);
});

test('match : deux équipes de onze', () => {
  assert.equal(TEAMS.length, 2);
  for (const n of PLAYER_NAMES) assert.equal(n.length, 11);
  assert.equal(POSITIONS.length, 11);
});

test('postes : fiches complètes, liste du guide et postes du car', () => {
  for (const [id, I] of Object.entries(STATION_INFO)) {
    assert.ok(I.title && I.where && I.role, `${id} : titre, lieu, rôle`);
    for (const k of ['gear', 'process', 'tips']) if (I[k]) assert.ok(Array.isArray(I[k]), `${id}.${k}`);
  }
  unique(STATION_LIST.map(([id]) => id), 'poste du guide');
  assert.deepEqual(STATION_LIST.map(([id]) => id).filter((id) => !STATION_INFO[id]), [], 'postes du guide sans fiche');
  assert.deepEqual(Object.keys(STATION_INFO).filter((id) => !STATION_LIST.some(([x]) => x === id)), [], 'fiches absentes du guide');
  // postes posés dans le car (truck.js : st('id', …, { station: 'fiche' }))
  const src = fs.readFileSync(new URL('../../src/truck.js', import.meta.url), 'utf8');
  const truck = [...src.matchAll(/\bst\('(\w+)'[^\n]*/g)].map((m) => ({ id: m[1], station: (m[0].match(/station: '(\w+)'/) || [])[1] || m[1] }));
  assert.ok(truck.length > 15, 'postes du car trouvés');
  for (const s of truck) assert.ok(STATION_INFO[s.station], `poste ${s.id} : fiche ${s.station}`);
  // rôles de session : le poste conseillé existe dans le car
  for (const [r, B] of Object.entries(ROLE_BRIEF)) {
    assert.ok(ROLES_S[r], `fiche de rôle ${r} sans rôle de session`);
    if (B.station) assert.ok(truck.some((s) => s.id === B.station), `${r} : poste ${B.station}`);
    assert.ok(B.steps.length > 0, `${r} : mission`);
  }
  for (const r of Object.keys(ROLES_S)) assert.ok(ROLE_BRIEF[r], `rôle ${r} sans fiche`);
});

test('session : tranches et rôles se répondent', () => {
  for (const [id, s] of Object.entries(SLICES)) {
    assert.ok(s.role === '_host' || ROLES_S[s.role], `${id} : rôle ${s.role}`);
    if (s.role !== '_host') assert.ok(ROLES_S[s.role].slices.includes(id), `${id} absente du rôle ${s.role}`);
    assert.ok(['presence', 'event'].includes(s.via), `${id} : via ${s.via}`);
    if (s.via === 'presence') assert.ok(s.field && s.field.length === 1, `${id} : champ de présence`);
  }
  unique(Object.values(SLICES).filter((s) => s.field).map((s) => s.field), 'champ de présence');
  for (const [r, R] of Object.entries(ROLES_S)) for (const id of R.slices) assert.ok(SLICES[id], `${r} : tranche ${id}`);
  for (const [st, id] of Object.entries(STATION_SLICE)) { assert.ok(SLICES[id], `${st} → ${id}`); assert.ok(STATION_INFO[st], `poste ${st}`); }
});

test('glossaire : termes uniques et définis', () => {
  unique(GLOSSARY.map(([t]) => t.toLowerCase()), 'terme');
  for (const [t, d] of GLOSSARY) assert.ok(t.trim() && d && d.length > 10, `définition de ${t}`);
});

test('guide : chapitres uniques, HTML équilibré', () => {
  unique(GUIDE.map((c) => c.id), 'chapitre');
  for (const c of GUIDE) {
    assert.ok(c.title && c.html, c.id);
    for (const tag of ['ul', 'ol', 'li', 'table', 'tr', 'b', 'i', 'h4']) {
      const open = (c.html.match(new RegExp(`<${tag}[\\s>]`, 'g')) || []).length, close = (c.html.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      assert.equal(open, close, `${c.id} : <${tag}> ouvertes ${open}, fermées ${close}`);
    }
  }
});

test('aide des commandes', () => {
  unique(CONTROLS_HELP.map(([k]) => k), 'commande');
  for (const [k, d] of CONTROLS_HELP) assert.ok(k && d, k);
});

test('atelier : chaque opération dépend d\'opérations qui existent, sans cycle', () => {
  const { OPS, PARTS } = atelierDebug;
  const ids = OPS.map((o) => o.id); unique(ids, 'opération');
  for (const o of OPS) {
    for (const r of o.req) assert.ok(ids.includes(r), `${o.id} : prérequis ${r}`);
    if (o.part) assert.ok(PARTS[o.part], `${o.id} : pièce ${o.part}`);
    if (o.on && o.on !== 'wall') assert.ok(PARTS[o.on], `${o.id} : sur ${o.on}`);
  }
  // ordre réalisable : on peut tout faire en respectant les prérequis
  const done = new Set(); let progress = true;
  while (progress) { progress = false; for (const o of OPS) if (!done.has(o.id) && o.req.every((r) => done.has(r))) { done.add(o.id); progress = true; } }
  assert.equal(done.size, OPS.length, 'opérations jamais réalisables : ' + ids.filter((i) => !done.has(i)));
});
