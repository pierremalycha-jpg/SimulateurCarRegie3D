// Section Cours (v19) : l'écran titre à trois entrées et le profil dans les Réglages, le Cours
// depuis le titre (un seul sommaire ; chaque leçon : essentiel, schéma, manipulation, quiz,
// exercices pratiques, article de référence ; le suivi), le pupitre, la touche G, le lien
// fiche « ? » → leçon, le menu du car et le livret du stagiaire.
// node tests/e2e/cours.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('cours');
const T = reporter();
const browser = await launch();

// ---------------- écran titre : trois entrées, profil dans les Réglages ----------------
const A = await openPage(browser, { title: true, fresh: true, errors: T.errors });
await until(A, () => !!document.querySelector('#title.ready'), null, 180000);
const ev = (f, a) => A.evaluate(f, a);
const visibleKeys = () => ev(() => [...document.querySelectorAll('#ti-menu .ti-key')].filter((b) => b.offsetParent).map((b) => b.querySelector('b').textContent));
T.check('écran titre : Jouer, Cours, Réglages', JSON.stringify(await visibleKeys()) === JSON.stringify(['Jouer', 'Cours', 'Réglages']), String(await visibleKeys()));
await A.click('#ti-settings'); await A.waitForTimeout(300);
T.check('Réglages (Étudiant par défaut) : pas d\'espace formateur', await ev(() => !document.getElementById('rg-trainer')?.offsetParent));
await A.click('#modal .seg[aria-label="Profil"] button[data-v="formateur"]'); await A.waitForTimeout(200);
T.check('profil Formateur : l\'espace formateur apparaît dans les Réglages', await ev(() => !!document.getElementById('rg-trainer')?.offsetParent));
T.check('profil mémorisé', await ev(() => localStorage.getItem('carregie.profil') === 'formateur' && document.body.classList.contains('role-formateur')));
await A.click('#modal .seg[aria-label="Profil"] button[data-v="etudiant"]'); await A.waitForTimeout(200);
T.check('retour Étudiant : l\'espace formateur disparaît', await ev(() => !document.getElementById('rg-trainer')?.offsetParent));
T.check('trois entrées quel que soit le profil', JSON.stringify(await visibleKeys()) === JSON.stringify(['Jouer', 'Cours', 'Réglages']));
await A.keyboard.press('Escape'); await A.waitForTimeout(200);
await A.screenshot({ path: `${OUT}/01-titre.png` });

// ---------------- Cours depuis le titre ----------------
await A.click('#ti-cours'); await A.waitForTimeout(500);
T.check('Cours : l\'espace s\'ouvre par-dessus le titre, sur les leçons', await ev(() => !document.getElementById('title').hidden && !!document.querySelector('#layer.ly-cours .ly-tabs .tab.on[data-k="lecons"]') && document.querySelectorAll('#layer .co-chap').length >= 4));
const lessons = await ev(() => window.__dbg.COURS.allLessons().map(({ chapter, lesson }) => ({ ch: chapter.id, id: lesson.id, title: lesson.title, n: lesson.quiz.length, demo: !!lesson.demo, fig: !!lesson.figure, terms: (lesson.terms || []).length })));
T.log('leçons', lessons.length, lessons.map((l) => l.id).join(' '));
T.check('au moins une leçon par chapitre', ['signal', 'sdi', 'reseau', 'hf'].every((c) => lessons.some((l) => l.ch === c)), JSON.stringify([...new Set(lessons.map((l) => l.ch))]));
let shots = 0;
for (const L of lessons) {
  await ev((id) => window.__dbg.openCours(id), L.id); await A.waitForTimeout(400);
  const st = await ev(() => ({ h3: document.querySelector('#layer .co-page h2')?.textContent || '', ess: document.querySelectorAll('#layer .co-ess li').length, fig: !!document.querySelector('#layer .co-figbox svg, #layer .co-figbox canvas'), demo: document.querySelectorAll('#layer .co-demo-host *').length, q: document.querySelectorAll('#layer .co-q').length, car: !!document.querySelector('#layer .co-car'), chips: document.querySelectorAll('#layer .co-chip').length }));
  const ok = st.h3.startsWith(L.title) && st.ess >= 1 && st.ess <= 3 && (!L.fig || st.fig) && (!L.demo || st.demo > 0) && st.q === L.n && L.n === 3 && st.car;
  T.check(`leçon ${L.id} : essentiel, schéma, manipulation, « dans le car », quiz de 3`, ok, JSON.stringify(st));
  // quiz : la bonne réponse partout → leçon acquise
  const ans = await ev((id) => { const f = window.__dbg.COURS.lessonById(id); return f.lesson.quiz.map((q) => q.answer); }, L.id);
  for (let i = 0; i < ans.length; i++) { const b = A.locator(`#layer .co-q:nth-of-type(${i + 1}) .co-choice-btn`).nth(ans[i]); await b.click({ force: true, timeout: 5000 }).catch(() => {}); } // force : une manipulation animée retarde le test de stabilité de Playwright
  await A.waitForTimeout(200);
  T.check(`leçon ${L.id} : quiz réussi, leçon acquise`, await ev((id) => window.__dbg.COURS.lessonDone(id) && /leçon acquise/.test(document.querySelector('#layer .co-score')?.textContent || ''), L.id));
  if (shots < 12) { shots++; const p = await A.$('#layer .co-page'); if (p) await p.screenshot({ path: `${OUT}/10-${L.id}.png` }).catch(() => {}); }
}
T.check('progression enregistrée (PROG.cours)', await ev(() => Object.values(window.__dbg.PROG.cours || {}).filter((p) => p.quiz && p.quiz.score === p.quiz.total).length) === lessons.length);
// recherche : leçons et fiches « ? »
await A.fill('#layer #co-search', 'ptp'); await A.waitForTimeout(300);
T.check('recherche « ptp » : des fiches « ? » (et des leçons si le chapitre réseau en parle)', await ev(() => document.querySelectorAll('#layer .co-list .co-chip').length >= 1));
await A.fill('#layer #co-search', ''); await A.waitForTimeout(200);
// barre du Cours : Leçons, Glossaire, Postes, Matériel ; l'article de référence d'une leçon
T.check('barre du Cours : Leçons, Glossaire, Postes, Matériel', await ev(() => [...document.querySelectorAll('#layer .ly-tabs .tab')].map((t) => t.dataset.k).join(',') === 'lecons,glossaire,postes,materiel'));
await ev(() => window.__dbg.openCours('reseau-ptp')); await A.waitForTimeout(300);
await A.click('#layer .co-article .btn'); await A.waitForTimeout(300);
T.check('« Lire l\'article de référence » : l\'article du guide par-dessus le Cours', await ev(() => !document.getElementById('modal').hidden && document.querySelectorAll('#modal .prose p, #modal p').length > 3));
await A.keyboard.press('Escape'); await A.waitForTimeout(200);
await A.click('#layer .ly-tabs .tab[data-k="glossaire"]'); await A.waitForTimeout(300);
T.check('onglet Glossaire : la recherche', await ev(() => !!document.querySelector('#layer #glq') && document.querySelectorAll('#layer .item').length > 50));
await A.click('#layer .ly-tabs .tab[data-k="postes"]'); await A.waitForTimeout(300);
T.check('onglet Postes : les fiches des postes', await ev(() => document.querySelectorAll('#layer .item').length >= 20));
await A.keyboard.press('Escape'); await A.waitForTimeout(300);
T.check('fermeture : l\'écran titre est toujours là, focus rendu à Cours', await ev(() => !document.getElementById('layer') && !document.getElementById('title').hidden && document.activeElement?.id === 'ti-cours'));
// le suivi : chapitres, à faire ensuite, et le livret de compétences complet
await A.click('#ti-cours'); await A.waitForTimeout(500);
await ev(() => window.__dbg.emit('cours', { home: true })); await A.waitForTimeout(300); // le Cours rouvre sur la dernière leçon lue
T.check('Cours : le suivi compte les leçons acquises', await ev((n) => (document.querySelector('#layer .co-kpi b')?.textContent || '').startsWith(n + ' /'), lessons.length));
await A.click('#layer .btn:has-text("Ouvrir le livret complet")'); await A.waitForTimeout(400);
T.check('livret complet : les quatre blocs du référentiel, 39 compétences', await ev(() => document.querySelectorAll('#modal .lv-card').length === 4 && document.querySelectorAll('#modal .lv-comp').length === 39));
await A.screenshot({ path: `${OUT}/02-livret.png` });
await A.keyboard.press('Escape'); await A.waitForTimeout(200);
await A.keyboard.press('Escape'); await A.waitForTimeout(300);
await A.click('#ti-play'); await A.waitForTimeout(400);
T.check('écran Jouer : liens Cours et Réglages, ni espace formateur ni relecture', await ev(() => !!document.getElementById('st-cours') && !!document.getElementById('st-reglages') && ![...document.querySelectorAll('#start button')].some((b) => b.offsetParent && /formateur|Relecture/i.test(b.textContent))));
await A.close();

// ---------------- dans le car : pupitre par famille, fenêtres regroupées, G, fiche → leçon, livret ----------------
const B = await openPage(browser, { errors: T.errors });
const eb = (f, a) => B.evaluate(f, a);
await eb(() => window.__dbg.start('vierge'));
await until(B, () => window.__dbg.S.mode !== 'start', null, 60000); await B.waitForTimeout(1000);
await B.keyboard.press('Tab'); await B.waitForTimeout(500);
const fams = () => eb(() => [...document.querySelectorAll('#modal .pp-fam')].filter((f) => f.offsetParent).map((f) => f.querySelector('h3').textContent));
T.check('pupitre : outils du car, Cours, Réglages', JSON.stringify(await fams()) === JSON.stringify(['Dans le car', 'Cours', 'Réglages']), String(await fams()));
T.check('pupitre : au moins 12 touches d\'outil', await eb(() => document.querySelectorAll('#modal .dkey.tool').length >= 12));
await B.screenshot({ path: `${OUT}/20-pupitre.png` });
await B.click('#modal .dkey.tool:has-text("Cours")'); await B.waitForTimeout(400);
T.check('touche Cours du pupitre : l\'espace Cours', await eb(() => !!document.querySelector('#layer.ly-cours')));
await B.keyboard.press('Escape'); await B.waitForTimeout(300);
await B.keyboard.press('KeyG'); await B.waitForTimeout(400);
T.check('touche G : les leçons', await eb(() => !!document.querySelector('#layer .ly-tabs .tab.on[data-k="lecons"]')));
await B.keyboard.press('Escape'); await B.waitForTimeout(300);
// fiche « ? » → leçon
await eb(() => window.__dbg.openCours(window.__dbg.COURS.allLessons().find(({ lesson }) => (lesson.terms || []).length).lesson.id)); await B.waitForTimeout(400);
await B.click('#layer .co-terms .co-chip .q'); await B.waitForTimeout(400);
T.check('fiche « ? » depuis une leçon : chip « Leçon » qui ramène à la leçon', await until(B, () => !!document.querySelector('.tp-cours .tp-chip'), null, 4000));
await B.click('.tp-cours .tp-chip'); await B.waitForTimeout(400);
T.check('la fiche se ferme et la leçon s\'affiche', await eb(() => !!document.querySelector('#layer .co-page h2') && [...document.querySelectorAll('.tp-cours')].every((e) => e.closest('[hidden]'))));
// « Aller au poste » depuis une leçon : le poste s'ouvre, l'espace se ferme
await B.click('#layer .co-car .btn.primary'); await B.waitForTimeout(1500);
T.check('« Aller au poste » : le poste de la leçon s\'ouvre, l\'espace se ferme', await until(B, () => window.__dbg.S.mode === 'station' && !document.getElementById('layer'), null, 20000), await eb(() => window.__dbg.S.mode + ' ' + window.__dbg.S.station));
await eb(() => window.__dbg.closeStation()); await B.waitForTimeout(300);
await eb(() => window.__dbg.openGuide('postes')); await B.waitForTimeout(300);
T.check('openGuide(postes) : l\'espace Cours, onglet Postes', await eb(() => !!document.querySelector('#layer .ly-tabs .tab.on[data-k="postes"]')));
await B.keyboard.press('Escape'); await B.waitForTimeout(300);
await eb(() => window.__dbg.openGuide('reglages')); await B.waitForTimeout(300);
T.check('openGuide(reglages) : la fenêtre Réglages', await eb(() => document.querySelector('#modal h2')?.textContent === 'Réglages' && !document.getElementById('modal').hidden));
await B.keyboard.press('Escape'); await B.waitForTimeout(300);
await eb(() => window.__dbg.openGuide('guide', 'reseau')); await B.waitForTimeout(300);
T.check('openGuide(guide, chapitre) : la leçon qui cite cet article', await eb(() => !!document.querySelector('#layer .ly-tabs .tab.on[data-k="lecons"]') && window.__dbg.COURS.lessonById(document.querySelector('#layer .co-les.on[data-lesson]')?.dataset.lesson || '')?.lesson.article === 'reseau'));
await B.keyboard.press('Escape'); await B.waitForTimeout(300);
// le menu du car (Échap) : Reprendre, Cours, Réglages, Retour à l'accueil
await B.keyboard.press('Escape'); await B.waitForTimeout(400);
T.check('menu du car : Cours et Réglages, plus de Chef de car ni de Formateur', await eb(() => !!document.querySelector('#modal .mn') && ['mn-cours', 'mn-reglages'].every((id) => document.getElementById(id)?.offsetParent) && !document.getElementById('mn-chef') && !document.getElementById('mn-trainer')));
await B.screenshot({ path: `${OUT}/30-menu.png` });
await B.click('#mn-reglages'); await B.waitForTimeout(300);
T.check('Réglages dans le car (Formateur) : l\'espace formateur', await eb(() => !!document.getElementById('rg-trainer')?.offsetParent));
await B.keyboard.press('Escape'); await B.waitForTimeout(300);
await eb(() => window.__dbg.emit('cours', { home: true })); await B.waitForTimeout(400);
await B.click('#layer .btn:has-text("Ouvrir le livret complet")'); await B.waitForTimeout(400);
T.check('livret : les compétences et les leçons du Cours comptées', await eb(() => document.querySelectorAll('#modal .lv-comp').length === 39 && [...document.querySelectorAll('#modal .lv-act em')].some((e) => e.textContent === 'Cours')));
await B.screenshot({ path: `${OUT}/31-livret.png` });
await T.finish();
