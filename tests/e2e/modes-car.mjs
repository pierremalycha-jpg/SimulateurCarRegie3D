// Les trois modes du car régie (Jouer → Car régie, v19.8) : la mission spécifique (la liste par famille,
// le car préparé, le suivi des tâches sur le côté, « Mission réussie », enchaîner avec rechargement puis sans,
// Olivier en boîte de dialogue en bas d'écran), le car pré-installé (ni chef de car ni missions) et le car vide
// (Olivier propose d'abord la visite ; les tâches de l'installation par groupe). Puis la boîte de dialogue à 390 px.
// node tests/e2e/modes-car.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('modes-car');
const T = reporter();
const browser = await launch();

const A = await openPage(browser, { errors: T.errors });
const ev = (f, a) => A.evaluate(f, a);
const shot = async (page, n) => { await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/${n}.png` }); };

// ---------------- Jouer : les trois modes, la liste des missions ----------------
T.check('Jouer → Car régie : car vide, car pré-installé, mission spécifique', await ev(() => [...document.querySelectorAll('#start .jo-mode')].map((b) => b.dataset.mode).join(',') === 'zero,installe,mission'
  && /Car vide/.test(document.querySelector('.jo-mode[data-mode="zero"]').textContent) && /Car pré-installé/.test(document.querySelector('.jo-mode[data-mode="installe"]').textContent)));
await A.click('.jo-mode[data-mode="mission"]'); await A.waitForTimeout(300);
T.check('Mission spécifique : la liste, par famille (installer, aux postes, épreuves notées)', await ev(() => { const b = document.querySelector('.jo-missions'); return !!b && !b.hidden && [...b.querySelectorAll('.mc-fam')].map((f) => f.dataset.famille).join(',') === 'installer,postes,epreuves' && b.querySelectorAll('.mc-item').length >= 40; }));
await A.click('.mc-item[data-mission="i-reseau"]'); await A.waitForTimeout(200);
T.check('une mission choisie : la touche de lancement la nomme', await ev(() => document.querySelector('.mc-item[data-mission="i-reseau"]').getAttribute('aria-pressed') === 'true' && /Paramétrer le réseau de contrôle/.test(document.getElementById('st-antenne').textContent)));
await shot(A, '01-jouer-missions');

// ---------------- la mission : le car préparé, le suivi des tâches ----------------
await A.click('#st-antenne');
T.check('le car est lancé, préparé pour la mission (réseau de contrôle aux adresses d\'usine)', await until(A, () => window.__dbg.S.mode !== 'start' && window.__dbg.S.modeCar === 'mission' && window.__dbg.S.reseauUsine === true && window.__dbg.mission.m && window.__dbg.mission.m.id === 'i-reseau', null, 120000));
await A.waitForTimeout(1500);
T.check('le suivi des tâches sur le côté : la mission et sa tâche en cours', await until(A, () => { const q = document.getElementById('quest'); return !!q && !q.hidden && /Mission spécifique/.test(q.textContent) && /Paramétrer le réseau de contrôle/.test(q.textContent) && !!q.querySelector('.q-task.now'); }, null, 30000));
await shot(A, '02-mission-suivi');
await ev(() => window.__dbg.CTRL.resetCtrlNet());
T.check('le réseau remis au plan : « Mission réussie », Mission suivante / Arrêter dans le suivi', await until(A, () => window.__dbg.mission.fini && /Mission réussie/.test(document.getElementById('quest').textContent) && !!document.querySelector('#quest [data-k="mission:suivante"]') && !!document.querySelector('#quest [data-k="mission:arreter"]'), null, 15000));
await shot(A, '03-mission-reussie');

// ---------------- enchaîner : un exercice d'Olivier (le car change : rechargement) ----------------
await A.click('#quest [data-k="mission:suivante"]');
T.check('« Mission suivante » : la liste dans une fenêtre', await until(A, () => !!document.querySelector('#modal .mc-pick'), null, 5000));
await A.click('#modal .mc-grp summary >> nth=0'); await A.waitForTimeout(200);
await ev(() => { const d = [...document.querySelectorAll('#modal .mc-grp')].find((x) => x.querySelector('[data-mission="vision-exposition"]')); if (d) d.open = true; });
await A.click('#modal .mc-item[data-mission="vision-exposition"]'); await A.waitForTimeout(200);
await A.click('#modal [data-k="mission:lancer"]');
await A.waitForSelector('#ask [data-ask="ok"]');
T.check('le car doit changer : la confirmation nomme la mission', await ev(() => /Lancer la mission/.test(document.getElementById('ask').textContent)));
const reload = A.waitForEvent('load', { timeout: 120000 });
await A.click('#ask [data-ask="ok"]');
await reload;
await A.waitForFunction('!!window.__dbg', null, { timeout: 180000, polling: 300 });
T.check('après le rechargement : la mission et l\'exercice d\'Olivier commencent', await until(A, () => window.__dbg.S.modeCar === 'mission' && window.__dbg.mission.m && window.__dbg.mission.m.id === 'vision-exposition' && window.__dbg.TUTOR.lesson && window.__dbg.TUTOR.lesson.id === 'vision-exposition', null, 150000));
await A.waitForTimeout(1200);
T.check('Olivier en boîte de dialogue, en bas de l\'écran', await until(A, () => { const c = document.getElementById('chef'); if (!c || c.hidden || !c.classList.contains('dlg')) return false; const r = c.getBoundingClientRect(); return r.bottom > window.innerHeight - 40 && Math.abs((r.left + r.right) / 2 - window.innerWidth / 2) < 30; }, null, 10000));
T.check('le suivi montre les étapes de l\'exercice', await ev(() => document.querySelectorAll('#quest .q-task').length >= 3 && !!document.querySelector('#quest .q-task.now')));
await shot(A, '04-dialogue');
for (let i = 0; i < 30; i++) {
  if (!(await ev(() => !!window.__dbg.TUTOR.lesson))) break;
  await ev(() => { const s = window.__dbg.TUTOR.lesson.steps[window.__dbg.TUTOR.i]; if (s.quiz && !window.__dbg.TUTOR.done) { const b = document.querySelectorAll('#chef .chef-choice')[s.quiz.answer]; if (b) b.click(); } else if (!window.__dbg.TUTOR.done) window.__dbg.chefDoForMe(); });
  await A.waitForTimeout(350);
  await ev(() => { if (window.__dbg.TUTOR.done) window.__dbg.chefNext(); });
  await A.waitForTimeout(250);
}
T.check('l\'exercice fini : « Mission réussie », Mission suivante dans le dialogue d\'Olivier', await until(A, () => window.__dbg.mission.fini && /Mission réussie/.test(document.getElementById('chef').textContent) && !!document.querySelector('#chef [data-k="mission:suivante"]'), null, 15000));
await shot(A, '04b-exercice-fini');
// enchaîner dans le même car : sans recharger (le bouton du dialogue, ou celui du suivi hors d'un poste)
await ev(() => { const b = [...document.querySelectorAll('[data-k="mission:suivante"]')].find((x) => x.offsetParent); if (b) b.click(); });
await until(A, () => !!document.querySelector('#modal .mc-pick'), null, 5000);
await ev(() => { const d = [...document.querySelectorAll('#modal .mc-grp')].find((x) => x.querySelector('[data-mission="vision-balance"]')); if (d) d.open = true; });
await A.click('#modal .mc-item[data-mission="vision-balance"]'); await A.click('#modal [data-k="mission:lancer"]');
T.check('même car : la mission suivante commence sans recharger', await until(A, () => window.__dbg.TUTOR.lesson && window.__dbg.TUTOR.lesson.id === 'vision-balance' && window.__dbg.mission.m.id === 'vision-balance' && !window.__dbg.mission.fini, null, 10000));

// ---------------- le car pré-installé : ni chef de car ni missions ----------------
// une page à la fois : le rendu logiciel de deux stades ralentirait trop la suivante
await A.close();
const B = await openPage(browser, { errors: T.errors });
await B.click('.jo-mode[data-mode="installe"]'); await B.click('#st-antenne');
await until(B, () => window.__dbg.S.mode !== 'start', null, 120000); await B.waitForTimeout(1500);
T.check('car pré-installé : jeu libre, pas de touche Missions, pas d\'objectif', await B.evaluate(() => window.__dbg.S.modeCar === 'libre' && document.getElementById('tb-missions').hidden && (document.getElementById('quest') || { hidden: true }).hidden));
await B.keyboard.press('KeyJ'); await B.waitForTimeout(300); await B.keyboard.press('KeyL'); await B.waitForTimeout(300);
T.check('J et L : ni chef de car ni journal, un message le dit', await B.evaluate(() => (!document.getElementById('chef') || document.getElementById('chef').hidden) && document.getElementById('modal').hidden && /Car pré-installé/.test(document.getElementById('toast').textContent)));
await shot(B, '05-pre-installe');

// ---------------- le car vide : Olivier propose la visite, les tâches par groupe ----------------
await B.close();
const C = await openPage(browser, { errors: T.errors });
await C.click('.jo-mode[data-mode="zero"]'); await C.click('#st-antenne');
await until(C, () => window.__dbg.S.mode !== 'start', null, 120000); await C.waitForTimeout(1500);
T.check('car vide : Olivier se présente et propose le tour du car ou l\'installation', await until(C, () => { const c = document.getElementById('chef'); return !!c && !c.hidden && !!c.querySelector('[data-k="vide:visite"]') && !!c.querySelector('[data-k="vide:installer"]'); }, null, 10000));
T.check('le suivi : les tâches de l\'installation, par groupe', await C.evaluate(() => { const q = document.getElementById('quest'); return !!q && /Installation du car/.test(q.textContent) && q.querySelectorAll('.q-grp').length === 4 && !!q.querySelector('.q-task.now'); }));
await shot(C, '06-car-vide');
await C.click('#chef [data-k="vide:visite"]');
T.check('« Le tour du car et les postes » : la visite commence, son plan dans le suivi', await until(C, () => window.__dbg.TUTOR.lesson && window.__dbg.TUTOR.lesson.id === 'prise-en-main' && /Visite guidée/.test(document.getElementById('quest').textContent) && document.querySelectorAll('#quest .q-task').length >= 6, null, 10000));
await shot(C, '07-car-vide-visite');

// ---------------- au téléphone : la boîte de dialogue en bas, pleine largeur ----------------
await C.setViewportSize({ width: 390, height: 844 }); await C.waitForTimeout(600);
T.check('390 px : la boîte de dialogue occupe le bas de l\'écran', await C.evaluate(() => { const r = document.getElementById('chef').getBoundingClientRect(); return r.left <= 1 && r.right >= 389 && r.bottom >= 840; }));
await shot(C, '08-telephone');

await T.finish();
