// Fiches des termes techniques du poste Réseau IP (boutons « ? ») : cohérence des fiches, des
// renvois et des schémas, reconnaissance des intitulés de l'interface, et valeurs alignées sur
// celles que calcule le simulateur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATS, TERMS, TERM_PATTERNS, termFor } from '../../src/content/netterms.js';
import { FIGS } from '../../src/ui/term_figs.js';
import { S } from '../../src/state.js';
import { videoGeom } from '../../src/net/analyzer.js';

test('chaque fiche est complète : titre, famille connue, phrase courte, explication', () => {
  assert.ok(Object.keys(TERMS).length >= 80);
  for (const [id, T] of Object.entries(TERMS)) {
    assert.ok(T.t && T.short && T.body, id);
    assert.ok(CATS.includes(T.cat), `${id} : famille ${T.cat}`);
    assert.ok(T.short.length <= 220, `${id} : phrase courte trop longue`);
    for (const k of T.see || []) assert.ok(TERMS[k], `${id} renvoie vers ${k} inexistant`);
    assert.ok(!(T.see || []).includes(id), `${id} se renvoie à lui-même`);
  }
  for (const c of CATS) assert.ok(Object.values(TERMS).some((T) => T.cat === c), `famille ${c} vide`);
});

test('schémas : chaque fiche illustrée a son schéma, chaque schéma est un SVG bien formé', () => {
  const used = new Set();
  for (const [id, T] of Object.entries(TERMS)) if (T.fig) { assert.ok(FIGS[T.fig], `${id} : schéma ${T.fig} absent`); used.add(T.fig); }
  for (const [k, f] of Object.entries(FIGS)) {
    assert.ok(used.has(k), `schéma ${k} jamais utilisé`);
    const s = f();
    assert.match(s, /^<svg viewBox="0 0 \d+ \d+"[^>]*role="img" aria-label="[^"]+"/, k);
    assert.ok(s.endsWith('</svg>'), k);
    for (const tag of ['text', 'marker', 'defs']) assert.equal((s.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length, (s.match(new RegExp(`</${tag}>`, 'g')) || []).length, `${k} : <${tag}> mal fermé`);
    assert.ok(!/NaN|undefined/.test(s), `${k} : valeur non calculée`);
  }
});

test('intitulés de l\'interface → fiche', () => {
  const cases = {
    'Gigue (écart-type IAT)': 'gigue', 'CINST max / CMAX': 'cmax', 'VRX max / VRX_FULL': 'vrx', 'Latence réseau': 'latence', 'Décalage RTP → arrivée': 'rtp-offset',
    'Écart rouge / bleu': 'ecart', 'Paquets réparés par l\'autre réseau': 'pertes', 'Débit (couche IP)': 'debit', 'MAC multicast': 'mac-mcast', 'Conformité': 'conformite',
    'priority1': 'priority', 'clockClass': 'clockclass', 'Slave only': 'slave-only', 'Domaine': 'domaine', 'Announce': 'announce', 'Sauts jusqu\'au grand maître': 'sauts',
    'Décalage / délai moyen': 'delai-moyen', 'Offset actuel': 'offset', 'Commutateurs (horloges frontières)': 'bc', 'Grand maître élu par réseau': 'grand-maitre',
    'PTP (DSCP 46) en file prioritaire': 'qos', 'Registre NMOS (IS-04)': 'registre', 'Battement': 'heartbeat', 'Récepteurs (connexions IS-05)': 'is-05',
    'Adresse source': 'transport-params', 'Groupe multicast': 'groupe', 'Port UDP': 'udp', 'Plage PIM-SSM': 'ssm', 'Querier': 'querier', 'show ip mroute': 'mroute',
    'Interfaces VLAN (SVI = passerelle des appareils)': 'svi', 'Masque': 'sous-reseau', 'Passerelle': 'passerelle', 'MTU (octets)': 'mtu', 'FEC': 'fec',
    'Rouge (IP · passerelle)': 'interface-media', 'A · rouge': 'reseaux-ab', 'Raccordé à': 'lldp', 'Port à observer': 'span', 'Contrôle et NMOS': 'nmos',
  };
  for (const [label, id] of Object.entries(cases)) assert.equal(termFor(label), id, label);
  for (const label of ['Mode', 'État', 'Flux', 'Alarmes', 'Bilan', '', 'x'.repeat(80)]) assert.equal(termFor(label), null, label);
  for (const [re, id] of TERM_PATTERNS) assert.ok(TERMS[id], `motif ${re} → ${id} inexistant`);
});

test('ST 2110-21 : les limites citées dans les fiches sont celles que calcule l\'analyseur', () => {
  const was = S.format;
  try {
    S.format = 'HD';
    const g = videoGeom();
    assert.equal(g.npackets, 4320);
    assert.match(TERMS['st2110-21'].car, new RegExp(`CMAX = ${g.cmax} et VRX_FULL = ${g.vrx}`));
    assert.match(TERMS.cmax.body, new RegExp(`CMAX = ${g.cmax}`));
    assert.match(TERMS.vrx.body, new RegExp(`VRX_FULL = ${g.vrx}`));
  } finally { S.format = was; }
});
