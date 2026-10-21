// Captures des interfaces (accueil, HUD, postes, fenêtres) pour juger l'ergonomie
// node tests/e2e/interfaces.mjs [dossier] [liste de captures séparées par des virgules]
import { launch, openPage, outDir } from './harness.mjs';
import fs from 'fs';
const OUT = outDir('interfaces');
const ONLY = process.argv[3] || '';
fs.mkdirSync(OUT, { recursive: true });
const browser = await launch();
const errors = [];
const want = (n) => !ONLY || ONLY.split(',').some((k) => n.startsWith(k));
async function newPage(vw, vh, q = '') {
  const page = await openPage(browser, { viewport: { width: vw, height: vh }, query: q, errors });
  return page;
}
const page = await newPage(1440, 900, 'nopost');
const ev = (f, a) => page.evaluate(f, a);
const shot = async (n, w = 1200, p = page) => { await p.waitForTimeout(w); await p.screenshot({ path: `${OUT}/${n}.png`, timeout: 180000 }); console.log('shot', n); };
if (want('u01')) await shot('u01-accueil');
await ev(() => window.__dbg.start('standard', 'jour', 'basse', false));
await page.waitForTimeout(3500);
if (want('u02')) await shot('u02-hud-compound');
if (want('u03')) { await ev(() => window.__dbg.teleport(1)); await shot('u03-hud-car', 2000); }
if (want('u04')) { await page.keyboard.press('KeyT'); await shot('u04-allera'); await ev(() => document.querySelector('#modal .x')?.click()); }
if (want('u05')) { await ev(() => window.__dbg.openPlan()); await shot('u05-plan', 2500); await ev(() => window.__dbg.closePlan()); }
for (const [k, st] of [['u06', 'melangeur'], ['u07', 'vision'], ['u08', 'son'], ['u09', 'evs'], ['u10', 'realisateur'], ['u11', 'grille']]) {
  if (!want(k)) continue;
  await ev((st) => window.__dbg.openStation(st), st); await shot(k + '-poste-' + st, 2000); await ev(() => window.__dbg.closeStation());
}
if (want('u12')) { await ev(() => window.__dbg.openGuide()); await shot('u12-cours'); await ev(() => document.querySelector('#layer .ly-close')?.click()); }
if (want('u13')) { await ev(() => window.__dbg.openEquipmentIndex()); await shot('u13-materiel'); await ev(() => document.querySelector('#modal .x')?.click()); }
if (want('u14')) { await ev(() => window.__dbg.openTrainer()); await shot('u14-formateur'); await ev(() => document.querySelector('#modal .x')?.click()); }
if (want('u15')) { await ev(() => window.__dbg.openSessionPanel()); await shot('u15-session'); await ev(() => document.querySelector('#modal .x')?.click()); }
if (want('u16')) { await page.keyboard.press('KeyY'); await shot('u16-synoptiques', 2000); await ev(() => document.querySelector('#modal .x')?.click()); }
if (want('u17')) {
  await page.close(); // le rendu continu de la première page affame le chargement de la seconde
  const m = await newPage(400, 860, 'lite&nopost');
  await shot('u17-mobile-accueil', 800, m);
  await m.evaluate(() => window.__dbg.start('standard', 'jour', 'basse', false)); await m.waitForTimeout(3000);
  await shot('u18-mobile-hud', 800, m);
  await m.evaluate(() => window.__dbg.openStation('melangeur')); await shot('u19-mobile-poste', 1500, m);
}
console.log('ERRORS', errors.length, errors.slice(0, 5).join('\n'));
await browser.close();
process.exitCode = errors.length ? 1 : 0;
