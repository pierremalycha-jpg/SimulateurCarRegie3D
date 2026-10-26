// L'interface « jeu » (v19.2) : écran titre avec la carte joueur, objectif à l'écran (mission du
// mode Tout à faire, exercice d'Olivier, repère 3D), journal des missions (touche L, bouton
// Missions), XP, niveaux, bannière de niveau, badges, réglages du jeu (bruitages, objectif),
// menu du car avec la carte joueur, et la progression enregistrée.
// node tests/e2e/jeu.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('jeu');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { errors: T.errors, title: true, fresh: true });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 600) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); };

// ---------------- écran titre ----------------
await until(page, () => document.getElementById('title').classList.contains('ready'), null, 60000);
T.check('écran titre : trois touches, carte joueur niveau 1, conseil d\'Olivier', await ev(() => document.querySelectorAll('#title .ti-key').length === 3 && /Niveau/.test(document.querySelector('#ti-player .pcard')?.textContent || '') && document.querySelector('#ti-player .pc-lvl b')?.textContent === '1' && !!document.getElementById('ti-tip')?.textContent));
await shot('01-titre');
await ev(() => window.__dbg.title.enter('start'));
T.check('écran Jouer : la carte joueur au-dessus de la touche de lancement', await ev(() => !!document.querySelector('#start .jo-side .pcard') && !!document.getElementById('st-antenne')));
await shot('02-jouer');

// ---------------- Tout à faire : l'objectif et le repère ----------------
await ev(() => window.__dbg.start('zero', 'jour', 'basse', false));
await until(page, () => window.__dbg.S.mode === 'fps', null, 20000);
T.check('objectif à l\'écran : la mission 1 du mode Tout à faire, sans « null »', await until(page, () => { const q = document.getElementById('quest'); return !!q && !q.hidden && /Installation du car/.test(q.textContent) && /Le compound/.test(q.textContent) && /Mission 1 \/ 22/.test(q.textContent) && !/null/.test(q.textContent); }, null, 8000));
T.check('l\'ancienne carte de mission est masquée', await ev(() => { const m = document.getElementById('mission'); return !m || getComputedStyle(m).display === 'none'; }));
T.check('barre d\'XP : niveau 1, 0 XP', await ev(() => document.querySelector('#xpbar .xp-lvl b')?.textContent === '1' && /0 \/ 120 XP/.test(document.querySelector('#xpbar .xp-txt')?.textContent || '')));
T.check('repère 3D sur le pied de car, avec sa distance', await until(page, () => { const m = document.getElementById('qmark'); return !!m && !m.hidden && /compound/i.test(m.textContent) && /\d+ m/.test(m.textContent); }, null, 8000));
T.check('barre d\'outils : le téléphone (Tab), qui contient les Missions', await ev(() => document.querySelector('#toolbar #tb-tel kbd')?.textContent === 'Tab' && !document.querySelector('#toolbar #tb-missions')));
T.check('HUD épuré à l\'arrivée : objectif (avec le lieu), barre d\'outils (niveau compris), bande d\'état à trois cases, retour PGM, prise en main sur une ligne ; ni bandeau de lieu, ni PVW, ni i/s, ni toast, ni mini-plan', await ev(() => {
  const vis = (s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.offsetParent !== null; };
  return vis('#quest') && /Compound/i.test(document.querySelector('#quest .q-where')?.textContent || '') && vis('#toolbar') && vis('#toolbar #xpbar') && document.querySelectorAll('#statusbar .chip:not([hidden])').length === 3 && !document.querySelector('#statusbar .chip.fps') && vis('#minimon') && vis('#onboard') && document.querySelectorAll('#onboard li').length >= 5 && !vis('.brand') && !vis('#toast') && !vis('#truckmap') && !document.querySelector('#statusbar .chip.green'); }));
await shot('03-objectif');

// ---------------- le journal des missions (L) ----------------
await page.keyboard.press('KeyL');
T.check('L : le journal des missions, carte joueur, objectif en cours, installation du car, toutes les missions par chapitre, badges', await until(page, () => { const m = document.getElementById('modal'); return !m.hidden && !!m.querySelector('.qj .pcard') && /Objectif en cours/i.test(m.textContent) && m.querySelectorAll('.qj-missions li').length === 22 && m.querySelectorAll('.qj-chap').length >= 8 && m.querySelectorAll('.qj-list .qj-row').length >= 1 && m.querySelectorAll('.badges .badge').length >= 50; }, null, 6000));
T.check('chaque exercice annonce son XP et a « Commencer » et « Leçon »', await ev(() => [...document.querySelectorAll('#modal .qj-list .qj-row')].every((r) => /\d+ XP/.test(r.querySelector('.qj-xp')?.textContent || '') && !!r.querySelector('.btn') && !!r.querySelector('.linkbtn'))));
await shot('04-journal');
await page.locator('#modal .qj-chap[data-ch="sdi"]').click();
T.check('chapitre Le SDI : ses exercices', await until(page, () => document.querySelectorAll('#modal .qj-list .qj-row[data-exercise]').length >= 3 && !!document.querySelector('#modal .qj-row[data-exercise="x-brassage"]'), null, 3000));
await page.keyboard.press('Escape');
T.check('Échap referme le journal', await until(page, () => document.getElementById('modal').hidden, null, 3000));
await page.locator('#tb-tel').click();
await page.locator('#telephone .tel-app[data-app="missions"]').click();
T.check('application Missions du téléphone : le journal s\'ouvre aussi', await until(page, () => !document.getElementById('modal').hidden && !!document.querySelector('#modal .qj'), null, 3000));
await page.keyboard.press('Escape');

// ---------------- XP, niveau, badges ----------------
const r = await ev(() => { const a = window.__dbg.jeu.XP.award({ pts: 30, label: 'Test' }); return { pts: a.pts, total: a.total, leveled: a.leveled, keys: Object.keys(window.__dbg.PROG.game.keys).length }; });
T.check('une récompense : +30 XP, barre mise à jour', r.pts === 30 && r.total >= 30 && await until(page, () => /\d+ \/ 120 XP/.test(document.querySelector('#xpbar .xp-txt')?.textContent || '') && !!document.querySelector('#xpbar .xp-float'), null, 3000));
const lv = await ev(() => window.__dbg.jeu.XP.award({ pts: 100, label: 'Niveau' }));
T.check('passage au niveau 2 : bannière « Assistant technique », bruitage sans erreur', lv.leveled && lv.level.n === 2 && await until(page, () => { const b = document.getElementById('banner'); return !!b && !b.hidden && /Assistant technique/.test(b.textContent) && document.querySelector('#xpbar .xp-lvl b')?.textContent === '2'; }, null, 3000));
await shot('05-niveau');
await ev(() => window.__dbg.openStation('melangeur'));
await until(page, () => window.__dbg.S.mode === 'station', null, 10000);
T.check('premier poste ouvert : +5 XP de découverte et le badge « Premiers pas »', await until(page, () => !!window.__dbg.PROG.game.keys['poste:melangeur'] && !!window.__dbg.PROG.game.badges['premier-pas'], null, 6000));
T.check('bannière de badge', await until(page, () => { const b = document.getElementById('banner'); return !!b && !b.hidden && /Premiers pas/.test(b.textContent); }, null, 5000));
await page.locator('#station .st-tel').click();
await until(page, () => window.__dbg.tel.state().open, null, 5000);
await page.locator('#telephone .tel-app[data-app="missions"]').click();
T.check('au poste (téléphone, application Missions, L étant le volet logo du mélangeur) : « Ici, au poste » avec les exercices du mélangeur, badge gagné en or/bronze', await until(page, () => { const m = document.getElementById('modal'); return !m.hidden && /Ici, au poste/.test(m.textContent) && !!m.querySelector('.qj-row[data-exercise="melangeur-commuter"]') && !!m.querySelector('.badge.won'); }, null, 5000));
await shot('06-journal-poste');
// « Commencer » depuis le journal : l'exercice d'Olivier démarre et l'objectif le suit
await page.locator('#modal .qj-row[data-exercise="melangeur-commuter"] .btn').click();
T.check('« Commencer » : exercice lancé, objectif « Exercice · étape 1 », chef de car ouvert', await until(page, () => window.__dbg.TUTOR.lesson?.id === 'melangeur-commuter' && /Exercice/.test(document.getElementById('quest')?.textContent || '') && /Étape 1/.test(document.getElementById('quest')?.textContent || '') && !document.getElementById('chef').hidden, null, 8000));
await ev(() => { window.__dbg.stopChefLesson(); window.__dbg.toggleChef(false); });
await ev(() => window.__dbg.closeStation());

// ---------------- le menu et les réglages ----------------
await page.keyboard.press('Escape');
T.check('menu du car : la carte joueur en tête, puis les quatre touches', await until(page, () => !!document.querySelector('#modal .mn .pcard') && [...document.querySelectorAll('#modal .mn-key')].map((b) => b.id).join(',') === 'mn-resume,mn-cours,mn-reglages,mn-home', null, 4000));
await shot('07-menu');
await page.locator('#mn-reglages').click();
T.check('Réglages : rubrique Jeu (bruitages, volume, objectif, repère)', await until(page, () => /Bruitages/.test(document.querySelector('#modal .rg')?.textContent || '') && !!document.querySelector('#modal .seg[aria-label="Objectif à l\'écran"]') && !!document.querySelector('#modal input[type=range]'), null, 4000));
await page.locator('#modal .seg[aria-label="Objectif à l\'écran"] button[data-v="0"]').click();
await page.keyboard.press('Escape');
T.check('objectif masqué par le réglage', await until(page, () => document.getElementById('quest').hidden, null, 3000));
await ev(() => window.__dbg.jeu.renderQuest && window.__dbg.emit('settings'));
await page.locator('#modal .seg[aria-label="Objectif à l\'écran"] button[data-v="1"]').click();
await page.keyboard.press('Escape');
T.check('objectif de nouveau affiché', await until(page, () => !document.getElementById('quest').hidden, null, 3000));
T.check('progression enregistrée (XP, badges) dans le navigateur', await until(page, () => { try { const p = JSON.parse(localStorage.getItem('carregie.progress') || '{}'); return !!(p.game && p.game.badges && p.game.badges['premier-pas'] && Object.keys(p.game.keys).length >= 1); } catch (e) { return false; } }, null, 6000));

// ---------------- téléphone ----------------
const m = await openPage(browser, { viewport: { width: 400, height: 860 }, query: 'lite&nopost', errors: T.errors, mobile: true });
await m.evaluate(() => window.__dbg.start('zero', 'jour', 'basse', false));
await until(m, () => window.__dbg.S.mode === 'fps', null, 20000);
T.check('téléphone : objectif et barre d\'XP visibles sans débordement', await until(m, () => { const q = document.getElementById('quest'), x = document.getElementById('xpbar'); if (!q || q.hidden || !x) return false; const a = q.getBoundingClientRect(), b = x.getBoundingClientRect(); return a.right <= 400 && b.right <= 400 && document.documentElement.scrollWidth <= 400; }, null, 10000));
await m.waitForTimeout(500); await m.screenshot({ path: `${OUT}/08-mobile.png` });
await T.finish();
