// Version à partager (dist/Car-regie-3D.html) ouverte d'un double-clic : file://, Internet coupé.
// Vérifie que rien n'est chargé du réseau (three.js intégré), que le simulateur démarre et rend,
// que le chef de car fonctionne, que le panneau « Jouer à plusieurs » explique quoi lancer et que
// la progression reste dans le navigateur d'une ouverture à l'autre.
// node tests/e2e/fichier.mjs [dossier]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, openPage, outDir, until, reporter } from './harness.mjs';
const OUT = outDir('fichier');
const T = reporter();
const ROOT = path.resolve(import.meta.dirname, '../..');
const URL_FILE = pathToFileURL(path.join(ROOT, 'dist/Car-regie-3D.html')).href + '?lite';
const browser = await launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
// hors ligne : toute requête réseau échoue ; on note celles qui ne sont pas des polices
const net = [];
await context.route(/^https?:\/\//, (r) => { if (!/fonts\.g/.test(r.request().url())) net.push(r.request().url()); return r.abort(); });
const page = await openPage(context, { url: URL_FILE, errors: T.errors });
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n) => { await page.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); T.log('shot', n); };

T.check('ouverte en file://, hors claude.ai et hors réseau local', await ev(() => location.protocol === 'file:' && !window.claude && !window.CARREGIE_LAN));
await ev(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } window.__dbg.start('standard', 'jour', 'basse', false, 'HD', false); });
T.check('partie lancée', await until(page, () => window.__dbg.S.mode === 'fps'));
const f0 = await ev(() => window.__dbg.S.frame);
T.check('le rendu tourne', await until(page, (f) => window.__dbg.S.frame > f + 5, f0), String(f0));
await shot('01-jeu');

// chef de car
await page.keyboard.press('KeyJ');
T.check('chef de car ouvert', await until(page, () => !document.querySelector('#chef').hidden, null, 5000));
T.check('parcours proposés', await ev(() => document.querySelectorAll('#chef .chef-card').length > 3));
await ev(() => window.__dbg.startChefLesson('poste-melangeur'));
for (let i = 0; i < 12 && (await ev(() => !!window.__dbg.TUTOR.lesson)); i++) await ev(() => window.__dbg.chefNext());
T.check('présentation du poste suivie jusqu\'au bout', await ev(() => !window.__dbg.TUTOR.lesson && !!window.__dbg.PROG.tutor['poste-melangeur']?.done));
await shot('02-chef');
await page.keyboard.press('KeyJ');

// jouer à plusieurs : explication propre au fichier, pas de téléchargement impossible
await page.locator('#tb-ses').click();
T.check('panneau « Jouer à plusieurs » : quoi lancer', await until(page, () => /Cette copie est un fichier/.test(document.body.textContent) && /Car-regie-3D\.exe/.test(document.body.textContent), null, 15000));
T.check('pas de bouton de téléchargement du serveur', await ev(() => ![...document.querySelectorAll('button')].some((b) => /Télécharger le serveur/.test(b.textContent))));
await shot('03-plusieurs');

// progression conservée à la réouverture du fichier (enregistrement différé de 2,5 s)
T.check('progression enregistrée dans le navigateur', await until(page, () => /poste-melangeur/.test(localStorage.getItem('carregie.progress') || ''), null, 15000));
await page.reload();
await page.waitForFunction('!!window.__dbg', null, { timeout: 180000, polling: 200 });
T.check('progression retrouvée après réouverture', await until(page, () => !!window.__dbg.PROG.tutor?.['poste-melangeur']?.done, null, 15000));

T.check('aucune requête réseau hors polices', net.length === 0, net.slice(0, 5).join(' '));
await T.finish();
