// Module « L'entrepôt » : le catalogue (chaque modèle suit le moule), le montage (sortir, poser,
// relier, régler, ranger, sérialiser) et le moteur (énergie, câbles). Les groupes du catalogue et
// le moteur complet ont leurs propres tests (entrepot-*.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../helpers/dom.mjs';
import { CATALOGUE, SIGNAUX, CONNECTEURS, FAMILLES, compatibles, portOf } from '../../src/entrepot/catalogue/index.js';
import { B, vider, sortir, ranger, poser, relier, debrancher, regler, serialiser, charger, setSaving, placeLibre, occupes, ZONES } from '../../src/entrepot/build.js';
import { evaluate, MUR_W } from '../../src/entrepot/engine.js';
import { MISSIONS, noter } from '../../src/entrepot/missions.js';

setSaving(false);
const bad = (t) => !t || /undefined|NaN|\[object|\bnull\b/.test(String(t));

test('catalogue : chaque modèle suit le moule (identité, pose, ports uniques et typés, faces qui pointent sur des ports)', () => {
  assert.ok(Object.keys(CATALOGUE).length >= 2);
  for (const [id, m] of Object.entries(CATALOGUE)) {
    assert.equal(m.id, id);
    for (const k of ['marque', 'nom', 'court', 'famille', 'role', 'pose']) assert.ok(!bad(m[k]), `${id}.${k}`);
    assert.ok(FAMILLES.some(([f]) => f === m.famille), `${id} : famille ${m.famille}`);
    assert.ok(['rack', 'table', 'plateau', 'mur'].includes(m.pose), `${id} : pose`);
    if (m.pose === 'rack') assert.ok(m.u >= 1 && m.u <= 4, `${id} : hauteur en U`);
    const ids = new Set();
    for (const p of m.ports) {
      assert.ok(p.id && !ids.has(p.id), `${id} : port ${p.id} en double`); ids.add(p.id);
      assert.ok(!bad(p.label), `${id}.${p.id} : label`);
      assert.ok(CONNECTEURS[p.kind], `${id}.${p.id} : connecteur ${p.kind}`);
      assert.ok(SIGNAUX[p.sig], `${id}.${p.id} : signal ${p.sig}`);
      assert.ok(['in', 'out', 'io'].includes(p.dir), `${id}.${p.id} : sens`);
      if (p.thru) assert.ok(ids.has(p.thru) || m.ports.some((q) => q.id === p.thru), `${id}.${p.id} : boucle vers ${p.thru}`);
    }
    for (const [name, f] of Object.entries(m.faces || {})) {
      assert.ok(f.w > 0 && f.h > 0 && Array.isArray(f.items), `${id} : face ${name}`);
      for (const it of f.items) if (it.t === 'port') assert.ok(ids.has(it.id), `${id} : face ${name}, port ${it.id} inconnu`);
    }
    if (m.reseau) { assert.ok(m.ports.some((p) => p.sig === 'ip' && p.nic), `${id} : une interface réseau sans port nic`); for (const k of ['ip', 'mask', 'gw']) assert.equal(typeof m.reseau[k], 'string', `${id}.reseau.${k}`); }
    if (m.watts != null) assert.ok(m.watts >= 0 && m.watts < 2000, `${id} : watts`);
  }
});

test('compatibilité des ports : même signal, sens, connecteurs', () => {
  const bnc = (dir) => ({ id: 'x', label: 'X', kind: 'bnc', sig: 'sdi', dir });
  assert.ok(compatibles(bnc('out'), bnc('in')).ok);
  assert.ok(!compatibles(bnc('out'), bnc('out')).ok);
  assert.ok(!compatibles(bnc('in'), bnc('in')).ok);
  assert.ok(!compatibles(bnc('out'), { id: 'y', label: 'Y', kind: 'bnc', sig: 'ref', dir: 'in' }).ok);
  assert.ok(compatibles({ id: 'a', label: 'A', kind: 'rj45', sig: 'ip', dir: 'io' }, { id: 'b', label: 'B', kind: 'rj45', sig: 'ip', dir: 'io' }).ok);
  assert.ok(compatibles({ id: 'a', label: 'A', kind: 'iec', sig: 'secteur', dir: 'in' }, { id: 'b', label: 'B', kind: 'mur', sig: 'secteur', dir: 'out' }).ok);
  assert.ok(!compatibles({ id: 'a', label: 'A', kind: 'hdmi', sig: 'hdmi', dir: 'out' }, { id: 'b', label: 'B', kind: 'bnc', sig: 'hdmi', dir: 'in' }).ok);
});

test('montage : le mur revient avec vider(), un bandeau se sort, se pose, se branche au mur, se range', () => {
  vider('');
  assert.equal(B.appareils.length, 1); assert.equal(B.appareils[0].modele, 'mur');
  const r = sortir('bandeau'); assert.ok(r.ok && r.uid);
  const b = B.appareils.find((a) => a.uid === r.uid);
  assert.deepEqual(b.place, { zone: 'rack', slot: 1 }); assert.equal(b.nom, 'Bandeau 230 V');
  assert.ok(occupes('rack').has(1)); assert.deepEqual(placeLibre('bandeau'), { zone: 'rack', slot: 2 });
  assert.ok(!poser(r.uid, { zone: 'table', slot: 1 }).ok, 'un bandeau ne va pas sur la table');
  assert.ok(poser(r.uid, { zone: 'rack', slot: 12 }).ok); assert.ok(!poser(r.uid, { zone: 'rack', slot: 13 }).ok);
  const c = relier({ dev: r.uid, port: 'in' }, { dev: 'mur', port: 'prise1' }); assert.ok(c.ok, c.why);
  assert.ok(!relier({ dev: r.uid, port: 'in' }, { dev: 'mur', port: 'prise2' }).ok, 'un port ne prend qu\'un câble');
  assert.ok(!relier({ dev: r.uid, port: 'out1' }, { dev: 'mur', port: 'prise2' }).ok, 'deux sorties');
  let E = evaluate(B);
  assert.ok(E.power[r.uid].on); assert.match(E.power[r.uid].source, /secteur/);
  regler(r.uid, { interrupteur: false }); E = evaluate(B);
  assert.ok(!E.power[r.uid].on); assert.match(E.power[r.uid].why, /arrêt/);
  assert.ok(debrancher(c.uid)); E = evaluate(B); assert.match(E.power[r.uid].why, /Aucune alimentation/);
  const d = serialiser(); assert.equal(d.appareils.length, 2);
  assert.ok(ranger(r.uid)); assert.equal(B.appareils.length, 1); assert.equal(B.cables.length, 0);
  assert.ok(charger(d)); assert.equal(B.appareils.length, 2); assert.equal(B.appareils[1].cfg.interrupteur, false);
});

test('énergie : un bandeau sans entrée n\'alimente rien ; deux bandeaux en cascade ; un sous-réseau 12 V passe par un bloc', () => {
  vider('');
  const b1 = sortir('bandeau').uid, b2 = sortir('bandeau').uid;
  relier({ dev: b1, port: 'in' }, { dev: 'mur', port: 'prise1' });
  relier({ dev: b2, port: 'in' }, { dev: b1, port: 'out1' });
  const E = evaluate(B);
  assert.ok(E.power[b1].on && E.power[b2].on);
  assert.ok(E.alertes.every((a) => a.dev !== b2));
  assert.equal(MUR_W, 3680);
});

test('missions : chaque mission a un id, un brief, des compétences au bon format ; noter() rend une note sur 100', () => {
  for (const m of MISSIONS) {
    assert.ok(m.id && !bad(m.titre) && !bad(m.brief) && m.contraintes.length);
    for (const c of m.competences) assert.match(c, /^[1-4]\.\d{1,2}$/);
    for (const x of m.exigences) assert.ok(x.id && x.label && x.pts > 0 && typeof x.test === 'function');
  }
  vider('');
  const N = noter(MISSIONS[0], B, evaluate(B), CATALOGUE);
  assert.ok(N.score >= 0 && N.score <= 100); assert.ok(N.budget && N.budget.used === 0);
  assert.equal(ZONES.rack.slots, 12);
  assert.ok(portOf('bandeau', 'out8'));
});
