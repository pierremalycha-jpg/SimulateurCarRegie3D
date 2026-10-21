// Menus par profil et section Cours (v18.4) : l'écran titre à cinq entrées et sa bascule de profil,
// la fenêtre Cours depuis le titre (chapitres, chaque leçon : essentiel, schéma, manipulation,
// quiz, progression), les fenêtres regroupées (Le car, Missions et livret, Réglages), le pupitre par
// famille, la touche G, le lien fiche « ? » → leçon, et le livret du stagiaire.
// node tests/e2e/cours.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('cours');
const T = reporter();
const browser = await launch();

// ---------------- écran titre : profil et cinq entrées ----------------
const A = await openPage(browser, { title: true, fresh: true, errors: T.errors });
await until(A, () => !!document.querySelector('#title.ready'), null, 180000);
const ev = (f, a) => A.evaluate(f, a);
const visibleKeys = () => ev(() => [...document.querySelectorAll('#ti-menu .ti-key')].filter((b) => b.offsetParent).map((b) => b.querySelector('b').textContent));
T.check('profil Étudiant par défaut : Jouer, Cours, Chef de car, Réglages', JSON.stringify(await visibleKeys()) === JSON.stringify(['Jouer', 'Cours', 'Chef de car', 'Réglages']), String(await visibleKeys()));
await A.click('#ti-role button[data-v="formateur"]'); await A.waitForTimeout(200);
T.check('profil Formateur : l\'entrée Formateur apparaît', (await visibleKeys()).includes('Formateur'));
T.check('profil mémorisé', await ev(() => localStorage.getItem('carregie.profil') === 'formateur' && document.body.classList.contains('role-formateur')));
await A.click('#ti-role button[data-v="etudiant"]'); await A.waitForTimeout(200);
T.check('retour Étudiant : l\'entrée Formateur disparaît', !(await visibleKeys()).includes('Formateur'));
await A.screenshot({ path: `${OUT}/01-titre.png` });

// ---------------- Cours depuis le titre ----------------
await A.click('#ti-cours'); await A.waitForTimeout(500);
T.check('Cours : le titre s\'efface, la fenêtre s\'ouvre sur les chapitres', await ev(() => document.getElementById('title').hidden && !!document.querySelector('#modal .co-tabs .tab.on[data-k="chapitres"]') && document.querySelectorAll('#modal .co-chap').length >= 4));
const lessons = await ev(() => window.__dbg.COURS.allLessons().map(({ chapter, lesson }) => ({ ch: chapter.id, id: lesson.id, title: lesson.title, n: lesson.quiz.length, demo: !!lesson.demo, fig: !!lesson.figure, terms: (lesson.terms || []).length })));
T.log('leçons', lessons.length, lessons.map((l) => l.id).join(' '));
T.check('au moins une leçon par chapitre', ['signal', 'sdi', 'reseau', 'hf'].every((c) => lessons.some((l) => l.ch === c)), JSON.stringify([...new Set(lessons.map((l) => l.ch))]));
let shots = 0;
for (const L of lessons) {
  await ev((id) => window.__dbg.openCours(id), L.id); await A.waitForTimeout(400);
  const st = await ev(() => ({ h3: document.querySelector('#modal .co-page h3')?.textContent || '', ess: document.querySelectorAll('#modal .co-ess li').length, fig: !!document.querySelector('#modal .co-figbox svg, #modal .co-figbox canvas'), demo: document.querySelectorAll('#modal .co-demo-host *').length, q: document.querySelectorAll('#modal .co-q').length, car: !!document.querySelector('#modal .co-car'), chips: document.querySelectorAll('#modal .co-chip').length }));
  const ok = st.h3.startsWith(L.title) && st.ess >= 1 && st.ess <= 3 && (!L.fig || st.fig) && (!L.demo || st.demo > 0) && st.q === L.n && L.n === 3 && st.car;
  T.check(`leçon ${L.id} : essentiel, schéma, manipulation, « dans le car », quiz de 3`, ok, JSON.stringify(st));
  // quiz : la bonne réponse partout → leçon acquise
  const ans = await ev((id) => { const f = window.__dbg.COURS.lessonById(id); return f.lesson.quiz.map((q) => q.answer); }, L.id);
  for (let i = 0; i < ans.length; i++) { const b = A.locator(`#modal .co-q:nth-of-type(${i + 1}) .co-choice-btn`).nth(ans[i]); await b.click({ timeout: 5000 }).catch(() => {}); }
  await A.waitForTimeout(200);
  T.check(`leçon ${L.id} : quiz réussi, leçon acquise`, await ev((id) => window.__dbg.COURS.lessonDone(id) && /leçon acquise/.test(document.querySelector('#modal .co-score')?.textContent || ''), L.id));
  if (shots < 12) { shots++; const p = await A.$('#modal .co-page'); if (p) await p.screenshot({ path: `${OUT}/10-${L.id}.png` }).catch(() => {}); }
}
T.check('progression enregistrée (PROG.cours)', await ev(() => Object.values(window.__dbg.PROG.cours || {}).filter((p) => p.quiz && p.quiz.score === p.quiz.total).length) === lessons.length);
// onglets Articles et Glossaire (l'ancien « Comprendre »)
await A.click('#modal .co-tabs .tab[data-k="articles"]'); await A.waitForTimeout(300);
T.check('onglet Articles : les chapitres du guide', await ev(() => document.querySelectorAll('#modal .co-body .tabs .tab').length > 5 && !!document.querySelector('#modal .prose h3')));
await A.click('#modal .co-tabs .tab[data-k="glossaire"]'); await A.waitForTimeout(300);
T.check('onglet Glossaire : la recherche', await ev(() => !!document.querySelector('#modal #glq') && document.querySelectorAll('#modal .item').length > 50));
await A.keyboard.press('Escape'); await A.waitForTimeout(300);
T.check('fermeture : retour à l\'écran titre, focus sur Cours', await ev(() => !document.getElementById('title').hidden && document.activeElement?.id === 'ti-cours'));
// Chef de car depuis le titre
await A.click('#ti-chef'); await A.waitForTimeout(600);
T.check('Chef de car depuis le titre : feuille de service et panneau du chef', await ev(() => document.getElementById('title').hidden && !!document.querySelector('#chef') && !document.querySelector('#chef').hidden));
T.check('feuille de service (Étudiant) : pas d\'espace formateur ni de relecture', await ev(() => ![...document.querySelectorAll('#start .dk-team .btn')].some((b) => b.offsetParent && /formateur|Relecture/.test(b.textContent))));
await A.close();

// ---------------- dans le car : pupitre par famille, fenêtres regroupées, G, fiche → leçon, livret ----------------
const B = await openPage(browser, { errors: T.errors });
const eb = (f, a) => B.evaluate(f, a);
await eb(() => window.__dbg.start('vierge'));
await until(B, () => window.__dbg.S.mode !== 'start', null, 60000); await B.waitForTimeout(1000);
await B.keyboard.press('Tab'); await B.waitForTimeout(500);
const fams = () => eb(() => [...document.querySelectorAll('#modal .pp-fam')].filter((f) => f.offsetParent).map((f) => f.querySelector('h3').textContent));
T.check('pupitre (Formateur, harnais) : cinq familles', JSON.stringify(await fams()) === JSON.stringify(['Jouer', 'Cours', 'Chef de car', 'Formateur', 'Réglages']), String(await fams()));
T.check('pupitre : au moins 15 touches d\'outil', await eb(() => document.querySelectorAll('#modal .dkey.tool').length >= 15));
await eb(() => window.__dbg.setRole('etudiant')); await B.waitForTimeout(100);
T.check('pupitre (Étudiant) : la famille Formateur disparaît', !(await fams()).includes('Formateur'));
await eb(() => window.__dbg.setRole('formateur'));
await B.screenshot({ path: `${OUT}/20-pupitre.png` });
await B.click('#modal .dkey.tool:has-text("Cours")'); await B.waitForTimeout(400);
T.check('touche Cours du pupitre : la fenêtre Cours', await eb(() => !!document.querySelector('#modal .co-tabs')));
await B.keyboard.press('Escape'); await B.waitForTimeout(300);
await B.keyboard.press('KeyG'); await B.waitForTimeout(400);
T.check('touche G : les cours', await eb(() => !!document.querySelector('#modal .co-tabs .tab.on[data-k="chapitres"]')));
// fiche « ? » → leçon
await eb(() => window.__dbg.openCours(window.__dbg.COURS.allLessons().find(({ lesson }) => (lesson.terms || []).length).lesson.id)); await B.waitForTimeout(400);
await B.click('#modal .co-chip .q, #modal .co-chip button'); await B.waitForTimeout(400);
T.check('fiche « ? » depuis une leçon : chip « Leçon » qui ramène à la leçon', await eb(() => !!document.querySelector('.tp-cours .tp-chip')));
await B.click('.tp-cours .tp-chip'); await B.waitForTimeout(400);
T.check('la fiche se ferme et la leçon s\'affiche', await eb(() => !!document.querySelector('#modal .co-page h3') && !document.querySelector('.tp-cours')));
await B.keyboard.press('Escape'); await B.waitForTimeout(300);
await eb(() => window.__dbg.openGuide('postes')); await B.waitForTimeout(300);
T.check('fenêtre « Le car » : quatre onglets', await eb(() => document.querySelector('#modal h2')?.textContent === 'Le car : postes, matériel, procédures' && document.querySelectorAll('#modal .tabs .tab').length === 4));
await B.keyboard.press('Escape'); await B.waitForTimeout(300);
await eb(() => window.__dbg.openGuide('reglages')); await B.waitForTimeout(300);
T.check('fenêtre Réglages : un seul onglet, barre masquée', await eb(() => document.querySelector('#modal h2')?.textContent === 'Réglages' && !document.querySelector('#modal .tabs')?.offsetParent));
await B.keyboard.press('Escape'); await B.waitForTimeout(300);
await eb(() => window.__dbg.openGuide('guide', 'reseau')); await B.waitForTimeout(300);
T.check('openGuide(guide, chapitre) : la fenêtre Cours, onglet Articles, bon chapitre', await eb(() => !!document.querySelector('#modal .co-tabs .tab.on[data-k="articles"]') && /ST 2110/.test(document.querySelector('#modal .prose h3')?.textContent || '')));
await B.keyboard.press('Escape'); await B.waitForTimeout(300);
await eb(() => window.__dbg.openGuide('livret')); await B.waitForTimeout(300);
T.check('livret du stagiaire : missions, parcours du chef, cours, exercices', await eb(() => document.querySelectorAll('#modal .lv-sec').length === 4 && document.querySelectorAll('#modal .lv-bar').length >= 10));
await B.screenshot({ path: `${OUT}/30-livret.png` });
await T.finish();
