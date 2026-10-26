// Navigation entre les trois entrées : écran titre (Jouer, Cours, Réglages), Cours en plein écran
// par-dessus le titre et dans le car (sommaire unique, suivi, exercices pratiques des leçons),
// Réglages (profil, espace formateur), « Commencer » un exercice qui lance le car et le chef de car,
// menu du car (Échap), « Aller au poste » depuis une leçon, touche G dans un poste, téléphone,
// changement de vacation (le simulateur se recharge et lance la vacation demandée), téléphone.
// node tests/e2e/navigation.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('navigation');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { errors: T.errors, title: true });
const ev = (f, a) => page.evaluate(f, a);
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
const layer = (kind) => until(page, (k) => !!document.querySelector('#layer.ly-' + k), kind, 6000);
const noLayer = () => until(page, () => !document.getElementById('layer'), null, 4000);

// ---------------- écran titre ----------------
T.check('écran titre prêt : Jouer, Cours, Réglages, rien d\'autre', await until(page, () => document.getElementById('title').classList.contains('ready') && ['ti-play', 'ti-cours', 'ti-settings'].every((id) => { const b = document.getElementById(id); return b && !b.disabled && b.offsetParent; }) && document.querySelectorAll('#title .ti-key').length === 3, null, 60000));
T.check('nom, BTS, logo et mention du développeur', await ev(() => /TIEE Simulator/.test(document.getElementById('ti-name')?.textContent || '') && /BTS Audiovisuel de Saint-Quentin/.test(document.getElementById('title').textContent) && !!document.querySelector('#title img.ti-logo')?.naturalWidth && /Développé par Pierre MALYCHA/.test(document.querySelector('#title .ti-foot')?.textContent || '') && document.title === 'TIEE Simulator'));
await shot('01-titre');

// Cours par-dessus le titre : un seul sommaire (à gauche), le suivi au milieu
await page.locator('#ti-cours').click();
T.check('Cours ouvert par-dessus le titre, sur « Mon parcours »', await layer('cours') && await ev(() => !!document.querySelector('#layer .co-kpis') && !document.getElementById('title').hidden));
T.check('barre du Cours : Leçons, Glossaire, Postes, Matériel', await ev(() => [...document.querySelectorAll('#layer .ly-tabs .tab')].map((t) => t.dataset.k).join(',') === 'lecons,glossaire,postes,materiel'));
T.check('suivi : chapitres, leçons et exercices, à faire ensuite, livret', await ev(() => document.querySelectorAll('#layer .co-ptab tbody tr').length >= 10 && document.querySelectorAll('#layer .co-next-item').length >= 1 && document.querySelectorAll('#layer .co-bloc').length === 4));
await shot('02-cours');
await page.locator('#layer .ly-tabs .tab[data-k="glossaire"]').click();
await page.locator('#glq').fill('genlock');
T.check('glossaire : recherche', await until(page, () => document.querySelectorAll('#layer .item').length >= 1 && document.querySelectorAll('#layer .item').length < 10, null, 3000));
await page.locator('#layer .ly-tabs .tab[data-k="postes"]').click();
await page.locator('#layer .btn', { hasText: 'Voir la fiche' }).first().click();
T.check('fiche d\'un poste par-dessus le Cours', await until(page, () => !document.getElementById('modal').hidden && +getComputedStyle(document.getElementById('modal')).zIndex > +getComputedStyle(document.getElementById('layer')).zIndex, null, 4000));
await page.keyboard.press('Escape');
T.check('Échap : la fiche se ferme, le Cours reste', await until(page, () => document.getElementById('modal').hidden && !!document.getElementById('layer'), null, 3000));
await page.keyboard.press('Escape');
T.check('Échap : le Cours se ferme, l\'écran titre revient', await noLayer() && await ev(() => !document.getElementById('title').hidden));

// Réglages par-dessus le titre : profil, espace formateur (profil Formateur du harnais)
await page.locator('#ti-settings').click();
T.check('Réglages : une fenêtre par-dessus le titre, profil et espace formateur', await until(page, () => !document.getElementById('modal').hidden && !!document.querySelector('#modal .rg') && !!document.getElementById('rg-trainer')?.offsetParent && +getComputedStyle(document.getElementById('modal')).zIndex > +getComputedStyle(document.getElementById('title')).zIndex, null, 4000));
await shot('03-reglages');
await page.locator('#modal .seg[aria-label="Profil"] button[data-v="etudiant"]').click();
T.check('profil Étudiant : l\'espace formateur disparaît des Réglages', await ev(() => !document.getElementById('rg-trainer').offsetParent));
await page.locator('#modal .seg[aria-label="Profil"] button[data-v="formateur"]').click();
await page.keyboard.press('Escape');

// un exercice pratique depuis une leçon : « Commencer » lance le car et le chef de car
await page.locator('#ti-cours').click(); await layer('cours');
await ev(() => window.__dbg.emit('cours', { lesson: 'signal-niveaux' }));
T.check('leçon : section « Exercices pratiques »', await until(page, () => !!document.querySelector('#layer .co-exo[data-exercise="vision-exposition"]'), null, 4000));
await page.locator('#layer .co-exo[data-exercise="vision-exposition"] .btn').click();
T.check('« Commencer » depuis le titre : car lancé, exercice du chef ouvert', await until(page, () => window.__dbg.S.mode === 'fps' && window.__dbg.TUTOR.lesson?.id === 'vision-exposition' && !document.getElementById('layer') && document.getElementById('title').hidden, null, 60000));
T.check('le chef se souvient de la leçon d\'origine', await ev(() => window.__dbg.S.coursBack === 'signal-niveaux'));
await ev(() => { window.__dbg.stopChefLesson(); window.__dbg.toggleChef(false); });

// ---------------- dans le car ----------------
await page.waitForTimeout(600);
T.check('barre d\'outils épurée : niveau, Téléphone, Menu', await ev(() => [...document.querySelectorAll('#toolbar .tbtn')].filter((b) => !b.hidden).map((b) => b.id).join(',') === 'tb-tel,tb-menu' && !!document.querySelector('#toolbar #xpbar')));
await page.keyboard.press('Escape');
T.check('Échap : le menu du car, quatre touches', await until(page, () => !!document.querySelector('#modal .mn') && [...document.querySelectorAll('#modal .mn-key')].map((b) => b.id).join(',') === 'mn-resume,mn-cours,mn-reglages,mn-home', null, 4000));
await shot('04-menu');
await page.locator('#mn-reglages').click();
T.check('menu → Réglages (partie en cours)', await until(page, () => !!document.querySelector('#modal .rg') && /La partie en cours/.test(document.querySelector('#modal .rg').textContent), null, 4000));
await page.keyboard.press('Escape');
await page.locator('#tb-menu').click();
await page.locator('#mn-resume').click();
T.check('« Reprendre » ferme le menu', await ev(() => document.getElementById('modal').hidden));
await page.locator('#tb-menu').click();
await page.locator('#mn-cours').click();
T.check('menu → Cours', await layer('cours') && await ev(() => document.getElementById('modal').hidden));
await ev(() => window.__dbg.emit('cours', { lesson: 'signal-422' }));
await page.locator('#layer .co-car .btn.primary').click();
T.check('« Aller au poste » de la leçon 4:2:2 : poste vision', await until(page, () => window.__dbg.S.mode === 'station' && window.__dbg.S.station === 'vision' && !document.getElementById('layer'), null, 30000));
await page.keyboard.press('KeyG');
T.check('touche G dans un poste : le Cours', await layer('cours'));
await page.keyboard.press('Escape');
T.check('Échap : le Cours se ferme, le poste reste ouvert', await noLayer() && await ev(() => window.__dbg.S.mode === 'station'));
await page.locator('#station .st-tools .btn', { hasText: 'Cours' }).click();
T.check('bouton « Cours » du poste', await layer('cours'));
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await until(page, () => window.__dbg.S.mode === 'fps', null, 8000);
await page.keyboard.press('Tab');
T.check('téléphone : trois familles d\'applications (car, Cours, Réglages)', await until(page, () => [...document.querySelectorAll('#telephone .tel-fam h3')].map((h) => h.textContent).join(',') === 'Le car,Cours,Réglages', null, 6000));
await page.locator('#telephone .tel-app[data-app="glossaire"]').click();
T.check('téléphone → glossaire du Cours', await layer('cours') && await ev(() => !!document.querySelector('#layer .ly-tabs .tab.on[data-k="glossaire"]')));
// changer de vacation en cours de partie : un exercice noté de la leçon, confirmation, rechargement
await ev(() => window.__dbg.emit('cours', { lesson: 'sdi-cable' }));
await page.locator('#layer .co-exo[data-exercise="x-brassage"] .btn').click();
T.check('changer de vacation : confirmation demandée', await until(page, () => !!document.querySelector('#ask'), null, 4000));
await shot('05-changer');
await page.locator('#ask [data-ask="ok"]').click();
await page.waitForFunction(() => !window.__dbg, null, { timeout: 30000, polling: 200 }).catch(() => {});
await page.waitForFunction('!!window.__dbg', null, { timeout: 180000, polling: 200 });
T.check('après rechargement : le car vide est lancé (baie de brassage ouverte)', await until(page, () => window.__dbg.S.mode !== 'start' && window.__dbg.S.preset === 'brassage' && document.getElementById('title').hidden, null, 90000));

// ---------------- écran Jouer et téléphone ----------------
await page.reload();
await page.waitForFunction('!!window.__dbg', null, { timeout: 180000, polling: 200 });
await until(page, () => document.getElementById('title').classList.contains('ready'), null, 60000);
await page.locator('#ti-play').click();
T.check('Jouer : trois lieux (car, entrepôt, concert), trois modes, solo ou coopération, conditions repliées', await ev(() => [...document.querySelectorAll('#start .jo-lieux .lx')].map((b) => b.dataset.lieu).join(',') === 'car,entrepot,concert' && [...document.querySelectorAll('#start .jo-mode')].map((b) => b.dataset.mode).join(',') === 'zero,installe,mission' && document.querySelectorAll('#start .jo-team-seg button').length === 2 && !document.querySelector('#start details.jo-capt').open));
T.check('Jouer : liens Menu principal, Cours, Réglages', await ev(() => ['st-menu', 'st-cours', 'st-reglages'].every((id) => document.getElementById(id)?.offsetParent)));
await page.locator('.jo-team-seg button[data-v="coop"]').click();
T.check('coopération : car pré-installé seulement', await ev(() => document.querySelector('.jo-mode[data-mode="zero"]').disabled && document.querySelector('.jo-mode[data-mode="mission"]').disabled && document.querySelector('.jo-mode[data-mode="installe"]').getAttribute('aria-pressed') === 'true'));
await page.locator('.jo-team-seg button[data-v="solo"]').click();
await page.locator('#st-cours').click();
T.check('Jouer → Cours', await layer('cours'));
await page.keyboard.press('Escape');
await page.setViewportSize({ width: 390, height: 844 });
await ev(() => window.__dbg.emit('cours'));
await layer('cours'); await page.waitForTimeout(400);
T.check('téléphone : Cours sans défilement horizontal', await ev(() => document.querySelector('#layer .ly-scroll').scrollWidth <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1));
await shot('06-tel-cours');
await page.keyboard.press('Escape');
T.check('téléphone : Jouer sans défilement horizontal', await ev(() => document.getElementById('start').scrollWidth <= innerWidth + 1));
await shot('07-tel-jouer');
await T.finish();
