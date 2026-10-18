// Luminance moyenne des images caméra (sorties CCU) : compare rendu physique / rendu Lambert
import { launch, openPage } from './harness.mjs';
const browser = await launch();
// node tests/e2e/exposition.mjs [lumière : jour | fin | couvert | nuit]
const L = process.argv[2] || 'jour';
const errors = [];
for (const q of ['nopbr', '']) {
  const page = await openPage(browser, { viewport: { width: 960, height: 540 }, query: q, errors });
  await page.evaluate((L) => window.__dbg.start('standard', L, 'basse', false), L);
  await page.waitForTimeout(9000);
  const res = await page.evaluate(() => {
    const D = window.__dbg; const r = D.renderer; const out = {};
    for (const c of D.S.cams.slice(0, 8)) {
      const rt = c.outRT; if (!rt) continue;
      const w = rt.width, h = rt.height; const buf = new Uint8Array(w * h * 4);
      r.readRenderTargetPixels(rt, 0, 0, w, h, buf);
      let s = 0, hi = 0; for (let i = 0; i < buf.length; i += 4) { const y = 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]; s += y; if (y > 250) hi++; }
      out['CAM' + c.id] = [(s / (w * h)).toFixed(1), (hi / (w * h) * 100).toFixed(1) + '%'];
    }
    return { pbr: D.RENDER.pbr, out };
  });
  console.log(q || 'pbr', JSON.stringify(res), 'erreurs', errors.length);
  await page.close();
}
console.log('ERRORS', errors.length, errors.slice(0, 3).join(' | '));
await browser.close();
process.exitCode = errors.length ? 1 : 0;
