// Module « La caméra » : le suivi. Les quiz de chapitre (forme, notions, bonnes réponses), la
// progression (notion acquise, quiz, mise en service), le moteur et la note de la mise en service,
// le rattachement au livret (sorte « camera ») et les liens d'une fiche vers le Cours et les postes.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// un DOM d'essai un peu plus complet que tests/helpers/dom.mjs : assez pour construire une fiche,
// lire ses textes et cliquer ses boutons (posé avant tout import : helpers/dom.mjs ne le remplace pas)
const ctx2d = () => new Proxy({}, { get: (t, k) => (k in t ? t[k] : k === 'measureText' ? (s) => ({ width: String(s).length * 7 }) : k === 'getImageData' || k === 'createImageData' ? (x, y, w = 1, h = 1) => ({ width: w, height: h, data: new Uint8ClampedArray(Math.max(1, w * h * 4)) }) : k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
class Txt { constructor(s) { this.nodeType = 3; this.data = String(s); } get textContent() { return this.data; } }
class El {
  constructor(tag) { this.tagName = String(tag).toUpperCase(); this.children = []; this.attrs = {}; this.listeners = {}; this.style = {}; this.dataset = {}; this.className = ''; this.hidden = false; this.width = 300; this.height = 150; this.disabled = false; }
  get classList() {
    const get = () => this.className.split(/\s+/).filter(Boolean), put = (l) => { this.className = l.join(' '); };
    return { add: (...c) => put([...new Set([...get(), ...c])]), remove: (...c) => put(get().filter((x) => !c.includes(x))), contains: (c) => get().includes(c), toggle: (c, f) => { const on = f == null ? !get().includes(c) : !!f; if (on) put([...new Set([...get(), c])]); else put(get().filter((x) => x !== c)); return on; } };
  }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'hidden') this.hidden = true; if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-(\w)/g, (m, c) => c.toUpperCase())] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  removeAttribute(k) { delete this.attrs[k]; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener() {}
  appendChild(c) { this.children.push(c); return c; }
  append(...cs) { for (const c of cs) this.appendChild(typeof c === 'string' ? new Txt(c) : c); }
  replaceChildren(...cs) { this.children = []; this.append(...cs); }
  get childNodes() { return this.children; }
  get firstChild() { return this.children[0] || null; }
  get textContent() { return this.children.map((c) => c.textContent).join(''); }
  set textContent(v) { this.children = [new Txt(v)]; }
  set innerHTML(v) { this.html = v; }
  getContext() { return ctx2d(); }
  click() { for (const f of this.listeners.click || []) f.call(this, { currentTarget: this, target: this, preventDefault() {} }); }
}
globalThis.document = { createElement: (t) => new El(t), createElementNS: (_n, t) => new El(t), createTextNode: (s) => new Txt(s), body: new El('body'), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
/** les éléments d'un arbre qui vérifient f */
const all = (n, f, out = []) => { if (n instanceof El) { if (f(n)) out.push(n); for (const c of n.children) all(c, f, out); } return out; };
const byClass = (n, c) => all(n, (e) => e.classList.contains(c));
// un choix d'une question par son rang dans les données (les réponses sont mélangées à l'affichage)
const opt = (li, c) => byClass(li, 'cl-opt').find((b) => b.dataset.c === String(c));

await import('../helpers/scene.mjs');
await import('../../src/cours/all.js');
const { NOTIONS, CHAPITRES, ORDRE, notionsDu } = await import('../../src/camlab/notions/index.js');
const { QUIZ, questionList } = await import('../../src/camlab/quiz.js');
const P = await import('../../src/camlab/progress.js');
const { createMes, noteMes, mention, vfFault, ETAPES, ERREURS, GESTES, VARIANTES, POIDS, TEMPS } = await import('../../src/camlab/mes.js');
const { irisPos } = await import('../../src/camlab/controls.js');
const { defocus } = await import('../../src/camlab/optics.js');
const { renderFiche } = await import('../../src/camlab/fiche.js');
const { lessonById } = await import('../../src/cours/index.js');
const { RATTACHEMENT, COMPETENCES } = await import('../../src/content/referentiel.js');
const { livret, activityState, codesOf } = await import('../../src/livret.js');
const { on } = await import('../../src/state.js');
const { PROG, mergeProgress } = await import('../../src/shared.js');

const bad = (t) => !t || /undefined|NaN|\[object|null\b/.test(t);

// ---------------- les quiz de chapitre ----------------
test('quiz de chapitre : 5 à 6 questions par chapitre, chaque réponse expliquée, bonnes réponses variées, notions du chapitre', () => {
  assert.deepEqual(Object.keys(QUIZ).map(Number), CHAPITRES.map((c) => c.n));
  const places = new Set();
  for (const c of CHAPITRES) {
    const qs = QUIZ[c.n];
    assert.ok(qs.length >= 5 && qs.length <= 6, `chapitre ${c.n} : ${qs.length} questions`);
    assert.ok(new Set(qs.map((q) => q.ok)).size > 1, `chapitre ${c.n} : bonnes réponses à des places variées`);
    const notions = new Set(qs.map((q) => q.n));
    assert.ok(notions.size >= Math.min(3, notionsDu(c.n).length), `chapitre ${c.n} : les questions mélangent ses notions`);
    for (const q of qs) {
      assert.ok(q.q.length > 15 && !bad(q.q), q.q);
      assert.ok(q.a.length >= 3 && q.ok >= 0 && q.ok < q.a.length, q.q);
      assert.ok(NOTIONS[q.n] && NOTIONS[q.n].chap === c.n, `${q.q} : notion ${q.n} hors du chapitre ${c.n}`);
      q.a.forEach(([text, expl], i) => {
        assert.ok(text && expl && expl.length > 15 && !bad(text + expl), `${q.q} : réponse ${i}`);
        // la bonne réponse, et elle seule, est confirmée (« Exact »)
        assert.equal(/^Exact/.test(expl), i === q.ok, `${q.q} : explication de la réponse ${i}`);
      });
      places.add(q.ok);
    }
  }
  assert.equal(places.size, 3, 'les trois places sont utilisées');
});

test('le moule des questions : réponses mélangées à chaque série, questions aussi pour un quiz de chapitre', () => {
  const qs = QUIZ[1];
  const rangs = new Set(), premieres = new Set();
  for (let k = 0; k < 40; k++) {
    const box = questionList(qs, { mix: true });
    premieres.add(box.children[0].dataset.q);
    for (const li of box.children) {
      const q = qs[Number(li.dataset.q)], b = byClass(li, 'cl-opt');
      assert.deepEqual(b.map((x) => x.dataset.c).sort(), q.a.map((_, i) => String(i)), 'chaque réponse une fois');
      rangs.add(b.findIndex((x) => x.dataset.c === String(q.ok)));
    }
  }
  assert.deepEqual([...rangs].sort(), [0, 1, 2], 'la bonne réponse change de place');
  assert.ok(premieres.size > 1, 'l\'ordre des questions change');
  // sans mix (les trois questions d'une fiche) : les questions gardent leur ordre
  assert.deepEqual(questionList(qs).children.map((li) => li.dataset.q), qs.map((_, i) => String(i)));
});

test('le moule des questions : seule la première réponse compte, on peut réessayer', () => {
  let res = null;
  const qs = QUIZ[1].slice(0, 2);
  const box = questionList(qs, { onDone: (score, total, firsts) => { res = { score, total, firsts }; } });
  const lis = box.children;
  const opts = (i) => byClass(lis[i], 'cl-opt');
  opt(lis[0], (qs[0].ok + 1) % 3).click(); // faux d'abord
  assert.equal(res, null);
  opt(lis[0], qs[0].ok).click(); // puis juste : la question est finie, mais elle reste ratée
  assert.ok(opts(0).every((b) => b.disabled));
  opt(lis[1], qs[1].ok).click();
  assert.deepEqual(res, { score: 1, total: 2, firsts: [false, true] });
});

// ---------------- la progression ----------------
test('progression : une notion est acquise à 3 / 3 du premier coup, le meilleur score est gardé', () => {
  const prog = {};
  assert.equal(P.recordNotion('iris', 2, 3, prog), false);
  assert.equal(P.notionAcquise('iris', prog), false);
  assert.equal(P.recordNotion('iris', 3, 3, prog), true);
  assert.equal(P.recordNotion('iris', 1, 3, prog), true, 'une série ratée ensuite n\'efface pas l\'acquis');
  assert.equal(prog.camera.notions.iris.score, 3);
  assert.equal(P.acquises(['iris', 'zoom'], prog), 1);
  P.recordChapterQuiz(4, 4, 6, prog); P.recordChapterQuiz(4, 3, 6, prog);
  assert.equal(P.chapterQuizBest(4, prog).score, 4);
  assert.equal(P.chapterQuizBest(5, prog), null);
  // lire une progression ne la modifie pas (document d'un autre stagiaire)
  const other = {}; assert.equal(P.notionAcquise('iris', other), false); assert.equal(P.mesBest(other), null); assert.deepEqual(other, {});
});

test('progression : la mise en service garde son meilleur résultat (puis le plus rapide) et ses dix derniers essais', () => {
  const prog = {};
  assert.equal(P.recordMes({ score: 70, sec: 400, errs: 4 }, prog), true);
  assert.equal(P.recordMes({ score: 60, sec: 300, errs: 6 }, prog), false);
  assert.equal(P.recordMes({ score: 70, sec: 350, errs: 4 }, prog), true, 'même score, plus rapide');
  for (let i = 0; i < 12; i++) P.recordMes({ score: 10, sec: 900, errs: 12 }, prog);
  assert.equal(prog.camera.mes.runs.length, 10);
  assert.equal(P.mesBest(prog).sec, 350);
  assert.equal(P.mesReussie(prog), true);
  assert.equal(P.mesReussie({ camera: { mes: { best: { score: 59 } } } }), false);
});

// ---------------- la mise en service ----------------
/** un essai pas à pas, sur une horloge d'essai ; renvoie le moteur et un geste qui avance l'horloge */
function essai(variante, pas = 2000) {
  let t = 1000; const M = createMes({ variante, clock: () => t, instant: true }); M.start();
  const A = (g, v) => { const r = M.act(g, v); t += pas; M.tick(); return r; };
  return { M, A, avance: (s) => { t += s * 1000; } };
}
/** le tirage : point en serré, tirage en large, jusqu'à ce que tout soit net */
function tirage(M, A) {
  let pass = 0;
  for (; pass < 8 && !M.tirageOk(); pass++) {
    A('zoom', 1);
    const dF = 1 / (1000 * (1 / 3000 + M.st.delta / 2916)); A('point', Math.pow(Math.min(1, 0.3 / dF), 0.45));
    A('zoom', 0);
    A('ff', M.st.delta - defocus(4.5, 3, M.dF(), M.st.delta));
  }
  return pass;
}
/** la mise en service sans faute, dans l'ordre */
function parfaite(variante) {
  const x = essai(variante); const { M, A } = x; const jour = variante === 'jour';
  A('monter'); A('cable'); A('nettoyer-cam'); A('nettoyer-ccu'); A('brancher'); A('ccu-power'); A('cam-pw'); A('liaison');
  A('bars'); A('bright', -3); A('contrast', 5); A('vf-ok'); A('bars');
  A('nd', jour ? 1 / 64 : 1 / 16); A('iris', irisPos(jour ? 2.8 : 1.8)); A('vis');
  const passes = tirage(M, A); A('vis');
  A('abb');
  A('nd', M.V.nd); A('wbsw', 'A'); A('card', 1); A('iris', irisPos(jour ? 11 : 8)); A('awb');
  A('card', 0); A('iris', irisPos(5.6)); A('expo');
  A('zebra1'); A('zebra-level', 70); A('store');
  return { ...x, passes };
}

test('mise en service : les dix étapes dans l\'ordre, sans faute, sous les deux éclairages : 100 / 100', () => {
  assert.equal(ETAPES.length, 10);
  for (const v of Object.keys(VARIANTES)) {
    const { M, passes } = parfaite(v);
    assert.deepEqual(M.errors.map((e) => e.key), [], v);
    assert.ok(passes >= 2, `${v} : le tirage demande deux passages au moins`);
    assert.ok(M.complete(), `${v} : ${ETAPES.filter((e) => !M.done(e.id)).map((e) => e.id)}`);
    assert.deepEqual(Object.keys(M.firstDone), ETAPES.map((e) => e.id), `${v} : faites dans l'ordre`);
    const r = M.result();
    assert.equal(r.score, 100); assert.equal(r.errs, 0); assert.equal(r.variante, v);
  }
});

test('mise en service : la note (8 par erreur d\'ordre, 5 par erreur de geste, le temps au-delà de 8 min)', () => {
  assert.equal(noteMes({ ordre: 0, geste: 0, sec: 300 }).score, 100);
  assert.equal(noteMes({ ordre: 1, geste: 2, sec: 300 }).score, 100 - POIDS.ordre - 2 * POIDS.geste);
  assert.equal(noteMes({ sec: TEMPS.ref }).temps, 0);
  assert.equal(noteMes({ sec: TEMPS.ref + 1 }).temps, 1);
  assert.equal(noteMes({ sec: TEMPS.ref + 95 }).temps, 4);
  assert.equal(noteMes({ sec: 99999 }).temps, TEMPS.max);
  assert.equal(noteMes({ ordre: 10, geste: 10, sec: 99999 }).score, 0);
  assert.match(mention(95), /maîtrisée/); assert.match(mention(40), /À refaire/);
  for (const [k, e] of Object.entries(ERREURS)) {
    assert.ok(['ordre', 'geste'].includes(e.kind) && e.t.length > 10 && e.why.length > 60 && !bad(e.t + e.why), k);
    for (const n of e.see) assert.ok(NOTIONS[n], `${k} : notion ${n}`);
  }
  for (const e of ETAPES) for (const n of e.see) assert.ok(NOTIONS[n], `${e.id} : notion ${n}`);
  for (const g of Object.values(GESTES)) for (const id of g.pre) assert.ok(ETAPES.some((e) => e.id === id), id);
});

test('mise en service : la balance des blancs avant les noirs est comptée, expliquée, et effacée par les noirs refaits', () => {
  const { M, A } = essai('tungstene');
  A('monter'); A('cable'); A('nettoyer-cam'); A('nettoyer-ccu'); A('brancher'); A('ccu-power'); A('cam-pw'); A('liaison');
  A('nd', 1); A('wbsw', 'A'); A('card', 1); A('iris', irisPos(8));
  const r = A('awb');
  assert.ok(r.ok, 'le geste est fait, comme sur la vraie caméra');
  assert.deepEqual(r.err.map((e) => e.key), ['avant:noirs']);
  assert.match(r.err[0].t, /Balance des blancs avant celle des noirs/);
  assert.equal(r.err[0].kind, 'ordre');
  assert.ok(M.st.awbOk);
  A('abb');
  assert.ok(M.st.abbOk && !M.st.awbOk, 'les noirs refaits effacent la balance des blancs');
  assert.equal(A('awb').err.length, 0);
  assert.ok(M.done('blancs'));
  assert.equal(M.ordre(), 1);
});

test('mise en service : erreurs de geste (fibre sale, liaison mal lue, viseur sur l\'image, tirage en serré et iris fermé, gain)', () => {
  const { M, A } = essai('jour');
  A('monter'); A('cable'); A('nettoyer-cam');
  assert.deepEqual(A('brancher').err.map((e) => e.key), ['fibre-sale'], 'le connecteur de la CCU n\'a pas été nettoyé');
  A('ccu-power'); A('cam-pw');
  assert.ok(M.level() < -15 && M.level() > -20 && M.ready(), 'un connecteur sale : la liaison passe, hors plage');
  const l = A('liaison'); assert.ok(!l.ok); assert.deepEqual(l.err.map((e) => e.key), ['liaison-fausse']);
  assert.ok(!M.done('ccu'));
  // débrancher sous tension : erreur d'ordre ; on éteint, on nettoie, on rebranche
  assert.deepEqual(A('brancher').err.map((e) => e.key), ['fibre-tension']);
  A('cam-pw'); assert.ok(!A('nettoyer-cam').err.length); A('nettoyer-ccu'); A('brancher'); A('cam-pw');
  assert.equal(A('liaison').ok, true); assert.ok(M.done('ccu'));
  // le viseur validé sans les barres
  assert.deepEqual(A('vf-ok').err.map((e) => e.key), ['viseur-image']);
  A('bars'); assert.deepEqual(A('vf-ok').err.map((e) => e.key), ['viseur-faux'], 'les réglages de départ sont faux');
  A('bright', -3); A('contrast', 5); assert.ok(A('vf-ok').ok); A('bars');
  // le tirage en zoom serré, iris fermé
  A('vis'); A('zoom', 1); A('iris', irisPos(8));
  assert.deepEqual(A('ff', 0.05).err.map((e) => e.key).sort(), ['tirage-iris', 'tirage-serre']);
  assert.equal(A('ff', 0.04).err.length, 0, 'une même faute n\'est comptée qu\'une fois');
  assert.deepEqual(A('vis').err.map((e) => e.key), ['tirage-vis'], 'vis bloquée sur un tirage faux');
  // l'exposition rattrapée au gain : comptée, et la balance des noirs est à refaire
  A('abb'); assert.ok(M.st.abbOk);
  assert.deepEqual(A('gain', 6).err.map((e) => e.key), ['gain']);
  assert.ok(!M.st.abbOk);
  assert.equal(M.geste(), 8);
  assert.equal(M.ordre(), 1);
  const r = M.result(); assert.equal(r.score, 100 - 1 * POIDS.ordre - 8 * POIDS.geste - r.temps);
});

test('mise en service : les gestes impossibles sont refusés sans être comptés ; l\'exposition a ses repères', () => {
  const { M, A } = essai('tungstene');
  assert.equal(A('cable').ok, false, 'pas de câble sans objectif');
  assert.equal(A('cam-pw').ok, false, 'RCP éteint');
  assert.equal(A('abb').ok, false, 'caméra éteinte');
  A('nettoyer-cam'); A('nettoyer-ccu'); A('brancher');
  assert.equal(A('nettoyer-cam').ok, false, 'fibre branchée');
  A('ccu-power');
  // alimenter avant l'objectif : erreur d'ordre (sous tension)
  assert.deepEqual(A('cam-pw').err.map((e) => e.key), ['objectif-tension']);
  assert.equal(A('monter').err.length, 0, 'la même faute n\'est pas recomptée');
  A('cable'); A('liaison');
  assert.equal(M.errors.length, 1);
  // exposition : 1/16 ND oublié du tournage précédent, gain à 0 : sous-exposé même grand ouvert
  A('abb'); A('wbsw', 'A'); A('card', 1); A('iris', irisPos(1.8));
  assert.deepEqual(A('awb').err.map((e) => e.key), ['awb-filtre'], 'la balance faite avant le filtre adapté');
  A('card', 0);
  assert.deepEqual(A('expo').err.map((e) => e.key), ['expo-niveau']);
  A('nd', 1); A('iris', irisPos(5.6));
  assert.equal(A('expo').ok, true);
  assert.ok(M.done('expo'));
  A('iris', irisPos(16)); assert.ok(!M.done('expo'), 'l\'exposition se défait si l\'iris bouge trop');
});

test('le viseur : le carré à −2 % se confond avec le noir, celui à +4 % se devine, la barre blanche reste claire', () => {
  assert.equal(vfFault(0, 0), null);
  assert.equal(vfFault(-3, 5), null);
  assert.match(vfFault(30, -30), /gris/);
  assert.match(vfFault(-30, 0), /bouché/);
  assert.match(vfFault(0, -30), /terne/);
  assert.match(vfFault(0, 40), /éblouit/);
});

// ---------------- le livret ----------------
test('livret : la mise en service et les notions acquises comptent (sorte « camera »)', () => {
  const T = RATTACHEMENT.camera;
  assert.deepEqual(T.mes, ['2.7', '2.9', '3.9', '2.10', '1.4']);
  assert.ok(!NOTIONS.mes, 'aucune notion ne s\'appelle « mes »');
  const codes = new Set(COMPETENCES.map((c) => c.code));
  for (const [ref, list] of Object.entries(T)) {
    if (ref === 'mes') continue;
    assert.ok(NOTIONS[ref] && !NOTIONS[ref].prevu && NOTIONS[ref].quiz.length, ref);
    assert.deepEqual(list, [...new Set(NOTIONS[ref].competences.filter((c) => codes.has(c)))], ref);
  }
  // toutes les fiches écrites avec des compétences sont rattachées (le lot 1 aujourd'hui, les lots 2 et 3 ensuite)
  for (const id of ORDRE) if (!NOTIONS[id].prevu && (NOTIONS[id].competences || []).some((c) => codes.has(c))) assert.ok(T[id], id);
  assert.deepEqual(codesOf('camera', 'iris'), NOTIONS.iris.competences);

  const prog = { camera: { notions: { iris: { score: 3, total: 3 }, zoom: { score: 2, total: 3 }, focale: { score: 3, total: 3 }, point: { score: 3, total: 3 } }, mes: { best: { score: 72, sec: 400, errs: 4 } } } };
  assert.equal(activityState(prog, 'camera', 'iris').done, true);
  assert.equal(activityState(prog, 'camera', 'zoom').done, false, '2 / 3 : pas acquise');
  assert.equal(activityState(prog, 'camera', 'mes').done, true);
  assert.equal(activityState({ camera: { mes: { best: { score: 55 } } } }, 'camera', 'mes').done, false, 'sous 60 sur 100');
  assert.equal(activityState({}, 'camera', 'mes').done, false);
  const L = livret(prog);
  const c = (code) => L.comps.find((x) => x.code === code);
  // 2.9 : la mise en service et trois notions acquises (iris, focale, point)
  assert.equal(c('2.9').niveau, 'consolidee');
  assert.ok(c('3.9').acts.some((a) => a.kind === 'camera' && a.ref === 'mes' && a.done));
  assert.ok(c('2.10').acts.some((a) => a.kind === 'camera' && a.ref === 'mes' && a.done));
  assert.equal(livret({}).count.travaillee + livret({}).count.consolidee, 0);
});

// ---------------- la fiche : questions enregistrées, liens vers le Cours et les postes ----------------
test('fiche : les questions d\'Olivier sont enregistrées ; trois justes du premier coup, la notion est acquise', () => {
  // une fiche fictive avec les questions du diaphragme (sans sa manipulation, qui dessine le viseur)
  NOTIONS.__quiz = { t: 'Fiche d\'essai', chap: 1, lot: 2, short: 'Une fiche fictive, pour vérifier que les questions d\'Olivier sont enregistrées.', quiz: NOTIONS.iris.quiz };
  try {
    const progress = []; const ctx = { open() {}, lens() {}, progress: () => progress.push(1) };
    const f = renderFiche('__quiz', ctx);
    const qs = () => all(f.node, (e) => e.classList.contains('cl-quiz'))[0].children;
    // une première série ratée à la deuxième question (puis corrigée) : 2 / 3, pas acquise
    NOTIONS.iris.quiz.forEach((q, i) => { if (i === 1) opt(qs()[i], (q.ok + 1) % 3).click(); opt(qs()[i], q.ok).click(); });
    assert.equal(PROG.camera.notions.__quiz.score, 2);
    assert.ok(!P.notionAcquise('__quiz') && byClass(f.node, 'cs-badge')[0].hidden);
    // « Refaire les questions », trois justes du premier coup
    all(f.node, (e) => e.tagName === 'BUTTON' && e.textContent === 'Refaire les questions')[0].click();
    NOTIONS.iris.quiz.forEach((q, i) => opt(qs()[i], q.ok).click());
    assert.equal(PROG.camera.notions.__quiz.score, 3);
    assert.ok(P.notionAcquise('__quiz'));
    assert.ok(!byClass(f.node, 'cs-badge')[0].hidden, 'le badge « Notion acquise » paraît');
    assert.match(byClass(f.node, 'cs-score')[0].textContent, /3 \/ 3 du premier coup : notion acquise/);
    assert.equal(progress.length, 2, 'la liste des notions est prévenue à chaque série');
  } finally { delete NOTIONS.__quiz; delete PROG.camera.notions.__quiz; }
});

test('fiche : « La leçon du Cours » et « Emmène-moi » (fiche fictive : aucune fiche du lot 1 n\'a encore de leçon)', () => {
  assert.deepEqual(ORDRE.filter((id) => NOTIONS[id].lot === 1 && NOTIONS[id].cours), []);
  const L = lessonById('camera-systeme'); assert.ok(L);
  NOTIONS.__fictive = {
    t: 'Fiche d\'essai', chap: 7, lot: 2, short: 'Une fiche fictive, pour vérifier les liens vers le Cours et vers les postes du car.',
    cours: 'camera-systeme', go: [{ label: 'La baie CCU', station: 'ccu' }],
  };
  try {
    const calls = [];
    const f = renderFiche('__fictive', { open() {}, lens() {}, cours: (id) => calls.push(['cours', id]), go: (g) => calls.push(['go', g]) });
    const [bc] = byClass(f.node, 'cs-cours'), [bg] = byClass(f.node, 'cs-go');
    assert.equal(bc.textContent, `La leçon du Cours : ${L.lesson.title}`);
    assert.equal(bg.textContent, 'Emmène-moi : La baie CCU');
    bc.click(); bg.click();
    assert.deepEqual(calls, [['cours', 'camera-systeme'], ['go', { station: 'ccu', lesson: undefined, label: 'La baie CCU' }]]);
    // sans ctx.cours : l'événement « cours » directement
    const got = []; on('cours', (o) => got.push(o));
    byClass(renderFiche('__fictive', { open() {}, lens() {} }).node, 'cs-cours')[0].click();
    assert.deepEqual(got, [{ lesson: 'camera-systeme' }]);
    // une leçon qui n'existe pas (encore) : pas de bouton
    NOTIONS.__fictive.cours = 'lecon-inconnue'; NOTIONS.__fictive.go = [];
    assert.equal(byClass(renderFiche('__fictive', { open() {}, lens() {} }).node, 'cs-cours').length, 0);
  } finally { delete NOTIONS.__fictive; }
});

test('fiche : la consigne de la manipulation (hint), sinon celle des bagues pour les chapitres 1 à 3 seulement', async () => {
  const { LABS } = await import('../../src/camlab/labs.js');
  LABS.__sans = () => ({ node: document.createElement('div'), dispose() {} });
  LABS.__avec = () => ({ node: document.createElement('div'), dispose() {}, hint: 'Branche la fibre, puis lis le niveau optique à la CCU.' });
  const hints = (chap, lab) => {
    NOTIONS.__lab = { t: 'Essai', chap, lot: 2, short: 'Une fiche fictive, pour la consigne au-dessus des manipulations.', lab };
    try { return byClass(renderFiche('__lab', { open() {}, lens() {} }).node, 'cl-hint').map((p) => p.textContent); } finally { delete NOTIONS.__lab; }
  };
  try {
    assert.deepEqual(hints(1, '__sans'), ['Les bagues de la caméra suivent tes réglages ; l\'image du viseur aussi.']);
    assert.equal(hints(3, '__sans').length, 1);
    assert.deepEqual(hints(7, '__sans'), [], 'voie caméra : ni bagues ni viseur à suivre');
    assert.deepEqual(hints(7, '__avec'), ['Branche la fibre, puis lis le niveau optique à la CCU.']);
    assert.deepEqual(hints(1, '__avec'), ['Branche la fibre, puis lis le niveau optique à la CCU.']);
  } finally { delete LABS.__sans; delete LABS.__avec; }
});

// ---------------- progression d'un autre appareil ----------------
test('progression du serveur : Cours et module caméra fusionnés, le meilleur des deux gardé', () => {
  const save = structuredClone({ cours: PROG.cours, camera: PROG.camera });
  PROG.cours = { 'signal-bits': { seen: true, quiz: { score: 1, total: 3 } } };
  PROG.camera = { notions: { iris: { score: 3, total: 3, at: 5 } }, quiz: {}, mes: { best: { score: 70, sec: 400, errs: 3, at: 10 }, runs: [{ score: 70, sec: 400, errs: 3, at: 10 }] } };
  mergeProgress({
    missions: {}, visited: {}, scenarios: [], reports: [],
    cours: { 'signal-bits': { seen: false, quiz: { score: 3, total: 3 } }, 'sdi-oeil': { seen: true, quiz: null } },
    camera: { notions: { iris: { score: 1, total: 3, at: 1 }, focale: { score: 3, total: 3, at: 2 } }, quiz: { 1: { score: 5, total: 6 } }, mes: { best: { score: 88, sec: 500, errs: 1, at: 3 }, runs: [{ score: 88, sec: 500, errs: 1, at: 3 }] } },
  });
  assert.deepEqual(PROG.cours['signal-bits'], { seen: true, quiz: { score: 3, total: 3 } });
  assert.equal(PROG.cours['sdi-oeil'].seen, true);
  assert.equal(PROG.camera.notions.iris.score, 3); assert.equal(PROG.camera.notions.focale.score, 3);
  assert.equal(PROG.camera.quiz[1].score, 5);
  assert.equal(PROG.camera.mes.best.score, 88); assert.deepEqual(PROG.camera.mes.runs.map((r) => r.at), [3, 10]);
  Object.assign(PROG, save);
});

test('chaque lien « cours » d\'une fiche mène à une leçon qui existe', () => {
  for (const id of ORDRE) if (NOTIONS[id].cours) assert.ok(lessonById(NOTIONS[id].cours), `${id} : leçon ${NOTIONS[id].cours}`);
});
