// Accès par mot de passe (TIEE-Simulator.exe) : le serveur protégé assemblé comme dans l'exécutable
// (tools/protege.mjs, vraie page du simulateur chiffrée, scrypt allégé pour aller vite), ouvert dans
// un navigateur. Écran « Accès réservé » (logo, mentions), mauvais mot de passe, bon mot de passe :
// le simulateur s'ouvre ; un second navigateur doit donner le mot de passe à son tour.
// node tests/e2e/acces.mjs [dossier]
import { launch, outDir, until, reporter } from './harness.mjs';
import { serveurProtege } from '../../tools/protege.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT = outDir('acces');
const R = reporter();
const MDP = 'essai du car régie';
const PORT = 8000 + Math.floor(Math.random() * 900);
const WORK = path.join(OUT, 'srv'); fs.rmSync(WORK, { recursive: true, force: true }); fs.mkdirSync(WORK, { recursive: true });
await serveurProtege({ page: fs.readFileSync('dist/index-lan.html', 'utf8'), mdp: MDP, kdf: { N: 2 ** 14, r: 8, p: 1 }, outfile: path.join(WORK, 'serveur.mjs') });
const srv = spawn(process.execPath, ['serveur.mjs', '--port', String(PORT)], { cwd: WORK });
let srvLog = '';
process.on('exit', () => { try { srv.kill(); } catch (e) { /* déjà arrêté */ } });
srv.stdout.on('data', (d) => { srvLog += d; }); srv.stderr.on('data', (d) => { srvLog += d; });
for (let i = 0; i < 50 && !srvLog.includes('localhost'); i++) await new Promise((r) => setTimeout(r, 100));
R.check('serveur démarré, accès protégé annoncé', /Accès protégé/.test(srvLog));

async function onglet(b, viewport = { width: 1280, height: 800 }) {
  const page = await b.newPage({ viewport });
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => R.errors.push('PAGEERROR: ' + e.message));
  await page.addInitScript(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } });
  await page.goto(`http://localhost:${PORT}/?lite`);
  return page;
}

const A = await onglet(await launch());
R.check('écran « Accès réservé »', await A.evaluate(() => /Accès réservé/.test(document.body.textContent) && !!document.querySelector('input[type=password]')));
R.check('mentions : TIEE Simulator, BTS de Saint-Quentin, Pierre MALYCHA', await A.evaluate(() => ['TIEE Simulator', 'BTS Audiovisuel de Saint-Quentin', 'Pierre MALYCHA', 'simulation non officielle'].every((t) => document.body.textContent.includes(t))));
R.check('logo affiché', await A.evaluate(() => { const i = document.querySelector('img.logo'); return !!i && i.complete && i.naturalWidth > 0; }));
R.check('le champ a le focus', await A.evaluate(() => document.activeElement && document.activeElement.id === 'mdp'));
R.check('rien du simulateur dans la page', await A.evaluate(() => !window.CARREGIE_LAN && !window.__dbg && document.documentElement.outerHTML.length < 100000));
await A.screenshot({ path: OUT + '/a1-acces.png' });

await A.locator('#mdp').fill('pas le bon');
await A.keyboard.press('Enter');
R.check('mauvais mot de passe : message', await until(A, () => document.querySelector('#msg').textContent === 'Mot de passe incorrect.', null, 20000));
await A.screenshot({ path: OUT + '/a2-incorrect.png' });

await A.locator('#mdp').fill(MDP);
await A.locator('#ok').click();
R.check('bon mot de passe : le simulateur s\'ouvre (écran titre)', await until(A, () => !!window.__dbg && !!window.CARREGIE_LAN && !!document.querySelector('#title, #start'), null, 180000));
await A.waitForTimeout(1500);
await A.screenshot({ path: OUT + '/a3-simulateur.png' });
R.check('console : déverrouillé', /simulateur déverrouillé/.test(srvLog) && /mot de passe incorrect/.test(srvLog));

// téléphone, second navigateur : l'écran d'accès d'abord, à sa largeur
const B = await onglet(await launch(), { width: 390, height: 780 });
R.check('autre navigateur : mot de passe demandé aussi', await B.evaluate(() => /Accès réservé/.test(document.body.textContent) && !window.__dbg));
R.check('téléphone : pas de défilement horizontal', await B.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
await B.screenshot({ path: OUT + '/a4-telephone.png' });

srv.kill();
await R.finish();
