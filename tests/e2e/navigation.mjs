// Navigation entre les espaces : écran titre (Jouer, Cours, S'entraîner, Espace formateur), Cours
// plein écran par-dessus le titre et dans le car, S'entraîner qui lance le car et le parcours du
// chef, menu du car (Échap), boutons « Emmène-moi », touche G dans un poste, pupitre, changement
// de vacation (le simulateur se recharge et lance la vacation demandée), téléphone.
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
T.check('écran titre prêt : Jouer, Cours, S\'entraîner, Espace formateur, Réglages, Crédits', await until(page, () => document.getElementById('title').classList.contains('ready') && ['ti-play', 'ti-cours', 'ti-train', 'ti-trainer', 'ti-settings', 'ti-credits'].every((id) => !document.getElementById(id).disabled), null, 60000));
await shot('01-titre');

// Cours par-dessus le titre : notions, chapitres, glossaire, postes, matériel
await page.locator('#ti-cours').click();
T.check('Cours ouvert par-dessus le titre, fiche SDI', await layer('cours') && await ev(() => /SDI/.test(document.querySelector('#layer .co-fiche h2')?.textContent || '') && !document.getElementById('title').hidden));
await shot('02-cours');
await page.locator('#layer .ly-tabs .tab[data-k="chapitres"]').click();
T.check('Chapitres : tous les chapitres du guide, par famille', await ev(() => document.querySelectorAll('#layer [data-g]').length >= 24 && document.querySelectorAll('#layer .co-theme').length >= 5));
await page.locator('#layer [data-g="reseau"]').click();
T.check('chapitre réseau : boutons « ? » et lexique', await until(page, () => !!document.querySelector('#layer .prose .q[data-term="spine"]'), null, 4000));
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

// S'entraîner : parcours par famille, exercices, missions ; « Commencer » lance le car et le parcours
await page.locator('#ti-train').click();
T.check('S\'entraîner : familles de parcours du chef', await layer('entrainement') && await ev(() => document.querySelectorAll('#layer .tr-fam').length >= 8 && document.querySelectorAll('#layer [data-lesson]').length >= 40));
await shot('03-entrainement');
await page.locator('#layer .ly-tabs .tab[data-k="exercices"]').click();
T.check('exercices notés : cinq exercices avec leur suivi', await ev(() => document.querySelectorAll('#layer .tr-ex').length === 5 && document.querySelectorAll('#layer .tr-status').length === 5));
await page.locator('#layer .ly-tabs .tab[data-k="missions"]').click();
T.check('missions d\'installation : la liste', await ev(() => document.querySelectorAll('#layer .item .dot').length >= 18));
await page.locator('#layer .ly-tabs .tab[data-k="livret"]').click();
T.check('« Mon livret » : les quatre blocs du référentiel', await until(page, () => document.querySelectorAll('#layer .lv-card').length === 4 && document.querySelectorAll('#layer .lv-comp').length >= 30, null, 4000));
await shot('03b-livret');
await page.locator('#layer .ly-tabs .tab[data-k="parcours"]').click();
await page.locator('#layer [data-lesson="chef-lineup"]').click();
T.check('« Commencer » depuis le titre : car lancé, parcours du chef ouvert', await until(page, () => window.__dbg.S.mode === 'fps' && window.__dbg.TUTOR.lesson?.id === 'chef-lineup' && !document.getElementById('layer') && document.getElementById('title').hidden && !document.querySelector('#chef').hidden, null, 90000));
await ev(() => { window.__dbg.stopChefLesson(); window.__dbg.toggleChef(false); });

// ---------------- dans le car ----------------
T.check('barre d\'outils : Pupitre, Chef de car, Cours, Son, Menu', await ev(() => [...document.querySelectorAll('#toolbar .tbtn')].map((b) => b.id).join(',') === 'tb-pupitre,tb-chef,tb-cours,tb-son,tb-menu'));
await page.keyboard.press('Escape');
T.check('Échap : le menu du car, dix touches', await until(page, () => !!document.querySelector('#modal .mn') && document.querySelectorAll('#modal .mn-key').length === 10, null, 4000));
await shot('04-menu');
await page.locator('#mn-son').click();
T.check('menu : le son se coupe', await ev(() => window.__dbg.AU.muted && document.getElementById('mn-son').getAttribute('aria-pressed') === 'false'));
await page.locator('#mn-son').click();
await page.locator('#mn-resume').click();
T.check('« Reprendre » ferme le menu', await ev(() => document.getElementById('modal').hidden));
await page.locator('#tb-menu').click();
await page.locator('#mn-cours').click();
T.check('menu → Cours', await layer('cours') && await ev(() => document.getElementById('modal').hidden));
await page.locator('#layer .btn', { hasText: 'Emmène-moi' }).first().click();
T.check('« Emmène-moi » de la fiche SDI : poste Baie de brassage', await until(page, () => window.__dbg.S.mode === 'station' && window.__dbg.S.station === 'brassage' && !document.getElementById('layer'), null, 30000));
await page.keyboard.press('KeyG');
T.check('touche G dans un poste : le Cours', await layer('cours'));
await page.keyboard.press('Escape');
T.check('Échap : le Cours se ferme, le poste reste ouvert', await noLayer() && await ev(() => window.__dbg.S.mode === 'station'));
await page.locator('#station .st-tools .btn', { hasText: 'Cours' }).click();
T.check('bouton « Cours » du poste', await layer('cours'));
await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
await until(page, () => window.__dbg.S.mode === 'fps', null, 8000);
await page.keyboard.press('Tab');
T.check('pupitre : Cours et S\'entraîner parmi les outils', await until(page, () => ['Cours', 'S\'entraîner'].every((t) => [...document.querySelectorAll('#modal .dkey.tool')].some((b) => b.textContent.includes(t))), null, 6000));
await page.locator('#modal .dkey.tool', { hasText: 'S\'entraîner' }).click();
T.check('pupitre → S\'entraîner', await layer('entrainement'));
// changer de vacation en cours de partie : confirmation, rechargement, la vacation se lance
await page.locator('#layer .ly-tabs .tab[data-k="exercices"]').click();
await page.locator('#layer .tr-ex .btn', { hasText: 'Monter une caméra' }).click();
T.check('changer de vacation : confirmation demandée', await until(page, () => !!document.querySelector('#ask'), null, 4000));
await shot('05-changer');
await page.locator('#ask [data-ask="ok"]').click();
await page.waitForFunction(() => !window.__dbg, null, { timeout: 30000, polling: 200 }).catch(() => {});
await page.waitForFunction('!!window.__dbg', null, { timeout: 180000, polling: 200 });
T.check('après rechargement : l\'atelier de montage est lancé', await until(page, () => window.__dbg.S.mode === 'fps' && window.__dbg.S.preset === 'atelier' && document.getElementById('title').hidden, null, 90000));

// ---------------- feuille de service et téléphone ----------------
await page.reload();
await page.waitForFunction('!!window.__dbg', null, { timeout: 180000, polling: 200 });
await until(page, () => document.getElementById('title').classList.contains('ready'), null, 60000);
await page.locator('#ti-play').click();
T.check('feuille de service : liens Cours et S\'entraîner, plus d\'Espace formateur ni de relecture', await ev(() => !!document.getElementById('st-cours') && !!document.getElementById('st-train') && ![...document.querySelectorAll('#start button')].some((b) => /Espace formateur|Relecture technique/.test(b.textContent))));
await page.locator('#st-cours').click();
T.check('feuille → Cours', await layer('cours'));
await page.keyboard.press('Escape');
await page.setViewportSize({ width: 390, height: 844 });
for (const k of ['cours', 'entrainement']) {
  await ev((x) => window.__dbg.emit(x), k);
  await layer(k); await page.waitForTimeout(400);
  T.check(`téléphone : ${k} sans défilement horizontal`, await ev(() => document.querySelector('#layer .ly-scroll').scrollWidth <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1));
  await shot('06-tel-' + k);
  await page.keyboard.press('Escape');
}
await T.finish();
