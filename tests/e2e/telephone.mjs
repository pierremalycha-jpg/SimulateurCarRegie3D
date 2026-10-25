// Le téléphone (src/telephone/) : il remplace le pupitre et les boutons du HUD. Barre d'outils réduite à
// Téléphone et Menu ; Tab lève le téléphone (boîtier 3D et écran HTML), Échap et Tab le rangent ; les
// applications des trois familles (Le car, Cours, Réglages) ; « Aller à » mène à un poste ; au poste, le
// bouton Téléphone remplace Missions et Chef de car ; un raccourci (P) range le téléphone et fait son
// office ; car pré-installé : ni Missions ni Olivier ; petit écran tactile : le téléphone tient dans la fenêtre.
// node tests/e2e/telephone.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('telephone');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { errors: T.errors, viewport: { width: 1440, height: 900 } });
const ev = (f, a) => page.evaluate(f, a);
const shot = (n, p = page) => p.screenshot({ path: `${OUT}/${n}.png` });
const st = () => ev(() => window.__dbg.tel.state());
const levé = (p = page) => until(p, () => { const s = window.__dbg.tel.state(); return s.open && s.t >= 1; }, null, 10000);
const rangé = (p = page) => until(p, () => { const s = window.__dbg.tel.state(); return !s.open && document.getElementById('telephone').hidden; }, null, 10000);

await ev(() => window.__dbg.start('zero', 'jour', 'basse', false));
await until(page, () => window.__dbg.S.mode === 'fps', null, 60000);
await ev(() => { window.__dbg.stopChefLesson(); window.__dbg.toggleChef(false); });
await page.waitForTimeout(500);

// ---------------- le HUD ----------------
T.check('barre d\'outils : le niveau, Téléphone et Menu, rien d\'autre', await until(page, () => [...document.querySelectorAll('#toolbar .tbtn')].filter((b) => !b.hidden).map((b) => b.id).join(',') === 'tb-tel,tb-menu' && !!document.querySelector('#toolbar #xpbar') && document.querySelector('#tb-tel kbd')?.textContent === 'Tab', null, 6000));
await shot('01-hud');

// ---------------- lever le téléphone ----------------
await page.keyboard.press('Tab');
T.check('Tab lève le téléphone (boîtier en 3D, écran à l\'échelle 1)', await levé() && (await st()).webgl && (await st()).scale === 1);
T.check('l\'écran est posé sur le boîtier, à droite, dans la fenêtre', await ev(() => { const r = document.querySelector('#telephone .tel-screen').getBoundingClientRect(); return r.left > 720 && r.right <= 1440 && r.top >= 0 && r.bottom <= 900 && Math.abs(r.height - 740) < 2; }));
T.check('accueil : les trois familles Le car, Cours, Réglages', await ev(() => [...document.querySelectorAll('#telephone .tel-fam h3')].map((h) => h.textContent).join(',') === 'Le car,Cours,Réglages'));
T.check('applications : aller à, missions, Olivier, plan, synoptiques, matériel, Cours, progression, réglages', await ev(() => ['aller', 'missions', 'olivier', 'plan', 'synoptiques', 'materiel', 'cours', 'glossaire', 'postes', 'progression', 'reglages', 'commandes'].every((a) => window.__dbg.tel.state().apps.includes(a))));
T.check('accueil : l\'objectif en cours et le niveau', await ev(() => !!document.querySelector('#telephone .tel-goal b')?.textContent && !!document.querySelector('#telephone .tel-lvl .pcard')));
T.check('barre d\'état : l\'heure du car', await ev(() => /^\d\d:\d\d$/.test(document.querySelector('#telephone .tel-time')?.textContent || '')));
T.check('le focus est sur la première application, les flèches le déplacent', await ev(() => document.activeElement?.dataset.app === 'aller') && (await page.keyboard.press('ArrowRight'), await ev(() => document.activeElement?.dataset.app === 'missions')));
await shot('02-accueil');
await page.keyboard.press('Escape');
T.check('Échap range le téléphone', await rangé());

// ---------------- les applications ----------------
await page.keyboard.press('Tab'); await levé();
await page.locator('#telephone .tel-app[data-app="plan"]').click();
T.check('Plan caméras : le téléphone se range, le plan s\'ouvre', await until(page, () => window.__dbg.S.mode === 'plan', null, 10000) && await rangé());
await page.keyboard.press('Escape');
await until(page, () => window.__dbg.S.mode === 'fps', null, 6000);
await page.keyboard.press('Tab'); await levé();
await page.locator('#telephone .tel-app[data-app="missions"]').click();
T.check('Missions : le journal des missions', await until(page, () => /Journal des missions/.test(document.querySelector('#modal h2')?.textContent || ''), null, 6000));
await page.keyboard.press('Escape');
await page.keyboard.press('Tab'); await levé();
await page.locator('#telephone .tel-app[data-app="progression"]').click();
T.check('Progression : sur l\'écran du téléphone (niveau, suivi, livret)', await until(page, () => window.__dbg.tel.state().app === 'progression' && document.querySelectorAll('#telephone .tel-row').length >= 3, null, 4000));
await shot('03-progression');
await page.keyboard.press('Escape');
T.check('Échap dans une application : retour à l\'accueil du téléphone', await until(page, () => { const s = window.__dbg.tel.state(); return s.open && s.app === ''; }, null, 3000));
await page.keyboard.press('KeyP');
T.check('un raccourci (P) range le téléphone et ouvre le plan', await until(page, () => window.__dbg.S.mode === 'plan', null, 10000) && await rangé());
await page.keyboard.press('Escape');
await until(page, () => window.__dbg.S.mode === 'fps', null, 6000);

// ---------------- aller à un poste ----------------
await page.keyboard.press('Tab'); await levé();
await page.locator('#telephone .tel-app[data-app="aller"]').click();
T.check('Aller à : plan du car, postes par zone, stade', await until(page, () => window.__dbg.tel.state().app === 'aller' && !!document.querySelector('#telephone .tel-plan svg') && document.querySelectorAll('#telephone .tel-sec').length >= 5, null, 4000));
await shot('04-aller');
await page.locator('#telephone .tel-row', { hasText: 'Truquiste' }).first().click();
T.check('« Truquiste » : poste Mélangeur ouvert, téléphone rangé', await until(page, () => window.__dbg.S.mode === 'station' && window.__dbg.S.station === 'melangeur', null, 30000) && await rangé());
T.check('en-tête du poste : bouton Téléphone, plus de Missions ni de Chef de car', await ev(() => !!document.querySelector('#station .st-tel') && !document.querySelector('#station .st-missions') && !document.querySelector('#station .st-head .chef-btn')));
await page.locator('#station .st-tel').click();
T.check('au poste : le téléphone par-dessus le poste', await levé() && await ev(() => window.__dbg.S.mode === 'station'));
await shot('05-poste');
await page.keyboard.press('Tab');
T.check('Tab range le téléphone, le poste reste ouvert', await rangé() && await ev(() => window.__dbg.S.mode === 'station'));
await page.keyboard.press('Escape');

// ---------------- car pré-installé : jeu libre ----------------
const libre = await openPage(browser, { errors: T.errors, viewport: { width: 1280, height: 800 } });
await libre.evaluate(() => window.__dbg.start('installe', 'jour', 'basse', false));
await until(libre, () => window.__dbg.S.mode === 'fps', null, 60000);
await libre.evaluate(() => { window.__dbg.S.modeCar = 'libre'; window.__dbg.tel.open(); });
T.check('car pré-installé : ni Missions ni Olivier dans le téléphone', await levé(libre) && await libre.evaluate(() => { const a = window.__dbg.tel.state().apps; return !a.includes('missions') && !a.includes('olivier') && a.includes('aller'); }));
await libre.close();

// ---------------- petit écran tactile ----------------
const m = await openPage(browser, { viewport: { width: 400, height: 760 }, query: 'lite&nopost', errors: T.errors, mobile: true });
await m.evaluate(() => window.__dbg.start('installe', 'jour', 'basse', false));
await until(m, () => window.__dbg.S.mode === 'fps', null, 60000);
await m.locator('#tb-tel').tap();
T.check('mobile : le bouton Téléphone le lève, il tient dans la fenêtre', await levé(m) && await m.evaluate(() => { const r = document.querySelector('#telephone .tel-screen').getBoundingClientRect(); return r.left >= 0 && r.right <= 400 && r.top >= 0 && r.bottom <= 760 && document.documentElement.scrollWidth <= 400; }));
await shot('06-mobile', m);
await m.mouse.click(8, 8);
T.check('mobile : toucher à côté range le téléphone', await rangé(m));
await T.finish();
