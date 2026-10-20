// Compatibilité des navigateurs : un parcours court, le même dans Chromium, Firefox et WebKit (le
// moteur de Safari), choisi par E2E_BROWSER. Version à partager ouverte comme un fichier :
// feuille de service, chef de car (touche J, boutons), un poste, puis le diagnostic : erreurs
// signalées à l'écran (écouteur d'événement, boucle de rendu, erreur non rattrapée) sans arrêter
// le simulateur, et écran de secours quand le programme ne peut pas démarrer.
// E2E_BROWSER=webkit node tests/e2e/navigateurs.mjs [dossier]
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, openPage, outDir, until, reporter, simHtml, BROWSER } from './harness.mjs';
const OUT = outDir('navigateurs');
const T = reporter();
const ROOT = path.resolve(import.meta.dirname, '../..');
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;
const URL_FILE = pathToFileURL(path.join(ROOT, 'dist/Car-regie-3D.html')).href + '?lite';
T.log('navigateur', BROWSER);

const browser = await launch();
// prêt, ou arrêté sur un écran d'explication (WebGL absent, erreur au chargement) : on dit lequel
const page = await openPage(browser, { url: URL_FILE, errors: T.errors, fresh: true, ready: '!!window.__dbg || !!document.querySelector("#err:not([hidden])")' });
const ev = (f, a) => page.evaluate(f, a);
if (!(await ev(() => !!window.__dbg))) {
  await page.waitForTimeout(4000); // le filet du chargement ajoute son diagnostic
  T.check('le simulateur démarre', false, await ev(() => document.getElementById('err').innerText + '\n' + (document.querySelector('#err textarea')?.value || '')));
  await page.screenshot({ path: `${OUT}/${BROWSER}-00-arret.png` });
  await T.finish();
  process.exit();
}
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${BROWSER}-${n}.png`, timeout: 180000 }); T.log('shot', n); };
const chefOpen = () => until(page, () => { const c = document.querySelector('#chef'); return !!c && !c.hidden; }, null, 8000);
const chefClosed = () => until(page, () => { const c = document.querySelector('#chef'); return !c || c.hidden; }, null, 8000);
const chefText = () => ev(() => document.querySelector('#chef')?.textContent || '');

// démarrage : programme prêt, pas d'écran de secours, version affichée
T.check('programme démarré, pas d\'écran de secours', await ev(() => !!window.__carReady && document.getElementById('err').hidden));
T.check('version affichée sur la feuille de service', (await ev(() => document.getElementById('stversion')?.textContent || '')).includes(VERSION));

// chef de car : touche J et bouton de la feuille de service
await page.keyboard.press('KeyJ');
T.check('touche J sur la feuille de service', await chefOpen() && /Prendre l'antenne avec moi/.test(await chefText()));
await page.keyboard.press('KeyJ');
T.check('touche J referme le chef', await chefClosed());
await page.locator('#start .cs-chef .btn').click();
T.check('bouton « Chef de car » de la feuille de service', await chefOpen());
await page.locator('#chef button', { hasText: 'Prendre l\'antenne avec moi' }).click();
T.check('« Prendre l\'antenne avec moi » : car lancé, tour du car', await until(page, () => window.__dbg.S.mode === 'fps' && window.__dbg.TUTOR.lesson?.id === 'prise-en-main', null, 90000));
const f0 = await ev(() => window.__dbg.S.frame);
T.check('le rendu tourne', await until(page, (f) => window.__dbg.S.frame > f + 5, f0, 60000));
await shot('01-partie');

// bouton de la barre d'outils
await page.locator('#tb-chef').click();
T.check('bouton « Chef de car » de la barre : ferme', await chefClosed());
await page.locator('#tb-chef').click();
T.check('bouton « Chef de car » de la barre : rouvre', await chefOpen());

// à un poste, la touche J ouvre le chef sur ce poste
await ev(() => { window.__dbg.stopChefLesson(); window.__dbg.toggleChef(false); window.__dbg.openStation('melangeur'); });
await until(page, () => window.__dbg.S.mode === 'station', null, 30000);
await page.keyboard.press('KeyJ');
T.check('touche J au poste Mélangeur : parcours du poste', await chefOpen() && /Ici, au poste/.test(await chefText()));
await shot('02-poste');
await ev(() => { window.__dbg.toggleChef(false); window.__dbg.closeStation(); });

// diagnostic sans erreur
await ev(() => window.__dbg.diag.openDiag());
const d0 = await ev(() => document.querySelector('#modal .diag-text')?.value || '');
T.check('diagnostic : version, navigateur, chef, aucune erreur', d0.includes(`Version : ${VERSION}`) && /Navigateur : /.test(d0) && /Chef de car : /.test(d0) && /Erreurs : aucune/.test(d0), d0.split('\n').slice(4, 8).join(' | '));
await ev(() => { const x = document.querySelector('#modal .x'); if (x) x.click(); });

// erreurs : un écouteur d'événement, une image de la boucle de rendu, une erreur non rattrapée
await ev(() => { window.__dbg.on('essai-diag', () => { throw new Error('essai : écouteur'); }); window.__dbg.emit('essai-diag'); });
T.check('erreur d\'un écouteur : bandeau à l\'écran', await until(page, () => { const b = document.getElementById('diagbar'); return !!b && !b.hidden && /écouteur/.test(b.textContent); }, null, 5000));
await ev(() => { const c = window.__dbg.S.cams[0]; c.__up = c.update; c.update = () => { throw new Error('essai : image'); }; });
const f1 = await ev(() => window.__dbg.S.frame);
await until(page, () => (window.__dbg.diag.ERRS.find((e) => e.where === 'boucle de rendu')?.n || 0) > 3, null, 60000);
await ev(() => { const c = window.__dbg.S.cams[0]; c.update = c.__up; });
T.check('erreur dans une image : notée une fois, le rendu continue', await until(page, (f) => window.__dbg.S.frame > f + 5, f1, 60000) && (await ev(() => window.__dbg.diag.ERRS.filter((e) => e.where === 'boucle de rendu').length)) === 1);
// lancée par un script de la page (une erreur du code injecté par le test est masquée en « Script error. » par WebKit)
await ev(() => { const sc = document.createElement('script'); sc.textContent = 'setTimeout(function () { throw new Error("essai : non rattrapée"); }, 0);'; document.body.append(sc); });
await until(page, () => window.__dbg.diag.ERRS.some((e) => /non rattrapée/.test(e.msg)), null, 5000);
const d1 = await ev(() => window.__dbg.diag.diagText());
T.check('diagnostic : les trois erreurs, avec leur endroit', /événement « essai-diag »/.test(d1) && /boucle de rendu · essai : image \(×\d+\)/.test(d1) && /non rattrapée/.test(d1), d1.split('\n').filter((l) => /^\d+\./.test(l)).join(' | '));
await page.locator('#diagbar button', { hasText: 'Copier le diagnostic' }).click();
T.check('« Copier le diagnostic » répond', await until(page, () => /Copié|Sélectionné/.test(document.querySelector('#diagbar .btn.primary')?.textContent || ''), null, 5000));
await shot('03-bandeau');
// ces erreurs sont voulues : on les retire du bilan
for (let i = T.errors.length - 1; i >= 0; i--) if (/essai : /.test(T.errors[i])) T.errors.splice(i, 1);

// programme qui ne démarre pas (erreur de syntaxe) : écran de secours avec le diagnostic
const errs2 = [];
const broken = simHtml().replace(/<script type="module">[\s\S]*<\/script>/, '<script type="module">const x = ;</script>');
const p2 = await openPage(browser, { errors: errs2, fresh: true, before: (pg) => pg.route('http://local.test/**', (r) => r.fulfill({ body: broken, contentType: 'text/html' })), ready: '!!document.querySelector("#err:not([hidden]) .boot-diag")' });
const d2 = await p2.evaluate(() => document.querySelector('#err .boot-diag textarea').value);
T.check('écran de secours : diagnostic avec la version et l\'erreur de syntaxe', d2.includes(`Version : ${VERSION}`) && /\[erreur\]/.test(d2), d2.split('\n').slice(6, 10).join(' | '));
await p2.screenshot({ path: `${OUT}/${BROWSER}-04-secours.png` });
await T.finish();
