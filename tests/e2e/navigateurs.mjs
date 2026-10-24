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
const URL_FILE = pathToFileURL(path.join(ROOT, 'dist/TIEE-Simulator.html')).href + '?lite';
T.log('navigateur', BROWSER);

const browser = await launch();
// prêt, ou arrêté sur un écran d'explication (WebGL absent, erreur au chargement) : on dit lequel
const page = await openPage(browser, { url: URL_FILE, errors: T.errors, fresh: true, title: true, ready: '!!window.__dbg || !!document.querySelector("#err:not([hidden])")' });
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

// écran titre : affiché au chargement, menu allumé quand tout est prêt, entrée et retour
T.check('écran titre : chargement terminé, menu allumé', await until(page, () => { const t = document.getElementById('title'); return !!t && !t.hidden && t.classList.contains('ready') && !document.getElementById('ti-play').disabled && /100/.test(document.getElementById('ti-pct').textContent); }, null, 30000));
await page.locator('#ti-play').click();
T.check('« Jouer » : feuille de service, touche Antenne prête', await until(page, () => document.getElementById('title').hidden && document.activeElement?.id === 'st-antenne', null, 8000));
await page.locator('#st-menu').click();
T.check('« Menu principal » : retour à l\'écran titre', await until(page, () => !document.getElementById('title').hidden, null, 8000));
await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
T.check('clavier : flèches puis Entrée sur « Jouer »', await until(page, () => document.getElementById('title').hidden, null, 8000));
T.check('version affichée sur la feuille de service', (await ev(() => document.getElementById('stversion')?.textContent || '')).includes(VERSION));

// le lieu : le car en service, l'entrepôt, la salle de concert en préparation (fiche « Ce qui se prépare »)
T.check('lieux : 3 écrans (car, entrepôt, concert), le car en service', await ev(() => [...document.querySelectorAll('.jo-lieux .lx')].map((b) => b.dataset.lieu).join(',') === 'car,entrepot,concert' && document.querySelector('.lx.on')?.dataset.lieu === 'car'));
await page.locator('.lx[data-lieu="concert"]').click();
T.check('écran « Salle de concert » : fiche « Ce qui se prépare »', await until(page, () => /Ce qui se prépare : Salle de concert/.test(document.querySelector('#modal h2')?.textContent || '') && !!document.querySelector('#modal .lx-teaser li'), null, 8000));
await ev(() => document.querySelector('#modal .x')?.click());
await page.locator('.lx[data-lieu="car"]').click();
T.check('écran « Car régie » : le choix du mode prend le focus', await until(page, () => !!document.activeElement?.matches('.jo-mode[aria-pressed="true"]'), null, 5000));

// chef de car : touche J sur l'écran Jouer, puis la visite guidée
await page.keyboard.press('KeyJ');
T.check('touche J sur l\'écran Jouer', await chefOpen() && /visite guidée/i.test(await chefText()));
await page.keyboard.press('KeyJ');
T.check('touche J referme le chef', await chefClosed());
// une mission spécifique : un exercice d'Olivier dans le car prêt à l'antenne (les tests d'erreurs ont besoin des caméras)
await page.locator('.jo-mode[data-mode="mission"]').click();
await ev(() => { const d = [...document.querySelectorAll('.mc-grp')].find((x) => x.querySelector('[data-mission="vision-exposition"]')); if (d) d.open = true; });
await page.locator('.mc-item[data-mission="vision-exposition"]').click();
await page.locator('#st-antenne').click();
T.check('« Mission spécifique » : car lancé, Olivier commence l\'exercice', await until(page, () => window.__dbg.S.mode === 'fps' && window.__dbg.TUTOR.lesson?.id === 'vision-exposition', null, 90000));
const f0 = await ev(() => window.__dbg.S.frame);
T.check('le rendu tourne', await until(page, (f) => window.__dbg.S.frame > f + 5, f0, 60000));
await shot('01-partie');

// bouton de la barre d'outils
await page.locator('#tb-chef').click();
T.check('bouton « Chef de car » de la barre : ferme', await chefClosed());
await page.locator('#tb-chef').click();
T.check('bouton « Chef de car » de la barre : rouvre', await chefOpen());

// le pupitre (Tab) : les postes rangés par zone du car, les outils ; une touche emmène au poste
await ev(() => window.__dbg.toggleChef(false));
await page.keyboard.press('Tab');
T.check('Tab ouvre le pupitre : zones du car et outils', await until(page, () => /Pupitre/.test(document.querySelector('#modal h2')?.textContent || '') && document.querySelectorAll('#modal .pp-bank').length >= 4 && document.querySelectorAll('#modal .dkey.tool').length >= 10, null, 8000));
await shot('02-pupitre');
await page.locator('#modal .dkey', { hasText: 'Truquiste' }).click();
T.check('touche « Truquiste » du pupitre : poste Mélangeur ouvert', await until(page, () => window.__dbg.S.mode === 'station' && window.__dbg.S.station === 'melangeur', null, 30000));
await ev(() => window.__dbg.closeStation());

// visite arrêtée : à un poste, la touche J ouvre le chef sur les exercices de ce poste
await ev(() => { window.__dbg.stopChefLesson(); window.__dbg.S.visite = false; window.__dbg.toggleChef(false); window.__dbg.openStation('melangeur'); });
await until(page, () => window.__dbg.S.mode === 'station', null, 30000);
await page.keyboard.press('KeyJ');
T.check('touche J au poste Mélangeur : exercices du poste', await chefOpen() && /Ici, au poste/.test(await chefText()));
await shot('03-poste');
// livret de compétences depuis le chef : 4 blocs, 39 compétences ; le chef se réduit
await page.locator('#chef button', { hasText: 'Mon livret de compétences' }).click();
T.check('livret de compétences : 4 blocs, 39 compétences, chef réduit', await until(page, () => document.querySelectorAll('#modal .lv-card').length === 4 && document.querySelectorAll('#modal .lv-comp').length === 39 && document.querySelector('#chef').classList.contains('min'), null, 8000));
await page.locator('#modal .lv-card').nth(1).click();
T.check('livret : un bloc s\'ouvre depuis son résumé', await until(page, () => !!document.querySelectorAll('#modal details.lv-bloc')[1]?.open, null, 5000));
await shot('03b-livret');
await ev(() => document.querySelector('#modal .x')?.click());
await ev(() => { window.__dbg.toggleChef(false); window.__dbg.closeStation(); });

// diagnostic sans erreur
await ev(() => window.__dbg.diag.openDiag());
const d0 = await ev(() => document.querySelector('#modal .diag-text')?.value || '');
T.check('diagnostic : version, navigateur, chef, aucune erreur', d0.includes(`Version : ${VERSION}`) && /Navigateur : /.test(d0) && /Chef de car : /.test(d0) && /Erreurs : aucune/.test(d0), d0.split('\n').slice(4, 8).join(' | '));
await ev(() => { const x = document.querySelector('#modal .x'); if (x) x.click(); });

// erreurs : un écouteur d'événement, une image de la boucle de rendu, une erreur non rattrapée
const errsBefore = T.errors.length;
await ev(() => { window.__dbg.on('essai-diag', () => { throw new Error('essai : écouteur'); }); window.__dbg.emit('essai-diag'); });
T.check('erreur d\'un écouteur : bandeau à l\'écran', await until(page, () => { const b = document.getElementById('diagbar'); return !!b && !b.hidden && /écouteur/.test(b.textContent); }, null, 5000));
await ev(() => { const c = window.__dbg.S.cams[0]; c.__up = c.update; c.update = () => { throw new Error('essai : image'); }; });
const f1 = await ev(() => window.__dbg.S.frame);
await until(page, () => (window.__dbg.diag.ERRS.find((e) => e.where === 'boucle de rendu')?.n || 0) > 3, null, 60000);
await ev(() => { const c = window.__dbg.S.cams[0]; c.update = c.__up; });
T.check('erreur dans une image : notée une fois, le rendu continue', await until(page, (f) => window.__dbg.S.frame > f + 5, f1, 60000) && (await ev(() => window.__dbg.diag.ERRS.filter((e) => e.where === 'boucle de rendu').length)) === 1);
// lancée par un script de la page (une erreur du code injecté par le test est masquée en « Script error. » par WebKit)
await ev(() => { const sc = document.createElement('script'); sc.textContent = 'setTimeout(function () { throw new Error("essai : non rattrapée"); }, 0);'; document.body.append(sc); });
await until(page, () => window.__dbg.diag.ERRS.some((e) => /non rattrapée|sans détail/.test(e.msg)), null, 5000);
const d1 = await ev(() => window.__dbg.diag.diagText());
// une erreur non rattrapée garde son message, sauf WebKit sur une page ouverte comme fichier :
// il le masque (« Script error. »), le diagnostic le dit
T.check('diagnostic : les trois erreurs, avec leur endroit', /événement « essai-diag »/.test(d1) && /boucle de rendu · essai : image \(×\d+\)/.test(d1) && /non rattrapée|sans détail/.test(d1), d1.split('\n').filter((l) => /^\d+\./.test(l)).join(' | '));
// un geste de l'interface (clic) qui plante : noté à la source, avec le bouton et le message
await ev(() => { document.body.append(window.__dbg.diag.el('button', { id: 'essai-clic', style: { position: 'fixed', left: '8px', top: '200px', zIndex: '60' }, onclick: () => { throw new Error('essai : clic'); } }, 'Essai')); });
await page.locator('#essai-clic').click();
T.check('erreur d\'un clic : notée avec le bouton et le message', await until(page, () => window.__dbg.diag.ERRS.some((e) => /clic sur button « Essai »/.test(e.where) && e.msg === 'essai : clic'), null, 5000));
await ev(() => document.getElementById('essai-clic').remove());
await page.locator('#diagbar button', { hasText: 'Copier le diagnostic' }).click();
T.check('« Copier le diagnostic » répond', await until(page, () => /Copié|Sélectionné/.test(document.querySelector('#diagbar .btn.primary')?.textContent || ''), null, 5000));
await shot('04-bandeau');
// ces erreurs sont voulues : on les retire du bilan (Firefox écrit seulement « Error » dans la console)
for (let i = T.errors.length - 1; i >= errsBefore; i--) if (/essai : |^(Uncaught )?Error$/.test(T.errors[i].trim())) T.errors.splice(i, 1);

// programme qui ne démarre pas (erreur de syntaxe) : écran de secours avec le diagnostic
const errs2 = [];
const broken = simHtml().replace(/<script type="module">[\s\S]*<\/script>/, '<script type="module">const x = ;</script>');
const p2 = await openPage(browser, { errors: errs2, fresh: true, before: (pg) => pg.route('http://local.test/**', (r) => r.fulfill({ body: broken, contentType: 'text/html' })), ready: '!!document.querySelector("#err:not([hidden]) .boot-diag")' });
const d2 = await p2.evaluate(() => document.querySelector('#err .boot-diag textarea').value);
T.check('écran de secours : diagnostic avec la version et l\'erreur de syntaxe', d2.includes(`Version : ${VERSION}`) && /\[erreur\]/.test(d2), d2.split('\n').slice(6, 10).join(' | '));
await p2.screenshot({ path: `${OUT}/${BROWSER}-05-secours.png` });
await T.finish();
