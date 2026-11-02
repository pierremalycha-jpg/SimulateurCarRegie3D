// L'interface épurée (v19.22) : un seul accent bleu, plus de néon ni de coin coupé, verre dépoli à grands
// rayons, Archivo partout sans capitales espacées, des textes courts. Les écrans principaux sont capturés
// pour relecture : écran titre, Jouer, HUD, menu du car, téléphone, Olivier, Cours, Réglages.
// node tests/e2e/epure.mjs [dossier]
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('epure');
const T = reporter();
const browser = await launch();
const page = await openPage(browser, { errors: T.errors, title: true, fresh: true });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 500) => { await page.waitForTimeout(w); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const css = (sel, prop) => ev(([s, p]) => { const e = document.querySelector(s); return e ? getComputedStyle(e)[p] : null; }, [sel, prop]);
const radius = async (sel) => parseFloat(await css(sel, 'borderTopLeftRadius')) || 0;

// ---------------- écran titre ----------------
await until(page, () => document.getElementById('title').classList.contains('ready'), null, 60000);
T.check('écran titre : le nom, trois entrées, ni moniteur à mire, ni balayage, ni bandeau', await ev(() => document.querySelectorAll('#title .ti-key').length === 3 && !document.querySelector('#title .ti-mon') && !document.querySelector('#title .ti-bg') && !document.querySelector('#title .ti-kicker') && /BTS Audiovisuel de Saint-Quentin/.test(document.getElementById('title').textContent)));
T.check('touches en minuscules, grandes et arrondies', (await css('#ti-play', 'textTransform')) === 'none' && (await radius('#ti-play')) >= 12 && parseFloat(await css('#ti-play b', 'fontSize')) >= 18);
T.check('police de base : 15 px, Archivo (plus d\'Archivo Narrow dans l\'interface)', parseFloat(await css('body', 'fontSize')) >= 15 && /Archivo/.test(await css('body', 'fontFamily')) && !/Narrow/.test(await css('#ti-name', 'fontFamily')));
T.check('l\'entrée principale est bleue (plus de néon cyan)', await ev(() => { const c = getComputedStyle(document.getElementById('ti-play')).backgroundColor.match(/\d+/g).map(Number); return c[2] > c[0] && c[2] > 200 && c[1] < 200; }));
await shot('01-titre');

// ---------------- Jouer ----------------
await ev(() => window.__dbg.title.enter('start'));
T.check('Jouer : cartes de mode en une ligne (moins de 90 caractères), l\'explication complète sur la touche de lancement', await ev(() => [...document.querySelectorAll('#start .jo-mode span')].every((s) => s.textContent.length < 90) && document.querySelector('#st-antenne span:last-child').textContent.length > 90));
T.check('la touche de lancement : grands rayons, pas de coin coupé', (await radius('#st-antenne')) >= 16 && (await css('#st-antenne', 'clipPath')) === 'none');
T.check('plus de numéro décoratif sur les étapes ni de bloc « affiche » en verre', await ev(() => [...document.querySelectorAll('#start .jo-n')].every((n) => getComputedStyle(n).display === 'none') && !document.querySelector('#start .dk-match.glass') && /RC Lens/.test(document.querySelector('#start .dk-match')?.textContent || '')));
await shot('02-jouer');

// ---------------- le HUD ----------------
await ev(() => window.__dbg.start('zero', 'jour', 'basse', false));
await until(page, () => window.__dbg.S.mode === 'fps', null, 20000);
T.check('HUD : barre d\'outils et bande d\'état en pilules de verre, sans touches clavier affichées', (await radius('#toolbar')) >= 20 && (await radius('#statusbar')) >= 20 && await ev(() => [...document.querySelectorAll('#toolbar .tbtn kbd')].every((k) => getComputedStyle(k).display === 'none')));
T.check('suivi des tâches : carte arrondie sans coin coupé, titre en minuscules', await until(page, () => !document.getElementById('quest').hidden, null, 8000) && (await radius('#quest')) >= 16 && (await css('#quest', 'clipPath')) === 'none' && (await css('#quest .q-title', 'textTransform')) === 'none');
T.check('vignette discrète (au plus 25 % de noir dans les angles)', await ev(() => /rgba\(0, 0, 0, 0\.(1|2)\d*\) 100%/.test(getComputedStyle(document.getElementById('vignette')).backgroundImage)));
await shot('03-hud', 1500);

// ---------------- le menu du car ----------------
await page.keyboard.press('Escape');
T.check('menu du car : des lignes alignées à gauche (icône, texte, touche), « Reprendre » en accent', await until(page, () => !document.getElementById('modal').hidden && !!document.querySelector('#mn-resume'), null, 4000) && await ev(() => { const cs = getComputedStyle(document.getElementById('mn-resume')); return cs.textAlign === 'left' && cs.gridTemplateColumns.split(' ').length === 3 && cs.clipPath === 'none'; }));
T.check('fenêtre : verre dépoli à grands rayons', (await radius('#modal .sheet')) >= 16 && /blur/.test((await css('#modal .sheet', 'backdropFilter')) || ''));
await shot('04-menu');
await page.keyboard.press('Escape');

// ---------------- le téléphone ----------------
await page.locator('#tb-tel').click();
await until(page, () => window.__dbg.tel.state().open && window.__dbg.tel.state().t >= 1, null, 8000);
T.check('téléphone : icônes arrondies, noms en minuscules', (await radius('#telephone .tel-ico')) >= 14 && (await css('#telephone .tel-name', 'textTransform')) === 'none');
await shot('05-telephone');
await page.keyboard.press('Escape');

// ---------------- Olivier ----------------
await ev(() => window.__dbg.emit('chef'));
T.check('Olivier : boîte de dialogue arrondie, nom en minuscules', await until(page, () => !document.getElementById('chef').hidden, null, 5000) && (await radius('#chef')) >= 16 && (await css('#chef .chef-who b', 'textTransform')) === 'none');
await shot('06-olivier', 800);
await ev(() => window.__dbg.toggleChef(false));

// ---------------- le Cours ----------------
await ev(() => window.__dbg.emit('cours'));
T.check('Cours : onglets en contrôle segmenté, introduction courte', await until(page, () => !!document.querySelector('#layer.ly-cours'), null, 6000) && await ev(() => { const t = document.querySelector('#layer .ly-tabs'); const lede = document.querySelector('#layer .co-page .lede'); return parseFloat(getComputedStyle(t).borderTopLeftRadius) >= 8 && !!lede && lede.textContent.length < 160; }));
await shot('07-cours', 800);
await page.keyboard.press('Escape');

// ---------------- Réglages ----------------
await ev(() => window.__dbg.emit('settings'));
T.check('Réglages : groupes arrondis, notes courtes', await until(page, () => !!document.querySelector('#modal .rg-sec'), null, 4000) && (await radius('#modal .rg-sec')) >= 12 && await ev(() => [...document.querySelectorAll('#modal .rg-sec > .note')].every((n) => n.textContent.length < 220)));
await shot('08-reglages', 500);
await page.keyboard.press('Escape');

// ---------------- partout ----------------
T.check('aucun coin coupé', await ev(() => [...document.querySelectorAll('.sheet, .btn, .quest, .toolbar, .statusbar, .pcard, .mn-key, .ti-key, .jo-mode, .lx, .chef')].every((e) => getComputedStyle(e).clipPath === 'none')));
T.check('les touches ne sont plus en capitales', await ev(() => [...document.querySelectorAll('.btn')].slice(0, 40).every((b) => getComputedStyle(b).textTransform === 'none')));
await T.finish();
