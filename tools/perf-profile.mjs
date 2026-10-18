// Mesure du temps processeur de la boucle principale par sous-système (profileur ?perf),
// dans trois situations : dans le stade en marchant, dans le car en marchant, au mélangeur.
//   node tools/perf-profile.mjs [page.html] [secondes par situation]
// Rendu logiciel (SwiftShader) : seuls les écarts entre deux versions mesurées sur la même
// machine ont un sens, pas les valeurs absolues.
import { launch, openPage } from '../tests/e2e/harness.mjs';

const FILE = process.argv[2] || 'dist/index.html';
const SECS = +(process.argv[3] || 25);
const errors = [];
const browser = await launch();
const page = await openPage(browser, { viewport: { width: 1280, height: 720 }, query: 'lite&perf', errors, file: FILE });
const ev = (f, a) => page.evaluate(f, a);
await ev(() => { try { localStorage.setItem('carregie.onboard', '1'); } catch (e) { /* */ } window.__dbg.start('standard', 'jour', 'basse', false); });
await page.waitForFunction(() => window.__dbg.S.mode === 'fps', null, { timeout: 120000 });
await page.waitForTimeout(4000);
const out = {};
async function measure(name, setup) {
  await ev(setup);
  await page.waitForTimeout(2000);
  await ev(() => window.__dbg.profReset());
  const f0 = await ev(() => window.__dbg.S.frame);
  // marche en avant puis demi-tour, pour que la visée et les collisions travaillent
  const walk = name !== 'poste';
  const t0 = Date.now();
  while (Date.now() - t0 < SECS * 1000) {
    if (walk) { await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW'); await ev(() => { window.__dbg.PL.yaw += Math.PI; }); }
    else await page.waitForTimeout(1500);
  }
  const frames = (await ev(() => window.__dbg.S.frame)) - f0;
  out[name] = { images: frames, ...(await ev(() => window.__dbg.profSnapshot())) };
}
await measure('stade', () => { window.__dbg.teleport(5); });
await measure('car', () => { window.__dbg.teleport(1); });
await measure('poste', () => { window.__dbg.openStation('melangeur'); });
console.log(JSON.stringify({ page: FILE, secondes: SECS, mesures: out }, null, 1));
console.log('ERRORS', errors.length, errors.slice(0, 3).join('\n'));
await browser.close();
