// La caméra de plateau en 3D (v18.5) : le chapitre « La caméra » du Cours ouvre le module, les
// pastilles et la liste des notions ouvrent une fiche (schéma, manipulation, questions d'Olivier),
// le simulateur reste en pause pendant ce temps, Échap ramène dans le Cours sur le même chapitre.
// Le suivi : une notion acquise se coche, le quiz d'un chapitre, le lien d'une fiche vers sa leçon
// du Cours, et la mise en service notée lancée depuis la leçon camera-systeme, jouée jusqu'au bilan. Les leçons de la
// caméra (v19.19) : la section « Sur la caméra en 3D » ouvre la notion à sa pastille, Échap ramène à la leçon ; les
// quinze leçons qui reprennent les notions s'affichent avec leurs schémas et leur manipulation.
// Les 51 fiches s'ouvrent une à une, à 1280 px puis à 390 px.
// node tests/e2e/camera.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('camera');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { title: true, fresh: true, errors: T.errors });
await until(A, () => !!document.querySelector('#title.ready'), null, 180000);
const ev = (f, a) => A.evaluate(f, a);

// ---------------- depuis le titre : Cours, chapitre « La caméra », module 3D ----------------
await A.click('#ti-cours'); await A.waitForTimeout(500);
await ev(() => window.__dbg.emit('cours', { chapter: 'camera' })); await A.waitForTimeout(300);
T.check('Cours, chapitre La caméra : l\'entrée « La caméra en 3D » dans le sommaire', await ev(() => !!document.querySelector('#layer.ly-cours details.co-chap[open] .co-module') && /La caméra en 3D/.test(document.querySelector('#layer details.co-chap[open] .co-module').textContent)));
await A.screenshot({ path: `${OUT}/01-onglet.png` });
await A.click('#layer details.co-chap[open] .co-module');
await until(A, () => window.__dbg.camlab() && !document.querySelector('.camlab .cl-loading') && !document.querySelector('.camlab').hidden, null, 120000);
await A.waitForTimeout(1500);
T.check('le module s\'ouvre plein écran, l\'espace Cours s\'est refermé, le titre est caché', await ev(() => !document.getElementById('layer') && document.getElementById('title').hidden && document.body.classList.contains('camlab-on')));
const pins = await ev(() => document.querySelectorAll('.camlab .cl-pin').length);
T.check('les pastilles de la caméra (23)', pins === 23, String(pins));
T.check('la liste des notions : 9 chapitres, 51 notions, toutes écrites', await ev(() => document.querySelectorAll('.camlab .cl-ch').length === 9 && document.querySelectorAll('.camlab .cl-ni').length === 51 && document.querySelectorAll('.camlab .cl-ni.prevu').length === 0));
await A.screenshot({ path: `${OUT}/02-camera.png` });

// ---------------- une fiche écrite : schéma, manipulation, textes, questions ----------------
for (const id of ['iris', 'menu', 'connectique']) {
  await ev((id) => document.querySelector(`.cl-ni[data-n="${id}"]`).click(), id); await A.waitForTimeout(1200);
  const st = await ev(() => ({ fig: !!document.querySelector('.camlab .cl-side .cl-fig svg'), lab: document.querySelectorAll('.camlab .cl-side .cl-lab *').length, sec: document.querySelectorAll('.camlab .cl-side .cl-sec').length, q: document.querySelectorAll('.camlab .cl-side .cl-q').length, defis: document.querySelectorAll('.camlab .cl-side .cl-defis li').length }));
  T.check(`fiche ${id} : schéma, manipulation à trois défis, sections, trois questions`, st.fig && st.lab > 10 && st.sec >= 5 && st.q === 3 && st.defis === 3, JSON.stringify(st));
  // une bonne réponse et une mauvaise : chacune expliquée
  await ev(() => { const q = document.querySelector('.camlab .cl-side .cl-q + .cl-opts'); if (q) /** @type {HTMLButtonElement} */ (q.querySelector('.cl-opt')).click(); });
  await A.waitForTimeout(200);
  T.check(`fiche ${id} : la réponse choisie est expliquée`, await ev(() => { const w = document.querySelector('.camlab .cl-side .cl-why'); return !!w && w.textContent.length > 20 && !!document.querySelector('.camlab .cl-side .cl-opt.chosen'); }));
  const side = await A.$('.camlab .cl-side'); if (side) await side.screenshot({ path: `${OUT}/10-${id}.png` }).catch(() => {});
}
// les 51 fiches, une à une : schéma, manipulation à défis, sections, trois questions, ni texte cassé ni
// débordement horizontal du panneau (les erreurs de page sont relevées par le harnais)
const ids = await ev(() => Object.keys(window.__dbg.camlab().data.NOTIONS));
const fautes = [];
for (const id of ids) {
  await ev((id) => /** @type {HTMLElement} */ (document.querySelector(`.cl-ni[data-n="${id}"]`)).click(), id);
  await A.waitForTimeout(250);
  const st = await ev(() => {
    const side = document.querySelector('.camlab .cl-side'); const txt = side?.textContent || '';
    return { fig: !!side?.querySelector('.cl-fig svg'), lab: side?.querySelectorAll('.cl-lab *').length || 0, defis: side?.querySelectorAll('.cl-defis li').length || 0, sec: side?.querySelectorAll('.cl-sec').length || 0, q: side?.querySelectorAll('.cl-q').length || 0, todo: !!side?.querySelector('.cl-todo'), bad: /undefined|NaN|\[object|\bnull\b/.test(txt), over: side ? side.scrollWidth > side.clientWidth + 1 : true };
  });
  if (!(st.fig && st.lab > 10 && st.defis >= 2 && st.sec >= 5 && st.q === 3 && !st.todo && !st.bad && !st.over)) fautes.push(`${id} ${JSON.stringify(st)}`);
}
T.check(`les ${ids.length} fiches : schéma, manipulation à défis, sections, trois questions, sans texte cassé ni débordement`, ids.length === 51 && !fautes.length, fautes.join(' | ').slice(0, 900));
// la manipulation pilote la caméra 3D : la bague de zoom suit le curseur
await ev(() => document.querySelector('.cl-ni[data-n="focale"]').click()); await A.waitForTimeout(1200);
const z0 = await ev(() => window.__dbg.camlab().rig.state.zoom);
await ev(() => { const r = document.querySelector('.camlab .cl-side .cl-lab input[type=range]'); r.value = '0.9'; r.dispatchEvent(new Event('input', { bubbles: true })); });
await A.waitForTimeout(400);
const z1 = await ev(() => window.__dbg.camlab().rig.state.zoom);
T.check('la manipulation déplace la bague de zoom de la caméra 3D', z1 > z0 + 0.3, `${z0} → ${z1}`);

// ---------------- le simulateur est en pause, Échap revient au Cours ----------------
T.check('les touches du simulateur sont ignorées pendant le module', await ev(() => { const before = window.__dbg.S.mode; document.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true })); return !document.getElementById('layer') && window.__dbg.S.mode === before; }));
await A.keyboard.press('Escape'); await A.waitForTimeout(300); // referme la fiche
await A.keyboard.press('Escape'); await A.waitForTimeout(600); // quitte le module
T.check('Échap : retour dans le Cours, chapitre La caméra, écran titre visible', await ev(() => !document.body.classList.contains('camlab-on') && !!document.querySelector('#layer.ly-cours details.co-chap[open] .co-module') && !document.getElementById('title').hidden));
await A.screenshot({ path: `${OUT}/03-retour.png` });
await A.keyboard.press('Escape'); await A.waitForTimeout(300);
T.check('fermeture du Cours : le titre reprend le focus', await ev(() => !document.getElementById('layer') && document.activeElement?.id === 'ti-cours'));

// ---------------- le suivi : une notion acquise, le quiz d'un chapitre ----------------
// (les gestes sont groupés : fiche, quiz, leçon et exercice s'ouvrent sans attendre, et le rendu
// logiciel de la caméra 3D rend chaque aller-retour avec la page coûteux)
await ev(() => window.__dbg.emit('camera', { from: 'cours' }));
await until(A, () => document.body.classList.contains('camlab-on'), null, 60000);
const acq = await ev(() => {
  const q = (s) => document.querySelector(s);
  const bar = /Mise en service/.test(q('.camlab .cl-bar .cs-mesbtn')?.textContent || '');
  /** @type {HTMLElement} */ (q('.cl-ni[data-n="iris"]')).click();
  // les trois questions d'Olivier, justes du premier coup (bonnes réponses lues dans les données du module)
  const f = window.__dbg.camlab().data.NOTIONS.iris;
  // (les réponses sont mélangées : chaque bouton porte son rang dans les données, data-c)
  document.querySelectorAll('.camlab .cl-side .cl-quiz > li').forEach((li) => /** @type {HTMLElement} */ (li.querySelector(`.cl-opt[data-c="${f.quiz[Number(/** @type {HTMLElement} */ (li).dataset.q)].ok}"]`)).click());
  return { bar, li: !!q('.camlab .cl-ni[data-n="iris"].cs-acq'), head: q('.camlab .cs-acqn')?.textContent, badge: !q('.camlab .cl-side .cs-badge')?.hidden, prog: window.__dbg.PROG.camera?.notions?.iris, ch: q('.camlab .cl-ch .cs-chn')?.textContent };
});
T.check('la barre du module : le bouton « Mise en service »', acq.bar);
T.check('une notion acquise (3 / 3 du premier coup) se coche dans la liste, compte dans « n / 51 acquises » et dans son chapitre', acq.li && /^1 \/ 51 acquises/.test(acq.head || '') && acq.badge && acq.prog && acq.prog.score === 3 && acq.ch === '1 / 13', JSON.stringify(acq));
await A.screenshot({ path: `${OUT}/20-notion-acquise.png` });
// le quiz du chapitre 1 : la première question ratée exprès, puis la bonne réponse ; les autres justes
const qz = await ev(() => {
  /** @type {HTMLElement} */ (document.querySelector('.cs-qbtn[data-quiz="1"]')).click();
  const Q = window.__dbg.camlab().data.QUIZ[1];
  const lis = document.querySelectorAll('.camlab .cs-cquiz .cl-quiz > li');
  // questions et réponses mélangées : data-q est la question, data-c la réponse dans les données
  lis.forEach((li, rang) => {
    const q = Q[Number(/** @type {HTMLElement} */ (li).dataset.q)], n = li.querySelectorAll('.cl-opt').length;
    if (rang === 0) /** @type {HTMLElement} */ (li.querySelector(`.cl-opt[data-c="${(q.ok + 1) % n}"]`)).click();
    /** @type {HTMLElement} */ (li.querySelector(`.cl-opt[data-c="${q.ok}"]`)).click();
  });
  return { n: lis.length, score: document.querySelector('.camlab .cs-cquiz .cs-score')?.textContent, revoir: !!document.querySelector('.camlab .cs-cquiz .cs-result .cl-chip'), best: window.__dbg.PROG.camera?.quiz?.[1], item: document.querySelector('.cs-qbtn[data-quiz="1"] small')?.textContent };
});
T.check('quiz du chapitre 1 : six questions, la première réponse compte (5 / 6), la notion à revoir proposée, le meilleur score enregistré et affiché dans la liste', qz.n === 6 && /^5 \/ 6/.test(qz.score || '') && qz.revoir && qz.best && qz.best.score === 5 && qz.item === '5 / 6', JSON.stringify(qz));

// ---------------- le lien vers une leçon du Cours : la leçon de la caméra qui reprend la notion (champ camlab), puis
// les champs cours et go d'une fiche, posés ici pour l'essai ----------------
const ln = await ev(() => {
  const F = window.__dbg.camlab().data.NOTIONS.focale; F.cours = 'camera-systeme'; F.go = [{ label: 'La baie CCU', station: 'ccu' }];
  /** @type {HTMLElement} */ (document.querySelector('.cl-ni[data-n="focale"]')).click();
  const r = { cours: [...document.querySelectorAll('.camlab .cl-side .cs-cours')].map((b) => b.textContent), go: document.querySelector('.camlab .cl-side .cs-go')?.textContent };
  /** @type {HTMLElement} */ (document.querySelector('.camlab .cl-side .cs-cours[data-lesson="camera-systeme"]')).click();
  delete F.cours; delete F.go;
  return { ...r, closed: !document.body.classList.contains('camlab-on'), lesson: !!document.querySelector('#layer.ly-cours .co-les.on[data-lesson="camera-systeme"]') };
});
T.check('la fiche montre sa leçon de la caméra, la leçon du champ cours et « Emmène-moi : … »', /La leçon du Cours : La focale et le zoom/.test(ln.cours[0] || '') && /La leçon du Cours : La chaîne caméra/.test(ln.cours[1] || '') && /Emmène-moi : La baie CCU/.test(ln.go || ''), JSON.stringify(ln));
T.check('le bouton ferme le module et ouvre la leçon dans le Cours', ln.closed && ln.lesson);

// ---------------- la mise en service, depuis l'exercice pratique de la leçon ----------------
const go = await ev(() => {
  const card = document.querySelector('#layer .co-exo[data-exercise="x-camera"]'); const before = card?.textContent || '';
  /** @type {HTMLElement} */ (card.querySelector('button')).click();
  return { before, closed: !document.getElementById('layer'), mes: /Mise en service/.test(document.querySelector('.camlab .cm-mes h2')?.textContent || '') };
});
T.check('leçon camera-systeme : l\'exercice noté « Mise en service » (pas encore faite)', /Mise en service de la caméra de plateau/.test(go.before) && /pas encore faite/.test(go.before), go.before.slice(0, 140));
T.check('« Commencer » (go { camera: \'mes\' }) ouvre le module sur la mise en service, le Cours refermé', go.closed && go.mes, JSON.stringify(go).slice(0, 200));
const M = 'window.__dbg.camlab().fiche.engine';
await ev(() => {
  // un geste de l'interface : un bouton, une touche d'une rangée (data-v) ou un curseur ; les onglets des postes
  window.__g = (g, v) => {
    const els = [...document.querySelectorAll(`.camlab .cm-mes [data-g="${g}"]`)];
    if (!els.length) throw new Error('geste introuvable : ' + g);
    const e0 = /** @type {HTMLInputElement} */ (els[0]);
    if (e0.tagName === 'INPUT') { e0.value = String(v); e0.dispatchEvent(new Event('input', { bubbles: true })); return; }
    if (e0.dataset.v != null) { /** @type {HTMLElement} */ (els.find((b) => /** @type {HTMLElement} */ (b).dataset.v === String(v))).click(); return; }
    e0.click();
  };
  window.__tab = (id) => /** @type {HTMLElement} */ (document.querySelector(`.camlab .cm-tab[data-tab="${id}"]`)).click();
  window.__irisPos = (N) => Math.log(N / 1.8) / Math.log(16 / 1.8) * 0.96;
  window.__g('commencer');
  window.__tab('objectif'); window.__g('monter'); window.__g('cable');
  window.__tab('fibre'); window.__g('nettoyer-cam'); window.__g('nettoyer-ccu'); window.__g('brancher');
  window.__tab('ccu'); window.__g('ccu-power'); window.__tab('rcp'); window.__g('cam-pw');
});
await until(A, `${M}.ready()`, null, 30000);
// la liaison, le viseur sur les barres, puis le tirage : iris ouvert, ND pour la lumière en trop ; point en serré, tirage en large
const tir = await ev(() => {
  const E = window.__dbg.camlab().fiche.engine; const jour = E.V.id === 'jour';
  window.__tab('ccu'); window.__g('liaison'); window.__tab('rcp'); window.__g('bars');
  window.__tab('viseur'); window.__g('bright', -3); window.__g('contrast', 5); window.__g('vf-ok'); window.__tab('rcp'); window.__g('bars');
  window.__tab('camera'); window.__g('nd', jour ? 1 / 64 : 1 / 16); window.__tab('rcp'); window.__g('iris', window.__irisPos(jour ? 2.8 : 1.8));
  window.__tab('objectif'); window.__g('vis');
  let pass = 0;
  for (; pass < 8 && !E.tirageOk(); pass++) {
    window.__g('zoom', 1);
    const dF = 1 / (1000 * (1 / 3000 + E.st.delta / 2916)); window.__g('point', Math.pow(Math.min(1, 0.3 / dF), 0.45));
    window.__g('zoom', 0);
    window.__g('ff', -(4.5 ** 2) * (1 / 3000 - 1 / (E.dF() * 1000)));
  }
  window.__g('vis');
  // erreur volontaire : la balance des blancs avant celle des noirs
  window.__tab('camera'); window.__g('nd', E.V.nd); window.__g('wbsw', 'A'); window.__tab('plateau'); window.__g('card', 1);
  window.__tab('rcp'); window.__g('iris', window.__irisPos(jour ? 11 : 8)); window.__g('awb');
  return { pass, steps: ['ccu', 'viseur', 'tirage'].filter((id) => E.done(id)).length, errs: E.errors.map((e) => e.t), say: document.querySelector('.camlab .cm-mes .cl-say')?.textContent };
});
T.check('mise en service : liaison, viseur, puis le tirage en deux passages au moins', tir.steps === 3 && tir.pass >= 2, JSON.stringify(tir).slice(0, 200));
T.check('erreur volontaire comptée et expliquée : balance des blancs avant les noirs', tir.errs.length === 1 && /avant celle des noirs/.test(tir.errs[0]) && /zéro des trois voies/.test(tir.say || ''), JSON.stringify(tir.errs));
await until(A, `${M}.st.awbOk`, null, 30000);
await A.screenshot({ path: `${OUT}/30-mes-erreur.png` });
await ev(() => window.__g('abb'));
await until(A, `${M}.st.abbOk`, null, 30000);
T.check('la balance des noirs refaite ensuite efface la balance des blancs', await ev(() => !window.__dbg.camlab().fiche.engine.st.awbOk));
await ev(() => window.__g('awb'));
await until(A, `${M}.st.awbOk`, null, 30000);
const bil = await ev(() => {
  window.__tab('plateau'); window.__g('card', 0); window.__tab('rcp'); window.__g('iris', window.__irisPos(5.6)); window.__g('expo');
  window.__tab('camera'); window.__g('zebra1'); window.__g('zebra-level', 70); window.__g('store');
  return { score: Number(/** @type {HTMLElement} */ (document.querySelector('.camlab .cm-bilan'))?.dataset.score), errs: document.querySelectorAll('.camlab .cm-errs-full li').length, revoir: [...document.querySelectorAll('.camlab .cm-mes .cl-see .cl-chip')].map((b) => /** @type {HTMLElement} */ (b).dataset.n), order: document.querySelectorAll('.camlab .cm-order li').length, best: window.__dbg.PROG.camera?.mes?.best };
});
T.check('le bilan : note sur 100 (une erreur d\'ordre, −8), l\'erreur expliquée, les notions à revoir, l\'ordre des dix étapes, le meilleur résultat enregistré', bil.score <= 92 && bil.score >= 72 && bil.errs === 1 && bil.revoir.includes('balance') && bil.order === 10 && bil.best && bil.best.score === bil.score, JSON.stringify(bil));
await A.screenshot({ path: `${OUT}/31-mes-bilan.png` });
const back = await ev(() => {
  /** @type {HTMLElement} */ ([...document.querySelectorAll('.camlab .cm-mes .cs-row .btn')].find((b) => /Revenir à la leçon/.test(b.textContent))).click();
  return { off: !document.body.classList.contains('camlab-on'), on: !!document.querySelector('#layer.ly-cours .co-les.on[data-lesson="camera-systeme"]'), exo: document.querySelector('#layer.ly-cours .co-exo[data-exercise="x-camera"]')?.textContent || '' };
});
T.check('« Revenir à la leçon » : la leçon camera-systeme, l\'exercice montre le meilleur résultat', back.off && back.on && /meilleur résultat \d+ \/ 100/.test(back.exo), JSON.stringify(back).slice(0, 220));
await A.screenshot({ path: `${OUT}/32-retour-lecon.png` });

// ---------------- une leçon de la caméra : « Sur la caméra en 3D » ouvre la notion à sa pastille, Échap ramène à la leçon ----------------
await ev(() => window.__dbg.emit('cours', { lesson: 'camera-iris' })); await A.waitForTimeout(500);
const sec = await ev(() => { const s = document.querySelector('#layer .co-camlab'); return { n: s ? s.querySelectorAll('button[data-notion]').length : 0, ids: s ? [...s.querySelectorAll('button[data-notion]')].map((b) => /** @type {HTMLElement} */ (b).dataset.notion) : [], fig: document.querySelectorAll('#layer .co-cfigs .cl-fig svg').length, demo: document.querySelectorAll('#layer .co-demo canvas').length, quiz: !!document.querySelector('#layer .co-quiz, #layer .co-q') }; });
T.check('leçon camera-iris : la section « Sur la caméra en 3D » (iris, pdc, ramping, doubleur), les schémas du module, la manipulation', sec.n === 4 && sec.ids.join() === 'iris,pdc,ramping,doubleur' && sec.fig === 2 && sec.demo >= 1, JSON.stringify(sec));
const sect = await A.$('#layer .co-camlab'); if (sect) await sect.screenshot({ path: `${OUT}/33-lecon-camlab.png` }).catch(() => {});
await A.click('#layer .co-camlab button[data-notion="pdc"]');
await until(A, () => document.body.classList.contains('camlab-on') && window.__dbg.camlab()?.notion === 'pdc', null, 60000);
await A.waitForTimeout(800);
const pdc = await ev(() => ({ titre: document.querySelector('.camlab .cl-side h2')?.textContent, lecon: document.querySelector('.camlab .cl-side .cs-cours')?.textContent, layer: !!document.getElementById('layer') }));
T.check('« Ouvrir sur la caméra » : le module s\'ouvre sur la fiche de la profondeur de champ, qui renvoie à la leçon', /profondeur de champ/i.test(pdc.titre || '') && /Le diaphragme et la profondeur de champ/.test(pdc.lecon || '') && !pdc.layer, JSON.stringify(pdc));
await A.keyboard.press('Escape'); await A.waitForTimeout(300);
if (await ev(() => document.body.classList.contains('camlab-on'))) { await A.keyboard.press('Escape'); await A.waitForTimeout(300); }
await until(A, () => !document.body.classList.contains('camlab-on') && !!document.querySelector('#layer.ly-cours .co-les.on[data-lesson="camera-iris"]'), null, 20000);
T.check('Échap : retour dans le Cours, sur la leçon camera-iris', await ev(() => !document.body.classList.contains('camlab-on') && !!document.querySelector('#layer.ly-cours .co-camlab')));
// les autres leçons de la caméra s'affichent, chacune avec ses notions et sa manipulation (profil Formateur : tout est ouvert)
await ev(() => window.__dbg.setRole('formateur'));
const toutes = await ev(async () => {
  const ids =['camera-focale', 'camera-point', 'camera-filtres', 'camera-prisme', 'camera-exposition', 'camera-numerique', 'camera-courbes', 'camera-peinture', 'camera-corps', 'camera-viseur', 'camera-voie', 'camera-mesure', 'camera-moniteur', 'camera-plusloin'];
  const bad = [];
  for (const id of ids) {
    window.__dbg.emit('cours', { lesson: id }); await new Promise((r) => setTimeout(r, 120));
    const n = document.querySelectorAll('#layer .co-camlab button[data-notion]').length, fig = document.querySelectorAll('#layer .co-cfigs svg').length, cv = document.querySelectorAll('#layer .co-demo canvas, #layer .co-demo table').length;
    const ver = document.querySelector('#layer .co-demo .co-verdict')?.textContent || 'sans verdict';
    if (!n || !fig || !cv || /NaN|undefined/.test(document.querySelector('#layer .co-demo')?.textContent || '')) bad.push(`${id} ${n} ${fig} ${cv} ${ver.slice(0, 30)}`);
  }
  return bad;
});
T.check('les quatorze autres leçons de la caméra : notions, schémas, manipulation, sans NaN', !toutes.length, toutes.join(' | '));
await ev(() => window.__dbg.setRole('etudiant'));

// ---------------- au téléphone (390 px) : chaque fiche sans défilement horizontal ----------------
await A.keyboard.press('Escape'); await A.setViewportSize({ width: 390, height: 844 });
await ev(() => window.__dbg.emit('camera', {}));
await until(A, () => document.body.classList.contains('camlab-on') && !document.querySelector('.camlab .cl-loading'), null, 60000);
const tel = [];
for (const id of ids) {
  await ev((id) => /** @type {HTMLElement} */ (document.querySelector(`.cl-ni[data-n="${id}"]`)).click(), id);
  await A.waitForTimeout(150);
  const o = await ev(() => { const side = document.querySelector('.camlab .cl-side'); return { page: document.documentElement.scrollWidth > innerWidth + 1, side: !side || side.scrollWidth > side.clientWidth + 1 }; });
  if (o.page || o.side) tel.push(`${id} ${JSON.stringify(o)}`);
  if (['gain', 'knee', 'tally', 'fibre', 'vecto'].includes(id)) { const side = await A.$('.camlab .cl-side'); if (side) await side.screenshot({ path: `${OUT}/40-tel-${id}.png` }).catch(() => {}); }
}
T.check('téléphone : les 51 fiches sans défilement horizontal', !tel.length, tel.join(' | ').slice(0, 600));

await browser.close();
await T.finish();
