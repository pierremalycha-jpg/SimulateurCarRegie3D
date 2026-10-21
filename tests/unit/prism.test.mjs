// Instrument de mesure (type PRISM) : fiches « ? » et schémas de la mesure vidéo, valeurs des normes SDI,
// modèle de la couche physique (œil, gigue, CRC, longueur de câble), pannes de liaison et leur effet sur
// l'image, timing par rapport à la référence, et les trois parcours du chef de car rejoués sans navigateur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useHeadless, TUTOR } from '../helpers/tutor.mjs';
import { S, camById } from '../../src/state.js';
import { loadPreset } from '../../src/bcam.js';
import { defaultRouting } from '../../src/pipeline.js';
import { CATS, TERMS, termFor } from '../../src/content/netterms.js';
import '../../src/content/terms_mesure.js';
import { FIGS } from '../../src/ui/term_figs.js';
import '../../src/ui/figs_mesure.js';
import { SDI_STD, sdiStd, eqMax, lenOf, lossOf, measurePoints, pointById, linkOf, eyeSim, phyFault, repairLink, phyFaultAt, tickPhy, timingOf, PHY, PRISM, setTile, showing, APPS, PRESETS, clearPhy } from '../../src/prism_model.js';
import { FAULTS, injectFault, clearFaults, ACTIVE } from '../../src/faults.js';
import { registerLessons, startLesson, step, check, next, doForMe, answer, isAction, ctx, val } from '../../src/tutor/engine.js';
import { MESURE_LESSONS } from '../../src/tutor/lessons/mesure.js';
import { PROG } from '../../src/shared.js';

const MINE = ['prism', 'waveform', 'mv-pct', 'parade-rvb', 'ycbcr', 'vecteurscope', 'mire-75', 'lightning', 'diamant', 'split-diamant', 'arrowhead', 'gamut', 'cie1931', 'hdr-hlg', 'histogramme',
  'oeil', 'amplitude-sdi', 'temps-montee', 'overshoot', 'gigue-timing', 'gigue-alignement', 'ui', 'crc-edh', 'affaiblissement', 'egaliseur', 'effet-falaise', 'timing-ref', 'reclocker', 'vpid'];
function car(fmt = 'HD') {
  S.ipMode = false; S.format = fmt; S.mode = 'fps';
  if (!S.cams.length) loadPreset('standard', false);
  for (const c of S.cams) { c.genlock = true; c.checkLink(); }
  defaultRouting(true); clearFaults(); clearPhy();
  S.time = Math.max(S.time || 0, 100);
}

test('fiches de la mesure : complètes, rangées dans leur famille, renvois et schémas valides', () => {
  for (const id of MINE) {
    const T = TERMS[id]; assert.ok(T, `fiche ${id}`);
    assert.ok(T.t && T.short && T.body && T.car, id);
    assert.ok(CATS.includes(T.cat) && ['Mesure vidéo', 'Couche physique SDI'].includes(T.cat), `${id} : famille ${T.cat}`);
    assert.ok(T.short.length <= 220, `${id} : phrase courte trop longue (${T.short.length})`);
    for (const k of T.see || []) assert.ok(TERMS[k], `${id} renvoie vers ${k} inexistant`);
    assert.ok(!(T.see || []).includes(id), id);
    if (T.fig) assert.ok(FIGS[T.fig], `${id} : schéma ${T.fig}`);
  }
  const used = new Set(MINE.map((id) => TERMS[id].fig).filter(Boolean));
  for (const k of ['wfm', 'parade', 'vecteur', 'mire', 'lightning', 'diamant', 'split', 'arrow', 'cie', 'oeil', 'cable', 'falaise', 'timing']) {
    assert.ok(used.has(k), `schéma ${k} jamais utilisé`);
    const s = FIGS[k]();
    assert.match(s, /^<svg viewBox="0 0 \d+ \d+"[^>]*role="img" aria-label="[^"]+"/, k);
    assert.ok(s.endsWith('</svg>'), k);
    for (const tag of ['text', 'marker', 'defs']) assert.equal((s.match(new RegExp(`<${tag}[ >]`, 'g')) || []).length, (s.match(new RegExp(`</${tag}>`, 'g')) || []).length, `${k} : <${tag}>`);
    assert.ok(!/NaN|undefined|Infinity/.test(s), `${k} : valeur non calculée`);
  }
});

test('intitulés de l\'instrument → fiche (sans changer ceux du poste Réseau IP)', () => {
  const cases = { 'Gigue d\'alignement': 'gigue-alignement', 'Gigue de timing (10 Hz)': 'gigue-timing', 'Erreurs CRC': 'crc-edh', 'Affaiblissement mesuré': 'affaiblissement', 'Longueur estimée': 'affaiblissement', 'Marge de l\'égaliseur': 'egaliseur', 'Amplitude': 'amplitude-sdi', 'Dépassement': 'overshoot', 'Gigue (écart-type IAT)': 'gigue', 'Pertes': 'pertes' };
  for (const [label, id] of Object.entries(cases)) assert.equal(termFor(label), id, label);
});

test('normes SDI : UI, limites et longueurs de câble cohérentes', () => {
  for (const [k, f] of Object.entries(SDI_STD)) {
    const gbps = parseFloat(f.rate.replace(',', '.'));
    assert.ok(Math.abs(f.ui - 1000 / gbps) < 0.1, `${k} : UI = 1 / débit`);
    assert.ok(eqMax(f) >= f.loss, `${k} : égaliseur au moins au minimum de la norme`);
  }
  assert.deepEqual([SDI_STD.HDi.tr, SDI_STD.HD.tr, SDI_STD.UHD.tr], [270, 135, 45]);
  assert.deepEqual([SDI_STD.HDi.aj, SDI_STD.HD.aj, SDI_STD.UHD.aj], [0.2, 0.3, 0.3]);
  assert.deepEqual([SDI_STD.HDi.tj, SDI_STD.HD.tj, SDI_STD.UHD.tj], [1, 2, 8]);
  // 20 dB à 1,485 GHz sur du 1694A : environ 78 m (fiche « Affaiblissement »)
  assert.equal(Math.round(lenOf(20, SDI_STD.HD)), 78);
  assert.equal(Math.round(lenOf(20, SDI_STD.HDi)), 113);
  assert.equal(Math.round(lenOf(40, SDI_STD.UHD)), 69);
  assert.match(TERMS.affaiblissement.body, /113 m de 1694A en HD-SDI, 78 m en 3G, 69 m en 12G/);
  assert.match(TERMS.ui.short, /673,4 ps.*336,7 ps.*84,2 ps/);
});

test('œil de référence (mire du SPG, 1 m) : dans les limites de la norme, dans les trois formats', () => {
  for (const fmt of ['HDi', 'HD', 'UHD']) {
    car(fmt); const f = sdiStd();
    const L = linkOf(pointById('spg'));
    assert.ok(L.lock && L.crc < 1e-6 && L.aj < f.aj && L.tj < f.tj, fmt);
    const m = eyeSim(L, false).meas;
    assert.ok(m.valid, fmt);
    assert.ok(Math.abs(m.amp - 800) <= 80, `${fmt} amplitude ${m.amp}`);
    assert.ok(m.tr <= f.tr && m.tf <= f.tr && Math.abs(m.tr - m.tf) <= f.dtr, `${fmt} montée ${m.tr} / ${m.tf}`);
    assert.ok(m.ovR <= 10 && m.ovF <= 10, `${fmt} dépassement ${m.ovR}`);
  }
  // toutes les sorties du car sont saines, sans erreur
  car('HD');
  for (const p of measurePoints()) { const L = linkOf(p); assert.ok(L.lock && L.margin > 3 && L.crc < 1e-3, p.id); }
});

test('panne « cordon abîmé » : dépassement, marge qui fond, CRC, puis l\'image tombe ; le cordon neuf répare', () => {
  car('HD');
  const n = S.cams.find((c) => !c.rf).id; const id = 'ccu' + n; const p = pointById(id);
  phyFault('cable', id, { ramp: 100 });
  let L = linkOf(p);
  assert.ok(L.lock && L.margin > 3, 'au début : encore de la marge');
  assert.ok(eyeSim(L, false).meas.ovR > 10, 'dépassement au-dessus de 10 % (rupture d\'impédance)');
  assert.ok(Math.abs(L.att - lossOf(p.len)) < 1e-9, 'la longueur estimée reste celle du cordon');
  S.time += 70; tickPhy(); L = linkOf(p);
  assert.ok(L.lock && L.crc > 0.5 && L.aj > linkOf(pointById('spg')).aj, 'erreurs CRC et gigue en hausse');
  assert.ok(camById(n).signalOK, 'l\'image passe encore');
  S.time += 30; tickPhy(); L = linkOf(p);
  assert.ok(!L.lock, 'plus de verrouillage');
  assert.ok(!camById(n).signalOK && /grille/.test(camById(n).status.reason), 'la caméra a disparu (PAS DE SIGNAL)');
  camById(n).checkLink();
  assert.ok(!camById(n).signalOK, 'un recalcul de la liaison ne fait pas revenir l\'image');
  assert.equal(repairLink(id, 'reclocker').fixed, false, 'un répéteur ne répare pas un cordon abîmé');
  assert.equal(repairLink(id, 'cordon').fixed, true);
  assert.ok(camById(n).signalOK && !phyFaultAt(id) && linkOf(p).lock, 'image revenue');
  assert.ok(!Object.prototype.hasOwnProperty.call(camById(n), 'checkLink'), 'plus de surcharge sur la caméra');
});

test('panne « touret » : longueur estimée bien trop grande, quelques CRC ; répéteur ou cordon direct', () => {
  car('HD');
  const n = S.cams.filter((c) => !c.rf)[1].id; const id = 'ccu' + n; const p = pointById(id);
  phyFault('touret', id);
  const L = linkOf(p);
  assert.ok(lenOf(L.att) > 100 && L.att > sdiStd().loss, 'plus de 100 m, au-delà des 20 dB de la norme');
  assert.ok(L.lock && L.crc > 0.05 && L.crc < 50, 'quelques erreurs CRC, l\'image tient');
  assert.ok(!eyeSim(L, false).meas.valid, 'œil brut fermé');
  assert.ok(eyeSim(L, true).meas.open > 0, 'œil égalisé encore ouvert');
  assert.equal(repairLink(id, 'reclocker').fixed, true);
  assert.ok(linkOf(p).margin > 3);
  // la même panne, par le simulateur de pannes (catalogue, réparation de « Tout réparer »)
  assert.ok(FAULTS.some((f) => f.id === 'sdicable') && FAULTS.some((f) => f.id === 'sditouret'));
  const e = injectFault('sdicable');
  assert.ok(e && phyFaultAt(e.st.point));
  clearFaults();
  assert.ok(!phyFaultAt(e.st.point) && ACTIVE.every((a) => a.done));
  assert.equal(Object.keys(PHY.faults).length, 0);
});

test('timing : une CCU verrouillée est à l\'heure, une CCU libre dérive', () => {
  car('HD');
  const c = S.cams.find((k) => !k.rf && !['pov', 'ptz', 'drone'].includes(k.type));
  const p = pointById('ccu' + c.id);
  assert.ok(timingOf(p).locked && Math.abs(timingOf(p).h) < 0.05 && timingOf(p).v === 0);
  c.genlock = false;
  const a = timingOf(p); S.time += 3; const b = timingOf(p);
  assert.ok(!a.locked && (a.h !== b.h || a.v !== b.v), 'le point dérive');
  c.genlock = true;
});

test('instrument : préréglages et affichages connus', () => {
  const ids = new Set(APPS.map(([a]) => a));
  for (const [k, R] of Object.entries(PRESETS)) { assert.equal(R.tiles.length, 4, k); for (const t of R.tiles) assert.ok(ids.has(t.app), `${k} : ${t.app}`); }
  for (const key of ['vision', 'mesure']) assert.equal(PRISM[key].tiles.length, 4);
  setTile('vision', 1, { app: 'wfm', mode: 'rgb' });
  assert.ok(showing('vision', 'wfm', (t) => t.mode === 'rgb'));
});

// ---------------- les parcours du chef de car ----------------
registerLessons(MESURE_LESSONS);
useHeadless();
const bad = (t) => !t || t.length < 8 || /undefined|NaN|\[object|null\b/.test(t);
test('parcours de la mesure : complets (indices, « Fais-le pour moi », « Emmène-moi / Montre-moi », questions)', () => {
  assert.equal(MESURE_LESSONS.length, 3);
  for (const l of MESURE_LESSONS) {
    assert.ok(l.steps.length >= 6 && l.steps.some((s) => s.quiz) && l.steps.some((s) => s.done), l.id);
    for (const s of l.steps) if (s.done && !s.id.startsWith('open-')) {
      assert.ok(s.do && s.auto && s.ok, `${l.id}/${s.id}`);
      assert.ok(s.hints && s.hints.length >= 2 && s.hints.length <= 3, `${l.id}/${s.id} : 2 ou 3 indices`);
      assert.ok(s.go && s.show, `${l.id}/${s.id} : Emmène-moi et Montre-moi`);
    }
  }
});
for (const l of MESURE_LESSONS) {
  test(`parcours ${l.id} : rejoué de bout en bout`, () => {
    car('HD');
    startLesson(l.id);
    const texts = []; const stuck = [];
    for (let guard = 0; guard < 60 && TUTOR.lesson; guard++) {
      const s = step(); const c = ctx();
      texts.push(val(s.say, c)); if (s.do) texts.push(val(s.do, c));
      check();
      if (s.quiz) answer(s.quiz.answer);
      else if (isAction(s) && !TUTOR.done) { doForMe(); check(); }
      if (!TUTOR.done) { stuck.push(s.id); break; }
      if (s.ok) texts.push(val(s.ok, c));
      next();
    }
    assert.deepEqual(stuck, [], 'étapes bloquées');
    assert.equal(TUTOR.lesson, null);
    assert.ok(PROG.tutor[l.id] && PROG.tutor[l.id].done);
    for (const t of texts) assert.ok(!bad(t), `${l.id} : texte « ${t} »`);
    assert.equal(Object.keys(PHY.faults).length, 0, 'aucune panne laissée');
  });
}
